import React, { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { AfriSellIcon, AfriSellIconName } from '../components/AfriSellIcon';
import { MARKET_CATEGORIES, AfriMarketContent, formatMarketPrice, toCheckoutProduct, useAfriMarket } from '../hooks/useAfriMarket';
import { cn } from '../lib/utils';

type SortMode = 'popular' | 'newest' | 'village' | 'price';

type MarketChannel = {
  id: string;
  label: string;
  description: string;
  icon: AfriSellIconName;
  categories: string[];
  keywords: string[];
  subsections: string[];
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: { results: ArrayLike<{ length: number; isFinal?: boolean; 0?: { transcript?: string } }> }) => void) | null;
  onerror: ((event?: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};

const marketChannels: MarketChannel[] = [
  {
    id: 'all',
    label: 'Tout',
    description: 'Tout le marché AfriSell',
    icon: 'market',
    categories: [],
    keywords: [],
    subsections: ['Coup de coeur', 'Top vendu', 'Prêt à expédier', 'Livraison gratuite']
  },
  {
    id: 'wholesale',
    label: 'En gros',
    description: 'Lots, cartons, palettes et volumes business',
    icon: 'hub',
    categories: ['Agro', 'Alimentaire', 'Boissons', 'Fournitures', 'BTP', 'Materiaux', 'Electronique', 'Mode'],
    keywords: ['gros', 'lot', 'carton', 'palette', 'stock', 'volume', 'b2b', 'import', 'distribution'],
    subsections: ['Lots populaires', 'Prix revendeur', 'Importateurs', 'Stocks disponibles']
  },
  {
    id: 'retail',
    label: 'En détail',
    description: 'Articles prêts pour l’achat immédiat',
    icon: 'cart',
    categories: ['Mode', 'Beaute', 'Téléphones', 'Informatique', 'Maison', 'Meubles', 'Restauration', 'Enfants', 'Bebe', 'Luxe'],
    keywords: ['detail', 'unite', 'piece', 'nouveau', 'boutique', 'client'],
    subsections: ['Nouveautés', 'Petits prix', 'Prêt à livrer', 'Tendance locale']
  },
  {
    id: 'producers',
    label: 'Producteurs',
    description: 'Production locale, agricole et industrielle',
    icon: 'work',
    categories: ['Agriculture', 'Elevage', 'Agro', 'Artisanat', 'BTP', 'Materiaux', 'Energie'],
    keywords: ['producteur', 'production', 'usine', 'ferme', 'cooperative', 'agricole', 'manufacture'],
    subsections: ['Production locale', 'Direct ferme', 'Usines', 'Coopératives']
  },
  {
    id: 'suppliers',
    label: 'Fournisseurs',
    description: 'Réseau fournisseur, sourcing et distribution',
    icon: 'order',
    categories: ['Fournitures', 'Bureau', 'Electronique', 'Pièces auto', 'Livraison', 'Services', 'BTP'],
    keywords: ['fournisseur', 'sourcing', 'distributeur', 'grossiste', 'approvisionnement', 'supply'],
    subsections: ['Fournisseurs vérifiés', 'B2B rapide', 'Contrats', 'Réassort']
  },
  {
    id: 'services',
    label: 'Services',
    description: 'Services, réparation, formation, immo et mobilité',
    icon: 'flash',
    categories: ['Services', 'Livraison', 'Reparations', 'Formation', 'Emploi', 'Immobilier', 'Voyage', 'Restauration', 'Evenements'],
    keywords: ['service', 'reparation', 'formation', 'location', 'event', 'restaurant', 'livraison', 'transport', 'immo'],
    subsections: ['Services proches', 'Disponible aujourd’hui', 'Pro vérifié', 'Réponse rapide']
  }
];

const regionFilters = ['Toutes régions', 'Kinshasa', 'Goma', 'Lubumbashi', 'Bukavu', 'Brazzaville', 'Abidjan', 'Dakar'];
const countryFilters = ['Tous pays', 'RDC', 'Congo', 'Côte d’Ivoire', 'Sénégal', 'Cameroun', 'Rwanda'];
const cityFilters = ['Toutes villes', 'Kinshasa', 'Goma', 'Lubumbashi', 'Bukavu', 'Matadi', 'Bunia', 'Kolwezi'];
const bannerSlides = [
  {
    image: 'https://res.cloudinary.com/dh0ilegll/image/upload/v1782950736/afrissel/market-banners/portrait-woman-working-dried-flowers-shop.jpg',
    eyebrow: 'Stand créateur',
    title: 'Transforme ton atelier en vitrine AfriSell.',
    body: 'Expose tes produits, crée un Village d’achat et vends avec livraison Safari.'
  },
  {
    image: 'https://res.cloudinary.com/dh0ilegll/image/upload/v1782950755/afrissel/market-banners/african-woman-posing-studio.jpg',
    eyebrow: 'Boutique locale',
    title: 'Découvre les offres qui font bouger le marché.',
    body: 'Mode, services, fournisseurs et Prix Village dans une seule expérience.'
  }
];

const imageSearchAliases: Array<{ tests: string[]; terms: string }> = [
  { tests: ['flower', 'flowers', 'fleur', 'fleurs', 'dried'], terms: 'fleurs décoration artisanat maison' },
  { tests: ['woman', 'femme', 'mode', 'studio', 'posing'], terms: 'mode beauté boutique femme' },
  { tests: ['phone', 'telephone', 'mobile', 'smartphone'], terms: 'téléphones tech électronique' },
  { tests: ['shoe', 'chaussure', 'sneaker'], terms: 'mode chaussures' },
  { tests: ['food', 'restaurant', 'plat', 'cuisine'], terms: 'restauration alimentaire' },
  { tests: ['house', 'home', 'maison', 'immo'], terms: 'immobilier maison' },
  { tests: ['car', 'auto', 'voiture'], terms: 'auto pièces auto' }
];

const cleanSearchText = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\.[^.]+$/g, '')
  .replace(/[-_()[\]{}]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const inferImageSearchTerms = (fileName: string, barcodeValue = '') => {
  const cleanName = cleanSearchText(fileName);
  const normalizedName = cleanName.toLowerCase();
  const aliases = imageSearchAliases
    .filter((alias) => alias.tests.some((test) => normalizedName.includes(test)))
    .map((alias) => alias.terms);
  const baseTerms = cleanName.split(' ').filter((word) => word.length > 2).join(' ');
  return [barcodeValue, ...aliases, baseTerms].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
};

const getScore = (product: AfriMarketContent) =>
  (product.likesCount || 0) * 2 + (product.buyersCount || 0) * 3 + (product.sharesCount || 0);

const productText = (product: AfriMarketContent) => [
  product.title,
  product.description,
  product.authorName,
  product.category
].join(' ').toLowerCase();

const matchesChannel = (product: AfriMarketContent, channel: MarketChannel) => {
  if (channel.id === 'all') return true;
  const text = productText(product);
  return channel.categories.includes(product.category) || channel.keywords.some((keyword) => text.includes(keyword));
};

const getShelfProducts = (products: AfriMarketContent[], shelf: string) => {
  const sorted = [...products];

  if (shelf.includes('Top vendu')) {
    return sorted.sort((first, second) => (second.buyersCount || 0) - (first.buyersCount || 0)).slice(0, 8);
  }
  if (shelf.includes('AfriAI') || shelf.includes('recherche')) {
    return sorted.sort((first, second) => getScore(second) - getScore(first)).slice(0, 8);
  }
  if (shelf.includes('expédier') || shelf.includes('livrer') || shelf.includes('Livraison')) {
    return sorted
      .filter((product) => ['Livraison', 'Alimentaire', 'Restauration', 'Téléphones', 'Mode'].includes(product.category) || product.price === product.villagePrice)
      .sort((first, second) => getScore(second) - getScore(first))
      .slice(0, 8);
  }
  if (shelf.includes('gratuit')) {
    return sorted.filter((product) => Number(product.villagePrice || product.price || 0) > 0).slice(0, 8);
  }

  return sorted.sort((first, second) => getScore(second) - getScore(first)).slice(0, 8);
};

function MiniMarketCard({ product, label }: { key?: React.Key; product: AfriMarketContent; label?: string }) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate(`/market/${product.id}`)}
      className="w-[148px] shrink-0 overflow-hidden rounded-[1.15rem] border border-white/10 bg-white/[0.04] text-left active:scale-[0.98]"
    >
      <div className="relative h-28 bg-[#050505]">
        <img src={product.coverURL || '/afrimarket.jpeg'} alt={product.title} className="h-full w-full object-cover" />
        {label && (
          <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-[#15EA3E]">
            {label}
          </span>
        )}
      </div>
      <div className="p-2.5">
        <p className="line-clamp-2 min-h-[28px] text-[11px] font-black leading-tight text-white">{product.title}</p>
        <p className="mt-1 text-[11px] font-black text-[#15EA3E]">
          {formatMarketPrice(product.villagePrice || product.price, product.currency) || 'Voir prix'}
        </p>
        <p className="mt-1 truncate text-[9px] font-bold uppercase tracking-wide text-white/38">{product.category}</p>
      </div>
    </button>
  );
}

export default function MarketHome() {
  const { marketProducts, loading, error } = useAfriMarket();
  const navigate = useNavigate();
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const voiceRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const voiceTimeoutRef = useRef<number | null>(null);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('Tout');
  const [activeChannelId, setActiveChannelId] = useState('all');
  const [activeSubsection, setActiveSubsection] = useState('Tous');
  const [sortMode, setSortMode] = useState<SortMode>('popular');
  const [region, setRegion] = useState(regionFilters[0]);
  const [country, setCountry] = useState(countryFilters[0]);
  const [city, setCity] = useState(cityFilters[0]);
  const [searchStatus, setSearchStatus] = useState('');
  const [listening, setListening] = useState(false);
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const [imageSearchPreview, setImageSearchPreview] = useState('');
  const [imageSearchTerms, setImageSearchTerms] = useState('');
  const [imageSearchName, setImageSearchName] = useState('');

  const activeChannel = marketChannels.find((channel) => channel.id === activeChannelId) || marketChannels[0];
  const subsectionFilters = ['Tous', ...activeChannel.subsections];
  const normalizedQuery = query.trim().toLowerCase();

  const filteredProducts = useMemo(() => {
    const nextProducts = marketProducts.filter((product) => {
      const text = productText(product);
      const matchesCategory = activeCategory === 'Tout' || product.category === activeCategory;
      const matchesQuery = !normalizedQuery || text.includes(normalizedQuery);
      const matchesRegion = region === 'Toutes régions' || text.includes(region.toLowerCase());
      const matchesCountry = country === 'Tous pays' || text.includes(country.toLowerCase());
      const matchesCity = city === 'Toutes villes' || text.includes(city.toLowerCase());
      const matchesSubsection = activeSubsection === 'Tous'
        || (activeSubsection.includes('Livraison') && ['Livraison', 'Restauration', 'Alimentaire'].includes(product.category))
        || (activeSubsection.includes('Top') && (product.buyersCount || 0) > 0)
        || (activeSubsection.includes('Prix') && Boolean(product.villagePrice))
        || (activeSubsection.includes('vérifié') || activeSubsection.includes('Pro') ? Boolean(product.authorId) : true);

      return matchesChannel(product, activeChannel) && matchesCategory && matchesQuery && matchesRegion && matchesCountry && matchesCity && matchesSubsection;
    });

    return nextProducts.sort((first, second) => {
      if (sortMode === 'newest') return String(second.createdAt || '').localeCompare(String(first.createdAt || ''));
      if (sortMode === 'village') return (second.buyersCount || 0) - (first.buyersCount || 0);
      if (sortMode === 'price') return (first.villagePrice || first.price || 0) - (second.villagePrice || second.price || 0);
      return getScore(second) - getScore(first);
    });
  }, [activeCategory, activeChannel, activeSubsection, city, country, marketProducts, normalizedQuery, region, sortMode]);

  const popularProducts = useMemo(() => (
    [...marketProducts].sort((first, second) => getScore(second) - getScore(first)).slice(0, 4)
  ), [marketProducts]);
  const featuredProduct = popularProducts[0] || filteredProducts[0];
  const secondaryPopularProducts = popularProducts.slice(1, 4);
  const shelfSections = [
    'Coup de coeur',
    'Sur base de tes recherches',
    'Ce qu’AfriAI te propose',
    'Top vendu de la semaine',
    'Prêt à être expédié',
    'Prêt pour la livraison',
    'Livraison gratuite'
  ];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveBannerIndex((current) => (current + 1) % bannerSlides.length);
    }, 4200);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => () => {
    if (voiceTimeoutRef.current) window.clearTimeout(voiceTimeoutRef.current);
    voiceRecognitionRef.current?.abort();
  }, []);

  useEffect(() => () => {
    if (imageSearchPreview) URL.revokeObjectURL(imageSearchPreview);
  }, [imageSearchPreview]);

  const stopVoiceSearch = () => {
    if (voiceTimeoutRef.current) {
      window.clearTimeout(voiceTimeoutRef.current);
      voiceTimeoutRef.current = null;
    }
    voiceRecognitionRef.current?.stop();
    voiceRecognitionRef.current = null;
    setListening(false);
  };

  const startVoiceSearch = async () => {
    if (listening) {
      stopVoiceSearch();
      return;
    }

    const SpeechRecognition = ((window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition
      || (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition);

    if (!SpeechRecognition) {
      setSearchStatus('Recherche vocale non supportée ici. Utilise Chrome ou Safari récent, ou écris ta recherche.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices?.getUserMedia?.({ audio: true });
      stream?.getTracks().forEach((track) => track.stop());
    } catch {
      setSearchStatus('Micro refusé. Autorise le micro pour lancer la recherche vocale.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR';
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      let finalText = '';
      let interimText = '';

      Array.from({ length: event.results.length }).forEach((_, index) => {
        const result = event.results[index];
        const transcript = result?.[0]?.transcript?.trim() || '';
        if (!transcript) return;
        if (result.isFinal) finalText += ` ${transcript}`;
        else interimText += ` ${transcript}`;
      });

      const nextText = (finalText || interimText).trim();
      if (!nextText) return;

      setQuery(nextText);
      setSearchStatus(finalText.trim() ? `Recherche vocale lancée: ${finalText.trim()}` : `Écoute: ${interimText.trim()}`);
    };
    recognition.onerror = (event) => {
      const errorMessages: Record<string, string> = {
        'not-allowed': 'Micro bloqué. Autorise le micro dans le navigateur.',
        'no-speech': 'Aucune voix détectée. Réessaie en parlant plus près du micro.',
        network: 'Réseau instable pour la reconnaissance vocale.',
        'audio-capture': 'Aucun micro détecté.'
      };
      setSearchStatus(errorMessages[event?.error || ''] || 'Recherche vocale interrompue.');
      setListening(false);
    };
    recognition.onend = () => {
      if (voiceTimeoutRef.current) {
        window.clearTimeout(voiceTimeoutRef.current);
        voiceTimeoutRef.current = null;
      }
      voiceRecognitionRef.current = null;
      setListening(false);
    };

    try {
      voiceRecognitionRef.current = recognition;
      setListening(true);
      setSearchStatus('Parle maintenant...');
      recognition.start();
      voiceTimeoutRef.current = window.setTimeout(() => {
        stopVoiceSearch();
      }, 9000);
    } catch {
      setListening(false);
      setSearchStatus('Impossible de lancer le micro. Réessaie après avoir autorisé l’accès.');
    }
  };

  const handlePhotoSearch = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    event.target.value = '';
    if (!file) return;

    if (imageSearchPreview) URL.revokeObjectURL(imageSearchPreview);
    const previewUrl = URL.createObjectURL(file);
    setImageSearchPreview(previewUrl);
    setImageSearchName(file.name);
    setSearchStatus('Analyse de l’image...');

    let barcodeValue = '';
    const BarcodeDetector = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
    if (BarcodeDetector) {
      try {
        const bitmap = await createImageBitmap(file);
        const detector = new BarcodeDetector({ formats: ['qr_code', 'ean_13', 'ean_8', 'code_128', 'upc_a', 'upc_e'] });
        const codes = await detector.detect(bitmap);
        bitmap.close();
        barcodeValue = codes.map((code) => code.rawValue).filter(Boolean).join(' ');
      } catch {
        barcodeValue = '';
      }
    }

    const terms = inferImageSearchTerms(file.name, barcodeValue);
    setImageSearchTerms(terms);
    setQuery(terms);
    setSearchStatus(barcodeValue ? 'Code détecté dans l’image. Recherche lancée.' : 'Image chargée. Ajuste les mots-clés si nécessaire.');
  };

  const applyImageSearchTerms = () => {
    const terms = imageSearchTerms.trim();
    if (!terms) {
      setSearchStatus('Ajoute au moins un mot-clé pour rechercher avec cette image.');
      return;
    }
    setQuery(terms);
    setSearchStatus(`Recherche image: ${terms}`);
  };

  return (
    <div className="flex min-h-full w-full max-w-full flex-col overflow-x-hidden bg-black text-white">
      <div className="sticky top-0 z-40 bg-black/70 px-4 py-3 backdrop-blur-xl">
        <input ref={photoInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoSearch} className="hidden" />
        <div className="flex min-w-0 items-center gap-2 rounded-[1.25rem] border border-[#15EA3E]/18 bg-[#071007]/95 p-2 shadow-[0_18px_38px_rgba(0,0,0,0.34)] transition-colors focus-within:border-[#15EA3E]/55">
            <AfriSellIcon name="search" size={18} className="shrink-0 text-[#15EA3E]" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Chercher produit, stand, fournisseur..."
              className="h-9 w-full min-w-0 border-none bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/35"
            />
            <button
              type="button"
              onClick={startVoiceSearch}
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors',
                listening ? 'border-[#15EA3E] bg-[#15EA3E] text-black' : 'border-white/10 bg-white/[0.04] text-white/70'
              )}
              aria-label="Recherche vocale"
            >
              <AfriSellIcon name="mic" size={15} />
            </button>
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors',
                imageSearchPreview ? 'border-[#15EA3E] bg-[#15EA3E] text-black' : 'border-white/10 bg-white/[0.04] text-white/70'
              )}
              aria-label="Recherche par photo"
            >
              <AfriSellIcon name="camera" size={15} />
            </button>
        </div>
        {searchStatus && (
          <p className="mt-2 rounded-full border border-[#15EA3E]/20 bg-[#15EA3E]/10 px-3 py-1.5 text-[10px] font-bold text-[#15EA3E]">
            {searchStatus}
          </p>
        )}
        {imageSearchPreview && (
          <div className="mt-3 rounded-[1.25rem] border border-white/10 bg-[#050505]/95 p-3 shadow-[0_18px_38px_rgba(0,0,0,0.32)]">
            <div className="flex gap-3">
              <img src={imageSearchPreview} alt="Recherche image" className="h-20 w-20 shrink-0 rounded-2xl object-cover" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-black text-white">Recherche par image</p>
                    <p className="mt-0.5 truncate text-[10px] font-semibold text-white/38">{imageSearchName}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      URL.revokeObjectURL(imageSearchPreview);
                      setImageSearchPreview('');
                      setImageSearchTerms('');
                      setImageSearchName('');
                      setSearchStatus('');
                    }}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 text-white/45"
                    aria-label="Fermer la recherche image"
                  >
                    <AfriSellIcon name="close" size={13} />
                  </button>
                </div>
                <div className="mt-2 flex gap-2">
                  <input
                    value={imageSearchTerms}
                    onChange={(event) => setImageSearchTerms(event.target.value)}
                    placeholder="Ex: fleurs, mode, téléphone..."
                    className="h-10 min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/35 px-3 text-xs font-semibold text-white outline-none focus:border-[#15EA3E]/45"
                  />
                  <button
                    type="button"
                    onClick={applyImageSearchTerms}
                    className="h-10 rounded-2xl bg-[#15EA3E] px-4 text-[10px] font-black uppercase tracking-wider text-black"
                  >
                    OK
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <section className="w-full max-w-full overflow-hidden px-4 pt-3">
        <div className="relative h-[250px] w-full max-w-full overflow-hidden rounded-[1.75rem] border border-[#15EA3E]/22 bg-[#071007] shadow-[0_22px_54px_rgba(0,0,0,0.36),0_0_42px_rgba(21,234,62,0.08)]">
          {bannerSlides.map((slide, index) => (
            <img
              key={slide.image}
              src={slide.image}
              alt=""
              loading={index === 0 ? 'eager' : 'lazy'}
              decoding="async"
              className={cn(
                'absolute inset-0 h-full w-full select-none object-cover transition-opacity duration-700',
                index === activeBannerIndex ? 'opacity-100' : 'opacity-0'
              )}
            />
          ))}
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.88),rgba(0,0,0,0.48),rgba(0,0,0,0.14)),radial-gradient(circle_at_18%_20%,rgba(21,234,62,0.34),transparent_34%)]" />
          <div className="relative z-10 flex h-full min-w-0 flex-col justify-between p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[1.25rem] border border-white/15 bg-black/35 p-2 backdrop-blur">
                <img src="/afrimarket sans nom icone sans fond.png" alt="AfriMarket" className="h-full w-full object-contain" />
              </div>
              <div className="flex gap-1.5">
                {bannerSlides.map((slide, index) => (
                  <button
                    key={slide.image}
                    type="button"
                    onClick={() => setActiveBannerIndex(index)}
                    className={cn(
                      'h-1.5 rounded-full transition-all',
                      index === activeBannerIndex ? 'w-7 bg-[#15EA3E]' : 'w-2.5 bg-white/35'
                    )}
                    aria-label={`Voir la bannière ${index + 1}`}
                  />
                ))}
              </div>
            </div>
            <div className="min-h-[96px] max-w-[82%] min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">{bannerSlides[activeBannerIndex].eyebrow}</p>
              <h1 className="mt-2 line-clamp-2 text-2xl font-black leading-[1.05] text-white">{bannerSlides[activeBannerIndex].title}</h1>
              <p className="mt-2 line-clamp-2 text-xs font-semibold leading-relaxed text-white/68">
                {bannerSlides[activeBannerIndex].body}
              </p>
            </div>
            <div className="flex h-8 max-w-full gap-2 overflow-x-auto overflow-y-hidden scrollbar-hide">
              {marketChannels.filter((channel) => channel.id !== 'all').map((channel) => (
                <button
                  key={channel.id}
                  type="button"
                  onClick={() => {
                    setActiveChannelId(channel.id);
                    setActiveSubsection('Tous');
                  }}
                  className={cn(
                    'shrink-0 rounded-full border px-3 py-1.5 text-[9px] font-black uppercase tracking-wider backdrop-blur transition-colors',
                    activeChannelId === channel.id
                      ? 'border-[#15EA3E] bg-[#15EA3E] text-black'
                      : 'border-white/15 bg-black/32 text-white/72'
                  )}
                >
                  {channel.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="scrollbar-hide flex gap-2 overflow-x-auto px-4 py-4">
        {subsectionFilters.map((subsection) => (
          <button
            key={subsection}
            type="button"
            onClick={() => setActiveSubsection(subsection)}
            className={cn(
              'shrink-0 rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-wider',
              activeSubsection === subsection
                ? 'bg-white text-black'
                : 'border border-white/10 bg-white/[0.04] text-white/48'
            )}
          >
            {subsection}
          </button>
        ))}
      </section>

      <section className="scrollbar-hide flex gap-2 overflow-x-auto px-4 pb-3">
        {MARKET_CATEGORIES.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setActiveCategory(category)}
            className={cn(
              'whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold transition-colors',
              category === activeCategory
                ? 'bg-[#15EA3E] text-black'
                : 'border border-gray-800 bg-[#0A0A0A] text-gray-400 hover:border-gray-600'
            )}
          >
            {category}
          </button>
        ))}
      </section>

      <section className="grid grid-cols-3 gap-2 px-4 pb-3">
        {[
          { value: region, onChange: setRegion, options: regionFilters, label: 'Région' },
          { value: country, onChange: setCountry, options: countryFilters, label: 'Pays' },
          { value: city, onChange: setCity, options: cityFilters, label: 'Ville' }
        ].map((filter) => (
          <label key={filter.label} className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
            <span className="block text-[8px] font-black uppercase tracking-wider text-white/32">{filter.label}</span>
            <select
              value={filter.value}
              onChange={(event) => filter.onChange(event.target.value)}
              className="mt-1 w-full bg-transparent text-[10px] font-black text-white outline-none"
            >
              {filter.options.map((option) => (
                <option key={option} value={option} className="bg-black text-white">
                  {option}
                </option>
              ))}
            </select>
          </label>
        ))}
      </section>

      <section className="scrollbar-hide flex gap-2 overflow-x-auto px-4 pb-4">
        {[
          { id: 'popular', label: 'Populaires' },
          { id: 'newest', label: 'Récents' },
          { id: 'village', label: 'Prix Village' },
          { id: 'price', label: 'Prix bas' }
        ].map((sort) => (
          <button
            key={sort.id}
            type="button"
            onClick={() => setSortMode(sort.id as SortMode)}
            className={cn(
              'shrink-0 rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-wider',
              sortMode === sort.id
                ? 'bg-[#15EA3E] text-black'
                : 'border border-white/10 bg-white/[0.04] text-white/48'
            )}
          >
            {sort.label}
          </button>
        ))}
      </section>

      {featuredProduct && (
        <section className="px-4 pb-4">
          <div
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/market/${featuredProduct.id}`)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                navigate(`/market/${featuredProduct.id}`);
              }
            }}
            className="relative overflow-hidden rounded-[1.65rem] border border-[#15EA3E]/25 bg-[#071007] p-4 shadow-[0_18px_42px_rgba(0,0,0,0.34),0_0_34px_rgba(21,234,62,0.08)] active:scale-[0.99]"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(21,234,62,0.24),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.06),transparent_48%)]" />
            <div className="relative z-10 flex gap-4">
              <div className="min-w-0 flex-1">
                <div className="inline-flex items-center gap-2 rounded-full bg-[#15EA3E] px-3 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-black">
                  <AfriSellIcon name="flash" size={12} />
                  Offre à ne pas manquer
                </div>
                <h2 className="mt-3 line-clamp-2 text-lg font-black leading-tight text-white">{featuredProduct.title}</h2>
                <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-relaxed text-white/50">{featuredProduct.description}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-[#15EA3E]/30 bg-[#15EA3E]/10 px-3 py-1 text-[10px] font-black text-[#15EA3E]">
                    {formatMarketPrice(featuredProduct.villagePrice || featuredProduct.price, featuredProduct.currency)}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/44">
                    Prêt pour AfriSpay et Safari
                  </span>
                </div>
              </div>
              <div className="h-28 w-28 shrink-0 overflow-hidden rounded-[1.35rem] border border-white/10 bg-black">
                <img src={featuredProduct.coverURL || '/afrimarket.jpeg'} alt={featuredProduct.title} className="h-full w-full object-cover" />
              </div>
            </div>

            {secondaryPopularProducts.length > 0 && (
              <div className="relative z-10 mt-4 flex gap-2 overflow-x-auto scrollbar-hide">
                {secondaryPopularProducts.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      navigate(`/market/${product.id}`);
                    }}
                    className="flex min-w-[130px] items-center gap-2 rounded-2xl border border-white/10 bg-black/28 p-2 text-left"
                  >
                    <img src={product.coverURL || '/afrimarket.jpeg'} alt={product.title} className="h-10 w-10 shrink-0 rounded-xl object-cover" />
                    <div className="min-w-0">
                      <p className="truncate text-[10px] font-black text-white">{product.title}</p>
                      <p className="mt-0.5 text-[9px] font-bold text-[#15EA3E]">
                        {formatMarketPrice(product.villagePrice || product.price, product.currency)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {shelfSections.map((section) => {
        const products = getShelfProducts(filteredProducts.length ? filteredProducts : marketProducts, section);
        if (!products.length) return null;

        return (
          <section key={section} className="pb-4">
            <div className="mb-3 flex items-center justify-between px-4">
              <h2 className="text-xs font-black uppercase tracking-[0.18em] text-white/58">{section}</h2>
              <button type="button" onClick={() => setSortMode(section.includes('Top') ? 'village' : 'popular')} className="text-[10px] font-black text-[#15EA3E]">
                Voir
              </button>
            </div>
            <div className="scrollbar-hide flex gap-3 overflow-x-auto px-4">
              {products.map((product) => (
                <MiniMarketCard key={`${section}-${product.id}`} product={product} label={section.includes('AfriAI') ? 'AfriAI' : undefined} />
              ))}
            </div>
          </section>
        );
      })}

      <div className="mb-2 mt-2 flex items-center justify-between px-4">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Stands & Vitrines</h2>
          <p className="mt-1 text-[10px] font-semibold text-gray-600">Produits, services, Prix Village, AfriCoin et FPP</p>
        </div>
        <span className="text-[10px] font-black uppercase tracking-wider text-[#15EA3E]">{filteredProducts.length} actif(s)</span>
      </div>

      {error && (
        <div className="mx-4 mb-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-xs font-semibold text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <AfriSellIcon name="market" size={36} className="text-[#15EA3E]" />
          <p className="mt-4 text-sm font-black uppercase tracking-wide text-white">Chargement du marché</p>
        </div>
      ) : filteredProducts.length ? (
        <div className="grid grid-cols-2 gap-3 p-4 pb-24">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={toCheckoutProduct(product)} />
          ))}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center px-8 pb-24 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-gray-800 bg-[#050505] text-[#15EA3E]">
            <AfriSellIcon name="market" size={28} />
          </div>
          <h3 className="mt-5 text-lg font-black text-white">Aucune offre trouvée</h3>
          <p className="mt-2 text-sm leading-relaxed text-gray-500">
            Ajuste le canal, la catégorie ou la ville pour retrouver les offres disponibles.
          </p>
          <Link to="/feed" className="mt-5 rounded-2xl bg-[#15EA3E] px-5 py-3 text-xs font-black uppercase tracking-widest text-black">
            Publier sur ABC
          </Link>
        </div>
      )}
    </div>
  );
}
