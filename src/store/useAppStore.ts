import { create } from 'zustand';

export type Product = {
  id: string;
  name: string;
  seller: string;
  description: string;
  price: number;
  villagePrice: number;
  currency?: string;
  imageUrl: string;
  buyersCount: number;
  buyersNeeded: number;
};

interface AppState {
  balance: number;
  cart: Product[];
  isCheckoutOpen: boolean;
  selectedProduct: Product | null;
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
  openCheckout: (product: Product) => void;
  closeCheckout: () => void;
  processPayment: () => boolean;
}

export const useAppStore = create<AppState>((set, get) => ({
  balance: 0,
  cart: [],
  isCheckoutOpen: false,
  selectedProduct: null,
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
  openCheckout: (product) => set({ isCheckoutOpen: true, selectedProduct: product }),
  closeCheckout: () => set({ isCheckoutOpen: false, selectedProduct: null }),
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
