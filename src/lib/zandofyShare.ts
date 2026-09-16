import { isTauriNative } from './nativePlatform';

type ShareableZandofyProduct = {
  id: string;
  storeId?: string;
  storeSlug?: string;
};

const DEFAULT_PUBLIC_APP_URL = 'https://afri.afrisell.app';

export const getAfriZiaPublicOrigin = () => {
  const configuredOrigin = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.trim().replace(/\/$/, '');
  if (configuredOrigin) return configuredOrigin;
  if (isTauriNative()) return DEFAULT_PUBLIC_APP_URL;
  return window.location.origin;
};

export const getZandofyProductSharePath = (product: ShareableZandofyProduct) => {
  if (!product.storeId) {
    return product.storeSlug
      ? `/zandofy/${encodeURIComponent(product.storeSlug)}/product/${encodeURIComponent(product.id)}`
      : `/zandofy/product/${encodeURIComponent(product.id)}`;
  }

  return `/share/zandofy/${encodeURIComponent(product.storeId)}/${encodeURIComponent(product.id)}`;
};

export const getZandofyProductShareURL = (product: ShareableZandofyProduct) => (
  `${getAfriZiaPublicOrigin()}${getZandofyProductSharePath(product)}`
);
