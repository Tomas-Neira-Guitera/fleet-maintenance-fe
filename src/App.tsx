import { useState } from 'react';
import './App.css';
import { VehicleList } from './components/VehicleList';
import { InspectionFlow } from './components/InspectionFlow';
import { DefectsList } from './components/DefectsList';
import { Login } from './components/Login';
import { AdminDashboard } from './components/dashboard/AdminDashboard';
import { AdminShell, type AdminTab } from './components/dashboard/AdminShell';
import { VehiclesSection } from './components/dashboard/VehiclesSection';
import { VehicleDetail } from './components/dashboard/VehicleDetail';
import { MaintenancePlansSection } from './components/dashboard/MaintenancePlansSection';
import { clearSession, getSession } from './services/apiClient';
import type { InspectionType, Role, Vehicle } from './types/domain';

type Route =
  | { view: 'list' }
  | { view: 'flow'; vehicle: Vehicle; type: InspectionType }
  | { view: 'admin'; tab: AdminTab }
  | { view: 'admin-defects' }
  | { view: 'admin-vehicle'; vehicleId: string };

function initialRoute(role: Role | null): Route {
  return role === 'ADMIN' ? { view: 'admin', tab: 'resumen' } : { view: 'list' };
}

function App() {
  const [role, setRole] = useState<Role | null>(() => getSession()?.role ?? null);
  const [route, setRoute] = useState<Route>(() => initialRoute(getSession()?.role ?? null));
  const [listKey, setListKey] = useState(0);

  function handleLogin(loggedRole: Role, _username: string) {
    setRole(loggedRole);
    setRoute(initialRoute(loggedRole));
  }

  function handleLogout() {
    clearSession();
    setRole(null);
    setRoute({ view: 'list' });
  }

  function handleSelectVehicle(vehicle: Vehicle) {
    // Decisión de producto (CAM-11): un vehículo con viaje abierto solo puede cerrarlo (post-viaje).
    const type: InspectionType = vehicle.status === 'on-trip' ? 'post-trip' : 'pre-trip';
    setRoute({ view: 'flow', vehicle, type });
  }

  function handleFlowDone() {
    setListKey((k) => k + 1);
    setRoute({ view: 'list' });
  }

  function handleFlowBack() {
    setRoute({ view: 'list' });
  }

  if (!role) {
    return (
      <main className="app mobile-shell">
        <Login onLogin={handleLogin} />
      </main>
    );
  }

  if (role === 'ADMIN') {
    const activeTab = route.view === 'admin' ? route.tab : route.view === 'admin-vehicle' ? 'vehiculos' : 'resumen';
    return (
      <main className="app">
        <AdminShell
          activeTab={activeTab}
          onSelectTab={(tab) => setRoute({ view: 'admin', tab })}
          onLogout={handleLogout}
        >
          {route.view === 'admin-defects' ? (
            <DefectsList onBack={() => setRoute({ view: 'admin', tab: 'resumen' })} />
          ) : route.view === 'admin-vehicle' ? (
            <VehicleDetail
              vehicleId={route.vehicleId}
              onBack={() => setRoute({ view: 'admin', tab: 'vehiculos' })}
            />
          ) : activeTab === 'vehiculos' ? (
            <VehiclesSection onOpenVehicle={(vehicleId) => setRoute({ view: 'admin-vehicle', vehicleId })} />
          ) : activeTab === 'planes' ? (
            <MaintenancePlansSection />
          ) : (
            <AdminDashboard onViewDefects={() => setRoute({ view: 'admin-defects' })} />
          )}
        </AdminShell>
      </main>
    );
  }

  return (
    <main className="app mobile-shell">
      {route.view !== 'flow' && (
        <nav className="top-nav top-nav--chofer">
          <button type="button" className="top-nav__logout" onClick={handleLogout}>
            Cerrar sesión
          </button>
        </nav>
      )}
      {route.view === 'list' && <VehicleList key={listKey} onSelectVehicle={handleSelectVehicle} />}
      {route.view === 'flow' && (
        <InspectionFlow vehicle={route.vehicle} type={route.type} onDone={handleFlowDone} onBack={handleFlowBack} />
      )}
    </main>
  );
}

export default App;
