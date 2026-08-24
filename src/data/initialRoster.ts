import { RosterResource, ProductRosterRule } from '../types';

export const INITIAL_ROSTER_RESOURCES: RosterResource[] = [
  // Japan Resources
  {
    id: 'res-jp-01',
    name: 'Kenji Sato',
    role: 'GUIDE',
    destinationId: 'japan',
    destinationName: 'Japan',
    cityHub: 'Tokyo',
    phone: '+81 90 1234 5678',
    email: 'kenji.sato@unbounddmc.jp',
    languages: ['English', 'Japanese'],
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    assignedDuty: 'Senior Cultural & Historical Guide',
    operationalDates: ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05'],
    status: 'ACTIVE'
  },
  {
    id: 'res-jp-02',
    name: 'Yuki Tanaka',
    role: 'FREELANCE_GUIDE',
    destinationId: 'japan',
    destinationName: 'Japan',
    cityHub: 'Kyoto',
    phone: '+81 90 8765 4321',
    email: 'yuki.tanaka@unbounddmc.jp',
    languages: ['English', 'Japanese', 'Mandarin'],
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    assignedDuty: 'Kyoto Temple & Culinary Specialist',
    operationalDates: ['2026-09-02', '2026-09-03', '2026-09-06'],
    status: 'ACTIVE'
  },
  {
    id: 'res-jp-03',
    name: 'Hiroshi Takahashi',
    role: 'DRIVER',
    destinationId: 'japan',
    destinationName: 'Japan',
    cityHub: 'Tokyo',
    phone: '+81 90 5555 8888',
    email: 'hiroshi.driver@unbounddmc.jp',
    languages: ['English', 'Japanese'],
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    assignedDuty: 'VIP Chauffeur & Executive Transfers',
    status: 'ACTIVE'
  },
  {
    id: 'res-jp-04',
    name: 'Tokyo Luxury Fleet Transporters',
    role: 'TRANSPORTER',
    destinationId: 'japan',
    destinationName: 'Japan',
    cityHub: 'Tokyo',
    phone: '+81 3 5555 0199',
    email: 'fleet@unbounddmc.jp',
    languages: ['English', 'Japanese'],
    assignedDuty: 'Airport & Inter-City Private Shuttles',
    status: 'ACTIVE'
  },
  {
    id: 'res-jp-05',
    name: 'Aman Tokyo Partner Desk',
    role: 'HOTEL_PARTNER',
    destinationId: 'japan',
    destinationName: 'Japan',
    cityHub: 'Tokyo',
    phone: '+81 3 5555 0123',
    email: 'aman.tokyo@partner.unbound.com',
    languages: ['English', 'Japanese'],
    assignedDuty: '5-Star Luxury Accommodations & Concierge',
    status: 'ACTIVE'
  },
  {
    id: 'res-jp-06',
    name: 'Gion Karyo Michelin Kaiseki',
    role: 'RESTAURANT',
    destinationId: 'japan',
    destinationName: 'Japan',
    cityHub: 'Kyoto',
    phone: '+81 75 532 0025',
    email: 'reservations@gion-karyo.jp',
    languages: ['English', 'Japanese'],
    assignedDuty: 'VIP Private Dining & Seasonal Tea Pairings',
    status: 'ACTIVE'
  },
  {
    id: 'res-jp-07',
    name: 'Japan Rail Pass & Shinkansen Desk',
    role: 'TICKET_PARTNER',
    destinationId: 'japan',
    destinationName: 'Japan',
    cityHub: 'Tokyo',
    phone: '+81 3 3211 4455',
    email: 'jrpass@unbounddmc.jp',
    languages: ['English', 'Japanese'],
    assignedDuty: 'Bullet Train Green Car Ticketing & Seat Reservations',
    status: 'ACTIVE'
  },
  {
    id: 'res-jp-08',
    name: 'Daiki Nakamura',
    role: 'FREELANCE_DRIVER',
    destinationId: 'japan',
    destinationName: 'Japan',
    cityHub: 'Osaka',
    phone: '+81 90 4433 2211',
    email: 'daiki.freelance@unbounddmc.jp',
    languages: ['English', 'Japanese'],
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
    assignedDuty: 'Kansai Region Private Touring & Transfers',
    status: 'ACTIVE'
  },

  // Europe & UK Resources
  {
    id: 'res-eu-01',
    name: 'Laurent Mercier',
    role: 'GUIDE',
    destinationId: 'western-europe',
    destinationName: 'Western Europe',
    cityHub: 'Paris',
    phone: '+33 6 12 34 56 78',
    email: 'laurent.mercier@unbounddmc.fr',
    languages: ['English', 'French', 'Spanish'],
    avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80',
    assignedDuty: 'Louvre & Versailles Private Curator',
    status: 'ACTIVE'
  },
  {
    id: 'res-uk-01',
    name: 'Arthur Pendelton (Blue Badge Guide)',
    role: 'GUIDE',
    destinationId: 'united-kingdom',
    destinationName: 'United Kingdom',
    cityHub: 'London',
    phone: '+44 7700 900077',
    email: 'arthur.guide@unbounddmc.co.uk',
    languages: ['English'],
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
    assignedDuty: 'Royal Heritage & Westminster VIP Host',
    status: 'ACTIVE'
  },
  {
    id: 'res-uk-02',
    name: 'London Executive Chauffeur Services',
    role: 'TRANSPORTER',
    destinationId: 'united-kingdom',
    destinationName: 'United Kingdom',
    cityHub: 'London',
    phone: '+44 20 7946 0991',
    email: 'dispatch@londonexec.co.uk',
    languages: ['English'],
    assignedDuty: 'Heathrow VIP Meets & Mercedes S-Class Touring',
    status: 'ACTIVE'
  },
  {
    id: 'res-me-01',
    name: 'Tariq Al-Mansoor',
    role: 'COORDINATOR',
    destinationId: 'middle-east',
    destinationName: 'Middle East',
    cityHub: 'Dubai',
    phone: '+971 50 123 4567',
    email: 'tariq@unbounddmc.ae',
    languages: ['English', 'Arabic'],
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80',
    assignedDuty: 'Arabian Desert & Superyacht Dispatch Manager',
    status: 'ACTIVE'
  }
];

// Map of standard product operational rules & blackout calendars
export const INITIAL_PRODUCT_ROSTER_RULES: Record<string, ProductRosterRule> = {
  // Japan Tea Ceremony (Closed on Mondays, specific holiday blackouts)
  'prod-jp-01': {
    productId: 'prod-jp-01',
    operatingDays: ['Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    defaultCapacity: 8,
    blackoutDates: ['2026-08-25', '2026-08-28', '2026-09-15', '2026-12-25', '2026-12-31', '2026-01-01'],
    assignedDefaultResourceId: 'res-jp-01',
    dateOverrides: {
      '2026-08-25': {
        date: '2026-08-25',
        status: 'BLOCKED',
        reason: 'Master Tea Pavilion Annual Restoration & Purification',
        notes: 'Ground closed by temple master'
      },
      '2026-08-28': {
        date: '2026-08-28',
        status: 'SOLD_OUT',
        reason: 'Fully booked by private diplomatic delegation',
        bookedPax: 8,
        maxCapacity: 8
      },
      '2026-08-26': {
        date: '2026-08-26',
        status: 'LIMITED',
        reason: '2 seats remaining only',
        bookedPax: 6,
        maxCapacity: 8,
        assignedResourceId: 'res-jp-01',
        assignedResourceName: 'Kenji Sato'
      }
    }
  },

  // Mt Fuji Private Helicopter (Weather sensitive, maintenance days on Thursdays)
  'prod-jp-02': {
    productId: 'prod-jp-02',
    operatingDays: ['Mon', 'Tue', 'Wed', 'Fri', 'Sat', 'Sun'],
    defaultCapacity: 5,
    blackoutDates: ['2026-08-27', '2026-09-02', '2026-09-03', '2026-12-25'],
    assignedDefaultResourceId: 'res-jp-04',
    dateOverrides: {
      '2026-08-27': {
        date: '2026-08-27',
        status: 'MAINTENANCE',
        reason: 'Helipad Turbine Service & Aviation Safety Inspection',
        notes: 'DMC contracted hangar inspection'
      },
      '2026-09-02': {
        date: '2026-09-02',
        status: 'BLOCKED',
        reason: 'DMC Guide Off Roster / Heli Crew Standby',
      }
    }
  },

  // Tokyo Street Food & Izakaya Night (Operating daily except Sundays)
  'prod-jp-03': {
    productId: 'prod-jp-03',
    operatingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    defaultCapacity: 12,
    blackoutDates: ['2026-08-29', '2026-09-20'],
    assignedDefaultResourceId: 'res-jp-02',
    dateOverrides: {
      '2026-08-29': {
        date: '2026-08-29',
        status: 'SOLD_OUT',
        reason: 'Max capacity reached (12/12 Pax)',
        bookedPax: 12,
        maxCapacity: 12
      }
    }
  },

  // Kyoto Arashiyama Bamboo (Operates daily)
  'prod-jp-04': {
    productId: 'prod-jp-04',
    operatingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    defaultCapacity: 10,
    blackoutDates: ['2026-08-30'],
    assignedDefaultResourceId: 'res-jp-01',
    dateOverrides: {
      '2026-08-30': {
        date: '2026-08-30',
        status: 'BLOCKED',
        reason: 'Kyoto Heritage Festival - Road Closures & Restricted Access'
      }
    }
  },

  // Paris Louvre VIP (Closed Tuesdays)
  'prod-fr-01': {
    productId: 'prod-fr-01',
    operatingDays: ['Mon', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    defaultCapacity: 6,
    blackoutDates: ['2026-08-25', '2026-12-25', '2026-01-01'],
    assignedDefaultResourceId: 'res-eu-01',
    dateOverrides: {
      '2026-08-25': {
        date: '2026-08-25',
        status: 'OFF_ROSTER',
        reason: 'Louvre Museum Weekly Closure (Tuesdays)'
      }
    }
  },

  // London Tower & Thames Yacht (Operates daily)
  'prod-uk-01': {
    productId: 'prod-uk-01',
    operatingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    defaultCapacity: 14,
    blackoutDates: ['2026-08-31'],
    assignedDefaultResourceId: 'res-uk-01',
    dateOverrides: {
      '2026-08-31': {
        date: '2026-08-31',
        status: 'BLOCKED',
        reason: 'UK Summer Bank Holiday - Thames Regatta River Lockout'
      }
    }
  }
};
