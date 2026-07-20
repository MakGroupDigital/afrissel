import { FormEvent, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { AfriSellIcon } from '../components/AfriSellIcon';
import { getAfriSellAuthErrorMessage, useFirebaseAuth } from '../hooks/useFirebaseAuth';
import { AFRICAN_COUNTRIES_BY_PRIORITY, buildInternationalPhone, getDefaultCountry } from '../lib/africaLocation';
import { AFRISELL_MAIN_LOGO } from '../lib/branding';

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
    signInWithEmail,
    registerWithEmail,
    sendPhoneCode,
    confirmPhoneCode
  } = useFirebaseAuth();
  const [flow, setFlow] = useState<'login' | 'register'>('register');
  const [method, setMethod] = useState<'email' | 'phone'>('email');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phoneCountryCode, setPhoneCountryCode] = useState(getDefaultCountry().code);
  const [phoneLocal, setPhoneLocal] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneCodeSent, setPhoneCodeSent] = useState(false);
  const [attemptedAuth, setAttemptedAuth] = useState(false);
  const [socialProviderOpening, setSocialProviderOpening] = useState<'google' | null>(null);
  const [busy, setBusy] = useState(false);
  const selectedPhoneCountry = AFRICAN_COUNTRIES_BY_PRIORITY.find((country) => country.code === phoneCountryCode) || getDefaultCountry();
  const visibleAuthError = authError && (attemptedAuth || !authError.includes('connexion Google est indisponible')) ? authError : '';
  const nextPath = ((location.state as { next?: string } | null)?.next) || new URLSearchParams(location.search).get('next') || '/ecosystem';

  useEffect(() => {
    if (!loading && user) {
      window.localStorage.setItem('afrisell:onboarding-seen', '1');
      if (profile?.demographicsSetupRequired && !profile.demographicsSetupCompleted) {
        navigate('/identity-setup', { replace: true, state: { next: nextPath } });
        return;
      }
      navigate(nextPath, { replace: true });
    }
  }, [loading, navigate, nextPath, profile?.demographicsSetupCompleted, profile?.demographicsSetupRequired, user]);

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

  const runSocialAuth = (provider: 'google', action: () => Promise<void>) => {
    setSocialProviderOpening(provider);
    void runAuth(action);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (method === 'phone') {
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

    if (flow === 'register') {
      void runAuth(() => registerWithEmail(name, email, password));
      return;
    }

    void runAuth(() => signInWithEmail(email, password));
  };

  const selectFlow = (nextFlow: 'login' | 'register') => {
    setFlow(nextFlow);
    setPhoneCodeSent(false);
    setPhoneCode('');
    setAuthError('');
  };

  const selectMethod = (nextMethod: 'email' | 'phone') => {
    setMethod(nextMethod);
    setPhoneCodeSent(false);
    setPhoneCode('');
    setAuthError('');
  };

  return (
    <main className="relative h-full min-h-full overflow-hidden bg-[#050705] text-white">
      <div className="absolute inset-0">
        <img src="/afrispay.jpeg" alt="" className="h-full w-full object-cover opacity-[0.18]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,7,5,0.76),#050705_42%)]" />
      </div>

      <div className="relative z-10 flex h-full w-full flex-col overflow-hidden px-5 pb-4 pt-4">
        <div className="flex shrink-0 items-center justify-between">
          <Link to="/onboarding" className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-white/60" aria-label="Retour">
            <AfriSellIcon name="arrow" size={15} className="rotate-180" />
          </Link>
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">Compte AfriSell</p>
        </div>

        <div className="mt-3 flex shrink-0 justify-center">
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.88 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              filter: [
                'drop-shadow(0 0 0 rgba(21,234,62,0))',
                'drop-shadow(0 0 22px rgba(21,234,62,0.28))',
                'drop-shadow(0 0 8px rgba(21,234,62,0.12))'
              ]
            }}
            transition={{
              opacity: { duration: 0.45 },
              y: { duration: 0.45 },
              scale: { duration: 0.55, ease: 'easeOut' },
              filter: { duration: 2.4, repeat: Infinity, repeatType: 'reverse' }
            }}
            className="relative h-[clamp(4.75rem,15.5vh,6.6rem)] w-[clamp(4.75rem,15.5vh,6.6rem)] overflow-hidden rounded-[1.55rem] border border-[#15EA3E]/25 bg-black/42 shadow-[0_18px_44px_rgba(0,0,0,0.34)]"
          >
            <motion.img
              src={AFRISELL_MAIN_LOGO}
              alt="AfriSell"
              className="h-full w-full object-cover"
              animate={{ scale: [1, 1.035, 1] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <div className="pointer-events-none absolute inset-0 rounded-[1.55rem] ring-1 ring-white/10" />
          </motion.div>
        </div>

        <section className="mt-3 min-w-0 shrink-0">
          <div className="text-center">
            <h2 className="text-base font-black">
              {flow === 'login' ? 'Accéder à mon compte' : 'Créer mon compte'}
            </h2>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => selectMethod('email')}
              className={`flex h-9 items-center justify-center gap-2 rounded-xl border text-[9px] font-black uppercase tracking-[0.1em] ${
                method === 'email'
                  ? 'border-[#15EA3E]/45 bg-[#15EA3E]/12 text-[#15EA3E]'
                  : 'border-white/10 bg-white/[0.04] text-white/45'
              }`}
            >
              <AfriSellIcon name="mail" size={15} />
              Email
            </button>
            <button
              type="button"
              onClick={() => selectMethod('phone')}
              className={`flex h-9 items-center justify-center gap-2 rounded-xl border text-[9px] font-black uppercase tracking-[0.1em] ${
                method === 'phone'
                  ? 'border-[#15EA3E]/45 bg-[#15EA3E]/12 text-[#15EA3E]'
                  : 'border-white/10 bg-white/[0.04] text-white/45'
              }`}
            >
              <AfriSellIcon name="phone" size={15} />
              Téléphone
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-3 flex min-w-0 flex-col gap-2">
          {flow === 'register' && method === 'email' && (
            <label className="flex h-11 min-w-0 items-center gap-2.5 rounded-2xl border border-white/10 bg-black/40 px-3.5 focus-within:border-[#15EA3E]/50">
              <AfriSellIcon name="profile" size={16} className="text-[#15EA3E]" />
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Nom complet"
                className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-white outline-none placeholder:text-white/28"
              />
            </label>
          )}

          {method === 'email' ? (
            <>
              <label className="flex h-11 min-w-0 items-center gap-2.5 rounded-2xl border border-white/10 bg-black/40 px-3.5 focus-within:border-[#15EA3E]/50">
                <AfriSellIcon name="mail" size={16} className="text-[#15EA3E]" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  placeholder="nom@afrisell.app"
                  className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-white outline-none placeholder:text-white/28"
                />
              </label>

              <label className="flex h-11 min-w-0 items-center gap-2.5 rounded-2xl border border-white/10 bg-black/40 px-3.5 focus-within:border-[#15EA3E]/50">
                <AfriSellIcon name="lock" size={16} className="text-[#15EA3E]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={6}
                  placeholder="Mot de passe"
                  className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-white outline-none placeholder:text-white/28"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white/42 active:scale-95"
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  <AfriSellIcon name={showPassword ? 'eyeOff' : 'eye'} size={16} />
                </button>
              </label>
            </>
          ) : (
            <>
              <div className="flex h-11 items-center gap-2 rounded-2xl border border-white/10 bg-black/40 px-3 focus-within:border-[#15EA3E]/50">
                <AfriSellIcon name="phone" size={16} className="text-[#15EA3E]" />
                <select
                  value={phoneCountryCode}
                  onChange={(event) => {
                    setPhoneCountryCode(event.target.value);
                    setPhoneCodeSent(false);
                  }}
                  className="max-w-[104px] bg-transparent text-[11px] font-black text-white outline-none"
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
                  placeholder="Numéro"
                  className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-white outline-none placeholder:text-white/28"
                />
              </div>

              {phoneCodeSent && (
                <label className="flex h-11 min-w-0 items-center gap-2.5 rounded-2xl border border-white/10 bg-black/40 px-3.5 focus-within:border-[#15EA3E]/50">
                  <AfriSellIcon name="shield" size={16} className="text-[#15EA3E]" />
                  <input
                    type="text"
                    value={phoneCode}
                    onChange={(event) => setPhoneCode(event.target.value)}
                    required
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="Code SMS"
                    className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-white outline-none placeholder:text-white/28"
                  />
                </label>
              )}
            </>
          )}

          {visibleAuthError && (
            <p className="line-clamp-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-[10px] font-semibold leading-snug text-red-100">
              {visibleAuthError}
            </p>
          )}

          <button
            disabled={busy || loading}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#15EA3E] text-[11px] font-black uppercase tracking-[0.14em] text-black active:scale-[0.98] disabled:opacity-60"
          >
            {busy || loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {method === 'phone'
              ? (phoneCodeSent ? 'Vérifier le code' : 'Recevoir le code')
              : flow === 'login' ? 'Se connecter' : 'Créer le compte'}
            <AfriSellIcon name="arrow" size={18} />
          </button>
          </form>
        </section>
        <div id="afrisell-phone-recaptcha" className="sr-only" />

        <div className="mt-3 flex shrink-0 items-center gap-3">
          <span className="h-px flex-1 bg-white/10" />
          <span className="text-[9px] font-black uppercase tracking-[0.18em] text-white/30">ou</span>
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <button
          type="button"
          onClick={() => runSocialAuth('google', signInWithGoogle)}
          disabled={busy}
          className="mt-2 flex h-10 shrink-0 items-center justify-center gap-3 rounded-2xl bg-white text-[11px] font-black text-black active:scale-[0.98] disabled:opacity-60"
        >
          {socialProviderOpening === 'google'
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <img src="/google-logo.svg" alt="" className="h-5 w-5" />}
          {socialProviderOpening === 'google'
            ? 'Ouverture de Google'
            : 'Continuer avec Google'}
        </button>

        <button
          type="button"
          onClick={() => selectFlow(flow === 'login' ? 'register' : 'login')}
          className="mt-2 shrink-0 text-center text-[10px] font-semibold text-white/42"
        >
          {flow === 'login' ? 'Pas encore de compte ? ' : 'Vous avez déjà un compte ? '}
          <span className="font-black text-[#15EA3E]">{flow === 'login' ? "Créer un compte" : 'Connexion'}</span>
        </button>
      </div>
    </main>
  );
}
