import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { onValue, ref } from 'firebase/database';
import { AfriZiaIcon } from '../components/AfriZiaIcon';
import { useFirebaseAuth } from '../hooks/useFirebaseAuth';
import { realtimeDb } from '../lib/firebase';
import { formatMarketPrice } from '../hooks/useAfriMarket';
import { updateZandofyOrderStatus, updateZikMartSupplierStatus, ZikMartSupplierStage } from '../domains/commerce';

type MarketOrder = {
  id: string;
  productId: string;
  productName: string;
  productImage?: string;
  productCategory?: string;
  sellerId: string;
  sellerName: string;
  buyerId: string;
  buyerName: string;
  totalAmount: number;
  currency: string;
  status: string;
  paymentStatus?: string;
  documentType?: 'receipt' | 'invoice';
  deliveryStatus?: string;
  deliveryAddress?: string;
  deliveryPhone?: string;
  villageStatus?: string;
  module?: string;
  storeId?: string;
  storeName?: string;
  isDigital?: boolean;
  marketplace?: string;
  dropshippingEnabled?: boolean;
  supplierFulfillmentStatus?: ZikMartSupplierStage | 'not_applicable';
  createdAt?: number;
};

const orderStatusLabel = (status?: string) => {
  if (status === 'paid') return 'Payée';
  if (status === 'preparing') return 'En préparation';
  if (status === 'delivering') return 'En livraison';
  if (status === 'completed') return 'Terminée';
  if (status === 'awaiting_delivery_payment') return 'Paiement à la livraison';
  if (status === 'cancelled') return 'Annulée';
  return status || 'En attente';
};

export default function MarketOrdersScreen() {
  const { user } = useFirebaseAuth();
  const location = useLocation();
  const [orders, setOrders] = useState<MarketOrder[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [busyOrder, setBusyOrder] = useState('');
  const [actionStatus, setActionStatus] = useState('');
  const moduleFilter = new URLSearchParams(location.search).get('module');
  const isZandofyMode = moduleFilter === 'zandofy';

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
        .filter((order) => !isZandofyMode || order.module === 'zandofy' || Boolean(order.storeId))
        .sort((first, second) => Number(second.createdAt || 0) - Number(first.createdAt || 0));
      setOrders(nextOrders);
    });

    return unsubscribe;
  }, [isZandofyMode, user]);

  const stats = useMemo(() => ({
    paid: orders.filter((order) => order.status === 'paid' || order.paymentStatus === 'confirmed').length,
    delivery: orders.filter((order) => ['preparing', 'delivering'].includes(order.status) || (order.deliveryStatus && order.deliveryStatus !== 'delivered')).length,
    completed: orders.filter((order) => order.status === 'completed').length
  }), [orders]);

  const visibleOrders = useMemo(() => orders.filter((order) => {
    if (statusFilter === 'paid') return order.status === 'paid';
    if (statusFilter === 'preparing') return order.status === 'preparing';
    if (statusFilter === 'delivering') return order.status === 'delivering';
    if (statusFilter === 'completed') return order.status === 'completed';
    return true;
  }), [orders, statusFilter]);

  const updateOrderStage = async (orderId: string, status: 'preparing' | 'delivering') => {
    if (!user) return;
    setBusyOrder(orderId);
    setActionStatus('');
    try {
      await updateZandofyOrderStatus({ user, orderId, status });
      setActionStatus(status === 'preparing' ? 'Commande passée en préparation.' : 'Commande remise à Safari pour livraison.');
    } catch (error) {
      setActionStatus(error instanceof Error ? error.message : 'Mise à jour impossible.');
    } finally {
      setBusyOrder('');
    }
  };

  const updateSupplierStage = async (orderId: string, status: ZikMartSupplierStage) => {
    if (!user) return;
    setBusyOrder(orderId);
    setActionStatus('');
    try {
      await updateZikMartSupplierStatus({ user, orderId, status });
      setActionStatus(status === 'confirmed' ? 'Fournisseur confirmé.' : status === 'dispatched' ? 'Expédition fournisseur enregistrée.' : status === 'unavailable' ? 'Indisponibilité signalée au client.' : 'Demande transmise au fournisseur.');
    } catch (error) {
      setActionStatus(error instanceof Error ? error.message : 'Mise à jour fournisseur impossible.');
    } finally {
      setBusyOrder('');
    }
  };

  if (!user) {
    return (
      <main className="min-h-full bg-black px-4 pb-8 pt-4 text-center text-white">
        <AfriZiaIcon name="order" size={34} className="mx-auto mt-16 text-[#15EA3E]" />
        <h1 className="mt-4 text-xl font-black">Connexion requise</h1>
        <p className="mt-2 text-sm font-semibold text-white/45">Connecte-toi pour voir tes commandes {isZandofyMode ? 'Zandofy' : 'Market'}.</p>
        <Link to="/login" state={{ next: isZandofyMode ? '/market/orders?module=zandofy' : '/market/orders' }} className="mt-5 inline-flex rounded-2xl bg-[#15EA3E] px-5 py-3 text-xs font-black uppercase tracking-wider text-black">
          Se connecter
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-full bg-black px-4 pb-24 pt-4 text-white">
      <header className="flex items-center justify-between">
        <Link to={isZandofyMode ? '/zandofy/dashboard' : '/market'} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-[#15EA3E]" aria-label="Retour">
          <AfriZiaIcon name="arrow" size={18} className="rotate-180" />
        </Link>
        <div className="text-right">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">{isZandofyMode ? 'Zandofy' : 'Market'}</p>
          <h1 className="mt-1 text-xl font-black">Mes commandes</h1>
        </div>
      </header>

      <section className="mt-5 grid grid-cols-3 gap-2">
        {[
          { label: 'Payées', value: stats.paid },
          { label: 'Livraison', value: stats.delivery },
          { label: 'Terminées', value: stats.completed }
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center">
            <p className="text-lg font-black text-[#15EA3E]">{stat.value}</p>
            <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-white/42">{stat.label}</p>
          </div>
        ))}
      </section>

      {isZandofyMode && (
        <section className="mt-5">
          <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
            {[
              ['all', 'Toutes'],
              ['paid', 'À traiter'],
              ['preparing', 'Préparation'],
              ['delivering', 'Livraison'],
              ['completed', 'Terminées']
            ].map(([value, label]) => (
              <button key={value} type="button" onClick={() => setStatusFilter(value)} className={`shrink-0 rounded-full border px-3 py-2 text-[10px] font-black ${statusFilter === value ? 'border-[#15EA3E] bg-[#15EA3E] text-black' : 'border-white/10 bg-white/[0.04] text-white/55'}`}>
                {label}
              </button>
            ))}
          </div>
        </section>
      )}

      {actionStatus && <p className={`mt-4 rounded-2xl border px-3 py-3 text-center text-xs font-bold ${actionStatus.includes('impossible') || actionStatus.includes('Seul') || actionStatus.includes('doit') ? 'border-red-400/20 bg-red-500/10 text-red-100' : 'border-[#15EA3E]/20 bg-[#15EA3E]/10 text-[#15EA3E]'}`}>{actionStatus}</p>}

      <section className="mt-5 space-y-3">
        {visibleOrders.length ? visibleOrders.map((order) => {
          const isSeller = isZandofyMode && order.sellerId === user.uid;
          const canPrepare = isSeller && !order.isDigital && order.status === 'paid';
          const canDispatch = isSeller && !order.isDigital && order.status === 'preparing';
          const isDropshipping = isSeller && order.marketplace === 'zikmart' && order.dropshippingEnabled;
          const canConfirmSupplier = isDropshipping && order.supplierFulfillmentStatus === 'pending_supplier' && order.status === 'paid';
          const canDispatchSupplier = isDropshipping && order.supplierFulfillmentStatus === 'confirmed';
          return (
          <article key={order.id} className="rounded-[1.3rem] border border-white/10 bg-white/[0.04] p-3">
            <div className="flex gap-3">
              <img src={order.productImage || '/afrimarket.jpeg'} alt="" className="h-16 w-16 rounded-2xl object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black">{order.productName}</p>
                <p className="mt-1 text-[10px] font-bold text-white/42">
                {order.buyerId === user.uid ? `${isZandofyMode ? 'Boutique' : 'Stand'}: ${order.storeName || order.sellerName}` : `Client: ${order.buyerName}`}
                </p>
                <p className="mt-2 text-sm font-black text-[#15EA3E]">{formatMarketPrice(order.totalAmount, order.currency)}</p>
              </div>
              <span className="h-max rounded-full bg-[#15EA3E]/10 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-[#15EA3E]">
                {orderStatusLabel(order.status)}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-black/20 px-3 py-2">
              <span className="text-[9px] font-bold text-white/45">{order.isDigital ? 'Accès digital' : isDropshipping ? `Fournisseur: ${order.supplierFulfillmentStatus === 'confirmed' ? 'confirmé' : order.supplierFulfillmentStatus === 'dispatched' ? 'expédié' : order.supplierFulfillmentStatus === 'unavailable' ? 'indisponible' : 'en attente'}` : order.deliveryStatus === 'in_transit' ? 'Safari en route' : order.deliveryStatus === 'delivered' ? 'Livré' : 'Livraison à organiser'}</span>
              {isSeller && order.deliveryAddress && <span className="max-w-[52%] truncate text-right text-[9px] font-bold text-white/45">{order.deliveryAddress}</span>}
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2">
              <Link to={order.isDigital ? `/zandofy/access/${order.id}` : order.module === 'zandofy' ? `/zandofy/product/${order.productId}` : `/market/${order.productId}`} className="rounded-xl border border-white/10 bg-black/20 px-2 py-2 text-center text-[9px] font-black uppercase tracking-wider text-white/62">
                {order.isDigital ? 'Accès' : 'Produit'}
              </Link>
              <Link to="/safari" className="rounded-xl border border-white/10 bg-black/20 px-2 py-2 text-center text-[9px] font-black uppercase tracking-wider text-white/62">
                Livraison
              </Link>
              <Link to="/chat" className="rounded-xl bg-[#15EA3E] px-2 py-2 text-center text-[9px] font-black uppercase tracking-wider text-black">
                Chat
              </Link>
              <Link to={`/order/${order.id}`} className="rounded-xl border border-[#15EA3E]/25 bg-[#15EA3E]/10 px-2 py-2 text-center text-[9px] font-black uppercase tracking-wider text-[#15EA3E]">
                {order.documentType === 'invoice' ? 'Facture' : 'Reçu'}
              </Link>
            </div>
            {isSeller && (canPrepare || canDispatch) && (
              <button type="button" onClick={() => void updateOrderStage(order.id, canPrepare ? 'preparing' : 'delivering')} disabled={busyOrder === order.id} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#15EA3E] px-3 py-3 text-[9px] font-black uppercase tracking-wider text-black disabled:opacity-50">
                <AfriZiaIcon name={canPrepare ? 'order' : 'send'} size={14} />
                {busyOrder === order.id ? 'Mise à jour...' : canPrepare ? 'Marquer en préparation' : 'Remettre à Safari'}
              </button>
            )}
            {isDropshipping && (canConfirmSupplier || canDispatchSupplier) && (
              <button type="button" onClick={() => void updateSupplierStage(order.id, canConfirmSupplier ? 'confirmed' : 'dispatched')} disabled={busyOrder === order.id} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-sky-300/30 bg-sky-300/10 px-3 py-3 text-[9px] font-black uppercase tracking-wider text-sky-100 disabled:opacity-50">
                <AfriZiaIcon name={canConfirmSupplier ? 'contact' : 'send'} size={14} />
                {busyOrder === order.id ? 'Mise à jour...' : canConfirmSupplier ? 'Confirmer le fournisseur' : 'Confirmer l’expédition fournisseur'}
              </button>
            )}
          </article>
          );
        }) : (
          <div className="rounded-[1.3rem] border border-white/10 bg-white/[0.04] p-6 text-center">
            <p className="text-sm font-black">Aucune commande {isZandofyMode ? 'Zandofy' : 'Market'}{statusFilter !== 'all' ? ` ${statusFilter}` : ''}</p>
        <p className="mt-2 text-xs font-semibold text-white/45">Tes achats et ventes {isZandofyMode ? 'de produits Zandofy' : ''} apparaîtront ici.</p>
          </div>
        )}
      </section>
    </main>
  );
}
