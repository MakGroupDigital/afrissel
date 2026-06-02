import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { onValue, ref } from 'firebase/database';
import { AfriSellIcon, AfriSellIconName } from '../components/AfriSellIcon';
import { useFirebaseAuth } from '../hooks/useFirebaseAuth';
import { useAfriMarket } from '../hooks/useAfriMarket';
import { realtimeDb } from '../lib/firebase';
import { cn } from '../lib/utils';

type ModuleId = 'school' | 'med' | 'freelance' | 'biashara' | 'afriai' | 'fpp';

type ModuleSuiteScreenProps = {
  moduleId: ModuleId;
};

type ActionCard = {
  id: string;
  title: string;
  body: string;
  icon: AfriSellIconName;
  requiresAuth?: boolean;
  highlight?: boolean;
};

type TalentProfile = {
  id: string;
  name: string;
  role: string;
  city: string;
  image: string;
  bio: string;
  score: number;
};

const moduleMeta: Record<ModuleId, {
  title: string;
  eyebrow: string;
  logo: string;
  hero: string;
  body: string;
  icon: AfriSellIconName;
}> = {
  school: {
    title: 'AfriSchool',
    eyebrow: 'Education utile',
    logo: '/afrischool.jpeg',
    hero: 'Apprendre, certifier et gagner depuis AfriSell.',
    body: 'Cours video, bibliotheque, tuteur IA et communautes de classe pour former vendeurs, createurs et jeunes talents.',
    icon: 'school'
  },
  med: {
    title: 'AfriMed',
    eyebrow: 'Sante connectee',
    logo: '/afrimed.jpeg',
    hero: 'Orientation medicale, teleconsultation et dossier sante.',
    body: 'Une porte d entree simple vers medecins, centres de proximite, assurances, conseils et suivi personnel.',
    icon: 'health'
  },
  freelance: {
    title: 'A-Freelance',
    eyebrow: 'Talents & missions',
    logo: '/a-freelance.jpeg',
    hero: 'Trouver un talent, proposer un service, signer une mission.',
    body: 'Profils professionnels, missions, reputation, contrats et paiements relies a AfriChat et AfriSpay.',
    icon: 'work'
  },
  biashara: {
    title: 'Biashara',
    eyebrow: 'Business & partenaires',
    logo: '/biashara.jpeg',
    hero: 'Transformer une idee en Stand, Vitrine et partenaire.',
    body: 'Assistant business plan, Village d affaires, Kyaghanda, partenariats, showroom et evenements entrepreneurs.',
    icon: 'shield'
  },
  afriai: {
    title: 'AfriAI',
    eyebrow: 'Assistant vocal',
    logo: '/afrissel-icon.jpeg',
    hero: 'Comprendre, traduire et agir dans tout l ecosysteme.',
    body: 'Assistant multilingue pour chercher, expliquer, traduire, guider les achats, paiements, cours et services.',
    icon: 'language'
  },
  fpp: {
    title: 'FPP',
    eyebrow: 'Impact transparent',
    logo: '/afrissel-icon.jpeg',
    hero: 'Financer education, sante et paix par le commerce.',
    body: 'Contribution volontaire depuis les Stands, projets publics, suivi transparent, AfriCoin et mobilisation communautaire.',
    icon: 'heart'
  }
};

const actionCatalog: Record<ModuleId, ActionCard[]> = {
  school: [
    { id: 'cours', title: 'Commencer un cours', body: 'Parcours video court pour vendre, gerer et creer.', icon: 'video' },
    { id: 'tuteur', title: 'Tuteur AfriAI', body: 'Poser une question et recevoir une orientation.', icon: 'language' },
    { id: 'classe', title: 'Classe communautaire', body: 'Rejoindre une cohorte ou un formateur.', icon: 'chat', requiresAuth: true }
  ],
  med: [
    { id: 'teleconsultation', title: 'Teleconsultation', body: 'Ouvrir une demande de soin a distance.', icon: 'health', requiresAuth: true, highlight: true },
    { id: 'dossier', title: 'Dossier sante', body: 'Preparer les informations de suivi.', icon: 'shield', requiresAuth: true },
    { id: 'pharmacie', title: 'Pharmacie & soins', body: 'Chercher produits et services sante.', icon: 'market' }
  ],
  freelance: [
    { id: 'publier-service', title: 'Publier un service', body: 'Presenter ton offre freelance.', icon: 'video', requiresAuth: true, highlight: true },
    { id: 'paiement-mission', title: 'Recevoir paiement', body: 'Encaisser une mission avec AfriSpay.', icon: 'pay', requiresAuth: true },
    { id: 'demandes-clients', title: 'Demandes clients', body: 'Gerer les demandes entrantes.', icon: 'chat', requiresAuth: true }
  ],
  biashara: [
    { id: 'stand-business', title: 'Stand business', body: 'Configurer ton compte professionnel.', icon: 'work', requiresAuth: true, highlight: true },
    { id: 'vitrine-business', title: 'Vitrine Market', body: 'Mettre une offre visible aux partenaires.', icon: 'market', requiresAuth: true },
    { id: 'kyaghanda', title: 'Kyaghanda', body: 'Animer prospects et partenaires.', icon: 'chat', requiresAuth: true }
  ],
  afriai: [
    { id: 'chercher-app', title: 'Chercher une app', body: 'Trouver le bon module pour ton besoin.', icon: 'search' },
    { id: 'traduction', title: 'Traduction', body: 'Preparer la conversation multilingue.', icon: 'chat', requiresAuth: true },
    { id: 'guide-achat', title: 'Guide achat', body: 'Explorer produits et services.', icon: 'market' }
  ],
  fpp: [
    { id: 'contribuer', title: 'Contribuer', body: 'Soutenir un projet avec AfriSpay.', icon: 'pay', requiresAuth: true, highlight: true },
    { id: 'vente-fpp', title: 'Vendre avec FPP', body: 'Affecter une part sociale.', icon: 'market', requiresAuth: true },
    { id: 'mobiliser', title: 'Partager', body: 'Mobiliser ta communaute.', icon: 'share', requiresAuth: true }
  ]
};

const getModuleActionRoute = (moduleId: ModuleId, actionId: string) => `/${moduleId}/${actionId}`;

const schoolTracks = [
  { title: 'Vendre avec video', level: 'Debutant', progress: 28, image: '/biashara.jpeg' },
  { title: 'Gestion boutique', level: 'Business', progress: 44, image: '/afrimarket.jpeg' },
  { title: 'Paiement & securite', level: 'Essentiel', progress: 18, image: '/afrispay.jpeg' }
];

const medServices = [
  { title: 'Medecin generaliste', tag: 'Orientation', delay: '15 min' },
  { title: 'Pharmacie partenaire', tag: 'Produits', delay: 'Ouvert' },
  { title: 'Assurance & carte sante', tag: 'Couverture', delay: 'Bientot' }
];

const fppProjects = [
  { title: 'Kits scolaires locaux', area: 'Education', percent: 62 },
  { title: 'Consultations communautaires', area: 'Sante', percent: 38 },
  { title: 'Autonomie des jeunes', area: 'Paix & emploi', percent: 51 }
];

const getText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

function ModuleShell({ moduleId, children }: { moduleId: ModuleId; children: ReactNode }) {
  const meta = moduleMeta[moduleId];

  return (
    <main className="min-h-full bg-[#050705] px-4 pb-8 pt-4 text-white">
      <header className="flex items-center justify-between">
        <Link to="/apps" className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-[#15EA3E]" aria-label="Retour">
          <AfriSellIcon name="arrow" size={18} className="rotate-180" />
        </Link>
        <div className="text-right">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">{meta.eyebrow}</p>
          <h1 className="mt-1 text-xl font-black tracking-normal">{meta.title}</h1>
        </div>
      </header>

      <section className="relative mt-6 overflow-hidden rounded-[1.7rem] border border-[#15EA3E]/20 bg-[#0A0F0A] p-5 shadow-[0_18px_42px_rgba(0,0,0,0.34)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_18%,rgba(21,234,62,0.2),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.06),transparent_46%)]" />
        <div className="relative z-10 flex items-center gap-4">
          <img src={meta.logo} alt={meta.title} className="h-20 w-20 rounded-[1.5rem] object-cover" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[#15EA3E]">
              <AfriSellIcon name={meta.icon} size={17} />
              <span className="text-[10px] font-black uppercase tracking-[0.18em]">Module AfriSell</span>
            </div>
            <h2 className="mt-2 text-2xl font-black leading-tight">{meta.hero}</h2>
            <p className="mt-2 line-clamp-3 text-xs font-semibold leading-relaxed text-white/52">{meta.body}</p>
          </div>
        </div>
      </section>

      {children}
    </main>
  );
}

function ModuleActions({ moduleId }: { moduleId: ModuleId }) {
  const { user } = useFirebaseAuth();

  return (
    <section className="mt-5 grid grid-cols-3 gap-2">
      {actionCatalog[moduleId].map((action) => {
        const actionRoute = getModuleActionRoute(moduleId, action.id);
        const route = action.requiresAuth && !user ? '/login' : actionRoute;
        return (
          <Link
            key={action.title}
            to={route}
            state={action.requiresAuth && !user ? { next: actionRoute } : undefined}
            className={cn(
              'min-h-[108px] rounded-[1.15rem] border p-3 active:scale-[0.98]',
              action.highlight
                ? 'border-[#15EA3E]/30 bg-[#15EA3E] text-black'
                : 'border-white/10 bg-white/[0.04] text-white'
            )}
          >
            <AfriSellIcon name={action.icon} size={19} className={action.highlight ? 'text-black' : 'text-[#15EA3E]'} />
            <h3 className="mt-3 line-clamp-2 text-[11px] font-black leading-tight">{action.title}</h3>
            <p className={cn('mt-1 line-clamp-2 text-[9px] font-semibold leading-snug', action.highlight ? 'text-black/58' : 'text-white/42')}>
              {action.body}
            </p>
          </Link>
        );
      })}
    </section>
  );
}

function SchoolModule() {
  return (
    <ModuleShell moduleId="school">
      <ModuleActions moduleId="school" />
      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/52">Parcours actifs</h2>
          <Link to="/afriai" className="text-[10px] font-black text-[#15EA3E]">Tuteur IA</Link>
        </div>
        <div className="space-y-3">
          {schoolTracks.map((track) => (
            <article key={track.title} className="overflow-hidden rounded-[1.3rem] border border-white/10 bg-white/[0.04]">
              <div className="flex gap-3 p-3">
                <img src={track.image} alt="" className="h-16 w-16 rounded-2xl object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black">{track.title}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#15EA3E]">{track.level}</p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-[#15EA3E]" style={{ width: `${track.progress}%` }} />
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </ModuleShell>
  );
}

function MedModule() {
  return (
    <ModuleShell moduleId="med">
      <ModuleActions moduleId="med" />
      <section className="mt-6">
        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/52">Services sante</h2>
        <div className="mt-3 space-y-3">
          {medServices.map((service, index) => (
            <Link key={service.title} to={index === 0 ? '/med/teleconsultation' : index === 1 ? '/med/pharmacie' : '/med/dossier'} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 active:scale-[0.98]">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#15EA3E]/10 text-[#15EA3E]">
                <AfriSellIcon name="health" size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-black">{service.title}</span>
                <span className="mt-1 block text-[10px] font-bold uppercase tracking-wider text-white/42">{service.tag}</span>
              </span>
              <span className="rounded-full bg-[#15EA3E]/10 px-3 py-1 text-[9px] font-black text-[#15EA3E]">{service.delay}</span>
            </Link>
          ))}
        </div>
      </section>
    </ModuleShell>
  );
}

function FreelanceModule() {
  const { user } = useFirebaseAuth();
  const [talents, setTalents] = useState<TalentProfile[]>([]);

  useEffect(() => {
    const usersRef = ref(realtimeDb, 'users');
    const unsubscribe = onValue(usersRef, (snapshot) => {
      const users = snapshot.val() as Record<string, Record<string, unknown>> | null;
      const nextTalents = Object.entries(users || {})
        .map(([uid, rawProfile]): TalentProfile | null => {
          const businessAccount = rawProfile.businessAccount as Record<string, unknown> | undefined;
          const businessAccounts = Object.values((rawProfile.businessAccounts as Record<string, Record<string, unknown>> | undefined) || {});
          const freelanceAccount = [businessAccount, ...businessAccounts].find((account) => (
            getText(account?.serviceId) === 'freelance' || getText(account?.segmentId) === 'freelance'
          ));
          const isFreelance = Boolean(freelanceAccount) || ['freelancer', 'creative', 'tech_service', 'local_service'].includes(getText(rawProfile.primarySubtype));
          if (!isFreelance) return null;

          return {
            id: uid,
            name: getText(rawProfile.displayName) || getText(rawProfile.businessName) || 'Talent AfriSell',
            role: getText(freelanceAccount?.segmentLabel) || getText(freelanceAccount?.serviceLabel) || 'Freelance',
            city: getText(rawProfile.city) || getText(rawProfile.country) || 'AfriSell',
            image: getText(rawProfile.photoURL) || getText(rawProfile.logoURL) || '/a-freelance.jpeg',
            bio: getText(rawProfile.bio) || 'Services professionnels disponibles sur A-Freelance.',
            score: Number(rawProfile.freelanceScore || rawProfile.rating || rawProfile.recommendations || 0)
          };
        })
        .filter((talent): talent is TalentProfile => Boolean(talent))
        .sort((first, second) => second.score - first.score || first.name.localeCompare(second.name));

      setTalents(nextTalents);
    });

    return unsubscribe;
  }, []);

  return (
    <ModuleShell moduleId="freelance">
      <ModuleActions moduleId="freelance" />
      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/52">Talents reels</h2>
          <span className="text-[10px] font-black text-[#15EA3E]">{talents.length} actif(s)</span>
        </div>
        {talents.length ? (
          <div className="scrollbar-hide flex gap-3 overflow-x-auto pb-1">
            {talents.map((talent) => {
              const chatRoute = `/chat?contact=${encodeURIComponent(talent.id)}&name=${encodeURIComponent(talent.name)}&status=${encodeURIComponent(`${talent.role} - ${talent.city}`)}&avatar=${encodeURIComponent(talent.image)}`;
              return (
                <article key={talent.id} className="w-[178px] shrink-0 overflow-hidden rounded-[1.3rem] border border-white/10 bg-white/[0.04]">
                  <img src={talent.image} alt={talent.name} className="h-32 w-full object-cover" />
                  <div className="p-3">
                    <h3 className="truncate text-sm font-black">{talent.name}</h3>
                    <p className="mt-1 truncate text-[10px] font-bold text-[#15EA3E]">{talent.role}</p>
                    <p className="mt-2 line-clamp-2 text-[10px] font-semibold leading-snug text-white/45">{talent.bio}</p>
                    <Link to={user ? chatRoute : '/login'} state={!user ? { next: chatRoute } : undefined} className="mt-3 flex h-9 items-center justify-center rounded-xl bg-[#15EA3E] text-[10px] font-black uppercase tracking-wider text-black">
                      Contacter
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-[1.3rem] border border-white/10 bg-white/[0.04] p-5 text-center">
            <p className="text-sm font-black">Aucun freelance reel pour le moment</p>
            <p className="mt-2 text-xs font-semibold leading-relaxed text-white/45">Les profils business freelance apparaitront ici automatiquement.</p>
          </div>
        )}
      </section>
    </ModuleShell>
  );
}

function BiasharaModule() {
  const [idea, setIdea] = useState('');
  const [market, setMarket] = useState('');
  const [plan, setPlan] = useState('');

  const generatePlan = (event: FormEvent) => {
    event.preventDefault();
    const cleanIdea = idea.trim() || 'une activite locale';
    const cleanMarket = market.trim() || 'clients AfriSell';
    setPlan(`Plan rapide: valider ${cleanIdea} avec 10 clients ${cleanMarket}, publier une offre test dans ABC, mesurer les demandes via AfriChat, encaisser via AfriSpay puis chercher partenaires dans Biashara.`);
  };

  return (
    <ModuleShell moduleId="biashara">
      <ModuleActions moduleId="biashara" />
      <section className="mt-6 rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-4">
        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/52">Assistant business plan</h2>
        <form onSubmit={generatePlan} className="mt-4 space-y-3">
          <input value={idea} onChange={(event) => setIdea(event.target.value)} placeholder="Idee ou service" className="h-12 w-full rounded-2xl border border-white/10 bg-black/24 px-4 text-xs font-bold text-white outline-none focus:border-[#15EA3E]/50" />
          <input value={market} onChange={(event) => setMarket(event.target.value)} placeholder="Client cible" className="h-12 w-full rounded-2xl border border-white/10 bg-black/24 px-4 text-xs font-bold text-white outline-none focus:border-[#15EA3E]/50" />
          <button type="submit" className="h-12 w-full rounded-2xl bg-[#15EA3E] text-xs font-black uppercase tracking-widest text-black">Creer le plan</button>
        </form>
        {plan && <p className="mt-4 rounded-2xl border border-[#15EA3E]/20 bg-[#15EA3E]/10 p-3 text-xs font-semibold leading-relaxed text-white/72">{plan}</p>}
      </section>
    </ModuleShell>
  );
}

function AfriAiModule() {
  const navigate = useNavigate();
  const { abcContents, marketProducts } = useAfriMarket();
  const [prompt, setPrompt] = useState('');
  const suggestions = useMemo(() => [
    { label: 'Je veux acheter', route: '/afriai/guide-achat', icon: 'market' as AfriSellIconName },
    { label: 'Je veux vendre', route: '/biashara/vitrine-business', icon: 'video' as AfriSellIconName },
    { label: 'Je veux payer', route: '/fpp/contribuer', icon: 'pay' as AfriSellIconName },
    { label: 'Je veux apprendre', route: '/school/cours', icon: 'school' as AfriSellIconName },
    { label: 'Je cherche un talent', route: '/freelance/demandes-clients', icon: 'work' as AfriSellIconName },
  ], []);
  const result = useMemo(() => {
    const query = prompt.trim().toLowerCase();
    if (!query) return '';
    if (query.includes('payer') || query.includes('depot') || query.includes('retrait')) return 'Va dans AfriSpay pour payer, deposer, retirer ou scanner un QR.';
    if (query.includes('cours') || query.includes('apprendre')) return 'AfriSchool peut te proposer un parcours court, puis AfriAI t aide comme tuteur.';
    if (query.includes('sante') || query.includes('medecin')) return 'AfriMed est le bon module pour orientation, teleconsultation et dossier sante.';
    if (query.includes('travail') || query.includes('freelance')) return 'A-Freelance relie talents, missions, contrats, chat et paiement.';
    const match = [...marketProducts, ...abcContents].find((item) => `${item.title} ${item.category}`.toLowerCase().includes(query));
    return match ? `J ai trouve: ${match.title}. Ouvre le resultat pour continuer.` : 'Je peux te guider vers Market, ABC, AfriSpay, AfriSchool, AfriMed ou A-Freelance selon ton besoin.';
  }, [abcContents, marketProducts, prompt]);

  return (
    <ModuleShell moduleId="afriai">
      <section className="mt-5 rounded-[1.4rem] border border-[#15EA3E]/20 bg-[#0A0F0A] p-4">
        <form onSubmit={(event) => event.preventDefault()} className="flex gap-2">
          <input value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Parle ou ecris ton besoin..." className="h-12 min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/24 px-4 text-xs font-bold text-white outline-none focus:border-[#15EA3E]/50" />
          <button type="button" onClick={() => setPrompt('')} className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#15EA3E] text-black">
            <AfriSellIcon name="language" size={18} />
          </button>
        </form>
        {result && <p className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-xs font-semibold leading-relaxed text-white/68">{result}</p>}
      </section>
      <section className="mt-5 grid grid-cols-2 gap-3">
        {suggestions.map((suggestion) => (
          <button key={suggestion.label} type="button" onClick={() => navigate(suggestion.route)} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left active:scale-[0.98]">
            <AfriSellIcon name={suggestion.icon} size={18} className="text-[#15EA3E]" />
            <span className="text-xs font-black">{suggestion.label}</span>
          </button>
        ))}
      </section>
    </ModuleShell>
  );
}

function FppModule() {
  return (
    <ModuleShell moduleId="fpp">
      <ModuleActions moduleId="fpp" />
      <section className="mt-6">
        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/52">Projets soutenus</h2>
        <div className="mt-3 space-y-3">
          {fppProjects.map((project) => (
            <article key={project.title} className="rounded-[1.3rem] border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black">{project.title}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#15EA3E]">{project.area}</p>
                </div>
                <span className="text-lg font-black text-[#15EA3E]">{project.percent}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-[#15EA3E]" style={{ width: `${project.percent}%` }} />
              </div>
            </article>
          ))}
        </div>
      </section>
    </ModuleShell>
  );
}

const actionSteps: Record<ModuleId, Record<string, Array<{ title: string; body: string; icon: AfriSellIconName }>>> = {
  school: {
    cours: [
      { title: 'Choisir un parcours', body: 'Selectionne vente video, gestion boutique ou paiement securise.', icon: 'school' },
      { title: 'Apprendre par capsules', body: 'Avance avec des lecons courtes adaptees au reseau mobile.', icon: 'video' },
      { title: 'Valider la competence', body: 'Termine par une certification interne AfriSchool.', icon: 'check' }
    ],
    tuteur: [
      { title: 'Poser la question', body: 'Ecris le probleme ou dicte-le dans la prochaine version vocale.', icon: 'language' },
      { title: 'Recevoir une explication', body: 'AfriAI oriente vers une lecon, un module ou une action.', icon: 'flash' },
      { title: 'Continuer le cours', body: 'La reponse reste liee au parcours AfriSchool.', icon: 'school' }
    ],
    classe: [
      { title: 'Choisir une cohorte', body: 'Rejoins une classe par theme, ville ou objectif.', icon: 'profile' },
      { title: 'Suivre les annonces', body: 'Les activites de classe restent dans AfriSchool.', icon: 'notifications' },
      { title: 'Projet final', body: 'Publie un Stand ou une Vitrine apres validation.', icon: 'market' }
    ]
  },
  med: {
    teleconsultation: [
      { title: 'Decrire le besoin', body: 'Indique symptomes, ville, urgence et langue preferee.', icon: 'health' },
      { title: 'Orientation AfriMed', body: 'AfriMed prepare le type de praticien ou centre adapte.', icon: 'shield' },
      { title: 'Demande medicale', body: 'La demande reste dans le dossier AfriMed avant contact.', icon: 'check' }
    ],
    dossier: [
      { title: 'Identite sante', body: 'Renseigne les informations utiles au suivi.', icon: 'profile' },
      { title: 'Historique', body: 'Ajoute consultations, allergies et traitements.', icon: 'order' },
      { title: 'Confidentialite', body: 'Controle ce qui peut etre partage avec un praticien.', icon: 'shield' }
    ],
    pharmacie: [
      { title: 'Chercher un soin', body: 'Filtre par besoin: pharmacie, laboratoire ou centre.', icon: 'search' },
      { title: 'Verifier disponibilite', body: 'AfriMed prepare les offres sante proches.', icon: 'market' },
      { title: 'Commander ou reserver', body: 'La suite reste reliee au parcours sante.', icon: 'cart' }
    ]
  },
  freelance: {
    'publier-service': [
      { title: 'Definir le service', body: 'Titre, prix, delai, ville, competence et portfolio.', icon: 'work' },
      { title: 'Creer la fiche mission', body: 'A-Freelance cree une offre de service, pas un produit Market.', icon: 'app' },
      { title: 'Recevoir demandes', body: 'Les clients peuvent demander un devis dans A-Freelance.', icon: 'chat' }
    ],
    'paiement-mission': [
      { title: 'Choisir une mission', body: 'Selectionne la mission ou le client a facturer.', icon: 'order' },
      { title: 'Creer facture', body: 'AfriSpay prepare une facture mission avec escrow.', icon: 'pay' },
      { title: 'Liberation', body: 'Le paiement est libere apres validation du travail.', icon: 'shield' }
    ],
    'demandes-clients': [
      { title: 'Boite de demandes', body: 'Consulte les demandes de mission recues.', icon: 'notifications' },
      { title: 'Qualifier', body: 'Accepte, refuse ou demande plus d informations.', icon: 'check' },
      { title: 'Transformer en mission', body: 'Une demande acceptee devient mission A-Freelance.', icon: 'work' }
    ]
  },
  biashara: {
    'stand-business': [
      { title: 'Choisir le type', body: 'Commerce, paiement, logistique, service ou media ABC.', icon: 'hub' },
      { title: 'Configurer le Stand', body: 'Ajoute nom, categorie, role et zone de service.', icon: 'work' },
      { title: 'Activer le dashboard', body: 'Le Stand ouvre un tableau de bord adapte.', icon: 'app' }
    ],
    'vitrine-business': [
      { title: 'Construire la Vitrine', body: 'Presente offre, histoire, prix et preuves.', icon: 'market' },
      { title: 'Associer partenaires', body: 'Lie fournisseurs, clients ou distributeurs.', icon: 'follow' },
      { title: 'Publier dans Biashara', body: 'La Vitrine devient visible aux partenaires business.', icon: 'check' }
    ],
    kyaghanda: [
      { title: 'Creer le cercle', body: 'Regroupe partenaires, investisseurs ou entrepreneurs.', icon: 'profile' },
      { title: 'Fixer l objectif', body: 'Partenariat, achat groupe, financement ou evenement.', icon: 'shield' },
      { title: 'Animer le Kyaghanda', body: 'Suivi des decisions, opportunites et engagements.', icon: 'chat' }
    ]
  },
  afriai: {
    'chercher-app': [
      { title: 'Comprendre le besoin', body: 'AfriAI identifie l intention de l utilisateur.', icon: 'language' },
      { title: 'Choisir le module', body: 'Il propose ABC, Market, AfriMed, School ou autre.', icon: 'hub' },
      { title: 'Guider l action', body: 'Il ouvre la suite exacte dans le bon module.', icon: 'arrow' }
    ],
    traduction: [
      { title: 'Choisir les langues', body: 'Francais, Lingala, Swahili, Wolof ou anglais.', icon: 'language' },
      { title: 'Preparer le contexte', body: 'Commerce, sante, ecole ou service client.', icon: 'chat' },
      { title: 'Traduire dans le module', body: 'La traduction accompagne la conversation cible.', icon: 'check' }
    ],
    'guide-achat': [
      { title: 'Analyser le besoin', body: 'Budget, lieu, categorie et urgence.', icon: 'search' },
      { title: 'Comparer les Stands', body: 'AfriAI classe Prix Village, confiance et livraison.', icon: 'market' },
      { title: 'Continuer vers achat', body: 'Le guide peut ouvrir le produit recommande.', icon: 'cart' }
    ]
  },
  fpp: {
    contribuer: [
      { title: 'Choisir un projet', body: 'Education, sante, paix, emploi ou communaute.', icon: 'heart' },
      { title: 'Definir contribution', body: 'Montant direct, AfriCoin ou part de vente.', icon: 'pay' },
      { title: 'Suivre impact', body: 'Chaque contribution alimente le tableau FPP.', icon: 'shield' }
    ],
    'vente-fpp': [
      { title: 'Selectionner le Stand', body: 'Choisis l offre qui contribue au FPP.', icon: 'market' },
      { title: 'Fixer le pourcentage', body: 'Ajoute la contribution sociale sur la vente.', icon: 'heart' },
      { title: 'Afficher transparence', body: 'Le client voit le projet soutenu avant achat.', icon: 'check' }
    ],
    mobiliser: [
      { title: 'Choisir la campagne', body: 'Selectionne le projet a mobiliser.', icon: 'heart' },
      { title: 'Creer message', body: 'Prepare un message clair pour la communaute.', icon: 'share' },
      { title: 'Suivre recommandations', body: 'Mesure partages, soutiens et conversions.', icon: 'star' }
    ]
  }
};

function ModuleActionDetail({ moduleId, actionId }: { moduleId: ModuleId; actionId: string }) {
  const { user } = useFirebaseAuth();
  const action = actionCatalog[moduleId].find((item) => item.id === actionId);
  const steps = actionSteps[moduleId][actionId];
  const meta = moduleMeta[moduleId];

  if (!action || !steps) {
    return (
      <ModuleShell moduleId={moduleId}>
        <section className="mt-6 rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-5 text-center">
          <h2 className="text-lg font-black">Action introuvable</h2>
          <p className="mt-2 text-xs font-semibold text-white/50">Cette suite n existe pas encore dans {meta.title}.</p>
          <Link to={`/${moduleId}`} className="mt-5 inline-flex rounded-2xl bg-[#15EA3E] px-5 py-3 text-xs font-black uppercase tracking-wider text-black">
            Retour module
          </Link>
        </section>
      </ModuleShell>
    );
  }

  if (action.requiresAuth && !user) {
    return (
      <ModuleShell moduleId={moduleId}>
        <section className="mt-6 rounded-[1.4rem] border border-[#15EA3E]/20 bg-[#15EA3E]/10 p-5 text-center">
          <AfriSellIcon name="lock" size={28} className="mx-auto text-[#15EA3E]" />
          <h2 className="mt-4 text-lg font-black">Connexion requise</h2>
          <p className="mt-2 text-xs font-semibold leading-relaxed text-white/55">Connecte-toi pour continuer cette action dans {meta.title}.</p>
          <Link to="/login" state={{ next: getModuleActionRoute(moduleId, action.id) }} className="mt-5 inline-flex rounded-2xl bg-[#15EA3E] px-5 py-3 text-xs font-black uppercase tracking-wider text-black">
            Se connecter
          </Link>
        </section>
      </ModuleShell>
    );
  }

  return (
    <ModuleShell moduleId={moduleId}>
      <section className="mt-5 rounded-[1.4rem] border border-[#15EA3E]/20 bg-[#0A0F0A] p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#15EA3E] text-black">
            <AfriSellIcon name={action.icon} size={21} />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#15EA3E]">{meta.title}</p>
            <h2 className="mt-1 text-xl font-black leading-tight">{action.title}</h2>
            <p className="mt-1 text-xs font-semibold leading-relaxed text-white/52">{action.body}</p>
          </div>
        </div>
      </section>

      <section className="mt-5 space-y-3">
        {steps.map((step, index) => (
          <article key={step.title} className="flex gap-3 rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#15EA3E]/10 text-[#15EA3E]">
              <AfriSellIcon name={step.icon} size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#15EA3E]">Etape {index + 1}</p>
              <h3 className="mt-1 text-sm font-black">{step.title}</h3>
              <p className="mt-1 text-xs font-semibold leading-relaxed text-white/48">{step.body}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="mt-5 grid grid-cols-2 gap-3">
        <Link to={`/${moduleId}`} className="flex h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-xs font-black uppercase tracking-wider text-white/65">
          Retour
        </Link>
        <button type="button" className="flex h-12 items-center justify-center rounded-2xl bg-[#15EA3E] text-xs font-black uppercase tracking-wider text-black">
          Continuer
        </button>
      </section>
    </ModuleShell>
  );
}

export default function ModuleSuiteScreen({ moduleId }: ModuleSuiteScreenProps) {
  if (moduleId === 'school') return <SchoolModule />;
  if (moduleId === 'med') return <MedModule />;
  if (moduleId === 'freelance') return <FreelanceModule />;
  if (moduleId === 'biashara') return <BiasharaModule />;
  if (moduleId === 'afriai') return <AfriAiModule />;
  return <FppModule />;
}

export function ModuleActionScreen({ moduleId }: ModuleSuiteScreenProps) {
  const { actionId = '' } = useParams();
  return <ModuleActionDetail moduleId={moduleId} actionId={actionId} />;
}
