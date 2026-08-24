import { GoogleReview } from '../types';

export const INITIAL_REVIEWS: GoogleReview[] = [
  {
    id: 'rev-01',
    authorName: 'Charlotte De Vries',
    authorAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=200&auto=format&fit=crop',
    rating: 5,
    reviewText: 'TheUnbound delivered an extraordinary 12-day bespoke itinerary for our VIP family group across Tokyo, Hakone, and Kyoto. The private tea masterclass and seamless Shinkansen luggage forwarding made the entire trip effortless. Truly the gold standard in DMC operations.',
    date: '2026-02-14',
    relativeTimeDescription: '2 weeks ago',
    destination: 'Japan',
    locationName: 'TheUnbound Japan Ground Concierge, Tokyo',
    source: 'GOOGLE_BUSINESS',
    verifiedPartner: true,
    isFeatured: true,
    isVisible: true,
    displayOrder: 1,
    helpfulCount: 42,
    responseFromOwner: {
      text: 'Thank you Charlotte! It was an absolute pleasure hosting your family across Kyoto and Hakone. We look forward to welcoming you to the Scottish Highlands next season.',
      date: '2026-02-15'
    }
  },
  {
    id: 'rev-02',
    authorName: 'David Sterling (Director, Sterling Luxury Travel UK)',
    authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop',
    rating: 5,
    reviewText: 'As a London-based luxury travel advisor, partnering with TheUnbound has transformed our ground operations in Japan and Continental Europe. Instant wholesale quotations, reliable private chauffeur fleets, and 24/7 on-the-ground support give us total confidence.',
    date: '2026-01-29',
    relativeTimeDescription: '3 weeks ago',
    destination: 'United Kingdom & Japan',
    locationName: 'TheUnbound Global Partner Operations',
    source: 'DIRECT_B2B_PARTNER',
    verifiedPartner: true,
    isFeatured: true,
    isVisible: true,
    displayOrder: 2,
    helpfulCount: 38
  },
  {
    id: 'rev-03',
    authorName: 'Alexander Montgomery',
    authorAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=200&auto=format&fit=crop',
    rating: 5,
    reviewText: 'Our private Scottish Highlands castle expedition was beyond perfection. The private whisky vault masterclasses in Speyside and the Blue Badge historian guide arranged by TheUnbound were truly world class. Highly recommended!',
    date: '2026-01-18',
    relativeTimeDescription: '1 month ago',
    destination: 'United Kingdom',
    locationName: 'TheUnbound UK Operations Hub, Edinburgh',
    source: 'GOOGLE_BUSINESS',
    verifiedPartner: true,
    isFeatured: true,
    isVisible: true,
    displayOrder: 3,
    helpfulCount: 29
  },
  {
    id: 'rev-04',
    authorName: 'Sophie Van Der Bilt',
    authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop',
    rating: 5,
    reviewText: 'The Excellence Class Glacier Express and private helicopter transfer to Zermatt was executed with military precision. The net pricing calculator and real-time itinerary builder saved our team hours of coordination.',
    date: '2025-12-20',
    relativeTimeDescription: '2 months ago',
    destination: 'Europe',
    locationName: 'TheUnbound Alpine Operations Desk, Zurich',
    source: 'GOOGLE_BUSINESS',
    verifiedPartner: true,
    isFeatured: false,
    isVisible: true,
    displayOrder: 4,
    helpfulCount: 19
  }
];
