import { useEffect, useState } from 'react';
import { ApiError } from '../../services/apiClient';
import { deleteTire, getTireBrandComparison, getTires, retireTire } from '../../services/tiresService';
import type { Tire, TireBrandComparison, TireStatus } from '../../types/domain';
import { formatShortDate } from '../../utils/dateFormat';
import { formatCostPerKm } from '../../utils/fuelFormat';
import { currencyFormatter, numberFormatter } from '../../utils/maintenanceFormat';
import { formatTread, TIRE_STATUS_LABEL, tireLabel } from '../../utils/tireFormat';
import { ArrowLeftIcon, PencilIcon, TrashIcon } from '../icons';
import { TireFormModal } from './TireModals';
import '../../styles/dashboard.css';
import '../../styles/tires.css';

const STATUSES: TireStatus[] = ['stock', 'mounted', 'retired'];

interface TiresSectionProps {
  onBack: () => void;
  onOpenVehicle: (vehicleId: string) => void;
}

/** CAM-157: inventario de cubiertas (stock, montadas, dadas de baja) y costo por km por marca. */
export function TiresSection({ onBack, onOpenVehicle }: TiresSectionProps) {
  const [tires, setTires] = useState<Tire[] | null>(null);
  const [comparison, setComparison] = useState<TireBrandComparison | null>(null);
  const [status, setStatus] = useState<TireStatus | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Tire | 'new' | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getTires(), getTireBrandComparison()])
      .then(([loaded, byBrand]) => {
        if (cancelled) return;
        setTires(loaded);
        setComparison(byBrand);
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

  const listed = tires?.filter((t) => !status || t.status === status) ?? [];

  return (
    <section className="fleet-status tires-section">
      <button type="button" className="top-nav__back" onClick={onBack}>
        <ArrowLeftIcon width={16} height={16} />
        Volver
      </button>
      <header className="fleet-status__header">
        <h1 className="fleet-status__title">Cubiertas</h1>
        <div className="tires-header__actions">
          <select
            className="schedule-picker__input"
            value={status}
            onChange={(e) => setStatus(e.target.value as TireStatus | '')}
            aria-label="Filtrar por estado"
          >
            <option value="">Todas</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {TIRE_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <button type="button" className="primary-btn vehicles-section__new-btn" onClick={() => setEditing('new')}>
            + Nueva cubierta
          </button>
        </div>
      </header>

      {error && <p className="error-banner">{error}</p>}
      {!tires && !error && <p className="muted">Cargando cubiertas…</p>}

      {tires && (
        <div className="tires-section__grid">
          <aside className="vehicle-detail__card tires-section__brands">
            <h2 className="vehicle-detail__card-title">Costo por km por marca</h2>
            {comparison && comparison.brands.length === 0 && (
              <p className="muted">
                Todavía no hay cubiertas con {numberFormatter.format(comparison.minKm)} km o más para comparar.
              </p>
            )}
            {comparison && comparison.brands.length > 0 && (
              <>
                <table className="fleet-status__table">
                  <thead>
                    <tr>
                      <th>Marca</th>
                      <th className="fleet-status__km">Costo por km</th>
                      <th className="fleet-status__km">Km promedio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.brands.map((b) => (
                      <tr key={b.brand}>
                        <td>
                          {b.brand}
                          <div className="vehicle-fuel__partial">
                            {b.tires} {b.tires === 1 ? 'cubierta' : 'cubiertas'}
                            {b.retired > 0 ? ` · ${b.retired} de baja` : ''}
                          </div>
                        </td>
                        <td className="fleet-status__km">{formatCostPerKm(b.costPerKm)}</td>
                        <td className="fleet-status__km">{numberFormatter.format(b.averageKm)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="vehicle-detail__item-meta">
                  Costo de compra sobre km recorridos, de las cubiertas con al menos{' '}
                  {numberFormatter.format(comparison.minKm)} km.
                </p>
              </>
            )}
          </aside>
          <div className="fleet-status__table-wrap">
            {listed.length === 0 ? (
              <p className="muted">
                {tires.length === 0 ? 'Todavía no cargaste cubiertas.' : 'No hay cubiertas con ese estado.'}
              </p>
            ) : (
              <table className="fleet-status__table">
                <thead>
                  <tr>
                    <th>Cubierta</th>
                    <th>Estado</th>
                    <th>Dónde está</th>
                    <th className="fleet-status__km">Km</th>
                    <th className="fleet-status__km">Costo por km</th>
                    <th>Dibujo</th>
                    <th aria-label="Acciones" />
                  </tr>
                </thead>
                <tbody>
                  {listed.map((tire) => (
                    <tr key={tire.id}>
                      <td>
                        <div className="fleet-status__vehicle">
                          <span className="fleet-status__vehicle-name">{tireLabel(tire)}</span>
                          <span className="fleet-status__vehicle-type">
                            {tire.size} · {currencyFormatter.format(tire.cost)} · {formatShortDate(tire.purchaseDate)}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={`tire-status tire-status--${tire.status}`}>{TIRE_STATUS_LABEL[tire.status]}</span>
                        {tire.retiredReason && <div className="vehicle-fuel__partial">{tire.retiredReason}</div>}
                      </td>
                      <td>
                        {tire.current ? (
                          <button
                            type="button"
                            className="expenses__wo-link"
                            onClick={() => onOpenVehicle(tire.current!.vehicleId)}
                          >
                            {tire.current.plate} · {tire.current.positionLabel}
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="fleet-status__km">{numberFormatter.format(tire.km)}</td>
                      <td className="fleet-status__km">{formatCostPerKm(tire.costPerKm)}</td>
                      <td className={tire.lastTread?.belowMinimum ? 'tire-slot__tread--low' : undefined}>
                        {tire.lastTread ? formatTread(tire.lastTread.depthMm) : '—'}
                      </td>
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

        </div>
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
