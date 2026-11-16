import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyChecklistTemplate,
  getChecklistTemplates,
  unapplyChecklistTemplate,
} from '../../services/checklistTemplatesService';
import { getVehicles } from '../../services/vehiclesService';
import type { ChecklistTemplate, Vehicle } from '../../types/domain';
import { ApplyChecklistTemplateModal } from './ApplyChecklistTemplateModal';

vi.mock('../../services/checklistTemplatesService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/checklistTemplatesService')>()),
  applyChecklistTemplate: vi.fn(),
  unapplyChecklistTemplate: vi.fn(),
  getChecklistTemplates: vi.fn(),
}));
vi.mock('../../services/vehiclesService', () => ({ getVehicles: vi.fn() }));

const vehicle = (id: string, plate: string): Vehicle => ({
  id, plate, brand: 'Scania', model: 'R450', status: 'available', vehicleType: 'tractor_4x2', active: true,
});

const template: ChecklistTemplate = {
  id: 't-1',
  name: 'Tractor con semi',
  items: [{ id: 'i-1', label: 'Quinta rueda', type: 'check', section: 'exterior' }],
  createdAt: '2026-11-01T10:00:00Z',
  appliedVehicleIds: ['v-a'],
};

beforeEach(() => {
  vi.mocked(getVehicles).mockResolvedValue([vehicle('v-a', 'AA111AA'), vehicle('v-b', 'BB222BB')]);
  vi.mocked(getChecklistTemplates).mockResolvedValue([template]);
  vi.mocked(applyChecklistTemplate).mockResolvedValue({
    templateId: 't-1', added: 1, skipped: 0,
    vehicles: [{ vehicleId: 'v-b', plate: 'BB222BB', added: 1, skipped: 0, skippedLabels: [] }],
  });
  vi.mocked(unapplyChecklistTemplate).mockResolvedValue({
    templateId: 't-1', removed: 1, vehicles: [{ vehicleId: 'v-a', plate: 'AA111AA', removed: 1, removedLabels: ['Quinta rueda'] }],
  });
});

describe('aplicar o quitar una plantilla (CAM-159)', () => {
  it('los vehículos que la tienen arrancan tildados y sin cambios no hay nada que guardar', async () => {
    render(<ApplyChecklistTemplateModal template={template} onClose={vi.fn()} />);

    expect(await screen.findByRole('checkbox', { name: /AA111AA/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /BB222BB/ })).not.toBeChecked();
    expect(screen.getByText('Aplicada')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sin cambios' })).toBeDisabled();
  });

  it('tildar aplica, destildar quita, y avisa antes qué se borra', async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    render(<ApplyChecklistTemplateModal template={template} onClose={vi.fn()} onChanged={onChanged} />);

    await user.click(await screen.findByRole('checkbox', { name: /BB222BB/ }));
    await user.click(screen.getByRole('checkbox', { name: /AA111AA/ }));
    expect(screen.getByText(/Se borran de ese vehículo los controles que vinieron de esta plantilla/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Aplicar a 1 y quitar de 1' }));

    expect(applyChecklistTemplate).toHaveBeenCalledWith('t-1', ['v-b']);
    expect(unapplyChecklistTemplate).toHaveBeenCalledWith('t-1', ['v-a']);
    expect(await screen.findByText('Se quitó 1 control de AA111AA.')).toBeInTheDocument();
    expect(onChanged).toHaveBeenCalledWith({ added: 1, removed: 1 });
  });

  it('desde un vehículo que ya la tiene, el botón la quita', async () => {
    const user = userEvent.setup();
    render(<ApplyChecklistTemplateModal vehicle={{ id: 'v-a', plate: 'AA111AA' }} onClose={vi.fn()} />);

    await user.click(await screen.findByRole('button', { name: 'Quitar plantilla' }));

    expect(unapplyChecklistTemplate).toHaveBeenCalledWith('t-1', ['v-a']);
    expect(applyChecklistTemplate).not.toHaveBeenCalled();
  });
});
