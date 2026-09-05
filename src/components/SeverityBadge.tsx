import type { DefectSeverity } from '../types/domain';

const LABEL: Record<DefectSeverity, string> = {
  blocking: 'Bloqueante',
  'non-blocking': 'No bloqueante',
};

export function SeverityBadge({ severity }: { severity: DefectSeverity }) {
  return <span className={`severity-tag severity-tag--${severity}`}>{LABEL[severity]}</span>;
}
