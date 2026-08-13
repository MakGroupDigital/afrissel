const categoryRules: Array<{ category: string; terms: string[] }> = [
  { category: 'Téléphones', terms: ['telephone', 'téléphone', 'smartphone', 'iphone', 'samsung', 'mobile'] },
  { category: 'Informatique', terms: ['ordinateur', 'laptop', 'pc', 'clavier', 'souris', 'imprimante'] },
  { category: 'Mode', terms: ['robe', 'chemise', 'pantalon', 'chaussure', 'sac', 'vetement', 'vêtement', 'mode'] },
  { category: 'Beauté', terms: ['parfum', 'maquillage', 'cheveux', 'cosmetique', 'cosmétique', 'beaute', 'beauté'] },
  { category: 'Maison', terms: ['meuble', 'chaise', 'table', 'decoration', 'décoration', 'cuisine', 'maison'] },
  { category: 'Agro', terms: ['agricole', 'semence', 'engrais', 'mais', 'maïs', 'riz', 'cacao', 'cafe', 'café'] },
  { category: 'Alimentaire', terms: ['aliment', 'boisson', 'jus', 'huile', 'farine', 'restaurant', 'epice', 'épice'] },
  { category: 'Bebe', terms: ['bebe', 'bébé', 'enfant', 'poussette', 'jouet'] },
  { category: 'Electronique', terms: ['casque', 'ecouteur', 'écouteur', 'camera', 'caméra', 'chargeur', 'batterie', 'electronique', 'électronique'] },
  { category: 'Sport', terms: ['sport', 'fitness', 'ballon', 'gym', 'running', 'musculation'] },
  { category: 'Auto', terms: ['voiture', 'auto', 'moto', 'pneu', 'moteur', 'piece auto', 'pièce auto'] }
];

const normalize = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

export const inferZandofyCatalogCategory = (title: string, description: string, fallback = 'Autres') => {
  const text = normalize(`${title} ${description}`);
  const match = categoryRules
    .map((rule) => ({ ...rule, score: rule.terms.reduce((score, term) => score + (text.includes(normalize(term)) ? 1 : 0), 0) }))
    .sort((first, second) => second.score - first.score)
    .find((rule) => rule.score > 0);
  return match?.category || fallback;
};

export const ZIKMART_CATEGORIES = categoryRules.map((rule) => rule.category);
