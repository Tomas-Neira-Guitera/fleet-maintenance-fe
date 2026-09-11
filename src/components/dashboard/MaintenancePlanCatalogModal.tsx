import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../services/apiClient';
import { deleteMaintenancePlan, getMaintenancePlans, updateMaintenancePlan } from '../../services/maintenancePlansService';
import type { MaintenancePlan } from '../../types/domain';
import { numberFormatter } from '../../utils/maintenanceFormat';
import { CloseIcon } from '../icons';
import { MaintenancePlanFormModal } from './MaintenancePlanFormModal';
import '../../styles/dashboard.css';

interface MaintenancePlanCatalogModalProps {
  onClose: () => void;
}

function describeInterval(plan: Pick<MaintenancePlan, 'intervalType' | 'intervalKm' | 'intervalDays'>): string {
  const parts: string[] = [];
  if (plan.intervalKm != null) parts.push(`cada ${numberFormatter.format(plan.intervalKm)} km`);
  if (plan.intervalDays != null) parts.push(`cada ${plan.intervalDays} días`);
  return parts.join(' o ');
}

/**
 * Catálogo de planes de mantenimiento (CAM-16): editar, desactivar/reactivar
 * o borrar un plan fuera del flujo de "asignar a un vehículo". Reusa los
 * mismos endpoints que ya expone el backend (PATCH/DELETE .../maintenance-plans/{id}).
 */
export function MaintenancePlanCatalogModal({ onClose }: MaintenancePlanCatalogModalProps) {
  const [plans, setPlans] = useState<MaintenancePlan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [formTarget, setFormTarget] = useState<'new' | MaintenancePlan | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const mountedRef = useRef(true);

  function load(active: boolean) {
    getMaintenancePlans(active)
      .then((data) => {
        if (mountedRef.current) setPlans(data);
      })
      .catch(() => {
        if (mountedRef.current) setError('No se pudo cargar el catálogo de planes.');
      });
  }

  useEffect(() => {
    mountedRef.current = true;
    load(!showInactive);
    return () => {
      mountedRef.current = false;
    };
  }, [showInactive]);

  function handleSaved() {
    setFormTarget(null);
    load(!showInactive);
  }

  async function handleToggleActive(plan: MaintenancePlan) {
    setPendingId(plan.id);
    setError(null);
    try {
      await updateMaintenancePlan(plan.id, { active: !plan.active });
      load(!showInactive);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar el plan. Intentá de nuevo.');
    } finally {
      setPendingId(null);
    }
  }

  async function handleDelete(plan: MaintenancePlan) {
    if (!window.confirm(`¿Borrar "${plan.name}" del catálogo? Esto no se puede deshacer.`)) return;
    setPendingId(plan.id);
    setError(null);
    try {
      await deleteMaintenancePlan(plan.id);
      load(!showInactive);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo borrar el plan. Intentá de nuevo.');
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal modal--wide">
        <header className="modal__header">
          <h2 className="modal__title">Catálogo de planes de mantenimiento</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Cerrar">
            <CloseIcon width={18} height={18} />
          </button>
        </header>

        <div className="modal__body">
          <div className="vehicle-maintenance-list__toolbar vehicle-maintenance-list__toolbar--spread">
            <label className="vehicles-section__toggle">
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
              Ver desactivados
            </label>
            <button type="button" className="secondary-btn" onClick={() => setFormTarget('new')}>
              + Nuevo plan
            </button>
          </div>

          {error && <p className="error-banner">{error}</p>}
          {!plans && !error && <p className="muted">Cargando catálogo…</p>}
          {plans && plans.length === 0 && (
            <p className="muted">
              {showInactive ? 'No hay planes desactivados.' : 'El catálogo todavía no tiene planes.'}
            </p>
          )}

          {plans && plans.length > 0 && (
            <ul className="vehicle-maintenance-list">
              {plans.map((p) => (
                <li key={p.id} className="vehicle-maintenance-list__item">
                  <div className="vehicle-maintenance-list__info">
                    <div className="vehicle-maintenance-list__top-line">
                      <span className="vehicle-maintenance-list__name">{p.name}</span>
                      <span
                        className={`vehicles-section__status vehicles-section__status--${p.active ? 'active' : 'inactive'}`}
                      >
                        {p.active ? 'Activo' : 'Desactivado'}
                      </span>
                    </div>
                    <p className="vehicle-maintenance-list__detail">
                      {p.category ? `${p.category} · ` : ''}
                      {describeInterval(p)}
                    </p>
                  </div>
                  <div className="vehicle-maintenance-list__actions">
                    <button
                      type="button"
                      className="secondary-btn vehicle-maintenance-list__schedule-btn"
                      onClick={() => setFormTarget(p)}
                      disabled={pendingId === p.id}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className={p.active ? 'vehicle-maintenance-list__unassign-btn' : 'assign-plan-modal__switch'}
                      onClick={() => handleToggleActive(p)}
                      disabled={pendingId === p.id}
                    >
                      {p.active ? 'Desactivar' : 'Activar'}
                    </button>
                    <button
                      type="button"
                      className="vehicle-maintenance-list__unassign-btn"
                      onClick={() => handleDelete(p)}
                      disabled={pendingId === p.id}
                    >
                      Eliminar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {formTarget && (
        <MaintenancePlanFormModal
          plan={formTarget === 'new' ? undefined : formTarget}
          onClose={() => setFormTarget(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
