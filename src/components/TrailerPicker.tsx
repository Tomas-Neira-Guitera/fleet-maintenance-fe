import type { Vehicle } from '../types/domain';
import { vehicleTypeLabel } from '../utils/vehicleTypes';
import '../styles/tires.css';

interface TrailerPickerProps {
  /** Los remolques que puede arrastrar este vehículo. */
  trailers: Vehicle[];
  /** Id del remolque, o "none" si va sin remolque. */
  value: string;
  onChange: (value: string) => void;
}

/** CAM-157: en el pre-viaje de un tractor o camión rígido, qué remolque lleva. El remolque suma los km del viaje. */
export function TrailerPicker({ trailers, value, onChange }: TrailerPickerProps) {
  return (
    <section className="checklist-section">
      <h2 className="section-title">Remolque</h2>
      <div className="checklist-item">
        <label className="checklist-item__label" htmlFor="trailer-picker">
          ¿Qué remolque llevás?
        </label>
        <select
          id="trailer-picker"
          className="number-input trailer-picker__select"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="none">Sin remolque</option>
          {trailers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.plate} · {vehicleTypeLabel(t.vehicleType)}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}
