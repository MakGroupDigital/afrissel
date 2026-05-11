import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { InvertedAfricaLogo } from '../components/InvertedAfricaLogo';
import { AfriSellIcon } from '../components/AfriSellIcon';

export default function LoginScreen() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'phone' | 'email'>('phone');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    navigate('/ecosystem');
  };

  return (
    <main className="relative h-full min-h-full overflow-hidden bg-[#050705] px-5 pb-7 pt-8 text-white">
      <div className="absolute inset-0">
        <img src="/afrispay.jpeg" alt="" className="h-full w-full object-cover opacity-[0.18]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,7,5,0.78),#050705_52%)]" />
      </div>

      <div className="relative z-10 flex h-full flex-col">
        <Link to="/onboarding" className="w-max text-[10px] font-bold uppercase tracking-[0.22em] text-white/50">
          Retour
        </Link>

        <div className="mt-10 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#15EA3E]/25 bg-black/40">
            <InvertedAfricaLogo className="h-11 w-11 text-[#15EA3E]" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#15EA3E]">Compte unique</p>
            <h1 className="mt-1 text-3xl font-black tracking-normal">Connexion</h1>
          </div>
        </div>

        <p className="mt-5 text-sm font-medium leading-relaxed text-white/62">
          Connecte-toi une seule fois pour acceder a ABC, Market, AfriChat, AfriSpay et aux prochains services.
        </p>

        <div className="mt-7 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1">
          <button
            onClick={() => setMode('phone')}
            className={`flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-black uppercase tracking-[0.12em] ${mode === 'phone' ? 'bg-[#15EA3E] text-black' : 'text-white/54'}`}
          >
            <AfriSellIcon name="phone" size={15} />
            Mobile
          </button>
          <button
            onClick={() => setMode('email')}
            className={`flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-black uppercase tracking-[0.12em] ${mode === 'email' ? 'bg-[#15EA3E] text-black' : 'text-white/54'}`}
          >
            <AfriSellIcon name="mail" size={15} />
            Email
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3">
          <label className="flex h-14 items-center gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 focus-within:border-[#15EA3E]/50">
            <AfriSellIcon name={mode === 'phone' ? 'phone' : 'mail'} size={18} className="text-[#15EA3E]" />
            <input
              type={mode === 'phone' ? 'tel' : 'email'}
              placeholder={mode === 'phone' ? '+243 000 000 000' : 'nom@afrisell.app'}
              className="w-full bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/28"
            />
          </label>

          <label className="flex h-14 items-center gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 focus-within:border-[#15EA3E]/50">
            <AfriSellIcon name="lock" size={18} className="text-[#15EA3E]" />
            <input
              type="password"
              placeholder="Code PIN ou mot de passe"
              className="w-full bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/28"
            />
          </label>

          <button className="mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#15EA3E] text-sm font-black uppercase tracking-[0.16em] text-black active:scale-[0.98]">
            Ouvrir AfriSell
            <AfriSellIcon name="arrow" size={18} />
          </button>
        </form>

        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[#15EA3E]/20 bg-[#15EA3E]/8 p-4">
          <AfriSellIcon name="offline" size={18} className="mt-0.5 text-[#15EA3E]" />
          <p className="text-[11px] font-semibold leading-relaxed text-white/62">
            Mode faible connexion prevu : sessions courtes, donnees legeres et synchronisation des actions en attente.
          </p>
        </div>

        <p className="mt-auto pt-6 text-center text-[11px] font-semibold text-white/42">
          Nouveau vendeur ? <span className="text-[#15EA3E]">Creer une boutique</span>
        </p>
      </div>
    </main>
  );
}
