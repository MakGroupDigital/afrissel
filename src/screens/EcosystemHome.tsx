import { Link } from 'react-router-dom';
import { ecosystemModules } from '../data/ecosystem';
import { cn } from '../lib/utils';
import { AfriSellIcon } from '../components/AfriSellIcon';
import { getModuleIconName } from '../lib/moduleIcons';

const statusStyles = {
  Live: 'bg-[#15EA3E] text-black',
  MVP: 'bg-white text-black',
  Bientot: 'bg-white/8 text-white/48 border border-white/10',
};

export default function EcosystemHome() {
  const featuredModules = ecosystemModules.slice(0, 4);
  const secondaryModules = ecosystemModules.slice(4);

  return (
    <div className="min-h-full bg-[#050705] px-4 pb-7 pt-4 text-white">
      <header className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <img src="/afrissel-icon.jpeg" alt="AfriSell" className="h-8 w-8 rounded-xl object-cover" />
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">AfriSell</p>
          </div>
          <h1 className="mt-2 text-2xl font-black tracking-normal">Bonjour Charmant</h1>
        </div>
        <Link to="/profile" className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-[#15EA3E]" aria-label="Profil">
          <AfriSellIcon name="profile" size={19} />
        </Link>
      </header>

      <section className="relative -mx-1 mt-5 overflow-hidden rounded-[1.7rem] rounded-br-[3rem] border border-[#15EA3E]/20 bg-[#0A0F0A] px-5 pb-7 pt-5 shadow-[0_18px_42px_rgba(0,0,0,0.34),0_0_34px_rgba(21,234,62,0.12)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_18%,rgba(21,234,62,0.2),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.06),transparent_45%)]" />
        <div className="absolute -bottom-14 right-8 h-24 w-44 rounded-[999px] bg-[#050705]" />
        <div className="absolute -right-10 -top-12 h-32 w-32 rounded-full bg-[#15EA3E]/12 blur-2xl" />
        <div className="absolute -right-8 bottom-2 h-24 w-24 rounded-full border border-[#15EA3E]/20" />
        <img src="/afrissel-icon.jpeg" alt="" className="absolute -right-7 top-8 h-28 w-28 rounded-[2rem] object-cover opacity-20 rotate-6" />
        <div className="absolute left-5 top-0 h-px w-28 bg-[#15EA3E]/50" />

        <div className="relative z-10 max-w-[240px]">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#15EA3E]/20 bg-[#15EA3E]/10 px-3 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#15EA3E]" />
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#15EA3E]">Tout-en-un</p>
          </div>
          <h2 className="mt-4 text-2xl font-black leading-tight tracking-normal">
            La super app africaine.
          </h2>
          <p className="mt-2 text-xs font-semibold leading-relaxed text-white/50">
            Commerce, paiement et services relies.
          </p>
          <div className="mt-4 flex w-max items-center gap-2 rounded-full bg-white/[0.06] px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-white/70">
            Explorer
            <AfriSellIcon name="arrow" size={13} className="text-[#15EA3E]" />
          </div>
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/52">Nos apps</h2>
          <span className="text-[10px] font-bold text-white/35">4 apps</span>
        </div>

        <div className="flex flex-col gap-2.5">
          {featuredModules.map((module) => {
            const iconName = getModuleIconName(module.id);
            return (
              <Link
                key={module.id}
                to={module.route}
                className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 active:scale-[0.98]"
              >
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl">
                  <img src={module.logo} alt={module.name} className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <AfriSellIcon name={iconName} size={17} className="text-[#15EA3E]" />
                    <h3 className="truncate text-sm font-black leading-tight">{module.name}</h3>
                  </div>
                  <p className="mt-1 line-clamp-1 text-[11px] font-semibold text-white/46">{module.promise}</p>
                </div>
                <span className={cn('rounded-full px-2 py-1 text-[8px] font-black uppercase tracking-[0.1em]', statusStyles[module.status])}>
                  {module.status}
                </span>
                <AfriSellIcon name="arrow" size={15} className="shrink-0 text-white/28" />
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-white/52">Prochains services</h2>
        <div className="grid grid-cols-3 gap-2">
          {secondaryModules.map((module) => {
            const iconName = getModuleIconName(module.id);
            return (
              <div key={module.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-2.5 text-center">
                <img src={module.logo} alt={module.name} className="mx-auto h-12 w-12 rounded-xl object-cover" />
                <AfriSellIcon name={iconName} size={14} className="mx-auto mt-2 text-[#15EA3E]" />
                <p className="mt-1 truncate text-[10px] font-black text-white/62">{module.shortName}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
