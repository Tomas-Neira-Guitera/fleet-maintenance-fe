import { useEffect, useState } from 'react';
import { getVehicles } from '../services/vehiclesService';
import { getVehicleStatus, type Vehicle } from '../types/domain';
import { CheckCircleIcon, LockClockIcon } from './icons';

interface VehicleListProps {
  onSelectVehicle: (vehicle: Vehicle) => void;
}

export function VehicleList({ onSelectVehicle }: VehicleListProps) {
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
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

      {error && <p className="error-banner">{error}</p>}

      {!vehicles && !error && <p className="muted">Cargando vehículos…</p>}

      <ul className="vehicle-list">
        {vehicles?.map((vehicle) => {
          const status = getVehicleStatus(vehicle);
          const isAvailable = status === 'available';
          return (
            <li key={vehicle.id}>
              <button
                type="button"
                className={`vehicle-card${isAvailable ? '' : ' vehicle-card--muted'}`}
                onClick={() => onSelectVehicle(vehicle)}
              >
                <div className="vehicle-card__info">
                  <span className="vehicle-card__plate">{vehicle.plate}</span>
                  <span className="vehicle-card__model">
                    {vehicle.brand} {vehicle.model}
                  </span>
                </div>
                {isAvailable ? (
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
