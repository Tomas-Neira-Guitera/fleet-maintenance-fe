import { describe, expect, it } from 'vitest';
import type { NextMaintenanceSummary } from '../types/domain';
import { daysUntilDue, describeNextMaintenance } from './maintenanceFormat';

const TODAY = new Date(2026, 10, 5, 18, 30); // 5/11/2026, a la tarde

function next(overrides: Partial<NextMaintenanceSummary>): NextMaintenanceSummary {
  return {
    assignmentId: 'asg_1',
    name: 'Cambio de aceite',
    status: 'al_dia',
    dueDate: null,
    dueKm: null,
    remainingDays: null,
    remainingKm: null,
    estimatedDueDate: null,
    ...overrides,
  };
}

describe('daysUntilDue (CAM-137)', () => {
  it('un plan por km entra por su fecha estimada', () => {
    expect(daysUntilDue(next({ remainingKm: 1000, estimatedDueDate: '2026-11-15' }), TODAY)).toBe(10);
  });

  it('un plan por km sin estimación no tiene días', () => {
    expect(daysUntilDue(next({ remainingKm: 800 }), TODAY)).toBeNull();
  });

  it('un plan que ya llegó a sus km cuenta como hoy', () => {
    expect(daysUntilDue(next({ remainingKm: -200 }), TODAY)).toBe(0);
    expect(daysUntilDue(next({ remainingKm: 0 }), TODAY)).toBe(0);
  });

  it('en un plan por km y por tiempo manda la fecha más cercana', () => {
    const both = { remainingKm: 3000, remainingDays: 20, dueDate: '2026-11-25' };
    expect(daysUntilDue(next({ ...both, estimatedDueDate: '2026-11-12' }), TODAY)).toBe(7);
    expect(daysUntilDue(next({ ...both, estimatedDueDate: '2027-01-10' }), TODAY)).toBe(20);
  });

  it('un plan solo por tiempo usa sus días, también vencido', () => {
    expect(daysUntilDue(next({ remainingDays: -3, dueDate: '2026-11-02' }), TODAY)).toBe(-3);
  });
});

describe('describeNextMaintenance (CAM-137)', () => {
  it('suma la fecha estimada al lado de los km que faltan', () => {
    expect(describeNextMaintenance(next({ remainingKm: 1000, estimatedDueDate: '2026-11-15' }), TODAY))
      .toBe('en 1.000 km · vence aprox. el 15/11');
  });

  it('pone el año si la fecha estimada no es de este año', () => {
    expect(describeNextMaintenance(next({ remainingKm: 10000, estimatedDueDate: '2028-03-20' }), TODAY))
      .toBe('en 10.000 km · vence aprox. el 20/03/2028');
  });

  it('sin estimación queda como antes', () => {
    expect(describeNextMaintenance(next({ remainingKm: -200 }), TODAY)).toBe('vencida hace 200 km');
    expect(describeNextMaintenance(next({ remainingDays: 3, dueDate: '2026-11-08' }), TODAY))
      .toBe('vence en 3 días · 08/11/2026');
  });
});
