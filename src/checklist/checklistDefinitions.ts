// Fixed base checklist items — these are stable product decisions (CAM-11), not
// configuration, so they're hardcoded here rather than mocked as data. Only the
// *vehicle* and *trip* data are mocked (see src/mocks + src/services).
import type { AccessoryKey, ChecklistItemDef } from '../types/domain';

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

export const ACCESSORY_CHECKLIST_ITEMS: Record<AccessoryKey, ChecklistItemDef> = {
  faja: { id: 'accessory-faja', label: 'Estado y funcionamiento de la faja', type: 'check', section: 'accesorios' },
  traca: { id: 'accessory-traca', label: 'Estado y funcionamiento de la traca', type: 'check', section: 'accesorios' },
  grua: { id: 'accessory-grua', label: 'Estado y funcionamiento de la grúa', type: 'check', section: 'accesorios' },
  rampa: { id: 'accessory-rampa', label: 'Estado y funcionamiento de la rampa hidráulica', type: 'check', section: 'accesorios' },
};

export function getPreTripItems(accessories: AccessoryKey[]): ChecklistItemDef[] {
  const accessoryItems = accessories.map((key) => ACCESSORY_CHECKLIST_ITEMS[key]);
  return [...PRE_TRIP_EXTERIOR_ITEMS, ...PRE_TRIP_INTERIOR_BASE_ITEMS, ...accessoryItems];
}

export const POST_TRIP_ITEMS: ChecklistItemDef[] = [
  { id: 'post-danos', label: 'Daños nuevos en la carrocería', type: 'check', section: 'posttrip' },
  { id: 'post-luces', label: 'Luces', type: 'check', section: 'posttrip' },
  { id: 'post-fugas', label: 'Fugas visibles', type: 'check', section: 'posttrip' },
  { id: 'post-km', label: 'Kilómetros finales', type: 'number', section: 'posttrip', required: true },
];
