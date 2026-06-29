import { Link } from 'react-router-dom';
import { ecosystemModules } from '../data/ecosystem';
import { AfriSellIcon } from '../components/AfriSellIcon';
import { getModuleIconName } from '../lib/moduleIcons';
import { cn } from '../lib/utils';

const statusStyles = {
  Live: 'bg-[#15EA3E] text-black',
  MVP: 'bg-white text-black',
  Bientôt: 'bg-white/8 text-white/48 border border-white/10'
};

export default function AppsDirectoryScreen() {
  return (
    <main className="min-h-full bg-[#050705] px-4 pb-7 pt-4 text-white">
      <header className="flex items-center justify-between">
        <Link to="/ecosystem" className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-[#15EA3E]" aria-label="Retour">
          <AfriSellIcon name="arrow" size={18} className="rotate-180" />
        </Link>
        <div className="text-right">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">AfriSell</p>
          <h1 className="mt-1 text-xl font-black tracking-normal">Toutes nos apps</h1>
        </div>
      </header>

      <section className="mt-6">
        <div className="flex flex-col gap-3">
          {ecosystemModules.map((module) => {
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
                  <p className="mt-1 line-clamp-1 text-[11px] font-semibold text-white/46">{module.description}</p>
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
    </main>
  );
}
