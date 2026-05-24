import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { AfriSellIcon } from '../components/AfriSellIcon';
import { MARKET_CATEGORIES, toCheckoutProduct, useAfriMarket } from '../hooks/useAfriMarket';

export default function MarketHome() {
  const { marketProducts, loading, error } = useAfriMarket();
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
