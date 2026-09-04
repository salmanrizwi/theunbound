import { B2BPackage } from '../types';

export const INITIAL_B2B_PACKAGES: B2BPackage[] = [
  {
    id: 'pkg-jp-golden-route-7n',
    title: 'Japan Golden Route Odyssey',
    slug: 'japan-golden-route-odyssey',
    destinationId: 'dest-japan',
    destinationName: 'Japan',
    durationDays: 8,
    durationNights: 7,
    heroImage: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200&auto=format&fit=crop',
    tagline: 'Tokyo • Mt Fuji & Hakone • Kyoto • Osaka Classic Multi-City Itinerary',
    description: 'The definitive luxury exploration of Japan combining ultra-modern Tokyo, scenic Mt Fuji hot spring ryokan retreats, Kyoto imperial shrines, and Osaka gastronomic markets with reserved Shinkansen bullet train transit.',
    routeSummary: ['Tokyo (3 Nights)', 'Hakone (1 Night)', 'Kyoto (2 Nights)', 'Osaka (1 Night)'],
    hotelsSummary: [
      {
        name: 'The Capitol Hotel Tokyu',
        cityName: 'Tokyo',
        nights: 3,
        roomType: 'Club Deluxe King Room',
        mealPlan: 'Bed & Breakfast'
      },
      {
        name: 'Gora Kadan Luxury Ryokan',
        cityName: 'Hakone',
        nights: 1,
        roomType: 'Traditional Tatami Suite with Private Onsen',
        mealPlan: 'Kaiseki Dinner & Breakfast'
      },
      {
        name: 'The Ritz-Carlton Kyoto',
        cityName: 'Kyoto',
        nights: 2,
        roomType: 'Kamogawa River View Deluxe Room',
        mealPlan: 'Bed & Breakfast'
      },
      {
        name: 'The St. Regis Osaka',
        cityName: 'Osaka',
        nights: 1,
        roomType: 'Grand Deluxe Room with Butler Service',
        mealPlan: 'Bed & Breakfast'
      }
    ],
    productIds: [
      'jp-tok-01', // Tokyo VIP Tour
      'jp-tok-02', // Haneda/Narita VIP Airport Chauffeur
      'jp-tok-04', // Mt Fuji & Hakone Private Tour
      'jp-kyo-01', // Kyoto Imperial Heritage Tour
      'jp-kyo-02', // Gion Tea Master Ceremony
      'jp-osa-01', // Osaka Street Food & Dotonbori Tour
      'jp-tra-01'  // 7-Day JR Whole Japan Green Car Pass
    ],
    highlights: [
      'Skip-the-line VIP entry to teamLab Planets & Shibuya Sky in Tokyo',
      'Private Kaiseki dinner & open-air volcanic onsen bath in Hakone',
      'Exclusive private tea ceremony with authentic Kyoto Geiko in Gion',
      'Shinkansen bullet train Green Car reserved tickets between all cities',
      'Dedicated 24/7 bilingual ground operations dispatch across all prefectures'
    ],
    inclusions: [
      '7 nights 5-Star luxury accommodation with daily breakfast',
      'Private airport VIP meet & greet and chauffeur transfers upon arrival & departure',
      'All listed private guided sightseeing tours with licensed English-speaking guides',
      'Shinkansen bullet train First-Class Green Car passes (Tokyo -> Hakone -> Kyoto -> Osaka)',
      '1x Authentic Traditional Multi-Course Kaiseki Dinner in Hakone',
      'All entrance tickets, museum fees, and toll/parking charges'
    ],
    exclusions: [
      'International flights and airline taxes',
      'Travel and medical insurance',
      'Personal incidental expenses and discretionary gratuities'
    ],
    baseNetCostUSD: 3450,
    finalSellingPriceUSD: 4650,
    suggestedSellingPriceUSD: 4650,
    currency: 'USD',
    tripType: 'LUXURY',
    tags: ['Best Seller', 'First Timers', 'Private Chauffeur', 'Green Car Shinkansen', 'High Margin'],
    isFeatured: true,
    isPublished: true,
    createdAt: '2026-01-10T10:00:00Z',
    updatedAt: '2026-02-15T12:00:00Z'
  },
  {
    id: 'pkg-uk-classic-britain-8n',
    title: 'Royal Britain: London, Cotswolds & Scottish Highlands',
    slug: 'royal-britain-london-cotswolds-highlands',
    destinationId: 'dest-uk',
    destinationName: 'United Kingdom',
    durationDays: 9,
    durationNights: 8,
    heroImage: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?q=80&w=1200&auto=format&fit=crop',
    tagline: 'London • Oxford & Cotswolds • Edinburgh & Loch Ness Luxury Expedition',
    description: 'An aristocratic journey spanning London private palace access, charming honey-stone Cotswolds hamlets, and the dramatic mist-shrouded lochs of the Scottish Highlands.',
    routeSummary: ['London (4 Nights)', 'Cotswolds & Bath (2 Nights)', 'Edinburgh (2 Nights)'],
    hotelsSummary: [
      {
        name: 'The Savoy London',
        cityName: 'London',
        nights: 4,
        roomType: 'River View Deluxe Suite',
        mealPlan: 'Full English Breakfast'
      },
      {
        name: 'The Gainsborough Bath Spa',
        cityName: 'Bath / Cotswolds',
        nights: 2,
        roomType: 'Thermal Spa Suite',
        mealPlan: 'Bed & Breakfast'
      },
      {
        name: 'The Balmoral Edinburgh',
        cityName: 'Edinburgh',
        nights: 2,
        roomType: 'Castle View Executive Suite',
        mealPlan: 'Scottish Highland Breakfast'
      }
    ],
    productIds: [
      'uk-lon-01', // Tower of London & Royal Palaces VIP Tour
      'uk-lon-02', // Heathrow Airport Chauffeur Transfer
      'uk-lon-03', // Windsor Castle, Stonehenge & Oxford Tour
      'uk-cots-01', // Cotswolds Villages & Manor House Tour
      'uk-edi-01', // Edinburgh Castle & Royal Mile Walking Tour
      'uk-edi-02', // Loch Ness & Scottish Highlands Day Tour
      'uk-tra-01'  // LNER First Class London to Edinburgh Train
    ],
    highlights: [
      'Private after-hours viewing of the Crown Jewels at the Tower of London',
      'Private chauffeur tour through Castle Combe and Bourton-on-the-Water in Cotswolds',
      'First Class LNER rail journey through the picturesque East Coast route',
      'Private malt whisky tasting and bagpipe welcome in Edinburgh Old Town',
      '24/7 dedicated UK ground duty manager support'
    ],
    inclusions: [
      '8 nights 5-Star luxury accommodations with gourmet breakfast',
      'Mercedes S-Class private airport transfers and day touring chauffeurs',
      'Blue Badge accredited English national guides for all excursions',
      'First Class rail transit London King’s Cross to Edinburgh Waverley',
      'All attraction skip-the-line admissions and private estate access'
    ],
    exclusions: [
      'International airfares',
      'UK visa processing fees',
      'Personal expenditures'
    ],
    baseNetCostUSD: 3890,
    finalSellingPriceUSD: 5250,
    suggestedSellingPriceUSD: 5250,
    currency: 'USD',
    tripType: 'CULTURAL',
    tags: ['Royal Heritage', '5★ Historic Stays', 'First Class Rail', 'Blue Badge Guides'],
    isFeatured: true,
    isPublished: true,
    createdAt: '2026-01-12T09:00:00Z',
    updatedAt: '2026-02-18T14:30:00Z'
  },
  {
    id: 'pkg-eu-grand-swiss-7n',
    title: 'Grand Swiss Alps & Glacier Panorama',
    slug: 'grand-swiss-alps-glacier-panorama',
    destinationId: 'dest-europe',
    destinationName: 'Europe',
    durationDays: 8,
    durationNights: 7,
    heroImage: 'https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?q=80&w=1200&auto=format&fit=crop',
    tagline: 'Zurich • Lucerne • Interlaken & Jungfrau • Zermatt & Matterhorn',
    description: 'Immerse your clients in breathtaking alpine splendor with Swiss First Class scenic rail passes, peak summit ascents up Jungfraujoch, and Matterhorn chalet luxury.',
    routeSummary: ['Zurich (1 Night)', 'Lucerne (2 Nights)', 'Interlaken (2 Nights)', 'Zermatt (2 Nights)'],
    hotelsSummary: [
      {
        name: 'Baur au Lac',
        cityName: 'Zurich',
        nights: 1,
        roomType: 'Deluxe Lake View Room',
        mealPlan: 'Swiss Buffet Breakfast'
      },
      {
        name: 'Bürgenstock Hotel & Alpine Spa',
        cityName: 'Lucerne',
        nights: 2,
        roomType: 'Panoramic Alpine Suite',
        mealPlan: 'Bed & Breakfast'
      },
      {
        name: 'Victoria-Jungfrau Grand Hotel & Spa',
        cityName: 'Interlaken',
        nights: 2,
        roomType: 'Superior Jungfrau View Room',
        mealPlan: 'Bed & Breakfast'
      },
      {
        name: 'The Chedi Andermatt / Mont Cervin Palace',
        cityName: 'Zermatt',
        nights: 2,
        roomType: 'Matterhorn Signature Suite',
        mealPlan: 'Bed & Breakfast'
      }
    ],
    productIds: [
      'eu-swi-01', // Swiss First Class Travel Pass (8 Days)
      'eu-swi-02', // Jungfraujoch Top of Europe Private Excursion
      'eu-swi-03', // Gornergrat Cogwheel Railway & Matterhorn Viewing
      'eu-swi-04', // Lake Lucerne Private Steam Yacht Charter
      'eu-zur-01'  // Zurich Airport VIP Chauffeur Transfer
    ],
    highlights: [
      '8-Day Swiss Travel Pass in First Class with unlimited panoramic trains & lake boats',
      'Cogwheel railway journey to Jungfraujoch – Top of Europe at 3,454m altitude',
      'Matterhorn Glacier Paradise cable car and Gornergrat viewing deck in Zermatt',
      'Panoramic Alpine infinity pool access overlooking Lake Lucerne at Bürgenstock',
      'Complimentary luggage forwarding between all Swiss mountain stations'
    ],
    inclusions: [
      '7 nights 5★ luxury alpine resort accommodations with breakfast',
      'Swiss Travel Pass First Class (8 Consecutive Days)',
      'All mountain cogwheel, funicular and cable car tickets included',
      'Private airport transfers in Zurich',
      'Station-to-station express luggage transfer service'
    ],
    exclusions: [
      'Flights to/from Switzerland',
      'Ski gear rentals or optional helicopter flightseeing',
      'Personal meals and city tourist taxes'
    ],
    baseNetCostUSD: 4120,
    finalSellingPriceUSD: 5690,
    suggestedSellingPriceUSD: 5690,
    currency: 'USD',
    tripType: 'LUXURY',
    tags: ['Alpine Luxury', 'Glacier Express', 'Swiss Travel Pass', 'Mountain Peaks'],
    isFeatured: true,
    isPublished: true,
    createdAt: '2026-01-15T11:00:00Z',
    updatedAt: '2026-02-20T16:00:00Z'
  },
  {
    id: 'pkg-eu-italy-renaissance-8n',
    title: 'Italian Renaissance, Tuscan Hills & Amalfi Coast',
    slug: 'italian-renaissance-tuscany-amalfi',
    destinationId: 'dest-europe',
    destinationName: 'Europe',
    durationDays: 9,
    durationNights: 8,
    heroImage: 'https://images.unsplash.com/photo-1529260830199-42c24126f198?q=80&w=1200&auto=format&fit=crop',
    tagline: 'Rome • Florence & Chianti • Amalfi & Positano Private Villa Experience',
    description: 'Experience the finest dolce vita with private Vatican Sistine Chapel access, truffle hunting in Chianti vineyards, Frecciarossa high-speed trains, and private Riva boat cruises along Positano cliffs.',
    routeSummary: ['Rome (3 Nights)', 'Florence & Tuscany (2 Nights)', 'Amalfi Coast (3 Nights)'],
    hotelsSummary: [
      {
        name: 'Hotel de Russie',
        cityName: 'Rome',
        nights: 3,
        roomType: 'Secret Garden Executive Suite',
        mealPlan: 'Italian Gourmet Breakfast'
      },
      {
        name: 'Four Seasons Hotel Firenze',
        cityName: 'Florence',
        nights: 2,
        roomType: 'Renaissance Park Suite',
        mealPlan: 'Bed & Breakfast'
      },
      {
        name: 'Le Sirenuse Positano',
        cityName: 'Amalfi / Positano',
        nights: 3,
        roomType: 'Sea View Balcony Deluxe Room',
        mealPlan: 'Mediterranean Breakfast'
      }
    ],
    productIds: [
      'eu-rom-01', // Vatican & Colosseum VIP Private Tour
      'eu-rom-02', // Rome Fiumicino Airport Chauffeur
      'eu-flo-01', // Uffizi Gallery & Florence Master Tour
      'eu-flo-02', // Chianti Wine & Truffle Hunting Private Chauffeur
      'eu-ama-01', // Capri & Positano Private Riva Yacht Charter
      'eu-tra-01'  // Frecciarossa Executive Class Train Rome - Florence - Naples
    ],
    highlights: [
      'VIP before-hours access to the Sistine Chapel and Vatican Museums',
      'Private truffle hunt and Brunello di Montalcino wine tasting at historic Tuscan estate',
      'Private Riva speedboat day charter around Capri, the Faraglioni rocks and Blue Grotto',
      'Frecciarossa Executive Class high-speed train tickets with complimentary champagne'
    ],
    inclusions: [
      '8 nights 5★ luxury accommodation with daily breakfast',
      'Private Mercedes-Benz chauffeur transfers throughout Italy',
      'Accredited private art docents and sommelier guides',
      'All high-speed rail tickets in Executive Class',
      'Full-day private yacht charter in Capri with skipper and refreshments'
    ],
    exclusions: [
      'International flights',
      'City stay tourist taxes payable at hotel check-out',
      'Personal shopping'
    ],
    baseNetCostUSD: 4350,
    finalSellingPriceUSD: 5950,
    suggestedSellingPriceUSD: 5950,
    currency: 'USD',
    tripType: 'HONEYMOON',
    tags: ['Honeymoon Favorite', 'Michelin Dining', 'Private Riva Yacht', 'High Margin'],
    isFeatured: true,
    isPublished: true,
    createdAt: '2026-01-20T14:00:00Z',
    updatedAt: '2026-02-22T10:00:00Z'
  },
  {
    id: 'pkg-jp-hokkaido-winter-6n',
    title: 'Hokkaido Snow Paradise & Culinary Onsen Tour',
    slug: 'hokkaido-snow-paradise-onsen',
    destinationId: 'dest-japan',
    destinationName: 'Japan',
    durationDays: 7,
    durationNights: 6,
    heroImage: 'https://images.unsplash.com/photo-1542051841857-5f90071e7989?q=80&w=1200&auto=format&fit=crop',
    tagline: 'Sapporo • Otaru Canal • Niseko & Lake Toya Hot Springs',
    description: 'The premier winter escape featuring legendary Hokkaido champagne powder snow, fresh King Crab culinary feasts, private onsen ryokans, and historic snow lantern festivals.',
    routeSummary: ['Sapporo (2 Nights)', 'Otaru (1 Night)', 'Niseko (2 Nights)', 'Lake Toya (1 Night)'],
    hotelsSummary: [
      {
        name: 'JR Tower Hotel Nikko Sapporo',
        cityName: 'Sapporo',
        nights: 2,
        roomType: 'Sky View Suite',
        mealPlan: 'Hokkaido Seafood Breakfast'
      },
      {
        name: 'Kuramure Ryokan Otaru',
        cityName: 'Otaru',
        nights: 1,
        roomType: 'Forest View Private Onsen Suite',
        mealPlan: 'Kaiseki Dinner & Breakfast'
      },
      {
        name: 'Park Hyatt Niseko Hanazono',
        cityName: 'Niseko',
        nights: 2,
        roomType: 'Mount Yotei View Suite with Onsen',
        mealPlan: 'Gourmet Breakfast'
      },
      {
        name: 'The Windsor Hotel Toya Resort & Spa',
        cityName: 'Lake Toya',
        nights: 1,
        roomType: 'Lake View Premier Room',
        mealPlan: 'Bed & Breakfast'
      }
    ],
    productIds: [
      'jp-sap-01', // Sapporo Snow Festival & Brewery Tour
      'jp-sap-02', // New Chitose Airport Private 4WD Chauffeur
      'jp-ota-01', // Otaru Canal & Glassblowing Workshop
      'jp-nis-01', // Niseko VIP Powder Snow Guide & Equipment
      'jp-toy-01'  // Lake Toya Volcanic Geopark & Onsen Tour
    ],
    highlights: [
      'Private 4WD luxury SUV transfers with winter-trained chauffeur',
      'Exclusive private onsen suite with panoramic Mount Yotei views',
      'Fresh Taraba King Crab & Uni seafood tasting in Sapporo central market',
      'Evening illuminated snow lantern tour along the historic Otaru Canal'
    ],
    inclusions: [
      '6 nights luxury accommodation in top winter resorts & onsen ryokans',
      'Daily breakfast and 2x Multi-Course Hokkaido Kaiseki Dinners',
      'Private 4WD winter luxury vehicle with licensed chauffeur',
      'All listed private guided tours and entrance fees'
    ],
    exclusions: [
      'Flights to/from Sapporo New Chitose Airport',
      'Ski lift passes & ski lessons',
      'Personal incidental expenses'
    ],
    baseNetCostUSD: 3680,
    finalSellingPriceUSD: 4980,
    suggestedSellingPriceUSD: 4980,
    currency: 'USD',
    tripType: 'ADVENTURE',
    tags: ['Winter Special', 'Onsen Retreat', 'Culinary Seafood', 'Powder Snow'],
    isFeatured: false,
    isPublished: true,
    createdAt: '2026-01-25T16:00:00Z',
    updatedAt: '2026-02-25T11:00:00Z'
  },
  // =========================================================================
  // DUBAI & UAE PACKAGES
  // =========================================================================
  {
    id: 'pkg-dxb-glamour-5n',
    title: 'Dubai Supercar Glamour & Arabian Desert Dunes',
    slug: 'dubai-supercar-glamour-5n',
    destinationId: 'dest-dubai',
    destinationName: 'Dubai & UAE',
    regionId: 'region-uae-dubai',
    regionName: 'Dubai & Abu Dhabi',
    heroImage: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?q=80&w=1200&auto=format&fit=crop',
    durationNights: 5,
    durationDays: 6,
    tagline: 'Burj Al Arab • Royal Desert Dunes • Abu Dhabi Grand Mosque 5-Star Indulgence',
    description: 'A high-octane luxury escape across the United Arab Emirates. Experience the sail-shaped Burj Al Arab, private Land Cruiser dune bashing in the Dubai Conservation Reserve, Level 148 At the Top SKY hospitality, and the royal heritage of Abu Dhabi.',
    routeSummary: ['Dubai (4 Nights)', 'Abu Dhabi (1 Night)'],
    routeHubs: [
      {
        id: 'rh-pkg-dxb-1',
        hubId: 'hub-dubai',
        hubName: 'Dubai',
        nights: 4,
        order: 1,
        hotelId: 'hotel-burj-al-arab',
        roomTypeId: 'room-deluxe-one-bed-suite'
      },
      {
        id: 'rh-pkg-dxb-2',
        hubId: 'hub-abudhabi',
        hubName: 'Abu Dhabi',
        nights: 1,
        order: 2,
        hotelId: 'hotel-emirates-palace-abudhabi',
        roomTypeId: 'room-palace-sea-view'
      }
    ],
    hotelsSummary: [
      {
        name: 'Burj Al Arab Jumeirah',
        cityName: 'Dubai',
        nights: 4,
        roomType: 'Deluxe One-Bedroom Duplex Suite',
        mealPlan: 'Sumptuous Buffet Breakfast'
      },
      {
        name: 'Emirates Palace Mandarin Oriental',
        cityName: 'Abu Dhabi',
        nights: 1,
        roomType: 'Palace Deluxe Sea View Room',
        mealPlan: 'Palace Gourmet Breakfast'
      }
    ],
    productIds: [
      'dxb-act-burj-sky',
      'dxb-act-desert-safari',
      'dxb-trf-dxb-city'
    ],
    highlights: [
      'VIP Gate-to-Curbside ahlan arrival transfer in a Mercedes S-Class',
      'Level 148 Burj Khalifa SKY fast-track lounge pass with private outdoor deck',
      'Royal desert safari with private 4WD dune bashing and 5-star Bedouin camp feast',
      'Full-day Abu Dhabi excursion including Sheikh Zayed Mosque & Louvre entry'
    ],
    inclusions: [
      '4 nights at Burj Al Arab Jumeirah and 1 night at Emirates Palace',
      'Daily luxury breakfast for 2 adults',
      'Private Mercedes S-Class airport and intercity transfers',
      'All listed excursions and VIP priority access passes'
    ],
    exclusions: ['International flights', 'Personal discretionary expenses and gratuities'],
    baseNetCostUSD: 5400,
    finalSellingPriceUSD: 6750,
    suggestedSellingPriceUSD: 6750,
    currency: 'USD',
    tripType: 'LUXURY',
    tags: ['Supercar', 'Ultra-Luxury', 'Desert Dunes', 'Iconic Hotels'],
    isFeatured: true,
    isPublished: true,
    createdAt: '2026-02-01T10:00:00Z',
    updatedAt: '2026-08-20T10:00:00Z'
  },
  // =========================================================================
  // THAILAND PACKAGES
  // =========================================================================
  {
    id: 'pkg-th-royal-andaman-7n',
    title: 'Thailand Royalty & Tropical Andaman Splendor',
    slug: 'thailand-royalty-tropical-andaman-7n',
    destinationId: 'dest-thailand',
    destinationName: 'Thailand',
    regionId: 'region-th-bangkok',
    regionName: 'Bangkok & Phuket',
    heroImage: 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?q=80&w=1200&auto=format&fit=crop',
    durationNights: 7,
    durationDays: 8,
    tagline: 'Bangkok Mandarin Oriental • Chao Phraya Canals • Amanpuri Phuket Luxury',
    description: 'The definitive luxury itinerary across the Kingdom of Thailand. Marvel at Bangkok\'s Grand Palace and Wat Pho with an art historian, cruise the Chao Phraya on a teak longtail boat, and fly to the secluded headlands of Phuket for private Phi Phi Island speedboat sailing.',
    routeSummary: ['Bangkok (3 Nights)', 'Phuket (4 Nights)'],
    routeHubs: [
      {
        id: 'rh-pkg-th-1',
        hubId: 'hub-bangkok',
        hubName: 'Bangkok',
        nights: 3,
        order: 1,
        hotelId: 'hotel-mandarin-oriental-bangkok',
        roomTypeId: 'room-deluxe-premier-riverview'
      },
      {
        id: 'rh-pkg-th-2',
        hubId: 'hub-phuket',
        hubName: 'Phuket',
        nights: 4,
        order: 2,
        hotelId: 'hotel-amanpuri-phuket',
        roomTypeId: 'room-ocean-pavilion'
      }
    ],
    hotelsSummary: [
      {
        name: 'Mandarin Oriental Bangkok',
        cityName: 'Bangkok',
        nights: 3,
        roomType: 'Deluxe Premier Riverview Room',
        mealPlan: 'Riverside Buffet Breakfast'
      },
      {
        name: 'Amanpuri Phuket Sanctuary',
        cityName: 'Phuket',
        nights: 4,
        roomType: 'Ocean View Pool Pavilion',
        mealPlan: 'Amanpuri Organic À La Carte Breakfast'
      }
    ],
    productIds: [
      'th-act-grand-palace',
      'th-act-phuket-islands'
    ],
    highlights: [
      '3 nights in a riverview room at Mandarin Oriental Bangkok with 24h butler',
      'Private art historian tour of Grand Palace, Emerald Buddha, and Thonburi canals',
      '4 nights in an ocean plunge pool pavilion at Amanpuri on private Pansea Beach',
      'Exclusive private twin-engine speedboat charter to Phi Phi & Maya Bay'
    ],
    inclusions: [
      '7 nights luxury resort and palace accommodation',
      'Daily gourmet breakfast for 2 adults',
      'All private airport transfers with VIP luggage assistance',
      'Private guided temple tours and island speedboat charter'
    ],
    exclusions: ['Domestic flight BKK -> HKT', 'Personal expenses'],
    baseNetCostUSD: 4600,
    finalSellingPriceUSD: 5900,
    suggestedSellingPriceUSD: 5900,
    currency: 'USD',
    tripType: 'LUXURY',
    tags: ['Tropical', 'Beach', 'Luxury', 'Culture'],
    isFeatured: true,
    isPublished: true,
    createdAt: '2026-02-01T10:00:00Z',
    updatedAt: '2026-08-20T10:00:00Z'
  },
  // =========================================================================
  // SINGAPORE PACKAGES
  // =========================================================================
  {
    id: 'pkg-sg-urban-oasis-5n',
    title: 'Singapore Urban Oasis & Sentosa Island Escapade',
    slug: 'singapore-urban-oasis-5n',
    destinationId: 'dest-singapore',
    destinationName: 'Singapore',
    regionId: 'region-sg-downtown',
    regionName: 'Singapore City',
    heroImage: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?q=80&w=1200&auto=format&fit=crop',
    durationNights: 5,
    durationDays: 6,
    tagline: 'Marina Bay Sands SkyPark • Gardens by the Bay • Sentosa Island Escapade',
    description: 'Experience the Garden City at its most glamorous. Stay high above Marina Bay with unlimited access to the 57th-floor infinity pool, visit the Cloud Forest mist mountain, and unwind along the coast of Sentosa.',
    routeSummary: ['Singapore (3 Nights)', 'Sentosa Island (2 Nights)'],
    routeHubs: [
      {
        id: 'rh-pkg-sg-1',
        hubId: 'hub-singapore',
        hubName: 'Singapore',
        nights: 3,
        order: 1,
        hotelId: 'hotel-marina-bay-sands',
        roomTypeId: 'room-sands-premier-harbour'
      },
      {
        id: 'rh-pkg-sg-2',
        hubId: 'hub-sentosa',
        hubName: 'Sentosa Island',
        nights: 2,
        order: 2,
        hotelId: 'hotel-marina-bay-sands',
        roomTypeId: 'room-sands-premier-harbour'
      }
    ],
    hotelsSummary: [
      {
        name: 'Marina Bay Sands',
        cityName: 'Singapore',
        nights: 5,
        roomType: 'Sands Premier Harbour View King',
        mealPlan: 'International Buffet Breakfast'
      }
    ],
    productIds: ['sg-act-gardens-bay'],
    highlights: [
      '57th Floor SkyPark infinity pool access overlooking Singapore Strait',
      'VIP Flower Dome, Cloud Forest, and OCBC Supertree Skyway passes',
      'Private chauffeur airport arrivals and departures'
    ],
    inclusions: [
      '5 nights luxury accommodation at Marina Bay Sands',
      'Daily international buffet breakfast',
      'Private airport roundtrip transfers',
      'Gardens by the Bay priority admission'
    ],
    exclusions: ['Airfare', 'Personal purchases'],
    baseNetCostUSD: 3100,
    finalSellingPriceUSD: 3950,
    suggestedSellingPriceUSD: 3950,
    currency: 'SGD',
    tripType: 'LUXURY',
    tags: ['Urban', 'Futuristic', 'Luxury', 'Skyline'],
    isFeatured: false,
    isPublished: true,
    createdAt: '2026-02-01T10:00:00Z',
    updatedAt: '2026-08-20T10:00:00Z'
  }
];
