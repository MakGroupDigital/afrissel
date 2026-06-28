import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '../lib/utils';
import { AfriSellIcon, AfriSellIconName } from './AfriSellIcon';

type NavigationItem = {
  label: string;
  path: string;
  icon?: AfriSellIconName;
  image?: string;
  imageClassName?: string;
  frameless?: boolean;
};

export default function BottomNavigation() {
  const location = useLocation();

  const navItems: NavigationItem[] = [
    { icon: 'hub', label: 'Accueil', path: '/ecosystem' },
    { image: '/icone decouvrir barre de navigation.png', label: 'Découvrir', path: '/feed', imageClassName: 'scale-[1.3]' },
    { image: '/afrimarket sans nom icone.png', label: 'Marché', path: '/market', imageClassName: 'scale-[1.25]' },
    { image: '/icone message barre de navigation sans nom.png', label: 'Messages', path: '/chat', imageClassName: 'afrisell-nav-message scale-[1.9]', frameless: true },
    { icon: 'profile', label: 'Moi', path: '/profile' },
  ];

  return (
    <div className="absolute bottom-0 inset-x-0 z-40 flex h-20 items-center justify-around border-t border-gray-900 bg-[#000000] px-2 pb-2">
      {navItems.map((item) => {
        const isActive = location.pathname === item.path || (
          item.path !== '/ecosystem' && location.pathname.startsWith(`${item.path}/`)
        );

        return (
          <NavLink
            key={item.path}
            to={item.path}
            className="group flex w-[62px] flex-col items-center justify-center gap-1"
          >
            {item.frameless && item.image ? (
              <div className={cn(
                'flex h-9 w-9 items-center justify-center transition-all duration-300',
                isActive ? 'scale-110 drop-shadow-[0_0_10px_rgba(21,234,62,0.5)]' : 'opacity-65 group-hover:opacity-100'
              )}>
                <img src={item.image} alt="" className={cn('h-full w-full object-cover', item.imageClassName)} />
              </div>
            ) : (
              <div className={cn(
                'flex h-8 w-8 items-center justify-center overflow-hidden rounded-2xl border transition-all duration-300',
                isActive
                  ? 'border-[#15EA3E]/40 bg-[#15EA3E] shadow-[0_0_18px_rgba(21,234,62,0.28)]'
                  : 'border-white/10 bg-white/[0.04] group-hover:border-gray-700'
              )}>
                {item.image ? (
                  <img
                    src={item.image}
                    alt=""
                    className={cn('h-full w-full object-cover', item.imageClassName, !isActive && 'opacity-80')}
                  />
                ) : (
                  <AfriSellIcon
                    name={item.icon || 'app'}
                    size={15}
                    className={cn(
                      'transition-colors duration-300',
                      isActive ? 'text-black' : 'text-gray-400 group-hover:text-white'
                    )}
                  />
                )}
              </div>
            )}
            <span className={cn(
              "text-[9px] transition-colors duration-300 text-center w-full",
              isActive ? "text-[#15EA3E]" : "text-gray-500 group-hover:text-gray-400"
            )}>
              {item.label}
            </span>
          </NavLink>
        );
      })}
    </div>
  );
}
