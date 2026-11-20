/**
 * ACCEPTANCE AUDIT: OPTION 2 — COMPLETE FORMATTED QUOTATION (EXCEL-STYLE SPREADSHEET EMAIL)
 *
 * Verifies:
 * 1. Excel-style visual structure & palette (#17365D navy headers, #FFFFFF bold text,
 *    #D9E2F3 alternating service rows, #404040 cell borders, table-only inline CSS).
 * 2. Zero marketing banners, hero cards, CTAs, rounded pills, Flexbox, CSS Grid, or <script>/<style>.
 * 3. Sections A–F completeness: Header, Hotel Accommodation (6 cols + repeated hubs + No Accommodation),
 *    Services/Transfers/Activities (6 cols + Pre-Trip Visa + Transfers + Private Charter + Rail +
 *    Activities + Day at Leisure + Trip-Wide), Pricing Summary (Hotel Total before Land Part Total +
 *    surcharges/taxes/fees/discounts + Final Total from authoritative snapshot), Policies, and
 *    complete destination-specific Commercial Quotation Terms.
 * 4. Rich text (<p>, <br>, </br>, <strong>, <ul>, <ol>, **markdown**) converted cleanly with zero literal tags.
 * 5. Strict confidentiality: zero supplier nett cost, internal margin, or markup leakage.
 * 6. Standard vs White-Label branding isolation (zero TheUnbound leaks in White-Label mode).
 * 7. Preview-to-dispatch parity across EmailNotificationService & renderQuoteEmailFromPresentationModel,
 *    plus zero regressions in Option 1 (Proposal View), PDF pagination, and WhatsApp output.
 */

import { Quotation } from '../types';
import {
  buildQuotePresentationModel,
  renderQuoteEmailFromPresentationModel,
  renderQuoteWhatsAppFromPresentationModel
} from '../services/quotePresentationModel';
import { EmailNotificationService } from '../services/emailNotificationService';
import { paginateQuotePresentationModel } from '../services/pdfPaginationEngine';

import {
  renderCommercialTermsRichHtmlForEmail,
  validateOption2PricingSummary
} from '../services/quoteEmailFormatter';

const TEST_COMM_TERMS_SNAPSHOT = {
  snapshotId: 'snap-terms-opt2-01',
  resolvedAt: '2026-10-01T10:00:00.000Z',
  destinationIds: ['dest-japan', 'dest-korea'],
  destinationNames: ['Japan', 'South Korea'],
  entries: [
    {
      scopeType: 'DESTINATION' as const,
      targetId: 'dest-japan',
      targetName: 'Japan',
      sections: [
        {
          id: 'sec-jp-1',
          heading: '1. Japan Deposit & Payment Schedule',
          htmlContent: [
            '<h2 style="text-align: center;">Payment &amp; Booking Confirmation Rules</h2>',
            '<p style="line-height: 1.8;">A <strong>30% non-refundable advance deposit</strong> is required to lock <em>Shinkansen</em> and <u>Ryokan</u> inventory. <span style="color: #b45309; font-weight: 700;">Peak season allocations close early.</span></p>',
            '<ol start="2" type="1"><li>Balance <strong>100% payable</strong> 21 days prior to departure.</li><li class="ql-indent-1">All wire transfer fees borne by remitting agency.</li></ol>',
            '<ul><li>Confirmed vouchers issued 7 days prior.<ul><li>JR Green Car QR codes delivered electronically.</li></ul></li></ul>',
            '<blockquote style="margin: 0 0 0 40px; border: none; padding: 0px;">Indented Special Clause: Hotel city tax is payable directly at check-in.</blockquote>',
            '<table><thead><tr><th colspan="2" style="text-align: center;">Japan Cancellation Slab</th></tr></thead><tbody><tr><td>21+ Days Prior</td><td align="right">30% Deposit</td></tr><tr><td>0–14 Days Prior</td><td align="right">100% Retention</td></tr></tbody></table>',
            '<p style="text-align: right;">Reference: <a href="https://www.japan.travel/en/" onclick="alert(1)">Official Japan Travel Guide</a> | <a href="javascript:alert(9)">Blocked JS Link</a> | <a href="data:text/html,<script>alert(2)</script>">Blocked Data Link</a><script>window.__xss=1</script></p>'
          ].join(''),
          isActive: true,
          displayOrder: 1
        },
        {
          id: 'sec-jp-2',
          heading: '2. Japan Chauffeur & Wait-Time Policy',
          htmlContent: '<p>Private vehicles include <font color="#dc2626"><strong>60 minutes</strong></font> complimentary airport wait time after flight touchdown.</p><p><del>Legacy 30-minute grace period</del> superseded by 60-minute executive allowance.</p>',
          isActive: true,
          displayOrder: 2
        }
      ]
    },
    {
      scopeType: 'DESTINATION' as const,
      targetId: 'dest-korea',
      targetName: 'South Korea',
      sections: [
        {
          id: 'sec-kr-1',
          heading: '1. K-ETA & Entry Formalities',
          htmlContent: '<p>Travelers must hold a valid passport with at least 6 months validity beyond return date.</p><p class="ql-align-justify">All K-ETA approvals remain the sole responsibility of the traveling guest.</p>',
          isActive: true,
          displayOrder: 1
        }
      ]
    }
  ]
};

const complexMultiHubQuote: Quotation = ({
  id: 'quote-opt2-excel-01',
  quoteNumber: 'UBQ-2026-OPT2-889',
  version: 3,
  status: 'SENT',
  isLocked: true,
  title: 'Grand Japan & Seoul Bespoke Multi-Hub Odyssey',
  destination: 'Japan & South Korea',
  currency: 'INR',
  totalSellingPrice: 912500,
  finalCustomerSellingPrice: 912500,
  hotelAccommodationTotal: 340000,
  landPartTotal: 540000,
  isManualPriceLock: true,
  clientName: 'Vikram & Ananya Kapoor',
  clientCompany: 'Kapoor Holdings Pvt Ltd',
  clientEmail: 'vikram.kapoor@kapoorholdings.in',
  clientPhone: '+91 98111 22334',
  agentName: 'Rohan Khanna',
  agentAgency: 'TheUnbound Luxury DMC',
  agentEmail: 'rohan@theunbound.in',
  agentPhone: '+91-9811654959',
  nationality: 'Indian',
  travelStyle: 'Private Luxury Family',
  travelStartDate: '2026-11-10',
  travelEndDate: '2026-11-16',
  validUntil: '2026-11-01',
  adultsCount: 4,
  childrenCount: 1,
  infantsCount: 0,
  inclusions: [
    'Daily buffet breakfast at all confirmed luxury properties',
    'Private English-speaking chauffeur for airport transfers & charters',
    '24/7 bilingual ground concierge support on WhatsApp'
  ],
  exclusions: [
    'International return airfare & excess baggage',
    'Personal expenses, minibar & gratuities'
  ],
  importantInformation: '<p><strong>Passport Mandate:</strong></br>Carry original passports at all times during Shinkansen travel and duty-free shopping.</p>',
  cancellationPolicy: '<p>Cancellations within 14 days attract 100% supplier retention. **No partial refunds** for unused sightseeing coupons.</p>',
  termsStatus: 'QUOTATION_FINALISED',
  commercialTermsSnapshot: TEST_COMM_TERMS_SNAPSHOT,
  routeHubs: [
    { id: 'hub-tokyo-1', hubName: 'Tokyo', nights: 2, order: 0 },
    { id: 'hub-kyoto', hubName: 'Kyoto', nights: 2, order: 1 },
    { id: 'hub-tokyo-2', hubName: 'Tokyo', nights: 1, order: 2 },
    { id: 'hub-seoul-noacc', hubName: 'Seoul', nights: 1, order: 3, accommodationType: 'NO_ACCOMMODATION' }
  ],
  authoritativeSnapshot: {
    snapshotVersion: 1,
    snapshotHash: 'hash-opt2-889',
    capturedAt: '2026-10-01T10:00:00.000Z',
    sourceVersionNumber: 3,
    quotationScope: 'FULL_PACKAGE',
    selectedOptionId: 'opt-1',
    trip: {
      title: 'Grand Japan & Seoul Bespoke Multi-Hub Odyssey',
      destination: 'Japan & South Korea',
      travelStartDate: '2026-11-10',
      travelEndDate: '2026-11-16',
      totalNights: 6,
      totalDays: 7,
      adultsCount: 4,
      childrenCount: 1,
      infantsCount: 0,
      routeHubs: [
        { id: 'hub-tokyo-1', hubName: 'Tokyo', nights: 2, order: 0 },
        { id: 'hub-kyoto', hubName: 'Kyoto', nights: 2, order: 1 },
        { id: 'hub-tokyo-2', hubName: 'Tokyo', nights: 1, order: 2 },
        { id: 'hub-seoul-noacc', hubName: 'Seoul', nights: 1, order: 3, accommodationType: 'NO_ACCOMMODATION' }
      ]
    },
    pricing: {
      currency: 'INR',
      hotelAccommodationTotal: 340000,
      landPartTotal: 540000,
      surchargesTotal: 25000,
      taxesTotal: 17500,
      serviceFeesTotal: 5000,
      discountsTotal: 15000,
      finalCustomerSellingPrice: 912500,
      pricePerPerson: 182500,
      appliedSurchargesCount: 1
    },
    itinerary: {
      inclusions: [
        'Daily buffet breakfast at all confirmed luxury properties',
        'Private English-speaking chauffeur for airport transfers & charters',
        '24/7 bilingual ground concierge support on WhatsApp'
      ],
      exclusions: [
        'International return airfare & excess baggage',
        'Personal expenses, minibar & gratuities'
      ],
      importantInformation: '<p><strong>Passport Mandate:</strong></br>Carry original passports at all times during Shinkansen travel and duty-free shopping.</p>',
      cancellationPolicy: '<p>Cancellations within 14 days attract 100% supplier retention. **No partial refunds** for unused sightseeing coupons.</p>',
      dayPlan: [
        {
          dayNumber: 1,
          date: '2026-11-10',
          hubId: 'hub-tokyo-1',
          hubName: 'Tokyo',
          customTheme: 'Arrival & Imperial Tokyo Welcome',
          overview: '<p>Touchdown at <strong>Narita International Airport</strong> with private Alphard meet-and-greet.</p>',
          notes: 'Flight JL740 arriving 16:40 JST; chauffeur waits at South Exit Gate B.'
        },
        {
          dayNumber: 2,
          date: '2026-11-11',
          hubId: 'hub-tokyo-1',
          hubName: 'Tokyo',
          customTheme: 'Mt. Fuji & Hakone Private Excursion',
          overview: '<p>Scenic full-day private charter through Lake Kawaguchi and Oshino Hakkai.</p>'
        },
        {
          dayNumber: 3,
          date: '2026-11-12',
          hubId: 'hub-kyoto',
          hubName: 'Kyoto',
          isTransitionDay: true,
          prevHubName: 'Tokyo',
          customTheme: 'Tokaido Shinkansen to Kyoto'
        }
        // Day 4 deliberately has no services -> must render "Day at Leisure"
      ]
    },
    commercialTerms: {
      termsStatus: 'QUOTATION_FINALISED',
      snapshot: TEST_COMM_TERMS_SNAPSHOT
    }
  },
  items: [
    // Hotel 1: Tokyo Stay #1
    {
      id: 'item-hotel-tokyo-1',
      hubId: 'hub-tokyo-1',
      category: 'Hotels',
      service_type: 'HOTEL',
      totalNetCost: 99811,
      supplierCost: 99811,
      internalMargin: 19962,
      product: {
        id: 'prod-htl-1',
        name: 'Aman Tokyo Otemachi',
        category: 'Hotels',
        productType: 'HOTEL',
        city: 'Tokyo',
        destinationName: 'Japan',
        adultNetPrice: 99811,
        markupPercent: 22.5,
        longDescription: '<p>Architectural sanctuary perched atop Otemachi Tower overlooking Imperial Palace Gardens.</p>',
        inclusions: ['Daily American & Japanese Breakfast', 'Furo Thermal Pool Access'],
        exclusions: ['Tokyo Metropolis Accommodation Tax']
      },
      manualHotelDetails: {
        roomType: '2 × Deluxe Palace View Suites',
        roomsCount: 2,
        mealPlan: 'Bed & Breakfast',
        ratePerNight: 77622,
        netCost: 99811,
        markupPercent: 22.5
      },
      pax: { adults: 4, children: 1, infants: 0 },
      travelDate: '2026-11-10',
      calculation: {
        productId: 'prod-htl-1',
        productName: 'Aman Tokyo Otemachi',
        pricingTier: 'B2B',
        currency: 'INR',
        totalNetCost: 99811,
        markupAmount: 24500,
        price: 160000,
        finalTotalSellingPrice: 160000,
        sellingPriceFinal: 160000
      }
    },
    // Hotel 2: Kyoto Stay
    {
      id: 'item-hotel-kyoto',
      hubId: 'hub-kyoto',
      category: 'Hotels',
      service_type: 'HOTEL',
      product: {
        id: 'prod-htl-2',
        name: 'The Ritz-Carlton Kyoto',
        category: 'Hotels',
        productType: 'HOTEL',
        city: 'Kyoto',
        destinationName: 'Japan'
      },
      manualHotelDetails: {
        roomType: '2 × Kamogawa Riverfront Rooms',
        roomsCount: 2,
        mealPlan: 'Half Board (Breakfast & Kaiseki Dinner)',
        ratePerNight: 54321
      },
      pax: { adults: 4, children: 1, infants: 0 },
      travelDate: '2026-11-12',
      calculation: {
        productId: 'prod-htl-2',
        productName: 'The Ritz-Carlton Kyoto',
        pricingTier: 'B2B',
        currency: 'INR',
        price: 120000,
        finalTotalSellingPrice: 120000,
        sellingPriceFinal: 120000
      }
    },
    // Hotel 3: Tokyo Return Stay (Repeated Hub!)
    {
      id: 'item-hotel-tokyo-2',
      hubId: 'hub-tokyo-2',
      category: 'Hotels',
      service_type: 'HOTEL',
      product: {
        id: 'prod-htl-3',
        name: 'Palace Hotel Tokyo',
        category: 'Hotels',
        productType: 'HOTEL',
        city: 'Tokyo',
        destinationName: 'Japan'
      },
      manualHotelDetails: {
        roomType: '2 × Club Balcony King Rooms',
        roomsCount: 2,
        mealPlan: 'Club Lounge Breakfast & Evening Cocktails'
      },
      pax: { adults: 4, children: 1, infants: 0 },
      travelDate: '2026-11-14',
      calculation: {
        productId: 'prod-htl-3',
        productName: 'Palace Hotel Tokyo',
        pricingTier: 'B2B',
        currency: 'INR',
        price: 60000,
        finalTotalSellingPrice: 60000,
        sellingPriceFinal: 60000
      }
    },
    // Pre-Trip Visa Service
    {
      id: 'item-visa-jp',
      category: 'Visa & Ancillary Services',
      service_type: 'VISA',
      product: {
        id: 'prod-visa-jp',
        name: 'Japan Priority Sticker Visa Processing',
        category: 'Visa & Ancillary Services',
        productType: 'Visa Service',
        duration: '5 Working Days',
        longDescription: '<p>End-to-end VFS appointment scheduling and embassy dossier review.</p>',
        inclusions: ['Consular Fee', 'VFS Biometric Escort'],
        exclusions: ['Courier delivery beyond metro limits']
      },
      pax: { adults: 4, children: 1, infants: 0 },
      calculation: {
        productId: 'prod-visa-jp',
        productName: 'Japan Visa',
        pricingTier: 'B2B',
        currency: 'INR',
        totalNetCost: 11223,
        price: 25000,
        finalTotalSellingPrice: 25000,
        sellingPriceFinal: 25000
      }
    },
    // Day 1: Private Airport Transfer with vehicle details, luggage, pickup/dropoff
    {
      id: 'item-trf-nrt',
      category: 'Private Transfers',
      service_type: 'TRANSFER',
      travelDate: '2026-11-10',
      product: {
        id: 'prod-trf-nrt',
        name: 'Narita Airport (NRT) to Tokyo Hotel Private Arrival Transfer',
        category: 'Private Transfers',
        productType: 'TRANSFER',
        city: 'Tokyo',
        duration: '90 Mins',
        longDescription: '<p>Dedicated executive arrival transfer with baggage assistance at Narita Arrivals Hall.</p>',
        inclusions: ['Expressway & Airport Parking Tolls', 'English Meet & Greet'],
        exclusions: ['Extra waiting beyond 60 minutes'],
        importantInformation: 'Driver contacts lead guest via WhatsApp 15 mins prior to pickup.'
      },
      selected_options: {
        reportingTime: '17:15 JST',
        pickupLocation: 'Narita International Airport Terminal 2 Arrivals Gate B',
        dropoffLocation: 'Aman Tokyo Otemachi Lobby'
      },
      metadata: {
        luggageCapacity: 6
      },
      pax: { adults: 4, children: 1, infants: 0 },
      calculation: {
        productId: 'prod-trf-nrt',
        productName: 'NRT Transfer',
        pricingTier: 'B2B',
        currency: 'INR',
        totalNetCost: 33445,
        price: 45000,
        finalTotalSellingPrice: 45000,
        sellingPriceFinal: 45000,
        vehicleDetails: {
          vehiclesAllocated: 1,
          vehicleType: 'Executive MPV',
          vehicleModel: 'Toyota Alphard Executive Lounge',
          maxSeats: 6
        }
      }
    },
    // Day 2: Private Charter with route & multiple attractions + long rich HTML
    {
      id: 'item-charter-fuji',
      category: 'Private Charter',
      service_type: 'CHARTER',
      travelDate: '2026-11-11',
      product: {
        id: 'prod-ch-fuji',
        name: 'Mt. Fuji & Hakone 10-Hour Private Luxury Charter',
        category: 'Private Charter',
        productType: 'CHARTER',
        city: 'Tokyo / Mt. Fuji',
        duration: '10 Hours (08:30 – 18:30)',
        longDescription: '<p>Full-day chauffeur charter covering <strong>Arakurayama Sengen Park</strong>, <strong>Lake Kawaguchi Ropeway</strong>, and <strong>Oshino Hakkai Springs</strong>.</p><ol><li>Morning departure from Aman Tokyo</li><li>Panoramic Mt. Fuji 5th Station weather-permitting ascent</li><li>Return via Hakone Turnpike</li></ol>',
        inclusions: ['Chauffeur Fuel & Highway Tolls', 'Bottled Mineral Water'],
        exclusions: ['Ropeway tickets & lunch']
      },
      metadata: {
        reportingTime: '08:30 JST',
        routeSequence: 'Tokyo -> Chureito Pagoda -> Lake Kawaguchi -> Oshino Hakkai -> Tokyo',
        luggageCapacity: 4
      },
      pax: { adults: 4, children: 1, infants: 0 },
      calculation: {
        productId: 'prod-ch-fuji',
        productName: 'Fuji Charter',
        pricingTier: 'B2B',
        currency: 'INR',
        price: 95000,
        finalTotalSellingPrice: 95000,
        sellingPriceFinal: 95000,
        vehicleDetails: {
          vehiclesAllocated: 1,
          vehicleType: 'Luxury Coach / Van',
          vehicleModel: 'Mercedes-Benz V-Class Grand Edition',
          maxSeats: 7
        }
      }
    },
    // Day 3: Bullet Train
    {
      id: 'item-rail-kyoto',
      category: 'Rail Services',
      service_type: 'RAIL',
      isRail: true,
      travelDate: '2026-11-12',
      product: {
        id: 'prod-rail-1',
        name: 'Tokaido Shinkansen Nozomi 29 Bullet Train',
        category: 'Rail Services',
        productType: 'RAIL',
        city: 'Tokyo',
        duration: '2 Hours 15 Mins',
        longDescription: '<p>Super-express Shinkansen rail transfer between Tokyo Station and Kyoto Station.</p>',
        inclusions: ['Reserved Green Car Reclining Seats', 'Oversized Baggage Reservation'],
        exclusions: ['Onboard Bento Meals']
      },
      railJourneyDetails: {
        originStationName: 'Tokyo Station',
        originStationCode: 'TYO',
        destinationStationName: 'Kyoto Station',
        destinationStationCode: 'KYO',
        carType: 'Green Car',
        seatType: 'Reserved Oversized Baggage',
        serviceGroup: 'NOZOMI_MIZUHO',
        seatPreference: 'Row 8 E/D (Mt. Fuji Right Side)',
        pnrReference: 'JR-EX-994012'
      },
      pax: { adults: 4, children: 1, infants: 0 },
      calculation: {
        productId: 'prod-rail-1',
        productName: 'Shinkansen Nozomi',
        pricingTier: 'B2B',
        currency: 'INR',
        price: 110000,
        finalTotalSellingPrice: 110000,
        sellingPriceFinal: 110000
      }
    },
    // Day 5: Kyoto to Tokyo / TeamLab Planets Tickets + Activity
    {
      id: 'item-act-teamlab',
      category: 'Tours & Activities',
      service_type: 'ACTIVITY',
      travelDate: '2026-11-14',
      product: {
        id: 'prod-act-1',
        name: 'teamLab Planets TOKYO DMM Digital Art Museum Entry',
        category: 'Tours & Activities',
        productType: 'ACTIVITY',
        city: 'Tokyo',
        duration: '2.5 Hours',
        longDescription: 'Immerse yourself in **body-immersive interactive light installations** in Toyosu.<br>Visitors walk barefoot through crystal water galleries.',
        inclusions: ['Timed VIP Slot Admission (14:00 JST)', 'QR E-Ticket Delivery'],
        exclusions: ['Hotel transfers'],
        importantInformation: 'Shorts or rolled-up trousers recommended due to knee-deep water room.'
      },
      selected_options: {
        ticketTierName: 'Priority Timed Entry Pass (14:00 JST)',
        reportingLocation: 'Toyosu teamLab Main Entrance Gate'
      },
      pax: { adults: 4, children: 1, infants: 0 },
      calculation: {
        productId: 'prod-act-1',
        productName: 'teamLab Planets',
        pricingTier: 'B2B',
        currency: 'INR',
        price: 25000,
        finalTotalSellingPrice: 25000,
        sellingPriceFinal: 25000
      }
    }
  ]
} as unknown as Quotation);

export function runOption2ExcelSpreadsheetEmailAudit() {
  console.log('======================================================================');
  console.log('ACCEPTANCE AUDIT: OPTION 2 COMPLETE FORMATTED QUOTATION (EXCEL STYLE)');
  console.log('======================================================================');

  let passed = true;
  const assert = (cond: boolean, label: string) => {
    if (!cond) {
      console.error(`FAIL: ${label}`);
      passed = false;
    } else {
      console.log(`PASS: ${label}`);
    }
  };

  const emailSvc = EmailNotificationService.getInstance();

  // --------------------------------------------------------------------------
  // 1. STANDARD MODE GENERATION & SINGLE SOURCE OF TRUTH PARITY
  // --------------------------------------------------------------------------
  console.log('\n[1] Testing Standard Mode Option 2 & Preview-Dispatch Parity...');
  const customNote = 'All Shinkansen Green Car seats and Aman suites are held until 01 Nov 2026.';
  const standardModel = buildQuotePresentationModel(complexMultiHubQuote, {
    brandingMode: 'STANDARD',
    name: 'Rohan Khanna',
    agencyName: 'TheUnbound Luxury DMC',
    email: 'rohan@theunbound.in',
    phone: '+91-9811654959'
  });

  const modelRender = renderQuoteEmailFromPresentationModel(standardModel, customNote, 'PLAIN_TEXT');
  const canonicalSvc = emailSvc.buildCanonicalQuotationEmail(complexMultiHubQuote, {
    brandingMode: 'STANDARD',
    customNote,
    formattingMode: 'PLAIN_TEXT',
    name: 'Rohan Khanna',
    agencyName: 'TheUnbound Luxury DMC',
    email: 'rohan@theunbound.in',
    phone: '+91-9811654959'
  });
  const dispatchedEmail = emailSvc.generateQuotationProposalEmail(complexMultiHubQuote, {
    brandingMode: 'STANDARD',
    customNote,
    formattingMode: 'PLAIN_TEXT',
    name: 'Rohan Khanna',
    agencyName: 'TheUnbound Luxury DMC',
    email: 'rohan@theunbound.in',
    phone: '+91-9811654959'
  });

  const html = dispatchedEmail.fullHtml;

  assert(
    modelRender.simpleSemanticHtml === canonicalSvc.simpleSemanticHtml &&
      canonicalSvc.simpleSemanticHtml === dispatchedEmail.fullHtml,
    'Preview (simpleSemanticHtml) matches dispatched Option 2 HTML byte-for-byte'
  );
  assert(
    complexMultiHubQuote.version === 3,
    'Generating Option 2 email does not mutate or increment quotation version (stays v3)'
  );

  // --------------------------------------------------------------------------
  // 2. VISUAL STYLING & ANTI-MARKETING CONSTRAINTS
  // --------------------------------------------------------------------------
  console.log('\n[2] Checking Excel-Style Palette, Inline CSS Tables & Anti-Marketing Rules...');
  assert(html.includes('#17365D'), 'Uses dark navy #17365D table headers');
  assert(html.includes('#FFFFFF'), 'Uses crisp white #FFFFFF background/header text');
  assert(html.includes('#D9E2F3'), 'Uses pale blue #D9E2F3 service/detail rows');
  assert(html.includes('1px solid #404040'), 'Uses explicit dark grey cell borders #404040');
  assert(html.includes('border-collapse: collapse'), 'Uses border-collapse: collapse on Excel tables');
  assert(html.includes('table-layout: fixed'), 'Uses table-layout: fixed for aligned columns');
  assert(html.includes('THEUNBOUND &mdash; COMPLETE TRAVEL QUOTATION'), 'Shows Standard THEUNBOUND quotation header');
  assert(!html.includes('Curated Journey Overview'), 'Does NOT contain Option 1 marketing hero banner');
  assert(!html.includes('display: flex') && !html.includes('display: grid'), 'Contains zero Flexbox/Grid layout rules');
  assert(!html.includes('<script') && !html.includes('<style'), 'Contains zero <script> or external <style> blocks');
  assert(!html.includes('border-radius: 999'), 'Contains zero rounded pill badge styling');

  // --------------------------------------------------------------------------
  // 3. SECTIONS A–F CONTENT & ORDER COMPLETENESS
  // --------------------------------------------------------------------------
  console.log('\n[3] Verifying Sections A–F, Repeated Hubs, No Accommodation, Leisure Day & Transfers...');
  // Section A
  assert(html.includes('Vikram &amp; Ananya Kapoor') && html.includes('UBQ-2026-OPT2-889 (v3)'), 'Section A renders client & quote reference v3');
  assert(html.includes(customNote), 'Renders optional Specialist Note');
  // Section B Hotels + Repeated Hubs + No Accommodation
  assert(html.includes('1. Hotel Accommodation'), 'Includes Section 1. Hotel Accommodation heading');
  assert(html.includes('Details (Dynamic Hotel Price)'), 'Includes 6-col hotel header row');
  assert(html.includes('Aman Tokyo Otemachi') && html.includes('The Ritz-Carlton Kyoto') && html.includes('Palace Hotel Tokyo'), 'Includes all 3 hotels across repeated Tokyo -> Kyoto -> Tokyo hubs');
  assert(html.includes('No Accommodation') && html.includes('Seoul'), 'Includes No Accommodation row for Seoul hub');
  // Section C & D Services
  assert(html.includes('2. Services, Transfers &amp; Activities'), 'Includes Section 2. Services, Transfers & Activities heading');
  assert(html.includes('Pre-Trip') && html.includes('Japan Priority Sticker Visa Processing'), 'Includes Pre-Trip Visa service row');
  assert(html.includes('Toyota Alphard Executive Lounge') && html.includes('6 Standard Suitcases') && html.includes('Narita International Airport Terminal 2'), 'Renders transfer vehicle model, luggage allowance, and pickup/dropoff');
  assert(html.includes('Mercedes-Benz V-Class Grand Edition') && html.includes('Tokyo -&gt; Chureito Pagoda -&gt; Lake Kawaguchi') && html.includes('10 Hours'), 'Renders private charter duration, vehicle, and route sequence');
  assert(html.includes('JR-EX-994012') && html.includes('Tokyo Station') && html.includes('Kyoto Station'), 'Renders Shinkansen Bullet Train stations, class, and PNR');
  assert(html.includes('Priority Timed Entry Pass (14:00 JST)'), 'Renders Activity ticket tier & rules');
  assert(html.includes('Day at Leisure') && html.includes('Day 4'), 'Renders Day at Leisure row for empty Day 4');
  // Literal HTML/Markdown tag cleanup
  assert(!html.includes('</br>') && !html.includes('**No partial refunds**') && !html.includes('**body-immersive'), 'Zero uncleaned </br> or raw **Markdown** markers');

  // --------------------------------------------------------------------------
  // 4. SECTION 3: STRICT TWO-TOTAL PRICING SUMMARY & COST CONFIDENTIALITY
  // --------------------------------------------------------------------------
  console.log('\n[4] Verifying Strict 2-Row Section 3 Pricing Summary, Currency, Missing-Value Guard & Confidentiality...');
  const sec3Start = html.indexOf('3. Quotation Pricing Summary');
  const sec4Start = html.indexOf('4. Policies &amp; Operational Notes');
  assert(sec3Start > -1 && sec4Start > sec3Start, 'Section 3. Quotation Pricing Summary block exists in expected position');
  const sec3Html = html.slice(sec3Start, sec4Start);
  const sec3TbodyMatch = sec3Html.match(/<tbody>([\s\S]*?)<\/tbody>/i);
  const sec3Rows = sec3TbodyMatch ? (sec3TbodyMatch[1].match(/<tr>[\s\S]*?<\/tr>/gi) || []) : [];

  assert(sec3Rows.length === 2, `Section 3 renders EXACTLY 2 monetary rows (found ${sec3Rows.length})`);
  assert(
    sec3Rows[0]?.includes('Land Part Total') && (sec3Rows[0]?.includes('540,000') || sec3Rows[0]?.includes('5,40,000')),
    'Row 1 displays authoritative Land Part Total (540,000 INR)'
  );
  assert(
    sec3Rows[1]?.includes('Hotel Part Total') && (sec3Rows[1]?.includes('340,000') || sec3Rows[1]?.includes('3,40,000')),
    'Row 2 displays authoritative Hotel Part Total (340,000 INR)'
  );
  assert(
    !sec3Html.includes('Applicable Surcharges') &&
      !sec3Html.includes('Applicable Taxes') &&
      !sec3Html.includes('Applicable Service') &&
      !sec3Html.includes('Applicable Discounts') &&
      !sec3Html.includes('Final Quotation Total') &&
      !sec3Html.includes('Per-Person Rate') &&
      !sec3Html.includes('Currency &amp; Quotation Validity') &&
      !sec3Html.includes('Hotel Accommodation Total'),
    'Section 3 removes ALL unnecessary breakdown rows (surcharges, taxes, fees, discounts, final total, per-person, validity)'
  );

  // Genuine-zero LAND_ONLY quote validation
  const landOnlyQuote: Quotation = {
    ...complexMultiHubQuote,
    quotationScope: 'LAND_ONLY',
    hotelAccommodationTotal: 0,
    totalSellingPrice: 540000,
    finalCustomerSellingPrice: 540000,
    currency: 'JPY',
    authoritativeSnapshot: {
      ...(complexMultiHubQuote.authoritativeSnapshot as any),
      quotationScope: 'LAND_ONLY',
      pricing: {
        ...(complexMultiHubQuote.authoritativeSnapshot as any).pricing,
        currency: 'JPY',
        hotelAccommodationTotal: 0,
        landPartTotal: 850000,
        finalCustomerSellingPrice: 850000
      }
    }
  };
  const landOnlyModel = buildQuotePresentationModel(landOnlyQuote, { brandingMode: 'STANDARD' });
  const landOnlyCheck = validateOption2PricingSummary(landOnlyModel);
  const landOnlyHtml = renderQuoteEmailFromPresentationModel(landOnlyModel, undefined, 'PLAIN_TEXT').simpleSemanticHtml;
  assert(landOnlyCheck.isValid === true, 'LAND_ONLY quote with authoritative ¥0 Hotel Part Total passes Option 2 validation');
  assert(
    landOnlyHtml.includes('Amount (JPY)') &&
      landOnlyHtml.includes('850,000') &&
      landOnlyHtml.includes('Hotel Part Total') &&
      landOnlyHtml.includes('¥0'),
    'LAND_ONLY JPY quote preserves commercial currency (JPY) and shows confirmed ¥0 Hotel Part Total'
  );

  // Missing / unavailable authoritative total must block dispatch & never invent zero
  const missingHotelModel = {
    ...standardModel,
    isHotelPartTotalAuthoritative: false,
    hotelPartTotalFormatted: undefined
  };
  const missingCheck = validateOption2PricingSummary(missingHotelModel);
  const missingHtml = renderQuoteEmailFromPresentationModel(missingHotelModel, undefined, 'PLAIN_TEXT').simpleSemanticHtml;
  assert(
    !missingCheck.isValid && missingCheck.missingFields.includes('Hotel Part Total'),
    'Missing Hotel Part Total fails validation and reports exact missing field'
  );
  assert(
    missingHtml.includes('Unavailable (Missing Hotel Part Total)') &&
      !missingHtml.includes('Hotel Part Total</td>\n          <td style="font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111111; padding: 7px 8px; border: 1px solid #404040; vertical-align: top; word-wrap: break-word; overflow-wrap: break-word; word-break: break-word; line-height: 1.45; width: 32%; background-color: #D9E2F3; text-align: right; font-size: 12px; font-weight: bold; color: #17365D;">₹0'),
    'Missing Hotel Part Total displays explicit unavailable error and NEVER substitutes zero'
  );

  const missingLandModel = {
    ...standardModel,
    landPartTotalNumeric: Number.NaN,
    isLandPartTotalAuthoritative: false
  };
  const missingLandCheck = validateOption2PricingSummary(missingLandModel);
  assert(
    !missingLandCheck.isValid && missingLandCheck.missingFields.includes('Land Part Total'),
    'NaN/missing Land Part Total fails validation and prevents dispatch'
  );

  const secretTokens = ['99811', '99,811', '77622', '77,622', '54321', '54,321', '19962', '33445', '11223', 'totalNetCost', 'markupPercent', 'supplierCost'];
  const leaked = secretTokens.filter((t) => html.includes(t));
  assert(leaked.length === 0, `Zero internal nett cost, margin, or markup leaked (checked ${secretTokens.length} markers)`);

  // --------------------------------------------------------------------------
  // 5. DESTINATION-SPECIFIC COMMERCIAL QUOTATION TERMS — FULL FORMATTING FIDELITY
  // --------------------------------------------------------------------------
  console.log('\n[5] Verifying Commercial Quotation Terms Original Formatting, Structure & Security...');
  const sec5Start = html.indexOf('5. ');
  const sec5Html = sec5Start > -1 ? html.slice(sec5Start) : '';

  assert(
    sec5Html.includes('Japan &mdash; Commercial Terms') && sec5Html.includes('South Korea &mdash; Commercial Terms'),
    'Preserves both destination headings in Commercial Quotation Terms'
  );
  assert(
    sec5Html.indexOf('Japan &mdash; Commercial Terms') < sec5Html.indexOf('South Korea &mdash; Commercial Terms') &&
      sec5Html.includes('border-top: 2px solid #17365D'),
    'Preserves destination order and visual separation between multiple destinations'
  );
  assert(
    sec5Html.includes('1. Japan Deposit &amp; Payment Schedule') && sec5Html.includes('1. K-ETA &amp; Entry Formalities'),
    'Preserves all destination section headings verbatim'
  );
  assert(
    /<h2\s+style="[^"]*text-align:\s*center[^"]*">Payment &amp; Booking Confirmation Rules<\/h2>/i.test(sec5Html),
    'Preserves <h2> subheading hierarchy and center text alignment'
  );
  assert(
    sec5Html.includes('line-height: 1.8') &&
      /<strong\s+style="[^"]*font-weight:\s*bold[^"]*">30% non-refundable advance deposit<\/strong>/i.test(sec5Html) &&
      /<em\s+style="[^"]*font-style:\s*italic[^"]*">Shinkansen<\/em>/i.test(sec5Html) &&
      /<u\s+style="[^"]*text-decoration:\s*underline[^"]*">Ryokan<\/u>/i.test(sec5Html) &&
      /<del\s+style="[^"]*text-decoration:\s*line-through[^"]*">Legacy 30-minute grace period<\/del>/i.test(sec5Html),
    'Preserves line spacing, bold, italic, underline, and strikethrough inline styles'
  );
  assert(
    sec5Html.includes('color: #b45309') && sec5Html.includes('color: #dc2626'),
    'Preserves <span> and <font color> inline color/emphasis formatting'
  );
  assert(
    /<ol\s+start="2"\s+type="1"\s+style="[^"]*list-style-type:\s*decimal[^"]*">/i.test(sec5Html) &&
      sec5Html.includes('margin-left: 24px') &&
      sec5Html.includes('display: list-item'),
    'Preserves ordered list start attribute, explicit decimal numbering, and ql-indent-1 indentation'
  );
  assert(
    sec5Html.includes('list-style-type: disc') && sec5Html.includes('list-style-type: circle'),
    'Preserves nested unordered bullet lists (disc -> circle)'
  );
  assert(
    /<blockquote\s+style="[^"]*margin:\s*0 0 0 40px[^"]*border:\s*none[^"]*">/i.test(sec5Html),
    'Preserves indented blockquote clauses cleanly'
  );
  assert(
    /<th\s+colspan="2"[^>]*>Japan Cancellation Slab<\/th>/i.test(sec5Html) &&
      /<td\s+align="right"[^>]*text-align:\s*right[^>]*>30% Deposit<\/td>/i.test(sec5Html),
    'Preserves embedded HTML tables including colspan and right cell alignment'
  );
  assert(
    sec5Html.includes('text-align: justify') && sec5Html.includes('text-align: right'),
    'Preserves ql-align-justify and inline text-align: right'
  );
  assert(
    sec5Html.includes('href="https://www.japan.travel/en/"') &&
      !sec5Html.includes('javascript:alert') &&
      !sec5Html.includes('data:text/html') &&
      !sec5Html.includes('onclick=') &&
      !sec5Html.includes('window.__xss') &&
      sec5Html.includes('Blocked JS Link') &&
      sec5Html.includes('Blocked Data Link'),
    'Preserves valid https hyperlinks while neutralizing javascript:/data: links, onclick handlers, and <script> payloads'
  );

  // Plain-text fallback formatting test
  const plainTermsRendered = renderCommercialTermsRichHtmlForEmail(
    '## Booking Conditions\n\n1. First clause with **bold text**.\n2. Second clause with *italic text*.\n\n- Bullet alpha\n  - Indented bullet beta\n\nFinal paragraph.'
  );
  assert(
    plainTermsRendered.includes('<h2') &&
      plainTermsRendered.includes('<ol') &&
      plainTermsRendered.includes('list-style-type: decimal') &&
      plainTermsRendered.includes('<ul') &&
      plainTermsRendered.includes('margin-left: 20px') &&
      plainTermsRendered.includes('<strong') &&
      plainTermsRendered.includes('<em'),
    'Plain-text/Markdown Commercial Terms fallback preserves headings, numbered lists, nested bullets, bold, italic, and paragraphs'
  );

  // --------------------------------------------------------------------------
  // 6. WHITE-LABEL ISOLATION CHECK
  // --------------------------------------------------------------------------
  console.log('\n[6] Verifying White-Label Mode Branding & Zero TheUnbound Leakage...');
  const whiteLabelQuote: Quotation = {
    ...complexMultiHubQuote,
    brandingMode: 'WHITE_LABEL',
    brandingSnapshot: {
      mode: 'WHITE_LABEL',
      agencyName: 'Apex Horizon Travel Ltd',
      email: 'concierge@apexhorizon.com',
      phone: '+44 20 7946 0921',
      website: 'https://apexhorizon.com',
      address: '22 Mayfair Lane, London W1K',
      primaryColor: '#1E293B',
      accentColor: '#B45309',
      capturedAt: '2026-10-01T10:00:00.000Z'
    }
  };
  const whiteLabelEmail = emailSvc.generateQuotationProposalEmail(whiteLabelQuote, {
    brandingMode: 'WHITE_LABEL',
    formattingMode: 'PLAIN_TEXT',
    name: 'Elena Vance',
    agencyName: 'Apex Horizon Travel Ltd',
    email: 'concierge@apexhorizon.com',
    phone: '+44 20 7946 0921'
  });
  const wlHtml = whiteLabelEmail.fullHtml;
  assert(wlHtml.includes('APEX HORIZON TRAVEL LTD &mdash; COMPLETE TRAVEL QUOTATION'), 'White-Label renders partner agency name in Option 2 heading');
  assert(wlHtml.includes('concierge@apexhorizon.com') && wlHtml.includes('+44 20 7946 0921'), 'White-Label shows partner agency email and phone');
  assert(!wlHtml.toLowerCase().includes('theunbound') && !wlHtml.includes('+91-9811654959') && !wlHtml.includes('#00C6A6'), 'Zero TheUnbound brand, phone, or teal accent leaked in White-Label Option 2');

  // --------------------------------------------------------------------------
  // 7. REGRESSION CHECK: OPTION 1, PDF & WHATSAPP UNTOUCHED
  // --------------------------------------------------------------------------
  console.log('\n[7] Verifying Option 1, PDF Pagination & WhatsApp Regression...');
  const option1Email = emailSvc.generateQuotationProposalEmail(complexMultiHubQuote, {
    brandingMode: 'STANDARD',
    formattingMode: 'PROPOSAL_VIEW',
    name: 'Rohan Khanna',
    agencyName: 'TheUnbound Luxury DMC',
    email: 'rohan@theunbound.in',
    phone: '+91-9811654959'
  });
  assert(option1Email.proposalViewHtml?.includes('Curated Journey Overview') === true, 'Option 1 (PROPOSAL_VIEW) preserved cleanly');

  const pdfPages = paginateQuotePresentationModel(standardModel);
  assert(pdfPages.length > 0 && pdfPages.some((p) => p.blocks.some((b) => b.html.includes('Aman Tokyo Otemachi'))), 'PDF pagination unaffected and intact');

  const waText = renderQuoteWhatsAppFromPresentationModel(standardModel);
  assert(waText.includes('Aman Tokyo Otemachi') && waText.includes('Tokaido Shinkansen'), 'WhatsApp output unaffected and intact');

  console.log('\n======================================================================');
  if (passed) {
    console.log('ALL OPTION 2 EXCEL-STYLE QUOTATION ACCEPTANCE CHECKS PASSED.');
  } else {
    console.error('SOME OPTION 2 CHECKS FAILED — REVIEW OUTPUT ABOVE.');
    process.exit(1);
  }
}

runOption2ExcelSpreadsheetEmailAudit();
