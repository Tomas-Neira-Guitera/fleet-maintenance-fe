import { useEffect, useState } from 'react';
import './App.css';
import { VehicleList } from './components/VehicleList';
import { InspectionFlow } from './components/InspectionFlow';
import { DefectsList } from './components/DefectsList';
import { Login } from './components/Login';
import { NotificationBell } from './components/NotificationBell';
import { AdminDashboard } from './components/dashboard/AdminDashboard';
import { AdminShell } from './components/dashboard/AdminShell';
import { VehiclesSection } from './components/dashboard/VehiclesSection';
import { VehicleDetail } from './components/dashboard/VehicleDetail';
import { MaintenancePlansSection } from './components/dashboard/MaintenancePlansSection';
import { TechnicianShell } from './components/technician/TechnicianShell';
import { WorkOrdersSection } from './components/dashboard/WorkOrdersSection';
import { ExpensesSection } from './components/dashboard/ExpensesSection';
import { UsersSection } from './components/dashboard/UsersSection';
import { NotificationSettingsSection } from './components/dashboard/NotificationSettingsSection';
import { adminPath, parseAdminPath, useAdminRoute } from './hooks/useAdminRoute';
import { authHeaders, clearSession, getSession, isSessionTokenExpired } from './services/apiClient';
import { disablePush } from './utils/webPush';
import type { InspectionType, Role, Vehicle } from './types/domain';

// Pantallas del chofer. Las del admin van por URL (CAM-82, useAdminRoute); el chofer y el técnico
// siguen en "/" porque sus flujos tienen datos a medio cargar que una recarga perdería igual.
type Route = { view: 'list' } | { view: 'flow'; vehicle: Vehicle; type: InspectionType };

/** Vista del admin, aparte para que el hook de ruteo solo corra con ese rol. */
function AdminApp({ onLogout }: { onLogout: () => void }) {
  const [route, navigate] = useAdminRoute();
  const activeTab =
    route.view === 'tab'
      ? route.tab
      : route.view === 'vehicle'
        ? 'vehiculos'
        : route.view === 'vehicle-expenses'
          ? 'gastos'
          : route.view === 'work-order'
            ? 'ordenes-trabajo'
            : 'resumen';

  // El link de un aviso (CAM-96) es una ruta del admin, la misma que se ve en la URL. Si no es una
  // conocida, tocar el aviso solo lo marca como leído.
  function openNotificationLink(link: string) {
    const url = new URL(link, window.location.origin);
    const next = parseAdminPath(url.pathname, url.search);
    if (next) navigate(next);
  }

  return (
    <main className="app">
      <AdminShell
        activeTab={activeTab}
        locationKey={adminPath(route)}
        onSelectTab={(tab) => navigate({ view: 'tab', tab })}
        onOpenNotificationLink={openNotificationLink}
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
            onViewExpenses={() => navigate({ view: 'vehicle-expenses', vehicleId: route.vehicleId })}
          />
        ) : route.view === 'vehicle-expenses' ? (
          // key: llegar con otro vehículo, o volver a Gastos sin filtro, arranca la pestaña de cero.
          <ExpensesSection key={route.vehicleId} onLogout={onLogout} initialVehicleId={route.vehicleId} />
        ) : route.view === 'work-order' ? (
          <WorkOrdersSection
            key={route.workOrderId}
            openWorkOrderId={route.workOrderId}
            onDetailClosed={() => navigate({ view: 'tab', tab: 'ordenes-trabajo' })}
          />
        ) : activeTab === 'vehiculos' ? (
          <VehiclesSection onOpenVehicle={(vehicleId) => navigate({ view: 'vehicle', vehicleId })} />
        ) : activeTab === 'planes' ? (
          <MaintenancePlansSection />
        ) : activeTab === 'ordenes-trabajo' ? (
          <WorkOrdersSection />
        ) : activeTab === 'gastos' ? (
          <ExpensesSection key="todos" onLogout={onLogout} />
        ) : activeTab === 'usuarios' ? (
          <UsersSection onLogout={onLogout} />
        ) : activeTab === 'notificaciones' ? (
          <NotificationSettingsSection
            onLogout={onLogout}
            onGoToUsers={() => navigate({ view: 'tab', tab: 'usuarios' })}
          />
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
  // Por qué el chofer volvió a la flota sin poder enviar la inspección (CAM-89).
  const [listNotice, setListNotice] = useState<string | null>(null);

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
    // CAM-119: el próximo que use este navegador no tiene que recibir los avisos del que se fue. Se le
    // pasa el token ahora porque clearSession lo borra enseguida; la baja termina en segundo plano. Si
    // la sesión solo venció (el chofer abre la app al día siguiente), las push siguen: son del mismo
    // usuario, y si entra otro, al abrir la campanita pasan a ser suyas.
    if (!isSessionTokenExpired()) void disablePush(authHeaders());
    clearSession();
    // El próximo que entre arranca de cero, no en la última pantalla del admin anterior.
    window.history.replaceState(null, '', '/');
    setRole(null);
    setListNotice(null);
    setRoute({ view: 'list' });
  }

  function handleSelectVehicle(vehicle: Vehicle) {
    // Decisión de producto (CAM-11): un vehículo con viaje abierto solo puede cerrarlo (post-viaje).
    const type: InspectionType = vehicle.status === 'on-trip' ? 'post-trip' : 'pre-trip';
    setListNotice(null);
    setRoute({ view: 'flow', vehicle, type });
  }

  function handleFlowUnavailable(message: string) {
    setListNotice(message);
    setListKey((k) => k + 1);
    setRoute({ view: 'list' });
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
          <NotificationBell />
          <button type="button" className="top-nav__logout" onClick={handleLogout}>
            Cerrar sesión
          </button>
        </nav>
      )}
      {route.view === 'list' && (
        <VehicleList key={listKey} onSelectVehicle={handleSelectVehicle} notice={listNotice} />
      )}
      {route.view === 'flow' && (
        <InspectionFlow
          vehicle={route.vehicle}
          type={route.type}
          onDone={handleFlowDone}
          onBack={handleFlowBack}
          onUnavailable={handleFlowUnavailable}
          onLogout={handleLogout}
        />
      )}
    </main>
  );
}

export default App;
