import React from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../store/useAppStore';
import { AfriSellIcon } from './AfriSellIcon';
import { useFirebaseAuth } from '../hooks/useFirebaseAuth';
import { useAfriSpayWallet } from '../hooks/useAfriSpayWallet';
import { completeCommerceOrder } from '../domains/commerce';

const formatPrice = (value: number, currency = 'USD') => {
  if (currency === 'USD') return `$${value.toLocaleString('fr-FR')}`;
  if (currency === 'CDF') return `${value.toLocaleString('fr-FR')} CDF`;
  return `${value.toLocaleString('fr-FR')} ${currency}`;
};

export default function BottomSheet() {
  const { isCheckoutOpen, selectedProduct, selectedDelivery, closeCheckout, removeFromCart } = useAppStore();
  const { user, profile } = useFirebaseAuth();
  const { balance, currency } = useAfriSpayWallet();
  const [paymentStatus, setPaymentStatus] = React.useState<'idle' | 'processing' | 'success'>('idle');
  const [checkoutError, setCheckoutError] = React.useState('');
  const [confirmedOrder, setConfirmedOrder] = React.useState<{ orderId: string; threadId: string; villageStatus: string } | null>(null);

  const deliveryPrice = Number(selectedDelivery?.price || 0);
  const totalAmount = Number(selectedProduct?.villagePrice || selectedProduct?.price || 0) + deliveryPrice;

  const handlePayment = async () => {
    if (!selectedProduct || paymentStatus === 'processing') return;
    if (!user) {
      setCheckoutError('Connecte-toi pour payer avec AfriSpay.');
      return;
    }

    setPaymentStatus('processing');
    setCheckoutError('');

    try {
      const result = await completeCommerceOrder({
        user,
        profile,
        product: selectedProduct,
        delivery: selectedDelivery
      });
      removeFromCart(selectedProduct.id);
      setConfirmedOrder({
        orderId: result.orderId,
        threadId: result.threadId,
        villageStatus: result.villageStatus
      });
      setPaymentStatus('success');
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'Paiement AfriSpay impossible.');
      setPaymentStatus('idle');
    }
  };

  const handleClose = () => {
    if (paymentStatus !== 'processing') {
      setPaymentStatus('idle');
      setCheckoutError('');
      setConfirmedOrder(null);
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
            className="absolute inset-0 z-50 bg-[#000000]/80 backdrop-blur-md md:rounded-[3.5rem]"
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
                className="flex w-full flex-col items-center justify-center py-8 text-center"
              >
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#15EA3E]/15">
                  <AfriSellIcon name="check" size={32} className="text-[#15EA3E]" />
                </div>
                <h3 className="mb-2 text-sm font-bold uppercase tracking-widest text-white">Commande confirmee</h3>
                <p className="text-xs font-semibold leading-relaxed text-gray-500">
                  Paiement AfriSpay, commande, livraison Safari et chat vendeur/client sont crees.
                </p>
                {confirmedOrder && (
                  <div className="mt-4 grid w-full grid-cols-3 gap-2">
                    <Link to="/chat" onClick={handleClose} className="rounded-xl border border-white/10 bg-white/[0.04] px-2 py-3 text-[9px] font-black uppercase tracking-wider text-[#15EA3E]">
                      Chat
                    </Link>
                    <Link to="/safari" onClick={handleClose} className="rounded-xl border border-white/10 bg-white/[0.04] px-2 py-3 text-[9px] font-black uppercase tracking-wider text-[#15EA3E]">
                      Livraison
                    </Link>
                    <button type="button" onClick={handleClose} className="rounded-xl bg-[#15EA3E] px-2 py-3 text-[9px] font-black uppercase tracking-wider text-black">
                      Fermer
                    </button>
                  </div>
                )}
                <p className="mt-3 text-[10px] font-mono text-gray-600">Order: {confirmedOrder?.orderId}</p>
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
                        <span className="text-[#15EA3E] font-mono font-bold">{formatPrice(selectedProduct.villagePrice, selectedProduct.currency)}</span>
                        <span className="text-gray-600 text-xs font-mono line-through">{formatPrice(selectedProduct.price, selectedProduct.currency)}</span>
                     </div>
                  </div>
                </div>

                <div className="flex justify-between p-4 bg-[#0A0A0A] rounded-xl mt-2 border border-gray-800">
                   <div className="flex flex-col">
                      <span className="text-gray-500 text-[10px] uppercase tracking-wider">Wallet Spay</span>
                      <span className="text-[#FFFFFF] font-mono text-sm mt-1">{formatPrice(balance, currency)}</span>
                   </div>
                   <div className="flex items-center">
                      <span className="text-[#FFFFFF] text-[9px] font-bold uppercase bg-[#FFFFFF]/10 px-2 py-1 rounded">Connecté</span>
                   </div>
                </div>

                {selectedDelivery && (
                  <div className="rounded-xl border border-gray-800 bg-[#0A0A0A] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Livraison Safari</span>
                        <p className="mt-1 text-sm font-black text-white">{selectedDelivery.title}</p>
                      </div>
                      <span className="text-xs font-black text-[#15EA3E]">{selectedDelivery.price ? formatPrice(selectedDelivery.price, selectedProduct.currency) : 'Gratuit'}</span>
                    </div>
                  </div>
                )}

                {checkoutError && (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs font-semibold leading-relaxed text-red-100">
                    {checkoutError}
                  </div>
                )}

                <button 
                  onClick={handlePayment}
                  disabled={paymentStatus === 'processing'}
                  className="w-full mt-4 bg-[#15EA3E] text-black font-bold text-xs uppercase tracking-widest py-4 rounded-xl shadow-[0_0_15px_rgba(21,234,62,0.2)] hover:bg-[#1ee844] active:scale-95 transition-all disabled:bg-gray-800 disabled:text-gray-500"
                >
                   {paymentStatus === 'processing' ? 'Confirmation...' : `Confirmer • ${formatPrice(totalAmount, selectedProduct.currency)}`}
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
