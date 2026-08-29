import { useMemo, useState } from 'react';
import { getPreTripItems, POST_TRIP_ITEMS } from '../checklist/checklistDefinitions';
import { CURRENT_DRIVER_NAME } from '../services/vehiclesService';
import { submitPostTrip, submitPreTrip } from '../services/inspectionsService';
import type {
  ChecklistAnswer,
  ChecklistItemDef,
  ChecklistItemState,
  ChecklistSection,
  InspectionType,
  Vehicle,
} from '../types/domain';
import { ChecklistItemCard } from './ChecklistItemCard';
import { HealthRing, type RingStatus } from './HealthRing';
import { AlertOctagonIcon, ShieldCheckIcon } from './icons';

interface InspectionFlowProps {
  vehicle: Vehicle;
  type: InspectionType;
  tripId?: string;
  onDone: () => void;
}

type FlowStep = 'checklist' | 'summary' | 'success';

const SECTION_LABEL: Record<ChecklistSection, string> = {
  exterior: 'Inspección visual (exterior)',
  interior: 'Inspección interior (cabina)',
  accesorios: 'Accesorios del vehículo',
  posttrip: 'Estado del vehículo',
};

function groupBySection(items: ChecklistItemDef[]): [ChecklistSection, ChecklistItemDef[]][] {
  const order: ChecklistSection[] = ['exterior', 'interior', 'accesorios', 'posttrip'];
  return order
    .map((section) => [section, items.filter((i) => i.section === section)] as [ChecklistSection, ChecklistItemDef[]])
    .filter(([, sectionItems]) => sectionItems.length > 0);
}

function isItemValid(def: ChecklistItemDef, state: ChecklistItemState): boolean {
  if (def.type === 'number') {
    return def.required ? Boolean(state.numberValue?.trim()) : true;
  }
  if (!state.outcome) return false;
  if (state.outcome === 'ok') return true;
  const defect = state.defect;
  if (!defect || !defect.description.trim()) return false;
  if (defect.severity === 'blocking' && !defect.photoDataUrl) return false;
  return true;
}

export function InspectionFlow({ vehicle, type, tripId, onDone }: InspectionFlowProps) {
  const items = useMemo(
    () => (type === 'pre-trip' ? getPreTripItems(vehicle.accessories) : POST_TRIP_ITEMS),
    [type, vehicle.accessories],
  );
  const checkItems = useMemo(() => items.filter((i) => i.type === 'check'), [items]);
  const kmItemId = type === 'pre-trip' ? 'int-km' : 'post-km';

  const [step, setStep] = useState<FlowStep>('checklist');
  const [answers, setAnswers] = useState<Record<string, ChecklistItemState>>({});
  const [notes, setNotes] = useState('');
  const [showValidation, setShowValidation] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [hasBlockingDefect, setHasBlockingDefect] = useState(false);

  const answeredCheckCount = checkItems.filter((def) => answers[def.id]?.outcome).length;
  const allValid = items.every((def) => isItemValid(def, answers[def.id] ?? {}));

  function updateItem(id: string, next: ChecklistItemState) {
    setAnswers((prev) => ({ ...prev, [id]: next }));
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
      const state = answers[def.id] ?? {};
      return {
        itemId: def.id,
        label: def.label,
        section: def.section,
        type: def.type,
        outcome: state.outcome,
        defect: state.defect,
      };
    });
    const defects = list.filter((a) => a.outcome === 'defect');
    const okCount = list.filter((a) => a.outcome === 'ok').length;
    const anyBlocking = defects.some((d) => d.defect?.severity === 'blocking');
    const status: RingStatus = anyBlocking ? 'critical' : defects.length > 0 ? 'warn' : 'ok';
    return { list, defects, okCount, total: list.length, status, anyBlocking };
  }, [answers, checkItems]);

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    const kmValue = Number(answers[kmItemId]?.numberValue ?? 0);
    const fullAnswers: ChecklistAnswer[] = items.map((def) => {
      const state = answers[def.id] ?? {};
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

    try {
      if (type === 'pre-trip') {
        const { inspection } = await submitPreTrip({
          vehicleId: vehicle.id,
          driverName: CURRENT_DRIVER_NAME,
          type: 'pre-trip',
          timestamp: new Date().toISOString(),
          odometerKm: kmValue,
          answers: fullAnswers,
        });
        setHasBlockingDefect(inspection.hasBlockingDefect);
      } else if (tripId) {
        const { inspection } = await submitPostTrip(
          {
            vehicleId: vehicle.id,
            driverName: CURRENT_DRIVER_NAME,
            type: 'post-trip',
            timestamp: new Date().toISOString(),
            odometerKm: kmValue,
            answers: fullAnswers,
            notes: notes.trim() || undefined,
          },
          tripId,
        );
        setHasBlockingDefect(inspection.hasBlockingDefect);
      }
      setStep('success');
    } catch {
      setSubmitError('No se pudo enviar la inspección. Intentá de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  const now = useMemo(() => new Date(), []);
  const dateLabel = now.toLocaleDateString('es-AR');
  const timeLabel = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

  if (step === 'success') {
    return (
      <div className="screen screen--success">
        <div className="success-icon success-icon--ok">
          <ShieldCheckIcon />
        </div>
        <h1 className="screen__title">Inspección enviada</h1>
        <p className="screen__subtitle">
          {type === 'pre-trip'
            ? `El pre-viaje de ${vehicle.plate} quedó registrado. Buen viaje.`
            : `El post-viaje de ${vehicle.plate} quedó registrado. El viaje fue cerrado.`}
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
            <span className="vehicle-meta__plate">{vehicle.plate}</span> · {CURRENT_DRIVER_NAME} · {dateLabel}{' '}
            {timeLabel}
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

        <label className="confirm-check">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
          Declaro que la información es correcta
        </label>

        {submitError && <p className="error-banner">{submitError}</p>}

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
          <span className="vehicle-meta__plate">{vehicle.plate}</span> · {CURRENT_DRIVER_NAME} · {dateLabel}{' '}
          {timeLabel}
        </p>
        <div className="progress-indicator">
          <div className="progress-indicator__bar">
            <div
              className="progress-indicator__fill"
              style={{ width: `${checkItems.length ? (answeredCheckCount / checkItems.length) * 100 : 100}%` }}
            />
          </div>
          <span className="progress-indicator__label">
            {answeredCheckCount}/{checkItems.length}
          </span>
        </div>
      </header>

      {groupBySection(items).map(([section, sectionItems]) => (
        <section key={section} className="checklist-section">
          <h2 className="section-title">{SECTION_LABEL[section]}</h2>
          <div className="checklist-section__items">
            {sectionItems.map((def) => (
              <ChecklistItemCard
                key={def.id}
                def={def}
                state={answers[def.id] ?? {}}
                onChange={(next) => updateItem(def.id, next)}
                showValidation={showValidation}
              />
            ))}
          </div>
        </section>
      ))}

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
        <button type="button" className="primary-btn" onClick={handleContinue}>
          Continuar
        </button>
      </div>
    </div>
  );
}
