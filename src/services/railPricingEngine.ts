import { 
  RailPricingParams, 
  RailPricingResult, 
  RailStation, 
  RailRoute, 
  RailRate, 
  RailServiceGroup, 
  RailSeasonType, 
  RailBookingItemDetails,
  resolveRailRateNettPrice
} from '../types/rail';
import { CurrencyCode, Product } from '../types';
import { INITIAL_RAIL_STATIONS, getStationById } from '../data/initialRailStations';
import { INITIAL_RAIL_ROUTES, findRoute } from '../data/initialRailRoutes';
import { INITIAL_RAIL_RATES, findExactRate } from '../data/initialRailRates';
import { RAIL_SEASON_ADJUSTMENTS, resolveRailSeasonForDate } from '../data/initialRailSeasons';
import { INITIAL_RAIL_MARKUP_RULE } from '../data/initialRailMarkup';
import { convertCurrency } from './currencyEngine';
import { currencyConversionService } from './currencyConversionService';
import { evaluateInventoryValidity, evaluateApplicableSurcharges } from './pricingEngine';
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

    // 1. Resolve Stations strictly from authoritative database
    const db = AppDatabase.getInstance();
    const storedStations = db.getRailStations();
    const resolveStation = (id: string): RailStation | undefined => {
      if (!id) return undefined;
      const clean = id.trim().toLowerCase();
      const stripped = clean.replace(/^stn-/, '').replace(/^jp-st-/, '');
      const codeMatch = id.match(/\(([A-Za-z0-9]{3})\)/);
      const extractedCode = codeMatch ? codeMatch[1].toLowerCase() : null;
      const nameBeforeParen = clean.split('(')[0].trim();
      return storedStations.find(s =>
        s.stationId === id ||
        s.stationCode === id ||
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
    };
    const originStation = resolveStation(originStationId);
    const destinationStation = resolveStation(destinationStationId);
    const normalizedTarget = currencyConversionService.normalizeCurrency(targetCurrency, 'JPY');

    if (!originStation || !destinationStation || originStation.active === false || destinationStation.active === false) {
      return this.buildUnavailablePriceResult({
        originStation,
        destinationStation,
        serviceGroup,
        travelDate,
        departureTime,
        adultsCount,
        childrenCount,
        seatPreference,
        targetCurrency: normalizedTarget,
        reason: 'Price unavailable — Admin configuration required'
      });
    }

    // 2. Resolve route strictly from authoritative database
    const storedRoutes = db.getRailRoutes();
    const route = storedRoutes.find(r => 
      ((r.originStationId === originStation.stationId && r.destinationStationId === destinationStation.stationId) ||
       (r.originStationId === destinationStation.stationId && r.destinationStationId === originStation.stationId)) &&
      r.active !== false
    );

    if (!route || route.active === false) {
      return this.buildUnavailablePriceResult({
        originStation,
        destinationStation,
        serviceGroup,
        travelDate,
        departureTime,
        adultsCount,
        childrenCount,
        seatPreference,
        targetCurrency: normalizedTarget,
        reason: 'Price unavailable — Admin configuration required'
      });
    }

    // 3. Resolve Product & Commercial Master Product
    const directProduct = db.getProductById(productId) || INITIAL_PRODUCTS.find(p => p.id === productId);
    const isGreenCar = productId === 'RAIL-JP-GREEN-RESERVED' || (directProduct?.name || '').toLowerCase().includes('green');
    const canonicalProductId = isGreenCar ? 'RAIL-JP-GREEN-RESERVED' : 'RAIL-JP-ORD-RESERVED';
    const product = directProduct || db.getProductById(canonicalProductId) || INITIAL_PRODUCTS.find(p => p.id === canonicalProductId);
    const commercialPass = db.getJapanRailCommercialProductById?.(productId) ||
      db.getJapanRailCommercialProductById?.(canonicalProductId) ||
      db.getJapanRailCommercialProducts?.()?.find((cp: any) => cp.id === productId || cp.sku === productId || cp.productCode === productId || cp.id === canonicalProductId);

    if (
      !product ||
      (product.status as string) === 'INACTIVE' ||
      (product.status as string) === 'ARCHIVED' ||
      (commercialPass && ((commercialPass.status as string) === 'INACTIVE' || (commercialPass.status as string) === 'ARCHIVED'))
    ) {
      return this.buildUnavailablePriceResult({
        originStation,
        destinationStation,
        route,
        serviceGroup,
        travelDate,
        departureTime,
        adultsCount,
        childrenCount,
        seatPreference,
        targetCurrency: normalizedTarget,
        reason: 'Price unavailable — Admin configuration required'
      });
    }

    // 4. Resolve Season & Dynamic Adjustments from live database Season Calendar
    const storedSeasons = db.getRailSeasons();
    const seasonMatch = resolveRailSeasonForDate(travelDate, storedSeasons);
    const { seasonType, seasonLabel, seasonPeriod, adultAdjustmentJPY, childAdjustmentJPY, pricingMultiplier } = seasonMatch;

    // 5. Lookup exact rate records (Adult & Child) strictly from canonical Admin-managed pricing
    const storedRates = db.getRailRates();
    const matchesServiceGroup = (rateGroup: string, requestedGroup: string) =>
      rateGroup === requestedGroup ||
      (requestedGroup.startsWith('HIKARI_KODAMA_SAKURA') && rateGroup?.startsWith('HIKARI_KODAMA_SAKURA'));

    const findLiveRate = (paxType: 'ADULT' | 'CHILD') => {
      const candidates = storedRates.filter(r =>
        ((r.originStationId === originStation.stationId && r.destinationStationId === destinationStation.stationId) ||
         (r.originStationId === destinationStation.stationId && r.destinationStationId === originStation.stationId)) &&
        (r.productId === productId || r.productId === canonicalProductId) &&
        matchesServiceGroup(r.serviceGroup, serviceGroup) &&
        (r.passengerType?.toUpperCase() === paxType || (paxType === 'ADULT' && r.passengerType?.toUpperCase() === 'ADT'))
      );

      if (candidates.length === 0) return undefined;

      // Prefer most recently updated / added rate, and exact origin->destination direction on tie
      const sorted = [...candidates].sort((a, b) => {
        const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        if (timeB !== timeA) return timeB - timeA;
        const exactA = a.originStationId === originStation.stationId && a.destinationStationId === destinationStation.stationId ? 1 : 0;
        const exactB = b.originStationId === originStation.stationId && b.destinationStationId === destinationStation.stationId ? 1 : 0;
        return exactB - exactA;
      });

      return sorted[0];
    };

    const adultRate = adultsCount > 0 ? findLiveRate('ADULT') : undefined;
    const childRate = childrenCount > 0 ? findLiveRate('CHILD') : undefined;

    const adultNettJPY = adultRate ? resolveRailRateNettPrice(adultRate) : null;
    const childNettJPY = childRate ? resolveRailRateNettPrice(childRate) : null;

    // Strict Rule: Never invent, estimate or substitute a price.
    // If a required price rate is missing, unpublished, flagged for Admin review, or zero, return authoritative unavailable state.
    if (
      adultsCount > 0 &&
      (!adultRate || adultRate.active === false || adultRate.needsAdminReview || adultNettJPY === null || adultNettJPY <= 0)
    ) {
      return this.buildUnavailablePriceResult({
        originStation,
        destinationStation,
        route,
        product,
        serviceGroup,
        travelDate,
        departureTime,
        adultsCount,
        childrenCount,
        seatPreference,
        targetCurrency: normalizedTarget,
        reason: 'Price unavailable — Admin configuration required'
      });
    }

    if (
      childrenCount > 0 &&
      (!childRate || childRate.active === false || childRate.needsAdminReview || childNettJPY === null || childNettJPY <= 0)
    ) {
      return this.buildUnavailablePriceResult({
        originStation,
        destinationStation,
        route,
        product,
        serviceGroup,
        travelDate,
        departureTime,
        adultsCount,
        childrenCount,
        seatPreference,
        targetCurrency: normalizedTarget,
        reason: 'Price unavailable — Admin configuration required'
      });
    }

    const nativeCurrency: CurrencyCode = (
      adultRate?.nativeCurrency ||
      adultRate?.currency ||
      childRate?.nativeCurrency ||
      childRate?.currency ||
      commercialPass?.nativeCurrency ||
      (commercialPass as any)?.currency ||
      product?.currency ||
      'JPY'
    ) as CurrencyCode;

    const adultAuthoritativeNett = adultNettJPY ?? 0;
    const childAuthoritativeNett = childNettJPY ?? 0;

    // 6. Apply Seasonal Adjustments to Supplier Fare (including multiplier if defined)
    const adultSeasonAdj = Math.round(adultAdjustmentJPY * (pricingMultiplier || 1.0));
    const childSeasonAdj = Math.round(childAdjustmentJPY * (pricingMultiplier || 1.0));

    const adultPerPaxSupplierJPY = adultAuthoritativeNett + adultSeasonAdj;
    const childPerPaxSupplierJPY = childAuthoritativeNett + childSeasonAdj;

    const totalAdultSupplierJPY = adultPerPaxSupplierJPY * adultsCount;
    const totalChildSupplierJPY = childPerPaxSupplierJPY * childrenCount;
    const totalSupplierCostJPY = totalAdultSupplierJPY + totalChildSupplierJPY;

    // 7. Apply TheUnbound DMC Commercial Markup
    const markupRule = db.getRailMarkupRule() || INITIAL_RAIL_MARKUP_RULE;
    const isB2BAgent = userRole === 'B2B_AGENT' || userRole === 'AGENT';
    const rawMarkupPercent = isB2BAgent 
      ? markupRule.b2bAgentMarkupPercent 
      : markupRule.buyerMarkupPercent;
    const appliedMarkupPercent = Number.isFinite(Number(rawMarkupPercent))
      ? Number(rawMarkupPercent)
      : (isB2BAgent ? INITIAL_RAIL_MARKUP_RULE.b2bAgentMarkupPercent : INITIAL_RAIL_MARKUP_RULE.buyerMarkupPercent);

    const totalPax = Math.max(1, adultsCount + childrenCount);
    const minMarginPerPax = Number.isFinite(Number(markupRule.minMarginJPY))
      ? Number(markupRule.minMarginJPY)
      : INITIAL_RAIL_MARKUP_RULE.minMarginJPY;
    const minGuaranteedMargin = minMarginPerPax * totalPax;
    const calculatedMarkup = Math.round(totalSupplierCostJPY * (appliedMarkupPercent / 100));
    const totalMarkupJPY = Math.max(calculatedMarkup, minGuaranteedMargin);

    const baseSellingPriceJPY = nativeCurrency === 'JPY'
      ? Math.round((totalSupplierCostJPY + totalMarkupJPY) / 10) * 10
      : Math.round((totalSupplierCostJPY + totalMarkupJPY) * 100) / 100;

    // 7b. Evaluate Validity & Repeatable Surcharges in Native Currency before Currency Conversion
    const validitySource = commercialPass || product;
    const validityCheck = evaluateInventoryValidity(validitySource, travelDate);
    const surchargeEval = evaluateApplicableSurcharges({
      surcharges: commercialPass?.surcharges || product?.surcharges,
      serviceDate: travelDate,
      baseNativeAmount: baseSellingPriceJPY,
      nativeCurrency,
      targetCurrency: normalizedTarget,
      adults: adultsCount,
      children: childrenCount,
      quantity: 1,
      defaultApplicationBasis: 'PER_PERSON'
    });

    const surchargeTotalNative = Number.isFinite(surchargeEval.totalSurchargeNative)
      ? surchargeEval.totalSurchargeNative
      : 0;

    const finalSellingPriceJPY = nativeCurrency === 'JPY'
      ? Math.round((baseSellingPriceJPY + surchargeTotalNative) / 10) * 10
      : Math.round((baseSellingPriceJPY + surchargeTotalNative) * 100) / 100;

    if (!Number.isFinite(finalSellingPriceJPY) || finalSellingPriceJPY <= 0) {
      return this.buildUnavailablePriceResult({
        originStation,
        destinationStation,
        route,
        product,
        serviceGroup,
        travelDate,
        departureTime,
        adultsCount,
        childrenCount,
        seatPreference,
        targetCurrency: normalizedTarget,
        reason: 'Price unavailable — Admin configuration required'
      });
    }

    // 8. Convert to Target Currency using Authoritative CurrencyConversionService
    // Scenario A: Rail fare currency matches the requested pricing currency -> use configured rate directly without FX lookup
    // Scenario B: Rail fare currency differs from the requested pricing currency -> convert using central FX engine
    const normalizedNative = currencyConversionService.normalizeCurrency(nativeCurrency, 'JPY');

    let exchangeRate = 1;
    let finalSellingPriceTargetCurrency = finalSellingPriceJPY;

    if (normalizedNative !== normalizedTarget) {
      const conversionResult = currencyConversionService.convertPrice(
        finalSellingPriceJPY,
        normalizedNative,
        normalizedTarget,
        {
          moduleName: 'SHINKANSEN_DYNAMIC_JOURNEY',
          productId: product?.id || 'RAIL-JP-ORD-RESERVED',
          fareId: adultRate?.rateId
        }
      );

      if (
        !conversionResult.success ||
        !currencyConversionService.isValidRate(conversionResult.rate) ||
        !Number.isFinite(conversionResult.convertedAmount) ||
        conversionResult.convertedAmount <= 0
      ) {
        const reason = conversionResult.isLoading 
          ? 'Price loading — Exchange rate pending' 
          : (conversionResult.error || 'Price unavailable — FX exchange rate unavailable');

        return this.buildUnavailablePriceResult({
          originStation,
          destinationStation,
          route,
          product,
          serviceGroup,
          travelDate,
          departureTime,
          adultsCount,
          childrenCount,
          seatPreference,
          targetCurrency: normalizedTarget,
          reason
        });
      }

      exchangeRate = conversionResult.rate;
      finalSellingPriceTargetCurrency = conversionResult.convertedAmount;
    }

    // 9. Duration Estimation
    const durationMinutes = serviceGroup === 'NOZOMI_MIZUHO'
      ? (route.travelDurationMinutes?.nozomiMizuho || 135)
      : (route.travelDurationMinutes?.hikariKodamaSakura || 160);

    const hours = Math.floor(durationMinutes / 60);
    const mins = durationMinutes % 60;
    const formattedDuration = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

    const seasonAdjTotal = (adultSeasonAdj * adultsCount) + (childSeasonAdj * childrenCount);

    return {
      isPriceAvailable: true,
      priceUnavailableReason: undefined,
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
      pricingVersion: '2.2-AUTHORITATIVE-ADMIN-CMS',
      calculationTimestamp: new Date().toISOString(),
      adultPerPaxSupplierJPY,
      childPerPaxSupplierJPY,
      adultSeasonAdjustmentJPY: adultSeasonAdj,
      childSeasonAdjustmentJPY: childSeasonAdj,
      totalSupplierCostJPY,
      appliedMarkupPercent,
      totalMarkupJPY,
      finalSellingPriceJPY,
      targetCurrency: normalizedTarget,
      finalSellingPriceTargetCurrency,
      exchangeRate,
      validityCheck,
      appliedSurcharges: surchargeEval.appliedSurcharges,
      surchargeTotalJPY: surchargeEval.totalSurchargeNative,
      surchargeTotalTargetCurrency: surchargeEval.totalSurchargeConverted,
      fareBreakdown: {
        nettPriceTotalJPY: (adultAuthoritativeNett * adultsCount) + (childAuthoritativeNett * childrenCount),
        seasonAdjustmentTotalJPY: seasonAdjTotal + surchargeEval.totalSurchargeNative,
        supplierNetTotalJPY: totalSupplierCostJPY,
        theUnboundMarkupJPY: totalMarkupJPY,
        surchargeTotalJPY: surchargeEval.totalSurchargeNative,
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
   * Authoritative fallback for unavailable or unconfigured rail prices.
   * Strictly never invents or estimates fares when rates are not configured.
   */
  private buildUnavailablePriceResult(params: {
    originStation?: RailStation;
    destinationStation?: RailStation;
    route?: RailRoute;
    product?: Product;
    serviceGroup?: RailServiceGroup;
    travelDate: string;
    departureTime?: string;
    adultsCount: number;
    childrenCount: number;
    seatPreference?: any;
    targetCurrency?: CurrencyCode;
    reason: string;
  }): RailPricingResult {
    const isGreenCar = params.product?.id === 'RAIL-JP-GREEN-RESERVED';
    const targetCurrency = params.targetCurrency || 'JPY';
    const totalPax = params.adultsCount + params.childrenCount;
    const originStation: RailStation = params.originStation || {
      stationId: '',
      stationCode: 'UNSET',
      stationName: 'Unknown Station',
      displayName: 'Unknown Station',
      searchAliases: [],
      country: 'Japan',
      regionId: 'reg-east-asia',
      destinationId: 'dest-japan',
      city: '',
      railOperator: '',
      latitude: 0,
      longitude: 0,
      timezone: 'Asia/Tokyo',
      active: false
    };
    const destinationStation: RailStation = params.destinationStation || {
      stationId: '',
      stationCode: 'UNSET',
      stationName: 'Unknown Station',
      displayName: 'Unknown Station',
      searchAliases: [],
      country: 'Japan',
      regionId: 'reg-east-asia',
      destinationId: 'dest-japan',
      city: '',
      railOperator: '',
      latitude: 0,
      longitude: 0,
      timezone: 'Asia/Tokyo',
      active: false
    };
    const route: RailRoute = params.route || {
      routeId: 'ROUTE-UNAVAILABLE',
      originStationId: originStation.stationId,
      destinationStationId: destinationStation.stationId,
      originStationName: originStation.stationName,
      destinationStationName: destinationStation.stationName,
      country: 'Japan',
      destinationId: 'dest-japan',
      railOperator: 'JR Central / JR West / smartEX',
      active: false,
      availableProductIds: [],
      availableServiceGroups: []
    };
    const product: Product = params.product || {
      id: isGreenCar ? 'RAIL-JP-GREEN-RESERVED' : 'RAIL-JP-ORD-RESERVED',
      name: isGreenCar ? 'Green Car — First Class / Reserved' : 'Ordinary Car (Reserved Seat)',
      category: 'Rail',
      productType: 'Rail',
      country: 'Japan',
      destinationId: 'dest-japan',
      destinationName: 'Japan',
      currency: 'JPY',
      adultNetPrice: 0,
      sellingPriceStartingFrom: 0
    } as Product;

    return {
      isPriceAvailable: false,
      priceUnavailableReason: params.reason || 'Price unavailable — Admin configuration required',
      route,
      originStation,
      destinationStation,
      product,
      carType: isGreenCar ? 'Green' : 'Ordinary',
      seatType: 'Reserved',
      serviceGroup: params.serviceGroup || 'NOZOMI_MIZUHO',
      travelDate: params.travelDate,
      departureTime: params.departureTime,
      seasonType: 'REGULAR',
      seasonLabel: 'Price Unavailable',
      pricingVersion: '2.2-AUTHORITATIVE-ADMIN-CMS',
      calculationTimestamp: new Date().toISOString(),
      adultPerPaxSupplierJPY: 0,
      childPerPaxSupplierJPY: 0,
      adultSeasonAdjustmentJPY: 0,
      childSeasonAdjustmentJPY: 0,
      totalSupplierCostJPY: 0,
      appliedMarkupPercent: 0,
      totalMarkupJPY: 0,
      finalSellingPriceJPY: 0,
      targetCurrency: currencyConversionService.normalizeCurrency(targetCurrency, 'USD'),
      finalSellingPriceTargetCurrency: 0,
      exchangeRate: currencyConversionService.getRate('JPY', targetCurrency).rate || 0,
      fareBreakdown: {
        nettPriceTotalJPY: 0,
        seasonAdjustmentTotalJPY: 0,
        supplierNetTotalJPY: 0,
        theUnboundMarkupJPY: 0,
        surchargeTotalJPY: 0,
        grandTotalJPY: 0
      },
      passengers: {
        adults: params.adultsCount,
        children: params.childrenCount,
        total: totalPax
      },
      seatPreference: params.seatPreference,
      estimatedDurationMinutes: params.serviceGroup === 'NOZOMI_MIZUHO'
        ? (route?.travelDurationMinutes?.nozomiMizuho || 135)
        : (route?.travelDurationMinutes?.hikariKodamaSakura || 160),
      formattedDuration: (() => {
        const dur = params.serviceGroup === 'NOZOMI_MIZUHO'
          ? (route?.travelDurationMinutes?.nozomiMizuho || 135)
          : (route?.travelDurationMinutes?.hikariKodamaSakura || 160);
        const h = Math.floor(dur / 60);
        const m = dur % 60;
        return h > 0 ? `${h}h ${m < 10 ? `0${m}` : m}m` : `${m}m`;
      })()
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
}

export const railPricingEngine = RailPricingEngine.getInstance();
