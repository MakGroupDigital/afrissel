import React from 'react';
import { mockProducts } from '../data/mockData';
import { useAppStore } from '../store/useAppStore';
import { AfriSellIcon } from '../components/AfriSellIcon';

interface VideoItemProps {
  product: typeof mockProducts[0];
}

const VideoItem: React.FC<VideoItemProps> = ({ product }) => {
  const openCheckout = useAppStore(state => state.openCheckout);

  return (
    <div className="h-full w-full snap-start relative bg-[#000000] flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0">
        <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#000000]/40 via-[#000000]/20 to-[#000000]"></div>
      </div>

      <div className="absolute inset-0 flex flex-col justify-end p-5 pb-[120px] z-10 pointer-events-none">
        
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></div>
          <span className="text-[10px] uppercase font-bold tracking-tighter text-white">LIVE • ABC FEED</span>
        </div>

        <div className="flex gap-4 justify-between items-end mb-6">
          <div className="flex-1 flex flex-col gap-2">
             <div className="flex items-center gap-2">
                 <div className="w-8 h-8 rounded-full bg-gray-900 border border-[#15EA3E]/30 overflow-hidden">
                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${product.seller}`} alt="avt" className="w-full h-full object-cover" />
                 </div>
                 <h3 className="text-gray-300 font-bold text-xs uppercase tracking-wider">@{product.seller.replace(/\s+/g, '')}</h3>
             </div>
             <p className="text-[#e0e0e0] text-sm font-medium leading-snug max-w-[90%] mt-2">{product.description}</p>
             <div className="mt-2 flex items-center">
               <span className="text-[#FFFFFF] text-xs font-mono font-bold tracking-tight">PRIX VILLAGE: {product.villagePrice} FCFA</span>
             </div>
          </div>

          <div className="flex flex-col gap-5 items-center pointer-events-auto">
             <button className="flex flex-col items-center gap-1 group">
                 <AfriSellIcon name="heart" size={24} className="text-gray-400 group-hover:text-red-500 transition-colors" />
               <span className="text-gray-400 text-[10px] font-mono">12K</span>
             </button>
             <button className="flex flex-col items-center gap-1 group">
                 <AfriSellIcon name="comment" size={24} className="text-gray-400 group-hover:text-white transition-colors" />
               <span className="text-gray-400 text-[10px] font-mono">482</span>
             </button>
             <button className="flex flex-col items-center gap-1 group">
                 <AfriSellIcon name="share" size={24} className="text-gray-400 group-hover:text-white transition-colors" />
             </button>
          </div>
        </div>

        <div className="w-full pointer-events-auto mb-2">
           <button 
             onClick={() => openCheckout(product)}
             className="w-full bg-[#15EA3E] text-black font-bold text-xs py-4 rounded-xl active:scale-95 transition-all uppercase tracking-widest"
           >
             Acheter Maintenant
           </button>
        </div>
      </div>
    </div>
  );
}

export default function VideoFeed() {
  return (
    <div className="h-full w-full bg-[#000000] snap-y snap-mandatory overflow-y-scroll scrollbar-hide">
      {mockProducts.map((product) => (
        <VideoItem key={product.id} product={product} />
      ))}
    </div>
  );
}
