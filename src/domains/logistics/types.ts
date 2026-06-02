export type DeliveryStatus = 'pending_assignment' | 'pickup_requested' | 'assigned' | 'in_transit' | 'delivered' | 'cancelled';

export type SafariDeliveryContract = {
  orderId: string;
  buyerId: string;
  sellerId: string;
  productId: string;
  productName: string;
  status: DeliveryStatus;
  eta: string;
  price: number;
  currency: string;
  createdAt: number;
  updatedAt: number;
};
