import { useEffect, useState } from 'react';
import { getFleetStatus } from '../../services/fleetStatusService';
import type { FleetStatusRow, NextMaintenanceSummary } from '../../types/domain';
import { StatusBadge } from './StatusBadge';
import '../../styles/dashboard.css';

const numberFormatter = new Intl.NumberFormat('es-AR');

function formatKm(km: number): string {
  return `${numberFormatter.format(km)} km`;
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

/** Arma la segunda línea de la celda "Próximo mantenimiento" -- ej. "vence en 3 días · 23/08/2026". */
function describeNextMaintenance(next: NextMaintenanceSummary): string {
  const parts: string[] = [];

  if (next.remainingKm != null) {
    parts.push(
      next.remainingKm >= 0
        ? `en ${numberFormatter.format(next.remainingKm)} km`
        : `vencida hace ${numberFormatter.format(Math.abs(next.remainingKm))} km`,
    );
  }
  if (next.remainingDays != null) {
    parts.push(
      next.remainingDays >= 0
        ? `vence en ${next.remainingDays} día${next.remainingDays === 1 ? '' : 's'}`
        : `vencida hace ${Math.abs(next.remainingDays)} día${Math.abs(next.remainingDays) === 1 ? '' : 's'}`,
    );
  }

  const dueDate = next.dueDate ? formatDate(next.dueDate) : null;
  return [parts.join(' · '), dueDate].filter(Boolean).join(' · ');
}

export function FleetStatusTable() {
  const [rows, setRows] = useState<FleetStatusRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getFleetStatus()
      .then((page) => {
        if (!cancelled) setRows(page.items);
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo cargar el estado de la flota. Intentá de nuevo.');
      });
    return () => {
      cancelled = true;
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
                <tr key={row.vehicleId}>
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
    </section>
  );
}
