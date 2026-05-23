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
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc
} from 'firebase/firestore';
import { firebaseAuth, firestoreDb, googleProvider } from '../lib/firebase';
import { CloudinaryUploadResult } from '../lib/cloudinary';

export interface AfriSellUserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  providerIds: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
  lastLoginAt?: unknown;
}

const buildProfile = (user: User, existing?: Partial<AfriSellUserProfile>): AfriSellUserProfile => ({
  uid: user.uid,
  email: user.email || existing?.email || '',
  displayName: user.displayName || existing?.displayName || 'Utilisateur AfriSell',
  photoURL: user.photoURL || existing?.photoURL || '',
  providerIds: user.providerData.map((provider) => provider.providerId)
});

const syncUserProfile = async (user: User): Promise<AfriSellUserProfile> => {
  const userRef = doc(firestoreDb, 'users', user.uid);
  const snap = await getDoc(userRef);
  const existing = snap.exists() ? snap.data() as Partial<AfriSellUserProfile> : {};
  const profile = buildProfile(user, existing);

  await setDoc(userRef, {
    ...profile,
    createdAt: snap.exists() ? existing.createdAt : serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastLoginAt: serverTimestamp()
  }, { merge: true });

  return profile;
};

export const updateAfriSellUserPhoto = async (user: User, photoURL: string) => {
  await updateProfile(user, { photoURL });
  await setDoc(doc(firestoreDb, 'users', user.uid), {
    photoURL,
    updatedAt: serverTimestamp()
  }, { merge: true });
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

  await Promise.all([
    addDoc(collection(firestoreDb, 'users', user.uid, 'media'), record),
    addDoc(collection(firestoreDb, 'media'), record)
  ]);

  return record;
};

export const useFirebaseAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AfriSellUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (currentUser) => {
      setUser(currentUser);
      setAuthError('');

      if (!currentUser) {
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        const syncedProfile = await syncUserProfile(currentUser);
        setProfile(syncedProfile);
      } catch (error) {
        console.error('Erreur profil Firestore:', error);
        setAuthError('Impossible de synchroniser le profil Firestore.');
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const actions = useMemo(() => ({
    signInWithGoogle: async () => {
      setAuthError('');
      const credential = await signInWithPopup(firebaseAuth, googleProvider);
      const syncedProfile = await syncUserProfile(credential.user);
      setUser(credential.user);
      setProfile(syncedProfile);
    },
    signInWithEmail: async (email: string, password: string) => {
      setAuthError('');
      const credential = await signInWithEmailAndPassword(firebaseAuth, email, password);
      const syncedProfile = await syncUserProfile(credential.user);
      setUser(credential.user);
      setProfile(syncedProfile);
    },
    registerWithEmail: async (name: string, email: string, password: string) => {
      setAuthError('');
      const credential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
      const displayName = name.trim() || email.split('@')[0] || 'Utilisateur AfriSell';
      await updateProfile(credential.user, { displayName });
      const syncedProfile = await syncUserProfile(credential.user);
      setUser(credential.user);
      setProfile(syncedProfile);
    },
    logout: async () => {
      setAuthError('');
      await signOut(firebaseAuth);
      setUser(null);
      setProfile(null);
    },
    refreshProfile: async () => {
      if (!firebaseAuth.currentUser) return null;
      const syncedProfile = await syncUserProfile(firebaseAuth.currentUser);
      setProfile(syncedProfile);
      return syncedProfile;
    }
  }), []);

  return {
    user,
    profile,
    loading,
    authError,
    setAuthError,
    ...actions
  };
};
