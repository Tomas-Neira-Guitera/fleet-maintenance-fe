// Días y períodos en la hora local del navegador (calendario de mantenimientos CAM-88, filtro de
// fecha de las OTs CAM-92). El backend guarda y devuelve los instantes en UTC: agrupar por el texto
// de `scheduledAt`, o pedir el rango con fechas solas (que el backend toma como medianoche UTC),
// corre al día siguiente lo cargado desde las 21:00 en Argentina (UTC-3).

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * "2026-10-12": el día local de `date`. Sirve de clave para agrupar por día y es el formato de un
 * `<input type="date">`.
 */
export function toLocalDateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** El día local en que cae un instante del backend (por ejemplo, `scheduledAt`). */
export function localDateKeyOf(isoInstant: string): string {
  return toLocalDateKey(new Date(isoInstant));
}

/** Rango de días [from, to) para la API: los instantes de la medianoche local de cada fecha. */
export function localDayRange(from: Date, to: Date): { from: string; to: string } {
  return { from: startOfLocalDay(from).toISOString(), to: startOfLocalDay(to).toISOString() };
}

/** La medianoche local del valor de un `<input type="date">` ("2026-10-12"); null si no es una fecha. */
export function parseLocalDateInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

export type PeriodPreset = 'month' | 'quarter' | 'year';

/**
 * Período [from, to) de un atajo, en hora local: "este mes" y "este año" son el mes y el año
 * calendario completos; "últimos 3 meses" termina hoy, incluido. Mismo criterio que el filtro de
 * período de Gastos (CAM-52), para que los dos se unifiquen sin cambiar resultados.
 */
export function presetPeriod(preset: PeriodPreset, now = new Date()): { from: Date; to: Date } {
  const year = now.getFullYear();
  switch (preset) {
    case 'month':
      return { from: new Date(year, now.getMonth(), 1), to: new Date(year, now.getMonth() + 1, 1) };
    case 'quarter': {
      // El mismo día de hace 3 meses, topeado al último día de ese mes (el 31/05 no salta al 03/03),
      // y desde el día siguiente: así "hoy" entra y el período dura 3 meses justos.
      const lastDayThen = new Date(year, now.getMonth() - 2, 0).getDate();
      const sameDayThen = new Date(year, now.getMonth() - 3, Math.min(now.getDate(), lastDayThen));
      return {
        from: new Date(sameDayThen.getFullYear(), sameDayThen.getMonth(), sameDayThen.getDate() + 1),
        to: new Date(year, now.getMonth(), now.getDate() + 1),
      };
    }
    case 'year':
      return { from: new Date(year, 0, 1), to: new Date(year + 1, 0, 1) };
  }
}
