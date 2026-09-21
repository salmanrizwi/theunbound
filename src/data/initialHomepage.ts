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
  heroConfig: {
    context: 'HOMEPAGE',
    eyebrowText: 'ESTABLISHED IN 2025 • B2B DESTINATION MANAGEMENT COMPANY',
    heading: 'DESTINATION MANAGEMENT',
    headingHighlight: 'SIMPLIFIED BY INTELLIGENCE.',
    subheading: 'TheUnbound combines deep destination expertise, direct ground contracts, and AI-powered trip creation for modern travel professionals.',
    media: {
      desktopImageUrl: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=2000&auto=format&fit=crop',
      altText: 'TheUnbound Premier Ground Operations & Wholesale DMC Network',
      focalPoint: 'center',
      overlayIntensity: 'medium',
      overlayOpacity: 0.65,
      enableAmbientGrid: true
    },
    showPillars: true,
    pillar1Title: 'DESTINATION EXPERTISE',
    pillar1Subtitle: 'Local knowledge. Destination services. Direct ground operations.',
    pillar2Title: 'DIGITAL SOLUTIONS',
    pillar2Subtitle: 'Package creation. Quotations. Connected multi-currency workflows.',
    pillar3Title: 'AI-POWERED',
    pillar3Subtitle: 'Intelligent B2B travel package and itinerary generation in 30 seconds.',
    ctas: {
      showPrimaryCta: true,
      primaryCtaText: 'EXPLORE PACKAGES',
      primaryCtaAction: 'EXPLORE_PRODUCTS',
      showSecondaryCta: true,
      secondaryCtaText: 'BECOME A PARTNER',
      secondaryCtaAction: 'QUOTE_BUILDER'
    },
    showDiscoveryPanel: false,
    discoveryPanelConfig: {
      showDestination: true,
      showHub: true,
      showDates: true,
      showTravelers: true,
      showTravelStyle: true,
      showProductType: true,
      showAiPlannerShortcut: true,
      ctaText: 'Search Inventory'
    },
    promotion: {
      enabled: true,
      mode: 'AUTO_PRIORITY'
    },
    showTrustStrip: true,
    trustItems: [
      {
        title: 'Direct Net Wholesale Rates',
        description: 'Direct supplier contracting across 7 regions',
        icon: 'ShieldCheck'
      },
      {
        title: '24–48h SLA Operations Desk',
        description: 'Guaranteed booking turnaround and local support',
        icon: 'Clock'
      },
      {
        title: 'Verified Licensed Guides',
        description: 'Bilingual experts and executive chauffeurs',
        icon: 'Building2'
      },
      {
        title: 'Instant White-Label Quotes',
        description: 'Multi-currency proposals with partner branding',
        icon: 'Globe2'
      }
    ],
    showAiQuickBanner: true,
    aiQuickBannerText: 'BUILD A COMPLETE TRAVEL PACKAGE IN AS LITTLE AS 30 SECONDS.',
    aiQuickBannerSubtext: 'From requirement to editable itinerary and ready-to-send quotation.',
    status: 'PUBLISHED'
  },
  featuredDestinationIds: ['japan', 'united-kingdom', 'western-europe', 'southeast-asia', 'middle-east', 'usa', 'australia'],
  destinationOrdering: ['japan', 'united-kingdom', 'western-europe', 'southeast-asia', 'middle-east', 'usa', 'australia'],
  
  // Homepage Hubs CMS Fields (Authoritative Firestore Hub references)
  homepageHubs: [
    { hubId: 'hub-tokyo', enabled: true, displayOrder: 1, featured: true, badge: 'Direct Operations Desk' },
    { hubId: 'hub-kyoto', enabled: true, displayOrder: 2, featured: true, badge: 'Cultural Capital' },
    { hubId: 'hub-osaka', enabled: true, displayOrder: 3, featured: false, badge: 'Gastronomy Hub' },
    { hubId: 'hub-london', enabled: true, displayOrder: 4, featured: true, badge: 'UK Operations Center' },
    { hubId: 'hub-paris', enabled: true, displayOrder: 5, featured: true, badge: 'Western Europe Gateway' },
    { hubId: 'hub-rome', enabled: true, displayOrder: 6, featured: false, badge: 'VIP Ground Logistics' },
    { hubId: 'hub-dubai', enabled: true, displayOrder: 7, featured: true, badge: 'Middle East Hub' },
    { hubId: 'hub-bangkok', enabled: true, displayOrder: 8, featured: false, badge: 'Southeast Asia Hub' }
  ],
  hubSectionTitle: 'Direct Ground Operations Hubs & Gateways',
  hubSectionSubtitle: 'Directly licensed ground handling, owned vehicle dispatch, and accredited bilingual guide networks across premier worldwide commercial gateways.',
  hubSectionBadge: 'GLOBAL DESTINATION HUBS',
  hubGridColumns: 3,

  // Hero Section Customization Fields (Directly connected to BuyerHeroSection)
  heroHighlightText: 'B2B DMC',
  heroStatusBadgeText: 'Operations Desk • Japan, Europe & UK',
  heroTradeBadgeText: 'Trade Only',
  heroVisualPanelTitle: 'Direct B2B Ground Tariffs',
  heroVisualPanelDescription: 'Contracted wholesale rates & white-label quotes',
  heroVisualMaxHeight: 420,
  showHeroPillars: true,
  pillar1Title: 'Direct Contracts',
  pillar1Subtitle: 'Zero brokers. Owned vehicle fleets & verified local guides.',
  pillar2Title: '24–48h SLA',
  pillar2Subtitle: 'Guaranteed turnaround on bespoke multi-city proposals.',
  pillar3Title: 'Net Wholesale',
  pillar3Subtitle: 'Confidential tariffs, multi-currency conversions & markups.',
  showHeroGateways: true,
  heroOperationalHighlights: [
    '24–48h Custom FIT Itinerary Turnaround',
    'Direct Wholesale Ground Contracts (Zero Broker Layers)',
    'Private Chauffeur & VIP Coach Fleets',
    'Licensed Bilingual Destination Experts'
  ],
  heroQuickStats: [
    { label: 'Turnaround', value: '48h', sublabel: 'SLA' },
    { label: 'Trade Access', value: '100%', sublabel: 'B2B Only' },
    { label: 'Ground Duty', value: '24/7', sublabel: 'Dispatch' }
  ],

  // Canonical Homepage Module Sequence (Controls the live homepage section sequence)
  homepageModuleOrder: [
    'hero',
    'brandIntroduction',
    'cityHubs',
    'destinationFilter',
    'partnershipBenefits',
    'onboardingProcess',
    'testimonials',
    'homepageFaqs',
    'conversionCta'
  ],

  // Module display toggles (The 9 live modules on the homepage)
  showHeroSection: true,
  showBrandIntroduction: true,
  brandIntroductionBadge: 'B2B WHOLESALE OPERATIONS • DIRECT GROUND DMC',
  brandIntroductionTitle: 'The Unbound Ground Operations Architecture',
  brandIntroductionSubtitle: 'We act as your dedicated destination management operations team in every destination, pairing owned fleets with verified licensed guides and confidential net pricing.',
  showDestinationFilter: true,
  destinationSectionBadge: 'Destination Management Operations',
  destinationSectionTitle: 'Explore Our Destination Expertise Across Global Corridors',
  destinationSectionSubtitle: 'Specialized ground handling, VIP logistical planning, and local dispatch capabilities across Japan, Europe, Southeast Asia, the United Kingdom, Dubai, and Azerbaijan.',
  showCityHubs: true,
  showPartnershipBenefits: true,
  partnershipBenefitsBadge: 'Trade Partner Advantage',
  partnershipBenefitsTitle: 'Why Premier Travel Advisors & Tour Operators Partner with TheUnbound',
  partnershipBenefitsSubtitle: 'We remove the operational friction of sourcing international ground services, protecting your reputation with guaranteed SLAs and confidential net wholesale rates.',
  showOnboardingProcess: true,
  onboardingProcessBadge: 'Seamless Trade Registration',
  onboardingProcessTitle: 'Partner Onboarding in 4 Simple Steps',
  onboardingProcessSubtitle: 'How licensed travel agents and tour operators unlock full inventory, commercial net rates, and digital booking tools.',
  showCategoryFilters: true,
  showProductGrid: true,
  showGoogleReviews: true,
  showHappyCustomerGallery: true,
  showHomepageFAQs: true,
  showPromotionsBanner: true,
  showConversionCTA: true,
  tradeContactEmail: 'business@theunbound.in',

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

