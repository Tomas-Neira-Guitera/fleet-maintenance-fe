// Exportar gastos a CSV (CAM-108). Se arma en el navegador con las mismas filas que muestra la
// pestaña Gastos, así el archivo trae exactamente lo filtrado. Pensado para abrirlo con doble clic
// en un Excel en español: ";" como separador, coma decimal, UTF-8 con BOM (sin el BOM, Excel lee
// los acentos y la "ñ" como Latin-1) y fin de línea CRLF.

import type { Expense } from '../types/domain';
import { formatShortDate } from './dateFormat';
import { EXPENSE_CATEGORY_LABEL, EXPENSE_ORIGIN_LABEL } from './expenseFormat';

const SEPARATOR = ';';
const NEWLINE = '\r\n';
const BOM = '\uFEFF';

const HEADERS = [
  'Fecha',
  'Patente',
  'Orden de trabajo',
  'Origen',
  'Realizado por',
  'Categoría',
  'Descripción',
  'N° de comprobante',
  'Monto',
];

/**
 * Un campo listo para el CSV. Entre comillas si trae separador, comillas o salto de línea (las
 * comillas internas se duplican). Un texto que arranca con = + - @ se precede con ' para que Excel
 * no lo ejecute como fórmula: las descripciones las escribe cualquiera que cargue un gasto.
 */
export function csvField(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/**
 * N° de comprobante (CAM-107). Siempre como texto para Excel: si no, se come los ceros de "00012345",
 * pasa a notación científica un número de más de 15 dígitos y convierte "3/4" en fecha. Va como
 * ="…" (las comillas internas, duplicadas), que Excel muestra tal cual y no puede ejecutar nada:
 * todo queda adentro de un texto. Y como el campo lleva comillas, se cita entero como pide RFC 4180,
 * así lo leen bien también los lectores estrictos. No pasa por csvField: el ' que agrega se vería.
 */
function receiptNumberField(receiptNumber: string | null): string {
  if (!receiptNumber) return '';
  const formula = `="${receiptNumber.replace(/"/g, '""')}"`;
  return `"${formula.replace(/"/g, '""')}"`;
}

/** Monto con coma decimal y sin separador de miles, para que Excel lo tome como número. */
function formatAmount(amount: number): string {
  return amount.toFixed(2).replace('.', ',');
}

export function buildExpensesCsv(expenses: Expense[]): string {
  const rows = expenses.map((expense) =>
    [
      formatShortDate(expense.date),
      expense.plate ?? '',
      expense.workOrderTitle,
      EXPENSE_ORIGIN_LABEL[expense.origin],
      expense.executionType === 'interno' ? 'Personal propio' : 'Taller externo',
      EXPENSE_CATEGORY_LABEL[expense.category],
      expense.description,
    ]
      .map(csvField)
      .concat(receiptNumberField(expense.receiptNumber), formatAmount(expense.amount))
      .join(SEPARATOR),
  );
  return BOM + [HEADERS.map(csvField).join(SEPARATOR), ...rows].join(NEWLINE) + NEWLINE;
}

/** Descarga el texto como archivo, sin pasar por el backend. */
export function downloadCsv(filename: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  // Con margen: algunos Safari cortan la descarga si la URL se revoca enseguida.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
