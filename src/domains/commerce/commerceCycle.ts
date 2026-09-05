import { User } from 'firebase/auth';
import { get, push, ref, runTransaction, serverTimestamp, update } from 'firebase/database';
import { realtimeDb } from '../../lib/firebase';
import { Product, CheckoutDelivery } from '../../store/useAppStore';
import { getWonyaPayStatus, initiateWonyaPayPayment, WonyaPayPaymentResponse } from '../../lib/wonyapay';

type CommerceProfile = {
  displayName?: string;
  photoURL?: string;
  businessName?: string;
  logoURL?: string;
  phone?: string;
};

export type CommercePaymentMode = 'afrispay' | 'mobile_money' | 'delivery';

type CompleteOrderInput = {
  user: User;
  profile?: CommerceProfile | null;
  product: Product;
  delivery?: CheckoutDelivery | null;
  paymentMode?: CommercePaymentMode;
  checkoutKey?: string;
  deliveryAddress?: string;
  deliveryPhone?: string;
  mobileMoneyPhone?: string;
};

type MobileMoneyPaymentMeta = {
  refTransa: string;
  status: string;
  completed: boolean;
  failed: boolean;
  checkedAt: number;
};

type VillageShareInput = {
  user: User;
  profile?: CommerceProfile | null;
  product: Product;
};

type ZandofyOrderStage = 'preparing' | 'delivering';
export type ZikMartSupplierStage = 'pending_supplier' | 'confirmed' | 'dispatched' | 'unavailable';

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

const getOrderProcessingMode = async (product: Product): Promise<'automatic' | 'manual'> => {
  if (product.orderProcessingMode) return product.orderProcessingMode;
  if (!product.storeId) return 'manual';
  const snapshot = await get(ref(realtimeDb, `zandofyStores/${product.storeId}/orderProcessingMode`));
  return snapshot.val() === 'automatic' ? 'automatic' : 'manual';
};

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

export async function completeCommerceOrder({ user, profile, product, delivery, paymentMode = 'afrispay', checkoutKey, deliveryAddress = '', deliveryPhone = '', mobileMoneyPhone = '' }: CompleteOrderInput) {
  const sellerId = ensureSeller(product, user.uid);
  const orderProcessingMode = await getOrderProcessingMode(product);
  const deliveryPrice = Number(delivery?.price || 0);
  const productAmount = getProductAmount(product);
  const totalAmount = productAmount + deliveryPrice;
  const currency = product.currency || 'USD';
  const fppRate = Math.min(Math.max(Number(product.fppRate || 0), 0), 20);
  const fppAmount = Math.round(productAmount * (fppRate / 100) * 100) / 100;
  const affiliateId = product.affiliateEnabled && product.affiliateRef && product.affiliateRef !== user.uid && product.affiliateRef !== sellerId
    ? product.affiliateRef
    : '';
  const affiliateLevel = affiliateId && product.affiliateLevel === 'indirect' ? 'indirect' : 'direct';
  const configuredAffiliateRate = affiliateLevel === 'indirect' ? product.affiliateIndirectRate : product.affiliateDirectRate;
  const affiliateRate = affiliateId ? Math.min(Math.max(Number(configuredAffiliateRate || 0), 0), 50) : 0;
  const affiliateAmount = Math.round(productAmount * (affiliateRate / 100) * 100) / 100;
  const sellerNetAmount = Math.max(0, productAmount - fppAmount - affiliateAmount);

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
        if (existing.paymentStatus !== 'failed') {
          return { orderId: previousOrderId, threadId: existing.chatThreadId || '', totalAmount: Number(existing.totalAmount || 0), currency: existing.currency || currency, villageStatus: existing.villageStatus || 'collecting', documentType: existing.documentType || 'receipt', paymentMode: existing.paymentMode || paymentMode, paymentStatus: existing.paymentStatus || 'confirmed' };
        }
      }
    }
  }

  const orderRef = push(ref(realtimeDb, 'orders'));
  const orderId = orderRef.key;
  if (!orderId) throw new Error('Création de commande impossible.');

  let walletDebited = false;
  let stockPath: string | null = null;
  let mobileMoneyPayment: WonyaPayPaymentResponse | null = null;
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

    if (paymentMode === 'mobile_money' && totalAmount > 0) {
      const phoneNumber = mobileMoneyPhone.trim();
      if (!phoneNumber) throw new Error('Entre le numéro Mobile Money à débiter.');

      mobileMoneyPayment = await initiateWonyaPayPayment({
        action: 'C2B',
        amount: totalAmount,
        currency,
        phoneNumber,
        motif: `Commande AfriZia ${orderId.slice(-8).toUpperCase()}`,
        refPrefix: 'AFC'
      });

      if (mobileMoneyPayment.failed) {
        throw new Error('Le paiement Mobile Money a été refusé.');
      }
    }
  } catch (error) {
    if (walletDebited) await runTransaction(ref(realtimeDb, `wallets/${user.uid}/balance`), (balance) => Number(balance || 0) + totalAmount);
    await releaseProductStock(stockPath);
    throw error;
  }

  const now = Date.now();
  const threadId = getDirectThreadId(user.uid, sellerId);
  const messageRef = push(ref(realtimeDb, `chatMessages/${threadId}`));
  const messageId = messageRef.key;
  const villageMembersNeeded = Math.max(Number(product.buyersNeeded || 1), 1);
  const nextBuyerCount = Number(product.buyersCount || 0) + 1;
  const villageStatus = nextBuyerCount >= villageMembersNeeded ? 'unlocked' : 'collecting';
  const isDigitalProduct = Boolean(product.isDigital || product.productKind === 'digital');
  const isMobileMoneyPending = paymentMode === 'mobile_money' && totalAmount > 0 && !mobileMoneyPayment?.completed;
  const isPaidNow = paymentMode === 'afrispay' || (paymentMode === 'mobile_money' && !isMobileMoneyPending) || totalAmount === 0;
  const deliveryRecord = isDigitalProduct ? {
    id: 'digital',
    title: 'Livraison digitale',
    description: 'Accès sécurisé après confirmation du paiement.',
    price: 0,
    eta: 'Immédiat',
    status: isPaidNow ? 'delivered' : 'waiting_payment'
  } : delivery ? {
    id: delivery.id,
    title: delivery.title,
    description: delivery.description,
    price: deliveryPrice,
    eta: delivery.eta,
      status: isMobileMoneyPending ? 'waiting_payment' : delivery.id === 'pickup' ? 'pickup_requested' : 'pending_assignment'
  } : {
    id: 'standard',
    title: 'Livraison Safari',
    description: 'Livraison à coordonner avec le vendeur.',
    price: 0,
    eta: 'A confirmer',
    status: isMobileMoneyPending ? 'waiting_payment' : 'pending_assignment'
  };
  const customerName = buyerName(user, profile);
  const customerAvatar = buyerAvatar(user, profile);
  const documentType = isPaidNow ? 'receipt' : 'invoice';
  const orderModule = product.module === 'Zandofy' || isDigitalProduct || product.storeId ? 'zandofy' : 'market';
  const isZikMartProduct = (product.publishToZikMart === true || product.sourceMarketplace === 'zikmart') && product.productKind === 'physical';
  const automaticPhysicalProcessing = isPaidNow && product.productKind === 'physical' && orderProcessingMode === 'automatic';
  const initialOrderStatus = isMobileMoneyPending ? 'awaiting_mobile_payment' : automaticPhysicalProcessing ? 'preparing' : isPaidNow ? 'paid' : 'awaiting_delivery_payment';
  const orderMessage = `${isPaidNow ? 'Commande payée' : isMobileMoneyPending ? 'Paiement Mobile Money en attente' : 'Facture créée'} ${orderId}: ${product.name} - ${formatMoney(totalAmount, currency)}. ${automaticPhysicalProcessing ? 'Traitement automatique lancé.' : `Livraison : ${deliveryRecord.title}.`}`;

  const updates: Record<string, unknown> = {
    [`orders/${orderId}`]: {
      id: orderId,
      productId: product.id,
      productName: product.name,
      productImage: product.imageUrl,
      productCategory: product.category || '',
      module: orderModule,
      marketplace: isZikMartProduct ? 'zikmart' : orderModule === 'zandofy' ? 'zandofy' : 'afrizia',
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
      villagePrice: product.villagePrice,
      buyersNeeded: villageMembersNeeded,
      fppRate,
      fppAmount,
      sellerNetAmount,
      affiliateId,
      affiliateLevel: affiliateId ? affiliateLevel : '',
      affiliateRate,
      affiliateAmount,
      supplierType: product.supplierType || 'self',
      supplierId: product.supplierId || '',
      supplierName: product.supplierName || '',
      supplierSKU: product.supplierSKU || '',
      supplierCost: Number(product.supplierCost || 0),
      supplierLeadTimeDays: Number(product.supplierLeadTimeDays || 0),
      dropshippingEnabled: Boolean(product.dropshippingEnabled),
      supplierFulfillmentStatus: product.dropshippingEnabled ? 'pending_supplier' : 'not_applicable',
      currency,
      status: initialOrderStatus,
      paymentStatus: isMobileMoneyPending ? 'pending_operator' : isPaidNow ? 'confirmed' : 'pay_on_delivery',
      paymentMode,
      mobileMoney: mobileMoneyPayment ? {
        refTransa: mobileMoneyPayment.refTransa,
        status: mobileMoneyPayment.providerStatus,
        completed: mobileMoneyPayment.completed,
        failed: mobileMoneyPayment.failed,
        checkedAt: now
      } satisfies MobileMoneyPaymentMeta : null,
      orderProcessingMode,
      documentType,
      checkoutKey: checkoutKey || '',
      deliveryAddress: deliveryAddress.trim(),
      deliveryPhone: deliveryPhone.trim(),
      deliveryMethodId: delivery?.id || (isDigitalProduct ? 'digital' : 'standard'),
      stockReservationPath: stockPath || '',
      stockReserved: Boolean(stockPath),
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
      marketplace: isZikMartProduct ? 'zikmart' : orderModule,
      dropshippingEnabled: Boolean(product.dropshippingEnabled),
      supplierName: product.supplierName || '',
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
    [`chatThreads/${threadId}/memberNames/${sellerId}`]: product.seller,
    ...(isZikMartProduct && product.dropshippingEnabled && product.supplierId && product.supplierId !== sellerId
      ? {
          [`supplierOrderRequests/${product.supplierId}/${orderId}`]: {
            orderId,
            productId: product.sourceProductId || product.id,
            productName: product.name,
            resellerId: sellerId,
            resellerName: product.seller,
            supplierId: product.supplierId,
            supplierName: product.supplierName || product.sourceSellerName || '',
            quantity: 1,
            status: 'pending_supplier',
            createdAt: now
          }
        }
      : {})
  };

  if (isMobileMoneyPending) {
    // The order is visible to the buyer, but commercial side effects wait for operator confirmation.
    [
      `villageDeals/${product.id}/productId`,
      `villageDeals/${product.id}/productName`,
      `villageDeals/${product.id}/sellerId`,
      `villageDeals/${product.id}/villagePrice`,
      `villageDeals/${product.id}/currency`,
      `villageDeals/${product.id}/buyersNeeded`,
      `villageDeals/${product.id}/buyersCount`,
      `villageDeals/${product.id}/status`,
      `villageDeals/${product.id}/members/${user.uid}`,
      `abcPosts/${product.id}/buyersCount`,
      `marketProducts/${product.id}/buyersCount`,
      `userChats/${user.uid}/${threadId}`,
      `userChats/${sellerId}/${threadId}`,
      `chatThreads/${threadId}/id`,
      `chatThreads/${threadId}/title`,
      `chatThreads/${threadId}/type`,
      `chatThreads/${threadId}/orderId`,
      `chatThreads/${threadId}/updatedAt`,
      `chatThreads/${threadId}/members/${user.uid}`,
      `chatThreads/${threadId}/members/${sellerId}`,
      `chatThreads/${threadId}/memberNames/${user.uid}`,
      `chatThreads/${threadId}/memberNames/${sellerId}`
    ].forEach((path) => delete updates[path]);

    if (isZikMartProduct && product.dropshippingEnabled && product.supplierId && product.supplierId !== sellerId) {
      delete updates[`supplierOrderRequests/${product.supplierId}/${orderId}`];
    }
  }

  if (isPaidNow) {
    updates[`wallets/${user.uid}/updatedAt`] = serverTimestamp();
    updates[`walletTransactions/${user.uid}/${orderId}`] = {
      id: orderId,
      type: 'debit',
      title: `Achat ${product.name}`,
      amount: -totalAmount,
      currency,
      module: orderModule,
      channel: paymentMode === 'mobile_money' ? 'Mobile Money via AfriSpay' : 'AfriSpay',
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
    if (affiliateId && affiliateAmount > 0) {
      const affiliateTransactionId = `${orderId}_affiliate`;
      updates[`walletTransactions/${affiliateId}/${affiliateTransactionId}`] = {
        id: affiliateTransactionId,
        type: 'credit',
        title: `Commission recommandation ${product.name}`,
        amount: affiliateAmount,
        currency,
        module: orderModule,
        channel: 'Affiliation Zandofy',
        status: 'confirmed',
        orderId,
        productId: product.id,
        affiliateLevel,
        createdAt: now
      };
      updates[`affiliateEarnings/${affiliateId}/${orderId}`] = {
        id: orderId,
        productId: product.id,
        productName: product.name,
        sellerId,
        level: affiliateLevel,
        rate: affiliateRate,
        amount: affiliateAmount,
        currency,
        status: 'confirmed',
        createdAt: now
      };
    }
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

  if (messageId && !isMobileMoneyPending) {
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
  return { orderId, threadId, totalAmount, currency, villageStatus, documentType, paymentMode, paymentStatus: isMobileMoneyPending ? 'pending_operator' : isPaidNow ? 'confirmed' : 'pay_on_delivery' };
}

type PendingMobileMoneyOrder = {
  buyerId?: string;
  sellerId?: string;
  sellerName?: string;
  buyerName?: string;
  buyerAvatar?: string;
  productId?: string;
  productName?: string;
  productImage?: string;
  productCategory?: string;
  productAmount?: number;
  deliveryAmount?: number;
  totalAmount?: number;
  villagePrice?: number;
  buyersNeeded?: number;
  currency?: string;
  module?: string;
  marketplace?: string;
  storeId?: string;
  storeSlug?: string;
  storeName?: string;
  isDigital?: boolean;
  paymentMode?: CommercePaymentMode;
  paymentStatus?: string;
  status?: string;
  orderProcessingMode?: 'automatic' | 'manual';
  deliveryMethodId?: string;
  fppRate?: number;
  fppAmount?: number;
  sellerNetAmount?: number;
  affiliateId?: string;
  affiliateLevel?: string;
  affiliateRate?: number;
  affiliateAmount?: number;
  dropshippingEnabled?: boolean;
  supplierId?: string;
  supplierName?: string;
  supplierSKU?: string;
  sourceProductId?: string;
  stockReservationPath?: string;
  stockReserved?: boolean;
  mobileMoney?: MobileMoneyPaymentMeta;
};

const getCommerceThreadId = (order: PendingMobileMoneyOrder) => (
  getDirectThreadId(String(order.buyerId || ''), String(order.sellerId || ''))
);

export async function reconcileMobileMoneyCommerceOrder(uid: string, orderId: string) {
  const orderSnapshot = await get(ref(realtimeDb, `orders/${orderId}`));
  if (!orderSnapshot.exists()) return null;

  const order = orderSnapshot.val() as PendingMobileMoneyOrder;
  if (order.buyerId !== uid || order.paymentMode !== 'mobile_money' || !order.mobileMoney?.refTransa) return null;
  if (order.paymentStatus === 'confirmed' || order.paymentStatus === 'failed') return order.paymentStatus;

  const response = await getWonyaPayStatus(order.mobileMoney.refTransa);
  const mobileMoney: MobileMoneyPaymentMeta = {
    refTransa: response.refTransa,
    status: response.providerStatus,
    completed: response.completed,
    failed: response.failed,
    checkedAt: Date.now()
  };

  if (!response.completed && !response.failed) {
    await update(ref(realtimeDb), {
      [`orders/${orderId}/mobileMoney`]: mobileMoney,
      [`orders/${orderId}/updatedAt`]: serverTimestamp()
    });
    return 'pending_operator';
  }

  if (response.failed) {
    let releaseStock = false;
    if (order.stockReserved && order.stockReservationPath) {
      const claim = await runTransaction(ref(realtimeDb, `orders/${orderId}/stockReleaseClaimed`), (claimed) => claimed ? undefined : true);
      releaseStock = claim.committed;
    }
    if (releaseStock) await releaseProductStock(order.stockReservationPath || null);

    await update(ref(realtimeDb), {
      [`orders/${orderId}/status`]: 'payment_failed',
      [`orders/${orderId}/paymentStatus`]: 'failed',
      [`orders/${orderId}/mobileMoney`]: mobileMoney,
      [`orders/${orderId}/deliveryStatus`]: 'payment_failed',
      [`orders/${orderId}/updatedAt`]: serverTimestamp(),
      [`safariDeliveries/${orderId}/status`]: 'payment_failed',
      [`safariDeliveries/${orderId}/updatedAt`]: serverTimestamp()
    });
    return 'failed';
  }

  const sellerId = String(order.sellerId || '');
  const productId = String(order.productId || '');
  const productName = String(order.productName || 'Produit');
  const currency = String(order.currency || 'USD');
  const totalAmount = Number(order.totalAmount || 0);
  const sellerNetAmount = Number(order.sellerNetAmount ?? order.productAmount ?? 0);
  const fppAmount = Number(order.fppAmount || 0);
  const affiliateId = String(order.affiliateId || '');
  const affiliateAmount = Number(order.affiliateAmount || 0);
  const isDigital = Boolean(order.isDigital);
  const isAutomaticPhysical = !isDigital && order.orderProcessingMode === 'automatic';
  const nextStatus = isAutomaticPhysical ? 'preparing' : 'paid';
  const nextDeliveryStatus = isDigital ? 'delivered' : order.deliveryMethodId === 'pickup' ? 'pickup_requested' : 'pending_assignment';
  const threadId = getCommerceThreadId(order);
  const now = Date.now();
  const message = `Commande payée ${orderId}: ${productName} - ${formatMoney(totalAmount, currency)}. ${isAutomaticPhysical ? 'Traitement automatique lancé.' : `Livraison : ${isDigital ? 'Accès digital disponible.' : 'Safari à coordonner.'}`}`;
  const messageRef = push(ref(realtimeDb, `chatMessages/${threadId}`));

  const villageMember = {
    uid,
    name: order.buyerName || 'Client AfriZia',
    orderId,
    joinedAt: now
  };
  const membershipClaim = await runTransaction(ref(realtimeDb, `villageDeals/${productId}/members/${uid}`), (currentMember) => currentMember || villageMember);
  let buyersCount = Number((await get(ref(realtimeDb, `villageDeals/${productId}/buyersCount`))).val() || 0);
  if (membershipClaim.committed) {
    const buyersCountResult = await runTransaction(ref(realtimeDb, `villageDeals/${productId}/buyersCount`), (value) => Number(value || 0) + 1);
    buyersCount = Number(buyersCountResult.snapshot.val() || 1);
  }
  const buyersNeeded = Math.max(Number(order.buyersNeeded || 1), 1);
  const villageStatus = buyersCount >= buyersNeeded ? 'unlocked' : 'collecting';

  const updates: Record<string, unknown> = {
    [`orders/${orderId}/status`]: nextStatus,
    [`orders/${orderId}/paymentStatus`]: 'confirmed',
    [`orders/${orderId}/documentType`]: 'receipt',
    [`orders/${orderId}/mobileMoney`]: mobileMoney,
    [`orders/${orderId}/digitalDeliveryStatus`]: isDigital ? 'available' : 'not_applicable',
    [`orders/${orderId}/deliveryStatus`]: nextDeliveryStatus,
    [`orders/${orderId}/villageStatus`]: villageStatus,
    [`orders/${orderId}/paymentSettledAt`]: now,
    [`orders/${orderId}/updatedAt`]: serverTimestamp(),
    [`safariDeliveries/${orderId}/status`]: nextDeliveryStatus,
    [`safariDeliveries/${orderId}/updatedAt`]: serverTimestamp(),
    [`wallets/${uid}/updatedAt`]: serverTimestamp(),
    [`walletTransactions/${uid}/${orderId}`]: {
      id: orderId,
      type: 'debit',
      title: `Achat ${productName}`,
      amount: -totalAmount,
      currency,
      module: order.module || 'market',
      channel: 'Mobile Money via AfriSpay',
      status: 'confirmed',
      orderId,
      createdAt: now
    },
    [`villageDeals/${productId}/productId`]: productId,
    [`villageDeals/${productId}/productName`]: productName,
    [`villageDeals/${productId}/sellerId`]: sellerId,
    [`villageDeals/${productId}/villagePrice`]: Number(order.villagePrice ?? order.productAmount ?? 0),
    [`villageDeals/${productId}/buyersCount`]: buyersCount,
    [`villageDeals/${productId}/buyersNeeded`]: buyersNeeded,
    [`villageDeals/${productId}/status`]: villageStatus,
    [`villageDeals/${productId}/members/${uid}`]: villageMember,
    [`abcPosts/${productId}/buyersCount`]: buyersCount,
    [`marketProducts/${productId}/buyersCount`]: buyersCount,
    [`userChats/${uid}/${threadId}`]: {
      threadId,
      title: order.sellerName || 'Vendeur',
      avatarURL: '',
      participantId: sellerId,
      participantName: order.sellerName || 'Vendeur',
      type: 'direct',
      status: 'Commande AfriZia',
      lastMessage: message,
      lastMessageAt: now,
      unreadCount: 0,
      updatedAt: serverTimestamp()
    },
    [`userChats/${sellerId}/${threadId}`]: {
      threadId,
      title: order.buyerName || 'Client AfriZia',
      avatarURL: order.buyerAvatar || '',
      participantId: uid,
      participantName: order.buyerName || 'Client AfriZia',
      participantAvatarURL: order.buyerAvatar || '',
      type: 'direct',
      status: 'Commande AfriZia',
      lastMessage: message,
      lastMessageAt: now,
      unreadCount: 1,
      updatedAt: serverTimestamp()
    },
    [`chatThreads/${threadId}/id`]: threadId,
    [`chatThreads/${threadId}/title`]: order.sellerName || 'Vendeur',
    [`chatThreads/${threadId}/type`]: 'direct',
    [`chatThreads/${threadId}/orderId`]: orderId,
    [`chatThreads/${threadId}/updatedAt`]: serverTimestamp(),
    [`chatThreads/${threadId}/members/${uid}`]: true,
    [`chatThreads/${threadId}/members/${sellerId}`]: true,
    [`chatThreads/${threadId}/memberNames/${uid}`]: order.buyerName || 'Client AfriZia',
    [`chatThreads/${threadId}/memberNames/${sellerId}`]: order.sellerName || 'Vendeur'
  };

  if (sellerId && sellerNetAmount > 0) {
    updates[`walletTransactions/${sellerId}/${orderId}`] = {
      id: orderId,
      type: 'credit',
      title: `Vente ${productName}`,
      amount: sellerNetAmount,
      currency,
      module: order.module || 'market',
      channel: 'AfriSpay Escrow',
      status: 'escrow_pending_delivery',
      orderId,
      createdAt: now
    };
  }

  if (affiliateId && affiliateAmount > 0) {
    const affiliateTransactionId = `${orderId}_affiliate`;
    updates[`walletTransactions/${affiliateId}/${affiliateTransactionId}`] = {
      id: affiliateTransactionId,
      type: 'credit',
      title: `Commission recommandation ${productName}`,
      amount: affiliateAmount,
      currency,
      module: order.module || 'market',
      channel: 'Affiliation Zandofy',
      status: 'confirmed',
      orderId,
      productId,
      affiliateLevel: order.affiliateLevel || 'direct',
      createdAt: now
    };
    updates[`affiliateEarnings/${affiliateId}/${orderId}`] = {
      id: orderId,
      productId,
      productName,
      sellerId,
      level: order.affiliateLevel || 'direct',
      rate: Number(order.affiliateRate || 0),
      amount: affiliateAmount,
      currency,
      status: 'confirmed',
      createdAt: now
    };
  }

  if (fppAmount > 0) {
    updates[`fppContributions/${orderId}`] = {
      id: orderId,
      orderId,
      productId,
      storeId: order.storeId || '',
      sellerId,
      buyerId: uid,
      amount: fppAmount,
      rate: Number(order.fppRate || 0),
      currency,
      status: 'confirmed',
      createdAt: now
    };
  }

  if (order.marketplace === 'zikmart' && order.dropshippingEnabled && order.supplierId && order.supplierId !== sellerId) {
    updates[`supplierOrderRequests/${order.supplierId}/${orderId}`] = {
      orderId,
      productId: order.sourceProductId || productId,
      productName,
      resellerId: sellerId,
      resellerName: order.sellerName || '',
      supplierId: order.supplierId,
      supplierName: order.supplierName || '',
      quantity: 1,
      status: 'pending_supplier',
      createdAt: now
    };
  }

  if (messageRef.key) {
    updates[`chatMessages/${threadId}/${messageRef.key}`] = {
      id: messageRef.key,
      senderId: uid,
      text: message,
      type: 'order',
      orderId,
      productId,
      createdAt: now,
      status: 'sent'
    };
  }

  await update(ref(realtimeDb), updates);
  return 'confirmed';
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

export async function updateZikMartSupplierStatus({ user, orderId, status }: { user: User; orderId: string; status: ZikMartSupplierStage }) {
  const snapshot = await get(ref(realtimeDb, `orders/${orderId}`));
  if (!snapshot.exists()) throw new Error('Commande introuvable.');
  const order = snapshot.val() as Record<string, unknown>;
  if (order.sellerId !== user.uid && order.supplierId !== user.uid) throw new Error('Seul le vendeur ou le fournisseur peut suivre cet approvisionnement.');
  if (order.marketplace !== 'zikmart' || !order.dropshippingEnabled) throw new Error('Cette commande ne contient pas de traitement dropshipping.');
  if (order.status === 'completed' || order.status === 'cancelled') throw new Error('Cette commande est déjà clôturée.');
  if (status === 'confirmed' && !['paid', 'preparing'].includes(String(order.status))) throw new Error('Le paiement doit être confirmé avant de valider le fournisseur.');
  if (status === 'dispatched' && order.supplierFulfillmentStatus !== 'confirmed') throw new Error('Confirme d’abord la prise en charge par le fournisseur.');

  const updates: Record<string, unknown> = {
    [`orders/${orderId}/supplierFulfillmentStatus`]: status,
    [`orders/${orderId}/updatedAt`]: serverTimestamp(),
    [`safariDeliveries/${orderId}/supplierFulfillmentStatus`]: status,
    [`safariDeliveries/${orderId}/updatedAt`]: serverTimestamp()
  };
  const threadId = String(order.chatThreadId || '');
  if (threadId) {
    const messageRef = push(ref(realtimeDb, `chatMessages/${threadId}`));
    if (messageRef.key) {
      const message = status === 'confirmed'
        ? 'Le fournisseur ZikMart a confirmé la prise en charge de ta commande.'
        : status === 'dispatched'
          ? 'Le fournisseur ZikMart a expédié la commande. Safari va suivre la livraison.'
          : status === 'unavailable'
            ? 'Le fournisseur ZikMart a signalé une indisponibilité. Le vendeur va te contacter.'
            : 'La demande est transmise au fournisseur ZikMart.';
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
  return { ...order, supplierFulfillmentStatus: status };
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
