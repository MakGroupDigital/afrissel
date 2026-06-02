import { User } from 'firebase/auth';
import { push, ref, runTransaction, serverTimestamp, update } from 'firebase/database';
import { realtimeDb } from '../../lib/firebase';

export type WalletOperationType = 'deposit' | 'withdraw' | 'transfer';

type WalletOperationInput = {
  user: User;
  type: WalletOperationType;
  amount: number;
  currency: string;
  phoneOrRecipient: string;
  accountNumber?: string;
  note?: string;
};

const normalizeAmount = (amount: number) => {
  const nextAmount = Math.round(Number(amount) * 100) / 100;
  if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
    throw new Error('Montant invalide.');
  }
  return nextAmount;
};

const getAccountNumber = (uid: string) => `SPAY${uid.slice(0, 4).toUpperCase()}${Date.now().toString().slice(-4)}`;

const getOperationTitle = (type: WalletOperationType, recipient: string) => {
  if (type === 'deposit') return `Depot Mobile Money ${recipient}`;
  if (type === 'withdraw') return `Retrait Mobile Money ${recipient}`;
  return `Transfert AfriSpay ${recipient}`;
};

const debitWallet = async (uid: string, amount: number) => {
  const result = await runTransaction(ref(realtimeDb, `wallets/${uid}/balance`), (currentBalance) => {
    const balance = Number(currentBalance || 0);
    if (!Number.isFinite(balance) || balance < amount) return;
    return balance - amount;
  });

  if (!result.committed) {
    throw new Error('Solde AfriSpay insuffisant.');
  }
};

const creditWallet = async (uid: string, amount: number) => {
  await runTransaction(ref(realtimeDb, `wallets/${uid}/balance`), (currentBalance) => {
    const balance = Number(currentBalance || 0);
    return balance + amount;
  });
};

export async function executeWalletOperation(input: WalletOperationInput) {
  const amount = normalizeAmount(input.amount);
  const recipient = input.phoneOrRecipient.trim();
  if (!recipient) throw new Error('Numero ou beneficiaire requis.');

  const operationRef = push(ref(realtimeDb, `walletTransactions/${input.user.uid}`));
  const operationId = operationRef.key;
  if (!operationId) throw new Error('Operation AfriSpay impossible.');

  const now = Date.now();
  const title = getOperationTitle(input.type, recipient);
  const recipientUid = input.type === 'transfer' && recipient.startsWith('uid:')
    ? recipient.replace(/^uid:/, '').trim()
    : '';

  if (recipientUid === input.user.uid) {
    throw new Error('Impossible de transferer vers ton propre wallet.');
  }

  if (input.type === 'deposit') {
    await creditWallet(input.user.uid, amount);
  } else {
    await debitWallet(input.user.uid, amount);
  }

  if (recipientUid) {
    await creditWallet(recipientUid, amount);
  }

  const userTransaction = {
    id: operationId,
    type: input.type === 'deposit' ? 'credit' : 'debit',
    title,
    amount: input.type === 'deposit' ? amount : -amount,
    currency: input.currency,
    module: 'spay',
    channel: recipientUid ? 'AfriSpay wallet' : 'Mobile Money',
    status: recipientUid || input.type !== 'transfer' ? 'confirmed' : 'pending_operator',
    recipient,
    note: input.note || '',
    createdAt: now,
    updatedAt: serverTimestamp()
  };

  const updates: Record<string, unknown> = {
    [`wallets/${input.user.uid}/currency`]: input.currency,
    [`wallets/${input.user.uid}/status`]: 'active',
    [`wallets/${input.user.uid}/accountNumber`]: input.accountNumber || getAccountNumber(input.user.uid),
    [`wallets/${input.user.uid}/updatedAt`]: serverTimestamp(),
    [`walletTransactions/${input.user.uid}/${operationId}`]: userTransaction,
    [`spayOperations/${operationId}`]: {
      id: operationId,
      userId: input.user.uid,
      type: input.type,
      amount,
      currency: input.currency,
      recipient,
      status: userTransaction.status,
      createdAt: now,
      updatedAt: serverTimestamp()
    }
  };

  if (recipientUid) {
    updates[`wallets/${recipientUid}/currency`] = input.currency;
    updates[`wallets/${recipientUid}/status`] = 'active';
    updates[`wallets/${recipientUid}/updatedAt`] = serverTimestamp();
    updates[`walletTransactions/${recipientUid}/${operationId}`] = {
      id: operationId,
      type: 'credit',
      title: `Recu de ${input.user.displayName || 'Utilisateur AfriSell'}`,
      amount,
      currency: input.currency,
      module: 'spay',
      channel: 'AfriSpay wallet',
      status: 'confirmed',
      senderId: input.user.uid,
      createdAt: now,
      updatedAt: serverTimestamp()
    };
  }

  await update(ref(realtimeDb), updates);
  return {
    operationId,
    status: userTransaction.status,
    amount,
    currency: input.currency
  };
}
