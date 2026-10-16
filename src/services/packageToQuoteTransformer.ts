import {
  B2BPackage,
  CityHub,
  CurrencyCode,
  Destination,
  Hotel,
  ManualHotelDetails,
  PackageItineraryDay,
  Product,
  QuotationScope,
  QuoteItem,
  TripRouteHub,
  User
} from '../types';
import { db } from './db';
import {
  calculateProductPrice,
  calculateProductPriceForAgent,
  resolveInventoryValidity
} from './pricingEngine';
import { canUserViewInternalCostBreakdown } from './permissionEngine';
import { sanitizeProductForAgent } from '../utils/customerQuoteSanitizer';
import {
  hotelToProduct,
  manualHotelToProduct
} from '../utils/hotelHelpers';
import { createQuoteItemContentSnapshot } from '../utils/b2bQuotationHelpers';
import { richTextToPlainText } from '../utils/richTextFormatter';

export interface TransformedPackageQuoteState {
  sourcePackageId: string;
  sourcePackageName: string;
  sourcePackageSlug: string;
  sourcePackageUpdatedAt: string;
  quoteTitle: string;
  destination: Destination;
  quotationScope: QuotationScope;
  tripType: string;
  travelStyle: string;
  startDate: string;
  endDate: string;
  tripNights: number;
  durationDays: number;
  routeHubs: TripRouteHub[];
  items: QuoteItem[];
  dayThemes: Record<number, string>;
  dayDescriptions: Record<number, string>;
  dayOverviews: Record<number, string>;
  dayNotes: Record<number, string>;
  inclusions: string[];
  exclusions: string[];
  highlights: string[];
  importantInformation: string;
  termsAndConditions: string;
  cancellationPolicy: string;
  agentNotes: string;
  currency: CurrencyCode;
}

/**
 * Strips raw HTML tags cleanly while preserving line breaks and bullet structure
 */
export function cleanPackageText(raw?: string | null): string {
  if (!raw) return '';
  return richTextToPlainText(String(raw)).trim();
}

/**
 * Normalizes a B2BPackage record from Firestore or local state so all fields
 * (`title`/`name`, `itinerary`, `hubIds`/`hubNames`, `routeSummary`, `isPublished`/`status`, etc.)
 * are consistent across CMS Admin, B2B Agent Portal, and Quote Builder.
 */
export function normalizePackageRecord(raw: any): B2BPackage {
  if (!raw || typeof raw !== 'object') {
    return raw as B2BPackage;
  }

  const title = String(raw.title || raw.name || 'Untitled Package').trim();
  const status = raw.status || (raw.isPublished ? 'PUBLISHED' : 'DRAFT');
  const isPublished = status === 'PUBLISHED' && raw.isPublished !== false;

  // Normalize itinerary days (support both `itinerary` and legacy `days`)
  const rawItinerary: any[] = Array.isArray(raw.itinerary) && raw.itinerary.length > 0
    ? raw.itinerary
    : Array.isArray(raw.days) && raw.days.length > 0
      ? raw.days
      : [];

  const normalizedItinerary: PackageItineraryDay[] = rawItinerary
    .map((day: any, idx: number) => {
      const dayNumber = Number(day.dayNumber || day.day || idx + 1);
      const productIds: string[] = Array.isArray(day.productIds)
        ? day.productIds.filter(Boolean)
        : Array.isArray(day.excursionIds)
          ? day.excursionIds.filter(Boolean)
          : Array.isArray(day.activities)
            ? day.activities
                .map((a: any) => (typeof a === 'string' ? a : a?.productId || a?.id))
                .filter(Boolean)
            : [];

      return {
        dayNumber,
        title: String(day.title || `Day ${dayNumber}`).trim(),
        hubId: day.hubId || undefined,
        hubName: day.hubName || day.city || undefined,
        destinationId: day.destinationId || raw.destinationId || undefined,
        destinationName: day.destinationName || raw.destinationName || undefined,
        description: String(day.description || day.summary || '').trim(),
        operationalNotes: day.operationalNotes || day.notes || undefined,
        hotelId: day.hotelId || undefined,
        hotelName: day.hotelName || day.accommodation || undefined,
        roomTypeId: day.roomTypeId || undefined,
        mealPlan: day.mealPlan || undefined,
        mealsIncluded: day.mealsIncluded || {
          breakfast: Boolean(day.mealPlan?.toLowerCase().includes('breakfast') || day.meals?.includes('Breakfast')),
          lunch: Boolean(day.mealPlan?.toLowerCase().includes('lunch') || day.meals?.includes('Lunch')),
          dinner: Boolean(day.mealPlan?.toLowerCase().includes('dinner') || day.meals?.includes('Dinner'))
        },
        productIds,
        transferId: day.transferId || undefined,
        railId: day.railId || undefined,
        guideIncluded: Boolean(day.guideIncluded),
        freeTime: Boolean(day.freeTime),
        notes: day.notes || day.operationalNotes || undefined
      };
    })
    .sort((a, b) => a.dayNumber - b.dayNumber);

  const durationDays = Math.max(
    1,
    Number(raw.durationDays) || normalizedItinerary.length || (Number(raw.durationNights) ? Number(raw.durationNights) + 1 : 5)
  );
  const durationNights = Math.max(
    0,
    Number(raw.durationNights) !== undefined && !Number.isNaN(Number(raw.durationNights)) && Number(raw.durationNights) > 0
      ? Number(raw.durationNights)
      : Math.max(1, durationDays - 1)
  );

  // Preserve ONLY the hubs actually selected/configured on the package in their saved order
  const hubIds: string[] = Array.isArray(raw.hubIds)
    ? raw.hubIds.filter(Boolean)
    : [];

  const hubNames: string[] = Array.isArray(raw.hubNames) && raw.hubNames.length > 0
    ? raw.hubNames.filter(Boolean)
    : [];

  // Derive routeSummary if missing, using only configured hubs
  let routeSummary: string[] = Array.isArray(raw.routeSummary)
    ? raw.routeSummary.filter(Boolean)
    : [];

  if (routeSummary.length === 0 && hubIds.length > 0) {
    const destHubs = raw.destinationId ? db.getCityHubsByDestination(raw.destinationId) : [];
    routeSummary = hubIds.map((hid, idx) => {
      const matched = destHubs.find(h => h.id === hid || (h.name || '').toLowerCase() === String(hid).toLowerCase());
      const hName = hubNames[idx] || matched?.name || hid;
      const dayMatches = normalizedItinerary.filter(
        d => d.hubId === hid || (d.hubName && d.hubName.toLowerCase() === hName.toLowerCase())
      );
      const nights = dayMatches.length > 0
        ? Math.max(1, Math.min(durationNights, dayMatches.length === durationDays ? durationNights : dayMatches.length))
        : Math.max(1, Math.floor(durationNights / Math.max(1, hubIds.length)));
      return `${hName} (${nights}N)`;
    });
  }

  // Collect all unique productIds across top-level and itinerary days
  const allProductIds = new Set<string>(Array.isArray(raw.productIds) ? raw.productIds.filter(Boolean) : []);
  normalizedItinerary.forEach(d => {
    (d.productIds || []).forEach(pid => allProductIds.add(pid));
    if (d.transferId) allProductIds.add(d.transferId);
    if (d.railId) allProductIds.add(d.railId);
  });

  return {
    ...raw,
    id: raw.id || raw.package_id,
    package_id: raw.package_id || raw.id,
    title,
    name: title,
    slug: raw.slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
    destinationId: raw.destinationId || 'dest-japan',
    destinationName: raw.destinationName || 'Japan',
    hubIds,
    hubNames,
    durationDays,
    durationNights,
    heroImage: raw.heroImage || (Array.isArray(raw.galleryImages) && raw.galleryImages[0]) || (Array.isArray(raw.images) && raw.images[0]) || '',
    galleryImages: Array.isArray(raw.galleryImages)
      ? raw.galleryImages.filter(Boolean)
      : Array.isArray(raw.images)
        ? raw.images.filter(Boolean)
        : [],
    tagline: raw.tagline || '',
    description: raw.description || raw.detailedDescription || '',
    detailedDescription: raw.detailedDescription || raw.description || '',
    isLandOnly: Boolean(raw.isLandOnly),
    manualHotels: Array.isArray(raw.manualHotels) ? raw.manualHotels : [],
    routeSummary,
    hotelsSummary: Array.isArray(raw.hotelsSummary) ? raw.hotelsSummary : [],
    productIds: Array.from(allProductIds),
    productReferences: Array.isArray(raw.productReferences) ? raw.productReferences : [],
    hotelReferences: Array.isArray(raw.hotelReferences) ? raw.hotelReferences : [],
    itinerary: normalizedItinerary,
    days: normalizedItinerary,
    highlights: Array.isArray(raw.highlights) ? raw.highlights.filter(Boolean) : [],
    inclusions: Array.isArray(raw.inclusions) ? raw.inclusions.filter(Boolean) : [],
    exclusions: Array.isArray(raw.exclusions) ? raw.exclusions.filter(Boolean) : [],
    termsAndConditions: raw.termsAndConditions || '',
    cancellationPolicy: raw.cancellationPolicy || '',
    importantInformation: raw.importantInformation || '',
    baseNetCostUSD: Number(raw.baseNetCostUSD ?? raw.pricingConfiguration?.baseNetCostUSD ?? 0),
    suggestedSellingPriceUSD: Number(
      raw.suggestedSellingPriceUSD ??
      raw.finalSellingPriceUSD ??
      raw.pricingConfiguration?.finalSellingPriceUSD ??
      raw.pricingConfiguration?.suggestedSellingPriceUSD ??
      0
    ),
    finalSellingPriceUSD: Number(
      raw.finalSellingPriceUSD ??
      raw.pricingConfiguration?.finalSellingPriceUSD ??
      raw.suggestedSellingPriceUSD ??
      raw.pricingConfiguration?.suggestedSellingPriceUSD ??
      0
    ),
    currency: (raw.currency || raw.pricingConfiguration?.currency || 'USD') as CurrencyCode,
    tripType: raw.tripType || 'CULTURAL',
    tags: Array.isArray(raw.tags) ? raw.tags.filter(Boolean) : [],
    status,
    isPublished,
    isFeatured: Boolean(raw.isFeatured ?? raw.visibility?.featured),
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || new Date().toISOString()
  };
}

/**
 * Determines whether a package is eligible to be displayed in the B2B Agent Portal.
 * Excludes deleted, archived, or draft/unpublished packages.
 */
export function isPackageVisibleToB2BAgent(pkg: B2BPackage | null | undefined): boolean {
  if (!pkg) return false;
  if ((pkg as any).isDeleted === true) return false;
  const statusUpper = String(pkg.status || '').toUpperCase();
  if (
    statusUpper === 'ARCHIVED' ||
    statusUpper === 'DRAFT' ||
    statusUpper === 'UNPUBLISHED' ||
    statusUpper === 'INACTIVE' ||
    statusUpper === 'DELETED'
  ) {
    return false;
  }
  if (pkg.isPublished === false && statusUpper !== 'PUBLISHED' && statusUpper !== 'ACTIVE') {
    return false;
  }
  if (
    pkg.visibility &&
    pkg.visibility.search === false &&
    pkg.visibility.destinationPage === false &&
    pkg.visibility.homepage === false
  ) {
    return false;
  }
  return true;
}

/**
 * Resolves the ordered list of selected hubs for a package without ever adding unconfigured destination hubs.
 */
export function resolvePackageOrderedHubs(pkg: B2BPackage): Array<{ hubId: string; hubName: string; nights: number }> {
  const norm = normalizePackageRecord(pkg);
  const destHubs: CityHub[] = norm.destinationId ? db.getCityHubsByDestination(norm.destinationId) : [];
  const totalNights = Math.max(1, norm.durationNights || Math.max(1, (norm.durationDays || 2) - 1));

  // 1. If routeHubs are explicitly saved on the package
  if (Array.isArray((norm as any).routeHubs) && (norm as any).routeHubs.length > 0) {
    const hubs = [...(norm as any).routeHubs]
      .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
      .map((rh: any) => ({
        hubId: rh.hubId || rh.id,
        hubName: rh.hubName || destHubs.find(h => h.id === (rh.hubId || rh.id))?.name || 'City Hub',
        nights: Math.max(1, Number(rh.nights) || 1)
      }));
    return balanceHubNightsToTotal(hubs, totalNights);
  }

  // 2. If hubIds are saved on the package, preserve their exact saved order
  if (Array.isArray(norm.hubIds) && norm.hubIds.length > 0) {
    const hubs = norm.hubIds.map((hid, idx) => {
      const matched = destHubs.find(
        h => h.id === hid || (h.name || '').toLowerCase() === String(hid).toLowerCase()
      );
      const explicitName = Array.isArray(norm.hubNames) && norm.hubNames[idx] ? norm.hubNames[idx] : undefined;
      const summaryEntry = (norm.routeSummary || [])[idx] || '';
      const nightsMatch = summaryEntry.match(/\((\d+)\s*N\)/i);
      const summaryName = summaryEntry.replace(/\s*\(\d+\s*N\)/i, '').trim();

      const hubName =
        explicitName ||
        matched?.name ||
        (summaryName && !summaryName.startsWith('hub-') ? summaryName : '') ||
        (norm.itinerary || []).find(d => d.hubId === hid && d.hubName)?.hubName ||
        norm.destinationName ||
        'City Hub';

      const daysForHub = (norm.itinerary || []).filter(
        d => d.hubId === hid || (d.hubName && d.hubName.toLowerCase() === hubName.toLowerCase())
      ).length;

      const parsedNights = nightsMatch
        ? parseInt(nightsMatch[1], 10)
        : daysForHub > 0
          ? (norm.hubIds!.length === 1 ? totalNights : Math.max(1, daysForHub))
          : Math.max(1, Math.floor(totalNights / norm.hubIds!.length));

      return {
        hubId: matched?.id || hid,
        hubName,
        nights: parsedNights
      };
    });

    return balanceHubNightsToTotal(hubs, totalNights);
  }

  // 3. Fallback: derive hubs in order of appearance from routeSummary or itinerary days
  if (Array.isArray(norm.routeSummary) && norm.routeSummary.length > 0) {
    const hubs = norm.routeSummary.map((entry, idx) => {
      const nightsMatch = entry.match(/\((\d+)\s*N\)/i);
      const cleanName = entry.replace(/\s*\(\d+\s*N\)/i, '').trim();
      const matched = destHubs.find(
        h => (h.name || '').toLowerCase() === cleanName.toLowerCase() || h.id === cleanName
      );
      return {
        hubId: matched?.id || `hub-${idx + 1}`,
        hubName: matched?.name || cleanName || norm.destinationName || 'City Hub',
        nights: nightsMatch ? Math.max(1, parseInt(nightsMatch[1], 10)) : Math.max(1, Math.floor(totalNights / norm.routeSummary.length))
      };
    });
    return balanceHubNightsToTotal(hubs, totalNights);
  }

  if (Array.isArray(norm.itinerary) && norm.itinerary.length > 0) {
    const orderedMap = new Map<string, { hubId: string; hubName: string; daysCount: number }>();
    norm.itinerary.forEach(day => {
      const hid = day.hubId || day.hubName || norm.destinationId;
      if (!hid) return;
      const matched = destHubs.find(
        h => h.id === hid || (h.name || '').toLowerCase() === String(day.hubName || hid).toLowerCase()
      );
      const key = matched?.id || String(hid);
      const hName = day.hubName || matched?.name || norm.destinationName || 'City Hub';
      const existing = orderedMap.get(key);
      if (existing) {
        existing.daysCount += 1;
      } else {
        orderedMap.set(key, { hubId: key, hubName: hName, daysCount: 1 });
      }
    });

    if (orderedMap.size > 0) {
      const list = Array.from(orderedMap.values()).map(item => ({
        hubId: item.hubId,
        hubName: item.hubName,
        nights: orderedMap.size === 1 ? totalNights : Math.max(1, item.daysCount)
      }));
      return balanceHubNightsToTotal(list, totalNights);
    }
  }

  // Final fallback: single hub for the destination
  const primaryHub = destHubs[0];
  return [
    {
      hubId: primaryHub?.id || `hub-${norm.destinationId || 'main'}`,
      hubName: primaryHub?.name || norm.destinationName || 'Main Hub',
      nights: totalNights
    }
  ];
}

function balanceHubNightsToTotal(
  hubs: Array<{ hubId: string; hubName: string; nights: number }>,
  targetTotalNights: number
): Array<{ hubId: string; hubName: string; nights: number }> {
  if (hubs.length === 0) return [];
  const safeTarget = Math.max(hubs.length, targetTotalNights);
  const result = hubs.map(h => ({ ...h, nights: Math.max(1, h.nights || 1) }));
  const currentSum = result.reduce((acc, h) => acc + h.nights, 0);

  if (currentSum === safeTarget) return result;

  if (currentSum < safeTarget) {
    result[result.length - 1].nights += safeTarget - currentSum;
  } else {
    let excess = currentSum - safeTarget;
    for (let i = result.length - 1; i >= 0 && excess > 0; i--) {
      const reducible = Math.max(0, result[i].nights - 1);
      if (reducible > 0) {
        const deduct = Math.min(reducible, excess);
        result[i].nights -= deduct;
        excess -= deduct;
      }
    }
  }
  return result;
}

/**
 * Authoritative Package-to-Quote transformation engine.
 * Converts a B2BPackage into a complete, ready-to-edit Quote Builder state
 * without mutating the master package record.
 */
export function transformPackageToQuoteState(
  rawPackage: B2BPackage,
  options?: {
    user?: User | null;
    currency?: CurrencyCode;
    startDate?: string;
    adultsCount?: number;
    childrenCount?: number;
    infantsCount?: number;
  }
): TransformedPackageQuoteState {
  const pkg = normalizePackageRecord(rawPackage);
  const user = options?.user || null;
  const canViewInternalCosts = canUserViewInternalCostBreakdown(user);
  const isAgent = !canViewInternalCosts;
  const pricingTier = user && user.role !== 'PUBLIC' ? 'B2B' : 'B2C';
  const targetCurrency: CurrencyCode =
    options?.currency || pkg.pricingConfiguration?.currency || pkg.currency || 'USD';

  const adults = Math.max(1, options?.adultsCount ?? 2);
  const children = Math.max(0, options?.childrenCount ?? 0);
  const infants = Math.max(0, options?.infantsCount ?? 0);

  // 1. Resolve Destination
  const allDestinations = db.getDestinations();
  const matchedDestination: Destination =
    allDestinations.find(
      d =>
        d.id === pkg.destinationId ||
        (d.name || '').toLowerCase() === (pkg.destinationName || '').toLowerCase()
    ) ||
    allDestinations[0] || {
      id: pkg.destinationId || 'dest-japan',
      name: pkg.destinationName || 'Japan',
      slug: 'japan',
      code: 'JP',
      region: 'JAPAN',
      country: pkg.destinationName || 'Japan',
      currency: 'JPY',
      description: pkg.description || '',
      heroImage: pkg.heroImage || '',
      highlights: [],
      popularCities: [],
      bestTimeToVisit: 'All Year',
      visaPolicySummary: ''
    };

  // 2. Compute Travel Duration & Dates
  // In Quote Builder, calendarDays has length `tripNights + 1`.
  const itineraryDaysCount = Array.isArray(pkg.itinerary) ? pkg.itinerary.length : 0;
  const durationDays = Math.max(
    1,
    itineraryDaysCount > 0 ? itineraryDaysCount : (pkg.durationDays || (pkg.durationNights ? pkg.durationNights + 1 : 5))
  );
  const tripNights = Math.max(
    1,
    itineraryDaysCount > 1
      ? itineraryDaysCount - 1
      : (pkg.durationNights || Math.max(1, durationDays - 1))
  );

  let startIso = options?.startDate || '';
  if (!startIso || Number.isNaN(new Date(startIso).getTime())) {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    startIso = d.toISOString().split('T')[0];
  }
  const endObj = new Date(startIso);
  endObj.setDate(endObj.getDate() + tripNights);
  const endIso = endObj.toISOString().split('T')[0];

  // Build calendar date strings for Day 1 .. Day (tripNights + 1)
  const dayDateStrings: Record<number, string> = {};
  for (let i = 0; i <= tripNights; i++) {
    const d = new Date(startIso);
    d.setDate(d.getDate() + i);
    dayDateStrings[i + 1] = d.toISOString().split('T')[0];
  }

  // 3. Quotation Scope
  const quotationScope: QuotationScope = pkg.isLandOnly ? 'LAND_ONLY' : 'HOTEL_LAND';

  // 4. Resolve Ordered Selected Route Hubs
  const orderedHubSpecs = resolvePackageOrderedHubs({
    ...pkg,
    durationDays,
    durationNights: tripNights
  });

  const allHotels: Hotel[] = db.getHotels();
  const allProducts: Product[] = db.getProducts();
  const quoteItems: QuoteItem[] = [];

  const calculatePriceForItem = (prod: Product, travelDate: string) => {
    const params = {
      productId: prod.id,
      pricingTier: pricingTier as any,
      adults,
      children,
      infants,
      travelDate,
      targetCurrency,
      selectedAddonIds: [],
      userRole: user?.role || 'B2B_AGENT',
      user
    };
    if (!canViewInternalCosts) {
      return calculateProductPriceForAgent(prod, params) as any;
    }
    return calculateProductPrice(prod, params);
  };

  const buildPricingSnapshot = (prod: Product, calc: any, serviceDate: string) => {
    const applied = calc?.appliedSurcharges || [];
    const validity = resolveInventoryValidity(prod);
    return {
      ...calc,
      inventoryId: prod.id,
      selectedServiceDate: serviceDate,
      basePriceSnapshot: calc?.baseSellingPriceBeforeSurcharges ?? calc?.finalTotalSellingPrice ?? 0,
      applicableSurchargeIds: applied.map((s: any) => s.surchargeId),
      appliedSurcharges: applied,
      surchargeTotal: calc?.surchargeTotal ?? 0,
      currency: targetCurrency,
      finalCalculatedPrice: calc?.finalTotalSellingPrice ?? calc?.sellingPriceFinal ?? 0,
      pricingRuleVersion: calc?.rateVersion || 'v2.1-validity-surcharge',
      pricingAuditReference: calc?.pricingRequestId || calc?.rateId || `AUD-${Date.now()}`,
      validitySnapshot: (validity.validFrom || validity.validTo) ? validity : undefined,
      capturedAt: new Date().toISOString()
    };
  };

  // Helper to create a priced QuoteItem using the central pricing engine
  const buildQuoteItem = (
    product: Product,
    itemOptions: {
      travelDate: string;
      serviceTime?: string;
      notes?: string;
      hubId?: string;
      hotelId?: string;
      roomTypeId?: string;
      mealPlanCode?: string;
      roomsCount?: number;
      nights?: number;
      checkInDate?: string;
      checkOutDate?: string;
      isManualHotel?: boolean;
      manualHotelDetails?: ManualHotelDetails;
      accommodationType?: any;
      dayNumber?: number;
    }
  ): QuoteItem => {
    const calculation = calculatePriceForItem(product, itemOptions.travelDate);
    const effectiveProduct = isAgent ? sanitizeProductForAgent(product) : product;

    const item: QuoteItem = {
      id: `item-pkg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      product: effectiveProduct,
      pax: { adults, children, infants },
      travelDate: itemOptions.travelDate,
      serviceTime: itemOptions.serviceTime,
      notes: itemOptions.notes,
      selectedAddonIds: [],
      calculation,
      hubId: itemOptions.hubId,
      hotelId: itemOptions.hotelId,
      roomTypeId: itemOptions.roomTypeId,
      mealPlanCode: itemOptions.mealPlanCode as any,
      roomsCount: itemOptions.roomsCount,
      nights: itemOptions.nights,
      checkInDate: itemOptions.checkInDate,
      checkOutDate: itemOptions.checkOutDate,
      isManualHotel: itemOptions.isManualHotel,
      manualHotelDetails: itemOptions.manualHotelDetails,
      accommodationType: itemOptions.accommodationType,
      source: 'PACKAGE',
      aiSuggested: false,
      master_product_id: effectiveProduct.id,
      service_id: effectiveProduct.id,
      category: effectiveProduct.category,
      pricing_snapshot: buildPricingSnapshot(
        effectiveProduct,
        calculation,
        itemOptions.travelDate
      ),
      currency_snapshot: targetCurrency,
      metadata: {
        sourcePackageId: pkg.id,
        sourcePackageName: pkg.title,
        dayNumber: itemOptions.dayNumber,
        master_product_id: effectiveProduct.id,
        service_id: effectiveProduct.id
      }
    };
    item.contentSnapshot = createQuoteItemContentSnapshot(effectiveProduct, item);
    return item;
  };

  // 5. Build RouteHubs and Map Configured Accommodations (Hotels)
  let runningNightOffset = 0;
  const routeHubs: TripRouteHub[] = orderedHubSpecs.map((spec, idx) => {
    const hubOrder = idx + 1;
    const checkInObj = new Date(startIso);
    checkInObj.setDate(checkInObj.getDate() + runningNightOffset);
    const checkInIso = checkInObj.toISOString().split('T')[0];

    const checkOutObj = new Date(checkInObj);
    checkOutObj.setDate(checkOutObj.getDate() + spec.nights);
    const checkOutIso = checkOutObj.toISOString().split('T')[0];

    const startDay = runningNightOffset + 1;
    const endDay = runningNightOffset + spec.nights;
    runningNightOffset += spec.nights;

    const hubRecordId = `rhub-pkg-${hubOrder}-${spec.hubId}`;

    if (pkg.isLandOnly) {
      return {
        id: hubRecordId,
        hubId: spec.hubId,
        hubName: spec.hubName,
        destinationId: matchedDestination.id,
        destinationName: matchedDestination.name,
        nights: spec.nights,
        order: hubOrder,
        checkInDate: checkInIso,
        checkOutDate: checkOutIso,
        accommodationType: 'NO_ACCOMMODATION',
        overriddenByLandOnly: true,
        notes: `Stay in ${spec.hubName} (Land-Only)`
      };
    }

    // Check if package has a configured hotel for this hub:
    const hotelRef = (pkg.hotelReferences || []).find(
      hr =>
        hr.hubId === spec.hubId ||
        (hr.hubName || '').toLowerCase() === spec.hubName.toLowerCase()
    ) || (pkg.hotelReferences || [])[idx];

    const manualHotelCfg = (pkg.manualHotels || []).find(
      mh =>
        mh.hubId === spec.hubId ||
        (mh.city || '').toLowerCase() === spec.hubName.toLowerCase()
    ) || (pkg.manualHotels || [])[idx];

    const summaryCfg = (pkg.hotelsSummary || []).find(
      hs => (hs.cityName || '').toLowerCase() === spec.hubName.toLowerCase() || hs.hotelId
    ) || (pkg.hotelsSummary || [])[idx];

    const rosterCfg = ((pkg as any).hotelRoster || []).find(
      (hr: any) =>
        hr.hubId === spec.hubId ||
        (hr.hubId || '').toLowerCase() === spec.hubName.toLowerCase()
    ) || ((pkg as any).hotelRoster || [])[idx];

    const dayWithHotel = (pkg.itinerary || []).find(
      d =>
        d.dayNumber >= startDay &&
        d.dayNumber <= endDay &&
        (d.hotelId || d.hotelName)
    );

    const candidateHotelId =
      hotelRef?.hotelId ||
      summaryCfg?.hotelId ||
      rosterCfg?.hotelId ||
      dayWithHotel?.hotelId;

    const candidateHotelName =
      hotelRef?.hotelName ||
      summaryCfg?.name ||
      rosterCfg?.hotelName ||
      dayWithHotel?.hotelName ||
      manualHotelCfg?.hotelName;

    const candidateRoomTypeId = hotelRef?.roomTypeId || dayWithHotel?.roomTypeId;
    const candidateRoomTypeName =
      hotelRef?.roomTypeName ||
      summaryCfg?.roomType ||
      rosterCfg?.roomCategory ||
      manualHotelCfg?.roomType;

    const candidateMealPlan =
      hotelRef?.mealPlanCode ||
      summaryCfg?.mealPlan ||
      dayWithHotel?.mealPlan ||
      manualHotelCfg?.mealPlan;

    // Try matching a Master Hotel from db.getHotels()
    let matchedMasterHotel: Hotel | undefined;
    if (candidateHotelId) {
      matchedMasterHotel = allHotels.find(h => h.id === candidateHotelId);
    }
    if (!matchedMasterHotel && candidateHotelName) {
      const nameLower = candidateHotelName.toLowerCase();
      matchedMasterHotel = allHotels.find(
        h =>
          (h.name || '').toLowerCase() === nameLower ||
          (h.name || '').toLowerCase().includes(nameLower) ||
          nameLower.includes((h.name || '').toLowerCase())
      );
    }

    if (matchedMasterHotel) {
      const selectedRoom =
        matchedMasterHotel.roomTypes?.find(
          r =>
            r.id === candidateRoomTypeId ||
            (candidateRoomTypeName && (r.roomName || '').toLowerCase() === candidateRoomTypeName.toLowerCase())
        ) || matchedMasterHotel.roomTypes?.[0];
      const selectedRate = selectedRoom?.rates?.[0];
      const safeRooms = Math.max(1, Math.ceil(adults / 2));

      const hotelProd = hotelToProduct(
        matchedMasterHotel,
        selectedRoom,
        selectedRate,
        spec.nights,
        safeRooms
      );

      if (hotelProd) {
        const hotelQuoteItem = buildQuoteItem(hotelProd, {
          travelDate: checkInIso,
          hubId: hubRecordId,
          hotelId: matchedMasterHotel.id,
          roomTypeId: selectedRoom?.id,
          mealPlanCode: candidateMealPlan || selectedRate?.mealPlan || 'BB',
          roomsCount: safeRooms,
          nights: spec.nights,
          checkInDate: checkInIso,
          checkOutDate: checkOutIso,
          isManualHotel: false,
          accommodationType: 'hotel',
          dayNumber: startDay,
          notes: `${matchedMasterHotel.name} • ${selectedRoom?.roomName || candidateRoomTypeName || 'Luxury Room'} • ${safeRooms} ${safeRooms > 1 ? 'Rooms' : 'Room'} • ${spec.nights} Nights in ${spec.hubName} [Check-in: ${checkInIso}, Check-out: ${checkOutIso}]`
        });
        quoteItems.push(hotelQuoteItem);

        return {
          id: hubRecordId,
          hubId: spec.hubId,
          hubName: spec.hubName,
          destinationId: matchedDestination.id,
          destinationName: matchedDestination.name,
          nights: spec.nights,
          order: hubOrder,
          checkInDate: checkInIso,
          checkOutDate: checkOutIso,
          hotelId: matchedMasterHotel.id,
          roomTypeId: selectedRoom?.id,
          mealPlanCode: (candidateMealPlan as any) || 'BB',
          roomsCount: safeRooms,
          isManualHotel: false,
          accommodationType: 'hotel',
          savedAccommodationSnapshot: {
            accommodationType: 'hotel',
            hotelId: matchedMasterHotel.id,
            roomTypeId: selectedRoom?.id,
            roomsCount: safeRooms,
            isManualHotel: false
          },
          notes: `Stay at ${matchedMasterHotel.name} in ${spec.hubName}`
        };
      }
    }

    // If a manual hotel was explicitly configured in the package
    if (manualHotelCfg && manualHotelCfg.hotelName) {
      const normalizedManual: ManualHotelDetails = {
        ...manualHotelCfg,
        hubId: hubRecordId,
        city: manualHotelCfg.city || spec.hubName,
        checkInDate: checkInIso,
        checkOutDate: checkOutIso,
        numberOfNights: spec.nights,
        numberOfRooms: manualHotelCfg.numberOfRooms || Math.max(1, Math.ceil(adults / 2))
      };
      const manualProd = manualHotelToProduct(normalizedManual, matchedDestination);
      const mealDesc = normalizedManual.mealPlanName || normalizedManual.mealPlan || 'BB';
      const manualItem = buildQuoteItem(manualProd, {
        travelDate: checkInIso,
        hubId: hubRecordId,
        hotelId: manualProd.id,
        roomTypeId: 'manual-room',
        roomsCount: normalizedManual.numberOfRooms,
        nights: spec.nights,
        checkInDate: checkInIso,
        checkOutDate: checkOutIso,
        isManualHotel: true,
        manualHotelDetails: normalizedManual,
        accommodationType: 'manual',
        dayNumber: startDay,
        notes: `${normalizedManual.hotelName} [Package Accommodation] • ${normalizedManual.roomType} • ${normalizedManual.numberOfRooms} Room(s) • ${spec.nights} Nights in ${spec.hubName} (${mealDesc})`
      });
      quoteItems.push(manualItem);

      return {
        id: hubRecordId,
        hubId: spec.hubId,
        hubName: spec.hubName,
        destinationId: matchedDestination.id,
        destinationName: matchedDestination.name,
        nights: spec.nights,
        order: hubOrder,
        checkInDate: checkInIso,
        checkOutDate: checkOutIso,
        hotelId: manualProd.id,
        roomTypeId: 'manual-room',
        roomsCount: normalizedManual.numberOfRooms,
        isManualHotel: true,
        accommodationType: 'manual',
        manualHotel: normalizedManual,
        savedAccommodationSnapshot: {
          accommodationType: 'manual',
          hotelId: manualProd.id,
          roomTypeId: 'manual-room',
          roomsCount: normalizedManual.numberOfRooms,
          isManualHotel: true,
          manualHotel: normalizedManual
        },
        notes: `Stay at ${normalizedManual.hotelName} in ${spec.hubName}`
      };
    }

    // No hotel configured for this hub — do NOT invent a fake hotel
    return {
      id: hubRecordId,
      hubId: spec.hubId,
      hubName: spec.hubName,
      destinationId: matchedDestination.id,
      destinationName: matchedDestination.name,
      nights: spec.nights,
      order: hubOrder,
      checkInDate: checkInIso,
      checkOutDate: checkOutIso,
      notes: `Stay in ${spec.hubName}`
    };
  });

  // 6. Map Day-Wise Itinerary (Titles, Descriptions, Notes, Meals, Activities, Transfers, Rail)
  const dayThemes: Record<number, string> = {};
  const dayDescriptions: Record<number, string> = {};
  const dayOverviews: Record<number, string> = {};
  const dayNotes: Record<number, string> = {};
  const scheduledProductIdsGlobal = new Set<string>();

  const sortedItinerary = [...(pkg.itinerary || [])].sort((a, b) => a.dayNumber - b.dayNumber);

  sortedItinerary.forEach((day, idx) => {
    const dayNum = day.dayNumber || idx + 1;
    const travelDate = dayDateStrings[dayNum] || dayDateStrings[Math.min(dayNum, tripNights + 1)] || startIso;

    // Find corresponding routeHub for this day
    const matchedHub =
      routeHubs.find(
        rh =>
          rh.hubId === day.hubId ||
          (day.hubName && rh.hubName.toLowerCase() === day.hubName.toLowerCase())
      ) || routeHubs[0];

    // Preserve Day Title
    if (day.title) {
      dayThemes[dayNum] = cleanPackageText(day.title);
    }

    // Preserve Day Description (both rich and plain)
    if (day.description) {
      dayDescriptions[dayNum] = day.description;
      dayOverviews[dayNum] = cleanPackageText(day.description);
    }

    // Preserve Operational Notes & Meals Included
    const mealTags: string[] = [];
    if (day.mealsIncluded?.breakfast) mealTags.push('Breakfast');
    if (day.mealsIncluded?.lunch) mealTags.push('Lunch');
    if (day.mealsIncluded?.dinner) mealTags.push('Dinner');
    if (mealTags.length === 0 && day.mealPlan) {
      mealTags.push(day.mealPlan);
    }

    const noteParts: string[] = [];
    if (mealTags.length > 0) {
      noteParts.push(`Meals Included: ${mealTags.join(', ')}`);
    }
    if (day.guideIncluded) {
      noteParts.push('Licensed Guide Included');
    }
    if (day.freeTime) {
      noteParts.push('Includes Leisure / Free Time');
    }
    if (day.operationalNotes || day.notes) {
      noteParts.push(cleanPackageText(day.operationalNotes || day.notes));
    }
    if (noteParts.length > 0) {
      dayNotes[dayNum] = noteParts.join(' • ');
    }

    // Collect all product IDs configured for this specific day (deduplicated within the day)
    const dayProdIds = new Set<string>();
    if (Array.isArray(day.productIds)) {
      day.productIds.forEach(pid => {
        if (pid) dayProdIds.add(pid);
      });
    }
    if (day.transferId) {
      dayProdIds.add(day.transferId);
    }
    if (day.railId) {
      dayProdIds.add(day.railId);
    }

    // Schedule each configured product on this day
    let timeSlotIndex = 0;
    const defaultTimes = ['09:00 AM', '01:30 PM', '06:00 PM', '08:00 PM'];

    dayProdIds.forEach(pid => {
      const masterProduct = allProducts.find(p => p.id === pid || p.product_id === pid || p.sku === pid);
      if (!masterProduct) return;

      scheduledProductIdsGlobal.add(masterProduct.id);
      scheduledProductIdsGlobal.add(pid);

      const serviceTime = defaultTimes[timeSlotIndex % defaultTimes.length];
      timeSlotIndex++;

      const itemNoteParts: string[] = [`Day ${dayNum}: ${cleanPackageText(day.title || masterProduct.name)}`];
      if (day.operationalNotes || day.notes) {
        itemNoteParts.push(cleanPackageText(day.operationalNotes || day.notes));
      }

      const quoteItem = buildQuoteItem(masterProduct, {
        travelDate,
        serviceTime,
        hubId: matchedHub?.id,
        dayNumber: dayNum,
        notes: itemNoteParts.join(' • ')
      });

      quoteItems.push(quoteItem);
    });
  });

  // 7. Handle any top-level `pkg.productIds` that were not already assigned to a specific day in `pkg.itinerary`
  const unscheduledProductIds = (pkg.productIds || []).filter(
    pid => pid && !scheduledProductIdsGlobal.has(pid)
  );

  unscheduledProductIds.forEach((pid, idx) => {
    const masterProduct = allProducts.find(p => p.id === pid || p.product_id === pid || p.sku === pid);
    if (!masterProduct) return;

    scheduledProductIdsGlobal.add(masterProduct.id);

    const targetDayNum =
      sortedItinerary.length === 0
        ? (idx % Math.max(1, durationDays)) + 1
        : 1;
    const travelDate = dayDateStrings[targetDayNum] || startIso;
    const matchedHub = routeHubs[0];

    const quoteItem = buildQuoteItem(masterProduct, {
      travelDate,
      serviceTime: '09:30 AM',
      hubId: matchedHub?.id,
      dayNumber: targetDayNum,
      notes: `Included in Package: ${pkg.title}`
    });
    quoteItems.push(quoteItem);
  });

  // 8. Build Consolidated Agent Notes / Executive Summary from Package Metadata
  const summaryLines: string[] = [];
  if (pkg.tagline) {
    summaryLines.push(cleanPackageText(pkg.tagline));
  }
  if (pkg.description) {
    summaryLines.push(cleanPackageText(pkg.description));
  }
  if (pkg.importantInformation) {
    summaryLines.push(`Important Information: ${cleanPackageText(pkg.importantInformation)}`);
  }

  return {
    sourcePackageId: pkg.id,
    sourcePackageName: pkg.title,
    sourcePackageSlug: pkg.slug,
    sourcePackageUpdatedAt: pkg.updatedAt,
    quoteTitle: pkg.title,
    destination: matchedDestination,
    quotationScope,
    tripType: pkg.tripType || 'CULTURAL',
    travelStyle: pkg.tripType ? `${pkg.tripType.charAt(0)}${pkg.tripType.slice(1).toLowerCase()} Curated` : 'Luxury Curated',
    startDate: startIso,
    endDate: endIso,
    tripNights,
    durationDays,
    routeHubs,
    items: quoteItems,
    dayThemes,
    dayDescriptions,
    dayOverviews,
    dayNotes,
    inclusions: [...(pkg.inclusions || [])],
    exclusions: [...(pkg.exclusions || [])],
    highlights: [...(pkg.highlights || [])],
    importantInformation: cleanPackageText(pkg.importantInformation),
    termsAndConditions: cleanPackageText(pkg.termsAndConditions) || 'All wholesale rates are confidential and valid for licensed travel partners.',
    cancellationPolicy: cleanPackageText(pkg.cancellationPolicy),
    agentNotes: summaryLines.join('\n\n'),
    currency: targetCurrency
  };
}
