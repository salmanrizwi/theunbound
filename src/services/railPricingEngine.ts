import { 
  RailPricingParams, 
  RailPricingResult, 
  RailStation, 
  RailRoute, 
  RailRate, 
  RailServiceGroup, 
  RailSeasonType, 
  RailBookingItemDetails 
} from '../types/rail';
import { CurrencyCode, Product } from '../types';
import { INITIAL_RAIL_STATIONS, getStationById } from '../data/initialRailStations';
import { INITIAL_RAIL_ROUTES, findRoute } from '../data/initialRailRoutes';
import { INITIAL_RAIL_RATES, findExactRate } from '../data/initialRailRates';
import { RAIL_SEASON_ADJUSTMENTS, resolveRailSeasonForDate } from '../data/initialRailSeasons';
import { INITIAL_RAIL_MARKUP_RULE } from '../data/initialRailMarkup';
import { convertCurrency } from './currencyEngine';
import { INITIAL_PRODUCTS } from '../data/initialProducts';
import { AppDatabase } from './db';

export class RailPricingEngine {
  private static instance: RailPricingEngine;

  private constructor() {}

  public static getInstance(): RailPricingEngine {
    if (!RailPricingEngine.instance) {
      RailPricingEngine.instance = new RailPricingEngine();
    }
    return RailPricingEngine.instance;
  }

  /**
   * Main calculation entrypoint for Shinkansen dynamic pricing.
   */
  public calculatePrice(params: RailPricingParams): RailPricingResult {
    const {
      originStationId,
      destinationStationId,
      productId,
      serviceGroup,
      travelDate,
      departureTime,
      adultsCount = 1,
      childrenCount = 0,
      seatPreference,
      userRole,
      targetCurrency = 'JPY'
    } = params;

    // 1. Resolve Stations
    const db = AppDatabase.getInstance();
    const storedStations = db.getRailStations();
    const originStation = storedStations.find(s => s.stationId === originStationId) || getStationById(originStationId) || storedStations[0] || INITIAL_RAIL_STATIONS[0];
    const destinationStation = storedStations.find(s => s.stationId === destinationStationId) || getStationById(destinationStationId) || storedStations[15] || INITIAL_RAIL_STATIONS[15];

    // 2. Resolve or dynamically estimate route
    const storedRoutes = db.getRailRoutes();
    let route = storedRoutes.find(r => 
      (r.originStationId === originStation.stationId && r.destinationStationId === destinationStation.stationId) ||
      (r.originStationId === destinationStation.stationId && r.destinationStationId === originStation.stationId)
    ) || findRoute(originStation.stationId, destinationStation.stationId);

    if (!route) {
      // Create fallback dynamic route entity
      const estimatedDistance = this.calculateHaversineDistance(
        originStation.latitude,
        originStation.longitude,
        destinationStation.latitude,
        destinationStation.longitude
      );
      route = {
        routeId: `JP-RT-${originStation.stationCode}-${destinationStation.stationCode}`,
        originStationId: originStation.stationId,
        destinationStationId: destinationStation.stationId,
        originStationName: originStation.stationName,
        destinationStationName: destinationStation.stationName,
        country: 'Japan',
        destinationId: 'dest-japan',
        railOperator: 'JR Central / JR West / smartEX',
        active: true,
        availableProductIds: ['RAIL-JP-ORD-RESERVED', 'RAIL-JP-GREEN-RESERVED'],
        availableServiceGroups: ['NOZOMI_MIZUHO', 'HIKARI_KODAMA_SAKURA_TSUBAME'],
        distanceKm: Math.round(estimatedDistance * 1.25),
        travelDurationMinutes: {
          nozomiMizuho: Math.round(estimatedDistance * 0.35),
          hikariKodamaSakura: Math.round(estimatedDistance * 0.45)
        }
      };
    }

    // 3. Resolve Product
    const isGreenCar = productId === 'RAIL-JP-GREEN-RESERVED';
    const product = db.getProductById(productId) || INITIAL_PRODUCTS.find(p => p.id === productId) || INITIAL_PRODUCTS[0];

    // 4. Resolve Season & Dynamic Adjustments from live database Season Calendar
    const storedSeasons = db.getRailSeasons();
    const seasonMatch = resolveRailSeasonForDate(travelDate, storedSeasons);
    const { seasonType, seasonLabel, seasonPeriod, adultAdjustmentJPY, childAdjustmentJPY, pricingMultiplier } = seasonMatch;

    // 5. Lookup exact rate records (Adult & Child)
    const storedRates = db.getRailRates();
    const findLiveRate = (paxType: 'ADULT' | 'CHILD') => {
      return storedRates.find(r => 
        ((r.originStationId === originStation.stationId && r.destinationStationId === destinationStation.stationId) ||
         (r.originStationId === destinationStation.stationId && r.destinationStationId === originStation.stationId)) &&
        r.productId === productId &&
        r.serviceGroup === serviceGroup &&
        r.passengerType === paxType &&
        r.active
      ) || findExactRate(
        originStation.stationId,
        destinationStation.stationId,
        productId,
        serviceGroup,
        paxType
      );
    };

    const adultRate = findLiveRate('ADULT');
    const childRate = findLiveRate('CHILD');

    let adultBaseFare = 0;
    let adultExpressSurcharge = 0;
    let adultGreenSurcharge = 0;
    let adultRegularTotal = 0;

    let childBaseFare = 0;
    let childExpressSurcharge = 0;
    let childGreenSurcharge = 0;
    let childRegularTotal = 0;

    if (adultRate) {
      adultBaseFare = adultRate.baseFareJPY;
      adultExpressSurcharge = adultRate.superExpressSurchargeJPY;
      adultGreenSurcharge = adultRate.greenCarSurchargeJPY;
      adultRegularTotal = adultRate.regularTotalFareJPY;
    } else {
      // Dynamic fallback estimation if route is outside direct pre-seeded matrix
      const dist = route.distanceKm || 300;
      adultBaseFare = Math.round(dist * 16.5 / 10) * 10;
      adultExpressSurcharge = serviceGroup === 'NOZOMI_MIZUHO' 
        ? Math.round(dist * 10.5 / 10) * 10 
        : Math.round(dist * 9.8 / 10) * 10;
      adultGreenSurcharge = isGreenCar ? Math.round(dist * 8.5 / 10) * 10 : 0;
      adultRegularTotal = adultBaseFare + adultExpressSurcharge + adultGreenSurcharge;
    }

    if (childRate) {
      childBaseFare = childRate.baseFareJPY;
      childExpressSurcharge = childRate.superExpressSurchargeJPY;
      childGreenSurcharge = childRate.greenCarSurchargeJPY;
      childRegularTotal = childRate.regularTotalFareJPY;
    } else {
      childBaseFare = Math.floor(adultBaseFare * 0.5 / 10) * 10;
      childExpressSurcharge = Math.floor(adultExpressSurcharge * 0.5 / 10) * 10;
      childGreenSurcharge = isGreenCar ? adultGreenSurcharge : 0;
      childRegularTotal = childBaseFare + childExpressSurcharge + childGreenSurcharge;
    }

    // 6. Apply Seasonal Adjustments to Supplier Fare (including multiplier if defined)
    const adultSeasonAdj = Math.round(adultAdjustmentJPY * (pricingMultiplier || 1.0));
    const childSeasonAdj = Math.round(childAdjustmentJPY * (pricingMultiplier || 1.0));

    const adultPerPaxSupplierJPY = adultRegularTotal + adultSeasonAdj;
    const childPerPaxSupplierJPY = childRegularTotal + childSeasonAdj;

    const totalAdultSupplierJPY = adultPerPaxSupplierJPY * adultsCount;
    const totalChildSupplierJPY = childPerPaxSupplierJPY * childrenCount;
    const totalSupplierCostJPY = totalAdultSupplierJPY + totalChildSupplierJPY;

    // 7. Apply TheUnbound DMC Commercial Markup
    const markupRule = db.getRailMarkupRule() || INITIAL_RAIL_MARKUP_RULE;
    const isB2BAgent = userRole === 'B2B_AGENT' || userRole === 'AGENT';
    const appliedMarkupPercent = isB2BAgent 
      ? markupRule.b2bAgentMarkupPercent 
      : markupRule.buyerMarkupPercent;

    const totalPax = adultsCount + childrenCount;
    const minGuaranteedMargin = (markupRule.minMarginJPY || 500) * totalPax;
    const calculatedMarkup = Math.round(totalSupplierCostJPY * (appliedMarkupPercent / 100));
    const totalMarkupJPY = Math.max(calculatedMarkup, minGuaranteedMargin);

    const finalSellingPriceJPY = Math.round((totalSupplierCostJPY + totalMarkupJPY) / 10) * 10;

    // 8. Convert to Target Currency
    const exchangeRate = convertCurrency(1, 'JPY', targetCurrency);
    const finalSellingPriceTargetCurrency = convertCurrency(finalSellingPriceJPY, 'JPY', targetCurrency);

    // 9. Duration Estimation
    const durationMinutes = serviceGroup === 'NOZOMI_MIZUHO'
      ? (route.travelDurationMinutes?.nozomiMizuho || 135)
      : (route.travelDurationMinutes?.hikariKodamaSakura || 160);

    const hours = Math.floor(durationMinutes / 60);
    const mins = durationMinutes % 60;
    const formattedDuration = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

    const seasonAdjTotal = (adultSeasonAdj * adultsCount) + (childSeasonAdj * childrenCount);

    return {
      route,
      originStation,
      destinationStation,
      product,
      carType: isGreenCar ? 'Green' : 'Ordinary',
      seatType: 'Reserved',
      serviceGroup,
      travelDate,
      departureTime,
      seasonType,
      seasonLabel,
      seasonId: seasonPeriod?.id,
      seasonName: seasonPeriod?.title || seasonLabel,
      pricingVersion: '2.1-DYNAMIC-SEASON-CALENDAR',
      calculationTimestamp: new Date().toISOString(),
      adultPerPaxSupplierJPY,
      childPerPaxSupplierJPY,
      adultSeasonAdjustmentJPY: adultSeasonAdj,
      childSeasonAdjustmentJPY: childSeasonAdj,
      totalSupplierCostJPY,
      appliedMarkupPercent,
      totalMarkupJPY,
      finalSellingPriceJPY,
      targetCurrency,
      finalSellingPriceTargetCurrency,
      exchangeRate,
      fareBreakdown: {
        baseFareJPY: (adultBaseFare * adultsCount) + (childBaseFare * childrenCount),
        superExpressSurchargeJPY: (adultExpressSurcharge * adultsCount) + (childExpressSurcharge * childrenCount),
        greenCarSurchargeJPY: (adultGreenSurcharge * adultsCount) + (childGreenSurcharge * childrenCount),
        seasonAdjustmentTotalJPY: seasonAdjTotal,
        supplierNetTotalJPY: totalSupplierCostJPY,
        theUnboundMarkupJPY: totalMarkupJPY,
        grandTotalJPY: finalSellingPriceJPY
      },
      passengers: {
        adults: adultsCount,
        children: childrenCount,
        total: totalPax
      },
      seatPreference,
      estimatedDurationMinutes: durationMinutes,
      formattedDuration
    };
  }

  /**
   * Helper to format full booking item details for quotations & vouchers
   */
  public createRailBookingItemDetails(pricing: RailPricingResult): RailBookingItemDetails {
    const serviceTitle = pricing.serviceGroup === 'NOZOMI_MIZUHO' ? 'Nozomi / Mizuho' : 'Hikari / Kodama / Sakura';
    const classTitle = pricing.carType === 'Green' ? 'Green Car (First Class)' : 'Ordinary Car (Reserved Seat)';
    const pnrRef = `JR-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    return {
      type: 'JAPAN_RAIL',
      productId: pricing.product.id,
      productName: `${classTitle} — ${pricing.originStation.stationName} to ${pricing.destinationStation.stationName}`,
      carType: pricing.carType,
      seatType: pricing.seatType,
      serviceGroup: pricing.serviceGroup,
      originStationId: pricing.originStation.stationId,
      originStationName: pricing.originStation.stationName,
      originStationCode: pricing.originStation.stationCode,
      destinationStationId: pricing.destinationStation.stationId,
      destinationStationName: pricing.destinationStation.stationName,
      destinationStationCode: pricing.destinationStation.stationCode,
      travelDate: pricing.travelDate,
      departureTime: pricing.departureTime,
      trainName: `${serviceTitle.split(' ')[0]} Shinkansen`,
      seatPreference: pricing.seatPreference,
      hasOversizedBaggage: pricing.seatPreference === 'OVERSIZED_BAGGAGE',
      adultsCount: pricing.passengers.adults,
      childrenCount: pricing.passengers.children,
      seasonType: pricing.seasonType,
      pricingResult: pricing,
      pnrReference: pnrRef,
      qrVoucherCode: `SMARTEX-QR-${pnrRef}-${Date.now().toString().slice(-6)}`
    };
  }

  private calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  }
}

export const railPricingEngine = RailPricingEngine.getInstance();
