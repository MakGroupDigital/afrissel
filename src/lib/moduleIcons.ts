import type { AfriZiaIconName } from '../components/AfriZiaIcon';

export function getModuleIconName(id: string): AfriZiaIconName {
  const icons: Record<string, AfriZiaIconName> = {
    abc: 'video',
    market: 'market',
    chat: 'chat',
    spay: 'pay',
    school: 'school',
    med: 'health',
    freelance: 'work',
    safari: 'shield',
    biashara: 'shield',
    afriai: 'language',
    fpp: 'heart',
  };

  return icons[id] ?? 'hub';
}
