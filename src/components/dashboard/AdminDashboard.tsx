import { useState } from 'react';
import { getUsername } from '../../services/apiClient';
import { RefreshIcon } from '../icons';
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
  // Cambiar refreshKey remonta los widgets de abajo, que vuelven a pedir sus datos solos.
  const [refreshKey, setRefreshKey] = useState(0);
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
        <button
          type="button"
          className="admin-dashboard__refresh"
          onClick={() => setRefreshKey((key) => key + 1)}
          aria-label="Refrescar datos"
        >
          <RefreshIcon width={18} height={18} />
        </button>
      </header>

      <div className="admin-dashboard__body" key={refreshKey}>
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
