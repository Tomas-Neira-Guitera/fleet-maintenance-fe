import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../services/apiClient';
import { deleteMaintenancePlan, getMaintenancePlans, updateMaintenancePlan } from '../../services/maintenancePlansService';
import type { MaintenancePlan } from '../../types/domain';
import { numberFormatter } from '../../utils/maintenanceFormat';
import { PowerIcon, TrashIcon, WrenchIcon } from '../icons';
import { MaintenancePlanFormModal } from './MaintenancePlanFormModal';
import { PlanVehiclesModal } from './PlanVehiclesModal';
import '../../styles/dashboard.css';

function describeInterval(plan: Pick<MaintenancePlan, 'intervalType' | 'intervalKm' | 'intervalDays'>): string {
  const parts: string[] = [];
  if (plan.intervalKm != null) parts.push(`cada ${numberFormatter.format(plan.intervalKm)} km`);
  if (plan.intervalDays != null) parts.push(`cada ${plan.intervalDays} días`);
  return parts.join(' o ');
}

/**
 * Catálogo de planes de mantenimiento (CAM-16/CAM-25): ABM a la vista, mismo
 * molde que "Vehículos" (VehiclesSection). Click en un plan abre
 * PlanVehiclesModal para ver a qué vehículos se le puede asignar y asignarlo.
 * Reemplaza el flujo viejo (vehículos primero, "Ver catálogo de planes" como
 * modal aparte -- MaintenancePlanCatalogModal, ahora borrado).
 */
export function MaintenancePlansSection() {
  const [plans, setPlans] = useState<MaintenancePlan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [formTarget, setFormTarget] = useState<'new' | MaintenancePlan | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<MaintenancePlan | null>(null);
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
    <section className="fleet-status vehicles-section">
      <header className="fleet-status__header">
        <h1 className="fleet-status__title">
          <span className="page-title__icon" aria-hidden="true">
            <WrenchIcon width={18} height={18} />
          </span>
          Planes de Mantenimiento
        </h1>
        <div className="vehicles-section__header-actions">
          <label className="vehicles-section__toggle">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            Ver desactivados
          </label>
          <button type="button" className="primary-btn vehicles-section__new-btn" onClick={() => setFormTarget('new')}>
            + Nuevo plan
          </button>
        </div>
      </header>

      {error && <p className="error-banner">{error}</p>}
      {!plans && !error && <p className="muted">Cargando catálogo…</p>}
      {plans && plans.length === 0 && (
        <p className="muted">{showInactive ? 'No hay planes desactivados.' : 'El catálogo todavía no tiene planes.'}</p>
      )}

      {plans && plans.length > 0 && (
        <ul className="vehicle-maintenance-list">
          {plans.map((p) => (
            <li
              key={p.id}
              className={`vehicle-maintenance-list__item${p.active ? ' vehicle-maintenance-list__item--clickable' : ''}`}
              onClick={p.active ? () => setSelectedPlan(p) : undefined}
              title={p.active ? 'Ver vehículos a los que se le puede asignar este plan' : undefined}
            >
              <div className="vehicle-maintenance-list__info">
                <div className="vehicle-maintenance-list__top-line">
                  <span className="vehicle-maintenance-list__name">{p.name}</span>
                  <span className={`vehicles-section__status vehicles-section__status--${p.active ? 'active' : 'inactive'}`}>
                    {p.active ? 'Activo' : 'Desactivado'}
                  </span>
                </div>
                <p className="vehicle-maintenance-list__detail">
                  {p.category ? `${p.category} · ` : ''}
                  {describeInterval(p)}
                </p>
              </div>
              <div className="vehicle-maintenance-list__actions">
                {p.active && (
                  <button
                    type="button"
                    className="secondary-btn vehicle-maintenance-list__schedule-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFormTarget(p);
                    }}
                    disabled={pendingId === p.id}
                  >
                    Editar
                  </button>
                )}
                <button
                  type="button"
                  className={`vehicle-maintenance-list__icon-btn vehicle-maintenance-list__schedule-btn ${
                    p.active ? 'vehicle-maintenance-list__icon-btn--warn' : 'vehicle-maintenance-list__icon-btn--ok'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleToggleActive(p);
                  }}
                  disabled={pendingId === p.id}
                >
                  <PowerIcon width={14} height={14} />
                  {p.active ? 'Desactivar' : 'Activar'}
                </button>
                {!p.active && (
                  <button
                    type="button"
                    className="vehicle-maintenance-list__icon-btn vehicle-maintenance-list__schedule-btn vehicle-maintenance-list__icon-btn--danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDelete(p);
                    }}
                    disabled={pendingId === p.id}
                  >
                    <TrashIcon width={14} height={14} />
                    Eliminar
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {formTarget && (
        <MaintenancePlanFormModal
          plan={formTarget === 'new' ? undefined : formTarget}
          onClose={() => setFormTarget(null)}
          onSaved={handleSaved}
        />
      )}

      {selectedPlan && <PlanVehiclesModal plan={selectedPlan} onClose={() => setSelectedPlan(null)} />}
    </section>
  );
}
