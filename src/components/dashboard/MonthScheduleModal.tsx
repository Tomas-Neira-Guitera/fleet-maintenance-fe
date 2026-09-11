import { useEffect, useMemo, useState } from 'react';
import { getSchedule } from '../../services/scheduleService';
import type { ScheduledMaintenance } from '../../types/domain';
import { ChevronRightIcon, CloseIcon } from '../icons';
import '../../styles/dashboard.css';

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const monthTitleFormatter = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' });
const dayNumberFormatter = new Intl.DateTimeFormat('es-AR', { day: 'numeric' });

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Grilla de 6 semanas (lunes a domingo) que cubre el mes completo, con días de meses vecinos. */
function buildMonthGrid(monthStart: Date): Date[] {
  const firstWeekday = (monthStart.getDay() + 6) % 7; // 0 = lunes
  const gridStart = addDays(monthStart, -firstWeekday);
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

interface MonthScheduleModalProps {
  initialMonth: Date;
  onClose: () => void;
  onSelectDay: (day: Date) => void;
}

/**
 * Vista de mes completo del calendario de mantenimientos (CAM-42), abierta desde el
 * botón a la izquierda de las flechas de navegación semanal. Clickear un día salta la
 * vista semanal a la semana que lo contiene.
 */
export function MonthScheduleModal({ initialMonth, onClose, onSelectDay }: MonthScheduleModalProps) {
  const [monthStart, setMonthStart] = useState(() => startOfMonth(initialMonth));
  const [items, setItems] = useState<ScheduledMaintenance[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const days = useMemo(() => buildMonthGrid(monthStart), [monthStart]);

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setError(null);
    const from = days[0];
    const to = addDays(days[days.length - 1], 1);
    getSchedule({ from: toIsoDate(from), to: toIsoDate(to) })
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo cargar el calendario de mantenimientos.');
      });
    return () => {
      cancelled = true;
    };
  }, [days]);

  const itemsByDay = useMemo(() => {
    const map = new Map<string, ScheduledMaintenance[]>();
    for (const item of items ?? []) {
      const key = item.scheduledAt.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)?.push(item);
    }
    for (const list of map.values()) list.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    return map;
  }, [items]);

  const todayKey = toIsoDate(new Date());

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal modal--wide">
        <header className="modal__header">
          <h2 className="modal__title">Calendario de mantenimientos</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Cerrar">
            <CloseIcon width={18} height={18} />
          </button>
        </header>

        <div className="modal__body">
          <div className="month-schedule__nav">
            <button
              type="button"
              className="weekly-schedule__nav-btn"
              onClick={() => setMonthStart((m) => addMonths(m, -1))}
              aria-label="Mes anterior"
            >
              <ChevronRightIcon width={16} height={16} style={{ transform: 'rotate(180deg)' }} />
            </button>
            <span className="month-schedule__title">{monthTitleFormatter.format(monthStart)}</span>
            <button
              type="button"
              className="weekly-schedule__nav-btn"
              onClick={() => setMonthStart((m) => addMonths(m, 1))}
              aria-label="Mes siguiente"
            >
              <ChevronRightIcon width={16} height={16} />
            </button>
          </div>

          {error && <p className="error-banner">{error}</p>}

          <div className="month-schedule__weekday-row">
            {DAY_LABELS.map((label) => (
              <span key={label} className="month-schedule__weekday">
                {label}
              </span>
            ))}
          </div>

          <div className="month-schedule__grid">
            {days.map((day) => {
              const key = toIsoDate(day);
              const dayItems = itemsByDay.get(key) ?? [];
              const outsideMonth = day.getMonth() !== monthStart.getMonth();
              return (
                <button
                  type="button"
                  key={key}
                  className={[
                    'month-schedule__day',
                    outsideMonth ? 'month-schedule__day--outside' : '',
                    key === todayKey ? 'month-schedule__day--today' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => onSelectDay(day)}
                >
                  <span className="month-schedule__day-number">{dayNumberFormatter.format(day)}</span>
                  {dayItems.length > 0 && (
                    <span className="month-schedule__day-items">
                      {dayItems.slice(0, 2).map((item) => (
                        <span key={item.id} className="month-schedule__day-item">
                          {item.title}
                        </span>
                      ))}
                      {dayItems.length > 2 && (
                        <span className="month-schedule__day-more">+{dayItems.length - 2} más</span>
                      )}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
