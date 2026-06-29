import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { off, onValue, push, ref, set } from 'firebase/database';
import { AfriSellIcon } from '../components/AfriSellIcon';
import { AfriSellUserProfile } from '../hooks/useFirebaseAuth';
import { useFirebaseAuth } from '../hooks/useFirebaseAuth';
import { formatMarketPrice, useAfriMarket } from '../hooks/useAfriMarket';
import { realtimeDb } from '../lib/firebase';

type ProfileReview = {
  id?: string;
  authorId: string;
  authorName: string;
  rating: number;
  text: string;
  createdAt: number;
};

const getBusinessAccounts = (profile?: AfriSellUserProfile | null) => [
  profile?.businessAccount,
  ...Object.values(profile?.businessAccounts || {})
].filter((account): account is NonNullable<AfriSellUserProfile['businessAccount']> => Boolean(account?.categoryId));

export default function PublicProfileScreen() {
  const { userId = '' } = useParams();
  const navigate = useNavigate();
  const { abcContents, marketProducts, followedAuthors, followAuthor } = useAfriMarket();
  const { user, profile } = useFirebaseAuth();
  const [publicProfile, setPublicProfile] = useState<AfriSellUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<ProfileReview[]>([]);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [reviewStatus, setReviewStatus] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  useEffect(() => {
    if (!userId) return undefined;

    const profileRef = ref(realtimeDb, `users/${userId}`);
    const unsubscribe = onValue(profileRef, (snapshot) => {
      setPublicProfile(snapshot.exists() ? snapshot.val() as AfriSellUserProfile : null);
      setLoading(false);
    }, () => {
      setPublicProfile(null);
      setLoading(false);
    });

    return () => {
      unsubscribe();
      off(profileRef);
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return undefined;

    const reviewsRef = ref(realtimeDb, `profileReviews/${userId}`);
    const unsubscribe = onValue(reviewsRef, (snapshot) => {
      const data = snapshot.val() as Record<string, ProfileReview> | null;
      const nextReviews = Object.entries(data || {})
        .map(([id, review]) => ({ ...review, id }))
        .sort((first, second) => Number(second.createdAt || 0) - Number(first.createdAt || 0));
      setReviews(nextReviews);
    });

    return unsubscribe;
  }, [userId]);

  const authorContents = useMemo(
    () => abcContents.filter((content) => content.authorId === userId).slice(0, 8),
    [abcContents, userId]
  );
  const authorProducts = useMemo(
    () => marketProducts.filter((product) => product.authorId === userId).slice(0, 6),
    [marketProducts, userId]
  );
  const businessAccounts = getBusinessAccounts(publicProfile);
  const mainBusiness = businessAccounts[0];
  const displayName = publicProfile?.businessName || publicProfile?.displayName || 'Profil AfriSell';
  const avatar = publicProfile?.logoURL || publicProfile?.photoURL || '';
  const coverImage = publicProfile?.mediaURL || authorContents[0]?.coverURL || authorProducts[0]?.coverURL || avatar || '/biashara.jpeg';
  const profileRole = mainBusiness?.moduleName || mainBusiness?.categoryLabel || publicProfile?.primaryRole || 'AfriSell';
  const profileHeadline = publicProfile?.bio || mainBusiness?.serviceLabel || 'Membre de l ecosysteme AfriSell.';
  const profileLocation = [publicProfile?.city, publicProfile?.country].filter(Boolean).join(', ');
  const isFollowed = Boolean(followedAuthors[userId]);
  const followSample = authorContents[0] || authorProducts[0];
  const reviewAverage = reviews.length
    ? reviews.reduce((total, review) => total + Number(review.rating || 0), 0) / reviews.length
    : 0;
  const userReview = user ? reviews.find((review) => review.authorId === user.uid) : undefined;

  const submitReview = async (event: FormEvent) => {
    event.preventDefault();
    if (!userId) return;
    if (!user) {
      navigate('/login', { state: { next: `/u/${userId}` } });
      return;
    }
    if (user.uid === userId) {
      setReviewStatus('Tu ne peux pas noter ton propre profil.');
      return;
    }

    const text = reviewText.trim();
    if (!text) {
      setReviewStatus('Ajoute un avis avant de publier.');
      return;
    }

    setReviewSubmitting(true);
    setReviewStatus('');
    try {
      const reviewRef = push(ref(realtimeDb, `profileReviews/${userId}`));
      await set(reviewRef, {
        id: reviewRef.key,
        authorId: user.uid,
        authorName: profile?.displayName || user.displayName || 'Utilisateur AfriSell',
        rating: reviewRating,
        text,
        createdAt: Date.now()
      });
      setReviewText('');
      setReviewRating(5);
      setReviewStatus('Avis publie.');
    } catch {
      setReviewStatus('Avis impossible pour le moment.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  return (
    <main className="flex h-full flex-col overflow-hidden bg-black text-white">
      <header className="shrink-0 px-4 pb-3 pt-5">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => navigate(-1)} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white">
            <AfriSellIcon name="arrow" size={17} className="rotate-180" />
          </button>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">Profil public</p>
          <Link to="/chat" className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-[#15EA3E]">
            <AfriSellIcon name="chat" size={17} />
          </Link>
        </div>
      </header>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <AfriSellIcon name="profile" size={34} className="text-[#15EA3E]" />
        </div>
      ) : !publicProfile ? (
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <AfriSellIcon name="profile" size={34} className="text-white/20" />
          <h1 className="mt-4 text-xl font-black">Profil introuvable</h1>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-white/45">Cet utilisateur n est pas encore visible publiquement.</p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto pb-8 scrollbar-hide">
          <section className="relative overflow-hidden border-b border-white/10 bg-[#050805]">
            <div className="relative h-44">
              <img src={coverImage} alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.82))]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_10%,rgba(21,234,62,0.34),transparent_34%)]" />
            </div>

            <div className="relative -mt-14 px-4 pb-4">
              <div className="flex items-end justify-between gap-3">
                <div className="h-28 w-28 overflow-hidden rounded-[2rem] border-4 border-black bg-[#071007] shadow-[0_18px_40px_rgba(0,0,0,0.55)]">
                  {avatar ? (
                    <img src={avatar} alt={displayName} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-4xl font-black text-[#15EA3E]">
                      {displayName.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="mb-2 flex items-center gap-2">
                  <Link
                    to={`/chat?contact=${encodeURIComponent(userId)}&name=${encodeURIComponent(displayName)}&avatar=${encodeURIComponent(avatar)}`}
                    className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#15EA3E] text-black shadow-[0_10px_24px_rgba(21,234,62,0.28)]"
                    aria-label="Envoyer un message"
                  >
                    <AfriSellIcon name="chat" size={18} />
                  </Link>
                  <button
                    type="button"
                    disabled={!followSample || isFollowed}
                    onClick={() => followSample && void followAuthor(followSample)}
                    className="flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.08] px-4 text-[10px] font-black uppercase tracking-widest text-white disabled:text-[#15EA3E]"
                  >
                    {isFollowed ? 'Suivi' : 'Suivre'}
                  </button>
                </div>
              </div>

              <div className="mt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#15EA3E] px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-black">
                    {profileRole}
                  </span>
                  {mainBusiness?.status && (
                    <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-white/62">
                      {mainBusiness.status}
                    </span>
                  )}
                </div>
                <h1 className="mt-2 text-[1.9rem] font-black leading-none text-white">{displayName}</h1>
                <p className="mt-2 max-w-[94%] text-sm font-semibold leading-relaxed text-white/60">{profileHeadline}</p>
                {profileLocation && (
                  <p className="mt-2 text-[11px] font-black uppercase tracking-wider text-[#15EA3E]">{profileLocation}</p>
                )}
              </div>

              <div className="mt-4 grid grid-cols-4 gap-2">
                {[
                  { value: authorContents.length, label: 'ABC' },
                  { value: authorProducts.length, label: 'Market' },
                  { value: businessAccounts.length, label: 'Apps' },
                  { value: reviews.length ? reviewAverage.toFixed(1) : '0.0', label: 'Note' }
                ].map((stat) => (
                  <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/[0.055] px-2 py-3 text-center">
                    <p className="text-base font-black text-white">{stat.value}</p>
                    <p className="mt-0.5 text-[8px] font-black uppercase tracking-wider text-white/38">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className="px-4">
            <section className="mt-4 overflow-hidden rounded-[1.5rem] border border-[#FFD84D]/18 bg-[#100F08]">
              <div className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FFD84D]">Reputation</p>
                  <div className="mt-2 flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <span key={rating} className="flex">
                        <AfriSellIcon
                          name="star"
                          size={15}
                          className={rating <= Math.round(reviewAverage) ? 'fill-current text-[#FFD84D]' : 'text-white/22'}
                        />
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-[#FFD84D]">{reviews.length ? reviewAverage.toFixed(1) : '0.0'}</p>
                  <p className="text-[9px] font-black uppercase tracking-wider text-white/40">
                    {reviews.length} avis
                  </p>
                </div>
              </div>
            </section>

          {businessAccounts.length > 0 && (
            <section className="mt-5">
              <h2 className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-white/52">Comptes business</h2>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {businessAccounts.map((account) => (
                  <div key={`${account.categoryId}-${account.serviceId}-${account.segmentId}`} className="w-[190px] shrink-0 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                    <p className="truncate text-sm font-black">{account.categoryLabel}</p>
                    <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-relaxed text-white/45">
                      {account.serviceLabel} - {account.segmentLabel}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="mt-5 rounded-[1.45rem] border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/52">Notes et avis</h2>
                <p className="mt-1 text-[11px] font-semibold text-white/45">
                  {userReview ? 'Tu as deja laisse un avis sur ce profil.' : 'Note ce freelance, fournisseur ou partenaire.'}
                </p>
              </div>
              <div className="rounded-2xl bg-[#FFD84D]/12 px-3 py-2 text-right">
                <p className="text-sm font-black text-[#FFD84D]">{reviews.length ? reviewAverage.toFixed(1) : '0.0'}</p>
                <p className="text-[9px] font-black uppercase tracking-wider text-white/40">{reviews.length} avis</p>
              </div>
            </div>

            <form onSubmit={submitReview} className="mt-4 space-y-3">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => setReviewRating(rating)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.04] active:scale-[0.94]"
                    aria-label={`Noter ${rating}`}
                  >
                    <AfriSellIcon
                      name="star"
                      size={16}
                      className={rating <= reviewRating ? 'fill-current text-[#FFD84D]' : 'text-white/25'}
                    />
                  </button>
                ))}
              </div>
              <textarea
                value={reviewText}
                onChange={(event) => setReviewText(event.target.value)}
                rows={3}
                placeholder="Laisse un avis public..."
                className="w-full resize-none rounded-2xl border border-white/10 bg-black/24 px-3 py-3 text-xs font-semibold text-white outline-none placeholder:text-white/28 focus:border-[#15EA3E]/50"
              />
              <button
                type="submit"
                disabled={reviewSubmitting}
                className="w-full rounded-2xl bg-[#15EA3E] py-3 text-xs font-black uppercase tracking-widest text-black disabled:opacity-55"
              >
                {reviewSubmitting ? 'Publication...' : 'Publier l avis'}
              </button>
              {reviewStatus && (
                <p className="rounded-2xl bg-[#15EA3E]/10 px-3 py-2 text-center text-[10px] font-black uppercase tracking-wider text-[#15EA3E]">
                  {reviewStatus}
                </p>
              )}
            </form>

            {reviews.length > 0 && (
              <div className="mt-4 space-y-2">
                {reviews.slice(0, 5).map((review) => (
                  <article key={review.id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-black">{review.authorName}</p>
                      <span className="flex items-center gap-1 text-[10px] font-black text-[#FFD84D]">
                        <AfriSellIcon name="star" size={12} className="fill-current" />
                        {review.rating}
                      </span>
                    </div>
                    <p className="mt-2 text-[11px] font-semibold leading-relaxed text-white/52">{review.text}</p>
                  </article>
                ))}
              </div>
            )}
          </section>

          {authorProducts.length > 0 && (
            <section className="mt-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/52">Produits Market</h2>
                <Link to={`/market/stand/${userId}`} className="text-[10px] font-black text-[#15EA3E]">Stand</Link>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {authorProducts.map((product) => (
                  <Link key={product.id} to={`/market/${product.id}`} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
                    <img src={product.coverURL || '/afrimarket.jpeg'} alt={product.title} className="h-24 w-full object-cover" />
                    <div className="p-3">
                      <p className="truncate text-xs font-black">{product.title}</p>
                      <p className="mt-1 text-[10px] font-black text-[#15EA3E]">{formatMarketPrice(product.villagePrice || product.price, product.currency)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {authorContents.length > 0 && (
            <section className="mt-5">
              <h2 className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-white/52">Publications ABC</h2>
              <div className="grid grid-cols-2 gap-3">
                {authorContents.map((content) => (
                  <Link key={content.id} to={`/feed?post=${content.id}`} className="relative h-44 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
                    <img src={content.coverURL || '/biashara.jpeg'} alt={content.title} className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_38%,rgba(0,0,0,0.9))]" />
                    <div className="absolute inset-x-0 bottom-0 p-3">
                      <p className="line-clamp-2 text-xs font-black">{content.title}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
          </div>
        </div>
      )}
    </main>
  );
}
