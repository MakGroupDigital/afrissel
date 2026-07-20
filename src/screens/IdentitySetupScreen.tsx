import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AfriSellIcon } from '../components/AfriSellIcon';
import { useFirebaseAuth } from '../hooks/useFirebaseAuth';
import { AFRISELL_MAIN_LOGO } from '../lib/branding';

const genderOptions = [
  { value: 'female', label: 'Femme' },
  { value: 'male', label: 'Homme' },
  { value: 'non_binary', label: 'Autre' },
  { value: 'prefer_not_to_say', label: 'Je préfère ne pas dire' }
];

const getMaxBirthDate = () => {
  const today = new Date();
  return new Date(today.getFullYear() - 13, today.getMonth(), today.getDate()).toISOString().slice(0, 10);
};

export default function IdentitySetupScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, loading, completeDemographicsSetup } = useFirebaseAuth();
  const [dateOfBirth, setDateOfBirth] = useState(profile?.dateOfBirth || '');
  const [gender, setGender] = useState(profile?.gender || '');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const maxBirthDate = useMemo(getMaxBirthDate, []);
  const nextPath = ((location.state as { next?: string } | null)?.next) || '/ecosystem';

  useEffect(() => {
    if (profile?.dateOfBirth) setDateOfBirth(profile.dateOfBirth);
    if (profile?.gender) setGender(profile.gender);
  }, [profile?.dateOfBirth, profile?.gender]);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login', { replace: true, state: { next: '/identity-setup' } });
    }
  }, [loading, navigate, user]);

  useEffect(() => {
    if (!loading && profile?.demographicsSetupCompleted && !profile.demographicsSetupRequired) {
      navigate(nextPath, { replace: true });
    }
  }, [loading, navigate, nextPath, profile?.demographicsSetupCompleted, profile?.demographicsSetupRequired]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!dateOfBirth || !gender) {
      setStatus('Ajoute ta date de naissance et ton sexe pour continuer.');
      return;
    }

    if (dateOfBirth > maxBirthDate) {
      setStatus('L’âge minimum requis est 13 ans.');
      return;
    }

    setBusy(true);
    setStatus('');
    try {
      await completeDemographicsSetup({
        dateOfBirth,
        gender
      });
      navigate(nextPath, { replace: true });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="relative h-full overflow-hidden bg-[#050705] text-white">
      <div className="absolute inset-0">
        <img src="/afrispay.jpeg" alt="" className="h-full w-full object-cover opacity-[0.16]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,7,5,0.64),#050705_45%)]" />
      </div>

      <div className="relative z-10 flex h-full flex-col px-5 pb-7 pt-6">
        <div className="flex items-center justify-between">
          <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-[#15EA3E]/25 bg-black/40">
            <img src={AFRISELL_MAIN_LOGO} alt="AfriSell" className="h-full w-full object-cover" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">Compte AfriSell</p>
        </div>

        <section className="mt-8">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#15EA3E]">Dernière étape</p>
          <h1 className="mt-2 text-3xl font-black leading-none">Complète ton profil</h1>
          <p className="mt-3 text-sm font-semibold leading-relaxed text-white/52">
            Ces informations sont obligatoires pour adapter l’expérience, la sécurité et les accès dans l’écosystème AfriSell.
          </p>
        </section>

        <form onSubmit={submit} className="mt-7 flex flex-1 flex-col">
          <div className="grid gap-4">
            <label className="grid gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white/45">Date de naissance</span>
              <div className="flex h-14 items-center gap-3 rounded-2xl border border-white/10 bg-black/42 px-4 focus-within:border-[#15EA3E]/50">
                <AfriSellIcon name="clock" size={18} className="text-[#15EA3E]" />
                <input
                  type="date"
                  value={dateOfBirth}
                  max={maxBirthDate}
                  onChange={(event) => setDateOfBirth(event.target.value)}
                  required
                  className="min-w-0 flex-1 bg-transparent text-sm font-black text-white outline-none [color-scheme:dark]"
                />
              </div>
            </label>

            <div className="grid gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white/45">Sexe</span>
              <div className="grid grid-cols-2 gap-2">
                {genderOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setGender(option.value)}
                    className={`min-h-12 rounded-2xl border px-3 text-left text-xs font-black transition-colors ${
                      gender === option.value
                        ? 'border-[#15EA3E]/55 bg-[#15EA3E] text-black'
                        : 'border-white/10 bg-white/[0.045] text-white/58'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {status && (
            <p className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-[11px] font-semibold leading-relaxed text-red-100">
              {status}
            </p>
          )}

          <div className="mt-auto pt-6">
            <button
              type="submit"
              disabled={busy || loading}
              className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#15EA3E] text-xs font-black uppercase tracking-[0.14em] text-black active:scale-[0.98] disabled:opacity-60"
            >
              {busy || loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Continuer
              <AfriSellIcon name="arrow" size={18} />
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
