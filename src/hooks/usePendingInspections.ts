import { useEffect, useState } from 'react';
import { subscribePendingInspections, type PendingState } from '../offline/pendingInspections';

/** CAM-153: las inspecciones guardadas sin señal, actualizadas a medida que se mandan. */
export function usePendingInspections(): PendingState {
  const [state, setState] = useState<PendingState>({ items: [], sessionExpired: false, sentCount: 0 });
  useEffect(() => subscribePendingInspections(setState), []);
  return state;
}
