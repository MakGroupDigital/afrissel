import { config as loadEnv } from 'dotenv';
import { initializeApp } from 'firebase/app';
import { get, getDatabase, ref, update } from 'firebase/database';

loadEnv({ path: '.env.local' });
loadEnv();

if (process.env.RESET_WALLETS_CONFIRM !== 'YES') {
  throw new Error('Protection active. Lance avec RESET_WALLETS_CONFIRM=YES pour remettre les soldes à zéro.');
}

const app = initializeApp({
  apiKey: process.env.VITE_FIREBASE_API_KEY || 'AIzaSyCdqNyHc2Fgr3brSc5oWR1ucEYzi_4rza4',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'afrisellapp.firebaseapp.com',
  databaseURL: process.env.VITE_FIREBASE_DATABASE_URL || 'https://afrisellapp-default-rtdb.firebaseio.com',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'afrisellapp',
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || 'afrisellapp.firebasestorage.app',
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '582531352090',
  appId: process.env.VITE_FIREBASE_APP_ID || '1:582531352090:web:9d42ce03733cc885f7f3a3',
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-X2LJE0WH51'
});

const db = getDatabase(app);
const snapshot = await get(ref(db, 'wallets'));

if (!snapshot.exists()) {
  console.log('Aucun wallet à réinitialiser.');
  process.exit(0);
}

const wallets = snapshot.val();
const resetId = `wallet-reset-${Date.now()}`;
const resetAt = Date.now();
const updates = {
  [`walletBalanceResets/${resetId}`]: {
    id: resetId,
    reason: 'Passage aux paiements réels Wonyapay via AfriSpay',
    createdAt: resetAt,
    affectedWallets: Object.keys(wallets).length
  }
};

for (const uid of Object.keys(wallets)) {
  updates[`wallets/${uid}/balance`] = 0;
  updates[`wallets/${uid}/balanceSource`] = 'wonyapay_live';
  updates[`wallets/${uid}/lastBalanceResetId`] = resetId;
  updates[`wallets/${uid}/lastBalanceResetAt`] = resetAt;
  updates[`wallets/${uid}/updatedAt`] = resetAt;
}

await update(ref(db), updates);

console.log(`Soldes réinitialisés: ${Object.keys(wallets).length} wallet(s).`);
console.log(`Reset ID: ${resetId}`);
process.exit(0);
