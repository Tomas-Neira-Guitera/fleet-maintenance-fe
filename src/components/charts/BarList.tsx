import '../../styles/charts.css';

export interface BarSegment {
  label: string;
  value: number;
  color: string;
}

export interface BarListItem {
  key: string;
  label: string;
  /** La etiqueta es un dato técnico (patente): va en la tipografía monoespaciada. */
  mono?: boolean;
  sublabel?: string;
  /** Una barra simple tiene un solo segmento; con más, se apilan. */
  segments: BarSegment[];
  /** Lo que se lee al final de la fila: el valor, ya formateado. */
  valueLabel: string;
  /** Atenuada (p. ej. un usuario desactivado). */
  muted?: boolean;
}

interface BarListProps {
  items: BarListItem[];
  /** Fila elegida como filtro, si hay. */
  selectedKey?: string | null;
  onSelect?: (key: string | null) => void;
  /** Leyenda de los segmentos; hace falta cuando las barras son apiladas. */
  legend?: { label: string; color: string }[];
  emptyLabel?: string;
}

/**
 * Barras horizontales para comparar una misma medida entre vehículos o usuarios (CAM-52, CAM-91).
 * Todas comparten escala: la más larga es el máximo. El valor va escrito al final de cada fila.
 */
export function BarList({ items, selectedKey, onSelect, legend, emptyLabel = 'Sin datos en el período.' }: BarListProps) {
  const max = Math.max(0, ...items.map((item) => item.segments.reduce((sum, segment) => sum + segment.value, 0)));

  if (items.length === 0) return <p className="muted bar-list__empty">{emptyLabel}</p>;

  return (
    <div className="bar-list-wrap">
      {legend && (
        <ul className="chart-legend">
          {legend.map((entry) => (
            <li key={entry.label} className="chart-legend__item">
              <span className="chart-legend__swatch" style={{ background: entry.color }} />
              {entry.label}
            </li>
          ))}
        </ul>
      )}
      <ul className="bar-list">
        {items.map((item) => {
          const total = item.segments.reduce((sum, segment) => sum + segment.value, 0);
          const dimmed = selectedKey != null && selectedKey !== item.key;
          const content = (
            <>
              <span className="bar-list__label">
                <span className={item.mono ? 'bar-list__name bar-list__name--mono' : 'bar-list__name'}>{item.label}</span>
                {item.sublabel && <span className="bar-list__sublabel">{item.sublabel}</span>}
              </span>
              <span className="bar-list__track">
                <span className="bar-list__bar" style={{ width: max > 0 ? `${(total / max) * 100}%` : 0 }}>
                  {item.segments
                    .filter((segment) => segment.value > 0)
                    .map((segment) => (
                      <span
                        key={segment.label}
                        className="bar-list__segment"
                        style={{ flexGrow: segment.value, background: segment.color }}
                        title={`${segment.label}: ${segment.value}`}
                      />
                    ))}
                </span>
              </span>
              <span className="bar-list__value">{item.valueLabel}</span>
            </>
          );
          const className = `bar-list__row${item.muted ? ' bar-list__row--muted' : ''}${dimmed ? ' bar-list__row--dimmed' : ''}`;
          return (
            <li key={item.key} className="bar-list__item">
              {onSelect ? (
                <button
                  type="button"
                  className={`${className} bar-list__row--button${selectedKey === item.key ? ' bar-list__row--selected' : ''}`}
                  aria-pressed={selectedKey === item.key}
                  onClick={() => onSelect(selectedKey === item.key ? null : item.key)}
                >
                  {content}
                </button>
              ) : (
                <div className={className}>{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
