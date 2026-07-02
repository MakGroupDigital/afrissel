import React, { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { get, off, onValue, push, ref, runTransaction, serverTimestamp, set, update } from 'firebase/database';
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
  viewsCount?: number;
  kissesCount?: number;
};

type ContactRequest = {
  id: string;
  fromId: string;
  fromName: string;
  fromAvatar?: string;
  fromEmail?: string;
  fromPhone?: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt?: number;
};

type RawUserProfile = {
  uid?: string;
  email?: string;
  displayName?: string;
  businessName?: string;
  photoURL?: string;
  logoURL?: string;
  phone?: string;
  phoneLocal?: string;
  city?: string;
  country?: string;
};

type ContactSearchResult = {
  id: string;
  profile: RawUserProfile;
};

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue?: string }>>;
};

type WindowWithBarcodeDetector = Window & {
  BarcodeDetector?: BarcodeDetectorConstructor;
};

const getThreadParticipantId = (thread: AfriChatThread, currentUserId?: string | null) => {
  if (!currentUserId) return '';
  if (thread.participantId && thread.participantId !== currentUserId && !thread.participantId.startsWith('device_')) {
    return thread.participantId;
  }
  if (thread.type && !['direct', 'support'].includes(thread.type)) return '';

  return thread.id
    .split('_')
    .find((part) => part && part !== currentUserId && !part.startsWith('device_')) || '';
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
  const unreadCount = Number(thread.unreadCount || 0);
  const isDirectThread = thread.type === 'direct' || Boolean(thread.participantId);
  const isConnected = isDirectThread || String(thread.status || '').toLowerCase().includes('connect');

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
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-sm font-black text-white">{thread.title}</p>
            {isConnected && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#15EA3E]/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-wide text-[#15EA3E]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#15EA3E] shadow-[0_0_8px_rgba(21,234,62,0.7)]" />
                Connecté
              </span>
            )}
          </div>
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-gray-600">
            {formatChatTime(thread.lastMessageAt)}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-3">
          <p className="truncate text-xs text-gray-500">{thread.lastMessage || 'Aucun message pour le moment'}</p>
          {unreadCount > 0 ? (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#15EA3E] px-1.5 text-[10px] font-black text-black">
              {unreadCount}
            </span>
          ) : thread.lastMessage ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-[9px] font-black uppercase tracking-wide text-[#15EA3E]/80">
              <MessageStatusTicks status="read" />
              Lu
            </span>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1 text-[9px] font-black uppercase tracking-wide text-white/24">
              <MessageStatusTicks status="sent" />
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function ContactRow({ contact, onOpen, disabled = false }: { key?: React.Key; contact: AfriChatContact; onOpen: () => void | Promise<void>; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={disabled}
      className={cn(
        'flex w-full items-center gap-3 rounded-2xl border border-gray-900 bg-[#050505] p-3 text-left transition-colors hover:border-gray-700 hover:bg-[#0A0A0A]',
        disabled && 'cursor-not-allowed opacity-55 hover:border-gray-900 hover:bg-[#050505]'
      )}
    >
      <Avatar title={contact.displayName} src={contact.avatarURL} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black text-white">{contact.displayName}</p>
        <p className="mt-1 truncate text-xs text-gray-500">{contact.status || 'Disponible sur AfriChat'}</p>
      </div>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#15EA3E]/10 text-[#15EA3E]">
        <AfriSellIcon name={disabled ? 'check' : 'send'} size={17} />
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

function MessageBubble({
  message,
  isMine,
  onOpenKiss
}: {
  key?: React.Key;
  message: AfriChatMessage;
  isMine: boolean;
  onOpenKiss?: () => void;
}) {
  const messageBadge = message.type && message.type !== 'text'
    ? {
      order: 'Commande',
      village_share: 'Prix Village',
      payment: 'Paiement',
      delivery: 'Safari',
      kyaghanda: 'Kyaghanda',
      system: 'Système',
      kiss: 'Bisous',
      image: 'Photo',
      video: 'Vidéo',
      audio: 'Vocal',
      file: 'Fichier',
      contact: 'Contact',
      location: 'Position'
    }[message.type]
    : '';
  const isKiss = message.type === 'kiss';
  const isImage = message.type === 'image' && message.mediaUrl;
  const isVideo = message.type === 'video' && message.mediaUrl;
  const isAudio = message.type === 'audio' && message.mediaUrl;
  const isFile = message.type === 'file';
  const isLocation = message.type === 'location';
  const badgeIcon: AfriSellIconName = message.type === 'kiss'
    ? 'kiss'
    : message.type === 'payment'
      ? 'pay'
      : message.type === 'delivery'
        ? 'send'
        : message.type === 'order'
          ? 'order'
          : message.type === 'image'
            ? 'gallery'
            : message.type === 'video'
              ? 'video'
              : message.type === 'audio'
                ? 'mic'
                : message.type === 'file'
                  ? 'file'
                  : message.type === 'contact'
                    ? 'contact'
                    : message.type === 'location'
                      ? 'location'
                      : 'chat';

  return (
    <div className={cn('flex w-full', isMine ? 'justify-end' : 'justify-start')}>
      <button
        type="button"
        onClick={isKiss ? onOpenKiss : undefined}
        disabled={!isKiss}
        className={cn(
        'max-w-[82%] rounded-2xl border px-3.5 py-3',
        isKiss ? 'text-left active:scale-[0.98]' : 'cursor-default text-left',
        isMine
          ? 'rounded-br-md border-[#15EA3E]/30 bg-[#15EA3E]/12 text-white'
          : 'rounded-bl-md border-gray-800 bg-[#0A0A0A] text-gray-200'
      )}>
        {messageBadge && (
          <div className="mb-2 flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-[#15EA3E]">
            <AfriSellIcon name={badgeIcon} size={12} />
            {messageBadge}
          </div>
        )}
        {isKiss ? (
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#15EA3E] text-black shadow-[0_0_26px_rgba(21,234,62,0.45)]">
              <AfriSellIcon name="kiss" size={24} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-black">Bisous reçu</span>
              <span className="mt-0.5 block text-[10px] font-semibold text-white/45">{isMine ? 'Envoyé avec effet' : 'Appuie pour ouvrir l’effet'}</span>
            </span>
          </div>
        ) : isImage ? (
          <a href={message.mediaUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-2xl border border-white/10 bg-black/30">
            <img src={message.mediaUrl} alt={message.fileName || 'Photo AfriChat'} className="max-h-72 w-full object-cover" />
            {message.text && <span className="block px-3 py-2 text-[12px] font-semibold text-white/70">{message.text}</span>}
          </a>
        ) : isVideo ? (
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">
            <video src={message.mediaUrl} controls playsInline className="max-h-72 w-full bg-black object-cover" />
            {message.text && <p className="px-3 py-2 text-[12px] font-semibold text-white/70">{message.text}</p>}
          </div>
        ) : isAudio ? (
          <div className="min-w-[220px] rounded-2xl border border-white/10 bg-black/30 p-3">
            <div className="mb-2 flex items-center gap-2 text-[#15EA3E]">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#15EA3E] text-black">
                <AfriSellIcon name="mic" size={16} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-black text-white">{message.fileName || 'Message vocal'}</span>
                <span className="block text-[10px] font-bold text-white/45">Audio AfriChat</span>
              </span>
            </div>
            <audio src={message.mediaUrl} controls className="h-9 w-full" />
          </div>
        ) : isFile ? (
          <a
            href={message.mediaUrl || undefined}
            download={message.fileName || true}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-3"
            onClick={(event) => {
              if (!message.mediaUrl) event.preventDefault();
            }}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/8 text-[#15EA3E]">
              <AfriSellIcon name="file" size={18} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-black">{message.fileName || message.text}</span>
              <span className="mt-0.5 block text-[10px] font-semibold text-white/45">{message.mediaUrl ? 'Ouvrir ou télécharger' : message.mimeType || 'Document'}</span>
            </span>
          </a>
        ) : isLocation ? (
          <a href={message.text.replace('Position partagée: ', '')} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#15EA3E] text-black">
              <AfriSellIcon name="location" size={18} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-black">Position partagée</span>
              <span className="mt-0.5 block truncate text-[10px] font-semibold text-white/45">Ouvrir la carte</span>
            </span>
          </a>
        ) : (
          <p className="whitespace-pre-wrap text-[13px] font-medium leading-relaxed">{message.text}</p>
        )}
        {message.productId && (
          <p className="mt-2 rounded-xl bg-black/20 px-2 py-1 text-[10px] font-bold text-white/50">
            Produit: {message.productId}
          </p>
        )}
        <div className={cn('mt-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide', isMine ? 'justify-end text-[#15EA3E]/70' : 'text-gray-600')}>
          <span>{formatChatTime(message.createdAt)}</span>
          {isMine && <MessageStatusTicks status={message.status} />}
        </div>
      </button>
    </div>
  );
}

function KissEffectOverlay({ effectKey }: { effectKey: number }) {
  if (effectKey <= 0) return null;

  return (
    <div key={effectKey} className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      <div className="absolute inset-0 bg-[#15EA3E]/10 animate-ping" />
      {Array.from({ length: 18 }).map((_, index) => (
        <div
          key={index}
          className="absolute flex h-9 w-9 items-center justify-center rounded-full bg-[#15EA3E] text-black shadow-[0_0_24px_rgba(21,234,62,0.78)]"
          style={{
            left: `${8 + ((index * 23) % 84)}%`,
            bottom: `${-10 - (index % 5) * 7}%`,
            animation: `story-kiss-float ${1300 + (index % 6) * 120}ms ease-out ${index * 38}ms forwards`
          }}
        >
          <AfriSellIcon name="kiss" size={17} />
        </div>
      ))}
    </div>
  );
}

function ChatSettingsSheet({ onClose }: { onClose: () => void }) {
  const settings = [
    { icon: 'notifications' as AfriSellIconName, title: 'Notifications', body: 'Gérer les alertes des chats, Kialanda, vitrines, villages et stories.' },
    { icon: 'shield' as AfriSellIconName, title: 'Confidentialité', body: "Contrôle qui peut te contacter, voir tes stories et t'inviter dans un Village." },
    { icon: 'language' as AfriSellIconName, title: 'Traduction', body: 'Préparer la traduction instantanée des conversations AfriChat.' },
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
  const [attaching, setAttaching] = useState(false);
  const [translationEnabled, setTranslationEnabled] = useState(false);
  const [creatingThread, setCreatingThread] = useState('');
  const [actionStatus, setActionStatus] = useState('');
  const [actionStatusKind, setActionStatusKind] = useState<'error' | 'success'>('error');
  const [deviceContacts, setDeviceContacts] = useState<AfriChatContact[]>([]);
  const [contactsStatus, setContactsStatus] = useState('');
  const [importingContacts, setImportingContacts] = useState(false);
  const [incomingRequests, setIncomingRequests] = useState<ContactRequest[]>([]);
  const [manualContactValue, setManualContactValue] = useState('');
  const [manualLookupResult, setManualLookupResult] = useState<ContactSearchResult | null>(null);
  const [manualLookupLoading, setManualLookupLoading] = useState(false);
  const [addingContact, setAddingContact] = useState(false);
  const [showAddContactPanel, setShowAddContactPanel] = useState(false);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [qrStatus, setQrStatus] = useState('');
  const [stories, setStories] = useState<ChatStory[]>([]);
  const [storyFile, setStoryFile] = useState<File | null>(null);
  const [storyPreview, setStoryPreview] = useState('');
  const [storyCaption, setStoryCaption] = useState('');
  const [storyStatus, setStoryStatus] = useState('');
  const [storyPublishing, setStoryPublishing] = useState(false);
  const [activeStory, setActiveStory] = useState<ChatStory | null>(null);
  const [storyProgress, setStoryProgress] = useState(0);
  const [storyReply, setStoryReply] = useState('');
  const [storyReplyStatus, setStoryReplyStatus] = useState('');
  const [storyReplySending, setStoryReplySending] = useState(false);
  const [kissEffectKey, setKissEffectKey] = useState(0);
  const [showConversationPanel, setShowConversationPanel] = useState(false);
  const [showChatSettings, setShowChatSettings] = useState(false);
  const [villageInviteValue, setVillageInviteValue] = useState('');
  const [villageInviteLoading, setVillageInviteLoading] = useState(false);
  const [recordingVoice, setRecordingVoice] = useState(false);
  const storyInputRef = useRef<HTMLInputElement | null>(null);
  const chatCameraInputRef = useRef<HTMLInputElement | null>(null);
  const chatGalleryInputRef = useRef<HTMLInputElement | null>(null);
  const chatFileInputRef = useRef<HTMLInputElement | null>(null);
  const voiceRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const viewedStoriesRef = useRef(new Set<string>());
  const qrVideoRef = useRef<HTMLVideoElement | null>(null);
  const qrStreamRef = useRef<MediaStream | null>(null);
  const qrScanTimerRef = useRef<number | null>(null);
  const actionStatusTimerRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const contactRouteHandledRef = useRef('');

  const showActionStatus = (message: string, kind: 'error' | 'success' = 'error', autoHide = false) => {
    if (actionStatusTimerRef.current) {
      window.clearTimeout(actionStatusTimerRef.current);
      actionStatusTimerRef.current = null;
    }

    setActionStatusKind(kind);
    setActionStatus(message);

    if (autoHide) {
      actionStatusTimerRef.current = window.setTimeout(() => {
        setActionStatus('');
        actionStatusTimerRef.current = null;
      }, 2800);
    }
  };

  const clearActionStatus = () => {
    if (actionStatusTimerRef.current) {
      window.clearTimeout(actionStatusTimerRef.current);
      actionStatusTimerRef.current = null;
    }
    setActionStatus('');
  };

  const readFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Lecture du fichier impossible.'));
    reader.readAsDataURL(file);
  });

  const stopVoiceStream = () => {
    voiceStreamRef.current?.getTracks().forEach((track) => track.stop());
    voiceStreamRef.current = null;
  };

  const translateDraft = () => {
    setTranslationEnabled((current) => !current);
    if (!draft.trim()) {
      showActionStatus(
        translationEnabled ? 'Traduction désactivée.' : 'Traduction activée. Écris un message puis appuie encore pour préparer la traduction.',
        'success',
        true
      );
      return;
    }

    const translated = draft
      .replace(/\bhello\b/gi, 'bonjour')
      .replace(/\bthanks\b/gi, 'merci')
      .replace(/\bprice\b/gi, 'prix')
      .replace(/\bdelivery\b/gi, 'livraison')
      .replace(/\bpayment\b/gi, 'paiement')
      .replace(/\bproduct\b/gi, 'produit')
      .replace(/\bcommande\b/gi, 'order')
      .replace(/\bprix\b/gi, 'price')
      .replace(/\blivraison\b/gi, 'delivery')
      .replace(/\bpaiement\b/gi, 'payment');

    setDraft(translated === draft ? `[Traduction AfriChat]\n${draft}` : translated);
    showActionStatus('Traduction préparée dans le champ message.', 'success', true);
  };

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) || (fallbackThread?.id === activeThreadId ? fallbackThread : null),
    [activeThreadId, fallbackThread, threads]
  );

  const messages = activeThread ? messagesByThread[activeThread.id] || [] : [];
  const isActiveVillage = activeThread?.type === 'village';
  const activeVillageInviteLink = activeThread?.inviteLink || (isActiveVillage ? `${window.location.origin}/chat?village=${encodeURIComponent(activeThread.id)}` : '');
  const normalizedQuery = query.trim().toLowerCase();
  const activeParticipantId = activeThread?.participantId && !activeThread.participantId.startsWith('device_')
    ? activeThread.participantId
    : '';
  const acceptedContactIds = useMemo(() => {
    const contactIds = contacts
      .filter((contact) => !contact.id.startsWith('device_') && !String(contact.status || '').toLowerCase().includes('demande'))
      .map((contact) => contact.id);
    const threadContactIds = threads
      .map((thread) => getThreadParticipantId(thread, user?.uid))
      .filter(Boolean);

    return new Set([...contactIds, ...threadContactIds]);
  }, [contacts, threads, user?.uid]);
  const visibleStories = useMemo(() => (
    stories.filter((story) => story.authorId === user?.uid || acceptedContactIds.has(story.authorId))
  ), [acceptedContactIds, stories, user?.uid]);

  const openStoryViewer = (story: ChatStory) => {
    setStoryProgress(0);
    setStoryReply('');
    setStoryReplyStatus('');
    setActiveStory(story);
  };

  const closeStoryViewer = () => {
    setStoryProgress(0);
    setStoryReply('');
    setStoryReplyStatus('');
    setActiveStory(null);
  };

  const goToNextStory = () => {
    if (!activeStory) return;
    const currentIndex = visibleStories.findIndex((story) => story.authorId === activeStory.authorId && story.id === activeStory.id);
    const nextStory = currentIndex >= 0 ? visibleStories[currentIndex + 1] : null;
    if (nextStory) {
      openStoryViewer(nextStory);
      return;
    }
    closeStoryViewer();
  };

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

  useEffect(() => {
    if (!activeStory) return;
    const updatedStory = stories.find((story) => story.authorId === activeStory.authorId && story.id === activeStory.id);
    if (updatedStory && updatedStory !== activeStory) setActiveStory(updatedStory);
  }, [activeStory, stories]);

  const playKissEffect = () => {
    setKissEffectKey((current) => current + 1);
  };

  const registerStoryView = async (story: ChatStory) => {
    if (!user || !story.authorId || !story.id) return;
    const viewKey = `${story.authorId}:${story.id}:${user.uid}`;
    if (viewedStoriesRef.current.has(viewKey)) return;
    viewedStoriesRef.current.add(viewKey);

    let alreadyViewed = false;
    try {
      await runTransaction(ref(realtimeDb, `chatStoryViews/${story.authorId}/${story.id}/${user.uid}`), (current) => {
        alreadyViewed = Boolean(current);
        return current || {
          viewerId: user.uid,
          viewerName: profile?.displayName || user.displayName || 'Utilisateur AfriSell',
          viewedAt: Date.now()
        };
      });

      if (!alreadyViewed) {
        await runTransaction(ref(realtimeDb, `chatStories/${story.authorId}/${story.id}/viewsCount`), (current) => Number(current || 0) + 1);
      }
    } catch (viewError) {
      viewedStoriesRef.current.delete(viewKey);
      console.error('Comptage vue story impossible:', viewError);
    }
  };

  useEffect(() => {
    if (!activeStory) return;
    void registerStoryView(activeStory);
  // registerStoryView reads current auth/profile values; it is intentionally invoked on active story changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStory?.authorId, activeStory?.id]);

  useEffect(() => {
    if (!activeStory) return undefined;

    const duration = 15000;
    const startedAt = Date.now();
    setStoryProgress(0);

    const progressTimer = window.setInterval(() => {
      const nextProgress = Math.min(((Date.now() - startedAt) / duration) * 100, 100);
      setStoryProgress(nextProgress);
    }, 120);
    const nextTimer = window.setTimeout(() => {
      goToNextStory();
    }, duration);

    return () => {
      window.clearInterval(progressTimer);
      window.clearTimeout(nextTimer);
    };
  // Story progress restarts only when the active story identity changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStory?.authorId, activeStory?.id]);

  const sendStoryKiss = async (story: ChatStory) => {
    if (!user) {
      navigate('/login', { state: { next: '/chat' } });
      return;
    }

    playKissEffect();

    if (story.authorId === user.uid) return;

    try {
      const kissRef = push(ref(realtimeDb, `chatStoryKisses/${story.authorId}/${story.id}`));
      const contact: AfriChatContact = {
        id: story.authorId,
        displayName: story.authorName || 'Utilisateur AfriSell',
        avatarURL: story.authorAvatar,
        status: 'Story AfriChat'
      };
      const thread = await openDirectThread(contact);

      await update(ref(realtimeDb), {
        [`chatStoryKisses/${story.authorId}/${story.id}/${kissRef.key}`]: {
          id: kissRef.key,
          senderId: user.uid,
          senderName: profile?.displayName || user.displayName || 'Utilisateur AfriSell',
          createdAt: Date.now(),
          updatedAt: serverTimestamp()
        }
      });
      await runTransaction(ref(realtimeDb, `chatStories/${story.authorId}/${story.id}/kissesCount`), (current) => Number(current || 0) + 1);
      if (thread) {
        await sendMessage(thread, 'Bisous envoyé depuis ta story', { type: 'kiss' });
      }
    } catch (kissError) {
      console.error('Envoi bisous story impossible:', kissError);
    }
  };

  const submitStoryReply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !activeStory || storyReplySending) return;

    const replyText = storyReply.trim();
    if (!replyText) return;

    if (activeStory.authorId === user.uid) {
      setStoryReplyStatus('Tu ne peux pas répondre à ta propre story.');
      return;
    }

    setStoryReplySending(true);
    setStoryReplyStatus('');
    try {
      const contact: AfriChatContact = {
        id: activeStory.authorId,
        displayName: activeStory.authorName || 'Utilisateur AfriSell',
        avatarURL: activeStory.authorAvatar,
        status: 'Story AfriChat'
      };
      const thread = await openDirectThread(contact);
      if (!thread) throw new Error('Discussion introuvable.');

      await sendMessage(thread, `Réponse à ta story: ${replyText}`, { type: 'text' });
      setFallbackThread(thread);
      setActiveThreadId(thread.id);
      setActiveSpace('chat');
      setStoryReply('');
      closeStoryViewer();
      showActionStatus('Réponse envoyée dans la conversation.', 'success', true);
    } catch (replyError) {
      setStoryReplyStatus(getChatActionErrorMessage(replyError, 'Réponse story impossible.'));
    } finally {
      setStoryReplySending(false);
    }
  };

  useEffect(() => {
    if (!user) return undefined;

    const requestsRef = ref(realtimeDb, `chatContactRequests/${user.uid}`);
    const unsubscribe = onValue(requestsRef, (snapshot) => {
      const data = snapshot.val() as Record<string, Omit<ContactRequest, 'id'>> | null;
      const nextRequests = Object.entries(data || {})
        .map(([id, request]) => ({ ...request, id }))
        .filter((request) => request.status === 'pending')
        .sort((first, second) => Number(second.createdAt || 0) - Number(first.createdAt || 0));
      setIncomingRequests(nextRequests);
    });

    return () => {
      unsubscribe();
      off(requestsRef);
    };
  }, [user]);

  useEffect(() => () => {
    if (storyPreview) URL.revokeObjectURL(storyPreview);
  }, [storyPreview]);

  useEffect(() => () => {
    if (actionStatusTimerRef.current) {
      window.clearTimeout(actionStatusTimerRef.current);
    }
  }, []);

  useEffect(() => () => {
    stopQrScanner();
    if (voiceRecorderRef.current && voiceRecorderRef.current.state !== 'inactive') {
      voiceRecorderRef.current.stop();
    }
    stopVoiceStream();
  }, []);

  useEffect(() => {
    if (!activeThreadId) return undefined;

    const unsubscribe = watchThreadMessages(activeThreadId);
    markThreadRead(activeThreadId).catch((readError) => {
      console.error('Marquage lecture AfriChat impossible:', readError);
    });

    return unsubscribe;
  }, [activeThreadId]);

  useEffect(() => {
    const scrollTimer = window.setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
    }, 24);

    return () => window.clearTimeout(scrollTimer);
  }, [activeThreadId, messages.length]);

  const openThread = (thread: AfriChatThread) => {
    setFallbackThread(null);
    setActiveThreadId(thread.id);
  };

  const openContact = async (contact: AfriChatContact) => {
    if (!user) return;
    if (String(contact.status || '').toLowerCase().includes('demande')) {
      setContactsStatus('Cette discussion sera disponible quand la demande sera acceptée.');
      return;
    }

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
      clearActionStatus();
    } catch (contactError) {
      showActionStatus(getChatActionErrorMessage(contactError, 'Ouverture de la discussion impossible.'));
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

  useEffect(() => {
    if (!user) return;

    const params = new URLSearchParams(location.search);
    const villageId = params.get('village');
    if (!villageId) return;

    const routeKey = `${user.uid}:village:${villageId}`;
    if (contactRouteHandledRef.current === routeKey) return;

    const villageThread = threads.find((thread) => thread.id === villageId);
    if (!villageThread) {
      setActiveSpace('village');
      return;
    }

    contactRouteHandledRef.current = routeKey;
    setActiveSpace('village');
    openThread(villageThread);
  }, [location.search, threads, user?.uid]);

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
      setContactsStatus(nextContacts.length ? `${nextContacts.length} contact(s) importe(s).` : 'Aucun contact sélectionné.');
    } catch (contactError) {
      console.error('Import contacts appareil impossible:', contactError);
      setContactsStatus("Accès aux contacts annulé ou refusé par l'appareil.");
    } finally {
      setImportingContacts(false);
    }
  };

  const normalizeLookupValue = (value: string) => value.trim().toLowerCase();
  const normalizePhoneValue = (value: string) => value.replace(/[^\d+]/g, '');

  const extractContactIdentifier = (rawValue: string) => {
    const cleanValue = rawValue.trim();
    if (!cleanValue) return '';

    try {
      const url = new URL(cleanValue);
      const contact = url.searchParams.get('contact') || url.searchParams.get('user') || url.searchParams.get('uid');
      if (contact) return contact;
      const profileMatch = url.pathname.match(/\/u\/([^/]+)/);
      if (profileMatch?.[1]) return decodeURIComponent(profileMatch[1]);
    } catch {
      // Plain text QR payloads are supported below.
    }

    return cleanValue
      .replace(/^afrisell:(user|contact):/i, '')
      .replace(/^user:/i, '')
      .trim();
  };

  const findUserByIdentifier = async (identifier: string) => {
    const cleanIdentifier = extractContactIdentifier(identifier);
    if (!cleanIdentifier) return null;

    const directSnapshot = await get(ref(realtimeDb, `users/${cleanIdentifier}`));
    if (directSnapshot.exists()) {
      return { id: cleanIdentifier, profile: directSnapshot.val() as RawUserProfile };
    }

    const lookup = normalizeLookupValue(cleanIdentifier);
    const phoneLookup = normalizePhoneValue(cleanIdentifier);
    const usersSnapshot = await get(ref(realtimeDb, 'users'));
    const users = usersSnapshot.val() as Record<string, RawUserProfile> | null;
    const match = Object.entries(users || {}).find(([, candidate]) => {
      const email = normalizeLookupValue(candidate.email || '');
      const phone = normalizePhoneValue(candidate.phone || candidate.phoneLocal || '');
      return (
        Boolean(email && email === lookup) ||
        Boolean(phoneLookup && phone && phone.endsWith(phoneLookup.replace(/^\+/, ''))) ||
        Boolean(phoneLookup && phone === phoneLookup)
      );
    });

    return match ? { id: match[0], profile: match[1] } : null;
  };

  useEffect(() => {
    const cleanValue = manualContactValue.trim();
    if ((!showAddContactPanel && !showQrScanner) || cleanValue.length < 3) {
      setManualLookupResult(null);
      setManualLookupLoading(false);
      return undefined;
    }

    let active = true;
    setManualLookupLoading(true);
    const timer = window.setTimeout(() => {
      void findUserByIdentifier(cleanValue)
        .then((match) => {
          if (!active) return;
          setManualLookupResult(match);
        })
        .catch(() => {
          if (!active) return;
          setManualLookupResult(null);
        })
        .finally(() => {
          if (active) setManualLookupLoading(false);
        });
    }, 360);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [manualContactValue, showAddContactPanel, showQrScanner]);

  const requestChatContact = async (identifier: string, knownMatch?: ContactSearchResult | null) => {
    if (!user) return;
    const cleanIdentifier = extractContactIdentifier(identifier);
    if (!cleanIdentifier || addingContact) return;

    setAddingContact(true);
    setContactsStatus('');
    try {
      const match = knownMatch || await findUserByIdentifier(cleanIdentifier);
      if (!match) {
        setContactsStatus('Aucun utilisateur AfriSell trouvé avec cet identifiant.');
        return;
      }
      if (match.id === user.uid) {
        setContactsStatus("Tu ne peux pas t'ajouter toi-même.");
        return;
      }

      const displayName = match.profile.businessName || match.profile.displayName || 'Utilisateur AfriSell';
      const avatarURL = match.profile.logoURL || match.profile.photoURL || '';
      const currentUserName = profile?.displayName || user.displayName || 'Utilisateur AfriSell';
      const currentUserAvatar = profile?.photoURL || user.photoURL || '';
      const now = Date.now();
      const updates: Record<string, unknown> = {
        [`chatContactRequests/${match.id}/${user.uid}`]: {
          fromId: user.uid,
          fromName: currentUserName,
          fromAvatar: currentUserAvatar,
          fromEmail: profile?.email || user.email || '',
          fromPhone: profile?.phone || '',
          status: 'pending',
          createdAt: now,
          updatedAt: serverTimestamp()
        },
        [`chatContacts/${user.uid}/${match.id}`]: {
          id: match.id,
          displayName,
          avatarURL,
          status: 'Demande envoyée',
          requestStatus: 'pending',
          updatedAt: serverTimestamp()
        }
      };

      await update(ref(realtimeDb), updates);
      setManualContactValue('');
      setManualLookupResult(null);
      setShowAddContactPanel(false);
      setShowQrScanner(false);
      setContactsStatus('Demande envoyée. La discussion et les stories seront disponibles après acceptation.');
    } catch (addError) {
      setContactsStatus(getChatActionErrorMessage(addError, 'Ajout du contact impossible.'));
    } finally {
      setAddingContact(false);
    }
  };

  const inviteUserToActiveVillage = async () => {
    if (!user || !activeThread || activeThread.type !== 'village') return;
    const cleanIdentifier = extractContactIdentifier(villageInviteValue);
    if (!cleanIdentifier) {
      showActionStatus('Entre un email, un numéro ou un identifiant AfriSell.');
      return;
    }

    setVillageInviteLoading(true);
    clearActionStatus();
    try {
      const match = await findUserByIdentifier(cleanIdentifier);
      if (!match) {
        const inviteRef = push(ref(realtimeDb, `villageInvites/${activeThread.id}`));
        await set(inviteRef, {
          id: inviteRef.key,
          identifier: cleanIdentifier,
          invitedBy: user.uid,
          threadId: activeThread.id,
          productId: activeThread.productId || '',
          status: 'pending',
          createdAt: Date.now(),
          updatedAt: serverTimestamp()
        });
        setVillageInviteValue('');
        showActionStatus('Invitation enregistrée. Elle sera proposée dès que ce compte sera trouvé.', 'success', true);
        return;
      }

      if (match.id === user.uid) {
        showActionStatus("Tu es déjà membre de ce Village.");
        return;
      }

      const displayName = match.profile.businessName || match.profile.displayName || 'Utilisateur AfriSell';
      const avatarURL = match.profile.logoURL || match.profile.photoURL || '';
      const now = Date.now();
      const messageRef = push(ref(realtimeDb, `chatMessages/${activeThread.id}`));
      const messageId = messageRef.key || `invite_${now}`;
      const updates: Record<string, unknown> = {
        [`chatThreads/${activeThread.id}/members/${match.id}`]: true,
        [`chatThreads/${activeThread.id}/memberNames/${match.id}`]: displayName,
        [`userChats/${match.id}/${activeThread.id}`]: {
          threadId: activeThread.id,
          title: activeThread.title,
          avatarURL: activeThread.productImage || activeThread.avatarURL || '',
          type: 'village',
          status: 'Invitation Village',
          productId: activeThread.productId || '',
          productName: activeThread.productName || '',
          productImage: activeThread.productImage || activeThread.avatarURL || '',
          villagePrice: activeThread.villagePrice || 0,
          currency: activeThread.currency || 'USD',
          inviteLink: activeVillageInviteLink,
          lastMessage: `Invitation à rejoindre ${activeThread.title}.`,
          lastMessageAt: now,
          unreadCount: 1,
          updatedAt: serverTimestamp()
        },
        [`chatMessages/${activeThread.id}/${messageId}`]: {
          id: messageId,
          senderId: user.uid,
          text: `${displayName} a été invité dans le Village.`,
          type: 'system',
          createdAt: now,
          status: 'sent'
        }
      };

      if (activeThread.productId) {
        updates[`villageDeals/${activeThread.productId}/villages/${activeThread.id}/members/${match.id}`] = {
          uid: match.id,
          name: displayName,
          avatarURL,
          paymentStatus: 'invited',
          invitedBy: user.uid,
          joinedAt: now
        };
      }

      await update(ref(realtimeDb), updates);
      setVillageInviteValue('');
      showActionStatus(`${displayName} a été ajouté au Village.`, 'success', true);
    } catch (inviteError) {
      showActionStatus(getChatActionErrorMessage(inviteError, 'Invitation Village impossible.'));
    } finally {
      setVillageInviteLoading(false);
    }
  };

  const acceptContactRequest = async (request: ContactRequest) => {
    if (!user) return;

    const currentUserName = profile?.displayName || user.displayName || 'Utilisateur AfriSell';
    const currentUserAvatar = profile?.photoURL || user.photoURL || '';
    const updates: Record<string, unknown> = {
      [`chatContactRequests/${user.uid}/${request.fromId}/status`]: 'accepted',
      [`chatContactRequests/${user.uid}/${request.fromId}/acceptedAt`]: serverTimestamp(),
      [`chatContacts/${user.uid}/${request.fromId}`]: {
        id: request.fromId,
        displayName: request.fromName,
        avatarURL: request.fromAvatar || '',
        status: 'Contact AfriChat',
        requestStatus: 'accepted',
        updatedAt: serverTimestamp()
      },
      [`chatContacts/${request.fromId}/${user.uid}`]: {
        id: user.uid,
        displayName: currentUserName,
        avatarURL: currentUserAvatar,
        status: 'Contact AfriChat',
        requestStatus: 'accepted',
        updatedAt: serverTimestamp()
      }
    };

    try {
      await update(ref(realtimeDb), updates);
      setContactsStatus('Demande acceptée. Tu peux lancer la discussion.');
    } catch (acceptError) {
      setContactsStatus(getChatActionErrorMessage(acceptError, 'Acceptation impossible.'));
    }
  };

  const rejectContactRequest = async (request: ContactRequest) => {
    if (!user) return;
    try {
      await update(ref(realtimeDb), {
        [`chatContactRequests/${user.uid}/${request.fromId}/status`]: 'rejected',
        [`chatContactRequests/${user.uid}/${request.fromId}/rejectedAt`]: serverTimestamp()
      });
    } catch (rejectError) {
      setContactsStatus(getChatActionErrorMessage(rejectError, 'Refus impossible.'));
    }
  };

  const stopQrScanner = () => {
    if (qrScanTimerRef.current) {
      window.clearInterval(qrScanTimerRef.current);
      qrScanTimerRef.current = null;
    }
    qrStreamRef.current?.getTracks().forEach((track) => track.stop());
    qrStreamRef.current = null;
  };

  const startQrScanner = async () => {
    setShowQrScanner(true);
    setQrStatus('Ouverture caméra...');
    if (!navigator.mediaDevices?.getUserMedia) {
      setQrStatus('Caméra indisponible sur ce navigateur.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false
      });
      qrStreamRef.current = stream;
      if (qrVideoRef.current) {
        qrVideoRef.current.srcObject = stream;
        await qrVideoRef.current.play().catch(() => undefined);
      }

      const BarcodeDetector = (window as WindowWithBarcodeDetector).BarcodeDetector;
      if (!BarcodeDetector) {
        setQrStatus("Caméra active. Si le QR n'est pas détecté, colle le code manuellement.");
        return;
      }

      const detector = new BarcodeDetector({ formats: ['qr_code'] });
      setQrStatus('Place le QR AfriSell dans le cadre.');
      qrScanTimerRef.current = window.setInterval(() => {
        const video = qrVideoRef.current;
        if (!video || !video.videoWidth) return;

        void detector.detect(video).then((codes) => {
          const rawValue = codes[0]?.rawValue;
          if (!rawValue) return;
          stopQrScanner();
          setQrStatus('QR détecté.');
          void requestChatContact(rawValue);
        }).catch(() => undefined);
      }, 700);
    } catch {
      setQrStatus('Autorise la caméra pour scanner un QR utilisateur.');
    }
  };

  const handleStoryFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      setStoryStatus('Choisis une image ou une vidéo.');
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
      setStoryStatus('Cloudinary doit être configuré pour publier une story.');
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
    clearActionStatus();
    try {
      await sendMessage(activeThread, draft);
      setDraft('');
    } catch (messageError) {
      showActionStatus(getChatActionErrorMessage(messageError, 'Envoi du message impossible.'));
    } finally {
      setSending(false);
    }
  };

  const sendQuickMessage = async (type: AfriChatMessage['type'], text: string) => {
    if (!activeThread || sending) return;

    setSending(true);
    clearActionStatus();
    try {
      await sendMessage(activeThread, text, { type });
    } catch (messageError) {
      showActionStatus(getChatActionErrorMessage(messageError, 'Action AfriChat impossible.'));
    } finally {
      setSending(false);
    }
  };

  const sendVoiceClip = async (blob: Blob) => {
    if (!activeThread || !user) return;

    setAttaching(true);
    clearActionStatus();

    try {
      const mimeType = blob.type || 'audio/webm';
      const extension = mimeType.includes('mp4') || mimeType.includes('m4a') ? 'm4a' : 'webm';
      const file = new File([blob], `message-vocal-${Date.now()}.${extension}`, { type: mimeType });
      const audioUrl = file.size <= 1500 * 1024 ? await readFileAsDataUrl(file) : '';

      if (!audioUrl) {
        throw new Error('Message vocal trop long. Enregistre un vocal plus court.');
      }

      await sendMessage(activeThread, 'Message vocal', {
        type: 'audio',
        mediaUrl: audioUrl,
        fileName: file.name,
        mimeType
      });
      showActionStatus('Message vocal envoyé.', 'success', true);
    } catch (voiceError) {
      showActionStatus(getChatActionErrorMessage(voiceError, 'Envoi du message vocal impossible.'));
    } finally {
      setAttaching(false);
    }
  };

  const toggleVoiceRecording = async () => {
    if (recordingVoice) {
      const recorder = voiceRecorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.stop();
      }
      return;
    }

    if (!activeThread || attaching || sending) return;

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      showActionStatus('L’enregistrement vocal n’est pas disponible sur cet appareil.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      voiceChunksRef.current = [];
      voiceStreamRef.current = stream;
      voiceRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          voiceChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const clipType = recorder.mimeType || 'audio/webm';
        const clip = new Blob(voiceChunksRef.current, { type: clipType });
        voiceChunksRef.current = [];
        voiceRecorderRef.current = null;
        setRecordingVoice(false);
        stopVoiceStream();
        if (clip.size > 0) {
          void sendVoiceClip(clip);
        } else {
          showActionStatus('Aucun son détecté dans ce message vocal.');
        }
      };

      recorder.start();
      setRecordingVoice(true);
      showActionStatus('Enregistrement vocal en cours. Appuie encore sur le micro pour envoyer.', 'success');
    } catch (voiceError) {
      setRecordingVoice(false);
      stopVoiceStream();
      showActionStatus(getChatActionErrorMessage(voiceError, 'Micro inaccessible. Vérifie l’autorisation audio.'));
    }
  };

  const sendChatAttachment = async (file: File) => {
    if (!activeThread || !user || attaching) return;

    const isMedia = file.type.startsWith('image/') || file.type.startsWith('video/');
    setAttaching(true);
    clearActionStatus();

    try {
      if (isMedia) {
        const canUseLocalFallback = file.size <= 900 * 1024;
        const upload = isCloudinaryReady()
          ? await uploadMediaToCloudinary(file, user.uid)
          : null;
        const mediaUrl = upload?.mediaUrl || (canUseLocalFallback ? await readFileAsDataUrl(file) : '');
        if (!mediaUrl) {
          throw new Error('Fichier trop lourd pour l’envoi local. Active Cloudinary ou choisis un média plus léger.');
        }
        const messageType = (upload?.resourceType || (file.type.startsWith('video/') ? 'video' : 'image')) === 'video' ? 'video' : 'image';
        await sendMessage(
          activeThread,
          `${messageType === 'video' ? 'Vidéo' : 'Photo'}: ${file.name}`,
          {
            type: messageType,
            mediaUrl,
            fileName: file.name,
            mimeType: file.type
          }
        );
        showActionStatus('Média envoyé dans la conversation.', 'success', true);
        return;
      }

      const fileUrl = file.size <= 700 * 1024 ? await readFileAsDataUrl(file) : '';
      await sendMessage(activeThread, `Fichier: ${file.name}`, {
        type: 'file',
        mediaUrl: fileUrl,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream'
      });
      showActionStatus('Fichier ajouté à la conversation.', 'success', true);
    } catch (attachmentError) {
      showActionStatus(getChatActionErrorMessage(attachmentError, 'Envoi de la pièce jointe impossible.'));
    } finally {
      setAttaching(false);
    }
  };

  const handleChatAttachmentSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    event.target.value = '';
    if (!file) return;
    void sendChatAttachment(file);
  };

  const shareCurrentLocation = async () => {
    if (!activeThread || attaching) return;

    if (!navigator.geolocation) {
      showActionStatus('La position n’est pas disponible sur cet appareil.');
      return;
    }

    setAttaching(true);
    clearActionStatus();

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 60000
        });
      });
      const { latitude, longitude } = position.coords;
      const mapUrl = `https://maps.google.com/?q=${latitude},${longitude}`;
      await sendMessage(activeThread, `Position partagée: ${mapUrl}`, {
        type: 'location'
      });
      showActionStatus('Position envoyée.', 'success', true);
    } catch (locationError) {
      showActionStatus(getChatActionErrorMessage(locationError, 'Partage de position impossible.'));
    } finally {
      setAttaching(false);
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
        status: 'Groupe privé',
        nextSpace: 'kialanda' as ChatSpace
      },
      support: {
        title: 'Support AfriSell',
        status: 'Assistance',
        nextSpace: 'chat' as ChatSpace
      }
    }[type];

    setCreatingThread(type);
    clearActionStatus();
    try {
      const thread = await createCommunityThread(type, config.title, config.status);
      if (thread) {
        setFallbackThread(thread);
        setActiveThreadId(thread.id);
        setActiveSpace(config.nextSpace || 'chat');
      }
    } catch (threadError) {
      showActionStatus(getChatActionErrorMessage(threadError, 'Création de discussion impossible.'));
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

  const actionStatusClassName = cn(
    'mb-3 rounded-2xl border p-3 text-xs font-medium',
    actionStatusKind === 'success'
      ? 'border-[#15EA3E]/25 bg-[#15EA3E]/10 text-[#15EA3E]'
      : 'border-red-500/20 bg-red-500/10 text-red-200'
  );

  if (activeThread) {
    return (
      <div className="relative flex h-full min-h-0 flex-col bg-black">
        <KissEffectOverlay effectKey={kissEffectKey} />
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
          {isActiveVillage && (
            <section className="mb-4 overflow-hidden rounded-[1.6rem] border border-[#15EA3E]/22 bg-[#071007] shadow-[0_18px_44px_rgba(0,0,0,0.28)]">
              <div className="relative min-h-32 p-4">
                {(activeThread.productImage || activeThread.avatarURL) && (
                  <img src={activeThread.productImage || activeThread.avatarURL} alt="" className="absolute inset-0 h-full w-full object-cover opacity-22" />
                )}
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.86),rgba(0,0,0,0.5)),radial-gradient(circle_at_12%_20%,rgba(21,234,62,0.28),transparent_36%)]" />
                <div className="relative z-10 flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.25rem_0.75rem_1.25rem_0.75rem] bg-[#15EA3E] text-black">
                    <AfriSellIcon name="hub" size={21} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#15EA3E]">{activeThread.status || 'Village AfriSell'}</p>
                    <h2 className="mt-1 line-clamp-2 text-lg font-black leading-tight text-white">{activeThread.title}</h2>
                    <p className="mt-1 line-clamp-2 text-xs font-semibold leading-relaxed text-white/55">
                      {activeThread.productName || 'Espace collectif pour acheter, inviter, organiser et suivre les décisions du Village.'}
                    </p>
                  </div>
                </div>
                <div className="relative z-10 mt-4 grid grid-cols-3 gap-2">
                  {[
                    { label: 'Produit', value: activeThread.productName ? 'Lié' : 'Libre' },
                    { label: 'Accès', value: activeThread.visibility === 'public' ? 'Public' : 'Privé' },
                    { label: 'Prix', value: activeThread.villagePrice ? `${Number(activeThread.villagePrice).toLocaleString('fr-FR')} ${activeThread.currency || 'USD'}` : 'Village' }
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-white/10 bg-black/28 p-2 text-center">
                      <p className="truncate text-[10px] font-black text-white">{item.value}</p>
                      <p className="mt-0.5 text-[8px] font-black uppercase tracking-wider text-white/38">{item.label}</p>
                    </div>
                  ))}
                </div>
                <div className="relative z-10 mt-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/24 p-2">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(activeVillageInviteLink)}`}
                    alt="QR Village"
                    className="h-14 w-14 shrink-0 rounded-xl bg-white p-1"
                  />
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-wider text-white/58">Invitation QR</p>
                    <p className="mt-0.5 line-clamp-2 text-[10px] font-semibold text-white/38">Scanne ou partage le lien pour rejoindre ce Village.</p>
                  </div>
                </div>
              </div>
              <div className="border-t border-white/10 p-3">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => activeThread.productId ? navigate(`/market/${activeThread.productId}`) : navigate('/market')}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] py-3 text-[10px] font-black uppercase tracking-wider text-white/70"
                  >
                    Produit
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(activeThread.productId ? `/wallet?action=transfer&product=${encodeURIComponent(activeThread.productId)}` : '/wallet?action=transfer')}
                    className="rounded-2xl bg-[#15EA3E] py-3 text-[10px] font-black uppercase tracking-wider text-black"
                  >
                    Payer
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(activeVillageInviteLink);
                      showActionStatus('Lien du Village copié.', 'success', true);
                    }}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] py-3 text-[10px] font-black uppercase tracking-wider text-white/70"
                  >
                    Lien
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowConversationPanel(true)}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] py-3 text-[10px] font-black uppercase tracking-wider text-white/70"
                  >
                    Gérer
                  </button>
                </div>
                <div className="mt-3 flex gap-2">
                  <input
                    value={villageInviteValue}
                    onChange={(event) => setVillageInviteValue(event.target.value)}
                    placeholder="Ajouter par email ou numéro"
                    className="h-11 min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/35 px-3 text-xs font-semibold text-white outline-none focus:border-[#15EA3E]/45"
                  />
                  <button
                    type="button"
                    onClick={() => void inviteUserToActiveVillage()}
                    disabled={villageInviteLoading}
                    className="h-11 rounded-2xl bg-[#15EA3E] px-4 text-[10px] font-black uppercase tracking-wider text-black disabled:bg-gray-800 disabled:text-gray-500"
                  >
                    {villageInviteLoading ? '...' : 'Ajouter'}
                  </button>
                </div>
              </div>
            </section>
          )}
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
            <div className={actionStatusClassName}>
              {actionStatus}
            </div>
          )}
          {messages.length ? (
            <div className="flex flex-col gap-3">
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isMine={message.senderId === user?.uid}
                  onOpenKiss={playKissEffect}
                />
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
          <input
            ref={chatCameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleChatAttachmentSelect}
            className="hidden"
          />
          <input
            ref={chatGalleryInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={handleChatAttachmentSelect}
            className="hidden"
          />
          <input
            ref={chatFileInputRef}
            type="file"
            onChange={handleChatAttachmentSelect}
            className="hidden"
          />
          <div className="flex items-center justify-between px-1">
            <button
              type="button"
              onClick={translateDraft}
              className={cn('flex items-center gap-1.5', translationEnabled ? 'text-[#15EA3E]' : 'text-gray-500')}
            >
              <AfriSellIcon name="language" size={13} />
              <span className="text-[10px] font-bold uppercase tracking-wider">{translationEnabled ? 'Traduction active' : 'Traduction'}</span>
            </button>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-700">
              {attaching ? 'Envoi en cours...' : 'AfriChat'}
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[
              { label: 'Caméra', icon: 'camera' as AfriSellIconName, onClick: () => chatCameraInputRef.current?.click() },
              { label: 'Galerie', icon: 'gallery' as AfriSellIconName, onClick: () => chatGalleryInputRef.current?.click() },
              { label: 'Fichier', icon: 'file' as AfriSellIconName, onClick: () => chatFileInputRef.current?.click() },
              { label: 'Contact', icon: 'contact' as AfriSellIconName, onClick: () => setShowAddContactPanel(true) },
              { label: 'Position', icon: 'location' as AfriSellIconName, onClick: () => void shareCurrentLocation() }
            ].map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={action.onClick}
                disabled={attaching}
                className="flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-black text-white/70 transition-colors hover:border-[#15EA3E]/30 hover:text-[#15EA3E] disabled:opacity-45"
              >
                <AfriSellIcon name={action.icon} size={14} />
                {action.label}
              </button>
            ))}
          </div>
          <div className="flex items-end gap-2">
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
              type="button"
              onClick={() => void toggleVoiceRecording()}
              disabled={attaching || sending}
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-45',
                recordingVoice
                  ? 'border-red-400/50 bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.3)]'
                  : 'border-white/10 bg-white/[0.055] text-[#15EA3E] hover:border-[#15EA3E]/35'
              )}
              aria-label={recordingVoice ? 'Arrêter et envoyer le vocal' : 'Enregistrer un message vocal'}
            >
              <AfriSellIcon name={recordingVoice ? 'close' : 'mic'} size={18} />
            </button>
            <button
              type="submit"
              disabled={!draft.trim() || sending || attaching}
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
                {isActiveVillage && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard?.writeText(activeVillageInviteLink);
                        setShowConversationPanel(false);
                        showActionStatus('Lien du Village copié.', 'success', true);
                      }}
                      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left"
                    >
                      <AfriSellIcon name="share" size={17} className="text-[#15EA3E]" />
                      <span className="text-xs font-black text-white">Copier le lien du Village</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowConversationPanel(false);
                        setShowAddContactPanel(true);
                      }}
                      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left"
                    >
                      <AfriSellIcon name="contact" size={17} className="text-[#15EA3E]" />
                      <span className="text-xs font-black text-white">Ajouter un membre</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowConversationPanel(false);
                        navigate(activeThread.productId ? `/market/${activeThread.productId}` : '/market');
                      }}
                      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left"
                    >
                      <AfriSellIcon name="market" size={17} className="text-[#15EA3E]" />
                      <span className="text-xs font-black text-white">Voir le produit du Village</span>
                    </button>
                  </>
                )}
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
                  onClick={() => showActionStatus(isActiveVillage ? 'Gestion du Village disponible dans le panneau et les actions rapides.' : 'Gestion avancée de la conversation en préparation.', 'success', true)}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left"
                >
                  <AfriSellIcon name="shield" size={17} className="text-[#15EA3E]" />
                  <span className="text-xs font-black text-white">Gérer la conversation</span>
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
        {showAddContactPanel && (
          <div className="absolute inset-0 z-50 flex items-end bg-black/55 backdrop-blur-sm">
            <section className="w-full rounded-t-[2rem] border-t border-white/10 bg-[#050505] p-5 shadow-[0_-24px_60px_rgba(0,0,0,0.5)]">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#15EA3E]">Nouveau contact</p>
                  <h2 className="mt-1 text-lg font-black text-white">Ajouter à AfriChat</h2>
                </div>
                <button type="button" onClick={() => setShowAddContactPanel(false)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-white/55">
                  <AfriSellIcon name="close" size={14} />
                </button>
              </div>
              <label className="flex h-12 items-center gap-3 rounded-2xl border border-white/10 bg-black/35 px-3">
                <AfriSellIcon name="mail" size={16} className="text-white/35" />
                <input
                  value={manualContactValue}
                  onChange={(event) => setManualContactValue(event.target.value)}
                  placeholder="Email, numéro ou code QR AfriSell"
                  className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-white outline-none placeholder:text-white/28"
                />
              </label>
              {manualLookupLoading && (
                <p className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white/45">
                  Recherche dans AfriSell...
                </p>
              )}
              {manualLookupResult && (
                <div className="mt-3 rounded-[1.35rem] border border-[#15EA3E]/20 bg-[#071007] p-3">
                  <div className="flex items-center gap-3">
                    <Avatar
                      title={manualLookupResult.profile.businessName || manualLookupResult.profile.displayName || 'Utilisateur AfriSell'}
                      src={manualLookupResult.profile.logoURL || manualLookupResult.profile.photoURL}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-white">
                        {manualLookupResult.profile.businessName || manualLookupResult.profile.displayName || 'Utilisateur AfriSell'}
                      </p>
                      <p className="mt-1 truncate text-[10px] font-semibold text-white/45">
                        {manualLookupResult.profile.email || manualLookupResult.profile.phone || 'Profil AfriSell'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {contactsStatus && (
                <p className={cn(
                  'mt-3 rounded-2xl border px-3 py-2 text-[10px] font-semibold leading-relaxed',
                  contactsStatus.includes('impossible') || contactsStatus.includes('Aucun') || contactsStatus.includes('peux pas')
                    ? 'border-red-500/20 bg-red-500/10 text-red-100'
                    : 'border-[#15EA3E]/20 bg-[#15EA3E]/10 text-[#15EA3E]'
                )}>
                  {contactsStatus}
                </p>
              )}
              <button
                type="button"
                onClick={() => void requestChatContact(manualContactValue, manualLookupResult)}
                disabled={addingContact || !manualLookupResult || manualLookupResult.id === user?.uid}
                className="mt-4 w-full rounded-2xl bg-[#15EA3E] py-3 text-[10px] font-black uppercase tracking-wider text-black disabled:bg-gray-800 disabled:text-gray-500"
              >
                {addingContact ? 'Envoi...' : 'Envoyer la demande'}
              </button>
            </section>
          </div>
        )}
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
          <div className={actionStatusClassName}>
            {actionStatus}
          </div>
        )}

        {activeSpace === 'chat' && (
          <div className="space-y-3">
            <div className="rounded-[1.35rem] border border-white/10 bg-[#050505] p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#15EA3E] text-black">
                  <AfriSellIcon name="plus" size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black text-white">Ajouter un utilisateur</p>
                  <p className="mt-0.5 text-[10px] font-semibold leading-relaxed text-gray-500">Scanne un QR ou ajoute un email/numéro AfriSell.</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => void startQrScanner()}
                  className="rounded-2xl border border-[#15EA3E]/25 bg-[#15EA3E]/10 py-3 text-[10px] font-black uppercase tracking-wider text-[#15EA3E]"
                >
                  Scanner QR
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddContactPanel(true)}
                  className="rounded-2xl border border-white/10 bg-white/[0.05] py-3 text-[10px] font-black uppercase tracking-wider text-white/70"
                >
                  Ajouter manuel
                </button>
              </div>
            </div>

            {incomingRequests.length > 0 && (
              <div className="space-y-2 rounded-[1.35rem] border border-[#15EA3E]/18 bg-[#071007] p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#15EA3E]">Demandes reçues</p>
                {incomingRequests.map((request) => (
                  <div key={request.id} className="rounded-2xl border border-white/10 bg-black/24 p-3">
                    <div className="flex items-center gap-3">
                      <Avatar title={request.fromName} src={request.fromAvatar} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-black text-white">{request.fromName}</p>
                        <p className="mt-0.5 truncate text-[10px] font-semibold text-white/42">{request.fromEmail || request.fromPhone || 'Demande AfriChat'}</p>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => void acceptContactRequest(request)} className="rounded-xl bg-[#15EA3E] py-2 text-[10px] font-black uppercase tracking-wider text-black">
                        Accepter
                      </button>
                      <button type="button" onClick={() => void rejectContactRequest(request)} className="rounded-xl border border-white/10 bg-white/[0.05] py-2 text-[10px] font-black uppercase tracking-wider text-white/55">
                        Refuser
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-[1.35rem] border border-[#15EA3E]/18 bg-[#071007] p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#15EA3E]/12 text-[#15EA3E]">
                  <AfriSellIcon name="profile" size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black text-white">Contacts de l'appareil</p>
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
              <EmptyState icon="chat" title="Aucune discussion" body="Tes conversations apparaîtront ici dès qu'elles seront créées." />
            )}
            {filteredContacts.length > 0 && (
              <div className="space-y-2">
                <p className="px-1 text-[10px] font-black uppercase tracking-[0.2em] text-white/35">Contacts</p>
                {filteredContacts.slice(0, 4).map((contact) => (
                  <ContactRow
                    key={contact.id}
                    contact={contact}
                    disabled={String(contact.status || '').toLowerCase().includes('demande')}
                    onOpen={() => openContact(contact)}
                  />
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
                  <p className="mt-0.5 text-[10px] font-semibold leading-relaxed text-white/55">Groupes privés pour echanger comme une vraie table de discussion.</p>
                </div>
                <button
                  type="button"
                  onClick={() => void createThread('kyaghanda')}
                  disabled={Boolean(creatingThread)}
                  className="rounded-xl bg-[#15EA3E] px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-black disabled:bg-gray-800 disabled:text-gray-500"
                >
                  {creatingThread === 'kyaghanda' ? '...' : 'Créer'}
                </button>
              </div>
            </div>
            {filteredKialandaThreads.length ? (
              filteredKialandaThreads.map((thread) => (
                <ThreadRow key={thread.id} thread={thread} active={thread.id === activeThreadId} onOpen={() => openThread(thread)} />
              ))
            ) : (
              <EmptyState icon="profile" title="Aucun Kialanda" body="Cree un groupé pour tes proches, partenaires ou equipes." />
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
                <p className="mt-1 text-xs font-semibold leading-relaxed text-gray-500">Les chaînes officielles, boutiques, créateurs et services apparaîtront ici.</p>
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
                { label: 'Village privé', status: 'Acces restreint', body: 'Communauté fermee sur invitation.' },
                { label: 'Village d achat', status: 'Acheteurs groupés', body: 'Cree par les acheteurs pour negocier ensemble.' },
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
              <EmptyState icon="hub" title="Aucun Village" body="Tes communautés privées, achats groupés et villages business apparaîtront ici." />
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
            {visibleStories.length ? (
              <div className="scrollbar-hide flex gap-3 overflow-x-auto pb-1">
                {visibleStories.map((story) => (
                  <button
                    key={story.id}
                    type="button"
                    onClick={() => openStoryViewer(story)}
                    className="relative h-48 w-32 shrink-0 overflow-hidden rounded-[1.35rem] border border-white/10 bg-[#050505] text-left active:scale-[0.98]"
                  >
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
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState icon="video" title="Aucune story" body="Les stories de tes contacts acceptés seront affichées ici." />
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
      {showAddContactPanel && (
        <div className="absolute inset-0 z-50 flex items-end bg-black/55 backdrop-blur-sm">
          <section className="w-full rounded-t-[2rem] border-t border-white/10 bg-[#050505] p-5 shadow-[0_-24px_60px_rgba(0,0,0,0.5)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#15EA3E]">Nouveau contact</p>
                <h2 className="mt-1 text-lg font-black text-white">Ajouter hors contacts</h2>
              </div>
              <button type="button" onClick={() => setShowAddContactPanel(false)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-white/55">
                <AfriSellIcon name="close" size={14} />
              </button>
            </div>
            <label className="flex h-12 items-center gap-3 rounded-2xl border border-white/10 bg-black/35 px-3">
              <AfriSellIcon name="mail" size={16} className="text-white/35" />
              <input
                value={manualContactValue}
                onChange={(event) => setManualContactValue(event.target.value)}
                placeholder="Email, numéro ou code QR AfriSell"
                className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-white outline-none placeholder:text-white/28"
              />
            </label>
            <p className="mt-2 text-[10px] font-semibold leading-relaxed text-white/42">
              Une demande sera envoyée. La discussion et les stories seront accessibles après acceptation.
            </p>
            {manualLookupLoading && (
              <p className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white/45">
                Recherche dans AfriSell...
              </p>
            )}
            {!manualLookupLoading && manualContactValue.trim().length >= 3 && !manualLookupResult && (
              <p className="mt-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-[10px] font-semibold leading-relaxed text-red-100">
                Aucun utilisateur trouvé pour cette saisie.
              </p>
            )}
            {manualLookupResult && (
              <div className="mt-3 rounded-[1.35rem] border border-[#15EA3E]/20 bg-[#071007] p-3">
                <div className="flex items-center gap-3">
                  <Avatar
                    title={manualLookupResult.profile.businessName || manualLookupResult.profile.displayName || 'Utilisateur AfriSell'}
                    src={manualLookupResult.profile.logoURL || manualLookupResult.profile.photoURL}
                    size="lg"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-white">
                      {manualLookupResult.profile.businessName || manualLookupResult.profile.displayName || 'Utilisateur AfriSell'}
                    </p>
                    <p className="mt-1 truncate text-[10px] font-semibold text-white/45">
                      {[manualLookupResult.profile.city, manualLookupResult.profile.country].filter(Boolean).join(', ') || manualLookupResult.profile.email || manualLookupResult.profile.phone || 'Profil AfriSell'}
                    </p>
                    {manualLookupResult.id === user?.uid && (
                      <p className="mt-1 text-[9px] font-black uppercase tracking-wider text-[#15EA3E]">C&apos;est ton compte</p>
                    )}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => navigate(`/u/${manualLookupResult.id}`)}
                    className="rounded-xl border border-white/10 bg-white/[0.05] py-2 text-[10px] font-black uppercase tracking-wider text-white/70"
                  >
                    Voir profil
                  </button>
                  <button
                    type="button"
                    onClick={() => void requestChatContact(manualContactValue, manualLookupResult)}
                    disabled={addingContact || manualLookupResult.id === user?.uid}
                    className="rounded-xl bg-[#15EA3E] py-2 text-[10px] font-black uppercase tracking-wider text-black disabled:bg-gray-800 disabled:text-gray-500"
                  >
                    {addingContact ? 'Envoi...' : 'Demander'}
                  </button>
                </div>
              </div>
            )}
            {contactsStatus && (
              <p className={cn(
                'mt-3 rounded-2xl border px-3 py-2 text-[10px] font-semibold leading-relaxed',
                contactsStatus.includes('impossible') || contactsStatus.includes('Aucun') || contactsStatus.includes('peux pas')
                  ? 'border-red-500/20 bg-red-500/10 text-red-100'
                  : 'border-[#15EA3E]/20 bg-[#15EA3E]/10 text-[#15EA3E]'
              )}>
                {contactsStatus}
              </p>
            )}
            <button
              type="button"
              onClick={() => void requestChatContact(manualContactValue, manualLookupResult)}
              disabled={addingContact || !manualLookupResult || manualLookupResult.id === user?.uid}
              className="mt-4 w-full rounded-2xl bg-[#15EA3E] py-3 text-[10px] font-black uppercase tracking-wider text-black disabled:bg-gray-800 disabled:text-gray-500"
            >
              {addingContact ? 'Envoi...' : 'Envoyer la demande'}
            </button>
          </section>
        </div>
      )}
      {activeStory && (
        <div className="absolute inset-0 z-[70] flex flex-col bg-black">
          <div className="absolute inset-x-4 top-2 z-20 h-1 overflow-hidden rounded-full bg-white/18">
            <div className="h-full rounded-full bg-[#15EA3E] shadow-[0_0_18px_rgba(21,234,62,0.7)]" style={{ width: `${storyProgress}%` }} />
          </div>
          <div className="absolute inset-0">
            {activeStory.resourceType === 'video' ? (
              <video src={activeStory.mediaUrl} controls autoPlay playsInline className="h-full w-full object-contain" />
            ) : (
              <img src={activeStory.mediaUrl} alt={activeStory.caption || activeStory.authorName} className="h-full w-full object-contain" />
            )}
          </div>
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.82),transparent_28%,transparent_62%,rgba(0,0,0,0.88))]" />
          <KissEffectOverlay effectKey={kissEffectKey} />
          <header className="relative z-10 flex items-center justify-between px-4 pt-5">
            <button
              type="button"
              onClick={closeStoryViewer}
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-black/50 text-white backdrop-blur"
              aria-label="Fermer la story"
            >
              <AfriSellIcon name="close" size={16} />
            </button>
            <div className="min-w-0 flex flex-1 items-center gap-3 px-3">
              <Avatar title={activeStory.authorName} src={activeStory.authorAvatar} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-white">{activeStory.authorName}</p>
                <p className="mt-0.5 text-[10px] font-semibold text-white/45">{formatChatTime(activeStory.createdAt)}</p>
              </div>
            </div>
            <a
              href={activeStory.mediaUrl}
              download={`africhat-story-${activeStory.id}.${activeStory.resourceType === 'video' ? 'mp4' : 'jpg'}`}
              target="_blank"
              rel="noreferrer"
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#15EA3E]/30 bg-[#15EA3E]/15 text-[#15EA3E] backdrop-blur"
              aria-label="Télécharger la story"
            >
              <AfriSellIcon name="clip" size={16} />
            </a>
          </header>
          <div className="relative z-10 mt-auto px-4 pb-7">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/42 px-3 py-2 text-[10px] font-black text-white/70 backdrop-blur">
                <AfriSellIcon name="eye" size={14} className="text-[#15EA3E]" />
                <span>{activeStory.viewsCount || 0} vue{Number(activeStory.viewsCount || 0) > 1 ? 's' : ''}</span>
              </div>
              <button
                type="button"
                onClick={() => void sendStoryKiss(activeStory)}
                className="flex items-center gap-2 rounded-2xl border border-[#15EA3E]/35 bg-[#15EA3E]/18 px-3 py-2 text-[10px] font-black text-[#15EA3E] backdrop-blur active:scale-[0.96]"
              >
                <AfriSellIcon name="kiss" size={16} />
                <span>{activeStory.authorId === user?.uid ? 'Ouvrir bisous' : 'Bisous'} · {activeStory.kissesCount || 0}</span>
              </button>
            </div>
            {activeStory.caption && (
              <p className="rounded-2xl border border-white/10 bg-black/42 px-4 py-3 text-sm font-semibold leading-relaxed text-white backdrop-blur">
                {activeStory.caption}
              </p>
            )}
            <form onSubmit={submitStoryReply} className="mt-3 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/55 p-2 backdrop-blur">
              <input
                value={storyReply}
                onChange={(event) => {
                  setStoryReply(event.target.value);
                  if (storyReplyStatus) setStoryReplyStatus('');
                }}
                disabled={activeStory.authorId === user?.uid || storyReplySending}
                placeholder={activeStory.authorId === user?.uid ? 'Ta story' : 'Répondre à la story...'}
                className="h-10 min-w-0 flex-1 bg-transparent px-2 text-xs font-semibold text-white outline-none placeholder:text-white/35 disabled:text-white/35"
              />
              <button
                type="submit"
                disabled={!storyReply.trim() || activeStory.authorId === user?.uid || storyReplySending}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#15EA3E] text-black disabled:bg-gray-800 disabled:text-gray-500"
                aria-label="Envoyer la réponse"
              >
                <AfriSellIcon name="send" size={15} />
              </button>
            </form>
            {storyReplyStatus && (
              <p className="mt-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-[10px] font-semibold text-red-100">
                {storyReplyStatus}
              </p>
            )}
          </div>
        </div>
      )}
      {showQrScanner && (
        <div className="absolute inset-0 z-50 flex flex-col bg-black">
          <video ref={qrVideoRef} muted playsInline className="absolute inset-0 h-full w-full object-cover opacity-80" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.78),transparent_34%,rgba(0,0,0,0.92))]" />
          <header className="relative z-10 flex items-center justify-between px-4 pt-5">
            <button
              type="button"
              onClick={() => {
                stopQrScanner();
                setShowQrScanner(false);
              }}
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-black/45 text-white backdrop-blur"
            >
              <AfriSellIcon name="close" size={16} />
            </button>
            <div className="text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#15EA3E]">AfriChat</p>
              <h2 className="text-sm font-black">Scanner utilisateur</h2>
            </div>
            <div className="h-10 w-10" />
          </header>
          <section className="relative z-10 flex flex-1 items-center justify-center px-8">
            <div className="relative h-64 w-64 rounded-[2rem] border-2 border-[#15EA3E] shadow-[0_0_45px_rgba(21,234,62,0.22)]">
              <div className="absolute left-6 right-6 top-1/2 h-0.5 bg-[#15EA3E] shadow-[0_0_18px_rgba(21,234,62,0.9)]" />
              <div className="absolute -left-1 -top-1 h-10 w-10 rounded-tl-[2rem] border-l-4 border-t-4 border-white" />
              <div className="absolute -right-1 -top-1 h-10 w-10 rounded-tr-[2rem] border-r-4 border-t-4 border-white" />
              <div className="absolute -bottom-1 -left-1 h-10 w-10 rounded-bl-[2rem] border-b-4 border-l-4 border-white" />
              <div className="absolute -bottom-1 -right-1 h-10 w-10 rounded-br-[2rem] border-b-4 border-r-4 border-white" />
              <AfriSellIcon name="scan" size={34} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/30" />
            </div>
          </section>
          <section className="relative z-10 rounded-t-[2rem] border-t border-white/10 bg-[#050705]/95 p-5 pb-8 backdrop-blur">
            <p className="text-center text-xs font-bold text-white/62">{qrStatus}</p>
            {manualLookupResult && (
              <div className="mt-4 rounded-2xl border border-[#15EA3E]/20 bg-[#071007] p-3">
                <div className="flex items-center gap-3">
                  <Avatar
                    title={manualLookupResult.profile.businessName || manualLookupResult.profile.displayName || 'Utilisateur AfriSell'}
                    src={manualLookupResult.profile.logoURL || manualLookupResult.profile.photoURL}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-black text-white">{manualLookupResult.profile.businessName || manualLookupResult.profile.displayName || 'Utilisateur AfriSell'}</p>
                    <p className="mt-0.5 truncate text-[10px] font-semibold text-white/42">{manualLookupResult.profile.email || manualLookupResult.profile.phone || 'Profil AfriSell'}</p>
                  </div>
                  <button type="button" onClick={() => navigate(`/u/${manualLookupResult.id}`)} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-[9px] font-black uppercase tracking-wider text-white/70">
                    Profil
                  </button>
                </div>
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <label className="flex h-12 flex-1 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3">
                <AfriSellIcon name="keyboard" size={16} className="text-white/35" />
                <input
                  value={manualContactValue}
                  onChange={(event) => setManualContactValue(event.target.value)}
                  placeholder="Coller le code"
                  className="w-full bg-transparent text-xs font-bold text-white outline-none placeholder:text-white/28"
                />
              </label>
              <button onClick={() => void requestChatContact(manualContactValue, manualLookupResult)} disabled={addingContact || !manualLookupResult} className="h-12 rounded-2xl bg-[#15EA3E] px-4 text-xs font-black uppercase tracking-[0.12em] text-black disabled:bg-gray-800 disabled:text-gray-500">
                Demander
              </button>
            </div>
            {contactsStatus && (
              <p className="mt-3 rounded-xl border border-white/10 bg-black/30 p-2 text-[10px] font-semibold leading-relaxed text-white/55">
                {contactsStatus}
              </p>
            )}
          </section>
        </div>
      )}
      {showChatSettings && <ChatSettingsSheet onClose={() => setShowChatSettings(false)} />}
    </div>
  );
}
