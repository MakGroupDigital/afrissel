import { ChangeEvent, FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { updateProfile } from 'firebase/auth';
import { get, ref, serverTimestamp, update } from 'firebase/database';
import { AfriSellIcon, AfriSellIconName } from '../components/AfriSellIcon';
import { uploadMediaToCloudinary } from '../lib/cloudinary';
import { realtimeDb } from '../lib/firebase';
import { updateAfriSellUserPhoto, useFirebaseAuth } from '../hooks/useFirebaseAuth';
import { getAccountRoleDefinition, getAccountSubtypeDefinition } from '../lib/accountTypes';
import {
  AFRICAN_COUNTRIES_BY_PRIORITY,
  buildInternationalPhone,
  getCountryByCode,
  getDefaultCountry,
  getLocalPhoneFromInternational
} from '../lib/africaLocation';
import { cn } from '../lib/utils';

type ProfilePanel = 'profile' | 'account' | 'app' | 'notifications' | 'privacy' | null;

type ProfileAction = {
  id: Exclude<ProfilePanel, null> | 'logout';
  title: string;
  description: string;
  icon: AfriSellIconName;
  danger?: boolean;
};

type UserSettings = {
  account: {
    pinEnabled: boolean;
    pinHash?: string;
    biometricEnabled: boolean;
    loginAlerts: boolean;
  };
  app: {
    language: string;
    lightMode: boolean;
    lowDataMode: boolean;
    offlineData: boolean;
  };
  notifications: {
    orders: boolean;
    messages: boolean;
    payments: boolean;
    alerts: boolean;
  };
  privacy: {
    camera: boolean;
    contacts: boolean;
    location: boolean;
    publicProfile: boolean;
  };
};

const defaultSettings: UserSettings = {
  account: {
    pinEnabled: false,
    biometricEnabled: false,
    loginAlerts: true
  },
  app: {
    language: 'fr',
    lightMode: false,
    lowDataMode: false,
    offlineData: true
  },
  notifications: {
    orders: true,
    messages: true,
    payments: true,
    alerts: true
  },
  privacy: {
    camera: false,
    contacts: false,
    location: false,
    publicProfile: true
  }
};

const actions: ProfileAction[] = [
  {
    id: 'profile',
    title: 'Profil',
    description: 'Identite, photo, telephone et adresse.',
    icon: 'profile'
  },
  {
    id: 'account',
    title: 'Gerer le compte',
    description: 'Securite, code PIN, appareils et preferences.',
    icon: 'account'
  },
  {
    id: 'app',
    title: 'Gerer l app',
    description: 'Langue, cache, mode leger et donnees hors ligne.',
    icon: 'app'
  },
  {
    id: 'notifications',
    title: 'Notifications',
    description: 'Commandes, messages, paiements et alertes.',
    icon: 'notifications'
  },
  {
    id: 'privacy',
    title: 'Confidentialite',
    description: 'Autorisations, camera, contacts et donnees.',
    icon: 'shield'
  },
  {
    id: 'logout',
    title: 'Deconnexion',
    description: 'Fermer la session sur cet appareil.',
    icon: 'logout',
    danger: true
  }
];

const storageKey = (uid?: string) => `afrissel:settings:${uid || 'guest'}`;

const hashPin = async (pin: string) => {
  const encoded = new TextEncoder().encode(pin);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

const stripUndefined = <T,>(value: T): T => {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as T;
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([key, entryValue]) => [key, stripUndefined(entryValue)])
    ) as T;
  }

  return value;
};

function ToggleRow({
  title,
  description,
  checked,
  onChange
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black text-white">{title}</p>
        <p className="mt-0.5 text-[11px] font-semibold leading-relaxed text-white/42">{description}</p>
      </div>
      <span className={cn(
        'relative h-7 w-12 rounded-full border transition-colors',
        checked ? 'border-[#15EA3E]/50 bg-[#15EA3E]' : 'border-white/10 bg-white/10'
      )}>
        <span className={cn(
          'absolute top-1 h-5 w-5 rounded-full bg-white transition-transform',
          checked ? 'translate-x-5' : 'translate-x-1'
        )} />
      </span>
    </button>
  );
}

function PanelShell({
  title,
  subtitle,
  busy,
  status,
  onClose,
  children
}: {
  title: string;
  subtitle: string;
  busy?: boolean;
  status?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="absolute inset-0 z-50 flex items-end bg-black/72 backdrop-blur-md">
      <section className="max-h-[86%] w-full overflow-y-auto rounded-t-[2rem] border-t border-white/10 bg-[#050705] p-5 pb-7">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">{subtitle}</p>
            <h2 className="mt-1 text-xl font-black text-white">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/50"
          >
            <AfriSellIcon name="close" size={18} />
          </button>
        </div>

        {children}

        {status && (
          <p className="mt-4 rounded-2xl border border-[#15EA3E]/20 bg-[#15EA3E]/10 p-3 text-[11px] font-bold leading-relaxed text-[#15EA3E]">
            {busy && <Loader2 className="mr-2 inline h-3.5 w-3.5 animate-spin" />}
            {status}
          </p>
        )}
      </section>
    </div>
  );
}

export default function ProfileScreen() {
  const navigate = useNavigate();
  const { user, profile, logout, refreshProfile } = useFirebaseAuth();
  const [activePanel, setActivePanel] = useState<ProfilePanel>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [profileForm, setProfileForm] = useState({
    displayName: '',
    phoneLocal: '',
    countryCode: getDefaultCountry().code,
    city: '',
    businessName: '',
    bio: ''
  });
  const [pin, setPin] = useState('');

  const displayName = profile?.displayName || user?.displayName || 'Utilisateur AfriSell';
  const email = profile?.email || user?.email || 'Compte Firebase';
  const photoURL = profile?.photoURL || user?.photoURL || '/afrissel-icon.jpeg';
  const roleDefinition = getAccountRoleDefinition(profile?.primaryRole);
  const subtypeDefinition = getAccountSubtypeDefinition(profile?.primaryRole, profile?.primarySubtype);
  const selectedCountry = getCountryByCode(profileForm.countryCode) || getDefaultCountry();

  useEffect(() => {
    if (!user) return;

    setProfileForm({
      displayName,
      phoneLocal: profile?.phoneLocal || getLocalPhoneFromInternational(profile?.phone || '', profile?.dialCode || selectedCountry.dialCode),
      countryCode: profile?.countryCode || selectedCountry.code,
      city: profile?.city || '',
      businessName: profile?.businessName || '',
      bio: profile?.bio || ''
    });
  }, [user?.uid, profile?.updatedAt, displayName]);

  useEffect(() => {
    if (!user) return;

    const savedLocalSettings = window.localStorage.getItem(storageKey(user.uid));
    if (savedLocalSettings) {
      try {
        setSettings({ ...defaultSettings, ...JSON.parse(savedLocalSettings) });
      } catch {
        setSettings(defaultSettings);
      }
    }

    get(ref(realtimeDb, `userSettings/${user.uid}`))
      .then((snapshot) => {
        if (!snapshot.exists()) return;
        const remoteSettings = snapshot.val() as Partial<UserSettings>;
        setSettings({
          account: { ...defaultSettings.account, ...remoteSettings.account },
          app: { ...defaultSettings.app, ...remoteSettings.app },
          notifications: { ...defaultSettings.notifications, ...remoteSettings.notifications },
          privacy: { ...defaultSettings.privacy, ...remoteSettings.privacy }
        });
      })
      .catch((error) => {
        console.error('Chargement reglages profil impossible:', error);
      });
  }, [user]);

  const persistSettings = async (nextSettings: UserSettings, message = 'Reglages enregistres.') => {
    if (!user) return;
    setBusy(true);
    setStatus('Enregistrement...');

    try {
      window.localStorage.setItem(storageKey(user.uid), JSON.stringify(nextSettings));
      await update(ref(realtimeDb, `userSettings/${user.uid}`), {
        ...stripUndefined(nextSettings),
        updatedAt: serverTimestamp()
      });
      setSettings(nextSettings);
      setStatus(message);
    } catch (error) {
      console.error('Enregistrement reglages profil impossible:', error);
      setStatus('Impossible d enregistrer pour le moment.');
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    window.localStorage.setItem('afrissel:lastLogout', new Date().toISOString());
    await logout();
    navigate('/login');
  };

  const openPanel = (panel: ProfileAction['id']) => {
    setStatus('');
    if (panel === 'logout') {
      void handleLogout();
      return;
    }

    setActivePanel(panel);
  };

  const handleProfilePhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      setStatus('Choisis une image pour la photo de profil.');
      return;
    }

    setBusy(true);
    setStatus('Mise a jour de la photo...');

    try {
      const upload = await uploadMediaToCloudinary(file, user.uid);
      await updateAfriSellUserPhoto(user, upload.secureUrl);
      await refreshProfile();
      setStatus('Photo mise a jour.');
    } catch (error) {
      console.error('Photo profil AfriSell impossible:', error);
      setStatus(error instanceof Error ? error.message : 'Photo impossible a enregistrer.');
    } finally {
      setBusy(false);
    }
  };

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;

    const country = getCountryByCode(profileForm.countryCode) || getDefaultCountry();
    const phone = buildInternationalPhone(country.dialCode, profileForm.phoneLocal);
    const displayNameValue = profileForm.displayName.trim() || displayName;

    setBusy(true);
    setStatus('Enregistrement du profil...');

    try {
      if (displayNameValue !== user.displayName) {
        await updateProfile(user, { displayName: displayNameValue });
      }

      await update(ref(realtimeDb, `users/${user.uid}`), {
        displayName: displayNameValue,
        phone,
        phoneLocal: profileForm.phoneLocal,
        dialCode: country.dialCode,
        country: country.name,
        countryCode: country.code,
        city: profileForm.city.trim(),
        businessName: profileForm.businessName.trim(),
        bio: profileForm.bio.trim(),
        updatedAt: serverTimestamp()
      });

      await refreshProfile();
      setStatus('Profil enregistre.');
    } catch (error) {
      console.error('Mise a jour profil impossible:', error);
      setStatus('Impossible d enregistrer le profil.');
    } finally {
      setBusy(false);
    }
  };

  const savePin = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;

    if (settings.account.pinEnabled && pin.length < 4) {
      setStatus('Choisis un code PIN de 4 chiffres minimum.');
      return;
    }

    setBusy(true);
    setStatus('Mise a jour du compte...');

    try {
      const pinHash = settings.account.pinEnabled && pin ? await hashPin(pin) : settings.account.pinHash;
      const nextSettings = {
        ...settings,
        account: {
          ...settings.account,
          pinHash
        }
      };
      await persistSettings(nextSettings, 'Compte mis a jour.');
      setPin('');
    } finally {
      setBusy(false);
    }
  };

  const requestCamera = async (checked: boolean) => {
    if (!checked) {
      await persistSettings({
        ...settings,
        privacy: { ...settings.privacy, camera: false }
      }, 'Camera desactivee.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());
      await persistSettings({
        ...settings,
        privacy: { ...settings.privacy, camera: true }
      }, 'Camera autorisee.');
    } catch {
      setStatus('Autorisation camera refusee par le navigateur.');
    }
  };

  const requestLocation = async (checked: boolean) => {
    if (!checked) {
      await persistSettings({
        ...settings,
        privacy: { ...settings.privacy, location: false }
      }, 'Localisation desactivee.');
      return;
    }

    if (!navigator.geolocation) {
      setStatus('Localisation indisponible sur cet appareil.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      () => {
        void persistSettings({
          ...settings,
          privacy: { ...settings.privacy, location: true }
        }, 'Localisation autorisee.');
      },
      () => setStatus('Autorisation localisation refusee par le navigateur.'),
      { enableHighAccuracy: false, timeout: 7000 }
    );
  };

  const clearLocalCache = () => {
    const keysToKeep = new Set([storageKey(user?.uid)]);
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith('afrissel:') && !keysToKeep.has(key))
      .forEach((key) => window.localStorage.removeItem(key));
    setStatus('Cache local nettoye.');
  };

  const updateSettings = <Section extends keyof UserSettings>(
    section: Section,
    patch: Partial<UserSettings[Section]>,
    message?: string
  ) => {
    const nextSettings = {
      ...settings,
      [section]: {
        ...settings[section],
        ...patch
      }
    };
    void persistSettings(nextSettings, message);
  };

  return (
    <div className="relative min-h-full bg-[#050705] px-4 pb-8 pt-4 text-white">
      <header className="flex items-center justify-between">
        <Link to="/ecosystem" className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/70">
          <AfriSellIcon name="arrow" size={18} className="rotate-180" />
        </Link>
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">Profil</p>
        <div className="h-10 w-10" />
      </header>

      <section className="mt-6 flex flex-col items-center text-center">
        <button
          type="button"
          onClick={() => openPanel('profile')}
          className="relative h-24 w-24 overflow-hidden rounded-[2rem] border border-[#15EA3E]/25 bg-black active:scale-[0.98]"
        >
          <img src={photoURL} alt="Profil AfriSell" className="h-full w-full object-cover" />
          <span className="absolute inset-x-0 bottom-0 bg-black/70 py-1 text-[9px] font-black uppercase tracking-wider text-[#15EA3E]">
            Modifier
          </span>
        </button>
        <h1 className="mt-4 text-2xl font-black tracking-normal">{displayName}</h1>
        <p className="mt-1 text-xs font-semibold text-white/45">{email}</p>
        <div className="mt-4 rounded-full border border-[#15EA3E]/20 bg-[#15EA3E]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#15EA3E]">
          Compte actif
        </div>
      </section>

      {roleDefinition && (
        <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#15EA3E]/10 text-[#15EA3E]">
              <AfriSellIcon name={roleDefinition.icon} size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-black">{roleDefinition.label}</h2>
              <p className="mt-0.5 text-[11px] font-semibold text-white/44">
                {subtypeDefinition?.label || roleDefinition.shortLabel}
              </p>
            </div>
            <span className="rounded-full bg-[#15EA3E] px-2 py-1 text-[8px] font-black uppercase tracking-[0.1em] text-black">
              Actif
            </span>
          </div>
        </section>
      )}

      <section className="mt-7 flex flex-col gap-2.5">
        {actions.map((item) => (
          <button
            key={item.title}
            onClick={() => openPanel(item.id)}
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

      {activePanel === 'profile' && (
        <PanelShell title="Profil" subtitle="Infos personnelles" busy={busy} status={status} onClose={() => setActivePanel(null)}>
          <form onSubmit={saveProfile} className="space-y-3">
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <img src={photoURL} alt="" className="h-16 w-16 rounded-2xl object-cover" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-white">Photo de profil</p>
                <label className="mt-2 inline-flex h-9 items-center gap-2 rounded-xl bg-[#15EA3E] px-3 text-[10px] font-black uppercase tracking-wider text-black">
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <AfriSellIcon name="profile" size={14} />}
                  Changer photo
                  <input type="file" accept="image/*" disabled={busy} onChange={handleProfilePhoto} className="hidden" />
                </label>
              </div>
            </div>

            <input value={profileForm.displayName} onChange={(event) => setProfileForm((current) => ({ ...current, displayName: event.target.value }))} placeholder="Nom" className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold outline-none focus:border-[#15EA3E]/50" />
            <input value={profileForm.businessName} onChange={(event) => setProfileForm((current) => ({ ...current, businessName: event.target.value }))} placeholder="Nom boutique ou activite" className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold outline-none focus:border-[#15EA3E]/50" />
            <div className="grid grid-cols-[110px_1fr] gap-2">
              <select value={profileForm.countryCode} onChange={(event) => setProfileForm((current) => ({ ...current, countryCode: event.target.value }))} className="h-12 rounded-2xl border border-white/10 bg-[#0A0A0A] px-3 text-xs font-bold outline-none focus:border-[#15EA3E]/50">
                {AFRICAN_COUNTRIES_BY_PRIORITY.map((country) => (
                  <option key={country.code} value={country.code}>{country.name}</option>
                ))}
              </select>
              <div className="flex h-12 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] focus-within:border-[#15EA3E]/50">
                <span className="flex items-center border-r border-white/10 px-3 text-xs font-black text-[#15EA3E]">{selectedCountry.dialCode}</span>
                <input value={profileForm.phoneLocal} onChange={(event) => setProfileForm((current) => ({ ...current, phoneLocal: event.target.value }))} inputMode="tel" placeholder="Telephone" className="min-w-0 flex-1 bg-transparent px-3 text-sm font-semibold outline-none" />
              </div>
            </div>
            <input value={profileForm.city} onChange={(event) => setProfileForm((current) => ({ ...current, city: event.target.value }))} placeholder="Ville" className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold outline-none focus:border-[#15EA3E]/50" />
            <textarea value={profileForm.bio} onChange={(event) => setProfileForm((current) => ({ ...current, bio: event.target.value }))} placeholder="Bio courte" rows={3} className="w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold outline-none focus:border-[#15EA3E]/50" />
            <button type="submit" disabled={busy} className="h-12 w-full rounded-2xl bg-[#15EA3E] text-xs font-black uppercase tracking-widest text-black disabled:bg-white/10 disabled:text-white/35">
              Enregistrer
            </button>
          </form>
        </PanelShell>
      )}

      {activePanel === 'account' && (
        <PanelShell title="Gerer le compte" subtitle="Securite" busy={busy} status={status} onClose={() => setActivePanel(null)}>
          <form onSubmit={savePin} className="space-y-3">
            <ToggleRow title="Code PIN" description="Demander un code pour les actions sensibles." checked={settings.account.pinEnabled} onChange={(checked) => setSettings((current) => ({ ...current, account: { ...current.account, pinEnabled: checked } }))} />
            {settings.account.pinEnabled && (
              <input value={pin} onChange={(event) => setPin(event.target.value.replace(/[^\d]/g, '').slice(0, 8))} inputMode="numeric" placeholder="Nouveau code PIN" className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold outline-none focus:border-[#15EA3E]/50" />
            )}
            <ToggleRow title="Alertes connexion" description="Prevenir quand le compte est utilise sur un appareil." checked={settings.account.loginAlerts} onChange={(checked) => updateSettings('account', { loginAlerts: checked }, 'Alertes connexion mises a jour.')} />
            <ToggleRow title="Biometrie" description="Preparer l usage de Face ID ou empreinte quand disponible." checked={settings.account.biometricEnabled} onChange={(checked) => updateSettings('account', { biometricEnabled: checked }, 'Preference biometrie enregistree.')} />
            <button type="submit" disabled={busy} className="h-12 w-full rounded-2xl bg-[#15EA3E] text-xs font-black uppercase tracking-widest text-black disabled:bg-white/10 disabled:text-white/35">
              Enregistrer securite
            </button>
          </form>
        </PanelShell>
      )}

      {activePanel === 'app' && (
        <PanelShell title="Gerer l app" subtitle="Preferences" busy={busy} status={status} onClose={() => setActivePanel(null)}>
          <div className="space-y-3">
            <select value={settings.app.language} onChange={(event) => updateSettings('app', { language: event.target.value }, 'Langue enregistree.')} className="h-12 w-full rounded-2xl border border-white/10 bg-[#0A0A0A] px-4 text-sm font-semibold outline-none focus:border-[#15EA3E]/50">
              <option value="fr">Francais</option>
              <option value="ln">Lingala</option>
              <option value="sw">Swahili</option>
              <option value="en">English</option>
            </select>
            <ToggleRow title="Mode leger" description="Interface plus simple pour les petits telephones." checked={settings.app.lightMode} onChange={(checked) => updateSettings('app', { lightMode: checked }, 'Mode leger mis a jour.')} />
            <ToggleRow title="Economiser les donnees" description="Limiter les medias lourds quand c est possible." checked={settings.app.lowDataMode} onChange={(checked) => updateSettings('app', { lowDataMode: checked }, 'Mode donnees mis a jour.')} />
            <ToggleRow title="Donnees hors ligne" description="Garder les infos utiles disponibles sans reseau." checked={settings.app.offlineData} onChange={(checked) => updateSettings('app', { offlineData: checked }, 'Hors ligne mis a jour.')} />
            <button type="button" onClick={clearLocalCache} className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] text-xs font-black uppercase tracking-widest text-white">
              Nettoyer le cache
            </button>
          </div>
        </PanelShell>
      )}

      {activePanel === 'notifications' && (
        <PanelShell title="Notifications" subtitle="Alertes" busy={busy} status={status} onClose={() => setActivePanel(null)}>
          <div className="space-y-3">
            <ToggleRow title="Commandes" description="Recevoir les alertes de commande." checked={settings.notifications.orders} onChange={(checked) => updateSettings('notifications', { orders: checked }, 'Notifications commandes mises a jour.')} />
            <ToggleRow title="Messages" description="Recevoir les messages AfriChat." checked={settings.notifications.messages} onChange={(checked) => updateSettings('notifications', { messages: checked }, 'Notifications messages mises a jour.')} />
            <ToggleRow title="Paiements" description="Recevoir les alertes AfriSpay." checked={settings.notifications.payments} onChange={(checked) => updateSettings('notifications', { payments: checked }, 'Notifications paiements mises a jour.')} />
            <ToggleRow title="Alertes importantes" description="Securite, compte et annonces importantes." checked={settings.notifications.alerts} onChange={(checked) => updateSettings('notifications', { alerts: checked }, 'Alertes mises a jour.')} />
          </div>
        </PanelShell>
      )}

      {activePanel === 'privacy' && (
        <PanelShell title="Confidentialite" subtitle="Autorisations" busy={busy} status={status} onClose={() => setActivePanel(null)}>
          <div className="space-y-3">
            <ToggleRow title="Profil public" description="Permettre aux autres de voir ton profil." checked={settings.privacy.publicProfile} onChange={(checked) => updateSettings('privacy', { publicProfile: checked }, 'Visibilite profil mise a jour.')} />
            <ToggleRow title="Camera" description="Autoriser la camera pour scan, video et photo." checked={settings.privacy.camera} onChange={requestCamera} />
            <ToggleRow title="Localisation" description="Aider a proposer ville, livraison et offres proches." checked={settings.privacy.location} onChange={requestLocation} />
            <ToggleRow title="Contacts" description="Garder ton choix pour les futures invitations." checked={settings.privacy.contacts} onChange={(checked) => updateSettings('privacy', { contacts: checked }, 'Preference contacts enregistree.')} />
          </div>
        </PanelShell>
      )}
    </div>
  );
}
