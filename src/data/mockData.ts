import { Product } from '../store/useAppStore';

export const mockProducts: Product[] = [
  {
    id: 'p1',
    name: 'Casques Audio Sans-Fil',
    seller: 'AfriTech Store',
    description: 'Son HD, réduction de bruit active. Parfait pour les voyages.',
    price: 150,
    villagePrice: 85,
    imageUrl: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?q=auto&w=500&h=800',
    buyersCount: 3,
    buyersNeeded: 5,
  },
  {
    id: 'p2',
    name: 'Wax Premium Hollandais',
    seller: 'Mama Africa Tex',
    description: 'Tissu wax de très haute qualité, 6 yards.',
    price: 120,
    villagePrice: 65,
    imageUrl: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=auto&w=500&h=800',
    buyersCount: 4,
    buyersNeeded: 10,
  },
  {
    id: 'p3',
    name: 'Kit Solaire Domestique',
    seller: 'EcoSun Énergie',
    description: 'Kit complet avec panneau 50W et 3 lampes LED.',
    price: 300,
    villagePrice: 150,
    imageUrl: 'https://images.unsplash.com/photo-1509391366360-515437eeab64?q=auto&w=500&h=800',
    buyersCount: 12,
    buyersNeeded: 15,
  },
];
