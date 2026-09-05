export interface RelativeReportTime {
  /** "hoy 07:40" (mismo día calendario que `now`) o "Hace 2 días" (si no). */
  label: string;
  isToday: boolean;
}

export function formatRelativeReportTime(createdAtIso: string, now: Date = new Date()): RelativeReportTime {
  const created = new Date(createdAtIso);

  const isToday =
    created.getFullYear() === now.getFullYear() &&
    created.getMonth() === now.getMonth() &&
    created.getDate() === now.getDate();

  if (isToday) {
    const hh = String(created.getHours()).padStart(2, '0');
    const mm = String(created.getMinutes()).padStart(2, '0');
    return { label: `hoy ${hh}:${mm}`, isToday: true };
  }

  const startOfCreated = new Date(created.getFullYear(), created.getMonth(), created.getDate());
  const startOfNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.max(1, Math.round((startOfNow.getTime() - startOfCreated.getTime()) / 86_400_000));

  return { label: `Hace ${diffDays} día${diffDays === 1 ? '' : 's'}`, isToday: false };
}
