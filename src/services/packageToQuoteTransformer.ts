import {
  B2BPackage,
  CityHub,
  CurrencyCode,
  Destination,
  Hotel,
  ManualHotelDetails,
  PackageHotelRef,
  PackageItineraryDay,
  PackageProductRef,
  PackageStatus,
  Product,
  QuotationScope,
  QuoteItem,
  TripRouteHub,
  User
} from '../types';
import { db } from './db';
import {
  buildPackageCalculationDiagnostics,
  calculatePackagePrice,
  calculateProductPrice,
  calculateProductPriceForAgent,
  convertCurrency,
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
import { COMMERCIAL_QUOTATION_TERMS_PLAIN_TEXT } from '../constants/commercialQuotationTerms';

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
    routeHubs: Array.isArray(raw.routeHubs) ? raw.routeHubs : [],
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
  // Always resolve the authoritative unsanitized master package from db so manual hotel rates and routeHubs are intact during pricing calculation
  const masterPkg = rawPackage?.id ? db.getPackageById(rawPackage.id) : null;
  const effectiveRawPkg = masterPkg
    ? {
        ...masterPkg,
        ...rawPackage,
        routeHubs: masterPkg.routeHubs || rawPackage.routeHubs,
        manualHotels: masterPkg.manualHotels || rawPackage.manualHotels,
        hotelReferences: masterPkg.hotelReferences || rawPackage.hotelReferences,
        hotelsSummary: masterPkg.hotelsSummary || rawPackage.hotelsSummary,
        itinerary: masterPkg.itinerary || rawPackage.itinerary
      }
    : rawPackage;
  const pkg = normalizePackageRecord(effectiveRawPkg);
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
    allDestinations[0] || ({
      id: pkg.destinationId || 'dest-japan',
      name: pkg.destinationName || 'Japan',
      slug: 'japan',
      country: pkg.destinationName || 'Japan',
      region: 'JAPAN',
      currency: 'JPY',
      tagline: 'Land of the Rising Sun',
      description: pkg.description || '',
      heroImage: pkg.heroImage || '',
      highlights: [],
      cities: [],
      keySellingPoints: [],
      bestTimeToVisit: 'All Year',
      idealTripDuration: '7-14 Days',
      travelStyle: 'Cultural & Modern',
      featuredProductIds: [],
      status: 'ACTIVE'
    } as Destination);

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

    // Check if package has a configured hotel for this hub (checking routeHubs first, then hotelReferences, manualHotels, hotelsSummary, hotelRoster, itinerary):
    const pkgRouteHub = (pkg.routeHubs || []).find(
      rh =>
        rh.hubId === spec.hubId ||
        rh.id === spec.hubId ||
        (rh.hubName || '').toLowerCase() === spec.hubName.toLowerCase()
    ) || (pkg.routeHubs || [])[idx];

    if (
      pkgRouteHub &&
      (pkgRouteHub.accommodationType === 'NO_ACCOMMODATION' || pkgRouteHub.accommodationType === 'none')
    ) {
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
        notes: `Stay in ${spec.hubName} (No Accommodation Included)`
      };
    }

    const hotelRef = (pkg.hotelReferences || []).find(
      hr =>
        hr.hubId === spec.hubId ||
        (hr.hubName || '').toLowerCase() === spec.hubName.toLowerCase()
    ) || (pkg.hotelReferences || [])[idx];

    const manualHotelCfg =
      ((pkgRouteHub?.accommodationType === 'MANUAL' ||
        pkgRouteHub?.accommodationType === 'manual' ||
        pkgRouteHub?.isManualHotel) &&
      pkgRouteHub?.manualHotel
        ? pkgRouteHub.manualHotel
        : undefined) ||
      (pkg.manualHotels || []).find(
        mh =>
          mh.hubId === spec.hubId ||
          (mh.city || '').toLowerCase() === spec.hubName.toLowerCase()
      ) ||
      (pkg.manualHotels || [])[idx];

    const summaryCfg = (pkg.hotelsSummary || []).find(
      hs => (hs.cityName || '').toLowerCase() === spec.hubName.toLowerCase()
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
      (pkgRouteHub?.accommodationType !== 'MANUAL' &&
      pkgRouteHub?.accommodationType !== 'manual' &&
      !pkgRouteHub?.isManualHotel
        ? pkgRouteHub?.hotelId
        : undefined) ||
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

    const candidateRoomTypeId =
      pkgRouteHub?.roomTypeId ||
      hotelRef?.roomTypeId ||
      dayWithHotel?.roomTypeId;
    const candidateRoomTypeName =
      hotelRef?.roomTypeName ||
      summaryCfg?.roomType ||
      rosterCfg?.roomCategory ||
      manualHotelCfg?.roomType;

    const candidateMealPlan =
      pkgRouteHub?.mealPlanCode ||
      (pkgRouteHub as any)?.mealPlan ||
      hotelRef?.mealPlanCode ||
      summaryCfg?.mealPlan ||
      dayWithHotel?.mealPlan ||
      manualHotelCfg?.mealPlan;

    // Try matching a Master Hotel from db.getHotels()
    let matchedMasterHotel: Hotel | undefined;
    if (candidateHotelId) {
      matchedMasterHotel = allHotels.find(
        h => h.id === candidateHotelId || (h.name || '').toLowerCase() === String(candidateHotelId).toLowerCase()
      );
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
      const safeRooms = Math.max(1, Number(pkgRouteHub?.roomsCount || hotelRef?.roomsCount) || Math.ceil(adults / 2));

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

      const matchedProdRef = (pkg.productReferences || []).find(
        pr => pr.dayNumber === dayNum && (pr.productId === masterProduct.id || pr.productId === pid)
      );

      const itemNoteParts: string[] = [];
      if (matchedProdRef?.notes) {
        itemNoteParts.push(cleanPackageText(matchedProdRef.notes));
      } else {
        itemNoteParts.push(`Day ${dayNum}: ${cleanPackageText(day.title || masterProduct.name)}`);
        if (day.operationalNotes || day.notes) {
          itemNoteParts.push(cleanPackageText(day.operationalNotes || day.notes));
        }
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

  // 9. Calculation-Level Diagnostics (Admin / Dev only — never exposed to B2B Agents)
  if (canViewInternalCosts) {
    buildPackageCalculationDiagnostics(pkg.id, pkg.title, quoteItems, targetCurrency, user);
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
    termsAndConditions: COMMERCIAL_QUOTATION_TERMS_PLAIN_TEXT,
    cancellationPolicy: cleanPackageText(pkg.cancellationPolicy),
    agentNotes: summaryLines.join('\n\n'),
    currency: targetCurrency
  };
}

// ============================================================================
// AUTHORITATIVE QUOTATION -> MASTER READY-MADE PACKAGE SYNCHRONIZATION ENGINE
// ============================================================================

export interface QuoteWorkspaceToPackageInput {
  title: string;
  tagline?: string;
  description?: string;
  itineraryOverview?: string;
  tripType?: string;
  status?: PackageStatus;
  featured?: boolean;
  existingPackageId?: string | null;
  updateExisting?: boolean;
  destination?: Destination;
  currentDestination?: Destination;
  quotationScope: QuotationScope;
  routeHubs: TripRouteHub[];
  items: QuoteItem[];
  calendarDays: Array<{ dayNumber: number; dateString: string }>;
  daySlots?: Array<{
    dayNumber: number;
    dateString: string;
    hub?: TripRouteHub | null;
    hotelItems: QuoteItem[];
    productItems: QuoteItem[];
  }>;
  dayThemes?: Record<number, string>;
  dayDescriptions?: Record<number, string>;
  dayOverviews?: Record<number, string>;
  dayNotes?: Record<number, string>;
  inclusions?: string[];
  exclusions?: string[];
  highlights?: string[];
  importantInformation?: string;
  cancellationPolicy?: string;
  termsAndConditions?: string;
  currency: CurrencyCode;
  adultsCount?: number;
  childrenCount?: number;
  infantsCount?: number;
  user?: User | null;
}

export interface MasterPackageVerificationReport {
  packageId: string;
  packageSlug: string;
  isUpdate: boolean;
  durationDays: number;
  durationNights: number;
  itineraryDaysCount: number;
  referencedProductIds: string[];
  verifiedProductIds: string[];
  missingProductIds: string[];
  autoRegisteredProductsCount: number;
  hotelsCount: number;
  hubsCount: number;
  netPriceTarget: number;
  sellingPriceTarget: number;
  calculatedSellingPriceTarget: number;
  netPriceUSD: number;
  sellingPriceUSD: number;
  calculatedSellingPriceUSD: number;
  currency: CurrencyCode;
  retrievableById: boolean;
  visibleInReadyMadeCatalog: boolean;
  visibleToB2BAgent: boolean;
}

function isHotelQuoteItemHelper(it: QuoteItem): boolean {
  if (!it || !it.product) return false;
  return (
    it.product.productType === 'Hotel' ||
    it.product.productType === 'Hotel & Resort' ||
    it.isManualHotel === true ||
    it.product.accommodationType === 'manual' ||
    (it.product as any).category === 'Hotels'
  );
}

function isVisaQuoteItemHelper(it: QuoteItem): boolean {
  if (!it || !it.product) return false;
  return (
    it.product.productType === 'Visa Service' ||
    it.product.subcategory === 'Visa Facilitation' ||
    Boolean(it.product.sku?.startsWith('VSA-')) ||
    (it.product.category === 'Travel Services' && Boolean(it.product.name?.toLowerCase().includes('visa'))) ||
    Boolean(it.product.name?.toLowerCase().includes('visa') && it.product.name?.toLowerCase().includes('entry'))
  );
}

export function normalizeMasterPackageTripType(
  rawTripType?: string
): B2BPackage['tripType'] {
  const upper = String(rawTripType || '').toUpperCase().trim();
  if (upper.includes('LUXURY')) return 'LUXURY';
  if (upper.includes('HONEYMOON') || upper.includes('ROMAN')) return 'HONEYMOON';
  if (upper.includes('FAMILY')) return 'FAMILY';
  if (upper.includes('ADVENTURE') || upper.includes('NATURE')) return 'ADVENTURE';
  if (upper.includes('CLASSIC')) return 'CLASSIC';
  if (upper.includes('CULTUR') || upper.includes('BOUTIQUE') || upper.includes('HERITAGE')) return 'CULTURAL';
  return 'LUXURY';
}

/**
 * Builds a complete, schema-compliant B2BPackage from the Dispatch & Generation Action Hub
 * state, ensuring all itinerary days, products, hotels, routeHubs, media, inclusions, and
 * live Centralized Pricing Engine figures are populated.
 */
export function buildMasterPackageFromQuoteWorkspace(
  input: QuoteWorkspaceToPackageInput
): {
  pkg: B2BPackage;
  isUpdate: boolean;
  autoRegisteredProducts: Product[];
  livePricing: {
    netPriceTarget: number;
    sellingPriceTarget: number;
    netPriceUSD: number;
    sellingPriceUSD: number;
    currency: CurrencyCode;
  };
  validationErrors: string[];
} {
  const validationErrors: string[] = [];
  const cleanTitle = String(input.title || '').trim();
  if (!cleanTitle) {
    validationErrors.push('Package title is required.');
  }

  const dest = input.destination || input.currentDestination || db.getDestinations()[0] || {
    id: 'DST-JPN',
    name: 'Japan',
    slug: 'japan',
    code: 'JP',
    description: 'Japan',
    heroImage: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200',
    regions: ['East Asia'],
    regionId: 'REG-001',
    regionName: 'East Asia',
    active: true,
    currency: 'JPY',
    featured: true
  };
  if (!dest || !dest.id) {
    validationErrors.push('Valid destination is required.');
  }

  const baseSlug = cleanTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '') || `package-${Date.now()}`;

  // 1. Check for existing Master Package (for update & idempotency)
  const allPackages = db.getPackages();
  let existingPkg: B2BPackage | undefined;

  if (input.existingPackageId) {
    existingPkg = allPackages.find(
      p => p.id === input.existingPackageId || p.slug === input.existingPackageId
    );
  }

  if (!existingPkg && input.updateExisting !== false && cleanTitle) {
    existingPkg = allPackages.find(
      p =>
        p.destinationId === dest?.id &&
        (p.title.trim().toLowerCase() === cleanTitle.toLowerCase() || p.slug === baseSlug)
    );
  }

  const isUpdate = Boolean(existingPkg);
  const packageId = existingPkg?.id || `pkg-${Date.now()}`;
  const packageSlug = existingPkg?.slug && existingPkg.title.trim().toLowerCase() === cleanTitle.toLowerCase()
    ? existingPkg.slug
    : baseSlug;

  const isLandOnly = input.quotationScope === 'LAND_ONLY';
  const adults = Math.max(1, input.adultsCount || 2);
  const children = Math.max(0, input.childrenCount || 0);
  const infants = Math.max(0, input.infantsCount || 0);
  const targetCurrency: CurrencyCode = input.currency || 'USD';

  // 2. Ensure Referential Integrity for all non-hotel products in QuoteItems
  let allProducts = db.getProducts();
  const allHotels = db.getHotels();
  const destCityHubs = dest?.id
    ? db.getCityHubs().filter(h => h.destinationId === dest.id)
    : db.getCityHubs();
  const autoRegisteredProducts: Product[] = [];

  const resolveOrRegisterMasterProduct = (item: QuoteItem): Product | null => {
    if (!item || !item.product) return null;
    const candidateId = item.master_product_id || item.service_id || item.product.id;
    let found = allProducts.find(
      p =>
        p.id === candidateId ||
        p.product_id === candidateId ||
        p.id === item.product.id ||
        (item.product.sku && p.sku === item.product.sku) ||
        (item.product.name &&
          p.destinationId === dest.id &&
          (p.name || '').toLowerCase().trim() === (item.product.name || '').toLowerCase().trim())
    );

    if (!found && item.product.id && item.product.name) {
      // Auto-register ad-hoc QuoteBuilder product (e.g., suggested transfer or custom service) into Master Product Catalog
      const matchedHubForProd =
        destCityHubs.find(
          h =>
            h.id === item.product.hubId ||
            (item.product.city && (h.name || '').toLowerCase() === item.product.city.toLowerCase())
        ) || destCityHubs[0];

      const newProd: Product = {
        ...item.product,
        id: item.product.id,
        product_id: item.product.id,
        regionId: item.product.regionId || dest.regionId || 'reg-east-asia',
        regionName: item.product.regionName || dest.regionName || 'East Asia',
        destinationId: item.product.destinationId || dest.id,
        destinationName: item.product.destinationName || dest.name,
        hubId: item.product.hubId || matchedHubForProd?.id,
        country: item.product.country || dest.name,
        city: item.product.city || matchedHubForProd?.name || dest.name,
        adultNetPrice:
          Number(item.product.adultNetPrice) > 0
            ? Number(item.product.adultNetPrice)
            : Number(item.calculation?.totalNetCost || item.product.basePrice || 65),
        currency: item.product.currency || targetCurrency,
        status: 'ACTIVE'
      };
      try {
        db.saveProduct(newProd, input.user || null);
        allProducts = db.getProducts();
        found = allProducts.find(p => p.id === newProd.id) || newProd;
      } catch {
        found = newProd;
      }
      autoRegisteredProducts.push(found);
    }

    return found || null;
  };

  // 3. Resolve Ordered Route Hubs & Duration
  const rawRouteHubs = Array.isArray(input.routeHubs) && input.routeHubs.length > 0
    ? [...input.routeHubs].sort((a, b) => (a.order || 0) - (b.order || 0))
    : [];

  const totalHubNights = rawRouteHubs.reduce((sum, h) => sum + Math.max(1, Number(h.nights) || 1), 0);
  const calendarNights = input.calendarDays && input.calendarDays.length > 1
    ? input.calendarDays.length - 1
    : 0;
  const durationNights = Math.max(1, totalHubNights || calendarNights || existingPkg?.durationNights || 4);
  const durationDays = durationNights + 1;

  // Ensure at least one hub exists if rawRouteHubs was empty
  const effectiveSourceHubs: TripRouteHub[] = rawRouteHubs.length > 0
    ? rawRouteHubs
    : [
        {
          id: `rhub-pkg-1-${destCityHubs[0]?.id || dest.id}`,
          hubId: destCityHubs[0]?.id || `hub-${dest.id}`,
          hubName: destCityHubs[0]?.name || dest.name,
          destinationId: dest.id,
          destinationName: dest.name,
          nights: durationNights,
          order: 1,
          accommodationType: isLandOnly ? 'NO_ACCOMMODATION' : 'none',
          roomsCount: Math.max(1, Math.ceil(adults / 2))
        }
      ];

  const hotelQuoteItems = (input.items || []).filter(isHotelQuoteItemHelper);
  const serviceQuoteItems = (input.items || []).filter(
    it => !isHotelQuoteItemHelper(it) && !isVisaQuoteItemHelper(it)
  );

  // 4. Map Route Hubs, Hotel References, Manual Hotels, and Hotels Summary
  const hubIds: string[] = [];
  const hubNames: string[] = [];
  const routeSummary: string[] = [];
  const hotelsSummary: B2BPackage['hotelsSummary'] = [];
  const hotelReferences: PackageHotelRef[] = [];
  const manualHotels: ManualHotelDetails[] = [];
  const mappedRouteHubs: TripRouteHub[] = [];

  let runningNightOffset = 0;

  effectiveSourceHubs.forEach((rh, idx) => {
    const nights = Math.max(1, Number(rh.nights) || 1);
    const startDay = runningNightOffset + 1;
    const endDay = runningNightOffset + nights;
    runningNightOffset += nights;

    // Resolve canonical CityHub ID and Name
    const matchedCityHub = destCityHubs.find(
      ch =>
        ch.id === rh.hubId ||
        ch.id === rh.id ||
        (ch.name || '').toLowerCase() === (rh.hubName || '').toLowerCase()
    );
    const canonicalHubId = matchedCityHub?.id || rh.hubId || rh.id || `hub-${idx + 1}`;
    const canonicalHubName = matchedCityHub?.name || rh.hubName || dest.name;

    if (!hubIds.includes(canonicalHubId)) {
      hubIds.push(canonicalHubId);
      hubNames.push(canonicalHubName);
    }
    routeSummary.push(`${canonicalHubName} (${nights}N)`);

    // Find matching hotel item from quote if present
    const matchingHotelItem = hotelQuoteItems.find(
      hi =>
        hi.hubId === rh.id ||
        hi.hubId === rh.hubId ||
        hi.hubId === canonicalHubId ||
        (rh.hotelId && (hi.hotelId === rh.hotelId || hi.product?.id === rh.hotelId))
    );

    if (
      isLandOnly ||
      rh.accommodationType === 'NO_ACCOMMODATION' ||
      rh.accommodationType === 'none'
    ) {
      mappedRouteHubs.push({
        ...rh,
        id: rh.id || `rhub-${idx + 1}-${canonicalHubId}`,
        hubId: canonicalHubId,
        hubName: canonicalHubName,
        destinationId: dest.id,
        destinationName: dest.name,
        nights,
        order: idx + 1,
        accommodationType: 'NO_ACCOMMODATION'
      });
      return;
    }

    // Check Manual Hotel
    const isManual =
      rh.isManualHotel === true ||
      rh.accommodationType === 'MANUAL' ||
      rh.accommodationType === 'manual' ||
      matchingHotelItem?.isManualHotel === true;

    const rawManual = rh.manualHotel || matchingHotelItem?.manualHotelDetails;
    if (isManual && rawManual && rawManual.hotelName) {
      const safeRooms = Math.max(1, Number(rawManual.numberOfRooms || rh.roomsCount || matchingHotelItem?.roomsCount) || Math.ceil(adults / 2));
      const fallbackRatePerNight =
        Number(rawManual.ratePerNight) > 0
          ? Number(rawManual.ratePerNight)
          : Math.max(
              100,
              Math.round(
                Number(matchingHotelItem?.product?.adultNetPrice || matchingHotelItem?.calculation?.totalNetCost || 250) /
                  Math.max(1, nights * safeRooms)
              )
            );

      const manualCfg: ManualHotelDetails = {
        ...rawManual,
        hotelName: rawManual.hotelName.trim(),
        hubId: canonicalHubId,
        hubName: canonicalHubName,
        city: rawManual.city || canonicalHubName,
        roomType: rawManual.roomType || 'Deluxe Room',
        mealPlan: rawManual.mealPlan || 'BB',
        mealPlanName: rawManual.mealPlanName || 'Bed & Breakfast',
        numberOfNights: nights,
        numberOfRooms: safeRooms,
        ratePerNight: fallbackRatePerNight,
        rateCurrency: rawManual.rateCurrency || targetCurrency,
        rateBasis: rawManual.rateBasis || 'PER_ROOM_PER_NIGHT'
      };

      manualHotels.push(manualCfg);
      hotelsSummary.push({
        name: manualCfg.hotelName,
        cityName: canonicalHubName,
        nights,
        roomType: manualCfg.roomType,
        mealPlan: manualCfg.mealPlanName || manualCfg.mealPlan
      });

      mappedRouteHubs.push({
        ...rh,
        id: rh.id || `rhub-${idx + 1}-${canonicalHubId}`,
        hubId: canonicalHubId,
        hubName: canonicalHubName,
        destinationId: dest.id,
        destinationName: dest.name,
        nights,
        order: idx + 1,
        roomsCount: safeRooms,
        isManualHotel: true,
        accommodationType: 'MANUAL',
        manualHotel: manualCfg
      });
      return;
    }

    // Check Master Hotel
    const rawHotelId =
      rh.hotelId ||
      matchingHotelItem?.hotelId ||
      matchingHotelItem?.product?.id?.replace(/^hotel-/, '');

    let matchedHotel = rawHotelId
      ? allHotels.find(
          h =>
            h.id === rawHotelId ||
            `hotel-${h.id}` === rawHotelId ||
            (h.name || '').toLowerCase() === String(rawHotelId).toLowerCase()
        )
      : undefined;

    if (!matchedHotel && matchingHotelItem?.product?.name) {
      const cleanHName = matchingHotelItem.product.name.split('—')[0].split('•')[0].trim().toLowerCase();
      matchedHotel = allHotels.find(
        h =>
          (h.name || '').toLowerCase() === cleanHName ||
          (h.name || '').toLowerCase().includes(cleanHName)
      );
    }

    if (matchedHotel) {
      const targetRoomId = rh.roomTypeId || matchingHotelItem?.roomTypeId;
      const roomType =
        matchedHotel.roomTypes?.find(r => r.id === targetRoomId) ||
        matchedHotel.roomTypes?.[0];
      const mealPlanCode =
        rh.mealPlanCode ||
        (rh as any).mealPlan ||
        matchingHotelItem?.mealPlanCode ||
        roomType?.rates?.[0]?.mealPlan ||
        'BB';
      const safeRooms = Math.max(
        1,
        Number(rh.roomsCount || matchingHotelItem?.roomsCount) || Math.ceil(adults / 2)
      );
      const roomName = roomType?.roomName || (roomType as any)?.name || 'Deluxe Room';

      hotelReferences.push({
        hotelId: matchedHotel.id,
        hotelName: matchedHotel.name,
        cityName: canonicalHubName,
        hubId: canonicalHubId,
        hubName: canonicalHubName,
        roomTypeId: roomType?.id,
        roomTypeName: roomName,
        mealPlanCode: String(mealPlanCode),
        mealPlanName: String(mealPlanCode),
        nights,
        startDay,
        endDay
      });

      hotelsSummary.push({
        hotelId: matchedHotel.id,
        name: matchedHotel.name,
        cityName: canonicalHubName,
        nights,
        roomType: roomName,
        mealPlan: String(mealPlanCode)
      });

      mappedRouteHubs.push({
        ...rh,
        id: rh.id || `rhub-${idx + 1}-${canonicalHubId}`,
        hubId: canonicalHubId,
        hubName: canonicalHubName,
        destinationId: dest.id,
        destinationName: dest.name,
        nights,
        order: idx + 1,
        hotelId: matchedHotel.id,
        roomTypeId: roomType?.id,
        mealPlanCode: mealPlanCode as any,
        mealPlan: String(mealPlanCode),
        roomsCount: safeRooms,
        isManualHotel: false,
        accommodationType: 'HOTEL'
      });
      return;
    }

    // Hub with no hotel selected
    mappedRouteHubs.push({
      ...rh,
      id: rh.id || `rhub-${idx + 1}-${canonicalHubId}`,
      hubId: canonicalHubId,
      hubName: canonicalHubName,
      destinationId: dest.id,
      destinationName: dest.name,
      nights,
      order: idx + 1,
      accommodationType: isLandOnly ? 'NO_ACCOMMODATION' : 'none'
    });
  });

  // 5. Build Complete Day-Wise Itinerary & Product References
  const allProductIds: string[] = [];
  const productReferences: PackageProductRef[] = [];
  const itineraryDays: PackageItineraryDay[] = [];
  const assignedQuoteItemIds = new Set<string>();

  for (let dayNum = 1; dayNum <= durationDays; dayNum++) {
    const slot = (input.daySlots || []).find(s => s.dayNumber === dayNum);
    const calDay = (input.calendarDays || []).find(c => c.dayNumber === dayNum);

    // Resolve active hub for this day
    let hubForDay: TripRouteHub | undefined;
    let runningNights = 0;
    for (const h of mappedRouteHubs) {
      const hStart = runningNights + 1;
      const hEnd = runningNights + (h.nights || 1);
      if (dayNum >= hStart && dayNum <= hEnd) {
        hubForDay = h;
        break;
      }
      runningNights += h.nights || 1;
    }
    if (!hubForDay && mappedRouteHubs.length > 0) {
      hubForDay = mappedRouteHubs[mappedRouteHubs.length - 1];
    }

    const dayHubId = hubForDay?.hubId || slot?.hub?.hubId || slot?.hub?.id;
    const dayHubName = hubForDay?.hubName || slot?.hub?.hubName || dest.name;

    // Collect all non-hotel items for this day
    const dayItems: QuoteItem[] = [];
    const addCandidateItem = (it: QuoteItem) => {
      if (!it || assignedQuoteItemIds.has(it.id)) return;
      if (isHotelQuoteItemHelper(it) || isVisaQuoteItemHelper(it)) return;
      assignedQuoteItemIds.add(it.id);
      dayItems.push(it);
    };

    if (slot && Array.isArray(slot.productItems)) {
      slot.productItems.forEach(addCandidateItem);
    }

    serviceQuoteItems.forEach(it => {
      if (assignedQuoteItemIds.has(it.id)) return;
      if (it.metadata?.dayNumber === dayNum) {
        addCandidateItem(it);
      } else if (calDay && it.travelDate === calDay.dateString) {
        addCandidateItem(it);
      } else if (
        dayNum === 1 &&
        input.calendarDays?.[0]?.dateString &&
        it.travelDate < input.calendarDays[0].dateString
      ) {
        addCandidateItem(it);
      } else if (dayNum === durationDays) {
        const lastDateStr = input.calendarDays?.[input.calendarDays.length - 1]?.dateString;
        if (!lastDateStr || it.travelDate >= lastDateStr || !it.travelDate) {
          addCandidateItem(it);
        }
      }
    });

    const dayProductIds: string[] = [];
    const dayMasterProducts: Product[] = [];
    let dayTransferId: string | undefined;
    let dayRailId: string | undefined;

    dayItems.forEach(it => {
      const masterProd = resolveOrRegisterMasterProduct(it);
      if (!masterProd) return;

      if (!dayProductIds.includes(masterProd.id)) {
        dayProductIds.push(masterProd.id);
      }
      if (!allProductIds.includes(masterProd.id)) {
        allProductIds.push(masterProd.id);
      }
      dayMasterProducts.push(masterProd);

      const catLower = String(masterProd.category || '').toLowerCase();
      const typeLower = String(masterProd.productType || '').toLowerCase();
      if (catLower.includes('transfer') || typeLower.includes('transfer')) {
        if (!dayTransferId) dayTransferId = masterProd.id;
      } else if (catLower.includes('rail') || typeLower.includes('rail') || typeLower.includes('shinkansen')) {
        if (!dayRailId) dayRailId = masterProd.id;
      }

      productReferences.push({
        productId: masterProd.id,
        dayNumber: dayNum,
        productName: masterProd.name,
        category: masterProd.category,
        productType: masterProd.productType,
        hubId: dayHubId,
        hubName: dayHubName,
        notes: it.notes || undefined
      });
    });

    // Resolve hotel reference for this day
    const hotelRefForDay = !isLandOnly
      ? hotelReferences.find(hr => dayNum >= hr.startDay && dayNum <= hr.endDay)
      : undefined;
    const manualHotelForDay =
      !isLandOnly && !hotelRefForDay && hubForDay?.isManualHotel ? hubForDay.manualHotel : undefined;

    // Resolve Day Title
    const customDayTheme = cleanPackageText(input.dayThemes?.[dayNum]);
    const defaultDayTitle =
      dayMasterProducts.length > 0
        ? `Day ${dayNum}: ${dayHubName} — ${dayMasterProducts.map(p => p.name).slice(0, 2).join(' & ')}`
        : dayNum === 1
          ? `Day 1: Arrival in ${dayHubName}`
          : dayNum === durationDays
            ? `Day ${durationDays}: ${dayHubName} & Departure`
            : `Day ${dayNum}: Exploring ${dayHubName}`;
    const dayTitle = customDayTheme || defaultDayTitle;

    // Resolve Day Description
    const customDayDesc =
      (input.dayDescriptions?.[dayNum] && input.dayDescriptions[dayNum].trim()) ||
      (input.dayOverviews?.[dayNum] && input.dayOverviews[dayNum].trim());
    const derivedProductDesc =
      dayMasterProducts.length > 0
        ? dayMasterProducts
            .map(p => cleanPackageText(p.shortDescription || p.longDescription || p.name))
            .filter(Boolean)
            .join(' ')
        : '';
    const dayDescription =
      customDayDesc ||
      derivedProductDesc ||
      `Scheduled curated experiences, sightseeing, and ground services in ${dayHubName}.`;

    const dayOpNotes = cleanPackageText(input.dayNotes?.[dayNum]);
    const mealPlanStr = String(
      hotelRefForDay?.mealPlanCode || manualHotelForDay?.mealPlan || (isLandOnly ? 'RO' : 'BB')
    ).toUpperCase();
    const hasLunchProd = dayMasterProducts.some(p =>
      (p.name || '').toLowerCase().includes('lunch')
    );
    const hasDinnerProd = dayMasterProducts.some(p =>
      (p.name || '').toLowerCase().includes('dinner')
    );

    const mealsIncluded = {
      breakfast:
        mealPlanStr.includes('BB') ||
        mealPlanStr.includes('HB') ||
        mealPlanStr.includes('FB') ||
        mealPlanStr.includes('AI') ||
        mealPlanStr.includes('BREAKFAST') ||
        dayOpNotes.toLowerCase().includes('breakfast') ||
        (!isLandOnly && Boolean(hotelRefForDay || manualHotelForDay)),
      lunch:
        mealPlanStr.includes('FB') ||
        mealPlanStr.includes('AI') ||
        hasLunchProd ||
        dayOpNotes.toLowerCase().includes('lunch'),
      dinner:
        mealPlanStr.includes('HB') ||
        mealPlanStr.includes('FB') ||
        mealPlanStr.includes('AI') ||
        hasDinnerProd ||
        dayOpNotes.toLowerCase().includes('dinner')
    };

    const hasGuide = dayMasterProducts.some(
      p =>
        (p.name || '').toLowerCase().includes('guide') ||
        (p.name || '').toLowerCase().includes('private') ||
        (p.inclusions || []).some(inc => inc.toLowerCase().includes('guide'))
    );

    itineraryDays.push({
      dayNumber: dayNum,
      title: dayTitle,
      hubId: dayHubId,
      hubName: dayHubName,
      destinationId: dest.id,
      destinationName: dest.name,
      description: dayDescription,
      operationalNotes: dayOpNotes || undefined,
      notes: dayOpNotes || undefined,
      hotelId: hotelRefForDay?.hotelId,
      hotelName: hotelRefForDay?.hotelName || manualHotelForDay?.hotelName,
      roomTypeId: hotelRefForDay?.roomTypeId,
      mealPlan: hotelRefForDay?.mealPlanCode || manualHotelForDay?.mealPlan,
      mealsIncluded,
      productIds: dayProductIds,
      transferId: dayTransferId,
      railId: dayRailId,
      guideIncluded: hasGuide || true,
      freeTime: dayProductIds.length <= 1
    });
  }

  // 6. Media & Gallery Collection
  const mediaSet = new Set<string>();
  if (dest?.heroImage) mediaSet.add(dest.heroImage);
  if (existingPkg?.heroImage) mediaSet.add(existingPkg.heroImage);
  (existingPkg?.galleryImages || []).forEach(img => {
    if (img) mediaSet.add(img);
  });
  hotelReferences.forEach(hr => {
    const h = allHotels.find(ht => ht.id === hr.hotelId);
    if (h?.heroImage) mediaSet.add(h.heroImage);
  });
  allProductIds.forEach(pid => {
    const p = allProducts.find(pr => pr.id === pid);
    if (p?.heroImage) mediaSet.add(p.heroImage);
  });

  const galleryImages = Array.from(mediaSet).filter(Boolean).slice(0, 8);
  const heroImage =
    galleryImages[0] ||
    dest?.heroImage ||
    'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200';

  // 7. Inclusions, Exclusions, Highlights, Description & Policies
  const cleanTagline =
    String(input.tagline || '').trim() ||
    existingPkg?.tagline ||
    `Signature ${durationNights}-night curated circuit featuring ${hubNames.join(' → ') || dest.name}.`;

  const cleanOverview = cleanPackageText(input.itineraryOverview);
  const cleanDescription =
    String(input.description || '').trim() ||
    cleanOverview ||
    existingPkg?.description ||
    `Comprehensive ${durationDays}-day / ${durationNights}-night curated circuit across ${hubNames.join(', ') || dest.name} including ${allProductIds.length} master experiences${!isLandOnly && hotelsSummary.length > 0 ? ` and ${hotelsSummary.length} configured hotel stays` : ''}.`;

  const detailedDescription = cleanOverview || cleanDescription;

  const finalInclusions =
    Array.isArray(input.inclusions) && input.inclusions.filter(Boolean).length > 0
      ? input.inclusions.filter(Boolean)
      : [
          ...(!isLandOnly && hotelsSummary.length > 0
            ? [`${durationNights} Nights accommodation across ${hotelsSummary.map(h => `${h.name} (${h.cityName})`).join(', ')}`]
            : []),
          ...(allProductIds.length > 0
            ? [`${allProductIds.length} scheduled excursions, sightseeing tours, and ground transfers as per itinerary`]
            : [`Curated ground arrangements across ${hubNames.join(', ') || dest.name}`]),
          '24/7 on-ground DMC operations & concierge support'
        ];

  const finalExclusions =
    Array.isArray(input.exclusions) && input.exclusions.filter(Boolean).length > 0
      ? input.exclusions.filter(Boolean)
      : [
          'International airfare & visa processing fees unless specified',
          'Personal travel insurance, gratuities & incidental expenses'
        ];

  const finalHighlights =
    Array.isArray(input.highlights) && input.highlights.filter(Boolean).length > 0
      ? input.highlights.filter(Boolean)
      : [
          `${durationNights} Nights / ${durationDays} Days curated route: ${routeSummary.join(' → ')}`,
          ...(!isLandOnly && hotelsSummary.length > 0
            ? [`Handpicked stays: ${hotelsSummary.map(h => h.name).join(', ')}`]
            : []),
          ...allProductIds
            .slice(0, 3)
            .map(pid => allProducts.find(p => p.id === pid)?.name)
            .filter((n): n is string => Boolean(n)),
          'Direct 24/7 on-ground DMC concierge support'
        ];

  const normalizedTripType = normalizeMasterPackageTripType(input.tripType || existingPkg?.tripType);
  const status: PackageStatus = input.status || existingPkg?.status || 'PUBLISHED';
  const isPublished = status === 'PUBLISHED';
  const isFeatured = input.featured !== undefined ? Boolean(input.featured) : Boolean(existingPkg?.isFeatured ?? true);
  const timestamp = new Date().toISOString();

  // 8. Construct Draft Package & Run Authoritative Centralized Pricing Engine
  const draftPkg: B2BPackage = {
    ...(existingPkg || {}),
    id: packageId,
    package_id: packageId,
    title: cleanTitle,
    name: cleanTitle,
    slug: packageSlug,
    tagline: cleanTagline,
    description: cleanDescription,
    detailedDescription,
    regionId: dest.regionId || (dest as any).region || existingPkg?.regionId || 'asia',
    regionName: dest.regionName || (dest as any).region || existingPkg?.regionName || 'Asia',
    destinationId: dest.id,
    destinationName: dest.name,
    hubIds,
    hubNames,
    durationDays,
    durationNights,
    tripType: normalizedTripType,
    heroImage,
    galleryImages: galleryImages.length > 0 ? galleryImages : [heroImage],
    isLandOnly,
    routeSummary,
    routeHubs: mappedRouteHubs,
    hotelsSummary,
    hotelReferences,
    manualHotels,
    itinerary: itineraryDays,
    productIds: allProductIds,
    productReferences,
    highlights: finalHighlights,
    inclusions: finalInclusions,
    exclusions: finalExclusions,
    termsAndConditions: input.termsAndConditions || COMMERCIAL_QUOTATION_TERMS_PLAIN_TEXT,
    cancellationPolicy:
      input.cancellationPolicy ||
      existingPkg?.cancellationPolicy ||
      'Full refund up to 30 days prior to arrival. 50% cancellation fee between 15–29 days prior to arrival.',
    importantInformation:
      input.importantInformation ||
      existingPkg?.importantInformation ||
      'All arrangements are subject to availability at the time of booking confirmation.',
    customizationRules: existingPkg?.customizationRules || {
      allowHotelCustomization: true,
      allowActivityCustomization: true,
      allowTransferCustomization: true,
      allowDurationCustomization: true,
      allowMealCustomization: true
    },
    visibility: {
      destinationPage: true,
      hubPage: true,
      homepage: isFeatured,
      promotions: existingPkg?.visibility?.promotions ?? false,
      search: true,
      featured: isFeatured
    },
    tags: Array.from(
      new Set([
        ...(existingPkg?.tags || []),
        'Master Package',
        dest.name,
        ...hubNames
      ])
    ).filter(Boolean),
    status,
    isPublished,
    isFeatured,
    currency: targetCurrency,
    baseNetCostUSD: 0,
    suggestedSellingPriceUSD: 0,
    finalSellingPriceUSD: 0,
    createdAt: existingPkg?.createdAt || timestamp,
    updatedAt: timestamp
  };

  // Calculate live pricing strictly via Centralized Pricing Engine (no manual/fixed margin inheritance)
  const livePricingCalc = calculatePackagePrice({
    packageItem: draftPkg,
    userRole: 'ADMIN',
    pricingTier: 'B2B',
    targetCurrency,
    adults,
    children,
    infants,
    user: input.user || null
  });

  const netPriceTarget = livePricingCalc.internalAudit?.totalNetCostTarget || 0;
  const sellingPriceTarget = livePricingCalc.finalSellingPrice || 0;
  const netPriceUSD = Math.round(
    livePricingCalc.internalAudit?.totalNetCostUSD ||
      convertCurrency(netPriceTarget, targetCurrency, 'USD')
  );
  const sellingPriceUSD = Math.round(
    convertCurrency(sellingPriceTarget, targetCurrency, 'USD')
  );

  draftPkg.baseNetCostUSD = netPriceUSD;
  draftPkg.finalSellingPriceUSD = sellingPriceUSD;
  draftPkg.suggestedSellingPriceUSD = sellingPriceUSD;
  draftPkg.pricingConfiguration = {
    pricingMode: 'LIVE',
    baseNetCostUSD: netPriceUSD,
    finalSellingPriceUSD: sellingPriceUSD,
    suggestedSellingPriceUSD: sellingPriceUSD,
    currency: targetCurrency
  };

  if (draftPkg.itinerary && draftPkg.itinerary.length === 0) {
    validationErrors.push('Package itinerary must contain at least 1 day.');
  }

  return {
    pkg: draftPkg,
    isUpdate,
    autoRegisteredProducts,
    livePricing: {
      netPriceTarget,
      sellingPriceTarget,
      netPriceUSD,
      sellingPriceUSD,
      currency: targetCurrency
    },
    validationErrors
  };
}

/**
 * Transactional Save, Validation, Referential Integrity Verification, and
 * Ready-Made Packages Catalog Availability Verification.
 */
export function saveAndVerifyMasterPackageFromQuote(
  input: QuoteWorkspaceToPackageInput
): {
  success: boolean;
  pkg?: B2BPackage;
  isUpdate?: boolean;
  error?: string;
  verificationReport?: MasterPackageVerificationReport;
} {
  try {
    const built = buildMasterPackageFromQuoteWorkspace(input);
    if (built.validationErrors.length > 0) {
      return {
        success: false,
        error: built.validationErrors.join(' ')
      };
    }

    const { pkg, isUpdate, autoRegisteredProducts, livePricing } = built;

    // Verify all referenced products exist in db.getProducts() prior to saving
    const currentProducts = db.getProducts();
    const verifiedProductIds: string[] = [];
    const missingProductIds: string[] = [];

    (pkg.productIds || []).forEach(pid => {
      const exists = currentProducts.some(
        p => p.id === pid || p.product_id === pid || p.sku === pid
      );
      if (exists) {
        verifiedProductIds.push(pid);
      } else {
        missingProductIds.push(pid);
      }
    });

    if (missingProductIds.length > 0) {
      return {
        success: false,
        error: `Referential integrity check failed: Missing product IDs in catalog (${missingProductIds.join(', ')}).`
      };
    }

    // Save Master Package to authoritative `b2b_packages` store & sync to Firestore
    db.savePackage(pkg, input.user || null);

    // Read back from database to verify persistence and normalization
    const retrieved = db.getPackageById(pkg.id);
    if (!retrieved) {
      return {
        success: false,
        error: `Package "${pkg.title}" (${pkg.id}) could not be retrieved from Ready-Made Packages store after saving.`
      };
    }

    const normalizedRetrieved = normalizePackageRecord(retrieved);
    const inAllPackages = db.getPackages().some(p => p.id === pkg.id);
    const inPublishedPackages = pkg.isPublished
      ? db.getPublishedB2BPackages().some(p => p.id === pkg.id)
      : true;
    const visibleToAgent = pkg.isPublished
      ? isPackageVisibleToB2BAgent(normalizedRetrieved)
      : false;

    if (!inAllPackages || (pkg.isPublished && (!inPublishedPackages || !visibleToAgent))) {
      return {
        success: false,
        error: `Package "${pkg.title}" (${pkg.id}) saved but failed Ready-Made Packages visibility verification.`
      };
    }

    const report: MasterPackageVerificationReport = {
      packageId: normalizedRetrieved.id,
      packageSlug: normalizedRetrieved.slug,
      isUpdate,
      durationDays: normalizedRetrieved.durationDays,
      durationNights: normalizedRetrieved.durationNights,
      itineraryDaysCount: (normalizedRetrieved.itinerary || []).length,
      referencedProductIds: pkg.productIds || [],
      verifiedProductIds,
      missingProductIds,
      autoRegisteredProductsCount: autoRegisteredProducts.length,
      hotelsCount: (normalizedRetrieved.hotelsSummary || []).length,
      hubsCount: (normalizedRetrieved.hubIds || []).length,
      netPriceTarget: livePricing.netPriceTarget,
      sellingPriceTarget: livePricing.sellingPriceTarget,
      calculatedSellingPriceTarget: livePricing.sellingPriceTarget,
      netPriceUSD: livePricing.netPriceUSD,
      sellingPriceUSD: livePricing.sellingPriceUSD,
      calculatedSellingPriceUSD: livePricing.sellingPriceUSD,
      currency: livePricing.currency,
      retrievableById: Boolean(retrieved),
      visibleInReadyMadeCatalog: inAllPackages,
      visibleToB2BAgent: visibleToAgent
    };

    return {
      success: true,
      pkg: normalizedRetrieved,
      isUpdate,
      verificationReport: report
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Unexpected error while saving and verifying Master Package.'
    };
  }
}

