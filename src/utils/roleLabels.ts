import type { Role } from '../types/domain';

/** Nombre de cada rol tal como se muestra en la gestión de usuarios (CAM-23). */
export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Administrador',
  CHOFER: 'Chofer',
  TECNICO: 'Técnico',
};
