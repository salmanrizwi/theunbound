import { Product, QuoteItem, Hotel, CurrencyCode, ProductUpsell, UpsellRelationship, SelectedUpsellSnapshot } from '../types';
import { isRailProduct, isRailQuoteItem } from './rail/JapanRailJourneyDataService';

/**
 * ============================================================================
 * THEUNBOUND — MASTER PRODUCT CATEGORIES & DEDICATED CONFIGURATOR ARCHITECTURE
 * Authoritative Configurator Registry & Category Resolution Engine
 * ============================================================================
 * 
 * Master Rule:
 * ONE PRODUCT CATEGORY -> ONE DEDICATED CONFIGURATOR -> ONE CONFIGURATION MODEL
 * No generic customizer sitting between Product Management and Cart/Quote/Booking.
 */

export const AUTHORITATIVE_PRODUCT_CATEGORIES = [
  'Private Tours',
  'Group Tours',
  'Transfers',
  'Tickets',
  'Private Yacht',
  'Ferries',
  'Guides',
  'Hotels',
  'Visa & Ancillary Services',
  'Rail / Shinkansen',
  'Lunch / Dinner Restaurant'
] as const;

export type AuthoritativeProductCategory = typeof AUTHORITATIVE_PRODUCT_CATEGORIES[number];

/**
 * Standard Product CMS Categories strictly for Admin CMS -> Products:
 * Contains the 7 core categories managed directly within Product Manager.
 * (Dedicated modules: Hotels, Rail, Visa & Ancillary Services have their own dedicated interfaces).
 */
export const PRODUCT_CMS_CATEGORIES = [
  'Private Tours',
  'Group Tours',
  'Tickets',
  'Transfers',
  'Guides',
  'Lunch / Dinner Restaurant',
  'Private Yacht'
] as const;

export type ProductCMSCategory = typeof PRODUCT_CMS_CATEGORIES[number];

/**
 * Stable, internal Product Category IDs / ENUMs compliant with Section 10 of Architectural Rules:
 * Must never depend on arbitrary display text or user-facing labels.
 */
export type ProductCategoryEnum =
  | 'PRIVATE_TOURS'
  | 'GROUP_TOURS'
  | 'TRANSFERS'
  | 'TICKETS'
  | 'PRIVATE_YACHT'
  | 'FERRIES'
  | 'GUIDES'
  | 'HOTELS'
  | 'VISA_ANCILLARY'
  | 'SHINKANSEN'
  | 'RESTAURANT';

export const ALL_PRODUCT_CATEGORY_ENUMS: readonly ProductCategoryEnum[] = [
  'PRIVATE_TOURS',
  'GROUP_TOURS',
  'TRANSFERS',
  'TICKETS',
  'PRIVATE_YACHT',
  'FERRIES',
  'GUIDES',
  'HOTELS',
  'VISA_ANCILLARY',
  'SHINKANSEN',
  'RESTAURANT'
] as const;

export type DedicatedConfiguratorType =
  | 'PRIVATE_TOUR_CONFIGURATOR'
  | 'GROUP_TOUR_CONFIGURATOR'
  | 'TRANSFER_CONFIGURATOR'
  | 'TICKET_CONFIGURATOR'
  | 'PRIVATE_YACHT_CONFIGURATOR'
  | 'FERRY_CONFIGURATOR'
  | 'GUIDE_CONFIGURATOR'
  | 'HOTEL_CONFIGURATOR'
  | 'VISA_ANCILLARY_CONFIGURATOR'
  | 'SHINKANSEN_DYNAMIC_JOURNEY_CONFIGURATOR'
  | 'RESTAURANT_CONFIGURATOR';

export const CATEGORY_ENUM_TO_DISPLAY: Record<ProductCategoryEnum, AuthoritativeProductCategory> = {
  PRIVATE_TOURS: 'Private Tours',
  GROUP_TOURS: 'Group Tours',
  TRANSFERS: 'Transfers',
  TICKETS: 'Tickets',
  PRIVATE_YACHT: 'Private Yacht',
  FERRIES: 'Ferries',
  GUIDES: 'Guides',
  HOTELS: 'Hotels',
  VISA_ANCILLARY: 'Visa & Ancillary Services',
  SHINKANSEN: 'Rail / Shinkansen',
  RESTAURANT: 'Lunch / Dinner Restaurant'
};

export const DISPLAY_TO_CATEGORY_ENUM: Record<AuthoritativeProductCategory, ProductCategoryEnum> = {
  'Private Tours': 'PRIVATE_TOURS',
  'Group Tours': 'GROUP_TOURS',
  'Transfers': 'TRANSFERS',
  'Tickets': 'TICKETS',
  'Private Yacht': 'PRIVATE_YACHT',
  'Ferries': 'FERRIES',
  'Guides': 'GUIDES',
  'Hotels': 'HOTELS',
  'Visa & Ancillary Services': 'VISA_ANCILLARY',
  'Rail / Shinkansen': 'SHINKANSEN',
  'Lunch / Dinner Restaurant': 'RESTAURANT'
};

export const CATEGORY_ENUM_TO_CONFIGURATOR: Record<ProductCategoryEnum, DedicatedConfiguratorType> = {
  PRIVATE_TOURS: 'PRIVATE_TOUR_CONFIGURATOR',
  GROUP_TOURS: 'GROUP_TOUR_CONFIGURATOR',
  TRANSFERS: 'TRANSFER_CONFIGURATOR',
  TICKETS: 'TICKET_CONFIGURATOR',
  PRIVATE_YACHT: 'PRIVATE_YACHT_CONFIGURATOR',
  FERRIES: 'FERRY_CONFIGURATOR',
  GUIDES: 'GUIDE_CONFIGURATOR',
  HOTELS: 'HOTEL_CONFIGURATOR',
  VISA_ANCILLARY: 'VISA_ANCILLARY_CONFIGURATOR',
  SHINKANSEN: 'SHINKANSEN_DYNAMIC_JOURNEY_CONFIGURATOR',
  RESTAURANT: 'RESTAURANT_CONFIGURATOR'
};

export interface ConfiguratorDescriptor {
  category: AuthoritativeProductCategory;
  categoryEnum: ProductCategoryEnum;
  configuratorType: DedicatedConfiguratorType;
  title: string;
  description: string;
  badgeColor: string;
  iconName: string;
}

export const CONFIGURATOR_REGISTRY_MAP: Record<AuthoritativeProductCategory, ConfiguratorDescriptor> = {
  'Private Tours': {
    category: 'Private Tours',
    categoryEnum: 'PRIVATE_TOURS',
    configuratorType: 'PRIVATE_TOUR_CONFIGURATOR',
    title: 'Private Tour Configurator',
    description: 'Custom vehicle, chauffeur, private guide, bespoke route, and add-ons',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    iconName: 'Crown'
  },
  'Group Tours': {
    category: 'Group Tours',
    categoryEnum: 'GROUP_TOURS',
    configuratorType: 'GROUP_TOUR_CONFIGURATOR',
    title: 'Group Tour Configurator',
    description: 'Scheduled departures, designated meeting point, shared guide, and seat availability',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    iconName: 'Users'
  },
  'Transfers': {
    category: 'Transfers',
    categoryEnum: 'TRANSFERS',
    configuratorType: 'TRANSFER_CONFIGURATOR',
    title: 'Transfer Configurator',
    description: 'Airport arrival/departure, inter-hub routes, vehicle class, and baggage management',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    iconName: 'Car'
  },
  'Tickets': {
    category: 'Tickets',
    categoryEnum: 'TICKETS',
    configuratorType: 'TICKET_CONFIGURATOR',
    title: 'Ticket Configurator',
    description: 'Attraction entry, theme park passes, exhibition slots, and time-stamped admissions',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
    iconName: 'Ticket'
  },
  'Private Yacht': {
    category: 'Private Yacht',
    categoryEnum: 'PRIVATE_YACHT',
    configuratorType: 'PRIVATE_YACHT_CONFIGURATOR',
    title: 'Private Yacht Configurator',
    description: 'Luxury vessel charter, cruising itinerary, catering, crew, and marina departures',
    badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    iconName: 'Ship'
  },
  'Ferries': {
    category: 'Ferries',
    categoryEnum: 'FERRIES',
    configuratorType: 'FERRY_CONFIGURATOR',
    title: 'Ferry Configurator',
    description: 'Island sea-lines, passenger class, cabin reservation, vehicle carriage, and port schedules',
    badgeColor: 'bg-teal-100 text-teal-800 border-teal-200',
    iconName: 'Anchor'
  },
  'Guides': {
    category: 'Guides',
    categoryEnum: 'GUIDES',
    configuratorType: 'GUIDE_CONFIGURATOR',
    title: 'Guide Configurator',
    description: 'Government-licensed interpreters, specialist expertise, language preference, and itinerary focus',
    badgeColor: 'bg-orange-100 text-orange-800 border-orange-200',
    iconName: 'UserCheck'
  },
  'Hotels': {
    category: 'Hotels',
    categoryEnum: 'HOTELS',
    configuratorType: 'HOTEL_CONFIGURATOR',
    title: 'Hotel Configurator',
    description: 'Authoritative property catalog, room categories, wholesale rate plans, and meal regimes',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    iconName: 'Building2'
  },
  'Visa & Ancillary Services': {
    category: 'Visa & Ancillary Services',
    categoryEnum: 'VISA_ANCILLARY',
    configuratorType: 'VISA_ANCILLARY_CONFIGURATOR',
    title: 'Visa & Ancillary Services Configurator',
    description: 'Government visa facilitation, travel insurance, VIP airport meet & assist, and 5G connectivity',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
    iconName: 'ShieldCheck'
  },
  'Rail / Shinkansen': {
    category: 'Rail / Shinkansen',
    categoryEnum: 'SHINKANSEN',
    configuratorType: 'SHINKANSEN_DYNAMIC_JOURNEY_CONFIGURATOR',
    title: 'Shinkansen Dynamic Journey Configurator',
    description: 'High-speed bullet train smartEX inventory, station pair graph, car type, and seat allocation',
    badgeColor: 'bg-teal-100 text-teal-900 border-teal-300',
    iconName: 'Train'
  },
  'Lunch / Dinner Restaurant': {
    category: 'Lunch / Dinner Restaurant',
    categoryEnum: 'RESTAURANT',
    configuratorType: 'RESTAURANT_CONFIGURATOR',
    title: 'Restaurant Configurator',
    description: 'Fine dining, Kaiseki, Michelin reservations, course menus, seating, and dietary specifications',
    badgeColor: 'bg-amber-100 text-amber-900 border-amber-300',
    iconName: 'Utensils'
  }
};

/**
 * Normalizes any legacy or free-text category into one of the 11 Authoritative Product Categories.
 * Guarantees zero data loss and safe migration.
 */
export function normalizeProductCategory(rawCategory: string | undefined | null): AuthoritativeProductCategory {
  if (!rawCategory) return 'Private Tours';
  const clean = rawCategory.trim();
  const lower = clean.toLowerCase();

  // 1. Private Tours
  if (
    lower === 'private tours' ||
    lower === 'private tour' ||
    lower.includes('private tour') ||
    lower.includes('private sightseeing') ||
    lower.includes('bespoke tour')
  ) {
    return 'Private Tours';
  }

  // 2. Group Tours
  if (
    lower === 'group tours' ||
    lower === 'group tour' ||
    lower === 'tours' ||
    lower === 'day trips' ||
    lower === 'day trip' ||
    lower.includes('group tour') ||
    lower.includes('scheduled tour')
  ) {
    return 'Group Tours';
  }

  // 3. Transfers
  if (
    lower === 'transfers' ||
    lower === 'transfer' ||
    lower === 'transport' ||
    lower.includes('transfer') ||
    lower.includes('airport pickup') ||
    lower.includes('chauffeur')
  ) {
    return 'Transfers';
  }

  // 4. Tickets
  if (
    lower === 'tickets' ||
    lower === 'ticket' ||
    lower === 'activities' ||
    lower === 'activity' ||
    lower === 'attractions' ||
    lower === 'attraction' ||
    lower === 'theme park' ||
    lower === 'museum' ||
    lower.includes('ticket') ||
    lower.includes('pass')
  ) {
    return 'Tickets';
  }

  // 5. Private Yacht
  if (
    lower === 'private yacht' ||
    lower === 'yacht' ||
    lower === 'boat' ||
    lower === 'charter' ||
    lower === 'cruise' ||
    lower.includes('yacht')
  ) {
    return 'Private Yacht';
  }

  // 6. Ferries
  if (
    lower === 'ferries' ||
    lower === 'ferry' ||
    lower.includes('ferry') ||
    lower.includes('jetfoil') ||
    lower.includes('sea pass')
  ) {
    return 'Ferries';
  }

  // 7. Guides
  if (
    lower === 'guides' ||
    lower === 'guide' ||
    lower.includes('guide') ||
    lower.includes('interpreter')
  ) {
    return 'Guides';
  }

  // 8. Hotels
  if (
    lower === 'hotels' ||
    lower === 'hotel' ||
    lower === 'accommodation' ||
    lower === 'resort' ||
    lower === 'ryokan' ||
    lower.includes('hotel') ||
    lower.includes('stay')
  ) {
    return 'Hotels';
  }

  // 9. Visa & Ancillary Services
  if (
    lower === 'visa & ancillary services' ||
    lower === 'visa' ||
    lower === 'visas' ||
    lower === 'travel services' ||
    lower === 'ancillary' ||
    lower === 'insurance' ||
    lower === 'connectivity' ||
    lower === 'esim' ||
    lower.includes('visa') ||
    lower.includes('ancillary')
  ) {
    return 'Visa & Ancillary Services';
  }

  // 10. Rail / Shinkansen
  if (
    lower === 'rail / shinkansen' ||
    lower === 'rail' ||
    lower === 'shinkansen' ||
    lower === 'bullet train' ||
    lower === 'train' ||
    lower.includes('shinkansen') ||
    lower.includes('rail')
  ) {
    return 'Rail / Shinkansen';
  }

  // 11. Lunch / Dinner Restaurant
  if (
    lower === 'lunch / dinner restaurant' ||
    lower === 'restaurant' ||
    lower === 'restaurants' ||
    lower === 'dining' ||
    lower === 'lunch' ||
    lower === 'dinner' ||
    lower.includes('restaurant') ||
    lower.includes('kaiseki') ||
    lower.includes('omakase') ||
    lower.includes('dining')
  ) {
    return 'Lunch / Dinner Restaurant';
  }

  return 'Private Tours';
}

/**
 * Resolves the stable ProductCategoryEnum directly from the authoritative product record.
 * Compliant with Rule 9 & Rule 10:
 * Must NEVER infer category from product name, description, URL, or UI position.
 * Returns null if the category cannot be determined (NO silent fallback to Hotel or Generic).
 */
export function resolveProductCategoryEnum(itemOrProduct: any): ProductCategoryEnum | null {
  if (!itemOrProduct) return null;

  // 1. Authoritative category field from the product or quote item record
  const rawCat =
    itemOrProduct.product_category ||
    itemOrProduct.productCategory ||
    itemOrProduct.category_id ||
    itemOrProduct.category ||
    itemOrProduct.product?.product_category ||
    itemOrProduct.product?.productCategory ||
    itemOrProduct.product?.category_id ||
    itemOrProduct.product?.category ||
    itemOrProduct.configuration?.product_category;

  if (rawCat && typeof rawCat === 'string') {
    const trimmed = rawCat.trim();
    const upper = trimmed.toUpperCase().replace(/[\s\-\/]+/g, '_');
    const lower = trimmed.toLowerCase();

    // Direct Enum matching
    if (upper === 'PRIVATE_TOURS' || upper === 'PRIVATE_TOUR') return 'PRIVATE_TOURS';
    if (upper === 'GROUP_TOURS' || upper === 'GROUP_TOUR') return 'GROUP_TOURS';
    if (upper === 'TRANSFERS' || upper === 'TRANSFER' || upper === 'TRANSPORT' || upper === 'TRANSPORTS') return 'TRANSFERS';
    if (upper === 'TICKETS' || upper === 'TICKET' || upper === 'ACTIVITY' || upper === 'ACTIVITIES' || upper === 'ATTRACTION' || upper === 'ATTRACTIONS') return 'TICKETS';
    if (upper === 'PRIVATE_YACHT' || upper === 'YACHT' || upper === 'BOAT') return 'PRIVATE_YACHT';
    if (upper === 'FERRIES' || upper === 'FERRY') return 'FERRIES';
    if (upper === 'GUIDES' || upper === 'GUIDE' || upper === 'INTERPRETER') return 'GUIDES';
    if (upper === 'HOTELS' || upper === 'HOTEL' || upper === 'ACCOMMODATION' || upper === 'ACCOMMODATIONS' || upper === 'HOTEL_ACCOMMODATION') return 'HOTELS';
    if (upper === 'VISA_ANCILLARY' || upper === 'VISA_ANCILLARY_SERVICES' || upper === 'VISA' || upper === 'VISAS' || upper === 'ANCILLARY' || upper === 'VISA_SERVICES') return 'VISA_ANCILLARY';
    if (upper === 'RAIL_SHINKANSEN' || upper === 'SHINKANSEN' || upper === 'RAIL' || upper === 'TRAIN' || upper === 'JAPAN_RAIL') return 'SHINKANSEN';
    if (upper === 'LUNCH_DINNER_RESTAURANT' || upper === 'RESTAURANT' || upper === 'RESTAURANTS' || upper === 'DINING') return 'RESTAURANT';

    // Display Name matching
    if (lower === 'private tours' || lower === 'private tour') return 'PRIVATE_TOURS';
    if (lower === 'group tours' || lower === 'group tour' || lower === 'day trips' || lower === 'day trip' || lower === 'tours' || lower === 'tour') return 'GROUP_TOURS';
    if (lower === 'transfers' || lower === 'transfer' || lower === 'transport') return 'TRANSFERS';
    if (lower === 'tickets' || lower === 'ticket' || lower === 'activities' || lower === 'activity' || lower === 'attractions' || lower === 'attraction' || lower === 'museum' || lower === 'theme park') return 'TICKETS';
    if (lower === 'private yacht' || lower === 'yacht' || lower === 'boat' || lower === 'charter' || lower === 'cruise') return 'PRIVATE_YACHT';
    if (lower === 'ferries' || lower === 'ferry' || lower === 'sea lines') return 'FERRIES';
    if (lower === 'guides' || lower === 'guide' || lower === 'licensed guide' || lower === 'interpreter') return 'GUIDES';
    if (lower === 'hotels' || lower === 'hotel' || lower === 'accommodation' || lower === 'accommodations' || lower === 'resort' || lower === 'ryokan') return 'HOTELS';
    if (lower === 'visa & ancillary services' || lower === 'visa' || lower === 'visas' || lower === 'ancillary' || lower === 'visa & ancillary') return 'VISA_ANCILLARY';
    if (lower === 'rail / shinkansen' || lower === 'rail' || lower === 'shinkansen' || lower === 'bullet train') return 'SHINKANSEN';
    if (lower === 'lunch / dinner restaurant' || lower === 'restaurant' || lower === 'restaurants' || lower === 'dining' || lower === 'fine dining') return 'RESTAURANT';
  }

  // 2. Authoritative domain signatures on quote item or special inventory entities
  if (isRailQuoteItem(itemOrProduct) || isRailProduct(itemOrProduct) || (itemOrProduct.product && isRailProduct(itemOrProduct.product))) {
    return 'SHINKANSEN';
  }
  if (itemOrProduct.serviceVisaDetails || itemOrProduct.visaSnapshot || itemOrProduct.visaConfigurationPayload) {
    return 'VISA_ANCILLARY';
  }
  if (itemOrProduct.isManualHotel || itemOrProduct.hotelDetails || (itemOrProduct.propertyType === 'HOTEL' && itemOrProduct.roomTypes)) {
    return 'HOTELS';
  }

  // 3. Authoritative SKU or supplier ID prefix conventions
  const sku = (itemOrProduct.sku || itemOrProduct.product?.sku || '').toUpperCase();
  const id = (itemOrProduct.id || itemOrProduct.product?.id || '').toUpperCase();

  if (sku.startsWith('HTL-') || id.startsWith('HTL-') || (itemOrProduct.supplierProductCode && String(itemOrProduct.supplierProductCode).toUpperCase().startsWith('SUP-HTL-'))) {
    return 'HOTELS';
  }
  if (sku.startsWith('TRF-') || id.startsWith('TRF-')) return 'TRANSFERS';
  if (sku.startsWith('VSA-') || sku.startsWith('VISA-') || id.startsWith('VISA-') || id.startsWith('VSA-')) return 'VISA_ANCILLARY';
  if (sku.startsWith('JP-SHINKANSEN') || id.startsWith('RAIL-JP')) return 'SHINKANSEN';
  if (sku.startsWith('YCH-') || id.startsWith('YCH-')) return 'PRIVATE_YACHT';
  if (sku.startsWith('FRY-') || id.startsWith('FRY-')) return 'FERRIES';
  if (sku.startsWith('GDE-') || id.startsWith('GDE-')) return 'GUIDES';
  if (sku.startsWith('RST-') || id.startsWith('RST-')) return 'RESTAURANT';
  if (sku.startsWith('TCK-') || id.startsWith('TCK-')) return 'TICKETS';

  // Strict Rule 8 & 9: NEVER guess by product name or description. Return null if unresolvable.
  return null;
}

/**
 * Detects whether any product or quote item is a Shinkansen bullet train service.
 * Compliant with Rule 9: Reads ONLY authoritative category/domain signature.
 */
export function isShinkansenProductOrItem(itemOrProduct: any): boolean {
  if (!itemOrProduct) return false;
  return resolveProductCategoryEnum(itemOrProduct) === 'SHINKANSEN';
}

/**
 * Detects whether any product or quote item is a Hotel service.
 * Compliant with Rule 1, 3, 9:
 * MUST NEVER return true for Transfers, Visas, Rail, Private Tours, or any other product
 * merely because its name contains the word 'hotel'.
 */
export function isHotelProductOrItem(itemOrProduct: any): boolean {
  if (!itemOrProduct) return false;
  return resolveProductCategoryEnum(itemOrProduct) === 'HOTELS';
}

/**
 * Detects whether any product or quote item is a Visa & Ancillary service.
 */
export function isVisaProductOrItem(itemOrProduct: any): boolean {
  if (!itemOrProduct) return false;
  return resolveProductCategoryEnum(itemOrProduct) === 'VISA_ANCILLARY';
}

/**
 * Authoritative category detector for any product or quote item.
 * Evaluates authoritative category fields and stable product identifiers.
 */
export function resolveAuthoritativeCategory(itemOrProduct: any): AuthoritativeProductCategory {
  if (!itemOrProduct) return 'Private Tours';
  const categoryEnum = resolveProductCategoryEnum(itemOrProduct);
  if (categoryEnum) {
    return CATEGORY_ENUM_TO_DISPLAY[categoryEnum];
  }
  // Safe normalization fallback for newly typed categories in Admin CMS
  const rawCat = itemOrProduct.category || itemOrProduct.product?.category || itemOrProduct.product_category;
  if (rawCat && typeof rawCat === 'string') {
    return normalizeProductCategory(rawCat);
  }
  return 'Private Tours';
}

/**
 * Resolved Configurator result returned by the central resolver.
 */
export interface ResolvedConfigurator {
  configuratorType: DedicatedConfiguratorType;
  configuratorComponent: string;
  category: AuthoritativeProductCategory;
  categoryEnum: ProductCategoryEnum;
  title: string;
  description: string;
  badgeColor: string;
}

/**
 * Authoritative Central Configurator Resolver compliant with Section 11:
 *
 * product
 *   ↓
 * product.product_category
 *   ↓
 * ConfiguratorRegistry
 *   ↓
 * correct configurator
 *
 * returns: { configuratorType, configuratorComponent, category, categoryEnum, title, description, badgeColor }
 * returns null if the product category cannot be resolved (Strict Rule 8: NO generic or Hotel fallback).
 */
export function getConfiguratorForProduct(product: any): ResolvedConfigurator | null {
  if (!product) return null;

  const categoryEnum = resolveProductCategoryEnum(product);
  if (!categoryEnum) {
    return null;
  }

  const category = CATEGORY_ENUM_TO_DISPLAY[categoryEnum];
  const configuratorType = CATEGORY_ENUM_TO_CONFIGURATOR[categoryEnum];
  const descriptor = CONFIGURATOR_REGISTRY_MAP[category];

  return {
    configuratorType,
    configuratorComponent: configuratorType,
    category,
    categoryEnum,
    title: descriptor?.title || `${category} Configurator`,
    description: descriptor?.description || '',
    badgeColor: descriptor?.badgeColor || 'bg-slate-100 text-slate-800 border-slate-200'
  };
}

/**
 * Authoritative Configurator Registry singleton object as mandated by Section 5.
 */
export const ConfiguratorRegistry = {
  categories: ALL_PRODUCT_CATEGORY_ENUMS,
  displayCategories: AUTHORITATIVE_PRODUCT_CATEGORIES,
  map: CONFIGURATOR_REGISTRY_MAP,
  enumToDisplay: CATEGORY_ENUM_TO_DISPLAY,
  displayToEnum: DISPLAY_TO_CATEGORY_ENUM,
  enumToConfigurator: CATEGORY_ENUM_TO_CONFIGURATOR,
  resolveCategoryEnum: resolveProductCategoryEnum,
  resolveCategory: resolveAuthoritativeCategory,
  getConfiguratorForProduct,
  resolveConfiguratorType
};

/**
 * Returns the exact dedicated configurator type for the item or product.
 */
export function resolveConfiguratorType(itemOrProduct: any): DedicatedConfiguratorType {
  const category = resolveAuthoritativeCategory(itemOrProduct);
  return CONFIGURATOR_REGISTRY_MAP[category]?.configuratorType || 'PRIVATE_TOUR_CONFIGURATOR';
}

/**
 * Generates a stable unique configuration reference compliant with Section 30.
 */
export function generateConfigurationIdentity(
  category: AuthoritativeProductCategory,
  productId: string,
  existingConfigId?: string
) {
  const slug = category.toLowerCase().replace(/[^a-z0-9]/g, '-');
  return {
    configuration_id: existingConfigId || `cfg-${slug}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    product_id: productId,
    product_category: category,
    configurator_type: CONFIGURATOR_REGISTRY_MAP[category].configuratorType,
    configuration_version: 1,
    configuration_schema_version: '2.0.0',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

/**
 * Returns default Master Configuration data for any of the 11 Authoritative Product Categories.
 */
export function getDefaultConfigurationDataForCategory(
  category: AuthoritativeProductCategory,
  product?: Partial<Product>
): Record<string, any> {
  const prodName = product?.name || 'Ground Experience';
  const cityName = product?.city || product?.destinationName || 'Tokyo';
  const defaultCurrency = product?.currency || 'USD';

  switch (category) {
    case 'Private Tours':
      return {
        tourName: prodName,
        destination: product?.destinationName || 'Japan',
        hub: cityName,
        durationHours: 8,
        allowedDurations: [4, 6, 8, 10, 12],
        operatingDays: product?.operatingDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        defaultStartTime: '09:00 AM',
        defaultEndTime: '05:00 PM',
        pickupAvailable: true,
        dropoffAvailable: true,
        defaultPickupLocation: `Hotel Lobby (${cityName} Central)`,
        defaultDropoffLocation: 'Same as Pickup / City Center',
        allowedVehicles: [
          { id: 'alphard', name: 'Toyota Alphard Executive MPV (Up to 5 Pax)', surcharge: 0, capacity: 5 },
          { id: 'hiace', name: 'Toyota HiAce Grand Cabin (Up to 9 Pax)', surcharge: 120, capacity: 9 },
          { id: 'sedan', name: 'Luxury Mercedes S-Class / Crown (Up to 3 Pax)', surcharge: 180, capacity: 3 },
          { id: 'coaster', name: 'Toyota Coaster Executive Minibus (Up to 18 Pax)', surcharge: 350, capacity: 18 }
        ],
        guideIncluded: true,
        allowedGuideLanguages: ['English', 'Spanish', 'French', 'German', 'Italian', 'Japanese'],
        tourType: 'Private Chauffeur & Guided Sightseeing',
        includedServices: product?.inclusions || ['Private luxury vehicle', 'Licensed English speaking guide', 'Toll fees & parking', 'Hotel pickup & drop-off'],
        exclusions: product?.exclusions || ['Guest admission tickets', 'Guest meals and beverages'],
        addons: [
          { id: 'bento', name: 'Premium Traditional Seasonal Bento Lunch', price: 45 },
          { id: 'tea', name: 'Authentic Uji Matcha Tea Ceremony Reservation', price: 65 },
          { id: 'fastpass', name: 'VIP Priority Skip-the-Line Attraction Admissions', price: 90 },
          { id: 'photographer', name: 'Professional Photographer Accompany (2 Hours)', price: 240 }
        ],
        minPax: product?.minPax || 1,
        maxPax: product?.maxPax || 9,
        pricingModel: 'capacity_based',
        baseNetCost: product?.adultNetPrice || 450,
        currency: defaultCurrency
      };

    case 'Group Tours':
      return {
        tourName: prodName,
        destination: product?.destinationName || 'Japan',
        hub: cityName,
        duration: product?.duration || 'Full Day (8 Hours)',
        operatingDays: product?.operatingDays || ['Mon', 'Wed', 'Fri', 'Sun'],
        departureTimes: ['08:30 AM', '09:30 AM', '01:30 PM'],
        meetingPoints: [
          { id: 'mp1', name: `Central Station West Exit Concourse, ${cityName}` },
          { id: 'mp2', name: `City Terminal Bus Bay 3, ${cityName}` }
        ],
        pickupOptionAvailable: true,
        groupCapacity: product?.maxPax || 25,
        adultCapacity: 25,
        childRules: 'Children 4–11 years eligible for child fare. Under 4 years free on lap.',
        languages: ['English', 'Bilingual English/Japanese'],
        tourVariants: ['Standard Coach Tour', 'Small Group Semi-Private (Max 12)'],
        inclusions: product?.inclusions || ['Air-conditioned luxury coach', 'Professional English tour docent', 'Standard entry admissions'],
        exclusions: product?.exclusions || ['Hotel transfers', 'Personal lunch'],
        addons: [
          { id: 'lunch_box', name: 'Deluxe Japanese Bento Lunch Box', price: 30 },
          { id: 'headset', name: 'Individual Audio Headset Upgrade', price: 10 }
        ],
        adultNetPrice: product?.adultNetPrice || 120,
        childNetPrice: product?.childNetPrice || 75,
        currency: defaultCurrency
      };

    case 'Transfers':
      return {
        routeTitle: prodName,
        fromHubId: product?.hubId || 'hub-tyo',
        fromLocation: `${cityName} Haneda / Narita Airport (Arrival)`,
        toLocation: `${cityName} City Center Hotel / Station`,
        transferType: 'Airport Arrival & Chauffeur Meet-and-Greet',
        operatingTimes: '24 Hours / 7 Days Available',
        allowedVehicles: [
          { id: 'alphard', name: 'Toyota Alphard Executive MPV (Up to 5 Pax, 4 Bags)', capacity: 5, luggageCapacity: 4, surcharge: 0 },
          { id: 'hiace', name: 'Toyota HiAce Commuter Van (Up to 9 Pax, 8 Bags)', capacity: 9, luggageCapacity: 8, surcharge: 60 },
          { id: 'sedan', name: 'Premium Sedan Mercedes E-Class (Up to 3 Pax, 2 Bags)', capacity: 3, luggageCapacity: 2, surcharge: 40 },
          { id: 'coaster', name: 'Toyota Coaster Coach (Up to 18 Pax, 18 Bags)', capacity: 18, luggageCapacity: 18, surcharge: 250 }
        ],
        passengerRules: 'Infants count toward vehicle seating under local road transport law.',
        luggageRules: '1 standard suitcase (28") + 1 carry-on piece per passenger.',
        flightTrackingIncluded: true,
        freeWaitingTimeMinutes: 90,
        nightSurchargePercent: 20,
        baseNetCost: product?.adultNetPrice || 220,
        currency: defaultCurrency
      };

    case 'Tickets':
      return {
        attractionName: prodName,
        destination: product?.destinationName || 'Japan',
        city: cityName,
        ticketPassType: 'Timed Entry Admission Pass',
        availableTimeSlots: ['09:00 - 11:00', '11:00 - 13:00', '13:00 - 15:00', '15:00 - 17:00', '17:00 - 19:00'],
        validityDays: 1,
        entryRules: 'Direct QR Code digital scanning at electronic turnstiles.',
        instantConfirmation: true,
        adultNetPrice: product?.adultNetPrice || 45,
        childNetPrice: product?.childNetPrice || 25,
        infantPolicy: 'Children under 3 free admission without ticket.',
        passVariants: [
          { id: 'std', name: 'General Admission Standard Pass', surcharge: 0 },
          { id: 'vip', name: 'VIP Skip-the-Line Express Entry Pass', surcharge: 35 },
          { id: 'all_access', name: 'All-Inclusive Pass (Admission + Exhibits + Souvenir)', surcharge: 55 }
        ],
        addons: [
          { id: 'audio_guide', name: 'Multilingual Digital Audio Guide Wand', price: 12 },
          { id: 'lounge', name: 'VIP Visitors Lounge Access & Drink Voucher', price: 25 }
        ],
        cancellationPolicy: 'Non-refundable once digital QR is generated.',
        currency: defaultCurrency
      };

    case 'Private Yacht':
      return {
        yachtName: prodName,
        yachtType: 'Luxury Motor Cruiser Flybridge',
        length: '65 ft / 20 meters',
        capacity: product?.maxPax || 12,
        cruisingHub: `${cityName} International Marina`,
        allowedDurationsHours: [2, 3, 4, 6, 8],
        defaultDurationHours: 3,
        operatingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        startTimes: ['10:00 AM', '02:00 PM', '05:30 PM (Sunset Cruise)'],
        crewDetails: 'Certified Yacht Master Captain + 2 First Mates / Stewards',
        includedServices: ['Fuel for standard cruising circuit', 'Soft drinks, bottled mineral water & ice', 'Safety gear & towels', 'Sound system Bluetooth'],
        addons: [
          { id: 'champagne', name: 'French Champagne & Caviar Canapé Board', price: 350 },
          { id: 'bbq', name: 'Teppanyaki Seafood & Wagyu BBQ Grill Onboard', price: 180 },
          { id: 'seaseeker', name: 'Underwater Seabob Water Jet Rental (1 Unit)', price: 250 }
        ],
        baseNetCharterCost: product?.adultNetPrice || 1600,
        currency: defaultCurrency
      };

    case 'Ferries':
      return {
        lineName: prodName,
        departurePort: `${cityName} Port Terminal 1`,
        arrivalPort: `Island South Harbor`,
        crossingTime: product?.duration || '1 Hour 45 Mins',
        schedules: ['08:00 AM', '11:30 AM', '03:00 PM', '06:15 PM'],
        availableClasses: [
          { id: 'std', name: 'Economy Ocean View Seating', surcharge: 0 },
          { id: 'first', name: 'First Class Upper Deck Panoramic Lounge', surcharge: 40 },
          { id: 'private_cabin', name: 'VIP Private Stateroom (Up to 4 Pax)', surcharge: 160 }
        ],
        vehicleAllowed: true,
        vehicleCategories: [
          { id: 'none', name: 'Passenger Only (No Vehicle)', price: 0 },
          { id: 'sedan', name: 'Standard Passenger Car (< 5m)', price: 110 },
          { id: 'van', name: 'Van / MPV (< 6m)', price: 160 }
        ],
        adultNetPrice: product?.adultNetPrice || 65,
        childNetPrice: product?.childNetPrice || 35,
        currency: defaultCurrency
      };

    case 'Guides':
      return {
        guideServiceTitle: prodName,
        destination: product?.destinationName || 'Japan',
        serviceHub: cityName,
        licenseType: 'National Government Licensed Interpreter Guide (JNTO Certified)',
        languagesOffered: ['English', 'French', 'Spanish', 'German', 'Italian', 'Japanese'],
        defaultLanguage: 'English',
        durationsAvailable: ['Half Day (4 Hours)', 'Full Day (8 Hours)', 'Extended Evening (10 Hours)'],
        defaultDuration: 'Full Day (8 Hours)',
        operatingHours: '09:00 - 17:00',
        specialties: ['Art, Architecture & Modern History', 'Culinary & Sake Culture', 'Buddhist & Shinto Heritage', 'Luxury Shopping & Lifestyle'],
        meetingFormat: 'Hotel Lobby Meet & Accompany',
        expensesPolicy: 'Guide public transport within city center included. Client pays museum entry if guide enters.',
        baseDailyNetRate: product?.adultNetPrice || 280,
        overtimeHourlyNetRate: 40,
        currency: defaultCurrency
      };

    case 'Hotels':
      return {
        hotelName: prodName,
        destination: product?.destinationName || 'Japan',
        city: cityName,
        starRating: 5,
        propertyType: '5-Star Luxury City Hotel & Spa',
        roomCategories: [
          {
            id: 'room-dlx',
            name: 'Deluxe City View Room',
            maxOccupancy: 3,
            sizeSqm: 42,
            bedding: 'King or Twin',
            baseNetNightlyRate: product?.adultNetPrice || 320
          },
          {
            id: 'room-exec',
            name: 'Executive Horizon Suite with Lounge Access',
            maxOccupancy: 3,
            sizeSqm: 68,
            bedding: 'King Bed',
            baseNetNightlyRate: (product?.adultNetPrice || 320) * 1.5
          }
        ],
        mealPlans: [
          { code: 'RO', name: 'Room Only (No Meals)', surcharge: 0 },
          { code: 'BB', name: 'Daily International Buffet Breakfast Included', surcharge: 35 },
          { code: 'HB', name: 'Half Board (Breakfast + 4-Course Kaiseki Dinner)', surcharge: 110 }
        ],
        checkInTime: '15:00',
        checkOutTime: '12:00',
        cancellationPolicy: 'Free cancellation up to 7 days prior to arrival.',
        currency: defaultCurrency
      };

    case 'Visa & Ancillary Services':
      return {
        serviceCategory: 'Government Visa Facilitation & Traveler Ancillaries',
        visaOptions: [
          { id: 'evisa', name: 'Standard Tourist Electronic eVisa (Single Entry, 90 Days)', embassyFee: 25, serviceFee: 45, processingTime: '3-5 Business Days' },
          { id: 'multiple', name: 'Multiple-Entry 3-Year Tourism Visa', embassyFee: 65, serviceFee: 75, processingTime: '5-7 Business Days' },
          { id: 'urgent', name: 'Urgent Expedited eVisa (24-48 Hours Express)', embassyFee: 40, serviceFee: 95, processingTime: '24-48 Hours' }
        ],
        ancillaryPackages: [
          { id: 'vip_airport', name: 'VIP Tarmac Meet & Assist + Fast Track Immigration', price: 160 },
          { id: 'travel_insurance', name: 'Comprehensive Medical & Travel Protection Plan ($100k Coverage)', price: 45 },
          { id: '5g_esim', name: 'Unlimited 5G High-Speed Data eSIM (15 Days)', price: 32 }
        ],
        supportedNationalities: ['India', 'USA', 'UK', 'Australia', 'UAE', 'Singapore', 'Canada'],
        requiredDocuments: ['Valid Passport (6+ Months)', 'Confirmed Flight Reservation', 'Hotel Accommodation Itinerary', 'Recent Passport Sized Photo'],
        currency: defaultCurrency
      };

    case 'Rail / Shinkansen':
      return {
        systemName: 'SmartEX Shinkansen Bullet Train High-Speed Network',
        routeNetwork: 'Tokaido, Sanyo, Kyushu & Hokuriku Lines',
        defaultStationPair: {
          originStationId: 'JP-ST-TOKYO',
          originStationName: 'Tokyo Central',
          destinationStationId: 'JP-ST-KYOTO',
          destinationStationName: 'Kyoto Central'
        },
        carClassesAvailable: [
          { id: 'ORD_RESERVED', name: 'Ordinary Car (Reserved Seat)', speed: 'Nozomi Express', baseNet: 140 },
          { id: 'GREEN_RESERVED', name: 'Green Car (First Class Luxury Executive Seating)', speed: 'Nozomi Express', baseNet: 195 },
          { id: 'GRAN_CLASS', name: 'Gran Class (Ultra-Luxury Premium with Attendant)', speed: 'Hayabusa / Kagayaki', baseNet: 280 }
        ],
        seatPreferences: ['Window Seat (Mount Fuji View)', 'Aisle Seat', 'Seats Together', 'Rear Row Oversized Baggage Seat'],
        luggagePolicy: 'Oversized baggage area reservation included for cases over 160cm total dimensions.',
        ticketDeliveryMode: 'Digital QR Code on Smartphone / Physical Station Ticket Machine Exchange',
        currency: defaultCurrency
      };

    case 'Lunch / Dinner Restaurant':
      return {
        restaurantName: prodName,
        destination: product?.destinationName || 'Japan',
        city: cityName,
        cuisineType: 'Authentic Kaiseki & Michelin-Star Fine Dining',
        availableMeals: ['Lunch', 'Dinner'],
        lunchHours: '11:30 - 14:30',
        dinnerHours: '17:30 - 22:00',
        seatingOptions: ['Main Dining Hall', 'Traditional Tatami Private Room', 'Chef Counter Seating'],
        courseMenus: [
          { id: 'seasonal', name: 'Seasonal Chef Tasting Course (7 Courses)', price: 95 },
          { id: 'kaiseki', name: 'Premium Kyoto Wagyu & Seasonal Seafood Kaiseki (9 Courses)', price: 165 },
          { id: 'omakase', name: 'Grand Master Omakase with Sommelier Sake Pairing', price: 250 }
        ],
        dietaryAccommodations: ['Vegetarian Friendly', 'Gluten Free Option', 'No Shellfish', 'No Pork / Halal Certified Ingredients Available', 'No Raw Fish'],
        cancellationPolicy: 'Full refund up to 48 hours prior. 100% cancellation fee within 24 hours due to fresh market procurement.',
        currency: defaultCurrency
      };

    default:
      return {
        productName: prodName,
        category,
        minPax: product?.minPax || 1,
        maxPax: product?.maxPax || 10,
        currency: defaultCurrency
      };
  }
}

/**
 * Builds or updates the authoritative Level 1 Master Product Configuration for any product.
 */
export function buildMasterProductConfiguration(
  category: AuthoritativeProductCategory,
  product: Partial<Product>,
  customConfigurationData?: Record<string, any>,
  user?: any,
  existingConfig?: any
) {
  const identity = generateConfigurationIdentity(
    category,
    product.id || `prod-${Date.now()}`,
    existingConfig?.configuration_id
  );

  const defaultData = getDefaultConfigurationDataForCategory(category, product);
  const mergedData = {
    ...defaultData,
    ...(existingConfig?.configuration_data || {}),
    ...(customConfigurationData || {})
  };

  return {
    configuration_id: identity.configuration_id,
    product_id: product.id || identity.product_id,
    product_category: category,
    configurator_type: identity.configurator_type,
    configuration_version: (existingConfig?.configuration_version || 0) + 1,
    configuration_schema_version: '2.0.0',
    configuration_data: mergedData,
    status: (product.status || 'ACTIVE') as 'ACTIVE' | 'DRAFT' | 'ARCHIVED',
    created_at: existingConfig?.created_at || identity.created_at,
    updated_at: new Date().toISOString(),
    created_by: existingConfig?.created_by || user?.email || 'admin@theunbound.in',
    updated_by: user?.email || 'admin@theunbound.in'
  };
}

/**
 * Guarantees that any product has a valid, first-class Master Product Configuration.
 */
export function ensureMasterProductConfiguration(product: Product, user?: any): Product {
  const authoritativeCat = resolveAuthoritativeCategory(product);
  
  if (!product.configuration || product.configuration.product_category !== authoritativeCat) {
    const masterConfig = buildMasterProductConfiguration(
      authoritativeCat,
      product,
      product.configuration?.configuration_data || product.metadata?.configuration_payload || {},
      user,
      product.configuration
    );
    return {
      ...product,
      category: authoritativeCat as any,
      configuration: masterConfig
    };
  }

  return product;
}

/**
 * ============================================================================
 * FIELD CLASSIFICATION & CANONICAL GOVERNANCE MATRIX (Sections 3, 5, 25, 26)
 * ============================================================================
 */
export type FieldClassification = 
  | 'MASTER_ADMIN_MANAGED' // Admin controls it in Product Management
  | 'CONFIGURABLE'         // Agent selects/changes while building Quote / Cart
  | 'PRICING'              // Controlled by central pricing engine
  | 'SYSTEM'               // Internal technical metadata
  | 'REMOVE';              // Irregular / obsolete / prohibited in production

export interface CanonicalFieldDefinition {
  fieldName: string;
  classification: FieldClassification;
  description: string;
  source: 'PRODUCT_MANAGEMENT' | 'CENTRAL_PRICING_ENGINE' | 'CONFIGURATOR_SELECTION' | 'SYSTEM';
  affectsPricing: boolean;
  affectsBooking: boolean;
}

export interface CategoryFieldRegistryEntry {
  categoryEnum: ProductCategoryEnum;
  categoryDisplay: AuthoritativeProductCategory;
  pricingModel: 'capacity_based' | 'per_person' | 'hourly_based' | 'fixed_stay' | 'journey_graph';
  masterFields: string[];
  configurableFields: string[];
  pricingFields: string[];
  systemFields: string[];
  prohibitedFields: string[];
  fieldDefinitions: CanonicalFieldDefinition[];
  requiredFieldsForSave: (keyof Product | string)[];
}

/**
 * Authoritative Field Registry for all 11 Categories (Section 5 & 25)
 */
export const CATEGORY_FIELD_REGISTRY: Record<ProductCategoryEnum, CategoryFieldRegistryEntry> = {
  PRIVATE_TOURS: {
    categoryEnum: 'PRIVATE_TOURS',
    categoryDisplay: 'Private Tours',
    pricingModel: 'capacity_based',
    masterFields: [
      'name', 'sku', 'regionId', 'destinationId', 'hubId', 'city', 'country',
      'shortDescription', 'longDescription', 'summary', 'description',
      'inclusions', 'exclusions', 'importantInformation',
      'vehicleConfig', 'tieredPricing', 'images', 'upsells', 'status'
    ],
    configurableFields: [
      'travelDate', 'serviceTime', 'durationHours', 'vehicleOption',
      'guideLanguage', 'pickupLocation', 'dropoffLocation', 'selectedUpsellIds', 'notes'
    ],
    pricingFields: [
      'adultNetPrice', 'currency', 'defaultMarkupPercent', 'buyerMarkupPercent',
      'b2bAgentMarkupPercent', 'tieredPricing', 'unitVehicleNetCost', 'maxSeats'
    ],
    systemFields: ['id', 'product_id', 'created_at', 'updated_at', 'lastUpdated', 'version'],
    prohibitedFields: ['custom_vehicle_cost', 'unregistered_surcharge', 'hardcoded_addons'],
    fieldDefinitions: [
      { fieldName: 'name', classification: 'MASTER_ADMIN_MANAGED', description: 'Product title', source: 'PRODUCT_MANAGEMENT', affectsPricing: false, affectsBooking: true },
      { fieldName: 'vehicleConfig', classification: 'MASTER_ADMIN_MANAGED', description: 'Vehicle model, capacity & specs', source: 'PRODUCT_MANAGEMENT', affectsPricing: true, affectsBooking: true },
      { fieldName: 'upsells', classification: 'MASTER_ADMIN_MANAGED', description: 'Optional Experience Upgrades', source: 'PRODUCT_MANAGEMENT', affectsPricing: true, affectsBooking: true },
      { fieldName: 'vehicleOption', classification: 'CONFIGURABLE', description: 'Selected vehicle category', source: 'CONFIGURATOR_SELECTION', affectsPricing: true, affectsBooking: true },
      { fieldName: 'selectedUpsellIds', classification: 'CONFIGURABLE', description: 'Agent selected upsell experiences', source: 'CONFIGURATOR_SELECTION', affectsPricing: true, affectsBooking: true },
      { fieldName: 'tieredPricing', classification: 'PRICING', description: 'Capacity based pricing tiers', source: 'CENTRAL_PRICING_ENGINE', affectsPricing: true, affectsBooking: true }
    ],
    requiredFieldsForSave: ['name', 'destinationId', 'currency']
  },

  GROUP_TOURS: {
    categoryEnum: 'GROUP_TOURS',
    categoryDisplay: 'Group Tours',
    pricingModel: 'per_person',
    masterFields: [
      'name', 'sku', 'regionId', 'destinationId', 'hubId', 'city', 'country',
      'pickupPoint', 'dropoffPoint', 'shortDescription', 'longDescription',
      'summary', 'description', 'inclusions', 'exclusions', 'maxPax',
      'operatingDays', 'operatingHours', 'images', 'upsells', 'status'
    ],
    configurableFields: [
      'travelDate', 'departureSlot', 'pickupOption', 'adults', 'children',
      'infants', 'selectedUpsellIds', 'notes'
    ],
    pricingFields: [
      'adultNetPrice', 'childNetPrice', 'infantNetPrice', 'currency',
      'defaultMarkupPercent', 'buyerMarkupPercent', 'b2bAgentMarkupPercent'
    ],
    systemFields: ['id', 'product_id', 'created_at', 'updated_at', 'lastUpdated'],
    prohibitedFields: ['fake_booked_seats', 'arbitrary_group_surcharge'],
    fieldDefinitions: [
      { fieldName: 'name', classification: 'MASTER_ADMIN_MANAGED', description: 'Tour title', source: 'PRODUCT_MANAGEMENT', affectsPricing: false, affectsBooking: true },
      { fieldName: 'pickupPoint', classification: 'MASTER_ADMIN_MANAGED', description: 'Designated meeting point', source: 'PRODUCT_MANAGEMENT', affectsPricing: false, affectsBooking: true },
      { fieldName: 'adults', classification: 'CONFIGURABLE', description: 'Number of adult passengers', source: 'CONFIGURATOR_SELECTION', affectsPricing: true, affectsBooking: true },
      { fieldName: 'selectedUpsellIds', classification: 'CONFIGURABLE', description: 'Agent selected upsells', source: 'CONFIGURATOR_SELECTION', affectsPricing: true, affectsBooking: true },
      { fieldName: 'adultNetPrice', classification: 'PRICING', description: 'Per person adult net rate', source: 'CENTRAL_PRICING_ENGINE', affectsPricing: true, affectsBooking: true }
    ],
    requiredFieldsForSave: ['name', 'destinationId', 'currency', 'adultNetPrice']
  },

  TRANSFERS: {
    categoryEnum: 'TRANSFERS',
    categoryDisplay: 'Transfers',
    pricingModel: 'capacity_based',
    masterFields: [
      'name', 'sku', 'regionId', 'destinationId', 'fromHubId', 'toHubId',
      'fromHubName', 'toHubName', 'vehicleConfig', 'shortDescription',
      'longDescription', 'inclusions', 'exclusions', 'images', 'upsells', 'status'
    ],
    configurableFields: [
      'travelDate', 'pickupTime', 'flightNumber', 'vehicleClass',
      'adults', 'children', 'infants', 'selectedUpsellIds', 'notes'
    ],
    pricingFields: [
      'adultNetPrice', 'currency', 'defaultMarkupPercent', 'unitVehicleNetCost', 'maxSeats'
    ],
    systemFields: ['id', 'product_id', 'created_at', 'updated_at'],
    prohibitedFields: ['free_text_route_without_hubs', 'unverified_toll_fees'],
    fieldDefinitions: [
      { fieldName: 'fromHubId', classification: 'MASTER_ADMIN_MANAGED', description: 'Origin City Hub ID', source: 'PRODUCT_MANAGEMENT', affectsPricing: true, affectsBooking: true },
      { fieldName: 'toHubId', classification: 'MASTER_ADMIN_MANAGED', description: 'Destination City Hub ID', source: 'PRODUCT_MANAGEMENT', affectsPricing: true, affectsBooking: true },
      { fieldName: 'flightNumber', classification: 'CONFIGURABLE', description: 'Flight code for airport meet', source: 'CONFIGURATOR_SELECTION', affectsPricing: false, affectsBooking: true },
      { fieldName: 'selectedUpsellIds', classification: 'CONFIGURABLE', description: 'Selected transfer add-ons/upsells', source: 'CONFIGURATOR_SELECTION', affectsPricing: true, affectsBooking: true }
    ],
    requiredFieldsForSave: ['name', 'fromHubId', 'toHubId', 'currency']
  },

  TICKETS: {
    categoryEnum: 'TICKETS',
    categoryDisplay: 'Tickets',
    pricingModel: 'per_person',
    masterFields: [
      'name', 'sku', 'regionId', 'destinationId', 'hubId', 'ticketConfig',
      'shortDescription', 'longDescription', 'inclusions', 'exclusions',
      'images', 'upsells', 'status'
    ],
    configurableFields: [
      'travelDate', 'ticketTierId', 'timeSlot', 'adults', 'children',
      'infants', 'selectedUpsellIds', 'notes'
    ],
    pricingFields: [
      'adultNetPrice', 'childNetPrice', 'infantNetPrice', 'currency',
      'ticketTiers', 'defaultMarkupPercent'
    ],
    systemFields: ['id', 'product_id', 'created_at', 'updated_at'],
    prohibitedFields: ['fake_pass_types', 'unsupported_qr_format'],
    fieldDefinitions: [
      { fieldName: 'ticketConfig', classification: 'MASTER_ADMIN_MANAGED', description: 'Ticket types, tiers & time slots', source: 'PRODUCT_MANAGEMENT', affectsPricing: true, affectsBooking: true },
      { fieldName: 'ticketTierId', classification: 'CONFIGURABLE', description: 'Selected ticket tier option', source: 'CONFIGURATOR_SELECTION', affectsPricing: true, affectsBooking: true },
      { fieldName: 'timeSlot', classification: 'CONFIGURABLE', description: 'Admission entry time slot', source: 'CONFIGURATOR_SELECTION', affectsPricing: false, affectsBooking: true },
      { fieldName: 'selectedUpsellIds', classification: 'CONFIGURABLE', description: 'Selected ticket upsells', source: 'CONFIGURATOR_SELECTION', affectsPricing: true, affectsBooking: true }
    ],
    requiredFieldsForSave: ['name', 'destinationId', 'currency']
  },

  GUIDES: {
    categoryEnum: 'GUIDES',
    categoryDisplay: 'Guides',
    pricingModel: 'hourly_based',
    masterFields: [
      'name', 'sku', 'regionId', 'destinationId', 'hubId', 'guideConfig',
      'hourlyPrice', 'hourlyNettCost', 'minHours', 'shortDescription',
      'longDescription', 'inclusions', 'exclusions', 'images', 'upsells', 'status'
    ],
    configurableFields: [
      'travelDate', 'startTime', 'durationHours', 'language',
      'meetingLocation', 'selectedUpsellIds', 'notes'
    ],
    pricingFields: [
      'hourlyPrice', 'hourlyNettCost', 'minHours', 'currency', 'defaultMarkupPercent'
    ],
    systemFields: ['id', 'product_id', 'created_at', 'updated_at'],
    prohibitedFields: ['unregistered_guide_languages', 'arbitrary_tips'],
    fieldDefinitions: [
      { fieldName: 'guideConfig', classification: 'MASTER_ADMIN_MANAGED', description: 'Languages, license & duration rates', source: 'PRODUCT_MANAGEMENT', affectsPricing: true, affectsBooking: true },
      { fieldName: 'language', classification: 'CONFIGURABLE', description: 'Selected guide language', source: 'CONFIGURATOR_SELECTION', affectsPricing: false, affectsBooking: true },
      { fieldName: 'durationHours', classification: 'CONFIGURABLE', description: 'Charter duration in hours', source: 'CONFIGURATOR_SELECTION', affectsPricing: true, affectsBooking: true }
    ],
    requiredFieldsForSave: ['name', 'destinationId', 'currency']
  },

  RESTAURANT: {
    categoryEnum: 'RESTAURANT',
    categoryDisplay: 'Lunch / Dinner Restaurant',
    pricingModel: 'per_person',
    masterFields: [
      'name', 'restaurantName', 'specialty', 'city', 'country',
      'mealSelect', 'restaurantConfig', 'shortDescription',
      'images', 'status'
    ],
    configurableFields: [
      'travelDate', 'serviceTime', 'mealType', 'courseMenuId',
      'adults', 'children', 'dietaryRequirements', 'selectedUpsellIds', 'notes'
    ],
    pricingFields: ['adultNetPrice', 'currency', 'defaultMarkupPercent', 'courseMenus'],
    systemFields: ['id', 'product_id', 'created_at', 'updated_at'],
    prohibitedFields: ['non_dining_options', 'vehicle_fields_in_dining'],
    fieldDefinitions: [
      { fieldName: 'mealSelect', classification: 'MASTER_ADMIN_MANAGED', description: 'Supported meal regimes (Breakfast/Lunch/Dinner)', source: 'PRODUCT_MANAGEMENT', affectsPricing: true, affectsBooking: true },
      { fieldName: 'mealType', classification: 'CONFIGURABLE', description: 'Selected meal category', source: 'CONFIGURATOR_SELECTION', affectsPricing: true, affectsBooking: true },
      { fieldName: 'dietaryRequirements', classification: 'CONFIGURABLE', description: 'Special dietary restrictions', source: 'CONFIGURATOR_SELECTION', affectsPricing: false, affectsBooking: true }
    ],
    requiredFieldsForSave: ['name', 'city', 'currency']
  },

  PRIVATE_YACHT: {
    categoryEnum: 'PRIVATE_YACHT',
    categoryDisplay: 'Private Yacht',
    pricingModel: 'capacity_based',
    masterFields: [
      'name', 'sku', 'regionId', 'destinationId', 'hubId', 'vehicleConfig',
      'shortDescription', 'longDescription', 'inclusions', 'exclusions',
      'images', 'upsells', 'status'
    ],
    configurableFields: [
      'travelDate', 'departureTime', 'durationHours', 'adults', 'children',
      'selectedUpsellIds', 'notes'
    ],
    pricingFields: [
      'adultNetPrice', 'currency', 'defaultMarkupPercent', 'unitVehicleNetCost', 'maxSeats'
    ],
    systemFields: ['id', 'product_id', 'created_at', 'updated_at'],
    prohibitedFields: ['separate_yacht_pricing_engine', 'unlicensed_vessel_options'],
    fieldDefinitions: [
      { fieldName: 'vehicleConfig', classification: 'MASTER_ADMIN_MANAGED', description: 'Yacht specs, capacity & crew', source: 'PRODUCT_MANAGEMENT', affectsPricing: true, affectsBooking: true },
      { fieldName: 'durationHours', classification: 'CONFIGURABLE', description: 'Charter cruising duration', source: 'CONFIGURATOR_SELECTION', affectsPricing: true, affectsBooking: true }
    ],
    requiredFieldsForSave: ['name', 'destinationId', 'currency']
  },

  FERRIES: {
    categoryEnum: 'FERRIES',
    categoryDisplay: 'Ferries',
    pricingModel: 'per_person',
    masterFields: [
      'name', 'sku', 'regionId', 'destinationId', 'ferryConfig',
      'shortDescription', 'inclusions', 'exclusions', 'images', 'upsells', 'status'
    ],
    configurableFields: [
      'travelDate', 'departureSlot', 'cabinClass', 'adults', 'children',
      'vehicleCarriage', 'selectedUpsellIds', 'notes'
    ],
    pricingFields: ['adultNetPrice', 'childNetPrice', 'currency', 'defaultMarkupPercent'],
    systemFields: ['id', 'product_id', 'created_at', 'updated_at'],
    prohibitedFields: ['unsupported_port_codes'],
    fieldDefinitions: [
      { fieldName: 'ferryConfig', classification: 'MASTER_ADMIN_MANAGED', description: 'Port pairs, schedules & cabin classes', source: 'PRODUCT_MANAGEMENT', affectsPricing: true, affectsBooking: true }
    ],
    requiredFieldsForSave: ['name', 'destinationId', 'currency']
  },

  HOTELS: {
    categoryEnum: 'HOTELS',
    categoryDisplay: 'Hotels',
    pricingModel: 'fixed_stay',
    masterFields: ['hotelName', 'roomTypes', 'rates', 'starRating', 'city', 'images', 'status'],
    configurableFields: ['checkInDate', 'checkOutDate', 'roomTypeId', 'mealPlanCode', 'roomsCount', 'guests'],
    pricingFields: ['doubleNetRate', 'singleNetRate', 'currency', 'markupPercent'],
    systemFields: ['id', 'hotelId', 'created_at'],
    prohibitedFields: ['product_fields_in_hotel_module'],
    fieldDefinitions: [
      { fieldName: 'roomTypes', classification: 'MASTER_ADMIN_MANAGED', description: 'Authoritative property room categories', source: 'PRODUCT_MANAGEMENT', affectsPricing: true, affectsBooking: true }
    ],
    requiredFieldsForSave: ['name', 'city']
  },

  SHINKANSEN: {
    categoryEnum: 'SHINKANSEN',
    categoryDisplay: 'Rail / Shinkansen',
    pricingModel: 'journey_graph',
    masterFields: ['routeId', 'originStationId', 'destinationStationId', 'rates', 'carClasses', 'status'],
    configurableFields: ['travelDate', 'originStation', 'destinationStation', 'carClass', 'trainName', 'passengers'],
    pricingFields: ['baseFare', 'superExpressFare', 'currency', 'markupPercent'],
    systemFields: ['id', 'route_code'],
    prohibitedFields: ['arbitrary_non_station_stops'],
    fieldDefinitions: [
      { fieldName: 'originStationId', classification: 'MASTER_ADMIN_MANAGED', description: 'Valid SmartEX origin station code', source: 'PRODUCT_MANAGEMENT', affectsPricing: true, affectsBooking: true }
    ],
    requiredFieldsForSave: ['name']
  },

  VISA_ANCILLARY: {
    categoryEnum: 'VISA_ANCILLARY',
    categoryDisplay: 'Visa & Ancillary Services',
    pricingModel: 'per_person',
    masterFields: ['serviceCategory', 'visaOptions', 'ancillaryPackages', 'supportedNationalities', 'requiredDocuments'],
    configurableFields: ['applicantNationality', 'visaType', 'processingSpeed', 'selectedAncillaryIds', 'applicants'],
    pricingFields: ['embassyFee', 'serviceFee', 'currency'],
    systemFields: ['id', 'service_id'],
    prohibitedFields: ['ai_hallucinated_visa_rules'],
    fieldDefinitions: [
      { fieldName: 'visaOptions', classification: 'MASTER_ADMIN_MANAGED', description: 'Authoritative government visa requirements', source: 'PRODUCT_MANAGEMENT', affectsPricing: true, affectsBooking: true }
    ],
    requiredFieldsForSave: ['name']
  }
};

/**
 * ============================================================================
 * PRODUCT-BASED UPSELL & CROSS-SELL ARCHITECTURE (Sections 1-35)
 * ============================================================================
 */

/**
 * Validates upsell relationship constraints:
 * 1. Self-upsell protection (Section 26)
 * 2. Duplicate relationship protection (Section 25)
 * 3. Circular upsell protection (Section 27)
 * 4. Active status validation (Section 5)
 */
export function validateUpsellRelationship(
  parentProductId: string,
  targetProduct: Product,
  existingUpsells: ProductUpsell[] = [],
  allProducts: Product[] = []
): { isValid: boolean; error?: string; warning?: string } {
  const targetId = targetProduct.id || targetProduct.product_id;
  if (!targetId || !parentProductId) {
    return { isValid: false, error: 'Both parent product and target product IDs are required.' };
  }

  // 1. Self-Upsell Protection (Section 26)
  if (parentProductId === targetId) {
    return {
      isValid: false,
      error: 'Self-Upsell Prohibited: A product cannot be configured as an upsell for itself.'
    };
  }

  // 2. Duplicate Protection (Section 25)
  const isDuplicate = existingUpsells.some(u => {
    const existingTargetId = u.upsellProductId || u.id;
    return (existingTargetId === targetId || u.name.toLowerCase() === targetProduct.name.toLowerCase()) && u.status !== 'ARCHIVED';
  });
  if (isDuplicate) {
    return {
      isValid: false,
      error: `Duplicate Relationship Prohibited: "${targetProduct.name}" is already linked as an upsell.`
    };
  }

  // 3. Status Validation (Section 5)
  if (targetProduct.status && targetProduct.status !== 'ACTIVE') {
    return {
      isValid: false,
      error: `Only active products can be added as upsells. "${targetProduct.name}" is currently ${targetProduct.status}.`
    };
  }

  // 4. Circular Upsell Protection (Section 27)
  if (Array.isArray(targetProduct.upsells) && targetProduct.upsells.length > 0) {
    const targetHasParentAsUpsell = targetProduct.upsells.some(u => 
      (u.upsellProductId === parentProductId || u.productId === parentProductId) && u.status === 'ACTIVE'
    );
    if (targetHasParentAsUpsell) {
      return {
        isValid: false,
        error: `Circular Upsell Detected: "${targetProduct.name}" already lists this product as an upsell. Circular dependencies are prohibited.`
      };
    }
  }

  return { isValid: true };
}

/**
 * Creates an authoritative Product-Based Upsell Relationship (Section 1-10)
 * Does NOT duplicate the product record; references the live master product ID.
 */
export function createProductUpsellRelationship(
  parent: Partial<Product>,
  targetProduct: Product,
  options?: {
    displayOrder?: number;
    customLabel?: string;
    internalNotes?: string;
    priceType?: 'PER_PERSON' | 'PER_BOOKING' | 'PER_VEHICLE' | 'PER_DAY' | 'HOURLY';
  }
): ProductUpsell {
  const parentId = parent.id || parent.product_id || '';
  const targetId = targetProduct.id || targetProduct.product_id || '';
  const relId = `rel-${parentId || 'prd'}-${targetId}`;

  // Starting selling price derived directly from master product
  const basePrice = targetProduct.sellingPriceStartingFrom || 
    (targetProduct.hourlyPrice || targetProduct.adultNetPrice || 0);

  const baseNet = targetProduct.adultNetPrice || targetProduct.hourlyNettCost || 
    Math.round(basePrice * 0.75);

  return {
    id: relId,
    relationshipId: relId,
    parentProductId: parentId,
    productId: parentId,
    upsellProductId: targetId,
    isExistingProduct: true,
    name: targetProduct.name,
    sku: targetProduct.sku || '',
    shortDescription: targetProduct.shortDescription || targetProduct.summary || '',
    description: targetProduct.longDescription || targetProduct.description || '',
    price: basePrice,
    netCost: baseNet,
    currency: targetProduct.currency || parent.currency || 'USD',
    status: 'ACTIVE',
    displayOrder: options?.displayOrder || ((parent.upsells?.length || 0) + 1),
    category: targetProduct.category,
    destinationId: targetProduct.destinationId,
    destinationName: targetProduct.destinationName,
    hubId: targetProduct.hubId || targetProduct.cityHubId,
    imageUrl: targetProduct.images?.[0] || targetProduct.heroImage,
    supplierId: targetProduct.supplierId,
    supplierName: targetProduct.supplierName,
    priceType: options?.priceType || (targetProduct.category === 'Guides' ? 'HOURLY' : 'PER_PERSON'),
    customLabel: options?.customLabel,
    internalNotes: options?.internalNotes,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

/**
 * Resolves live master product data for all upsells attached to a product (Section 8-10).
 * Preserves relationships while dynamically reflecting live master changes (title, image, price, category).
 */
export function resolveProductUpsells(
  product: Partial<Product> | null | undefined,
  allProducts: Product[] = []
): ProductUpsell[] {
  if (!product) return [];

  // 1. Primary: product.upsells with live resolution for explicit selections
  const rawUpsells = product.upsells || [];
  if (Array.isArray(rawUpsells) && rawUpsells.length > 0) {
    const productsMap = new Map<string, Product>();
    for (const p of allProducts) {
      if (p.id) productsMap.set(p.id, p);
      if (p.product_id) productsMap.set(p.product_id, p);
      if (p.sku) productsMap.set(p.sku, p);
    }

    return rawUpsells.map(upsell => {
      if (upsell.upsellProductId && productsMap.has(upsell.upsellProductId)) {
        const liveProduct = productsMap.get(upsell.upsellProductId)!;
        return {
          ...upsell,
          isExistingProduct: true,
          name: liveProduct.name,
          sku: liveProduct.sku,
          shortDescription: liveProduct.shortDescription || liveProduct.summary || upsell.shortDescription,
          description: liveProduct.longDescription || liveProduct.description || upsell.description,
          price: liveProduct.sellingPriceStartingFrom || upsell.price,
          netCost: liveProduct.adultNetPrice || upsell.netCost,
          currency: liveProduct.currency || upsell.currency,
          category: liveProduct.category || upsell.category,
          destinationId: liveProduct.destinationId || upsell.destinationId,
          destinationName: liveProduct.destinationName || upsell.destinationName,
          hubId: liveProduct.hubId || upsell.hubId,
          imageUrl: liveProduct.images?.[0] || liveProduct.heroImage || upsell.imageUrl,
          supplierId: liveProduct.supplierId || upsell.supplierId,
          supplierName: liveProduct.supplierName || upsell.supplierName
        };
      }
      return upsell;
    });
  }

  // 2. Explicit optionalUpgradeProductIds tagged in Product Management
  if (Array.isArray(product.optionalUpgradeProductIds) && product.optionalUpgradeProductIds.length > 0) {
    const productsMap = new Map<string, Product>();
    for (const p of allProducts) {
      if (p.id) productsMap.set(p.id, p);
    }

    const resolved: ProductUpsell[] = [];
    product.optionalUpgradeProductIds.forEach((id, idx) => {
      const liveProduct = productsMap.get(id);
      if (liveProduct) {
        resolved.push({
          id: `upsell-upgrade-${id}`,
          productId: product.id || '',
          upsellProductId: liveProduct.id,
          isExistingProduct: true,
          name: liveProduct.name,
          sku: liveProduct.sku,
          shortDescription: liveProduct.shortDescription || liveProduct.summary || '',
          description: liveProduct.longDescription || liveProduct.description || '',
          price: liveProduct.sellingPriceStartingFrom || liveProduct.adultNetPrice || 0,
          netCost: liveProduct.adultNetPrice || 0,
          currency: liveProduct.currency || 'USD',
          status: 'ACTIVE',
          displayOrder: idx + 1,
          priceType: 'PER_PERSON'
        });
      }
    });
    return resolved;
  }

  // Strictly no automatic or implicit upsells if none were explicitly selected
  return [];
}

/**
 * Returns active, selectable Upsells for any product (Section 16-22, 40)
 */
export function getActiveUpsellsForProduct(
  product: Partial<Product> | null | undefined,
  allProducts: Product[] = []
): ProductUpsell[] {
  if (!product) return [];
  
  const resolved = resolveProductUpsells(product, allProducts);
  return resolved
    .filter(u => u && u.status !== 'INACTIVE' && u.status !== 'ARCHIVED')
    .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
}

/**
 * Creates a frozen historical upsell snapshot when adding to Quote / Booking (Section 22, 34)
 */
export function createUpsellSnapshot(
  upsell: ProductUpsell,
  quantity: number = 1
): SelectedUpsellSnapshot {
  return {
    upsellId: upsell.id,
    upsellProductId: upsell.upsellProductId,
    isExistingProduct: upsell.isExistingProduct,
    parentProductId: upsell.parentProductId || upsell.productId,
    upsellNameSnapshot: upsell.name,
    categorySnapshot: upsell.category,
    skuSnapshot: upsell.sku,
    supplierIdSnapshot: upsell.supplierId,
    supplierNameSnapshot: upsell.supplierName,
    imageUrlSnapshot: upsell.imageUrl,
    priceSnapshot: upsell.price,
    netCostSnapshot: upsell.netCost,
    currencySnapshot: upsell.currency,
    selectedAt: new Date().toISOString(),
    quantity,
    priceType: upsell.priceType || 'PER_PERSON',
    customLabel: upsell.customLabel
  };
}

/**
 * Category Field Governance validator (Section 38, 44, 45)
 */
export function validateProductCategoryGovernance(product: Partial<Product>): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  const categoryEnum = resolveProductCategoryEnum(product);
  if (!categoryEnum) {
    errors.push('Cannot resolve authoritative product category.');
    return { isValid: false, errors, warnings };
  }

  const registry = CATEGORY_FIELD_REGISTRY[categoryEnum];
  if (!registry) {
    errors.push(`No field registry found for category: ${categoryEnum}`);
    return { isValid: false, errors, warnings };
  }

  // Check required fields
  for (const field of registry.requiredFieldsForSave) {
    const val = (product as any)[field];
    if (val === undefined || val === null || val === '') {
      errors.push(`Missing required field '${String(field)}' for category ${registry.categoryDisplay}.`);
    }
  }

  // Enforce Category Isolation (Section 30)
  if (categoryEnum !== 'TRANSFERS' && (product.fromHubId || product.toHubId)) {
    warnings.push(`Transfer route hubs found on non-transfer product (${categoryEnum}).`);
  }
  if (categoryEnum !== 'RESTAURANT' && product.mealSelect && product.mealSelect.length > 0) {
    warnings.push(`Meal selections found on non-restaurant product (${categoryEnum}).`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}


