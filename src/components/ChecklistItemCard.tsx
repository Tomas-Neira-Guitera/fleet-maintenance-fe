import { useRef, useState } from 'react';
import { ApiError, isNetworkError } from '../services/apiClient';
import { ACCEPTED_PHOTO_TYPES, uploadDefectPhoto } from '../services/photosService';
import type { ChecklistItemDef, ChecklistItemState, DefectSeverity } from '../types/domain';
import { AlertTriangleIcon, CameraIcon } from './icons';
import { CharCounter } from './CharCounter';
import { DictatedTextarea } from './DictatedTextarea';
import { DESCRIPTION_MAX_LENGTH, TITLE_MAX_LENGTH } from '../utils/textLimits';
import { hasPhoto } from '../utils/defectPhoto';

interface ChecklistItemCardProps {
  def: ChecklistItemDef;
  state: ChecklistItemState;
  onChange: (next: ChecklistItemState) => void;
  showValidation?: boolean;
}

function isDefectValid(state: ChecklistItemState): boolean {
  if (state.outcome !== 'defect') return true;
  const defect = state.defect;
  if (!defect) return false;
  if (!defect.description.trim()) return false;
  if (defect.severity === 'blocking' && (!hasPhoto(defect) || state.uploading)) return false;
  return true;
}

export function ChecklistItemCard({ def, state, onChange, showValidation }: ChecklistItemCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  if (def.type === 'number') {
    const invalid = Boolean(showValidation && def.required && !state.numberValue?.trim());
    return (
      <div className={`checklist-item${invalid ? ' checklist-item--invalid' : ''}`}>
        <label className="checklist-item__label" htmlFor={def.id}>
          {def.label}
        </label>
        <input
          id={def.id}
          className="number-input"
          type="number"
          inputMode="numeric"
          min={0}
          placeholder="0"
          value={state.numberValue ?? ''}
          onChange={(e) => onChange({ ...state, numberValue: e.target.value })}
        />
        {invalid && <p className="field-error">Este campo es obligatorio.</p>}
      </div>
    );
  }

  // CAM-94: un solo interruptor. Arranca en OK; al pasarlo a "con defecto" se despliega la carga.
  const hasDefect = state.outcome === 'defect';
  const defect = state.defect;
  const invalidDefect = Boolean(showValidation && !isDefectValid(state));

  function toggleOutcome() {
    if (hasDefect) {
      // Lo ya cargado del defecto se conserva por si el chofer apagó el interruptor sin querer;
      // con el ítem en OK no se envía (inspectionsService).
      onChange({ ...state, outcome: 'ok' });
    } else {
      onChange({ ...state, outcome: 'defect', defect: state.defect ?? { severity: 'non-blocking', description: '' } });
    }
  }

  function setSeverity(severity: DefectSeverity) {
    if (!defect) return;
    onChange({ ...state, defect: { ...defect, severity } });
  }

  function setDescription(description: string) {
    if (!defect) return;
    onChange({ ...state, defect: { ...defect, description } });
  }

  function setDetails(details: string) {
    if (!defect) return;
    onChange({ ...state, defect: { ...defect, details } });
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !defect) return;
    setPhotoError(null);
    // CAM-153: sin señal la foto queda en el celular y se sube al mandar la inspección.
    const keepLocally = () =>
      onChange({
        ...state,
        defect: { ...defect, photoUrl: undefined, pendingPhoto: file, pendingPhotoPreview: URL.createObjectURL(file) },
        uploading: false,
      });
    if (!navigator.onLine && file.type && ACCEPTED_PHOTO_TYPES.split(',').includes(file.type)) {
      keepLocally();
      return;
    }
    onChange({ ...state, uploading: true });
    try {
      const { photoUrl } = await uploadDefectPhoto(file);
      onChange({ ...state, defect: { ...defect, photoUrl }, uploading: false });
    } catch (err) {
      if (isNetworkError(err)) {
        keepLocally();
        return;
      }
      setPhotoError(err instanceof ApiError ? err.message : 'No se pudo subir la foto. Probá de nuevo.');
      onChange({ ...state, uploading: false });
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function removePhoto() {
    if (!defect) return;
    if (defect.pendingPhotoPreview) URL.revokeObjectURL(defect.pendingPhotoPreview);
    onChange({ ...state, defect: { ...defect, photoUrl: undefined, pendingPhoto: undefined, pendingPhotoPreview: undefined } });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div
      className={`checklist-item checklist-item--toggle${hasDefect ? ' checklist-item--expanded' : ''}${invalidDefect ? ' checklist-item--invalid' : ''}`}
    >
      <div className="checklist-item__head">
        <span className="checklist-item__label">{def.label}</span>
        <button
          type="button"
          role="switch"
          aria-checked={hasDefect}
          aria-label={`${def.label}: reportar defecto`}
          className={`outcome-switch${hasDefect ? ' outcome-switch--defect' : ''}`}
          onClick={toggleOutcome}
        >
          <span className="outcome-switch__state">
            {hasDefect && <AlertTriangleIcon className="outcome-switch__icon" />}
            {hasDefect ? 'Reportar defecto' : 'OK'}
          </span>
          <span className="outcome-switch__track" aria-hidden="true">
            <span className="outcome-switch__thumb" />
          </span>
        </button>
      </div>

      {hasDefect && defect && (
        <div className="defect-panel">
          <div className="defect-panel__field">
            <span className="defect-panel__field-label">Gravedad</span>
            <div className="severity-toggle">
              <button
                type="button"
                className={`severity-btn severity-btn--non-blocking${defect.severity === 'non-blocking' ? ' severity-btn--active' : ''}`}
                onClick={() => setSeverity('non-blocking')}
                aria-pressed={defect.severity === 'non-blocking'}
              >
                No bloqueante
              </button>
              <button
                type="button"
                className={`severity-btn severity-btn--blocking${defect.severity === 'blocking' ? ' severity-btn--active' : ''}`}
                onClick={() => setSeverity('blocking')}
                aria-pressed={defect.severity === 'blocking'}
              >
                <AlertTriangleIcon className="severity-btn__icon" />
                Bloqueante
              </button>
            </div>
          </div>

          <div className="defect-panel__field">
            <label className="defect-panel__field-label" htmlFor={`${def.id}-desc`}>
              Título (obligatorio)
            </label>
            <input
              id={`${def.id}-desc`}
              type="text"
              className="defect-textarea"
              maxLength={TITLE_MAX_LENGTH}
              placeholder="Ej: Foco trasero quemado"
              value={defect.description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <CharCounter value={defect.description} />
          </div>

          <div className="defect-panel__field">
            <label className="defect-panel__field-label" htmlFor={`${def.id}-details`}>
              Descripción (opcional)
            </label>
            <DictatedTextarea
              id={`${def.id}-details`}
              value={defect.details ?? ''}
              onChange={setDetails}
              maxLength={DESCRIPTION_MAX_LENGTH}
              placeholder="Contá qué pasa. Podés dictarlo con el micrófono."
            />
          </div>

          <div className="defect-panel__field">
            <span className="defect-panel__field-label">
              Foto {defect.severity === 'blocking' ? '(obligatoria)' : '(opcional)'}
            </span>
            {state.uploading ? (
              <span className="muted">Subiendo…</span>
            ) : defect.photoUrl || defect.pendingPhoto ? (
              <div className="photo-preview">
                <img src={defect.photoUrl ?? defect.pendingPhotoPreview} alt="Foto del defecto reportado" />
                {!defect.photoUrl && <p className="photo-preview__pending">Sin señal: la foto se sube al mandar la inspección.</p>}
                <button type="button" className="photo-preview__remove" onClick={removePhoto}>
                  Quitar foto
                </button>
              </div>
            ) : (
              <button type="button" className="photo-attach-btn" onClick={() => fileInputRef.current?.click()}>
                <CameraIcon className="photo-attach-btn__icon" />
                Adjuntar foto
              </button>
            )}
            {photoError && <p className="field-error">{photoError}</p>}
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_PHOTO_TYPES}
              capture="environment"
              className="visually-hidden"
              onChange={handlePhotoChange}
            />
          </div>

          {invalidDefect && (
            <p className="field-error">
              {defect.severity === 'blocking'
                ? 'Los defectos bloqueantes necesitan foto y descripción.'
                : 'Agregá una descripción del defecto.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
