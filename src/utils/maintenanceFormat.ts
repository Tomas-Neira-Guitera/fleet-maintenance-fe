import type { NextMaintenanceSummary } from '../types/domain';

export const numberFormatter = new Intl.NumberFormat('es-AR');

export function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

/** Arma la segunda línea de la celda "Próximo mantenimiento" -- ej. "vence en 3 días · 23/08/2026". */
export function describeNextMaintenance(next: NextMaintenanceSummary): string {
  const parts: string[] = [];

  if (next.remainingKm != null) {
    parts.push(
      next.remainingKm >= 0
        ? `en ${numberFormatter.format(next.remainingKm)} km`
        : `vencida hace ${numberFormatter.format(Math.abs(next.remainingKm))} km`,
    );
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
