import { Booking, BookingItem, CalendarTask, CurrencyCode, BookingStatus } from '../../../types';

export type OperationalCategory = 
  | 'HOTEL' 
  | 'TRANSFER' 
  | 'ACTIVITY' 
  | 'TOUR' 
  | 'GUIDE' 
  | 'VISA' 
  | 'TASK' 
  | 'OTHER';

export type OperationalSpecificType = 
  | 'HOTEL_CHECK_IN'
  | 'HOTEL_CHECK_OUT'
  | 'HOTEL_STAY'
  | 'AIRPORT_TRANSFER'
  | 'INTERCITY_TRANSFER'
  | 'LOCAL_TRANSFER'
  | 'SIGHTSEEING_TOUR'
  | 'PRIVATE_TOUR'
  | 'DAILY_TOUR'
  | 'ACTIVITY'
  | 'GUIDE_SERVICE'
  | 'VISA_TASK'
  | 'OPERATIONAL_TASK'
  | 'OTHER';

export interface HorizonConflict {
  id: string;
  type: 'OVERLAPPING_TIME' | 'CAPACITY_EXCEEDED' | 'SEQUENCING_ANOMALY' | 'TIMING_IMPOSSIBILITY';
  title: string;
  message: string;
  severity: 'warning' | 'critical';
  conflictingItemRef?: string;
  conflictingItemTitle?: string;
}

export interface HorizonAttentionFlag {
  id: string;
  type: 
    | 'MISSING_SUPPLIER'
    | 'AWAITING_CONFIRMATION'
    | 'MISSING_VOUCHER'
    | 'OUTDATED_VOUCHER'
    | 'MISSING_REPORTING_TIME'
    | 'MISSING_PICKUP_LOCATION'
    | 'MISSING_DROPOFF_LOCATION'
    | 'MISSING_DRIVER'
    | 'MISSING_GUIDE'
    | 'UNASSIGNED_OWNER'
    | 'PRICE_PENDING'
    | 'RECONFIRMATION_REQUIRED';
  label: string;
  description: string;
  severity: 'warning' | 'critical' | 'info';
}

export interface OperationalItem {
  id: string;
  serviceItemId?: string;
  bookingId: string;
  bookingReference: string;
  bookingStatus: BookingStatus;
  customerName: string;
  leadPassengerName: string;
  b2bAgentName?: string;
  agencyName?: string;
  category: OperationalCategory;
  operationalType: OperationalSpecificType;
  operationalTypeLabel: string;
  title: string;
  serviceDate: string; // YYYY-MM-DD
  endDate?: string;
  reportingTime?: string; // HH:mm
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  destination: string;
  hub: string;
  adults: number;
  children: number;
  infants: number;
  totalPax: number;
  supplierId?: string;
  supplierName?: string;
  supplierContact?: string;
  supplierPhone?: string;
  supplierEmail?: string;
  supplierConfirmationRef?: string;
  supplierConfirmationStatus?: string;
  operationalStatus: string;
  voucherStatus?: string;
  voucherCode?: string;
  pickupLocation?: string;
  dropoffLocation?: string;
  driverName?: string;
  driverPhone?: string;
  vehicleType?: string;
  vehicleCapacity?: number;
  licensePlate?: string;
  guideName?: string;
  guidePhone?: string;
  tourLanguage?: string;
  hotelRoomType?: string;
  hotelMealPlan?: string;
  hotelConfirmationNumber?: string;
  hotelCheckInDate?: string;
  hotelCheckOutDate?: string;
  visaAppointmentDate?: string;
  visaTrackingNumber?: string;
  visaApprovalStatus?: string;
  assignedTeamMember?: string;
  assignedTeamMemberId?: string;
  operationalInstructions?: string;
  customerFacingNotes?: string;
  internalOpsNotes?: string;
  supplierPrice?: number;
  supplierCurrency?: CurrencyCode;
  rawItem?: BookingItem;
  rawBooking: Booking;
  rawTask?: CalendarTask;
  conflicts: HorizonConflict[];
  attentionFlags: HorizonAttentionFlag[];
}

export type HorizonViewMode = 
  | 'TIMELINE' 
  | 'CATEGORY' 
  | 'DESTINATION' 
  | 'SUPPLIER' 
  | 'STATUS' 
  | 'LIST';

export interface OperationalHorizonFilters {
  date: string; // YYYY-MM-DD
  isRangeMode: boolean;
  endDate?: string; // YYYY-MM-DD
  category: string;
  destination: string;
  hub: string;
  supplierId: string;
  operationalStatus: string;
  voucherStatus: string;
  quickFilter: 
    | 'ALL' 
    | 'NEEDS_ATTENTION'
    | 'MISSING_SUPPLIER' 
    | 'AWAITING_CONFIRMATION' 
    | 'MISSING_VOUCHER' 
    | 'MISSING_REPORTING_TIME' 
    | 'READY_DISPATCH' 
    | 'IN_PROGRESS' 
    | 'COMPLETED'
    | 'HAS_CONFLICTS';
  searchQuery: string;
}

export interface HorizonDailyMetrics {
  totalScheduled: number;
  hotelCheckIns: number;
  hotelCheckOuts: number;
  hotelStays: number;
  transfers: number;
  activitiesAndTours: number;
  visasAndTasks: number;
  confirmedServices: number;
  pendingConfirmations: number;
  missingSuppliers: number;
  missingVouchers: number;
  readyForDispatch: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  itemsRequiringAttention: number;
  conflictsCount: number;
}
