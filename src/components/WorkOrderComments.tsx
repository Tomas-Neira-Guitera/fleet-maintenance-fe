import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { ApiError, describeApiError } from '../services/apiClient';
import { addWorkOrderComment, getWorkOrderComments } from '../services/workOrdersService';
import type { WorkOrderComment } from '../types/domain';
import { formatDayAndTime } from '../utils/dateFormat';
import { DESCRIPTION_MAX_LENGTH } from '../utils/textLimits';
import { DictatedTextarea } from './DictatedTextarea';

interface WorkOrderCommentsProps {
  workOrderId: string;
  /** Una OT finalizada o cancelada muestra los comentarios pero no deja agregar otro (CAM-75). */
  canComment: boolean;
  /** Admin: dentro del modal de detalle. Técnico: como una sección más de su pantalla de trabajo. */
  variant: 'admin' | 'technician';
}

const ROLE_LABEL: Record<WorkOrderComment['authorRole'], string> = { ADMIN: 'Admin', TECNICO: 'Técnico' };

/**
 * En computadora (mouse y teclado físico) Enter envía y Ctrl+Enter hace un salto de línea. En el celular, Enter
 * sigue siendo salto de línea: su teclado no tiene Ctrl, y el técnico tiene que poder escribir dos renglones.
 */
function hasPhysicalKeyboard(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
}

/**
 * CAM-149: comentarios de una OT entre el admin y el técnico, del más viejo al más nuevo. No se editan ni se
 * borran. El campo se puede dictar, porque el técnico puede tener las manos ocupadas.
 */
export function WorkOrderComments({ workOrderId, canComment, variant }: WorkOrderCommentsProps) {
  const fieldId = useId();
  const hintId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [enterSends] = useState(hasPhysicalKeyboard);
  const [comments, setComments] = useState<WorkOrderComment[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [closedMeanwhile, setClosedMeanwhile] = useState(false);
  const formVisible = canComment && !closedMeanwhile;

  useEffect(() => {
    let cancelled = false;
    getWorkOrderComments(workOrderId)
      .then((data) => {
        if (!cancelled) setComments(data);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(describeApiError(err, 'No se pudieron cargar los comentarios.'));
      });
    return () => {
      cancelled = true;
    };
  }, [workOrderId]);

  async function handleSend(fromKeyboard = false) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const created = await addWorkOrderComment(workOrderId, trimmed);
      setComments((current) => [...(current ?? []), created]);
      setText('');
    } catch (err) {
      // La OT se cerró mientras se escribía: no tiene sentido reintentar, así que se saca el campo.
      if (err instanceof ApiError && err.errorCode === 'WORK_ORDER_CLOSED') setClosedMeanwhile(true);
      setSendError(describeApiError(err, 'No se pudo enviar el comentario. Intentá de nuevo.'));
    } finally {
      setSending(false);
      // El campo estuvo deshabilitado mientras se mandaba y perdió el foco: si se mandó con Enter, se le
      // devuelve para seguir escribiendo.
      if (fromKeyboard) requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Mientras el teclado arma una letra con tilde (isComposing), Enter no es de la app.
    if (!enterSends || event.key !== 'Enter' || event.nativeEvent.isComposing || event.altKey || event.metaKey) return;
    if (event.ctrlKey) {
      // Ctrl+Enter en un textarea no hace nada por su cuenta: el salto de línea se agrega a mano, donde está el cursor.
      event.preventDefault();
      const field = event.currentTarget;
      const start = field.selectionStart;
      const end = field.selectionEnd;
      const next = `${text.slice(0, start)}\n${text.slice(end)}`;
      if (next.length > DESCRIPTION_MAX_LENGTH) return;
      setText(next);
      requestAnimationFrame(() => field.setSelectionRange(start + 1, start + 1));
      return;
    }
    if (event.shiftKey) return; // Shift+Enter: el salto de línea de siempre.
    event.preventDefault();
    void handleSend(true);
  }

  const title = `Comentarios${comments && comments.length > 0 ? ` (${comments.length})` : ''}`;

  const body = (
    <>
      {loadError && <p className="error-banner">{loadError}</p>}
      {!comments && !loadError && <p className="muted">Cargando comentarios…</p>}
      {comments && comments.length === 0 && (
        <p className="muted">{canComment ? 'Todavía no hay comentarios.' : 'No hubo comentarios.'}</p>
      )}
      {comments && comments.length > 0 && (
        <ol className="wo-comments__list">
          {comments.map((comment) => (
            <li key={comment.id} className="wo-comments__item">
              <p className="wo-comments__meta">
                <span className="wo-comments__author">{comment.author.name}</span>
                <span className="wo-comments__role">{ROLE_LABEL[comment.authorRole] ?? comment.authorRole}</span>
                <time dateTime={comment.createdAt}>{formatDayAndTime(comment.createdAt)}</time>
              </p>
              <p className="wo-comments__text">{comment.text}</p>
            </li>
          ))}
        </ol>
      )}
      {formVisible && (
        <div className="wo-comments__form">
          <label className="visually-hidden" htmlFor={fieldId}>
            Nuevo comentario
          </label>
          <DictatedTextarea
            id={fieldId}
            rows={2}
            maxLength={DESCRIPTION_MAX_LENGTH}
            placeholder="Escribí o dictá un comentario"
            value={text}
            onChange={setText}
            disabled={sending}
            onKeyDown={handleKeyDown}
            describedBy={enterSends ? hintId : undefined}
            textareaRef={textareaRef}
          />
          {/* El contador ya lo muestra DictatedTextarea, al lado de "Dictar". */}
          <div className="wo-comments__actions">
            {enterSends && (
              <span id={hintId} className="wo-comments__hint">
                Enter para enviar · Ctrl+Enter para salto de línea
              </span>
            )}
            <button
              type="button"
              className={variant === 'admin' ? 'primary-btn wo-comments__send' : 'secondary-btn wo-comments__send'}
              onClick={() => void handleSend()}
              disabled={!text.trim() || sending}
            >
              {sending ? 'Enviando…' : 'Comentar'}
            </button>
          </div>
        </div>
      )}
      {/* Afuera del formulario: si la OT se cerró, el campo se va pero el motivo queda a la vista. */}
      {sendError && <p className="error-banner">{sendError}</p>}
    </>
  );

  if (variant === 'admin') {
    return (
      <div className="wo-detail__section wo-comments">
        <p className="wo-detail__section-title">{title}</p>
        {body}
      </div>
    );
  }
  return (
    <section className="checklist-section wo-comments">
      <h2 className="section-title">{title}</h2>
      <div className="checklist-item">{body}</div>
    </section>
  );
}
