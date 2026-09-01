import { useState } from 'react';
import './App.css';
import { VehicleList } from './components/VehicleList';
import { InspectionFlow } from './components/InspectionFlow';
import { DefectsList } from './components/DefectsList';
import type { InspectionType, Vehicle } from './types/domain';

type Route =
  | { view: 'list' }
  | { view: 'defects' }
  | { view: 'flow'; vehicle: Vehicle; type: InspectionType };

function App() {
  const [route, setRoute] = useState<Route>({ view: 'list' });
  const [listKey, setListKey] = useState(0);

  function handleSelectVehicle(vehicle: Vehicle) {
    // Decisión de producto (CAM-11): un vehículo con viaje abierto solo puede cerrarlo (post-viaje).
    const type: InspectionType = vehicle.status === 'on-trip' ? 'post-trip' : 'pre-trip';
    setRoute({ view: 'flow', vehicle, type });
  }

  function handleFlowDone() {
    setListKey((k) => k + 1);
    setRoute({ view: 'list' });
  }

  return (
    <main className="app">
      {route.view !== 'flow' && (
        <nav className="top-nav">
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
        </nav>
      )}
      {route.view === 'list' && <VehicleList key={listKey} onSelectVehicle={handleSelectVehicle} />}
      {route.view === 'defects' && <DefectsList />}
      {route.view === 'flow' && (
        <InspectionFlow vehicle={route.vehicle} type={route.type} onDone={handleFlowDone} />
      )}
    </main>
  );
}

export default App;
