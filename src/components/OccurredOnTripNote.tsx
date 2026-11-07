import type { OccurredOnTrip } from '../types/domain';

interface OccurredOnTripNoteProps {
  occurredOnTrip: OccurredOnTrip;
  /** Chofer que reportó el defecto en el post-viaje. */
  reportedBy?: string | null;
}

/** CAM-146: marca de un defecto que apareció durante el viaje, con el chofer, el viaje y el pre-viaje en OK. */
export function OccurredOnTripNote({ occurredOnTrip, reportedBy }: OccurredOnTripNoteProps) {
  const { tripStartedAt, tripEndedAt, preTripAt } = occurredOnTrip;
  return (
    <span className="occurred-on-trip">
      <span className="occurred-on-trip__badge">Ocurrió en el viaje</span>
      <span className="occurred-on-trip__meta">
        {reportedBy ? `${reportedBy} · ` : ''}
        {tripStartedAt ? `Viaje ${formatTripRange(tripStartedAt, tripEndedAt)}` : 'Viaje'}
        {preTripAt ? ` · En el pre-viaje de las ${formatTime(preTripAt)} ese control dio OK` : ''}
      </span>
    </span>
  );
}

/** "02/11 08:00 → 17:00", o con las dos fechas si el viaje terminó otro día. */
function formatTripRange(startIso: string, endIso: string | null): string {
  const start = new Date(startIso);
  const startText = `${formatDay(start)} ${formatTime(startIso)}`;
  if (!endIso) return startText;
  const end = new Date(endIso);
  const sameDay = formatDay(start) === formatDay(end);
  return `${startText} → ${sameDay ? '' : `${formatDay(end)} `}${formatTime(endIso)}`;
}

function formatDay(date: Date): string {
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}
