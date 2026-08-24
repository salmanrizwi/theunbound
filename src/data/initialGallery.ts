import { GalleryImage } from '../types';

export const INITIAL_GALLERY: GalleryImage[] = [
  {
    id: 'gal-01',
    imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=800&auto=format&fit=crop',
    caption: 'Private tea masterclass in Uji with our licensed specialist.',
    customerName: 'The Harrison Family',
    destination: 'Japan (Kyoto)',
    displayOrder: 1,
    isPublished: true,
    tags: ['Culture', 'Kyoto', 'VIP Guide'],
    createdAt: '2026-06-10'
  },
  {
    id: 'gal-02',
    imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=800&auto=format&fit=crop',
    caption: 'Sunset catamaran cruise along the cliffs of Amalfi.',
    customerName: 'David & Claire Vance',
    destination: 'Western Europe (Italy)',
    displayOrder: 2,
    isPublished: true,
    tags: ['Luxury Yacht', 'Amalfi Coast'],
    createdAt: '2026-06-18'
  },
  {
    id: 'gal-03',
    imageUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=800&auto=format&fit=crop',
    caption: 'Cherry blossom viewing and private chef dining in Tokyo.',
    customerName: 'Aria Travel Group (B2B Client)',
    destination: 'Japan (Tokyo)',
    displayOrder: 3,
    isPublished: true,
    tags: ['Sakura', 'Fine Dining'],
    createdAt: '2026-07-02'
  },
  {
    id: 'gal-04',
    imageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=800&auto=format&fit=crop',
    caption: 'Private Scottish Castle tour with royal historian.',
    customerName: 'Lord & Lady Sterling',
    destination: 'United Kingdom (Highlands)',
    displayOrder: 4,
    isPublished: true,
    tags: ['Highlands', 'Heritage'],
    createdAt: '2026-07-15'
  },
  {
    id: 'gal-05',
    imageUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=800&auto=format&fit=crop',
    caption: 'Phi Phi island speedboat charter with marine biologist.',
    customerName: 'Elena Rostova & Guests',
    destination: 'Southeast Asia (Thailand)',
    displayOrder: 5,
    isPublished: true,
    tags: ['Island', 'Yacht'],
    createdAt: '2026-07-28'
  },
  {
    id: 'gal-06',
    imageUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=800&auto=format&fit=crop',
    caption: 'Private bullet train escort and luggage concierge in Hakone.',
    customerName: 'Marcus Sterling',
    destination: 'Japan (Hakone)',
    displayOrder: 6,
    isPublished: true,
    tags: ['Shinkansen', 'Mount Fuji'],
    createdAt: '2026-08-04'
  }
];
