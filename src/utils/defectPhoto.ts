import type { DefectDetail } from '../types/domain';

/** CAM-153: una foto sacada sin señal cuenta: se sube cuando vuelve la conexión. */
export function hasPhoto(defect: Pick<DefectDetail, 'photoUrl' | 'pendingPhoto'>): boolean {
  return Boolean(defect.photoUrl || defect.pendingPhoto);
}
