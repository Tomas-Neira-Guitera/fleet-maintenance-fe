// Período de los listados con fecha (Gastos CAM-52, actividad de Usuarios CAM-91, Órdenes de trabajo
// CAM-92). Siempre en la hora local del navegador: a la API van los instantes de la medianoche local,
// no fechas solas, para que algo cargado a las 22:00 no caiga en el día (o el año) siguiente por el
// corrimiento a UTC. Las piezas de un solo día (clave YYYY-MM-DD, leer un <input type="date">) están
// en utils/localDate, que también usa el calendario de mantenimientos.

import { parseLocalDateInput, toLocalDateKey } from './localDate';

export type PeriodPreset = 'month' | 'quarter' | 'year' | 'last-year' | 'custom';

/** [from, to): `to` no se incluye. */
export interface Period {
  preset: PeriodPreset;
  from: Date;
  to: Date;
}

export const PERIOD_PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: 'month', label: 'Este mes' },
  { value: 'quarter', label: 'Últimos 3 meses' },
  { value: 'year', label: 'Este año' },
  { value: 'last-year', label: 'Año anterior' },
  { value: 'custom', label: 'Personalizado' },
];

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** El período de un preset. "Este año" es el año calendario en curso, completo. */
export function presetPeriod(preset: Exclude<PeriodPreset, 'custom'>, now = new Date()): Period {
  const year = now.getFullYear();
  const tomorrow = new Date(year, now.getMonth(), now.getDate() + 1);
  switch (preset) {
    case 'month':
      return { preset, from: new Date(year, now.getMonth(), 1), to: new Date(year, now.getMonth() + 1, 1) };
    case 'quarter': {
      // El mismo día de hace 3 meses, topeado al último día de ese mes, y desde el día siguiente:
      // sin el tope, el 31/05 daba desde el 04/03 (el 31/02 se desborda a marzo) y dejaba días afuera.
      const lastDayThen = new Date(year, now.getMonth() - 2, 0).getDate();
      const sameDayThen = new Date(year, now.getMonth() - 3, Math.min(now.getDate(), lastDayThen));
      const from = new Date(sameDayThen.getFullYear(), sameDayThen.getMonth(), sameDayThen.getDate() + 1);
      return { preset, from, to: tomorrow };
    }
    case 'last-year':
      return { preset, from: new Date(year - 1, 0, 1), to: new Date(year, 0, 1) };
    case 'year':
      return { preset, from: new Date(year, 0, 1), to: new Date(year + 1, 0, 1) };
  }
}

/** Valor de un <input type="date"> (YYYY-MM-DD) para una fecha local. */
export const toDateInputValue = toLocalDateKey;

/** Período personalizado desde dos fechas de input, las dos incluidas. null si falta una o están al revés. */
export function customPeriod(fromValue: string, toValue: string): Period | null {
  const from = parseLocalDateInput(fromValue);
  const lastDay = parseLocalDateInput(toValue);
  if (!from || !lastDay || lastDay < from) return null;
  return { preset: 'custom', from, to: new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate() + 1) };
}

/** Último día incluido en el período (el anterior a `to`). */
export function lastDayOf(period: Period): Date {
  return new Date(period.to.getFullYear(), period.to.getMonth(), period.to.getDate() - 1);
}

/** Si `instant` (un ISO del backend, ej. `createdAt`) cae dentro del período. */
export function isInPeriod(instant: string, period: Period): boolean {
  const date = new Date(instant);
  return date >= period.from && date < period.to;
}

export function periodParams(period: Period): { from: string; to: string } {
  return { from: period.from.toISOString(), to: period.to.toISOString() };
}

/** "01/01/2026 al 31/12/2026". */
export function describePeriod(period: Period): string {
  const format = (date: Date) => date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${format(startOfDay(period.from))} al ${format(lastDayOf(period))}`;
}
