import { create } from 'zustand';

export type Product = {
  id: string;
  name: string;
  seller: string;
  description: string;
  price: number;
  villagePrice: number;
  imageUrl: string;
  buyersCount: number;
  buyersNeeded: number;
};

interface AppState {
  balance: number;
  cart: Product[];
  isCheckoutOpen: boolean;
  selectedProduct: Product | null;
  openCheckout: (product: Product) => void;
  closeCheckout: () => void;
  processPayment: () => boolean;
}

export const useAppStore = create<AppState>((set, get) => ({
  balance: 15420.50, // Default balance
  cart: [],
  isCheckoutOpen: false,
  selectedProduct: null,
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
