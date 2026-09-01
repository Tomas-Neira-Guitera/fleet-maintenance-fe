import { useEffect, useState } from 'react';
import { getDefects } from '../services/defectsService';
import type { DefectSummary } from '../types/domain';
import { CameraIcon } from './icons';

export function DefectsList() {
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

  return (
    <div className="screen">
      <header className="screen__header">
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
            <span className={`severity-tag severity-tag--${defect.severity}`}>
              {defect.severity === 'blocking' ? 'Bloqueante' : 'No bloqueante'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' });
}
