import { Product, QuoteItem } from '../types';

/**
 * Resolves the canonical Listing Name for any inventory record, quote item, or booking service item.
 * 
 * Standard Rule:
 * Operational type (Vehicle, Hotel Room, Visa Type, Rail Class, Vessel, Yacht Model) describes WHAT the inventory is.
 * Listing Name describes what the customer / agent is BUYING.
 * 
 * Always return the canonical Product / Listing Name as primary identity.
 */
export function getInventoryDisplayName(item: any): string {
  if (!item) return 'Travel Service';

  // Helper: check if a string is purely an operational asset type name
  const isPureAssetType = (val: string): boolean => {
    if (!val) return false;
    const lower = val.trim().toLowerCase();
    const assetTypes = [
      'alphard', 'toyota alphard', 'toyota alphard executive mpv', 'toyota alphard executive lounge',
      'hiace', 'toyota hiace', 'toyota hiace commuter', 'van', 'mpv', 'executive mpv', 'executive mpv / van',
      'sedan', 'executive sedan', 'coaster', 'bus', 'minibus', 'minibus / sprinter',
      'yacht', 'motor yacht', 'ferry', 'catamaran', 'speed boat', 'azimut 66', 'riva rivale 52',
      'deluxe room', 'deluxe twin room', 'standard room', 'suite', 'executive suite', 'king room', 'twin room',
      'green car', 'ordinary car', 'reserved seat',
      'ordinary car — reserved seat', 'green car — first class / reserved seat', 'green car — first class / reserved',
      'e-visa', 'single entry', 'multiple entry', 'tourist visa', 'business visa'
    ];
    return assetTypes.includes(lower);
  };

  // Helper: strip trailing operational vehicle/vessel model parentheses or hotel room/nights concatenation
  const cleanListingTitle = (raw: string): string => {
    if (!raw) return '';
    let cleaned = raw.trim();

    // Canonical Rail master product remapping
    const lower = cleaned.toLowerCase();
    if (lower === 'ordinary car — reserved seat' || lower === 'ordinary car (reserved seat)' || lower.includes('reserved ordinary car')) {
      return 'Ordinary Car — Reserved Seat';
    }
    if (
      lower === 'green car — first class / reserved seat' ||
      lower === 'green car — first class / reserved' ||
      lower === 'green car (first class / reserved seat)' ||
      lower.includes('green car first class')
    ) {
      return 'Green Car — First Class / Reserved';
    }

    // Strip Hotel room & nights suffix e.g. "Hotel Name - Deluxe Room (1 Room, 3 Nights)"
    const hotelConcatMatch = cleaned.match(/^(.*?)\s+[-—]\s+.*?\(\d+\s+Rooms?,\s*\d+\s+Nights?\)$/i);
    if (hotelConcatMatch && hotelConcatMatch[1]) {
      cleaned = hotelConcatMatch[1].trim();
    }

    // Strip trailing vehicle / vessel model in parentheses e.g. "(Toyota Alphard)", "(Toyota HiAce, 10 Pax)", "(Azimut 66)"
    cleaned = cleaned.replace(
      /\s*\((?:Toyota\s+Alphard[^)]*|Toyota\s+HiAce[^)]*|Toyota\s+Crown[^)]*|Mercedes[^)]*|Executive\s+MPV[^)]*|Executive\s+Sedan[^)]*|Azimut[^)]*|Riva\s+Rivale[^)]*|Lagoon[^)]*|Sunseeker[^)]*)\)\s*$/i,
      ''
    ).trim();

    return cleaned;
  };

  // 0. Check Rail canonical commercial IDs first
  const itemId = item.id || item.productId || item.product?.id || item.railJourneyDetails?.productId;
  if (itemId === 'RAIL-JP-GREEN-RESERVED' || item.railJourneyDetails?.carType === 'Green' || item.carType === 'Green') {
    return 'Green Car — First Class / Reserved';
  }
  if (itemId === 'RAIL-JP-ORD-RESERVED' || item.railJourneyDetails?.carType === 'Ordinary' || item.carType === 'Ordinary') {
    return 'Ordinary Car — Reserved Seat';
  }

  // 1. Hotel items (Manual or Catalog) — always prioritize canonical Hotel Listing Name
  if (item.isManualHotel && item.manualHotelDetails?.hotelName) {
    return item.manualHotelDetails.hotelName.trim();
  }
  if (item.metadata?.hotelConfigurationPayload?.hotelName) {
    return item.metadata.hotelConfigurationPayload.hotelName.trim();
  }
  if (item.hotelDetails?.hotelName) {
    return item.hotelDetails.hotelName.trim();
  }
  if (typeof item.hotelName === 'string' && item.hotelName.trim().length > 0 && !isPureAssetType(item.hotelName)) {
    return item.hotelName.trim();
  }

  // 2. Direct canonical listingName or snapshot
  if (typeof item.listingName === 'string' && item.listingName.trim().length > 0 && !isPureAssetType(item.listingName)) {
    return cleanListingTitle(item.listingName);
  }
  if (typeof item.listingNameSnapshot === 'string' && item.listingNameSnapshot.trim().length > 0 && !isPureAssetType(item.listingNameSnapshot)) {
    return cleanListingTitle(item.listingNameSnapshot);
  }

  // 3. Nested product object listingName or productName or name
  if (item.product) {
    if (typeof item.product.listingName === 'string' && item.product.listingName.trim().length > 0 && !isPureAssetType(item.product.listingName)) {
      return cleanListingTitle(item.product.listingName);
    }
    if (typeof item.product.productName === 'string' && item.product.productName.trim().length > 0 && !isPureAssetType(item.product.productName)) {
      return cleanListingTitle(item.product.productName);
    }
    if (typeof item.product.name === 'string' && item.product.name.trim().length > 0 && !isPureAssetType(item.product.name)) {
      return cleanListingTitle(item.product.name);
    }
  }

  // 4. Shinkansen / Rail commercial journey
  if (item.railJourneyDetails) {
    const rd = item.railJourneyDetails;
    if (rd.carType === 'Green' || rd.productId === 'RAIL-JP-GREEN-RESERVED') {
      return 'Green Car — First Class / Reserved';
    }
    return 'Ordinary Car — Reserved Seat';
  }

  // 5. Visa product / Visa snapshot
  if (item.visaSnapshot) {
    const v = item.visaSnapshot;
    if (v.listingName && !isPureAssetType(v.listingName)) return cleanListingTitle(v.listingName);
    if (v.visaName && !isPureAssetType(v.visaName)) {
      return v.visaName.toLowerCase().includes('assistance') ? v.visaName : `${v.visaName} Assistance`;
    }
    if (v.destination || v.country) {
      return `${v.destination || v.country} Tourist Visa Assistance`;
    }
  }
  if ((item as any).visaType && (item as any).country) {
    const country = (item as any).country;
    const vType = (item as any).visaType;
    if (typeof item.listingName === 'string' && item.listingName.trim()) {
      return item.listingName.trim();
    }
    if (vType.toLowerCase().includes('assistance')) {
      return vType.toLowerCase().startsWith(country.toLowerCase()) ? vType : `${country} ${vType}`;
    }
    // Strip parenthetical entry details from primary visa listing name
    const baseVisaType = vType.replace(/\s*\([^)]*\)\s*/g, '').trim();
    const prefix = baseVisaType.toLowerCase().startsWith(country.toLowerCase()) ? baseVisaType : `${country} ${baseVisaType}`;
    return `${prefix} Assistance`;
  }

  // 6. Item-level customTitle, productName, serviceName, title, name
  if (typeof item.customTitle === 'string' && item.customTitle.trim().length > 0 && !isPureAssetType(item.customTitle)) {
    return cleanListingTitle(item.customTitle);
  }
  if (typeof item.productName === 'string' && item.productName.trim().length > 0 && !isPureAssetType(item.productName)) {
    return cleanListingTitle(item.productName);
  }
  if (typeof item.serviceName === 'string' && item.serviceName.trim().length > 0 && !isPureAssetType(item.serviceName)) {
    return cleanListingTitle(item.serviceName);
  }
  if (typeof item.title === 'string' && item.title.trim().length > 0 && !isPureAssetType(item.title)) {
    return cleanListingTitle(item.title);
  }
  if (typeof item.name === 'string' && item.name.trim().length > 0 && !isPureAssetType(item.name)) {
    return cleanListingTitle(item.name);
  }

  // 7. Transfer route fallback
  if (item.fromHubName && item.toHubName) {
    return `${item.fromHubName} → ${item.toHubName} Private Transfer`;
  }
  if (item.product?.fromHubName && item.product?.toHubName) {
    return `${item.product.fromHubName} → ${item.product.toHubName} Private Transfer`;
  }

  // Fallback defaults
  if (item.category === 'Transfers' || item.product?.category === 'Transfers') {
    return 'Private Chauffeur Ground Transfer';
  }
  if (item.category === 'Rail' || item.product?.category === 'Rail') {
    return 'Shinkansen Bullet Train Service';
  }
  if (item.category === 'Visa' || item.product?.category === 'Visa') {
    return 'Official Visa Processing Service';
  }

  return 'Curated Travel Experience';
}

/**
 * Resolves secondary operational configuration details for an inventory item.
 * Vehicle, room type, meal plan, seat class, vessel, visa type, capacity, etc. are secondary configuration details.
 */
export function getInventoryConfigurationSummary(item: any): string {
  if (!item) return '';

  const parts: string[] = [];
  const configSnap = item.configuration_snapshot || item.metadata?.configuration_payload || {};
  const hotelConfig = item.metadata?.hotelConfigurationPayload || item.hotelDetails || null;

  // 1. Hotel Room / Meal Plan / Nights
  if (item.isManualHotel && item.manualHotelDetails) {
    const mh = item.manualHotelDetails;
    if (mh.roomType) parts.push(`Room: ${mh.roomType}`);
    if (mh.mealPlan) parts.push(`Meal: ${mh.mealPlan}`);
    if (mh.roomsCount) parts.push(`${mh.roomsCount} ${mh.roomsCount === 1 ? 'Room' : 'Rooms'}`);
    if (mh.nights) parts.push(`${mh.nights} ${mh.nights === 1 ? 'Night' : 'Nights'}`);
    return parts.join(' • ');
  }
  if (hotelConfig) {
    const rName = hotelConfig.roomName || hotelConfig.roomType;
    const mPlan = hotelConfig.mealPlanLabel || hotelConfig.mealPlan;
    if (rName) parts.push(`Room: ${rName}`);
    if (mPlan) parts.push(`Meal: ${mPlan}`);
    if (hotelConfig.roomsCount) parts.push(`${hotelConfig.roomsCount} ${hotelConfig.roomsCount === 1 ? 'Room' : 'Rooms'}`);
    if (hotelConfig.nights) parts.push(`${hotelConfig.nights} ${hotelConfig.nights === 1 ? 'Night' : 'Nights'}`);
    return parts.join(' • ');
  }
  if (item.roomType || item.product?.roomType) {
    parts.push(`Room: ${item.roomType || item.product?.roomType}`);
    if (item.mealPlan || item.product?.mealPlan) {
      parts.push(`Meal: ${item.mealPlan || item.product?.mealPlan}`);
    }
    if (item.roomsCount || item.product?.roomsCount) {
      const r = item.roomsCount || item.product?.roomsCount;
      parts.push(`${r} ${r === 1 ? 'Room' : 'Rooms'}`);
    }
    if (item.nights || item.product?.nights) {
      const n = item.nights || item.product?.nights;
      parts.push(`${n} ${n === 1 ? 'Night' : 'Nights'}`);
    }
    return parts.join(' • ');
  }

  // 2. Shinkansen / Rail
  if (item.railJourneyDetails) {
    const rd = item.railJourneyDetails;
    if (rd.carType) parts.push(`Class: ${rd.carType} Car (${rd.seatType || 'Reserved'})`);
    if (rd.originStationName && rd.destinationStationName) {
      parts.push(`Route: ${rd.originStationName} → ${rd.destinationStationName}`);
    }
  } else if (item.carType || item.classType) {
    parts.push(`Class: ${item.carType || item.classType} (${item.reservationType || item.seatType || 'Reserved Seat'})`);
  }

  // 3. Transfer Route (if Transfer)
  const fromHub = configSnap.fromHub || item.fromHubName || item.product?.fromHubName;
  const toHub = configSnap.toHub || item.toHubName || item.product?.toHubName;
  if (fromHub && toHub) {
    parts.push(`${fromHub} → ${toHub}`);
  }

  // 4. Vehicle / Yacht / Vessel
  const vehicleName =
    configSnap.vehicleName ||
    item.selectedVehicleName ||
    item.vehicleConfig?.vehicleName ||
    item.vehicleConfig?.vehicleModel ||
    item.product?.vehicleConfig?.vehicleName ||
    item.product?.vehicleConfig?.vehicleModel ||
    item.vehicleNameSnapshot ||
    item.product?.vehicleNameSnapshot ||
    item.vehicleType ||
    item.vehicle ||
    item.product?.vehicleType;

  if (vehicleName) {
    parts.push(`Vehicle: ${vehicleName}`);
  }

  const yachtName =
    configSnap.yachtName ||
    item.yachtConfig?.yachtName ||
    item.product?.yachtConfig?.yachtName ||
    item.vesselName ||
    item.product?.vesselName;
  if (yachtName) {
    parts.push(`Vessel: ${yachtName}`);
  }

  // 5. Visa Details
  const visaType = item.visaSnapshot?.visaType || (item as any).visaType;
  if (visaType) {
    parts.push(`Visa Type: ${visaType}`);
    const entry = item.visaSnapshot?.entryType || (item as any).entryType;
    if (entry) parts.push(String(entry).replace(/_/g, ' '));
    const procDays = (item as any).processingTimeDays;
    if (procDays) parts.push(`Processing: ${procDays} ${typeof procDays === 'number' ? 'Working Days' : ''}`.trim());
  }

  // 6. Pax / Capacity
  if (item.pax) {
    const adults = item.pax.adults || 0;
    const children = item.pax.children || 0;
    if (adults > 0) {
      parts.push(`Pax: ${adults} Adult${adults > 1 ? 's' : ''}${children > 0 ? `, ${children} Ch` : ''}`);
    }
  } else {
    const maxSeats =
      item.vehicleConfig?.maxSeats ||
      item.product?.vehicleConfig?.maxSeats ||
      item.capacitySnapshot ||
      item.product?.capacitySnapshot ||
      item.maxPax ||
      item.product?.maxPax;
    if (maxSeats) {
      const minPax = item.minPax || item.product?.minPax || 1;
      parts.push(`Capacity: ${minPax}–${maxSeats} Passengers`);
    }
  }

  // 7. Duration
  const duration = item.duration || item.product?.duration;
  if (duration && !visaType) {
    parts.push(`Duration: ${duration}`);
  }

  return parts.join(' • ');
}
