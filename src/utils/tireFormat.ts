import type { Tire, TireConditionCode, TireConditionInput, TireStatus } from '../types/domain';

// CAM-157: cómo se muestran las cubiertas y su estado.

export const TIRE_STATUS_LABEL: Record<TireStatus, string> = {
  stock: 'En stock',
  mounted: 'Montada',
  retired: 'Dada de baja',
};

/** Del más grave al más leve, como los devuelve el backend. */
export const TIRE_CONDITIONS: { code: TireConditionCode; label: string }[] = [
  { code: 'se-ve-la-tela', label: 'Se ve la tela o el alambre' },
  { code: 'bulto', label: 'Bulto o deformación' },
  { code: 'corte-flanco', label: 'Corte o daño en el flanco' },
  { code: 'pinchada', label: 'Pinchada' },
  { code: 'baja-presion', label: 'Baja presión o desinflada' },
  { code: 'desgaste-irregular', label: 'Desgaste irregular' },
  { code: 'poco-dibujo', label: 'Poco dibujo' },
];

export function tireConditionLabel(code: string): string {
  return TIRE_CONDITIONS.find((c) => c.code === code)?.label ?? code;
}

/** Cómo se pinta una cubierta: sin problemas, a revisar, o grave (su defecto es bloqueante). */
export type TireHealth = 'ok' | 'warn' | 'crit';

export function tireHealth(tire: Pick<Tire, 'condition'> | null | undefined): TireHealth {
  if (!tire?.condition) return 'ok';
  return tire.condition.severity === 'blocking' ? 'crit' : 'warn';
}

/** "Michelin X Multi N° 1234", igual que en los avisos. */
export function tireLabel(tire: Pick<Tire, 'brand' | 'model' | 'code'>): string {
  return [tire.brand, tire.model, tire.code ? `N° ${tire.code}` : null].filter(Boolean).join(' ');
}

/** Pre-viaje: por posición, lo que el chofer marcó. Una posición sin estados no se manda. */
export type TireConditionValue = Record<string, TireConditionCode[]>;

/** Las que tienen al menos un estado, en el formato que espera el backend. */
export function toTireConditions(value: TireConditionValue): TireConditionInput[] {
  return Object.entries(value)
    .filter(([, conditions]) => conditions.length > 0)
    .map(([position, conditions]) => ({ position, conditions }));
}
