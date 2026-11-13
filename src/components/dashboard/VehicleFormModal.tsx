import { useEffect, useState } from 'react';
import { ApiError } from '../../services/apiClient';
import { getChecklistTemplates } from '../../services/checklistTemplatesService';
import { createVehicle, updateVehicle } from '../../services/vehiclesService';
import type { ChecklistTemplate, Vehicle } from '../../types/domain';
import { VEHICLE_TYPES, isTrailer, vehicleTypeDef } from '../../utils/vehicleTypes';
import { CloseIcon } from '../icons';
import '../../styles/dashboard.css';

interface VehicleFormModalProps {
  /** Si viene, edita ese vehículo; si no, da de alta uno nuevo. */
  vehicle?: Vehicle;
  /** CAM-157: en el alta, si es un remolque (solo ofrece esos tipos). Al editar sale del tipo que tiene. */
  trailer?: boolean;
  onClose: () => void;
  onSaved: (vehicle: Vehicle) => void;
}

/**
 * Alta/edición de un vehículo (CAM-25) -- un solo formulario para las dos
 * acciones, según si `vehicle` viene o no. El kilometraje inicial solo se
 * pide en el alta: corregirlo después es tarea de PATCH /odometer, no de acá.
 */
export function VehicleFormModal({ vehicle, trailer = false, onClose, onSaved }: VehicleFormModalProps) {
  const isEdit = Boolean(vehicle);
  // Un vehículo viejo sin tipo del catálogo puede elegir cualquiera; si no, se queda en su grupo.
  const currentType = vehicleTypeDef(vehicle?.vehicleType);
  const asTrailer = currentType ? isTrailer(currentType.code) : trailer;
  const typeOptions = isEdit && !currentType ? VEHICLE_TYPES : VEHICLE_TYPES.filter((t) => isTrailer(t.code) === asTrailer);
  const noun = asTrailer ? 'remolque' : 'vehículo';

  const [plate, setPlate] = useState(vehicle?.plate ?? '');
  const [brand, setBrand] = useState(vehicle?.brand ?? '');
  const [model, setModel] = useState(vehicle?.model ?? '');
  // CAM-157: del catálogo; un tipo viejo de texto libre llega sin código y hay que elegirlo.
  const [vehicleType, setVehicleType] = useState(vehicleTypeDef(vehicle?.vehicleType)?.code ?? '');
  const [year, setYear] = useState(vehicle?.year != null ? String(vehicle.year) : '');
  const [chassisNumber, setChassisNumber] = useState(vehicle?.chassisNumber ?? '');
  const [odometerKm, setOdometerKm] = useState('');
  // CAM-150: en el alta, una plantilla de checklist opcional.
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [checklistTemplateId, setChecklistTemplateId] = useState('');

  useEffect(() => {
    if (isEdit) return;
    let cancelled = false;
    // Sin plantillas (o si falla) el campo no se muestra: el alta sigue igual que antes.
    getChecklistTemplates()
      .then((loaded) => {
        if (!cancelled) setTemplates(loaded);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isEdit]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = Boolean(plate.trim()) && Boolean(brand.trim()) && Boolean(model.trim()) && Boolean(vehicleType);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        plate: plate.trim(),
        brand: brand.trim(),
        model: model.trim(),
        vehicleType: vehicleType || undefined,
        year: year.trim() ? Number(year) : undefined,
        chassisNumber: chassisNumber.trim() || undefined,
      };
      const saved =
        isEdit && vehicle
          ? await updateVehicle(vehicle.id, payload)
          : await createVehicle({
              ...payload,
              odometerKm: odometerKm.trim() ? Number(odometerKm) : undefined,
              checklistTemplateId: checklistTemplateId || undefined,
            });
      onSaved(saved);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar el vehículo. Intentá de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal modal--narrow">
        <header className="modal__header">
          <h2 className="modal__title">{isEdit ? `Editar ${noun}` : `Nuevo ${noun}`}</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Cerrar">
            <CloseIcon width={18} height={18} />
          </button>
        </header>

        <div className="modal__body">
          <label className="schedule-picker__field">
            Patente
            <input
              type="text"
              className="schedule-picker__input"
              value={plate}
              onChange={(e) => setPlate(e.target.value)}
              placeholder="Ej: AB123CD"
            />
          </label>
          <label className="schedule-picker__field">
            Marca
            <input
              type="text"
              className="schedule-picker__input"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="Ej: Mercedes-Benz"
            />
          </label>
          <label className="schedule-picker__field">
            Modelo
            <input
              type="text"
              className="schedule-picker__input"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Ej: Sprinter"
            />
          </label>
          <label className="schedule-picker__field">
            Tipo
            <select
              className="schedule-picker__input"
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value)}
            >
              <option value="" disabled>
                Elegí el tipo
              </option>
              {typeOptions.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.label} — {t.hint}
                </option>
              ))}
            </select>
            <small className="vehicle-form__hint">Define sus ejes y sus cubiertas.</small>
          </label>
          <label className="schedule-picker__field">
            Año (opcional)
            <input
              type="number"
              className="schedule-picker__input"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="Ej: 2022"
            />
          </label>
          <label className="schedule-picker__field">
            Número de chasis (opcional)
            <input
              type="text"
              className="schedule-picker__input"
              value={chassisNumber}
              onChange={(e) => setChassisNumber(e.target.value)}
            />
          </label>
          {!isEdit && (
            <label className="schedule-picker__field">
              Kilometraje inicial (opcional)
              <input
                type="number"
                min={0}
                className="schedule-picker__input"
                value={odometerKm}
                onChange={(e) => setOdometerKm(e.target.value)}
                placeholder="Ej: 15000"
              />
            </label>
          )}
          {!isEdit && !asTrailer && templates.length > 0 && (
            <label className="schedule-picker__field">
              Plantilla de checklist (opcional)
              <select
                className="schedule-picker__input"
                value={checklistTemplateId}
                onChange={(e) => setChecklistTemplateId(e.target.value)}
              >
                <option value="">Sin plantilla</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.items.length} {t.items.length === 1 ? 'control' : 'controles'})
                  </option>
                ))}
              </select>
            </label>
          )}

          {error && <p className="error-banner">{error}</p>}
        </div>

        <footer className="modal__footer">
          <button type="button" className="secondary-btn" onClick={onClose} disabled={submitting}>
            Cancelar
          </button>
          <button type="button" className="primary-btn" onClick={handleSubmit} disabled={submitting || !canSubmit}>
            {submitting ? 'Guardando…' : 'Guardar'}
          </button>
        </footer>
      </div>
    </div>
  );
}
