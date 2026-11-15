import { useState } from 'react';
import { ApiError } from '../../services/apiClient';
import { createFuelLoad, updateFuelLoad } from '../../services/fuelService';
import type { FuelLoad } from '../../types/domain';
import { toLocalDateTimeInput } from '../../utils/fuelFormat';
import { isFuelLoadValid, toFuelInput, type FuelLoadFieldsValue } from '../../utils/fuelForm';
import { FuelLoadFields } from '../FuelLoadFields';
import { CloseIcon } from '../icons';
import '../../styles/dashboard.css';

interface FuelLoadFormModalProps {
  vehicleId: string;
  plate: string;
  currentKm?: number;
  /** Si viene, la corrige; si no, registra una nueva. */
  load?: FuelLoad;
  onClose: () => void;
  onSaved: (load: FuelLoad) => void;
}

/** CAM-156: el admin registra o corrige una carga. Corregirla no mueve el odómetro ni vuelve a avisar. */
export function FuelLoadFormModal({ vehicleId, plate, currentKm, load, onClose, onSaved }: FuelLoadFormModalProps) {
  const [value, setValue] = useState<FuelLoadFieldsValue>(() => ({
    loadedAt: toLocalDateTimeInput(load ? new Date(load.loadedAt) : new Date()),
    odometerKm: load ? String(load.odometerKm) : '',
    liters: load ? String(load.liters) : '',
    amount: load ? String(load.amount) : '',
    fullTank: load?.fullTank ?? true,
  }));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const input = toFuelInput(vehicleId, value);
      onSaved(load ? await updateFuelLoad(load.id, input) : await createFuelLoad(input));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar la carga. Intentá de nuevo.');
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="fuel-form-title">
      <div className="modal modal--narrow">
        <header className="modal__header">
          <div>
            <h2 className="modal__title" id="fuel-form-title">
              {load ? 'Corregir carga de combustible' : 'Cargar combustible'}
            </h2>
            <p className="modal__subtitle">{plate}</p>
          </div>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Cerrar">
            <CloseIcon width={18} height={18} />
          </button>
        </header>

        <div className="modal__body">
          <FuelLoadFields
            idPrefix="fuel-modal"
            value={value}
            onChange={setValue}
            currentKm={currentKm}
            inputClassName="schedule-picker__input"
            fieldClassName="schedule-picker__field"
          />
          {error && <p className="error-banner">{error}</p>}
        </div>

        <footer className="modal__footer">
          <button type="button" className="secondary-btn" onClick={onClose} disabled={submitting}>
            Cancelar
          </button>
          <button type="button" className="primary-btn" onClick={handleSubmit} disabled={submitting || !isFuelLoadValid(value)}>
            {submitting ? 'Guardando…' : 'Guardar'}
          </button>
        </footer>
      </div>
    </div>
  );
}
