import { QuoteItem, TripRouteHub } from '../types';

/**
 * Authoritative identifier helpers for multi-occurrence / repeated hubs in B2B Quotations.
 *
 * `hub.hubId` identifies the master destination city/hub (e.g., "hub-tokyo"), which MAY appear
 * multiple times in the same itinerary (e.g., Tokyo -> Osaka -> Kyoto -> Tokyo -> Osaka -> Tokyo).
 * `hub.itineraryHubOccurrenceId || hub.id` identifies ONE specific stop/occurrence in the itinerary.
 * `hub.accommodationStayId` identifies the specific accommodation stay linked to that occurrence.
 */

export function getHubOccurrenceId(hub?: Partial<TripRouteHub> | null): string {
  if (!hub) return '';
  return String(hub.itineraryHubOccurrenceId || hub.id || '').trim();
}

export function getItemOccurrenceId(item?: Partial<QuoteItem> | null): string | undefined {
  if (!item) return undefined;
  const candidate =
    item.itineraryHubOccurrenceId ||
    item.hubId ||
    item.manualHotelDetails?.itineraryHubOccurrenceId ||
    item.manualHotelDetails?.hubId ||
    (item.metadata as any)?.itineraryHubOccurrenceId ||
    (item.metadata as any)?.hubId;
  const trimmed = candidate ? String(candidate).trim() : '';
  return trimmed || undefined;
}

export function generateAccommodationStayId(occurrenceId: string): string {
  const safePrefix = (occurrenceId || 'hub').replace(/[^a-zA-Z0-9_-]/g, '');
  return `stay-${safePrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function isHotelLikeQuoteItem(item?: Partial<QuoteItem> | null): boolean {
  if (!item) return false;
  const prod = item.product as any;
  const cat = String(prod?.category || item.category || '').toLowerCase();
  const pType = String(prod?.productType || (item as any).service_type || '').toLowerCase();
  return Boolean(
    cat.includes('hotel') ||
    cat.includes('accommodation') ||
    cat.includes('resort') ||
    cat.includes('ryokan') ||
    pType === 'hotel' ||
    pType === 'hotel & resort' ||
    pType.includes('hotel') ||
    item.isManualHotel === true ||
    prod?.accommodationType === 'manual' ||
    Boolean(item.manualHotelDetails) ||
    Boolean(item.hotelId) ||
    Boolean((item as any).hotelDetails)
  );
}

export function countHubCityOccurrences(hubs: TripRouteHub[] = []): Map<string, number> {
  const counts = new Map<string, number>();
  for (const h of hubs) {
    const key = String(h.hubId || h.hubName || '').trim().toLowerCase();
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

export function getHubCityOccurrenceIndex(hub: TripRouteHub, allHubs: TripRouteHub[] = []): { occurrenceNumber: number; totalInCity: number } {
  const targetKey = String(hub.hubId || hub.hubName || '').trim().toLowerCase();
  const hubOccId = getHubOccurrenceId(hub);
  const matching = allHubs.filter(h => String(h.hubId || h.hubName || '').trim().toLowerCase() === targetKey);
  if (matching.length === 0) return { occurrenceNumber: 1, totalInCity: 1 };
  const idx = matching.findIndex(h => getHubOccurrenceId(h) === hubOccId || h.id === hub.id);
  return {
    occurrenceNumber: idx >= 0 ? idx + 1 : 1,
    totalInCity: matching.length
  };
}

/**
 * Strictly determines whether a hotel QuoteItem belongs to a specific itinerary hub occurrence.
 * Never allows cross-contamination between repeated occurrences of the same city hub.
 */
export function doesHotelItemBelongToHubOccurrence(
  item: Partial<QuoteItem>,
  hub: TripRouteHub,
  allHubs: TripRouteHub[] = []
): boolean {
  if (!isHotelLikeQuoteItem(item) || !hub) return false;

  const hubOccId = getHubOccurrenceId(hub);
  const itemStayId = item.accommodationStayId || item.manualHotelDetails?.accommodationStayId || (item.metadata as any)?.accommodationStayId;
  const hubStayId = hub.accommodationStayId;

  // 1. Direct accommodationStayId match takes highest precedence
  if (itemStayId && hubStayId) {
    return itemStayId === hubStayId;
  }

  // 2. Direct occurrence/hub instance ID check
  const itemOccId = getItemOccurrenceId(item);
  if (itemOccId) {
    return itemOccId === hubOccId || (Boolean(hub.id) && itemOccId === hub.id);
  }

  // 3. Legacy untagged item fallback (ONLY when item has NO occurrence/hub ID at all)
  const cityKey = String(hub.hubId || hub.hubName || '').trim().toLowerCase();
  const sameCityCount = allHubs.filter(
    h => String(h.hubId || h.hubName || '').trim().toLowerCase() === cityKey
  ).length;

  // If the city appears multiple times in this itinerary, only allow matching if the hub has a unique hotelId+dates signature
  if (sameCityCount > 1) {
    const matchingHotelOccurrences = allHubs.filter(h =>
      Boolean(hub.hotelId) &&
      h.hotelId === hub.hotelId &&
      Boolean(item.product?.id?.includes(hub.hotelId!) || item.hotelId === hub.hotelId)
    );
    if (matchingHotelOccurrences.length === 1 && matchingHotelOccurrences[0].id === hub.id) {
      return true;
    }
    if (hub.checkInDate && (item.checkInDate || item.travelDate)) {
      const itemDate = item.checkInDate || item.travelDate;
      if (
        itemDate === hub.checkInDate &&
        ((hub.hotelId && (item.hotelId === hub.hotelId || item.product?.id?.includes(hub.hotelId))) ||
          (hub.manualHotel?.hotelName && item.product?.name?.toLowerCase().includes(hub.manualHotel.hotelName.toLowerCase())))
      ) {
        return true;
      }
    }
    return false;
  }

  // Single occurrence of this city in legacy untagged quote: safe legacy fallback
  if (hub.hotelId && (item.hotelId === hub.hotelId || item.product?.id?.includes(hub.hotelId))) {
    return true;
  }
  if (hub.manualHotel?.hotelName && item.product?.name?.toLowerCase().includes(hub.manualHotel.hotelName.toLowerCase())) {
    return true;
  }
  if (hub.hubName && item.notes && item.notes.toLowerCase().includes(hub.hubName.toLowerCase())) {
    return true;
  }
  if (hub.hubName && (item.manualHotelDetails?.city || item.product?.city || '').toLowerCase() === hub.hubName.toLowerCase()) {
    return true;
  }
  return false;
}

/**
 * Determines whether a hotel QuoteItem should be excluded because of LAND_ONLY scope
 * or because its assigned hub occurrence is marked NO_ACCOMMODATION.
 * Safe for repeated hubs where Stay 1 (Tokyo) has a hotel and Stay 4 (Tokyo) is NO_ACCOMMODATION.
 */
export function shouldExcludeHotelItemByNoAccommodation(
  item: Partial<QuoteItem>,
  hubs: TripRouteHub[] = [],
  isLandOnly: boolean = false
): boolean {
  if (!isHotelLikeQuoteItem(item)) return false;
  if (
    isLandOnly ||
    item.isNoAccommodation ||
    (item as any).accommodationType === 'NO_ACCOMMODATION' ||
    (item as any).accommodationType === 'none'
  ) {
    return true;
  }

  const isHubNoAcc = (h?: TripRouteHub | null): boolean =>
    Boolean(h && (h.accommodationType === 'NO_ACCOMMODATION' || h.accommodationType === 'none'));

  const itemOccId = getItemOccurrenceId(item);
  if (itemOccId) {
    const matchedHub = hubs.find(h => getHubOccurrenceId(h) === itemOccId || h.id === itemOccId);
    if (matchedHub) {
      return isHubNoAcc(matchedHub);
    }
    // Item is explicitly bound to an occurrence ID not marked NO_ACCOMMODATION
    return false;
  }

  // Legacy item without occurrence ID: only exclude by city if ALL hubs for that city are NO_ACCOMMODATION
  const itemCity = (item.manualHotelDetails?.city || item.product?.city || '').trim().toLowerCase();
  if (!itemCity) return false;
  const hubsForCity = hubs.filter(h => (h.hubName || '').trim().toLowerCase() === itemCity);
  if (hubsForCity.length === 0) return false;
  return hubsForCity.every(isHubNoAcc);
}

export interface ComputedHubDates {
  checkInIso: string;
  checkOutIso: string;
  checkInFormatted: string;
  checkOutFormatted: string;
  nights: number;
  isCustomDates: boolean;
}

export function computeStayDatesForHub(
  routeHubs: TripRouteHub[],
  hubIdOrOrder: string | number,
  tripStartDate?: string,
  overrideNights?: number
): ComputedHubDates {
  const sorted = [...routeHubs].sort((a, b) => (a.order || 0) - (b.order || 0));
  const targetIdx =
    typeof hubIdOrOrder === 'string'
      ? sorted.findIndex(h => getHubOccurrenceId(h) === hubIdOrOrder || h.id === hubIdOrOrder)
      : sorted.findIndex(h => h.order === hubIdOrOrder);

  const resolvedIdx = targetIdx >= 0 ? targetIdx : (typeof hubIdOrOrder === 'number' ? Math.max(0, hubIdOrOrder - 1) : 0);
  const targetHub = sorted[resolvedIdx];
  const nights = Math.max(1, overrideNights ?? targetHub?.nights ?? 1);

  // Use explicit per-stay custom dates if valid on this occurrence
  if (targetHub?.checkInDate && targetHub?.checkOutDate) {
    const ci = new Date(targetHub.checkInDate);
    const co = new Date(targetHub.checkOutDate);
    if (!isNaN(ci.getTime()) && !isNaN(co.getTime())) {
      const diffNights = Math.max(1, Math.round((co.getTime() - ci.getTime()) / (1000 * 60 * 60 * 24)));
      return {
        checkInIso: targetHub.checkInDate,
        checkOutIso: targetHub.checkOutDate,
        checkInFormatted: ci.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        checkOutFormatted: co.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        nights: overrideNights ?? targetHub.nights ?? diffNights,
        isCustomDates: true
      };
    }
  }

  let accumulated = 0;
  for (let i = 0; i < resolvedIdx; i++) {
    accumulated += Math.max(1, sorted[i]?.nights || 1);
  }

  const baseStart = tripStartDate ? new Date(tripStartDate) : new Date();
  const validBase = isNaN(baseStart.getTime()) ? new Date() : baseStart;
  const checkInDate = new Date(validBase);
  checkInDate.setDate(checkInDate.getDate() + accumulated);
  const checkInIso = checkInDate.toISOString().split('T')[0];

  const checkOutDate = new Date(checkInDate);
  checkOutDate.setDate(checkOutDate.getDate() + nights);
  const checkOutIso = checkOutDate.toISOString().split('T')[0];

  return {
    checkInIso,
    checkOutIso,
    checkInFormatted: checkInDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    checkOutFormatted: checkOutDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    nights,
    isCustomDates: false
  };
}

export interface StayDateValidationIssue {
  hubOccurrenceId: string;
  stayIndex: number;
  hubName: string;
  severity: 'ERROR' | 'WARNING';
  message: string;
}

/**
 * Validates check-in/check-out dates per individual stay occurrence and reports stay-specific
 * errors (never blanket city errors). Back-to-back checkout === next check-in is valid.
 */
export function validateHubStayDates(routeHubs: TripRouteHub[], tripStartDate?: string): StayDateValidationIssue[] {
  const sorted = [...routeHubs].sort((a, b) => (a.order || 0) - (b.order || 0));
  const issues: StayDateValidationIssue[] = [];
  const ranges: Array<{ idx: number; hub: TripRouteHub; startMs: number; endMs: number; checkInIso: string; checkOutIso: string }> = [];

  sorted.forEach((hub, idx) => {
    const occId = getHubOccurrenceId(hub);
    const dates = computeStayDatesForHub(sorted, occId, tripStartDate);
    const startMs = new Date(dates.checkInIso).getTime();
    const endMs = new Date(dates.checkOutIso).getTime();

    if (isNaN(startMs) || isNaN(endMs)) {
      issues.push({
        hubOccurrenceId: occId,
        stayIndex: idx + 1,
        hubName: hub.hubName,
        severity: 'ERROR',
        message: `Stay #${idx + 1} (${hub.hubName}): Invalid check-in or check-out date.`
      });
      return;
    }

    if (endMs <= startMs) {
      issues.push({
        hubOccurrenceId: occId,
        stayIndex: idx + 1,
        hubName: hub.hubName,
        severity: 'ERROR',
        message: `Stay #${idx + 1} (${hub.hubName}): Check-out (${dates.checkOutIso}) must be after check-in (${dates.checkInIso}).`
      });
      return;
    }

    ranges.push({ idx: idx + 1, hub, startMs, endMs, checkInIso: dates.checkInIso, checkOutIso: dates.checkOutIso });
  });

  // Check overlapping custom stay dates (note: endMs === nextStartMs is normal back-to-back checkout/checkin, NOT overlap)
  for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
      const a = ranges[i];
      const b = ranges[j];
      if (a.startMs < b.endMs && b.startMs < a.endMs) {
        issues.push({
          hubOccurrenceId: getHubOccurrenceId(b.hub),
          stayIndex: b.idx,
          hubName: b.hub.hubName,
          severity: 'WARNING',
          message: `Stay #${b.idx} (${b.hub.hubName}: ${b.checkInIso} → ${b.checkOutIso}) overlaps with Stay #${a.idx} (${a.hub.hubName}: ${a.checkInIso} → ${a.checkOutIso}).`
        });
      }
    }
  }

  return issues;
}
