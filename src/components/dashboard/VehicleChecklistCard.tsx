import { useEffect, useState } from 'react';
import { useVisibleRows } from '../../hooks/useVisibleRows';
import { ApiError } from '../../services/apiClient';
import {
  deleteVehicleChecklistItem,
  getVehicleChecklistConfig,
  setVehicleChecklistItemEnabled,
} from '../../services/checklistService';
import type { VehicleChecklistItem } from '../../types/domain';
import { CHECKLIST_SECTIONS } from '../../utils/checklistSections';
import { TrashIcon } from '../icons';
import { AddChecklistItemModal } from './AddChecklistItemModal';
import '../../styles/dashboard.css';

const VISIBLE_ITEMS = 4;

interface VehicleChecklistCardProps {
  vehicleId: string;
  plate: string;
}

/**
 * CAM-31: ítems de inspección del vehículo. "Quitar" saca un ítem del checklist del chofer pero lo
 * deja cargado en el vehículo; "Eliminar" (solo ítems agregados) lo borra del vehículo.
 */
export function VehicleChecklistCard({ vehicleId, plate }: VehicleChecklistCardProps) {
  const [items, setItems] = useState<VehicleChecklistItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const { ref: scrollRef, maxHeight } = useVisibleRows<HTMLDivElement>(VISIBLE_ITEMS, items?.length ?? 0);

  useEffect(() => {
    let cancelled = false;
    getVehicleChecklistConfig(vehicleId)
      .then((loaded) => {
        if (!cancelled) setItems(loaded);
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo cargar el checklist del vehículo.');
      });
    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  async function handleToggle(item: VehicleChecklistItem) {
    setBusyId(item.id);
    setError(null);
    try {
      const updated = await setVehicleChecklistItemEnabled(vehicleId, item.id, !item.enabled);
      setItems((prev) => prev?.map((i) => (i.id === updated.id ? updated : i)) ?? prev);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar el ítem. Intentá de nuevo.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(item: VehicleChecklistItem) {
    if (!window.confirm(`¿Eliminar "${item.label}" de este vehículo? Las inspecciones ya hechas no cambian.`)) return;
    setBusyId(item.id);
    setError(null);
    try {
      await deleteVehicleChecklistItem(vehicleId, item.id);
      setItems((prev) => prev?.filter((i) => i.id !== item.id) ?? prev);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo eliminar el ítem. Intentá de nuevo.');
    } finally {
      setBusyId(null);
    }
  }

  const totalCount = items?.length ?? 0;

  return (
    <section className="vehicle-detail__card vehicle-checklist">
      <header className="vehicle-checklist__header">
        <h2 className="vehicle-detail__card-title">Checklist de inspección ({totalCount} ítems)</h2>
        {items && (
          <button type="button" className="vehicle-detail__action-btn" onClick={() => setAdding(true)}>
            + Agregar ítem
          </button>
        )}
      </header>
      <p className="vehicle-detail__item-meta">
        Ítems de este vehículo y cuáles revisa el chofer en el pre-viaje. El post-viaje es igual para toda la flota.
      </p>

      {error && <p className="error-banner">{error}</p>}
      {!items && !error && <p className="muted">Cargando checklist…</p>}

      {items && (
        <div ref={scrollRef} className="vehicle-checklist__scroll scroll-list" style={maxHeight ? { maxHeight } : undefined}>
          {CHECKLIST_SECTIONS.map(({ key, label: sectionLabel }) => {
            const sectionItems = items.filter((i) => i.section === key);
            if (sectionItems.length === 0) return null;
            return (
              <div key={key} className="vehicle-checklist__section">
                <h3 className="vehicle-checklist__section-title">{sectionLabel}</h3>
                <ul className="vehicle-detail__list">
                  {sectionItems.map((item) => (
                    <li
                      key={item.id}
                      data-scroll-item
                      className={`vehicle-detail__item${item.enabled ? '' : ' vehicle-detail__item--resolved'}`}
                    >
                      <div className="vehicle-detail__item-main">
                        <span className="vehicle-detail__item-label">{item.label}</span>
                        <span className="vehicle-detail__item-meta">
                          {item.origin === 'extra' ? 'Agregado para este vehículo' : 'Checklist base'}
                          {!item.enabled ? ' · No se revisa en la inspección' : ''}
                        </span>
                      </div>
                      {item.locked ? (
                        <span className="vehicle-checklist__locked">Obligatorio</span>
                      ) : (
                        <div className="vehicle-checklist__actions">
                          <button
                            type="button"
                            className={`vehicle-detail__action-btn ${item.enabled ? '' : 'vehicle-detail__action-btn--ok'}`}
                            onClick={() => handleToggle(item)}
                            disabled={busyId === item.id}
                          >
                            {item.enabled ? 'Quitar' : 'Incluir en el checklist'}
                          </button>
                          {item.origin === 'extra' && (
                            <button
                              type="button"
                              className="vehicle-detail__action-btn vehicle-detail__action-btn--danger vehicle-checklist__delete"
                              onClick={() => handleDelete(item)}
                              disabled={busyId === item.id}
                              aria-label={`Eliminar ${item.label}`}
                              title="Eliminar del vehículo"
                            >
                              <TrashIcon width={14} height={14} />
                              Eliminar
                            </button>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {adding && (
        <AddChecklistItemModal
          vehicleId={vehicleId}
          plate={plate}
          onClose={() => setAdding(false)}
          onAdded={(created) => {
            setItems((prev) => (prev ? [...prev, created] : [created]));
            setAdding(false);
          }}
        />
      )}
    </section>
  );
}
