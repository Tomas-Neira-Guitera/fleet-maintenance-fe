import { useEffect, useState } from 'react';
import { isSessionExpired, SESSION_EXPIRED_MESSAGE } from '../../services/apiClient';
import { getRecurringDefects } from '../../services/defectsService';
import type { RecurringDefects } from '../../types/domain';
import { formatDayAndTime } from '../../utils/dateFormat';
import { AlertTriangleIcon } from '../icons';
import { SeverityBadge } from '../SeverityBadge';
import '../../styles/dashboard.css';

interface VehicleRecurringDefectsCardProps {
  vehicleId: string;
}

/**
 * Controles del checklist que fallan seguido en este vehículo (CAM-135): cuántas veces y cuándo, para
 * detectar reparaciones que no resuelven el problema de fondo. Si no hay ninguno, no ocupa lugar.
 */
export function VehicleRecurringDefectsCard({ vehicleId }: VehicleRecurringDefectsCardProps) {
  const [data, setData] = useState<RecurringDefects | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getRecurringDefects(vehicleId)
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
  }, [vehicleId]);

  if (!error && (!data || data.items.length === 0)) return null;

  return (
    <section className="vehicle-detail__card recurring-defects">
      <h2 className="vehicle-detail__card-title">
        <AlertTriangleIcon /> Controles con fallos recurrentes
      </h2>
      {error ? (
        <p className="muted">{error}</p>
      ) : (
        data && (
          <>
            <p className="muted recurring-defects__rule">
              Fallaron {data.threshold} veces o más en los últimos {data.windowDays} días.
            </p>
            <ul className="recurring-defects__list">
              {data.items.map((item) => (
                <li key={item.itemId} className="recurring-defects__item">
                  <div className="recurring-defects__item-header">
                    <span className="recurring-defects__label">{item.itemLabel}</span>
                    <span className="recurring-defects__count">
                      {item.count} {item.count === 1 ? 'falla' : 'fallas'} en {data.windowDays} días
                    </span>
                  </div>
                  <ul className="recurring-defects__occurrences">
                    {item.occurrences.map((o) => (
                      <li key={o.defectId} className="recurring-defects__occurrence">
                        <span className="recurring-defects__occurrence-main">
                          <span>{o.description}</span>
                          <span className="vehicle-detail__item-meta">
                            {formatDayAndTime(o.reportedAt)}
                            {o.status === 'resuelto' ? ' · Resuelto' : ''}
                          </span>
                        </span>
                        <SeverityBadge severity={o.severity} />
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </>
        )
      )}
    </section>
  );
}
