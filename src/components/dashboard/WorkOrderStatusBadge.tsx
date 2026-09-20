import type { WorkOrderStatus } from '../../types/domain';

const LABEL: Record<WorkOrderStatus, string> = {
  asignada: 'Asignada',
  en_proceso: 'En proceso',
  finalizada: 'Finalizada',
  cancelada: 'Cancelada',
};

export function WorkOrderStatusBadge({ status }: { status: WorkOrderStatus }) {
  return <span className={`work-order-badge work-order-badge--${status}`}>{LABEL[status]}</span>;
}
