import { create } from 'zustand';

export type Product = {
  id: string;
  sellerId?: string;
  name: string;
  seller: string;
  description: string;
  category?: string;
  price: number;
  villagePrice: number;
  currency?: string;
  imageUrl: string;
  buyersCount: number;
  buyersNeeded: number;
};

export type CheckoutDelivery = {
  id: string;
  title: string;
  description: string;
  price: number;
  eta: string;
};

interface AppState {
  balance: number;
  cart: Product[];
  isCheckoutOpen: boolean;
  selectedProduct: Product | null;
  selectedDelivery: CheckoutDelivery | null;
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
  openCheckout: (product: Product, delivery?: CheckoutDelivery) => void;
  closeCheckout: () => void;
  processPayment: () => boolean;
}

export const useAppStore = create<AppState>((set, get) => ({
  balance: 0,
  cart: [],
  isCheckoutOpen: false,
  selectedProduct: null,
  selectedDelivery: null,
  addToCart: (product) => set((state) => {
    if (state.cart.some((item) => item.id === product.id)) {
      return state;
    }

    return {
      cart: [product, ...state.cart]
    };
  }),
  removeFromCart: (productId) => set((state) => ({
    cart: state.cart.filter((item) => item.id !== productId)
  })),
  openCheckout: (product, delivery) => set({ isCheckoutOpen: true, selectedProduct: product, selectedDelivery: delivery || null }),
  closeCheckout: () => set({ isCheckoutOpen: false, selectedProduct: null, selectedDelivery: null }),
  processPayment: () => {
    const { balance, selectedProduct } = get();
    if (!selectedProduct) return false;
    if (balance >= selectedProduct.villagePrice) {
      set((state) => ({
        balance: state.balance - selectedProduct.villagePrice,
        isCheckoutOpen: false,
        selectedProduct: null,
      }));
      return true;
    }
    return false;
  },
}));
