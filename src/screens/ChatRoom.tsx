import React, { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AfriSellIcon, AfriSellIconName } from '../components/AfriSellIcon';
import { AfriChatContact, AfriChatMessage, AfriChatThread, formatChatTime, useAfriChat } from '../hooks/useAfriChat';
import { useFirebaseAuth } from '../hooks/useFirebaseAuth';
import { cn } from '../lib/utils';

type ChatTab = 'threads' | 'contacts' | 'settings';

type ContactPickerContact = {
  name?: string[];
  tel?: string[];
  email?: string[];
};

type NavigatorWithContacts = Navigator & {
  contacts?: {
    select: (
      properties: Array<'name' | 'tel' | 'email'>,
      options?: { multiple?: boolean }
    ) => Promise<ContactPickerContact[]>;
  };
};

const tabs: Array<{ id: ChatTab; label: string; icon: AfriSellIconName }> = [
  { id: 'threads', label: 'Discussions', icon: 'chat' },
  { id: 'contacts', label: 'Contacts', icon: 'profile' },
  { id: 'settings', label: 'Reglages', icon: 'shield' }
];

const getInitials = (value: string) => {
  const initials = value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return initials || 'AF';
};

function Avatar({ title, src, size = 'md' }: { title: string; src?: string; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <div className={cn(
      'relative shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-[#101010]',
      size === 'sm' && 'h-9 w-9 rounded-xl',
      size === 'md' && 'h-12 w-12',
      size === 'lg' && 'h-14 w-14'
    )}>
      {src ? (
        <img src={src} alt={title} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[#15EA3E]/10 text-xs font-black text-[#15EA3E]">
          {getInitials(title)}
        </div>
      )}
    </div>
  );
}

function EmptyState({ icon, title, body }: { icon: AfriSellIconName; title: string; body: string }) {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center px-8 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-gray-800 bg-[#0A0A0A] text-gray-400">
        <AfriSellIcon name={icon} size={24} />
      </div>
      <h3 className="text-sm font-black uppercase tracking-wide text-white">{title}</h3>
      <p className="mt-2 max-w-[260px] text-xs leading-relaxed text-gray-500">{body}</p>
    </div>
  );
}

function ThreadRow({ thread, active, onOpen }: { key?: React.Key; thread: AfriChatThread; active: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors',
        active
          ? 'border-[#15EA3E]/40 bg-[#15EA3E]/10'
          : 'border-gray-900 bg-[#050505] hover:border-gray-700 hover:bg-[#0A0A0A]'
      )}
    >
      <Avatar title={thread.title} src={thread.avatarURL} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="truncate text-sm font-black text-white">{thread.title}</p>
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-gray-600">
            {formatChatTime(thread.lastMessageAt)}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-3">
          <p className="truncate text-xs text-gray-500">{thread.lastMessage || 'Aucun message pour le moment'}</p>
          {Boolean(thread.unreadCount) && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#15EA3E] px-1.5 text-[10px] font-black text-black">
              {thread.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function ContactRow({ contact, onOpen }: { key?: React.Key; contact: AfriChatContact; onOpen: () => void | Promise<void> }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-2xl border border-gray-900 bg-[#050505] p-3 text-left transition-colors hover:border-gray-700 hover:bg-[#0A0A0A]"
    >
      <Avatar title={contact.displayName} src={contact.avatarURL} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black text-white">{contact.displayName}</p>
        <p className="mt-1 truncate text-xs text-gray-500">{contact.status || 'Disponible sur AfriChat'}</p>
      </div>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#15EA3E]/10 text-[#15EA3E]">
        <AfriSellIcon name="send" size={17} />
      </div>
    </button>
  );
}

function MessageBubble({ message, isMine }: { key?: React.Key; message: AfriChatMessage; isMine: boolean }) {
  return (
    <div className={cn('flex w-full', isMine ? 'justify-end' : 'justify-start')}>
      <div className={cn(
        'max-w-[82%] rounded-2xl border px-3.5 py-3',
        isMine
          ? 'rounded-br-md border-[#15EA3E]/30 bg-[#15EA3E]/12 text-white'
          : 'rounded-bl-md border-gray-800 bg-[#0A0A0A] text-gray-200'
      )}>
        <p className="whitespace-pre-wrap text-[13px] font-medium leading-relaxed">{message.text}</p>
        <div className={cn('mt-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide', isMine ? 'justify-end text-[#15EA3E]/70' : 'text-gray-600')}>
          <span>{formatChatTime(message.createdAt)}</span>
          {isMine && <AfriSellIcon name="check" size={12} />}
        </div>
      </div>
    </div>
  );
}

function SettingsPanel() {
  const settings = [
    {
      title: 'Demandes de contact',
      body: 'Garde les nouvelles demandes au meme endroit avant de discuter.'
    },
    {
      title: 'Discussions utiles',
      body: 'Retrouve les echanges lies aux ventes, achats, livraisons et support.'
    },
    {
      title: 'Securite',
      body: 'Les actions sensibles restent liees au compte connecte.'
    }
  ];

  return (
    <div className="space-y-3">
      {settings.map((item) => (
        <div key={item.title} className="rounded-2xl border border-gray-900 bg-[#050505] p-4">
          <p className="text-sm font-black text-white">{item.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-gray-500">{item.body}</p>
        </div>
      ))}
    </div>
  );
}

export default function ChatRoom() {
  const { user } = useFirebaseAuth();
  const location = useLocation();
  const {
    threads,
    contacts,
    messagesByThread,
    loading,
    error,
    watchThreadMessages,
    sendMessage,
    openDirectThread,
    markThreadRead
  } = useAfriChat();
  const [activeTab, setActiveTab] = useState<ChatTab>('threads');
  const [activeThreadId, setActiveThreadId] = useState('');
  const [fallbackThread, setFallbackThread] = useState<AfriChatThread | null>(null);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [deviceContacts, setDeviceContacts] = useState<AfriChatContact[]>([]);
  const [contactsStatus, setContactsStatus] = useState('');
  const [importingContacts, setImportingContacts] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const contactRouteHandledRef = useRef('');

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) || (fallbackThread?.id === activeThreadId ? fallbackThread : null),
    [activeThreadId, fallbackThread, threads]
  );

  const messages = activeThread ? messagesByThread[activeThread.id] || [] : [];
  const normalizedQuery = query.trim().toLowerCase();

  const filteredThreads = useMemo(() => {
    if (!normalizedQuery) return threads;

    return threads.filter((thread) => (
      thread.title.toLowerCase().includes(normalizedQuery) ||
      (thread.lastMessage || '').toLowerCase().includes(normalizedQuery)
    ));
  }, [normalizedQuery, threads]);

  const filteredContacts = useMemo(() => {
    const mergedContacts = [
      ...deviceContacts,
      ...contacts.filter((contact) => !deviceContacts.some((deviceContact) => deviceContact.id === contact.id))
    ];

    if (!normalizedQuery) return mergedContacts;

    return mergedContacts.filter((contact) => (
      contact.displayName.toLowerCase().includes(normalizedQuery) ||
      (contact.status || '').toLowerCase().includes(normalizedQuery)
    ));
  }, [contacts, deviceContacts, normalizedQuery]);

  useEffect(() => {
    if (!activeThreadId) return undefined;

    const unsubscribe = watchThreadMessages(activeThreadId);
    markThreadRead(activeThreadId).catch((readError) => {
      console.error('Marquage lecture AfriChat impossible:', readError);
    });

    return unsubscribe;
  }, [activeThreadId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeThreadId, messages.length]);

  const openThread = (thread: AfriChatThread) => {
    setFallbackThread(null);
    setActiveThreadId(thread.id);
  };

  const openContact = async (contact: AfriChatContact) => {
    if (!user) return;

    const expectedThreadId = contact.threadId || [user.uid, contact.id].sort().join('_');
    const existingThread = threads.find((thread) => thread.id === expectedThreadId);

    if (existingThread) {
      openThread(existingThread);
      return;
    }

    const thread = await openDirectThread(contact);
    if (!thread) return;

    setFallbackThread(thread);
    setActiveThreadId(thread.id);
  };

  useEffect(() => {
    if (!user) return;

    const params = new URLSearchParams(location.search);
    const contactId = params.get('contact');
    if (!contactId) return;

    const routeKey = `${user.uid}:${contactId}`;
    if (contactRouteHandledRef.current === routeKey) return;
    contactRouteHandledRef.current = routeKey;

    const contact: AfriChatContact = {
      id: contactId,
      displayName: params.get('name') || 'Freelance AfriSell',
      status: params.get('status') || 'Disponible sur AfriSell',
      avatarURL: params.get('avatar') || undefined
    };

    setActiveTab('threads');
    void openContact(contact);
  }, [location.search, user?.uid]);

  const importDeviceContacts = async () => {
    const contactNavigator = navigator as NavigatorWithContacts;

    if (!contactNavigator.contacts?.select) {
      setContactsStatus('Import natif indisponible sur ce navigateur. Essaie sur Chrome Android ou un navigateur compatible.');
      return;
    }

    setImportingContacts(true);
    setContactsStatus('');

    try {
      const selectedContacts = await contactNavigator.contacts.select(['name', 'tel', 'email'], { multiple: true });
      const nextContacts = selectedContacts
        .map((contact, index): AfriChatContact | null => {
          const displayName = contact.name?.[0]?.trim() || contact.tel?.[0] || contact.email?.[0] || `Contact ${index + 1}`;
          const primaryValue = contact.tel?.[0] || contact.email?.[0] || displayName;
          const contactId = `device_${primaryValue.replace(/[^\w]+/g, '_').toLowerCase()}`;

          if (!primaryValue) return null;

          return {
            id: contactId,
            displayName,
            status: contact.tel?.[0] || contact.email?.[0] || 'Contact appareil'
          };
        })
        .filter((contact): contact is AfriChatContact => Boolean(contact));

      setDeviceContacts((current) => {
        const merged = [...current];
        nextContacts.forEach((contact) => {
          if (!merged.some((item) => item.id === contact.id)) merged.push(contact);
        });
        return merged.sort((first, second) => first.displayName.localeCompare(second.displayName));
      });
      setContactsStatus(nextContacts.length ? `${nextContacts.length} contact(s) importe(s).` : 'Aucun contact selectionne.');
    } catch (contactError) {
      console.error('Import contacts appareil impossible:', contactError);
      setContactsStatus('Acces aux contacts annule ou refuse par l appareil.');
    } finally {
      setImportingContacts(false);
    }
  };

  const submitMessage = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!activeThread || !draft.trim() || sending) return;

    setSending(true);
    try {
      await sendMessage(activeThread, draft);
      setDraft('');
    } finally {
      setSending(false);
    }
  };

  const handleMessageKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submitMessage();
    }
  };

  if (activeThread) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-black">
        <div className="sticky top-0 z-30 flex h-[68px] shrink-0 items-center justify-between border-b border-gray-900 bg-black/95 px-3 backdrop-blur-md">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveThreadId('')}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-gray-500 transition-colors hover:bg-[#0A0A0A] hover:text-white"
              aria-label="Retour aux discussions"
            >
              <AfriSellIcon name="arrow" size={20} className="rotate-180" />
            </button>
            <Avatar title={activeThread.title} src={activeThread.avatarURL} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-white">{activeThread.title}</p>
              <p className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-wider text-[#15EA3E]">
                {activeThread.status || 'AfriChat'}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-900 bg-[#050505] text-gray-400"
            aria-label="Infos discussion"
          >
            <AfriSellIcon name="shield" size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {messages.length ? (
            <div className="flex flex-col gap-3">
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} isMine={message.senderId === user?.uid} />
              ))}
              <div ref={messagesEndRef} />
            </div>
          ) : (
            <EmptyState
              icon="chat"
              title="Aucun message"
              body="Envoie le premier message pour lancer cette discussion."
            />
          )}
        </div>

        <form
          onSubmit={submitMessage}
          className="sticky bottom-0 z-20 flex shrink-0 flex-col gap-3 border-t border-gray-900 bg-black px-4 pb-3 pt-3"
        >
          <div className="flex items-center justify-between px-1">
            <button type="button" className="flex items-center gap-1.5 text-gray-500">
              <AfriSellIcon name="language" size={13} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Traduction</span>
            </button>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-700">AfriChat</span>
          </div>
          <div className="flex items-end gap-2">
            <button
              type="button"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gray-800 bg-[#0A0A0A] text-gray-500 transition-colors hover:text-white"
              aria-label="Joindre un fichier"
            >
              <AfriSellIcon name="clip" size={18} />
            </button>
            <div className="flex min-h-[44px] flex-1 items-center overflow-hidden rounded-xl border border-gray-800 bg-[#0A0A0A] px-4 transition-colors focus-within:border-[#15EA3E]/50">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleMessageKeyDown}
                placeholder="Message..."
                className="max-h-[96px] w-full resize-none border-none bg-transparent py-3 text-xs text-[#e0e0e0] outline-none placeholder:text-gray-600"
                rows={1}
              />
            </div>
            <button
              type="submit"
              disabled={!draft.trim() || sending}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#15EA3E] text-black transition-transform active:scale-95 disabled:cursor-not-allowed disabled:bg-gray-800 disabled:text-gray-500"
              aria-label="Envoyer"
            >
              <AfriSellIcon name="send" size={18} className="translate-x-[1px]" />
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-black">
      <div className="sticky top-0 z-30 shrink-0 border-b border-gray-900 bg-black/95 px-4 pb-3 pt-3 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">AfriChat</p>
            <h1 className="mt-1 text-xl font-black tracking-tight text-white">Messages</h1>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-900 bg-[#050505] text-gray-400" type="button" aria-label="Rechercher">
              <AfriSellIcon name="search" size={17} />
            </button>
            <button className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-900 bg-[#050505] text-gray-400" type="button" aria-label="Notifications">
              <AfriSellIcon name="notifications" size={17} />
            </button>
          </div>
        </div>

        <div className="mt-3 flex rounded-2xl border border-gray-900 bg-[#050505] p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[10px] font-black uppercase tracking-wide transition-colors',
                activeTab === tab.id ? 'bg-[#15EA3E] text-black' : 'text-gray-500 hover:text-white'
              )}
            >
              <AfriSellIcon name={tab.icon} size={14} />
              <span className="truncate">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="shrink-0 border-b border-gray-900 px-4 py-3">
        <label className="flex h-11 items-center gap-3 rounded-2xl border border-gray-900 bg-[#050505] px-4 text-gray-500">
          <AfriSellIcon name="search" size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={activeTab === 'contacts' ? 'Chercher un contact' : 'Chercher une discussion'}
            className="h-full min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-gray-600"
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {error && (
          <div className="mb-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-xs font-medium text-red-200">
            {error}
          </div>
        )}

        {activeTab === 'threads' && (
          <div className="space-y-3">
            {loading ? (
              <EmptyState icon="chat" title="Chargement" body="Recuperation de tes discussions AfriChat." />
            ) : filteredThreads.length ? (
              filteredThreads.map((thread) => (
                <ThreadRow
                  key={thread.id}
                  thread={thread}
                  active={thread.id === activeThreadId}
                  onOpen={() => openThread(thread)}
                />
              ))
            ) : (
              <EmptyState icon="chat" title="Aucune discussion" body="Tes conversations apparaitront ici des qu elles seront creees." />
            )}
          </div>
        )}

        {activeTab === 'contacts' && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-[#15EA3E]/20 bg-[#0A0A0A] p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#15EA3E]/10 text-[#15EA3E]">
                  <AfriSellIcon name="profile" size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black text-white">Contacts de l appareil</p>
                  <p className="mt-0.5 text-[10px] font-semibold leading-relaxed text-gray-500">Ouvre la demande native et choisis les contacts a inviter.</p>
                </div>
                <button
                  type="button"
                  onClick={importDeviceContacts}
                  disabled={importingContacts}
                  className="rounded-xl bg-[#15EA3E] px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-black disabled:bg-gray-800 disabled:text-gray-500"
                >
                  {importingContacts ? '...' : 'Importer'}
                </button>
              </div>
              {contactsStatus && (
                <p className="mt-3 rounded-xl border border-white/10 bg-black/30 p-2 text-[10px] font-semibold leading-relaxed text-white/55">
                  {contactsStatus}
                </p>
              )}
            </div>
            {filteredContacts.length ? (
              filteredContacts.map((contact) => (
                <ContactRow key={contact.id} contact={contact} onOpen={() => openContact(contact)} />
              ))
            ) : (
              <EmptyState icon="profile" title="Aucun contact" body="Les contacts lies a ton compte apparaitront ici." />
            )}
          </div>
        )}

        {activeTab === 'settings' && <SettingsPanel />}
      </div>
    </div>
  );
}
