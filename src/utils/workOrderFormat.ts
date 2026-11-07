import type { WorkOrder, WorkOrderPauseReason, WorkOrderStatus } from '../types/domain';

export const WORK_ORDER_STATUS_LABEL: Record<WorkOrderStatus, string> = {
  asignada: 'Asignada',
  en_proceso: 'En proceso',
  en_espera: 'En espera',
  finalizada: 'Finalizada',
  cancelada: 'Cancelada',
};

/** CAM-148: los estados de una OT abierta, la que todavía se puede editar. Igual que WorkOrderStatus.OPEN del backend. */
export const OPEN_WORK_ORDER_STATUSES: WorkOrderStatus[] = ['asignada', 'en_proceso', 'en_espera'];

export function isOpenWorkOrder(wo: Pick<WorkOrder, 'status'>): boolean {
  return OPEN_WORK_ORDER_STATUSES.includes(wo.status);
}

/** CAM-148: los motivos de una pausa, en el orden en que se ofrecen. */
export const PAUSE_REASON_LABEL: Record<WorkOrderPauseReason, string> = {
  esperando_repuesto: 'Esperando repuesto',
  esperando_proveedor: 'Esperando al proveedor',
  esperando_vehiculo: 'Esperando el vehículo',
  otro: 'Otro',
};

/** Largo máximo del comentario de una pausa, igual que el backend. */
export const PAUSE_COMMENT_MAX_LENGTH = 500;

/** CAM-148: "Esperando repuesto: pastillas pedidas a Bosch". */
export function describePause(pause: NonNullable<WorkOrder['pause']>): string {
  const label = PAUSE_REASON_LABEL[pause.reason];
  return pause.comment ? `${label}: ${pause.comment}` : label;
}

/** CAM-148: el tiempo en espera, para el detalle. "45 min", "3 h 20 min", "2 días 5 h". */
export function formatPausedDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  // Una pausa de segundos (pausar y retomar enseguida) no es "0 min".
  if (minutes === 0) return seconds > 0 ? 'menos de 1 min' : '0 min';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const rest = minutes % 60;
    return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
  }
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  const dayLabel = `${days} día${days === 1 ? '' : 's'}`;
  return restHours === 0 ? dayLabel : `${dayLabel} ${restHours} h`;
}

/**
 * Quién está a cargo de una OT, para mostrar (CAM-60). En las internas manda el técnico
 * asignado; el texto libre de `assignee` queda de respaldo para OTs cargadas antes de
 * CAM-60. En las externas, `assignee` es el contacto en el proveedor.
 */
export function workOrderResponsible(wo: WorkOrder): string | null {
  if (wo.executionType === 'interno') return wo.technicianUsername ?? wo.assignee;
  return wo.assignee;
}

/**
 * Km al finalizar una OT (CAM-74): entero no negativo, sin decimales. Que no sea menor al
 * odómetro del vehículo lo valida el backend, que es el que lo conoce (422 en completedKm).
 */
export function isValidCompletedKm(value: string): boolean {
  return /^\d+$/.test(value.trim());
}
