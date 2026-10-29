import { useId, useRef, useState, type DragEvent } from 'react';
import { ApiError, describeApiError } from '../../services/apiClient';
import { ACCEPTED_DOCUMENT_TYPES, uploadDocumentFile } from '../../services/photosService';
import {
  correctVehicleDocument,
  createVehicleDocument,
  renewVehicleDocument,
} from '../../services/vehicleDocumentsService';
import type { VehicleDocument, VehicleDocumentType } from '../../types/domain';
import { DOCUMENT_SUGGESTIONS, DOCUMENT_TYPE_LABELS, inferDocumentType } from '../../utils/documentLabels';
import { formatDate } from '../../utils/maintenanceFormat';
import { DatePicker } from '../datetime/DatePicker';
import { CloseIcon, PaperclipIcon } from '../icons';

export type DocumentFormMode =
  | { kind: 'create'; name?: string }
  | { kind: 'renew'; document: VehicleDocument }
  | { kind: 'correct'; document: VehicleDocument };

interface DocumentFormModalProps {
  vehicleId: string;
  mode: DocumentFormMode;
  /** Los vigentes del vehículo: para sugerir solo lo que falta y avisar si ya está cargado. */
  current: VehicleDocument[];
  onClose: () => void;
  onSaved: (saved: VehicleDocument) => void;
}

const TEXT_MAX = 60;
const REQUIRED: VehicleDocumentType[] = ['vtv', 'seguro'];

function titleOf(mode: DocumentFormMode): string {
  if (mode.kind === 'create') return 'Agregar documento';
  return mode.kind === 'renew' ? `Renovar ${mode.document.displayName}` : `Editar ${mode.document.displayName}`;
}

/**
 * CAM-127: agregar un documento (nombre libre: el backend reconoce si es la VTV, el seguro…), renovar el
 * vigente (el anterior queda en el historial) o corregir un dato mal cargado. El comprobante se sube apenas
 * se elige o se suelta sobre el recuadro.
 */
export function DocumentFormModal({ vehicleId, mode, current, onClose, onSaved }: DocumentFormModalProps) {
  const existing = mode.kind === 'create' ? null : mode.document;
  const correcting = mode.kind === 'correct';
  const renewing = mode.kind === 'renew';

  const [name, setName] = useState(mode.kind === 'create' ? (mode.name ?? '') : (existing?.displayName ?? ''));
  // Al renovar, número, fechas y comprobante arrancan vacíos: son los del documento nuevo.
  const [number, setNumber] = useState(correcting ? (existing?.number ?? '') : '');
  const [expires, setExpires] = useState(correcting ? existing?.expiresAt != null : true);
  const [issuedAt, setIssuedAt] = useState(correcting ? (existing?.issuedAt ?? '') : '');
  const [expiresAt, setExpiresAt] = useState(correcting ? (existing?.expiresAt ?? '') : '');
  const [fileUrl, setFileUrl] = useState<string | null>(correcting ? (existing?.fileUrl ?? null) : null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const ids = { title: useId(), name: useId(), issued: useId(), expires: useId() };

  const trimmed = name.trim();
  const recognized = inferDocumentType(trimmed);
  // Otro documento vigente con el mismo tipo reconocido (una sola VTV) o el mismo nombre.
  const duplicate = renewing
    ? null
    : (current.find(
        (d) =>
          d.id !== existing?.id &&
          (recognized !== 'otro' ? d.type === recognized : d.displayName.trim().toLowerCase() === trimmed.toLowerCase()),
      ) ?? null);
  const suggestions = DOCUMENT_SUGGESTIONS.filter((s) => !current.some((d) => d.type === s.type));
  const datesProblem = expires && issuedAt && expiresAt && expiresAt < issuedAt ? 'El vencimiento no puede ser anterior a la emisión.' : null;
  const missingExpiry = expires && !expiresAt;
  const canSubmit =
    !uploading && !submitting && !datesProblem && !missingExpiry && !duplicate && (renewing || trimmed.length > 0);

  async function upload(file: File) {
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

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && !uploading) void upload(file);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    const dates = expires ? { issuedAt, expiresAt } : { issuedAt: '', expiresAt: '' };
    try {
      let saved: VehicleDocument;
      if (mode.kind === 'create') {
        saved = await createVehicleDocument(vehicleId, {
          name: trimmed,
          number: number.trim() || undefined,
          issuedAt: dates.issuedAt || undefined,
          expiresAt: dates.expiresAt || undefined,
          fileUrl: fileUrl ?? undefined,
        });
      } else if (mode.kind === 'renew') {
        saved = await renewVehicleDocument(vehicleId, mode.document.id, {
          number: number.trim() || undefined,
          issuedAt: dates.issuedAt || undefined,
          expiresAt: dates.expiresAt || undefined,
          fileUrl: fileUrl ?? undefined,
        });
      } else {
        // "" borra el dato en el servidor.
        saved = await correctVehicleDocument(vehicleId, mode.document.id, {
          name: trimmed,
          number: number.trim(),
          ...dates,
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
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby={ids.title}>
      <div className="modal doc-form">
        <header className="modal__header">
          <div>
            <h2 className="modal__title" id={ids.title}>
              {titleOf(mode)}
            </h2>
            {renewing && existing && (
              <p className="doc-form__context">
                {existing.expiresAt
                  ? `El actual ${existing.status === 'vencido' ? 'venció' : 'vence'} el ${formatDate(existing.expiresAt)}. `
                  : ''}
                Pasa al historial cuando guardes el nuevo.
              </p>
            )}
          </div>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Cerrar">
            <CloseIcon width={18} height={18} />
          </button>
        </header>

        <div className="modal__body doc-form__body">
          {!renewing && (
            <div className="schedule-picker__field">
              <label htmlFor={ids.name}>Documento</label>
              <input
                id={ids.name}
                type="text"
                className="schedule-picker__input"
                maxLength={TEXT_MAX}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: VTV, Póliza La Segunda, Permiso municipal"
                autoFocus
              />
              {mode.kind === 'create' && !trimmed && suggestions.length > 0 && (
                <div className="doc-form__suggestions" aria-label="Sugerencias">
                  {suggestions.map((s) => (
                    <button key={s.type} type="button" className="doc-form__suggestion" onClick={() => setName(s.name)}>
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
              {trimmed && duplicate && (
                <p className="field-error">
                  Este vehículo ya tiene cargado {duplicate.displayName}. Renovalo o editalo desde su tarjeta.
                </p>
              )}
              {trimmed && !duplicate && recognized !== 'otro' && (
                <p className="doc-form__recognized">
                  Cuenta como {DOCUMENT_TYPE_LABELS[recognized]}
                  {REQUIRED.includes(recognized) ? ', uno de los obligatorios' : ''}.
                </p>
              )}
            </div>
          )}

          <label className="schedule-picker__field">
            <span>
              Número <span className="doc-form__optional">(opcional)</span>
            </span>
            <input
              type="text"
              className="schedule-picker__input doc-form__mono"
              maxLength={TEXT_MAX}
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="N° de póliza, oblea, cédula…"
            />
          </label>

          <div className="doc-form__expiry">
            <div className="doc-form__segmented" role="radiogroup" aria-label="Vencimiento">
              <button
                type="button"
                role="radio"
                aria-checked={expires}
                className={`doc-form__segment${expires ? ' doc-form__segment--on' : ''}`}
                onClick={() => setExpires(true)}
              >
                Tiene vencimiento
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={!expires}
                className={`doc-form__segment${!expires ? ' doc-form__segment--on' : ''}`}
                onClick={() => setExpires(false)}
              >
                No vence
              </button>
            </div>
            {expires ? (
              <>
                <div className="doc-form__dates">
                  <div className="schedule-picker__field">
                    <label htmlFor={ids.expires}>Vence el</label>
                    <DatePicker
                      id={ids.expires}
                      value={expiresAt}
                      onChange={setExpiresAt}
                      min={issuedAt || undefined}
                      label="Fecha de vencimiento"
                      className="schedule-picker__input"
                    />
                  </div>
                  <div className="schedule-picker__field">
                    <label htmlFor={ids.issued}>
                      Emitido el <span className="doc-form__optional">(opcional)</span>
                    </label>
                    <DatePicker
                      id={ids.issued}
                      value={issuedAt}
                      onChange={setIssuedAt}
                      label="Fecha de emisión"
                      className="schedule-picker__input"
                    />
                  </div>
                </div>
                <p className="doc-form__hint">
                  Avisa antes de vencer. Desde el día siguiente al vencimiento el vehículo no puede salir.
                </p>
              </>
            ) : (
              <p className="doc-form__hint">No avisa ni bloquea nada. Por ejemplo, el título o la cédula verde.</p>
            )}
            {datesProblem && <p className="field-error">{datesProblem}</p>}
          </div>

          <div className="schedule-picker__field">
            <span>
              Comprobante <span className="doc-form__optional">(opcional)</span>
            </span>
            {fileUrl ? (
              <div className="doc-form__file">
                <PaperclipIcon width={16} height={16} aria-hidden="true" />
                <a href={fileUrl} target="_blank" rel="noreferrer" className="doc-form__file-name">
                  {fileName ?? 'Comprobante cargado'}
                </a>
                <button type="button" className="doc-link-btn" onClick={() => setFileUrl(null)} disabled={submitting}>
                  Quitar
                </button>
              </div>
            ) : (
              <div
                className={`doc-form__drop${dragging ? ' doc-form__drop--over' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
              >
                {uploading ? (
                  <span className="muted">Subiendo…</span>
                ) : (
                  <>
                    <PaperclipIcon width={18} height={18} aria-hidden="true" />
                    <span>
                      Soltá una foto o un PDF acá, o{' '}
                      <button type="button" className="doc-link-btn" onClick={() => fileInput.current?.click()}>
                        elegí un archivo
                      </button>
                    </span>
                  </>
                )}
              </div>
            )}
            <input
              ref={fileInput}
              type="file"
              accept={ACCEPTED_DOCUMENT_TYPES}
              className="visually-hidden"
              aria-label="Comprobante: foto o PDF"
              tabIndex={-1}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file);
              }}
            />
          </div>

          {error && <p className="error-banner">{error}</p>}
        </div>

        <footer className="modal__footer">
          <button type="button" className="secondary-btn" onClick={onClose} disabled={submitting}>
            Cancelar
          </button>
          <button type="button" className="primary-btn" onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? 'Guardando…' : renewing ? 'Guardar renovación' : 'Guardar'}
          </button>
        </footer>
      </div>
    </div>
  );
}
