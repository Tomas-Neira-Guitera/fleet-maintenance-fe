import type { VehicleDocumentStatus, VehicleDocumentType } from '../types/domain';

// CAM-127: nombres y orden de los tipos de documento, iguales a los del backend (VehicleDocumentType).
export const DOCUMENT_TYPE_LABELS: Record<VehicleDocumentType, string> = {
  vtv: 'VTV / RTO',
  seguro: 'Seguro',
  cedula_azul: 'Cédula azul',
  habilitacion_carga: 'Habilitación de carga',
  cedula_verde: 'Cédula verde',
  titulo: 'Título del automotor',
  otro: 'Otro',
};

export const DOCUMENT_TYPES = Object.keys(DOCUMENT_TYPE_LABELS) as VehicleDocumentType[];

/** Los que tienen vencimiento propio y se pueden vincular a un plan por tiempo. */
export const RENEWABLE_DOCUMENT_TYPES: VehicleDocumentType[] = ['vtv', 'seguro', 'cedula_azul', 'habilitacion_carga'];

export const DOCUMENT_STATUS_LABELS: Record<VehicleDocumentStatus, string> = {
  al_dia: 'Al día',
  por_vencer: 'Por vencer',
  vencido: 'Vencido',
  sin_vencimiento: 'Sin vencimiento',
};

/** "Vence en 10 días", "Vence hoy", "Venció hace 3 días". */
export function describeExpiry(daysToExpiry: number | null): string | null {
  if (daysToExpiry == null) return null;
  if (daysToExpiry === 0) return 'Vence hoy';
  if (daysToExpiry === 1) return 'Vence mañana';
  if (daysToExpiry > 1) return `Vence en ${daysToExpiry} días`;
  return daysToExpiry === -1 ? 'Venció ayer' : `Venció hace ${-daysToExpiry} días`;
}
