import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { WorkOrder } from '../../types/domain';
import { formatDate, currencyFormatter, numberFormatter } from '../../utils/maintenanceFormat';
import { describePeriod } from '../../utils/period';
import { formatArgentinaDateTime, type CostLine, type VehicleHistoryReport } from '../../utils/vehicleHistoryReport';
import { WORK_ORDER_STATUS_LABEL, workOrderResponsible } from '../../utils/workOrderFormat';
import '../../styles/print.css';

function formatKm(km: number | null | undefined): string {
  return km == null ? '—' : `${numberFormatter.format(km)} km`;
}

/** En las externas, el taller y el contacto; en las internas, el técnico. */
function responsibleOf(wo: WorkOrder): string {
  const provider = wo.executionType === 'externo' ? wo.externalProvider : null;
  return [provider, workOrderResponsible(wo)].filter(Boolean).join(' · ') || '—';
}

interface SectionProps {
  title: string;
  count: number;
  emptyText: string;
  headers: string[];
  children: ReactNode;
}

function Section({ title, count, emptyText, headers, children }: SectionProps) {
  return (
    <section className="history-print__section">
      <h2>
        {title} ({count})
      </h2>
      {count === 0 ? (
        <p>{emptyText}</p>
      ) : (
        <table>
          <thead>
            <tr>
              {headers.map((header) => (
                <th key={header} scope="col">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      )}
    </section>
  );
}

function CostTable({ title, lines }: { title: string; lines: CostLine[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th scope="col">{title}</th>
          <th scope="col" className="history-print__amount">
            Monto
          </th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line) => (
          <tr key={line.label}>
            <td>{line.label}</td>
            <td className="history-print__amount">{currencyFormatter.format(line.amount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Documento que se imprime al exportar el historial (CAM-130). Va directo en <body>, afuera de #root:
 * en pantalla no se ve, y al imprimir print.css oculta la app y deja solo esto.
 */
export function VehicleHistoryPrint({ report }: { report: VehicleHistoryReport }) {
  const { vehicle, period, costs } = report;

  return createPortal(
    <article className="history-print">
      <header className="history-print__header">
        <p className="history-print__brand">FleetGuard · Historial del vehículo</p>
        <h1>
          {vehicle.plate} · {vehicle.brand} {vehicle.model}
        </h1>
        <dl>
          <div>
            <dt>Km actual</dt>
            <dd>{formatKm(vehicle.odometerKm ?? 0)}</dd>
          </div>
          <div>
            <dt>Período</dt>
            <dd>{describePeriod(period)}</dd>
          </div>
          <div>
            <dt>Emitido</dt>
            <dd>{formatArgentinaDateTime(report.issuedAt)}</dd>
          </div>
        </dl>
      </header>

      <Section
        title="Inspecciones"
        count={report.inspections.length}
        emptyText="Sin inspecciones en el período."
        headers={['Fecha', 'Tipo', 'Chofer', 'Km', 'Resultado']}
      >
        {report.inspections.map((inspection) => (
          <tr key={inspection.id}>
            <td>{formatArgentinaDateTime(inspection.timestamp)}</td>
            <td className="history-print__short">{inspection.type === 'pre-trip' ? 'Pre-viaje' : 'Post-viaje'}</td>
            <td className="history-print__short">{inspection.driverName ?? '—'}</td>
            <td className="history-print__short">{formatKm(inspection.odometerKm)}</td>
            <td>{inspection.hasBlockingDefect ? 'Con defecto bloqueante' : 'Sin defectos bloqueantes'}</td>
          </tr>
        ))}
      </Section>

      <Section
        title="Defectos"
        count={report.defects.length}
        emptyText="Sin defectos reportados en el período."
        headers={['Reportado', 'Defecto', 'Gravedad', 'Reportó', 'Resolución']}
      >
        {report.defects.map(({ defect, resolution }) => (
          <tr key={defect.id}>
            <td>{formatArgentinaDateTime(defect.createdAt)}</td>
            <td>
              {defect.description}
              {defect.details ? ` — ${defect.details}` : ''}
            </td>
            <td className="history-print__short">{defect.severity === 'blocking' ? 'Bloqueante' : 'No bloqueante'}</td>
            <td className="history-print__short">{defect.reportedBy ?? '—'}</td>
            <td>{resolution}</td>
          </tr>
        ))}
      </Section>

      <Section
        title="Órdenes de trabajo"
        count={report.workOrders.length}
        emptyText="Sin órdenes de trabajo en el período."
        headers={['Creada', 'Orden', 'Estado', 'Técnico o taller', 'Cierre', 'Gasto total']}
      >
        {report.workOrders.map((wo) => (
          <tr key={wo.id}>
            <td>{formatArgentinaDateTime(wo.createdAt)}</td>
            <td>{wo.title}</td>
            <td className="history-print__short">{WORK_ORDER_STATUS_LABEL[wo.status]}</td>
            <td>{responsibleOf(wo)}</td>
            <td>
              {wo.finalizedAt ? formatArgentinaDateTime(wo.finalizedAt) : '—'}
              {wo.closingDescription ? ` — ${wo.closingDescription}` : ''}
            </td>
            <td className="history-print__amount">{currencyFormatter.format(wo.totalExpenses)}</td>
          </tr>
        ))}
      </Section>

      <Section
        title="Mantenimientos realizados"
        count={report.maintenance.length}
        emptyText="Sin mantenimientos realizados en el período."
        headers={['Fecha', 'Plan', 'Km', 'Notas']}
      >
        {report.maintenance.map((item) => (
          <tr key={item.id}>
            <td>{formatDate(item.completedAt)}</td>
            <td>{item.planName}</td>
            <td className="history-print__short">{formatKm(item.completedKm)}</td>
            <td>{item.notes ?? '—'}</td>
          </tr>
        ))}
      </Section>

      <section className="history-print__section">
        <h2>Resumen de costos del período</h2>
        {costs.count === 0 ? (
          <p>Sin gastos cargados en el período.</p>
        ) : (
          <>
            <p>
              Total: <strong>{currencyFormatter.format(costs.total)}</strong> en {costs.count}{' '}
              {costs.count === 1 ? 'gasto cargado' : 'gastos cargados'} en el período. El gasto total de cada orden
              incluye también lo cargado fuera de él.
            </p>
            <div className="history-print__costs">
              <CostTable title="Por categoría" lines={costs.byCategory} />
              <CostTable title="Por origen" lines={costs.byOrigin} />
            </div>
          </>
        )}
      </section>
    </article>,
    document.body,
  );
}
