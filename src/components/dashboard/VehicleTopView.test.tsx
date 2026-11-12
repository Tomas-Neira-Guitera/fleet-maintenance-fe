import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { VehicleTirePosition } from '../../types/domain';
import { VehicleTopView } from './VehicleTopView';

function positions(codes: [string, string, number, 'izq' | 'der' | null, VehicleTirePosition['wheel']][]): VehicleTirePosition[] {
  return codes.map(([position, label, axle, side, wheel]) => ({ position, label, axle, side, wheel, tire: null }));
}

const TRACTOR = positions([
  ['e1-izq', 'Delantera izquierda', 1, 'izq', 'simple'],
  ['e1-der', 'Delantera derecha', 1, 'der', 'simple'],
  ['e2-izq-ext', 'Trasera izquierda exterior', 2, 'izq', 'exterior'],
  ['e2-izq-int', 'Trasera izquierda interior', 2, 'izq', 'interior'],
  ['e2-der-int', 'Trasera derecha interior', 2, 'der', 'interior'],
  ['e2-der-ext', 'Trasera derecha exterior', 2, 'der', 'exterior'],
  ['auxilio', 'Auxilio', 0, null, 'simple'],
]);

describe('vista de arriba del vehículo (CAM-157)', () => {
  it('dibuja una cubierta por posición, con su estado, y avisa cuál se toca', async () => {
    const onSelect = vi.fn();
    TRACTOR[0] = {
      ...TRACTOR[0],
      tire: {
        id: 't-1', code: '1234', brand: 'Michelin', model: null, size: '295/80 R22.5', purchaseDate: '2026-01-01', cost: 1,
        initialTreadMm: null, status: 'mounted', retiredAt: null, retiredReason: null, km: 0, costPerKm: null, current: null,
        lastTread: { depthMm: 1.2, measuredAt: '2026-11-01T00:00:00Z', measuredBy: null, belowMinimum: true },
      },
    };
    render(<VehicleTopView vehicleType="tractor_4x2" positions={TRACTOR} selected={null} onSelect={onSelect} />);

    expect(screen.getAllByRole('button')).toHaveLength(7);
    expect(screen.getByRole('button', { name: 'Delantera izquierda: Michelin N° 1234, dibujo por debajo del mínimo' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Auxilio: sin cubierta' }));
    expect(onSelect).toHaveBeenCalledWith('auxilio');
  });

  it('sin un tipo del catálogo no dibuja nada', () => {
    const { container } = render(<VehicleTopView vehicleType="colectivo" positions={[]} selected={null} onSelect={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
