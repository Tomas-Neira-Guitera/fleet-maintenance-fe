import type { NotificationChannel, NotificationType } from '../types/domain';

/** Nombre de cada canal de aviso tal como se muestra (CAM-117). */
export const CHANNEL_LABEL: Record<NotificationChannel, string> = {
  in_app: 'Campanita',
  push: 'Push',
  email: 'Email',
};

/** Qué es cada canal, para el tooltip de la columna. */
export const CHANNEL_HINT: Record<NotificationChannel, string> = {
  in_app: 'En la campanita de la app, mientras está abierta.',
  push: 'Notificación del navegador: llega aunque la app esté cerrada, en los dispositivos donde se activó.',
  email: 'A quienes tengan el email cargado en Usuarios.',
};

/** Ejemplo de cómo se ve cada aviso: el texto lo arma el backend, esto es solo para la pantalla de configuración. */
export const NOTIFICATION_EXAMPLE: Record<NotificationType, { title: string; message: string }> = {
  blocking_defect_reported: {
    title: 'Defecto bloqueante en AB123CD',
    message: 'Neumático cortado. Reportado en el pre-viaje por Juan Pérez. El vehículo no puede salir hasta resolverlo.',
  },
  work_order_finalized: {
    title: 'Orden de trabajo finalizada',
    message: 'Cambio de pastillas (AB123CD), hecha por Javier Romero.',
  },
  maintenance_due_soon: {
    title: 'Mantenimiento por vencer',
    message: 'Cambio de aceite de AB123CD: faltan 5 días (vence el 28/10).',
  },
  maintenance_overdue: {
    title: 'Mantenimiento vencido',
    message: 'Revisión de frenos de AB123CD: se pasó por 1.500 km (vencía a los 20.000 km).',
  },
  work_order_assigned: {
    title: 'Te asignaron una orden de trabajo',
    message: 'Cambio de pastillas (AB123CD), planificada para el 25/10 a las 09:00.',
  },
  work_order_unassigned: {
    title: 'Ya no tenés a cargo una orden de trabajo',
    message: 'Cambio de pastillas (AB123CD): ahora está a cargo de Javier Romero.',
  },
  work_order_cancelled: {
    title: 'Se canceló una orden de trabajo',
    message: 'Cambio de pastillas (AB123CD). Ya no tenés que hacerla.',
  },
  trip_open_reminder: {
    title: 'Acordate de cerrar el viaje',
    message: 'Tenés abierto el viaje de AB123CD desde el 23/10 a las 07:30. Acordate de hacer el post-viaje.',
  },
};

export type NotificationTopic = 'defects' | 'work_orders' | 'maintenance' | 'trips';

/** Temas de la pantalla de configuración, en orden, con sus avisos. */
export const NOTIFICATION_TOPICS: { id: NotificationTopic; label: string; types: NotificationType[] }[] = [
  { id: 'defects', label: 'Defectos', types: ['blocking_defect_reported'] },
  {
    id: 'work_orders',
    label: 'Órdenes de trabajo',
    types: ['work_order_finalized', 'work_order_assigned', 'work_order_unassigned', 'work_order_cancelled'],
  },
  { id: 'maintenance', label: 'Mantenimiento preventivo', types: ['maintenance_due_soon', 'maintenance_overdue'] },
  { id: 'trips', label: 'Viajes', types: ['trip_open_reminder'] },
];
