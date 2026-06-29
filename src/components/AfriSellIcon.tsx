import React from 'react';
import { cn } from '../lib/utils';

export type AfriSellIconName =
  | 'hub'
  | 'market'
  | 'cart'
  | 'order'
  | 'follow'
  | 'pay'
  | 'chat'
  | 'scan'
  | 'profile'
  | 'apple'
  | 'account'
  | 'app'
  | 'notifications'
  | 'logout'
  | 'video'
  | 'school'
  | 'health'
  | 'work'
  | 'shield'
  | 'arrow'
  | 'phone'
  | 'mail'
  | 'lock'
  | 'offline'
  | 'search'
  | 'send'
  | 'clip'
  | 'language'
  | 'heart'
  | 'star'
  | 'comment'
  | 'share'
  | 'close'
  | 'check'
  | 'eye'
  | 'eyeOff'
  | 'deposit'
  | 'withdraw'
  | 'flash'
  | 'keyboard'
  | 'signal'
  | 'play'
  | 'home'
  | 'clock'
  | 'plus';

interface AfriSellIconProps {
  name: AfriSellIconName;
  size?: number;
  className?: string;
}

const paths: Record<AfriSellIconName, React.ReactNode> = {
  home: (
    <>
      <path d="M4.5 11.2 12 5l7.5 6.2" />
      <path d="M6.5 10.2V19h11v-8.8" />
      <path d="M10 19v-5h4v5" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  hub: (
    <>
      <rect x="4" y="4" width="6" height="6" rx="2" />
      <rect x="14" y="4" width="6" height="6" rx="2" />
      <rect x="4" y="14" width="6" height="6" rx="2" />
      <rect x="14" y="14" width="6" height="6" rx="2" />
      <circle cx="12" cy="12" r="1.6" />
    </>
  ),
  market: (
    <>
      <path d="M6 9.5h12l-1.1 9.2a2 2 0 0 1-2 1.8H9.1a2 2 0 0 1-2-1.8L6 9.5Z" />
      <path d="M8.2 9.5a3.8 3.8 0 0 1 7.6 0" />
      <circle cx="9" cy="15.2" r="1" />
      <circle cx="15" cy="15.2" r="1" />
    </>
  ),
  cart: (
    <>
      <path d="M5 6h2.2l1.1 8.4a2 2 0 0 0 2 1.7h5.8a2 2 0 0 0 1.9-1.5L19.2 9H8" />
      <path d="M10 11.5h7.7" />
      <circle cx="10.3" cy="19" r="1.2" />
      <circle cx="16.6" cy="19" r="1.2" />
      <path d="M12.2 4.5h3.6" />
      <path d="M14 2.7v3.6" />
    </>
  ),
  order: (
    <>
      <rect x="5" y="3.5" width="14" height="17" rx="3" />
      <path d="M9 7.5h6" />
      <path d="M9 11h6" />
      <path d="M9 14.5h3.5" />
      <path d="m14 17 1.2 1.2L18 15.4" />
    </>
  ),
  follow: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.8 19a5.4 5.4 0 0 1 10.4 0" />
      <circle cx="17" cy="15" r="3.3" />
      <path d="M17 13.5v3" />
      <path d="M15.5 15h3" />
    </>
  ),
  pay: (
    <>
      <rect x="3.5" y="6" width="17" height="12" rx="3" />
      <path d="M3.5 10h17" />
      <path d="M7 14.5h4" />
      <path d="M15.5 14.2c1.1 0 2 .7 2 1.6s-.9 1.6-2 1.6-2-.7-2-1.6.9-1.6 2-1.6Z" />
    </>
  ),
  chat: (
    <>
      <path d="M5 6.5a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v4.5a4 4 0 0 1-4 4h-3.2L7 19v-4a4 4 0 0 1-2-3.5v-5Z" />
      <path d="M8.5 8.5h7" />
      <path d="M8.5 12h4.5" />
    </>
  ),
  scan: (
    <>
      <path d="M5 9V6.8A1.8 1.8 0 0 1 6.8 5H9" />
      <path d="M15 5h2.2A1.8 1.8 0 0 1 19 6.8V9" />
      <path d="M19 15v2.2a1.8 1.8 0 0 1-1.8 1.8H15" />
      <path d="M9 19H6.8A1.8 1.8 0 0 1 5 17.2V15" />
      <path d="M7 12h10" />
      <circle cx="12" cy="12" r="2.2" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
      <path d="M17.5 5.5 19 4" />
      <path d="M6.5 5.5 5 4" />
    </>
  ),
  apple: (
    <>
      <path d="M15.4 3.2c.1 1.3-.4 2.4-1.2 3.2-.8.8-1.8 1.3-2.9 1.2-.1-1.2.4-2.3 1.2-3.1.8-.8 1.9-1.3 2.9-1.3Z" />
      <path d="M19.2 16.6c-.5 1.1-.8 1.6-1.5 2.6-1 1.4-2.5 3.1-4.2 3.1-1.5 0-1.9-1-3.9-1s-2.5 1-3.9 1c-1.8 0-3.1-1.6-4.1-3-2.8-4.1-3.1-8.9-1.4-11.4 1.2-1.8 3.1-2.8 4.9-2.8 1.8 0 3 1 4.5 1s2.4-1 4.6-1c1.6 0 3.3.9 4.5 2.4-3.9 2.1-3.3 7.7.5 9.1Z" />
    </>
  ),
  account: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <circle cx="12" cy="10" r="2.6" />
      <path d="M7.5 17a4.8 4.8 0 0 1 9 0" />
    </>
  ),
  app: (
    <>
      <rect x="6" y="3.5" width="12" height="17" rx="3" />
      <path d="M10 7h4" />
      <path d="M9 11h6" />
      <path d="M9 14h3" />
      <circle cx="12" cy="18" r=".8" />
    </>
  ),
  notifications: (
    <>
      <path d="M7 10a5 5 0 0 1 10 0v4.5l1.7 2.1H5.3L7 14.5V10Z" />
      <path d="M10 19a2.2 2.2 0 0 0 4 0" />
      <path d="M18 5.5 20 4" />
    </>
  ),
  logout: (
    <>
      <path d="M10 5H6.8A1.8 1.8 0 0 0 5 6.8v10.4A1.8 1.8 0 0 0 6.8 19H10" />
      <path d="M14 8l4 4-4 4" />
      <path d="M18 12H9" />
    </>
  ),
  video: (
    <>
      <rect x="4" y="5" width="12" height="14" rx="3" />
      <path d="m16 10 4-2.4v8.8L16 14" />
      <path d="m10 9 3 3-3 3V9Z" />
    </>
  ),
  play: <path d="M9 6.5v11l8.5-5.5L9 6.5Z" />,
  school: (
    <>
      <path d="m3.5 9 8.5-4 8.5 4-8.5 4-8.5-4Z" />
      <path d="M7 11.2V16c2.8 2 7.2 2 10 0v-4.8" />
      <path d="M20.5 9v5" />
    </>
  ),
  health: (
    <>
      <path d="M12 20s-7-4.2-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.8-7 10-7 10Z" />
      <path d="M12 8.5v5" />
      <path d="M9.5 11h5" />
    </>
  ),
  work: (
    <>
      <rect x="4" y="7" width="16" height="12" rx="3" />
      <path d="M9 7V5.8A1.8 1.8 0 0 1 10.8 4h2.4A1.8 1.8 0 0 1 15 5.8V7" />
      <path d="M4 12h16" />
      <path d="M11 12h2" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.8 19 7v4.7c0 4.1-2.8 7.1-7 8.5-4.2-1.4-7-4.4-7-8.5V7l7-3.2Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  arrow: <path d="M8 5h10v10M18 5 6 17" />,
  phone: (
    <>
      <rect x="7" y="3.5" width="10" height="17" rx="3" />
      <path d="M10 7h4" />
      <circle cx="12" cy="17" r=".8" />
    </>
  ),
  mail: (
    <>
      <rect x="4" y="6" width="16" height="12" rx="3" />
      <path d="m5.5 8 6.5 5 6.5-5" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10" width="14" height="10" rx="3" />
      <path d="M8.5 10V7.8a3.5 3.5 0 0 1 7 0V10" />
      <path d="M12 14v2" />
    </>
  ),
  offline: (
    <>
      <path d="M4 8.5a12 12 0 0 1 16 0" />
      <path d="M7 12a7.5 7.5 0 0 1 10 0" />
      <path d="M10 15.5a3 3 0 0 1 4 0" />
      <path d="M5 19 19 5" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="5.5" />
      <path d="m15 15 4 4" />
    </>
  ),
  send: (
    <>
      <path d="m4 12 16-8-5 16-3-6-8-2Z" />
      <path d="m12 14 3-4" />
    </>
  ),
  clip: (
    <>
      <path d="m9 12 4.5-4.5a3 3 0 0 1 4.2 4.2L11 18.4a4.5 4.5 0 0 1-6.4-6.4l7.2-7.2" />
      <path d="m8 15 6.5-6.5" />
    </>
  ),
  language: (
    <>
      <path d="M4 5h9" />
      <path d="M8.5 5c0 4-1.5 7-4.5 9" />
      <path d="M6 9c1.4 2 3.2 3.6 5.5 4.5" />
      <path d="M14 19l3-7 3 7" />
      <path d="M15.2 16.5h3.6" />
    </>
  ),
  heart: (
    <>
      <path d="M12 20s-7-4.1-7-9.4A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.6C19 15.9 12 20 12 20Z" />
    </>
  ),
  star: (
    <>
      <path d="m12 3.5 2.6 5.2 5.7.8-4.1 4 1 5.6-5.2-2.7-5.2 2.7 1-5.6-4.1-4 5.7-.8L12 3.5Z" />
    </>
  ),
  comment: (
    <>
      <path d="M5 6.5a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v3.8a4 4 0 0 1-4 4h-2.7L8 18v-3.8a4 4 0 0 1-3-3.9V6.5Z" />
      <path d="M9 8.5h6" />
      <path d="M9 11.5h3.5" />
    </>
  ),
  share: (
    <>
      <circle cx="7" cy="12" r="2.5" />
      <circle cx="17" cy="6.5" r="2.5" />
      <circle cx="17" cy="17.5" r="2.5" />
      <path d="m9.2 10.8 5.6-3.1" />
      <path d="m9.2 13.2 5.6 3.1" />
    </>
  ),
  close: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </>
  ),
  check: <path d="m5 12 4.5 4.5L19 7" />,
  eye: (
    <>
      <path d="M3.5 12s3-5.5 8.5-5.5 8.5 5.5 8.5 5.5-3 5.5-8.5 5.5S3.5 12 3.5 12Z" />
      <circle cx="12" cy="12" r="2.4" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M4 4 20 20" />
      <path d="M9.5 6.9A8.4 8.4 0 0 1 12 6.5c5.5 0 8.5 5.5 8.5 5.5a13 13 0 0 1-2.4 3" />
      <path d="M14.1 14.1A2.8 2.8 0 0 1 10 10" />
      <path d="M6.8 8.1A13.7 13.7 0 0 0 3.5 12s3 5.5 8.5 5.5c1.2 0 2.3-.3 3.2-.7" />
    </>
  ),
  deposit: (
    <>
      <path d="M12 4v12" />
      <path d="m7 11 5 5 5-5" />
      <path d="M5 20h14" />
    </>
  ),
  withdraw: (
    <>
      <path d="M12 20V8" />
      <path d="m7 13 5-5 5 5" />
      <path d="M5 4h14" />
    </>
  ),
  flash: (
    <>
      <path d="M13 3 5.5 13h5L9 21l8-11h-5l1-7Z" />
    </>
  ),
  keyboard: (
    <>
      <rect x="3.5" y="7" width="17" height="11" rx="3" />
      <path d="M7 11h.1M10 11h.1M13 11h.1M16 11h.1M8.5 14.5h7" />
    </>
  ),
  signal: (
    <>
      <path d="M8 7.5a6.5 6.5 0 0 1 0 9" />
      <path d="M11 5a10 10 0 0 1 0 14" />
      <path d="M14 3a13.5 13.5 0 0 1 0 18" />
    </>
  ),
};

export function AfriSellIcon({ name, size = 20, className }: AfriSellIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('shrink-0', className)}
    >
      {paths[name]}
    </svg>
  );
}
