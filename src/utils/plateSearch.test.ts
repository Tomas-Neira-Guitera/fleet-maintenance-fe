import { describe, expect, it } from 'vitest';
import { matchesPlate, matchesVehicle } from './plateSearch';

describe('matchesVehicle', () => {
  const scania = { plate: 'AB123CD', brand: 'Scania', model: 'R450' };

  it('busca por patente, marca o modelo, sin importar mayúsculas ni tildes', () => {
    expect(matchesVehicle(scania, 'ab 123')).toBe(true);
    expect(matchesVehicle(scania, 'scania')).toBe(true);
    expect(matchesVehicle(scania, 'SCANIA r450')).toBe(true);
    expect(matchesVehicle({ plate: 'AC1', brand: 'Helvética', model: 'Tri-eje' }, 'helvetica')).toBe(true);
    expect(matchesVehicle(scania, 'iveco')).toBe(false);
  });

  it('sin búsqueda coinciden todos', () => {
    expect(matchesVehicle(scania, '')).toBe(true);
  });
});

describe('matchesPlate', () => {
  it('sin búsqueda coinciden todas', () => {
    expect(matchesPlate('AB123CD', '')).toBe(true);
    expect(matchesPlate('AB123CD', '  ')).toBe(true);
  });

  it('busca una parte de la patente', () => {
    expect(matchesPlate('AB123CD', '123')).toBe(true);
    expect(matchesPlate('AB123CD', '456')).toBe(false);
  });

  it('no distingue mayúsculas, espacios ni guiones', () => {
    expect(matchesPlate('AB 123 CD', 'ab123')).toBe(true);
    expect(matchesPlate('AB123CD', 'b-12 3c')).toBe(true);
  });
});
