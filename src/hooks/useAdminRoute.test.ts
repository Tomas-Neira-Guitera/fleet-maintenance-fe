import { describe, expect, it } from 'vitest';
import { adminPath, parseAdminPath } from './useAdminRoute';

describe('rutas del detalle del vehículo (CAM-127)', () => {
  it('cada pestaña tiene su dirección; el resumen es la del vehículo a secas', () => {
    expect(adminPath({ view: 'vehicle', vehicleId: 'v-1' })).toBe('/vehiculos/v-1');
    expect(adminPath({ view: 'vehicle', vehicleId: 'v-1', tab: 'resumen' })).toBe('/vehiculos/v-1');
    expect(adminPath({ view: 'vehicle', vehicleId: 'v-1', tab: 'documentacion' })).toBe('/vehiculos/v-1/documentacion');
  });

  it('lee la pestaña de la dirección, como la del aviso de un documento por vencer', () => {
    expect(parseAdminPath('/vehiculos/v-1/documentacion')).toEqual({ view: 'vehicle', vehicleId: 'v-1', tab: 'documentacion' });
    expect(parseAdminPath('/vehiculos/v-1/historial/')).toEqual({ view: 'vehicle', vehicleId: 'v-1', tab: 'historial' });
    expect(parseAdminPath('/vehiculos/v-1')).toEqual({ view: 'vehicle', vehicleId: 'v-1', tab: 'resumen' });
    expect(parseAdminPath('/vehiculos/v-1/otra')).toBeNull();
  });

  it('un admin que escanea el QR de un camión (CAM-133) ve ese vehículo', () => {
    expect(parseAdminPath('/inspeccion/v-1')).toEqual({ view: 'vehicle', vehicleId: 'v-1', tab: 'resumen' });
  });
});
