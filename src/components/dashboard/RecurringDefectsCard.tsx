import { useEffect, useState } from 'react';
import { useVisibleRows } from '../../hooks/useVisibleRows';
import { isSessionExpired, SESSION_EXPIRED_MESSAGE } from '../../services/apiClient';
import { getRecurringDefects } from '../../services/defectsService';
import type { RecurringDefect, RecurringDefects } from '../../types/domain';
import { formatDayAndTime } from '../../utils/dateFormat';
import { ChevronRightIcon } from '../icons';
import '../../styles/dashboard.css';

const VISIBLE_VEHICLES = 4;

interface RecurringDefectsCardProps {
  /** Abre el detalle del vehículo, donde se ve cada falla. */
  onOpenVehicle: (vehicleId: string) => void;
}

interface VehicleGroup {
  vehicleId: string;
  plate: string;
  controls: RecurringDefect[];
}

/** Agrupa por vehículo, en el orden en que vienen (más fallas primero), sin repetir vehículos. */
function groupByVehicle(items: RecurringDefect[]): VehicleGroup[] {
  const groups = new Map<string, VehicleGroup>();
  for (const item of items) {
    const group = groups.get(item.vehicleId) ?? { vehicleId: item.vehicleId, plate: item.plate, controls: [] };
    group.controls.push(item);
    groups.set(item.vehicleId, group);
  }
  return [...groups.values()];
}

/**
 * Resumen del admin (CAM-135): los vehículos con algún control del checklist que falla seguido.
 * Tocar un vehículo abre su detalle, con cada falla.
 */
export function RecurringDefectsCard({ onOpenVehicle }: RecurringDefectsCardProps) {
  const [data, setData] = useState<RecurringDefects | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getRecurringDefects()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(isSessionExpired(err) ? SESSION_EXPIRED_MESSAGE : 'No se pudieron cargar los defectos recurrentes.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const groups = data ? groupByVehicle(data.items) : null;
  const { ref: scrollRef, maxHeight } = useVisibleRows<HTMLDivElement>(VISIBLE_VEHICLES, groups?.length ?? 0);

  return (
    <section className="recent-defects-card">
      <header className="recent-defects-card__header">
        <h2 className="recent-defects-card__title">Defectos recurrentes</h2>
      </header>

      {error && <p className="error-banner">{error}</p>}
      {!data && !error && <p className="muted">Cargando defectos recurrentes…</p>}

      {data && groups && (
        <div
          ref={scrollRef}
          className="recent-defects-card__list scroll-list"
          style={maxHeight ? { maxHeight } : undefined}
        >
          {groups.length === 0 && (
            <p className="muted recurring-defects-card__empty">
              Ningún control falló {data.threshold} veces en un mismo vehículo en los últimos {data.windowDays} días.
            </p>
          )}
          {groups.map((group) => (
            <button
              key={group.vehicleId}
              type="button"
              data-scroll-item
              className="recent-defects-card__item recurring-defects-card__item"
              aria-label={`Ver ${group.plate}: ${group.controls.length} ${
                group.controls.length === 1 ? 'control recurrente' : 'controles recurrentes'
              }`}
              onClick={() => onOpenVehicle(group.vehicleId)}
            >
              <span className="recurring-defects-card__text">
                <span className="vehicle-meta__plate">{group.plate}</span>
                {group.controls.map((control) => (
                  <span key={control.itemId} className="recurring-defects-card__control">
                    <span className="recent-defects-card__description">
                      {control.itemLabel}: {control.count} {control.count === 1 ? 'falla' : 'fallas'} en{' '}
                      {data.windowDays} días
                    </span>
                    <span className="recent-defects-card__meta">
                      Última {formatDayAndTime(control.lastReportedAt)}
                    </span>
                  </span>
                ))}
              </span>
              <ChevronRightIcon />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
