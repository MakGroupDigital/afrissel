import { User } from 'firebase/auth';
import { get, push, ref, runTransaction, serverTimestamp, update } from 'firebase/database';
import { realtimeDb } from '../../lib/firebase';
import { getWonyaPayStatus, initiateWonyaPayPayment, WonyaPayPaymentResponse } from '../../lib/wonyapay';

export type WalletOperationType = 'deposit' | 'withdraw' | 'transfer';
export type WalletOperationStatus = 'confirmed' | 'pending_operator' | 'failed' | 'refunded';

type WalletOperationInput = {
  user: User;
  type: WalletOperationType;
  amount: number;
  currency: string;
  phoneOrRecipient: string;
  accountNumber?: string;
  note?: string;
};

type WonyapayMeta = {
  refTransa?: string;
  status?: string;
  completed?: boolean;
  failed?: boolean;
  response?: unknown;
  checkedAt?: number;
};

type RawWalletTransaction = {
  id?: string;
  type?: 'credit' | 'debit';
  title?: string;
  amount?: number;
  currency?: string;
  module?: string;
  channel?: string;
  status?: WalletOperationStatus | string;
  recipient?: string;
  note?: string;
  operationType?: WalletOperationType;
  provider?: string;
  balanceApplied?: boolean;
  refundApplied?: boolean;
  wonyapay?: WonyapayMeta;
  createdAt?: number;
};

const normalizeAmount = (amount: number) => {
  const nextAmount = Math.round(Number(amount) * 100) / 100;
  if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
    throw new Error('Montant invalide.');
  }
  return nextAmount;
};

const normalizeCurrency = (currency: string) => {
  const nextCurrency = currency.trim().toUpperCase();
  if (nextCurrency !== 'CDF' && nextCurrency !== 'USD') {
    throw new Error('Wonyapay accepte uniquement USD ou CDF pour dépôt et retrait.');
  }
  return nextCurrency;
};

const getAccountNumber = (uid: string) => `SPAY${uid.slice(0, 4).toUpperCase()}${Date.now().toString().slice(-4)}`;

const getOperationTitle = (type: WalletOperationType, recipient: string) => {
  if (type === 'deposit') return `Dépôt Mobile Money ${recipient}`;
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

const walletBaseUpdates = (input: WalletOperationInput, currency: string) => ({
  [`wallets/${input.user.uid}/currency`]: currency,
  [`wallets/${input.user.uid}/status`]: 'active',
  [`wallets/${input.user.uid}/accountNumber`]: input.accountNumber || getAccountNumber(input.user.uid),
  [`wallets/${input.user.uid}/updatedAt`]: serverTimestamp()
});

const writeWonyaPayStatus = async (
  uid: string,
  operationId: string,
  status: WalletOperationStatus,
  wonyapay: WonyapayMeta,
  extra: Record<string, unknown> = {}
) => update(ref(realtimeDb), {
  [`walletTransactions/${uid}/${operationId}/status`]: status,
  [`walletTransactions/${uid}/${operationId}/wonyapay`]: wonyapay,
  [`walletTransactions/${uid}/${operationId}/updatedAt`]: serverTimestamp(),
  [`spayOperations/${operationId}/status`]: status,
  [`spayOperations/${operationId}/wonyapay`]: wonyapay,
  [`spayOperations/${operationId}/updatedAt`]: serverTimestamp(),
  ...extra
});

const applyConfirmedWonyaPayOperation = async (
  uid: string,
  operationId: string,
  operation: RawWalletTransaction,
  wonyapay: WonyapayMeta
) => {
  if (operation.operationType === 'deposit' && !operation.balanceApplied) {
    await creditWallet(uid, Math.abs(Number(operation.amount || 0)));
    await writeWonyaPayStatus(uid, operationId, 'confirmed', wonyapay, {
      [`walletTransactions/${uid}/${operationId}/balanceApplied`]: true,
      [`spayOperations/${operationId}/balanceApplied`]: true
    });
    return;
  }

  await writeWonyaPayStatus(uid, operationId, 'confirmed', wonyapay);
};

const applyFailedWonyaPayOperation = async (
  uid: string,
  operationId: string,
  operation: RawWalletTransaction,
  wonyapay: WonyapayMeta
) => {
  const shouldRefund = (operation.operationType === 'withdraw' || operation.operationType === 'transfer') && !operation.refundApplied;

  if (shouldRefund) {
    await creditWallet(uid, Math.abs(Number(operation.amount || 0)));
  }

  await writeWonyaPayStatus(uid, operationId, shouldRefund ? 'refunded' : 'failed', wonyapay, shouldRefund ? {
    [`walletTransactions/${uid}/${operationId}/refundApplied`]: true,
    [`spayOperations/${operationId}/refundApplied`]: true
  } : {});
};

const finalizeWonyaPayResponse = async (
  uid: string,
  operationId: string,
  operation: RawWalletTransaction,
  response: WonyaPayPaymentResponse
) => {
  const wonyapay: WonyapayMeta = {
    refTransa: response.refTransa,
    status: response.providerStatus,
    completed: response.completed,
    failed: response.failed,
    response: response.rawResponse,
    checkedAt: Date.now()
  };

  if (response.completed) {
    await applyConfirmedWonyaPayOperation(uid, operationId, operation, wonyapay);
    return 'confirmed' as WalletOperationStatus;
  }

  if (response.failed) {
    await applyFailedWonyaPayOperation(uid, operationId, operation, wonyapay);
    return operation.operationType === 'deposit' ? 'failed' as WalletOperationStatus : 'refunded' as WalletOperationStatus;
  }

  await writeWonyaPayStatus(uid, operationId, 'pending_operator', wonyapay);
  return 'pending_operator' as WalletOperationStatus;
};

export async function executeWalletOperation(input: WalletOperationInput) {
  const amount = normalizeAmount(input.amount);
  const currency = input.type === 'transfer' ? input.currency.trim().toUpperCase() || 'USD' : normalizeCurrency(input.currency);
  const recipient = input.phoneOrRecipient.trim();
  if (!recipient) throw new Error('Numéro ou bénéficiaire requis.');

  const operationRef = push(ref(realtimeDb, `walletTransactions/${input.user.uid}`));
  const operationId = operationRef.key;
  if (!operationId) throw new Error('Opération AfriSpay impossible.');

  const now = Date.now();
  const title = getOperationTitle(input.type, recipient);
  const recipientUid = input.type === 'transfer' && recipient.startsWith('uid:')
    ? recipient.replace(/^uid:/, '').trim()
    : '';

  if (recipientUid === input.user.uid) {
    throw new Error('Impossible de transférer vers ton propre wallet.');
  }

  if (input.type === 'deposit') {
    const transaction: RawWalletTransaction = {
      id: operationId,
      type: 'credit',
      title,
      amount,
      currency,
      module: 'spay',
      channel: 'Wonyapay Mobile Money',
      status: 'pending_operator',
      recipient,
      note: input.note || '',
      operationType: input.type,
      provider: 'Wonyapay',
      balanceApplied: false,
      createdAt: now
    };

    await update(ref(realtimeDb), {
      ...walletBaseUpdates(input, currency),
      [`walletTransactions/${input.user.uid}/${operationId}`]: {
        ...transaction,
        updatedAt: serverTimestamp()
      },
      [`spayOperations/${operationId}`]: {
        id: operationId,
        userId: input.user.uid,
        type: input.type,
        amount,
        currency,
        recipient,
        provider: 'Wonyapay',
        status: 'pending_operator',
        createdAt: now,
        updatedAt: serverTimestamp()
      }
    });

    try {
      const response = await initiateWonyaPayPayment({
        action: 'C2B',
        amount,
        currency,
        phoneNumber: recipient,
        motif: input.note || 'Dépôt AfriSpay',
        refPrefix: 'AFD'
      });
      const status = await finalizeWonyaPayResponse(input.user.uid, operationId, transaction, response);
      return { operationId, status, amount, currency };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Dépôt Wonyapay impossible.';
      await writeWonyaPayStatus(input.user.uid, operationId, 'failed', {
        status: 'failed',
        failed: true,
        response: { message },
        checkedAt: Date.now()
      });
      throw new Error(message);
    }
  }

  if (input.type === 'withdraw') {
    await debitWallet(input.user.uid, amount);

    const transaction: RawWalletTransaction = {
      id: operationId,
      type: 'debit',
      title,
      amount: -amount,
      currency,
      module: 'spay',
      channel: 'Wonyapay Mobile Money',
      status: 'pending_operator',
      recipient,
      note: input.note || '',
      operationType: input.type,
      provider: 'Wonyapay',
      createdAt: now
    };

    await update(ref(realtimeDb), {
      ...walletBaseUpdates(input, currency),
      [`walletTransactions/${input.user.uid}/${operationId}`]: {
        ...transaction,
        updatedAt: serverTimestamp()
      },
      [`spayOperations/${operationId}`]: {
        id: operationId,
        userId: input.user.uid,
        type: input.type,
        amount,
        currency,
        recipient,
        provider: 'Wonyapay',
        status: 'pending_operator',
        createdAt: now,
        updatedAt: serverTimestamp()
      }
    });

    try {
      const response = await initiateWonyaPayPayment({
        action: 'B2C',
        amount,
        currency,
        phoneNumber: recipient,
        motif: input.note || 'Retrait AfriSpay',
        refPrefix: 'AFR'
      });
      const status = await finalizeWonyaPayResponse(input.user.uid, operationId, transaction, response);
      return { operationId, status, amount, currency };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Retrait Wonyapay impossible.';
      await applyFailedWonyaPayOperation(input.user.uid, operationId, transaction, {
        status: 'failed',
        failed: true,
        response: { message },
        checkedAt: Date.now()
      });
      throw new Error(message);
    }
  }

  if (!recipientUid) {
    throw new Error('Le transfert AfriSpay doit cibler un wallet interne avec uid:bénéficiaire. Utilise Retrait pour envoyer vers Mobile Money.');
  }

  await debitWallet(input.user.uid, amount);
  await creditWallet(recipientUid, amount);

  const userTransaction = {
    id: operationId,
    type: 'debit',
    title,
    amount: -amount,
    currency,
    module: 'spay',
    channel: 'AfriSpay wallet',
    status: 'confirmed',
    recipient,
    note: input.note || '',
    operationType: input.type,
    createdAt: now,
    updatedAt: serverTimestamp()
  };

  const updates: Record<string, unknown> = {
    ...walletBaseUpdates(input, currency),
    [`walletTransactions/${input.user.uid}/${operationId}`]: userTransaction,
    [`spayOperations/${operationId}`]: {
      id: operationId,
      userId: input.user.uid,
      type: input.type,
      amount,
      currency,
      recipient,
      status: 'confirmed',
      createdAt: now,
      updatedAt: serverTimestamp()
    },
    [`wallets/${recipientUid}/currency`]: currency,
    [`wallets/${recipientUid}/status`]: 'active',
    [`wallets/${recipientUid}/updatedAt`]: serverTimestamp(),
    [`walletTransactions/${recipientUid}/${operationId}`]: {
      id: operationId,
      type: 'credit',
      title: `Reçu de ${input.user.displayName || 'Utilisateur AfriSell'}`,
      amount,
      currency,
      module: 'spay',
      channel: 'AfriSpay wallet',
      status: 'confirmed',
      senderId: input.user.uid,
      createdAt: now,
      updatedAt: serverTimestamp()
    }
  };

  await update(ref(realtimeDb), updates);
  return {
    operationId,
    status: 'confirmed' as WalletOperationStatus,
    amount,
    currency
  };
}

export async function reconcileWonyaPayOperation(uid: string, operationId: string) {
  const operationSnapshot = await get(ref(realtimeDb, `walletTransactions/${uid}/${operationId}`));
  if (!operationSnapshot.exists()) return null;

  const operation = operationSnapshot.val() as RawWalletTransaction;
  const refTransa = operation.wonyapay?.refTransa;
  if (!refTransa || operation.provider !== 'Wonyapay') return null;
  if (operation.status === 'confirmed' || operation.status === 'failed' || operation.status === 'refunded') {
    return operation.status;
  }

  const response = await getWonyaPayStatus(refTransa);
  const wonyapay: WonyapayMeta = {
    ...operation.wonyapay,
    status: response.providerStatus,
    completed: response.completed,
    failed: response.failed,
    response: response.rawResponse,
    checkedAt: Date.now()
  };

  if (response.completed) {
    await applyConfirmedWonyaPayOperation(uid, operationId, operation, wonyapay);
    return 'confirmed';
  }

  if (response.failed) {
    await applyFailedWonyaPayOperation(uid, operationId, operation, wonyapay);
    return operation.operationType === 'deposit' ? 'failed' : 'refunded';
  }

  await writeWonyaPayStatus(uid, operationId, 'pending_operator', wonyapay);
  return 'pending_operator';
}
