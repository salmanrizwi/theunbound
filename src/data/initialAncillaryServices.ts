import { 
  TravelProtectionPlan, 
  VipGroundService, 
  ConnectivityPlan 
} from '../types';

export const INITIAL_TRAVEL_PROTECTION_PLANS: TravelProtectionPlan[] = [
  {
    id: 'PROT-GLB-COMP-01',
    serviceName: 'Worldwide Comprehensive Platinum Shield',
    provider: 'Allianz Global Assistance / Care Health',
    coverageArea: 'Worldwide incl. US/Canada',
    medicalCoverageAmount: 500000,
    emergencyAssistanceIncluded: true,
    evacuationCoverageAmount: 250000,
    tripCancellationAmount: 10000,
    baggageLossAmount: 3000,
    validityDaysMax: 45,
    eligibilityAgeMin: 0,
    eligibilityAgeMax: 85,
    netCostPerDay: 4.5,
    netCostPerTrip: 35,
    sellingPricePerDay: 7.0,
    sellingPricePerTrip: 55,
    currency: 'USD',
    status: 'ACTIVE',
    terms: 'Covers emergency medical hospitalization, COVID-19 treatment, baggage delay (>6h), flight interruption, and 24/7 global multilingual evacuation dispatch.',
    customerDescription: 'Premium global travel protection with zero deductible and direct cashless claims across 180+ countries.',
    inclusions: [
      'USD 500,000 Medical Inpatient & Outpatient cover',
      'USD 250,000 Emergency Medical Evacuation & Repatriation',
      'USD 10,000 Trip Cancellation & Curtailment reimbursement',
      'USD 3,000 Baggage & Personal Electronics loss compensation',
      '24/7 Worldwide Emergency SOS helpline'
    ],
    displayOrder: 1,
    updatedAt: '2026-03-01T00:00:00Z'
  },
  {
    id: 'PROT-GLB-STD-02',
    serviceName: 'Worldwide Classic Leisure Shield',
    provider: 'Allianz Global Assistance',
    coverageArea: 'Worldwide excl. US/Canada',
    medicalCoverageAmount: 250000,
    emergencyAssistanceIncluded: true,
    evacuationCoverageAmount: 100000,
    tripCancellationAmount: 5000,
    baggageLossAmount: 1500,
    validityDaysMax: 30,
    eligibilityAgeMin: 0,
    eligibilityAgeMax: 75,
    netCostPerDay: 2.8,
    netCostPerTrip: 22,
    sellingPricePerDay: 4.5,
    sellingPricePerTrip: 38,
    currency: 'USD',
    status: 'ACTIVE',
    terms: 'Designed for international leisure vacations outside North America. Covers accidental injury, acute illness, and delayed transit.',
    customerDescription: 'Essential medical emergency and luggage protection for leisure touring across Asia, Europe, and Middle East.',
    inclusions: [
      'USD 250,000 Emergency Hospitalization Cover',
      'USD 100,000 Air Evacuation to home country',
      'USD 5,000 Trip Interruption cover',
      'USD 1,500 Checked luggage loss'
    ],
    displayOrder: 2,
    updatedAt: '2026-03-01T00:00:00Z'
  },
  {
    id: 'PROT-EU-SCHENGEN-03',
    serviceName: 'European Schengen Visa Compliant Shield',
    provider: 'AXA Assistance Schengen',
    coverageArea: 'Schengen (29 European Nations)',
    destinationId: 'dest-europe',
    medicalCoverageAmount: 50000,
    emergencyAssistanceIncluded: true,
    evacuationCoverageAmount: 50000,
    tripCancellationAmount: 2500,
    baggageLossAmount: 1000,
    validityDaysMax: 90,
    eligibilityAgeMin: 0,
    eligibilityAgeMax: 80,
    netCostPerDay: 2.0,
    netCostPerTrip: 18,
    sellingPricePerDay: 3.5,
    sellingPricePerTrip: 30,
    currency: 'USD',
    status: 'ACTIVE',
    terms: 'Fully compliant with EU Regulation (EC) No 810/2009. Minimum EUR 30,000 / USD 50,000 medical coverage accepted by all European consulates.',
    customerDescription: 'Official embassy-approved Schengen travel insurance certificate generated instantly upon booking confirmation.',
    inclusions: [
      'EUR 30,000 / USD 50,000 Consular compliant medical coverage',
      'Zero deductible / excess policy',
      'Repatriation of remains & medical transfer cover',
      'Official consulate certificate in English & French'
    ],
    displayOrder: 3,
    updatedAt: '2026-03-01T00:00:00Z'
  },
  {
    id: 'PROT-ASIA-REG-04',
    serviceName: 'Asia Regional Explorer Shield',
    provider: 'Sompo Japan / Care Health',
    coverageArea: 'Asia Regional (Japan, Thailand, UAE, Singapore)',
    destinationId: 'dest-japan',
    medicalCoverageAmount: 100000,
    emergencyAssistanceIncluded: true,
    evacuationCoverageAmount: 50000,
    tripCancellationAmount: 3000,
    baggageLossAmount: 1000,
    validityDaysMax: 21,
    eligibilityAgeMin: 0,
    eligibilityAgeMax: 75,
    netCostPerDay: 1.8,
    netCostPerTrip: 14,
    sellingPricePerDay: 3.0,
    sellingPricePerTrip: 25,
    currency: 'USD',
    status: 'ACTIVE',
    terms: 'Specialized low-tariff protection policy for Far East and South East Asian vacation circuits.',
    customerDescription: 'Tailored Asian holiday coverage including street food digestive cover and Shinkansen luggage assistance.',
    inclusions: [
      'USD 100,000 Asian regional hospitalization cover',
      'Cashless hospital admission in Tokyo, Kyoto, Bangkok, Singapore',
      'USD 1,000 Baggage & passport theft cover'
    ],
    displayOrder: 4,
    updatedAt: '2026-03-01T00:00:00Z'
  }
];

export const INITIAL_VIP_GROUND_SERVICES: VipGroundService[] = [
  {
    id: 'VIP-TYO-NRT-01',
    name: 'Tokyo Narita (NRT) Airside VIP Meet & Fast Track',
    serviceType: 'MEET_AND_GREET',
    destinationId: 'dest-japan',
    hubId: 'hub-tokyo',
    supplierName: 'Nippon Luxury Transit Concierge',
    shortDesc: 'Dedicated tarmac gate greeting with golf buggy transfer and express customs escort.',
    longDesc: 'Our certified multilingual docent meets passengers immediately at the aircraft jet bridge with a personalized name board, escorts via electric cart through immigration fast-track lanes, and assists with priority baggage claim before handing over to your private chauffeur.',
    netCost: 140,
    defaultMarkupPercent: 25,
    sellingPrice: 175,
    pricingType: 'PER_PAX',
    currency: 'USD',
    badge: 'Fast Track Gate Escort',
    inclusions: [
      'Personalized jet bridge greeting',
      'Express biometric & customs clearance lane',
      'Porter service for up to 3 bags per passenger',
      'Escort directly to private vehicle curbside'
    ],
    status: 'ACTIVE',
    displayOrder: 1,
    updatedAt: '2026-03-01T00:00:00Z'
  },
  {
    id: 'VIP-TYO-HND-02',
    name: 'Tokyo Haneda (HND) VIP Chauffeur & Curbside Greeting',
    serviceType: 'VIP_TRANSFER',
    destinationId: 'dest-japan',
    hubId: 'hub-tokyo',
    supplierName: 'Tokyo Executive Chauffeur Guild',
    shortDesc: 'Mercedes S-Class or Toyota Alphard luxury MPV airport transfer with white-glove driver.',
    longDesc: 'Seamless luxury arrival experience with certified chauffeur holding an electronic welcome display at the arrival gate, complimentary cold towels, bottled mineral water, and onboard 5G Wi-Fi hotspot.',
    netCost: 180,
    defaultMarkupPercent: 22,
    sellingPrice: 220,
    pricingType: 'PER_VEHICLE',
    currency: 'USD',
    badge: 'Executive MPV',
    inclusions: [
      'Flight tracking with 90-minute complimentary waiting time',
      'Luxury Toyota Alphard Executive Lounge vehicle',
      'All toll charges, parking, and gratuities included'
    ],
    status: 'ACTIVE',
    displayOrder: 2,
    updatedAt: '2026-03-01T00:00:00Z'
  },
  {
    id: 'VIP-DXB-MA-03',
    name: 'Dubai International (DXB) Ahlan VIP Lounge & Escort',
    serviceType: 'LOUNGE_ACCESS',
    destinationId: 'dest-dubai',
    hubId: 'hub-dubai',
    supplierName: 'Emirates VIP Logistics',
    shortDesc: 'Exclusive Ahlan arrival lounge access, immigration fast track, and flower bouquet.',
    longDesc: 'Arrive in Dubai like royalty with access to the exclusive Ahlan private reception lounge with Arabic refreshments, luxury dates, private passport stamp clearance, and direct luggage delivery.',
    netCost: 95,
    defaultMarkupPercent: 20,
    sellingPrice: 115,
    pricingType: 'PER_PAX',
    currency: 'USD',
    badge: 'VIP Lounge Entry',
    inclusions: [
      'Private immigration counter clearance',
      'Ahlan Luxury Arrival Lounge buffet & refreshments',
      'Dedicated porter handling all checked baggage'
    ],
    status: 'ACTIVE',
    displayOrder: 3,
    updatedAt: '2026-03-01T00:00:00Z'
  },
  {
    id: 'VIP-KYO-STN-04',
    name: 'Kyoto Station Shinkansen Platform VIP Porterage & Concierge',
    serviceType: 'PORTERAGE',
    destinationId: 'dest-japan',
    hubId: 'hub-kyoto',
    supplierName: 'Kyoto Hospitality Desk',
    shortDesc: 'Train platform meet-and-assist, bullet train seat escort, and hotel luggage delivery.',
    longDesc: 'Meet our uniformed Kyoto station concierge directly on the Shinkansen platform as your bullet train doors open. We collect your heavy luggage and transfer it directly to your Kyoto ryokan or luxury hotel while walking you to your waiting private vehicle.',
    netCost: 45,
    defaultMarkupPercent: 30,
    sellingPrice: 60,
    pricingType: 'FIXED',
    currency: 'USD',
    badge: 'Station Porter Escort',
    inclusions: [
      'Platform car door greeting',
      'Station-to-hotel same-day luggage forwarding (up to 4 bags)',
      'Escort to taxi/private transfer rank'
    ],
    status: 'ACTIVE',
    displayOrder: 4,
    updatedAt: '2026-03-01T00:00:00Z'
  }
];

export const INITIAL_CONNECTIVITY_PLANS: ConnectivityPlan[] = [
  {
    id: 'ESIM-ASIA-10GB',
    name: '5G Regional eSIM - Asia 14 Destinations (10GB / 15 Days)',
    type: 'ESIM',
    coverageZone: 'Japan, Thailand, Singapore, UAE, South Korea, Taiwan + 8 Countries',
    dataAllowance: '10GB High-Speed 5G',
    validityDays: 15,
    networkSpeed: '5G Ultra Wideband / 4G LTE',
    netCost: 12,
    sellingPrice: 18,
    currency: 'USD',
    status: 'ACTIVE',
    inclusions: [
      'Instant QR-code delivery via email & agent portal',
      'Zero physical SIM swapping required',
      'Personal hotspot and tethering enabled',
      'Unlimited 128kbps throttle after 10GB high-speed quota'
    ],
    displayOrder: 1,
    updatedAt: '2026-03-01T00:00:00Z'
  },
  {
    id: 'ESIM-ASIA-UNLIM',
    name: '5G Regional eSIM - Asia Unlimited (Unlimited Data / 10 Days)',
    type: 'ESIM',
    coverageZone: 'Japan, Singapore, Thailand, UAE, Vietnam, Malaysia',
    dataAllowance: 'Unlimited 5G Data',
    validityDays: 10,
    networkSpeed: '5G Uncapped',
    netCost: 20,
    sellingPrice: 32,
    currency: 'USD',
    status: 'ACTIVE',
    inclusions: [
      'Truly uncapped 5G data speeds with no daily fair-use limits',
      'Operates on tier-1 local carriers (NTT Docomo / SoftBank in Japan, AIS in Thailand)',
      'Instant automated provisioning upon QR activation'
    ],
    displayOrder: 2,
    updatedAt: '2026-03-01T00:00:00Z'
  },
  {
    id: 'ESIM-GLB-20GB',
    name: '5G Global Elite eSIM - 140 Countries (20GB / 30 Days)',
    type: 'ESIM',
    coverageZone: 'Global 140 Countries (Japan, UK, Schengen, UAE, USA, APAC)',
    dataAllowance: '20GB High-Speed 5G',
    validityDays: 30,
    networkSpeed: '5G / 4G LTE Multi-Network',
    netCost: 32,
    sellingPrice: 48,
    currency: 'USD',
    status: 'ACTIVE',
    inclusions: [
      'Seamless multi-country roaming without changing profiles',
      'Full 30 days validity from first network ping',
      'Priority routing on national carrier networks'
    ],
    displayOrder: 3,
    updatedAt: '2026-03-01T00:00:00Z'
  },
  {
    id: 'ESIM-JPN-5GB',
    name: '5G Japan Express Local eSIM (5GB / 7 Days)',
    type: 'ESIM',
    coverageZone: 'Japan Nationwide (NTT Docomo 5G)',
    dataAllowance: '5GB High-Speed 5G',
    validityDays: 7,
    networkSpeed: 'NTT Docomo 5G Native',
    netCost: 8,
    sellingPrice: 14,
    currency: 'USD',
    status: 'ACTIVE',
    inclusions: [
      'Native Japanese IP routing for optimal domestic app performance',
      'Ideal for short Shinkansen circuit tours',
      'Hotspot enabled for laptops and tablets'
    ],
    displayOrder: 4,
    updatedAt: '2026-03-01T00:00:00Z'
  }
];
