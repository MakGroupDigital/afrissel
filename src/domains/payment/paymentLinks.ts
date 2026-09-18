import { User } from 'firebase/auth';
import { get, push, ref, runTransaction, serverTimestamp, update } from 'firebase/database';
import { realtimeDb } from '../../lib/firebase';
import { getWonyaPayStatus, initiateWonyaPayPayment, WonyaPayPaymentResponse } from '../../lib/wonyapay';
import { getAfriZiaPublicOrigin } from '../../lib/zandofyShare';

export type AfriSpayPaymentLink = {
  id: string;
  ownerId: string;
  ownerName: string;
  ownerPhotoURL?: string;
  title: string;
  description?: string;
  reference: string;
  amountMode: 'fixed' | 'open';
  amount?: number;
  currency: 'USD' | 'CDF';
  status: 'active' | 'closed';
  expiresAt?: number;
  paymentsCount: number;
  collectedAmount: number;
  createdAt: number;
  updatedAt?: unknown;
};

export type AfriSpayPaymentLinkPayment = {
  id: string;
  linkId: string;
  ownerId: string;
  amount: number;
  currency: 'USD' | 'CDF';
  method: 'mobile_money' | 'afrispay';
  status: 'initiated' | 'pending_operator' | 'confirmed' | 'failed';
  payerId?: string;
  payerName?: string;
  phoneNumber?: string;
  providerReference?: string;
  providerStatus?: string;
  createdAt: number;
  updatedAt?: unknown;
};

type CreatePaymentLinkInput = {
  user: User;
  ownerName: string;
  ownerPhotoURL?: string;
  title: string;
  description?: string;
  amountMode: 'fixed' | 'open';
  amount?: number;
  currency: string;
  expiresAt?: number;
};

type UpdatePaymentLinkInput = Omit<CreatePaymentLinkInput, 'user' | 'ownerName' | 'ownerPhotoURL'> & {
  user: User;
  linkId: string;
};

const normalizeAmount = (value: number) => {
  const amount = Math.round(Number(value) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Ajoute un montant valide.');
  return amount;
};

const normalizeCurrency = (currency: string): 'USD' | 'CDF' => {
  const normalized = currency.trim().toUpperCase();
  if (normalized !== 'USD' && normalized !== 'CDF') throw new Error('AfriSpay accepte USD ou CDF.');
  return normalized;
};

const createReference = (uid: string) => `AZP-${uid.slice(0, 5).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

const maskPhoneNumber = (value: string) => {
  const normalized = value.replace(/\s+/g, '');
  if (normalized.length < 5) return '••••';
  return `${normalized.slice(0, 3)}••••${normalized.slice(-2)}`;
};

export const getAfriSpayPaymentLinkURL = (linkId: string) => `${getAfriZiaPublicOrigin()}/share/pay/${encodeURIComponent(linkId)}`;

export const isAfriSpayPaymentLinkExpired = (link?: Pick<AfriSpayPaymentLink, 'expiresAt'> | null) => (
  Boolean(link?.expiresAt && Number(link.expiresAt) <= Date.now())
);

export async function createAfriSpayPaymentLink(input: CreatePaymentLinkInput) {
  const title = input.title.trim();
  if (!title) throw new Error('Donne un objet à ce paiement.');
  const amountMode = input.amountMode;
  const amount = amountMode === 'fixed' ? normalizeAmount(Number(input.amount)) : undefined;
  const currency = normalizeCurrency(input.currency);
  const expiresAt = Number(input.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) throw new Error('Choisis une date d’expiration à venir.');
  const paymentRef = push(ref(realtimeDb, 'afriSpayPaymentLinks'));
  const id = paymentRef.key;
  if (!id) throw new Error('Création du lien impossible. Réessaie.');

  const link: AfriSpayPaymentLink = {
    id,
    ownerId: input.user.uid,
    ownerName: input.ownerName.trim() || input.user.displayName || 'AfriSpay',
    ownerPhotoURL: input.ownerPhotoURL || input.user.photoURL || '',
    title,
    description: input.description?.trim() || '',
    reference: createReference(input.user.uid),
    amountMode,
    ...(amount ? { amount } : {}),
    currency,
    status: 'active',
    expiresAt,
    paymentsCount: 0,
    collectedAmount: 0,
    createdAt: Date.now(),
    updatedAt: serverTimestamp()
  };

  await update(ref(realtimeDb), {
    [`afriSpayPaymentLinks/${id}`]: link,
    [`afriSpayPaymentLinksByOwner/${input.user.uid}/${id}`]: true
  });
  return link;
}

export async function updateAfriSpayPaymentLink(input: UpdatePaymentLinkInput) {
  const existingSnapshot = await get(ref(realtimeDb, `afriSpayPaymentLinks/${input.linkId}`));
  if (!existingSnapshot.exists()) throw new Error('Lien de paiement introuvable.');
  const existing = existingSnapshot.val() as AfriSpayPaymentLink;
  if (existing.ownerId !== input.user.uid) throw new Error('Tu ne peux pas modifier ce lien.');
  if (existing.status !== 'active') throw new Error('Ce lien est fermé. Crée un nouveau lien pour encaisser.');

  const title = input.title.trim();
  if (!title) throw new Error('Donne un objet à ce paiement.');
  const amountMode = input.amountMode;
  const amount = amountMode === 'fixed' ? normalizeAmount(Number(input.amount)) : undefined;
  const currency = normalizeCurrency(input.currency);
  const expiresAt = Number(input.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) throw new Error('Choisis une date d’expiration à venir.');

  await update(ref(realtimeDb), {
    [`afriSpayPaymentLinks/${existing.id}/title`]: title,
    [`afriSpayPaymentLinks/${existing.id}/description`]: input.description?.trim() || '',
    [`afriSpayPaymentLinks/${existing.id}/amountMode`]: amountMode,
    [`afriSpayPaymentLinks/${existing.id}/amount`]: amount ?? null,
    [`afriSpayPaymentLinks/${existing.id}/currency`]: currency,
    [`afriSpayPaymentLinks/${existing.id}/expiresAt`]: expiresAt,
    [`afriSpayPaymentLinks/${existing.id}/updatedAt`]: serverTimestamp()
  });
  return { ...existing, title, description: input.description?.trim() || '', amountMode, amount, currency, expiresAt };
}

export async function deleteAfriSpayPaymentLink(user: User, linkId: string) {
  const existingSnapshot = await get(ref(realtimeDb, `afriSpayPaymentLinks/${linkId}`));
  if (!existingSnapshot.exists()) return;
  const existing = existingSnapshot.val() as AfriSpayPaymentLink;
  if (existing.ownerId !== user.uid) throw new Error('Tu ne peux pas supprimer ce lien.');
  await update(ref(realtimeDb), {
    [`afriSpayPaymentLinks/${linkId}/status`]: 'closed',
    [`afriSpayPaymentLinks/${linkId}/closedAt`]: Date.now(),
    [`afriSpayPaymentLinks/${linkId}/updatedAt`]: serverTimestamp(),
    [`afriSpayPaymentLinksByOwner/${user.uid}/${linkId}`]: null
  });
}

const updatePaymentLinkTotals = async (linkId: string, amount: number) => {
  await runTransaction(ref(realtimeDb, `afriSpayPaymentLinks/${linkId}`), (current) => {
    if (!current || typeof current !== 'object') return current;
    return {
      ...current,
      paymentsCount: Number(current.paymentsCount || 0) + 1,
      collectedAmount: Math.round((Number(current.collectedAmount || 0) + amount) * 100) / 100,
      updatedAt: Date.now()
    };
  });
};

const creditPaymentLinkOwner = async (link: AfriSpayPaymentLink, payment: AfriSpayPaymentLinkPayment) => {
  const walletResult = await runTransaction(ref(realtimeDb, `wallets/${link.ownerId}`), (current) => {
    const wallet = current && typeof current === 'object' ? current as Record<string, unknown> : {};
    const credits = wallet.paymentLinkCredits && typeof wallet.paymentLinkCredits === 'object'
      ? wallet.paymentLinkCredits as Record<string, boolean>
      : {};
    if (credits[payment.id]) return;
    return {
      ...wallet,
      balance: Math.round((Number(wallet.balance || 0) + payment.amount) * 100) / 100,
      currency: link.currency,
      status: 'active',
      paymentLinkCredits: { ...credits, [payment.id]: true },
      updatedAt: Date.now()
    };
  });

  if (!walletResult.committed) return false;

  try {
    await update(ref(realtimeDb), {
      [`walletTransactions/${link.ownerId}/${payment.id}`]: {
        id: payment.id,
        type: 'credit',
        title: `Encaissement ${link.title}`,
        amount: payment.amount,
        currency: link.currency,
        module: 'spay',
        channel: payment.method === 'mobile_money' ? 'Mobile Money' : 'AfriSpay wallet',
        status: 'confirmed',
        paymentLinkId: link.id,
        paymentReference: link.reference,
        payerId: payment.payerId || '',
        createdAt: payment.createdAt,
        updatedAt: serverTimestamp()
      },
      [`spayOperations/${payment.id}`]: {
        id: payment.id,
        userId: link.ownerId,
        type: 'payment_link',
        amount: payment.amount,
        currency: link.currency,
        status: 'confirmed',
        paymentLinkId: link.id,
        createdAt: payment.createdAt,
        updatedAt: serverTimestamp()
      }
    });
    await updatePaymentLinkTotals(link.id, payment.amount);
  } catch (error) {
    // Le crédit est déjà atomiquement inscrit dans le wallet. La réconciliation peut restaurer les métadonnées plus tard.
    console.error('Historique d’encaissement AfriSpay impossible:', error);
  }
  return true;
};

const writePaymentStatus = async (linkId: string, paymentId: string, updates: Record<string, unknown>) => {
  await update(ref(realtimeDb), Object.fromEntries(Object.entries(updates).map(([key, value]) => [
    `afriSpayPaymentLinkPayments/${linkId}/${paymentId}/${key}`,
    value
  ])));
};

export async function reconcileAfriSpayPaymentLinkPayment(linkId: string, paymentId: string) {
  const [linkSnapshot, paymentSnapshot] = await Promise.all([
    get(ref(realtimeDb, `afriSpayPaymentLinks/${linkId}`)),
    get(ref(realtimeDb, `afriSpayPaymentLinkPayments/${linkId}/${paymentId}`))
  ]);
  if (!linkSnapshot.exists() || !paymentSnapshot.exists()) throw new Error('Paiement introuvable.');
  const link = linkSnapshot.val() as AfriSpayPaymentLink;
  const payment = paymentSnapshot.val() as AfriSpayPaymentLinkPayment;
  if (payment.status === 'confirmed') return payment;

  if (!payment.providerReference) return payment;
  const providerStatus = await getWonyaPayStatus(payment.providerReference);
  if (providerStatus.failed) {
    await writePaymentStatus(linkId, paymentId, {
      status: 'failed',
      providerStatus: providerStatus.providerStatus,
      updatedAt: serverTimestamp()
    });
    return { ...payment, status: 'failed', providerStatus: providerStatus.providerStatus };
  }

  if (!providerStatus.completed) {
    await writePaymentStatus(linkId, paymentId, {
      status: 'pending_operator',
      providerStatus: providerStatus.providerStatus,
      updatedAt: serverTimestamp()
    });
    return { ...payment, status: 'pending_operator', providerStatus: providerStatus.providerStatus };
  }

  await creditPaymentLinkOwner(link, payment);
  await writePaymentStatus(linkId, paymentId, {
    status: 'confirmed',
    providerStatus: providerStatus.providerStatus,
    confirmedAt: Date.now(),
    updatedAt: serverTimestamp()
  });
  return { ...payment, status: 'confirmed', providerStatus: providerStatus.providerStatus };
}

export async function payAfriSpayPaymentLinkWithMobileMoney(input: {
  link: AfriSpayPaymentLink;
  amount: number;
  phoneNumber: string;
}) {
  const amount = input.link.amountMode === 'fixed' ? normalizeAmount(Number(input.link.amount)) : normalizeAmount(input.amount);
  const phoneNumber = input.phoneNumber.trim();
  if (!phoneNumber) throw new Error('Entre le numéro Mobile Money à débiter.');
  if (input.link.status !== 'active' || isAfriSpayPaymentLinkExpired(input.link)) throw new Error('Ce lien de paiement n’est plus actif.');

  const paymentRef = push(ref(realtimeDb, `afriSpayPaymentLinkPayments/${input.link.id}`));
  const id = paymentRef.key;
  if (!id) throw new Error('Paiement impossible. Réessaie.');
  const payment: AfriSpayPaymentLinkPayment = {
    id,
    linkId: input.link.id,
    ownerId: input.link.ownerId,
    amount,
    currency: input.link.currency,
    method: 'mobile_money',
    status: 'initiated',
    phoneNumber: maskPhoneNumber(phoneNumber),
    createdAt: Date.now(),
    updatedAt: serverTimestamp()
  };
  await update(ref(realtimeDb), { [`afriSpayPaymentLinkPayments/${input.link.id}/${id}`]: payment });

  let response: WonyaPayPaymentResponse;
  try {
    response = await initiateWonyaPayPayment({
      action: 'C2B',
      amount,
      currency: input.link.currency,
      phoneNumber,
      motif: `Paiement AfriSpay ${input.link.reference}`,
      refPrefix: 'AZP'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Paiement Mobile Money impossible.';
    await writePaymentStatus(input.link.id, id, { status: 'failed', failureReason: message, updatedAt: serverTimestamp() });
    throw new Error(message);
  }

  await writePaymentStatus(input.link.id, id, {
    status: response.failed ? 'failed' : 'pending_operator',
    providerReference: response.refTransa,
    providerStatus: response.providerStatus,
    updatedAt: serverTimestamp()
  });
  if (response.failed) throw new Error('Le paiement Mobile Money a été refusé.');
  if (response.completed) {
    await creditPaymentLinkOwner(input.link, payment);
    await writePaymentStatus(input.link.id, id, {
      status: 'confirmed',
      confirmedAt: Date.now(),
      updatedAt: serverTimestamp()
    });
    return { ...payment, status: 'confirmed' as const, providerReference: response.refTransa, providerStatus: response.providerStatus };
  }
  return { ...payment, status: 'pending_operator' as const, providerReference: response.refTransa, providerStatus: response.providerStatus };
}

export async function payAfriSpayPaymentLinkWithWallet(input: {
  link: AfriSpayPaymentLink;
  amount: number;
  payer: User;
}) {
  if (input.payer.isAnonymous) throw new Error('Connecte-toi pour payer avec AfriSpay.');
  if (input.link.ownerId === input.payer.uid) throw new Error('Tu ne peux pas payer ton propre lien.');
  if (input.link.status !== 'active' || isAfriSpayPaymentLinkExpired(input.link)) throw new Error('Ce lien de paiement n’est plus actif.');
  const amount = input.link.amountMode === 'fixed' ? normalizeAmount(Number(input.link.amount)) : normalizeAmount(input.amount);
  const paymentRef = push(ref(realtimeDb, `afriSpayPaymentLinkPayments/${input.link.id}`));
  const id = paymentRef.key;
  if (!id) throw new Error('Paiement impossible. Réessaie.');
  const payment: AfriSpayPaymentLinkPayment = {
    id,
    linkId: input.link.id,
    ownerId: input.link.ownerId,
    amount,
    currency: input.link.currency,
    method: 'afrispay',
    status: 'initiated',
    payerId: input.payer.uid,
    payerName: input.payer.displayName || 'Client AfriZia',
    createdAt: Date.now(),
    updatedAt: serverTimestamp()
  };
  await update(ref(realtimeDb), { [`afriSpayPaymentLinkPayments/${input.link.id}/${id}`]: payment });

  const debitResult = await runTransaction(ref(realtimeDb, `wallets/${input.payer.uid}/balance`), (current) => {
    const balance = Number(current || 0);
    if (!Number.isFinite(balance) || balance < amount) return;
    return Math.round((balance - amount) * 100) / 100;
  });
  if (!debitResult.committed) {
    await writePaymentStatus(input.link.id, id, { status: 'failed', failureReason: 'Solde AfriSpay insuffisant.', updatedAt: serverTimestamp() });
    throw new Error('Solde AfriSpay insuffisant.');
  }

  try {
    await creditPaymentLinkOwner(input.link, payment);
  } catch (error) {
    await runTransaction(ref(realtimeDb, `wallets/${input.payer.uid}/balance`), (current) => Math.round((Number(current || 0) + amount) * 100) / 100);
    await writePaymentStatus(input.link.id, id, { status: 'failed', failureReason: 'Paiement non finalisé.', updatedAt: serverTimestamp() });
    throw error;
  }

  await update(ref(realtimeDb), {
    [`afriSpayPaymentLinkPayments/${input.link.id}/${id}/status`]: 'confirmed',
    [`afriSpayPaymentLinkPayments/${input.link.id}/${id}/confirmedAt`]: Date.now(),
    [`afriSpayPaymentLinkPayments/${input.link.id}/${id}/updatedAt`]: serverTimestamp(),
    [`walletTransactions/${input.payer.uid}/${id}`]: {
      id,
      type: 'debit',
      title: `Paiement ${input.link.title}`,
      amount: -amount,
      currency: input.link.currency,
      module: 'spay',
      channel: 'AfriSpay wallet',
      status: 'confirmed',
      paymentLinkId: input.link.id,
      paymentReference: input.link.reference,
      recipient: `uid:${input.link.ownerId}`,
      createdAt: payment.createdAt,
      updatedAt: serverTimestamp()
    }
  });
  return { ...payment, status: 'confirmed' as const };
}
