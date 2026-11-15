import { useEffect, useState } from 'react';
import { getPreTripItems } from '../checklist/checklistDefinitions';
import { ApiError, describeApiError, isSessionExpired, SESSION_EXPIRED_MESSAGE } from '../services/apiClient';
import { getVehicleChecklist } from '../services/checklistService';
import { reportRoadDefect } from '../services/defectsService';
import { ROAD_OTHER_ITEM_ID, type ChecklistItemDef, type Vehicle } from '../types/domain';
import { DefectFields } from './DefectFields';
import { isDefectDetailValid, type DefectFieldsValue } from '../utils/defectValidation';
import { AlertOctagonIcon, ShieldCheckIcon } from './icons';

interface RoadDefectFormProps {
  vehicle: Vehicle;
  /** Vuelve a la flota después de reportar. */
  onDone: () => void;
  onBack: () => void;
  /** El backend no deja reportar (409: sin viaje abierto o el viaje es de otro): se vuelve a la flota con el motivo. */
  onUnavailable: (message: string) => void;
  onLogout: () => void;
}

interface ReportableItem {
  id: string;
  label: string;
}

/** Los controles sí/no del pre-viaje del vehículo, y al final "Otro problema" (CAM-139). */
function toReportable(items: ChecklistItemDef[]): ReportableItem[] {
  return [
    ...items.filter((item) => item.type === 'check').map(({ id, label }) => ({ id, label })),
    { id: ROAD_OTHER_ITEM_ID, label: 'Otro problema' },
  ];
}

/**
 * CAM-139: con su viaje abierto, el chofer reporta un problema en el momento, sin cerrar el viaje. El
 * defecto se carga igual que en el checklist; el viaje se cierra después con el post-viaje.
 */
export function RoadDefectForm({ vehicle, onDone, onBack, onUnavailable, onLogout }: RoadDefectFormProps) {
  const [items, setItems] = useState<ReportableItem[] | null>(null);
  const [itemId, setItemId] = useState('');
  const [value, setValue] = useState<DefectFieldsValue>({ defect: { severity: 'non-blocking', description: '' } });
  const [showValidation, setShowValidation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [reportedBlocking, setReportedBlocking] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    getVehicleChecklist(vehicle.id, 'pre-trip')
      .then((loaded) => {
        if (!cancelled) setItems(toReportable(loaded));
      })
      .catch(() => {
        // Igual que en la inspección: sin el checklist del vehículo, el base.
        if (!cancelled) setItems(toReportable(getPreTripItems()));
      });
    return () => {
      cancelled = true;
    };
  }, [vehicle.id]);

  const itemMissing = !itemId;
  const defectInvalid = !isDefectDetailValid(value);

  async function handleSubmit() {
    if (itemMissing || defectInvalid) {
      setShowValidation(true);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const defect = await reportRoadDefect(vehicle.id, itemId, value.defect);
      setReportedBlocking(defect.severity === 'blocking');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        onUnavailable(`No se reportó el problema: ${err.message}`);
      } else if (isSessionExpired(err)) {
        setSessionExpired(true);
      } else {
        setSubmitError(describeApiError(err, 'No se pudo reportar el problema. Intentá de nuevo.'));
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (reportedBlocking !== null) {
    return (
      <div className="screen screen--success">
        <div className={`success-icon ${reportedBlocking ? 'success-icon--crit' : 'success-icon--ok'}`}>
          {reportedBlocking ? <AlertOctagonIcon /> : <ShieldCheckIcon />}
        </div>
        <h1 className="screen__title">Problema reportado</h1>
        <p className="screen__subtitle">
          {reportedBlocking
            ? `Se avisó al administrador. ${vehicle.plate} queda no disponible hasta que se resuelva.`
            : `El administrador ya lo puede ver. Tu viaje con ${vehicle.plate} sigue abierto.`}
        </p>
        {reportedBlocking && (
          <div className="alert alert--critical">
            <AlertOctagonIcon className="alert__icon" />
            <span>
              Si no es seguro seguir, detenete en un lugar seguro y esperá indicaciones. Al terminar, cerrá el viaje
              con el post-viaje, como siempre.
            </span>
          </div>
        )}
        <button type="button" className="primary-btn" onClick={onDone}>
          Volver a la flota
        </button>
      </div>
    );
  }

  return (
    <div className="screen">
      <header className="screen__header">
        <h1 className="screen__title">Reportar un problema</h1>
        <p className="screen__subtitle vehicle-meta">
          <span className="vehicle-meta__plate">{vehicle.plate}</span> · El viaje sigue abierto
        </p>
      </header>

      {!items ? (
        <p className="muted">Cargando…</p>
      ) : (
        <section className="checklist-section">
          <div className={`checklist-item${showValidation && itemMissing ? ' checklist-item--invalid' : ''}`}>
            <label className="checklist-item__label" htmlFor="road-defect-item">
              ¿Qué falla?
            </label>
            <select
              id="road-defect-item"
              className="number-input road-defect__select"
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
            >
              <option value="">Elegí una opción</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            {showValidation && itemMissing && <p className="field-error">Elegí qué falla.</p>}
          </div>

          <div className={`checklist-item${showValidation && defectInvalid ? ' checklist-item--invalid' : ''}`}>
            <DefectFields
              idPrefix="road-defect"
              value={value}
              onChange={setValue}
              invalid={showValidation && defectInvalid}
            />
          </div>
        </section>
      )}

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
        <button
          type="button"
          className="primary-btn"
          onClick={handleSubmit}
          disabled={!items || submitting || value.uploading}
        >
          {submitting ? 'Enviando…' : 'Reportar'}
        </button>
      </div>
    </div>
  );
}
