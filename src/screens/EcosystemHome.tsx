import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { onValue, ref, remove, set } from 'firebase/database';
import { ecosystemModules } from '../data/ecosystem';
import { AfriSellIcon, AfriSellIconName } from '../components/AfriSellIcon';
import { useFirebaseAuth } from '../hooks/useFirebaseAuth';
import { AfriMarketContent, formatMarketPrice, useAfriMarket } from '../hooks/useAfriMarket';
import { realtimeDb } from '../lib/firebase';

type QuickAction = {
  label: string;
  route: string;
  icon: AfriSellIconName;
  accent?: boolean;
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
  { label: 'Acheter', route: '/market', icon: 'cart', accent: true },
  { label: 'Vendre', route: '/feed?publish=1', icon: 'market', requiresAuth: true },
  { label: 'Publier', route: '/feed?publish=1', icon: 'video', requiresAuth: true },
  { label: 'Payer', route: '/scan', icon: 'scan', accent: true, requiresAuth: true },
  { label: 'Depot', route: '/wallet?action=deposit', icon: 'deposit', requiresAuth: true },
  { label: 'Retrait', route: '/wallet?action=withdraw', icon: 'withdraw', requiresAuth: true },
  { label: 'Transfert', route: '/wallet?action=transfer', icon: 'pay', requiresAuth: true },
  { label: 'Expedier', route: '/safari', icon: 'send' },
  { label: 'Chat', route: '/chat', icon: 'chat', requiresAuth: true },
  { label: 'Plus', route: '/apps', icon: 'hub' }
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
  const [freelanceFeedback, setFreelanceFeedback] = useState<Record<string, string>>({});
  const [freelanceEngagements, setFreelanceEngagements] = useState<Record<string, FreelanceEngagement>>({});
  const [topFreelancers, setTopFreelancers] = useState<TopFreelancer[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierProfile[]>([]);
  const [activeFreelanceIndex, setActiveFreelanceIndex] = useState(0);
  const [isLightMode, setIsLightMode] = useState(() => window.localStorage.getItem('afrisell:ecosystem-theme') === 'light');
  const { profile, user } = useFirebaseAuth();
  const { abcContents, marketProducts } = useAfriMarket();
  const firstName = (profile?.displayName || user?.displayName || 'Utilisateur').split(' ')[0];
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

    if (navigator.share) {
      await navigator.share({ title: 'Freelance AfriSell', text, url: window.location.origin + '/ecosystem' });
      return;
    }

    await navigator.clipboard?.writeText(text);
    setFreelanceFeedback((current) => ({ ...current, [freelance.id]: 'Lien copie' }));
  };
  const handleLikeFreelance = async (freelance: TopFreelancer) => {
    if (!user) {
      setFreelanceFeedback((current) => ({ ...current, [freelance.id]: 'Connecte-toi pour liker' }));
      return;
    }

    const likeRef = ref(realtimeDb, `freelanceEngagements/${freelance.id}/likes/${user.uid}`);
    const isLiked = Boolean(freelanceEngagements[freelance.id]?.likes?.[user.uid]);

    if (isLiked) {
      await remove(likeRef);
      setFreelanceFeedback((current) => ({ ...current, [freelance.id]: 'Like retire' }));
      return;
    }

    await set(likeRef, true);
    setFreelanceFeedback((current) => ({ ...current, [freelance.id]: 'Like ajoute' }));
  };
  const handleRateFreelance = async (freelance: TopFreelancer, rating: number) => {
    if (!user) {
      setFreelanceFeedback((current) => ({ ...current, [freelance.id]: 'Connecte-toi pour noter' }));
      return;
    }

    await set(ref(realtimeDb, `freelanceEngagements/${freelance.id}/ratings/${user.uid}`), rating);
    setFreelanceFeedback((current) => ({ ...current, [freelance.id]: `${rating}/5 enregistre` }));
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
    <main className={`flex h-full min-h-0 flex-col overflow-hidden bg-[#050705] pt-4 text-white ${isLightMode ? 'ecosystem-light' : ''}`}>
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

      <section className="mt-5 shrink-0 overflow-hidden">
        <div className="scrollbar-hide overflow-x-auto px-4 pb-1">
          <div className="afrisell-actions-marquee flex w-max gap-3">
          {[...quickActions, ...quickActions].map((action, index) => (
            <Link
              key={`${action.label}-${index}`}
              to={getActionLink(action)}
              state={action.requiresAuth && !user ? { next: action.route } : undefined}
              className="flex w-[58px] shrink-0 flex-col items-center gap-2 active:scale-[0.97]"
            >
              <span className={`flex h-12 w-12 items-center justify-center rounded-2xl shadow-[0_10px_24px_rgba(0,0,0,0.24)] ${action.accent ? 'bg-[#15EA3E] text-black' : 'bg-white/[0.06] text-[#15EA3E]'}`}>
                <AfriSellIcon name={action.icon} size={18} />
              </span>
              <span className="w-full truncate text-center text-[10px] font-black text-white/66">{action.label}</span>
            </Link>
          ))}
          </div>
        </div>
      </section>

      <div className="min-h-0 flex-1 overflow-y-auto pb-7 pt-1 scrollbar-hide">
      <section className="px-4">
        <div className="relative mt-4 overflow-hidden rounded-[1.6rem] border border-[#15EA3E]/20 bg-[#0A0F0A] p-4 shadow-[0_18px_42px_rgba(0,0,0,0.34)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_20%,rgba(21,234,62,0.18),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.07),transparent_42%)]" />
          <div className="relative z-10">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">Aujourd hui</p>
                <h2 className="mt-1 text-xl font-black leading-tight">Tout AfriSell en mouvement</h2>
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
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/52">ABC maintenant</h2>
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
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/52">Market populaire</h2>
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
          <div className="relative h-[154px]">
            {visibleFreelancers.slice().reverse().map((freelance, reverseIndex) => {
              const stackIndex = visibleFreelancers.length - 1 - reverseIndex;
              const stats = getEngagementStats(freelanceEngagements[freelance.id]);
              const rotation = stackIndex === 0 ? 0 : stackIndex === 1 ? -4 : 4;
              const translateY = stackIndex * 6;
              const scale = 1 - stackIndex * 0.055;

              return (
                <article
                  key={freelance.id}
                  className="absolute inset-x-0 top-0 mx-auto h-[142px] max-w-[132px] overflow-hidden rounded-[1rem] border border-[#15EA3E]/20 bg-[#090D09] shadow-[0_14px_28px_rgba(0,0,0,0.38)] transition-all duration-500"
                  style={{
                    zIndex: 20 - stackIndex,
                    transform: `translateY(${translateY}px) rotate(${rotation}deg) scale(${scale})`,
                    opacity: 1 - stackIndex * 0.18
                  }}
                >
                  <img src={freelance.image} alt={freelance.name} className="h-[88px] w-full object-cover" />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_34%,rgba(0,0,0,0.92))]" />
                  <div className="absolute left-1.5 top-1.5 flex items-center gap-0.5 rounded-full bg-[#15EA3E] px-1.5 py-0.5 text-[8px] font-black text-black">
                    <AfriSellIcon name="heart" size={9} className="fill-current" />
                    {formatCompactCount(stats.likes)}
                  </div>
                  <div className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded-full border border-white/10 bg-black/55 px-1.5 py-0.5 text-[8px] font-black text-white backdrop-blur">
                    <AfriSellIcon name="star" size={9} className="fill-current text-[#FFD84D]" />
                    {stats.ratingCount ? stats.ratingAverage.toFixed(1) : freelance.rating}
                  </div>
                  <div className="absolute inset-x-0 bottom-0 p-2">
                    <h3 className="truncate text-xs font-black">{freelance.name}</h3>
                    <p className="mt-0.5 truncate text-[8px] font-bold text-[#15EA3E]">{freelance.role}</p>
                  </div>
                </article>
              );
            })}
          </div>

          {activeFreelance && (
            <div className="relative z-30 -mt-1">
              <div className="mb-2 flex items-center justify-center gap-2 text-[9px] font-black text-white/62">
                <span className="flex items-center gap-0.5 text-[#FFD84D]">
                  <AfriSellIcon name="star" size={11} className="fill-current" />
                  {activeStats.ratingCount ? activeStats.ratingAverage.toFixed(1) : '0.0'}
                </span>
                <span>{formatCompactCount(activeStats.ratingCount)} notes</span>
                <span className="flex items-center gap-0.5 text-[#15EA3E]">
                  <AfriSellIcon name="heart" size={11} className="fill-current" />
                  {formatCompactCount(activeStats.likes)}
                </span>
              </div>

              <div className="mb-2 flex items-center justify-center gap-1">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => handleRateFreelance(activeFreelance, rating)}
                    className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 bg-white/[0.05] active:scale-[0.94]"
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

              <div className="grid grid-cols-[34px_1fr_34px] gap-1.5">
                <button
                  type="button"
                  onClick={moveFreelanceStack}
                  className="flex h-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-white/60 active:scale-[0.96]"
                  aria-label="Passer"
                >
                  <AfriSellIcon name="close" size={13} />
                </button>
                <Link
                  to={user ? getContactChatRoute(activeFreelance) : '/login'}
                  state={!user ? { next: getContactChatRoute(activeFreelance) } : undefined}
                  className="flex h-8 items-center justify-center gap-1.5 rounded-xl bg-[#15EA3E] text-[9px] font-black uppercase tracking-wider text-black active:scale-[0.98]"
                >
                  <AfriSellIcon name="chat" size={12} />
                  Contacter
                </Link>
                <button
                  type="button"
                  onClick={() => handleLikeFreelance(activeFreelance)}
                  className={`flex h-8 items-center justify-center rounded-xl border active:scale-[0.96] ${
                    activeUserLiked
                      ? 'border-[#15EA3E]/40 bg-[#15EA3E] text-black'
                      : 'border-[#15EA3E]/30 bg-[#15EA3E]/10 text-[#15EA3E]'
                  }`}
                  aria-label="Liker"
                >
                  <AfriSellIcon name="heart" size={13} className={activeUserLiked ? 'fill-current' : ''} />
                </button>
              </div>

              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleShareFreelance(activeFreelance)}
                  className="flex h-8 items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/[0.05] text-[8px] font-black uppercase tracking-wider text-white/70"
                >
                  <AfriSellIcon name="share" size={12} />
                  Partager
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFreelanceFeedback((current) => ({ ...current, [activeFreelance.id]: 'Recommande' }));
                    moveFreelanceStack();
                  }}
                  className="flex h-8 items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/[0.05] text-[8px] font-black uppercase tracking-wider text-white/70"
                >
                  <AfriSellIcon name="follow" size={12} />
                  Recommander
                </button>
              </div>

              {freelanceFeedback[activeFreelance.id] && (
                <p className="mt-2 rounded-xl bg-[#15EA3E]/10 px-2 py-1 text-center text-[9px] font-black uppercase tracking-wider text-[#15EA3E]">
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
    </main>
  );
}
