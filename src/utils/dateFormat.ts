// Formatos de fecha compartidos, siempre en la hora local del navegador.

/** "07/10 08:15" -- día, mes y hora, para algo reciente (desde cuándo está abierto un viaje). */
export function formatDayAndTime(iso: string): string {
  const date = new Date(iso);
  const day = date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
  const time = date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${day} ${time}`;
}

/**
 * "2026-10-07": el día argentino de un instante. Es el día de un gasto operativo (CAM-109), que llega
 * como la medianoche argentina: en un navegador con otro huso, leerlo en hora local lo correría un día.
 */
export function argentinaDateKey(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
}

/** "07/10/2026". */
export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
