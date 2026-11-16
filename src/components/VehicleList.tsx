import { useEffect, useState } from 'react';
import { usePendingInspections } from '../hooks/usePendingInspections';
import { loadCache, saveCache, VEHICLES_CACHE_KEY } from '../offline/offlineCache';
import {
  discardPendingInspection,
  syncPendingInspections,
  type PendingInspection,
} from '../offline/pendingInspections';
import { getSessionUserId, isNetworkError } from '../services/apiClient';
import { getVehicles } from '../services/vehiclesService';
import type { Vehicle } from '../types/domain';
import { formatDayAndTime } from '../utils/dateFormat';
import { findMyTrip, lastPendingByVehicle, withPending } from '../utils/myTrip';
import { matchesPlate } from '../utils/plateSearch';
import { scheduledTodayTime } from '../utils/scheduledToday';
import { isTrailer } from '../utils/vehicleTypes';
import { AlertOctagonIcon, CheckCircleIcon, LockClockIcon } from './icons';
import { MyTrip } from './MyTrip';

interface VehicleListProps {
  onSelectVehicle: (vehicle: Vehicle) => void;
  /** Por qué se volvió al listado sin enviar la inspección (ej. el vehículo quedó bloqueado mientras tanto). */
  notice?: string | null;
  /** Lo que salió bien al volver al listado (ej. el problema reportado en viaje, CAM-139). */
  confirmation?: string | null;
  /** CAM-139: reportar un problema durante el viaje propio, sin cerrarlo. */
  onReportProblem: (vehicle: Vehicle) => void;
  /** CAM-156: cargar combustible en el vehículo del viaje propio. */
  onLoadFuel: (vehicle: Vehicle) => void;
}

/** Quién tiene el vehículo en viaje (CAM-87). Con un viaje propio no se ve la flota, así que es de otro. */
function describeTrip(vehicle: Vehicle): string | null {
  const trip = vehicle.currentTrip;
  if (!trip) return null;
  const since = formatDayAndTime(trip.startedAt);
  return trip.openedBy ? `Lo tiene ${trip.openedBy.name} desde el ${since}` : `En viaje desde el ${since}`;
}

function describePending(item: PendingInspection): string {
  return `${item.type === 'pre-trip' ? 'Pre-viaje' : 'Post-viaje'} de ${item.plate} (${formatDayAndTime(item.performedAt)})`;
}

export function VehicleList({ onSelectVehicle, notice, confirmation, onReportProblem, onLoadFuel }: VehicleListProps) {
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // CAM-153: sin señal se muestra la última flota cargada, con la hora.
  const [offlineSince, setOfflineSince] = useState<string | null>(null);
  const [query, setQuery] = useState('');
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
  const pendingByVehicle = lastPendingByVehicle(waiting);
  // Un chofer tiene un solo viaje abierto: mientras dure, no se le muestra la flota para tomar otro.
  const myTrip = vehicles ? findMyTrip(vehicles, waiting, currentUserId) : null;
  // CAM-157: los remolques no tienen chofer: se ven y se mantienen desde el admin.
  const fleet = vehicles?.filter((v) => !isTrailer(v.vehicleType)) ?? [];
  const shown = fleet.filter((v) => matchesPlate(v.plate, query));

  return (
    <div className="screen">
      <header className="screen__header">
        <h1 className="screen__title">{myTrip ? 'Mi viaje' : 'Flota'}</h1>
        <p className="screen__subtitle">
          {myTrip ? 'Cuando termines, cerralo con el post-viaje.' : 'Elegí un vehículo para iniciar la inspección'}
        </p>
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

      {myTrip ? (
        <MyTrip
          vehicle={myTrip}
          pending={pendingByVehicle.has(myTrip.id)}
          offline={Boolean(offlineSince)}
          onClose={onSelectVehicle}
          onLoadFuel={onLoadFuel}
          onReportProblem={onReportProblem}
        />
      ) : (
        <>
          {fleet.length > 0 && (
            <input
              type="search"
              className="vehicle-search"
              placeholder="Buscar por patente"
              aria-label="Buscar por patente"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
          )}
          {fleet.length > 0 && shown.length === 0 && (
            <p className="muted">Ningún vehículo tiene una patente con "{query.trim()}".</p>
          )}
          <ul className="vehicle-list">
            {shown.map((serverVehicle) => {
              const pending = pendingByVehicle.get(serverVehicle.id);
              const vehicle = withPending(serverVehicle, pending, currentUserId);
              const onTrip = vehicle.status === 'on-trip';
              // CAM-86: un viaje abierto se tiene que poder cerrar aunque el vehículo esté bloqueado.
              const isBlocked = Boolean(vehicle.blocked) && !onTrip;
              const tripLine = describeTrip(vehicle);
              // CAM-127: por qué no puede salir (defecto bloqueante o documento vencido), tal como lo arma el backend.
              const reasons = isBlocked ? (vehicle.blockReasons ?? []).map((r) => r.message) : [];
              // CAM-143: no bloquea, solo avisa. Al elegirlo para el pre-viaje sale además una advertencia.
              const workshopTime = scheduledTodayTime(vehicle);
              return (
                <li key={vehicle.id}>
                  <button
                    type="button"
                    className={`vehicle-card${isBlocked ? ' vehicle-card--blocked' : onTrip ? ' vehicle-card--muted' : ''}`}
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
                      {workshopTime && <span className="vehicle-card__workshop">Turno de taller hoy, {workshopTime}</span>}
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
                      <span className="status-pill status-pill--info">
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
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
