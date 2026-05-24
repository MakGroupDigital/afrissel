import { useEffect, useMemo, useState } from 'react';
import { off, onValue, push, ref, serverTimestamp, set, update } from 'firebase/database';
import { realtimeDb } from '../lib/firebase';
import { useFirebaseAuth } from './useFirebaseAuth';

export type AfriChatThread = {
  id: string;
  title: string;
  avatarURL?: string;
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

    const userThreadsRef = ref(realtimeDb, `userChats/${user.uid}`);
    const userContactsRef = ref(realtimeDb, `chatContacts/${user.uid}`);

    const unsubscribeThreads = onValue(
      userThreadsRef,
      (snapshot) => {
        const data = snapshot.val() as Record<string, RawThread> | null;
        const nextThreads = Object.entries(data || {})
          .map(([id, thread]) => normalizeThread(id, thread))
          .sort((first, second) => getTimestamp(second.lastMessageAt) - getTimestamp(first.lastMessageAt));
        setThreads(nextThreads);
        setLoading(false);
      },
      (threadError) => {
        console.error('Chargement discussions AfriChat impossible:', threadError);
        setError('Discussions indisponibles pour le moment.');
        setLoading(false);
      }
    );

    const unsubscribeContacts = onValue(
      userContactsRef,
      (snapshot) => {
        const data = snapshot.val() as Record<string, RawContact> | null;
        const nextContacts = Object.entries(data || {})
          .map(([id, contact]) => normalizeContact(id, contact))
          .sort((first, second) => first.displayName.localeCompare(second.displayName));
        setContacts(nextContacts);
      },
      (contactError) => {
        console.error('Chargement contacts AfriChat impossible:', contactError);
        setError('Contacts indisponibles pour le moment.');
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
    const messagesRef = ref(realtimeDb, `chatMessages/${threadId}`);
    const unsubscribe = onValue(
      messagesRef,
      (snapshot) => {
        const data = snapshot.val() as Record<string, RawMessage> | null;
        const nextMessages = Object.entries(data || {})
          .map(([id, message]) => normalizeMessage(id, message))
          .sort((first, second) => getTimestamp(first.createdAt) - getTimestamp(second.createdAt));
        setMessagesByThread((current) => ({
          ...current,
          [threadId]: nextMessages
        }));
      },
      (messagesError) => {
        console.error('Chargement messages AfriChat impossible:', messagesError);
        setError('Messages indisponibles pour le moment.');
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
      type: thread.type || 'direct',
      lastMessage: trimmedText,
      lastMessageAt: now,
      updatedAt: serverTimestamp(),
      unreadCount: 0
    });

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
      type: 'direct',
      status: contact.status || 'Disponible',
      lastMessage: '',
      unreadCount: 0
    };

    await update(ref(realtimeDb, `userChats/${user.uid}/${threadId}`), {
      threadId,
      title: thread.title,
      avatarURL: thread.avatarURL || '',
      type: thread.type,
      status: thread.status,
      unreadCount: 0,
      updatedAt: serverTimestamp()
    });

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
