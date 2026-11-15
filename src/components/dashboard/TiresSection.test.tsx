import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTireBrandComparison, getTires } from '../../services/tiresService';
import { getVehicles } from '../../services/vehiclesService';
import type { Tire, Vehicle } from '../../types/domain';
import { TiresSection } from './TiresSection';

vi.mock('../../services/tiresService', () => ({
  getTires: vi.fn(),
  getTireBrandComparison: vi.fn(),
  deleteTire: vi.fn(),
  retireTire: vi.fn(),
}));
vi.mock('../../services/vehiclesService', () => ({ getVehicles: vi.fn() }));

const vehicle = (id: string, plate: string, vehicleType: string): Vehicle => ({
  id, plate, brand: 'Marca', model: 'Modelo', status: 'available', vehicleType,
});

function tire(id: string, brand: string, status: Tire['status'], current?: [string, string, string], problem = false): Tire {
  return {
    id, code: id, brand, model: null, size: '295/80 R22.5', purchaseDate: '2026-01-01', cost: 500000, status,
    retiredAt: null, retiredReason: null, km: 1000, costPerKm: 500,
    current: current
      ? { vehicleId: current[0], plate: current[1], position: current[2], positionLabel: '', mountedAt: '', mountedKm: 0 }
      : null,
    condition: problem
      ? {
          vehicleId: current![0], plate: current![1], position: current![2], positionLabel: 'Delantera derecha',
          conditions: ['pinchada'], conditionLabels: ['Pinchada'], severity: 'non-blocking',
          reportedAt: '2026-11-01T10:00:00Z', reportedBy: 'chofer1', defectId: 'd-1', active: true,
        }
      : null,
  };
}

beforeEach(() => {
  vi.mocked(getVehicles).mockResolvedValue([
    vehicle('v-a', 'AA111AA', 'utilitario'),
    vehicle('v-b', 'BB222BB', 'utilitario'),
  ]);
  vi.mocked(getTires).mockResolvedValue([
    tire('t-1', 'Fate', 'mounted', ['v-a', 'AA111AA', 'e1-izq']),
    tire('t-2', 'Michelin', 'mounted', ['v-b', 'BB222BB', 'e1-der'], true),
    tire('t-3', 'Pirelli', 'stock'),
    tire('t-4', 'Fate', 'retired'),
  ]);
  vi.mocked(getTireBrandComparison).mockResolvedValue({
    minKm: 1000,
    brands: [
      { brand: 'Fate', tires: 2, retired: 1, totalKm: 2000, totalCost: 1, costPerKm: 20, averageKm: 1000 },
      { brand: 'Michelin', tires: 1, retired: 0, totalKm: 1000, totalCost: 1, costPerKm: 40, averageKm: 1000 },
    ],
  });
});

describe('inventario de cubiertas (CAM-157)', () => {
  it('arranca por vehículo, con los que tienen problemas primero', async () => {
    render(<TiresSection onBack={vi.fn()} onOpenVehicle={vi.fn()} />);

    const groups = await screen.findAllByRole('button', { expanded: false });
    expect(groups[0]).toHaveTextContent('BB222BB');
    expect(groups[0]).toHaveTextContent('1/5 montadas');
    expect(groups[0]).toHaveTextContent('1 a revisar');
    expect(screen.getByRole('button', { name: /A revisar/ })).toHaveTextContent('1');
  });

  it('al abrir un vehículo muestra sus posiciones y qué reportaron', async () => {
    const user = userEvent.setup();
    const onOpenVehicle = vi.fn();
    render(<TiresSection onBack={vi.fn()} onOpenVehicle={onOpenVehicle} />);

    await user.click(await screen.findByRole('button', { name: /BB222BB/ }));
    const row = screen.getByRole('row', { name: /Delantera derecha/ });
    expect(within(row).getByText('Pinchada')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ver neumáticos de BB222BB' }));
    expect(onOpenVehicle).toHaveBeenCalledWith('v-b');
  });

  it('"A revisar" deja solo los vehículos con problemas', async () => {
    const user = userEvent.setup();
    render(<TiresSection onBack={vi.fn()} onOpenVehicle={vi.fn()} />);

    await user.click(await screen.findByRole('button', { name: /A revisar/ }));
    expect(screen.queryByRole('button', { name: /AA111AA/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /BB222BB/ })).toBeInTheDocument();
  });

  it('stock y bajas se filtran y se buscan', async () => {
    const user = userEvent.setup();
    render(<TiresSection onBack={vi.fn()} onOpenVehicle={vi.fn()} />);

    await user.click(await screen.findByRole('tab', { name: 'Stock y bajas' }));
    expect(screen.getByText('Pirelli N° t-3')).toBeInTheDocument();
    expect(screen.getByText('Fate N° t-4')).toBeInTheDocument();
    expect(screen.queryByText('Fate N° t-1')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Dadas de baja', pressed: false }));
    expect(screen.queryByText('Pirelli N° t-3')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Todas' }));
    await user.type(screen.getByRole('searchbox', { name: 'Buscar' }), 'pirelli');
    expect(screen.queryByText('Fate N° t-4')).not.toBeInTheDocument();
  });

  it('las marcas van en su propia vista, de la más barata por km a la más cara', async () => {
    const user = userEvent.setup();
    render(<TiresSection onBack={vi.fn()} onOpenVehicle={vi.fn()} />);

    expect(screen.queryByText('Costo por km por marca')).not.toBeInTheDocument();
    await user.click(await screen.findByRole('tab', { name: 'Marcas' }));
    const rows = screen.getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('Fate');
    expect(rows[1]).toHaveTextContent('Michelin');
  });
});
