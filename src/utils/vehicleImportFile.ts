// CAM-154: leer la planilla de la flota en el navegador. Acepta CSV (con "," o ";", que es lo que guarda
// Excel en español) y .xlsx. El backend valida cada fila igual que el alta manual.

import type { CreateVehicleData } from '../services/vehiclesService';
import { csvField } from './expensesCsv';

export type CellValue = string | number | boolean | Date | null | undefined;

/** Una fila lista para mandar, con su número de línea en el archivo y lo que no se pudo leer. */
export interface ImportRow {
  line: number;
  data: CreateVehicleData;
  /** Valores que no se pudieron interpretar (un año o unos km que no son números). */
  parseErrors: string[];
}

export interface ParsedImport {
  rows: ImportRow[];
  /** Columnas obligatorias que no están en el encabezado. */
  missingColumns: string[];
}

type Field = keyof CreateVehicleData;

const COLUMNS: { field: Field; label: string; aliases: string[]; required?: boolean }[] = [
  { field: 'plate', label: 'Patente', aliases: ['patente', 'dominio'], required: true },
  { field: 'brand', label: 'Marca', aliases: ['marca'], required: true },
  { field: 'model', label: 'Modelo', aliases: ['modelo'], required: true },
  { field: 'year', label: 'Año', aliases: ['ano', 'anio', 'year'] },
  {
    field: 'chassisNumber',
    label: 'Número de chasis',
    aliases: ['numerodechasis', 'nrodechasis', 'nrochasis', 'numerochasis', 'chasis', 'nchasis'],
  },
  { field: 'vehicleType', label: 'Tipo', aliases: ['tipo', 'tipodevehiculo'] },
  { field: 'odometerKm', label: 'Km actual', aliases: ['kmactual', 'km', 'kilometraje', 'kilometrajeactual', 'kilometros'] },
];

/** "Número de chasis" -> "numerodechasis": sin acentos, mayúsculas ni signos. */
function normalizeHeader(value: CellValue): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function text(value: CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

/** "185.000", "185000" o 185000 -> 185000. Un número con decimales se redondea para abajo. */
function parseInteger(value: CellValue): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.floor(value) : null;
  const raw = text(value).replace(/\s/g, '');
  if (!raw) return null;
  const normalized = /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(raw) ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.floor(parsed) : NaN;
}

export function parseImportTable(table: CellValue[][]): ParsedImport {
  const nonEmpty = table.map((row, index) => ({ row, line: index + 1 })).filter(({ row }) => row.some((c) => text(c)));
  const header = nonEmpty[0];
  if (!header) return { rows: [], missingColumns: COLUMNS.filter((c) => c.required).map((c) => c.label) };

  const headers = header.row.map(normalizeHeader);
  const indexOf = new Map<Field, number>();
  for (const column of COLUMNS) {
    const index = headers.findIndex((h) => column.aliases.includes(h));
    if (index >= 0) indexOf.set(column.field, index);
  }
  const missingColumns = COLUMNS.filter((c) => c.required && !indexOf.has(c.field)).map((c) => c.label);

  const rows = nonEmpty.slice(1).map(({ row, line }) => {
    const cell = (field: Field): CellValue => {
      const index = indexOf.get(field);
      return index === undefined ? undefined : row[index];
    };
    const parseErrors: string[] = [];
    const year = parseInteger(cell('year'));
    const km = parseInteger(cell('odometerKm'));
    if (Number.isNaN(year)) parseErrors.push(`El año "${text(cell('year'))}" no es un número`);
    if (Number.isNaN(km)) parseErrors.push(`Los km "${text(cell('odometerKm'))}" no son un número`);
    const data: CreateVehicleData = {
      plate: text(cell('plate')),
      brand: text(cell('brand')),
      model: text(cell('model')),
      vehicleType: text(cell('vehicleType')) || undefined,
      year: year === null || Number.isNaN(year) ? undefined : year,
      chassisNumber: text(cell('chassisNumber')) || undefined,
      odometerKm: km === null || Number.isNaN(km) ? undefined : km,
    };
    return { line, data, parseErrors };
  });
  return { rows, missingColumns };
}

/** Separa un CSV en filas y columnas, respetando las comillas. El separador sale de la primera línea. */
export function parseCsv(content: string): string[][] {
  const textContent = content.replace(/^﻿/, '');
  const firstLine = textContent.split(/\r?\n/, 1)[0] ?? '';
  const separator = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < textContent.length; i++) {
    const char = textContent[i];
    if (quoted) {
      if (char === '"' && textContent[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === separator) {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && textContent[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Lee el archivo elegido. El lector de Excel se carga recién acá, para no sumarlo al resto de la app. */
export async function readImportFile(file: File): Promise<ParsedImport> {
  if (/\.xlsx$/i.test(file.name)) {
    const { readSheet } = await import('read-excel-file/browser');
    return parseImportTable((await readSheet(file)) as CellValue[][]);
  }
  return parseImportTable(parseCsv(await file.text()));
}

/** La planilla de ejemplo: las columnas que se leen y una fila de muestra, para abrir con Excel. */
export function buildImportTemplate(): string {
  const example = ['AB123CD', 'Mercedes-Benz', 'Atego 1726', '2019', '9BM958074KB123456', 'Camión rígido 4x2', '185000'];
  const lines = [COLUMNS.map((c) => c.label), example].map((cells) => cells.map(csvField).join(';'));
  return `﻿${lines.join('\r\n')}\r\n`;
}
