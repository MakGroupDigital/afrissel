import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AfriSellIcon } from '../components/AfriSellIcon';
import { ecosystemModules } from '../data/ecosystem';
import { AfriMarketContent, formatMarketPrice, useAfriMarket } from '../hooks/useAfriMarket';
import { cn } from '../lib/utils';

type PromoOffer = {
  id: string;
  title: string;
  module: string;
  category: string;
  image: string;
  route: string;
  price?: string;
  oldPrice?: string;
  discount: number;
  tag: string;
};

const fallbackPromos: PromoOffer[] = [
  {
    id: 'promo-market',
    title: 'Sélection Market prête à livrer',
    module: 'AfriSell Market',
    category: 'Commerce',
    image: '/afrimarket.jpeg',
    route: '/market',
    discount: 35,
    tag: 'Flash'
  },
  {
    id: 'promo-zandofy',
    title: 'Zandofy, boutique personnalisée',
    module: 'Zandofy',
    category: 'Marketplace',
    image: '/zandofyacceuil.png',
    route: '/zandofy',
    discount: 25,
    tag: 'Nouveau'
  },
  {
    id: 'promo-safari',
    title: 'Mobilité, transport et immobilier',
    module: 'Safari',
    category: 'Services',
    image: '/safari.jpeg',
    route: '/safari',
    discount: 20,
    tag: 'Local'
  },
  {
    id: 'promo-school',
    title: 'Cours et formations utiles',
    module: 'AfriSchool',
    category: 'Éducation',
    image: '/afrischool.jpeg',
    route: '/school',
    discount: 30,
    tag: 'Semaine'
  },
  {
    id: 'promo-med',
    title: 'Services santé et orientation',
    module: 'AfriMed',
    category: 'Santé',
    image: '/afrimed.jpeg',
    route: '/med',
    discount: 18,
    tag: 'Proche'
  },
  {
    id: 'promo-chat',
    title: 'Villages, vitrines et communautés',
    module: 'AfriChat',
    category: 'Social',
    image: '/africhat.jpeg',
    route: '/chat',
    discount: 15,
    tag: 'Village'
  }
];

const buildProductPromo = (item: AfriMarketContent, index: number): PromoOffer => {
  const price = item.villagePrice || item.price || item.linkedProductVillagePrice || item.linkedProductPrice;
  const discount = [12, 18, 24, 31, 40][index % 5];
  const oldPrice = price ? price / (1 - discount / 100) : undefined;

  return {
    id: item.id,
    title: item.title,
    module: item.isSellable ? 'Market' : 'ABC',
    category: item.category || 'Promo',
    image: item.coverURL || item.linkedProductImage || '/afrimarket.jpeg',
    route: item.isSellable || item.linkedProductId ? `/market/${item.linkedProductId || item.id}` : `/feed?post=${item.id}`,
    price: price ? formatMarketPrice(price, item.currency || item.linkedProductCurrency || 'USD') : undefined,
    oldPrice: oldPrice ? formatMarketPrice(oldPrice, item.currency || item.linkedProductCurrency || 'USD') : undefined,
    discount,
    tag: index < 4 ? 'Top' : 'Promo'
  };
};

export default function PromotionsScreen() {
  const navigate = useNavigate();
  const { marketProducts, abcContents, loading } = useAfriMarket();
  const [activeCategory, setActiveCategory] = useState('Tout');

  const offers = useMemo(() => {
    const productPromos = [...marketProducts, ...abcContents.filter((item) => item.isSellable || item.linkedProductId)]
      .slice(0, 36)
      .map(buildProductPromo);
    return [...productPromos, ...fallbackPromos];
  }, [abcContents, marketProducts]);

  const categories = useMemo(() => ['Tout', ...Array.from(new Set(offers.map((offer) => offer.category))).slice(0, 8)], [offers]);
  const filteredOffers = activeCategory === 'Tout'
    ? offers
    : offers.filter((offer) => offer.category === activeCategory);

  return (
    <main className="flex h-full flex-col overflow-hidden bg-black text-white">
      <header className="shrink-0 px-4 pb-3 pt-4">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => navigate('/ecosystem')} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/70">
            <AfriSellIcon name="arrow" size={18} className="rotate-180" />
          </button>
          <div className="text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">Promos</p>
            <h1 className="text-sm font-black">Offres de l’écosystème</h1>
          </div>
          <Link to="/market" className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#15EA3E] text-black">
            <AfriSellIcon name="market" size={18} />
          </Link>
        </div>
      </header>

      <section className="shrink-0 px-4">
        <div className="relative overflow-hidden rounded-[1.7rem] border border-[#15EA3E]/20 bg-[#071007] p-4">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_0%,rgba(21,234,62,0.28),transparent_38%),linear-gradient(135deg,rgba(255,255,255,0.08),transparent_45%)]" />
          <div className="relative z-10 max-w-[72%]">
            <p className="text-[9px] font-black uppercase tracking-[0.24em] text-[#15EA3E]">Prix chauds</p>
            <h2 className="mt-2 text-2xl font-black leading-none">Promos AfriSell</h2>
            <p className="mt-2 text-xs font-semibold leading-relaxed text-white/55">
              Produits, services et apps en réduction dans un seul marché.
            </p>
          </div>
          <div className="absolute bottom-4 right-4 rounded-2xl bg-[#15EA3E] px-3 py-2 text-xl font-black text-black">
            -70%
          </div>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              className={cn(
                'shrink-0 rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-wider',
                activeCategory === category ? 'border-[#15EA3E] bg-[#15EA3E] text-black' : 'border-white/10 bg-white/[0.04] text-white/58'
              )}
            >
              {category}
            </button>
          ))}
        </div>
      </section>

      <section className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-3 scrollbar-hide">
        {loading && !filteredOffers.length ? (
          <div className="flex h-full items-center justify-center text-sm font-bold text-white/45">Chargement des promos...</div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {filteredOffers.map((offer, index) => (
              <Link
                key={`${offer.id}-${index}`}
                to={offer.route}
                className={cn(
                  'group overflow-hidden rounded-[1.2rem] border border-white/10 bg-white/[0.045] active:scale-[0.99]',
                  index % 5 === 0 && 'row-span-2'
                )}
              >
                <div className={cn('relative overflow-hidden bg-[#071007]', index % 5 === 0 ? 'h-56' : 'h-36')}>
                  <img src={offer.image} alt={offer.title} className="h-full w-full object-cover transition-transform duration-300 group-active:scale-105" />
                  <div className="absolute left-2 top-2 rounded-full bg-[#15EA3E] px-2 py-1 text-[8px] font-black uppercase tracking-wider text-black">
                    -{offer.discount}%
                  </div>
                  <div className="absolute right-2 top-2 rounded-full bg-black/62 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-white backdrop-blur">
                    {offer.tag}
                  </div>
                </div>
                <div className="p-2.5">
                  <p className="truncate text-[9px] font-black uppercase tracking-wider text-[#15EA3E]">{offer.module}</p>
                  <h3 className="mt-1 line-clamp-2 text-xs font-black leading-tight text-white">{offer.title}</h3>
                  <div className="mt-2 flex items-end justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black text-white">{offer.price || 'Découvrir'}</span>
                      {offer.oldPrice && <span className="block truncate text-[10px] font-bold text-white/30 line-through">{offer.oldPrice}</span>}
                    </span>
                    <span className="rounded-xl bg-white/[0.07] px-2 py-1 text-[8px] font-black uppercase tracking-wider text-white/55">
                      {offer.category}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <section className="mt-5 rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/42">Modules inclus</p>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {ecosystemModules.slice(0, 8).map((module) => (
              <Link key={module.id} to={module.route} className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/10 bg-black/24 p-2">
                <img src={module.logo} alt="" className="h-8 w-8 rounded-xl object-cover" />
                <span className="max-w-full truncate text-[8px] font-black text-white/50">{module.name}</span>
              </Link>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
