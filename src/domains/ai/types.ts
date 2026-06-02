export type AfriAiIntent = 'search' | 'translate' | 'commerce_help' | 'payment_help' | 'health_help' | 'education_help';

export type AfriAiRequest = {
  userId?: string;
  input: string;
  locale?: string;
  intent?: AfriAiIntent;
};

export type AfriAiResponse = {
  answer: string;
  suggestedRoute?: string;
  confidence?: number;
};
