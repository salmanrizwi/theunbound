import { 
  JapanRailJourney, 
  JapanRailSegment, 
  JapanRailJourneySnapshot, 
  JapanRailSegmentSnapshot,
  ShinkansenJourneyPayload
} from '../../types/japanRailJourney';
import { QuoteItem, Product, CurrencyCode, UserRole } from '../../types';
import { RailBookingItemDetails } from '../../types/rail';
import { japanRailJourneyDataService } from './JapanRailJourneyDataService';

export class JapanRailJourneyMapper {
  private static instance: JapanRailJourneyMapper;

  private constructor() {}

  public static getInstance(): JapanRailJourneyMapper {
    if (!JapanRailJourneyMapper.instance) {
      JapanRailJourneyMapper.instance = new JapanRailJourneyMapper();
    }
    return JapanRailJourneyMapper.instance;
  }

  /**
   * Generates the canonical Shinkansen journey machine-readable payload
   */
  public toShinkansenPayload(journey: JapanRailJourney): ShinkansenJourneyPayload {
    return {
      journeyType: 'SHINKANSEN',
      configurator: 'SHINKANSEN_DYNAMIC_JOURNEY',
      journeyId: journey.journeyId,
      title: journey.title,
      destinationId: journey.destinationId,
      currency: journey.currency,
      configurationVersion: '2.0-SHINKANSEN-DYNAMIC',
      configuredAt: new Date().toISOString(),
      portalOrigin: journey.metadata.portalOrigin,
      passengers: { ...journey.passengers },
      pricing: { ...journey.pricing },
      segments: journey.segments.map(seg => ({
        segmentId: seg.segmentId,
        sequence: seg.sequence,
        origin: {
          id: seg.origin.stationId,
          name: seg.origin.stationName,
          code: seg.origin.stationCode,
          city: seg.origin.city
        },
        destination: {
          id: seg.destination.stationId,
          name: seg.destination.stationName,
          code: seg.destination.stationCode,
          city: seg.destination.city
        },
        travelDate: seg.travelDate,
        departureTime: seg.departureTime,
        railProductId: seg.productId,
        productName: seg.productName,
        class: seg.carClass,
        seatType: seg.seatType,
        serviceGroup: seg.serviceGroup,
        seatPreference: seg.seatPreference,
        passengers: { ...seg.passengerAllocation },
        selectedOptions: [
          seg.carClass,
          seg.seatType,
          seg.serviceGroup,
          seg.seatPreference
        ],
        price: {
          supplierCostJPY: seg.pricing.totalSupplierCostJPY,
          markupJPY: seg.pricing.totalMarkupJPY,
          sellingPriceJPY: seg.pricing.finalSellingPriceJPY,
          sellingPriceTargetCurrency: seg.pricing.finalSellingPriceTargetCurrency,
          currency: journey.currency
        }
      }))
    };
  }

  /**
   * Creates an immutable snapshot of the journey for quotes and bookings
   */
  public toSnapshot(journey: JapanRailJourney): JapanRailJourneySnapshot {
    const segmentSnapshots: JapanRailSegmentSnapshot[] = journey.segments.map(seg => ({
      segmentId: seg.segmentId,
      sequence: seg.sequence,
      originStationId: seg.origin.stationId,
      originStationName: seg.origin.stationName,
      originStationCode: seg.origin.stationCode,
      destinationStationId: seg.destination.stationId,
      destinationStationName: seg.destination.stationName,
      destinationStationCode: seg.destination.stationCode,
      travelDate: seg.travelDate,
      departureTime: seg.departureTime,
      productId: seg.productId,
      productName: seg.productName,
      carClass: seg.carClass,
      seatType: seg.seatType,
      serviceGroup: seg.serviceGroup,
      seatPreference: seg.seatPreference,
      passengerAllocation: { ...seg.passengerAllocation },
      supplierCostJPY: seg.pricing.totalSupplierCostJPY,
      markupJPY: seg.pricing.totalMarkupJPY,
      sellingPriceJPY: seg.pricing.finalSellingPriceJPY,
      sellingPriceTargetCurrency: seg.pricing.finalSellingPriceTargetCurrency,
      estimatedDurationMinutes: seg.estimatedDurationMinutes,
      seasonType: seg.pricing.seasonType,
      seasonId: seg.pricing.seasonId,
      seasonName: seg.pricing.seasonName,
      baseFareJPY: seg.pricing.fareBreakdown.baseFareJPY,
      superExpressSurchargeJPY: seg.pricing.fareBreakdown.superExpressSurchargeJPY,
      greenCarSurchargeJPY: seg.pricing.fareBreakdown.greenCarSurchargeJPY,
      appliedSeasonAdjustmentJPY: seg.pricing.fareBreakdown.seasonAdjustmentTotalJPY,
      pricingRuleSnapshot: {
        pricingVersion: seg.pricing.pricingVersion || '2.1-DYNAMIC-SEASON-CALENDAR',
        seasonId: seg.pricing.seasonId,
        seasonName: seg.pricing.seasonName,
        seasonType: seg.pricing.seasonType,
        baseFareJPY: seg.pricing.fareBreakdown.baseFareJPY,
        superExpressJPY: seg.pricing.fareBreakdown.superExpressSurchargeJPY,
        greenSurchargeJPY: seg.pricing.fareBreakdown.greenCarSurchargeJPY,
        seasonAdjustmentJPY: seg.pricing.fareBreakdown.seasonAdjustmentTotalJPY,
        supplierCostJPY: seg.pricing.totalSupplierCostJPY,
        markupPercent: seg.pricing.appliedMarkupPercent,
        markupJPY: seg.pricing.totalMarkupJPY,
        finalSellingPriceJPY: seg.pricing.finalSellingPriceJPY,
        currency: journey.currency,
        timestamp: seg.pricing.calculationTimestamp || new Date().toISOString()
      }
    }));

    return {
      journeyId: journey.journeyId,
      title: journey.title,
      destinationId: journey.destinationId,
      currency: journey.currency,
      exchangeRate: journey.pricing.exchangeRate,
      startDate: journey.startDate,
      endDate: journey.endDate,
      passengers: { ...journey.passengers },
      segments: segmentSnapshots,
      totalSupplierCostJPY: journey.pricing.totalSupplierCostJPY,
      totalMarkupJPY: journey.pricing.totalMarkupJPY,
      finalSellingPriceJPY: journey.pricing.finalSellingPriceJPY,
      finalSellingPriceTargetCurrency: journey.pricing.finalSellingPriceTargetCurrency,
      appliedMarkupPercent: journey.pricing.appliedMarkupPercent,
      configuredAt: new Date().toISOString(),
      portalOrigin: journey.metadata.portalOrigin,
      version: '2.0-DYNAMIC-MULTI-SEGMENT'
    };
  }

  /**
   * Converts a multi-segment Japan Rail journey into a structured QuoteItem
   */
  public toQuoteItem(
    journey: JapanRailJourney,
    dayNumber: number = 1
  ): QuoteItem {
    const snapshot = this.toSnapshot(journey);
    const shinkansenPayload = this.toShinkansenPayload(journey);
    const primarySegment = journey.segments[0] || null;
    const primaryProd = japanRailJourneyDataService.getRailProduct(primarySegment?.productId || 'RAIL-JP-ORD-RESERVED') || {
      id: primarySegment?.productId || 'RAIL-JP-ORD-RESERVED',
      name: 'Japan Rail Shinkansen High-Speed Network',
      category: 'Rail',
      productType: 'Rail',
      country: 'Japan',
      destinationId: 'dest-japan',
      destinationName: 'Japan',
      currency: 'JPY',
      adultNetPrice: journey.pricing.totalSupplierCostJPY,
      childNetPrice: 0,
      sellingPriceStartingFrom: journey.pricing.finalSellingPriceJPY
    } as Product;

    // Create readable route summary e.g. "Tokyo → Kyoto → Osaka"
    const routeNames = [journey.segments[0]?.origin?.stationName || 'Tokyo'];
    journey.segments.forEach(seg => {
      routeNames.push(seg.destination?.stationName || '');
    });
    const routeSummary = routeNames.filter(Boolean).join(' → ');

    // Detailed segment notes
    const segmentNotes = journey.segments.map((seg, idx) => 
      `Sector ${idx + 1}: ${seg.origin.stationName} (${seg.origin.stationCode}) → ${seg.destination.stationName} (${seg.destination.stationCode}) | ${seg.travelDate} @ ${seg.departureTime} | ${seg.serviceGroup === 'NOZOMI_MIZUHO' ? 'Nozomi/Mizuho' : 'Hikari/Kodama'} (${seg.carClass} Car Reserved) | Seat: ${seg.seatPreference}`
    ).join('\n');

    const totalPax = journey.passengers.adults + journey.passengers.children + journey.passengers.infants;

    const bookingDetails: RailBookingItemDetails = {
      type: 'JAPAN_RAIL',
      productId: primarySegment?.productId || 'RAIL-JP-ORD-RESERVED',
      productName: `Japan Rail Dynamic Journey (${journey.segments.length} Sectors): ${routeSummary}`,
      carType: primarySegment?.carClass || 'Ordinary',
      seatType: 'Reserved',
      serviceGroup: primarySegment?.serviceGroup || 'NOZOMI_MIZUHO',
      originStationId: primarySegment?.origin.stationId || 'JP-ST-TOKYO',
      originStationName: primarySegment?.origin.stationName || 'Tokyo',
      originStationCode: primarySegment?.origin.stationCode || 'TYO',
      destinationStationId: journey.segments[journey.segments.length - 1]?.destination.stationId || 'JP-ST-KYOTO',
      destinationStationName: journey.segments[journey.segments.length - 1]?.destination.stationName || 'Kyoto',
      destinationStationCode: journey.segments[journey.segments.length - 1]?.destination.stationCode || 'KYO',
      travelDate: journey.startDate,
      departureTime: primarySegment?.departureTime || '09:00',
      trainName: `Shinkansen (${journey.segments.length} Sectors)`,
      seatPreference: primarySegment?.seatPreference || 'MT_FUJI',
      hasOversizedBaggage: journey.segments.some(s => s.seatPreference === 'OVERSIZED_BAGGAGE'),
      adultsCount: journey.passengers.adults,
      childrenCount: journey.passengers.children,
      seasonType: primarySegment?.pricing.seasonType || 'REGULAR',
      pricingResult: primarySegment?.pricing as any,
      pnrReference: `JR-JOURNEY-${journey.journeyId.slice(-6).toUpperCase()}`,
      qrVoucherCode: `SMARTEX-JOURNEY-${journey.journeyId.slice(-6).toUpperCase()}`
    };

    const quoteItem: QuoteItem = {
      id: `quote-rail-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      product: {
        ...primaryProd,
        name: `Japan Rail Dynamic Journey (${journey.segments.length} ${journey.segments.length === 1 ? 'Sector' : 'Sectors'}): ${routeSummary}`,
        city: routeSummary
      },
      productId: primaryProd.id,
      customTitle: `Japan Rail Shinkansen Dynamic Journey: ${routeSummary}`,
      title: `${routeSummary} (${journey.segments.length} Sectors, ${primarySegment?.carClass || 'Ordinary'} Class)`,
      category: 'Rail',
      travelDate: journey.startDate,
      serviceTime: primarySegment?.departureTime || '09:00',
      notes: `Dynamic Multi-Sector Rail Journey:\n${segmentNotes}\nDay ${dayNumber}. Currency: ${journey.currency}. Total Distance: ${journey.segments.reduce((acc, s) => acc + (s.pricing.route.distanceKm || 0), 0)} km.`,
      pax: {
        adults: journey.passengers.adults,
        children: journey.passengers.children,
        infants: journey.passengers.infants
      },
      selectedAddonIds: [],
      railJourneyDetails: bookingDetails,
      japanRailJourneySnapshot: snapshot as any,
      shinkansenJourneyPayload: shinkansenPayload as any,
      metadata: {
        journeySnapshot: snapshot,
        shinkansenJourneyPayload: shinkansenPayload,
        dayNumber
      },
      calculation: {
        productId: primaryProd.id,
        productName: `Japan Rail Dynamic Journey: ${routeSummary}`,
        pricingTier: 'CUSTOM',
        pax: {
          adults: journey.passengers.adults,
          children: journey.passengers.children,
          infants: journey.passengers.infants,
          totalPax
        },
        travelDate: journey.startDate,
        currency: journey.currency,
        adultsSubtotalNet: journey.pricing.totalSupplierCostJPY,
        childrenSubtotalNet: 0,
        infantsSubtotalNet: 0,
        addonsSubtotalNet: 0,
        totalNetCost: journey.pricing.totalSupplierCostJPY,
        b2bWholesaleMarkupRate: journey.pricing.appliedMarkupPercent / 100,
        b2bWholesaleNetToAgent: journey.pricing.finalSellingPriceJPY,
        agentClientMarkupRate: 0,
        agentProfitAmount: 0,
        markupRate: journey.pricing.appliedMarkupPercent / 100,
        markupAmount: journey.pricing.totalMarkupJPY,
        grossBeforeTax: journey.pricing.finalSellingPriceJPY,
        taxRate: 0.10,
        taxAmount: 0,
        serviceFee: 0,
        discountRate: 0,
        discountAmount: 0,
        commissionRate: 0.10,
        commissionAmount: 0,
        adultsSubtotalSelling: journey.pricing.finalSellingPriceJPY,
        childrenSubtotalSelling: 0,
        infantsSubtotalSelling: 0,
        addonsSubtotalSelling: 0,
        adultPricePerPax: journey.pricing.finalSellingPriceJPY / (totalPax || 1),
        childPricePerPax: 0,
        finalTotalSellingPrice: journey.pricing.finalSellingPriceTargetCurrency,
        sellingPriceFinal: journey.pricing.finalSellingPriceTargetCurrency,
        pricePerPerson: journey.pricing.perPersonTargetCurrency,
        nativeCurrency: 'JPY',
        nativeTotalNetCost: journey.pricing.totalSupplierCostJPY,
        nativeGrossBeforeTax: journey.pricing.finalSellingPriceJPY,
        nativeMarkupAmount: journey.pricing.totalMarkupJPY,
        nativeFinalSellingPrice: journey.pricing.finalSellingPriceJPY,
        dmcMarginAmount: journey.pricing.totalMarkupJPY,
        dmcMarginPercent: journey.pricing.appliedMarkupPercent
      } as any
    };

    return quoteItem;
  }
}

export const japanRailJourneyMapper = JapanRailJourneyMapper.getInstance();
