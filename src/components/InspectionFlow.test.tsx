import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, saveUsername } from '../services/apiClient';
import { getVehicleChecklist } from '../services/checklistService';
import { submitInspection } from '../services/inspectionsService';
import { uploadDefectPhoto } from '../services/photosService';
import type { ChecklistItemDef, InspectionType, SubmitInspectionResult, Vehicle } from '../types/domain';
import { InspectionFlow } from './InspectionFlow';

vi.mock('../services/checklistService', () => ({ getVehicleChecklist: vi.fn() }));
vi.mock('../services/inspectionsService', () => ({ submitInspection: vi.fn() }));
vi.mock('../services/photosService', () => ({
  ACCEPTED_PHOTO_TYPES: 'image/jpeg,image/png',
  uploadDefectPhoto: vi.fn(),
}));

const checklistMock = vi.mocked(getVehicleChecklist);
const submitMock = vi.mocked(submitInspection);
const uploadMock = vi.mocked(uploadDefectPhoto);

const VEHICLE: Vehicle = { id: 'veh-1', plate: 'AB123CD', brand: 'Iveco', model: 'Daily', status: 'available' };

// Checklist pre-viaje de un vehículo con un ítem propio (CAM-31) al final del exterior.
const PRE_TRIP: ChecklistItemDef[] = [
  { id: 'ext-luces', label: 'Luces', type: 'check', section: 'exterior' },
  { id: 'ext-neumaticos', label: 'Neumáticos', type: 'check', section: 'exterior' },
  { id: 'extra-faja', label: 'Estado de la faja de sujeción', type: 'check', section: 'exterior' },
  { id: 'int-km', label: 'Kilómetros actuales', type: 'number', section: 'interior', required: true },
  { id: 'int-testigos', label: 'Testigos de tablero', type: 'check', section: 'interior' },
];

const POST_TRIP: ChecklistItemDef[] = [
  { id: 'post-danos', label: 'Daños nuevos en la carrocería', type: 'check', section: 'posttrip' },
  { id: 'post-luces', label: 'Luces', type: 'check', section: 'posttrip' },
  { id: 'post-km', label: 'Kilómetros finales', type: 'number', section: 'posttrip', required: true },
];

function result(type: InspectionType, hasBlockingDefect = false): SubmitInspectionResult {
  return {
    inspection: {
      id: 'insp-1',
      tripId: 'trip-1',
      vehicleId: VEHICLE.id,
      driverId: 'u-1',
      type,
      timestamp: '2026-10-29T12:00:00Z',
      odometerKm: 84320,
      answers: [],
      hasBlockingDefect,
    },
    trip: { id: 'trip-1', vehicleId: VEHICLE.id, status: type === 'pre-trip' ? 'open' : 'closed', startedAt: '', endedAt: null },
  };
}

function renderFlow(type: InspectionType = 'pre-trip') {
  const props = {
    onDone: vi.fn(),
    onBack: vi.fn(),
    onUnavailable: vi.fn(),
    onLogout: vi.fn(),
  };
  render(<InspectionFlow vehicle={VEHICLE} type={type} {...props} />);
  return props;
}

async function goToSummary(user: ReturnType<typeof userEvent.setup>, kmLabel = 'Kilómetros actuales', km = '84320') {
  await user.type(await screen.findByLabelText(kmLabel), km);
  await user.click(screen.getByRole('button', { name: 'Continuar' }));
  await screen.findByRole('heading', { name: 'Resumen' });
}

async function confirmAndSend(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByLabelText('Declaro que la información es correcta'));
  await user.click(screen.getByRole('button', { name: 'Enviar inspección' }));
}

beforeEach(() => {
  checklistMock.mockImplementation(async (_id, type) => (type === 'pre-trip' ? PRE_TRIP : POST_TRIP));
  saveUsername('carlos.gomez');
});

describe('InspectionFlow — pre-viaje', () => {
  it('pide el checklist del vehículo y lo muestra por sección, todo en OK', async () => {
    renderFlow();

    expect(screen.getByText('Cargando checklist…')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Pre-viaje' })).toBeInTheDocument();
    expect(checklistMock).toHaveBeenCalledWith('veh-1', 'pre-trip');

    const exterior = screen.getByRole('heading', { name: 'Inspección visual (exterior)' }).closest('section')!;
    expect(within(exterior).getByText('Estado de la faja de sujeción')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Inspección interior (cabina)' })).toBeInTheDocument();
    expect(screen.getByText('4 controles en OK')).toBeInTheDocument();
    expect(screen.getByText('AB123CD').parentElement).toHaveTextContent(/AB123CD · carlos.gomez ·/);
    for (const toggle of screen.getAllByRole('switch')) {
      expect(toggle).toHaveAttribute('aria-checked', 'false');
    }
  });

  it('si no se puede pedir el checklist usa la lista base', async () => {
    checklistMock.mockRejectedValue(new Error('offline'));
    renderFlow();

    expect(await screen.findByText('Fugas visibles debajo del vehículo')).toBeInTheDocument();
    expect(screen.getByText('Documentación a bordo (seguro y VTV/RTO)')).toBeInTheDocument();
  });

  it('no avanza sin los kilómetros', async () => {
    const user = userEvent.setup();
    renderFlow();
    await screen.findByRole('heading', { name: 'Pre-viaje' });

    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(screen.getByText('Este campo es obligatorio.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Resumen' })).not.toBeInTheDocument();
  });

  it('"Volver" en el checklist sale sin enviar nada', async () => {
    const user = userEvent.setup();
    const { onBack } = renderFlow();
    await screen.findByRole('heading', { name: 'Pre-viaje' });

    await user.click(screen.getByRole('button', { name: 'Volver' }));

    expect(onBack).toHaveBeenCalledOnce();
    expect(submitMock).not.toHaveBeenCalled();
  });

  it('sin defectos: resumen limpio, confirma y envía todo en OK', async () => {
    const user = userEvent.setup();
    submitMock.mockResolvedValue(result('pre-trip'));
    const { onDone } = renderFlow();

    await goToSummary(user);
    expect(screen.getByText('Sin defectos reportados. Todo en orden.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar inspección' })).toBeDisabled();

    await confirmAndSend(user);

    expect(submitMock).toHaveBeenCalledOnce();
    const [vehicleId, type, answers, notes] = submitMock.mock.calls[0];
    expect(vehicleId).toBe('veh-1');
    expect(type).toBe('pre-trip');
    expect(notes).toBeUndefined();
    expect(answers.map((a) => a.itemId)).toEqual(PRE_TRIP.map((i) => i.id));
    expect(answers.find((a) => a.itemId === 'int-km')?.numberValue).toBe('84320');
    expect(answers.filter((a) => a.type === 'check').every((a) => a.outcome === 'ok')).toBe(true);

    expect(await screen.findByRole('heading', { name: 'Inspección enviada' })).toBeInTheDocument();
    expect(screen.getByText(/El pre-viaje de AB123CD quedó registrado. Buen viaje./)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Volver a la flota' }));
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('"Volver" en el resumen regresa al checklist con lo cargado', async () => {
    const user = userEvent.setup();
    renderFlow();
    await goToSummary(user);

    await user.click(screen.getByRole('button', { name: 'Volver' }));

    expect(screen.getByLabelText('Kilómetros actuales')).toHaveValue(84320);
  });

  it('con un defecto bloqueante exige la foto, lo muestra en el resumen y avisa al enviar', async () => {
    const user = userEvent.setup();
    uploadMock.mockResolvedValue({ photoId: 'p1', photoUrl: 'http://x/p1.jpg' });
    submitMock.mockResolvedValue(result('pre-trip', true));
    renderFlow();
    await screen.findByRole('heading', { name: 'Pre-viaje' });

    await user.click(screen.getByRole('switch', { name: 'Neumáticos: reportar defecto' }));
    await user.click(screen.getByRole('button', { name: 'Bloqueante' }));
    await user.type(screen.getByLabelText('Título (obligatorio)'), 'Neumático pinchado');
    await user.type(screen.getByLabelText('Kilómetros actuales'), '84320');
    expect(screen.getByText('1 de 4 con defecto')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getByText('Los defectos bloqueantes necesitan foto y descripción.')).toBeInTheDocument();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, new File(['x'], 'goma.jpg', { type: 'image/jpeg' }));
    await screen.findByAltText('Foto del defecto reportado');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    const defects = await screen.findByRole('heading', { name: 'Defectos reportados' });
    const list = defects.parentElement!;
    expect(within(list).getByText('Neumáticos')).toBeInTheDocument();
    expect(within(list).getByText('Bloqueante')).toBeInTheDocument();

    await confirmAndSend(user);

    const answers = submitMock.mock.calls[0][2];
    expect(answers.find((a) => a.itemId === 'ext-neumaticos')).toMatchObject({
      outcome: 'defect',
      defect: { severity: 'blocking', description: 'Neumático pinchado', photoUrl: 'http://x/p1.jpg' },
    });
    expect(await screen.findByText('Mantenimiento fue notificado — vehículo no apto para circular.')).toBeInTheDocument();
    expect(screen.getByText(/queda no disponible hasta que se resuelva el defecto/)).toBeInTheDocument();
  });

  it('un defecto que se volvió a OK no cuenta en el resumen', async () => {
    const user = userEvent.setup();
    renderFlow();
    await screen.findByRole('heading', { name: 'Pre-viaje' });

    const toggle = screen.getByRole('switch', { name: 'Luces: reportar defecto' });
    await user.click(toggle);
    await user.type(screen.getByLabelText('Título (obligatorio)'), 'Faro roto');
    await user.click(toggle);

    expect(screen.getByText('4 controles en OK')).toBeInTheDocument();
    await goToSummary(user);
    expect(screen.getByText('Sin defectos reportados. Todo en orden.')).toBeInTheDocument();
  });
});

describe('InspectionFlow — errores al enviar', () => {
  it('si el vehículo quedó bloqueado vuelve a la flota con el motivo', async () => {
    const user = userEvent.setup();
    submitMock.mockRejectedValue(new ApiError(409, 'Bloqueado', 'VEHICLE_BLOCKED'));
    const { onUnavailable } = renderFlow();
    await goToSummary(user);

    await confirmAndSend(user);

    expect(onUnavailable).toHaveBeenCalledWith(
      'No se envió la inspección: AB123CD tiene un defecto bloqueante sin resolver y no puede salir.',
    );
  });

  it('con la sesión vencida ofrece cerrar sesión', async () => {
    const user = userEvent.setup();
    submitMock.mockRejectedValue(new ApiError(401, 'Token vencido', 'UNAUTHORIZED'));
    const { onLogout, onUnavailable } = renderFlow();
    await goToSummary(user);

    await confirmAndSend(user);

    expect(await screen.findByText('Tu sesión venció. Cerrá sesión y volvé a entrar.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(onLogout).toHaveBeenCalledOnce();
    expect(onUnavailable).not.toHaveBeenCalled();
  });

  it('ante otro error muestra el detalle y deja reintentar', async () => {
    const user = userEvent.setup();
    submitMock
      .mockRejectedValueOnce(
        new ApiError(422, 'La inspección tiene errores', 'VALIDATION_ERROR', [
          { itemId: 'int-km', message: 'Los kilómetros no pueden ser negativos' },
        ]),
      )
      .mockResolvedValueOnce(result('pre-trip'));
    renderFlow();
    await goToSummary(user);

    await confirmAndSend(user);

    expect(
      await screen.findByText('La inspección tiene errores: Los kilómetros no pueden ser negativos.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Enviar inspección' }));
    expect(await screen.findByRole('heading', { name: 'Inspección enviada' })).toBeInTheDocument();
  });
});

describe('InspectionFlow — post-viaje', () => {
  it('usa el checklist corto, manda las novedades y cierra el viaje', async () => {
    const user = userEvent.setup();
    submitMock.mockResolvedValue(result('post-trip'));
    renderFlow('post-trip');

    expect(await screen.findByRole('heading', { name: 'Post-viaje' })).toBeInTheDocument();
    expect(checklistMock).toHaveBeenCalledWith('veh-1', 'post-trip');
    expect(screen.getByRole('heading', { name: 'Estado del vehículo' })).toBeInTheDocument();
    expect(screen.getByText('2 controles en OK')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Detalle de problemas / novedades (opcional)'), '  Ruido en la caja  ');
    await goToSummary(user, 'Kilómetros finales', '84900');
    await confirmAndSend(user);

    const [, type, answers, notes] = submitMock.mock.calls[0];
    expect(type).toBe('post-trip');
    expect(notes).toBe('Ruido en la caja');
    expect(answers.find((a) => a.itemId === 'post-km')?.numberValue).toBe('84900');
    expect(await screen.findByText(/El post-viaje de AB123CD quedó registrado. El viaje fue cerrado./)).toBeInTheDocument();
  });

  it('sin novedades no manda notas', async () => {
    const user = userEvent.setup();
    submitMock.mockResolvedValue(result('post-trip'));
    renderFlow('post-trip');

    await goToSummary(user, 'Kilómetros finales', '84900');
    await confirmAndSend(user);

    expect(submitMock.mock.calls[0][3]).toBeUndefined();
  });

  it('si alguien cerró el viaje mientras tanto vuelve a la flota con el motivo', async () => {
    const user = userEvent.setup();
    submitMock.mockRejectedValue(new ApiError(409, 'Sin viaje', 'NO_OPEN_TRIP'));
    const { onUnavailable } = renderFlow('post-trip');

    await goToSummary(user, 'Kilómetros finales', '84900');
    await confirmAndSend(user);

    expect(onUnavailable).toHaveBeenCalledWith(
      'No se envió la inspección: AB123CD ya no tiene un viaje abierto: alguien lo cerró.',
    );
  });
});
