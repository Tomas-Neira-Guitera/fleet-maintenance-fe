import { toLocalDateKey } from '../../utils/localDate';
import { DatePicker } from './DatePicker';
import { TimePicker } from './TimePicker';

const DEFAULT_TIME = '09:00';

interface DateTimePickerProps {
  /** Fecha y hora locales, "2026-10-16T09:00" (el formato de `<input type="datetime-local">`), o "". */
  value: string;
  onChange: (value: string) => void;
  /** Primer día que se puede elegir, "2026-10-16". */
  min?: string;
  disabled?: boolean;
  /** Id del botón del día, para el `<label htmlFor>` del campo. */
  id?: string;
  className?: string;
}

/**
 * Fecha y hora con los selectores propios (CAM-65), en reemplazo de `<input type="datetime-local">`.
 * Va dentro de un `role="group"` con el nombre del campo, así que los botones se llaman solo "Día" y "Hora".
 */
export function DateTimePicker({ value, onChange, min, disabled, id, className }: DateTimePickerProps) {
  const [date = '', time = ''] = value ? value.split('T') : [];

  return (
    <div className="dt-datetime">
      <DatePicker
        value={date}
        onChange={(next) => onChange(`${next}T${time || DEFAULT_TIME}`)}
        min={min}
        disabled={disabled}
        label="Día"
        id={id}
        className={className}
      />
      <TimePicker
        value={time}
        onChange={(next) => onChange(`${date || toLocalDateKey(new Date())}T${next}`)}
        disabled={disabled}
        label="Hora"
        className={className}
      />
    </div>
  );
}
