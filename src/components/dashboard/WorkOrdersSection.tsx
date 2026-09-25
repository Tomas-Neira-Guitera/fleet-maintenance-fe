import { useEffect, useRef, useState } from 'react';
import { getUsers } from '../../services/usersService';
import { getVehicles } from '../../services/vehiclesService';
import { getWorkOrders } from '../../services/workOrdersService';
import type { UserSummary, Vehicle, WorkOrder, WorkOrderStatus } from '../../types/domain';
import { currencyFormatter } from '../../utils/maintenanceFormat';
import { workOrderResponsible } from '../../utils/workOrderFormat';
import { BuildingIcon, WrenchIcon } from '../icons';
import { CreateWorkOrderModal } from './CreateWorkOrderModal';
import { WorkOrderDetailModal } from './WorkOrderDetailModal';
import { WorkOrderStatusBadge } from './WorkOrderStatusBadge';
import '../../styles/dashboard.css';

const STATUS_FILTERS: { value: WorkOrderStatus | ''; label: string }[] = [
  { value: '', label: 'Todos los estados' },
  { value: 'asignada', label: 'Asignada' },
  { value: 'en_proceso', label: 'En proceso' },
  { value: 'finalizada', label: 'Finalizada' },
  { value: 'cancelada', label: 'Cancelada' },
];

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Sección "Órdenes de trabajo" (CAM-63): listado con filtros por vehículo/estado,
 * creación manual, y detalle con gastos/fotos. Mismo molde que VehiclesSection.
 */
export function WorkOrdersSection() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[] | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<WorkOrderStatus | ''>('');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [technicians, setTechnicians] = useState<UserSummary[] | null>(null);
  const [technicianFilter, setTechnicianFilter] = useState('');
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<WorkOrder | null>(null);
  const mountedRef = useRef(true);

  function load() {
    getWorkOrders({
      status: statusFilter || undefined,
      vehicleId: vehicleFilter || undefined,
      technicianId: technicianFilter || undefined,
    })
      .then((data) => {
        if (mountedRef.current) setWorkOrders(data);
      })
      .catch(() => {
        if (mountedRef.current) setError('No se pudieron cargar las órdenes de trabajo. Intentá de nuevo.');
      });
  }

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, vehicleFilter, technicianFilter]);

  useEffect(() => {
    getVehicles()
      .then((data) => {
        if (mountedRef.current) setVehicles(data);
      })
      .catch(() => {
        if (mountedRef.current) setVehicles([]);
      });
    getUsers('TECNICO')
      .then((data) => {
        if (mountedRef.current) setTechnicians(data);
      })
      .catch(() => {
        if (mountedRef.current) setTechnicians([]);
      });
  }, []);

  function handleCreated() {
    setCreating(false);
    load();
  }

  function handleUpdated(updated: WorkOrder) {
    setSelected(updated);
    setWorkOrders((prev) => prev?.map((wo) => (wo.id === updated.id ? updated : wo)) ?? prev);
  }

  return (
    <section className="fleet-status vehicles-section">
      <header className="fleet-status__header">
        <h1 className="fleet-status__title">Órdenes de trabajo</h1>
        <div className="vehicles-section__header-actions">
          <select
            className="work-orders__filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as WorkOrderStatus | '')}
          >
            {STATUS_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <select
            className="work-orders__filter"
            value={vehicleFilter}
            onChange={(e) => setVehicleFilter(e.target.value)}
            disabled={!vehicles}
          >
            <option value="">Todos los vehículos</option>
            {vehicles?.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plate}
              </option>
            ))}
          </select>
          <select
            className="work-orders__filter"
            value={technicianFilter}
            onChange={(e) => setTechnicianFilter(e.target.value)}
            disabled={!technicians}
          >
            <option value="">Todos los técnicos</option>
            {technicians?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.username}
              </option>
            ))}
          </select>
          <button type="button" className="primary-btn vehicles-section__new-btn" onClick={() => setCreating(true)}>
            + Nueva orden
          </button>
        </div>
      </header>

      {error && <p className="error-banner">{error}</p>}
      {!workOrders && !error && <p className="muted">Cargando órdenes de trabajo…</p>}
      {workOrders && workOrders.length === 0 && <p className="muted">No hay órdenes de trabajo con estos filtros.</p>}

      {workOrders && workOrders.length > 0 && (
        <div className="fleet-status__table-wrap">
          <table className="fleet-status__table">
            <thead>
              <tr>
                <th>Vehículo</th>
                <th>Título</th>
                <th>Estado</th>
                <th>Ejecución</th>
                <th>Responsable</th>
                <th>Gastos</th>
                <th>Creada</th>
              </tr>
            </thead>
            <tbody>
              {workOrders.map((wo) => (
                <tr key={wo.id} className="work-orders__row" onClick={() => setSelected(wo)}>
                  <td className="fleet-status__plate">{wo.plate ?? '—'}</td>
                  <td>{wo.title}</td>
                  <td>
                    <WorkOrderStatusBadge status={wo.status} />
                  </td>
                  <td>
                    <span className="work-orders__execution">
                      {wo.executionType === 'interno' ? (
                        <WrenchIcon width={14} height={14} />
                      ) : (
                        <BuildingIcon width={14} height={14} />
                      )}
                      {wo.executionType === 'interno' ? 'Interno' : wo.externalProvider ?? 'Externo'}
                    </span>
                  </td>
                  <td>{workOrderResponsible(wo) ?? '—'}</td>
                  <td className="fleet-status__km">{currencyFormatter.format(wo.totalExpenses)}</td>
                  <td className="fleet-status__km">{formatDateTime(wo.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && <CreateWorkOrderModal mode="manual" onClose={() => setCreating(false)} onCreated={handleCreated} />}

      {selected && (
        <WorkOrderDetailModal
          workOrder={selected}
          onClose={() => {
            setSelected(null);
            load();
          }}
          onUpdated={handleUpdated}
        />
      )}
    </section>
  );
}
