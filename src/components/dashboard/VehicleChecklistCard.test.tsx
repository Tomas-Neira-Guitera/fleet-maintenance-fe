import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addVehicleChecklistItem, getVehicleChecklistConfig } from '../../services/checklistService';
import type { VehicleChecklistItem } from '../../types/domain';
import { VehicleChecklistCard } from './VehicleChecklistCard';

vi.mock('../../services/checklistService', () => ({
  getVehicleChecklistConfig: vi.fn(),
  addVehicleChecklistItem: vi.fn(),
  setVehicleChecklistItemEnabled: vi.fn(),
  deleteVehicleChecklistItem: vi.fn(),
}));

const item = (id: string, label: string, section: VehicleChecklistItem['section'], locked = false): VehicleChecklistItem => ({
  id, label, type: locked ? 'number' : 'check', section, required: locked, origin: 'base', enabled: true, locked,
});

beforeEach(() => {
  vi.mocked(getVehicleChecklistConfig).mockResolvedValue([
    item('ext-luces', 'Luces', 'exterior'),
    item('int-km', 'Kilómetros actuales', 'interior', true),
    item('post-danos', 'Daños nuevos en la carrocería', 'posttrip'),
    item('post-km', 'Kilómetros finales', 'posttrip', true),
  ]);
});

describe('checklist del vehículo: pre-viaje y post-viaje (CAM-159)', () => {
  it('arranca en el pre-viaje y el selector muestra el post-viaje', async () => {
    const user = userEvent.setup();
    render(<VehicleChecklistCard vehicleId="v-1" plate="AB123CD" />);

    expect(await screen.findByText('Luces')).toBeInTheDocument();
    expect(screen.queryByText('Daños nuevos en la carrocería')).not.toBeInTheDocument();
    expect(screen.getByText('Checklist de inspección (2 ítems)')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Post-viaje' }));

    expect(screen.getByText('Daños nuevos en la carrocería')).toBeInTheDocument();
    expect(screen.queryByText('Luces')).not.toBeInTheDocument();
    // Los km finales siguen siendo obligatorios.
    expect(screen.getByText('Obligatorio')).toBeInTheDocument();
  });

  it('un ítem agregado desde el post-viaje va al post-viaje', async () => {
    const user = userEvent.setup();
    vi.mocked(addVehicleChecklistItem).mockResolvedValue({
      ...item('extra-1', 'Rampa guardada', 'posttrip'),
      origin: 'extra',
    });
    render(<VehicleChecklistCard vehicleId="v-1" plate="AB123CD" />);

    await user.click(await screen.findByRole('button', { name: 'Post-viaje' }));
    await user.click(screen.getByRole('button', { name: '+ Agregar ítem' }));
    expect(screen.getByRole('heading', { name: 'Agregar ítem al post-viaje' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Sección')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText(/Qué revisar/), 'Rampa guardada');
    await user.click(screen.getByRole('button', { name: 'Agregar' }));

    expect(addVehicleChecklistItem).toHaveBeenCalledWith('v-1', { label: 'Rampa guardada', section: 'posttrip', enabled: true });
    expect(await screen.findByText('Rampa guardada')).toBeInTheDocument();
  });
});
