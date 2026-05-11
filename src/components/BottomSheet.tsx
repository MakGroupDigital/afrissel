import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../store/useAppStore';
import { AfriSellIcon } from './AfriSellIcon';

export default function BottomSheet() {
  const { isCheckoutOpen, selectedProduct, closeCheckout, processPayment, balance } = useAppStore();
  const [paymentStatus, setPaymentStatus] = React.useState<'idle' | 'success'>('idle');

  const handlePayment = () => {
    const success = processPayment();
    if (success) {
       setPaymentStatus('success');
       setTimeout(() => {
         setPaymentStatus('idle');
         closeCheckout();
       }, 2000);
    } else {
       alert("Solde insuffisant !");
    }
  };

  const handleClose = () => {
    if (paymentStatus === 'idle') {
      closeCheckout();
    }
  }

  return (
    <AnimatePresence>
      {isCheckoutOpen && selectedProduct && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-[#000000]/80 backdrop-blur-md z-50 rounded-[3.5rem]"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute bottom-0 inset-x-0 bg-[#000000] rounded-t-[2.5rem] z-50 max-h-[80%] flex flex-col items-center p-6 border-t border-[#1a1a1a]"
          >
            <div className="w-12 h-1 bg-gray-800 rounded-full mb-6 cursor-grab" />
            
            {paymentStatus === 'success' ? (
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }} 
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center justify-center py-10"
              >
                <div className="w-16 h-16 rounded-full bg-[#FFFFFF]/10 flex items-center justify-center mb-4">
                  <AfriSellIcon name="check" size={32} className="text-[#FFFFFF]" />
                </div>
                <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-2">Paiement Réussi</h3>
                <p className="text-gray-500 text-xs font-mono">Tx: CONFIRMED</p>
              </motion.div>
            ) : (
              <div className="w-full flex-col flex gap-4">
                <div className="flex justify-between items-center w-full mb-2">
                  <h2 className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em]">Checkout</h2>
                  <button onClick={handleClose} className="text-gray-500 hover:text-white transition-colors">
                    <AfriSellIcon name="close" size={20} />
                  </button>
                </div>
                
                <div className="flex gap-4 items-center p-4 bg-[#0A0A0A] rounded-xl border border-gray-800">
                  <img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="w-16 h-16 rounded-lg object-cover" />
                  <div className="flex flex-col flex-1">
                     <span className="text-gray-500 text-[10px] font-bold uppercase tracking-wider">{selectedProduct.seller}</span>
                     <span className="text-[#e0e0e0] font-medium text-sm leading-tight mt-1">{selectedProduct.name}</span>
                     <div className="flex items-center justify-between mt-2">
                        <span className="text-[#15EA3E] font-mono font-bold">${selectedProduct.villagePrice}</span>
                        <span className="text-gray-600 text-xs font-mono line-through">${selectedProduct.price}</span>
                     </div>
                  </div>
                </div>

                <div className="flex justify-between p-4 bg-[#0A0A0A] rounded-xl mt-2 border border-gray-800">
                   <div className="flex flex-col">
                      <span className="text-gray-500 text-[10px] uppercase tracking-wider">Wallet Spay</span>
                      <span className="text-[#FFFFFF] font-mono text-sm mt-1">${balance.toFixed(2)}</span>
                   </div>
                   <div className="flex items-center">
                      <span className="text-[#FFFFFF] text-[9px] font-bold uppercase bg-[#FFFFFF]/10 px-2 py-1 rounded">Connecté</span>
                   </div>
                </div>

                <button 
                  onClick={handlePayment}
                  className="w-full mt-4 bg-[#15EA3E] text-black font-bold text-xs uppercase tracking-widest py-4 rounded-xl shadow-[0_0_15px_rgba(21,234,62,0.2)] hover:bg-[#1ee844] active:scale-95 transition-all"
                >
                   Confirmer • ${selectedProduct.villagePrice}
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
