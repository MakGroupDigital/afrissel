import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { onValue, push, ref, serverTimestamp, set } from 'firebase/database';
import { AfriSellIcon, AfriSellIconName } from '../components/AfriSellIcon';
import { useFirebaseAuth } from '../hooks/useFirebaseAuth';
import { ZandofyTheme, getZandofyStoreURL, useZandofyStore } from '../hooks/useZandofyStore';
import { AFRICAN_COUNTRIES_BY_PRIORITY, getCountryByCode, getDeviceCityHint, getDeviceCountryCode } from '../lib/africaLocation';
import { realtimeDb } from '../lib/firebase';
import { cn } from '../lib/utils';
import { getZandofyRecommendations, rememberZandofyInterest } from '../domains/commerce/zandofyRecommendations';

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
  { label: 'Réglage', icon: 'settings' as const, route: '/zandofy/domain' }
];

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
  icon: AfriSellIconName;
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
    multiple: false,
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
    multiple: false,
    uploadLabel: 'Importer fichier de clés ou preuve licence',
    deliveryNote: 'Une clé ou instruction d’activation est fournie au client.'
  },
  Billet: {
    label: 'Billet',
    icon: 'scan',
    hint: 'Billet dynamique avec QR, code-barres et référence.',
    accept: 'image/*,application/pdf,.pdf',
    multiple: false,
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
            <AfriSellIcon name="arrow" size={18} className="rotate-180" />
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
              Vends formations, fichiers, licences, contenus, billets et produits numériques avec AfriSpay sur Zandofy.
            </p>
          </div>
        </div>
      </header>

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
                <p className="truncate text-[10px] font-semibold text-white/42">{store.city}, {store.country} - {store.digitalProductsCount} digital</p>
              </div>
              <AfriSellIcon name="arrow" size={14} className="text-[#15EA3E]" />
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
  const [tagline, setTagline] = useState('Produits digitaux, livrés instantanément.');
  const [countryCode, setCountryCode] = useState(detectedCountry.code);
  const [city, setCity] = useState(getInitialCity(detectedCountry.code));
  const [theme, setTheme] = useState<ZandofyTheme>('emerald');
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
        theme
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
          <AfriSellIcon name="arrow" size={16} className={step ? 'rotate-180' : 'rotate-180'} />
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
              <AfriSellIcon name="gallery" size={18} className="text-[#15EA3E]" />
              <input type="file" accept="image/*" className="hidden" onChange={handleLogo} />
            </label>
            <div className="mt-4 grid grid-cols-4 gap-2">
              {(['emerald', 'midnight', 'sunrise', 'mono'] as ZandofyTheme[]).map((item) => (
                <button key={item} type="button" onClick={() => setTheme(item)} className={cn('h-16 rounded-2xl border bg-gradient-to-br', themeStyles[item], theme === item ? 'border-[#15EA3E]' : 'border-white/10')} />
              ))}
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
          <p className="mt-2 text-sm font-semibold text-white/48">Crée ta boutique digitale avant d’accéder au dashboard.</p>
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
          <AfriSellIcon name="arrow" size={16} className="rotate-180" />
        </button>
        <div className="text-center">
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">Zandofy</p>
          <h1 className="text-sm font-black">Dashboard</h1>
        </div>
        <Link to={`/zandofy/${store.slug}`} className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#15EA3E] text-black">
          <AfriSellIcon name="eye" size={16} />
        </Link>
      </header>

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
              [products.length || store.digitalProductsCount, 'Produits'],
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
                <AfriSellIcon name={action.icon} size={17} />
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
              <Link key={product.id} to={`/zandofy/product/${product.id}`} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-2">
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

export function ZandofyStatsScreen() {
  const navigate = useNavigate();
  const { ownerStore, products, loading } = useZandofyStore();
  const { orders, loadingOrders } = useZandofyOrders(ownerStore?.id, ownerStore?.ownerId);
  const [reviewCount, setReviewCount] = useState(0);

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

  const stats = useMemo(() => {
    const paidOrdersList = orders.filter((order) => ['paid', 'preparing', 'delivering', 'completed'].includes(order.status) || order.paymentStatus === 'confirmed');
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
        orders: orders.filter((order) => order.productId === product.id).length,
        revenue: orders
          .filter((order) => order.productId === product.id && ['paid', 'completed'].includes(order.status))
          .reduce((total, order) => total + Number(order.sellerNetAmount ?? order.totalAmount ?? 0), 0)
      }))
      .sort((first, second) => second.revenue - first.revenue || second.orders - first.orders)
      .slice(0, 5);

    return { revenue, netRevenue, fppTotal, clients, paidOrders, inProgress, recentOrders, lowStock, averageOrder, topProducts };
  }, [orders, products]);

  if (loading || loadingOrders) return <main className="flex min-h-full items-center justify-center bg-[#030604] text-white">Chargement statistiques...</main>;
  if (!ownerStore) return <main className="flex min-h-full items-center justify-center bg-[#030604] text-white">Boutique introuvable.</main>;

  return (
    <main className="min-h-full overflow-y-auto bg-[#030604] pb-24 text-white scrollbar-hide">
      <header className="sticky top-0 z-20 flex items-center justify-between bg-[#030604]/90 px-4 pb-3 pt-4 backdrop-blur-xl">
        <button type="button" onClick={() => navigate('/zandofy/dashboard')} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]">
          <AfriSellIcon name="arrow" size={16} className="rotate-180" />
        </button>
        <div className="text-center">
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">Zandofy</p>
          <h1 className="text-sm font-black">Statistique</h1>
        </div>
        <AfriSellIcon name="signal" size={20} className="text-[#15EA3E]" />
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
          <h2 className="text-sm font-black">Produits les plus performants</h2>
          <div className="mt-4 space-y-2">
            {stats.topProducts.length ? stats.topProducts.map(({ product, orders: productOrders, revenue }) => (
              <Link key={product.id} to={`/zandofy/product/${product.id}`} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-2">
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
          <AfriSellIcon name="arrow" size={16} className="rotate-180" />
        </button>
        <div className="text-center">
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">Zandofy</p>
          <h1 className="text-sm font-black">Mes clients</h1>
        </div>
        <AfriSellIcon name="contact" size={20} className="text-[#15EA3E]" />
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
              <img src={client.avatar || '/Logo-afriSell-Super App icône.png'} alt="" className="h-12 w-12 rounded-2xl object-cover" />
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
            <AfriSellIcon name="contact" size={28} className="mx-auto text-[#15EA3E]" />
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
  const { ownerStore, loading, createDigitalProduct } = useZandofyStore();
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
  const [sku, setSku] = useState('');
  const [shippingPrice, setShippingPrice] = useState('');
  const [shippingRegions, setShippingRegions] = useState('RDC');
  const [publishToAfriZia, setPublishToAfriZia] = useState(true);
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
        sku: string;
        shippingPrice: string;
        shippingRegions: string;
        publishToAfriZia: boolean;
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
      setSku(draft.sku || '');
      setShippingPrice(draft.shippingPrice || '');
      setShippingRegions(draft.shippingRegions || 'RDC');
      setPublishToAfriZia(draft.publishToAfriZia !== false);
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
      sku,
      shippingPrice,
      shippingRegions,
      publishToAfriZia,
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
    salePrice,
    shippingPrice,
    shippingRegions,
    sku,
    stock,
    stockMode,
    fppRate,
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
        <p className="mt-2 text-sm font-semibold text-white/48">Les produits digitaux Zandofy doivent être liés à une boutique.</p>
        <Link to="/zandofy/create" className="mt-5 rounded-2xl bg-[#15EA3E] px-5 py-3 text-xs font-black uppercase tracking-wider text-black">Créer boutique</Link>
      </main>
    );
  }

  const canContinue = step === 0
    ? productKind === 'physical' || Boolean(digitalType)
    : step === 1
      ? title.trim().length >= 3 && description.trim().length >= 12 && Boolean(coverFile) &&
        (pricingMode === 'free' || Number(price) > 0) &&
        (productKind === 'digital' || stockMode === 'unlimited' || (stock.trim() !== '' && Number(stock) >= 0))
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
    setDeliveryFiles(selectedDigitalConfig.multiple ? files : files.slice(0, 1));
    setDeliveryFile(files[0] || null);
    event.target.value = '';
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
        deliveryMode,
        deliveryFile,
        deliveryFiles,
        deliveryURL,
        accessNote,
        stockMode,
        stock: stockMode === 'tracked' ? Number(stock) : undefined,
        fppRate: Number(fppRate || 0),
        sku,
        shippingPrice: Number(shippingPrice || 0),
        shippingRegions: shippingRegions.split(',').map((region) => region.trim()).filter(Boolean),
        publishToAfriZia,
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
          <AfriSellIcon name="arrow" size={16} className="rotate-180" />
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
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#15EA3E] text-black"><AfriSellIcon name={icon as AfriSellIconName} size={15} /></span>
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
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#15EA3E] text-black"><AfriSellIcon name={config.icon} size={15} /></span>
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
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={`Nom ${productKind === 'physical' ? 'du produit' : selectedDigitalConfig.label.toLowerCase()}`} className="mt-5 w-full rounded-2xl border border-white/10 bg-black/28 px-4 py-4 text-sm font-bold outline-none focus:border-[#15EA3E]/45" />
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} placeholder="Ce que l’acheteur reçoit, le résultat attendu, le niveau..." className="mt-3 w-full resize-none rounded-2xl border border-white/10 bg-black/28 px-4 py-4 text-sm font-bold outline-none focus:border-[#15EA3E]/45" />
            <input value={collection} onChange={(event) => setCollection(event.target.value)} placeholder="Collection" className="mt-3 w-full rounded-2xl border border-white/10 bg-black/28 px-4 py-4 text-sm font-bold outline-none" />
            <input value={catalogCategory} onChange={(event) => setCatalogCategory(event.target.value)} placeholder="Catégorie du catalogue" className="mt-3 w-full rounded-2xl border border-white/10 bg-black/28 px-4 py-4 text-sm font-bold outline-none" />
            <label className="mt-5 block overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/28">
              <img src={coverPreview} alt="" className="h-40 w-full object-cover" />
              <span className="flex items-center justify-between px-4 py-3 text-xs font-black text-white/62">
                Couverture du produit obligatoire
                <AfriSellIcon name="gallery" size={16} className="text-[#15EA3E]" />
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
            <label className="mt-4 flex items-center gap-3 rounded-2xl border border-[#15EA3E]/18 bg-[#15EA3E]/8 p-3">
              <input type="checkbox" checked={publishToAfriZia} onChange={(event) => setPublishToAfriZia(event.target.checked)} className="h-4 w-4 accent-[#15EA3E]" />
              <span><span className="block text-xs font-black">Afficher aussi dans AfriZia</span><span className="mt-1 block text-[10px] font-semibold text-white/42">Désactive pour garder le produit uniquement dans ta boutique.</span></span>
            </label>
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
                    <AfriSellIcon name={selectedDigitalConfig.icon} size={22} className="text-[#15EA3E]" />
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
                    {deliveryFiles.slice(0, 5).map((file) => (
                      <div key={`${file.name}-${file.size}`} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/22 px-3 py-2">
                        <AfriSellIcon name="file" size={14} className="text-[#15EA3E]" />
                        <span className="min-w-0 flex-1 truncate text-[10px] font-bold text-white/58">{file.name}</span>
                        <span className="text-[9px] font-black text-white/30">{Math.max(1, Math.round(file.size / 1024))} Ko</span>
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
  const [sku, setSku] = useState('');
  const [deliveryMode, setDeliveryMode] = useState<'shipping' | 'pickup' | 'file' | 'link'>('shipping');
  const [shippingPrice, setShippingPrice] = useState('');
  const [shippingRegions, setShippingRegions] = useState('RDC');
  const [publishToAfriZia, setPublishToAfriZia] = useState(true);
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
    setSku(product.sku || '');
    setDeliveryMode(product.deliveryMode || (product.productKind === 'physical' ? 'shipping' : 'file'));
    setShippingPrice(String(product.shippingPrice || 0));
    setShippingRegions(product.shippingRegions?.join(', ') || 'RDC');
    setPublishToAfriZia(product.publishToAfriZia !== false);
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
        sku,
        deliveryMode,
        shippingPrice: Number(shippingPrice || 0),
        shippingRegions: shippingRegions.split(',').map((region) => region.trim()).filter(Boolean),
        publishToAfriZia
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
          <AfriSellIcon name="arrow" size={16} className="rotate-180" />
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
        </section>

        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <input type="checkbox" checked={publishToAfriZia} onChange={(event) => setPublishToAfriZia(event.target.checked)} className="h-4 w-4 accent-[#15EA3E]" />
          <span><span className="block text-xs font-black">Visible dans AfriZia</span><span className="mt-1 block text-[10px] font-semibold text-white/42">Désactive pour garder le produit uniquement dans ta boutique.</span></span>
        </label>

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
          <AfriSellIcon name="arrow" size={16} className="rotate-180" />
        </button>
        <div className="text-center">
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">Zandofy</p>
          <h1 className="text-sm font-black">Catalogue Zandofy</h1>
        </div>
        <Link to="/zandofy/products/new" className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#15EA3E] text-black">
          <AfriSellIcon name="plus" size={16} />
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
            <Link to={`/zandofy/product/${product.id}`} className="block">
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
                {product.productKind === 'physical' && product.stockMode === 'tracked' && <div className="mt-1 flex items-center gap-1">
                  <button type="button" aria-label="Diminuer le stock" disabled={stockBusy === product.id} onClick={async (event) => { event.preventDefault(); setStockBusy(product.id); setStockStatus(''); try { await setProductStock(product.id, Math.max(0, Number(product.stock || 0) - 1)); } catch (error) { setStockStatus(error instanceof Error ? error.message : 'Stock impossible.'); } finally { setStockBusy(''); } }} className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 text-xs font-black">−</button>
                  <button type="button" aria-label="Augmenter le stock" disabled={stockBusy === product.id} onClick={async (event) => { event.preventDefault(); setStockBusy(product.id); setStockStatus(''); try { await setProductStock(product.id, Number(product.stock || 0) + 1); } catch (error) { setStockStatus(error instanceof Error ? error.message : 'Stock impossible.'); } finally { setStockBusy(''); } }} className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#15EA3E] text-xs font-black text-black">+</button>
                </div>}
              </div>
              <button type="button" aria-label="Modifier le produit" onClick={() => navigate(`/zandofy/products/${product.id}/edit`)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 text-[#15EA3E]"><AfriSellIcon name="edit" size={14} /></button>
            </div>
          </article>
        )) : (
          <div className="col-span-2 rounded-[1.6rem] border border-dashed border-white/14 p-6 text-center">
            <AfriSellIcon name="file" size={28} className="mx-auto text-[#15EA3E]" />
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
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!ownerStore) return;
    setName(ownerStore.name);
    setTagline(ownerStore.tagline);
    setTheme(ownerStore.theme);
    setLogoPreview(ownerStore.logoURL);
  }, [ownerStore]);

  if (loading) return <main className="flex min-h-full items-center justify-center bg-[#030604] text-white">Chargement domaine...</main>;
  if (!ownerStore) return <main className="flex min-h-full items-center justify-center bg-[#030604] text-white">Boutique introuvable.</main>;

  const saveDomain = async () => {
    setStatus('');
    try {
      await updateCustomDomain(domain);
      setStatus('Domaine enregistré. Les DNS seront vérifiables dès que l’infrastructure domaine sera connectée.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Domaine impossible.');
    }
  };

  const saveProfile = async () => {
    setStatus('');
    try {
      await updateStoreProfile({ name, tagline, theme, logoFile });
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
          <AfriSellIcon name="arrow" size={16} className="rotate-180" />
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
        </div>
      </section>

      <section className="px-4 pt-5">
        <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-5">
          <h2 className="text-xl font-black">Domaine personnalisé</h2>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-white/46">{ownerStore.customDomain ? `${ownerStore.customDomain} - ${ownerStore.customDomainStatus}` : 'Ajoute le domaine que tu veux connecter à ta boutique.'}</p>
          <div className="mt-5 flex gap-2">
            <input value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="boutique.com" className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/24 px-3 py-3 text-xs font-bold outline-none" />
            <button type="button" onClick={saveDomain} className="rounded-2xl bg-[#15EA3E] px-4 text-[10px] font-black uppercase tracking-wider text-black">Lier</button>
          </div>
          <div className="mt-5 rounded-2xl border border-[#15EA3E]/16 bg-[#15EA3E]/8 p-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-[#15EA3E]">DNS prévu</p>
            <p className="mt-2 text-xs font-bold text-white/60">CNAME www → cname.afrisell.app</p>
            <p className="mt-1 text-xs font-bold text-white/60">TXT _afrisell-verification → zandofy-{ownerStore.slug}</p>
          </div>
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
  const recommendedProducts = useMemo(
    () => getZandofyRecommendations(products, { collection: activeCollection, query: catalogQuery }).slice(0, 4),
    [activeCollection, catalogQuery, products]
  );

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
        authorName: profile?.displayName || user.displayName || 'Client AfriSell',
        rating: reviewRating,
        text,
        createdAt: Date.now()
      });
      const nextReviews = [
        ...reviews.filter((review) => review.authorId !== user.uid),
        {
          id: reviewId,
          authorId: user.uid,
          authorName: profile?.displayName || user.displayName || 'Client AfriSell',
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
        reporterName: profile?.displayName || user.displayName || 'Utilisateur AfriSell',
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
      if (navigator.share) {
        await navigator.share({ title: publicStore.name, text: publicStore.tagline, url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setFeedbackStatus('Lien de la boutique copié.');
      } else {
        setFeedbackStatus(url);
      }
    } catch {
      // L’utilisateur peut fermer la feuille de partage sans erreur à afficher.
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
    <main className="min-h-full overflow-y-auto bg-[#030604] pb-24 text-white scrollbar-hide">
      <header className={cn('relative overflow-hidden px-4 pb-8 pt-4 bg-gradient-to-br', themeStyles[publicStore.theme])}>
        <button type="button" onClick={() => navigate(-1)} className="relative z-10 flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-black/28">
          <AfriSellIcon name="arrow" size={16} className="rotate-180" />
        </button>
        <div className="relative z-10 mt-8 text-center">
          <img src={publicStore.logoURL} alt="" className="mx-auto h-24 w-24 rounded-[1.8rem] border border-white/12 object-cover shadow-[0_24px_60px_rgba(0,0,0,0.35)]" />
          <p className="mt-4 text-[10px] font-black uppercase tracking-[0.24em] text-[#15EA3E]">Zandofy Store</p>
          <h1 className="mt-2 text-3xl font-black leading-none">{publicStore.name}</h1>
          <p className="mx-auto mt-3 max-w-[300px] text-sm font-semibold leading-relaxed text-white/56">{publicStore.tagline}</p>
          <p className="mt-3 text-xs font-black text-white/38">{publicStore.city}, {publicStore.country}</p>
        </div>
      </header>

      <section className="px-4 pt-5">
        <div className="grid grid-cols-3 gap-2">
          {[
            [publicStore.digitalProductsCount + publicStore.physicalProductsCount, 'Produits'],
            [publicStore.ordersCount, 'Ventes'],
            [`${reviewAverage ? reviewAverage.toFixed(1) : publicStore.rating || 0}/5`, 'Score']
          ].map(([value, label]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center">
              <p className="text-sm font-black">{value}</p>
              <p className="mt-1 text-[8px] font-black uppercase tracking-wider text-white/38">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {recommendedProducts.length > 0 && (
        <section className="px-4 pt-5">
          <div className="rounded-[1.7rem] border border-[#15EA3E]/18 bg-[radial-gradient(circle_at_12%_8%,rgba(21,234,62,0.14),transparent_38%),#071007] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#15EA3E]">AfriAI</p>
                <h2 className="mt-1 text-sm font-black">Sélection pour toi</h2>
              </div>
              <AfriSellIcon name="signal" size={18} className="text-[#15EA3E]" />
            </div>
            <p className="mt-2 text-[10px] font-semibold leading-relaxed text-white/42">Suggestions calculées à partir de tes intérêts récents, des collections et de la disponibilité.</p>
            <div className="mt-4 flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
              {recommendedProducts.map((product) => (
                <Link key={product.id} to={`/zandofy/product/${product.id}`} onClick={() => rememberZandofyInterest(product)} className="w-[132px] shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/22">
                  <img src={product.coverURL} alt="" className="h-20 w-full object-cover" />
                  <div className="p-2.5">
                    <p className="line-clamp-2 text-[10px] font-black leading-tight">{product.title}</p>
                    <p className="mt-1 text-[10px] font-black text-[#15EA3E]">{product.isFree ? 'Gratuit' : `${product.price.toLocaleString('fr-FR')} ${product.currency}`}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="px-4 pt-5">
        <div className="rounded-[1.7rem] border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-black">Noter cette boutique</h2>
              <p className="mt-1 text-[11px] font-semibold text-white/45">{reviews.length} avis · {reviewAverage ? reviewAverage.toFixed(1) : '0.0'}/5</p>
            </div>
            <div className="flex items-center gap-1 text-[#FFD84D]">
              <AfriSellIcon name="star" size={16} className="fill-current" />
              <span className="text-sm font-black">{reviewAverage ? reviewAverage.toFixed(1) : '0.0'}</span>
            </div>
          </div>
          <div className="mt-4 flex gap-1">
            {[1, 2, 3, 4, 5].map((rating) => (
              <button
                key={rating}
                type="button"
                onClick={() => setReviewRating(rating)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-black/22"
                aria-label={`Noter ${rating}`}
              >
                <AfriSellIcon name="star" size={16} className={rating <= reviewRating ? 'fill-current text-[#FFD84D]' : 'text-white/24'} />
              </button>
            ))}
          </div>
          <textarea
            value={reviewText}
            onChange={(event) => setReviewText(event.target.value)}
            rows={3}
            placeholder="Ton avis sur cette boutique..."
            className="mt-3 w-full resize-none rounded-2xl border border-white/10 bg-black/22 px-4 py-3 text-xs font-semibold outline-none focus:border-[#15EA3E]/45"
          />
          <button
            type="button"
            onClick={() => void submitStoreReview()}
            disabled={submittingFeedback}
            className="mt-3 h-11 w-full rounded-2xl bg-[#15EA3E] text-[10px] font-black uppercase tracking-wider text-black disabled:opacity-50"
          >
            {submittingFeedback ? 'Envoi...' : 'Publier la note'}
          </button>
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
                  {review.text && <p className="mt-2 text-[11px] font-semibold leading-relaxed text-white/52">{review.text}</p>}
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="px-4 pt-5">
        <div className="rounded-[1.7rem] border border-white/10 bg-white/[0.04] p-5 text-center">
          <AfriSellIcon name="file" size={32} className="mx-auto text-[#15EA3E]" />
          <h2 className="mt-3 text-xl font-black">{products.length ? 'Catalogue de la boutique' : 'Catalogue bientôt disponible'}</h2>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-white/46">
            {products.length ? 'Produits digitaux et physiques disponibles sur cette boutique.' : 'Les produits de cette boutique apparaîtront ici.'}
          </p>
          {products.length > 0 && (
            <div className="mt-5">
              <div className="relative">
                <AfriSellIcon name="search" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35" />
                <input value={catalogQuery} onChange={(event) => setCatalogQuery(event.target.value)} placeholder="Rechercher dans la boutique" className="h-11 w-full rounded-2xl border border-white/10 bg-black/22 pl-9 pr-3 text-xs font-bold outline-none focus:border-[#15EA3E]/45" />
              </div>
              <div className="scrollbar-hide mt-3 flex gap-2 overflow-x-auto pb-1">
                {['Tout', ...collections].map((collection) => (
                  <button key={collection} type="button" onClick={() => setActiveCollection(collection)} className={cn('shrink-0 rounded-full border px-3 py-2 text-[9px] font-black', activeCollection === collection ? 'border-[#15EA3E] bg-[#15EA3E] text-black' : 'border-white/10 bg-black/20 text-white/55')}>
                    {collection}
                  </button>
                ))}
              </div>
              {visibleProducts.length > 0 ? <div className="mt-4 grid grid-cols-2 gap-3 text-left">
                {visibleProducts.slice(0, 12).map((product) => (
                  <Link key={product.id} to={`/zandofy/product/${product.id}`} className="overflow-hidden rounded-2xl border border-white/10 bg-black/22">
                    <img src={product.coverURL} alt="" className="h-24 w-full object-cover" />
                    <div className="p-3">
                      <p className="line-clamp-2 min-h-[32px] text-xs font-black leading-tight">{product.title}</p>
                      <p className="mt-2 text-[9px] font-black uppercase tracking-wider text-[#15EA3E]">{product.productKind === 'physical' ? product.catalogCategory || 'Produit physique' : product.digitalType}</p>
                      <p className="mt-1 text-xs font-black">{product.isFree ? 'Gratuit' : `${product.price.toLocaleString('fr-FR')} ${product.currency}`}</p>
                      {product.productKind === 'physical' && product.stockMode === 'tracked' && <p className={`mt-1 text-[9px] font-bold ${product.stock && product.stock > 0 ? 'text-white/42' : 'text-red-300'}`}>{product.stock && product.stock > 0 ? `${product.stock} disponible(s)` : 'Rupture de stock'}</p>}
                    </div>
                  </Link>
                ))}
              </div> : <p className="mt-4 rounded-2xl border border-dashed border-white/14 p-4 text-center text-xs font-bold text-white/44">Aucun produit ne correspond à ta recherche.</p>}
            </div>
          )}
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Link to={`/chat?contact=${encodeURIComponent(publicStore.ownerId)}&name=${encodeURIComponent(publicStore.ownerName)}&store=${publicStore.id}`} className="rounded-2xl bg-[#15EA3E] py-3 text-center text-[10px] font-black uppercase tracking-wider text-black">Contacter</Link>
            <button type="button" onClick={() => void shareStore()} className="rounded-2xl border border-white/10 bg-white/[0.05] py-3 text-[10px] font-black uppercase tracking-wider text-white/72">Partager</button>
          </div>
        </div>
      </section>

      <section className="px-4 pt-5">
        <button
          type="button"
          onClick={() => void reportStore()}
          disabled={submittingFeedback}
          className="w-full rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-red-300 disabled:opacity-50"
        >
          Signaler cette boutique
        </button>
        {feedbackStatus && (
          <p className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center text-xs font-bold text-white/58">
            {feedbackStatus}
          </p>
        )}
      </section>
    </main>
  );
}
