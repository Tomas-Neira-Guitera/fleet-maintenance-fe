import { useEffect, useState } from 'react';
import { isSessionExpired, SESSION_EXPIRED_MESSAGE } from '../../services/apiClient';
import { getMaintenanceCompliance } from '../../services/downtimeService';
import type { MaintenanceCompliance } from '../../types/domain';
import { formatAvailability, formatHours } from '../../utils/downtimeFormat';
import { numberFormatter } from '../../utils/maintenanceFormat';
import { presetPeriod, type Period } from '../../utils/period';
import { PeriodFilter } from './PeriodFilter';
import '../../styles/dashboard.css';

function plural(count: number, singular: string, pluralForm: string): string {
  return `${numberFormatter.format(count)} ${count === 1 ? singular : pluralForm}`;
}

/**
 * Resumen del admin (CAM-155): si el preventivo se cumple, cuánto tardan en resolverse los defectos y cuántas OTs
 * abiertas se están quedando. Las OTs son la foto de hoy; el resto, del período elegido.
 */
export function MaintenanceComplianceCard() {
  const [period, setPeriod] = useState<Period>(() => presetPeriod('month'));
  const [result, setResult] = useState<{ key: string; data: MaintenanceCompliance | null; error: string | null } | null>(
    null,
  );
  const key = `${period.from.toISOString()}|${period.to.toISOString()}`;

  useEffect(() => {
    let cancelled = false;
    getMaintenanceCompliance(period)
      .then((data) => {
        if (!cancelled) setResult({ key, data, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const error = isSessionExpired(err) ? SESSION_EXPIRED_MESSAGE : 'No se pudieron cargar los indicadores.';
          setResult({ key, data: null, error });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [key, period]);

  const current = result?.key === key ? result : null;
  const data = current?.data ?? null;

  return (
    <section className="availability-card compliance-card">
      <header className="availability-card__header">
        <h2 className="recent-defects-card__title">Cumplimiento del mantenimiento</h2>
        <PeriodFilter period={period} onChange={setPeriod} />
      </header>

      {current?.error && <p className="error-banner">{current.error}</p>}
      {!current && <p className="muted">Cargando indicadores…</p>}
      {data && (
        <dl className="vehicle-costs__stats">
          <div className="vehicle-costs__stat">
            <dt>Preventivos a tiempo</dt>
            {data.preventive.onTimePct == null ? (
              <>
                <dd className="vehicle-costs__value vehicle-costs__value--empty">Sin datos</dd>
                <dd className="vehicle-costs__hint">No se hicieron mantenimientos con uno anterior para comparar</dd>
              </>
            ) : (
              <>
                <dd className="vehicle-costs__value">{formatAvailability(data.preventive.onTimePct)}</dd>
                <dd className="vehicle-costs__hint">
                  {numberFormatter.format(data.preventive.onTime)} de{' '}
                  {plural(data.preventive.onTime + data.preventive.late, 'mantenimiento', 'mantenimientos')}
                  {data.preventive.late > 0 && ` · ${numberFormatter.format(data.preventive.late)} después de vencer`}
                </dd>
              </>
            )}
          </div>
          <div className="vehicle-costs__stat">
            <dt>Resolución de defectos</dt>
            {data.defects.avgHours == null ? (
              <>
                <dd className="vehicle-costs__value vehicle-costs__value--empty">Sin datos</dd>
                <dd className="vehicle-costs__hint">No se resolvieron defectos en el período</dd>
              </>
            ) : (
              <>
                <dd className="vehicle-costs__value">{formatHours(data.defects.avgHours)}</dd>
                <dd className="vehicle-costs__hint">
                  Promedio desde que se reportan · {plural(data.defects.resolved, 'resuelto', 'resueltos')}
                </dd>
              </>
            )}
          </div>
          <div className="vehicle-costs__stat">
            <dt>Órdenes de trabajo abiertas</dt>
            <dd className="vehicle-costs__value">{numberFormatter.format(data.openWorkOrders.total)}</dd>
            <dd className="vehicle-costs__hint">
              Hoy: {numberFormatter.format(data.openWorkOrders.under7Days)} de menos de 7 días ·{' '}
              {numberFormatter.format(data.openWorkOrders.from7To30Days)} de 7 a 30 ·{' '}
              <span className={data.openWorkOrders.over30Days > 0 ? 'compliance-card__overdue' : undefined}>
                {numberFormatter.format(data.openWorkOrders.over30Days)} de más de 30
              </span>
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}
