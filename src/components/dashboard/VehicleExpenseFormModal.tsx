import { useState } from 'react';
import { describeApiError } from '../../services/apiClient';
import { createVehicleExpense, deleteVehicleExpense, updateVehicleExpense } from '../../services/expensesService';
import type { Expense, VehicleExpenseCategory } from '../../types/domain';
import { argentinaDateKey } from '../../utils/dateFormat';
import { EXPENSE_CATEGORY_LABEL, VEHICLE_EXPENSE_CATEGORIES } from '../../utils/expenseFormat';
import { toLocalDateKey } from '../../utils/localDate';
import { DESCRIPTION_MAX_LENGTH } from '../../utils/textLimits';
import { CloseIcon, TrashIcon } from '../icons';
import { DatePicker } from '../datetime/DatePicker';
import '../../styles/dashboard.css';

interface VehicleExpenseFormModalProps {
  /** Los que se pueden elegir. */
  vehicles: { id: string; plate: string }[];
  /** Desde el detalle de un vehículo: el campo queda fijo en el primero de `vehicles`. */
  lockVehicle?: boolean;
  /** Vehículo con el que arranca un gasto nuevo. */
  initialVehicleId?: string;
  /** El gasto operativo a editar; sin él, se carga uno nuevo. */
  expense?: Expense;
  onClose: () => void;
  /** Se guardó o se borró: hay que volver a pedir los gastos. */
  onSaved: () => void;
}

/**
 * Cargar, editar o borrar un gasto operativo del vehículo (CAM-109): combustible, seguro, peajes y
 * todo lo que no sale de una orden de trabajo. La fecha puede ser anterior a hoy, para cargar una
 * factura de días pasados; futura no, y eso también lo valida el backend.
 */
export function VehicleExpenseFormModal({
  vehicles,
  lockVehicle = false,
  initialVehicleId,
  expense,
  onClose,
  onSaved,
}: VehicleExpenseFormModalProps) {
  const today = toLocalDateKey(new Date());
  const [vehicleId, setVehicleId] = useState(lockVehicle ? vehicles[0].id : (expense?.vehicleId ?? initialVehicleId ?? ''));
  const [date, setDate] = useState(expense ? argentinaDateKey(expense.date) : today);
  const [category, setCategory] = useState<VehicleExpenseCategory>(
    (expense?.category as VehicleExpenseCategory | undefined) ?? 'combustible',
  );
  const [description, setDescription] = useState(expense?.description ?? '');
  const [amount, setAmount] = useState(expense ? String(expense.amount) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = vehicleId !== '' && date !== '' && description.trim() !== '' && Number(amount) > 0;

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    const input = {
      vehicleId,
      date,
      category,
      description: description.trim(),
      amount: Number(amount),
    };
    try {
      if (expense) await updateVehicleExpense(expense.id, input);
      else await createVehicleExpense(input);
      onSaved();
    } catch (err) {
      setError(describeApiError(err, 'No se pudo guardar el gasto. Intentá de nuevo.'));
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!expense || !window.confirm('¿Borrar este gasto? No se puede deshacer.')) return;
    setSaving(true);
    setError(null);
    try {
      await deleteVehicleExpense(expense.id);
      onSaved();
    } catch (err) {
      setError(describeApiError(err, 'No se pudo borrar el gasto. Intentá de nuevo.'));
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="vehicle-expense-title">
      <div className="modal modal--narrow">
        <header className="modal__header">
          <div>
            <h2 className="modal__title" id="vehicle-expense-title">
              {expense ? 'Editar gasto' : 'Cargar gasto'}
            </h2>
            <p className="modal__subtitle">Un gasto del vehículo que no sale de una orden de trabajo</p>
          </div>
          <button type="button" className="modal__close" onClick={onClose} disabled={saving} aria-label="Cerrar">
            <CloseIcon width={18} height={18} />
          </button>
        </header>

        <div className="modal__body">
          <label className="schedule-picker__field">
            Vehículo
            <select
              className="schedule-picker__input"
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              disabled={lockVehicle}
            >
              {!lockVehicle && <option value="">Elegí un vehículo</option>}
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.plate}
                </option>
              ))}
            </select>
          </label>

          <label className="schedule-picker__field" htmlFor="vehicle-expense-date">
            Fecha
            <DatePicker
              id="vehicle-expense-date"
              className="schedule-picker__input"
              value={date}
              max={today}
              onChange={setDate}
              label="Fecha del gasto"
            />
          </label>

          <label className="schedule-picker__field">
            Categoría
            <select
              className="schedule-picker__input"
              value={category}
              onChange={(e) => setCategory(e.target.value as VehicleExpenseCategory)}
            >
              {VEHICLE_EXPENSE_CATEGORIES.map((option) => (
                <option key={option} value={option}>
                  {EXPENSE_CATEGORY_LABEL[option]}
                </option>
              ))}
            </select>
          </label>

          <label className="schedule-picker__field">
            Descripción
            <input
              type="text"
              className="schedule-picker__input"
              value={description}
              maxLength={DESCRIPTION_MAX_LENGTH}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: Carga de gasoil en ruta 3"
            />
          </label>

          <label className="schedule-picker__field">
            Monto
            <input
              type="number"
              min="0.01"
              step="0.01"
              className="schedule-picker__input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Ej: 45000"
            />
          </label>

          {error && <p className="error-banner">{error}</p>}
        </div>

        <footer className="modal__footer">
          {expense && (
            <button
              type="button"
              className="secondary-btn modal__footer-start modal__footer-danger"
              onClick={handleDelete}
              disabled={saving}
            >
              <TrashIcon width={14} height={14} />
              Borrar
            </button>
          )}
          <button type="button" className="secondary-btn" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="button" className="primary-btn" onClick={handleSubmit} disabled={saving || !canSubmit}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </footer>
      </div>
    </div>
  );
}
