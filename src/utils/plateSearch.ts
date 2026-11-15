/** Patente sin espacios, guiones ni puntos, en mayúsculas: "ab 123-cd" y "AB123CD" son la misma. */
function normalizePlate(text: string): string {
  return text.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Si la patente contiene lo buscado. Sin nada para buscar, todas coinciden. */
export function matchesPlate(plate: string, query: string): boolean {
  const wanted = normalizePlate(query);
  return wanted === '' || normalizePlate(plate).includes(wanted);
}
