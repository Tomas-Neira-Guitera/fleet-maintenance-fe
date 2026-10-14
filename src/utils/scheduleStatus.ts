import type { ScheduledMaintenance, ScheduleSourceType, ScheduleStatus } from '../types/domain';

// Estado de un turno tal como lo ve el calendario (CAM-65). "Atrasado" no existe en el backend: es un
// turno todavía programado cuya fecha y hora ya pasaron.
export type ScheduleDisplayStatus = 'scheduled' | 'overdue' | 'done' | 'cancelled';

/** Lo que pide el calendario: también lo hecho y lo cancelado, para que no desaparezca de su día. */
export const ALL_SCHEDULE_STATUSES: ScheduleStatus[] = ['scheduled', 'done', 'cancelled'];

export const SCHEDULE_STATUS_LABEL: Record<ScheduleDisplayStatus, string> = {
  scheduled: 'Programado',
  overdue: 'Atrasado',
  done: 'Hecho',
  cancelled: 'Cancelado',
};

/** Orden de la leyenda del calendario. */
export const SCHEDULE_DISPLAY_STATUSES: ScheduleDisplayStatus[] = ['scheduled', 'overdue', 'done', 'cancelled'];

export const SCHEDULE_SOURCE_LABEL: Record<ScheduleSourceType, string> = {
  assignment: 'Plan de mantenimiento',
  defect: 'Defecto reportado',
  manual: 'Programado a mano',
};

/** Versión corta del origen, para la tarjeta de un turno en la grilla. */
export const SCHEDULE_SOURCE_SHORT_LABEL: Record<ScheduleSourceType, string> = {
  assignment: 'Plan',
  defect: 'Defecto',
  manual: 'Manual',
};

export function scheduleDisplayStatus(item: ScheduledMaintenance, now: Date = new Date()): ScheduleDisplayStatus {
  if (item.status !== 'scheduled') return item.status;
  return new Date(item.scheduledAt).getTime() < now.getTime() ? 'overdue' : 'scheduled';
}
