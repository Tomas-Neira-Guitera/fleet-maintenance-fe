import { useEffect, useMemo, useState } from 'react';
import { isSessionExpired, SESSION_EXPIRED_MESSAGE } from '../../services/apiClient';
import { getExpenses } from '../../services/expensesService';
import { getVehicles } from '../../services/vehiclesService';
import { getWorkOrder } from '../../services/workOrdersService';
import type { Expense, ExpenseOrigin, Vehicle, WorkOrder, WorkOrderExpenseCategory } from '../../types/domain';
import { formatShortDate } from '../../utils/dateFormat';
import { EXPENSE_CATEGORY_LABEL, EXPENSE_ORIGIN_LABEL } from '../../utils/expenseFormat';
import { buildExpensesCsv, downloadCsv } from '../../utils/expensesCsv';
import { compactCurrencyFormatter, currencyFormatter } from '../../utils/maintenanceFormat';
import {
  customPeriod,
  describePeriod,
  lastDayOf,
  periodParams,
  presetPeriod,
  toDateInputValue,
  type Period,
} from '../../utils/period';
import { BarList, type BarListItem } from '../charts/BarList';
import { ColumnChart, type ColumnDatum } from '../charts/ColumnChart';
import { DonutChart, type DonutSegment } from '../charts/DonutChart';
import { PeriodFilter } from './PeriodFilter';
import { WorkOrderDetailModal } from './WorkOrderDetailModal';
import '../../styles/dashboard.css';
import '../../styles/charts.css';

interface ExpensesSectionProps {
  /** Para el botón de "volver a entrar" cuando la sesión venció. */
  onLogout: () => void;
  /**
   * Llegando desde el detalle de un vehículo (CAM-105): arranca filtrada por él y en los últimos
   * 12 meses, la misma ventana que muestra su tarjeta de costos.
   */
  initialVehicleId?: string;
}

interface Filters {
  vehicleId: string;
  category: WorkOrderExpenseCategory | '';
  origin: ExpenseOrigin | '';
}

const NO_FILTERS: Filters = { vehicleId: '', category: '', origin: '' };
const CATEGORIES: WorkOrderExpenseCategory[] = ['repuesto', 'mano_de_obra', 'otro'];
const ORIGINS: ExpenseOrigin[] = ['plan', 'defect', 'manual'];
// El color sigue a la categoría, no a su posición: filtrar no repinta las que quedan.
const SERIES_COLORS = ['var(--fg-chart-1)', 'var(--fg-chart-2)', 'var(--fg-chart-3)'];
const TABLE_PAGE_SIZE = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Desde la medianoche del mismo día de hace un año hasta hoy: la misma ventana que "Últimos 12 meses"
 * en la tarjeta de costos (GET /api/vehicles/{id}/costs). Un 29/02 cae en el 28/02, como en el backend.
 */
function lastTwelveMonths(now = new Date()): Period {
  const daysInMonthThen = new Date(now.getFullYear() - 1, now.getMonth() + 1, 0).getDate();
  const from = new Date(now.getFullYear() - 1, now.getMonth(), Math.min(now.getDate(), daysInMonthThen));
  return customPeriod(toDateInputValue(from), toDateInputValue(now)) ?? presetPeriod('year');
}

const sum = (expenses: Expense[]) => expenses.reduce((total, expense) => total + expense.amount, 0);

/** Sin mayúsculas ni acentos: "neumatico" encuentra "Neumático". */
function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es');
}

/** Cada palabra buscada tiene que aparecer en la descripción, en cualquier orden. */
function matchesSearch(expense: Expense, terms: string[]): boolean {
  const description = normalizeText(expense.description);
  return terms.every((term) => description.includes(term));
}

function matches(expense: Expense, filters: Filters, ignore?: keyof Filters): boolean {
  return (
    (ignore === 'vehicleId' || !filters.vehicleId || expense.vehicleId === filters.vehicleId) &&
    (ignore === 'category' || !filters.category || expense.category === filters.category) &&
    (ignore === 'origin' || !filters.origin || expense.origin === filters.origin)
  );
}

/**
 * Un valor por mes del período; si el período es corto (hasta dos meses), uno por día. Cada
 * columna se parte por origen (CAM-104), con los mismos colores que la dona de preventivo y correctivo.
 */
const isDaily = (period: Period) => (period.to.getTime() - period.from.getTime()) / DAY_MS <= 62;

function overTime(expenses: Expense[], period: Period): ColumnDatum[] {
  const byDay = isDaily(period);
  const keyOf = (date: Date) =>
    byDay ? `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}` : `${date.getFullYear()}-${date.getMonth()}`;

  const totals = new Map<string, number>();
  for (const expense of expenses) {
    const key = `${keyOf(new Date(expense.date))}|${expense.origin}`;
    totals.set(key, (totals.get(key) ?? 0) + expense.amount);
  }

  const buckets: ColumnDatum[] = [];
  const cursor = byDay ? new Date(period.from) : new Date(period.from.getFullYear(), period.from.getMonth(), 1);
  while (cursor < period.to) {
    const key = keyOf(cursor);
    buckets.push({
      key,
      label: byDay
        ? cursor.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
        : cursor.toLocaleDateString('es-AR', { month: 'short' }).replace('.', ''),
      fullLabel: byDay
        ? cursor.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
        : cursor.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }),
      segments: ORIGINS.map((origin, i) => ({
        label: EXPENSE_ORIGIN_LABEL[origin],
        value: totals.get(`${key}|${origin}`) ?? 0,
        color: SERIES_COLORS[i],
      })),
    });
    if (byDay) cursor.setDate(cursor.getDate() + 1);
    else cursor.setMonth(cursor.getMonth() + 1);
  }
  return buckets;
}

/**
 * Sección "Gastos" (CAM-52): todos los gastos cargados en las órdenes de trabajo, en un solo
 * lugar. El período se pide al backend; vehículo, categoría y origen se filtran acá, y cada
 * gráfico sirve también de filtro (se elige tocando un segmento o una barra).
 */
export function ExpensesSection({ onLogout, initialVehicleId }: ExpensesSectionProps) {
  const [period, setPeriod] = useState<Period>(() => (initialVehicleId ? lastTwelveMonths() : presetPeriod('year')));
  // Se incrementa para volver a pedir el mismo período (al cerrar una OT que pudo cambiar sus gastos).
  const [reloadKey, setReloadKey] = useState(0);
  const [loaded, setLoaded] = useState<{ key: string; expenses: Expense[] } | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [filters, setFilters] = useState<Filters>(() => ({ ...NO_FILTERS, vehicleId: initialVehicleId ?? '' }));
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [visibleRows, setVisibleRows] = useState(TABLE_PAGE_SIZE);
  // Búsqueda del listado: filtra solo la tabla, no los gráficos ni los totales de arriba.
  const [search, setSearch] = useState('');
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [openingWorkOrderId, setOpeningWorkOrderId] = useState<string | null>(null);

  const requestKey = `${period.from.getTime()}-${period.to.getTime()}-${reloadKey}`;
  const expenses = loaded?.expenses ?? null;
  // Mientras llega lo pedido se sigue viendo lo anterior, atenuado: sin saltos ni pantalla vacía.
  const loading = loaded != null && loaded.key !== requestKey;

  useEffect(() => {
    let cancelled = false;
    getExpenses(periodParams(period))
      .then((data) => {
        if (cancelled) return;
        setLoaded({ key: requestKey, expenses: data });
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (isSessionExpired(err)) setSessionExpired(true);
        else setError('No se pudieron cargar los gastos. Intentá de nuevo.');
        setLoaded((current) => (current ? { ...current, key: requestKey } : current));
      });
    return () => {
      cancelled = true;
    };
    // requestKey ya resume el período y el pedido de recarga.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  useEffect(() => {
    let cancelled = false;
    // Activos y dados de baja: un vehículo de baja puede tener gastos en el período.
    Promise.all([getVehicles(true), getVehicles(false)])
      .then(([active, inactive]) => {
        if (!cancelled) setVehicles([...active, ...inactive]);
      })
      .catch(() => {
        // Sin la flota igual se ven los gastos: el filtro usa los vehículos que traen.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function updateFilters(changes: Partial<Filters>) {
    setFilters((current) => ({ ...current, ...changes }));
    setVisibleRows(TABLE_PAGE_SIZE);
  }

  const vehicleById = useMemo(() => new Map(vehicles.map((vehicle) => [vehicle.id, vehicle])), [vehicles]);

  // Opciones del filtro: toda la flota, más cualquier vehículo que aparezca en los gastos.
  const vehicleOptions = useMemo(() => {
    const options = new Map<string, string>();
    for (const vehicle of vehicles) options.set(vehicle.id, vehicle.plate);
    for (const expense of expenses ?? []) {
      if (!options.has(expense.vehicleId)) options.set(expense.vehicleId, expense.plate ?? '—');
    }
    return [...options.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [vehicles, expenses]);

  const view = useMemo(() => {
    const all = expenses ?? [];
    const filtered = all.filter((expense) => matches(expense, filters));
    const total = sum(filtered);

    // Cada gráfico muestra el reparto de su propia dimensión con los OTROS filtros aplicados:
    // así, al elegir una categoría, la dona sigue mostrando las tres y resalta la elegida.
    const forCategories = all.filter((expense) => matches(expense, filters, 'category'));
    const categorySegments: DonutSegment[] = CATEGORIES.map((category, i) => ({
      key: category,
      label: EXPENSE_CATEGORY_LABEL[category],
      value: sum(forCategories.filter((expense) => expense.category === category)),
      color: SERIES_COLORS[i],
    }));

    const forOrigins = all.filter((expense) => matches(expense, filters, 'origin'));
    const originSegments: DonutSegment[] = ORIGINS.map((origin, i) => ({
      key: origin,
      label: EXPENSE_ORIGIN_LABEL[origin],
      value: sum(forOrigins.filter((expense) => expense.origin === origin)),
      color: SERIES_COLORS[i],
    }));

    const forVehicles = all.filter((expense) => matches(expense, filters, 'vehicleId'));
    const vehiclesTotal = sum(forVehicles);
    const byVehicle = new Map<string, { plate: string; amount: number }>();
    for (const expense of forVehicles) {
      const entry = byVehicle.get(expense.vehicleId) ?? { plate: expense.plate ?? '—', amount: 0 };
      entry.amount += expense.amount;
      byVehicle.set(expense.vehicleId, entry);
    }
    const vehicleBars: BarListItem[] = [...byVehicle.entries()]
      .sort((a, b) => b[1].amount - a[1].amount)
      .map(([vehicleId, entry]) => {
        const vehicle = vehicleById.get(vehicleId);
        return {
          key: vehicleId,
          label: entry.plate,
          mono: true,
          sublabel: vehicle ? `${vehicle.brand} ${vehicle.model}` : undefined,
          segments: [{ label: 'Gasto', value: entry.amount, color: 'var(--fg-chart-1)' }],
          valueLabel: `${currencyFormatter.format(entry.amount)} · ${Math.round((entry.amount / vehiclesTotal) * 100)}%`,
        };
      });

    const byWorkOrder = new Map<string, { title: string; plate: string; amount: number }>();
    for (const expense of filtered) {
      const entry = byWorkOrder.get(expense.workOrderId) ?? {
        title: expense.workOrderTitle,
        plate: expense.plate ?? '—',
        amount: 0,
      };
      entry.amount += expense.amount;
      byWorkOrder.set(expense.workOrderId, entry);
    }
    const workOrders = [...byWorkOrder.entries()]
      .map(([id, entry]) => ({ id, ...entry }))
      .sort((a, b) => b.amount - a.amount);

    const executionBars: BarListItem[] = (['interno', 'externo'] as const).map((executionType) => {
      const amount = sum(filtered.filter((expense) => expense.executionType === executionType));
      return {
        key: executionType,
        label: executionType === 'interno' ? 'Personal propio' : 'Taller externo',
        segments: [{ label: 'Gasto', value: amount, color: 'var(--fg-chart-1)' }],
        valueLabel: `${currencyFormatter.format(amount)} · ${total > 0 ? Math.round((amount / total) * 100) : 0}%`,
      };
    });

    return {
      filtered,
      total,
      executionBars,
      categorySegments,
      originSegments,
      vehicleBars,
      workOrders,
      timeline: overTime(filtered, period),
      topVehicle: filters.vehicleId ? null : (vehicleBars[0] ?? null),
    };
  }, [expenses, filters, period, vehicleById]);

  async function openWorkOrder(workOrderId: string) {
    setOpeningWorkOrderId(workOrderId);
    try {
      setSelectedWorkOrder(await getWorkOrder(workOrderId));
    } catch {
      setError('No se pudo abrir la orden de trabajo. Intentá de nuevo.');
    } finally {
      setOpeningWorkOrderId(null);
    }
  }

  const hasFilters = Boolean(filters.vehicleId || filters.category || filters.origin);
  const searchTerms = normalizeText(search).split(/\s+/).filter(Boolean);
  const listed = searchTerms.length ? view.filtered.filter((expense) => matchesSearch(expense, searchTerms)) : view.filtered;
  const listedTotal = sum(listed);
  const periodLabel = describePeriod(period);

  /**
   * CAM-108: el CSV trae exactamente las filas del listado, con todos los filtros y la búsqueda.
   * El nombre dice el período y, si hay un vehículo elegido, su patente.
   */
  function exportCsv() {
    // Saneada antes de decidir si va: un vehículo sin patente figura como "—" y quedaría vacía.
    const plate = filters.vehicleId
      ? (vehicleOptions.find(([id]) => id === filters.vehicleId)?.[1] ?? '').replace(/[^A-Za-z0-9]/g, '')
      : '';
    const name = [
      'gastos',
      toDateInputValue(period.from),
      'al',
      toDateInputValue(lastDayOf(period)),
      ...(plate ? [plate] : []),
    ].join('_');
    downloadCsv(`${name}.csv`, buildExpensesCsv(listed));
  }

  return (
    <section className="fleet-status vehicles-section expenses">
      <header className="fleet-status__header expenses__header">
        <h1 className="fleet-status__title">Gastos</h1>
        {!sessionExpired && (
          <div className="expenses__filters">
            <PeriodFilter period={period} onChange={setPeriod} />
            <select
              className="work-orders__filter"
              value={filters.vehicleId}
              onChange={(e) => updateFilters({ vehicleId: e.target.value })}
              aria-label="Vehículo"
            >
              <option value="">Todos los vehículos</option>
              {vehicleOptions.map(([id, plate]) => (
                <option key={id} value={id}>
                  {plate}
                </option>
              ))}
            </select>
            <select
              className="work-orders__filter"
              value={filters.category}
              onChange={(e) => updateFilters({ category: e.target.value as Filters['category'] })}
              aria-label="Categoría"
            >
              <option value="">Todas las categorías</option>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {EXPENSE_CATEGORY_LABEL[category]}
                </option>
              ))}
            </select>
            <select
              className="work-orders__filter"
              value={filters.origin}
              onChange={(e) => updateFilters({ origin: e.target.value as Filters['origin'] })}
              aria-label="Origen"
            >
              <option value="">Todos los orígenes</option>
              {ORIGINS.map((origin) => (
                <option key={origin} value={origin}>
                  {EXPENSE_ORIGIN_LABEL[origin]}
                </option>
              ))}
            </select>
            {hasFilters && (
              <button type="button" className="expenses__clear" onClick={() => updateFilters(NO_FILTERS)}>
                Limpiar filtros
              </button>
            )}
          </div>
        )}
      </header>

      {sessionExpired ? (
        <div className="error-banner users-section__session">
          <p>{SESSION_EXPIRED_MESSAGE}</p>
          <button type="button" className="secondary-btn" onClick={onLogout}>
            Cerrar sesión
          </button>
        </div>
      ) : (
        <>
          {error && <p className="error-banner">{error}</p>}
          {!expenses && !error && <p className="muted">Cargando gastos…</p>}

          {expenses && (
            // Al cambiar el período se mantiene lo anterior, atenuado, hasta que llega lo nuevo.
            <div className={`expenses__body${loading ? ' expenses__body--loading' : ''}`}>
              <div className="expenses__kpis">
                <div className="fleet-kpi expenses__kpi expenses__kpi--hero">
                  <span className="fleet-kpi__label">Total del período</span>
                  <span className="expenses__kpi-value">{currencyFormatter.format(view.total)}</span>
                  <span className="fleet-kpi__sublabel">{periodLabel}</span>
                </div>
                <div className="fleet-kpi expenses__kpi">
                  <span className="fleet-kpi__label">Órdenes con gastos</span>
                  <span className="expenses__kpi-value">{view.workOrders.length}</span>
                  <span className="fleet-kpi__sublabel">
                    {view.filtered.length} {view.filtered.length === 1 ? 'gasto cargado' : 'gastos cargados'}
                  </span>
                </div>
                <div className="fleet-kpi expenses__kpi">
                  <span className="fleet-kpi__label">Promedio por orden</span>
                  <span className="expenses__kpi-value">
                    {currencyFormatter.format(view.workOrders.length ? view.total / view.workOrders.length : 0)}
                  </span>
                  <span className="fleet-kpi__sublabel">Entre las órdenes con gastos</span>
                </div>
                <div className="fleet-kpi expenses__kpi">
                  <span className="fleet-kpi__label">Vehículo con más gasto</span>
                  <span className="expenses__kpi-value expenses__kpi-value--mono">{view.topVehicle?.label ?? '—'}</span>
                  <span className="fleet-kpi__sublabel">
                    {view.topVehicle?.valueLabel ?? (filters.vehicleId ? 'Ya hay un vehículo elegido' : 'Sin gastos en el período')}
                  </span>
                </div>
              </div>

              {view.filtered.length === 0 ? (
                <div className="chart-card expenses__empty">
                  <p className="expenses__empty-title">No hay gastos para mostrar</p>
                  <p className="muted">
                    {hasFilters
                      ? 'Ningún gasto del período coincide con los filtros elegidos.'
                      : `No se cargaron gastos entre el ${periodLabel}.`}
                  </p>
                </div>
              ) : (
                <>
                  <div className="expenses__row expenses__row--charts">
                    <div className="chart-card">
                      <div className="chart-card__header">
                        <h2 className="chart-card__title">Por categoría</h2>
                      </div>
                      <DonutChart
                        segments={view.categorySegments}
                        formatValue={currencyFormatter.format}
                        formatCompact={compactCurrencyFormatter.format}
                        selectedKey={filters.category || null}
                        onSelect={(key) => updateFilters({ category: (key ?? '') as Filters['category'] })}
                      />
                    </div>
                    <div className="chart-card">
                      <div className="chart-card__header">
                        <h2 className="chart-card__title">Preventivo y correctivo</h2>
                      </div>
                      <DonutChart
                        segments={view.originSegments}
                        formatValue={currencyFormatter.format}
                        formatCompact={compactCurrencyFormatter.format}
                        selectedKey={filters.origin || null}
                        onSelect={(key) => updateFilters({ origin: (key ?? '') as Filters['origin'] })}
                      />
                    </div>
                    <div className="chart-card">
                      <div className="chart-card__header">
                        <h2 className="chart-card__title">Evolución del gasto</h2>
                        <span className="chart-card__hint">{isDaily(period) ? 'Por día' : 'Por mes'}</span>
                      </div>
                      <ColumnChart
                        data={view.timeline}
                        formatValue={currencyFormatter.format}
                        formatCompact={compactCurrencyFormatter.format}
                        ariaLabel={`Gasto del ${periodLabel}, partido por origen: preventivo, correctivo y órdenes sueltas. ${currencyFormatter.format(view.total)} en total. El detalle está en el listado de gastos.`}
                      />
                    </div>
                  </div>

                  <div className="expenses__row expenses__row--breakdown">
                    <div className="chart-card">
                      <div className="chart-card__header">
                        <h2 className="chart-card__title">Gasto por vehículo</h2>
                        <span className="chart-card__hint">Tocá un vehículo para filtrar</span>
                      </div>
                      <BarList
                        items={view.vehicleBars}
                        selectedKey={filters.vehicleId || null}
                        onSelect={(key) => updateFilters({ vehicleId: key ?? '' })}
                      />
                    </div>
                    <div className="expenses__side">
                      <div className="chart-card">
                        <div className="chart-card__header">
                          <h2 className="chart-card__title">Quién hizo el trabajo</h2>
                        </div>
                        <BarList items={view.executionBars} />
                      </div>
                      <div className="chart-card expenses__top-card">
                        <div className="chart-card__header">
                          <h2 className="chart-card__title">Órdenes más costosas</h2>
                        </div>
                      <ol className="expenses__top-list">
                        {view.workOrders.slice(0, 5).map((workOrder) => (
                          <li key={workOrder.id}>
                            <button
                              type="button"
                              className="expenses__top-item"
                              onClick={() => void openWorkOrder(workOrder.id)}
                              disabled={openingWorkOrderId === workOrder.id}
                            >
                              <span className="expenses__top-info">
                                <span className="expenses__top-title">{workOrder.title}</span>
                                <span className="expenses__top-plate">{workOrder.plate}</span>
                              </span>
                              <span className="expenses__top-amount">{currencyFormatter.format(workOrder.amount)}</span>
                            </button>
                          </li>
                        ))}
                      </ol>
                      </div>
                    </div>
                  </div>

                  <div className="expenses__list-header">
                    <h2 className="chart-card__title">Detalle de gastos</h2>
                    <div className="expenses__list-actions">
                      <input
                        type="search"
                        className="work-orders__filter expenses__search"
                        placeholder="Buscar en la descripción"
                        value={search}
                        onChange={(e) => {
                          setSearch(e.target.value);
                          setVisibleRows(TABLE_PAGE_SIZE);
                        }}
                        aria-label="Buscar gastos por descripción"
                      />
                      <button
                        type="button"
                        className="secondary-btn expenses__export"
                        onClick={exportCsv}
                        disabled={listed.length === 0}
                        title={`Descarga los ${listed.length} gastos del listado, con los filtros y la búsqueda aplicados`}
                      >
                        Exportar CSV
                      </button>
                    </div>
                  </div>
                  <div className="fleet-status__table-wrap">
                    <table className="fleet-status__table expenses__table">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Vehículo</th>
                          <th>Categoría</th>
                          <th>Descripción</th>
                          <th>Orden de trabajo</th>
                          <th className="expenses__amount-col">Monto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {listed.length === 0 && (
                          <tr>
                            <td colSpan={6} className="muted expenses__no-match">
                              Ningún gasto tiene «{search.trim()}» en la descripción.
                            </td>
                          </tr>
                        )}
                        {listed.slice(0, visibleRows).map((expense) => (
                          <tr key={expense.id}>
                            <td className="fleet-status__km">{formatShortDate(expense.date)}</td>
                            <td className="fleet-status__plate">{expense.plate ?? '—'}</td>
                            <td>{EXPENSE_CATEGORY_LABEL[expense.category]}</td>
                            <td>
                              <span className="expenses__description" title={expense.description}>
                                {expense.description}
                              </span>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="expenses__wo-link"
                                onClick={() => void openWorkOrder(expense.workOrderId)}
                                disabled={openingWorkOrderId === expense.workOrderId}
                                title="Abrir la orden de trabajo"
                              >
                                {expense.workOrderTitle}
                              </button>
                            </td>
                            <td className="fleet-status__km expenses__amount-col">{currencyFormatter.format(expense.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={5}>
                            {searchTerms.length
                              ? `${listed.length} de ${view.filtered.length} gastos coinciden con la búsqueda`
                              : `Total de ${listed.length} ${listed.length === 1 ? 'gasto' : 'gastos'}`}
                          </td>
                          <td className="fleet-status__km expenses__amount-col">{currencyFormatter.format(listedTotal)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  {listed.length > visibleRows && (
                    <button
                      type="button"
                      className="secondary-btn expenses__more"
                      onClick={() => setVisibleRows((rows) => rows + TABLE_PAGE_SIZE)}
                    >
                      Ver {Math.min(TABLE_PAGE_SIZE, listed.length - visibleRows)} más
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}

      {selectedWorkOrder && (
        <WorkOrderDetailModal
          workOrder={selectedWorkOrder}
          onClose={() => {
            setSelectedWorkOrder(null);
            // En el detalle se pueden cargar o borrar gastos: se vuelve a pedir el período.
            setReloadKey((key) => key + 1);
          }}
          onUpdated={setSelectedWorkOrder}
        />
      )}
    </section>
  );
}
