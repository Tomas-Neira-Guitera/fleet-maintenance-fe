import { useState } from 'react';
import type { TireConditionCode, TirePositions } from '../types/domain';
import { TIRE_CONDITIONS, tireConditionLabel, toTireConditions, type TireConditionValue } from '../utils/tireFormat';
import { VehicleTopView } from './dashboard/VehicleTopView';
import '../styles/tires.css';

interface TireConditionPickerProps {
  tires: TirePositions;
  value: TireConditionValue;
  onChange: (next: TireConditionValue) => void;
  invalid: boolean;
}

/**
 * CAM-157: con "Neumáticos" en defecto, el chofer toca en el dibujo la cubierta con problemas y marca lo que ve.
 * Puede marcar varias cubiertas y varios estados en cada una.
 */
export function TireConditionPicker({ tires, value, onChange, invalid }: TireConditionPickerProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const byPosition = new Map(tires.positions.map((p) => [p.position, p]));
  const current = selected ? byPosition.get(selected) : undefined;
  const marked = toTireConditions(value);

  function toggle(position: string, code: TireConditionCode) {
    const now = value[position] ?? [];
    const next = now.includes(code) ? now.filter((c) => c !== code) : [...now, code];
    // Del más grave al más leve, como los muestra el resto de la app.
    const ordered = TIRE_CONDITIONS.map((c) => c.code).filter((c) => next.includes(c));
    onChange({ ...value, [position]: ordered });
  }

  function clear(position: string) {
    const next = { ...value };
    delete next[position];
    onChange(next);
    if (selected === position) setSelected(null);
  }

  return (
    <div className={`tire-picker${invalid ? ' tire-picker--invalid' : ''}`}>
      <p className="tire-picker__title">¿Qué cubierta tiene el problema?</p>
      <p className="tire-picker__hint">Tocala en el dibujo y marcá lo que ves. Podés marcar más de una.</p>
      {tires.vehicleType && (
        <VehicleTopView
          compact
          vehicleType={tires.vehicleType}
          positions={tires.positions}
          stateOf={(position) =>
            !byPosition.get(position)?.mounted ? 'empty' : (value[position]?.length ?? 0) > 0 ? 'warn' : 'ok'
          }
          describe={(position) => {
            if (!byPosition.get(position)?.mounted) return 'sin cubierta';
            const conditions = value[position] ?? [];
            return conditions.length > 0 ? conditions.map(tireConditionLabel).join(', ').toLowerCase() : 'sin marcar';
          }}
          isDisabled={(position) => !byPosition.get(position)?.mounted}
          selected={selected}
          onSelect={setSelected}
        />
      )}

      {current && (
        <fieldset className="tire-picker__conditions">
          <legend>{current.label}</legend>
          <div className="tire-picker__chips">
            {TIRE_CONDITIONS.map((c) => {
              const on = (value[current.position] ?? []).includes(c.code);
              return (
                <button
                  key={c.code}
                  type="button"
                  aria-pressed={on}
                  className={`tire-chip${on ? ' tire-chip--on' : ''}`}
                  onClick={() => toggle(current.position, c.code)}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {marked.length > 0 && (
        <ul className="tire-picker__marked">
          {marked.map((m) => (
            <li key={m.position}>
              <button type="button" className="tire-picker__marked-name" onClick={() => setSelected(m.position)}>
                {byPosition.get(m.position)?.label ?? m.position}
              </button>
              <span>{m.conditions.map(tireConditionLabel).join(', ')}</span>
              <button
                type="button"
                className="tire-picker__remove"
                onClick={() => clear(m.position)}
                aria-label={`Quitar ${byPosition.get(m.position)?.label ?? m.position}`}
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}
      {invalid && <p className="field-error">Marcá al menos una cubierta y qué le ves.</p>}
    </div>
  );
}
