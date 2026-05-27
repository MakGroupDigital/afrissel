import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { AfriSellIcon, AfriSellIconName } from '../components/AfriSellIcon';

const slides = [
  {
    kicker: 'Un ecosysteme',
    title: 'La super app africaine.',
    body: 'Tout-en-un : vendre, acheter, payer, discuter et acceder aux services du quotidien.',
    icon: 'hub' as AfriSellIconName,
    image: '/afrissel-logo.jpeg',
  },
  {
    kicker: 'Offline-first',
    title: 'Pensée pour nos réalités.',
    body: 'Fluide sur reseau faible, utile en ville comme dans les zones moins connectees.',
    icon: 'offline' as AfriSellIconName,
    image: '/afrispay.jpeg',
  },
  {
    kicker: 'Commerce social',
    title: 'Un seul compte, tout AfriSell.',
    body: 'ABC, Market, AfriChat, AfriSpay et nos apps travaillent ensemble.',
    icon: 'market' as AfriSellIconName,
    image: '/afrimarket.jpeg',
  },
];

export default function OnboardingScreen() {
  const [index, setIndex] = useState(0);
  const navigate = useNavigate();
  const slide = slides[index];
  const isLast = index === slides.length - 1;

  const finishOnboarding = (nextPath: string) => {
    window.localStorage.setItem('afrisell:onboarding-seen', '1');
    navigate(nextPath, { replace: true });
  };

  const handleNext = () => {
    if (isLast) {
      finishOnboarding('/login');
      return;
    }
    setIndex((current) => current + 1);
  };

  return (
    <main className="relative flex h-full min-h-full flex-col overflow-hidden bg-[#050705] text-white">
      <div className="relative z-10 flex flex-1 flex-col px-6 pb-7 pt-8">
        <div className="flex items-center justify-between">
          <button onClick={() => finishOnboarding('/ecosystem')} className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/55">
            Plus tard
          </button>
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
            {index + 1}/{slides.length}
          </span>
        </div>

        <div className="mt-10 flex justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={slide.image}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.35 }}
              className="h-56 w-56 overflow-hidden rounded-[2rem] border border-white/10 bg-black shadow-[0_0_50px_rgba(21,234,62,0.12)]"
            >
              <img src={slide.image} alt="" className="h-full w-full object-cover" />
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={slide.title}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.35 }}
            >
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#15EA3E]/30 bg-[#15EA3E]/12">
                <AfriSellIcon name={slide.icon} size={25} className="text-[#15EA3E]" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#15EA3E]">{slide.kicker}</p>
              <h1 className="mt-3 text-4xl font-black leading-[1.02] tracking-normal">{slide.title}</h1>
              <p className="mt-5 text-base font-medium leading-relaxed text-white/62">{slide.body}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-auto flex items-center justify-between gap-5 pt-7">
          <div className="flex gap-1.5">
            {slides.map((item, itemIndex) => (
              <button
                key={`${item.title}-bottom`}
                onClick={() => setIndex(itemIndex)}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  itemIndex === index ? 'w-9 bg-[#15EA3E]' : 'w-2.5 bg-white/20',
                )}
                aria-label={`Aller a l etape ${itemIndex + 1}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {isLast && (
              <button
                onClick={() => finishOnboarding('/ecosystem')}
                className="flex h-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-xs font-black uppercase tracking-[0.12em] text-white/65 active:scale-95"
              >
                Plus tard
              </button>
            )}
            <button
              onClick={handleNext}
              className="flex h-14 min-w-36 items-center justify-center gap-2 rounded-2xl bg-[#15EA3E] px-5 text-xs font-black uppercase tracking-[0.14em] text-black shadow-[0_0_28px_rgba(21,234,62,0.22)] active:scale-95"
              aria-label={isLast ? 'Continuer vers la connexion' : 'Etape suivante'}
            >
              {isLast ? 'Connexion' : 'Suivant'}
              <AfriSellIcon name="arrow" size={18} />
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
