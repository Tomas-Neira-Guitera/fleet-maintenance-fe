import { useState } from 'react';
import './App.css';
import { VehicleList } from './components/VehicleList';
import { InspectionFlow } from './components/InspectionFlow';
import { DefectsList } from './components/DefectsList';
import { Login } from './components/Login';
import { AdminPlaceholder } from './components/AdminPlaceholder';
import { clearSession, getSession } from './services/apiClient';
import type { InspectionType, Role, Vehicle } from './types/domain';

type Route =
  | { view: 'list' }
  | { view: 'defects' }
  | { view: 'flow'; vehicle: Vehicle; type: InspectionType }
  | { view: 'admin' };

function initialRoute(role: Role | null): Route {
  return role === 'ADMIN' ? { view: 'admin' } : { view: 'list' };
}

function App() {
  const [role, setRole] = useState<Role | null>(() => getSession()?.role ?? null);
  const [route, setRoute] = useState<Route>(() => initialRoute(getSession()?.role ?? null));
  const [listKey, setListKey] = useState(0);

  function handleLogin(loggedRole: Role) {
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

  if (!role) {
    return (
      <main className="app">
        <Login onLogin={handleLogin} />
      </main>
    );
  }

  return (
    <main className="app">
      {route.view !== 'flow' && (
        <nav className="top-nav">
          {role === 'CHOFER' && (
            <>
              <button
                type="button"
                className={`top-nav__tab${route.view === 'list' ? ' top-nav__tab--active' : ''}`}
                onClick={() => setRoute({ view: 'list' })}
              >
                Flota
              </button>
              <button
                type="button"
                className={`top-nav__tab${route.view === 'defects' ? ' top-nav__tab--active' : ''}`}
                onClick={() => setRoute({ view: 'defects' })}
              >
                Defectos
              </button>
            </>
          )}
          <button type="button" className="top-nav__logout" onClick={handleLogout}>
            Cerrar sesión
          </button>
        </nav>
      )}
      {route.view === 'list' && <VehicleList key={listKey} onSelectVehicle={handleSelectVehicle} />}
      {route.view === 'defects' && <DefectsList />}
      {route.view === 'flow' && (
        <InspectionFlow vehicle={route.vehicle} type={route.type} onDone={handleFlowDone} />
      )}
      {route.view === 'admin' && <AdminPlaceholder />}
    </main>
  );
}

export default App;
