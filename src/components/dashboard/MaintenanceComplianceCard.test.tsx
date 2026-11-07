import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getMaintenanceCompliance } from '../../services/downtimeService';
import type { MaintenanceCompliance } from '../../types/domain';
import { MaintenanceComplianceCard } from './MaintenanceComplianceCard';

vi.mock('../../services/downtimeService', () => ({ getMaintenanceCompliance: vi.fn() }));
const complianceMock = vi.mocked(getMaintenanceCompliance);

function compliance(overrides: Partial<MaintenanceCompliance> = {}): MaintenanceCompliance {
  return {
    from: '2026-11-01T00:00:00Z',
    to: '2026-12-01T00:00:00Z',
    preventive: { onTime: 9, late: 3, onTimePct: 75 },
    defects: { resolved: 4, avgHours: 30 },
    openWorkOrders: { total: 5, under7Days: 2, from7To30Days: 2, over30Days: 1 },
    ...overrides,
  };
}

describe('MaintenanceComplianceCard (CAM-155)', () => {
  it('muestra los tres indicadores del período', async () => {
    complianceMock.mockResolvedValue(compliance());
    render(<MaintenanceComplianceCard />);

    expect(await screen.findByText('75 %')).toBeInTheDocument();
    expect(screen.getByText('9 de 12 mantenimientos · 3 después de vencer')).toBeInTheDocument();
    expect(screen.getByText('1,3 días')).toBeInTheDocument();
    expect(screen.getByText(/4 resueltos/)).toBeInTheDocument();
    expect(screen.getByText('1 de más de 30')).toHaveClass('compliance-card__overdue');
  });

  it('sin datos del período lo dice en lugar de mostrar ceros', async () => {
    complianceMock.mockResolvedValue(
      compliance({ preventive: { onTime: 0, late: 0, onTimePct: null }, defects: { resolved: 0, avgHours: null } }),
    );
    render(<MaintenanceComplianceCard />);

    expect(await screen.findByText('No se resolvieron defectos en el período')).toBeInTheDocument();
    expect(screen.getAllByText('Sin datos')).toHaveLength(2);
  });
});
