import { useState } from 'react';
import { ApiError } from '../../services/apiClient';
import { createVehicle, updateVehicle } from '../../services/vehiclesService';
import type { Vehicle } from '../../types/domain';
import { CloseIcon } from '../icons';
import '../../styles/dashboard.css';

interface VehicleFormModalProps {
  /** Si viene, edita ese vehículo; si no, da de alta uno nuevo. */
  vehicle?: Vehicle;
  onClose: () => void;
  onSaved: (vehicle: Vehicle) => void;
}

/**
 * Alta/edición de un vehículo (CAM-25) -- un solo formulario para las dos
 * acciones, según si `vehicle` viene o no. El kilometraje inicial solo se
 * pide en el alta: corregirlo después es tarea de PATCH /odometer, no de acá.
 */
export function VehicleFormModal({ vehicle, onClose, onSaved }: VehicleFormModalProps) {
  const isEdit = Boolean(vehicle);

  const [plate, setPlate] = useState(vehicle?.plate ?? '');
  const [brand, setBrand] = useState(vehicle?.brand ?? '');
  const [model, setModel] = useState(vehicle?.model ?? '');
  const [vehicleType, setVehicleType] = useState(vehicle?.vehicleType ?? '');
  const [year, setYear] = useState(vehicle?.year != null ? String(vehicle.year) : '');
  const [chassisNumber, setChassisNumber] = useState(vehicle?.chassisNumber ?? '');
  const [odometerKm, setOdometerKm] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = Boolean(plate.trim()) && Boolean(brand.trim()) && Boolean(model.trim());

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        plate: plate.trim(),
        brand: brand.trim(),
        model: model.trim(),
        vehicleType: vehicleType.trim() || undefined,
        year: year.trim() ? Number(year) : undefined,
        chassisNumber: chassisNumber.trim() || undefined,
      };
      const saved =
        isEdit && vehicle
          ? await updateVehicle(vehicle.id, payload)
          : await createVehicle({ ...payload, odometerKm: odometerKm.trim() ? Number(odometerKm) : undefined });
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
          <h2 className="modal__title">{isEdit ? 'Editar vehículo' : 'Nuevo vehículo'}</h2>
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
            Tipo (opcional)
            <input
              type="text"
              className="schedule-picker__input"
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value)}
              placeholder="Ej: furgón"
            />
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
