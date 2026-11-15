import { useEffect, useState } from 'react';
import { ApiError } from '../../services/apiClient';
import {
  applyChecklistTemplate,
  describeApplyResult,
  getChecklistTemplates,
} from '../../services/checklistTemplatesService';
import { getVehicles } from '../../services/vehiclesService';
import type { ApplyChecklistTemplateResult, ChecklistTemplate, Vehicle } from '../../types/domain';
import { vehicleTypeLabel } from '../../utils/vehicleTypes';
import { CloseIcon } from '../icons';
import '../../styles/dashboard.css';
import '../../styles/checklistTemplates.css';

type ApplyChecklistTemplateModalProps = {
  onClose: () => void;
  /** Después de aplicar, con algo agregado o no. */
  onApplied?: (result: ApplyChecklistTemplateResult) => void;
} & (
  // Desde la sección de plantillas: la plantilla está elegida y se eligen los vehículos.
  | { template: ChecklistTemplate; vehicle?: undefined }
  // Desde el checklist de un vehículo: el vehículo está elegido y se elige la plantilla.
  | { vehicle: Pick<Vehicle, 'id' | 'plate'>; template?: undefined }
);

/** CAM-150: copia los controles de una plantilla a uno o varios vehículos activos. */
export function ApplyChecklistTemplateModal(props: ApplyChecklistTemplateModalProps) {
  const { onClose, onApplied } = props;
  const [templates, setTemplates] = useState<ChecklistTemplate[] | null>(props.template ? [props.template] : null);
  const [templateId, setTemplateId] = useState(props.template?.id ?? '');
  // Solo los activos: un vehículo dado de baja no se puede elegir.
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(props.vehicle ? [props.vehicle.id] : []));
  const [filter, setFilter] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApplyChecklistTemplateResult | null>(null);

  const pickVehicles = !props.vehicle;

  useEffect(() => {
    let cancelled = false;
    if (pickVehicles) {
      getVehicles(true)
        .then((loaded) => {
          if (!cancelled) setVehicles(loaded.filter((v) => v.active !== false));
        })
        .catch(() => {
          if (!cancelled) setError('No se pudo cargar la flota.');
        });
    } else {
      getChecklistTemplates()
        .then((loaded) => {
          if (cancelled) return;
          setTemplates(loaded);
          if (loaded.length > 0) setTemplateId(loaded[0].id);
        })
        .catch(() => {
          if (!cancelled) setError('No se pudieron cargar las plantillas.');
        });
    }
    return () => {
      cancelled = true;
    };
  }, [pickVehicles]);

  const visible = vehicles?.filter((v) => {
    const q = filter.trim().toLowerCase();
    return !q || `${v.plate} ${v.brand} ${v.model} ${vehicleTypeLabel(v.vehicleType)}`.toLowerCase().includes(q);
  });
  const allVisibleSelected = Boolean(visible?.length) && visible!.every((v) => selected.has(v.id));
  const template = templates?.find((t) => t.id === templateId);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const v of visible ?? []) {
        if (allVisibleSelected) next.delete(v.id);
        else next.add(v.id);
      }
      return next;
    });
  }

  async function handleApply() {
    if (!templateId) return;
    setSubmitting(true);
    setError(null);
    try {
      const applied = await applyChecklistTemplate(templateId, [...selected]);
      setResult(applied);
      onApplied?.(applied);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo aplicar la plantilla. Intentá de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  const title = props.template ? `Aplicar "${props.template.name}"` : 'Aplicar plantilla';
  const subtitle = props.vehicle ? props.vehicle.plate : 'Los controles se copian a cada vehículo elegido.';

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="apply-template-title">
      <div className="modal">
        <header className="modal__header">
          <div>
            <h2 className="modal__title" id="apply-template-title">
              {title}
            </h2>
            <p className="modal__subtitle">{subtitle}</p>
          </div>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Cerrar">
            <CloseIcon width={18} height={18} />
          </button>
        </header>

        <div className="modal__body">
          {result ? (
            <div className="apply-template__result" role="status">
              <p className="info-banner">{describeApplyResult(result)}</p>
              {result.vehicles.length > 1 && (
                <ul className="apply-template__result-list">
                  {result.vehicles.map((v) => (
                    <li key={v.vehicleId}>
                      <strong>{v.plate}</strong>: {v.added} {v.added === 1 ? 'agregado' : 'agregados'}
                      {v.skipped > 0 && `, ${v.skipped} ya ${v.skipped === 1 ? 'estaba' : 'estaban'}`}
                    </li>
                  ))}
                </ul>
              )}
              {result.vehicles.length === 1 && result.vehicles[0].skippedLabels.length > 0 && (
                <p className="muted">Ya estaban: {result.vehicles[0].skippedLabels.join(', ')}.</p>
              )}
            </div>
          ) : (
            <>
              {!pickVehicles && templates && templates.length === 0 && (
                <p className="muted">Todavía no hay plantillas. Creá una en Vehículos → Plantillas de checklist.</p>
              )}
              {!pickVehicles && templates && templates.length > 0 && (
                <label className="schedule-picker__field">
                  Plantilla
                  <select
                    className="schedule-picker__input"
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                  >
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.items.length} {t.items.length === 1 ? 'control' : 'controles'})
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {template && (
                <ul className="apply-template__preview" aria-label="Controles de la plantilla">
                  {template.items.map((i) => (
                    <li key={i.id}>{i.label}</li>
                  ))}
                </ul>
              )}

              {pickVehicles && !vehicles && !error && <p className="muted">Cargando flota…</p>}
              {pickVehicles && vehicles && (
                <div className="apply-template__vehicles">
                  <div className="apply-template__toolbar">
                    <input
                      type="search"
                      className="schedule-picker__input"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                      placeholder="Buscar por patente, marca o tipo"
                      aria-label="Buscar vehículos"
                    />
                    <label className="checklist-toggle">
                      <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} />
                      <span>Todos</span>
                    </label>
                  </div>
                  <ul className="apply-template__vehicle-list">
                    {visible?.map((v) => (
                      <li key={v.id}>
                        <label className="checklist-toggle">
                          <input type="checkbox" checked={selected.has(v.id)} onChange={() => toggle(v.id)} />
                          <span>
                            {v.plate}
                            <small>
                              {v.brand} {v.model}
                              {` · ${vehicleTypeLabel(v.vehicleType)}`}
                            </small>
                          </span>
                        </label>
                      </li>
                    ))}
                    {visible?.length === 0 && <li className="muted">Ningún vehículo coincide.</li>}
                  </ul>
                </div>
              )}
            </>
          )}

          {error && <p className="error-banner">{error}</p>}
        </div>

        <footer className="modal__footer">
          {result ? (
            <button type="button" className="primary-btn" onClick={onClose}>
              Listo
            </button>
          ) : (
            <>
              <button type="button" className="secondary-btn" onClick={onClose} disabled={submitting}>
                Cancelar
              </button>
              <button
                type="button"
                className="primary-btn"
                onClick={handleApply}
                disabled={submitting || !templateId || selected.size === 0}
              >
                {submitting
                  ? 'Aplicando…'
                  : pickVehicles
                    ? `Aplicar a ${selected.size} ${selected.size === 1 ? 'vehículo' : 'vehículos'}`
                    : 'Aplicar'}
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
