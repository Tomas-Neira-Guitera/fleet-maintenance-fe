import { useEffect, useState } from 'react';
import { ApiError } from '../../services/apiClient';
import { deleteFuelLoad, getVehicleFuel } from '../../services/fuelService';
import type { FuelLoad, VehicleFuel } from '../../types/domain';
import { formatDayAndTime } from '../../utils/dateFormat';
import {
  formatConsumption,
  formatCostPerKm,
  formatLiters,
  formatMonth,
  percentAbove,
} from '../../utils/fuelFormat';
import { currencyFormatter, numberFormatter } from '../../utils/maintenanceFormat';
import { ColumnChart, type ColumnDatum } from '../charts/ColumnChart';
import { AlertTriangleIcon, PencilIcon, TrashIcon } from '../icons';
import { FuelLoadFormModal } from './FuelLoadFormModal';
import '../../styles/charts.css';
import '../../styles/dashboard.css';
import '../../styles/fuel.css';

const MONTH_OPTIONS = [3, 6, 12];

interface VehicleFuelTabProps {
  vehicleId: string;
  plate: string;
  currentKm: number;
  /** Un vehículo dado de baja no recibe cargas nuevas. */
  readOnly?: boolean;
  /** Después de cargar: el km del vehículo puede haber cambiado. */
  onChanged?: () => void;
}

/** CAM-156: consumo de combustible de los últimos meses y las cargas, con alta, corrección y baja. */
export function VehicleFuelTab({ vehicleId, plate, currentKm, readOnly = false, onChanged }: VehicleFuelTabProps) {
  const [months, setMonths] = useState(6);
  const [fuel, setFuel] = useState<VehicleFuel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState<FuelLoad | 'new' | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getVehicleFuel(vehicleId, months)
      .then((loaded) => {
        if (!cancelled) {
          setFuel(loaded);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo cargar el consumo del vehículo.');
      });
    return () => {
      cancelled = true;
    };
  }, [vehicleId, months, reloadKey]);

  async function handleDelete(load: FuelLoad) {
    if (!window.confirm(`¿Borrar la carga de ${formatLiters(load.liters)} del ${formatDayAndTime(load.loadedAt)}?`)) return;
    setBusyId(load.id);
    try {
      await deleteFuelLoad(load.id);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo borrar la carga.');
    } finally {
      setBusyId(null);
    }
  }

  const chartData: ColumnDatum[] =
    fuel?.monthly.map((m) => ({
      key: m.month,
      label: formatMonth(m.month),
      fullLabel: formatMonth(m.month, 'long'),
      segments: [{ label: 'Consumo', value: m.litersPer100Km ?? 0, color: 'var(--fg-chart-1)' }],
    })) ?? [];
  const hasConsumption = fuel?.monthly.some((m) => m.litersPer100Km != null) ?? false;

  return (
    <section className="vehicle-detail__card vehicle-fuel">
      <header className="vehicle-fuel__header">
        <h2 className="vehicle-detail__card-title">Combustible</h2>
        <div className="vehicle-fuel__months">
          <label>
            Últimos{' '}
            <select className="schedule-picker__input" value={months} onChange={(e) => setMonths(Number(e.target.value))}>
              {MONTH_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m} meses
                </option>
              ))}
            </select>
          </label>
          {!readOnly && (
            <button type="button" className="primary-btn" onClick={() => setEditing('new')}>
              Cargar combustible
            </button>
          )}
        </div>
      </header>

      {error && <p className="error-banner">{error}</p>}
      {!fuel && !error && <p className="muted">Cargando consumo…</p>}

      {fuel && (
        <>
          <div className="vehicle-fuel__summary">
            <div className="vehicle-fuel__stat">
              <span className="vehicle-fuel__stat-value">{formatConsumption(fuel.summary.litersPer100Km)}</span>
              <span className="vehicle-fuel__stat-label">Consumo promedio</span>
            </div>
            <div className="vehicle-fuel__stat">
              <span className="vehicle-fuel__stat-value">{formatCostPerKm(fuel.summary.costPerKm)}</span>
              <span className="vehicle-fuel__stat-label">Costo de combustible por km</span>
            </div>
            <div className="vehicle-fuel__stat">
              <span className="vehicle-fuel__stat-value">{formatLiters(fuel.summary.liters)}</span>
              <span className="vehicle-fuel__stat-label">
                {fuel.summary.loadCount} {fuel.summary.loadCount === 1 ? 'carga' : 'cargas'} ·{' '}
                {currencyFormatter.format(fuel.summary.amount)}
              </span>
            </div>
            <div className="vehicle-fuel__stat">
              <span className="vehicle-fuel__stat-value">{numberFormatter.format(fuel.summary.measuredKm)} km</span>
              <span className="vehicle-fuel__stat-label">Medidos entre tanques llenos</span>
            </div>
          </div>

          {hasConsumption ? (
            <div className="chart-card">
              <div className="chart-card__header">
                <h3 className="chart-card__title">Consumo por mes</h3>
              </div>
              <ColumnChart
                data={chartData}
                formatValue={(v) => formatConsumption(v)}
                formatCompact={(v) => numberFormatter.format(Math.round(v))}
                ariaLabel={`Consumo de ${plate} por mes, en litros cada 100 km`}
              />
            </div>
          ) : (
            <p className="muted">
              El consumo se calcula entre dos cargas de tanque lleno. Todavía no hay dos en este período.
            </p>
          )}

          {fuel.loads.length > 0 && (
            <div className="fleet-status__table-wrap">
              <table className="fleet-status__table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th className="fleet-status__km">Km</th>
                    <th className="fleet-status__km">Litros</th>
                    <th className="fleet-status__km">Monto</th>
                    <th>Consumo del tramo</th>
                    <th>Cargó</th>
                    {!readOnly && <th aria-label="Acciones" />}
                  </tr>
                </thead>
                <tbody>
                  {fuel.loads.map((load) => (
                    <tr key={load.id}>
                      <td>{formatDayAndTime(load.loadedAt)}</td>
                      <td className="fleet-status__km">{numberFormatter.format(load.odometerKm)}</td>
                      <td className="fleet-status__km">
                        {formatLiters(load.liters)}
                        {!load.fullTank && <div className="vehicle-fuel__partial">Parcial</div>}
                      </td>
                      <td className="fleet-status__km">{currencyFormatter.format(load.amount)}</td>
                      <td>
                        {load.consumption ? (
                          <>
                            {formatConsumption(load.consumption.litersPer100Km)}
                            <div className="vehicle-fuel__partial">
                              {numberFormatter.format(load.consumption.km)} km ·{' '}
                              {formatCostPerKm(load.consumption.costPerKm)}
                            </div>
                          </>
                        ) : (
                          '—'
                        )}
                        {load.alert && (
                          <span
                            className="vehicle-fuel__alert"
                            title={`Promedio anterior: ${formatConsumption(load.alert.averageLitersPer100Km)}`}
                          >
                            <AlertTriangleIcon width={12} height={12} aria-hidden="true" />
                            {percentAbove(load.alert.litersPer100Km, load.alert.averageLitersPer100Km)}% sobre el promedio
                          </span>
                        )}
                      </td>
                      <td>{load.createdBy?.name ?? '—'}</td>
                      {!readOnly && (
                        <td>
                          <div className="vehicle-fuel__actions">
                            <button
                              type="button"
                              className="vehicle-maintenance-list__icon-btn"
                              onClick={() => setEditing(load)}
                              aria-label="Corregir la carga"
                              title="Corregir"
                            >
                              <PencilIcon width={14} height={14} />
                            </button>
                            <button
                              type="button"
                              className="vehicle-maintenance-list__icon-btn"
                              onClick={() => void handleDelete(load)}
                              disabled={busyId === load.id}
                              aria-label="Borrar la carga"
                              title="Borrar"
                            >
                              <TrashIcon width={14} height={14} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {fuel.loads.length === 0 && <p className="muted">No hay cargas en este período.</p>}
        </>
      )}

      {editing && (
        <FuelLoadFormModal
          vehicleId={vehicleId}
          plate={plate}
          currentKm={currentKm}
          load={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setReloadKey((k) => k + 1);
            onChanged?.();
          }}
        />
      )}
    </section>
  );
}
