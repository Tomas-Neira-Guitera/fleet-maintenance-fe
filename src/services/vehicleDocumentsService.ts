import type { VehicleDocument, VehicleDocuments, VehicleDocumentType } from '../types/domain';
import { API_BASE_URL, authHeaders, throwApiError } from './apiClient';

// CAM-127: documentación de un vehículo. Todo es solo del admin. Fechas en formato YYYY-MM-DD.

export interface VehicleDocumentInput {
  number?: string;
  issuedAt?: string;
  expiresAt?: string;
  fileUrl?: string;
}

export interface NewVehicleDocument extends VehicleDocumentInput {
  type: VehicleDocumentType;
  /** Solo para el tipo "otro". */
  name?: string;
}

/** En una corrección, "" borra el dato y lo ausente no cambia. */
export type VehicleDocumentCorrection = Partial<Record<'name' | 'number' | 'issuedAt' | 'expiresAt' | 'fileUrl', string>>;

function base(vehicleId: string) {
  return `${API_BASE_URL}/api/vehicles/${vehicleId}/documents`;
}

async function send<T>(url: string, method: string, body: unknown, fallback: string): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) return throwApiError(res, fallback);
  return res.json() as Promise<T>;
}

export async function getVehicleDocuments(vehicleId: string): Promise<VehicleDocuments> {
  const res = await fetch(base(vehicleId), { headers: authHeaders() });
  if (!res.ok) return throwApiError(res, 'No se pudo obtener la documentación del vehículo');
  return res.json() as Promise<VehicleDocuments>;
}

export function createVehicleDocument(vehicleId: string, data: NewVehicleDocument): Promise<VehicleDocument> {
  return send(base(vehicleId), 'POST', data, 'No se pudo cargar el documento');
}

/** Carga el documento que reemplaza al vigente; el anterior pasa al historial. */
export function renewVehicleDocument(vehicleId: string, documentId: string, data: VehicleDocumentInput): Promise<VehicleDocument> {
  return send(`${base(vehicleId)}/${documentId}/renewals`, 'POST', data, 'No se pudo renovar el documento');
}

/** Corrige un dato del vigente sin contarlo como renovación. */
export function correctVehicleDocument(
  vehicleId: string,
  documentId: string,
  data: VehicleDocumentCorrection,
): Promise<VehicleDocument> {
  return send(`${base(vehicleId)}/${documentId}`, 'PATCH', data, 'No se pudo corregir el documento');
}

export async function deleteVehicleDocument(vehicleId: string, documentId: string): Promise<void> {
  const res = await fetch(`${base(vehicleId)}/${documentId}`, { method: 'DELETE', headers: authHeaders() });
  if (!res.ok) return throwApiError(res, 'No se pudo dar de baja el documento');
}
