import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, saveSession } from '../services/apiClient';
import { submitInspection } from '../services/inspectionsService';
import { uploadDefectPhoto } from '../services/photosService';
import type { ChecklistAnswer, LoginResult } from '../types/domain';
import {
  discardPendingInspection,
  enqueueInspection,
  hasPendingInspections,
  listPendingInspections,
  resetPendingInspectionsForTests,
  syncPendingInspections,
  type NewPendingInspection,
} from './pendingInspections';

vi.mock('../services/inspectionsService', () => ({ submitInspection: vi.fn() }));
vi.mock('../services/photosService', () => ({ uploadDefectPhoto: vi.fn() }));

const submitMock = vi.mocked(submitInspection);
const uploadMock = vi.mocked(uploadDefectPhoto);

/** JWT de mentira con el usuario en `sub`: la cola es de cada chofer. */
function login(userId: string) {
  const payload = btoa(JSON.stringify({ sub: userId })).replace(/=+$/, '');
  saveSession({ token: `x.${payload}.y`, role: 'CHOFER' } as LoginResult);
}

const OK: ChecklistAnswer = { itemId: 'ext-luces', label: 'Luces', section: 'exterior', type: 'check', outcome: 'ok' };

function inspection(overrides: Partial<NewPendingInspection>): NewPendingInspection {
  return {
    id: crypto.randomUUID(),
    vehicleId: 'veh-1',
    plate: 'AB123CD',
    type: 'pre-trip',
    answers: [OK],
    performedAt: '2026-11-06T10:00:00.000Z',
    ...overrides,
  };
}

/** Encola sin que el envío automático corra antes de lo que el test quiere ver. */
async function enqueueOffline(...items: NewPendingInspection[]) {
  submitMock.mockRejectedValue(new TypeError('Failed to fetch'));
  uploadMock.mockRejectedValue(new TypeError('Failed to fetch'));
  for (const item of items) await enqueueInspection(item);
  await syncPendingInspections();
  submitMock.mockReset();
  uploadMock.mockReset();
}

beforeEach(() => {
  resetPendingInspectionsForTests();
  login('chofer-1');
});

describe('cola de inspecciones sin señal (CAM-153)', () => {
  it('sin señal la inspección queda guardada y pendiente', async () => {
    await enqueueOffline(inspection({}));

    const items = await listPendingInspections();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ status: 'pending', userId: 'chofer-1', plate: 'AB123CD' });
    expect(await hasPendingInspections()).toBe(true);
  });

  it('al volver la señal las manda en el orden en que se hicieron, con su hora y su id', async () => {
    const post = inspection({ type: 'post-trip', performedAt: '2026-11-06T18:00:00.000Z' });
    const pre = inspection({ performedAt: '2026-11-06T08:00:00.000Z' });
    await enqueueOffline(post, pre);
    submitMock.mockResolvedValue({} as Awaited<ReturnType<typeof submitInspection>>);

    const result = await syncPendingInspections();

    expect(result.sent).toBe(2);
    expect(submitMock.mock.calls.map((call) => call[1])).toEqual(['pre-trip', 'post-trip']);
    expect(submitMock.mock.calls[0][4]).toEqual({ performedAt: pre.performedAt, clientSubmissionId: pre.id });
    expect(await listPendingInspections()).toEqual([]);
  });

  it('si se vuelve a cortar, frena y deja el resto para después', async () => {
    await enqueueOffline(inspection({ performedAt: '2026-11-06T08:00:00.000Z' }),
      inspection({ type: 'post-trip', performedAt: '2026-11-06T18:00:00.000Z' }));
    submitMock.mockResolvedValueOnce({} as Awaited<ReturnType<typeof submitInspection>>)
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const result = await syncPendingInspections();

    expect(result).toEqual({ sent: 1, stoppedBy: 'offline' });
    const items = await listPendingInspections();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ type: 'post-trip', status: 'pending' });
  });

  it('sube la foto sacada sin señal antes de mandar la inspección', async () => {
    const photo = new Blob(['jpg'], { type: 'image/jpeg' });
    const defect: ChecklistAnswer = {
      ...OK,
      outcome: 'defect',
      defect: { severity: 'blocking', description: 'Farol roto', pendingPhoto: photo, pendingPhotoPreview: 'blob:x' },
    };
    await enqueueOffline(inspection({ answers: [defect] }));
    uploadMock.mockResolvedValue({ photoId: 'p1', photoUrl: 'http://api/photos/p1' });
    submitMock.mockResolvedValue({} as Awaited<ReturnType<typeof submitInspection>>);

    await syncPendingInspections();

    expect(uploadMock).toHaveBeenCalledOnce();
    const sentAnswers = submitMock.mock.calls[0][2];
    expect(sentAnswers[0].defect).toMatchObject({ photoUrl: 'http://api/photos/p1', pendingPhoto: undefined });
  });

  it('si el servidor la rechaza queda marcada con el motivo, y el post-viaje de ese vehículo no se manda', async () => {
    await enqueueOffline(inspection({ performedAt: '2026-11-06T08:00:00.000Z' }),
      inspection({ type: 'post-trip', performedAt: '2026-11-06T18:00:00.000Z' }));
    submitMock.mockRejectedValue(new ApiError(409, 'Bloqueado', 'VEHICLE_BLOCKED'));

    await syncPendingInspections();

    expect(submitMock).toHaveBeenCalledOnce();
    const [pre, post] = await listPendingInspections();
    expect(pre).toMatchObject({ status: 'rejected' });
    expect(pre.error).toMatch(/AB123CD no puede salir/);
    expect(post).toMatchObject({ status: 'rejected' });
    expect(post.error).toMatch(/pre-viaje de AB123CD no se aceptó/);
  });

  it('con la sesión vencida no descarta nada', async () => {
    await enqueueOffline(inspection({}));
    submitMock.mockRejectedValue(new ApiError(401, 'Token vencido', 'UNAUTHORIZED'));

    const result = await syncPendingInspections();

    expect(result.stoppedBy).toBe('session');
    expect((await listPendingInspections())[0].status).toBe('pending');
  });

  it('cada chofer ve y manda solo las suyas', async () => {
    await enqueueOffline(inspection({}));
    login('chofer-2');

    expect(await listPendingInspections()).toEqual([]);
    submitMock.mockResolvedValue({} as Awaited<ReturnType<typeof submitInspection>>);
    await syncPendingInspections();
    expect(submitMock).not.toHaveBeenCalled();
  });

  it('una rechazada se puede descartar', async () => {
    await enqueueOffline(inspection({}));
    const [item] = await listPendingInspections();

    await discardPendingInspection(item.id);

    expect(await listPendingInspections()).toEqual([]);
  });
});
