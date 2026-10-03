import type { NewChecklistItem } from '../services/checklistService';

// CAM-31: secciones donde se puede agregar un ítem extra y largo máximo de su nombre (igual que el backend).
export const CHECKLIST_LABEL_MAX_LENGTH = 60;

export const CHECKLIST_SECTIONS: { key: NewChecklistItem['section']; label: string }[] = [
  { key: 'exterior', label: 'Inspección visual (exterior)' },
  { key: 'interior', label: 'Inspección interior (cabina)' },
];
