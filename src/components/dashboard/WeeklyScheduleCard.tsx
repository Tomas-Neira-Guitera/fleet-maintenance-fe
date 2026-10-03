import { useEffect, useMemo, useState } from 'react';
import { useVisibleRows } from '../../hooks/useVisibleRows';
import { getSchedule } from '../../services/scheduleService';
import type { ScheduledMaintenance } from '../../types/domain';
import { ChevronRightIcon, LayoutGridIcon } from '../icons';
import { MonthScheduleModal } from './MonthScheduleModal';
import { ScheduleDetailModal } from './ScheduleDetailModal';
import { SchedulePickerModal } from './SchedulePickerModal';
import '../../styles/dashboard.css';

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const VISIBLE_PER_DAY = 2;

const timeFormatter = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' });
const dayNumberFormatter = new Intl.DateTimeFormat('es-AR', { day: 'numeric' });
const monthFormatter = new Intl.DateTimeFormat('es-AR', { month: 'short' });

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // 0 = lunes
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
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

interface DayItemsProps {
  items: ScheduledMaintenance[];
  onSelect: (item: ScheduledMaintenance) => void;
}

/** Mantenimientos de un día: se ven 2 y el resto con scroll dentro del día. */
function DayItems({ items, onSelect }: DayItemsProps) {
  const { ref, maxHeight } = useVisibleRows<HTMLDivElement>(VISIBLE_PER_DAY, items.length);
  return (
    <div
      ref={ref}
      className="weekly-schedule__day-items scroll-list"
      style={maxHeight ? { maxHeight } : undefined}
    >
      {items.length === 0 && <span className="weekly-schedule__empty">—</span>}
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          data-scroll-item
          className={`weekly-schedule__item weekly-schedule__item--${item.sourceType}`}
          onClick={() => onSelect(item)}
          title="Ver detalle"
        >
          <span className="weekly-schedule__item-time">{timeFormatter.format(new Date(item.scheduledAt))}</span>
          <span className="weekly-schedule__item-title" title={item.title}>
            {item.title}
          </span>
          {item.plate && <span className="weekly-schedule__item-plate">{item.plate}</span>}
        </button>
      ))}
    </div>
  );
}

interface WeeklyScheduleCardProps {
  /** Cambiar este valor fuerza un refetch -- ej. después de planificar un
   * mantenimiento desde "Estado de la flota" o desde un defecto, orígenes
   * que no tocan `weekStart` y por eso no dispararían el fetch por sí solos. */
  refreshKey?: number;
}

/**
 * Calendario semanal del Resumen (CAM-42): lista los mantenimientos y arreglos
 * programados (CAM-50/CAM-51) agrupados por día. Consume GET /api/maintenance-schedule
 * -- ver CAM-42-programacion-mantenimientos.md. Un botón junto a las flechas abre la
 * vista de mes completo, y pasar el cursor sobre un día ofrece agendar una programación
 * suelta (origen manual) directo en ese día.
 */
export function WeeklyScheduleCard({ refreshKey }: WeeklyScheduleCardProps = {}) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [items, setItems] = useState<ScheduledMaintenance[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showMonth, setShowMonth] = useState(false);
  const [schedulingDay, setSchedulingDay] = useState<Date | null>(null);
  const [selected, setSelected] = useState<ScheduledMaintenance | null>(null);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setError(null);
    getSchedule({ from: toIsoDate(weekStart), to: toIsoDate(addDays(weekStart, 7)) })
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo cargar el calendario de mantenimientos.');
      });
    return () => {
      cancelled = true;
    };
  }, [weekStart, refreshKey]);

  const itemsByDay = useMemo(() => {
    const map = new Map<string, ScheduledMaintenance[]>();
    for (const day of days) map.set(toIsoDate(day), []);
    for (const item of items ?? []) {
      const key = item.scheduledAt.slice(0, 10);
      map.get(key)?.push(item);
    }
    for (const list of map.values()) list.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    return map;
  }, [items, days]);

  const todayKey = toIsoDate(new Date());
  const rangeLabel = `${dayNumberFormatter.format(weekStart)} ${monthFormatter.format(weekStart)} — ${dayNumberFormatter.format(
    addDays(weekStart, 6),
  )} ${monthFormatter.format(addDays(weekStart, 6))}`;

  function refreshWeek() {
    getSchedule({ from: toIsoDate(weekStart), to: toIsoDate(addDays(weekStart, 7)) })
      .then(setItems)
      .catch(() => setError('No se pudo cargar el calendario de mantenimientos.'));
  }

  return (
    <section className="weekly-schedule">
      <header className="weekly-schedule__header">
        <h2 className="weekly-schedule__title">Mantenimientos de la semana</h2>
        <div className="weekly-schedule__nav">
          <button
            type="button"
            className="weekly-schedule__nav-btn"
            onClick={() => setShowMonth(true)}
            aria-label="Ver mes completo"
            title="Ver mes completo"
          >
            <LayoutGridIcon width={16} height={16} />
          </button>
          <button
            type="button"
            className="weekly-schedule__nav-btn"
            onClick={() => setWeekStart((w) => addDays(w, -7))}
            aria-label="Semana anterior"
          >
            <ChevronRightIcon width={16} height={16} style={{ transform: 'rotate(180deg)' }} />
          </button>
          <span className="weekly-schedule__range">{rangeLabel}</span>
          <button
            type="button"
            className="weekly-schedule__nav-btn"
            onClick={() => setWeekStart((w) => addDays(w, 7))}
            aria-label="Semana siguiente"
          >
            <ChevronRightIcon width={16} height={16} />
          </button>
        </div>
      </header>

      {error && <p className="error-banner">{error}</p>}
      {!items && !error && <p className="muted">Cargando calendario…</p>}

      {items && (
        <div className="weekly-schedule__grid">
          {days.map((day) => {
            const key = toIsoDate(day);
            const dayItems = itemsByDay.get(key) ?? [];
            return (
              <div key={key} className={`weekly-schedule__day${key === todayKey ? ' weekly-schedule__day--today' : ''}`}>
                <div className="weekly-schedule__day-header">
                  <span className="weekly-schedule__day-label">{DAY_LABELS[(day.getDay() + 6) % 7]}</span>
                  <span className="weekly-schedule__day-number">{dayNumberFormatter.format(day)}</span>
                  <button
                    type="button"
                    className="weekly-schedule__day-add"
                    onClick={() => setSchedulingDay(day)}
                    aria-label="Agendar mantenimiento este día"
                    title="Agendar mantenimiento"
                  >
                    +
                  </button>
                </div>
                <DayItems items={dayItems} onSelect={setSelected} />
              </div>
            );
          })}
        </div>
      )}

      {showMonth && (
        <MonthScheduleModal
          initialMonth={weekStart}
          onClose={() => setShowMonth(false)}
          onSelectDay={(day) => {
            setWeekStart(startOfWeek(day));
            setShowMonth(false);
          }}
        />
      )}

      {selected && (
        <ScheduleDetailModal
          schedule={selected}
          onClose={() => setSelected(null)}
          onChanged={refreshWeek}
        />
      )}

      {schedulingDay && (
        <SchedulePickerModal
          mode="manual"
          initialDate={schedulingDay}
          onClose={() => setSchedulingDay(null)}
          onScheduled={() => {
            setSchedulingDay(null);
            refreshWeek();
          }}
        />
      )}
    </section>
  );
}
