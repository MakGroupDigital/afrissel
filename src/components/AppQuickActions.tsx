import { FormEvent, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AfriSellIcon, AfriSellIconName } from './AfriSellIcon';
import { useFirebaseAuth } from '../hooks/useFirebaseAuth';
import { cn } from '../lib/utils';

type Shortcut = {
  label: string;
  route: string;
  icon: AfriSellIconName;
  description: string;
};

const hiddenPrefixes = ['/', '/onboarding', '/login', '/account-setup', '/create', '/scan'];

const shortcuts: Shortcut[] = [
  { label: 'Accueil', route: '/ecosystem', icon: 'home', description: 'Retour à la super app' },
  { label: 'Découvrir', route: '/feed', icon: 'video', description: 'ABC, vidéos et contenus' },
  { label: 'Marché', route: '/market', icon: 'market', description: 'Produits, stands et Prix Village' },
  { label: 'Messages', route: '/chat', icon: 'chat', description: 'AfriChat, stories et villages' },
  { label: 'AfriSpay', route: '/wallet', icon: 'pay', description: 'Wallet, paiement et reçus' },
  { label: 'Safari', route: '/safari', icon: 'send', description: 'Livraison, mobilité, immo' },
  { label: 'Zandofy', route: '/zandofy', icon: 'app', description: 'Marketplace boutique dédiée' },
  { label: 'AfriAI', route: '/afriai/talk', icon: 'flash', description: 'Assistant intelligent' },
  { label: 'Nos apps', route: '/apps', icon: 'hub', description: 'Tout l’écosystème' },
  { label: 'Profil', route: '/profile', icon: 'profile', description: 'Compte, business et réglages' }
];

const modulePrefixes = [
  '/ecosystem',
  '/feed',
  '/market',
  '/wallet',
  '/chat',
  '/profile',
  '/u/',
  '/apps',
  '/safari',
  '/school',
  '/med',
  '/freelance',
  '/biashara',
  '/afriai',
  '/fpp',
  '/zandofy',
  '/business'
];

const shouldShowQuickActions = (pathname: string) => {
  if (hiddenPrefixes.includes(pathname)) return false;
  return modulePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`) || pathname.startsWith(prefix));
};

export default function AppQuickActions() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useFirebaseAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  const visible = shouldShowQuickActions(location.pathname);
  const isOwnProfile = location.pathname === '/profile';
  const isProfilePage = isOwnProfile || location.pathname.startsWith('/u/');
  const canEdit = isOwnProfile || !location.pathname.startsWith('/u/');

  const activeShortcut = useMemo(
    () => shortcuts.find((shortcut) => location.pathname === shortcut.route || location.pathname.startsWith(`${shortcut.route}/`)),
    [location.pathname]
  );

  if (!visible) return null;

  const go = (route: string) => {
    setMenuOpen(false);
    setSearchOpen(false);
    if ((route === '/profile' || route === '/wallet' || route === '/chat' || route === '/afriai/talk') && !user) {
      navigate('/login', { state: { next: route } });
      return;
    }
    navigate(route);
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    const query = searchValue.trim();
    if (!query) return;
    setSearchOpen(false);
    navigate(`/market?search=${encodeURIComponent(query)}`);
  };

  const editAction = () => {
    if (!user) {
      navigate('/login', { state: { next: '/profile' } });
      return;
    }
    if (isOwnProfile) {
      navigate('/profile?panel=profile');
      return;
    }
    navigate('/create');
  };

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-1 z-[80] flex items-start justify-between px-3 pt-[env(safe-area-inset-top)]">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-2xl border border-white/12 bg-black/58 text-white shadow-[0_10px_24px_rgba(0,0,0,0.32)] backdrop-blur-xl transition-transform active:scale-95"
          aria-label="Ouvrir le menu AfriSell"
        >
          <AfriSellIcon name="menu" size={17} />
        </button>

        {isProfilePage && (
        <div className="pointer-events-auto flex items-center gap-2 rounded-[1.35rem] border border-white/12 bg-black/44 p-1.5 shadow-[0_12px_28px_rgba(0,0,0,0.32)] backdrop-blur-xl">
          {canEdit && (
            <button
              type="button"
              onClick={editAction}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-white/82 transition-colors hover:bg-white/10 hover:text-[#15EA3E]"
              aria-label={isOwnProfile ? 'Modifier le profil' : 'Créer'}
            >
              <AfriSellIcon name="edit" size={15} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setSearchOpen((current) => !current)}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-white/82 transition-colors hover:bg-white/10 hover:text-[#15EA3E]"
            aria-label="Rechercher"
          >
            <AfriSellIcon name="search" size={16} />
          </button>
          <button
            type="button"
            onClick={() => go('/profile?panel=app')}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-white/82 transition-colors hover:bg-white/10 hover:text-[#15EA3E]"
            aria-label="Réglages"
          >
            <AfriSellIcon name="settings" size={16} />
          </button>
        </div>
        )}
      </div>

      {isProfilePage && searchOpen && (
        <form onSubmit={submitSearch} className="absolute inset-x-4 top-[4.25rem] z-[72] rounded-[1.4rem] border border-[#15EA3E]/22 bg-black/78 p-2 shadow-[0_18px_42px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
          <div className="flex items-center gap-2">
            <AfriSellIcon name="search" size={16} className="text-[#15EA3E]" />
            <input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Rechercher produit, service, module..."
              className="h-9 min-w-0 flex-1 border-none bg-transparent text-xs font-semibold text-white outline-none placeholder:text-white/38"
              autoFocus
            />
            <button type="submit" className="h-8 rounded-xl bg-[#15EA3E] px-3 text-[9px] font-black uppercase tracking-wider text-black">
              OK
            </button>
          </div>
        </form>
      )}

      {menuOpen && (
        <div className="absolute inset-0 z-[90] bg-black/48 backdrop-blur-[2px]" onClick={() => setMenuOpen(false)}>
          <aside
            className="h-full w-[82%] max-w-[21rem] overflow-y-auto border-r border-white/10 bg-[#050705]/96 px-4 pb-8 pt-6 shadow-[22px_0_52px_rgba(0,0,0,0.45)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#15EA3E]">AfriSell</p>
                <h2 className="mt-1 text-xl font-black text-white">Menu rapide</h2>
              </div>
              <button type="button" onClick={() => setMenuOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 text-white/55">
                <AfriSellIcon name="close" size={16} />
              </button>
            </div>

            <div className="mt-5 rounded-[1.35rem] border border-[#15EA3E]/18 bg-[#15EA3E]/8 p-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-[#15EA3E]">Page active</p>
              <p className="mt-1 text-sm font-black text-white">{activeShortcut?.label || 'AfriSell'}</p>
              <p className="mt-1 text-[11px] font-semibold leading-relaxed text-white/48">{activeShortcut?.description || 'Accès rapide aux fonctions utiles.'}</p>
            </div>

            <div className="mt-4 grid gap-2">
              {shortcuts.map((shortcut) => (
                <button
                  key={shortcut.route}
                  type="button"
                  onClick={() => go(shortcut.route)}
                  className={cn(
                    'flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors',
                    activeShortcut?.route === shortcut.route
                      ? 'border-[#15EA3E]/35 bg-[#15EA3E]/12'
                      : 'border-white/8 bg-white/[0.035] hover:border-white/18'
                  )}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/45 text-[#15EA3E]">
                    <AfriSellIcon name={shortcut.icon} size={17} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black text-white">{shortcut.label}</span>
                    <span className="mt-0.5 block truncate text-[10px] font-semibold text-white/42">{shortcut.description}</span>
                  </span>
                </button>
              ))}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
