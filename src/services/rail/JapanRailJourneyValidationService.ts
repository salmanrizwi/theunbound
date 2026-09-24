import { 
  JapanRailJourney, 
  JapanRailSegment, 
  JapanRailJourneyValidation,
  JapanRailJourneyPassengerConfig 
} from '../../types/japanRailJourney';
import { japanRailJourneyDataService } from './JapanRailJourneyDataService';

export class JapanRailJourneyValidationService {
  private static instance: JapanRailJourneyValidationService;

  private constructor() {}

  public static getInstance(): JapanRailJourneyValidationService {
    if (!JapanRailJourneyValidationService.instance) {
      JapanRailJourneyValidationService.instance = new JapanRailJourneyValidationService();
    }
    return JapanRailJourneyValidationService.instance;
  }

  /**
   * Validates a single segment of a Japan Rail journey
   */
  public validateSegment(
    segment: JapanRailSegment, 
    journeyPassengers: JapanRailJourneyPassengerConfig,
    allSegments?: JapanRailSegment[]
  ): { errors: string[]; warnings: string[]; isValid: boolean } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Origin and Destination existence check
    const originStation = japanRailJourneyDataService.getStation(segment.origin.stationId);
    const destStation = japanRailJourneyDataService.getStation(segment.destination.stationId);

    if (!originStation) {
      errors.push(`Invalid origin station ID: "${segment.origin.stationId}". Station is not in the authoritative JR network.`);
    }

    if (!destStation) {
      errors.push(`Invalid destination station ID: "${segment.destination.stationId}". Station is not in the authoritative JR network.`);
    }

    // 2. Origin cannot equal Destination
    if (segment.origin.stationId === segment.destination.stationId) {
      errors.push(`Origin and destination cannot be identical (${segment.origin.stationName}). Please select a different arrival destination.`);
    }

    // 3. Travel Date Validation
    if (!segment.travelDate) {
      errors.push('Travel date is mandatory for dynamic seat reservation and seasonal pricing.');
    } else {
      const parsedDate = new Date(segment.travelDate);
      if (isNaN(parsedDate.getTime())) {
        errors.push(`Invalid travel date format: "${segment.travelDate}". Required: YYYY-MM-DD.`);
      }
    }

    // 4. Departure Time validation
    if (!segment.departureTime || !segment.departureTime.match(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)) {
      warnings.push(`Standard Shinkansen schedule assumes default morning departure (09:00). Current: "${segment.departureTime || 'unset'}".`);
    }

    // 5. Passenger eligibility
    const segPax = segment.passengerAllocation || journeyPassengers;
    const totalPax = (segPax.adults || 0) + (segPax.children || 0);
    if (totalPax <= 0) {
      errors.push('At least one Adult or Child passenger is required for train car seat reservation.');
    }

    if (segPax.infants > 0 && segPax.adults === 0) {
      errors.push('Infants (under 6) travel free on JR lines without a separate reserved seat but must be accompanied by an Adult.');
    }

    // 6. Oversized baggage check
    if (segment.seatPreference === 'OVERSIZED_BAGGAGE') {
      // Tokaido/Sanyo/Kyushu rules: dimensions > 160cm to 250cm require seat reservation with oversized baggage area
      const isTokaidoSanyoKyushu = 
        (originStation?.shinkansenLine?.includes('Tokaido') || originStation?.shinkansenLine?.includes('Sanyo') || originStation?.shinkansenLine?.includes('Kyushu')) &&
        (destStation?.shinkansenLine?.includes('Tokaido') || destStation?.shinkansenLine?.includes('Sanyo') || destStation?.shinkansenLine?.includes('Kyushu'));

      if (!isTokaidoSanyoKyushu) {
        warnings.push('Oversized baggage reservation rules strictly apply to Tokaido, Sanyo, and Kyushu Shinkansen lines. Complimentary standard luggage racks are available on other JR lines.');
      }
    }

    // 7. Route connection check
    if (originStation && destStation && originStation.stationId !== destStation.stationId) {
      const directRoute = japanRailJourneyDataService.getRoute(originStation.stationId, destStation.stationId);
      if (!directRoute) {
        // Shinkansen route network can be traversed with connection
        warnings.push(`Direct high-speed through train may not be scheduled between ${originStation.stationName} and ${destStation.stationName}. Transfer at a major hub (e.g. Shin-Osaka or Tokyo) may be required.`);
      }
    }

    return {
      errors,
      warnings,
      isValid: errors.length === 0
    };
  }

  /**
   * Validates the complete multi-segment journey including chronological sequencing
   */
  public validateJourney(journey: JapanRailJourney): JapanRailJourneyValidation {
    const globalErrors: string[] = [];
    const globalWarnings: string[] = [];
    const segmentErrors: Record<string, string[]> = {};
    const segmentWarnings: Record<string, string[]> = {};

    // 1. Must have at least 1 segment
    if (!journey.segments || journey.segments.length === 0) {
      globalErrors.push('A rail journey must have at least one valid travel segment.');
      return {
        isValid: false,
        errors: globalErrors,
        warnings: globalWarnings,
        segmentErrors,
        segmentWarnings
      };
    }

    // 2. Validate passengers
    const totalPassengers = (journey.passengers.adults || 0) + (journey.passengers.children || 0);
    if (totalPassengers <= 0) {
      globalErrors.push('Journey requires at least 1 Adult or Child passenger.');
    }

    // 3. Validate each segment individually
    journey.segments.forEach((seg, index) => {
      const segVal = this.validateSegment(seg, journey.passengers, journey.segments);
      segmentErrors[seg.segmentId] = segVal.errors;
      segmentWarnings[seg.segmentId] = segVal.warnings;

      if (segVal.errors.length > 0) {
        globalErrors.push(`Sector ${index + 1} (${seg.origin.stationName} → ${seg.destination.stationName}): ${segVal.errors[0]}`);
      }
      if (segVal.warnings.length > 0) {
        globalWarnings.push(`Sector ${index + 1} (${seg.origin.stationName} → ${seg.destination.stationName}): ${segVal.warnings[0]}`);
      }
    });

    // 4. Validate Chronological Sequencing across segments
    for (let i = 0; i < journey.segments.length - 1; i++) {
      const curr = journey.segments[i];
      const next = journey.segments[i + 1];

      if (curr.travelDate && next.travelDate) {
        const currDate = new Date(curr.travelDate).getTime();
        const nextDate = new Date(next.travelDate).getTime();

        if (nextDate < currDate) {
          const errMsg = `Sequence Conflict: Sector ${i + 2} date (${next.travelDate}) is earlier than Sector ${i + 1} date (${curr.travelDate}). Rail segments must follow chronological order.`;
          globalErrors.push(errMsg);
          if (!segmentErrors[next.segmentId]) segmentErrors[next.segmentId] = [];
          segmentErrors[next.segmentId].push(errMsg);
        }
      }

      // Check station continuity (notice if user transfers or leaves gap)
      if (curr.destination.stationId !== next.origin.stationId) {
        const gapWarn = `Sector transfer note: Sector ${i + 1} arrives at ${curr.destination.stationName}, but Sector ${i + 2} departs from ${next.origin.stationName}. Ensure local ground transit is arranged between these stations.`;
        globalWarnings.push(gapWarn);
        if (!segmentWarnings[next.segmentId]) segmentWarnings[next.segmentId] = [];
        segmentWarnings[next.segmentId].push(gapWarn);
      }
    }

    const isValid = globalErrors.length === 0 && Object.values(segmentErrors).every(errs => errs.length === 0);

    return {
      isValid,
      errors: Array.from(new Set(globalErrors)),
      warnings: Array.from(new Set(globalWarnings)),
      segmentErrors,
      segmentWarnings
    };
  }
}

export const japanRailJourneyValidationService = JapanRailJourneyValidationService.getInstance();
