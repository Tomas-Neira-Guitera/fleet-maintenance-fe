import type { MaintenanceRowStatus } from '../../types/domain';

const LABEL: Record<MaintenanceRowStatus, string> = {
  al_dia: 'Al día',
  por_vencer: 'Por vencer',
  vencido: 'Vencido',
};

export function StatusBadge({ status }: { status: MaintenanceRowStatus }) {
  return <span className={`fleet-status-badge fleet-status-badge--${status}`}>{LABEL[status]}</span>;
}
