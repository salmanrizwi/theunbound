import {
  AppliedSurchargeDetail,
  CurrencyCode,
  InventorySurcharge,
  Product,
  QuotationSurchargeOverride,
  SurchargeApplicationBasis,
  SurchargeHistoryRecord,
  SurchargeMaster,
  SurchargeOverlapWarning,
  SurchargePeriodWindow,
  SurchargeProductMapping,
  SurchargeStatus,
  Quotation,
  Booking
} from '../types';
import { currencyEngine, roundCurrencyAmount } from './currencyEngine';

export const SURCHARGE_CATEGORIES = [
  'Peak Season Surcharge',
  'Holiday & Festival Supplement',
  'Cherry Blossom (Sakura) Peak',
  'Golden Week Supplement',
  'Autumn Foliage Peak',
  'Year-End & New Year Peak',
  'Weekend & High-Demand Supplement',
  'Special Event / Expo Surcharge',
  'Late / Rush Booking Surcharge',
  'Night / Out-of-Hours Supplement',
  'Fuel & Operational Surcharge'
] as const;

export const SURCHARGE_PRICING_BASIS_OPTIONS: Array<{
  value: SurchargeApplicationBasis;
  label: string;
  description: string;
}> = [
  { value: 'PER_PERSON', label: 'Per Person (All Guests)', description: 'Multiplied by total applicable passengers (or Adult/Child/Infant specific rates)' },
  { value: 'PER_ADULT', label: 'Per Adult', description: 'Multiplied by number of Adults' },
  { value: 'PER_CHILD', label: 'Per Child', description: 'Multiplied by number of Children' },
  { value: 'PER_INFANT', label: 'Per Infant', description: 'Multiplied by number of Infants' },
  { value: 'FIXED_AMOUNT', label: 'Fixed Amount (Flat)', description: 'Flat fixed surcharge applied once per product line' },
  { value: 'PERCENTAGE', label: 'Percentage (%) of Base Price', description: 'Calculated as a percentage of the product base selling price' },
  { value: 'PER_BOOKING', label: 'Per Booking / Service', description: 'Flat fee per booking item' },
  { value: 'PER_ROOM', label: 'Per Room (Per Stay)', description: 'Multiplied by number of rooms' },
  { value: 'PER_ROOM_NIGHT', label: 'Per Room Per Night', description: 'Multiplied by rooms × eligible nights' },
  { value: 'PER_NIGHT', label: 'Per Night', description: 'Multiplied by eligible nights' },
  { value: 'PER_VEHICLE', label: 'Per Vehicle / Charter Unit', description: 'Multiplied by allocated vehicles / vessels' },
  { value: 'PER_UNIT', label: 'Per Unit / Quantity', description: 'Multiplied by unit quantity' },
  { value: 'PER_HOUR', label: 'Per Hour', description: 'Multiplied by booked hours × eligible days' },
  { value: 'PER_DAY', label: 'Per Day', description: 'Multiplied by eligible service days' },
  { value: 'PER_DEVICE', label: 'Per Device', description: 'Multiplied by device quantity × eligible days' }
];

export const INITIAL_SURCHARGE_MASTERS: SurchargeMaster[] = [
  {
    id: 'sur-jp-sakura-2026',
    surchargeCode: 'SUR-JP-2026-001',
    name: 'Japan Cherry Blossom (Sakura) Peak Season Surcharge',
    internalDescription: 'Mandatory high-demand seasonal surcharge across Tokyo & Kyoto private tours, group tours, and cultural experiences during peak Sakura bloom.',
    surchargeCategory: 'Cherry Blossom (Sakura) Peak',
    regionId: 'mreg-east-asia',
    regionName: 'East Asia',
    prefecture: 'Tokyo & Kyoto',
    destinationId: 'dest-japan',
    destinationName: 'Japan',
    touristArea: 'Kanto & Kansai Golden Route',
    hubId: 'hub-tokyo',
    hubName: 'Tokyo',
    supplierId: 'sup-1',
    supplierName: 'Nippon Cultural Tours & Concierge Co.',
    internalAdminNotes: 'Applies to all peak spring departures between March 20 and April 20. Do not stack with standard weekend supplements.',
    status: 'ACTIVE',
    validFrom: '2026-03-20',
    validTo: '2026-12-31',
    bookingValidFrom: '2025-01-01',
    bookingValidTo: '2026-12-31',
    periods: [
      {
        id: 'win-sakura-spring',
        label: 'Spring Sakura Peak Window',
        travelStartDate: '2026-03-20',
        travelEndDate: '2026-04-20',
        bookingStartDate: '2025-01-01',
        bookingEndDate: '2026-04-20'
      },
      {
        id: 'win-autumn-koyo',
        label: 'Autumn Foliage (Koyo) Peak Window',
        travelStartDate: '2026-10-15',
        travelEndDate: '2026-12-10',
        bookingStartDate: '2025-01-01',
        bookingEndDate: '2026-12-10'
      }
    ],
    timezone: 'Asia/Tokyo',
    allowStacking: false,
    priority: 100,
    linkedProductIds: ['p-tokyo-01', 'p-kyoto-01'],
    applicableCategories: ['Private Tours', 'Group Tours', 'Guides'],
    applicableDestinations: ['Japan'],
    calculationType: 'FIXED',
    pricingBasis: 'PER_PERSON',
    amount: 3500,
    adultAmount: 3500,
    childAmount: 2000,
    infantAmount: 0,
    currency: 'JPY',
    supplierNettSurcharge: 2800,
    buyerMarkupPercent: 25,
    b2bAgentMarkupPercent: 25,
    marginType: 'PERCENTAGE',
    marginValue: 25,
    taxApplicable: false,
    taxPercent: 0,
    taxMethod: 'on_margin',
    serviceFeeType: 'FIXED',
    serviceFeeValue: 0,
    roundingMode: 'INTEGER',
    passengerType: 'ALL',
    minPax: 1,
    maxPax: 50,
    inclusions: ['Peak Season Priority Guide Dispatch', 'Guaranteed High-Season Slot Allocation'],
    exclusions: ['Personal expenses'],
    importantInformation: ['Mandatory peak season supplement applicable during Sakura and Autumn Koyo windows.'],
    operationalRestrictions: 'Requires 72h advance confirmation during peak bloom.',
    availability: 'INSTANT',
    bookingRequiredDays: 3,
    cancellationPolicy: 'Non-refundable within 7 days of service date during peak season.',
    refundConditions: '100% refundable if cancelled 8+ days prior to travel.',
    internalPricingNotes: 'Supplier nett JPY 2,800 + 25% DMC margin = JPY 3,500 selling per adult.',
    version: 1,
    createdAt: '2026-01-10T09:00:00.000Z',
    updatedAt: '2026-01-10T09:00:00.000Z',
    createdBy: 'usr-admin-business',
    createdByName: 'Master Admin (business@theunbound.in)'
  },
  {
    id: 'sur-jp-golden-week-2026',
    surchargeCode: 'SUR-JP-2026-002',
    name: 'Golden Week National Holiday Transport & Chauffeur Surcharge',
    internalDescription: 'Golden Week holiday surcharge for private transfers, luxury MPVs, and chauffeur charters across Japan.',
    surchargeCategory: 'Golden Week Supplement',
    regionId: 'mreg-east-asia',
    regionName: 'East Asia',
    prefecture: 'All Japan Prefectures',
    destinationId: 'dest-japan',
    destinationName: 'Japan',
    touristArea: 'Tokyo, Kyoto, Osaka, Mt Fuji',
    hubId: 'hub-tokyo',
    hubName: 'Tokyo',
    supplierId: 'sup-2',
    supplierName: 'Tokyo Executive Chauffeur & Fleet Services',
    internalAdminNotes: 'Applies 15% supplement on base selling price during Golden Week (Apr 28 - May 07).',
    status: 'ACTIVE',
    validFrom: '2026-04-28',
    validTo: '2026-05-07',
    bookingValidFrom: '2025-01-01',
    bookingValidTo: '2026-05-07',
    periods: [
      {
        id: 'win-gw-2026',
        label: 'Golden Week 2026',
        travelStartDate: '2026-04-28',
        travelEndDate: '2026-05-07'
      }
    ],
    timezone: 'Asia/Tokyo',
    allowStacking: false,
    priority: 120,
    linkedProductIds: ['p-tokyo-01', 'p-kyoto-01'],
    applicableCategories: ['Transfers', 'Private Tours'],
    applicableDestinations: ['Japan'],
    calculationType: 'PERCENTAGE',
    pricingBasis: 'PERCENTAGE',
    amount: 0,
    percentage: 15,
    currency: 'JPY',
    taxApplicable: false,
    taxPercent: 0,
    roundingMode: 'INTEGER',
    passengerType: 'ALL',
    minPax: 1,
    maxPax: 45,
    inclusions: ['Holiday Highway Toll Dispatch Coverage', 'Senior Chauffeur HolidayRoster Guarantee'],
    exclusions: [],
    importantInformation: ['Golden Week national holiday 15% supplement applies from Apr 28 to May 7.'],
    availability: 'ON_REQUEST',
    bookingRequiredDays: 5,
    cancellationPolicy: 'Non-refundable within 14 days of Golden Week travel.',
    version: 1,
    createdAt: '2026-01-12T10:00:00.000Z',
    updatedAt: '2026-01-12T10:00:00.000Z',
    createdBy: 'usr-admin-business',
    createdByName: 'Master Admin (business@theunbound.in)'
  },
  {
    id: 'sur-global-yearend-2026',
    surchargeCode: 'SUR-GLB-2026-003',
    name: 'Festive Year-End & New Year Peak Holiday Surcharge',
    internalDescription: 'Scheduled year-end festive surcharge for December 20, 2026 to January 5, 2027 departures.',
    surchargeCategory: 'Year-End & New Year Peak',
    regionId: 'mreg-europe',
    regionName: 'Europe & UK',
    prefecture: 'London & Paris',
    destinationId: 'dest-uk',
    destinationName: 'United Kingdom',
    touristArea: 'Central London & Westminster',
    hubId: 'hub-london',
    hubName: 'London',
    supplierId: 'sup-3',
    supplierName: 'Britannia Royal Ground Logistics',
    internalAdminNotes: 'Scheduled festive supplement for late Dec / early Jan.',
    status: 'SCHEDULED',
    validFrom: '2026-12-20',
    validTo: '2027-01-05',
    bookingValidFrom: '2026-01-01',
    bookingValidTo: '2027-01-05',
    periods: [
      {
        id: 'win-festive-2026',
        label: 'Festive Peak 2026/27',
        travelStartDate: '2026-12-20',
        travelEndDate: '2027-01-05'
      }
    ],
    timezone: 'Europe/London',
    allowStacking: false,
    priority: 110,
    linkedProductIds: ['p-london-01', 'p-paris-01', 'p-swiss-01'],
    applicableCategories: ['Private Tours', 'Transfers', 'Hotels'],
    applicableDestinations: ['United Kingdom', 'France', 'Switzerland'],
    calculationType: 'FIXED',
    pricingBasis: 'PER_PERSON',
    amount: 45,
    adultAmount: 45,
    childAmount: 25,
    infantAmount: 0,
    currency: 'GBP',
    supplierNettSurcharge: 35,
    b2bAgentMarkupPercent: 28.57,
    marginType: 'FIXED',
    marginValue: 10,
    taxApplicable: false,
    taxPercent: 0,
    roundingMode: 'STANDARD',
    passengerType: 'ALL',
    minPax: 1,
    maxPax: 30,
    inclusions: ['Festive Holiday Operations Desk Support'],
    exclusions: [],
    importantInformation: ['Festive supplement applies for travel between Dec 20 and Jan 5.'],
    availability: 'INSTANT',
    bookingRequiredDays: 7,
    cancellationPolicy: 'Festive bookings require 14 days notice for cancellation.',
    version: 1,
    createdAt: '2026-01-15T11:00:00.000Z',
    updatedAt: '2026-01-15T11:00:00.000Z',
    createdBy: 'usr-admin-business',
    createdByName: 'Master Admin (business@theunbound.in)'
  },
  {
    id: 'sur-jp-winter-2025-expired',
    surchargeCode: 'SUR-JP-2025-004',
    name: '2025 Winter Illumination & Snow Charter Supplement',
    internalDescription: 'Historical winter supplement for Jan-Feb 2025.',
    surchargeCategory: 'Peak Season Surcharge',
    regionId: 'mreg-east-asia',
    regionName: 'East Asia',
    prefecture: 'Hokkaido & Nagano',
    destinationId: 'dest-japan',
    destinationName: 'Japan',
    hubId: 'hub-tokyo',
    hubName: 'Tokyo',
    status: 'EXPIRED',
    validFrom: '2025-01-05',
    validTo: '2025-02-28',
    timezone: 'Asia/Tokyo',
    allowStacking: false,
    priority: 80,
    linkedProductIds: ['p-tokyo-01'],
    calculationType: 'FIXED',
    pricingBasis: 'PER_PERSON',
    amount: 2500,
    currency: 'JPY',
    supplierNettSurcharge: 2000,
    version: 1,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-03-01T00:00:00.000Z',
    createdBy: 'usr-admin-business',
    createdByName: 'Master Admin (business@theunbound.in)'
  },
  {
    id: 'sur-dubai-expo-draft',
    surchargeCode: 'SUR-UAE-2026-005',
    name: 'Dubai Winter Trade Summit & Yacht Charter Supplement (Draft)',
    internalDescription: 'Draft surcharge configuration under commercial review for Dubai yacht & transfer inventory.',
    surchargeCategory: 'Special Event / Expo Surcharge',
    regionId: 'mreg-middle-east',
    regionName: 'Middle East',
    prefecture: 'Dubai Marina',
    destinationId: 'dest-uae',
    destinationName: 'United Arab Emirates',
    hubId: 'hub-dubai',
    hubName: 'Dubai',
    status: 'DRAFT',
    validFrom: '2026-11-10',
    validTo: '2026-11-25',
    timezone: 'Asia/Dubai',
    allowStacking: false,
    priority: 90,
    linkedProductIds: ['p-dubai-01'],
    calculationType: 'FIXED',
    pricingBasis: 'PER_BOOKING',
    amount: 120,
    currency: 'USD',
    supplierNettSurcharge: 95,
    version: 1,
    createdAt: '2026-02-01T08:30:00.000Z',
    updatedAt: '2026-02-01T08:30:00.000Z',
    createdBy: 'usr-admin-business',
    createdByName: 'Master Admin (business@theunbound.in)'
  }
];

function normalizeIsoDate(dateStr?: string | null): string {
  if (!dateStr || typeof dateStr !== 'string') return '';
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (isNaN(parsed.getTime())) return '';
  return parsed.toISOString().split('T')[0];
}

function enumerateStayDates(startIso: string, endIso?: string): string[] {
  const start = normalizeIsoDate(startIso);
  if (!start) return [];
  const end = normalizeIsoDate(endIso);
  if (!end || end <= start) return [start];

  const dates: string[] = [];
  const curr = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  let guard = 0;
  while (curr < last && guard < 366) {
    dates.push(curr.toISOString().split('T')[0]);
    curr.setUTCDate(curr.getUTCDate() + 1);
    guard++;
  }
  return dates.length > 0 ? dates : [start];
}

function getDayOfWeekName(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (isNaN(d.getTime())) return '';
  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return names[d.getUTCDay()] || '';
}

/**
 * Resolves the effective operational status of a SurchargeMaster record.
 * - Preserves DRAFT, INACTIVE, ARCHIVED explicitly.
 * - For published records (ACTIVE / SCHEDULED / EXPIRED), evaluates travel date windows against referenceDate.
 */
export function resolveEffectiveSurchargeStatus(
  surcharge: SurchargeMaster,
  referenceDateIso?: string
): SurchargeStatus {
  if (!surcharge) return 'INACTIVE';
  if (surcharge.isDeleted || surcharge.status === 'ARCHIVED') return 'ARCHIVED';
  if (surcharge.status === 'DRAFT') return 'DRAFT';
  if (surcharge.status === 'INACTIVE') return 'INACTIVE';

  const today = normalizeIsoDate(referenceDateIso) || new Date().toISOString().split('T')[0];
  const windows = getEffectivePeriodWindows(surcharge);

  if (windows.length === 0) {
    return surcharge.status;
  }

  let hasCurrentWindow = false;
  let hasFutureWindow = false;
  let allPast = true;

  for (const w of windows) {
    const start = normalizeIsoDate(w.travelStartDate);
    const end = normalizeIsoDate(w.travelEndDate);
    if (!start || !end) continue;
    if (today >= start && today <= end) {
      hasCurrentWindow = true;
      allPast = false;
    } else if (today < start) {
      hasFutureWindow = true;
      allPast = false;
    }
  }

  if (hasCurrentWindow) return 'ACTIVE';
  if (hasFutureWindow) return 'SCHEDULED';
  if (allPast) return 'EXPIRED';
  return surcharge.status;
}

/**
 * Returns all normalized period windows for a SurchargeMaster.
 * If `surcharge.periods` has entries, returns those; otherwise returns a single window from `validFrom`..`validTo`.
 */
export function getEffectivePeriodWindows(surcharge: SurchargeMaster): SurchargePeriodWindow[] {
  const explicitPeriods = Array.isArray(surcharge.periods)
    ? surcharge.periods.filter(p => Boolean(normalizeIsoDate(p.travelStartDate) && normalizeIsoDate(p.travelEndDate)))
    : [];

  if (explicitPeriods.length > 0) {
    return explicitPeriods.map((p, idx) => ({
      id: p.id || `win-${idx + 1}`,
      label: p.label || `Period ${idx + 1}`,
      travelStartDate: normalizeIsoDate(p.travelStartDate),
      travelEndDate: normalizeIsoDate(p.travelEndDate),
      bookingStartDate: normalizeIsoDate(p.bookingStartDate || surcharge.bookingValidFrom) || undefined,
      bookingEndDate: normalizeIsoDate(p.bookingEndDate || surcharge.bookingValidTo) || undefined,
      applicableDaysOfWeek: p.applicableDaysOfWeek || surcharge.recurringDaysOfWeek,
      blackoutDates: p.blackoutDates || surcharge.blackoutDates
    }));
  }

  const start = normalizeIsoDate(surcharge.validFrom);
  const end = normalizeIsoDate(surcharge.validTo);
  if (!start || !end) return [];

  return [
    {
      id: 'win-primary',
      label: 'Primary Surcharge Period',
      travelStartDate: start,
      travelEndDate: end,
      bookingStartDate: normalizeIsoDate(surcharge.bookingValidFrom) || undefined,
      bookingEndDate: normalizeIsoDate(surcharge.bookingValidTo) || undefined,
      applicableDaysOfWeek: surcharge.recurringDaysOfWeek,
      blackoutDates: surcharge.blackoutDates
    }
  ];
}

/**
 * Generates a unique system Surcharge Code (`SUR-YYYY-NNN`).
 */
export function generateSurchargeCode(existingMasters: SurchargeMaster[] = []): string {
  const year = new Date().getFullYear();
  const nextSeq = existingMasters.length + 1;
  const padded = String(nextSeq).padStart(3, '0');
  const candidate = `SUR-${year}-${padded}`;
  if (!existingMasters.some(s => s.surchargeCode === candidate)) {
    return candidate;
  }
  return `SUR-${year}-${padded}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
}

/**
 * Validates a SurchargeMaster configuration before saving or publishing.
 */
export function validateSurchargeMaster(
  surcharge: Partial<SurchargeMaster>,
  existingMasters: SurchargeMaster[] = [],
  allProducts: Product[] = []
): {
  isValid: boolean;
  errors: string[];
  overlapWarnings: SurchargeOverlapWarning[];
  inactiveLinkedProducts: Array<{ id: string; sku: string; name: string; status: string }>;
} {
  const errors: string[] = [];

  if (!surcharge.name || !surcharge.name.trim()) {
    errors.push('Surcharge Name is required.');
  }

  if (!surcharge.surchargeCategory || !surcharge.surchargeCategory.trim()) {
    errors.push('Surcharge Category / Type is required.');
  }

  const start = normalizeIsoDate(surcharge.validFrom);
  const end = normalizeIsoDate(surcharge.validTo);

  if (!start || !end) {
    errors.push('Effective Travel Start Date and Effective Travel End Date are required.');
  } else if (start > end) {
    errors.push(`Effective Travel Start Date (${start}) must be on or before Effective Travel End Date (${end}).`);
  }

  const bookingStart = normalizeIsoDate(surcharge.bookingValidFrom);
  const bookingEnd = normalizeIsoDate(surcharge.bookingValidTo);
  if ((surcharge.bookingValidFrom && !bookingStart) || (surcharge.bookingValidTo && !bookingEnd)) {
    errors.push('Booking Start Date and Booking End Date must be valid dates (YYYY-MM-DD).');
  } else if (bookingStart && bookingEnd && bookingStart > bookingEnd) {
    errors.push(`Booking Start Date (${bookingStart}) must be on or before Booking End Date (${bookingEnd}).`);
  }

  if (Array.isArray(surcharge.periods) && surcharge.periods.length > 0) {
    surcharge.periods.forEach((p, idx) => {
      const pStart = normalizeIsoDate(p.travelStartDate);
      const pEnd = normalizeIsoDate(p.travelEndDate);
      if (!pStart || !pEnd) {
        errors.push(`Period Window #${idx + 1} (${p.label || 'Unnamed'}) is missing a valid Start Date or End Date.`);
      } else if (pStart > pEnd) {
        errors.push(`Period Window #${idx + 1} (${p.label || 'Unnamed'}): Start Date (${pStart}) must be on or before End Date (${pEnd}).`);
      }
      const pbStart = normalizeIsoDate(p.bookingStartDate);
      const pbEnd = normalizeIsoDate(p.bookingEndDate);
      if (pbStart && pbEnd && pbStart > pbEnd) {
        errors.push(`Period Window #${idx + 1} (${p.label || 'Unnamed'}): Booking Start Date (${pbStart}) must be on or before Booking End Date (${pbEnd}).`);
      }
    });
  }

  const calcType = surcharge.calculationType || (surcharge.pricingBasis === 'PERCENTAGE' ? 'PERCENTAGE' : 'FIXED');
  if (calcType === 'PERCENTAGE' || surcharge.pricingBasis === 'PERCENTAGE') {
    const pct = Number(surcharge.percentage ?? surcharge.amount ?? 0);
    if (isNaN(pct) || pct <= 0 || pct > 500) {
      errors.push('Surcharge Percentage must be a valid positive number between 0.01% and 500%.');
    }
  } else {
    const amt = Number(surcharge.amount ?? 0);
    const adt = Number(surcharge.adultAmount ?? amt);
    if (isNaN(amt) || amt < 0 || (amt === 0 && adt <= 0 && Number(surcharge.supplierNettSurcharge ?? 0) <= 0)) {
      errors.push('Surcharge Amount must be a valid positive number.');
    }
  }

  if (!surcharge.currency) {
    errors.push('Applicable Currency (ISO 4217) is required.');
  }

  if (!surcharge.pricingBasis) {
    errors.push('Pricing Basis (e.g. Per Person, Per Adult, Fixed Amount, Percentage, Per Vehicle) is required.');
  }

  if (
    surcharge.minPax !== undefined &&
    surcharge.maxPax !== undefined &&
    Number(surcharge.minPax) > 0 &&
    Number(surcharge.maxPax) > 0 &&
    Number(surcharge.minPax) > Number(surcharge.maxPax)
  ) {
    errors.push(`Minimum Pax (${surcharge.minPax}) cannot exceed Maximum Pax (${surcharge.maxPax}).`);
  }

  if (
    surcharge.minQuantity !== undefined &&
    surcharge.maxQuantity !== undefined &&
    Number(surcharge.minQuantity) > 0 &&
    Number(surcharge.maxQuantity) > 0 &&
    Number(surcharge.minQuantity) > Number(surcharge.maxQuantity)
  ) {
    errors.push(`Minimum Quantity (${surcharge.minQuantity}) cannot exceed Maximum Quantity (${surcharge.maxQuantity}).`);
  }

  const linkedIds = Array.isArray(surcharge.linkedProductIds) ? surcharge.linkedProductIds.filter(Boolean) : [];
  const isPublishing = surcharge.status === 'ACTIVE' || surcharge.status === 'SCHEDULED';
  if (isPublishing && linkedIds.length === 0) {
    errors.push('At least one affected Product must be selected before publishing an Active or Scheduled surcharge.');
  }

  // Flag any linked products that are currently ARCHIVED or DRAFT
  const productMap = new Map<string, Product>();
  allProducts.forEach(p => productMap.set(p.id, p));

  const inactiveLinkedProducts: Array<{ id: string; sku: string; name: string; status: string }> = [];
  linkedIds.forEach(pid => {
    const prod = productMap.get(pid);
    if (prod && prod.status && prod.status !== 'ACTIVE') {
      inactiveLinkedProducts.push({
        id: prod.id,
        sku: prod.sku || prod.id,
        name: prod.name,
        status: prod.status
      });
    }
  });

  const overlapWarnings = detectCentralizedSurchargeConflicts(
    surcharge as SurchargeMaster,
    existingMasters,
    allProducts
  );

  return {
    isValid: errors.length === 0,
    errors,
    overlapWarnings,
    inactiveLinkedProducts
  };
}

/**
 * Detects overlapping surcharge periods across shared products.
 */
export function detectCentralizedSurchargeConflicts(
  candidate: SurchargeMaster,
  existingMasters: SurchargeMaster[],
  allProducts: Product[] = []
): SurchargeOverlapWarning[] {
  const warnings: SurchargeOverlapWarning[] = [];
  if (!candidate || candidate.status === 'DRAFT' || candidate.status === 'INACTIVE' || candidate.status === 'ARCHIVED') {
    return warnings;
  }

  const candidateLinked = new Set(candidate.linkedProductIds || []);
  if (candidateLinked.size === 0) return warnings;

  const candidateWindows = getEffectivePeriodWindows(candidate);
  if (candidateWindows.length === 0) return warnings;

  const productMap = new Map<string, Product>();
  allProducts.forEach(p => productMap.set(p.id, p));

  for (const other of existingMasters) {
    if (!other || other.id === candidate.id) continue;
    if (other.isDeleted || other.status === 'DRAFT' || other.status === 'INACTIVE' || other.status === 'ARCHIVED' || other.status === 'EXPIRED') {
      continue;
    }

    const sharedProductIds = (other.linkedProductIds || []).filter(pid => candidateLinked.has(pid));
    if (sharedProductIds.length === 0) continue;

    const otherWindows = getEffectivePeriodWindows(other);
    for (const cw of candidateWindows) {
      for (const ow of otherWindows) {
        if (cw.travelStartDate <= ow.travelEndDate && ow.travelStartDate <= cw.travelEndDate) {
          const overlapStart = cw.travelStartDate > ow.travelStartDate ? cw.travelStartDate : ow.travelStartDate;
          const overlapEnd = cw.travelEndDate < ow.travelEndDate ? cw.travelEndDate : ow.travelEndDate;
          const firstProd = productMap.get(sharedProductIds[0]);
          const prodLabel = sharedProductIds.length === 1
            ? (firstProd?.name || sharedProductIds[0])
            : `${firstProd?.name || sharedProductIds[0]} (+${sharedProductIds.length - 1} more)`;
          const stackingAllowed = Boolean(candidate.allowStacking && other.allowStacking);

          warnings.push({
            firstId: candidate.id || 'NEW',
            firstName: candidate.name || 'Current Surcharge',
            secondId: other.id,
            secondName: other.name,
            overlapStart,
            overlapEnd,
            productId: sharedProductIds[0],
            productName: prodLabel,
            allowStacking: stackingAllowed,
            message: `Overlapping travel period (${overlapStart} to ${overlapEnd}) with "${other.name}" on ${sharedProductIds.length} product(s) [${prodLabel}]. ${
              stackingAllowed
                ? 'Stacking is enabled — both surcharges will apply.'
                : 'Stacking is disabled — highest priority surcharge will take precedence to prevent double-charging.'
            }`
          });
        }
      }
    }
  }

  return warnings;
}

/**
 * Builds SurchargeProductMapping records for a given SurchargeMaster and Product catalog.
 */
export function buildMappingsForSurcharge(
  surcharge: SurchargeMaster,
  allProducts: Product[],
  actorId?: string
): SurchargeProductMapping[] {
  const productMap = new Map<string, Product>();
  allProducts.forEach(p => productMap.set(p.id, p));
  const now = new Date().toISOString();

  return (surcharge.linkedProductIds || [])
    .filter(Boolean)
    .map(productId => {
      const prod = productMap.get(productId);
      return {
        id: `${surcharge.id}__${productId}`,
        surchargeId: surcharge.id,
        surchargeCode: surcharge.surchargeCode,
        surchargeNameSnapshot: surcharge.name,
        productId,
        productSku: prod?.sku || productId,
        productNameSnapshot: prod?.name || `Product ${productId}`,
        categorySnapshot: prod?.category || 'Private Tours',
        subcategorySnapshot: prod?.subcategory || '',
        destinationIdSnapshot: prod?.destinationId || surcharge.destinationId || '',
        destinationSnapshot: prod?.destinationName || prod?.country || surcharge.destinationName || 'Japan',
        regionSnapshot: prod?.regionName || surcharge.regionName || '',
        cityHubSnapshot: prod?.city || surcharge.hubName || '',
        supplierIdSnapshot: prod?.supplierId || surcharge.supplierId || '',
        supplierSnapshot: prod?.supplierName || surcharge.supplierName || 'Direct Partner',
        currencySnapshot: (prod?.currency || prod?.nativeCurrency || surcharge.currency || 'JPY') as CurrencyCode,
        productStatusSnapshot: prod?.status || 'ACTIVE',
        isApplicable: (prod?.status || 'ACTIVE') === 'ACTIVE' && surcharge.status !== 'INACTIVE' && surcharge.status !== 'ARCHIVED',
        createdAt: surcharge.createdAt || now,
        updatedAt: now,
        createdBy: actorId || surcharge.updatedBy || surcharge.createdBy || 'usr-admin-business'
      };
    });
}

/**
 * Safely migrates any legacy product-level `product.surcharges` (`InventorySurcharge[]`)
 * into centralized `SurchargeMaster` records without deleting historical data.
 */
export function migrateLegacyProductSurcharges(
  products: Product[],
  existingMasters: SurchargeMaster[]
): {
  migratedMasters: SurchargeMaster[];
  historyRecords: SurchargeHistoryRecord[];
  migratedCount: number;
} {
  const migratedMasters: SurchargeMaster[] = [];
  const historyRecords: SurchargeHistoryRecord[] = [];
  const existingById = new Set(existingMasters.map(m => m.id));
  const existingByLegacyKey = new Set(
    existingMasters
      .filter(m => m.migratedFromProductId && m.migratedFromLegacySurchargeId)
      .map(m => `${m.migratedFromProductId}__${m.migratedFromLegacySurchargeId}`)
  );

  const now = new Date().toISOString();

  for (const product of products) {
    if (!product || !Array.isArray(product.surcharges) || product.surcharges.length === 0) continue;

    for (const legacy of product.surcharges) {
      if (!legacy || !legacy.name) continue;
      const legacyId = legacy.surchargeId || `leg-${product.id}-${legacy.validFrom}`;
      const legacyKey = `${product.id}__${legacyId}`;
      const masterId = legacy.centralizedSurchargeId || `sur-mig-${product.id}-${legacyId}`.replace(/[^a-zA-Z0-9_-]/g, '-');

      if (existingById.has(masterId) || existingByLegacyKey.has(legacyKey)) {
        continue;
      }

      const start = normalizeIsoDate(legacy.validFrom) || normalizeIsoDate(product.validityFrom) || '2026-01-01';
      const end = normalizeIsoDate(legacy.validTo) || normalizeIsoDate(product.validityTo) || '2026-12-31';
      const calcType = legacy.type === 'PERCENTAGE' ? 'PERCENTAGE' : 'FIXED';
      const basis: SurchargeApplicationBasis =
        calcType === 'PERCENTAGE'
          ? 'PERCENTAGE'
          : (legacy.applicationBasis || 'PER_PERSON');
      const curr = ((legacy.currency as CurrencyCode) || product.currency || product.nativeCurrency || 'JPY') as CurrencyCode;

      const newMaster: SurchargeMaster = {
        id: masterId,
        surchargeCode: `SUR-MIG-${String(existingMasters.length + migratedMasters.length + 1).padStart(3, '0')}`,
        name: legacy.name.includes(product.name) ? legacy.name : `${legacy.name} (${product.name})`,
        internalDescription: `Migrated from product-level surcharge on ${product.name} (${product.sku || product.id}).`,
        surchargeCategory: 'Peak Season Surcharge',
        regionId: product.regionId,
        regionName: product.regionName,
        prefecture: product.city,
        destinationId: product.destinationId,
        destinationName: product.destinationName || product.country || 'Japan',
        hubId: product.hubId || product.cityHubId,
        hubName: product.city,
        supplierId: product.supplierId,
        supplierName: product.supplierName,
        internalAdminNotes: legacy.internalNotes || `Automatically migrated from product ${product.sku || product.id}.`,
        status: legacy.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
        validFrom: start,
        validTo: end,
        periods: [
          {
            id: `win-${legacyId}`,
            label: legacy.name,
            travelStartDate: start,
            travelEndDate: end
          }
        ],
        timezone: (product.country || '').toLowerCase().includes('japan') ? 'Asia/Tokyo' : 'UTC',
        allowStacking: false,
        priority: 100,
        linkedProductIds: [product.id],
        applicableCategories: [product.category],
        applicableDestinations: [product.destinationName || product.country || 'Japan'],
        calculationType: calcType,
        pricingBasis: basis,
        amount: calcType === 'FIXED' ? Number(legacy.value || 0) : 0,
        percentage: calcType === 'PERCENTAGE' ? Number(legacy.value || 0) : 0,
        currency: curr,
        roundingMode: curr === 'JPY' || curr === 'THB' ? 'INTEGER' : 'STANDARD',
        passengerType: 'ALL',
        minPax: product.minPax || 1,
        maxPax: product.maxPax || 50,
        inclusions: [],
        exclusions: [],
        importantInformation: [],
        availability: product.availability || 'INSTANT',
        bookingRequiredDays: product.bookingRequiredDays || 1,
        cancellationPolicy: product.cancellationPolicy || '',
        version: 1,
        migratedFromProductId: product.id,
        migratedFromLegacySurchargeId: legacyId,
        createdAt: now,
        updatedAt: now,
        createdBy: 'system-migration',
        createdByName: 'Centralized Surcharge Migration Engine'
      };

      migratedMasters.push(newMaster);
      existingById.add(masterId);
      existingByLegacyKey.add(legacyKey);

      historyRecords.push({
        id: `shist-mig-${masterId}-${Date.now()}`,
        surchargeId: masterId,
        surchargeCode: newMaster.surchargeCode,
        surchargeName: newMaster.name,
        version: 1,
        action: 'MIGRATED',
        changesSummary: `Migrated product-level surcharge "${legacy.name}" from product "${product.name}" (${product.sku || product.id}) into centralized Finance & Administration -> Surcharges.`,
        newSnapshot: newMaster,
        affectedProductIds: [product.id],
        performedBy: 'system-migration',
        performedByName: 'System Migration',
        performedByRole: 'ADMIN',
        timestamp: now
      });
    }
  }

  return {
    migratedMasters,
    historyRecords,
    migratedCount: migratedMasters.length
  };
}

export interface SurchargeDashboardMetrics {
  totalConfigurations: number;
  activePeriodsCount: number;
  upcomingPeriodsCount: number;
  expiredPeriodsCount: number;
  draftConfigurationsCount: number;
  inactiveConfigurationsCount: number;
  archivedConfigurationsCount: number;
  affectedProductsCount: number;
  productsWithoutApplicableSurchargesCount: number;
  totalCatalogProductsCount: number;
  flaggedInactiveProductLinksCount: number;
}

/**
 * Computes live Surcharge Dashboard metrics directly from actual DB records.
 */
export function calculateSurchargeDashboardMetrics(
  surcharges: SurchargeMaster[],
  products: Product[],
  referenceDateIso?: string
): SurchargeDashboardMetrics {
  const activeCatalogProducts = (products || []).filter(p => p && !p.id?.startsWith('deleted'));
  const productMap = new Map<string, Product>();
  activeCatalogProducts.forEach(p => productMap.set(p.id, p));

  const nonArchived = (surcharges || []).filter(s => s && !s.isDeleted && s.status !== 'ARCHIVED');
  const archivedCount = (surcharges || []).filter(s => s && !s.isDeleted && s.status === 'ARCHIVED').length;

  let activePeriodsCount = 0;
  let upcomingPeriodsCount = 0;
  let expiredPeriodsCount = 0;
  let draftConfigurationsCount = 0;
  let inactiveConfigurationsCount = 0;

  const affectedProductIds = new Set<string>();
  const productsWithActiveOrScheduledSurcharge = new Set<string>();
  let flaggedInactiveProductLinksCount = 0;

  for (const s of nonArchived) {
    const effectiveStatus = resolveEffectiveSurchargeStatus(s, referenceDateIso);
    if (effectiveStatus === 'ACTIVE') activePeriodsCount++;
    else if (effectiveStatus === 'SCHEDULED') upcomingPeriodsCount++;
    else if (effectiveStatus === 'EXPIRED') expiredPeriodsCount++;
    else if (effectiveStatus === 'DRAFT') draftConfigurationsCount++;
    else if (effectiveStatus === 'INACTIVE') inactiveConfigurationsCount++;

    (s.linkedProductIds || []).forEach(pid => {
      if (!pid) return;
      affectedProductIds.add(pid);
      if (effectiveStatus === 'ACTIVE' || effectiveStatus === 'SCHEDULED') {
        productsWithActiveOrScheduledSurcharge.add(pid);
      }
      const prod = productMap.get(pid);
      if (prod && prod.status && prod.status !== 'ACTIVE' && (effectiveStatus === 'ACTIVE' || effectiveStatus === 'SCHEDULED')) {
        flaggedInactiveProductLinksCount++;
      }
    });
  }

  const productsWithoutApplicableSurchargesCount = activeCatalogProducts.filter(
    p => !productsWithActiveOrScheduledSurcharge.has(p.id)
  ).length;

  return {
    totalConfigurations: nonArchived.length,
    activePeriodsCount,
    upcomingPeriodsCount,
    expiredPeriodsCount,
    draftConfigurationsCount,
    inactiveConfigurationsCount,
    archivedConfigurationsCount: archivedCount,
    affectedProductsCount: affectedProductIds.size,
    productsWithoutApplicableSurchargesCount,
    totalCatalogProductsCount: activeCatalogProducts.length,
    flaggedInactiveProductLinksCount
  };
}

/**
 * Calculates the unit selling surcharge and internal supplier nett surcharge in the surcharge's own source currency.
 */
export function computeSurchargeUnitCommercialsInSourceCurrency(
  surcharge: SurchargeMaster,
  paxType: 'DEFAULT' | 'ADULT' | 'CHILD' | 'INFANT' = 'DEFAULT'
): {
  sellingUnitAmount: number;
  supplierNettUnitAmount: number;
} {
  let configuredSelling = Number(surcharge.amount || 0);
  if (paxType === 'ADULT' && surcharge.adultAmount !== undefined && surcharge.adultAmount >= 0) {
    configuredSelling = Number(surcharge.adultAmount);
  } else if (paxType === 'CHILD' && surcharge.childAmount !== undefined && surcharge.childAmount >= 0) {
    configuredSelling = Number(surcharge.childAmount);
  } else if (paxType === 'INFANT' && surcharge.infantAmount !== undefined && surcharge.infantAmount >= 0) {
    configuredSelling = Number(surcharge.infantAmount);
  }

  const rawNett = surcharge.supplierNettSurcharge !== undefined && surcharge.supplierNettSurcharge > 0
    ? Number(surcharge.supplierNettSurcharge)
    : configuredSelling;

  // If configuredSelling is explicitly provided (> 0), use it as the authoritative selling unit rate
  // unless supplierNettSurcharge is provided and amount was left 0.
  let sellingUnit = configuredSelling;
  if (sellingUnit <= 0 && rawNett > 0) {
    const markupPct = Number(surcharge.b2bAgentMarkupPercent ?? surcharge.buyerMarkupPercent ?? 0);
    const marginVal = Number(surcharge.marginValue ?? 0);
    if (surcharge.marginType === 'FIXED' && marginVal > 0) {
      sellingUnit = rawNett + marginVal;
    } else if (markupPct > 0) {
      sellingUnit = rawNett * (1 + markupPct / 100);
    } else if (marginVal > 0) {
      sellingUnit = rawNett * (1 + marginVal / 100);
    } else {
      sellingUnit = rawNett;
    }

    if (surcharge.taxApplicable && Number(surcharge.taxPercent || 0) > 0) {
      const taxPct = Number(surcharge.taxPercent || 0);
      const marginPart = Math.max(0, sellingUnit - rawNett);
      const taxAmt = surcharge.taxMethod === 'on_total'
        ? sellingUnit * (taxPct / 100)
        : marginPart * (taxPct / 100);
      sellingUnit += taxAmt;
    }

    if (Number(surcharge.serviceFeeValue || 0) > 0) {
      const sfVal = Number(surcharge.serviceFeeValue || 0);
      sellingUnit += surcharge.serviceFeeType === 'PERCENTAGE'
        ? sellingUnit * (sfVal / 100)
        : sfVal;
    }
  }

  return {
    sellingUnitAmount: Math.max(0, sellingUnit),
    supplierNettUnitAmount: Math.max(0, rawNett > 0 ? rawNett : sellingUnit)
  };
}

function applyRoundingMode(
  amount: number,
  currency: CurrencyCode,
  roundingMode?: 'STANDARD' | 'INTEGER' | 'CEIL' | 'FLOOR'
): number {
  if (!Number.isFinite(amount)) return 0;
  if (roundingMode === 'CEIL') return Math.ceil(amount);
  if (roundingMode === 'FLOOR') return Math.floor(amount);
  if (roundingMode === 'INTEGER') return Math.round(amount);
  return roundCurrencyAmount(amount, currency);
}

export interface EvaluateProductSurchargesInput {
  product: Product;
  centralizedSurcharges?: SurchargeMaster[];
  serviceDate?: string;
  travelDate?: string;
  serviceEndDate?: string;
  bookingDate?: string;
  baseSellingPriceInProductNative?: number;
  baseNativeSellingAmount?: number;
  productNativeCurrency?: CurrencyCode;
  nativeCurrency?: CurrencyCode;
  targetCurrency?: CurrencyCode;
  adults?: number;
  children?: number;
  infants?: number;
  roomsCount?: number;
  nightsCount?: number;
  nights?: number;
  vehiclesCount?: number;
  hoursCount?: number;
  daysCount?: number;
  coverageDays?: number;
  devicesCount?: number;
  quantity?: number;
  itemId?: string;
  surchargeOverrides?: QuotationSurchargeOverride[];
  overrides?: QuotationSurchargeOverride[];
  frozenAppliedSurcharges?: AppliedSurchargeDetail[];
}

/**
 * Authoritative Surcharge Evaluation Engine for B2B Quote Builder & Central Pricing Engine.
 * - Evaluates centralized `SurchargeMaster` records linked to `product.id` (plus any unmigrated legacy surcharges).
 * - Checks Travel Period AND Booking Period independently.
 * - Prevents silent double-charging when overlapping surcharges have `allowStacking: false`.
 * - Applies controlled QuotationSurchargeOverride rules (EXEMPT_PRODUCT, REMOVE_SURCHARGE, OVERRIDE_AMOUNT, ADD_CUSTOM_SURCHARGE).
 * - Converts surcharge amounts ONCE directly from surcharge.currency -> targetCurrency via CurrencyEngine.
 */
export function evaluateCentralizedProductSurcharges(
  input: EvaluateProductSurchargesInput
): {
  appliedSurcharges: AppliedSurchargeDetail[];
  surchargeTotalInProductNative: number;
  surchargeTotalConverted: number;
  surchargeNettTotalInProductNative: number;
  surchargeNettTotalConverted: number;
  conflictWarnings: string[];
  fxValid: boolean;
  fxError?: string;
  validationMessage?: string;
} {
  const product = input.product;
  const centralizedSurcharges = input.centralizedSurcharges || [];
  const serviceDate = input.serviceDate || input.travelDate || '';
  const serviceEndDate = input.serviceEndDate;
  const bookingDate = input.bookingDate;
  const baseSellingPriceInProductNative = input.baseSellingPriceInProductNative ?? input.baseNativeSellingAmount ?? 0;
  const productNativeCurrency = (input.productNativeCurrency || input.nativeCurrency || product?.currency || 'USD') as CurrencyCode;
  const targetCurrency = (input.targetCurrency || productNativeCurrency) as CurrencyCode;
  const adults = input.adults ?? 0;
  const children = input.children ?? 0;
  const infants = input.infants ?? 0;
  const roomsCount = input.roomsCount ?? 1;
  const nightsCount = input.nightsCount ?? input.nights ?? 1;
  const vehiclesCount = input.vehiclesCount ?? 1;
  const hoursCount = input.hoursCount ?? 1;
  const daysCount = input.daysCount ?? input.coverageDays ?? 1;
  const devicesCount = input.devicesCount ?? 1;
  const quantity = input.quantity ?? 1;
  const itemId = input.itemId;
  const surchargeOverrides = input.surchargeOverrides || input.overrides || [];
  const frozenAppliedSurcharges = input.frozenAppliedSurcharges;

  // If frozen snapshot is explicitly supplied and currency matches, preserve historical snapshot
  if (Array.isArray(frozenAppliedSurcharges) && frozenAppliedSurcharges.length > 0) {
    let totalNative = 0;
    let totalConverted = 0;
    let totalNettNative = 0;
    let totalNettConverted = 0;

    const recalibrated = frozenAppliedSurcharges.map(fs => {
      const srcCurr = (fs.currency || productNativeCurrency) as CurrencyCode;
      const convMeta = currencyEngine.convertWithMetadata(fs.appliedAmountNative, srcCurr, targetCurrency);
      const convertedVal = convMeta.isValid ? convMeta.convertedAmount : fs.appliedAmountConverted;
      const nativeMeta = currencyEngine.convertWithMetadata(fs.appliedAmountNative, srcCurr, productNativeCurrency);
      const inProdNative = nativeMeta.isValid ? nativeMeta.convertedAmount : fs.appliedAmountNative;

      const nettSrc = fs.supplierNettNative ?? fs.appliedAmountNative;
      const nettConvMeta = currencyEngine.convertWithMetadata(nettSrc, srcCurr, targetCurrency);
      const nettProdMeta = currencyEngine.convertWithMetadata(nettSrc, srcCurr, productNativeCurrency);

      totalNative += inProdNative;
      totalConverted += convertedVal;
      totalNettNative += nettProdMeta.isValid ? nettProdMeta.convertedAmount : nettSrc;
      totalNettConverted += nettConvMeta.isValid ? nettConvMeta.convertedAmount : (fs.supplierNettConverted ?? convertedVal);

      return {
        ...fs,
        targetCurrency,
        exchangeRate: convMeta.exchangeRate,
        rateDirection: convMeta.rateDirection,
        fxSource: convMeta.fxSource,
        conversionTimestamp: convMeta.conversionTimestamp,
        appliedAmountConverted: convertedVal,
        supplierNettConverted: nettConvMeta.isValid ? nettConvMeta.convertedAmount : fs.supplierNettConverted
      };
    });

    return {
      appliedSurcharges: recalibrated,
      surchargeTotalInProductNative: roundCurrencyAmount(totalNative, productNativeCurrency),
      surchargeTotalConverted: roundCurrencyAmount(totalConverted, targetCurrency),
      surchargeNettTotalInProductNative: roundCurrencyAmount(totalNettNative, productNativeCurrency),
      surchargeNettTotalConverted: roundCurrencyAmount(totalNettConverted, targetCurrency),
      conflictWarnings: [],
      fxValid: true
    };
  }

  // Check if product or item is exempted via QuotationSurchargeOverride
  const isProductExempted = surchargeOverrides.some(
    ov =>
      ov.overrideType === 'EXEMPT_PRODUCT' &&
      ((ov.itemId && itemId && ov.itemId === itemId) ||
        (ov.productId && ov.productId === product.id))
  );

  if (isProductExempted) {
    return {
      appliedSurcharges: [],
      surchargeTotalInProductNative: 0,
      surchargeTotalConverted: 0,
      surchargeNettTotalInProductNative: 0,
      surchargeNettTotalConverted: 0,
      conflictWarnings: [],
      fxValid: true
    };
  }

  const stayDates = enumerateStayDates(serviceDate, serviceEndDate);
  const totalDatesCount = Math.max(1, stayDates.length);
  const effectiveBookingDate = normalizeIsoDate(bookingDate) || new Date().toISOString().split('T')[0];
  const totalPax = Math.max(1, adults + children + infants);

  // Gather candidate centralized surcharges linked to this product
  const linkedCentralized = centralizedSurcharges.filter(s => {
    if (!s || s.isDeleted) return false;
    if (s.status === 'DRAFT' || s.status === 'INACTIVE' || s.status === 'ARCHIVED') return false;
    return Array.isArray(s.linkedProductIds) && s.linkedProductIds.includes(product.id);
  });

  // Also include any unmigrated legacy product.surcharges so historical products never lose surcharges
  const migratedLegacyIds = new Set(
    linkedCentralized.map(s => s.migratedFromLegacySurchargeId).filter(Boolean)
  );
  const legacyCandidates: SurchargeMaster[] = (product.surcharges || [])
    .filter(leg => leg && leg.status === 'ACTIVE' && !migratedLegacyIds.has(leg.surchargeId))
    .map(leg => ({
      id: leg.centralizedSurchargeId || leg.surchargeId,
      surchargeCode: leg.surchargeId,
      name: leg.name,
      surchargeCategory: 'Peak Season Surcharge',
      status: 'ACTIVE' as SurchargeStatus,
      validFrom: leg.validFrom,
      validTo: leg.validTo,
      timezone: 'Asia/Tokyo',
      allowStacking: false,
      priority: 50,
      linkedProductIds: [product.id],
      calculationType: leg.type,
      pricingBasis: leg.type === 'PERCENTAGE' ? 'PERCENTAGE' : (leg.applicationBasis || 'PER_PERSON'),
      amount: leg.type === 'FIXED' ? Number(leg.value || 0) : 0,
      percentage: leg.type === 'PERCENTAGE' ? Number(leg.value || 0) : 0,
      currency: ((leg.currency as CurrencyCode) || productNativeCurrency) as CurrencyCode,
      version: 1,
      createdAt: '',
      updatedAt: ''
    }));

  const allCandidates = [...linkedCentralized, ...legacyCandidates];
  const conflictWarnings: string[] = [];

  // Filter candidates that match pax/quantity & booking date & at least 1 travel date
  interface MatchedCandidate {
    surcharge: SurchargeMaster;
    eligibleDates: string[];
    matchedWindow: SurchargePeriodWindow;
  }

  const matchedCandidates: MatchedCandidate[] = [];

  for (const s of allCandidates) {
    // Check if explicitly removed via override
    const isRemoved = surchargeOverrides.some(
      ov =>
        ov.overrideType === 'REMOVE_SURCHARGE' &&
        ov.surchargeId === s.id &&
        (!ov.itemId || ov.itemId === itemId) &&
        (!ov.productId || ov.productId === product.id)
    );
    if (isRemoved) continue;

    // Pax / Quantity constraints
    if (s.minPax !== undefined && s.minPax > 0 && totalPax < s.minPax) continue;
    if (s.maxPax !== undefined && s.maxPax > 0 && totalPax > s.maxPax) continue;
    if (s.minQuantity !== undefined && s.minQuantity > 0 && quantity < s.minQuantity) continue;
    if (s.maxQuantity !== undefined && s.maxQuantity > 0 && quantity > s.maxQuantity) continue;

    if (s.passengerType === 'ADULT_ONLY' && adults <= 0) continue;
    if (s.passengerType === 'CHILD_ONLY' && children <= 0) continue;

    const windows = getEffectivePeriodWindows(s);
    if (windows.length === 0 || stayDates.length === 0) continue;

    const eligibleDatesSet = new Set<string>();
    let firstMatchedWindow: SurchargePeriodWindow | null = null;

    for (const win of windows) {
      // Check Booking Period if configured on this window
      if (win.bookingStartDate && effectiveBookingDate < win.bookingStartDate) continue;
      if (win.bookingEndDate && effectiveBookingDate > win.bookingEndDate) continue;

      const blackouts = new Set((win.blackoutDates || []).map(d => normalizeIsoDate(d)).filter(Boolean));
      const allowedDays = Array.isArray(win.applicableDaysOfWeek) && win.applicableDaysOfWeek.length > 0
        ? new Set(win.applicableDaysOfWeek.map(d => d.toLowerCase()))
        : null;

      for (const d of stayDates) {
        if (d >= win.travelStartDate && d <= win.travelEndDate) {
          if (blackouts.has(d)) continue;
          if (allowedDays) {
            const dow = getDayOfWeekName(d).toLowerCase();
            if (dow && !allowedDays.has(dow)) continue;
          }
          eligibleDatesSet.add(d);
          if (!firstMatchedWindow) {
            firstMatchedWindow = win;
          }
        }
      }
    }

    if (eligibleDatesSet.size > 0 && firstMatchedWindow) {
      matchedCandidates.push({
        surcharge: s,
        eligibleDates: Array.from(eligibleDatesSet).sort(),
        matchedWindow: firstMatchedWindow
      });
    }
  }

  // Handle overlapping surcharges when allowStacking is false
  let selectedCandidates: MatchedCandidate[] = [];
  if (matchedCandidates.length <= 1) {
    selectedCandidates = matchedCandidates;
  } else {
    const stackable = matchedCandidates.filter(c => c.surcharge.allowStacking === true);
    const nonStackable = matchedCandidates.filter(c => !c.surcharge.allowStacking);

    if (nonStackable.length <= 1) {
      selectedCandidates = [...nonStackable, ...stackable];
    } else {
      // Sort non-stackable by deterministic priority (higher priority -> narrower window -> latest updatedAt)
      const sortedNonStackable = [...nonStackable].sort((a, b) => {
        const prioDiff = (b.surcharge.priority ?? 100) - (a.surcharge.priority ?? 100);
        if (prioDiff !== 0) return prioDiff;
        const aSpan = new Date(a.matchedWindow.travelEndDate).getTime() - new Date(a.matchedWindow.travelStartDate).getTime();
        const bSpan = new Date(b.matchedWindow.travelEndDate).getTime() - new Date(b.matchedWindow.travelStartDate).getTime();
        if (aSpan !== bSpan) return aSpan - bSpan;
        return (b.surcharge.updatedAt || '').localeCompare(a.surcharge.updatedAt || '');
      });

      const winner = sortedNonStackable[0];
      const suppressedNames = sortedNonStackable.slice(1).map(x => x.surcharge.name);
      const warningText = `Multiple non-stackable surcharges matched ${product.name} on ${serviceDate}. Applied "${winner.surcharge.name}" (highest priority) and suppressed [${suppressedNames.join(', ')}] to prevent double-charging.`;
      conflictWarnings.push(warningText);
      selectedCandidates = [winner, ...stackable];
    }
  }

  const appliedSurcharges: AppliedSurchargeDetail[] = [];
  let surchargeTotalInProductNative = 0;
  let surchargeTotalConverted = 0;
  let surchargeNettTotalInProductNative = 0;
  let surchargeNettTotalConverted = 0;

  for (const cand of selectedCandidates) {
    const s = cand.surcharge;
    const eligibleDaysCount = cand.eligibleDates.length;
    const win = cand.matchedWindow;
    const surchargeCurrency = (s.currency || productNativeCurrency) as CurrencyCode;
    const calcType = s.calculationType === 'PERCENTAGE' || s.pricingBasis === 'PERCENTAGE' ? 'PERCENTAGE' : 'FIXED';
    const basis = (s.pricingBasis || (calcType === 'PERCENTAGE' ? 'PERCENTAGE' : 'PER_PERSON')).toUpperCase();

    // Check if there is an OVERRIDE_AMOUNT for this surcharge
    const amountOverride = surchargeOverrides.find(
      ov =>
        ov.overrideType === 'OVERRIDE_AMOUNT' &&
        ov.surchargeId === s.id &&
        (!ov.itemId || ov.itemId === itemId) &&
        (!ov.productId || ov.productId === product.id)
    );

    let sellingInSurchargeCurr = 0;
    let nettInSurchargeCurr = 0;
    let effectiveCurrency = surchargeCurrency;

    if (amountOverride && amountOverride.overriddenAmount !== undefined) {
      effectiveCurrency = (amountOverride.overriddenCurrency || surchargeCurrency) as CurrencyCode;
      sellingInSurchargeCurr = Math.max(0, Number(amountOverride.overriddenAmount));
      nettInSurchargeCurr = sellingInSurchargeCurr;
    } else if (calcType === 'PERCENTAGE') {
      const pct = Math.max(0, Number(s.percentage ?? s.amount ?? 0));
      const dayFraction = totalDatesCount > 1 ? eligibleDaysCount / totalDatesCount : 1;
      // Convert baseSellingPriceInProductNative to surchargeCurrency if needed
      const baseInSurchargeCurrMeta = currencyEngine.convertWithMetadata(
        baseSellingPriceInProductNative,
        productNativeCurrency,
        surchargeCurrency
      );
      const baseInSurchargeCurr = baseInSurchargeCurrMeta.isValid
        ? baseInSurchargeCurrMeta.convertedAmount
        : baseSellingPriceInProductNative;
      sellingInSurchargeCurr = baseInSurchargeCurr * (pct / 100) * dayFraction;
      nettInSurchargeCurr = sellingInSurchargeCurr;
    } else {
      const defaultUnit = computeSurchargeUnitCommercialsInSourceCurrency(s, 'DEFAULT');

      switch (basis) {
        case 'PER_PERSON': {
          const hasSpecificPaxAmounts =
            (s.adultAmount !== undefined && s.adultAmount > 0) ||
            (s.childAmount !== undefined && s.childAmount > 0) ||
            (s.infantAmount !== undefined && s.infantAmount > 0);

          if (hasSpecificPaxAmounts) {
            const adtUnit = computeSurchargeUnitCommercialsInSourceCurrency(s, 'ADULT');
            const chdUnit = computeSurchargeUnitCommercialsInSourceCurrency(s, 'CHILD');
            const infUnit = computeSurchargeUnitCommercialsInSourceCurrency(s, 'INFANT');
            const effAdults = s.passengerType === 'CHILD_ONLY' ? 0 : Math.max(0, adults);
            const effChildren = s.passengerType === 'ADULT_ONLY' ? 0 : Math.max(0, children);
            const effInfants = (s.passengerType === 'ADULT_ONLY' || s.passengerType === 'CHILD_ONLY' || s.passengerType === 'ADULT_CHILD') ? 0 : Math.max(0, infants);

            sellingInSurchargeCurr =
              effAdults * adtUnit.sellingUnitAmount +
              effChildren * chdUnit.sellingUnitAmount +
              effInfants * infUnit.sellingUnitAmount;
            nettInSurchargeCurr =
              effAdults * adtUnit.supplierNettUnitAmount +
              effChildren * chdUnit.supplierNettUnitAmount +
              effInfants * infUnit.supplierNettUnitAmount;
          } else {
            const eligiblePax =
              s.passengerType === 'ADULT_ONLY'
                ? Math.max(0, adults)
                : s.passengerType === 'CHILD_ONLY'
                  ? Math.max(0, children)
                  : s.passengerType === 'ADULT_CHILD'
                    ? Math.max(1, adults + children)
                    : Math.max(1, adults + children + infants);
            sellingInSurchargeCurr = defaultUnit.sellingUnitAmount * eligiblePax;
            nettInSurchargeCurr = defaultUnit.supplierNettUnitAmount * eligiblePax;
          }
          break;
        }
        case 'PER_ADULT':
          sellingInSurchargeCurr = defaultUnit.sellingUnitAmount * Math.max(1, adults);
          nettInSurchargeCurr = defaultUnit.supplierNettUnitAmount * Math.max(1, adults);
          break;
        case 'PER_CHILD':
          sellingInSurchargeCurr = defaultUnit.sellingUnitAmount * Math.max(0, children);
          nettInSurchargeCurr = defaultUnit.supplierNettUnitAmount * Math.max(0, children);
          break;
        case 'PER_INFANT':
          sellingInSurchargeCurr = defaultUnit.sellingUnitAmount * Math.max(0, infants);
          nettInSurchargeCurr = defaultUnit.supplierNettUnitAmount * Math.max(0, infants);
          break;
        case 'PER_ROOM':
          sellingInSurchargeCurr = defaultUnit.sellingUnitAmount * Math.max(1, roomsCount);
          nettInSurchargeCurr = defaultUnit.supplierNettUnitAmount * Math.max(1, roomsCount);
          break;
        case 'PER_ROOM_NIGHT': {
          const effNights = stayDates.length > 1 ? eligibleDaysCount : Math.min(eligibleDaysCount, Math.max(1, nightsCount));
          sellingInSurchargeCurr = defaultUnit.sellingUnitAmount * Math.max(1, roomsCount) * Math.max(1, effNights);
          nettInSurchargeCurr = defaultUnit.supplierNettUnitAmount * Math.max(1, roomsCount) * Math.max(1, effNights);
          break;
        }
        case 'PER_NIGHT': {
          const effNights = stayDates.length > 1 ? eligibleDaysCount : Math.min(eligibleDaysCount, Math.max(1, nightsCount));
          sellingInSurchargeCurr = defaultUnit.sellingUnitAmount * Math.max(1, effNights);
          nettInSurchargeCurr = defaultUnit.supplierNettUnitAmount * Math.max(1, effNights);
          break;
        }
        case 'PER_VEHICLE':
          sellingInSurchargeCurr = defaultUnit.sellingUnitAmount * Math.max(1, vehiclesCount) * Math.max(1, eligibleDaysCount);
          nettInSurchargeCurr = defaultUnit.supplierNettUnitAmount * Math.max(1, vehiclesCount) * Math.max(1, eligibleDaysCount);
          break;
        case 'PER_UNIT':
          sellingInSurchargeCurr = defaultUnit.sellingUnitAmount * Math.max(1, quantity);
          nettInSurchargeCurr = defaultUnit.supplierNettUnitAmount * Math.max(1, quantity);
          break;
        case 'PER_HOUR':
          sellingInSurchargeCurr = defaultUnit.sellingUnitAmount * Math.max(1, hoursCount) * Math.max(1, eligibleDaysCount);
          nettInSurchargeCurr = defaultUnit.supplierNettUnitAmount * Math.max(1, hoursCount) * Math.max(1, eligibleDaysCount);
          break;
        case 'PER_DAY':
          sellingInSurchargeCurr = defaultUnit.sellingUnitAmount * Math.max(1, stayDates.length > 1 ? eligibleDaysCount : daysCount);
          nettInSurchargeCurr = defaultUnit.supplierNettUnitAmount * Math.max(1, stayDates.length > 1 ? eligibleDaysCount : daysCount);
          break;
        case 'PER_DEVICE':
          sellingInSurchargeCurr = defaultUnit.sellingUnitAmount * Math.max(1, devicesCount) * Math.max(1, stayDates.length > 1 ? eligibleDaysCount : daysCount);
          nettInSurchargeCurr = defaultUnit.supplierNettUnitAmount * Math.max(1, devicesCount) * Math.max(1, stayDates.length > 1 ? eligibleDaysCount : daysCount);
          break;
        case 'FIXED_AMOUNT':
        case 'PER_BOOKING':
        case 'PER_SERVICE':
        default:
          sellingInSurchargeCurr = defaultUnit.sellingUnitAmount;
          nettInSurchargeCurr = defaultUnit.supplierNettUnitAmount;
          break;
      }
    }

    const roundedSourceSelling = applyRoundingMode(sellingInSurchargeCurr, effectiveCurrency, s.roundingMode);
    const roundedSourceNett = applyRoundingMode(nettInSurchargeCurr, effectiveCurrency, s.roundingMode);

    // Single authoritative conversion: effectiveCurrency -> targetCurrency
    const targetConv = currencyEngine.convertWithMetadata(roundedSourceSelling, effectiveCurrency, targetCurrency);
    const convertedSelling = targetConv.isValid
      ? applyRoundingMode(targetConv.convertedAmount, targetCurrency, s.roundingMode)
      : 0;

    // Also compute in productNativeCurrency for native breakdown fields
    const prodNativeConv = currencyEngine.convertWithMetadata(roundedSourceSelling, effectiveCurrency, productNativeCurrency);
    const prodNativeSelling = prodNativeConv.isValid
      ? applyRoundingMode(prodNativeConv.convertedAmount, productNativeCurrency, s.roundingMode)
      : roundedSourceSelling;

    const targetNettConv = currencyEngine.convertWithMetadata(roundedSourceNett, effectiveCurrency, targetCurrency);
    const convertedNett = targetNettConv.isValid
      ? applyRoundingMode(targetNettConv.convertedAmount, targetCurrency, s.roundingMode)
      : convertedSelling;

    const prodNativeNettConv = currencyEngine.convertWithMetadata(roundedSourceNett, effectiveCurrency, productNativeCurrency);
    const prodNativeNett = prodNativeNettConv.isValid
      ? applyRoundingMode(prodNativeNettConv.convertedAmount, productNativeCurrency, s.roundingMode)
      : roundedSourceNett;

    surchargeTotalInProductNative += prodNativeSelling;
    surchargeTotalConverted += convertedSelling;
    surchargeNettTotalInProductNative += prodNativeNett;
    surchargeNettTotalConverted += convertedNett;

    appliedSurcharges.push({
      surchargeId: s.id,
      surchargeCode: s.surchargeCode,
      name: s.name,
      surchargeCategory: s.surchargeCategory,
      validFrom: win.travelStartDate || s.validFrom,
      validTo: win.travelEndDate || s.validTo,
      bookingValidFrom: win.bookingStartDate || s.bookingValidFrom,
      bookingValidTo: win.bookingEndDate || s.bookingValidTo,
      affectedProductId: product.id,
      affectedProductName: product.name,
      type: calcType,
      value: calcType === 'PERCENTAGE' ? Number(s.percentage ?? s.amount ?? 0) : Number(s.amount || 0),
      currency: effectiveCurrency,
      targetCurrency,
      exchangeRate: targetConv.exchangeRate,
      rateDirection: targetConv.rateDirection,
      fxSource: targetConv.fxSource,
      conversionTimestamp: targetConv.conversionTimestamp,
      applicationBasis: basis,
      appliedAmountNative: roundedSourceSelling,
      appliedAmountConverted: convertedSelling,
      supplierNettNative: roundedSourceNett,
      supplierNettConverted: convertedNett,
      eligibleDaysCount,
      isCentralized: true,
      isOverridden: Boolean(amountOverride),
      overrideType: amountOverride?.overrideType,
      overrideReason: amountOverride?.reason,
      overriddenBy: amountOverride?.authorizedByName,
      conflictWarning: conflictWarnings.length > 0 ? conflictWarnings[0] : undefined
    });
  }

  // Also apply any custom surcharges added specifically via QuotationSurchargeOverride ('ADD_CUSTOM_SURCHARGE')
  const customSurchargeOverrides = surchargeOverrides.filter(
    ov =>
      ov.overrideType === 'ADD_CUSTOM_SURCHARGE' &&
      ((ov.itemId && itemId && ov.itemId === itemId) ||
        (!ov.itemId && ov.productId === product.id))
  );

  for (const customOv of customSurchargeOverrides) {
    const customCurr = (customOv.overriddenCurrency || customOv.originalCurrency || targetCurrency) as CurrencyCode;
    const rawCustomVal = Math.max(0, Number(customOv.overriddenAmount ?? customOv.originalAmount ?? 0));
    const customBasis = (customOv.pricingBasis || 'FIXED_AMOUNT').toUpperCase();
    let customSellingSource = rawCustomVal;

    if (customBasis === 'PER_PERSON') {
      customSellingSource = rawCustomVal * Math.max(1, adults + children + infants);
    } else if (customBasis === 'PER_ADULT') {
      customSellingSource = rawCustomVal * Math.max(1, adults);
    } else if (customBasis === 'PER_VEHICLE') {
      customSellingSource = rawCustomVal * Math.max(1, vehiclesCount);
    }

    const roundedCustomSource = roundCurrencyAmount(customSellingSource, customCurr);
    const targetConv = currencyEngine.convertWithMetadata(roundedCustomSource, customCurr, targetCurrency);
    const convertedCustom = targetConv.isValid ? targetConv.convertedAmount : 0;

    const prodNativeConv = currencyEngine.convertWithMetadata(roundedCustomSource, customCurr, productNativeCurrency);
    const prodNativeCustom = prodNativeConv.isValid ? prodNativeConv.convertedAmount : roundedCustomSource;

    surchargeTotalInProductNative += prodNativeCustom;
    surchargeTotalConverted += convertedCustom;
    surchargeNettTotalInProductNative += prodNativeCustom;
    surchargeNettTotalConverted += convertedCustom;

    appliedSurcharges.push({
      surchargeId: customOv.surchargeId || customOv.id,
      surchargeCode: 'SUR-CUSTOM',
      name: customOv.surchargeName || 'Authorized Custom Surcharge',
      surchargeCategory: 'Authorized Custom Surcharge',
      validFrom: customOv.validFrom || serviceDate || '',
      validTo: customOv.validTo || serviceEndDate || serviceDate || '',
      affectedProductId: product.id,
      affectedProductName: product.name,
      type: customOv.calculationType || 'FIXED',
      value: rawCustomVal,
      currency: customCurr,
      targetCurrency,
      exchangeRate: targetConv.exchangeRate,
      rateDirection: targetConv.rateDirection,
      fxSource: targetConv.fxSource,
      conversionTimestamp: targetConv.conversionTimestamp,
      applicationBasis: customBasis,
      appliedAmountNative: roundedCustomSource,
      appliedAmountConverted: convertedCustom,
      supplierNettNative: roundedCustomSource,
      supplierNettConverted: convertedCustom,
      eligibleDaysCount: 1,
      isCentralized: true,
      isOverridden: true,
      overrideType: 'ADD_CUSTOM_SURCHARGE',
      overrideReason: customOv.reason,
      overriddenBy: customOv.authorizedByName
    });
  }

  return {
    appliedSurcharges,
    surchargeTotalInProductNative: roundCurrencyAmount(surchargeTotalInProductNative, productNativeCurrency),
    surchargeTotalConverted: roundCurrencyAmount(surchargeTotalConverted, targetCurrency),
    surchargeNettTotalInProductNative: roundCurrencyAmount(surchargeNettTotalInProductNative, productNativeCurrency),
    surchargeNettTotalConverted: roundCurrencyAmount(surchargeNettTotalConverted, targetCurrency),
    conflictWarnings,
    fxValid: true
  };
}

export interface SurchargeUsageInspection {
  surchargeId: string;
  surchargeCode: string;
  surchargeName: string;
  canDelete: boolean;
  isInUse: boolean;
  hasActiveProductMappings: boolean;
  reasons: string[];
  referencedQuotes: Array<{ id: string; quoteNumber: string; clientName?: string; status: string }>;
  referencedBookings: Array<{ id: string; bookingReference: string; leadTraveler?: string; status: string }>;
  linkedProducts: Array<{ id: string; sku?: string; name: string }>;
  activeMappingsCount: number;
  totalUsageCount: number;
}

/**
 * Inspects whether a centralized surcharge is in active operational use
 * across quotations, bookings, or active product mappings before permanent deletion.
 */
export function inspectSurchargeUsage(
  surcharge: SurchargeMaster,
  allQuotes: Quotation[] = [],
  allBookings: Booking[] = [],
  allProducts: Product[] = []
): SurchargeUsageInspection {
  const sid = surcharge.id;
  const scode = surcharge.surchargeCode || sid;
  const legacyId = surcharge.migratedFromLegacySurchargeId;

  // 1. Linked products
  const productMap = new Map<string, Product>();
  allProducts.forEach(p => productMap.set(p.id, p));

  const linkedIds = Array.isArray(surcharge.linkedProductIds) ? surcharge.linkedProductIds.filter(Boolean) : [];
  const linkedProducts: Array<{ id: string; sku?: string; name: string }> = [];
  linkedIds.forEach(pid => {
    const p = productMap.get(pid);
    if (p) {
      linkedProducts.push({ id: p.id, sku: p.sku, name: p.name });
    } else {
      linkedProducts.push({ id: pid, name: `Product (${pid})` });
    }
  });

  // 2. Check quotations
  const referencedQuotesMap = new Map<string, { id: string; quoteNumber: string; clientName?: string; status: string }>();

  const isMatchingSurcharge = (as: any) => {
    if (!as) return false;
    return (
      as.surchargeId === sid ||
      as.surchargeCode === scode ||
      (legacyId && (as.surchargeId === legacyId || as.surchargeCode === legacyId)) ||
      (as.name && as.name === surcharge.name)
    );
  };

  const isMatchingOverride = (ov: any) => {
    if (!ov) return false;
    return (
      ov.surchargeId === sid ||
      ov.surchargeCode === scode ||
      (legacyId && ov.surchargeId === legacyId)
    );
  };

  allQuotes.forEach(q => {
    if (!q || !q.id) return;
    let matches = false;

    // Check items
    if (Array.isArray(q.items)) {
      for (const item of q.items) {
        if (Array.isArray((item as any).appliedSurcharges) && (item as any).appliedSurcharges.some(isMatchingSurcharge)) {
          matches = true;
          break;
        }
      }
    }

    // Check currencyConversionSnapshot
    if (!matches && q.currencyConversionSnapshot) {
      if (
        Array.isArray(q.currencyConversionSnapshot.appliedSurcharges) &&
        q.currencyConversionSnapshot.appliedSurcharges.some(isMatchingSurcharge)
      ) {
        matches = true;
      }
      if (
        !matches &&
        Array.isArray((q.currencyConversionSnapshot as any).surchargeOverrides) &&
        (q.currencyConversionSnapshot as any).surchargeOverrides.some(isMatchingOverride)
      ) {
        matches = true;
      }
    }

    // Check quote surchargeOverrides
    if (!matches && Array.isArray(q.surchargeOverrides) && q.surchargeOverrides.some(isMatchingOverride)) {
      matches = true;
    }

    // Check versions if any
    if (!matches && Array.isArray((q as any).versions)) {
      for (const v of (q as any).versions) {
        if (Array.isArray(v.items)) {
          for (const item of v.items) {
            if (Array.isArray((item as any).appliedSurcharges) && (item as any).appliedSurcharges.some(isMatchingSurcharge)) {
              matches = true;
              break;
            }
          }
        }
        if (matches) break;
      }
    }

    if (matches) {
      referencedQuotesMap.set(q.id, {
        id: q.id,
        quoteNumber: q.quoteNumber || q.id,
        clientName: (q as any).clientName || (q as any).customerName || (q as any).title,
        status: q.status || 'DRAFT'
      });
    }
  });

  const referencedQuotes = Array.from(referencedQuotesMap.values());

  // 3. Check bookings
  const referencedBookingsMap = new Map<string, { id: string; bookingReference: string; leadTraveler?: string; status: string }>();

  allBookings.forEach(b => {
    if (!b || !b.id) return;
    let matches = false;

    if (Array.isArray((b as any).serviceItems)) {
      for (const item of (b as any).serviceItems) {
        if (Array.isArray(item.appliedSurcharges) && item.appliedSurcharges.some(isMatchingSurcharge)) {
          matches = true;
          break;
        }
      }
    }

    if (!matches && Array.isArray((b as any).items)) {
      for (const item of (b as any).items) {
        if (Array.isArray(item.appliedSurcharges) && item.appliedSurcharges.some(isMatchingSurcharge)) {
          matches = true;
          break;
        }
      }
    }

    if (!matches && Array.isArray((b as any).appliedSurcharges) && (b as any).appliedSurcharges.some(isMatchingSurcharge)) {
      matches = true;
    }

    // If booking was spawned from a referenced quote
    if (!matches && b.quoteId && referencedQuotesMap.has(b.quoteId)) {
      matches = true;
    }

    if (matches) {
      referencedBookingsMap.set(b.id, {
        id: b.id,
        bookingReference: b.bookingReference || (b as any).referenceNumber || b.id,
        leadTraveler: (b as any).leadTravelerName || (b as any).customerName || (b as any).clientName,
        status: b.status || 'CONFIRMED'
      });
    }
  });

  const referencedBookings = Array.from(referencedBookingsMap.values());

  const reasons: string[] = [];
  const hasActiveProductMappings = linkedProducts.length > 0 && (surcharge.status === 'ACTIVE' || surcharge.status === 'SCHEDULED');

  if (referencedQuotes.length > 0) {
    const quoteNums = referencedQuotes.slice(0, 3).map(q => q.quoteNumber).join(', ');
    const more = referencedQuotes.length > 3 ? ` (+${referencedQuotes.length - 3} more)` : '';
    reasons.push(
      `Referenced by ${referencedQuotes.length} quotation(s) [${quoteNums}${more}]. Deleting would invalidate historical quotation pricing snapshots.`
    );
  }

  if (referencedBookings.length > 0) {
    const bookingRefs = referencedBookings.slice(0, 3).map(b => b.bookingReference).join(', ');
    const more = referencedBookings.length > 3 ? ` (+${referencedBookings.length - 3} more)` : '';
    reasons.push(
      `Referenced by ${referencedBookings.length} booking(s) [${bookingRefs}${more}]. Operational booking records require financial audit integrity.`
    );
  }

  if (hasActiveProductMappings) {
    const prodNames = linkedProducts.slice(0, 3).map(p => p.name).join(', ');
    const more = linkedProducts.length > 3 ? ` (+${linkedProducts.length - 3} more)` : '';
    reasons.push(
      `Currently linked to ${linkedProducts.length} active product(s) [${prodNames}${more}]. Unlink products or set status to Inactive before deleting, or choose Archive instead.`
    );
  }

  const isInUse = referencedQuotes.length > 0 || referencedBookings.length > 0 || hasActiveProductMappings;
  const canDelete = !isInUse;

  return {
    surchargeId: sid,
    surchargeCode: scode,
    surchargeName: surcharge.name,
    canDelete,
    isInUse,
    hasActiveProductMappings,
    reasons,
    referencedQuotes,
    referencedBookings,
    linkedProducts,
    activeMappingsCount: linkedProducts.length,
    totalUsageCount: referencedQuotes.length + referencedBookings.length
  };
}

