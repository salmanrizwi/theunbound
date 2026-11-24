import {
  Quotation,
  QuotationOption,
  AuthoritativeQuotationSnapshot,
  QuotationGenerationRecord,
  QuotationOutputOptionKey,
  QuoteBrandingMode,
  AgencyBrandingSnapshot,
  CurrencyCode,
  User,
  AppliedSurchargeDetail,
  QuotationSurchargeOverride
} from '../types';
import { AppDatabase } from './db';
import {
  calculateQuoteTotal,
  calculateQuoteInternalBreakdown,
  buildQuotationCurrencySnapshot,
  resolveQuoteAgencyPricingContext,
  roundCurrencyAmount,
  validateAdminManualMargin
} from './pricingEngine';
import {
  buildQuotePresentationModel,
  buildAgencyBrandingSnapshotFromUser,
  renderQuoteEmailFromPresentationModel,
  renderQuoteWhatsAppFromPresentationModel,
  isTheUnboundBrandString,
  QuotePresentationModel
} from './quotePresentationModel';
import { paginateQuotePresentationModel } from './pdfPaginationEngine';
import { verifyNoCommercialLeak } from '../utils/customerQuoteSanitizer';
import { resolveAuthoritativeCommercialTerms } from '../constants/commercialQuotationTerms';

// ============================================================================
// CONCURRENCY LOCK (PER QUOTATION ID)
// ============================================================================

const activeQuoteSnapshotLocks = new Map<string, Promise<unknown>>();

export function isQuotationSnapshotLocked(quoteId: string): boolean {
  return Boolean(quoteId && activeQuoteSnapshotLocks.has(quoteId));
}

export async function withQuotationSnapshotLock<T>(
  quoteId: string,
  task: () => Promise<T>
): Promise<T> {
  const key = quoteId || 'global-quote-lock';
  const previous = activeQuoteSnapshotLocks.get(key) || Promise.resolve();

  let releaseCurrent!: () => void;
  const currentGate = new Promise<void>((resolve) => {
    releaseCurrent = resolve;
  });
  const chained = previous.then(() => currentGate, () => currentGate);
  activeQuoteSnapshotLocks.set(key, chained);

  try {
    await previous.catch(() => undefined);
    return await task();
  } finally {
    releaseCurrent();
    if (activeQuoteSnapshotLocks.get(key) === chained) {
      activeQuoteSnapshotLocks.delete(key);
    }
  }
}

// ============================================================================
// DETERMINISTIC CANONICAL HASHING & TEXT SANITISATION HELPERS
// ============================================================================

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '0';
  }
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

function fnv1aHash32(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function deterministicShortHash(input: string): string {
  const h1 = fnv1aHash32(input);
  const h2 = fnv1aHash32(`${input.length}:${input.split('').reverse().join('')}`);
  return `${h1}${h2}`;
}

export function stripHtmlTagsAndEntities(html?: string | null): string {
  if (!html) return '';
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function getActiveCentralSurchargeSignature(): Array<{
  id: string;
  code: string;
  name: string;
  ruleType: string;
  amount: number;
  currency: string;
  validFrom: string;
  validTo: string;
}> {
  try {
    const masters = AppDatabase.getInstance().getSurchargeMasters(true) || [];
    return masters
      .filter((s) => s && s.status === 'ACTIVE')
      .map((s) => ({
        id: s.id || '',
        code: s.surchargeCode || s.code || '',
        name: s.name || '',
        ruleType: String(s.calculationType || (s as any).ruleType || ''),
        amount: Number(s.amount || 0),
        currency: String(s.currency || ''),
        validFrom: String(s.validFrom || ''),
        validTo: String(s.validTo || '')
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
  } catch {
    return [];
  }
}

/**
 * Computes a deterministic hash of all commercial, pricing, itinerary, passenger,
 * FX, surcharge, and destination terms fields of a quotation.
 * Deliberately excludes brandingMode / brandingSnapshot / timestamps so switching
 * STANDARD <-> WHITE_LABEL never changes commercial figures or bumps content hash.
 */
export function computeQuotationCommercialContentHash(
  quote: Quotation,
  selectedOptionIndexOrId?: number | string
): string {
  const activeOption = resolveSelectedOption(quote, selectedOptionIndexOrId);
  const effectiveItems = (activeOption?.items && activeOption.items.length > 0)
    ? activeOption.items
    : (quote.items || []);
  const effectiveHubs = (activeOption?.routeHubs && activeOption.routeHubs.length > 0)
    ? activeOption.routeHubs
    : (quote.routeHubs || []);
  const effectiveScope =
    activeOption?.scope ||
    activeOption?.quotationScope ||
    quote.quotationScope ||
    quote.scope ||
    'HOTEL_LAND';

  const hashAgencyCtx = resolveQuoteAgencyPricingContext(quote);
  const payload = {
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    title: quote.title || '',
    destination: quote.destination || '',
    sourcePackageId: quote.sourcePackageId || '',
    selectedOptionId: activeOption?.id || quote.activeOptionId || 'opt-1',
    quotationScope: effectiveScope,
    currency: quote.currency || 'USD',
    travelStartDate: quote.travelStartDate || '',
    travelEndDate: quote.travelEndDate || '',
    adultsCount: quote.adultsCount || 2,
    childrenCount: quote.childrenCount || 0,
    infantsCount: quote.infantsCount || 0,
    childAges: quote.childAges || [],
    nationality: quote.nationality || '',
    travelStyle: quote.travelStyle || '',
    mealPlanPreference: quote.mealPlanPreference || '',
    visaAssistanceChoice: quote.visaAssistanceChoice || 'NOT_REQUIRED',
    roomingConfig: quote.roomingConfig || null,
    agentMarginType: quote.agentMarginType || 'PERCENTAGE',
    agentMarginValue: Number(quote.agentMarginValue ?? quote.overallMarkupPercent ?? 0),
    adminManualMarginType: quote.adminManualMarginType || 'PERCENTAGE',
    adminManualMarginValue: Number(quote.adminManualMarginValue ?? 0),
    adminMarginMode: quote.adminMarginMode || 'ADD',
    overallDiscountPercent: Number(quote.overallDiscountPercent || 0),
    appliedPromotion: quote.appliedPromotion
      ? {
          promotionId: quote.appliedPromotion.promotionId,
          code: quote.appliedPromotion.code,
          discountType: quote.appliedPromotion.discountType,
          discountValue: quote.appliedPromotion.discountValue,
          discountAmount: quote.appliedPromotion.discountAmount,
          promotionConfigVersion: quote.appliedPromotion.promotionConfigVersion
        }
      : null,
    companyId: (quote as any).companyId || hashAgencyCtx.companyId || '',
    agentAgency: quote.agentAgency || hashAgencyCtx.agencyName || '',
    productLevelMarginEnabled: hashAgencyCtx.productLevelMarginEnabled,
    agentLevelMarginPercent: hashAgencyCtx.agentLevelMarginPercent,
    activeCentralSurcharges: getActiveCentralSurchargeSignature(),
    surchargeOverrides: quote.surchargeOverrides || [],
    routeHubs: effectiveHubs.map((h) => ({
      id: h.id,
      itineraryHubOccurrenceId: h.itineraryHubOccurrenceId || h.id,
      accommodationStayId: h.accommodationStayId || '',
      hubId: h.hubId,
      hubName: h.hubName,
      nights: h.nights,
      order: h.order,
      checkInDate: h.checkInDate || '',
      checkOutDate: h.checkOutDate || '',
      accommodationType: h.accommodationType || '',
      hotelId: h.hotelId || '',
      roomTypeId: h.roomTypeId || '',
      roomsCount: h.roomsCount || 1,
      mealPlanCode: h.mealPlanCode || '',
      roomConfiguration: h.roomConfiguration || null,
      manualHotel: h.manualHotel
        ? {
            hotelName: h.manualHotel.hotelName,
            roomType: h.manualHotel.roomType,
            mealPlan: h.manualHotel.mealPlan,
            rateType: (h.manualHotel as any).rateType || '',
            ratePerNight: h.manualHotel.ratePerNight,
            rateCurrency: h.manualHotel.rateCurrency,
            numberOfRooms: h.manualHotel.numberOfRooms,
            numberOfNights: h.manualHotel.numberOfNights,
            netCost: (h.manualHotel as any).netCost || 0,
            totalNetCost: (h.manualHotel as any).totalNetCost || 0,
            totalSellingPrice: (h.manualHotel as any).totalSellingPrice || 0
          }
        : null
    })),
    items: effectiveItems.map((it) => ({
      id: it.id,
      productId: it.product?.id || '',
      productName: it.product?.name || '',
      travelDate: it.travelDate || '',
      itineraryHubOccurrenceId: it.itineraryHubOccurrenceId || it.hubId || '',
      accommodationStayId: it.accommodationStayId || '',
      isNoAccommodation: Boolean(it.isNoAccommodation),
      pax: it.pax || null,
      selectedAddonIds: it.selectedAddonIds || [],
      serviceTime: it.serviceTime || '',
      notes: it.notes || '',
      agentAdditionalMarkupType: it.agentAdditionalMarkupType || '',
      agentAdditionalMarkupValue: Number(it.agentAdditionalMarkupValue || 0),
      markupAmount: Number((it.calculation as any)?.markupAmount || 0),
      taxAmount: Number(it.calculation?.taxAmount || 0),
      serviceFee: Number(it.calculation?.serviceFee || 0),
      finalTotalSellingPrice: Number(
        it.calculation?.finalTotalSellingPrice ??
          (it.calculation as any)?.sellingPriceFinal ??
          (it as any).totalSellingPrice ??
          0
      ),
      surchargeTotal: Number(it.calculation?.surchargeTotal || 0),
      inclusions: it.visaSnapshot?.inclusions || it.contentSnapshot?.inclusions || it.product?.inclusions || [],
      exclusions: it.visaSnapshot?.exclusions || it.contentSnapshot?.exclusions || it.product?.exclusions || [],
      visaConfigVersion: it.visaSnapshot?.configVersion || 1,
      fxRate: Number(
        it.calculation?.fxDetails?.effectiveRate ??
          (it.calculation?.fxDetails as any)?.exchangeRate ??
          1
      )
    })),
    itineraryOverview: quote.itineraryOverview || '',
    dayThemes: quote.dayThemes || {},
    dayDescriptions: quote.dayDescriptions || {},
    dayOverviews: quote.dayOverviews || {},
    dayNotes: quote.dayNotes || {},
    inclusions: quote.inclusions || [],
    exclusions: quote.exclusions || [],
    importantInformation: quote.importantInformation || '',
    cancellationPolicy: quote.cancellationPolicy || '',
    clientName: quote.clientName || '',
    clientEmail: quote.clientEmail || '',
    clientPhone: quote.clientPhone || '',
    clientCompany: quote.clientCompany || '',
    termsStatus: quote.termsStatus || 'QUOTATION_FINALISED',
    commercialTermsHash:
      quote.commercialTermsSnapshot?.combinedPlainText ||
      resolveAuthoritativeCommercialTerms(quote).plainText
  };

  return `comm-${deterministicShortHash(stableStringify(payload))}`;
}

export function computeSnapshotHash(
  commercialContentHash: string,
  brandingMode: QuoteBrandingMode,
  brandingSnapshot?: AgencyBrandingSnapshot | null
): string {
  const brandPayload = {
    commercialContentHash,
    brandingMode,
    agencyName: brandingSnapshot?.agencyName || '',
    agentName: brandingSnapshot?.agentName || '',
    email: brandingSnapshot?.email || '',
    phone: brandingSnapshot?.phone || '',
    address: brandingSnapshot?.address || '',
    website: brandingSnapshot?.website || '',
    logoUrl: brandingSnapshot?.logoUrl || ''
  };
  return `snap-${deterministicShortHash(stableStringify(brandPayload))}`;
}

function resolveSelectedOption(
  quote: Quotation,
  selectedOptionIndexOrId?: number | string
): QuotationOption | undefined {
  if (!quote.options || quote.options.length === 0) return undefined;
  const sel = selectedOptionIndexOrId ?? quote.activeOptionId;
  if (typeof sel === 'number') {
    return (
      quote.options[sel] ||
      (sel >= 1 ? quote.options.find((o) => o.optionNumber === sel) || quote.options[sel - 1] : undefined) ||
      quote.options[0]
    );
  }
  if (typeof sel === 'string') {
    return quote.options.find((o) => o.id === sel) || quote.options[0];
  }
  return quote.options[0];
}

// ============================================================================
// AUTHORITATIVE SNAPSHOT BUILDER
// ============================================================================

export function isQuotationHistoricallyLocked(quote?: Quotation | null): boolean {
  if (!quote) return false;
  const statusStr = String(quote.status || '').toUpperCase();
  return Boolean(
    quote.isLocked ||
      statusStr === 'ISSUED' ||
      statusStr === 'SENT' ||
      statusStr === 'APPROVED' ||
      statusStr === 'ACCEPTED' ||
      statusStr === 'CONVERTED' ||
      statusStr === 'BOOKED'
  );
}

export interface BuildSnapshotOptions {
  existingSaved?: Quotation | null;
  versionNumber?: number;
  selectedOptionIndexOrId?: number | string;
  brandingMode?: QuoteBrandingMode;
  user?: User | null;
  preserveExistingPricingIfLocked?: boolean;
  recalculateIfDirty?: boolean;
}

/**
 * Builds an immutable, self-contained AuthoritativeQuotationSnapshot containing
 * strictly customer/B2B-safe pricing (never internal nett cost or internal margin),
 * trip & itinerary structure, central surcharges, FX snapshot, and destination terms.
 */
export function buildAuthoritativeQuotationSnapshot(
  quote: Quotation,
  options: BuildSnapshotOptions = {}
): AuthoritativeQuotationSnapshot {
  const {
    existingSaved,
    selectedOptionIndexOrId,
    user,
    preserveExistingPricingIfLocked = true,
    recalculateIfDirty = false
  } = options;

  const timestamp = new Date().toISOString();
  const activeOption = resolveSelectedOption(quote, selectedOptionIndexOrId);
  const selectedOptionId = activeOption?.id || quote.activeOptionId || 'opt-1';
  const selectedOptionTitle =
    activeOption?.title ||
    (activeOption as any)?.optionTitle ||
    (activeOption ? `Option ${activeOption.optionNumber}` : undefined);

  const effectiveScope = (
    activeOption?.quotationScope ||
    activeOption?.scope ||
    quote.quotationScope ||
    quote.scope ||
    'HOTEL_LAND'
  ) as AuthoritativeQuotationSnapshot['quotationScope'];
  const isLandOnly = effectiveScope === 'LAND_ONLY';

  const effectiveCurrency: CurrencyCode = quote.currency || existingSaved?.currency || 'USD';
  const brandingMode: QuoteBrandingMode =
    options.brandingMode ||
    quote.brandingMode ||
    quote.brandingSnapshot?.mode ||
    existingSaved?.brandingMode ||
    'STANDARD';

  const brandingSnapshot =
    quote.brandingSnapshot?.mode === brandingMode
      ? quote.brandingSnapshot
      : buildAgencyBrandingSnapshotFromUser(user, quote, brandingMode);

  const existingAuth = existingSaved?.authoritativeSnapshot || quote.authoritativeSnapshot;
  const isLocked = isQuotationHistoricallyLocked(quote);
  const commercialContentHash = computeQuotationCommercialContentHash(quote, selectedOptionId);
  const snapshotHash = computeSnapshotHash(commercialContentHash, brandingMode, brandingSnapshot);

  const quoteAgencyCtx = resolveQuoteAgencyPricingContext(quote, user);

  // Determine whether we should preserve frozen pricing from existingAuth
  const existingAuthMarginMode =
    existingAuth?.pricing?.activeMarginMode ??
    (existingAuth?.pricing?.productLevelMarginEnabled !== undefined
      ? (existingAuth.pricing.productLevelMarginEnabled ? 'PRODUCT_LEVEL' : 'AGENT_LEVEL')
      : undefined);
  const existingAuthAgencyMatches =
    !existingAuthMarginMode ||
    (existingAuthMarginMode === quoteAgencyCtx.activeMarginMode &&
      (quoteAgencyCtx.productLevelMarginEnabled ||
        existingAuth?.pricing?.agentLevelMarginPercent === undefined ||
        Math.abs(Number(existingAuth.pricing.agentLevelMarginPercent) - quoteAgencyCtx.agentLevelMarginPercent) < 0.001));
  const existingAuthVerMatches =
    !options.versionNumber ||
    !existingAuth?.versionNumber ||
    Number(existingAuth.versionNumber) === Number(options.versionNumber);

  const canReuseFrozenPricing = Boolean(
    !recalculateIfDirty &&
      existingAuth &&
      existingAuth.pricing &&
      existingAuth.pricing.currency === effectiveCurrency &&
      (!existingAuth.selectedOptionId || existingAuth.selectedOptionId === selectedOptionId) &&
      ((preserveExistingPricingIfLocked && isLocked) ||
        (existingAuthVerMatches &&
          existingAuth.commercialContentHash === commercialContentHash &&
          existingAuthAgencyMatches))
  );

  let pricingBlock: AuthoritativeQuotationSnapshot['pricing'];

  if (canReuseFrozenPricing && existingAuth) {
    pricingBlock = {
      ...existingAuth.pricing
    };
  } else {
    // Calculate once centrally via pricing engine (strip any stale snapshot caches when dirty or recalculating)
    const shouldPreserveLockedCurrency = Boolean(preserveExistingPricingIfLocked && isLocked && !recalculateIfDirty);
    const cleanOptions = Array.isArray(quote.options)
      ? quote.options.map((opt) => ({
          ...opt,
          pricingSnapshot: undefined,
          currencyConversionSnapshot: undefined
        }))
      : quote.options;
    const cleanQuoteForCalc: Quotation = {
      ...quote,
      companyId: quoteAgencyCtx.companyId ?? (quote as any).companyId,
      agentAgency: quoteAgencyCtx.agencyName ?? quote.agentAgency,
      agentId: quoteAgencyCtx.agentId ?? quote.agentId,
      productLevelMarginEnabled: quoteAgencyCtx.productLevelMarginEnabled,
      agentLevelMarginPercent: quoteAgencyCtx.agentLevelMarginPercent,
      activeMarginMode: quoteAgencyCtx.activeMarginMode,
      options: cleanOptions,
      authoritativeSnapshot: undefined,
      pricingSnapshot: undefined,
      pricing_snapshot: undefined,
      currencyConversionSnapshot: undefined,
      currency_conversion_snapshot: undefined,
      isLocked: shouldPreserveLockedCurrency ? quote.isLocked : false,
      status: shouldPreserveLockedCurrency ? quote.status : 'DRAFT',
      activeOptionId: selectedOptionId,
      quotationScope: effectiveScope === 'LAND_ONLY' ? 'LAND_ONLY' : 'HOTEL_LAND'
    };

    const centralTotals = calculateQuoteTotal(
      cleanQuoteForCalc,
      selectedOptionId,
      undefined,
      effectiveCurrency
    );

    const activeAppliedPromotion =
      quote.appliedPromotion !== undefined
        ? quote.appliedPromotion
        : (quote.authoritativeSnapshot?.pricing?.appliedPromotion || null);

    const internalBreakdown = calculateQuoteInternalBreakdown({
      items: (activeOption?.items && activeOption.items.length > 0 ? activeOption.items : quote.items || []) as any,
      targetCurrency: effectiveCurrency,
      agentMarginType: quote.agentMarginType || 'PERCENTAGE',
      agentMarginValue: Math.max(0, Number(quote.agentMarginValue ?? quote.overallMarkupPercent ?? 0)),
      overallDiscountPercent: Number(quote.overallDiscountPercent || 0),
      userRole: user?.role || 'B2B_AGENT',
      user,
      companyId: quoteAgencyCtx.companyId,
      agencyName: quoteAgencyCtx.agencyName,
      productLevelMarginEnabled: quoteAgencyCtx.productLevelMarginEnabled,
      customAgentMarginPercent: quoteAgencyCtx.agentLevelMarginPercent,
      scope: effectiveScope === 'LAND_ONLY' ? 'LAND_ONLY' : 'HOTEL_LAND',
      routeHubs: (activeOption?.routeHubs && activeOption.routeHubs.length > 0
        ? activeOption.routeHubs
        : quote.routeHubs) || [],
      adminManualMarginType: quote.adminManualMarginType,
      adminManualMarginValue: quote.adminManualMarginValue,
      adminMarginMode: quote.adminMarginMode,
      preserveHistoricalSnapshot: shouldPreserveLockedCurrency,
      historicalSnapshot: shouldPreserveLockedCurrency ? quote.currencyConversionSnapshot : undefined,
      surchargeOverrides: quote.surchargeOverrides,
      appliedPromotion: activeAppliedPromotion
    });

    const reqAdminType: 'PERCENTAGE' | 'FIXED' =
      (quote.adminManualMarginType ?? (quote as any).admin_manual_margin_type) === 'FIXED' ? 'FIXED' : 'PERCENTAGE';
    const reqAdminMode: 'REPLACE' | 'ADD' =
      (quote.adminMarginMode ?? (quote as any).admin_margin_mode) === 'REPLACE' ? 'REPLACE' : 'ADD';
    const rawReqAdminVal = quote.adminManualMarginValue ?? (quote as any).admin_manual_margin_value;
    const reqAdminValue = validateAdminManualMargin(rawReqAdminVal, reqAdminType).sanitizedValue;
    const hasReqAdminConfig =
      rawReqAdminVal !== undefined ||
      quote.adminMarginMode !== undefined ||
      (quote as any).admin_margin_mode !== undefined;
    const snapTotalsAny = quote.currencyConversionSnapshot?.totals as any;
    const snapActiveMarginMode =
      quote.currencyConversionSnapshot?.activeMarginMode ??
      (quote.currencyConversionSnapshot?.productLevelMarginEnabled !== undefined
        ? (quote.currencyConversionSnapshot.productLevelMarginEnabled ? 'PRODUCT_LEVEL' : 'AGENT_LEVEL')
        : undefined);
    const currencySnapAgencyMatches =
      !snapActiveMarginMode ||
      (snapActiveMarginMode === internalBreakdown.activeMarginMode &&
        (internalBreakdown.productLevelMarginEnabled ||
          quote.currencyConversionSnapshot?.agentLevelMarginPercent === undefined ||
          Math.abs(Number(quote.currencyConversionSnapshot.agentLevelMarginPercent) - internalBreakdown.configuredAgentLevelMarginPercent) < 0.001));
    const snapPromoId = snapTotalsAny?.appliedPromotion?.promotionId || '';
    const reqPromoId = activeAppliedPromotion?.promotionId || '';
    const snapPromoCode = snapTotalsAny?.appliedPromotion?.code || '';
    const reqPromoCode = activeAppliedPromotion?.code || '';
    const currencySnapPromoMatches = snapPromoId === reqPromoId && snapPromoCode === reqPromoCode;
    const currencySnapMatchesConfig = Boolean(
      quote.currencyConversionSnapshot &&
      quote.currencyConversionSnapshot.targetCurrency === effectiveCurrency &&
      currencySnapPromoMatches &&
      quote.currencyConversionSnapshot.lineItems.length ===
        (activeOption?.items && activeOption.items.length > 0 ? activeOption.items : quote.items || []).length &&
      Math.abs(
        (quote.currencyConversionSnapshot.finalCustomerSellingPrice || 0) -
          (centralTotals.finalCustomerSellingPrice || internalBreakdown.finalPackagePrice || 0)
      ) <= 0.05 &&
      (
        shouldPreserveLockedCurrency ||
        (
          currencySnapAgencyMatches &&
          (!hasReqAdminConfig || (
            (snapTotalsAny?.manualMarginAdjustmentMode ?? 'ADD') === reqAdminMode &&
            (snapTotalsAny?.manualMarginAdjustmentType ?? 'PERCENTAGE') === reqAdminType &&
            Math.abs(Number(snapTotalsAny?.manualMarginAdjustmentValue ?? 0) - reqAdminValue) < 0.0001
          )) &&
          (snapTotalsAny?.additionalAgentMarginType ?? 'PERCENTAGE') === (quote.agentMarginType || 'PERCENTAGE') &&
          Math.abs(
            Number(snapTotalsAny?.additionalAgentMarginValue ?? 0) -
            Math.max(0, Number(quote.agentMarginValue ?? quote.overallMarkupPercent ?? 0))
          ) < 0.0001
        )
      )
    );

    const currencySnapshot = currencySnapMatchesConfig
      ? quote.currencyConversionSnapshot
      : buildQuotationCurrencySnapshot({
            quoteId: quote.id,
            quoteVersion: options.versionNumber || quote.version || 1,
            items:
              activeOption?.items && activeOption.items.length > 0
                ? activeOption.items
                : quote.items || [],
            targetCurrency: effectiveCurrency,
            scope: effectiveScope === 'LAND_ONLY' ? 'LAND_ONLY' : 'HOTEL_LAND',
            routeHubs:
              activeOption?.routeHubs && activeOption.routeHubs.length > 0
                ? activeOption.routeHubs
                : quote.routeHubs || [],
            userRole: user?.role || 'B2B_AGENT',
            user,
            companyId: quoteAgencyCtx.companyId,
            agencyName: quoteAgencyCtx.agencyName,
            productLevelMarginEnabled: quoteAgencyCtx.productLevelMarginEnabled,
            customAgentMarginPercent: quoteAgencyCtx.agentLevelMarginPercent,
            adminMarginMode: reqAdminMode,
            adminManualMarginType: reqAdminType,
            adminManualMarginValue: reqAdminValue,
            overallDiscountPercent: quote.overallDiscountPercent || 0,
            agentMarginType: quote.agentMarginType || 'PERCENTAGE',
            agentMarginValue: Math.max(0, Number(quote.agentMarginValue ?? quote.overallMarkupPercent ?? 0)),
            surchargeOverrides: quote.surchargeOverrides,
            appliedPromotion: activeAppliedPromotion,
            precomputedBreakdown: internalBreakdown
          });

    const resolvedBaseSelling = roundCurrencyAmount(
      centralTotals.theUnboundBaseSellingPrice > 0
        ? centralTotals.theUnboundBaseSellingPrice
        : internalBreakdown.theUnboundBaseSellingPrice || quote.baseFinalSellingPrice || quote.totalSellingPrice || 0,
      effectiveCurrency
    );

    const resolvedAgentMargin = roundCurrencyAmount(
      centralTotals.markupAmount || internalBreakdown.partnerMarginAmount || quote.agentMarginAmount || 0,
      effectiveCurrency
    );

    const resolvedFinalSelling = roundCurrencyAmount(
      centralTotals.finalCustomerSellingPrice > 0
        ? centralTotals.finalCustomerSellingPrice
        : internalBreakdown.finalPackagePrice > 0
          ? internalBreakdown.finalPackagePrice
          : quote.finalCustomerSellingPrice ?? quote.totalSellingPrice ?? 0,
      effectiveCurrency
    );

    const resolvedHotelTotal = isLandOnly
      ? 0
      : roundCurrencyAmount(
          centralTotals.hotelTotalSellingPrice ?? internalBreakdown.hotelAccommodationTotal ?? 0,
          effectiveCurrency
        );
    const resolvedLandTotal = roundCurrencyAmount(
      centralTotals.landPartTotalSellingPrice ?? internalBreakdown.landPartTotal ?? resolvedFinalSelling,
      effectiveCurrency
    );

    const totalPax =
      quote.totalPax ||
      (quote.adultsCount || 2) + (quote.childrenCount || 0) + (quote.infantsCount || 0);

    const rawAppliedSurcharges: AppliedSurchargeDetail[] = shouldPreserveLockedCurrency
      ? (quote.appliedSurcharges ||
          quote.pricingSnapshot?.appliedSurcharges ||
          currencySnapshot?.appliedSurcharges ||
          internalBreakdown.appliedSurcharges ||
          [])
      : (internalBreakdown.appliedSurcharges && internalBreakdown.appliedSurcharges.length > 0
          ? internalBreakdown.appliedSurcharges
          : (currencySnapshot?.appliedSurcharges || quote.appliedSurcharges || []));

    const appliedSurcharges: AppliedSurchargeDetail[] = rawAppliedSurcharges.map((s) => {
      const clean = { ...s };
      delete (clean as any).supplierNettNative;
      delete (clean as any).supplierNettConverted;
      return clean;
    });

    const surchargesTotal = roundCurrencyAmount(
      quote.isLocked
        ? (quote.surchargesTotal ??
            quote.pricingSnapshot?.surchargesTotal ??
            currencySnapshot?.surchargesTotal ??
            internalBreakdown.surchargesTotal ??
            0)
        : (internalBreakdown.surchargesTotal ??
            currencySnapshot?.surchargesTotal ??
            quote.surchargesTotal ??
            0),
      effectiveCurrency
    );

    const syncedCurrencySnapshot = currencySnapshot
      ? {
          ...currencySnapshot,
          theUnboundBaseSellingPrice: resolvedBaseSelling,
          additionalAgentMarginAmount: resolvedAgentMargin,
          hotelAccommodationTotal: resolvedHotelTotal,
          landPartTotal: resolvedLandTotal,
          finalCustomerSellingPrice: resolvedFinalSelling,
          surchargesTotal,
          appliedSurcharges,
          totals: {
            ...currencySnapshot.totals,
            theUnboundBaseSellingPrice: resolvedBaseSelling,
            b2bSellingPriceTotal: resolvedBaseSelling,
            additionalAgentMarginAmount: resolvedAgentMargin,
            hotelAccommodationTotal: resolvedHotelTotal,
            landPartTotal: resolvedLandTotal,
            finalCustomerSellingPrice: resolvedFinalSelling,
            surchargesTotal
          }
        }
      : currencySnapshot;

    const resolvedPromoSnapshot =
      internalBreakdown.appliedPromotion ?? centralTotals.appliedPromotion ?? activeAppliedPromotion ?? null;
    const resolvedPromoDiscount = roundCurrencyAmount(
      internalBreakdown.promotionDiscountAmount ?? centralTotals.promotionDiscountAmount ?? resolvedPromoSnapshot?.discountAmount ?? 0,
      effectiveCurrency
    );
    const resolvedPreDiscountBase = roundCurrencyAmount(
      internalBreakdown.preDiscountBaseSellingPrice ?? centralTotals.preDiscountBaseSellingPrice ?? (resolvedBaseSelling + resolvedPromoDiscount),
      effectiveCurrency
    );

    pricingBlock = {
      currency: effectiveCurrency,
      theUnboundBaseSellingPrice: resolvedBaseSelling,
      baseFinalSellingPrice: resolvedBaseSelling,
      preDiscountBaseSellingPrice: resolvedPreDiscountBase,
      promotionDiscountAmount: resolvedPromoDiscount,
      discountedBaseSellingPrice: resolvedBaseSelling,
      appliedPromotion: resolvedPromoSnapshot,
      agentMarginType: quote.agentMarginType || 'PERCENTAGE',
      agentMarginValue: Math.max(0, Number(quote.agentMarginValue ?? quote.overallMarkupPercent ?? 0)),
      agentMarginAmount: resolvedAgentMargin,
      productLevelAgentMarkupTotal: roundCurrencyAmount(
        centralTotals.productLevelAgentMarkupTotal ?? internalBreakdown.productLevelAgentMarkupTotal ?? 0,
        effectiveCurrency
      ),
      overallAgentMarkupAmount: roundCurrencyAmount(
        centralTotals.overallAgentMarkupAmount ?? internalBreakdown.overallAgentMarkupAmount ?? resolvedAgentMargin,
        effectiveCurrency
      ),
      totalAgentAdditionalMarkupAmount: resolvedAgentMargin,
      activeMarginMode: internalBreakdown.activeMarginMode,
      productLevelMarginEnabled: internalBreakdown.productLevelMarginEnabled,
      agentLevelMarginPercent: internalBreakdown.configuredAgentLevelMarginPercent,
      ...(hasReqAdminConfig
        ? {
            adminManualMarginType: reqAdminType,
            adminManualMarginValue: reqAdminValue,
            adminManualMarginAmount: roundCurrencyAmount(
              internalBreakdown.adminManualMarginAmount ?? quote.adminManualMarginAmount ?? 0,
              effectiveCurrency
            ),
            adminMarginMode: reqAdminMode,
            revisedSellingPrice: roundCurrencyAmount(
              internalBreakdown.revisedSellingPrice ?? quote.revisedSellingPrice ?? resolvedBaseSelling,
              effectiveCurrency
            )
          }
        : {}),
      overallDiscountPercent: Number(quote.overallDiscountPercent || 0),
      discountsTotal: roundCurrencyAmount(
        centralTotals.discountAmount ?? internalBreakdown.discountAmount ?? 0,
        effectiveCurrency
      ),
      taxesTotal: roundCurrencyAmount(
        internalBreakdown.taxAmount ?? currencySnapshot?.taxAmount ?? quote.pricingSnapshot?.taxesTotal ?? quote.totalTaxes ?? 0,
        effectiveCurrency
      ),
      serviceFeesTotal: roundCurrencyAmount(
        internalBreakdown.serviceFee ?? currencySnapshot?.totals?.serviceFeesTotal ?? quote.pricingSnapshot?.serviceFeesTotal ?? 0,
        effectiveCurrency
      ),
      surchargesTotal,
      appliedSurcharges,
      surchargeOverrides: (quote.surchargeOverrides || []) as QuotationSurchargeOverride[],
      hotelAccommodationTotal: resolvedHotelTotal,
      landPartTotal: resolvedLandTotal,
      finalCustomerSellingPrice: resolvedFinalSelling,
      pricePerPerson: roundCurrencyAmount(resolvedFinalSelling / Math.max(1, totalPax), effectiveCurrency),
      totalGroundLogisticsSnapshot: quote.totalGroundLogisticsSnapshot,
      currencyConversionSnapshot: syncedCurrencySnapshot
    };
  }

  // Commercial Terms Snapshot (preserve locked historical terms if applicable)
  const resolvedTerms =
    isLocked && existingAuth?.commercialTerms?.plainText
      ? {
          termsStatus: existingAuth.commercialTerms.termsStatus || quote.termsStatus || 'QUOTATION_FINALISED',
          snapshot: existingAuth.commercialTerms.snapshot || quote.commercialTermsSnapshot,
          plainText: existingAuth.commercialTerms.plainText,
          termsExceptionApproval: existingAuth.commercialTerms.termsExceptionApproval || quote.termsExceptionApproval
        }
      : (() => {
          const resolved = resolveAuthoritativeCommercialTerms(quote);
          return {
            termsStatus: quote.termsStatus,
            snapshot: quote.commercialTermsSnapshot,
            plainText: resolved.plainText,
            termsExceptionApproval: quote.termsExceptionApproval
          };
        })();

  const effectiveHubs =
    (activeOption?.routeHubs && activeOption.routeHubs.length > 0
      ? activeOption.routeHubs
      : quote.routeHubs) || [];
  const effectiveItems =
    (activeOption?.items && activeOption.items.length > 0
      ? activeOption.items
      : quote.items) || [];
  const totalPax =
    quote.totalPax ||
    (quote.adultsCount || 2) + (quote.childrenCount || 0) + (quote.infantsCount || 0);
  const versionNumber = options.versionNumber || quote.version || 1;

  return {
    snapshotId: `auth-snap-${quote.id}-v${versionNumber}-${snapshotHash.slice(5, 13)}`,
    quoteId: quote.id,
    quoteNumber: quote.quoteNumber || quote.id,
    versionNumber,
    commercialContentHash,
    snapshotHash,
    createdAt: existingAuth?.createdAt || quote.createdAt || timestamp,
    updatedAt: timestamp,
    calculatedAt: pricingBlock.currencyConversionSnapshot?.capturedAt || quote.pricingCalculatedAt || timestamp,
    status: quote.status || 'DRAFT',
    isLocked,
    selectedOptionId,
    selectedOptionTitle,
    quotationScope: effectiveScope,
    sourcePackageId: quote.sourcePackageId,
    sourcePackageName: quote.sourcePackageName,
    client: {
      clientUserId: quote.clientUserId,
      name: quote.clientName || 'Valued Guest',
      email: quote.clientEmail,
      phone: quote.clientPhone,
      company: quote.clientCompany
    },
    agency: {
      agentId: quote.agentId || user?.id || 'usr-agent',
      agentName: brandingSnapshot.agentName || quote.agentName || 'Travel Specialist',
      agentEmail: brandingSnapshot.email ?? quote.agentEmail,
      agentAgency: brandingSnapshot.agencyName || quote.agentAgency,
      agentPhone: brandingSnapshot.phone ?? quote.agentPhone,
      agentLogoUrl: brandingSnapshot.logoUrl ?? quote.agentLogoUrl
    },
    branding: {
      mode: brandingMode,
      snapshot: brandingSnapshot
    },
    trip: {
      title:
        quote.title ||
        quote.sourcePackageName ||
        `${quote.destination || 'Japan'} Bespoke Travel Itinerary`,
      destination: quote.destination || 'Japan',
      travelStartDate: quote.travelStartDate,
      travelEndDate: quote.travelEndDate,
      totalPax,
      adultsCount: quote.adultsCount || 2,
      childrenCount: quote.childrenCount || 0,
      infantsCount: quote.infantsCount || 0,
      childAges: quote.childAges,
      passengerBreakdown: quote.passengerBreakdown,
      roomingConfig: quote.roomingConfig,
      nationality: quote.nationality,
      travelStyle: quote.travelStyle,
      mealPlanPreference: quote.mealPlanPreference,
      visaAssistanceChoice: quote.visaAssistanceChoice,
      routeHubs: effectiveHubs.map((h) => ({ ...h }))
    },
    itinerary: {
      itineraryOverview: quote.itineraryOverview || quote.narrative,
      dayThemes: quote.dayThemes ? { ...quote.dayThemes } : undefined,
      dayDescriptions: quote.dayDescriptions ? { ...quote.dayDescriptions } : undefined,
      dayOverviews: quote.dayOverviews ? { ...quote.dayOverviews } : undefined,
      dayNotes: quote.dayNotes ? { ...quote.dayNotes } : undefined,
      inclusions: Array.isArray(quote.inclusions) ? [...quote.inclusions] : [],
      exclusions: Array.isArray(quote.exclusions) ? [...quote.exclusions] : [],
      importantInformation: quote.importantInformation,
      cancellationPolicy: quote.cancellationPolicy,
      agentNotes: typeof quote.agentNotes === 'string' ? quote.agentNotes : '',
      operationalRemarks: quote.operationalRemarks ? [...quote.operationalRemarks] : undefined,
      customOperationalRemarks: quote.customOperationalRemarks,
      itemsCount: effectiveItems.length
    },
    pricing: pricingBlock,
    commercialTerms: resolvedTerms
  };
}

// ============================================================================
// AUTOMATED CROSS-CHANNEL OUTPUT CONSISTENCY VALIDATOR
// ============================================================================

export interface QuotationOutputConsistencyReport {
  isValid: boolean;
  snapshotId?: string;
  snapshotHash?: string;
  versionNumber: number;
  currency: string;
  finalCustomerSellingPrice: number;
  landPartTotal: number;
  hotelAccommodationTotal: number;
  brandingMode: QuoteBrandingMode;
  mismatches: string[];
  checkedChannels: Array<'SNAPSHOT' | 'PREVIEW' | 'PDF' | 'EMAIL' | 'WHATSAPP'>;
}

export function validateQuotationOutputConsistency(
  quote: Quotation,
  opts?: {
    selectedOptionIndexOrId?: number | string;
    brandingMode?: QuoteBrandingMode;
    agentOverride?: Parameters<typeof buildQuotePresentationModel>[1];
  }
): QuotationOutputConsistencyReport {
  const mismatches: string[] = [];
  const authSnap = quote.authoritativeSnapshot;
  const effectiveBrandingMode: QuoteBrandingMode =
    opts?.brandingMode ||
    opts?.agentOverride?.brandingMode ||
    authSnap?.branding?.mode ||
    quote.brandingMode ||
    'STANDARD';

  const model: QuotePresentationModel = buildQuotePresentationModel(quote, {
    ...(opts?.agentOverride || {}),
    brandingMode: effectiveBrandingMode,
    selectedOptionIndexOrId:
      opts?.selectedOptionIndexOrId ?? authSnap?.selectedOptionId ?? quote.activeOptionId
  });

  // 1. Validate Snapshot <-> Preview Model Parity
  if (authSnap) {
    if (authSnap.quoteNumber !== model.quoteNumber) {
      mismatches.push(`Quote number mismatch: snapshot="${authSnap.quoteNumber}" vs preview="${model.quoteNumber}"`);
    }
    if (authSnap.versionNumber !== model.version) {
      mismatches.push(`Version mismatch: snapshot=v${authSnap.versionNumber} vs preview=v${model.version}`);
    }
    if (authSnap.pricing.currency !== model.currency) {
      mismatches.push(`Currency mismatch: snapshot=${authSnap.pricing.currency} vs preview=${model.currency}`);
    }
    if (Math.abs(authSnap.pricing.finalCustomerSellingPrice - model.finalCustomerSellingPriceNumeric) > 0.05) {
      mismatches.push(
        `Final selling price mismatch: snapshot=${authSnap.pricing.finalCustomerSellingPrice} vs preview=${model.finalCustomerSellingPriceNumeric}`
      );
    }
    if (Math.abs(authSnap.pricing.landPartTotal - model.landPartTotalNumeric) > 0.05) {
      mismatches.push(
        `Land part total mismatch: snapshot=${authSnap.pricing.landPartTotal} vs preview=${model.landPartTotalNumeric}`
      );
    }
    const expectedHotelTotal = authSnap.quotationScope === 'LAND_ONLY' ? 0 : authSnap.pricing.hotelAccommodationTotal;
    if (Math.abs(expectedHotelTotal - model.hotelAccommodationTotalNumeric) > 0.05) {
      mismatches.push(
        `Hotel total mismatch: snapshot=${expectedHotelTotal} vs preview=${model.hotelAccommodationTotalNumeric}`
      );
    }
    if (authSnap.trip.routeHubs.length !== model.routeHubs.length && authSnap.trip.routeHubs.length > 0) {
      mismatches.push(
        `Route hubs count mismatch: snapshot=${authSnap.trip.routeHubs.length} vs preview=${model.routeHubs.length}`
      );
    }
    if ((authSnap.itinerary.inclusions || []).length !== model.inclusions.length) {
      mismatches.push(
        `Inclusions count mismatch: snapshot=${(authSnap.itinerary.inclusions || []).length} vs preview=${model.inclusions.length}`
      );
    }
    if ((authSnap.itinerary.exclusions || []).length !== model.exclusions.length) {
      mismatches.push(
        `Exclusions count mismatch: snapshot=${(authSnap.itinerary.exclusions || []).length} vs preview=${model.exclusions.length}`
      );
    }
  }

  // 2. Render PDF Pagination Pages & Email & WhatsApp from same model
  const pdfPages = paginateQuotePresentationModel(model);
  const pdfCombinedHtml = pdfPages
    .map((p) => `${p.headerHtml || ''}\n${p.blocks.map((b) => b.html).join('\n')}\n${p.footerHtml || ''}`)
    .join('\n');
  const pdfPlainText = stripHtmlTagsAndEntities(pdfCombinedHtml);

  const emailOutput = renderQuoteEmailFromPresentationModel(model);
  const emailHtmlPlainText = stripHtmlTagsAndEntities(emailOutput.htmlBody);
  const emailSimplePlainText = stripHtmlTagsAndEntities(emailOutput.simpleSemanticHtml);

  const whatsAppOutput = renderQuoteWhatsAppFromPresentationModel(model, {
    useEmojis: true,
    formatStyle: 'DETAILED'
  });

  // 3. Cross-channel Total Price & Key Content Parity
  const requiredTokens: Array<{ label: string; value: string; includeInOption2?: boolean }> = [
    { label: 'Quote Reference', value: model.quoteNumber, includeInOption2: true },
    { label: 'Version Marker', value: `v${model.version}`, includeInOption2: true },
    { label: 'Final Customer Selling Price', value: model.finalCustomerSellingPriceFormatted, includeInOption2: false },
    { label: 'Land Part Total', value: model.landPartTotalFormatted, includeInOption2: true }
  ];
  if (model.hasHotelAccommodation && model.hotelAccommodationTotalFormatted) {
    requiredTokens.push({
      label: 'Hotel Accommodation Total',
      value: model.hotelAccommodationTotalFormatted,
      includeInOption2: true
    });
  }

  for (const tok of requiredTokens) {
    if (!tok.value) continue;
    if (!pdfPlainText.includes(tok.value)) {
      mismatches.push(`PDF missing ${tok.label} (${tok.value})`);
    }
    if (!emailHtmlPlainText.includes(tok.value)) {
      mismatches.push(`Email HTML missing ${tok.label} (${tok.value})`);
    }
    if (!emailOutput.textBody.includes(tok.value)) {
      mismatches.push(`Email Plain Text missing ${tok.label} (${tok.value})`);
    }
    if (tok.includeInOption2 !== false && !emailSimplePlainText.includes(tok.value)) {
      mismatches.push(`Email Semantic Copy missing ${tok.label} (${tok.value})`);
    }
    if (!whatsAppOutput.includes(tok.value)) {
      mismatches.push(`WhatsApp missing ${tok.label} (${tok.value})`);
    }
  }
  if (model.hotelPartTotalFormatted && !emailSimplePlainText.includes(model.hotelPartTotalFormatted)) {
    mismatches.push(`Email Semantic Copy missing Hotel Part Total (${model.hotelPartTotalFormatted})`);
  }

  // Verify every scheduled service and hotel appears across PDF, Email, and WhatsApp
  model.hotels.forEach((h) => {
    if (!pdfPlainText.toLowerCase().includes(h.hotelName.toLowerCase())) {
      mismatches.push(`PDF missing hotel "${h.hotelName}"`);
    }
    if (!emailHtmlPlainText.toLowerCase().includes(h.hotelName.toLowerCase())) {
      mismatches.push(`Email missing hotel "${h.hotelName}"`);
    }
    if (!whatsAppOutput.toLowerCase().includes(h.hotelName.toLowerCase())) {
      mismatches.push(`WhatsApp missing hotel "${h.hotelName}"`);
    }
  });

  model.days.forEach((d) => {
    d.services.forEach((s) => {
      if (!pdfPlainText.toLowerCase().includes(s.listingName.toLowerCase())) {
        mismatches.push(`PDF missing Day ${d.dayNumber} service "${s.listingName}"`);
      }
      if (!emailHtmlPlainText.toLowerCase().includes(s.listingName.toLowerCase())) {
        mismatches.push(`Email missing Day ${d.dayNumber} service "${s.listingName}"`);
      }
      if (!whatsAppOutput.toLowerCase().includes(s.listingName.toLowerCase())) {
        mismatches.push(`WhatsApp missing Day ${d.dayNumber} service "${s.listingName}"`);
      }
    });
  });

  // Verify Destination Commercial Terms parity
  if (model.commercialTermsHeading) {
    const headingLower = model.commercialTermsHeading.toLowerCase();
    if (!pdfPlainText.toLowerCase().includes(headingLower)) {
      mismatches.push(`PDF missing commercial terms heading "${model.commercialTermsHeading}"`);
    }
    if (!emailHtmlPlainText.toLowerCase().includes(headingLower)) {
      mismatches.push(`Email missing commercial terms heading "${model.commercialTermsHeading}"`);
    }
    if (!whatsAppOutput.toLowerCase().includes(headingLower)) {
      mismatches.push(`WhatsApp missing commercial terms heading "${model.commercialTermsHeading}"`);
    }
  }

  // 4. White-Label Isolation Enforcement (Zero TheUnbound leaks when WHITE_LABEL is active)
  if (effectiveBrandingMode === 'WHITE_LABEL') {
    const rawBrandingSnap = quote.brandingSnapshot;
    if (rawBrandingSnap?.mode === 'WHITE_LABEL') {
      if (isTheUnboundBrandString(rawBrandingSnap.agencyName)) {
        mismatches.push('White-Label isolation violation: brandingSnapshot agencyName contains Unbound brand reference');
      }
      if (isTheUnboundBrandString(rawBrandingSnap.email)) {
        mismatches.push('White-Label isolation violation: brandingSnapshot email contains Unbound brand reference');
      }
      if (isTheUnboundBrandString(rawBrandingSnap.website)) {
        mismatches.push('White-Label isolation violation: brandingSnapshot website contains Unbound brand reference');
      }
    }

    const channelsToScan: Array<[string, string]> = [
      ['Preview Agency Name', model.agencyName],
      ['Preview Subtitle', model.agentAgencySubtitle],
      ['Preview Footer', model.footerContactLine],
      ['PDF Output', pdfPlainText],
      ['Email Subject', emailOutput.subject],
      ['Email HTML Output', emailHtmlPlainText],
      ['Email Plain Text', emailOutput.textBody],
      ['WhatsApp Output', whatsAppOutput]
    ];
    for (const [label, content] of channelsToScan) {
      if (isTheUnboundBrandString(content)) {
        mismatches.push(`White-Label isolation violation: found Unbound brand reference in ${label}`);
      }
    }
  }

  // 5. Commercial Confidentiality Leak Check (stripped text so CSS `margin` properties are ignored)
  const commercialScanTargets: Array<[string, string]> = [
    ['PDF Text', pdfPlainText],
    ['Email Text', emailOutput.textBody],
    ['Email HTML Text', emailHtmlPlainText],
    ['WhatsApp Text', whatsAppOutput]
  ];
  for (const [label, textContent] of commercialScanTargets) {
    const leak = verifyNoCommercialLeak(textContent);
    if (!leak.isSafe) {
      mismatches.push(`Confidential commercial term leak in ${label}: ${leak.detectedTerms.join(', ')}`);
    }
  }

  return {
    isValid: mismatches.length === 0,
    snapshotId: authSnap?.snapshotId,
    snapshotHash: authSnap?.snapshotHash,
    versionNumber: model.version,
    currency: model.currency,
    finalCustomerSellingPrice: model.finalCustomerSellingPriceNumeric,
    landPartTotal: model.landPartTotalNumeric,
    hotelAccommodationTotal: model.hotelAccommodationTotalNumeric,
    brandingMode: effectiveBrandingMode,
    mismatches,
    checkedChannels: ['SNAPSHOT', 'PREVIEW', 'PDF', 'EMAIL', 'WHATSAPP']
  };
}

// ============================================================================
// CENTRALIZED ORCHESTRATOR: SAVE -> SNAPSHOT -> CONSISTENCY -> HISTORY
// ============================================================================

const OUTPUT_OPTION_LABELS: Record<QuotationOutputOptionKey, string> = {
  SAVE_DRAFT: 'Save Quotation Draft',
  PREVIEW_PROPOSAL: 'Preview Client Proposal',
  DOWNLOAD_PDF: 'Download PDF Itinerary',
  SEND_EMAIL: 'Send Proposal via Email',
  SHARE_WHATSAPP: 'Share via WhatsApp',
  SAVE_MASTER_PACKAGE: 'Save as Master Package',
  CONVERT_BOOKING: 'Convert to Confirmed Booking'
};

export interface PrepareAndPersistSnapshotParams {
  db: AppDatabase;
  quote: Quotation;
  user: User | null;
  outputOption: QuotationOutputOptionKey;
  selectedOptionIndexOrId?: number | string;
  brandingMode?: QuoteBrandingMode;
  actionType?: 'CREATED' | 'EDITED' | 'AUTO_SAVED' | 'PRICING_UPDATED' | 'SAVED';
  customDetails?: string;
  awaitCloudSync?: boolean;
  skipConsistencyValidation?: boolean;
}

export interface PrepareAndPersistSnapshotResult {
  success: boolean;
  quote: Quotation;
  snapshot: AuthoritativeQuotationSnapshot;
  consistencyReport: QuotationOutputConsistencyReport;
  blockedByConsistency: boolean;
  versionBumped: boolean;
  error?: string;
}

export async function prepareAndPersistAuthoritativeSnapshot(
  params: PrepareAndPersistSnapshotParams
): Promise<PrepareAndPersistSnapshotResult> {
  const {
    db,
    quote,
    user,
    outputOption,
    selectedOptionIndexOrId,
    brandingMode,
    customDetails,
    awaitCloudSync = false,
    skipConsistencyValidation = false
  } = params;

  const targetQuoteId = quote.id || quote.quoteNumber || `QTE-${Date.now().toString(36).toUpperCase()}`;

  return withQuotationSnapshotLock(targetQuoteId, async () => {
    const normalizedInput: Quotation = {
      ...quote,
      id: targetQuoteId,
      quoteNumber: quote.quoteNumber || targetQuoteId
    };

    const existingSaved = db.getRawQuoteById(targetQuoteId) || null;
    const isExistingLocked = isQuotationHistoricallyLocked(existingSaved);

    const activeOpt = resolveSelectedOption(normalizedInput, selectedOptionIndexOrId);
    const activeOptionId = activeOpt?.id || normalizedInput.activeOptionId || 'opt-1';
    const effectiveBrandingMode: QuoteBrandingMode =
      brandingMode ||
      normalizedInput.brandingMode ||
      normalizedInput.brandingSnapshot?.mode ||
      existingSaved?.brandingMode ||
      'STANDARD';

    const existingCommercialHash = existingSaved
      ? computeQuotationCommercialContentHash(existingSaved, activeOptionId)
      : '';
    const incomingCommercialHash = computeQuotationCommercialContentHash(
      normalizedInput,
      activeOptionId
    );

    const commercialContentChanged = Boolean(
      existingSaved && existingCommercialHash !== incomingCommercialHash
    );

    // Historical Protection:
    // If existing quotation is locked/finalised and only branding or re-exporting changed, preserve original version & pricing!
    const isNonCommercialReExport =
      params.actionType === 'SAVED' &&
      (outputOption === 'PREVIEW_PROPOSAL' ||
        outputOption === 'DOWNLOAD_PDF' ||
        outputOption === 'SEND_EMAIL' ||
        outputOption === 'SHARE_WHATSAPP');

    const effectiveCommercialChanged = commercialContentChanged && !(isExistingLocked && isNonCommercialReExport);

    // Version Governance: Non-SAVE_DRAFT outputs (Preview, PDF, Email, WhatsApp, Package, Booking)
    // MUST NEVER bump or silently create a new quotation version.
    const existingVersion =
      existingSaved?.latestVersion ||
      existingSaved?.version ||
      existingSaved?.snapshotVersion ||
      normalizedInput.latestVersion ||
      normalizedInput.version ||
      1;
    let nextVersion = existingSaved ? existingVersion : (normalizedInput.version || 1);
    let versionBumped = false;
    let updatedVersionHistory = existingSaved?.versionHistory
      ? [...existingSaved.versionHistory]
      : normalizedInput.versionHistory
        ? [...normalizedInput.versionHistory]
        : [];

    if (
      outputOption === 'SAVE_DRAFT' &&
      existingSaved &&
      effectiveCommercialChanged &&
      params.actionType !== 'SAVED' &&
      params.actionType !== 'AUTO_SAVED'
    ) {
      nextVersion = existingVersion + 1;
      versionBumped = true;
    }

    const preserveHistoricalPricing = Boolean(isExistingLocked && (!commercialContentChanged || isNonCommercialReExport));

    const preparedInput: Quotation = {
      ...normalizedInput,
      id: targetQuoteId,
      activeOptionId,
      version: nextVersion,
      versionNumber: nextVersion,
      snapshotVersion: nextVersion,
      brandingMode: effectiveBrandingMode,
      versionHistory: updatedVersionHistory,
      generationHistory:
        normalizedInput.generationHistory || existingSaved?.generationHistory || []
    };

    const authoritativeSnapshot = buildAuthoritativeQuotationSnapshot(preparedInput, {
      existingSaved,
      versionNumber: nextVersion,
      selectedOptionIndexOrId: activeOptionId,
      brandingMode: effectiveBrandingMode,
      user,
      preserveExistingPricingIfLocked: preserveHistoricalPricing
    });

    const quoteWithSnapshot: Quotation = {
      ...preparedInput,
      activeOptionId: authoritativeSnapshot.selectedOptionId,
      brandingMode: authoritativeSnapshot.branding.mode,
      brandingSnapshot: authoritativeSnapshot.branding.snapshot,
      theUnboundBaseSellingPrice: authoritativeSnapshot.pricing.theUnboundBaseSellingPrice,
      baseFinalSellingPrice: authoritativeSnapshot.pricing.baseFinalSellingPrice,
      base_final_selling_price: authoritativeSnapshot.pricing.baseFinalSellingPrice,
      agentMarginType: authoritativeSnapshot.pricing.agentMarginType,
      agentMarginValue: authoritativeSnapshot.pricing.agentMarginValue,
      agentMarginAmount: authoritativeSnapshot.pricing.agentMarginAmount,
      productLevelAgentMarkupTotal: authoritativeSnapshot.pricing.productLevelAgentMarkupTotal,
      overallAgentMarkupAmount: authoritativeSnapshot.pricing.overallAgentMarkupAmount,
      totalAgentAdditionalMarkupAmount: authoritativeSnapshot.pricing.totalAgentAdditionalMarkupAmount,
      ...(authoritativeSnapshot.pricing.adminMarginMode || authoritativeSnapshot.pricing.adminManualMarginValue !== undefined
        ? {
            adminManualMarginType: authoritativeSnapshot.pricing.adminManualMarginType,
            adminManualMarginValue: authoritativeSnapshot.pricing.adminManualMarginValue,
            adminManualMarginAmount: authoritativeSnapshot.pricing.adminManualMarginAmount,
            adminMarginMode: authoritativeSnapshot.pricing.adminMarginMode,
            revisedSellingPrice: authoritativeSnapshot.pricing.revisedSellingPrice
          }
        : {}),
      ...(authoritativeSnapshot.pricing.activeMarginMode
        ? {
            activeMarginMode: authoritativeSnapshot.pricing.activeMarginMode,
            productLevelMarginEnabled: authoritativeSnapshot.pricing.productLevelMarginEnabled,
            agentLevelMarginPercent: authoritativeSnapshot.pricing.agentLevelMarginPercent
          }
        : {}),
      finalCustomerSellingPrice: authoritativeSnapshot.pricing.finalCustomerSellingPrice,
      final_customer_selling_price: authoritativeSnapshot.pricing.finalCustomerSellingPrice,
      totalSellingPrice: authoritativeSnapshot.pricing.finalCustomerSellingPrice,
      hotelAccommodationTotal: authoritativeSnapshot.pricing.hotelAccommodationTotal,
      landPartTotal: authoritativeSnapshot.pricing.landPartTotal,
      surchargesTotal: authoritativeSnapshot.pricing.surchargesTotal,
      appliedSurcharges: authoritativeSnapshot.pricing.appliedSurcharges,
      surchargeOverrides: authoritativeSnapshot.pricing.surchargeOverrides,
      currencyConversionSnapshot: authoritativeSnapshot.pricing.currencyConversionSnapshot,
      termsStatus: authoritativeSnapshot.commercialTerms.termsStatus || preparedInput.termsStatus,
      commercialTermsSnapshot:
        authoritativeSnapshot.commercialTerms.snapshot || preparedInput.commercialTermsSnapshot,
      termsAndConditions: authoritativeSnapshot.commercialTerms.plainText,
      snapshotVersion: authoritativeSnapshot.versionNumber,
      snapshotHash: authoritativeSnapshot.snapshotHash,
      authoritativeSnapshot
    };

    quoteWithSnapshot.authoritativeSnapshot = {
      ...authoritativeSnapshot,
      commercialContentHash: computeQuotationCommercialContentHash(quoteWithSnapshot, activeOptionId),
      snapshotHash: computeSnapshotHash(
        computeQuotationCommercialContentHash(quoteWithSnapshot, activeOptionId),
        authoritativeSnapshot.branding.mode,
        authoritativeSnapshot.branding.snapshot
      )
    };
    quoteWithSnapshot.snapshotHash = quoteWithSnapshot.authoritativeSnapshot.snapshotHash;

    // Persist through AppDatabase (never advance version on non-SAVE_DRAFT outputs)
    const dbActionType = existingSaved
      ? (outputOption === 'SAVE_DRAFT' && effectiveCommercialChanged && params.actionType !== 'SAVED' && params.actionType !== 'AUTO_SAVED'
          ? 'EDITED'
          : 'SAVED')
      : 'CREATED';

    const savedQuote = db.saveQuote(
      quoteWithSnapshot,
      user,
      dbActionType,
      customDetails ||
        `Synchronised authoritative snapshot v${authoritativeSnapshot.versionNumber} (${authoritativeSnapshot.snapshotHash}) for ${OUTPUT_OPTION_LABELS[outputOption]}`
    );

    if (awaitCloudSync) {
      const synced = await db.syncFirestoreDocAsync('quotations', savedQuote.id, savedQuote);
      if (!synced) {
        return {
          success: false,
          quote: savedQuote,
          snapshot: quoteWithSnapshot.authoritativeSnapshot || authoritativeSnapshot,
          consistencyReport: {
            isValid: false,
            snapshotId: authoritativeSnapshot.snapshotId,
            snapshotHash: authoritativeSnapshot.snapshotHash,
            versionNumber: authoritativeSnapshot.versionNumber,
            currency: authoritativeSnapshot.pricing.currency,
            finalCustomerSellingPrice: authoritativeSnapshot.pricing.finalCustomerSellingPrice,
            landPartTotal: authoritativeSnapshot.pricing.landPartTotal,
            hotelAccommodationTotal: authoritativeSnapshot.pricing.hotelAccommodationTotal,
            brandingMode: effectiveBrandingMode,
            mismatches: ['Cloud persistence to Firestore failed or timed out while synchronizing authoritative snapshot.'],
            checkedChannels: ['SNAPSHOT', 'PREVIEW', 'PDF', 'EMAIL', 'WHATSAPP']
          },
          blockedByConsistency: false,
          versionBumped,
          error: 'Cloud persistence to Firestore failed or timed out. Please retry Save Draft.'
        };
      }
    }

    const consistencyReport = skipConsistencyValidation
      ? {
          isValid: true,
          snapshotId: authoritativeSnapshot.snapshotId,
          snapshotHash: authoritativeSnapshot.snapshotHash,
          versionNumber: authoritativeSnapshot.versionNumber,
          currency: authoritativeSnapshot.pricing.currency,
          finalCustomerSellingPrice: authoritativeSnapshot.pricing.finalCustomerSellingPrice,
          landPartTotal: authoritativeSnapshot.pricing.landPartTotal,
          hotelAccommodationTotal: authoritativeSnapshot.pricing.hotelAccommodationTotal,
          brandingMode: effectiveBrandingMode,
          mismatches: [],
          checkedChannels: ['SNAPSHOT', 'PREVIEW', 'PDF', 'EMAIL', 'WHATSAPP'] as const
        }
      : validateQuotationOutputConsistency(savedQuote, {
          selectedOptionIndexOrId: activeOptionId,
          brandingMode: effectiveBrandingMode
        });

    const finalSnapshot = quoteWithSnapshot.authoritativeSnapshot || authoritativeSnapshot;

    if (!consistencyReport.isValid) {
      const blockedRecord = recordQuotationGenerationEvent(db, savedQuote, {
        outputOption,
        status: 'BLOCKED_CONSISTENCY',
        brandingMode: effectiveBrandingMode,
        selectedOptionId: activeOptionId,
        user,
        errorMessage: `Output consistency validation blocked "${OUTPUT_OPTION_LABELS[outputOption]}" due to cross-channel mismatch.`,
        mismatchDetails: consistencyReport.mismatches
      });

      return {
        success: false,
        quote: blockedRecord.updatedQuote,
        snapshot: finalSnapshot,
        consistencyReport: {
          ...consistencyReport,
          checkedChannels: [...consistencyReport.checkedChannels]
        },
        blockedByConsistency: true,
        versionBumped,
        error: `Synchronisation check blocked ${OUTPUT_OPTION_LABELS[outputOption]}: ${consistencyReport.mismatches[0]}`
      };
    }

    return {
      success: true,
      quote: savedQuote,
      snapshot: finalSnapshot,
      consistencyReport: {
        ...consistencyReport,
        checkedChannels: [...consistencyReport.checkedChannels]
      },
      blockedByConsistency: false,
      versionBumped
    };
  });
}

export function recordQuotationGenerationEvent(
  db: AppDatabase,
  quote: Quotation,
  params: {
    outputOption: QuotationOutputOptionKey;
    status: QuotationGenerationRecord['status'];
    brandingMode?: QuoteBrandingMode;
    selectedOptionId?: string;
    recipient?: string;
    targetEntityId?: string;
    targetReference?: string;
    errorMessage?: string;
    mismatchDetails?: string[];
    user?: User | null;
  }
): { record: QuotationGenerationRecord; updatedQuote: Quotation } {
  const snap = quote.authoritativeSnapshot;
  const record: QuotationGenerationRecord = {
    id: `gen-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    quoteId: quote.id,
    quoteNumber: quote.quoteNumber || quote.id,
    versionNumber: snap?.versionNumber || quote.version || 1,
    snapshotHash: quote.snapshotHash || snap?.snapshotHash || '',
    outputOption: params.outputOption,
    outputLabel: OUTPUT_OPTION_LABELS[params.outputOption],
    brandingMode: params.brandingMode || snap?.branding?.mode || quote.brandingMode || 'STANDARD',
    selectedOptionId: params.selectedOptionId || snap?.selectedOptionId || quote.activeOptionId,
    currency: snap?.pricing?.currency || quote.currency || 'USD',
    finalCustomerSellingPrice:
      snap?.pricing?.finalCustomerSellingPrice ??
      quote.finalCustomerSellingPrice ??
      quote.totalSellingPrice ??
      0,
    status: params.status,
    recipient: params.recipient,
    targetEntityId: params.targetEntityId,
    targetReference: params.targetReference,
    errorMessage: params.errorMessage,
    mismatchDetails: params.mismatchDetails,
    generatedAt: new Date().toISOString(),
    generatedById: params.user?.id || quote.agentId,
    generatedByName: params.user?.name || quote.agentName || 'Travel Consultant'
  };

  const nextHistory = [record, ...(quote.generationHistory || [])].slice(0, 100);
  const enrichedQuote: Quotation = {
    ...quote,
    generationHistory: nextHistory
  };

  const dbAction: Parameters<AppDatabase['saveQuote']>[2] =
    params.outputOption === 'DOWNLOAD_PDF'
      ? 'DOWNLOADED'
      : params.outputOption === 'SEND_EMAIL'
        ? 'SENT'
        : params.outputOption === 'SHARE_WHATSAPP'
          ? 'WHATSAPP_SHARED'
          : params.outputOption === 'CONVERT_BOOKING'
            ? 'CONVERTED'
            : params.outputOption === 'PREVIEW_PROPOSAL'
              ? 'PROPOSAL_GENERATED'
              : 'SAVED';

  const savedQuote = db.saveQuote(
    enrichedQuote,
    params.user || null,
    dbAction,
    params.status === 'BLOCKED_CONSISTENCY'
      ? `${record.outputLabel} blocked due to consistency mismatch`
      : `${record.outputLabel} completed from authoritative snapshot v${record.versionNumber}`
  );

  return { record, updatedQuote: savedQuote };
}
