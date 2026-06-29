import { Link, useNavigate } from 'react-router-dom';
import { AfriSellIcon } from '../components/AfriSellIcon';

export default function ZandofyMarketplaceScreen() {
  const navigate = useNavigate();

  return (
    <main className="min-h-full overflow-hidden bg-[#030604] pb-24 text-white">
      <header className="relative overflow-hidden px-4 pb-6 pt-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_8%,rgba(21,234,62,0.28),transparent_32%),linear-gradient(180deg,#071207,#030604)]" />
        <div className="relative z-20 flex items-center justify-between">
          <button type="button" onClick={() => navigate(-1)} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-black/34 text-[#15EA3E] backdrop-blur">
            <AfriSellIcon name="arrow" size={18} className="rotate-180" />
          </button>
          <span className="rounded-full border border-[#15EA3E]/20 bg-black/30 px-3 py-2 text-[9px] font-black uppercase tracking-[0.22em] text-[#15EA3E] backdrop-blur">Zandofy</span>
        </div>

        <div className="relative z-10 mt-5">
          <div className="relative h-44 overflow-hidden rounded-[1.8rem] border border-[#15EA3E]/16 bg-black shadow-[0_18px_40px_rgba(0,0,0,0.34)] sm:h-52">
            <img src="/zandofyacceuil.png" alt="Zandofy" className="h-full w-full object-cover object-center" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,6,4,0.12),rgba(3,6,4,0.42)_68%,#030604)]" />
            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#030604] to-transparent" />
          </div>
        </div>

        <div className="relative z-10 -mt-4">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#15EA3E]">Zandofy</p>
          <h1 className="mt-2 max-w-[260px] text-3xl font-black leading-none">Marketplace boutique AfriSell</h1>
          <p className="mt-3 max-w-[290px] text-sm font-semibold leading-relaxed text-white/52">
            Un espace boutique personnalisé, séparé du Market général, pour les collections et offres Zandofy.
          </p>
        </div>
      </header>

      <section className="px-4">
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Boutique', value: 'Zandofy' },
            { label: 'Produits', value: '0' },
            { label: 'Statut', value: 'Bientôt' }
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.045] p-3 text-center">
              <p className="truncate text-sm font-black text-white">{item.value}</p>
              <p className="mt-1 text-[8px] font-black uppercase tracking-wider text-white/38">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 pt-5">
        <div className="relative overflow-hidden rounded-[1.9rem] border border-[#15EA3E]/18 bg-[#071007] p-5">
          <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full border border-[#15EA3E]/14 bg-[#15EA3E]/8" />
          <div className="relative z-10">
            <div className="flex h-16 w-16 items-center justify-center rounded-[1.4rem] border border-[#15EA3E]/24 bg-black/32 text-[#15EA3E]">
              <AfriSellIcon name="market" size={28} />
            </div>
            <h2 className="mt-5 text-xl font-black">Cette boutique n’a pas encore de produits</h2>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-white/48">
              Les produits Zandofy seront affichés ici dans une expérience boutique dédiée, différente du Market principal.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Link to="/ecosystem" className="rounded-2xl bg-[#15EA3E] py-3 text-center text-[10px] font-black uppercase tracking-wider text-black">
                Accueil
              </Link>
              <Link to="/market" className="rounded-2xl border border-white/10 bg-white/[0.05] py-3 text-center text-[10px] font-black uppercase tracking-wider text-white/70">
                Market
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pt-5">
        <div className="scrollbar-hide flex gap-3 overflow-x-auto pb-1">
          {['Collections', 'Offres flash', 'Créateurs', 'Services'].map((label) => (
            <div key={label} className="w-[136px] shrink-0 rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
              <div className="mb-4 h-16 rounded-2xl bg-[radial-gradient(circle_at_70%_20%,rgba(21,234,62,0.24),transparent_42%),#020402]" />
              <p className="text-xs font-black text-white">{label}</p>
              <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-white/35">Vide</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
