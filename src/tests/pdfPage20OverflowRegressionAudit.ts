import { buildQuotePresentationModel } from '../services/quotePresentationModel';
import {
  paginateQuotePresentationModel,
  validatePaginatedQuoteCompleteness,
  validatePdfLayoutBounds,
  stripHtmlTagsAndEntities
} from '../services/pdfPaginationEngine';
import { Quotation } from '../types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[PAGE-20 OVERFLOW REGRESSION FAILED] ${message}`);
  }
  console.log(`  ✅ [PASS] ${message}`);
}

const brHeavyShortParagraph = Array.from(
  { length: 28 },
  (_, idx) => `Checkpoint ${String(idx + 1).padStart(2, '0')}: Arrive & inspect gate`
).join('<br/>');

const hugeSingleListItemHtml = `
  <ul>
    <li>
      ${Array.from(
        { length: 18 },
        (_, idx) =>
          `Segment ${idx + 1} of ultra-detailed private cultural briefing covering imperial protocol, sacred pavilion etiquette, private tea room transition timings, seasonal photography windows, luggage concierge handoff, and VIP lane coordination.`
      ).join('<br/>')}
    </li>
  </ul>
`;

const largeServiceTableHtml = `
  <table>
    <thead>
      <tr><th>Timing Window</th><th>Stop / Milestone</th><th>Logistics & Notes</th></tr>
    </thead>
    <tbody>
      ${Array.from(
        { length: 14 },
        (_, idx) =>
          `<tr><td>${String(8 + idx).padStart(2, '0')}:00</td><td>Heritage Milestone #${idx + 1}</td><td>Chauffeur staging at South Gate with priority curator access and luggage escort.</td></tr>`
      ).join('')}
    </tbody>
  </table>
`;

const massiveSpecialInstructions = Array.from(
  { length: 24 },
  (_, idx) =>
    `Dispatch Directive #${idx + 1}: Guests must present original passport verification ${15 + idx} minutes prior to gate opening; coordinator carries emerald badge and confirms platform car assignment via live WhatsApp dispatch.`
).join('\n');

const day14MassiveOverview = `
  <p><strong>Day 14 Grand Finale Cultural & Logistics Briefing</strong></p>
  <p>${Array.from({ length: 12 }, (_, i) => `Phase ${i + 1}: Morning departure from Imperial Suite with curated artisan visits, private gallery access, and synchronized rail luggage forwarding across terminals.`).join(' ')}</p>
  <img src="https://example.com/day14-route-map.jpg" width="2400" height="1450" alt="Day 14 Route Overview" />
  ${largeServiceTableHtml}
`;

const day14MassiveNotes = Array.from(
  { length: 16 },
  (_, idx) =>
    `Operational Note ${idx + 1}: Dedicated airport tarmac team pre-clears tax-free paperwork and escorts guests through fast-track immigration lane.`
).join('<br/>');

function build14DayMultiPageStressQuote(): Quotation {
  const items: any[] = [
    // Oversized Visa service requiring Visa card splitting
    {
      id: 'visa-stress-1',
      service_type: 'VISA',
      category: 'Visa & Ancillary Services',
      dayNumber: 1,
      totalPrice: 12000,
      currency: 'INR',
      paxCount: 2,
      inclusions: Array.from({ length: 10 }, (_, i) => `Visa Inclusion Clause #${i + 1}: Diplomatic dossier & VFS fast-track coverage.`),
      exclusions: Array.from({ length: 6 }, (_, i) => `Visa Exclusion #${i + 1}: Personal courier surcharge outside metro limits.`),
      notes: massiveSpecialInstructions,
      product: {
        id: 'prod-visa-stress',
        name: 'Japan Diplomatic Priority Visa Concierge & Document Review',
        productType: 'Visa Service',
        category: 'Travel Services',
        description: `<p>Comprehensive diplomatic filing workflow:</p>${hugeSingleListItemHtml}`
      }
    }
  ];

  // Days 1..13 with rich realistic multi-service density so Day 14 begins around Page 18-22
  for (let d = 1; d <= 13; d++) {
    items.push({
      id: `d${d}-act-1`,
      service_type: 'ACTIVITY',
      category: 'Guided Experiences',
      dayNumber: d,
      totalPrice: 45000,
      currency: 'INR',
      paxCount: 2,
      inclusions: [
        `Day ${d} Licensed National Guide`,
        `Day ${d} Private Chauffeur Disposal (10 Hours)`,
        `Day ${d} Priority Entrance Tickets`,
        `Day ${d} Seasonal Tasting Lunch`
      ],
      exclusions: [`Day ${d} Personal Shopping`, `Day ${d} Optional Gratuities`],
      notes: `Day ${d} Activity 1 briefing: Meet specialist lobby concierge at 08:30 AM sharp.`,
      product: {
        id: `prod-d${d}-1`,
        name: `Day ${d} Morning Imperial Heritage & Architectural Discovery`,
        productType: 'Activity',
        category: 'Guided Sightseeing',
        description: Array.from(
          { length: 8 },
          (_, k) => `Segment ${k + 1} for Day ${d} morning exploration featuring private shrine grounds, artisan workshop demonstrations, scenic gardens, and dedicated ground transport.`
        ).join('<br/>')
      }
    });

    items.push({
      id: `d${d}-act-2`,
      service_type: 'ACTIVITY',
      category: 'Curated Experiences',
      dayNumber: d,
      totalPrice: 38000,
      currency: 'INR',
      paxCount: 2,
      inclusions: [
        `Day ${d} Evening Cultural Access`,
        `Day ${d} Reserved Observation Deck`
      ],
      exclusions: [`Day ${d} Alcoholic Beverages`],
      notes: `Day ${d} Activity 2 briefing: Evening attire smart casual; chauffeur stages at East Exit.`,
      product: {
        id: `prod-d${d}-2`,
        name: `Day ${d} Afternoon & Evening Culinary Heritage Showcase`,
        productType: 'Activity',
        category: 'Cultural Excursions',
        description: Array.from(
          { length: 7 },
          (_, k) => `Evening segment ${k + 1} for Day ${d} featuring lantern-lit heritage district walk, private kaiseki tasting course, and return hotel transfer.`
        ).join('<br/>')
      }
    });
  }

  // Day 14: Extreme multi-page stress case (overview + br-heavy service + huge table/li/image/instructions + notes)
  items.push({
    id: 'd14-act-1',
    service_type: 'ACTIVITY',
    category: 'Guided Experiences',
    dayNumber: 14,
    totalPrice: 65000,
    currency: 'INR',
    paxCount: 2,
    inclusions: ['Line-break Heavy Schedule Verification', 'Dedicated VIP Coordinator'],
    exclusions: ['Airport Excess Baggage Fee'],
    notes: 'Confirm checkpoint timing at Tokyo Station Marunouchi North Gate.',
    product: {
      id: 'prod-d14-1',
      name: 'Day 14 Morning BR-Heavy Logistics Checkpoint Tour',
      productType: 'Activity',
      category: 'Guided Sightseeing',
      description: brHeavyShortParagraph
    }
  });

  items.push({
    id: 'd14-act-2',
    service_type: 'ACTIVITY',
    category: 'Signature Experiences',
    dayNumber: 14,
    totalPrice: 92000,
    currency: 'INR',
    paxCount: 2,
    inclusions: Array.from({ length: 18 }, (_, i) => `Day 14 VIP Inclusion #${i + 1}: Reserved suite lounge & fast-track clearance.`),
    exclusions: Array.from({ length: 12 }, (_, i) => `Day 14 Exclusion #${i + 1}: Optional duty-free personal purchases.`),
    notes: massiveSpecialInstructions,
    product: {
      id: 'prod-d14-2',
      name: 'Day 14 Grand Finale Imperial Farewell, Rail & Airport Concierge',
      productType: 'Activity',
      category: 'VIP Concierge',
      description: `
        <p>Complete final-day VIP farewell itinerary:</p>
        ${hugeSingleListItemHtml}
        ${largeServiceTableHtml}
        <img src="https://example.com/day14-vip-terminal.jpg" width="1800" height="1280" alt="VIP Terminal Map" />
      `
    }
  });

  const dayDescriptions: Record<number, string> = {};
  const dayNotes: Record<number, string> = {};
  for (let d = 1; d <= 13; d++) {
    dayDescriptions[d] = `Day ${d} overview: Curated full-day private journey through landmark cultural sanctuaries and culinary districts.`;
  }
  dayDescriptions[14] = day14MassiveOverview;
  dayNotes[14] = day14MassiveNotes;

  return ({
    id: 'qte-page20-day14-stress',
    quoteNumber: 'QTE-2026-9914',
    version: 12,
    status: 'DRAFT',
    leadId: 'lead-stress-day14',
    agentId: 'agent-1',
    agentName: 'Travel Partner',
    agentAgency: 'Travel Partner',
    agentEmail: 'business@theunbound.in',
    agentPhone: '+91 9811654959',
    clientName: 'Stress Test Family Office',
    clientCompany: 'Global Ventures Ltd.',
    clientEmail: 'vip@globalventures.example',
    clientPhone: '+91 9800000001',
    destination: 'Japan Grand 14-Day Bespoke Circuit',
    travelStartDate: '2026-12-01',
    travelEndDate: '2026-12-14',
    paxCount: 2,
    adults: 2,
    children: 0,
    infants: 0,
    effectivePax: 2,
    currency: 'INR',
    totalAmount: 1450000,
    netTotal: 1250000,
    marginAmount: 200000,
    marginPercent: 16,
    createdAt: '2026-11-18T10:00:00.000Z',
    validUntil: '2026-12-01T23:59:59.000Z',
    brandingMode: 'STANDARD',
    routeHubs: [
      { hubId: 'tokyo', hubName: 'Tokyo', nights: 5, order: 1 },
      { hubId: 'kyoto', hubName: 'Kyoto', nights: 5, order: 2 },
      { hubId: 'osaka', hubName: 'Osaka', nights: 3, order: 3 }
    ],
    itineraryOverview: `<p>14-Day Grand Circuit Executive Narrative</p>${brHeavyShortParagraph}`,
    dayDescriptions,
    dayOverviews: { ...dayDescriptions },
    dayNotes,
    items
  } as unknown) as Quotation;
}

async function runPage20OverflowRegressionAudit() {
  console.log('================================================================================');
  console.log('🧪 PAGE 20+ OVERFLOW & DAY 14 MULTI-PAGE REGRESSION STRESS SUITE');
  console.log('================================================================================');

  const quote = build14DayMultiPageStressQuote();
  const model = buildQuotePresentationModel(quote);
  const d14Model = model.days.find(d => d.dayNumber === 14);
  assert(
    Boolean(d14Model?.dayOverview && d14Model.dayOverview.includes('Day 14 Grand Finale Cultural')),
    'Day 14 overview automatically extracted from quotation snapshot into DayPresentationData'
  );

  const pages = paginateQuotePresentationModel(model);
  console.log(`  📄 Stress Quote paginated cleanly into ${pages.length} pages.`);
  assert(pages.length >= 20, `14-day rich quotation spans ${pages.length} pages (>= 20 pages, reaching Page 20+ zone)`);

  const completeness = validatePaginatedQuoteCompleteness(model, pages);
  assert(completeness.valid, `Completeness validation passed with 0 errors across all ${pages.length} pages`);

  const bounds = validatePdfLayoutBounds(pages);
  assert(bounds.valid, `Layout bounds validation passed with 0 errors across all ${pages.length} pages`);

  pages.forEach((p) => {
    assert(
      p.usedContentHeight <= p.availableContentHeight + 2,
      `Page ${p.pageNumber}/${p.totalPages}: used=${Math.round(p.usedContentHeight)}px <= available=${p.availableContentHeight}px`
    );
    assert(
      Boolean(p.diagnostics && p.diagnostics.overflowPx === 0 && p.diagnostics.bodyEndY <= p.diagnostics.footerStartY),
      `Page ${p.pageNumber}/${p.totalPages}: diagnostics verified non-collision (bodyEndY=${Math.round(p.diagnostics?.bodyEndY ?? 0)} <= footerStartY=${Math.round(p.diagnostics?.footerStartY ?? 0)}, actions=${p.diagnostics?.rebalanceActions.join(',') || 'none'})`
    );
  });

  const day14Report = completeness.dayReports.find(r => r.dayNumber === 14);
  assert(
    Boolean(
      day14Report &&
      day14Report.headerRendered &&
      day14Report.continuationCount >= 2 &&
      day14Report.allOverviewsPresent &&
      day14Report.allNotesPresent &&
      day14Report.allInclusionsPresent &&
      day14Report.allExclusionsPresent &&
      day14Report.renderedServiceCount === 2
    ),
    `Day 14 spanned ${1 + (day14Report?.continuationCount ?? 0)} pages with 100% of overview, BR-heavy text, 14-row table, single huge <li>, <img>, 18 inclusions, 12 exclusions, 24 dispatch instructions, and operational notes preserved`
  );

  // Verify Day 14 overview exists specifically in DAY_OVERVIEW_* blocks
  const day14OverviewBlocks = pages
    .flatMap(p => p.blocks)
    .filter(b => b.dayNumber === 14 && (b.type === 'DAY_OVERVIEW_BLOCK' || b.type === 'DAY_OVERVIEW_FRAGMENT'));
  assert(
    day14OverviewBlocks.length >= 1 &&
      stripHtmlTagsAndEntities(day14OverviewBlocks.map(b => b.html).join(' ')).includes('Day 14 Grand Finale Cultural & Logistics Briefing'),
    'Day 14 overview text is rendered specifically inside DAY_OVERVIEW blocks under Day 14'
  );

  // Verify negative completeness detection: removing Day 14 overview blocks MUST trigger Day 14 completeness failure
  const strippedPages = pages.map(p => ({
    ...p,
    blocks: p.blocks.filter(b => !(b.dayNumber === 14 && (b.type === 'DAY_OVERVIEW_BLOCK' || b.type === 'DAY_OVERVIEW_FRAGMENT')))
  }));
  const negCheck = validatePaginatedQuoteCompleteness(model, strippedPages);
  assert(
    !negCheck.valid && negCheck.errors.some(e => e.includes('Day 14 overview text is missing from rendered PDF')),
    'Validator strictly rejects pages missing Day 14 DAY_OVERVIEW blocks (even when Day 14 services are present)'
  );

  // Verify Day 14 normalized image style prevents raw height="1450" / "1280" blowouts
  const allDay14Html = pages
    .flatMap(p => p.blocks)
    .filter(b => b.dayNumber === 14)
    .map(b => b.html)
    .join('\n');
  assert(
    !allDay14Html.includes('height="1450"') && allDay14Html.includes('max-height:'),
    'Oversized raw image height attributes stripped and replaced with responsive bounded max-height'
  );
  assert(
    stripHtmlTagsAndEntities(allDay14Html).includes('Dispatch Directive #24'),
    'Final Dispatch Directive #24 inside massive Day 14 specialInstructions preserved intact'
  );

  // Edge Case Regression Suite for Day 14 Overview
  // 1) Literal "Day 14 Overview" + HTML entities (&ndash;, &rsquo;, &#x2014;) + empty <p><br/></p> shadowing in dayOverviews
  const entityAndFallbackQuote = build14DayMultiPageStressQuote();
  (entityAndFallbackQuote as any).dayOverviews = {
    ...(entityAndFallbackQuote as any).dayOverviews,
    14: '<p><br/></p>'
  };
  (entityAndFallbackQuote as any).dayDescriptions[14] =
    '<p><strong>Day 14 Overview &ndash; Description:</strong> Private chauffeur transfer &rsquo;til Narita departure &mdash; tax-free concierge &#x2014; lounge.</p>';
  const entityModel = buildQuotePresentationModel(entityAndFallbackQuote);
  const entityPages = paginateQuotePresentationModel(entityModel);
  const entityValidation = validatePaginatedQuoteCompleteness(entityModel, entityPages);
  assert(
    entityValidation.valid &&
      stripHtmlTagsAndEntities(
        entityPages
          .flatMap(p => p.blocks)
          .filter(b => b.dayNumber === 14 && (b.type === 'DAY_OVERVIEW_BLOCK' || b.type === 'DAY_OVERVIEW_FRAGMENT'))
          .map(b => b.html)
          .join(' ')
      ).includes('Day 14 Overview – Description: Private chauffeur transfer ’til Narita departure — tax-free concierge — lounge.'),
    'Day 14 overview fallback skips blank <p><br/></p>, preserves literal "Day 14 Overview - Description" copy, and normalizes named/hex HTML entities'
  );

  // 2) Plain-text Day 14 overview containing angle brackets (<, >) & ampersand (&)
  const angleQuote = build14DayMultiPageStressQuote();
  (angleQuote as any).dayOverviews = { 14: 'Check-out < 11:00 AM & Day 14 Overview transfer -> Narita Terminal 1 > VIP Lounge' };
  (angleQuote as any).dayDescriptions = { 14: '' };
  const angleModel = buildQuotePresentationModel(angleQuote);
  const anglePages = paginateQuotePresentationModel(angleModel);
  const angleValidation = validatePaginatedQuoteCompleteness(angleModel, anglePages);
  assert(
    angleValidation.valid,
    'Compact plain-text Day 14 overview containing <, >, and & preserves 100% of text cleanly'
  );

  // 3) Snapshot fallback inside authoritativeSnapshot.itinerary using 'day-14' string key
  const snapFallbackQuote = build14DayMultiPageStressQuote();
  delete (snapFallbackQuote as any).dayOverviews;
  delete (snapFallbackQuote as any).dayDescriptions;
  (snapFallbackQuote as any).authoritativeSnapshot = {
    itinerary: {
      dayOverviews: {
        'day-14': '<p>Authoritative snapshot fallback Day 14 overview for final Tokyo departure.</p>'
      }
    }
  };
  const snapModel = buildQuotePresentationModel(snapFallbackQuote);
  const snapPages = paginateQuotePresentationModel(snapModel);
  const snapValidation = validatePaginatedQuoteCompleteness(snapModel, snapPages);
  assert(
    snapValidation.valid &&
      snapModel.days.find(d => d.dayNumber === 14)?.dayOverview?.includes('Authoritative snapshot fallback Day 14 overview') === true,
    'Day 14 overview recovered cleanly from authoritativeSnapshot.itinerary.dayOverviews["day-14"]'
  );

  console.log('\n================================================================================');
  console.log('🎉 ALL PAGE 20+ & DAY 14 OVERVIEW REGRESSION CHECKS PASSED CLEANLY!');
  console.log('================================================================================\n');
}

runPage20OverflowRegressionAudit().catch((err) => {
  console.error('[AUDIT FAILED]:', err);
  process.exit(1);
});
