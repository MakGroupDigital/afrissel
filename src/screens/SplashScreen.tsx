import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { AfriSellIcon } from '../components/AfriSellIcon';
import { useFirebaseAuth } from '../hooks/useFirebaseAuth';

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
    const timer = window.setTimeout(() => navigate(nextPath, { replace: true }), 2600);
    return () => window.clearTimeout(timer);
  }, [autoNavigate, loading, navigate]);

  return (
    <main className="relative h-full min-h-full overflow-hidden bg-[#050705] text-white">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_36%,rgba(21,234,62,0.2),transparent_38%),linear-gradient(180deg,#070907,#020302)]" />
      </div>

      <div className="relative z-10 flex h-full flex-col px-7 pb-8 pt-10">
        <div className="flex flex-1 flex-col items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="relative flex h-44 w-44 items-center justify-center overflow-hidden rounded-[2.2rem] border border-[#15EA3E]/25 bg-black/45 shadow-[0_0_70px_rgba(21,234,62,0.22)]"
          >
            <img src="/afrissel-logo.jpeg" alt="AfriSell" className="h-full w-full object-cover" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.6 }}
            className="mt-8 text-center"
          >
            <h1 className="text-5xl font-black leading-none tracking-normal">AfriSell</h1>
            <p className="mt-4 text-sm font-semibold leading-relaxed text-white/60">
              La super app africaine, tout-en-un.
            </p>
          </motion.div>
        </div>

        {showAction && (
          <Link
            to={window.localStorage.getItem('afrisell:onboarding-seen') === '1' ? '/ecosystem' : '/onboarding'}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#15EA3E] text-sm font-black uppercase tracking-[0.16em] text-black shadow-[0_0_32px_rgba(21,234,62,0.24)] active:scale-[0.98]"
          >
            Entrer
            <AfriSellIcon name="arrow" size={18} />
          </Link>
        )}
      </div>
    </main>
  );
}
