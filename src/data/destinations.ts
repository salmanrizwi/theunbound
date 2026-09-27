import { Destination } from '../types';

export const DESTINATIONS: Destination[] = [
  {
    id: 'dest-japan',
    name: 'Japan',
    slug: 'japan',
    country: 'Japan',
    regionId: 'reg-east-asia',
    regionName: 'East Asia',
    region: 'JAPAN',
    regions: [
      { id: 'region-jp-kanto', destinationId: 'dest-japan', destinationName: 'Japan', name: 'Kanto (Tokyo & Yokohama)', slug: 'kanto', description: 'Metropolitan pulse, futuristic districts, and traditional shrines.' },
      { id: 'region-jp-kansai', destinationId: 'dest-japan', destinationName: 'Japan', name: 'Kansai (Kyoto, Osaka, Nara & Kobe)', slug: 'kansai', description: 'Ancient imperial temples, Zen gardens, and culinary street gastronomy.' },
      { id: 'region-jp-chubu', destinationId: 'dest-japan', destinationName: 'Japan', name: 'Chubu & Mt. Fuji (Hakone & Takayama)', slug: 'chubu', description: 'Majestic Fuji vistas, thermal onsen resorts, and preserved Edo post towns.' },
      { id: 'region-jp-chugoku', destinationId: 'dest-japan', destinationName: 'Japan', name: 'Chugoku (Hiroshima & Miyajima)', slug: 'chugoku', description: 'Peace monuments and the floating vermillion Torii gate of Itsukushima.' },
      { id: 'region-jp-hokkaido', destinationId: 'dest-japan', destinationName: 'Japan', name: 'Hokkaido (Sapporo & Niseko)', slug: 'hokkaido', description: 'Pristine powder snow, volcanic calderas, and premium seafood.' },
      { id: 'region-jp-kyushu', destinationId: 'dest-japan', destinationName: 'Japan', name: 'Kyushu & Okinawa (Fukuoka & Naha)', slug: 'kyushu', description: 'Subtropical islands, geothermal hot springs, and samurai castles.' }
    ],
    heroImage: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1600&auto=format&fit=crop',
    tagline: 'Precision, heritage, ultra-modern luxury, and Michelin-starred hospitality.',
    description: 'Discover curated ryokans, private tea ceremonies, Shinkansen bullet train logistics, Mt. Fuji helicopter transfers, and VIP access across ancient and futuristic Japan.',
    keySellingPoints: [
      'Seamless high-speed transit and door-to-door luggage handling',
      'Exclusive private access to UNESCO shrines and master craftsmen',
      'Michelin-caliber culinary tours and private sake tastings',
      'Bespoke onsen & ryokan properties in Hakone, Kyoto & Hokkaido'
    ],
    bestTimeToVisit: 'March–May (Cherry Blossom) & October–November (Autumn Foliage)',
    idealTripDuration: '10–14 Days',
    travelStyle: 'Bespoke Luxury, Cultural Immersion & Gastronomy',
    currency: 'JPY',
    highlights: [
      'Mount Fuji private guided expeditions & Five Lakes onsens',
      'Kyoto Gion geisha district evening cultural walks',
      'Tokyo Tsukiji & Toyosu VIP sushi masterclasses',
      'Hiroshima Peace Memorial & Miyajima Island private cruise'
    ],
    cities: [
      {
        id: 'tokyo',
        name: 'Tokyo',
        tagline: 'Neon skyline meets centuries of Edo tradition',
        image: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=800&auto=format&fit=crop',
        productCount: 18
      },
      {
        id: 'kyoto',
        name: 'Kyoto',
        tagline: 'The cultural soul of shrines, bamboo groves and geishas',
        image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=800&auto=format&fit=crop',
        productCount: 14
      },
      {
        id: 'osaka',
        name: 'Osaka',
        tagline: 'The vibrant culinary and merchant capital of the Kansai region',
        image: 'https://images.unsplash.com/photo-1590559899731-a382839e5549?q=80&w=800&auto=format&fit=crop',
        productCount: 9
      },
      {
        id: 'hakone',
        name: 'Hakone & Mt. Fuji',
        tagline: 'Thermal springs, open-air art museums and volcanic vistas',
        image: 'https://images.unsplash.com/photo-1578637387939-43c525550085?q=80&w=800&auto=format&fit=crop',
        productCount: 8
      },
      {
        id: 'hiroshima',
        name: 'Hiroshima & Miyajima',
        tagline: 'Historic peace architecture and floating torii gates',
        image: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?q=80&w=800&auto=format&fit=crop',
        productCount: 6
      },
      {
        id: 'nara',
        name: 'Nara',
        tagline: 'Ancient temples and free-roaming sacred sika deer',
        image: 'https://images.unsplash.com/photo-1504109586057-7a2ae83d1338?q=80&w=800&auto=format&fit=crop',
        productCount: 5
      }
    ],
    featuredProductIds: ['jp-tok-01', 'jp-kyo-01', 'jp-fuji-01', 'jp-trf-01'],
    status: 'ACTIVE'
  },
  {
    id: 'dest-uk',
    name: 'United Kingdom',
    slug: 'united-kingdom',
    country: 'United Kingdom',
    regionId: 'reg-western-europe',
    regionName: 'Western Europe',
    region: 'UNITED_KINGDOM',
    regions: [
      { id: 'region-uk-london', destinationId: 'dest-uk', destinationName: 'United Kingdom', name: 'Greater London', slug: 'greater-london', description: 'Westminster, Royal parks, Mayfair luxury, and West End theatres.' },
      { id: 'region-uk-cotswolds', destinationId: 'dest-uk', destinationName: 'United Kingdom', name: 'Cotswolds, Bath & South England', slug: 'cotswolds-south', description: 'Honey-stone villages, Roman thermal spas, and stately manor houses.' },
      { id: 'region-uk-scotland', destinationId: 'dest-uk', destinationName: 'United Kingdom', name: 'Scotland (Edinburgh & Highlands)', slug: 'scotland', description: 'Medieval castle fortresses, Isle of Skye lochs, and single-malt distilleries.' },
      { id: 'region-uk-oxford', destinationId: 'dest-uk', destinationName: 'United Kingdom', name: 'Oxford, Cambridge & Heart of England', slug: 'oxford-cambridge', description: 'Academic spires, historic university quadrangles, and Shakespeare heritage.' }
    ],
    heroImage: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?q=80&w=1600&auto=format&fit=crop',
    tagline: 'Regal heritage, rolling countryside manors, and world-class theatrical culture.',
    description: 'Bespoke DMC solutions across England, Scotland, Wales, and Northern Ireland. From private royal palace viewings and vintage chauffeur tours to Scottish Highlands castle retreats.',
    keySellingPoints: [
      'Official Blue Badge certified private expert tour guides',
      'VIP access to royal palaces, West End theaters & Premier League suites',
      'Bespoke Scottish Highlands whisky distillery private charters',
      'Direct partnerships with five-star Mayfair and countryside boutique estates'
    ],
    bestTimeToVisit: 'May–September (Pleasant Summer) & December (Festive London & Edinburgh)',
    idealTripDuration: '7–12 Days',
    travelStyle: 'Royal Heritage, Countryside Estates & High Culture',
    currency: 'GBP',
    highlights: [
      'Tower of London private after-hours Crown Jewels viewing',
      'Cotswolds private honey-stone village chauffeur excursion',
      'Edinburgh Castle & Loch Ness Highlands private charter',
      'Oxford & Cambridge private punt with University fellows'
    ],
    cities: [
      {
        id: 'london',
        name: 'London',
        tagline: 'Global metropolis of royal pageantry, world-class theater and gastronomy',
        image: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?q=80&w=800&auto=format&fit=crop',
        productCount: 22
      },
      {
        id: 'edinburgh',
        name: 'Edinburgh & Highlands',
        tagline: 'Cobblestone Royal Mile, dramatic crags, and clan castle legends',
        image: 'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?q=80&w=800&auto=format&fit=crop',
        productCount: 12
      },
      {
        id: 'cotswolds',
        name: 'The Cotswolds & Bath',
        tagline: 'Quintessential English charm, Roman thermal baths, and manor hospitality',
        image: 'https://images.unsplash.com/photo-1596701062351-8c2c14d1fdd0?q=80&w=800&auto=format&fit=crop',
        productCount: 9
      },
      {
        id: 'oxford',
        name: 'Oxford & Cambridge',
        tagline: 'Dreaming spires, ancient libraries, and scholarly riverside lawns',
        image: 'https://images.unsplash.com/photo-1548013146-72479768bada?q=80&w=800&auto=format&fit=crop',
        productCount: 7
      }
    ],
    featuredProductIds: ['uk-lon-01', 'uk-cots-01', 'uk-edi-01', 'uk-trf-01'],
    status: 'INACTIVE'
  },
  {
    id: 'dest-europe',
    name: 'Europe',
    slug: 'europe',
    country: 'Continental Europe',
    regionId: 'reg-western-europe',
    regionName: 'Western Europe',
    region: 'EUROPE',
    regions: [
      { id: 'region-eu-france', destinationId: 'dest-europe', destinationName: 'Europe', name: 'France (Paris & Côte d’Azur)', slug: 'france', description: 'Louvre curators, Eiffel vistas, Champagne vineyards, and Riviera superyachts.' },
      { id: 'region-eu-italy', destinationId: 'dest-europe', destinationName: 'Europe', name: 'Italy (Rome, Florence, Venice & Amalfi)', slug: 'italy', description: 'Vatican treasures, Renaissance art galleries, and Mediterranean coastlines.' },
      { id: 'region-eu-switzerland', destinationId: 'dest-europe', destinationName: 'Europe', name: 'Switzerland (Zurich, Lucerne & Alps)', slug: 'switzerland', description: 'Glacier Express panoramic rail, Jungfraujoch summit, and luxury chalets.' },
      { id: 'region-eu-spain', destinationId: 'dest-europe', destinationName: 'Europe', name: 'Spain (Barcelona & Madrid)', slug: 'spain', description: 'Gaudí architecture, flamenco tablaos, and royal palaces.' },
      { id: 'region-eu-netherlands', destinationId: 'dest-europe', destinationName: 'Europe', name: 'Netherlands (Amsterdam)', slug: 'netherlands', description: 'UNESCO canal rings, Rijksmuseum masters, and boutique townhouse hotels.' }
    ],
    heroImage: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=1600&auto=format&fit=crop',
    tagline: 'Timeless romance, Renaissance art capitals, Alpine summits, and Mediterranean Riviera.',
    description: 'Comprehensive cross-border DMC logistics covering France, Italy, Switzerland, Spain, Netherlands, and Central Europe. Direct contract hotel allotments, private yachts, and high-speed rail packages.',
    keySellingPoints: [
      'Pan-European multi-country seamless itinerary routing and transfers',
      'Exclusive skip-the-line museum docents (Louvre, Vatican, Uffizi, Prado)',
      'Scenic Alpine express rail bookings (Glacier Express, Bernina)',
      'Bespoke Mediterranean private yacht charters & Amalfi private drivers'
    ],
    bestTimeToVisit: 'April–June (Spring Blossoms) & September–October (Wine Harvest Season)',
    idealTripDuration: '10–21 Days',
    travelStyle: 'Grand Tour Luxury, Wine & Culinary Journeys, Scenic Rail',
    currency: 'EUR',
    highlights: [
      'Paris Louvre museum private after-hours curator tour',
      'Rome Vatican & Sistine Chapel early morning private access',
      'Swiss Alps Jungfraujoch & Glacier Express 1st class panoramic journey',
      'Amalfi Coast private vintage speedboat charter'
    ],
    cities: [
      {
        id: 'paris',
        name: 'Paris',
        tagline: 'City of light, haute couture, world-leading art, and culinary perfection',
        image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=800&auto=format&fit=crop',
        productCount: 24
      },
      {
        id: 'rome',
        name: 'Rome & Amalfi',
        tagline: 'Eternal city monuments, Roman cuisine, and cliffside coastal panoramas',
        image: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?q=80&w=800&auto=format&fit=crop',
        productCount: 19
      },
      {
        id: 'zurich',
        name: 'Zurich & Swiss Alps',
        tagline: 'Pristine mountain lakes, luxury chronometry, and panoramic rail',
        image: 'https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?q=80&w=800&auto=format&fit=crop',
        productCount: 15
      },
      {
        id: 'barcelona',
        name: 'Barcelona & Madrid',
        tagline: 'Gaudí modernism, tapas culture, and vibrant Iberian flair',
        image: 'https://images.unsplash.com/photo-1583422409516-2895a77efded?q=80&w=800&auto=format&fit=crop',
        productCount: 13
      },
      {
        id: 'amsterdam',
        name: 'Amsterdam',
        tagline: 'Canal rings, Golden Age masters, and charming boutique merchant houses',
        image: 'https://images.unsplash.com/photo-1512470876302-972faa2aa9a4?q=80&w=800&auto=format&fit=crop',
        productCount: 11
      }
    ],
    featuredProductIds: ['eu-par-01', 'eu-rom-01', 'eu-swi-01', 'eu-bar-01'],
    status: 'INACTIVE'
  },
  {
    id: 'dest-dubai',
    name: 'Dubai & UAE',
    slug: 'dubai',
    country: 'United Arab Emirates',
    regionId: 'reg-middle-east',
    regionName: 'Middle East & Arabian Gulf',
    region: 'MIDDLE_EAST',
    regions: [
      { id: 'region-uae-dubai', destinationId: 'dest-dubai', destinationName: 'Dubai & UAE', name: 'Dubai (Downtown, Marina & Desert)', slug: 'dubai', description: 'Burj Khalifa VIP access, superyacht charters, and luxury desert glamping.' },
      { id: 'region-uae-abudhabi', destinationId: 'dest-dubai', destinationName: 'Dubai & UAE', name: 'Abu Dhabi (Louvre & Yas Island)', slug: 'abu-dhabi', description: 'Grand Mosque architecture, Ferrari World, and Saadiyat Island resorts.' }
    ],
    heroImage: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?q=80&w=1600&auto=format&fit=crop',
    tagline: 'Futuristic architectural wonders, private desert luxury, and Michelin gastronomy.',
    description: 'Premier UAE DMC services spanning Dubai, Abu Dhabi, and Ras Al Khaimah. Luxury chauffeur logistics, private yacht charters, Burj Khalifa VIP lounges, and bespoke desert glamping retreats.',
    keySellingPoints: [
      'Dedicated Arabic and English licensed private tour guides',
      'VIP Burj Al Arab & Burj Khalifa 148th Sky Lounge private access',
      'Chauffeur Mercedes-Maybach and Rolls-Royce fleet transfers',
      'Private desert safari with Michelin-curated dune dining'
    ],
    bestTimeToVisit: 'November–March (Pleasant Winter)',
    idealTripDuration: '5–8 Days',
    travelStyle: 'Ultra Luxury, Desert Glamping & Supercar Charters',
    currency: 'AED',
    highlights: [
      'Burj Khalifa VIP 148th Sky Lounge & Private Chauffeur',
      'Heritage Vintage Land Rover Desert Safari & Royal Dinner',
      'Dubai Marina Private 65ft Luxury Superyacht Charter',
      'Abu Dhabi Louvre & Sheikh Zayed Grand Mosque VIP Excursion'
    ],
    cities: [
      {
        id: 'dubai-city',
        name: 'Dubai Downtown & Marina',
        tagline: 'Gleaming skyscrapers, Palm Jumeirah luxury, and high-end shopping',
        image: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?q=80&w=800&auto=format&fit=crop',
        productCount: 16
      },
      {
        id: 'abu-dhabi',
        name: 'Abu Dhabi',
        tagline: 'Grand mosques, cultural Louvre masterpieces, and Yas Island estates',
        image: 'https://images.unsplash.com/photo-1518684079-3c830dcef090?q=80&w=800&auto=format&fit=crop',
        productCount: 8
      }
    ],
    featuredProductIds: ['dxb-tour-01', 'dxb-yacht-01', 'dxb-trf-01'],
    status: 'INACTIVE'
  },
  {
    id: 'dest-thailand',
    name: 'Thailand',
    slug: 'thailand',
    country: 'Thailand',
    regionId: 'reg-southeast-asia',
    regionName: 'Southeast Asia',
    region: 'SOUTHEAST_ASIA',
    regions: [
      { id: 'region-th-bangkok', destinationId: 'dest-thailand', destinationName: 'Thailand', name: 'Bangkok & Central Thailand', slug: 'bangkok-central', description: 'Grand Palace, Chao Phraya canal cruises, and Michelin culinary street scenes.' },
      { id: 'region-th-phuket', destinationId: 'dest-thailand', destinationName: 'Thailand', name: 'Phuket, Krabi & Andaman Islands', slug: 'phuket-andaman', description: 'Emerald seas, Phang Nga karst cliffs, and private luxury speedboats.' },
      { id: 'region-th-chiangmai', destinationId: 'dest-thailand', destinationName: 'Thailand', name: 'Chiang Mai & Northern Highlands', slug: 'chiang-mai', description: 'Ethical elephant sanctuaries, Lanna heritage, and mountain tea plantations.' }
    ],
    heroImage: 'https://images.unsplash.com/photo-1528181304800-259b08848526?q=80&w=1600&auto=format&fit=crop',
    tagline: 'Golden temples, tropical island retreats, and authentic royal Thai hospitality.',
    description: 'Direct DMC ground handling across Bangkok, Phuket, Koh Samui, and Chiang Mai. Luxury private longtail charters, ethical elephant sanctuaries, and private rooftop dining.',
    keySellingPoints: [
      'Certified English speaking licensed Thai tour guides',
      'Exclusive private speedboat charters across Phang Nga Bay & Phi Phi',
      'Luxury wellness spa packages and five-star resort allotments',
      'Direct airport fast-track immigration and chauffeur van handling'
    ],
    bestTimeToVisit: 'November–April (Dry & Sunny Season)',
    idealTripDuration: '8–14 Days',
    travelStyle: 'Tropical Luxury, Island Hopping & Cultural Exploration',
    currency: 'THB',
    highlights: [
      'Bangkok Grand Palace & Chao Phraya Private Canal Cruise',
      'Phuket to Phi Phi Islands Private Speedboat Expedition',
      'Chiang Mai Ethical Elephant Sanctuary & Hilltribe Experience',
      'Koh Samui Luxury Catamaran Sunset Charter'
    ],
    cities: [
      {
        id: 'bangkok',
        name: 'Bangkok',
        tagline: 'Vibrant capital of royal palaces, Michelin street food, and rooftop lounges',
        image: 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?q=80&w=800&auto=format&fit=crop',
        productCount: 14
      },
      {
        id: 'phuket',
        name: 'Phuket & Krabi',
        tagline: 'Emerald Andaman waters, limestone karst cliffs, and private island villas',
        image: 'https://images.unsplash.com/photo-1589394815804-964ed0be2eb5?q=80&w=800&auto=format&fit=crop',
        productCount: 12
      }
    ],
    featuredProductIds: ['th-bkk-01', 'th-phu-01'],
    status: 'INACTIVE'
  },
  {
    id: 'dest-malaysia',
    name: 'Malaysia',
    slug: 'malaysia',
    country: 'Malaysia',
    regionId: 'reg-southeast-asia',
    regionName: 'Southeast Asia',
    region: 'SOUTHEAST_ASIA',
    regions: [
      { id: 'region-my-kl', destinationId: 'dest-malaysia', destinationName: 'Malaysia', name: 'Kuala Lumpur & Selangor', slug: 'kl-selangor', description: 'Petronas Towers, Batu Caves, and vibrant metropolitan lifestyle.' },
      { id: 'region-my-genting', destinationId: 'dest-malaysia', destinationName: 'Malaysia', name: 'Genting Highlands & Pahang', slug: 'genting-pahang', description: 'Highland theme parks, cable cars, and cool mountain retreats.' },
      { id: 'region-my-langkawi', destinationId: 'dest-malaysia', destinationName: 'Malaysia', name: 'Langkawi & Kedah', slug: 'langkawi', description: 'UNESCO Global Geopark, duty-free island beaches, and luxury yacht charters.' },
      { id: 'region-my-penang', destinationId: 'dest-malaysia', destinationName: 'Malaysia', name: 'Penang & George Town', slug: 'penang', description: 'UNESCO heritage street art, colonial mansions, and world-renowned street food.' },
      { id: 'region-my-johor', destinationId: 'dest-malaysia', destinationName: 'Malaysia', name: 'Johor & Desaru Coast', slug: 'johor', description: 'Desaru Coast luxury resorts, golf courses, and Legoland Malaysia.' }
    ],
    heroImage: 'https://images.unsplash.com/photo-1596422846543-75c6fc197f07?q=80&w=1600&auto=format&fit=crop',
    tagline: 'Futuristic skylines, lush tropical rainforests, and diverse cultural gastronomy.',
    description: 'Comprehensive Malaysia DMC ground handling across Kuala Lumpur, Genting Highlands, Langkawi, Penang, and Desaru Coast. Private transfers, theme park ticketing, and 5-star allotments.',
    keySellingPoints: [
      'Seamless intercity private transfers (KL - Genting - Penang)',
      'Direct partnerships with Sunway, Genting Resorts World & luxury hotel chains',
      'Certified multilingual tour guides and private airport fast-track',
      'Exclusive Langkawi private catamaran & island hopping charters'
    ],
    bestTimeToVisit: 'Year-Round (Tropical Sunshine)',
    idealTripDuration: '5–9 Days',
    travelStyle: 'Family Fun, Urban Luxury, Island Escapes & Culinary Heritage',
    currency: 'USD',
    highlights: [
      'Petronas Twin Towers Observation Deck & Private City Tour',
      'Genting Highlands Awana SkyWay Cable Car & SkyWorlds Theme Park',
      'Langkawi UNESCO Geopark Mangrove & Sunset Dinner Cruise',
      'Penang George Town Heritage Walking & Street Food Trail'
    ],
    cities: [
      { id: 'kuala-lumpur', name: 'Kuala Lumpur', tagline: 'Petronas Towers, Batu Caves and culinary nightlife', image: 'https://images.unsplash.com/photo-1596422846543-75c6fc197f07?q=80&w=800&auto=format&fit=crop', productCount: 16 },
      { id: 'genting-highlands', name: 'Genting Highlands', tagline: 'Cool mountain climate, theme parks and cable cars', image: 'https://images.unsplash.com/photo-1584646098378-0874589d76b1?q=80&w=800&auto=format&fit=crop', productCount: 10 },
      { id: 'langkawi', name: 'Langkawi', tagline: 'Duty-free archipelago of emerald bays and limestone karsts', image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?q=80&w=800&auto=format&fit=crop', productCount: 12 },
      { id: 'penang', name: 'Penang', tagline: 'UNESCO George Town heritage, street art and food capital', image: 'https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?q=80&w=800&auto=format&fit=crop', productCount: 8 },
      { id: 'johor-bahru', name: 'Johor Bahru', tagline: 'Family theme parks, Desaru Coast and Johor Straits', image: 'https://images.unsplash.com/photo-1570789210967-2cac24afeb00?q=80&w=800&auto=format&fit=crop', productCount: 6 }
    ],
    featuredProductIds: ['my-kl-01', 'my-gent-01', 'my-lang-01'],
    status: 'INACTIVE'
  },
  {
    id: 'dest-singapore',
    name: 'Singapore',
    slug: 'singapore',
    country: 'Singapore',
    regionId: 'reg-southeast-asia',
    regionName: 'Southeast Asia',
    region: 'SOUTHEAST_ASIA',
    regions: [
      { id: 'region-sg-downtown', destinationId: 'dest-singapore', destinationName: 'Singapore', name: 'Downtown & Marina Bay', slug: 'marina-bay', description: 'Marina Bay Sands, Gardens by the Bay, and Singapore Flyer.' },
      { id: 'region-sg-sentosa', destinationId: 'dest-singapore', destinationName: 'Singapore', name: 'Sentosa Island & HarbourFront', slug: 'sentosa', description: 'Universal Studios Singapore, S.E.A. Aquarium, and luxury beach resorts.' },
      { id: 'region-sg-orchard', destinationId: 'dest-singapore', destinationName: 'Singapore', name: 'Orchard Road & Civic District', slug: 'orchard', description: 'Premier shopping avenues, heritage museums, and Michelin dining.' }
    ],
    heroImage: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?q=80&w=1600&auto=format&fit=crop',
    tagline: 'Futuristic Garden City, luxury retail, and iconic Marina Bay attractions.',
    description: 'Premier Singapore DMC operations offering VIP meet-and-greet, Gardens by the Bay private access, Sentosa island luxury passes, and bespoke city discovery.',
    keySellingPoints: [
      'Official B2B ticketing partner for Universal Studios & Gardens by the Bay',
      'Guaranteed fast-track chauffeur airport arrival services',
      'Exclusive Singapore River private charter & Marina Bay Sands VIP viewings',
      'Preferred room allotments at Marina Bay Sands and Sentosa resorts'
    ],
    bestTimeToVisit: 'Year-Round (High Energy & Events)',
    idealTripDuration: '3–6 Days',
    travelStyle: 'Urban Luxury, Family Entertainment & MICE',
    currency: 'SGD',
    highlights: [
      'Gardens by the Bay Flower Dome, Cloud Forest & Supertree Observatory',
      'Sentosa Universal Studios Singapore VIP Experience',
      'Marina Bay Sands Skypark Observation Deck & Night River Cruise',
      'Singapore Night Safari Tram & Wildlife Reserve'
    ],
    cities: [
      { id: 'singapore-city', name: 'Singapore', tagline: 'Marina Bay skyline, Hawker centres and modern metropolis', image: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?q=80&w=800&auto=format&fit=crop', productCount: 20 },
      { id: 'downtown-core', name: 'Downtown', tagline: 'Iconic architecture, luxury shopping and waterfront dining', image: 'https://images.unsplash.com/photo-1565967511849-76a60a516170?q=80&w=800&auto=format&fit=crop', productCount: 14 },
      { id: 'sentosa', name: 'Sentosa', tagline: 'Tropical theme parks, beaches and luxury island resorts', image: 'https://images.unsplash.com/photo-1506351421178-63b52a2d15c2?q=80&w=800&auto=format&fit=crop', productCount: 12 }
    ],
    featuredProductIds: ['sg-mbs-01', 'sg-uss-01', 'sg-gard-01'],
    status: 'INACTIVE'
  },
  {
    id: 'dest-indonesia',
    name: 'Bali / Indonesia',
    slug: 'bali-indonesia',
    country: 'Indonesia',
    regionId: 'reg-southeast-asia',
    regionName: 'Southeast Asia',
    region: 'SOUTHEAST_ASIA',
    regions: [
      { id: 'region-id-south-bali', destinationId: 'dest-indonesia', destinationName: 'Bali / Indonesia', name: 'South Bali (Kuta, Seminyak, Nusa Dua, Canggu & Uluwatu)', slug: 'south-bali', description: 'Surfing beaches, beach clubs, cliffside temples, and 5-star resorts.' },
      { id: 'region-id-ubud', destinationId: 'dest-indonesia', destinationName: 'Bali / Indonesia', name: 'Ubud & Central Bali', slug: 'ubud-central', description: 'Lush jungles, Tegallalang rice terraces, sacred monkey forest, and wellness retreats.' },
      { id: 'region-id-islands', destinationId: 'dest-indonesia', destinationName: 'Bali / Indonesia', name: 'Nusa Islands & Gili (Nusa Penida & Gili)', slug: 'nusa-islands', description: 'Kelingking cliff, crystal bay manta rays, and turquoise island waters.' }
    ],
    heroImage: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?q=80&w=1600&auto=format&fit=crop',
    tagline: 'Island of the Gods, cliffside ocean temples, and bespoke private pool villas.',
    description: 'Expert Bali DMC solutions with private chauffeur vehicles, Nusa Penida fastboat charters, Uluwatu sunset Kecak fire dances, and bespoke Ubud wellness packages.',
    keySellingPoints: [
      'Private air-conditioned Toyota Innova & Alphard chauffeured tours',
      'Exclusive Nusa Penida private speedboat & VIP island transport',
      'Handpicked private luxury pool villas in Seminyak, Canggu & Ubud',
      'Direct contracts with Ayana, Bulgari, Mandapa, and Four Seasons Bali'
    ],
    bestTimeToVisit: 'April–October (Dry Season)',
    idealTripDuration: '6–10 Days',
    travelStyle: 'Tropical Luxury, Romantic Honeymoon & Spiritual Wellness',
    currency: 'USD',
    highlights: [
      'Ubud Sacred Monkey Forest & Tegallalang Rice Terrace Swing',
      'Uluwatu Sunset Cliff Temple & Kecak Fire Dance Show',
      'Nusa Penida Kelingking Cliff & Broken Beach Island Charter',
      'Mount Batur Sunrise Jeep 4WD & Natural Hot Springs'
    ],
    cities: [
      { id: 'kuta', name: 'Kuta', tagline: 'Bustling sunset beaches, shopping and surf culture', image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?q=80&w=800&auto=format&fit=crop', productCount: 8 },
      { id: 'seminyak', name: 'Seminyak', tagline: 'Chic beach clubs, designer boutiques and luxury pool villas', image: 'https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?q=80&w=800&auto=format&fit=crop', productCount: 12 },
      { id: 'ubud', name: 'Ubud', tagline: 'Cultural heartland, misty river valleys and jungle sanctuaries', image: 'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?q=80&w=800&auto=format&fit=crop', productCount: 14 },
      { id: 'nusa-dua', name: 'Nusa Dua', tagline: 'Gated enclave of 5-star beachfront resorts and calm waters', image: 'https://images.unsplash.com/photo-1573790387438-4da905039392?q=80&w=800&auto=format&fit=crop', productCount: 10 },
      { id: 'sanur', name: 'Sanur', tagline: 'Tranquil coastal promenade, sunrise views and island boats', image: 'https://images.unsplash.com/photo-1555400038-63f5ba517a47?q=80&w=800&auto=format&fit=crop', productCount: 6 },
      { id: 'gili-islands', name: 'Gili Islands', tagline: 'Motor-free tropical islands, coral reefs and turtle diving', image: 'https://images.unsplash.com/photo-1516690561799-46d8f74f9abf?q=80&w=800&auto=format&fit=crop', productCount: 6 },
      { id: 'nusa-penida', name: 'Nusa Penida', tagline: 'Dramatic Kelingking cliffs, manta rays and secret bays', image: 'https://images.unsplash.com/photo-1588668214407-6ea9a6d8c272?q=80&w=800&auto=format&fit=crop', productCount: 7 },
      { id: 'canggu', name: 'Canggu', tagline: 'Trendy cafes, surf breaks and sunset vibes', image: 'https://images.unsplash.com/photo-1577717903315-1691ae25ab3f?q=80&w=800&auto=format&fit=crop', productCount: 8 },
      { id: 'uluwatu', name: 'Uluwatu', tagline: 'Limestone sea cliffs, world-class surf and ocean clubs', image: 'https://images.unsplash.com/photo-1539367628448-4bc5c9d171c8?q=80&w=800&auto=format&fit=crop', productCount: 9 }
    ],
    featuredProductIds: ['id-ubud-01', 'id-ulu-01', 'id-penida-01'],
    status: 'INACTIVE'
  },
  {
    id: 'dest-vietnam',
    name: 'Vietnam',
    slug: 'vietnam',
    country: 'Vietnam',
    regionId: 'reg-southeast-asia',
    regionName: 'Southeast Asia',
    region: 'SOUTHEAST_ASIA',
    regions: [
      { id: 'region-vn-north', destinationId: 'dest-vietnam', destinationName: 'Vietnam', name: 'Northern Vietnam (Hanoi & Halong Bay)', slug: 'north-vietnam', description: 'French colonial Old Quarter, misty limestone karst bays, and overnight luxury cruises.' },
      { id: 'region-vn-central', destinationId: 'dest-vietnam', destinationName: 'Vietnam', name: 'Central Vietnam (Da Nang & Hoi An)', slug: 'central-vietnam', description: 'Golden Bridge in Ba Na Hills, lantern-lit ancient trading port, and sandy beaches.' },
      { id: 'region-vn-south', destinationId: 'dest-vietnam', destinationName: 'Vietnam', name: 'Southern Vietnam (Ho Chi Minh City & Phu Quoc)', slug: 'south-vietnam', description: 'Dynamic metropolis, Cu Chi tunnels, Mekong Delta, and tropical island resorts.' }
    ],
    heroImage: 'https://images.unsplash.com/photo-1528127269322-539801943592?q=80&w=1600&auto=format&fit=crop',
    tagline: 'Emerald karst bays, lantern-lit heritage towns, and world-acclaimed culinary art.',
    description: 'Specialized Vietnam DMC ground services covering Hanoi, Halong Bay overnight luxury cruises, Da Nang Golden Bridge, Hoi An ancient town, and Ho Chi Minh City.',
    keySellingPoints: [
      'Preferred allotments on 5-star Halong & Lan Ha Bay luxury cruise vessels',
      'Private chauffeured limousine vans and licensed English-speaking guides',
      'Exclusive Ba Na Hills Golden Bridge early VIP cable car passes',
      'Authentic Vietnamese street gastronomy and cooking masterclasses'
    ],
    bestTimeToVisit: 'October–April (Comfortable & Dry)',
    idealTripDuration: '7–12 Days',
    travelStyle: 'Scenic Cruising, Heritage Culture & Coastal Retreats',
    currency: 'USD',
    highlights: [
      'Halong Bay 5-Star Luxury Overnight Cruise & Kayaking',
      'Da Nang Ba Na Hills Golden Giant Hands Bridge & Cable Car',
      'Hoi An Ancient Town Lantern Evening & Basket Boat River Tour',
      'Hanoi French Old Quarter Street Food & Cyclo Tour'
    ],
    cities: [
      { id: 'hanoi', name: 'Hanoi', tagline: 'Centuries-old Old Quarter, lakes and French colonial charm', image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?q=80&w=800&auto=format&fit=crop', productCount: 14 },
      { id: 'halong-bay', name: 'Halong Bay', tagline: 'UNESCO limestone karst wonderland and luxury cruise waters', image: 'https://images.unsplash.com/photo-1528127269322-539801943592?q=80&w=800&auto=format&fit=crop', productCount: 10 },
      { id: 'da-nang', name: 'Da Nang', tagline: 'Dragon Bridge, Marble Mountains and Golden Bridge in Ba Na Hills', image: 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?q=80&w=800&auto=format&fit=crop', productCount: 9 },
      { id: 'hoi-an', name: 'Hoi An', tagline: 'Timeless UNESCO trading port with glowing silk lanterns', image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=800&auto=format&fit=crop', productCount: 11 },
      { id: 'ho-chi-minh-city', name: 'Ho Chi Minh City', tagline: 'Vibrant southern metropolis, rooftop bars and French architecture', image: 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?q=80&w=800&auto=format&fit=crop', productCount: 12 },
      { id: 'phu-quoc', name: 'Phu Quoc', tagline: 'Tropical white sand island with luxury beachfront resorts', image: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?q=80&w=800&auto=format&fit=crop', productCount: 7 }
    ],
    featuredProductIds: ['vn-han-01', 'vn-hal-01', 'vn-dan-01'],
    status: 'INACTIVE'
  }
];

export const UPCOMING_DESTINATIONS = [
  { name: 'USA & Canada', tag: 'Phase 3', flag: '🗽' },
  { name: 'Australia & New Zealand', tag: 'Phase 3', flag: '🦘' },
  { name: 'Africa & Safari', tag: 'Phase 3', flag: '🦁' },
  { name: 'CIS & Central Asia', tag: 'Phase 3', flag: '🏔️' },
];
