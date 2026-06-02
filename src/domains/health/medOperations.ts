import { User } from 'firebase/auth';
import { push, ref, serverTimestamp, update } from 'firebase/database';
import { realtimeDb } from '../../lib/firebase';

export type TeleconsultationInput = {
  user: User;
  need: string;
  city: string;
  urgency: string;
  language: string;
};

export type HealthProfileInput = {
  user: User;
  age: string;
  allergies: string;
  treatments: string;
  notes: string;
};

const cleanText = (value: string, label: string) => {
  const nextValue = value.trim();
  if (!nextValue) throw new Error(`${label} requis.`);
  return nextValue;
};

export async function createTeleconsultationRequest(input: TeleconsultationInput) {
  const requestRef = push(ref(realtimeDb, 'medConsultations'));
  const requestId = requestRef.key;
  if (!requestId) throw new Error('Creation de demande AfriMed impossible.');

  const now = Date.now();
  const payload = {
    id: requestId,
    userId: input.user.uid,
    userName: input.user.displayName || 'Patient AfriSell',
    userAvatar: input.user.photoURL || '',
    need: cleanText(input.need, 'Besoin medical'),
    city: cleanText(input.city, 'Ville'),
    urgency: cleanText(input.urgency, 'Urgence'),
    language: cleanText(input.language, 'Langue'),
    status: 'orientation_pending',
    createdAt: now,
    updatedAt: serverTimestamp()
  };

  await update(ref(realtimeDb), {
    [`medConsultations/${requestId}`]: payload,
    [`userMedConsultations/${input.user.uid}/${requestId}`]: true
  });

  return payload;
}

export async function saveHealthProfile(input: HealthProfileInput) {
  await update(ref(realtimeDb), {
    [`healthProfiles/${input.user.uid}`]: {
      userId: input.user.uid,
      age: cleanText(input.age, 'Age'),
      allergies: input.allergies.trim(),
      treatments: input.treatments.trim(),
      notes: input.notes.trim(),
      updatedAt: serverTimestamp()
    }
  });
}
