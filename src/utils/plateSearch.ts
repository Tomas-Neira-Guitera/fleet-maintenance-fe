/** Patente sin espacios, guiones ni puntos, en mayúsculas: "ab 123-cd" y "AB123CD" son la misma. */
function normalizePlate(text: string): string {
  return text.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** CAM-159 (admin): por patente, o por marca y modelo ("iveco daily", "scania"). */
export function matchesVehicle(vehicle: { plate: string; brand: string; model: string }, query: string): boolean {
  if (matchesPlate(vehicle.plate, query)) return true;
  const wanted = normalizeText(query);
  return wanted !== '' && normalizeText(`${vehicle.brand} ${vehicle.model}`).includes(wanted);
}

/** Si la patente contiene lo buscado. Sin nada para buscar, todas coinciden. */
export function matchesPlate(plate: string, query: string): boolean {
  const wanted = normalizePlate(query);
  return wanted === '' || normalizePlate(plate).includes(wanted);
}
