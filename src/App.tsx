import { useState } from 'react';
import './App.css';
import { VehicleList } from './components/VehicleList';
import { InspectionFlow } from './components/InspectionFlow';
import { FleetStatusTable } from './components/dashboard/FleetStatusTable';
import type { InspectionType, Vehicle } from './types/domain';

type Route = { view: 'list' } | { view: 'flow'; vehicle: Vehicle; type: InspectionType };

// Sin login/routing real todavía (como CURRENT_DRIVER en apiClient.ts): el dashboard de
// admin (CAM-40) se distingue por path mientras no exista un router ni roles reales.
const IS_ADMIN_DASHBOARD = window.location.pathname.startsWith('/admin');

function App() {
  if (IS_ADMIN_DASHBOARD) {
    return <FleetStatusTable />;
  }

  return <DriverApp />;
}

function DriverApp() {
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
      {route.view === 'list' && <VehicleList key={listKey} onSelectVehicle={handleSelectVehicle} />}
      {route.view === 'flow' && (
        <InspectionFlow vehicle={route.vehicle} type={route.type} onDone={handleFlowDone} />
      )}
    </main>
  );
}

export default App;
