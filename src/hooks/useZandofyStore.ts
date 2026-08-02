import { useEffect, useMemo, useState } from 'react';
import { get, onValue, push, ref, serverTimestamp, update } from 'firebase/database';
import { realtimeDb } from '../lib/firebase';
import { uploadMediaToCloudinary } from '../lib/cloudinary';
import { useFirebaseAuth } from './useFirebaseAuth';
import { getDefaultCountry } from '../lib/africaLocation';

export type ZandofyTheme = 'emerald' | 'midnight' | 'sunrise' | 'mono';

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
  ordersCount: number;
  revenue: number;
  currency: string;
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
};

export type ZandofyDigitalProductInput = {
  title: string;
  description: string;
  digitalType: string;
  collection: string;
  price: number;
  currency: string;
  coverFile?: File | null;
  deliveryMode: 'file' | 'link';
  deliveryFile?: File | null;
  deliveryFiles?: File[];
  deliveryURL?: string;
  accessNote: string;
  productSpec?: Record<string, unknown>;
};

export type ZandofyDigitalProduct = {
  id: string;
  storeId: string;
  storeSlug: string;
  storeName: string;
  authorId: string;
  title: string;
  description: string;
  category: string;
  digitalType: string;
  collection: string;
  price: number;
  villagePrice?: number;
  currency: string;
  coverURL: string;
  deliveryMode: 'file' | 'link';
  deliveryURL?: string;
  accessNote: string;
  productSpec?: Record<string, unknown>;
  status: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

const fallbackCountry = getDefaultCountry();

export const getZandofyStoreURL = (slug: string) => `${window.location.origin}/zandofy/${slug}`;

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
  ownerName: raw.ownerName || 'AfriSeller',
  name: raw.name || 'Boutique Zandofy',
  slug: raw.slug || id,
  tagline: raw.tagline || 'Produits digitaux prêts à vendre.',
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
  ordersCount: Number(raw.ordersCount || 0),
  revenue: Number(raw.revenue || 0),
  currency: raw.currency || 'USD',
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
    () => stores.find((store) => store.slug === slug) || null,
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
        .map(([id, product]) => ({
          id,
          storeId: product.storeId || activeStoreId,
          storeSlug: product.storeSlug || '',
          storeName: product.storeName || '',
          authorId: product.authorId || '',
          title: product.title || 'Produit digital',
          description: product.description || '',
          category: product.category || 'Zandofy',
          digitalType: product.digitalType || 'Pack digital',
          collection: product.collection || 'Nouveautés',
          price: Number(product.price || 0),
          villagePrice: Number(product.villagePrice || product.price || 0),
          currency: product.currency || 'USD',
          coverURL: product.coverURL || '/zandofy/woman-promoting-cloths-from-thrift-store.jpg',
          deliveryMode: product.deliveryMode || 'file',
          deliveryURL: product.deliveryURL || '',
          accessNote: product.accessNote || '',
          productSpec: product.productSpec || {},
          status: product.status || 'active',
          createdAt: product.createdAt,
          updatedAt: product.updatedAt
        }))
        .filter((product) => product.status !== 'deleted' && product.status !== 'hidden')
        .sort((first, second) => String(second.createdAt || '').localeCompare(String(first.createdAt || '')));
      setProducts(nextProducts);
    });

    return () => unsubscribe();
  }, [ownerStore?.id, publicStore?.id]);

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
      ownerName: profile?.displayName || user.displayName || 'AfriSeller',
      name: input.name.trim(),
      slug,
      tagline: input.tagline.trim() || 'Boutique digitale Zandofy.',
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
      ordersCount: 0,
      revenue: 0,
      currency: 'USD',
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

  const updateCustomDomain = async (domain: string) => {
    if (!user || !ownerStore) throw new Error('Boutique Zandofy introuvable.');
    const cleanDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!cleanDomain) throw new Error('Ajoute un domaine valide.');

    await update(ref(realtimeDb), {
      [`zandofyStores/${ownerStore.id}/customDomain`]: cleanDomain,
      [`zandofyStores/${ownerStore.id}/customDomainStatus`]: 'pending',
      [`zandofyStores/${ownerStore.id}/updatedAt`]: serverTimestamp()
    });
  };

  const createDigitalProduct = async (input: ZandofyDigitalProductInput) => {
    if (!user) throw new Error('Connecte-toi pour publier sur Zandofy.');
    if (!ownerStore) throw new Error('Crée d’abord ta boutique Zandofy.');
    if (!input.title.trim()) throw new Error('Ajoute le nom du produit digital.');
    if (!input.description.trim()) throw new Error('Ajoute une description.');
    if (!Number.isFinite(input.price) || input.price <= 0) throw new Error('Ajoute un prix valide.');
    if (!input.coverFile) throw new Error('Ajoute une couverture pour ce produit.');
    if (input.deliveryMode === 'link' && !input.deliveryURL?.trim()) throw new Error('Ajoute le lien de livraison.');
    if (input.digitalType !== 'Billet' && input.deliveryMode === 'file' && !input.deliveryFile && !input.deliveryFiles?.length) throw new Error('Ajoute le fichier digital.');

    const productRef = push(ref(realtimeDb, `zandofyProducts/${ownerStore.id}`));
    const productId = productRef.key;
    if (!productId) throw new Error('Publication Zandofy impossible.');

    const coverUpload = input.coverFile
      ? await uploadMediaToCloudinary(input.coverFile, user.uid)
      : null;
    const coverURL = coverUpload?.secureUrl || '/zandofy/woman-promoting-cloths-from-thrift-store.jpg';
    const now = Date.now();
    const deliveryFiles = (input.deliveryFiles?.length ? input.deliveryFiles : input.deliveryFile ? [input.deliveryFile] : [])
      .map((file) => ({
        name: file.name,
        size: file.size,
        type: file.type,
        localOnly: true
      }));

    const productPayload = {
      id: productId,
      storeId: ownerStore.id,
      storeSlug: ownerStore.slug,
      storeName: ownerStore.name,
      authorId: user.uid,
      authorName: ownerStore.name,
      authorAvatar: ownerStore.logoURL,
      title: input.title.trim(),
      description: input.description.trim(),
      category: 'Zandofy',
      digitalType: input.digitalType,
      collection: input.collection,
      price: input.price,
      villagePrice: input.price,
      currency: input.currency || 'USD',
      coverURL,
      deliveryMode: input.deliveryMode,
      deliveryURL: input.deliveryMode === 'link' ? input.deliveryURL?.trim() : '',
      deliveryFiles,
      deliveryFile: deliveryFiles[0] || null,
      accessNote: input.accessNote.trim(),
      productSpec: input.productSpec || {},
      target: 'market',
      offerModule: 'Zandofy',
      isSellable: true,
      isDigital: true,
      status: 'active',
      createdAt: now,
      updatedAt: serverTimestamp()
    };

    const marketPayload = {
      ...productPayload,
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
      [`marketProducts/${productId}`]: marketPayload,
      [`userProducts/${user.uid}/${productId}`]: {
        id: productId,
        createdAt: now,
        type: 'zandofy-digital',
        storeId: ownerStore.id
      },
      [`zandofyStores/${ownerStore.id}/productsCount`]: Number(ownerStore.productsCount || 0) + 1,
      [`zandofyStores/${ownerStore.id}/digitalProductsCount`]: Number(ownerStore.digitalProductsCount || 0) + 1,
      [`zandofyStores/${ownerStore.id}/updatedAt`]: serverTimestamp()
    });

    return productPayload;
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
    createDigitalProduct
  };
}
