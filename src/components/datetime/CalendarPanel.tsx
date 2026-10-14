import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { parseLocalDateInput, toLocalDateKey } from '../../utils/localDate';
import { ChevronRightIcon } from '../icons';

const WEEKDAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

const monthTitleFormatter = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' });
const dayLabelFormatter = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** Mismo día `months` meses después; si ese mes es más corto, el último día del mes. */
function addMonths(date: Date, months: number): Date {
  const lastDay = new Date(date.getFullYear(), date.getMonth() + months + 1, 0).getDate();
  return new Date(date.getFullYear(), date.getMonth() + months, Math.min(date.getDate(), lastDay));
}

/** Seis semanas, de lunes a domingo, que cubren el mes completo (igual que la vista mensual del calendario). */
function buildMonthGrid(date: Date): Date[] {
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
  const gridStart = addDays(monthStart, -((monthStart.getDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

interface CalendarPanelProps {
  /** Día elegido, "2026-10-16", o "" si no hay. */
  value: string;
  min?: string;
  max?: string;
  onSelect: (value: string) => void;
}

/**
 * Grilla de un mes para elegir un día (CAM-65), con el lenguaje visual del calendario de
 * mantenimientos. Se maneja también con teclado: flechas, Inicio/Fin (semana), RePág/AvPág (mes) y
 * Enter. Los días fuera de `min`/`max` se ven pero no se pueden elegir.
 */
export function CalendarPanel({ value, min, max, onSelect }: CalendarPanelProps) {
  const todayKey = toLocalDateKey(new Date());
  const outOfRange = (key: string) => Boolean((min && key < min) || (max && key > max));

  // El mes que se ve sale del día con foco: moverse de mes mueve el foco.
  const [focusKey, setFocusKey] = useState(() => {
    if (value) return value;
    if (min && todayKey < min) return min;
    if (max && todayKey > max) return max;
    return todayKey;
  });
  const focusDate = parseLocalDateInput(focusKey) ?? new Date();
  const gridRef = useRef<HTMLDivElement>(null);
  const moveFocusToDay = useRef(false);

  useEffect(() => {
    if (!moveFocusToDay.current) return;
    moveFocusToDay.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-key="${focusKey}"]`)?.focus();
  }, [focusKey]);

  function goTo(date: Date, fromKeyboard: boolean) {
    moveFocusToDay.current = fromKeyboard;
    setFocusKey(toLocalDateKey(date));
  }

  // Saltar de mes o de año cae dentro del rango: si el día queda afuera, se ajusta al límite.
  function clampToRange(date: Date): Date {
    const key = toLocalDateKey(date);
    if (min && key < min) return parseLocalDateInput(min) ?? date;
    if (max && key > max) return parseLocalDateInput(max) ?? date;
    return date;
  }

  const monthKey = focusKey.slice(0, 7);
  const atMinMonth = Boolean(min && monthKey <= min.slice(0, 7));
  const atMaxMonth = Boolean(max && monthKey >= max.slice(0, 7));

  function jump(months: number, fromKeyboard: boolean) {
    if ((months < 0 && atMinMonth) || (months > 0 && atMaxMonth)) return;
    goTo(clampToRange(addMonths(focusDate, months)), fromKeyboard);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const weekday = (focusDate.getDay() + 6) % 7; // 0 = lunes
    if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault();
      // Shift salta un año, como en el selector nativo.
      jump((e.key === 'PageUp' ? -1 : 1) * (e.shiftKey ? 12 : 1), true);
      return;
    }
    const moves: Record<string, () => Date> = {
      ArrowLeft: () => addDays(focusDate, -1),
      ArrowRight: () => addDays(focusDate, 1),
      ArrowUp: () => addDays(focusDate, -7),
      ArrowDown: () => addDays(focusDate, 7),
      Home: () => addDays(focusDate, -weekday),
      End: () => addDays(focusDate, 6 - weekday),
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    goTo(move(), true);
  }

  const days = buildMonthGrid(focusDate);
  const todayDisabled = outOfRange(todayKey);

  // aria-disabled y no disabled: si el botón recién usado se deshabilitara, el foco caería al body y el
  // panel dejaría de responder al teclado.
  const navButton = (label: string, months: number, blocked: boolean, icon: 'single' | 'double', back: boolean) => (
    <button
      type="button"
      className="dt-calendar__nav"
      onClick={() => jump(months, false)}
      aria-disabled={blocked || undefined}
      aria-label={label}
      title={label}
    >
      <ChevronRightIcon width={16} height={16} style={back ? { transform: 'rotate(180deg)' } : undefined} />
      {icon === 'double' && (
        <ChevronRightIcon
          width={16}
          height={16}
          className="dt-calendar__nav-second"
          style={back ? { transform: 'rotate(180deg)' } : undefined}
        />
      )}
    </button>
  );

  return (
    <div className="dt-calendar">
      <div className="dt-calendar__header">
        <div className="dt-calendar__nav-group">
          {navButton('Año anterior', -12, atMinMonth, 'double', true)}
          {navButton('Mes anterior', -1, atMinMonth, 'single', true)}
        </div>
        <span className="dt-calendar__title" aria-live="polite">
          {monthTitleFormatter.format(focusDate)}
        </span>
        <div className="dt-calendar__nav-group">
          {navButton('Mes siguiente', 1, atMaxMonth, 'single', false)}
          {navButton('Año siguiente', 12, atMaxMonth, 'double', false)}
        </div>
      </div>

      <div className="dt-calendar__weekdays" aria-hidden="true">
        {WEEKDAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>

      <div ref={gridRef} className="dt-calendar__grid" role="group" aria-label="Días" onKeyDown={handleKeyDown}>
        {days.map((day) => {
          const key = toLocalDateKey(day);
          const disabled = outOfRange(key);
          const focused = key === focusKey;
          return (
            <button
              key={key}
              type="button"
              data-key={key}
              data-autofocus={focused || undefined}
              tabIndex={focused ? 0 : -1}
              className={[
                'dt-calendar__day',
                day.getMonth() !== focusDate.getMonth() ? 'dt-calendar__day--outside' : '',
                key === todayKey ? 'dt-calendar__day--today' : '',
                key === value ? 'dt-calendar__day--selected' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              // aria-disabled y no disabled: un día fuera de rango tiene que poder recibir el foco del teclado.
              aria-disabled={disabled || undefined}
              aria-pressed={key === value}
              aria-current={key === todayKey ? 'date' : undefined}
              aria-label={dayLabelFormatter.format(day)}
              onFocus={() => setFocusKey(key)}
              // Sin esto, el foco del mousedown en un día del mes vecino cambia el mes antes del click.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (!disabled) onSelect(key);
              }}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>

      <div className="dt-calendar__footer">
        <button type="button" className="dt-calendar__today" onClick={() => onSelect(todayKey)} disabled={todayDisabled}>
          Hoy
        </button>
      </div>
    </div>
  );
}
