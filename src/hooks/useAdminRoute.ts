import { useCallback, useEffect, useState } from 'react';
import type { AdminTab } from '../components/dashboard/AdminShell';

// CAM-82: la pantalla del admin vive en la URL, así recargar no te devuelve al Resumen, se puede
// pasar el link de un vehículo y andan atrás/adelante del navegador. Ruteo propio con la History
// API en vez de una librería: son pocas rutas planas y no hace falta más que esto.

export type AdminRoute =
  | { view: 'tab'; tab: AdminTab }
  | { view: 'defects' }
  | { view: 'vehicle'; vehicleId: string };

const TAB_PATHS: Record<AdminTab, string> = {
  resumen: '/resumen',
  vehiculos: '/vehiculos',
  planes: '/planes',
  'ordenes-trabajo': '/ordenes-trabajo',
  usuarios: '/usuarios',
};

const DEFAULT_ROUTE: AdminRoute = { view: 'tab', tab: 'resumen' };

export function adminPath(route: AdminRoute): string {
  if (route.view === 'defects') return '/defectos';
  if (route.view === 'vehicle') return `/vehiculos/${route.vehicleId}`;
  return TAB_PATHS[route.tab];
}

/** null si la ruta no es del admin (incluida "/"); el que llama decide a dónde va. */
export function parseAdminPath(pathname: string): AdminRoute | null {
  const path = pathname.replace(/\/+$/, '');
  if (path === '/defectos') return { view: 'defects' };
  // Solo letras, números y guiones (los ids son UUID). El id sale de la URL, que puede armar
  // cualquiera, y los services lo interpolan crudo: "..%2Fusers" terminaría pidiendo otro endpoint.
  const vehicle = /^\/vehiculos\/([A-Za-z0-9-]+)$/.exec(path);
  if (vehicle) return { view: 'vehicle', vehicleId: vehicle[1] };
  const tab = (Object.keys(TAB_PATHS) as AdminTab[]).find((t) => TAB_PATHS[t] === path);
  return tab ? { view: 'tab', tab } : null;
}

function currentRoute(): AdminRoute {
  return parseAdminPath(window.location.pathname) ?? DEFAULT_ROUTE;
}

export function useAdminRoute(): [AdminRoute, (route: AdminRoute) => void] {
  const [route, setRoute] = useState<AdminRoute>(currentRoute);

  useEffect(() => {
    // Una URL desconocida (o "/" recién logueado) se reemplaza, no se apila: atrás no tiene que
    // volver a una dirección que no lleva a ningún lado.
    const path = adminPath(currentRoute());
    if (window.location.pathname !== path) window.history.replaceState(null, '', path);

    function handlePopState() {
      setRoute(currentRoute());
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((next: AdminRoute) => {
    const path = adminPath(next);
    if (window.location.pathname !== path) window.history.pushState(null, '', path);
    setRoute(next);
  }, []);

  return [route, navigate];
}
