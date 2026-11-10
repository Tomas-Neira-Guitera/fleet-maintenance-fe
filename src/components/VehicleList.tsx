import { useEffect, useState } from 'react';
import { usePendingInspections } from '../hooks/usePendingInspections';
import { loadCache, saveCache, VEHICLES_CACHE_KEY } from '../offline/offlineCache';
import {
  discardPendingInspection,
  syncPendingInspections,
  type PendingInspection,
} from '../offline/pendingInspections';
import { getSessionUserId, getUsername, isNetworkError } from '../services/apiClient';
import { getVehicles } from '../services/vehiclesService';
import type { Vehicle } from '../types/domain';
import { formatDayAndTime } from '../utils/dateFormat';
import { AlertOctagonIcon, AlertTriangleIcon, CheckCircleIcon, FuelIcon, LockClockIcon } from './icons';
import '../styles/fuel.css';

interface VehicleListProps {
  onSelectVehicle: (vehicle: Vehicle) => void;
  /** Por qué se volvió al listado sin enviar la inspección (ej. el vehículo quedó bloqueado mientras tanto). */
  notice?: string | null;
  /** Lo que salió bien al volver al listado (ej. el problema reportado en viaje, CAM-139). */
  confirmation?: string | null;
  /** CAM-139: reportar un problema durante el viaje propio, sin cerrarlo. */
  onReportProblem: (vehicle: Vehicle) => void;
  /** CAM-156: cargar combustible en un vehículo disponible o en el del viaje propio. */
  onLoadFuel?: (vehicle: Vehicle) => void;
}

/** Quién tiene el vehículo en viaje (CAM-87), para que el chofer reconozca cuál es el suyo. */
function describeTrip(vehicle: Vehicle, currentUserId: string | null): string | null {
  const trip = vehicle.currentTrip;
  if (!trip) return null;
  const since = formatDayAndTime(trip.startedAt);
  if (!trip.openedBy) return `En viaje desde el ${since}`;
  return trip.openedBy.id === currentUserId
    ? `Tu viaje, abierto el ${since}`
    : `Lo tiene ${trip.openedBy.name} desde el ${since}`;
}

/**
 * CAM-153: cómo queda el vehículo después de lo que el chofer hizo sin señal. Un pre-viaje guardado lo deja en
 * viaje (y se puede hacer el post-viaje); un post-viaje guardado lo deja disponible.
 */
function withPending(vehicle: Vehicle, pending: PendingInspection | undefined, currentUserId: string | null): Vehicle {
  if (!pending) return vehicle;
  if (pending.type === 'post-trip') return { ...vehicle, status: 'available', currentTrip: null };
  const blocking = pending.answers.some((a) => a.outcome === 'defect' && a.defect?.severity === 'blocking');
  if (blocking) {
    const message = 'Reportaste un defecto bloqueante (se envía cuando vuelva la señal).';
    return { ...vehicle, status: 'available', blocked: true, blockReasons: [{ type: 'blocking_defect', message }] };
  }
  const openedBy = currentUserId ? { id: currentUserId, name: getUsername() ?? '' } : null;
  return { ...vehicle, status: 'on-trip', blocked: false, currentTrip: { startedAt: pending.performedAt, openedBy } };
}

function describePending(item: PendingInspection): string {
  return `${item.type === 'pre-trip' ? 'Pre-viaje' : 'Post-viaje'} de ${item.plate} (${formatDayAndTime(item.performedAt)})`;
}

export function VehicleList({ onSelectVehicle, notice, confirmation, onReportProblem, onLoadFuel }: VehicleListProps) {
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // CAM-153: sin señal se muestra la última flota cargada, con la hora.
  const [offlineSince, setOfflineSince] = useState<string | null>(null);
  const currentUserId = getSessionUserId();
  const { items: pendingItems, sessionExpired, sentCount } = usePendingInspections();

  useEffect(() => {
    let cancelled = false;
    // CAM-89: cada vehículo ya dice si está bloqueado; no hace falta pedir todos los defectos.
    // sentCount: al mandarse una inspección guardada, el estado de la flota cambió.
    getVehicles()
      .then((data) => {
        saveCache(VEHICLES_CACHE_KEY, data);
        if (!cancelled) {
          setVehicles(data);
          setOfflineSince(null);
          setError(null);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        const cached = isNetworkError(err) ? loadCache<Vehicle[]>(VEHICLES_CACHE_KEY) : null;
        if (cached) {
          setVehicles(cached.data);
          setOfflineSince(cached.savedAt);
        } else {
          setError('No se pudo cargar la flota. Intentá de nuevo.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [sentCount]);

  const waiting = pendingItems.filter((item) => item.status === 'pending');
  const rejected = pendingItems.filter((item) => item.status === 'rejected');
  // La última inspección guardada de cada vehículo es la que define cómo quedó.
  const lastPendingByVehicle = new Map<string, PendingInspection>();
  for (const item of waiting) lastPendingByVehicle.set(item.vehicleId, item);

  return (
    <div className="screen">
      <header className="screen__header">
        <h1 className="screen__title">Flota</h1>
        <p className="screen__subtitle">Elegí un vehículo para iniciar la inspección</p>
      </header>

      {confirmation && <p className="info-banner">{confirmation}</p>}
      {notice && <p className="error-banner">{notice}</p>}
      {error && <p className="error-banner">{error}</p>}
      {offlineSince && (
        <p className="offline-banner">Sin conexión. Es la flota de las {formatDayAndTime(offlineSince)}.</p>
      )}

      {waiting.length > 0 && (
        <div className="offline-banner">
          <p>
            {waiting.length === 1
              ? '1 inspección guardada en el celular.'
              : `${waiting.length} inspecciones guardadas en el celular.`}{' '}
            {sessionExpired
              ? 'Tu sesión venció: cerrá sesión y volvé a entrar para enviarlas.'
              : 'Se envían solas cuando vuelve la señal.'}
          </p>
          <ul className="offline-banner__list">
            {waiting.map((item) => (
              <li key={item.id}>{describePending(item)}</li>
            ))}
          </ul>
          {!sessionExpired && (
            <button type="button" className="secondary-btn" onClick={() => void syncPendingInspections()}>
              Enviar ahora
            </button>
          )}
        </div>
      )}

      {rejected.map((item) => (
        <div key={item.id} className="error-banner offline-rejected">
          <p>
            No se pudo enviar: {describePending(item)}. {item.error}
          </p>
          <button type="button" className="secondary-btn" onClick={() => void discardPendingInspection(item.id)}>
            Descartar
          </button>
        </div>
      ))}

      {!vehicles && !error && <p className="muted">Cargando vehículos…</p>}

      <ul className="vehicle-list">
        {vehicles?.map((serverVehicle) => {
          const pending = lastPendingByVehicle.get(serverVehicle.id);
          const vehicle = withPending(serverVehicle, pending, currentUserId);
          const onTrip = vehicle.status === 'on-trip';
          // CAM-86: un viaje abierto se tiene que poder cerrar aunque el vehículo esté bloqueado.
          const isBlocked = Boolean(vehicle.blocked) && !onTrip;
          const tripLine = describeTrip(vehicle, currentUserId);
          // CAM-127: por qué no puede salir (defecto bloqueante o documento vencido), tal como lo arma el backend.
          const reasons = isBlocked ? (vehicle.blockReasons ?? []).map((r) => r.message) : [];
          // El viaje propio es lo que el chofer tiene pendiente de cerrar: no se atenúa como los ajenos.
          const isMine = onTrip && vehicle.currentTrip?.openedBy?.id === currentUserId;
          // CAM-156: con señal, en uno disponible o en el del viaje propio (no en el viaje de otro chofer).
          const canLoadFuel = Boolean(onLoadFuel) && !offlineSince && !isBlocked && (!onTrip || isMine);
          const showReport = isMine && !pending;
          return (
            <li key={vehicle.id}>
              <button
                type="button"
                className={`vehicle-card${isBlocked ? ' vehicle-card--blocked' : onTrip && !isMine ? ' vehicle-card--muted' : ''}`}
                onClick={() => onSelectVehicle(vehicle)}
                disabled={isBlocked}
              >
                <div className="vehicle-card__info">
                  <span className="vehicle-card__plate">{vehicle.plate}</span>
                  <span className="vehicle-card__model">
                    {vehicle.brand} {vehicle.model}
                  </span>
                  {tripLine && <span className="vehicle-card__trip">{tripLine}</span>}
                  {pending && <span className="vehicle-card__trip">Pendiente de envío</span>}
                  {reasons.map((reason) => (
                    <span key={reason} className="vehicle-card__reason">
                      {reason}
                    </span>
                  ))}
                </div>
                {isBlocked ? (
                  <span className="status-pill status-pill--crit">
                    <AlertOctagonIcon className="status-pill__icon" />
                    No disponible
                  </span>
                ) : onTrip ? (
                  <span className="status-pill status-pill--warn">
                    <LockClockIcon className="status-pill__icon" />
                    En viaje
                  </span>
                ) : (
                  <span className="status-pill status-pill--ok">
                    <CheckCircleIcon className="status-pill__icon" />
                    Disponible
                  </span>
                )}
              </button>
              {/* Con el pre-viaje todavía sin enviar, el servidor no conoce el viaje: el reporte en ruta espera la señal. */}
              {(showReport || canLoadFuel) && (
                <div className="vehicle-list__trip-actions">
                  {canLoadFuel && (
                    <button type="button" className="vehicle-card__fuel" onClick={() => onLoadFuel?.(vehicle)}>
                      <FuelIcon aria-hidden="true" />
                      Cargar combustible
                    </button>
                  )}
                  {showReport && (
                    <button type="button" className="vehicle-card__report" onClick={() => onReportProblem(vehicle)}>
                      <AlertTriangleIcon aria-hidden="true" />
                      Reportar un problema
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
