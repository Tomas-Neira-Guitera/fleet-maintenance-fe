import { useEffect, useState } from 'react';
import { ApiError } from '../../services/apiClient';
import { createMaintenanceAssignment } from '../../services/maintenanceAssignmentsService';
import { createMaintenancePlan, getMaintenancePlans } from '../../services/maintenancePlansService';
import type { IntervalType, MaintenanceAssignment, MaintenancePlan } from '../../types/domain';
import { numberFormatter } from '../../utils/maintenanceFormat';
import { CloseIcon } from '../icons';
import '../../styles/dashboard.css';

interface AssignPlanModalProps {
  vehicleId: string;
  onClose: () => void;
  onAssigned: (assignment: MaintenanceAssignment) => void;
}

function describeInterval(plan: Pick<MaintenancePlan, 'intervalType' | 'intervalKm' | 'intervalDays'>): string {
  const parts: string[] = [];
  if (plan.intervalKm != null) parts.push(`cada ${numberFormatter.format(plan.intervalKm)} km`);
  if (plan.intervalDays != null) parts.push(`cada ${plan.intervalDays} días`);
  return parts.join(' o ');
}

const INTERVAL_LABEL: Record<IntervalType, string> = {
  km: 'Por kilometraje',
  time: 'Por tiempo',
  both: 'Por kilometraje o tiempo',
};

/**
 * Modal para asignar un plan de mantenimiento a un vehículo (CAM-16): elegir uno
 * existente del catálogo, o crear uno nuevo al vuelo si el catálogo no tiene lo
 * que hace falta (hoy arranca vacío, sin seed de maintenance_plan).
 */
export function AssignPlanModal({ vehicleId, onClose, onAssigned }: AssignPlanModalProps) {
  const [plans, setPlans] = useState<MaintenancePlan[] | null>(null);
  const [mode, setMode] = useState<'pick' | 'create'>('pick');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [intervalType, setIntervalType] = useState<IntervalType>('km');
  const [intervalKm, setIntervalKm] = useState('');
  const [intervalDays, setIntervalDays] = useState('');

  useEffect(() => {
    let cancelled = false;
    getMaintenancePlans(true)
      .then((data) => {
        if (!cancelled) setPlans(data);
      })
      .catch(() => {
        if (!cancelled) setPlans([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function switchToCreate() {
    setMode('create');
    setError(null);
  }

  function switchToPick() {
    setMode('pick');
    setError(null);
  }

  const needsKm = intervalType === 'km' || intervalType === 'both';
  const needsDays = intervalType === 'time' || intervalType === 'both';
  const canSubmit =
    mode === 'pick'
      ? Boolean(selectedPlanId)
      : Boolean(name.trim()) && (!needsKm || intervalKm.trim()) && (!needsDays || intervalDays.trim());

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const planId =
        mode === 'pick'
          ? selectedPlanId
          : (
              await createMaintenancePlan({
                name: name.trim(),
                category: category.trim() || undefined,
                intervalType,
                intervalKm: needsKm ? Number(intervalKm) : undefined,
                intervalDays: needsDays ? Number(intervalDays) : undefined,
              })
            ).id;
      const assignment = await createMaintenanceAssignment(vehicleId, planId);
      onAssigned(assignment);
    } catch (err) {
      if (err instanceof ApiError && err.errorCode === 'DUPLICATE_ACTIVE_ASSIGNMENT') {
        setError('Este vehículo ya tiene este plan asignado y activo.');
      } else {
        setError(err instanceof ApiError ? err.message : 'No se pudo asignar el plan. Intentá de nuevo.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal modal--narrow">
        <header className="modal__header">
          <h2 className="modal__title">Asignar plan de mantenimiento</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Cerrar">
            <CloseIcon width={18} height={18} />
          </button>
        </header>

        <div className="modal__body">
          {mode === 'pick' && (
            <>
              <label className="schedule-picker__field">
                Plan
                <select
                  className="schedule-picker__input"
                  value={selectedPlanId}
                  onChange={(e) => setSelectedPlanId(e.target.value)}
                  disabled={!plans}
                >
                  <option value="">{plans ? 'Elegí un plan' : 'Cargando…'}</option>
                  {plans?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {describeInterval(p)}
                    </option>
                  ))}
                </select>
              </label>
              {plans && plans.length === 0 && (
                <p className="muted">El catálogo todavía no tiene planes. Creá uno nuevo.</p>
              )}
              <button type="button" className="assign-plan-modal__switch" onClick={switchToCreate}>
                + Crear plan nuevo
              </button>
            </>
          )}

          {mode === 'create' && (
            <>
              <label className="schedule-picker__field">
                Nombre
                <input
                  type="text"
                  className="schedule-picker__input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Cambio de aceite"
                />
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
              <button type="button" className="assign-plan-modal__switch" onClick={switchToPick}>
                Elegir uno existente
              </button>
            </>
          )}

          {error && <p className="error-banner">{error}</p>}
        </div>

        <footer className="modal__footer">
          <button type="button" className="secondary-btn" onClick={onClose} disabled={submitting}>
            Cancelar
          </button>
          <button type="button" className="primary-btn" onClick={handleSubmit} disabled={submitting || !canSubmit}>
            {submitting ? 'Asignando…' : 'Asignar'}
          </button>
        </footer>
      </div>
    </div>
  );
}
