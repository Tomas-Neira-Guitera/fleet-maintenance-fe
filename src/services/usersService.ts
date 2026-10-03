import type { Role, UserSummary } from '../types/domain';
import { API_BASE_URL, authHeaders, throwApiError } from './apiClient';

// /api/users es el único recurso que hoy valida el JWT y exige rol ADMIN (CAM-23): sin sesión
// válida responde 401 (ver isSessionExpired en apiClient), con otro rol 403.

/** GET /api/users -- todos los usuarios, o solo los de un rol (el selector de técnico de una OT, CAM-60). */
export async function getUsers(role?: Role): Promise<UserSummary[]> {
  const qs = role ? `?role=${role}` : '';
  const res = await fetch(`${API_BASE_URL}/api/users${qs}`, { headers: authHeaders() });
  if (!res.ok) return throwApiError(res, 'No se pudieron obtener los usuarios');
  const data = (await res.json()) as { items: UserSummary[] };
  return data.items;
}

export interface CreateUserInput {
  username: string;
  password: string;
  role: Role;
}

/** POST /api/users -- alta de un usuario, nace activo (CAM-23). */
export async function createUser(input: CreateUserInput): Promise<UserSummary> {
  const res = await fetch(`${API_BASE_URL}/api/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(input),
  });
  if (!res.ok) return throwApiError(res, 'No se pudo crear el usuario');
  return res.json() as Promise<UserSummary>;
}

/** PATCH /api/users/{id} -- cambiar rol, resetear contraseña, activar o desactivar (CAM-23). */
export async function updateUser(
  id: string,
  changes: { role?: Role; password?: string; active?: boolean },
): Promise<UserSummary> {
  const res = await fetch(`${API_BASE_URL}/api/users/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(changes),
  });
  if (!res.ok) return throwApiError(res, 'No se pudo actualizar el usuario');
  return res.json() as Promise<UserSummary>;
}
