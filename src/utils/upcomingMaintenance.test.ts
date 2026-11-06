import { describe, expect, it } from 'vitest';
import type { FleetStatusRow, NextMaintenanceSummary } from '../types/domain';
import { groupByDueDays, WITHOUT_ESTIMATE_LABEL } from './upcomingMaintenance';

const TODAY = new Date(2026, 10, 5, 18, 30); // 5/11/2026

function row(plate: string, next: Partial<NextMaintenanceSummary> | null): FleetStatusRow {
  return {
    vehicleId: plate,
    plate,
    brand: 'Ford',
    model: 'Cargo',
    vehicleType: null,
    odometerKm: 50000,
    healthScore: 100,
    status: next?.status ?? 'al_dia',
    nextMaintenance: next && {
      assignmentId: `asg_${plate}`,
      name: 'Cambio de aceite',
      status: 'al_dia',
      dueDate: null,
      dueKm: null,
      remainingDays: null,
      remainingKm: null,
      estimatedDueDate: null,
      ...next,
    },
  };
}

function plates(groups: ReturnType<typeof groupByDueDays>) {
  return groups.map((group) => [group.label, group.items.map((item) => item.plate)]);
}

describe('groupByDueDays (CAM-137)', () => {
  it('un plan por km con fecha estimada entra en la franja de esa fecha', () => {
    // Criterio de la card: unos 100 km por día y 1.000 km por delante, a 10 días.
    const groups = groupByDueDays([row('AA', { status: 'por_vencer', remainingKm: 1000, estimatedDueDate: '2026-11-15' })], TODAY);

    expect(plates(groups)).toEqual([['8-14 días', ['AA']]]);
  });

  it('un plan vencido por km cae en la primera franja', () => {
    const groups = groupByDueDays([row('AA', { status: 'vencido', remainingKm: -300 })], TODAY);

    expect(plates(groups)).toEqual([['Próximos 7 días', ['AA']]]);
  });

  it('sin estimación va aparte, solo si no está al día, por los km que faltan', () => {
    const groups = groupByDueDays([
      row('LEJOS', { status: 'al_dia', remainingKm: 8000 }),
      row('B', { status: 'por_vencer', remainingKm: 900 }),
      row('A', { status: 'por_vencer', remainingKm: 200 }),
    ], TODAY);

    expect(plates(groups)).toEqual([[WITHOUT_ESTIMATE_LABEL, ['A', 'B']]]);
  });

  it('ordena cada franja por días y deja afuera lo que vence después de 30 días', () => {
    const groups = groupByDueDays([
      row('TIEMPO', { remainingDays: 5, dueDate: '2026-11-10' }),
      row('KM', { status: 'por_vencer', remainingKm: 300, estimatedDueDate: '2026-11-07' }),
      row('LEJOS', { remainingKm: 9000, estimatedDueDate: '2027-02-01' }),
      row('SIN_PLAN', null),
    ], TODAY);

    expect(plates(groups)).toEqual([['Próximos 7 días', ['KM', 'TIEMPO']]]);
  });
});
