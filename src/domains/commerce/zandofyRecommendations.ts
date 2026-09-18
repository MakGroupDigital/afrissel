import type { ZandofyDigitalProduct } from '../../hooks/useZandofyStore';

const interestStorageKey = 'afrisell:zandofy-interests';

type RecommendationContext = {
  collection?: string;
  query?: string;
  excludeId?: string;
};

type StoredInterest = {
  collection?: string;
  category?: string;
  viewedAt: number;
};

const readInterests = (): StoredInterest[] => {
  if (typeof window === 'undefined') return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(interestStorageKey) || '[]');
    return Array.isArray(value) ? value.slice(0, 20) : [];
  } catch {
    return [];
  }
};

export const rememberZandofyInterest = (product: Pick<ZandofyDigitalProduct, 'collection' | 'catalogCategory'> & { id: string }) => {
  if (typeof window === 'undefined') return;
  const interests = [
    { collection: product.collection, category: product.catalogCategory, viewedAt: Date.now() },
    ...readInterests()
  ].slice(0, 20);
  window.localStorage.setItem(interestStorageKey, JSON.stringify(interests));
};

export const getZandofyRecommendations = (products: ZandofyDigitalProduct[], context: RecommendationContext = {}) => {
  const recentInterest = readInterests()[0];
  const query = context.query?.trim().toLowerCase() || '';

  return products
    .filter((product) => product.id !== context.excludeId)
    .map((product) => {
      const searchable = `${product.title} ${product.description} ${product.catalogCategory} ${product.digitalType}`.toLowerCase();
      let score = 0;
      if (product.status === 'active') score += 2;
      if (product.productKind === 'digital' || product.stockMode === 'unlimited' || Number(product.stock || 0) > 0) score += 2;
      if (context.collection && context.collection !== 'Tout' && product.collection === context.collection) score += 5;
      if (recentInterest?.collection && product.collection === recentInterest.collection) score += 4;
      if (recentInterest?.category && product.catalogCategory === recentInterest.category) score += 3;
      if (query && searchable.includes(query)) score += 8;
      if (product.salePrice !== undefined || product.isFree) score += 1;
      return { product, score };
    })
    .sort((first, second) => second.score - first.score || String(second.product.updatedAt || '').localeCompare(String(first.product.updatedAt || '')))
    .map(({ product }) => product);
};
