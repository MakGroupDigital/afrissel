import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  getAuth,
  GoogleAuthProvider,
  indexedDBLocalPersistence,
  initializeAuth
} from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCdqNyHc2Fgr3brSc5oWR1ucEYzi_4rza4',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'afrisellapp.firebaseapp.com',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://afrisellapp-default-rtdb.firebaseio.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'afrisellapp',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'afrisellapp.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '582531352090',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:582531352090:web:9d42ce03733cc885f7f3a3',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-X2LJE0WH51'
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const firebaseAuth = (() => {
  try {
    return initializeAuth(firebaseApp, {
      persistence: [
        indexedDBLocalPersistence,
        browserLocalPersistence,
        browserSessionPersistence
      ]
    });
  } catch {
    return getAuth(firebaseApp);
  }
})();
export const realtimeDb = getDatabase(firebaseApp);
export const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({
  prompt: 'select_account'
});

const initializeAnalytics = async () => {
  if (typeof window === 'undefined') return;

  try {
    if (await isSupported()) {
      getAnalytics(firebaseApp);
    }
  } catch {
    // Analytics is optional and can be blocked by browser privacy settings.
  }
};

void initializeAnalytics();
