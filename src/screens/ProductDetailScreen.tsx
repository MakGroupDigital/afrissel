import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { get, onValue, push, ref, serverTimestamp, set, update } from 'firebase/database';
import { AfriSellIcon } from '../components/AfriSellIcon';
import { AfriMarketContent, formatMarketPrice, toCheckoutProduct, useAfriMarket } from '../hooks/useAfriMarket';
import { CheckoutDelivery, useAppStore } from '../store/useAppStore';
import { useFirebaseAuth } from '../hooks/useFirebaseAuth';
import { shareVillageDealToAfriChat } from '../domains/commerce';
import { realtimeDb } from '../lib/firebase';
import { cn } from '../lib/utils';

const deliveryOptions: CheckoutDelivery[] = [
  {
    id: 'intercity_free',
    title: 'Interville gratuit',
    description: 'Livraison gratuite entre villes partenaires.',
    price: 0,
    eta: '2-5 jours'
  },
  {
    id: 'local_express',
    title: 'Express local',
    description: 'Livraison rapide dans la même ville.',
    price: 5,
    eta: '24h'
  },
  {
    id: 'pickup',
    title: 'Retrait vendeur',
    description: 'Recupere directement chez le vendeur.',
    price: 0,
    eta: 'Aujourd’hui'
  }
];

type ProductReview = {
  id: string;
  authorId: string;
  authorName: string;
  rating: number;
  text: string;
  createdAt: number;
};

type RawUserProfile = {
  displayName?: string;
  businessName?: string;
  email?: string;
  phone?: string;
  photoURL?: string;
  logoURL?: string;
};

type PurchaseVillage = {
  threadId: string;
  title: string;
  inviteLink: string;
  qrUrl: string;
  visibility: 'public' | 'private';
};

const normalizeContactValue = (value: string) => value.trim().toLowerCase().replace(/\s+/g, '');

function ProductGallery({ product }: { product: AfriMarketContent }) {
  const media = product.media.length ? product.media : [{
    id: 'cover',
    secureUrl: product.coverURL,
    mediaUrl: product.coverURL,
    resourceType: 'image' as const,
    provider: 'cloudinary' as const,
    publicId: ''
  }];
  const [activeIndex, setActiveIndex] = useState(0);
  const activeMedia = media[activeIndex] || media[0];

  return (
    <section>
      <div className="relative aspect-[4/5] overflow-hidden rounded-[1.8rem] border border-white/10 bg-[#050505]">
        <img
          src={activeMedia.secureUrl || activeMedia.mediaUrl}
          alt={product.title}
          className="h-full w-full object-cover"
        />
        <div className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#15EA3E]">
          {activeIndex + 1}/{media.length}
        </div>
      </div>

      {media.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-hide">
          {media.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={cn(
                'h-16 w-16 shrink-0 overflow-hidden rounded-2xl border bg-[#050505]',
                index === activeIndex ? 'border-[#15EA3E]' : 'border-white/10'
              )}
            >
              <img src={item.secureUrl || item.mediaUrl} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function EmptyDetail() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-black px-8 text-center text-white">
      <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-gray-800 bg-[#050505] text-[#15EA3E]">
        <AfriSellIcon name="market" size={28} />
      </div>
      <h1 className="mt-5 text-lg font-black">Produit introuvable</h1>
      <p className="mt-2 text-sm leading-relaxed text-gray-500">Cet article n'est plus disponible dans le Market.</p>
      <Link to="/market" className="mt-5 rounded-2xl bg-[#15EA3E] px-5 py-3 text-xs font-black uppercase tracking-widest text-black">
        Retour Market
      </Link>
    </div>
  );
}

export default function ProductDetailScreen() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { abcContents, marketProducts, loading } = useAfriMarket();
  const { user, profile } = useFirebaseAuth();
  const openCheckout = useAppStore((state) => state.openCheckout);
  const addToCart = useAppStore((state) => state.addToCart);
  const cart = useAppStore((state) => state.cart);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState(deliveryOptions[0].id);
  const [status, setStatus] = useState('');
  const [villageSharing, setVillageSharing] = useState(false);
  const [villageCreating, setVillageCreating] = useState(false);
  const [villageVisibility, setVillageVisibility] = useState<'public' | 'private'>('private');
  const [purchaseVillage, setPurchaseVillage] = useState<PurchaseVillage | null>(null);
  const [inviteValue, setInviteValue] = useState('');
  const [inviteSending, setInviteSending] = useState(false);
  const [villageStatus, setVillageStatus] = useState('');
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const product = useMemo(
    () => (
      marketProducts.find((item) => item.id === productId) ||
      abcContents.find((item) => item.id === productId && item.isSellable)
    ),
    [abcContents, marketProducts, productId]
  );
  const checkoutProduct = product ? toCheckoutProduct(product) : null;
  const selectedDelivery = deliveryOptions.find((option) => option.id === selectedDeliveryId) || deliveryOptions[0];
  const alreadyInCart = Boolean(checkoutProduct && cart.some((item) => item.id === checkoutProduct.id));
  const reviewAverage = reviews.length
    ? reviews.reduce((total, review) => total + review.rating, 0) / reviews.length
    : 0;
  const afriCoinValue = Math.max(1, Math.round(Number(product?.villagePrice || product?.price || 0) * 2));
  const fppValue = Math.round(Number(product?.villagePrice || product?.price || 0) * 0.03 * 100) / 100;
  const preferenceProducts = useMemo(() => {
    if (!product) return [];
    const activeWords = [
      product.category,
      ...product.title.toLowerCase().split(/\s+/).filter((word) => word.length > 3)
    ];

    return marketProducts
      .filter((item) => item.id !== product.id)
      .map((item) => {
        const text = `${item.title} ${item.description} ${item.category}`.toLowerCase();
        const score = activeWords.reduce((total, word) => total + (word && text.includes(word.toLowerCase()) ? 2 : 0), 0)
          + (item.authorId === product.authorId ? 4 : 0)
          + (item.buyersCount || 0)
          + (item.likesCount || 0);
        return { item, score };
      })
      .filter(({ score }) => score > 0)
      .sort((first, second) => second.score - first.score)
      .map(({ item }) => item)
      .slice(0, 8);
  }, [marketProducts, product]);
  const relatedProducts = useMemo(() => {
    if (!product) return [];
    const merged = [...preferenceProducts, ...marketProducts
      .filter((item) => item.id !== product.id && (item.category === product.category || item.authorId === product.authorId))
      .sort((first, second) => ((second.buyersCount || 0) + (second.likesCount || 0)) - ((first.buyersCount || 0) + (first.likesCount || 0)))
    ];

    return Array.from(new Map(merged.map((item) => [item.id, item])).values()).slice(0, 8);
  }, [marketProducts, preferenceProducts, product]);
  const productBadges = useMemo(() => {
    if (!product) return [];
    return [
      { label: 'Format', value: product.format === 'video' ? 'Vidéo commerce' : product.format === 'gallery' ? 'Galerie' : 'Article', icon: 'video' as const },
      { label: 'Origine', value: product.category === 'Agriculture' || product.category === 'Agro' ? 'Producteur' : product.category === 'Services' ? 'Prestataire' : 'Vendeur', icon: 'work' as const },
      { label: 'Livraison', value: selectedDelivery.price === 0 ? 'Gratuite' : 'Safari prête', icon: 'send' as const },
      { label: 'Achat groupé', value: product.villagePrice ? 'Prix Village' : 'Prix direct', icon: 'hub' as const }
    ];
  }, [product, selectedDelivery.price]);

  useEffect(() => {
    if (!productId) return undefined;

    const reviewsRef = ref(realtimeDb, `productReviews/${productId}`);
    const unsubscribe = onValue(reviewsRef, (snapshot) => {
      const data = snapshot.val() as Record<string, ProductReview> | null;
      const nextReviews = Object.entries(data || {})
        .map(([id, review]) => ({ ...review, id }))
        .sort((first, second) => Number(second.createdAt || 0) - Number(first.createdAt || 0));
      setReviews(nextReviews);
    });

    return unsubscribe;
  }, [productId]);

  if (loading) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center bg-black px-8 text-center text-white">
        <AfriSellIcon name="market" size={36} className="text-[#15EA3E]" />
        <p className="mt-4 text-sm font-black uppercase tracking-wide">Chargement du produit</p>
      </div>
    );
  }

  if (!product || !checkoutProduct) {
    return <EmptyDetail />;
  }

  const handleAddToCart = () => {
    addToCart(checkoutProduct);
    setStatus(alreadyInCart ? 'Article déjà dans le panier.' : 'Article ajoute au panier.');
  };

  const handleBuy = () => {
    if (!user) {
      navigate('/login', { state: { next: `/market/${product.id}` } });
      return;
    }
    openCheckout(checkoutProduct, selectedDelivery);
  };

  const handleVillageShare = async () => {
    if (!user) {
      navigate('/login', { state: { next: `/market/${product.id}` } });
      return;
    }

    setVillageSharing(true);
    setStatus('');
    try {
      const result = await shareVillageDealToAfriChat({
        user,
        profile,
        product: checkoutProduct
      });
      setStatus('Prix Village partage dans AfriChat. Le vendeur peut suivre le groupé.');
      void result;
      navigate(`/chat?contact=${encodeURIComponent(product.authorId)}&name=${encodeURIComponent(product.authorName)}&status=${encodeURIComponent('Prix Village')}&avatar=${encodeURIComponent(product.authorAvatar || '')}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Partage Prix Village impossible.');
    } finally {
      setVillageSharing(false);
    }
  };

  const createPurchaseVillage = async (payAfterCreation = false) => {
    if (!user) {
      navigate('/login', { state: { next: `/market/${product.id}` } });
      return;
    }

    setVillageCreating(true);
    setVillageStatus('');
    try {
      const threadRef = push(ref(realtimeDb, 'chatThreads'));
      const threadId = threadRef.key;
      if (!threadId) throw new Error('Création du Village impossible.');

      const now = Date.now();
      const buyerName = profile?.displayName || user.displayName || 'Client AfriSell';
      const buyerAvatar = profile?.photoURL || user.photoURL || '';
      const title = `Village ${product.title}`;
      const inviteLink = `${window.location.origin}/chat?village=${encodeURIComponent(threadId)}&product=${encodeURIComponent(product.id)}`;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(inviteLink)}`;
      const message = `Village d’achat créé pour ${product.title}. Objectif ${product.buyersCount || 0}/${product.buyersNeeded || 1} acheteurs au Prix Village.`;

      const updates: Record<string, unknown> = {
        [`chatThreads/${threadId}/id`]: threadId,
        [`chatThreads/${threadId}/title`]: title,
        [`chatThreads/${threadId}/type`]: 'village',
        [`chatThreads/${threadId}/status`]: villageVisibility === 'public' ? 'Village d’achat public' : 'Village d’achat privé',
        [`chatThreads/${threadId}/productId`]: product.id,
        [`chatThreads/${threadId}/productName`]: product.title,
        [`chatThreads/${threadId}/productImage`]: product.coverURL || '',
        [`chatThreads/${threadId}/villagePrice`]: product.villagePrice || product.price || 0,
        [`chatThreads/${threadId}/currency`]: product.currency || 'USD',
        [`chatThreads/${threadId}/visibility`]: villageVisibility,
        [`chatThreads/${threadId}/inviteLink`]: inviteLink,
        [`chatThreads/${threadId}/lastMessage`]: message,
        [`chatThreads/${threadId}/lastMessageAt`]: now,
        [`chatThreads/${threadId}/updatedAt`]: serverTimestamp(),
        [`chatThreads/${threadId}/members/${user.uid}`]: true,
        [`chatThreads/${threadId}/memberNames/${user.uid}`]: buyerName,
        [`userChats/${user.uid}/${threadId}`]: {
          threadId,
          title,
          avatarURL: product.coverURL || '',
          type: 'village',
          status: 'Village d’achat',
          productId: product.id,
          productName: product.title,
          productImage: product.coverURL || '',
          villagePrice: product.villagePrice || product.price || 0,
          currency: product.currency || 'USD',
          inviteLink,
          visibility: villageVisibility,
          lastMessage: message,
          lastMessageAt: now,
          unreadCount: 0,
          updatedAt: serverTimestamp()
        },
        [`chatMessages/${threadId}/welcome`]: {
          id: 'welcome',
          senderId: user.uid,
          text: message,
          type: 'village_share',
          productId: product.id,
          createdAt: now,
          status: 'sent'
        },
        [`villageDeals/${product.id}/productId`]: product.id,
        [`villageDeals/${product.id}/productName`]: product.title,
        [`villageDeals/${product.id}/sellerId`]: product.authorId,
        [`villageDeals/${product.id}/villagePrice`]: product.villagePrice || product.price || 0,
        [`villageDeals/${product.id}/currency`]: product.currency || 'USD',
        [`villageDeals/${product.id}/buyersNeeded`]: Math.max(Number(product.buyersNeeded || 1), 1),
        [`villageDeals/${product.id}/status`]: 'collecting',
        [`villageDeals/${product.id}/villages/${threadId}`]: {
          id: threadId,
          title,
          ownerId: user.uid,
          ownerName: buyerName,
          ownerAvatar: buyerAvatar,
          productId: product.id,
          productName: product.title,
          productImage: product.coverURL || '',
          visibility: villageVisibility,
          inviteLink,
          createdAt: now,
          updatedAt: now,
          members: {
            [user.uid]: {
              uid: user.uid,
              name: buyerName,
              avatarURL: buyerAvatar,
              paymentStatus: 'pending',
              joinedAt: now
            }
          }
        }
      };

      if (villageVisibility === 'public') {
        updates[`publicVillageDeals/${threadId}`] = {
          id: threadId,
          productId: product.id,
          productName: product.title,
          productImage: product.coverURL || '',
          title,
          villagePrice: product.villagePrice || product.price || 0,
          currency: product.currency || 'USD',
          buyersNeeded: Math.max(Number(product.buyersNeeded || 1), 1),
          createdAt: now
        };
      }

      await update(ref(realtimeDb), updates);
      setPurchaseVillage({ threadId, title, inviteLink, qrUrl, visibility: villageVisibility });
      setVillageStatus('Village d’achat créé. Il apparaît maintenant dans AfriChat.');

      if (payAfterCreation) {
        openCheckout(checkoutProduct, selectedDelivery);
      }
    } catch (error) {
      setVillageStatus(error instanceof Error ? error.message : 'Création du Village impossible.');
    } finally {
      setVillageCreating(false);
    }
  };

  const inviteToPurchaseVillage = async () => {
    if (!user || !purchaseVillage) return;
    const identifier = normalizeContactValue(inviteValue);
    if (!identifier) {
      setVillageStatus('Entre un email ou un numéro à inviter.');
      return;
    }

    setInviteSending(true);
    setVillageStatus('');
    try {
      const usersSnapshot = await get(ref(realtimeDb, 'users'));
      const users = usersSnapshot.val() as Record<string, RawUserProfile> | null;
      const match = Object.entries(users || {}).find(([, candidate]) => (
        normalizeContactValue(candidate.email || '') === identifier ||
        normalizeContactValue(candidate.phone || '') === identifier
      ));
      const now = Date.now();

      if (!match) {
        await set(push(ref(realtimeDb, `villageInvites/${purchaseVillage.threadId}`)), {
          identifier,
          invitedBy: user.uid,
          productId: product.id,
          status: 'pending',
          createdAt: now
        });
        setVillageStatus('Invitation enregistrée. L’utilisateur sera proposé dès qu’il sera trouvé.');
        return;
      }

      const [targetId, targetProfile] = match;
      const targetName = targetProfile.businessName || targetProfile.displayName || 'Utilisateur AfriSell';
      const updates: Record<string, unknown> = {
        [`chatThreads/${purchaseVillage.threadId}/members/${targetId}`]: true,
        [`chatThreads/${purchaseVillage.threadId}/memberNames/${targetId}`]: targetName,
        [`userChats/${targetId}/${purchaseVillage.threadId}`]: {
          threadId: purchaseVillage.threadId,
          title: purchaseVillage.title,
          avatarURL: product.coverURL || '',
          type: 'village',
          status: 'Invitation Village d’achat',
          productId: product.id,
          productName: product.title,
          productImage: product.coverURL || '',
          villagePrice: product.villagePrice || product.price || 0,
          currency: product.currency || 'USD',
          inviteLink: purchaseVillage.inviteLink,
          visibility: purchaseVillage.visibility,
          lastMessage: `Invitation à rejoindre le Village pour ${product.title}.`,
          lastMessageAt: now,
          unreadCount: 1,
          updatedAt: serverTimestamp()
        },
        [`villageDeals/${product.id}/villages/${purchaseVillage.threadId}/members/${targetId}`]: {
          uid: targetId,
          name: targetName,
          avatarURL: targetProfile.logoURL || targetProfile.photoURL || '',
          paymentStatus: 'invited',
          invitedBy: user.uid,
          joinedAt: now
        }
      };

      await update(ref(realtimeDb), updates);
      setInviteValue('');
      setVillageStatus(`${targetName} a été ajouté au Village.`);
    } catch (error) {
      setVillageStatus(error instanceof Error ? error.message : 'Invitation impossible.');
    } finally {
      setInviteSending(false);
    }
  };

  const payFromVillage = async () => {
    if (!purchaseVillage) {
      await createPurchaseVillage(true);
      return;
    }
    openCheckout(checkoutProduct, selectedDelivery);
  };

  const submitReview = async (event: FormEvent) => {
    event.preventDefault();
    if (!product) return;
    if (!user) {
      navigate('/login', { state: { next: `/market/${product.id}` } });
      return;
    }

    const text = reviewText.trim();
    if (!text) {
      setStatus('Ajoute un commentaire avant de noter ce Stand.');
      return;
    }

    setReviewSubmitting(true);
    try {
      const reviewRef = push(ref(realtimeDb, `productReviews/${product.id}`));
      await set(reviewRef, {
        id: reviewRef.key,
        authorId: user.uid,
        authorName: profile?.displayName || user.displayName || 'Client AfriSell',
        rating: reviewRating,
        text,
        createdAt: Date.now()
      });
      setReviewText('');
      setReviewRating(5);
      setStatus('Avis ajoute au Stand.');
    } catch {
      setStatus('Avis impossible pour le moment.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-full bg-black pb-36 text-white">
      <header className="sticky top-0 z-30 border-b border-gray-900 bg-black/95 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/70"
            aria-label="Retour"
          >
            <AfriSellIcon name="arrow" size={18} className="rotate-180" />
          </button>
          <p className="truncate text-[10px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">Détail produit</p>
          <button
            type="button"
            onClick={handleAddToCart}
            className={cn(
              'relative flex h-10 w-10 items-center justify-center rounded-2xl border text-[#15EA3E]',
              alreadyInCart ? 'border-[#15EA3E]/40 bg-[#15EA3E]/10' : 'border-white/10 bg-white/[0.04]'
            )}
            aria-label="Ajouter au panier"
          >
            <AfriSellIcon name="cart" size={18} />
            {cart.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#15EA3E] px-1 text-[8px] font-black text-black">
                {cart.length}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="px-4 pt-4">
        <ProductGallery product={product} />

        <section className="mt-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#15EA3E]">{product.category}</p>
              <h1 className="mt-2 text-2xl font-black leading-tight">{product.title}</h1>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-white/52">{product.description}</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {productBadges.map((badge) => (
              <div key={badge.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#15EA3E]/10 text-[#15EA3E]">
                    <AfriSellIcon name={badge.icon} size={15} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-black text-white">{badge.value}</p>
                    <p className="mt-0.5 text-[8px] font-black uppercase tracking-wider text-white/35">{badge.label}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-[1.4rem] border border-[#15EA3E]/20 bg-[#15EA3E]/10 p-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#15EA3E]">Prix AfriSell</p>
                <p className="mt-1 text-2xl font-black text-white">{formatMarketPrice(product.villagePrice || product.price, product.currency)}</p>
              </div>
              {product.price && product.villagePrice && product.price > product.villagePrice && (
                <p className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/50 line-through">
                  {formatMarketPrice(product.price, product.currency)}
                </p>
              )}
            </div>
            <div className="mt-4 rounded-2xl border border-[#15EA3E]/20 bg-black/22 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#15EA3E]">Prix Village</p>
                  <p className="mt-1 text-xs font-semibold text-white/58">
                    Village {(product.buyersCount || 0)}/{product.buyersNeeded || 1} pour débloquer le Prix Village.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleVillageShare}
                  disabled={villageSharing}
                  className="rounded-xl bg-[#15EA3E] px-3 py-2 text-[9px] font-black uppercase tracking-wider text-black disabled:bg-gray-800 disabled:text-gray-500"
                >
                  {villageSharing ? '...' : 'Partager'}
                </button>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[#15EA3E]"
                  style={{ width: `${Math.min(((product.buyersCount || 0) / Math.max(product.buyersNeeded || 1, 1)) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-[1.55rem] border border-[#15EA3E]/22 bg-[#071007] p-4 shadow-[0_18px_44px_rgba(0,0,0,0.28)]">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#15EA3E] text-black">
              <AfriSellIcon name="hub" size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#15EA3E]">Village d’achat</p>
              <h2 className="mt-1 text-lg font-black leading-tight text-white">Créer un Village pour payer au Prix Village</h2>
              <p className="mt-1 text-xs font-semibold leading-relaxed text-white/50">
                Le produit sera placé dans un Village AfriChat. Tu peux inviter par lien, QR code, email ou numéro, puis payer via AfriSpay.
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {[
              { id: 'private', label: 'Privé', body: 'Accès par invitation' },
              { id: 'public', label: 'Public', body: 'Visible dans les Villages' }
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setVillageVisibility(option.id as 'public' | 'private')}
                disabled={Boolean(purchaseVillage)}
                className={cn(
                  'rounded-2xl border p-3 text-left disabled:opacity-60',
                  villageVisibility === option.id ? 'border-[#15EA3E]/45 bg-[#15EA3E]/10' : 'border-white/10 bg-black/22'
                )}
              >
                <p className="text-xs font-black text-white">{option.label}</p>
                <p className="mt-1 text-[10px] font-semibold text-white/42">{option.body}</p>
              </button>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void createPurchaseVillage(false)}
              disabled={villageCreating || Boolean(purchaseVillage)}
              className="h-12 rounded-2xl bg-[#15EA3E] text-[10px] font-black uppercase tracking-widest text-black disabled:bg-gray-800 disabled:text-gray-500"
            >
              {purchaseVillage ? 'Village créé' : villageCreating ? 'Création...' : 'Créer Village'}
            </button>
            <button
              type="button"
              onClick={() => void payFromVillage()}
              disabled={villageCreating}
              className="h-12 rounded-2xl border border-[#15EA3E]/30 bg-[#15EA3E]/10 text-[10px] font-black uppercase tracking-widest text-[#15EA3E] disabled:opacity-50"
            >
              Payer via Village
            </button>
          </div>

          {purchaseVillage && (
            <div className="mt-4 rounded-[1.25rem] border border-white/10 bg-black/24 p-3">
              <div className="flex gap-3">
                <img src={purchaseVillage.qrUrl} alt="QR Village" className="h-24 w-24 shrink-0 rounded-2xl border border-white/10 bg-white p-1" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black text-white">{purchaseVillage.title}</p>
                  <p className="mt-1 line-clamp-2 text-[10px] font-semibold text-white/45">{purchaseVillage.inviteLink}</p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard?.writeText(purchaseVillage.inviteLink);
                        setVillageStatus('Lien du Village copié.');
                      }}
                      className="rounded-xl bg-white px-3 py-2 text-[9px] font-black uppercase tracking-wider text-black"
                    >
                      Copier
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/chat?village=${encodeURIComponent(purchaseVillage.threadId)}`)}
                      className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[9px] font-black uppercase tracking-wider text-white"
                    >
                      Ouvrir
                    </button>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  value={inviteValue}
                  onChange={(event) => setInviteValue(event.target.value)}
                  placeholder="Email ou numéro"
                  className="h-11 min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/30 px-3 text-xs font-semibold text-white outline-none focus:border-[#15EA3E]/45"
                />
                <button
                  type="button"
                  onClick={() => void inviteToPurchaseVillage()}
                  disabled={inviteSending}
                  className="h-11 rounded-2xl bg-[#15EA3E] px-4 text-[10px] font-black uppercase tracking-wider text-black disabled:bg-gray-800 disabled:text-gray-500"
                >
                  {inviteSending ? '...' : 'Inviter'}
                </button>
              </div>
            </div>
          )}

          {villageStatus && (
            <p className="mt-3 rounded-2xl border border-[#15EA3E]/20 bg-[#15EA3E]/10 p-3 text-xs font-bold text-[#15EA3E]">
              {villageStatus}
            </p>
          )}
        </section>

        <Link to={`/market/stand/${product.authorId}`} className="mt-5 block rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-4 active:scale-[0.99]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#15EA3E]/10 text-[#15EA3E]">
              <AfriSellIcon name="profile" size={19} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black">{product.authorName}</p>
              <p className="mt-0.5 text-[11px] font-semibold text-white/42">Stand vendeur, fournisseur ou producteur</p>
            </div>
            <span className="rounded-full bg-[#15EA3E] px-2 py-1 text-[8px] font-black uppercase tracking-wider text-black">
              Stand
            </span>
          </div>
        </Link>

        <section className="mt-5 grid grid-cols-3 gap-2">
          {[
            { label: 'Confiance', value: 'Vérifié', icon: 'shield' as const },
            { label: 'AfriCoin', value: `+${afriCoinValue}`, icon: 'star' as const },
            { label: 'FPP', value: formatMarketPrice(fppValue, product.currency), icon: 'heart' as const }
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center">
              <AfriSellIcon name={item.icon} size={17} className="mx-auto text-[#15EA3E]" />
              <p className="mt-2 truncate text-[11px] font-black text-white">{item.value}</p>
              <p className="mt-0.5 text-[8px] font-bold uppercase tracking-wider text-white/38">{item.label}</p>
            </div>
          ))}
        </section>

        <section className="mt-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/52">Livraison</h2>
            <span className="text-[10px] font-bold text-[#15EA3E]">{selectedDelivery.eta}</span>
          </div>
          <div className="space-y-2">
            {deliveryOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setSelectedDeliveryId(option.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-2xl border p-3 text-left',
                  option.id === selectedDeliveryId ? 'border-[#15EA3E]/40 bg-[#15EA3E]/10' : 'border-white/10 bg-white/[0.04]'
                )}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-black/30 text-[#15EA3E]">
                  <AfriSellIcon name={option.price === 0 ? 'check' : 'flash'} size={17} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-white">{option.title}</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-white/42">{option.description}</p>
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider text-[#15EA3E]">
                  {option.price === 0 ? 'Gratuit' : `$${option.price}`}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-5 grid grid-cols-3 gap-2">
          {[
            { label: 'Likes', value: product.likesCount || 0 },
            { label: 'Village', value: product.buyersCount || 0 },
            { label: 'Partages', value: product.sharesCount || 0 }
          ].map((metric) => (
            <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center">
              <p className="text-lg font-black text-white">{metric.value}</p>
              <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-white/38">{metric.label}</p>
            </div>
          ))}
        </section>

        <section className="mt-5 rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-4">
          <h2 className="text-sm font-black">Paiement AfriSpay</h2>
          <p className="mt-1 text-xs font-semibold leading-relaxed text-white/48">
            Paiement direct avec ton wallet AfriSpay. AfriCoin, FPP et vendeur sont notifiés après confirmation.
          </p>
          <div className="mt-3 flex items-center gap-2 rounded-2xl bg-black/35 p-3">
            <AfriSellIcon name="shield" size={18} className="text-[#15EA3E]" />
            <p className="text-[11px] font-bold text-white/58">Protection commande, livraison suivie et historique conservé.</p>
          </div>
        </section>

        <section className="mt-5 rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-4">
          <h2 className="text-sm font-black">Expérience d’achat</h2>
          <div className="mt-3 space-y-2">
            {[
              { title: 'Produit → panier', body: 'Ajoute l’article, compare les options et garde ton panier disponible dans l’app.' },
              { title: 'Paiement AfriSpay', body: 'Validation via wallet avec historique, AfriCoin et suivi des opérations.' },
              { title: 'Commande → livraison Safari', body: 'Une commande confirmée crée le suivi vendeur/client et la livraison associée.' },
              { title: 'Chat vendeur/client', body: 'La discussion reste liée à l’achat pour négocier, confirmer ou demander un support.' }
            ].map((step, index) => (
              <div key={step.title} className="flex gap-3 rounded-2xl border border-white/10 bg-black/22 p-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#15EA3E] text-xs font-black text-black">{index + 1}</span>
                <div>
                  <p className="text-xs font-black">{step.title}</p>
                  <p className="mt-0.5 text-[11px] font-semibold leading-relaxed text-white/45">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-5 rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-black">Avis du Stand</h2>
              <p className="mt-1 text-[11px] font-semibold text-white/45">
                {reviews.length ? `${reviewAverage.toFixed(1)}/5 sur ${reviews.length} avis` : 'Aucun avis pour le moment'}
              </p>
            </div>
            <div className="flex items-center gap-1 text-[#FFD84D]">
              <AfriSellIcon name="star" size={16} className="fill-current" />
              <span className="text-sm font-black">{reviewAverage ? reviewAverage.toFixed(1) : '0.0'}</span>
            </div>
          </div>

          <form onSubmit={submitReview} className="mt-4 space-y-3">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => setReviewRating(rating)}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-black/24"
                  aria-label={`Noter ${rating}`}
                >
                  <AfriSellIcon name="star" size={15} className={rating <= reviewRating ? 'fill-current text-[#FFD84D]' : 'text-white/25'} />
                </button>
              ))}
            </div>
            <textarea
              value={reviewText}
              onChange={(event) => setReviewText(event.target.value)}
              placeholder="Ton avis sur ce Stand..."
              rows={3}
              className="w-full resize-none rounded-2xl border border-white/10 bg-black/24 px-4 py-3 text-xs font-semibold text-white outline-none focus:border-[#15EA3E]/50"
            />
            <button
              type="submit"
              disabled={reviewSubmitting}
              className="h-11 w-full rounded-2xl bg-[#15EA3E] text-xs font-black uppercase tracking-widest text-black disabled:bg-gray-800 disabled:text-gray-500"
            >
              {reviewSubmitting ? 'Envoi...' : 'Noter le Stand'}
            </button>
          </form>

          {reviews.length > 0 && (
            <div className="mt-4 space-y-2">
              {reviews.slice(0, 3).map((review) => (
                <article key={review.id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-xs font-black">{review.authorName}</p>
                    <span className="flex items-center gap-1 text-[10px] font-black text-[#FFD84D]">
                      <AfriSellIcon name="star" size={11} className="fill-current" />
                      {review.rating}
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] font-semibold leading-relaxed text-white/52">{review.text}</p>
                </article>
              ))}
            </div>
          )}
        </section>

        {relatedProducts.length > 0 && (
          <section className="mt-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/52">Dans le même univers</h2>
              <Link to="/market" className="text-[10px] font-black text-[#15EA3E]">Market</Link>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
              {relatedProducts.map((item) => (
                <Link key={item.id} to={`/market/${item.id}`} className="w-[140px] shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
                  <img src={item.coverURL || '/afrimarket.jpeg'} alt={item.title} className="h-24 w-full object-cover" />
                  <div className="p-2.5">
                    <p className="line-clamp-2 text-[11px] font-black leading-tight">{item.title}</p>
                    <p className="mt-1 text-[10px] font-black text-[#15EA3E]">{formatMarketPrice(item.villagePrice || item.price, item.currency)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {status && (
          <p className="mt-4 rounded-2xl border border-[#15EA3E]/20 bg-[#15EA3E]/10 p-3 text-xs font-bold text-[#15EA3E]">
            {status}
          </p>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-20 z-30 mx-auto border-t border-gray-900 bg-black/96 px-4 py-3 backdrop-blur-md md:left-1/2 md:w-[340px] md:-translate-x-1/2">
        <div className="grid grid-cols-[1fr_1.2fr] gap-2">
          <button
            type="button"
            onClick={handleAddToCart}
            className={cn(
              'h-12 rounded-2xl border text-xs font-black uppercase tracking-widest',
              alreadyInCart ? 'border-[#15EA3E]/40 bg-[#15EA3E]/10 text-[#15EA3E]' : 'border-white/10 bg-white/[0.04] text-white'
            )}
          >
            {alreadyInCart ? 'Dans panier' : 'Ajouter'}
          </button>
          <button
            type="button"
            onClick={handleBuy}
            className="h-12 rounded-2xl bg-[#15EA3E] text-xs font-black uppercase tracking-widest text-black"
          >
            Payer AfriSpay
          </button>
        </div>
      </div>
    </div>
  );
}
