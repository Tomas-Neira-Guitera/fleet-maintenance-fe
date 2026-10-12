import type { ExpenseOrigin, WorkOrderExpenseCategory } from '../types/domain';

export const EXPENSE_CATEGORY_LABEL: Record<WorkOrderExpenseCategory, string> = {
  repuesto: 'Repuesto',
  mano_de_obra: 'Mano de obra',
  otro: 'Otro',
};

/** De dónde nació la OT del gasto: es lo que separa lo preventivo de lo correctivo (CAM-52). */
export const EXPENSE_ORIGIN_LABEL: Record<ExpenseOrigin, string> = {
  plan: 'Preventivo',
  defect: 'Correctivo',
  manual: 'Órdenes sueltas',
};
