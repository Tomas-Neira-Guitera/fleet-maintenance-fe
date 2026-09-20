import { useEffect, useState } from 'react';
import { getDefects } from '../services/defectsService';
import type { DefectSummary, ScheduledMaintenance, WorkOrder } from '../types/domain';
import { ArrowLeftIcon, CameraIcon } from './icons';
import { SeverityBadge } from './SeverityBadge';
import { SchedulePickerModal } from './dashboard/SchedulePickerModal';
import { CreateWorkOrderModal } from './dashboard/CreateWorkOrderModal';

interface DefectsListProps {
  onBack?: () => void;
}

export function DefectsList({ onBack }: DefectsListProps) {
  const [defects, setDefects] = useState<DefectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState<DefectSummary | null>(null);
  const [scheduledIds, setScheduledIds] = useState<Set<string>>(new Set());
  const [creatingWorkOrder, setCreatingWorkOrder] = useState<DefectSummary | null>(null);
  const [workOrderDefectIds, setWorkOrderDefectIds] = useState<Set<string>>(new Set());

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

  return (
    <div className="screen">
      <header className="screen__header">
        {onBack && (
          <button type="button" className="top-nav__back" onClick={onBack}>
            <ArrowLeftIcon width={16} height={16} />
            Volver
          </button>
        )}
        <h1 className="screen__title">Defectos</h1>
        <p className="screen__subtitle">Reportados en inspecciones, para priorizar mantenimiento</p>
      </header>

      {error && <p className="error-banner">{error}</p>}

      {!defects && !error && <p className="muted">Cargando defectos…</p>}

      {defects && defects.length === 0 && <p className="muted">No hay defectos reportados.</p>}

      <ul className="defect-summary-list">
        {defects?.map((defect) => (
          <li key={defect.id} className="defect-summary-item">
            <div className="defect-summary-item__info">
              <span className="defect-summary-item__label">{defect.description}</span>
              <span className="defect-summary-item__meta">
                <span className="vehicle-meta__plate">{defect.vehiclePlate}</span>
                {' · '}
                {formatDate(defect.createdAt)}
                {defect.photoUrl && (
                  <>
                    {' · '}
                    <a href={defect.photoUrl} target="_blank" rel="noreferrer" className="photo-link">
                      <CameraIcon className="photo-link__icon" />
                      Ver foto
                    </a>
                  </>
                )}
              </span>
            </div>
            <div className="defect-summary-item__actions">
              <SeverityBadge severity={defect.severity} />
              <button
                type="button"
                className="secondary-btn defect-summary-item__schedule-btn"
                onClick={() => setScheduling(defect)}
                disabled={scheduledIds.has(defect.id)}
              >
                {scheduledIds.has(defect.id) ? 'Programado' : 'Planificar'}
              </button>
              <button
                type="button"
                className="secondary-btn defect-summary-item__schedule-btn"
                onClick={() => setCreatingWorkOrder(defect)}
                disabled={workOrderDefectIds.has(defect.id) || defect.status === 'resuelto'}
              >
                {workOrderDefectIds.has(defect.id) ? 'OT generada' : 'Generar orden de trabajo'}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {scheduling && (
        <SchedulePickerModal
          sourceType="defect"
          sourceId={scheduling.id}
          title={scheduling.description}
          onClose={() => setScheduling(null)}
          onScheduled={(schedule: ScheduledMaintenance) => {
            setScheduledIds((prev) => new Set(prev).add(schedule.defectId ?? scheduling.id));
            setScheduling(null);
          }}
        />
      )}

      {creatingWorkOrder && (
        <CreateWorkOrderModal
          sourceType="defect"
          sourceId={creatingWorkOrder.id}
          subject={creatingWorkOrder.description}
          onClose={() => setCreatingWorkOrder(null)}
          onCreated={(workOrder: WorkOrder) => {
            setWorkOrderDefectIds((prev) => new Set(prev).add(workOrder.defectId ?? creatingWorkOrder.id));
            setCreatingWorkOrder(null);
          }}
        />
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' });
}
