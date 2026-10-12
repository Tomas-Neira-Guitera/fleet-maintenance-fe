// Formatos de fecha compartidos, siempre en la hora local del navegador.

/** "07/10 08:15" -- día, mes y hora, para algo reciente (desde cuándo está abierto un viaje). */
export function formatDayAndTime(iso: string): string {
  const date = new Date(iso);
  const day = date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
  const time = date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${day} ${time}`;
}

/** "07/10/2026". */
export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
