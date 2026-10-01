import type {
  ChecklistItemDef,
  ChecklistSection,
  InspectionType,
  VehicleChecklistItem,
} from '../types/domain';
import { API_BASE_URL, authHeaders, throwApiError } from './apiClient';

/** GET /api/vehicles/{id}/checklist -- checklist propio del vehículo que completa el chofer (CAM-31). */
export async function getVehicleChecklist(vehicleId: string, type: InspectionType): Promise<ChecklistItemDef[]> {
  const res = await fetch(`${API_BASE_URL}/api/vehicles/${vehicleId}/checklist?type=${type}`, {
    headers: authHeaders(),
  });
  if (!res.ok) return throwApiError(res, 'No se pudo obtener el checklist del vehículo');
  const body = (await res.json()) as { items: ChecklistItemDef[] };
  return body.items;
}

/** GET /api/vehicles/{id}/checklist-items -- configuración del checklist pre-viaje (admin). */
export async function getVehicleChecklistConfig(vehicleId: string): Promise<VehicleChecklistItem[]> {
  const res = await fetch(`${API_BASE_URL}/api/vehicles/${vehicleId}/checklist-items`, { headers: authHeaders() });
  if (!res.ok) return throwApiError(res, 'No se pudo obtener la configuración del checklist');
  const body = (await res.json()) as { items: VehicleChecklistItem[] };
  return body.items;
}

export interface NewChecklistItem {
  label: string;
  section: Exclude<ChecklistSection, 'posttrip'>;
  /** false = queda cargado en el vehículo pero no entra en el checklist del chofer. */
  enabled: boolean;
}

export async function addVehicleChecklistItem(vehicleId: string, item: NewChecklistItem): Promise<VehicleChecklistItem> {
  const res = await fetch(`${API_BASE_URL}/api/vehicles/${vehicleId}/checklist-items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(item),
  });
  if (!res.ok) return throwApiError(res, 'No se pudo agregar el ítem');
  return res.json() as Promise<VehicleChecklistItem>;
}

/** DELETE /api/vehicles/{id}/checklist-items/{itemId} -- elimina del vehículo un ítem agregado. */
export async function deleteVehicleChecklistItem(vehicleId: string, itemId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/vehicles/${vehicleId}/checklist-items/${encodeURIComponent(itemId)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) return throwApiError(res, 'No se pudo eliminar el ítem');
}

/** Quitar del checklist (enabled=false) o volver a incluir un ítem, sea del checklist base o agregado. */
export async function setVehicleChecklistItemEnabled(
  vehicleId: string,
  itemId: string,
  enabled: boolean,
): Promise<VehicleChecklistItem> {
  const res = await fetch(`${API_BASE_URL}/api/vehicles/${vehicleId}/checklist-items/${encodeURIComponent(itemId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) return throwApiError(res, 'No se pudo actualizar el ítem');
  return res.json() as Promise<VehicleChecklistItem>;
}
