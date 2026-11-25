import {
  Booking,
  BookingItem,
  CurrencyCode,
  Product,
  ServiceItemConfirmationStatus,
  SupplierAllocationStatus
} from '../types';
import { getLatestBookingPricingSnapshot, roundMoney } from './bookingManualDiscountEngine';

// ============================================================================
// AUTHORITATIVE BOOKING OPERATIONS SYNCHRONISATION & VALIDATION ENGINE
// Single Source of Truth for:
//   - Service Items <-> Supplier Allocation
//   - Activity Vouchers
//   - Complete Booking Vouchers
//   - Proforma Invoices (Final Booking Amount Only)
// ============================================================================

export type CanonicalAllocationStatus =
  | 'Pending Allocation'
  | 'Supplier Selected'
  | 'Sent to Supplier'
  | 'Awaiting Supplier Confirmation'
  | 'Supplier Confirmed'
  | 'Amendment Required'
  | 'Rejected by Supplier'
  | 'Cancelled'
  | 'Completed';

export const CANONICAL_ALLOCATION_STATUSES: CanonicalAllocationStatus[] = [
  'Pending Allocation',
  'Supplier Selected',
  'Sent to Supplier',
  'Awaiting Supplier Confirmation',
  'Supplier Confirmed',
  'Amendment Required',
  'Rejected by Supplier',
  'Cancelled',
  'Completed'
];

export interface HydratedBookingServiceItem extends BookingItem {
  // Resolved operational convenience fields (strictly authoritative, never fabricated)
  resolvedDescription: string;
  resolvedOverview: string;
  resolvedInclusions: string[];
  resolvedExclusions: string[];
  resolvedServiceDate: string;
  resolvedStartTime: string;
  resolvedEndTime: string;
  resolvedReportingTime: string;
  resolvedTicketDate: string;
  resolvedTicketEntryTime: string;
  resolvedPickupDate: string;
  resolvedPickupTime: string;
  resolvedReturnTime: string;
  resolvedTimeZone: string;
  resolvedMeetingPoint: string;
  resolvedAddress: string;
  resolvedGoogleMapsUrl: string;
  resolvedPickupLocation: string;
  resolvedDropoffLocation: string;
  resolvedImportantInstructions: string;
  resolvedPassengerBreakdown: string;
  resolvedCanonicalAllocationStatus: CanonicalAllocationStatus;
  isTransportService: boolean;
  isTicketedActivity: boolean;
  isAccommodationService: boolean;
  isConfirmedForVoucher: boolean;
  passengerValidationMismatch?: string;
}

export interface ServiceAmendmentDetectionResult {
  requiresReconfirmation: boolean;
  changedFields: string[];
  reason: string;
  affectsVouchers: boolean;
}

export interface VoucherCompletenessValidation {
  isReady: boolean;
  confirmedItems: HydratedBookingServiceItem[];
  pendingItems: HydratedBookingServiceItem[];
  cancelledItems: HydratedBookingServiceItem[];
  errors: string[];
  warnings: string[];
  itemDiagnostics: {
    itemId: string;
    productName: string;
    serviceDate: string;
    isConfirmed: boolean;
    missingFields: string[];
  }[];
}

export interface ChronologicalDayGroup {
  dayKey: string; // YYYY-MM-DD or 'UNSCHEDULED'
  dayNumber: number | null; // Computed strictly from actual travelStartDate / dated days; never invented
  displayDateLabel: string;
  items: HydratedBookingServiceItem[];
}

export interface AuthoritativeProformaFinancials {
  finalBookingAmount: number;
  currency: CurrencyCode;
  amountPaid: number;
  balanceDue: number;
  sourcePricingSnapshotId: string;
  sourcePricingSnapshotVersion: number;
  // Underlying financial components preserved internally (NEVER rendered separately on Proforma PDF)
  internalUnderlyingTaxTotal: number;
  internalUnderlyingServiceFeeTotal: number;
  internalUnderlyingDiscountTotal: number;
  internalUnderlyingSubtotal: number;
}

// ----------------------------------------------------------------------------
// 1. CATEGORY CLASSIFIERS
// ----------------------------------------------------------------------------

const TRANSPORT_KEYWORDS = [
  'transfer',
  'transport',
  'chauffeur',
  'airport',
  'charter',
  'car',
  'van',
  'coach',
  'bus',
  'limousine',
  'taxi',
  'pickup',
  'drop-off',
  'dropoff',
  'shuttle',
  'vehicle',
  'driver'
];

const TICKET_ACTIVITY_KEYWORDS = [
  'ticket',
  'attraction',
  'theme park',
  'museum',
  'observatory',
  'entry',
  'pass',
  'show',
  'experience',
  'activity',
  'excursion',
  'tour',
  'sightseeing',
  'cruise',
  'ferry',
  'rail',
  'train',
  'shinkansen',
  'teamlab',
  'disney',
  'universal',
  'aquarium',
  'cable car',
  'skytree'
];

const ACCOMMODATION_KEYWORDS = [
  'hotel',
  'resort',
  'villa',
  'ryokan',
  'accommodation',
  'stay',
  'room',
  'lodging',
  'apartment'
];

export function isTransportServiceCategory(item: Partial<BookingItem>): boolean {
  const cat = String(item.category || '').toLowerCase();
  const type = String(item.service_type || item.productType || item.itemType || '').toLowerCase();
  const name = String(item.productName || item.title || '').toLowerCase();
  const supType = String(item.supplierType || '').toLowerCase();

  if (supType === 'transport') return true;
  if (item.serviceTransferDetails && (item.serviceTransferDetails.vehicleType || item.serviceTransferDetails.pickupPoint)) {
    return true;
  }
  const combined = `${cat} ${type} ${name}`;
  // Exclude guided walking/museum ticket activities unless explicitly transport/transfer/chauffeur/charter
  if (TRANSPORT_KEYWORDS.some(kw => cat.includes(kw) || type.includes(kw))) {
    return true;
  }
  if (
    (name.includes('transfer') || name.includes('chauffeur') || name.includes('private car') || name.includes('airport pickup') || name.includes('airport drop')) &&
    !cat.includes('hotel') &&
    !cat.includes('visa')
  ) {
    return true;
  }
  return Boolean(item.vehicleType && (combined.includes('transfer') || combined.includes('transport') || combined.includes('chauffeur') || combined.includes('charter') || combined.includes('tour')));
}

export function isAccommodationServiceCategory(item: Partial<BookingItem>): boolean {
  if (item.isHotel || item.hotelId || item.serviceHotelDetails) return true;
  const combined = `${item.category || ''} ${item.service_type || ''} ${item.productType || ''} ${item.itemType || ''}`.toLowerCase();
  return ACCOMMODATION_KEYWORDS.some(kw => combined.includes(kw));
}

export function isTicketedActivityCategory(item: Partial<BookingItem>): boolean {
  if (isAccommodationServiceCategory(item)) return false;
  if (item.ticketDate || item.ticketEntryTime) return true;
  const cat = String(item.category || '').toLowerCase();
  const type = String(item.service_type || item.productType || item.itemType || '').toLowerCase();
  const name = String(item.productName || item.title || '').toLowerCase();
  const supType = String(item.supplierType || '').toLowerCase();

  if (supType === 'activity' || supType === 'ticket_partner' || supType === 'guide') return true;
  if (cat.includes('visa') || cat.includes('flight') || cat.includes('insurance')) return false;
  const combined = `${cat} ${type} ${name}`;
  return TICKET_ACTIVITY_KEYWORDS.some(kw => combined.includes(kw));
}

// ----------------------------------------------------------------------------
// 2. SAFE URL & TEXT HELPERS (NO FABRICATION)
// ----------------------------------------------------------------------------

export function sanitizeVerifiedGoogleMapsUrl(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';
    const host = parsed.hostname.toLowerCase();
    const isGoogleMaps =
      host === 'maps.google.com' ||
      host.endsWith('.google.com') ||
      host === 'goo.gl' ||
      host === 'maps.app.goo.gl' ||
      host === 'g.page';
    return isGoogleMaps ? trimmed : '';
  } catch {
    return '';
  }
}

export function cleanStringList(input: unknown): string[] {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input
      .map(v => (typeof v === 'string' ? v.trim() : ''))
      .filter(Boolean);
  }
  if (typeof input === 'string') {
    return input
      .split(/\r?\n|•|;/)
      .map(s => s.trim())
      .filter(Boolean);
  }
  return [];
}

function firstNonEmpty(...values: (string | undefined | null)[]): string {
  for (const val of values) {
    if (typeof val === 'string' && val.trim().length > 0) {
      return val.trim();
    }
  }
  return '';
}

// ----------------------------------------------------------------------------
// 3. CANONICAL SUPPLIER ALLOCATION STATUS MAPPING (9 UNIFIED STATUSES)
// ----------------------------------------------------------------------------

export function resolveCanonicalAllocationStatus(item: Partial<BookingItem>): CanonicalAllocationStatus {
  if (item.isCancelled || item.operationalStatus === 'Cancelled' || item.supplierConfirmationStatus === 'Cancelled' || item.supplierStatus === 'CANCELLED' || item.supplierAllocationStatus === 'Cancelled' || item.supplierAllocationStatus === 'Supplier Cancelled') {
    return 'Cancelled';
  }
  if (item.operationalStatus === 'Completed' || item.supplierConfirmationStatus === 'Completed' || item.supplierAllocationStatus === 'Completed' || item.workflowStage === 'COMPLETED') {
    return 'Completed';
  }
  if (
    item.supplierConfirmationStatus === 'Amendment Required' ||
    item.supplierConfirmationStatus === 'Supplier Reconfirmation Required' ||
    item.supplierConfirmationStatus === 'Reconfirmation Required' ||
    item.supplierAllocationStatus === 'Amendment Required' ||
    item.supplierAllocationStatus === 'Supplier Reconfirmation Required' ||
    item.supplierStatus === 'AMENDMENT_REQUESTED' ||
    item.operationalStatus === 'Supplier Reconfirmation Required'
  ) {
    return 'Amendment Required';
  }
  if (
    item.supplierStatus === 'REJECTED_BY_SUPPLIER' ||
    item.supplierConfirmationStatus === 'Rejected by Supplier' ||
    item.supplierAllocationStatus === 'Rejected by Supplier'
  ) {
    return 'Rejected by Supplier';
  }
  if (
    item.supplierConfirmationStatus === 'Confirmed' ||
    item.supplierStatus === 'CONFIRMED_BY_SUPPLIER' ||
    item.supplierAllocationStatus === 'Supplier Confirmed' ||
    item.operationalStatus === 'Confirmed'
  ) {
    return 'Supplier Confirmed';
  }
  if (
    item.supplierStatus === 'WAITING_FOR_SUPPLIER' ||
    item.supplierConfirmationStatus === 'Awaiting Supplier Confirmation' ||
    item.supplierConfirmationStatus === 'Confirmation Pending' ||
    item.supplierAllocationStatus === 'Awaiting Supplier Confirmation'
  ) {
    return 'Awaiting Supplier Confirmation';
  }
  if (
    item.supplierStatus === 'SENT_TO_SUPPLIER' ||
    item.supplierConfirmationStatus === 'Confirmation Requested' ||
    item.supplierAllocationStatus === 'Sent to Supplier'
  ) {
    return 'Sent to Supplier';
  }
  if (
    item.supplierId ||
    item.supplierName ||
    item.supplierAllocationStatus === 'Supplier Selected' ||
    item.supplierAllocationStatus === 'Allocated'
  ) {
    return 'Supplier Selected';
  }
  return 'Pending Allocation';
}

export function mapCanonicalAllocationStatusToItemFields(
  status: CanonicalAllocationStatus
): {
  supplierAllocationStatus: SupplierAllocationStatus;
  supplierConfirmationStatus: ServiceItemConfirmationStatus;
  supplierStatus: BookingItem['supplierStatus'];
  operationalStatus: BookingItem['operationalStatus'];
} {
  switch (status) {
    case 'Pending Allocation':
      return {
        supplierAllocationStatus: 'Pending Allocation',
        supplierConfirmationStatus: 'Supplier Not Allocated',
        supplierStatus: 'PENDING_DISPATCH',
        operationalStatus: 'Supplier Not Allocated'
      };
    case 'Supplier Selected':
      return {
        supplierAllocationStatus: 'Supplier Selected',
        supplierConfirmationStatus: 'Not Confirmed',
        supplierStatus: 'PENDING_DISPATCH',
        operationalStatus: 'Processing'
      };
    case 'Sent to Supplier':
      return {
        supplierAllocationStatus: 'Sent to Supplier',
        supplierConfirmationStatus: 'Confirmation Requested',
        supplierStatus: 'SENT_TO_SUPPLIER',
        operationalStatus: 'Confirmation Pending'
      };
    case 'Awaiting Supplier Confirmation':
      return {
        supplierAllocationStatus: 'Awaiting Supplier Confirmation',
        supplierConfirmationStatus: 'Confirmation Pending',
        supplierStatus: 'WAITING_FOR_SUPPLIER',
        operationalStatus: 'Confirmation Pending'
      };
    case 'Supplier Confirmed':
      return {
        supplierAllocationStatus: 'Supplier Confirmed',
        supplierConfirmationStatus: 'Confirmed',
        supplierStatus: 'CONFIRMED_BY_SUPPLIER',
        operationalStatus: 'Confirmed'
      };
    case 'Amendment Required':
      return {
        supplierAllocationStatus: 'Amendment Required',
        supplierConfirmationStatus: 'Supplier Reconfirmation Required',
        supplierStatus: 'AMENDMENT_REQUESTED',
        operationalStatus: 'Supplier Reconfirmation Required'
      };
    case 'Rejected by Supplier':
      return {
        supplierAllocationStatus: 'Rejected by Supplier',
        supplierConfirmationStatus: 'Rejected by Supplier',
        supplierStatus: 'REJECTED_BY_SUPPLIER',
        operationalStatus: 'Processing'
      };
    case 'Cancelled':
      return {
        supplierAllocationStatus: 'Cancelled',
        supplierConfirmationStatus: 'Cancelled',
        supplierStatus: 'CANCELLED',
        operationalStatus: 'Cancelled'
      };
    case 'Completed':
      return {
        supplierAllocationStatus: 'Completed',
        supplierConfirmationStatus: 'Confirmed',
        supplierStatus: 'CONFIRMED_BY_SUPPLIER',
        operationalStatus: 'Completed'
      };
  }
}

// ----------------------------------------------------------------------------
// 4. AUTHORITATIVE SERVICE ITEM HYDRATOR (SINGLE SOURCE OF TRUTH)
// ----------------------------------------------------------------------------

export function formatPassengerBreakdown(adults: number, children: number, infants: number): string {
  const parts: string[] = [];
  if (adults > 0) parts.push(`${adults} Adult${adults === 1 ? '' : 's'}`);
  if (children > 0) parts.push(`${children} Child${children === 1 ? '' : 'ren'}`);
  if (infants > 0) parts.push(`${infants} Infant${infants === 1 ? '' : 's'}`);
  if (parts.length === 0) return 'Passenger count not specified';
  return parts.join(', ');
}

export function hydrateBookingServiceItem(
  item: BookingItem,
  booking?: Booking | null,
  productRecord?: Product | null
): HydratedBookingServiceItem {
  const cfg = (item.configuration_snapshot || {}) as Record<string, any>;
  const bookingTravelers = (booking as any)?.travelers || (
    booking?.customer && (booking.customer.totalAdults !== undefined || booking.customer.totalChildren !== undefined)
      ? {
          adults: booking.customer.totalAdults || 0,
          children: booking.customer.totalChildren || 0,
          infants: booking.customer.totalInfants || 0
        }
      : undefined
  );

  // Authoritative passenger numbers: use item counts if explicitly present, else booking traveler counts (never fabricate "2")
  const hasExplicitPax =
    typeof item.adults === 'number' ||
    typeof item.children === 'number' ||
    typeof item.infants === 'number';

  const adults = hasExplicitPax
    ? Math.max(0, Number(item.adults || 0))
    : Math.max(0, Number(bookingTravelers?.adults ?? (typeof item.totalPax === 'number' ? item.totalPax : 0)));
  const children = hasExplicitPax
    ? Math.max(0, Number(item.children || 0))
    : Math.max(0, Number(bookingTravelers?.children ?? 0));
  const infants = hasExplicitPax
    ? Math.max(0, Number(item.infants || 0))
    : Math.max(0, Number(bookingTravelers?.infants ?? 0));

  const computedTotalPax = adults + children + infants;
  const totalPax = computedTotalPax > 0 ? computedTotalPax : Math.max(0, Number(item.totalPax || 0));

  // Validate passenger configuration against booking total (warning only, never silently overwrite)
  let passengerValidationMismatch: string | undefined;
  if (bookingTravelers) {
    const bookingTotal = (bookingTravelers.adults || 0) + (bookingTravelers.children || 0) + (bookingTravelers.infants || 0);
    if (bookingTotal > 0 && totalPax > bookingTotal) {
      passengerValidationMismatch = `Service PAX (${totalPax}) exceeds booking total (${bookingTotal}).`;
    }
  }

  // Category classification
  const isTransportService = isTransportServiceCategory(item);
  const isAccommodationService = isAccommodationServiceCategory(item);
  const isTicketedActivity = isTicketedActivityCategory(item);

  // Authoritative descriptions & overview (Item overrides -> Product master -> Empty, NEVER fabricated generic text)
  const resolvedDescription = firstNonEmpty(
    item.serviceDescription,
    cfg.serviceDescription,
    cfg.description,
    productRecord?.description,
    productRecord?.shortDescription
  );

  const productHighlights: string[] | undefined = (productRecord as any)?.highlights;
  const resolvedOverview = firstNonEmpty(
    item.serviceOverview,
    cfg.serviceOverview,
    cfg.overview,
    productRecord?.shortDescription,
    productHighlights?.length ? productHighlights.join(' • ') : ''
  );

  const resolvedInclusions = cleanStringList(
    item.inclusions?.length
      ? item.inclusions
      : cfg.inclusions?.length
      ? cfg.inclusions
      : productRecord?.inclusions
  );

  const resolvedExclusions = cleanStringList(
    item.exclusions?.length
      ? item.exclusions
      : cfg.exclusions?.length
      ? cfg.exclusions
      : productRecord?.exclusions
  );

  // Authoritative Date & Time (strictly from item/config, never invented "09:00 AM")
  const resolvedServiceDate = firstNonEmpty(
    item.serviceDate,
    item.travelDate,
    item.ticketDate,
    item.pickupDate,
    item.serviceHotelDetails?.checkInDate,
    booking?.travelStartDate
  );

  const resolvedStartTime = firstNonEmpty(
    item.startTime,
    item.serviceTime,
    cfg.startTime,
    cfg.serviceTime
  );
  const resolvedEndTime = firstNonEmpty(item.endTime, cfg.endTime);
  const resolvedReportingTime = firstNonEmpty(item.reportingTime, cfg.reportingTime);
  const resolvedTicketDate = firstNonEmpty(
    item.ticketDate,
    cfg.ticketDate,
    (item.ticketEntryTime || cfg.ticketEntryTime || cfg.entryTime) ? resolvedServiceDate : ''
  );
  const resolvedTicketEntryTime = firstNonEmpty(
    item.ticketEntryTime,
    cfg.ticketEntryTime,
    cfg.entryTime
  );
  const resolvedPickupDate = firstNonEmpty(
    item.pickupDate,
    cfg.pickupDate,
    isTransportService ? resolvedServiceDate : ''
  );
  const resolvedPickupTime = firstNonEmpty(
    item.pickupTime,
    item.serviceTransferDetails?.pickupTime,
    cfg.pickupTime,
    isTransportService ? resolvedStartTime : ''
  );
  const resolvedReturnTime = firstNonEmpty(item.returnTime, cfg.returnTime);
  const resolvedTimeZone = firstNonEmpty(item.timeZone, item.serviceTimezone, cfg.timeZone);

  // Meeting Point, Pickup, Dropoff, Address, Google Maps
  const resolvedMeetingPoint = firstNonEmpty(
    item.meetingPoint,
    item.serviceSightseeingDetails?.meetingPoint,
    cfg.meetingPoint,
    productRecord?.meetingPoint
  );
  const resolvedPickupLocation = firstNonEmpty(
    item.pickupLocation,
    item.serviceTransferDetails?.pickupPoint,
    cfg.pickupLocation,
    cfg.pickupPoint
  );
  const resolvedDropoffLocation = firstNonEmpty(
    item.dropoffLocation,
    item.serviceTransferDetails?.dropoffPoint,
    cfg.dropoffLocation,
    cfg.dropoffPoint
  );
  const resolvedAddress = firstNonEmpty(
    item.address,
    cfg.address,
    item.manualHotelDetails?.address,
    productRecord?.location
  );
  const resolvedGoogleMapsUrl = sanitizeVerifiedGoogleMapsUrl(
    firstNonEmpty(item.googleMapsUrl, cfg.googleMapsUrl, (productRecord as any)?.googleMapsUrl)
  );

  const resolvedImportantInstructions = firstNonEmpty(
    item.importantInstructions,
    item.customerFacingNotes,
    item.operationalInstructions,
    cfg.importantInstructions,
    (productRecord as any)?.importantNotes
  );

  // Vehicle Config (STRICTLY populated ONLY for transport/transfer services so non-transport services never leak vehicle blocks)
  const vehicleType = isTransportService
    ? firstNonEmpty(item.vehicleType, item.serviceTransferDetails?.vehicleType, item.vehicle, cfg.vehicleType, cfg.vehicle)
    : undefined;
  const vehicleCategory = isTransportService
    ? firstNonEmpty(item.vehicleCategory, cfg.vehicleCategory)
    : undefined;
  const vehicleSeaterCapacity = isTransportService
    ? (item.vehicleSeaterCapacity ?? item.passengerCapacity ?? cfg.vehicleSeaterCapacity ?? cfg.passengerCapacity)
    : undefined;
  const vehicleCount = isTransportService
    ? (item.vehicleCount ?? cfg.vehicleCount ?? (vehicleType ? 1 : undefined))
    : undefined;
  const luggageCapacity = isTransportService
    ? firstNonEmpty(item.luggageCapacity, cfg.luggageCapacity)
    : undefined;
  const routeDetails = isTransportService
    ? firstNonEmpty(item.routeDetails, cfg.routeDetails)
    : undefined;

  // Authoritative Pricing Snapshot link
  const latestSnapshot = booking ? getLatestBookingPricingSnapshot(booking) : null;
  const pricingSnapshotId = item.pricingSnapshotId || latestSnapshot?.snapshotId;
  const pricingSnapshotVersion = item.pricingSnapshotVersion || latestSnapshot?.version;

  const resolvedCanonicalAllocationStatus = resolveCanonicalAllocationStatus(item);
  const isConfirmedForVoucher =
    !item.isCancelled &&
    (resolvedCanonicalAllocationStatus === 'Supplier Confirmed' || resolvedCanonicalAllocationStatus === 'Completed');

  const resolvedPassengerBreakdown =
    firstNonEmpty(item.passengerBreakdown) || formatPassengerBreakdown(adults, children, infants);

  return {
    ...item,
    adults,
    children,
    infants,
    totalPax,
    serviceDate: resolvedServiceDate || item.serviceDate,
    travelDate: resolvedServiceDate || item.travelDate,
    serviceTime: resolvedStartTime || item.serviceTime,
    serviceDescription: resolvedDescription || item.serviceDescription,
    serviceOverview: resolvedOverview || item.serviceOverview,
    inclusions: resolvedInclusions,
    exclusions: resolvedExclusions,
    meetingPoint: resolvedMeetingPoint || item.meetingPoint,
    address: resolvedAddress || item.address,
    googleMapsUrl: resolvedGoogleMapsUrl || undefined,
    pickupLocation: resolvedPickupLocation || item.pickupLocation,
    dropoffLocation: resolvedDropoffLocation || item.dropoffLocation,
    importantInstructions: resolvedImportantInstructions || item.importantInstructions,
    startTime: resolvedStartTime || undefined,
    endTime: resolvedEndTime || undefined,
    reportingTime: resolvedReportingTime || undefined,
    ticketDate: resolvedTicketDate || undefined,
    ticketEntryTime: resolvedTicketEntryTime || undefined,
    pickupDate: resolvedPickupDate || undefined,
    pickupTime: resolvedPickupTime || undefined,
    returnTime: resolvedReturnTime || undefined,
    timeZone: resolvedTimeZone || undefined,
    passengerBreakdown: resolvedPassengerBreakdown,
    vehicleType,
    vehicleCategory,
    vehicleSeaterCapacity,
    vehicleCount,
    luggageCapacity,
    routeDetails,
    pricingSnapshotId,
    pricingSnapshotVersion,
    // Hydrated helper properties
    resolvedDescription,
    resolvedOverview,
    resolvedInclusions,
    resolvedExclusions,
    resolvedServiceDate,
    resolvedStartTime,
    resolvedEndTime,
    resolvedReportingTime,
    resolvedTicketDate,
    resolvedTicketEntryTime,
    resolvedPickupDate,
    resolvedPickupTime,
    resolvedReturnTime,
    resolvedTimeZone,
    resolvedMeetingPoint,
    resolvedAddress,
    resolvedGoogleMapsUrl,
    resolvedPickupLocation,
    resolvedDropoffLocation,
    resolvedImportantInstructions,
    resolvedPassengerBreakdown,
    resolvedCanonicalAllocationStatus,
    isTransportService,
    isTicketedActivity,
    isAccommodationService,
    isConfirmedForVoucher,
    passengerValidationMismatch
  };
}

// ----------------------------------------------------------------------------
// 5. CONFIRMED SERVICE AMENDMENT DETECTOR
// Requirement Section 3.4:
//   If service date, passenger count, vehicle type, or ticket time changes after
//   supplier confirmation -> flag allocation for operational review ("Amendment Required")
//   and mark affected vouchers outdated WITHOUT silently overwriting confirmation records.
// ----------------------------------------------------------------------------

export function detectConfirmedServiceAmendment(
  previousItem: BookingItem,
  updates: Partial<BookingItem>
): ServiceAmendmentDetectionResult {
  const prevStatus = resolveCanonicalAllocationStatus(previousItem);
  const wasConfirmed = prevStatus === 'Supplier Confirmed' || prevStatus === 'Completed';

  const changedFields: string[] = [];

  const checkDiff = (label: string, oldVal: unknown, newVal: unknown) => {
    if (newVal === undefined) return;
    const normOld = String(oldVal ?? '').trim();
    const normNew = String(newVal ?? '').trim();
    if (normOld !== normNew) {
      changedFields.push(`${label} (${normOld || 'unset'} -> ${normNew || 'unset'})`);
    }
  };

  checkDiff('Service Date', previousItem.serviceDate || previousItem.travelDate, updates.serviceDate ?? updates.travelDate);
  checkDiff('Service Time', previousItem.startTime || previousItem.serviceTime, updates.startTime ?? updates.serviceTime);
  checkDiff('Ticket Date', previousItem.ticketDate, updates.ticketDate);
  checkDiff('Ticket Entry Time', previousItem.ticketEntryTime, updates.ticketEntryTime);
  checkDiff('Pickup Time', previousItem.pickupTime, updates.pickupTime);
  checkDiff('Pickup Location', previousItem.pickupLocation, updates.pickupLocation);
  checkDiff('Drop-off Location', previousItem.dropoffLocation, updates.dropoffLocation);
  checkDiff('Meeting Point', previousItem.meetingPoint, updates.meetingPoint);
  checkDiff('Adults', previousItem.adults, updates.adults);
  checkDiff('Children', previousItem.children, updates.children);
  checkDiff('Infants', previousItem.infants, updates.infants);
  checkDiff('Total PAX', previousItem.totalPax, updates.totalPax);
  checkDiff('Vehicle Type', previousItem.vehicleType || previousItem.vehicle, updates.vehicleType ?? updates.vehicle);
  checkDiff('Vehicle Capacity', previousItem.vehicleSeaterCapacity, updates.vehicleSeaterCapacity);
  checkDiff('Vehicle Count', previousItem.vehicleCount, updates.vehicleCount);

  if (updates.supplierId !== undefined && (previousItem.supplierId || '') !== (updates.supplierId || '')) {
    changedFields.push(`Supplier (${previousItem.supplierName || 'None'} -> ${updates.supplierName || 'None'})`);
  }
  if (updates.supplierPrice !== undefined && previousItem.supplierPrice !== updates.supplierPrice) {
    changedFields.push(`Supplier Rate (${previousItem.supplierPrice ?? 'unset'} -> ${updates.supplierPrice})`);
  }

  // Operational fields that affect voucher text even if not confirmed yet
  const voucherDisplayChanged =
    changedFields.length > 0 ||
    (updates.serviceDescription !== undefined && (updates.serviceDescription || '') !== (previousItem.serviceDescription || '')) ||
    (updates.serviceOverview !== undefined && (updates.serviceOverview || '') !== (previousItem.serviceOverview || '')) ||
    (updates.importantInstructions !== undefined && (updates.importantInstructions || '') !== (previousItem.importantInstructions || '')) ||
    (updates.supplierConfirmationRef !== undefined && (updates.supplierConfirmationRef || '') !== (previousItem.supplierConfirmationRef || ''));

  const requiresReconfirmation = wasConfirmed && changedFields.length > 0;

  return {
    requiresReconfirmation,
    changedFields,
    reason: requiresReconfirmation
      ? `Confirmed service amended (${changedFields.join('; ')}). Supplier reconfirmation required.`
      : changedFields.length > 0
      ? `Service details updated (${changedFields.join('; ')}).`
      : '',
    affectsVouchers: voucherDisplayChanged
  };
}

// ----------------------------------------------------------------------------
// 6. CHRONOLOGICAL ORDERING & DAY-WISE GROUPING (COMPLETE VOUCHER)
// Requirement Section 5.4:
//   Sort strictly by actual service date & time. Never by creation order.
//   Never invent day numbers if dates are absent.
// ----------------------------------------------------------------------------

function parseTimeToMinutes(timeStr?: string): number {
  if (!timeStr) return 9999; // Unspecified times sort after scheduled times on the same date
  const cleaned = timeStr.trim().toUpperCase();
  const match = cleaned.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?/);
  if (!match) return 9999;
  let hours = parseInt(match[1], 10);
  const mins = parseInt(match[2], 10);
  const meridiem = match[3];
  if (meridiem === 'PM' && hours < 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;
  return hours * 60 + mins;
}

function getEffectiveSortDate(item: HydratedBookingServiceItem): string {
  return item.resolvedServiceDate || item.resolvedTicketDate || item.resolvedPickupDate || '';
}

function getEffectiveSortTime(item: HydratedBookingServiceItem): string {
  return (
    item.resolvedTicketEntryTime ||
    item.resolvedPickupTime ||
    item.resolvedStartTime ||
    item.resolvedReportingTime ||
    ''
  );
}

export function sortBookingItemsChronologically(
  items: HydratedBookingServiceItem[]
): HydratedBookingServiceItem[] {
  return [...items].sort((a, b) => {
    const dateA = getEffectiveSortDate(a);
    const dateB = getEffectiveSortDate(b);

    if (dateA && dateB && dateA !== dateB) {
      return dateA.localeCompare(dateB);
    }
    if (dateA && !dateB) return -1;
    if (!dateA && dateB) return 1;

    const timeA = parseTimeToMinutes(getEffectiveSortTime(a));
    const timeB = parseTimeToMinutes(getEffectiveSortTime(b));
    if (timeA !== timeB) return timeA - timeB;

    return (a.productName || '').localeCompare(b.productName || '');
  });
}

export function formatReadableDate(isoDate?: string): string {
  if (!isoDate) return 'Date Pending Confirmation';
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return isoDate;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const day = parseInt(match[3], 10);
  const d = new Date(Date.UTC(year, month, day));
  if (isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  });
}

export function groupBookingItemsByDay(
  items: HydratedBookingServiceItem[],
  travelStartDate?: string
): ChronologicalDayGroup[] {
  const sorted = sortBookingItemsChronologically(items);
  const groupMap = new Map<string, HydratedBookingServiceItem[]>();

  for (const it of sorted) {
    const rawDate = getEffectiveSortDate(it);
    const key = rawDate && /^\d{4}-\d{2}-\d{2}/.test(rawDate) ? rawDate.slice(0, 10) : 'UNSCHEDULED';
    const existing = groupMap.get(key) || [];
    existing.push(it);
    groupMap.set(key, existing);
  }

  // Determine anchor start date strictly from booking.travelStartDate or earliest real dated service
  const datedKeys = Array.from(groupMap.keys())
    .filter(k => k !== 'UNSCHEDULED')
    .sort();

  const anchorDateStr =
    travelStartDate && /^\d{4}-\d{2}-\d{2}/.test(travelStartDate)
      ? travelStartDate.slice(0, 10)
      : datedKeys[0] || '';

  const anchorMs = anchorDateStr ? Date.parse(`${anchorDateStr}T00:00:00Z`) : NaN;

  const groups: ChronologicalDayGroup[] = [];
  for (const key of [...datedKeys, ...(groupMap.has('UNSCHEDULED') ? ['UNSCHEDULED'] : [])]) {
    const list = groupMap.get(key) || [];
    let dayNumber: number | null = null;
    if (key !== 'UNSCHEDULED' && !Number.isNaN(anchorMs)) {
      const currentMs = Date.parse(`${key}T00:00:00Z`);
      if (!Number.isNaN(currentMs)) {
        const diffDays = Math.floor((currentMs - anchorMs) / (1000 * 60 * 60 * 24));
        dayNumber = diffDays >= 0 ? diffDays + 1 : 1;
      }
    }
    groups.push({
      dayKey: key,
      dayNumber,
      displayDateLabel: key === 'UNSCHEDULED' ? 'Date To Be Confirmed' : formatReadableDate(key),
      items: list
    });
  }

  return groups;
}

// ----------------------------------------------------------------------------
// 7. PRE-GENERATION VOUCHER COMPLETENESS VALIDATORS
// ----------------------------------------------------------------------------

function inspectSingleItemCompleteness(item: HydratedBookingServiceItem): string[] {
  const missing: string[] = [];
  if (!item.resolvedServiceDate) missing.push('Service Date');
  if (item.totalPax <= 0) missing.push('Passenger Count');
  if (!item.resolvedDescription && !item.resolvedOverview) missing.push('Service Description / Overview');

  if (item.isTransportService) {
    if (!item.vehicleType) missing.push('Vehicle Type');
    if (!item.resolvedPickupLocation) missing.push('Pickup Location');
    if (!item.resolvedDropoffLocation) missing.push('Drop-off Location');
    if (!item.resolvedPickupTime) missing.push('Pickup Time');
  } else if (item.isTicketedActivity) {
    if (!item.resolvedTicketEntryTime && !item.resolvedStartTime) missing.push('Ticket / Service Entry Time');
    if (!item.resolvedMeetingPoint && !item.resolvedAddress) missing.push('Meeting Point / Venue Address');
  }

  if (!item.supplierName) missing.push('Allocated Supplier');
  if (item.isConfirmedForVoucher && !item.supplierConfirmationRef) {
    missing.push('Supplier Confirmation Reference');
  }

  return missing;
}

export function validateActivityVoucherReadiness(
  item: HydratedBookingServiceItem
): {
  canGenerate: boolean;
  errors: string[];
  warnings: string[];
  missingFields: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const missingFields = inspectSingleItemCompleteness(item);

  if (item.isCancelled) {
    errors.push('Cannot generate an Activity Voucher for a cancelled service item.');
  }
  if (!item.productName?.trim()) {
    errors.push('Service name is missing.');
  }
  if (!item.isConfirmedForVoucher) {
    warnings.push(
      `Supplier status is "${item.resolvedCanonicalAllocationStatus}" (not yet confirmed). Voucher will display current status without fabricating a confirmation.`
    );
  }
  if (missingFields.length > 0) {
    warnings.push(`Incomplete operational fields: ${missingFields.join(', ')}.`);
  }
  if (item.passengerValidationMismatch) {
    warnings.push(item.passengerValidationMismatch);
  }

  return {
    canGenerate: errors.length === 0,
    errors,
    warnings,
    missingFields
  };
}

export function validateCompleteVoucherReadiness(
  booking: Booking,
  hydratedItems: HydratedBookingServiceItem[]
): VoucherCompletenessValidation {
  const activeItems = hydratedItems.filter(it => !it.isCancelled);
  const cancelledItems = hydratedItems.filter(it => it.isCancelled);
  const confirmedItems = sortBookingItemsChronologically(activeItems.filter(it => it.isConfirmedForVoucher));
  const pendingItems = sortBookingItemsChronologically(activeItems.filter(it => !it.isConfirmedForVoucher));

  const errors: string[] = [];
  const warnings: string[] = [];
  const itemDiagnostics: VoucherCompletenessValidation['itemDiagnostics'] = [];

  if (activeItems.length === 0) {
    errors.push('Booking has no active service items to include in a Complete Booking Voucher.');
  }

  if (!booking.customer?.leadTravelerName && !booking.customer?.name) {
    warnings.push('Lead traveller full name is missing on the booking master record.');
  }
  if (!booking.travelStartDate || !booking.travelEndDate) {
    warnings.push('Booking travel start/end dates are incomplete.');
  }

  if (pendingItems.length > 0) {
    warnings.push(
      `${pendingItems.length} active service(s) are not yet Supplier Confirmed (${pendingItems
        .map(p => `${p.productName} [${p.resolvedCanonicalAllocationStatus}]`)
        .join(', ')}). They will be clearly separated as Pending Confirmation and never marked confirmed.`
    );
  }

  for (const it of activeItems) {
    const missing = inspectSingleItemCompleteness(it);
    itemDiagnostics.push({
      itemId: it.id,
      productName: it.productName,
      serviceDate: it.resolvedServiceDate || 'Pending Date',
      isConfirmed: it.isConfirmedForVoucher,
      missingFields: missing
    });
    if (missing.length > 0) {
      warnings.push(`${it.productName}: missing ${missing.join(', ')}.`);
    }
  }

  return {
    isReady: errors.length === 0,
    confirmedItems,
    pendingItems,
    cancelledItems,
    errors,
    warnings,
    itemDiagnostics
  };
}

// ----------------------------------------------------------------------------
// 8. AUTHORITATIVE PROFORMA INVOICE FINANCIAL RESOLVER
// Requirement Section 6:
//   - Source Final Booking Amount strictly from the latest committed BookingPricingSnapshot
//   - Display ONLY Final Booking Amount (NO Tax / GST / Service Fee lines)
//   - Preserve underlying tax/fee components internally without modifying or removing them
// ----------------------------------------------------------------------------

export function resolveAuthoritativeProformaAmount(booking: Booking): AuthoritativeProformaFinancials {
  const latestSnapshot = getLatestBookingPricingSnapshot(booking);
  const currency: CurrencyCode = (latestSnapshot.currency || booking.currency || 'USD') as CurrencyCode;

  // Authoritative Final Booking Amount after all committed B2B promos & Admin Manual Discounts
  const finalBookingAmount = roundMoney(
    Math.max(
      0,
      typeof latestSnapshot.revisedCustomerSellingPrice === 'number' && latestSnapshot.revisedCustomerSellingPrice >= 0
        ? latestSnapshot.revisedCustomerSellingPrice
        : booking.finalCustomerSellingPrice ?? booking.totalAmount ?? 0
    )
  );

  const amountPaid = roundMoney(Math.max(0, Number((booking as any).paidAmount ?? (booking as any).amountPaid ?? 0)));
  const balanceDue = roundMoney(Math.max(0, finalBookingAmount - amountPaid));

  // Preserve underlying internal components in the database record (never displayed on Proforma PDF)
  const internalUnderlyingTaxTotal = roundMoney(Math.max(0, Number((booking as any).taxAmount || (booking as any).taxTotal || 0)));
  const internalUnderlyingServiceFeeTotal = roundMoney(Math.max(0, Number((booking as any).serviceFeeTotal || (booking as any).serviceFee || 0)));
  const internalUnderlyingDiscountTotal = roundMoney(
    Math.max(0, (latestSnapshot.b2bPromotionDiscountAmount || 0) + (latestSnapshot.cumulativeAdminManualDiscount || 0))
  );
  const internalUnderlyingSubtotal = roundMoney(
    Math.max(0, finalBookingAmount - internalUnderlyingTaxTotal - internalUnderlyingServiceFeeTotal)
  );

  return {
    finalBookingAmount,
    currency,
    amountPaid,
    balanceDue,
    sourcePricingSnapshotId: latestSnapshot.snapshotId || latestSnapshot.id,
    sourcePricingSnapshotVersion: latestSnapshot.version || 1,
    internalUnderlyingTaxTotal,
    internalUnderlyingServiceFeeTotal,
    internalUnderlyingDiscountTotal,
    internalUnderlyingSubtotal
  };
}

// ----------------------------------------------------------------------------
// 9. DETERMINISTIC IDEMPOTENCY KEY HELPER
// ----------------------------------------------------------------------------

export function buildDocumentIdempotencyKey(
  docType: 'ACTIVITY_VOUCHER' | 'COMPLETE_VOUCHER' | 'PROFORMA_INVOICE',
  bookingId: string,
  versionOrScope: string
): string {
  return `${docType}::${bookingId}::${versionOrScope}`;
}
