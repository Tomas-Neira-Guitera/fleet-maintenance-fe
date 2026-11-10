import { useEffect, useState } from 'react';
import { ApiError } from '../../services/apiClient';
import { getVehicleTires, setTireLayout } from '../../services/tiresService';
import type { TireLayout, VehicleTirePosition, VehicleTires } from '../../types/domain';
import { formatShortDate } from '../../utils/dateFormat';
import { numberFormatter } from '../../utils/maintenanceFormat';
import { formatTread, TIRE_LAYOUT_LABEL, tireLabel } from '../../utils/tireFormat';
import { MountTireModal, RotateTireModal, TreadReadingsModal, UnmountTireModal } from './TireModals';
import '../../styles/dashboard.css';
import '../../styles/tires.css';

const LAYOUTS: TireLayout[] = ['4_ruedas', '6_ruedas', '10_ruedas'];

type Action = { kind: 'mount' | 'rotate' | 'unmount'; slot: VehicleTirePosition } | { kind: 'treads' };

interface VehicleTiresTabProps {
  vehicleId: string;
  /** Un vehículo dado de baja se ve, pero no se le montan ni rotan cubiertas. */
  readOnly?: boolean;
  /** Abre el inventario de cubiertas. */
  onOpenTires?: () => void;
}

/** De afuera hacia adentro: así se lee el eje de izquierda a derecha, como mirando el vehículo de atrás. */
function sideOf(slots: VehicleTirePosition[], side: 'izq' | 'der'): VehicleTirePosition[] {
  const onSide = slots.filter((s) => s.side === side);
  return side === 'izq'
    ? [...onSide].sort((a, b) => Number(a.inner) - Number(b.inner))
    : [...onSide].sort((a, b) => Number(b.inner) - Number(a.inner));
}

/** CAM-157: qué cubierta hay en cada posición, cuántos km lleva y su dibujo; montar, rotar, cambiar y sacar. */
export function VehicleTiresTab({ vehicleId, readOnly = false, onOpenTires }: VehicleTiresTabProps) {
  const [data, setData] = useState<VehicleTires | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [savingLayout, setSavingLayout] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getVehicleTires(vehicleId)
      .then((loaded) => {
        if (!cancelled) setData(loaded);
      })
      .catch(() => {
        if (!cancelled) setError('No se pudieron cargar las cubiertas del vehículo.');
      });
    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  async function handleLayout(layout: TireLayout) {
    setSavingLayout(true);
    setError(null);
    try {
      setData(await setTireLayout(vehicleId, layout));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cambiar la configuración.');
    } finally {
      setSavingLayout(false);
    }
  }

  function done(updated: VehicleTires) {
    setData(updated);
    setAction(null);
  }

  const axles = data ? [...new Set(data.positions.filter((p) => p.axle > 0).map((p) => p.axle))].sort() : [];
  const spare = data?.positions.find((p) => p.axle === 0);
  const anyMounted = data?.positions.some((p) => p.tire) ?? false;

  function renderSlot(slot: VehicleTirePosition) {
    const tire = slot.tire;
    const low = tire?.lastTread?.belowMinimum ?? false;
    return (
      <div key={slot.position} className={`tire-slot${tire ? '' : ' tire-slot--empty'}${low ? ' tire-slot--low' : ''}`}>
        <span className="tire-slot__position">{slot.label}</span>
        {tire ? (
          <>
            <span className="tire-slot__name">{tireLabel(tire)}</span>
            <span className="tire-slot__meta">
              {tire.size} · {numberFormatter.format(tire.km)} km
            </span>
            <span className={`tire-slot__meta${low ? ' tire-slot__tread--low' : ''}`}>
              {tire.lastTread
                ? `Dibujo ${formatTread(tire.lastTread.depthMm)} · ${formatShortDate(tire.lastTread.measuredAt)}`
                : 'Sin medición de dibujo'}
            </span>
          </>
        ) : (
          <span className="tire-slot__meta">Sin cubierta</span>
        )}
        {!readOnly && (
          <div className="tire-slot__actions">
            {tire ? (
              <>
                <button type="button" className="vehicle-detail__action-btn" onClick={() => setAction({ kind: 'rotate', slot })}>
                  Rotar
                </button>
                <button type="button" className="vehicle-detail__action-btn" onClick={() => setAction({ kind: 'mount', slot })}>
                  Cambiar
                </button>
                <button type="button" className="vehicle-detail__action-btn" onClick={() => setAction({ kind: 'unmount', slot })}>
                  Sacar
                </button>
              </>
            ) : (
              <button type="button" className="vehicle-detail__action-btn" onClick={() => setAction({ kind: 'mount', slot })}>
                Montar
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="vehicle-detail__card vehicle-tires">
      <header className="tires-header">
        <h2 className="vehicle-detail__card-title">Neumáticos</h2>
        <div className="tires-header__actions">
          {data?.layout && (
            <label className="vehicle-fuel__months">
              Configuración{' '}
              <select
                className="schedule-picker__input"
                value={data.layout}
                onChange={(e) => void handleLayout(e.target.value as TireLayout)}
                disabled={readOnly || savingLayout}
              >
                {LAYOUTS.map((l) => (
                  <option key={l} value={l}>
                    {TIRE_LAYOUT_LABEL[l]}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!readOnly && anyMounted && (
            <button type="button" className="vehicle-detail__action-btn" onClick={() => setAction({ kind: 'treads' })}>
              Cargar dibujo
            </button>
          )}
          {onOpenTires && (
            <button type="button" className="vehicle-detail__action-btn" onClick={onOpenTires}>
              Ver todas las cubiertas
            </button>
          )}
        </div>
      </header>

      {error && <p className="error-banner">{error}</p>}
      {!data && !error && <p className="muted">Cargando cubiertas…</p>}

      {data && !data.layout && (
        <div className="tire-layout-picker">
          <p className="muted">Elegí la configuración de ejes: de ahí salen las posiciones de las cubiertas.</p>
          <div className="tires-header__actions">
            {LAYOUTS.map((l) => (
              <button
                key={l}
                type="button"
                className="secondary-btn"
                onClick={() => void handleLayout(l)}
                disabled={readOnly || savingLayout}
              >
                {TIRE_LAYOUT_LABEL[l]}
              </button>
            ))}
          </div>
        </div>
      )}

      {data?.layout && (
        <>
          <p className="vehicle-detail__item-meta">
            Los km de cada cubierta suman mientras rueda en el vehículo (el auxilio no suma). Dibujo mínimo:{' '}
            {formatTread(data.minTreadMm)}.
          </p>
          <div className="tire-diagram" aria-label={`Cubiertas de ${data.plate} por posición`}>
            {axles.map((axle) => {
              const slots = data.positions.filter((p) => p.axle === axle);
              return (
                <div key={axle} className="tire-diagram__axle">
                  <div className="tire-diagram__side tire-diagram__side--izq">{sideOf(slots, 'izq').map(renderSlot)}</div>
                  <div className="tire-diagram__axle-label">{axle === 1 ? 'Delantero' : `Eje ${axle}`}</div>
                  <div className="tire-diagram__side">{sideOf(slots, 'der').map(renderSlot)}</div>
                </div>
              );
            })}
            {spare && <div className="tire-diagram__spare">{renderSlot(spare)}</div>}
          </div>

          {data.history.length > 0 && (
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
        </>
      )}

      {data && action?.kind === 'mount' && (
        <MountTireModal vehicle={data} slot={action.slot} onClose={() => setAction(null)} onDone={done} />
      )}
      {data && action?.kind === 'rotate' && (
        <RotateTireModal vehicle={data} slot={action.slot} onClose={() => setAction(null)} onDone={done} />
      )}
      {data && action?.kind === 'unmount' && (
        <UnmountTireModal vehicle={data} slot={action.slot} onClose={() => setAction(null)} onDone={done} />
      )}
      {data && action?.kind === 'treads' && (
        <TreadReadingsModal vehicle={data} onClose={() => setAction(null)} onDone={done} />
      )}
    </section>
  );
}
