import { useRef, useState } from 'react';
import { ApiError } from '../../services/apiClient';
import { ACCEPTED_PHOTO_TYPES, uploadDefectPhoto } from '../../services/photosService';
import { addWorkOrderPhoto, deleteWorkOrderPhoto, updateWorkOrder } from '../../services/workOrdersService';
import type { WorkOrder, WorkOrderSourceType } from '../../types/domain';
import { CameraIcon, ClipboardListIcon, ShieldCheckIcon, WrenchIcon } from '../icons';
import { PhotoViewer } from '../PhotoViewer';

/** Qué se cierra al finalizar, para la pantalla de éxito. Una OT manual no tiene origen que cerrar. */
const CLOSED_SOURCE_LABEL: Record<WorkOrderSourceType, string | null> = {
  defect: 'El defecto quedó resuelto.',
  scheduled_maintenance: 'El mantenimiento quedó registrado como hecho.',
  manual: null,
};

const SOURCE_LABEL: Record<WorkOrderSourceType, string> = {
  defect: 'Defecto reportado',
  scheduled_maintenance: 'Mantenimiento programado',
  manual: 'Orden manual',
};

interface TechnicianWorkOrderProps {
  workOrder: WorkOrder;
  onBack: () => void;
  onDone: () => void;
}

/**
 * Detalle de una OT para el técnico (CAM-60), con el mismo molde que el flujo de
 * inspección del chofer: encabezado con patente, secciones en tarjetas y botones grandes
 * abajo. Asignada → "Empezar trabajo"; en proceso → cierre + fotos → "Finalizar".
 * Cancelar y cargar gastos quedan del lado del admin.
 */
export function TechnicianWorkOrder({ workOrder, onBack, onDone }: TechnicianWorkOrderProps) {
  const [wo, setWo] = useState(workOrder);
  const [closingDescription, setClosingDescription] = useState('');
  const [completedKm, setCompletedKm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [removingPhotoId, setRemovingPhotoId] = useState<string | null>(null);
  const [finalized, setFinalized] = useState(false);
  const [defectPhotoFailed, setDefectPhotoFailed] = useState(false);
  const [viewingDefectPhoto, setViewingDefectPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mismo criterio que FinalizeWorkOrderModal: el km solo se pide si la OT cierra un plan de mantenimiento.
  const needsKm = wo.assignmentId != null;
  // Entero no negativo: el backend lo recibe como Long y truncaría un decimal en silencio.
  const kmValid = /^\d+$/.test(completedKm.trim());
  // Mientras sube o quita una foto no se puede finalizar ni salir: el backend podría ver otra
  // cantidad de fotos que la pantalla, o la lista se pediría antes de que termine.
  const busy = pending || uploadingPhoto || removingPhotoId !== null;
  const canFinalize =
    closingDescription.trim().length > 0 && wo.photos.length > 0 && (!needsKm || kmValid) && !busy;
  const createdLabel = new Date(wo.createdAt).toLocaleDateString('es-AR');

  async function handleStart() {
    setPending(true);
    setError(null);
    try {
      setWo(await updateWorkOrder(wo.id, { status: 'en_proceso' }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo empezar la orden. Intentá de nuevo.');
    } finally {
      setPending(false);
    }
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    setError(null);
    try {
      const { photoUrl } = await uploadDefectPhoto(file);
      const photo = await addWorkOrderPhoto(wo.id, photoUrl);
      setWo((current) => ({ ...current, photos: [...current.photos, photo] }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo subir la foto. Probá de nuevo.');
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleRemovePhoto(photoId: string) {
    setRemovingPhotoId(photoId);
    setError(null);
    try {
      await deleteWorkOrderPhoto(wo.id, photoId);
      setWo((current) => ({ ...current, photos: current.photos.filter((p) => p.id !== photoId) }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo quitar la foto. Intentá de nuevo.');
    } finally {
      setRemovingPhotoId(null);
    }
  }

  async function handleFinalize() {
    setPending(true);
    setError(null);
    try {
      await updateWorkOrder(wo.id, {
        status: 'finalizada',
        closingDescription: closingDescription.trim(),
        completedKm: needsKm ? Number(completedKm.trim()) : undefined,
      });
      setFinalized(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo finalizar la orden. Intentá de nuevo.');
    } finally {
      setPending(false);
    }
  }

  if (finalized) {
    return (
      <div className="screen screen--success">
        <div className="success-icon success-icon--ok">
          <ShieldCheckIcon />
        </div>
        <h1 className="screen__title">Orden finalizada</h1>
        <p className="screen__subtitle">
          El trabajo en {wo.plate ?? 'el vehículo'} quedó registrado.
          {CLOSED_SOURCE_LABEL[wo.sourceType] ? ` ${CLOSED_SOURCE_LABEL[wo.sourceType]}` : ''}
        </p>
        <button type="button" className="primary-btn" onClick={onDone}>
          Volver a mis órdenes
        </button>
      </div>
    );
  }

  return (
    <div className="screen">
      <header className="screen__header">
        <h1 className="screen__title">{wo.title}</h1>
        <p className="screen__subtitle vehicle-meta">
          <span className="vehicle-meta__plate">{wo.plate ?? '—'}</span> · {SOURCE_LABEL[wo.sourceType]} · {createdLabel}
        </p>
        {wo.status === 'en_proceso' ? (
          <span className="status-pill status-pill--warn technician-wo__status">
            <WrenchIcon className="status-pill__icon" />
            En proceso
          </span>
        ) : (
          <span className="status-pill status-pill--neutral technician-wo__status">
            <ClipboardListIcon className="status-pill__icon" />
            Asignada
          </span>
        )}
      </header>

      {wo.defect && (
        <section className="checklist-section">
          <h2 className="section-title">Defecto reportado</h2>
          <div className={`checklist-item${wo.defect.severity === 'blocking' ? ' technician-wo__defect--blocking' : ''}`}>
            <span
              className={`severity-tag severity-tag--${wo.defect.severity === 'blocking' ? 'blocking' : 'non-blocking'} technician-wo__status`}
            >
              {wo.defect.severity === 'blocking' ? 'Bloqueante' : 'No bloqueante'}
            </span>
            {wo.defect.severity === 'blocking' && (
              <p className="technician-wo__hint">El vehículo no puede circular hasta que se resuelva.</p>
            )}
            <p className="technician-wo__text">{wo.defect.description}</p>
            <p className="technician-wo__hint">
              Reportado {wo.defect.reportedBy ? `por ${wo.defect.reportedBy} ` : ''}el{' '}
              {new Date(wo.defect.createdAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
            </p>
            {wo.defect.photoUrl && defectPhotoFailed ? (
              <p className="technician-wo__hint">No se pudo cargar la foto del defecto.</p>
            ) : wo.defect.photoUrl ? (
              <button
                type="button"
                className="technician-wo__photo-link"
                onClick={() => setViewingDefectPhoto(true)}
              >
                <img
                  src={wo.defect.photoUrl}
                  alt="Foto del defecto que sacó el chofer"
                  className="technician-wo__photo"
                  onError={() => setDefectPhotoFailed(true)}
                />
                <span className="technician-wo__hint">Tocá la foto para verla completa</span>
              </button>
            ) : (
              <p className="technician-wo__hint">El chofer no adjuntó foto.</p>
            )}
          </div>
          {viewingDefectPhoto && wo.defect.photoUrl && (
            <PhotoViewer
              src={wo.defect.photoUrl}
              alt="Foto del defecto que sacó el chofer"
              onClose={() => setViewingDefectPhoto(false)}
            />
          )}
        </section>
      )}

      {wo.description && (
        <section className="checklist-section">
          <h2 className="section-title">Qué hay que hacer</h2>
          <div className="checklist-item">
            <p className="technician-wo__text">{wo.description}</p>
          </div>
        </section>
      )}

      {wo.status === 'en_proceso' && (
        <section className="checklist-section">
          <h2 className="section-title">Cierre del trabajo</h2>
          <div className="checklist-item">
            <label className="checklist-item__label" htmlFor="closing-description">
              Qué se hizo (obligatorio)
            </label>
            <textarea
              id="closing-description"
              className="defect-textarea"
              rows={3}
              placeholder="Ej: se cambiaron las pastillas delanteras"
              value={closingDescription}
              onChange={(e) => setClosingDescription(e.target.value)}
            />

            {needsKm && (
              <>
                <label className="checklist-item__label" htmlFor="completed-km">
                  Kilometraje actual (obligatorio)
                </label>
                <input
                  id="completed-km"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  className="number-input"
                  value={completedKm}
                  onChange={(e) => setCompletedKm(e.target.value)}
                />
                {completedKm.trim() !== '' && !kmValid && (
                  <p className="field-error">Ingresá los kilómetros como un número entero, sin decimales.</p>
                )}
              </>
            )}

            <span className="checklist-item__label">Fotos del trabajo (al menos una)</span>
            {wo.photos.map((photo) => (
              <div key={photo.id} className="photo-preview">
                <img src={photo.photoUrl} alt="Foto del trabajo realizado" />
                <button
                  type="button"
                  className="photo-preview__remove"
                  onClick={() => handleRemovePhoto(photo.id)}
                  disabled={busy}
                >
                  {removingPhotoId === photo.id ? 'Quitando…' : 'Quitar foto'}
                </button>
              </div>
            ))}
            {uploadingPhoto ? (
              <span className="muted">Subiendo…</span>
            ) : (
              <button
                type="button"
                className="photo-attach-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
              >
                <CameraIcon className="photo-attach-btn__icon" />
                {wo.photos.length === 0 ? 'Sacar foto' : 'Sacar otra foto'}
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_PHOTO_TYPES}
              capture="environment"
              className="visually-hidden"
              onChange={handlePhotoChange}
            />
          </div>
        </section>
      )}

      {error && <p className="error-banner">{error}</p>}

      <div className="screen__actions">
        <button type="button" className="secondary-btn" onClick={onBack} disabled={busy}>
          Volver
        </button>
        {wo.status === 'asignada' && (
          <button type="button" className="primary-btn" onClick={handleStart} disabled={busy}>
            {pending ? 'Empezando…' : 'Empezar trabajo'}
          </button>
        )}
        {wo.status === 'en_proceso' && (
          <button type="button" className="primary-btn" onClick={handleFinalize} disabled={!canFinalize}>
            {pending ? 'Finalizando…' : 'Finalizar'}
          </button>
        )}
      </div>
    </div>
  );
}
