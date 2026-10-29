import { describe, expect, it } from 'vitest';
import { describeExpiry } from './documentLabels';

describe('describeExpiry (CAM-127)', () => {
  it('dice cuánto falta o hace cuánto venció', () => {
    expect(describeExpiry(null)).toBeNull();
    expect(describeExpiry(10)).toBe('Vence en 10 días');
    expect(describeExpiry(1)).toBe('Vence mañana');
    expect(describeExpiry(0)).toBe('Vence hoy');
    expect(describeExpiry(-1)).toBe('Venció ayer');
    expect(describeExpiry(-29)).toBe('Venció hace 29 días');
  });
});
