import { Link, useNavigate } from 'react-router-dom';
import { AfriSellIcon, AfriSellIconName } from '../components/AfriSellIcon';
import { useFirebaseAuth } from '../hooks/useFirebaseAuth';
import { cn } from '../lib/utils';

type BusinessAccount = {
  accountKey?: string;
  categoryId?: string;
  categoryLabel?: string;
  moduleName?: string;
  serviceId?: string;
  serviceLabel?: string;
  segmentId?: string;
  segmentLabel?: string;
};

type CreationOption = {
  id: string;
  title: string;
  shortLabel: string;
  icon: AfriSellIconName;
  route: string;
  tone: string;
  requiresBusiness?: boolean;
  requiredAccount?: string;
  requestRoute?: string;
};

const getBusinessAccounts = (profile: ReturnType<typeof useFirebaseAuth>['profile']) => {
  const accounts = [
    profile?.businessAccount,
    ...Object.entries(profile?.businessAccounts || {}).map(([accountKey, account]) => (
      account && typeof account === 'object'
        ? { accountKey, ...account }
        : { accountKey }
    ))
  ].filter(Boolean) as BusinessAccount[];

  return accounts;
};

const normalizeAccessText = (value: unknown) => String(value || '').trim().toLowerCase();

const accountMatchesAny = (account: BusinessAccount, values: Set<string>) => {
  const fields = [
    account.accountKey,
    account.categoryId,
    account.categoryLabel,
    account.moduleName,
    account.serviceId,
    account.serviceLabel,
    account.segmentId,
    account.segmentLabel
  ].map(normalizeAccessText);

  return fields.some((field) => (
    values.has(field) ||
    Array.from(values).some((value) => field.includes(value))
  ));
};

const commerceAccessValues = new Set([
  'commerce',
  'e-commerce',
  'market',
  'marché',
  'marche',
  'abc + market',
  'store',
  'boutique',
  'supplier',
  'fournisseur',
  'producer',
  'producteur',
  'retailer',
  'grossiste',
  'wholesaler',
  'seller',
  'vendeur'
]);

const serviceAccessValues = new Set([
  'services',
  'services professionnels',
  'provider',
  'prestataire',
  'freelance',
  'a-freelance',
  'creative',
  'tech_service',
  'local_service',
  'health',
  'santé',
  'sante',
  'education',
  'éducation',
  'school',
  'transport_provider',
  'real_estate_provider',
  'service_provider',
  'health_provider',
  'school_provider'
]);

const hasAccountAccess = (profile: ReturnType<typeof useFirebaseAuth>['profile'], requiredAccount?: string) => {
  if (!requiredAccount) return true;
  const primaryRole = normalizeAccessText(profile?.primaryRole);
  const primarySubtype = normalizeAccessText(profile?.primarySubtype);
  const roles = (profile?.roles || []).map(normalizeAccessText);
  const roleSubtypes = Object.values(profile?.roleSubtypes || {}).map(normalizeAccessText);
  const accounts = getBusinessAccounts(profile);

  if (requiredAccount === 'commerce') {
    if (['seller', 'business'].includes(primaryRole) || roles.some((role) => ['seller', 'business'].includes(role))) return true;
    if (commerceAccessValues.has(primarySubtype) || roleSubtypes.some((subtype) => commerceAccessValues.has(subtype))) return true;
    return accounts.some((account) => accountMatchesAny(account, commerceAccessValues));
  }

  if (requiredAccount === 'services') {
    if (['provider', 'business'].includes(primaryRole) || roles.some((role) => ['provider', 'business'].includes(role))) return true;
    if (serviceAccessValues.has(primarySubtype) || roleSubtypes.some((subtype) => serviceAccessValues.has(subtype))) return true;
    return accounts.some((account) => accountMatchesAny(account, serviceAccessValues));
  }

  return accounts.some((account) => accountMatchesAny(account, new Set([requiredAccount])));
};

const creationOptions: CreationOption[] = [
  {
    id: 'media',
    title: 'Publication média',
    shortLabel: 'Photo, vidéo',
    icon: 'camera',
    route: '/create?intent=media',
    tone: 'from-[#15EA3E]/24 to-white/[0.04]'
  },
  {
    id: 'text',
    title: 'Poste texte',
    shortLabel: 'Texte simple',
    icon: 'edit',
    route: '/create?intent=text',
    tone: 'from-white/[0.12] to-[#15EA3E]/8'
  },
  {
    id: 'product',
    title: 'Produit ou article',
    shortLabel: 'Marché',
    icon: 'market',
    route: '/create?intent=product',
    tone: 'from-[#15EA3E]/22 to-[#050705]',
    requiresBusiness: true,
    requiredAccount: 'commerce',
    requestRoute: '/profile?panel=business&request=commerce'
  },
  {
    id: 'service',
    title: 'Offre de service',
    shortLabel: 'Services',
    icon: 'work',
    route: '/create?intent=offer',
    tone: 'from-amber-300/18 to-[#15EA3E]/8',
    requiresBusiness: true,
    requiredAccount: 'services',
    requestRoute: '/profile?panel=business&request=services'
  }
];

const moduleScopes = [
  { label: 'ABC', route: '/create?intent=media&module=abc', icon: 'video' as const },
  { label: 'Marché', route: '/create?intent=product&module=market', icon: 'market' as const, requiredAccount: 'commerce' },
  { label: 'Zandofy', route: '/create?intent=product&module=zandofy', icon: 'app' as const, requiredAccount: 'commerce' },
  { label: 'Safari', route: '/create?intent=offer&module=Safari', icon: 'send' as const, requiredAccount: 'services' },
  { label: 'A-Freelance', route: '/create?intent=offer&module=A-Freelance', icon: 'work' as const, requiredAccount: 'services' },
  { label: 'AfriSchool', route: '/create?intent=offer&module=AfriSchool', icon: 'school' as const, requiredAccount: 'services' }
];

export default function CreateHubScreen() {
  const navigate = useNavigate();
  const { profile } = useFirebaseAuth();

  return (
    <main className="relative flex h-full flex-col overflow-hidden bg-[#050705] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_6%,rgba(21,234,62,0.22),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.04),transparent_34%)]" />
      <header className="relative z-10 flex shrink-0 items-center justify-between px-4 pb-3 pt-5">
        <button type="button" onClick={() => navigate(-1)} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-white/72">
          <AfriSellIcon name="close" size={16} />
        </button>
        <div className="text-center">
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">Créer</p>
          <h1 className="text-sm font-black">AfriStudio</h1>
        </div>
        <Link to="/profile?panel=business" className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#15EA3E] text-black">
          <AfriSellIcon name="account" size={16} />
        </Link>
      </header>

      <section className="relative z-10 min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-2 scrollbar-hide">
        <div className="grid grid-cols-2 gap-3">
          {creationOptions.map((option) => {
            const allowed = !option.requiresBusiness || hasAccountAccess(profile, option.requiredAccount);
            const route = allowed ? option.route : option.requestRoute || '/profile?panel=business';

            return (
              <Link
                key={option.id}
                to={route}
                className={cn(
                  'relative min-h-[132px] overflow-hidden rounded-[1.35rem] border p-3 active:scale-[0.98]',
                  allowed ? 'border-white/10 bg-white/[0.045]' : 'border-amber-300/20 bg-amber-300/[0.06]'
                )}
              >
                <div className={cn('absolute inset-0 bg-gradient-to-br opacity-100', option.tone)} />
                <div className="relative z-10 flex h-full flex-col justify-between gap-3">
                  <span className={cn(
                    'flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.15rem] shadow-[0_12px_24px_rgba(0,0,0,0.28)]',
                    allowed ? 'bg-[#15EA3E] text-black' : 'bg-amber-300 text-black'
                  )}>
                    <AfriSellIcon name={option.icon} size={21} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-black leading-tight text-white">{option.title}</span>
                    <span className={cn('mt-1 inline-flex rounded-full px-2 py-1 text-[8px] font-black uppercase tracking-wider', allowed ? 'bg-white/[0.07] text-white/48' : 'bg-amber-300/16 text-amber-100')}>
                      {allowed ? option.shortLabel : 'Accès requis'}
                    </span>
                  </span>
                  <AfriSellIcon name="arrow" size={13} className={cn('absolute right-0 top-0', allowed ? 'text-[#15EA3E]' : 'text-amber-200')} />
                </div>
              </Link>
            );
          })}
        </div>

        <section className="mt-5 rounded-[1.35rem] border border-white/10 bg-white/[0.035] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/42">Publier pour</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {moduleScopes.map((scope) => {
              const allowed = !scope.requiredAccount || hasAccountAccess(profile, scope.requiredAccount);
              const route = allowed
                ? scope.route
                : `/profile?panel=business&request=${scope.requiredAccount}`;

              return (
                <Link key={scope.label} to={route} className={cn(
                  'flex flex-col items-center gap-2 rounded-2xl border p-3 text-center active:scale-[0.98]',
                  allowed ? 'border-white/10 bg-black/22' : 'border-amber-300/18 bg-amber-300/[0.06]'
                )}>
                  <AfriSellIcon name={scope.icon} size={18} className={allowed ? 'text-[#15EA3E]' : 'text-amber-200'} />
                  <span className="max-w-full truncate text-[9px] font-black text-white/58">{scope.label}</span>
                </Link>
              );
            })}
          </div>
        </section>
      </section>
    </main>
  );
}
