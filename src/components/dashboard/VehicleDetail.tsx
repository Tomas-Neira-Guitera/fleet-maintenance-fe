import { useEffect, useState } from 'react';
import { ApiError } from '../../services/apiClient';
import { getVehicle, getVehicleHistory } from '../../services/vehiclesService';
import type { Vehicle, VehicleHistory } from '../../types/domain';
import { formatDate, numberFormatter } from '../../utils/maintenanceFormat';
import { AlertTriangleIcon, ArrowLeftIcon } from '../icons';
import { SeverityBadge } from '../SeverityBadge';
import '../../styles/dashboard.css';

interface VehicleDetailProps {
  vehicleId: string;
  onBack: () => void;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
}

function formatKm(km: number | null | undefined): string {
  return km == null ? '—' : `${numberFormatter.format(km)} km`;
}

/**
 * Detalle de un vehículo (CAM-22): ficha + historial de inspecciones, defectos y
 * mantenimientos realizados. Todavía no hay órdenes de trabajo -- los mantenimientos
 * son los "marcar como hecho" de cada plan.
 */
export function VehicleDetail({ vehicleId, onBack }: VehicleDetailProps) {
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [history, setHistory] = useState<VehicleHistory | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getVehicle(vehicleId), getVehicleHistory(vehicleId)])
      .then(([v, h]) => {
        if (cancelled) return;
        setVehicle(v);
        setHistory(h);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof ApiError && err.status === 404
            ? 'No se encontró el vehículo.'
            : 'No se pudo cargar el vehículo. Intentá de nuevo.',
        );
      });
    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  const inactive = vehicle?.active === false;

  return (
    <section className="vehicle-detail">
      <button type="button" className="top-nav__back" onClick={onBack}>
        <ArrowLeftIcon width={16} height={16} />
        Volver
      </button>

      {error && (
        <p className="error-banner error-banner--icon">
          <AlertTriangleIcon width={16} height={16} />
          {error}
        </p>
      )}
      {!vehicle && !error && <p className="muted">Cargando vehículo…</p>}

      {vehicle && (
        <>
          <header className="vehicle-detail__header">
            <div>
              <span className="vehicle-detail__plate">{vehicle.plate}</span>
              <h1 className="vehicle-detail__title">
                {vehicle.brand} {vehicle.model}
              </h1>
            </div>
            <span className={`vehicles-section__status vehicles-section__status--${inactive ? 'inactive' : 'active'}`}>
              {inactive ? 'Dado de baja' : 'Activo'}
            </span>
          </header>

          <dl className="vehicle-detail__facts">
            <div>
              <dt>Año</dt>
              <dd>{vehicle.year ?? '—'}</dd>
            </div>
            <div>
              <dt>Tipo</dt>
              <dd>{vehicle.vehicleType ?? '—'}</dd>
            </div>
            <div>
              <dt>Kilometraje</dt>
              <dd className="vehicle-detail__mono">{formatKm(vehicle.odometerKm ?? 0)}</dd>
            </div>
            <div>
              <dt>N° de chasis</dt>
              <dd className="vehicle-detail__mono">{vehicle.chassisNumber ?? '—'}</dd>
            </div>
            <div>
              <dt>Situación</dt>
              <dd>{vehicle.status === 'on-trip' ? 'En viaje' : 'Disponible'}</dd>
            </div>
          </dl>
        </>
      )}

      {history && (
        <div className="vehicle-detail__sections">
          <section className="vehicle-detail__card">
            <h2 className="vehicle-detail__card-title">Inspecciones ({history.inspections.length})</h2>
            {history.inspections.length === 0 ? (
              <p className="muted">Sin inspecciones registradas.</p>
            ) : (
              <ul className="vehicle-detail__list">
                {history.inspections.map((i) => (
                  <li key={i.id} className="vehicle-detail__item">
                    <div className="vehicle-detail__item-main">
                      <span className="vehicle-detail__item-label">
                        {i.type === 'pre-trip' ? 'Pre-viaje' : 'Post-viaje'}
                        {i.driverName ? ` · ${i.driverName}` : ''}
                      </span>
                      <span className="vehicle-detail__item-meta">
                        {formatDateTime(i.timestamp)} · {formatKm(i.odometerKm)}
                      </span>
                      {i.notes && <span className="vehicle-detail__item-meta">{i.notes}</span>}
                    </div>
                    {i.hasBlockingDefect && <SeverityBadge severity="blocking" />}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="vehicle-detail__card">
            <h2 className="vehicle-detail__card-title">Defectos ({history.defects.length})</h2>
            {history.defects.length === 0 ? (
              <p className="muted">Sin defectos reportados.</p>
            ) : (
              <ul className="vehicle-detail__list">
                {history.defects.map((d) => (
                  <li key={d.id} className="vehicle-detail__item">
                    <div className="vehicle-detail__item-main">
                      <span className="vehicle-detail__item-label">{d.description}</span>
                      <span className="vehicle-detail__item-meta">
                        {formatDateTime(d.createdAt)}
                        {d.reportedBy ? ` · ${d.reportedBy}` : ''}
                      </span>
                    </div>
                    <SeverityBadge severity={d.severity} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="vehicle-detail__card">
            <h2 className="vehicle-detail__card-title">Mantenimientos realizados ({history.maintenance.length})</h2>
            {history.maintenance.length === 0 ? (
              <p className="muted">Sin mantenimientos registrados.</p>
            ) : (
              <ul className="vehicle-detail__list">
                {history.maintenance.map((m) => (
                  <li key={m.id} className="vehicle-detail__item">
                    <div className="vehicle-detail__item-main">
                      <span className="vehicle-detail__item-label">{m.planName}</span>
                      <span className="vehicle-detail__item-meta">
                        {formatDate(m.completedAt)} · {formatKm(m.completedKm)}
                        {m.workOrderId ? ` · OT ${m.workOrderId}` : ''}
                      </span>
                      {m.notes && <span className="vehicle-detail__item-meta">{m.notes}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
