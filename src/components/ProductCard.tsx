import React from 'react';
import { Product, useAppStore } from '../store/useAppStore';

interface ProductCardProps {
  product: Product;
}

const formatPrice = (value: number, currency = 'USD') => {
  if (currency === 'USD') return `$${value.toLocaleString('fr-FR')}`;
  if (currency === 'CDF') return `${value.toLocaleString('fr-FR')} CDF`;
  return `${value.toLocaleString('fr-FR')} ${currency}`;
};

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const openCheckout = useAppStore(state => state.openCheckout);
  const progressPercent = Math.min((product.buyersCount / Math.max(product.buyersNeeded, 1)) * 100, 100);

  return (
    <div 
      className="bg-[#0A0A0A] rounded-xl overflow-hidden flex flex-col border border-gray-800 p-3 transition-transform active:scale-95 cursor-pointer"
      onClick={() => openCheckout(product)}
    >
      <div className="relative h-28 rounded-lg overflow-hidden mb-2">
        <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
      </div>
      <div className="flex flex-col justify-between flex-1">
         <p className="text-[10px] font-medium text-gray-300 line-clamp-2 leading-snug">{product.name}</p>
         <p className="text-xs text-[#FFFFFF] font-bold mt-1 font-mono">{formatPrice(product.villagePrice, product.currency)}</p>
         <div className="mt-2 w-full bg-gray-900 h-1 rounded-full overflow-hidden">
            <div 
              className="bg-[#15EA3E] h-full" 
              style={{ width: `${progressPercent}%` }}
            ></div>
         </div>
         <p className="text-[8px] text-gray-500 mt-1 uppercase">{product.buyersCount}/{product.buyersNeeded} acheteurs</p>
      </div>
    </div>
  );
}

export default ProductCard;
