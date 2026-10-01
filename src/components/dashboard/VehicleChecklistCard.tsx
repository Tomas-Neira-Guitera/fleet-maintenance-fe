import { useEffect, useState } from 'react';
import { useVisibleRows } from '../../hooks/useVisibleRows';
import { ApiError } from '../../services/apiClient';
import { getVehicleChecklistConfig, setVehicleChecklistItemEnabled } from '../../services/checklistService';
import type { VehicleChecklistItem } from '../../types/domain';
import { CHECKLIST_SECTIONS } from '../../utils/checklistSections';
import { AddChecklistItemModal } from './AddChecklistItemModal';
import '../../styles/dashboard.css';

const VISIBLE_ITEMS = 4;

interface VehicleChecklistCardProps {
  vehicleId: string;
  plate: string;
}

/**
 * CAM-31: checklist pre-viaje propio del vehículo. El admin quita ítems del checklist base
 * (salvo los obligatorios) y agrega ítems extra que solo aparecen en las inspecciones de este vehículo.
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
    if (item.origin === 'extra' && !window.confirm(`¿Quitar "${item.label}" del checklist de este vehículo?`)) return;
    setBusyId(item.id);
    setError(null);
    try {
      const updated = await setVehicleChecklistItemEnabled(vehicleId, item.id, !item.enabled);
      setItems((prev) =>
        prev
          ? updated.origin === 'extra' && !updated.enabled
            ? prev.filter((i) => i.id !== updated.id)
            : prev.map((i) => (i.id === updated.id ? updated : i))
          : prev,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar el ítem. Intentá de nuevo.');
    } finally {
      setBusyId(null);
    }
  }

  const activeCount = items?.filter((i) => i.enabled).length ?? 0;

  return (
    <section className="vehicle-detail__card vehicle-checklist">
      <header className="vehicle-checklist__header">
        <h2 className="vehicle-detail__card-title">Checklist de inspección ({activeCount} ítems)</h2>
        {items && (
          <button type="button" className="vehicle-detail__action-btn" onClick={() => setAdding(true)}>
            + Agregar ítem
          </button>
        )}
      </header>
      <p className="vehicle-detail__item-meta">
        Lo que revisa el chofer en el pre-viaje de este vehículo. El post-viaje es igual para toda la flota.
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
                          {item.type === 'number' ? 'Número' : 'OK / Defecto'}
                          {item.origin === 'extra' ? ' · Agregado para este vehículo' : ''}
                          {!item.enabled ? ' · No aplica a este vehículo' : ''}
                        </span>
                      </div>
                      {item.locked ? (
                        <span className="vehicle-checklist__locked">Obligatorio</span>
                      ) : (
                        <button
                          type="button"
                          className={`vehicle-detail__action-btn ${item.enabled ? 'vehicle-detail__action-btn--danger' : 'vehicle-detail__action-btn--ok'}`}
                          onClick={() => handleToggle(item)}
                          disabled={busyId === item.id}
                        >
                          {item.enabled ? 'Quitar' : 'Volver a agregar'}
                        </button>
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
