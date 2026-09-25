import { useRef, useState } from 'react';
import { ApiError } from '../../services/apiClient';
import { ACCEPTED_PHOTO_TYPES, uploadDefectPhoto } from '../../services/photosService';
import { addWorkOrderPhoto, deleteWorkOrderPhoto, updateWorkOrder } from '../../services/workOrdersService';
import type { WorkOrder } from '../../types/domain';
import { CameraIcon, CloseIcon, TrashIcon } from '../icons';
import '../../styles/dashboard.css';

interface FinalizeWorkOrderModalProps {
  workOrder: WorkOrder;
  onClose: () => void;
  onFinalized: (workOrder: WorkOrder) => void;
}

/**
 * Finalizar una OT (CAM-14): descripción de cierre + al menos una foto
 * obligatoria (sección 1.2 del doc). Las fotos se suben aparte, como
 * sub-recurso -- se pueden haber cargado antes durante "en_proceso". El
 * kilometraje solo se pide si la OT viene de una asignación de mantenimiento.
 */
export function FinalizeWorkOrderModal({ workOrder, onClose, onFinalized }: FinalizeWorkOrderModalProps) {
  const [wo, setWo] = useState(workOrder);
  const [closingDescription, setClosingDescription] = useState('');
  const [completedKm, setCompletedKm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const needsKm = wo.assignmentId != null;
  const canFinalize =
    closingDescription.trim().length > 0 && wo.photos.length > 0 && (!needsKm || completedKm.trim().length > 0);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingPhoto(true);
    setError(null);
    try {
      let current = wo;
      for (const file of Array.from(files)) {
        const { photoUrl } = await uploadDefectPhoto(file);
        const photo = await addWorkOrderPhoto(current.id, photoUrl);
        current = { ...current, photos: [...current.photos, photo] };
      }
      setWo(current);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo subir la foto. Probá de nuevo.');
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDeletePhoto(photoId: string) {
    setError(null);
    try {
      await deleteWorkOrderPhoto(wo.id, photoId);
      setWo({ ...wo, photos: wo.photos.filter((p) => p.id !== photoId) });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo borrar la foto. Intentá de nuevo.');
    }
  }

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      const updated = await updateWorkOrder(wo.id, {
        status: 'finalizada',
        closingDescription: closingDescription.trim(),
        completedKm: needsKm ? Number(completedKm) : undefined,
      });
      onFinalized(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo finalizar la orden. Intentá de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal modal--narrow">
        <header className="modal__header">
          <h2 className="modal__title">Finalizar orden</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Cerrar">
            <CloseIcon width={18} height={18} />
          </button>
        </header>

        <div className="modal__body">
          <p className="schedule-picker__subject">{wo.title}</p>

          <label className="schedule-picker__field">
            Descripción del trabajo realizado
            <textarea
              className="schedule-picker__input schedule-picker__textarea"
              rows={3}
              value={closingDescription}
              onChange={(e) => setClosingDescription(e.target.value)}
              placeholder="Qué se hizo para resolverlo"
            />
          </label>

          {needsKm && (
            <label className="schedule-picker__field">
              Kilometraje al finalizar
              <input
                type="number"
                min="0"
                className="schedule-picker__input"
                value={completedKm}
                onChange={(e) => setCompletedKm(e.target.value)}
              />
            </label>
          )}

          <div className="schedule-picker__field">
            Fotos del trabajo (al menos una)
            {wo.photos.length > 0 && (
              <div className="wo-photo-gallery">
                {wo.photos.map((photo) => (
                  <div key={photo.id} className="wo-photo-gallery__item">
                    <a href={photo.photoUrl} target="_blank" rel="noreferrer">
                      <img src={photo.photoUrl} alt="Foto del trabajo realizado" />
                    </a>
                    <button
                      type="button"
                      className="wo-photo-gallery__remove"
                      onClick={() => handleDeletePhoto(photo.id)}
                      aria-label="Borrar foto"
                    >
                      <TrashIcon width={14} height={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              className="secondary-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
            >
              <CameraIcon width={14} height={14} />
              {uploadingPhoto ? 'Subiendo…' : 'Adjuntar foto'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_PHOTO_TYPES}
              multiple
              className="visually-hidden"
              onChange={handlePhotoChange}
            />
          </div>

          {error && <p className="error-banner">{error}</p>}
        </div>

        <footer className="modal__footer">
          <button type="button" className="secondary-btn" onClick={onClose} disabled={submitting}>
            Cancelar
          </button>
          <button type="button" className="primary-btn" onClick={handleConfirm} disabled={submitting || !canFinalize}>
            {submitting ? 'Finalizando…' : 'Finalizar orden'}
          </button>
        </footer>
      </div>
    </div>
  );
}
