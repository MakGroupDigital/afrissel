import React from 'react';
import { cn } from '../lib/utils';
import { mockProducts } from '../data/mockData';
import ProductCard from '../components/ProductCard';
import { AfriSellIcon } from '../components/AfriSellIcon';

interface MessageBubbleProps {
  isMine: boolean;
  message?: string;
  product?: typeof mockProducts[0];
  time: string;
}

function MessageBubble({ isMine, message, product, time }: MessageBubbleProps) {
  return (
    <div className={cn(
      "flex flex-col max-w-[80%] mb-4",
      isMine ? "self-end items-end" : "self-start items-start"
    )}>
      <div className={cn(
        "p-3 rounded-xl border",
        isMine 
          ? "bg-[#15EA3E]/10 text-white border-[#15EA3E]/30 rounded-br-sm" 
          : "bg-[#0A0A0A] text-gray-300 border-gray-800 rounded-bl-sm",
        product ? "p-1.5 w-64" : ""
      )}>
        {message && <p className="text-[13px] font-medium leading-relaxed">{message}</p>}
        {product && (
          <div className="w-full">
            <ProductCard product={product} />
          </div>
        )}
      </div>
      <span className="text-[10px] text-gray-600 mt-1 font-mono uppercase">{time}</span>
    </div>
  );
}

export default function ChatRoom() {
  return (
    <div className="h-full bg-[#000000] flex flex-col relative pt-[60px]">
      
      <div className="absolute top-0 inset-x-0 h-[60px] bg-[#000000]/95 backdrop-blur-md z-30 px-3 flex items-center justify-between border-b border-gray-900">
         <div className="flex items-center gap-3">
            <button className="p-2 -ml-2 text-gray-500 hover:text-white transition-colors">
               <AfriSellIcon name="arrow" size={20} className="rotate-180" />
            </button>
            <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-gray-800">
               <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=merchand" alt="Contact" className="w-full h-full bg-gray-900" />
            </div>
            <div className="flex flex-col">
               <span className="text-white font-bold tracking-wide text-xs uppercase">Mama Africa Tex</span>
               <span className="text-[#FFFFFF] text-[9px] font-mono tracking-wider">ONLINE</span>
            </div>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 flex flex-col-reverse pb-[120px]">
         <MessageBubble 
           isMine={true} 
           message="D'accord, je valide la commande groupée." 
           time="14:32" 
         />
         <MessageBubble 
           isMine={false} 
           product={mockProducts[1]} 
           time="14:31" 
         />
         <MessageBubble 
           isMine={false} 
           message="Bien sûr, voici l'offre actuelle avec le Prix du Village. Si vous trouvez 6 autres acheteurs, le prix baisse à 65$ !" 
           time="14:30" 
         />
         <MessageBubble 
           isMine={true} 
           message="Bonjour ! Je suis intéressé par le Wax Premium. Avez-vous une offre groupée ?" 
           time="14:28" 
         />
         
         <div className="w-full text-center my-4 flex items-center gap-2">
            <div className="h-[1px] flex-1 bg-gray-900"></div>
            <span className="text-gray-600 text-[9px] font-mono uppercase tracking-widest">Aujourd'hui</span>
            <div className="h-[1px] flex-1 bg-gray-900"></div>
         </div>
      </div>

      <div className="absolute bottom-0 inset-x-0 pb-[85px] pt-3 px-4 bg-[#000000] border-t border-gray-900 flex flex-col gap-3">
         <div className="flex justify-between items-center px-1">
            <button className="flex items-center gap-1.5 text-[#FFFFFF] opacity-80 hover:opacity-100 transition-opacity">
               <AfriSellIcon name="language" size={12} />
               <span className="text-[9px] font-mono tracking-wider uppercase">Auto-Traduction: Lingala</span>
            </button>
         </div>
         
         <div className="flex items-end gap-2">
            <button className="p-3 bg-[#0A0A0A] text-gray-500 rounded-xl hover:text-white border border-gray-800 transition-colors shrink-0">
               <AfriSellIcon name="clip" size={18} />
            </button>
            <div className="flex-1 bg-[#0A0A0A] rounded-xl min-h-[44px] max-h-[100px] flex items-center px-4 overflow-hidden border border-gray-800 focus-within:border-[#15EA3E]/50 transition-colors">
               <textarea 
                 placeholder="Message..." 
                 className="w-full bg-transparent border-none outline-none text-[#e0e0e0] placeholder:text-gray-600 resize-none py-3 text-xs"
                 rows={1}
               />
            </div>
            <button className="h-11 w-11 bg-[#15EA3E] text-black rounded-xl flex items-center justify-center shrink-0 active:scale-95 transition-transform">
               <AfriSellIcon name="send" size={18} className="translate-x-[1px]" />
            </button>
         </div>
      </div>
    </div>
  );
}
