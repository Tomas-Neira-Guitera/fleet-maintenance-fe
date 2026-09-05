import { useEffect, useState } from 'react';
import { getDefects } from '../../services/defectsService';
import type { DefectSummary } from '../../types/domain';
import { formatRelativeReportTime } from '../../utils/relativeTime';
import { SeverityBadge } from '../SeverityBadge';
import '../../styles/dashboard.css';

const MAX_RECENT_DEFECTS = 3;

interface RecentDefectsCardProps {
  onViewAll: () => void;
}

function describeReport(defect: DefectSummary): string {
  const { label, isToday } = formatRelativeReportTime(defect.createdAt);
  const parts = [isToday ? `Reportado ${label}` : label];
  if (defect.reportedBy) parts.push(defect.reportedBy);
  return parts.join(' · ');
}

export function RecentDefectsCard({ onViewAll }: RecentDefectsCardProps) {
  const [defects, setDefects] = useState<DefectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDefects()
      .then((data) => {
        if (!cancelled) setDefects(data);
      })
      .catch(() => {
        if (!cancelled) setError('No se pudieron cargar los defectos. Intentá de nuevo.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const recent = defects?.filter((d) => d.status === 'open').slice(0, MAX_RECENT_DEFECTS) ?? null;

  return (
    <section className="recent-defects-card">
      <header className="recent-defects-card__header">
        <h2 className="recent-defects-card__title">Defectos abiertos recientes</h2>
        <button type="button" className="recent-defects-card__view-all" onClick={onViewAll}>
          Ver todos →
        </button>
      </header>

      {error && <p className="error-banner">{error}</p>}
      {!recent && !error && <p className="muted">Cargando defectos…</p>}

      {recent && (
        <div className="recent-defects-card__list">
          {recent.length === 0 && <p className="muted">No hay defectos abiertos.</p>}
          {recent.map((defect) => (
            <div key={defect.id} className="recent-defects-card__item">
              <div className="recent-defects-card__top-line">
                <SeverityBadge severity={defect.severity} />
                <span className="vehicle-meta__plate">{defect.vehiclePlate}</span>
              </div>
              <p className="recent-defects-card__description">{defect.description}</p>
              <p className="recent-defects-card__meta">{describeReport(defect)}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
