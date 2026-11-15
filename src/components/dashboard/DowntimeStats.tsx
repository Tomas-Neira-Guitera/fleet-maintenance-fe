import type { RepairTimes } from '../../types/domain';
import { formatAvailability, formatHours, formatStops } from '../../utils/downtimeFormat';
import '../../styles/dashboard.css';

interface DowntimeStatsProps {
  availabilityPct: number | null;
  downtimeHours: number;
  stops: number;
  repairs: RepairTimes;
}

function describeRepairSplit(repairs: RepairTimes): string {
  const part = (label: string, avg: number | null) => `${label}: ${avg == null ? '—' : formatHours(avg)}`;
  return `${part('Internas', repairs.internal.avgHours)} · ${part('Externas', repairs.external.avgHours)}`;
}

/** Los indicadores de CAM-134, iguales en el Resumen (toda la flota) y en el detalle del vehículo. */
export function DowntimeStats({ availabilityPct, downtimeHours, stops, repairs }: DowntimeStatsProps) {
  return (
    <dl className="vehicle-costs__stats">
      <div className="vehicle-costs__stat">
        <dt>Disponibilidad</dt>
        <dd className={`vehicle-costs__value${availabilityPct == null ? ' vehicle-costs__value--empty' : ''}`}>
          {formatAvailability(availabilityPct)}
        </dd>
        <dd className="vehicle-costs__hint">Del tiempo sin defectos bloqueantes</dd>
      </div>
      <div className="vehicle-costs__stat">
        <dt>Fuera de servicio</dt>
        <dd className="vehicle-costs__value">{formatHours(downtimeHours)}</dd>
        <dd className="vehicle-costs__hint">{formatStops(stops)}</dd>
      </div>
      <div className="vehicle-costs__stat">
        <dt>Reparación promedio</dt>
        {repairs.avgHours == null ? (
          <>
            <dd className="vehicle-costs__value vehicle-costs__value--empty">Sin datos</dd>
            <dd className="vehicle-costs__hint">No se finalizaron órdenes de trabajo</dd>
          </>
        ) : (
          <>
            <dd className="vehicle-costs__value">{formatHours(repairs.avgHours)}</dd>
            <dd className="vehicle-costs__hint">
              {repairs.count} {repairs.count === 1 ? 'orden' : 'órdenes'} · {describeRepairSplit(repairs)}
            </dd>
          </>
        )}
      </div>
    </dl>
  );
}
