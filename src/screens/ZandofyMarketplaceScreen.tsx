import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { onValue, push, ref, serverTimestamp, set } from 'firebase/database';
import { AfriZiaIcon, AfriZiaIconName } from '../components/AfriZiaIcon';
import { useFirebaseAuth } from '../hooks/useFirebaseAuth';
import { ZandofyOrderProcessingMode, ZandofyProductMedia, ZandofyTheme, getZandofyStoreURL, useZandofyStore } from '../hooks/useZandofyStore';
import { AFRICAN_COUNTRIES_BY_PRIORITY, getCountryByCode, getDeviceCityHint, getDeviceCountryCode } from '../lib/africaLocation';
import { realtimeDb } from '../lib/firebase';
import { cn } from '../lib/utils';
import { shareLink } from '../lib/shareLink';
import { recordZandofyAnalyticsEvent, ZandofyAnalyticsSnapshot } from '../domains/commerce/zandofyAnalytics';
import { AfriMarketContent, toCheckoutProduct, useAfriMarket } from '../hooks/useAfriMarket';
import { useAppStore } from '../store/useAppStore';

const themeStyles: Record<ZandofyTheme, string> = {
  emerald: 'from-[#15EA3E]/24 via-white/[0.05] to-black',
  midnight: 'from-sky-300/20 via-white/[0.05] to-black',
  sunrise: 'from-amber-300/26 via-[#15EA3E]/10 to-black',
  mono: 'from-white/18 via-white/[0.04] to-black'
};

const digitalCategories = [
  'E-books',
  'Formations',
  'Templates',
  'Musique',
  'Photos',
  'Logiciels',
  'Billets',
  'Licences'
];

const dashboardActions = [
  { label: 'Nouveau produit', icon: 'plus' as const, route: '/zandofy/products/new' },
  { label: 'Collections', icon: 'hub' as const, route: '/zandofy/products' },
  { label: 'Commandes', icon: 'order' as const, route: '/market/orders?module=zandofy' },
  { label: 'Statistique', icon: 'signal' as const, route: '/zandofy/stats' },
  { label: 'Mes clients', icon: 'contact' as const, route: '/zandofy/clients' },
  { label: 'ZikMart', icon: 'market' as const, route: '/zikmart' },
  { label: 'Réglage', icon: 'settings' as const, route: '/zandofy/domain' }
];

const zandofyMenu = [
  { label: 'Accueil', icon: 'home' as const, route: '/zandofy' },
  { label: 'Produits', icon: 'market' as const, route: '/zandofy/products' },
  { label: 'Promo', icon: 'signal' as const, route: '/zandofy/promos' },
  { label: 'Affiliation', icon: 'share' as const, route: '/zandofy/affiliation' },
  { label: 'À propos', icon: 'app' as const, route: '/zandofy/about' },
  { label: 'Contacts', icon: 'contact' as const, route: '/zandofy/clients' },
  { label: 'Mes achats', icon: 'order' as const, route: '/market/orders?module=zandofy&view=purchases' }
];

function ZandofyMenuBar() {
  return (
    <nav aria-label="Navigation Zandofy" className="scrollbar-hide flex gap-2 overflow-x-auto px-4 py-3">
      {zandofyMenu.map((item) => (
        <Link key={item.label} to={item.route} className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.045] px-3 py-2 text-[9px] font-black text-white/62">
          <AfriZiaIcon name={item.icon} size={13} className="text-[#15EA3E]" />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

type ZandofyOrder = {
  id: string;
  productId: string;
  productName: string;
  productImage?: string;
  productCategory?: string;
  sellerId?: string;
  buyerId: string;
  buyerName: string;
  buyerAvatar?: string;
  totalAmount: number;
  fppAmount?: number;
  sellerNetAmount?: number;
  currency: string;
  status: string;
  paymentStatus?: string;
  createdAt?: number;
  module?: string;
  storeId?: string;
  isDigital?: boolean;
};

type ZandofyStoreReview = {
  id: string;
  authorId: string;
  authorName: string;
  rating: number;
  text: string;
  createdAt: number;
};

const useZandofyOrders = (storeId?: string, ownerId?: string) => {
  const [orders, setOrders] = useState<ZandofyOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  useEffect(() => {
    if (!storeId) {
      setOrders([]);
      setLoadingOrders(false);
      return undefined;
    }

    setLoadingOrders(true);
    const ordersRef = ref(realtimeDb, 'orders');
    const unsubscribe = onValue(ordersRef, (snapshot) => {
      const data = snapshot.val() as Record<string, ZandofyOrder> | null;
      const nextOrders = Object.entries(data || {})
        .map(([id, order]) => ({ ...order, id: order.id || id }))
        .filter((order) => (
          order.storeId === storeId ||
          (!order.storeId && order.sellerId === ownerId && (order.module === 'zandofy' || order.isDigital || order.productCategory === 'Zandofy'))
        ))
        .sort((first, second) => Number(second.createdAt || 0) - Number(first.createdAt || 0));
      setOrders(nextOrders);
      setLoadingOrders(false);
    }, () => setLoadingOrders(false));

    return unsubscribe;
  }, [ownerId, storeId]);

  return { orders, loadingOrders };
};

const formatZandofyMoney = (value: number, currency = 'USD') => {
  if (currency === 'USD') return `$${Number(value || 0).toLocaleString('fr-FR')}`;
  if (currency === 'CDF') return `${Number(value || 0).toLocaleString('fr-FR')} CDF`;
  return `${Number(value || 0).toLocaleString('fr-FR')} ${currency}`;
};

type DigitalProductType = 'Formation' | 'E-book' | 'Template' | 'Audio' | 'Vidéo' | 'Licence' | 'Billet' | 'Pack digital';

const digitalTypeConfig: Record<DigitalProductType, {
  label: string;
  icon: AfriZiaIconName;
  hint: string;
  accept: string;
  multiple: boolean;
  uploadLabel: string;
  deliveryNote: string;
}> = {
  Formation: {
    label: 'Formation',
    icon: 'school',
    hint: 'Modules, leçons, support PDF, accès apprenant.',
    accept: 'video/*,application/pdf,.zip,.doc,.docx,.ppt,.pptx',
    multiple: true,
    uploadLabel: 'Importer vidéos, supports ou pack formation',
    deliveryNote: 'L’acheteur reçoit les modules et supports après paiement.'
  },
  'E-book': {
    label: 'Livre digital',
    icon: 'file',
    hint: 'PDF, Word, EPUB ou livre audio associé.',
    accept: 'application/pdf,.pdf,.doc,.docx,.epub,.mobi,audio/*',
    multiple: true,
    uploadLabel: 'Importer le livre PDF, Word ou EPUB',
    deliveryNote: 'Le fichier du livre est livré automatiquement.'
  },
  Template: {
    label: 'Template',
    icon: 'app',
    hint: 'Design, fichier source, modèle Notion, Excel, CV, site.',
    accept: '.zip,.fig,.psd,.ai,.xd,.sketch,.xlsx,.xls,.doc,.docx,.ppt,.pptx,.pdf',
    multiple: true,
    uploadLabel: 'Importer les fichiers template',
    deliveryNote: 'Le client reçoit un pack de fichiers modifiables.'
  },
  Audio: {
    label: 'Audio',
    icon: 'mic',
    hint: 'Musique, podcast, voix, pack sonore.',
    accept: 'audio/*,.mp3,.wav,.m4a,.aac,.ogg,.zip',
    multiple: true,
    uploadLabel: 'Importer audio ou pack sonore',
    deliveryNote: 'Les pistes audio sont livrées après paiement.'
  },
  Vidéo: {
    label: 'Vidéo',
    icon: 'video',
    hint: 'Vidéo unique, série courte, masterclass.',
    accept: 'video/*,.mp4,.mov,.m4v,.webm,.zip',
    multiple: true,
    uploadLabel: 'Importer la vidéo ou les vidéos',
    deliveryNote: 'Les vidéos deviennent accessibles après paiement.'
  },
  Licence: {
    label: 'Licence',
    icon: 'lock',
    hint: 'Clé logiciel, accès SaaS, activation ou durée.',
    accept: '.txt,.csv,.xlsx,.pdf',
    multiple: true,
    uploadLabel: 'Importer fichier de clés ou preuve licence',
    deliveryNote: 'Une clé ou instruction d’activation est fournie au client.'
  },
  Billet: {
    label: 'Billet',
    icon: 'scan',
    hint: 'Billet dynamique avec QR, code-barres et référence.',
    accept: 'image/*,application/pdf,.pdf',
    multiple: true,
    uploadLabel: 'Importer visuel ou plan de billet',
    deliveryNote: 'Chaque acheteur reçoit un billet personnalisé.'
  },
  'Pack digital': {
    label: 'Pack digital',
    icon: 'order',
    hint: 'Bundle avec plusieurs fichiers, bonus et accès.',
    accept: '.zip,.rar,.pdf,.doc,.docx,video/*,audio/*,image/*',
    multiple: true,
    uploadLabel: 'Importer le pack ou plusieurs fichiers',
    deliveryNote: 'Le pack complet est livré après paiement.'
  }
};

const digitalTypes = Object.keys(digitalTypeConfig) as DigitalProductType[];
const zandofyProductDraftKey = (storeId?: string) => `afrisell:zandofy-product-draft:${storeId || 'pending'}`;
const getZandofyProductPath = (product: { id: string; storeSlug?: string }) => (
  product.storeSlug
    ? `/zandofy/${encodeURIComponent(product.storeSlug)}/product/${encodeURIComponent(product.id)}`
    : `/zandofy/product/${encodeURIComponent(product.id)}`
);

const getSourceProductURL = (product: AfriMarketContent) => product.storeSlug
  ? `${window.location.origin}${getZandofyProductPath(product)}`
  : `${window.location.origin}/market/${encodeURIComponent(product.id)}`;

const getZikMartProductPath = (product: AfriMarketContent) => product.storeId || product.offerModule === 'Zandofy'
  ? getZandofyProductPath(product)
  : `/market/${encodeURIComponent(product.id)}`;

const getInitialCountryCode = () => getDeviceCountryCode();

const getInitialCity = (countryCode: string) => {
  const detectedCity = getDeviceCityHint();
  if (detectedCity) return detectedCity;
  return getCountryByCode(countryCode)?.fallbackCities[0] || 'Kinshasa';
};

function QRPreview({ value, logoURL, size = 196 }: { value: string; logoURL: string; size?: number }) {
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=12&data=${encodeURIComponent(value)}`;

  return (
    <div className="relative mx-auto flex h-[220px] w-[220px] items-center justify-center rounded-[2rem] border border-[#15EA3E]/18 bg-white p-3 shadow-[0_24px_70px_rgba(0,0,0,0.36)]">
      <img src={qrSrc} alt="QR code Zandofy" className="h-full w-full rounded-[1.4rem] object-contain" />
      <div className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl border-[5px] border-white bg-black shadow-xl">
        <img src={logoURL || '/zandofyiconeapp.png'} alt="" className="h-full w-full rounded-xl object-cover" />
      </div>
    </div>
  );
}

function TicketPreview({
  title,
  date,
  place,
  ticketType,
  prefix,
  storeLogo
}: {
  title: string;
  date: string;
  place: string;
  ticketType: string;
  prefix: string;
  storeLogo: string;
}) {
  const reference = `${prefix || 'ZDY'}-000001`;
  const qrValue = `zandofy-ticket:${reference}`;
  const formattedDate = date
    ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date))
    : 'Date à définir';

  return (
    <div className="overflow-hidden rounded-[1.6rem] border border-[#15EA3E]/18 bg-white text-black shadow-[0_20px_60px_rgba(0,0,0,0.34)]">
      <div className="relative bg-[linear-gradient(135deg,#071007,#15EA3E)] p-4 text-white">
        <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/14 blur-sm" />
        <div className="relative z-10 flex items-center gap-3">
          <img src={storeLogo || '/zandofyiconeapp.png'} alt="" className="h-12 w-12 rounded-2xl border border-white/24 object-cover" />
          <div className="min-w-0">
            <p className="text-[8px] font-black uppercase tracking-[0.22em] text-white/68">Zandofy Ticket</p>
            <h3 className="truncate text-lg font-black leading-tight">{title}</h3>
          </div>
        </div>
        <p className="relative z-10 mt-4 text-xs font-bold text-white/76">{formattedDate}</p>
        <p className="relative z-10 mt-1 truncate text-[10px] font-black uppercase tracking-wider text-white/54">{place}</p>
      </div>
      <div className="grid grid-cols-[1fr_98px] gap-3 p-4">
        <div className="min-w-0">
          <p className="text-[8px] font-black uppercase tracking-[0.2em] text-black/38">Acheteur</p>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-black/10" />
            <div className="min-w-0">
              <p className="truncate text-sm font-black">Nom utilisateur</p>
              <p className="text-[10px] font-bold text-black/45">{ticketType || 'Standard'}</p>
            </div>
          </div>
          <p className="mt-4 text-[8px] font-black uppercase tracking-[0.2em] text-black/38">Référence</p>
          <p className="mt-1 text-sm font-black">{reference}</p>
          <div className="mt-3 flex h-10 items-end gap-[3px]">
            {Array.from({ length: 22 }).map((_, index) => (
              <span key={index} className="w-[3px] bg-black" style={{ height: `${14 + ((index * 7) % 24)}px` }} />
            ))}
          </div>
        </div>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-black/10 bg-black/[0.03] p-2">
          <img src={`https://api.qrserver.com/v1/create-qr-code/?size=92x92&margin=8&data=${encodeURIComponent(qrValue)}`} alt="" className="h-20 w-20" />
          <p className="mt-2 text-center text-[8px] font-black uppercase tracking-wider text-black/42">Scan entrée</p>
        </div>
      </div>
    </div>
  );
}

function ZandofyFlowDemo() {
  return (
    <div className="relative h-[232px] overflow-hidden rounded-[1.8rem] border border-[#15EA3E]/16 bg-[radial-gradient(circle_at_18%_18%,rgba(21,234,62,0.22),transparent_34%),linear-gradient(135deg,#071007,#020402_62%,#0b150b)] shadow-[0_20px_58px_rgba(0,0,0,0.32)]">
      <style>{`
        @keyframes zandofy-drift-a {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(-4deg); }
          50% { transform: translate3d(10px, -12px, 0) rotate(2deg); }
        }
        @keyframes zandofy-drift-b {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(5deg); }
          50% { transform: translate3d(-12px, 10px, 0) rotate(-2deg); }
        }
        @keyframes zandofy-orbit {
          0% { transform: translateX(-28px); opacity: .18; }
          50% { opacity: .72; }
          100% { transform: translateX(28px); opacity: .18; }
        }
        @keyframes zandofy-pulse {
          0%, 100% { transform: scale(.96); opacity: .6; }
          50% { transform: scale(1.04); opacity: 1; }
        }
      `}</style>
      <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] [background-size:24px_24px]" />
      <div className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-[1.6rem] border border-[#15EA3E]/24 bg-black/55 p-2 shadow-[0_18px_50px_rgba(21,234,62,0.18)] backdrop-blur">
        <img src="/zandofyiconeapp.png" alt="" className="h-full w-full rounded-[1.1rem] object-cover" />
      </div>

      <div className="absolute left-5 top-7 h-24 w-20 overflow-hidden rounded-[1.35rem] border border-white/12 bg-white/[0.06] shadow-2xl" style={{ animation: 'zandofy-drift-a 5.8s ease-in-out infinite' }}>
        <img src="/zandofy/woman-promoting-cloths-from-thrift-store.jpg" alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-x-2 bottom-2 h-2 rounded-full bg-[#15EA3E]" />
      </div>

      <div className="absolute right-6 top-5 h-20 w-24 overflow-hidden rounded-[1.35rem] border border-white/12 bg-white/[0.06] shadow-2xl" style={{ animation: 'zandofy-drift-b 6.2s ease-in-out infinite' }}>
        <img src="/zandofy/two-women-viewing-content-phone-local-african-market.jpg" alt="" className="h-full w-full object-cover" />
        <div className="absolute left-2 top-2 rounded-full bg-black/62 px-2 py-1 text-[7px] font-black uppercase tracking-wider text-[#15EA3E]">Digital</div>
      </div>

      <div className="absolute bottom-7 left-7 flex h-16 w-28 items-center gap-2 rounded-[1.25rem] border border-white/12 bg-white/[0.08] p-2 shadow-2xl backdrop-blur" style={{ animation: 'zandofy-drift-b 7s ease-in-out infinite' }}>
        <img src="/afrispayicone.png" alt="" className="h-9 w-9 rounded-xl object-cover" />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="h-2 w-full rounded-full bg-white/22" />
          <div className="h-2 w-2/3 rounded-full bg-[#15EA3E]" />
        </div>
      </div>

      <div className="absolute bottom-8 right-7 flex h-16 w-24 items-center justify-center rounded-[1.25rem] border border-white/12 bg-white/[0.08] shadow-2xl backdrop-blur" style={{ animation: 'zandofy-drift-a 6.8s ease-in-out infinite' }}>
        <img src="/africhat icone message avec nom .png" alt="" className="h-11 w-11 rounded-2xl object-cover" />
        <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-[#15EA3E] shadow-[0_0_18px_rgba(21,234,62,0.9)]" />
      </div>

      <div className="absolute left-1/2 top-[28px] h-1 w-32 -translate-x-1/2 rounded-full bg-[#15EA3E]/30" style={{ animation: 'zandofy-orbit 3.2s ease-in-out infinite' }} />
      <div className="absolute bottom-[34px] left-1/2 h-1 w-36 -translate-x-1/2 rounded-full bg-white/18" style={{ animation: 'zandofy-orbit 3.8s ease-in-out infinite reverse' }} />
      <div className="absolute right-[90px] top-[92px] h-9 w-9 rounded-xl border border-white/14 bg-white p-1 shadow-xl" style={{ animation: 'zandofy-pulse 2.4s ease-in-out infinite' }}>
        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=64x64&margin=8&data=${encodeURIComponent('/zandofy/store')}`} alt="" className="h-full w-full rounded-lg" />
      </div>
    </div>
  );
}

export default function ZandofyMarketplaceScreen() {
  const navigate = useNavigate();
  const { user } = useFirebaseAuth();
  const { ownerStore, stores, loading } = useZandofyStore();
  const featuredStores = stores.slice(0, 6);

  useEffect(() => {
    if (ownerStore) navigate('/zandofy/dashboard', { replace: true });
  }, [navigate, ownerStore]);

  return (
    <main className="min-h-full overflow-y-auto bg-[#030604] pb-24 text-white scrollbar-hide">
      <header className="relative overflow-hidden px-4 pb-7 pt-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_8%,rgba(21,234,62,0.32),transparent_34%),linear-gradient(180deg,#071407,#030604)]" />
        <div className="relative z-20 flex items-center justify-between">
          <button type="button" onClick={() => navigate(-1)} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-black/34 text-[#15EA3E] backdrop-blur">
            <AfriZiaIcon name="arrow" size={18} className="rotate-180" />
          </button>
          <img src="/zandofyiconeapp.png" alt="Zandofy" className="h-11 w-11 rounded-2xl object-cover shadow-[0_12px_32px_rgba(21,234,62,0.22)]" />
        </div>

        <div className="relative z-10 mt-5 overflow-hidden rounded-[2rem] border border-[#15EA3E]/18 bg-black shadow-[0_18px_44px_rgba(0,0,0,0.38)]">
          <img src="/zandofy/group-five-african-american-woman-with-shopping-carts-having-fun-together-outdoor.jpg" alt="Zandofy" className="h-44 w-full object-cover object-center" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,6,4,0.12),rgba(3,6,4,0.78))]" />
          <img src="/zandofyiconeapp.png" alt="" className="absolute -right-4 -top-5 h-32 w-32 rounded-[2rem] object-cover opacity-55 blur-[1.5px]" />
          <div className="absolute bottom-4 left-4 right-20">
            <p className="text-[9px] font-black uppercase tracking-[0.24em] text-[#15EA3E]">Zandofy</p>
            <p className="mt-2 text-sm font-black leading-snug text-white drop-shadow">
              Vends tes produits physiques, digitaux et tes offres avec AfriSpay sur Zandofy.
            </p>
          </div>
        </div>
      </header>

      <ZandofyMenuBar />

      <section className="px-4">
        <div className="rounded-[1.8rem] border border-[#15EA3E]/16 bg-[#071007] p-3 shadow-[0_18px_48px_rgba(0,0,0,0.28)]">
          <ZandofyFlowDemo />
          <div className="mt-5">
            <Link
              to={ownerStore ? '/zandofy/dashboard' : user ? '/zandofy/create' : '/login'}
              className="block rounded-2xl bg-[#15EA3E] py-3 text-center text-[10px] font-black uppercase tracking-wider text-black"
            >
              {ownerStore ? 'Dashboard Zandofy' : 'Créer ma boutique Zandofy'}
            </Link>
          </div>
        </div>
      </section>

      <section className="px-4 pt-5">
        <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
          {digitalCategories.map((label) => (
            <span key={label} className="shrink-0 rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-[10px] font-black text-white/66">
              {label}
            </span>
          ))}
        </div>
      </section>

      <section className="px-4 pt-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black">Boutiques Zandofy</h2>
          <span className="text-[9px] font-black uppercase tracking-wider text-white/38">{loading ? 'Chargement' : `${featuredStores.length} active(s)`}</span>
        </div>
        <div className="mt-3 space-y-2">
          {featuredStores.length ? featuredStores.map((store) => (
            <Link key={store.id} to={`/zandofy/${store.slug}`} className="flex items-center gap-3 rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-3">
              <img src={store.logoURL || '/zandofyiconeapp.png'} alt="" className="h-12 w-12 rounded-2xl object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black">{store.name}</p>
                <p className="truncate text-[10px] font-semibold text-white/42">{store.city}, {store.country} - {store.digitalProductsCount} digital · {store.physicalProductsCount} physique(s)</p>
              </div>
              <AfriZiaIcon name="arrow" size={14} className="text-[#15EA3E]" />
            </Link>
          )) : (
            <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.035] p-4 text-sm font-semibold text-white/45">
              Aucune boutique publique pour le moment.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

export function ZandofyCreateStoreScreen() {
  const navigate = useNavigate();
  const { user, profile } = useFirebaseAuth();
  const { ownerStore, createStore } = useZandofyStore();
  const detectedCountryCode = getInitialCountryCode();
  const detectedCountry = getCountryByCode(detectedCountryCode) || AFRICAN_COUNTRIES_BY_PRIORITY[0];
  const [step, setStep] = useState(0);
  const [name, setName] = useState(profile?.businessName || '');
  const [tagline, setTagline] = useState('Produits physiques et digitaux, vendus simplement.');
  const [countryCode, setCountryCode] = useState(detectedCountry.code);
  const [city, setCity] = useState(getInitialCity(detectedCountry.code));
  const [theme, setTheme] = useState<ZandofyTheme>('emerald');
  const [orderProcessingMode, setOrderProcessingMode] = useState<ZandofyOrderProcessingMode>('manual');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState(profile?.logoURL || profile?.photoURL || '/zandofyiconeapp.png');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [detectingLocation, setDetectingLocation] = useState(false);

  const selectedCountry = getCountryByCode(countryCode) || detectedCountry;
  const canContinue = step === 0 ? name.trim().length >= 3 : step === 1 ? Boolean(countryCode && city.trim()) : true;

  if (!user) {
    return (
      <main className="flex min-h-full items-center justify-center bg-[#030604] p-6 text-center text-white">
        <Link to="/login" className="rounded-2xl bg-[#15EA3E] px-5 py-3 text-xs font-black uppercase tracking-wider text-black">Se connecter</Link>
      </main>
    );
  }

  if (ownerStore) {
    return (
      <main className="flex min-h-full flex-col justify-center bg-[#030604] p-5 text-white">
        <div className="rounded-[2rem] border border-[#15EA3E]/18 bg-[#071007] p-5 text-center">
          <img src={ownerStore.logoURL} alt="" className="mx-auto h-20 w-20 rounded-[1.4rem] object-cover" />
          <h1 className="mt-4 text-2xl font-black">Boutique déjà créée</h1>
          <p className="mt-2 text-sm font-semibold text-white/52">{ownerStore.name} est prête.</p>
          <Link to="/zandofy/dashboard" className="mt-5 block rounded-2xl bg-[#15EA3E] py-3 text-[10px] font-black uppercase tracking-wider text-black">Accéder</Link>
        </div>
      </main>
    );
  }

  const handleLogo = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setLogoFile(file);
    if (file) setLogoPreview(URL.createObjectURL(file));
  };

  const detectLocation = async () => {
    if (!navigator.geolocation) {
      setStatus("La localisation n'est pas disponible sur cet appareil.");
      return;
    }

    setDetectingLocation(true);
    setStatus('Détection de la ville...');
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 10 * 60 * 1000
        });
      });

      const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${position.coords.latitude}&longitude=${position.coords.longitude}&localityLanguage=fr`);
      const payload = await response.json().catch(() => null) as {
        countryCode?: string;
        city?: string;
        locality?: string;
        principalSubdivision?: string;
      } | null;
      const nextCountry = getCountryByCode(payload?.countryCode || '');
      if (nextCountry) setCountryCode(nextCountry.code);
      const nextCity = payload?.city || payload?.locality || payload?.principalSubdivision || '';
      if (nextCity) setCity(nextCity);
      setStatus(nextCity ? 'Ville détectée.' : 'Localisation reçue. Vérifie la ville avant de continuer.');
    } catch (error) {
      console.error('Localisation Zandofy impossible:', error);
      setStatus("Localisation refusée ou indisponible. Tu peux écrire la ville manuellement.");
    } finally {
      setDetectingLocation(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (step < 3) {
      if (canContinue) setStep((value) => value + 1);
      return;
    }

    setBusy(true);
    setStatus('Création de la boutique...');
    try {
      const store = await createStore({
        name,
        tagline,
        country: selectedCountry.name,
        countryCode: selectedCountry.code,
        city,
        logoFile,
        logoURL: logoPreview,
        theme,
        orderProcessingMode
      });
      setStatus('Boutique créée.');
      navigate(`/zandofy/dashboard?created=${encodeURIComponent(store.slug)}`);
    } catch (error) {
      console.error('Création Zandofy impossible:', error);
      setStatus(error instanceof Error ? error.message : 'Création impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-full overflow-y-auto bg-[#030604] pb-24 text-white scrollbar-hide">
      <header className="sticky top-0 z-20 flex items-center justify-between bg-[#030604]/88 px-4 pb-3 pt-4 backdrop-blur-xl">
        <button type="button" onClick={() => step ? setStep(step - 1) : navigate(-1)} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-white/72">
          <AfriZiaIcon name="arrow" size={16} className={step ? 'rotate-180' : 'rotate-180'} />
        </button>
        <div className="text-center">
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">Zandofy</p>
          <h1 className="text-sm font-black">Création boutique</h1>
        </div>
        <span className="text-[10px] font-black text-white/38">{step + 1}/4</span>
      </header>

      <form onSubmit={handleSubmit} className="px-4 pt-4">
        <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-white/8">
          <div className="h-full rounded-full bg-[#15EA3E] transition-all" style={{ width: `${((step + 1) / 4) * 100}%` }} />
        </div>

        {step === 0 && (
          <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">Identité</p>
            <h2 className="mt-2 text-2xl font-black leading-tight">Nom de ta boutique</h2>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex: Charmant Digital Store" className="mt-5 w-full rounded-2xl border border-white/10 bg-black/28 px-4 py-4 text-sm font-bold outline-none focus:border-[#15EA3E]/45" />
            <textarea value={tagline} onChange={(event) => setTagline(event.target.value)} rows={3} placeholder="Phrase courte de présentation" className="mt-3 w-full resize-none rounded-2xl border border-white/10 bg-black/28 px-4 py-4 text-sm font-bold outline-none focus:border-[#15EA3E]/45" />
          </section>
        )}

        {step === 1 && (
          <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">Localisation</p>
            <h2 className="mt-2 text-2xl font-black leading-tight">Pays et ville</h2>
            <select value={countryCode} onChange={(event) => {
              const nextCountry = getCountryByCode(event.target.value) || selectedCountry;
              setCountryCode(nextCountry.code);
              setCity(nextCountry.fallbackCities[0] || '');
            }} className="mt-5 w-full rounded-2xl border border-white/10 bg-black/28 px-4 py-4 text-sm font-bold outline-none">
              {AFRICAN_COUNTRIES_BY_PRIORITY.map((country) => (
                <option key={country.code} value={country.code}>{country.name}</option>
              ))}
            </select>
            <input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Ville" className="mt-3 w-full rounded-2xl border border-white/10 bg-black/28 px-4 py-4 text-sm font-bold outline-none focus:border-[#15EA3E]/45" />
            <button type="button" onClick={detectLocation} disabled={detectingLocation} className="mt-3 w-full rounded-2xl border border-[#15EA3E]/18 bg-[#15EA3E]/8 py-3 text-[10px] font-black uppercase tracking-wider text-[#15EA3E] disabled:opacity-50">
              {detectingLocation ? 'Détection...' : 'Détecter automatiquement'}
            </button>
            <p className="mt-3 text-[10px] font-semibold leading-relaxed text-white/38">La ville est préremplie selon l’appareil quand le navigateur donne assez d’indications. Tu peux corriger avant de continuer.</p>
          </section>
        )}

        {step === 2 && (
          <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">Logo et style</p>
            <h2 className="mt-2 text-2xl font-black leading-tight">Donne une identité visuelle</h2>
            <label className="mt-5 flex items-center gap-4 rounded-[1.4rem] border border-white/10 bg-black/28 p-3">
              <img src={logoPreview} alt="" className="h-16 w-16 rounded-2xl object-cover" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-black">Importer un logo</span>
                <span className="mt-1 block text-[10px] font-semibold text-white/42">PNG ou JPG recommandé.</span>
              </span>
              <AfriZiaIcon name="gallery" size={18} className="text-[#15EA3E]" />
              <input type="file" accept="image/*" className="hidden" onChange={handleLogo} />
            </label>
            <div className="mt-4 grid grid-cols-4 gap-2">
              {(['emerald', 'midnight', 'sunrise', 'mono'] as ZandofyTheme[]).map((item) => (
                <button key={item} type="button" onClick={() => setTheme(item)} className={cn('h-16 rounded-2xl border bg-gradient-to-br', themeStyles[item], theme === item ? 'border-[#15EA3E]' : 'border-white/10')} />
              ))}
            </div>
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-white/42">Traitement des commandes</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {([['manual', 'Manuel'], ['automatic', 'Automatique']] as Array<[ZandofyOrderProcessingMode, string]>).map(([value, label]) => (
                  <button key={value} type="button" onClick={() => setOrderProcessingMode(value)} className={cn('rounded-xl border py-3 text-xs font-black', orderProcessingMode === value ? 'border-[#15EA3E] bg-[#15EA3E] text-black' : 'border-white/10 bg-white/[0.04] text-white/56')}>
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[10px] font-semibold leading-relaxed text-white/38">Automatique prépare la commande dès le paiement. Manuel te laisse valider chaque étape.</p>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="rounded-[2rem] border border-[#15EA3E]/18 bg-[#071007] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">Récapitulatif</p>
            <div className="mt-5 flex items-center gap-4">
              <img src={logoPreview} alt="" className="h-20 w-20 rounded-[1.35rem] object-cover" />
              <div className="min-w-0">
                <h2 className="truncate text-2xl font-black">{name || 'Boutique Zandofy'}</h2>
                <p className="mt-1 text-sm font-semibold text-white/50">{city}, {selectedCountry.name}</p>
              </div>
            </div>
            <p className="mt-5 rounded-2xl border border-white/10 bg-black/24 p-4 text-sm font-semibold leading-relaxed text-white/58">{tagline}</p>
            <div className="mt-4 rounded-2xl border border-[#15EA3E]/16 bg-[#15EA3E]/8 p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-[#15EA3E]">Lien prévu</p>
              <p className="mt-1 break-all text-xs font-black text-white">/zandofy/{name ? name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : 'boutique'}</p>
            </div>
          </section>
        )}

        {status && <p className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center text-xs font-bold text-white/60">{status}</p>}

        <button disabled={!canContinue || busy} className="mt-5 w-full rounded-2xl bg-[#15EA3E] py-4 text-xs font-black uppercase tracking-[0.18em] text-black disabled:opacity-40">
          {step === 3 ? busy ? 'Création...' : 'Confirmer' : 'Continuer'}
        </button>
      </form>
    </main>
  );
}

export function ZandofyDashboardScreen() {
  const navigate = useNavigate();
  const { ownerStore, loading, products } = useZandofyStore();
  const createdSlug = new URLSearchParams(window.location.search).get('created');
  const store = ownerStore;

  if (loading) return <main className="flex min-h-full items-center justify-center bg-[#030604] text-white">Chargement Zandofy...</main>;
  if (!store) {
    return (
      <main className="flex min-h-full flex-col justify-center bg-[#030604] p-5 text-white">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 text-center">
          <h1 className="text-2xl font-black">Aucune boutique</h1>
          <p className="mt-2 text-sm font-semibold text-white/48">Crée ta boutique physique, digitale ou mixte avant d’accéder au dashboard.</p>
          <Link to="/zandofy/create" className="mt-5 block rounded-2xl bg-[#15EA3E] py-3 text-[10px] font-black uppercase tracking-wider text-black">Créer</Link>
        </div>
      </main>
    );
  }

  const storeURL = getZandofyStoreURL(store.slug);
  const recentProducts = products.slice(0, 3);

  return (
    <main className="min-h-full overflow-y-auto bg-[#030604] pb-24 text-white scrollbar-hide">
      <header className="sticky top-0 z-20 flex items-center justify-between bg-[#030604]/88 px-4 pb-3 pt-4 backdrop-blur-xl">
        <button type="button" onClick={() => navigate('/zandofy')} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]">
          <AfriZiaIcon name="arrow" size={16} className="rotate-180" />
        </button>
        <div className="text-center">
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">Zandofy</p>
          <h1 className="text-sm font-black">Dashboard</h1>
        </div>
        <Link to={`/zandofy/${store.slug}`} className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#15EA3E] text-black">
          <AfriZiaIcon name="eye" size={16} />
        </Link>
      </header>

      <ZandofyMenuBar />

      <section className="px-4 pt-4">
        <div className={cn('relative overflow-hidden rounded-[2rem] border border-[#15EA3E]/18 bg-gradient-to-br p-4', themeStyles[store.theme])}>
          <div className="flex items-center gap-4">
            <img src={store.logoURL} alt="" className="h-16 w-16 rounded-[1.25rem] border border-white/10 object-cover" />
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">Boutique active</p>
              <h2 className="truncate text-xl font-black">{store.name}</h2>
              <p className="mt-1 text-xs font-semibold text-white/52">{store.city}, {store.country}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              [products.length || store.digitalProductsCount + store.physicalProductsCount, 'Produits'],
              [store.ordersCount, 'Commandes'],
              [store.customDomain ? 'Domaine' : 'Lien', 'Actif']
            ].map(([value, label]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-black/24 p-3 text-center">
                <p className="text-sm font-black">{value}</p>
                <p className="mt-1 text-[8px] font-black uppercase tracking-wider text-white/38">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {createdSlug && (
        <section className="px-4 pt-5">
          <div className="rounded-[2rem] border border-[#15EA3E]/18 bg-white/[0.045] p-5 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">QR boutique</p>
            <h2 className="mt-2 text-xl font-black">Ta boutique est prête</h2>
            <p className="mt-2 text-xs font-semibold text-white/46">Scanne ou partage ce QR code pour ouvrir ta boutique.</p>
            <div className="mt-5">
              <QRPreview value={storeURL} logoURL={store.logoURL} />
            </div>
            <p className="mt-4 break-all text-[10px] font-bold text-white/45">{storeURL}</p>
          </div>
        </section>
      )}

      <section className="px-4 pt-5">
        <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/38">Actions rapides</p>
        <div className="grid grid-cols-3 gap-2">
          {dashboardActions.map((action) => (
            <Link key={action.label} to={action.route} className="min-h-[92px] rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-3 text-center active:scale-[0.98]">
              <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-[#15EA3E] text-black">
                <AfriZiaIcon name={action.icon} size={17} />
              </span>
              <span className="mt-2 block text-[9px] font-black leading-tight text-white/62">{action.label}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="px-4 pt-5">
        <div className="rounded-[1.7rem] border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black">Activité récente</h2>
            <Link to="/zandofy/products" className="text-[10px] font-black uppercase tracking-wider text-[#15EA3E]">Voir</Link>
          </div>
          <div className="mt-4 space-y-2">
            {recentProducts.length ? recentProducts.map((product) => (
              <Link key={product.id} to={getZandofyProductPath(product)} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-2">
                <img src={product.coverURL} alt="" className="h-12 w-12 rounded-xl object-cover" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-black">{product.title}</span>
                  <span className="mt-1 block text-[9px] font-bold text-white/38">{product.productKind === 'physical' ? 'Produit physique' : product.digitalType} - {product.collection}</span>
                </span>
              </Link>
            )) : (
              <Link to="/zandofy/products/new" className="block rounded-2xl border border-dashed border-white/14 p-4 text-center text-xs font-bold text-white/48">
                Aucun produit publié. Ajouter le premier.
              </Link>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

export function ZandofyAffiliationScreen() {
  const navigate = useNavigate();
  const { user } = useFirebaseAuth();
  const { ownerStore, products, loading } = useZandofyStore();
  const [status, setStatus] = useState('');

  const shareAffiliate = async (product: typeof products[number], level: 'direct' | 'indirect') => {
    if (!user) return;
    const productURL = `${window.location.origin}${getZandofyProductPath(product)}`;
    const url = new URL(productURL);
    url.searchParams.set('ref', user.uid);
    url.searchParams.set('level', level);
    try {
      const result = await shareLink({ title: `${product.title} - recommandation`, text: `Découvre ${product.title} sur AfriZia.`, url: url.toString() });
      setStatus(result === 'copied' ? 'Lien copié.' : 'Lien partagé.');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setStatus(error instanceof Error ? error.message : 'Partage impossible.');
    }
  };

  if (loading) return <main className="flex min-h-full items-center justify-center bg-[#030604] text-white">Chargement affiliation...</main>;
  if (!ownerStore) return <main className="flex min-h-full items-center justify-center bg-[#030604] text-white">Boutique introuvable.</main>;
  const affiliateProducts = products.filter((product) => product.affiliateEnabled);

  return (
    <main className="min-h-full overflow-y-auto bg-[#030604] pb-24 text-white scrollbar-hide">
      <header className="sticky top-0 z-20 flex items-center justify-between bg-[#030604]/90 px-4 pb-3 pt-4 backdrop-blur-xl">
        <button type="button" onClick={() => navigate('/zandofy/dashboard')} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]"><AfriZiaIcon name="arrow" size={16} className="rotate-180" /></button>
        <div className="text-center"><p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">Zandofy</p><h1 className="text-sm font-black">Affiliation</h1></div>
        <AfriZiaIcon name="share" size={19} className="text-[#15EA3E]" />
      </header>
      <ZandofyMenuBar />
      <section className="px-4 pt-4"><div className="rounded-[1.7rem] border border-sky-300/18 bg-sky-300/7 p-5"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-200">Recommandations</p><h2 className="mt-2 text-xl font-black">Tes liens directs et indirects</h2><p className="mt-2 text-xs font-semibold leading-relaxed text-white/48">Partage un produit et reçois la commission définie par le vendeur après un achat confirmé.</p></div></section>
      {status && <p className="mx-4 mt-4 rounded-2xl border border-[#15EA3E]/20 bg-[#15EA3E]/10 p-3 text-center text-xs font-bold text-[#15EA3E]">{status}</p>}
      <section className="space-y-3 px-4 pt-5">
        {affiliateProducts.length ? affiliateProducts.map((product) => (
          <article key={product.id} className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-3">
            <div className="flex items-center gap-3"><img src={product.coverURL} alt="" className="h-14 w-14 rounded-2xl object-cover" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{product.title}</p><p className="mt-1 text-[10px] font-bold text-white/42">Direct {product.affiliateDirectRate}% · Indirect {product.affiliateIndirectRate}%</p></div><Link to={getZandofyProductPath(product)} className="text-[9px] font-black uppercase text-[#15EA3E]">Voir</Link></div>
            <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => void shareAffiliate(product, 'direct')} className="rounded-xl border border-white/10 bg-black/20 py-2.5 text-[9px] font-black uppercase tracking-wider text-white/70">Lien direct</button><button type="button" onClick={() => void shareAffiliate(product, 'indirect')} className="rounded-xl bg-[#15EA3E] py-2.5 text-[9px] font-black uppercase tracking-wider text-black">Lien indirect</button></div>
          </article>
        )) : <div className="rounded-[1.4rem] border border-dashed border-white/14 p-6 text-center text-xs font-bold text-white/45">Active les recommandations sur un produit pour générer tes liens.</div>}
      </section>
    </main>
  );
}

export function ZandofyPromosScreen() {
  const navigate = useNavigate();
  const { ownerStore, products, loading } = useZandofyStore();
  const promos = products.filter((product) => product.salePrice !== undefined && product.salePrice < product.regularPrice);
  if (loading) return <main className="flex min-h-full items-center justify-center bg-[#030604] text-white">Chargement promos...</main>;
  if (!ownerStore) return <main className="flex min-h-full items-center justify-center bg-[#030604] text-white">Boutique introuvable.</main>;
  return (
    <main className="min-h-full overflow-y-auto bg-[#030604] pb-24 text-white scrollbar-hide">
      <header className="sticky top-0 z-20 flex items-center justify-between bg-[#030604]/90 px-4 pb-3 pt-4 backdrop-blur-xl"><button type="button" onClick={() => navigate('/zandofy/dashboard')} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]"><AfriZiaIcon name="arrow" size={16} className="rotate-180" /></button><div className="text-center"><p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">Zandofy</p><h1 className="text-sm font-black">Promos</h1></div><AfriZiaIcon name="signal" size={19} className="text-[#15EA3E]" /></header>
      <ZandofyMenuBar />
      <section className="grid grid-cols-2 gap-3 px-4 pt-5">{promos.map((product) => <Link key={product.id} to={getZandofyProductPath(product)} className="overflow-hidden rounded-[1.4rem] border border-white/10 bg-white/[0.04]"><img src={product.coverURL} alt={product.title} className="h-32 w-full object-cover" /><div className="p-3"><p className="line-clamp-2 text-xs font-black">{product.title}</p><p className="mt-2 text-sm font-black text-[#15EA3E]">{product.salePrice} {product.currency}</p><p className="text-[10px] font-bold text-white/35 line-through">{product.regularPrice} {product.currency}</p></div></Link>)}</section>
      {!promos.length && <p className="mx-4 mt-5 rounded-2xl border border-dashed border-white/14 p-6 text-center text-xs font-bold text-white/45">Aucune promotion active dans cette boutique.</p>}
    </main>
  );
}

export function ZandofyAboutScreen() {
  const navigate = useNavigate();
  return <main className="min-h-full overflow-y-auto bg-[#030604] pb-24 text-white"><header className="flex items-center justify-between px-4 pb-3 pt-4"><button type="button" onClick={() => navigate('/zandofy')} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]"><AfriZiaIcon name="arrow" size={16} className="rotate-180" /></button><div className="text-center"><p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">Zandofy</p><h1 className="text-sm font-black">À propos</h1></div><img src="/zandofyiconeapp.png" alt="" className="h-10 w-10 rounded-2xl object-cover" /></header><ZandofyMenuBar /><section className="px-4 pt-5"><div className="rounded-[2rem] border border-[#15EA3E]/18 bg-[#071007] p-5"><img src="/zandofyiconeapp.png" alt="Zandofy" className="h-16 w-16 rounded-2xl object-cover" /><h2 className="mt-5 text-2xl font-black">Une boutique à ton image.</h2><p className="mt-3 text-sm font-semibold leading-relaxed text-white/55">Zandofy permet de vendre des produits digitaux, physiques et des offres issues du sourcing ZikMart, avec AfriSpay, AfriChat, Safari et les recommandations.</p></div></section></main>;
}

export function ZandofyStatsScreen() {
  const navigate = useNavigate();
  const { ownerStore, products, loading } = useZandofyStore();
  const { orders, loadingOrders } = useZandofyOrders(ownerStore?.id, ownerStore?.ownerId);
  const [reviewCount, setReviewCount] = useState(0);
  const [analytics, setAnalytics] = useState<ZandofyAnalyticsSnapshot>({});
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year'>('week');

  useEffect(() => {
    if (!ownerStore?.id) {
      setReviewCount(0);
      return undefined;
    }
    const reviewsRef = ref(realtimeDb, `zandofyStoreReviews/${ownerStore.id}`);
    const unsubscribe = onValue(reviewsRef, (snapshot) => {
      const reviews = snapshot.val() as Record<string, unknown> | null;
      setReviewCount(Object.keys(reviews || {}).length);
    });
    return unsubscribe;
  }, [ownerStore?.id]);

  useEffect(() => {
    if (!ownerStore?.id) {
      setAnalytics({});
      return undefined;
    }
    const analyticsRef = ref(realtimeDb, `zandofyAnalytics/${ownerStore.id}`);
    const unsubscribe = onValue(analyticsRef, (snapshot) => {
      setAnalytics(snapshot.val() as ZandofyAnalyticsSnapshot | null || {});
    }, () => setAnalytics({}));
    return unsubscribe;
  }, [ownerStore?.id]);

  const stats = useMemo(() => {
    const paidOrdersList = orders.filter((order) => ['paid', 'preparing', 'delivering', 'completed'].includes(order.status) || order.paymentStatus === 'confirmed');
    const paidOrderStatuses = new Set(['paid', 'preparing', 'delivering', 'completed']);
    const periodDays = period === 'day' ? 1 : period === 'week' ? 7 : period === 'month' ? 30 : 365;
    const periodStart = Date.now() - (periodDays * 24 * 60 * 60 * 1000);
    const periodOrders = paidOrdersList.filter((order) => Number(order.createdAt || 0) >= periodStart);
    const periodDaily = (Object.entries(analytics.daily || {}) as Array<[string, NonNullable<ZandofyAnalyticsSnapshot['daily']>[string]]>)
      .filter(([day]) => {
        const date = new Date(`${day}T23:59:59`).getTime();
        return Number.isFinite(date) && date >= periodStart;
      })
      .sort(([first], [second]) => first.localeCompare(second));
    const uniqueVisitors = new Set<string>();
    Object.entries(analytics.visitors || {}).forEach(([day, visitors]) => {
      const date = new Date(`${day}T23:59:59`).getTime();
      if (!Number.isFinite(date) || date < periodStart) return;
      Object.keys(visitors || {}).forEach((visitorId) => uniqueVisitors.add(visitorId));
    });
    const clientsById = new Map<string, number>();
    paidOrdersList.forEach((order) => {
      if (order.buyerId) clientsById.set(order.buyerId, (clientsById.get(order.buyerId) || 0) + 1);
    });
    const recurrentClients = Array.from(clientsById.values()).filter((count) => count > 1).length;
    const revenue = paidOrdersList
      .filter((order) => ['paid', 'completed'].includes(order.status))
      .reduce((total, order) => total + Number(order.totalAmount || 0), 0);
    const netRevenue = paidOrdersList
      .filter((order) => ['paid', 'completed'].includes(order.status))
      .reduce((total, order) => total + Number(order.sellerNetAmount ?? order.totalAmount ?? 0), 0);
    const fppTotal = paidOrdersList
      .filter((order) => ['paid', 'completed'].includes(order.status))
      .reduce((total, order) => total + Number(order.fppAmount || 0), 0);
    const clients = new Set(orders.map((order) => order.buyerId).filter(Boolean)).size;
    const paidOrders = paidOrdersList.length;
    const inProgress = orders.filter((order) => ['paid', 'preparing', 'delivering'].includes(order.status)).length;
    const recentOrders = orders.filter((order) => Number(order.createdAt || 0) >= Date.now() - (7 * 24 * 60 * 60 * 1000)).length;
    const lowStock = products.filter((product) => product.productKind === 'physical' && product.stockMode === 'tracked' && Number(product.stock || 0) <= 3).length;
    const averageOrder = paidOrdersList.length ? revenue / paidOrdersList.length : 0;
    const topProducts = products
      .map((product) => ({
        product,
        orders: periodOrders.filter((order) => order.productId === product.id).length,
        revenue: periodOrders
          .filter((order) => order.productId === product.id && paidOrderStatuses.has(order.status))
          .reduce((total, order) => total + Number(order.sellerNetAmount ?? order.totalAmount ?? 0), 0)
      }))
      .sort((first, second) => second.revenue - first.revenue || second.orders - first.orders)
      .slice(0, 5);

    const periodRevenue = periodOrders.reduce((total, order) => total + Number(order.sellerNetAmount ?? order.totalAmount ?? 0), 0);
    const periodSales = periodOrders.length;
    const periodStoreViews = periodDaily.reduce((total, [, day]) => total + Number(day.storeViews || 0), 0);
    const periodProductViews = periodDaily.reduce((total, [, day]) => total + Number(day.productViews || 0), 0);
    const conversionRate = uniqueVisitors.size ? (periodSales / uniqueVisitors.size) * 100 : 0;
    const dimensions = analytics.dimensions || {};
    const topDimension = (values?: Record<string, number>) => Object.entries(values || {})
      .sort(([, first], [, second]) => Number(second || 0) - Number(first || 0))
      .slice(0, 5);

    return {
      revenue, netRevenue, fppTotal, clients, paidOrders, inProgress, recentOrders, lowStock, averageOrder, topProducts,
      periodDays, periodRevenue, periodSales, periodStoreViews, periodProductViews, conversionRate, recurrentClients,
      repeatRate: clients ? (recurrentClients / clients) * 100 : 0,
      devices: topDimension(dimensions.devices), countries: topDimension(dimensions.countries), cities: topDimension(dimensions.cities), sources: topDimension(dimensions.sources),
      uniqueVisitors: uniqueVisitors.size
    };
  }, [analytics, orders, period, products]);

  if (loading || loadingOrders) return <main className="flex min-h-full items-center justify-center bg-[#030604] text-white">Chargement statistiques...</main>;
  if (!ownerStore) return <main className="flex min-h-full items-center justify-center bg-[#030604] text-white">Boutique introuvable.</main>;

  return (
    <main className="min-h-full overflow-y-auto bg-[#030604] pb-24 text-white scrollbar-hide">
      <header className="sticky top-0 z-20 flex items-center justify-between bg-[#030604]/90 px-4 pb-3 pt-4 backdrop-blur-xl">
        <button type="button" onClick={() => navigate('/zandofy/dashboard')} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]">
          <AfriZiaIcon name="arrow" size={16} className="rotate-180" />
        </button>
        <div className="text-center">
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">Zandofy</p>
          <h1 className="text-sm font-black">Statistique</h1>
        </div>
        <AfriZiaIcon name="signal" size={20} className="text-[#15EA3E]" />
      </header>

      <section className="px-4 pt-5">
        <div className="rounded-[2rem] border border-[#15EA3E]/18 bg-[radial-gradient(circle_at_20%_10%,rgba(21,234,62,0.18),transparent_38%),#071007] p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">Performance boutique</p>
          <h2 className="mt-2 text-3xl font-black">{formatZandofyMoney(stats.netRevenue, ownerStore.currency)}</h2>
          <p className="mt-2 text-xs font-semibold text-white/48">Revenu vendeur après contribution FPP sur les commandes payées.</p>
        </div>
      </section>

      <section className="grid grid-cols-4 gap-2 px-4 pt-4">
        {[
          { label: 'Commandes', value: orders.length },
          { label: 'Payées', value: stats.paidOrders },
          { label: 'En cours', value: stats.inProgress },
          { label: 'Clients', value: stats.clients }
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.045] p-3 text-center">
            <p className="text-lg font-black text-[#15EA3E]">{item.value}</p>
            <p className="mt-1 text-[8px] font-black uppercase tracking-wider text-white/38">{item.label}</p>
          </div>
        ))}
      </section>

      <section className="px-4 pt-5">
        <div className="rounded-[1.7rem] border border-white/10 bg-white/[0.045] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#15EA3E]">Ventes avancées</p>
              <h2 className="mt-1 text-sm font-black">Performance par période</h2>
            </div>
            <span className="text-[10px] font-bold text-white/38">{stats.periodSales} vente(s)</span>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-1.5">
            {([
              ['day', "Aujourd'hui"],
              ['week', '7 jours'],
              ['month', '30 jours'],
              ['year', '12 mois']
            ] as const).map(([value, label]) => (
              <button key={value} type="button" onClick={() => setPeriod(value)} className={cn('rounded-xl px-2 py-2 text-[9px] font-black', period === value ? 'bg-[#15EA3E] text-black' : 'border border-white/10 bg-black/20 text-white/50')}>
                {label}
              </button>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-[#15EA3E]/16 bg-[#15EA3E]/8 p-3">
              <p className="text-[9px] font-black uppercase tracking-wider text-white/40">Revenu net</p>
              <p className="mt-2 text-lg font-black text-[#15EA3E]">{formatZandofyMoney(stats.periodRevenue, ownerStore.currency)}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <p className="text-[9px] font-black uppercase tracking-wider text-white/40">Visiteurs uniques</p>
              <p className="mt-2 text-lg font-black">{stats.uniqueVisitors}</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div><p className="text-sm font-black">{stats.periodStoreViews}</p><p className="text-[8px] font-bold text-white/35">Visites</p></div>
            <div><p className="text-sm font-black">{stats.periodProductViews}</p><p className="text-[8px] font-bold text-white/35">Produits vus</p></div>
            <div><p className="text-sm font-black text-[#15EA3E]">{stats.conversionRate.toFixed(1)}%</p><p className="text-[8px] font-bold text-white/35">Conversion</p></div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2 px-4 pt-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
          <p className="text-[9px] font-black uppercase tracking-wider text-white/38">Clients récurrents</p>
          <p className="mt-2 text-xl font-black text-[#15EA3E]">{stats.recurrentClients}</p>
          <p className="mt-1 text-[10px] font-semibold text-white/40">{stats.repeatRate.toFixed(1)}% de la clientèle</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
          <p className="text-[9px] font-black uppercase tracking-wider text-white/38">Panier moyen</p>
          <p className="mt-2 text-xl font-black">{formatZandofyMoney(stats.averageOrder, ownerStore.currency)}</p>
          <p className="mt-1 text-[10px] font-semibold text-white/40">Toutes les commandes confirmées</p>
        </div>
      </section>

      <section className="px-4 pt-5">
        <div className="rounded-[1.7rem] border border-white/10 bg-white/[0.045] p-4">
          <h2 className="text-sm font-black">Produits les plus performants</h2>
          <div className="mt-4 space-y-2">
            {stats.topProducts.length ? stats.topProducts.map(({ product, orders: productOrders, revenue }) => (
              <Link key={product.id} to={getZandofyProductPath(product)} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-2">
                <img src={product.coverURL} alt="" className="h-12 w-12 rounded-xl object-cover" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-black">{product.title}</span>
                  <span className="mt-1 block text-[9px] font-bold text-white/38">{productOrders} commande(s)</span>
                </span>
                <span className="text-[10px] font-black text-[#15EA3E]">{formatZandofyMoney(revenue, product.currency)}</span>
              </Link>
            )) : (
              <p className="rounded-2xl border border-dashed border-white/14 p-4 text-center text-xs font-bold text-white/44">Aucune vente Zandofy pour le moment.</p>
            )}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2 px-4 pt-4">
        <div className="rounded-2xl border border-[#FFD84D]/20 bg-[#FFD84D]/8 p-4">
          <p className="text-[9px] font-black uppercase tracking-wider text-[#FFD84D]">Réputation</p>
          <p className="mt-2 text-xl font-black">{Number(ownerStore.rating || 0).toFixed(1)} / 5</p>
          <p className="mt-1 text-[10px] font-semibold text-white/42">{reviewCount} avis client(s)</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
          <p className="text-[9px] font-black uppercase tracking-wider text-white/38">Cette semaine</p>
          <p className="mt-2 text-xl font-black text-[#15EA3E]">{stats.recentOrders}</p>
          <p className="mt-1 text-[10px] font-semibold text-white/42">commande(s) · panier moyen {formatZandofyMoney(stats.averageOrder, ownerStore.currency)}</p>
        </div>
      </section>

      <section className="px-4 pt-4">
        <div className="rounded-[1.5rem] border border-[#15EA3E]/14 bg-[#15EA3E]/6 p-4">
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-[9px] font-black uppercase tracking-wider text-[#15EA3E]">Impact FPP</p><p className="mt-1 text-xs font-semibold text-white/48">Total affecté aux projets sur les commandes confirmées.</p></div>
            <p className="text-lg font-black text-[#15EA3E]">{formatZandofyMoney(stats.fppTotal, ownerStore.currency)}</p>
          </div>
          {stats.lowStock > 0 && <p className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/8 px-3 py-2 text-[10px] font-bold text-amber-100">{stats.lowStock} produit(s) physique(s) bientôt en rupture.</p>}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2 px-4 pt-4">
        {[
          ['Appareils', stats.devices, 'Aucune visite enregistrée'],
          ['Pays', stats.countries, 'Aucun pays enregistré'],
          ['Villes', stats.cities, 'Aucune ville enregistrée'],
          ['Sources', stats.sources, 'Aucune source enregistrée']
        ].map(([title, values, empty]) => (
          <div key={title as string} className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
            <p className="text-[9px] font-black uppercase tracking-wider text-white/38">{title as string}</p>
            <div className="mt-3 space-y-2">
              {(values as Array<[string, number]>).length ? (values as Array<[string, number]>).slice(0, 3).map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-2 text-[10px]">
                  <span className="truncate font-bold text-white/60">{label}</span>
                  <span className="font-black text-[#15EA3E]">{value}</span>
                </div>
              )) : <p className="text-[10px] font-semibold text-white/35">{empty as string}</p>}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}

export function ZandofyClientsScreen() {
  const navigate = useNavigate();
  const { ownerStore, loading } = useZandofyStore();
  const { orders, loadingOrders } = useZandofyOrders(ownerStore?.id, ownerStore?.ownerId);

  const clients = useMemo(() => {
    const clientsMap = new Map<string, {
      id: string;
      name: string;
      avatar?: string;
      orders: number;
      spent: number;
      lastOrder?: number;
      products: Set<string>;
    }>();

    orders.forEach((order) => {
      const clientId = order.buyerId || 'unknown';
      const current = clientsMap.get(clientId) || {
        id: clientId,
        name: order.buyerName || 'Client Zandofy',
        avatar: order.buyerAvatar || '',
        orders: 0,
        spent: 0,
        lastOrder: 0,
        products: new Set<string>()
      };
      current.orders += 1;
      current.spent += Number(order.totalAmount || 0);
      current.lastOrder = Math.max(Number(current.lastOrder || 0), Number(order.createdAt || 0));
      if (order.productName) current.products.add(order.productName);
      clientsMap.set(clientId, current);
    });

    return Array.from(clientsMap.values()).sort((first, second) => Number(second.lastOrder || 0) - Number(first.lastOrder || 0));
  }, [orders]);

  if (loading || loadingOrders) return <main className="flex min-h-full items-center justify-center bg-[#030604] text-white">Chargement clients...</main>;
  if (!ownerStore) return <main className="flex min-h-full items-center justify-center bg-[#030604] text-white">Boutique introuvable.</main>;

  return (
    <main className="min-h-full overflow-y-auto bg-[#030604] pb-24 text-white scrollbar-hide">
      <header className="sticky top-0 z-20 flex items-center justify-between bg-[#030604]/90 px-4 pb-3 pt-4 backdrop-blur-xl">
        <button type="button" onClick={() => navigate('/zandofy/dashboard')} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]">
          <AfriZiaIcon name="arrow" size={16} className="rotate-180" />
        </button>
        <div className="text-center">
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">Zandofy</p>
          <h1 className="text-sm font-black">Mes clients</h1>
        </div>
        <AfriZiaIcon name="contact" size={20} className="text-[#15EA3E]" />
      </header>

      <section className="px-4 pt-5">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">Relation boutique</p>
          <h2 className="mt-2 text-2xl font-black">{clients.length} client(s)</h2>
          <p className="mt-2 text-xs font-semibold leading-relaxed text-white/48">Liste construite depuis les commandes et interactions réelles liées à ta boutique Zandofy.</p>
        </div>
      </section>

      <section className="space-y-3 px-4 pt-5">
        {clients.length ? clients.map((client) => (
          <article key={client.id} className="rounded-[1.45rem] border border-white/10 bg-white/[0.045] p-3">
            <div className="flex items-center gap-3">
              <img src={client.avatar || '/Logo-AfriZia-Super-App-icone.png'} alt="" className="h-12 w-12 rounded-2xl object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black">{client.name}</p>
                <p className="mt-1 text-[10px] font-bold text-white/40">{client.orders} commande(s) · {formatZandofyMoney(client.spent, ownerStore.currency)}</p>
              </div>
              <Link to={`/chat?contact=${encodeURIComponent(client.id)}&name=${encodeURIComponent(client.name)}`} className="rounded-xl bg-[#15EA3E] px-3 py-2 text-[9px] font-black uppercase tracking-wider text-black">
                Chat
              </Link>
            </div>
            <p className="mt-3 line-clamp-1 text-[10px] font-semibold text-white/42">{Array.from(client.products).join(', ')}</p>
          </article>
        )) : (
          <div className="rounded-[1.45rem] border border-dashed border-white/14 p-6 text-center">
            <AfriZiaIcon name="contact" size={28} className="mx-auto text-[#15EA3E]" />
            <p className="mt-3 text-sm font-black">Aucun client Zandofy</p>
            <p className="mt-2 text-xs font-semibold text-white/44">Les clients apparaîtront après commande ou interaction avec ta boutique.</p>
          </div>
        )}
      </section>
    </main>
  );
}

export function ZandofyCreateProductScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { marketProducts, zikMartProducts } = useAfriMarket();
  const { ownerStore, loading, createDigitalProduct } = useZandofyStore();
  const sourceProductId = new URLSearchParams(location.search).get('sourceProductId') || '';
  const sourceProduct = useMemo(() => {
    const routeState = location.state as { sourceProduct?: AfriMarketContent } | null;
    return routeState?.sourceProduct || [...zikMartProducts, ...marketProducts].find((product) => product.id === sourceProductId) || null;
  }, [location.state, marketProducts, sourceProductId, zikMartProducts]);
  const [step, setStep] = useState(0);
  const [productKind, setProductKind] = useState<'digital' | 'physical'>('digital');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [digitalType, setDigitalType] = useState<DigitalProductType | ''>('');
  const [collection, setCollection] = useState('Nouveautés');
  const [price, setPrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [pricingMode, setPricingMode] = useState<'paid' | 'free'>('paid');
  const [catalogCategory, setCatalogCategory] = useState('Digital');
  const [currency, setCurrency] = useState('USD');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState('/zandofy/woman-promoting-cloths-from-thrift-store.jpg');
  const [deliveryMode, setDeliveryMode] = useState<'file' | 'link' | 'shipping' | 'pickup'>('file');
  const [deliveryFile, setDeliveryFile] = useState<File | null>(null);
  const [deliveryFiles, setDeliveryFiles] = useState<File[]>([]);
  const [deliveryURL, setDeliveryURL] = useState('');
  const [accessNote, setAccessNote] = useState('Accès immédiat après paiement AfriSpay.');
  const [stockMode, setStockMode] = useState<'unlimited' | 'tracked'>('unlimited');
  const [stock, setStock] = useState('');
  const [fppRate, setFppRate] = useState('0');
  const [affiliateEnabled, setAffiliateEnabled] = useState(false);
  const [affiliateDirectRate, setAffiliateDirectRate] = useState('0');
  const [affiliateIndirectRate, setAffiliateIndirectRate] = useState('0');
  const [sourceMedia, setSourceMedia] = useState<ZandofyProductMedia[]>([]);
  const [sourceApplied, setSourceApplied] = useState(false);
  const [sku, setSku] = useState('');
  const [shippingPrice, setShippingPrice] = useState('');
  const [shippingRegions, setShippingRegions] = useState('RDC');
  const [publishToAfriZia, setPublishToAfriZia] = useState(true);
  const [publishToZikMart, setPublishToZikMart] = useState(false);
  const [supplierType, setSupplierType] = useState<'self' | 'supplier' | 'dropshipper'>('self');
  const [supplierId, setSupplierId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierSKU, setSupplierSKU] = useState('');
  const [supplierCost, setSupplierCost] = useState('');
  const [supplierLeadTimeDays, setSupplierLeadTimeDays] = useState('');
  const [dropshippingEnabled, setDropshippingEnabled] = useState(false);
  const [courseLevel, setCourseLevel] = useState('Débutant');
  const [courseDuration, setCourseDuration] = useState('');
  const [templateSoftware, setTemplateSoftware] = useState('');
  const [licenseDuration, setLicenseDuration] = useState('12 mois');
  const [licenseSeats, setLicenseSeats] = useState('1');
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventPlace, setEventPlace] = useState('');
  const [ticketType, setTicketType] = useState('Standard');
  const [ticketPrefix, setTicketPrefix] = useState('ZDY');
  const [status, setStatus] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const selectedDigitalConfig = digitalType ? digitalTypeConfig[digitalType] : digitalTypeConfig.Formation;

  useEffect(() => {
    if (!ownerStore?.id || !sourceProduct || !draftHydrated || sourceApplied) return;
    const media = (sourceProduct.media.length ? sourceProduct.media : [{
      id: `${sourceProduct.id}_cover`,
      mediaUrl: sourceProduct.coverURL,
      secureUrl: sourceProduct.coverURL,
      publicId: '',
      resourceType: 'image' as const,
      provider: 'cloudinary' as const
    }]).map((item, index) => ({
      id: item.id || `${sourceProduct.id}_source_${index}`,
      mediaUrl: item.mediaUrl || item.secureUrl || '',
      secureUrl: item.secureUrl || item.mediaUrl || '',
      publicId: item.publicId || '',
      resourceType: item.resourceType || 'image',
      provider: item.provider || 'cloudinary'
    })).filter((item) => item.secureUrl);
    const sourcePrice = Number(sourceProduct.price || sourceProduct.villagePrice || 0);
    const suggestedPrice = sourcePrice > 0 ? (Math.ceil(sourcePrice * 1.2 * 100) / 100).toString() : '';
    setProductKind('physical');
    setDigitalType('');
    setTitle(sourceProduct.title);
    setDescription(sourceProduct.description);
    setCatalogCategory(sourceProduct.catalogCategory || sourceProduct.category || 'Autres');
    setPrice(suggestedPrice);
    setSalePrice('');
    setPricingMode('paid');
    setCurrency(sourceProduct.currency || 'USD');
    setCoverFile(null);
    setCoverPreview(sourceProduct.coverURL || media[0]?.secureUrl || '/afrimarket.jpeg');
    setSourceMedia(media);
    setDeliveryMode('shipping');
    setStockMode('unlimited');
    setStock('');
    setSupplierType('dropshipper');
    setSupplierId(sourceProduct.authorId);
    setSupplierName(sourceProduct.authorName);
    setSupplierSKU(sourceProduct.sku || '');
    setSupplierCost(sourcePrice > 0 ? sourcePrice.toString() : '');
    setSupplierLeadTimeDays(sourceProduct.supplierLeadTimeDays?.toString() || '');
    setDropshippingEnabled(true);
    setPublishToZikMart(false);
    setStep(1);
    setStatus('Produit ZikMart repris. Ajuste ton prix et ta marge avant de publier.');
    setSourceApplied(true);
  }, [draftHydrated, ownerStore?.id, sourceApplied, sourceProduct]);

  useEffect(() => {
    if (!ownerStore?.id) return;
    const rawDraft = window.localStorage.getItem(zandofyProductDraftKey(ownerStore.id));
    if (!rawDraft) {
      setDraftHydrated(true);
      return;
    }

    try {
      const draft = JSON.parse(rawDraft) as Partial<{
        step: number;
        productKind: 'digital' | 'physical';
        title: string;
        description: string;
        digitalType: DigitalProductType;
        collection: string;
        price: string;
        salePrice: string;
        pricingMode: 'paid' | 'free';
        catalogCategory: string;
        currency: string;
        coverPreview: string;
        deliveryMode: 'file' | 'link' | 'shipping' | 'pickup';
        deliveryURL: string;
        accessNote: string;
        stockMode: 'unlimited' | 'tracked';
        stock: string;
        fppRate: string;
        affiliateEnabled: boolean;
        affiliateDirectRate: string;
        affiliateIndirectRate: string;
        sku: string;
        shippingPrice: string;
        shippingRegions: string;
        publishToAfriZia: boolean;
        publishToZikMart: boolean;
        supplierType: 'self' | 'supplier' | 'dropshipper';
        supplierId: string;
        supplierName: string;
        supplierSKU: string;
        supplierCost: string;
        supplierLeadTimeDays: string;
        dropshippingEnabled: boolean;
        courseLevel: string;
        courseDuration: string;
        templateSoftware: string;
        licenseDuration: string;
        licenseSeats: string;
        eventName: string;
        eventDate: string;
        eventPlace: string;
        ticketType: string;
        ticketPrefix: string;
        deliveryFileNames: string[];
      }>;
      setStep(Math.min(Math.max(Number(draft.step || 0), 0), 3));
      setProductKind(draft.productKind || 'digital');
      setTitle(draft.title || '');
      setDescription(draft.description || '');
      setDigitalType(draft.digitalType || '');
      setCollection(draft.collection || 'Nouveautés');
      setPrice(draft.price || '');
      setSalePrice(draft.salePrice || '');
      setPricingMode(draft.pricingMode || 'paid');
      setCatalogCategory(draft.catalogCategory || (draft.productKind === 'physical' ? 'Autres' : 'Digital'));
      setCurrency(draft.currency || 'USD');
      if (draft.coverPreview && !draft.coverPreview.startsWith('blob:')) setCoverPreview(draft.coverPreview);
      setDeliveryMode(draft.deliveryMode || 'file');
      setDeliveryURL(draft.deliveryURL || '');
      setAccessNote(draft.accessNote || 'Accès immédiat après paiement AfriSpay.');
      setStockMode(draft.stockMode || (draft.productKind === 'physical' ? 'tracked' : 'unlimited'));
      setStock(draft.stock || '');
      setFppRate(draft.fppRate || '0');
      setAffiliateEnabled(draft.affiliateEnabled === true);
      setAffiliateDirectRate(draft.affiliateDirectRate || '0');
      setAffiliateIndirectRate(draft.affiliateIndirectRate || '0');
      setSku(draft.sku || '');
      setShippingPrice(draft.shippingPrice || '');
      setShippingRegions(draft.shippingRegions || 'RDC');
      setPublishToAfriZia(draft.publishToAfriZia !== false);
      setPublishToZikMart(draft.publishToZikMart === true);
      setSupplierType(draft.supplierType || 'self');
      setSupplierId(draft.supplierId || '');
      setSupplierName(draft.supplierName || '');
      setSupplierSKU(draft.supplierSKU || '');
      setSupplierCost(draft.supplierCost || '');
      setSupplierLeadTimeDays(draft.supplierLeadTimeDays || '');
      setDropshippingEnabled(draft.dropshippingEnabled === true);
      setCourseLevel(draft.courseLevel || 'Débutant');
      setCourseDuration(draft.courseDuration || '');
      setTemplateSoftware(draft.templateSoftware || '');
      setLicenseDuration(draft.licenseDuration || '12 mois');
      setLicenseSeats(draft.licenseSeats || '1');
      setEventName(draft.eventName || '');
      setEventDate(draft.eventDate || '');
      setEventPlace(draft.eventPlace || '');
      setTicketType(draft.ticketType || 'Standard');
      setTicketPrefix(draft.ticketPrefix || 'ZDY');
      if (draft.deliveryFileNames?.length) {
        setStatus(`Brouillon restauré. Réimporte ${draft.deliveryFileNames.length} fichier(s) avant de publier.`);
      } else {
        setStatus('Brouillon Zandofy restauré.');
      }
    } catch (error) {
      console.warn('Brouillon Zandofy illisible:', error);
    } finally {
      setDraftHydrated(true);
    }
  }, [ownerStore?.id]);

  useEffect(() => {
    if (!ownerStore?.id || !draftHydrated) return;
    const draft = {
      step,
      productKind,
      title,
      description,
      digitalType,
      collection,
      price,
      salePrice,
      pricingMode,
      catalogCategory,
      currency,
      coverPreview: coverPreview.startsWith('blob:') ? '' : coverPreview,
      deliveryMode,
      deliveryURL,
      accessNote,
      stockMode,
      stock,
      fppRate,
      affiliateEnabled,
      affiliateDirectRate,
      affiliateIndirectRate,
      sku,
      shippingPrice,
      shippingRegions,
      publishToAfriZia,
      publishToZikMart,
      supplierType,
      supplierId,
      supplierName,
      supplierSKU,
      supplierCost,
      supplierLeadTimeDays,
      dropshippingEnabled,
      courseLevel,
      courseDuration,
      templateSoftware,
      licenseDuration,
      licenseSeats,
      eventName,
      eventDate,
      eventPlace,
      ticketType,
      ticketPrefix,
      coverFileName: coverFile?.name || '',
      deliveryFileNames: deliveryFiles.map((file) => file.name)
    };
    window.localStorage.setItem(zandofyProductDraftKey(ownerStore.id), JSON.stringify(draft));
  }, [
    accessNote,
    catalogCategory,
    collection,
    courseDuration,
    courseLevel,
    coverFile?.name,
    coverPreview,
    currency,
    deliveryFiles,
    deliveryMode,
    deliveryURL,
    description,
    digitalType,
    draftHydrated,
    eventDate,
    eventName,
    eventPlace,
    licenseDuration,
    licenseSeats,
    ownerStore?.id,
    price,
    productKind,
    publishToAfriZia,
    publishToZikMart,
    supplierType,
    supplierId,
    supplierName,
    supplierSKU,
    supplierCost,
    supplierLeadTimeDays,
    dropshippingEnabled,
    salePrice,
    shippingPrice,
    shippingRegions,
    sku,
    stock,
    stockMode,
    fppRate,
    affiliateEnabled,
    affiliateDirectRate,
    affiliateIndirectRate,
    step,
    templateSoftware,
    ticketPrefix,
    ticketType,
    title
  ]);

  if (loading) return <main className="flex min-h-full items-center justify-center bg-[#030604] text-white">Chargement Zandofy...</main>;
  if (!ownerStore) {
    return (
      <main className="flex min-h-full flex-col justify-center bg-[#030604] p-5 text-center text-white">
        <img src="/zandofyiconeapp.png" alt="" className="mx-auto h-20 w-20 rounded-[1.5rem] object-cover" />
        <h1 className="mt-5 text-2xl font-black">Crée d’abord ta boutique</h1>
        <p className="mt-2 text-sm font-semibold text-white/48">Les produits Zandofy doivent être liés à une boutique.</p>
        <Link to="/zandofy/create" className="mt-5 rounded-2xl bg-[#15EA3E] px-5 py-3 text-xs font-black uppercase tracking-wider text-black">Créer boutique</Link>
      </main>
    );
  }

  const canContinue = step === 0
    ? productKind === 'physical' || Boolean(digitalType)
    : step === 1
          ? title.trim().length >= 3 && description.trim().length >= 12 && Boolean(coverFile || sourceMedia.length) &&
        (pricingMode === 'free' || Number(price) > 0) &&
        (productKind === 'digital' || stockMode === 'unlimited' || (stock.trim() !== '' && Number(stock) >= 0)) &&
        (!publishToZikMart || supplierCost.trim() !== '')
      : step === 2
        ? productKind === 'physical'
          ? deliveryMode === 'pickup' || (deliveryMode === 'shipping' && shippingRegions.trim().length > 0)
          : digitalType === 'Billet'
          ? Boolean(eventName.trim() && eventDate && eventPlace.trim() && ticketType.trim())
          : deliveryMode === 'file' ? Boolean(deliveryFiles.length || deliveryFile) : Boolean(deliveryURL.trim())
        : true;

  const handleCover = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setCoverFile(file);
    if (file) setCoverPreview(URL.createObjectURL(file));
  };

  const handleDeliveryFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setDeliveryFiles((current) => {
      const nextFiles = selectedDigitalConfig.multiple ? [...current, ...files] : files.slice(0, 1);
      return Array.from(new Map(nextFiles.map((file) => [`${file.name}:${file.size}:${file.lastModified}`, file])).values());
    });
    setDeliveryFile(files[0] || null);
    event.target.value = '';
  };

  const removeDeliveryFile = (fileToRemove: File) => {
    setDeliveryFiles((current) => current.filter((file) => file !== fileToRemove));
    setDeliveryFile((current) => current === fileToRemove ? null : current);
  };

  const selectDigitalType = (nextType: DigitalProductType) => {
    setProductKind('digital');
    setDigitalType(nextType);
    const config = digitalTypeConfig[nextType];
    setDeliveryMode(nextType === 'Licence' ? 'link' : 'file');
    setAccessNote(config.deliveryNote);
    setDeliveryFile(null);
    setDeliveryFiles([]);
    setDeliveryURL('');
    setStep(1);
  };

  const selectProductKind = (nextKind: 'digital' | 'physical') => {
    setProductKind(nextKind);
    setDigitalType('');
    setCatalogCategory(nextKind === 'physical' ? 'Autres' : 'Digital');
    setDeliveryMode(nextKind === 'physical' ? 'shipping' : 'file');
    setStockMode(nextKind === 'physical' ? 'tracked' : 'unlimited');
    setStep(nextKind === 'physical' ? 1 : 0);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (step < 3) {
      if (!canContinue) {
        if (step === 0) setStatus('Choisis le type de produit.');
        if (step === 1) setStatus('Ajoute le nom, la description, le prix, la couverture et le stock si nécessaire.');
        if (step === 2) setStatus(productKind === 'physical' ? 'Choisis le mode de livraison et complète les zones desservies.' : digitalType === 'Billet' ? 'Complète les informations du billet.' : 'Ajoute le fichier ou le lien de livraison.');
        return;
      }
      setStatus('');
      if (canContinue) setStep((current) => current + 1);
      return;
    }

    setPublishing(true);
    setStatus('');
    try {
      await createDigitalProduct({
        productKind,
        title,
        description,
        digitalType: digitalType || 'Formation',
        collection,
        price: pricingMode === 'free' ? 0 : Number(salePrice || price),
        regularPrice: Number(price || 0),
        salePrice: salePrice ? Number(salePrice) : undefined,
        pricingMode,
        currency,
        catalogCategory,
        coverFile,
        sourceProductId: sourceProduct?.id,
        sourceProductURL: sourceProduct ? getSourceProductURL(sourceProduct) : undefined,
        sourceMarketplace: sourceProduct ? 'zikmart' : undefined,
        sourceSellerId: sourceProduct?.authorId,
        sourceSellerName: sourceProduct?.authorName,
        sourcePrice: sourceProduct ? Number(sourceProduct.price || sourceProduct.villagePrice || 0) : undefined,
        sourceMedia,
        deliveryMode,
        deliveryFile,
        deliveryFiles,
        deliveryURL,
        accessNote,
        stockMode,
        stock: stockMode === 'tracked' ? Number(stock) : undefined,
        fppRate: Number(fppRate || 0),
        affiliateEnabled,
        affiliateDirectRate: Number(affiliateDirectRate || 0),
        affiliateIndirectRate: Number(affiliateIndirectRate || 0),
        sku,
        shippingPrice: Number(shippingPrice || 0),
        shippingRegions: shippingRegions.split(',').map((region) => region.trim()).filter(Boolean),
        publishToAfriZia,
        publishToZikMart,
        supplierType,
        supplierId,
        supplierName,
        supplierSKU,
        supplierCost: Number(supplierCost || 0),
        supplierLeadTimeDays: Number(supplierLeadTimeDays || 0),
        dropshippingEnabled,
        onUploadProgress: (completed, total) => setStatus(`Envoi du fichier ${completed}/${total}...`),
        productSpec: {
          courseLevel,
          courseDuration,
          templateSoftware,
          licenseDuration,
          licenseSeats,
          eventName,
          eventDate,
          eventPlace,
          ticketType,
          ticketPrefix
        }
      });
      window.localStorage.removeItem(zandofyProductDraftKey(ownerStore.id));
      navigate('/zandofy/dashboard');
    } catch (error) {
      console.error('Produit Zandofy impossible:', error);
      setStatus(error instanceof Error ? error.message : 'Publication impossible.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <main className="min-h-full overflow-y-auto bg-[#030604] pb-24 text-white scrollbar-hide">
      <header className="sticky top-0 z-20 flex items-center justify-between bg-[#030604]/90 px-4 pb-3 pt-4 backdrop-blur-xl">
        <button type="button" onClick={() => step ? setStep(step - 1) : navigate(-1)} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]">
          <AfriZiaIcon name="arrow" size={16} className="rotate-180" />
        </button>
        <div className="text-center">
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">Zandofy Studio</p>
          <h1 className="text-sm font-black">Nouveau produit</h1>
        </div>
        <img src={ownerStore.logoURL} alt="" className="h-10 w-10 rounded-2xl object-cover" />
      </header>

      <form onSubmit={submit} className="px-4 pt-4">
        <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-white/8">
          <div className="h-full rounded-full bg-[#15EA3E] transition-all" style={{ width: `${((step + 1) / 4) * 100}%` }} />
        </div>

        {step === 0 && (
          <section className="rounded-[2rem] border border-[#15EA3E]/16 bg-[#071007] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">Type de produit</p>
            <h2 className="mt-2 text-2xl font-black leading-tight">Que veux-tu vendre ?</h2>
            <p className="mt-2 text-xs font-semibold leading-relaxed text-white/45">Le parcours s’adapte au catalogue que tu veux construire.</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {[
                ['digital', 'Produit digital', 'Fichiers, formations, licences et billets.', 'file'],
                ['physical', 'Produit physique', 'Stock, retrait ou expédition.', 'market']
              ].map(([value, label, hint, icon]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => selectProductKind(value as 'digital' | 'physical')}
                  className={cn('rounded-2xl border p-3 text-left active:scale-[0.98]', productKind === value ? 'border-[#15EA3E] bg-[#15EA3E]/12' : 'border-white/10 bg-black/22')}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#15EA3E] text-black"><AfriZiaIcon name={icon as AfriZiaIconName} size={15} /></span>
                  <span className="mt-2 block text-xs font-black text-white">{label}</span>
                  <span className="mt-1 block text-[9px] font-semibold leading-tight text-white/42">{hint}</span>
                </button>
              ))}
            </div>
            {productKind === 'digital' && (
              <>
                <p className="mt-6 text-[10px] font-black uppercase tracking-[0.18em] text-white/38">Format digital</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {digitalTypes.map((item) => {
                    const config = digitalTypeConfig[item];
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => selectDigitalType(item)}
                        className={cn('rounded-2xl border p-3 text-left active:scale-[0.98]', digitalType === item ? 'border-[#15EA3E] bg-[#15EA3E]/12' : 'border-white/10 bg-black/22')}
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#15EA3E] text-black"><AfriZiaIcon name={config.icon} size={15} /></span>
                        <span className="mt-2 block text-xs font-black text-white">{config.label}</span>
                        <span className="mt-1 block text-[9px] font-semibold leading-tight text-white/42">{config.hint}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        )}

        {step === 1 && (
          <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">{productKind === 'physical' ? 'Produit physique' : selectedDigitalConfig.label}</p>
            <h2 className="mt-2 text-2xl font-black leading-tight">Présente et valorise</h2>
            {sourceProduct && (
              <div className="mt-4 rounded-2xl border border-sky-300/20 bg-sky-300/8 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-300 text-black">
                    <AfriZiaIcon name="share" size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-sky-200">Produit source ZikMart</p>
                    <p className="mt-1 truncate text-xs font-black text-white">{sourceProduct.title}</p>
                    <p className="mt-1 truncate text-[10px] font-semibold text-white/45">{sourceProduct.authorName} · coût {formatZandofyMoney(Number(sourceProduct.price || sourceProduct.villagePrice || 0), sourceProduct.currency)}</p>
                  </div>
                </div>
                {sourceMedia.length > 1 && <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-hide">
                  {sourceMedia.map((media) => <img key={media.id} src={media.secureUrl || media.mediaUrl} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />)}
                </div>}
              </div>
            )}
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={`Nom ${productKind === 'physical' ? 'du produit' : selectedDigitalConfig.label.toLowerCase()}`} className="mt-5 w-full rounded-2xl border border-white/10 bg-black/28 px-4 py-4 text-sm font-bold outline-none focus:border-[#15EA3E]/45" />
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} placeholder="Ce que l’acheteur reçoit, le résultat attendu, le niveau..." className="mt-3 w-full resize-none rounded-2xl border border-white/10 bg-black/28 px-4 py-4 text-sm font-bold outline-none focus:border-[#15EA3E]/45" />
            <input value={collection} onChange={(event) => setCollection(event.target.value)} placeholder="Collection" className="mt-3 w-full rounded-2xl border border-white/10 bg-black/28 px-4 py-4 text-sm font-bold outline-none" />
            <input value={catalogCategory} onChange={(event) => setCatalogCategory(event.target.value)} placeholder="Catégorie du catalogue" className="mt-3 w-full rounded-2xl border border-white/10 bg-black/28 px-4 py-4 text-sm font-bold outline-none" />
            <label className="mt-5 block overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/28">
              <img src={coverPreview} alt="" className="h-40 w-full object-cover" />
              <span className="flex items-center justify-between px-4 py-3 text-xs font-black text-white/62">
                Couverture du produit obligatoire
                <AfriZiaIcon name="gallery" size={16} className="text-[#15EA3E]" />
              </span>
              <input type="file" accept="image/*" className="hidden" onChange={handleCover} />
            </label>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[
                ['paid', 'Payant'],
                ['free', 'Gratuit']
              ].map(([value, label]) => (
                <button key={value} type="button" onClick={() => { setPricingMode(value as 'paid' | 'free'); if (value === 'free') setSalePrice(''); }} className={cn('rounded-2xl border py-3 text-xs font-black', pricingMode === value ? 'border-[#15EA3E] bg-[#15EA3E] text-black' : 'border-white/10 bg-black/28 text-white/60')}>{label}</button>
              ))}
            </div>
            {pricingMode === 'paid' && <div className="mt-2 grid grid-cols-[1fr_1fr_92px] gap-2">
              <input value={price} onChange={(event) => setPrice(event.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder="Prix normal" className="rounded-2xl border border-white/10 bg-black/28 px-3 py-4 text-sm font-bold outline-none" />
              <input value={salePrice} onChange={(event) => setSalePrice(event.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder="Promo (optionnel)" className="rounded-2xl border border-white/10 bg-black/28 px-3 py-4 text-sm font-bold outline-none" />
              <select value={currency} onChange={(event) => setCurrency(event.target.value)} className="rounded-2xl border border-white/10 bg-black/40 px-3 py-4 text-xs font-bold outline-none">
                <option>USD</option>
                <option>CDF</option>
                <option>EUR</option>
              </select>
            </div>}
            {pricingMode === 'free' && <p className="mt-3 rounded-2xl bg-[#15EA3E]/10 px-3 py-2 text-[10px] font-bold text-[#9dffaf]">Produit gratuit, sans paiement à l’accès.</p>}
            {productKind === 'physical' && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/18 p-3">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['tracked', 'Stock suivi'],
                    ['unlimited', 'Stock illimité']
                  ].map(([value, label]) => <button key={value} type="button" onClick={() => setStockMode(value as 'unlimited' | 'tracked')} className={cn('rounded-xl border py-2 text-[10px] font-black', stockMode === value ? 'border-[#15EA3E] bg-[#15EA3E] text-black' : 'border-white/10 text-white/55')}>{label}</button>)}
                </div>
                {stockMode === 'tracked' && <input value={stock} onChange={(event) => setStock(event.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="Quantité disponible" className="mt-2 w-full rounded-xl border border-white/10 bg-black/28 px-3 py-3 text-xs font-bold outline-none" />}
                <input value={sku} onChange={(event) => setSku(event.target.value.toUpperCase())} placeholder="Référence SKU (optionnel)" className="mt-2 w-full rounded-xl border border-white/10 bg-black/28 px-3 py-3 text-xs font-bold outline-none" />
              </div>
            )}
            <div className="mt-4 rounded-2xl border border-[#15EA3E]/14 bg-[#15EA3E]/6 p-3">
              <div className="flex items-center justify-between gap-3">
                <div><p className="text-xs font-black">Contribution FPP</p><p className="mt-1 text-[10px] font-semibold text-white/42">Part volontaire de chaque vente pour les projets FPP.</p></div>
                <select value={fppRate} onChange={(event) => setFppRate(event.target.value)} className="rounded-xl border border-white/10 bg-black/45 px-2 py-2 text-xs font-black outline-none"><option value="0">0 %</option><option value="1">1 %</option><option value="3">3 %</option><option value="5">5 %</option><option value="10">10 %</option></select>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-sky-300/18 bg-sky-300/6 p-3">
              <label className="flex items-center gap-3">
                <input type="checkbox" checked={affiliateEnabled} onChange={(event) => setAffiliateEnabled(event.target.checked)} className="h-4 w-4 accent-[#15EA3E]" />
                <span><span className="block text-xs font-black">Activer les recommandations</span><span className="mt-1 block text-[10px] font-semibold text-white/42">Permets à d’autres personnes de partager ton produit avec une commission définie par toi.</span></span>
              </label>
              {affiliateEnabled && <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="text-[9px] font-black uppercase tracking-wider text-white/42">Lien direct
                  <input value={affiliateDirectRate} onChange={(event) => setAffiliateDirectRate(event.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder="% commission" className="mt-1 w-full rounded-xl border border-white/10 bg-black/28 px-3 py-3 text-xs font-bold normal-case tracking-normal text-white outline-none" />
                </label>
                <label className="text-[9px] font-black uppercase tracking-wider text-white/42">Lien indirect
                  <input value={affiliateIndirectRate} onChange={(event) => setAffiliateIndirectRate(event.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder="% commission" className="mt-1 w-full rounded-xl border border-white/10 bg-black/28 px-3 py-3 text-xs font-bold normal-case tracking-normal text-white outline-none" />
                </label>
              </div>}
            </div>
            <label className="mt-4 flex items-center gap-3 rounded-2xl border border-[#15EA3E]/18 bg-[#15EA3E]/8 p-3">
              <input type="checkbox" checked={publishToAfriZia} onChange={(event) => setPublishToAfriZia(event.target.checked)} className="h-4 w-4 accent-[#15EA3E]" />
              <span><span className="block text-xs font-black">Afficher aussi dans AfriZia</span><span className="mt-1 block text-[10px] font-semibold text-white/42">Désactive pour garder le produit uniquement dans ta boutique.</span></span>
            </label>
            {productKind === 'physical' && (
              <div className="mt-4 rounded-2xl border border-sky-300/18 bg-sky-300/6 p-3">
                <p className="text-xs font-black">ZikMart et approvisionnement</p>
                <p className="mt-1 text-[10px] font-semibold leading-relaxed text-white/42">Publie volontairement ce produit physique dans la marketplace de sourcing et calcule ta marge.</p>
                <label className="mt-3 flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3">
                  <input type="checkbox" checked={publishToZikMart} onChange={(event) => setPublishToZikMart(event.target.checked)} className="h-4 w-4 accent-[#15EA3E]" />
                  <span className="text-[10px] font-black">Publier dans ZikMart</span>
                </label>
                {publishToZikMart && <div className="mt-3 space-y-2">
                  <select value={supplierType} onChange={(event) => setSupplierType(event.target.value as 'self' | 'supplier' | 'dropshipper')} className="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-3 text-xs font-black outline-none">
                    <option value="self">Mon propre stock</option>
                    <option value="supplier">Fournisseur partenaire</option>
                    <option value="dropshipper">Dropshipping</option>
                  </select>
                  {supplierType !== 'self' && <>
                    <input value={supplierName} onChange={(event) => setSupplierName(event.target.value)} placeholder="Nom du fournisseur" className="w-full rounded-xl border border-white/10 bg-black/28 px-3 py-3 text-xs font-bold outline-none" />
                    <div className="grid grid-cols-2 gap-2">
                      <input value={supplierId} onChange={(event) => setSupplierId(event.target.value)} placeholder="Référence fournisseur" className="rounded-xl border border-white/10 bg-black/28 px-3 py-3 text-xs font-bold outline-none" />
                      <input value={supplierSKU} onChange={(event) => setSupplierSKU(event.target.value)} placeholder="SKU fournisseur" className="rounded-xl border border-white/10 bg-black/28 px-3 py-3 text-xs font-bold outline-none" />
                    </div>
                  </>}
                  <div className="grid grid-cols-2 gap-2">
                    <input value={supplierCost} onChange={(event) => setSupplierCost(event.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder="Coût réel" className="rounded-xl border border-white/10 bg-black/28 px-3 py-3 text-xs font-bold outline-none" />
                    <input value={supplierLeadTimeDays} onChange={(event) => setSupplierLeadTimeDays(event.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="Délai en jours" className="rounded-xl border border-white/10 bg-black/28 px-3 py-3 text-xs font-bold outline-none" />
                  </div>
                  {supplierType === 'dropshipper' && <p className="rounded-xl bg-sky-300/10 px-3 py-2 text-[10px] font-bold text-sky-100">La commande sera transmise au fournisseur après paiement, avec suivi du délai annoncé.</p>}
                </div>}
              </div>
            )}
          </section>
        )}

        {step === 2 && (
          <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">{productKind === 'physical' ? 'Livraison physique' : 'Livraison digitale'}</p>
            <h2 className="mt-2 text-2xl font-black leading-tight">{productKind === 'physical' ? 'Comment le client reçoit son produit ?' : selectedDigitalConfig.label}</h2>
            <p className="mt-2 text-xs font-semibold leading-relaxed text-white/45">{productKind === 'physical' ? 'Définis le retrait ou les zones d’expédition et leurs frais.' : selectedDigitalConfig.deliveryNote}</p>

            {productKind === 'physical' ? (
              <div className="mt-5 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['shipping', 'Expédition'],
                    ['pickup', 'Retrait']
                  ].map(([value, label]) => <button key={value} type="button" onClick={() => setDeliveryMode(value as 'shipping' | 'pickup')} className={cn('rounded-2xl border py-3 text-xs font-black', deliveryMode === value ? 'border-[#15EA3E] bg-[#15EA3E] text-black' : 'border-white/10 bg-black/28 text-white/60')}>{label}</button>)}
                </div>
                {deliveryMode === 'shipping' && (
                  <>
                    <input value={shippingRegions} onChange={(event) => setShippingRegions(event.target.value)} placeholder="Pays ou villes desservis, séparés par des virgules" className="w-full rounded-2xl border border-white/10 bg-black/28 px-4 py-4 text-sm font-bold outline-none" />
                    <input value={shippingPrice} onChange={(event) => setShippingPrice(event.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder="Frais d’expédition" className="w-full rounded-2xl border border-white/10 bg-black/28 px-4 py-4 text-sm font-bold outline-none" />
                  </>
                )}
                {deliveryMode === 'pickup' && <p className="rounded-2xl bg-[#15EA3E]/10 px-3 py-3 text-xs font-bold text-[#9dffaf]">Le client choisira le point de retrait avec le vendeur après la commande.</p>}
              </div>
            ) : digitalType === 'Billet' ? (
              <div className="mt-5 space-y-3">
                <input value={eventName} onChange={(event) => setEventName(event.target.value)} placeholder="Nom de l’événement" className="w-full rounded-2xl border border-white/10 bg-black/28 px-4 py-4 text-sm font-bold outline-none" />
                <div className="grid grid-cols-2 gap-2">
                  <input type="datetime-local" value={eventDate} onChange={(event) => setEventDate(event.target.value)} className="rounded-2xl border border-white/10 bg-black/28 px-3 py-4 text-xs font-bold outline-none" />
                  <input value={ticketType} onChange={(event) => setTicketType(event.target.value)} placeholder="Type billet" className="rounded-2xl border border-white/10 bg-black/28 px-3 py-4 text-xs font-bold outline-none" />
                </div>
                <input value={eventPlace} onChange={(event) => setEventPlace(event.target.value)} placeholder="Lieu ou accès en ligne" className="w-full rounded-2xl border border-white/10 bg-black/28 px-4 py-4 text-sm font-bold outline-none" />
                <input value={ticketPrefix} onChange={(event) => setTicketPrefix(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5))} placeholder="Préfixe référence" className="w-full rounded-2xl border border-white/10 bg-black/28 px-4 py-4 text-sm font-bold outline-none" />
                <TicketPreview title={eventName || title || 'Événement Zandofy'} date={eventDate} place={eventPlace || 'Lieu à confirmer'} ticketType={ticketType} prefix={ticketPrefix || 'ZDY'} storeLogo={ownerStore.logoURL} />
              </div>
            ) : (
              <>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  {[
                    ['file', 'Fichier'],
                    ['link', 'Lien privé']
                  ].map(([value, label]) => (
                    <button key={value} type="button" onClick={() => setDeliveryMode(value as 'file' | 'link')} className={cn('rounded-2xl border py-3 text-xs font-black', deliveryMode === value ? 'border-[#15EA3E] bg-[#15EA3E] text-black' : 'border-white/10 bg-black/28 text-white/60')}>
                      {label}
                    </button>
                  ))}
                </div>
                {deliveryMode === 'file' ? (
                  <label className="mt-4 flex items-center gap-3 rounded-[1.4rem] border border-white/10 bg-black/28 p-4">
                    <AfriZiaIcon name={selectedDigitalConfig.icon} size={22} className="text-[#15EA3E]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-black">{deliveryFiles.length ? `${deliveryFiles.length} fichier(s) sélectionné(s)` : selectedDigitalConfig.uploadLabel}</span>
                      <span className="mt-1 block text-[10px] font-semibold text-white/38">{selectedDigitalConfig.hint}</span>
                    </span>
                    <input type="file" accept={selectedDigitalConfig.accept} multiple={selectedDigitalConfig.multiple} className="hidden" onChange={handleDeliveryFiles} />
                  </label>
                ) : (
                  <input value={deliveryURL} onChange={(event) => setDeliveryURL(event.target.value)} placeholder={digitalType === 'Licence' ? 'Lien portail, documentation ou activation' : 'https://...'} className="mt-4 w-full rounded-2xl border border-white/10 bg-black/28 px-4 py-4 text-sm font-bold outline-none" />
                )}
                {deliveryFiles.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {deliveryFiles.map((file) => (
                      <div key={`${file.name}-${file.size}`} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/22 px-3 py-2">
                        <AfriZiaIcon name="file" size={14} className="text-[#15EA3E]" />
                        <span className="min-w-0 flex-1 truncate text-[10px] font-bold text-white/58">{file.name}</span>
                        <span className="text-[9px] font-black text-white/30">{Math.max(1, Math.round(file.size / 1024))} Ko</span>
                        <button type="button" onClick={() => removeDeliveryFile(file)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white/45 hover:text-white" aria-label={`Retirer ${file.name}`}>
                          <AfriZiaIcon name="close" size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {digitalType === 'Formation' && (
              <div className="mt-4 grid grid-cols-2 gap-2">
                <select value={courseLevel} onChange={(event) => setCourseLevel(event.target.value)} className="rounded-2xl border border-white/10 bg-black/40 px-3 py-3 text-xs font-bold outline-none">
                  {['Débutant', 'Intermédiaire', 'Avancé', 'Expert'].map((item) => <option key={item}>{item}</option>)}
                </select>
                <input value={courseDuration} onChange={(event) => setCourseDuration(event.target.value)} placeholder="Durée: 4h, 6 semaines..." className="rounded-2xl border border-white/10 bg-black/28 px-3 py-3 text-xs font-bold outline-none" />
              </div>
            )}
            {digitalType === 'Template' && (
              <input value={templateSoftware} onChange={(event) => setTemplateSoftware(event.target.value)} placeholder="Logiciel requis: Canva, Figma, Excel..." className="mt-4 w-full rounded-2xl border border-white/10 bg-black/28 px-4 py-4 text-sm font-bold outline-none" />
            )}
            {digitalType === 'Licence' && (
              <div className="mt-4 grid grid-cols-2 gap-2">
                <input value={licenseDuration} onChange={(event) => setLicenseDuration(event.target.value)} placeholder="Durée licence" className="rounded-2xl border border-white/10 bg-black/28 px-3 py-3 text-xs font-bold outline-none" />
                <input value={licenseSeats} onChange={(event) => setLicenseSeats(event.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="Postes" className="rounded-2xl border border-white/10 bg-black/28 px-3 py-3 text-xs font-bold outline-none" />
              </div>
            )}
            <textarea value={accessNote} onChange={(event) => setAccessNote(event.target.value)} rows={3} className="mt-4 w-full resize-none rounded-2xl border border-white/10 bg-black/28 px-4 py-4 text-sm font-bold outline-none" />
          </section>
        )}

        {step === 3 && (
          <section className="rounded-[2rem] border border-[#15EA3E]/16 bg-[#071007] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">Validation</p>
            <img src={coverPreview} alt="" className="mt-5 h-40 w-full rounded-[1.4rem] object-cover" />
            <h2 className="mt-4 text-2xl font-black leading-tight">{title || 'Nouveau produit'}</h2>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-white/52">{description}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-white/10 bg-black/24 p-3">
                <p className="text-[8px] font-black uppercase tracking-wider text-white/35">Prix</p>
                <p className="mt-1 text-lg font-black text-[#15EA3E]">{pricingMode === 'free' ? 'Gratuit' : `${salePrice || price || '0'} ${currency}`}</p>
                {pricingMode === 'paid' && salePrice && <p className="mt-1 text-[10px] font-bold text-white/35 line-through">{price} {currency}</p>}
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/24 p-3">
                <p className="text-[8px] font-black uppercase tracking-wider text-white/35">Livraison</p>
                <p className="mt-1 text-sm font-black">{productKind === 'physical' ? deliveryMode === 'pickup' ? 'Retrait' : 'Expédition' : digitalType === 'Billet' ? 'Billet dynamique' : deliveryMode === 'file' ? `${deliveryFiles.length || 1} fichier(s)` : 'Lien'}</p>
              </div>
            </div>
            {digitalType === 'Billet' && (
              <div className="mt-4">
                <TicketPreview title={eventName || title || 'Événement Zandofy'} date={eventDate} place={eventPlace || 'Lieu à confirmer'} ticketType={ticketType} prefix={ticketPrefix || 'ZDY'} storeLogo={ownerStore.logoURL} />
              </div>
            )}
          </section>
        )}

        {status && <p className="mt-4 rounded-2xl border border-red-400/18 bg-red-500/10 p-3 text-center text-xs font-bold text-red-100">{status}</p>}
        <button disabled={publishing} className="mt-5 w-full rounded-2xl bg-[#15EA3E] py-4 text-xs font-black uppercase tracking-[0.18em] text-black disabled:opacity-40">
          {step === 3 ? publishing ? 'Publication...' : 'Publier sur Zandofy' : 'Continuer'}
        </button>
      </form>
    </main>
  );
}

export function ZandofyEditProductScreen() {
  const navigate = useNavigate();
  const { productId = '' } = useParams();
  const { ownerStore, products, loading, updateProduct } = useZandofyStore();
  const product = products.find((item) => item.id === productId);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [collection, setCollection] = useState('Nouveautés');
  const [catalogCategory, setCatalogCategory] = useState('Digital');
  const [pricingMode, setPricingMode] = useState<'paid' | 'free'>('paid');
  const [regularPrice, setRegularPrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState('');
  const [stockMode, setStockMode] = useState<'unlimited' | 'tracked'>('unlimited');
  const [stock, setStock] = useState('');
  const [fppRate, setFppRate] = useState('0');
  const [affiliateEnabled, setAffiliateEnabled] = useState(false);
  const [affiliateDirectRate, setAffiliateDirectRate] = useState('0');
  const [affiliateIndirectRate, setAffiliateIndirectRate] = useState('0');
  const [sku, setSku] = useState('');
  const [deliveryMode, setDeliveryMode] = useState<'shipping' | 'pickup' | 'file' | 'link'>('shipping');
  const [shippingPrice, setShippingPrice] = useState('');
  const [shippingRegions, setShippingRegions] = useState('RDC');
  const [publishToAfriZia, setPublishToAfriZia] = useState(true);
  const [publishToZikMart, setPublishToZikMart] = useState(false);
  const [supplierType, setSupplierType] = useState<'self' | 'supplier' | 'dropshipper'>('self');
  const [supplierId, setSupplierId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierSKU, setSupplierSKU] = useState('');
  const [supplierCost, setSupplierCost] = useState('');
  const [supplierLeadTimeDays, setSupplierLeadTimeDays] = useState('');
  const [dropshippingEnabled, setDropshippingEnabled] = useState(false);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!product) return;
    setTitle(product.title);
    setDescription(product.description);
    setCollection(product.collection || 'Nouveautés');
    setCatalogCategory(product.catalogCategory || (product.productKind === 'physical' ? 'Autres' : 'Digital'));
    setPricingMode(product.pricingMode || (product.isFree ? 'free' : 'paid'));
    setRegularPrice(String(product.regularPrice ?? product.price ?? 0));
    setSalePrice(product.salePrice !== undefined ? String(product.salePrice) : '');
    setCurrency(product.currency || 'USD');
    setCoverPreview(product.coverURL);
    setStockMode(product.stockMode || (product.productKind === 'physical' ? 'tracked' : 'unlimited'));
    setStock(product.stock !== undefined ? String(product.stock) : '');
    setFppRate(String(product.fppRate || 0));
    setAffiliateEnabled(product.affiliateEnabled === true);
    setAffiliateDirectRate(String(product.affiliateDirectRate || 0));
    setAffiliateIndirectRate(String(product.affiliateIndirectRate || 0));
    setSku(product.sku || '');
    setDeliveryMode(product.deliveryMode || (product.productKind === 'physical' ? 'shipping' : 'file'));
    setShippingPrice(String(product.shippingPrice || 0));
    setShippingRegions(product.shippingRegions?.join(', ') || 'RDC');
    setPublishToAfriZia(product.publishToAfriZia !== false);
    setPublishToZikMart(product.publishToZikMart === true);
    setSupplierType(product.supplierType || 'self');
    setSupplierId(product.supplierId || '');
    setSupplierName(product.supplierName || '');
    setSupplierSKU(product.supplierSKU || '');
    setSupplierCost(product.supplierCost ? String(product.supplierCost) : '');
    setSupplierLeadTimeDays(product.supplierLeadTimeDays ? String(product.supplierLeadTimeDays) : '');
    setDropshippingEnabled(product.dropshippingEnabled === true);
  }, [product]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!product) return;
    setSaving(true);
    setStatus('');
    try {
      await updateProduct(product.id, {
        title,
        description,
        collection,
        catalogCategory,
        pricingMode,
        regularPrice: Number(regularPrice || 0),
        salePrice: salePrice ? Number(salePrice) : undefined,
        currency,
        coverFile,
        stockMode,
        stock: stockMode === 'tracked' ? Number(stock) : undefined,
        fppRate: Number(fppRate || 0),
        affiliateEnabled,
        affiliateDirectRate: Number(affiliateDirectRate || 0),
        affiliateIndirectRate: Number(affiliateIndirectRate || 0),
        sku,
        deliveryMode,
        shippingPrice: Number(shippingPrice || 0),
        shippingRegions: shippingRegions.split(',').map((region) => region.trim()).filter(Boolean),
        publishToAfriZia,
        publishToZikMart,
        supplierType,
        supplierId,
        supplierName,
        supplierSKU,
        supplierCost: Number(supplierCost || 0),
        supplierLeadTimeDays: Number(supplierLeadTimeDays || 0),
        dropshippingEnabled
      });
      navigate('/zandofy/products');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Modification impossible.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <main className="flex min-h-full items-center justify-center bg-[#030604] text-white">Chargement du produit...</main>;
  if (!ownerStore || !product) return <main className="flex min-h-full items-center justify-center bg-[#030604] p-5 text-center text-white">Produit introuvable.</main>;

  const isPhysical = product.productKind === 'physical';

  return (
    <main className="min-h-full overflow-y-auto bg-[#030604] pb-24 text-white scrollbar-hide">
      <header className="sticky top-0 z-20 flex items-center justify-between bg-[#030604]/90 px-4 pb-3 pt-4 backdrop-blur-xl">
        <button type="button" onClick={() => navigate('/zandofy/products')} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]">
          <AfriZiaIcon name="arrow" size={16} className="rotate-180" />
        </button>
        <div className="text-center">
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">Zandofy Studio</p>
          <h1 className="text-sm font-black">Modifier le produit</h1>
        </div>
        <img src={ownerStore.logoURL} alt="" className="h-10 w-10 rounded-2xl object-cover" />
      </header>

      <form onSubmit={submit} className="space-y-4 px-4 pt-5">
        <section className="rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-center gap-3">
            <img src={coverPreview} alt="" className="h-20 w-20 rounded-2xl object-cover" />
            <label className="flex-1 cursor-pointer rounded-2xl border border-dashed border-[#15EA3E]/30 px-3 py-4 text-center text-[10px] font-black uppercase tracking-wider text-[#15EA3E]">
              Remplacer la couverture
              <input type="file" accept="image/*" className="hidden" onChange={(event) => {
                const file = event.target.files?.[0] || null;
                setCoverFile(file);
                if (file) setCoverPreview(URL.createObjectURL(file));
              }} />
            </label>
          </div>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Nom du produit" className="mt-4 w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm font-bold outline-none" />
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} placeholder="Description" className="mt-3 w-full resize-none rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm font-bold outline-none" />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <input value={collection} onChange={(event) => setCollection(event.target.value)} placeholder="Collection" className="rounded-2xl border border-white/10 bg-black/25 px-3 py-3 text-xs font-bold outline-none" />
            <input value={catalogCategory} onChange={(event) => setCatalogCategory(event.target.value)} placeholder="Catégorie" className="rounded-2xl border border-white/10 bg-black/25 px-3 py-3 text-xs font-bold outline-none" />
          </div>
        </section>

        <section className="rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#15EA3E]">Prix et disponibilité</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setPricingMode('paid')} className={cn('rounded-2xl border px-3 py-3 text-xs font-black', pricingMode === 'paid' ? 'border-[#15EA3E] bg-[#15EA3E] text-black' : 'border-white/10 text-white/56')}>Payant</button>
            <button type="button" onClick={() => setPricingMode('free')} className={cn('rounded-2xl border px-3 py-3 text-xs font-black', pricingMode === 'free' ? 'border-[#15EA3E] bg-[#15EA3E] text-black' : 'border-white/10 text-white/56')}>Gratuit</button>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <input value={regularPrice} onChange={(event) => setRegularPrice(event.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder="Prix normal" className="rounded-2xl border border-white/10 bg-black/25 px-3 py-3 text-xs font-bold outline-none" />
            <input value={salePrice} onChange={(event) => setSalePrice(event.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder="Promo" className="rounded-2xl border border-white/10 bg-black/25 px-3 py-3 text-xs font-bold outline-none" />
            <input value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} placeholder="USD" className="rounded-2xl border border-white/10 bg-black/25 px-3 py-3 text-xs font-bold uppercase outline-none" />
          </div>
          {isPhysical && (
            <>
              <div className="mt-4 flex items-center justify-between gap-3">
                <div><p className="text-xs font-black">Suivi du stock</p><p className="mt-1 text-[10px] font-semibold text-white/42">Contrôle les quantités disponibles.</p></div>
                <button type="button" onClick={() => setStockMode(stockMode === 'tracked' ? 'unlimited' : 'tracked')} className={cn('relative h-7 w-12 rounded-full transition', stockMode === 'tracked' ? 'bg-[#15EA3E]' : 'bg-white/15')}><span className={cn('absolute top-1 h-5 w-5 rounded-full bg-white transition', stockMode === 'tracked' ? 'left-6' : 'left-1')} /></button>
              </div>
              {stockMode === 'tracked' && <input value={stock} onChange={(event) => setStock(event.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="Quantité en stock" className="mt-3 w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-3 text-xs font-bold outline-none" />}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <input value={sku} onChange={(event) => setSku(event.target.value)} placeholder="Référence SKU" className="rounded-2xl border border-white/10 bg-black/25 px-3 py-3 text-xs font-bold outline-none" />
                <input value={shippingPrice} onChange={(event) => setShippingPrice(event.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder="Livraison" className="rounded-2xl border border-white/10 bg-black/25 px-3 py-3 text-xs font-bold outline-none" />
              </div>
              <input value={shippingRegions} onChange={(event) => setShippingRegions(event.target.value)} placeholder="Zones: RDC, Rwanda" className="mt-3 w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-3 text-xs font-bold outline-none" />
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setDeliveryMode('shipping')} className={cn('rounded-2xl border px-3 py-3 text-xs font-black', deliveryMode === 'shipping' ? 'border-[#15EA3E] bg-[#15EA3E] text-black' : 'border-white/10 text-white/56')}>Expédition</button>
                <button type="button" onClick={() => setDeliveryMode('pickup')} className={cn('rounded-2xl border px-3 py-3 text-xs font-black', deliveryMode === 'pickup' ? 'border-[#15EA3E] bg-[#15EA3E] text-black' : 'border-white/10 text-white/56')}>Retrait</button>
              </div>
            </>
          )}
          <div className="mt-4 rounded-2xl border border-[#15EA3E]/14 bg-[#15EA3E]/6 p-3">
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-xs font-black">Contribution FPP</p><p className="mt-1 text-[10px] font-semibold text-white/42">Part volontaire de chaque vente pour les projets FPP.</p></div>
              <select value={fppRate} onChange={(event) => setFppRate(event.target.value)} className="rounded-xl border border-white/10 bg-black/45 px-2 py-2 text-xs font-black outline-none"><option value="0">0 %</option><option value="1">1 %</option><option value="3">3 %</option><option value="5">5 %</option><option value="10">10 %</option></select>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-sky-300/18 bg-sky-300/6 p-3">
            <label className="flex items-center gap-3">
              <input type="checkbox" checked={affiliateEnabled} onChange={(event) => setAffiliateEnabled(event.target.checked)} className="h-4 w-4 accent-[#15EA3E]" />
              <span><span className="block text-xs font-black">Activer les recommandations</span><span className="mt-1 block text-[10px] font-semibold text-white/42">Définis la rémunération des personnes qui recommandent ce produit.</span></span>
            </label>
            {affiliateEnabled && <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="text-[9px] font-black uppercase tracking-wider text-white/42">Direct
                <input value={affiliateDirectRate} onChange={(event) => setAffiliateDirectRate(event.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder="% commission" className="mt-1 w-full rounded-xl border border-white/10 bg-black/28 px-3 py-3 text-xs font-bold normal-case tracking-normal text-white outline-none" />
              </label>
              <label className="text-[9px] font-black uppercase tracking-wider text-white/42">Indirect
                <input value={affiliateIndirectRate} onChange={(event) => setAffiliateIndirectRate(event.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder="% commission" className="mt-1 w-full rounded-xl border border-white/10 bg-black/28 px-3 py-3 text-xs font-bold normal-case tracking-normal text-white outline-none" />
              </label>
            </div>}
          </div>
        </section>

        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <input type="checkbox" checked={publishToAfriZia} onChange={(event) => setPublishToAfriZia(event.target.checked)} className="h-4 w-4 accent-[#15EA3E]" />
          <span><span className="block text-xs font-black">Visible dans AfriZia</span><span className="mt-1 block text-[10px] font-semibold text-white/42">Désactive pour garder le produit uniquement dans ta boutique.</span></span>
        </label>

        {isPhysical && (
          <section className="rounded-[1.8rem] border border-sky-300/18 bg-sky-300/6 p-4">
            <p className="text-xs font-black">ZikMart et fournisseur</p>
            <label className="mt-3 flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3">
              <input type="checkbox" checked={publishToZikMart} onChange={(event) => setPublishToZikMart(event.target.checked)} className="h-4 w-4 accent-[#15EA3E]" />
              <span className="text-[10px] font-black">Publier dans ZikMart</span>
            </label>
            {publishToZikMart && <div className="mt-3 space-y-2">
              <select value={supplierType} onChange={(event) => setSupplierType(event.target.value as 'self' | 'supplier' | 'dropshipper')} className="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-3 text-xs font-black outline-none">
                <option value="self">Mon propre stock</option>
                <option value="supplier">Fournisseur partenaire</option>
                <option value="dropshipper">Dropshipping</option>
              </select>
              {supplierType !== 'self' && <>
                <input value={supplierName} onChange={(event) => setSupplierName(event.target.value)} placeholder="Nom du fournisseur" className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-xs font-bold outline-none" />
                <div className="grid grid-cols-2 gap-2"><input value={supplierId} onChange={(event) => setSupplierId(event.target.value)} placeholder="Référence fournisseur" className="rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-xs font-bold outline-none" /><input value={supplierSKU} onChange={(event) => setSupplierSKU(event.target.value)} placeholder="SKU fournisseur" className="rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-xs font-bold outline-none" /></div>
              </>}
              <div className="grid grid-cols-2 gap-2"><input value={supplierCost} onChange={(event) => setSupplierCost(event.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder="Coût réel" className="rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-xs font-bold outline-none" /><input value={supplierLeadTimeDays} onChange={(event) => setSupplierLeadTimeDays(event.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="Délai en jours" className="rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-xs font-bold outline-none" /></div>
              <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3"><input type="checkbox" checked={dropshippingEnabled} onChange={(event) => setDropshippingEnabled(event.target.checked)} className="h-4 w-4 accent-[#15EA3E]" /><span className="text-[10px] font-black">Activer le traitement dropshipping</span></label>
            </div>}
          </section>
        )}

        {status && <p className="rounded-2xl border border-red-400/18 bg-red-500/10 p-3 text-center text-xs font-bold text-red-100">{status}</p>}
        <button type="submit" disabled={saving} className="w-full rounded-2xl bg-[#15EA3E] py-4 text-xs font-black uppercase tracking-[0.18em] text-black disabled:opacity-40">{saving ? 'Enregistrement...' : 'Enregistrer les modifications'}</button>
      </form>
    </main>
  );
}

export function ZandofyProductsScreen() {
  const navigate = useNavigate();
  const { ownerStore, products, loading, setProductStock } = useZandofyStore();
  const [stockBusy, setStockBusy] = useState('');
  const [stockStatus, setStockStatus] = useState('');
  const collections = Array.from(new Set(products.map((product) => product.collection || 'Nouveautés')));
  const [activeCollection, setActiveCollection] = useState('Tout');
  const visibleProducts = activeCollection === 'Tout'
    ? products
    : products.filter((product) => (product.collection || 'Nouveautés') === activeCollection);

  if (loading) return <main className="flex min-h-full items-center justify-center bg-[#030604] text-white">Chargement produits...</main>;
  if (!ownerStore) return <main className="flex min-h-full items-center justify-center bg-[#030604] text-white">Boutique introuvable.</main>;

  return (
    <main className="min-h-full overflow-y-auto bg-[#030604] pb-24 text-white scrollbar-hide">
      <header className="sticky top-0 z-20 flex items-center justify-between bg-[#030604]/90 px-4 pb-3 pt-4 backdrop-blur-xl">
        <button type="button" onClick={() => navigate('/zandofy/dashboard')} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]">
          <AfriZiaIcon name="arrow" size={16} className="rotate-180" />
        </button>
        <div className="text-center">
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">Zandofy</p>
          <h1 className="text-sm font-black">Catalogue Zandofy</h1>
        </div>
        <Link to="/zandofy/products/new" className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#15EA3E] text-black">
          <AfriZiaIcon name="plus" size={16} />
        </Link>
      </header>

      <section className="px-4 pt-4">
        <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
          {['Tout', ...collections].map((collection) => (
            <button
              key={collection}
              type="button"
              onClick={() => setActiveCollection(collection)}
              className={cn(
                'shrink-0 rounded-full border px-3 py-2 text-[10px] font-black',
                activeCollection === collection ? 'border-[#15EA3E] bg-[#15EA3E] text-black' : 'border-white/10 bg-white/[0.04] text-white/58'
              )}
            >
              {collection}
            </button>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 px-4 pt-5">
        {visibleProducts.length ? visibleProducts.map((product) => (
          <article key={product.id} className="overflow-hidden rounded-[1.4rem] border border-white/10 bg-white/[0.04]">
            <Link to={getZandofyProductPath(product)} className="block">
              <img src={product.coverURL} alt="" className="h-32 w-full object-cover" />
              <div className="p-3 pb-2">
                <p className="line-clamp-2 min-h-[32px] text-xs font-black leading-tight">{product.title}</p>
                <p className="mt-2 text-[9px] font-black uppercase tracking-wider text-[#15EA3E]">{product.productKind === 'physical' ? product.catalogCategory || 'Produit physique' : product.digitalType}</p>
                <p className="mt-1 text-sm font-black">{product.isFree ? 'Gratuit' : `${product.price.toLocaleString('fr-FR')} ${product.currency}`}</p>
                {product.salePrice !== undefined && <p className="text-[10px] font-bold text-white/35 line-through">{product.regularPrice.toLocaleString('fr-FR')} {product.currency}</p>}
              </div>
            </Link>
            <div className="flex items-center justify-between gap-2 border-t border-white/8 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-[9px] font-black uppercase tracking-wider text-white/42">{product.productKind === 'physical' ? product.stockMode === 'tracked' ? `Stock: ${product.stock ?? 0}` : 'Stock illimité' : 'Accès digital'}</p>
                {product.productKind === 'physical' && product.publishToZikMart && <p className="mt-1 truncate text-[9px] font-bold text-sky-200/70">Marge: {formatZandofyMoney(product.sellerMargin || 0, product.currency)}</p>}
                {product.productKind === 'physical' && product.stockMode === 'tracked' && <div className="mt-1 flex items-center gap-1">
                  <button type="button" aria-label="Diminuer le stock" disabled={stockBusy === product.id} onClick={async (event) => { event.preventDefault(); setStockBusy(product.id); setStockStatus(''); try { await setProductStock(product.id, Math.max(0, Number(product.stock || 0) - 1)); } catch (error) { setStockStatus(error instanceof Error ? error.message : 'Stock impossible.'); } finally { setStockBusy(''); } }} className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 text-xs font-black">−</button>
                  <button type="button" aria-label="Augmenter le stock" disabled={stockBusy === product.id} onClick={async (event) => { event.preventDefault(); setStockBusy(product.id); setStockStatus(''); try { await setProductStock(product.id, Number(product.stock || 0) + 1); } catch (error) { setStockStatus(error instanceof Error ? error.message : 'Stock impossible.'); } finally { setStockBusy(''); } }} className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#15EA3E] text-xs font-black text-black">+</button>
                </div>}
              </div>
              <button type="button" aria-label="Modifier le produit" onClick={() => navigate(`/zandofy/products/${product.id}/edit`)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 text-[#15EA3E]"><AfriZiaIcon name="edit" size={14} /></button>
            </div>
          </article>
        )) : (
          <div className="col-span-2 rounded-[1.6rem] border border-dashed border-white/14 p-6 text-center">
            <AfriZiaIcon name="file" size={28} className="mx-auto text-[#15EA3E]" />
            <p className="mt-3 text-sm font-black">Aucun produit dans le catalogue</p>
            <Link to="/zandofy/products/new" className="mt-4 inline-flex rounded-2xl bg-[#15EA3E] px-4 py-3 text-[10px] font-black uppercase tracking-wider text-black">Ajouter</Link>
          </div>
        )}
      </section>
      {stockStatus && <p className="mx-4 mt-4 rounded-2xl border border-red-400/18 bg-red-500/10 p-3 text-center text-xs font-bold text-red-100">{stockStatus}</p>}
    </main>
  );
}

export function ZandofyDomainScreen() {
  const navigate = useNavigate();
  const { ownerStore, loading, updateCustomDomain, updateStoreProfile } = useZandofyStore();
  const [domain, setDomain] = useState('');
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [theme, setTheme] = useState<ZandofyTheme>('emerald');
  const [orderProcessingMode, setOrderProcessingMode] = useState<ZandofyOrderProcessingMode>('manual');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [status, setStatus] = useState('');
  const [domainResult, setDomainResult] = useState<Awaited<ReturnType<typeof updateCustomDomain>> | null>(null);

  useEffect(() => {
    if (!ownerStore) return;
    setName(ownerStore.name);
    setTagline(ownerStore.tagline);
    setTheme(ownerStore.theme);
    setOrderProcessingMode(ownerStore.orderProcessingMode || 'manual');
    setLogoPreview(ownerStore.logoURL);
    setDomain(ownerStore.customDomain || '');
  }, [ownerStore]);

  if (loading) return <main className="flex min-h-full items-center justify-center bg-[#030604] text-white">Chargement domaine...</main>;
  if (!ownerStore) return <main className="flex min-h-full items-center justify-center bg-[#030604] text-white">Boutique introuvable.</main>;

  const saveDomain = async () => {
    setStatus('');
    try {
      const result = await updateCustomDomain(domain, 'connect');
      setDomainResult(result);
      setStatus(result.message);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Domaine impossible.');
    }
  };

  const verifyDomain = async () => {
    setStatus('');
    try {
      const result = await updateCustomDomain(domain || ownerStore.customDomain, 'verify');
      setDomainResult(result);
      setStatus(result.message);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Vérification du domaine impossible.');
    }
  };

  const saveProfile = async () => {
    setStatus('');
    try {
      await updateStoreProfile({ name, tagline, theme, logoFile, orderProcessingMode });
      setLogoFile(null);
      setStatus('Personnalisation enregistrée. La boutique publique est à jour.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Personnalisation impossible.');
    }
  };

  return (
    <main className="min-h-full overflow-y-auto bg-[#030604] pb-24 text-white scrollbar-hide">
      <header className="sticky top-0 z-20 flex items-center justify-between bg-[#030604]/90 px-4 pb-3 pt-4 backdrop-blur-xl">
        <button type="button" onClick={() => navigate('/zandofy/dashboard')} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]">
          <AfriZiaIcon name="arrow" size={16} className="rotate-180" />
        </button>
        <div className="text-center">
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">Zandofy</p>
          <h1 className="text-sm font-black">Réglages</h1>
        </div>
        <img src={ownerStore.logoURL} alt="" className="h-10 w-10 rounded-2xl object-cover" />
      </header>

      <section className="px-4 pt-5">
        <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#15EA3E]">Identité publique</p>
          <h2 className="mt-2 text-xl font-black">Personnalise ta boutique</h2>
          <div className="mt-4 flex items-center gap-3">
            <img src={logoPreview || ownerStore.logoURL} alt="" className="h-16 w-16 rounded-2xl object-cover" />
            <label className="flex-1 cursor-pointer rounded-2xl border border-dashed border-[#15EA3E]/30 px-3 py-4 text-center text-[10px] font-black uppercase tracking-wider text-[#15EA3E]">
              Changer le logo
              <input type="file" accept="image/*" className="hidden" onChange={(event) => {
                const file = event.target.files?.[0] || null;
                setLogoFile(file);
                if (file) setLogoPreview(URL.createObjectURL(file));
              }} />
            </label>
          </div>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nom de la boutique" className="mt-4 w-full rounded-2xl border border-white/10 bg-black/24 px-4 py-3 text-sm font-bold outline-none" />
          <textarea value={tagline} onChange={(event) => setTagline(event.target.value)} rows={2} placeholder="Présentation courte" className="mt-3 w-full resize-none rounded-2xl border border-white/10 bg-black/24 px-4 py-3 text-sm font-bold outline-none" />
          <p className="mt-4 text-[10px] font-black uppercase tracking-wider text-white/38">Ambiance de la vitrine</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {([
              ['emerald', 'Émeraude'],
              ['midnight', 'Minuit'],
              ['sunrise', 'Soleil'],
              ['mono', 'Minimal']
            ] as Array<[ZandofyTheme, string]>).map(([value, label]) => (
              <button key={value} type="button" onClick={() => setTheme(value)} className={cn('rounded-2xl border bg-gradient-to-br px-3 py-3 text-left text-xs font-black', themeStyles[value], theme === value ? 'border-[#15EA3E] text-white' : 'border-white/10 text-white/55')}>
                {label}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => void saveProfile()} className="mt-4 w-full rounded-2xl bg-[#15EA3E] py-3 text-[10px] font-black uppercase tracking-wider text-black">Enregistrer la vitrine</button>
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-white/42">Traitement des commandes</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {([['manual', 'Manuel'], ['automatic', 'Automatique']] as Array<[ZandofyOrderProcessingMode, string]>).map(([value, label]) => (
                <button key={value} type="button" onClick={() => setOrderProcessingMode(value)} className={cn('rounded-xl border py-3 text-xs font-black', orderProcessingMode === value ? 'border-[#15EA3E] bg-[#15EA3E] text-black' : 'border-white/10 bg-white/[0.04] text-white/56')}>
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] font-semibold leading-relaxed text-white/38">Automatique prépare la commande dès le paiement. Manuel te laisse valider chaque étape.</p>
          </div>
        </div>
      </section>

      <section className="px-4 pt-5">
        <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-5">
          <h2 className="text-xl font-black">Domaine personnalisé</h2>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-white/46">{ownerStore.customDomain ? `${ownerStore.customDomain} - ${ownerStore.customDomainStatus === 'verified' ? 'vérifié' : 'en attente'}` : 'Ajoute le domaine que tu veux connecter à ta boutique.'}</p>
          <div className="mt-5 flex gap-2">
            <input value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="boutique.com" className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/24 px-3 py-3 text-xs font-bold outline-none" />
            <button type="button" onClick={saveDomain} className="rounded-2xl bg-[#15EA3E] px-4 text-[10px] font-black uppercase tracking-wider text-black">Lier</button>
          </div>
          {domainResult && (
            <div className="mt-5 rounded-2xl border border-[#15EA3E]/16 bg-[#15EA3E]/8 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-[#15EA3E]">Configuration DNS</p>
                <span className={cn('rounded-full px-2 py-1 text-[8px] font-black uppercase', domainResult.status === 'verified' ? 'bg-[#15EA3E] text-black' : 'bg-amber-300/15 text-amber-100')}>{domainResult.status === 'verified' ? 'Vérifié' : 'En attente'}</span>
              </div>
              <div className="mt-3 space-y-2">
                {domainResult.dnsRecords.map((record) => (
                  <div key={`${record.type}-${record.name}-${record.value}`} className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <p className="text-[9px] font-black uppercase tracking-wider text-white/38">{record.type} · {record.name}</p>
                    <p className="mt-1 break-all text-[11px] font-bold text-white/72">{record.value}</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[10px] font-semibold leading-relaxed text-white/45">Une fois les DNS enregistrés chez ton fournisseur, lance la vérification. Le certificat SSL et le routage sont activés automatiquement par Vercel après validation.</p>
              {domainResult.status !== 'verified' && <button type="button" onClick={() => void verifyDomain()} className="mt-3 w-full rounded-xl border border-[#15EA3E]/30 bg-[#15EA3E]/10 py-3 text-[10px] font-black uppercase tracking-wider text-[#15EA3E]">Vérifier maintenant</button>}
            </div>
          )}
          {status && <p className="mt-4 text-xs font-bold text-[#15EA3E]">{status}</p>}
        </div>
      </section>
    </main>
  );
}

export function ZandofyPublicStoreScreen() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useFirebaseAuth();
  const { publicStore, products, loading } = useZandofyStore(slug);
  const [reviews, setReviews] = useState<ZandofyStoreReview[]>([]);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  useEffect(() => {
    if (!publicStore?.id) return;
    const viewerCountry = profile?.country || getCountryByCode(getDeviceCountryCode())?.name || publicStore.country;
    const viewerCity = profile?.city || getDeviceCityHint() || publicStore.city;
    void recordZandofyAnalyticsEvent({
      storeId: publicStore.id,
      eventType: 'store_view',
      country: viewerCountry,
      city: viewerCity
    }).catch(() => {
      // Les statistiques ne doivent jamais bloquer l'affichage de la boutique.
    });
  }, [profile?.city, profile?.country, publicStore?.city, publicStore?.country, publicStore?.id]);

  useEffect(() => {
    if (!publicStore?.id) {
      setReviews([]);
      return undefined;
    }

    const reviewsRef = ref(realtimeDb, `zandofyStoreReviews/${publicStore.id}`);
    const unsubscribe = onValue(reviewsRef, (snapshot) => {
      const data = snapshot.val() as Record<string, ZandofyStoreReview> | null;
      const nextReviews = Object.entries(data || {})
        .map(([id, review]) => ({ ...review, id: review.id || id }))
        .sort((first, second) => Number(second.createdAt || 0) - Number(first.createdAt || 0));
      setReviews(nextReviews);
    });

    return unsubscribe;
  }, [publicStore?.id]);

  const reviewAverage = reviews.length
    ? reviews.reduce((total, review) => total + Number(review.rating || 0), 0) / reviews.length
    : 0;
  const collections = useMemo(
    () => Array.from(new Set(products.map((product) => product.collection || 'Nouveautés'))),
    [products]
  );
  const [activeCollection, setActiveCollection] = useState('Tout');
  const [catalogQuery, setCatalogQuery] = useState('');
  const visibleProducts = useMemo(() => {
    const normalizedQuery = catalogQuery.trim().toLowerCase();
    return products.filter((product) => {
      const matchesCollection = activeCollection === 'Tout' || (product.collection || 'Nouveautés') === activeCollection;
      const matchesQuery = !normalizedQuery || [product.title, product.description, product.catalogCategory, product.digitalType]
        .some((value) => String(value || '').toLowerCase().includes(normalizedQuery));
      return matchesCollection && matchesQuery;
    });
  }, [activeCollection, catalogQuery, products]);
  const featuredProducts = useMemo(() => products.slice(0, 4), [products]);
  const promotionProducts = useMemo(
    () => products.filter((product) => product.salePrice !== undefined && product.salePrice < product.regularPrice),
    [products]
  );
  const heroProduct = featuredProducts[0];
  const heroImage = heroProduct?.coverURL || '/zandofy/group-five-african-american-woman-with-shopping-carts-having-fun-together-outdoor.jpg';

  const submitStoreReview = async () => {
    if (!publicStore) return;
    if (!user) {
      navigate('/login', { state: { next: `/zandofy/${publicStore.slug}` } });
      return;
    }

    setSubmittingFeedback(true);
    setFeedbackStatus('');
    try {
      const reviewId = user.uid;
      const text = reviewText.trim();
      await set(ref(realtimeDb, `zandofyStoreReviews/${publicStore.id}/${reviewId}`), {
        id: reviewId,
        authorId: user.uid,
        authorName: profile?.displayName || user.displayName || 'Client AfriZia',
        rating: reviewRating,
        text,
        createdAt: Date.now()
      });
      const nextReviews = [
        ...reviews.filter((review) => review.authorId !== user.uid),
        {
          id: reviewId,
          authorId: user.uid,
          authorName: profile?.displayName || user.displayName || 'Client AfriZia',
          rating: reviewRating,
          text,
          createdAt: Date.now()
        }
      ];
      const nextAverage = nextReviews.reduce((total, review) => total + Number(review.rating || 0), 0) / nextReviews.length;
      await set(ref(realtimeDb, `zandofyStores/${publicStore.id}/rating`), Math.round(nextAverage * 10) / 10);
      setReviewText('');
      setFeedbackStatus('Avis enregistré.');
    } catch (error) {
      setFeedbackStatus(error instanceof Error ? error.message : 'Avis impossible.');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const reportStore = async () => {
    if (!publicStore) return;
    if (!user) {
      navigate('/login', { state: { next: `/zandofy/${publicStore.slug}` } });
      return;
    }

    setSubmittingFeedback(true);
    setFeedbackStatus('');
    try {
      const reportRef = push(ref(realtimeDb, `zandofyStoreReports/${publicStore.id}`));
      await set(reportRef, {
        id: reportRef.key,
        reporterId: user.uid,
        reporterName: profile?.displayName || user.displayName || 'Utilisateur AfriZia',
        storeId: publicStore.id,
        storeName: publicStore.name,
        reason: 'signalement_utilisateur',
        status: 'pending_review',
        createdAt: serverTimestamp()
      });
      setFeedbackStatus('Signalement envoyé. Merci.');
    } catch (error) {
      setFeedbackStatus(error instanceof Error ? error.message : 'Signalement impossible.');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const shareStore = async () => {
    if (!publicStore) return;
    const url = getZandofyStoreURL(publicStore.slug);
    try {
      const result = await shareLink({ title: publicStore.name, text: publicStore.tagline, url });
      setFeedbackStatus(result === 'copied' ? 'Lien de la boutique copié.' : 'Boutique partagée.');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setFeedbackStatus(error instanceof Error ? error.message : 'Partage de la boutique impossible.');
    }
  };

  if (loading) return <main className="flex min-h-full items-center justify-center bg-[#030604] text-white">Chargement boutique...</main>;
  if (!publicStore) {
    return (
      <main className="flex min-h-full flex-col justify-center bg-[#030604] p-5 text-center text-white">
        <h1 className="text-2xl font-black">Boutique introuvable</h1>
        <Link to="/zandofy" className="mt-5 rounded-2xl bg-[#15EA3E] px-5 py-3 text-xs font-black uppercase tracking-wider text-black">Retour Zandofy</Link>
      </main>
    );
  }

  return (
    <main className="zandofy-public-store min-h-full min-w-0 overflow-x-hidden bg-[#030604] pb-[7.5rem] text-white">
      <style>{`
        @keyframes zandofy-store-rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <header className="sticky top-0 z-40 min-w-0 border-b border-white/10 bg-[#030604]/95 backdrop-blur-xl md:pt-7">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2.5 px-3 sm:px-6 lg:px-8">
          <button type="button" onClick={() => navigate(-1)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05]" aria-label="Retour"><AfriZiaIcon name="arrow" size={15} className="rotate-180" /></button>
          <a href="#store-top" className="flex min-w-0 flex-1 items-center gap-2"><img src={publicStore.logoURL} alt={`${publicStore.name} logo`} className="h-8 w-8 shrink-0 rounded-lg object-cover" /><span className="min-w-0 truncate text-[11px] font-black">{publicStore.name}</span></a>
          <a href="/market/orders?module=zandofy&view=purchases" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05]" aria-label="Mes achats"><AfriZiaIcon name="order" size={15} className="text-[#15EA3E]" /></a>
          <button type="button" onClick={() => void shareStore()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#15EA3E] text-black" aria-label="Partager la boutique"><AfriZiaIcon name="share" size={15} /></button>
        </div>
        <nav aria-label="Raccourcis boutique" className="scrollbar-hide flex h-8 items-center gap-5 overflow-x-auto border-t border-white/[0.06] px-4">{[['Accueil', '#store-top'], ['Catalogue', '#products'], ['Promotions', '#promos'], ['À propos', '#about']].map(([label, href]) => <a key={label} href={href} className="shrink-0 text-[9px] font-black text-white/55">{label}</a>)}</nav>
      </header>

      <section id="store-top" className={cn('scroll-mt-24 border-b border-white/10 bg-gradient-to-br', themeStyles[publicStore.theme])}>
        <div className="mx-auto grid min-w-0 max-w-6xl gap-5 px-4 py-5">
          <div className="order-2" style={{ animation: 'zandofy-store-rise .6s ease-out both' }}>
            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.18em] text-[#15EA3E]"><span className="h-1.5 w-1.5 rounded-full bg-[#15EA3E]" /> Boutique ouverte</div>
            <h1 className="mt-3 break-words text-3xl font-black leading-[1.02] tracking-tight sm:text-5xl">{publicStore.name}</h1>
            <p className="mt-3 max-w-lg text-sm font-semibold leading-relaxed text-white/65">{publicStore.tagline}</p>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[10px] font-bold text-white/48"><span className="flex items-center gap-1.5"><AfriZiaIcon name="location" size={13} className="text-[#15EA3E]" />{publicStore.city}, {publicStore.country}</span><span className="flex items-center gap-1.5"><AfriZiaIcon name="star" size={13} className="fill-current text-[#FFD84D]" />{reviewAverage ? reviewAverage.toFixed(1) : Number(publicStore.rating || 0).toFixed(1)} · {reviews.length} avis</span></div>
            <div className="mt-6 flex flex-wrap gap-2"><a href="#products" className="rounded-xl bg-[#15EA3E] px-4 py-3 text-[10px] font-black uppercase tracking-wider text-black">Voir les produits</a><Link to={`/chat?contact=${encodeURIComponent(publicStore.ownerId)}&name=${encodeURIComponent(publicStore.ownerName)}&store=${publicStore.id}`} className="rounded-xl border border-white/18 bg-black/25 px-4 py-3 text-[10px] font-black uppercase tracking-wider text-white/80">Contacter</Link></div>
          </div>
          <div className="order-1" style={{ animation: 'zandofy-store-rise .7s .1s ease-out both' }}>
            {heroProduct ? (
              <Link to={getZandofyProductPath(heroProduct)} className="group block min-w-0 overflow-hidden rounded-[1.35rem] border border-white/14 bg-[#071007] shadow-[0_20px_55px_rgba(0,0,0,.35)]">
                <img src={heroImage} alt={heroProduct.title} className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                <div className="min-w-0 px-4 py-4">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#15EA3E]">Produit vedette</p>
                  <div className="mt-1 flex items-end justify-between gap-3"><div className="min-w-0"><p className="line-clamp-2 text-sm font-black leading-tight">{heroProduct.title}</p><p className="mt-1 text-xs font-black text-[#15EA3E]">{heroProduct.isFree ? 'Gratuit' : `${heroProduct.price.toLocaleString('fr-FR')} ${heroProduct.currency}`}</p></div><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#15EA3E] text-black"><AfriZiaIcon name="arrow" size={14} /></span></div>
                </div>
              </Link>
            ) : (
              <div className="relative overflow-hidden rounded-[1.35rem] border border-white/14 bg-black/20 shadow-[0_20px_55px_rgba(0,0,0,.35)]"><img src={heroImage} alt={`Sélection de ${publicStore.name}`} className="aspect-[4/3] w-full object-cover" /></div>
            )}
          </div>
        </div>
      </section>

      {featuredProducts.length > 0 && (
        <section className="border-b border-white/10 bg-[#071007]">
          <div className="mx-auto max-w-6xl px-4 py-7">
            <div className="flex items-end justify-between gap-4">
              <div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#15EA3E]">La boutique en avant</p><h2 className="mt-1 text-xl font-black">Produits vedettes</h2></div>
              <a href="#products" className="shrink-0 text-[9px] font-black uppercase tracking-wider text-[#15EA3E]">Tout le catalogue</a>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {featuredProducts.map((product) => (
                <Link key={product.id} to={getZandofyProductPath(product)} onClick={() => { void recordZandofyAnalyticsEvent({ storeId: publicStore.id, eventType: 'product_view', productId: product.id, country: profile?.country || publicStore.country, city: profile?.city || publicStore.city }); }} className="group min-w-0 overflow-hidden rounded-xl border border-white/10 bg-[#0b130b]">
                  <img src={product.coverURL} alt={product.title} className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  <div className="p-3"><p className="line-clamp-2 min-h-[30px] text-[11px] font-black leading-tight">{product.title}</p><p className="mt-2 text-xs font-black text-[#15EA3E]">{product.isFree ? 'Gratuit' : `${product.price.toLocaleString('fr-FR')} ${product.currency}`}</p></div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {promotionProducts.length > 0 && <section id="promos" className="scroll-mt-24 mx-auto max-w-6xl px-4 pt-9 sm:px-6 lg:px-8"><div className="flex items-end justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-300">Offres limitées</p><h2 className="mt-1 text-xl font-black sm:text-2xl">Les promotions du moment</h2></div><span className="text-[9px] font-black text-amber-200">{promotionProducts.length} offre(s)</span></div><div className="scrollbar-hide mt-4 flex gap-3 overflow-x-auto pb-1">{promotionProducts.slice(0, 6).map((product) => <Link key={product.id} to={getZandofyProductPath(product)} className="group w-[220px] shrink-0 overflow-hidden rounded-xl border border-amber-300/18 bg-[#151006]"><div className="relative aspect-[16/10] overflow-hidden"><img src={product.coverURL} alt={product.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" /><span className="absolute left-2 top-2 rounded-full bg-amber-300 px-2 py-1 text-[8px] font-black uppercase text-black">Promo</span></div><div className="p-3"><p className="truncate text-xs font-black">{product.title}</p><div className="mt-2 flex items-center gap-2"><span className="text-sm font-black text-amber-200">{product.salePrice?.toLocaleString('fr-FR')} {product.currency}</span><span className="text-[9px] font-bold text-white/35 line-through">{product.regularPrice.toLocaleString('fr-FR')} {product.currency}</span></div></div></Link>)}</div></section>}

      <section id="products" className="scroll-mt-24 mt-9 border-y border-white/10 bg-[#071007]"><div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#15EA3E]">Le catalogue</p><h2 className="mt-1 text-xl font-black sm:text-2xl">Produits de la boutique</h2><p className="mt-2 max-w-xl text-xs font-semibold leading-relaxed text-white/44">Produits physiques et digitaux publiés par {publicStore.name}.</p></div><div className="relative w-full sm:max-w-[250px]"><AfriZiaIcon name="search" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35" /><input value={catalogQuery} onChange={(event) => setCatalogQuery(event.target.value)} placeholder="Rechercher dans la boutique" className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.05] pl-9 pr-3 text-xs font-bold outline-none focus:border-[#15EA3E]/45" /></div></div><div className="scrollbar-hide mt-4 flex gap-2 overflow-x-auto pb-1">{['Tout', ...collections].map((collection) => <button key={collection} type="button" onClick={() => setActiveCollection(collection)} className={cn('shrink-0 rounded-full border px-3 py-2 text-[9px] font-black', activeCollection === collection ? 'border-[#15EA3E] bg-[#15EA3E] text-black' : 'border-white/10 bg-white/[0.04] text-white/55')}>{collection}</button>)}</div>{visibleProducts.length > 0 ? <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{visibleProducts.slice(0, 16).map((product) => <article key={product.id} className="group overflow-hidden rounded-xl border border-white/10 bg-[#0b130b] transition-colors hover:border-[#15EA3E]/35"><Link to={getZandofyProductPath(product)} onClick={() => { void recordZandofyAnalyticsEvent({ storeId: publicStore.id, eventType: 'product_view', productId: product.id, country: profile?.country || publicStore.country, city: profile?.city || publicStore.city }); }} className="block"><div className="relative aspect-square overflow-hidden"><img src={product.coverURL} alt={product.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />{product.salePrice !== undefined && product.salePrice < product.regularPrice && <span className="absolute left-2 top-2 rounded-full bg-amber-300 px-2 py-1 text-[8px] font-black text-black">PROMO</span>}</div><div className="p-3"><p className="line-clamp-2 min-h-[30px] text-[11px] font-black leading-tight">{product.title}</p><p className="mt-2 truncate text-[8px] font-black uppercase tracking-wider text-[#15EA3E]">{product.productKind === 'physical' ? product.catalogCategory || 'Produit physique' : product.digitalType}</p><div className="mt-1 flex flex-wrap items-baseline gap-1"><span className="text-xs font-black">{product.isFree ? 'Gratuit' : `${product.price.toLocaleString('fr-FR')} ${product.currency}`}</span>{product.salePrice !== undefined && product.salePrice < product.regularPrice && <span className="text-[8px] font-bold text-white/35 line-through">{product.regularPrice.toLocaleString('fr-FR')} {product.currency}</span>}</div>{product.productKind === 'physical' && product.stockMode === 'tracked' && <p className={`mt-1 text-[8px] font-bold ${product.stock && product.stock > 0 ? 'text-white/42' : 'text-red-300'}`}>{product.stock && product.stock > 0 ? `${product.stock} disponible(s)` : 'Rupture de stock'}</p>}</div></Link><Link to={getZandofyProductPath(product)} className="flex items-center justify-between border-t border-white/8 px-3 py-2.5 text-[8px] font-black uppercase tracking-wider text-[#15EA3E]">Voir le détail <AfriZiaIcon name="arrow" size={11} /></Link></article>)}</div> : <div className="mt-5 border border-dashed border-white/14 p-8 text-center"><AfriZiaIcon name="market" size={28} className="mx-auto text-[#15EA3E]" /><h3 className="mt-3 text-base font-black">{products.length ? 'Aucun résultat' : 'Catalogue bientôt disponible'}</h3><p className="mt-2 text-xs font-semibold text-white/42">{products.length ? 'Aucun produit ne correspond à ta recherche.' : 'Les produits de cette boutique apparaîtront ici.'}</p></div>}</div></section>

      <section id="about" className="scroll-mt-24 border-b border-white/10"><div className="mx-auto grid max-w-6xl gap-7 px-4 py-9 sm:px-6 lg:grid-cols-[.85fr_1.15fr] lg:px-8"><div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#15EA3E]">À propos de la boutique</p><h2 className="mt-2 text-2xl font-black">Une vitrine pensée pour acheter en confiance.</h2><p className="mt-3 text-sm font-semibold leading-relaxed text-white/52">{publicStore.tagline} Cette boutique rassemble ses collections dans un espace simple à parcourir, avec un paiement sécurisé et un accompagnement direct.</p><div className="mt-5 flex items-center gap-3"><img src={publicStore.logoURL} alt="" className="h-11 w-11 rounded-xl object-cover" /><div><p className="text-xs font-black">{publicStore.ownerName}</p><p className="mt-1 text-[10px] font-semibold text-white/40">Vendeur · {publicStore.city}, {publicStore.country}</p></div></div></div><div className="grid gap-5 sm:grid-cols-3"><div><AfriZiaIcon name="pay" size={20} className="text-[#15EA3E]" /><h3 className="mt-3 text-sm font-black">Paiement AfriSpay</h3><p className="mt-2 text-[10px] font-semibold leading-relaxed text-white/42">Paie depuis ton portefeuille et retrouve ton achat dans tes commandes.</p></div><div><AfriZiaIcon name="chat" size={20} className="text-[#15EA3E]" /><h3 className="mt-3 text-sm font-black">Échange direct</h3><p className="mt-2 text-[10px] font-semibold leading-relaxed text-white/42">Une question? Contacte directement la boutique.</p></div><div><AfriZiaIcon name="shield" size={20} className="text-[#15EA3E]" /><h3 className="mt-3 text-sm font-black">Achat suivi</h3><p className="mt-2 text-[10px] font-semibold leading-relaxed text-white/42">Retrouve le détail et le statut de tes commandes à tout moment.</p></div></div></div></section>

      <section id="contact" className="scroll-mt-24 mx-auto max-w-6xl px-4 pt-9 sm:px-6 lg:px-8"><div className="flex flex-col justify-between gap-5 border-y border-[#15EA3E]/18 bg-[#071007] px-5 py-6 sm:flex-row sm:items-center"><div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#15EA3E]">Besoin d'aide?</p><h2 className="mt-2 text-xl font-black">Parle avec {publicStore.name}.</h2><p className="mt-2 text-xs font-semibold text-white/44">Une question sur les produits, la livraison ou une commande?</p></div><div className="flex w-full gap-2 sm:w-auto"><Link to={`/chat?contact=${encodeURIComponent(publicStore.ownerId)}&name=${encodeURIComponent(publicStore.ownerName)}&store=${publicStore.id}`} className="flex-1 rounded-xl bg-[#15EA3E] px-4 py-3 text-center text-[10px] font-black uppercase tracking-wider text-black sm:flex-none">Contacter</Link><button type="button" onClick={() => void shareStore()} className="flex-1 rounded-xl border border-white/12 bg-black/20 px-4 py-3 text-[10px] font-black uppercase tracking-wider text-white/75 sm:flex-none">Partager</button></div></div></section>

      <section className="mx-auto max-w-6xl px-4 pt-9 sm:px-6 lg:px-8"><div className="grid gap-7 lg:grid-cols-[1.2fr_.8fr]"><div><div className="flex items-center justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#15EA3E]">Avis clients</p><h2 className="mt-1 text-xl font-black">Ils parlent de la boutique</h2></div><span className="flex items-center gap-1 text-sm font-black text-[#FFD84D]"><AfriZiaIcon name="star" size={15} className="fill-current" />{reviewAverage ? reviewAverage.toFixed(1) : '0.0'}</span></div>{reviews.length > 0 ? <div className="mt-4 grid gap-2 sm:grid-cols-2">{reviews.slice(0, 4).map((review) => <article key={review.id} className="border border-white/10 bg-white/[0.035] p-3"><div className="flex items-center justify-between gap-2"><p className="truncate text-xs font-black">{review.authorName}</p><span className="flex items-center gap-1 text-[10px] font-black text-[#FFD84D]"><AfriZiaIcon name="star" size={11} className="fill-current" />{review.rating}</span></div>{review.text && <p className="mt-2 text-[11px] font-semibold leading-relaxed text-white/52">{review.text}</p>}</article>)}</div> : <p className="mt-4 border border-dashed border-white/12 p-4 text-xs font-semibold text-white/42">Cette boutique n'a pas encore reçu d'avis.</p>}</div><div className="border border-white/10 bg-white/[0.035] p-5"><p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#15EA3E]">Ton expérience</p><h2 className="mt-1 text-xl font-black">Évalue la boutique</h2><div className="mt-4 flex gap-1">{[1, 2, 3, 4, 5].map((rating) => <button key={rating} type="button" onClick={() => setReviewRating(rating)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-black/22" aria-label={`Noter ${rating}`}><AfriZiaIcon name="star" size={16} className={rating <= reviewRating ? 'fill-current text-[#FFD84D]' : 'text-white/24'} /></button>)}</div><textarea value={reviewText} onChange={(event) => setReviewText(event.target.value)} rows={3} placeholder="Ton avis sur cette boutique..." className="mt-3 w-full resize-none border border-white/10 bg-black/22 px-3 py-3 text-xs font-semibold outline-none focus:border-[#15EA3E]/45" /><button type="button" onClick={() => void submitStoreReview()} disabled={submittingFeedback} className="mt-3 h-10 w-full rounded-xl bg-[#15EA3E] text-[10px] font-black uppercase tracking-wider text-black disabled:opacity-50">{submittingFeedback ? 'Envoi...' : 'Publier la note'}</button></div></div></section>

      <section className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 lg:px-8"><button type="button" onClick={() => void reportStore()} disabled={submittingFeedback} className="w-full border border-red-500/30 bg-red-500/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-red-300 disabled:opacity-50">Signaler cette boutique</button>{feedbackStatus && <p className="mt-3 border border-white/10 bg-white/[0.04] p-3 text-center text-xs font-bold text-white/58">{feedbackStatus}</p>}</section>

      <footer className="mx-auto mt-10 max-w-6xl border-t border-white/10 px-4 pb-8 pt-7 sm:px-6 lg:px-8"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start"><div className="flex items-center gap-3"><img src={publicStore.logoURL} alt="" className="h-10 w-10 rounded-xl object-cover" /><div><p className="text-sm font-black">{publicStore.name}</p><p className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] text-[#15EA3E]">Boutique Zandofy</p></div></div><div className="flex flex-wrap gap-x-5 gap-y-2 text-[10px] font-bold text-white/45"><a href="#store-top" className="hover:text-[#15EA3E]">Accueil</a><a href="#products" className="hover:text-[#15EA3E]">Produits</a><a href="#promos" className="hover:text-[#15EA3E]">Promotions</a><a href="/market/orders?module=zandofy&view=purchases" className="hover:text-[#15EA3E]">Mes achats</a><a href="#contact" className="hover:text-[#15EA3E]">Contact</a></div></div><div className="mt-7 flex flex-col justify-between gap-2 border-t border-white/8 pt-4 text-[9px] font-semibold text-white/28 sm:flex-row"><span>{publicStore.city}, {publicStore.country}</span><span>Propulsé par Zandofy · AfriZia</span></div></footer>
    </main>
  );
}

export function ZikMartMarketplaceScreen() {
  const navigate = useNavigate();
  const { user } = useFirebaseAuth();
  const { marketProducts, zikMartProducts, loading } = useAfriMarket();
  const { ownerStore } = useZandofyStore();
  const openCheckout = useAppStore((state) => state.openCheckout);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Tout');
  const availableProducts = Array.from(new Map([
    ...zikMartProducts,
    ...marketProducts.filter((product) => product.productKind === 'physical')
  ].map((product) => [product.id, product])).values());
  const categories = Array.from(new Set(availableProducts.map((product) => product.catalogCategory || 'Autres')));
  const products = availableProducts.filter((product) => {
    const text = `${product.title} ${product.description} ${product.supplierName} ${product.catalogCategory}`.toLowerCase();
    return (category === 'Tout' || product.catalogCategory === category) && (!query.trim() || text.includes(query.trim().toLowerCase()));
  });

  const addToStore = (product: AfriMarketContent) => {
    if (!user) {
      navigate('/login', { state: { next: `/zikmart?add=${encodeURIComponent(product.id)}` } });
      return;
    }
    if (!ownerStore) {
      navigate('/zandofy/create');
      return;
    }
    navigate(`/zandofy/products/new?sourceProductId=${encodeURIComponent(product.id)}`, { state: { sourceProduct: product } });
  };

  if (loading) return <main className="flex min-h-full items-center justify-center bg-[#030604] text-white">Chargement ZikMart...</main>;

  return (
    <main className="min-h-full overflow-y-auto bg-[#030604] pb-24 text-white scrollbar-hide">
      <header className="sticky top-0 z-20 bg-[#030604]/92 px-4 pb-4 pt-4 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={() => navigate(-1)} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]"><AfriZiaIcon name="arrow" size={16} className="rotate-180" /></button>
          <div className="text-center"><p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">ZikMart</p><h1 className="text-sm font-black">Sourcing physique</h1></div>
          <AfriZiaIcon name="market" size={20} className="text-[#15EA3E]" />
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-[#15EA3E]/18 bg-[#071007] px-3 py-2"><AfriZiaIcon name="search" size={16} className="text-[#15EA3E]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un produit ou fournisseur" className="h-9 min-w-0 flex-1 bg-transparent text-xs font-bold outline-none placeholder:text-white/30" /></div>
        <div className="scrollbar-hide mt-3 flex gap-2 overflow-x-auto pb-1"><button type="button" onClick={() => setCategory('Tout')} className={cn('shrink-0 rounded-full px-3 py-2 text-[9px] font-black', category === 'Tout' ? 'bg-[#15EA3E] text-black' : 'border border-white/10 text-white/50')}>Tout</button>{categories.map((item) => <button key={item} type="button" onClick={() => setCategory(item)} className={cn('shrink-0 rounded-full px-3 py-2 text-[9px] font-black', category === item ? 'bg-[#15EA3E] text-black' : 'border border-white/10 text-white/50')}>{item}</button>)}</div>
      </header>
      <section className="px-4 pt-5"><div className="rounded-[1.7rem] border border-[#15EA3E]/18 bg-[radial-gradient(circle_at_10%_10%,rgba(21,234,62,0.18),transparent_36%),#071007] p-5"><p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#15EA3E]">Marketplace fournisseur</p><h2 className="mt-2 text-2xl font-black">Des produits, des sources, une marge claire.</h2><p className="mt-2 text-xs font-semibold leading-relaxed text-white/45">ZikMart rassemble les produits physiques publiés volontairement depuis les boutiques Zandofy.</p></div></section>
      <section className="grid grid-cols-2 gap-3 px-4 pt-5">{products.map((product) => <article key={product.id} className="overflow-hidden rounded-[1.4rem] border border-white/10 bg-white/[0.04]"><Link to={getZikMartProductPath(product)} className="block"><img src={product.coverURL || '/afrimarket.jpeg'} alt={product.title} className="h-32 w-full object-cover" /><div className="p-3"><p className="line-clamp-2 min-h-[32px] text-xs font-black">{product.title}</p><p className="mt-2 text-[9px] font-black uppercase tracking-wider text-[#15EA3E]">{product.catalogCategory || 'Autres'}</p><p className="mt-1 text-sm font-black">{formatZandofyMoney(product.price || 0, product.currency)}</p><p className="mt-2 text-[9px] font-semibold text-white/42">{product.supplierName || 'Vendeur direct'}{product.supplierLeadTimeDays ? ` · ${product.supplierLeadTimeDays} j` : ''}</p></div></Link><div className="grid grid-cols-2 gap-2 p-3 pt-0"><button type="button" onClick={() => openCheckout(toCheckoutProduct(product))} className="rounded-xl border border-white/10 bg-black/20 py-2.5 text-[9px] font-black uppercase tracking-wider text-white/70">Acheter</button><button type="button" onClick={() => addToStore(product)} className="rounded-xl bg-[#15EA3E] py-2.5 text-[9px] font-black uppercase tracking-wider text-black">Ajouter</button></div></article>)}</section>
      {!products.length && <p className="mx-4 mt-5 rounded-2xl border border-dashed border-white/14 p-6 text-center text-xs font-bold text-white/45">Aucun produit ZikMart ne correspond à ta recherche.</p>}
    </main>
  );
}
