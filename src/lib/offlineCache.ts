import Dexie, { Table } from 'dexie';
import { ref, update } from 'firebase/database';
import type { Database } from 'firebase/database';

const CACHE_PREFIX = 'afrisell:offline';

type CacheEntry<T = unknown> = {
  key: string;
  value: T;
  savedAt: number;
};

export type OfflineQueueEntry = {
  id?: number;
  type: 'firebase-update';
  payload: Record<string, unknown>;
  status: 'queued' | 'syncing' | 'failed';
  attempts: number;
  createdAt: number;
  updatedAt: number;
  lastError?: string;
};

export type OfflineUploadEntry = {
  id?: number;
  ownerId: string;
  resourceType: 'image' | 'video' | 'raw';
  file: Blob;
  fileName: string;
  mimeType: string;
  status: 'queued' | 'uploading' | 'failed';
  attempts: number;
  createdAt: number;
  updatedAt: number;
  lastError?: string;
};

class AfriZiaOfflineDb extends Dexie {
  cache!: Table<CacheEntry, string>;
  queue!: Table<OfflineQueueEntry, number>;
  uploads!: Table<OfflineUploadEntry, number>;

  constructor() {
    super('afrisell_offline_db');
    this.version(1).stores({
      cache: 'key, savedAt',
      queue: '++id, type, status, createdAt, updatedAt'
    });
    this.version(2).stores({
      cache: 'key, savedAt',
      queue: '++id, type, status, createdAt, updatedAt',
      uploads: '++id, ownerId, status, createdAt, updatedAt'
    });
  }
}

export const afriSellOfflineDb = new AfriZiaOfflineDb();

const memoryCache = new Map<string, unknown>();

export const offlineCacheKey = (...segments: Array<string | number | undefined | null>) => (
  [CACHE_PREFIX, ...segments.filter((segment) => segment !== undefined && segment !== null && segment !== '')]
    .map((segment) => String(segment).replace(/[^a-zA-Z0-9_-]/g, '_'))
    .join(':')
);

export const readOfflineCache = <T,>(key: string, fallback: T): T => (
  memoryCache.has(key) ? memoryCache.get(key) as T : fallback
);

export const readOfflineCacheAsync = async <T,>(key: string, fallback: T): Promise<T> => {
  if (typeof window === 'undefined') return fallback;

  try {
    const entry = await afriSellOfflineDb.cache.get(key);
    if (!entry || entry.value === undefined) return fallback;
    memoryCache.set(key, entry.value);
    return entry.value as T;
  } catch {
    return fallback;
  }
};

export const writeOfflineCache = <T,>(key: string, value: T) => {
  memoryCache.set(key, value);
  if (typeof window === 'undefined') return;

  void afriSellOfflineDb.cache.put({
    key,
    value,
    savedAt: Date.now()
  }).catch(() => undefined);
};

export const removeOfflineCache = (key: string) => {
  memoryCache.delete(key);
  if (typeof window === 'undefined') return;
  void afriSellOfflineDb.cache.delete(key).catch(() => undefined);
};

export const enqueueFirebaseUpdate = async (payload: Record<string, unknown>) => {
  if (typeof window === 'undefined') return;

  await afriSellOfflineDb.queue.add({
    type: 'firebase-update',
    payload,
    status: 'queued',
    attempts: 0,
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
};

export const getQueuedOfflineCount = async () => {
  if (typeof window === 'undefined') return 0;
  return afriSellOfflineDb.queue.where('status').anyOf('queued', 'failed').count();
};

export const createOfflineUpload = async (input: Omit<OfflineUploadEntry, 'id' | 'status' | 'attempts' | 'createdAt' | 'updatedAt'>) => {
  if (typeof window === 'undefined') return undefined;

  try {
    return await afriSellOfflineDb.uploads.add({
      ...input,
      status: 'queued',
      attempts: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  } catch {
    return undefined;
  }
};

export const updateOfflineUpload = async (id: number | undefined, patch: Partial<OfflineUploadEntry>) => {
  if (!id || typeof window === 'undefined') return;
  try {
    await afriSellOfflineDb.uploads.update(id, { ...patch, updatedAt: Date.now() });
  } catch {
    // Uploading must still work when IndexedDB is unavailable.
  }
};

export const removeOfflineUpload = async (id: number | undefined) => {
  if (!id || typeof window === 'undefined') return;
  try {
    await afriSellOfflineDb.uploads.delete(id);
  } catch {
    // The remote upload remains valid when local cleanup fails.
  }
};

export const flushOfflineQueue = async (database: Database) => {
  if (isOfflineNow() || typeof window === 'undefined') return 0;

  const entries = await afriSellOfflineDb.queue
    .where('status')
    .anyOf('queued', 'failed')
    .sortBy('createdAt');
  let synced = 0;

  for (const entry of entries) {
    if (!entry.id) continue;

    try {
      await afriSellOfflineDb.queue.update(entry.id, {
        status: 'syncing',
        attempts: entry.attempts + 1,
        updatedAt: Date.now()
      });
      await update(ref(database), entry.payload);
      await afriSellOfflineDb.queue.delete(entry.id);
      synced += 1;
    } catch (error) {
      await afriSellOfflineDb.queue.update(entry.id, {
        status: 'failed',
        updatedAt: Date.now(),
        lastError: error instanceof Error ? error.message : 'Synchronisation impossible'
      });
    }
  }

  return synced;
};

export const isOfflineNow = () => (
  typeof navigator !== 'undefined' && navigator.onLine === false
);
