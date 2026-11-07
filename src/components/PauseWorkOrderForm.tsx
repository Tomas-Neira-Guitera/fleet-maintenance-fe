import { useId, useState } from 'react';
import type { WorkOrderPauseReason } from '../types/domain';
import { PAUSE_COMMENT_MAX_LENGTH, PAUSE_REASON_LABEL } from '../utils/workOrderFormat';

interface PauseWorkOrderFormProps {
  pending: boolean;
  onConfirm: (reason: WorkOrderPauseReason, comment: string) => void;
  onCancel: () => void;
}

const REASONS = Object.keys(PAUSE_REASON_LABEL) as WorkOrderPauseReason[];

/**
 * CAM-148: poner una OT en espera. El motivo es obligatorio, y con "Otro" también el comentario,
 * igual que valida el backend. Lo usan el técnico (TechnicianWorkOrder) y el admin
 * (WorkOrderDetailModal), que también pausa las OTs de un taller externo.
 */
export function PauseWorkOrderForm({ pending, onConfirm, onCancel }: PauseWorkOrderFormProps) {
  const id = useId();
  const [reason, setReason] = useState<WorkOrderPauseReason | ''>('');
  const [comment, setComment] = useState('');
  const commentRequired = reason === 'otro';
  const canConfirm = reason !== '' && (!commentRequired || comment.trim() !== '') && !pending;

  return (
    <div className="pause-form">
      <label className="pause-form__label" htmlFor={`${id}-reason`}>
        Por qué queda en espera
      </label>
      <select
        id={`${id}-reason`}
        className="pause-form__select"
        value={reason}
        onChange={(e) => setReason(e.target.value as WorkOrderPauseReason | '')}
        disabled={pending}
      >
        <option value="" disabled>
          Elegí un motivo
        </option>
        {REASONS.map((value) => (
          <option key={value} value={value}>
            {PAUSE_REASON_LABEL[value]}
          </option>
        ))}
      </select>

      <label className="pause-form__label" htmlFor={`${id}-comment`}>
        {commentRequired ? 'Qué la está frenando' : 'Comentario (opcional)'}
      </label>
      <textarea
        id={`${id}-comment`}
        className="pause-form__textarea"
        rows={2}
        maxLength={PAUSE_COMMENT_MAX_LENGTH}
        placeholder={commentRequired ? 'Ej: falta la autorización del seguro' : 'Ej: pastillas pedidas a Bosch, llegan el jueves'}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        disabled={pending}
      />

      <div className="pause-form__actions">
        <button type="button" className="secondary-btn" onClick={onCancel} disabled={pending}>
          No pausar
        </button>
        <button
          type="button"
          className="primary-btn"
          onClick={() => reason !== '' && onConfirm(reason, comment.trim())}
          disabled={!canConfirm}
        >
          {pending ? 'Pausando…' : 'Poner en espera'}
        </button>
      </div>
    </div>
  );
}
