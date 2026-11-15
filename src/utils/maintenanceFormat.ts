import type { NextMaintenanceSummary } from '../types/domain';
import { parseLocalDateInput } from './localDate';

export const numberFormatter = new Intl.NumberFormat('es-AR');

export const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

/** Montos largos en poco espacio: "$ 31 M", "$ 416,5 mil" (centro de una dona, eje de un gráfico). */
export const compactCurrencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  notation: 'compact',
  maximumFractionDigits: 1,
});

export function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

/** Arma la segunda línea de la celda "Próximo mantenimiento" -- ej. "vence en 3 días · 23/08/2026". */
export function describeNextMaintenance(next: NextMaintenanceSummary, today: Date = new Date()): string {
  const parts: string[] = [];

  if (next.remainingKm != null) {
    parts.push(
      next.remainingKm >= 0
        ? `en ${numberFormatter.format(next.remainingKm)} km`
        : `vencida hace ${numberFormatter.format(Math.abs(next.remainingKm))} km`,
    );
  }
  // CAM-137: al lado de los km que faltan, cuándo se llega a ellos según lo que anda el vehículo.
  if (next.estimatedDueDate) {
    parts.push(`vence aprox. el ${formatApproxDate(next.estimatedDueDate, today)}`);
  }
  if (next.remainingDays != null) {
    parts.push(
      next.remainingDays >= 0
        ? `vence en ${next.remainingDays} día${next.remainingDays === 1 ? '' : 's'}`
        : `vencida hace ${Math.abs(next.remainingDays)} día${Math.abs(next.remainingDays) === 1 ? '' : 's'}`,
    );
  }

  const dueDate = next.dueDate ? formatDate(next.dueDate) : null;
  return [parts.join(' · '), dueDate].filter(Boolean).join(' · ');
}

/**
 * "2026-11-12" → "12/11" este año, y "12/03/2028" si es otro: la tabla "Estado de la flota" muestra
 * también planes que vencen dentro de mucho, y "20/03" se leería como el marzo que viene.
 */
function formatApproxDate(iso: string, today: Date): string {
  const [year, month, day] = iso.split('-');
  return Number(year) === today.getFullYear() ? `${day}/${month}` : `${day}/${month}/${year}`;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Días de `today` (su día local) a una fecha "2026-11-12"; null si no es una fecha. */
function daysUntil(isoDate: string, today: Date): number | null {
  const due = parseLocalDateInput(isoDate);
  if (!due) return null;
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  // Redondeado: un cambio de horario de verano movería la cuenta una hora.
  return Math.round((due.getTime() - start.getTime()) / MS_PER_DAY);
}

/**
 * En cuántos días vence el plan, para ubicarlo en una franja de "Próximos vencimientos": la más
 * cercana entre la fecha del plan y la estimada por km (CAM-137). Un plan que ya llegó a sus km
 * cuenta como hoy, como un vencido por fecha. Null si es solo por km y no se pudo estimar.
 */
export function daysUntilDue(next: NextMaintenanceSummary, today: Date = new Date()): number | null {
  const candidates: number[] = [];
  if (next.remainingDays != null) candidates.push(next.remainingDays);
  if (next.remainingKm != null && next.remainingKm <= 0) candidates.push(0);
  if (next.estimatedDueDate) {
    const days = daysUntil(next.estimatedDueDate, today);
    if (days != null) candidates.push(days);
  }
  return candidates.length === 0 ? null : Math.min(...candidates);
}
