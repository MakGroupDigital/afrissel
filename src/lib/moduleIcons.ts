import type { AfriSellIconName } from '../components/AfriSellIcon';

export function getModuleIconName(id: string): AfriSellIconName {
  const icons: Record<string, AfriSellIconName> = {
    abc: 'video',
    market: 'market',
    chat: 'chat',
    spay: 'pay',
    school: 'school',
    med: 'health',
    freelance: 'work',
    safari: 'shield',
  };

  return icons[id] ?? 'hub';
}
