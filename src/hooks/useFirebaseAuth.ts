import { useEffect, useMemo, useState } from 'react';
import {
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile
} from 'firebase/auth';
import {
  get,
  push,
  ref,
  serverTimestamp,
  set,
  update
} from 'firebase/database';
import { firebaseAuth, googleProvider, realtimeDb } from '../lib/firebase';
import { CloudinaryUploadResult } from '../lib/cloudinary';
import { AccountRole } from '../lib/accountTypes';

export interface AfriSellUserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  providerIds: string[];
  primaryRole?: AccountRole;
  primarySubtype?: string;
  roles?: AccountRole[];
  roleSubtypes?: Partial<Record<AccountRole, string>>;
  accountSetupCompleted?: boolean;
  accountSetupStep?: 'role' | 'subtype' | 'details' | 'media' | 'completed';
  accountSetupCompletedAt?: unknown;
  phone?: string;
  phoneLocal?: string;
  dialCode?: string;
  city?: string;
  country?: string;
  countryCode?: string;
  bio?: string;
  businessName?: string;
  logoURL?: string;
  mediaURL?: string;
  kycStatus?: 'none' | 'pending' | 'verified' | 'rejected';
  status?: 'active' | 'suspended' | 'pending';
  createdAt?: unknown;
  updatedAt?: unknown;
  lastLoginAt?: unknown;
}

export type AccountSetupDraft = Partial<Pick<
  AfriSellUserProfile,
  | 'primaryRole'
  | 'primarySubtype'
  | 'accountSetupStep'
  | 'displayName'
  | 'phone'
  | 'phoneLocal'
  | 'dialCode'
  | 'city'
  | 'country'
  | 'countryCode'
  | 'bio'
  | 'businessName'
  | 'photoURL'
  | 'logoURL'
  | 'mediaURL'
>>;

type AuthStoreState = {
  user: User | null;
  profile: AfriSellUserProfile | null;
  loading: boolean;
  authError: string;
};

const DATABASE_TIMEOUT_MS = 6000;
const authListeners = new Set<() => void>();

let authStore: AuthStoreState = {
  user: null,
  profile: null,
  loading: true,
  authError: ''
};
let unsubscribeAuthState: (() => void) | null = null;
let authSyncVersion = 0;

const emitAuthStore = () => {
  authListeners.forEach((listener) => listener());
};

const updateAuthStore = (patch: Partial<AuthStoreState>) => {
  authStore = {
    ...authStore,
    ...patch
  };
  emitAuthStore();
};

const withDatabaseTimeout = <T,>(operation: Promise<T>, label: string): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`${label} a pris trop de temps.`));
    }, DATABASE_TIMEOUT_MS);

    operation
      .then((result) => {
        window.clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        window.clearTimeout(timer);
        reject(error);
      });
  });

export const getAfriSellDataErrorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  if (
    message.includes('permission_denied') ||
    message.includes('PERMISSION_DENIED') ||
    message.includes('Missing or insufficient permissions')
  ) {
    return 'La base refuse cette action. Verifie les regles Realtime Database.';
  }

  if (
    message.includes('Database lives in a different region') ||
    message.includes('Can not parse Firebase url') ||
    message.includes('Cannot parse Firebase url') ||
    message.includes('client is offline') ||
    message.includes('Client is offline') ||
    message.includes('a pris trop de temps')
  ) {
    return 'La base de donnees AfriSell n est pas disponible. Verifie Realtime Database puis recharge l app.';
  }

  return 'Impossible d enregistrer pour le moment. Reessaie dans quelques instants.';
};

const stripUndefined = <T,>(value: T): T => {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as T;
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([key, entryValue]) => [key, stripUndefined(entryValue)])
    ) as T;
  }

  return value;
};

const buildProfile = (user: User, existing?: Partial<AfriSellUserProfile>): AfriSellUserProfile => ({
  ...existing,
  uid: user.uid,
  email: user.email || existing?.email || '',
  displayName: user.displayName || existing?.displayName || 'Utilisateur AfriSell',
  photoURL: user.photoURL || existing?.photoURL || '',
  providerIds: user.providerData.map((provider) => provider.providerId)
});

const syncUserProfile = async (user: User): Promise<AfriSellUserProfile> => {
  const userRef = ref(realtimeDb, `users/${user.uid}`);
  const snap = await withDatabaseTimeout(get(userRef), 'Lecture du profil');
  const existing = snap.exists() ? snap.val() as Partial<AfriSellUserProfile> : {};
  const profile = buildProfile(user, existing);

  await withDatabaseTimeout(update(userRef, stripUndefined({
    ...profile,
    createdAt: snap.exists() ? existing.createdAt : serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastLoginAt: serverTimestamp()
  })), 'Enregistrement du profil');

  return profile;
};

const cleanText = (value?: string) => value?.trim() || '';

const saveAccountSetupPatch = async (
  user: User,
  patch: AccountSetupDraft & { accountSetupCompleted?: boolean }
): Promise<AfriSellUserProfile> => {
  const userRef = ref(realtimeDb, `users/${user.uid}`);
  const existing = authStore.profile || buildProfile(user);
  const primaryRole = patch.primaryRole || existing.primaryRole;
  const primarySubtype = patch.primarySubtype !== undefined ? patch.primarySubtype : existing.primarySubtype;
  const displayName = cleanText(patch.displayName) || existing.displayName || user.displayName || 'Utilisateur AfriSell';
  const isCompleting = Boolean(patch.accountSetupCompleted);

  if (patch.displayName !== undefined && displayName !== user.displayName) {
    await updateProfile(user, { displayName });
  }

  const nextProfile: Partial<AfriSellUserProfile> = {
    ...patch,
    uid: user.uid,
    email: user.email || existing.email || '',
    displayName,
    photoURL: patch.photoURL || existing.photoURL || user.photoURL || '',
    providerIds: user.providerData.map((provider) => provider.providerId),
    primaryRole,
    primarySubtype,
    accountSetupCompleted: isCompleting ? true : false,
    status: existing.status || 'active',
    kycStatus: existing.kycStatus || 'none',
    updatedAt: serverTimestamp()
  };

  if (primaryRole) {
    nextProfile.roles = [primaryRole];
  }

  if (primaryRole && primarySubtype) {
    nextProfile.roleSubtypes = {
      ...(existing.roleSubtypes || {}),
      [primaryRole]: primarySubtype
    };
  }

  if (isCompleting) {
    nextProfile.accountSetupCompleted = true;
    nextProfile.accountSetupStep = 'completed';
    nextProfile.accountSetupCompletedAt = serverTimestamp();
  }

  await withDatabaseTimeout(update(userRef, stripUndefined(nextProfile)), 'Enregistrement du profil');

  const updated = {
    ...existing,
    ...nextProfile
  };
  return buildProfile(user, updated);
};

export const updateAfriSellUserPhoto = async (user: User, photoURL: string) => {
  await updateProfile(user, { photoURL });
  await withDatabaseTimeout(update(ref(realtimeDb, `users/${user.uid}`), {
    photoURL,
    updatedAt: serverTimestamp()
  }), 'Mise a jour de la photo');
};

export const saveAfriSellMediaRecord = async (user: User, upload: CloudinaryUploadResult, file: File) => {
  const record = {
    ownerId: user.uid,
    provider: upload.provider,
    mediaUrl: upload.mediaUrl,
    secureUrl: upload.secureUrl,
    publicId: upload.publicId,
    resourceType: upload.resourceType,
    format: upload.format || '',
    bytes: upload.bytes || file.size,
    width: upload.width || null,
    height: upload.height || null,
    duration: upload.duration || null,
    originalName: file.name,
    mimeType: file.type,
    createdAt: serverTimestamp()
  };

  const userMediaRef = push(ref(realtimeDb, `users/${user.uid}/media`));
  const globalMediaRef = push(ref(realtimeDb, 'media'));
  const recordWithId = stripUndefined({
    ...record,
    id: userMediaRef.key || globalMediaRef.key || '',
    globalId: globalMediaRef.key || ''
  });

  await Promise.all([
    withDatabaseTimeout(set(userMediaRef, recordWithId), 'Enregistrement du media'),
    withDatabaseTimeout(set(globalMediaRef, recordWithId), 'Enregistrement du media')
  ]);

  return recordWithId;
};

const syncCurrentUser = async (currentUser: User | null) => {
  const syncVersion = ++authSyncVersion;
  updateAuthStore({
    user: currentUser,
    loading: true,
    authError: ''
  });

  if (!currentUser) {
    updateAuthStore({
      user: null,
      profile: null,
      loading: false,
      authError: ''
    });
    return;
  }

  try {
    const syncedProfile = await syncUserProfile(currentUser);
    if (syncVersion !== authSyncVersion) return;
    updateAuthStore({
      user: currentUser,
      profile: syncedProfile,
      loading: false,
      authError: ''
    });
  } catch (error) {
    console.error('Erreur profil Realtime Database:', error);
    if (syncVersion !== authSyncVersion) return;
    updateAuthStore({
      user: currentUser,
      profile: buildProfile(currentUser, authStore.profile || undefined),
      loading: false,
      authError: getAfriSellDataErrorMessage(error)
    });
  }
};

const ensureAuthListener = () => {
  if (unsubscribeAuthState) return;
  unsubscribeAuthState = onAuthStateChanged(firebaseAuth, (currentUser) => {
    void syncCurrentUser(currentUser);
  });
};

export const useFirebaseAuth = () => {
  const [state, setState] = useState(authStore);

  useEffect(() => {
    ensureAuthListener();
    const listener = () => setState(authStore);
    authListeners.add(listener);
    listener();

    return () => {
      authListeners.delete(listener);
    };
  }, []);

  const actions = useMemo(() => ({
    signInWithGoogle: async () => {
      updateAuthStore({ authError: '' });
      const credential = await signInWithPopup(firebaseAuth, googleProvider);
      await syncCurrentUser(credential.user);
    },
    signInWithEmail: async (email: string, password: string) => {
      updateAuthStore({ authError: '' });
      const credential = await signInWithEmailAndPassword(firebaseAuth, email, password);
      await syncCurrentUser(credential.user);
    },
    registerWithEmail: async (name: string, email: string, password: string) => {
      updateAuthStore({ authError: '' });
      const credential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
      const displayName = name.trim() || email.split('@')[0] || 'Utilisateur AfriSell';
      await updateProfile(credential.user, { displayName });
      await syncCurrentUser(credential.user);
    },
    logout: async () => {
      updateAuthStore({ authError: '' });
      await signOut(firebaseAuth);
      updateAuthStore({
        user: null,
        profile: null,
        loading: false,
        authError: ''
      });
    },
    refreshProfile: async () => {
      if (!firebaseAuth.currentUser) return null;
      const syncedProfile = await syncUserProfile(firebaseAuth.currentUser);
      updateAuthStore({ profile: syncedProfile, authError: '' });
      return syncedProfile;
    },
    saveAccountSetupDraft: async (patch: AccountSetupDraft) => {
      if (!firebaseAuth.currentUser) return null;
      const syncedProfile = await saveAccountSetupPatch(firebaseAuth.currentUser, patch);
      updateAuthStore({ profile: syncedProfile, authError: '' });
      return syncedProfile;
    },
    completeAccountSetup: async (patch: AccountSetupDraft & { primaryRole: AccountRole; primarySubtype: string }) => {
      if (!firebaseAuth.currentUser) return null;
      const syncedProfile = await saveAccountSetupPatch(firebaseAuth.currentUser, {
        ...patch,
        accountSetupCompleted: true,
        accountSetupStep: 'completed'
      });
      updateAuthStore({ profile: syncedProfile, authError: '' });
      return syncedProfile;
    }
  }), []);

  return {
    ...state,
    setAuthError: (authError: string) => updateAuthStore({ authError }),
    ...actions
  };
};
