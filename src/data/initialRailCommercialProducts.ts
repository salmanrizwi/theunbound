import { JapanRailCommercialProduct } from '../types/rail';

/**
 * Authoritative Canonical Japan Rail Commercial Master Products (Exactly 2)
 * 1. Ordinary Car — Reserved Seat (ORDINARY_RESERVED)
 * 2. Green Car — First Class / Reserved (GREEN_RESERVED)
 */
export const INITIAL_JAPAN_RAIL_COMMERCIAL_PRODUCTS: JapanRailCommercialProduct[] = [
  {
    id: 'RAIL-JP-ORD-RESERVED',
    productCode: 'ORDINARY_RESERVED',
    productName: 'Ordinary Car — Reserved Seat',
    category: 'RAIL',
    destinationId: 'dest-japan',
    destinationName: 'Japan',
    productType: 'ORDINARY_RESERVED',
    carType: 'Ordinary',
    classType: 'Standard',
    reservationType: 'Reserved Seat',
    seatType: 'Reserved',
    shortDescription: 'Guaranteed reserved seating on high-speed Shinkansen bullet trains across Tokyo, Kyoto, Osaka, Hiroshima & beyond via dynamic smartEX inventory.',
    description: 'Experience the world-renowned Shinkansen high-speed bullet train with guaranteed reserved seating in the Ordinary Car. Powered by dynamic smartEX real-time inventory, select your exact origin and destination stations across the Tokaido, Sanyo, and Kyushu lines (Nozomi, Mizuho, Hikari, Kodama, Sakura). Includes oversized baggage allotment support and scenic Mt. Fuji side window seat allocation.',
    inclusions: [
      'Guaranteed reserved seat on scheduled Shinkansen bullet train',
      'High-speed travel up to 300 km/h with 99.9% on-time reliability',
      'Free onboard Wi-Fi, AC power outlets, and spacious legroom (104cm pitch)',
      'Direct digital QR code / smartEX mobile boarding voucher'
    ],
    exclusions: [
      'Meals and beverages (available for purchase onboard or at station kiosks)',
      'Transfer from hotel to train station (can be bundled with private chauffeur)'
    ],
    importantInformation: [
      'Passengers with total baggage dimensions exceeding 160 cm must select the Oversized Baggage Area reservation during checkout.',
      'Children aged 6–11 require a Child ticket (50% fare). Children under 6 travel free on lap unless occupying an individual reserved seat.',
      'Mt. Fuji view is on Seat E (2-row side) on westbound trains (Tokyo to Kyoto/Osaka) and Seat A on eastbound trains.'
    ],
    imageUrl: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1600&q=80',
    images: [
      'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1600&q=80',
      'https://images.unsplash.com/photo-1538332576228-eb5b4c4de6f5?auto=format&fit=crop&w=1600&q=80'
    ],
    supportedServices: ['NOZOMI', 'MIZUHO', 'HIKARI', 'KODAMA', 'SAKURA', 'TSUBAME'],
    passengerTypes: ['ADULT', 'CHILD'],
    status: 'ACTIVE',
    displayOrder: 1,
    nativeCurrency: 'JPY',
    pricingConfiguration: {
      pricingMode: 'DYNAMIC_ROUTE_FARE',
      supplierNett: 13970, // Regular baseline reference Tokyo-Kyoto
      marginType: 'PERCENTAGE',
      marginValue: 12,
      taxType: 'PERCENTAGE',
      taxValue: 10,
      serviceChargeType: 'FIXED',
      serviceChargeValue: 0
    },
    createdBy: 'SYSTEM_INITIALIZER',
    updatedBy: 'SYSTEM_INITIALIZER',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    schemaVersion: 1
  },
  {
    id: 'RAIL-JP-GREEN-RESERVED',
    productCode: 'GREEN_RESERVED',
    productName: 'Green Car — First Class / Reserved',
    category: 'RAIL',
    destinationId: 'dest-japan',
    destinationName: 'Japan',
    productType: 'GREEN_RESERVED',
    carType: 'Green',
    classType: 'First Class',
    reservationType: 'Reserved Seat',
    seatType: 'Reserved',
    shortDescription: 'First-class luxury Shinkansen travel with 2x2 executive seating, hot oshibori towel service, reading lamps, and quiet car atmosphere.',
    description: 'Upgrade your clients to the pinnacle of Japanese high-speed rail comfort. The Green Car features ultra-wide plush reclining seats in an exclusive 2x2 configuration with generous 116cm legroom, individual footrests, personal reading lamps, and complimentary moist towel service. Perfect for VIP travelers, business leaders, and discerning luxury holidaymakers between Tokyo, Kyoto, Osaka, Hiroshima and Hakata.',
    inclusions: [
      'First Class Green Car reserved seat with luxurious 2x2 wide seating layout',
      'Personal footrest, reading light, private power outlet, and seat heater',
      'Dedicated Green Car attendant service with hot oshibori towel presentation',
      'Whisper-quiet cabin ambiance ideal for VIPs and executives',
      'Digital QR code / smartEX instant mobile boarding pass'
    ],
    exclusions: [
      'Meals and drinks (refreshment cart service available onboard)',
      'Porter baggage service at train platforms'
    ],
    importantInformation: [
      'Oversized baggage rules apply for suitcases over 160cm total dimensions.',
      'Green Car tickets require full Green surcharge for children occupying their own seat.',
      'Scenic Mt. Fuji view is on Seat D on westbound trains (Tokyo to Kyoto/Osaka).'
    ],
    imageUrl: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=1600&q=80',
    images: [
      'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=1600&q=80',
      'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1600&q=80'
    ],
    supportedServices: ['NOZOMI', 'MIZUHO', 'HIKARI', 'KODAMA', 'SAKURA', 'TSUBAME'],
    passengerTypes: ['ADULT', 'CHILD'],
    status: 'ACTIVE',
    displayOrder: 2,
    nativeCurrency: 'JPY',
    pricingConfiguration: {
      pricingMode: 'DYNAMIC_ROUTE_FARE',
      supplierNett: 19040, // Regular baseline reference Tokyo-Kyoto
      marginType: 'PERCENTAGE',
      marginValue: 12,
      taxType: 'PERCENTAGE',
      taxValue: 10,
      serviceChargeType: 'FIXED',
      serviceChargeValue: 0
    },
    createdBy: 'SYSTEM_INITIALIZER',
    updatedBy: 'SYSTEM_INITIALIZER',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    schemaVersion: 1
  }
];
