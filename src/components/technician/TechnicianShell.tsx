import { useState } from 'react';
import type { WorkOrder } from '../../types/domain';
import { MyWorkOrders } from './MyWorkOrders';
import { TechnicianWorkOrder } from './TechnicianWorkOrder';

interface TechnicianShellProps {
  onLogout: () => void;
}

/**
 * Vista del técnico (CAM-59/CAM-60): mobile-first y con el mismo molde que la del
 * chofer -- una lista y, al tocar un ítem, una pantalla de trabajo. "Cerrar sesión"
 * solo en la lista, igual que en el flujo de inspección.
 */
export function TechnicianShell({ onLogout }: TechnicianShellProps) {
  const [selected, setSelected] = useState<WorkOrder | null>(null);
  // Se incrementa al volver del detalle para que la lista se vuelva a pedir con los cambios.
  const [listKey, setListKey] = useState(0);

  function backToList() {
    setSelected(null);
    setListKey((k) => k + 1);
  }

  if (selected) {
    return <TechnicianWorkOrder workOrder={selected} onBack={backToList} onDone={backToList} />;
  }

  return (
    <>
      <nav className="top-nav top-nav--tecnico">
        <button type="button" className="top-nav__logout" onClick={onLogout}>
          Cerrar sesión
        </button>
      </nav>
      <MyWorkOrders key={listKey} onSelectWorkOrder={setSelected} />
    </>
  );
}
