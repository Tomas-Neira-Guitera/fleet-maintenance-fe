import type { TirePositionRef } from '../types/domain';
import { TireIcon } from './icons';
import '../styles/tires.css';

interface TreadReadingsCardProps {
  positions: TirePositionRef[];
  /** mm por posición, como los tipea el chofer ("4,5"). */
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  invalid: boolean;
}

/** CAM-157: en el pre-viaje, el chofer puede anotar la profundidad del dibujo de cada cubierta. Opcional. */
export function TreadReadingsCard({ positions, values, onChange, invalid }: TreadReadingsCardProps) {
  return (
    <section className="checklist-section">
      <h2 className="section-title">Dibujo de las cubiertas (opcional)</h2>
      <div className={`checklist-item tread-card${invalid ? ' checklist-item--invalid' : ''}`}>
        <p className="tread-card__hint">
          <TireIcon className="tread-card__icon" aria-hidden="true" />
          Si tenés el medidor, anotá la profundidad en mm. Lo que dejes vacío no se manda.
        </p>
        <ul className="tread-card__list">
          {positions.map((p) => (
            <li key={p.position} className="tread-card__row">
              <label htmlFor={`tread-${p.position}`}>{p.label}</label>
              <span className="tread-card__input">
                <input
                  id={`tread-${p.position}`}
                  type="text"
                  inputMode="decimal"
                  className="number-input"
                  value={values[p.position] ?? ''}
                  onChange={(e) => onChange({ ...values, [p.position]: e.target.value })}
                  maxLength={4}
                />
                <span aria-hidden="true">mm</span>
              </span>
            </li>
          ))}
        </ul>
        {invalid && <p className="field-error">Entre 0 y 30 mm, con hasta un decimal (ej: 4,5).</p>}
      </div>
    </section>
  );
}
