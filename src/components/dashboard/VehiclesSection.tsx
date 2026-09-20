import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../services/apiClient';
import { deactivateVehicle, getVehicles, updateVehicle } from '../../services/vehiclesService';
import type { OdometerResult } from '../../services/vehiclesService';
import type { Vehicle } from '../../types/domain';
import { numberFormatter } from '../../utils/maintenanceFormat';
import { AlertTriangleIcon, HistoryIcon, PowerIcon } from '../icons';
import { UpdateOdometerModal } from './UpdateOdometerModal';
import { VehicleHistoryModal } from './VehicleHistoryModal';
import { VehicleFormModal } from './VehicleFormModal';
import '../../styles/dashboard.css';

function formatKm(km: number): string {
  return `${numberFormatter.format(km)} km`;
}

/**
 * ABM de vehículos (CAM-25): alta, edición y baja lógica. La asignación de
 * planes de mantenimiento (CAM-16) vive en la pestaña "Planes de
 * Mantenimiento" -- esta pantalla ya no la gestiona.
 */
export function VehiclesSection() {
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [formTarget, setFormTarget] = useState<'new' | Vehicle | null>(null);
  const [odometerTarget, setOdometerTarget] = useState<Vehicle | null>(null);
  const [historyTarget, setHistoryTarget] = useState<Vehicle | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const mountedRef = useRef(true);

  function load(active: boolean) {
    getVehicles(active)
      .then((data) => {
        if (mountedRef.current) setVehicles(data);
      })
      .catch(() => {
        if (mountedRef.current) setError('No se pudo cargar la flota. Intentá de nuevo.');
      });
  }

  useEffect(() => {
    mountedRef.current = true;
    load(!showInactive);
    return () => {
      mountedRef.current = false;
    };
  }, [showInactive]);

  function handleSaved() {
    setFormTarget(null);
    load(!showInactive);
  }

  function handleOdometerUpdated(result: OdometerResult) {
    setVehicles((prev) =>
      prev?.map((v) => (v.id === result.vehicleId ? { ...v, odometerKm: result.odometerKm } : v)) ?? prev,
    );
    setOdometerTarget(null);
  }

  async function handleToggleActive(vehicle: Vehicle) {
    const reactivating = vehicle.active === false;
    if (!reactivating && !window.confirm(`¿Dar de baja "${vehicle.plate}"? Se puede reactivar después.`)) return;

    setPendingId(vehicle.id);
    setError(null);
    try {
      if (reactivating) {
        await updateVehicle(vehicle.id, { active: true });
      } else {
        await deactivateVehicle(vehicle.id);
      }
      load(!showInactive);
    } catch (err) {
      if (err instanceof ApiError && err.errorCode === 'VEHICLE_ON_TRIP') {
        setError('No se puede dar de baja: tiene un viaje abierto. Cerrá el viaje (post-trip) y volvé a intentarlo.');
      } else {
        setError(err instanceof ApiError ? err.message : 'No se pudo actualizar el vehículo. Intentá de nuevo.');
      }
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section className="fleet-status vehicles-section">
      <header className="fleet-status__header">
        <h1 className="fleet-status__title">Vehículos</h1>
        <div className="vehicles-section__header-actions">
          <label className="vehicles-section__toggle">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            Ver dados de baja
          </label>
          <button type="button" className="primary-btn vehicles-section__new-btn" onClick={() => setFormTarget('new')}>
            + Nuevo vehículo
          </button>
        </div>
      </header>

      {error && (
        <p className="error-banner error-banner--icon">
          <AlertTriangleIcon width={16} height={16} />
          {error}
        </p>
      )}
      {!vehicles && !error && <p className="muted">Cargando flota…</p>}

      {vehicles && (
        <div className="fleet-status__table-wrap">
          <table className="fleet-status__table">
            <thead>
              <tr>
                <th>Patente</th>
                <th>Vehículo</th>
                <th>Año</th>
                <th>Tipo</th>
                <th>Kilometraje</th>
                <th>Estado</th>
                <th aria-hidden="true"></th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => (
                <tr key={v.id}>
                  <td className="fleet-status__plate">{v.plate}</td>
                  <td>
                    <div className="fleet-status__vehicle">
                      <span className="fleet-status__vehicle-name">
                        {v.brand} {v.model}
                      </span>
                    </div>
                  </td>
                  <td>{v.year ?? '—'}</td>
                  <td>{v.vehicleType ?? '—'}</td>
                  <td className="fleet-status__km">{formatKm(v.odometerKm ?? 0)}</td>
                  <td>
                    <span
                      className={`vehicles-section__status vehicles-section__status--${v.active === false ? 'inactive' : 'active'}`}
                    >
                      {v.active === false ? 'Dado de baja' : 'Activo'}
                    </span>
                  </td>
                  <td>
                    <div className="vehicles-section__actions">
                      {v.active !== false && (
                        <>
                          <button
                            type="button"
                            className="secondary-btn vehicles-section__action-btn"
                            onClick={() => setFormTarget(v)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="secondary-btn vehicles-section__action-btn"
                            onClick={() => setOdometerTarget(v)}
                          >
                            Cargar km
                          </button>
                          <button
                            type="button"
                            className="secondary-btn vehicles-section__action-btn"
                            onClick={() => setHistoryTarget(v)}
                          >
                            <HistoryIcon width={14} height={14} />
                            Historial
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        className={`vehicle-maintenance-list__icon-btn vehicles-section__action-btn ${
                          v.active === false ? 'vehicle-maintenance-list__icon-btn--ok' : 'vehicle-maintenance-list__icon-btn--warn'
                        }`}
                        onClick={() => handleToggleActive(v)}
                        disabled={pendingId === v.id}
                      >
                        <PowerIcon width={14} height={14} />
                        {v.active === false ? 'Reactivar' : 'Dar de baja'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {vehicles.length === 0 && (
            <p className="muted">
              {showInactive ? 'No hay vehículos dados de baja.' : 'No hay vehículos en la flota todavía.'}
            </p>
          )}
        </div>
      )}

      {formTarget && (
        <VehicleFormModal
          vehicle={formTarget === 'new' ? undefined : formTarget}
          onClose={() => setFormTarget(null)}
          onSaved={handleSaved}
        />
      )}

      {odometerTarget && (
        <UpdateOdometerModal
          vehicle={odometerTarget}
          onClose={() => setOdometerTarget(null)}
          onUpdated={handleOdometerUpdated}
        />
      )}

      {historyTarget && <VehicleHistoryModal vehicle={historyTarget} onClose={() => setHistoryTarget(null)} />}
    </section>
  );
}
