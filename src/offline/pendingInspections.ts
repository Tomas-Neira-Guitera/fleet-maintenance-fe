// CAM-153: inspecciones hechas sin señal. Se guardan en el celular (IndexedDB, con las fotos) y se mandan
// solas, en el orden en que se hicieron, cuando vuelve la conexión. Ver CAM-153-offline-inspections-contract.md
// en el backend.

import { ApiError, describeApiError, getSessionUserId, isNetworkError, isSessionExpired } from '../services/apiClient';
import { submitInspection } from '../services/inspectionsService';
import { uploadDefectPhoto } from '../services/photosService';
import type { ChecklistAnswer, InspectionType, TreadReading } from '../types/domain';

export interface PendingInspection {
  /** También es el clientSubmissionId: con él el servidor reconoce un reintento. */
  id: string;
  userId: string | null;
  vehicleId: string;
  plate: string;
  type: InspectionType;
  answers: ChecklistAnswer[];
  notes?: string;
  performedAt: string;
  /** CAM-157: el dibujo de las cubiertas que anotó en el pre-viaje. */
  treadReadings?: TreadReading[];
  status: 'pending' | 'rejected';
  /** Por qué el servidor la rechazó. */
  error?: string;
}

export type NewPendingInspection = Omit<PendingInspection, 'userId' | 'status' | 'error'>;

interface Store {
  getAll(): Promise<PendingInspection[]>;
  put(item: PendingInspection): Promise<void>;
  remove(id: string): Promise<void>;
}

const DB_NAME = 'fleetguard-offline';
const STORE_NAME = 'inspections';

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function indexedDbStore(): Store {
  let db: Promise<IDBDatabase> | null = null;
  function open(): Promise<IDBDatabase> {
    if (!db) {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
      db = request(req);
    }
    return db;
  }
  async function objectStore(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    return (await open()).transaction(STORE_NAME, mode).objectStore(STORE_NAME);
  }
  return {
    getAll: async () => request((await objectStore('readonly')).getAll() as IDBRequest<PendingInspection[]>),
    put: async (item) => {
      await request((await objectStore('readwrite')).put(item));
    },
    remove: async (id) => {
      await request((await objectStore('readwrite')).delete(id));
    },
  };
}

// Sin IndexedDB (tests en jsdom) quedan en memoria.
function memoryStore(): Store {
  const items = new Map<string, PendingInspection>();
  return {
    getAll: async () => [...items.values()],
    put: async (item) => {
      items.set(item.id, item);
    },
    remove: async (id) => {
      items.delete(id);
    },
  };
}

let store: Store = typeof indexedDB === 'undefined' ? memoryStore() : indexedDbStore();

// --- avisos a la pantalla ---

export interface PendingState {
  items: PendingInspection[];
  /** La sesión venció: hasta volver a entrar no se puede mandar nada. */
  sessionExpired: boolean;
  /** Cuántas se mandaron desde que se abrió la app; la flota se recarga cuando cambia. */
  sentCount: number;
}

type Listener = (state: PendingState) => void;
const listeners = new Set<Listener>();
let sessionExpired = false;
let sentCount = 0;

/** Las del usuario logueado, en el orden en que se hicieron. */
export async function listPendingInspections(): Promise<PendingInspection[]> {
  const userId = getSessionUserId();
  return (await store.getAll())
    .filter((item) => item.userId === userId)
    .sort((a, b) => a.performedAt.localeCompare(b.performedAt));
}

async function notify(): Promise<void> {
  const state = { items: await listPendingInspections(), sessionExpired, sentCount };
  for (const listener of listeners) listener(state);
}

export function subscribePendingInspections(listener: Listener): () => void {
  listeners.add(listener);
  void listPendingInspections().then((items) => listener({ items, sessionExpired, sentCount }));
  return () => {
    listeners.delete(listener);
  };
}

// --- encolar y descartar ---

/** Guarda la inspección para mandarla después y prueba mandarla ya, por si la señal volvió. */
export async function enqueueInspection(input: NewPendingInspection): Promise<void> {
  const answers = input.answers.map((answer) =>
    answer.defect ? { ...answer, defect: { ...answer.defect, pendingPhotoPreview: undefined } } : answer,
  );
  await store.put({ ...input, answers, userId: getSessionUserId(), status: 'pending' });
  await notify();
  void syncPendingInspections();
}

/** Hay algo sin mandar: una inspección nueva tiene que ir detrás, para respetar el orden. */
export async function hasPendingInspections(): Promise<boolean> {
  return (await listPendingInspections()).some((item) => item.status === 'pending');
}

export async function discardPendingInspection(id: string): Promise<void> {
  await store.remove(id);
  await notify();
}

// --- envío ---

export interface SyncResult {
  sent: number;
  stoppedBy?: 'offline' | 'session';
}

let running: Promise<SyncResult> | null = null;

/** Manda las pendientes en orden. Si hay un envío en curso, devuelve ese. */
export function syncPendingInspections(): Promise<SyncResult> {
  if (!running) {
    running = sync().finally(() => {
      running = null;
    });
  }
  return running;
}

async function sync(): Promise<SyncResult> {
  if (!getSessionUserId()) return { sent: 0, stoppedBy: 'session' };
  const all = await listPendingInspections();
  // Si el pre-viaje de un vehículo no se aceptó, lo que sigue de ese vehículo no se manda: el post-viaje
  // cerraría un viaje que no es el suyo.
  const vehiclesWithRejectedPreTrip = new Set(
    all.filter((item) => item.status === 'rejected' && item.type === 'pre-trip').map((item) => item.vehicleId),
  );
  let sent = 0;
  for (const item of all.filter((i) => i.status === 'pending')) {
    if (vehiclesWithRejectedPreTrip.has(item.vehicleId)) {
      await store.put({ ...item, status: 'rejected', error: `No se mandó porque el pre-viaje de ${item.plate} no se aceptó.` });
      await notify();
      continue;
    }
    try {
      const answers = await uploadPendingPhotos(item);
      await submitInspection(item.vehicleId, item.type, answers, item.notes, {
        performedAt: item.performedAt,
        clientSubmissionId: item.id,
        treadReadings: item.treadReadings,
      });
      await store.remove(item.id);
      sent++;
      sentCount++;
      sessionExpired = false;
      await notify();
    } catch (err) {
      if (isNetworkError(err)) return { sent, stoppedBy: 'offline' };
      if (isSessionExpired(err)) {
        sessionExpired = true;
        await notify();
        return { sent, stoppedBy: 'session' };
      }
      await store.put({ ...item, status: 'rejected', error: rejectionMessage(err, item) });
      if (item.type === 'pre-trip') vehiclesWithRejectedPreTrip.add(item.vehicleId);
      await notify();
    }
  }
  return { sent };
}

/** Sube las fotos sacadas sin señal y guarda el avance, para no volver a subirlas si después se corta. */
async function uploadPendingPhotos(item: PendingInspection): Promise<ChecklistAnswer[]> {
  let answers = item.answers;
  for (const answer of item.answers) {
    const photo = answer.defect?.pendingPhoto;
    if (!photo) continue;
    const file = photo instanceof File ? photo : new File([photo], 'defecto.jpg', { type: photo.type || 'image/jpeg' });
    const { photoUrl } = await uploadDefectPhoto(file);
    answers = answers.map((a) =>
      a.itemId === answer.itemId && a.defect ? { ...a, defect: { ...a.defect, photoUrl, pendingPhoto: undefined } } : a,
    );
    await store.put({ ...item, answers });
  }
  return answers;
}

// 409 del envío: el vehículo cambió mientras la inspección esperaba la señal.
const CONFLICT_MESSAGES: Record<string, string> = {
  VEHICLE_BLOCKED: 'no puede salir: tiene un defecto bloqueante o un documento vencido.',
  VEHICLE_INACTIVE: 'fue dado de baja.',
  VEHICLE_ON_TRIP: 'ya tenía un viaje abierto.',
  NO_OPEN_TRIP: 'no tenía un viaje abierto para cerrar.',
};

function rejectionMessage(err: unknown, item: PendingInspection): string {
  if (err instanceof ApiError && err.status === 409 && CONFLICT_MESSAGES[err.errorCode ?? '']) {
    return `${item.plate} ${CONFLICT_MESSAGES[err.errorCode ?? '']}`;
  }
  return describeApiError(err, 'El servidor no la aceptó.');
}

// --- envío automático ---

const RETRY_MS = 30_000;

/** Mientras el chofer tiene la app abierta: al volver la señal y cada 30 segundos. Devuelve cómo frenarlo. */
export function startPendingInspectionsSync(): () => void {
  const run = () => {
    void syncPendingInspections();
  };
  run();
  window.addEventListener('online', run);
  const timer = window.setInterval(run, RETRY_MS);
  return () => {
    window.removeEventListener('online', run);
    window.clearInterval(timer);
  };
}

/** Solo para tests: vacía la cola en memoria. */
export function resetPendingInspectionsForTests(): void {
  store = memoryStore();
  sessionExpired = false;
  sentCount = 0;
  running = null;
}
