import type { MaintenanceRowStatus } from '../../types/domain';

interface VehicleStatusRingProps {
  score: number;
  status: MaintenanceRowStatus;
}

const COLOR: Record<MaintenanceRowStatus, string> = {
  al_dia: 'var(--fg-ok)',
  por_vencer: 'var(--fg-warn)',
  vencido: 'var(--fg-critical)',
};

const SIZE = 44;
const STROKE = 5;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Puntaje circular de salud (0-100) por vehículo -- pieza de marca del design system, versión compacta para filas de tabla. */
export function VehicleStatusRing({ score, status }: VehicleStatusRingProps) {
  const ratio = Math.max(0, Math.min(100, score)) / 100;
  const dashOffset = CIRCUMFERENCE * (1 - ratio);
  const color = COLOR[status];

  return (
    <div className="fleet-status-ring" role="img" aria-label={`Puntaje de salud: ${score} de 100`}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="rgba(62, 74, 66, 0.1)" strokeWidth={STROKE} />
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
      <span className="fleet-status-ring__value">{score}</span>
    </div>
  );
}
