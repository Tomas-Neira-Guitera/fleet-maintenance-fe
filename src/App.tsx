import { useEffect, useState } from 'react';
import './App.css';
import { VehicleList } from './components/VehicleList';
import { InspectionFlow } from './components/InspectionFlow';
import { DefectsList } from './components/DefectsList';
import { Login } from './components/Login';
import { AdminDashboard } from './components/dashboard/AdminDashboard';
import { AdminShell } from './components/dashboard/AdminShell';
import { VehiclesSection } from './components/dashboard/VehiclesSection';
import { VehicleDetail } from './components/dashboard/VehicleDetail';
import { MaintenancePlansSection } from './components/dashboard/MaintenancePlansSection';
import { TechnicianShell } from './components/technician/TechnicianShell';
import { WorkOrdersSection } from './components/dashboard/WorkOrdersSection';
import { UsersSection } from './components/dashboard/UsersSection';
import { adminPath, useAdminRoute } from './hooks/useAdminRoute';
import { clearSession, getSession } from './services/apiClient';
import type { InspectionType, Role, Vehicle } from './types/domain';

// Pantallas del chofer. Las del admin van por URL (CAM-82, useAdminRoute); el chofer y el técnico
// siguen en "/" porque sus flujos tienen datos a medio cargar que una recarga perdería igual.
type Route = { view: 'list' } | { view: 'flow'; vehicle: Vehicle; type: InspectionType };

/** Vista del admin, aparte para que el hook de ruteo solo corra con ese rol. */
function AdminApp({ onLogout }: { onLogout: () => void }) {
  const [route, navigate] = useAdminRoute();
  const activeTab = route.view === 'tab' ? route.tab : route.view === 'vehicle' ? 'vehiculos' : 'resumen';

  return (
    <main className="app">
      <AdminShell
        activeTab={activeTab}
        locationKey={adminPath(route)}
        onSelectTab={(tab) => navigate({ view: 'tab', tab })}
        onLogout={onLogout}
      >
        {route.view === 'defects' ? (
          <DefectsList onBack={() => navigate({ view: 'tab', tab: 'resumen' })} />
        ) : route.view === 'vehicle' ? (
          <VehicleDetail
            // key: pasar de un vehículo a otro (atrás/adelante) remonta el detalle en vez de mezclar datos.
            key={route.vehicleId}
            vehicleId={route.vehicleId}
            onBack={() => navigate({ view: 'tab', tab: 'vehiculos' })}
          />
        ) : activeTab === 'vehiculos' ? (
          <VehiclesSection onOpenVehicle={(vehicleId) => navigate({ view: 'vehicle', vehicleId })} />
        ) : activeTab === 'planes' ? (
          <MaintenancePlansSection />
        ) : activeTab === 'ordenes-trabajo' ? (
          <WorkOrdersSection />
        ) : activeTab === 'usuarios' ? (
          <UsersSection onLogout={onLogout} />
        ) : (
          <AdminDashboard onViewDefects={() => navigate({ view: 'defects' })} />
        )}
      </AdminShell>
    </main>
  );
}

function App() {
  const [role, setRole] = useState<Role | null>(() => getSession()?.role ?? null);
  const [route, setRoute] = useState<Route>({ view: 'list' });
  const [listKey, setListKey] = useState(0);

  // Sin sesión se deja la URL como está: si era el link a un vehículo, el admin cae ahí al
  // loguearse. El chofer y el técnico no tienen rutas, así que no se quedan con una del admin.
  useEffect(() => {
    if (role && role !== 'ADMIN' && window.location.pathname !== '/') {
      window.history.replaceState(null, '', '/');
    }
  }, [role]);

  function handleLogin(loggedRole: Role, _username: string) {
    setRole(loggedRole);
    setRoute({ view: 'list' });
  }

  function handleLogout() {
    clearSession();
    // El próximo que entre arranca de cero, no en la última pantalla del admin anterior.
    window.history.replaceState(null, '', '/');
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
    return <AdminApp onLogout={handleLogout} />;
  }

  if (role === 'TECNICO') {
    return (
      <main className="app mobile-shell">
        <TechnicianShell onLogout={handleLogout} />
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
