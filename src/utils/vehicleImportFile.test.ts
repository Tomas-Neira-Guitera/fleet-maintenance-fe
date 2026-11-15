import { describe, expect, it } from 'vitest';
import { buildImportTemplate, parseCsv, parseImportTable } from './vehicleImportFile';

describe('parseCsv (CAM-154)', () => {
  it('detecta el ";" de Excel en español, saca el BOM y respeta las comillas', () => {
    const csv = '﻿Patente;Marca;Modelo\r\nAB123CD;"Mercedes; Benz";"Atego ""1726"""\r\n';

    expect(parseCsv(csv)).toEqual([
      ['Patente', 'Marca', 'Modelo'],
      ['AB123CD', 'Mercedes; Benz', 'Atego "1726"'],
    ]);
  });

  it('con "," también, y sin salto de línea al final', () => {
    expect(parseCsv('patente,marca,modelo\nAC456EF,Iveco,Daily')).toEqual([
      ['patente', 'marca', 'modelo'],
      ['AC456EF', 'Iveco', 'Daily'],
    ]);
  });
});

describe('parseImportTable (CAM-154)', () => {
  it('reconoce los encabezados con o sin acentos y en cualquier orden', () => {
    const { rows, missingColumns } = parseImportTable([
      ['Km actual', 'MARCA', 'Modelo', 'Patente', 'Año', 'Número de chasis', 'Tipo'],
      ['185.000', 'Mercedes-Benz', 'Atego', 'AB123CD', '2019', '9BM958', 'Camión'],
    ]);

    expect(missingColumns).toEqual([]);
    expect(rows[0]).toEqual({
      line: 2,
      parseErrors: [],
      data: {
        plate: 'AB123CD',
        brand: 'Mercedes-Benz',
        model: 'Atego',
        year: 2019,
        chassisNumber: '9BM958',
        vehicleType: 'Camión',
        odometerKm: 185000,
      },
    });
  });

  it('acepta números de Excel y deja vacíos los opcionales', () => {
    const { rows } = parseImportTable([
      ['patente', 'marca', 'modelo', 'km'],
      ['AC456EF', 'Iveco', 'Daily', 98765.4],
    ]);

    expect(rows[0].data).toMatchObject({ odometerKm: 98765, year: undefined, vehicleType: undefined });
  });

  it('avisa las columnas obligatorias que faltan', () => {
    expect(parseImportTable([['Patente', 'Modelo'], ['AB123CD', 'Atego']]).missingColumns).toEqual(['Marca']);
  });

  it('marca un año o unos km que no son números y saltea las filas vacías', () => {
    const { rows } = parseImportTable([
      ['Patente', 'Marca', 'Modelo', 'Año', 'Km actual'],
      ['', '', '', '', ''],
      ['AB123CD', 'Ford', 'Cargo', 'dos mil', 'mucho'],
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].line).toBe(3);
    expect(rows[0].parseErrors).toEqual(['El año "dos mil" no es un número', 'Los km "mucho" no son un número']);
    expect(rows[0].data.year).toBeUndefined();
  });

  it('la planilla de ejemplo se vuelve a leer sin errores', () => {
    const { rows, missingColumns } = parseImportTable(parseCsv(buildImportTemplate()));

    expect(missingColumns).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0].parseErrors).toEqual([]);
    expect(rows[0].data.plate).toBe('AB123CD');
  });
});
