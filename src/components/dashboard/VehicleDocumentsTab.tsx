import { useEffect, useState } from 'react';
import { describeApiError } from '../../services/apiClient';
import { deleteVehicleDocument, getVehicleDocuments } from '../../services/vehicleDocumentsService';
import type { VehicleDocument, VehicleDocuments, VehicleDocumentStatus } from '../../types/domain';
import { DOCUMENT_STATUS_LABELS, DOCUMENT_TYPE_LABELS, describeExpiry } from '../../utils/documentLabels';
import { formatDate } from '../../utils/maintenanceFormat';
import { AlertTriangleIcon, ChevronRightIcon, PaperclipIcon, PencilIcon, PlusIcon, RefreshIcon, TrashIcon } from '../icons';
import { DocumentFormModal, type DocumentFormMode } from './DocumentFormModal';

interface VehicleDocumentsTabProps {
  vehicleId: string;
  /** El vehículo está dado de baja: se ve la documentación pero no se carga nada. */
  readOnly: boolean;
  /** Después de un cambio: la disponibilidad del vehículo pudo cambiar (CAM-127). */
  onChanged: () => void;
}

// Lo que requiere atención primero; lo que no vence, al final.
const STATUS_ORDER: Record<VehicleDocumentStatus, number> = { vencido: 0, por_vencer: 1, al_dia: 2, sin_vencimiento: 3 };

interface DocumentCardProps {
  document: VehicleDocument;
  previous: VehicleDocument[];
  readOnly: boolean;
  busy: boolean;
  onRenew: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function DocumentCard({ document: d, previous, readOnly, busy, onRenew, onEdit, onDelete }: DocumentCardProps) {
  const [showPrevious, setShowPrevious] = useState(false);
  const expiry = describeExpiry(d.daysToExpiry);

  return (
    <li className={`doc-card doc-card--${d.status}`}>
      <div className="doc-card__top">
        <div className="doc-card__identity">
          <h3 className="doc-card__name">{d.displayName}</h3>
          {d.number && <span className="doc-card__number">N° {d.number}</span>}
        </div>
        <span className={`doc-status__chip doc-status__chip--${d.status}`}>{DOCUMENT_STATUS_LABELS[d.status]}</span>
      </div>

      <div className="doc-card__expiry">
        {d.expiresAt ? (
          <>
            <span className="doc-card__expiry-label">{d.status === 'vencido' ? 'Venció el' : 'Vence el'}</span>
            <span className="doc-card__date">{formatDate(d.expiresAt)}</span>
            {expiry && <span className="doc-card__relative">{expiry}</span>}
          </>
        ) : (
          <span className="doc-card__no-expiry">No vence</span>
        )}
      </div>

      <div className="doc-card__footer">
        {d.fileUrl ? (
          <a href={d.fileUrl} target="_blank" rel="noreferrer" className="doc-card__file">
            <PaperclipIcon width={14} height={14} aria-hidden="true" />
            Comprobante
          </a>
        ) : (
          <span className="doc-card__file doc-card__file--none">Sin comprobante</span>
        )}
        {!readOnly && (
          <div className="doc-card__actions">
            {d.expiresAt && (
              <button type="button" className="doc-card__renew" onClick={onRenew} disabled={busy}>
                <RefreshIcon width={14} height={14} aria-hidden="true" />
                Renovar
              </button>
            )}
            <button
              type="button"
              className="doc-card__icon-btn"
              onClick={onEdit}
              disabled={busy}
              aria-label={`Editar ${d.displayName}`}
              title="Editar"
            >
              <PencilIcon width={15} height={15} />
            </button>
            <button
              type="button"
              className="doc-card__icon-btn doc-card__icon-btn--danger"
              onClick={onDelete}
              disabled={busy}
              aria-label={`Dar de baja ${d.displayName}`}
              title="Dar de baja"
            >
              <TrashIcon width={15} height={15} />
            </button>
          </div>
        )}
      </div>

      {previous.length > 0 && (
        <div className="doc-card__previous">
          <button
            type="button"
            className="doc-card__previous-toggle"
            aria-expanded={showPrevious}
            onClick={() => setShowPrevious((s) => !s)}
          >
            <ChevronRightIcon
              width={13}
              height={13}
              className={`vehicle-detail__toggle-icon${showPrevious ? ' vehicle-detail__toggle-icon--expanded' : ''}`}
            />
            {previous.length === 1 ? '1 versión anterior' : `${previous.length} versiones anteriores`}
          </button>
          {showPrevious && (
            <ul className="doc-card__previous-list">
              {previous.map((p) => (
                <li key={p.id}>
                  <span>{p.expiresAt ? `Venció el ${formatDate(p.expiresAt)}` : formatDate(p.createdAt.slice(0, 10))}</span>
                  {p.number && <span className="doc-card__number">N° {p.number}</span>}
                  {p.fileUrl && (
                    <a href={p.fileUrl} target="_blank" rel="noreferrer" className="doc-link-btn">
                      Comprobante
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

/** Cadena de renovaciones de un documento vigente, del más nuevo al más viejo. */
function previousVersions(current: VehicleDocument, history: VehicleDocument[]): VehicleDocument[] {
  const chain: VehicleDocument[] = [];
  let id = current.id;
  for (;;) {
    const older = history.find((h) => h.replacedById === id);
    if (!older) return chain;
    chain.push(older);
    id = older.id;
  }
}

/**
 * Pestaña "Documentación" del vehículo (CAM-127): una tarjeta por documento vigente, ordenadas por lo que
 * requiere atención, los obligatorios que faltan y las versiones anteriores de cada uno.
 */
export function VehicleDocumentsTab({ vehicleId, readOnly, onChanged }: VehicleDocumentsTabProps) {
  const [data, setData] = useState<VehicleDocuments | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [form, setForm] = useState<DocumentFormMode | null>(null);
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

  const items = [...data.items].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  const expired = items.filter((d) => d.status === 'vencido').length;
  const dueSoon = items.filter((d) => d.status === 'por_vencer').length;
  const summary = [
    `${items.length} ${items.length === 1 ? 'documento' : 'documentos'}`,
    expired ? `${expired} ${expired === 1 ? 'vencido' : 'vencidos'}` : null,
    dueSoon ? `${dueSoon} por vencer` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <section className="vehicle-docs">
      <header className="vehicle-docs__header">
        <div>
          <h2 className="vehicle-docs__title">Documentación</h2>
          <p className="vehicle-docs__summary">
            {summary}. Avisa {data.leadDays} días antes de que venza cada uno.
          </p>
        </div>
        {!readOnly && (
          <button type="button" className="primary-btn vehicle-docs__add" onClick={() => setForm({ kind: 'create' })}>
            <PlusIcon width={16} height={16} aria-hidden="true" />
            Agregar documento
          </button>
        )}
      </header>

      {actionError && <p className="error-banner">{actionError}</p>}

      <ul className="vehicle-docs__grid">
        {items.map((d) => (
          <DocumentCard
            key={d.id}
            document={d}
            previous={previousVersions(d, data.history)}
            readOnly={readOnly}
            busy={busyId === d.id}
            onRenew={() => setForm({ kind: 'renew', document: d })}
            onEdit={() => setForm({ kind: 'correct', document: d })}
            onDelete={() => void handleDelete(d)}
          />
        ))}
        {data.missingRequired.map((t) => (
          <li key={t} className="doc-card doc-card--missing">
            <div className="doc-card__top">
              <h3 className="doc-card__name">{DOCUMENT_TYPE_LABELS[t]}</h3>
              <span className="doc-status__chip doc-status__chip--falta">Falta</span>
            </div>
            <p className="doc-card__missing-text">Es obligatorio. No bloquea el vehículo, pero conviene tenerlo cargado.</p>
            {!readOnly && (
              <button
                type="button"
                className="doc-card__renew doc-card__missing-btn"
                onClick={() => setForm({ kind: 'create', name: DOCUMENT_TYPE_LABELS[t] })}
              >
                <PlusIcon width={14} height={14} aria-hidden="true" />
                Cargar {DOCUMENT_TYPE_LABELS[t]}
              </button>
            )}
          </li>
        ))}
      </ul>

      {items.length === 0 && data.missingRequired.length === 0 && (
        <p className="muted">Todavía no hay documentos cargados.</p>
      )}

      {form && (
        <DocumentFormModal
          vehicleId={vehicleId}
          mode={form}
          current={data.items}
          onClose={() => setForm(null)}
          onSaved={handleSaved}
        />
      )}
    </section>
  );
}
