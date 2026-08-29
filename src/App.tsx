import { useState } from 'react';
import './App.css';
import { VehicleList } from './components/VehicleList';
import { InspectionFlow } from './components/InspectionFlow';
import { getVehicleStatus, type InspectionType, type Vehicle } from './types/domain';

type Route =
  | { view: 'list' }
  | { view: 'flow'; vehicle: Vehicle; type: InspectionType; tripId?: string };

function App() {
  const [route, setRoute] = useState<Route>({ view: 'list' });
  const [listKey, setListKey] = useState(0);

  function handleSelectVehicle(vehicle: Vehicle) {
    const status = getVehicleStatus(vehicle);
    if (status === 'on-trip') {
      // Product decision (CAM-11): a vehicle with an open trip cannot start a new
      // pre-trip. The only valid action for the driver here is to close it out
      // with the post-trip checklist.
      if (vehicle.openTripId) {
        setRoute({ view: 'flow', vehicle, type: 'post-trip', tripId: vehicle.openTripId });
      }
      return;
    }
    setRoute({ view: 'flow', vehicle, type: 'pre-trip' });
  }

  function handleFlowDone() {
    setListKey((k) => k + 1);
    setRoute({ view: 'list' });
  }

  return (
    <main className="app">
      {route.view === 'list' && <VehicleList key={listKey} onSelectVehicle={handleSelectVehicle} />}
      {route.view === 'flow' && (
        <InspectionFlow
          vehicle={route.vehicle}
          type={route.type}
          tripId={route.tripId}
          onDone={handleFlowDone}
        />
      )}
    </main>
  );
}

export default App;
