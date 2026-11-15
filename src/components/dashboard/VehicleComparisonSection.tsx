import { useEffect, useState } from 'react';
import { describeApiError } from '../../services/apiClient';
import { getVehicleComparison } from '../../services/vehicleComparisonService';
import type { VehicleComparison, VehicleComparisonRow } from '../../types/domain';
import { currencyFormatter, numberFormatter } from '../../utils/maintenanceFormat';
import type { Period } from '../../utils/period';
import {
  costPerKm,
  describeReview,
  sortComparison,
  type ComparisonColumn,
  type ComparisonSort,
  type CostBasis,
} from '../../utils/vehicleComparison';
import { lastTwelveMonths } from '../../utils/vehicleHistoryReport';
import { AlertTriangleIcon, ArrowLeftIcon } from '../icons';
import { PeriodFilter } from './PeriodFilter';
import '../../styles/dashboard.css';

const NO_DATA = 'Sin datos';

const COLUMNS: { column: ComparisonColumn; label: string; numeric: boolean }[] = [
  { column: 'plate', label: 'Vehículo', numeric: false },
  { column: 'year', label: 'Año', numeric: true },
  { column: 'maintenanceCost', label: 'Mantenimiento', numeric: true },
  { column: 'operatingCost', label: 'Operativo', numeric: true },
  { column: 'totalCost', label: 'Gasto total', numeric: true },
  { column: 'kmDriven', label: 'Km recorridos', numeric: true },
  { column: 'costPerKm', label: 'Costo por km', numeric: true },
  { column: 'availabilityPct', label: 'Disponibilidad', numeric: true },
  { column: 'downtimeHours', label: 'Horas parado', numeric: true },
  { column: 'recurringControls', label: 'Fallas recurrentes', numeric: true },
];

/** Las columnas donde lo peor es lo más bajo (o la patente, en orden alfabético). */
const ASCENDING_FIRST: ComparisonColumn[] = ['plate', 'year', 'availabilityPct'];

const money = (value: number | null) => (value == null ? NO_DATA : currencyFormatter.format(value));
const km = (value: number | null) => (value == null ? NO_DATA : `${numberFormatter.format(Math.round(value))} km`);
const pct = (value: number | null) => (value == null ? NO_DATA : `${value.toLocaleString('es-AR', { maximumFractionDigits: 1 })} %`);
const hours = (value: number | null) => (value == null ? NO_DATA : `${value.toLocaleString('es-AR', { maximumFractionDigits: 1 })} h`);
const count = (value: number | null) => (value == null ? NO_DATA : value.toLocaleString('es-AR', { maximumFractionDigits: 1 }));
const perKm = (value: number | null) =>
  value == null ? NO_DATA : `${value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 })}`;

interface VehicleComparisonSectionProps {
  onOpenVehicle: (vehicleId: string) => void;
  onBack: () => void;
}

/**
 * "Comparar" de Vehículos (CAM-140): los indicadores de cada vehículo activo en un período, con el
 * promedio de la flota, para decidir cuál conviene seguir reparando y cuál reemplazar. La marca "Para
 * revisar" solo señala qué mirar: la decisión es del admin.
 */
export function VehicleComparisonSection({ onOpenVehicle, onBack }: VehicleComparisonSectionProps) {
  const [period, setPeriod] = useState<Period>(() => lastTwelveMonths());
  const [basis, setBasis] = useState<CostBasis>('maintenance');
  const [sort, setSort] = useState<ComparisonSort>({ column: 'costPerKm', direction: 'desc' });
  const [data, setData] = useState<VehicleComparison | null>(null);
  const [error, setError] = useState<string | null>(null);

  const key = `${period.from.toISOString()}|${period.to.toISOString()}`;
  useEffect(() => {
    let cancelled = false;
    setError(null);
    setData(null);
    getVehicleComparison(period)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(describeApiError(err, 'No se pudo cargar la comparación. Intentá de nuevo.'));
      });
    return () => {
      cancelled = true;
    };
    // key resume el período: el objeto cambia de identidad en cada render del filtro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Al elegir una columna, primero lo peor: el costo más alto, la disponibilidad más baja, el más viejo.
  function toggleSort(column: ComparisonColumn) {
    setSort((current) =>
      current.column === column
        ? { column, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { column, direction: ASCENDING_FIRST.includes(column) ? 'asc' : 'desc' },
    );
  }

  const rows = data ? sortComparison(data.vehicles, sort, basis) : null;
  const fleet = data?.fleet;
  const flaggedCount = data?.vehicles.filter((row) => row.review.flagged).length ?? 0;

  return (
    <section className="fleet-status comparison">
      <button type="button" className="top-nav__back" onClick={onBack}>
        <ArrowLeftIcon width={16} height={16} />
        Volver
      </button>
      <header className="fleet-status__header comparison__header">
        <h1 className="fleet-status__title">Comparar vehículos</h1>
        <div className="comparison__filters">
          <PeriodFilter period={period} onChange={setPeriod} />
          <div className="comparison__basis" role="group" aria-label="Costo por km">
            <button
              type="button"
              className={`comparison__basis-btn${basis === 'maintenance' ? ' comparison__basis-btn--active' : ''}`}
              aria-pressed={basis === 'maintenance'}
              onClick={() => setBasis('maintenance')}
            >
              Solo mantenimiento
            </button>
            <button
              type="button"
              className={`comparison__basis-btn${basis === 'total' ? ' comparison__basis-btn--active' : ''}`}
              aria-pressed={basis === 'total'}
              onClick={() => setBasis('total')}
            >
              Costo total
            </button>
          </div>
        </div>
      </header>
      <p className="muted comparison__hint">
        Los vehículos peores que el promedio en al menos dos de estos tres quedan "Para revisar": costo por km de
        mantenimiento, disponibilidad y fallas recurrentes. Solo señala qué mirar: la decisión es tuya.
      </p>

      {error && (
        <p className="error-banner error-banner--icon">
          <AlertTriangleIcon width={16} height={16} />
          {error}
        </p>
      )}
      {!data && !error && <p className="muted">Cargando la comparación…</p>}
      {rows && rows.length === 0 && <p className="muted">No hay vehículos activos para comparar.</p>}

      {rows && rows.length > 0 && fleet && (
        <>
          {flaggedCount > 0 && (
            <p className="comparison__summary">
              {flaggedCount === 1 ? '1 vehículo para revisar' : `${flaggedCount} vehículos para revisar`}
            </p>
          )}
          <div className="fleet-status__table-wrap">
            <table className="fleet-status__table comparison__table">
              <thead>
                <tr>
                  {COLUMNS.map(({ column, label, numeric }) => {
                    const active = sort.column === column;
                    return (
                      <th
                        key={column}
                        className={numeric ? 'comparison__num' : undefined}
                        aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                      >
                        <button type="button" className="comparison__sort" onClick={() => toggleSort(column)}>
                          {label}
                          <span aria-hidden="true" className="comparison__sort-arrow">
                            {active ? (sort.direction === 'asc' ? '▲' : '▼') : ''}
                          </span>
                        </button>
                      </th>
                    );
                  })}
                  <th>Para revisar</th>
                </tr>
              </thead>
              <tbody>
                <tr className="comparison__average">
                  <td>Promedio de la flota</td>
                  <td className="comparison__num">—</td>
                  <td className="comparison__num">{money(fleet.maintenanceCost)}</td>
                  <td className="comparison__num">{money(fleet.operatingCost)}</td>
                  <td className="comparison__num">{money(fleet.totalCost)}</td>
                  <td className="comparison__num">{km(fleet.kmDriven)}</td>
                  <td className="comparison__num">
                    {perKm(basis === 'maintenance' ? fleet.maintenanceCostPerKm : fleet.totalCostPerKm)}
                  </td>
                  <td className="comparison__num">{pct(fleet.availabilityPct)}</td>
                  <td className="comparison__num">
                    {hours(fleet.downtimeHours)}
                    {fleet.stops != null && <span className="comparison__vehicle-meta">{count(fleet.stops)} paradas</span>}
                  </td>
                  <td className="comparison__num">{count(fleet.recurringControls)}</td>
                  <td />
                </tr>
                {rows.map((row) => (
                  <ComparisonRow key={row.vehicleId} row={row} basis={basis} onOpen={() => onOpenVehicle(row.vehicleId)} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function ComparisonRow({ row, basis, onOpen }: { row: VehicleComparisonRow; basis: CostBasis; onOpen: () => void }) {
  const description = [row.brand, row.model].filter(Boolean).join(' ');
  return (
    <tr
      className={`fleet-status__row${row.review.flagged ? ' comparison__row--flagged' : ''}`}
      onClick={onOpen}
      title="Ver detalle del vehículo"
    >
      <td>
        <span className="fleet-status__plate">
          <button
            type="button"
            className="vehicles-section__plate-link"
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
          >
            {row.plate}
          </button>
        </span>
        {description && <span className="comparison__vehicle-meta">{description}</span>}
      </td>
      <td className="comparison__num">{row.year ?? '—'}</td>
      <td className="comparison__num">{money(row.maintenanceCost)}</td>
      <td className="comparison__num">{money(row.operatingCost)}</td>
      <td className="comparison__num">{money(row.totalCost)}</td>
      <td className={`comparison__num${row.kmDriven == null ? ' comparison__no-data' : ''}`}>{km(row.kmDriven)}</td>
      <td className={`comparison__num${costPerKm(row, basis) == null ? ' comparison__no-data' : ''}`}>
        {perKm(costPerKm(row, basis))}
      </td>
      <td className={`comparison__num${row.availabilityPct == null ? ' comparison__no-data' : ''}`}>
        {pct(row.availabilityPct)}
      </td>
      <td className="comparison__num">
        {hours(row.downtimeHours)}
        <span className="comparison__vehicle-meta">
          {row.stops === 1 ? '1 parada' : `${row.stops} paradas`}
        </span>
      </td>
      <td className="comparison__num">{row.recurringControls}</td>
      <td>
        {row.review.flagged && (
          <span className="comparison__review">
            <span className="fleet-status-badge fleet-status-badge--vencido">Para revisar</span>
            <span className="comparison__review-reason">{describeReview(row.review.reasons)}</span>
          </span>
        )}
      </td>
    </tr>
  );
}
