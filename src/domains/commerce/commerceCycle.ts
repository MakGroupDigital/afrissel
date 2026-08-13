import { User } from 'firebase/auth';
import { get, push, ref, runTransaction, serverTimestamp, update } from 'firebase/database';
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
  paymentMode?: 'afrispay' | 'delivery';
  checkoutKey?: string;
  deliveryAddress?: string;
  deliveryPhone?: string;
};

type VillageShareInput = {
  user: User;
  profile?: CommerceProfile | null;
  product: Product;
};

type ZandofyOrderStage = 'preparing' | 'delivering';

const formatMoney = (value: number, currency = 'USD') => {
  if (currency === 'USD') return `$${value.toLocaleString('fr-FR')}`;
  if (currency === 'CDF') return `${value.toLocaleString('fr-FR')} CDF`;
  return `${value.toLocaleString('fr-FR')} ${currency}`;
};

const buyerName = (user: User, profile?: CommerceProfile | null) => (
  profile?.displayName || user.displayName || 'Client AfriZia'
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

const getProductAmount = (product: Product) => {
  if (product.isFree || product.pricingMode === 'free') return 0;
  const villagePrice = Number(product.villagePrice);
  return Number.isFinite(villagePrice) && villagePrice >= 0 ? villagePrice : Number(product.price || 0);
};

const reserveProductStock = async (product: Product) => {
  if (product.productKind !== 'physical' || product.stockMode !== 'tracked') return null;
  const stockPath = product.storeId
    ? `zandofyProducts/${product.storeId}/${product.id}/stock`
    : `marketProducts/${product.id}/stock`;
  const result = await runTransaction(ref(realtimeDb, stockPath), (currentStock) => {
    if (currentStock === null || currentStock === undefined) return;
    const stock = Number(currentStock);
    if (!Number.isFinite(stock) || stock < 1) return;
    return stock - 1;
  });
  if (!result.committed) throw new Error('Ce produit est en rupture de stock.');
  return stockPath;
};

const releaseProductStock = async (stockPath: string | null) => {
  if (!stockPath) return;
  await runTransaction(ref(realtimeDb, stockPath), (currentStock) => Number(currentStock || 0) + 1);
};

export async function completeCommerceOrder({ user, profile, product, delivery, paymentMode = 'afrispay', checkoutKey, deliveryAddress = '', deliveryPhone = '' }: CompleteOrderInput) {
  const sellerId = ensureSeller(product, user.uid);
  const deliveryPrice = Number(delivery?.price || 0);
  const productAmount = getProductAmount(product);
  const totalAmount = productAmount + deliveryPrice;
  const currency = product.currency || 'USD';
  const fppRate = Math.min(Math.max(Number(product.fppRate || 0), 0), 20);
  const fppAmount = Math.round(productAmount * (fppRate / 100) * 100) / 100;
  const sellerNetAmount = Math.max(0, productAmount - fppAmount);

  if (!Number.isFinite(totalAmount) || totalAmount < 0) {
    throw new Error('Montant de commande invalide.');
  }

  if (product.productKind === 'physical' && delivery?.id !== 'pickup' && !deliveryAddress.trim()) {
    throw new Error('Ajoute l’adresse de livraison.');
  }

  if (checkoutKey) {
    const previous = await get(ref(realtimeDb, `commerceCheckouts/${user.uid}/${checkoutKey}`));
    const previousOrderId = previous.val()?.orderId;
    if (previousOrderId) {
      const previousOrder = await get(ref(realtimeDb, `orders/${previousOrderId}`));
      if (previousOrder.exists()) {
        const existing = previousOrder.val();
        return { orderId: previousOrderId, threadId: existing.chatThreadId || '', totalAmount: Number(existing.totalAmount || 0), currency: existing.currency || currency, villageStatus: existing.villageStatus || 'collecting', documentType: existing.documentType || 'receipt', paymentMode: existing.paymentMode || paymentMode };
      }
    }
  }

  let walletDebited = false;
  let stockPath: string | null = null;
  if (paymentMode === 'afrispay' && totalAmount > 0) {
    const walletBalanceRef = ref(realtimeDb, `wallets/${user.uid}/balance`);
    const debitResult = await runTransaction(walletBalanceRef, (currentBalance) => {
      const balance = Number(currentBalance || 0);
      if (!Number.isFinite(balance) || balance < totalAmount) return;
      return balance - totalAmount;
    });

    if (!debitResult.committed) {
      throw new Error('Solde AfriSpay insuffisant pour confirmer cette commande.');
    }
    walletDebited = true;
  }

  try {
    stockPath = await reserveProductStock(product);
  } catch (error) {
    if (walletDebited) await runTransaction(ref(realtimeDb, `wallets/${user.uid}/balance`), (balance) => Number(balance || 0) + totalAmount);
    throw error;
  }

  const orderRef = push(ref(realtimeDb, 'orders'));
  const orderId = orderRef.key;
  if (!orderId) throw new Error('Création de commande impossible.');

  const now = Date.now();
  const threadId = getDirectThreadId(user.uid, sellerId);
  const messageRef = push(ref(realtimeDb, `chatMessages/${threadId}`));
  const messageId = messageRef.key;
  const villageMembersNeeded = Math.max(Number(product.buyersNeeded || 1), 1);
  const nextBuyerCount = Number(product.buyersCount || 0) + 1;
  const villageStatus = nextBuyerCount >= villageMembersNeeded ? 'unlocked' : 'collecting';
  const isDigitalProduct = Boolean(product.isDigital || product.productKind === 'digital');
  const deliveryRecord = isDigitalProduct ? {
    id: 'digital',
    title: 'Livraison digitale',
    description: 'Accès sécurisé après confirmation du paiement.',
    price: 0,
    eta: 'Immédiat',
    status: 'delivered'
  } : delivery ? {
    id: delivery.id,
    title: delivery.title,
    description: delivery.description,
    price: deliveryPrice,
    eta: delivery.eta,
      status: delivery.id === 'pickup' ? 'pickup_requested' : 'pending_assignment'
  } : {
    id: 'standard',
    title: 'Livraison Safari',
    description: 'Livraison à coordonner avec le vendeur.',
    price: 0,
    eta: 'A confirmer',
    status: 'pending_assignment'
  };
  const customerName = buyerName(user, profile);
  const customerAvatar = buyerAvatar(user, profile);
  const isPaidNow = paymentMode === 'afrispay' || totalAmount === 0;
  const documentType = isPaidNow ? 'receipt' : 'invoice';
  const orderModule = product.module === 'Zandofy' || isDigitalProduct || product.storeId ? 'zandofy' : 'market';
  const orderMessage = `${isPaidNow ? 'Commande payée' : 'Facture créée'} ${orderId}: ${product.name} - ${formatMoney(totalAmount, currency)}. Livraison : ${deliveryRecord.title}.`;

  const updates: Record<string, unknown> = {
    [`orders/${orderId}`]: {
      id: orderId,
      productId: product.id,
      productName: product.name,
      productImage: product.imageUrl,
      productCategory: product.category || '',
      module: orderModule,
      storeId: product.storeId || '',
      storeSlug: product.storeSlug || '',
      storeName: product.storeName || '',
      isDigital: isDigitalProduct,
      sellerId,
      sellerName: product.seller,
      buyerId: user.uid,
      buyerName: customerName,
      buyerAvatar: customerAvatar,
      quantity: 1,
      productAmount,
      deliveryAmount: deliveryPrice,
      totalAmount,
      fppRate,
      fppAmount,
      sellerNetAmount,
      currency,
      status: isPaidNow ? 'paid' : 'awaiting_delivery_payment',
      paymentStatus: isPaidNow ? 'confirmed' : 'pay_on_delivery',
      paymentMode,
      documentType,
      checkoutKey: checkoutKey || '',
      deliveryAddress: deliveryAddress.trim(),
      deliveryPhone: deliveryPhone.trim(),
      digitalDeliveryStatus: isDigitalProduct ? (isPaidNow ? 'available' : 'locked_until_payment') : 'not_applicable',
      deliveryStatus: deliveryRecord.status,
      villageStatus,
      chatThreadId: threadId,
      createdAt: now,
      updatedAt: now
    },
    [`userOrders/${user.uid}/${orderId}`]: true,
    [`sellerOrders/${sellerId}/${orderId}`]: true,
    ...(orderModule === 'zandofy' && product.storeId ? { [`zandofyOrders/${product.storeId}/${orderId}`]: true } : {}),
    [`safariDeliveries/${orderId}`]: {
      orderId,
      productId: product.id,
      buyerId: user.uid,
      buyerName: customerName,
      sellerId,
      sellerName: product.seller,
      productName: product.name,
      delivery: deliveryRecord,
      deliveryAddress: deliveryAddress.trim(),
      deliveryPhone: deliveryPhone.trim(),
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
      status: 'Commande AfriZia',
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
      status: 'Commande AfriZia',
      lastMessage: orderMessage,
      lastMessageAt: now,
      unreadCount: 1,
      updatedAt: serverTimestamp()
    },
    [`chatThreads/${threadId}/id`]: threadId,
    [`chatThreads/${threadId}/title`]: product.seller,
    [`chatThreads/${threadId}/type`]: 'direct',
    [`chatThreads/${threadId}/orderId`]: orderId,
    [`chatThreads/${threadId}/updatedAt`]: serverTimestamp(),
    [`chatThreads/${threadId}/members/${user.uid}`]: true,
    [`chatThreads/${threadId}/members/${sellerId}`]: true,
    [`chatThreads/${threadId}/memberNames/${user.uid}`]: customerName,
    [`chatThreads/${threadId}/memberNames/${sellerId}`]: product.seller
  };

  if (isPaidNow) {
    updates[`wallets/${user.uid}/updatedAt`] = serverTimestamp();
    updates[`walletTransactions/${user.uid}/${orderId}`] = {
      id: orderId,
      type: 'debit',
      title: `Achat ${product.name}`,
      amount: -totalAmount,
      currency,
      module: orderModule,
      channel: 'AfriSpay',
      status: 'confirmed',
      orderId,
      createdAt: now
    };
    if (sellerNetAmount > 0) updates[`walletTransactions/${sellerId}/${orderId}`] = {
      id: orderId,
      type: 'credit',
      title: `Vente ${product.name}`,
      amount: sellerNetAmount,
      currency,
      module: orderModule,
      channel: 'AfriSpay Escrow',
      status: 'escrow_pending_delivery',
      orderId,
      createdAt: now
    };
    if (fppAmount > 0) updates[`fppContributions/${orderId}`] = {
      id: orderId,
      orderId,
      productId: product.id,
      storeId: product.storeId || '',
      sellerId,
      buyerId: user.uid,
      amount: fppAmount,
      rate: fppRate,
      currency,
      status: 'confirmed',
      createdAt: now
    };
  }

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

  try {
    await update(ref(realtimeDb), {
      ...updates,
      ...(checkoutKey ? { [`commerceCheckouts/${user.uid}/${checkoutKey}`]: { orderId, status: 'created', createdAt: now } } : {})
    });
  } catch (error) {
    if (walletDebited) await runTransaction(ref(realtimeDb, `wallets/${user.uid}/balance`), (balance) => Number(balance || 0) + totalAmount);
    await releaseProductStock(stockPath);
    throw error;
  }
  return { orderId, threadId, totalAmount, currency, villageStatus, documentType, paymentMode };
}

export async function confirmCommerceDelivery({ user, orderId }: { user: User; orderId: string }) {
  const snapshot = await get(ref(realtimeDb, `orders/${orderId}`));
  if (!snapshot.exists()) throw new Error('Commande introuvable.');
  const order = snapshot.val() as Record<string, unknown>;
  if (order.buyerId !== user.uid) throw new Error('Seul le client peut confirmer la réception.');
  if (order.deliveryStatus === 'delivered') return order;
  if (order.status !== 'paid' || order.paymentStatus !== 'confirmed') {
    throw new Error('Le paiement doit être confirmé avant de clôturer la livraison.');
  }

  const sellerId = String(order.sellerId || '');
  const amount = Number(order.sellerNetAmount ?? order.productAmount ?? 0);
  const escrowSnapshot = sellerId ? await get(ref(realtimeDb, `walletTransactions/${sellerId}/${orderId}`)) : null;
  const escrow = escrowSnapshot?.val() as Record<string, unknown> | null;
  const threadId = String(order.chatThreadId || '');
  const updates: Record<string, unknown> = {
    [`orders/${orderId}/status`]: 'completed',
    [`orders/${orderId}/deliveryStatus`]: 'delivered',
    [`orders/${orderId}/updatedAt`]: serverTimestamp(),
    [`safariDeliveries/${orderId}/status`]: 'delivered',
    [`safariDeliveries/${orderId}/updatedAt`]: serverTimestamp()
  };

  if (threadId) {
    const messageRef = push(ref(realtimeDb, `chatMessages/${threadId}`));
    if (messageRef.key) updates[`chatMessages/${threadId}/${messageRef.key}`] = {
      id: messageRef.key,
      senderId: user.uid,
      text: 'Réception confirmée. La commande est terminée.',
      type: 'delivery',
      orderId,
      createdAt: Date.now(),
      status: 'sent'
    };
  }

  let shouldReleaseEscrow = false;
  if (sellerId && amount > 0 && !escrow?.balanceApplied) {
    const claim = await runTransaction(ref(realtimeDb, `walletTransactions/${sellerId}/${orderId}/releaseClaimed`), (claimed) => claimed ? undefined : true);
    shouldReleaseEscrow = claim.committed;
  }

  if (shouldReleaseEscrow) {
    await runTransaction(ref(realtimeDb, `wallets/${sellerId}/balance`), (balance) => Number(balance || 0) + amount);
    updates[`walletTransactions/${sellerId}/${orderId}/status`] = 'confirmed';
    updates[`walletTransactions/${sellerId}/${orderId}/balanceApplied`] = true;
    updates[`walletTransactions/${sellerId}/${orderId}/releasedAt`] = serverTimestamp();
  }

  await update(ref(realtimeDb), updates);
  return { ...order, status: 'completed', deliveryStatus: 'delivered' };
}

export async function updateZandofyOrderStatus({ user, orderId, status }: { user: User; orderId: string; status: ZandofyOrderStage }) {
  const snapshot = await get(ref(realtimeDb, `orders/${orderId}`));
  if (!snapshot.exists()) throw new Error('Commande introuvable.');
  const order = snapshot.val() as Record<string, unknown>;
  if (order.sellerId !== user.uid) throw new Error('Seul le vendeur de la boutique peut avancer cette commande.');
  if (order.module !== 'zandofy' || !order.storeId) throw new Error('Cette commande ne concerne pas une boutique Zandofy.');
  if (order.status === 'completed' || order.status === 'cancelled') throw new Error('Cette commande est déjà clôturée.');
  if (order.isDigital) throw new Error('Les produits digitaux sont livrés automatiquement après paiement.');
  if (status === 'preparing' && order.status !== 'paid') throw new Error('La commande doit être payée avant sa préparation.');
  if (status === 'delivering' && !['paid', 'preparing'].includes(String(order.status))) throw new Error('Prépare d’abord la commande avant de la remettre à Safari.');

  const nextDeliveryStatus = status === 'delivering' ? 'in_transit' : String(order.deliveryStatus || 'pending_assignment');
  const updates: Record<string, unknown> = {
    [`orders/${orderId}/status`]: status,
    [`orders/${orderId}/deliveryStatus`]: nextDeliveryStatus,
    [`orders/${orderId}/updatedAt`]: serverTimestamp(),
    [`safariDeliveries/${orderId}/status`]: nextDeliveryStatus,
    [`safariDeliveries/${orderId}/updatedAt`]: serverTimestamp()
  };

  const threadId = String(order.chatThreadId || '');
  if (threadId) {
    const messageRef = push(ref(realtimeDb, `chatMessages/${threadId}`));
    if (messageRef.key) {
      const message = status === 'preparing'
        ? 'La boutique prépare ta commande Zandofy.'
        : 'La commande Zandofy est remise à Safari et passe en livraison.';
      updates[`chatMessages/${threadId}/${messageRef.key}`] = {
        id: messageRef.key,
        senderId: user.uid,
        text: message,
        type: 'delivery',
        orderId,
        createdAt: Date.now(),
        status: 'sent'
      };
      updates[`chatThreads/${threadId}/lastMessage`] = message;
      updates[`chatThreads/${threadId}/lastMessageSenderId`] = user.uid;
      updates[`chatThreads/${threadId}/lastMessageAt`] = serverTimestamp();
    }
  }

  await update(ref(realtimeDb), updates);
  return { ...order, status, deliveryStatus: nextDeliveryStatus };
}

export async function linkProductToABC({ user, product }: { user: User; product: Product }) {
  if (!product.sellerId || product.sellerId !== user.uid) {
    throw new Error('Seul le vendeur peut présenter ce produit dans ABC.');
  }
  if (!product.imageUrl) throw new Error('Ajoute une couverture avant de publier dans ABC.');

  const postRef = push(ref(realtimeDb, 'abcPosts'));
  const postId = postRef.key;
  if (!postId) throw new Error('Publication ABC impossible.');
  const now = Date.now();
  const productURL = `${window.location.origin}/${product.storeId ? 'zandofy/product' : 'market'}/${product.id}`;
  const payload = {
    id: postId,
    authorId: user.uid,
    authorName: product.seller,
    authorAvatar: '',
    title: product.name,
    description: product.description,
    category: product.category || 'Zandofy',
    format: 'article',
    media: [{
      id: `${postId}_cover`,
      provider: 'cloudinary',
      mediaUrl: product.imageUrl,
      secureUrl: product.imageUrl,
      publicId: '',
      resourceType: 'image'
    }],
    coverURL: product.imageUrl,
    isSellable: true,
    linkedProductId: product.id,
    linkedProductTitle: product.name,
    linkedProductImage: product.imageUrl,
    linkedProductPrice: product.price,
    linkedProductVillagePrice: product.villagePrice,
    linkedProductCurrency: product.currency || 'USD',
    price: product.price,
    villagePrice: product.villagePrice,
    currency: product.currency || 'USD',
    buyersCount: product.buyersCount || 0,
    buyersNeeded: product.buyersNeeded || 1,
    likesCount: 0,
    commentsCount: 0,
    sharesCount: 0,
    followsCount: 0,
    target: 'abc',
    offerModule: product.storeId ? 'Zandofy' : product.module || 'Market',
    productKind: product.productKind || (product.isDigital ? 'digital' : 'physical'),
    isDigital: Boolean(product.isDigital),
    storeId: product.storeId || '',
    storeSlug: product.storeSlug || '',
    storeName: product.storeName || '',
    fppRate: product.fppRate || 0,
    productURL,
    createdAt: now,
    updatedAt: now,
    status: 'active'
  };

  await update(ref(realtimeDb), {
    [`abcPosts/${postId}`]: payload,
    [`userPosts/${user.uid}/${postId}`]: { id: postId, createdAt: now, type: 'abc-product', linkedProductId: product.id },
    ...(product.storeId ? { [`zandofyProducts/${product.storeId}/${product.id}/abcPostId`]: postId } : {}),
    [`marketProducts/${product.id}/abcPostId`]: postId
  });
  return { postId };
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
  const message = `Prix Village partage: ${product.name} à ${price}. Objectif ${product.buyersCount || 0}/${product.buyersNeeded || 1} acheteurs.`;

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
    [`chatThreads/${threadId}/id`]: threadId,
    [`chatThreads/${threadId}/title`]: product.seller,
    [`chatThreads/${threadId}/type`]: 'direct',
    [`chatThreads/${threadId}/productId`]: product.id,
    [`chatThreads/${threadId}/updatedAt`]: serverTimestamp(),
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
