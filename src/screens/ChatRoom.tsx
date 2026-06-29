import React, { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { off, onValue, push, ref, set } from 'firebase/database';
import { AfriSellIcon, AfriSellIconName } from '../components/AfriSellIcon';
import { AfriChatContact, AfriChatMessage, AfriChatThread, formatChatTime, useAfriChat } from '../hooks/useAfriChat';
import { useFirebaseAuth } from '../hooks/useFirebaseAuth';
import { isCloudinaryReady, uploadMediaToCloudinary } from '../lib/cloudinary';
import { realtimeDb } from '../lib/firebase';
import { cn } from '../lib/utils';

type ChatSpace = 'chat' | 'kialanda' | 'vitrine' | 'village' | 'story';

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

type ChatStory = {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  caption: string;
  mediaUrl: string;
  resourceType: 'image' | 'video';
  createdAt: number;
  expiresAt: number;
};

const chatSpaces: Array<{ id: ChatSpace; label: string; icon: AfriSellIconName }> = [
  { id: 'chat', label: 'Chat', icon: 'chat' },
  { id: 'kialanda', label: 'Kialanda', icon: 'profile' },
  { id: 'vitrine', label: 'Vitrine', icon: 'market' },
  { id: 'village', label: 'Village', icon: 'hub' },
  { id: 'story', label: 'Story', icon: 'video' }
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

const getChatActionErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const message = record.message || record.code || record.error;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
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

function ChatSpaceIcon({ id, icon, active }: { id: ChatSpace; icon: AfriSellIconName; active: boolean }) {
  const shapeClass = {
    chat: 'rounded-[1.05rem]',
    kialanda: 'rounded-full',
    vitrine: 'rounded-[0.65rem_1.25rem_0.65rem_1.25rem]',
    village: 'rounded-[1.35rem_0.75rem_1.35rem_0.75rem]',
    story: 'rounded-full'
  }[id];

  return (
    <span className={cn(
      'relative flex h-8 w-8 items-center justify-center overflow-hidden border transition-all',
      shapeClass,
      active
        ? 'border-[#15EA3E]/55 bg-[#15EA3E] text-black shadow-[0_8px_20px_rgba(21,234,62,0.24)]'
        : 'border-white/10 bg-white/[0.055] text-white/55'
    )}>
      {id === 'story' && <span className="absolute inset-0 rounded-full border-2 border-[#15EA3E]/35" />}
      {id === 'village' && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-[#FFD84D]" />}
      <AfriSellIcon name={icon} size={14} />
    </span>
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

function MessageStatusTicks({ status }: { status?: AfriChatMessage['status'] }) {
  if (status === 'read') {
    return (
      <span className="relative inline-flex w-4 text-[#15EA3E]" aria-label="Lu">
        <AfriSellIcon name="check" size={12} className="absolute left-0" />
        <AfriSellIcon name="check" size={12} className="absolute left-1.5" />
      </span>
    );
  }

  if (status === 'sent') {
    return (
      <span className="relative inline-flex w-4 text-white/48" aria-label="Envoye">
        <AfriSellIcon name="check" size={12} className="absolute left-0" />
        <AfriSellIcon name="check" size={12} className="absolute left-1.5" />
      </span>
    );
  }

  return (
    <span aria-label="En attente" className="inline-flex text-white/40">
      <AfriSellIcon name="check" size={12} />
    </span>
  );
}

function MessageBubble({ message, isMine }: { key?: React.Key; message: AfriChatMessage; isMine: boolean }) {
  const messageBadge = message.type && message.type !== 'text'
    ? {
      order: 'Commande',
      village_share: 'Prix Village',
      payment: 'Paiement',
      delivery: 'Safari',
      kyaghanda: 'Kyaghanda',
      system: 'Systeme'
    }[message.type]
    : '';

  return (
    <div className={cn('flex w-full', isMine ? 'justify-end' : 'justify-start')}>
      <div className={cn(
        'max-w-[82%] rounded-2xl border px-3.5 py-3',
        isMine
          ? 'rounded-br-md border-[#15EA3E]/30 bg-[#15EA3E]/12 text-white'
          : 'rounded-bl-md border-gray-800 bg-[#0A0A0A] text-gray-200'
      )}>
        {messageBadge && (
          <div className="mb-2 flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-[#15EA3E]">
            <AfriSellIcon name={message.type === 'payment' ? 'pay' : message.type === 'delivery' ? 'send' : message.type === 'order' ? 'order' : 'chat'} size={12} />
            {messageBadge}
          </div>
        )}
        <p className="whitespace-pre-wrap text-[13px] font-medium leading-relaxed">{message.text}</p>
        {message.productId && (
          <p className="mt-2 rounded-xl bg-black/20 px-2 py-1 text-[10px] font-bold text-white/50">
            Produit: {message.productId}
          </p>
        )}
        <div className={cn('mt-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide', isMine ? 'justify-end text-[#15EA3E]/70' : 'text-gray-600')}>
          <span>{formatChatTime(message.createdAt)}</span>
          {isMine && <MessageStatusTicks status={message.status} />}
        </div>
      </div>
    </div>
  );
}

function ChatSettingsSheet({ onClose }: { onClose: () => void }) {
  const settings = [
    { icon: 'notifications' as AfriSellIconName, title: 'Notifications', body: 'Gerer les alertes des chats, Kialanda, vitrines, villages et stories.' },
    { icon: 'shield' as AfriSellIconName, title: 'Confidentialite', body: 'Controle qui peut te contacter, voir tes stories et t inviter dans un Village.' },
    { icon: 'language' as AfriSellIconName, title: 'Traduction', body: 'Preparer la traduction instantanee des conversations AfriChat.' },
    { icon: 'offline' as AfriSellIconName, title: 'Mode offline', body: 'Les messages en attente restent visibles avec un seul trait.' }
  ];

  return (
    <div className="absolute inset-0 z-50 flex items-end bg-black/55 backdrop-blur-sm">
      <section className="w-full rounded-t-[2rem] border-t border-white/10 bg-[#050505] p-5 shadow-[0_-24px_60px_rgba(0,0,0,0.5)]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#15EA3E]">AfriChat</p>
            <h2 className="mt-1 text-lg font-black text-white">Parametres</h2>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-white/55">
            <AfriSellIcon name="close" size={14} />
          </button>
        </div>
        <div className="grid gap-2">
          {settings.map((item) => (
            <button key={item.title} type="button" className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#15EA3E]/10 text-[#15EA3E]">
                <AfriSellIcon name={item.icon} size={17} />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-black text-white">{item.title}</span>
                <span className="mt-0.5 block text-[10px] font-semibold leading-relaxed text-white/45">{item.body}</span>
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function ChatRoom() {
  const { user, profile } = useFirebaseAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    threads,
    contacts,
    messagesByThread,
    loading,
    error,
    watchThreadMessages,
    sendMessage,
    openDirectThread,
    createCommunityThread,
    markThreadRead
  } = useAfriChat();
  const [activeSpace, setActiveSpace] = useState<ChatSpace>('chat');
  const [activeThreadId, setActiveThreadId] = useState('');
  const [fallbackThread, setFallbackThread] = useState<AfriChatThread | null>(null);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [creatingThread, setCreatingThread] = useState('');
  const [actionStatus, setActionStatus] = useState('');
  const [deviceContacts, setDeviceContacts] = useState<AfriChatContact[]>([]);
  const [contactsStatus, setContactsStatus] = useState('');
  const [importingContacts, setImportingContacts] = useState(false);
  const [stories, setStories] = useState<ChatStory[]>([]);
  const [storyFile, setStoryFile] = useState<File | null>(null);
  const [storyPreview, setStoryPreview] = useState('');
  const [storyCaption, setStoryCaption] = useState('');
  const [storyStatus, setStoryStatus] = useState('');
  const [storyPublishing, setStoryPublishing] = useState(false);
  const [showConversationPanel, setShowConversationPanel] = useState(false);
  const [showChatSettings, setShowChatSettings] = useState(false);
  const storyInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const contactRouteHandledRef = useRef('');

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) || (fallbackThread?.id === activeThreadId ? fallbackThread : null),
    [activeThreadId, fallbackThread, threads]
  );

  const messages = activeThread ? messagesByThread[activeThread.id] || [] : [];
  const normalizedQuery = query.trim().toLowerCase();
  const activeParticipantId = activeThread?.participantId && !activeThread.participantId.startsWith('device_')
    ? activeThread.participantId
    : '';

  const filteredThreads = useMemo(() => {
    const directThreads = threads.filter((thread) => !thread.type || ['direct', 'support'].includes(thread.type));
    if (!normalizedQuery) return directThreads;

    return directThreads.filter((thread) => (
      thread.title.toLowerCase().includes(normalizedQuery) ||
      (thread.lastMessage || '').toLowerCase().includes(normalizedQuery)
    ));
  }, [normalizedQuery, threads]);

  const filteredKialandaThreads = useMemo(() => {
    const groupThreads = threads.filter((thread) => ['kyaghanda', 'group'].includes(thread.type || ''));
    if (!normalizedQuery) return groupThreads;

    return groupThreads.filter((thread) => (
      thread.title.toLowerCase().includes(normalizedQuery) ||
      (thread.lastMessage || '').toLowerCase().includes(normalizedQuery)
    ));
  }, [normalizedQuery, threads]);

  const filteredVillageThreads = useMemo(() => {
    const villageThreads = threads.filter((thread) => thread.type === 'village');
    if (!normalizedQuery) return villageThreads;

    return villageThreads.filter((thread) => (
      thread.title.toLowerCase().includes(normalizedQuery) ||
      (thread.lastMessage || '').toLowerCase().includes(normalizedQuery) ||
      (thread.status || '').toLowerCase().includes(normalizedQuery)
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
    const storiesRef = ref(realtimeDb, 'chatStories');
    const unsubscribe = onValue(storiesRef, (snapshot) => {
      const data = snapshot.val() as Record<string, Record<string, ChatStory>> | null;
      const now = Date.now();
      const nextStories = Object.values(data || {})
        .flatMap((authorStories) => Object.entries(authorStories || {}).map(([id, story]) => ({ ...story, id })))
        .filter((story) => Number(story.expiresAt || 0) > now)
        .sort((first, second) => Number(second.createdAt || 0) - Number(first.createdAt || 0));
      setStories(nextStories);
    });

    return () => {
      unsubscribe();
      off(storiesRef);
    };
  }, []);

  useEffect(() => () => {
    if (storyPreview) URL.revokeObjectURL(storyPreview);
  }, [storyPreview]);

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

    try {
      const thread = await openDirectThread(contact);
      if (!thread) return;

      setFallbackThread(thread);
      setActiveThreadId(thread.id);
      setActionStatus('');
    } catch (contactError) {
      setActionStatus(getChatActionErrorMessage(contactError, 'Ouverture de la discussion impossible.'));
    }
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

    setActiveSpace('chat');
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

  const handleStoryFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      setStoryStatus('Choisis une image ou une video.');
      return;
    }

    if (storyPreview) URL.revokeObjectURL(storyPreview);
    setStoryFile(file);
    setStoryPreview(URL.createObjectURL(file));
    setStoryStatus('');
  };

  const publishStory = async () => {
    if (!user) {
      navigate('/login', { state: { next: '/chat' } });
      return;
    }
    if (!storyFile) {
      storyInputRef.current?.click();
      return;
    }
    if (!isCloudinaryReady()) {
      setStoryStatus('Cloudinary doit etre configure pour publier une story.');
      return;
    }

    setStoryPublishing(true);
    setStoryStatus('');
    try {
      const upload = await uploadMediaToCloudinary(storyFile, user.uid);
      const storyRef = push(ref(realtimeDb, `chatStories/${user.uid}`));
      const now = Date.now();
      await set(storyRef, {
        id: storyRef.key,
        authorId: user.uid,
        authorName: profile?.displayName || user.displayName || 'Utilisateur AfriSell',
        authorAvatar: profile?.photoURL || user.photoURL || '',
        caption: storyCaption.trim(),
        mediaUrl: upload.secureUrl || upload.mediaUrl,
        resourceType: upload.resourceType,
        createdAt: now,
        expiresAt: now + 24 * 60 * 60 * 1000
      });
      if (storyPreview) URL.revokeObjectURL(storyPreview);
      setStoryFile(null);
      setStoryPreview('');
      setStoryCaption('');
      setStoryStatus('Story publiee dans AfriChat.');
    } catch (storyError) {
      setStoryStatus(getChatActionErrorMessage(storyError, 'Publication story impossible.'));
    } finally {
      setStoryPublishing(false);
    }
  };

  const submitMessage = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!activeThread || !draft.trim() || sending) return;

    setSending(true);
    setActionStatus('');
    try {
      await sendMessage(activeThread, draft);
      setDraft('');
    } catch (messageError) {
      setActionStatus(getChatActionErrorMessage(messageError, 'Envoi du message impossible.'));
    } finally {
      setSending(false);
    }
  };

  const sendQuickMessage = async (type: AfriChatMessage['type'], text: string) => {
    if (!activeThread || sending) return;

    setSending(true);
    setActionStatus('');
    try {
      await sendMessage(activeThread, text, { type });
    } catch (messageError) {
      setActionStatus(getChatActionErrorMessage(messageError, 'Action AfriChat impossible.'));
    } finally {
      setSending(false);
    }
  };

  const createThread = async (
    type: 'village' | 'kyaghanda' | 'support',
    customConfig?: { title: string; status: string; nextSpace?: ChatSpace }
  ) => {
    const config = customConfig || {
      village: {
        title: 'Village Prix Groupes',
        status: 'Prix Village',
        nextSpace: 'village' as ChatSpace
      },
      kyaghanda: {
        title: 'Kialanda Business',
        status: 'Groupe prive',
        nextSpace: 'kialanda' as ChatSpace
      },
      support: {
        title: 'Support AfriSell',
        status: 'Assistance',
        nextSpace: 'chat' as ChatSpace
      }
    }[type];

    setCreatingThread(type);
    setActionStatus('');
    try {
      const thread = await createCommunityThread(type, config.title, config.status);
      if (thread) {
        setFallbackThread(thread);
        setActiveThreadId(thread.id);
        setActiveSpace(config.nextSpace || 'chat');
      }
    } catch (threadError) {
      setActionStatus(getChatActionErrorMessage(threadError, 'Creation de discussion impossible.'));
    } finally {
      setCreatingThread('');
    }
  };

  const handleMessageKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void submitMessage();
    }
  };

  if (activeThread) {
    return (
      <div className="relative flex h-full min-h-0 flex-col bg-black">
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
            <button
              type="button"
              onClick={() => setShowConversationPanel(true)}
              className="flex min-w-0 items-center gap-3 rounded-2xl py-1 pr-2 text-left active:bg-white/[0.04]"
            >
              <Avatar title={activeThread.title} src={activeThread.avatarURL} size="sm" />
              <div className="min-w-0">
              <p className="truncate text-sm font-black text-white">{activeThread.title}</p>
              <p className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-wider text-[#15EA3E]">
                {activeThread.status || 'AfriChat'}
              </p>
              </div>
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowConversationPanel(true)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-900 bg-[#050505] text-gray-400"
            aria-label="Infos discussion"
          >
            <AfriSellIcon name="shield" size={18} />
          </button>
        </div>

        <div className="africhat-message-wall min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => navigate('/market/orders')}
              className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white/65"
            >
              Commandes
            </button>
            <button
              type="button"
              onClick={() => navigate('/wallet?action=transfer')}
              className="shrink-0 rounded-full border border-[#15EA3E]/25 bg-[#15EA3E]/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[#15EA3E]"
            >
              Payer
            </button>
            <button
              type="button"
              onClick={() => navigate('/safari/expedier')}
              className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white/65"
            >
              Livraison
            </button>
            <button
              type="button"
              onClick={() => void sendQuickMessage('village_share', 'Je partage ce Prix Village. Qui rejoint le Village pour debloquer le meilleur prix ?')}
              className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white/65"
            >
              Prix Village
            </button>
            <button
              type="button"
              onClick={() => void sendQuickMessage('delivery', 'Point Safari: confirme-moi le lieu, l heure et la personne qui recoit la livraison.')}
              className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white/65"
            >
              Suivi Safari
            </button>
          </div>
          {actionStatus && (
            <div className="mb-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-xs font-medium text-red-200">
              {actionStatus}
            </div>
          )}
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

        {showConversationPanel && (
          <div className="absolute inset-0 z-50 flex items-end bg-black/55 backdrop-blur-sm">
            <section className="w-full rounded-t-[2rem] border-t border-white/10 bg-[#050505] p-5 shadow-[0_-24px_60px_rgba(0,0,0,0.5)]">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar title={activeThread.title} src={activeThread.avatarURL} />
                  <div className="min-w-0">
                    <p className="truncate text-base font-black text-white">{activeThread.title}</p>
                    <p className="mt-1 truncate text-[10px] font-black uppercase tracking-wider text-[#15EA3E]">{activeThread.status || 'AfriChat'}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setShowConversationPanel(false)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-white/55">
                  <AfriSellIcon name="close" size={14} />
                </button>
              </div>

              <div className="grid gap-2">
                {activeParticipantId && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowConversationPanel(false);
                      navigate(`/u/${activeParticipantId}`);
                    }}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left"
                  >
                    <AfriSellIcon name="profile" size={17} className="text-[#15EA3E]" />
                    <span className="text-xs font-black text-white">Voir le profil public</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActionStatus('Gestion avancee de la conversation en preparation.')}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left"
                >
                  <AfriSellIcon name="shield" size={17} className="text-[#15EA3E]" />
                  <span className="text-xs font-black text-white">Gerer la conversation</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowConversationPanel(false);
                    setShowChatSettings(true);
                  }}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left"
                >
                  <AfriSellIcon name="account" size={17} className="text-[#15EA3E]" />
                  <span className="text-xs font-black text-white">Parametres AfriChat</span>
                </button>
              </div>
            </section>
          </div>
        )}
        {showChatSettings && <ChatSettingsSheet onClose={() => setShowChatSettings(false)} />}
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-black">
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
            <button
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-900 bg-[#050505] text-gray-400"
              type="button"
              onClick={() => setShowChatSettings(true)}
              aria-label="Parametres AfriChat"
            >
              <AfriSellIcon name="account" size={17} />
            </button>
          </div>
        </div>

      </div>

      <div className="shrink-0 border-b border-gray-900 px-4 py-3">
        <label className="flex h-11 items-center gap-3 rounded-2xl border border-gray-900 bg-[#050505] px-4 text-gray-500">
          <AfriSellIcon name="search" size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              activeSpace === 'chat'
                ? 'Chercher une discussion'
                : activeSpace === 'kialanda'
                  ? 'Chercher un Kialanda'
                  : activeSpace === 'village'
                    ? 'Chercher un Village'
                    : 'Chercher dans AfriChat'
            }
            className="h-full min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-gray-600"
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-28 pt-4">
        {error && (
          <div className="mb-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-xs font-medium text-red-200">
            {error}
          </div>
        )}
        {actionStatus && (
          <div className="mb-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-xs font-medium text-red-200">
            {actionStatus}
          </div>
        )}

        {activeSpace === 'chat' && (
          <div className="space-y-3">
            <div className="rounded-[1.35rem] border border-[#15EA3E]/18 bg-[#071007] p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#15EA3E]/12 text-[#15EA3E]">
                  <AfriSellIcon name="profile" size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black text-white">Contacts de l appareil</p>
                  <p className="mt-0.5 text-[10px] font-semibold leading-relaxed text-gray-500">Invite ou retrouve rapidement une personne.</p>
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
            {filteredContacts.length > 0 && (
              <div className="space-y-2">
                <p className="px-1 text-[10px] font-black uppercase tracking-[0.2em] text-white/35">Contacts</p>
                {filteredContacts.slice(0, 4).map((contact) => (
                  <ContactRow key={contact.id} contact={contact} onOpen={() => openContact(contact)} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeSpace === 'kialanda' && (
          <div className="space-y-3">
            <div className="rounded-[1.35rem] border border-[#15EA3E]/20 bg-[#15EA3E]/10 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#15EA3E] text-black">
                  <AfriSellIcon name="profile" size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-white">Kialanda</p>
                  <p className="mt-0.5 text-[10px] font-semibold leading-relaxed text-white/55">Groupes prives pour echanger comme une vraie table de discussion.</p>
                </div>
                <button
                  type="button"
                  onClick={() => void createThread('kyaghanda')}
                  disabled={Boolean(creatingThread)}
                  className="rounded-xl bg-[#15EA3E] px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-black disabled:bg-gray-800 disabled:text-gray-500"
                >
                  {creatingThread === 'kyaghanda' ? '...' : 'Creer'}
                </button>
              </div>
            </div>
            {filteredKialandaThreads.length ? (
              filteredKialandaThreads.map((thread) => (
                <ThreadRow key={thread.id} thread={thread} active={thread.id === activeThreadId} onOpen={() => openThread(thread)} />
              ))
            ) : (
              <EmptyState icon="profile" title="Aucun Kialanda" body="Cree un groupe pour tes proches, partenaires ou equipes." />
            )}
          </div>
        )}

        {activeSpace === 'vitrine' && (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-[1.6rem] border border-white/10 bg-[#050505]">
              <div className="relative h-28 bg-[radial-gradient(circle_at_80%_15%,rgba(21,234,62,0.28),transparent_38%),linear-gradient(135deg,#081208,#020202)] p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-[1rem_1.5rem_1rem_1.5rem] bg-[#15EA3E] text-black">
                  <AfriSellIcon name="market" size={20} />
                </div>
              </div>
              <div className="p-4">
                <p className="text-sm font-black text-white">Vitrine AfriChat</p>
                <p className="mt-1 text-xs font-semibold leading-relaxed text-gray-500">Les chaines officielles, boutiques, createurs et services apparaitront ici.</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => navigate('/market')} className="rounded-2xl bg-[#15EA3E] py-3 text-[10px] font-black uppercase tracking-wider text-black">
                    Voir Market
                  </button>
                  <button type="button" onClick={() => navigate('/feed')} className="rounded-2xl border border-white/10 bg-white/[0.05] py-3 text-[10px] font-black uppercase tracking-wider text-white/70">
                    Voir ABC
                  </button>
                </div>
              </div>
            </div>
            <EmptyState icon="market" title="Aucune chaine" body="Les vitrines suivies seront listees ici avec leurs annonces et nouveautes." />
          </div>
        )}

        {activeSpace === 'village' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2">
              {[
                { label: 'Village prive', status: 'Acces restreint', body: 'Communauté fermee sur invitation.' },
                { label: 'Village d achat', status: 'Acheteurs groupes', body: 'Cree par les acheteurs pour negocier ensemble.' },
                { label: 'Village business', status: 'Business restreint', body: 'Entrepreneurs, entreprises, freelances et formateurs.' }
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => void createThread('village', {
                    title: item.label,
                    status: item.status,
                    nextSpace: 'village'
                  })}
                  disabled={Boolean(creatingThread)}
                  className="rounded-[1.35rem] border border-[#15EA3E]/20 bg-[#071007] p-4 text-left disabled:opacity-60"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-[1.2rem_0.75rem_1.2rem_0.75rem] bg-[#15EA3E] text-black">
                      <AfriSellIcon name="hub" size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black text-white">{item.label}</p>
                      <p className="mt-0.5 text-[10px] font-black uppercase tracking-wider text-[#15EA3E]">{item.status}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs font-semibold leading-relaxed text-white/52">{item.body}</p>
                </button>
              ))}
            </div>
            {filteredVillageThreads.length ? (
              <div className="space-y-3">
                {filteredVillageThreads.map((thread) => (
                  <ThreadRow key={thread.id} thread={thread} active={thread.id === activeThreadId} onOpen={() => openThread(thread)} />
                ))}
              </div>
            ) : (
              <EmptyState icon="hub" title="Aucun Village" body="Tes communautes privees, achats groupes et villages business apparaitront ici." />
            )}
          </div>
        )}

        {activeSpace === 'story' && (
          <div className="space-y-3">
            <div className="rounded-[1.6rem] border border-white/10 bg-[#050505] p-4">
              <input ref={storyInputRef} type="file" accept="image/*,video/*" onChange={handleStoryFileSelect} className="hidden" />
              <div className="flex items-center gap-3">
                <div className="relative flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#15EA3E] bg-[#15EA3E]/10 text-[#15EA3E]">
                  <AfriSellIcon name="video" size={21} />
                  <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#15EA3E] text-black">
                    <AfriSellIcon name="plus" size={13} />
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-white">Story AfriChat</p>
                  <p className="mt-1 text-xs font-semibold leading-relaxed text-gray-500">Partage un moment court avec tes contacts et villages.</p>
                </div>
              </div>
              {storyPreview && (
                <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black">
                  {storyFile?.type.startsWith('video/') ? (
                    <video src={storyPreview} controls playsInline className="h-48 w-full object-cover" />
                  ) : (
                    <img src={storyPreview} alt="" className="h-48 w-full object-cover" />
                  )}
                </div>
              )}
              <textarea
                value={storyCaption}
                onChange={(event) => setStoryCaption(event.target.value)}
                rows={2}
                placeholder="Ajouter une legende..."
                className="mt-3 w-full resize-none rounded-2xl border border-white/10 bg-black/35 px-3 py-3 text-xs font-semibold text-white outline-none placeholder:text-white/28 focus:border-[#15EA3E]/50"
              />
              {storyStatus && (
                <p className="mt-3 rounded-2xl border border-[#15EA3E]/20 bg-[#15EA3E]/10 px-3 py-2 text-[10px] font-semibold text-[#15EA3E]">
                  {storyStatus}
                </p>
              )}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => storyInputRef.current?.click()} className="rounded-2xl border border-white/10 bg-white/[0.05] py-3 text-[10px] font-black uppercase tracking-wider text-white/70">
                  Choisir media
                </button>
                <button type="button" onClick={() => void publishStory()} disabled={storyPublishing} className="rounded-2xl bg-[#15EA3E] py-3 text-[10px] font-black uppercase tracking-wider text-black disabled:bg-gray-800 disabled:text-gray-500">
                  {storyPublishing ? '...' : 'Publier'}
                </button>
              </div>
            </div>
            {stories.length ? (
              <div className="scrollbar-hide flex gap-3 overflow-x-auto pb-1">
                {stories.map((story) => (
                  <article key={story.id} className="relative h-48 w-32 shrink-0 overflow-hidden rounded-[1.35rem] border border-white/10 bg-[#050505]">
                    {story.resourceType === 'video' ? (
                      <video src={story.mediaUrl} muted playsInline className="h-full w-full object-cover" />
                    ) : (
                      <img src={story.mediaUrl} alt={story.caption || story.authorName} className="h-full w-full object-cover" />
                    )}
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.18),transparent_34%,rgba(0,0,0,0.86))]" />
                    <div className="absolute left-2 top-2 h-8 w-8 overflow-hidden rounded-full border-2 border-[#15EA3E] bg-black">
                      {story.authorAvatar ? (
                        <img src={story.authorAvatar} alt={story.authorName} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[9px] font-black text-[#15EA3E]">{getInitials(story.authorName)}</div>
                      )}
                    </div>
                    <div className="absolute inset-x-0 bottom-0 p-2">
                      <p className="truncate text-[10px] font-black text-white">{story.authorName}</p>
                      {story.caption && <p className="mt-0.5 line-clamp-2 text-[9px] font-semibold leading-snug text-white/58">{story.caption}</p>}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState icon="video" title="Aucune story" body="Les stories recentes de tes contacts seront affichees ici." />
            )}
          </div>
        )}
      </div>

      <nav className="sticky bottom-0 z-30 shrink-0 border-t border-white/10 bg-black/78 px-3 pb-3 pt-2 backdrop-blur-2xl">
        <div className="grid grid-cols-5 gap-1 rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-1.5 shadow-[0_-14px_36px_rgba(0,0,0,0.42)]">
          {chatSpaces.map((space) => {
            const active = activeSpace === space.id;

            return (
              <button
                key={space.id}
                type="button"
                onClick={() => setActiveSpace(space.id)}
                className={cn(
                  'flex min-w-0 flex-col items-center gap-1 rounded-[1.25rem] px-1.5 py-1.5 transition-colors',
                  active ? 'bg-black/45 text-white' : 'text-white/45'
                )}
              >
                <ChatSpaceIcon id={space.id} icon={space.icon} active={active} />
                <span className={cn('max-w-full truncate text-[8px] font-black uppercase tracking-[0.08em]', active ? 'text-[#15EA3E]' : 'text-white/42')}>
                  {space.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
      {showChatSettings && <ChatSettingsSheet onClose={() => setShowChatSettings(false)} />}
    </div>
  );
}
