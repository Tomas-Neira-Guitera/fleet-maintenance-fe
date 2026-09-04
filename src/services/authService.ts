import type { LoginResult } from '../types/domain';
import { API_BASE_URL, throwApiError } from './apiClient';

export async function login(username: string, password: string): Promise<LoginResult> {
  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) return throwApiError(res, 'No se pudo iniciar sesión');
  return res.json() as Promise<LoginResult>;
}
