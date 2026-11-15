import type { ExpenseCategory, ExpenseOrigin, VehicleExpenseCategory } from '../types/domain';

export const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  repuesto: 'Repuesto',
  mano_de_obra: 'Mano de obra',
  combustible: 'Combustible',
  seguro: 'Seguro',
  patente: 'Patente',
  vtv: 'VTV',
  peajes: 'Peajes',
  otro: 'Otro',
};

/**
 * Las que se pueden elegir al cargar un gasto operativo (CAM-109). Combustible no: desde CAM-156 se carga
 * como carga de combustible, con litros y km. Un gasto de combustible anterior sí se puede editar.
 */
export const VEHICLE_EXPENSE_CATEGORIES: VehicleExpenseCategory[] = [
  'seguro',
  'patente',
  'vtv',
  'peajes',
  'otro',
];

/** De dónde nació el gasto: es lo que separa lo preventivo de lo correctivo y de lo operativo (CAM-52, CAM-109). */
export const EXPENSE_ORIGIN_LABEL: Record<ExpenseOrigin, string> = {
  plan: 'Preventivo',
  defect: 'Correctivo',
  manual: 'Órdenes sueltas',
  operating: 'Operativo',
  fuel: 'Combustible',
};
