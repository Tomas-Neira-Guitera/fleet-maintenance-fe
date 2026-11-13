import { DateTimePicker } from './datetime/DateTimePicker';
import type { FuelLoadFieldsValue } from '../utils/fuelForm';
import '../styles/dashboard.css';
import '../styles/fuel.css';

interface FuelLoadFieldsProps {
  value: FuelLoadFieldsValue;
  onChange: (value: FuelLoadFieldsValue) => void;
  /** Km actuales del vehículo, como ayuda. */
  currentKm?: number;
  idPrefix: string;
  /** Clase de los inputs: la del formulario del chofer o la de los modales del admin. */
  inputClassName: string;
  fieldClassName: string;
  /** El chofer carga en el momento: sin fecha, se manda la hora actual. */
  showDate?: boolean;
}

/** CAM-156: los campos de una carga de combustible, iguales para el chofer y para el admin. */
export function FuelLoadFields({
  value,
  onChange,
  currentKm,
  idPrefix,
  inputClassName,
  fieldClassName,
  showDate = true,
}: FuelLoadFieldsProps) {
  const set = (patch: Partial<FuelLoadFieldsValue>) => onChange({ ...value, ...patch });
  return (
    <>
      {showDate && (
        <div className={fieldClassName} role="group" aria-labelledby={`${idPrefix}-when`}>
          <label id={`${idPrefix}-when`} htmlFor={`${idPrefix}-when-day`}>
            Fecha y hora
          </label>
          <DateTimePicker
            id={`${idPrefix}-when-day`}
            value={value.loadedAt}
            onChange={(loadedAt) => set({ loadedAt })}
            className={inputClassName}
          />
        </div>
      )}
      <label className={fieldClassName}>
        Kilómetros del odómetro
        <input
          type="number"
          inputMode="numeric"
          min={0}
          className={inputClassName}
          value={value.odometerKm}
          onChange={(e) => set({ odometerKm: e.target.value })}
          placeholder={currentKm != null ? `Último registrado: ${currentKm}` : 'Ej: 152300'}
        />
      </label>
      <label className={fieldClassName}>
        Litros
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          className={inputClassName}
          value={value.liters}
          onChange={(e) => set({ liters: e.target.value })}
          placeholder="Ej: 120,5"
        />
      </label>
      <label className={fieldClassName}>
        Monto ($)
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          className={inputClassName}
          value={value.amount}
          onChange={(e) => set({ amount: e.target.value })}
          placeholder="Ej: 145000"
        />
      </label>
      <label className="checklist-toggle">
        <input type="checkbox" checked={value.fullTank} onChange={(e) => set({ fullTank: e.target.checked })} />
        <span>
          Tanque lleno
          <small>
            {value.fullTank
              ? 'El consumo se mide entre dos cargas de tanque lleno.'
              : 'Carga parcial: se suma al consumo hasta el próximo tanque lleno.'}
          </small>
        </span>
      </label>
    </>
  );
}
