import { useEffect, useState } from 'react';
import { ApiError } from '../../services/apiClient';
import { getVehicleTires, rotateTires } from '../../services/tiresService';
import type { VehicleTirePosition, VehicleTires } from '../../types/domain';
import { formatShortDate } from '../../utils/dateFormat';
import { formatCostPerKm } from '../../utils/fuelFormat';
import { currencyFormatter, numberFormatter } from '../../utils/maintenanceFormat';
import { tireHealth, tireLabel } from '../../utils/tireFormat';
import { vehicleTypeLabel } from '../../utils/vehicleTypes';
import { MountTireModal, UnmountTireModal } from './TireModals';
import { VehicleTopView } from './VehicleTopView';
import '../../styles/dashboard.css';
import '../../styles/tires.css';

type Action = { kind: 'mount' | 'unmount'; slot: VehicleTirePosition };

interface VehicleTiresTabProps {
  vehicleId: string;
  /** Un vehículo dado de baja se ve, pero no se le montan ni rotan cubiertas. */
  readOnly?: boolean;
  /** Abre el inventario de cubiertas. */
  onOpenTires?: () => void;
  /** Lleva a editar el vehículo, para elegir su tipo. */
  onEditVehicle?: () => void;
}

/**
 * CAM-157: el vehículo visto de arriba con sus cubiertas, pintadas según lo que reportaron los choferes. Las
 * posiciones salen de su tipo. Tocar una cubierta muestra al costado sus datos y qué hacer con ella; para rotar,
 * se toca "Rotar" y después la posición destino.
 */
export function VehicleTiresTab({ vehicleId, readOnly = false, onOpenTires, onEditVehicle }: VehicleTiresTabProps) {
  const [data, setData] = useState<VehicleTires | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [rotatingFrom, setRotatingFrom] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getVehicleTires(vehicleId)
      .then((loaded) => {
        if (cancelled) return;
        setData(loaded);
        // Arranca con la primera con problemas (o la primera montada), para que el panel no quede vacío.
        setSelected(
          loaded.positions.find((p) => tireHealth(p.tire) !== 'ok')?.position ??
            loaded.positions.find((p) => p.tire)?.position ??
            loaded.positions[0]?.position ??
            null,
        );
      })
      .catch(() => {
        if (!cancelled) setError('No se pudieron cargar las cubiertas del vehículo.');
      });
    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  function done(updated: VehicleTires) {
    setData(updated);
    setAction(null);
  }

  async function handleSelect(position: string) {
    if (!rotatingFrom) {
      setSelected(position);
      return;
    }
    if (position === rotatingFrom) {
      setRotatingFrom(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setData(await rotateTires(vehicleId, rotatingFrom, position));
      setSelected(position);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo rotar la cubierta.');
    } finally {
      setBusy(false);
      setRotatingFrom(null);
    }
  }

  const slot = data?.positions.find((p) => p.position === selected) ?? null;
  const tire = slot?.tire ?? null;
  const problems = data?.positions.filter((p) => tireHealth(p.tire) !== 'ok').length ?? 0;
  const fromLabel = data?.positions.find((p) => p.position === rotatingFrom)?.label;

  return (
    <section className="vehicle-detail__card vehicle-tires">
      <header className="tires-header">
        <div>
          <h2 className="vehicle-detail__card-title">Neumáticos</h2>
          {data?.vehicleType && (
            <p className="vehicle-detail__item-meta">
              {vehicleTypeLabel(data.vehicleType)} · el auxilio no suma km
              {problems > 0 && ` · ${problems} ${problems === 1 ? 'cubierta' : 'cubiertas'} a revisar`}
            </p>
          )}
        </div>
        <div className="tires-header__actions">
          {onOpenTires && (
            <button type="button" className="vehicle-detail__action-btn" onClick={onOpenTires}>
              Ver todas las cubiertas
            </button>
          )}
        </div>
      </header>

      {error && <p className="error-banner">{error}</p>}
      {!data && !error && <p className="muted">Cargando cubiertas…</p>}

      {data && !data.vehicleType && (
        <div className="tire-layout-picker">
          <p className="muted">
            Este vehículo no tiene tipo. El tipo define sus ejes y sus cubiertas: elegilo para poder cargarlas.
          </p>
          {onEditVehicle && !readOnly && (
            <button type="button" className="secondary-btn" onClick={onEditVehicle}>
              Elegir el tipo
            </button>
          )}
        </div>
      )}

      {data?.vehicleType && (
        <div className="tires-layout">
          <div>
            <VehicleTopView
              vehicleType={data.vehicleType}
              positions={data.positions}
              stateOf={(position) => {
                const t = data.positions.find((p) => p.position === position)?.tire;
                return t ? tireHealth(t) : 'empty';
              }}
              describe={(position) => {
                const t = data.positions.find((p) => p.position === position)?.tire;
                if (!t) return 'sin cubierta';
                return t.condition ? `${tireLabel(t)}, ${t.condition.conditionLabels.join(', ').toLowerCase()}` : tireLabel(t);
              }}
              selected={selected}
              rotatingFrom={rotatingFrom}
              onSelect={(p) => void handleSelect(p)}
            />
            <div className="tires-legend" aria-hidden="true">
              <span className="tires-legend__ok">Sin problemas</span>
              <span className="tires-legend__warn">A revisar</span>
              <span className="tires-legend__crit">Grave</span>
              <span className="tires-legend__empty">Sin cubierta</span>
            </div>
          </div>

          <div className="tire-panel" aria-live="polite">
            {rotatingFrom ? (
              <>
                <p className="tire-panel__rotate">
                  Tocá en el dibujo a dónde va la cubierta de <strong>{fromLabel}</strong>. Si esa posición tiene
                  una, se intercambian.
                </p>
                <button type="button" className="secondary-btn" onClick={() => setRotatingFrom(null)} disabled={busy}>
                  Cancelar
                </button>
              </>
            ) : slot ? (
              <>
                <span className="tire-panel__position">{slot.label}</span>
                {tire ? (
                  <>
                    <h3 className="tire-panel__name">{tireLabel(tire)}</h3>
                    {tire.condition ? (
                      <div className={`tire-panel__condition tire-panel__condition--${tireHealth(tire)}`}>
                        <strong>{tire.condition.conditionLabels.join(' · ')}</strong>
                        <span>
                          Lo reportó {tire.condition.reportedBy ?? 'un chofer'} el {formatShortDate(tire.condition.reportedAt)}
                          {tire.condition.severity === 'blocking' ? ', como defecto bloqueante' : ''}. Se va cuando se
                          resuelve el defecto o se saca la cubierta.
                        </span>
                      </div>
                    ) : (
                      <p className="tire-panel__ok">Sin problemas reportados.</p>
                    )}
                    <dl className="tire-panel__facts">
                      <div>
                        <dt>Medida</dt>
                        <dd>{tire.size}</dd>
                      </div>
                      <div>
                        <dt>Km recorridos</dt>
                        <dd>{numberFormatter.format(tire.km)} km</dd>
                      </div>
                      <div>
                        <dt>Costo por km</dt>
                        <dd>{formatCostPerKm(tire.costPerKm)}</dd>
                      </div>
                      <div>
                        <dt>Montada</dt>
                        <dd>
                          {tire.current
                            ? `${formatShortDate(tire.current.mountedAt)} · ${numberFormatter.format(tire.current.mountedKm)} km`
                            : '—'}
                        </dd>
                      </div>
                      <div>
                        <dt>Compra</dt>
                        <dd>
                          {formatShortDate(tire.purchaseDate)} · {currencyFormatter.format(tire.cost)}
                        </dd>
                      </div>
                    </dl>
                    {!readOnly && (
                      <div className="tire-slot__actions">
                        <button type="button" className="vehicle-detail__action-btn" onClick={() => setRotatingFrom(slot.position)}>
                          Rotar
                        </button>
                        <button type="button" className="vehicle-detail__action-btn" onClick={() => setAction({ kind: 'mount', slot })}>
                          Cambiar
                        </button>
                        <button type="button" className="vehicle-detail__action-btn" onClick={() => setAction({ kind: 'unmount', slot })}>
                          Sacar
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <p className="muted">Sin cubierta.</p>
                    {!readOnly && (
                      <div className="tire-slot__actions">
                        <button type="button" className="primary-btn" onClick={() => setAction({ kind: 'mount', slot })}>
                          Montar una del stock
                        </button>
                      </div>
                    )}
                  </>
                )}
              </>
            ) : (
              <p className="muted">Tocá una cubierta en el dibujo.</p>
            )}
          </div>
        </div>
      )}

      {data && data.history.length > 0 && (
        <>
          <h3 className="vehicle-checklist__section-title">Historial de montajes</h3>
          <div className="fleet-status__table-wrap">
            <table className="fleet-status__table">
              <thead>
                <tr>
                  <th>Cubierta</th>
                  <th>Posición</th>
                  <th>Montada</th>
                  <th>Sacada</th>
                  <th className="fleet-status__km">Km en la posición</th>
                </tr>
              </thead>
              <tbody>
                {data.history.map((m, i) => (
                  <tr key={`${m.tireId}-${m.mountedAt}-${i}`}>
                    <td>{m.tireLabel}</td>
                    <td>{m.positionLabel}</td>
                    <td>
                      {formatShortDate(m.mountedAt)} · {numberFormatter.format(m.mountedKm)} km
                    </td>
                    <td>
                      {m.removedAt
                        ? `${formatShortDate(m.removedAt)} · ${numberFormatter.format(m.removedKm ?? 0)} km`
                        : 'Sigue puesta'}
                    </td>
                    <td className="fleet-status__km">{numberFormatter.format(m.km)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {data && action?.kind === 'mount' && (
        <MountTireModal vehicle={data} slot={action.slot} onClose={() => setAction(null)} onDone={done} />
      )}
      {data && action?.kind === 'unmount' && (
        <UnmountTireModal vehicle={data} slot={action.slot} onClose={() => setAction(null)} onDone={done} />
      )}
    </section>
  );
}
