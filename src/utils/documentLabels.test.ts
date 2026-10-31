import { describe, expect, it } from 'vitest';
import { describeExpiry, inferDocumentType } from './documentLabels';

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

describe('inferDocumentType (CAM-127)', () => {
  it('reconoce los documentos conocidos igual que el backend', () => {
    expect(inferDocumentType('VTV')).toBe('vtv');
    expect(inferDocumentType('Revisión técnica obligatoria (RTO)')).toBe('vtv');
    expect(inferDocumentType('Póliza La Segunda')).toBe('seguro');
    expect(inferDocumentType('cédula AZUL de Juan')).toBe('cedula_azul');
    expect(inferDocumentType('Habilitación de carga RUTA')).toBe('habilitacion_carga');
    expect(inferDocumentType('Permiso municipal')).toBe('otro');
    expect(inferDocumentType('Subtitulo')).toBe('otro');
  });
});

