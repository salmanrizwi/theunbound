import { TravelLead } from '../types';

export const INITIAL_LEADS: TravelLead[] = [
  {
    id: 'lead-01',
    leadNumber: 'LED-2026-0042',
    contactName: 'Alistair Montgomery',
    email: 'alistair@montgomerytravel.co.uk',
    phone: '+44 20 7946 0912',
    agencyName: 'Montgomery Luxury Journeys',
    source: 'B2B_PARTNER',
    status: 'QUALIFIED',
    assignedStaffId: 'staff-01',
    assignedStaffName: 'Marcus Vance (Senior Ops)',
    destinationId: 'japan',
    destinationName: 'Japan',
    travelDates: '2026-10-12 to 2026-10-24',
    paxAdults: 4,
    paxChildren: 0,
    estimatedBudget: 18500,
    currency: 'USD',
    travelRequirements: 'Private 12-day autumn foliage itinerary across Tokyo, Hakone onsen ryokan, Kyoto private temples, and Osaka food tour with luxury Alphard MPV and private English guide throughout.',
    notes: [
      {
        id: 'note-01',
        authorName: 'Marcus Vance',
        text: 'Client requested Michelin-starred Kaiseki dinner reservations and Takkyubin luggage dispatch between cities.',
        timestamp: '2026-08-20T10:30:00Z'
      }
    ],
    quoteId: 'quote-sample-01',
    quoteNumber: 'TUB-Q-2026-7841',
    createdAt: '2026-08-19T09:15:00Z',
    updatedAt: '2026-08-20T10:30:00Z'
  },
  {
    id: 'lead-02',
    leadNumber: 'LED-2026-0043',
    contactName: 'Elena Rostova',
    email: 'elena.rostova@voyagesdeluxe.com',
    phone: '+33 1 42 68 55 00',
    agencyName: 'Voyages de Luxe Paris',
    source: 'WEBSITE',
    status: 'QUOTED',
    assignedStaffId: 'staff-02',
    assignedStaffName: 'Kenji Takahashi (Japan Ground Lead)',
    destinationId: 'japan',
    destinationName: 'Japan',
    travelDates: '2026-11-05 to 2026-11-15',
    paxAdults: 2,
    paxChildren: 0,
    estimatedBudget: 9400,
    currency: 'USD',
    travelRequirements: 'Honeymoon bespoke package with 5-star ryokan private onsen, bullet train Gran Class passes, and private tea masterclass.',
    notes: [
      {
        id: 'note-02',
        authorName: 'Kenji Takahashi',
        text: 'Quote generated and dispatched via B2B Studio with 10% wholesale contractor margin.',
        timestamp: '2026-08-22T14:10:00Z'
      }
    ],
    quoteNumber: 'TUB-Q-2026-8924',
    createdAt: '2026-08-21T11:00:00Z',
    updatedAt: '2026-08-22T14:10:00Z'
  },
  {
    id: 'lead-03',
    leadNumber: 'LED-2026-0044',
    contactName: 'Vikram & Ananya Sharma',
    email: 'vikram.sharma@techventure.in',
    phone: '+91 98110 44552',
    source: 'WEBSITE',
    status: 'NEW',
    assignedStaffId: 'staff-01',
    assignedStaffName: 'Marcus Vance (Senior Ops)',
    destinationId: 'united-kingdom',
    destinationName: 'United Kingdom',
    travelDates: '2026-09-18 to 2026-09-28',
    paxAdults: 2,
    paxChildren: 2,
    estimatedBudget: 12000,
    currency: 'GBP',
    travelRequirements: 'Family trip to London and Edinburgh with Harry Potter private studio tour, Blue Badge guided Westminster, and Scottish Highland Loch Ness day excursion.',
    notes: [],
    createdAt: '2026-08-23T08:45:00Z',
    updatedAt: '2026-08-23T08:45:00Z'
  }
];
