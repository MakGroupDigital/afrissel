import { useEffect } from 'react';
import { get, onValue, ref } from 'firebase/database';
import { reconcileMobileMoneyCommerceOrder } from '../domains/commerce';
import { realtimeDb } from '../lib/firebase';
import { useFirebaseAuth } from './useFirebaseAuth';

type PendingCommerceOrder = {
  paymentMode?: string;
  paymentStatus?: string;
  mobileMoney?: {
    refTransa?: string;
    checkedAt?: number;
  };
};

const reconcilingOrders = new Set<string>();

const shouldReconcile = (order: PendingCommerceOrder) => {
  if (order.paymentMode !== 'mobile_money' || order.paymentStatus !== 'pending_operator') return false;
  if (!order.mobileMoney?.refTransa) return false;
  const checkedAt = Number(order.mobileMoney.checkedAt || 0);
  return !checkedAt || Date.now() - checkedAt > 15000;
};

export function useCommercePaymentReconciliation() {
  const { user } = useFirebaseAuth();

  useEffect(() => {
    if (!user) return undefined;

    const purchasesRef = ref(realtimeDb, `userOrders/${user.uid}`);
    let orderIds: string[] = [];
    const inspectOrders = () => {
      orderIds.forEach((orderId) => {
        const reconciliationKey = `${user.uid}:${orderId}`;
        if (reconcilingOrders.has(reconciliationKey)) return;

        void get(ref(realtimeDb, `orders/${orderId}`))
          .then((orderSnapshot) => orderSnapshot.val() as PendingCommerceOrder | null)
          .then((order) => {
            if (!order || !shouldReconcile(order)) return;
            reconcilingOrders.add(reconciliationKey);
            return reconcileMobileMoneyCommerceOrder(user.uid, orderId)
              .catch((error) => {
                console.warn('Confirmation Mobile Money de la commande impossible:', error);
              })
              .finally(() => {
                window.setTimeout(() => reconcilingOrders.delete(reconciliationKey), 15000);
              });
          })
          .catch((error) => {
            console.warn('Lecture de commande Mobile Money impossible:', error);
          });
      });
    };

    const unsubscribe = onValue(purchasesRef, (snapshot) => {
      const purchases = snapshot.val() as Record<string, true> | null;
      orderIds = Object.keys(purchases || {}).slice(-20);
      inspectOrders();
    });
    const intervalId = window.setInterval(inspectOrders, 15000);

    return () => {
      unsubscribe();
      window.clearInterval(intervalId);
    };
  }, [user]);
}
