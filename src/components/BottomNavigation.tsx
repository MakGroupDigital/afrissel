import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '../lib/utils';
import { AfriSellIcon, AfriSellIconName } from './AfriSellIcon';

export default function BottomNavigation() {
  const location = useLocation();

  const navItems = [
    { icon: 'hub' as AfriSellIconName, label: 'Accueil', path: '/ecosystem' },
    { icon: 'video' as AfriSellIconName, label: 'Découvrir', path: '/feed' },
    { icon: 'market' as AfriSellIconName, label: 'Marché', path: '/market' },
    { icon: 'chat' as AfriSellIconName, label: 'Messages', path: '/chat' },
    { icon: 'profile' as AfriSellIconName, label: 'Moi', path: '/profile' },
  ];

  return (
    <div className="absolute bottom-0 inset-x-0 z-40 flex h-20 items-center justify-around border-t border-gray-900 bg-[#000000] px-2 pb-2">
      {navItems.map((item) => {
        const isActive = location.pathname === item.path;

        return (
          <NavLink
            key={item.path}
            to={item.path}
            className="group flex w-[62px] flex-col items-center justify-center gap-1"
          >
            <div className={cn(
               "flex h-8 w-8 items-center justify-center rounded-2xl border transition-all duration-300",
               isActive
                 ? "border-[#15EA3E]/40 bg-[#15EA3E] shadow-[0_0_18px_rgba(21,234,62,0.28)]"
                 : "border-white/10 bg-white/[0.04] group-hover:border-gray-700"
            )}>
               <AfriSellIcon
                 name={item.icon}
                 size={15}
                 className={cn(
                   "transition-colors duration-300",
                   isActive ? "text-black" : "text-gray-400 group-hover:text-white"
                 )}
               />
            </div>
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
