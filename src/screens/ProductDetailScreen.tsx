import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AfriSellIcon } from '../components/AfriSellIcon';
import { AfriMarketContent, formatMarketPrice, toCheckoutProduct, useAfriMarket } from '../hooks/useAfriMarket';
import { useAppStore } from '../store/useAppStore';
import { cn } from '../lib/utils';

type DeliveryOption = {
  id: string;
  title: string;
  description: string;
  price: number;
  eta: string;
};

const deliveryOptions: DeliveryOption[] = [
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
    description: 'Livraison rapide dans la meme ville.',
    price: 5,
    eta: '24h'
  },
  {
    id: 'pickup',
    title: 'Retrait vendeur',
    description: 'Recupere directement chez le vendeur.',
    price: 0,
    eta: 'Aujourd hui'
  }
];

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
      <p className="mt-2 text-sm leading-relaxed text-gray-500">Cet article n est plus disponible dans le Market.</p>
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
  const openCheckout = useAppStore((state) => state.openCheckout);
  const addToCart = useAppStore((state) => state.addToCart);
  const cart = useAppStore((state) => state.cart);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState(deliveryOptions[0].id);
  const [status, setStatus] = useState('');

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
    setStatus(alreadyInCart ? 'Article deja dans le panier.' : 'Article ajoute au panier.');
  };

  const handleBuy = () => {
    openCheckout(checkoutProduct);
  };

  return (
    <div className="relative min-h-full bg-black pb-28 text-white">
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
          <p className="truncate text-[10px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">Detail produit</p>
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
          </div>
        </section>

        <section className="mt-5 rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#15EA3E]/10 text-[#15EA3E]">
              <AfriSellIcon name="profile" size={19} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black">{product.authorName}</p>
              <p className="mt-0.5 text-[11px] font-semibold text-white/42">Vendeur verifie par AfriSell</p>
            </div>
            <span className="rounded-full bg-[#15EA3E] px-2 py-1 text-[8px] font-black uppercase tracking-wider text-black">
              Actif
            </span>
          </div>
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
            { label: 'Acheteurs', value: product.buyersCount || 0 },
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
            Paiement direct avec ton wallet AfriSpay. Le vendeur est notifie apres confirmation.
          </p>
          <div className="mt-3 flex items-center gap-2 rounded-2xl bg-black/35 p-3">
            <AfriSellIcon name="shield" size={18} className="text-[#15EA3E]" />
            <p className="text-[11px] font-bold text-white/58">Protection commande, livraison suivie et historique conserve.</p>
          </div>
        </section>

        {status && (
          <p className="mt-4 rounded-2xl border border-[#15EA3E]/20 bg-[#15EA3E]/10 p-3 text-xs font-bold text-[#15EA3E]">
            {status}
          </p>
        )}
      </main>

      <div className="absolute inset-x-0 bottom-20 z-30 border-t border-gray-900 bg-black px-4 py-3">
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
