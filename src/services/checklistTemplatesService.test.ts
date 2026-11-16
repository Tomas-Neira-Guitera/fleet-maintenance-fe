import { describe, expect, it } from 'vitest';
import { describeApplyResult, describeUnapplyResult } from './checklistTemplatesService';

const result = (added: number, skipped: number) => ({ templateId: 't-1', added, skipped, vehicles: [] });

const unapplied = (removed: number[]) => ({
  templateId: 't-1',
  removed: removed.reduce((a, b) => a + b, 0),
  vehicles: removed.map((n, i) => ({ vehicleId: `v-${i}`, plate: `AA${i}00AA`, removed: n, removedLabels: [] })),
});

describe('resultado de quitar una plantilla (CAM-159)', () => {
  it('dice cuántos controles se quitaron y de dónde', () => {
    expect(describeUnapplyResult(unapplied([3]))).toBe('Se quitaron 3 controles de AA000AA.');
    expect(describeUnapplyResult(unapplied([1]))).toBe('Se quitó 1 control de AA000AA.');
    expect(describeUnapplyResult(unapplied([2, 2]))).toBe('Se quitaron 4 controles de 2 vehículos.');
  });

  it('sin nada copiado de la plantilla, lo dice', () => {
    expect(describeUnapplyResult(unapplied([0]))).toBe('AA000AA no tenía controles de esta plantilla.');
    expect(describeUnapplyResult(unapplied([0, 0]))).toBe('Esos 2 vehículos no tenían controles de esta plantilla.');
  });
});

describe('resultado de aplicar una plantilla (CAM-150)', () => {
  it('dice lo agregado y, si hubo, lo que ya estaba', () => {
    expect(describeApplyResult(result(15, 0))).toBe('Se agregaron 15 controles.');
    expect(describeApplyResult(result(1, 2))).toBe('Se agregó 1 control; 2 ya estaban y no se duplicó.');
  });

  it('aplicarla otra vez no agrega nada y lo dice', () => {
    expect(describeApplyResult(result(0, 3))).toBe('No se agregó ningún control; 3 ya estaban y no se duplicó.');
    expect(describeApplyResult(result(0, 1))).toBe('No se agregó ningún control; 1 ya estaba y no se duplicó.');
  });
});
