import { useId, useState } from 'react';
import {
  customPeriod,
  lastDayOf,
  PERIOD_PRESETS,
  presetPeriod,
  toDateInputValue,
  type Period,
  type PeriodPreset,
} from '../../utils/period';
import { DatePicker } from '../datetime/DatePicker';
import '../../styles/dashboard.css';
import '../../styles/charts.css';

/** Valor del select para "sin filtro de fecha" (solo con `allLabel`). */
const ALL = '';

interface BaseProps {
  /** Texto delante del select (ej. "Creadas:"); sin él, el select se describe solo con aria-label. */
  label?: string;
}

/** Siempre hay un período elegido (Gastos, actividad de Usuarios). */
interface RequiredPeriodProps extends BaseProps {
  period: Period;
  onChange: (period: Period) => void;
  allLabel?: undefined;
}

/** Con `allLabel` hay una opción más, sin filtro: el período puede ser null (Órdenes de trabajo, CAM-92). */
interface OptionalPeriodProps extends BaseProps {
  period: Period | null;
  onChange: (period: Period | null) => void;
  allLabel: string;
}

type PeriodFilterProps = RequiredPeriodProps | OptionalPeriodProps;

/**
 * Selector de período de Gastos, de la actividad de Usuarios y de Órdenes de trabajo: atajos primero
 * y, con "Personalizado", dos fechas (las dos incluidas). Desde CAM-65 los selectores de fecha no dejan
 * armar un rango invertido: "Desde" no pasa de "Hasta" ni al revés.
 */
export function PeriodFilter(props: PeriodFilterProps) {
  const { period, label, allLabel } = props;
  const selectId = useId();
  // Sin período elegido ("todas las fechas"), "Personalizado" arranca con el mes en curso.
  const base = period ?? presetPeriod('month');
  const [fromValue, setFromValue] = useState(toDateInputValue(base.from));
  const [toValue, setToValue] = useState(toDateInputValue(lastDayOf(base)));

  function emit(next: Period | null) {
    if (props.allLabel !== undefined) {
      props.onChange(next);
    } else if (next) {
      props.onChange(next);
    }
  }

  function selectPreset(value: PeriodPreset | typeof ALL) {
    if (value === ALL) {
      emit(null);
      return;
    }
    if (value === 'custom') {
      // Arranca con las fechas del período que se estaba viendo, para ajustarlas desde ahí.
      setFromValue(toDateInputValue(base.from));
      setToValue(toDateInputValue(lastDayOf(base)));
      emit({ ...base, preset: 'custom' });
      return;
    }
    emit(presetPeriod(value));
  }

  function changeDates(nextFrom: string, nextTo: string) {
    setFromValue(nextFrom);
    setToValue(nextTo);
    const next = customPeriod(nextFrom, nextTo);
    if (next) emit(next);
  }

  return (
    <div className="period-filter">
      {label && (
        <label className="period-filter__label" htmlFor={selectId}>
          {label}
        </label>
      )}
      <select
        id={selectId}
        className="work-orders__filter"
        value={period?.preset ?? ALL}
        onChange={(e) => selectPreset(e.target.value as PeriodPreset | typeof ALL)}
        aria-label={label ? undefined : 'Período'}
      >
        {allLabel !== undefined && <option value={ALL}>{allLabel}</option>}
        {PERIOD_PRESETS.map((preset) => (
          <option key={preset.value} value={preset.value}>
            {preset.label}
          </option>
        ))}
      </select>
      {period?.preset === 'custom' && (
        <>
          <DatePicker
            className="work-orders__filter"
            value={fromValue}
            max={toValue || undefined}
            onChange={(next) => changeDates(next, toValue)}
            label="Desde"
          />
          <span className="period-filter__separator">al</span>
          <DatePicker
            className="work-orders__filter"
            value={toValue}
            min={fromValue || undefined}
            onChange={(next) => changeDates(fromValue, next)}
            label="Hasta"
          />
        </>
      )}
    </div>
  );
}
