import { useEffect, useMemo, useState } from 'react';
import { off, onValue, push, ref, serverTimestamp, set, update } from 'firebase/database';
import { realtimeDb } from '../lib/firebase';
import { useFirebaseAuth } from './useFirebaseAuth';
import { isOfflineNow, offlineCacheKey, readOfflineCache, writeOfflineCache } from '../lib/offlineCache';

export type AfriChatThread = {
  id: string;
  title: string;
  avatarURL?: string;
  participantId?: string;
  participantName?: string;
  participantAvatarURL?: string;
  lastMessage?: string;
  lastMessageAt?: number | string | { seconds?: number };
  unreadCount?: number;
  type?: 'direct' | 'group' | 'support' | string;
  status?: string;
};

export type AfriChatMessage = {
  id: string;
  senderId: string;
  text: string;
  createdAt?: number | string | { seconds?: number };
  status?: string;
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
      setError(cachedThreads.length || cachedContacts.length ? 'Mode hors ligne: discussions locales affichees.' : 'Mode hors ligne: aucune discussion locale disponible.');
    }

    const userThreadsRef = ref(realtimeDb, `userChats/${user.uid}`);
    const userContactsRef = ref(realtimeDb, `chatContacts/${user.uid}`);

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
        setError(fallback.length ? 'Mode hors ligne: discussions locales affichees.' : 'Discussions indisponibles pour le moment.');
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
        setError(fallback.length ? 'Mode hors ligne: contacts locaux affiches.' : 'Contacts indisponibles pour le moment.');
      }
    );

    return () => {
      unsubscribeThreads();
      unsubscribeContacts();
      off(userThreadsRef);
      off(userContactsRef);
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
        setError(fallback.length ? 'Mode hors ligne: derniers messages affiches.' : 'Messages indisponibles pour le moment.');
      }
    );

    return () => {
      unsubscribe();
      off(messagesRef);
    };
  };

  const sendMessage = async (thread: AfriChatThread, text: string) => {
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
      createdAt: now,
      status: 'sent'
    };

    await set(messageRef, message);

    await update(ref(realtimeDb, `userChats/${user.uid}/${thread.id}`), {
      threadId: thread.id,
      title: thread.title,
      avatarURL: thread.avatarURL || '',
      participantId: thread.participantId || getDirectRecipientId(thread, user.uid),
      participantName: thread.participantName || thread.title,
      participantAvatarURL: thread.participantAvatarURL || thread.avatarURL || '',
      type: thread.type || 'direct',
      lastMessage: trimmedText,
      lastMessageAt: now,
      updatedAt: serverTimestamp(),
      unreadCount: 0
    });

    const recipientId = getDirectRecipientId(thread, user.uid);
    if (recipientId && !recipientId.startsWith('device_')) {
      await update(ref(realtimeDb, `userChats/${recipientId}/${thread.id}`), {
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
        updatedAt: serverTimestamp(),
        unreadCount: 1
      });
    }

    await update(ref(realtimeDb, `chatThreads/${thread.id}`), {
      id: thread.id,
      title: thread.title,
      lastMessage: trimmedText,
      lastMessageAt: now,
      updatedAt: serverTimestamp(),
      [`members/${user.uid}`]: true,
      [`memberNames/${user.uid}`]: profile?.displayName || user.displayName || 'Utilisateur AfriSell'
    });
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

  const markThreadRead = async (threadId: string) => {
    if (!user || !threadId) return;

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
    markThreadRead
  }), [contacts, error, loading, messagesByThread, threads]);
};
