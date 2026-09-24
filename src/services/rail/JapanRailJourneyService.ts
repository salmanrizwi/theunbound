import { 
  JapanRailJourney, 
  JapanRailSegment, 
  JapanRailJourneyPassengerConfig,
  JourneyPortalOrigin,
  JapanRailJourneySnapshot
} from '../../types/japanRailJourney';
import { CurrencyCode, UserRole, QuoteItem } from '../../types';
import { japanRailJourneyDataService } from './JapanRailJourneyDataService';
import { japanRailJourneyValidationService } from './JapanRailJourneyValidationService';
import { japanRailJourneyPricingService } from './JapanRailJourneyPricingService';
import { japanRailJourneyMapper } from './JapanRailJourneyMapper';

export class JapanRailJourneyService {
  private static instance: JapanRailJourneyService;

  private constructor() {}

  public static getInstance(): JapanRailJourneyService {
    if (!JapanRailJourneyService.instance) {
      JapanRailJourneyService.instance = new JapanRailJourneyService();
    }
    return JapanRailJourneyService.instance;
  }

  /**
   * Creates a new dynamic journey with a default first segment
   */
  public createDefaultJourney(options?: {
    portalOrigin?: JourneyPortalOrigin;
    userRole?: UserRole;
    currency?: CurrencyCode;
    passengers?: JapanRailJourneyPassengerConfig;
    initialOriginId?: string;
    initialDestId?: string;
    initialProductId?: 'RAIL-JP-ORD-RESERVED' | 'RAIL-JP-GREEN-RESERVED';
    initialDate?: string;
    initialTime?: string;
  }): JapanRailJourney {
    const portalOrigin = options?.portalOrigin || 'BUYER';
    const userRole = options?.userRole;
    const currency = options?.currency || 'JPY';
    const passengers: JapanRailJourneyPassengerConfig = options?.passengers || {
      adults: 2,
      children: 0,
      infants: 0
    };

    const initialOriginId = options?.initialOriginId || 'JP-ST-TOKYO';
    const initialDestId = options?.initialDestId || 'JP-ST-KYOTO';
    const initialProductId = options?.initialProductId || 'RAIL-JP-ORD-RESERVED';

    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const travelDate = options?.initialDate || tomorrow;
    const departureTime = options?.initialTime || '09:00';

    const originRef = japanRailJourneyDataService.getStationRef(initialOriginId);
    const destRef = japanRailJourneyDataService.getStationRef(initialDestId);

    const firstSegmentId = `seg-${Date.now()}-1`;
    const initialSegment: JapanRailSegment = {
      segmentId: firstSegmentId,
      sequence: 1,
      origin: originRef,
      destination: destRef,
      travelDate,
      departureTime,
      productId: initialProductId,
      productName: initialProductId === 'RAIL-JP-GREEN-RESERVED' 
        ? 'Green Car (First Class / Reserved Seat)' 
        : 'Ordinary Car (Reserved Seat)',
      carClass: initialProductId === 'RAIL-JP-GREEN-RESERVED' ? 'Green' : 'Ordinary',
      seatType: 'Reserved',
      serviceGroup: 'NOZOMI_MIZUHO',
      seatPreference: 'MT_FUJI',
      passengerAllocation: { ...passengers },
      estimatedDurationMinutes: 135,
      formattedDuration: '2h 15m',
      pricing: {} as any,
      validationErrors: [],
      validationWarnings: [],
      isValid: true
    };

    // Calculate initial segment pricing
    initialSegment.pricing = japanRailJourneyPricingService.priceSegment(initialSegment, userRole, currency);

    const journeyId = `JR-JRN-${Date.now().toString(36).toUpperCase()}`;

    const journey: JapanRailJourney = {
      journeyId,
      title: `Japan Rail Dynamic Journey: ${originRef.stationName} → ${destRef.stationName}`,
      destinationId: 'dest-japan',
      destinationName: 'Japan',
      regionId: 'reg-east-asia',
      startDate: travelDate,
      endDate: travelDate,
      passengers,
      segments: [initialSegment],
      selectedRailProducts: [initialProductId],
      pricing: {} as any,
      currency,
      validation: {
        isValid: true,
        errors: [],
        warnings: [],
        segmentErrors: {},
        segmentWarnings: {}
      },
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        portalOrigin,
        createdByRole: userRole
      }
    };

    return this.validateAndRecalculate(journey, userRole);
  }

  /**
   * Adds a new dynamic segment, intelligently chaining from the previous segment
   */
  public addSegment(journey: JapanRailJourney, userRole?: UserRole): JapanRailJourney {
    const lastSeg = journey.segments[journey.segments.length - 1];

    // Chaining logic: new origin is previous destination
    const newOriginStationId = lastSeg ? lastSeg.destination.stationId : 'JP-ST-TOKYO';
    
    // Choose intelligent next destination (e.g. if origin is Kyoto, default to Osaka or Hiroshima)
    let nextDestStationId = 'JP-ST-OSAKA';
    if (newOriginStationId === 'JP-ST-KYOTO') nextDestStationId = 'JP-ST-OSAKA';
    else if (newOriginStationId === 'JP-ST-OSAKA') nextDestStationId = 'JP-ST-HIROSHIMA';
    else if (newOriginStationId === 'JP-ST-HIROSHIMA') nextDestStationId = 'JP-ST-HAKATA';
    else if (newOriginStationId === 'JP-ST-TOKYO') nextDestStationId = 'JP-ST-KYOTO';
    else nextDestStationId = 'JP-ST-TOKYO';

    // Date chaining: next day or same day + 3 hours
    let newDate = lastSeg ? lastSeg.travelDate : new Date(Date.now() + 86400000).toISOString().split('T')[0];
    try {
      if (lastSeg?.travelDate) {
        const d = new Date(lastSeg.travelDate);
        d.setDate(d.getDate() + 1);
        newDate = d.toISOString().split('T')[0];
      }
    } catch {
      // keep current date
    }

    const originRef = japanRailJourneyDataService.getStationRef(newOriginStationId);
    const destRef = japanRailJourneyDataService.getStationRef(nextDestStationId);
    const carClass = lastSeg ? lastSeg.carClass : 'Ordinary';
    const prodId = carClass === 'Green' ? 'RAIL-JP-GREEN-RESERVED' : 'RAIL-JP-ORD-RESERVED';

    const newSegment: JapanRailSegment = {
      segmentId: `seg-${Date.now()}-${journey.segments.length + 1}`,
      sequence: journey.segments.length + 1,
      origin: originRef,
      destination: destRef,
      travelDate: newDate,
      departureTime: '10:00',
      productId: prodId,
      productName: prodId === 'RAIL-JP-GREEN-RESERVED' ? 'Green Car (First Class / Reserved Seat)' : 'Ordinary Car (Reserved Seat)',
      carClass,
      seatType: 'Reserved',
      serviceGroup: lastSeg ? lastSeg.serviceGroup : 'NOZOMI_MIZUHO',
      seatPreference: 'PAIR',
      passengerAllocation: { ...journey.passengers },
      estimatedDurationMinutes: 60,
      formattedDuration: '1h 00m',
      pricing: {} as any,
      validationErrors: [],
      validationWarnings: [],
      isValid: true
    };

    newSegment.pricing = japanRailJourneyPricingService.priceSegment(newSegment, userRole, journey.currency);

    const updatedSegments = [...journey.segments, newSegment];
    return this.validateAndRecalculate({
      ...journey,
      segments: updatedSegments
    }, userRole);
  }

  /**
   * Removes a segment
   */
  public removeSegment(journey: JapanRailJourney, segmentId: string, userRole?: UserRole): JapanRailJourney {
    if (journey.segments.length <= 1) {
      return journey; // Minimum 1 segment required
    }

    const filtered = journey.segments.filter(s => s.segmentId !== segmentId);
    // Re-index sequence numbers
    const reindexed = filtered.map((s, idx) => ({ ...s, sequence: idx + 1 }));

    return this.validateAndRecalculate({
      ...journey,
      segments: reindexed
    }, userRole);
  }

  /**
   * Reorders segments (move up/down)
   */
  public reorderSegments(journey: JapanRailJourney, fromIndex: number, toIndex: number, userRole?: UserRole): JapanRailJourney {
    if (fromIndex < 0 || fromIndex >= journey.segments.length || toIndex < 0 || toIndex >= journey.segments.length) {
      return journey;
    }

    const newSegments = [...journey.segments];
    const [moved] = newSegments.splice(fromIndex, 1);
    newSegments.splice(toIndex, 0, moved);

    const reindexed = newSegments.map((s, idx) => ({ ...s, sequence: idx + 1 }));

    return this.validateAndRecalculate({
      ...journey,
      segments: reindexed
    }, userRole);
  }

  /**
   * Swaps origin and destination of a specific segment
   */
  public swapSegmentStations(journey: JapanRailJourney, segmentId: string, userRole?: UserRole): JapanRailJourney {
    const updated = journey.segments.map(seg => {
      if (seg.segmentId === segmentId) {
        return {
          ...seg,
          origin: seg.destination,
          destination: seg.origin
        };
      }
      return seg;
    });

    return this.validateAndRecalculate({ ...journey, segments: updated }, userRole);
  }

  /**
   * Updates fields of a specific segment
   */
  public updateSegment(
    journey: JapanRailJourney, 
    segmentId: string, 
    updates: Partial<JapanRailSegment>, 
    userRole?: UserRole
  ): JapanRailJourney {
    const updated = journey.segments.map(seg => {
      if (seg.segmentId === segmentId) {
        let newCarClass = updates.carClass || seg.carClass;
        let newProductId = updates.productId || seg.productId;

        if (updates.carClass && updates.carClass !== seg.carClass) {
          newProductId = updates.carClass === 'Green' ? 'RAIL-JP-GREEN-RESERVED' : 'RAIL-JP-ORD-RESERVED';
        } else if (updates.productId && updates.productId !== seg.productId) {
          newCarClass = updates.productId === 'RAIL-JP-GREEN-RESERVED' ? 'Green' : 'Ordinary';
        }

        const merged: JapanRailSegment = {
          ...seg,
          ...updates,
          carClass: newCarClass,
          productId: newProductId,
          productName: newProductId === 'RAIL-JP-GREEN-RESERVED' ? 'Green Car (First Class / Reserved Seat)' : 'Ordinary Car (Reserved Seat)'
        };

        // If origin station changed, resolve new origin ref
        if (updates.origin?.stationId && updates.origin.stationId !== seg.origin.stationId) {
          merged.origin = japanRailJourneyDataService.getStationRef(updates.origin.stationId);
        }
        // If destination station changed, resolve new destination ref
        if (updates.destination?.stationId && updates.destination.stationId !== seg.destination.stationId) {
          merged.destination = japanRailJourneyDataService.getStationRef(updates.destination.stationId);
        }

        return merged;
      }
      return seg;
    });

    return this.validateAndRecalculate({ ...journey, segments: updated }, userRole);
  }

  /**
   * Updates global passenger configuration and cascades to all segments
   */
  public updatePassengers(
    journey: JapanRailJourney, 
    passengers: JapanRailJourneyPassengerConfig, 
    userRole?: UserRole
  ): JapanRailJourney {
    const updatedSegments = journey.segments.map(seg => ({
      ...seg,
      passengerAllocation: { ...passengers }
    }));

    return this.validateAndRecalculate({
      ...journey,
      passengers,
      segments: updatedSegments
    }, userRole);
  }

  /**
   * Updates currency
   */
  public setCurrency(journey: JapanRailJourney, currency: CurrencyCode, userRole?: UserRole): JapanRailJourney {
    return this.validateAndRecalculate({
      ...journey,
      currency
    }, userRole);
  }

  /**
   * Applies popular preset routes for quick journey creation
   */
  public applyPresetRoute(
    journey: JapanRailJourney, 
    preset: 'GOLDEN_ROUTE' | 'CLASSIC_KANSAI' | 'HIROSHIMA_EXTENSION' | 'ONE_WAY', 
    userRole?: UserRole
  ): JapanRailJourney {
    const baseDate = journey.startDate || new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const addDays = (days: number) => {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + days);
      return d.toISOString().split('T')[0];
    };

    let stationPairs: [string, string, number][] = [];

    switch (preset) {
      case 'GOLDEN_ROUTE':
        // Tokyo -> Kyoto -> Osaka -> Tokyo
        stationPairs = [
          ['JP-ST-TOKYO', 'JP-ST-KYOTO', 0],
          ['JP-ST-KYOTO', 'JP-ST-SHIN-OSAKA', 3],
          ['JP-ST-SHIN-OSAKA', 'JP-ST-TOKYO', 5]
        ];
        break;
      case 'HIROSHIMA_EXTENSION':
        // Tokyo -> Kyoto -> Hiroshima -> Osaka -> Tokyo
        stationPairs = [
          ['JP-ST-TOKYO', 'JP-ST-KYOTO', 0],
          ['JP-ST-KYOTO', 'JP-ST-HIROSHIMA', 3],
          ['JP-ST-HIROSHIMA', 'JP-ST-SHIN-OSAKA', 5],
          ['JP-ST-SHIN-OSAKA', 'JP-ST-TOKYO', 7]
        ];
        break;
      case 'CLASSIC_KANSAI':
        // Tokyo -> Kyoto -> Shin-Osaka
        stationPairs = [
          ['JP-ST-TOKYO', 'JP-ST-KYOTO', 0],
          ['JP-ST-KYOTO', 'JP-ST-SHIN-OSAKA', 2]
        ];
        break;
      case 'ONE_WAY':
      default:
        stationPairs = [
          ['JP-ST-TOKYO', 'JP-ST-KYOTO', 0]
        ];
        break;
    }

    const segments: JapanRailSegment[] = stationPairs.map(([orig, dest, dayOffset], idx) => {
      const originRef = japanRailJourneyDataService.getStationRef(orig);
      const destRef = japanRailJourneyDataService.getStationRef(dest);
      const travelDate = addDays(dayOffset);
      const prodId = 'RAIL-JP-ORD-RESERVED';

      const seg: JapanRailSegment = {
        segmentId: `seg-${Date.now()}-${idx + 1}`,
        sequence: idx + 1,
        origin: originRef,
        destination: destRef,
        travelDate,
        departureTime: idx === 0 ? '09:00' : '10:30',
        productId: prodId,
        productName: 'Ordinary Car (Reserved Seat)',
        carClass: 'Ordinary',
        seatType: 'Reserved',
        serviceGroup: 'NOZOMI_MIZUHO',
        seatPreference: 'MT_FUJI',
        passengerAllocation: { ...journey.passengers },
        estimatedDurationMinutes: 120,
        formattedDuration: '2h 00m',
        pricing: {} as any,
        validationErrors: [],
        validationWarnings: [],
        isValid: true
      };

      seg.pricing = japanRailJourneyPricingService.priceSegment(seg, userRole, journey.currency);
      return seg;
    });

    return this.validateAndRecalculate({
      ...journey,
      segments
    }, userRole);
  }

  /**
   * Authoritative validation and price recalculation for the entire journey
   */
  public validateAndRecalculate(journey: JapanRailJourney, userRole?: UserRole): JapanRailJourney {
    // 1. Validate Journey
    const validation = japanRailJourneyValidationService.validateJourney(journey);

    // 2. Recalculate each segment pricing and durations
    const updatedSegments = journey.segments.map(seg => {
      const segPricing = japanRailJourneyPricingService.priceSegment(seg, userRole, journey.currency);
      const segValidation = japanRailJourneyValidationService.validateSegment(seg, journey.passengers, journey.segments);

      return {
        ...seg,
        pricing: segPricing,
        estimatedDurationMinutes: segPricing.estimatedDurationMinutes,
        formattedDuration: segPricing.formattedDuration,
        validationErrors: segValidation.errors,
        validationWarnings: segValidation.warnings,
        isValid: segValidation.isValid
      };
    });

    // 3. Recalculate Aggregate Journey Pricing
    const journeyPricing = japanRailJourneyPricingService.calculateJourneyPricing(
      updatedSegments,
      userRole,
      journey.currency
    );

    // 4. Derive dates and route summary
    const startDate = updatedSegments[0]?.travelDate || journey.startDate;
    const endDate = updatedSegments[updatedSegments.length - 1]?.travelDate || journey.endDate;
    
    const routeNames = [updatedSegments[0]?.origin?.stationName || 'Tokyo'];
    updatedSegments.forEach(s => routeNames.push(s.destination?.stationName || ''));
    const routeSummary = routeNames.filter(Boolean).join(' → ');

    const selectedRailProducts = Array.from(new Set(updatedSegments.map(s => s.productId)));

    return {
      ...journey,
      title: `Japan Rail Journey (${updatedSegments.length} ${updatedSegments.length === 1 ? 'Sector' : 'Sectors'}): ${routeSummary}`,
      startDate,
      endDate,
      segments: updatedSegments,
      selectedRailProducts,
      pricing: journeyPricing,
      validation,
      metadata: {
        ...journey.metadata,
        updatedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Creates an immutable snapshot
   */
  public createSnapshot(journey: JapanRailJourney): JapanRailJourneySnapshot {
    return japanRailJourneyMapper.toSnapshot(journey);
  }

  /**
   * Converts journey to QuoteItem
   */
  public convertToQuoteItem(journey: JapanRailJourney, dayNumber: number = 1): QuoteItem {
    return japanRailJourneyMapper.toQuoteItem(journey, dayNumber);
  }
}

export const japanRailJourneyService = JapanRailJourneyService.getInstance();
