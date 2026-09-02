import { HomepageConfig } from '../types';

export const INITIAL_HOMEPAGE_CONFIG: HomepageConfig = {
  heroHeading: 'Premier Ground Operations & Wholesale DMC Network',
  heroSubheading: 'Contracted wholesale rates, verified licensed bilingual guides, executive transfers, and 24–48h SLA booking operations across Japan, the UK, Europe, Southeast Asia, and the Middle East.',
  heroBadgeText: 'UNBOUND EXPERIENCES INDIA PVT LTD • OPERATIONS DESK',
  heroImage: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=2000&auto=format&fit=crop',
  heroImageAlt: 'TheUnbound Premier Ground Operations & Wholesale DMC Network',
  heroOverlayOpacity: 0.65,
  primaryCtaText: 'Explore Contracted Inventory',
  primaryCtaAction: 'EXPLORE_PRODUCTS',
  showPrimaryCta: true,
  secondaryCtaText: 'View Destination Gateways',
  secondaryCtaAction: 'DESTINATION_FILTER',
  showSecondaryCta: true,
  heroTrustBadges: [
    { label: 'Destinations', subtext: '7 Core Global Regions', icon: 'Globe2' },
    { label: 'City Hubs', subtext: '24+ Direct Gateways', icon: 'Building2' },
    { label: 'Ground Logistics', subtext: '100% Direct Contracts', icon: 'ShieldCheck' },
    { label: 'Operations SLA', subtext: '24–48h Booking Desk', icon: 'Clock' }
  ],
  heroSellingPoints: [
    'Direct B2B net contracted rates with verified ground suppliers',
    'Dedicated on-ground operations desks in Tokyo, London, Paris & Bangkok',
    'Verified licensed bilingual private guides & executive chauffeur fleets',
    'Instant B2B white-label client quotation generation in multi-currency'
  ],
  featuredDestinationIds: ['japan', 'united-kingdom', 'western-europe', 'southeast-asia', 'middle-east', 'usa', 'australia'],
  destinationOrdering: ['japan', 'united-kingdom', 'western-europe', 'southeast-asia', 'middle-east', 'usa', 'australia'],
  
  // Module display toggles
  showHeroSection: true,
  showDestinationFilter: true,
  showCityHubs: true,
  showCategoryFilters: true,
  showProductGrid: true,
  showGoogleReviews: true,
  showHappyCustomerGallery: true,
  showHomepageFAQs: true,
  showPromotionsBanner: true,
  showConversionCTA: true,

  // Grid layout controls
  productGridColumns: 3,
  destinationGridColumns: 3,
  happyCustomerGalleryRows: 2,
  happyCustomerGalleryCols: 3,

  // Dedicated Homepage FAQs
  homepageFAQs: [
    {
      id: 'hfaq-1',
      question: 'What is TheUnbound Ground Operations network coverage?',
      answer: 'TheUnbound operates dedicated, fully licensed DMC ground desks and partner fleets across 7 global regions including Japan, the United Kingdom, Western Europe, Southeast Asia, the Middle East, North America, and Australasia.',
      category: 'Operations',
      displayOrder: 1,
      isPublished: true
    },
    {
      id: 'hfaq-2',
      question: 'How quickly are B2B booking requests confirmed?',
      answer: 'All booking vouchers and operations manifests are issued with a strict 24–48 hour SLA window. Dedicated operations coordinators verify availability with local guides and transport fleets in real-time.',
      category: 'Bookings & SLA',
      displayOrder: 2,
      isPublished: true
    },
    {
      id: 'hfaq-3',
      question: 'Can travel agents build white-label client proposals?',
      answer: 'Yes. Our Quotation Studio allows B2B travel advisors to customize currency, add agency branding, apply customizable commission and markup tiers, and download branded client PDF proposals instantly.',
      category: 'B2B Quotations',
      displayOrder: 3,
      isPublished: true
    },
    {
      id: 'hfaq-4',
      question: 'What cancellation and refund terms apply to ground services?',
      answer: 'Standard day tours and private transfers offer free cancellation up to 72 hours prior to service date. Multi-day bespoke itineraries follow contracted hotel partner and private vehicle terms specified on each voucher.',
      category: 'Policies',
      displayOrder: 4,
      isPublished: true
    }
  ],

  ctaTitle: 'Ready to Expand Your Inbound Luxury Ground Program?',
  ctaSubtitle: 'Connect with our operations desk or build instant wholesale quotations tailored to your discerning clients.',
  ctaButtonText: 'Access B2B Quotation Studio',
  ctaButtonLink: 'quotation'
};

