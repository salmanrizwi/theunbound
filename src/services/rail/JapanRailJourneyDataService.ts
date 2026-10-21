import { RailStation, RailRoute, RailRate, RailMarkupRule, RailSeasonCalendarPeriod, RailServiceGroup, JapanRailCommercialProduct } from '../../types/rail';
import { Product } from '../../types';
import { INITIAL_RAIL_STATIONS, getStationById, searchStations } from '../../data/initialRailStations';
import { INITIAL_RAIL_ROUTES, findRoute } from '../../data/initialRailRoutes';
import { INITIAL_RAIL_RATES, findExactRate } from '../../data/initialRailRates';
import { INITIAL_RAIL_SEASON_CALENDAR, RAIL_SEASON_ADJUSTMENTS, determineRailSeason, resolveRailSeasonForDate } from '../../data/initialRailSeasons';
import { INITIAL_RAIL_MARKUP_RULE } from '../../data/initialRailMarkup';
import { INITIAL_PRODUCTS } from '../../data/initialProducts';
import { JapanRailStationRef } from '../../types/japanRailJourney';
import { AppDatabase } from '../db';

export class JapanRailJourneyDataService {
  private static instance: JapanRailJourneyDataService;

  private constructor() {}

  public static getInstance(): JapanRailJourneyDataService {
    if (!JapanRailJourneyDataService.instance) {
      JapanRailJourneyDataService.instance = new JapanRailJourneyDataService();
    }
    return JapanRailJourneyDataService.instance;
  }

  public getAllStations(): RailStation[] {
    const list = AppDatabase.getInstance().getRailStations();
    return list.filter(s => s.active !== false);
  }

  public getStation(stationId: string): RailStation | undefined {
    if (!stationId) return undefined;
    const list = AppDatabase.getInstance().getRailStations();
    const clean = stationId.trim().toLowerCase();
    const stripped = clean.replace(/^stn-/, '').replace(/^jp-st-/, '');
    const codeMatch = stationId.match(/\(([A-Za-z0-9]{3})\)/);
    const extractedCode = codeMatch ? codeMatch[1].toLowerCase() : null;
    const nameBeforeParen = clean.split('(')[0].trim();
    return list.find(s =>
      s.stationId === stationId ||
      s.stationCode === stationId ||
      s.stationId.toLowerCase() === clean ||
      s.stationCode.toLowerCase() === clean ||
      s.stationCode.toLowerCase() === stripped ||
      (extractedCode && s.stationCode.toLowerCase() === extractedCode) ||
      s.stationId.toLowerCase() === `jp-st-${stripped}` ||
      (stripped === 'osaka' && s.stationId === 'JP-ST-SHIN-OSAKA') ||
      (nameBeforeParen === 'osaka' && s.stationId === 'JP-ST-SHIN-OSAKA') ||
      s.stationName.toLowerCase() === stripped ||
      s.stationName.toLowerCase() === nameBeforeParen
    );
  }

  public getStationRef(stationId: string): JapanRailStationRef {
    const station = this.getStation(stationId) || this.getAllStations()[0] || INITIAL_RAIL_STATIONS[0];
    return {
      stationId: station.stationId,
      stationCode: station.stationCode,
      stationName: station.stationName,
      displayName: station.displayName,
      city: station.city,
      shinkansenLine: station.shinkansenLine
    };
  }

  public searchStations(query: string): RailStation[] {
    if (!query || !query.trim()) return this.getAllStations();
    const q = query.toLowerCase().trim();
    return this.getAllStations().filter(s => 
      s.stationName.toLowerCase().includes(q) ||
      s.stationCode.toLowerCase().includes(q) ||
      s.displayName.toLowerCase().includes(q) ||
      s.city.toLowerCase().includes(q) ||
      (s.searchAliases && s.searchAliases.some(a => a.toLowerCase().includes(q)))
    );
  }

  public getAllRoutes(): RailRoute[] {
    const list = AppDatabase.getInstance().getRailRoutes();
    return list.filter(r => r.active !== false);
  }

  public getRoute(originId: string, destinationId: string): RailRoute | undefined {
    const list = AppDatabase.getInstance().getRailRoutes();
    return list.find(r => 
      ((r.originStationId === originId && r.destinationStationId === destinationId) ||
       (r.originStationId === destinationId && r.destinationStationId === originId)) &&
      r.active !== false
    );
  }

  public getMasterRailProducts(): Product[] {
    const prods = AppDatabase.getInstance().getProducts();
    return prods.filter(p => 
      p.id === 'RAIL-JP-ORD-RESERVED' || 
      p.id === 'RAIL-JP-GREEN-RESERVED' || 
      p.category === 'Rail'
    );
  }

  public getCommercialProducts(): JapanRailCommercialProduct[] {
    return AppDatabase.getInstance().getJapanRailCommercialProducts();
  }

  public getCommercialProduct(idOrCode: string): JapanRailCommercialProduct | undefined {
    return AppDatabase.getInstance().getJapanRailCommercialProductById(idOrCode);
  }

  public getRailProduct(productId: string): Product | undefined {
    return AppDatabase.getInstance().getProductById(productId) || INITIAL_PRODUCTS.find(p => p.id === productId);
  }

  public getMarkupRule(): RailMarkupRule {
    return AppDatabase.getInstance().getRailMarkupRule() || INITIAL_RAIL_MARKUP_RULE;
  }

  public getSeasonCalendar(): RailSeasonCalendarPeriod[] {
    const seasons = AppDatabase.getInstance().getRailSeasons();
    return seasons.length > 0 ? seasons : INITIAL_RAIL_SEASON_CALENDAR;
  }

  public getSeasonAdjustments() {
    return RAIL_SEASON_ADJUSTMENTS;
  }

  public determineSeason(dateStr: string) {
    const seasons = this.getSeasonCalendar();
    return determineRailSeason(dateStr, seasons);
  }

  public resolveSeasonDetails(dateStr: string) {
    const seasons = this.getSeasonCalendar();
    return resolveRailSeasonForDate(dateStr, seasons);
  }

  public getRatesForRoute(originId: string, destinationId: string): RailRate[] {
    const rates = AppDatabase.getInstance().getRailRates();
    return rates.filter(r => 
      ((r.originStationId === originId && r.destinationStationId === destinationId) ||
       (r.originStationId === destinationId && r.destinationStationId === originId)) &&
      r.active !== false
    );
  }
}

export const japanRailJourneyDataService = JapanRailJourneyDataService.getInstance();

const NON_RAIL_CATEGORIES = new Set([
  'transfers',
  'transfer',
  'transport',
  'transports',
  'private tours',
  'private tour',
  'private_tours',
  'group tours',
  'group tour',
  'group_tours',
  'day trips',
  'day trip',
  'tours',
  'tour',
  'tickets',
  'ticket',
  'activities',
  'activity',
  'attractions',
  'attraction',
  'private yacht',
  'private_yacht',
  'yacht',
  'boat',
  'ferries',
  'ferry',
  'guides',
  'guide',
  'interpreter',
  'hotels',
  'hotel',
  'accommodation',
  'accommodations',
  'visa & ancillary services',
  'visa_ancillary',
  'visa',
  'visas',
  'ancillary',
  'travel services',
  'lunch / dinner restaurant',
  'lunch_dinner_restaurant',
  'restaurant',
  'restaurants',
  'dining'
]);

/**
 * Authoritative platform test to determine if any product is a Japan Rail / Shinkansen product.
 * Strictly excludes Transfers and all other non-Rail product categories.
 */
export function isRailProduct(product: any): boolean {
  if (!product) return false;

  // Hard exclusion for Transfers, Hotels, Visas, and non-Rail SKUs/flags
  if (
    product.isTransfer === true ||
    product.isManualHotel === true ||
    product.isVisa === true ||
    Boolean(product.vehicleConfig) ||
    Boolean(product.hotelDetails) ||
    Boolean(product.manualHotelDetails)
  ) {
    return false;
  }

  const rawCategory = String(
    product.category ||
    product.productCategory ||
    product.product_category ||
    product.category_id ||
    ''
  ).trim().toLowerCase();

  const productType = String(product.productType || '').trim().toLowerCase();
  const subcategory = String(product.subcategory || '').trim().toLowerCase();
  const id = String(product.id || '').trim().toUpperCase();
  const sku = String(product.sku || '').trim().toUpperCase();
  const code = String(product.supplierProductCode || product.productCode || '').trim().toUpperCase();

  if (
    NON_RAIL_CATEGORIES.has(rawCategory) ||
    rawCategory.includes('transfer') ||
    productType.includes('transfer') ||
    subcategory.includes('transfer') ||
    subcategory.includes('chauffeur') ||
    id.startsWith('TRF-') ||
    sku.startsWith('TRF-') ||
    id.includes('TRANSFER') ||
    sku.startsWith('HTL-') ||
    sku.startsWith('VSA-') ||
    sku.startsWith('VISA-') ||
    sku.startsWith('YCH-') ||
    sku.startsWith('FRY-') ||
    sku.startsWith('GDE-') ||
    sku.startsWith('RST-') ||
    sku.startsWith('TCK-')
  ) {
    return false;
  }

  return (
    rawCategory === 'rail' ||
    rawCategory === 'rail / shinkansen' ||
    rawCategory === 'rail_shinkansen' ||
    rawCategory === 'shinkansen' ||
    rawCategory === 'japan_rail' ||
    productType === 'rail' ||
    productType === 'shinkansen' ||
    id.startsWith('RAIL-JP') ||
    sku.startsWith('RAIL-JP') ||
    sku.startsWith('JP-SHINKANSEN') ||
    code.startsWith('RAIL-JP') ||
    code === 'ORDINARY_RESERVED' ||
    code === 'GREEN_RESERVED'
  );
}

/**
 * Authoritative platform test to determine if any quote or booking item is a Japan Rail / Shinkansen item.
 * Strictly excludes Transfers and all other non-Rail categories.
 */
export function isRailQuoteItem(item: any): boolean {
  if (!item) return false;

  const rawItemCategory = String(
    item.category ||
    item.productCategory ||
    item.product_category ||
    item.product?.category ||
    item.product?.productCategory ||
    ''
  ).trim().toLowerCase();

  if (
    item.isTransfer === true ||
    item.product?.isTransfer === true ||
    NON_RAIL_CATEGORIES.has(rawItemCategory) ||
    rawItemCategory.includes('transfer') ||
    String(item.product?.productType || '').toLowerCase().includes('transfer') ||
    String(item.id || '').toUpperCase().startsWith('TRF-') ||
    String(item.product?.sku || '').toUpperCase().startsWith('TRF-')
  ) {
    return false;
  }

  if (item.railJourneyDetails || item.japanRailJourneySnapshot || item.shinkansenJourneyPayload || item.isCustomRail) return true;
  if (rawItemCategory === 'rail' || rawItemCategory === 'rail / shinkansen' || rawItemCategory === 'shinkansen') return true;
  if (item.product && isRailProduct(item.product)) return true;
  if (typeof item.id === 'string' && (item.id.startsWith('quote-rail-') || item.id.startsWith('RAIL-JP'))) return true;
  if (typeof item.productId === 'string' && item.productId.startsWith('RAIL-JP')) return true;
  return false;
}

