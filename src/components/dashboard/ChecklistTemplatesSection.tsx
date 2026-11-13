import { useEffect, useState } from 'react';
import { ApiError } from '../../services/apiClient';
import { deleteChecklistTemplate, getChecklistTemplates } from '../../services/checklistTemplatesService';
import type { ChecklistTemplate } from '../../types/domain';
import { ArrowLeftIcon, PencilIcon, TrashIcon } from '../icons';
import { ApplyChecklistTemplateModal } from './ApplyChecklistTemplateModal';
import { ChecklistTemplateFormModal } from './ChecklistTemplateFormModal';
import '../../styles/dashboard.css';
import '../../styles/checklistTemplates.css';

interface ChecklistTemplatesSectionProps {
  onBack: () => void;
}

/**
 * CAM-150: plantillas de checklist, dentro de Vehículos. Aplicar copia los controles a cada vehículo:
 * editar o borrar la plantilla después no cambia lo que ya se copió.
 */
export function ChecklistTemplatesSection({ onBack }: ChecklistTemplatesSectionProps) {
  const [templates, setTemplates] = useState<ChecklistTemplate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ChecklistTemplate | 'new' | null>(null);
  const [applying, setApplying] = useState<ChecklistTemplate | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getChecklistTemplates()
      .then((loaded) => {
        if (!cancelled) setTemplates(loaded);
      })
      .catch(() => {
        if (!cancelled) setError('No se pudieron cargar las plantillas. Intentá de nuevo.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleSaved(saved: ChecklistTemplate) {
    setTemplates((prev) => {
      const others = (prev ?? []).filter((t) => t.id !== saved.id);
      return [...others, saved].sort((a, b) => a.name.localeCompare(b.name, 'es'));
    });
    setEditing(null);
  }

  async function handleDelete(template: ChecklistTemplate) {
    if (
      !window.confirm(
        `¿Borrar la plantilla "${template.name}"? Los controles que ya copiaste siguen en los vehículos.`,
      )
    )
      return;
    setBusyId(template.id);
    setError(null);
    try {
      await deleteChecklistTemplate(template.id);
      setTemplates((prev) => prev?.filter((t) => t.id !== template.id) ?? prev);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo borrar la plantilla. Intentá de nuevo.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="fleet-status checklist-templates">
      <button type="button" className="top-nav__back" onClick={onBack}>
        <ArrowLeftIcon width={16} height={16} />
        Volver
      </button>
      <header className="fleet-status__header">
        <h1 className="fleet-status__title">Plantillas de checklist</h1>
        <button type="button" className="primary-btn vehicles-section__new-btn" onClick={() => setEditing('new')}>
          + Nueva plantilla
        </button>
      </header>
      <p className="vehicle-detail__item-meta">
        Armá una lista de controles y copiala a varios vehículos de una vez. Cada vehículo se queda con su copia.
      </p>

      {error && <p className="error-banner">{error}</p>}
      {!templates && !error && <p className="muted">Cargando plantillas…</p>}
      {templates?.length === 0 && (
        <p className="muted">Todavía no hay plantillas. Creá una con los controles que se repiten en tu flota.</p>
      )}

      {templates && templates.length > 0 && (
        <ul className="checklist-templates__list">
          {templates.map((template) => (
            <li key={template.id} className="vehicle-detail__card checklist-templates__card">
              <header className="checklist-templates__card-header">
                <h2 className="vehicle-detail__card-title">{template.name}</h2>
                <span className="vehicle-detail__item-meta">
                  {template.items.length} {template.items.length === 1 ? 'control' : 'controles'}
                </span>
              </header>
              <ul className="checklist-templates__items">
                {template.items.map((item) => (
                  <li key={item.id}>
                    {item.label}
                    <span className="vehicle-detail__item-meta">
                      {item.section === 'exterior' ? 'Exterior' : 'Cabina'}
                      {item.type === 'number' ? ' · número' : ''}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="checklist-templates__actions">
                <button type="button" className="primary-btn" onClick={() => setApplying(template)}>
                  Aplicar a vehículos
                </button>
                <button type="button" className="vehicle-detail__action-btn" onClick={() => setEditing(template)}>
                  <PencilIcon width={14} height={14} />
                  Editar
                </button>
                <button
                  type="button"
                  className="vehicle-detail__action-btn vehicle-detail__action-btn--danger"
                  onClick={() => handleDelete(template)}
                  disabled={busyId === template.id}
                >
                  <TrashIcon width={14} height={14} />
                  Borrar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <ChecklistTemplateFormModal
          template={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}
      {applying && <ApplyChecklistTemplateModal template={applying} onClose={() => setApplying(null)} />}
    </section>
  );
}
