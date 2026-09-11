import { useState } from 'react';
import { ApiError } from '../../services/apiClient';
import { createMaintenanceCompletion } from '../../services/maintenanceAssignmentsService';
import type { CompletionResult, MaintenanceAssignment } from '../../types/domain';
import { CloseIcon } from '../icons';
import '../../styles/dashboard.css';

interface CompleteMaintenanceModalProps {
  vehicleId: string;
  assignment: MaintenanceAssignment;
  onClose: () => void;
  onCompleted: (result: CompletionResult) => void;
}

function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Registrar que un mantenimiento se hizo (CAM-16/CAM-40): dispara el
 * recálculo de próximo vencimiento en el backend y cierra sola cualquier
 * programación activa (CAM-42) sobre esta asignación.
 */
export function CompleteMaintenanceModal({ vehicleId, assignment, onClose, onCompleted }: CompleteMaintenanceModalProps) {
  const needsKm = assignment.intervalType === 'km' || assignment.intervalType === 'both';

  const [completedAt, setCompletedAt] = useState(todayIso());
  const [completedKm, setCompletedKm] = useState(
    assignment.lastDoneKm != null ? String(assignment.lastDoneKm) : '',
  );
  const [workOrderId, setWorkOrderId] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = Boolean(completedAt) && (!needsKm || completedKm.trim());

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const result = await createMaintenanceCompletion(vehicleId, assignment.id, {
        completedAt,
        completedKm: needsKm ? Number(completedKm) : undefined,
        workOrderId: workOrderId.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      onCompleted(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar el mantenimiento. Intentá de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal modal--narrow">
        <header className="modal__header">
          <div>
            <h2 className="modal__title">Marcar como hecho</h2>
            <p className="modal__subtitle">{assignment.planName}</p>
          </div>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Cerrar">
            <CloseIcon width={18} height={18} />
          </button>
        </header>

        <div className="modal__body">
          <label className="schedule-picker__field">
            Fecha en que se hizo
            <input
              type="date"
              className="schedule-picker__input"
              value={completedAt}
              max={todayIso()}
              onChange={(e) => setCompletedAt(e.target.value)}
            />
          </label>

          {needsKm && (
            <label className="schedule-picker__field">
              Kilometraje en ese momento
              <input
                type="number"
                min={0}
                className="schedule-picker__input"
                value={completedKm}
                onChange={(e) => setCompletedKm(e.target.value)}
                placeholder="Ej: 45000"
              />
            </label>
          )}

          <label className="schedule-picker__field">
            Orden de trabajo (opcional)
            <input
              type="text"
              className="schedule-picker__input"
              value={workOrderId}
              onChange={(e) => setWorkOrderId(e.target.value)}
            />
          </label>

          <label className="schedule-picker__field">
            Notas (opcional)
            <textarea
              className="schedule-picker__input schedule-picker__textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </label>

          {error && <p className="error-banner">{error}</p>}
        </div>

        <footer className="modal__footer">
          <button type="button" className="secondary-btn" onClick={onClose} disabled={submitting}>
            Cancelar
          </button>
          <button type="button" className="primary-btn" onClick={handleSubmit} disabled={submitting || !canSubmit}>
            {submitting ? 'Guardando…' : 'Confirmar'}
          </button>
        </footer>
      </div>
    </div>
  );
}
