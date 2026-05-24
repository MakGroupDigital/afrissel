import React from 'react';
import { useLocation } from 'react-router-dom';
import { cn } from '../lib/utils';
import BottomNavigation from './BottomNavigation';
import BottomSheet from './BottomSheet';
import { InvertedAfricaLogo } from './InvertedAfricaLogo';
import PwaInstallPrompt from './PwaInstallPrompt';

interface PhoneWrapperProps {
  children: React.ReactNode;
}

export default function PhoneWrapper({ children }: PhoneWrapperProps) {
  const location = useLocation();
  const immersivePaths = ['/', '/onboarding', '/login', '/scan'];
  const isImmersive = immersivePaths.includes(location.pathname);

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#050705] font-sans text-[#FFFFFF] md:bg-[radial-gradient(circle_at_50%_20%,rgba(21,234,62,0.14),transparent_34%),#000000]">
      <div className="pointer-events-none absolute inset-0 hidden items-center justify-center opacity-[0.08] md:flex">
        <InvertedAfricaLogo className="w-[80vw] h-[80vw] max-w-[800px] text-white" />
      </div>

      <div className="pointer-events-none absolute left-10 top-10 hidden opacity-[0.18] md:block">
        <h1 className="text-6xl font-black text-[#15EA3E] leading-none tracking-normal" style={{ fontFamily: 'Quicksand' }}>AFRISELL</h1>
      </div>

      <div className="relative z-10 flex h-[100dvh] w-full flex-col overflow-hidden bg-[#050705] font-sans md:h-[720px] md:w-[360px] md:rounded-[3.5rem] md:border-[10px] md:border-[#1B211B] md:shadow-[0_28px_80px_rgba(0,0,0,0.78),0_0_0_1px_rgba(255,255,255,0.10),0_0_75px_rgba(21,234,62,0.18)]">
        <div className="pointer-events-none absolute inset-0 z-[60] hidden rounded-[2.85rem] ring-1 ring-[#15EA3E]/18 md:block" />
        
        <div className="absolute left-1/2 top-0 z-50 hidden h-7 w-32 -translate-x-1/2 items-center justify-center rounded-b-2xl border-x border-b border-white/5 bg-[#161A16] shadow-md md:flex">
          <div className="w-12 h-1 bg-[#2B312B] rounded-full"></div>
        </div>

        <div className={cn(
          "flex-1 w-full h-full overflow-y-auto scrollbar-hide",
          isImmersive ? "p-0" : "pt-8 pb-[80px]"
        )}>
          {children}
        </div>

        {!isImmersive && <BottomNavigation />}

        {!isImmersive && <BottomSheet />}

        {!isImmersive && <PwaInstallPrompt />}

        <div className="pointer-events-none absolute bottom-1 left-1/2 z-50 hidden h-1 w-24 -translate-x-1/2 rounded-full bg-white/20 md:block"></div>
      </div>
    </div>
  );
}
