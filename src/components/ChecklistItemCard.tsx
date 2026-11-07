import type { ChecklistItemDef, ChecklistItemState } from '../types/domain';
import { AlertTriangleIcon } from './icons';
import { DefectFields } from './DefectFields';
import { isDefectDetailValid } from '../utils/defectValidation';

interface ChecklistItemCardProps {
  def: ChecklistItemDef;
  state: ChecklistItemState;
  onChange: (next: ChecklistItemState) => void;
  showValidation?: boolean;
}

function isDefectValid(state: ChecklistItemState): boolean {
  if (state.outcome !== 'defect') return true;
  if (!state.defect) return false;
  return isDefectDetailValid({ defect: state.defect, uploading: state.uploading });
}

export function ChecklistItemCard({ def, state, onChange, showValidation }: ChecklistItemCardProps) {
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
        <DefectFields
          idPrefix={def.id}
          value={{ defect, uploading: state.uploading }}
          onChange={(next) => onChange({ ...state, defect: next.defect, uploading: next.uploading })}
          invalid={invalidDefect}
        />
      )}
    </div>
  );
}
