type TauriWindow = Window & {
  __TAURI_INTERNALS__?: unknown;
  AfriSellNativeAuth?: {
    signInWithGoogle: (requestId: string, webClientId: string) => void;
  };
};

export const isTauriNative = () => {
  if (typeof window === 'undefined') return false;
  return Boolean((window as TauriWindow).__TAURI_INTERNALS__);
};

export const isTauriAndroid = () => {
  if (typeof window === 'undefined') return false;
  return isTauriNative() && /Android/i.test(window.navigator.userAgent);
};

type NativeGoogleAuthResult = {
  requestId: string;
  idToken?: string;
  email?: string;
  displayName?: string;
  photoUrl?: string;
  error?: string;
};

const getGoogleWebClientId = () => (
  (import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID as string | undefined) ||
  (import.meta.env.VITE_FIREBASE_GOOGLE_WEB_CLIENT_ID as string | undefined) ||
  ''
).trim();

export const signInWithNativeGoogle = () => new Promise<string>((resolve, reject) => {
  if (typeof window === 'undefined') {
    reject(new Error('Google natif indisponible.'));
    return;
  }

  const nativeAuth = (window as TauriWindow).AfriSellNativeAuth;
  if (!nativeAuth?.signInWithGoogle) {
    reject(new Error('Google natif Android indisponible dans cette version.'));
    return;
  }

  const webClientId = getGoogleWebClientId();
  if (!webClientId) {
    reject(new Error('Client Google Android manquant. Ajoute VITE_GOOGLE_WEB_CLIENT_ID depuis Firebase.'));
    return;
  }

  const requestId = `google-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const timeout = window.setTimeout(() => {
    window.removeEventListener('afrisell:native-auth-result', handleResult);
    reject(new Error('Connexion Google Android trop longue. Réessaie.'));
  }, 90000);

  function handleResult(event: Event) {
    const detail = (event as CustomEvent<NativeGoogleAuthResult>).detail;
    if (!detail || detail.requestId !== requestId) return;

    window.clearTimeout(timeout);
    window.removeEventListener('afrisell:native-auth-result', handleResult);

    if (detail.error) {
      reject(new Error(detail.error));
      return;
    }

    if (!detail.idToken) {
      reject(new Error('Google Android n’a pas retourné de jeton sécurisé.'));
      return;
    }

    resolve(detail.idToken);
  }

  window.addEventListener('afrisell:native-auth-result', handleResult);
  nativeAuth.signInWithGoogle(requestId, webClientId);
});
