import { 
  JapanRailJourney, 
  JapanRailSegment, 
  JapanRailJourneyPricingSummary,
  JapanRailJourneyFareBreakdown 
} from '../../types/japanRailJourney';
import { CurrencyCode, UserRole } from '../../types';
import { railPricingEngine } from '../railPricingEngine';
import { convertCurrency } from '../currencyEngine';
import { RailPricingResult } from '../../types/rail';

export class JapanRailJourneyPricingService {
  private static instance: JapanRailJourneyPricingService;

  private constructor() {}

  public static getInstance(): JapanRailJourneyPricingService {
    if (!JapanRailJourneyPricingService.instance) {
      JapanRailJourneyPricingService.instance = new JapanRailJourneyPricingService();
    }
    return JapanRailJourneyPricingService.instance;
  }

  /**
   * Calculates pricing for a single segment
   */
  public priceSegment(
    segment: JapanRailSegment,
    userRole?: UserRole,
    targetCurrency: CurrencyCode = 'JPY'
  ): RailPricingResult {
    const pax = segment.passengerAllocation;
    return railPricingEngine.calculatePrice({
      originStationId: segment.origin.stationId,
      destinationStationId: segment.destination.stationId,
      productId: segment.productId as any,
      serviceGroup: segment.serviceGroup,
      travelDate: segment.travelDate,
      departureTime: segment.departureTime,
      adultsCount: pax.adults,
      childrenCount: pax.children,
      seatPreference: segment.seatPreference,
      userRole,
      targetCurrency
    });
  }

  /**
   * Summarizes and aggregates pricing for an entire multi-segment journey
   */
  public calculateJourneyPricing(
    segments: JapanRailSegment[],
    userRole?: UserRole,
    targetCurrency: CurrencyCode = 'JPY'
  ): JapanRailJourneyPricingSummary {
    let totalSupplierCostJPY = 0;
    let totalMarkupJPY = 0;
    let finalSellingPriceJPY = 0;
    let finalSellingPriceTargetCurrency = 0;

    let totalBaseFareJPY = 0;
    let totalSuperExpressSurchargeJPY = 0;
    let totalGreenCarSurchargeJPY = 0;
    let totalSeasonAdjustmentJPY = 0;

    const segmentPricingMap: Record<string, RailPricingResult> = {};

    segments.forEach(seg => {
      const res = this.priceSegment(seg, userRole, targetCurrency);
      segmentPricingMap[seg.segmentId] = res;

      totalSupplierCostJPY += res.totalSupplierCostJPY;
      totalMarkupJPY += res.totalMarkupJPY;
      finalSellingPriceJPY += res.finalSellingPriceJPY;
      finalSellingPriceTargetCurrency += res.finalSellingPriceTargetCurrency;

      totalBaseFareJPY += res.fareBreakdown.baseFareJPY;
      totalSuperExpressSurchargeJPY += res.fareBreakdown.superExpressSurchargeJPY;
      totalGreenCarSurchargeJPY += res.fareBreakdown.greenCarSurchargeJPY;
      totalSeasonAdjustmentJPY += res.fareBreakdown.seasonAdjustmentTotalJPY;
    });

    const exchangeRate = convertCurrency(1, 'JPY', targetCurrency);
    const appliedMarkupPercent = totalSupplierCostJPY > 0 
      ? Math.round((totalMarkupJPY / totalSupplierCostJPY) * 1000) / 10 
      : 18;

    // Calculate total passengers across journey
    const totalPax = segments.length > 0 
      ? (segments[0].passengerAllocation.adults + segments[0].passengerAllocation.children) || 1
      : 1;

    const perPersonTargetCurrency = Math.round((finalSellingPriceTargetCurrency / totalPax) * 100) / 100;

    const fareBreakdown: JapanRailJourneyFareBreakdown = {
      totalBaseFareJPY,
      totalSuperExpressSurchargeJPY,
      totalGreenCarSurchargeJPY,
      totalSeasonAdjustmentJPY,
      totalSupplierCostJPY,
      totalTheUnboundMarkupJPY: totalMarkupJPY,
      grandTotalJPY: finalSellingPriceJPY
    };

    return {
      totalSupplierCostJPY,
      totalMarkupJPY,
      finalSellingPriceJPY,
      targetCurrency,
      finalSellingPriceTargetCurrency: Math.round(finalSellingPriceTargetCurrency * 100) / 100,
      exchangeRate,
      appliedMarkupPercent,
      perPersonTargetCurrency,
      fareBreakdown,
      segmentPricingMap
    };
  }
}

export const japanRailJourneyPricingService = JapanRailJourneyPricingService.getInstance();
