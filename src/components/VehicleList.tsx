import { useEffect, useState } from 'react';
import { getSessionUserId } from '../services/apiClient';
import { getVehicles } from '../services/vehiclesService';
import type { Vehicle } from '../types/domain';
import { formatDayAndTime } from '../utils/dateFormat';
import { AlertOctagonIcon, CheckCircleIcon, LockClockIcon } from './icons';

interface VehicleListProps {
  onSelectVehicle: (vehicle: Vehicle) => void;
  /** Por qué se volvió al listado sin enviar la inspección (ej. el vehículo quedó bloqueado mientras tanto). */
  notice?: string | null;
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

export function VehicleList({ onSelectVehicle, notice }: VehicleListProps) {
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const currentUserId = getSessionUserId();

  useEffect(() => {
    let cancelled = false;
    // CAM-89: cada vehículo ya dice si está bloqueado; no hace falta pedir todos los defectos.
    getVehicles()
      .then((data) => {
        if (!cancelled) setVehicles(data);
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo cargar la flota. Intentá de nuevo.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="screen">
      <header className="screen__header">
        <h1 className="screen__title">Flota</h1>
        <p className="screen__subtitle">Elegí un vehículo para iniciar la inspección</p>
      </header>

      {notice && <p className="error-banner">{notice}</p>}
      {error && <p className="error-banner">{error}</p>}

      {!vehicles && !error && <p className="muted">Cargando vehículos…</p>}

      <ul className="vehicle-list">
        {vehicles?.map((vehicle) => {
          const onTrip = vehicle.status === 'on-trip';
          // CAM-86: un viaje abierto se tiene que poder cerrar aunque el vehículo esté bloqueado.
          const isBlocked = Boolean(vehicle.blocked) && !onTrip;
          const tripLine = describeTrip(vehicle, currentUserId);
          // El viaje propio es lo que el chofer tiene pendiente de cerrar: no se atenúa como los ajenos.
          const isMine = onTrip && vehicle.currentTrip?.openedBy?.id === currentUserId;
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
            </li>
          );
        })}
      </ul>
    </div>
  );
}
