export type WalletTransactionStatus = 'pending' | 'confirmed' | 'failed' | 'escrow_pending_delivery' | 'released';
export type WalletTransactionType = 'credit' | 'debit';

export type WalletTransaction = {
  id: string;
  walletId: string;
  type: WalletTransactionType;
  amount: number;
  currency: string;
  status: WalletTransactionStatus;
  module: 'market' | 'spay' | 'fpp' | 'safari' | string;
  orderId?: string;
  createdAt: number;
};

export type WalletAccount = {
  uid: string;
  balance: number;
  currency: string;
  accountNumber?: string;
  status: 'active' | 'restricted' | 'pending_kyc';
};
