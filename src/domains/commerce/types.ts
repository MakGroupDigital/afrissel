export type CommerceOrderStatus = 'draft' | 'paid' | 'preparing' | 'delivering' | 'completed' | 'cancelled';
export type VillageDealStatus = 'shared' | 'collecting' | 'unlocked' | 'expired';

export type CommerceOrder = {
  id: string;
  productId: string;
  sellerId: string;
  buyerId: string;
  totalAmount: number;
  currency: string;
  status: CommerceOrderStatus;
  villageStatus?: VillageDealStatus;
  chatThreadId?: string;
  createdAt: number;
};

export type VillageDeal = {
  productId: string;
  productName: string;
  sellerId: string;
  villagePrice: number;
  currency: string;
  buyersNeeded: number;
  buyersCount: number;
  status: VillageDealStatus;
};
