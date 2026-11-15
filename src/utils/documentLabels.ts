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

/** Sugerencias al cargar un documento: los conocidos, con el nombre que se escribe al elegirlos. */
export const DOCUMENT_SUGGESTIONS: { type: VehicleDocumentType; name: string }[] = [
  { type: 'vtv', name: 'VTV / RTO' },
  { type: 'seguro', name: 'Seguro' },
  { type: 'cedula_verde', name: 'Cédula verde' },
  { type: 'cedula_azul', name: 'Cédula azul' },
  { type: 'titulo', name: 'Título del automotor' },
  { type: 'habilitacion_carga', name: 'Habilitación de carga' },
];

// Misma lista que VehicleDocumentType en el backend, que es el que decide: acá solo se usa para el
// aviso "Cuenta como…" del formulario mientras se escribe.
const KEYWORDS: [VehicleDocumentType, string[]][] = [
  ['vtv', ['vtv', 'rto', 'revision tecnica', 'verificacion tecnica']],
  ['seguro', ['seguro', 'poliza']],
  ['cedula_azul', ['cedula azul', 'autorizado']],
  ['habilitacion_carga', ['habilitacion de carga', 'ruta', 'senasa']],
  ['cedula_verde', ['cedula verde', 'cedula de identificacion']],
  ['titulo', ['titulo']],
];

export function normalizeDocumentName(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** "Póliza La Segunda" -> seguro; "Permiso municipal" -> otro. */
export function inferDocumentType(name: string): VehicleDocumentType {
  const padded = ` ${normalizeDocumentName(name)} `;
  return KEYWORDS.find(([, words]) => words.some((w) => padded.includes(` ${w} `)))?.[0] ?? 'otro';
}

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
