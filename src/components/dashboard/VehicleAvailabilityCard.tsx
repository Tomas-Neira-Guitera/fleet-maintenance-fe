import { useEffect, useState } from 'react';
import { isSessionExpired, SESSION_EXPIRED_MESSAGE } from '../../services/apiClient';
import { getDowntime } from '../../services/downtimeService';
import type { Downtime } from '../../types/domain';
import { presetPeriod, type Period } from '../../utils/period';
import { DowntimeStats } from './DowntimeStats';
import { PeriodFilter } from './PeriodFilter';
import '../../styles/dashboard.css';

interface VehicleAvailabilityCardProps {
  vehicleId: string;
}

/** Cuánto tiempo estuvo parado el vehículo en el período, cuántas veces y cuánto tardaron sus reparaciones (CAM-134). */
export function VehicleAvailabilityCard({ vehicleId }: VehicleAvailabilityCardProps) {
  const [period, setPeriod] = useState<Period>(() => presetPeriod('quarter'));
  const [result, setResult] = useState<{ key: string; data: Downtime | null; error: string | null } | null>(null);
  const key = `${vehicleId}|${period.from.toISOString()}|${period.to.toISOString()}`;

  useEffect(() => {
    let cancelled = false;
    getDowntime(period, vehicleId)
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
  }, [key, period, vehicleId]);

  // Mientras llega el período nuevo no se muestran los números del anterior.
  const current = result?.key === key ? result : null;
  const vehicle = current?.data?.vehicles[0];

  return (
    <section className="vehicle-detail__card availability">
      <div className="availability__header">
        <h2 className="vehicle-detail__card-title">Disponibilidad</h2>
        <PeriodFilter period={period} onChange={setPeriod} />
      </div>
      {current?.error ? (
        <p className="muted">{current.error}</p>
      ) : !vehicle ? (
        <p className="muted">Cargando disponibilidad…</p>
      ) : (
        <DowntimeStats
          availabilityPct={vehicle.availabilityPct}
          downtimeHours={vehicle.downtimeHours}
          stops={vehicle.stops}
          repairs={vehicle.repairs}
        />
      )}
    </section>
  );
}
