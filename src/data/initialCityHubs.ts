import { CityHub } from '../types';

export const INITIAL_CITY_HUBS: CityHub[] = [
  // Japan Cities / Hubs
  {
    id: 'hub-tokyo',
    destinationId: 'japan',
    destinationName: 'Japan',
    name: 'Tokyo',
    tagline: 'Futuristic Metropolis & Culinary Epicenter',
    description: 'Neon-lit skyscrapers meet tranquil Shinto shrines. Tokyo is the dynamic gateway to the Japanese archipelago, renowned for 3-star Michelin gastronomy and ultra-efficient transit.',
    heroImage: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?q=80&w=1200&auto=format&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?q=80&w=1200&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=1200&auto=format&fit=crop'
    ],
    productCount: 14,
    hotelCount: 6,
    displayOrder: 1,
    highlights: ['Shinjuku & Shibuya Nightscapes', 'Tsukiji Outer Fish Market', 'Imperial Palace Gardens', 'Ginza Designer Boutiques'],
    isPublished: true,
    status: 'ACTIVE'
  },
  {
    id: 'hub-kyoto',
    destinationId: 'japan',
    destinationName: 'Japan',
    name: 'Kyoto',
    tagline: 'Imperial Heritage, Zen Gardens & Geisha Quarters',
    description: 'The cultural soul of Japan with over 2,000 Buddhist temples and Shinto shrines, historic bamboo groves, and timeless tea ceremony pavilions.',
    heroImage: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200&auto=format&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200&auto=format&fit=crop'
    ],
    productCount: 10,
    hotelCount: 4,
    displayOrder: 2,
    highlights: ['Fushimi Inari Torii Shrine', 'Arashiyama Bamboo Forest', 'Gion Geisha District', 'Golden Pavilion (Kinkaku-ji)'],
    isPublished: true,
    status: 'ACTIVE'
  },
  {
    id: 'hub-osaka',
    destinationId: 'japan',
    destinationName: 'Japan',
    name: 'Osaka',
    tagline: 'Nation’s Kitchen & Vibrant Merchant Capital',
    description: 'A bustling commercial hub celebrated worldwide for street gastronomy, warm local humor, vibrant Dotonbori canals, and historic castle ramparts.',
    heroImage: 'https://images.unsplash.com/photo-1590559899731-a382839e5549?q=80&w=1200&auto=format&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1590559899731-a382839e5549?q=80&w=1200&auto=format&fit=crop'
    ],
    productCount: 8,
    hotelCount: 3,
    displayOrder: 3,
    highlights: ['Dotonbori Neon Glico Sign', 'Osaka Castle Park', 'Kuromon Ichiba Market', 'Umeda Sky Building'],
    isPublished: true,
    status: 'ACTIVE'
  },
  {
    id: 'hub-hiroshima',
    destinationId: 'japan',
    destinationName: 'Japan',
    name: 'Hiroshima & Miyajima',
    tagline: 'Peace Memorials & Floating Shinto Torii',
    description: 'A poignant city of peace complemented by Miyajima Island’s mystical floating shrine gate and wild roaming sacred deer.',
    heroImage: 'https://images.unsplash.com/photo-1578637387939-43c525550085?q=80&w=1200&auto=format&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1578637387939-43c525550085?q=80&w=1200&auto=format&fit=crop'
    ],
    productCount: 4,
    hotelCount: 2,
    displayOrder: 4,
    highlights: ['Miyajima Itsukushima Shrine', 'Peace Memorial Park & Genbaku Dome', 'Hiroshima Style Okonomiyaki'],
    isPublished: true,
    status: 'ACTIVE'
  },
  {
    id: 'hub-hakone',
    destinationId: 'japan',
    destinationName: 'Japan',
    name: 'Hakone & Mt. Fuji',
    tagline: 'Thermal Hot Springs & Iconic Fuji Vistas',
    description: 'Mountainous hot spring wonderland offering serene onsen retreats, Lake Ashi pirate boat cruises, and majestic views of Mount Fuji.',
    heroImage: 'https://images.unsplash.com/photo-1509023464722-18d996393ca8?q=80&w=1200&auto=format&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1509023464722-18d996393ca8?q=80&w=1200&auto=format&fit=crop'
    ],
    productCount: 5,
    hotelCount: 3,
    displayOrder: 5,
    highlights: ['Owakudani Volcanic Valley', 'Lake Ashi Sightseeing Cruise', 'Hakone Open-Air Museum'],
    isPublished: true,
    status: 'ACTIVE'
  },

  // Thailand Cities / Hubs
  {
    id: 'hub-bangkok',
    destinationId: 'southeast-asia',
    destinationName: 'Southeast Asia',
    name: 'Bangkok',
    tagline: 'City of Angels & Golden Temple Splendor',
    description: 'Vibrant Thai capital where ornate riverside temples contrast with mega-luxury lifestyle malls and bustling night markets.',
    heroImage: 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?q=80&w=1200&auto=format&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1508009603885-50cf7c579365?q=80&w=1200&auto=format&fit=crop'
    ],
    productCount: 8,
    hotelCount: 4,
    displayOrder: 1,
    highlights: ['Grand Palace & Wat Phra Kaew', 'Chao Phraya Luxury Dinner Cruise', 'Wat Arun Dawn Temple'],
    isPublished: true,
    status: 'ACTIVE'
  },
  {
    id: 'hub-phuket',
    destinationId: 'southeast-asia',
    destinationName: 'Southeast Asia',
    name: 'Phuket',
    tagline: 'Andaman Pearl & Private Island Speedboats',
    description: 'Thailand’s largest island paradise featuring pristine turquoise bays, limestone karsts, and five-star cliffside pool villas.',
    heroImage: 'https://images.unsplash.com/photo-1589394815804-964ed0be2eb5?q=80&w=1200&auto=format&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1589394815804-964ed0be2eb5?q=80&w=1200&auto=format&fit=crop'
    ],
    productCount: 7,
    hotelCount: 5,
    displayOrder: 2,
    highlights: ['Phi Phi & Maya Bay Yacht Charter', 'Phang Nga Bay James Bond Island', 'Old Phuket Town Heritage Walking Tour'],
    isPublished: true,
    status: 'ACTIVE'
  }
];
