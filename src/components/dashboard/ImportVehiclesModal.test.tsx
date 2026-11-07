import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { importVehicles, type VehicleImportResult } from '../../services/vehiclesService';
import { ImportVehiclesModal } from './ImportVehiclesModal';

vi.mock('../../services/vehiclesService', () => ({ importVehicles: vi.fn() }));
const importMock = vi.mocked(importVehicles);

const CSV = 'Patente;Marca;Modelo;Año\r\nAB123CD;Ford;Cargo;2019\r\nAC456EF;;Daily;\r\n';

function preview(): VehicleImportResult {
  return {
    total: 2,
    valid: 1,
    created: 0,
    rows: [
      { row: 1, plate: 'AB123CD', valid: true, errors: [], vehicleId: null },
      { row: 2, plate: 'AC456EF', valid: false, errors: [{ field: 'brand', message: 'La marca es obligatoria' }], vehicleId: null },
    ],
  };
}

describe('ImportVehiclesModal (CAM-154)', () => {
  it('muestra la vista previa con los errores e importa solo las filas válidas', async () => {
    const user = userEvent.setup();
    const onImported = vi.fn();
    importMock.mockResolvedValueOnce(preview()).mockResolvedValueOnce({ ...preview(), created: 1 });
    render(<ImportVehiclesModal onClose={vi.fn()} onImported={onImported} />);

    await user.upload(screen.getByLabelText('Archivo de vehículos'), new File([CSV], 'flota.csv', { type: 'text/csv' }));

    expect(await screen.findByText('2 filas: 1 para importar, 1 con errores.')).toBeInTheDocument();
    expect(screen.getByText('La marca es obligatoria')).toBeInTheDocument();
    expect(importMock).toHaveBeenLastCalledWith(expect.any(Array), true);

    await user.click(screen.getByRole('button', { name: 'Importar 1 vehículo' }));

    expect(await screen.findByText('Se importó 1 vehículo.')).toBeInTheDocument();
    expect(importMock).toHaveBeenLastCalledWith(
      [{ plate: 'AB123CD', brand: 'Ford', model: 'Cargo', year: 2019, vehicleType: undefined, chassisNumber: undefined, odometerKm: undefined }],
      false,
    );
    expect(onImported).toHaveBeenCalledOnce();
  });

  it('sin las columnas obligatorias no llama al servidor', async () => {
    const user = userEvent.setup();
    render(<ImportVehiclesModal onClose={vi.fn()} onImported={vi.fn()} />);

    await user.upload(
      screen.getByLabelText('Archivo de vehículos'),
      new File(['Patente;Modelo\r\nAB123CD;Cargo\r\n'], 'flota.csv', { type: 'text/csv' }),
    );

    expect(await screen.findByText(/le faltan las columnas: Marca/)).toBeInTheDocument();
    expect(importMock).not.toHaveBeenCalled();
  });
});
