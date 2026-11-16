import type { Vehicle } from '../types/domain';
import { formatDayAndTime } from '../utils/dateFormat';
import { AlertTriangleIcon, FuelIcon, LockClockIcon } from './icons';

interface MyTripProps {
  vehicle: Vehicle;
  /** El pre-viaje sigue guardado en el celular: el servidor todavía no conoce el viaje. */
  pending: boolean;
  offline: boolean;
  onClose: (vehicle: Vehicle) => void;
  onLoadFuel: (vehicle: Vehicle) => void;
  onReportProblem: (vehicle: Vehicle) => void;
}

/** El viaje abierto del chofer, en lugar de la flota: no hay otro vehículo para tomar hasta cerrarlo. */
export function MyTrip({ vehicle, pending, offline, onClose, onLoadFuel, onReportProblem }: MyTripProps) {
  const startedAt = vehicle.currentTrip?.startedAt;
  // CAM-86: un bloqueante abierto durante el viaje no impide cerrarlo, pero el chofer tiene que verlo.
  const reasons = vehicle.blocked ? (vehicle.blockReasons ?? []).map((r) => r.message) : [];
  // CAM-156: la carga va con señal (la hora es la del envío). CAM-139: el reporte necesita el viaje en el servidor.
  const canLoadFuel = !offline;
  const canReport = !pending;

  return (
    <section className="my-trip" aria-label={`Tu viaje en ${vehicle.plate}`}>
      <div className="my-trip__card">
        <div className="my-trip__head">
          <span className="vehicle-card__plate">{vehicle.plate}</span>
          <span className="status-pill status-pill--info">
            <LockClockIcon className="status-pill__icon" />
            En viaje
          </span>
        </div>
        <span className="vehicle-card__model">
          {vehicle.brand} {vehicle.model}
        </span>
        {vehicle.coupledWith && <span className="vehicle-card__trip">Con el remolque {vehicle.coupledWith.plate}</span>}
        {startedAt && <span className="vehicle-card__trip">Abierto el {formatDayAndTime(startedAt)}</span>}
        {pending && <span className="vehicle-card__trip">Pendiente de envío</span>}
        {reasons.map((reason) => (
          <span key={reason} className="vehicle-card__reason">
            {reason}
          </span>
        ))}
      </div>

      <button type="button" className="primary-btn my-trip__close" onClick={() => onClose(vehicle)}>
        Cerrar viaje
      </button>

      <div className="my-trip__actions">
        <button type="button" className="my-trip__action" onClick={() => onLoadFuel(vehicle)} disabled={!canLoadFuel}>
          <FuelIcon aria-hidden="true" />
          Cargar combustible
        </button>
        <button
          type="button"
          className="my-trip__action my-trip__action--report"
          onClick={() => onReportProblem(vehicle)}
          disabled={!canReport}
        >
          <AlertTriangleIcon aria-hidden="true" />
          Reportar un problema
        </button>
      </div>
      {!canLoadFuel && <p className="muted">Sin señal no se puede cargar combustible.</p>}
      {!canReport && <p className="muted">Vas a poder reportar un problema cuando se envíe el pre-viaje.</p>}
    </section>
  );
}
