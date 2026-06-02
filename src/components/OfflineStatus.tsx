import { useEffect, useState } from 'react';
import { AfriSellIcon } from './AfriSellIcon';
import { getQueuedOfflineCount } from '../lib/offlineCache';

export default function OfflineStatus() {
  const [isOnline, setIsOnline] = useState(() => (
    typeof navigator === 'undefined' ? true : navigator.onLine
  ));
  const [queuedCount, setQueuedCount] = useState(0);

  useEffect(() => {
    const updateStatus = () => {
      setIsOnline(navigator.onLine);
      void getQueuedOfflineCount().then(setQueuedCount).catch(() => undefined);
    };
    updateStatus();
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    const timer = window.setInterval(updateStatus, 5000);
    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
      window.clearInterval(timer);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="absolute left-3 right-3 top-3 z-[75] flex items-center gap-2 rounded-2xl border border-[#15EA3E]/25 bg-black/88 px-3 py-2 text-[#15EA3E] shadow-[0_12px_28px_rgba(0,0,0,0.38)] backdrop-blur-xl">
      <AfriSellIcon name="offline" size={16} />
      <p className="text-[10px] font-black uppercase tracking-[0.16em]">
        Mode hors ligne
      </p>
      <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-white/44">
        {queuedCount ? `${queuedCount} en attente` : 'IndexedDB'}
      </span>
    </div>
  );
}
