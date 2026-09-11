import { useEffect, useState } from 'react';
import { getVehicleMaintenanceAssignments } from '../../services/maintenanceAssignmentsService';
import type { MaintenanceAssignment, ScheduledMaintenance } from '../../types/domain';
import { formatDate } from '../../utils/maintenanceFormat';
import { CloseIcon } from '../icons';
import { StatusBadge } from './StatusBadge';
import { SchedulePickerModal } from './SchedulePickerModal';
import '../../styles/dashboard.css';

interface VehicleMaintenanceModalProps {
  vehicleId: string;
  plate: string;
  vehicleLabel: string;
  onClose: () => void;
}

function describeAssignment(a: MaintenanceAssignment): string {
  const parts: string[] = [];
  if (a.nextDueKm != null) parts.push(`${a.nextDueKm.toLocaleString('es-AR')} km`);
  if (a.nextDueDate) parts.push(formatDate(a.nextDueDate));
  return parts.length > 0 ? `Próximo vencimiento: ${parts.join(' · ')}` : 'Sin próximo vencimiento calculado';
}

/**
 * Modal de "Estado de la flota" (CAM-50): lista los mantenimientos del vehículo
 * seleccionado, cada uno con un botón para planificar cuándo se va a hacer.
 */
export function VehicleMaintenanceModal({ vehicleId, plate, vehicleLabel, onClose }: VehicleMaintenanceModalProps) {
  const [assignments, setAssignments] = useState<MaintenanceAssignment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState<MaintenanceAssignment | null>(null);
  const [scheduledIds, setScheduledIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    getVehicleMaintenanceAssignments(vehicleId)
      .then((data) => {
        if (!cancelled) setAssignments(data);
      })
      .catch(() => {
        if (!cancelled) setError('No se pudieron cargar los mantenimientos de este vehículo.');
      });
    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  function handleScheduled(assignment: MaintenanceAssignment, schedule: ScheduledMaintenance) {
    setScheduledIds((prev) => new Set(prev).add(assignment.id));
    setScheduling(null);
    void schedule;
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
          {assignments && assignments.length === 0 && (
            <p className="muted">Este vehículo no tiene mantenimientos asignados.</p>
          )}

          {assignments && assignments.length > 0 && (
            <ul className="vehicle-maintenance-list">
              {assignments.map((a) => (
                <li key={a.id} className="vehicle-maintenance-list__item">
                  <div className="vehicle-maintenance-list__info">
                    <div className="vehicle-maintenance-list__top-line">
                      <span className="vehicle-maintenance-list__name">{a.planName}</span>
                      <StatusBadge status={a.status} />
                    </div>
                    <p className="vehicle-maintenance-list__detail">{describeAssignment(a)}</p>
                  </div>
                  <button
                    type="button"
                    className="secondary-btn vehicle-maintenance-list__schedule-btn"
                    onClick={() => setScheduling(a)}
                    disabled={scheduledIds.has(a.id)}
                  >
                    {scheduledIds.has(a.id) ? 'Programado' : 'Planificar'}
                  </button>
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
    </div>
  );
}
