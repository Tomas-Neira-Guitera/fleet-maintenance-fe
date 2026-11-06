import type { TripKmAlert } from '../types/domain';
import { numberFormatter } from './maintenanceFormat';

function km(value: number): string {
  return `${numberFormatter.format(value)} km`;
}

/**
 * CAM-152: por qué el viaje quedó marcado, para el post-viaje del historial. Ej. "Viaje de 1.250 km,
 * más del doble del promedio (400 km)".
 */
export function describeTripKmAlert(alert: TripKmAlert): string {
  switch (alert.reason) {
    case 'below_vehicle_km':
      return `Cargó ${km(alert.declaredKm)}, menos de los ${km(alert.vehicleKm)} que ya tenía el vehículo`;
    case 'above_average':
      return `Viaje de ${km(alert.tripKm ?? 0)}, más del doble del promedio (${km(alert.averageKm ?? 0)})`;
    case 'below_average':
      return `Viaje de ${km(alert.tripKm ?? 0)}, menos de la mitad del promedio (${km(alert.averageKm ?? 0)})`;
  }
}
