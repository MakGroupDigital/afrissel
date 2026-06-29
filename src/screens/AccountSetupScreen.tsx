import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AfriSellIcon } from '../components/AfriSellIcon';
import {
  AccountRole,
  PUBLIC_ACCOUNT_ROLE_DEFINITIONS,
  getAccountRoleDefinition,
  getAccountSubtypeDefinition,
  isAccountSetupComplete
} from '../lib/accountTypes';
import { isCloudinaryReady, uploadMediaToCloudinary } from '../lib/cloudinary';
import {
  AFRICAN_COUNTRIES_BY_PRIORITY,
  buildInternationalPhone,
  fetchCitiesForCountry,
  getCountryByCode,
  getCountryByName,
  getDefaultCountry,
  getDeviceCityHint,
  getDeviceCountryCode,
  getLocalPhoneFromInternational
} from '../lib/africaLocation';
import {
  getAfriSellDataErrorMessage,
  saveAfriSellMediaRecord,
  updateAfriSellUserPhoto,
  useFirebaseAuth
} from '../hooks/useFirebaseAuth';

type SetupStep = 'role' | 'subtype' | 'details' | 'media';

const steps: { id: SetupStep; label: string }[] = [
  { id: 'role', label: 'Compte' },
  { id: 'subtype', label: 'Activite' },
  { id: 'details', label: 'Profil' },
  { id: 'media', label: 'Photo' }
];

const organizationRoles: AccountRole[] = ['seller', 'provider', 'business'];

const roleNeedsOrganizationName = (role?: AccountRole | '') =>
  Boolean(role && organizationRoles.includes(role));

const getStepIndexFromProfile = (step?: string) => {
  if (step === 'subtype') return 1;
  if (step === 'details') return 2;
  if (step === 'media') return 3;
  return 0;
};

export default function AccountSetupScreen() {
  const navigate = useNavigate();
  const {
    user,
    profile,
    loading,
    authError,
    saveAccountSetupDraft,
    completeAccountSetup,
    refreshProfile
  } = useFirebaseAuth();

  const [stepIndex, setStepIndex] = useState(0);
  const [primaryRole, setPrimaryRole] = useState<AccountRole | ''>('');
  const [primarySubtype, setPrimarySubtype] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phoneLocal, setPhoneLocal] = useState('');
  const [city, setCity] = useState('');
  const [countryCode, setCountryCode] = useState(getDefaultCountry().code);
  const [cities, setCities] = useState<string[]>(getDefaultCountry().fallbackCities);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [citiesSource, setCitiesSource] = useState<'device' | 'online' | 'fallback'>('fallback');
  const [bio, setBio] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [logoURL, setLogoURL] = useState('');
  const [mediaURL, setMediaURL] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [hydrated, setHydrated] = useState(false);

  const roleDefinition = useMemo(
    () => getAccountRoleDefinition(primaryRole || undefined),
    [primaryRole]
  );
  const subtypeDefinition = useMemo(
    () => getAccountSubtypeDefinition(primaryRole || undefined, primarySubtype),
    [primaryRole, primarySubtype]
  );
  const currentStep = steps[stepIndex];
  const selectedCountry = getCountryByCode(countryCode) || getDefaultCountry();
  const fullPhone = buildInternationalPhone(selectedCountry.dialCode, phoneLocal);
  const mediaPreview = logoURL || photoURL || mediaURL;
  const isOrganization = roleNeedsOrganizationName(primaryRole);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login', { replace: true });
    }
  }, [loading, navigate, user]);

  useEffect(() => {
    if (loading || !profile) return;

    if (isAccountSetupComplete(profile)) {
      navigate('/ecosystem', { replace: true });
      return;
    }

    if (hydrated) return;

    setPrimaryRole(profile.primaryRole || '');
    setPrimarySubtype(profile.primarySubtype || '');
    setDisplayName(profile.displayName || user?.displayName || '');
    setBusinessName(profile.businessName || '');
    const profileCountry = getCountryByCode(profile.countryCode) || getCountryByName(profile.country) || getCountryByCode(getDeviceCountryCode()) || getDefaultCountry();
    const phoneDialCode = profile.dialCode || profileCountry.dialCode;
    const deviceCity = getDeviceCityHint();

    setCountryCode(profileCountry.code);
    setPhoneLocal(profile.phoneLocal || getLocalPhoneFromInternational(profile.phone || '', phoneDialCode));
    setCity(profile.city || '');
    if (!profile.city && deviceCity) {
      setCity(deviceCity);
      setCitiesSource('device');
    }
    setBio(profile.bio || '');
    setPhotoURL(profile.photoURL || user?.photoURL || '');
    setLogoURL(profile.logoURL || '');
    setMediaURL(profile.mediaURL || '');
    setStepIndex(getStepIndexFromProfile(profile.accountSetupStep));
    setHydrated(true);
  }, [hydrated, loading, navigate, profile, user]);

  useEffect(() => {
    const country = getCountryByCode(countryCode) || getDefaultCountry();
    let ignore = false;

    setCities(country.fallbackCities);
    setCitiesLoading(true);

    fetchCitiesForCountry(country)
      .then((loadedCities) => {
        if (ignore) return;
        const nextCities = loadedCities.length ? loadedCities : country.fallbackCities;
        setCities(nextCities);
        setCitiesSource(loadedCities.length ? 'online' : 'fallback');
        setCity((currentCity) => {
          if (currentCity) return currentCity;
          const deviceCity = getDeviceCityHint();
          const matchingDeviceCity = nextCities.find((item) => item.toLowerCase() === deviceCity.toLowerCase());
          return matchingDeviceCity || nextCities[0] || '';
        });
      })
      .catch(() => {
        if (ignore) return;
        setCities(country.fallbackCities);
        setCitiesSource('fallback');
        setCity((currentCity) => {
          if (currentCity) return currentCity;
          const deviceCity = getDeviceCityHint();
          return country.fallbackCities.includes(deviceCity) ? deviceCity : country.fallbackCities[0] || '';
        });
      })
      .finally(() => {
        if (!ignore) setCitiesLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [countryCode]);

  const persistDraft = async (patch: Parameters<typeof saveAccountSetupDraft>[0]) => {
    setError('');
    setBusy(true);
    try {
      await saveAccountSetupDraft(patch);
    } catch (saveError) {
      console.error('Configuration compte AfriSell impossible:', saveError);
      setError(getAfriSellDataErrorMessage(saveError));
      throw saveError;
    } finally {
      setBusy(false);
    }
  };

  const selectRole = async (role: AccountRole) => {
    const selectedRole = getAccountRoleDefinition(role);
    const automaticSubtype = selectedRole?.subtypes.length === 1 ? selectedRole.subtypes[0].id : '';

    setPrimaryRole(role);
    setPrimarySubtype(automaticSubtype);
    setStepIndex(automaticSubtype ? 2 : 1);
    await persistDraft({
      primaryRole: role,
      primarySubtype: automaticSubtype,
      accountSetupStep: automaticSubtype ? 'subtype' : 'role'
    });
  };

  const selectSubtype = async (subtype: string) => {
    if (!primaryRole) return;
    setPrimarySubtype(subtype);
    setStepIndex(2);
    await persistDraft({
      primaryRole,
      primarySubtype: subtype,
      accountSetupStep: 'subtype'
    });
  };

  const submitDetails = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!primaryRole || !primarySubtype) {
      setError("Choisis d'abord ce que tu veux faire sur AfriSell.");
      setStepIndex(primaryRole ? 1 : 0);
      return;
    }

    if (!displayName.trim()) {
      setError('Ajoute le nom qui sera visible sur AfriSell.');
      return;
    }

    await persistDraft({
      primaryRole,
      primarySubtype,
      displayName,
      businessName,
      phone: fullPhone,
      phoneLocal,
      dialCode: selectedCountry.dialCode,
      city,
      country: selectedCountry.name,
      countryCode: selectedCountry.code,
      bio,
      accountSetupStep: 'details'
    });
    setStepIndex(3);
  };

  const uploadIdentityMedia = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !user || !primaryRole) return;

    setError('');
    setBusy(true);

    try {
      const upload = await uploadMediaToCloudinary(file, user.uid);
      await saveAfriSellMediaRecord(user, upload, file);

      const nextPatch = {
        mediaURL: upload.secureUrl,
        accountSetupStep: 'media' as const,
        ...(isOrganization && upload.resourceType === 'image'
          ? { logoURL: upload.secureUrl }
          : { photoURL: upload.secureUrl })
      };

      if (isOrganization && upload.resourceType === 'image') {
        setLogoURL(upload.secureUrl);
      } else {
        setPhotoURL(upload.secureUrl);
        if (upload.resourceType === 'image') {
          await updateAfriSellUserPhoto(user, upload.secureUrl);
        }
      }

      setMediaURL(upload.secureUrl);
      await saveAccountSetupDraft(nextPatch);
      await refreshProfile();
    } catch (uploadError) {
      console.error('Upload media profil AfriSell impossible:', uploadError);
      setError('Ajout impossible. Réessaie avec une image ou une vidéo plus légère.');
    } finally {
      setBusy(false);
    }
  };

  const completeSetup = async () => {
    if (!primaryRole || !primarySubtype) {
      setError("Choisis d'abord ton activité.");
      setStepIndex(primaryRole ? 1 : 0);
      return;
    }

    if (!displayName.trim()) {
      setError('Ajoute le nom du compte avant de terminer.');
      setStepIndex(2);
      return;
    }

    setError('');
    setBusy(true);

    try {
      await completeAccountSetup({
        primaryRole,
        primarySubtype,
        displayName,
        businessName,
        phone: fullPhone,
        phoneLocal,
        dialCode: selectedCountry.dialCode,
        city,
        country: selectedCountry.name,
        countryCode: selectedCountry.code,
        bio,
        photoURL,
        logoURL,
        mediaURL
      });
      navigate('/ecosystem', { replace: true });
    } catch (completeError) {
      console.error('Finalisation compte AfriSell impossible:', completeError);
      setError(completeError instanceof Error ? completeError.message : 'Finalisation impossible.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-full items-center justify-center bg-[#050705] text-white">
        <Loader2 className="h-6 w-6 animate-spin text-[#15EA3E]" />
      </main>
    );
  }

  return (
    <main className="min-h-full bg-[#050705] px-4 pb-7 pt-4 text-white">
      <header className="rounded-[1.7rem] border border-[#15EA3E]/20 bg-[#0A0F0A] p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#15EA3E] text-black">
            <AfriSellIcon name="account" size={22} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">Avant de commencer</p>
            <h1 className="mt-1 text-xl font-black tracking-normal">Complète ton profil</h1>
          </div>
        </div>
        <p className="mt-3 text-[11px] font-semibold leading-relaxed text-white/50">
          Dis-nous comment tu veux utiliser AfriSell pour préparer ton espace.
        </p>
      </header>

      <section className="mt-4 grid grid-cols-4 gap-2">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={`rounded-2xl border px-2 py-2 text-center ${
              index <= stepIndex
                ? 'border-[#15EA3E]/30 bg-[#15EA3E]/10 text-[#15EA3E]'
                : 'border-white/10 bg-white/[0.03] text-white/32'
            }`}
          >
            <p className="text-[9px] font-black uppercase tracking-[0.12em]">{step.label}</p>
          </div>
        ))}
      </section>

      {(error || authError) && (
        <p className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-[11px] font-semibold leading-relaxed text-red-100">
          {error || authError}
        </p>
      )}

      {currentStep.id === 'role' && (
        <section className="mt-5">
          <h2 className="text-sm font-black">Que veux-tu faire sur AfriSell ?</h2>
          <p className="mt-1 text-[11px] font-semibold leading-relaxed text-white/45">
            Choisis l option qui te ressemble le plus.
          </p>
          <div className="mt-4 flex flex-col gap-2.5">
            {PUBLIC_ACCOUNT_ROLE_DEFINITIONS.map((role) => (
              <button
                key={role.id}
                type="button"
                disabled={busy}
                onClick={() => void selectRole(role.id)}
                className={`flex items-center gap-3 rounded-2xl border p-3 text-left active:scale-[0.99] disabled:opacity-60 ${
                  primaryRole === role.id
                    ? 'border-[#15EA3E]/50 bg-[#15EA3E]/12'
                    : 'border-white/10 bg-white/[0.04]'
                }`}
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#15EA3E]/10 text-[#15EA3E]">
                  <AfriSellIcon name={role.icon} size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-black">{role.label}</h3>
                  <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-relaxed text-white/45">{role.description}</p>
                </div>
                <AfriSellIcon name="arrow" size={15} className="text-white/25" />
              </button>
            ))}
          </div>
        </section>
      )}

      {currentStep.id === 'subtype' && roleDefinition && (
        <section className="mt-5">
          <button
            type="button"
            onClick={() => setStepIndex(0)}
            className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/45"
          >
            <AfriSellIcon name="arrow" size={13} className="rotate-180" />
            Changer
          </button>
          <h2 className="text-sm font-black">{roleDefinition.label}</h2>
          <p className="mt-1 text-[11px] font-semibold leading-relaxed text-white/45">
            Choisis ce qui correspond le mieux à ton activité.
          </p>
          <div className="mt-4 flex flex-col gap-2.5">
            {roleDefinition.subtypes.map((subtype) => (
              <button
                key={subtype.id}
                type="button"
                disabled={busy}
                onClick={() => void selectSubtype(subtype.id)}
                className={`flex items-center gap-3 rounded-2xl border p-3 text-left active:scale-[0.99] disabled:opacity-60 ${
                  primarySubtype === subtype.id
                    ? 'border-[#15EA3E]/50 bg-[#15EA3E]/12'
                    : 'border-white/10 bg-white/[0.04]'
                }`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/[0.05] text-[#15EA3E]">
                  <AfriSellIcon name="check" size={17} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-black">{subtype.label}</h3>
                  <p className="mt-1 text-[11px] font-semibold leading-relaxed text-white/45">{subtype.description}</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {currentStep.id === 'details' && (
        <section className="mt-5">
          <button
            type="button"
            onClick={() => setStepIndex(1)}
            className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/45"
          >
            <AfriSellIcon name="arrow" size={13} className="rotate-180" />
            Retour
          </button>
          <h2 className="text-sm font-black">Quelques infos</h2>
          <p className="mt-1 text-[11px] font-semibold leading-relaxed text-white/45">
            Elles nous aident à afficher le bon nom et la bonne ville.
          </p>

          <form onSubmit={submitDetails} className="mt-4 flex flex-col gap-3">
            <label className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white/38">Ton nom</span>
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                required
                className="mt-2 w-full bg-transparent text-sm font-bold text-white outline-none placeholder:text-white/24"
                  placeholder="Nom complet ou nom public"
              />
            </label>

            {isOrganization && (
              <label className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white/38">Nom de la boutique</span>
                <input
                  value={businessName}
                  onChange={(event) => setBusinessName(event.target.value)}
                  className="mt-2 w-full bg-transparent text-sm font-bold text-white outline-none placeholder:text-white/24"
                  placeholder="Boutique, marque ou structure"
                />
              </label>
            )}

            <label className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white/38">Pays</span>
              <select
                value={countryCode}
                onChange={(event) => {
                  setCountryCode(event.target.value);
                  setCity('');
                }}
                className="mt-2 w-full appearance-none bg-transparent text-sm font-bold text-white outline-none"
              >
                {AFRICAN_COUNTRIES_BY_PRIORITY.map((item) => (
                  <option key={item.code} value={item.code} className="bg-[#050705] text-white">
                    {item.name} ({item.dialCode})
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-[0.72fr_1fr] gap-3">
              <label className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white/38">Indicatif</span>
                <div className="mt-2 text-sm font-black text-[#15EA3E]">{selectedCountry.dialCode}</div>
              </label>
              <label className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white/38">Numéro</span>
                <input
                  value={phoneLocal}
                  onChange={(event) => setPhoneLocal(event.target.value)}
                  inputMode="tel"
                  className="mt-2 w-full bg-transparent text-sm font-bold text-white outline-none placeholder:text-white/24"
                  placeholder="81 000 0000"
                />
              </label>
            </div>

            <label className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white/38">Ville</span>
              <input
                value={city}
                onChange={(event) => setCity(event.target.value)}
                list="afrisell-city-list"
                className="mt-2 w-full bg-transparent text-sm font-bold text-white outline-none placeholder:text-white/24"
                placeholder={citiesLoading ? 'Chargement...' : 'Choisis ta ville'}
              />
              <datalist id="afrisell-city-list">
                {cities.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
              <p className="mt-2 text-[10px] font-semibold text-white/32">
                {citiesLoading
                  ? 'Recherche des villes...'
                  : citiesSource === 'online'
                    ? 'Villes proposées selon le pays choisi.'
                    : 'Choisis dans la liste ou écris ta ville.'}
              </p>
            </label>

            <label className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white/38">Petite présentation</span>
              <textarea
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                rows={3}
                className="mt-2 w-full resize-none bg-transparent text-sm font-semibold leading-relaxed text-white outline-none placeholder:text-white/24"
                placeholder="Dis en une phrase ce que tu fais."
              />
            </label>

            <button
              disabled={busy}
              className="mt-2 flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#15EA3E] text-xs font-black uppercase tracking-[0.15em] text-black active:scale-[0.98] disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Continuer
              <AfriSellIcon name="arrow" size={16} />
            </button>
          </form>
        </section>
      )}

      {currentStep.id === 'media' && (
        <section className="mt-5">
          <button
            type="button"
            onClick={() => setStepIndex(2)}
            className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/45"
          >
            <AfriSellIcon name="arrow" size={13} className="rotate-180" />
            Retour
          </button>

          <div className="rounded-[1.6rem] border border-[#15EA3E]/20 bg-[#0A0F0A] p-4">
            <div className="flex items-start gap-3">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black">
                {mediaPreview ? (
                  <img src={mediaPreview} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[#15EA3E]">
                    <AfriSellIcon name={isOrganization ? 'market' : 'profile'} size={25} />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-black">
                  {isOrganization ? 'Ajoute ton logo' : 'Ajoute ta photo'}
                </h2>
                <p className="mt-1 text-[11px] font-semibold leading-relaxed text-white/48">
                  {subtypeDefinition?.label || roleDefinition?.shortLabel || 'Compte AfriSell'}.
                  Tu peux ajouter une image maintenant ou le faire plus tard.
                </p>
              </div>
            </div>

            {!isCloudinaryReady() && (
              <p className="mt-4 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-3 text-[10px] font-bold leading-relaxed text-yellow-100">
                L'ajout de photo n'est pas disponible pour le moment.
              </p>
            )}

            <label className={`mt-4 flex h-12 items-center justify-center gap-2 rounded-2xl text-xs font-black uppercase tracking-[0.13em] active:scale-[0.98] ${
              busy || !isCloudinaryReady()
                ? 'bg-white/8 text-white/35'
                : 'bg-white text-black'
            }`}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <AfriSellIcon name="clip" size={16} />}
              Ajouter une image/vidéo
              <input
                type="file"
                accept="image/*,video/*"
                disabled={busy || !isCloudinaryReady()}
                onChange={uploadIdentityMedia}
                className="hidden"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={() => void completeSetup()}
            disabled={busy}
            className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#15EA3E] text-sm font-black uppercase tracking-[0.15em] text-black active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <AfriSellIcon name="check" size={17} />}
            Terminer
          </button>
        </section>
      )}
    </main>
  );
}
