// CAM-156: el valor del formulario de una carga de combustible y cómo se manda al backend.

export interface FuelLoadFieldsValue {
  /** Fecha y hora locales, "2026-11-10T14:35". */
  loadedAt: string;
  odometerKm: string;
  liters: string;
  amount: string;
  fullTank: boolean;
}

/** Litros, monto y km mayores a 0 (km puede ser 0) y una fecha cargada; el backend valida el resto. */
export function isFuelLoadValid(value: FuelLoadFieldsValue): boolean {
  const positive = (raw: string) => raw.trim() !== '' && Number(raw) > 0;
  return (
    Boolean(value.loadedAt) &&
    value.odometerKm.trim() !== '' &&
    Number(value.odometerKm) >= 0 &&
    positive(value.liters) &&
    positive(value.amount)
  );
}

export function toFuelInput(vehicleId: string, value: FuelLoadFieldsValue) {
  return {
    vehicleId,
    loadedAt: new Date(value.loadedAt).toISOString(),
    liters: Number(value.liters),
    amount: Number(value.amount),
    odometerKm: Math.floor(Number(value.odometerKm)),
    fullTank: value.fullTank,
  };
}
