export type AfriSellServiceName =
  | 'identity'
  | 'commerce'
  | 'payment'
  | 'chat'
  | 'logistics'
  | 'media'
  | 'ai'
  | 'impact';

type ApiRequestOptions = RequestInit & {
  service?: AfriSellServiceName;
};

const serviceEnvKeys: Record<AfriSellServiceName, string> = {
  identity: 'VITE_AFRISELL_IDENTITY_API_URL',
  commerce: 'VITE_AFRISELL_COMMERCE_API_URL',
  payment: 'VITE_AFRISELL_PAYMENT_API_URL',
  chat: 'VITE_AFRISELL_CHAT_API_URL',
  logistics: 'VITE_AFRISELL_LOGISTICS_API_URL',
  media: 'VITE_AFRISELL_MEDIA_API_URL',
  ai: 'VITE_AFRISELL_AI_API_URL',
  impact: 'VITE_AFRISELL_IMPACT_API_URL'
};

const getServiceBaseUrl = (service?: AfriSellServiceName) => {
  if (!service) return import.meta.env.VITE_AFRISELL_API_BASE_URL || '';

  const explicitUrl = import.meta.env[serviceEnvKeys[service]] as string | undefined;
  return explicitUrl || import.meta.env.VITE_AFRISELL_API_BASE_URL || '';
};

const buildApiUrl = (path: string, service?: AfriSellServiceName) => {
  if (/^https?:\/\//i.test(path)) return path;
  const baseUrl = getServiceBaseUrl(service).replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
};

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { service, headers, ...requestOptions } = options;
  const response = await fetch(buildApiUrl(path, service), {
    ...requestOptions,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  });

  const payload = await response.json().catch(() => null) as T & { error?: string; detail?: string } | null;

  if (!response.ok) {
    const message = payload?.detail || payload?.error || `API AfriSell indisponible (${response.status})`;
    throw new Error(message);
  }

  return payload as T;
}
