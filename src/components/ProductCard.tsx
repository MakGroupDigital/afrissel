import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AfriSellIcon } from './AfriSellIcon';
import { Product } from '../store/useAppStore';

interface ProductCardProps {
  product: Product;
}

const formatPrice = (value: number, currency = 'USD') => {
  if (currency === 'USD') return `$${value.toLocaleString('fr-FR')}`;
  if (currency === 'CDF') return `${value.toLocaleString('fr-FR')} CDF`;
  return `${value.toLocaleString('fr-FR')} ${currency}`;
};

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const navigate = useNavigate();
  const progressPercent = Math.min((product.buyersCount / Math.max(product.buyersNeeded, 1)) * 100, 100);
  const hasDiscount = product.price > product.villagePrice;
  const discountPercent = hasDiscount ? Math.round(((product.price - product.villagePrice) / product.price) * 100) : 0;

  return (
    <div 
      className="flex cursor-pointer flex-col overflow-hidden rounded-[1.15rem] border border-white/10 bg-[#0A0A0A] p-2.5 transition-transform active:scale-95"
      onClick={() => navigate(`/market/${product.id}`)}
    >
      <div className="relative mb-2 h-32 overflow-hidden rounded-[0.95rem] bg-[#050505]">
        <img src={product.imageUrl || '/afrimarket.jpeg'} alt={product.name} className="h-full w-full object-cover" />
        <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/72 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-[#15EA3E]">
          <AfriSellIcon name="shield" size={10} />
          Stand
        </div>
        {discountPercent > 0 && (
          <div className="absolute bottom-2 right-2 rounded-full bg-[#15EA3E] px-2 py-1 text-[9px] font-black text-black">
            -{discountPercent}%
          </div>
        )}
      </div>
      <div className="flex flex-col justify-between flex-1">
         <p className="line-clamp-2 min-h-[30px] text-[11px] font-black leading-tight text-white">{product.name}</p>
         <p className="mt-1 truncate text-[9px] font-bold uppercase tracking-wide text-white/35">{product.seller}</p>
         <div className="mt-2 flex items-end justify-between gap-2">
          <div>
            <p className="text-sm font-black text-[#15EA3E]">{formatPrice(product.villagePrice, product.currency)}</p>
            {hasDiscount && (
              <p className="text-[9px] font-bold text-white/32 line-through">{formatPrice(product.price, product.currency)}</p>
            )}
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[8px] font-black uppercase tracking-wide text-white/45">
            {product.category || 'Market'}
          </span>
         </div>
         <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-900">
            <div 
              className="h-full bg-[#15EA3E]" 
              style={{ width: `${progressPercent}%` }}
            ></div>
         </div>
         <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-[8px] font-black uppercase tracking-wide text-gray-500">Village {product.buyersCount}/{product.buyersNeeded}</p>
          <p className="text-[8px] font-black uppercase tracking-wide text-[#15EA3E]">Prêt à livrer</p>
         </div>
      </div>
    </div>
  );
}

export default ProductCard;
