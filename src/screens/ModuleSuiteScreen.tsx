import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { onValue, ref, remove, set } from 'firebase/database';
import { AfriSellIcon, AfriSellIconName } from '../components/AfriSellIcon';
import { useFirebaseAuth } from '../hooks/useFirebaseAuth';
import { useAfriMarket } from '../hooks/useAfriMarket';
import { realtimeDb } from '../lib/firebase';
import { cn } from '../lib/utils';
import { createFreelanceMissionRequest } from '../domains/freelance';
import { createBiasharaOpportunity } from '../domains/business';
import { AfriAiIntent, AfriAiResponse, resolveAfriAiRequest } from '../domains/ai';
import { enrollSchoolTrack, joinSchoolClass, updateSchoolProgress } from '../domains/education';
import { createTéléconsultationRequest, saveHealthProfile } from '../domains/health';

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

type FreelanceEngagement = {
  likes?: Record<string, boolean>;
  ratings?: Record<string, number>;
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
    eyebrow: 'Éducation utile',
    logo: '/afrischool.jpeg',
    hero: 'Apprendre, certifier et gagner depuis AfriSell.',
    body: 'Cours vidéo, bibliothèque, tuteur IA et communautés de classe pour former vendeurs, créateurs et jeunes talents.',
    icon: 'school'
  },
  med: {
    title: 'AfriMed',
    eyebrow: 'Santé connectée',
    logo: '/afrimed.jpeg',
    hero: 'Orientation medicale, teleconsultation et dossier santé.',
    body: 'Une porte d entree simple vers médecins, centres de proximité, assurances, conseils et suivi personnel.',
    icon: 'health'
  },
  freelance: {
    title: 'A-Freelance',
    eyebrow: 'Talents & missions',
    logo: '/a-freelance.jpeg',
    hero: 'Trouver un talent, proposer un service, signer une mission.',
    body: 'Profils professionnels, missions, réputation, contrats et paiements reliés à AfriChat et AfriSpay.',
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
    hero: 'Comprendre, traduire et agir dans tout l’écosystème.',
    body: 'Assistant multilingue pour chercher, expliquer, traduire, guider les achats, paiements, cours et services.',
    icon: 'language'
  },
  fpp: {
    title: 'FPP',
    eyebrow: 'Impact transparent',
    logo: '/afrissel-icon.jpeg',
    hero: 'Financer education, santé et paix par le commerce.',
    body: 'Contribution volontaire depuis les Stands, projets publics, suivi transparent, AfriCoin et mobilisation communautaire.',
    icon: 'heart'
  }
};

const actionCatalog: Record<ModuleId, ActionCard[]> = {
  school: [
    { id: 'cours', title: 'Commencer un cours', body: 'Parcours vidéo court pour vendre, gérer et créer.', icon: 'video' },
    { id: 'tuteur', title: 'Tuteur AfriAI', body: 'Poser une question et recevoir une orientation.', icon: 'language' },
    { id: 'classe', title: 'Classe communautaire', body: 'Rejoindre une cohorte ou un formateur.', icon: 'chat', requiresAuth: true }
  ],
  med: [
    { id: 'teleconsultation', title: 'Téléconsultation', body: 'Ouvrir une demande de soin à distance.', icon: 'health', requiresAuth: true, highlight: true },
    { id: 'dossier', title: 'Dossier santé', body: 'Préparer les informations de suivi.', icon: 'shield', requiresAuth: true },
    { id: 'pharmacie', title: 'Pharmacie & soins', body: 'Chercher produits et services santé.', icon: 'market' }
  ],
  freelance: [
    { id: 'publier-service', title: 'Publier un service', body: 'Présenter ton offre freelance.', icon: 'video', requiresAuth: true, highlight: true },
    { id: 'paiement-mission', title: 'Recevoir paiement', body: 'Encaisser une mission avec AfriSpay.', icon: 'pay', requiresAuth: true },
    { id: 'demandes-clients', title: 'Demandes clients', body: 'Gérer les demandes entrantes.', icon: 'chat', requiresAuth: true }
  ],
  biashara: [
    { id: 'stand-business', title: 'Stand business', body: 'Configurer ton compte professionnel.', icon: 'work', requiresAuth: true, highlight: true },
    { id: 'vitrine-business', title: 'Vitrine Market', body: 'Mettre une offre visible aux partenaires.', icon: 'market', requiresAuth: true },
    { id: 'kyaghanda', title: 'Kyaghanda', body: 'Animer prospects et partenaires.', icon: 'chat', requiresAuth: true }
  ],
  afriai: [
    { id: 'chercher-app', title: 'Chercher une app', body: 'Trouver le bon module pour ton besoin.', icon: 'search' },
    { id: 'traduction', title: 'Traduction', body: 'Préparer la conversation multilingue.', icon: 'chat', requiresAuth: true },
    { id: 'guide-achat', title: 'Guide achat', body: 'Explorer produits et services.', icon: 'market' }
  ],
  fpp: [
    { id: 'contribuer', title: 'Contribuer', body: 'Soutenir un projet avec AfriSpay.', icon: 'pay', requiresAuth: true, highlight: true },
    { id: 'vente-fpp', title: 'Vendre avec FPP', body: 'Affecter une part sociale.', icon: 'market', requiresAuth: true },
    { id: 'mobiliser', title: 'Partager', body: 'Mobiliser ta communauté.', icon: 'share', requiresAuth: true }
  ]
};

const getModuleActionRoute = (moduleId: ModuleId, actionId: string) => `/${moduleId}/${actionId}`;

const schoolTracks = [
  { id: 'video-selling', title: 'Vendre avec vidéo', level: 'Débutant', progress: 28, image: '/biashara.jpeg' },
  { id: 'shop-management', title: 'Gestion boutique', level: 'Business', progress: 44, image: '/afrimarket.jpeg' },
  { id: 'payment-security', title: 'Paiement & sécurité', level: 'Essentiel', progress: 18, image: '/afrispay.jpeg' }
];

const medServices = [
  { title: 'Médecin généraliste', tag: 'Orientation', delay: '15 min' },
  { title: 'Pharmacie partenaire', tag: 'Produits', delay: 'Ouvert' },
  { title: 'Assurance & carte santé', tag: 'Couverture', delay: 'Bientôt' }
];

const fppProjects = [
  { title: 'Kits scolaires locaux', area: 'Éducation', percent: 62 },
  { title: 'Consultations communautaires', area: 'Santé', percent: 38 },
  { title: 'Autonomie des jeunes', area: 'Paix & emploi', percent: 51 }
];

const getText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const getActionErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const message = record.message || record.code || record.error;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
};

const getActionContinueRoute = (moduleId: ModuleId, actionId: string) => {
  const routes: Record<ModuleId, Record<string, string>> = {
    school: {
      cours: '/school',
      tuteur: '/afriai',
      classe: '/chat'
    },
    med: {
      teleconsultation: '/med',
      dossier: '/med',
      pharmacie: '/market'
    },
    freelance: {
      'publier-service': '/freelance',
      'paiement-mission': '/wallet?action=transfer',
      'demandes-clients': '/freelance'
    },
    biashara: {
      'stand-business': '/business',
      'vitrine-business': '/biashara',
      kyaghanda: '/chat'
    },
    afriai: {
      'chercher-app': '/apps',
      traduction: '/chat',
      'guide-achat': '/market'
    },
    fpp: {
      contribuer: '/wallet?action=transfer',
      'vente-fpp': '/feed?publish=1',
      mobiliser: '/chat'
    }
  };

  return routes[moduleId][actionId] || `/${moduleId}`;
};

const formatCompactCount = (value: number) => {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K`;
  return String(value);
};

const getFreelanceStats = (engagement?: FreelanceEngagement) => {
  const likes = Object.values(engagement?.likes || {}).filter(Boolean).length;
  const ratings = Object.values(engagement?.ratings || {})
    .map(Number)
    .filter((rating) => Number.isFinite(rating) && rating > 0);
  const ratingCount = ratings.length;
  const ratingAverage = ratingCount
    ? ratings.reduce((total, rating) => total + rating, 0) / ratingCount
    : 0;

  return { likes, ratingAverage, ratingCount };
};

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
  const { user } = useFirebaseAuth();
  const [enrollments, setEnrollments] = useState<Record<string, { progress?: number; status?: string }>>({});
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!user) {
      setEnrollments({});
      return undefined;
    }

    const enrollmentRef = ref(realtimeDb, `schoolEnrollments/${user.uid}`);
    const unsubscribe = onValue(enrollmentRef, (snapshot) => {
      setEnrollments((snapshot.val() as Record<string, { progress?: number; status?: string }> | null) || {});
    });

    return unsubscribe;
  }, [user]);

  const requireUser = () => {
    if (user) return true;
    setStatus('Connecte-toi pour suivre ta progression AfriSchool.');
    return false;
  };

  const startTrack = async (track: typeof schoolTracks[number]) => {
    if (!requireUser() || !user) return;
    try {
      await enrollSchoolTrack({ user, trackId: track.id, title: track.title, level: track.level });
      setStatus(`${track.title} ajoute à tes parcours.`);
    } catch (error) {
      setStatus(getActionErrorMessage(error, 'Inscription au parcours impossible.'));
    }
  };

  const continueTrack = async (track: typeof schoolTracks[number]) => {
    if (!requireUser() || !user) return;
    try {
      const currentProgress = Number(enrollments[track.id]?.progress || track.progress || 0);
      await updateSchoolProgress(user, track.id, currentProgress + 12);
      setStatus('Progression mise à jour.');
    } catch (error) {
      setStatus(getActionErrorMessage(error, 'Progression impossible.'));
    }
  };

  const joinClass = async (track: typeof schoolTracks[number]) => {
    if (!requireUser() || !user) return;
    try {
      await joinSchoolClass({ user, trackId: track.id, title: track.title, level: track.level });
      setStatus('Classe communautaire rejointe.');
    } catch (error) {
      setStatus(getActionErrorMessage(error, 'Classe communautaire impossible.'));
    }
  };

  return (
    <ModuleShell moduleId="school">
      <ModuleActions moduleId="school" />
      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/52">Parcours actifs</h2>
          <Link to="/afriai" className="text-[10px] font-black text-[#15EA3E]">Tuteur IA</Link>
        </div>
        {status && (
          <p className={cn(
            'mb-3 rounded-xl border px-3 py-2 text-[11px] font-bold leading-relaxed',
            status.includes('Connecte') ? 'border-red-500/25 bg-red-500/10 text-red-100' : 'border-[#15EA3E]/25 bg-[#15EA3E]/10 text-[#15EA3E]'
          )}>
            {status}
          </p>
        )}
        <div className="space-y-3">
          {schoolTracks.map((track) => (
            <article key={track.title} className="overflow-hidden rounded-[1.3rem] border border-white/10 bg-white/[0.04]">
              <div className="flex gap-3 p-3">
                <img src={track.image} alt="" className="h-16 w-16 rounded-2xl object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black">{track.title}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#15EA3E]">{track.level}</p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-[#15EA3E]" style={{ width: `${Number(enrollments[track.id]?.progress || track.progress)}%` }} />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <button type="button" onClick={() => void startTrack(track)} className="h-9 rounded-xl bg-[#15EA3E] text-[9px] font-black uppercase tracking-wider text-black">
                      Demarrer
                    </button>
                    <button type="button" onClick={() => void continueTrack(track)} className="h-9 rounded-xl border border-white/10 bg-white/[0.04] text-[9px] font-black uppercase tracking-wider text-white/70">
                      Continuer
                    </button>
                    <button type="button" onClick={() => void joinClass(track)} className="h-9 rounded-xl border border-white/10 bg-white/[0.04] text-[9px] font-black uppercase tracking-wider text-white/70">
                      Classe
                    </button>
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
  const { user } = useFirebaseAuth();
  const [need, setNeed] = useState('');
  const [city, setCity] = useState('');
  const [urgency, setUrgency] = useState('Normal');
  const [language, setLanguage] = useState('Français');
  const [age, setAge] = useState('');
  const [allergies, setAllergies] = useState('');
  const [treatments, setTreatments] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const requireUser = () => {
    if (user) return true;
    setStatus('Connecte-toi pour utiliser AfriMed.');
    return false;
  };

  const submitConsultation = async (event: FormEvent) => {
    event.preventDefault();
    if (!requireUser() || !user) return;

    setBusy(true);
    setStatus('');
    try {
      await createTéléconsultationRequest({ user, need, city, urgency, language });
      setNeed('');
      setStatus('Demande de teleconsultation envoyée pour orientation.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Demande AfriMed impossible.');
    } finally {
      setBusy(false);
    }
  };

  const submitProfile = async () => {
    if (!requireUser() || !user) return;

    setBusy(true);
    setStatus('');
    try {
      await saveHealthProfile({ user, age, allergies, treatments, notes });
      setStatus('Dossier santé enregistre.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Dossier santé impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModuleShell moduleId="med">
      <ModuleActions moduleId="med" />
      <section className="mt-6 rounded-[1.4rem] border border-[#15EA3E]/20 bg-[#0A0F0A] p-4">
        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[#15EA3E]">Téléconsultation</h2>
        <form onSubmit={submitConsultation} className="mt-4 space-y-2">
          <textarea value={need} onChange={(event) => setNeed(event.target.value)} rows={3} placeholder="Symptomes, besoin ou question de santé..." className="w-full resize-none rounded-2xl border border-white/10 bg-black/24 px-4 py-3 text-xs font-bold text-white outline-none focus:border-[#15EA3E]/50" />
          <div className="grid grid-cols-2 gap-2">
            <input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Ville" className="h-12 rounded-2xl border border-white/10 bg-black/24 px-4 text-xs font-bold text-white outline-none focus:border-[#15EA3E]/50" />
            <select value={urgency} onChange={(event) => setUrgency(event.target.value)} className="h-12 rounded-2xl border border-white/10 bg-black/24 px-4 text-xs font-bold text-white outline-none focus:border-[#15EA3E]/50">
              <option>Normal</option>
              <option>Urgent</option>
              <option>Suivi</option>
            </select>
          </div>
          <input value={language} onChange={(event) => setLanguage(event.target.value)} placeholder="Langue préférée" className="h-12 w-full rounded-2xl border border-white/10 bg-black/24 px-4 text-xs font-bold text-white outline-none focus:border-[#15EA3E]/50" />
          {status && (
            <p className={cn(
              'rounded-xl border px-3 py-2 text-[11px] font-bold leading-relaxed',
              status.includes('impossible') || status.includes('requis') || status.includes('Connecte')
                ? 'border-red-500/25 bg-red-500/10 text-red-100'
                : 'border-[#15EA3E]/25 bg-[#15EA3E]/10 text-[#15EA3E]'
            )}>
              {status}
            </p>
          )}
          <button type="submit" disabled={busy} className="h-12 w-full rounded-2xl bg-[#15EA3E] text-xs font-black uppercase tracking-wider text-black disabled:opacity-60">
            {busy ? 'Envoi...' : 'Demander orientation'}
          </button>
        </form>
      </section>

      <section className="mt-5 rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-4">
        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/52">Dossier santé léger</h2>
        <div className="mt-4 space-y-2">
          <input value={age} onChange={(event) => setAge(event.target.value)} inputMode="numeric" placeholder="Age" className="h-12 w-full rounded-2xl border border-white/10 bg-black/24 px-4 text-xs font-bold text-white outline-none focus:border-[#15EA3E]/50" />
          <input value={allergies} onChange={(event) => setAllergies(event.target.value)} placeholder="Allergies connues" className="h-12 w-full rounded-2xl border border-white/10 bg-black/24 px-4 text-xs font-bold text-white outline-none focus:border-[#15EA3E]/50" />
          <input value={treatments} onChange={(event) => setTreatments(event.target.value)} placeholder="Traitements en cours" className="h-12 w-full rounded-2xl border border-white/10 bg-black/24 px-4 text-xs font-bold text-white outline-none focus:border-[#15EA3E]/50" />
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} placeholder="Notes utiles au praticien" className="w-full resize-none rounded-2xl border border-white/10 bg-black/24 px-4 py-3 text-xs font-bold text-white outline-none focus:border-[#15EA3E]/50" />
          <button type="button" onClick={submitProfile} disabled={busy} className="h-12 w-full rounded-2xl border border-[#15EA3E]/25 bg-[#15EA3E]/10 text-xs font-black uppercase tracking-wider text-[#15EA3E] disabled:opacity-60">
            Enregistrer dossier
          </button>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/52">Services santé</h2>
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
  const [engagements, setEngagements] = useState<Record<string, FreelanceEngagement>>({});
  const [selectedTalentId, setSelectedTalentId] = useState('');
  const [serviceTitle, setServiceTitle] = useState('');
  const [budget, setBudget] = useState('');
  const [timeline, setTimeline] = useState('');
  const [details, setDetails] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

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
      setSelectedTalentId((current) => (
        current && nextTalents.some((talent) => talent.id === current)
          ? current
          : nextTalents[0]?.id || ''
      ));
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const engagementRef = ref(realtimeDb, 'freelanceEngagements');
    const unsubscribe = onValue(engagementRef, (snapshot) => {
      setEngagements((snapshot.val() as Record<string, FreelanceEngagement> | null) || {});
    });

    return unsubscribe;
  }, []);

  const selectedTalent = talents.find((talent) => talent.id === selectedTalentId) || talents[0];
  const getContactChatRoute = (talent: TalentProfile) => (
    `/chat?contact=${encodeURIComponent(talent.id)}&name=${encodeURIComponent(talent.name)}&status=${encodeURIComponent(`${talent.role} - ${talent.city}`)}&avatar=${encodeURIComponent(talent.image)}`
  );

  const toggleLikeTalent = async (talent: TalentProfile) => {
    if (!user) {
      setStatus('Connecte-toi pour liker un talent.');
      return;
    }

    const likeRef = ref(realtimeDb, `freelanceEngagements/${talent.id}/likes/${user.uid}`);
    try {
      if (engagements[talent.id]?.likes?.[user.uid]) {
        await remove(likeRef);
        setStatus('Like retiré.');
        return;
      }

      await set(likeRef, true);
      setStatus('Talent ajoute à tes favoris.');
    } catch (error) {
      setStatus(getActionErrorMessage(error, 'Action like impossible.'));
    }
  };

  const rateTalent = async (talent: TalentProfile, rating: number) => {
    if (!user) {
      setStatus('Connecte-toi pour noter un talent.');
      return;
    }

    try {
      await set(ref(realtimeDb, `freelanceEngagements/${talent.id}/ratings/${user.uid}`), rating);
      setStatus(`${rating}/5 enregistre.`);
    } catch (error) {
      setStatus(getActionErrorMessage(error, 'Notation impossible.'));
    }
  };

  const submitMission = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedTalent) return;

    if (!user) {
      setStatus('Connecte-toi pour demander une mission.');
      return;
    }

    setBusy(true);
    setStatus('');

    try {
      await createFreelanceMissionRequest({
        user,
        freelancerId: selectedTalent.id,
        freelancerName: selectedTalent.name,
        serviceTitle,
        budget: Number(budget),
        timeline,
        details
      });
      setServiceTitle('');
      setBudget('');
      setTimeline('');
      setDetails('');
      setStatus('Demande de mission envoyée au freelance.');
    } catch (missionError) {
      setStatus(missionError instanceof Error ? missionError.message : 'Demande de mission impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModuleShell moduleId="freelance">
      <ModuleActions moduleId="freelance" />
      {selectedTalent && (
        <section className="mt-6 rounded-[1.4rem] border border-[#15EA3E]/20 bg-[#0A0F0A] p-4">
          <div className="flex items-center gap-3">
            <img src={selectedTalent.image} alt={selectedTalent.name} className="h-14 w-14 rounded-2xl object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black">{selectedTalent.name}</p>
              <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-wider text-[#15EA3E]">{selectedTalent.role} - {selectedTalent.city}</p>
            </div>
            <Link to={user ? getContactChatRoute(selectedTalent) : '/login'} state={!user ? { next: getContactChatRoute(selectedTalent) } : undefined} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#15EA3E] text-black">
              <AfriSellIcon name="chat" size={17} />
            </Link>
          </div>

          <form onSubmit={submitMission} className="mt-4 space-y-2">
            <input value={serviceTitle} onChange={(event) => setServiceTitle(event.target.value)} placeholder="Service souhaite" className="h-12 w-full rounded-2xl border border-white/10 bg-black/24 px-4 text-xs font-bold text-white outline-none focus:border-[#15EA3E]/50" />
            <div className="grid grid-cols-2 gap-2">
              <input value={budget} onChange={(event) => setBudget(event.target.value)} inputMode="decimal" placeholder="Budget USD" className="h-12 rounded-2xl border border-white/10 bg-black/24 px-4 text-xs font-bold text-white outline-none focus:border-[#15EA3E]/50" />
              <input value={timeline} onChange={(event) => setTimeline(event.target.value)} placeholder="Delai" className="h-12 rounded-2xl border border-white/10 bg-black/24 px-4 text-xs font-bold text-white outline-none focus:border-[#15EA3E]/50" />
            </div>
            <textarea value={details} onChange={(event) => setDetails(event.target.value)} rows={3} placeholder="Objectif, livrable attendu, contexte..." className="w-full resize-none rounded-2xl border border-white/10 bg-black/24 px-4 py-3 text-xs font-bold text-white outline-none focus:border-[#15EA3E]/50" />
            {status && (
              <p className={cn(
                'rounded-xl border px-3 py-2 text-[11px] font-bold leading-relaxed',
                status.includes('impossible') || status.includes('invalide') || status.includes('requis') || status.includes('Connecte')
                  ? 'border-red-500/25 bg-red-500/10 text-red-100'
                  : 'border-[#15EA3E]/25 bg-[#15EA3E]/10 text-[#15EA3E]'
              )}>
                {status}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button type="submit" disabled={busy} className="h-12 rounded-2xl bg-[#15EA3E] text-xs font-black uppercase tracking-wider text-black disabled:opacity-60">
                {busy ? 'Envoi...' : 'Demander devis'}
              </button>
              <Link to="/wallet?action=transfer" className="flex h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-xs font-black uppercase tracking-wider text-white/70">
                Payer mission
              </Link>
            </div>
          </form>
        </section>
      )}

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/52">Talents réels</h2>
          <span className="text-[10px] font-black text-[#15EA3E]">{talents.length} actif(s)</span>
        </div>
        {talents.length ? (
          <div className="scrollbar-hide flex gap-3 overflow-x-auto pb-1">
            {talents.map((talent) => {
              const chatRoute = `/chat?contact=${encodeURIComponent(talent.id)}&name=${encodeURIComponent(talent.name)}&status=${encodeURIComponent(`${talent.role} - ${talent.city}`)}&avatar=${encodeURIComponent(talent.image)}`;
              const stats = getFreelanceStats(engagements[talent.id]);
              const isSelected = selectedTalent?.id === talent.id;
              const userRating = user ? Number(engagements[talent.id]?.ratings?.[user.uid] || 0) : 0;
              const isLiked = Boolean(user && engagements[talent.id]?.likes?.[user.uid]);

              return (
                <article key={talent.id} className={cn(
                  'w-[184px] shrink-0 overflow-hidden rounded-[1.3rem] border bg-white/[0.04]',
                  isSelected ? 'border-[#15EA3E]/45' : 'border-white/10'
                )}>
                  <img src={talent.image} alt={talent.name} className="h-32 w-full object-cover" />
                  <div className="p-3">
                    <h3 className="truncate text-sm font-black">{talent.name}</h3>
                    <p className="mt-1 truncate text-[10px] font-bold text-[#15EA3E]">{talent.role}</p>
                    <p className="mt-2 line-clamp-2 text-[10px] font-semibold leading-snug text-white/45">{talent.bio}</p>
                    <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-black/24 px-2 py-2">
                      <button type="button" onClick={() => void toggleLikeTalent(talent)} className={cn('flex items-center gap-1 text-[10px] font-black', isLiked ? 'text-[#15EA3E]' : 'text-white/55')}>
                        <AfriSellIcon name="heart" size={13} />
                        {formatCompactCount(stats.likes)}
                      </button>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <button key={rating} type="button" onClick={() => void rateTalent(talent, rating)} className={rating <= userRating ? 'text-[#15EA3E]' : 'text-white/25'}>
                            <AfriSellIcon name="star" size={11} />
                          </button>
                        ))}
                      </div>
                      <span className="text-[9px] font-black text-white/45">{stats.ratingCount ? stats.ratingAverage.toFixed(1) : 'New'}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => setSelectedTalentId(talent.id)} className="flex h-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-[9px] font-black uppercase tracking-wider text-white/70">
                        Mission
                      </button>
                      <Link to={user ? chatRoute : '/login'} state={!user ? { next: chatRoute } : undefined} className="flex h-9 items-center justify-center rounded-xl bg-[#15EA3E] text-[9px] font-black uppercase tracking-wider text-black">
                        Chat
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-[1.3rem] border border-white/10 bg-white/[0.04] p-5 text-center">
            <p className="text-sm font-black">Aucun freelance réel pour le moment</p>
            <p className="mt-2 text-xs font-semibold leading-relaxed text-white/45">Les profils business freelance apparaîtront ici automatiquement.</p>
          </div>
        )}
      </section>
    </ModuleShell>
  );
}

function BiasharaModule() {
  const { user } = useFirebaseAuth();
  const [idea, setIdea] = useState('');
  const [market, setMarket] = useState('');
  const [need, setNeed] = useState('');
  const [offer, setOffer] = useState('');
  const [partnerType, setPartnerType] = useState('Distributeur');
  const [plan, setPlan] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [opportunities, setOpportunities] = useState<Array<{
    id: string;
    idea?: string;
    market?: string;
    partnerType?: string;
    status?: string;
    ownerId?: string;
    createdAt?: number;
  }>>([]);

  const generatePlan = (event: FormEvent) => {
    event.preventDefault();
    const cleanIdea = idea.trim() || 'une activité locale';
    const cleanMarket = market.trim() || 'clients AfriSell';
    const cleanNeed = need.trim() || 'un partenaire terrain';
    setPlan(`Plan rapide: valider ${cleanIdea} avec 10 clients ${cleanMarket}, publier une Vitrine ABC, mesurer les demandes via AfriChat, encaisser via AfriSpay, puis chercher ${cleanNeed} dans Biashara et animer le suivi dans Kyaghanda.`);
  };

  useEffect(() => {
    if (!user) {
      setOpportunities([]);
      return undefined;
    }

    const opportunitiesRef = ref(realtimeDb, 'biasharaOpportunities');
    const unsubscribe = onValue(opportunitiesRef, (snapshot) => {
      const data = snapshot.val() as Record<string, {
        id?: string;
        idea?: string;
        market?: string;
        partnerType?: string;
        status?: string;
        ownerId?: string;
        createdAt?: number;
      }> | null;
      const nextOpportunities = Object.entries(data || {})
        .map(([id, opportunity]) => ({ ...opportunity, id: opportunity.id || id }))
        .filter((opportunity) => opportunity.ownerId === user.uid)
        .sort((first, second) => Number(second.createdAt || 0) - Number(first.createdAt || 0))
        .slice(0, 4);
      setOpportunities(nextOpportunities);
    });

    return unsubscribe;
  }, [user]);

  const submitOpportunity = async () => {
    if (!user) {
      setStatus('Connecte-toi pour publier une opportunite business.');
      return;
    }

    setBusy(true);
    setStatus('');

    try {
      await createBiasharaOpportunity({
        user,
        idea,
        market,
        need,
        offer,
        partnerType
      });
      setNeed('');
      setOffer('');
      setStatus('Opportunite Biashara publiee.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Opportunite Biashara impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModuleShell moduleId="biashara">
      <ModuleActions moduleId="biashara" />
      <section className="mt-6 rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-4">
        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/52">Assistant business plan</h2>
        <form onSubmit={generatePlan} className="mt-4 space-y-3">
          <input value={idea} onChange={(event) => setIdea(event.target.value)} placeholder="Idee ou service" className="h-12 w-full rounded-2xl border border-white/10 bg-black/24 px-4 text-xs font-bold text-white outline-none focus:border-[#15EA3E]/50" />
          <input value={market} onChange={(event) => setMarket(event.target.value)} placeholder="Client cible" className="h-12 w-full rounded-2xl border border-white/10 bg-black/24 px-4 text-xs font-bold text-white outline-none focus:border-[#15EA3E]/50" />
          <button type="submit" className="h-12 w-full rounded-2xl bg-[#15EA3E] text-xs font-black uppercase tracking-widest text-black">Créer le plan</button>
        </form>
        {plan && <p className="mt-4 rounded-2xl border border-[#15EA3E]/20 bg-[#15EA3E]/10 p-3 text-xs font-semibold leading-relaxed text-white/72">{plan}</p>}
      </section>

      <section className="mt-5 rounded-[1.4rem] border border-[#15EA3E]/20 bg-[#0A0F0A] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[#15EA3E]">Opportunite partenaire</h2>
            <p className="mt-2 text-xs font-semibold leading-relaxed text-white/50">
              Publie une Vitrine business pour chercher fournisseur, distributeur, investisseur ou partenaire terrain.
            </p>
          </div>
          <Link to="/chat" className="shrink-0 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[9px] font-black uppercase tracking-wider text-white/65">
            Kyaghanda
          </Link>
        </div>

        <div className="mt-4 space-y-2">
          <select value={partnerType} onChange={(event) => setPartnerType(event.target.value)} className="h-12 w-full rounded-2xl border border-white/10 bg-black/24 px-4 text-xs font-bold text-white outline-none focus:border-[#15EA3E]/50">
            <option>Distributeur</option>
            <option>Fournisseur</option>
            <option>Investisseur</option>
            <option>Partenaire technique</option>
            <option>Agence terrain</option>
          </select>
          <input value={need} onChange={(event) => setNeed(event.target.value)} placeholder="Besoin partenaire" className="h-12 w-full rounded-2xl border border-white/10 bg-black/24 px-4 text-xs font-bold text-white outline-none focus:border-[#15EA3E]/50" />
          <textarea value={offer} onChange={(event) => setOffer(event.target.value)} rows={3} placeholder="Ce que tu offres: marge, zone, volume, mission..." className="w-full resize-none rounded-2xl border border-white/10 bg-black/24 px-4 py-3 text-xs font-bold text-white outline-none focus:border-[#15EA3E]/50" />
        </div>

        {status && (
          <p className={cn(
            'mt-3 rounded-xl border px-3 py-2 text-[11px] font-bold leading-relaxed',
            status.includes('impossible') || status.includes('requis') || status.includes('Connecte')
              ? 'border-red-500/25 bg-red-500/10 text-red-100'
              : 'border-[#15EA3E]/25 bg-[#15EA3E]/10 text-[#15EA3E]'
          )}>
            {status}
          </p>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={submitOpportunity} disabled={busy} className="h-12 rounded-2xl bg-[#15EA3E] text-xs font-black uppercase tracking-wider text-black disabled:opacity-60">
            {busy ? 'Publication...' : 'Publier vitrine'}
          </button>
          <Link to="/chat" className="flex h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-xs font-black uppercase tracking-wider text-white/70">
            Ouvrir chat
          </Link>
        </div>
      </section>

      {opportunities.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/52">Mes opportunites</h2>
          <div className="mt-3 space-y-3">
            {opportunities.map((opportunity) => (
              <article key={opportunity.id} className="rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black">{opportunity.idea || 'Opportunite Biashara'}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#15EA3E]">{opportunity.partnerType || 'Partenaire'}</p>
                    <p className="mt-2 line-clamp-1 text-[11px] font-semibold text-white/45">{opportunity.market || 'Marche cible'}</p>
                  </div>
                  <span className="rounded-full border border-[#15EA3E]/20 bg-[#15EA3E]/10 px-3 py-1 text-[9px] font-black uppercase tracking-wider text-[#15EA3E]">
                    {opportunity.status || 'open'}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </ModuleShell>
  );
}

function AfriAiModule() {
  const navigate = useNavigate();
  const { user } = useFirebaseAuth();
  const { abcContents, marketProducts } = useAfriMarket();
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<(AfriAiResponse & { intent: AfriAiIntent }) | null>(null);
  const [busy, setBusy] = useState(false);
  const suggestions = useMemo(() => [
    { label: 'Acheter', prompt: 'Je veux acheter un produit avec bon prix', icon: 'market' as AfriSellIconName },
    { label: 'Vendre', prompt: 'Je veux vendre avec une vitrine vidéo', icon: 'video' as AfriSellIconName },
    { label: 'Payer', prompt: 'Je veux faire un transfert ou payer', icon: 'pay' as AfriSellIconName },
    { label: 'Apprendre', prompt: 'Je veux apprendre à vendre en ligne', icon: 'school' as AfriSellIconName },
    { label: 'Talent', prompt: 'Je cherche un freelance pour une mission', icon: 'work' as AfriSellIconName },
  ], []);

  const runAssistant = async (nextPrompt = prompt) => {
    const cleanPrompt = nextPrompt.trim();
    if (!cleanPrompt) return;

    setBusy(true);
    try {
      const response = await resolveAfriAiRequest({
        user,
        input: cleanPrompt,
        contents: [...marketProducts, ...abcContents]
      });
      setResult(response);
      setPrompt(cleanPrompt);
    } catch (error) {
      setResult({
        intent: 'search',
        answer: getActionErrorMessage(error, 'AfriAI est indisponible. Ouvre directement le module correspondant.'),
        suggestedRoute: '/apps',
        confidence: 0
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModuleShell moduleId="afriai">
      <section className="mt-5 rounded-[1.4rem] border border-[#15EA3E]/20 bg-[#0A0F0A] p-4">
        <form onSubmit={(event) => {
          event.preventDefault();
          void runAssistant();
        }} className="flex gap-2">
          <input value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Parle ou écris ton besoin..." className="h-12 min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/24 px-4 text-xs font-bold text-white outline-none focus:border-[#15EA3E]/50" />
          <button type="submit" disabled={busy} className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#15EA3E] text-black disabled:opacity-60">
            <AfriSellIcon name={busy ? 'flash' : 'language'} size={18} />
          </button>
        </form>
        {result && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-full border border-[#15EA3E]/20 bg-[#15EA3E]/10 px-3 py-1 text-[9px] font-black uppercase tracking-wider text-[#15EA3E]">
                {result.intent}
              </span>
              <span className="text-[9px] font-black uppercase tracking-wider text-white/35">
                {Math.round(Number(result.confidence || 0) * 100)}%
              </span>
            </div>
            <p className="mt-3 text-xs font-semibold leading-relaxed text-white/68">{result.answer}</p>
            {result.suggestedRoute && (
              <button type="button" onClick={() => navigate(result.suggestedRoute || '/apps')} className="mt-3 flex h-10 w-full items-center justify-center rounded-xl bg-[#15EA3E] text-[10px] font-black uppercase tracking-wider text-black">
                Continuer
              </button>
            )}
          </div>
        )}
      </section>
      <section className="mt-5 grid grid-cols-2 gap-3">
        {suggestions.map((suggestion) => (
          <button key={suggestion.label} type="button" onClick={() => void runAssistant(suggestion.prompt)} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left active:scale-[0.98]">
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
      { title: 'Choisir un parcours', body: 'Sélectionne vente vidéo, gestion boutique ou paiement sécurisé.', icon: 'school' },
      { title: 'Apprendre par capsules', body: 'Avance avec des leçons courtes adaptées au réseau mobile.', icon: 'video' },
      { title: 'Valider la competence', body: 'Termine par une certification interne AfriSchool.', icon: 'check' }
    ],
    tuteur: [
      { title: 'Poser la question', body: 'Écris le problème ou dicte-le dans la prochaine version vocale.', icon: 'language' },
      { title: 'Recevoir une explication', body: 'AfriAI oriente vers une leçon, un module ou une action.', icon: 'flash' },
      { title: 'Continuer le cours', body: 'La reponse reste liee au parcours AfriSchool.', icon: 'school' }
    ],
    classe: [
      { title: 'Choisir une cohorte', body: 'Rejoins une classe par theme, ville ou objectif.', icon: 'profile' },
      { title: 'Suivre les annonces', body: 'Les activités de classe restent dans AfriSchool.', icon: 'notifications' },
      { title: 'Projet final', body: 'Publie un Stand ou une Vitrine après validation.', icon: 'market' }
    ]
  },
  med: {
    teleconsultation: [
      { title: 'Décrire le besoin', body: 'Indique symptomes, ville, urgence et langue préférée.', icon: 'health' },
      { title: 'Orientation AfriMed', body: 'AfriMed prépare le type de praticien ou centre adapté.', icon: 'shield' },
      { title: 'Demande medicale', body: 'La demande reste dans le dossier AfriMed avant contact.', icon: 'check' }
    ],
    dossier: [
      { title: 'Identité santé', body: 'Renseigne les informations utiles au suivi.', icon: 'profile' },
      { title: 'Historique', body: 'Ajoute consultations, allergies et traitements.', icon: 'order' },
      { title: 'Confidentialité', body: 'Controle ce qui peut être partage avec un praticien.', icon: 'shield' }
    ],
    pharmacie: [
      { title: 'Chercher un soin', body: 'Filtre par besoin: pharmacie, laboratoire ou centre.', icon: 'search' },
      { title: 'Vérifier disponibilité', body: 'AfriMed prépare les offres santé proches.', icon: 'market' },
      { title: 'Commander ou reserver', body: 'La suite reste reliee au parcours santé.', icon: 'cart' }
    ]
  },
  freelance: {
    'publier-service': [
      { title: 'Définir le service', body: 'Titre, prix, délai, ville, competence et portfolio.', icon: 'work' },
      { title: 'Créer la fiche mission', body: 'A-Freelance créé une offre de service, pas un produit Market.', icon: 'app' },
      { title: 'Recevoir demandes', body: 'Les clients peuvent demander un devis dans A-Freelance.', icon: 'chat' }
    ],
    'paiement-mission': [
      { title: 'Choisir une mission', body: 'Sélectionne la mission ou le client à facturer.', icon: 'order' },
      { title: 'Créer facture', body: 'AfriSpay prépare une facture mission avec escrow.', icon: 'pay' },
      { title: 'Liberation', body: 'Le paiement est libere après validation du travail.', icon: 'shield' }
    ],
    'demandes-clients': [
      { title: 'Boîte de demandes', body: 'Consulte les demandes de mission reçues.', icon: 'notifications' },
      { title: 'Qualifier', body: 'Accepte, refusé ou demande plus d informations.', icon: 'check' },
      { title: 'Transformer en mission', body: 'Une demande acceptée devient mission A-Freelance.', icon: 'work' }
    ]
  },
  biashara: {
    'stand-business': [
      { title: 'Choisir le type', body: 'Commerce, paiement, logistique, service ou media ABC.', icon: 'hub' },
      { title: 'Configurer le Stand', body: 'Ajoute nom, categorie, role et zone de service.', icon: 'work' },
      { title: 'Activer le dashboard', body: 'Le Stand ouvre un tableau de bord adapté.', icon: 'app' }
    ],
    'vitrine-business': [
      { title: 'Construire la Vitrine', body: 'Presente offre, histoire, prix et preuves.', icon: 'market' },
      { title: 'Associer partenaires', body: 'Lie fournisseurs, clients ou distributeurs.', icon: 'follow' },
      { title: 'Publier dans Biashara', body: 'La Vitrine devient visible aux partenaires business.', icon: 'check' }
    ],
    kyaghanda: [
      { title: 'Créer le cercle', body: 'Regroupé partenaires, investisseurs ou entrepreneurs.', icon: 'profile' },
      { title: 'Fixer l objectif', body: 'Partenariat, achat groupé, financement ou evenement.', icon: 'shield' },
      { title: 'Animer le Kyaghanda', body: 'Suivi des decisions, opportunites et engagements.', icon: 'chat' }
    ]
  },
  afriai: {
    'chercher-app': [
      { title: 'Comprendre le besoin', body: "AfriAI identifie l'intention de l'utilisateur.", icon: 'language' },
      { title: 'Choisir le module', body: 'Il propose ABC, Market, AfriMed, School ou autre.', icon: 'hub' },
      { title: 'Guider l action', body: 'Il ouvre la suite exacte dans le bon module.', icon: 'arrow' }
    ],
    traduction: [
      { title: 'Choisir les langues', body: 'Français, Lingala, Swahili, Wolof ou anglais.', icon: 'language' },
      { title: 'Préparer le contexte', body: 'Commerce, santé, école ou service client.', icon: 'chat' },
      { title: 'Traduire dans le module', body: 'La traduction accompagne la conversation cible.', icon: 'check' }
    ],
    'guide-achat': [
      { title: 'Analyser le besoin', body: 'Budget, lieu, categorie et urgence.', icon: 'search' },
      { title: 'Comparer les Stands', body: 'AfriAI classe Prix Village, confiance et livraison.', icon: 'market' },
      { title: 'Continuer vers achat', body: 'Le guide peut ouvrir le produit recommandé.', icon: 'cart' }
    ]
  },
  fpp: {
    contribuer: [
      { title: 'Choisir un projet', body: 'Éducation, santé, paix, emploi ou communauté.', icon: 'heart' },
      { title: 'Définir contribution', body: 'Montant direct, AfriCoin ou part de vente.', icon: 'pay' },
      { title: 'Suivre impact', body: 'Chaque contribution alimente le tableau FPP.', icon: 'shield' }
    ],
    'vente-fpp': [
      { title: 'Sélectionner le Stand', body: 'Choisis l offre qui contribue au FPP.', icon: 'market' },
      { title: 'Fixer le pourcentage', body: 'Ajoute la contribution sociale sur la vente.', icon: 'heart' },
      { title: 'Afficher transparence', body: 'Le client voit le projet soutenu avant achat.', icon: 'check' }
    ],
    mobiliser: [
      { title: 'Choisir la campagne', body: 'Sélectionne le projet à mobiliser.', icon: 'heart' },
      { title: 'Créer message', body: 'Prépare un message clair pour la communauté.', icon: 'share' },
      { title: 'Suivre recommandations', body: 'Mesure partages, soutiens et conversions.', icon: 'star' }
    ]
  }
};

function ModuleActionDetail({ moduleId, actionId }: { moduleId: ModuleId; actionId: string }) {
  const { user } = useFirebaseAuth();
  const navigate = useNavigate();
  const action = actionCatalog[moduleId].find((item) => item.id === actionId);
  const steps = actionSteps[moduleId][actionId];
  const meta = moduleMeta[moduleId];
  const continueRoute = getActionContinueRoute(moduleId, actionId);

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
            Se connectér
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
        <button type="button" onClick={() => navigate(continueRoute)} className="flex h-12 items-center justify-center rounded-2xl bg-[#15EA3E] text-xs font-black uppercase tracking-wider text-black">
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
