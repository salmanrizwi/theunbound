import { CurrencyCode, UserRole, Product } from '../types';

export type RailCarType = 'Ordinary' | 'Green';
export type RailSeatType = 'Reserved';
export type RailServiceGroup = 'NOZOMI_MIZUHO' | 'HIKARI_KODAMA_SAKURA_TSUBAME';
export type RailPassengerType = 'ADULT' | 'CHILD';
export type RailSeasonType = 'REGULAR' | 'LOW' | 'HIGH' | 'PEAK_HIGH' | 'HOLIDAY' | 'SPECIAL';

export interface RailStation {
  stationId: string; // e.g. "JP-ST-TOKYO"
  stationCode: string; // e.g. "TYO"
  stationName: string; // e.g. "Tokyo"
  displayName: string; // e.g. "Tokyo (東京)"
  searchAliases: string[];
  country: string; // "Japan"
  regionId: string; // "reg-east-asia"
  destinationId: string; // "dest-japan"
  hubId?: string; // "hub-tokyo"
  city: string; // "Tokyo"
  railOperator: string; // "JR Central / JR West / JR Kyushu"
  latitude: number;
  longitude: number;
  timezone: string; // "Asia/Tokyo"
  active: boolean;
  order?: number;
  shinkansenLine?: string; // "Tokaido / Sanyo / Kyushu"
  isMajorHub?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface RailRoute {
  routeId: string; // e.g. "JP-RT-TOKYO-KYOTO"
  originStationId: string;
  destinationStationId: string;
  originStationName: string;
  destinationStationName: string;
  country: string; // "Japan"
  destinationId: string; // "dest-japan"
  railOperator: string; // "JR Central / JR West / smartEX"
  active: boolean;
  availableProductIds: string[]; // ["RAIL-JP-ORD-RESERVED", "RAIL-JP-GREEN-RESERVED"]
  availableServiceGroups: RailServiceGroup[];
  distanceKm?: number;
  travelDurationMinutes?: {
    nozomiMizuho?: number;
    hikariKodamaSakura?: number;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface RailRate {
  rateId: string; // e.g. "JP-RR-TOKYO-KYOTO-ORD-NOZOMI-ADULT"
  routeId: string;
  originStationId: string;
  destinationStationId: string;
  productId: 'RAIL-JP-ORD-RESERVED' | 'RAIL-JP-GREEN-RESERVED';
  carType: RailCarType;
  seatType: RailSeatType;
  serviceGroup: RailServiceGroup;
  passengerType: RailPassengerType;
  currency: 'JPY';
  baseFareJPY: number;
  superExpressSurchargeJPY: number;
  greenCarSurchargeJPY: number;
  regularTotalFareJPY: number; // Listed regular season fare from smartEX authoritative tariff
  supplierId: string;
  supplierName: string;
  effectiveDate: string; // ISO date string YYYY-MM-DD
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface RailSeasonAdjustment {
  seasonType: RailSeasonType;
  label: string;
  adultAdjustmentJPY: number; // Regular: 0, Low: -200, High: +200, Peak High: +400, Holiday: +400, Special: +200
  childAdjustmentJPY: number; // Half: 0, -100, +100, +200
  description: string;
}

export interface RailSeasonCalendarPeriod {
  id: string;
  seasonType: RailSeasonType;
  title: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  daysOfWeek?: number[]; // 0=Sun, 1=Mon, ..., 6=Sat (optional day filtering)
  adultAdjustmentJPY?: number;
  childAdjustmentJPY?: number;
  pricingMultiplier?: number;
  active?: boolean;
  priority?: number; // Higher number = takes precedence during overlapping dates
  displayOrder?: number;
  notes?: string;
  applicableYear?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface RailMarkupRule {
  id: string;
  country: string; // "Japan"
  destinationId: string; // "dest-japan"
  railOperator: string;
  b2bAgentMarkupPercent: number; // default 12%
  buyerMarkupPercent: number; // default 18%
  minMarginJPY: number; // default 500
  conciergeServiceFeeJPY: number; // default 0
  oversizedBaggageFeeJPY: number; // default 0 (free with reservation in smartEX)
  taxPercent: number; // default 10%
  lastUpdated: string;
  updatedBy?: string;
}

export interface RailPricingParams {
  originStationId: string;
  destinationStationId: string;
  productId: 'RAIL-JP-ORD-RESERVED' | 'RAIL-JP-GREEN-RESERVED';
  serviceGroup: RailServiceGroup;
  travelDate: string; // YYYY-MM-DD
  departureTime?: string; // HH:mm
  adultsCount: number;
  childrenCount: number;
  seatPreference?: 'WINDOW' | 'AISLE' | 'PAIR' | 'MT_FUJI' | 'OVERSIZED_BAGGAGE' | 'ANY';
  userRole?: UserRole;
  targetCurrency?: CurrencyCode;
}

export interface RailPricingResult {
  route: RailRoute;
  originStation: RailStation;
  destinationStation: RailStation;
  product: Product;
  carType: RailCarType;
  seatType: RailSeatType;
  serviceGroup: RailServiceGroup;
  travelDate: string;
  departureTime?: string;
  seasonType: RailSeasonType;
  seasonLabel: string;
  seasonId?: string;
  seasonName?: string;
  pricingVersion?: string;
  calculationTimestamp?: string;
  adultPerPaxSupplierJPY: number;
  childPerPaxSupplierJPY: number;
  adultSeasonAdjustmentJPY: number;
  childSeasonAdjustmentJPY: number;
  totalSupplierCostJPY: number;
  appliedMarkupPercent: number;
  totalMarkupJPY: number;
  finalSellingPriceJPY: number;
  targetCurrency: CurrencyCode;
  finalSellingPriceTargetCurrency: number;
  exchangeRate: number;
  fareBreakdown: {
    baseFareJPY: number;
    superExpressSurchargeJPY: number;
    greenCarSurchargeJPY: number;
    seasonAdjustmentTotalJPY: number;
    supplierNetTotalJPY: number;
    theUnboundMarkupJPY: number;
    grandTotalJPY: number;
  };
  passengers: {
    adults: number;
    children: number;
    total: number;
  };
  seatPreference?: string;
  estimatedDurationMinutes: number;
  formattedDuration: string;
}

export interface RailBookingItemDetails {
  type: 'JAPAN_RAIL';
  productId: string;
  productName: string;
  carType: RailCarType;
  seatType: RailSeatType;
  serviceGroup: RailServiceGroup;
  originStationId: string;
  originStationName: string;
  originStationCode: string;
  destinationStationId: string;
  destinationStationName: string;
  destinationStationCode: string;
  travelDate: string;
  departureTime?: string;
  arrivalTime?: string;
  trainName?: string;
  carNumber?: string;
  seatNumbers?: string[];
  seatPreference?: string;
  hasOversizedBaggage?: boolean;
  adultsCount: number;
  childrenCount: number;
  seasonType: RailSeasonType;
  pricingResult: RailPricingResult;
  pnrReference?: string;
  qrVoucherCode?: string;
  passengerNames?: { name: string; type: RailPassengerType; passportNumber?: string }[];
}
