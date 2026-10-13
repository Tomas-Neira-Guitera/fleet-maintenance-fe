import { useState } from 'react';
import {
  customPeriod,
  lastDayOf,
  PERIOD_PRESETS,
  presetPeriod,
  toDateInputValue,
  type Period,
  type PeriodPreset,
} from '../../utils/period';
import '../../styles/dashboard.css';

interface PeriodFilterProps {
  period: Period;
  onChange: (period: Period) => void;
}

/**
 * Selector de período de Gastos y de la actividad de Usuarios: atajos primero y, con
 * "Personalizado", dos fechas (las dos incluidas). Mientras el rango a mano no es válido
 * se conserva el período anterior.
 */
export function PeriodFilter({ period, onChange }: PeriodFilterProps) {
  const [fromValue, setFromValue] = useState(toDateInputValue(period.from));
  const [toValue, setToValue] = useState(toDateInputValue(lastDayOf(period)));
  const invalidRange = period.preset === 'custom' && !customPeriod(fromValue, toValue);

  function selectPreset(preset: PeriodPreset) {
    if (preset === 'custom') {
      // Arranca con las fechas del período que se estaba viendo, para ajustarlas desde ahí.
      setFromValue(toDateInputValue(period.from));
      setToValue(toDateInputValue(lastDayOf(period)));
      onChange({ ...period, preset: 'custom' });
      return;
    }
    onChange(presetPeriod(preset));
  }

  function changeDates(nextFrom: string, nextTo: string) {
    setFromValue(nextFrom);
    setToValue(nextTo);
    const next = customPeriod(nextFrom, nextTo);
    if (next) onChange(next);
  }

  return (
    <div className="period-filter">
      <select
        className="work-orders__filter"
        value={period.preset}
        onChange={(e) => selectPreset(e.target.value as PeriodPreset)}
        aria-label="Período"
      >
        {PERIOD_PRESETS.map((preset) => (
          <option key={preset.value} value={preset.value}>
            {preset.label}
          </option>
        ))}
      </select>
      {period.preset === 'custom' && (
        <>
          <input
            type="date"
            className={`work-orders__filter${invalidRange ? ' period-filter__date--invalid' : ''}`}
            value={fromValue}
            max={toValue || undefined}
            onChange={(e) => changeDates(e.target.value, toValue)}
            aria-label="Desde"
          />
          <span className="period-filter__separator">al</span>
          <input
            type="date"
            className={`work-orders__filter${invalidRange ? ' period-filter__date--invalid' : ''}`}
            value={toValue}
            min={fromValue || undefined}
            onChange={(e) => changeDates(fromValue, e.target.value)}
            aria-label="Hasta"
          />
        </>
      )}
    </div>
  );
}
