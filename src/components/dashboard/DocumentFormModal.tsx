import { useId, useRef, useState } from 'react';
import { ApiError, describeApiError } from '../../services/apiClient';
import { ACCEPTED_DOCUMENT_TYPES, uploadDocumentFile } from '../../services/photosService';
import {
  correctVehicleDocument,
  createVehicleDocument,
  renewVehicleDocument,
} from '../../services/vehicleDocumentsService';
import type { VehicleDocument, VehicleDocumentType } from '../../types/domain';
import { DOCUMENT_TYPE_LABELS, DOCUMENT_TYPES } from '../../utils/documentLabels';
import { DatePicker } from '../datetime/DatePicker';
import { CloseIcon, PaperclipIcon } from '../icons';

export type DocumentFormMode =
  | { kind: 'create'; type?: VehicleDocumentType }
  | { kind: 'renew'; document: VehicleDocument }
  | { kind: 'correct'; document: VehicleDocument };

interface DocumentFormModalProps {
  vehicleId: string;
  mode: DocumentFormMode;
  /** Tipos que ya tienen un vigente: no se ofrecen al cargar (se renuevan). "otro" se puede repetir. */
  loadedTypes: VehicleDocumentType[];
  onClose: () => void;
  onSaved: (saved: VehicleDocument) => void;
}

const TEXT_MAX = 60;

function titleOf(mode: DocumentFormMode): string {
  if (mode.kind === 'create') return 'Cargar documento';
  return mode.kind === 'renew' ? `Renovar ${mode.document.displayName}` : `Corregir ${mode.document.displayName}`;
}

/**
 * CAM-127: cargar un documento, renovar el vigente (el anterior queda en el historial) o corregir un dato
 * mal cargado (no cuenta como renovación). El comprobante se sube apenas se elige, igual que las fotos.
 */
export function DocumentFormModal({ vehicleId, mode, loadedTypes, onClose, onSaved }: DocumentFormModalProps) {
  const current = mode.kind === 'create' ? null : mode.document;
  const correcting = mode.kind === 'correct';
  const availableTypes = DOCUMENT_TYPES.filter((t) => t === 'otro' || !loadedTypes.includes(t));
  const initialType: VehicleDocumentType =
    mode.kind === 'create' ? (mode.type ?? availableTypes[0] ?? 'otro') : (current?.type ?? 'otro');

  const [type, setType] = useState<VehicleDocumentType>(initialType);
  const [name, setName] = useState(current?.name ?? '');
  // Al renovar, número y fechas arrancan vacíos: son los del documento nuevo.
  const [number, setNumber] = useState(correcting ? (current?.number ?? '') : '');
  const [issuedAt, setIssuedAt] = useState(correcting ? (current?.issuedAt ?? '') : '');
  const [expiresAt, setExpiresAt] = useState(correcting ? (current?.expiresAt ?? '') : '');
  const [fileUrl, setFileUrl] = useState<string | null>(correcting ? (current?.fileUrl ?? null) : null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const ids = { type: useId(), issued: useId(), expires: useId() };

  const needsName = type === 'otro';
  const datesProblem = issuedAt && expiresAt && expiresAt < issuedAt ? 'El vencimiento no puede ser anterior a la emisión.' : null;
  const canSubmit = !uploading && !submitting && !datesProblem && (!needsName || name.trim().length > 0);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const { photoUrl } = await uploadDocumentFile(file);
      setFileUrl(photoUrl);
      setFileName(file.name);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo subir el archivo. Probá de nuevo.');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      let saved: VehicleDocument;
      if (mode.kind === 'create') {
        saved = await createVehicleDocument(vehicleId, {
          type,
          name: needsName ? name.trim() : undefined,
          number: number.trim() || undefined,
          issuedAt: issuedAt || undefined,
          expiresAt: expiresAt || undefined,
          fileUrl: fileUrl ?? undefined,
        });
      } else if (mode.kind === 'renew') {
        saved = await renewVehicleDocument(vehicleId, mode.document.id, {
          number: number.trim() || undefined,
          issuedAt: issuedAt || undefined,
          expiresAt: expiresAt || undefined,
          fileUrl: fileUrl ?? undefined,
        });
      } else {
        // "" borra el dato en el servidor.
        saved = await correctVehicleDocument(vehicleId, mode.document.id, {
          ...(needsName ? { name: name.trim() } : {}),
          number: number.trim(),
          issuedAt,
          expiresAt,
          fileUrl: fileUrl ?? '',
        });
      }
      onSaved(saved);
    } catch (err) {
      setError(describeApiError(err, 'No se pudo guardar el documento. Intentá de nuevo.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby={`${ids.type}-title`}>
      <div className="modal modal--narrow">
        <header className="modal__header">
          <div>
            <h2 className="modal__title" id={`${ids.type}-title`}>
              {titleOf(mode)}
            </h2>
            {mode.kind === 'renew' && (
              <p className="modal__subtitle doc-form__subtitle">El documento actual pasa al historial.</p>
            )}
          </div>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Cerrar">
            <CloseIcon width={18} height={18} />
          </button>
        </header>

        <div className="modal__body">
          {mode.kind === 'create' && (
            <label className="schedule-picker__field" htmlFor={ids.type}>
              Tipo
              <select
                id={ids.type}
                className="schedule-picker__input"
                value={type}
                onChange={(e) => setType(e.target.value as VehicleDocumentType)}
              >
                {availableTypes.map((t) => (
                  <option key={t} value={t}>
                    {DOCUMENT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
          )}

          {needsName && mode.kind !== 'renew' && (
            <label className="schedule-picker__field">
              Qué documento es
              <input
                type="text"
                className="schedule-picker__input"
                maxLength={TEXT_MAX}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Permiso municipal de carga"
              />
            </label>
          )}

          <label className="schedule-picker__field">
            Número (opcional)
            <input
              type="text"
              className="schedule-picker__input vehicle-detail__mono"
              maxLength={TEXT_MAX}
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="Ej: N° de póliza u oblea"
            />
          </label>

          <div className="doc-form__dates">
            <div className="schedule-picker__field">
              <label htmlFor={ids.issued}>Emisión (opcional)</label>
              <DatePicker
                id={ids.issued}
                value={issuedAt}
                onChange={setIssuedAt}
                label="Fecha de emisión"
                className="schedule-picker__input"
              />
            </div>
            <div className="schedule-picker__field">
              <label htmlFor={ids.expires}>Vencimiento</label>
              <DatePicker
                id={ids.expires}
                value={expiresAt}
                onChange={setExpiresAt}
                min={issuedAt || undefined}
                label="Fecha de vencimiento"
                className="schedule-picker__input"
              />
            </div>
          </div>
          {(issuedAt || expiresAt) && (
            <div className="doc-form__clear">
              {issuedAt && (
                <button type="button" className="doc-link-btn" onClick={() => setIssuedAt('')}>
                  Quitar emisión
                </button>
              )}
              {expiresAt && (
                <button type="button" className="doc-link-btn" onClick={() => setExpiresAt('')}>
                  Quitar vencimiento
                </button>
              )}
            </div>
          )}
          <p className="muted doc-form__hint">
            {expiresAt
              ? 'Desde el día siguiente al vencimiento el vehículo queda no disponible hasta que se renueve.'
              : 'Sin vencimiento no avisa ni bloquea nada.'}
          </p>
          {datesProblem && <p className="field-error">{datesProblem}</p>}

          <div className="schedule-picker__field">
            <span>Comprobante (opcional)</span>
            <div className="doc-form__file" aria-live="polite">
              {uploading ? (
                <span className="muted">Subiendo…</span>
              ) : fileUrl ? (
                <>
                  <a href={fileUrl} target="_blank" rel="noreferrer" className="doc-form__file-link">
                    <PaperclipIcon width={14} height={14} aria-hidden="true" />
                    {fileName ?? 'Ver comprobante'}
                  </a>
                  <button type="button" className="doc-link-btn" onClick={() => setFileUrl(null)} disabled={submitting}>
                    Quitar
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="secondary-btn doc-form__file-btn"
                  onClick={() => fileInput.current?.click()}
                  disabled={submitting}
                >
                  <PaperclipIcon width={14} height={14} aria-hidden="true" />
                  Adjuntar foto o PDF
                </button>
              )}
            </div>
            <input
              ref={fileInput}
              type="file"
              accept={ACCEPTED_DOCUMENT_TYPES}
              className="visually-hidden"
              aria-label="Comprobante: foto o PDF"
              onChange={handleFile}
            />
          </div>

          {error && <p className="error-banner">{error}</p>}
        </div>

        <footer className="modal__footer">
          <button type="button" className="secondary-btn" onClick={onClose} disabled={submitting}>
            Cancelar
          </button>
          <button type="button" className="primary-btn" onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? 'Guardando…' : mode.kind === 'renew' ? 'Renovar' : 'Guardar'}
          </button>
        </footer>
      </div>
    </div>
  );
}
