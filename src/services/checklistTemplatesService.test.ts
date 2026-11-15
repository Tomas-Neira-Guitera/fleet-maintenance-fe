import { describe, expect, it } from 'vitest';
import { describeApplyResult } from './checklistTemplatesService';

const result = (added: number, skipped: number) => ({ templateId: 't-1', added, skipped, vehicles: [] });

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
