import { useRef, useState } from 'react';
import { ApiError } from '../services/apiClient';
import { ACCEPTED_PHOTO_TYPES, uploadDefectPhoto } from '../services/photosService';
import type { DefectSeverity } from '../types/domain';
import type { DefectFieldsValue } from '../utils/defectValidation';
import { AlertTriangleIcon, CameraIcon } from './icons';
import { CharCounter } from './CharCounter';
import { DictatedTextarea } from './DictatedTextarea';
import { DESCRIPTION_MAX_LENGTH, TITLE_MAX_LENGTH } from '../utils/textLimits';

interface DefectFieldsProps {
  /** Prefijo de los id de los campos, único en la pantalla. */
  idPrefix: string;
  value: DefectFieldsValue;
  onChange: (next: DefectFieldsValue) => void;
  /** Muestra el aviso de lo que falta (título, o foto si es bloqueante). */
  invalid?: boolean;
}

/**
 * La carga de un defecto: gravedad, título, descripción dictable y foto. La usan el checklist
 * (ChecklistItemCard) y el reporte durante el viaje (CAM-139, RoadDefectForm).
 */
export function DefectFields({ idPrefix, value, onChange, invalid }: DefectFieldsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const { defect, uploading } = value;

  function setSeverity(severity: DefectSeverity) {
    onChange({ ...value, defect: { ...defect, severity } });
  }

  function setDescription(description: string) {
    onChange({ ...value, defect: { ...defect, description } });
  }

  function setDetails(details: string) {
    onChange({ ...value, defect: { ...defect, details } });
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError(null);
    onChange({ ...value, uploading: true });
    try {
      const { photoUrl } = await uploadDefectPhoto(file);
      onChange({ ...value, defect: { ...defect, photoUrl }, uploading: false });
    } catch (err) {
      setPhotoError(err instanceof ApiError ? err.message : 'No se pudo subir la foto. Probá de nuevo.');
      onChange({ ...value, uploading: false });
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function removePhoto() {
    onChange({ ...value, defect: { ...defect, photoUrl: undefined } });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
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
        <label className="defect-panel__field-label" htmlFor={`${idPrefix}-desc`}>
          Título (obligatorio)
        </label>
        <input
          id={`${idPrefix}-desc`}
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
        <label className="defect-panel__field-label" htmlFor={`${idPrefix}-details`}>
          Descripción (opcional)
        </label>
        <DictatedTextarea
          id={`${idPrefix}-details`}
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
        {uploading ? (
          <span className="muted">Subiendo…</span>
        ) : defect.photoUrl ? (
          <div className="photo-preview">
            <img src={defect.photoUrl} alt="Foto del defecto reportado" />
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

      {invalid && (
        <p className="field-error">
          {defect.severity === 'blocking'
            ? 'Los defectos bloqueantes necesitan foto y descripción.'
            : 'Agregá una descripción del defecto.'}
        </p>
      )}
    </div>
  );
}
