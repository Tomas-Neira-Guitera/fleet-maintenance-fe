import { useEffect, useMemo, useState } from 'react';
import { getPreTripItems, getTrailerItems, POST_TRIP_ITEMS, TRAILER_POST_TRIP_ITEMS } from '../checklist/checklistDefinitions';
import {
  ApiError,
  describeApiError,
  getUsername,
  isNetworkError,
  isSessionExpired,
  SESSION_EXPIRED_MESSAGE,
} from '../services/apiClient';
import { submitInspection } from '../services/inspectionsService';
import { getCoupling } from '../services/couplingService';
import { couplingCacheKey, loadCache, saveCache, VEHICLES_CACHE_KEY } from '../offline/offlineCache';
import { useInspectionChecklist } from '../hooks/useInspectionChecklist';
import { enqueueInspection, hasPendingInspections } from '../offline/pendingInspections';
import { hasPhoto } from '../utils/defectPhoto';
import { tireConditionLabel, toTireConditions, type TireConditionValue } from '../utils/tireFormat';
import { canTow, canTowAny } from '../utils/vehicleTypes';
import { newUuid } from '../utils/uuid';
import type {
  ChecklistAnswer,
  ChecklistItemDef,
  ChecklistItemState,
  ChecklistSection,
  InspectionType,
  Vehicle,
} from '../types/domain';
import { ChecklistItemCard } from './ChecklistItemCard';
import { TrailerPicker } from './TrailerPicker';
import { TireConditionPicker } from './TireConditionPicker';
import { HealthRing, type RingStatus } from './HealthRing';
import { AlertOctagonIcon, AlertTriangleIcon, CheckCircleIcon, ShieldCheckIcon } from './icons';

interface InspectionFlowProps {
  vehicle: Vehicle;
  type: InspectionType;
  onDone: () => void;
  onBack: () => void;
  /** El vehículo cambió de estado mientras se cargaba la inspección: se vuelve al listado con el motivo. */
  onUnavailable: (message: string) => void;
  onLogout: () => void;
}

// 409 del envío: otro chofer (o el admin) cambió el estado del vehículo mientras tanto.
const UNAVAILABLE_MESSAGES: Record<string, string> = {
  VEHICLE_BLOCKED: 'no puede salir: tiene un defecto bloqueante o un documento vencido.',
  VEHICLE_INACTIVE: 'fue dado de baja.',
  VEHICLE_ON_TRIP: 'ya tiene un viaje abierto.',
  NO_OPEN_TRIP: 'ya no tiene un viaje abierto: alguien lo cerró.',
};

// CAM-157: el control del checklist base donde se marca qué neumático tiene problemas. CAM-159: el del remolque.
const TIRES_ITEM_ID = 'ext-neumaticos';
const TRAILER_TIRES_ITEM_ID = 'rem-neumaticos';
const TRAILER_POST_TRIP_TIRES_ITEM_ID = 'rem-post-neumaticos';

// CAM-159: lo que el chofer cargó del remolque. Si elige otro remolque, arranca de cero.
interface TrailerForm {
  trailerId: string | null;
  answers: Record<string, ChecklistItemState>;
  tires: TireConditionValue;
}

// queued: sin señal, quedó guardada en el celular (CAM-153).
type FlowStep = 'checklist' | 'summary' | 'success' | 'queued';

const SECTION_LABEL: Record<ChecklistSection, string> = {
  exterior: 'Inspección visual (exterior)',
  interior: 'Inspección interior (cabina)',
  posttrip: 'Estado del vehículo',
};

function groupBySection(items: ChecklistItemDef[]): [ChecklistSection, ChecklistItemDef[]][] {
  const order: ChecklistSection[] = ['exterior', 'interior', 'posttrip'];
  return order
    .map((section) => [section, items.filter((i) => i.section === section)] as [ChecklistSection, ChecklistItemDef[]])
    .filter(([, sectionItems]) => sectionItems.length > 0);
}

function isItemValid(def: ChecklistItemDef, state: ChecklistItemState): boolean {
  if (def.type === 'number') {
    return def.required ? Boolean(state.numberValue?.trim()) : true;
  }
  if (state.outcome !== 'defect') return true;
  const defect = state.defect;
  if (!defect || !defect.description.trim()) return false;
  if (defect.severity === 'blocking' && (!hasPhoto(defect) || state.uploading)) return false;
  return true;
}

// CAM-94: los controles arrancan en OK; el chofer solo toca los que tienen un defecto.
function initialState(def: ChecklistItemDef): ChecklistItemState {
  return def.type === 'check' ? { outcome: 'ok' } : {};
}

export function InspectionFlow({ vehicle, type, onDone, onBack, onUnavailable, onLogout }: InspectionFlowProps) {
  // CAM-31: cada vehículo tiene su checklist. Si no se puede pedir, se usa la lista base: el
  // servidor ignora los ítems que no correspondan y los extras nunca son obligatorios.
  const fallbackItems = useMemo(() => (type === 'pre-trip' ? getPreTripItems() : POST_TRIP_ITEMS), [type]);
  // CAM-157: con el checklist viene el dibujo del vehículo, para marcar qué neumático tiene problemas si
  // "Neumáticos" va en defecto. Sin dibujo (o sin tipo), el chofer lo cuenta en la descripción.
  const { items: loadedItems, tirePositions } = useInspectionChecklist(vehicle.id, type, fallbackItems);
  const items = useMemo(() => loadedItems ?? [], [loadedItems]);
  const [tireValues, setTireValues] = useState<TireConditionValue>({});
  const canPickTires = Boolean(tirePositions?.positions.some((p) => p.mounted));

  // CAM-157: el pre-viaje de un tractor o camión rígido dice qué remolque lleva. Arranca en el que tiene
  // enganchado; si el chofer no lo cambia, no se manda y el enganche queda como estaba.
  // CAM-159: en el post-viaje no se elige, pero se revisa el que lleva.
  const canTowTrailer = canTowAny(vehicle.vehicleType);
  const tows = type === 'pre-trip' && canTowTrailer;
  const trailers = useMemo(
    () =>
      canTowTrailer
        ? (loadCache<Vehicle[]>(VEHICLES_CACHE_KEY)?.data ?? []).filter(
            (v) => v.active !== false && canTow(vehicle.vehicleType, v.vehicleType),
          )
        : [],
    [canTowTrailer, vehicle.vehicleType],
  );
  const [initialTrailer, setInitialTrailer] = useState<string | null>(null);
  const [trailerChoice, setTrailerChoice] = useState<string | null>(null);
  useEffect(() => {
    if (!canTowTrailer) return;
    let cancelled = false;
    const cacheKey = couplingCacheKey(vehicle.id);
    const apply = (current: string) => {
      if (cancelled) return;
      setInitialTrailer(current);
      setTrailerChoice((prev) => prev ?? current);
    };
    getCoupling(vehicle.id)
      .then((coupling) => {
        saveCache(cacheKey, coupling.towing?.id ?? 'none');
        apply(coupling.towing?.id ?? 'none');
      })
      .catch(() => apply(loadCache<string>(cacheKey)?.data ?? 'none'));
    return () => {
      cancelled = true;
    };
  }, [canTowTrailer, vehicle.id]);
  const trailerId = tows && trailerChoice !== null && trailerChoice !== initialTrailer ? trailerChoice : undefined;
  const checkItems = useMemo(() => items.filter((i) => i.type === 'check'), [items]);

  // CAM-159: el remolque se revisa en el mismo envío: en el pre-viaje, el elegido o el que ya tenía; en el
  // post-viaje, el que lleva. En el post-viaje arranca en OK y solo se despliega si el chofer lo destilda.
  const towedTrailerId =
    type === 'pre-trip'
      ? tows && trailerChoice && trailerChoice !== 'none' ? trailerChoice : null
      : initialTrailer && initialTrailer !== 'none' ? initialTrailer : null;
  const towedTrailer = towedTrailerId ? (trailers.find((t) => t.id === towedTrailerId) ?? null) : null;
  const trailerFallback = useMemo(
    () => (type === 'pre-trip' ? getTrailerItems(towedTrailer?.vehicleType) : TRAILER_POST_TRIP_ITEMS),
    [type, towedTrailer?.vehicleType],
  );
  const trailerChecklist = useInspectionChecklist(towedTrailerId, type, trailerFallback, true);
  const trailerItems = useMemo(() => trailerChecklist.items ?? [], [trailerChecklist.items]);
  const trailerTiresItemId = type === 'pre-trip' ? TRAILER_TIRES_ITEM_ID : TRAILER_POST_TRIP_TIRES_ITEM_ID;
  const [trailerOk, setTrailerOk] = useState(true);
  const trailerCollapsed = type === 'post-trip' && trailerOk;
  const activeTrailerItems = useMemo(() => (trailerCollapsed ? [] : trailerItems), [trailerCollapsed, trailerItems]);
  const trailerCheckItems = useMemo(() => activeTrailerItems.filter((i) => i.type === 'check'), [activeTrailerItems]);
  const trailerTirePositions = trailerChecklist.tirePositions;
  const canPickTrailerTires = Boolean(trailerTirePositions?.positions.some((p) => p.mounted));
  // Un remolque con un bloqueante abierto o un documento vencido no sale: el servidor lo rechazaría igual.
  const trailerBlockedReason = type === 'pre-trip' && towedTrailer?.blocked
    ? (towedTrailer.blockReasons ?? []).map((r) => r.message).join('; ') || 'tiene un defecto bloqueante o un documento vencido'
    : null;

  const [step, setStep] = useState<FlowStep>('checklist');
  const [answers, setAnswers] = useState<Record<string, ChecklistItemState>>({});
  const [notes, setNotes] = useState('');
  const [showValidation, setShowValidation] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [hasBlockingDefect, setHasBlockingDefect] = useState(false);
  const [blockedTrailerPlate, setBlockedTrailerPlate] = useState<string | null>(null);
  const [trailerForm, setTrailerForm] = useState<TrailerForm>({ trailerId: null, answers: {}, tires: {} });
  const trailerState: TrailerForm =
    trailerForm.trailerId === towedTrailerId ? trailerForm : { trailerId: towedTrailerId, answers: {}, tires: {} };
  const driverName = getUsername();

  function stateOf(def: ChecklistItemDef): ChecklistItemState {
    return answers[def.id] ?? initialState(def);
  }

  function trailerStateOf(def: ChecklistItemDef): ChecklistItemState {
    return trailerState.answers[def.id] ?? initialState(def);
  }

  const defectCount = checkItems.filter((def) => stateOf(def).outcome === 'defect').length;
  const tiresInDefect = items.some((def) => def.id === TIRES_ITEM_ID && stateOf(def).outcome === 'defect');
  const tireConditions = tiresInDefect ? toTireConditions(tireValues) : [];
  // Con el dibujo disponible, hay que decir qué neumático es.
  const tiresValid = !tiresInDefect || !canPickTires || tireConditions.length > 0;

  const trailerDefectCount = trailerCheckItems.filter((def) => trailerStateOf(def).outcome === 'defect').length;
  const trailerTiresInDefect = activeTrailerItems.some(
    (def) => def.id === trailerTiresItemId && trailerStateOf(def).outcome === 'defect',
  );
  const trailerTireConditions = trailerTiresInDefect ? toTireConditions(trailerState.tires) : [];
  const trailerTiresValid = !trailerTiresInDefect || !canPickTrailerTires || trailerTireConditions.length > 0;
  const trailerReady = !towedTrailerId || trailerCollapsed || (trailerChecklist.items !== null && !trailerBlockedReason);
  const totalChecks = checkItems.length + trailerCheckItems.length;
  const totalDefects = defectCount + trailerDefectCount;

  const allValid =
    items.every((def) => isItemValid(def, stateOf(def))) &&
    tiresValid &&
    trailerReady &&
    activeTrailerItems.every((def) => isItemValid(def, trailerStateOf(def))) &&
    trailerTiresValid;

  function updateItem(id: string, next: ChecklistItemState) {
    setAnswers((prev) => ({ ...prev, [id]: next }));
  }

  function updateTires(next: TireConditionValue) {
    setTireValues(next);
    // Si el chofer todavía no escribió el título del defecto, se completa con lo primero que marcó.
    const first = toTireConditions(next)[0]?.conditions[0];
    setAnswers((prev) => {
      const current = prev[TIRES_ITEM_ID];
      if (!first || !current?.defect || current.defect.description.trim()) return prev;
      return { ...prev, [TIRES_ITEM_ID]: { ...current, defect: { ...current.defect, description: tireConditionLabel(first) } } };
    });
  }

  function updateTrailerForm(change: (form: TrailerForm) => TrailerForm) {
    setTrailerForm((prev) =>
      change(prev.trailerId === towedTrailerId ? prev : { trailerId: towedTrailerId, answers: {}, tires: {} }),
    );
  }

  function updateTrailerItem(id: string, next: ChecklistItemState) {
    updateTrailerForm((form) => ({ ...form, answers: { ...form.answers, [id]: next } }));
  }

  function updateTrailerTires(next: TireConditionValue) {
    const first = toTireConditions(next)[0]?.conditions[0];
    updateTrailerForm((form) => {
      const current = form.answers[trailerTiresItemId];
      if (!first || !current?.defect || current.defect.description.trim()) return { ...form, tires: next };
      const titled = { ...current, defect: { ...current.defect, description: tireConditionLabel(first) } };
      return { ...form, tires: next, answers: { ...form.answers, [trailerTiresItemId]: titled } };
    });
  }

  function handleContinue() {
    if (!allValid) {
      setShowValidation(true);
      return;
    }
    setShowValidation(false);
    setStep('summary');
  }

  const summaryData = useMemo(() => {
    const list: ChecklistAnswer[] = checkItems.map((def) => {
      const state = answers[def.id] ?? initialState(def);
      return {
        itemId: def.id,
        label: def.label,
        section: def.section,
        type: def.type,
        outcome: state.outcome,
        defect: state.defect,
      };
    });
    // CAM-159: los del remolque, marcados para no confundirlos con los del vehículo.
    for (const def of trailerCheckItems) {
      const state = trailerState.answers[def.id] ?? initialState(def);
      list.push({
        itemId: `trailer:${def.id}`,
        label: `Remolque: ${def.label}`,
        section: def.section,
        type: def.type,
        outcome: state.outcome,
        defect: state.defect,
      });
    }
    const defects = list.filter((a) => a.outcome === 'defect');
    const okCount = list.filter((a) => a.outcome === 'ok').length;
    const anyBlocking = defects.some((d) => d.defect?.severity === 'blocking');
    const status: RingStatus = anyBlocking ? 'critical' : defects.length > 0 ? 'warn' : 'ok';
    return { list, defects, okCount, total: list.length, status, anyBlocking };
  }, [answers, checkItems, trailerCheckItems, trailerState.answers]);

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    const fullAnswers: ChecklistAnswer[] = items.map((def) => {
      const state = stateOf(def);
      return {
        itemId: def.id,
        label: def.label,
        section: def.section,
        type: def.type,
        outcome: state.outcome,
        numberValue: state.numberValue,
        defect: state.defect,
      };
    });
    // En el post-viaje con el remolque en OK, se manda todo en OK: queda su post-viaje en el historial.
    const fullTrailerAnswers: ChecklistAnswer[] = trailerItems.map((def) => {
      const state = trailerCollapsed ? initialState(def) : trailerStateOf(def);
      return {
        itemId: def.id,
        label: def.label,
        section: def.section,
        type: def.type,
        outcome: state.outcome,
        numberValue: state.numberValue,
        defect: state.defect,
      };
    });

    // CAM-153: la hora en que la hizo y un id para que un reintento no la duplique.
    const meta = {
      performedAt: new Date().toISOString(),
      clientSubmissionId: newUuid(),
      tireConditions: tireConditions.length > 0 ? tireConditions : undefined,
      trailerId,
      trailerAnswers: towedTrailerId && trailerItems.length > 0 ? fullTrailerAnswers : undefined,
      trailerTireConditions: trailerTireConditions.length > 0 ? trailerTireConditions : undefined,
    };
    const queue = () =>
      enqueueInspection({
        id: meta.clientSubmissionId,
        vehicleId: vehicle.id,
        plate: vehicle.plate,
        type,
        answers: fullAnswers,
        notes: notes.trim() || undefined,
        performedAt: meta.performedAt,
        tireConditions: meta.tireConditions,
        trailerId: meta.trailerId,
        trailerAnswers: meta.trailerAnswers,
        trailerTireConditions: meta.trailerTireConditions,
      });

    try {
      // Sin señal, con una foto que no se pudo subir, o con otras esperando (para respetar el orden): a la cola.
      const mustQueue =
        !navigator.onLine ||
        [...fullAnswers, ...fullTrailerAnswers].some((a) => a.defect?.pendingPhoto) ||
        (await hasPendingInspections());
      if (mustQueue) {
        await queue();
        setStep('queued');
        return;
      }
      const { inspection, trailerInspection } = await submitInspection(
        vehicle.id,
        type,
        fullAnswers,
        notes.trim() || undefined,
        meta,
      );
      const trailerBlocking = Boolean(trailerInspection?.hasBlockingDefect);
      setHasBlockingDefect(inspection.hasBlockingDefect || trailerBlocking);
      setBlockedTrailerPlate(trailerBlocking && !inspection.hasBlockingDefect ? (towedTrailer?.plate ?? 'que llevás') : null);
      setStep('success');
    } catch (err) {
      if (isNetworkError(err)) {
        await queue();
        setStep('queued');
        return;
      }
      const unavailable = err instanceof ApiError && err.status === 409 && UNAVAILABLE_MESSAGES[err.errorCode ?? ''];
      if (err instanceof ApiError && err.status === 409 && err.errorCode === 'TRAILER_BLOCKED') {
        // CAM-159: se queda en el pre-viaje para que elija otro remolque o salga sin remolque.
        setSubmitError(`${err.message} Volvé y elegí otro remolque o salí sin remolque.`);
      } else if (unavailable) {
        // CAM-89: no tiene sentido reintentar; se avisa y se vuelve a la flota, ya actualizada. Si está
        // bloqueado, el backend dice por qué (CAM-127: defecto o documento vencido).
        const blockedByServer = err.errorCode === 'VEHICLE_BLOCKED' && err.message.startsWith(vehicle.plate);
        onUnavailable(`No se envió la inspección: ${blockedByServer ? err.message : `${vehicle.plate} ${unavailable}`}`);
      } else if (isSessionExpired(err)) {
        // CAM-85: el chofer de la inspección sale del token, así que sin sesión no se puede enviar.
        setSessionExpired(true);
      } else {
        setSubmitError(describeApiError(err, 'No se pudo enviar la inspección. Intentá de nuevo.'));
      }
    } finally {
      setSubmitting(false);
    }
  }

  const now = useMemo(() => new Date(), []);
  const dateLabel = now.toLocaleDateString('es-AR');
  const timeLabel = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

  if (!loadedItems) {
    return (
      <div className="screen">
        <p className="muted">Cargando checklist…</p>
      </div>
    );
  }

  if (step === 'queued') {
    return (
      <div className="screen screen--success">
        <div className="success-icon success-icon--ok">
          <ShieldCheckIcon />
        </div>
        <h1 className="screen__title">Inspección guardada</h1>
        <p className="screen__subtitle">
          {`El ${type === 'post-trip' ? 'post-viaje' : 'pre-viaje'} de ${vehicle.plate} quedó guardado en el celular. `}
          Se envía solo cuando vuelva la señal, en el orden en que hiciste las inspecciones.
        </p>
        {summaryData.anyBlocking && (
          <div className="alert alert--critical">
            <AlertOctagonIcon className="alert__icon" />
            <span>Reportaste un defecto bloqueante: no salgas con el vehículo. Mantenimiento se entera al enviarse.</span>
          </div>
        )}
        <button type="button" className="primary-btn" onClick={onDone}>
          Volver a la flota
        </button>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="screen screen--success">
        <div className="success-icon success-icon--ok">
          <ShieldCheckIcon />
        </div>
        <h1 className="screen__title">Inspección enviada</h1>
        <p className="screen__subtitle">
          {type === 'post-trip'
            ? `El post-viaje de ${vehicle.plate} quedó registrado. El viaje fue cerrado.`
            : blockedTrailerPlate
              ? `El pre-viaje de ${vehicle.plate} quedó registrado. El remolque ${blockedTrailerPlate} tiene un defecto bloqueante: no salen hasta que se resuelva.`
              : hasBlockingDefect
              ? `El pre-viaje de ${vehicle.plate} quedó registrado. El vehículo no sale: queda no disponible hasta que se resuelva el defecto.`
              : `El pre-viaje de ${vehicle.plate} quedó registrado. Buen viaje.`}
        </p>

        {hasBlockingDefect && (
          <div className="alert alert--critical">
            <AlertOctagonIcon className="alert__icon" />
            <span>Mantenimiento fue notificado — vehículo no apto para circular.</span>
          </div>
        )}

        <button type="button" className="primary-btn" onClick={onDone}>
          Volver a la flota
        </button>
      </div>
    );
  }

  if (step === 'summary') {
    return (
      <div className="screen">
        <header className="screen__header">
          <h1 className="screen__title">Resumen</h1>
          <p className="screen__subtitle vehicle-meta">
            <span className="vehicle-meta__plate">{vehicle.plate}</span> · {driverName ? `${driverName} · ` : ''}
            {dateLabel} {timeLabel}
          </p>
        </header>

        <div className="summary-ring">
          <HealthRing okCount={summaryData.okCount} total={summaryData.total} status={summaryData.status} />
        </div>

        {summaryData.defects.length > 0 ? (
          <div className="summary-defects">
            <h2 className="section-title">Defectos reportados</h2>
            <ul className="defect-summary-list">
              {summaryData.defects.map((a) => (
                <li key={a.itemId} className="defect-summary-item">
                  <span className="defect-summary-item__label">{a.label}</span>
                  <span
                    className={`severity-tag severity-tag--${a.defect?.severity === 'blocking' ? 'blocking' : 'non-blocking'}`}
                  >
                    {a.defect?.severity === 'blocking' ? 'Bloqueante' : 'No bloqueante'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="muted summary-no-defects">Sin defectos reportados. Todo en orden.</p>
        )}

        {tireConditions.length > 0 && (
          <ul className="tire-picker__summary">
            {tireConditions.map((t) => (
              <li key={t.position}>
                <strong>{tirePositions?.positions.find((p) => p.position === t.position)?.label ?? t.position}:</strong>{' '}
                {t.conditions.map(tireConditionLabel).join(', ').toLowerCase()}
              </li>
            ))}
          </ul>
        )}
        {trailerCollapsed && towedTrailerId && (
          <p className="muted">Remolque {towedTrailer?.plate ?? ''}: volvió en OK.</p>
        )}
        {trailerTireConditions.length > 0 && (
          <ul className="tire-picker__summary">
            {trailerTireConditions.map((t) => (
              <li key={t.position}>
                <strong>
                  Remolque, {trailerTirePositions?.positions.find((p) => p.position === t.position)?.label ?? t.position}:
                </strong>{' '}
                {t.conditions.map(tireConditionLabel).join(', ').toLowerCase()}
              </li>
            ))}
          </ul>
        )}

        <label className="confirm-check">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
          Declaro que la información es correcta
        </label>

        {submitError && <p className="error-banner">{submitError}</p>}
        {sessionExpired && (
          <div className="error-banner session-expired">
            <p>{SESSION_EXPIRED_MESSAGE}</p>
            <button type="button" className="secondary-btn" onClick={onLogout}>
              Cerrar sesión
            </button>
          </div>
        )}

        <div className="screen__actions">
          <button type="button" className="secondary-btn" onClick={() => setStep('checklist')} disabled={submitting}>
            Volver
          </button>
          <button type="button" className="primary-btn" onClick={handleSubmit} disabled={!confirmed || submitting}>
            {submitting ? 'Enviando…' : 'Enviar inspección'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <header className="screen__header">
        <h1 className="screen__title">{type === 'pre-trip' ? 'Pre-viaje' : 'Post-viaje'}</h1>
        <p className="screen__subtitle vehicle-meta">
          <span className="vehicle-meta__plate">{vehicle.plate}</span> · {driverName ? `${driverName} · ` : ''}
          {dateLabel} {timeLabel}
        </p>
        <p className={`checklist-status${totalDefects > 0 ? ' checklist-status--defects' : ''}`}>
          {totalDefects > 0 ? (
            <AlertTriangleIcon className="checklist-status__icon" />
          ) : (
            <CheckCircleIcon className="checklist-status__icon" />
          )}
          <span className="checklist-status__text">
            {totalDefects === 0
              ? `${totalChecks} controles en OK`
              : `${totalDefects} de ${totalChecks} con defecto`}
          </span>
          {totalDefects === 0 && <span className="checklist-status__hint">Marcá solo lo que tenga un defecto.</span>}
        </p>
      </header>

      {groupBySection(items).map(([section, sectionItems]) => (
        <section key={section} className="checklist-section">
          <h2 className="section-title">{SECTION_LABEL[section]}</h2>
          <div className="checklist-section__items">
            {sectionItems.map((def) => (
              <ChecklistItemCard
                key={def.id}
                def={def}
                state={stateOf(def)}
                onChange={(next) => updateItem(def.id, next)}
                showValidation={showValidation}
                defectExtra={
                  def.id === TIRES_ITEM_ID && canPickTires && tirePositions ? (
                    <TireConditionPicker
                      tires={tirePositions}
                      value={tireValues}
                      onChange={updateTires}
                      invalid={showValidation && !tiresValid}
                    />
                  ) : undefined
                }
              />
            ))}
          </div>
        </section>
      ))}

      {tows && trailerChoice !== null && (trailers.length > 0 || trailerChoice !== 'none') && (
        <TrailerPicker trailers={trailers} value={trailerChoice} onChange={setTrailerChoice} />
      )}

      {towedTrailerId && (
        <section className="checklist-section" aria-label="Checklist del remolque">
          <h2 className="section-title">Remolque {towedTrailer?.plate ?? ''}</h2>
          {type === 'post-trip' && (
            <label className="confirm-check">
              <input type="checkbox" checked={trailerOk} onChange={(e) => setTrailerOk(e.target.checked)} />
              El remolque volvió en OK
            </label>
          )}
          {trailerCollapsed ? null : trailerBlockedReason ? (
            <p className="error-banner">
              {towedTrailer?.plate} no puede salir: {trailerBlockedReason}. Elegí otro remolque o salí sin remolque.
            </p>
          ) : !trailerChecklist.items ? (
            <p className="muted">Cargando el checklist del remolque…</p>
          ) : (
            <div className="checklist-section__items">
              {trailerItems.map((def) => (
                <ChecklistItemCard
                  key={def.id}
                  def={def}
                  state={trailerStateOf(def)}
                  onChange={(next) => updateTrailerItem(def.id, next)}
                  showValidation={showValidation}
                  defectExtra={
                    def.id === trailerTiresItemId && canPickTrailerTires && trailerTirePositions ? (
                      <TireConditionPicker
                        tires={trailerTirePositions}
                        value={trailerState.tires}
                        onChange={updateTrailerTires}
                        invalid={showValidation && !trailerTiresValid}
                      />
                    ) : undefined
                  }
                />
              ))}
            </div>
          )}
        </section>
      )}

      {type === 'post-trip' && (
        <section className="checklist-section">
          <h2 className="section-title">Novedades</h2>
          <div className="checklist-item">
            <label className="checklist-item__label" htmlFor="post-notes">
              Detalle de problemas / novedades (opcional)
            </label>
            <textarea
              id="post-notes"
              className="defect-textarea"
              rows={3}
              placeholder="Contanos si hubo algún problema durante el viaje"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </section>
      )}

      <div className="screen__actions">
        <button type="button" className="secondary-btn" onClick={onBack}>
          Volver
        </button>
        <button type="button" className="primary-btn" onClick={handleContinue}>
          Continuar
        </button>
      </div>
    </div>
  );
}
