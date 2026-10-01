import { useState } from 'react';
import { ApiError } from '../../services/apiClient';
import { addVehicleChecklistItem, type NewChecklistItem } from '../../services/checklistService';
import type { VehicleChecklistItem } from '../../types/domain';
import { CHECKLIST_LABEL_MAX_LENGTH, CHECKLIST_SECTIONS } from '../../utils/checklistSections';
import { CharCounter } from '../CharCounter';
import { CloseIcon } from '../icons';
import '../../styles/dashboard.css';

interface AddChecklistItemModalProps {
  vehicleId: string;
  plate: string;
  onClose: () => void;
  onAdded: (item: VehicleChecklistItem) => void;
}

/** CAM-31: alta de un ítem extra del checklist pre-viaje de un vehículo. */
export function AddChecklistItemModal({ vehicleId, plate, onClose, onAdded }: AddChecklistItemModalProps) {
  const [label, setLabel] = useState('');
  const [type, setType] = useState<NewChecklistItem['type']>('check');
  const [section, setSection] = useState<NewChecklistItem['section']>('exterior');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      onAdded(await addVehicleChecklistItem(vehicleId, { label: label.trim(), type, section }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo agregar el ítem. Intentá de nuevo.');
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal modal--narrow">
        <header className="modal__header">
          <div>
            <h2 className="modal__title">Agregar ítem al checklist</h2>
            <p className="modal__subtitle">{plate}</p>
          </div>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Cerrar">
            <CloseIcon width={18} height={18} />
          </button>
        </header>

        <div className="modal__body">
          <label className="schedule-picker__field">
            Qué revisar
            <input
              type="text"
              className="schedule-picker__input"
              value={label}
              maxLength={CHECKLIST_LABEL_MAX_LENGTH}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ej: Estado de la faja de sujeción"
              autoFocus
            />
            <CharCounter value={label} max={CHECKLIST_LABEL_MAX_LENGTH} />
          </label>
          <label className="schedule-picker__field">
            Tipo
            <select
              className="schedule-picker__input"
              value={type}
              onChange={(e) => setType(e.target.value as NewChecklistItem['type'])}
            >
              <option value="check">OK / Defecto</option>
              <option value="number">Número</option>
            </select>
          </label>
          <label className="schedule-picker__field">
            Sección
            <select
              className="schedule-picker__input"
              value={section}
              onChange={(e) => setSection(e.target.value as NewChecklistItem['section'])}
            >
              {CHECKLIST_SECTIONS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          {error && <p className="error-banner">{error}</p>}
        </div>

        <footer className="modal__footer">
          <button type="button" className="secondary-btn" onClick={onClose} disabled={submitting}>
            Cancelar
          </button>
          <button
            type="button"
            className="primary-btn"
            onClick={handleSubmit}
            disabled={submitting || !label.trim()}
          >
            {submitting ? 'Agregando…' : 'Agregar'}
          </button>
        </footer>
      </div>
    </div>
  );
}
