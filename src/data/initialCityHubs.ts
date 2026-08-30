import { CityHub } from '../types';

export const INITIAL_CITY_HUBS: CityHub[] = [
  // Japan Cities / Hubs
  {
    id: 'hub-tokyo',
    destinationId: 'dest-japan',
    destinationName: 'Japan',
    regionId: 'region-jp-kanto',
    regionName: 'Kanto (Tokyo & Yokohama)',
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
    destinationId: 'dest-japan',
    destinationName: 'Japan',
    regionId: 'region-jp-kansai',
    regionName: 'Kansai (Kyoto, Osaka, Nara & Kobe)',
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
    destinationId: 'dest-japan',
    destinationName: 'Japan',
    regionId: 'region-jp-kansai',
    regionName: 'Kansai (Kyoto, Osaka, Nara & Kobe)',
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
    destinationId: 'dest-japan',
    destinationName: 'Japan',
    regionId: 'region-jp-chugoku',
    regionName: 'Chugoku (Hiroshima & Miyajima)',
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
    destinationId: 'dest-japan',
    destinationName: 'Japan',
    regionId: 'region-jp-chubu',
    regionName: 'Chubu & Mt. Fuji (Hakone & Takayama)',
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

  // UK Cities / Hubs
  {
    id: 'hub-london',
    destinationId: 'dest-uk',
    destinationName: 'United Kingdom',
    regionId: 'region-uk-london',
    regionName: 'Greater London',
    name: 'London',
    tagline: 'Global Capital of Royal Heritage & Theater',
    description: 'London combines imperial monuments, West End theaters, and world-class culinary experiences with private chauffeur services.',
    heroImage: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?q=80&w=1200&auto=format&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?q=80&w=1200&auto=format&fit=crop'
    ],
    productCount: 18,
    hotelCount: 6,
    displayOrder: 6,
    highlights: ['Tower of London Crown Jewels', 'Buckingham Palace State Rooms', 'Westminster Abbey Privileged Tour'],
    isPublished: true,
    status: 'ACTIVE'
  },
  {
    id: 'hub-edinburgh',
    destinationId: 'dest-uk',
    destinationName: 'United Kingdom',
    regionId: 'region-uk-scotland',
    regionName: 'Scotland (Edinburgh & Highlands)',
    name: 'Edinburgh',
    tagline: 'Royal Mile, Historic Castle & Scottish Lochs',
    description: 'Medieval Old Town grandeur, Edinburgh Castle vistas, and gateways to dramatic Scottish Highlands and whisky distilleries.',
    heroImage: 'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?q=80&w=1200&auto=format&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?q=80&w=1200&auto=format&fit=crop'
    ],
    productCount: 10,
    hotelCount: 4,
    displayOrder: 7,
    highlights: ['Edinburgh Castle Private Walk', 'Loch Ness & Glen Coe Tour', 'Royal Yacht Britannia VIP Tour'],
    isPublished: true,
    status: 'ACTIVE'
  },

  // Europe Cities / Hubs
  {
    id: 'hub-paris',
    destinationId: 'dest-europe',
    destinationName: 'Europe',
    regionId: 'region-eu-france',
    regionName: 'France (Paris & Côte d’Azur)',
    name: 'Paris',
    tagline: 'City of Light, Haute Couture & Grand Art',
    description: 'Iconic Eiffel vistas, Louvre curator tours, Versailles private apartments, and Seine river champagne dinner cruises.',
    heroImage: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=1200&auto=format&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=1200&auto=format&fit=crop'
    ],
    productCount: 16,
    hotelCount: 6,
    displayOrder: 8,
    highlights: ['Louvre Museum Docent Tour', 'Versailles Palace & Trianon Estate', 'Montmartre & Eiffel Tower VIP Access'],
    isPublished: true,
    status: 'ACTIVE'
  },
  {
    id: 'hub-rome',
    destinationId: 'dest-europe',
    destinationName: 'Europe',
    regionId: 'region-eu-italy',
    regionName: 'Italy (Rome, Florence, Venice & Amalfi)',
    name: 'Rome & Amalfi',
    tagline: 'Eternal City Antiquity & Coastal Panorama',
    description: 'Vatican Museums, Sistine Chapel morning private entry, Colosseum underground access, and cliffside Amalfi coast villas.',
    heroImage: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?q=80&w=1200&auto=format&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1552832230-c0197dd311b5?q=80&w=1200&auto=format&fit=crop'
    ],
    productCount: 12,
    hotelCount: 4,
    displayOrder: 9,
    highlights: ['Vatican & Sistine Chapel Private Access', 'Colosseum Underground & Arena', 'Amalfi Coast Luxury Chauffeur Drive'],
    isPublished: true,
    status: 'ACTIVE'
  },

  // Dubai & UAE Hubs
  {
    id: 'hub-dubai',
    destinationId: 'dest-dubai',
    destinationName: 'Dubai & UAE',
    regionId: 'region-uae-dubai',
    regionName: 'Dubai (Downtown, Marina & Desert)',
    name: 'Dubai',
    tagline: 'Futuristic Architecture & Supercar Luxury',
    description: 'Burj Khalifa 148th floor VIP access, desert safari dune glamping, Palm Jumeirah private yacht charters, and Michelin dining.',
    heroImage: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?q=80&w=1200&auto=format&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?q=80&w=1200&auto=format&fit=crop'
    ],
    productCount: 12,
    hotelCount: 5,
    displayOrder: 10,
    highlights: ['Burj Khalifa Sky Lounge VIP Access', 'Desert Conservation Safari & Starlit Dinner', 'Dubai Marina Private Superyacht Cruise'],
    isPublished: true,
    status: 'ACTIVE'
  },

  // Thailand Cities / Hubs
  {
    id: 'hub-bangkok',
    destinationId: 'dest-thailand',
    destinationName: 'Thailand',
    regionId: 'region-th-bangkok',
    regionName: 'Bangkok & Central Thailand',
    name: 'Bangkok',
    tagline: 'City of Angels & Golden Temple Splendor',
    description: 'Vibrant Thai capital where ornate riverside temples contrast with mega-luxury lifestyle malls and bustling night markets.',
    heroImage: 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?q=80&w=1200&auto=format&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1508009603885-50cf7c579365?q=80&w=1200&auto=format&fit=crop'
    ],
    productCount: 8,
    hotelCount: 4,
    displayOrder: 11,
    highlights: ['Grand Palace & Wat Phra Kaew', 'Chao Phraya Luxury Dinner Cruise', 'Wat Arun Dawn Temple'],
    isPublished: true,
    status: 'ACTIVE'
  },
  {
    id: 'hub-phuket',
    destinationId: 'dest-thailand',
    destinationName: 'Thailand',
    regionId: 'region-th-phuket',
    regionName: 'Phuket, Krabi & Andaman Islands',
    name: 'Phuket',
    tagline: 'Andaman Pearl & Private Island Speedboats',
    description: 'Thailand’s largest island paradise featuring pristine turquoise bays, limestone karsts, and five-star cliffside pool villas.',
    heroImage: 'https://images.unsplash.com/photo-1589394815804-964ed0be2eb5?q=80&w=1200&auto=format&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1589394815804-964ed0be2eb5?q=80&w=1200&auto=format&fit=crop'
    ],
    productCount: 7,
    hotelCount: 5,
    displayOrder: 12,
    highlights: ['Phi Phi & Maya Bay Yacht Charter', 'Phang Nga Bay James Bond Island', 'Old Phuket Town Heritage Walking Tour'],
    isPublished: true,
    status: 'ACTIVE'
  }
];
