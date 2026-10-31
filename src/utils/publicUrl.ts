// CAM-133: el QR de cada vehículo lleva a su inspección. La dirección queda impresa en el camión, así que
// sale de VITE_PUBLIC_APP_URL (el dominio del deploy); sin esa variable, de donde se abrió la app.
export function publicAppUrl(): string {
  const configured = import.meta.env.VITE_PUBLIC_APP_URL?.trim();
  return (configured || window.location.origin).replace(/\/+$/, '');
}

export function inspectionUrl(vehicleId: string): string {
  return `${publicAppUrl()}/inspeccion/${vehicleId}`;
}

/** Un QR que apunta a la propia máquina no sirve pegado en un camión. */
export function isLocalUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host.endsWith('.local');
  } catch {
    return true;
  }
}

/** /inspeccion/{vehicleId} -> el id, o null si la ruta es otra. Solo letras, números y guiones (CAM-82). */
export function parseInspectionPath(pathname: string): string | null {
  const match = /^\/inspeccion\/([A-Za-z0-9-]+)\/?$/.exec(pathname);
  return match ? match[1] : null;
}
