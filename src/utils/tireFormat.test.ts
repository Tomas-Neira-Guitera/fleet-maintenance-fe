import { describe, expect, it } from 'vitest';
import { formatTread, parseTreadInputs, tireLabel } from './tireFormat';

describe('formato de las cubiertas (CAM-157)', () => {
  it('arma el nombre como en los avisos', () => {
    expect(tireLabel({ brand: 'Michelin', model: 'X Multi', code: '1234' })).toBe('Michelin X Multi N° 1234');
    expect(tireLabel({ brand: 'Fate', model: null, code: null })).toBe('Fate');
    expect(formatTread(1.4)).toBe('1,4 mm');
  });

  it('lee el dibujo con coma o punto y saltea lo vacío', () => {
    expect(parseTreadInputs({ 'del-izq': '4,5', 'del-der': ' ', 'tras-izq': '8' })).toEqual([
      { position: 'del-izq', depthMm: 4.5 },
      { position: 'tras-izq', depthMm: 8 },
    ]);
    expect(parseTreadInputs({})).toEqual([]);
  });

  it('rechaza valores fuera de 0-30 mm o con más de un decimal', () => {
    expect(parseTreadInputs({ 'del-izq': '45' })).toBeNull();
    expect(parseTreadInputs({ 'del-izq': '4,55' })).toBeNull();
    expect(parseTreadInputs({ 'del-izq': 'abc' })).toBeNull();
  });
});
