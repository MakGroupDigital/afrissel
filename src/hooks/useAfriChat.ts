import { useEffect, useMemo, useState } from 'react';
import { off, onValue, push, ref, serverTimestamp, update } from 'firebase/database';
import { realtimeDb } from '../lib/firebase';
import { useFirebaseAuth } from './useFirebaseAuth';
import { enqueueFirebaseUpdate, isOfflineNow, offlineCacheKey, readOfflineCache, readOfflineCacheAsync, writeOfflineCache } from '../lib/offlineCache';

export type AfriChatThread = {
  id: string;
  title: string;
  avatarURL?: string;
  participantId?: string;
  participantName?: string;
  participantAvatarURL?: string;
  productId?: string;
  productName?: string;
  productImage?: string;
  villagePrice?: number;
  currency?: string;
  inviteLink?: string;
  visibility?: 'public' | 'private' | string;
  lastMessage?: string;
  lastMessageAt?: number | string | { seconds?: number };
  unreadCount?: number;
  type?: 'direct' | 'group' | 'village' | 'kyaghanda' | 'support' | string;
  status?: string;
};

export type AfriChatMessage = {
  id: string;
  senderId: string;
  text: string;
  type?: 'text' | 'order' | 'village_share' | 'payment' | 'delivery' | 'kyaghanda' | 'system' | 'kiss' | 'image' | 'video' | 'audio' | 'file' | 'contact' | 'location';
  orderId?: string;
  productId?: string;
  amount?: number;
  currency?: string;
  mediaUrl?: string;
  fileName?: string;
  mimeType?: string;
  createdAt?: number | string | { seconds?: number };
  status?: 'queued' | 'sent' | 'read' | string;
};

export type AfriChatMessageOptions = {
  type?: AfriChatMessage['type'];
  orderId?: string;
  productId?: string;
  amount?: number;
  currency?: string;
  mediaUrl?: string;
  fileName?: string;
  mimeType?: string;
};

export type AfriChatContact = {
  id: string;
  displayName: string;
  avatarURL?: string;
  status?: string;
  threadId?: string;
};

type RawThread = Omit<AfriChatThread, 'id'> & {
  threadId?: string;
  name?: string;
};

type RawMessage = Omit<AfriChatMessage, 'id'> & {
  message?: string;
};

type RawContact = Omit<AfriChatContact, 'id'> & {
  name?: string;
};

type RawPublicVillageDeal = {
  id?: string;
  productId?: string;
  title?: string;
  productName?: string;
  productImage?: string;
  createdAt?: number;
  villagePrice?: number;
  currency?: string;
};

const getTimestamp = (value?: AfriChatThread['lastMessageAt'] | AfriChatMessage['createdAt']) => {
  if (!value) return 0;
  if (typeof value === 'object') return (value.seconds || 0) * 1000;
  const timestamp = Number(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
};

export const formatChatTime = (value?: AfriChatThread['lastMessageAt'] | AfriChatMessage['createdAt']) => {
  const timestamp = getTimestamp(value);
  if (!timestamp) return '';

  const date = new Date(timestamp);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();

  return new Intl.DateTimeFormat('fr-FR', isToday
    ? { hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short' }
  ).format(date);
};

const normalizeThread = (id: string, thread: RawThread): AfriChatThread => ({
  id: thread.threadId || id,
  title: thread.title || thread.name || 'Conversation',
  avatarURL: thread.avatarURL,
  participantId: thread.participantId,
  participantName: thread.participantName,
  participantAvatarURL: thread.participantAvatarURL,
  productId: thread.productId,
  productName: thread.productName,
  productImage: thread.productImage,
  villagePrice: thread.villagePrice,
  currency: thread.currency,
  inviteLink: thread.inviteLink,
  visibility: thread.visibility,
  lastMessage: thread.lastMessage || '',
  lastMessageAt: thread.lastMessageAt,
  unreadCount: Number(thread.unreadCount || 0),
  type: thread.type || 'direct',
  status: thread.status
});

const normalizeMessage = (id: string, message: RawMessage): AfriChatMessage => ({
  id,
  senderId: message.senderId || '',
  text: message.text || message.message || '',
  type: message.type || 'text',
  orderId: message.orderId,
  productId: message.productId,
  amount: message.amount,
  currency: message.currency,
  mediaUrl: message.mediaUrl,
  fileName: message.fileName,
  mimeType: message.mimeType,
  createdAt: message.createdAt,
  status: message.status
});

const normalizeContact = (id: string, contact: RawContact): AfriChatContact => ({
  id,
  displayName: contact.displayName || contact.name || 'Contact',
  avatarURL: contact.avatarURL,
  status: contact.status,
  threadId: contact.threadId
});

const getDirectRecipientId = (thread: AfriChatThread, currentUserId: string) => {
  if (thread.participantId && thread.participantId !== currentUserId) return thread.participantId;
  if (thread.type !== 'direct') return '';

  return thread.id
    .split('_')
    .find((part) => part && part !== currentUserId) || '';
};

export const useAfriChat = () => {
  const { user, profile } = useFirebaseAuth();
  const [threads, setThreads] = useState<AfriChatThread[]>([]);
  const [contacts, setContacts] = useState<AfriChatContact[]>([]);
  const [messagesByThread, setMessagesByThread] = useState<Record<string, AfriChatMessage[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    if (!user) {
      setThreads([]);
      setContacts([]);
      setMessagesByThread({});
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    const threadsCacheKey = offlineCacheKey('chatThreads', user.uid);
    const contactsCacheKey = offlineCacheKey('chatContacts', user.uid);
    const cachedThreads = readOfflineCache<AfriChatThread[]>(threadsCacheKey, []);
    const cachedContacts = readOfflineCache<AfriChatContact[]>(contactsCacheKey, []);

    if (cachedThreads.length) setThreads(cachedThreads);
    if (cachedContacts.length) setContacts(cachedContacts);

    if (isOfflineNow()) {
      setLoading(false);
      setError(cachedThreads.length || cachedContacts.length ? 'Mode hors ligne: discussions locales affichées.' : 'Mode hors ligne: aucune discussion locale disponible.');
    }

    void Promise.all([
      readOfflineCacheAsync<AfriChatThread[]>(threadsCacheKey, []),
      readOfflineCacheAsync<AfriChatContact[]>(contactsCacheKey, [])
    ]).then(([indexedThreads, indexedContacts]) => {
      if (!mounted) return;
      if (indexedThreads.length) setThreads(indexedThreads);
      if (indexedContacts.length) setContacts(indexedContacts);
      if (isOfflineNow()) setLoading(false);
    });

    const userThreadsRef = ref(realtimeDb, `userChats/${user.uid}`);
    const userContactsRef = ref(realtimeDb, `chatContacts/${user.uid}`);
    const publicVillagesRef = ref(realtimeDb, 'publicVillageDeals');

    const unsubscribeThreads = onValue(
      userThreadsRef,
      (snapshot) => {
        const fallback = readOfflineCache<AfriChatThread[]>(threadsCacheKey, []);
        if (!snapshot.exists() && isOfflineNow() && fallback.length) {
          setThreads(fallback);
          setLoading(false);
          return;
        }

        const data = snapshot.val() as Record<string, RawThread> | null;
        const nextThreads = Object.entries(data || {})
          .map(([id, thread]) => normalizeThread(id, thread))
          .sort((first, second) => getTimestamp(second.lastMessageAt) - getTimestamp(first.lastMessageAt));
        setThreads(nextThreads);
        writeOfflineCache(threadsCacheKey, nextThreads);
        setLoading(false);
      },
      (threadError) => {
        console.error('Chargement discussions AfriChat impossible:', threadError);
        const fallback = readOfflineCache<AfriChatThread[]>(threadsCacheKey, []);
        if (fallback.length) setThreads(fallback);
        setError(fallback.length ? 'Mode hors ligne: discussions locales affichées.' : 'Discussions indisponibles pour le moment.');
        setLoading(false);
      }
    );

    const unsubscribeContacts = onValue(
      userContactsRef,
      (snapshot) => {
        const fallback = readOfflineCache<AfriChatContact[]>(contactsCacheKey, []);
        if (!snapshot.exists() && isOfflineNow() && fallback.length) {
          setContacts(fallback);
          return;
        }

        const data = snapshot.val() as Record<string, RawContact> | null;
        const nextContacts = Object.entries(data || {})
          .map(([id, contact]) => normalizeContact(id, contact))
          .sort((first, second) => first.displayName.localeCompare(second.displayName));
        setContacts(nextContacts);
        writeOfflineCache(contactsCacheKey, nextContacts);
      },
      (contactError) => {
        console.error('Chargement contacts AfriChat impossible:', contactError);
        const fallback = readOfflineCache<AfriChatContact[]>(contactsCacheKey, []);
        if (fallback.length) setContacts(fallback);
        setError(fallback.length ? 'Mode hors ligne: contacts locaux affichés.' : 'Contacts indisponibles pour le moment.');
      }
    );

    const unsubscribePublicVillages = onValue(publicVillagesRef, (snapshot) => {
      const data = snapshot.val() as Record<string, RawPublicVillageDeal> | null;
      const publicVillageThreads = Object.entries(data || {}).map(([id, village]): AfriChatThread => ({
        id: village.id || id,
        title: village.title || village.productName || 'Village public',
        avatarURL: village.productImage || '',
        productId: village.productId || id,
        productName: village.productName || '',
        productImage: village.productImage || '',
        villagePrice: village.villagePrice,
        currency: village.currency,
        visibility: 'public',
        type: 'village',
        status: 'Village d’achat public',
        lastMessage: village.productName ? `Prix Village: ${village.productName}` : 'Village public AfriSell',
        lastMessageAt: village.createdAt || 0,
        unreadCount: 0
      }));

      setThreads((currentThreads) => {
        const currentById = new Map<string, AfriChatThread>(currentThreads.map((thread) => [thread.id, thread]));
        publicVillageThreads.forEach((thread) => {
          if (!currentById.has(thread.id)) currentById.set(thread.id, thread);
        });
        return Array.from(currentById.values())
          .sort((first, second) => getTimestamp(second.lastMessageAt) - getTimestamp(first.lastMessageAt));
      });
    });

    return () => {
      mounted = false;
      unsubscribeThreads();
      unsubscribeContacts();
      unsubscribePublicVillages();
      off(userThreadsRef);
      off(userContactsRef);
      off(publicVillagesRef);
    };
  }, [user]);

  const watchThreadMessages = (threadId: string) => {
    if (!threadId) return () => undefined;
    const messagesCacheKey = offlineCacheKey('chatMessages', threadId);
    const cachedMessages = readOfflineCache<AfriChatMessage[]>(messagesCacheKey, []);
    if (cachedMessages.length) {
      setMessagesByThread((current) => ({
        ...current,
        [threadId]: cachedMessages
      }));
    }
    void readOfflineCacheAsync<AfriChatMessage[]>(messagesCacheKey, []).then((indexedMessages) => {
      if (!indexedMessages.length) return;
      setMessagesByThread((current) => ({
        ...current,
        [threadId]: indexedMessages
      }));
    });

    const messagesRef = ref(realtimeDb, `chatMessages/${threadId}`);
    const unsubscribe = onValue(
      messagesRef,
      (snapshot) => {
        const fallback = readOfflineCache<AfriChatMessage[]>(messagesCacheKey, []);
        if (!snapshot.exists() && isOfflineNow() && fallback.length) {
          setMessagesByThread((current) => ({
            ...current,
            [threadId]: fallback
          }));
          return;
        }

        const data = snapshot.val() as Record<string, RawMessage> | null;
        const nextMessages = Object.entries(data || {})
          .map(([id, message]) => normalizeMessage(id, message))
          .sort((first, second) => getTimestamp(first.createdAt) - getTimestamp(second.createdAt));
        setMessagesByThread((current) => ({
          ...current,
          [threadId]: nextMessages
        }));
        writeOfflineCache(messagesCacheKey, nextMessages);
      },
      (messagesError) => {
        console.error('Chargement messages AfriChat impossible:', messagesError);
        const fallback = readOfflineCache<AfriChatMessage[]>(messagesCacheKey, []);
        if (fallback.length) {
          setMessagesByThread((current) => ({
            ...current,
            [threadId]: fallback
          }));
        }
        setError(fallback.length ? 'Mode hors ligne: derniers messages affichés.' : 'Messages indisponibles pour le moment.');
      }
    );

    return () => {
      unsubscribe();
      off(messagesRef);
    };
  };

  const sendMessage = async (thread: AfriChatThread, text: string, options: AfriChatMessageOptions = {}) => {
    if (!user) return;
    const trimmedText = text.trim();
    if (!trimmedText) return;

    const messageRef = push(ref(realtimeDb, `chatMessages/${thread.id}`));
    const messageId = messageRef.key || '';
    const now = Date.now();
    const message = {
      id: messageId,
      senderId: user.uid,
      text: trimmedText,
      type: options.type || 'text',
      orderId: options.orderId || '',
      productId: options.productId || '',
      amount: Number(options.amount || 0),
      currency: options.currency || '',
      mediaUrl: options.mediaUrl || '',
      fileName: options.fileName || '',
      mimeType: options.mimeType || '',
      createdAt: now,
      status: 'sent'
    };
    const offline = isOfflineNow();
    const updatedAtValue = offline ? now : serverTimestamp();

    const optimisticMessage = {
      ...message,
      status: offline ? 'queued' : 'sent'
    };
    const nextMessages = [...(messagesByThread[thread.id] || []), optimisticMessage];
    setMessagesByThread((current) => ({
      ...current,
      [thread.id]: nextMessages
    }));
    writeOfflineCache(offlineCacheKey('chatMessages', thread.id), nextMessages);

    const userChatUpdate = {
      threadId: thread.id,
      title: thread.title,
      avatarURL: thread.avatarURL || '',
      participantId: thread.participantId || getDirectRecipientId(thread, user.uid),
      participantName: thread.participantName || thread.title,
      participantAvatarURL: thread.participantAvatarURL || thread.avatarURL || '',
      type: thread.type || 'direct',
      lastMessage: trimmedText,
      lastMessageAt: now,
      updatedAt: updatedAtValue,
      unreadCount: 0
    };

    const recipientId = getDirectRecipientId(thread, user.uid);
    const updates: Record<string, unknown> = {
      [`chatMessages/${thread.id}/${messageId}`]: message,
      [`userChats/${user.uid}/${thread.id}`]: userChatUpdate,
      [`chatThreads/${thread.id}/id`]: thread.id,
      [`chatThreads/${thread.id}/title`]: thread.title,
      [`chatThreads/${thread.id}/type`]: thread.type || 'direct',
      [`chatThreads/${thread.id}/lastMessage`]: trimmedText,
      [`chatThreads/${thread.id}/lastMessageAt`]: now,
      [`chatThreads/${thread.id}/updatedAt`]: updatedAtValue,
      [`chatThreads/${thread.id}/members/${user.uid}`]: true,
      [`chatThreads/${thread.id}/memberNames/${user.uid}`]: profile?.displayName || user.displayName || 'Utilisateur AfriSell'
    };

    if (recipientId && !recipientId.startsWith('device_')) {
      updates[`userChats/${recipientId}/${thread.id}`] = {
        threadId: thread.id,
        title: profile?.displayName || user.displayName || 'Utilisateur AfriSell',
        avatarURL: profile?.photoURL || user.photoURL || '',
        participantId: user.uid,
        participantName: profile?.displayName || user.displayName || 'Utilisateur AfriSell',
        participantAvatarURL: profile?.photoURL || user.photoURL || '',
        type: thread.type || 'direct',
        status: 'AfriChat',
        lastMessage: trimmedText,
        lastMessageAt: now,
        updatedAt: updatedAtValue,
        unreadCount: 1
      };
      updates[`chatThreads/${thread.id}/members/${recipientId}`] = true;
      updates[`chatThreads/${thread.id}/memberNames/${recipientId}`] = thread.title;
    }

    if (offline) {
      await enqueueFirebaseUpdate(updates);
      setError('Mode hors ligne: message ajoute à la file AfriChat.');
      return;
    }

    await update(ref(realtimeDb), updates);
  };

  const openDirectThread = async (contact: AfriChatContact): Promise<AfriChatThread | null> => {
    if (!user) return null;

    const threadId = contact.threadId || [user.uid, contact.id].sort().join('_');
    const thread: AfriChatThread = {
      id: threadId,
      title: contact.displayName,
      avatarURL: contact.avatarURL,
      participantId: contact.id,
      participantName: contact.displayName,
      participantAvatarURL: contact.avatarURL,
      type: 'direct',
      status: contact.status || 'Disponible',
      lastMessage: '',
      unreadCount: 0
    };

    await update(ref(realtimeDb, `userChats/${user.uid}/${threadId}`), {
      threadId,
      title: thread.title,
      avatarURL: thread.avatarURL || '',
      participantId: contact.id,
      participantName: contact.displayName,
      participantAvatarURL: contact.avatarURL || '',
      type: thread.type,
      status: thread.status,
      unreadCount: 0,
      updatedAt: serverTimestamp()
    });

    if (!contact.id.startsWith('device_')) {
      await update(ref(realtimeDb, `userChats/${contact.id}/${threadId}`), {
        threadId,
        title: profile?.displayName || user.displayName || 'Utilisateur AfriSell',
        avatarURL: profile?.photoURL || user.photoURL || '',
        participantId: user.uid,
        participantName: profile?.displayName || user.displayName || 'Utilisateur AfriSell',
        participantAvatarURL: profile?.photoURL || user.photoURL || '',
        type: thread.type,
        status: 'AfriChat',
        unreadCount: 0,
        updatedAt: serverTimestamp()
      });
    }

    await update(ref(realtimeDb, `chatThreads/${threadId}`), {
      id: threadId,
      title: thread.title,
      type: 'direct',
      updatedAt: serverTimestamp(),
      [`members/${user.uid}`]: true,
      [`members/${contact.id}`]: true,
      [`memberNames/${user.uid}`]: profile?.displayName || user.displayName || 'Utilisateur AfriSell',
      [`memberNames/${contact.id}`]: contact.displayName
    });

    return thread;
  };

  const createCommunityThread = async (
    type: 'village' | 'kyaghanda' | 'support',
    title: string,
    status: string
  ): Promise<AfriChatThread | null> => {
    if (!user) return null;

    const threadRef = push(ref(realtimeDb, `userChats/${user.uid}`));
    const threadId = threadRef.key;
    if (!threadId) throw new Error('Création AfriChat impossible.');

    const now = Date.now();
    const displayName = profile?.displayName || user.displayName || 'Utilisateur AfriSell';
    const thread: AfriChatThread = {
      id: threadId,
      title,
      type,
      status,
      lastMessage: 'Espace créé. Ajoute les echanges utiles ici.',
      lastMessageAt: now,
      unreadCount: 0
    };

    const updates: Record<string, unknown> = {
      [`userChats/${user.uid}/${threadId}`]: {
        threadId,
        title,
        type,
        status,
        lastMessage: thread.lastMessage,
        lastMessageAt: now,
        unreadCount: 0,
        updatedAt: serverTimestamp()
      },
      [`chatThreads/${threadId}/id`]: threadId,
      [`chatThreads/${threadId}/title`]: title,
      [`chatThreads/${threadId}/type`]: type,
      [`chatThreads/${threadId}/status`]: status,
      [`chatThreads/${threadId}/lastMessage`]: thread.lastMessage,
      [`chatThreads/${threadId}/lastMessageAt`]: now,
      [`chatThreads/${threadId}/updatedAt`]: serverTimestamp(),
      [`chatThreads/${threadId}/members/${user.uid}`]: true,
      [`chatThreads/${threadId}/memberNames/${user.uid}`]: displayName,
      [`chatMessages/${threadId}/welcome`]: {
        id: 'welcome',
        senderId: 'system',
        text: thread.lastMessage,
        type,
        createdAt: now,
        status: 'sent'
      }
    };

    await update(ref(realtimeDb), updates);
    return thread;
  };

  const markThreadRead = async (threadId: string) => {
    if (!user || !threadId) return;

    const updates: Record<string, unknown> = {
      [`userChats/${user.uid}/${threadId}/unreadCount`]: 0,
      [`userChats/${user.uid}/${threadId}/readAt`]: serverTimestamp()
    };

    (messagesByThread[threadId] || []).forEach((message) => {
      if (message.senderId && message.senderId !== user.uid && message.status !== 'read') {
        updates[`chatMessages/${threadId}/${message.id}/status`] = 'read';
      }
    });

    await update(ref(realtimeDb), updates);
    await update(ref(realtimeDb, `userChats/${user.uid}/${threadId}`), {
      unreadCount: 0,
      readAt: serverTimestamp()
    });
  };

  return useMemo(() => ({
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
  }), [contacts, error, loading, messagesByThread, threads]);
};
