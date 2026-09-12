import { useEffect, useState } from 'react';
import { ApiError } from '../../services/apiClient';
import { createMaintenanceAssignment, getVehicleMaintenanceAssignments } from '../../services/maintenanceAssignmentsService';
import { getVehicles } from '../../services/vehiclesService';
import type { MaintenancePlan, Vehicle } from '../../types/domain';
import { numberFormatter } from '../../utils/maintenanceFormat';
import { CloseIcon } from '../icons';
import '../../styles/dashboard.css';

interface PlanVehiclesModalProps {
  plan: MaintenancePlan;
  onClose: () => void;
}

function describeInterval(plan: Pick<MaintenancePlan, 'intervalType' | 'intervalKm' | 'intervalDays'>): string {
  const parts: string[] = [];
  if (plan.intervalKm != null) parts.push(`cada ${numberFormatter.format(plan.intervalKm)} km`);
  if (plan.intervalDays != null) parts.push(`cada ${plan.intervalDays} días`);
  return parts.join(' o ');
}

/**
 * Vehículos a los que se le puede asignar un plan del catálogo (CAM-25):
 * reverso de AssignPlanModal -- ahí se elige un plan para un vehículo, acá se
 * elige un vehículo para un plan. Un vehículo es elegible si está activo y no
 * tiene ya una asignación activa de este plan (createMaintenanceAssignment
 * devuelve 409 DUPLICATE_ACTIVE_ASSIGNMENT en ese caso, ver CAM-40 contract).
 */
export function PlanVehiclesModal({ plan, onClose }: PlanVehiclesModalProps) {
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    getVehicles(true)
      .then((allVehicles) =>
        Promise.all(
          allVehicles.map((v) =>
            getVehicleMaintenanceAssignments(v.id)
              .then((assignments) => {
                const alreadyAssigned = assignments.some((a) => a.active && a.maintenancePlanId === plan.id);
                return [v, alreadyAssigned] as const;
              })
              .catch(() => [v, true] as const),
          ),
        ),
      )
      .then((pairs) => {
        if (cancelled) return;
        setVehicles(pairs.filter(([, alreadyAssigned]) => !alreadyAssigned).map(([v]) => v));
      })
      .catch(() => {
        if (!cancelled) setError('No se pudieron cargar los vehículos.');
      });
    return () => {
      cancelled = true;
    };
  }, [plan.id]);

  async function handleAssign(vehicleId: string) {
    setAssigningId(vehicleId);
    setError(null);
    try {
      await createMaintenanceAssignment(vehicleId, plan.id);
      setAssignedIds((prev) => new Set(prev).add(vehicleId));
    } catch (err) {
      if (err instanceof ApiError && err.errorCode === 'DUPLICATE_ACTIVE_ASSIGNMENT') {
        setAssignedIds((prev) => new Set(prev).add(vehicleId));
      } else {
        setError(err instanceof ApiError ? err.message : 'No se pudo asignar el plan. Intentá de nuevo.');
      }
    } finally {
      setAssigningId(null);
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal modal--wide">
        <header className="modal__header">
          <div>
            <h2 className="modal__title">
              Asignar <span className="plan-vehicles-modal__plan-name">{plan.name}</span>
            </h2>
            <p className="modal__subtitle">{describeInterval(plan)}</p>
          </div>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Cerrar">
            <CloseIcon width={18} height={18} />
          </button>
        </header>

        <div className="modal__body">
          {error && <p className="error-banner">{error}</p>}
          {!vehicles && !error && <p className="muted">Cargando vehículos…</p>}
          {vehicles && vehicles.length === 0 && (
            <p className="muted">Todos los vehículos activos ya tienen este plan asignado, o no hay vehículos activos en la flota.</p>
          )}

          {vehicles && vehicles.length > 0 && (
            <div className="fleet-status__table-wrap">
              <table className="fleet-status__table">
                <thead>
                  <tr>
                    <th>Patente</th>
                    <th>Vehículo</th>
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
                      <td>
                        {assignedIds.has(v.id) ? (
                          <span className="vehicles-section__status vehicles-section__status--active">Asignado ✓</span>
                        ) : (
                          <button
                            type="button"
                            className="secondary-btn vehicle-maintenance-list__schedule-btn"
                            onClick={() => handleAssign(v.id)}
                            disabled={assigningId === v.id}
                          >
                            {assigningId === v.id ? 'Asignando…' : 'Asignar'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
