import { useState } from 'react';
import { FleetKpiCards } from './FleetKpiCards';
import { FleetStatusTable } from './FleetStatusTable';
import { RecentDefectsCard } from './RecentDefectsCard';
import { RecurringDefectsCard } from './RecurringDefectsCard';
import { UpcomingMaintenanceCard } from './UpcomingMaintenanceCard';
import { WeeklyScheduleCard } from './WeeklyScheduleCard';
import '../../styles/dashboard.css';

interface AdminDashboardProps {
  onViewDefects: () => void;
  onOpenVehicle: (vehicleId: string) => void;
}

export function AdminDashboard({ onViewDefects, onOpenVehicle }: AdminDashboardProps) {
  // Asignar/desasignar un plan desde el modal de FleetStatusTable cambia los
  // indicadores agregados -- bumpear esto fuerza a los widgets hermanos a refetchear.
  const [fleetVersion, setFleetVersion] = useState(0);

  return (
    <div className="admin-dashboard">
      <header className="admin-dashboard__header">
        <div>
          <h1 className="admin-dashboard__title">Flota</h1>
        </div>
      </header>

      <div className="admin-dashboard__body">
        <FleetKpiCards refreshKey={fleetVersion} />
        <WeeklyScheduleCard refreshKey={fleetVersion} />
        {/* Mantenimiento a la izquierda, defectos a la derecha: así las dos columnas quedan parejas. */}
        <div className="admin-dashboard__grid">
          <div className="admin-dashboard__column">
            <FleetStatusTable onFleetChanged={() => setFleetVersion((v) => v + 1)} />
            <UpcomingMaintenanceCard refreshKey={fleetVersion} />
          </div>
          <div className="admin-dashboard__column">
            <RecentDefectsCard onViewAll={onViewDefects} />
            <RecurringDefectsCard onOpenVehicle={onOpenVehicle} />
          </div>
        </div>
      </div>
    </div>
  );
}
