// Base compartida por los servicios: URL de la API, identidad del chofer (stub sin login real),
// la sesión de CAM-43 (token + rol) y manejo de errores del backend.

import type { LoginResult } from '../types/domain';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

/**
 * Identidad de chofer temporal (CAM-11), previa al login. Convive con la sesión
 * de CAM-43 a propósito: el backend todavía no valida el JWT en ningún endpoint
 * salvo el propio login, así que esto sigue siendo lo único que el servidor
 * realmente usa para saber "quién" hace una inspección.
 */
export const CURRENT_DRIVER = { id: 'driver-demo-1', name: 'Carlos Gómez' };

export function driverHeaders(): Record<string, string> {
  return {
    'X-Driver-Id': CURRENT_DRIVER.id,
    'X-Driver-Name': CURRENT_DRIVER.name,
  };
}

const SESSION_STORAGE_KEY = 'fleetguard.session';

export function saveSession(session: LoginResult): void {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

export function getSession(): LoginResult | null {
  const raw = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LoginResult;
  } catch {
    return null;
  }
}

/** Header Authorization con el JWT de CAM-43 -- el backend todavía no lo valida, pero ya lo pide el contrato. */
export function authHeaders(): Record<string, string> {
  const session = getSession();
  return session ? { Authorization: `Bearer ${session.token}` } : {};
}

export interface ApiErrorDetail {
  itemId: string;
  message: string;
}

export class ApiError extends Error {
  status: number;
  errorCode?: string;
  details?: ApiErrorDetail[];

  constructor(status: number, message: string, errorCode?: string, details?: ApiErrorDetail[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errorCode = errorCode;
    this.details = details;
  }
}

export async function throwApiError(res: Response, fallbackMessage: string): Promise<never> {
  let body: { error?: string; message?: string; details?: ApiErrorDetail[] } | undefined;
  try {
    body = await res.json();
  } catch {
    // sin body JSON, se usa el mensaje por defecto
  }
  throw new ApiError(res.status, body?.message ?? fallbackMessage, body?.error, body?.details);
}
