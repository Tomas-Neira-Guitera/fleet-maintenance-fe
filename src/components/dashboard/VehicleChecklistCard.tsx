import { useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../../services/apiClient';
import {
  addVehicleChecklistItem,
  getVehicleChecklistConfig,
  setVehicleChecklistItemEnabled,
  type NewChecklistItem,
} from '../../services/checklistService';
import type { VehicleChecklistItem } from '../../types/domain';
import { CharCounter } from '../CharCounter';
import '../../styles/dashboard.css';

const LABEL_MAX_LENGTH = 60;

const SECTIONS: { key: NewChecklistItem['section']; label: string }[] = [
  { key: 'exterior', label: 'Inspección visual (exterior)' },
  { key: 'interior', label: 'Inspección interior (cabina)' },
];

interface VehicleChecklistCardProps {
  vehicleId: string;
}

/**
 * CAM-31: checklist pre-viaje propio del vehículo. El admin quita ítems del checklist base
 * (salvo los obligatorios) y agrega ítems extra que solo aparecen en las inspecciones de este vehículo.
 */
export function VehicleChecklistCard({ vehicleId }: VehicleChecklistCardProps) {
  const [items, setItems] = useState<VehicleChecklistItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [type, setType] = useState<NewChecklistItem['type']>('check');
  const [section, setSection] = useState<NewChecklistItem['section']>('exterior');
  const [adding, setAdding] = useState(false);

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
    const enabling = !item.enabled;
    if (item.origin === 'extra' && !window.confirm(`¿Quitar "${item.label}" del checklist de este vehículo?`)) return;
    setBusyId(item.id);
    setError(null);
    try {
      const updated = await setVehicleChecklistItemEnabled(vehicleId, item.id, enabling);
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

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const created = await addVehicleChecklistItem(vehicleId, { label: label.trim(), type, section });
      setItems((prev) => (prev ? [...prev, created] : [created]));
      setLabel('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo agregar el ítem. Intentá de nuevo.');
    } finally {
      setAdding(false);
    }
  }

  const activeCount = items?.filter((i) => i.enabled).length ?? 0;

  return (
    <section className="vehicle-detail__card vehicle-checklist">
      <h2 className="vehicle-detail__card-title">Checklist de inspección ({activeCount} ítems)</h2>
      <p className="vehicle-detail__item-meta">
        Lo que revisa el chofer en el pre-viaje de este vehículo. El post-viaje es igual para toda la flota.
      </p>

      {error && <p className="error-banner">{error}</p>}
      {!items && !error && <p className="muted">Cargando checklist…</p>}

      {items &&
        SECTIONS.map(({ key, label: sectionLabel }) => {
          const sectionItems = items.filter((i) => i.section === key);
          if (sectionItems.length === 0) return null;
          return (
            <div key={key} className="vehicle-checklist__section">
              <h3 className="vehicle-checklist__section-title">{sectionLabel}</h3>
              <ul className="vehicle-detail__list">
                {sectionItems.map((item) => (
                  <li
                    key={item.id}
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

      {items && (
        <form className="vehicle-checklist__form" onSubmit={handleAdd}>
          <h3 className="vehicle-checklist__section-title">Agregar ítem</h3>
          <label className="schedule-picker__field">
            Qué revisar
            <input
              type="text"
              className="schedule-picker__input"
              value={label}
              maxLength={LABEL_MAX_LENGTH}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ej: Estado de la faja de sujeción"
            />
            <CharCounter value={label} max={LABEL_MAX_LENGTH} />
          </label>
          <div className="vehicle-checklist__form-row">
            <label className="schedule-picker__field">
              Tipo
              <select
                className="schedule-picker__input"
                value={type}
                onChange={(e) => setType(e.target.value as NewChecklistItem['type'])}
              >
                <option value="check">OK / Defecto</option>
                <option value="number">Número</option>
              </select>
            </label>
            <label className="schedule-picker__field">
              Sección
              <select
                className="schedule-picker__input"
                value={section}
                onChange={(e) => setSection(e.target.value as NewChecklistItem['section'])}
              >
                {SECTIONS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button type="submit" className="vehicle-detail__action-btn" disabled={adding || !label.trim()}>
            {adding ? 'Agregando…' : 'Agregar al checklist'}
          </button>
        </form>
      )}
    </section>
  );
}
