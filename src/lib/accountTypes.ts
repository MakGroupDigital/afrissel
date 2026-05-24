import type { AfriSellIconName } from '../components/AfriSellIcon';

export type AccountRole =
  | 'buyer'
  | 'seller'
  | 'creator'
  | 'agent'
  | 'provider'
  | 'business'
  | 'admin';

export type AccountSubtype = {
  id: string;
  label: string;
  description: string;
};

export type DashboardAction = {
  label: string;
  description: string;
  icon: AfriSellIconName;
  route: string;
};

export type AccountRoleDefinition = {
  id: AccountRole;
  label: string;
  shortLabel: string;
  description: string;
  icon: AfriSellIconName;
  systemOnly?: boolean;
  subtypes: AccountSubtype[];
  dashboard: {
    title: string;
    subtitle: string;
    metrics: { label: string; value: string }[];
    actions: DashboardAction[];
  };
};

export const ACCOUNT_ROLE_DEFINITIONS: AccountRoleDefinition[] = [
  {
    id: 'buyer',
    label: 'Utilisateur / Client',
    shortLabel: 'Personnel',
    description: 'Acheter, publier, discuter, regarder des videos et utiliser les services AfriSell.',
    icon: 'market',
    subtypes: [
      { id: 'personal_account', label: 'Compte personnel', description: 'Je veux acheter, publier, discuter et utiliser les services AfriSell.' }
    ],
    dashboard: {
      title: 'Espace personnel',
      subtitle: 'Market, videos, messages, wallet et services AfriSell.',
      metrics: [
        { label: 'Achats', value: '0' },
        { label: 'Videos', value: '0' },
        { label: 'Favoris', value: '0' }
      ],
      actions: [
        { label: 'Explorer le Market', description: 'Acheter et decouvrir des offres.', icon: 'market', route: '/market' },
        { label: 'Ouvrir ABC', description: 'Regarder ou publier des videos.', icon: 'video', route: '/feed' },
        { label: 'Ouvrir Wallet', description: 'Paiements et solde AfriSpay.', icon: 'pay', route: '/wallet' }
      ]
    }
  },
  {
    id: 'seller',
    label: 'Vendeur / Boutique',
    shortLabel: 'Vendeur',
    description: 'Vendre, gerer produits, commandes, stock, prix village et clients.',
    icon: 'market',
    subtypes: [
      { id: 'individual_seller', label: 'Vendeur individuel', description: 'Je vends en mon nom propre.' },
      { id: 'shop', label: 'Boutique', description: 'Je gere une boutique physique ou en ligne.' },
      { id: 'producer', label: 'Producteur local', description: 'Je produis et vends directement.' },
      { id: 'wholesaler', label: 'Grossiste', description: 'Je fournis en volume.' },
      { id: 'market_vendor', label: 'Vendeur de marche', description: 'Je vends sur un marche local.' },
      { id: 'cooperative', label: 'Cooperative', description: 'Nous vendons comme groupe organise.' }
    ],
    dashboard: {
      title: 'Dashboard vendeur',
      subtitle: 'Produits, commandes, stock, prix village et messages clients.',
      metrics: [
        { label: 'Produits', value: '0' },
        { label: 'Commandes', value: '0' },
        { label: 'Revenus', value: '$0' }
      ],
      actions: [
        { label: 'Ajouter produit', description: 'Preparer le catalogue Market.', icon: 'market', route: '/market' },
        { label: 'Vendre en video', description: 'Creer une fiche ABC.', icon: 'video', route: '/feed' },
        { label: 'Messages clients', description: 'Negocier et assister les acheteurs.', icon: 'chat', route: '/chat' }
      ]
    }
  },
  {
    id: 'creator',
    label: 'Createur ABC',
    shortLabel: 'Createur',
    description: 'Publier des videos, recommander des produits et gagner des commissions.',
    icon: 'video',
    subtypes: [
      { id: 'video_seller', label: 'Video seller', description: 'Je presente et vends des produits en video.' },
      { id: 'affiliate', label: 'Affilie', description: 'Je recommande les produits de vendeurs.' },
      { id: 'influencer', label: 'Influenceur', description: 'J ai une audience et je veux la monétiser.' },
      { id: 'live_host', label: 'Animateur live', description: 'Je veux vendre ou presenter en direct.' },
      { id: 'reviewer', label: 'Testeur produit', description: 'Je fais des avis et demonstrations.' }
    ],
    dashboard: {
      title: 'Studio ABC',
      subtitle: 'Videos, produits affilies, vues, commissions et performances.',
      metrics: [
        { label: 'Videos', value: '0' },
        { label: 'Vues', value: '0' },
        { label: 'Commissions', value: '$0' }
      ],
      actions: [
        { label: 'Ouvrir le feed', description: 'Voir les contenus ABC.', icon: 'video', route: '/feed' },
        { label: 'Choisir produit', description: 'Associer un produit a promouvoir.', icon: 'market', route: '/market' },
        { label: 'Wallet createur', description: 'Suivre les paiements.', icon: 'pay', route: '/wallet' }
      ]
    }
  },
  {
    id: 'agent',
    label: 'Agent AfriSell',
    shortLabel: 'Agent',
    description: 'Aider les utilisateurs, valider terrain, depot/retrait, livraison et support local.',
    icon: 'shield',
    subtypes: [
      { id: 'cash_agent', label: 'Agent cash', description: 'Je gere depot, retrait et assistance paiement.' },
      { id: 'delivery_agent', label: 'Agent livraison', description: 'Je livre ou coordonne les livraisons.' },
      { id: 'support_agent', label: 'Support local', description: 'J aide les utilisateurs sur le terrain.' },
      { id: 'field_validator', label: 'Validateur terrain', description: 'Je verifie vendeurs, boutiques et services.' },
      { id: 'community_manager', label: 'Community manager', description: 'J anime une communaute AfriSell.' }
    ],
    dashboard: {
      title: 'Console agent',
      subtitle: 'Operations terrain, validation, support et commissions.',
      metrics: [
        { label: 'Validations', value: '0' },
        { label: 'Operations', value: '0' },
        { label: 'Commissions', value: '$0' }
      ],
      actions: [
        { label: 'Scanner', description: 'Valider paiement ou commande.', icon: 'scan', route: '/scan' },
        { label: 'Wallet agent', description: 'Voir commissions et operations.', icon: 'pay', route: '/wallet' },
        { label: 'Support chat', description: 'Assister les clients.', icon: 'chat', route: '/chat' }
      ]
    }
  },
  {
    id: 'provider',
    label: 'Prestataire',
    shortLabel: 'Service',
    description: 'Proposer des services dans sante, education, freelance, transport ou immobilier.',
    icon: 'work',
    subtypes: [
      { id: 'freelancer', label: 'Freelancer', description: 'Je vends mes competences ou prestations.' },
      { id: 'health_provider', label: 'Sante', description: 'Je propose un service lie a AfriMed.' },
      { id: 'school_provider', label: 'Education', description: 'Je propose cours, formations ou ecole.' },
      { id: 'transport_provider', label: 'Transport', description: 'Je propose mobilite ou livraison.' },
      { id: 'real_estate_provider', label: 'Immobilier', description: 'Je propose terrains, maisons ou locations.' },
      { id: 'service_provider', label: 'Service local', description: 'Je propose un service du quotidien.' }
    ],
    dashboard: {
      title: 'Dashboard services',
      subtitle: 'Demandes, rendez-vous, devis, paiements et avis clients.',
      metrics: [
        { label: 'Demandes', value: '0' },
        { label: 'Rendez-vous', value: '0' },
        { label: 'Avis', value: '0' }
      ],
      actions: [
        { label: 'Publier service', description: 'Preparer une offre de service.', icon: 'work', route: '/ecosystem' },
        { label: 'Discuter', description: 'Repondre aux demandes.', icon: 'chat', route: '/chat' },
        { label: 'Encaisser', description: 'Paiements et devis.', icon: 'pay', route: '/wallet' }
      ]
    }
  },
  {
    id: 'business',
    label: 'Entreprise / Organisation',
    shortLabel: 'Business',
    description: 'Gerer une structure avec equipe, catalogue, services, facturation et analytics.',
    icon: 'account',
    subtypes: [
      { id: 'company', label: 'Entreprise', description: 'Societe ou marque structuree.' },
      { id: 'clinic', label: 'Clinique', description: 'Organisation de sante.' },
      { id: 'school', label: 'Ecole', description: 'Ecole, centre ou formation.' },
      { id: 'logistics', label: 'Logistique', description: 'Transport, livraison ou stockage.' },
      { id: 'agency', label: 'Agence', description: 'Agence commerciale ou service.' },
      { id: 'ngo', label: 'ONG', description: 'Organisation communautaire ou sociale.' },
      { id: 'institution', label: 'Institution', description: 'Institution publique ou privee.' }
    ],
    dashboard: {
      title: 'Espace business',
      subtitle: 'Equipe, activites, produits, services et donnees de performance.',
      metrics: [
        { label: 'Membres', value: '1' },
        { label: 'Modules', value: '0' },
        { label: 'Revenus', value: '$0' }
      ],
      actions: [
        { label: 'Gerer activites', description: 'Produits, services et modules.', icon: 'app', route: '/ecosystem' },
        { label: 'Equipe', description: 'Inviter et gerer les roles internes.', icon: 'account', route: '/profile' },
        { label: 'Finance', description: 'Wallet, factures et transactions.', icon: 'pay', route: '/wallet' }
      ]
    }
  },
  {
    id: 'admin',
    label: 'Administrateur AfriSell',
    shortLabel: 'Admin',
    description: 'Role interne pour moderation, support, finance, KYC et operations.',
    icon: 'shield',
    systemOnly: true,
    subtypes: [
      { id: 'super_admin', label: 'Super admin', description: 'Controle global de la plateforme.' },
      { id: 'support_admin', label: 'Support', description: 'Support utilisateurs et operations.' },
      { id: 'finance_admin', label: 'Finance', description: 'Transactions, soldes et rapprochements.' },
      { id: 'moderator', label: 'Moderation', description: 'Contenus, produits et signalements.' }
    ],
    dashboard: {
      title: 'Console admin',
      subtitle: 'Utilisateurs, contenus, transactions, KYC et supervision.',
      metrics: [
        { label: 'Utilisateurs', value: '0' },
        { label: 'Signalements', value: '0' },
        { label: 'KYC', value: '0' }
      ],
      actions: [
        { label: 'Utilisateurs', description: 'Voir et gerer les comptes.', icon: 'account', route: '/profile' },
        { label: 'Transactions', description: 'Surveiller les flux financiers.', icon: 'pay', route: '/wallet' },
        { label: 'Moderation', description: 'Verifier contenus et produits.', icon: 'shield', route: '/ecosystem' }
      ]
    }
  }
];

export const PUBLIC_ACCOUNT_ROLE_DEFINITIONS = ACCOUNT_ROLE_DEFINITIONS.filter((role) => !role.systemOnly);

export const getAccountRoleDefinition = (role?: string) =>
  ACCOUNT_ROLE_DEFINITIONS.find((definition) => definition.id === role);

export const getAccountSubtypeDefinition = (role?: string, subtype?: string) =>
  getAccountRoleDefinition(role)?.subtypes.find((definition) => definition.id === subtype);

export const isAccountSetupComplete = (profile?: {
  primaryRole?: string;
  primarySubtype?: string;
  accountSetupCompleted?: boolean;
} | null) => {
  if (!profile?.primaryRole) return false;
  if (profile.primaryRole === 'admin') return true;
  return Boolean(profile.accountSetupCompleted && profile.primarySubtype);
};
