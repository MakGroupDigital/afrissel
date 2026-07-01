import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { onValue, ref } from 'firebase/database';
import { AfriSellIcon } from '../components/AfriSellIcon';
import { realtimeDb } from '../lib/firebase';
import { formatMarketPrice } from '../hooks/useAfriMarket';

type VerifiedOrder = {
  id: string;
  productId: string;
  productName: string;
  productImage?: string;
  productCategory?: string;
  sellerName: string;
  buyerName: string;
  totalAmount: number;
  currency: string;
  status: string;
  paymentStatus?: string;
  paymentMode?: string;
  documentType?: 'receipt' | 'invoice';
  deliveryStatus?: string;
  createdAt?: number;
};

const statusLabel = (value?: string) => {
  if (value === 'paid' || value === 'confirmed') return 'Confirmé';
  if (value === 'pay_on_delivery' || value === 'awaiting_delivery_payment') return 'À payer à la livraison';
  if (value === 'delivered') return 'Livré';
  if (value === 'pending_assignment') return 'Livraison en préparation';
  if (value === 'pickup_requested') return 'Retrait demandé';
  return value || 'En cours';
};

export default function OrderVerificationScreen() {
  const { orderId } = useParams();
  const [order, setOrder] = useState<VerifiedOrder | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return undefined;
    }

    const orderRef = ref(realtimeDb, `orders/${orderId}`);
    const unsubscribe = onValue(orderRef, (snapshot) => {
      const data = snapshot.val() as Omit<VerifiedOrder, 'id'> | null;
      setOrder(data ? { ...data, id: orderId } : null);
      setLoading(false);
    });

    return unsubscribe;
  }, [orderId]);

  if (loading) {
    return (
      <main className="flex min-h-full flex-col items-center justify-center bg-black px-8 text-center text-white">
        <AfriSellIcon name="scan" size={36} className="text-[#15EA3E]" />
        <p className="mt-4 text-sm font-black uppercase tracking-wide">Vérification AfriSell</p>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="flex min-h-full flex-col items-center justify-center bg-black px-8 text-center text-white">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-red-500/20 bg-red-500/10 text-red-200">
          <AfriSellIcon name="close" size={28} />
        </div>
        <h1 className="mt-5 text-lg font-black">Document introuvable</h1>
        <p className="mt-2 text-sm leading-relaxed text-white/45">Ce QR code ne correspond à aucune commande AfriSell active.</p>
        <Link to="/market" className="mt-5 rounded-2xl bg-[#15EA3E] px-5 py-3 text-xs font-black uppercase tracking-wider text-black">
          Ouvrir Market
        </Link>
      </main>
    );
  }

  const isReceipt = order.documentType !== 'invoice';

  return (
    <main className="min-h-full bg-black px-4 pb-24 pt-4 text-white">
      <header className="rounded-[1.7rem] border border-[#15EA3E]/24 bg-[#071007] p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-black/30 p-2">
            <img src="/afriselliconecentral.png" alt="" className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">Document vérifié</p>
            <h1 className="mt-1 text-xl font-black">{isReceipt ? 'Reçu AfriSell' : 'Facture AfriSell'}</h1>
          </div>
          <span className="rounded-full bg-[#15EA3E] px-3 py-1 text-[9px] font-black uppercase tracking-wider text-black">
            Authentique
          </span>
        </div>
      </header>

      <section className="mt-4 overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.04]">
        <img src={order.productImage || '/afrimarket.jpeg'} alt="" className="h-56 w-full object-cover" />
        <div className="p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#15EA3E]">{order.productCategory || 'Market'}</p>
          <h2 className="mt-2 text-xl font-black leading-tight">{order.productName}</h2>
          <p className="mt-1 text-xs font-semibold text-white/45">Stand: {order.sellerName}</p>
          <p className="mt-1 text-xs font-semibold text-white/45">Client: {order.buyerName}</p>
        </div>
      </section>

      <section className="mt-4 grid grid-cols-2 gap-2">
        {[
          { label: 'Paiement', value: statusLabel(order.paymentStatus || order.status), icon: 'pay' as const },
          { label: 'Livraison', value: statusLabel(order.deliveryStatus), icon: 'send' as const },
          { label: 'Montant', value: formatMarketPrice(order.totalAmount, order.currency), icon: 'market' as const },
          { label: 'Commande', value: order.id.slice(-8).toUpperCase(), icon: 'order' as const }
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
            <AfriSellIcon name={item.icon} size={17} className="text-[#15EA3E]" />
            <p className="mt-2 truncate text-sm font-black">{item.value}</p>
            <p className="mt-0.5 text-[9px] font-black uppercase tracking-wider text-white/38">{item.label}</p>
          </div>
        ))}
      </section>

      <section className="mt-4 rounded-[1.4rem] border border-[#15EA3E]/22 bg-[#15EA3E]/10 p-4">
        <p className="text-sm font-black text-[#15EA3E]">État actuel</p>
        <p className="mt-2 text-xs font-semibold leading-relaxed text-white/58">
          {isReceipt
            ? 'Le paiement a été confirmé dans AfriSpay. La commande peut être suivie jusqu’à la livraison.'
            : 'Cette facture attend un paiement à la livraison. Le paiement devra être confirmé avant clôture.'}
        </p>
      </section>
    </main>
  );
}
