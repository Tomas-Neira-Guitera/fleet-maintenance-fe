import { useEffect, useState } from 'react';
import { savePushSubscription, sendTestPush } from '../services/pushService';
import { describeApiError } from '../services/apiClient';
import { disablePush, enablePush, getCurrentSubscription, isPushSupported } from '../utils/webPush';

type PushStatus = 'checking' | 'off' | 'on' | 'denied' | 'unavailable';

function initialStatus(): PushStatus {
  return Notification.permission === 'denied' ? 'denied' : 'checking';
}

/**
 * Pie del panel de avisos (CAM-119): activar o desactivar las push en este navegador, para que los
 * avisos lleguen aunque FleetGuard esté cerrado. No se muestra si el navegador no las soporta
 * (o si la página no está en HTTPS ni en localhost).
 */
export function PushToggle() {
  if (!isPushSupported()) return null;
  return <PushToggleSupported />;
}

function PushToggleSupported() {
  const [status, setStatus] = useState<PushStatus>(initialStatus);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status !== 'checking') return;
    getCurrentSubscription().then(
      (subscription) => {
        setStatus(subscription ? 'on' : 'off');
        // Si este navegador ya estaba suscripto, se reafirma que es del usuario que está ahora.
        if (subscription) savePushSubscription(subscription.toJSON()).catch(() => undefined);
      },
      () => setStatus('off'),
    );
  }, [status]);

  async function handleEnable() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await enablePush();
      setStatus(result === 'enabled' ? 'on' : result);
    } catch (err) {
      setMessage(describeApiError(err, 'No se pudieron activar las notificaciones.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable() {
    setBusy(true);
    setMessage(null);
    await disablePush();
    setStatus('off');
    setBusy(false);
  }

  async function handleTest() {
    setBusy(true);
    setMessage(null);
    try {
      const delivered = await sendTestPush();
      setMessage(
        delivered > 0
          ? 'Listo: en unos segundos tiene que aparecer la notificación.'
          : 'No llegó a ningún dispositivo. Desactivá y volvé a activar.',
      );
    } catch (err) {
      setMessage(describeApiError(err, 'No se pudo mandar la notificación de prueba.'));
    } finally {
      setBusy(false);
    }
  }

  if (status === 'checking') return null;

  return (
    <div className="push-toggle">
      {status === 'off' && (
        <>
          <p className="push-toggle__text">Recibí estos avisos aunque FleetGuard esté cerrado.</p>
          <button type="button" className="push-toggle__button" onClick={() => void handleEnable()} disabled={busy}>
            Activar en este dispositivo
          </button>
        </>
      )}
      {status === 'on' && (
        <>
          <p className="push-toggle__text">Notificaciones activadas en este dispositivo.</p>
          <div className="push-toggle__actions">
            <button type="button" className="push-toggle__button" onClick={() => void handleTest()} disabled={busy}>
              Mandar una de prueba
            </button>
            <button
              type="button"
              className="push-toggle__button push-toggle__button--secondary"
              onClick={() => void handleDisable()}
              disabled={busy}
            >
              Desactivar
            </button>
          </div>
        </>
      )}
      {status === 'denied' && (
        <p className="push-toggle__text">
          Bloqueaste las notificaciones de FleetGuard en este navegador. Para recibirlas, habilitalas desde el
          candado de la barra de direcciones.
        </p>
      )}
      {status === 'unavailable' && (
        <p className="push-toggle__text">El servidor no tiene las notificaciones configuradas.</p>
      )}
      {message && (
        <p className="push-toggle__text push-toggle__message" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
