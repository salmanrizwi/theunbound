/**
 * THEUNBOUND — REPEATED HUBS & INDEPENDENT ACCOMMODATION STAYS AUDIT SUITE
 *
 * Verifies end-to-end support for:
 *  1. Repeated hubs in any sequence (Tokyo -> Osaka -> Kyoto -> Tokyo -> Osaka -> Tokyo)
 *  2. Independent hotel stays per occurrence (same hotel twice, different hotels, manual hotel, NO_ACCOMMODATION)
 *  3. Strict occurrence-level stay matching & NO_ACCOMMODATION isolation in pricingEngine & presentationModel
 *  4. Reordering & deletion of one hub occurrence without disturbing sibling occurrences
 *  5. Per-stay date computation, custom dates, and stay-scoped validation errors
 *  6. All output channels (PresentationModel, PDF Pagination, Email HTML, WhatsApp, Customer Sanitizer, Version History/Diff)
 */

import { AppDatabase } from '../services/db';
import { calculateQuoteTotal, calculateQuoteInternalBreakdown } from '../services/pricingEngine';
import {
  buildQuotePresentationModel,
  renderQuoteWhatsAppFromPresentationModel
} from '../services/quotePresentationModel';
import { paginateQuotePresentationModel } from '../services/pdfPaginationEngine';
import {
  renderProposalViewHtmlEmail,
  renderSimpleSemanticQuotationEmailFromModel
} from '../services/quoteEmailFormatter';
import {
  buildQuoteCommunicationPayload,
  formatWhatsAppQuoteFromPayload,
  formatProposalEmailFromPayload
} from '../services/communicationDataBuilder';
import { sanitizeQuoteForCustomer } from '../utils/customerQuoteSanitizer';
import { computeQuotationVersionDiff } from '../components/Quotations/QuotationVersionHistoryModal';
import {
  getHubOccurrenceId,
  generateAccommodationStayId,
  countHubCityOccurrences,
  getHubCityOccurrenceIndex,
  doesHotelItemBelongToHubOccurrence,
  shouldExcludeHotelItemByNoAccommodation,
  computeStayDatesForHub,
  validateHubStayDates
} from '../utils/hubStayMatching';
import { Quotation, QuoteItem, TripRouteHub, User } from '../types';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, details?: unknown) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${testName}`, details ?? '');
  }
}

function makeHubOccurrence(params: {
  occId: string;
  hubId: string;
  hubName: string;
  nights: number;
  order: number;
  accommodationType?: 'hotel' | 'NO_ACCOMMODATION';
  hotelId?: string;
  stayId?: string;
  roomsCount?: number;
  checkInDate?: string;
  checkOutDate?: string;
  manualHotel?: TripRouteHub['manualHotel'];
}): TripRouteHub {
  return {
    id: params.occId,
    itineraryHubOccurrenceId: params.occId,
    accommodationStayId: params.stayId,
    hubId: params.hubId,
    hubName: params.hubName,
    destinationId: 'dest-japan',
    destinationName: 'Japan',
    nights: params.nights,
    order: params.order,
    accommodationType: params.accommodationType || 'hotel',
    hotelId: params.hotelId,
    roomsCount: params.roomsCount ?? 1,
    checkInDate: params.checkInDate,
    checkOutDate: params.checkOutDate,
    manualHotel: params.manualHotel,
    roomConfiguration: params.hotelId
      ? {
          roomTypeId: 'rt-deluxe',
          roomTypeName: 'Deluxe King Room',
          roomsCount: params.roomsCount ?? 1,
          mealPlanCode: 'BB',
          mealPlanName: 'Bed & Breakfast'
        }
      : undefined
  };
}

function makeHotelQuoteItem(params: {
  id: string;
  occId: string;
  stayId: string;
  hotelId: string;
  hotelName: string;
  city: string;
  checkInDate: string;
  nights: number;
  sellingPrice: number;
  netCost: number;
  rooms?: number;
  isManualHotel?: boolean;
}): QuoteItem {
  const markupAmt = Math.max(0, params.sellingPrice - params.netCost);
  return {
    id: params.id,
    travelDate: params.checkInDate,
    itineraryHubOccurrenceId: params.occId,
    hubId: params.occId,
    accommodationStayId: params.stayId,
    hotelId: params.hotelId,
    isManualHotel: Boolean(params.isManualHotel),
    manualHotelDetails: params.isManualHotel
      ? {
          hotelName: params.hotelName,
          roomType: 'Grand Suite',
          mealPlan: 'BB',
          mealPlanName: 'Daily Breakfast',
          ratePerNight: params.netCost / params.nights,
          rateCurrency: 'USD',
          numberOfRooms: params.rooms ?? 1,
          numberOfNights: params.nights,
          totalSellingPrice: params.sellingPrice,
          itineraryHubOccurrenceId: params.occId,
          accommodationStayId: params.stayId
        }
      : undefined,
    pax: {
      adults: 2,
      children: 0,
      infants: 0,
      rooms: params.rooms ?? 1,
      nights: params.nights
    },
    product: {
      id: params.hotelId,
      sku: `HTL-${params.hotelId}`,
      name: params.hotelName,
      productType: 'HOTEL',
      category: 'Accommodation',
      destinationId: 'dest-japan',
      destinationName: 'Japan',
      city: params.city,
      country: 'Japan',
      duration: `${params.nights} Nights`,
      adultNetPrice: params.netCost,
      sellingPriceStartingFrom: params.sellingPrice,
      currency: 'USD',
      supplierId: 'sup-htl-01',
      supplierName: 'Confidential Hotel Partner',
      images: [],
      status: 'ACTIVE'
    } as any,
    calculation: {
      nativeTotalNetCost: params.netCost,
      nativeCurrency: 'USD',
      totalNetCost: params.netCost,
      markupAmount: markupAmt,
      markupRate: params.netCost > 0 ? markupAmt / params.netCost : 0.25,
      taxAmount: 0,
      serviceFee: 0,
      surchargeTotal: 0,
      finalTotalSellingPrice: params.sellingPrice,
      sellingPriceFinal: params.sellingPrice,
      totalSellingPrice: params.sellingPrice,
      currency: 'USD',
      isPackagePrice: false
    } as any,
    notes: `${params.nights} Nights • Deluxe King Room`,
    agentAdditionalMarkupType: 'PERCENTAGE',
    agentAdditionalMarkupValue: 0
  } as any;
}

async function runAudit() {
  console.log('================================================================');
  console.log('  REPEATED HUBS & INDEPENDENT ACCOMMODATION STAYS AUDIT');
  console.log('================================================================\n');

  const db = AppDatabase.getInstance();
  const agentUser: User = {
    id: 'usr-agent-rep-hubs',
    name: 'Riya Sharma',
    email: 'riya@wanderlux.in',
    agencyName: 'Wanderlux Bespoke Travel',
    role: 'B2B_AGENT',
    category: 'EXTERNAL',
    approvalStatus: 'APPROVED',
    createdAt: new Date().toISOString()
  };

  const lead = db.captureLeadFromSource(
    {
      leadId: `lead-rephub-${Date.now()}`,
      contactName: 'Kabir Malhotra',
      email: 'kabir.malhotra@example.com',
      phone: '+91 98100 11223',
      destinationName: 'Japan',
      paxAdults: 2,
      paxChildren: 0,
      userId: agentUser.id,
      userType: 'B2B_AGENT',
      b2bAgentId: agentUser.id,
      source: 'B2B_PARTNER'
    },
    agentUser
  );

  // ------------------------------------------------------------------
  // 1. REPEATED HUBS SEQUENCE: Tokyo -> Osaka -> Kyoto -> Tokyo -> Osaka -> Tokyo
  // ------------------------------------------------------------------
  console.log('--- 1. Repeated Hubs Sequence & Occurrence Identity ---');

  const stay1 = makeHubOccurrence({
    occId: 'occ-1-tokyo',
    hubId: 'hub-tokyo',
    hubName: 'Tokyo',
    nights: 2,
    order: 1,
    hotelId: 'htl-park-hyatt-tokyo',
    stayId: generateAccommodationStayId('occ-1-tokyo'),
    roomsCount: 1
  });
  const stay2 = makeHubOccurrence({
    occId: 'occ-2-osaka',
    hubId: 'hub-osaka',
    hubName: 'Osaka',
    nights: 2,
    order: 2,
    hotelId: 'htl-conrad-osaka',
    stayId: generateAccommodationStayId('occ-2-osaka'),
    roomsCount: 1
  });
  const stay3 = makeHubOccurrence({
    occId: 'occ-3-kyoto',
    hubId: 'hub-kyoto',
    hubName: 'Kyoto',
    nights: 2,
    order: 3,
    accommodationType: 'NO_ACCOMMODATION',
    stayId: generateAccommodationStayId('occ-3-kyoto')
  });
  // Stay 4: Same hub (Tokyo) AND same hotel (Park Hyatt Tokyo) selected again!
  const stay4 = makeHubOccurrence({
    occId: 'occ-4-tokyo',
    hubId: 'hub-tokyo',
    hubName: 'Tokyo',
    nights: 3,
    order: 4,
    hotelId: 'htl-park-hyatt-tokyo',
    stayId: generateAccommodationStayId('occ-4-tokyo'),
    roomsCount: 2
  });
  // Stay 5: Repeated Osaka with manual hotel
  const stay5 = makeHubOccurrence({
    occId: 'occ-5-osaka',
    hubId: 'hub-osaka',
    hubName: 'Osaka',
    nights: 1,
    order: 5,
    hotelId: 'htl-st-regis-osaka',
    stayId: generateAccommodationStayId('occ-5-osaka'),
    roomsCount: 1,
    manualHotel: {
      hotelName: 'The St. Regis Osaka',
      city: 'Osaka',
      checkInDate: '2026-10-10',
      checkOutDate: '2026-10-11',
      roomType: 'Grand Suite',
      mealPlan: 'BB',
      mealPlanName: 'Daily Breakfast',
      ratePerNight: 450,
      rateCurrency: 'USD',
      numberOfRooms: 1,
      numberOfNights: 1,
      totalSellingPrice: 600,
      itineraryHubOccurrenceId: 'occ-5-osaka',
      accommodationStayId: generateAccommodationStayId('occ-5-osaka')
    }
  });
  // Stay 6: Third visit to Tokyo configured as NO_ACCOMMODATION (must NOT affect Stay 1 or Stay 4!)
  const stay6 = makeHubOccurrence({
    occId: 'occ-6-tokyo',
    hubId: 'hub-tokyo',
    hubName: 'Tokyo',
    nights: 1,
    order: 6,
    accommodationType: 'NO_ACCOMMODATION',
    stayId: generateAccommodationStayId('occ-6-tokyo')
  });

  const routeHubs: TripRouteHub[] = [stay1, stay2, stay3, stay4, stay5, stay6];
  const cityCounts = countHubCityOccurrences(routeHubs);
  assert(routeHubs.length === 6, 'All 6 hub occurrences preserved without deduplication');
  assert(cityCounts.get('hub-tokyo') === 3, 'Tokyo correctly counted as 3 occurrences');
  assert(cityCounts.get('hub-osaka') === 2, 'Osaka correctly counted as 2 occurrences');
  assert(cityCounts.get('hub-kyoto') === 1, 'Kyoto correctly counted as 1 occurrence');
  assert(
    getHubCityOccurrenceIndex(stay4, routeHubs).occurrenceNumber === 2 &&
      getHubCityOccurrenceIndex(stay4, routeHubs).totalInCity === 3,
    'Stay 4 identified as Visit 2 of 3 in Tokyo'
  );
  assert(
    new Set(routeHubs.map(h => getHubOccurrenceId(h))).size === 6,
    'Every occurrence has a unique itineraryHubOccurrenceId'
  );

  // ------------------------------------------------------------------
  // 2. DATE COMPUTATION & VALIDATION ACROSS REPEATED HUBS
  // ------------------------------------------------------------------
  console.log('\n--- 2. Sequential Dates & Stay-Scoped Validation ---');

  const tripStart = '2026-10-01';
  const d1 = computeStayDatesForHub(routeHubs, stay1.id, tripStart);
  const d2 = computeStayDatesForHub(routeHubs, stay2.id, tripStart);
  const d3 = computeStayDatesForHub(routeHubs, stay3.id, tripStart);
  const d4 = computeStayDatesForHub(routeHubs, stay4.id, tripStart);
  const d5 = computeStayDatesForHub(routeHubs, stay5.id, tripStart);
  const d6 = computeStayDatesForHub(routeHubs, stay6.id, tripStart);

  assert(d1.checkInIso === '2026-10-01' && d1.checkOutIso === '2026-10-03', 'Stay 1 Tokyo dates: Oct 1 -> Oct 3 (2N)');
  assert(d2.checkInIso === '2026-10-03' && d2.checkOutIso === '2026-10-05', 'Stay 2 Osaka dates: Oct 3 -> Oct 5 (2N)');
  assert(d3.checkInIso === '2026-10-05' && d3.checkOutIso === '2026-10-07', 'Stay 3 Kyoto (NO_ACC) dates advance timeline: Oct 5 -> Oct 7 (2N)');
  assert(d4.checkInIso === '2026-10-07' && d4.checkOutIso === '2026-10-10', 'Stay 4 Tokyo Visit 2 dates: Oct 7 -> Oct 10 (3N)');
  assert(d5.checkInIso === '2026-10-10' && d5.checkOutIso === '2026-10-11', 'Stay 5 Osaka Visit 2 dates: Oct 10 -> Oct 11 (1N)');
  assert(d6.checkInIso === '2026-10-11' && d6.checkOutIso === '2026-10-12', 'Stay 6 Tokyo Visit 3 dates: Oct 11 -> Oct 12 (1N)');

  const validIssues = validateHubStayDates(routeHubs, tripStart);
  assert(
    validIssues.filter(i => i.severity === 'ERROR').length === 0,
    'Consecutive checkout === next check-in produces 0 date errors'
  );

  // Inject an invalid date range ONLY on Stay 4
  const badHubs = routeHubs.map(h =>
    h.id === stay4.id ? { ...h, checkInDate: '2026-10-09', checkOutDate: '2026-10-08' } : h
  );
  const invalidIssues = validateHubStayDates(badHubs, tripStart);
  const stay4Error = invalidIssues.find(
    i => i.severity === 'ERROR' && i.hubOccurrenceId === stay4.id
  );
  const stay1Error = invalidIssues.find(
    i => i.severity === 'ERROR' && i.hubOccurrenceId === stay1.id
  );
  assert(
    Boolean(stay4Error) && !stay1Error,
    'Invalid checkout <= check-in flags ONLY Stay 4 Tokyo without flagging Stay 1 Tokyo',
    invalidIssues
  );

  // ------------------------------------------------------------------
  // 3. STRICT MATCHING & NO-ACCOMMODATION PRICING ISOLATION
  // ------------------------------------------------------------------
  console.log('\n--- 3. Strict Stay Matching & Pricing Isolation ---');

  const itemStay1 = makeHotelQuoteItem({
    id: 'item-stay-1',
    occId: stay1.id,
    stayId: stay1.accommodationStayId!,
    hotelId: 'htl-park-hyatt-tokyo',
    hotelName: 'Park Hyatt Tokyo',
    city: 'Tokyo',
    checkInDate: d1.checkInIso,
    nights: 2,
    sellingPrice: 1200,
    netCost: 900,
    rooms: 1
  });
  const itemStay2 = makeHotelQuoteItem({
    id: 'item-stay-2',
    occId: stay2.id,
    stayId: stay2.accommodationStayId!,
    hotelId: 'htl-conrad-osaka',
    hotelName: 'Conrad Osaka',
    city: 'Osaka',
    checkInDate: d2.checkInIso,
    nights: 2,
    sellingPrice: 800,
    netCost: 600,
    rooms: 1
  });
  const itemStay4 = makeHotelQuoteItem({
    id: 'item-stay-4',
    occId: stay4.id,
    stayId: stay4.accommodationStayId!,
    hotelId: 'htl-park-hyatt-tokyo', // Same hotelId & city as Stay 1!
    hotelName: 'Park Hyatt Tokyo',
    city: 'Tokyo',
    checkInDate: d4.checkInIso,
    nights: 3,
    sellingPrice: 3600,
    netCost: 2700,
    rooms: 2
  });
  const itemStay5 = makeHotelQuoteItem({
    id: 'item-stay-5',
    occId: stay5.id,
    stayId: stay5.accommodationStayId!,
    hotelId: 'htl-st-regis-osaka',
    hotelName: 'The St. Regis Osaka',
    city: 'Osaka',
    checkInDate: d5.checkInIso,
    nights: 1,
    sellingPrice: 600,
    netCost: 450,
    rooms: 1,
    isManualHotel: true
  });
  // Deliberately include a stale hotel item attached to Stay 6 (which is NO_ACCOMMODATION)
  // to prove it gets excluded WITHOUT excluding Stay 1 or Stay 4 (same city: Tokyo)!
  const staleItemStay6 = makeHotelQuoteItem({
    id: 'item-stay-6-stale',
    occId: stay6.id,
    stayId: stay6.accommodationStayId!,
    hotelId: 'htl-aman-tokyo',
    hotelName: 'Aman Tokyo',
    city: 'Tokyo',
    checkInDate: d6.checkInIso,
    nights: 1,
    sellingPrice: 1500,
    netCost: 1100,
    rooms: 1
  });

  assert(
    doesHotelItemBelongToHubOccurrence(itemStay1, stay1, routeHubs) === true &&
      doesHotelItemBelongToHubOccurrence(itemStay1, stay4, routeHubs) === false &&
      doesHotelItemBelongToHubOccurrence(itemStay1, stay6, routeHubs) === false,
    'Stay 1 item matches ONLY Stay 1 (never Stay 4 or Stay 6 even with identical hotelId/city)'
  );
  assert(
    doesHotelItemBelongToHubOccurrence(itemStay4, stay4, routeHubs) === true &&
      doesHotelItemBelongToHubOccurrence(itemStay4, stay1, routeHubs) === false,
    'Stay 4 item matches ONLY Stay 4 (even though same Park Hyatt Tokyo)'
  );
  assert(
    shouldExcludeHotelItemByNoAccommodation(itemStay1, routeHubs, false) === false &&
      shouldExcludeHotelItemByNoAccommodation(itemStay4, routeHubs, false) === false &&
      shouldExcludeHotelItemByNoAccommodation(staleItemStay6, routeHubs, false) === true,
    'NO_ACCOMMODATION on Stay 6 excludes ONLY Stay 6 item, preserving Stay 1 and Stay 4 Tokyo hotels'
  );

  const allItems = [itemStay1, itemStay2, itemStay4, itemStay5, staleItemStay6];
  const expectedActiveTotal = 1200 + 800 + 3600 + 600; // 6200 (excludes 1500 staleItemStay6)

  const quote: Quotation = {
    id: `quote-rephub-${Date.now()}`,
    quoteNumber: 'QTE-REPHUB-2026',
    leadId: lead.id,
    linkedLeadId: lead.id,
    version: 1,
    latestVersion: 1,
    status: 'DRAFT',
    scope: 'HOTEL_LAND',
    quotationScope: 'HOTEL_LAND',
    title: 'Grand Japan Loop (Repeated Hubs)',
    destination: 'Japan',
    currency: 'USD',
    totalNetCost: 4650,
    totalMargin: 1550,
    theUnboundBaseSellingPrice: expectedActiveTotal,
    baseFinalSellingPrice: expectedActiveTotal,
    agentMarginType: 'PERCENTAGE',
    agentMarginValue: 0,
    agentMarginAmount: 0,
    totalSellingPrice: expectedActiveTotal,
    finalCustomerSellingPrice: expectedActiveTotal,
    totalTaxes: 0,
    overallMarkupPercent: 0,
    overallDiscountPercent: 0,
    clientName: 'Kabir Malhotra',
    clientEmail: 'kabir.malhotra@example.com',
    clientPhone: '+91 98100 11223',
    agentId: agentUser.id,
    agentName: agentUser.name,
    agentEmail: agentUser.email,
    agentAgency: agentUser.agencyName,
    createdBy: agentUser.id,
    createdByName: agentUser.name,
    createdByUserType: 'B2B_AGENT',
    travelStartDate: tripStart,
    travelEndDate: '2026-10-12',
    totalPax: 2,
    adultsCount: 2,
    childrenCount: 0,
    infantsCount: 0,
    agentNotes: '',
    termsAndConditions: '',
    validUntil: '2026-12-31',
    routeHubs,
    items: allItems,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const calcTotal = calculateQuoteTotal(quote);
  const internalBreakdown = calculateQuoteInternalBreakdown({
    items: allItems,
    targetCurrency: 'USD',
    scope: 'HOTEL_LAND',
    routeHubs,
    user: agentUser
  });
  const internalBreakdownWithoutStale = calculateQuoteInternalBreakdown({
    items: [itemStay1, itemStay2, itemStay4, itemStay5],
    targetCurrency: 'USD',
    scope: 'HOTEL_LAND',
    routeHubs,
    user: agentUser
  });

  const activeBreakdownItems = internalBreakdown.itemizedBreakdown.filter(
    i => !i.isExcludedNoAccommodation
  );
  const excludedBreakdownItems = internalBreakdown.itemizedBreakdown.filter(
    i => i.isExcludedNoAccommodation
  );

  assert(
    Math.abs(calcTotal.finalCustomerSellingPrice - expectedActiveTotal) < 0.01,
    `calculateQuoteTotal returns exact sum (${expectedActiveTotal}) excluding only Stay 6 NO_ACCOMMODATION`,
    calcTotal.finalCustomerSellingPrice
  );
  assert(
    Math.abs(internalBreakdown.finalPackagePrice - internalBreakdownWithoutStale.finalPackagePrice) < 0.01 &&
      activeBreakdownItems.length === 4 &&
      excludedBreakdownItems.length === 1 &&
      excludedBreakdownItems[0].itemId === staleItemStay6.id,
    'calculateQuoteInternalBreakdown includes 4 active stays and excludes ONLY Stay 6 item',
    {
      withStale: internalBreakdown.finalPackagePrice,
      withoutStale: internalBreakdownWithoutStale.finalPackagePrice,
      activeCount: activeBreakdownItems.length,
      excludedCount: excludedBreakdownItems.length
    }
  );

  // ------------------------------------------------------------------
  // 4. ALL OUTPUT CHANNELS PRESERVE CHRONOLOGICAL ORDER & DUPLICATE PROPERTY STAYS
  // ------------------------------------------------------------------
  console.log('\n--- 4. Output Consistency (Presentation, PDF, Email, WhatsApp, Sanitizer) ---');

  const model = buildQuotePresentationModel(quote);
  assert(
    model.hotels.length === 4,
    'PresentationModel.hotels lists all 4 active stays (including Park Hyatt Tokyo twice)',
    model.hotels.map(h => `${h.cityHub}: ${h.hotelName} (${h.checkInDate}->${h.checkOutDate})`)
  );
  assert(
    model.hotels[0]?.hotelName === 'Park Hyatt Tokyo' &&
      model.hotels[0]?.checkInDate.includes('Oct 1') &&
      model.hotels[1]?.hotelName === 'Conrad Osaka' &&
      model.hotels[2]?.hotelName === 'Park Hyatt Tokyo' &&
      model.hotels[2]?.checkInDate.includes('Oct 7') &&
      model.hotels[2]?.roomsCount === 2 &&
      model.hotels[3]?.hotelName === 'The St. Regis Osaka',
    'PresentationModel.hotels preserves exact chronological order, dates & room counts',
    model.hotels.map(h => ({ name: h.hotelName, in: h.checkInDate, rooms: h.roomsCount }))
  );
  assert(
    model.accommodations.length === 6 &&
      model.accommodations[2]?.isNoAccommodation === true &&
      model.accommodations[5]?.isNoAccommodation === true,
    'PresentationModel.accommodations preserves all 6 itinerary stops with Kyoto & Tokyo-3 marked NO_ACCOMMODATION'
  );

  // PDF Pagination
  const pdfPages = paginateQuotePresentationModel(model);
  const pdfHtmlJoined = pdfPages.flatMap(p => p.blocks).map(b => b.html).join('\n');
  const parkHyattCountInPdf = (pdfHtmlJoined.match(/Park Hyatt Tokyo/g) || []).length;
  assert(
    pdfPages.length >= 2 && parkHyattCountInPdf >= 2,
    `PDF Pagination renders all pages (${pdfPages.length}) with both Park Hyatt Tokyo stays (${parkHyattCountInPdf} occurrences)`
  );

  // Email HTML
  const emailHtml = renderProposalViewHtmlEmail(model);
  const simpleEmailResult = renderSimpleSemanticQuotationEmailFromModel(model);
  assert(
    (emailHtml.match(/Park Hyatt Tokyo/g) || []).length >= 2 &&
      emailHtml.includes('Conrad Osaka') &&
      emailHtml.includes('The St. Regis Osaka'),
    'Structured Email HTML includes both Tokyo stays, Conrad Osaka, and St. Regis Osaka'
  );
  assert(
    (simpleEmailResult.htmlBody.match(/Park Hyatt Tokyo/g) || []).length >= 2 &&
      simpleEmailResult.htmlBody.includes('Oct 7'),
    'Simple Semantic Email HTML includes both separate Tokyo hotel stays and dates'
  );

  // Communication Payload & WhatsApp
  const commPayload = buildQuoteCommunicationPayload(quote, { role: 'B2B_AGENT' });
  const waFromPayload = formatWhatsAppQuoteFromPayload(commPayload);
  const waFromModel = renderQuoteWhatsAppFromPresentationModel(model);
  const emailFromPayload = formatProposalEmailFromPayload(commPayload);

  assert(
    commPayload.hotels.length === 4 &&
      commPayload.hotels[0].checkInDate.includes('Oct 1') &&
      commPayload.hotels[2].checkInDate.includes('Oct 7'),
    'CommunicationPayload.hotels includes all 4 hotel stays with exact per-occurrence dates',
    commPayload.hotels.map(h => ({ name: h.hotelName, in: h.checkInDate }))
  );
  assert(
    (waFromPayload.match(/Park Hyatt Tokyo/g) || []).length >= 2 &&
      (waFromModel.match(/Park Hyatt Tokyo/g) || []).length >= 2 &&
      (emailFromPayload.htmlBody.match(/Park Hyatt Tokyo/g) || []).length >= 2,
    'WhatsApp (Payload + PresentationModel) and Payload Email preserve repeated Tokyo stays'
  );

  // Customer Sanitizer
  const sanitized = sanitizeQuoteForCustomer(quote);
  assert(
    sanitized.hotelsSummary.length === 4 &&
      sanitized.hotelsSummary.filter(s => s.includes('Park Hyatt Tokyo')).length === 2,
    'sanitizeQuoteForCustomer preserves all 4 active stays without collapsing repeated cities/hotels',
    sanitized.hotelsSummary
  );

  // ------------------------------------------------------------------
  // 5. REORDERING, DELETION & VERSION DIFF ISOLATION
  // ------------------------------------------------------------------
  console.log('\n--- 5. Reordering, Deletion & Version Control Isolation ---');

  // Explicit Save Draft v1
  const v1Result = await db.saveQuotationExplicitVersionAsync({
    quote,
    user: agentUser,
    clientSaveRequestId: `rephub-v1-${Date.now()}`,
    changesSummary: 'Initial 6-stop repeated hubs quotation'
  });
  assert(v1Result.versionNumber === 1, 'Saved v1 with 6 repeated hub occurrences');

  // Delete Stay 4 ONLY, keep Stay 1 and Stay 6 intact
  const hubsAfterDeleteStay4 = routeHubs
    .filter(h => h.id !== stay4.id)
    .map((h, idx) => ({ ...h, order: idx + 1 }));
  const itemsAfterDeleteStay4 = allItems.filter(
    it => !doesHotelItemBelongToHubOccurrence(it, stay4, routeHubs)
  );
  assert(
    hubsAfterDeleteStay4.length === 5 &&
      itemsAfterDeleteStay4.some(it => it.id === itemStay1.id) &&
      !itemsAfterDeleteStay4.some(it => it.id === itemStay4.id),
    'Deleting Stay 4 removes ONLY Stay 4 hotel item and preserves Stay 1 (same hub & same hotel)'
  );

  // Swap Stay 2 (Osaka) and Stay 3 (Kyoto) on v2 and save explicitly
  const reorderedHubs = routeHubs
    .map(h => {
      if (h.id === stay2.id) return { ...h, order: 3 };
      if (h.id === stay3.id) return { ...h, order: 2 };
      return h;
    })
    .sort((a, b) => a.order - b.order);

  // Verify Stay 2 hotel item still matches Stay 2 after order changed from 2 -> 3
  const stay2AfterReorder = reorderedHubs.find(h => h.id === stay2.id)!;
  assert(
    doesHotelItemBelongToHubOccurrence(itemStay2, stay2AfterReorder, reorderedHubs),
    'Reordering Stay 2 (order 2 -> 3) preserves linkage with itemStay2 via itineraryHubOccurrenceId'
  );

  // Update Stay 4 hotel in v2 to Aman Tokyo and save v2
  const updatedStay4 = { ...stay4, hotelId: 'htl-aman-tokyo' };
  const hubsV2 = reorderedHubs.map(h => (h.id === stay4.id ? updatedStay4 : h));
  const v2Quote: Quotation = {
    ...v1Result.quote,
    routeHubs: hubsV2,
    items: allItems.map(it =>
      it.id === itemStay4.id
        ? { ...it, hotelId: 'htl-aman-tokyo', product: { ...it.product, id: 'htl-aman-tokyo', name: 'Aman Tokyo' } as any }
        : it
    )
  };
  const v2Result = await db.saveQuotationExplicitVersionAsync({
    quote: v2Quote,
    user: agentUser,
    clientSaveRequestId: `rephub-v2-${Date.now()}`,
    changesSummary: 'Swapped Stay 2/3 and changed Stay 4 hotel to Aman Tokyo'
  });
  const versions = db.getQuotationVersions(quote.id, agentUser);
  const v1Record = versions.find(v => v.versionNumber === 1)!;
  const v2Record = versions.find(v => v.versionNumber === 2)!;
  assert(
    versions.length === 2 && v2Result.versionNumber === 2 && Boolean(v1Record) && Boolean(v2Record),
    'Saved v2 explicitly with repeated hubs intact'
  );

  const diff = computeQuotationVersionDiff(v1Record, v2Record);
  assert(
    diff.hubDiffs.some(d => d.changeType === 'MODIFIED' && d.detail.includes('Sequence')) &&
      diff.hubDiffs.some(d => d.changeType === 'MODIFIED' && d.detail.includes('Hotel assignment changed')) &&
      diff.itemDiffs.length > 0,
    'computeQuotationVersionDiff detects hub reorder and hotel change on repeated Stay 4',
    { hubDiffs: diff.hubDiffs, itemDiffs: diff.itemDiffs }
  );

  // Restore v1 and confirm all 6 stops return intact
  const restored = db.restoreQuotationVersion(quote.id, 1, agentUser);
  assert(
    Boolean(restored) &&
      restored!.routeHubs?.length === 6 &&
      restored!.routeHubs[3].hotelId === 'htl-park-hyatt-tokyo',
    'Restoring v1 restores all 6 repeated hub occurrences with original hotel per occurrence'
  );

  console.log('\n================================================================');
  console.log(`  AUDIT SUMMARY: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
  console.log('================================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAudit().catch(err => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
