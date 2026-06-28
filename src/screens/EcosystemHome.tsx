import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, UIEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { onValue, ref, remove, set } from 'firebase/database';
import { Building2, CalendarDays, UtensilsCrossed } from 'lucide-react';
import { ecosystemModules } from '../data/ecosystem';
import { AfriSellIcon } from '../components/AfriSellIcon';
import { useFirebaseAuth } from '../hooks/useFirebaseAuth';
import { AfriMarketContent, formatMarketPrice, useAfriMarket } from '../hooks/useAfriMarket';
import { useAfriSpayWallet } from '../hooks/useAfriSpayWallet';
import { realtimeDb } from '../lib/firebase';

type QuickAction = {
  label: string;
  route: string;
  visual: 'restaurant' | 'event' | 'real-estate' | 'zandofy';
  requiresAuth?: boolean;
};

type TopFreelancer = {
  id: string;
  name: string;
  role: string;
  city: string;
  rating: string;
  image: string;
  skill: string;
  score: number;
};

type SupplierProfile = TopFreelancer;

type FreelanceEngagement = {
  likes?: Record<string, boolean>;
  ratings?: Record<string, number>;
};

const quickActions: QuickAction[] = [
  { label: 'Restauration', route: '/market', visual: 'restaurant' },
  { label: 'Event', route: '/biashara/kyaghanda', visual: 'event', requiresAuth: true },
  { label: 'Immo', route: '/safari/immobilier', visual: 'real-estate' },
  { label: 'Zandofy', route: '/market', visual: 'zandofy' }
];

const fallbackPromos = [
  { title: 'Mode locale', label: 'Market', image: '/afrimarket.jpeg', route: '/market' },
  { title: 'Videos marchandes', label: 'ABC', image: '/biashara.jpeg', route: '/feed' },
  { title: 'Paiement rapide', label: 'AfriSpay', image: '/afrispay.jpeg', route: '/wallet' },
  { title: 'Mobilite et immobilier', label: 'Safari', image: '/safari.jpeg', route: '/ecosystem' },
  { title: 'Conversation vendeur', label: 'AfriChat', image: '/africhat.jpeg', route: '/chat' }
];

const fallbackAbc = [
  {
    id: 'abc-video',
    title: 'Live commerce',
    description: 'Videos, offres et produits en direct.',
    coverURL: '/biashara.jpeg',
    format: 'video' as const,
    route: '/feed'
  },
  {
    id: 'market-products',
    title: 'Produits populaires',
    description: 'Articles disponibles dans Market.',
    coverURL: '/afrimarket.jpeg',
    format: 'gallery' as const,
    route: '/market'
  },
  {
    id: 'wallet-pay',
    title: 'Payer avec AfriSpay',
    description: 'Depot, retrait, transfert et QR.',
    coverURL: '/afrispay.jpeg',
    format: 'article' as const,
    route: '/wallet'
  }
];

const freelanceSubtypes = new Set(['freelancer', 'creative', 'tech_service', 'local_service']);
const supplierSubtypes = new Set(['supplier', 'b2b_supplier', 'b2c_supplier', 'importer', 'local_distributor']);

const getProfileText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const formatCompactCount = (value: number) => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(value >= 10000000 ? 0 : 1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K`;
  return String(value);
};

const getEngagementStats = (engagement?: FreelanceEngagement) => {
  const likes = Object.values(engagement?.likes || {}).filter(Boolean).length;
  const ratings = Object.values(engagement?.ratings || {})
    .map(Number)
    .filter((rating) => Number.isFinite(rating) && rating > 0);
  const ratingCount = ratings.length;
  const ratingAverage = ratingCount
    ? ratings.reduce((total, rating) => total + rating, 0) / ratingCount
    : 0;

  return { likes, ratingAverage, ratingCount };
};

const getActionErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const message = record.message || record.code || record.error;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
};

function QuickActionArtwork({ visual }: { visual: QuickAction['visual'] }) {
  if (visual === 'zandofy') {
    return <img src="/zandofyiconeapp.png" alt="" className="h-full w-full scale-[1.35] object-cover" />;
  }

  const Icon = visual === 'restaurant'
    ? UtensilsCrossed
    : visual === 'event'
      ? CalendarDays
      : Building2;

  return (
    <span className="afrisell-quick-artwork relative flex h-full w-full items-center justify-center overflow-hidden">
      <span className="absolute left-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#15EA3E]/45" />
      <span className="absolute bottom-1.5 right-1.5 h-1 w-1 rounded-full bg-[#15EA3E]" />
      <span className="absolute inset-2 rounded-xl border border-[#15EA3E]/12" />
      <Icon size={22} strokeWidth={2.15} className="relative z-10 text-[#15EA3E]" />
    </span>
  );
}

const normalizeFreelancer = (uid: string, rawProfile: Record<string, unknown>): TopFreelancer | null => {
  const businessAccount = rawProfile.businessAccount as Record<string, unknown> | undefined;
  const businessAccounts = Object.values((rawProfile.businessAccounts as Record<string, Record<string, unknown>> | undefined) || {});
  const primarySubtype = getProfileText(rawProfile.primarySubtype);
  const freelanceAccount = [businessAccount, ...businessAccounts].find((account) => (
    getProfileText(account?.serviceId) === 'freelance' ||
    getProfileText(account?.segmentId) === 'freelance'
  ));
  const isFreelance = (
    Boolean(freelanceAccount) ||
    freelanceSubtypes.has(primarySubtype)
  );

  if (!isFreelance) return null;

  const displayName = getProfileText(rawProfile.displayName) || getProfileText(rawProfile.businessName) || 'Freelance AfriSell';
  const role = getProfileText(freelanceAccount?.segmentLabel) || getProfileText(freelanceAccount?.serviceLabel) || 'Freelance';
  const score = Number(rawProfile.freelanceScore || rawProfile.rating || rawProfile.recommendations || 0);
  const ratingValue = Number(rawProfile.rating || 0);

  return {
    id: uid,
    name: displayName,
    role,
    city: getProfileText(rawProfile.city) || getProfileText(rawProfile.country) || 'AfriSell',
    rating: ratingValue ? ratingValue.toFixed(1) : 'Nouveau',
    image: getProfileText(rawProfile.photoURL) || getProfileText(rawProfile.logoURL) || '/a-freelance.jpeg',
    skill: getProfileText(rawProfile.bio) || getProfileText(freelanceAccount?.serviceLabel) || 'Services professionnels sur A-Freelance.',
    score
  };
};

const normalizeSupplier = (uid: string, rawProfile: Record<string, unknown>): SupplierProfile | null => {
  const businessAccount = rawProfile.businessAccount as Record<string, unknown> | undefined;
  const businessAccounts = Object.values((rawProfile.businessAccounts as Record<string, Record<string, unknown>> | undefined) || {});
  const primarySubtype = getProfileText(rawProfile.primarySubtype);
  const supplierAccount = [businessAccount, ...businessAccounts].find((account) => (
    getProfileText(account?.serviceId) === 'supplier' ||
    supplierSubtypes.has(getProfileText(account?.segmentId))
  ));
  const isSupplier = (
    Boolean(supplierAccount) ||
    supplierSubtypes.has(primarySubtype)
  );

  if (!isSupplier) return null;

  const displayName = getProfileText(rawProfile.businessName) || getProfileText(rawProfile.displayName) || 'Fournisseur AfriSell';
  const role = getProfileText(supplierAccount?.segmentLabel) || getProfileText(supplierAccount?.serviceLabel) || 'Fournisseur';
  const score = Number(rawProfile.supplierScore || rawProfile.recommendations || rawProfile.rating || 0);

  return {
    id: uid,
    name: displayName,
    role,
    city: getProfileText(rawProfile.city) || getProfileText(rawProfile.country) || 'AfriSell',
    rating: 'Reel',
    image: getProfileText(rawProfile.logoURL) || getProfileText(rawProfile.photoURL) || '/afrimarket.jpeg',
    skill: getProfileText(rawProfile.bio) || 'Approvisionnement, distribution et offres business.',
    score
  };
};

const getContentRoute = (content: AfriMarketContent) =>
  content.isSellable ? `/market/${content.id}` : '/feed';

export default function EcosystemHome() {
  const navigate = useNavigate();
  const [freelanceFeedback, setFreelanceFeedback] = useState<Record<string, string>>({});
  const [freelanceEngagements, setFreelanceEngagements] = useState<Record<string, FreelanceEngagement>>({});
  const [topFreelancers, setTopFreelancers] = useState<TopFreelancer[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierProfile[]>([]);
  const [activeFreelanceIndex, setActiveFreelanceIndex] = useState(0);
  const [isLightMode, setIsLightMode] = useState(() => window.localStorage.getItem('afrisell:ecosystem-theme') === 'light');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAfriAiOpen, setIsAfriAiOpen] = useState(false);
  const [isHomeChromeVisible, setIsHomeChromeVisible] = useState(true);
  const lastHomeScrollTopRef = useRef(0);
  const { profile, user } = useFirebaseAuth();
  const { abcContents, marketProducts } = useAfriMarket();
  const { balance, currency, loading: walletLoading } = useAfriSpayWallet();
  const firstName = (profile?.displayName || user?.displayName || 'Utilisateur').split(' ')[0];
  const walletLabel = user
    ? walletLoading
      ? '...'
      : formatMarketPrice(balance, currency) || `${balance.toLocaleString('fr-FR')} ${currency}`
    : 'Wallet';
  const promoProducts = [...marketProducts, ...abcContents].slice(0, 8);
  const promoItems = promoProducts.length
    ? promoProducts.map((item) => ({
        title: item.title,
        label: item.category || (item.isSellable ? 'Market' : 'ABC'),
        image: item.coverURL || '/afrimarket.jpeg',
        route: getContentRoute(item),
        price: formatMarketPrice(item.villagePrice || item.price, item.currency)
      }))
    : fallbackPromos;
  const abcItems = abcContents.length ? abcContents.slice(0, 6) : fallbackAbc;
  const getActionLink = (action: QuickAction) => (
    action.requiresAuth && !user ? '/login' : action.route
  );
  const universalSearchItems = useMemo(() => {
    const moduleItems = ecosystemModules.map((module) => ({
      id: `module-${module.id}`,
      title: module.name,
      meta: module.promise,
      image: module.logo,
      route: module.route,
      type: 'App'
    }));
    const actionItems = quickActions.map((action) => ({
      id: `action-${action.label}`,
      title: action.label,
      meta: 'Action rapide',
      image: '',
      route: getActionLink(action),
      type: 'Action',
      state: action.requiresAuth && !user ? { next: action.route } : undefined
    }));
    const contentItems = [...marketProducts, ...abcContents].slice(0, 18).map((content) => ({
      id: `content-${content.id}`,
      title: content.title,
      meta: content.category || (content.isSellable ? 'Market' : 'ABC'),
      image: content.coverURL,
      route: getContentRoute(content),
      type: content.isSellable ? 'Produit' : 'Contenu'
    }));

    return [...moduleItems, ...actionItems, ...contentItems];
  }, [abcContents, marketProducts, user]);
  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];

    return universalSearchItems
      .filter((item) => `${item.title} ${item.meta} ${item.type}`.toLowerCase().includes(query))
      .slice(0, 6);
  }, [searchQuery, universalSearchItems]);
  const submitUniversalSearch = (event: FormEvent) => {
    event.preventDefault();
    const firstResult = searchResults[0];
    if (!firstResult) return;
    if ('state' in firstResult && firstResult.state) {
      navigate(firstResult.route, { state: firstResult.state });
      return;
    }
    navigate(firstResult.route);
  };
  const handleHomeScroll = (event: UIEvent<HTMLDivElement>) => {
    const nextScrollTop = event.currentTarget.scrollTop;
    const delta = nextScrollTop - lastHomeScrollTopRef.current;

    if (nextScrollTop <= 12) {
      setIsHomeChromeVisible(true);
    } else if (delta > 5) {
      setIsHomeChromeVisible(false);
    } else if (delta < -5) {
      setIsHomeChromeVisible(true);
    }

    lastHomeScrollTopRef.current = nextScrollTop;
  };
  const visibleFreelancers = useMemo(() => {
    if (!topFreelancers.length) return [];

    return Array.from({ length: Math.min(3, topFreelancers.length) }, (_, offset) => (
      topFreelancers[(activeFreelanceIndex + offset) % topFreelancers.length]
    ));
  }, [activeFreelanceIndex, topFreelancers]);
  const activeFreelance = visibleFreelancers[0];
  const activeStats = getEngagementStats(activeFreelance ? freelanceEngagements[activeFreelance.id] : undefined);
  const activeUserRating = activeFreelance && user
    ? Number(freelanceEngagements[activeFreelance.id]?.ratings?.[user.uid] || 0)
    : 0;
  const activeUserLiked = Boolean(activeFreelance && user && freelanceEngagements[activeFreelance.id]?.likes?.[user.uid]);
  const getContactChatRoute = (contact: TopFreelancer | SupplierProfile) => (
    `/chat?contact=${encodeURIComponent(contact.id)}&name=${encodeURIComponent(contact.name)}&status=${encodeURIComponent(`${contact.role} - ${contact.city}`)}&avatar=${encodeURIComponent(contact.image)}`
  );
  const moveFreelanceStack = () => {
    setActiveFreelanceIndex((current) => (
      topFreelancers.length ? (current + 1) % topFreelancers.length : 0
    ));
  };
  const handleShareFreelance = async (freelance: TopFreelancer) => {
    const text = `${freelance.name} - ${freelance.role} sur AfriSell`;

    try {
      if (navigator.share) {
        await navigator.share({ title: 'Freelance AfriSell', text, url: window.location.origin + '/ecosystem' });
        setFreelanceFeedback((current) => ({ ...current, [freelance.id]: 'Partage ouvert' }));
        return;
      }

      await navigator.clipboard?.writeText(text);
      setFreelanceFeedback((current) => ({ ...current, [freelance.id]: 'Lien copie' }));
    } catch (shareError) {
      setFreelanceFeedback((current) => ({
        ...current,
        [freelance.id]: getActionErrorMessage(shareError, 'Partage indisponible')
      }));
    }
  };
  const handleLikeFreelance = async (freelance: TopFreelancer) => {
    if (!user) {
      setFreelanceFeedback((current) => ({ ...current, [freelance.id]: 'Connecte-toi pour liker' }));
      return;
    }

    const likeRef = ref(realtimeDb, `freelanceEngagements/${freelance.id}/likes/${user.uid}`);
    const isLiked = Boolean(freelanceEngagements[freelance.id]?.likes?.[user.uid]);

    try {
      if (isLiked) {
        await remove(likeRef);
        setFreelanceFeedback((current) => ({ ...current, [freelance.id]: 'Like retire' }));
        return;
      }

      await set(likeRef, true);
      setFreelanceFeedback((current) => ({ ...current, [freelance.id]: 'Like ajoute' }));
    } catch (likeError) {
      setFreelanceFeedback((current) => ({
        ...current,
        [freelance.id]: getActionErrorMessage(likeError, 'Like impossible')
      }));
    }
  };
  const handleRateFreelance = async (freelance: TopFreelancer, rating: number) => {
    if (!user) {
      setFreelanceFeedback((current) => ({ ...current, [freelance.id]: 'Connecte-toi pour noter' }));
      return;
    }

    try {
      await set(ref(realtimeDb, `freelanceEngagements/${freelance.id}/ratings/${user.uid}`), rating);
      setFreelanceFeedback((current) => ({ ...current, [freelance.id]: `${rating}/5 enregistre` }));
    } catch (ratingError) {
      setFreelanceFeedback((current) => ({
        ...current,
        [freelance.id]: getActionErrorMessage(ratingError, 'Note impossible')
      }));
    }
  };

  useEffect(() => {
    const usersRef = ref(realtimeDb, 'users');
    const unsubscribe = onValue(usersRef, (snapshot) => {
      const users = snapshot.val() as Record<string, Record<string, unknown>> | null;
      const freelancers = Object.entries(users || {})
        .map(([uid, rawProfile]) => normalizeFreelancer(uid, rawProfile))
        .filter((freelancer): freelancer is TopFreelancer => Boolean(freelancer))
        .sort((first, second) => second.score - first.score || first.name.localeCompare(second.name))
        .slice(0, 5);
      const nextSuppliers = Object.entries(users || {})
        .map(([uid, rawProfile]) => normalizeSupplier(uid, rawProfile))
        .filter((supplier): supplier is SupplierProfile => Boolean(supplier))
        .sort((first, second) => second.score - first.score || first.name.localeCompare(second.name))
        .slice(0, 8);

      setTopFreelancers(freelancers);
      setSuppliers(nextSuppliers);
      setActiveFreelanceIndex(0);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const engagementRef = ref(realtimeDb, 'freelanceEngagements');
    const unsubscribe = onValue(engagementRef, (snapshot) => {
      setFreelanceEngagements((snapshot.val() as Record<string, FreelanceEngagement> | null) || {});
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (topFreelancers.length < 2) return undefined;

    const timer = window.setInterval(moveFreelanceStack, 3200);
    return () => window.clearInterval(timer);
  }, [topFreelancers.length]);

  useEffect(() => {
    window.localStorage.setItem('afrisell:ecosystem-theme', isLightMode ? 'light' : 'dark');
    window.dispatchEvent(new Event('afrisell-theme-change'));
  }, [isLightMode]);

  return (
    <main className={`flex h-full min-h-0 flex-col overflow-hidden bg-[#050705] text-white ${isLightMode ? 'ecosystem-light' : ''}`}>
      <div data-home-chrome className={`relative z-40 shrink-0 transition-[max-height,opacity,transform] duration-300 ease-out ${
        isHomeChromeVisible
          ? 'max-h-[270px] translate-y-0 overflow-visible pb-1 pt-4 opacity-100'
          : 'pointer-events-none max-h-0 -translate-y-3 overflow-hidden opacity-0'
      }`}>
      <header className="shrink-0 px-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <img src="/afrissel-icon.jpeg" alt="AfriSell" className="h-8 w-8 rounded-xl object-cover" />
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">AfriSell</p>
            </div>
            <h1 className="mt-2 text-2xl font-black tracking-normal">Bonjour {firstName}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              to={user ? '/wallet' : '/login'}
              state={!user ? { next: '/wallet' } : undefined}
              className="flex h-10 max-w-[104px] shrink-0 items-center gap-2 rounded-2xl border border-[#15EA3E]/25 bg-[#15EA3E]/10 px-3 text-[#15EA3E]"
              aria-label="Wallet AfriSpay"
            >
              <AfriSellIcon name="pay" size={15} />
              <span className="truncate text-[10px] font-black">{walletLabel}</span>
            </Link>
            <button
              type="button"
              onClick={() => setIsLightMode((current) => !current)}
              className={`relative h-10 w-[58px] rounded-2xl border p-1 transition-colors ${
                isLightMode ? 'border-[#15EA3E]/45 bg-[#15EA3E]/20' : 'border-white/10 bg-white/[0.04]'
              }`}
              aria-label={isLightMode ? 'Activer le mode sombre' : 'Activer le mode clair'}
              aria-pressed={isLightMode}
            >
              <span className={`absolute top-1 flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
                isLightMode ? 'left-[22px] bg-[#15EA3E] text-black' : 'left-1 bg-white/[0.08] text-[#15EA3E]'
              }`}>
                <AfriSellIcon name={isLightMode ? 'flash' : 'offline'} size={14} />
              </span>
            </button>
            <Link to="/profile" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-[#15EA3E]" aria-label="Profil">
              <AfriSellIcon name="profile" size={19} />
            </Link>
          </div>
        </div>
      </header>

      <section className="mt-4 shrink-0 px-4">
        <form onSubmit={submitUniversalSearch} className="relative">
          <label className="flex h-13 items-center gap-3 rounded-[1.25rem] border border-white/10 bg-white/[0.05] px-4 shadow-[0_14px_32px_rgba(0,0,0,0.22)]">
            <AfriSellIcon name="search" size={17} className="shrink-0 text-[#15EA3E]" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Chercher produit, medecin, emploi, cours..."
              className="h-full min-w-0 flex-1 bg-transparent text-xs font-bold text-white outline-none placeholder:text-white/38"
            />
            <button
              type="submit"
              disabled={!searchResults.length}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#15EA3E] text-black disabled:bg-white/10 disabled:text-white/30"
              aria-label="Lancer la recherche"
            >
              <AfriSellIcon name="arrow" size={14} />
            </button>
          </label>

          {searchResults.length > 0 && (
            <div className="absolute left-0 right-0 top-[58px] z-40 overflow-hidden rounded-[1.25rem] border border-white/10 bg-[#070A07]/96 p-2 shadow-[0_18px_44px_rgba(0,0,0,0.42)] backdrop-blur-xl">
              {searchResults.map((item) => (
                <Link
                  key={item.id}
                  to={item.route}
                  state={'state' in item ? item.state : undefined}
                  onClick={() => setSearchQuery('')}
                  className="flex items-center gap-3 rounded-2xl p-2.5 active:scale-[0.99]"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.05] text-[#15EA3E]">
                    {item.image ? (
                      <img src={item.image} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <AfriSellIcon name="search" size={15} />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-black text-white">{item.title}</span>
                    <span className="mt-0.5 block truncate text-[10px] font-bold text-white/45">{item.type} - {item.meta}</span>
                  </span>
                  <AfriSellIcon name="arrow" size={13} className="text-[#15EA3E]" />
                </Link>
              ))}
            </div>
          )}
        </form>
      </section>

      <section className="mt-5 shrink-0 px-4">
        <div className="grid grid-cols-4 gap-x-3 gap-y-4">
          {quickActions.map((action) => (
            <Link
              key={action.label}
              to={getActionLink(action)}
              state={action.requiresAuth && !user ? { next: action.route } : undefined}
              className="flex min-w-0 flex-col items-center gap-2 active:scale-[0.97]"
            >
              <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-[#15EA3E]/18 bg-black shadow-[0_10px_24px_rgba(0,0,0,0.24)]">
                <QuickActionArtwork visual={action.visual} />
              </span>
              <span className="min-h-5 w-full text-center text-[9px] font-black leading-tight text-white/66">{action.label}</span>
            </Link>
          ))}
        </div>
      </section>
      </div>

      <div data-home-scroll onScroll={handleHomeScroll} className="min-h-0 flex-1 overflow-y-auto pb-7 pt-1 scrollbar-hide">
      <section className="px-4">
        <div className="relative mt-4 overflow-hidden rounded-[1.6rem] border border-[#15EA3E]/20 bg-[#0A0F0A] p-4 shadow-[0_18px_42px_rgba(0,0,0,0.34)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_20%,rgba(21,234,62,0.18),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.07),transparent_42%)]" />
          <div className="relative z-10">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">Aujourd hui</p>
                <h2 className="mt-1 text-xl font-black leading-tight">Vitrines, Stands et Villages en mouvement</h2>
              </div>
              <Link to="/market" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#15EA3E] text-black">
                <AfriSellIcon name="arrow" size={17} />
              </Link>
            </div>

            <div className="mt-4 overflow-hidden">
              <div className="afrisell-promo-marquee flex w-max gap-3">
                {[...promoItems, ...promoItems].map((item, index) => (
                  <Link
                    key={`${item.title}-${index}`}
                    to={item.route}
                    className="flex w-[210px] shrink-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] p-2.5"
                  >
                    <img src={item.image} alt="" className="h-14 w-14 rounded-xl object-cover" />
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-black">{item.title}</span>
                      <span className="mt-1 flex items-center gap-2 text-[10px] font-bold text-white/45">
                        <span className="rounded-full bg-[#15EA3E]/12 px-2 py-0.5 text-[#15EA3E]">{item.label}</span>
                        {'price' in item && item.price ? <span>{item.price}</span> : null}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4">
        <div className="relative -mx-1 mt-6 overflow-hidden rounded-[1.7rem] rounded-br-[3rem] border border-[#15EA3E]/20 bg-[#0A0F0A] px-5 pb-7 pt-5 shadow-[0_18px_42px_rgba(0,0,0,0.34),0_0_34px_rgba(21,234,62,0.12)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_18%,rgba(21,234,62,0.2),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.06),transparent_45%)]" />
          <div className="absolute -bottom-14 right-8 h-24 w-44 rounded-[999px] bg-[#050705]" />
          <div className="absolute -right-10 -top-12 h-32 w-32 rounded-full bg-[#15EA3E]/12 blur-2xl" />
          <div className="absolute -right-8 bottom-2 h-24 w-24 rounded-full border border-[#15EA3E]/20" />
          <img src="/afrissel-icon.jpeg" alt="" className="absolute -right-7 top-8 h-28 w-28 rotate-6 rounded-[2rem] object-cover opacity-20" />
          <div className="absolute left-5 top-0 h-px w-28 bg-[#15EA3E]/50" />

          <div className="relative z-10 max-w-[240px]">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#15EA3E]/20 bg-[#15EA3E]/10 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-[#15EA3E]" />
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#15EA3E]">Tout-en-un</p>
            </div>
            <h2 className="mt-4 text-2xl font-black leading-tight tracking-normal">
              La super app africaine.
            </h2>
            <p className="mt-2 text-xs font-semibold leading-relaxed text-white/50">
              Commerce, paiement et services relies.
            </p>
            <Link to="/apps" className="mt-4 flex w-max items-center gap-2 rounded-full bg-white/[0.06] px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-white/70 active:scale-[0.98]">
              Decouvrir
              <AfriSellIcon name="arrow" size={13} className="text-[#15EA3E]" />
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between px-4">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/52">Vitrines ABC</h2>
          <Link to="/feed" className="text-[10px] font-black text-[#15EA3E]">Voir le flux</Link>
        </div>

        <div className="scrollbar-hide flex gap-3 overflow-x-auto px-4 pb-1">
          {abcItems.map((item) => {
            const isLiveContent = 'media' in item;
            const media = isLiveContent ? item.media?.[0] : undefined;
            const route = isLiveContent ? getContentRoute(item) : item.route;
            const coverURL = isLiveContent ? item.coverURL : item.coverURL;
            const isVideo = isLiveContent ? media?.resourceType === 'video' : item.format === 'video';

            return (
              <Link key={item.id} to={route} className="relative h-[210px] w-[136px] shrink-0 overflow-hidden rounded-[1.35rem] border border-white/10 bg-white/[0.04] active:scale-[0.98]">
                {isVideo && media?.secureUrl ? (
                  <video src={media.secureUrl} className="h-full w-full object-cover" muted loop playsInline autoPlay />
                ) : (
                  <img src={coverURL || '/biashara.jpeg'} alt="" className="h-full w-full object-cover" />
                )}
                <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_35%,rgba(0,0,0,0.86))]" />
                <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/45 px-2 py-1 backdrop-blur">
                  <AfriSellIcon name={isVideo ? 'video' : 'market'} size={12} className="text-[#15EA3E]" />
                  <span className="text-[8px] font-black uppercase tracking-[0.12em] text-white/72">{isVideo ? 'Video' : 'Photo'}</span>
                </div>
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <h3 className="line-clamp-2 text-xs font-black leading-tight">{item.title}</h3>
                  <p className="mt-1 line-clamp-2 text-[10px] font-semibold leading-snug text-white/52">{item.description}</p>
                  {isLiveContent && item.isSellable ? (
                    <p className="mt-2 w-max rounded-full bg-[#15EA3E] px-2 py-1 text-[9px] font-black text-black">
                      {formatMarketPrice(item.villagePrice || item.price, item.currency) || 'Voir prix'}
                    </p>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-6 px-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/52">Stands populaires</h2>
          <Link to="/market" className="text-[10px] font-black text-[#15EA3E]">Ouvrir</Link>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {(marketProducts.length ? marketProducts.slice(0, 4) : promoItems.slice(0, 4)).map((item, index) => {
            const isProduct = 'id' in item;
            const route = isProduct ? `/market/${item.id}` : item.route;
            const image = isProduct ? item.coverURL : item.image;
            const title = isProduct ? item.title : item.title;
            const price = isProduct ? formatMarketPrice(item.villagePrice || item.price, item.currency) : ('price' in item ? item.price : '');

            return (
              <Link key={`${title}-${index}`} to={route} className="overflow-hidden rounded-[1.25rem] border border-white/10 bg-white/[0.04] active:scale-[0.98]">
                <img src={image || '/afrimarket.jpeg'} alt="" className="h-24 w-full object-cover" />
                <div className="p-3">
                  <h3 className="truncate text-xs font-black">{title}</h3>
                  <p className="mt-1 text-[10px] font-bold text-[#15EA3E]">{price || 'Decouvrir'}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {topFreelancers.length > 0 && (
      <section className="mt-6 px-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/52">Top freelances</h2>
          <span className="text-[10px] font-black text-[#15EA3E]">{topFreelancers.length} reel{topFreelancers.length > 1 ? 's' : ''}</span>
        </div>

        <div className="relative overflow-hidden rounded-[1.25rem] border border-white/10 bg-white/[0.035] p-2.5">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_12%,rgba(21,234,62,0.16),transparent_34%)]" />

          <div className="relative grid grid-cols-2 gap-2">
            {visibleFreelancers.slice(0, 2).map((freelance, offset) => {
              const stats = getEngagementStats(freelanceEngagements[freelance.id]);
              const isActive = freelance.id === activeFreelance?.id;

              return (
                <button
                  key={freelance.id}
                  type="button"
                  onClick={() => setActiveFreelanceIndex((activeFreelanceIndex + offset) % topFreelancers.length)}
                  className={`relative h-[126px] overflow-hidden rounded-[1rem] border text-left shadow-[0_12px_24px_rgba(0,0,0,0.28)] transition-all ${
                    isActive ? 'border-[#15EA3E]/55' : 'border-white/10'
                  }`}
                >
                  <img src={freelance.image} alt={freelance.name} className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_30%,rgba(0,0,0,0.92))]" />
                  <span className="absolute left-1.5 top-1.5 flex items-center gap-0.5 rounded-full bg-[#15EA3E] px-1.5 py-0.5 text-[8px] font-black text-black">
                    <AfriSellIcon name="heart" size={9} className="fill-current" />
                    {formatCompactCount(stats.likes)}
                  </span>
                  <span className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[8px] font-black text-white">
                    <AfriSellIcon name="star" size={9} className="fill-current text-[#FFD84D]" />
                    {stats.ratingCount ? stats.ratingAverage.toFixed(1) : freelance.rating}
                  </span>
                  <span className="absolute inset-x-0 bottom-0 p-2">
                    <span className="block truncate text-xs font-black text-white">{freelance.name}</span>
                    <span className="mt-0.5 block truncate text-[8px] font-bold text-[#15EA3E]">{freelance.role}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {activeFreelance && (
            <div className="relative z-10 mt-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 text-[9px] font-black text-white/62">
                  <AfriSellIcon name="star" size={11} className="fill-current text-[#FFD84D]" />
                  <span>{activeStats.ratingCount ? activeStats.ratingAverage.toFixed(1) : '0.0'}</span>
                  <span>{formatCompactCount(activeStats.ratingCount)} notes</span>
                </div>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      key={rating}
                      type="button"
                      onClick={() => void handleRateFreelance(activeFreelance, rating)}
                      className="flex h-6 w-6 items-center justify-center active:scale-[0.94]"
                      aria-label={`Noter ${rating} etoile${rating > 1 ? 's' : ''}`}
                    >
                      <AfriSellIcon
                        name="star"
                        size={13}
                        className={rating <= activeUserRating ? 'fill-current text-[#FFD84D]' : 'text-white/28'}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-2 grid grid-cols-5 gap-1.5">
                <button type="button" onClick={moveFreelanceStack} className="flex h-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-white/60" aria-label="Profil suivant" title="Profil suivant">
                  <AfriSellIcon name="arrow" size={13} />
                </button>
                <Link to={user ? getContactChatRoute(activeFreelance) : '/login'} state={!user ? { next: getContactChatRoute(activeFreelance) } : undefined} className="flex h-8 items-center justify-center rounded-xl bg-[#15EA3E] text-black" aria-label="Contacter" title="Contacter">
                  <AfriSellIcon name="chat" size={13} />
                </Link>
                <button type="button" onClick={() => void handleLikeFreelance(activeFreelance)} className={`flex h-8 items-center justify-center rounded-xl border ${activeUserLiked ? 'border-[#15EA3E] bg-[#15EA3E] text-black' : 'border-[#15EA3E]/30 bg-[#15EA3E]/10 text-[#15EA3E]'}`} aria-label="Liker" title="Liker">
                  <AfriSellIcon name="heart" size={13} className={activeUserLiked ? 'fill-current' : ''} />
                </button>
                <button type="button" onClick={() => void handleShareFreelance(activeFreelance)} className="flex h-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-white/70" aria-label="Partager" title="Partager">
                  <AfriSellIcon name="share" size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFreelanceFeedback((current) => ({ ...current, [activeFreelance.id]: 'Recommande' }));
                    moveFreelanceStack();
                  }}
                  className="flex h-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-white/70"
                  aria-label="Recommander"
                  title="Recommander"
                >
                  <AfriSellIcon name="follow" size={13} />
                </button>
              </div>

              {freelanceFeedback[activeFreelance.id] && (
                <p className="mt-1.5 rounded-xl bg-[#15EA3E]/10 px-2 py-1 text-center text-[9px] font-black uppercase tracking-wider text-[#15EA3E]">
                  {freelanceFeedback[activeFreelance.id]}
                </p>
              )}
            </div>
          )}
        </div>
      </section>
      )}

      {suppliers.length > 0 && (
        <section className="mt-6 px-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/52">Decouvrez nos fournisseurs</h2>
            <span className="text-[10px] font-black text-[#15EA3E]">{suppliers.length} reel{suppliers.length > 1 ? 's' : ''}</span>
          </div>

          <div className="scrollbar-hide flex gap-3 overflow-x-auto pb-1">
            {suppliers.map((supplier) => {
              const chatRoute = getContactChatRoute(supplier);

              return (
                <article
                  key={supplier.id}
                  className="w-[154px] shrink-0 overflow-hidden rounded-[1.2rem] border border-white/10 bg-white/[0.04]"
                >
                  <div className="relative h-24">
                    <img src={supplier.image} alt={supplier.name} className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_36%,rgba(0,0,0,0.82))]" />
                    <span className="absolute left-2 top-2 rounded-full bg-[#15EA3E] px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-black">
                      Fournisseur
                    </span>
                    <div className="absolute inset-x-0 bottom-0 p-2">
                      <h3 className="truncate text-xs font-black">{supplier.name}</h3>
                      <p className="mt-0.5 truncate text-[9px] font-bold text-[#15EA3E]">{supplier.role}</p>
                    </div>
                  </div>

                  <div className="p-2">
                    <p className="line-clamp-2 min-h-[28px] text-[10px] font-semibold leading-snug text-white/48">
                      {supplier.skill}
                    </p>
                    <Link
                      to={user ? chatRoute : '/login'}
                      state={!user ? { next: chatRoute } : undefined}
                      className="mt-2 flex h-8 items-center justify-center gap-1.5 rounded-xl bg-[#15EA3E] text-[9px] font-black uppercase tracking-wider text-black active:scale-[0.98]"
                    >
                      <AfriSellIcon name="chat" size={12} />
                      Contacter
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
      </div>

      <button
        type="button"
        onClick={() => setIsAfriAiOpen((current) => !current)}
        className="absolute bottom-[104px] right-4 z-50 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-[#15EA3E]/35 bg-black shadow-[0_16px_34px_rgba(21,234,62,0.32)] active:scale-[0.96]"
        aria-label="Assistant AfriAI"
      >
        <img src="/afriaiiconeblack.png" alt="" className="h-full w-full scale-[1.8] object-cover" />
      </button>

      {isAfriAiOpen && (
        <div className="absolute bottom-[174px] right-4 z-50 w-[292px] overflow-hidden rounded-[1.5rem] border border-[#15EA3E]/24 bg-[#070A07]/96 p-4 shadow-[0_20px_54px_rgba(0,0,0,0.54)] backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#15EA3E]">AfriAI</p>
              <h3 className="mt-1 text-sm font-black text-white">Assistant universel</h3>
              <p className="mt-1 text-[11px] font-semibold leading-relaxed text-white/50">
                Recherche, traduction et aide vocale seront connectees ici. Pour l instant, utilise la recherche universelle.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsAfriAiOpen(false)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-white/55"
              aria-label="Fermer AfriAI"
            >
              <AfriSellIcon name="close" size={13} />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {['Parler', 'Traduire', 'Aider'].map((label) => (
              <button key={label} type="button" className="rounded-xl border border-white/10 bg-white/[0.05] px-2 py-2 text-[9px] font-black uppercase tracking-wider text-white/70">
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
