import { getUsername } from '../../services/apiClient';
import { FleetKpiCards } from './FleetKpiCards';
import { FleetStatusTable } from './FleetStatusTable';
import { RecentDefectsCard } from './RecentDefectsCard';
import { UpcomingMaintenanceCard } from './UpcomingMaintenanceCard';
import '../../styles/dashboard.css';

interface AdminDashboardProps {
  onViewDefects: () => void;
}

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function AdminDashboard({ onViewDefects }: AdminDashboardProps) {
  const username = getUsername();

  return (
    <div className="admin-dashboard">
      <header className="admin-dashboard__header">
        <div>
          <h1 className="admin-dashboard__title">Flota</h1>
          <p className="admin-dashboard__greeting">
            {username && `Bienvenido, ${capitalize(username)}. `}
            Así está tu flota hoy — {dateFormatter.format(new Date())}
          </p>
        </div>
      </header>

      <div className="admin-dashboard__body">
        <FleetKpiCards />
        <div className="admin-dashboard__grid">
          <FleetStatusTable />
          <div className="admin-dashboard__side">
            <UpcomingMaintenanceCard />
            <RecentDefectsCard onViewAll={onViewDefects} />
          </div>
        </div>
      </div>
    </div>
  );
}
