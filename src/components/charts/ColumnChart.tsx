import { useLayoutEffect, useRef, useState } from 'react';
import '../../styles/charts.css';

export interface ColumnSegment {
  label: string;
  value: number;
  color: string;
}

export interface ColumnDatum {
  key: string;
  /** Etiqueta corta del eje ("ene"). */
  label: string;
  /** Etiqueta completa, para el tooltip ("enero de 2026"). */
  fullLabel: string;
  /** Tramos de la columna, de abajo hacia arriba. Todas las columnas traen las mismas series, en el mismo orden. */
  segments: ColumnSegment[];
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

const totalOf = (d: ColumnDatum) => d.segments.reduce((total, segment) => total + segment.value, 0);

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

/**
 * Columnas apiladas a lo largo del tiempo (CAM-52: gasto por mes o por día; CAM-104: partido en
 * preventivo, correctivo y órdenes sueltas). Con una sola serie es una columna simple.
 */
export function ColumnChart({ data, formatValue, formatCompact, ariaLabel }: ColumnChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  // Tamaño real del tooltip, para que no se salga del gráfico (cambia con la cantidad de filas).
  const [tooltipSize, setTooltipSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const tooltip = tooltipRef.current;
    if (tooltip) setTooltipSize({ width: tooltip.offsetWidth, height: tooltip.offsetHeight });
  }, [hoveredIndex]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = () => setWidth(container.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const totals = data.map(totalOf);
  const plotWidth = Math.max(width - MARGIN.left - MARGIN.right, 0);
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const top = niceMax(Math.max(0, ...totals));
  const ticks = [0, top / 2, top];
  const band = data.length > 0 ? plotWidth / data.length : 0;
  const columnWidth = Math.max(Math.min(MAX_COLUMN_WIDTH, band * 0.6), 2);
  const maxIndex = totals.reduce((best, total, i) => (total > (totals[best] ?? 0) ? i : best), 0);
  // Con muchas columnas (días) no entran todas las etiquetas: se muestra una cada tantas.
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(Math.floor(plotWidth / 44), 1)));
  const yOf = (value: number) => MARGIN.top + plotHeight - (value / top) * plotHeight;
  const hovered = hoveredIndex != null ? data[hoveredIndex] : null;
  const stacked = (data[0]?.segments.length ?? 0) > 1;
  // Solo las series con algún valor en el período: con un filtro de origen, las otras no aparecen.
  const legend = stacked ? data[0].segments.filter((_, s) => data.some((d) => d.segments[s].value > 0)) : [];

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
            const total = totals[i];
            // El tramo de más arriba con valor lleva la punta redondeada; los de abajo, rectos.
            const topSegment = d.segments.reduce((last, segment, s) => (segment.value > 0 ? s : last), -1);
            let base = 0;
            return (
              <g key={d.key}>
                {/* Solo se atenúan los tramos, no la etiqueta del eje. */}
                <g className="column-chart__stack" opacity={hoveredIndex != null && hoveredIndex !== i ? 0.45 : 1}>
                  {d.segments.map((segment, s) => {
                    if (segment.value <= 0) return null;
                    const y = yOf(base + segment.value);
                    const height = (segment.value / top) * plotHeight;
                    base += segment.value;
                    return s === topSegment ? (
                      <path key={segment.label} d={columnPath(x, y, columnWidth, height)} fill={segment.color} />
                    ) : (
                      <rect key={segment.label} x={x} y={y} width={columnWidth} height={height} fill={segment.color} />
                    );
                  })}
                </g>
                {i === maxIndex && total > 0 && hoveredIndex == null && (
                  <text className="column-chart__value" x={x + columnWidth / 2} y={yOf(total) - 6} textAnchor="middle">
                    {formatCompact(total)}
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
      {legend.length > 0 && (
        <ul className="chart-legend column-chart__legend">
          {legend.map((segment) => (
            <li key={segment.label} className="chart-legend__item">
              <span className="chart-legend__swatch" style={{ background: segment.color }} />
              {segment.label}
            </li>
          ))}
        </ul>
      )}
      {hovered && hoveredIndex != null && (
        <div
          ref={tooltipRef}
          className="chart-tooltip"
          style={{
            // Centrado sobre la columna, sin pasarse de los bordes del gráfico.
            left: Math.min(
              Math.max(MARGIN.left + band * (hoveredIndex + 0.5), tooltipSize.width / 2),
              Math.max(width - tooltipSize.width / 2, tooltipSize.width / 2),
            ),
            // Se ancla por abajo (translate -100%): el tope mínimo es su propia altura.
            top: Math.max(yOf(totals[hoveredIndex]) - 8, tooltipSize.height),
          }}
        >
          <strong>{formatValue(totals[hoveredIndex])}</strong>
          <span>{hovered.fullLabel}</span>
          {stacked &&
            // De arriba hacia abajo, en el mismo orden en que se ven los tramos; sin los que dan 0.
            [...hovered.segments].reverse().filter((segment) => segment.value > 0).map((segment) => (
              <span key={segment.label} className="chart-tooltip__row">
                <span className="chart-legend__swatch" style={{ background: segment.color }} />
                {segment.label}
                <span className="chart-tooltip__amount">{formatValue(segment.value)}</span>
              </span>
            ))}
        </div>
      )}
    </div>
  );
}
