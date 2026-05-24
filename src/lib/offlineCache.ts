const CACHE_PREFIX = 'afrisell:offline';

export const offlineCacheKey = (...segments: Array<string | number | undefined | null>) => (
  [CACHE_PREFIX, ...segments.filter((segment) => segment !== undefined && segment !== null && segment !== '')]
    .map((segment) => String(segment).replace(/[^a-zA-Z0-9_-]/g, '_'))
    .join(':')
);

export const readOfflineCache = <T,>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as { value?: T };
    return parsed.value === undefined ? fallback : parsed.value;
  } catch {
    return fallback;
  }
};

export const writeOfflineCache = <T,>(key: string, value: T) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(key, JSON.stringify({
      value,
      savedAt: Date.now()
    }));
  } catch {
    // Cache is optional. Browsers can reject writes when storage is full or private.
  }
};

export const isOfflineNow = () => (
  typeof navigator !== 'undefined' && navigator.onLine === false
);
