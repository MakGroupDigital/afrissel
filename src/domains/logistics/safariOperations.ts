import { User } from 'firebase/auth';
import { push, ref, serverTimestamp, update } from 'firebase/database';
import { realtimeDb } from '../../lib/firebase';

export type SafariServiceType = 'shipping' | 'mobility' | 'real_estate' | 'storage';

type SafariRequestInput = {
  user: User;
  serviceType: SafariServiceType;
  title: string;
  origin: string;
  destination: string;
  contactPhone: string;
  details: string;
  budget?: number;
};

const serviceLabels: Record<SafariServiceType, string> = {
  shipping: 'Expedition colis',
  mobility: 'Mobilite et transport',
  real_estate: 'Immobilier',
  storage: 'Stockage et relais'
};

const normalizeText = (value: string, label: string) => {
  const nextValue = value.trim();
  if (!nextValue) throw new Error(`${label} requis.`);
  return nextValue;
};

const normalizeBudget = (value?: number) => {
  if (!value) return 0;
  const nextValue = Math.round(Number(value) * 100) / 100;
  if (!Number.isFinite(nextValue) || nextValue < 0) throw new Error('Budget invalide.');
  return nextValue;
};

export async function createSafariRequest(input: SafariRequestInput) {
  const requestRef = push(ref(realtimeDb, 'safariRequests'));
  const requestId = requestRef.key;
  if (!requestId) throw new Error('Création de mission Safari impossible.');

  const now = Date.now();
  const request = {
    id: requestId,
    userId: input.user.uid,
    userName: input.user.displayName || 'Utilisateur AfriSell',
    userAvatar: input.user.photoURL || '',
    serviceType: input.serviceType,
    serviceLabel: serviceLabels[input.serviceType],
    title: normalizeText(input.title, 'Titre'),
    origin: normalizeText(input.origin, 'Depart'),
    destination: normalizeText(input.destination, 'Destination'),
    contactPhone: normalizeText(input.contactPhone, 'Téléphone'),
    details: normalizeText(input.details, 'Details'),
    budget: normalizeBudget(input.budget),
    currency: 'USD',
    status: 'pending_assignment',
    createdAt: now,
    updatedAt: serverTimestamp()
  };

  await update(ref(realtimeDb), {
    [`safariRequests/${requestId}`]: request,
    [`userSafariRequests/${input.user.uid}/${requestId}`]: true
  });

  return request;
}
