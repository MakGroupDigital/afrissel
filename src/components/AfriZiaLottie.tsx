import { useEffect, useRef } from 'react';
import lottie, { AnimationItem } from 'lottie-web';
import openingAnimation from '../assets/lottie/afrizia-opening.json';
import loadingAnimation from '../assets/lottie/afrizia-loader.json';
import { AfriZiaIcon, AfriZiaIconName } from './AfriZiaIcon';

type AfriZiaLottieProps = {
  variant: 'opening' | 'loading';
  className?: string;
  loop?: boolean;
  ariaLabel?: string;
};

const openingModules: AfriZiaIconName[] = ['video', 'market', 'chat', 'pay', 'location', 'school'];
const SPLASH_LOGO = '/afrisell-super-app-icon-removebg-preview.png';

export function AfriZiaLottie({
  variant,
  className = '',
  loop = true,
  ariaLabel
}: AfriZiaLottieProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const animation: AnimationItem = lottie.loadAnimation({
      container,
      renderer: 'svg',
      loop,
      autoplay: true,
      animationData: variant === 'opening' ? openingAnimation : loadingAnimation,
      rendererSettings: {
        preserveAspectRatio: 'xMidYMid meet'
      }
    });

    return () => animation.destroy();
  }, [loop, variant]);

  return (
    <div
      className={`afrizia-lottie relative overflow-hidden ${className}`}
      role="img"
      aria-label={ariaLabel || (variant === 'opening' ? 'Ouverture AfriZia' : 'Chargement AfriZia')}
    >
      {variant === 'opening' && (
        <>
          <div className="afrizia-opening-mark pointer-events-none absolute left-1/2 top-1/2 z-10 h-28 w-28 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full border border-[#15EA3E]/55 bg-black">
            <span
              className="block h-full w-full bg-center bg-no-repeat"
              style={{ backgroundImage: `url("${SPLASH_LOGO}")`, backgroundSize: '184%' }}
            />
          </div>
          <div className="pointer-events-none absolute inset-0 z-20" aria-hidden="true">
            {openingModules.map((icon, index) => (
              <span key={icon} className="afrizia-opening-module">
                <span style={{ animationDelay: `${index * 0.46}s` }}>
                  <AfriZiaIcon name={icon} size={17} />
                </span>
              </span>
            ))}
          </div>
        </>
      )}
      <div ref={containerRef} className="afrizia-lottie-frame absolute inset-0" aria-hidden="true" />
    </div>
  );
}

type AfriZiaLoadingStateProps = {
  label?: string;
  className?: string;
  compact?: boolean;
};

export function AfriZiaLoadingState({
  label = 'Chargement',
  className = '',
  compact = false
}: AfriZiaLoadingStateProps) {
  return (
    <div className={`afrizia-loading-state flex flex-col items-center justify-center text-center ${compact ? 'gap-1' : 'gap-2'} ${className}`} role="status" aria-live="polite">
      <AfriZiaLottie variant="loading" className={compact ? 'h-10 w-10' : 'h-16 w-16'} />
      <p className={compact ? 'text-[9px] font-black uppercase tracking-[0.14em]' : 'text-[10px] font-black uppercase tracking-[0.16em]'}>{label}</p>
    </div>
  );
}
