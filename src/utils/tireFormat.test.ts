import { describe, expect, it } from 'vitest';
import { tireConditionLabel, tireHealth, tireLabel } from './tireFormat';

describe('formato de las cubiertas (CAM-157)', () => {
  it('arma el nombre como en los avisos', () => {
    expect(tireLabel({ brand: 'Michelin', model: 'X Multi', code: '1234' })).toBe('Michelin X Multi N° 1234');
    expect(tireLabel({ brand: 'Fate', model: null, code: null })).toBe('Fate');
  });

  it('nombra los estados y pinta según la severidad del defecto', () => {
    expect(tireConditionLabel('se-ve-la-tela')).toBe('Se ve la tela o el alambre');
    expect(tireHealth({ condition: null })).toBe('ok');
    expect(tireHealth(null)).toBe('ok');
    const report = {
      vehicleId: 'v-1', plate: 'AB123CD', position: 'e1-izq', positionLabel: 'Delantera izquierda',
      conditions: ['pinchada' as const], conditionLabels: ['Pinchada'], reportedAt: '2026-11-01T10:00:00Z',
      reportedBy: 'chofer1', defectId: 'd-1', active: true,
    };
    expect(tireHealth({ condition: { ...report, severity: 'non-blocking' } })).toBe('warn');
    expect(tireHealth({ condition: { ...report, severity: 'blocking' } })).toBe('crit');
  });
});
