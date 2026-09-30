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
    return (list.length > 0 ? list : INITIAL_RAIL_STATIONS).filter(s => s.active);
  }

  public getStation(stationId: string): RailStation | undefined {
    const list = AppDatabase.getInstance().getRailStations();
    const found = list.find(s => s.stationId === stationId);
    if (found) return found;
    return getStationById(stationId);
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
    return (list.length > 0 ? list : INITIAL_RAIL_ROUTES).filter(r => r.active);
  }

  public getRoute(originId: string, destinationId: string): RailRoute | undefined {
    const list = AppDatabase.getInstance().getRailRoutes();
    const found = list.find(r => 
      (r.originStationId === originId && r.destinationStationId === destinationId) ||
      (r.originStationId === destinationId && r.destinationStationId === originId)
    );
    if (found) return found;
    return findRoute(originId, destinationId);
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
    const source = rates.length > 0 ? rates : INITIAL_RAIL_RATES;
    return source.filter(r => 
      ((r.originStationId === originId && r.destinationStationId === destinationId) ||
       (r.originStationId === destinationId && r.destinationStationId === originId)) &&
      r.active
    );
  }
}

export const japanRailJourneyDataService = JapanRailJourneyDataService.getInstance();

/**
 * Authoritative platform test to determine if any product is a Japan Rail / Shinkansen product
 */
export function isRailProduct(product: any): boolean {
  if (!product) return false;
  const category = (product.category || '').toLowerCase();
  const productType = (product.productType || '').toLowerCase();
  const id = (product.id || '').toUpperCase();
  const sku = (product.sku || '').toUpperCase();
  const code = (product.supplierProductCode || '').toUpperCase();
  const name = (product.name || '').toLowerCase();

  return (
    category === 'rail' ||
    productType === 'rail' ||
    id.startsWith('RAIL-JP') ||
    sku.startsWith('RAIL-JP') ||
    code.startsWith('RAIL-JP') ||
    name.includes('shinkansen') ||
    name.includes('bullet train') ||
    name.includes('japan rail')
  );
}

/**
 * Authoritative platform test to determine if any quote or booking item is a Japan Rail / Shinkansen item
 */
export function isRailQuoteItem(item: any): boolean {
  if (!item) return false;
  if (item.railJourneyDetails || item.japanRailJourneySnapshot || item.shinkansenJourneyPayload || item.isCustomRail) return true;
  if (item.category === 'Rail' || item.category === 'rail') return true;
  if (item.product && isRailProduct(item.product)) return true;
  if (typeof item.id === 'string' && (item.id.startsWith('quote-rail-') || item.id.startsWith('RAIL-JP'))) return true;
  if (typeof item.productId === 'string' && item.productId.startsWith('RAIL-JP')) return true;
  return false;
}
