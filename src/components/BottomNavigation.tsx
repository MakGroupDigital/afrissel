import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '../lib/utils';
import { AfriSellIcon, AfriSellIconName } from './AfriSellIcon';

export default function BottomNavigation() {
  const location = useLocation();

  const navItems = [
    { icon: 'hub' as AfriSellIconName, label: 'Hub', path: '/ecosystem' },
    { icon: 'market' as AfriSellIconName, label: 'Marché', path: '/market' },
    // FAB spacer
    { icon: null, label: '', path: '', isSpacer: true },
    { icon: 'pay' as AfriSellIconName, label: 'Pay', path: '/wallet' },
    { icon: 'chat' as AfriSellIconName, label: 'Chat', path: '/chat' },
  ];

  return (
    <div className="absolute bottom-0 inset-x-0 h-20 bg-[#000000] border-t border-gray-900 flex items-center justify-around px-2 pb-2 z-40">
      {navItems.map((item, index) => {
        if (item.isSpacer) {
          return <div key={index} className="w-12" />; // Spacer for FAB
        }
        
        const isActive = location.pathname === item.path;
        const icon = item.icon!;

        return (
          <NavLink
            key={item.path}
            to={item.path}
            className="flex flex-col items-center justify-center w-12 gap-1 group"
          >
            <div className={cn(
               "w-5 h-5 rounded-sm flex items-center justify-center transition-colors duration-300",
               isActive ? "bg-[#15EA3E]" : "bg-gray-800 group-hover:bg-gray-700"
            )}>
               <AfriSellIcon
                 name={icon}
                 size={13}
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

      {/* Floating Action Button (FAB) for scanner */}
      <div className="absolute left-1/2 -top-4 -translate-x-1/2 z-50">
        <NavLink to="/scan" className="relative flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-tr from-[#15EA3E] to-[#12C233] text-white shadow-[0_0_20px_rgba(21,234,62,0.5)] border-4 border-[#000000] group hover:scale-105 transition-transform duration-300 active:scale-95">
           <AfriSellIcon name="scan" size={25} className="text-black" />
        </NavLink>
      </div>
    </div>
  );
}
