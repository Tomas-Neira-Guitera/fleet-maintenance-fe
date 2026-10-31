// Historial de un vehículo para exportar a PDF (CAM-130): recorta al período los mismos datos que
// muestra el detalle del vehículo y calcula lo que el documento necesita. Sin React, para que lo que
// entra en cada sección se pueda leer de una.

import type {
  DefectSummary,
  Expense,
  ExpenseCategory,
  ExpenseOrigin,
  InspectionHistoryItem,
  MaintenanceHistoryItem,
  Vehicle,
  VehicleHistory,
  WorkOrder,
} from '../types/domain';
import { EXPENSE_CATEGORY_LABEL, EXPENSE_ORIGIN_LABEL } from './expenseFormat';
import { toLocalDateKey } from './localDate';
import { isInPeriod, lastDayOf, type Period } from './period';
import { WORK_ORDER_STATUS_LABEL } from './workOrderFormat';

const ARGENTINA_TIME_ZONE = 'America/Argentina/Buenos_Aires';

export interface CostLine {
  label: string;
  amount: number;
}

export interface VehicleHistoryReport {
  vehicle: Vehicle;
  period: Period;
  issuedAt: Date;
  inspections: InspectionHistoryItem[];
  defects: { defect: DefectSummary; resolution: string }[];
  workOrders: WorkOrder[];
  maintenance: MaintenanceHistoryItem[];
  costs: { total: number; count: number; byCategory: CostLine[]; byOrigin: CostLine[] };
}

/**
 * Fecha y hora argentinas, sea cual sea el huso de la máquina que exporta: "29/10/2026, 22:15".
 * Con `hourCycle` y no `hour12: false`: según el motor, eso escribe las 00:05 como "24:05".
 */
export function formatArgentinaDateTime(instant: string | Date): string {
  return new Date(instant).toLocaleString('es-AR', {
    timeZone: ARGENTINA_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
}

/** Los últimos 12 meses, con hoy incluido. No es un atajo del filtro: va como período personalizado. */
export function lastTwelveMonths(now = new Date()): Period {
  return {
    preset: 'custom',
    from: new Date(now.getFullYear() - 1, now.getMonth(), now.getDate() + 1),
    to: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
  };
}

/** El navegador propone el título del documento como nombre del PDF. */
export function reportFilename(plate: string, period: Period): string {
  const safePlate = plate.replace(/[^\p{L}\p{N}-]/gu, '');
  return `Historial_${safePlate}_${toLocalDateKey(period.from)}_${toLocalDateKey(lastDayOf(period))}`;
}

/**
 * Cómo se resolvió un defecto, según su OT. La OT puede haberse cerrado después del período: por eso
 * se busca entre todas las del vehículo, no solo las que van en el documento. Si hay más de una
 * finalizada (una programación vieja que se termina después), lo resolvió la primera en cerrarse:
 * es la que fija `resolvedAt`, y la fecha coincide con el tiempo fuera de servicio de CAM-134.
 */
function describeResolution(defect: DefectSummary, workOrders: WorkOrder[]): string {
  const own = workOrders.filter((wo) => wo.defectId === defect.id);
  const closedAt = (wo: WorkOrder) => (wo.finalizedAt ? new Date(wo.finalizedAt).getTime() : Infinity);
  const [finalized] = own.filter((wo) => wo.status === 'finalizada').sort((a, b) => closedAt(a) - closedAt(b));
  if (finalized) {
    const closedOn = finalized.finalizedAt ? ` el ${formatArgentinaDateTime(finalized.finalizedAt)}` : '';
    const closing = finalized.closingDescription ? `: ${finalized.closingDescription}` : '';
    return `Resuelto por OT "${finalized.title}"${closedOn}${closing}`;
  }
  if (defect.status === 'resuelto') return 'Resuelto';
  const open = own.find((wo) => wo.status === 'asignada' || wo.status === 'en_proceso');
  return open ? `Abierto · OT "${open.title}" (${WORK_ORDER_STATUS_LABEL[open.status].toLowerCase()})` : 'Abierto';
}

function sumAmounts(expenses: Expense[]): number {
  return expenses.reduce((total, expense) => total + expense.amount, 0);
}

function linesBy<K extends string>(
  expenses: Expense[],
  labels: Record<K, string>,
  keyOf: (expense: Expense) => K,
): CostLine[] {
  // Sin los que dan cero: con gastos operativos (CAM-109) son ocho categorías, casi siempre vacías.
  return (Object.keys(labels) as K[])
    .map((key) => ({
      label: labels[key],
      amount: sumAmounts(expenses.filter((expense) => keyOf(expense) === key)),
    }))
    .filter((line) => line.amount > 0);
}

/**
 * Qué entra en cada sección: inspecciones y defectos por su fecha; mantenimientos por el día en que se
 * hicieron; OTs si se crearon o se finalizaron en el período, porque para una auditoría también cuenta
 * la que venía de antes y se cerró acá. `expenses` ya viene recortado por el backend.
 */
export function buildVehicleHistoryReport(
  vehicle: Vehicle,
  history: VehicleHistory,
  workOrders: WorkOrder[],
  expenses: Expense[],
  period: Period,
): VehicleHistoryReport {
  const firstDay = toLocalDateKey(period.from);
  const lastDay = toLocalDateKey(lastDayOf(period));
  const newestFirst = (a: string, b: string) => new Date(b).getTime() - new Date(a).getTime();

  return {
    vehicle,
    period,
    issuedAt: new Date(),
    inspections: history.inspections
      .filter((inspection) => isInPeriod(inspection.timestamp, period))
      .sort((a, b) => newestFirst(a.timestamp, b.timestamp)),
    defects: history.defects
      .filter((defect) => isInPeriod(defect.createdAt, period))
      .sort((a, b) => newestFirst(a.createdAt, b.createdAt))
      .map((defect) => ({ defect, resolution: describeResolution(defect, workOrders) })),
    workOrders: workOrders
      .filter((wo) => isInPeriod(wo.createdAt, period) || (wo.finalizedAt != null && isInPeriod(wo.finalizedAt, period)))
      .sort((a, b) => newestFirst(a.createdAt, b.createdAt)),
    // completedAt es un día sin hora ("2026-10-12"): como texto se compara bien, y como instante se correría a UTC.
    maintenance: history.maintenance
      .filter((item) => item.completedAt >= firstDay && item.completedAt <= lastDay)
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt)),
    costs: {
      total: sumAmounts(expenses),
      count: expenses.length,
      byCategory: linesBy<ExpenseCategory>(expenses, EXPENSE_CATEGORY_LABEL, (expense) => expense.category),
      byOrigin: linesBy<ExpenseOrigin>(expenses, EXPENSE_ORIGIN_LABEL, (expense) => expense.origin),
    },
  };
}
