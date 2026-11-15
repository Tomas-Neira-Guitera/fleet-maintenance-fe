import { numberFormatter } from './maintenanceFormat';

const oneDecimal = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 1 });

/** Horas de CAM-134 en la unidad que se lee mejor: "5,5 h" hasta un día, "2,3 días" desde ahí. */
export function formatHours(hours: number): string {
  if (hours < 24) return `${oneDecimal.format(hours)} h`;
  const days = hours / 24;
  return `${oneDecimal.format(days)} ${days === 1 ? 'día' : 'días'}`;
}

/** "85,7 %", o "Sin datos" si el período todavía no empezó. */
export function formatAvailability(pct: number | null): string {
  return pct == null ? 'Sin datos' : `${oneDecimal.format(pct)} %`;
}

/** "3 paradas" / "1 parada". */
export function formatStops(stops: number): string {
  return `${numberFormatter.format(stops)} ${stops === 1 ? 'parada' : 'paradas'}`;
}
