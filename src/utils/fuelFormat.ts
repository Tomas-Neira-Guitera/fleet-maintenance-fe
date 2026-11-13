// CAM-156: cómo se muestran litros, consumo y costo por km.

const litersFormatter = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });
const consumptionFormatter = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const costPerKmFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatLiters(liters: number): string {
  return `${litersFormatter.format(liters)} L`;
}

/** "30,5 L/100 km", o "—" si no hay tramos para medir. */
export function formatConsumption(litersPer100Km: number | null | undefined): string {
  return litersPer100Km == null ? '—' : `${consumptionFormatter.format(litersPer100Km)} L/100 km`;
}

export function formatCostPerKm(costPerKm: number | null | undefined): string {
  return costPerKm == null ? '—' : `${costPerKmFormatter.format(costPerKm)}/km`;
}

/** "jun 2026" de "2026-06". */
export function formatMonth(month: string, style: 'short' | 'long' = 'short'): string {
  const [year, m] = month.split('-').map(Number);
  const date = new Date(year, m - 1, 1);
  const label = date.toLocaleDateString('es-AR', { month: style, year: style === 'long' ? 'numeric' : undefined });
  return label.replace('.', '');
}

/** "2026-11-10T14:35" (hora local), el formato del selector de fecha y hora. */
export function toLocalDateTimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Cuánto más que su promedio, en %: 45 contra 30 da 50. */
export function percentAbove(value: number, average: number): number {
  return Math.round(((value - average) / average) * 100);
}
