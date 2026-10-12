import { useLayoutEffect, useRef, useState } from 'react';
import '../../styles/charts.css';

export interface ColumnDatum {
  key: string;
  /** Etiqueta corta del eje ("ene"). */
  label: string;
  /** Etiqueta completa, para el tooltip ("enero de 2026"). */
  fullLabel: string;
  value: number;
}

interface ColumnChartProps {
  data: ColumnDatum[];
  formatValue: (value: number) => string;
  /** Valor corto para las marcas del eje y la etiqueta del máximo. */
  formatCompact: (value: number) => string;
  /** Resumen del gráfico para lectores de pantalla; los valores están en el listado de la página. */
  ariaLabel: string;
}

const HEIGHT = 220;
const MARGIN = { top: 22, right: 8, bottom: 24, left: 56 };
const MAX_COLUMN_WIDTH = 24;

/** Redondea el máximo del eje a un número "limpio" (1, 2, 2,5, 5 × 10ⁿ). */
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((candidate) => candidate * magnitude >= value) ?? 10;
  return step * magnitude;
}

/** Columna con la punta redondeada y la base recta, apoyada en el eje. */
function columnPath(x: number, y: number, width: number, height: number): string {
  const radius = Math.min(4, width / 2, height);
  return `M${x},${y + height} V${y + radius} Q${x},${y} ${x + radius},${y} H${x + width - radius} Q${x + width},${y} ${x + width},${y + radius} V${y + height} Z`;
}

/** Columnas de una sola serie a lo largo del tiempo (CAM-52: gasto por mes o por día). */
export function ColumnChart({ data, formatValue, formatCompact, ariaLabel }: ColumnChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = () => setWidth(container.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const plotWidth = Math.max(width - MARGIN.left - MARGIN.right, 0);
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const top = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const ticks = [0, top / 2, top];
  const band = data.length > 0 ? plotWidth / data.length : 0;
  const columnWidth = Math.max(Math.min(MAX_COLUMN_WIDTH, band * 0.6), 2);
  const maxIndex = data.reduce((best, d, i) => (d.value > (data[best]?.value ?? 0) ? i : best), 0);
  // Con muchas columnas (días) no entran todas las etiquetas: se muestra una cada tantas.
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(Math.floor(plotWidth / 44), 1)));
  const yOf = (value: number) => MARGIN.top + plotHeight - (value / top) * plotHeight;
  const hovered = hoveredIndex != null ? data[hoveredIndex] : null;

  return (
    <div className="column-chart" ref={containerRef}>
      {width > 0 && (
        <svg width={width} height={HEIGHT} role="img" aria-label={ariaLabel}>
          {ticks.map((tick) => (
            <g key={tick}>
              <line className="column-chart__grid" x1={MARGIN.left} x2={width - MARGIN.right} y1={yOf(tick)} y2={yOf(tick)} />
              <text className="column-chart__tick" x={MARGIN.left - 8} y={yOf(tick)} textAnchor="end" dominantBaseline="middle">
                {formatCompact(tick)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const x = MARGIN.left + band * i + (band - columnWidth) / 2;
            const height = (d.value / top) * plotHeight;
            return (
              <g key={d.key}>
                {d.value > 0 && (
                  <path
                    className="column-chart__column"
                    d={columnPath(x, yOf(d.value), columnWidth, height)}
                    opacity={hoveredIndex != null && hoveredIndex !== i ? 0.45 : 1}
                  />
                )}
                {i === maxIndex && d.value > 0 && hoveredIndex == null && (
                  <text className="column-chart__value" x={x + columnWidth / 2} y={yOf(d.value) - 6} textAnchor="middle">
                    {formatCompact(d.value)}
                  </text>
                )}
                {i % labelEvery === 0 && (
                  <text className="column-chart__label" x={MARGIN.left + band * (i + 0.5)} y={HEIGHT - 6} textAnchor="middle">
                    {d.label}
                  </text>
                )}
                {/* Zona de hover de toda la franja: no hay que acertarle a una columna finita. */}
                <rect
                  x={MARGIN.left + band * i}
                  y={MARGIN.top}
                  width={band}
                  height={plotHeight}
                  fill="transparent"
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
              </g>
            );
          })}
        </svg>
      )}
      {hovered && hoveredIndex != null && (
        <div
          className="chart-tooltip"
          style={{
            left: Math.min(Math.max(MARGIN.left + band * (hoveredIndex + 0.5), 70), Math.max(width - 70, 70)),
            top: Math.max(yOf(hovered.value) - 8, 44),
          }}
        >
          <strong>{formatValue(hovered.value)}</strong>
          <span>{hovered.fullLabel}</span>
        </div>
      )}
    </div>
  );
}
