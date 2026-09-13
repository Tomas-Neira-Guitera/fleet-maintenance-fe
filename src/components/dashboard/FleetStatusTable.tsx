import { useEffect, useRef, useState } from 'react';
import { getFleetStatus } from '../../services/fleetStatusService';
import type { FleetStatusRow } from '../../types/domain';
import { describeNextMaintenance, numberFormatter } from '../../utils/maintenanceFormat';
import { StatusBadge } from './StatusBadge';
import { VehicleMaintenanceModal } from './VehicleMaintenanceModal';
import '../../styles/dashboard.css';

function formatKm(km: number): string {
  return `${numberFormatter.format(km)} km`;
}

interface FleetStatusTableProps {
  /** Avisa al dashboard que asignar/desasignar un plan puede haber cambiado
   * los indicadores agregados (KPIs, próximos vencimientos), para que esos
   * widgets hermanos también se refresquen. */
  onFleetChanged?: () => void;
}

export function FleetStatusTable({ onFleetChanged }: FleetStatusTableProps) {
  const [rows, setRows] = useState<FleetStatusRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<FleetStatusRow | null>(null);
  const mountedRef = useRef(true);

  function loadFleetStatus() {
    getFleetStatus()
      .then((page) => {
        if (mountedRef.current) setRows(page.items);
      })
      .catch(() => {
        if (mountedRef.current) setError('No se pudo cargar el estado de la flota. Intentá de nuevo.');
      });
  }

  useEffect(() => {
    mountedRef.current = true;
    loadFleetStatus();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return (
    <section className="fleet-status">
      <header className="fleet-status__header">
        <h2 className="fleet-status__title">Estado de la flota</h2>
      </header>

      {error && <p className="error-banner">{error}</p>}
      {!rows && !error && <p className="muted">Cargando flota…</p>}

      {rows && (
        <div className="fleet-status__table-wrap">
          <table className="fleet-status__table">
            <thead>
              <tr>
                <th>Patente</th>
                <th>Vehículo</th>
                <th>Próximo mantenimiento</th>
                <th>Kilometraje</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.vehicleId}
                  className="fleet-status__row"
                  onClick={() => setSelectedRow(row)}
                  title="Ver mantenimientos de este vehículo"
                >
                  <td className="fleet-status__plate">{row.plate}</td>
                  <td>
                    <div className="fleet-status__vehicle">
                      <span className="fleet-status__vehicle-name">
                        {row.brand} {row.model}
                      </span>
                      {row.vehicleType && <span className="fleet-status__vehicle-type">{row.vehicleType}</span>}
                    </div>
                  </td>
                  <td>
                    {row.nextMaintenance ? (
                      <div className="fleet-status__maintenance">
                        <span className="fleet-status__maintenance-name">{row.nextMaintenance.name}</span>
                        <span className="fleet-status__maintenance-detail">
                          {describeNextMaintenance(row.nextMaintenance)}
                        </span>
                      </div>
                    ) : (
                      <span className="muted">Sin mantenimiento configurado</span>
                    )}
                  </td>
                  <td className="fleet-status__km">{formatKm(row.odometerKm)}</td>
                  <td>
                    <StatusBadge status={row.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="muted">No hay vehículos en la flota todavía.</p>}
        </div>
      )}

      {selectedRow && (
        <VehicleMaintenanceModal
          vehicleId={selectedRow.vehicleId}
          plate={selectedRow.plate}
          vehicleLabel={`${selectedRow.brand} ${selectedRow.model}`}
          onClose={() => setSelectedRow(null)}
          onChanged={() => {
            loadFleetStatus();
            onFleetChanged?.();
          }}
        />
      )}
    </section>
  );
}
