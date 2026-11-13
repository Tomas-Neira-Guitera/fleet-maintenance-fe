import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { VehicleTopView, type TopViewPosition } from './VehicleTopView';

function positions(codes: [string, string, number, 'izq' | 'der' | null, TopViewPosition['wheel']][]): TopViewPosition[] {
  return codes.map(([position, label, axle, side, wheel]) => ({ position, label, axle, side, wheel }));
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
    render(
      <VehicleTopView
        vehicleType="tractor_4x2"
        positions={TRACTOR}
        stateOf={(p) => (p === 'e1-izq' ? 'crit' : p === 'auxilio' ? 'empty' : 'ok')}
        describe={(p) => (p === 'e1-izq' ? 'Michelin N° 1234, pinchada' : p === 'auxilio' ? 'sin cubierta' : 'Fate')}
        selected={null}
        onSelect={onSelect}
      />,
    );

    expect(screen.getAllByRole('button')).toHaveLength(7);
    const front = screen.getByRole('button', { name: 'Delantera izquierda: Michelin N° 1234, pinchada' });
    expect(front).toHaveClass('top-view__tire--crit');
    await userEvent.click(screen.getByRole('button', { name: 'Auxilio: sin cubierta' }));
    expect(onSelect).toHaveBeenCalledWith('auxilio');
  });

  it('una posición deshabilitada no se elige', async () => {
    const onSelect = vi.fn();
    render(
      <VehicleTopView
        vehicleType="tractor_4x2"
        positions={TRACTOR}
        stateOf={() => 'empty'}
        isDisabled={() => true}
        selected={null}
        onSelect={onSelect}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Auxilio' }));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('sin un tipo del catálogo no dibuja nada', () => {
    const { container } = render(
      <VehicleTopView vehicleType="colectivo" positions={[]} stateOf={() => 'ok'} selected={null} onSelect={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
