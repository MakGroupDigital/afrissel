import { User } from 'firebase/auth';
import { get, ref, runTransaction, serverTimestamp, update } from 'firebase/database';
import { realtimeDb } from '../../lib/firebase';
import { getAfriZiaPublicOrigin } from '../../lib/zandofyShare';

const REFERRAL_STORAGE_KEY = 'afrizia:affiliate-referral';
const REFERRAL_VALIDITY_MS = 30 * 24 * 60 * 60 * 1000;
export const AFFILIATE_SIGNUP_POINTS = 10;
export const AFFILIATE_POINTS_PER_USD = 100;

export type AffiliateProfile = {
  uid: string;
  referralCode: string;
  createdAt?: number;
  updatedAt?: number;
};

export type AffiliateReferral = {
  referredId: string;
  displayName: string;
  photoURL: string;
  points: number;
  status: 'registered';
  createdAt?: number;
  lastActivityAt?: number;
  lastActivityLabel?: string;
};

type PendingReferral = {
  code: string;
  capturedAt: number;
};

const sanitizeCode = (value: string | null | undefined) => String(value || '')
  .trim()
  .toUpperCase()
  .replace(/[^A-Z0-9-]/g, '')
  .slice(0, 48);

const makeReferralCode = (uid: string) => `AZ-${uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16).toUpperCase()}`;

const readPendingReferral = (): PendingReferral | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(REFERRAL_STORAGE_KEY);
    if (!raw) return null;
    const pending = JSON.parse(raw) as Partial<PendingReferral>;
    const code = sanitizeCode(pending.code);
    const capturedAt = Number(pending.capturedAt || 0);
    if (!code || !capturedAt || Date.now() - capturedAt > REFERRAL_VALIDITY_MS) {
      window.localStorage.removeItem(REFERRAL_STORAGE_KEY);
      return null;
    }
    return { code, capturedAt };
  } catch {
    return null;
  }
};

const clearPendingReferral = () => {
  if (typeof window !== 'undefined') window.localStorage.removeItem(REFERRAL_STORAGE_KEY);
};

export const captureAffiliateReferral = (search: string) => {
  if (typeof window === 'undefined') return null;
  const code = sanitizeCode(new URLSearchParams(search).get('ref'));
  if (!code) return null;
  const pending = { code, capturedAt: Date.now() };
  window.localStorage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify(pending));
  return pending;
};

export const ensureAffiliateProfile = async (user: User): Promise<AffiliateProfile> => {
  const profileRef = ref(realtimeDb, `affiliateProfiles/${user.uid}`);
  const existing = await get(profileRef);
  const current = existing.exists() ? existing.val() as Partial<AffiliateProfile> : {};
  const referralCode = sanitizeCode(current.referralCode) || makeReferralCode(user.uid);
  const profile: AffiliateProfile = { uid: user.uid, referralCode };

  await update(ref(realtimeDb), {
    [`affiliateProfiles/${user.uid}/uid`]: user.uid,
    [`affiliateProfiles/${user.uid}/referralCode`]: referralCode,
    [`affiliateProfiles/${user.uid}/createdAt`]: current.createdAt || serverTimestamp(),
    [`affiliateProfiles/${user.uid}/updatedAt`]: serverTimestamp(),
    [`affiliateCodes/${referralCode}`]: user.uid
  });

  return profile;
};

export const getAffiliateReferralURL = (code: string) => {
  const referralCode = sanitizeCode(code);
  return `${getAfriZiaPublicOrigin()}/join?ref=${encodeURIComponent(referralCode)}&source=affiliate`;
};

export const awardPendingAffiliateReferral = async (
  user: User,
  profile: { displayName?: string; photoURL?: string },
  isNewProfile: boolean
) => {
  if (!isNewProfile || user.isAnonymous) return null;
  const pending = readPendingReferral();
  if (!pending) return null;

  const codeSnapshot = await get(ref(realtimeDb, `affiliateCodes/${pending.code}`));
  const referrerId = String(codeSnapshot.val() || '');
  if (!referrerId || referrerId === user.uid) {
    clearPendingReferral();
    return null;
  }

  const referralRef = ref(realtimeDb, `affiliateReferrals/${referrerId}/${user.uid}`);
  const createdAt = Date.now();
  const referral: AffiliateReferral = {
    referredId: user.uid,
    displayName: profile.displayName || user.displayName || 'Nouveau membre',
    photoURL: profile.photoURL || user.photoURL || '',
    points: AFFILIATE_SIGNUP_POINTS,
    status: 'registered',
    createdAt,
    lastActivityAt: createdAt,
    lastActivityLabel: 'Inscription validée'
  };

  const claim = await runTransaction(referralRef, (current) => current || referral);
  const storedReferral = claim.snapshot.val() as AffiliateReferral | null;
  clearPendingReferral();

  await update(ref(realtimeDb), {
    [`users/${user.uid}/affiliateReferrerId`]: referrerId,
    [`users/${user.uid}/affiliateReferrerCode`]: pending.code,
    [`users/${user.uid}/affiliateRewardedAt`]: storedReferral?.createdAt || createdAt,
    [`affiliateActivities/${referrerId}/${user.uid}`]: {
      type: 'signup',
      referredId: user.uid,
      displayName: referral.displayName,
      points: storedReferral?.points || AFFILIATE_SIGNUP_POINTS,
      label: 'Inscription validée',
      createdAt: storedReferral?.createdAt || createdAt
    }
  });

  return { referrerId, points: storedReferral?.points || AFFILIATE_SIGNUP_POINTS };
};

export const syncAffiliateReferralActivity = async (userId: string, referrerId?: string) => {
  if (!referrerId) return;
  await update(ref(realtimeDb), {
    [`affiliateReferrals/${referrerId}/${userId}/lastActivityAt`]: serverTimestamp(),
    [`affiliateReferrals/${referrerId}/${userId}/lastActivityLabel`]: 'Actif sur AfriZia'
  });
};
