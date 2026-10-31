import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChecklistAnswer } from '../types/domain';
import { ApiError, saveSession } from './apiClient';
import { submitInspection, toWireAnswers } from './inspectionsService';

const base = { label: 'Luces', section: 'exterior', type: 'check' } as const;

describe('toWireAnswers', () => {
  it('manda el defecto solo si el ítem quedó con defecto (CAM-94)', () => {
    const answers: ChecklistAnswer[] = [
      { ...base, itemId: 'ext-luces', outcome: 'ok', defect: { severity: 'blocking', description: 'Quedó de antes' } },
      {
        ...base,
        itemId: 'ext-neumaticos',
        outcome: 'defect',
        defect: { severity: 'non-blocking', description: '  Goma gastada ', details: '   ', photoUrl: 'http://x/f.jpg' },
      },
    ];

    expect(toWireAnswers(answers)).toEqual([
      { itemId: 'ext-luces', outcome: 'ok', numberValue: undefined, defect: undefined },
      {
        itemId: 'ext-neumaticos',
        outcome: 'defect',
        numberValue: undefined,
        defect: { severity: 'non-blocking', description: 'Goma gastada', details: undefined, photoUrl: 'http://x/f.jpg' },
      },
    ]);
  });

  it('convierte los kilómetros a número y omite el campo vacío', () => {
    const answers: ChecklistAnswer[] = [
      { itemId: 'int-km', label: 'Km', section: 'interior', type: 'number', numberValue: '84320' },
      { itemId: 'post-km', label: 'Km', section: 'posttrip', type: 'number', numberValue: '' },
    ];

    const wire = toWireAnswers(answers);
    expect(wire[0].numberValue).toBe(84320);
    expect(wire[1].numberValue).toBeUndefined();
  });
});

describe('submitInspection', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('hace el POST con el token y devuelve la respuesta', async () => {
    saveSession({ token: 'jwt-123', role: 'CHOFER' } as Parameters<typeof saveSession>[0]);
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ inspection: { id: 'i1' } }), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await submitInspection('veh-1', 'post-trip', [], 'Todo bien');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/inspections\/veh-1$/);
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json', Authorization: 'Bearer jwt-123' });
    expect(JSON.parse(init.body)).toEqual({ type: 'post-trip', answers: [], notes: 'Todo bien' });
    expect(res).toEqual({ inspection: { id: 'i1' } });
  });

  it('convierte una respuesta de error en ApiError con el código del backend', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'VEHICLE_ON_TRIP', message: 'Ya tiene un viaje abierto' }), { status: 409 }),
      ),
    );

    const err = await submitInspection('veh-1', 'pre-trip', []).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 409, errorCode: 'VEHICLE_ON_TRIP', message: 'Ya tiene un viaje abierto' });
  });
});
