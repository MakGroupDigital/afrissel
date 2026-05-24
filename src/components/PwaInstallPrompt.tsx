import { useEffect, useMemo, useState } from 'react';
import { AfriSellIcon } from './AfriSellIcon';
import { cn } from '../lib/utils';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const SNOOZE_KEY = 'afrisell:pwa-install-snooze-until';
const NOTIFICATION_READY_KEY = 'afrisell:notifications-ready';

const isStandaloneApp = () => {
  if (typeof window === 'undefined') return false;

  return window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in window.navigator && Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone));
};

const isIOSDevice = () => {
  if (typeof window === 'undefined') return false;
  return /iPhone|iPad|iPod/i.test(window.navigator.userAgent);
};

const getNotificationPermission = () => {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
};

export default function PwaInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [installed, setInstalled] = useState(isStandaloneApp());
  const [notificationPermission, setNotificationPermission] = useState(getNotificationPermission());
  const [busy, setBusy] = useState(false);
  const isIOS = useMemo(() => isIOSDevice(), []);
  const canInstallWithPrompt = Boolean(installPrompt);
  const notificationsEnabled = notificationPermission === 'granted';
  const notificationsUnsupported = notificationPermission === 'unsupported';

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setInstalled(isStandaloneApp());
      setVisible(true);
    };

    const handleInstalled = () => {
      setInstalled(true);
      setVisible(false);
      setInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    const snoozeUntil = Number(window.localStorage.getItem(SNOOZE_KEY) || 0);
    const shouldShow = Date.now() > snoozeUntil && (!isStandaloneApp() || (!notificationsEnabled && !notificationsUnsupported));
    const timer = window.setTimeout(() => {
      if (shouldShow) setVisible(true);
    }, 1400);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, [notificationPermission, notificationsEnabled, notificationsUnsupported]);

  const requestInstall = async () => {
    if (!installPrompt) {
      setVisible(true);
      return;
    }

    setBusy(true);
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setInstalled(true);
        setVisible(false);
      }
      setInstallPrompt(null);
    } finally {
      setBusy(false);
    }
  };

  const requestNotifications = async () => {
    if (!('Notification' in window)) {
      setNotificationPermission('unsupported');
      return;
    }

    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);

      if (permission === 'granted') {
        window.localStorage.setItem(NOTIFICATION_READY_KEY, '1');
        if ('serviceWorker' in navigator) {
          await navigator.serviceWorker.ready;
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const snooze = () => {
    window.localStorage.setItem(SNOOZE_KEY, String(Date.now() + 8 * 60 * 60 * 1000));
    setVisible(false);
  };

  if (!visible || (installed && notificationsEnabled)) {
    return null;
  }

  return (
    <div className="absolute inset-x-3 bottom-24 z-[70] overflow-hidden rounded-[1.5rem] border border-[#15EA3E]/25 bg-[#071007]/95 p-4 text-white shadow-[0_18px_46px_rgba(0,0,0,0.55),0_0_34px_rgba(21,234,62,0.10)] backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(21,234,62,0.22),transparent_34%)]" />
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#15EA3E] text-black">
              <AfriSellIcon name="app" size={20} />
            </div>
            <div>
              <p className="text-sm font-black">{isIOS ? 'Installer AfriSell' : 'Telecharger AfriSell'}</p>
              <p className="mt-1 text-[11px] font-semibold leading-relaxed text-white/56">
                {isIOS
                  ? 'Ajoute l app a ton ecran et active les alertes en temps reel.'
                  : 'Installe l app sur cet appareil et active les alertes en temps reel.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={snooze}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/48"
            aria-label="Fermer"
          >
            <AfriSellIcon name="close" size={15} />
          </button>
        </div>

        {!installed && (
          <div className="mt-4">
            {!isIOS ? (
              <button
                type="button"
                onClick={requestInstall}
                disabled={busy || !canInstallWithPrompt}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#15EA3E] text-xs font-black uppercase tracking-[0.14em] text-black disabled:opacity-60"
              >
                Telecharger
                <AfriSellIcon name="arrow" size={16} />
              </button>
            ) : canInstallWithPrompt ? (
              <button
                type="button"
                onClick={requestInstall}
                disabled={busy}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#15EA3E] text-xs font-black uppercase tracking-[0.14em] text-black disabled:opacity-60"
              >
                Telecharger
                <AfriSellIcon name="arrow" size={16} />
              </button>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#15EA3E]">iPhone</p>
                <div className="mt-3 grid gap-2 text-[11px] font-semibold leading-relaxed text-white/64">
                  {[
                    'Ouvre le menu du navigateur, les 3 points en bas ou en haut selon ton telephone.',
                    'Appuie sur Partager, puis Plus si l option n apparait pas.',
                    'Choisis Ajouter a l ecran d accueil, puis confirme.'
                  ].map((step, index) => (
                    <div key={step} className="flex items-start gap-2">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#15EA3E] text-[10px] font-black text-black">
                        {index + 1}
                      </span>
                      <span>{step}</span>
                      {index < 2 && <AfriSellIcon name="arrow" size={13} className="mt-1 shrink-0 text-[#15EA3E]" />}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 p-3">
          <div className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
            notificationsEnabled ? 'bg-[#15EA3E] text-black' : 'bg-white/[0.05] text-[#15EA3E]'
          )}>
            <AfriSellIcon name={notificationsEnabled ? 'check' : 'notifications'} size={17} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black">Notifications</p>
            <p className="mt-0.5 text-[10px] font-semibold text-white/44">
              {notificationsEnabled
                ? 'Alertes activees sur cet appareil.'
                : notificationsUnsupported
                  ? 'Ce navigateur ne gere pas les notifications.'
                  : 'Active les alertes pour messages, commandes et paiements.'}
            </p>
          </div>
          {!notificationsEnabled && !notificationsUnsupported && (
            <button
              type="button"
              onClick={requestNotifications}
              disabled={busy}
              className="shrink-0 rounded-xl bg-white px-3 py-2 text-[10px] font-black uppercase tracking-wider text-black disabled:opacity-60"
            >
              Activer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
