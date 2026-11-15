import type {
  ApplyChecklistTemplateResult,
  ChecklistTemplate,
  ChecklistTemplateItem,
  UnapplyChecklistTemplateResult,
} from '../types/domain';
import { API_BASE_URL, authHeaders, throwApiError } from './apiClient';

// CAM-150: plantillas de checklist (solo admin).

export interface ChecklistTemplateInput {
  name: string;
  items: Omit<ChecklistTemplateItem, 'id'>[];
}

const BASE = `${API_BASE_URL}/api/checklist-templates`;

export async function getChecklistTemplates(): Promise<ChecklistTemplate[]> {
  const res = await fetch(BASE, { headers: authHeaders() });
  if (!res.ok) return throwApiError(res, 'No se pudieron obtener las plantillas');
  const body = (await res.json()) as { items: ChecklistTemplate[] };
  return body.items;
}

export async function createChecklistTemplate(input: ChecklistTemplateInput): Promise<ChecklistTemplate> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(input),
  });
  if (!res.ok) return throwApiError(res, 'No se pudo crear la plantilla');
  return res.json() as Promise<ChecklistTemplate>;
}

export async function updateChecklistTemplate(id: string, input: ChecklistTemplateInput): Promise<ChecklistTemplate> {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(input),
  });
  if (!res.ok) return throwApiError(res, 'No se pudo guardar la plantilla');
  return res.json() as Promise<ChecklistTemplate>;
}

export async function deleteChecklistTemplate(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE', headers: authHeaders() });
  if (!res.ok) return throwApiError(res, 'No se pudo borrar la plantilla');
}

export async function applyChecklistTemplate(id: string, vehicleIds: string[]): Promise<ApplyChecklistTemplateResult> {
  const res = await fetch(`${BASE}/${id}/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ vehicleIds }),
  });
  if (!res.ok) return throwApiError(res, 'No se pudo aplicar la plantilla');
  return res.json() as Promise<ApplyChecklistTemplateResult>;
}

/** CAM-159: borra de cada vehículo los controles que se copiaron de la plantilla. */
export async function unapplyChecklistTemplate(id: string, vehicleIds: string[]): Promise<UnapplyChecklistTemplateResult> {
  const res = await fetch(`${BASE}/${id}/unapply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ vehicleIds }),
  });
  if (!res.ok) return throwApiError(res, 'No se pudo quitar la plantilla');
  return res.json() as Promise<UnapplyChecklistTemplateResult>;
}

/** "Se quitaron 3 controles de 2 vehículos." */
export function describeUnapplyResult(result: UnapplyChecklistTemplateResult): string {
  const count = result.vehicles.length;
  const from = count === 1 ? result.vehicles[0].plate : `${count} vehículos`;
  if (result.removed === 0) {
    return count === 1 ? `${from} no tenía controles de esta plantilla.` : `Esos ${from} no tenían controles de esta plantilla.`;
  }
  return `Se ${result.removed === 1 ? 'quitó 1 control' : `quitaron ${result.removed} controles`} de ${from}.`;
}

/** "Se agregaron 2 controles; 1 ya estaba." */
export function describeApplyResult(result: ApplyChecklistTemplateResult): string {
  const added =
    result.added === 0
      ? 'No se agregó ningún control'
      : result.added === 1
        ? 'Se agregó 1 control'
        : `Se agregaron ${result.added} controles`;
  if (result.skipped === 0) return `${added}.`;
  return `${added}; ${result.skipped === 1 ? '1 ya estaba' : `${result.skipped} ya estaban`} y no se duplicó.`;
}
