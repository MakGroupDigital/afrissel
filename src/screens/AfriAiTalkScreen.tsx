import { FormEvent, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AfriSellIcon } from '../components/AfriSellIcon';
import type { AfriSellIconName } from '../components/AfriSellIcon';
import { cn } from '../lib/utils';

type ConversationMode = 'voice' | 'text' | 'task';

const quickPrompts = [
  'Trouve une offre proche de moi',
  'Resume mes messages importants',
  'Aide-moi à vendre un produit',
  'Compare les prix et la livraison'
];

const settings = [
  { id: 'search', label: 'Recherche', body: 'Acces aux resultats et services AfriSell.' },
  { id: 'pro', label: 'Mode Pro', body: 'Reponses plus strategiques et detaillees.' },
  { id: 'memory', label: 'Memoire', body: 'Contexte de conversation active.' }
];

const conversationModes: Array<{ id: ConversationMode; label: string; icon: AfriSellIconName }> = [
  { id: 'voice', label: 'Vocal', icon: 'signal' },
  { id: 'text', label: 'Texte', icon: 'keyboard' },
  { id: 'task', label: 'Taches', icon: 'flash' }
];

export default function AfriAiTalkScreen() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<ConversationMode>('voice');
  const [message, setMessage] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [enabledSettings, setEnabledSettings] = useState<Record<string, boolean>>({
    search: true,
    pro: false,
    memory: true
  });
  const [conversation, setConversation] = useState([
    {
      role: 'assistant',
      text: "Je suis AfriAI. Je peux t'aider à chercher, vendre, payer, organiser une livraison, résumer une conversation ou préparer une action dans l'écosystème."
    }
  ]);

  const modeTitle = useMemo(() => ({
    voice: 'Conversation vocale',
    text: 'Discussion ecrite',
    task: 'Taches rapides'
  }[mode]), [mode]);

  const submitMessage = (event?: FormEvent) => {
    event?.preventDefault();
    const cleanMessage = message.trim();
    if (!cleanMessage) return;

    setConversation((current) => [
      ...current,
      { role: 'user', text: cleanMessage },
      {
        role: 'assistant',
        text: 'Je garde le contexte et je prépare la meilleure action AfriSell pour cette demande. Les connexions aux services seront activées progressivement.'
      }
    ]);
    setMessage('');
  };

  const runQuickPrompt = (prompt: string) => {
    setMessage(prompt);
    setConversation((current) => [
      ...current,
      { role: 'user', text: prompt },
      {
        role: 'assistant',
        text: 'Je peux transformer cette demande en action: recherche, comparaison, message, paiement, livraison ou publication selon le module concerné.'
      }
    ]);
  };

  return (
    <main className="africhat-message-wall relative flex h-full min-h-0 flex-col overflow-hidden bg-black text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(21,234,62,0.24),transparent_34%),linear-gradient(180deg,rgba(0,0,0,0.38),rgba(0,0,0,0.88))]" />
      <div className="pointer-events-none absolute left-1/2 top-[18%] h-56 w-56 -translate-x-1/2 rounded-full border border-[#15EA3E]/20 bg-[#15EA3E]/5 blur-2xl afriai-orb" />

      <header className="relative z-10 flex shrink-0 items-center justify-between px-4 pt-5">
        <button type="button" onClick={() => navigate(-1)} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-black/45 text-white/70 backdrop-blur-xl">
          <AfriSellIcon name="arrow" size={17} className="rotate-180" />
        </button>
        <div className="text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#15EA3E]">AfriAI</p>
          <h1 className="text-sm font-black text-white">{modeTitle}</h1>
        </div>
        <button type="button" className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-black/45 text-[#15EA3E] backdrop-blur-xl">
          <AfriSellIcon name="account" size={16} />
        </button>
      </header>

      <section className="relative z-10 shrink-0 px-4 pt-5">
        <div className="relative mx-auto flex h-40 w-40 items-center justify-center">
          <div className={cn('absolute inset-0 rounded-full border border-[#15EA3E]/20', isListening && 'afriai-pulse-ring')} />
          <div className={cn('absolute inset-4 rounded-full border border-[#15EA3E]/30', isListening && 'afriai-pulse-ring [animation-delay:180ms]')} />
          <button
            type="button"
            onClick={() => setIsListening((current) => !current)}
            className={cn(
              'relative flex h-24 w-24 items-center justify-center rounded-full border text-black shadow-[0_0_44px_rgba(21,234,62,0.36)] transition-transform active:scale-95',
              isListening ? 'border-[#15EA3E] bg-[#15EA3E]' : 'border-[#15EA3E]/45 bg-[#15EA3E]/88'
            )}
            aria-label={isListening ? 'Arreter la voix' : 'Parler à AfriAI'}
          >
            <span className="relative flex h-8 w-6 items-end justify-center rounded-full border-2 border-black">
              <span className={cn('mb-1 h-3 w-1.5 rounded-full bg-black transition-all', isListening && 'h-5 afriai-wave')} />
            </span>
          </button>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 rounded-[1.35rem] border border-white/10 bg-black/38 p-1.5 backdrop-blur-xl">
          {conversationModes.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setMode(item.id)}
              className={cn(
                'flex items-center justify-center gap-1.5 rounded-2xl px-2 py-2 text-[10px] font-black uppercase tracking-wider transition-colors',
                mode === item.id ? 'bg-[#15EA3E] text-black' : 'text-white/55'
              )}
            >
              <AfriSellIcon name={item.icon} size={13} />
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <section className="relative z-10 min-h-0 flex-1 overflow-y-auto px-4 py-4 scrollbar-hide">
        <div className="mb-4 grid gap-2">
          {settings.map((setting) => (
            <button
              key={setting.id}
              type="button"
              onClick={() => setEnabledSettings((current) => ({ ...current, [setting.id]: !current[setting.id] }))}
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/34 p-3 text-left backdrop-blur-xl"
            >
              <span className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border',
                enabledSettings[setting.id] ? 'border-[#15EA3E]/45 bg-[#15EA3E]/14 text-[#15EA3E]' : 'border-white/10 bg-white/[0.04] text-white/38'
              )}>
                <AfriSellIcon name={setting.id === 'search' ? 'search' : setting.id === 'pro' ? 'flash' : 'shield'} size={15} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-black text-white">{setting.label}</span>
                <span className="mt-0.5 block text-[10px] font-semibold leading-snug text-white/45">{setting.body}</span>
              </span>
              <span className={cn('h-5 w-9 rounded-full p-0.5 transition-colors', enabledSettings[setting.id] ? 'bg-[#15EA3E]' : 'bg-white/12')}>
                <span className={cn('block h-4 w-4 rounded-full bg-black transition-transform', enabledSettings[setting.id] && 'translate-x-4')} />
              </span>
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {conversation.map((entry, index) => (
            <div key={`${entry.role}-${index}`} className={cn('flex', entry.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={cn(
                'max-w-[84%] rounded-2xl border px-3.5 py-3 text-[12px] font-semibold leading-relaxed backdrop-blur-xl',
                entry.role === 'user'
                  ? 'rounded-br-md border-[#15EA3E]/35 bg-[#15EA3E]/14 text-white'
                  : 'rounded-bl-md border-white/10 bg-black/42 text-white/72'
              )}>
                {entry.text}
              </div>
            </div>
          ))}
        </div>

        {mode === 'task' && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            {quickPrompts.map((prompt) => (
              <button key={prompt} type="button" onClick={() => runQuickPrompt(prompt)} className="rounded-2xl border border-[#15EA3E]/18 bg-[#15EA3E]/10 p-3 text-left text-[10px] font-black leading-snug text-[#15EA3E]">
                {prompt}
              </button>
            ))}
          </div>
        )}
      </section>

      <form onSubmit={submitMessage} className="relative z-10 shrink-0 border-t border-white/10 bg-black/70 px-4 pb-4 pt-3 backdrop-blur-2xl">
        <div className="flex items-end gap-2">
          <button type="button" onClick={() => setIsListening((current) => !current)} className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border', isListening ? 'border-[#15EA3E] bg-[#15EA3E] text-black' : 'border-white/10 bg-white/[0.05] text-[#15EA3E]')}>
            <AfriSellIcon name="signal" size={17} />
          </button>
          <div className="flex min-h-[44px] flex-1 items-center rounded-2xl border border-white/10 bg-white/[0.06] px-4 focus-within:border-[#15EA3E]/50">
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={1}
              placeholder="Écris ou dicte une demande..."
              className="max-h-24 w-full resize-none bg-transparent py-3 text-xs font-semibold text-white outline-none placeholder:text-white/32"
            />
          </div>
          <button type="submit" disabled={!message.trim()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#15EA3E] text-black disabled:bg-white/10 disabled:text-white/30">
            <AfriSellIcon name="send" size={17} />
          </button>
        </div>
      </form>
    </main>
  );
}
