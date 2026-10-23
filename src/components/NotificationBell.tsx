import { useCallback, useEffect, useRef, useState } from 'react';
import { BellIcon, CloseIcon } from './icons';
import { Popover } from './datetime/Popover';
import { PushToggle } from './PushToggle';
import {
  dismissNotification,
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/notificationsService';
import { isSessionExpired, SESSION_EXPIRED_MESSAGE } from '../services/apiClient';
import { formatRelativeReportTime } from '../utils/relativeTime';
import type { UserNotification } from '../types/domain';

/** Cada cuánto se vuelve a pedir el número de sin leer. Sin WebSockets (CAM-96, fuera de alcance). */
const POLL_MS = 60_000;

interface NotificationBellProps {
  /**
   * Qué hacer con el link de un aviso, por ejemplo navegar a esa pantalla del admin. Sin esto (el
   * chofer y el técnico viven en "/"), tocar un aviso solo lo marca como leído.
   */
  onOpenLink?: (link: string) => void;
}

/**
 * Campanita de avisos in-app (CAM-96), la misma para los tres roles. El número de sin leer se
 * refresca cada minuto mientras la pestaña está a la vista; la lista se pide recién al abrirla.
 */
export function NotificationBell({ onOpenLink }: NotificationBellProps) {
  // null: todavía no se sabe o no se pudo consultar; la campanita se muestra igual, sin número.
  const [unread, setUnread] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<UserNotification[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Error de "Marcar todo como leído": se muestra arriba de la lista, sin taparla.
  const [actionError, setActionError] = useState<string | null>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);
  // Con la sesión vencida (401) se deja de consultar: no va a cambiar hasta volver a entrar.
  const sessionExpiredRef = useRef(false);

  // Con .then y no async/await: así el efecto que lo llama no hace un setState sincrónico (lint).
  const refreshCount = useCallback(
    () =>
      getUnreadNotificationCount().then(
        (count) => setUnread(count),
        (err: unknown) => {
          if (isSessionExpired(err)) sessionExpiredRef.current = true;
          setUnread(null);
        },
      ),
    [],
  );

  useEffect(() => {
    void refreshCount();
    const timer = window.setInterval(() => {
      if (!document.hidden && !sessionExpiredRef.current) void refreshCount();
    }, POLL_MS);
    // Al volver a la pestaña no se espera al próximo minuto.
    function handleVisibility() {
      if (!document.hidden && !sessionExpiredRef.current) void refreshCount();
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [refreshCount]);

  async function loadList() {
    setItems(null);
    setError(null);
    try {
      setItems(await getNotifications());
    } catch (err) {
      setError(isSessionExpired(err) ? SESSION_EXPIRED_MESSAGE : 'No se pudieron cargar los avisos.');
    }
  }

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) anchorRef.current?.focus();
  }, []);

  function toggle() {
    if (open) {
      close(false);
      return;
    }
    setOpen(true);
    setActionError(null);
    void loadList();
    void refreshCount();
  }

  function markLocallyRead(ids: Set<string>) {
    const now = new Date().toISOString();
    setItems((current) => current?.map((n) => (ids.has(n.id) && !n.readAt ? { ...n, readAt: now } : n)) ?? null);
  }

  function handleSelect(notification: UserNotification) {
    if (!notification.readAt) {
      // Se marca en el momento; si el backend no lo confirma, el número se corrige con el próximo conteo.
      markLocallyRead(new Set([notification.id]));
      setUnread((count) => (count === null ? null : Math.max(0, count - 1)));
      markNotificationRead(notification.id).catch(() => void refreshCount());
    }
    if (notification.link && onOpenLink) {
      // El foco vuelve a la campanita: si no, al cerrarse el panel queda perdido en la página.
      close(true);
      onOpenLink(notification.link);
    }
  }

  async function handleDismiss(notification: UserNotification) {
    const previous = items;
    setActionError(null);
    setItems((current) => current?.filter((n) => n.id !== notification.id) ?? null);
    if (!notification.readAt) setUnread((count) => (count === null ? null : Math.max(0, count - 1)));
    try {
      await dismissNotification(notification.id);
    } catch {
      setItems(previous);
      setActionError('No se pudo descartar el aviso.');
      void refreshCount();
    }
  }

  async function handleReadAll() {
    const previous = items;
    setActionError(null);
    markLocallyRead(new Set(items?.map((n) => n.id) ?? []));
    setUnread(0);
    try {
      await markAllNotificationsRead();
    } catch {
      // Se vuelve a como estaba: los avisos siguen sin leer en el backend.
      setItems(previous);
      setActionError('No se pudieron marcar los avisos como leídos.');
      void refreshCount();
    }
  }

  const hasUnread = items?.some((n) => !n.readAt) ?? false;
  const badge = unread && unread > 0 ? (unread > 99 ? '99+' : String(unread)) : null;

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className="notification-bell"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={badge ? `Avisos, ${unread} sin leer` : 'Avisos'}
      >
        <BellIcon width={18} height={18} aria-hidden="true" />
        {badge && (
          <span className="notification-bell__badge" aria-hidden="true">
            {badge}
          </span>
        )}
      </button>
      {open && (
        <Popover anchorRef={anchorRef} label="Avisos" onClose={close}>
          <div className="notifications">
            <div className="notifications__header">
              <h2 className="notifications__title" tabIndex={-1} data-autofocus>
                Avisos
              </h2>
              {hasUnread && !error && (
                <button type="button" className="notifications__read-all" onClick={() => void handleReadAll()}>
                  Marcar todo como leído
                </button>
              )}
            </div>
            {actionError && (
              <p className="notifications__state notifications__state--error" role="alert">
                {actionError}
              </p>
            )}
            {error ? (
              <p className="notifications__state notifications__state--error" role="alert">
                {error}
              </p>
            ) : items === null ? (
              <p className="notifications__state">Cargando avisos…</p>
            ) : items.length === 0 ? (
              <p className="notifications__state">No tenés avisos.</p>
            ) : (
              <ul className="notifications__list">
                {items.map((n) => (
                  <li key={n.id} className="notifications__row">
                    <button
                      type="button"
                      className={`notifications__item${n.readAt ? '' : ' notifications__item--unread'}`}
                      onClick={() => handleSelect(n)}
                    >
                      {!n.readAt && <span className="visually-hidden">Sin leer: </span>}
                      <span className="notifications__item-title">{n.title}</span>
                      <span className="notifications__item-message">{n.message}</span>
                      <span className="notifications__item-time">{formatRelativeReportTime(n.createdAt).label}</span>
                    </button>
                    <button
                      type="button"
                      className="notifications__dismiss"
                      onClick={() => void handleDismiss(n)}
                      aria-label={`Descartar aviso: ${n.title}`}
                      title="Descartar"
                    >
                      <CloseIcon width={14} height={14} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <PushToggle />
          </div>
        </Popover>
      )}
    </>
  );
}
