import type { KeyboardEvent } from 'react';
import type { VehicleTirePosition } from '../../types/domain';
import { tireLabel } from '../../utils/tireFormat';
import { vehicleTypeDef } from '../../utils/vehicleTypes';
import '../../styles/tires.css';

interface VehicleTopViewProps {
  vehicleType: string;
  positions: VehicleTirePosition[];
  selected: string | null;
  /** En una rotación, la cubierta que se está moviendo. */
  rotatingFrom?: string | null;
  onSelect: (position: string) => void;
}

const W = 360;
const BODY_W = 116;
const BODY_X = (W - BODY_W) / 2;
const TIRE_W = 22;
const TIRE_H = 46;
const GAP = 4;
const AXLE_GAP = 58;

/** Dónde va cada eje: en un vehículo con motor, el delantero arriba y los traseros al fondo; en un remolque, todos atrás. */
function axleYs(axles: number, trailer: boolean, height: number): number[] {
  const last = height - 70;
  if (trailer) return Array.from({ length: axles }, (_, i) => last - (axles - 1 - i) * AXLE_GAP);
  return [78, ...Array.from({ length: axles - 1 }, (_, i) => last - (axles - 2 - i) * AXLE_GAP)];
}

function tireX(p: VehicleTirePosition): number {
  const leftOuter = BODY_X - GAP - TIRE_W;
  const rightOuter = BODY_X + BODY_W + GAP;
  if (p.wheel === 'simple') return p.side === 'izq' ? leftOuter : rightOuter;
  if (p.side === 'izq') return p.wheel === 'exterior' ? leftOuter - TIRE_W - 3 : leftOuter;
  return p.wheel === 'exterior' ? rightOuter + TIRE_W + 3 : rightOuter;
}

function tireClass(p: VehicleTirePosition, selected: string | null, rotatingFrom?: string | null): string {
  const state = !p.tire ? 'empty' : p.tire.lastTread?.belowMinimum ? 'low' : 'ok';
  return [
    'top-view__tire',
    `top-view__tire--${state}`,
    p.position === selected ? 'top-view__tire--selected' : '',
    p.position === rotatingFrom ? 'top-view__tire--rotating' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

function ariaLabel(p: VehicleTirePosition): string {
  if (!p.tire) return `${p.label}: sin cubierta`;
  const tread = p.tire.lastTread?.belowMinimum ? ', dibujo por debajo del mínimo' : '';
  return `${p.label}: ${tireLabel(p.tire)}${tread}`;
}

/**
 * CAM-157: el vehículo visto de arriba, con el frente hacia arriba y cada cubierta en su lugar. Gris punteado: sin
 * cubierta; oscuro: montada; rojo: dibujo por debajo del mínimo. Tocar una cubierta la elige.
 */
export function VehicleTopView({ vehicleType, positions, selected, rotatingFrom, onSelect }: VehicleTopViewProps) {
  const def = vehicleTypeDef(vehicleType);
  if (!def) return null;
  const trailer = def.kind === 'semitrailer' || def.kind === 'full_trailer';
  const axles = def.axles.length;
  const height = Math.max(380, 160 + axles * AXLE_GAP + 60);
  const ys = axleYs(axles, trailer, height);
  const bodyTop = trailer ? 44 : 22;
  const bodyBottom = height - 34;
  const spare = positions.find((p) => p.axle === 0);

  function keyDown(e: KeyboardEvent<SVGGElement>, position: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(position);
    }
  }

  return (
    <svg
      className="top-view"
      viewBox={`0 0 ${W} ${height}`}
      role="group"
      aria-label={`${def.label} visto de arriba, con el frente hacia arriba`}
    >
      {/* Carrocería: cabina adelante en un vehículo con motor; lanza o perno rey en un remolque. */}
      {def.kind === 'full_trailer' && (
        <path d={`M ${W / 2} 6 L ${BODY_X + 30} ${bodyTop} L ${BODY_X + BODY_W - 30} ${bodyTop} Z`} className="top-view__drawbar" />
      )}
      <rect x={BODY_X} y={bodyTop} width={BODY_W} height={bodyBottom - bodyTop} rx={14} className="top-view__body" />
      {!trailer && (
        <rect
          x={BODY_X + 6}
          y={bodyTop + 6}
          width={BODY_W - 12}
          height={def.kind === 'tractor' ? 92 : 70}
          rx={10}
          className="top-view__cab"
        />
      )}
      {def.kind === 'semitrailer' && <circle cx={W / 2} cy={bodyTop + 30} r={8} className="top-view__kingpin" />}
      <text x={W / 2} y={trailer ? bodyTop - 12 : 14} textAnchor="middle" className="top-view__front">
        Frente
      </text>

      {ys.map((y, i) => (
        <g key={i}>
          <line x1={BODY_X - 60} x2={BODY_X + BODY_W + 60} y1={y} y2={y} className="top-view__axle" />
          <text x={W / 2} y={y - 7} textAnchor="middle" className="top-view__axle-label">
            Eje {i + 1}
          </text>
        </g>
      ))}

      {positions
        .filter((p) => p.axle > 0)
        .map((p) => (
          <g
            key={p.position}
            role="button"
            tabIndex={0}
            aria-label={ariaLabel(p)}
            aria-pressed={p.position === selected}
            className={tireClass(p, selected, rotatingFrom)}
            onClick={() => onSelect(p.position)}
            onKeyDown={(e) => keyDown(e, p.position)}
          >
            <title>{ariaLabel(p)}</title>
            <rect x={tireX(p)} y={ys[p.axle - 1] - TIRE_H / 2} width={TIRE_W} height={TIRE_H} rx={6} />
          </g>
        ))}

      {spare && (
        <g
          role="button"
          tabIndex={0}
          aria-label={ariaLabel(spare)}
          aria-pressed={spare.position === selected}
          className={tireClass(spare, selected, rotatingFrom)}
          onClick={() => onSelect(spare.position)}
          onKeyDown={(e) => keyDown(e, spare.position)}
        >
          <title>{ariaLabel(spare)}</title>
          <rect x={W / 2 - TIRE_H / 2} y={height - 26} width={TIRE_H} height={TIRE_W} rx={6} />
        </g>
      )}
      {spare && (
        <text x={W / 2 + TIRE_H / 2 + 8} y={height - 11} className="top-view__axle-label">
          Auxilio
        </text>
      )}
    </svg>
  );
}
