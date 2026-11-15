import { useCallback, useEffect, useState } from 'react';
import type { AdminTab } from '../components/dashboard/AdminShell';

// CAM-82: la pantalla del admin vive en la URL, así recargar no te devuelve al Resumen, se puede
// pasar el link de un vehículo y andan atrás/adelante del navegador. Ruteo propio con la History
// API en vez de una librería: son pocas rutas planas y no hace falta más que esto.

/** Pestañas del detalle de un vehículo (CAM-127); "resumen" es /vehiculos/{id} a secas. */
export type VehicleTab = 'resumen' | 'historial' | 'checklist' | 'documentacion' | 'combustible' | 'neumaticos';

export const VEHICLE_TABS: VehicleTab[] = [
  'resumen',
  'historial',
  'checklist',
  'documentacion',
  'combustible',
  'neumaticos',
];

/** Filtros de Defectos que viven en la URL: ocurridos en el viaje (CAM-146) y sin atender (CAM-142). */
export type DefectsFilter = 'on-trip' | 'unattended';

const DEFECTS_FILTER_PARAM: Record<DefectsFilter, string> = { 'on-trip': 'en-viaje', unattended: 'sin-atender' };

export type AdminRoute =
  | { view: 'tab'; tab: AdminTab }
  // filter: sin filtro son todos; "N sin atender" del Resumen lleva a /defectos?filtro=sin-atender.
  | { view: 'defects'; filter?: DefectsFilter }
  | { view: 'vehicle'; vehicleId: string; tab?: VehicleTab }
  // Gastos ya filtrada por un vehículo: el "Ver gastos" del detalle (CAM-105).
  | { view: 'vehicle-expenses'; vehicleId: string }
  // El detalle de una OT, abierto sobre la lista: el link del aviso de OT finalizada (CAM-98).
  | { view: 'work-order'; workOrderId: string }
  // Comparar vehículos (CAM-140), dentro de Vehículos.
  | { view: 'vehicle-comparison' }
  // Plantillas de checklist (CAM-150), dentro de Vehículos.
  | { view: 'checklist-templates' }
  // Inventario de cubiertas (CAM-157), dentro de Vehículos.
  | { view: 'tires' };

// Mismo criterio que el id de /vehiculos/{id}: solo letras, números y guiones.
const VEHICLE_ID = /^[A-Za-z0-9-]+$/;

const TAB_PATHS: Record<AdminTab, string> = {
  resumen: '/resumen',
  vehiculos: '/vehiculos',
  planes: '/planes',
  'ordenes-trabajo': '/ordenes-trabajo',
  gastos: '/gastos',
  usuarios: '/usuarios',
  notificaciones: '/notificaciones',
};

const DEFAULT_ROUTE: AdminRoute = { view: 'tab', tab: 'resumen' };

/** CAM-140. Va antes que /vehiculos/{id}: "comparar" también pasaría por un id. */
const COMPARISON_PATH = '/vehiculos/comparar';
/** CAM-150. Igual que COMPARISON_PATH, va antes que /vehiculos/{id}. */
const TEMPLATES_PATH = '/vehiculos/plantillas';
const TIRES_PATH = '/vehiculos/cubiertas';

export function adminPath(route: AdminRoute): string {
  if (route.view === 'defects') return route.filter ? `/defectos?filtro=${DEFECTS_FILTER_PARAM[route.filter]}` : '/defectos';
  if (route.view === 'vehicle-comparison') return COMPARISON_PATH;
  if (route.view === 'checklist-templates') return TEMPLATES_PATH;
  if (route.view === 'tires') return TIRES_PATH;
  if (route.view === 'vehicle') {
    return route.tab && route.tab !== 'resumen' ? `/vehiculos/${route.vehicleId}/${route.tab}` : `/vehiculos/${route.vehicleId}`;
  }
  if (route.view === 'vehicle-expenses') return `${TAB_PATHS.gastos}?vehiculo=${route.vehicleId}`;
  if (route.view === 'work-order') return `${TAB_PATHS['ordenes-trabajo']}/${route.workOrderId}`;
  return TAB_PATHS[route.tab];
}

/** null si la ruta no es del admin (incluida "/"); el que llama decide a dónde va. */
export function parseAdminPath(pathname: string, search = ''): AdminRoute | null {
  const path = pathname.replace(/\/+$/, '');
  if (path === '/defectos') {
    const param = new URLSearchParams(search).get('filtro');
    const filter = (Object.keys(DEFECTS_FILTER_PARAM) as DefectsFilter[]).find((f) => DEFECTS_FILTER_PARAM[f] === param);
    return filter ? { view: 'defects', filter } : { view: 'defects' };
  }
  if (path === COMPARISON_PATH) return { view: 'vehicle-comparison' };
  if (path === TEMPLATES_PATH) return { view: 'checklist-templates' };
  if (path === TIRES_PATH) return { view: 'tires' };
  if (path === TAB_PATHS.gastos) {
    const vehicleId = new URLSearchParams(search).get('vehiculo');
    if (vehicleId && VEHICLE_ID.test(vehicleId)) return { view: 'vehicle-expenses', vehicleId };
  }
  // Solo letras, números y guiones (los ids son UUID). El id sale de la URL, que puede armar
  // cualquiera, y los services lo interpolan crudo: "..%2Fusers" terminaría pidiendo otro endpoint.
  const vehicle = /^\/vehiculos\/([A-Za-z0-9-]+)(?:\/(historial|checklist|documentacion|combustible|neumaticos))?$/.exec(path);
  if (vehicle) return { view: 'vehicle', vehicleId: vehicle[1], tab: (vehicle[2] as VehicleTab | undefined) ?? 'resumen' };
  // CAM-133: el QR del camión lleva a su inspección; un admin que lo escanea ve el vehículo.
  const scanned = /^\/inspeccion\/([A-Za-z0-9-]+)$/.exec(path);
  if (scanned) return { view: 'vehicle', vehicleId: scanned[1], tab: 'resumen' };
  const workOrder = /^\/ordenes-trabajo\/([A-Za-z0-9-]+)$/.exec(path);
  if (workOrder) return { view: 'work-order', workOrderId: workOrder[1] };
  const tab = (Object.keys(TAB_PATHS) as AdminTab[]).find((t) => TAB_PATHS[t] === path);
  return tab ? { view: 'tab', tab } : null;
}

function currentRoute(): AdminRoute {
  return parseAdminPath(window.location.pathname, window.location.search) ?? DEFAULT_ROUTE;
}

const currentPath = () => window.location.pathname + window.location.search;

export function useAdminRoute(): [AdminRoute, (route: AdminRoute) => void] {
  const [route, setRoute] = useState<AdminRoute>(currentRoute);

  useEffect(() => {
    // Una URL desconocida (o "/" recién logueado) se reemplaza, no se apila: atrás no tiene que
    // volver a una dirección que no lleva a ningún lado.
    const path = adminPath(currentRoute());
    if (currentPath() !== path) window.history.replaceState(null, '', path);

    function handlePopState() {
      setRoute(currentRoute());
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((next: AdminRoute) => {
    const path = adminPath(next);
    if (currentPath() !== path) window.history.pushState(null, '', path);
    setRoute(next);
  }, []);

  return [route, navigate];
}
