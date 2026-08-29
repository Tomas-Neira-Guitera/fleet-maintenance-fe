// The signature "health ring" — used here to summarize checklist outcomes before
// submit. Ring color reflects the worst outcome present (verde/ámbar/rojo).
export type RingStatus = 'ok' | 'warn' | 'critical';

interface HealthRingProps {
  okCount: number;
  total: number;
  status: RingStatus;
  label?: string;
}

const STATUS_COLOR: Record<RingStatus, string> = {
  ok: 'var(--fg-ok)',
  warn: 'var(--fg-warn)',
  critical: 'var(--fg-critical)',
};

const SIZE = 148;
const STROKE = 12;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function HealthRing({ okCount, total, status, label }: HealthRingProps) {
  const ratio = total > 0 ? okCount / total : 1;
  const dashOffset = CIRCUMFERENCE * (1 - ratio);
  const color = STATUS_COLOR[status];

  return (
    <div className="health-ring" role="img" aria-label={`${okCount} de ${total} controles en estado correcto`}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="rgba(62, 74, 66, 0.1)"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </svg>
      <div className="health-ring__center">
        <span className="health-ring__value">
          {okCount}/{total}
        </span>
        <span className="health-ring__caption">{label ?? 'OK'}</span>
      </div>
    </div>
  );
}
