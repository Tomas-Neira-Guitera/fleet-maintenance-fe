import { describe, expect, it } from 'vitest';
import { describePause, formatPausedDuration, isOpenWorkOrder } from './workOrderFormat';

describe('OT en espera (CAM-148)', () => {
  it('cuenta como abierta, igual que asignada y en proceso', () => {
    expect(isOpenWorkOrder({ status: 'en_espera' })).toBe(true);
    expect(isOpenWorkOrder({ status: 'asignada' })).toBe(true);
    expect(isOpenWorkOrder({ status: 'en_proceso' })).toBe(true);
    expect(isOpenWorkOrder({ status: 'finalizada' })).toBe(false);
    expect(isOpenWorkOrder({ status: 'cancelada' })).toBe(false);
  });

  it('describe el motivo, con el comentario si hay', () => {
    expect(describePause({ reason: 'esperando_repuesto', comment: null, since: '2026-11-06T12:00:00Z' }))
      .toBe('Esperando repuesto');
    expect(describePause({ reason: 'otro', comment: 'Falta la firma del seguro', since: '2026-11-06T12:00:00Z' }))
      .toBe('Otro: Falta la firma del seguro');
  });

  it('muestra el tiempo en espera en minutos, horas o días', () => {
    expect(formatPausedDuration(0)).toBe('0 min');
    expect(formatPausedDuration(30)).toBe('menos de 1 min');
    expect(formatPausedDuration(45 * 60)).toBe('45 min');
    expect(formatPausedDuration(3 * 3600)).toBe('3 h');
    expect(formatPausedDuration(3 * 3600 + 20 * 60)).toBe('3 h 20 min');
    expect(formatPausedDuration(24 * 3600)).toBe('1 día');
    expect(formatPausedDuration(2 * 86400 + 5 * 3600)).toBe('2 días 5 h');
  });
});
