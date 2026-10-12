import type { ChecklistAnswer, InspectionType, SubmitInspectionResult } from '../types/domain';
import { API_BASE_URL, authHeaders, throwApiError } from './apiClient';

interface WireAnswer {
  itemId: string;
  outcome?: 'ok' | 'defect';
  numberValue?: number;
  defect?: { severity: 'non-blocking' | 'blocking'; description: string; details?: string; photoUrl?: string };
}

function toWireAnswers(answers: ChecklistAnswer[]): WireAnswer[] {
  return answers.map((a) => ({
    itemId: a.itemId,
    outcome: a.outcome,
    numberValue: a.numberValue !== undefined && a.numberValue !== '' ? Number(a.numberValue) : undefined,
    // CAM-94: si el chofer volvió el ítem a OK, lo que había cargado del defecto no se manda.
    defect: a.outcome === 'defect' && a.defect
      ? {
          severity: a.defect.severity,
          description: a.defect.description.trim(),
          details: a.defect.details?.trim() || undefined,
          photoUrl: a.defect.photoUrl,
        }
      : undefined,
  }));
}

/** POST /api/inspections/{vehicleId} -- el chofer es el del token (CAM-85): 401 si la sesión venció. */
export async function submitInspection(
  vehicleId: string,
  type: InspectionType,
  answers: ChecklistAnswer[],
  notes?: string,
): Promise<SubmitInspectionResult> {
  const res = await fetch(`${API_BASE_URL}/api/inspections/${vehicleId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ type, answers: toWireAnswers(answers), notes }),
  });
  if (!res.ok) return throwApiError(res, 'No se pudo enviar la inspección');
  return res.json() as Promise<SubmitInspectionResult>;
}
