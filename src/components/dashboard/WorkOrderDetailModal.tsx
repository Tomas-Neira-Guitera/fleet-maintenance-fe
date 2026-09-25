import { useRef, useState } from 'react';
import { ApiError } from '../../services/apiClient';
import { uploadDefectPhoto } from '../../services/photosService';
import {
  addWorkOrderExpense,
  addWorkOrderPhoto,
  deleteWorkOrderExpense,
  deleteWorkOrderPhoto,
  updateWorkOrder,
  type UpdateWorkOrderInput,
} from '../../services/workOrdersService';
import type { WorkOrder, WorkOrderExecutionType, WorkOrderExpenseCategory } from '../../types/domain';
import { currencyFormatter } from '../../utils/maintenanceFormat';
import { workOrderResponsible } from '../../utils/workOrderFormat';
import { BuildingIcon, CameraIcon, CloseIcon, TrashIcon, WrenchIcon } from '../icons';
import { FinalizeWorkOrderModal } from './FinalizeWorkOrderModal';
import { WorkOrderResponsibleField } from './WorkOrderResponsibleField';
import { WorkOrderStatusBadge } from './WorkOrderStatusBadge';
import '../../styles/dashboard.css';

const EXPENSE_CATEGORY_LABEL: Record<WorkOrderExpenseCategory, string> = {
  repuesto: 'Repuesto',
  mano_de_obra: 'Mano de obra',
  otro: 'Otro',
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' });
}

interface WorkOrderDetailModalProps {
  workOrder: WorkOrder;
  onClose: () => void;
  onUpdated: (workOrder: WorkOrder) => void;
}

/**
 * Detalle de una OT (CAM-14/CAM-62/CAM-63): datos generales editables mientras
 * está abierta, gastos, fotos, y transiciones de estado. Finalizar abre
 * FinalizeWorkOrderModal (descripción de cierre + fotos obligatorias).
 */
export function WorkOrderDetailModal({ workOrder, onClose, onUpdated }: WorkOrderDetailModalProps) {
  const [wo, setWo] = useState(workOrder);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const [assignee, setAssignee] = useState(wo.assignee ?? '');
  const [technicianId, setTechnicianId] = useState(wo.technicianId ?? '');
  const [executionType, setExecutionType] = useState<WorkOrderExecutionType>(wo.executionType);
  const [externalProvider, setExternalProvider] = useState(wo.externalProvider ?? '');
  const [description, setDescription] = useState(wo.description ?? '');

  const [expenseCategory, setExpenseCategory] = useState<WorkOrderExpenseCategory>('repuesto');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [addingExpense, setAddingExpense] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const isOpen = wo.status === 'asignada' || wo.status === 'en_proceso';
  const responsible = workOrderResponsible(wo);

  function apply(updated: WorkOrder) {
    setWo(updated);
    onUpdated(updated);
  }

  async function handleAdvance() {
    setPending(true);
    setError(null);
    try {
      apply(await updateWorkOrder(wo.id, { status: 'en_proceso' }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar la orden. Intentá de nuevo.');
    } finally {
      setPending(false);
    }
  }

  async function handleCancel() {
    if (!window.confirm('¿Cancelar esta orden de trabajo?')) return;
    setPending(true);
    setError(null);
    try {
      apply(await updateWorkOrder(wo.id, { status: 'cancelada' }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cancelar la orden. Intentá de nuevo.');
    } finally {
      setPending(false);
    }
  }

  // Solo cuenta lo que se manda según el tipo de ejecución (el técnico en internas, el contacto
  // y el proveedor en externas), para que el botón Guardar no quede prendido por campos ocultos.
  const editDirty =
    executionType !== wo.executionType ||
    description !== (wo.description ?? '') ||
    (executionType === 'interno'
      ? technicianId !== (wo.technicianId ?? '')
      : assignee !== (wo.assignee ?? '') || externalProvider !== (wo.externalProvider ?? ''));

  /** Vuelve a cargar el formulario con lo que guardó el servidor, que puede haber limpiado
   *  campos por su cuenta (ej. desasignar al técnico al pasar la OT a externa, CAM-60). */
  function syncForm(saved: WorkOrder) {
    setAssignee(saved.assignee ?? '');
    setTechnicianId(saved.technicianId ?? '');
    setExecutionType(saved.executionType);
    setExternalProvider(saved.externalProvider ?? '');
    setDescription(saved.description ?? '');
  }

  async function handleSaveEdits() {
    setPending(true);
    setError(null);
    // Solo lo que cambió: reenviar un técnico que dejó de serlo daría 422 al editar otro campo.
    const changes: UpdateWorkOrderInput = {};
    if (executionType !== wo.executionType) changes.executionType = executionType;
    if (executionType === 'interno' && technicianId !== (wo.technicianId ?? '')) changes.technicianId = technicianId;
    if (executionType === 'externo') {
      if (externalProvider !== (wo.externalProvider ?? '')) changes.externalProvider = externalProvider.trim();
      if (assignee !== (wo.assignee ?? '')) changes.assignee = assignee.trim();
    }
    if (description !== (wo.description ?? '')) changes.description = description.trim();
    try {
      const saved = await updateWorkOrder(wo.id, changes);
      apply(saved);
      syncForm(saved);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron guardar los cambios. Intentá de nuevo.');
    } finally {
      setPending(false);
    }
  }

  async function handleAddExpense() {
    const amount = Number(expenseAmount);
    if (!expenseDescription.trim() || !(amount > 0)) return;
    setAddingExpense(true);
    setError(null);
    try {
      const expense = await addWorkOrderExpense(wo.id, {
        category: expenseCategory,
        description: expenseDescription.trim(),
        amount,
      });
      apply({ ...wo, expenses: [...wo.expenses, expense], totalExpenses: wo.totalExpenses + expense.amount });
      setExpenseDescription('');
      setExpenseAmount('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo agregar el gasto. Intentá de nuevo.');
    } finally {
      setAddingExpense(false);
    }
  }

  async function handleDeleteExpense(expenseId: string) {
    setPending(true);
    setError(null);
    try {
      await deleteWorkOrderExpense(wo.id, expenseId);
      const removed = wo.expenses.find((e) => e.id === expenseId);
      apply({
        ...wo,
        expenses: wo.expenses.filter((e) => e.id !== expenseId),
        totalExpenses: wo.totalExpenses - (removed?.amount ?? 0),
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo borrar el gasto. Intentá de nuevo.');
    } finally {
      setPending(false);
    }
  }

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
      apply(current);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo subir la foto. Probá de nuevo.');
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDeletePhoto(photoId: string) {
    setPending(true);
    setError(null);
    try {
      await deleteWorkOrderPhoto(wo.id, photoId);
      apply({ ...wo, photos: wo.photos.filter((p) => p.id !== photoId) });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo borrar la foto. Intentá de nuevo.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal modal--wide">
        <header className="modal__header">
          <div>
            <h2 className="modal__title">{wo.title}</h2>
            <p className="modal__subtitle">
              {wo.plate ?? '—'} · Creada el {formatDateTime(wo.createdAt)}
            </p>
          </div>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Cerrar">
            <CloseIcon width={18} height={18} />
          </button>
        </header>

        <div className="modal__body">
          <div className="wo-detail__top">
            <WorkOrderStatusBadge status={wo.status} />
            {wo.status === 'finalizada' && wo.finalizedAt && (
              <span className="muted">Finalizada el {formatDateTime(wo.finalizedAt)}</span>
            )}
          </div>

          {error && <p className="error-banner">{error}</p>}

          {isOpen ? (
            <div className="wo-detail__section">
              <div className="wo-execution-toggle">
                <button
                  type="button"
                  className={`wo-execution-toggle__btn${executionType === 'interno' ? ' wo-execution-toggle__btn--active' : ''}`}
                  onClick={() => setExecutionType('interno')}
                  aria-pressed={executionType === 'interno'}
                >
                  Personal propio
                </button>
                <button
                  type="button"
                  className={`wo-execution-toggle__btn${executionType === 'externo' ? ' wo-execution-toggle__btn--active' : ''}`}
                  onClick={() => setExecutionType('externo')}
                  aria-pressed={executionType === 'externo'}
                >
                  Taller externo
                </button>
              </div>
              {executionType === 'externo' && (
                <label className="schedule-picker__field">
                  Proveedor / taller
                  <input
                    type="text"
                    className="schedule-picker__input"
                    value={externalProvider}
                    onChange={(e) => setExternalProvider(e.target.value)}
                  />
                </label>
              )}
              <WorkOrderResponsibleField
                executionType={executionType}
                technicianId={technicianId}
                onTechnicianChange={setTechnicianId}
                assignee={assignee}
                onAssigneeChange={setAssignee}
              />
              <label className="schedule-picker__field">
                Descripción
                <textarea
                  className="schedule-picker__input schedule-picker__textarea"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
              {editDirty && (
                <button type="button" className="secondary-btn" onClick={handleSaveEdits} disabled={pending}>
                  Guardar cambios
                </button>
              )}
            </div>
          ) : (
            <div className="wo-detail__section">
              <p className="wo-detail__readonly-row">
                {wo.executionType === 'interno' ? (
                  <WrenchIcon width={14} height={14} />
                ) : (
                  <BuildingIcon width={14} height={14} />
                )}
                {wo.executionType === 'interno' ? 'Personal propio' : wo.externalProvider}
                {responsible ? ` · ${responsible}` : ''}
              </p>
              {wo.description && <p className="wo-detail__readonly-row">{wo.description}</p>}
              {wo.closingDescription && (
                <p className="wo-detail__readonly-row">
                  <strong>Cierre:</strong> {wo.closingDescription}
                </p>
              )}
            </div>
          )}

          <div className="wo-detail__section">
            <p className="wo-detail__section-title">Gastos · {currencyFormatter.format(wo.totalExpenses)}</p>
            {wo.expenses.length === 0 && <p className="muted">Sin gastos cargados todavía.</p>}
            {wo.expenses.length > 0 && (
              <ul className="wo-expense-list">
                {wo.expenses.map((expense) => (
                  <li key={expense.id} className="wo-expense-list__item">
                    <span className="wo-expense-list__category">{EXPENSE_CATEGORY_LABEL[expense.category]}</span>
                    <span className="wo-expense-list__description">{expense.description}</span>
                    <span className="wo-expense-list__amount">{currencyFormatter.format(expense.amount)}</span>
                    {isOpen && (
                      <button
                        type="button"
                        className="vehicle-maintenance-list__icon-btn vehicle-maintenance-list__icon-btn--danger wo-expense-list__delete"
                        onClick={() => handleDeleteExpense(expense.id)}
                        disabled={pending}
                        aria-label="Borrar gasto"
                      >
                        <TrashIcon width={14} height={14} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {isOpen && (
              <div className="wo-expense-form">
                <select
                  className="schedule-picker__input wo-expense-form__category"
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value as WorkOrderExpenseCategory)}
                >
                  <option value="repuesto">Repuesto</option>
                  <option value="mano_de_obra">Mano de obra</option>
                  <option value="otro">Otro</option>
                </select>
                <input
                  type="text"
                  className="schedule-picker__input wo-expense-form__description"
                  placeholder="Descripción"
                  value={expenseDescription}
                  onChange={(e) => setExpenseDescription(e.target.value)}
                />
                <input
                  type="number"
                  min="0"
                  step="1"
                  className="schedule-picker__input wo-expense-form__amount"
                  placeholder="Monto"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                />
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={handleAddExpense}
                  disabled={addingExpense || !expenseDescription.trim() || !(Number(expenseAmount) > 0)}
                >
                  Agregar
                </button>
              </div>
            )}
          </div>

          <div className="wo-detail__section">
            <p className="wo-detail__section-title">Fotos ({wo.photos.length})</p>
            {wo.photos.length === 0 && <p className="muted">Sin fotos cargadas todavía.</p>}
            {wo.photos.length > 0 && (
              <div className="wo-photo-gallery">
                {wo.photos.map((photo) => (
                  <div key={photo.id} className="wo-photo-gallery__item">
                    <a href={photo.photoUrl} target="_blank" rel="noreferrer">
                      <img src={photo.photoUrl} alt="Foto de la orden de trabajo" />
                    </a>
                    {isOpen && (
                      <button
                        type="button"
                        className="wo-photo-gallery__remove"
                        onClick={() => handleDeletePhoto(photo.id)}
                        disabled={pending}
                        aria-label="Borrar foto"
                      >
                        <TrashIcon width={14} height={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {isOpen && (
              <>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                >
                  <CameraIcon width={14} height={14} />
                  {uploadingPhoto ? 'Subiendo…' : 'Agregar foto'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="visually-hidden"
                  onChange={handlePhotoChange}
                />
              </>
            )}
          </div>
        </div>

        <footer className="modal__footer">
          <button type="button" className="secondary-btn" onClick={onClose}>
            Cerrar
          </button>
          {wo.status === 'asignada' && (
            <button type="button" className="secondary-btn" onClick={handleCancel} disabled={pending}>
              Cancelar orden
            </button>
          )}
          {wo.status === 'en_proceso' && (
            <button type="button" className="secondary-btn" onClick={handleCancel} disabled={pending}>
              Cancelar orden
            </button>
          )}
          {wo.status === 'asignada' && (
            <button type="button" className="primary-btn" onClick={handleAdvance} disabled={pending}>
              Pasar a en proceso
            </button>
          )}
          {wo.status === 'en_proceso' && (
            <button type="button" className="primary-btn" onClick={() => setFinalizing(true)} disabled={pending}>
              Finalizar
            </button>
          )}
        </footer>
      </div>

      {finalizing && (
        <FinalizeWorkOrderModal
          workOrder={wo}
          onClose={() => setFinalizing(false)}
          onFinalized={(updated) => {
            apply(updated);
            setFinalizing(false);
          }}
        />
      )}
    </div>
  );
}
