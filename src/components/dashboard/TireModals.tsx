import { useEffect, useState, type ReactNode } from 'react';
import { ApiError } from '../../services/apiClient';
import {
  createTire,
  getTires,
  mountTire,
  recordTreads,
  rotateTires,
  unmountTire,
  updateTire,
  type TireInput,
} from '../../services/tiresService';
import type { Tire, VehicleTirePosition, VehicleTires } from '../../types/domain';
import { toLocalDateKey } from '../../utils/localDate';
import { numberFormatter } from '../../utils/maintenanceFormat';
import { parseTreadInputs, tireLabel } from '../../utils/tireFormat';
import { CloseIcon } from '../icons';
import '../../styles/dashboard.css';
import '../../styles/tires.css';

interface ModalShellProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
}

function ModalShell({ title, subtitle, onClose, children, footer }: ModalShellProps) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal modal--narrow">
        <header className="modal__header">
          <div>
            <h2 className="modal__title">{title}</h2>
            {subtitle && <p className="modal__subtitle">{subtitle}</p>}
          </div>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Cerrar">
            <CloseIcon width={18} height={18} />
          </button>
        </header>
        <div className="modal__body">{children}</div>
        <footer className="modal__footer">{footer}</footer>
      </div>
    </div>
  );
}

function errorText(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

interface VehicleModalProps {
  vehicle: VehicleTires;
  slot: VehicleTirePosition;
  onClose: () => void;
  onDone: (updated: VehicleTires) => void;
}

/** CAM-157: montar una cubierta del stock; si la posición tiene una, es un cambio y se elige qué pasa con ella. */
export function MountTireModal({ vehicle, slot, onClose, onDone }: VehicleModalProps) {
  const [stock, setStock] = useState<Tire[] | null>(null);
  const [tireId, setTireId] = useState('');
  const [replaced, setReplaced] = useState<'stock' | 'retired'>('stock');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changing = Boolean(slot.tire);

  useEffect(() => {
    let cancelled = false;
    getTires('stock')
      .then((tires) => {
        if (cancelled) return;
        setStock(tires);
        if (tires.length > 0) setTireId(tires[0].id);
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo cargar el stock de cubiertas.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    try {
      onDone(await mountTire(vehicle.vehicleId, tireId, slot.position, changing ? replaced : undefined, reason.trim() || undefined));
    } catch (err) {
      setError(errorText(err, 'No se pudo montar la cubierta.'));
      setSaving(false);
    }
  }

  return (
    <ModalShell
      title={changing ? 'Cambiar cubierta' : 'Montar cubierta'}
      subtitle={`${vehicle.plate} · ${slot.label}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="secondary-btn" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="button" className="primary-btn" onClick={handleSubmit} disabled={saving || !tireId}>
            {saving ? 'Guardando…' : changing ? 'Cambiar' : 'Montar'}
          </button>
        </>
      }
    >
      {stock && stock.length === 0 && (
        <p className="muted">No hay cubiertas en stock. Cargalas en Vehículos → Cubiertas.</p>
      )}
      {stock && stock.length > 0 && (
        <label className="schedule-picker__field">
          Cubierta del stock
          <select className="schedule-picker__input" value={tireId} onChange={(e) => setTireId(e.target.value)}>
            {stock.map((t) => (
              <option key={t.id} value={t.id}>
                {tireLabel(t)} · {t.size}
                {t.km > 0 ? ` · ${numberFormatter.format(t.km)} km` : ' · nueva'}
              </option>
            ))}
          </select>
        </label>
      )}
      {changing && slot.tire && (
        <fieldset className="schedule-picker__field tire-modal__fieldset">
          <legend>Qué pasa con {tireLabel(slot.tire)}</legend>
          <label className="checklist-toggle">
            <input type="radio" name="replaced" checked={replaced === 'stock'} onChange={() => setReplaced('stock')} />
            <span>Vuelve al stock</span>
          </label>
          <label className="checklist-toggle">
            <input type="radio" name="replaced" checked={replaced === 'retired'} onChange={() => setReplaced('retired')} />
            <span>Se da de baja</span>
          </label>
          {replaced === 'retired' && (
            <input
              type="text"
              className="schedule-picker__input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Motivo (opcional): gastada, corte lateral…"
              maxLength={120}
            />
          )}
        </fieldset>
      )}
      {error && <p className="error-banner">{error}</p>}
    </ModalShell>
  );
}

/** Rotar a otra posición del mismo vehículo; si está ocupada, se intercambian. */
export function RotateTireModal({ vehicle, slot, onClose, onDone }: VehicleModalProps) {
  const targets = vehicle.positions.filter((p) => p.position !== slot.position);
  const [to, setTo] = useState(targets[0]?.position ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const target = targets.find((p) => p.position === to);

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    try {
      onDone(await rotateTires(vehicle.vehicleId, slot.position, to));
    } catch (err) {
      setError(errorText(err, 'No se pudo rotar la cubierta.'));
      setSaving(false);
    }
  }

  return (
    <ModalShell
      title="Rotar cubierta"
      subtitle={`${vehicle.plate} · ${slot.tire ? tireLabel(slot.tire) : ''} en ${slot.label}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="secondary-btn" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="button" className="primary-btn" onClick={handleSubmit} disabled={saving || !to}>
            {saving ? 'Rotando…' : target?.tire ? 'Intercambiar' : 'Rotar'}
          </button>
        </>
      }
    >
      <label className="schedule-picker__field">
        A qué posición
        <select className="schedule-picker__input" value={to} onChange={(e) => setTo(e.target.value)}>
          {targets.map((p) => (
            <option key={p.position} value={p.position}>
              {p.label}
              {p.tire ? ` (tiene ${tireLabel(p.tire)})` : ' (libre)'}
            </option>
          ))}
        </select>
      </label>
      <p className="muted">
        {target?.tire
          ? 'Las dos cubiertas se intercambian. Sus km siguen sumando en la nueva posición.'
          : 'Sus km siguen sumando en la nueva posición.'}
      </p>
      {error && <p className="error-banner">{error}</p>}
    </ModalShell>
  );
}

/** Sacar una cubierta: vuelve al stock o se da de baja. */
export function UnmountTireModal({ vehicle, slot, onClose, onDone }: VehicleModalProps) {
  const [retire, setRetire] = useState(false);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    try {
      onDone(await unmountTire(vehicle.vehicleId, slot.position, retire, reason.trim() || undefined));
    } catch (err) {
      setError(errorText(err, 'No se pudo sacar la cubierta.'));
      setSaving(false);
    }
  }

  return (
    <ModalShell
      title="Sacar cubierta"
      subtitle={`${vehicle.plate} · ${slot.label}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="secondary-btn" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="button" className="primary-btn" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Guardando…' : 'Sacar'}
          </button>
        </>
      }
    >
      <label className="checklist-toggle">
        <input type="radio" name="unmount" checked={!retire} onChange={() => setRetire(false)} />
        <span>Vuelve al stock</span>
      </label>
      <label className="checklist-toggle">
        <input type="radio" name="unmount" checked={retire} onChange={() => setRetire(true)} />
        <span>Se da de baja</span>
      </label>
      {retire && (
        <input
          type="text"
          className="schedule-picker__input"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Motivo (opcional)"
          maxLength={120}
          aria-label="Motivo de la baja"
        />
      )}
      {error && <p className="error-banner">{error}</p>}
    </ModalShell>
  );
}

/** El admin carga el dibujo medido en el taller. */
export function TreadReadingsModal({
  vehicle,
  onClose,
  onDone,
}: Omit<VehicleModalProps, 'slot'>) {
  const mounted = vehicle.positions.filter((p) => p.tire);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const readings = parseTreadInputs(values);

  async function handleSubmit() {
    if (!readings || readings.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      onDone(await recordTreads(vehicle.vehicleId, readings));
    } catch (err) {
      setError(errorText(err, 'No se pudo cargar el dibujo.'));
      setSaving(false);
    }
  }

  return (
    <ModalShell
      title="Cargar dibujo"
      subtitle={`${vehicle.plate} · en mm, lo que dejes vacío no se carga`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="secondary-btn" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button
            type="button"
            className="primary-btn"
            onClick={handleSubmit}
            disabled={saving || !readings || readings.length === 0}
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </>
      }
    >
      <ul className="tread-card__list">
        {mounted.map((p) => (
          <li key={p.position} className="tread-card__row">
            <label htmlFor={`admin-tread-${p.position}`}>{p.label}</label>
            <span className="tread-card__input">
              <input
                id={`admin-tread-${p.position}`}
                type="text"
                inputMode="decimal"
                className="schedule-picker__input"
                value={values[p.position] ?? ''}
                onChange={(e) => setValues((prev) => ({ ...prev, [p.position]: e.target.value }))}
                maxLength={4}
              />
              <span aria-hidden="true">mm</span>
            </span>
          </li>
        ))}
      </ul>
      {readings === null && <p className="field-error">Entre 0 y 30 mm, con hasta un decimal.</p>}
      {error && <p className="error-banner">{error}</p>}
    </ModalShell>
  );
}

interface TireFormModalProps {
  tire?: Tire;
  onClose: () => void;
  onSaved: (tire: Tire) => void;
}

/** Alta y edición de una cubierta. Queda en stock hasta que se monta. */
export function TireFormModal({ tire, onClose, onSaved }: TireFormModalProps) {
  const [form, setForm] = useState({
    code: tire?.code ?? '',
    brand: tire?.brand ?? '',
    model: tire?.model ?? '',
    size: tire?.size ?? '',
    purchaseDate: tire?.purchaseDate ?? toLocalDateKey(new Date()),
    cost: tire ? String(tire.cost) : '',
    initialTreadMm: tire?.initialTreadMm != null ? String(tire.initialTreadMm) : '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...patch }));
  const canSubmit = form.brand.trim() && form.size.trim() && form.purchaseDate && Number(form.cost) > 0;

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    const input: TireInput = {
      code: form.code.trim() || undefined,
      brand: form.brand.trim(),
      model: form.model.trim() || undefined,
      size: form.size.trim(),
      purchaseDate: form.purchaseDate,
      cost: Number(form.cost),
      initialTreadMm: form.initialTreadMm.trim() ? Number(form.initialTreadMm.replace(',', '.')) : undefined,
    };
    try {
      onSaved(tire ? await updateTire(tire.id, input) : await createTire(input));
    } catch (err) {
      setError(errorText(err, 'No se pudo guardar la cubierta.'));
      setSaving(false);
    }
  }

  return (
    <ModalShell
      title={tire ? 'Editar cubierta' : 'Nueva cubierta'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="secondary-btn" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="button" className="primary-btn" onClick={handleSubmit} disabled={saving || !canSubmit}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </>
      }
    >
      <label className="schedule-picker__field">
        Marca
        <input className="schedule-picker__input" value={form.brand} maxLength={60} onChange={(e) => set({ brand: e.target.value })} placeholder="Ej: Michelin" />
      </label>
      <label className="schedule-picker__field">
        Modelo (opcional)
        <input className="schedule-picker__input" value={form.model} maxLength={60} onChange={(e) => set({ model: e.target.value })} placeholder="Ej: X Multi Z" />
      </label>
      <label className="schedule-picker__field">
        Medida
        <input className="schedule-picker__input" value={form.size} maxLength={30} onChange={(e) => set({ size: e.target.value })} placeholder="Ej: 295/80 R22.5" />
      </label>
      <label className="schedule-picker__field">
        Código o N° de serie (opcional)
        <input className="schedule-picker__input" value={form.code} maxLength={40} onChange={(e) => set({ code: e.target.value })} placeholder="Para reconocerla en el taller" />
      </label>
      <label className="schedule-picker__field">
        Fecha de compra
        <input type="date" className="schedule-picker__input" value={form.purchaseDate} max={toLocalDateKey(new Date())} onChange={(e) => set({ purchaseDate: e.target.value })} />
      </label>
      <label className="schedule-picker__field">
        Costo ($)
        <input type="number" min={0} step="0.01" className="schedule-picker__input" value={form.cost} onChange={(e) => set({ cost: e.target.value })} />
      </label>
      <label className="schedule-picker__field">
        Dibujo nuevo en mm (opcional)
        <input type="text" inputMode="decimal" className="schedule-picker__input" value={form.initialTreadMm} maxLength={4} onChange={(e) => set({ initialTreadMm: e.target.value })} placeholder="Ej: 16" />
      </label>
      {error && <p className="error-banner">{error}</p>}
    </ModalShell>
  );
}
