import { useState } from 'react';
import { FleetKpiCards } from './FleetKpiCards';
import { FleetStatusTable } from './FleetStatusTable';
import { RecentDefectsCard } from './RecentDefectsCard';
import { UpcomingMaintenanceCard } from './UpcomingMaintenanceCard';
import { WeeklyScheduleCard } from './WeeklyScheduleCard';
import '../../styles/dashboard.css';

interface AdminDashboardProps {
  onViewDefects: () => void;
}

export function AdminDashboard({ onViewDefects }: AdminDashboardProps) {
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
        <div className="admin-dashboard__grid">
          <FleetStatusTable onFleetChanged={() => setFleetVersion((v) => v + 1)} />
          <div className="admin-dashboard__side">
            <UpcomingMaintenanceCard refreshKey={fleetVersion} />
            <RecentDefectsCard onViewAll={onViewDefects} />
          </div>
        </div>
      </div>
    </div>
  );
}
