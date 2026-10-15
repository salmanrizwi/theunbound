import { 
  JapanRailJourney, 
  JapanRailSegment, 
  JapanRailJourneyPricingSummary,
  JapanRailJourneyFareBreakdown 
} from '../../types/japanRailJourney';
import { CurrencyCode, UserRole } from '../../types';
import { railPricingEngine } from '../railPricingEngine';
import { convertCurrency } from '../currencyEngine';
import { currencyConversionService } from '../currencyConversionService';
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

    let totalNettPriceJPY = 0;
    let totalSeasonAdjustmentJPY = 0;

    let isPriceAvailable = true;
    let priceUnavailableReason: string | undefined = undefined;

    const segmentPricingMap: Record<string, RailPricingResult> = {};

    segments.forEach(seg => {
      const res = this.priceSegment(seg, userRole, targetCurrency);
      segmentPricingMap[seg.segmentId] = res;

      if (res.isPriceAvailable === false) {
        isPriceAvailable = false;
        if (!priceUnavailableReason) {
          priceUnavailableReason = res.priceUnavailableReason || 'Price unavailable — Admin configuration required';
        }
      }

      totalSupplierCostJPY += res.totalSupplierCostJPY;
      totalMarkupJPY += res.totalMarkupJPY;
      finalSellingPriceJPY += res.finalSellingPriceJPY;
      finalSellingPriceTargetCurrency += res.finalSellingPriceTargetCurrency;

      totalNettPriceJPY += res.fareBreakdown.nettPriceTotalJPY;
      totalSeasonAdjustmentJPY += res.fareBreakdown.seasonAdjustmentTotalJPY;
    });

    // If any segment has an unavailable price, zero out totals to prevent displaying fabricated amounts
    if (!isPriceAvailable) {
      finalSellingPriceJPY = 0;
      finalSellingPriceTargetCurrency = 0;
    }

    const normalizedTarget = currencyConversionService.normalizeCurrency(targetCurrency, 'USD');
    const rateLookup = currencyConversionService.getRate('JPY', normalizedTarget);
    const exchangeRate = isPriceAvailable 
      ? (rateLookup.isAvailable ? rateLookup.rate : (normalizedTarget === 'JPY' ? 1 : 0))
      : 0;

    const appliedMarkupPercent = totalSupplierCostJPY > 0 
      ? Math.round((totalMarkupJPY / totalSupplierCostJPY) * 1000) / 10 
      : 18;

    // Calculate total passengers across journey
    const totalPax = segments.length > 0 
      ? (segments[0].passengerAllocation.adults + segments[0].passengerAllocation.children) || 1
      : 1;

    const roundedFinalTarget = isPriceAvailable
      ? (normalizedTarget === 'JPY' || normalizedTarget === 'THB'
          ? Math.round(finalSellingPriceTargetCurrency)
          : Math.round(finalSellingPriceTargetCurrency * 100) / 100)
      : 0;

    const perPersonTargetCurrency = isPriceAvailable 
      ? (normalizedTarget === 'JPY' || normalizedTarget === 'THB'
          ? Math.round(roundedFinalTarget / totalPax)
          : Math.round((roundedFinalTarget / totalPax) * 100) / 100)
      : 0;

    const fareBreakdown: JapanRailJourneyFareBreakdown = {
      totalNettPriceJPY: isPriceAvailable ? totalNettPriceJPY : 0,
      totalSeasonAdjustmentJPY: isPriceAvailable ? totalSeasonAdjustmentJPY : 0,
      totalSupplierCostJPY: isPriceAvailable ? totalSupplierCostJPY : 0,
      totalTheUnboundMarkupJPY: isPriceAvailable ? totalMarkupJPY : 0,
      grandTotalJPY: finalSellingPriceJPY
    };

    return {
      isPriceAvailable,
      priceUnavailableReason,
      totalSupplierCostJPY: isPriceAvailable ? totalSupplierCostJPY : 0,
      totalMarkupJPY: isPriceAvailable ? totalMarkupJPY : 0,
      finalSellingPriceJPY,
      targetCurrency: normalizedTarget,
      finalSellingPriceTargetCurrency: roundedFinalTarget,
      exchangeRate,
      appliedMarkupPercent,
      perPersonTargetCurrency,
      fareBreakdown,
      segmentPricingMap
    };
  }
}

export const japanRailJourneyPricingService = JapanRailJourneyPricingService.getInstance();
