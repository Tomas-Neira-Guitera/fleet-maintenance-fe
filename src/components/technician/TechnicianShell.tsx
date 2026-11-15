import { useState } from 'react';
import { getSessionUserId } from '../../services/apiClient';
import { getWorkOrder } from '../../services/workOrdersService';
import type { WorkOrder } from '../../types/domain';
import { isOpenWorkOrder } from '../../utils/workOrderFormat';
import { NotificationBell } from '../NotificationBell';
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

  /**
   * CAM-149: el aviso de un comentario lleva a esa OT ("/ordenes-trabajo/{id}"). El técnico no tiene rutas, así
   * que se abre acá. Los demás avisos del técnico tienen link "/" y solo se marcan leídos. Se abre solo si sigue
   * abierta y sigue siendo suya, igual que lo que muestra "Mis órdenes": un aviso viejo de una OT que le pasaron a
   * otro no tiene que dejarlo trabajarla (hasta CAM-69, el backend no lo frena en el resto de /work-orders).
   */
  function openFromNotification(link: string) {
    const match = /^\/ordenes-trabajo\/([A-Za-z0-9-]+)\/?$/.exec(link);
    if (!match) return;
    getWorkOrder(match[1])
      .then((workOrder) => {
        if (isOpenWorkOrder(workOrder) && workOrder.technicianId === getSessionUserId()) setSelected(workOrder);
      })
      .catch(() => {
        // Si no se pudo traer, el aviso queda leído y la OT sigue en la lista.
      });
  }

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
        <NotificationBell onOpenLink={openFromNotification} />
        <button type="button" className="top-nav__logout" onClick={onLogout}>
          Cerrar sesión
        </button>
      </nav>
      <MyWorkOrders key={listKey} onSelectWorkOrder={setSelected} />
    </>
  );
}
