import React from 'react';
import { cn } from '../lib/utils';
import { InvertedAfricaLogo } from '../components/InvertedAfricaLogo';
import { AfriSellIcon, AfriSellIconName } from '../components/AfriSellIcon';
import { useAfriSpayWallet } from '../hooks/useAfriSpayWallet';

const formatMoney = (amount: number, currency: string) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2
  }).format(amount);

export default function WalletDashboard() {
  const { balance, currency, accountLabel, transactions, loading, error } = useAfriSpayWallet();
  const [showBalance, setShowBalance] = React.useState(true);

  const actions = [
    { label: 'Dépôt', icon: 'deposit' as AfriSellIconName, color: 'text-white' },
    { label: 'Retrait', icon: 'withdraw' as AfriSellIconName, color: 'text-white' },
    { label: 'Envoyer', icon: 'send' as AfriSellIconName, color: 'text-white' },
    { label: 'Scan', icon: 'scan' as AfriSellIconName, color: 'text-[#15EA3E]' },
  ];

  const balanceLabel = showBalance ? formatMoney(balance, currency) : '••••••';

  return (
    <div className="min-h-full bg-[#000000] p-4 flex flex-col gap-6">
      
      {/* Header */}
      <header className="px-2 py-2 flex justify-between items-center">
        <div className="flex flex-col">
          <span className="text-[10px] text-gray-500 uppercase tracking-widest">Solde afrisPay</span>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-[#15EA3E] font-mono tracking-tight">
              {loading ? 'Chargement...' : balanceLabel}
            </span>
            <button onClick={() => setShowBalance(!showBalance)} className="text-gray-500 hover:text-[#15EA3E] transition-colors">
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

      {/* Quick Actions */}
      <div className="grid grid-cols-4 gap-3">
         {actions.map((act) => {
           const isAccent = act.label === 'Scan';
           return (
             <div key={act.label} className="flex flex-col items-center gap-2">
                <button className={cn(
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

    </div>
  );
}
