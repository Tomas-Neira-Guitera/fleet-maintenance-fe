import { useEffect, useState } from 'react';
import { getDefects } from '../services/defectsService';
import { getVehicles } from '../services/vehiclesService';
import type { Vehicle } from '../types/domain';
import { AlertOctagonIcon, CheckCircleIcon, LockClockIcon } from './icons';

interface VehicleListProps {
  onSelectVehicle: (vehicle: Vehicle) => void;
}

export function VehicleList({ onSelectVehicle }: VehicleListProps) {
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [blockedPlates, setBlockedPlates] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getVehicles(), getDefects()])
      .then(([vehiclesData, defects]) => {
        if (cancelled) return;
        setVehicles(vehiclesData);
        setBlockedPlates(
          new Set(
            defects
              .filter((defect) => defect.status === 'open' && defect.severity === 'blocking')
              .map((defect) => defect.vehiclePlate),
          ),
        );
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

      {error && <p className="error-banner">{error}</p>}

      {!vehicles && !error && <p className="muted">Cargando vehículos…</p>}

      <ul className="vehicle-list">
        {vehicles?.map((vehicle) => {
          const isBlocked = blockedPlates.has(vehicle.plate);
          const isAvailable = vehicle.status === 'available' && !isBlocked;
          return (
            <li key={vehicle.id}>
              <button
                type="button"
                className={`vehicle-card${isBlocked ? ' vehicle-card--blocked' : isAvailable ? '' : ' vehicle-card--muted'}`}
                onClick={() => onSelectVehicle(vehicle)}
                disabled={isBlocked}
              >
                <div className="vehicle-card__info">
                  <span className="vehicle-card__plate">{vehicle.plate}</span>
                  <span className="vehicle-card__model">
                    {vehicle.brand} {vehicle.model}
                  </span>
                </div>
                {isBlocked ? (
                  <span className="status-pill status-pill--crit">
                    <AlertOctagonIcon className="status-pill__icon" />
                    No disponible
                  </span>
                ) : isAvailable ? (
                  <span className="status-pill status-pill--ok">
                    <CheckCircleIcon className="status-pill__icon" />
                    Disponible
                  </span>
                ) : (
                  <span className="status-pill status-pill--warn">
                    <LockClockIcon className="status-pill__icon" />
                    En viaje
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
