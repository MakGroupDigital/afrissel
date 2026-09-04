import { useEffect, useMemo, useState } from 'react';
import { get, onValue, push, ref, runTransaction, serverTimestamp, update } from 'firebase/database';
import { realtimeDb } from '../lib/firebase';
import { uploadDigitalAssetToCloudinary, uploadMediaToCloudinary } from '../lib/cloudinary';
import { useFirebaseAuth } from './useFirebaseAuth';
import { getDefaultCountry } from '../lib/africaLocation';
import { apiRequest } from '../domains/shared/apiClient';
import { inferZandofyCatalogCategory } from '../domains/commerce/zandofyCatalog';

export type ZandofyTheme = 'emerald' | 'midnight' | 'sunrise' | 'mono';
export type ZandofyProductKind = 'digital' | 'physical';
export type ZandofyPricingMode = 'paid' | 'free';
export type ZandofyStockMode = 'unlimited' | 'tracked';
export type ZandofyDeliveryMode = 'file' | 'link' | 'shipping' | 'pickup';
export type ZandofyMarketplaceVisibility = 'zandofy' | 'afrizia' | 'both';
export type ZandofySupplierType = 'self' | 'supplier' | 'dropshipper';
export type ZandofyOrderProcessingMode = 'automatic' | 'manual';

export type ZandofyProductMedia = {
  id: string;
  mediaUrl?: string;
  secureUrl?: string;
  publicId?: string;
  resourceType?: string;
  provider?: string;
};

export type ZandofyStore = {
  id: string;
  ownerId: string;
  ownerName: string;
  name: string;
  slug: string;
  tagline: string;
  country: string;
  countryCode: string;
  city: string;
  logoURL: string;
  theme: ZandofyTheme;
  status: 'draft' | 'active' | 'paused';
  customDomain?: string;
  customDomainStatus?: 'none' | 'pending' | 'verified';
  qrPayload: string;
  productsCount: number;
  digitalProductsCount: number;
  physicalProductsCount: number;
  ordersCount: number;
  revenue: number;
  currency: string;
  orderProcessingMode: ZandofyOrderProcessingMode;
  rating: number;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type ZandofyStoreInput = {
  name: string;
  tagline: string;
  country: string;
  countryCode: string;
  city: string;
  logoFile?: File | null;
  logoURL?: string;
  theme: ZandofyTheme;
  orderProcessingMode?: ZandofyOrderProcessingMode;
};

export type ZandofyStoreUpdateInput = {
  name: string;
  tagline: string;
  theme: ZandofyTheme;
  logoFile?: File | null;
  orderProcessingMode?: ZandofyOrderProcessingMode;
};

export type ZandofyDomainResult = {
  domain: string;
  status: 'pending' | 'verified';
  ssl: 'pending' | 'active';
  routing: 'pending' | 'active';
  dnsRecords: Array<{ type: string; name: string; value: string }>;
  verification?: Array<{ type?: string; domain?: string; value?: string; token?: string }>;
  message: string;
};

export type ZandofyProductInput = {
  productKind: ZandofyProductKind;
  title: string;
  description: string;
  digitalType: string;
  collection: string;
  price: number;
  regularPrice?: number;
  salePrice?: number;
  pricingMode?: ZandofyPricingMode;
  currency: string;
  catalogCategory?: string;
  coverFile?: File | null;
  deliveryMode: ZandofyDeliveryMode;
  deliveryFile?: File | null;
  deliveryFiles?: File[];
  deliveryURL?: string;
  accessNote: string;
  stockMode?: ZandofyStockMode;
  stock?: number;
  sku?: string;
  weight?: number;
  shippingPrice?: number;
  shippingRegions?: string[];
  fppRate?: number;
  affiliateEnabled?: boolean;
  affiliateDirectRate?: number;
  affiliateIndirectRate?: number;
  sourceProductId?: string;
  sourceProductURL?: string;
  sourceMarketplace?: string;
  sourceSellerId?: string;
  sourceSellerName?: string;
  sourcePrice?: number;
  sourceMedia?: ZandofyProductMedia[];
  publishToAfriZia?: boolean;
  publishToZikMart?: boolean;
  supplierType?: ZandofySupplierType;
  supplierId?: string;
  supplierName?: string;
  supplierSKU?: string;
  supplierCost?: number;
  supplierLeadTimeDays?: number;
  dropshippingEnabled?: boolean;
  productSpec?: Record<string, unknown>;
};

// Kept as an alias so existing callers keep compiling while Zandofy supports
// physical and digital catalogue items through the same write path.
export type ZandofyDigitalProductInput = ZandofyProductInput;

export type ZandofyProductUpdateInput = {
  title: string;
  description: string;
  collection: string;
  catalogCategory: string;
  pricingMode: ZandofyPricingMode;
  regularPrice: number;
  salePrice?: number;
  currency: string;
  coverFile?: File | null;
  stockMode: ZandofyStockMode;
  stock?: number;
  sku?: string;
  shippingPrice?: number;
  shippingRegions?: string[];
  fppRate?: number;
  affiliateEnabled?: boolean;
  affiliateDirectRate?: number;
  affiliateIndirectRate?: number;
  sourceProductId?: string;
  sourceProductURL?: string;
  sourceMarketplace?: string;
  sourceSellerId?: string;
  sourceSellerName?: string;
  sourcePrice?: number;
  sourceMedia?: ZandofyProductMedia[];
  deliveryMode?: ZandofyDeliveryMode;
  publishToAfriZia: boolean;
  publishToZikMart: boolean;
  supplierType: ZandofySupplierType;
  supplierId: string;
  supplierName: string;
  supplierSKU: string;
  supplierCost: number;
  supplierLeadTimeDays: number;
  dropshippingEnabled: boolean;
};

export type ZandofyDigitalProduct = {
  id: string;
  storeId: string;
  storeSlug: string;
  storeName: string;
  authorId: string;
  productKind: ZandofyProductKind;
  isDigital?: boolean;
  title: string;
  description: string;
  category: string;
  catalogCategory: string;
  digitalType: string;
  collection: string;
  price: number;
  regularPrice: number;
  salePrice?: number;
  pricingMode: ZandofyPricingMode;
  isFree: boolean;
  villagePrice?: number;
  currency: string;
  coverURL: string;
  media?: ZandofyProductMedia[];
  deliveryMode: ZandofyDeliveryMode;
  deliveryURL?: string;
  accessNote: string;
  stockMode: ZandofyStockMode;
  stock?: number;
  sku: string;
  weight?: number;
  shippingPrice: number;
  shippingRegions: string[];
  fppRate: number;
  affiliateEnabled: boolean;
  affiliateDirectRate: number;
  affiliateIndirectRate: number;
  sourceProductId?: string;
  sourceProductURL?: string;
  sourceMarketplace?: string;
  sourceSellerId?: string;
  sourceSellerName?: string;
  sourcePrice?: number;
  sourceMedia?: ZandofyProductMedia[];
  orderProcessingMode: ZandofyOrderProcessingMode;
  marketplaceVisibility: ZandofyMarketplaceVisibility;
  publishToAfriZia: boolean;
  publishToZikMart: boolean;
  supplierType: ZandofySupplierType;
  supplierId: string;
  supplierName: string;
  supplierSKU: string;
  supplierCost: number;
  supplierLeadTimeDays: number;
  dropshippingEnabled: boolean;
  sellerMargin: number;
  productSpec?: Record<string, unknown>;
  status: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

const fallbackCountry = getDefaultCountry();

export const getZandofyStoreURL = (slug: string) => `${window.location.origin}/zandofy/${slug}`;

const getCurrentHost = () => (typeof window === 'undefined' ? '' : window.location.hostname.toLowerCase().replace(/^www\./, ''));

export const normalizeZandofySlug = (value: string) => {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 42);

  return normalized || `boutique-${Date.now().toString(36)}`;
};

const normalizeStore = (id: string, raw: Partial<ZandofyStore>): ZandofyStore => ({
  id,
  ownerId: raw.ownerId || '',
  ownerName: raw.ownerName || 'Vendeur Afrizia',
  name: raw.name || 'Boutique Zandofy',
  slug: raw.slug || id,
  tagline: raw.tagline || 'Produits physiques et digitaux prêts à vendre.',
  country: raw.country || fallbackCountry.name,
  countryCode: raw.countryCode || fallbackCountry.code,
  city: raw.city || fallbackCountry.fallbackCities[0],
  logoURL: raw.logoURL || '/zandofyiconeapp.png',
  theme: raw.theme || 'emerald',
  status: raw.status || 'active',
  customDomain: raw.customDomain || '',
  customDomainStatus: raw.customDomainStatus || 'none',
  qrPayload: raw.qrPayload || '',
  productsCount: Number(raw.productsCount || 0),
  digitalProductsCount: Number(raw.digitalProductsCount || 0),
  physicalProductsCount: Number(raw.physicalProductsCount || 0),
  ordersCount: Number(raw.ordersCount || 0),
  revenue: Number(raw.revenue || 0),
  currency: raw.currency || 'USD',
  orderProcessingMode: raw.orderProcessingMode || 'manual',
  rating: Number(raw.rating || 0),
  createdAt: raw.createdAt,
  updatedAt: raw.updatedAt
});

export function useZandofyStore(slug?: string) {
  const { user, profile, refreshProfile } = useFirebaseAuth();
  const [stores, setStores] = useState<ZandofyStore[]>([]);
  const [products, setProducts] = useState<ZandofyDigitalProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    const storesRef = ref(realtimeDb, 'zandofyStores');
    const unsubscribe = onValue(
      storesRef,
      (snapshot) => {
        const data = snapshot.val() as Record<string, Partial<ZandofyStore>> | null;
        const nextStores = Object.entries(data || {})
          .map(([id, store]) => normalizeStore(id, store))
          .filter((store) => store.status !== 'paused')
          .sort((first, second) => String(second.updatedAt || '').localeCompare(String(first.updatedAt || '')));
        setStores(nextStores);
        setLoading(false);
      },
      (storeError) => {
        console.error('Zandofy indisponible:', storeError);
        setError('Zandofy est indisponible pour le moment.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const ownerStore = useMemo(
    () => stores.find((store) => store.ownerId === user?.uid) || null,
    [stores, user?.uid]
  );

  const publicStore = useMemo(
    () => {
      const host = getCurrentHost();
      return stores.find((store) => store.slug === slug || (host && store.customDomain?.replace(/^www\./, '') === host)) || null;
    },
    [stores, slug]
  );

  useEffect(() => {
    const activeStoreId = ownerStore?.id || publicStore?.id;
    if (!activeStoreId) {
      setProducts([]);
      return;
    }

    const productsRef = ref(realtimeDb, `zandofyProducts/${activeStoreId}`);
    const unsubscribe = onValue(productsRef, (snapshot) => {
      const data = snapshot.val() as Record<string, Partial<ZandofyDigitalProduct>> | null;
      const nextProducts = Object.entries(data || {})
        .map(([id, product]) => {
          const productKind = product.productKind || (product.isDigital === false ? 'physical' : 'digital');
          const regularPrice = Number(product.regularPrice ?? product.price ?? 0);
          const pricingMode = product.pricingMode || (product.isFree || regularPrice === 0 ? 'free' : 'paid');
          const salePrice = product.salePrice !== undefined && product.salePrice !== null ? Number(product.salePrice) : undefined;
          const effectivePrice = pricingMode === 'free'
            ? 0
            : Number(product.price ?? salePrice ?? regularPrice ?? 0);
          const publishToAfriZia = product.publishToAfriZia !== false;
          const publishToZikMart = product.publishToZikMart === true && productKind === 'physical';
          const supplierCost = Number(product.supplierCost || 0);
          const sellerMargin = Math.max(0, effectivePrice - supplierCost);

          return {
          id,
          storeId: product.storeId || activeStoreId,
          storeSlug: product.storeSlug || '',
          storeName: product.storeName || '',
          authorId: product.authorId || '',
          productKind,
          title: product.title || 'Produit digital',
          description: product.description || '',
          category: product.category || 'Zandofy',
          catalogCategory: product.catalogCategory && product.catalogCategory !== 'Autres'
            ? product.catalogCategory
            : productKind === 'physical'
              ? inferZandofyCatalogCategory(product.title || '', product.description || '')
              : 'Digital',
          digitalType: product.digitalType || 'Pack digital',
          collection: product.collection || 'Nouveautés',
          price: effectivePrice,
          regularPrice,
          salePrice,
          pricingMode,
          isFree: pricingMode === 'free',
          villagePrice: Number(product.villagePrice ?? effectivePrice),
          currency: product.currency || 'USD',
          coverURL: product.coverURL || '/zandofy/woman-promoting-cloths-from-thrift-store.jpg',
          media: Array.isArray(product.media) ? product.media : (Array.isArray(product.sourceMedia) ? product.sourceMedia : []),
          deliveryMode: product.deliveryMode || (productKind === 'physical' ? 'shipping' : 'file'),
          deliveryURL: product.deliveryURL || '',
          accessNote: product.accessNote || '',
          stockMode: product.stockMode || (productKind === 'physical' ? 'tracked' : 'unlimited'),
          stock: product.stock !== undefined ? Number(product.stock) : undefined,
          sku: product.sku || '',
          weight: product.weight !== undefined ? Number(product.weight) : undefined,
          shippingPrice: Number(product.shippingPrice || 0),
          shippingRegions: Array.isArray(product.shippingRegions) ? product.shippingRegions : [],
          fppRate: Math.min(Math.max(Number(product.fppRate || 0), 0), 20),
          affiliateEnabled: product.affiliateEnabled === true,
          affiliateDirectRate: Math.min(Math.max(Number(product.affiliateDirectRate || 0), 0), 50),
          affiliateIndirectRate: Math.min(Math.max(Number(product.affiliateIndirectRate || 0), 0), 50),
          sourceProductId: product.sourceProductId || '',
          sourceProductURL: product.sourceProductURL || '',
          sourceMarketplace: product.sourceMarketplace || '',
          sourceSellerId: product.sourceSellerId || '',
          sourceSellerName: product.sourceSellerName || '',
          sourcePrice: product.sourcePrice !== undefined ? Number(product.sourcePrice) : undefined,
          sourceMedia: Array.isArray(product.sourceMedia) ? product.sourceMedia : [],
          orderProcessingMode: product.orderProcessingMode || ownerStore?.orderProcessingMode || publicStore?.orderProcessingMode || 'manual',
          marketplaceVisibility: product.marketplaceVisibility || (publishToAfriZia ? 'both' : 'zandofy'),
          publishToAfriZia,
          publishToZikMart,
          supplierType: product.supplierType || 'self',
          supplierId: product.supplierId || '',
          supplierName: product.supplierName || '',
          supplierSKU: product.supplierSKU || '',
          supplierCost,
          supplierLeadTimeDays: Number(product.supplierLeadTimeDays || 0),
          dropshippingEnabled: Boolean(product.dropshippingEnabled && productKind === 'physical'),
          sellerMargin,
          productSpec: product.productSpec || {},
          status: product.status || 'active',
          createdAt: product.createdAt,
          updatedAt: product.updatedAt
          };
        })
        .filter((product) => product.status !== 'deleted' && product.status !== 'hidden')
        .sort((first, second) => String(second.createdAt || '').localeCompare(String(first.createdAt || '')));
      setProducts(nextProducts);
    });

    return () => unsubscribe();
  }, [ownerStore?.id, ownerStore?.orderProcessingMode, publicStore?.id, publicStore?.orderProcessingMode]);

  const createStore = async (input: ZandofyStoreInput) => {
    if (!user) throw new Error('Connecte-toi pour créer ta boutique Zandofy.');

    const baseSlug = normalizeZandofySlug(input.name);
    let slug = baseSlug;
    let suffix = 2;
    while ((await get(ref(realtimeDb, `zandofySlugs/${slug}`))).exists()) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    const id = user.uid;
    const logoUpload = input.logoFile
      ? await uploadMediaToCloudinary(input.logoFile, user.uid)
      : null;
    const logoURL = logoUpload?.secureUrl || input.logoURL || profile?.logoURL || profile?.photoURL || '/zandofyiconeapp.png';
    const now = Date.now();
    const storeURL = getZandofyStoreURL(slug);

    const store: Omit<ZandofyStore, 'id'> = {
      ownerId: user.uid,
      ownerName: profile?.displayName || user.displayName || 'Vendeur Afrizia',
      name: input.name.trim(),
      slug,
      tagline: input.tagline.trim() || 'Boutique physique et digitale Zandofy.',
      country: input.country || fallbackCountry.name,
      countryCode: input.countryCode || fallbackCountry.code,
      city: input.city || fallbackCountry.fallbackCities[0],
      logoURL,
      theme: input.theme || 'emerald',
      status: 'active',
      customDomain: '',
      customDomainStatus: 'none',
      qrPayload: storeURL,
      productsCount: 0,
      digitalProductsCount: 0,
      physicalProductsCount: 0,
      ordersCount: 0,
      revenue: 0,
      currency: 'USD',
      orderProcessingMode: input.orderProcessingMode || 'manual',
      rating: 0,
      createdAt: now,
      updatedAt: serverTimestamp()
    };

    await update(ref(realtimeDb), {
      [`zandofyStores/${id}`]: store,
      [`zandofySlugs/${slug}`]: id,
      [`users/${user.uid}/zandofyStoreId`]: id,
      [`users/${user.uid}/zandofyStoreSlug`]: slug,
      [`users/${user.uid}/updatedAt`]: serverTimestamp()
    });

    await refreshProfile();
    return normalizeStore(id, store);
  };

  const updateCustomDomain = async (domain: string, action: 'connect' | 'verify' | 'status' = 'connect'): Promise<ZandofyDomainResult> => {
    if (!user || !ownerStore) throw new Error('Boutique Zandofy introuvable.');
    const idToken = await user.getIdToken();
    return apiRequest<ZandofyDomainResult>('/api/zandofy/domain', {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({
        action,
        domain: domain.trim()
      })
    });
  };

  const updateStoreProfile = async (input: ZandofyStoreUpdateInput) => {
    if (!user || !ownerStore) throw new Error('Boutique Zandofy introuvable.');
    if (!input.name.trim()) throw new Error('Ajoute le nom de la boutique.');
    if (!input.tagline.trim()) throw new Error('Ajoute une présentation courte.');

    const logoUpload = input.logoFile
      ? await uploadMediaToCloudinary(input.logoFile, user.uid)
      : null;
    await update(ref(realtimeDb), {
      [`zandofyStores/${ownerStore.id}/name`]: input.name.trim(),
      [`zandofyStores/${ownerStore.id}/tagline`]: input.tagline.trim(),
      [`zandofyStores/${ownerStore.id}/theme`]: input.theme,
      ...(input.orderProcessingMode ? { [`zandofyStores/${ownerStore.id}/orderProcessingMode`]: input.orderProcessingMode } : {}),
      ...(logoUpload?.secureUrl ? { [`zandofyStores/${ownerStore.id}/logoURL`]: logoUpload.secureUrl } : {}),
      [`zandofyStores/${ownerStore.id}/updatedAt`]: serverTimestamp()
    });
  };

  const createDigitalProduct = async (input: ZandofyDigitalProductInput) => {
    if (!user) throw new Error('Connecte-toi pour publier sur Zandofy.');
    if (!ownerStore) throw new Error('Crée d’abord ta boutique Zandofy.');
    if (!input.title.trim()) throw new Error('Ajoute le nom du produit.');
    if (!input.description.trim()) throw new Error('Ajoute une description.');
    if (!input.productKind) throw new Error('Choisis le type de produit.');
    if (!input.coverFile && !input.sourceMedia?.length) throw new Error('Ajoute une couverture pour ce produit.');

    const pricingMode = input.pricingMode || 'paid';
    const regularPrice = Number(input.regularPrice ?? input.price ?? 0);
    const salePrice = input.salePrice !== undefined ? Number(input.salePrice) : undefined;
    const effectivePrice = pricingMode === 'free' ? 0 : Number(input.price ?? salePrice ?? regularPrice);
    if (!Number.isFinite(regularPrice) || regularPrice < 0) throw new Error('Ajoute un prix normal valide.');
    if (pricingMode === 'paid' && effectivePrice <= 0) throw new Error('Ajoute un prix supérieur à zéro ou choisis Gratuit.');
    if (salePrice !== undefined && (!Number.isFinite(salePrice) || salePrice < 0 || salePrice > regularPrice)) {
      throw new Error('Le prix promotionnel doit être inférieur ou égal au prix normal.');
    }

    const stockMode = input.stockMode || (input.productKind === 'physical' ? 'tracked' : 'unlimited');
    const stock = input.stock !== undefined ? Number(input.stock) : undefined;
    if (stockMode === 'tracked' && (!Number.isFinite(stock) || Number(stock) < 0)) {
      throw new Error('Ajoute un stock valide.');
    }
    const fppRate = Math.min(Math.max(Number(input.fppRate || 0), 0), 20);
    const affiliateEnabled = Boolean(input.affiliateEnabled);
    const affiliateDirectRate = affiliateEnabled ? Math.min(Math.max(Number(input.affiliateDirectRate || 0), 0), 50) : 0;
    const affiliateIndirectRate = affiliateEnabled ? Math.min(Math.max(Number(input.affiliateIndirectRate || 0), 0), 50) : 0;
    const supplierType: ZandofySupplierType = input.productKind === 'physical' ? (input.supplierType || 'self') : 'self';
    const supplierCost = input.productKind === 'physical' ? Math.max(0, Number(input.supplierCost || 0)) : 0;
    if (!Number.isFinite(supplierCost)) throw new Error('Ajoute un coût fournisseur valide.');
    if (supplierCost > effectivePrice && input.productKind === 'physical') throw new Error('Le coût fournisseur ne peut pas dépasser le prix de vente.');
    const dropshippingEnabled = input.productKind === 'physical' && supplierType === 'dropshipper' && Boolean(input.dropshippingEnabled);
    const publishToZikMart = input.productKind === 'physical' && Boolean(input.publishToZikMart);
    const catalogCategory = input.productKind === 'physical'
      ? inferZandofyCatalogCategory(input.title, input.description, input.catalogCategory?.trim() || 'Autres')
      : input.catalogCategory?.trim() || 'Digital';

    if (input.productKind === 'digital') {
      if (input.deliveryMode === 'link' && !input.deliveryURL?.trim()) throw new Error('Ajoute le lien de livraison.');
      if (input.digitalType !== 'Billet' && input.deliveryMode === 'file' && !input.deliveryFile && !input.deliveryFiles?.length) throw new Error('Ajoute le fichier digital.');
    }
    if (input.productKind === 'physical' && !['shipping', 'pickup'].includes(input.deliveryMode)) {
      throw new Error('Choisis un mode de livraison physique.');
    }

    const productRef = push(ref(realtimeDb, `zandofyProducts/${ownerStore.id}`));
    const productId = productRef.key;
    if (!productId) throw new Error('Publication Zandofy impossible.');

    const coverUpload = input.coverFile
      ? await uploadMediaToCloudinary(input.coverFile, user.uid)
      : null;
    const sourceCoverURL = input.sourceMedia?.[0]?.secureUrl || input.sourceMedia?.[0]?.mediaUrl || '';
    const coverURL = coverUpload?.secureUrl || sourceCoverURL || '/zandofy/woman-promoting-cloths-from-thrift-store.jpg';
    const now = Date.now();
    const sourceDeliveryFiles = input.productKind === 'digital'
      ? (input.deliveryFiles?.length ? input.deliveryFiles : input.deliveryFile ? [input.deliveryFile] : [])
      : [];
    const deliveryAssets = await Promise.all(sourceDeliveryFiles.map(async (file) => {
      const upload = await uploadDigitalAssetToCloudinary(file, user.uid);
      return {
        name: file.name,
        type: file.type || upload.format || 'application/octet-stream',
        size: file.size,
        provider: upload.provider,
        secureUrl: upload.secureUrl,
        publicId: upload.publicId,
        resourceType: upload.resourceType,
        format: upload.format || ''
      };
    }));
    const deliveryFiles = sourceDeliveryFiles
      .map((file) => ({
        name: file.name,
        size: file.size,
        type: file.type,
        storage: 'cloudinary'
      }));

    const publishToAfriZia = Boolean(input.publishToAfriZia);
    const productMedia = input.sourceMedia?.length
      ? input.sourceMedia.map((media, index) => ({
          id: media.id || `${productId}_source_${index}`,
          provider: media.provider || 'cloudinary',
          mediaUrl: media.mediaUrl || media.secureUrl || '',
          secureUrl: media.secureUrl || media.mediaUrl || '',
          publicId: media.publicId || '',
          resourceType: media.resourceType || 'image'
        })).filter((media) => media.secureUrl)
      : [{
          id: `${productId}_cover`,
          provider: 'cloudinary',
          mediaUrl: coverURL,
          secureUrl: coverURL,
          publicId: coverUpload?.publicId || '',
          resourceType: 'image'
        }];
    const productPayload = {
      id: productId,
      storeId: ownerStore.id,
      storeSlug: ownerStore.slug,
      storeName: ownerStore.name,
      authorId: user.uid,
      authorName: ownerStore.name,
      authorAvatar: ownerStore.logoURL,
      productKind: input.productKind,
      title: input.title.trim(),
      description: input.description.trim(),
      category: 'Zandofy',
      catalogCategory,
      digitalType: input.productKind === 'digital' ? input.digitalType : '',
      collection: input.collection,
      price: effectivePrice,
      regularPrice,
      salePrice: pricingMode === 'paid' && salePrice !== undefined ? salePrice : null,
      pricingMode,
      isFree: pricingMode === 'free',
      villagePrice: effectivePrice,
      currency: input.currency || 'USD',
      coverURL,
      media: productMedia,
      deliveryMode: input.deliveryMode,
      // Delivery URLs and asset references stay in the protected manifest below.
      deliveryURL: '',
      deliveryFiles: [],
      deliveryFile: null,
      deliveryAssetCount: deliveryAssets.length,
      accessNote: input.accessNote.trim(),
      stockMode,
      stock: stockMode === 'tracked' ? Number(stock) : null,
      sku: input.sku?.trim() || '',
      weight: input.weight !== undefined ? Number(input.weight) : null,
      shippingPrice: Number(input.shippingPrice || 0),
      shippingRegions: input.shippingRegions || [],
      fppRate,
      affiliateEnabled,
      affiliateDirectRate,
      affiliateIndirectRate,
      sourceProductId: input.sourceProductId || '',
      sourceProductURL: input.sourceProductURL || '',
      sourceMarketplace: input.sourceMarketplace || '',
      sourceSellerId: input.sourceSellerId || '',
      sourceSellerName: input.sourceSellerName || '',
      sourcePrice: input.sourcePrice !== undefined ? Number(input.sourcePrice) : null,
      sourceMedia: input.sourceMedia || [],
      orderProcessingMode: ownerStore.orderProcessingMode || 'manual',
      marketplaceVisibility: publishToAfriZia ? 'both' : 'zandofy',
      publishToAfriZia,
      publishToZikMart,
      supplierType,
      supplierId: input.supplierId?.trim() || '',
      supplierName: input.supplierName?.trim() || '',
      supplierSKU: input.supplierSKU?.trim() || '',
      supplierCost,
      supplierLeadTimeDays: Math.max(0, Number(input.supplierLeadTimeDays || 0)),
      dropshippingEnabled,
      sellerMargin: Math.max(0, effectivePrice - supplierCost),
      productSpec: input.productSpec || {},
      target: 'market',
      offerModule: 'Zandofy',
      isSellable: true,
      isDigital: input.productKind === 'digital',
      status: 'active',
      createdAt: now,
      updatedAt: serverTimestamp()
    };

    const {
      supplierCost: _supplierCost,
      sellerMargin: _sellerMargin,
      supplierId: _supplierId,
      supplierSKU: _supplierSKU,
      ...publicProductPayload
    } = productPayload;
    const marketPayload = {
      ...publicProductPayload,
      deliveryURL: '',
      deliveryFiles: [],
      deliveryFile: null,
      format: 'article',
      media: [{
        id: `${productId}_cover`,
        provider: 'cloudinary',
        mediaUrl: coverURL,
        secureUrl: coverURL,
        publicId: coverUpload?.publicId || '',
        resourceType: 'image'
      }],
      buyersCount: 0,
      buyersNeeded: 1,
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      followsCount: 0
    };

    await update(ref(realtimeDb), {
      [`zandofyProducts/${ownerStore.id}/${productId}`]: productPayload,
      ...(input.productKind === 'digital'
        ? {
            [`digitalDeliveryAssets/${productId}`]: {
              productId,
              storeId: ownerStore.id,
              deliveryMode: input.deliveryMode,
              deliveryURL: input.deliveryMode === 'link' ? input.deliveryURL?.trim() || '' : '',
              accessNote: input.accessNote.trim(),
              assets: deliveryAssets,
              createdAt: now,
              updatedAt: now
            }
          }
        : {}),
      ...(publishToAfriZia ? { [`marketProducts/${productId}`]: marketPayload } : {}),
      [`zikMartProducts/${productId}`]: publishToZikMart ? marketPayload : null,
      [`userProducts/${user.uid}/${productId}`]: {
        id: productId,
        createdAt: now,
        type: 'zandofy-digital',
        storeId: ownerStore.id
      },
      [`zandofyStores/${ownerStore.id}/productsCount`]: Number(ownerStore.productsCount || 0) + 1,
      [`zandofyStores/${ownerStore.id}/digitalProductsCount`]: Number(ownerStore.digitalProductsCount || 0) + (input.productKind === 'digital' ? 1 : 0),
      [`zandofyStores/${ownerStore.id}/physicalProductsCount`]: Number(ownerStore.physicalProductsCount || 0) + (input.productKind === 'physical' ? 1 : 0),
      [`zandofyStores/${ownerStore.id}/updatedAt`]: serverTimestamp()
    });

    return productPayload;
  };

  const updateProduct = async (productId: string, input: ZandofyProductUpdateInput) => {
    if (!user) throw new Error('Connecte-toi pour modifier ce produit.');
    if (!ownerStore) throw new Error('Crée d’abord ta boutique Zandofy.');
    if (!input.title.trim()) throw new Error('Ajoute le nom du produit.');
    if (!input.description.trim()) throw new Error('Ajoute une description.');

    const productSnapshot = await get(ref(realtimeDb, `zandofyProducts/${ownerStore.id}/${productId}`));
    if (!productSnapshot.exists()) throw new Error('Produit introuvable.');
    const existing = productSnapshot.val() as Record<string, unknown>;
    if (existing.authorId && existing.authorId !== user.uid) throw new Error('Tu ne peux pas modifier ce produit.');

    const productKind = existing.productKind === 'physical' ? 'physical' : 'digital';
    const pricingMode = input.pricingMode || 'paid';
    const regularPrice = Number(input.regularPrice || 0);
    const salePrice = input.salePrice !== undefined && input.salePrice !== null ? Number(input.salePrice) : undefined;
    if (!Number.isFinite(regularPrice) || regularPrice < 0) throw new Error('Ajoute un prix normal valide.');
    if (pricingMode === 'paid' && regularPrice <= 0) throw new Error('Ajoute un prix supérieur à zéro ou choisis Gratuit.');
    if (salePrice !== undefined && (!Number.isFinite(salePrice) || salePrice < 0 || salePrice > regularPrice)) {
      throw new Error('Le prix promotionnel doit être inférieur ou égal au prix normal.');
    }

    const stockMode = input.stockMode || (productKind === 'physical' ? 'tracked' : 'unlimited');
    const stock = input.stock !== undefined ? Number(input.stock) : undefined;
    if (stockMode === 'tracked' && (!Number.isFinite(stock) || Number(stock) < 0)) {
      throw new Error('Ajoute un stock valide.');
    }
    const fppRate = Math.min(Math.max(Number(input.fppRate || 0), 0), 20);
    const affiliateEnabled = input.affiliateEnabled ?? existing.affiliateEnabled === true;
    const affiliateDirectRate = affiliateEnabled
      ? Math.min(Math.max(Number(input.affiliateDirectRate ?? existing.affiliateDirectRate ?? 0), 0), 50)
      : 0;
    const affiliateIndirectRate = affiliateEnabled
      ? Math.min(Math.max(Number(input.affiliateIndirectRate ?? existing.affiliateIndirectRate ?? 0), 0), 50)
      : 0;
    const effectivePrice = pricingMode === 'free' ? 0 : Number(salePrice ?? regularPrice);
    const supplierType: ZandofySupplierType = productKind === 'physical' ? (input.supplierType || 'self') : 'self';
    const supplierCost = productKind === 'physical' ? Math.max(0, Number(input.supplierCost || 0)) : 0;
    if (!Number.isFinite(supplierCost)) throw new Error('Ajoute un coût fournisseur valide.');
    if (supplierCost > effectivePrice && productKind === 'physical') throw new Error('Le coût fournisseur ne peut pas dépasser le prix de vente.');
    const dropshippingEnabled = productKind === 'physical' && supplierType === 'dropshipper' && Boolean(input.dropshippingEnabled);
    const publishToZikMart = productKind === 'physical' && Boolean(input.publishToZikMart);
    const catalogCategory = productKind === 'physical'
      ? inferZandofyCatalogCategory(input.title, input.description, input.catalogCategory.trim() || 'Autres')
      : input.catalogCategory.trim() || 'Digital';

    const coverUpload = input.coverFile
      ? await uploadMediaToCloudinary(input.coverFile, user.uid)
      : null;
    const coverURL = coverUpload?.secureUrl || String(existing.coverURL || '/zandofy/woman-promoting-cloths-from-thrift-store.jpg');
    const publishToAfriZia = Boolean(input.publishToAfriZia);
    const now = Date.now();
    const productPayload = {
      ...existing,
      id: productId,
      productKind,
      isDigital: productKind === 'digital',
      title: input.title.trim(),
      description: input.description.trim(),
      collection: input.collection.trim() || 'Nouveautés',
      catalogCategory,
      price: effectivePrice,
      regularPrice,
      salePrice: pricingMode === 'paid' && salePrice !== undefined ? salePrice : null,
      pricingMode,
      isFree: pricingMode === 'free',
      currency: input.currency || String(existing.currency || 'USD'),
      coverURL,
      stockMode,
      stock: stockMode === 'tracked' ? Number(stock) : null,
      sku: input.sku?.trim() || '',
      shippingPrice: Number(input.shippingPrice || 0),
      shippingRegions: input.shippingRegions || [],
      fppRate,
      affiliateEnabled,
      affiliateDirectRate,
      affiliateIndirectRate,
      deliveryMode: input.deliveryMode || existing.deliveryMode || (productKind === 'physical' ? 'shipping' : 'file'),
      marketplaceVisibility: publishToAfriZia ? 'both' : 'zandofy',
      publishToAfriZia,
      publishToZikMart,
      supplierType,
      supplierId: input.supplierId.trim(),
      supplierName: input.supplierName.trim(),
      supplierSKU: input.supplierSKU.trim(),
      supplierCost,
      supplierLeadTimeDays: Math.max(0, Number(input.supplierLeadTimeDays || 0)),
      dropshippingEnabled,
      sellerMargin: Math.max(0, effectivePrice - supplierCost),
      updatedAt: serverTimestamp()
    };

    const {
      supplierCost: _supplierCost,
      sellerMargin: _sellerMargin,
      supplierId: _supplierId,
      supplierSKU: _supplierSKU,
      ...publicProductPayload
    } = productPayload;
    const marketPayload = {
      ...publicProductPayload,
      deliveryURL: '',
      deliveryFiles: [],
      deliveryFile: null,
      format: 'article',
      media: [{
        id: `${productId}_cover`,
        provider: 'cloudinary',
        mediaUrl: coverURL,
        secureUrl: coverURL,
        publicId: coverUpload?.publicId || '',
        resourceType: 'image'
      }]
    };

    await update(ref(realtimeDb), {
      [`zandofyProducts/${ownerStore.id}/${productId}`]: productPayload,
      [`marketProducts/${productId}`]: publishToAfriZia ? marketPayload : null,
      [`zikMartProducts/${productId}`]: publishToZikMart ? marketPayload : null,
      [`zandofyStores/${ownerStore.id}/updatedAt`]: serverTimestamp()
    });

    return productPayload;
  };

  const setProductStock = async (productId: string, nextStock: number) => {
    if (!user) throw new Error('Connecte-toi pour gérer le stock.');
    if (!ownerStore) throw new Error('Crée d’abord ta boutique Zandofy.');
    if (!Number.isFinite(nextStock) || nextStock < 0) throw new Error('Le stock doit être un nombre positif.');

    const product = products.find((item) => item.id === productId);
    if (!product) throw new Error('Produit introuvable.');
    if (product.productKind !== 'physical') throw new Error('Le stock manuel concerne les produits physiques.');
    if (product.stockMode !== 'tracked') throw new Error('Active le suivi du stock pour ce produit.');

    const stockRef = ref(realtimeDb, `zandofyProducts/${ownerStore.id}/${productId}/stock`);
    const result = await runTransaction(stockRef, () => Math.floor(nextStock));
    if (!result.committed) throw new Error('Mise à jour du stock impossible.');

    if (product.publishToAfriZia) {
      await update(ref(realtimeDb), {
        [`marketProducts/${productId}/stock`]: Math.floor(nextStock),
        [`marketProducts/${productId}/updatedAt`]: serverTimestamp(),
        [`zandofyStores/${ownerStore.id}/updatedAt`]: serverTimestamp()
      });
    }
  };

  return {
    stores,
    ownerStore,
    publicStore,
    products,
    loading,
    error,
    createStore,
    updateCustomDomain,
    updateStoreProfile,
    createDigitalProduct,
    updateProduct,
    setProductStock
  };
}
