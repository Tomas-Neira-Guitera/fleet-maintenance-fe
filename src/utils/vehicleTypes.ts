// Espejo de VehicleType del backend: el tipo define los ejes, las cubiertas y qué remolque arrastra (CAM-157).

export type VehicleTypeCode =
  | 'utilitario'
  | 'camion_4x2'
  | 'camion_6x4'
  | 'tractor_4x2'
  | 'tractor_6x4'
  | 'semirremolque_2_ejes'
  | 'semirremolque_3_ejes'
  | 'acoplado';

type Kind = 'motor' | 'rigid' | 'tractor' | 'semitrailer' | 'full_trailer';

export interface VehicleTypeDef {
  code: VehicleTypeCode;
  label: string;
  kind: Kind;
  /** Del delantero hacia atrás. */
  axles: ('simple' | 'dual')[];
  /** Para elegir: qué es cada uno en pocas palabras. */
  hint: string;
}

export const VEHICLE_TYPES: VehicleTypeDef[] = [
  { code: 'utilitario', label: 'Utilitario', kind: 'motor', axles: ['simple', 'simple'], hint: 'Furgón, pickup o camioneta · 4 cubiertas' },
  { code: 'camion_4x2', label: 'Camión rígido 4x2', kind: 'rigid', axles: ['simple', 'dual'], hint: 'Trasero dual · 6 cubiertas' },
  { code: 'camion_6x4', label: 'Camión rígido 6x2 / 6x4', kind: 'rigid', axles: ['simple', 'dual', 'dual'], hint: 'Dos ejes traseros duales · 10 cubiertas' },
  { code: 'tractor_4x2', label: 'Tractor 4x2', kind: 'tractor', axles: ['simple', 'dual'], hint: 'Trasero dual · 6 cubiertas' },
  { code: 'tractor_6x4', label: 'Tractor 6x4', kind: 'tractor', axles: ['simple', 'dual', 'dual'], hint: 'Dos ejes traseros duales · 10 cubiertas' },
  { code: 'semirremolque_2_ejes', label: 'Semirremolque 2 ejes', kind: 'semitrailer', axles: ['dual', 'dual'], hint: 'Lo arrastra un tractor · 8 cubiertas' },
  { code: 'semirremolque_3_ejes', label: 'Semirremolque 3 ejes', kind: 'semitrailer', axles: ['dual', 'dual', 'dual'], hint: 'Lo arrastra un tractor · 12 cubiertas' },
  { code: 'acoplado', label: 'Acoplado', kind: 'full_trailer', axles: ['dual', 'dual'], hint: 'Lo arrastra un camión rígido · 8 cubiertas' },
];

export function vehicleTypeDef(code: string | null | undefined): VehicleTypeDef | null {
  return VEHICLE_TYPES.find((t) => t.code === code) ?? null;
}

/** "Camión rígido 4x2", o "Sin definir" para los de cuando el tipo era texto libre. */
export function vehicleTypeLabel(code: string | null | undefined): string {
  return vehicleTypeDef(code)?.label ?? 'Sin definir';
}

export function isTrailer(code: string | null | undefined): boolean {
  const kind = vehicleTypeDef(code)?.kind;
  return kind === 'semitrailer' || kind === 'full_trailer';
}

/** Un tractor arrastra semirremolques; un camión rígido, acoplados. */
export function canTow(towing: string | null | undefined, trailer: string | null | undefined): boolean {
  const t = vehicleTypeDef(towing)?.kind;
  const r = vehicleTypeDef(trailer)?.kind;
  return (t === 'tractor' && r === 'semitrailer') || (t === 'rigid' && r === 'full_trailer');
}

export function canTowAny(code: string | null | undefined): boolean {
  const kind = vehicleTypeDef(code)?.kind;
  return kind === 'tractor' || kind === 'rigid';
}

export interface TypePosition {
  position: string;
  label: string;
  /** 1 el de adelante, 0 el auxilio. */
  axle: number;
}

/** Las posiciones de un tipo, en orden de eje y con el nombre que usa el backend (VehicleType.labelOf). */
export function positionsOf(code: string | null | undefined): TypePosition[] {
  const def = vehicleTypeDef(code);
  if (!def) return [];
  const trailer = isTrailer(def.code);
  const out: TypePosition[] = [];
  def.axles.forEach((wheels, i) => {
    const axle = i + 1;
    const base = (side: 'izq' | 'der') => {
      const word = side === 'izq' ? 'izquierda' : 'derecha';
      if (trailer || (axle > 1 && def.axles.length > 2)) return `Eje ${axle} ${word}`;
      return `${axle === 1 ? 'Delantera' : 'Trasera'} ${word}`;
    };
    if (wheels === 'simple') {
      out.push({ position: `e${axle}-izq`, label: base('izq'), axle }, { position: `e${axle}-der`, label: base('der'), axle });
    } else {
      out.push(
        { position: `e${axle}-izq-ext`, label: `${base('izq')} exterior`, axle },
        { position: `e${axle}-izq-int`, label: `${base('izq')} interior`, axle },
        { position: `e${axle}-der-int`, label: `${base('der')} interior`, axle },
        { position: `e${axle}-der-ext`, label: `${base('der')} exterior`, axle },
      );
    }
  });
  out.push({ position: 'auxilio', label: 'Auxilio', axle: 0 });
  return out;
}
