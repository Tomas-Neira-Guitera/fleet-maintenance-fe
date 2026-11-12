import { describe, expect, it } from 'vitest';
import { canTow, isTrailer, VEHICLE_TYPES, vehicleTypeLabel } from './vehicleTypes';

describe('catálogo de tipos de vehículo (CAM-157)', () => {
  it('cuenta las cubiertas como el backend', () => {
    const tires = (axles: string[]) => axles.reduce((n, a) => n + (a === 'dual' ? 4 : 2), 0);
    expect(Object.fromEntries(VEHICLE_TYPES.map((t) => [t.code, tires(t.axles)]))).toEqual({
      utilitario: 4,
      camion_4x2: 6,
      camion_6x4: 10,
      tractor_4x2: 6,
      tractor_6x4: 10,
      semirremolque_2_ejes: 8,
      semirremolque_3_ejes: 12,
      acoplado: 8,
    });
  });

  it('sabe qué arrastra cada uno y cuáles son remolques', () => {
    expect(canTow('tractor_4x2', 'semirremolque_3_ejes')).toBe(true);
    expect(canTow('tractor_4x2', 'acoplado')).toBe(false);
    expect(canTow('camion_6x4', 'acoplado')).toBe(true);
    expect(isTrailer('acoplado')).toBe(true);
    expect(isTrailer('utilitario')).toBe(false);
    expect(vehicleTypeLabel(null)).toBe('Sin definir');
  });
});
