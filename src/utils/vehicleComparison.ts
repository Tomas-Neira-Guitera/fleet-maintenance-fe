import type { ComparisonReason, VehicleComparisonRow } from '../types/domain';

/** Las columnas por las que se ordena la comparación (CAM-140). */
export type ComparisonColumn =
  | 'plate'
  | 'year'
  | 'maintenanceCost'
  | 'operatingCost'
  | 'totalCost'
  | 'kmDriven'
  | 'costPerKm'
  | 'availabilityPct'
  | 'downtimeHours'
  | 'recurringControls';

export type CostBasis = 'maintenance' | 'total';

export interface ComparisonSort {
  column: ComparisonColumn;
  direction: 'asc' | 'desc';
}

/** El costo por km que se muestra: solo mantenimiento (reparar o reemplazar) o el total (lo que cuesta tenerlo). */
export function costPerKm(row: VehicleComparisonRow, basis: CostBasis): number | null {
  return basis === 'maintenance' ? row.maintenanceCostPerKm : row.totalCostPerKm;
}

function value(row: VehicleComparisonRow, column: ComparisonColumn, basis: CostBasis): number | string | null {
  if (column === 'costPerKm') return costPerKm(row, basis);
  return row[column];
}

/**
 * Ordena por una columna. Los que no tienen dato ("Sin datos") quedan siempre al final, en las dos
 * direcciones: no son ni los mejores ni los peores. A igualdad, por patente.
 */
export function sortComparison(
  rows: VehicleComparisonRow[],
  sort: ComparisonSort,
  basis: CostBasis,
): VehicleComparisonRow[] {
  const factor = sort.direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = value(a, sort.column, basis);
    const vb = value(b, sort.column, basis);
    if (va == null && vb == null) return a.plate.localeCompare(b.plate);
    if (va == null) return 1;
    if (vb == null) return -1;
    const diff = typeof va === 'string' ? va.localeCompare(vb as string) : va - (vb as number);
    return diff !== 0 ? diff * factor : a.plate.localeCompare(b.plate);
  });
}

const REASON_LABEL: Record<ComparisonReason, string> = {
  maintenance_cost_per_km: 'Costo por km',
  availability: 'disponibilidad',
  recurring_defects: 'fallas recurrentes',
};

/** "Costo por km y disponibilidad peores que el promedio". */
export function describeReview(reasons: ComparisonReason[]): string {
  const labels = reasons.map((reason) => REASON_LABEL[reason]);
  const joined = labels.length <= 1 ? labels.join('') : `${labels.slice(0, -1).join(', ')} y ${labels[labels.length - 1]}`;
  const text = `${joined} peores que el promedio`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
