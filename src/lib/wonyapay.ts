import { apiRequest } from '../domains/shared/apiClient';
import { isTauriNative } from './nativePlatform';

export type WonyaPayAction = 'C2B' | 'B2C';
export type WonyaPayCurrency = 'CDF' | 'USD';

export type WonyaPayPaymentResponse = {
  success: boolean;
  refTransa: string;
  refPartenaire?: string;
  action: WonyaPayAction;
  amount: number;
  currency: WonyaPayCurrency;
  phoneNumber: string;
  providerStatus: string;
  completed: boolean;
  failed: boolean;
  rawResponse?: unknown;
};

export type WonyaPayStatusResponse = {
  success: boolean;
  refTransa: string;
  providerStatus: string;
  completed: boolean;
  failed: boolean;
  rawResponse?: unknown;
};

const DEFAULT_NATIVE_API_BASE_URL = 'https://afri.afrisell.app';

const getWonyaPayEndpoint = (path: '/api/wonyapay/payment' | '/api/wonyapay/status') => {
  if (!isTauriNative()) return path;

  const baseUrl = (
    (import.meta.env.VITE_WONYAPAY_API_BASE_URL as string | undefined) ||
    (import.meta.env.VITE_AFRISELL_PAYMENT_API_URL as string | undefined) ||
    (import.meta.env.VITE_AFRISELL_API_BASE_URL as string | undefined) ||
    DEFAULT_NATIVE_API_BASE_URL
  ).trim().replace(/\/$/, '');

  return `${baseUrl}${path}`;
};

export const initiateWonyaPayPayment = (input: {
  action: WonyaPayAction;
  amount: number;
  currency: string;
  phoneNumber: string;
  motif?: string;
  refPrefix?: string;
}) => apiRequest<WonyaPayPaymentResponse>(getWonyaPayEndpoint('/api/wonyapay/payment'), {
  service: 'payment',
  method: 'POST',
  body: JSON.stringify(input)
});

export const getWonyaPayStatus = (refTransa: string) => apiRequest<WonyaPayStatusResponse>(getWonyaPayEndpoint('/api/wonyapay/status'), {
  service: 'payment',
  method: 'POST',
  body: JSON.stringify({ refTransa })
});
