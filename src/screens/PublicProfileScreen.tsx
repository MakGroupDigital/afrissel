import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { off, onValue, ref } from 'firebase/database';
import { AfriSellIcon } from '../components/AfriSellIcon';
import { AfriSellUserProfile } from '../hooks/useFirebaseAuth';
import { formatMarketPrice, useAfriMarket } from '../hooks/useAfriMarket';
import { realtimeDb } from '../lib/firebase';

const getBusinessAccounts = (profile?: AfriSellUserProfile | null) => [
  profile?.businessAccount,
  ...Object.values(profile?.businessAccounts || {})
].filter((account): account is NonNullable<AfriSellUserProfile['businessAccount']> => Boolean(account?.categoryId));

export default function PublicProfileScreen() {
  const { userId = '' } = useParams();
  const navigate = useNavigate();
  const { abcContents, marketProducts, followedAuthors, followAuthor } = useAfriMarket();
  const [publicProfile, setPublicProfile] = useState<AfriSellUserProfile | null>(null);
  const [loading, setLoading] = useState(true);

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
  const isFollowed = Boolean(followedAuthors[userId]);
  const followSample = authorContents[0] || authorProducts[0];

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
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 scrollbar-hide">
          <section className="relative overflow-hidden rounded-[1.7rem] border border-[#15EA3E]/20 bg-[#071007] p-4">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_12%,rgba(21,234,62,0.22),transparent_34%)]" />
            <div className="relative">
              <div className="flex items-start gap-3">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-[1.45rem] border border-[#15EA3E]/30 bg-black">
                  {avatar ? (
                    <img src={avatar} alt={displayName} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl font-black text-[#15EA3E]">
                      {displayName.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#15EA3E]">
                    {mainBusiness?.moduleName || publicProfile.primaryRole || 'AfriSell'}
                  </p>
                  <h1 className="mt-1 line-clamp-2 text-2xl font-black leading-tight">{displayName}</h1>
                  <p className="mt-2 line-clamp-2 text-xs font-semibold leading-relaxed text-white/52">
                    {publicProfile.bio || mainBusiness?.serviceLabel || 'Membre de l ecosysteme AfriSell.'}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3">
                  <p className="text-lg font-black">{authorContents.length}</p>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-white/42">ABC</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3">
                  <p className="text-lg font-black">{authorProducts.length}</p>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-white/42">Market</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3">
                  <p className="text-lg font-black">{businessAccounts.length}</p>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-white/42">Comptes</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={!followSample || isFollowed}
                  onClick={() => followSample && void followAuthor(followSample)}
                  className="rounded-2xl bg-[#15EA3E] py-3 text-xs font-black uppercase tracking-widest text-black disabled:bg-[#15EA3E]/18 disabled:text-[#15EA3E]"
                >
                  {isFollowed ? 'Suivi' : 'Suivre'}
                </button>
                <Link to={`/chat?contact=${encodeURIComponent(userId)}&name=${encodeURIComponent(displayName)}&avatar=${encodeURIComponent(avatar)}`} className="rounded-2xl border border-white/10 bg-white/[0.06] py-3 text-center text-xs font-black uppercase tracking-widest text-white">
                  Message
                </Link>
              </div>
            </div>
          </section>

          {businessAccounts.length > 0 && (
            <section className="mt-5">
              <h2 className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-white/52">Comptes business</h2>
              <div className="space-y-2">
                {businessAccounts.map((account) => (
                  <div key={`${account.categoryId}-${account.serviceId}-${account.segmentId}`} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                    <p className="text-sm font-black">{account.categoryLabel}</p>
                    <p className="mt-1 text-[11px] font-semibold leading-relaxed text-white/45">
                      {account.serviceLabel} - {account.segmentLabel}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

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
      )}
    </main>
  );
}
