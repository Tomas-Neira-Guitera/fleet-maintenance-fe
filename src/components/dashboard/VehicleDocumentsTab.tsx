import { useEffect, useState } from 'react';
import { describeApiError } from '../../services/apiClient';
import { deleteVehicleDocument, getVehicleDocuments } from '../../services/vehicleDocumentsService';
import type { VehicleDocument, VehicleDocuments, VehicleDocumentType } from '../../types/domain';
import { DOCUMENT_STATUS_LABELS, DOCUMENT_TYPE_LABELS, describeExpiry } from '../../utils/documentLabels';
import { formatDate } from '../../utils/maintenanceFormat';
import { AlertTriangleIcon, ChevronRightIcon, FileTextIcon, PaperclipIcon, PencilIcon, PlusIcon, RefreshIcon, TrashIcon } from '../icons';
import { DocumentFormModal, type DocumentFormMode } from './DocumentFormModal';

interface VehicleDocumentsTabProps {
  vehicleId: string;
  /** El vehículo está dado de baja: se ve la documentación pero no se carga nada. */
  readOnly: boolean;
  /** Después de un cambio: la disponibilidad del vehículo pudo cambiar (CAM-127). */
  onChanged: () => void;
}

function Dates({ document: d }: { document: VehicleDocument }) {
  const parts = [d.issuedAt ? `Emitido el ${formatDate(d.issuedAt)}` : null, d.expiresAt ? `vence el ${formatDate(d.expiresAt)}` : null]
    .filter(Boolean)
    .join(' · ');
  return parts ? <span className="vehicle-detail__item-meta">{parts.charAt(0).toUpperCase() + parts.slice(1)}</span> : null;
}

function StatusChip({ document: d }: { document: VehicleDocument }) {
  const expiry = describeExpiry(d.daysToExpiry);
  return (
    <span className="doc-status">
      <span className={`doc-status__chip doc-status__chip--${d.status}`}>{DOCUMENT_STATUS_LABELS[d.status]}</span>
      {expiry && d.status !== 'al_dia' && <span className="doc-status__when">{expiry}</span>}
    </span>
  );
}

/**
 * Pestaña "Documentación" del vehículo (CAM-127): los documentos vigentes por vencimiento, los obligatorios
 * que faltan (se marcan, no bloquean) y el historial de renovaciones.
 */
export function VehicleDocumentsTab({ vehicleId, readOnly, onChanged }: VehicleDocumentsTabProps) {
  const [data, setData] = useState<VehicleDocuments | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [form, setForm] = useState<DocumentFormMode | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getVehicleDocuments(vehicleId)
      .then((docs) => {
        if (cancelled) return;
        setData(docs);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(describeApiError(err, 'No se pudo cargar la documentación. Intentá de nuevo.'));
      });
    return () => {
      cancelled = true;
    };
  }, [vehicleId, reloadKey]);

  function reload() {
    setReloadKey((k) => k + 1);
    // La disponibilidad del vehículo pudo cambiar (un documento vencido lo bloquea).
    onChanged();
  }

  function handleSaved() {
    setForm(null);
    setActionError(null);
    reload();
  }

  async function handleDelete(d: VehicleDocument) {
    if (!window.confirm(`¿Dar de baja "${d.displayName}"? Deja de contar para el vehículo.`)) return;
    setBusyId(d.id);
    setActionError(null);
    try {
      await deleteVehicleDocument(vehicleId, d.id);
      reload();
    } catch (err) {
      setActionError(describeApiError(err, 'No se pudo dar de baja el documento.'));
    } finally {
      setBusyId(null);
    }
  }

  if (error) {
    return (
      <p className="error-banner error-banner--icon">
        <AlertTriangleIcon width={16} height={16} />
        {error}
      </p>
    );
  }
  if (!data) return <p className="muted">Cargando documentación…</p>;

  const loadedTypes = data.items.map((d) => d.type);
  const attention = data.items.filter((d) => d.status === 'vencido' || d.status === 'por_vencer').length;

  return (
    <section className="vehicle-detail__card vehicle-docs">
      <header className="vehicle-docs__header">
        <h2 className="vehicle-detail__card-title">
          Documentación ({data.items.length})
          {attention > 0 && (
            <span className="vehicle-detail__card-title-flag">
              {' '}
              · {attention} {attention === 1 ? 'requiere' : 'requieren'} atención
            </span>
          )}
        </h2>
        {!readOnly && (
          <button type="button" className="vehicle-detail__action-btn" onClick={() => setForm({ kind: 'create' })}>
            <PlusIcon width={14} height={14} />
            Cargar documento
          </button>
        )}
      </header>
      <p className="vehicle-detail__item-meta vehicle-docs__lead">
        “Por vencer” desde {data.leadDays} días antes. Un documento vencido deja el vehículo no disponible desde el día
        siguiente al vencimiento.
      </p>

      {data.missingRequired.length > 0 && (
        <div className="vehicle-docs__missing" role="status">
          <AlertTriangleIcon width={16} height={16} aria-hidden="true" />
          <span>
            Falta cargar: {data.missingRequired.map((t) => DOCUMENT_TYPE_LABELS[t]).join(' y ')}. Es obligatorio, pero
            no bloquea el vehículo.
          </span>
          {!readOnly && (
            <span className="vehicle-docs__missing-actions">
              {data.missingRequired.map((t: VehicleDocumentType) => (
                <button key={t} type="button" className="doc-link-btn" onClick={() => setForm({ kind: 'create', type: t })}>
                  Cargar {DOCUMENT_TYPE_LABELS[t]}
                </button>
              ))}
            </span>
          )}
        </div>
      )}

      {actionError && <p className="error-banner">{actionError}</p>}

      {data.items.length === 0 ? (
        <p className="muted">Sin documentos cargados.</p>
      ) : (
        <ul className="vehicle-detail__list">
          {data.items.map((d) => (
            <li key={d.id} className={`vehicle-detail__item vehicle-docs__item vehicle-docs__item--${d.status}`}>
              <FileTextIcon width={18} height={18} className="vehicle-docs__icon" aria-hidden="true" />
              <div className="vehicle-detail__item-main vehicle-docs__main">
                <span className="vehicle-detail__item-label">
                  {d.displayName}
                  {d.number && <span className="vehicle-docs__number"> · N° {d.number}</span>}
                </span>
                <Dates document={d} />
                <span className="vehicle-docs__actions">
                  {d.fileUrl ? (
                    <a href={d.fileUrl} target="_blank" rel="noreferrer" className="doc-link-btn">
                      <PaperclipIcon width={13} height={13} aria-hidden="true" />
                      Ver comprobante
                    </a>
                  ) : (
                    <span className="vehicle-docs__no-file">Sin comprobante</span>
                  )}
                  {!readOnly && (
                    <>
                      <button
                        type="button"
                        className="doc-link-btn"
                        onClick={() => setForm({ kind: 'renew', document: d })}
                        disabled={busyId === d.id}
                      >
                        <RefreshIcon width={13} height={13} aria-hidden="true" />
                        Renovar
                      </button>
                      <button
                        type="button"
                        className="doc-link-btn"
                        onClick={() => setForm({ kind: 'correct', document: d })}
                        disabled={busyId === d.id}
                      >
                        <PencilIcon width={13} height={13} aria-hidden="true" />
                        Corregir
                      </button>
                      <button
                        type="button"
                        className="doc-link-btn doc-link-btn--danger"
                        onClick={() => void handleDelete(d)}
                        disabled={busyId === d.id}
                        aria-label={`Dar de baja ${d.displayName}`}
                      >
                        <TrashIcon width={13} height={13} aria-hidden="true" />
                        Dar de baja
                      </button>
                    </>
                  )}
                </span>
              </div>
              <StatusChip document={d} />
            </li>
          ))}
        </ul>
      )}

      {data.history.length > 0 && (
        <>
          <button
            type="button"
            className="vehicle-detail__toggle"
            aria-expanded={historyOpen}
            onClick={() => setHistoryOpen((o) => !o)}
          >
            <ChevronRightIcon
              width={14}
              height={14}
              className={`vehicle-detail__toggle-icon${historyOpen ? ' vehicle-detail__toggle-icon--expanded' : ''}`}
            />
            {historyOpen ? 'Ocultar renovaciones anteriores' : `Renovaciones anteriores (${data.history.length})`}
          </button>
          {historyOpen && (
            <ul className="vehicle-detail__list vehicle-docs__history">
              {data.history.map((d) => (
                <li key={d.id} className="vehicle-detail__item vehicle-detail__item--resolved">
                  <div className="vehicle-detail__item-main">
                    <span className="vehicle-detail__item-label">
                      {d.displayName}
                      {d.number && <span className="vehicle-docs__number"> · N° {d.number}</span>}
                    </span>
                    <Dates document={d} />
                  </div>
                  {d.fileUrl && (
                    <a href={d.fileUrl} target="_blank" rel="noreferrer" className="doc-link-btn">
                      Ver comprobante
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {form && (
        <DocumentFormModal
          vehicleId={vehicleId}
          mode={form}
          loadedTypes={loadedTypes}
          onClose={() => setForm(null)}
          onSaved={handleSaved}
        />
      )}
    </section>
  );
}
