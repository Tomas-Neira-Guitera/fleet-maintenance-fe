import type { WorkOrder } from '../types/domain';

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
