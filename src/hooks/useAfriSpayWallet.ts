import { useEffect, useMemo, useState } from 'react';
import { limitToLast, off, onValue, orderByChild, query, ref } from 'firebase/database';
import { realtimeDb } from '../lib/firebase';
import { useFirebaseAuth } from './useFirebaseAuth';
import { AfriSellIconName } from '../components/AfriSellIcon';
import { isOfflineNow, offlineCacheKey, readOfflineCache, writeOfflineCache } from '../lib/offlineCache';

export type AfriSpayWallet = {
  balance?: number;
  currency?: string;
  accountNumber?: string;
  status?: string;
  updatedAt?: unknown;
};

export type AfriSpayTransaction = {
  id: string;
  type: 'credit' | 'debit';
  title: string;
  amount: number;
  currency: string;
  dateLabel: string;
  icon: AfriSellIconName;
  status?: string;
};

type RawTransaction = {
  type?: string;
  title?: string;
  name?: string;
  description?: string;
  amount?: number | string;
  currency?: string;
  createdAt?: number | string | { seconds?: number };
  timestamp?: number | string;
  channel?: string;
  module?: string;
  status?: string;
};

const formatDate = (value?: RawTransaction['createdAt'] | RawTransaction['timestamp']) => {
  if (!value) return 'Date non disponible';

  const timestamp = typeof value === 'object'
    ? (value.seconds || 0) * 1000
    : Number(value);

  if (!Number.isFinite(timestamp) || timestamp <= 0) return 'Date non disponible';

  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(timestamp));
};

const getTransactionIcon = (transaction: RawTransaction): AfriSellIconName => {
  const source = `${transaction.channel || ''} ${transaction.module || ''} ${transaction.title || ''} ${transaction.name || ''}`.toLowerCase();

  if (source.includes('market')) return 'market';
  if (source.includes('abc') || source.includes('video')) return 'video';
  if (source.includes('scan')) return 'scan';
  if (source.includes('phone') || source.includes('m-pesa') || source.includes('orange') || source.includes('airtel')) return 'phone';
  if (transaction.type === 'credit') return 'deposit';
  if (transaction.type === 'debit') return 'withdraw';
  return 'pay';
};

const normalizeTransaction = (id: string, transaction: RawTransaction): AfriSpayTransaction => {
  const amount = Number(transaction.amount || 0);
  const isDebit = transaction.type === 'debit' || amount < 0;

  return {
    id,
    type: isDebit ? 'debit' : 'credit',
    title: transaction.title || transaction.name || transaction.description || 'Transaction AfriSpay',
    amount,
    currency: transaction.currency || 'USD',
    dateLabel: formatDate(transaction.createdAt || transaction.timestamp),
    icon: getTransactionIcon(transaction),
    status: transaction.status
  };
};

const maskAccountNumber = (accountNumber?: string) => {
  if (!accountNumber) return '';
  const digits = accountNumber.replace(/\D/g, '');
  if (digits.length <= 4) return accountNumber;
  return `**** **** **** ${digits.slice(-4)}`;
};

export const useAfriSpayWallet = () => {
  const { user } = useFirebaseAuth();
  const [wallet, setWallet] = useState<AfriSpayWallet | null>(null);
  const [transactions, setTransactions] = useState<AfriSpayTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      setWallet(null);
      setTransactions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    const walletCacheKey = offlineCacheKey('wallet', user.uid);
    const transactionsCacheKey = offlineCacheKey('walletTransactions', user.uid);
    const cachedWallet = readOfflineCache<AfriSpayWallet | null>(walletCacheKey, null);
    const cachedTransactions = readOfflineCache<AfriSpayTransaction[]>(transactionsCacheKey, []);

    if (cachedWallet) setWallet(cachedWallet);
    if (cachedTransactions.length) setTransactions(cachedTransactions);

    if (isOfflineNow()) {
      setLoading(false);
      setError(cachedWallet || cachedTransactions.length ? 'Mode hors ligne: donnees AfriSpay locales affichees.' : 'Mode hors ligne: aucune donnee AfriSpay locale disponible.');
    }

    const walletRef = ref(realtimeDb, `wallets/${user.uid}`);
    const transactionsRef = query(
      ref(realtimeDb, `walletTransactions/${user.uid}`),
      orderByChild('createdAt'),
      limitToLast(30)
    );

    const unsubscribeWallet = onValue(
      walletRef,
      (snapshot) => {
        const fallback = readOfflineCache<AfriSpayWallet | null>(walletCacheKey, null);
        if (!snapshot.exists() && isOfflineNow() && fallback) {
          setWallet(fallback);
          setLoading(false);
          return;
        }

        const nextWallet = snapshot.exists() ? snapshot.val() as AfriSpayWallet : null;
        setWallet(nextWallet);
        writeOfflineCache(walletCacheKey, nextWallet);
        setLoading(false);
      },
      (walletError) => {
        console.error('Chargement wallet AfriSpay impossible:', walletError);
        const fallback = readOfflineCache<AfriSpayWallet | null>(walletCacheKey, null);
        if (fallback) setWallet(fallback);
        setError(fallback ? 'Mode hors ligne: wallet local affiche.' : 'Wallet indisponible pour le moment.');
        setLoading(false);
      }
    );

    const unsubscribeTransactions = onValue(
      transactionsRef,
      (snapshot) => {
        const fallback = readOfflineCache<AfriSpayTransaction[]>(transactionsCacheKey, []);
        if (!snapshot.exists() && isOfflineNow() && fallback.length) {
          setTransactions(fallback);
          return;
        }

        const data = snapshot.val() as Record<string, RawTransaction> | null;
        const nextTransactions = Object.entries(data || {})
          .map(([id, transaction]) => normalizeTransaction(id, transaction))
          .sort((first, second) => second.id.localeCompare(first.id));
        setTransactions(nextTransactions);
        writeOfflineCache(transactionsCacheKey, nextTransactions);
      },
      (transactionsError) => {
        console.error('Chargement transactions AfriSpay impossible:', transactionsError);
        const fallback = readOfflineCache<AfriSpayTransaction[]>(transactionsCacheKey, []);
        if (fallback.length) setTransactions(fallback);
        setError(fallback.length ? 'Mode hors ligne: transactions locales affichees.' : 'Transactions indisponibles pour le moment.');
      }
    );

    return () => {
      unsubscribeWallet();
      unsubscribeTransactions();
      off(walletRef);
      off(ref(realtimeDb, `walletTransactions/${user.uid}`));
    };
  }, [user]);

  return useMemo(() => ({
    wallet,
    balance: Number(wallet?.balance || 0),
    currency: wallet?.currency || 'USD',
    accountLabel: maskAccountNumber(wallet?.accountNumber),
    transactions,
    loading,
    error
  }), [error, loading, transactions, wallet]);
};
