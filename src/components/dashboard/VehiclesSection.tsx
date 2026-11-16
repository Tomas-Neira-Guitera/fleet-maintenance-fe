import { useEffect, useRef, useState } from 'react';
import { getVehicles } from '../../services/vehiclesService';
import type { OdometerResult } from '../../services/vehiclesService';
import type { Vehicle } from '../../types/domain';
import { numberFormatter } from '../../utils/maintenanceFormat';
import { matchesVehicle } from '../../utils/plateSearch';
import { isTrailer, vehicleTypeLabel } from '../../utils/vehicleTypes';
import { AlertTriangleIcon, ChevronRightIcon } from '../icons';
import { ImportVehiclesModal } from './ImportVehiclesModal';
import { UpdateOdometerModal } from './UpdateOdometerModal';
import { VehicleFormModal } from './VehicleFormModal';
import '../../styles/dashboard.css';

function formatKm(km: number): string {
  return `${numberFormatter.format(km)} km`;
}

/** Se recuerda entre montajes: al volver del detalle de un vehículo, la sección se vuelve a montar y
 *  sin esto volvería siempre a la primera pestaña (CAM-157: vehículos o remolques; CAM-159: dados de baja). */
let lastKind: Kind = 'vehicles';

type Kind = 'vehicles' | 'trailers' | 'inactive';

const TAB_LABEL: Record<Kind, string> = { vehicles: 'Vehículos', trailers: 'Remolques', inactive: 'Dados de baja' };

function rememberKind(kind: Kind) {
  lastKind = kind;
}

/** Segunda línea de la celda "Vehículo": "Tractor 4x2 · 2015 · con AC118SR". */
function describeVehicle(v: Vehicle): string | null {
  const parts = [vehicleTypeLabel(v.vehicleType), v.year?.toString()].filter(Boolean);
  if (!isTrailer(v.vehicleType) && v.coupledWith) parts.push(`con ${v.coupledWith.plate}`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/**
 * ABM de vehículos (CAM-25): listado, alta y carga de km. Editar, dar de baja y
 * reactivar viven en el detalle del vehículo (VehicleDetail), que se abre al tocar la
 * fila. La asignación de planes de mantenimiento (CAM-16) vive en la pestaña "Planes
 * de Mantenimiento".
 */
interface VehiclesSectionProps {
  onOpenVehicle: (vehicleId: string) => void;
  /** CAM-140: abre "Comparar vehículos". */
  onCompare: () => void;
  /** CAM-150: abre las plantillas de checklist. */
  onOpenTemplates: () => void;
  /** CAM-157: abre el inventario de neumáticos. */
  onOpenTires: () => void;
}

export function VehiclesSection({ onOpenVehicle, onCompare, onOpenTemplates, onOpenTires }: VehiclesSectionProps) {
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  // CAM-159: los dados de baja van en su propia pestaña.
  const [inactive, setInactive] = useState<Vehicle[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind>(lastKind);
  // CAM-159: por patente, marca o modelo, en la pestaña abierta.
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  // CAM-154: alta de la flota desde un archivo.
  const [importing, setImporting] = useState(false);
  const [odometerTarget, setOdometerTarget] = useState<Vehicle | null>(null);
  const mountedRef = useRef(true);

  function load() {
    Promise.all([getVehicles(true), getVehicles(false)])
      .then(([active, retired]) => {
        if (!mountedRef.current) return;
        setVehicles(active);
        setInactive(retired);
      })
      .catch(() => {
        if (mountedRef.current) setError('No se pudo cargar la flota. Intentá de nuevo.');
      });
  }

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  function handleCreated() {
    setCreating(false);
    load();
  }

  function handleOdometerUpdated(result: OdometerResult) {
    setVehicles((prev) =>
      prev?.map((v) => (v.id === result.vehicleId ? { ...v, odometerKm: result.odometerKm } : v)) ?? prev,
    );
    setOdometerTarget(null);
  }

  function selectKind(next: Kind) {
    rememberKind(next);
    setKind(next);
  }

  const trailers = vehicles?.filter((v) => isTrailer(v.vehicleType)) ?? [];
  const motorVehicles = vehicles?.filter((v) => !isTrailer(v.vehicleType)) ?? [];
  const byKind: Record<Kind, Vehicle[]> = { vehicles: motorVehicles, trailers, inactive: inactive ?? [] };
  const listed = byKind[kind].filter((v) => matchesVehicle(v, query));
  const noun = kind === 'trailers' ? 'remolques' : 'vehículos';
  const loaded = vehicles !== null && inactive !== null;

  return (
    <section className="fleet-status vehicles-section">
      <header className="fleet-status__header">
        <h1 className="fleet-status__title">Vehículos</h1>
        <div className="vehicles-section__header-actions">
          <button type="button" className="secondary-btn vehicles-section__new-btn" onClick={onOpenTemplates}>
            Plantillas de checklist
          </button>
          <button type="button" className="secondary-btn vehicles-section__new-btn" onClick={onOpenTires}>
            Neumáticos
          </button>
          <button type="button" className="secondary-btn vehicles-section__new-btn" onClick={onCompare}>
            Comparar
          </button>
          <button type="button" className="secondary-btn vehicles-section__new-btn" onClick={() => setImporting(true)}>
            Importar
          </button>
          <button type="button" className="primary-btn vehicles-section__new-btn" onClick={() => setCreating(true)}>
            {kind === 'trailers' ? '+ Nuevo remolque' : '+ Nuevo vehículo'}
          </button>
        </div>
      </header>

      <div className="vehicle-tabs vehicles-section__tabs" role="tablist" aria-label="Qué listar">
        {(['vehicles', 'trailers', 'inactive'] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={kind === k}
            className={`vehicle-tabs__tab${kind === k ? ' vehicle-tabs__tab--active' : ''}`}
            onClick={() => selectKind(k)}
          >
            {TAB_LABEL[k]}
            {loaded && <span className="vehicles-section__tab-count">{byKind[k].length}</span>}
          </button>
        ))}
      </div>

      <input
        type="search"
        className="schedule-picker__input vehicles-section__search"
        placeholder="Buscar por patente, marca o modelo"
        aria-label="Buscar vehículos"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {error && (
        <p className="error-banner error-banner--icon">
          <AlertTriangleIcon width={16} height={16} />
          {error}
        </p>
      )}
      {!loaded && !error && <p className="muted">Cargando flota…</p>}

      {loaded && (
        <div className="fleet-status__table-wrap">
          <table className="fleet-status__table vehicles-section__table">
            <thead>
              <tr>
                <th>Patente</th>
                <th>{kind === 'trailers' ? 'Remolque' : 'Vehículo'}</th>
                {kind === 'trailers' && <th>Enganchado a</th>}
                <th>Estado</th>
                <th className="vehicles-section__km-col">Kilometraje</th>
                <th aria-hidden="true"></th>
              </tr>
            </thead>
            <tbody>
              {listed.map((v) => {
                const subtitle = describeVehicle(v);
                return (
                  <tr
                    key={v.id}
                    className="fleet-status__row"
                    onClick={() => onOpenVehicle(v.id)}
                    title="Ver detalle, historial y acciones"
                  >
                    <td className="fleet-status__plate">
                      <button
                        type="button"
                        className="vehicles-section__plate-link"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenVehicle(v.id);
                        }}
                      >
                        {v.plate}
                      </button>
                    </td>
                    <td>
                      <div className="fleet-status__vehicle">
                        <span className="fleet-status__vehicle-name">
                          {v.brand} {v.model}
                        </span>
                        {subtitle && <span className="fleet-status__vehicle-type">{subtitle}</span>}
                      </div>
                    </td>
                    {kind === 'trailers' && (
                      <td>
                        {v.coupledWith ? (
                          <button
                            type="button"
                            className="vehicles-section__plate-link"
                            title={`Ver ${v.coupledWith.plate}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenVehicle(v.coupledWith!.id);
                            }}
                          >
                            {v.coupledWith.plate}
                          </button>
                        ) : (
                          <span className="muted">Desenganchado</span>
                        )}
                      </td>
                    )}
                    <td>
                      <span
                        className={`vehicles-section__status vehicles-section__status--${v.active === false ? 'inactive' : 'active'}`}
                      >
                        {v.active === false ? 'Dado de baja' : 'Activo'}
                      </span>
                    </td>
                    <td className="fleet-status__km vehicles-section__km-col">{formatKm(v.odometerKm ?? 0)}</td>
                    <td>
                      <div className="vehicles-section__row-end">
                        {v.active !== false && kind === 'vehicles' && (
                          <button
                            type="button"
                            className="secondary-btn vehicles-section__action-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOdometerTarget(v);
                            }}
                          >
                            Cargar km
                          </button>
                        )}
                        <ChevronRightIcon width={16} height={16} className="vehicles-section__chevron" aria-hidden="true" />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {listed.length === 0 && (
            <p className="muted">
              {query.trim()
                ? `Ningún vehículo coincide con "${query.trim()}".`
                : kind === 'inactive'
                  ? 'No hay vehículos ni remolques dados de baja.'
                  : `No hay ${noun} en la flota todavía.`}
            </p>
          )}
        </div>
      )}

      {creating && (
        <VehicleFormModal trailer={kind === 'trailers'} onClose={() => setCreating(false)} onSaved={handleCreated} />
      )}

      {importing && <ImportVehiclesModal onClose={() => setImporting(false)} onImported={() => load()} />}

      {odometerTarget && (
        <UpdateOdometerModal
          vehicle={odometerTarget}
          onClose={() => setOdometerTarget(null)}
          onUpdated={handleOdometerUpdated}
        />
      )}
    </section>
  );
}
