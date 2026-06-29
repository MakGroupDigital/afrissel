import { User } from 'firebase/auth';
import { push, ref, serverTimestamp, update } from 'firebase/database';
import { realtimeDb } from '../../lib/firebase';

export type BiasharaOpportunityInput = {
  user: User;
  idea: string;
  market: string;
  need: string;
  offer: string;
  partnerType: string;
};

const cleanText = (value: string, label: string) => {
  const nextValue = value.trim();
  if (!nextValue) throw new Error(`${label} requis.`);
  return nextValue;
};

export async function createBiasharaOpportunity(input: BiasharaOpportunityInput) {
  const opportunityRef = push(ref(realtimeDb, 'biasharaOpportunities'));
  const opportunityId = opportunityRef.key;
  if (!opportunityId) throw new Error('Création opportunite impossible.');

  const now = Date.now();
  const payload = {
    id: opportunityId,
    ownerId: input.user.uid,
    ownerName: input.user.displayName || 'Entrepreneur AfriSell',
    ownerAvatar: input.user.photoURL || '',
    idea: cleanText(input.idea, 'Idee business'),
    market: cleanText(input.market, 'Marche cible'),
    need: cleanText(input.need, 'Besoin partenaire'),
    offer: cleanText(input.offer, 'Offre'),
    partnerType: cleanText(input.partnerType, 'Type partenaire'),
    status: 'open',
    source: 'biashara',
    createdAt: now,
    updatedAt: serverTimestamp()
  };

  await update(ref(realtimeDb), {
    [`biasharaOpportunities/${opportunityId}`]: payload,
    [`userBiasharaOpportunities/${input.user.uid}/${opportunityId}`]: true
  });

  return payload;
}
