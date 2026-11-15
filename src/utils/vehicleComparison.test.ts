import { describe, expect, it } from 'vitest';
import type { VehicleComparisonRow } from '../types/domain';
import { describeReview, sortComparison } from './vehicleComparison';

function row(plate: string, overrides: Partial<VehicleComparisonRow> = {}): VehicleComparisonRow {
  return {
    vehicleId: plate,
    plate,
    brand: 'Ford',
    model: 'Cargo',
    vehicleType: null,
    year: 2018,
    maintenanceCost: 0,
    operatingCost: 0,
    totalCost: 0,
    kmDriven: null,
    maintenanceCostPerKm: null,
    totalCostPerKm: null,
    availabilityPct: 100,
    downtimeHours: 0,
    stops: 0,
    recurringControls: 0,
    review: { flagged: false, reasons: [] },
    ...overrides,
  };
}

const plates = (rows: VehicleComparisonRow[]) => rows.map((r) => r.plate);

describe('sortComparison (CAM-140)', () => {
  const rows = [
    row('CC', { maintenanceCostPerKm: 50, totalCostPerKm: 300 }),
    row('AA'),
    row('BB', { maintenanceCostPerKm: 200, totalCostPerKm: 210 }),
  ];

  it('ordena por costo por km y deja los que no tienen dato al final, en las dos direcciones', () => {
    expect(plates(sortComparison(rows, { column: 'costPerKm', direction: 'desc' }, 'maintenance'))).toEqual(['BB', 'CC', 'AA']);
    expect(plates(sortComparison(rows, { column: 'costPerKm', direction: 'asc' }, 'maintenance'))).toEqual(['CC', 'BB', 'AA']);
  });

  it('el costo por km sigue al selector de mantenimiento o total', () => {
    expect(plates(sortComparison(rows, { column: 'costPerKm', direction: 'desc' }, 'total'))).toEqual(['CC', 'BB', 'AA']);
  });

  it('ordena por patente y a igualdad desempata por patente', () => {
    expect(plates(sortComparison(rows, { column: 'plate', direction: 'asc' }, 'maintenance'))).toEqual(['AA', 'BB', 'CC']);
    expect(plates(sortComparison(rows, { column: 'recurringControls', direction: 'desc' }, 'maintenance'))).toEqual([
      'AA',
      'BB',
      'CC',
    ]);
  });
});

describe('describeReview (CAM-140)', () => {
  it('dice por qué está para revisar', () => {
    expect(describeReview(['maintenance_cost_per_km', 'availability'])).toBe(
      'Costo por km y disponibilidad peores que el promedio',
    );
    expect(describeReview(['availability', 'recurring_defects'])).toBe(
      'Disponibilidad y fallas recurrentes peores que el promedio',
    );
    expect(describeReview(['maintenance_cost_per_km', 'availability', 'recurring_defects'])).toBe(
      'Costo por km, disponibilidad y fallas recurrentes peores que el promedio',
    );
  });
});
