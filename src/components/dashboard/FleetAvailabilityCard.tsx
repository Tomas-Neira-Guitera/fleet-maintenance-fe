import { useEffect, useState } from 'react';
import { isSessionExpired, SESSION_EXPIRED_MESSAGE } from '../../services/apiClient';
import { getDowntime } from '../../services/downtimeService';
import type { Downtime } from '../../types/domain';
import { formatAvailability, formatHours, formatStops } from '../../utils/downtimeFormat';
import { presetPeriod, type Period } from '../../utils/period';
import { ChevronRightIcon } from '../icons';
import { DowntimeStats } from './DowntimeStats';
import { PeriodFilter } from './PeriodFilter';
import '../../styles/dashboard.css';

interface FleetAvailabilityCardProps {
  /** Abre el detalle del vehículo que más tiempo estuvo fuera de servicio. */
  onOpenVehicle: (vehicleId: string) => void;
}

/**
 * Resumen del admin (CAM-134): disponibilidad de la flota y tiempo promedio de reparación en el período, y el
 * vehículo que más tiempo estuvo fuera de servicio. Uno solo, para que la tarjeta no crezca: cambia con el período.
 */
export function FleetAvailabilityCard({ onOpenVehicle }: FleetAvailabilityCardProps) {
  const [period, setPeriod] = useState<Period>(() => presetPeriod('month'));
  const [result, setResult] = useState<{ key: string; data: Downtime | null; error: string | null } | null>(null);
  const key = `${period.from.toISOString()}|${period.to.toISOString()}`;

  useEffect(() => {
    let cancelled = false;
    getDowntime(period)
      .then((data) => {
        if (!cancelled) setResult({ key, data, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const error = isSessionExpired(err) ? SESSION_EXPIRED_MESSAGE : 'No se pudo cargar la disponibilidad.';
          setResult({ key, data: null, error });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [key, period]);

  const current = result?.key === key ? result : null;
  const data = current?.data ?? null;
  // Por paradas y no por horas: una de pocos minutos se redondea a 0 h, pero cuenta igual.
  const worst = data?.vehicles.find((v) => v.stops > 0) ?? null;

  return (
    <section className="availability-card">
      <header className="availability-card__header">
        <h2 className="recent-defects-card__title">Disponibilidad de la flota</h2>
        <PeriodFilter period={period} onChange={setPeriod} />
      </header>

      <div className="availability-card__body">
        {current?.error && <p className="error-banner">{current.error}</p>}
        {!current && <p className="muted">Cargando disponibilidad…</p>}
        {data && (
          <>
            <DowntimeStats
              availabilityPct={data.fleet.availabilityPct}
              downtimeHours={data.fleet.downtimeHours}
              stops={data.fleet.stops}
              repairs={data.fleet.repairs}
            />
            <div className="availability-card__ranking">
              <h3 className="upcoming-maintenance-card__group-title">Más tiempo fuera de servicio</h3>
              {!worst ? (
                <p className="muted availability-card__empty">
                  Ningún vehículo estuvo fuera de servicio en el período.
                </p>
              ) : (
                <button
                  type="button"
                  className="availability-card__item"
                  aria-label={`Ver ${worst.plate}: ${formatHours(worst.downtimeHours)} fuera de servicio, ${formatStops(worst.stops)}`}
                  onClick={() => onOpenVehicle(worst.vehicleId)}
                >
                  <span className="vehicle-meta__plate">{worst.plate}</span>
                  <span className="availability-card__downtime">{formatHours(worst.downtimeHours)}</span>
                  <span className="availability-card__meta">
                    {formatStops(worst.stops)} · {formatAvailability(worst.availabilityPct)} disponible
                  </span>
                  <ChevronRightIcon />
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
