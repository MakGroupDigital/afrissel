import React, { useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { AfriSellIcon, AfriSellIconName } from './AfriSellIcon';
import { useFirebaseAuth } from '../hooks/useFirebaseAuth';

type NavigationItem = {
  label: string;
  path: string;
  icon?: AfriSellIconName;
  image?: string;
  imageClassName?: string;
  iconSize?: number;
  shape: 'plain' | 'wide' | 'soft' | 'chat' | 'corner';
};

const hasBusinessAccess = (profile: ReturnType<typeof useFirebaseAuth>['profile']) => {
  if (!profile) return false;
  const accounts = [
    profile.businessAccount,
    ...Object.values(profile.businessAccounts || {})
  ].filter(Boolean);

  return Boolean(accounts.length || profile.primaryRole === 'seller' || profile.primaryRole === 'provider' || profile.primaryRole === 'business' || profile.primaryRole === 'creator');
};

export default function BottomNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile } = useFirebaseAuth();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const canAddBusiness = hasBusinessAccess(profile);

  const navItems: NavigationItem[] = [
    { icon: 'home', label: 'Accueil', path: '/ecosystem', iconSize: 19, shape: 'plain' },
    { image: '/icone decouvrir barre de navigation sans fond.png', label: 'Découvrir', path: '/feed', imageClassName: 'scale-[0.86]', shape: 'wide' },
    { image: '/afrimarket sans nom icone sans fond.png', label: 'Marché', path: '/market', imageClassName: 'scale-[0.9]', shape: 'soft' },
    { image: '/icone message barre de navigation sans nom clean.png', label: 'Messages', path: '/chat', imageClassName: 'scale-[0.94]', shape: 'chat' },
    { icon: 'profile', label: 'Moi', path: '/profile', iconSize: 19, shape: 'corner' },
  ];

  const addActions = useMemo(() => [
    {
      label: 'Publication ABC',
      description: 'Video, photo ou contenu simple.',
      icon: 'video' as AfriSellIconName,
      route: '/feed?publish=1',
      requiresBusiness: false
    },
    {
      label: 'Produit Market',
      description: 'Produit, prix village, stock et vente.',
      icon: 'market' as AfriSellIconName,
      route: canAddBusiness ? '/business?account=commerce' : '/profile',
      requiresBusiness: true
    },
    {
      label: 'Service',
      description: 'Freelance, prestation, rendez-vous ou offre.',
      icon: 'work' as AfriSellIconName,
      route: canAddBusiness ? '/freelance/publier-service' : '/profile',
      requiresBusiness: true
    },
    {
      label: 'Associer produit',
      description: 'Publier ABC et lier un produit existant.',
      icon: 'follow' as AfriSellIconName,
      route: '/feed?publish=1',
      requiresBusiness: true
    }
  ], [canAddBusiness]);

  const runAddAction = (route: string) => {
    setIsAddOpen(false);
    if (!user) {
      navigate('/login', { state: { next: route } });
      return;
    }
    navigate(route);
  };

  return (
    <>
      {isAddOpen && (
        <button
          type="button"
          aria-label="Fermer le menu d ajout"
          onClick={() => setIsAddOpen(false)}
          className="absolute inset-0 z-40 bg-black/20"
        />
      )}

      {isAddOpen && (
        <div className="absolute inset-x-4 bottom-[5.85rem] z-50 overflow-hidden rounded-[1.65rem] border border-white/10 bg-[#050705]/92 p-2.5 text-white shadow-[0_22px_52px_rgba(0,0,0,0.62)] backdrop-blur-2xl">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(21,234,62,0.16),transparent_42%)]" />
          <div className="relative z-10">
            <div className="mb-2 flex items-center justify-between px-1">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#15EA3E]">Ajouter</p>
                <p className="text-[11px] font-semibold text-white/48">
                  {canAddBusiness ? 'Publication, produit ou service.' : 'Publication simple disponible.'}
                </p>
              </div>
              <button type="button" onClick={() => setIsAddOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-white/58">
                <AfriSellIcon name="close" size={14} />
              </button>
            </div>

            <div className="grid gap-1.5">
              {addActions.map((action) => {
                const disabled = action.requiresBusiness && !canAddBusiness;
                return (
                  <button
                    key={action.label}
                    type="button"
                    onClick={() => runAddAction(action.route)}
                    className={cn(
                      'flex items-center gap-3 rounded-[1.15rem] border p-2.5 text-left transition-transform active:scale-[0.98]',
                      disabled
                        ? 'border-white/8 bg-white/[0.025] text-white/42'
                        : 'border-white/10 bg-white/[0.055] text-white'
                    )}
                  >
                    <span className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl',
                      disabled ? 'bg-white/[0.04] text-white/35' : 'bg-[#15EA3E] text-black'
                    )}>
                      <AfriSellIcon name={action.icon} size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-black">{action.label}</span>
                      <span className="mt-0.5 block text-[10px] font-semibold leading-snug text-white/42">
                        {disabled ? 'Active un business account dans Profil.' : action.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <nav className="absolute bottom-3 inset-x-3 z-40">
        <div className="relative flex h-[4.25rem] items-center justify-between gap-0.5 rounded-[2rem] border border-white/10 bg-black/82 px-1.5 py-1.5 shadow-[0_18px_42px_rgba(0,0,0,0.62),0_1px_0_rgba(255,255,255,0.08)_inset] backdrop-blur-2xl">
          {navItems.slice(0, 2).map((item) => (
            <NavigationLink key={item.path} item={item} pathname={location.pathname} />
          ))}

          <button
            type="button"
            onClick={() => setIsAddOpen((current) => !current)}
            className={cn(
              'mx-0.5 flex h-[2.78rem] w-[2.78rem] shrink-0 items-center justify-center rounded-[1.18rem] border transition-all active:scale-95',
              isAddOpen
                ? 'rotate-45 border-[#15EA3E]/40 bg-white text-black shadow-[0_0_22px_rgba(21,234,62,0.28)]'
                : 'border-[#15EA3E]/35 bg-[#15EA3E] text-black shadow-[0_0_20px_rgba(21,234,62,0.34)]'
            )}
            aria-label="Ajouter"
            aria-expanded={isAddOpen}
          >
            <AfriSellIcon name="plus" size={19} />
          </button>

          {navItems.slice(2).map((item) => (
            <NavigationLink key={item.path} item={item} pathname={location.pathname} />
          ))}
        </div>
      </nav>
    </>
  );
}

function NavigationLink({ item, pathname }: { key?: React.Key; item: NavigationItem; pathname: string }) {
  const isActive = pathname === item.path || (
    item.path !== '/ecosystem' && pathname.startsWith(`${item.path}/`)
  );

  const shellClass = {
    plain: 'w-[2.25rem]',
    wide: 'w-[3.05rem] rounded-[1.3rem]',
    soft: 'w-[2.6rem] rounded-[0.95rem]',
    chat: 'w-[2.9rem] rounded-[1.25rem]',
    corner: 'w-[2.05rem]'
  }[item.shape];

  const iconShellClass = {
    plain: 'h-6 w-6',
    wide: 'h-7 w-9',
    soft: 'h-7 w-7',
    chat: 'h-7 w-8',
    corner: 'h-6 w-6'
  }[item.shape];

  return (
    <NavLink
      to={item.path}
      className={cn(
        'group flex h-full shrink-0 flex-col items-center justify-center gap-0.5 rounded-[1.4rem] transition-all duration-300',
        shellClass,
        isActive ? 'bg-white/[0.055]' : 'hover:bg-white/[0.035]'
      )}
      aria-label={item.label}
    >
      <span className={cn(
        'flex items-center justify-center transition-all duration-300',
        iconShellClass,
        isActive ? 'scale-[1.02]' : 'opacity-82'
      )}>
        {item.image ? (
          <img
            src={item.image}
            alt=""
            className={cn(
              'afrisell-nav-image h-full w-full object-contain transition-[filter,opacity] duration-300',
              isActive ? 'opacity-95 saturate-[0.9] brightness-105' : 'opacity-62 grayscale brightness-125 contrast-90 group-hover:opacity-86',
              item.imageClassName
            )}
          />
        ) : (
          <AfriSellIcon
            name={item.icon || 'app'}
            size={item.iconSize || 22}
            className={cn(
              'transition-colors duration-300',
              isActive ? 'text-[#15EA3E]' : 'text-white/58 group-hover:text-white/82'
            )}
          />
        )}
      </span>
      <span className={cn(
        'max-w-full truncate text-center text-[7.5px] font-bold leading-none transition-colors duration-300',
        isActive ? 'text-[#15EA3E]' : 'text-white/52 group-hover:text-white/72',
        item.shape === 'corner' && 'text-[7px]'
      )}>
        {item.label}
      </span>
    </NavLink>
  );
}
