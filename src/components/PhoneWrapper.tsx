import React from 'react';
import { useLocation } from 'react-router-dom';
import { cn } from '../lib/utils';
import BottomNavigation from './BottomNavigation';
import BottomSheet from './BottomSheet';
import { InvertedAfricaLogo } from './InvertedAfricaLogo';

interface PhoneWrapperProps {
  children: React.ReactNode;
}

export default function PhoneWrapper({ children }: PhoneWrapperProps) {
  const location = useLocation();
  const immersivePaths = ['/', '/onboarding', '/login', '/scan'];
  const isImmersive = immersivePaths.includes(location.pathname);

  return (
    <div className="relative flex items-center justify-center min-h-screen overflow-hidden bg-[radial-gradient(circle_at_50%_20%,rgba(21,234,62,0.14),transparent_34%),#000000] font-sans text-[#FFFFFF]">
      
      {/* Background Graphic elements referencing the Logo Concept */}
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.08] pointer-events-none">
        <InvertedAfricaLogo className="w-[80vw] h-[80vw] max-w-[800px] text-white" />
      </div>

      <div className="absolute top-10 left-10 opacity-[0.18] pointer-events-none">
        <h1 className="text-6xl font-black text-[#15EA3E] leading-none tracking-normal" style={{ fontFamily: 'Quicksand' }}>AFRISELL</h1>
      </div>

      {/* Phone Silhouette */}
      <div className="relative w-[360px] h-[720px] bg-[#050705] border-[10px] border-[#1B211B] rounded-[3.5rem] shadow-[0_28px_80px_rgba(0,0,0,0.78),0_0_0_1px_rgba(255,255,255,0.10),0_0_75px_rgba(21,234,62,0.18)] overflow-hidden flex flex-col z-10 font-sans">
        <div className="absolute inset-0 rounded-[2.85rem] ring-1 ring-[#15EA3E]/18 pointer-events-none z-[60]" />
        
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-[#161A16] rounded-b-2xl z-50 flex items-center justify-center shadow-md border-x border-b border-white/5">
          <div className="w-12 h-1 bg-[#2B312B] rounded-full"></div>
        </div>

        {/* Content Area */}
        <div className={cn(
          "flex-1 w-full h-full overflow-y-auto scrollbar-hide",
          isImmersive ? "p-0" : "pt-8 pb-[80px]"
        )}>
          {children}
        </div>

        {/* Bottom Navigation */}
        {!isImmersive && <BottomNavigation />}

        {/* Global Modals */}
        {!isImmersive && <BottomSheet />}

        {/* Home Indicator */}
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-24 h-1 bg-white/20 rounded-full z-50 pointer-events-none"></div>
      </div>
    </div>
  );
}
