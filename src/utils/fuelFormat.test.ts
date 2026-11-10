import { describe, expect, it } from 'vitest';
import { isFuelLoadValid, toFuelInput } from './fuelForm';
import { formatConsumption, formatCostPerKm, formatLiters, formatMonth, percentAbove } from './fuelFormat';

describe('formato del combustible (CAM-156)', () => {
  it('muestra litros, consumo y costo por km; sin tramos, un guion', () => {
    expect(formatLiters(120.5)).toBe('120,5 L');
    expect(formatConsumption(30)).toBe('30,0 L/100 km');
    expect(formatConsumption(null)).toBe('—');
    expect(formatCostPerKm(null)).toBe('—');
    expect(formatCostPerKm(360)).toContain('360,00');
  });

  it('nombra el mes y calcula cuánto más que el promedio', () => {
    expect(formatMonth('2026-06')).toBe('jun');
    expect(formatMonth('2026-06', 'long')).toBe('junio de 2026');
    expect(percentAbove(45, 30)).toBe(50);
  });
});

describe('formulario de una carga (CAM-156)', () => {
  const value = { loadedAt: '2026-11-10T14:35', odometerKm: '152300', liters: '120.5', amount: '145000', fullTank: false };

  it('pide km, litros y monto mayores a 0', () => {
    expect(isFuelLoadValid(value)).toBe(true);
    expect(isFuelLoadValid({ ...value, liters: '0' })).toBe(false);
    expect(isFuelLoadValid({ ...value, amount: '' })).toBe(false);
    expect(isFuelLoadValid({ ...value, odometerKm: '' })).toBe(false);
  });

  it('manda números y la hora local como instante', () => {
    const input = toFuelInput('v-1', value);
    expect(input).toMatchObject({ vehicleId: 'v-1', liters: 120.5, amount: 145000, odometerKm: 152300, fullTank: false });
    expect(input.loadedAt).toBe(new Date('2026-11-10T14:35').toISOString());
  });
});
