import { describe, expect, it } from 'vitest';
import { matchesPlate } from './plateSearch';

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
