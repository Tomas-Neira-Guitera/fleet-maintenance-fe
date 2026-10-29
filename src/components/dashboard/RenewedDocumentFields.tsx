import { useId, useRef, useState } from 'react';
import { ApiError } from '../../services/apiClient';
import { ACCEPTED_DOCUMENT_TYPES, uploadDocumentFile } from '../../services/photosService';
import type { DocumentInput, VehicleDocumentType } from '../../types/domain';
import { DOCUMENT_TYPE_LABELS } from '../../utils/documentLabels';
import { DatePicker } from '../datetime/DatePicker';
import { FileTextIcon, PaperclipIcon } from '../icons';

interface RenewedDocumentFieldsProps {
  documentType: VehicleDocumentType;
  /** No antes de este día (la fecha del mantenimiento). */
  minDate?: string;
  disabled?: boolean;
  /** null mientras no tenga vencimiento: sin vencimiento no se manda ningún documento. */
  onChange: (document: DocumentInput | null) => void;
  onUploadingChange?: (uploading: boolean) => void;
}

/**
 * CAM-127: el documento renovado que se carga junto con el mantenimiento de un plan que lo renueva (la RTO
 * renueva la VTV). Opcional: también se puede cargar después desde Documentación.
 */
export function RenewedDocumentFields({
  documentType,
  minDate,
  disabled,
  onChange,
  onUploadingChange,
}: RenewedDocumentFieldsProps) {
  const label = DOCUMENT_TYPE_LABELS[documentType];
  const [expiresAt, setExpiresAt] = useState('');
  const [number, setNumber] = useState('');
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const expiresId = useId();

  /** Avisa al formulario con cada cambio, ya armado como lo pide la API. */
  function emit(next: { expiresAt?: string; number?: string; fileUrl?: string | null }) {
    const e = next.expiresAt ?? expiresAt;
    const n = next.number ?? number;
    const f = next.fileUrl !== undefined ? next.fileUrl : fileUrl;
    onChange(e ? { expiresAt: e, number: n.trim() || undefined, fileUrl: f ?? undefined } : null);
  }

  function changeExpires(value: string) {
    setExpiresAt(value);
    emit({ expiresAt: value });
  }

  function changeNumber(value: string) {
    setNumber(value);
    emit({ number: value });
  }

  function changeFile(value: string | null) {
    setFileUrl(value);
    emit({ fileUrl: value });
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    onUploadingChange?.(true);
    setError(null);
    try {
      const { photoUrl } = await uploadDocumentFile(file);
      changeFile(photoUrl);
      setFileName(file.name);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo subir el archivo. Probá de nuevo.');
    } finally {
      setUploading(false);
      onUploadingChange?.(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  return (
    <fieldset className="renewed-doc" disabled={disabled}>
      <legend className="renewed-doc__legend">
        <FileTextIcon width={16} height={16} aria-hidden="true" />
        {label} nuevo (opcional)
      </legend>
      <p className="renewed-doc__hint muted">
        Con el vencimiento cargado, el {label} queda en la Documentación del vehículo y el plan vence cuando vence el
        documento.
      </p>
      <div className="schedule-picker__field">
        <label htmlFor={expiresId}>Vencimiento del {label}</label>
        <DatePicker
          id={expiresId}
          value={expiresAt}
          onChange={changeExpires}
          min={minDate}
          label={`Vencimiento del ${label}`}
          className="schedule-picker__input"
        />
      </div>
      {expiresAt && (
        <>
          <label className="schedule-picker__field">
            Número (opcional)
            <input
              type="text"
              className="schedule-picker__input doc-form__mono"
              maxLength={60}
              value={number}
              onChange={(e) => changeNumber(e.target.value)}
            />
          </label>
          <div className="doc-form__file" aria-live="polite">
            {uploading ? (
              <span className="muted">Subiendo…</span>
            ) : fileUrl ? (
              <>
                <a href={fileUrl} target="_blank" rel="noreferrer" className="doc-form__file-link">
                  <PaperclipIcon width={14} height={14} aria-hidden="true" />
                  {fileName ?? 'Ver comprobante'}
                </a>
                <button type="button" className="doc-link-btn" onClick={() => changeFile(null)}>
                  Quitar
                </button>
              </>
            ) : (
              <button type="button" className="secondary-btn doc-form__file-btn" onClick={() => fileInput.current?.click()}>
                <PaperclipIcon width={14} height={14} aria-hidden="true" />
                Adjuntar comprobante
              </button>
            )}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPTED_DOCUMENT_TYPES}
            className="visually-hidden"
            aria-label={`Comprobante del ${label}: foto o PDF`}
            onChange={handleFile}
          />
          <button type="button" className="doc-link-btn renewed-doc__clear" onClick={() => changeExpires('')}>
            No cargar el documento ahora
          </button>
        </>
      )}
      {error && <p className="field-error">{error}</p>}
    </fieldset>
  );
}
