import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { onValue, ref } from 'firebase/database';
import { AfriZiaIcon } from '../components/AfriZiaIcon';
import { useFirebaseAuth } from '../hooks/useFirebaseAuth';
import { realtimeDb } from '../lib/firebase';
import {
  AfriSpayPaymentLink,
  AfriSpayPaymentLinkPayment,
  isAfriSpayPaymentLinkExpired,
  payAfriSpayPaymentLinkWithMobileMoney,
  payAfriSpayPaymentLinkWithWallet,
  reconcileAfriSpayPaymentLinkPayment
} from '../domains/payment/paymentLinks';
import { cn } from '../lib/utils';

const formatMoney = (amount: number, currency: string) => new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency,
  maximumFractionDigits: 2
}).format(amount);

export default function PaymentLinkScreen() {
  const { paymentLinkId = '' } = useParams();
  const { user } = useFirebaseAuth();
  const [paymentLink, setPaymentLink] = useState<AfriSpayPaymentLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [method, setMethod] = useState<'mobile_money' | 'afrispay'>('mobile_money');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [pendingPayment, setPendingPayment] = useState<AfriSpayPaymentLinkPayment | null>(null);

  useEffect(() => {
    if (!paymentLinkId) return undefined;
    const unsubscribe = onValue(ref(realtimeDb, `afriSpayPaymentLinks/${paymentLinkId}`), (snapshot) => {
      setPaymentLink(snapshot.exists() ? snapshot.val() as AfriSpayPaymentLink : null);
      setLoading(false);
    }, () => {
      setPaymentLink(null);
      setLoading(false);
    });
    return unsubscribe;
  }, [paymentLinkId]);

  useEffect(() => {
    if (!pendingPayment || pendingPayment.status !== 'pending_operator') return undefined;
    const reconcile = async () => {
      try {
        const nextPayment = await reconcileAfriSpayPaymentLinkPayment(paymentLinkId, pendingPayment.id);
        setPendingPayment(nextPayment);
        if (nextPayment.status === 'confirmed') setStatus('Paiement confirmé. Le bénéficiaire a été crédité.');
        if (nextPayment.status === 'failed') setStatus('Le paiement Mobile Money a été refusé.');
      } catch {
        // Le paiement reste en attente tant que l’opérateur ne répond pas.
      }
    };
    const timer = window.setInterval(() => void reconcile(), 9000);
    return () => window.clearInterval(timer);
  }, [paymentLinkId, pendingPayment]);

  const payableAmount = useMemo(() => {
    if (!paymentLink) return 0;
    return paymentLink.amountMode === 'fixed' ? Number(paymentLink.amount || 0) : Number(amount);
  }, [amount, paymentLink]);
  const canUseWallet = Boolean(user && !user.isAnonymous);

  const pay = async () => {
    if (!paymentLink || busy) return;
    setStatus('');
    const nextAmount = paymentLink.amountMode === 'fixed' ? Number(paymentLink.amount) : Number(amount);
    if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
      setStatus('Entre le montant à payer.');
      return;
    }
    if (method === 'mobile_money' && !phoneNumber.trim()) {
      setStatus('Entre le numéro Mobile Money à débiter.');
      return;
    }

    setBusy(true);
    try {
      const result = method === 'afrispay'
        ? await payAfriSpayPaymentLinkWithWallet({ link: paymentLink, amount: nextAmount, payer: user! })
        : await payAfriSpayPaymentLinkWithMobileMoney({ link: paymentLink, amount: nextAmount, phoneNumber });
      setPendingPayment(result);
      setStatus(result.status === 'pending_operator'
        ? 'Valide la demande sur ton téléphone. La confirmation sera mise à jour automatiquement.'
        : 'Paiement confirmé. Le bénéficiaire a été crédité.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Paiement impossible.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <main className="flex min-h-full items-center justify-center bg-[#020504] px-5 text-center text-sm font-bold text-white/55">Chargement du lien de paiement...</main>;
  }

  if (!paymentLink) {
    return <main className="flex min-h-full items-center justify-center bg-[#020504] px-5 text-center text-white"><section><h1 className="text-xl font-black">Lien introuvable</h1><p className="mt-2 text-sm font-semibold text-white/48">Ce lien de paiement est invalide ou a été supprimé.</p><Link to="/ecosystem" className="mt-5 inline-flex rounded-2xl bg-[#15EA3E] px-4 py-3 text-xs font-black text-black">Ouvrir AfriZia</Link></section></main>;
  }

  const isExpired = isAfriSpayPaymentLinkExpired(paymentLink);
  const isClosed = paymentLink.status !== 'active' || isExpired;
  const isError = /impossible|refus|invalide|entre|insuffisant|actif/i.test(status);

  return (
    <main className="min-h-full overflow-y-auto bg-[#020504] px-4 pb-10 pt-5 text-white scrollbar-hide">
      <header className="mx-auto flex w-full max-w-md items-center justify-between">
        <Link to="/ecosystem" className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/70"><AfriZiaIcon name="arrow" size={17} className="rotate-180" /></Link>
        <div className="flex items-center gap-2"><img src="/afrispay.jpeg" alt="AfriSpay" className="h-7 w-7 rounded-lg object-cover" /><span className="text-sm font-black tracking-wide">AfriSpay</span></div>
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#15EA3E]/20 bg-[#15EA3E]/10 text-[#15EA3E]"><AfriZiaIcon name="shield" size={17} /></span>
      </header>

      <section className="mx-auto mt-7 w-full max-w-md overflow-hidden rounded-[2rem] border border-[#15EA3E]/20 bg-[linear-gradient(145deg,rgba(21,234,62,0.18),rgba(255,255,255,0.04),rgba(0,0,0,0.4))] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.32)]">
        <div className="flex items-center gap-3">
          {paymentLink.ownerPhotoURL ? <img src={paymentLink.ownerPhotoURL} alt="" className="h-12 w-12 rounded-2xl border border-white/15 object-cover" /> : <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#15EA3E] text-black"><AfriZiaIcon name="profile" size={21} /></span>}
          <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#15EA3E]">Paiement à</p><p className="truncate text-base font-black">{paymentLink.ownerName}</p></div>
        </div>
        <div className="mt-6 border-t border-white/10 pt-5">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/42">{paymentLink.title}</p>
          {paymentLink.description && <p className="mt-2 text-sm font-semibold leading-relaxed text-white/60">{paymentLink.description}</p>}
          {paymentLink.amountMode === 'fixed' ? <p className="mt-5 text-3xl font-black tracking-tight text-white">{formatMoney(Number(paymentLink.amount || 0), paymentLink.currency)}</p> : <p className="mt-5 text-sm font-bold text-white/55">Le bénéficiaire te laisse choisir le montant.</p>}
          <p className="mt-2 text-[10px] font-semibold text-white/38">Référence {paymentLink.reference}</p>
        </div>
      </section>

      <section className="mx-auto mt-4 w-full max-w-md rounded-[1.7rem] border border-white/10 bg-white/[0.045] p-4">
        {isClosed ? <p className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-3 text-center text-xs font-bold text-amber-100">{isExpired ? 'Ce lien de paiement a expiré.' : 'Ce lien de paiement est fermé.'}</p> : (
          <>
            {paymentLink.amountMode === 'open' && <label className="block text-[10px] font-black uppercase tracking-wider text-white/48">Montant à payer
              <div className="mt-2 flex overflow-hidden rounded-2xl border border-white/10 bg-black/25"><input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="0" className="min-w-0 flex-1 bg-transparent px-4 py-3 text-lg font-black outline-none" /><span className="flex items-center border-l border-white/10 px-3 text-xs font-black text-[#15EA3E]">{paymentLink.currency}</span></div>
            </label>}

            <p className="mt-4 text-[10px] font-black uppercase tracking-wider text-white/48">Choisir un moyen de paiement</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setMethod('mobile_money')} className={cn('rounded-2xl border p-3 text-left', method === 'mobile_money' ? 'border-[#15EA3E] bg-[#15EA3E]/10' : 'border-white/10 bg-black/20')}><AfriZiaIcon name="phone" size={17} className="text-[#15EA3E]" /><span className="mt-2 block text-xs font-black">Mobile Money</span><span className="mt-1 block text-[9px] font-semibold text-white/42">Même sans compte</span></button>
              <button type="button" onClick={() => canUseWallet && setMethod('afrispay')} disabled={!canUseWallet} className={cn('rounded-2xl border p-3 text-left disabled:opacity-45', method === 'afrispay' ? 'border-[#15EA3E] bg-[#15EA3E]/10' : 'border-white/10 bg-black/20')}><AfriZiaIcon name="pay" size={17} className="text-[#15EA3E]" /><span className="mt-2 block text-xs font-black">Mon AfriSpay</span><span className="mt-1 block text-[9px] font-semibold text-white/42">{canUseWallet ? 'Depuis ton wallet' : 'Connecte-toi pour ce choix'}</span></button>
            </div>

            {method === 'mobile_money' && <label className="mt-3 block text-[10px] font-black uppercase tracking-wider text-white/48">Numéro Mobile Money
              <input value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} inputMode="tel" placeholder="Ex. 099 000 00 00" className="mt-2 w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm font-bold normal-case tracking-normal outline-none" />
            </label>}

            {status && <p className={cn('mt-4 rounded-2xl border p-3 text-center text-xs font-bold leading-relaxed', isError ? 'border-red-500/25 bg-red-500/10 text-red-100' : 'border-[#15EA3E]/25 bg-[#15EA3E]/10 text-[#15EA3E]')}>{status}</p>}
            <button type="button" onClick={() => void pay()} disabled={busy || payableAmount <= 0} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#15EA3E] text-xs font-black uppercase tracking-[0.14em] text-black disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Traitement...' : `Payer ${payableAmount > 0 ? formatMoney(payableAmount, paymentLink.currency) : ''}`}<AfriZiaIcon name="arrow" size={16} /></button>
            {pendingPayment?.status === 'pending_operator' && <button type="button" onClick={() => void reconcileAfriSpayPaymentLinkPayment(paymentLink.id, pendingPayment.id).then((next) => { setPendingPayment(next); if (next.status === 'confirmed') setStatus('Paiement confirmé. Le bénéficiaire a été crédité.'); })} className="mt-2 w-full py-2 text-[10px] font-black uppercase tracking-wider text-white/48">Vérifier le paiement</button>}
          </>
        )}
      </section>
      <p className="mx-auto mt-4 max-w-md text-center text-[10px] font-semibold leading-relaxed text-white/35">Paiement protégé par AfriSpay. Tu ne dois jamais communiquer ton code secret.</p>
    </main>
  );
}
