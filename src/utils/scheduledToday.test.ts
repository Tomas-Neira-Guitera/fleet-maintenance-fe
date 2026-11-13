import { describe, expect, it } from 'vitest';
import type { Vehicle } from '../types/domain';
import { scheduledTodayTime } from './scheduledToday';

const vehicle = (scheduledToday: string | null): Vehicle => ({
  id: 'v-1',
  plate: 'AB123CD',
  brand: 'Ford',
  model: 'Cargo',
  status: 'available',
  scheduledToday,
});

describe('scheduledTodayTime (CAM-143)', () => {
  // 12/11 a las 10:00 de Argentina.
  const now = new Date('2026-11-12T13:00:00Z');

  it('da la hora argentina del turno de hoy', () => {
    expect(scheduledTodayTime(vehicle('2026-11-12T18:00:00Z'), now)).toBe('15:00');
  });

  it('un turno a las 22:00 es de ese día aunque en UTC ya sea el siguiente (CAM-88)', () => {
    expect(scheduledTodayTime(vehicle('2026-11-13T01:00:00Z'), now)).toBe('22:00');
  });

  it('sin turno, o con uno de otro día (la flota guardada sin señal), no hay nada', () => {
    expect(scheduledTodayTime(vehicle(null), now)).toBeNull();
    expect(scheduledTodayTime(vehicle('2026-11-11T18:00:00Z'), now)).toBeNull();
  });
});
