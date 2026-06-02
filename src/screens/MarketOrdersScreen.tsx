import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { onValue, ref } from 'firebase/database';
import { AfriSellIcon } from '../components/AfriSellIcon';
import { useFirebaseAuth } from '../hooks/useFirebaseAuth';
import { realtimeDb } from '../lib/firebase';
import { formatMarketPrice } from '../hooks/useAfriMarket';

type MarketOrder = {
  id: string;
  productId: string;
  productName: string;
  productImage?: string;
  sellerId: string;
  sellerName: string;
  buyerId: string;
  buyerName: string;
  totalAmount: number;
  currency: string;
  status: string;
  deliveryStatus?: string;
  villageStatus?: string;
  createdAt?: number;
};

export default function MarketOrdersScreen() {
  const { user } = useFirebaseAuth();
  const [orders, setOrders] = useState<MarketOrder[]>([]);

  useEffect(() => {
    if (!user) {
      setOrders([]);
      return undefined;
    }

    const ordersRef = ref(realtimeDb, 'orders');
    const unsubscribe = onValue(ordersRef, (snapshot) => {
      const data = snapshot.val() as Record<string, MarketOrder> | null;
      const nextOrders = Object.entries(data || {})
        .map(([id, order]) => ({ ...order, id: order.id || id }))
        .filter((order) => order.buyerId === user.uid || order.sellerId === user.uid)
        .sort((first, second) => Number(second.createdAt || 0) - Number(first.createdAt || 0));
      setOrders(nextOrders);
    });

    return unsubscribe;
  }, [user]);

  const stats = useMemo(() => ({
    paid: orders.filter((order) => order.status === 'paid').length,
    delivery: orders.filter((order) => order.deliveryStatus && order.deliveryStatus !== 'delivered').length,
    completed: orders.filter((order) => order.status === 'completed').length
  }), [orders]);

  if (!user) {
    return (
      <main className="min-h-full bg-black px-4 pb-8 pt-4 text-center text-white">
        <AfriSellIcon name="order" size={34} className="mx-auto mt-16 text-[#15EA3E]" />
        <h1 className="mt-4 text-xl font-black">Connexion requise</h1>
        <p className="mt-2 text-sm font-semibold text-white/45">Connecte-toi pour voir tes commandes Market.</p>
        <Link to="/login" state={{ next: '/market/orders' }} className="mt-5 inline-flex rounded-2xl bg-[#15EA3E] px-5 py-3 text-xs font-black uppercase tracking-wider text-black">
          Se connecter
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-full bg-black px-4 pb-24 pt-4 text-white">
      <header className="flex items-center justify-between">
        <Link to="/market" className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-[#15EA3E]" aria-label="Retour">
          <AfriSellIcon name="arrow" size={18} className="rotate-180" />
        </Link>
        <div className="text-right">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">Market</p>
          <h1 className="mt-1 text-xl font-black">Mes commandes</h1>
        </div>
      </header>

      <section className="mt-5 grid grid-cols-3 gap-2">
        {[
          { label: 'Payees', value: stats.paid },
          { label: 'Livraison', value: stats.delivery },
          { label: 'Terminees', value: stats.completed }
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center">
            <p className="text-lg font-black text-[#15EA3E]">{stat.value}</p>
            <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-white/42">{stat.label}</p>
          </div>
        ))}
      </section>

      <section className="mt-5 space-y-3">
        {orders.length ? orders.map((order) => (
          <article key={order.id} className="rounded-[1.3rem] border border-white/10 bg-white/[0.04] p-3">
            <div className="flex gap-3">
              <img src={order.productImage || '/afrimarket.jpeg'} alt="" className="h-16 w-16 rounded-2xl object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black">{order.productName}</p>
                <p className="mt-1 text-[10px] font-bold text-white/42">
                  {order.buyerId === user.uid ? `Stand: ${order.sellerName}` : `Client: ${order.buyerName}`}
                </p>
                <p className="mt-2 text-sm font-black text-[#15EA3E]">{formatMarketPrice(order.totalAmount, order.currency)}</p>
              </div>
              <span className="h-max rounded-full bg-[#15EA3E]/10 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-[#15EA3E]">
                {order.status}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Link to={`/market/${order.productId}`} className="rounded-xl border border-white/10 bg-black/20 px-2 py-2 text-center text-[9px] font-black uppercase tracking-wider text-white/62">
                Produit
              </Link>
              <Link to="/safari" className="rounded-xl border border-white/10 bg-black/20 px-2 py-2 text-center text-[9px] font-black uppercase tracking-wider text-white/62">
                Livraison
              </Link>
              <Link to="/chat" className="rounded-xl bg-[#15EA3E] px-2 py-2 text-center text-[9px] font-black uppercase tracking-wider text-black">
                Chat
              </Link>
            </div>
          </article>
        )) : (
          <div className="rounded-[1.3rem] border border-white/10 bg-white/[0.04] p-6 text-center">
            <p className="text-sm font-black">Aucune commande Market</p>
            <p className="mt-2 text-xs font-semibold text-white/45">Tes achats et ventes apparaitront ici.</p>
          </div>
        )}
      </section>
    </main>
  );
}
