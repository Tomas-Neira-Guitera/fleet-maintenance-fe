import { useEffect, useState } from 'react';
import { getDefects } from '../../services/defectsService';
import { getFleetStatus } from '../../services/fleetStatusService';
import { AlertOctagonIcon, AlertTriangleIcon, TruckIcon, WrenchIcon } from '../icons';
import '../../styles/dashboard.css';

/** No hay endpoint de conteos agregados (ver ROADMAP) -- alcanza con traer toda la flota. */
const FLEET_STATUS_PAGE_SIZE = 500;

interface KpiCounts {
  alDia: number;
  porVencer: number;
  vencido: number;
  defectosBloqueantes: number;
  defectosNoBloqueantes: number;
}

interface FleetKpiCardsProps {
  /** Cambiar este valor fuerza un refetch (ej. después de asignar/desasignar un plan). */
  refreshKey?: number;
}

export function FleetKpiCards({ refreshKey }: FleetKpiCardsProps = {}) {
  const [counts, setCounts] = useState<KpiCounts | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getFleetStatus({ pageSize: FLEET_STATUS_PAGE_SIZE }), getDefects()])
      .then(([fleetPage, defects]) => {
        if (cancelled) return;
        const openDefects = defects.filter((defect) => defect.status === 'open');
        setCounts({
          alDia: fleetPage.items.filter((row) => row.status === 'al_dia').length,
          porVencer: fleetPage.items.filter((row) => row.status === 'por_vencer').length,
          vencido: fleetPage.items.filter((row) => row.status === 'vencido').length,
          defectosBloqueantes: openDefects.filter((defect) => defect.severity === 'blocking').length,
          defectosNoBloqueantes: openDefects.filter((defect) => defect.severity === 'non-blocking').length,
        });
      })
      .catch(() => {
        if (!cancelled) setError('No se pudieron cargar los indicadores. Intentá de nuevo.');
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return (
    <section className="fleet-kpis">
      {error && <p className="error-banner">{error}</p>}
      {!counts && !error && <p className="muted">Cargando indicadores…</p>}

      {counts && (
        <div className="fleet-kpis__grid">
          <div className="fleet-kpi fleet-kpi--ok">
            <div className="fleet-kpi__top">
              <TruckIcon className="fleet-kpi__icon" />
              <span className="fleet-kpi__value">{counts.alDia}</span>
            </div>
            <span className="fleet-kpi__label">Vehículos al día</span>
            <span className="fleet-kpi__sublabel">Sin pendientes de mantenimiento</span>
          </div>
          <div className="fleet-kpi fleet-kpi--warn">
            <div className="fleet-kpi__top">
              <AlertTriangleIcon className="fleet-kpi__icon" />
              <span className="fleet-kpi__value">{counts.porVencer}</span>
            </div>
            <span className="fleet-kpi__label">Por vencer</span>
            <span className="fleet-kpi__sublabel">Requieren atención pronto</span>
          </div>
          <div className="fleet-kpi fleet-kpi--crit">
            <div className="fleet-kpi__top">
              <AlertOctagonIcon className="fleet-kpi__icon" />
              <span className="fleet-kpi__value">{counts.vencido}</span>
            </div>
            <span className="fleet-kpi__label">Vencidos</span>
            <span className="fleet-kpi__sublabel">Mantenimiento fuera de fecha</span>
          </div>
          <div className="fleet-kpi fleet-kpi--crit">
            <div className="fleet-kpi__top">
              <WrenchIcon className="fleet-kpi__icon" />
              <span className="fleet-kpi__value">{counts.defectosBloqueantes + counts.defectosNoBloqueantes}</span>
            </div>
            <span className="fleet-kpi__label">Defectos abiertos</span>
            <span className="fleet-kpi__sublabel">
              {counts.defectosBloqueantes} bloqueantes · {counts.defectosNoBloqueantes} no bloqueantes
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
