import { useEffect, useMemo, useState } from 'react';
import { off, onValue, push, ref, runTransaction, serverTimestamp, update } from 'firebase/database';
import { Product } from '../store/useAppStore';
import { CloudinaryUploadResult, uploadMediaToCloudinary } from '../lib/cloudinary';
import { realtimeDb } from '../lib/firebase';
import { useFirebaseAuth } from './useFirebaseAuth';

export type AfriMarketMedia = CloudinaryUploadResult & {
  id: string;
};

export type AfriMarketContent = {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  title: string;
  description: string;
  category: string;
  format: 'article' | 'video' | 'gallery';
  media: AfriMarketMedia[];
  coverURL: string;
  isSellable: boolean;
  price?: number;
  villagePrice?: number;
  currency?: string;
  buyersCount?: number;
  buyersNeeded?: number;
  likesCount?: number;
  commentsCount?: number;
  sharesCount?: number;
  followsCount?: number;
  createdAt?: number | string | { seconds?: number };
  updatedAt?: number | string | { seconds?: number };
  status?: 'active' | 'hidden' | 'deleted' | string;
};

export type AfriMarketComment = {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  text: string;
  createdAt?: number | string | { seconds?: number };
};

export type AfriMarketPostInput = {
  title: string;
  description: string;
  category: string;
  files: File[];
  isSellable: boolean;
  price?: number;
  villagePrice?: number;
  buyersNeeded?: number;
  currency?: string;
};

type RawContent = Omit<AfriMarketContent, 'id'> & {
  imageUrl?: string;
  name?: string;
  seller?: string;
};

type RawComment = Omit<AfriMarketComment, 'id'>;

export const MARKET_CATEGORIES = [
  'Tout',
  'Mode',
  'Beaute',
  'Life style',
  'Agro',
  'Alimentaire',
  'Boissons',
  'Tech',
  'Telephones',
  'Informatique',
  'Electronique',
  'Maison',
  'Meubles',
  'Decoration',
  'Immobilier',
  'Auto',
  'Moto',
  'Pieces auto',
  'Services',
  'Livraison',
  'Reparations',
  'Formation',
  'Emploi',
  'Sante',
  'Bien-etre',
  'Sport',
  'Fitness',
  'Culture',
  'Musique',
  'Evenements',
  'Voyage',
  'Hotellerie',
  'Restauration',
  'Enfants',
  'Bebe',
  'Fournitures',
  'Bureau',
  'BTP',
  'Materiaux',
  'Energie',
  'Agriculture',
  'Elevage',
  'Artisanat',
  'Occasion',
  'Luxe',
  'Autres'
];

const getTimestamp = (value?: AfriMarketContent['createdAt']) => {
  if (!value) return 0;
  if (typeof value === 'object') return (value.seconds || 0) * 1000;
  const timestamp = Number(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const toNumber = (value: unknown, fallback = 0) => {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
};

const stripUndefined = <T,>(value: T): T => {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as T;
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([key, entryValue]) => [key, stripUndefined(entryValue)])
    ) as T;
  }

  return value;
};

const normalizeMedia = (content: RawContent): AfriMarketMedia[] => {
  if (Array.isArray(content.media) && content.media.length) {
    return content.media.map((media, index) => ({
      ...media,
      id: media.id || `${media.publicId || 'media'}_${index}`,
      provider: media.provider || 'cloudinary',
      mediaUrl: media.mediaUrl || media.secureUrl,
      secureUrl: media.secureUrl || media.mediaUrl,
      resourceType: media.resourceType || 'image'
    }));
  }

  if (content.imageUrl) {
    return [{
      id: 'legacy_cover',
      provider: 'cloudinary',
      mediaUrl: content.imageUrl,
      secureUrl: content.imageUrl,
      publicId: '',
      resourceType: 'image'
    }];
  }

  return [];
};

const normalizeContent = (id: string, content: RawContent): AfriMarketContent => {
  const media = normalizeMedia(content);
  const isSellable = Boolean(content.isSellable || content.format === 'article' || content.villagePrice);

  return {
    id,
    authorId: content.authorId || '',
    authorName: content.authorName || content.seller || 'AfriSeller',
    authorAvatar: content.authorAvatar || '',
    title: content.title || content.name || 'Publication AfriSell',
    description: content.description || '',
    category: content.category || 'Services',
    format: content.format || (isSellable ? 'article' : media.some((item) => item.resourceType === 'video') ? 'video' : 'gallery'),
    media,
    coverURL: content.coverURL || media[0]?.secureUrl || media[0]?.mediaUrl || content.imageUrl || '',
    isSellable,
    price: content.price !== undefined ? toNumber(content.price) : undefined,
    villagePrice: content.villagePrice !== undefined ? toNumber(content.villagePrice) : undefined,
    currency: content.currency || 'USD',
    buyersCount: toNumber(content.buyersCount),
    buyersNeeded: toNumber(content.buyersNeeded, 1),
    likesCount: toNumber(content.likesCount),
    commentsCount: toNumber(content.commentsCount),
    sharesCount: toNumber(content.sharesCount),
    followsCount: toNumber(content.followsCount),
    createdAt: content.createdAt,
    updatedAt: content.updatedAt,
    status: content.status || 'active'
  };
};

const normalizeComment = (id: string, comment: RawComment): AfriMarketComment => ({
  id,
  postId: comment.postId || '',
  authorId: comment.authorId || '',
  authorName: comment.authorName || 'Utilisateur AfriSell',
  authorAvatar: comment.authorAvatar || '',
  text: comment.text || '',
  createdAt: comment.createdAt
});

export const formatMarketPrice = (value?: number, currency = 'USD') => {
  if (!Number.isFinite(Number(value))) return '';
  const amount = Number(value);

  if (currency === 'USD') return `$${amount.toLocaleString('fr-FR')}`;
  if (currency === 'CDF') return `${amount.toLocaleString('fr-FR')} CDF`;

  return `${amount.toLocaleString('fr-FR')} ${currency}`;
};

export const formatMarketTime = (value?: AfriMarketContent['createdAt']) => {
  const timestamp = getTimestamp(value);
  if (!timestamp) return '';

  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(timestamp));
};

export const toCheckoutProduct = (content: AfriMarketContent): Product => ({
  id: content.id,
  name: content.title,
  seller: content.authorName,
  description: content.description,
  price: content.price || content.villagePrice || 0,
  villagePrice: content.villagePrice || content.price || 0,
  currency: content.currency || 'USD',
  imageUrl: content.coverURL,
  buyersCount: content.buyersCount || 0,
  buyersNeeded: content.buyersNeeded || 1
});

const shouldSyncWithMarket = (content: AfriMarketContent) => (
  content.isSellable &&
  content.media.length > 0 &&
  content.media.every((item) => item.resourceType === 'image')
);

export const useAfriMarket = () => {
  const { user, profile } = useFirebaseAuth();
  const [abcContents, setAbcContents] = useState<AfriMarketContent[]>([]);
  const [marketProducts, setMarketProducts] = useState<AfriMarketContent[]>([]);
  const [followedAuthors, setFollowedAuthors] = useState<Record<string, boolean>>({});
  const [likedContents, setLikedContents] = useState<Record<string, boolean>>({});
  const [commentsByContent, setCommentsByContent] = useState<Record<string, AfriMarketComment[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');

    const abcRef = ref(realtimeDb, 'abcPosts');
    const marketRef = ref(realtimeDb, 'marketProducts');
    const followsRef = user ? ref(realtimeDb, `follows/${user.uid}`) : null;
    const likesRef = user ? ref(realtimeDb, `contentLikesByUser/${user.uid}`) : null;

    const unsubscribeAbc = onValue(
      abcRef,
      (snapshot) => {
        const data = snapshot.val() as Record<string, RawContent> | null;
        const nextContents = Object.entries(data || {})
          .map(([id, content]) => normalizeContent(id, content))
          .filter((content) => content.status !== 'deleted' && content.status !== 'hidden')
          .sort((first, second) => getTimestamp(second.createdAt) - getTimestamp(first.createdAt));
        setAbcContents(nextContents);
        setLoading(false);
      },
      (abcError) => {
        console.error('Chargement ABC impossible:', abcError);
        setError('ABC est indisponible pour le moment.');
        setLoading(false);
      }
    );

    const unsubscribeMarket = onValue(
      marketRef,
      (snapshot) => {
        const data = snapshot.val() as Record<string, RawContent> | null;
        const nextProducts = Object.entries(data || {})
          .map(([id, content]) => normalizeContent(id, content))
          .filter((content) => (
            content.status !== 'deleted' &&
            content.status !== 'hidden' &&
            shouldSyncWithMarket(content)
          ))
          .sort((first, second) => getTimestamp(second.createdAt) - getTimestamp(first.createdAt));
        setMarketProducts(nextProducts);
      },
      (marketError) => {
        console.error('Chargement Market impossible:', marketError);
        setError('Le marche est indisponible pour le moment.');
      }
    );

    const unsubscribeFollows = followsRef
      ? onValue(followsRef, (snapshot) => {
          const data = snapshot.val() as Record<string, unknown> | null;
          setFollowedAuthors(
            Object.fromEntries(Object.keys(data || {}).map((authorId) => [authorId, true]))
          );
        })
      : undefined;

    const unsubscribeLikes = likesRef
      ? onValue(likesRef, (snapshot) => {
          const data = snapshot.val() as Record<string, unknown> | null;
          setLikedContents(
            Object.fromEntries(Object.keys(data || {}).map((contentId) => [contentId, true]))
          );
        })
      : undefined;

    return () => {
      unsubscribeAbc();
      unsubscribeMarket();
      unsubscribeFollows?.();
      unsubscribeLikes?.();
      off(abcRef);
      off(marketRef);
      if (followsRef) off(followsRef);
      if (likesRef) off(likesRef);
    };
  }, [user]);

  const publishContent = async (input: AfriMarketPostInput) => {
    if (!user) {
      throw new Error('Connecte-toi pour publier.');
    }

    const title = input.title.trim();
    const description = input.description.trim();
    const files = input.files.filter(Boolean);
    const hasVideo = files.some((file) => file.type.startsWith('video/'));
    const hasImage = files.some((file) => file.type.startsWith('image/'));

    if (!title) throw new Error('Ajoute un titre.');
    if (!description) throw new Error('Ajoute une description.');
    if (!files.length) throw new Error('Ajoute une video ou des photos.');
    if (hasVideo && (files.length > 1 || hasImage)) {
      throw new Error('Choisis une seule video ou plusieurs photos.');
    }
    if (input.isSellable && !Number(input.villagePrice || input.price)) {
      throw new Error('Ajoute le prix de vente.');
    }

    const postRef = push(ref(realtimeDb, 'abcPosts'));
    const postId = postRef.key;
    if (!postId) throw new Error('Publication impossible pour le moment.');

    const uploads = await Promise.all(files.map((file) => uploadMediaToCloudinary(file, user.uid)));
    const media: AfriMarketMedia[] = uploads.map((upload, index) => ({
      ...upload,
      id: `${postId}_${index}`
    }));
    const now = Date.now();
    const authorName = profile?.businessName || profile?.displayName || user.displayName || 'Utilisateur AfriSell';
    const authorAvatar = profile?.logoURL || profile?.photoURL || user.photoURL || '';
    const isVideo = media.some((item) => item.resourceType === 'video');
    const isSellable = Boolean(input.isSellable);
    const isMarketEligible = isSellable && media.length > 0 && media.every((item) => item.resourceType === 'image');

    const payload: AfriMarketContent = {
      id: postId,
      authorId: user.uid,
      authorName,
      authorAvatar,
      title,
      description,
      category: isSellable ? input.category || 'Autres' : 'Partage',
      format: isSellable && !isVideo ? 'article' : isVideo ? 'video' : 'gallery',
      media,
      coverURL: media[0]?.secureUrl || media[0]?.mediaUrl || '',
      isSellable,
      price: isSellable ? Number(input.price || input.villagePrice || 0) : undefined,
      villagePrice: isSellable ? Number(input.villagePrice || input.price || 0) : undefined,
      currency: input.currency || 'USD',
      buyersCount: 0,
      buyersNeeded: isSellable ? Number(input.buyersNeeded || 1) : 0,
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      followsCount: 0,
      createdAt: now,
      updatedAt: now,
      status: 'active'
    };

    const updates: Record<string, unknown> = {
      [`abcPosts/${postId}`]: payload,
      [`userPosts/${user.uid}/${postId}`]: {
        id: postId,
        createdAt: now,
        type: payload.format
      }
    };

    media.forEach((item) => {
      updates[`users/${user.uid}/media/${item.id}`] = {
        ...item,
        ownerId: user.uid,
        postId,
        createdAt: now
      };
    });

    if (isMarketEligible) {
      updates[`marketProducts/${postId}`] = payload;
    } else {
      updates[`marketProducts/${postId}`] = null;
    }

    await update(ref(realtimeDb), stripUndefined(updates));
    return payload;
  };

  const followAuthor = async (content: AfriMarketContent) => {
    if (!user || !content.authorId || content.authorId === user.uid) return;
    if (followedAuthors[content.authorId]) return;

    await update(ref(realtimeDb), {
      [`follows/${user.uid}/${content.authorId}`]: {
        authorId: content.authorId,
        authorName: content.authorName,
        followedAt: serverTimestamp()
      },
      [`followers/${content.authorId}/${user.uid}`]: {
        uid: user.uid,
        displayName: profile?.displayName || user.displayName || 'Utilisateur AfriSell',
        followedAt: serverTimestamp()
      }
    });

    await runTransaction(ref(realtimeDb, `abcPosts/${content.id}/followsCount`), (current) => toNumber(current) + 1);
    if (shouldSyncWithMarket(content)) {
      await runTransaction(ref(realtimeDb, `marketProducts/${content.id}/followsCount`), (current) => toNumber(current) + 1);
    }
    setFollowedAuthors((current) => ({ ...current, [content.authorId]: true }));
  };

  const toggleLike = async (content: AfriMarketContent) => {
    if (!user) return;

    const wasLiked = Boolean(likedContents[content.id]);
    const nextValue = wasLiked ? null : {
      postId: content.id,
      authorId: content.authorId,
      likedAt: serverTimestamp()
    };
    const delta = wasLiked ? -1 : 1;

    setLikedContents((current) => ({
      ...current,
      [content.id]: !wasLiked
    }));

    await update(ref(realtimeDb), {
      [`contentLikes/${content.id}/${user.uid}`]: nextValue,
      [`contentLikesByUser/${user.uid}/${content.id}`]: nextValue
    });

    await runTransaction(ref(realtimeDb, `abcPosts/${content.id}/likesCount`), (current) => Math.max(toNumber(current) + delta, 0));
    if (shouldSyncWithMarket(content)) {
      await runTransaction(ref(realtimeDb, `marketProducts/${content.id}/likesCount`), (current) => Math.max(toNumber(current) + delta, 0));
    }
  };

  const watchComments = (contentId: string) => {
    if (!contentId) return () => undefined;

    const commentsRef = ref(realtimeDb, `abcPostComments/${contentId}`);
    const unsubscribe = onValue(
      commentsRef,
      (snapshot) => {
        const data = snapshot.val() as Record<string, RawComment> | null;
        const nextComments = Object.entries(data || {})
          .map(([id, comment]) => normalizeComment(id, comment))
          .sort((first, second) => getTimestamp(first.createdAt) - getTimestamp(second.createdAt));
        setCommentsByContent((current) => ({
          ...current,
          [contentId]: nextComments
        }));
      },
      (commentsError) => {
        console.error('Chargement commentaires ABC impossible:', commentsError);
        setError('Commentaires indisponibles pour le moment.');
      }
    );

    return () => {
      unsubscribe();
      off(commentsRef);
    };
  };

  const addComment = async (content: AfriMarketContent, text: string) => {
    if (!user) return;
    const trimmedText = text.trim();
    if (!trimmedText) return;

    const commentRef = push(ref(realtimeDb, `abcPostComments/${content.id}`));
    const commentId = commentRef.key;
    if (!commentId) return;

    const comment: AfriMarketComment = {
      id: commentId,
      postId: content.id,
      authorId: user.uid,
      authorName: profile?.displayName || user.displayName || 'Utilisateur AfriSell',
      authorAvatar: profile?.photoURL || user.photoURL || '',
      text: trimmedText,
      createdAt: Date.now()
    };

    await update(ref(realtimeDb), {
      [`abcPostComments/${content.id}/${commentId}`]: comment,
      [`userComments/${user.uid}/${commentId}`]: {
        postId: content.id,
        createdAt: comment.createdAt
      }
    });

    await runTransaction(ref(realtimeDb, `abcPosts/${content.id}/commentsCount`), (current) => toNumber(current) + 1);
    if (shouldSyncWithMarket(content)) {
      await runTransaction(ref(realtimeDb, `marketProducts/${content.id}/commentsCount`), (current) => toNumber(current) + 1);
    }
  };

  const recordShare = async (content: AfriMarketContent) => {
    const shareRef = push(ref(realtimeDb, `abcPostShares/${content.id}`));
    const shareId = shareRef.key;

    await update(ref(realtimeDb), {
      ...(shareId ? {
        [`abcPostShares/${content.id}/${shareId}`]: {
          postId: content.id,
          userId: user?.uid || 'guest',
          sharedAt: serverTimestamp()
        }
      } : {})
    });

    await runTransaction(ref(realtimeDb, `abcPosts/${content.id}/sharesCount`), (current) => toNumber(current) + 1);
    if (shouldSyncWithMarket(content)) {
      await runTransaction(ref(realtimeDb, `marketProducts/${content.id}/sharesCount`), (current) => toNumber(current) + 1);
    }
  };

  return useMemo(() => ({
    abcContents,
    marketProducts,
    followedAuthors,
    likedContents,
    commentsByContent,
    loading,
    error,
    publishContent,
    followAuthor,
    toggleLike,
    watchComments,
    addComment,
    recordShare
  }), [abcContents, commentsByContent, error, followedAuthors, likedContents, loading, marketProducts]);
};
