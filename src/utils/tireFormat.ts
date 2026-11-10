import type { Tire, TireLayout, TireStatus } from '../types/domain';

// CAM-157: cómo se muestran cubiertas, configuraciones y dibujo.

export const TIRE_LAYOUT_LABEL: Record<TireLayout, string> = {
  '4_ruedas': '4 ruedas',
  '6_ruedas': '6 ruedas (trasero dual)',
  '10_ruedas': '10 ruedas (dos ejes traseros duales)',
};

export const TIRE_STATUS_LABEL: Record<TireStatus, string> = {
  stock: 'En stock',
  mounted: 'Montada',
  retired: 'Dada de baja',
};

const mmFormatter = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function formatTread(depthMm: number): string {
  return `${mmFormatter.format(depthMm)} mm`;
}

/** "Michelin X Multi N° 1234", igual que en los avisos. */
export function tireLabel(tire: Pick<Tire, 'brand' | 'model' | 'code'>): string {
  return [tire.brand, tire.model, tire.code ? `N° ${tire.code}` : null].filter(Boolean).join(' ');
}

/** Las mediciones que el chofer cargó: vacío no se manda; con coma o punto. Null si alguna no es válida. */
export function parseTreadInputs(values: Record<string, string>): { position: string; depthMm: number }[] | null {
  const readings: { position: string; depthMm: number }[] = [];
  for (const [position, raw] of Object.entries(values)) {
    const text = raw.trim().replace(',', '.');
    if (!text) continue;
    const depth = Number(text);
    if (!Number.isFinite(depth) || depth < 0 || depth > 30 || !/^\d+(\.\d)?$/.test(text)) return null;
    readings.push({ position, depthMm: depth });
  }
  return readings;
}
