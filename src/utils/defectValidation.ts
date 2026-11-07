import type { DefectDetail } from '../types/domain';

/** Un defecto mientras se carga: lo que va al backend, y si su foto se está subiendo. */
export interface DefectFieldsValue {
  defect: DefectDetail;
  /** true mientras la foto del defecto se está subiendo al backend. */
  uploading?: boolean;
}

/**
 * Un defecto completo según las reglas del checklist (CAM-11): título, y foto si es bloqueante. Lo usan
 * el checklist y el reporte durante el viaje (CAM-139).
 */
export function isDefectDetailValid({ defect, uploading }: DefectFieldsValue): boolean {
  if (!defect.description.trim()) return false;
  if (defect.severity === 'blocking' && (!defect.photoUrl || uploading)) return false;
  return true;
}
