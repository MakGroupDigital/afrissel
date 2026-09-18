import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AfriZiaIcon } from '../components/AfriZiaIcon';
import { useFirebaseAuth } from '../hooks/useFirebaseAuth';

const SPLASH_LOGO = '/afrisell-super-app-icon-removebg-preview.png';

interface SplashScreenProps {
  autoNavigate?: boolean;
  showAction?: boolean;
}

export default function SplashScreen({ autoNavigate = true, showAction = true }: SplashScreenProps) {
  const navigate = useNavigate();
  const { loading } = useFirebaseAuth();

  useEffect(() => {
    if (!autoNavigate) return;
    if (loading) return;

    const hasSeenOnboarding = window.localStorage.getItem('afrisell:onboarding-seen') === '1';
    const nextPath = hasSeenOnboarding ? '/ecosystem' : '/onboarding';
    const timer = window.setTimeout(() => navigate(nextPath, { replace: true }), 4000);
    return () => window.clearTimeout(timer);
  }, [autoNavigate, loading, navigate]);

  return (
    <main className="afrizia-splash relative h-full min-h-full overflow-hidden text-white">
      <div className="afrizia-splash-grid absolute inset-0" aria-hidden="true" />
      <div className="afrizia-splash-scan absolute left-1/2 top-1/2" aria-hidden="true" />

      <div className="relative z-10 h-full px-7 pb-8 pt-10">
        <div className="afrizia-splash-center absolute left-1/2 top-1/2 flex w-full -translate-x-1/2 -translate-y-1/2 flex-col items-center px-8 text-center">
          <img src={SPLASH_LOGO} alt="AfriZia" className="afrizia-splash-logo h-40 w-40 object-contain" />
          <div className="afrizia-splash-line mt-7" />
          <p className="mt-4 text-sm font-black tracking-[0.28em] text-white">AFRIZIA</p>
          <p className="mt-2 text-[9px] font-bold uppercase tracking-[0.2em] text-[#15EA3E]">L'écosystème en mouvement</p>
        </div>

        {showAction && (
          <Link
            to={window.localStorage.getItem('afrisell:onboarding-seen') === '1' ? '/ecosystem' : '/onboarding'}
            className="absolute bottom-8 left-7 right-7 flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#15EA3E] text-sm font-black uppercase tracking-[0.16em] text-black shadow-[0_0_32px_rgba(21,234,62,0.24)] active:scale-[0.98]"
          >
            Entrer
            <AfriZiaIcon name="arrow" size={18} />
          </Link>
        )}
      </div>
    </main>
  );
}
