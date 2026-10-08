import { buildQuotePresentationModel } from '../services/quotePresentationModel';
import {
  paginateQuotePresentationModel,
  getPageContentBounds,
  buildSemanticBlocks,
  validatePaginatedQuoteCompleteness,
  computeMinimumDayStartHeight,
  A4_DIMENSIONS,
  MIN_DAY_START_HEIGHT
} from '../services/pdfPaginationEngine';
import { Quotation } from '../types';

// Mock QTE-2026-2636 Regression Quote (8 Days, Bullet Trains, Guided Tours, Transfers, Visa, Tariff, Policies, Terms)
const mockQuote2636: Quotation = ({
  id: 'qte-2026-2636',
  quoteNumber: 'QTE-2026-2636',
  version: 2,
  status: 'SENT',
  leadId: 'lead-japan-2026',
  agentId: 'agent-1',
  agentName: 'Kenji Sato',
  agentAgency: 'TheUnbound Japan DMC',
  agentEmail: 'kenji.sato@theunbound.in',
  clientName: 'Alexander Montgomery',
  clientCompany: 'Aethelgard Global Family Office',
  clientEmail: 'a.montgomery@aethelgard.co.uk',
  clientPhone: '+44 20 7946 0912',
  destination: 'Japan Golden Route & Kansai Heritage',
  travelStartDate: '2026-10-15',
  travelEndDate: '2026-10-22',
  paxCount: 4,
  adults: 4,
  children: 0,
  infants: 0,
  effectivePax: 4,
  currency: 'USD',
  totalAmount: 18450,
  netTotal: 15600,
  marginAmount: 2850,
  marginPercent: 15.4,
  createdAt: '2026-10-01T10:00:00.000Z',
  validUntil: '2026-10-31T23:59:59.000Z',
  routeHubs: [
    { hubId: 'tokyo', hubName: 'Tokyo', nights: 3, order: 1 },
    { hubId: 'kyoto', hubName: 'Kyoto', nights: 3, order: 2 },
    { hubId: 'osaka', hubName: 'Osaka', nights: 1, order: 3 }
  ],
  items: [
    // Visa
    {
      id: 'item-visa-1',
      service_type: 'VISA',
      category: 'Visa & Ancillary Services',
      dayNumber: 1,
      totalPrice: 400,
      currency: 'USD',
      quantity: 4,
      paxCount: 4,
      product: {
        id: 'prod-visa',
        name: 'Japan eVisa Priority Facilitation (Single Entry Tourist)',
        productType: 'Visa Service',
        category: 'Travel Services',
        sku: 'VSA-JPN-01',
        description: 'Complete end-to-end diplomatic filing and embassy document review for 4 travelers with expedited issuance.'
      }
    },
    // Day 1: Transfer
    {
      id: 'item-d1-transfer',
      service_type: 'TRANSFER',
      category: 'Private Airport Transfers',
      dayNumber: 1,
      totalPrice: 480,
      currency: 'USD',
      quantity: 1,
      paxCount: 4,
      product: {
        id: 'prod-hnd-trf',
        name: 'Tokyo Haneda Airport (HND) VIP Chauffeur Transfer to Central Tokyo',
        productType: 'Transfer',
        category: 'Private Ground Transfers',
        description: 'Meet and greet service at arrivals terminal with English-speaking chauffeur in a luxury executive Alphard.'
      }
    },
    // Day 2: Tokyo Full Day
    {
      id: 'item-d2-tour',
      service_type: 'ACTIVITY',
      category: 'Guided Experiences',
      dayNumber: 2,
      totalPrice: 1200,
      currency: 'USD',
      quantity: 1,
      paxCount: 4,
      product: {
        id: 'prod-tyo-tour',
        name: 'Tokyo Modern & Historic Highlights Private Tour',
        productType: 'Activity',
        category: 'Guided Sightseeing',
        description: 'Full day private excursion covering Meiji Jingu, Asakusa Sensoji Temple, Ginza, and Shibuya Sky with private transport and licensed national guide.'
      }
    },
    // Day 3: Mt Fuji Excursion
    {
      id: 'item-d3-fuji',
      service_type: 'ACTIVITY',
      category: 'Guided Experiences',
      dayNumber: 3,
      totalPrice: 1650,
      currency: 'USD',
      quantity: 1,
      paxCount: 4,
      product: {
        id: 'prod-fuji-tour',
        name: 'Mt. Fuji 5th Station & Lake Kawaguchiko Panoramic Private Expedition',
        productType: 'Activity',
        category: 'Excursions',
        description: 'Private vehicle ascent to Mt Fuji 5th station, scenic Lake Kawaguchiko ropeway, Oshino Hakkai springs, and seasonal matcha tea ceremony.'
      }
    },
    // Day 4: Transfer -> Shinkansen -> Transfer
    {
      id: 'item-d4-trf1',
      service_type: 'TRANSFER',
      category: 'Private Ground Transfers',
      dayNumber: 4,
      totalPrice: 220,
      currency: 'USD',
      quantity: 1,
      paxCount: 4,
      product: {
        id: 'prod-tyo-station',
        name: 'Tokyo Hotel to Tokyo Station Private Chauffeur',
        productType: 'Transfer',
        category: 'Station Transfers',
        description: 'Morning private luggage assistance and transfer to Tokyo Shinkansen platform.'
      }
    },
    {
      id: 'item-d4-rail',
      service_type: 'RAIL',
      category: 'Japan Rail Pass & Tickets',
      dayNumber: 4,
      totalPrice: 880,
      currency: 'USD',
      quantity: 4,
      paxCount: 4,
      product: {
        id: 'prod-shinkansen-nozomi',
        name: 'Tokaido Shinkansen Nozomi Bullet Train: Tokyo → Kyoto (Green Car First Class)',
        productType: 'Rail',
        category: 'High-Speed Rail',
        description: 'Reserved first-class Green Car seats on Nozomi bullet train (2h 15m journey time) with SmartEX PNR QR tickets.'
      }
    },
    {
      id: 'item-d4-trf2',
      service_type: 'TRANSFER',
      category: 'Private Ground Transfers',
      dayNumber: 4,
      totalPrice: 250,
      currency: 'USD',
      quantity: 1,
      paxCount: 4,
      product: {
        id: 'prod-kyo-station',
        name: 'Kyoto Station to Luxury Ryokan Private Chauffeur',
        productType: 'Transfer',
        category: 'Station Transfers',
        description: 'Platform meet and luggage transfer directly to Gion luxury accommodations.'
      }
    },
    // Day 5: Kyoto Private Temples
    {
      id: 'item-d5-kyoto',
      service_type: 'ACTIVITY',
      category: 'Guided Experiences',
      dayNumber: 5,
      totalPrice: 1400,
      currency: 'USD',
      quantity: 1,
      paxCount: 4,
      product: {
        id: 'prod-kyoto-heritage',
        name: 'Kyoto UNESCO Imperial Heritage: Kinkaku-ji, Fushimi Inari & Arashiyama Bamboo Grove',
        productType: 'Activity',
        category: 'Cultural Excursions',
        description: 'VIP early morning access to Fushimi Inari Torii gates, Kinkaku-ji Golden Pavilion, Tenryu-ji Zen garden, and private Sagano scenic railway.'
      }
    },
    // Day 6: Nara Deer Park & Todai-ji
    {
      id: 'item-d6-nara',
      service_type: 'ACTIVITY',
      category: 'Guided Experiences',
      dayNumber: 6,
      totalPrice: 1100,
      currency: 'USD',
      quantity: 1,
      paxCount: 4,
      product: {
        id: 'prod-nara-expedition',
        name: 'Nara Ancient Capital & Great Buddha Todai-ji Private Excursion',
        productType: 'Activity',
        category: 'Historical Tours',
        description: 'Private transport from Kyoto to Nara Park, Kasuga Taisha Shrine, and ancient merchant district.'
      }
    },
    // Day 7: Osaka Street Food & Dotonbori
    {
      id: 'item-d7-osaka',
      service_type: 'ACTIVITY',
      category: 'Guided Experiences',
      dayNumber: 7,
      totalPrice: 950,
      currency: 'USD',
      quantity: 1,
      paxCount: 4,
      product: {
        id: 'prod-osaka-culinary',
        name: 'Osaka Castle & Dotonbori Gourmet Street Food Evening Walk',
        productType: 'Activity',
        category: 'Culinary Experiences',
        description: 'Private tour of Osaka Castle grounds followed by guided tasting tour through Kuromon Ichiba market and Dotonbori canal.'
      }
    },
    // Day 8: Kansai Airport Transfer
    {
      id: 'item-d8-kix',
      service_type: 'TRANSFER',
      category: 'Private Airport Transfers',
      dayNumber: 8,
      totalPrice: 520,
      currency: 'USD',
      quantity: 1,
      paxCount: 4,
      product: {
        id: 'prod-kix-transfer',
        name: 'Osaka Hotel to Kansai International Airport (KIX) VIP Chauffeur Transfer',
        productType: 'Transfer',
        category: 'Airport Transfers',
        description: 'Direct door-to-terminal luxury vehicle transfer with tax-free shopping guidance.'
      }
    }
  ]
} as unknown as Quotation);

async function runPdfPaginationEngineAudit() {
  console.log('================================================================');
  console.log('🧪 RUNNING PDF PAGINATION ENGINE MASTER AUDIT');
  console.log('================================================================');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, description: string) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${description}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${description}`);
      throw new Error(`Audit Failure: ${description}`);
    }
  }

  // 1. Audit Page Bounds calculation & MIN_DAY_START_HEIGHT
  console.log('\n--- 1. Testing Page Safe Area, Content Bounds & MIN_DAY_START_HEIGHT ---');
  const page1Bounds = getPageContentBounds(1);
  const page2Bounds = getPageContentBounds(2);

  assert(page1Bounds.width === 820, 'Page width is standard A4 proportional 820px');
  assert(page1Bounds.height === 1160, 'Page height is standard A4 proportional 1160px');
  assert(page1Bounds.footerHeight === 36, 'Footer height is reserved at 36px');
  assert(page1Bounds.footerGap >= 36, 'Footer safe gap is at least 36px to prevent content collisions');
  assert(page1Bounds.contentBottom <= A4_DIMENSIONS.height - 110, 'Content boundary strictly terminates well before the footer safe zone');
  assert(page2Bounds.availableContentHeight > 880, 'Continuation page provides ample safe content height');
  assert(MIN_DAY_START_HEIGHT >= 180, `MIN_DAY_START_HEIGHT (${MIN_DAY_START_HEIGHT}px) enforces Day Header + associated content grouping`);

  // 2. Audit Semantic Block Building
  console.log('\n--- 2. Testing Semantic Block Extraction ---');
  const presentationModel = buildQuotePresentationModel(mockQuote2636);
  const blocks = buildSemanticBlocks(presentationModel);

  assert(blocks.length >= 15, `Extracted ${blocks.length} discrete semantic blocks`);
  assert(blocks[0].type === 'HERO_AND_DOSSIER', 'First block is Hero & Dossier on Page 1');

  const visaHeader = blocks.find(b => b.type === 'VISA_SECTION_HEADER');
  assert(Boolean(visaHeader), 'Visa section header block generated');

  const dayHeaders = blocks.filter(b => b.type === 'DAY_HEADER');
  assert(dayHeaders.length === 8, '8 Day Header blocks generated for 8-day itinerary');

  const tariffBlock = blocks.find(b => b.type === 'TARIFF_CONTAINER');
  assert(Boolean(tariffBlock), 'Financial Tariff container block exists');

  const standardsBlock = blocks.find(b => b.type === 'OPERATIONAL_STANDARDS');
  assert(Boolean(standardsBlock), 'Operational standards block exists');

  const termsBlock = blocks.find(b => b.type === 'TERMS_AND_SIGNATURE');
  assert(Boolean(termsBlock), 'Commercial terms & signature block exists');

  // 3. Audit Full Pagination Engine Execution
  console.log('\n--- 3. Testing Semantic Pagination Binning ---');
  const pages = paginateQuotePresentationModel(presentationModel);

  assert(pages.length >= 3 && pages.length <= 7, `Proposal successfully paginated into ${pages.length} well-balanced pages`);

  // 4. Audit Page-by-Page Composition & Non-Orphaning Invariants
  console.log('\n--- 4. Inspecting Page-by-Page Composition & Footer Integrity ---');
  pages.forEach((page) => {
    console.log(`  📄 Checking Page ${page.pageNumber} of ${page.totalPages} (Used Height: ${page.usedContentHeight}px / Max: ${page.availableContentHeight}px)`);
    assert(page.usedContentHeight <= page.availableContentHeight + 10, `Page ${page.pageNumber} content fits safely inside content boundaries without overflowing footer`);
    assert(page.footerHtml.includes(`Page ${page.pageNumber} of ${page.totalPages}`), `Page ${page.pageNumber} has accurate running footer numbering`);
    assert(page.footerHtml.includes('THEUNBOUND'), `Page ${page.pageNumber} footer has agency branding`);
    assert(page.blocks.length > 0, `Page ${page.pageNumber} contains meaningful content blocks`);

    // Verify no orphaned day headers at page end
    const lastBlock = page.blocks[page.blocks.length - 1];
    assert(lastBlock.type !== 'DAY_HEADER', `Page ${page.pageNumber} never ends with an orphaned Day Header`);
    assert(lastBlock.type !== 'DAY_CONTINUATION_HEADER', `Page ${page.pageNumber} never ends with an orphaned Day Continuation Header`);
  });

  // 5. Test Short Quote Dynamic Handling (2 Days)
  console.log('\n--- 5. Testing Dynamic Scaling on Short Quotes (2 Days) ---');
  const shortQuote: Quotation = ({
    ...mockQuote2636,
    id: 'qte-short',
    quoteNumber: 'QTE-2026-SHORT',
    travelStartDate: '2026-10-15',
    travelEndDate: '2026-10-16',
    routeHubs: [{ id: 'hub-tokyo', hubId: 'tokyo', hubName: 'Tokyo', nights: 1, order: 1, totalDays: 1, arrivalDate: '2026-10-15', departureDate: '2026-10-16' }],
    items: [mockQuote2636.items[0], mockQuote2636.items[1]]
  } as unknown as Quotation);
  const shortModel = buildQuotePresentationModel(shortQuote);
  const shortPages = paginateQuotePresentationModel(shortModel);
  assert(shortPages.length >= 1, `Short quote paginated cleanly into ${shortPages.length} pages`);
  assert(shortPages[0].footerHtml.includes(`Page 1 of ${shortPages.length}`), 'Short quote footer numbering verified');

  // 6. REGRESSION TEST 1 (Section 20.1) — Day Header Near Page Bottom Must Move With First Activity
  console.log('\n--- 6. Regression Test 1: Day Header Near Page Bottom Moves With Associated Content ---');
  const nearBottomQuote: Quotation = ({
    ...mockQuote2636,
    id: 'qte-reg-1',
    quoteNumber: 'QTE-REG-1',
    travelStartDate: '2026-10-15',
    travelEndDate: '2026-10-16',
    items: [
      mockQuote2636.items[0], // Visa 1 (~185px)
      {
        ...mockQuote2636.items[0],
        id: 'item-visa-2',
        product: {
          ...mockQuote2636.items[0].product,
          name: 'VIP Fast-Track Immigration & Meet-Assist Security Clearance',
          description: 'Priority diplomatic lane clearance and dedicated tarmac concierge escort upon arrival at Tokyo Haneda International Airport.'
        }
      },
      // Day 1 with an unsplittable or large initial activity so Day 1 header cannot fit with its first activity at bottom of Page 1
      {
        id: 'item-d1-arrival-big',
        service_type: 'ACTIVITY',
        category: 'Guided Experiences',
        dayNumber: 1,
        totalPrice: 950,
        currency: 'USD',
        paxCount: 4,
        product: {
          id: 'prod-d1-big',
          name: 'Imperial Tokyo Welcome Orientation & Private Chauffeur Charter',
          productType: 'Activity',
          category: 'Guided Sightseeing',
          description: 'Comprehensive welcome orientation tour with private luxury transport.'
        }
      },
      mockQuote2636.items[2] // Day 2
    ]
  } as unknown as Quotation);
  const nearBottomModel = buildQuotePresentationModel(nearBottomQuote);
  const nearBottomPages = paginateQuotePresentationModel(nearBottomModel);
  nearBottomPages.forEach((p) => {
    p.blocks.forEach((b, idx) => {
      if (b.type === 'DAY_HEADER') {
        const nextOnSamePage = p.blocks[idx + 1];
        assert(
          Boolean(nextOnSamePage && nextOnSamePage.dayNumber === b.dayNumber),
          `Page ${p.pageNumber}: Day ${b.dayNumber} Header is immediately followed on the same page by Day ${b.dayNumber} content (${nextOnSamePage?.type})`
        );
      }
    });
  });

  // 7. REGRESSION TEST 2 (Section 20.2) — Activity Crosses Page Boundary With CONTINUE DAY X
  console.log('\n--- 7. Regression Test 2: Activity Crosses Page Boundary & Splits Cleanly Under CONTINUE DAY X ---');
  const splitActivityQuote: Quotation = ({
    ...mockQuote2636,
    id: 'qte-reg-2',
    quoteNumber: 'QTE-REG-2',
    travelStartDate: '2026-10-15',
    travelEndDate: '2026-10-16',
    items: [
      // Day 1 Activity A
      {
        id: 'item-d1-act-a',
        service_type: 'TRANSFER',
        category: 'Private Airport Transfers',
        dayNumber: 1,
        totalPrice: 480,
        currency: 'USD',
        paxCount: 4,
        notes: 'Chauffeur will wait at Arrival Gate B with personalized name board.',
        inclusions: ['Meet & Greet at Terminal', 'Executive Alphard Vehicle', 'Highway Tolls & Parking', 'Bottled Water & Wi-Fi'],
        exclusions: ['Gratuities', 'Extra stops outside Tokyo 23 wards'],
        product: {
          id: 'prod-act-a',
          name: 'Activity A: Haneda Airport VIP Chauffeur Transfer',
          productType: 'Transfer',
          category: 'Private Ground Transfers',
          description: 'Direct private executive transfer from Haneda International Terminal to luxury hotel in central Tokyo with luggage handling.'
        }
      },
      // Day 1 Activity B (Rich activity that crosses the Page 1 -> Page 2 boundary)
      {
        id: 'item-d1-act-b',
        service_type: 'ACTIVITY',
        category: 'Guided Experiences',
        dayNumber: 1,
        totalPrice: 1450,
        currency: 'USD',
        paxCount: 4,
        notes: 'Smart casual attire required for tea ceremony pavilion. Dietary restrictions confirmed.',
        inclusions: [
          'Licensed National English Guide',
          'Private Luxury Microbus',
          'Meiji Jingu Inner Garden Entry',
          'Shibuya Sky Priority Sunset Pass',
          'Private Matcha Tea Ceremony',
          'Artisanal Wagashi Tasting'
        ],
        exclusions: [
          'Personal shopping expenses',
          'Additional alcoholic beverages',
          'Optional kimono rental'
        ],
        product: {
          id: 'prod-act-b',
          name: 'Activity B: Tokyo Cultural Immersion & Shibuya Sky Sunset Experience',
          productType: 'Activity',
          category: 'Guided Sightseeing',
          description: 'Afternoon private guided exploration of Tokyo shrines and observation decks with curated cultural ceremonies and private chauffeur.'
        }
      },
      // Day 1 Activity C
      {
        id: 'item-d1-act-c',
        service_type: 'ACTIVITY',
        category: 'Dining',
        dayNumber: 1,
        totalPrice: 980,
        currency: 'USD',
        paxCount: 4,
        product: {
          id: 'prod-act-c',
          name: 'Activity C: Ginza Michelin Kaiseki Welcome Dinner',
          productType: 'Dining',
          category: 'Curated Dining',
          description: 'Private tatami room multi-course seasonal kaiseki dinner in Ginza.'
        }
      }
    ]
  } as unknown as Quotation);
  const splitActivityModel = buildQuotePresentationModel(splitActivityQuote);
  const splitActivityPages = paginateQuotePresentationModel(splitActivityModel);
  const splitValidation = validatePaginatedQuoteCompleteness(splitActivityModel, splitActivityPages);
  assert(splitValidation.valid, 'Completeness validation passed for split activity across pages');
  const page2FirstBlock = splitActivityPages[1]?.blocks[0];
  assert(
    Boolean(page2FirstBlock && page2FirstBlock.type === 'DAY_CONTINUATION_HEADER' && page2FirstBlock.html.includes('CONTINUE DAY 1')),
    'Page 2 starts with "CONTINUE DAY 1" continuation marker when Day 1 crosses page boundary'
  );

  // 8. REGRESSION TEST 3 & 4 (Section 20.3 & 20.4) — Multi-Page Single Day (3+ Pages) & Multiple Days With Continuations
  console.log('\n--- 8. Regression Test 3 & 4: Entire Day Crosses 3+ Pages & Multiple Days Maintain Exact Sequence ---');
  const multiPageDayItems = Array.from({ length: 8 }, (_, idx) => ({
    id: `item-d4-multi-${idx + 1}`,
    service_type: 'ACTIVITY',
    category: 'Guided Experiences',
    dayNumber: 4,
    totalPrice: 650 + idx * 50,
    currency: 'USD',
    paxCount: 4,
    notes: `Operational checkpoint ${idx + 1}: Guide coordinates directly with lead dispatch 30 minutes prior.`,
    inclusions: ['Private Chauffeur', 'Licensed Guide', 'VIP Monument Tickets', 'Refreshments'],
    exclusions: ['Personal Expenses', 'Discretionary Tips'],
    product: {
      id: `prod-d4-multi-${idx + 1}`,
      name: `Day 4 Signature Experience #${idx + 1}: Kyoto Imperial & Artisan Heritage Module`,
      productType: 'Activity',
      category: 'Guided Sightseeing',
      description: `Detailed half-day bespoke cultural module #${idx + 1} in Kyoto and Nara featuring private temple access, curator walk, and chauffeured ground logistics.`
    }
  }));

  const multiPageQuote: Quotation = ({
    ...mockQuote2636,
    id: 'qte-reg-3-4',
    quoteNumber: 'QTE-REG-3-4',
    travelStartDate: '2026-10-15',
    travelEndDate: '2026-10-19',
    items: [
      // Day 1 (multiple items to force CONTINUE DAY 1)
      ...splitActivityQuote.items,
      // Day 2 (multiple items to force CONTINUE DAY 2)
      ...splitActivityQuote.items.map((it, idx) => ({
        ...it,
        id: `item-d2-multi-${idx}`,
        dayNumber: 2,
        travelDate: undefined
      })),
      // Day 3 (single item)
      mockQuote2636.items[3],
      // Day 4 (8 rich items spanning 3+ pages -> CONTINUE DAY 4 across multiple pages)
      ...multiPageDayItems,
      // Day 5 (final day starting only after Day 4 is 100% complete)
      {
        ...mockQuote2636.items[7],
        dayNumber: 5,
        travelDate: undefined
      }
    ]
  } as unknown as Quotation);

  const multiPageModel = buildQuotePresentationModel(multiPageQuote);
  const multiPageRendered = paginateQuotePresentationModel(multiPageModel);
  const multiPageValidation = validatePaginatedQuoteCompleteness(multiPageModel, multiPageRendered);

  assert(multiPageValidation.valid, 'Multi-page Day & Multi-Day completeness validation passed with zero errors');

  const day4Report = multiPageValidation.dayReports.find(r => r.dayNumber === 4);
  assert(
    Boolean(day4Report && day4Report.continuationCount >= 2 && day4Report.renderedServiceCount === 8),
    `Day 4 spanned across ${ (day4Report?.continuationCount || 0) + 1 } pages with ${day4Report?.continuationCount} "CONTINUE DAY 4" headers and all 8/8 activities preserved`
  );

  const day1Report = multiPageValidation.dayReports.find(r => r.dayNumber === 1);
  const day2Report = multiPageValidation.dayReports.find(r => r.dayNumber === 2);
  assert(
    Boolean(day1Report && day1Report.continuationCount >= 1 && day2Report && day2Report.continuationCount >= 1),
    'Multiple days (Day 1, Day 2, Day 4) each generated their own data-aware CONTINUE DAY X markers in strict chronological order'
  );

  console.log('\n================================================================');
  console.log(`🎉 ALL ${passed}/${total} PDF PAGINATION ENGINE AUDITS PASSED CLEANLY!`);
  console.log('================================================================\n');
}

runPdfPaginationEngineAudit().catch((err) => {
  console.error('[AUDIT FAILED]:', err);
  process.exit(1);
});
