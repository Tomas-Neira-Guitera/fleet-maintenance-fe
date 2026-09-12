import { useEffect, useState } from 'react';
import {
  createMaintenanceAssignment,
  deleteMaintenanceAssignment,
  getVehicleMaintenanceAssignments,
} from '../../services/maintenanceAssignmentsService';
import { getVehicles } from '../../services/vehiclesService';
import type { MaintenanceAssignment, MaintenancePlan, Vehicle } from '../../types/domain';
import { numberFormatter } from '../../utils/maintenanceFormat';
import { CloseIcon } from '../icons';
import '../../styles/dashboard.css';

interface PlanVehiclesModalProps {
  plan: MaintenancePlan;
  onClose: () => void;
}

interface VehicleRow {
  vehicle: Vehicle;
  /** Asignación activa de este plan en este vehículo, si existe. */
  assignment: MaintenanceAssignment | null;
}

function describeInterval(plan: Pick<MaintenancePlan, 'intervalType' | 'intervalKm' | 'intervalDays'>): string {
  const parts: string[] = [];
  if (plan.intervalKm != null) parts.push(`cada ${numberFormatter.format(plan.intervalKm)} km`);
  if (plan.intervalDays != null) parts.push(`cada ${plan.intervalDays} días`);
  return parts.join(' o ');
}

/**
 * Vehículos y su relación con un plan del catálogo (CAM-25): reverso de
 * AssignPlanModal -- ahí se elige un plan para un vehículo, acá se elige un
 * vehículo para un plan. Muestra TODOS los vehículos activos, no solo los
 * elegibles: a los que ya tienen el plan asignado se les puede desasignar
 * desde acá mismo, en vez de tener que ir al flujo por vehículo para eso.
 */
export function PlanVehiclesModal({ plan, onClose }: PlanVehiclesModalProps) {
  const [rows, setRows] = useState<VehicleRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getVehicles(true)
      .then((allVehicles) =>
        Promise.all(
          allVehicles.map((vehicle) =>
            getVehicleMaintenanceAssignments(vehicle.id)
              .then((assignments) => {
                const assignment = assignments.find((a) => a.active && a.maintenancePlanId === plan.id) ?? null;
                return { vehicle, assignment };
              })
              .catch(() => ({ vehicle, assignment: null })),
          ),
        ),
      )
      .then((result) => {
        if (!cancelled) setRows(result);
      })
      .catch(() => {
        if (!cancelled) setError('No se pudieron cargar los vehículos.');
      });
    return () => {
      cancelled = true;
    };
  }, [plan.id]);

  async function handleAssign(vehicleId: string) {
    setPendingId(vehicleId);
    setError(null);
    try {
      const assignment = await createMaintenanceAssignment(vehicleId, plan.id);
      setRows((prev) => prev?.map((r) => (r.vehicle.id === vehicleId ? { ...r, assignment } : r)) ?? prev);
    } catch {
      setError('No se pudo asignar el plan. Intentá de nuevo.');
    } finally {
      setPendingId(null);
    }
  }

  async function handleUnassign(vehicleId: string, assignment: MaintenanceAssignment, plate: string) {
    if (!window.confirm(`¿Desasignar "${plan.name}" de ${plate}?`)) return;
    setPendingId(vehicleId);
    setError(null);
    try {
      await deleteMaintenanceAssignment(vehicleId, assignment.id);
      setRows((prev) => prev?.map((r) => (r.vehicle.id === vehicleId ? { ...r, assignment: null } : r)) ?? prev);
    } catch {
      setError('No se pudo desasignar el plan. Intentá de nuevo.');
    } finally {
      setPendingId(null);
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
          {!rows && !error && <p className="muted">Cargando vehículos…</p>}
          {rows && rows.length === 0 && <p className="muted">No hay vehículos activos en la flota.</p>}

          {rows && rows.length > 0 && (
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
                  {rows.map(({ vehicle: v, assignment }) => (
                    <tr key={v.id}>
                      <td className="fleet-status__plate">{v.plate}</td>
                      <td>
                        <div className="fleet-status__vehicle">
                          <span className="fleet-status__vehicle-name">
                            {v.brand} {v.model}
                          </span>
                          {assignment && <span className="fleet-status__vehicle-type">Ya asignado</span>}
                        </div>
                      </td>
                      <td>
                        {assignment ? (
                          <button
                            type="button"
                            className="vehicle-maintenance-list__icon-btn vehicle-maintenance-list__schedule-btn vehicle-maintenance-list__icon-btn--danger"
                            onClick={() => handleUnassign(v.id, assignment, v.plate)}
                            disabled={pendingId === v.id}
                          >
                            {pendingId === v.id ? 'Quitando…' : 'Desasignar'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="secondary-btn vehicle-maintenance-list__schedule-btn"
                            onClick={() => handleAssign(v.id)}
                            disabled={pendingId === v.id}
                          >
                            {pendingId === v.id ? 'Asignando…' : 'Asignar'}
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
