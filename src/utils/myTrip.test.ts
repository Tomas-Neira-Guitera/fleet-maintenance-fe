import { describe, expect, it } from 'vitest';
import type { PendingInspection } from '../offline/pendingInspections';
import type { Vehicle } from '../types/domain';
import { findMyTrip } from './myTrip';

const ME = 'u-1';

function vehicle(id: string, extra: Partial<Vehicle> = {}): Vehicle {
  return { id, plate: id.toUpperCase(), brand: 'Iveco', model: 'Daily', status: 'available', vehicleType: 'utilitario', ...extra };
}

function onTrip(id: string, openedBy: string, startedAt = '2026-11-15T08:00:00Z'): Vehicle {
  return vehicle(id, { status: 'on-trip', currentTrip: { startedAt, openedBy: { id: openedBy, name: openedBy } } });
}

function pending(vehicleId: string, type: PendingInspection['type'], performedAt = '2026-11-15T09:00:00Z'): PendingInspection {
  return { id: `p-${vehicleId}`, userId: ME, vehicleId, plate: vehicleId, type, answers: [], performedAt, status: 'pending' };
}

describe('findMyTrip', () => {
  it('no encuentra nada si el único viaje abierto es de otro chofer', () => {
    expect(findMyTrip([vehicle('a'), onTrip('b', 'u-2')], [], ME)).toBeNull();
  });

  it('devuelve el vehículo del viaje propio', () => {
    expect(findMyTrip([vehicle('a'), onTrip('b', ME)], [], ME)?.id).toBe('b');
  });

  it('cuenta el pre-viaje guardado sin señal como viaje abierto', () => {
    const trip = findMyTrip([vehicle('a'), vehicle('b')], [pending('a', 'pre-trip')], ME);
    expect(trip?.id).toBe('a');
    expect(trip?.currentTrip?.startedAt).toBe('2026-11-15T09:00:00Z');
  });

  it('un bloqueante en el remolque, guardado sin señal, no deja salir (CAM-159)', () => {
    const blocked = {
      ...pending('a', 'pre-trip'),
      trailerAnswers: [
        {
          itemId: 'rem-frenos', label: 'Frenos', section: 'exterior' as const, type: 'check' as const, outcome: 'defect' as const,
          defect: { severity: 'blocking' as const, description: 'No frena' },
        },
      ],
    };
    expect(findMyTrip([vehicle('a')], [blocked], ME)).toBeNull();
  });

  it('un post-viaje guardado sin señal ya cerró el viaje', () => {
    expect(findMyTrip([onTrip('a', ME)], [pending('a', 'post-trip')], ME)).toBeNull();
  });

  it('ignora lo rechazado por el servidor', () => {
    const rejected = { ...pending('a', 'pre-trip'), status: 'rejected' as const };
    expect(findMyTrip([vehicle('a')], [rejected], ME)).toBeNull();
  });

  it('ignora los remolques', () => {
    expect(findMyTrip([{ ...onTrip('r', ME), vehicleType: 'acoplado' }], [], ME)).toBeNull();
  });

  it('con más de un viaje propio, se queda con el último', () => {
    const trips = [onTrip('a', ME, '2026-11-14T08:00:00Z'), onTrip('b', ME, '2026-11-15T08:00:00Z')];
    expect(findMyTrip(trips, [], ME)?.id).toBe('b');
  });

  it('sin usuario en sesión no hay viaje propio', () => {
    expect(findMyTrip([onTrip('a', ME)], [], null)).toBeNull();
  });
});
