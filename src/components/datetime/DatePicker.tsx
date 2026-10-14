import { useCallback, useRef, useState } from 'react';
import { parseLocalDateInput } from '../../utils/localDate';
import { CalendarIcon } from '../icons';
import { CalendarPanel } from './CalendarPanel';
import { Popover } from './Popover';

const shortFormatter = new Intl.DateTimeFormat('es-AR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const longFormatter = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

interface DatePickerProps {
  /** Día local, "2026-10-16" (el mismo formato que usaba `<input type="date">`), o "". */
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  /** Nombre del campo para lectores de pantalla ("Desde", "Fecha en que se hizo"...). */
  label?: string;
  /** Para un `<label htmlFor>`: hacer click en el texto del campo abre el selector, como con el input. */
  id?: string;
  /** Clases del botón, para que tome el tamaño del resto de los campos del formulario. */
  className?: string;
}

/**
 * Selector de fecha propio (CAM-65), en reemplazo de `<input type="date">`: el desplegable nativo lo
 * dibuja el navegador y no toma la paleta. Muestra la fecha elegida en un botón y abre la grilla del mes.
 */
export function DatePicker({ value, onChange, min, max, disabled, label = 'Fecha', id, className }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const date = parseLocalDateInput(value);

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) anchorRef.current?.focus();
  }, []);

  return (
    <>
      <button
        ref={anchorRef}
        id={id}
        type="button"
        className={['dt-field', className ?? ''].filter(Boolean).join(' ')}
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}: ${date ? longFormatter.format(date) : 'sin elegir'}`}
      >
        <CalendarIcon width={16} height={16} aria-hidden="true" className="dt-field__icon" />
        <span className={date ? 'dt-field__text' : 'dt-field__text dt-field__text--placeholder'}>
          {date ? shortFormatter.format(date) : 'Elegí una fecha'}
        </span>
      </button>
      {open && (
        <Popover anchorRef={anchorRef} label={label} onClose={close}>
          <CalendarPanel
            value={value}
            min={min}
            max={max}
            onSelect={(next) => {
              onChange(next);
              close(true);
            }}
          />
        </Popover>
      )}
    </>
  );
}
