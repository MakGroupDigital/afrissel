import { useEffect, useState } from 'react';
import { AfriSellIcon } from './AfriSellIcon';

export default function OfflineStatus() {
  const [isOnline, setIsOnline] = useState(() => (
    typeof navigator === 'undefined' ? true : navigator.onLine
  ));

  useEffect(() => {
    const updateStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
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
        Donnees locales
      </span>
    </div>
  );
}
