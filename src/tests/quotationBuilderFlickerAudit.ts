import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppDatabase } from '../services/db';
import { canonicalImageService } from '../services/imageService';
import { destinationTermsService } from '../services/destinationTermsService';
import { calculateProductPrice, clearPricingEngineCache } from '../services/pricingEngine';
import { buildQuotePresentationModel } from '../services/quotePresentationModel';
import { INITIAL_PRODUCTS } from '../data/initialProducts';
import { INITIAL_HOTELS } from '../data/initialHotels';
import { INITIAL_CITY_HUBS } from '../data/initialCityHubs';
import { ProposalDocumentView } from '../components/ProposalDocumentView';
import { Quotation, QuoteItem, TripRouteHub, User } from '../types';

export interface ScenarioMetrics {
  scenario: string;
  cities: number;
  nights: number;
  days: number;
  itemsCount: number;
  modelBuildMs: number;
  ssrRenderMs: number;
  domElementApproxCount: number;
  markupBytes: number;
  unstableIdxKeysInPreview: number;
}

export interface FlickerAuditReport {
  phase: 'BEFORE' | 'AFTER';
  staticDiagnostics: {
    proposalDocumentViewMemoized: boolean;
    stepByStepWorkspaceMemoized: boolean;
    richTextRendererMemoized: boolean;
    richTextEditorMemoized: boolean;
    quotationContextValueMemoized: boolean;
    quotationContextScopedSubscription: boolean;
    portalBuilderIsolatedFromImageTick: boolean;
    builderPreviewQuoteMemoized: boolean;
    builderScrollPositionPreservedPerTab: boolean;
    globalSmoothScrollDisabled: boolean;
    stickyBackdropBlurCount: number;
    repeatedCardTransitionAllCount: number;
    unstableIdxKeysProposal: number;
    unstableIdxKeysWorkspace: number;
    imgWithoutDimensionsProposal: number;
  };
  listenerStormMetrics: {
    auditLogTriggersGlobalDbListeners: number;
    auditLogTriggersSavedQuotesCollectionSubscribers: number;
    imageServiceSubscribeTriggersCount: number;
    footerChangeTriggersDestinationsCollection: boolean;
  };
  scenarios: ScenarioMetrics[];
  assertions: {
    name: string;
    passed: boolean;
    detail: string;
  }[];
}

function addDaysIso(baseIso: string, addDays: number): string {
  const d = new Date(`${baseIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + addDays);
  return d.toISOString().split('T')[0];
}

function buildScenarioQuote(config: {
  id: string;
  title: string;
  hubs: Array<{ hubId: string; hubName: string; nights: number; manualHotel?: boolean; noAcc?: boolean }>;
  targetProductItemsCount: number;
  startDate: string;
  longDescriptions?: boolean;
  withTableAndTerms?: boolean;
  withManualMargin?: boolean;
  adminUser: User;
}): Quotation {
  const totalNights = config.hubs.reduce((s, h) => s + h.nights, 0);
  const totalDays = totalNights + 1;
  const endDate = addDaysIso(config.startDate, totalNights);

  let dayCursor = 0;
  const routeHubs: TripRouteHub[] = config.hubs.map((h, idx) => {
    const occId = `rhub-${config.id}-${idx + 1}`;
    const checkInDate = addDaysIso(config.startDate, dayCursor);
    const checkOutDate = addDaysIso(config.startDate, dayCursor + h.nights);
    dayCursor += h.nights;
    return {
      id: occId,
      itineraryHubOccurrenceId: occId,
      hubId: h.hubId,
      hubName: h.hubName,
      nights: h.nights,
      order: idx + 1,
      checkInDate,
      checkOutDate,
      accommodationType: h.noAcc ? 'NO_ACCOMMODATION' : h.manualHotel ? 'manual' : 'hotel',
      isManualHotel: Boolean(h.manualHotel),
      hotelId: !h.noAcc && !h.manualHotel ? INITIAL_HOTELS[idx % INITIAL_HOTELS.length].id : undefined,
      manualHotel: h.manualHotel
        ? {
            hotelName: `${h.hubName} Bespoke Ryokan Stay ${idx + 1}`,
            city: h.hubName,
            starRating: 5,
            roomCategory: 'Imperial Tatami Suite',
            mealPlan: 'HB',
            checkInDate,
            checkOutDate,
            numberOfNights: h.nights,
            roomsCount: 1,
            currency: 'JPY',
            netRatePerNight: 42000,
            markupPercent: 18,
            hubId: occId,
            itineraryHubOccurrenceId: occId,
            accommodationStayId: `stay-${occId}`
          }
        : undefined
    } as any;
  });

  const items: QuoteItem[] = [];
  // Add hotel items per hub occurrence (except noAcc)
  routeHubs.forEach((hub, idx) => {
    const srcConf = config.hubs[idx];
    if (srcConf.noAcc) return;
    const h = INITIAL_HOTELS[idx % INITIAL_HOTELS.length];
    const room = h.roomTypes?.[0];
    const rate = room?.rates?.[0];
    items.push({
      id: `item-hotel-${config.id}-${idx}`,
      hubId: hub.id,
      itineraryHubOccurrenceId: hub.id,
      accommodationStayId: `stay-${hub.id}`,
      travelDate: hub.checkInDate,
      nights: hub.nights,
      roomsCount: idx % 2 === 0 ? 1 : 2,
      pax: { adults: 2, children: 1, infants: 0 },
      selectedAddonIds: [],
      isManualHotel: Boolean(srcConf.manualHotel),
      product: {
        id: srcConf.manualHotel ? `manual-${hub.id}` : h.id,
        sku: `HTL-${idx + 1}`,
        name: srcConf.manualHotel ? `${hub.hubName} Bespoke Ryokan Stay ${idx + 1}` : h.name,
        category: 'Hotels',
        productType: 'Hotel',
        city: hub.hubName,
        destinationId: 'dest-japan',
        destinationName: 'Japan',
        currency: 'JPY',
        adultNetPrice: (rate?.doubleNetRate || 28000) * hub.nights,
        defaultMarkupPercent: 15,
        inclusions: ['Daily Breakfast', 'Private Check-in Assistance', 'City Orientation Map'],
        exclusions: ['Personal Mini-Bar', 'Spa Treatments']
      } as any,
      calculation: {
        currency: 'INR',
        finalTotalSellingPrice: 45000 * hub.nights,
        totalNetCost: 34000 * hub.nights,
        totalMargin: 11000 * hub.nights,
        taxesTotal: 0,
        surchargesTotal: idx === 0 ? 3500 : 0
      } as any
    } as any);
  });

  // Add experience/transfer/rail/visa items spread across days
  const pool = INITIAL_PRODUCTS.filter((p) => p.category !== 'Hotels');
  const richHtmlDesc = config.longDescriptions
    ? `<h2>Curated Private Experience &amp; Operational Dossier</h2>
       <p>Private licensed English-speaking guide and luxury executive vehicle service covering flagship cultural precincts, timed-entry monuments, and curated culinary stops.</p>
       <ul>
         <li>Priority scheduled entrance with verified timed-slot confirmation</li>
         <li>Executive climate-controlled vehicle with luggage support and bottled water</li>
         <li>Live bilingual concierge backup throughout the full touring window</li>
       </ul>
       ${
         config.withTableAndTerms
           ? `<table><thead><tr><th>Segment</th><th>Schedule</th><th>Included Arrangement</th></tr></thead><tbody><tr><td>Morning</td><td>09:00–12:30</td><td>Private Guided Monument Circuit</td></tr><tr><td>Afternoon</td><td>13:30–17:30</td><td>District Transfer &amp; Cultural Immersion</td></tr></tbody></table>`
           : ''
       }`
    : '<p>Private guided excursion with licensed transport and timed entry.</p>';

  for (let i = 0; i < config.targetProductItemsCount; i++) {
    const baseProd = pool[i % pool.length];
    const dayIdx = i % totalDays;
    const dateStr = addDaysIso(config.startDate, dayIdx);
    const clonedProd = {
      ...baseProd,
      id: `${baseProd.id}-${config.id}-${i}`,
      name: `${baseProd.name} (#${i + 1})`,
      longDescription: richHtmlDesc,
      inclusions: [
        'Private Chauffeur Vehicle',
        'Licensed Guide Service',
        'Highway Tolls & Parking',
        'Bottled Mineral Water'
      ],
      exclusions: ['Personal Shopping', 'Gratuities']
    };
    const calc = calculateProductPrice(clonedProd as any, {
      productId: clonedProd.id,
      productName: clonedProd.name,
      pricingTier: 'B2B',
      userRole: 'ADMIN',
      adults: 2,
      children: 1,
      infants: 0,
      travelDate: dateStr,
      targetCurrency: 'INR'
    });
    items.push({
      id: `item-svc-${config.id}-${i}`,
      travelDate: dateStr,
      serviceTime: i % 2 === 0 ? '09:30 AM' : '02:00 PM',
      pax: { adults: 2, children: 1, infants: 0 },
      selectedAddonIds: [],
      product: clonedProd as any,
      calculation: calc
    } as any);
  }

  const dayThemes: Record<number, string> = {};
  const dayDescriptions: Record<number, string> = {};
  for (let d = 1; d <= totalDays; d++) {
    dayThemes[d] = `Day ${d} Cultural Discovery & Private Transfers`;
    dayDescriptions[d] = richHtmlDesc;
  }

  return {
    id: config.id,
    quoteNumber: `QT-2026-${config.id.toUpperCase()}`,
    version: 3,
    title: config.title,
    destination: 'Japan',
    currency: 'INR',
    quotationScope: 'HOTEL_LAND',
    routeHubs,
    items,
    travelStartDate: config.startDate,
    travelEndDate: endDate,
    adultsCount: 2,
    childrenCount: 1,
    infantsCount: 0,
    totalPax: 3,
    clientName: 'Aarav Mehta',
    clientEmail: 'aarav.mehta@example.com',
    clientCompany: 'Horizon Holidays Pvt Ltd',
    agentId: config.adminUser.id,
    agentName: config.adminUser.name,
    agentAgency: 'TheUnbound Curated Journeys',
    agentEmail: 'agent@example.com',
    agentLogoUrl: 'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=120',
    brandingMode: 'STANDARD',
    dayThemes,
    dayDescriptions,
    itineraryOverview: richHtmlDesc,
    inclusions: ['Private Ground Logistics', 'Handpicked Hotels', 'Daily Breakfast', '24/7 Concierge Desk'],
    exclusions: ['International Airfare', 'Personal Expenses', 'Optional Tips'],
    ...(config.withManualMargin
      ? {
          adminMarginMode: 'REPLACE' as const,
          adminManualMarginType: 'FIXED' as const,
          adminManualMarginValue: 24550,
          agentMarginType: 'PERCENTAGE' as const,
          agentMarginValue: 8
        }
      : {
          agentMarginType: 'PERCENTAGE' as const,
          agentMarginValue: 10
        }),
    ...(config.withTableAndTerms
      ? {
          termsStatus: 'TERMS_CONFIGURED' as const,
          commercialTermsSnapshot: {
            combinedHeading: 'Japan — Commercial Quotation Terms',
            combinedPlainText: 'Payment 30% on confirmation. Cancellation 21 days prior.',
            entries: [
              {
                targetId: 'dest-japan',
                targetName: 'Japan',
                targetType: 'DESTINATION' as const,
                version: 2,
                sections: [
                  {
                    sectionId: 'sec-1',
                    heading: 'Booking & Payment Schedule',
                    displayOrder: 1,
                    isActive: true,
                    htmlContent:
                      '<table><thead><tr><th>Milestone</th><th>Due</th><th>Amount</th></tr></thead><tbody><tr><td>Deposit</td><td>On Confirmation</td><td>30%</td></tr><tr><td>Balance</td><td>30 Days Prior</td><td>70%</td></tr></tbody></table>'
                  },
                  {
                    sectionId: 'sec-2',
                    heading: 'Cancellation & Peak Season Policy',
                    displayOrder: 2,
                    isActive: true,
                    htmlContent: '<p>Full refund up to 30 days before arrival except non-refundable rail/sakura peak allotments.</p>'
                  }
                ]
              }
            ]
          }
        }
      : {}),
    status: 'DRAFT',
    createdAt: '2026-04-01T10:00:00.000Z',
    updatedAt: '2026-04-01T10:00:00.000Z',
    validUntil: '2026-05-01T10:00:00.000Z'
  } as any;
}

export function runQuotationBuilderFlickerAudit(phase: 'BEFORE' | 'AFTER' = 'BEFORE'): FlickerAuditReport {
  const rootDir = path.resolve(process.cwd());
  const readFile = (rel: string) => fs.readFileSync(path.join(rootDir, rel), 'utf8');

  const proposalSrc = readFile('src/components/ProposalDocumentView.tsx');
  const workspaceSrc = readFile('src/components/B2BAgentPortal/StepByStepQuotationWorkspace.tsx');
  const builderSrc = readFile('src/components/B2BAgentPortal/UnifiedB2BQuotationBuilder.tsx');
  const portalSrc = readFile('src/components/B2BAgentPortal/B2BAgentPortal.tsx');
  const contextSrc = readFile('src/context/QuotationContext.tsx');
  const richRendererSrc = readFile('src/components/common/RichTextRenderer.tsx');
  const richEditorSrc = readFile('src/components/common/RichTextEditor.tsx');
  const cssSrc = readFile('src/index.css');

  const staticDiagnostics = {
    proposalDocumentViewMemoized: /React\.memo\(\s*ProposalDocumentView|export const ProposalDocumentView\s*[:=][^=]*React\.memo/.test(proposalSrc),
    stepByStepWorkspaceMemoized: /React\.memo\(\s*StepByStepQuotationWorkspace|export const StepByStepQuotationWorkspace\s*[:=][^=]*React\.memo/.test(workspaceSrc),
    richTextRendererMemoized: /React\.memo/.test(richRendererSrc),
    richTextEditorMemoized: /React\.memo/.test(richEditorSrc),
    quotationContextValueMemoized: /useMemo(?:<[^>]+>)?\(\(\)\s*=>\s*\(\{\s*items,/.test(contextSrc) && /value=\{contextValue\}/.test(contextSrc),
    quotationContextScopedSubscription: /subscribeToCollections\(\s*\[\s*'saved_quotes'/.test(contextSrc),
    portalBuilderIsolatedFromImageTick:
      /canonicalImageService\.subscribe\([\s\S]{0,180}activeTabRef\.current === 'create-quote'[\s\S]{0,60}return/.test(portalSrc) &&
      /db\.subscribeToCollections\(\s*\[\s*'city_hubs'/.test(portalSrc),
    builderPreviewQuoteMemoized: !/<ProposalDocumentView[\s\S]{0,450}buildActiveQuotationDraft\(\)/.test(builderSrc),
    builderScrollPositionPreservedPerTab: /scrollTopMapRef|builderScrollTopRef|previewScrollTopRef/.test(builderSrc),
    globalSmoothScrollDisabled: !/html\s*\{[^}]*scroll-behavior\s*:\s*smooth/i.test(cssSrc),
    stickyBackdropBlurCount:
      (builderSrc.match(/<header[^>]*backdrop-blur/g)?.length || 0) +
      (workspaceSrc.match(/fixed bottom-0[^>]*backdrop-blur/g)?.length || 0),
    repeatedCardTransitionAllCount:
      (proposalSrc.match(/rounded-2xl border[^>]*transition-all/g)?.length || 0) +
      (workspaceSrc.match(/(slot\.dayNumber|key=\{item\.id\})[\s\S]{0,160}transition-all/g)?.length || 0),
    unstableIdxKeysProposal: (proposalSrc.match(/key=\{([^}]*\b(idx|iIdx|eIdx)\b[^}]*)\}/g) || []).length,
    unstableIdxKeysWorkspace: (workspaceSrc.match(/key=\{(idx|iIdx|eIdx|wIdx|rIdx|sIdx)\}/g) || []).length,
    imgWithoutDimensionsProposal: (proposalSrc.match(/<img(?![^>]*width=)[^>]*>/g) || []).length
  };

  // Runtime listener storm checks
  const db = AppDatabase.getInstance();
  const mockAdmin: User = {
    id: 'usr-admin-flicker',
    email: 'business@theunbound.in',
    name: 'Operations Admin',
    role: 'ADMIN',
    status: 'ACTIVE'
  } as any;

  let globalDbCallbacks = 0;
  let savedQuotesScopedCallbacks = 0;
  let destinationsScopedCallbacks = 0;
  let imgCallbacks = 0;

  const unsubGlobal = db.subscribe(() => {
    globalDbCallbacks++;
  });
  const unsubSavedQuotes = db.subscribeToCollections(['saved_quotes'], () => {
    savedQuotesScopedCallbacks++;
  });
  const unsubDests = db.subscribeToCollections(['destinations'], () => {
    destinationsScopedCallbacks++;
  });
  const unsubImg = canonicalImageService.subscribe(() => {
    imgCallbacks++;
  });

  // 1. Trigger audit log write (happens on manual margin / mode toggles)
  db.logAudit(mockAdmin, 'MARGIN_CHANGED', 'Quotation', 'QT-FLICKER-1', 'Simulated margin update', 'ADD', 'REPLACE');
  // Wait synchronously past 25ms debounce using a tiny sync spin? Use setTimeout in async runner!
  // Let's also trigger image service notification and footer_config mutation
  (db as any).setItem('footer_config', db.getFooterConfig(), true);
  (canonicalImageService as any).notify?.();

  unsubGlobal();
  unsubSavedQuotes();
  unsubDests();
  unsubImg();

  // Wait: db.notify uses setTimeout(..., 25). Let's flush dirtyKeys/timers cleanly in async main below,
  // or measure directly in the async exported function!

  clearPricingEngineCache();

  const scenariosInput = [
    {
      name: 'Scenario A (Medium: 2 cities, 8N, 10 items)',
      quote: buildScenarioQuote({
        id: 'scen-a',
        title: 'Tokyo & Kyoto Signature 8N',
        hubs: [
          { hubId: 'hub-tokyo', hubName: 'Tokyo', nights: 4 },
          { hubId: 'hub-kyoto', hubName: 'Kyoto', nights: 4 }
        ],
        targetProductItemsCount: 8,
        startDate: '2026-05-01',
        adminUser: mockAdmin
      })
    },
    {
      name: 'Scenario B (Long: 5 cities, 15N, 32 items)',
      quote: buildScenarioQuote({
        id: 'scen-b',
        title: 'Grand Japan 5-City Circuit 15N',
        hubs: [
          { hubId: 'hub-tokyo', hubName: 'Tokyo', nights: 4 },
          { hubId: 'hub-hakone', hubName: 'Hakone', nights: 2 },
          { hubId: 'hub-kyoto', hubName: 'Kyoto', nights: 4 },
          { hubId: 'hub-osaka', hubName: 'Osaka', nights: 3 },
          { hubId: 'hub-hiroshima', hubName: 'Hiroshima', nights: 2 }
        ],
        targetProductItemsCount: 27,
        startDate: '2026-05-01',
        longDescriptions: true,
        adminUser: mockAdmin
      })
    },
    {
      name: 'Scenario C (Complex: Repeated hubs, stays, manual margin, terms)',
      quote: buildScenarioQuote({
        id: 'scen-c',
        title: 'Repeated Hubs & Complex Commercial Terms 14N',
        hubs: [
          { hubId: 'hub-tokyo', hubName: 'Tokyo', nights: 3 },
          { hubId: 'hub-kyoto', hubName: 'Kyoto', nights: 4, manualHotel: true },
          { hubId: 'hub-osaka', hubName: 'Osaka', nights: 2, noAcc: true },
          { hubId: 'hub-hakone', hubName: 'Hakone', nights: 2 },
          { hubId: 'hub-tokyo', hubName: 'Tokyo', nights: 3, manualHotel: true }
        ],
        targetProductItemsCount: 24,
        startDate: '2026-05-01',
        longDescriptions: true,
        withTableAndTerms: true,
        withManualMargin: true,
        adminUser: mockAdmin
      })
    },
    {
      name: 'Scenario D (Very Long: 9 hubs, 25N, 54 items, long descriptions + tables)',
      quote: buildScenarioQuote({
        id: 'scen-d',
        title: 'Ultimate Japan Grand Expedition 25N',
        hubs: [
          { hubId: 'hub-tokyo', hubName: 'Tokyo', nights: 4 },
          { hubId: 'hub-nikko', hubName: 'Nikko', nights: 2 },
          { hubId: 'hub-hakone', hubName: 'Hakone', nights: 2 },
          { hubId: 'hub-takayama', hubName: 'Takayama', nights: 3 },
          { hubId: 'hub-kanazawa', hubName: 'Kanazawa', nights: 3 },
          { hubId: 'hub-kyoto', hubName: 'Kyoto', nights: 4 },
          { hubId: 'hub-nara', hubName: 'Nara', nights: 2 },
          { hubId: 'hub-osaka', hubName: 'Osaka', nights: 3 },
          { hubId: 'hub-tokyo', hubName: 'Tokyo', nights: 2 }
        ],
        targetProductItemsCount: 45,
        startDate: '2026-05-01',
        longDescriptions: true,
        withTableAndTerms: true,
        withManualMargin: true,
        adminUser: mockAdmin
      })
    }
  ];

  const scenarios: ScenarioMetrics[] = scenariosInput.map(({ name, quote }) => {
    const tModel0 = performance.now();
    const model = buildQuotePresentationModel(quote, {
      name: mockAdmin.name,
      agencyName: 'TheUnbound',
      brandingMode: 'STANDARD'
    });
    const modelBuildMs = Number((performance.now() - tModel0).toFixed(2));

    const tSsr0 = performance.now();
    const html = renderToStaticMarkup(
      React.createElement(ProposalDocumentView, {
        quote,
        agentUser: mockAdmin,
        selectedOptionIndexOrId: 'opt-1'
      })
    );
    const ssrRenderMs = Number((performance.now() - tSsr0).toFixed(2));

    const tagMatches = html.match(/<[a-zA-Z0-9]+[\s>]/g);
    return {
      scenario: name,
      cities: quote.routeHubs?.length || 0,
      nights: model.totalNights,
      days: model.totalDays,
      itemsCount: quote.items.length,
      modelBuildMs,
      ssrRenderMs,
      domElementApproxCount: tagMatches ? tagMatches.length : 0,
      markupBytes: Buffer.byteLength(html, 'utf8'),
      unstableIdxKeysInPreview: staticDiagnostics.unstableIdxKeysProposal
    };
  });

  const assertions = [
    {
      name: 'ProposalDocumentView wrapped in React.memo',
      passed: staticDiagnostics.proposalDocumentViewMemoized,
      detail: String(staticDiagnostics.proposalDocumentViewMemoized)
    },
    {
      name: 'StepByStepQuotationWorkspace wrapped in React.memo',
      passed: staticDiagnostics.stepByStepWorkspaceMemoized,
      detail: String(staticDiagnostics.stepByStepWorkspaceMemoized)
    },
    {
      name: 'RichTextRenderer & RichTextEditor wrapped in React.memo',
      passed: staticDiagnostics.richTextRendererMemoized && staticDiagnostics.richTextEditorMemoized,
      detail: `Renderer=${staticDiagnostics.richTextRendererMemoized}, Editor=${staticDiagnostics.richTextEditorMemoized}`
    },
    {
      name: 'QuotationContext uses scoped saved_quotes subscription & memoized value',
      passed: staticDiagnostics.quotationContextScopedSubscription && staticDiagnostics.quotationContextValueMemoized,
      detail: `scoped=${staticDiagnostics.quotationContextScopedSubscription}, valueMemo=${staticDiagnostics.quotationContextValueMemoized}`
    },
    {
      name: 'Preview quote is memoized (never calls buildActiveQuotationDraft inline)',
      passed: staticDiagnostics.builderPreviewQuoteMemoized,
      detail: String(staticDiagnostics.builderPreviewQuoteMemoized)
    },
    {
      name: 'Scroll position preserved independently for BUILDER and PROPOSAL_PREVIEW',
      passed: staticDiagnostics.builderScrollPositionPreservedPerTab,
      detail: String(staticDiagnostics.builderScrollPositionPreservedPerTab)
    },
    {
      name: 'Global html scroll-behavior: smooth disabled to prevent scroll/restore fighting',
      passed: staticDiagnostics.globalSmoothScrollDisabled,
      detail: String(staticDiagnostics.globalSmoothScrollDisabled)
    },
    {
      name: 'Zero sticky/fixed backdrop-blur compositor thrashing over long scroll',
      passed: staticDiagnostics.stickyBackdropBlurCount === 0,
      detail: `count=${staticDiagnostics.stickyBackdropBlurCount}`
    },
    {
      name: 'B2BAgentPortal isolates create-quote from image ticks and scopes hub subscription',
      passed: staticDiagnostics.portalBuilderIsolatedFromImageTick,
      detail: String(staticDiagnostics.portalBuilderIsolatedFromImageTick)
    },
    {
      name: 'Zero unstable idx keys in ProposalDocumentView & Workspace critical lists',
      passed: staticDiagnostics.unstableIdxKeysProposal === 0 && staticDiagnostics.unstableIdxKeysWorkspace === 0,
      detail: `proposal=${staticDiagnostics.unstableIdxKeysProposal}, workspace=${staticDiagnostics.unstableIdxKeysWorkspace}`
    },
    {
      name: 'Deterministic presentation model & preview parity across Scenarios A-D',
      passed: scenariosInput.every(({ quote }) => {
        const m1 = buildQuotePresentationModel(quote, { name: mockAdmin.name, agencyName: 'TheUnbound', brandingMode: 'STANDARD' });
        const m2 = buildQuotePresentationModel(quote, { name: mockAdmin.name, agencyName: 'TheUnbound', brandingMode: 'STANDARD' });
        const h1 = renderToStaticMarkup(React.createElement(ProposalDocumentView, { quote, agentUser: mockAdmin, selectedOptionIndexOrId: 'opt-1' }));
        const h2 = renderToStaticMarkup(React.createElement(ProposalDocumentView, { quote, agentUser: mockAdmin, selectedOptionIndexOrId: 'opt-1' }));
        return m1.finalCustomerSellingPriceNumeric === m2.finalCustomerSellingPriceNumeric && h1 === h2 && m1.totalDays === m2.totalDays;
      }),
      detail: `verified ${scenariosInput.length} scenarios`
    }
  ];

  return {
    phase,
    staticDiagnostics,
    listenerStormMetrics: {
      auditLogTriggersGlobalDbListeners: globalDbCallbacks,
      auditLogTriggersSavedQuotesCollectionSubscribers: savedQuotesScopedCallbacks,
      imageServiceSubscribeTriggersCount: imgCallbacks,
      footerChangeTriggersDestinationsCollection: destinationsScopedCallbacks > 0
    },
    scenarios,
    assertions
  };
}

export async function runAsyncListenerStormCheck(): Promise<{
  globalDbCallbacksOnAuditLog: number;
  savedQuotesScopedCallbacksOnAuditLog: number;
  destinationsScopedCallbacksOnFooterWrite: number;
}> {
  const db = AppDatabase.getInstance();
  // Flush startup seed dirtyKeys debounce before subscribing isolated listeners
  await new Promise((r) => setTimeout(r, 80));
  const mockAdmin: User = { id: 'usr-admin-async', name: 'Admin', role: 'ADMIN', status: 'ACTIVE' } as any;

  let globalDbCallbacks = 0;
  let savedQuotesCallbacks = 0;
  let destinationsCallbacks = 0;

  const u1 = db.subscribe(() => {
    globalDbCallbacks++;
  });
  const u2 = db.subscribeToCollections(['saved_quotes'], () => {
    savedQuotesCallbacks++;
  });
  const u3 = db.subscribeToCollections(['destinations'], () => {
    destinationsCallbacks++;
  });

  db.logAudit(mockAdmin, 'MARGIN_CHANGED', 'Quotation', 'QT-ASYNC-1', 'Simulated margin toggle', 'ADD', 'REPLACE');
  await new Promise((r) => setTimeout(r, 60));

  (db as any).setItem('footer_config', db.getFooterConfig(), true);
  await new Promise((r) => setTimeout(r, 60));

  u1();
  u2();
  u3();

  return {
    globalDbCallbacksOnAuditLog: globalDbCallbacks,
    savedQuotesScopedCallbacksOnAuditLog: savedQuotesCallbacks,
    destinationsScopedCallbacksOnFooterWrite: destinationsCallbacks
  };
}

if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('quotationBuilderFlickerAudit')) {
  const phaseArg = process.argv.includes('--after') ? 'AFTER' : 'BEFORE';
  (async () => {
    const report = runQuotationBuilderFlickerAudit(phaseArg);
    const asyncStorm = await runAsyncListenerStormCheck();
    report.listenerStormMetrics.auditLogTriggersGlobalDbListeners = asyncStorm.globalDbCallbacksOnAuditLog;
    report.listenerStormMetrics.auditLogTriggersSavedQuotesCollectionSubscribers = asyncStorm.savedQuotesScopedCallbacksOnAuditLog;
    report.listenerStormMetrics.footerChangeTriggersDestinationsCollection = asyncStorm.destinationsScopedCallbacksOnFooterWrite > 0;

    report.assertions.push(
      {
        name: 'Zero saved_quotes scoped listener leakage on audit log writes (vs global firehose)',
        passed: asyncStorm.savedQuotesScopedCallbacksOnAuditLog === 0,
        detail: `globalFirehose=${asyncStorm.globalDbCallbacksOnAuditLog}, savedQuotesScoped=${asyncStorm.savedQuotesScopedCallbacksOnAuditLog}`
      },
      {
        name: 'Zero destinations leakage on footer_config writes',
        passed: asyncStorm.destinationsScopedCallbacksOnFooterWrite === 0,
        detail: `destinationsCallbacks=${asyncStorm.destinationsScopedCallbacksOnFooterWrite}`
      }
    );

    console.log(JSON.stringify(report, null, 2));
    if (phaseArg === 'AFTER') {
      const failed = report.assertions.filter((a) => !a.passed);
      process.exit(failed.length > 0 ? 1 : 0);
    }
    process.exit(0);
  })();
}
