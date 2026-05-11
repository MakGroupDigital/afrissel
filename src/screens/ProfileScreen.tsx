import { Link, useNavigate } from 'react-router-dom';
import { AfriSellIcon, AfriSellIconName } from '../components/AfriSellIcon';

type ProfileAction = {
  title: string;
  description: string;
  icon: AfriSellIconName;
  action?: () => void;
  danger?: boolean;
};

export default function ProfileScreen() {
  const navigate = useNavigate();

  const handleLogout = () => {
    window.localStorage.setItem('afrissel:lastLogout', new Date().toISOString());
    navigate('/login');
  };

  const actions: ProfileAction[] = [
    {
      title: 'Profil',
      description: 'Identite, photo, telephone et adresse.',
      icon: 'profile',
    },
    {
      title: 'Gerer le compte',
      description: 'Securite, code PIN, appareils et preferences.',
      icon: 'account',
    },
    {
      title: 'Gerer l app',
      description: 'Langue, cache, mode leger et donnees hors ligne.',
      icon: 'app',
    },
    {
      title: 'Notifications',
      description: 'Commandes, messages, paiements et alertes.',
      icon: 'notifications',
    },
    {
      title: 'Confidentialite',
      description: 'Autorisations, camera, contacts et donnees.',
      icon: 'shield',
    },
    {
      title: 'Deconnexion',
      description: 'Fermer la session sur cet appareil.',
      icon: 'logout',
      action: handleLogout,
      danger: true,
    },
  ];

  return (
    <div className="min-h-full bg-[#050705] px-4 pb-8 pt-4 text-white">
      <header className="flex items-center justify-between">
        <Link to="/ecosystem" className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/70">
          <AfriSellIcon name="arrow" size={18} className="rotate-180" />
        </Link>
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">Profil</p>
        <div className="h-10 w-10" />
      </header>

      <section className="mt-6 flex flex-col items-center text-center">
        <div className="relative h-24 w-24 overflow-hidden rounded-[2rem] border border-[#15EA3E]/25 bg-black">
          <img src="/afrissel-icon.jpeg" alt="Profil AfriSell" className="h-full w-full object-cover" />
        </div>
        <h1 className="mt-4 text-2xl font-black tracking-normal">Charmant Nyungu</h1>
        <p className="mt-1 text-xs font-semibold text-white/45">Consultant en Innovation Technologique</p>
        <div className="mt-4 rounded-full border border-[#15EA3E]/20 bg-[#15EA3E]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#15EA3E]">
          Compte verifie
        </div>
      </section>

      <section className="mt-7 flex flex-col gap-2.5">
        {actions.map((item) => (
          <button
            key={item.title}
            onClick={item.action}
            className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left active:scale-[0.99] ${
              item.danger
                ? 'border-red-500/20 bg-red-500/10 text-red-100'
                : 'border-white/10 bg-white/[0.04] text-white'
            }`}
          >
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
              item.danger ? 'bg-red-500/10 text-red-200' : 'bg-[#15EA3E]/10 text-[#15EA3E]'
            }`}>
              <AfriSellIcon name={item.icon} size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-black">{item.title}</h2>
              <p className="mt-0.5 line-clamp-1 text-[11px] font-semibold text-white/42">{item.description}</p>
            </div>
            <AfriSellIcon name="arrow" size={15} className={item.danger ? 'text-red-200/60' : 'text-white/25'} />
          </button>
        ))}
      </section>
    </div>
  );
}
