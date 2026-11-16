import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getVehicles } from '../../services/vehiclesService';
import type { Vehicle } from '../../types/domain';
import { VehiclesSection } from './VehiclesSection';

vi.mock('../../services/vehiclesService', () => ({ getVehicles: vi.fn() }));

const vehicle = (id: string, plate: string, brand: string, vehicleType: string, active = true): Vehicle => ({
  id, plate, brand, model: 'Modelo', status: 'available', vehicleType, active, odometerKm: 1000,
});

beforeEach(() => {
  vi.mocked(getVehicles).mockImplementation(async (active = true) =>
    active
      ? [
          vehicle('v-1', 'AB123CD', 'Scania', 'tractor_4x2'),
          vehicle('v-2', 'AC456EF', 'Iveco', 'camion_4x2'),
          vehicle('r-1', 'ZZ001AA', 'Helvética', 'semirremolque_3_ejes'),
        ]
      : [vehicle('v-9', 'AA999ZZ', 'Ford', 'camion_4x2', false)],
  );
});

function renderSection() {
  render(<VehiclesSection onOpenVehicle={vi.fn()} onCompare={vi.fn()} onOpenTemplates={vi.fn()} onOpenTires={vi.fn()} />);
}

describe('Vehículos del admin (CAM-159)', () => {
  it('los dados de baja tienen su pestaña y ya no hay tilde en el encabezado', async () => {
    const user = userEvent.setup();
    renderSection();

    expect(await screen.findByRole('tab', { name: /Vehículos\s*2/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Remolques\s*1/ })).toBeInTheDocument();
    expect(screen.queryByLabelText('Ver dados de baja')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /Dados de baja\s*1/ }));
    const table = screen.getByRole('table');
    expect(within(table).getByText('AA999ZZ')).toBeInTheDocument();
    expect(within(table).queryByText('AB123CD')).not.toBeInTheDocument();
  });

  it('busca por patente, marca o modelo en la pestaña abierta', async () => {
    const user = userEvent.setup();
    renderSection();
    await user.click(await screen.findByRole('tab', { name: /Vehículos/ }));

    await user.type(screen.getByLabelText('Buscar vehículos'), 'iveco');
    const table = screen.getByRole('table');
    expect(within(table).getByText('AC456EF')).toBeInTheDocument();
    expect(within(table).queryByText('AB123CD')).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText('Buscar vehículos'));
    await user.type(screen.getByLabelText('Buscar vehículos'), 'ab 123');
    expect(within(table).getByText('AB123CD')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Buscar vehículos'));
    await user.type(screen.getByLabelText('Buscar vehículos'), 'mercedes');
    expect(screen.getByText('Ningún vehículo coincide con "mercedes".')).toBeInTheDocument();
  });
});
