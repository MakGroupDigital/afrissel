import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { AfriSellIcon } from '../components/AfriSellIcon';
import { MARKET_CATEGORIES, formatMarketPrice, toCheckoutProduct, useAfriMarket } from '../hooks/useAfriMarket';

export default function MarketHome() {
  const { marketProducts, loading, error } = useAfriMarket();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('Tout');

  const normalizedQuery = query.trim().toLowerCase();
  const filteredProducts = useMemo(() => (
    marketProducts.filter((product) => {
      const matchesCategory = activeCategory === 'Tout' || product.category === activeCategory;
      const matchesQuery = !normalizedQuery || [
        product.title,
        product.description,
        product.authorName,
        product.category
      ].some((value) => value.toLowerCase().includes(normalizedQuery));

      return matchesCategory && matchesQuery;
    })
  ), [activeCategory, marketProducts, normalizedQuery]);
  const popularProducts = useMemo(() => (
    [...marketProducts]
      .sort((first, second) => {
        const firstScore = (first.likesCount || 0) * 2 + (first.buyersCount || 0) * 3 + (first.sharesCount || 0);
        const secondScore = (second.likesCount || 0) * 2 + (second.buyersCount || 0) * 3 + (second.sharesCount || 0);
        return secondScore - firstScore;
      })
      .slice(0, 4)
  ), [marketProducts]);
  const featuredProduct = popularProducts[0];
  const secondaryPopularProducts = popularProducts.slice(1, 4);

  return (
    <div className="flex min-h-full flex-col bg-black">
      <div className="sticky top-0 z-30 border-b border-gray-900 bg-black/95 px-4 py-4 backdrop-blur-md">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-gray-800 bg-[#0A0A0A] p-3 transition-colors focus-within:border-[#15EA3E]/50">
            <AfriSellIcon name="search" size={20} className="shrink-0 text-[#15EA3E]" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher sur le Market..."
              className="w-full min-w-0 border-none bg-transparent text-sm font-medium text-white outline-none placeholder:text-gray-600"
            />
          </div>
          <Link
            to="/feed"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#15EA3E] text-black"
            aria-label="Publier sur ABC"
          >
            <AfriSellIcon name="clip" size={19} />
          </Link>
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto px-4 py-4 scrollbar-hide">
        {MARKET_CATEGORIES.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setActiveCategory(category)}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
              category === activeCategory
                ? 'bg-[#15EA3E] text-black'
                : 'border border-gray-800 bg-[#0A0A0A] text-gray-400 hover:border-gray-600'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {featuredProduct && (
        <section className="px-4 pb-4">
          <div
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/market/${featuredProduct.id}`)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                navigate(`/market/${featuredProduct.id}`);
              }
            }}
            className="relative overflow-hidden rounded-[1.65rem] border border-[#15EA3E]/25 bg-[#071007] p-4 shadow-[0_18px_42px_rgba(0,0,0,0.34),0_0_34px_rgba(21,234,62,0.08)] active:scale-[0.99]"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(21,234,62,0.24),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.06),transparent_48%)]" />
            <div className="relative z-10 flex gap-4">
              <div className="min-w-0 flex-1">
                <div className="inline-flex items-center gap-2 rounded-full bg-[#15EA3E] px-3 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-black">
                  <AfriSellIcon name="flash" size={12} />
                  Produit populaire
                </div>
                <h2 className="mt-3 line-clamp-2 text-lg font-black leading-tight text-white">{featuredProduct.title}</h2>
                <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-relaxed text-white/50">{featuredProduct.description}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-[#15EA3E]/30 bg-[#15EA3E]/10 px-3 py-1 text-[10px] font-black text-[#15EA3E]">
                    {formatMarketPrice(featuredProduct.villagePrice || featuredProduct.price, featuredProduct.currency)}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/44">
                    {(featuredProduct.likesCount || 0) + (featuredProduct.buyersCount || 0)} interactions
                  </span>
                </div>
              </div>
              <div className="h-28 w-28 shrink-0 overflow-hidden rounded-[1.35rem] border border-white/10 bg-black">
                <img src={featuredProduct.coverURL} alt={featuredProduct.title} className="h-full w-full object-cover" />
              </div>
            </div>

            {secondaryPopularProducts.length > 0 && (
              <div className="relative z-10 mt-4 flex gap-2 overflow-x-auto scrollbar-hide">
                {secondaryPopularProducts.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      navigate(`/market/${product.id}`);
                    }}
                    className="flex min-w-[130px] items-center gap-2 rounded-2xl border border-white/10 bg-black/28 p-2 text-left"
                  >
                    <img src={product.coverURL} alt={product.title} className="h-10 w-10 shrink-0 rounded-xl object-cover" />
                    <div className="min-w-0">
                      <p className="truncate text-[10px] font-black text-white">{product.title}</p>
                      <p className="mt-0.5 text-[9px] font-bold text-[#15EA3E]">
                        {formatMarketPrice(product.villagePrice || product.price, product.currency)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <div className="mb-2 mt-2 flex items-center justify-between px-4">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Articles a vendre</h2>
          <p className="mt-1 text-[10px] font-semibold text-gray-600">Depuis les publications ABC vendables</p>
        </div>
        <span className="text-[10px] font-black uppercase tracking-wider text-[#15EA3E]">{filteredProducts.length} actif(s)</span>
      </div>

      {error && (
        <div className="mx-4 mb-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-xs font-semibold text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <AfriSellIcon name="market" size={36} className="text-[#15EA3E]" />
          <p className="mt-4 text-sm font-black uppercase tracking-wide text-white">Chargement du marche</p>
        </div>
      ) : filteredProducts.length ? (
        <div className="grid grid-cols-2 gap-3 p-4 pb-24">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={toCheckoutProduct(product)} />
          ))}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center px-8 pb-24 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-gray-800 bg-[#050505] text-[#15EA3E]">
            <AfriSellIcon name="market" size={28} />
          </div>
          <h3 className="mt-5 text-lg font-black text-white">Aucun article</h3>
          <p className="mt-2 text-sm leading-relaxed text-gray-500">
            Publie un article depuis ABC pour le voir apparaitre ici avec le bouton Acheter.
          </p>
          <Link to="/feed" className="mt-5 rounded-2xl bg-[#15EA3E] px-5 py-3 text-xs font-black uppercase tracking-widest text-black">
            Publier sur ABC
          </Link>
        </div>
      )}
    </div>
  );
}
