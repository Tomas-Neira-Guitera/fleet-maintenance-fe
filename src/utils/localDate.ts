// Días del calendario de mantenimientos en la hora local del navegador (CAM-88). El backend guarda y
// devuelve los instantes en UTC: agrupar por el texto de `scheduledAt`, o pedir el rango con fechas
// solas (que el backend toma como medianoche UTC), corre al día siguiente lo programado desde las
// 21:00 en Argentina (UTC-3).

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** "2026-10-12": el día local de `date`. Sirve de clave para agrupar por día. */
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
