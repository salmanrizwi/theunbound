import { Supplier } from '../types';

export const SUPPLIERS: Supplier[] = [
  {
    id: 'sup-jp-01',
    name: 'Nippon Luxury Transit & Chauffeur Services',
    country: 'Japan',
    destination: 'Japan',
    contactPerson: 'Kenji Takahashi',
    email: 'ops@nipponluxurytransit.jp',
    phone: '+81 3 5555 0192',
    website: 'https://nipponluxurytransit.jp',
    currency: 'JPY',
    contractStatus: 'ACTIVE',
    paymentTerms: 'Net 30 Days from service date',
    cancellationTerms: 'Full refund if cancelled > 72 hours prior'
  },
  {
    id: 'sup-jp-02',
    name: 'Kyoto Heritage Guild & Cultural Masterclasses',
    country: 'Japan',
    destination: 'Japan',
    contactPerson: 'Aoi Minamoto',
    email: 'reservations@kyotoheritageguild.com',
    phone: '+81 75 444 8821',
    website: 'https://kyotoheritageguild.com',
    currency: 'JPY',
    contractStatus: 'ACTIVE',
    paymentTerms: 'Pre-payment 14 days prior',
    cancellationTerms: 'Non-refundable within 7 days'
  },
  {
    id: 'sup-uk-01',
    name: 'Royal Heritage Blue Badge Guides Ltd',
    country: 'United Kingdom',
    destination: 'United Kingdom',
    contactPerson: 'Sir Arthur Sterling',
    email: 'bookings@royalbluebadge.co.uk',
    phone: '+44 20 7946 0912',
    website: 'https://royalheritageguides.co.uk',
    currency: 'GBP',
    contractStatus: 'ACTIVE',
    paymentTerms: 'Net 15 Days end of month',
    cancellationTerms: '48 hour cancellation window'
  },
  {
    id: 'sup-uk-02',
    name: 'Highlands & Countryside Chauffeur Collection',
    country: 'United Kingdom',
    destination: 'United Kingdom',
    contactPerson: 'Fiona MacLeod',
    email: 'dispatch@highlandstransit.scot',
    phone: '+44 131 496 0300',
    website: 'https://highlandstransit.scot',
    currency: 'GBP',
    contractStatus: 'ACTIVE',
    paymentTerms: 'Direct Debit / Net 30',
    cancellationTerms: 'Free cancellation up to 5 days prior'
  },
  {
    id: 'sup-eu-01',
    name: 'Grand Tour Continental Concierge SA',
    country: 'France',
    destination: 'Europe',
    contactPerson: 'Claire Delacroix',
    email: 'b2b@grandtourconcierge.fr',
    phone: '+33 1 42 68 55 00',
    website: 'https://grandtourconcierge.fr',
    currency: 'EUR',
    contractStatus: 'ACTIVE',
    paymentTerms: 'Net 30 Days',
    cancellationTerms: 'Free cancellation up to 7 days prior'
  },
  {
    id: 'sup-eu-02',
    name: 'Swiss Alpine Panorama Rail & Hospitality Group',
    country: 'Switzerland',
    destination: 'Europe',
    contactPerson: 'Markus Weber',
    email: 'trade@alpinerailgroup.ch',
    phone: '+41 44 211 4040',
    website: 'https://alpinerailgroup.ch',
    currency: 'EUR',
    contractStatus: 'ACTIVE',
    paymentTerms: 'Instant Ticket Issuance / Direct Billing',
    cancellationTerms: 'Exchangeable with 10% fee up to 24h prior'
  }
];
