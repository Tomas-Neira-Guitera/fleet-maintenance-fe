import { afterEach, describe, expect, it, vi } from 'vitest';
import { inspectionUrl, isLocalUrl, parseInspectionPath, publicAppUrl } from './publicUrl';

describe('dirección del QR (CAM-133)', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('usa la dirección pública configurada, sin la barra final', () => {
    vi.stubEnv('VITE_PUBLIC_APP_URL', 'https://flota.example.com/');
    expect(publicAppUrl()).toBe('https://flota.example.com');
    expect(inspectionUrl('veh-1')).toBe('https://flota.example.com/inspeccion/veh-1');
  });

  it('sin configurar usa la dirección desde la que se abrió la app', () => {
    vi.stubEnv('VITE_PUBLIC_APP_URL', '');
    expect(inspectionUrl('veh-1')).toBe(`${window.location.origin}/inspeccion/veh-1`);
  });

  it('reconoce las direcciones que solo sirven en esta máquina', () => {
    expect(isLocalUrl('http://localhost:5173/inspeccion/x')).toBe(true);
    expect(isLocalUrl('http://127.0.0.1/inspeccion/x')).toBe(true);
    expect(isLocalUrl('https://flota.example.com/inspeccion/x')).toBe(false);
    expect(isLocalUrl('no es una url')).toBe(true);
  });

  it('lee el vehículo de la ruta del QR y nada más', () => {
    expect(parseInspectionPath('/inspeccion/2e44e05a-6af6-52c7')).toBe('2e44e05a-6af6-52c7');
    expect(parseInspectionPath('/inspeccion/abc/')).toBe('abc');
    expect(parseInspectionPath('/inspeccion/..%2Fusers')).toBeNull();
    expect(parseInspectionPath('/vehiculos/abc')).toBeNull();
  });
});
