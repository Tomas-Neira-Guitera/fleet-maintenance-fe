import type { NewChecklistItem } from '../services/checklistService';

// CAM-31: secciones donde se puede agregar un ítem extra y largo máximo de su nombre (igual que el backend).
// CAM-159: el post-viaje también se configura.
export const CHECKLIST_LABEL_MAX_LENGTH = 60;

export type ChecklistPhase = 'pre-trip' | 'post-trip';

export const CHECKLIST_SECTIONS: { key: NewChecklistItem['section']; label: string; short: string; phase: ChecklistPhase }[] = [
  { key: 'exterior', label: 'Inspección visual (exterior)', short: 'Exterior', phase: 'pre-trip' },
  { key: 'interior', label: 'Inspección interior (cabina)', short: 'Cabina', phase: 'pre-trip' },
  { key: 'posttrip', label: 'Post-viaje', short: 'Post-viaje', phase: 'post-trip' },
];

export function sectionsOf(phase: ChecklistPhase) {
  return CHECKLIST_SECTIONS.filter((s) => s.phase === phase);
}

export function sectionShortLabel(section: string): string {
  return CHECKLIST_SECTIONS.find((s) => s.key === section)?.short ?? section;
}
