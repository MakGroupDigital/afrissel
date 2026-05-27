import { FormEvent, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AfriSellIcon } from '../components/AfriSellIcon';
import { getAfriSellAuthErrorMessage, useFirebaseAuth } from '../hooks/useFirebaseAuth';
import { AFRICAN_COUNTRIES_BY_PRIORITY, buildInternationalPhone, getDefaultCountry } from '../lib/africaLocation';

export default function LoginScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    user,
    profile,
    loading,
    authError,
    setAuthError,
    signInWithGoogle,
    signInWithApple,
    signInWithEmail,
    registerWithEmail,
    sendPhoneCode,
    confirmPhoneCode
  } = useFirebaseAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'phone'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phoneCountryCode, setPhoneCountryCode] = useState(getDefaultCountry().code);
  const [phoneLocal, setPhoneLocal] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneCodeSent, setPhoneCodeSent] = useState(false);
  const [attemptedAuth, setAttemptedAuth] = useState(false);
  const [socialProviderOpening, setSocialProviderOpening] = useState<'google' | 'apple' | null>(null);
  const [busy, setBusy] = useState(false);
  const selectedPhoneCountry = AFRICAN_COUNTRIES_BY_PRIORITY.find((country) => country.code === phoneCountryCode) || getDefaultCountry();
  const visibleAuthError = authError && (attemptedAuth || !authError.includes('connexion Google est indisponible')) ? authError : '';
  const nextPath = ((location.state as { next?: string } | null)?.next) || new URLSearchParams(location.search).get('next') || '/ecosystem';

  useEffect(() => {
    if (!loading && user) {
      window.localStorage.setItem('afrisell:onboarding-seen', '1');
      navigate(nextPath, { replace: true });
    }
  }, [loading, navigate, nextPath, user]);

  const runAuth = async (action: () => Promise<void>) => {
    setAttemptedAuth(true);
    setBusy(true);
    setAuthError('');
    try {
      await action();
    } catch (error) {
      console.error('Connexion AfriSell impossible:', error);
      setAuthError(getAfriSellAuthErrorMessage(error));
    } finally {
      setSocialProviderOpening(null);
      setBusy(false);
    }
  };

  const runSocialAuth = (provider: 'google' | 'apple', action: () => Promise<void>) => {
    setSocialProviderOpening(provider);
    void runAuth(action);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (mode === 'phone') {
      if (phoneCodeSent) {
        void runAuth(() => confirmPhoneCode(phoneCode));
        return;
      }

      void runAuth(async () => {
        await sendPhoneCode(buildInternationalPhone(selectedPhoneCountry.dialCode, phoneLocal));
        setPhoneCodeSent(true);
      });
      return;
    }

    if (mode === 'register') {
      void runAuth(() => registerWithEmail(name, email, password));
      return;
    }

    void runAuth(() => signInWithEmail(email, password));
  };

  return (
    <main className="relative h-full min-h-full overflow-hidden bg-[#050705] px-5 pb-7 pt-8 text-white">
      <div className="absolute inset-0">
        <img src="/afrispay.jpeg" alt="" className="h-full w-full object-cover opacity-[0.18]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,7,5,0.78),#050705_52%)]" />
      </div>

      <div className="relative z-10 flex h-full flex-col">
        <Link to="/onboarding" className="w-max text-[10px] font-bold uppercase tracking-[0.22em] text-white/50">
          Retour
        </Link>

        <div className="mt-10 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-[#15EA3E]/25 bg-black/40">
            <img src="/afrissel-icon.jpeg" alt="AfriSell" className="h-full w-full object-cover" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#15EA3E]">Compte unique</p>
            <h1 className="mt-1 text-3xl font-black tracking-normal">Connexion</h1>
          </div>
        </div>

        <p className="mt-5 text-sm font-medium leading-relaxed text-white/62">
          Connecte-toi une seule fois pour acceder a ABC, Market, AfriChat, AfriSpay et aux prochains services.
        </p>

        <div className="mt-7 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => runSocialAuth('google', signInWithGoogle)}
            disabled={busy}
            className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-white text-xs font-black uppercase tracking-[0.12em] text-black active:scale-[0.98] disabled:opacity-60"
          >
            {socialProviderOpening === 'google' ? <Loader2 className="h-4 w-4 animate-spin" /> : <img src="/google-logo.svg" alt="" className="h-5 w-5" />}
            {socialProviderOpening === 'google' ? 'Ouverture' : 'Google'}
          </button>
          <button
            type="button"
            onClick={() => runSocialAuth('apple', signInWithApple)}
            disabled={busy}
            className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/[0.08] text-xs font-black uppercase tracking-[0.12em] text-white active:scale-[0.98] disabled:opacity-60"
          >
            {socialProviderOpening === 'apple' ? <Loader2 className="h-4 w-4 animate-spin" /> : <img src="/apple-logo.svg" alt="" className="h-5 w-5 text-white" />}
            {socialProviderOpening === 'apple' ? 'Ouverture' : 'Apple'}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-3 text-[10px] font-black uppercase tracking-[0.1em] ${mode === 'login' ? 'bg-[#15EA3E] text-black' : 'text-white/54'}`}
          >
            <AfriSellIcon name="mail" size={15} />
            Connexion
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-3 text-[10px] font-black uppercase tracking-[0.1em] ${mode === 'register' ? 'bg-[#15EA3E] text-black' : 'text-white/54'}`}
          >
            <AfriSellIcon name="account" size={15} />
            Inscription
          </button>
          <button
            type="button"
            onClick={() => setMode('phone')}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-3 text-[10px] font-black uppercase tracking-[0.1em] ${mode === 'phone' ? 'bg-[#15EA3E] text-black' : 'text-white/54'}`}
          >
            <AfriSellIcon name="phone" size={15} />
            Telephone
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3">
          {mode === 'register' && (
            <label className="flex h-14 items-center gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 focus-within:border-[#15EA3E]/50">
              <AfriSellIcon name="profile" size={18} className="text-[#15EA3E]" />
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Nom complet"
                className="w-full bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/28"
              />
            </label>
          )}

          {mode !== 'phone' ? (
            <>
              <label className="flex h-14 items-center gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 focus-within:border-[#15EA3E]/50">
                <AfriSellIcon name="mail" size={18} className="text-[#15EA3E]" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  placeholder="nom@afrisell.app"
                  className="w-full bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/28"
                />
              </label>

              <label className="flex h-14 items-center gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 focus-within:border-[#15EA3E]/50">
                <AfriSellIcon name="lock" size={18} className="text-[#15EA3E]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={6}
                  placeholder="Mot de passe"
                  className="w-full bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/28"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white/42 active:scale-95"
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  <AfriSellIcon name={showPassword ? 'eyeOff' : 'eye'} size={18} />
                </button>
              </label>
            </>
          ) : (
            <>
              <div className="flex h-14 items-center gap-2 rounded-2xl border border-white/10 bg-black/40 px-3 focus-within:border-[#15EA3E]/50">
                <AfriSellIcon name="phone" size={18} className="text-[#15EA3E]" />
                <select
                  value={phoneCountryCode}
                  onChange={(event) => {
                    setPhoneCountryCode(event.target.value);
                    setPhoneCodeSent(false);
                  }}
                  className="max-w-[116px] bg-transparent text-xs font-black text-white outline-none"
                >
                  {AFRICAN_COUNTRIES_BY_PRIORITY.map((country) => (
                    <option key={country.code} value={country.code} className="bg-[#050705] text-white">
                      {country.name} {country.dialCode}
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  value={phoneLocal}
                  onChange={(event) => {
                    setPhoneLocal(event.target.value);
                    setPhoneCodeSent(false);
                  }}
                  required
                  placeholder="Numero"
                  className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/28"
                />
              </div>

              {phoneCodeSent && (
                <label className="flex h-14 items-center gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 focus-within:border-[#15EA3E]/50">
                  <AfriSellIcon name="shield" size={18} className="text-[#15EA3E]" />
                  <input
                    type="text"
                    value={phoneCode}
                    onChange={(event) => setPhoneCode(event.target.value)}
                    required
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="Code SMS"
                    className="w-full bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/28"
                  />
                </label>
              )}
            </>
          )}

          {visibleAuthError && (
            <p className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-[11px] font-semibold leading-relaxed text-red-100">
              {visibleAuthError}
            </p>
          )}

          <button
            disabled={busy || loading}
            className="mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#15EA3E] text-sm font-black uppercase tracking-[0.16em] text-black active:scale-[0.98] disabled:opacity-60"
          >
            {busy || loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {mode === 'phone' ? (phoneCodeSent ? 'Verifier le code' : 'Recevoir le code') : mode === 'login' ? 'Ouvrir AfriSell' : 'Creer le compte'}
            <AfriSellIcon name="arrow" size={18} />
          </button>
        </form>
        <div id="afrisell-phone-recaptcha" className="sr-only" />

        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[#15EA3E]/20 bg-[#15EA3E]/8 p-4">
          <AfriSellIcon name="offline" size={18} className="mt-0.5 text-[#15EA3E]" />
          <p className="text-[11px] font-semibold leading-relaxed text-white/62">
            Mode faible connexion prevu : sessions courtes, donnees legeres et synchronisation des actions en attente.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          className="mt-auto pt-6 text-center text-[11px] font-semibold text-white/42"
        >
          {mode === 'login' ? 'Nouveau vendeur ? ' : 'Deja inscrit ? '}
          <span className="text-[#15EA3E]">{mode === 'login' ? 'Creer une boutique' : 'Se connecter'}</span>
        </button>
      </div>
    </main>
  );
}
