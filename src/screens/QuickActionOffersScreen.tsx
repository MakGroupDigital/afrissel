import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { onValue, ref } from 'firebase/database';
import { AfriSellIcon, AfriSellIconName } from '../components/AfriSellIcon';
import { formatMarketPrice, toCheckoutProduct, useAfriMarket } from '../hooks/useAfriMarket';
import { realtimeDb } from '../lib/firebase';

type OfferSectionId = 'restauration' | 'event' | 'immo';

type BusinessAccount = {
  categoryId?: string;
  categoryLabel?: string;
  moduleName?: string;
  serviceId?: string;
  serviceLabel?: string;
  segmentId?: string;
  segmentLabel?: string;
};

type RawUserProfile = {
  uid?: string;
  displayName?: string;
  businessName?: string;
  photoURL?: string;
  logoURL?: string;
  city?: string;
  country?: string;
  bio?: string;
  primarySubtype?: string;
  businessAccount?: BusinessAccount;
  businessAccounts?: Record<string, BusinessAccount>;
};

type Provider = {
  id: string;
  name: string;
  avatar: string;
  city: string;
  role: string;
};

const sections: Record<OfferSectionId, {
  title: string;
  eyebrow: string;
  body: string;
  emptyTitle: string;
  emptyBody: string;
  icon: AfriSellIconName;
  keywords: string[];
}> = {
  restauration: {
    title: 'Restauration',
    eyebrow: 'Offres alimentaires',
    body: 'Restaurants, traiteurs, snacks et services food publies par des entreprises AfriSell.',
    emptyTitle: 'Aucune offre restauration',
    emptyBody: 'Les entreprises de restauration apparaitront ici des qu elles publient une offre.',
    icon: 'market',
    keywords: ['restaurant', 'restauration', 'traiteur', 'food', 'repas', 'snack', 'cuisine', 'boisson']
  },
  event: {
    title: 'Event',
    eyebrow: 'Evenements',
    body: 'Billets, services evenementiels, salles, animation et organisation proposes par des entreprises.',
    emptyTitle: 'Aucune offre event',
    emptyBody: 'Les offres event apparaitront ici quand une entreprise publie un service ou un article lie.',
    icon: 'notifications',
    keywords: ['event', 'evenement', 'billet', 'concert', 'salle', 'ceremonie', 'animation', 'festival']
  },
  immo: {
    title: 'Immobilier',
    eyebrow: 'Biens et services immo',
    body: 'Locations, ventes, visites, terrains, maisons et services immobiliers proposes par les comptes concernes.',
    emptyTitle: 'Aucune offre immo',
    emptyBody: 'Les offres immo seront visibles ici uniquement quand un compte immobilier publie une offre.',
    icon: 'home',
    keywords: ['immo', 'immobilier', 'maison', 'terrain', 'location', 'appartement', 'parcelle', 'villa']
  }
};

const getText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const getAccounts = (profile: RawUserProfile) => [
  profile.businessAccount,
  ...Object.values(profile.businessAccounts || {})
].filter((account): account is BusinessAccount => Boolean(account));

const matchesKeywords = (values: unknown[], keywords: string[]) => {
  const text = values.map(getText).join(' ').toLowerCase();
  return keywords.some((keyword) => text.includes(keyword));
};

const normalizeProvider = (id: string, profile: RawUserProfile, keywords: string[]): Provider | null => {
  const accounts = getAccounts(profile);
  const matchedAccount = accounts.find((account) => matchesKeywords([
    account.categoryId,
    account.categoryLabel,
    account.moduleName,
    account.serviceId,
    account.serviceLabel,
    account.segmentId,
    account.segmentLabel
  ], keywords));

  const matchedProfile = matchesKeywords([
    profile.primarySubtype,
    profile.businessName,
    profile.bio
  ], keywords);

  if (!matchedAccount && !matchedProfile) return null;

  return {
    id,
    name: getText(profile.businessName) || getText(profile.displayName) || 'Entreprise AfriSell',
    avatar: getText(profile.logoURL) || getText(profile.photoURL) || '/afrissel-icon.jpeg',
    city: getText(profile.city) || getText(profile.country) || 'AfriSell',
    role: getText(matchedAccount?.serviceLabel) || getText(matchedAccount?.segmentLabel) || 'Service'
  };
};

export default function QuickActionOffersScreen() {
  const { sectionId = 'restauration' } = useParams();
  const navigate = useNavigate();
  const { marketProducts, loading } = useAfriMarket();
  const activeSectionId = (['restauration', 'event', 'immo'].includes(sectionId) ? sectionId : 'restauration') as OfferSectionId;
  const section = sections[activeSectionId];
  const [providers, setProviders] = useState<Provider[]>([]);

  useEffect(() => {
    const usersRef = ref(realtimeDb, 'users');
    const unsubscribe = onValue(usersRef, (snapshot) => {
      const users = snapshot.val() as Record<string, RawUserProfile> | null;
      const nextProviders = Object.entries(users || {})
        .map(([id, profile]) => normalizeProvider(id, profile, section.keywords))
        .filter((provider): provider is Provider => Boolean(provider))
        .sort((first, second) => first.name.localeCompare(second.name));
      setProviders(nextProviders);
    });

    return unsubscribe;
  }, [section.keywords]);

  const providerIds = useMemo(() => new Set(providers.map((provider) => provider.id)), [providers]);
  const offers = useMemo(() => marketProducts.filter((product) => {
    const fromMatchingProvider = providerIds.has(product.authorId);
    const contentMatches = matchesKeywords([
      product.title,
      product.description,
      product.category
    ], section.keywords);

    return fromMatchingProvider && contentMatches;
  }), [marketProducts, providerIds, section.keywords]);

  return (
    <main className="min-h-full bg-[#050705] px-4 pb-24 pt-4 text-white">
      <header className="flex items-center justify-between">
        <button type="button" onClick={() => navigate(-1)} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-[#15EA3E]">
          <AfriSellIcon name="arrow" size={18} className="rotate-180" />
        </button>
        <div className="text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">{section.eyebrow}</p>
          <h1 className="text-lg font-black">{section.title}</h1>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#15EA3E]/20 bg-[#15EA3E]/10 text-[#15EA3E]">
          <AfriSellIcon name={section.icon} size={18} />
        </div>
      </header>

      <section className="mt-4 overflow-hidden rounded-[1.7rem] border border-[#15EA3E]/20 bg-[#071007] p-4">
        <div className="absolute inset-0" />
        <p className="text-[11px] font-semibold leading-relaxed text-white/55">{section.body}</p>
        <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-black/22 p-3">
          <span className="text-[10px] font-black uppercase tracking-wider text-white/45">Offres disponibles</span>
          <span className="text-sm font-black text-[#15EA3E]">{offers.length}</span>
        </div>
      </section>

      {providers.length > 0 && (
        <section className="mt-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/48">Entreprises</h2>
            <span className="text-[10px] font-black text-[#15EA3E]">{providers.length}</span>
          </div>
          <div className="scrollbar-hide flex gap-3 overflow-x-auto pb-1">
            {providers.slice(0, 8).map((provider) => (
              <Link key={provider.id} to={`/u/${provider.id}`} className="w-[136px] shrink-0 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <img src={provider.avatar} alt={provider.name} className="h-14 w-14 rounded-2xl object-cover" />
                <p className="mt-3 truncate text-xs font-black">{provider.name}</p>
                <p className="mt-1 truncate text-[9px] font-bold text-[#15EA3E]">{provider.role}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-5">
        <h2 className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-white/48">Offres</h2>
        {loading ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
            <AfriSellIcon name={section.icon} size={30} className="text-[#15EA3E]" />
            <p className="mt-3 text-xs font-black uppercase tracking-wider text-white/55">Chargement</p>
          </div>
        ) : offers.length ? (
          <div className="grid grid-cols-2 gap-3">
            {offers.map((offer) => (
              <Link key={offer.id} to={`/market/${offer.id}`} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
                <img src={offer.coverURL || '/afrimarket.jpeg'} alt={offer.title} className="h-28 w-full object-cover" />
                <div className="p-3">
                  <p className="line-clamp-2 min-h-[32px] text-xs font-black">{offer.title}</p>
                  <p className="mt-2 text-[10px] font-black text-[#15EA3E]">{formatMarketPrice(offer.villagePrice || offer.price, offer.currency)}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[1.7rem] border border-white/10 bg-white/[0.035] px-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-[1.4rem] border border-[#15EA3E]/20 bg-[#15EA3E]/10 text-[#15EA3E]">
              <AfriSellIcon name={section.icon} size={26} />
            </div>
            <h3 className="mt-5 text-lg font-black">{section.emptyTitle}</h3>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-white/45">{section.emptyBody}</p>
          </div>
        )}
      </section>
    </main>
  );
}
