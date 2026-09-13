import { useState } from 'react';
import { ApiError } from '../../services/apiClient';
import { updateOdometer } from '../../services/vehiclesService';
import type { OdometerResult } from '../../services/vehiclesService';
import type { Vehicle } from '../../types/domain';
import { numberFormatter } from '../../utils/maintenanceFormat';
import { CloseIcon } from '../icons';
import '../../styles/dashboard.css';

interface UpdateOdometerModalProps {
  vehicle: Vehicle;
  onClose: () => void;
  onUpdated: (result: OdometerResult) => void;
}

/**
 * Cargar el kilometraje actual de un vehículo (CAM-18): no toca ningún plan
 * de mantenimiento directamente, solo actualiza la referencia contra la que
 * se calcula el estado de los planes por km -- ver PATCH /api/vehicles/{id}/odometer.
 */
export function UpdateOdometerModal({ vehicle, onClose, onUpdated }: UpdateOdometerModalProps) {
  const currentKm = vehicle.odometerKm ?? 0;
  const [odometerKm, setOdometerKm] = useState(String(currentKm));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = odometerKm.trim() !== '' && Number(odometerKm) >= 0;

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const result = await updateOdometer(vehicle.id, Number(odometerKm));
      onUpdated(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar el kilometraje. Intentá de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal modal--narrow">
        <header className="modal__header">
          <div>
            <h2 className="modal__title">Cargar kilometraje</h2>
            <p className="modal__subtitle">{vehicle.plate}</p>
          </div>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Cerrar">
            <CloseIcon width={18} height={18} />
          </button>
        </header>

        <div className="modal__body">
          <p className="muted">Actual: {numberFormatter.format(currentKm)} km</p>

          <label className="schedule-picker__field">
            Kilometraje nuevo
            <input
              type="number"
              min={currentKm}
              className="schedule-picker__input"
              value={odometerKm}
              onChange={(e) => setOdometerKm(e.target.value)}
              placeholder="Ej: 45000"
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
