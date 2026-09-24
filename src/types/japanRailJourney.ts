import { CurrencyCode, UserRole, Product, QuoteItem } from '../types';
import { 
  RailStation, 
  RailRoute, 
  RailCarType, 
  RailSeatType, 
  RailServiceGroup, 
  RailSeasonType, 
  RailPricingResult,
  RailBookingItemDetails
} from './rail';

export type JourneyPortalOrigin = 
  | 'BUYER' 
  | 'B2B_QUOTE_BUILDER' 
  | 'B2B_AGENT' 
  | 'PRODUCT_MANAGEMENT' 
  | 'ADMIN_CMS';

export interface JapanRailJourneyPassengerConfig {
  adults: number;
  children: number;
  infants: number;
}

export interface JapanRailStationRef {
  stationId: string;
  stationCode: string;
  stationName: string;
  displayName: string;
  city: string;
  shinkansenLine?: string;
}

export interface JapanRailSegment {
  segmentId: string;
  sequence: number;
  origin: JapanRailStationRef;
  destination: JapanRailStationRef;
  travelDate: string; // YYYY-MM-DD
  departureTime: string; // HH:mm
  arrivalTime?: string;
  productId: 'RAIL-JP-ORD-RESERVED' | 'RAIL-JP-GREEN-RESERVED' | string;
  productName: string;
  carClass: RailCarType;
  seatType: RailSeatType;
  serviceGroup: RailServiceGroup;
  seatPreference: 'WINDOW' | 'AISLE' | 'PAIR' | 'MT_FUJI' | 'OVERSIZED_BAGGAGE' | 'ANY';
  passengerAllocation: JapanRailJourneyPassengerConfig;
  estimatedDurationMinutes: number;
  formattedDuration: string;
  pricing: RailPricingResult;
  validationErrors: string[];
  validationWarnings: string[];
  isValid: boolean;
}

export interface JapanRailJourneyFareBreakdown {
  totalBaseFareJPY: number;
  totalSuperExpressSurchargeJPY: number;
  totalGreenCarSurchargeJPY: number;
  totalSeasonAdjustmentJPY: number;
  totalSupplierCostJPY: number;
  totalTheUnboundMarkupJPY: number;
  grandTotalJPY: number;
}

export interface JapanRailJourneyPricingSummary {
  totalSupplierCostJPY: number;
  totalMarkupJPY: number;
  finalSellingPriceJPY: number;
  targetCurrency: CurrencyCode;
  finalSellingPriceTargetCurrency: number;
  exchangeRate: number;
  appliedMarkupPercent: number;
  perPersonTargetCurrency: number;
  fareBreakdown: JapanRailJourneyFareBreakdown;
  segmentPricingMap: Record<string, RailPricingResult>;
}

export interface JapanRailJourneyValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  segmentErrors: Record<string, string[]>;
  segmentWarnings: Record<string, string[]>;
}

export interface JapanRailJourneyMetadata {
  createdAt: string;
  updatedAt: string;
  portalOrigin: JourneyPortalOrigin;
  createdByRole?: UserRole;
  snapshotTimestamp?: string;
  notes?: string;
  dayNumber?: number;
}

export interface JapanRailJourney {
  journeyId: string;
  title: string;
  destinationId: string; // 'dest-japan'
  destinationName: string; // 'Japan'
  regionId: string; // 'reg-east-asia'
  startDate: string;
  endDate: string;
  passengers: JapanRailJourneyPassengerConfig;
  segments: JapanRailSegment[];
  selectedRailProducts: string[];
  pricing: JapanRailJourneyPricingSummary;
  currency: CurrencyCode;
  validation: JapanRailJourneyValidation;
  metadata: JapanRailJourneyMetadata;
}

export interface JapanRailSegmentSnapshot {
  segmentId: string;
  sequence: number;
  originStationId: string;
  originStationName: string;
  originStationCode: string;
  destinationStationId: string;
  destinationStationName: string;
  destinationStationCode: string;
  travelDate: string;
  departureTime: string;
  productId: string;
  productName: string;
  carClass: RailCarType;
  seatType: RailSeatType;
  serviceGroup: RailServiceGroup;
  seatPreference: string;
  passengerAllocation: JapanRailJourneyPassengerConfig;
  supplierCostJPY: number;
  markupJPY: number;
  sellingPriceJPY: number;
  sellingPriceTargetCurrency: number;
  estimatedDurationMinutes: number;
  seasonType: RailSeasonType;
  seasonId?: string;
  seasonName?: string;
  baseFareJPY?: number;
  superExpressSurchargeJPY?: number;
  greenCarSurchargeJPY?: number;
  appliedSeasonAdjustmentJPY?: number;
  pricingRuleSnapshot?: {
    pricingVersion: string;
    seasonId?: string;
    seasonName?: string;
    seasonType: RailSeasonType;
    baseFareJPY: number;
    superExpressJPY: number;
    greenSurchargeJPY: number;
    seasonAdjustmentJPY: number;
    supplierCostJPY: number;
    markupPercent: number;
    markupJPY: number;
    finalSellingPriceJPY: number;
    currency: CurrencyCode;
    timestamp: string;
  };
}

export interface JapanRailJourneySnapshot {
  journeyId: string;
  title: string;
  destinationId: string;
  currency: CurrencyCode;
  exchangeRate: number;
  startDate: string;
  endDate: string;
  passengers: JapanRailJourneyPassengerConfig;
  segments: JapanRailSegmentSnapshot[];
  totalSupplierCostJPY: number;
  totalMarkupJPY: number;
  finalSellingPriceJPY: number;
  finalSellingPriceTargetCurrency: number;
  appliedMarkupPercent: number;
  configuredAt: string;
  portalOrigin: JourneyPortalOrigin;
  version: '2.0-DYNAMIC-MULTI-SEGMENT';
}

export interface JapanRailProductJourneyRule {
  allowedRouteIds?: string[];
  minSegments?: number;
  maxSegments?: number;
  eligibleClasses: RailCarType[];
  allowOversizedBaggage: boolean;
  minAdvanceBookingDays: number;
  maxAdvanceBookingDays: number;
  allowedServiceGroups: RailServiceGroup[];
  requiresPassportCheck: boolean;
}

export interface ShinkansenJourneyPayloadSegment {
  segmentId: string;
  sequence: number;
  origin: {
    id: string;
    name: string;
    code: string;
    city: string;
  };
  destination: {
    id: string;
    name: string;
    code: string;
    city: string;
  };
  travelDate: string;
  departureTime: string;
  railProductId: string;
  productName: string;
  class: RailCarType;
  seatType: RailSeatType;
  serviceGroup: RailServiceGroup;
  seatPreference: string;
  passengers: JapanRailJourneyPassengerConfig;
  selectedOptions: string[];
  price: {
    supplierCostJPY: number;
    markupJPY: number;
    sellingPriceJPY: number;
    sellingPriceTargetCurrency: number;
    currency: CurrencyCode;
  };
}

export interface ShinkansenJourneyPayload {
  journeyType: 'SHINKANSEN';
  configurator: 'SHINKANSEN_DYNAMIC_JOURNEY';
  journeyId: string;
  title: string;
  destinationId: string;
  segments: ShinkansenJourneyPayloadSegment[];
  passengers: JapanRailJourneyPassengerConfig;
  pricing: JapanRailJourneyPricingSummary;
  currency: CurrencyCode;
  configurationVersion: '2.0-SHINKANSEN-DYNAMIC';
  configuredAt: string;
  portalOrigin: JourneyPortalOrigin;
}

export { isRailProduct, isRailQuoteItem } from '../services/rail/JapanRailJourneyDataService';
