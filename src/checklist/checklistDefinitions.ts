// Ítems fijos del checklist pre-viaje/post-viaje (CAM-11) — decisión de producto estable.
import type { ChecklistItemDef } from '../types/domain';

export const PRE_TRIP_EXTERIOR_ITEMS: ChecklistItemDef[] = [
  { id: 'ext-luces', label: 'Luces', type: 'check', section: 'exterior' },
  { id: 'ext-neumaticos', label: 'Neumáticos', type: 'check', section: 'exterior' },
  { id: 'ext-carroceria', label: 'Carrocería, vidrios y espejos', type: 'check', section: 'exterior' },
  { id: 'ext-fugas', label: 'Fugas visibles debajo del vehículo', type: 'check', section: 'exterior' },
];

export const PRE_TRIP_INTERIOR_BASE_ITEMS: ChecklistItemDef[] = [
  { id: 'int-km', label: 'Kilómetros actuales', type: 'number', section: 'interior', required: true },
  { id: 'int-documentacion', label: 'Documentación a bordo (seguro y VTV/RTO)', type: 'check', section: 'interior' },
  { id: 'int-testigos', label: 'Testigos de tablero', type: 'check', section: 'interior' },
];

export function getPreTripItems(): ChecklistItemDef[] {
  return [...PRE_TRIP_EXTERIOR_ITEMS, ...PRE_TRIP_INTERIOR_BASE_ITEMS];
}

export const POST_TRIP_ITEMS: ChecklistItemDef[] = [
  { id: 'post-danos', label: 'Daños nuevos en la carrocería', type: 'check', section: 'posttrip' },
  { id: 'post-luces', label: 'Luces', type: 'check', section: 'posttrip' },
  { id: 'post-fugas', label: 'Fugas visibles', type: 'check', section: 'posttrip' },
  { id: 'post-km', label: 'Kilómetros finales', type: 'number', section: 'posttrip', required: true },
];
