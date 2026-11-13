import { useState } from 'react';
import { ApiError } from '../../services/apiClient';
import {
  createChecklistTemplate,
  updateChecklistTemplate,
  type ChecklistTemplateInput,
} from '../../services/checklistTemplatesService';
import type { ChecklistItemType, ChecklistTemplate } from '../../types/domain';
import { CHECKLIST_LABEL_MAX_LENGTH, CHECKLIST_SECTIONS } from '../../utils/checklistSections';
import { CloseIcon, PlusIcon, TrashIcon } from '../icons';
import '../../styles/dashboard.css';
import '../../styles/checklistTemplates.css';

// Igual que el backend (ChecklistTemplateService).
const TEMPLATE_NAME_MAX_LENGTH = 60;
const TEMPLATE_MAX_ITEMS = 30;

type Row = ChecklistTemplateInput['items'][number] & { key: number };

interface ChecklistTemplateFormModalProps {
  /** Si viene, la edita; si no, crea una nueva. */
  template?: ChecklistTemplate;
  onClose: () => void;
  onSaved: (template: ChecklistTemplate) => void;
}

let nextKey = 1;

function emptyRow(): Row {
  return { key: nextKey++, label: '', type: 'check', section: 'exterior' };
}

/** CAM-150: alta y edición de una plantilla. Editarla no cambia los vehículos donde ya se aplicó. */
export function ChecklistTemplateFormModal({ template, onClose, onSaved }: ChecklistTemplateFormModalProps) {
  const [name, setName] = useState(template?.name ?? '');
  const [rows, setRows] = useState<Row[]>(() =>
    template ? template.items.map((i) => ({ key: nextKey++, label: i.label, type: i.type, section: i.section })) : [emptyRow()],
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filled = rows.filter((r) => r.label.trim());
  const canSubmit = Boolean(name.trim()) && filled.length > 0 && !submitting;

  function updateRow(key: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    const input: ChecklistTemplateInput = {
      name: name.trim(),
      items: filled.map(({ label, type, section }) => ({ label: label.trim(), type, section })),
    };
    try {
      onSaved(template ? await updateChecklistTemplate(template.id, input) : await createChecklistTemplate(input));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar la plantilla. Intentá de nuevo.');
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="template-form-title">
      <div className="modal">
        <header className="modal__header">
          <div>
            <h2 className="modal__title" id="template-form-title">
              {template ? 'Editar plantilla' : 'Nueva plantilla de checklist'}
            </h2>
            {template && (
              <p className="modal__subtitle">Los vehículos donde ya la aplicaste no cambian.</p>
            )}
          </div>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Cerrar">
            <CloseIcon width={18} height={18} />
          </button>
        </header>

        <div className="modal__body">
          <label className="schedule-picker__field">
            Nombre
            <input
              type="text"
              className="schedule-picker__input"
              value={name}
              maxLength={TEMPLATE_NAME_MAX_LENGTH}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Camión frigorífico"
              autoFocus
            />
          </label>

          <fieldset className="template-form__items">
            <legend>Controles</legend>
            {rows.map((row, index) => (
              <div key={row.key} className="template-form__row">
                <input
                  type="text"
                  className="schedule-picker__input template-form__label"
                  value={row.label}
                  maxLength={CHECKLIST_LABEL_MAX_LENGTH}
                  onChange={(e) => updateRow(row.key, { label: e.target.value })}
                  placeholder="Qué revisar"
                  aria-label={`Control ${index + 1}`}
                />
                <select
                  className="schedule-picker__input"
                  value={row.section}
                  onChange={(e) => updateRow(row.key, { section: e.target.value as Row['section'] })}
                  aria-label={`Sección del control ${index + 1}`}
                >
                  {CHECKLIST_SECTIONS.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.key === 'exterior' ? 'Exterior' : 'Cabina'}
                    </option>
                  ))}
                </select>
                <select
                  className="schedule-picker__input"
                  value={row.type}
                  onChange={(e) => updateRow(row.key, { type: e.target.value as ChecklistItemType })}
                  aria-label={`Tipo del control ${index + 1}`}
                >
                  <option value="check">Bien / mal</option>
                  <option value="number">Número</option>
                </select>
                <button
                  type="button"
                  className="template-form__remove"
                  onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
                  disabled={rows.length === 1}
                  aria-label={`Quitar el control ${index + 1}`}
                >
                  <TrashIcon width={14} height={14} />
                </button>
              </div>
            ))}
            {rows.length < TEMPLATE_MAX_ITEMS && (
              <button type="button" className="vehicle-detail__action-btn" onClick={() => setRows((prev) => [...prev, emptyRow()])}>
                <PlusIcon width={14} height={14} />
                Agregar control
              </button>
            )}
          </fieldset>

          {error && <p className="error-banner">{error}</p>}
        </div>

        <footer className="modal__footer">
          <button type="button" className="secondary-btn" onClick={onClose} disabled={submitting}>
            Cancelar
          </button>
          <button type="button" className="primary-btn" onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? 'Guardando…' : 'Guardar'}
          </button>
        </footer>
      </div>
    </div>
  );
}
