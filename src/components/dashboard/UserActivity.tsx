import { useEffect, useState } from 'react';
import { isSessionExpired } from '../../services/apiClient';
import { getUserStats } from '../../services/usersService';
import type { DriverStats, TechnicianStats, UserStats } from '../../types/domain';
import { currencyFormatter, numberFormatter } from '../../utils/maintenanceFormat';
import { describePeriod, periodParams, presetPeriod, type Period } from '../../utils/period';
import { BarList, type BarListItem } from '../charts/BarList';
import { PeriodFilter } from './PeriodFilter';
import '../../styles/dashboard.css';
import '../../styles/charts.css';

interface UserActivityProps {
  /** Cambia cuando se guarda un usuario: fuerza a pedir la actividad de nuevo. */
  refreshKey: number;
  onSessionExpired: () => void;
}

// Un usuario desactivado solo aparece si hizo algo en el período.
function relevant<T extends { active: boolean }>(items: T[], activity: (item: T) => number): T[] {
  return items.filter((item) => item.active || activity(item) > 0);
}

function nameOf(user: { username: string; active: boolean }): string {
  return user.active ? user.username : `${user.username} (desactivado)`;
}

/** De horas a algo que se lee de un vistazo: "18 h" o "5,0 días". */
function formatDuration(hours: number): string {
  if (hours < 48) return `${numberFormatter.format(Math.round(hours))} h`;
  return `${(hours / 24).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} días`;
}

function driverBars(drivers: DriverStats[]) {
  const shown = relevant(drivers, (d) => d.trips + d.inspections + d.defects);
  const trips: BarListItem[] = [...shown]
    .sort((a, b) => b.trips - a.trips)
    .map((d) => ({
      key: d.userId,
      label: nameOf(d),
      muted: !d.active,
      segments: [{ label: 'Viajes', value: d.trips, color: 'var(--fg-chart-1)' }],
      valueLabel: numberFormatter.format(d.trips),
    }));
  // Acá el color sí es de estado: la gravedad de un defecto usa los mismos tonos en toda la app.
  const defects: BarListItem[] = [...shown]
    .sort((a, b) => b.defects - a.defects)
    .map((d) => ({
      key: d.userId,
      label: nameOf(d),
      muted: !d.active,
      segments: [
        { label: 'No bloqueantes', value: d.defects - d.blockingDefects, color: 'var(--fg-warn)' },
        { label: 'Bloqueantes', value: d.blockingDefects, color: 'var(--fg-critical)' },
      ],
      valueLabel:
        d.blockingDefects > 0
          ? `${d.defects} · ${d.blockingDefects} ${d.blockingDefects === 1 ? 'bloqueante' : 'bloqueantes'}`
          : String(d.defects),
    }));
  return { trips, defects };
}

function technicianBars(technicians: TechnicianStats[]) {
  const shown = relevant(technicians, (t) => t.openWorkOrders + t.finalizedWorkOrders + t.expensesTotal);
  const workOrders: BarListItem[] = [...shown]
    .sort((a, b) => b.finalizedWorkOrders + b.openWorkOrders - (a.finalizedWorkOrders + a.openWorkOrders))
    .map((t) => ({
      key: t.userId,
      label: nameOf(t),
      muted: !t.active,
      segments: [
        { label: 'Finalizadas en el período', value: t.finalizedWorkOrders, color: 'var(--fg-chart-1)' },
        { label: 'Abiertas hoy', value: t.openWorkOrders, color: 'var(--fg-chart-2)' },
      ],
      valueLabel: `${t.finalizedWorkOrders} ${t.finalizedWorkOrders === 1 ? 'finalizada' : 'finalizadas'} · ${t.openWorkOrders} ${t.openWorkOrders === 1 ? 'abierta' : 'abiertas'}`,
    }));
  const resolution: BarListItem[] = [...shown]
    .sort((a, b) => (a.avgResolutionHours ?? Infinity) - (b.avgResolutionHours ?? Infinity))
    .map((t) => ({
      key: t.userId,
      label: nameOf(t),
      muted: !t.active,
      segments: [{ label: 'Horas', value: t.avgResolutionHours ?? 0, color: 'var(--fg-chart-1)' }],
      valueLabel: t.avgResolutionHours == null ? 'Sin órdenes finalizadas' : formatDuration(t.avgResolutionHours),
    }));
  const expenses: BarListItem[] = [...shown]
    .sort((a, b) => b.expensesTotal - a.expensesTotal)
    .map((t) => ({
      key: t.userId,
      label: nameOf(t),
      muted: !t.active,
      segments: [{ label: 'Gasto', value: t.expensesTotal, color: 'var(--fg-chart-1)' }],
      valueLabel: currencyFormatter.format(t.expensesTotal),
    }));
  return { workOrders, resolution, expenses };
}

/**
 * Actividad de choferes y técnicos en un período (CAM-91), debajo del listado de usuarios:
 * cuánto viaja y qué reporta cada chofer, y cuánto resuelve cada técnico. Los administradores
 * no figuran: hoy no se registra quién crea o edita cada cosa.
 */
export function UserActivity({ refreshKey, onSessionExpired }: UserActivityProps) {
  const [period, setPeriod] = useState<Period>(() => presetPeriod('year'));
  const [loaded, setLoaded] = useState<{ key: string; stats: UserStats } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestKey = `${period.from.getTime()}-${period.to.getTime()}-${refreshKey}`;
  const stats = loaded?.stats ?? null;
  const loading = loaded != null && loaded.key !== requestKey;

  useEffect(() => {
    let cancelled = false;
    getUserStats(periodParams(period))
      .then((data) => {
        if (cancelled) return;
        setLoaded({ key: requestKey, stats: data });
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (isSessionExpired(err)) onSessionExpired();
        else setError('No se pudo cargar la actividad. Intentá de nuevo.');
        setLoaded((current) => (current ? { ...current, key: requestKey } : current));
      });
    return () => {
      cancelled = true;
    };
    // requestKey ya resume el período y el pedido de recarga.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const drivers = stats ? driverBars(stats.drivers) : null;
  const technicians = stats ? technicianBars(stats.technicians) : null;
  const totals = stats && {
    trips: stats.drivers.reduce((sum, d) => sum + d.trips, 0),
    inspections: stats.drivers.reduce((sum, d) => sum + d.inspections, 0),
    defects: stats.drivers.reduce((sum, d) => sum + d.defects, 0),
    blocking: stats.drivers.reduce((sum, d) => sum + d.blockingDefects, 0),
    finalized: stats.technicians.reduce((sum, t) => sum + t.finalizedWorkOrders, 0),
    open: stats.technicians.reduce((sum, t) => sum + t.openWorkOrders, 0),
    activeDrivers: stats.drivers.filter((d) => d.active).length,
    activeTechnicians: stats.technicians.filter((t) => t.active).length,
  };

  return (
    <section className="user-activity">
      <header className="user-activity__header">
        <div>
          <h2 className="user-activity__title">Actividad</h2>
          <p className="user-activity__subtitle">Qué hizo cada chofer y cada técnico entre el {describePeriod(period)}.</p>
        </div>
        <PeriodFilter period={period} onChange={setPeriod} />
      </header>

      {error && <p className="error-banner">{error}</p>}
      {!stats && !error && <p className="muted">Cargando actividad…</p>}

      {stats && totals && drivers && technicians && (
        <div className={`expenses__body${loading ? ' expenses__body--loading' : ''}`}>
          <div className="user-activity__kpis">
            <div className="fleet-kpi expenses__kpi">
              <span className="fleet-kpi__label">Viajes</span>
              <span className="expenses__kpi-value">{numberFormatter.format(totals.trips)}</span>
              <span className="fleet-kpi__sublabel">
                {totals.activeDrivers} {totals.activeDrivers === 1 ? 'chofer activo' : 'choferes activos'}
              </span>
            </div>
            <div className="fleet-kpi expenses__kpi">
              <span className="fleet-kpi__label">Inspecciones</span>
              <span className="expenses__kpi-value">{numberFormatter.format(totals.inspections)}</span>
              <span className="fleet-kpi__sublabel">Pre-viaje y post-viaje</span>
            </div>
            <div className="fleet-kpi expenses__kpi">
              <span className="fleet-kpi__label">Defectos reportados</span>
              <span className="expenses__kpi-value">{numberFormatter.format(totals.defects)}</span>
              <span className="fleet-kpi__sublabel">
                {totals.blocking} {totals.blocking === 1 ? 'bloqueante' : 'bloqueantes'}
              </span>
            </div>
            <div className="fleet-kpi expenses__kpi">
              <span className="fleet-kpi__label">Órdenes finalizadas</span>
              <span className="expenses__kpi-value">{numberFormatter.format(totals.finalized)}</span>
              <span className="fleet-kpi__sublabel">
                {totals.activeTechnicians} {totals.activeTechnicians === 1 ? 'técnico activo' : 'técnicos activos'} ·{' '}
                {totals.open} {totals.open === 1 ? 'abierta hoy' : 'abiertas hoy'}
              </span>
            </div>
          </div>

          <div className="user-activity__grid">
            <div className="chart-card">
              <h3 className="chart-card__title">Choferes</h3>
              <div className="user-activity__block">
                <h4 className="user-activity__block-title">Viajes realizados</h4>
                <BarList items={drivers.trips} emptyLabel="Todavía no hay choferes." />
              </div>
              <div className="user-activity__block">
                <h4 className="user-activity__block-title">Defectos reportados</h4>
                <BarList
                  items={drivers.defects}
                  legend={[
                    { label: 'No bloqueantes', color: 'var(--fg-warn)' },
                    { label: 'Bloqueantes', color: 'var(--fg-critical)' },
                  ]}
                  emptyLabel="Todavía no hay choferes."
                />
              </div>
            </div>

            <div className="chart-card">
              <h3 className="chart-card__title">Técnicos</h3>
              <div className="user-activity__block">
                <h4 className="user-activity__block-title">Órdenes de trabajo a cargo</h4>
                <BarList
                  items={technicians.workOrders}
                  legend={[
                    { label: 'Finalizadas en el período', color: 'var(--fg-chart-1)' },
                    { label: 'Abiertas hoy', color: 'var(--fg-chart-2)' },
                  ]}
                  emptyLabel="Todavía no hay técnicos."
                />
              </div>
              <div className="user-activity__block">
                <h4 className="user-activity__block-title">Tiempo promedio de resolución</h4>
                <BarList items={technicians.resolution} emptyLabel="Todavía no hay técnicos." />
              </div>
              <div className="user-activity__block">
                <h4 className="user-activity__block-title">Gastos cargados en sus órdenes</h4>
                <BarList items={technicians.expenses} emptyLabel="Todavía no hay técnicos." />
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
