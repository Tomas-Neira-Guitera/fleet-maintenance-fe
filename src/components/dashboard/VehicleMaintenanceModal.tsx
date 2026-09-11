import { useEffect, useRef, useState } from 'react';
import {
  deleteMaintenanceAssignment,
  getVehicleMaintenanceAssignments,
  hasMaintenanceCompletions,
} from '../../services/maintenanceAssignmentsService';
import type { CompletionResult, MaintenanceAssignment, ScheduledMaintenance } from '../../types/domain';
import { formatDate } from '../../utils/maintenanceFormat';
import { CheckCircleIcon, CloseIcon } from '../icons';
import { AssignPlanModal } from './AssignPlanModal';
import { CompleteMaintenanceModal } from './CompleteMaintenanceModal';
import { StatusBadge } from './StatusBadge';
import { SchedulePickerModal } from './SchedulePickerModal';
import '../../styles/dashboard.css';

interface VehicleMaintenanceModalProps {
  vehicleId: string;
  plate: string;
  vehicleLabel: string;
  onClose: () => void;
  /** Avisa al padre que asignar/desasignar puede haber cambiado el próximo
   * vencimiento del vehículo, para que refresque su propia lista/tabla. */
  onChanged?: () => void;
}

function describeAssignment(a: MaintenanceAssignment): string {
  const parts: string[] = [];
  if (a.nextDueKm != null) parts.push(`${a.nextDueKm.toLocaleString('es-AR')} km`);
  if (a.nextDueDate) parts.push(formatDate(a.nextDueDate));
  return parts.length > 0 ? `Próximo vencimiento: ${parts.join(' · ')}` : 'Sin próximo vencimiento calculado';
}

function describeLastDone(a: MaintenanceAssignment): string | null {
  if (a.lastDoneKm == null && !a.lastDoneDate) return null;
  const parts: string[] = [];
  if (a.lastDoneKm != null) parts.push(`${a.lastDoneKm.toLocaleString('es-AR')} km`);
  if (a.lastDoneDate) parts.push(formatDate(a.lastDoneDate));
  return `Última vez: ${parts.join(' · ')}`;
}

/**
 * Modal de "Estado de la flota" (CAM-50): lista los mantenimientos del vehículo
 * seleccionado, cada uno con un botón para planificar cuándo se va a hacer.
 */
export function VehicleMaintenanceModal({
  vehicleId,
  plate,
  vehicleLabel,
  onClose,
  onChanged,
}: VehicleMaintenanceModalProps) {
  const [assignments, setAssignments] = useState<MaintenanceAssignment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState<MaintenanceAssignment | null>(null);
  const [scheduledIds, setScheduledIds] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [completing, setCompleting] = useState<MaintenanceAssignment | null>(null);
  const [justCompletedIds, setJustCompletedIds] = useState<Set<string>>(new Set());
  /** Asignaciones con al menos un completion real -- lastDoneKm/lastDoneDate
   * no alcanzan como señal: el backend los siembra con el estado del vehículo
   * al momento de asignar el plan, aunque nunca se haya hecho el mantenimiento. */
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const mountedRef = useRef(true);

  useEffect(() => {
    let cancelled = false;
    getVehicleMaintenanceAssignments(vehicleId)
      .then((data) => {
        if (cancelled) return;
        setAssignments(data);
        Promise.all(
          data.map((a) =>
            hasMaintenanceCompletions(vehicleId, a.id)
              .then((has) => [a.id, has] as const)
              .catch(() => [a.id, false] as const),
          ),
        ).then((results) => {
          if (cancelled) return;
          setCompletedIds(new Set(results.filter(([, has]) => has).map(([id]) => id)));
        });
      })
      .catch(() => {
        if (!cancelled) setError('No se pudieron cargar los mantenimientos de este vehículo.');
      });
    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  function handleScheduled(assignment: MaintenanceAssignment, schedule: ScheduledMaintenance) {
    setScheduledIds((prev) => new Set(prev).add(assignment.id));
    setScheduling(null);
    void schedule;
  }

  function handleAssigned(assignment: MaintenanceAssignment) {
    setAssignments((prev) => (prev ? [...prev, assignment] : [assignment]));
    setAssigning(false);
    onChanged?.();
  }

  function handleCompleted(result: CompletionResult) {
    setAssignments((prev) =>
      prev?.map((a) =>
        a.id === result.assignmentId
          ? {
              ...a,
              ...result.updatedAssignment,
              lastDoneKm: result.completedKm ?? a.lastDoneKm,
              lastDoneDate: result.completedAt,
            }
          : a,
      ) ?? prev,
    );
    setScheduledIds((prev) => {
      const next = new Set(prev);
      next.delete(result.assignmentId);
      return next;
    });
    setCompletedIds((prev) => new Set(prev).add(result.assignmentId));
    setCompleting(null);
    onChanged?.();

    setJustCompletedIds((prev) => new Set(prev).add(result.assignmentId));
    setTimeout(() => {
      if (!mountedRef.current) return;
      setJustCompletedIds((prev) => {
        const next = new Set(prev);
        next.delete(result.assignmentId);
        return next;
      });
    }, 1500);
  }

  async function handleUnassign(assignment: MaintenanceAssignment) {
    if (!window.confirm(`¿Desasignar "${assignment.planName}" de este vehículo?`)) return;
    setRemovingId(assignment.id);
    try {
      await deleteMaintenanceAssignment(vehicleId, assignment.id);
      setAssignments((prev) => prev?.filter((a) => a.id !== assignment.id) ?? prev);
      onChanged?.();
    } catch {
      setError('No se pudo desasignar el plan. Intentá de nuevo.');
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal">
        <header className="modal__header">
          <div>
            <h2 className="modal__title">Mantenimientos de {vehicleLabel}</h2>
            <p className="modal__subtitle">{plate}</p>
          </div>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Cerrar">
            <CloseIcon width={18} height={18} />
          </button>
        </header>

        <div className="modal__body">
          {error && <p className="error-banner">{error}</p>}
          {!assignments && !error && <p className="muted">Cargando mantenimientos…</p>}

          {assignments && (
            <div className="vehicle-maintenance-list__toolbar">
              <button type="button" className="secondary-btn" onClick={() => setAssigning(true)}>
                + Asignar plan
              </button>
            </div>
          )}

          {assignments && assignments.length === 0 && (
            <p className="muted">Este vehículo no tiene mantenimientos asignados.</p>
          )}

          {assignments && assignments.length > 0 && (
            <ul className="vehicle-maintenance-list">
              {assignments.map((a) => (
                <li
                  key={a.id}
                  className={`vehicle-maintenance-list__item${
                    justCompletedIds.has(a.id) ? ' vehicle-maintenance-list__item--just-completed' : ''
                  }`}
                >
                  <div className="vehicle-maintenance-list__info">
                    <div className="vehicle-maintenance-list__top-line">
                      <span className="vehicle-maintenance-list__name">{a.planName}</span>
                      <StatusBadge status={a.status} />
                    </div>
                    <p className="vehicle-maintenance-list__detail">{describeAssignment(a)}</p>
                    <p className="vehicle-maintenance-list__detail vehicle-maintenance-list__detail--muted">
                      {completedIds.has(a.id) && describeLastDone(a) ? (
                        <>
                          <CheckCircleIcon className="vehicle-maintenance-list__done-icon" />
                          {describeLastDone(a)}
                        </>
                      ) : (
                        'Todavía no se registró que se haya hecho'
                      )}
                    </p>
                  </div>
                  <div className="vehicle-maintenance-list__actions">
                    <button
                      type="button"
                      className="secondary-btn vehicle-maintenance-list__schedule-btn"
                      onClick={() => setCompleting(a)}
                    >
                      Marcar como hecho
                    </button>
                    <button
                      type="button"
                      className="secondary-btn vehicle-maintenance-list__schedule-btn"
                      onClick={() => setScheduling(a)}
                      disabled={scheduledIds.has(a.id)}
                    >
                      {scheduledIds.has(a.id) ? 'Programado' : 'Planificar'}
                    </button>
                    <button
                      type="button"
                      className="vehicle-maintenance-list__unassign-btn"
                      onClick={() => handleUnassign(a)}
                      disabled={removingId === a.id}
                    >
                      {removingId === a.id ? 'Quitando…' : 'Desasignar'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {scheduling && (
        <SchedulePickerModal
          sourceType="assignment"
          sourceId={scheduling.id}
          title={scheduling.planName}
          onClose={() => setScheduling(null)}
          onScheduled={(schedule) => handleScheduled(scheduling, schedule)}
        />
      )}

      {assigning && (
        <AssignPlanModal vehicleId={vehicleId} onClose={() => setAssigning(false)} onAssigned={handleAssigned} />
      )}

      {completing && (
        <CompleteMaintenanceModal
          vehicleId={vehicleId}
          assignment={completing}
          onClose={() => setCompleting(null)}
          onCompleted={handleCompleted}
        />
      )}
    </div>
  );
}
