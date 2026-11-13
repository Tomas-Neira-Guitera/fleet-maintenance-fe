import { useEffect, useId, useRef } from 'react';
import type { Vehicle } from '../types/domain';
import { AlertTriangleIcon } from './icons';

interface ScheduledTodayWarningProps {
  vehicle: Vehicle;
  /** "15:00", ya en hora argentina. */
  time: string;
  onContinue: () => void;
  onCancel: () => void;
}

/**
 * CAM-143: antes del pre-viaje de un vehículo con turno de taller hoy. No bloquea: el turno puede ser a última
 * hora, y quien decide es el chofer. Se llega igual por la lista o por el QR (CAM-133).
 * El foco arranca en la opción segura ("Elegir otro"), no sale de la advertencia con Tab y, al cerrarla,
 * vuelve a donde estaba (la tarjeta del vehículo).
 */
export function ScheduledTodayWarning({ vehicle, time, onContinue, onCancel }: ScheduledTodayWarningProps) {
  const titleId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCancel();
        return;
      }
      if (event.key !== 'Tab' || !cardRef.current) return;
      const buttons = Array.from(cardRef.current.querySelectorAll<HTMLButtonElement>('button'));
      if (buttons.length === 0) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      const inside = cardRef.current.contains(document.activeElement);
      if (event.shiftKey && (document.activeElement === first || !inside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !inside)) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      // Si se sigue al pre-viaje, la tarjeta ya no está y esto no hace nada.
      if (previous?.isConnected) previous.focus();
    };
  }, [onCancel]);

  return (
    <div className="schedule-warning" role="alertdialog" aria-modal="true" aria-labelledby={titleId}>
      <div ref={cardRef} className="schedule-warning__card">
        <AlertTriangleIcon className="schedule-warning__icon" aria-hidden="true" />
        <h2 id={titleId} className="schedule-warning__title">
          {vehicle.plate} tiene turno de taller hoy a las {time}
        </h2>
        <p className="schedule-warning__text">¿Salís igual?</p>
        <div className="schedule-warning__actions">
          <button ref={cancelRef} type="button" className="secondary-btn" onClick={onCancel}>
            Elegir otro
          </button>
          <button type="button" className="primary-btn" onClick={onContinue}>
            Salir igual
          </button>
        </div>
      </div>
    </div>
  );
}
