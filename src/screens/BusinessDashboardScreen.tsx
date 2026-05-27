import { Link, useLocation } from 'react-router-dom';
import { AfriSellIcon, AfriSellIconName } from '../components/AfriSellIcon';
import { useFirebaseAuth } from '../hooks/useFirebaseAuth';
import { cn } from '../lib/utils';

type BusinessAction = {
  label: string;
  description: string;
  icon: AfriSellIconName;
  route: string;
  highlight?: boolean;
};

type BusinessAccountProfile = {
  categoryId?: string;
  categoryLabel?: string;
  moduleName?: string;
  serviceId?: string;
  serviceLabel?: string;
  segmentId?: string;
  segmentLabel?: string;
  status?: string;
  createdAt?: number;
  kycDueAt?: number;
  kycStatus?: 'none' | 'pending' | 'verified' | 'rejected';
  updatedAt?: unknown;
};

const defaultActions: BusinessAction[] = [
  { label: 'Publier', description: 'Mettre une offre en avant dans ABC.', icon: 'video', route: '/feed?publish=1', highlight: true },
  { label: 'Messages', description: 'Repondre aux clients et partenaires.', icon: 'chat', route: '/chat' },
  { label: 'Encaisser', description: 'Suivre paiements et operations AfriSpay.', icon: 'pay', route: '/wallet' }
];

const actionCatalog: Record<string, BusinessAction[]> = {
  commerce: [
    { label: 'Ajouter produit', description: 'Creer une fiche produit Market.', icon: 'market', route: '/feed?publish=1', highlight: true },
    { label: 'Voir catalogue', description: 'Controler les produits visibles.', icon: 'cart', route: '/market' },
    { label: 'Commandes', description: 'Suivre les demandes clients.', icon: 'order', route: '/chat' },
    { label: 'Encaissements', description: 'Retraits, depot et ventes.', icon: 'pay', route: '/wallet' }
  ],
  payment: [
    { label: 'Scanner', description: 'Valider un paiement QR.', icon: 'scan', route: '/scan', highlight: true },
    { label: 'Depot', description: 'Lancer une operation de depot.', icon: 'deposit', route: '/wallet?action=deposit' },
    { label: 'Retrait', description: 'Servir un retrait client.', icon: 'withdraw', route: '/wallet?action=withdraw' },
    { label: 'Support', description: 'Assister les utilisateurs AfriSpay.', icon: 'chat', route: '/chat' }
  ],
  logistics: [
    { label: 'Demandes', description: 'Voir les courses, livraisons et missions.', icon: 'send', route: '/safari', highlight: true },
    { label: 'Clients', description: 'Ouvrir les conversations actives.', icon: 'chat', route: '/chat' },
    { label: 'Paiements', description: 'Encaisser une livraison ou un service.', icon: 'pay', route: '/wallet' }
  ],
  services: [
    { label: 'Publier service', description: 'Presenter une competence ou offre.', icon: 'work', route: '/feed?publish=1', highlight: true },
    { label: 'Demandes', description: 'Repondre aux prospects.', icon: 'chat', route: '/chat' },
    { label: 'Recevoir paiement', description: 'Facturer avec AfriSpay.', icon: 'pay', route: '/wallet' }
  ],
  abc_media: [
    { label: 'Nouvelle video', description: 'Publier une video ABC marchande.', icon: 'video', route: '/feed?publish=1', highlight: true },
    { label: 'Associer produit', description: 'Choisir une offre Market.', icon: 'market', route: '/market' },
    { label: 'Audience', description: 'Discuter avec prospects et marques.', icon: 'chat', route: '/chat' },
    { label: 'Revenus', description: 'Suivre les paiements createur.', icon: 'pay', route: '/wallet' }
  ]
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export default function BusinessDashboardScreen() {
  const { profile } = useFirebaseAuth();
  const location = useLocation();
  const requestedAccountId = new URLSearchParams(location.search).get('account') || '';
  const businessAccounts: Record<string, BusinessAccountProfile> = {
    ...(profile?.businessAccount?.categoryId ? { [profile.businessAccount.categoryId]: profile.businessAccount } : {}),
    ...(profile?.businessAccounts || {})
  };
  const ownedBusinessAccounts = Object.values(businessAccounts).filter((account): account is BusinessAccountProfile & { categoryId: string } => Boolean(account?.categoryId));
  const businessAccount = (
    requestedAccountId && businessAccounts[requestedAccountId]
      ? businessAccounts[requestedAccountId]
      : profile?.businessAccount || ownedBusinessAccounts[0]
  );
  const kycDueAt = Number(businessAccount?.kycDueAt || Date.now() + 10 * MS_PER_DAY);
  const daysLeft = Math.max(0, Math.ceil((kycDueAt - Date.now()) / MS_PER_DAY));
  const needsKyc = businessAccount?.kycStatus !== 'verified';
  const actions = businessAccount?.categoryId ? actionCatalog[businessAccount.categoryId] || defaultActions : defaultActions;

  if (!businessAccount?.categoryId) {
    return (
      <main className="min-h-full bg-[#050705] px-4 pb-8 pt-4 text-white">
        <header className="flex items-center justify-between">
          <Link to="/profile" className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/70">
            <AfriSellIcon name="arrow" size={18} className="rotate-180" />
          </Link>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">Business</p>
          <div className="h-10 w-10" />
        </header>

        <section className="mt-10 rounded-[1.7rem] border border-white/10 bg-white/[0.04] p-5 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#15EA3E]/10 text-[#15EA3E]">
            <AfriSellIcon name="work" size={24} />
          </div>
          <h1 className="mt-4 text-xl font-black">Aucun business account</h1>
          <p className="mt-2 text-xs font-semibold leading-relaxed text-white/50">
            Configure ton type de compte dans le profil pour ouvrir le dashboard adapte.
          </p>
          <Link to="/profile" className="mt-5 inline-flex h-11 items-center justify-center rounded-2xl bg-[#15EA3E] px-5 text-xs font-black uppercase tracking-widest text-black">
            Configurer
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-full bg-[#050705] px-4 pb-8 pt-4 text-white">
      <header className="flex items-center justify-between">
        <Link to="/profile" className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/70">
          <AfriSellIcon name="arrow" size={18} className="rotate-180" />
        </Link>
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">Business</p>
        <Link to="/ecosystem" className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-[#15EA3E]">
          <AfriSellIcon name="hub" size={18} />
        </Link>
      </header>

      {ownedBusinessAccounts.length > 1 && (
        <section className="scrollbar-hide mt-4 flex gap-2 overflow-x-auto pb-1">
          {ownedBusinessAccounts.map((account) => (
            <Link
              key={account.categoryId}
              to={`/business?account=${account.categoryId}`}
              className={cn(
                'shrink-0 rounded-full border px-3 py-2 text-[9px] font-black uppercase tracking-wider',
                account.categoryId === businessAccount?.categoryId
                  ? 'border-[#15EA3E] bg-[#15EA3E] text-black'
                  : 'border-white/10 bg-white/[0.04] text-white/55'
              )}
            >
              {account.categoryLabel}
            </Link>
          ))}
        </section>
      )}

      {needsKyc && (
        <section className="mt-4 rounded-[1.4rem] border border-amber-300/25 bg-amber-300/10 p-3 shadow-[0_18px_42px_rgba(0,0,0,0.28)]">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-300 text-black">
              <AfriSellIcon name="shield" size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black text-amber-100">Verification KYC requise</p>
              <p className="mt-1 text-[11px] font-semibold leading-relaxed text-amber-100/72">
                Complete la verification avant {daysLeft} jour{daysLeft > 1 ? 's' : ''}, sinon les services business seront bloques.
              </p>
            </div>
            <Link to="/profile" className="rounded-xl bg-amber-300 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-black">
              Verifier
            </Link>
          </div>
        </section>
      )}

      <section className="relative mt-5 overflow-hidden rounded-[1.7rem] border border-[#15EA3E]/20 bg-[#0A0F0A] p-5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_20%,rgba(21,234,62,0.18),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.06),transparent_46%)]" />
        <div className="relative z-10">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">{businessAccount.moduleName || 'AfriSell'}</p>
          <h1 className="mt-2 text-2xl font-black leading-tight">{businessAccount.categoryLabel}</h1>
          <p className="mt-2 text-xs font-semibold leading-relaxed text-white/54">
            {businessAccount.serviceLabel} - {businessAccount.segmentLabel}
          </p>
          <div className="mt-4 inline-flex rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white/62">
            Statut: {businessAccount.status || 'draft'}
          </div>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/52">Actions business</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {actions.map((action) => (
            <Link
              key={action.label}
              to={action.route}
              className={cn(
                'min-h-[132px] rounded-[1.35rem] border p-4 active:scale-[0.98]',
                action.highlight
                  ? 'border-[#15EA3E]/35 bg-[#15EA3E] text-black'
                  : 'border-white/10 bg-white/[0.04] text-white'
              )}
            >
              <div className={cn('flex h-11 w-11 items-center justify-center rounded-2xl', action.highlight ? 'bg-black/10' : 'bg-[#15EA3E]/10 text-[#15EA3E]')}>
                <AfriSellIcon name={action.icon} size={20} />
              </div>
              <h3 className="mt-4 text-sm font-black">{action.label}</h3>
              <p className={cn('mt-1 text-[11px] font-semibold leading-relaxed', action.highlight ? 'text-black/60' : 'text-white/45')}>
                {action.description}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
