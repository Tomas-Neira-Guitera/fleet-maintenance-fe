import { useEffect, useState } from 'react';
import { ApiError } from '../../services/apiClient';
import { coupleTrailer, getCoupling, uncoupleTrailer } from '../../services/couplingService';
import { getVehicles } from '../../services/vehiclesService';
import type { Coupling, Vehicle } from '../../types/domain';
import { formatShortDate } from '../../utils/dateFormat';
import { canTow, canTowAny, isTrailer, vehicleTypeLabel } from '../../utils/vehicleTypes';
import '../../styles/dashboard.css';
import '../../styles/tires.css';

interface CouplingCardProps {
  vehicle: Vehicle;
  readOnly?: boolean;
  onOpenVehicle?: (vehicleId: string) => void;
}

/**
 * CAM-157: con quién está enganchado. Un remolque suma los km de lo que lo arrastra mientras está enganchado;
 * por eso se ve y se cambia acá. Solo aparece en remolques, tractores y camiones rígidos.
 */
export function CouplingCard({ vehicle, readOnly = false, onOpenVehicle }: CouplingCardProps) {
  const trailer = isTrailer(vehicle.vehicleType);
  const [coupling, setCoupling] = useState<Coupling | null>(null);
  const [candidates, setCandidates] = useState<Vehicle[]>([]);
  const [choice, setChoice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getCoupling(vehicle.id), getVehicles(true)])
      .then(([loaded, fleet]) => {
        if (cancelled) return;
        setCoupling(loaded);
        // Del otro lado del enganche: lo que puede arrastrarlo, o lo que puede arrastrar.
        setCandidates(
          fleet.filter((v) =>
            trailer ? canTow(v.vehicleType, vehicle.vehicleType) : canTow(vehicle.vehicleType, v.vehicleType),
          ),
        );
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo cargar el enganche.');
      });
    return () => {
      cancelled = true;
    };
  }, [vehicle.id, vehicle.vehicleType, trailer]);

  if (!trailer && !canTowAny(vehicle.vehicleType)) return null;

  const other = trailer ? coupling?.towedBy : coupling?.towing;

  async function run(action: () => Promise<Coupling>) {
    setBusy(true);
    setError(null);
    try {
      setCoupling(await action());
      setChoice('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cambiar el enganche.');
    } finally {
      setBusy(false);
    }
  }

  function handleCouple() {
    if (!choice) return;
    void run(() => (trailer ? coupleTrailer(vehicle.id, choice) : coupleTrailer(choice, vehicle.id)));
  }

  function handleUncouple() {
    if (!other) return;
    void run(() => uncoupleTrailer(trailer ? vehicle.id : other.id));
  }

  return (
    <section className="vehicle-detail__card coupling-card">
      <h2 className="vehicle-detail__card-title">{trailer ? 'Enganche' : 'Remolque'}</h2>
      {error && <p className="error-banner">{error}</p>}
      {!coupling && !error && <p className="muted">Cargando…</p>}
      {coupling && (
        <>
          {other ? (
            <p className="coupling-card__current">
              {trailer ? 'Lo arrastra ' : 'Arrastra '}
              <button type="button" className="expenses__wo-link" onClick={() => onOpenVehicle?.(other.id)}>
                {other.plate}
              </button>{' '}
              <span className="muted">
                ({vehicleTypeLabel(other.vehicleType)}, desde el {formatShortDate(other.coupledAt)})
              </span>
            </p>
          ) : (
            <p className="muted">{trailer ? 'Sin enganchar: no suma km.' : 'Va sin remolque.'}</p>
          )}
          {trailer && (
            <p className="vehicle-detail__item-meta">
              Mientras está enganchado, suma los km de lo que lo arrastra: así se cuentan sus cubiertas y sus
              mantenimientos por km.
            </p>
          )}
          {!readOnly && (
            <div className="coupling-card__actions">
              <select
                className="schedule-picker__input"
                value={choice}
                onChange={(e) => setChoice(e.target.value)}
                aria-label={trailer ? 'Tractor o camión que lo arrastra' : 'Remolque que arrastra'}
                disabled={busy || candidates.length === 0}
              >
                <option value="">
                  {candidates.length === 0
                    ? trailer
                      ? 'No hay vehículos que puedan arrastrarlo'
                      : 'No hay remolques que pueda arrastrar'
                    : trailer
                      ? 'Elegí quién lo arrastra'
                      : 'Elegí un remolque'}
                </option>
                {candidates
                  .filter((c) => c.id !== other?.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.plate} · {vehicleTypeLabel(c.vehicleType)}
                    </option>
                  ))}
              </select>
              <button type="button" className="vehicle-detail__action-btn" onClick={handleCouple} disabled={busy || !choice}>
                {other ? 'Cambiar' : 'Enganchar'}
              </button>
              {other && (
                <button type="button" className="vehicle-detail__action-btn" onClick={handleUncouple} disabled={busy}>
                  Desenganchar
                </button>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
