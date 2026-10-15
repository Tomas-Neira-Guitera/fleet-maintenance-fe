import { useCallback, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ClockIcon } from '../icons';
import { Popover } from './Popover';

const SLOT_MINUTES = 15;
const DEFAULT_TIME = '09:00';
const PAGE = 4;

/** Cada 15 minutos del día; si la hora actual no cae en uno (ej. 09:07, cargada antes), se suma a la lista. */
function buildSlots(current: string): string[] {
  const pad = (n: number) => String(n).padStart(2, '0');
  const slots: string[] = [];
  for (let minutes = 0; minutes < 24 * 60; minutes += SLOT_MINUTES) {
    slots.push(`${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`);
  }
  if (current && !slots.includes(current)) slots.push(current);
  return slots.sort();
}

interface TimeListProps {
  value: string;
  onSelect: (value: string) => void;
}

function TimeList({ value, onSelect }: TimeListProps) {
  const options = useMemo(() => buildSlots(value), [value]);
  const [active, setActive] = useState(() => Math.max(0, options.indexOf(value || DEFAULT_TIME)));
  const listRef = useRef<HTMLUListElement>(null);
  const centered = useRef(false);
  const idPrefix = useId();

  // Al abrir, la hora elegida queda en el medio de la lista; después, solo se asegura que se vea la activa.
  useLayoutEffect(() => {
    const list = listRef.current;
    const option = list?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    if (!list || !option) return;
    if (!centered.current) {
      list.scrollTop = option.offsetTop - list.clientHeight / 2 + option.offsetHeight / 2;
      centered.current = true;
    } else if (option.offsetTop < list.scrollTop) {
      list.scrollTop = option.offsetTop;
    } else if (option.offsetTop + option.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = option.offsetTop + option.offsetHeight - list.clientHeight;
    }
  }, [active]);

  function handleKeyDown(e: KeyboardEvent<HTMLUListElement>) {
    const last = options.length - 1;
    const moves: Record<string, number> = {
      ArrowDown: Math.min(last, active + 1),
      ArrowUp: Math.max(0, active - 1),
      PageDown: Math.min(last, active + PAGE),
      PageUp: Math.max(0, active - PAGE),
      Home: 0,
      End: last,
    };
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(options[active]);
    } else if (e.key in moves) {
      e.preventDefault();
      setActive(moves[e.key]);
    }
  }

  return (
    <ul
      ref={listRef}
      className="dt-time-list"
      role="listbox"
      tabIndex={0}
      data-autofocus
      aria-label="Hora"
      aria-activedescendant={`${idPrefix}-${active}`}
      onKeyDown={handleKeyDown}
    >
      {options.map((option, index) => (
        <li
          key={option}
          id={`${idPrefix}-${index}`}
          role="option"
          data-index={index}
          aria-selected={option === value}
          className={[
            'dt-time-list__option',
            index === active ? 'dt-time-list__option--active' : '',
            option === value ? 'dt-time-list__option--selected' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          // El foco se queda en la lista, que es la que maneja el teclado.
          onMouseDown={(e) => e.preventDefault()}
          onMouseEnter={() => setActive(index)}
          onClick={() => onSelect(option)}
        >
          {option}
        </li>
      ))}
    </ul>
  );
}

interface TimePickerProps {
  /** "09:30", o "". */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}

/** Selector de hora propio (CAM-65): una lista de horarios cada 15 minutos, con la paleta de la app. */
export function TimePicker({ value, onChange, disabled, label = 'Hora', className }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) anchorRef.current?.focus();
  }, []);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className={['dt-field', 'dt-field--time', className ?? ''].filter(Boolean).join(' ')}
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}: ${value || 'sin elegir'}`}
      >
        <ClockIcon width={16} height={16} aria-hidden="true" className="dt-field__icon" />
        <span className={value ? 'dt-field__text' : 'dt-field__text dt-field__text--placeholder'}>{value || '--:--'}</span>
      </button>
      {open && (
        <Popover anchorRef={anchorRef} label={label} onClose={close}>
          <TimeList
            value={value}
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
