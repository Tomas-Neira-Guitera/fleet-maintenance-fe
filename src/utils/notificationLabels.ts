import type { NotificationChannel } from '../types/domain';

/** Nombre de cada canal de aviso tal como se muestra (CAM-117). */
export const CHANNEL_LABEL: Record<NotificationChannel, string> = {
  in_app: 'Campanita',
  push: 'Push',
  email: 'Email',
};
