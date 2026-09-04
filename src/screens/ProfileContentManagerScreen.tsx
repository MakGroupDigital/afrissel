import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ref, update } from 'firebase/database';
import { AfriZiaIcon } from '../components/AfriZiaIcon';
import { AfriMarketContent, formatMarketPrice, formatMarketTime, useAfriMarket } from '../hooks/useAfriMarket';
import { useFirebaseAuth } from '../hooks/useFirebaseAuth';
import { realtimeDb } from '../lib/firebase';
import { cn } from '../lib/utils';

type ManagerKind = 'contents' | 'storefronts';

const getStats = (item: AfriMarketContent) => [
  { label: 'Likes', value: item.likesCount || 0 },
  { label: 'Commentaires', value: item.commentsCount || 0 },
  { label: 'Partages', value: item.sharesCount || 0 },
  { label: item.isSellable ? 'Acheteurs' : 'Abonnés', value: item.isSellable ? item.buyersCount || 0 : item.followsCount || 0 }
];

export default function ProfileContentManagerScreen({ kind }: { kind: ManagerKind }) {
  const navigate = useNavigate();
  const { user } = useFirebaseAuth();
  const { abcContents, marketProducts, loading } = useAfriMarket();
  const [selectedItem, setSelectedItem] = useState<AfriMarketContent | null>(null);
  const [status, setStatus] = useState('');
  const isStorefront = kind === 'storefronts';

  const items = useMemo(
    () => (isStorefront ? marketProducts : abcContents).filter((item) => item.authorId === user?.uid),
    [abcContents, isStorefront, marketProducts, user?.uid]
  );

  const updateItem = async (item: AfriMarketContent, patch: Partial<AfriMarketContent>, message: string) => {
    const updates: Record<string, unknown> = {
      [`abcPosts/${item.id}`]: {
        ...item,
        ...patch,
        updatedAt: Date.now()
      }
    };

    if (item.isSellable || isStorefront) {
      updates[`marketProducts/${item.id}`] = {
        ...item,
        ...patch,
        updatedAt: Date.now()
      };
    }

    await update(ref(realtimeDb), updates);
    setSelectedItem((current) => current?.id === item.id ? { ...current, ...patch } : current);
    setStatus(message);
  };

  const editItem = async (item: AfriMarketContent) => {
    const title = window.prompt('Titre', item.title)?.trim();
    if (!title) return;
    const description = window.prompt('Description', item.description)?.trim() ?? item.description;
    await updateItem(item, { title, description }, 'Mise à jour enregistrée.');
  };

  const shareItem = async (item: AfriMarketContent) => {
    const path = isStorefront || item.isSellable ? `/market/${item.id}` : `/feed?post=${item.id}`;
    const url = `${window.location.origin}${path}`;
    const text = `${item.title} - AfriZia`;
    try {
      if (navigator.share) {
        await navigator.share({ title: item.title, text, url });
      } else {
        await navigator.clipboard?.writeText(url);
        setStatus('Lien copié.');
      }
    } catch {
      setStatus('Partage annulé.');
    }
  };

  const deleteItem = async (item: AfriMarketContent) => {
    if (!window.confirm(`Supprimer "${item.title}" ?`)) return;
    await updateItem(item, { status: 'deleted' }, 'Élément supprimé.');
    setSelectedItem(null);
  };

  const sponsorItem = async (item: AfriMarketContent) => {
    await updateItem(item, { status: 'sponsored_pending' }, 'Demande de sponsoring envoyée.');
  };

  const openRoute = (item: AfriMarketContent) => {
    navigate(isStorefront || item.isSellable ? `/market/${item.id}` : `/feed?post=${item.id}`);
  };

  return (
    <main className="flex h-full flex-col overflow-hidden bg-black text-white">
      <header className="shrink-0 px-4 pb-3 pt-4">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => navigate('/profile')} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/70">
            <AfriZiaIcon name="arrow" size={18} className="rotate-180" />
          </button>
          <div className="text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">{isStorefront ? 'Vitrines' : 'Contenus'}</p>
            <h1 className="mt-1 text-lg font-black">{isStorefront ? 'Mes vitrines' : 'Mes contenus'}</h1>
          </div>
          <Link to="/create" className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#15EA3E] text-black">
            <AfriZiaIcon name="plus" size={18} />
          </Link>
        </div>
      </header>

      <section className="shrink-0 px-4 pb-3">
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Total', value: items.length },
            { label: 'Likes', value: items.reduce((total, item) => total + (item.likesCount || 0), 0) },
            { label: 'Partages', value: items.reduce((total, item) => total + (item.sharesCount || 0), 0) },
            { label: 'Ventes', value: items.reduce((total, item) => total + (item.buyersCount || 0), 0) }
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/[0.04] px-2 py-3 text-center">
              <p className="text-sm font-black text-white">{stat.value}</p>
              <p className="mt-0.5 text-[8px] font-black uppercase tracking-wider text-white/38">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {status && (
        <p className="mx-4 mb-3 rounded-2xl border border-[#15EA3E]/20 bg-[#15EA3E]/10 px-3 py-2 text-[10px] font-bold text-[#15EA3E]">
          {status}
        </p>
      )}

      <section className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 scrollbar-hide">
        {loading && !items.length ? (
          <div className="flex h-full items-center justify-center text-sm font-bold text-white/45">Chargement...</div>
        ) : items.length ? (
          <div className="grid grid-cols-3 gap-1.5">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedItem(item)}
                className="group relative aspect-square overflow-hidden rounded-xl bg-white/[0.04] text-left"
              >
                {item.coverURL ? (
                  <img src={item.coverURL} alt={item.title} className="h-full w-full object-cover transition-transform duration-300 group-active:scale-105" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[#071007] text-[#15EA3E]">
                    <AfriZiaIcon name={item.format === 'video' ? 'video' : 'market'} size={22} />
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/82 to-transparent p-2">
                  <p className="line-clamp-1 text-[9px] font-black text-white">{item.title}</p>
                </div>
                {item.status === 'sponsored_pending' && (
                  <span className="absolute right-1.5 top-1.5 rounded-full bg-[#15EA3E] px-1.5 py-0.5 text-[7px] font-black text-black">Sponsor</span>
                )}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center px-8 text-center">
            <AfriZiaIcon name={isStorefront ? 'market' : 'video'} size={34} className="text-white/22" />
            <h2 className="mt-4 text-xl font-black">{isStorefront ? 'Aucune vitrine' : 'Aucun contenu'}</h2>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-white/45">
              {isStorefront ? 'Tes produits et services apparaîtront ici.' : 'Tes vidéos, photos et publications apparaîtront ici.'}
            </p>
            <Link to="/create" className="mt-5 rounded-2xl bg-[#15EA3E] px-5 py-3 text-xs font-black uppercase tracking-widest text-black">
              Créer
            </Link>
          </div>
        )}
      </section>

      {selectedItem && (
        <div className="absolute inset-0 z-50 flex flex-col bg-black">
          <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 pt-4">
            <button type="button" onClick={() => setSelectedItem(null)} className="flex h-10 w-10 items-center justify-center rounded-2xl bg-black/55 text-white backdrop-blur-xl">
              <AfriZiaIcon name="close" size={18} />
            </button>
            <button type="button" onClick={() => openRoute(selectedItem)} className="rounded-2xl bg-white/12 px-4 py-3 text-[10px] font-black uppercase tracking-wider text-white backdrop-blur-xl">
              Voir
            </button>
          </header>

          <div className="relative min-h-0 flex-1">
            {selectedItem.coverURL ? (
              <img src={selectedItem.coverURL} alt={selectedItem.title} className="h-full w-full object-contain" />
            ) : (
              <div className="flex h-full items-center justify-center text-[#15EA3E]">
                <AfriZiaIcon name={selectedItem.format === 'video' ? 'video' : 'market'} size={48} />
              </div>
            )}
          </div>

          <section className="shrink-0 border-t border-white/10 bg-black/92 px-4 pb-5 pt-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#15EA3E]">{selectedItem.category} - {formatMarketTime(selectedItem.createdAt)}</p>
                <h2 className="mt-1 text-lg font-black leading-tight">{selectedItem.title}</h2>
                <p className="mt-1 line-clamp-2 text-xs font-semibold leading-relaxed text-white/52">{selectedItem.description}</p>
                {selectedItem.isSellable && (
                  <p className="mt-2 text-sm font-black text-[#15EA3E]">{formatMarketPrice(selectedItem.price || selectedItem.villagePrice, selectedItem.currency)}</p>
                )}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-4 gap-2">
              {getStats(selectedItem).map((stat) => (
                <div key={stat.label} className="rounded-xl border border-white/10 bg-white/[0.04] px-2 py-2 text-center">
                  <p className="text-xs font-black">{stat.value}</p>
                  <p className="mt-0.5 truncate text-[7px] font-black uppercase tracking-wider text-white/34">{stat.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-5 gap-2">
              {[
                { label: 'Modifier', icon: 'edit' as const, action: () => editItem(selectedItem) },
                { label: 'Partager', icon: 'share' as const, action: () => shareItem(selectedItem) },
                { label: 'Sponsor', icon: 'flash' as const, action: () => sponsorItem(selectedItem) },
                { label: 'Ouvrir', icon: 'arrow' as const, action: () => openRoute(selectedItem) },
                { label: 'Supprimer', icon: 'close' as const, action: () => deleteItem(selectedItem), danger: true }
              ].map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => void action.action()}
                  className={cn(
                    'flex min-w-0 flex-col items-center gap-1 rounded-2xl border py-2 text-[7px] font-black uppercase tracking-wider active:scale-95',
                    action.danger ? 'border-red-500/24 bg-red-500/10 text-red-100' : 'border-white/10 bg-white/[0.055] text-[#15EA3E]'
                  )}
                >
                  <AfriZiaIcon name={action.icon} size={14} />
                  <span className="max-w-full truncate">{action.label}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
