import { SCHEDULE_STATUS_LABEL, type ScheduleDisplayStatus } from '../../utils/scheduleStatus';

/** Chip de estado de un turno del calendario (CAM-65), mismo lenguaje visual que el de las OTs. */
export function ScheduleStatusBadge({ status }: { status: ScheduleDisplayStatus }) {
  return <span className={`schedule-badge schedule-badge--${status}`}>{SCHEDULE_STATUS_LABEL[status]}</span>;
}
