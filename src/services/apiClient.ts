// Base compartida por los servicios: URL de la API, identidad del chofer (stub sin login real)
// y manejo de errores del backend.

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

/** Identidad de chofer temporal hasta que exista login real. */
export const CURRENT_DRIVER = { id: 'driver-demo-1', name: 'Carlos Gómez' };

export function driverHeaders(): Record<string, string> {
  return {
    'X-Driver-Id': CURRENT_DRIVER.id,
    'X-Driver-Name': CURRENT_DRIVER.name,
  };
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
