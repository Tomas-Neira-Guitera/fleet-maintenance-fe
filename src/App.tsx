import { useEffect, useState } from 'react';
import './App.css';
import { VehicleList } from './components/VehicleList';
import { InspectionFlow } from './components/InspectionFlow';
import { RoadDefectForm } from './components/RoadDefectForm';
import { FuelLoadScreen } from './components/FuelLoadScreen';
import { DefectsList } from './components/DefectsList';
import { Login } from './components/Login';
import { NotificationBell } from './components/NotificationBell';
import { AdminDashboard } from './components/dashboard/AdminDashboard';
import { AdminShell } from './components/dashboard/AdminShell';
import { VehicleComparisonSection } from './components/dashboard/VehicleComparisonSection';
import { ChecklistTemplatesSection } from './components/dashboard/ChecklistTemplatesSection';
import { VehiclesSection } from './components/dashboard/VehiclesSection';
import { VehicleDetail } from './components/dashboard/VehicleDetail';
import { MaintenancePlansSection } from './components/dashboard/MaintenancePlansSection';
import { TechnicianShell } from './components/technician/TechnicianShell';
import { WorkOrdersSection } from './components/dashboard/WorkOrdersSection';
import { ExpensesSection } from './components/dashboard/ExpensesSection';
import { UsersSection } from './components/dashboard/UsersSection';
import { NotificationSettingsSection } from './components/dashboard/NotificationSettingsSection';
import { adminPath, parseAdminPath, useAdminRoute } from './hooks/useAdminRoute';
import { clearOfflineCache } from './offline/offlineCache';
import { startPendingInspectionsSync } from './offline/pendingInspections';
import { ApiError, authHeaders, clearSession, getSession, isSessionTokenExpired } from './services/apiClient';
import { getVehicle } from './services/vehiclesService';
import { parseInspectionPath } from './utils/publicUrl';
import { disablePush } from './utils/webPush';
import type { InspectionType, Role, Vehicle } from './types/domain';

// Pantallas del chofer. Las del admin van por URL (CAM-82, useAdminRoute); el chofer y el técnico
// siguen en "/" porque sus flujos tienen datos a medio cargar que una recarga perdería igual. La
// excepción es /inspeccion/{vehicleId}, la dirección del QR del camión (CAM-133): abre su inspección.
type Route =
  | { view: 'list' }
  | { view: 'flow'; vehicle: Vehicle; type: InspectionType }
  // CAM-139: reportar un problema durante el viaje, sin cerrarlo.
  | { view: 'road-defect'; vehicle: Vehicle }
  // CAM-156: cargar combustible.
  | { view: 'fuel'; vehicle: Vehicle };

/** Vista del admin, aparte para que el hook de ruteo solo corra con ese rol. */
function AdminApp({ onLogout }: { onLogout: () => void }) {
  const [route, navigate] = useAdminRoute();
  const activeTab =
    route.view === 'tab'
      ? route.tab
      : route.view === 'vehicle' || route.view === 'vehicle-comparison' || route.view === 'checklist-templates'
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
            tab={route.tab}
            onSelectTab={(tab) => navigate({ view: 'vehicle', vehicleId: route.vehicleId, tab })}
            onBack={() => navigate({ view: 'tab', tab: 'vehiculos' })}
            onViewExpenses={() => navigate({ view: 'vehicle-expenses', vehicleId: route.vehicleId })}
          />
        ) : route.view === 'vehicle-comparison' ? (
          <VehicleComparisonSection
            onOpenVehicle={(vehicleId) => navigate({ view: 'vehicle', vehicleId })}
            onBack={() => navigate({ view: 'tab', tab: 'vehiculos' })}
          />
        ) : route.view === 'checklist-templates' ? (
          <ChecklistTemplatesSection onBack={() => navigate({ view: 'tab', tab: 'vehiculos' })} />
        ) : route.view === 'vehicle-expenses' ? (
          // key: llegar con otro vehículo, o volver a Gastos sin filtro, arranca la pestaña de cero.
          <ExpensesSection
            key={route.vehicleId}
            onLogout={onLogout}
            initialVehicleId={route.vehicleId}
            onOpenFuel={(vehicleId) => navigate({ view: 'vehicle', vehicleId, tab: 'combustible' })}
          />
        ) : route.view === 'work-order' ? (
          <WorkOrdersSection
            key={route.workOrderId}
            openWorkOrderId={route.workOrderId}
            onDetailClosed={() => navigate({ view: 'tab', tab: 'ordenes-trabajo' })}
          />
        ) : activeTab === 'vehiculos' ? (
          <VehiclesSection
            onOpenVehicle={(vehicleId) => navigate({ view: 'vehicle', vehicleId })}
            onCompare={() => navigate({ view: 'vehicle-comparison' })}
            onOpenTemplates={() => navigate({ view: 'checklist-templates' })}
          />
        ) : activeTab === 'planes' ? (
          <MaintenancePlansSection />
        ) : activeTab === 'ordenes-trabajo' ? (
          <WorkOrdersSection />
        ) : activeTab === 'gastos' ? (
          <ExpensesSection
            key="todos"
            onLogout={onLogout}
            onOpenFuel={(vehicleId) => navigate({ view: 'vehicle', vehicleId, tab: 'combustible' })}
          />
        ) : activeTab === 'usuarios' ? (
          <UsersSection onLogout={onLogout} />
        ) : activeTab === 'notificaciones' ? (
          <NotificationSettingsSection
            onLogout={onLogout}
            onGoToUsers={() => navigate({ view: 'tab', tab: 'usuarios' })}
          />
        ) : (
          <AdminDashboard
            onViewDefects={() => navigate({ view: 'defects' })}
            onOpenVehicle={(vehicleId) => navigate({ view: 'vehicle', vehicleId })}
          />
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
  // Qué se hizo antes de volver a la flota (CAM-139: el problema reportado en viaje).
  const [listConfirmation, setListConfirmation] = useState<string | null>(null);
  // CAM-133: el vehículo del QR escaneado. Sobrevive al login: sin sesión se entra y se sigue a ese vehículo.
  const [scannedVehicleId, setScannedVehicleId] = useState<string | null>(() =>
    parseInspectionPath(window.location.pathname),
  );

  // Sin sesión se deja la URL como está: si era el link a un vehículo, el admin cae ahí al
  // loguearse. El chofer y el técnico no tienen rutas, así que no se quedan con una del admin.
  useEffect(() => {
    if (role && role !== 'ADMIN' && window.location.pathname !== '/') {
      window.history.replaceState(null, '', '/');
    }
  }, [role]);

  // CAM-153: mientras el chofer tiene la app abierta, las inspecciones guardadas sin señal se mandan solas.
  useEffect(() => {
    if (role !== 'CHOFER') return;
    return startPendingInspectionsSync();
  }, [role]);

  // CAM-133: el chofer va directo a la inspección del QR, con la misma regla que la lista: con un
  // viaje abierto, post-viaje. Un técnico va a su vista; el admin, al detalle del vehículo (useAdminRoute).
  useEffect(() => {
    if (role !== 'CHOFER' || !scannedVehicleId) return;
    let cancelled = false;
    getVehicle(scannedVehicleId)
      .then((vehicle) => {
        if (cancelled) return;
        if (vehicle.active === false) {
          setListNotice(`${vehicle.plate} está dado de baja.`);
        } else if (vehicle.blocked && vehicle.status !== 'on-trip') {
          const reasons = (vehicle.blockReasons ?? []).map((r) => r.message).join('; ');
          setListNotice(`${vehicle.plate} no puede salir${reasons ? `: ${reasons}` : ''}.`);
        } else {
          handleSelectVehicle(vehicle);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setListNotice(
          err instanceof ApiError && err.status === 404
            ? 'El código QR no corresponde a ningún vehículo de la flota.'
            : 'No se pudo abrir el vehículo del código QR. Elegilo de la lista.',
        );
      })
      .finally(() => {
        if (!cancelled) setScannedVehicleId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [role, scannedVehicleId]);

  /** Aviso del chofer (CAM-102/103): su link lleva a la inspección del vehículo, igual que el QR. */
  function handleDriverNotificationLink(link: string) {
    const vehicleId = parseInspectionPath(new URL(link, window.location.origin).pathname);
    if (vehicleId) {
      setRoute({ view: 'list' });
      setScannedVehicleId(vehicleId);
    }
  }

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
    // CAM-153: la flota guardada para trabajar sin señal es del que se fue. Las inspecciones pendientes no se
    // borran: son de ese chofer y se mandan cuando vuelva a entrar.
    clearOfflineCache();
    // El próximo que entre arranca de cero, no en la última pantalla del admin anterior.
    window.history.replaceState(null, '', '/');
    setRole(null);
    setListNotice(null);
    setListConfirmation(null);
    setScannedVehicleId(null);
    setRoute({ view: 'list' });
  }

  function handleSelectVehicle(vehicle: Vehicle) {
    // Decisión de producto (CAM-11): un vehículo con viaje abierto solo puede cerrarlo (post-viaje).
    const type: InspectionType = vehicle.status === 'on-trip' ? 'post-trip' : 'pre-trip';
    setListNotice(null);
    setListConfirmation(null);
    setRoute({ view: 'flow', vehicle, type });
  }

  function handleReportProblem(vehicle: Vehicle) {
    setListNotice(null);
    setListConfirmation(null);
    setRoute({ view: 'road-defect', vehicle });
  }

  function handleLoadFuel(vehicle: Vehicle) {
    setListNotice(null);
    setListConfirmation(null);
    setRoute({ view: 'fuel', vehicle });
  }

  function handleFuelDone(message: string) {
    setListConfirmation(message);
    setListKey((k) => k + 1);
    setRoute({ view: 'list' });
  }

  function handleRoadDefectDone(plate: string) {
    setListConfirmation(`Problema reportado en ${plate}. Cuando termines, cerrá el viaje con el post-viaje.`);
    setListKey((k) => k + 1);
    setRoute({ view: 'list' });
  }

  function handleFlowUnavailable(message: string) {
    setListNotice(message);
    setListConfirmation(null);
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
      {route.view === 'list' && (
        <nav className="top-nav top-nav--chofer">
          <NotificationBell onOpenLink={handleDriverNotificationLink} />
          <button type="button" className="top-nav__logout" onClick={handleLogout}>
            Cerrar sesión
          </button>
        </nav>
      )}
      {route.view === 'list' && (
        <VehicleList
          key={listKey}
          onSelectVehicle={handleSelectVehicle}
          onReportProblem={handleReportProblem}
          onLoadFuel={handleLoadFuel}
          notice={listNotice}
          confirmation={listConfirmation}
        />
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
      {route.view === 'road-defect' && (
        <RoadDefectForm
          vehicle={route.vehicle}
          onDone={() => handleRoadDefectDone(route.vehicle.plate)}
          onBack={handleFlowBack}
          onUnavailable={handleFlowUnavailable}
          onLogout={handleLogout}
        />
      )}
      {route.view === 'fuel' && (
        <FuelLoadScreen
          vehicle={route.vehicle}
          onDone={handleFuelDone}
          onBack={handleFlowBack}
          onUnavailable={handleFlowUnavailable}
          onLogout={handleLogout}
        />
      )}
    </main>
  );
}

export default App;
