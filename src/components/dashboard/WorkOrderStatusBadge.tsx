import type { WorkOrderStatus } from '../../types/domain';
import { WORK_ORDER_STATUS_LABEL } from '../../utils/workOrderFormat';

export function WorkOrderStatusBadge({ status }: { status: WorkOrderStatus }) {
  return <span className={`work-order-badge work-order-badge--${status}`}>{WORK_ORDER_STATUS_LABEL[status]}</span>;
}
