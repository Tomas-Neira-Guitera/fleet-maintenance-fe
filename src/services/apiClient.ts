// Base compartida por los servicios: URL de la API, la sesión de CAM-43 (token + rol) y manejo
// de errores del backend.

import type { LoginResult } from '../types/domain';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

const SESSION_STORAGE_KEY = 'fleetguard.session';
const USERNAME_STORAGE_KEY = 'fleetguard.username';

export function saveSession(session: LoginResult): void {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_STORAGE_KEY);
  localStorage.removeItem(USERNAME_STORAGE_KEY);
}

/**
 * Nombre tipeado en el login -- no viene de `LoginResult` (el backend no lo devuelve). Es solo para
 * mostrar: quién hizo cada cosa lo decide el backend con el token (CAM-85).
 */
export function saveUsername(username: string): void {
  localStorage.setItem(USERNAME_STORAGE_KEY, username);
}

export function getUsername(): string | null {
  return localStorage.getItem(USERNAME_STORAGE_KEY);
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

/**
 * Id del usuario logueado, leído del claim `sub` del JWT (CAM-60) -- `LoginResult` no lo
 * trae aparte. Solo decodifica el payload para saber "quién soy"; no valida la firma
 * (eso es trabajo del backend).
 */
export function getSessionUserId(): string | null {
  const sub = sessionTokenClaims()?.sub;
  return typeof sub === 'string' ? sub : null;
}

/**
 * true si el JWT ya venció según su claim `exp` (CAM-119): al cerrar una sesión vencida no se dan de
 * baja las push del dispositivo, que siguen siendo del mismo usuario.
 */
export function isSessionTokenExpired(): boolean {
  const exp = sessionTokenClaims()?.exp;
  return typeof exp === 'number' && exp * 1000 <= Date.now();
}

function sessionTokenClaims(): { sub?: unknown; exp?: unknown } | null {
  const payload = getSession()?.token?.split('.')[1];
  if (!payload) return null;
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=');
    const json = new TextDecoder().decode(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)));
    return JSON.parse(json) as { sub?: unknown; exp?: unknown };
  } catch {
    return null;
  }
}

/**
 * Header Authorization con el JWT de CAM-43. El backend lo exige en usuarios (CAM-23), gastos
 * (CAM-52) e inspecciones (CAM-85); en el resto todavía no lo valida (CAM-73), pero ya lo pide
 * el contrato.
 */
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

/** true si el backend rechazó el JWT (401): sin token, vencido o de un usuario desactivado (CAM-23). */
export function isSessionExpired(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401;
}

export const SESSION_EXPIRED_MESSAGE = 'Tu sesión venció. Cerrá sesión y volvé a entrar.';

/** Junta el mensaje del backend con el detalle por campo de un 422, si vino. */
export function describeApiError(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) return fallback;
  const details = err.details?.map((d) => d.message).filter(Boolean) ?? [];
  return details.length > 0 ? `${err.message}: ${details.join('. ')}.` : err.message;
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
