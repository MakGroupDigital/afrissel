import { Link } from 'react-router-dom';
import { AfriSellIcon, AfriSellIconName } from '../components/AfriSellIcon';
import { useFirebaseAuth } from '../hooks/useFirebaseAuth';

const services: Array<{
  title: string;
  body: string;
  icon: AfriSellIconName;
  action: string;
}> = [
  {
    title: 'Expedier un colis',
    body: 'Demande de livraison locale, suivi et confirmation du destinataire.',
    icon: 'send',
    action: 'Demander'
  },
  {
    title: 'Mobilite',
    body: 'Transport urbain, courses planifiees et trajets pour vendeurs.',
    icon: 'app',
    action: 'Planifier'
  },
  {
    title: 'Immobilier',
    body: 'Terrains, maisons, locations et visites reliees aux services locaux.',
    icon: 'market',
    action: 'Explorer'
  }
];

export default function SafariServicesScreen() {
  const { user } = useFirebaseAuth();

  return (
    <main className="min-h-full bg-[#050705] px-4 pb-7 pt-4 text-white">
      <header className="flex items-center justify-between">
        <Link to="/ecosystem" className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-[#15EA3E]" aria-label="Retour">
          <AfriSellIcon name="arrow" size={18} className="rotate-180" />
        </Link>
        <div className="text-right">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">Safari</p>
          <h1 className="mt-1 text-xl font-black tracking-normal">Mobilite & services</h1>
        </div>
      </header>

      <section className="relative mt-6 overflow-hidden rounded-[1.7rem] border border-[#15EA3E]/20 bg-[#0A0F0A] p-5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_18%,rgba(21,234,62,0.18),transparent_34%)]" />
        <div className="relative z-10 flex items-center gap-4">
          <img src="/safari.jpeg" alt="Safari" className="h-20 w-20 rounded-[1.5rem] object-cover" />
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#15EA3E]">Transport, livraison, immobilier</p>
            <h2 className="mt-2 text-2xl font-black leading-tight">Demande un service local sans quitter AfriSell.</h2>
          </div>
        </div>
      </section>

      <section className="mt-5 flex flex-col gap-3">
        {services.map((service) => {
          const target = user ? '/chat' : '/login';
          return (
            <Link
              key={service.title}
              to={target}
              state={!user ? { next: '/chat' } : undefined}
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 active:scale-[0.98]"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#15EA3E]/10 text-[#15EA3E]">
                <AfriSellIcon name={service.icon} size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-black">{service.title}</span>
                <span className="mt-1 line-clamp-1 text-[11px] font-semibold text-white/45">{service.body}</span>
              </span>
              <span className="rounded-full bg-[#15EA3E] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-black">
                {service.action}
              </span>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
