import { useEffect, useState } from 'react';
import { isSessionExpired, SESSION_EXPIRED_MESSAGE } from '../../services/apiClient';
import { getVehicleCosts } from '../../services/vehiclesService';
import type { VehicleCosts } from '../../types/domain';
import { currencyFormatter, numberFormatter } from '../../utils/maintenanceFormat';
import { ChevronRightIcon } from '../icons';
import { VehicleExpenseFormModal } from './VehicleExpenseFormModal';
import '../../styles/dashboard.css';

// El costo por km suele ser chico: con los centavos se distingue $ 16,67 de $ 17.
const perKmFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

interface VehicleCostsCardProps {
  vehicle: { id: string; plate: string };
  /** Abre la pestaña Gastos filtrada por este vehículo. */
  onViewExpenses: () => void;
}

/**
 * Cuánto cuesta tener el vehículo (CAM-105, CAM-109): mantenimiento y gastos operativos, en total
 * histórico, últimos 12 meses y costo por km, que es lo que permite comparar un vehículo que anda
 * mucho con uno que anda poco. El desglose está en la pestaña Gastos, a la que lleva "Ver gastos".
 */
export function VehicleCostsCard({ vehicle, onViewExpenses }: VehicleCostsCardProps) {
  const vehicleId = vehicle.id;
  const [costs, setCosts] = useState<VehicleCosts | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addingExpense, setAddingExpense] = useState(false);
  // Se incrementa para volver a pedir los costos después de cargar un gasto.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getVehicleCosts(vehicleId)
      .then((data) => {
        if (cancelled) return;
        setCosts(data);
        // Si la vez anterior falló, el error taparía las cifras nuevas.
        setError(null);
      })
      .catch((err: unknown) => {
        // Es la única parte del detalle que exige el token: si venció, que lo diga en vez de un error genérico.
        if (!cancelled) setError(isSessionExpired(err) ? SESSION_EXPIRED_MESSAGE : 'No se pudieron cargar los costos.');
      });
    return () => {
      cancelled = true;
    };
  }, [vehicleId, reloadKey]);

  return (
    <section className="vehicle-detail__card vehicle-costs">
      <div className="vehicle-costs__header">
        <h2 className="vehicle-detail__card-title">Costos</h2>
        <div className="vehicle-costs__actions">
          <button type="button" className="vehicle-costs__link" onClick={() => setAddingExpense(true)}>
            Cargar gasto
          </button>
          <button type="button" className="vehicle-costs__link" onClick={onViewExpenses}>
            Ver gastos
            <ChevronRightIcon />
          </button>
        </div>
      </div>

      {error ? (
        <p className="muted">{error}</p>
      ) : !costs ? (
        <p className="muted">Cargando costos…</p>
      ) : (
        <>
          <dl className="vehicle-costs__stats">
            <div className="vehicle-costs__stat">
              <dt>Total histórico</dt>
              <dd className="vehicle-costs__value">{currencyFormatter.format(costs.totalAmount)}</dd>
              <dd className="vehicle-costs__hint">
                {costs.expenseCount} {costs.expenseCount === 1 ? 'gasto cargado' : 'gastos cargados'}
              </dd>
            </div>
            <div className="vehicle-costs__stat">
              <dt>Últimos 12 meses</dt>
              <dd className="vehicle-costs__value">{currencyFormatter.format(costs.last12MonthsAmount)}</dd>
            </div>
            <div className="vehicle-costs__stat">
              <dt>Costo por km</dt>
              {costs.costPerKm != null && costs.kmDriven != null ? (
                <>
                  <dd className="vehicle-costs__value">{perKmFormatter.format(costs.costPerKm)}</dd>
                  <dd className="vehicle-costs__hint">
                    Sobre {numberFormatter.format(costs.kmDriven)} km recorridos
                  </dd>
                </>
              ) : (
                <>
                  <dd className="vehicle-costs__value vehicle-costs__value--empty">Sin datos</dd>
                  <dd className="vehicle-costs__hint">Faltan registros de km anteriores al actual</dd>
                </>
              )}
            </div>
          </dl>
          {costs.expenseCount === 0 && (
            <p className="muted vehicle-costs__empty">Todavía no se cargaron gastos de este vehículo.</p>
          )}
        </>
      )}

      {addingExpense && (
        <VehicleExpenseFormModal
          vehicles={[vehicle]}
          lockVehicle
          onClose={() => setAddingExpense(false)}
          onSaved={() => {
            setAddingExpense(false);
            setReloadKey((key) => key + 1);
          }}
        />
      )}
    </section>
  );
}
