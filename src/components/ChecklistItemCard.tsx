import { useRef } from 'react';
import type { ChecklistItemDef, ChecklistItemState, DefectSeverity } from '../types/domain';
import { AlertTriangleIcon, CameraIcon } from './icons';

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
  if (defect.severity === 'blocking' && !defect.photoDataUrl) return false;
  return true;
}

export function ChecklistItemCard({ def, state, onChange, showValidation }: ChecklistItemCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const outcome = state.outcome;
  const defect = state.defect;
  const invalidDefect = Boolean(showValidation && !isDefectValid(state));
  const invalidOutcome = Boolean(showValidation && !outcome);

  function setOutcomeOk() {
    onChange({ outcome: 'ok' });
  }

  function setOutcomeDefect() {
    onChange({
      outcome: 'defect',
      defect: state.defect ?? { severity: 'non-blocking', description: '' },
    });
  }

  function setSeverity(severity: DefectSeverity) {
    if (!defect) return;
    onChange({ ...state, defect: { ...defect, severity } });
  }

  function setDescription(description: string) {
    if (!defect) return;
    onChange({ ...state, defect: { ...defect, description } });
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !defect) return;
    const reader = new FileReader();
    reader.onload = () => {
      onChange({
        ...state,
        defect: { ...defect, photoDataUrl: String(reader.result), photoFileName: file.name },
      });
    };
    reader.readAsDataURL(file);
  }

  function removePhoto() {
    if (!defect) return;
    onChange({ ...state, defect: { ...defect, photoDataUrl: undefined, photoFileName: undefined } });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div
      className={`checklist-item${outcome === 'defect' ? ' checklist-item--expanded' : ''}${invalidOutcome ? ' checklist-item--invalid' : ''}`}
    >
      <span className="checklist-item__label">{def.label}</span>
      <div className="checklist-item__actions">
        <button
          type="button"
          className={`outcome-btn outcome-btn--ok${outcome === 'ok' ? ' outcome-btn--active' : ''}`}
          onClick={setOutcomeOk}
          aria-pressed={outcome === 'ok'}
        >
          OK
        </button>
        <button
          type="button"
          className={`outcome-btn outcome-btn--defect${outcome === 'defect' ? ' outcome-btn--active' : ''}`}
          onClick={setOutcomeDefect}
          aria-pressed={outcome === 'defect'}
        >
          <AlertTriangleIcon className="outcome-btn__icon" />
          Reportar defecto
        </button>
      </div>
      {invalidOutcome && <p className="field-error">Marcá OK o reportá un defecto.</p>}

      {outcome === 'defect' && defect && (
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
              Descripción {defect.severity === 'blocking' ? '(obligatoria)' : '(obligatoria)'}
            </label>
            <textarea
              id={`${def.id}-desc`}
              className="defect-textarea"
              rows={3}
              placeholder="Describí brevemente el problema"
              value={defect.description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="defect-panel__field">
            <span className="defect-panel__field-label">
              Foto {defect.severity === 'blocking' ? '(obligatoria)' : '(opcional)'}
            </span>
            {defect.photoDataUrl ? (
              <div className="photo-preview">
                <img src={defect.photoDataUrl} alt="Foto del defecto reportado" />
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
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
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
