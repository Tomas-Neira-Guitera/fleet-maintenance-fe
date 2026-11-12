import type { ChecklistAnswer, InspectionType, SubmitInspectionResult, TreadReading } from '../types/domain';
import { API_BASE_URL, authHeaders, throwApiError } from './apiClient';

interface WireAnswer {
  itemId: string;
  outcome?: 'ok' | 'defect';
  numberValue?: number;
  defect?: { severity: 'non-blocking' | 'blocking'; description: string; details?: string; photoUrl?: string };
}

export function toWireAnswers(answers: ChecklistAnswer[]): WireAnswer[] {
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

/** CAM-153: cuándo la hizo el chofer y el id con que el servidor reconoce un reintento. */
export interface SubmissionMeta {
  performedAt?: string;
  clientSubmissionId?: string;
  /** CAM-157: dibujo de las cubiertas, solo en el pre-viaje. */
  treadReadings?: TreadReading[];
  /** CAM-157: el remolque que lleva ("none": sin remolque); sin el campo, el enganche no cambia. */
  trailerId?: string;
}

/** POST /api/inspections/{vehicleId} -- el chofer es el del token (CAM-85): 401 si la sesión venció. */
export async function submitInspection(
  vehicleId: string,
  type: InspectionType,
  answers: ChecklistAnswer[],
  notes?: string,
  meta: SubmissionMeta = {},
): Promise<SubmitInspectionResult> {
  const res = await fetch(`${API_BASE_URL}/api/inspections/${vehicleId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({
      type,
      answers: toWireAnswers(answers),
      notes,
      performedAt: meta.performedAt,
      clientSubmissionId: meta.clientSubmissionId,
      treadReadings: meta.treadReadings?.length ? meta.treadReadings : undefined,
      trailerId: meta.trailerId,
    }),
  });
  if (!res.ok) return throwApiError(res, 'No se pudo enviar la inspección');
  return res.json() as Promise<SubmitInspectionResult>;
}
