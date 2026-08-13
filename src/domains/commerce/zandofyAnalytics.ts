import { runTransaction, set, ref } from 'firebase/database';
import { realtimeDb } from '../../lib/firebase';

export type ZandofyAnalyticsEventType = 'store_view' | 'product_view';

export type ZandofyAnalyticsSnapshot = {
  daily?: Record<string, {
    storeViews?: number;
    productViews?: number;
    products?: Record<string, number>;
  }>;
  dimensions?: {
    devices?: Record<string, number>;
    countries?: Record<string, number>;
    cities?: Record<string, number>;
    sources?: Record<string, number>;
  };
  visitors?: Record<string, Record<string, {
    country?: string;
    city?: string;
    device?: string;
    source?: string;
    createdAt?: number;
  }>>;
};

const STORAGE_PREFIX = 'afrizia:zandofy-analytics';

const safeKey = (value: string) => value.trim().replace(/[.#$\[\]/]/g, '_').slice(0, 80) || 'inconnu';

const getDayKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getVisitorId = () => {
  if (typeof window === 'undefined') return 'server';
  const storageKey = `${STORAGE_PREFIX}:visitor`;
  const current = window.localStorage.getItem(storageKey);
  if (current) return current;
  const generated = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(storageKey, generated);
  return generated;
};

const detectDevice = () => {
  if (typeof navigator === 'undefined') return 'unknown';
  const userAgent = navigator.userAgent.toLowerCase();
  if (/ipad|tablet|kindle|silk/.test(userAgent)) return 'tablette';
  if (/android|iphone|ipod|mobile|windows phone/.test(userAgent)) return 'mobile';
  return 'ordinateur';
};

const detectSource = () => {
  if (typeof window === 'undefined') return 'Direct';
  const params = new URLSearchParams(window.location.search);
  const campaign = params.get('utm_source') || params.get('ref') || '';
  const source = `${campaign} ${document.referrer || ''}`.toLowerCase();
  if (!source.trim()) return 'Direct';
  if (source.includes('facebook') || source.includes('fb.')) return 'Facebook';
  if (source.includes('instagram')) return 'Instagram';
  if (source.includes('tiktok')) return 'TikTok';
  if (source.includes('whatsapp')) return 'WhatsApp';
  if (source.includes('google')) return 'Google';
  if (campaign.trim()) return campaign.trim().slice(0, 40);
  try {
    return new URL(document.referrer).hostname.replace(/^www\./, '').slice(0, 40) || 'Autre';
  } catch {
    return 'Autre';
  }
};

const wasRecorded = (key: string) => {
  if (typeof window === 'undefined') return false;
  return window.sessionStorage.getItem(key) === '1';
};

const markRecorded = (key: string) => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(key, '1');
};

export const recordZandofyAnalyticsEvent = async ({
  storeId,
  eventType,
  productId,
  country = 'Inconnu',
  city = 'Inconnue'
}: {
  storeId: string;
  eventType: ZandofyAnalyticsEventType;
  productId?: string;
  country?: string;
  city?: string;
}) => {
  if (!storeId || typeof window === 'undefined') return;
  const day = getDayKey();
  const visitorId = getVisitorId();
  const suffix = productId ? `:${productId}` : '';
  const dedupeKey = `${STORAGE_PREFIX}:${storeId}:${day}:${eventType}${suffix}`;
  if (wasRecorded(dedupeKey)) return;
  markRecorded(dedupeKey);

  const device = detectDevice();
  const source = detectSource();
  const visitorPath = `zandofyAnalytics/${storeId}/visitors/${day}/${safeKey(visitorId)}`;
  const dailyPath = `zandofyAnalytics/${storeId}/daily/${day}`;
  const updates = [
    set(ref(realtimeDb, visitorPath), {
      country: safeKey(country),
      city: safeKey(city),
      device,
      source,
      createdAt: Date.now()
    }),
    runTransaction(ref(realtimeDb, `${dailyPath}/${eventType === 'store_view' ? 'storeViews' : 'productViews'}`), (value) => Number(value || 0) + 1)
  ];

  if (eventType === 'product_view' && productId) {
    updates.push(runTransaction(ref(realtimeDb, `${dailyPath}/products/${safeKey(productId)}`), (value) => Number(value || 0) + 1));
  }

  if (eventType === 'store_view') {
    updates.push(runTransaction(ref(realtimeDb, `zandofyAnalytics/${storeId}/dimensions/devices/${safeKey(device)}`), (value) => Number(value || 0) + 1));
    updates.push(runTransaction(ref(realtimeDb, `zandofyAnalytics/${storeId}/dimensions/countries/${safeKey(country)}`), (value) => Number(value || 0) + 1));
    updates.push(runTransaction(ref(realtimeDb, `zandofyAnalytics/${storeId}/dimensions/cities/${safeKey(city)}`), (value) => Number(value || 0) + 1));
    updates.push(runTransaction(ref(realtimeDb, `zandofyAnalytics/${storeId}/dimensions/sources/${safeKey(source)}`), (value) => Number(value || 0) + 1));
  }

  await Promise.all(updates);
};
