import React from 'react';
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
  shape: 'plain' | 'wide' | 'soft' | 'chat';
};

export default function BottomNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useFirebaseAuth();

  const navItems: NavigationItem[] = [
    { icon: 'home', label: 'Accueil', path: '/ecosystem', iconSize: 25, shape: 'plain' },
    { image: '/icone decouvrir barre de navigation sans fond.png', label: 'Découvrir', path: '/feed', imageClassName: 'scale-[0.88]', shape: 'wide' },
    { image: '/afrimarket sans nom icone sans fond.png', label: 'Marché', path: '/market', imageClassName: 'scale-[0.9]', shape: 'soft' },
    { image: '/icone message barre de navigation sans nom clean.png', label: 'Messages', path: '/chat', imageClassName: 'scale-[0.92]', shape: 'chat' },
  ];

  const openCreatePage = () => {
    if (!user) {
      navigate('/login', { state: { next: '/create/hub' } });
      return;
    }
    navigate('/create/hub');
  };

  return (
    <>
      <nav className="absolute bottom-3 inset-x-3 z-40">
        <div className="relative flex h-[4.25rem] items-center justify-between gap-0.5 rounded-[2rem] border border-white/10 bg-black/82 px-2 py-1.5 shadow-[0_18px_42px_rgba(0,0,0,0.62),0_1px_0_rgba(255,255,255,0.08)_inset] backdrop-blur-2xl">
          {navItems.slice(0, 2).map((item) => (
            <NavigationLink key={item.path} item={item} pathname={location.pathname} />
          ))}

          <button
            type="button"
            onClick={openCreatePage}
            className={cn(
              'mx-0.5 flex h-[2.78rem] w-[2.78rem] shrink-0 items-center justify-center rounded-[1.18rem] border transition-all active:scale-95',
              'border-[#15EA3E]/35 bg-[#15EA3E] text-black shadow-[0_0_20px_rgba(21,234,62,0.34)]'
            )}
            aria-label="Ajouter"
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
    plain: 'w-[3.05rem] rounded-[1.25rem]',
    wide: 'w-[3.55rem] rounded-[0.95rem]',
    soft: 'w-[2.55rem] rounded-full',
    chat: 'w-[3.05rem] [border-radius:1.4rem_0.85rem_1.4rem_0.95rem]'
  }[item.shape];

  const iconShellClass = {
    plain: 'h-7 w-9',
    wide: 'h-7 w-10',
    soft: 'h-[2.15rem] w-[2.15rem]',
    chat: 'h-7 w-9'
  }[item.shape];
  const showLabel = true;

  return (
    <NavLink
      to={item.path}
      className={cn(
        'group flex h-full shrink-0 flex-col items-center justify-center gap-0.5 transition-all duration-300',
        shellClass,
        isActive ? 'bg-white/[0.075]' : 'hover:bg-white/[0.035]',
        item.shape === 'soft' && isActive && 'ring-1 ring-[#15EA3E]/24',
        item.shape === 'wide' && isActive && 'shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]',
        item.shape === 'chat' && isActive && 'bg-[#15EA3E]/10'
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
              isActive ? 'opacity-100 saturate-[1.12] brightness-110' : 'opacity-88 saturate-[1.05] brightness-105 group-hover:opacity-100 group-hover:brightness-110',
              item.imageClassName
            )}
          />
        ) : (
          <AfriSellIcon
            name={item.icon || 'app'}
            size={item.iconSize || 22}
            className={cn(
              'transition-colors duration-300',
              isActive ? 'text-[#15EA3E]' : 'text-[#15EA3E]/78 group-hover:text-[#15EA3E]'
            )}
          />
        )}
      </span>
      {showLabel && (
        <span className={cn(
          'max-w-full truncate text-center text-[7.2px] font-bold leading-none transition-colors duration-300',
          isActive ? 'text-[#15EA3E]' : 'text-white/68 group-hover:text-white/86',
          item.shape === 'wide' && 'tracking-[-0.01em]'
        )}>
          {item.label}
        </span>
      )}
    </NavLink>
  );
}
