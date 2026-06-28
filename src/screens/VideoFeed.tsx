import React, { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AfriSellIcon } from '../components/AfriSellIcon';
import {
  AfriMarketComment,
  AfriMarketContent,
  formatMarketPrice,
  formatMarketTime,
  toCheckoutProduct,
  useAfriMarket
} from '../hooks/useAfriMarket';
import { useFirebaseAuth } from '../hooks/useFirebaseAuth';
import { useAppStore } from '../store/useAppStore';
import { cn } from '../lib/utils';
import { shareVillageDealToAfriChat } from '../domains/commerce';
import type { AfriSellUserProfile } from '../hooks/useFirebaseAuth';

type QuickPanel = 'cart' | 'orders' | 'following' | null;
type FeedFilter = 'live' | 'for-you' | 'following' | 'paid' | 'friends';
const ABC_SOUND_PREF_KEY = 'afrisell:abc-sound-enabled';
const MARKET_BUSINESS_CATEGORY_IDS = new Set(['commerce']);
const MARKET_BUSINESS_SERVICE_IDS = new Set(['store', 'supplier', 'producer']);

const hasMarketBusinessAccount = (profile?: AfriSellUserProfile | null) => {
  if (!profile) return false;
  const accounts = [
    profile.businessAccount,
    ...Object.values(profile.businessAccounts || {})
  ].filter(Boolean);

  return accounts.some((account) => (
    MARKET_BUSINESS_CATEGORY_IDS.has(account?.categoryId || '') ||
    MARKET_BUSINESS_SERVICE_IDS.has(account?.serviceId || '') ||
    profile.primaryRole === 'seller'
  ));
};

const getLinkedProductPrice = (content: AfriMarketContent, product?: AfriMarketContent) => (
  product
    ? formatMarketPrice(product.villagePrice || product.price, product.currency)
    : formatMarketPrice(content.linkedProductVillagePrice || content.linkedProductPrice, content.linkedProductCurrency || content.currency)
);

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
  isActive,
  isPausedByUser
}: {
  content: AfriMarketContent;
  soundEnabled: boolean;
  isActive: boolean;
  isPausedByUser: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoProgress, setVideoProgress] = useState(0);
  const firstMedia = content.media[0];
  const isVideo = firstMedia?.resourceType === 'video';
  const progressPercent = videoDuration ? Math.min((videoProgress / videoDuration) * 100, 100) : 0;

  const syncVideoProgress = () => {
    const video = videoRef.current;
    if (!video) return;
    setVideoDuration(Number.isFinite(video.duration) ? video.duration : 0);
    setVideoProgress(video.currentTime || 0);
  };

  const seekVideo = (event: ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    const nextTime = Number(event.target.value);
    setVideoProgress(nextTime);
    if (!video || !Number.isFinite(nextTime)) return;
    video.currentTime = nextTime;
  };

  const stopProgressControl = (event: React.SyntheticEvent) => {
    event.stopPropagation();
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isVideo) return undefined;

    video.muted = !soundEnabled || !isActive;

    if (isActive && !isPausedByUser) {
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
  }, [isActive, isPausedByUser, isVideo, soundEnabled, firstMedia?.secureUrl, firstMedia?.mediaUrl]);

  if (isVideo) {
    return (
      <div className="relative h-full w-full">
        <video
          ref={videoRef}
          src={firstMedia.secureUrl || firstMedia.mediaUrl}
          className="h-full w-full object-cover"
          autoPlay={isActive && !isPausedByUser}
          muted={!soundEnabled || !isActive}
          loop
          playsInline
          preload={isActive ? 'auto' : 'metadata'}
          controls={false}
          onLoadedMetadata={syncVideoProgress}
          onDurationChange={syncVideoProgress}
          onTimeUpdate={syncVideoProgress}
        />
        <div className="absolute inset-x-4 bottom-[84px] z-30">
          <input
            type="range"
            min="0"
            max={videoDuration || 0}
            step="0.01"
            value={Math.min(videoProgress, videoDuration || videoProgress)}
            onChange={seekVideo}
            onClick={stopProgressControl}
            onPointerDown={stopProgressControl}
            onPointerMove={stopProgressControl}
            onTouchStart={stopProgressControl}
            className="abc-video-progress w-full"
            aria-label="Progression video"
            style={{ '--abc-video-progress': `${progressPercent}%` } as React.CSSProperties}
          />
        </div>
      </div>
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
  linkedProduct,
  isOwnContent,
  isFollowed,
  isLiked,
  isActive,
  soundEnabled,
  likeBurstActive,
  isChromeHidden,
  onBuy,
  onOpenProduct,
  onVillage,
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
  linkedProduct?: AfriMarketContent;
  isOwnContent: boolean;
  isFollowed: boolean;
  isLiked: boolean;
  isActive: boolean;
  soundEnabled: boolean;
  likeBurstActive: boolean;
  isChromeHidden: boolean;
  onBuy: () => void;
  onOpenProduct: () => void;
  onVillage: () => void;
  onFollow: () => void;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onToggleSound: () => void;
  onToggleChrome: () => void;
  onVisible: () => void;
}) {
  const itemRef = useRef<HTMLElement | null>(null);
  const clickTimerRef = useRef<number | null>(null);
  const [isPausedByUser, setIsPausedByUser] = useState(false);
  const isVideo = content.media[0]?.resourceType === 'video';
  const hasLinkedProduct = Boolean(content.linkedProductId);
  const productTitle = linkedProduct?.title || content.linkedProductTitle || 'Produit associe';
  const productPrice = getLinkedProductPrice(content, linkedProduct);
  const stopControlClick = (event: React.MouseEvent) => {
    event.stopPropagation();
  };

  const handleContentTap = () => {
    if (!isVideo) {
      onToggleChrome();
      return;
    }

    if (clickTimerRef.current) {
      window.clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      setIsPausedByUser((current) => !current);
      return;
    }

    clickTimerRef.current = window.setTimeout(() => {
      onToggleChrome();
      clickTimerRef.current = null;
    }, 240);
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

  useEffect(() => {
    if (!isActive) {
      setIsPausedByUser(false);
    }
  }, [isActive, content.id]);

  useEffect(() => () => {
    if (clickTimerRef.current) {
      window.clearTimeout(clickTimerRef.current);
    }
  }, []);

  return (
    <article
      ref={itemRef}
      onClick={handleContentTap}
      className="relative flex h-full w-full snap-start items-center justify-center overflow-hidden bg-black"
    >
      <div className="absolute inset-0">
        <FeedMedia content={content} soundEnabled={soundEnabled} isActive={isActive} isPausedByUser={isPausedByUser} />
        {!isChromeHidden && <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/18 to-black" />}
      </div>

      {isPausedByUser && isVideo && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-black/45 text-[#15EA3E] backdrop-blur-md">
            <AfriSellIcon name="play" size={26} />
          </div>
        </div>
      )}

      {!isChromeHidden && (
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-end px-5 pb-[102px] pt-5">
        {isVideo && (
          <div className="pointer-events-auto absolute right-5 top-20">
            <button
              type="button"
              onClick={(event) => {
                stopControlClick(event);
                onToggleSound();
              }}
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur-md transition-colors',
                soundEnabled
                  ? 'border-[#15EA3E]/40 bg-[#15EA3E]/15 text-[#15EA3E]'
                  : 'border-white/10 bg-black/45 text-white/70'
              )}
              aria-label={soundEnabled ? 'Couper le son' : 'Activer le son'}
            >
              <AfriSellIcon name="signal" size={14} />
            </button>
          </div>
        )}

        <div className="mb-0 flex items-end justify-between gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="relative shrink-0">
                <Link
                  to={`/u/${content.authorId}`}
                  onClick={stopControlClick}
                  className="block active:scale-95"
                  aria-label={`Voir le profil de ${content.authorName}`}
                >
                  <CreatorAvatar content={content} />
                </Link>
                {!isOwnContent && (
                  <button
                    type="button"
                    onClick={(event) => {
                      stopControlClick(event);
                      onFollow();
                    }}
                    disabled={isFollowed}
                    className={cn(
                      'pointer-events-auto absolute -right-1.5 top-1/2 flex h-[18px] w-[18px] -translate-y-1/2 items-center justify-center rounded-full border text-[11px] font-black leading-none shadow-[0_0_10px_rgba(0,0,0,0.42)] transition-transform active:scale-90',
                      isFollowed
                        ? 'border-[#15EA3E]/70 bg-[#15EA3E] text-black'
                        : 'border-black/60 bg-white text-black'
                    )}
                    aria-label={isFollowed ? 'Utilisateur suivi' : 'Suivre cet utilisateur'}
                    title={isFollowed ? 'Utilisateur suivi' : 'Suivre'}
                  >
                    +
                  </button>
                )}
              </div>
              <div className="min-w-0">
                <Link
                  to={`/u/${content.authorId}`}
                  onClick={stopControlClick}
                  className="block truncate text-xs font-black uppercase tracking-wider text-gray-200 active:text-[#15EA3E]"
                >
                  @{content.authorName.replace(/\s+/g, '')}
                </Link>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{formatMarketTime(content.createdAt)}</p>
              </div>
            </div>
            <h2 className="mt-1.5 line-clamp-2 text-lg font-black leading-tight text-white">{content.title}</h2>
            <p className="line-clamp-2 max-w-[94%] text-sm font-medium leading-snug text-[#e0e0e0]">{content.description}</p>
            {hasLinkedProduct && (
              <div className="pointer-events-auto mt-1 flex flex-wrap items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wide text-[#15EA3E]">
                  {productTitle}
                </span>
                {productPrice ? (
                  <span className="rounded-full bg-white/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-white/70">
                    {productPrice}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={(event) => {
                    stopControlClick(event);
                    onBuy();
                  }}
                  className="rounded-full bg-[#15EA3E] px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-black active:scale-95"
                >
                  Acheter
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    stopControlClick(event);
                    onOpenProduct();
                  }}
                  className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-white active:scale-95"
                >
                  Details
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    stopControlClick(event);
                    onVillage();
                  }}
                  className="rounded-full border border-[#15EA3E]/25 bg-[#15EA3E]/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-[#15EA3E] active:scale-95"
                >
                  Prix Village
                </button>
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
  onPublished,
  canAssociateProduct,
  marketProducts
}: {
  open: boolean;
  onClose: () => void;
  onPublished: () => void;
  canAssociateProduct: boolean;
  marketProducts: AfriMarketContent[];
}) {
  const { publishContent } = useAfriMarket();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [linkedProductId, setLinkedProductId] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const availableProducts = useMemo(() => marketProducts, [marketProducts]);
  const hasLinkedProduct = Boolean(linkedProductId);

  const fileLabel = useMemo(() => {
    if (!files.length) return 'Video ou photos';
    const hasVideo = files.some((file) => file.type.startsWith('video/'));
    if (hasVideo) return files[0]?.name || '1 video';
    return `${files.length} photo${files.length > 1 ? 's' : ''}`;
  }, [files]);

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
        category: 'Partage',
        files,
        isSellable: hasLinkedProduct,
        linkedProductId
      });
      setTitle('');
      setDescription('');
      setFiles([]);
      setLinkedProductId('');
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

        <div className="rounded-2xl border border-[#15EA3E]/25 bg-[#15EA3E]/10 p-3">
          <div className="flex items-center gap-2 text-[#15EA3E]">
            <AfriSellIcon name="video" size={18} />
            <span className="text-xs font-black uppercase tracking-wider">Contenu ABC</span>
          </div>
          <p className="mt-2 text-[11px] font-semibold leading-relaxed text-white/60">
            Publie comme sur un feed video. Le bouton Acheter apparait seulement si tu associes un produit Market existant.
          </p>
        </div>

        <div className="mt-4 space-y-3">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Titre"
            className="h-12 w-full rounded-2xl border border-gray-800 bg-[#050505] px-4 text-sm font-semibold text-white outline-none focus:border-[#15EA3E]/50"
          />
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Description"
            rows={4}
            className="w-full resize-none rounded-2xl border border-gray-800 bg-[#050505] px-4 py-3 text-sm font-semibold text-white outline-none focus:border-[#15EA3E]/50"
          />
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

          {canAssociateProduct ? (
            <div className="rounded-2xl border border-gray-800 bg-[#050505] p-3">
              <label className="text-[10px] font-black uppercase tracking-[0.18em] text-[#15EA3E]">Associer a un produit Market</label>
              <select
                value={linkedProductId}
                onChange={(event) => setLinkedProductId(event.target.value)}
                className="mt-3 h-12 w-full rounded-2xl border border-gray-800 bg-black px-4 text-sm font-semibold text-white outline-none focus:border-[#15EA3E]/50"
              >
                <option value="">Aucun produit associe</option>
                {availableProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.title} - {formatMarketPrice(product.villagePrice || product.price, product.currency)}
                  </option>
                ))}
              </select>
              {!availableProducts.length && (
                <p className="mt-2 text-[10px] font-semibold leading-relaxed text-gray-500">
                  Aucun produit Market disponible pour l instant. Cree d abord un produit dans Market, puis associe-le a ta video ABC.
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-800 bg-[#050505] p-3 text-[11px] font-semibold leading-relaxed text-gray-500">
              L association a un produit est reservee aux comptes business Market. Active un compte E-commerce dans Profil &gt; Business account.
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
  const { user, profile } = useFirebaseAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    abcContents,
    marketProducts,
    followedAuthors,
    mutualAuthors,
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
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('for-you');
  const [feedStatus, setFeedStatus] = useState('');
  const followedCount = Object.keys(followedAuthors).length;
  const canAssociateProduct = hasMarketBusinessAccount(profile);
  const ownedMarketProducts = useMemo(
    () => marketProducts.filter((product) => product.authorId === user?.uid),
    [marketProducts, user?.uid]
  );
  const marketProductsById = useMemo(
    () => Object.fromEntries(marketProducts.map((product) => [product.id, product])),
    [marketProducts]
  );
  const isPlaybackBlocked = Boolean(isPublishing || commentContent || quickPanel);
  const postIdFromUrl = new URLSearchParams(location.search).get('post') || '';

  const filteredContents = useMemo(() => {
    const nextContents = abcContents.filter((content) => {
      if (feedFilter === 'live') return Boolean(content.isLive || content.liveStatus === 'live');
      if (feedFilter === 'paid') return Boolean(content.linkedProductId);
      if (feedFilter === 'following' || feedFilter === 'friends') {
        return feedFilter === 'friends'
          ? Boolean(mutualAuthors[content.authorId])
          : Boolean(followedAuthors[content.authorId]);
      }
      return true;
    });

    if (!postIdFromUrl) return nextContents;

    const sharedPost = nextContents.find((content) => content.id === postIdFromUrl);
    if (!sharedPost) return nextContents;
    return [sharedPost, ...nextContents.filter((content) => content.id !== postIdFromUrl)];
  }, [abcContents, feedFilter, followedAuthors, mutualAuthors, postIdFromUrl]);

  useEffect(() => {
    const wantsPublish = new URLSearchParams(location.search).get('publish') === '1';
    if (!wantsPublish) return;
    if (!user) {
      navigate('/login', { replace: true, state: { next: '/feed?publish=1' } });
      return;
    }
    setIsPublishing(true);
  }, [location.search, navigate, user]);

  useEffect(() => {
    window.localStorage.setItem(ABC_SOUND_PREF_KEY, isSoundEnabled ? '1' : '0');
  }, [isSoundEnabled]);

  useEffect(() => {
    if (!feedStatus) return undefined;
    const timer = window.setTimeout(() => setFeedStatus(''), 3200);
    return () => window.clearTimeout(timer);
  }, [feedStatus]);

  useEffect(() => {
    if (!filteredContents.length) {
      setActiveContentId('');
      return;
    }

    setActiveContentId((current) => (
      current && filteredContents.some((content) => content.id === current)
        ? current
        : filteredContents[0].id
    ));
  }, [filteredContents]);

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

  const handleVillageShare = async (content: AfriMarketContent) => {
    if (!user) {
      navigate('/login', { state: { next: `/feed?post=${content.id}` } });
      return;
    }
    if (!content.linkedProductId) return;
    const linkedProduct = content.linkedProductId ? marketProductsById[content.linkedProductId] : undefined;
    const product = linkedProduct || content;

    setFeedStatus('');
    try {
      await shareVillageDealToAfriChat({
        user,
        profile,
        product: toCheckoutProduct(product)
      });
      setFeedStatus('Prix Village partage dans AfriChat.');
      navigate(`/chat?contact=${encodeURIComponent(content.authorId)}&name=${encodeURIComponent(content.authorName)}&status=${encodeURIComponent('Prix Village')}&avatar=${encodeURIComponent(content.authorAvatar || '')}`);
    } catch (shareError) {
      setFeedStatus(shareError instanceof Error ? shareError.message : 'Partage Prix Village impossible.');
    }
  };

  const handleLike = async (content: AfriMarketContent) => {
    const isAlreadyLiked = Boolean(likedContents[content.id]);
    if (!isAlreadyLiked) {
      setLikeBurstContentId(content.id);
      window.setTimeout(() => {
        setLikeBurstContentId((current) => current === content.id ? '' : current);
      }, 1350);

      if (content.linkedProductId) {
        const linkedProduct = content.linkedProductId ? marketProductsById[content.linkedProductId] : undefined;
        if (linkedProduct) {
          addToCart(toCheckoutProduct(linkedProduct));
        }
      }
    }

    await toggleLike(content);
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {!isFeedChromeHidden && (
      <div className="pointer-events-auto absolute inset-x-0 top-0 z-30 px-3 pt-5">
          <div className="flex items-center justify-between gap-1 rounded-2xl border border-white/10 bg-black/76 p-1.5 shadow-[0_10px_24px_rgba(0,0,0,0.3)] backdrop-blur-md">
            {[
              { id: 'live' as FeedFilter, label: 'Live' },
              { id: 'for-you' as FeedFilter, label: 'Pour moi' },
              { id: 'following' as FeedFilter, label: 'Suivi' },
              { id: 'paid' as FeedFilter, label: 'Payant' },
              { id: 'friends' as FeedFilter, label: 'Amis' }
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFeedFilter(item.id)}
                className={cn(
                  'h-8 min-w-0 shrink rounded-xl px-2 text-[9px] font-black transition-colors',
                  feedFilter === item.id
                    ? 'bg-[#15EA3E] text-black'
                    : 'text-white/62'
                )}
              >
                {item.label}
              </button>
            ))}
          <button
            type="button"
            onClick={() => {
              if (!user) {
                navigate('/login', { state: { next: '/feed' } });
                return;
              }
              setFeedStatus('Aucune nouvelle notification pour le moment.');
            }}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[#15EA3E] transition-colors active:bg-white/10"
            aria-label="Notifications"
          >
            <AfriSellIcon name="notifications" size={17} />
          </button>
          </div>
      </div>
      )}

      {error && (
        <div className="absolute left-4 right-4 top-20 z-20 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-xs font-semibold text-red-200">
          {error}
        </div>
      )}

      {feedStatus && (
        <div className={cn(
          'absolute left-4 right-4 top-20 z-20 rounded-2xl border p-3 text-xs font-semibold',
          feedStatus.includes('impossible') || feedStatus.includes('introuvable') || feedStatus.includes('pas encore disponible')
            ? 'border-red-500/20 bg-red-500/10 text-red-200'
            : 'border-[#15EA3E]/25 bg-[#15EA3E]/10 text-[#15EA3E]'
        )}>
          {feedStatus}
        </div>
      )}

      {loading ? (
        <div className="flex h-full flex-col items-center justify-center px-10 text-center">
          <AfriSellIcon name="video" size={42} className="text-[#15EA3E]" />
          <p className="mt-4 text-sm font-black uppercase tracking-wide text-white">Chargement ABC</p>
        </div>
      ) : filteredContents.length ? (
        <div className="h-full w-full snap-y snap-mandatory overflow-y-scroll scrollbar-hide">
          {filteredContents.map((content) => {
            const linkedProduct = content.linkedProductId ? marketProductsById[content.linkedProductId] : undefined;
            const productRoute = content.linkedProductId || linkedProduct ? `/market/${content.linkedProductId || linkedProduct?.id}` : `/market/${content.id}`;

            return (
            <FeedItem
              key={content.id}
              content={content}
              linkedProduct={linkedProduct}
              isOwnContent={content.authorId === user?.uid}
              isFollowed={Boolean(followedAuthors[content.authorId])}
              isLiked={Boolean(likedContents[content.id])}
              isActive={!isPlaybackBlocked && activeContentId === content.id}
              soundEnabled={isSoundEnabled}
              likeBurstActive={likeBurstContentId === content.id}
              isChromeHidden={isFeedChromeHidden}
              onBuy={() => {
                const product = linkedProduct || (!content.linkedProductId ? content : null);
                if (product) {
                  openCheckout(toCheckoutProduct(product));
                } else {
                  navigate(productRoute);
                }
              }}
              onOpenProduct={() => navigate(productRoute)}
              onVillage={() => handleVillageShare(content)}
              onFollow={() => followAuthor(content)}
              onLike={() => handleLike(content)}
              onComment={() => setCommentContent(content)}
              onShare={() => handleShare(content)}
              onToggleSound={() => setIsSoundEnabled((current) => !current)}
              onToggleChrome={() => setIsFeedChromeHidden((current) => !current)}
              onVisible={() => setActiveContentId(content.id)}
            />
            );
          })}
        </div>
      ) : (
        <div className="flex h-full flex-col items-center justify-center px-10 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-gray-800 bg-[#050505] text-[#15EA3E]">
            <AfriSellIcon name="video" size={28} />
          </div>
          <h2 className="mt-5 text-lg font-black text-white">{feedFilter === 'live' ? 'Aucun live pour le moment' : 'Aucune publication'}</h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-500">
            {feedFilter === 'live'
              ? 'Les directs ABC seront disponibles dans une prochaine version.'
              : abcContents.length ? 'Aucune publication dans ce filtre.' : 'Ajoute une video ou plusieurs photos.'}
          </p>
          <button
            type="button"
            onClick={() => {
              if (feedFilter === 'live') {
                setFeedStatus('La fonctionnalite Live ABC n est pas encore disponible.');
                return;
              }
              if (!user) {
                navigate('/login', { state: { next: '/feed?publish=1' } });
                return;
              }
              setIsPublishing(true);
            }}
            className="mt-5 rounded-2xl bg-[#15EA3E] px-5 py-3 text-xs font-black uppercase tracking-widest text-black"
          >
            {feedFilter === 'live' ? 'Lancer un live' : 'Publier'}
          </button>
        </div>
      )}

      <PublishPanel
        open={isPublishing}
        onClose={() => setIsPublishing(false)}
        onPublished={() => undefined}
        canAssociateProduct={canAssociateProduct}
        marketProducts={ownedMarketProducts}
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
