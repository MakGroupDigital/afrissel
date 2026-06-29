import type { AfriSellServiceName } from './apiClient';

export type DomainDefinition = {
  id: AfriSellServiceName;
  label: string;
  responsibility: string;
  frontendScope: string[];
  apiPrefix: string;
  plannedService: string;
};

export const domainRegistry: DomainDefinition[] = [
  {
    id: 'identity',
    label: 'Identity',
    responsibility: 'Authentification, profils, roles, business accounts et KYC.',
    frontendScope: ['auth', 'profile', 'business-account'],
    apiPrefix: '/api/identity',
    plannedService: 'identity-service'
  },
  {
    id: 'commerce',
    label: 'Commerce',
    responsibility: 'ABC, Market, panier, commande, Prix Village, Stand, Vitrine et AfriCoin commerce.',
    frontendScope: ['abc', 'market', 'orders', 'village-deals'],
    apiPrefix: '/api/commerce',
    plannedService: 'commerce-service'
  },
  {
    id: 'payment',
    label: 'Payment',
    responsibility: 'AfriSpay, wallet, transactions, escrow, dépôt, retrait et transfert.',
    frontendScope: ['wallet', 'transactions', 'checkout'],
    apiPrefix: '/api/payment',
    plannedService: 'payment-service'
  },
  {
    id: 'chat',
    label: 'Chat',
    responsibility: 'AfriChat, conversations, messages, groupés Village/Kyaghanda et partage produit.',
    frontendScope: ['threads', 'messages', 'contacts'],
    apiPrefix: '/api/chat',
    plannedService: 'chat-service'
  },
  {
    id: 'logistics',
    label: 'Logistics',
    responsibility: 'Safari, livraison, transport, mobilite et immobilier.',
    frontendScope: ['deliveries', 'transport', 'real-estate'],
    apiPrefix: '/api/logistics',
    plannedService: 'logistics-service'
  },
  {
    id: 'media',
    label: 'Media',
    responsibility: 'Cloudinary, images, videos, optimisation réseau et modération media.',
    frontendScope: ['uploads', 'video-streams', 'media-library'],
    apiPrefix: '/api/media',
    plannedService: 'media-service'
  },
  {
    id: 'ai',
    label: 'AfriAI',
    responsibility: 'Assistant vocal, recherche, traduction et orchestration intermodules.',
    frontendScope: ['assistant', 'translation', 'semantic-search'],
    apiPrefix: '/api/ai',
    plannedService: 'ai-service'
  },
  {
    id: 'impact',
    label: 'FPP',
    responsibility: 'FPP, contribution sociale, projets publics et reporting transparent.',
    frontendScope: ['fpp-projects', 'impact-ledger'],
    apiPrefix: '/api/impact',
    plannedService: 'impact-service'
  }
];

export const getDomainDefinition = (id: AfriSellServiceName) => (
  domainRegistry.find((domain) => domain.id === id)
);
