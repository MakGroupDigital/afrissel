import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { get, ref, serverTimestamp, update } from 'firebase/database';
import { cn } from '../lib/utils';
import { InvertedAfricaLogo } from '../components/InvertedAfricaLogo';
import { AfriSellIcon, AfriSellIconName } from '../components/AfriSellIcon';
import { useAfriSpayWallet } from '../hooks/useAfriSpayWallet';
import { useFirebaseAuth } from '../hooks/useFirebaseAuth';
import { executeWalletOperation, WalletOperationType } from '../domains/payment';
import { realtimeDb } from '../lib/firebase';

type WalletSecuritySettings = {
  pinEnabled: boolean;
  pinHash?: string;
  biometricEnabled: boolean;
  biometricCredentialId?: string;
};

const formatMoney = (amount: number, currency: string) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2
  }).format(amount);

const settingsKey = (uid?: string) => `afrissel:settings:${uid || 'guest'}`;
const credentialKey = (uid?: string) => `afrissel:wallet-biometric:${uid || 'guest'}`;

const hashPin = async (pin: string) => {
  const encoded = new TextEncoder().encode(pin);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

const arrayBufferToBase64Url = (buffer: ArrayBuffer) => {
  const bytes = Array.from(new Uint8Array(buffer));
  const binary = String.fromCharCode(...bytes);
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const base64UrlToArrayBuffer = (value: string) => {
  const padded = `${value}${'='.repeat((4 - value.length % 4) % 4)}`.replace(/-/g, '+').replace(/_/g, '/');
  const binary = window.atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
};

export default function WalletDashboard() {
  const { user, profile } = useFirebaseAuth();
  const { wallet, balance, currency, accountLabel, transactions, loading, error } = useAfriSpayWallet();
  const [showBalance, setShowBalance] = React.useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeAction = searchParams.get('action') as WalletOperationType | 'scan' | null;
  const [amount, setAmount] = React.useState('');
  const [recipient, setRecipient] = React.useState('');
  const [note, setNote] = React.useState('');
  const [operationStatus, setOperationStatus] = React.useState('');
  const [operationBusy, setOperationBusy] = React.useState(false);
  const [pinInput, setPinInput] = React.useState('');
  const [newPin, setNewPin] = React.useState('');
  const [securityStatus, setSecurityStatus] = React.useState('');
  const [securitySettings, setSecuritySettings] = React.useState<WalletSecuritySettings>({
    pinEnabled: false,
    biometricEnabled: false
  });
  const [privacyShieldVisible, setPrivacyShieldVisible] = React.useState(false);
  const isKycVerified = profile?.kycStatus === 'verified';
  const hasWalletPin = Boolean(securitySettings.pinEnabled && securitySettings.pinHash);
  const canUseBiometric = Boolean(securitySettings.biometricEnabled && securitySettings.biometricCredentialId);

  const actions = [
    { label: 'Dépôt', action: 'deposit', icon: 'deposit' as AfriSellIconName, color: 'text-white' },
    { label: 'Retrait', action: 'withdraw', icon: 'withdraw' as AfriSellIconName, color: 'text-white' },
    { label: 'Envoyer', action: 'transfer', icon: 'send' as AfriSellIconName, color: 'text-white' },
    { label: 'Scan', action: 'scan', icon: 'scan' as AfriSellIconName, color: 'text-[#15EA3E]' },
  ];
  const activeActionLabel = actions.find((action) => action.action === activeAction)?.label;

  const balanceLabel = showBalance ? formatMoney(balance, currency) : '••••••';
  const recipientPlaceholder = activeAction === 'transfer' ? 'Numero ou uid:beneficiaire' : 'Numero Mobile Money';
  const operationHelp = activeAction === 'deposit'
    ? 'Le depot credite ton wallet AfriSpay et cree une transaction confirmee.'
    : activeAction === 'withdraw'
      ? 'Le retrait verifie ton solde puis prepare la sortie Mobile Money.'
      : 'Le transfert envoie vers un wallet AfriSpay avec uid: ou vers un numero Mobile Money.';

  React.useEffect(() => {
    setAmount('');
    setRecipient('');
    setNote('');
    setOperationStatus('');
  }, [activeAction]);

  React.useEffect(() => {
    if (!user) return;

    const savedSettings = window.localStorage.getItem(settingsKey(user.uid));
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings) as { account?: WalletSecuritySettings };
        setSecuritySettings({
          pinEnabled: Boolean(parsed.account?.pinEnabled),
          pinHash: parsed.account?.pinHash,
          biometricEnabled: Boolean(parsed.account?.biometricEnabled),
          biometricCredentialId: parsed.account?.biometricCredentialId || window.localStorage.getItem(credentialKey(user.uid)) || undefined
        });
      } catch {
        // Remote settings below remain the source of truth if local parsing fails.
      }
    }

    void get(ref(realtimeDb, `userSettings/${user.uid}`)).then((snapshot) => {
      if (!snapshot.exists()) return;
      const remote = snapshot.val() as { account?: WalletSecuritySettings };
      setSecuritySettings((current) => ({
        ...current,
        pinEnabled: Boolean(remote.account?.pinEnabled),
        pinHash: remote.account?.pinHash,
        biometricEnabled: Boolean(remote.account?.biometricEnabled),
        biometricCredentialId: remote.account?.biometricCredentialId || current.biometricCredentialId
      }));
    }).catch(() => undefined);
  }, [user]);

  React.useEffect(() => {
    const showShield = () => {
      setPrivacyShieldVisible(true);
      window.setTimeout(() => setPrivacyShieldVisible(false), 2400);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'PrintScreen' || (event.metaKey && event.shiftKey) || (event.ctrlKey && event.key.toLowerCase() === 'p')) {
        showShield();
      }
    };
    const handleVisibility = () => {
      if (document.hidden) setPrivacyShieldVisible(true);
      else window.setTimeout(() => setPrivacyShieldVisible(false), 900);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('blur', showShield);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('blur', showShield);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const persistAccountSecurity = async (nextSettings: WalletSecuritySettings) => {
    if (!user) return;
    const savedSettings = window.localStorage.getItem(settingsKey(user.uid));
    const parsedSettings = savedSettings ? JSON.parse(savedSettings) as Record<string, unknown> : {};
    const nextLocalSettings = {
      ...parsedSettings,
      account: {
        ...((parsedSettings.account as Record<string, unknown> | undefined) || {}),
        ...nextSettings
      }
    };
    window.localStorage.setItem(settingsKey(user.uid), JSON.stringify(nextLocalSettings));
    await update(ref(realtimeDb, `userSettings/${user.uid}`), {
      account: nextSettings,
      updatedAt: serverTimestamp()
    });
    setSecuritySettings(nextSettings);
  };

  const defineWalletPin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    if (newPin.length < 4) {
      setSecurityStatus('Choisis un PIN de 4 chiffres minimum.');
      return;
    }

    const pinHash = await hashPin(newPin);
    const nextSettings = {
      ...securitySettings,
      pinEnabled: true,
      pinHash
    };
    await persistAccountSecurity(nextSettings);
    setNewPin('');
    setShowBalance(true);
    setSecurityStatus('PIN AfriSpay defini. Solde deverrouille.');
  };

  const unlockWithPin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!securitySettings.pinHash) return;
    const pinHash = await hashPin(pinInput);
    if (pinHash !== securitySettings.pinHash) {
      setSecurityStatus('PIN incorrect.');
      return;
    }
    setPinInput('');
    setShowBalance(true);
    setSecurityStatus('Solde deverrouille.');
  };

  const enableBiometric = async () => {
    if (!user || !hasWalletPin) {
      setSecurityStatus('Definis d abord ton PIN AfriSpay.');
      return;
    }
    if (!window.PublicKeyCredential || !navigator.credentials?.create) {
      setSecurityStatus('Biometrie indisponible sur cet appareil.');
      return;
    }

    try {
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: { name: 'AfriSell' },
          user: {
            id: new TextEncoder().encode(user.uid),
            name: user.email || user.uid,
            displayName: profile?.displayName || user.displayName || 'AfriSell'
          },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required'
          },
          timeout: 60000,
          attestation: 'none'
        }
      }) as PublicKeyCredential | null;

      if (!credential?.rawId) throw new Error('Biometrie non activee.');
      const credentialId = arrayBufferToBase64Url(credential.rawId);
      window.localStorage.setItem(credentialKey(user.uid), credentialId);
      await persistAccountSecurity({
        ...securitySettings,
        biometricEnabled: true,
        biometricCredentialId: credentialId
      });
      setSecurityStatus('Biometrie activee pour AfriSpay.');
    } catch {
      setSecurityStatus('Activation biometrie annulee ou indisponible.');
    }
  };

  const unlockWithBiometric = async () => {
    if (!securitySettings.biometricCredentialId || !navigator.credentials?.get) {
      setSecurityStatus('Biometrie non configuree.');
      return;
    }

    try {
      const credential = await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          allowCredentials: [{
            id: base64UrlToArrayBuffer(securitySettings.biometricCredentialId),
            type: 'public-key'
          }],
          userVerification: 'required',
          timeout: 60000
        }
      });
      if (!credential) throw new Error('Biometrie refusee.');
      setShowBalance(true);
      setSecurityStatus('Solde deverrouille par biometrie.');
    } catch {
      setSecurityStatus('Verification biometrie annulee ou refusee.');
    }
  };

  if (!isKycVerified) {
    return (
      <main className="flex min-h-full flex-col bg-black px-4 pb-8 pt-4 text-white">
        <header className="flex items-center justify-between">
          <Link to="/ecosystem" className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-[#15EA3E]" aria-label="Retour">
            <AfriSellIcon name="arrow" size={18} className="rotate-180" />
          </Link>
          <div className="text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">AfriSpay</p>
            <h1 className="text-sm font-black">Acces restreint</h1>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#15EA3E]/20 bg-[#15EA3E]/10 text-[#15EA3E]">
            <AfriSellIcon name="shield" size={18} />
          </div>
        </header>

        <section className="mt-8 overflow-hidden rounded-[2rem] border border-[#15EA3E]/20 bg-[#071007] p-5">
          <div className="relative mx-auto flex h-24 w-24 items-center justify-center rounded-[2rem] border border-[#15EA3E]/25 bg-black/35 text-[#15EA3E]">
            <img src="/afrispay.jpeg" alt="" className="absolute inset-4 rounded-2xl object-cover opacity-45" />
            <AfriSellIcon name="shield" size={32} className="relative z-10" />
          </div>
          <h2 className="mt-6 text-center text-2xl font-black leading-tight">Verification requise</h2>
          <p className="mt-3 text-center text-sm font-semibold leading-relaxed text-white/52">
            Pour acceder a notre solution de paiement AfriSpay, ton identite doit etre verifiee. Complete ton ID/KYC pour activer depot, retrait, transfert, QR et paiements.
          </p>

          <div className="mt-5 grid gap-2">
            {[
              'Protection des transactions',
              'Conformite paiement',
              'Acces wallet et carte AfriSpay'
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <AfriSellIcon name="check" size={15} className="text-[#15EA3E]" />
                <span className="text-xs font-bold text-white/62">{item}</span>
              </div>
            ))}
          </div>

          <Link to="/profile" className="mt-6 flex h-12 w-full items-center justify-center rounded-2xl bg-[#15EA3E] text-xs font-black uppercase tracking-[0.14em] text-black">
            Se faire verifier
          </Link>
          <Link to="/ecosystem" className="mt-3 flex h-11 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-xs font-black uppercase tracking-[0.14em] text-white/60">
            Retour accueil
          </Link>
        </section>
      </main>
    );
  }

  const submitOperation = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeAction || activeAction === 'scan') return;

    if (!user) {
      setOperationStatus('Connecte-toi pour utiliser AfriSpay.');
      return;
    }

    setOperationBusy(true);
    setOperationStatus('');

    try {
      const result = await executeWalletOperation({
        user,
        type: activeAction,
        amount: Number(amount),
        currency,
        phoneOrRecipient: recipient,
        accountNumber: wallet?.accountNumber,
        note
      });
      setAmount('');
      setRecipient('');
      setNote('');
      setOperationStatus(
        result.status === 'pending_operator'
          ? 'Operation creee. Confirmation operateur en attente.'
          : 'Operation AfriSpay confirmee.'
      );
    } catch (operationError) {
      setOperationStatus(operationError instanceof Error ? operationError.message : 'Operation AfriSpay impossible.');
    } finally {
      setOperationBusy(false);
    }
  };

  return (
    <div className="relative min-h-full bg-[#000000] p-4 flex flex-col gap-6">
      
      {/* Header */}
      <header className="px-2 py-2 flex justify-between items-center">
        <div className="flex flex-col">
          <span className="text-[10px] text-gray-500 uppercase tracking-widest">Solde afrisPay</span>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-[#15EA3E] font-mono tracking-tight">
              {loading ? 'Chargement...' : balanceLabel}
            </span>
            <button
              onClick={() => {
                if (showBalance) {
                  setShowBalance(false);
                  return;
                }
                setSecurityStatus(hasWalletPin ? 'Entre ton PIN ou utilise la biometrie pour afficher le solde.' : 'Definis un PIN AfriSpay pour afficher le solde.');
              }}
              className="text-gray-500 hover:text-[#15EA3E] transition-colors"
            >
              <AfriSellIcon name={showBalance ? 'eyeOff' : 'eye'} size={14} />
            </button>
          </div>
        </div>
        <div className="w-10 h-10 rounded-full border border-[#15EA3E]/30 flex items-center justify-center bg-[#0A0A0A] overflow-hidden cursor-pointer shadow-[0_0_15px_rgba(21,234,62,0.2)]">
          <div className="w-5 h-5 rounded-full bg-[#15EA3E]"></div>
        </div>
      </header>

      {/* afrisPay payment card */}
      <div className="relative w-full aspect-[1.586] rounded-2xl p-5 flex flex-col justify-between overflow-hidden border border-gray-800"
           style={{
             background: 'linear-gradient(135deg, #0A0A0A 0%, #000000 100%)',
             boxShadow: '0 10px 40px rgba(21, 234, 62, 0.10)'
           }}>
        
        {/* Card Background Logo Watermark */}
        <div className="absolute -right-16 -top-16 opacity-5 pointer-events-none">
          <InvertedAfricaLogo className="w-64 h-64 text-white" />
        </div>

        {/* Shine effect for card realism */}
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-50 pointer-events-none"></div>

        <div className="relative z-10 flex justify-between items-start">
           <div className="flex flex-col">
               <div className="flex items-center gap-2">
                 <img src="/afrispay.jpeg" alt="afrisPay" className="h-8 w-8 rounded-lg object-cover border border-[#15EA3E]/20" />
                 <span className="text-gray-400 font-bold tracking-widest text-[11px]">afrisPay</span>
               </div>
           </div>
           <div className="flex items-start gap-3">
             <AfriSellIcon name="signal" size={22} className="mt-1 text-white/55" />
             {/* Minimalist Tech Chip */}
             <div className="w-12 h-9 bg-gray-900/80 rounded border border-gray-700/50 flex flex-col items-center justify-center relative overflow-hidden gap-[2px]">
               <div className="absolute inset-0 bg-gradient-to-br from-[#15EA3E]/10 to-transparent"></div>
               <div className="w-full h-[1px] bg-gray-700/50"></div>
               <div className="w-full h-[1px] bg-gray-700/50"></div>
               <div className="w-full h-[1px] bg-gray-700/50"></div>
               <div className="absolute left-1/2 -translate-x-1/2 w-[1px] h-full bg-gray-700/50"></div>
             </div>
          </div>
        </div>

        <div className="relative z-10 flex items-end justify-between mt-auto">
          <div className="flex flex-col">
            <p className="text-gray-400 text-[10px] mb-1 font-mono tracking-[0.2em] opacity-80">
              {accountLabel || 'Compte non initialise'}
            </p>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-black text-white tracking-tight font-mono">
                {loading ? '...' : balanceLabel}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end">
             <span className="text-[#15EA3E] font-black italic text-lg tracking-tighter leading-none mb-1">SPAY.</span>
             <span className="text-[8px] text-gray-500 uppercase tracking-widest font-bold">Virtual</span>
          </div>
        </div>
      </div>

      {!showBalance && (
        <section className="rounded-2xl border border-[#15EA3E]/20 bg-[#071007] p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#15EA3E]/10 text-[#15EA3E]">
              <AfriSellIcon name="lock" size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-white">Solde protege</p>
              <p className="mt-1 text-[11px] font-semibold leading-relaxed text-white/45">
                {hasWalletPin
                  ? 'Entre ton PIN AfriSpay ou utilise la biometrie pour afficher ton solde.'
                  : 'Definis un PIN AfriSpay. Il sera demande avant chaque affichage du solde.'}
              </p>
            </div>
          </div>

          {hasWalletPin ? (
            <form onSubmit={unlockWithPin} className="mt-4 grid gap-2">
              <input
                value={pinInput}
                onChange={(event) => setPinInput(event.target.value.replace(/[^\d]/g, '').slice(0, 8))}
                inputMode="numeric"
                type="password"
                placeholder="PIN AfriSpay"
                className="h-12 rounded-2xl border border-white/10 bg-black px-4 text-sm font-semibold text-white outline-none focus:border-[#15EA3E]/50"
              />
              <div className="grid grid-cols-2 gap-2">
                <button type="submit" className="h-11 rounded-2xl bg-[#15EA3E] text-[10px] font-black uppercase tracking-wider text-black">
                  Deverrouiller
                </button>
                <button
                  type="button"
                  onClick={() => void (canUseBiometric ? unlockWithBiometric() : enableBiometric())}
                  className="h-11 rounded-2xl border border-white/10 bg-white/[0.05] text-[10px] font-black uppercase tracking-wider text-white/70"
                >
                  {canUseBiometric ? 'Biometrie' : 'Activer bio'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={defineWalletPin} className="mt-4 grid gap-2">
              <input
                value={newPin}
                onChange={(event) => setNewPin(event.target.value.replace(/[^\d]/g, '').slice(0, 8))}
                inputMode="numeric"
                type="password"
                placeholder="Nouveau PIN AfriSpay"
                className="h-12 rounded-2xl border border-white/10 bg-black px-4 text-sm font-semibold text-white outline-none focus:border-[#15EA3E]/50"
              />
              <button type="submit" className="h-11 rounded-2xl bg-[#15EA3E] text-[10px] font-black uppercase tracking-wider text-black">
                Definir le PIN
              </button>
            </form>
          )}

          {securityStatus && (
            <p className={cn(
              'mt-3 rounded-xl border px-3 py-2 text-[10px] font-semibold leading-relaxed',
              securityStatus.includes('incorrect') || securityStatus.includes('indisponible') || securityStatus.includes('refuse')
                ? 'border-red-500/25 bg-red-500/10 text-red-100'
                : 'border-[#15EA3E]/25 bg-[#15EA3E]/10 text-[#15EA3E]'
            )}>
              {securityStatus}
            </p>
          )}
        </section>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-4 gap-3">
         {actions.map((act) => {
           const isAccent = act.label === 'Scan';
           return (
             <div key={act.label} className="flex flex-col items-center gap-2">
                <button
                  onClick={() => {
                    if (act.action === 'scan') {
                      window.location.assign('/scan');
                      return;
                    }
                    setSearchParams({ action: act.action });
                  }}
                  className={cn(
                  "w-14 h-14 rounded-xl flex items-center justify-center transition-all bg-[#0A0A0A] border hover:-translate-y-1",
                  isAccent 
                    ? "border-[#15EA3E]/40 shadow-[0_0_15px_rgba(21,234,62,0.15)]" 
                    : "border-gray-800 hover:border-gray-700 active:scale-95"
                )}>
                  <AfriSellIcon name={act.icon} size={20} className={act.color} />
                </button>
                <span className="text-gray-400 text-[9px] font-semibold uppercase tracking-wider">{act.label}</span>
             </div>
           )
         })}
      </div>

      {activeActionLabel && activeAction !== 'scan' && (
        <form onSubmit={submitOperation} className="rounded-2xl border border-[#15EA3E]/20 bg-[#0A0A0A] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#15EA3E]">Operation</p>
              <h2 className="mt-1 text-lg font-black text-white">{activeActionLabel} AfriSpay</h2>
              <p className="mt-1 text-[11px] font-semibold leading-relaxed text-gray-500">
                {operationHelp}
              </p>
            </div>
            <button type="button" onClick={() => setSearchParams({})} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-800 text-gray-500">
              <AfriSellIcon name="close" size={16} />
            </button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="Montant"
              inputMode="decimal"
              className="h-12 rounded-2xl border border-gray-800 bg-black px-4 text-sm font-semibold text-white outline-none focus:border-[#15EA3E]/50"
            />
            <input
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
              placeholder={recipientPlaceholder}
              inputMode={activeAction === 'transfer' ? 'text' : 'tel'}
              className="h-12 rounded-2xl border border-gray-800 bg-black px-4 text-sm font-semibold text-white outline-none focus:border-[#15EA3E]/50"
            />
          </div>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Note optionnelle"
            rows={2}
            className="mt-2 w-full resize-none rounded-2xl border border-gray-800 bg-black px-4 py-3 text-sm font-semibold text-white outline-none focus:border-[#15EA3E]/50"
          />
          {operationStatus && (
            <p className={cn(
              "mt-3 rounded-xl border px-3 py-2 text-[11px] font-bold leading-relaxed",
              operationStatus.includes('impossible') || operationStatus.includes('invalide') || operationStatus.includes('insuffisant') || operationStatus.includes('requis') || operationStatus.includes('Connecte')
                ? "border-red-500/25 bg-red-500/10 text-red-100"
                : "border-[#15EA3E]/25 bg-[#15EA3E]/10 text-[#15EA3E]"
            )}>
              {operationStatus}
            </p>
          )}
          <button
            type="submit"
            disabled={operationBusy}
            className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#15EA3E] text-xs font-black uppercase tracking-[0.14em] text-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {operationBusy ? 'Traitement...' : 'Confirmer'}
            <AfriSellIcon name="arrow" size={16} />
          </button>
        </form>
      )}

      {/* Recent Transactions */}
      <div className="flex flex-col flex-1 mt-2">
         <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs uppercase tracking-[0.2em] font-semibold text-gray-400">Transactions</h3>
            {transactions.length > 0 && (
              <button className="text-[#15EA3E] text-[10px] underline uppercase tracking-wider shadow-[#15EA3E]">Voir tout</button>
            )}
         </div>

         <div className="flex flex-col gap-3 pb-12">
            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-[11px] font-semibold leading-relaxed text-red-100">
                {error}
              </div>
            )}

            {!loading && !error && transactions.length === 0 && (
              <div className="rounded-xl border border-gray-800 bg-[#0A0A0A] p-4 text-center">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-[#15EA3E]/25 bg-[#15EA3E]/10 text-[#15EA3E]">
                  <AfriSellIcon name="pay" size={20} />
                </div>
                <p className="mt-3 text-xs font-black text-white">Aucune transaction</p>
                <p className="mt-1 text-[11px] font-semibold leading-relaxed text-gray-500">
                  Tes vraies operations AfriSpay apparaitront ici.
                </p>
              </div>
            )}

            {transactions.map(tx => {
               return (
                 <div key={tx.id} className="flex items-center justify-between p-3 bg-[#0A0A0A] rounded-xl border border-gray-800 hover:border-gray-700 transition-colors cursor-pointer group">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 rounded-lg bg-[#000000] flex items-center justify-center border border-gray-800 group-hover:border-[#15EA3E]/30 transition-colors">
                          <AfriSellIcon name={tx.icon} size={16} className="text-gray-400 group-hover:text-white transition-colors" />
                       </div>
                       <div className="flex flex-col">
                          <span className="text-gray-300 font-medium text-xs font-sans tracking-wide">{tx.title}</span>
                          <span className="text-gray-600 text-[10px] font-mono mt-0.5">{tx.dateLabel}</span>
                          {tx.status && (
                            <span className="mt-1 w-fit rounded-full border border-gray-800 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.16em] text-gray-500">
                              {tx.status === 'pending_operator' ? 'En attente' : tx.status}
                            </span>
                          )}
                       </div>
                    </div>
                    <div className={cn(
                      "font-mono text-sm font-bold tracking-tight",
                      tx.type === 'credit' ? 'text-[#FFFFFF]' : 'text-gray-500'
                    )}>
                       {tx.type === 'credit' ? '+' : ''}{formatMoney(Math.abs(tx.amount), tx.currency)}
                    </div>
                 </div>
               )
            })}
         </div>
      </div>

      {privacyShieldVisible && (
        <div className="absolute inset-0 z-[90] flex flex-col items-center justify-center bg-black px-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-[#15EA3E]/25 bg-[#15EA3E]/10 text-[#15EA3E]">
            <AfriSellIcon name="shield" size={28} />
          </div>
          <h2 className="mt-5 text-xl font-black">Capture bloquee</h2>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-white/45">
            Les donnees AfriSpay sont masquees pour proteger ton solde et tes transactions.
          </p>
        </div>
      )}

    </div>
  );
}
