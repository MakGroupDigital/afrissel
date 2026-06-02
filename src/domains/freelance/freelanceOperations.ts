import { User } from 'firebase/auth';
import { push, ref, serverTimestamp, update } from 'firebase/database';
import { realtimeDb } from '../../lib/firebase';

export type FreelanceMissionInput = {
  user: User;
  freelancerId: string;
  freelancerName: string;
  serviceTitle: string;
  budget: number;
  timeline: string;
  details: string;
};

const cleanText = (value: string, label: string) => {
  const nextValue = value.trim();
  if (!nextValue) throw new Error(`${label} requis.`);
  return nextValue;
};

export async function createFreelanceMissionRequest(input: FreelanceMissionInput) {
  const requestRef = push(ref(realtimeDb, 'freelanceMissionRequests'));
  const requestId = requestRef.key;
  if (!requestId) throw new Error('Creation de mission impossible.');

  const budget = Math.round(Number(input.budget || 0) * 100) / 100;
  if (!Number.isFinite(budget) || budget <= 0) {
    throw new Error('Budget mission invalide.');
  }

  const now = Date.now();
  const payload = {
    id: requestId,
    clientId: input.user.uid,
    clientName: input.user.displayName || 'Client AfriSell',
    clientAvatar: input.user.photoURL || '',
    freelancerId: cleanText(input.freelancerId, 'Freelance'),
    freelancerName: cleanText(input.freelancerName, 'Nom freelance'),
    serviceTitle: cleanText(input.serviceTitle, 'Service'),
    budget,
    currency: 'USD',
    timeline: cleanText(input.timeline, 'Delai'),
    details: cleanText(input.details, 'Details'),
    status: 'quote_requested',
    paymentStatus: 'not_started',
    createdAt: now,
    updatedAt: serverTimestamp()
  };

  await update(ref(realtimeDb), {
    [`freelanceMissionRequests/${requestId}`]: payload,
    [`userFreelanceRequests/${input.user.uid}/${requestId}`]: true,
    [`freelancerRequests/${input.freelancerId}/${requestId}`]: true
  });

  return payload;
}
