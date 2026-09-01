import type { ChecklistAnswer, InspectionType, SubmitInspectionResult } from '../types/domain';
import { API_BASE_URL, driverHeaders, throwApiError } from './apiClient';

interface WireAnswer {
  itemId: string;
  outcome?: 'ok' | 'defect';
  numberValue?: number;
  defect?: { severity: 'non-blocking' | 'blocking'; description: string; photoUrl?: string };
}

function toWireAnswers(answers: ChecklistAnswer[]): WireAnswer[] {
  return answers.map((a) => ({
    itemId: a.itemId,
    outcome: a.outcome,
    numberValue: a.numberValue !== undefined && a.numberValue !== '' ? Number(a.numberValue) : undefined,
    defect: a.defect
      ? { severity: a.defect.severity, description: a.defect.description, photoUrl: a.defect.photoUrl }
      : undefined,
  }));
}

export async function submitInspection(
  vehicleId: string,
  type: InspectionType,
  answers: ChecklistAnswer[],
  notes?: string,
): Promise<SubmitInspectionResult> {
  const res = await fetch(`${API_BASE_URL}/api/inspections/${vehicleId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...driverHeaders() },
    body: JSON.stringify({ type, answers: toWireAnswers(answers), notes }),
  });
  if (!res.ok) return throwApiError(res, 'No se pudo enviar la inspección');
  return res.json() as Promise<SubmitInspectionResult>;
}
