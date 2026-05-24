export type EcosystemModule = {
  id: string;
  name: string;
  shortName: string;
  description: string;
  promise: string;
  route: string;
  logo: string;
  status: 'Live' | 'MVP' | 'Bientot';
};

export const ecosystemModules: EcosystemModule[] = [
  {
    id: 'abc',
    name: 'ABC Discovery',
    shortName: 'ABC',
    description: 'Flux video vertical pour decouvrir, acheter et recommander en direct.',
    promise: 'Video-commerce',
    route: '/feed',
    logo: '/biashara.jpeg',
    status: 'Live',
  },
  {
    id: 'market',
    name: 'AfriSell Market',
    shortName: 'Market',
    description: 'Catalogue, prix village et achat groupe pour negocier par la communaute.',
    promise: 'E-commerce groupe',
    route: '/market',
    logo: '/afrimarket.jpeg',
    status: 'Live',
  },
  {
    id: 'chat',
    name: 'AfriChat',
    shortName: 'Chat',
    description: 'Messagerie marchande avec synchronisation offline et traduction locale.',
    promise: 'Conversation',
    route: '/chat',
    logo: '/africhat.jpeg',
    status: 'MVP',
  },
  {
    id: 'spay',
    name: 'AfriSpay',
    shortName: 'Spay',
    description: 'Wallet hybride pret pour Mobile Money, USSD et transactions hors ligne.',
    promise: 'Paiement',
    route: '/wallet',
    logo: '/afrispay.jpeg',
    status: 'MVP',
  },
  {
    id: 'school',
    name: 'AfriSchool',
    shortName: 'School',
    description: 'Parcours d apprentissage utiles aux vendeurs, jeunes et createurs.',
    promise: 'Education',
    route: '/ecosystem',
    logo: '/afrischool.jpeg',
    status: 'Bientot',
  },
  {
    id: 'med',
    name: 'AfriMed',
    shortName: 'Med',
    description: 'Acces sante, conseils et orientation vers des services de proximite.',
    promise: 'Sante',
    route: '/ecosystem',
    logo: '/afrimed.jpeg',
    status: 'Bientot',
  },
  {
    id: 'freelance',
    name: 'A-Freelance',
    shortName: 'Freelance',
    description: 'Missions, talents et services locaux relies au commerce social.',
    promise: 'Travail',
    route: '/ecosystem',
    logo: '/a-freelance.jpeg',
    status: 'Bientot',
  },
  {
    id: 'safari',
    name: 'Safari',
    shortName: 'Safari',
    description: 'Mobilite, transport, immobilier et services du quotidien.',
    promise: 'Mobilite & services',
    route: '/ecosystem',
    logo: '/safari.jpeg',
    status: 'Bientot',
  },
];
