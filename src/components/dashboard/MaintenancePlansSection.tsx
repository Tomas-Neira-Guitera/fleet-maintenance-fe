import { useEffect, useRef, useState } from 'react';
import { getFleetStatus } from '../../services/fleetStatusService';
import type { FleetStatusRow } from '../../types/domain';
import { describeNextMaintenance, numberFormatter } from '../../utils/maintenanceFormat';
import { MaintenancePlanCatalogModal } from './MaintenancePlanCatalogModal';
import { StatusBadge } from './StatusBadge';
import { VehicleMaintenanceModal } from './VehicleMaintenanceModal';
import '../../styles/dashboard.css';

function formatKm(km: number): string {
  return `${numberFormatter.format(km)} km`;
}

/**
 * Catálogo de planes de mantenimiento y su asignación a vehículos (CAM-16,
 * migrado acá desde "Vehículos" -- esa pestaña es ahora el ABM puro, CAM-25).
 * Mismo modal de siempre (`VehicleMaintenanceModal`): ver los planes
 * asignados a un vehículo, asignar uno nuevo o desasignarlo.
 */
export function MaintenancePlansSection() {
  const [rows, setRows] = useState<FleetStatusRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<FleetStatusRow | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const mountedRef = useRef(true);

  function load() {
    getFleetStatus()
      .then((page) => {
        if (mountedRef.current) setRows(page.items);
      })
      .catch(() => {
        if (mountedRef.current) setError('No se pudo cargar la flota. Intentá de nuevo.');
      });
  }

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return (
    <section className="fleet-status vehicles-section">
      <header className="fleet-status__header">
        <h1 className="fleet-status__title">Planes de Mantenimiento</h1>
        <button type="button" className="secondary-btn" onClick={() => setCatalogOpen(true)}>
          Ver catálogo de planes
        </button>
      </header>

      {error && <p className="error-banner">{error}</p>}
      {!rows && !error && <p className="muted">Cargando flota…</p>}

      {rows && (
        <div className="fleet-status__table-wrap">
          <table className="fleet-status__table">
            <thead>
              <tr>
                <th aria-hidden="true"></th>
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
                  title="Ver planes de mantenimiento de este vehículo"
                >
                  <td>
                    <span className={`fleet-status__dot fleet-status__dot--${row.status}`} aria-hidden="true" />
                  </td>
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
          onChanged={load}
        />
      )}

      {catalogOpen && <MaintenancePlanCatalogModal onClose={() => setCatalogOpen(false)} />}
    </section>
  );
}
