import { describe, expect, it } from 'vitest';
import { describeTripKmAlert } from './tripKmAlert';

describe('describeTripKmAlert (CAM-152)', () => {
  it('dice cuánto recorrió el viaje contra el promedio', () => {
    expect(describeTripKmAlert({ reason: 'above_average', tripKm: 1250, averageKm: 400, declaredKm: 51250, vehicleKm: 50000 }))
      .toBe('Viaje de 1.250 km, más del doble del promedio (400 km)');
    expect(describeTripKmAlert({ reason: 'below_average', tripKm: 50, averageKm: 400, declaredKm: 50050, vehicleKm: 50000 }))
      .toBe('Viaje de 50 km, menos de la mitad del promedio (400 km)');
  });

  it('con un km menor al del vehículo dice los dos km, aunque no haya promedio', () => {
    expect(describeTripKmAlert({ reason: 'below_vehicle_km', tripKm: null, averageKm: null, declaredKm: 49000, vehicleKm: 50000 }))
      .toBe('Cargó 49.000 km, menos de los 50.000 km que ya tenía el vehículo');
  });
});
