import { User } from 'firebase/auth';
import { push, ref, serverTimestamp, update } from 'firebase/database';
import { realtimeDb } from '../../lib/firebase';
import { AfriMarketContent } from '../../hooks/useAfriMarket';
import { AfriAiIntent, AfriAiResponse } from './types';

type ResolveAfriAiInput = {
  user?: User | null;
  input: string;
  contents: AfriMarketContent[];
};

const intentRoutes: Record<AfriAiIntent, string> = {
  search: '/apps',
  translate: '/chat',
  commerce_help: '/market',
  payment_help: '/wallet',
  health_help: '/med',
  education_help: '/school'
};

const detectIntent = (query: string): AfriAiIntent => {
  if (/(payer|paiement|depot|dépôt|retrait|transfert|wallet|scan|qr)/i.test(query)) return 'payment_help';
  if (/(acheter|produit|prix|market|stand|vitrine|village|commerce)/i.test(query)) return 'commerce_help';
  if (/(tradu|langue|lingala|swahili|anglais|wolof)/i.test(query)) return 'translate';
  if (/(sante|santé|medecin|médecin|pharmacie|consultation|soin)/i.test(query)) return 'health_help';
  if (/(cours|apprendre|ecole|école|formation|certificat|tuteur)/i.test(query)) return 'education_help';
  return 'search';
};

const buildAnswer = (intent: AfriAiIntent, query: string, match?: AfriMarketContent): AfriAiResponse => {
  if (match) {
    return {
      answer: `J ai trouve ${match.title}. Tu peux ouvrir la fiche, comparer le prix et continuer vers achat ou Prix Village.`,
      suggestedRoute: match.isSellable ? `/market/${match.id}` : `/feed?post=${match.id}`,
      confidence: 0.86
    };
  }

  if (intent === 'payment_help') {
    return { answer: 'Pour payer, deposer, retirer ou transferer, continue dans AfriSpay.', suggestedRoute: '/wallet', confidence: 0.82 };
  }
  if (intent === 'commerce_help') {
    return { answer: 'Pour acheter ou vendre, commence par Market ou ABC selon que tu veux une fiche produit ou une Vitrine video.', suggestedRoute: '/market', confidence: 0.78 };
  }
  if (intent === 'translate') {
    return { answer: 'Je peux preparer le contexte de traduction pour une conversation AfriChat.', suggestedRoute: '/chat', confidence: 0.7 };
  }
  if (intent === 'health_help') {
    return { answer: 'Pour un besoin sante, AfriMed est la bonne porte d entree.', suggestedRoute: '/med', confidence: 0.78 };
  }
  if (intent === 'education_help') {
    return { answer: 'Pour apprendre ou te former, continue dans AfriSchool.', suggestedRoute: '/school', confidence: 0.78 };
  }

  return {
    answer: query ? 'Je peux te guider vers ABC, Market, AfriSpay, AfriChat, Safari, Biashara, AfriSchool, AfriMed ou A-Freelance.' : '',
    suggestedRoute: intentRoutes[intent],
    confidence: 0.55
  };
};

export async function resolveAfriAiRequest(input: ResolveAfriAiInput): Promise<AfriAiResponse & { intent: AfriAiIntent }> {
  const query = input.input.trim();
  const intent = detectIntent(query);
  const normalizedQuery = query.toLowerCase();
  const match = normalizedQuery
    ? input.contents.find((content) => `${content.title} ${content.category} ${content.description}`.toLowerCase().includes(normalizedQuery))
    : undefined;
  const response = buildAnswer(intent, query, match);

  if (input.user && query) {
    const requestRef = push(ref(realtimeDb, `afriAiRequests/${input.user.uid}`));
    const requestId = requestRef.key;
    if (requestId) {
      await update(ref(realtimeDb), {
        [`afriAiRequests/${input.user.uid}/${requestId}`]: {
          id: requestId,
          input: query,
          intent,
          answer: response.answer,
          suggestedRoute: response.suggestedRoute || '',
          confidence: response.confidence || 0,
          createdAt: Date.now(),
          updatedAt: serverTimestamp()
        }
      });
    }
  }

  return { ...response, intent };
}
