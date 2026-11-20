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
import { resolveRailSeasonForDate } from '../utils/railSeasonHelper';
import { INITIAL_RAIL_MARKUP_RULE } from '../data/initialRailMarkup';
import { INITIAL_JAPAN_RAIL_COMMERCIAL_PRODUCTS } from '../data/initialRailCommercialProducts';
import { convertCurrency } from './currencyEngine';
import { currencyConversionService } from './currencyConversionService';
import { evaluateInventoryValidity, evaluateApplicableSurcharges } from './pricingEngine';
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

    // 1. Validate & Resolve Stations strictly from authoritative database
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

    if (!originStation || !destinationStation) {
      const missingParts: string[] = [];
      if (!originStation) missingParts.push(`origin station "${originStationId || 'unset'}"`);
      if (!destinationStation) missingParts.push(`destination station "${destinationStationId || 'unset'}"`);
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
        diagnosticCode: 'STATION_NOT_FOUND',
        reason: `Station not found in Japan Rail Inventory: ${missingParts.join(' and ')}.`
      });
    }

    if (originStation.active === false || destinationStation.active === false) {
      const inactiveNames = [
        originStation.active === false ? `${originStation.stationName} (${originStation.stationCode})` : null,
        destinationStation.active === false ? `${destinationStation.stationName} (${destinationStation.stationCode})` : null
      ].filter(Boolean);
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
        diagnosticCode: 'STATION_INACTIVE',
        reason: `Station inactive in Japan Rail Inventory: ${inactiveNames.join(', ')}. Activate the station in Admin CMS.`
      });
    }

    if (originStation.stationId === destinationStation.stationId) {
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
        diagnosticCode: 'SAME_STATION',
        reason: `Origin and destination stations cannot be identical (${originStation.stationName}). Select two distinct stations.`
      });
    }

    // 2. Resolve route directionally from authoritative database
    // Priority: exact (origin -> dest) first; if exact exists and is explicitly deactivated, respect deactivation.
    // Otherwise fall back to active reverse corridor (dest -> origin) for symmetric rail corridors.
    const storedRoutes = db.getRailRoutes();
    const storedRates = db.getRailRates();

    const exactRoute = storedRoutes.find(
      r => r.originStationId === originStation.stationId && r.destinationStationId === destinationStation.stationId
    );
    const reverseActiveRoute = storedRoutes.find(
      r =>
        r.originStationId === destinationStation.stationId &&
        r.destinationStationId === originStation.stationId &&
        r.active !== false
    );

    if (exactRoute && exactRoute.active === false) {
      return this.buildUnavailablePriceResult({
        originStation,
        destinationStation,
        route: exactRoute,
        serviceGroup,
        travelDate,
        departureTime,
        adultsCount,
        childrenCount,
        seatPreference,
        targetCurrency: normalizedTarget,
        diagnosticCode: 'INACTIVE_ROUTE',
        reason: `Route ${originStation.stationName} → ${destinationStation.stationName} (${exactRoute.routeId}) is currently inactive. Activate it in Admin CMS → Japan Rail Inventory → Routes.`
      });
    }

    const route = exactRoute || reverseActiveRoute;
    const routeMatchType: 'EXACT_DIRECTION' | 'SYMMETRIC_CORRIDOR' | undefined = exactRoute
      ? 'EXACT_DIRECTION'
      : reverseActiveRoute
        ? 'SYMMETRIC_CORRIDOR'
        : undefined;

    if (!route || route.active === false) {
      const existingPairRatesCount = storedRates.filter(
        r =>
          r.active !== false &&
          ((r.originStationId === originStation.stationId && r.destinationStationId === destinationStation.stationId) ||
           (r.originStationId === destinationStation.stationId && r.destinationStationId === originStation.stationId))
      ).length;
      const missingRouteMsg =
        existingPairRatesCount > 0
          ? `No active rail route configured for ${originStation.stationName} → ${destinationStation.stationName} (${existingPairRatesCount} fare record${existingPairRatesCount === 1 ? '' : 's'} exist without a route). Create this route in Admin CMS → Japan Rail Inventory → Routes.`
          : `No active rail route configured for ${originStation.stationName} → ${destinationStation.stationName}. Configure the route and fares in Admin CMS → Japan Rail Inventory.`;
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
        diagnosticCode: 'MISSING_ROUTE',
        reason: missingRouteMsg
      });
    }

    // 2b. Validate applicable service group against route configuration
    const matchesServiceGroup = (rateGroup: string, requestedGroup: string) =>
      rateGroup === requestedGroup ||
      (requestedGroup.startsWith('HIKARI_KODAMA_SAKURA') && rateGroup?.startsWith('HIKARI_KODAMA_SAKURA'));

    if (
      Array.isArray(route.availableServiceGroups) &&
      route.availableServiceGroups.length > 0 &&
      !route.availableServiceGroups.some(g => matchesServiceGroup(g, serviceGroup))
    ) {
      const supportedLabels = route.availableServiceGroups
        .map(g => (g === 'NOZOMI_MIZUHO' ? 'Nozomi / Mizuho (Express)' : 'Hikari / Kodama / Sakura'))
        .join(', ');
      return this.buildUnavailablePriceResult({
        originStation,
        destinationStation,
        route,
        routeMatchType,
        serviceGroup,
        travelDate,
        departureTime,
        adultsCount,
        childrenCount,
        seatPreference,
        targetCurrency: normalizedTarget,
        diagnosticCode: 'SERVICE_NOT_SUPPORTED',
        reason: `${serviceGroup === 'NOZOMI_MIZUHO' ? 'Nozomi / Mizuho' : 'Hikari / Kodama / Sakura'} service is not enabled on route ${originStation.stationName} → ${destinationStation.stationName}. Configured service(s): ${supportedLabels}.`
      });
    }

    // 3. Resolve Product & Commercial Master Product
    const directProduct = db.getProductById(productId) || (INITIAL_JAPAN_RAIL_COMMERCIAL_PRODUCTS.find(p => p.id === productId || String(p.productCode) === String(productId) || String((p as any).sku || '') === String(productId)) as any);
    const isGreenCar = productId === 'RAIL-JP-GREEN-RESERVED' || (directProduct?.name || '').toLowerCase().includes('green');
    const canonicalProductId = isGreenCar ? 'RAIL-JP-GREEN-RESERVED' : 'RAIL-JP-ORD-RESERVED';
    const product = directProduct || db.getProductById(canonicalProductId) || (INITIAL_JAPAN_RAIL_COMMERCIAL_PRODUCTS.find(p => p.id === canonicalProductId) as any);
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
        routeMatchType,
        serviceGroup,
        travelDate,
        departureTime,
        adultsCount,
        childrenCount,
        seatPreference,
        targetCurrency: normalizedTarget,
        diagnosticCode: 'PRODUCT_INACTIVE',
        reason: `Rail product "${product?.name || productId}" is inactive or archived. Activate it in Admin CMS.`
      });
    }

    // 4. Resolve Season & Dynamic Adjustments from live database Season Calendar
    const storedSeasons = db.getRailSeasons();
    const seasonMatch = resolveRailSeasonForDate(travelDate, storedSeasons);
    const { seasonType, seasonLabel, seasonPeriod, adultAdjustmentJPY, childAdjustmentJPY, pricingMultiplier } = seasonMatch;

    // 5. Lookup exact rate records (Adult & Child) strictly from canonical Admin-managed pricing
    // Priority:
    //   1) Exact direction (origin -> destination) BEFORE symmetric reverse direction
    //   2) Active + verified positive nettPrice
    //   3) Matching routeId
    //   4) Most recently updatedAt
    const findLiveRate = (paxType: 'ADULT' | 'CHILD'): { rate?: RailRate; matchType?: 'EXACT_DIRECTION' | 'SYMMETRIC_CORRIDOR' } => {
      const candidates = storedRates.filter(r =>
        ((r.originStationId === originStation.stationId && r.destinationStationId === destinationStation.stationId) ||
         (r.originStationId === destinationStation.stationId && r.destinationStationId === originStation.stationId)) &&
        (r.productId === productId || r.productId === canonicalProductId) &&
        matchesServiceGroup(r.serviceGroup, serviceGroup) &&
        (r.passengerType?.toUpperCase() === paxType ||
          (paxType === 'ADULT' && r.passengerType?.toUpperCase() === 'ADT') ||
          (paxType === 'CHILD' && r.passengerType?.toUpperCase() === 'CNB'))
      );

      if (candidates.length === 0) return {};

      const isUsable = (r: RailRate) => {
        const nett = resolveRailRateNettPrice(r);
        return r.active !== false && !r.needsAdminReview && nett !== null && nett > 0 ? 1 : 0;
      };

      const sorted = [...candidates].sort((a, b) => {
        const exactA = a.originStationId === originStation.stationId && a.destinationStationId === destinationStation.stationId ? 1 : 0;
        const exactB = b.originStationId === originStation.stationId && b.destinationStationId === destinationStation.stationId ? 1 : 0;
        if (exactB !== exactA) return exactB - exactA;

        const usableA = isUsable(a);
        const usableB = isUsable(b);
        if (usableB !== usableA) return usableB - usableA;

        const routeMatchA = a.routeId === route.routeId ? 1 : 0;
        const routeMatchB = b.routeId === route.routeId ? 1 : 0;
        if (routeMatchB !== routeMatchA) return routeMatchB - routeMatchA;

        const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return timeB - timeA;
      });

      const chosen = sorted[0];
      const matchType: 'EXACT_DIRECTION' | 'SYMMETRIC_CORRIDOR' =
        chosen.originStationId === originStation.stationId && chosen.destinationStationId === destinationStation.stationId
          ? 'EXACT_DIRECTION'
          : 'SYMMETRIC_CORRIDOR';
      return { rate: chosen, matchType };
    };

    const adultLookup = adultsCount > 0 ? findLiveRate('ADULT') : {};
    const childLookup = childrenCount > 0 ? findLiveRate('CHILD') : {};
    const adultRate = adultLookup.rate;
    const childRate = childLookup.rate;
    const fareMatchType = adultLookup.matchType || childLookup.matchType;

    const adultNettJPY = adultRate ? resolveRailRateNettPrice(adultRate) : null;
    const childNettJPY = childRate ? resolveRailRateNettPrice(childRate) : null;
    const carLabel = isGreenCar ? 'Green Car' : 'Ordinary Car';
    const serviceLabel = serviceGroup === 'NOZOMI_MIZUHO' ? 'Nozomi / Mizuho' : 'Hikari / Kodama / Sakura';

    // Strict Rule: Never invent, estimate or substitute a price.
    // If a required price rate is missing, unpublished, flagged for Admin review, or zero, return authoritative unavailable state.
    if (
      adultsCount > 0 &&
      (!adultRate || adultRate.active === false || adultRate.needsAdminReview || adultNettJPY === null || adultNettJPY <= 0)
    ) {
      const detail = !adultRate
        ? `No active Adult fare configured for ${originStation.stationName} → ${destinationStation.stationName} (${carLabel}, ${serviceLabel}).`
        : adultRate.active === false
          ? `Adult fare (${adultRate.rateId}) for ${originStation.stationName} → ${destinationStation.stationName} is inactive.`
          : `Adult fare (${adultRate.rateId}) requires a verified positive Nett Price (JPY) in Admin CMS.`;
      return this.buildUnavailablePriceResult({
        originStation,
        destinationStation,
        route,
        routeMatchType,
        product,
        serviceGroup,
        travelDate,
        departureTime,
        adultsCount,
        childrenCount,
        seatPreference,
        targetCurrency: normalizedTarget,
        diagnosticCode: 'MISSING_FARE',
        reason: `${detail} Configure fare in Admin CMS → Japan Rail Inventory → Rate Explorer.`
      });
    }

    if (
      childrenCount > 0 &&
      (!childRate || childRate.active === false || childRate.needsAdminReview || childNettJPY === null || childNettJPY <= 0)
    ) {
      const detail = !childRate
        ? `No active Child fare configured for ${originStation.stationName} → ${destinationStation.stationName} (${carLabel}, ${serviceLabel}).`
        : childRate.active === false
          ? `Child fare (${childRate.rateId}) for ${originStation.stationName} → ${destinationStation.stationName} is inactive.`
          : `Child fare (${childRate.rateId}) requires a verified positive Nett Price (JPY) in Admin CMS.`;
      return this.buildUnavailablePriceResult({
        originStation,
        destinationStation,
        route,
        routeMatchType,
        product,
        serviceGroup,
        travelDate,
        departureTime,
        adultsCount,
        childrenCount,
        seatPreference,
        targetCurrency: normalizedTarget,
        diagnosticCode: 'MISSING_FARE',
        reason: `${detail} Configure fare in Admin CMS → Japan Rail Inventory → Rate Explorer.`
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

    // 7. Apply TheUnbound DMC Commercial Markup (Mutually Exclusive Product-Level vs Agent-Level Margin)
    const markupRule = db.getRailMarkupRule() || INITIAL_RAIL_MARKUP_RULE;
    const agencySettings = db.resolveAgencyPricingSettings({
      companyId: params.companyId,
      agencyName: params.agencyName
    });
    const isProductLevelMarginEnabled =
      typeof params.productLevelMarginEnabled === 'boolean'
        ? params.productLevelMarginEnabled
        : agencySettings.productLevelMarginEnabled !== false;
    const rawMarkupPercent = isProductLevelMarginEnabled
      ? markupRule.b2bAgentMarkupPercent
      : (typeof params.customAgentMarginPercent === 'number'
          ? params.customAgentMarginPercent
          : agencySettings.agentLevelMarginPercent);
    const appliedMarkupPercent = Number.isFinite(Number(rawMarkupPercent))
      ? Number(rawMarkupPercent)
      : (isProductLevelMarginEnabled ? INITIAL_RAIL_MARKUP_RULE.b2bAgentMarkupPercent : 0);

    const totalPax = Math.max(1, adultsCount + childrenCount);
    const minMarginPerPax = isProductLevelMarginEnabled && Number.isFinite(Number(markupRule.minMarginJPY))
      ? Number(markupRule.minMarginJPY)
      : 0;
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
      productId: commercialPass?.id || product?.id,
      productName: (commercialPass as any)?.productName || (commercialPass as any)?.name || product?.name || `${originStation.stationName} → ${destinationStation.stationName}`,
      category: 'Rail / Shinkansen',
      productType: 'Rail & Transportation',
      destinationId: (commercialPass as any)?.destinationId || 'dest-japan',
      destinationName: (commercialPass as any)?.destinationName || 'Japan',
      country: 'Japan',
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
        routeMatchType,
        product,
        serviceGroup,
        travelDate,
        departureTime,
        adultsCount,
        childrenCount,
        seatPreference,
        targetCurrency: normalizedTarget,
        diagnosticCode: 'INVALID_PRICE',
        reason: 'Calculated rail selling price is invalid. Check fare and markup settings in Admin CMS.'
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
          routeMatchType,
          product,
          serviceGroup,
          travelDate,
          departureTime,
          adultsCount,
          childrenCount,
          seatPreference,
          targetCurrency: normalizedTarget,
          diagnosticCode: 'FX_UNAVAILABLE',
          reason
        });
      }

      exchangeRate = conversionResult.rate;
      finalSellingPriceTargetCurrency = conversionResult.convertedAmount;
    }

    // 9. Duration Resolution — use only configured route durations; never fabricate arbitrary minutes
    const configuredDuration =
      serviceGroup === 'NOZOMI_MIZUHO'
        ? (route.travelDurationMinutes?.nozomiMizuho ?? route.durationMinutes)
        : (route.travelDurationMinutes?.hikariKodamaSakura ?? route.durationMinutes);
    const durationMinutes =
      typeof configuredDuration === 'number' && Number.isFinite(configuredDuration) && configuredDuration > 0
        ? Math.round(configuredDuration)
        : 0;

    const hours = Math.floor(durationMinutes / 60);
    const mins = durationMinutes % 60;
    const formattedDuration =
      durationMinutes > 0
        ? (hours > 0 ? `${hours}h ${mins}m` : `${mins}m`)
        : 'Schedule TBC';

    const seasonAdjTotal = (adultSeasonAdj * adultsCount) + (childSeasonAdj * childrenCount);

    return {
      isPriceAvailable: true,
      priceUnavailableReason: undefined,
      diagnosticCode: 'OK',
      routeId: route.routeId,
      routeCode: route.routeCode,
      routeMatchType,
      adultRateId: adultRate?.rateId,
      childRateId: childRate?.rateId,
      fareMatchType,
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
    routeMatchType?: 'EXACT_DIRECTION' | 'SYMMETRIC_CORRIDOR';
    product?: Product;
    serviceGroup?: RailServiceGroup;
    travelDate: string;
    departureTime?: string;
    adultsCount: number;
    childrenCount: number;
    seatPreference?: any;
    targetCurrency?: CurrencyCode;
    diagnosticCode?: RailPricingResult['diagnosticCode'];
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

    const configuredDur = params.serviceGroup === 'NOZOMI_MIZUHO'
      ? (params.route?.travelDurationMinutes?.nozomiMizuho ?? params.route?.durationMinutes)
      : (params.route?.travelDurationMinutes?.hikariKodamaSakura ?? params.route?.durationMinutes);
    const safeDur = typeof configuredDur === 'number' && Number.isFinite(configuredDur) && configuredDur > 0
      ? Math.round(configuredDur)
      : 0;

    return {
      isPriceAvailable: false,
      priceUnavailableReason: params.reason || 'Price unavailable — Admin configuration required',
      diagnosticCode: params.diagnosticCode,
      routeId: params.route?.routeId,
      routeCode: params.route?.routeCode,
      routeMatchType: params.routeMatchType,
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
      estimatedDurationMinutes: safeDur,
      formattedDuration: (() => {
        if (safeDur <= 0) return 'Schedule TBC';
        const h = Math.floor(safeDur / 60);
        const m = safeDur % 60;
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
      routeId: pricing.routeId || pricing.route?.routeId,
      routeCode: pricing.routeCode || pricing.route?.routeCode,
      adultRateId: pricing.adultRateId,
      childRateId: pricing.childRateId,
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
