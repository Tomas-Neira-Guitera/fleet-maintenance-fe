import { useCallback, useEffect, useMemo, useState } from 'react';
import { useVisibleRows } from '../../hooks/useVisibleRows';
import { getSchedule } from '../../services/scheduleService';
import type { ScheduledMaintenance } from '../../types/domain';
import { localDateKeyOf, localDayRange, toLocalDateKey } from '../../utils/localDate';
import {
  ALL_SCHEDULE_STATUSES,
  SCHEDULE_DISPLAY_STATUSES,
  SCHEDULE_SOURCE_SHORT_LABEL,
  SCHEDULE_STATUS_LABEL,
  scheduleDisplayStatus,
} from '../../utils/scheduleStatus';
import { ChevronRightIcon, LayoutGridIcon } from '../icons';
import { MonthScheduleModal } from './MonthScheduleModal';
import { ScheduleDetailModal } from './ScheduleDetailModal';
import { SchedulePickerModal } from './SchedulePickerModal';
import { ScheduleStatusBadge } from './ScheduleStatusBadge';
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

interface DayItemsProps {
  items: ScheduledMaintenance[];
  now: Date;
  onSelect: (item: ScheduledMaintenance) => void;
}

/** Mantenimientos de un día: se ven 2 y el resto con scroll dentro del día. */
function DayItems({ items, now, onSelect }: DayItemsProps) {
  const { ref, maxHeight } = useVisibleRows<HTMLDivElement>(VISIBLE_PER_DAY, items.length);
  return (
    <div
      ref={ref}
      className="weekly-schedule__day-items scroll-list"
      style={maxHeight ? { maxHeight } : undefined}
    >
      {items.length === 0 && <span className="weekly-schedule__empty">Sin turnos</span>}
      {items.map((item) => {
        const status = scheduleDisplayStatus(item, now);
        return (
          <button
            key={item.id}
            type="button"
            data-scroll-item
            className={`weekly-schedule__item weekly-schedule__item--${status}`}
            onClick={() => onSelect(item)}
            title={`${item.title} · ${SCHEDULE_STATUS_LABEL[status]} · Ver detalle`}
          >
            <span className="weekly-schedule__item-top">
              <span className="weekly-schedule__item-time">{timeFormatter.format(new Date(item.scheduledAt))}</span>
              <ScheduleStatusBadge status={status} />
            </span>
            <span className="weekly-schedule__item-title">{item.title}</span>
            <span className="weekly-schedule__item-meta">
              {item.plate && <span className="weekly-schedule__item-plate">{item.plate}</span>}
              <span className="weekly-schedule__item-source">{SCHEDULE_SOURCE_SHORT_LABEL[item.sourceType]}</span>
            </span>
          </button>
        );
      })}
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
 * suelta (origen manual) directo en ese día. Desde CAM-65 trae también lo hecho y lo
 * cancelado, y cada turno muestra su estado (programado, atrasado, hecho o cancelado).
 */
export function WeeklyScheduleCard({ refreshKey }: WeeklyScheduleCardProps = {}) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [items, setItems] = useState<ScheduledMaintenance[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showMonth, setShowMonth] = useState(false);
  const [schedulingDay, setSchedulingDay] = useState<Date | null>(null);
  const [selected, setSelected] = useState<ScheduledMaintenance | null>(null);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const fetchWeek = useCallback(
    () => getSchedule({ ...localDayRange(weekStart, addDays(weekStart, 7)), status: ALL_SCHEDULE_STATUSES }),
    [weekStart],
  );

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setError(null);
    fetchWeek()
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo cargar el calendario de mantenimientos.');
      });
    return () => {
      cancelled = true;
    };
  }, [fetchWeek, refreshKey]);

  const itemsByDay = useMemo(() => {
    const map = new Map<string, ScheduledMaintenance[]>();
    for (const day of days) map.set(toLocalDateKey(day), []);
    for (const item of items ?? []) {
      const key = localDateKeyOf(item.scheduledAt);
      map.get(key)?.push(item);
    }
    for (const list of map.values()) list.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    return map;
  }, [items, days]);

  const now = new Date();
  const todayKey = toLocalDateKey(now);
  const rangeLabel = `${dayNumberFormatter.format(weekStart)} ${monthFormatter.format(weekStart)} — ${dayNumberFormatter.format(
    addDays(weekStart, 6),
  )} ${monthFormatter.format(addDays(weekStart, 6))}`;

  function refreshWeek() {
    fetchWeek()
      .then(setItems)
      .catch(() => setError('No se pudo cargar el calendario de mantenimientos.'));
  }

  // Una semana que ya terminó no ofrece agendar: el backend rechaza fechas pasadas (PAST_DATE).
  const weekIsPast = addDays(weekStart, 7).getTime() <= startOfWeek(now).getTime();

  // Agendar desde el estado vacío: hoy si cae en la semana que se ve, si no el lunes.
  function scheduleFromEmptyState() {
    const today = days.find((day) => toLocalDateKey(day) === todayKey);
    setSchedulingDay(today ?? weekStart);
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

      {items && items.length === 0 && (
        <div className="weekly-schedule__empty-state">
          <p className="weekly-schedule__empty-title">No hay mantenimientos esta semana</p>
          {!weekIsPast && (
            <>
              <p className="weekly-schedule__empty-text">
                Planificá uno desde "Estado de la flota", desde un defecto, o agendalo acá.
              </p>
              <button type="button" className="secondary-btn weekly-schedule__empty-btn" onClick={scheduleFromEmptyState}>
                Agendar mantenimiento
              </button>
            </>
          )}
        </div>
      )}

      {items && items.length > 0 && (
        <>
          <div className="weekly-schedule__grid">
            {days.map((day) => {
              const key = toLocalDateKey(day);
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
                  <DayItems items={dayItems} now={now} onSelect={setSelected} />
                </div>
              );
            })}
          </div>

          <ul className="weekly-schedule__legend" aria-label="Estados de los turnos">
            {SCHEDULE_DISPLAY_STATUSES.map((status) => (
              <li key={status}>
                <ScheduleStatusBadge status={status} />
              </li>
            ))}
          </ul>
        </>
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
