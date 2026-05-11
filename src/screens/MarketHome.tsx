import React from 'react';
import { mockProducts } from '../data/mockData';
import ProductCard from '../components/ProductCard';
import { AfriSellIcon } from '../components/AfriSellIcon';

export default function MarketHome() {
  const categories = ["Tout", "Tech", "Mode", "Agro", "Services", "Maison"];
  
  return (
    <div className="min-h-full bg-[#000000] flex flex-col">
      {/* Header */}
      <div className="sticky top-0 bg-[#000000]/95 backdrop-blur-md z-30 px-4 py-4 border-b border-gray-900">
        <div className="flex items-center gap-3 bg-[#0A0A0A] p-3 rounded-xl border border-gray-800 focus-within:border-[#15EA3E]/50 transition-colors">
           <AfriSellIcon name="search" size={20} className="text-[#15EA3E]" />
           <input 
             type="text" 
             placeholder="Rechercher sur le Market..." 
             className="bg-transparent border-none outline-none text-white text-sm w-full font-medium placeholder:text-gray-600"
           />
        </div>
      </div>

      {/* Category Chips */}
      <div className="flex overflow-x-auto scrollbar-hide px-4 py-4 gap-3">
         {categories.map((cat, idx) => (
           <button 
             key={cat}
             className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
               idx === 0 
                 ? "bg-[#15EA3E] text-black" 
                 : "bg-[#0A0A0A] text-gray-400 border border-gray-800 hover:border-gray-600"
             }`}
           >
             {cat}
           </button>
         ))}
      </div>

      <div className="px-4 flex items-center justify-between mb-2 mt-2">
         <h2 className="text-xs uppercase tracking-[0.2em] font-semibold text-gray-400">Marché Groupé</h2>
         <span className="text-[#15EA3E] text-[10px] underline cursor-pointer">Voir tout</span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-3 p-4 pb-12">
         {mockProducts.map((p) => (
           <ProductCard key={p.id} product={p} />
         ))}
         {/* duplicate for demo scroll */}
         {mockProducts.map((p) => (
           <ProductCard key={p.id + 'dup'} product={{...p, id: p.id + 'dup'}} />
         ))}
      </div>
    </div>
  );
}
