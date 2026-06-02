import { User } from 'firebase/auth';
import { push, ref, runTransaction, serverTimestamp, update } from 'firebase/database';
import { realtimeDb } from '../../lib/firebase';
import { Product, CheckoutDelivery } from '../../store/useAppStore';

type CommerceProfile = {
  displayName?: string;
  photoURL?: string;
  businessName?: string;
  logoURL?: string;
};

type CompleteOrderInput = {
  user: User;
  profile?: CommerceProfile | null;
  product: Product;
  delivery?: CheckoutDelivery | null;
};

type VillageShareInput = {
  user: User;
  profile?: CommerceProfile | null;
  product: Product;
};

const formatMoney = (value: number, currency = 'USD') => {
  if (currency === 'USD') return `$${value.toLocaleString('fr-FR')}`;
  if (currency === 'CDF') return `${value.toLocaleString('fr-FR')} CDF`;
  return `${value.toLocaleString('fr-FR')} ${currency}`;
};

const buyerName = (user: User, profile?: CommerceProfile | null) => (
  profile?.displayName || user.displayName || 'Client AfriSell'
);

const buyerAvatar = (user: User, profile?: CommerceProfile | null) => (
  profile?.photoURL || user.photoURL || ''
);

const getDirectThreadId = (firstUserId: string, secondUserId: string) => (
  [firstUserId, secondUserId].sort().join('_')
);

const getSellerId = (product: Product) => product.sellerId || '';

const ensureSeller = (product: Product, currentUserId: string) => {
  const sellerId = getSellerId(product);
  if (!sellerId) {
    throw new Error('Vendeur introuvable pour ce produit.');
  }
  if (sellerId === currentUserId) {
    throw new Error('Tu ne peux pas acheter ton propre produit.');
  }
  return sellerId;
};

export async function completeCommerceOrder({ user, profile, product, delivery }: CompleteOrderInput) {
  const sellerId = ensureSeller(product, user.uid);
  const deliveryPrice = Number(delivery?.price || 0);
  const productAmount = Number(product.villagePrice || product.price || 0);
  const totalAmount = productAmount + deliveryPrice;
  const currency = product.currency || 'USD';

  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    throw new Error('Montant de commande invalide.');
  }

  const walletBalanceRef = ref(realtimeDb, `wallets/${user.uid}/balance`);
  const debitResult = await runTransaction(walletBalanceRef, (currentBalance) => {
    const balance = Number(currentBalance || 0);
    if (!Number.isFinite(balance) || balance < totalAmount) return;
    return balance - totalAmount;
  });

  if (!debitResult.committed) {
    throw new Error('Solde AfriSpay insuffisant pour confirmer cette commande.');
  }

  const orderRef = push(ref(realtimeDb, 'orders'));
  const orderId = orderRef.key;
  if (!orderId) throw new Error('Creation de commande impossible.');

  const now = Date.now();
  const threadId = getDirectThreadId(user.uid, sellerId);
  const messageRef = push(ref(realtimeDb, `chatMessages/${threadId}`));
  const messageId = messageRef.key;
  const villageMembersNeeded = Math.max(Number(product.buyersNeeded || 1), 1);
  const nextBuyerCount = Number(product.buyersCount || 0) + 1;
  const villageStatus = nextBuyerCount >= villageMembersNeeded ? 'unlocked' : 'collecting';
  const deliveryRecord = delivery ? {
    id: delivery.id,
    title: delivery.title,
    description: delivery.description,
    price: deliveryPrice,
    eta: delivery.eta,
    status: delivery.id === 'pickup' ? 'pickup_requested' : 'pending_assignment'
  } : {
    id: 'standard',
    title: 'Livraison Safari',
    description: 'Livraison a coordonner avec le vendeur.',
    price: 0,
    eta: 'A confirmer',
    status: 'pending_assignment'
  };
  const customerName = buyerName(user, profile);
  const customerAvatar = buyerAvatar(user, profile);
  const orderMessage = `Commande ${orderId} confirmee: ${product.name} - ${formatMoney(totalAmount, currency)}. Livraison: ${deliveryRecord.title}.`;

  const updates: Record<string, unknown> = {
    [`orders/${orderId}`]: {
      id: orderId,
      productId: product.id,
      productName: product.name,
      productImage: product.imageUrl,
      productCategory: product.category || '',
      sellerId,
      sellerName: product.seller,
      buyerId: user.uid,
      buyerName: customerName,
      buyerAvatar: customerAvatar,
      quantity: 1,
      productAmount,
      deliveryAmount: deliveryPrice,
      totalAmount,
      currency,
      status: 'paid',
      paymentStatus: 'confirmed',
      deliveryStatus: deliveryRecord.status,
      villageStatus,
      chatThreadId: threadId,
      createdAt: now,
      updatedAt: now
    },
    [`userOrders/${user.uid}/${orderId}`]: true,
    [`sellerOrders/${sellerId}/${orderId}`]: true,
    [`wallets/${user.uid}/updatedAt`]: serverTimestamp(),
    [`walletTransactions/${user.uid}/${orderId}`]: {
      id: orderId,
      type: 'debit',
      title: `Achat ${product.name}`,
      amount: -totalAmount,
      currency,
      module: 'market',
      channel: 'AfriSpay',
      status: 'confirmed',
      orderId,
      createdAt: now
    },
    [`walletTransactions/${sellerId}/${orderId}`]: {
      id: orderId,
      type: 'credit',
      title: `Vente ${product.name}`,
      amount: productAmount,
      currency,
      module: 'market',
      channel: 'AfriSpay Escrow',
      status: 'escrow_pending_delivery',
      orderId,
      createdAt: now
    },
    [`safariDeliveries/${orderId}`]: {
      orderId,
      productId: product.id,
      buyerId: user.uid,
      buyerName: customerName,
      sellerId,
      sellerName: product.seller,
      productName: product.name,
      delivery: deliveryRecord,
      status: deliveryRecord.status,
      createdAt: now,
      updatedAt: now
    },
    [`villageDeals/${product.id}/productId`]: product.id,
    [`villageDeals/${product.id}/productName`]: product.name,
    [`villageDeals/${product.id}/sellerId`]: sellerId,
    [`villageDeals/${product.id}/villagePrice`]: product.villagePrice,
    [`villageDeals/${product.id}/currency`]: currency,
    [`villageDeals/${product.id}/buyersNeeded`]: villageMembersNeeded,
    [`villageDeals/${product.id}/buyersCount`]: nextBuyerCount,
    [`villageDeals/${product.id}/status`]: villageStatus,
    [`villageDeals/${product.id}/members/${user.uid}`]: {
      uid: user.uid,
      name: customerName,
      orderId,
      joinedAt: now
    },
    [`abcPosts/${product.id}/buyersCount`]: nextBuyerCount,
    [`marketProducts/${product.id}/buyersCount`]: nextBuyerCount,
    [`userChats/${user.uid}/${threadId}`]: {
      threadId,
      title: product.seller,
      avatarURL: '',
      participantId: sellerId,
      participantName: product.seller,
      type: 'direct',
      status: 'Commande Market',
      lastMessage: orderMessage,
      lastMessageAt: now,
      unreadCount: 0,
      updatedAt: serverTimestamp()
    },
    [`userChats/${sellerId}/${threadId}`]: {
      threadId,
      title: customerName,
      avatarURL: customerAvatar,
      participantId: user.uid,
      participantName: customerName,
      participantAvatarURL: customerAvatar,
      type: 'direct',
      status: 'Commande Market',
      lastMessage: orderMessage,
      lastMessageAt: now,
      unreadCount: 1,
      updatedAt: serverTimestamp()
    },
    [`chatThreads/${threadId}`]: {
      id: threadId,
      title: product.seller,
      type: 'direct',
      orderId,
      updatedAt: serverTimestamp()
    },
    [`chatThreads/${threadId}/members/${user.uid}`]: true,
    [`chatThreads/${threadId}/members/${sellerId}`]: true,
    [`chatThreads/${threadId}/memberNames/${user.uid}`]: customerName,
    [`chatThreads/${threadId}/memberNames/${sellerId}`]: product.seller
  };

  if (messageId) {
    updates[`chatMessages/${threadId}/${messageId}`] = {
      id: messageId,
      senderId: user.uid,
      text: orderMessage,
      type: 'order',
      orderId,
      productId: product.id,
      createdAt: now,
      status: 'sent'
    };
  }

  await update(ref(realtimeDb), updates);
  return { orderId, threadId, totalAmount, currency, villageStatus };
}

export async function shareVillageDealToAfriChat({ user, profile, product }: VillageShareInput) {
  const sellerId = ensureSeller(product, user.uid);
  const now = Date.now();
  const threadId = getDirectThreadId(user.uid, sellerId);
  const shareRef = push(ref(realtimeDb, `villageDeals/${product.id}/shares`));
  const messageRef = push(ref(realtimeDb, `chatMessages/${threadId}`));
  const shareId = shareRef.key;
  const messageId = messageRef.key;
  const customerName = buyerName(user, profile);
  const customerAvatar = buyerAvatar(user, profile);
  const price = formatMoney(product.villagePrice || product.price, product.currency);
  const message = `Prix Village partage: ${product.name} a ${price}. Objectif ${product.buyersCount || 0}/${product.buyersNeeded || 1} acheteurs.`;

  const updates: Record<string, unknown> = {
    [`villageDeals/${product.id}/productId`]: product.id,
    [`villageDeals/${product.id}/productName`]: product.name,
    [`villageDeals/${product.id}/sellerId`]: sellerId,
    [`villageDeals/${product.id}/villagePrice`]: product.villagePrice,
    [`villageDeals/${product.id}/currency`]: product.currency || 'USD',
    [`villageDeals/${product.id}/buyersNeeded`]: Math.max(Number(product.buyersNeeded || 1), 1),
    [`villageDeals/${product.id}/buyersCount`]: Number(product.buyersCount || 0),
    [`villageDeals/${product.id}/status`]: 'shared',
    [`userChats/${user.uid}/${threadId}`]: {
      threadId,
      title: product.seller,
      participantId: sellerId,
      participantName: product.seller,
      type: 'direct',
      status: 'Prix Village',
      lastMessage: message,
      lastMessageAt: now,
      unreadCount: 0,
      updatedAt: serverTimestamp()
    },
    [`userChats/${sellerId}/${threadId}`]: {
      threadId,
      title: customerName,
      avatarURL: customerAvatar,
      participantId: user.uid,
      participantName: customerName,
      participantAvatarURL: customerAvatar,
      type: 'direct',
      status: 'Prix Village',
      lastMessage: message,
      lastMessageAt: now,
      unreadCount: 1,
      updatedAt: serverTimestamp()
    },
    [`chatThreads/${threadId}`]: {
      id: threadId,
      title: product.seller,
      type: 'direct',
      productId: product.id,
      updatedAt: serverTimestamp()
    },
    [`chatThreads/${threadId}/members/${user.uid}`]: true,
    [`chatThreads/${threadId}/members/${sellerId}`]: true,
    [`chatThreads/${threadId}/memberNames/${user.uid}`]: customerName,
    [`chatThreads/${threadId}/memberNames/${sellerId}`]: product.seller
  };

  if (shareId) {
    updates[`villageDeals/${product.id}/shares/${shareId}`] = {
      id: shareId,
      userId: user.uid,
      userName: customerName,
      createdAt: now,
      threadId
    };
  }

  if (messageId) {
    updates[`chatMessages/${threadId}/${messageId}`] = {
      id: messageId,
      senderId: user.uid,
      text: message,
      type: 'village_share',
      productId: product.id,
      createdAt: now,
      status: 'sent'
    };
  }

  await update(ref(realtimeDb), updates);
  return { threadId };
}
