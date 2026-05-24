import React, { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { AfriSellIcon, AfriSellIconName } from '../components/AfriSellIcon';
import {
  AfriMarketComment,
  AfriMarketContent,
  MARKET_CATEGORIES,
  formatMarketPrice,
  formatMarketTime,
  toCheckoutProduct,
  useAfriMarket
} from '../hooks/useAfriMarket';
import { useFirebaseAuth } from '../hooks/useFirebaseAuth';
import { useAppStore } from '../store/useAppStore';
import { cn } from '../lib/utils';

type QuickPanel = 'cart' | 'orders' | 'following' | null;
const ABC_SOUND_PREF_KEY = 'afrisell:abc-sound-enabled';

function CreatorAvatar({ content }: { content: AfriMarketContent }) {
  const initials = content.authorName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'AF';

  return (
    <div className="h-9 w-9 overflow-hidden rounded-full border border-[#15EA3E]/30 bg-gray-900">
      {content.authorAvatar ? (
        <img src={content.authorAvatar} alt={content.authorName} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[#15EA3E]/10 text-[10px] font-black text-[#15EA3E]">
          {initials}
        </div>
      )}
    </div>
  );
}

function FeedMedia({
  content,
  soundEnabled,
  isActive
}: {
  content: AfriMarketContent;
  soundEnabled: boolean;
  isActive: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const firstMedia = content.media[0];
  const isVideo = firstMedia?.resourceType === 'video';

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isVideo) return undefined;

    video.muted = !soundEnabled || !isActive;

    if (isActive) {
      void video.play().catch(() => {
        video.muted = true;
        void video.play().catch(() => undefined);
      });
    } else {
      video.pause();
    }

    return () => {
      video.pause();
    };
  }, [isActive, isVideo, soundEnabled, firstMedia?.secureUrl, firstMedia?.mediaUrl]);

  if (isVideo) {
    return (
      <video
        ref={videoRef}
        src={firstMedia.secureUrl || firstMedia.mediaUrl}
        className="h-full w-full object-cover"
        autoPlay={isActive}
        muted={!soundEnabled || !isActive}
        loop
        playsInline
        preload={isActive ? 'auto' : 'metadata'}
        controls={false}
      />
    );
  }

  if (content.coverURL) {
    return <img src={content.coverURL} alt={content.title} className="h-full w-full object-cover" />;
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-[#070707] text-gray-700">
      <AfriSellIcon name="video" size={42} />
    </div>
  );
}

function FeedItem({
  content,
  isOwnContent,
  isFollowed,
  isLiked,
  isActive,
  soundEnabled,
  likeBurstActive,
  isChromeHidden,
  onBuy,
  onFollow,
  onLike,
  onComment,
  onShare,
  onToggleSound,
  onToggleChrome,
  onVisible
}: {
  key?: React.Key;
  content: AfriMarketContent;
  isOwnContent: boolean;
  isFollowed: boolean;
  isLiked: boolean;
  isActive: boolean;
  soundEnabled: boolean;
  likeBurstActive: boolean;
  isChromeHidden: boolean;
  onBuy: () => void;
  onFollow: () => void;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onToggleSound: () => void;
  onToggleChrome: () => void;
  onVisible: () => void;
}) {
  const itemRef = useRef<HTMLElement | null>(null);
  const isVideo = content.media[0]?.resourceType === 'video';
  const stopControlClick = (event: React.MouseEvent) => {
    event.stopPropagation();
  };

  useEffect(() => {
    const element = itemRef.current;
    if (!element) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.65) {
          onVisible();
        }
      },
      {
        threshold: [0.65, 0.82]
      }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [onVisible]);

  return (
    <article
      ref={itemRef}
      onClick={onToggleChrome}
      className="relative flex h-full w-full snap-start items-center justify-center overflow-hidden bg-black"
    >
      <div className="absolute inset-0">
        <FeedMedia content={content} soundEnabled={soundEnabled} isActive={isActive} />
        {!isChromeHidden && <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/18 to-black" />}
      </div>

      {!isChromeHidden && (
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-end p-5 pb-[116px]">
        {isVideo && (
          <div className="pointer-events-auto absolute right-5 top-20">
            <button
              type="button"
              onClick={(event) => {
                stopControlClick(event);
                onToggleSound();
              }}
              className={cn(
                'flex h-10 items-center gap-2 rounded-full border px-3 text-[10px] font-black uppercase tracking-wider backdrop-blur-md transition-colors',
                soundEnabled
                  ? 'border-[#15EA3E]/40 bg-[#15EA3E]/15 text-[#15EA3E]'
                  : 'border-white/10 bg-black/45 text-white/70'
              )}
            >
              <AfriSellIcon name="signal" size={14} />
              {soundEnabled ? 'Son' : 'Muet'}
            </button>
          </div>
        )}

        <div className="mb-3 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#15EA3E]" />
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white">
            ABC {content.format === 'article' ? 'Article' : content.format === 'video' ? 'Video' : 'Photos'}
          </span>
          {content.media.length > 1 && (
            <span className="rounded-full bg-white/10 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-white/70">
              {content.media.length} photos
            </span>
          )}
        </div>

        <div className="mb-6 flex items-end justify-between gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex items-center gap-2">
              <CreatorAvatar content={content} />
              <div className="min-w-0">
                <h3 className="truncate text-xs font-black uppercase tracking-wider text-gray-200">@{content.authorName.replace(/\s+/g, '')}</h3>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{formatMarketTime(content.createdAt)}</p>
              </div>
            </div>
            <h2 className="mt-2 line-clamp-2 text-lg font-black leading-tight text-white">{content.title}</h2>
            <p className="line-clamp-3 max-w-[90%] text-sm font-medium leading-snug text-[#e0e0e0]">{content.description}</p>
            {content.isSellable && (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wide text-[#15EA3E]">
                  Prix: {formatMarketPrice(content.villagePrice || content.price, content.currency)}
                </span>
                <span className="rounded-full bg-white/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-white/60">
                  {content.buyersCount || 0}/{content.buyersNeeded || 1} acheteurs
                </span>
              </div>
            )}
          </div>

          <div className="pointer-events-auto flex flex-col items-center gap-5">
            <button
              type="button"
              onClick={(event) => {
                stopControlClick(event);
                onLike();
              }}
              className="group flex flex-col items-center gap-1"
            >
              <AfriSellIcon
                name="heart"
                size={25}
                className={cn(
                  'transition-all duration-300',
                  isLiked ? 'scale-110 text-[#15EA3E] drop-shadow-[0_0_12px_rgba(21,234,62,0.72)]' : 'text-gray-400 group-hover:text-[#15EA3E]'
                )}
              />
              <span className={cn('text-[10px] font-mono', isLiked ? 'text-[#15EA3E]' : 'text-gray-400')}>
                {content.likesCount || 0}
              </span>
            </button>
            <button
              type="button"
              onClick={(event) => {
                stopControlClick(event);
                onComment();
              }}
              className="group flex flex-col items-center gap-1"
            >
              <AfriSellIcon name="comment" size={25} className="text-gray-400 transition-colors group-hover:text-white" />
              <span className="text-[10px] font-mono text-gray-400">{content.commentsCount || 0}</span>
            </button>
            <button
              type="button"
              onClick={(event) => {
                stopControlClick(event);
                onShare();
              }}
              className="group flex flex-col items-center gap-1"
            >
              <AfriSellIcon name="share" size={25} className="text-gray-400 transition-colors group-hover:text-white" />
              <span className="text-[10px] font-mono text-gray-400">{content.sharesCount || 0}</span>
            </button>
          </div>
        </div>

        <div className="pointer-events-auto w-full">
          {content.isSellable ? (
            <button
              type="button"
              onClick={(event) => {
                stopControlClick(event);
                onBuy();
              }}
              className="w-full rounded-xl bg-[#15EA3E] py-4 text-xs font-black uppercase tracking-widest text-black transition-all active:scale-95"
            >
              Acheter maintenant
            </button>
          ) : isOwnContent ? (
            <button
              type="button"
              disabled
              className="w-full rounded-xl border border-white/10 bg-white/8 py-4 text-xs font-black uppercase tracking-widest text-white/50"
            >
              Ta publication
            </button>
          ) : (
            <button
              type="button"
              onClick={(event) => {
                stopControlClick(event);
                onFollow();
              }}
              disabled={isFollowed}
              className={cn(
                'w-full rounded-xl py-4 text-xs font-black uppercase tracking-widest transition-all active:scale-95',
                isFollowed ? 'border border-[#15EA3E]/30 bg-[#15EA3E]/10 text-[#15EA3E]' : 'bg-white text-black'
              )}
            >
              {isFollowed ? 'Deja suivi' : 'Suivre'}
            </button>
          )}
        </div>
      </div>
      )}

      {likeBurstActive && (
        <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden abc-like-burst">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(21,234,62,0.38),rgba(21,234,62,0.14)_28%,rgba(0,0,0,0)_68%)]" />
          <div className="abc-like-ring absolute left-1/2 top-1/2 h-72 w-72 rounded-full border-2 border-[#15EA3E]/70" />
          <div className="abc-like-ring absolute left-1/2 top-1/2 h-48 w-48 rounded-full border border-[#15EA3E]/70 [animation-delay:90ms]" />
          <div className="abc-like-pop absolute left-1/2 top-1/2 flex h-24 w-24 items-center justify-center rounded-full bg-[#15EA3E] text-black shadow-[0_0_46px_rgba(21,234,62,0.88)]">
            <AfriSellIcon name="heart" size={42} />
          </div>
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
            <span
              key={angle}
              className="abc-like-spark absolute left-1/2 top-1/2 h-3 w-3 rounded-full bg-[#15EA3E] shadow-[0_0_16px_rgba(21,234,62,0.95)]"
              style={{ '--spark-angle': `${angle}deg` } as React.CSSProperties}
            />
          ))}
        </div>
      )}
    </article>
  );
}

function PublishPanel({
  open,
  onClose,
  onPublished
}: {
  open: boolean;
  onClose: () => void;
  onPublished: () => void;
}) {
  const { publishContent } = useAfriMarket();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Services');
  const [files, setFiles] = useState<File[]>([]);
  const [isSellable, setIsSellable] = useState(false);
  const [price, setPrice] = useState('');
  const [villagePrice, setVillagePrice] = useState('');
  const [buyersNeeded, setBuyersNeeded] = useState('1');
  const [currency, setCurrency] = useState('USD');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fileLabel = useMemo(() => {
    if (!files.length) return isSellable ? 'Photos produit ou video de vente' : 'Video ou photos';
    const hasVideo = files.some((file) => file.type.startsWith('video/'));
    if (hasVideo) return files[0]?.name || '1 video';
    return `${files.length} photo${files.length > 1 ? 's' : ''}`;
  }, [files, isSellable]);

  if (!open) return null;

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFiles = Array.from(event.target.files || []);
    setFiles(nextFiles);
    setError('');
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      await publishContent({
        title,
        description,
        category: isSellable ? category : 'Partage',
        files,
        isSellable,
        price: Number(price || villagePrice || 0),
        villagePrice: Number(villagePrice || price || 0),
        buyersNeeded: Number(buyersNeeded || 1),
        currency
      });
      setTitle('');
      setDescription('');
      setFiles([]);
      setIsSellable(false);
      setPrice('');
      setVillagePrice('');
      setBuyersNeeded('1');
      onPublished();
      onClose();
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : 'Publication impossible pour le moment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-end bg-black/78 backdrop-blur-md">
      <form onSubmit={submit} className="max-h-[88%] w-full overflow-y-auto rounded-t-[2rem] border-t border-gray-800 bg-black p-5 pb-8">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">ABC</p>
            <h2 className="mt-1 text-lg font-black text-white">Nouvelle publication</h2>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-800 text-gray-500">
            <AfriSellIcon name="close" size={19} />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-xs font-semibold text-red-200">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setIsSellable(false)}
            className={cn('rounded-2xl border p-3 text-left', !isSellable ? 'border-[#15EA3E]/40 bg-[#15EA3E]/10 text-white' : 'border-gray-800 bg-[#050505] text-gray-500')}
          >
            <AfriSellIcon name="video" size={18} />
            <span className="mt-2 block text-xs font-black">Partager</span>
            <span className="mt-1 block text-[10px] leading-snug">Video ou photos pour le feed.</span>
          </button>
          <button
            type="button"
            onClick={() => setIsSellable(true)}
            className={cn('rounded-2xl border p-3 text-left', isSellable ? 'border-[#15EA3E]/40 bg-[#15EA3E]/10 text-white' : 'border-gray-800 bg-[#050505] text-gray-500')}
          >
            <AfriSellIcon name="market" size={18} />
            <span className="mt-2 block text-xs font-black">Vendre</span>
            <span className="mt-1 block text-[10px] leading-snug">Photo ou video avec bouton Acheter.</span>
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={isSellable ? 'Nom de l article' : 'Titre'}
            className="h-12 w-full rounded-2xl border border-gray-800 bg-[#050505] px-4 text-sm font-semibold text-white outline-none focus:border-[#15EA3E]/50"
          />
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Description"
            rows={4}
            className="w-full resize-none rounded-2xl border border-gray-800 bg-[#050505] px-4 py-3 text-sm font-semibold text-white outline-none focus:border-[#15EA3E]/50"
          />
          {isSellable && (
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="h-12 w-full rounded-2xl border border-gray-800 bg-[#050505] px-4 text-sm font-semibold text-white outline-none focus:border-[#15EA3E]/50"
            >
              {MARKET_CATEGORIES.filter((categoryName) => categoryName !== 'Tout').map((categoryName) => (
                <option key={categoryName} value={categoryName}>{categoryName}</option>
              ))}
            </select>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={handleFiles}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-14 w-full items-center justify-between rounded-2xl border border-dashed border-gray-700 bg-[#050505] px-4 text-left text-sm font-black text-white"
          >
            <span>{fileLabel}</span>
            <AfriSellIcon name="clip" size={18} className="text-[#15EA3E]" />
          </button>

          {isSellable && (
            <p className="-mt-1 text-[10px] font-semibold leading-relaxed text-gray-500">
              Les ventes avec photos apparaissent aussi dans le Market. Les ventes en video restent dans ABC avec le bouton Acheter.
            </p>
          )}

          {isSellable && (
            <div className="grid grid-cols-2 gap-2">
              <input
                value={villagePrice}
                onChange={(event) => setVillagePrice(event.target.value)}
                inputMode="decimal"
                placeholder="Prix"
                className="h-12 rounded-2xl border border-gray-800 bg-[#050505] px-4 text-sm font-semibold text-white outline-none focus:border-[#15EA3E]/50"
              />
              <select
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
                className="h-12 rounded-2xl border border-gray-800 bg-[#050505] px-4 text-sm font-semibold text-white outline-none focus:border-[#15EA3E]/50"
              >
                <option value="USD">USD</option>
                <option value="CDF">CDF</option>
              </select>
              <input
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                inputMode="decimal"
                placeholder="Ancien prix"
                className="h-12 rounded-2xl border border-gray-800 bg-[#050505] px-4 text-sm font-semibold text-white outline-none focus:border-[#15EA3E]/50"
              />
              <input
                value={buyersNeeded}
                onChange={(event) => setBuyersNeeded(event.target.value)}
                inputMode="numeric"
                placeholder="Acheteurs"
                className="h-12 rounded-2xl border border-gray-800 bg-[#050505] px-4 text-sm font-semibold text-white outline-none focus:border-[#15EA3E]/50"
              />
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="mt-5 h-13 w-full rounded-2xl bg-[#15EA3E] py-4 text-xs font-black uppercase tracking-widest text-black disabled:bg-gray-800 disabled:text-gray-500"
        >
          {submitting ? 'Publication...' : 'Publier'}
        </button>
      </form>
    </div>
  );
}

function CommentPanel({
  content,
  comments,
  onClose,
  onAddComment,
  watchComments
}: {
  content: AfriMarketContent | null;
  comments: AfriMarketComment[];
  onClose: () => void;
  onAddComment: (text: string) => Promise<void>;
  watchComments: (contentId: string) => () => void;
}) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!content) return undefined;
    return watchComments(content.id);
  }, [content?.id]);

  if (!content) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim() || sending) return;

    setSending(true);
    try {
      await onAddComment(draft);
      setDraft('');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-end bg-black/72 backdrop-blur-md">
      <section className="flex max-h-[78%] w-full flex-col rounded-t-[2rem] border-t border-gray-800 bg-black">
        <div className="flex items-center justify-between border-b border-gray-900 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">Commentaires</p>
            <h2 className="mt-1 truncate text-sm font-black text-white">{content.title}</h2>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-800 text-gray-500">
            <AfriSellIcon name="close" size={19} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {comments.length ? (
            <div className="space-y-3">
              {comments.map((comment) => (
                <div key={comment.id} className="rounded-2xl border border-gray-900 bg-[#050505] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-xs font-black text-white">{comment.authorName}</p>
                    <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-gray-600">
                      {formatMarketTime(comment.createdAt)}
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-medium leading-relaxed text-gray-300">{comment.text}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex min-h-[190px] flex-col items-center justify-center text-center">
              <AfriSellIcon name="comment" size={30} className="text-gray-700" />
              <p className="mt-3 text-sm font-black text-white">Aucun commentaire</p>
              <p className="mt-1 text-xs text-gray-500">Sois le premier a reagir.</p>
            </div>
          )}
        </div>

        <form onSubmit={submit} className="flex items-end gap-2 border-t border-gray-900 px-4 py-3">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ecrire un commentaire..."
            rows={1}
            className="max-h-[92px] min-h-11 flex-1 resize-none rounded-xl border border-gray-800 bg-[#050505] px-4 py-3 text-xs font-semibold text-white outline-none focus:border-[#15EA3E]/50"
          />
          <button
            type="submit"
            disabled={!draft.trim() || sending}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#15EA3E] text-black disabled:bg-gray-800 disabled:text-gray-500"
            aria-label="Envoyer le commentaire"
          >
            <AfriSellIcon name="send" size={18} />
          </button>
        </form>
      </section>
    </div>
  );
}

function QuickPanelSheet({
  panel,
  cart,
  followedCount,
  onClose,
  onCheckout,
  onRemove
}: {
  panel: QuickPanel;
  cart: ReturnType<typeof useAppStore.getState>['cart'];
  followedCount: number;
  onClose: () => void;
  onCheckout: (productId: string) => void;
  onRemove: (productId: string) => void;
}) {
  if (!panel) return null;

  const title = panel === 'cart' ? 'Panier ABC' : panel === 'orders' ? 'Commandes' : 'Suivis';
  const subtitle = panel === 'cart'
    ? `${cart.length} article${cart.length > 1 ? 's' : ''} ajoute${cart.length > 1 ? 's' : ''}`
    : panel === 'orders'
      ? 'Tes commandes apparaitront ici.'
      : `${followedCount} profil${followedCount > 1 ? 's' : ''} suivi${followedCount > 1 ? 's' : ''}`;

  return (
    <div className="absolute inset-0 z-50 flex items-end bg-black/70 backdrop-blur-md">
      <section className="max-h-[72%] w-full overflow-y-auto rounded-t-[2rem] border-t border-gray-800 bg-black p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">{subtitle}</p>
            <h2 className="mt-1 text-lg font-black text-white">{title}</h2>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-800 text-gray-500">
            <AfriSellIcon name="close" size={19} />
          </button>
        </div>

        {panel === 'cart' && (
          cart.length ? (
            <div className="space-y-3">
              {cart.map((product) => (
                <div key={product.id} className="flex gap-3 rounded-2xl border border-gray-900 bg-[#050505] p-3">
                  <img src={product.imageUrl} alt={product.name} className="h-16 w-16 rounded-xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-black text-white">{product.name}</p>
                    <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-wide text-gray-500">{product.seller}</p>
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onCheckout(product.id)}
                        className="rounded-xl bg-[#15EA3E] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-black"
                      >
                        Acheter
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemove(product.id)}
                        className="rounded-xl border border-gray-800 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-gray-500"
                      >
                        Retirer
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex min-h-[170px] flex-col items-center justify-center text-center">
              <AfriSellIcon name="market" size={30} className="text-gray-700" />
              <p className="mt-3 text-sm font-black text-white">Panier vide</p>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">Like une video ou publication vendable pour l ajouter automatiquement.</p>
            </div>
          )
        )}

        {panel === 'orders' && (
          <div className="flex min-h-[170px] flex-col items-center justify-center text-center">
            <AfriSellIcon name="check" size={30} className="text-gray-700" />
            <p className="mt-3 text-sm font-black text-white">Aucune commande</p>
            <p className="mt-1 text-xs leading-relaxed text-gray-500">Les commandes confirmees depuis AfriSpay seront listees ici.</p>
          </div>
        )}

        {panel === 'following' && (
          <div className="flex min-h-[170px] flex-col items-center justify-center text-center">
            <AfriSellIcon name="profile" size={30} className="text-gray-700" />
            <p className="mt-3 text-sm font-black text-white">{followedCount ? 'Profils suivis' : 'Aucun suivi'}</p>
            <p className="mt-1 text-xs leading-relaxed text-gray-500">
              {followedCount ? 'Tes medias suivis sont bien gardes.' : 'Appuie sur Suivre dans ABC pour garder un createur ou vendeur.'}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

export default function VideoFeed() {
  const { user } = useFirebaseAuth();
  const {
    abcContents,
    followedAuthors,
    likedContents,
    commentsByContent,
    loading,
    error,
    followAuthor,
    toggleLike,
    watchComments,
    addComment,
    recordShare
  } = useAfriMarket();
  const openCheckout = useAppStore((state) => state.openCheckout);
  const addToCart = useAppStore((state) => state.addToCart);
  const removeFromCart = useAppStore((state) => state.removeFromCart);
  const cart = useAppStore((state) => state.cart);
  const [isPublishing, setIsPublishing] = useState(false);
  const [commentContent, setCommentContent] = useState<AfriMarketContent | null>(null);
  const [isSoundEnabled, setIsSoundEnabled] = useState(() => (
    window.localStorage.getItem(ABC_SOUND_PREF_KEY) === '1'
  ));
  const [likeBurstContentId, setLikeBurstContentId] = useState('');
  const [isFeedChromeHidden, setIsFeedChromeHidden] = useState(false);
  const [quickPanel, setQuickPanel] = useState<QuickPanel>(null);
  const [activeContentId, setActiveContentId] = useState('');
  const followedCount = Object.keys(followedAuthors).length;
  const isPlaybackBlocked = Boolean(isPublishing || commentContent || quickPanel);

  useEffect(() => {
    window.localStorage.setItem(ABC_SOUND_PREF_KEY, isSoundEnabled ? '1' : '0');
  }, [isSoundEnabled]);

  useEffect(() => {
    if (!abcContents.length) {
      setActiveContentId('');
      return;
    }

    setActiveContentId((current) => (
      current && abcContents.some((content) => content.id === current)
        ? current
        : abcContents[0].id
    ));
  }, [abcContents]);

  const handleShare = async (content: AfriMarketContent) => {
    const shareUrl = `${window.location.origin}/feed?post=${content.id}`;
    const shareText = `${content.title} - AfriSell`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: content.title,
          text: shareText,
          url: shareUrl
        });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
      }

      await recordShare(content);
    } catch (shareError) {
      console.error('Partage ABC impossible:', shareError);
    }
  };

  const handleLike = async (content: AfriMarketContent) => {
    const isAlreadyLiked = Boolean(likedContents[content.id]);
    if (!isAlreadyLiked) {
      setLikeBurstContentId(content.id);
      window.setTimeout(() => {
        setLikeBurstContentId((current) => current === content.id ? '' : current);
      }, 1350);

      if (content.isSellable) {
        addToCart(toCheckoutProduct(content));
      }
    }

    await toggleLike(content);
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {!isFeedChromeHidden && (
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center gap-2 px-4 pt-5">
          <div className="rounded-full border border-white/10 bg-black/80 px-3 py-2 shadow-[0_8px_18px_rgba(0,0,0,0.28)]">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white">ABC Feed</p>
          </div>
          <div className="pointer-events-auto flex min-w-0 flex-1 gap-2 overflow-x-auto overflow-y-visible py-1 scrollbar-hide">
            {[
              { id: 'cart' as QuickPanel, label: 'Panier', icon: 'cart' as AfriSellIconName, count: cart.length },
              { id: 'orders' as QuickPanel, label: 'Commandes', icon: 'order' as AfriSellIconName, count: 0 },
              { id: 'following' as QuickPanel, label: 'Suivis', icon: 'follow' as AfriSellIconName, count: followedCount }
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setQuickPanel(item.id)}
                className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/80 text-white shadow-[0_8px_18px_rgba(0,0,0,0.28)] transition-colors active:scale-95"
                aria-label={item.label}
                title={item.label}
              >
                <AfriSellIcon name={item.icon} size={16} className="text-[#15EA3E]" />
                <span className="absolute -right-1 top-0 flex h-4 min-w-4 -translate-y-1/2 items-center justify-center rounded-full bg-[#15EA3E] px-1 text-[8px] font-black text-black">
                  {item.count}
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setIsPublishing(true)}
            className="pointer-events-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#15EA3E] text-black shadow-[0_12px_26px_rgba(21,234,62,0.26)]"
            aria-label="Publier sur ABC"
          >
            <AfriSellIcon name="clip" size={19} />
          </button>
      </div>
      )}

      {error && (
        <div className="absolute left-4 right-4 top-20 z-20 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-xs font-semibold text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex h-full flex-col items-center justify-center px-10 text-center">
          <AfriSellIcon name="video" size={42} className="text-[#15EA3E]" />
          <p className="mt-4 text-sm font-black uppercase tracking-wide text-white">Chargement ABC</p>
        </div>
      ) : abcContents.length ? (
        <div className="h-full w-full snap-y snap-mandatory overflow-y-scroll scrollbar-hide">
          {abcContents.map((content) => (
            <FeedItem
              key={content.id}
              content={content}
              isOwnContent={content.authorId === user?.uid}
              isFollowed={Boolean(followedAuthors[content.authorId])}
              isLiked={Boolean(likedContents[content.id])}
              isActive={!isPlaybackBlocked && activeContentId === content.id}
              soundEnabled={isSoundEnabled}
              likeBurstActive={likeBurstContentId === content.id}
              isChromeHidden={isFeedChromeHidden}
              onBuy={() => openCheckout(toCheckoutProduct(content))}
              onFollow={() => followAuthor(content)}
              onLike={() => handleLike(content)}
              onComment={() => setCommentContent(content)}
              onShare={() => handleShare(content)}
              onToggleSound={() => setIsSoundEnabled((current) => !current)}
              onToggleChrome={() => setIsFeedChromeHidden((current) => !current)}
              onVisible={() => setActiveContentId(content.id)}
            />
          ))}
        </div>
      ) : (
        <div className="flex h-full flex-col items-center justify-center px-10 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-gray-800 bg-[#050505] text-[#15EA3E]">
            <AfriSellIcon name="video" size={28} />
          </div>
          <h2 className="mt-5 text-lg font-black text-white">Aucune publication</h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-500">Ajoute une video, plusieurs photos ou un article a vendre.</p>
          <button
            type="button"
            onClick={() => setIsPublishing(true)}
            className="mt-5 rounded-2xl bg-[#15EA3E] px-5 py-3 text-xs font-black uppercase tracking-widest text-black"
          >
            Publier
          </button>
        </div>
      )}

      <PublishPanel
        open={isPublishing}
        onClose={() => setIsPublishing(false)}
        onPublished={() => undefined}
      />

      <CommentPanel
        content={commentContent}
        comments={commentContent ? commentsByContent[commentContent.id] || [] : []}
        onClose={() => setCommentContent(null)}
        onAddComment={(text) => commentContent ? addComment(commentContent, text) : Promise.resolve()}
        watchComments={watchComments}
      />

      <QuickPanelSheet
        panel={quickPanel}
        cart={cart}
        followedCount={followedCount}
        onClose={() => setQuickPanel(null)}
        onCheckout={(productId) => {
          const product = cart.find((item) => item.id === productId);
          if (product) {
            setQuickPanel(null);
            openCheckout(product);
          }
        }}
        onRemove={removeFromCart}
      />
    </div>
  );
}
