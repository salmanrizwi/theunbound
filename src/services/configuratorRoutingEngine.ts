import { Product, QuoteItem, Hotel } from '../types';
import { 
  resolveProductCategoryEnum, 
  isHotelProductOrItem, 
  isShinkansenProductOrItem, 
  isVisaProductOrItem,
  getConfiguratorForProduct,
  ConfiguratorRegistry,
  DedicatedConfiguratorType as RegistryConfiguratorType
} from './configuratorRegistry';

export type AuthoritativeServiceCategory = 
  | 'HOTEL'
  | 'SHINKANSEN'
  | 'ACTIVITY_EXPERIENCE'
  | 'VISA'
  | 'ADDON'
  | 'OTHER';

export type DedicatedConfiguratorType =
  | 'HOTEL_CONFIGURATOR'
  | 'SHINKANSEN_DYNAMIC_JOURNEY_CONFIGURATOR'
  | 'ACTIVITY_EXPERIENCE_CONFIGURATOR'
  | 'VISA_CONFIGURATOR'
  | 'ADDON_CONFIGURATOR';

/**
 * Detects whether any product, quote item, or hotel object belongs to the Hotel / Accommodation category.
 * Compliant with Rule 1, 3, 9:
 * MUST NEVER return true for Transfers, Visas, Rail, Private Tours, or any other product
 * merely because its name contains the word 'hotel'.
 */
export function isHotelService(itemOrProduct: any): boolean {
  return isHotelProductOrItem(itemOrProduct);
}

/**
 * Detects whether any product or quote item belongs to the Japan Rail / Shinkansen category.
 */
export function isShinkansenService(itemOrProduct: any): boolean {
  return isShinkansenProductOrItem(itemOrProduct);
}

/**
 * Detects whether any product, quote item, or visa object belongs to the Visa & Ancillary Services category.
 */
export function isVisaService(itemOrProduct: any): boolean {
  return isVisaProductOrItem(itemOrProduct);
}

/**
 * Detects whether any product or quote item belongs to the Activity & Experience category.
 */
export function isActivityExperienceService(itemOrProduct: any): boolean {
  if (!itemOrProduct) return false;
  if (isShinkansenService(itemOrProduct) || isHotelService(itemOrProduct) || isVisaService(itemOrProduct)) {
    return false;
  }
  const category = (itemOrProduct.category || itemOrProduct.product?.category || '').toLowerCase();
  const productType = (itemOrProduct.productType || itemOrProduct.product?.productType || '').toLowerCase();
  const sku = (itemOrProduct.sku || itemOrProduct.product?.sku || '').toUpperCase();

  // Exclude Visas and dedicated system Addons
  if (sku.startsWith('VSA-') || sku.startsWith('VISA-') || category.includes('visa') || productType.includes('visa')) {
    return false;
  }
  if (sku.startsWith('ADD-') || category.includes('esim') || category.includes('insurance')) {
    return false;
  }

  // Any non-hotel, non-rail, non-visa ground inventory is classified as Activity & Experience
  return (
    category.includes('activit') ||
    category.includes('experience') ||
    category.includes('tour') ||
    category.includes('transfer') ||
    category.includes('transport') ||
    category.includes('guide') ||
    category.includes('dining') ||
    category.includes('restaurant') ||
    category.includes('yacht') ||
    category.includes('sightseeing') ||
    category.includes('excursion') ||
    category.includes('attraction') ||
    productType.includes('activity') ||
    productType.includes('tour') ||
    productType.includes('day_tour') ||
    productType.includes('transfer') ||
    productType.includes('experience') ||
    true // By global rule, ground experiences are routed to Activity & Experience Configurator
  );
}

/**
 * Central Configurator Routing Engine
 * Detects authoritative category according to Section 1 & Section 5 of the architectural constitution.
 */
export function detectAuthoritativeServiceCategory(itemOrProduct: any): AuthoritativeServiceCategory {
  if (!itemOrProduct) return 'OTHER';

  if (isShinkansenService(itemOrProduct)) {
    return 'SHINKANSEN';
  }

  if (isHotelService(itemOrProduct)) {
    return 'HOTEL';
  }

  if (isVisaService(itemOrProduct)) {
    return 'VISA';
  }

  const category = (itemOrProduct.category || itemOrProduct.product?.category || '').toLowerCase();
  const productType = (itemOrProduct.productType || itemOrProduct.product?.productType || '').toLowerCase();
  const sku = (itemOrProduct.sku || itemOrProduct.product?.sku || '').toUpperCase();

  if (sku.startsWith('ADD-') || category.includes('esim') || category.includes('insurance')) {
    return 'ADDON';
  }

  return 'ACTIVITY_EXPERIENCE';
}

/**
 * Returns the exact dedicated configurator type required for the inventory.
 * Enforces: ZERO GENERIC CUSTOMIZER.
 */
export function getRequiredConfigurator(itemOrProduct: any): DedicatedConfiguratorType {
  const cat = detectAuthoritativeServiceCategory(itemOrProduct);
  switch (cat) {
    case 'HOTEL':
      return 'HOTEL_CONFIGURATOR';
    case 'SHINKANSEN':
      return 'SHINKANSEN_DYNAMIC_JOURNEY_CONFIGURATOR';
    case 'VISA':
      return 'VISA_CONFIGURATOR';
    case 'ADDON':
      return 'ADDON_CONFIGURATOR';
    case 'ACTIVITY_EXPERIENCE':
    default:
      return 'ACTIVITY_EXPERIENCE_CONFIGURATOR';
  }
}

/**
 * Generates or preserves a stable configuration reference (Section 21).
 */
export function getStableConfigurationReference(
  serviceType: AuthoritativeServiceCategory,
  productId: string,
  existingRef?: { configurationId?: string; version?: number }
) {
  return {
    configurationId: existingRef?.configurationId || `cfg-${serviceType.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    configurationType: serviceType,
    serviceType,
    productId,
    version: (existingRef?.version || 0) + 1,
    updatedAt: new Date().toISOString()
  };
}
