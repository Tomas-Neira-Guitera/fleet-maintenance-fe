import { useState } from 'react';
import '../../styles/charts.css';

export interface DonutSegment {
  key: string;
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  /** Valor completo, para la leyenda. */
  formatValue: (value: number) => string;
  /** Valor corto, para el centro del anillo (no entra uno largo). */
  formatCompact: (value: number) => string;
  /** Segmento elegido como filtro, si hay. Se elige desde la leyenda o tocando el anillo. */
  selectedKey?: string | null;
  onSelect?: (key: string | null) => void;
}

const SIZE = 168;
const STROKE = 22;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
// Separación entre segmentos: se ve el fondo de la tarjeta, no un borde dibujado.
const GAP = 2;

function percent(value: number, total: number): string {
  if (total <= 0) return '0%';
  const share = (value / total) * 100;
  return `${share > 0 && share < 1 ? '<1' : Math.round(share)}%`;
}

/**
 * Dona interactiva (CAM-52): reparto de un total en pocas partes. Al pasar por un segmento o por
 * su fila de la leyenda, el centro muestra esa parte; al elegirlo, queda como filtro. Todos los
 * valores están también en la leyenda, así que no dependen del hover ni del color.
 */
export function DonutChart({ segments, formatValue, formatCompact, selectedKey, onSelect }: DonutChartProps) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const drawn = segments.filter((segment) => segment.value > 0);
  const focusKey = hoveredKey ?? selectedKey ?? null;
  const focused = segments.find((segment) => segment.key === focusKey) ?? null;

  const arcs = drawn.map((segment, i) => {
    const before = drawn.slice(0, i).reduce((sum, previous) => sum + previous.value, 0);
    const length = (segment.value / total) * CIRCUMFERENCE;
    return {
      segment,
      start: (before / total) * CIRCUMFERENCE,
      dash: Math.max(length - (drawn.length > 1 ? GAP : 0), 0.5),
    };
  });

  function toggle(key: string) {
    onSelect?.(selectedKey === key ? null : key);
  }

  return (
    <div className="donut-chart">
      <div className="donut-chart__ring">
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
          <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="var(--fg-chart-track)" strokeWidth={STROKE} />
          {arcs.map(({ segment, start, dash }) => (
            <circle
              key={segment.key}
              className={`donut-chart__arc${onSelect ? ' donut-chart__arc--clickable' : ''}`}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={segment.color}
              strokeWidth={STROKE}
              strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
              strokeDashoffset={-start}
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
              opacity={focusKey && focusKey !== segment.key ? 0.28 : 1}
              onMouseEnter={() => setHoveredKey(segment.key)}
              onMouseLeave={() => setHoveredKey(null)}
              onClick={() => toggle(segment.key)}
            />
          ))}
        </svg>
        <div className="donut-chart__center">
          <span className="donut-chart__value">{formatCompact(focused ? focused.value : total)}</span>
          <span className="donut-chart__caption">
            {focused ? `${focused.label} · ${percent(focused.value, total)}` : 'Total'}
          </span>
        </div>
      </div>

      <ul className="donut-chart__legend">
        {segments.map((segment) => {
          const content = (
            <>
              <span className="donut-chart__swatch" style={{ background: segment.color }} />
              <span className="donut-chart__label">{segment.label}</span>
              <span className="donut-chart__amount">{formatValue(segment.value)}</span>
              <span className="donut-chart__share">{percent(segment.value, total)}</span>
            </>
          );
          return (
            <li key={segment.key}>
              {onSelect ? (
                <button
                  type="button"
                  className={`donut-chart__row donut-chart__row--button${selectedKey === segment.key ? ' donut-chart__row--selected' : ''}`}
                  aria-pressed={selectedKey === segment.key}
                  onClick={() => toggle(segment.key)}
                  onMouseEnter={() => setHoveredKey(segment.key)}
                  onMouseLeave={() => setHoveredKey(null)}
                  onFocus={() => setHoveredKey(segment.key)}
                  onBlur={() => setHoveredKey(null)}
                >
                  {content}
                </button>
              ) : (
                <div className="donut-chart__row">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
