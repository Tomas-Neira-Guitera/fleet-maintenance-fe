import { useEffect, useMemo, useState } from 'react';
import { ApiError } from '../../services/apiClient';
import { deleteTire, getTireBrandComparison, getTires, retireTire } from '../../services/tiresService';
import { getVehicles } from '../../services/vehiclesService';
import type { Tire, TireBrandComparison, Vehicle } from '../../types/domain';
import { formatShortDate } from '../../utils/dateFormat';
import { formatCostPerKm } from '../../utils/fuelFormat';
import { currencyFormatter, numberFormatter } from '../../utils/maintenanceFormat';
import { TIRE_STATUS_LABEL, tireHealth, tireLabel } from '../../utils/tireFormat';
import { positionsOf, vehicleTypeLabel } from '../../utils/vehicleTypes';
import { ArrowLeftIcon, ChevronRightIcon, PencilIcon, TrashIcon } from '../icons';
import { TireFormModal } from './TireModals';
import '../../styles/dashboard.css';
import '../../styles/tires.css';

type View = 'vehicles' | 'stock' | 'brands';
type StockFilter = 'all' | 'stock' | 'retired';
type SortKey = 'tire' | 'status' | 'km' | 'costPerKm' | 'purchase';

const VIEW_LABEL: Record<View, string> = { vehicles: 'Por vehículo', stock: 'Stock y bajas', brands: 'Marcas' };

interface TiresSectionProps {
  onBack: () => void;
  onOpenVehicle: (vehicleId: string) => void;
}

/** Una fila de "Por vehículo": sus posiciones con la cubierta que tiene cada una. */
interface VehicleGroup {
  vehicle: Vehicle;
  slots: { position: string; label: string; tire: Tire | null }[];
  mounted: number;
  problems: number;
}

function buildGroups(vehicles: Vehicle[], tires: Tire[]): VehicleGroup[] {
  const byVehicle = new Map<string, Map<string, Tire>>();
  for (const tire of tires) {
    if (!tire.current) continue;
    const slots = byVehicle.get(tire.current.vehicleId) ?? new Map<string, Tire>();
    slots.set(tire.current.position, tire);
    byVehicle.set(tire.current.vehicleId, slots);
  }
  return vehicles
    .filter((v) => positionsOf(v.vehicleType).length > 0)
    .map((vehicle) => {
      const mountedHere = byVehicle.get(vehicle.id) ?? new Map<string, Tire>();
      const slots = positionsOf(vehicle.vehicleType).map((p) => ({ ...p, tire: mountedHere.get(p.position) ?? null }));
      return {
        vehicle,
        slots,
        mounted: slots.filter((s) => s.tire).length,
        problems: slots.filter((s) => tireHealth(s.tire) !== 'ok').length,
      };
    })
    .sort((a, b) => b.problems - a.problems || a.vehicle.plate.localeCompare(b.vehicle.plate));
}

function matches(tire: Tire, query: string): boolean {
  const text = [tire.brand, tire.model, tire.code, tire.size].filter(Boolean).join(' ').toLowerCase();
  return text.includes(query);
}

function HealthBadge({ tire }: { tire: Tire | null }) {
  if (!tire) return <span className="muted">Sin cubierta</span>;
  const health = tireHealth(tire);
  if (health === 'ok') return <span className="tire-health tire-health--ok">Sin problemas</span>;
  return (
    <span className={`tire-health tire-health--${health}`} title={`Reportado por ${tire.condition?.reportedBy ?? 'un chofer'}`}>
      {tire.condition?.conditionLabels.join(', ')}
    </span>
  );
}

/** CAM-157: inventario de cubiertas en tres vistas: por vehículo, stock y bajas, y costo por km por marca. */
export function TiresSection({ onBack, onOpenVehicle }: TiresSectionProps) {
  const [tires, setTires] = useState<Tire[] | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [comparison, setComparison] = useState<TireBrandComparison | null>(null);
  const [view, setView] = useState<View>('vehicles');
  const [query, setQuery] = useState('');
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'purchase', desc: true });
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Tire | 'new' | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getTires(), getTireBrandComparison(), getVehicles(true)])
      .then(([loaded, byBrand, fleet]) => {
        if (cancelled) return;
        setTires(loaded);
        setComparison(byBrand);
        setVehicles(fleet);
      })
      .catch(() => {
        if (!cancelled) setError('No se pudieron cargar las cubiertas. Intentá de nuevo.');
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  async function run(tire: Tire, action: () => Promise<unknown>, fallback: string) {
    setBusyId(tire.id);
    setError(null);
    try {
      await action();
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : fallback);
    } finally {
      setBusyId(null);
    }
  }

  function handleRetire(tire: Tire) {
    const reason = window.prompt(`Motivo de la baja de ${tireLabel(tire)} (opcional):`);
    if (reason === null) return;
    void run(tire, () => retireTire(tire.id, reason.trim() || undefined), 'No se pudo dar de baja la cubierta.');
  }

  function handleDelete(tire: Tire) {
    if (!window.confirm(`¿Borrar ${tireLabel(tire)}? Solo se puede si nunca estuvo montada.`)) return;
    void run(tire, () => deleteTire(tire.id), 'No se pudo borrar la cubierta.');
  }

  function toggle(vehicleId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(vehicleId)) next.delete(vehicleId);
      else next.add(vehicleId);
      return next;
    });
  }

  function sortBy(key: SortKey) {
    setSort((prev) => ({ key, desc: prev.key === key ? !prev.desc : key !== 'tire' }));
  }

  const counts = useMemo(() => {
    const all = tires ?? [];
    return {
      mounted: all.filter((t) => t.status === 'mounted').length,
      stock: all.filter((t) => t.status === 'stock').length,
      retired: all.filter((t) => t.status === 'retired').length,
      problems: all.filter((t) => tireHealth(t) !== 'ok').length,
    };
  }, [tires]);

  const q = query.trim().toLowerCase();
  const groups = useMemo(() => buildGroups(vehicles, tires ?? []), [vehicles, tires]);
  const visibleGroups = groups.filter((g) => {
    if (onlyProblems && g.problems === 0) return false;
    if (!q) return true;
    return (
      g.vehicle.plate.toLowerCase().includes(q) ||
      g.slots.some((s) => s.tire && matches(s.tire, q))
    );
  });

  const stockRows = (() => {
    const rows = (tires ?? []).filter(
      (t) => t.status !== 'mounted' && (stockFilter === 'all' || t.status === stockFilter) && (!q || matches(t, q)),
    );
    const value = (t: Tire): string | number => {
      switch (sort.key) {
        case 'tire':
          return tireLabel(t).toLowerCase();
        case 'status':
          return t.status;
        case 'km':
          return t.km;
        case 'costPerKm':
          return t.costPerKm ?? -1;
        case 'purchase':
          return t.purchaseDate;
      }
    };
    return [...rows].sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return sort.desc ? -cmp : cmp;
    });
  })();

  function sortHeader(key: SortKey, label: string, className?: string) {
    const active = sort.key === key;
    return (
      <th className={className} aria-sort={active ? (sort.desc ? 'descending' : 'ascending') : 'none'}>
        <button type="button" className="tires-sort" onClick={() => sortBy(key)}>
          {label}
          <span className="tires-sort__arrow" aria-hidden="true">
            {active ? (sort.desc ? '↓' : '↑') : ''}
          </span>
        </button>
      </th>
    );
  }

  const maxCost = Math.max(...(comparison?.brands.map((b) => b.costPerKm) ?? [0]), 0);

  return (
    <section className="fleet-status tires-section">
      <button type="button" className="top-nav__back" onClick={onBack}>
        <ArrowLeftIcon width={16} height={16} />
        Volver
      </button>
      <header className="fleet-status__header">
        <h1 className="fleet-status__title">Cubiertas</h1>
        <div className="tires-header__actions">
          <button type="button" className="primary-btn vehicles-section__new-btn" onClick={() => setEditing('new')}>
            + Nueva cubierta
          </button>
        </div>
      </header>

      {error && <p className="error-banner">{error}</p>}
      {!tires && !error && <p className="muted">Cargando cubiertas…</p>}

      {tires && (
        <>
          <div className="tires-kpis">
            <button type="button" className="tires-kpi" onClick={() => { setView('vehicles'); setOnlyProblems(false); }}>
              <span className="tires-kpi__value">{counts.mounted}</span>
              <span className="tires-kpi__label">Montadas</span>
            </button>
            <button type="button" className="tires-kpi" onClick={() => { setView('stock'); setStockFilter('stock'); }}>
              <span className="tires-kpi__value">{counts.stock}</span>
              <span className="tires-kpi__label">En stock</span>
            </button>
            <button type="button" className="tires-kpi" onClick={() => { setView('stock'); setStockFilter('retired'); }}>
              <span className="tires-kpi__value">{counts.retired}</span>
              <span className="tires-kpi__label">Dadas de baja</span>
            </button>
            <button
              type="button"
              className={`tires-kpi${counts.problems > 0 ? ' tires-kpi--warn' : ''}`}
              onClick={() => { setView('vehicles'); setOnlyProblems(true); }}
            >
              <span className="tires-kpi__value">{counts.problems}</span>
              <span className="tires-kpi__label">A revisar</span>
            </button>
          </div>

          <div className="vehicle-tabs tires-section__tabs" role="tablist" aria-label="Vistas de cubiertas">
            {(Object.keys(VIEW_LABEL) as View[]).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                className={`vehicle-tabs__tab${view === v ? ' vehicle-tabs__tab--active' : ''}`}
                onClick={() => setView(v)}
              >
                {VIEW_LABEL[v]}
              </button>
            ))}
          </div>

          {view !== 'brands' && (
            <div className="tires-toolbar">
              <input
                type="search"
                className="schedule-picker__input tires-toolbar__search"
                placeholder={view === 'vehicles' ? 'Buscar patente, marca o código' : 'Buscar marca, código o medida'}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Buscar"
              />
              {view === 'vehicles' ? (
                <label className="vehicles-section__toggle">
                  <input type="checkbox" checked={onlyProblems} onChange={(e) => setOnlyProblems(e.target.checked)} />
                  Solo con problemas
                </label>
              ) : (
                <div className="tires-segmented" role="group" aria-label="Filtrar por estado">
                  {(['all', 'stock', 'retired'] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      aria-pressed={stockFilter === f}
                      className={`tires-segmented__btn${stockFilter === f ? ' tires-segmented__btn--active' : ''}`}
                      onClick={() => setStockFilter(f)}
                    >
                      {f === 'all' ? 'Todas' : f === 'stock' ? 'En stock' : 'Dadas de baja'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {view === 'vehicles' && (
            <div className="tires-groups">
              {visibleGroups.length === 0 && (
                <p className="muted">
                  {onlyProblems ? 'Ninguna cubierta tiene problemas reportados.' : 'No hay vehículos que coincidan.'}
                </p>
              )}
              {visibleGroups.map((g) => {
                const open = expanded.has(g.vehicle.id) || Boolean(q);
                return (
                  <div key={g.vehicle.id} className={`tires-group${open ? ' tires-group--open' : ''}`}>
                    <button
                      type="button"
                      className="tires-group__header"
                      aria-expanded={open}
                      onClick={() => toggle(g.vehicle.id)}
                    >
                      <ChevronRightIcon width={16} height={16} className="tires-group__chevron" aria-hidden="true" />
                      <span className="tires-group__plate">{g.vehicle.plate}</span>
                      <span className="tires-group__name">
                        {g.vehicle.brand} {g.vehicle.model}
                        <span className="tires-group__type"> · {vehicleTypeLabel(g.vehicle.vehicleType)}</span>
                      </span>
                      <span className={`tires-group__count${g.mounted < g.slots.length ? ' tires-group__count--gap' : ''}`}>
                        {g.mounted}/{g.slots.length} montadas
                      </span>
                      {g.problems > 0 ? (
                        <span className="tire-health tire-health--warn">
                          {g.problems} a revisar
                        </span>
                      ) : (
                        <span className="tire-health tire-health--ok">Sin problemas</span>
                      )}
                    </button>
                    {open && (
                      <div className="tires-group__body">
                        <table className="fleet-status__table">
                          <thead>
                            <tr>
                              <th>Posición</th>
                              <th>Cubierta</th>
                              <th className="fleet-status__km">Km</th>
                              <th>Estado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {g.slots
                              .filter((s) => !q || g.vehicle.plate.toLowerCase().includes(q) || (s.tire && matches(s.tire, q)))
                              .map((s) => (
                                <tr key={s.position}>
                                  <td>{s.label}</td>
                                  <td>{s.tire ? tireLabel(s.tire) : <span className="muted">—</span>}</td>
                                  <td className="fleet-status__km">{s.tire ? numberFormatter.format(s.tire.km) : '—'}</td>
                                  <td>
                                    <HealthBadge tire={s.tire} />
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                        <button
                          type="button"
                          className="secondary-btn tires-group__open"
                          onClick={() => onOpenVehicle(g.vehicle.id)}
                        >
                          Ver neumáticos de {g.vehicle.plate}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {view === 'stock' && (
            <div className="fleet-status__table-wrap">
              {stockRows.length === 0 ? (
                <p className="muted">
                  {q ? 'No hay cubiertas que coincidan.' : stockFilter === 'retired' ? 'No hay cubiertas dadas de baja.' : 'No hay cubiertas en stock.'}
                </p>
              ) : (
                <table className="fleet-status__table">
                  <thead>
                    <tr>
                      {sortHeader('tire', 'Cubierta')}
                      {sortHeader('status', 'Estado')}
                      {sortHeader('purchase', 'Compra')}
                      {sortHeader('km', 'Km', 'fleet-status__km')}
                      {sortHeader('costPerKm', 'Costo por km', 'fleet-status__km')}
                      <th aria-label="Acciones" />
                    </tr>
                  </thead>
                  <tbody>
                    {stockRows.map((tire) => (
                      <tr key={tire.id}>
                        <td>
                          <div className="fleet-status__vehicle">
                            <span className="fleet-status__vehicle-name">{tireLabel(tire)}</span>
                            <span className="fleet-status__vehicle-type">
                              {tire.size} · {currencyFormatter.format(tire.cost)}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className={`tire-status tire-status--${tire.status}`}>{TIRE_STATUS_LABEL[tire.status]}</span>
                          {tire.retiredReason && <div className="vehicle-fuel__partial">{tire.retiredReason}</div>}
                        </td>
                        <td>{formatShortDate(tire.purchaseDate)}</td>
                        <td className="fleet-status__km">{numberFormatter.format(tire.km)}</td>
                        <td className="fleet-status__km">{formatCostPerKm(tire.costPerKm)}</td>
                        <td>
                          <div className="vehicle-fuel__actions">
                            <button
                              type="button"
                              className="vehicle-maintenance-list__icon-btn"
                              onClick={() => setEditing(tire)}
                              aria-label={`Editar ${tireLabel(tire)}`}
                              title="Editar"
                            >
                              <PencilIcon width={14} height={14} />
                            </button>
                            {tire.status === 'stock' && (
                              <button
                                type="button"
                                className="vehicle-detail__action-btn"
                                onClick={() => handleRetire(tire)}
                                disabled={busyId === tire.id}
                              >
                                Dar de baja
                              </button>
                            )}
                            {tire.status === 'stock' && tire.km === 0 && (
                              <button
                                type="button"
                                className="vehicle-maintenance-list__icon-btn"
                                onClick={() => handleDelete(tire)}
                                disabled={busyId === tire.id}
                                aria-label={`Borrar ${tireLabel(tire)}`}
                                title="Borrar (cargada por error)"
                              >
                                <TrashIcon width={14} height={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {view === 'brands' && comparison && (
            <div className="vehicle-detail__card tires-brands">
              <h2 className="vehicle-detail__card-title">Costo por km por marca</h2>
              {comparison.brands.length === 0 ? (
                <p className="muted">
                  Todavía no hay cubiertas con {numberFormatter.format(comparison.minKm)} km o más para comparar.
                </p>
              ) : (
                <>
                  <ul className="tires-brands__list">
                    {comparison.brands.map((b, i) => (
                      <li key={b.brand} className="tires-brands__row">
                        <span className="tires-brands__name">{b.brand}</span>
                        <span className="tires-brands__track">
                          <span
                            className={`tires-brands__bar${i === 0 ? ' tires-brands__bar--best' : ''}`}
                            style={{ width: `${maxCost > 0 ? Math.max(4, (b.costPerKm / maxCost) * 100) : 0}%` }}
                          />
                        </span>
                        <span className="tires-brands__value">{formatCostPerKm(b.costPerKm)}</span>
                        <span className="tires-brands__meta">
                          {b.tires} {b.tires === 1 ? 'cubierta' : 'cubiertas'}
                          {b.retired > 0 ? ` · ${b.retired} de baja` : ''} · {numberFormatter.format(b.averageKm)} km
                          promedio
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="vehicle-detail__item-meta">
                    Costo de compra sobre km recorridos, de las cubiertas con al menos{' '}
                    {numberFormatter.format(comparison.minKm)} km. Más corta es más barata por km.
                  </p>
                </>
              )}
            </div>
          )}
        </>
      )}

      {editing && (
        <TireFormModal
          tire={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setReloadKey((k) => k + 1);
          }}
        />
      )}
    </section>
  );
}
