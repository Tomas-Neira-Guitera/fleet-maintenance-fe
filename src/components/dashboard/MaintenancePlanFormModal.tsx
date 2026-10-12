import { useState } from 'react';
import { ApiError } from '../../services/apiClient';
import { createMaintenancePlan, updateMaintenancePlan } from '../../services/maintenancePlansService';
import type { IntervalType, MaintenancePlan } from '../../types/domain';
import { CloseIcon, PowerIcon } from '../icons';
import '../../styles/dashboard.css';
import { CharCounter } from '../CharCounter';
import { TITLE_MAX_LENGTH } from '../../utils/textLimits';

interface MaintenancePlanFormModalProps {
  /** Si viene, edita ese plan; si no, da de alta uno nuevo en el catálogo. */
  plan?: MaintenancePlan;
  onClose: () => void;
  /** Después de guardar, y también después de desactivar el plan desde la edición. */
  onSaved: (plan: MaintenancePlan) => void;
}

const INTERVAL_LABEL: Record<IntervalType, string> = {
  km: 'Por kilometraje',
  time: 'Por tiempo',
  both: 'Por kilometraje o tiempo',
};

/**
 * Alta y edición de un plan del catálogo (CAM-16) -- POST/PATCH
 * /api/maintenance-plans[/{id}]. Cambiar el intervalo de un plan existente no
 * recalcula el próximo vencimiento de las asignaciones ya hechas, aplica
 * desde el próximo completion (ver CAM-40-maintenance-api-contract.md).
 *
 * En la edición también está "Desactivar plan" (CAM-93: antes era un botón de cada fila del
 * listado). Reactivar sigue en el listado, con "Ver desactivados", porque un plan desactivado
 * no se puede editar.
 */
export function MaintenancePlanFormModal({ plan, onClose, onSaved }: MaintenancePlanFormModalProps) {
  const isEdit = Boolean(plan);

  const [name, setName] = useState(plan?.name ?? '');
  const [category, setCategory] = useState(plan?.category ?? '');
  const [intervalType, setIntervalType] = useState<IntervalType>(plan?.intervalType ?? 'km');
  const [intervalKm, setIntervalKm] = useState(plan?.intervalKm != null ? String(plan.intervalKm) : '');
  const [intervalDays, setIntervalDays] = useState(plan?.intervalDays != null ? String(plan.intervalDays) : '');
  const [submitting, setSubmitting] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsKm = intervalType === 'km' || intervalType === 'both';
  const needsDays = intervalType === 'time' || intervalType === 'both';
  const canSubmit = Boolean(name.trim()) && (!needsKm || intervalKm.trim()) && (!needsDays || intervalDays.trim());
  const hasChanges =
    plan != null &&
    (name !== plan.name ||
      category !== (plan.category ?? '') ||
      intervalType !== plan.intervalType ||
      intervalKm !== (plan.intervalKm != null ? String(plan.intervalKm) : '') ||
      intervalDays !== (plan.intervalDays != null ? String(plan.intervalDays) : ''));

  async function handleDeactivate() {
    if (!plan) return;
    // Desactivar es reversible (se reactiva desde "Ver desactivados"), así que solo se pregunta
    // si se van a perder cambios del formulario: desactivar no los guarda.
    if (hasChanges && !window.confirm(`¿Desactivar "${plan.name}"? Los cambios sin guardar se van a perder.`)) return;
    setSubmitting(true);
    setDeactivating(true);
    setError(null);
    try {
      onSaved(await updateMaintenancePlan(plan.id, { active: false }));
    } catch (err) {
      if (err instanceof ApiError && err.errorCode === 'PLAN_INACTIVE') {
        // Otro admin ya lo desactivó: lo que se pedía ya se cumple, así que se cierra y se recarga
        // la lista en lugar de mostrar el mensaje técnico del backend.
        onSaved({ ...plan, active: false });
      } else {
        setError(err instanceof ApiError ? err.message : 'No se pudo desactivar el plan. Intentá de nuevo.');
      }
    } finally {
      setSubmitting(false);
      setDeactivating(false);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        category: category.trim() || undefined,
        intervalType,
        intervalKm: needsKm ? Number(intervalKm) : undefined,
        intervalDays: needsDays ? Number(intervalDays) : undefined,
      };
      const saved = isEdit && plan ? await updateMaintenancePlan(plan.id, payload) : await createMaintenancePlan(payload);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar el plan. Intentá de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal modal--narrow">
        <header className="modal__header">
          <h2 className="modal__title">{isEdit ? 'Editar plan' : 'Nuevo plan'}</h2>
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
              maxLength={TITLE_MAX_LENGTH}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Cambio de aceite"
            />
            <CharCounter value={name} />
          </label>
          <label className="schedule-picker__field">
            Categoría (opcional)
            <input
              type="text"
              className="schedule-picker__input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Ej: motor"
            />
          </label>
          <label className="schedule-picker__field">
            Tipo de intervalo
            <select
              className="schedule-picker__input"
              value={intervalType}
              onChange={(e) => setIntervalType(e.target.value as IntervalType)}
            >
              {(Object.keys(INTERVAL_LABEL) as IntervalType[]).map((type) => (
                <option key={type} value={type}>
                  {INTERVAL_LABEL[type]}
                </option>
              ))}
            </select>
          </label>
          {needsKm && (
            <label className="schedule-picker__field">
              Cada cuántos km
              <input
                type="number"
                min={1}
                className="schedule-picker__input"
                value={intervalKm}
                onChange={(e) => setIntervalKm(e.target.value)}
                placeholder="Ej: 10000"
              />
            </label>
          )}
          {needsDays && (
            <label className="schedule-picker__field">
              Cada cuántos días
              <input
                type="number"
                min={1}
                className="schedule-picker__input"
                value={intervalDays}
                onChange={(e) => setIntervalDays(e.target.value)}
                placeholder="Ej: 180"
              />
            </label>
          )}

          {error && <p className="error-banner">{error}</p>}
        </div>

        <footer className="modal__footer">
          {isEdit && (
            <button
              type="button"
              className="secondary-btn modal__footer-start modal__footer-danger"
              onClick={handleDeactivate}
              disabled={submitting}
            >
              <PowerIcon width={14} height={14} />
              {deactivating ? 'Desactivando…' : 'Desactivar plan'}
            </button>
          )}
          <button type="button" className="secondary-btn" onClick={onClose} disabled={submitting}>
            Cancelar
          </button>
          <button type="button" className="primary-btn" onClick={handleSubmit} disabled={submitting || !canSubmit}>
            {submitting && !deactivating ? 'Guardando…' : 'Guardar'}
          </button>
        </footer>
      </div>
    </div>
  );
}
