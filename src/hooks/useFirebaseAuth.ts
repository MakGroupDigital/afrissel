import { useEffect, useMemo, useState } from 'react';
import {
  User,
  createUserWithEmailAndPassword,
  browserLocalPersistence,
  ConfirmationResult,
  getRedirectResult,
  onAuthStateChanged,
  RecaptchaVerifier,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile
} from 'firebase/auth';
import {
  get,
  onValue,
  push,
  ref,
  serverTimestamp,
  set,
  update
} from 'firebase/database';
import { appleProvider, firebaseAuth, googleProvider, realtimeDb } from '../lib/firebase';
import { CloudinaryUploadResult } from '../lib/cloudinary';
import { AccountRole } from '../lib/accountTypes';
import { isOfflineNow, offlineCacheKey, readOfflineCache, readOfflineCacheAsync, writeOfflineCache } from '../lib/offlineCache';

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
  businessAccount?: {
    categoryId?: string;
    categoryLabel?: string;
    moduleName?: string;
    serviceId?: string;
    serviceLabel?: string;
    segmentId?: string;
    segmentLabel?: string;
    status?: string;
    createdAt?: number;
    kycDueAt?: number;
    kycStatus?: 'none' | 'pending' | 'verified' | 'rejected';
    updatedAt?: unknown;
  };
  businessAccounts?: Record<string, NonNullable<AfriSellUserProfile['businessAccount']>>;
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
const GOOGLE_REDIRECT_PENDING_KEY = 'afrisell:google-redirect-pending';
const authListeners = new Set<() => void>();

let authStore: AuthStoreState = {
  user: null,
  profile: null,
  loading: true,
  authError: ''
};
let unsubscribeAuthState: (() => void) | null = null;
let unsubscribeProfileState: (() => void) | null = null;
let authSyncVersion = 0;
let redirectResultHandled = false;
let phoneRecaptchaVerifier: RecaptchaVerifier | null = null;
let phoneConfirmationResult: ConfirmationResult | null = null;

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

const hasPendingGoogleRedirect = () => (
  typeof window !== 'undefined' &&
  window.sessionStorage.getItem(GOOGLE_REDIRECT_PENDING_KEY) === '1'
);

const setPendingGoogleRedirect = () => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(GOOGLE_REDIRECT_PENDING_KEY, '1');
};

const clearPendingGoogleRedirect = () => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(GOOGLE_REDIRECT_PENDING_KEY);
};

const profileCacheKey = (uid: string) => offlineCacheKey('profile', uid);

const withDatabaseTimeout = <T,>(operation: Promise<T>, label: string): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`${label} à pris trop de temps.`));
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
    return 'La base refuse cette action. Vérifie les règles Realtime Database.';
  }

  if (
    message.includes('Database lives in a different region') ||
    message.includes('Can not parse Firebase url') ||
    message.includes('Cannot parse Firebase url') ||
    message.includes('client is offline') ||
    message.includes('Client is offline') ||
    message.includes('a pris trop de temps')
  ) {
    return "La base de données AfriSell n'est pas disponible. Vérifie Realtime Database puis recharge l'app.";
  }

  return "Impossible d'enregistrer pour le moment. Réessaie dans quelques instants.";
};

export const getAfriSellAuthErrorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('auth/invalid-email')) {
    return 'Adresse email invalide.';
  }

  if (message.includes('auth/missing-password')) {
    return 'Entre ton mot de passe.';
  }

  if (
    message.includes('auth/invalid-credential') ||
    message.includes('auth/wrong-password') ||
    message.includes('auth/user-not-found')
  ) {
    return 'Email ou mot de passe incorrect.';
  }

  if (message.includes('auth/email-already-in-use')) {
    return 'Un compte existe déjà avec cet email.';
  }

  if (message.includes('auth/weak-password')) {
    return 'Mot de passe trop faible. Utilise au moins 6 caracteres.';
  }

  if (message.includes('auth/popup-closed-by-user')) {
    return 'Connexion Google annulée.';
  }

  if (message.includes('auth/popup-blocked')) {
    return 'La fenêtre Google a été bloquée par le navigateur.';
  }

  if (message.includes('auth/invalid-phone-number')) {
    return 'Numéro de téléphone invalide. Utilise le format international.';
  }

  if (message.includes('auth/missing-phone-number')) {
    return 'Entre ton numéro de téléphone.';
  }

  if (message.includes('auth/invalid-verification-code')) {
    return 'Code SMS incorrect.';
  }

  if (message.includes('auth/missing-verification-code')) {
    return 'Entre le code reçu par SMS.';
  }

  if (message.includes('auth/code-expired')) {
    return 'Le code SMS à expire. Demande un nouveau code.';
  }

  if (message.includes('auth/captcha-check-failed')) {
    return 'Vérification sécurité impossible. Recharge la page puis réessaie.';
  }

  if (message.includes('auth/too-many-requests')) {
    return 'Trop de tentatives. Réessaie plus tard.';
  }

  if (message.includes('auth/billing-not-enabled')) {
    return "La connexion par téléphone exige l'activation de la facturation Firebase pour envoyer les SMS.";
  }

  if (
    message.includes('auth/argument-error') ||
    message.includes('auth/invalid-api-key') ||
    message.includes('auth/invalid-app-credential') ||
    message.includes('auth/unauthorized-domain') ||
    message.includes('Firebase: Error')
  ) {
    return 'Configuration de connexion invalide. Vérifie Firebase Auth puis réessaie.';
  }

  if (message.includes('auth/operation-not-allowed')) {
    return "Cette méthode de connexion n'est pas encore activée dans Firebase Auth.";
  }

  if (message.includes('auth/network-request-failed')) {
    return 'Connexion internet instable. Réessaie.';
  }

  return 'Connexion impossible pour le moment. Réessaie dans quelques instants.';
};

const isSilentRedirectError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  return message.includes('auth/argument-error');
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

  writeOfflineCache(profileCacheKey(user.uid), profile);
  return profile;
};

const stopProfileListener = () => {
  if (!unsubscribeProfileState) return;
  unsubscribeProfileState();
  unsubscribeProfileState = null;
};

const startProfileListener = (user: User) => {
  stopProfileListener();
  unsubscribeProfileState = onValue(ref(realtimeDb, `users/${user.uid}`), (snapshot) => {
    if (!snapshot.exists() || firebaseAuth.currentUser?.uid !== user.uid) return;
    const liveProfile = buildProfile(user, snapshot.val() as Partial<AfriSellUserProfile>);
    writeOfflineCache(profileCacheKey(user.uid), liveProfile);
    updateAuthStore({
      user,
      profile: liveProfile,
      loading: false,
      authError: ''
    });
  }, (error) => {
    console.error('Ecoute profil AfriSell impossible:', error);
  });
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
  const profile = buildProfile(user, updated);
  writeOfflineCache(profileCacheKey(user.uid), profile);
  return profile;
};

export const updateAfriSellUserPhoto = async (user: User, photoURL: string) => {
  await updateProfile(user, { photoURL });
  await withDatabaseTimeout(update(ref(realtimeDb, `users/${user.uid}`), {
    photoURL,
    updatedAt: serverTimestamp()
  }), 'Mise à jour de la photo');
  const cachedProfile = readOfflineCache<AfriSellUserProfile | null>(profileCacheKey(user.uid), null);
  if (cachedProfile) {
    writeOfflineCache(profileCacheKey(user.uid), {
      ...cachedProfile,
      photoURL
    });
  }
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
    stopProfileListener();
    if (hasPendingGoogleRedirect()) {
      updateAuthStore({
        user: null,
        profile: null,
        loading: true,
        authError: ''
      });
      return;
    }

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
    startProfileListener(currentUser);
  } catch (error) {
    console.error('Erreur profil Realtime Database:', error);
    if (syncVersion !== authSyncVersion) return;
    const cachedProfile = await readOfflineCacheAsync<AfriSellUserProfile | null>(
      profileCacheKey(currentUser.uid),
      readOfflineCache<AfriSellUserProfile | null>(profileCacheKey(currentUser.uid), null)
    );
    updateAuthStore({
      user: currentUser,
      profile: buildProfile(currentUser, cachedProfile || authStore.profile || undefined),
      loading: false,
      authError: cachedProfile && isOfflineNow() ? '' : getAfriSellDataErrorMessage(error)
    });
    startProfileListener(currentUser);
  }
};

const ensureAuthListener = () => {
  if (unsubscribeAuthState) return;
  unsubscribeAuthState = onAuthStateChanged(firebaseAuth, (currentUser) => {
    void syncCurrentUser(currentUser);
  });
  void consumeGoogleRedirectResult();
};

const isMobileOrStandalone = () => {
  if (typeof window === 'undefined') return false;
  const userAgent = window.navigator.userAgent;
  const isTouchMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in window.navigator && Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone));

  return isTouchMobile || isStandalone;
};

const getPhoneRecaptchaVerifier = () => {
  if (phoneRecaptchaVerifier) return phoneRecaptchaVerifier;

  phoneRecaptchaVerifier = new RecaptchaVerifier(firebaseAuth, 'afrisell-phone-recaptcha', {
    size: 'invisible'
  });

  return phoneRecaptchaVerifier;
};

const signInWithSocialProvider = async (provider: typeof googleProvider | typeof appleProvider) => {
  updateAuthStore({ authError: '' });
  await setPersistence(firebaseAuth, browserLocalPersistence);

  if (isMobileOrStandalone()) {
    setPendingGoogleRedirect();
    try {
      await signInWithRedirect(firebaseAuth, provider);
    } catch (error) {
      clearPendingGoogleRedirect();
      throw error;
    }
    return;
  }

  try {
    const credential = await signInWithPopup(firebaseAuth, provider);
    await syncCurrentUser(credential.user);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const shouldUseRedirect = [
      'auth/popup-blocked',
      'auth/popup-closed-by-user',
      'auth/cancelled-popup-request',
      'auth/operation-not-supported-in-this-environment'
    ].some((code) => message.includes(code));

    if (!shouldUseRedirect) {
      throw error;
    }

    setPendingGoogleRedirect();
    try {
      await signInWithRedirect(firebaseAuth, provider);
    } catch (redirectError) {
      clearPendingGoogleRedirect();
      throw redirectError;
    }
  }
};

const consumeGoogleRedirectResult = async () => {
  if (redirectResultHandled) return;
  redirectResultHandled = true;
  const wasPendingRedirect = hasPendingGoogleRedirect();

  try {
    if (wasPendingRedirect) {
      updateAuthStore({ loading: true, authError: '' });
    }

    await setPersistence(firebaseAuth, browserLocalPersistence);
    const credential = await getRedirectResult(firebaseAuth);
    const redirectedUser = credential?.user || firebaseAuth.currentUser;

    if (redirectedUser) {
      clearPendingGoogleRedirect();
      await syncCurrentUser(redirectedUser);
      return;
    }

    if (wasPendingRedirect) {
      window.setTimeout(() => {
        const restoredUser = firebaseAuth.currentUser;
        clearPendingGoogleRedirect();

        if (restoredUser) {
          void syncCurrentUser(restoredUser);
          return;
        }

        updateAuthStore({
          loading: false,
          authError: 'Connexion terminée, mais le compte n’a pas été restauré sur cet appareil. Reessaie une fois.'
        });
      }, 3200);
    }
  } catch (error) {
    console.error('Retour Google AfriSell impossible:', error);
    clearPendingGoogleRedirect();
    updateAuthStore({
      loading: false,
      authError: isSilentRedirectError(error) ? '' : getAfriSellAuthErrorMessage(error)
    });
  }
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
      await setPersistence(firebaseAuth, browserLocalPersistence);

      if (isMobileOrStandalone()) {
        setPendingGoogleRedirect();
        try {
          await signInWithRedirect(firebaseAuth, googleProvider);
        } catch (error) {
          clearPendingGoogleRedirect();
          throw error;
        }
        return;
      }

      try {
        const credential = await signInWithPopup(firebaseAuth, googleProvider);
        await syncCurrentUser(credential.user);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const shouldUseRedirect = [
          'auth/popup-blocked',
          'auth/popup-closed-by-user',
          'auth/cancelled-popup-request',
          'auth/operation-not-supported-in-this-environment'
        ].some((code) => message.includes(code));

        if (!shouldUseRedirect) {
          throw error;
        }

        await signInWithRedirect(firebaseAuth, googleProvider);
      }
    },
    signInWithApple: async () => {
      await signInWithSocialProvider(appleProvider);
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
    sendPhoneCode: async (phoneNumber: string) => {
      updateAuthStore({ authError: '' });
      await setPersistence(firebaseAuth, browserLocalPersistence);
      phoneConfirmationResult = await signInWithPhoneNumber(firebaseAuth, phoneNumber, getPhoneRecaptchaVerifier());
    },
    confirmPhoneCode: async (code: string) => {
      updateAuthStore({ authError: '' });
      if (!phoneConfirmationResult) {
        throw new Error('auth/missing-verification-code');
      }

      const credential = await phoneConfirmationResult.confirm(code.trim());
      phoneConfirmationResult = null;
      await syncCurrentUser(credential.user);
    },
    logout: async () => {
      updateAuthStore({ authError: '' });
      stopProfileListener();
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
