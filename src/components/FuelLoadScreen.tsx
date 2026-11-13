import { useState } from 'react';
import { ApiError, describeApiError, isSessionExpired, SESSION_EXPIRED_MESSAGE } from '../services/apiClient';
import { createFuelLoad } from '../services/fuelService';
import type { Vehicle } from '../types/domain';
import { formatLiters, toLocalDateTimeInput } from '../utils/fuelFormat';
import { isFuelLoadValid, toFuelInput, type FuelLoadFieldsValue } from '../utils/fuelForm';
import { FuelLoadFields } from './FuelLoadFields';

interface FuelLoadScreenProps {
  vehicle: Vehicle;
  /** Vuelve a la flota con la confirmación. */
  onDone: (message: string) => void;
  onBack: () => void;
  /** El vehículo ya no acepta cargas (409, dado de baja): se vuelve a la flota con el motivo. */
  onUnavailable: (message: string) => void;
  onLogout: () => void;
}

/** CAM-156: el chofer carga combustible desde el celular. Necesita señal: no entra en la cola sin conexión. */
export function FuelLoadScreen({ vehicle, onDone, onBack, onUnavailable, onLogout }: FuelLoadScreenProps) {
  const [value, setValue] = useState<FuelLoadFieldsValue>(() => ({
    loadedAt: toLocalDateTimeInput(new Date()),
    odometerKm: '',
    liters: '',
    amount: '',
    fullTank: true,
  }));
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  const valid = isFuelLoadValid(value);

  async function handleSubmit() {
    if (!valid) {
      setShowValidation(true);
      return;
    }
    if (!navigator.onLine) {
      setSubmitError('Sin conexión. La carga de combustible necesita señal: intentá de nuevo cuando vuelva.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      // La hora es la del envío, no la de cuando abrió la pantalla.
      const load = await createFuelLoad(toFuelInput(vehicle.id, { ...value, loadedAt: toLocalDateTimeInput(new Date()) }));
      onDone(`Carga de ${formatLiters(load.liters)} registrada en ${vehicle.plate}.`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        onUnavailable(`No se registró la carga: ${err.message}`);
      } else if (isSessionExpired(err)) {
        setSessionExpired(true);
      } else {
        setSubmitError(describeApiError(err, 'No se pudo registrar la carga. Intentá de nuevo.'));
      }
      setSubmitting(false);
    }
  }

  return (
    <div className="screen">
      <header className="screen__header">
        <h1 className="screen__title">Cargar combustible</h1>
        <p className="screen__subtitle vehicle-meta">
          <span className="vehicle-meta__plate">{vehicle.plate}</span> · {vehicle.brand} {vehicle.model}
        </p>
      </header>

      <section className="checklist-section">
        <div className={`checklist-item fuel-form${showValidation && !valid ? ' checklist-item--invalid' : ''}`}>
          <FuelLoadFields
            idPrefix="fuel-load"
            value={value}
            onChange={setValue}
            currentKm={vehicle.odometerKm}
            inputClassName="number-input"
            fieldClassName="fuel-form__field"
            showDate={false}
          />
          {showValidation && !valid && <p className="field-error">Completá los km, los litros y el monto.</p>}
        </div>
      </section>

      {submitError && <p className="error-banner">{submitError}</p>}
      {sessionExpired && (
        <div className="error-banner session-expired">
          <p>{SESSION_EXPIRED_MESSAGE}</p>
          <button type="button" className="secondary-btn" onClick={onLogout}>
            Cerrar sesión
          </button>
        </div>
      )}

      <div className="screen__actions">
        <button type="button" className="secondary-btn" onClick={onBack} disabled={submitting}>
          Volver
        </button>
        <button type="button" className="primary-btn" onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Enviando…' : 'Registrar carga'}
        </button>
      </div>
    </div>
  );
}
