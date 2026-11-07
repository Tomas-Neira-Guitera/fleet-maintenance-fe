import type { WorkOrderPause, WorkOrderStatus } from '../../types/domain';
import { describePause, PAUSE_REASON_LABEL, WORK_ORDER_STATUS_LABEL } from '../../utils/workOrderFormat';

interface WorkOrderStatusBadgeProps {
  status: WorkOrderStatus;
  /** CAM-148: con una OT en espera, el motivo va en el badge ("En espera · Esperando repuesto") y el comentario en el tooltip. */
  pause?: WorkOrderPause | null;
}

export function WorkOrderStatusBadge({ status, pause }: WorkOrderStatusBadgeProps) {
  const onHold = status === 'en_espera' && pause;
  return (
    <span className={`work-order-badge work-order-badge--${status}`} title={onHold ? describePause(pause) : undefined}>
      {WORK_ORDER_STATUS_LABEL[status]}
      {onHold && ` · ${PAUSE_REASON_LABEL[pause.reason]}`}
    </span>
  );
}
