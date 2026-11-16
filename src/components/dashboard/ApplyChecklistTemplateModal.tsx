import { useEffect, useState } from 'react';
import { ApiError } from '../../services/apiClient';
import {
  applyChecklistTemplate,
  describeApplyResult,
  describeUnapplyResult,
  getChecklistTemplates,
  unapplyChecklistTemplate,
} from '../../services/checklistTemplatesService';
import { getVehicles } from '../../services/vehiclesService';
import type {
  ApplyChecklistTemplateResult,
  ChecklistTemplate,
  UnapplyChecklistTemplateResult,
  Vehicle,
} from '../../types/domain';
import { vehicleTypeLabel } from '../../utils/vehicleTypes';
import { CloseIcon } from '../icons';
import '../../styles/dashboard.css';
import '../../styles/checklistTemplates.css';

/** Lo que cambió al guardar: para que la pantalla de atrás sepa si tiene que recargar. */
export interface TemplateChanges {
  added: number;
  removed: number;
}

type ApplyChecklistTemplateModalProps = {
  onClose: () => void;
  onChanged?: (changes: TemplateChanges) => void;
} & (
  // Desde la sección de plantillas: la plantilla está elegida y se tildan los vehículos que la llevan.
  | { template: ChecklistTemplate; vehicle?: undefined }
  // Desde el checklist de un vehículo: el vehículo está elegido y se elige la plantilla.
  | { vehicle: Pick<Vehicle, 'id' | 'plate'>; template?: undefined }
);

function vehicles(count: number): string {
  return `${count} ${count === 1 ? 'vehículo' : 'vehículos'}`;
}

/**
 * CAM-150 y CAM-159: aplicar una plantilla o quitarla. Desde la plantilla, los vehículos que ya la tienen
 * arrancan tildados: tildar uno se la aplica y destildarlo se la quita.
 */
export function ApplyChecklistTemplateModal(props: ApplyChecklistTemplateModalProps) {
  const { onClose, onChanged } = props;
  const [templates, setTemplates] = useState<ChecklistTemplate[] | null>(props.template ? [props.template] : null);
  const [templateId, setTemplateId] = useState(props.template?.id ?? '');
  // Solo los activos: un vehículo dado de baja no se puede elegir.
  const [fleet, setFleet] = useState<Vehicle[] | null>(null);
  const [applied] = useState<Set<string>>(() => new Set(props.template?.appliedVehicleIds ?? []));
  const [selected, setSelected] = useState<Set<string>>(() => new Set(props.template?.appliedVehicleIds ?? []));
  const [filter, setFilter] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    apply?: ApplyChecklistTemplateResult;
    unapply?: UnapplyChecklistTemplateResult;
  } | null>(null);

  const pickVehicles = !props.vehicle;

  useEffect(() => {
    let cancelled = false;
    if (pickVehicles) {
      getVehicles(true)
        .then((loaded) => {
          if (!cancelled) setFleet(loaded.filter((v) => v.active !== false));
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

  const visible = fleet?.filter((v) => {
    const q = filter.trim().toLowerCase();
    return !q || `${v.plate} ${v.brand} ${v.model} ${vehicleTypeLabel(v.vehicleType)}`.toLowerCase().includes(q);
  });
  const allVisibleSelected = Boolean(visible?.length) && visible!.every((v) => selected.has(v.id));
  const template = templates?.find((t) => t.id === templateId);

  // Desde un vehículo, el botón aplica o quita según si ya la tiene.
  const appliedHere = Boolean(props.vehicle && template?.appliedVehicleIds.includes(props.vehicle.id));
  const toAdd = props.vehicle
    ? appliedHere ? [] : [props.vehicle.id]
    : [...selected].filter((id) => !applied.has(id));
  const toRemove = props.vehicle
    ? appliedHere ? [props.vehicle.id] : []
    : [...applied].filter((id) => !selected.has(id));

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

  async function handleSave() {
    if (!templateId) return;
    setSubmitting(true);
    setError(null);
    const done: { apply?: ApplyChecklistTemplateResult; unapply?: UnapplyChecklistTemplateResult } = {};
    try {
      if (toAdd.length > 0) done.apply = await applyChecklistTemplate(templateId, toAdd);
      if (toRemove.length > 0) done.unapply = await unapplyChecklistTemplate(templateId, toRemove);
      setResult(done);
    } catch (err) {
      // Si se aplicó y falló al quitar, lo aplicado ya quedó: se avisa igual para que se recargue.
      setError(err instanceof ApiError ? err.message : 'No se pudieron guardar los cambios. Intentá de nuevo.');
    } finally {
      setSubmitting(false);
      if (done.apply || done.unapply) {
        onChanged?.({ added: done.apply?.added ?? 0, removed: done.unapply?.removed ?? 0 });
      }
    }
  }

  const title = props.template ? `"${props.template.name}" en vehículos` : 'Aplicar o quitar una plantilla';
  const subtitle = props.vehicle
    ? props.vehicle.plate
    : 'Tildá los vehículos que la llevan. Destildar uno le quita los controles que vinieron de esta plantilla.';

  const saveLabel = props.vehicle
    ? appliedHere
      ? 'Quitar plantilla'
      : 'Aplicar'
    : toAdd.length > 0 && toRemove.length > 0
      ? `Aplicar a ${toAdd.length} y quitar de ${toRemove.length}`
      : toAdd.length > 0
        ? `Aplicar a ${vehicles(toAdd.length)}`
        : toRemove.length > 0
          ? `Quitar de ${vehicles(toRemove.length)}`
          : 'Sin cambios';

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
              {result.apply && (
                <>
                  <p className="info-banner">{describeApplyResult(result.apply)}</p>
                  {result.apply.vehicles.length > 1 && (
                    <ul className="apply-template__result-list">
                      {result.apply.vehicles.map((v) => (
                        <li key={v.vehicleId}>
                          <strong>{v.plate}</strong>: {v.added} {v.added === 1 ? 'agregado' : 'agregados'}
                          {v.skipped > 0 && `, ${v.skipped} ya ${v.skipped === 1 ? 'estaba' : 'estaban'}`}
                        </li>
                      ))}
                    </ul>
                  )}
                  {result.apply.vehicles.length === 1 && result.apply.vehicles[0].skippedLabels.length > 0 && (
                    <p className="muted">Ya estaban: {result.apply.vehicles[0].skippedLabels.join(', ')}.</p>
                  )}
                </>
              )}
              {result.unapply && (
                <>
                  <p className="info-banner">{describeUnapplyResult(result.unapply)}</p>
                  {result.unapply.vehicles.length > 1 && (
                    <ul className="apply-template__result-list">
                      {result.unapply.vehicles.map((v) => (
                        <li key={v.vehicleId}>
                          <strong>{v.plate}</strong>: {v.removed} {v.removed === 1 ? 'quitado' : 'quitados'}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
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
                        {props.vehicle && t.appliedVehicleIds.includes(props.vehicle.id) ? ' · aplicada' : ''}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {appliedHere && <p className="muted">Este vehículo ya tiene esta plantilla.</p>}
              {template && (
                <ul className="apply-template__preview" aria-label="Controles de la plantilla">
                  {template.items.map((i) => (
                    <li key={i.id}>{i.label}</li>
                  ))}
                </ul>
              )}

              {pickVehicles && !fleet && !error && <p className="muted">Cargando flota…</p>}
              {pickVehicles && fleet && (
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
                            {applied.has(v.id) && <span className="apply-template__applied">Aplicada</span>}
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

              {toRemove.length > 0 && (
                <p className="apply-template__warning">
                  Se borran {toRemove.length === 1 ? 'de ese vehículo' : `de esos ${vehicles(toRemove.length)}`} los
                  controles que vinieron de esta plantilla. Los que ya tenía antes se quedan, y las inspecciones ya
                  hechas no cambian.
                </p>
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
                onClick={handleSave}
                disabled={submitting || !templateId || (toAdd.length === 0 && toRemove.length === 0)}
              >
                {submitting ? 'Guardando…' : saveLabel}
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
