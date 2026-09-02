export type UserCategory = 'EXTERNAL' | 'INTERNAL';

export type UserRole = 
  | 'BUYER'         // External: Buyer / Direct Client
  | 'B2B_AGENT'     // External: B2B Travel Agent / Tour Operator
  | 'AGENT'         // Alias for B2B_AGENT
  | 'ADMIN'         // Internal: DMC Administrator
  | 'TEAM_MEMBER'   // Internal: Operations & Reservations Team Member
  | 'DMC_STAFF'     // Alias for TEAM_MEMBER
  | 'VIEWER' 
  | 'PUBLIC';

export type DestinationRegion = 'EUROPE' | 'UNITED_KINGDOM' | 'JAPAN' | 'SOUTHEAST_ASIA' | 'MIDDLE_EAST' | 'USA' | 'AUSTRALIA';

export type ProductCategory = 
  | 'Private Tours' 
  | 'Day Trips' 
  | 'Activities' 
  | 'Transfers' 
  | 'Transport' 
  | 'Private Yacht' 
  | 'Tours' 
  | 'Rail' 
  | 'Ferries' 
  | 'Guides' 
  | 'Travel Services';

export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'AED' | 'THB' | 'AUD' | 'CAD' | 'SGD' | 'INR' | 'CHF';

export interface CurrencyOption {
  code: CurrencyCode;
  name: string;
  symbol: string;
}

export const SUPPORTED_CURRENCIES: CurrencyOption[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'AED' },
  { code: 'THB', name: 'Thai Baht', symbol: '฿' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' }
];

export type QuotationScope = 'HOTEL_LAND' | 'LAND_ONLY' | 'HOTEL_ONLY';

export type UserApprovalStatus = 'APPROVED' | 'PENDING' | 'REJECTED';

export interface CMSOperationsPermissions {
  enabled: boolean;
  productManagement?: boolean;
  hotelManagement?: boolean;
  packageManagement?: boolean;
  bookingManagement?: boolean;
  leadManagement?: boolean;
  activityManagement?: boolean;
  tourManagement?: boolean;
  transferManagement?: boolean;
  railManagement?: boolean;
  guideManagement?: boolean;
  rosterAndRoles?: boolean;
}

export interface CMSContentPermissions {
  enabled: boolean;
  destinationManagement?: boolean;
  pageManagement?: boolean;
  marketingManagement?: boolean;
  destinationPages?: boolean;
  hubsCities?: boolean;
  faqs?: boolean;
  homepageContent?: boolean;
  menuManagement?: boolean;
  footerManagement?: boolean;
  legalPages?: boolean;
  aboutUs?: boolean;
  contactUs?: boolean;
  blogEditorial?: boolean;
  seoContent?: boolean;
  customerGallery?: boolean;
  googleReviews?: boolean;
}

export interface CMSFinancePermissions {
  enabled: boolean;
  accountManagement?: boolean;
  userPermissionManagement?: boolean;
  financials?: boolean;
  invoicing?: boolean;
  payments?: boolean;
  paymentProof?: boolean;
  ledger?: boolean;
  generateInvoice?: boolean;
  generateProforma?: boolean;
  generateVoucher?: boolean;
  pricingManagement?: boolean;
  marginManagement?: boolean;
  commercialConfiguration?: boolean;
  userAccounts?: boolean;
  agencyAccounts?: boolean;
  customerAccounts?: boolean;
}

export interface CMSSystemPermissions {
  enabled: boolean;
  calendarSlas?: boolean;
  integrationsHub?: boolean;
  auditLogs?: boolean;
  googleSheetsSync?: boolean;
  firebaseSync?: boolean;
  gmailIntegration?: boolean;
  googleCalendar?: boolean;
  dataSyncAudit?: boolean;
  systemHealth?: boolean;
  apiConfiguration?: boolean;
  databaseDiagnostics?: boolean;
  importLogs?: boolean;
  syncLogs?: boolean;
  securityLogs?: boolean;
}

export interface UserPermissionAccess {
  // Quote Builder Access
  b2bQuoteBuilderAccess?: boolean;
  buyerQuoteBuilderAccess?: boolean;
  canAccessPricingCalculator?: boolean; // backwards-compatible alias
  canCreateBookings?: boolean;
  canExportPDF?: boolean;
  canViewWholesaleNetRates?: boolean;
  canAddManualHotelRates?: boolean;
  canManagePackages?: boolean;

  // CMS Access & Hierarchical Modules
  canAccessCMS?: boolean;
  cmsOperations?: CMSOperationsPermissions;
  cmsContent?: CMSContentPermissions;
  cmsFinance?: CMSFinancePermissions;
  cmsSystem?: CMSSystemPermissions;

  // Flattened convenience & backward-compatibility flags
  canAccessRoster?: boolean;
  canAccessFinancials?: boolean;
  canManageUsers?: boolean;
  canManagePermissions?: boolean;
  canDeleteRecords?: boolean;
  canDeleteProducts?: boolean;
  canDeleteHotels?: boolean;
  canDeletePackages?: boolean;
  canDeleteDestinations?: boolean;
  canDeleteCityHubs?: boolean;
  canDeleteRegions?: boolean;
  canDeleteEditorial?: boolean;
  canDeleteQuotes?: boolean;
}

export type AccommodationType = 'master' | 'manual';

export interface ManualHotelDetails {
  id?: string;
  hotelName: string;
  city: string;
  hubId?: string;
  hubName?: string;
  starRating?: string; // e.g. '5-Star Luxury', '4-Star Superior', '3-Star Standard', 'Ryokan', 'Boutique'
  address?: string;
  roomType: string;
  numberOfRooms: number;
  numberOfNights: number;
  checkInDate: string;
  checkOutDate: string;
  mealPlan: MealPlanCode | string;
  mealPlanName?: string;
  ratePerNight: number;
  rateCurrency: CurrencyCode;
  rateType?: 'PER_ROOM_PER_NIGHT' | 'PER_PERSON_PER_NIGHT' | 'TOTAL_STAY';
  adultRate?: number;
  childRate?: number;
  infantRate?: number;
  extraBedRate?: number;
  internalNotes?: string;
  supplierContact?: string;
  calculatedPrice?: number;
}

export interface User {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  password?: string;
  role: UserRole;
  category?: UserCategory;
  agencyName?: string;
  companyName?: string;
  businessType?: string;
  jobTitle?: string;
  country?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  address?: string;
  companyAddress?: string;
  companyCity?: string;
  companyState?: string;
  companyPostalCode?: string;
  companyCountry?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyWebsite?: string;
  taxOrGstNumber?: string;
  iataOrAbtaNumber?: string;
  avatarUrl?: string;
  brandLogoUrl?: string;
  logoUrl?: string;
  primaryCurrency?: CurrencyCode;
  bio?: string;
  emergencyContactPerson?: string;
  emergencyContactPhone?: string;
  phone?: string;
  createdAt: string;
  approvalStatus?: UserApprovalStatus;
  permissions?: UserPermissionAccess;
  customBuyerMarginPercent?: number;
  customAgentMarginPercent?: number;
  contactNumber?: string;
}

export interface DestinationCity {
  id: string;
  name: string;
  tagline: string;
  image: string;
  productCount: number;
}

// Master Macro Region (Tier 1: REGION)
export interface MasterRegion {
  id: string; // e.g. 'reg-east-asia', 'reg-western-europe'
  name: string; // e.g. 'East Asia', 'Western Europe'
  code: string; // e.g. 'EA', 'WEU', 'SEA', 'ME', 'SCA', 'NA'
  slug: string;
  tagline?: string;
  description?: string;
  heroImage?: string;
  currency?: CurrencyCode;
  displayOrder?: number;
  status: 'ACTIVE' | 'DRAFT' | 'INACTIVE';
  isPublished?: boolean;
  featured?: boolean;
  destinationsCount?: number;
  hubsCount?: number;
  productsCount?: number;
  hotelsCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export type Region = MasterRegion;

export interface DestinationRegionItem {
  id: string;
  destinationId: string;
  destinationName: string;
  name: string; // e.g. 'Kanto', 'Kansai', 'Hokkaido', 'Greater London', 'Scotland', 'Tuscany'
  slug: string;
  description?: string;
  displayOrder?: number;
  heroImage?: string;
}

export interface Destination {
  id: string;
  name: string;
  slug: string;
  country: string;
  regionId?: string; // Foreign key linking to MasterRegion (e.g. 'reg-east-asia')
  regionName?: string; // Display name of Master Region (e.g. 'East Asia')
  region?: DestinationRegion | string;
  regions?: DestinationRegionItem[];
  heroImage: string;
  heroImageAlt?: string;
  heroOverlayOpacity?: number; // 0.3 to 0.85
  heroEyebrow?: string; // e.g. "DMC PREMIER PORTFOLIO • JAPAN GROUND OPERATIONS"
  heroTitle?: string; // Custom H1 override, defaults to "Explore {name}"
  tagline: string;
  description: string;
  keySellingPoints: string[];
  bestTimeToVisit: string;
  idealTripDuration: string;
  travelStyle: string;
  currency: CurrencyCode;
  cities: DestinationCity[];
  highlights: string[];
  featuredProductIds: string[];
  status: 'ACTIVE' | 'COMING_SOON';
  primaryCtaText?: string;
  showPrimaryCta?: boolean;
  secondaryCtaText?: string;
  showSecondaryCta?: boolean;
  trustBadgeText?: string;
}

export interface Supplier {
  id: string;
  name: string;
  country: string;
  destination: string;
  contactPerson: string;
  email: string;
  phone: string;
  website: string;
  currency: CurrencyCode;
  contractStatus: 'ACTIVE' | 'PENDING_RENEWAL' | 'UNDER_REVIEW';
  paymentTerms: string;
  cancellationTerms: string;
}

export interface ProductAddon {
  id: string;
  name: string;
  description: string;
  pricePerPax: number;
  currency: CurrencyCode;
  selectedByDefault?: boolean;
}

export interface Product {
  id: string;
  sku: string;
  destinationId: string;
  destinationName: string;
  regionId?: string;
  regionName?: string;
  hubId?: string;
  country: string;
  city: string;
  productType: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  supplierId: string;
  supplierName: string;
  supplierProductCode: string;
  supplierContactDetails?: string;
  supplierLocalCurrency?: string;
  category: ProductCategory;
  subcategory: string;
  duration: string;
  operatingDays: string[];
  operatingHours: string;
  
  // Pricing specs (Net & Base)
  adultNetPrice: number;
  childNetPrice: number;
  infantNetPrice: number;
  adultNettCost?: number; // Alias for adultNetPrice in Base Currency
  childNettCost?: number; // Alias for childNetPrice in Base Currency
  infantNettCost?: number; // Alias for infantNetPrice in Base Currency
  currency: CurrencyCode;
  
  // Commercial parameters
  defaultMarkupPercent: number;
  buyerMarkupPercent?: number; // Default Buyer markup % (e.g. 30%)
  b2bAgentMarkupPercent?: number; // Default B2B Agent markup % (e.g. 20%)
  taxPercent: number;
  commissionPercent: number;
  serviceFeeFixed: number;
  
  // Optional experience upgrades tagged to this product for upselling
  optionalUpgradeProductIds?: string[];
  
  // Calculated base selling price
  sellingPriceStartingFrom: number;
  
  season: 'High' | 'Low' | 'Shoulder' | 'All Year';
  validityFrom: string;
  validityTo: string;
  minPax: number;
  maxPax: number;
  availability: 'INSTANT' | 'ON_REQUEST' | 'LIMITED' | 'SOLD_OUT';
  bookingRequiredDays: number;
  
  cancellationPolicy: string;
  inclusions: string[];
  exclusions: string[];
  importantInformation: string[];
  meetingPoint?: string;
  pickupInformation?: string;
  
  images?: string[];
  heroImage?: string;
  galleryImages?: string[];
  videoUrl?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  reviewCount?: number;
  status?: 'ACTIVE' | 'ARCHIVED' | 'DRAFT';
  lastUpdated?: string;
  addons?: ProductAddon[];
  
  // Advanced Pricing & Operational Enhancements
  pricingMethod?: 'per_person' | 'capacity_based' | 'fixed_stay';
  tieredPricing?: TieredPrice[];
  datePricingOverrides?: Record<string, ProductDatePricingOverride>;
  vehicleConfig?: TransferVehicleConfig;
  isTransfer?: boolean;
  accommodationType?: AccommodationType;
  isManualHotel?: boolean;
  manualHotelDetails?: ManualHotelDetails;
}

export type ProductPricingMethod = 'per_person' | 'capacity_based' | 'fixed_stay';

export interface TieredPrice {
  id: string;
  tierLabel: string; // e.g. '1–2 Pax', '3–5 Pax', '6–10 Pax', '11–20 Pax'
  minPax: number;
  maxPax: number;
  netCostPerPax: number;
  sellingPricePerPax?: number;
}

export interface ProductDatePricingOverride {
  date: string; // YYYY-MM-DD
  dayOfWeek: string; // 'Monday', 'Tuesday', etc.
  netPrice: number;
  sellingPrice?: number;
  isBlackout?: boolean;
  notes?: string;
}

export interface TransferVehicleConfig {
  vehicleName?: string; // e.g. 'Toyota Hiace Grand Cabin' or 'Azimut 66 Flybridge'
  vehicleModel?: string; // e.g. 'Toyota Hiace Grand Cabin (7-Seater)' or 'Azimut 66 Flybridge Luxury Yacht'
  vehicleType: string; // e.g. 'Luxury MPV', 'Minivan', 'Van', 'Minibus', 'Sedan', 'Coach', 'Motor Yacht', 'Catamaran', 'Sailing Yacht', 'Superyacht', 'Speedboat'
  totalSeats: number; // e.g. 7 or 10
  maxSeats: number; // Maximum passenger capacity (e.g. 6, 8, 10, 12, 15, 20, 30, 50 Pax)
  driverSeats?: number; // e.g. 1
  passengerCapacity?: number; // e.g. 7 or 10
  totalTransferCost?: number; // e.g. 500 (Fixed total vehicle / yacht charter nett cost)
  unitVehicleNetCost?: number; // Total vehicle / yacht nett cost (e.g. 500)
  currency?: CurrencyCode;
  route?: string;
  maxLuggage?: number;
  supplierId?: string;
  supplierName?: string;

  // Private Yacht specific properties
  yachtName?: string; // e.g. 'Azimut 66 Flybridge'
  yachtModel?: string; // e.g. 'Azimut 66 Flybridge'
  yachtType?: string; // e.g. 'Motor Yacht', 'Catamaran', 'Sailing Yacht', 'Superyacht', 'Speedboat'
  yachtSize?: string; // e.g. '66 ft / 20.8 m'
  yachtLength?: string; // e.g. '66 ft'
  isYacht?: boolean;
  
  // Occupancy rules (Configurable by Admin)
  adultSeatCount?: number; // default 1 seat
  childSeatCount?: number; // default 1 seat
  infantSeatCount?: number; // default 0 seats (lap child) or 1 seat
  
  // Multi-vehicle / yacht & Capacity allocation rules
  allowMultipleVehicles?: boolean;
  autoAllocateVehicles?: boolean;
  maxVehicles?: number;
  pricingMethod?: 'capacity_based' | 'per_person';
}

export type PricingTier = 'B2C' | 'B2B';

export interface PricingCalculationRequest {
  productId: string;
  adults: number;
  children: number;
  infants: number;
  travelDate: string;
  targetCurrency: CurrencyCode;
  quantity?: number;
  selectedAddonIds?: string[];
  pricingTier?: PricingTier; // B2C (Retail Consumer / Buyer) or B2B (Travel Agent Wholesale)
  userRole?: UserRole;
  user?: User | null;
  customMarkupPercent?: number;
  buyerMarkupPercent?: number;
  b2bAgentMarkupPercent?: number;
  customDiscountPercent?: number;
  agentClientMarkupPercent?: number; // Custom markup the B2B agent applies for their client
}

export interface PricingCalculationResult {
  productId: string;
  productName: string;
  pricingTier: PricingTier;
  pax: {
    adults: number;
    children: number;
    infants: number;
    totalPax: number;
  };
  travelDate: string;
  currency: CurrencyCode;
  
  // Itemized base costs
  adultsSubtotalNet: number;
  childrenSubtotalNet: number;
  infantsSubtotalNet: number;
  addonsSubtotalNet: number;
  totalNetCost: number; // DMC Supplier Cost
  
  // B2B Wholesale Tier specifics
  b2bWholesaleMarkupRate: number; // e.g. 0.10 for 10% wholesale markup
  b2bWholesaleNetToAgent: number; // Contracted net price to the Travel Agent
  agentClientMarkupRate: number; // Markup added by the agent for client
  agentProfitAmount: number; // Profit retained by travel agent
  
  // Markups & Commercials
  markupRate: number;
  markupAmount: number;
  grossBeforeTax: number;
  
  taxRate: number;
  taxAmount: number;
  
  serviceFee: number;
  
  discountRate: number;
  discountAmount: number;
  
  commissionRate: number;
  commissionAmount: number;
  
  // Final Quoted Breakdown (Selling Price)
  adultsSubtotalSelling: number;
  childrenSubtotalSelling: number;
  infantsSubtotalSelling: number;
  addonsSubtotalSelling: number;
  adultPricePerPax: number;
  childPricePerPax: number;
  
  // Final Results
  finalTotalSellingPrice: number;
  sellingPriceFinal: number;
  pricePerPerson: number;
  
  // Transparency badge
  dmcMarginAmount: number;
  dmcMarginPercent: number;

  // Capacity-Based Pricing & Vehicle Allocation Details
  isCapacityBased?: boolean;
  pricingMethod?: 'per_person' | 'capacity_based' | 'fixed_stay';
  vehicleDetails?: {
    vehicleName?: string;
    vehicleModel: string;
    vehicleType: string;
    maxSeats: number;
    occupiedSeats: number;
    vehiclesAllocated: number;
    unitVehicleNetCost: number;
    totalVehicleNetCost: number;
    perPersonNetCost: number;
    capacityExceeded: boolean;
    capacityErrorMessage?: string;
    seatBreakdown?: {
      adultSeats: number;
      childSeats: number;
      infantSeats: number;
      totalSeats: number;
    };
    allowMultipleVehicles?: boolean;
  };
}

export interface QuoteItem {
  id: string;
  product: Product;
  pax: {
    adults: number;
    children: number;
    infants: number;
  };
  travelDate: string;
  serviceTime?: string;
  notes?: string;
  selectedAddonIds: string[];
  calculation: PricingCalculationResult;
  accommodationType?: AccommodationType;
  isManualHotel?: boolean;
  manualHotelDetails?: ManualHotelDetails;
}

export type QuoteStatus = 
  | 'DRAFT' 
  | 'SAVED'
  | 'PROPOSAL_GENERATED'
  | 'SENT'
  | 'SENT_TO_CLIENT' 
  | 'VIEWED'
  | 'VIEWED_BY_CLIENT'
  | 'APPROVED'
  | 'ACCEPTED' 
  | 'DOWNLOADED'
  | 'DOWNLOADED_PDF'
  | 'BOOKING_REQUESTED'
  | 'CONFIRMED' 
  | 'CANCELLED'
  | 'EXPIRED' 
  | 'IN_PROGRESS'
  | 'CONVERTED'
  | 'BOOKING_SUBMITTED' 
  | 'ARCHIVED';

export interface QuoteVersionRecord {
  version: number;
  updatedAt: string;
  updatedBy: string;
  changesSummary: string;
  totalSellingPrice: number;
}

export interface QuoteActivityRecord {
  id: string;
  action: 
    | 'CREATED' 
    | 'EDITED' 
    | 'PRICING_UPDATED'
    | 'SAVED'
    | 'PROPOSAL_GENERATED'
    | 'PRINTED' 
    | 'DOWNLOADED' 
    | 'SENT' 
    | 'SENT_TO_CLIENT'
    | 'VIEWED_BY_CLIENT'
    | 'STATUS_CHANGED' 
    | 'BOOKING_REQUESTED'
    | 'BOOKED'
    | 'VERSION_BRANCHED'
    | 'CONVERTED';
  timestamp: string;
  userName: string;
  userRole?: string;
  userType?: 'ADMIN' | 'TEAM_MEMBER' | 'B2B_AGENT' | 'DMC_STAFF' | 'BUYER' | 'PUBLIC';
  details: string;
}

export interface Quotation {
  id: string;
  quoteNumber: string;
  version?: number;
  parentQuoteId?: string;
  isLocked?: boolean;
  leadId?: string;
  
  // Ownership & Creation Attribution
  createdBy?: string;
  createdByName?: string;
  createdByUserType?: 'ADMIN' | 'TEAM_MEMBER' | 'B2B_AGENT' | 'DMC_STAFF' | 'BUYER' | 'PUBLIC';
  assignedTo?: string;
  assignedToName?: string;
  b2bAgentId?: string;
  
  // Agent Details
  agentId: string;
  agentName: string;
  agentEmail?: string;
  agentAgency?: string;
  agentCompany?: string;
  agentLogoUrl?: string;
  agentPhone?: string;

  // Target Client / User Details
  clientUserId?: string; // Links to registered User account (e.g. usr-buyer-01)
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientCompany?: string;

  // Version History & Activity Log
  versionHistory?: QuoteVersionRecord[];
  activityLog?: QuoteActivityRecord[];

  // Itinerary Details
  title: string;
  destination: string;
  currency: CurrencyCode;
  items: QuoteItem[];
  overallDiscountPercent: number;
  overallMarkupPercent?: number;
  agentNotes: string;
  termsAndConditions: string;
  status: QuoteStatus;
  travelStartDate?: string;
  travelEndDate?: string;
  totalPax?: number;
  adultsCount?: number;
  childrenCount?: number;
  infantsCount?: number;
  childAges?: number[];
  passengerBreakdown?: {
    adults: number;
    cwb: number;
    cnb: number;
    infants: number;
    cwbAges: number[];
    cnbAges: number[];
    infAges: number[];
  };
  roomingConfig?: {
    roomsCount: number;
    adultsPerRoom: number;
    cwbPerRoom: number;
    cnbPerRoom: number;
    infPerRoom: number;
    extraBed: boolean;
  };
  nationality?: string;
  travelStyle?: string;
  mealPlanPreference?: string;
  operationalRemarks?: string[];
  customOperationalRemarks?: string;
  feasibilityScore?: number;
  feasibilityStatus?: 'EXCELLENT' | 'GOOD' | 'NEEDS_ATTENTION' | 'HIGH_RISK';
  feasibilityWarnings?: { type: string; message: string; actionType?: string }[];
  options?: QuotationOption[];
  activeOptionId?: string;
  visaAssistanceChoice?: 'YES' | 'NO' | 'NOT_REQUIRED' | 'LATER';
  scope?: 'HOTEL_LAND' | 'LAND_ONLY' | 'HOTEL_ONLY';
  routeHubs?: TripRouteHub[];
  dayThemes?: Record<number, string>;
  createdAt: string;
  updatedAt: string;
  lastActivityAt?: string;
  validUntil: string;
  
  // Aggregated totals
  totalNetCost: number;
  totalSellingPrice: number;
  totalTaxes: number;
  totalMargin: number;
}

// ----------------------------------------------------
// BOOKINGS & RESERVATIONS SYSTEM
// ----------------------------------------------------
export type BookingStatus = 
  | 'NEW' 
  | 'TO_BE_PROCESSED' 
  | 'PROCESSING' 
  | 'WAITING_FOR_UPDATE' 
  | 'CONFIRMED' 
  | 'COMPLETED' 
  | 'CANCELLED' 
  | 'PENDING_CONFIRMATION' 
  | 'IN_PROGRESS';

export type BookingPaymentStatus = 
  | 'PENDING_PAYMENT' 
  | 'PARTIALLY_PAID' 
  | 'PAID' 
  | 'OVERDUE' 
  | 'REFUND_PENDING' 
  | 'REFUNDED' 
  | 'FAILED';

export type BookingDocumentStatus = 'DOCUMENTS_COMPLETE' | 'DOCUMENTS_PENDING';

export type BookingSupplierStatus = 
  | 'PENDING' 
  | 'REQUESTED' 
  | 'PARTIALLY_CONFIRMED' 
  | 'CONFIRMED' 
  | 'REJECTED' 
  | 'ALTERNATIVE_REQUIRED' 
  | 'CANCELLED';

export type BookingSourceType = 'QUOTATION' | 'PRODUCT_DIRECT' | 'PACKAGE' | 'B2B_PORTAL' | 'MANUAL';

export interface BookingCustomerInfo {
  leadTravelerName: string;
  bookerName?: string;
  email: string;
  phone: string;
  agencyName?: string;
  agentRefNumber?: string;
  specialRequests?: string;
  flightDetails?: string;
  pickupLocation?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  nationality?: string;
  totalAdults?: number;
  totalChildren?: number;
  totalInfants?: number;
}

export interface BookingSupplierAllocation {
  supplierId: string;
  supplierName: string;
  supplierType: 'HOTEL' | 'TRANSPORT' | 'GUIDE' | 'ACTIVITY' | 'DMC_PARTNER' | 'RESTAURANT' | 'TICKET_PARTNER' | 'GROUND_RESOURCE';
  serviceName: string;
  serviceId?: string;
  status: 'PENDING_DISPATCH' | 'SENT_TO_SUPPLIER' | 'WAITING_FOR_SUPPLIER' | 'CONFIRMED_BY_SUPPLIER' | 'REJECTED_BY_SUPPLIER' | 'ALTERNATIVE_REQUIRED' | 'AMENDMENT_REQUESTED' | 'CANCELLED';
  supplierConfirmationRef?: string;
  dispatchedAt?: string;
  confirmedAt?: string;
  assignedContact?: string;
  contactPhone?: string;
  contactEmail?: string;
  paymentCutoffDate?: string;
  serviceDate?: string;
  serviceTime?: string;
  serviceTimezone?: string;
  notes?: string;
  internalOpsNotes?: string;
  costRate?: number;
  costCurrency?: CurrencyCode;
}

export interface BookingItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  destinationName: string;
  city: string;
  category: string;
  travelDate: string;
  adults: number;
  children: number;
  infants: number;
  totalPax: number;
  selectedAddonNames?: string[];
  unitNetPrice?: number;
  unitSellingPrice: number;
  totalPrice: number;
  currency: CurrencyCode;
  supplierId?: string;
  supplierName?: string;
  supplierType?: 'HOTEL' | 'TRANSPORT' | 'GUIDE' | 'ACTIVITY' | 'DMC_PARTNER' | 'RESTAURANT' | 'TICKET_PARTNER' | 'GROUND_RESOURCE';
  supplierContact?: string;
  supplierPhone?: string;
  supplierEmail?: string;
  supplierStatus?: 'PENDING_DISPATCH' | 'SENT_TO_SUPPLIER' | 'WAITING_FOR_SUPPLIER' | 'CONFIRMED_BY_SUPPLIER' | 'REJECTED_BY_SUPPLIER' | 'ALTERNATIVE_REQUIRED' | 'AMENDMENT_REQUESTED' | 'CANCELLED';
  supplierConfirmationRef?: string;
  paymentCutoffDate?: string;
  serviceDate?: string;
  serviceTime?: string;
  serviceTimezone?: string;
  supplierNotes?: string;
  internalOpsNotes?: string;
  accommodationType?: AccommodationType;
  isManualHotel?: boolean;
  manualHotelDetails?: ManualHotelDetails;
}

export interface SentEmailRecord {
  recipient: string;
  recipientType: 'CLIENT_AGENT' | 'DMC_OPS';
  subject: string;
  bodySnippet: string;
  fullHtml: string;
  sentAt: string;
  status: 'DELIVERED' | 'QUEUED';
}

export interface BookingPassenger {
  id: string;
  passengerNumber: number; // 1, 2, 3... up to totalPax
  firstName: string;
  middleName?: string;
  lastName: string;
  fullName?: string;
  dateOfBirth?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  nationality?: string;
  passportNumber?: string;
  passportIssueDate?: string;
  passportExpiryDate?: string;
  passportExpiry?: string; // backwards compatibility
  isLeadPax: boolean;
  phone?: string;
  email?: string;
  passportFrontUrl?: string;
  passportFrontName?: string;
  passportFrontUploadedAt?: string;
  passportBackUrl?: string;
  passportBackName?: string;
  passportBackUploadedAt?: string;
  panCardUrl?: string; // Only for Lead Passenger
  panCardName?: string;
  panCardUploadedAt?: string;
  panNumber?: string;
  mealPreference?: string;
  specialRequests?: string;
}

export interface BookingPaymentProof {
  id: string;
  amount: number;
  currency: CurrencyCode;
  trancheLabel: string; // e.g. "Tranche 1 (Deposit 30%)", "Tranche 2 (Final Balance)"
  paymentDate: string;
  paymentMethod: string; // 'BANK_TRANSFER' | 'CREDIT_CARD' | 'UPI' | 'WIRE' | 'CASH' | 'CHEQUE' | 'OTHER'
  transactionRef: string;
  proofFileUrl: string;
  proofFileName?: string;
  proofFileType?: 'PDF' | 'JPG' | 'JPEG' | 'PNG';
  uploadedBy?: string;
  uploadedByName?: string;
  uploadedAt: string;
  verificationStatus: 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED' | 'REPLACEMENT_REQUIRED';
  verifiedBy?: string;
  verifiedByName?: string;
  verifiedAt?: string;
  verificationNotes?: string;
  notes?: string;
}

export interface BookingInternalNote {
  id: string;
  authorId?: string;
  authorName: string;
  authorRole?: string;
  text: string;
  timestamp: string;
  relatedServiceId?: string;
  relatedServiceName?: string;
}

export interface BookingCustomerUpdate {
  id: string;
  authorId?: string;
  authorName: string;
  title: string;
  message: string;
  timestamp: string;
  isPublished: boolean;
  relatedServiceId?: string;
  notificationSent?: boolean;
}

export interface BookingTimelineEvent {
  id: string;
  title: string;
  description?: string;
  timestamp: string;
  type: 'CREATION' | 'PASSENGER' | 'DOCUMENT' | 'PAYMENT' | 'SUPPLIER' | 'STATUS_CHANGE' | 'COMMUNICATION' | 'SLA_REMINDER';
  actorName?: string;
  actorRole?: string;
}

export interface BookingStatusHistoryItem {
  id: string;
  previousStatus: string;
  newStatus: string;
  changedBy: string;
  changedByName: string;
  timestamp: string;
  reason: string;
}

export interface BookingDocumentItem {
  id: string;
  category: 'PASSPORT_FRONT' | 'PASSPORT_BACK' | 'PAN_CARD' | 'PAYMENT_PROOF' | 'BOOKING_CONFIRMATION' | 'SUPPLIER_CONFIRMATION' | 'VOUCHER' | 'INVOICE' | 'OTHER';
  title: string;
  fileName: string;
  fileUrl: string;
  fileType?: string;
  fileSize?: string;
  uploadedBy: string;
  uploadedAt: string;
  passengerId?: string;
  passengerName?: string;
  serviceId?: string;
  paymentId?: string;
  verificationStatus?: 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED';
}

export interface Booking {
  id: string;
  bookingReference: string; // e.g. TUB-BK-2026-8492
  sourceType: BookingSourceType;
  leadId?: string;
  leadNumber?: string;
  quoteId?: string;
  quoteNumber?: string;
  destination?: string;
  destinationName?: string;
  agentId?: string;
  agentName?: string;
  agentAgency?: string;
  userId?: string;
  userRole?: UserRole;
  assignedTeamMemberId?: string;
  assignedTeamMemberName?: string;
  customer: BookingCustomerInfo;
  items: BookingItem[];
  currency: CurrencyCode;
  totalAmount: number;
  totalNetCost?: number;
  travelStartDate: string;
  travelEndDate: string;
  status: BookingStatus;
  customerFacingStatus?: string;
  paymentStatus?: BookingPaymentStatus;
  documentStatus?: BookingDocumentStatus;
  missingDocuments?: string[];
  supplierAllocationStatus?: 'UNALLOCATED' | 'DISPATCHED_TO_SUPPLIERS' | 'PARTIALLY_CONFIRMED' | 'FULLY_CONFIRMED_BY_SUPPLIERS';
  supplierAllocations?: BookingSupplierAllocation[];
  
  // Passenger & Document Uploads (strictly up to totalPax)
  passengers?: BookingPassenger[];
  
  // Multi-tranche Payment Proofs
  paymentProofs?: BookingPaymentProof[];
  
  // Internal Notes & Customer Updates
  internalNotesList?: BookingInternalNote[];
  customerUpdates?: BookingCustomerUpdate[];
  
  // Timeline & Status Audit History
  timeline?: BookingTimelineEvent[];
  statusHistory?: BookingStatusHistoryItem[];
  
  // Supplier & Ground Operations Fields (Overall / Fallback)
  paymentCutoffDate?: string;
  serviceDate?: string;
  serviceTime?: string;
  serviceTimezone?: string;
  supplierConfirmationRef?: string;
  internalNotes?: string;
  
  // Financial Invoices & Service Vouchers
  proformaInvoiceUrl?: string;
  taxInvoiceUrl?: string;
  voucherUrl?: string;
  
  createdAt: string;
  updatedAt: string;
  confirmationNotice: string; // "Your booking has been submitted and will be updated in 24-48 Hrs."
  notificationEmailsSent: SentEmailRecord[];
}

export interface GoogleSheetsSyncStatus {
  lastSyncTimestamp: string;
  syncStatus: 'SUCCESS' | 'SYNCING' | 'FAILED' | 'IDLE';
  sheetId: string;
  sheetName: string;
  totalRowsProcessed: number;
  productsUpdated: number;
  productsCreated: number;
  productsDeleted: number;
  validationWarnings: string[];
  syncHistory: {
    id: string;
    timestamp: string;
    status: 'SUCCESS' | 'WARNING' | 'FAILED';
    durationMs: number;
    rowsCount: number;
    message: string;
  }[];
}

export interface ProductFilterState {
  searchQuery: string;
  destination: string;
  city: string;
  category: string;
  productType: string;
  minPrice: number;
  maxPrice: number;
  duration: string;
  availability: string;
  sortBy: 'price-asc' | 'price-desc' | 'rating' | 'popular' | 'newest';
}

// Roster & Operational Calendar Types
export type RosterResourceRole = 
  | 'TRANSPORTER'
  | 'HOTEL_PARTNER'
  | 'TICKET_PARTNER'
  | 'GUIDE'
  | 'DRIVER'
  | 'FREELANCE_DRIVER'
  | 'FREELANCE_GUIDE'
  | 'RESTAURANT'
  | 'CAPTAIN'
  | 'HOST'
  | 'COORDINATOR'
  | 'VEHICLE';

export interface RosterResource {
  id: string;
  name: string;
  role: RosterResourceRole;
  destinationId: string;
  destinationName: string;
  cityHub?: string;
  phone: string;
  email: string;
  languages: string[];
  avatar?: string;
  assignedDuty?: string;
  operationalDates?: string[];
  assignedProductIds?: string[];
  assignedBookings?: string[];
  status: 'ACTIVE' | 'ON_LEAVE' | 'MAINTENANCE' | 'INACTIVE';
}

export type DateAvailabilityStatus = 'AVAILABLE' | 'BLOCKED' | 'OFF_ROSTER' | 'SOLD_OUT' | 'LIMITED' | 'MAINTENANCE';

export interface ProductRosterDateOverride {
  date: string; // YYYY-MM-DD
  status: DateAvailabilityStatus;
  reason?: string;
  maxCapacity?: number;
  bookedPax?: number;
  assignedResourceId?: string;
  assignedResourceName?: string;
  notes?: string;
}

export interface ProductRosterRule {
  productId: string;
  operatingDays: string[]; // e.g. ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  defaultCapacity: number;
  blackoutDates: string[]; // e.g. ['2026-08-25', '2026-12-25']
  dateOverrides: Record<string, ProductRosterDateOverride>;
  assignedDefaultResourceId?: string;
}

export interface AvailabilityCheckResult {
  isAvailable: boolean;
  status: DateAvailabilityStatus;
  date: string;
  reason: string;
  operatingDayName: string;
  maxCapacity: number;
  remainingCapacity: number;
  assignedResourceName?: string;
  nextAvailableDate?: string;
}

// ----------------------------------------------------
// PROMOTIONS & MARKETING CAMPAIGNS & REAL-TIME ANALYTICS
// ----------------------------------------------------
export type PromotionDiscountType = 'PERCENTAGE' | 'FIXED';
export type PromotionAudience = 'ALL' | 'BUYER' | 'B2B_AGENT';
export type PromotionPlacement = 'BANNER' | 'MODAL' | 'SLIDER' | 'PRODUCT_PAGE' | 'DESTINATION_PAGE' | 'PROMO_SECTION';
export type PromotionFrequency = 'ONCE_PER_SESSION' | 'ONCE_PER_DAY' | 'ALWAYS';

export type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'ARCHIVED';

export type CampaignEventType = 'VIEW' | 'CLICK' | 'PRODUCT_VIEW' | 'QUOTE_CREATED' | 'BOOKING_CREATED';

export interface CampaignEvent {
  id: string;
  campaignId: string;
  eventType: CampaignEventType;
  placement: PromotionPlacement | string;
  ctaId?: string;
  ctaText?: string;
  timestamp: string; // ISO 8601
  sessionId: string; // Anonymous browser session identifier
  userId?: string;
  destinationId?: string;
  productId?: string;
  packageId?: string;
  quotationId?: string;
  bookingId?: string;
  bookingValue?: number;
  currency?: string;
  metadata?: Record<string, any>;
}

export interface CampaignPlacementStats {
  placement: string;
  views: number;
  uniqueViews: number;
  clicks: number;
  uniqueClicks: number;
  ctr: number | null;
}

export interface CampaignCTAStats {
  ctaId: string;
  ctaText: string;
  clicks: number;
  uniqueClicks: number;
}

export interface CampaignDailyTrend {
  date: string; // YYYY-MM-DD
  views: number;
  uniqueViews: number;
  clicks: number;
  uniqueClicks: number;
  ctr: number | null;
  quotes: number;
  bookings: number;
  revenue: number;
}

export interface CampaignAnalyticsSummary {
  campaignId: string;
  campaignTitle: string;
  status: CampaignStatus;
  startDate: string;
  endDate: string;
  views: number;
  uniqueViews: number;
  clicks: number;
  uniqueClicks: number;
  ctr: number | null; // null if views === 0
  quotesCount: number;
  bookingsCount: number;
  conversionRate: number | null; // null if clicks === 0 (or bookings / clicks * 100)
  revenueAttributed: number;
  placementsBreakdown: CampaignPlacementStats[];
  ctaBreakdown: CampaignCTAStats[];
  dailyTrends: CampaignDailyTrend[];
}

export type CampaignDateFilter = 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'THIS_MONTH' | 'PREVIOUS_MONTH' | 'CUSTOM';

export interface Promotion {
  id: string;
  title: string;
  subtitle?: string;
  description: string;
  promoCode?: string;
  discountType: PromotionDiscountType;
  discountValue: number; // e.g. 15 for 15% or 100 for 100 USD
  currency?: CurrencyCode;
  minBookingValue?: number;
  maxDiscount?: number;
  bannerImage?: string;
  ctaText?: string;
  ctaLink?: string;
  
  // Targeting & Placements
  targetAudience: PromotionAudience;
  displayPlacement: PromotionPlacement;
  frequency: PromotionFrequency;
  destinationId?: string; // 'all' or specific destination ID
  applicableProductIds: string[]; // empty array = all
  applyToAllProducts: boolean;
  
  // Lifecycle & Status
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  priority: number; // 1 (highest) to 10
  status?: CampaignStatus; // 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'ARCHIVED'
  isActive: boolean;
  isArchived?: boolean;
  
  // Aggregated Real-time counters (synced from actual campaign_events)
  viewCount?: number;
  clickCount?: number;
  impressions?: number;
  clicks?: number;
  createdAt: string;
  updatedAt: string;
}

// ----------------------------------------------------
// BLOG CMS & EDITORIAL
// ----------------------------------------------------
export type BlogStatus = 'PUBLISHED' | 'DRAFT' | 'SCHEDULED' | 'ARCHIVED';

export interface BlogArticle {
  id: string;
  title: string;
  slug: string;
  author: string;
  authorRole?: string;
  authorAvatar?: string;
  category: string;
  tags: string[];
  summary: string;
  content: string; // Rich Markdown/HTML formatted content with tables, headings, callouts
  featuredImage: string;
  status: BlogStatus;
  isFeatured: boolean;
  publishDate: string; // YYYY-MM-DD
  readTimeMinutes: number;
  destinationSlug?: string;
  
  // SEO Metadata
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  socialImage?: string;
  
  views?: number;
  createdAt: string;
  updatedAt: string;
}

// ----------------------------------------------------
// GOOGLE REVIEWS & GOOGLE BUSINESS PROFILE INTEGRATION
// ----------------------------------------------------
export interface GoogleReview {
  id: string;
  googleReviewId?: string;
  googleAccountId?: string;
  googleLocationId?: string;
  placeId?: string;
  businessName?: string;
  authorName: string;
  authorAvatar?: string;
  isAnonymous?: boolean;
  rating: number; // 1 to 5
  reviewText: string;
  date: string;
  reviewCreatedAt?: string;
  reviewUpdatedAt?: string;
  relativeTimeDescription?: string;
  destination?: string;
  locationName?: string;
  source: 'GOOGLE_BUSINESS' | 'TRIPADVISOR' | 'DIRECT_B2B_PARTNER';
  sourceUrl?: string;
  verifiedPartner: boolean;
  isFeatured: boolean;
  isVisible: boolean;
  displayOrder: number;
  helpfulCount?: number;
  responseFromOwner?: {
    text: string;
    date: string;
    updateTime?: string;
  };
  reviewReply?: string;
  reviewReplyUrl?: string;
  reviewMedia?: Array<{
    photoUrl: string;
    thumbnailUrl?: string;
  }>;
  fetchedAt?: string;
  lastSyncedAt?: string;
  status?: 'ACTIVE' | 'ARCHIVED' | 'PENDING_REVIEW';
}

export interface GoogleBusinessProfileConfig {
  mapsUrl: string;
  businessName: string;
  googleAccountId: string | null;
  googleLocationId: string | null;
  placeId: string | null;
  placesApiKey?: string | null;
  formattedAddress?: string;
  websiteUrl?: string;
  isConnected: boolean;
  lastSyncedAt: string | null;
  lastVerifiedAt: string | null;
  reviewsCount: number;
  averageRating: number;
  status: 'DISCONNECTED' | 'CONNECTED' | 'ACTION_REQUIRED' | 'ERROR';
  lastError?: string | null;
  errorDetails?: {
    code: string | number;
    message: string;
    reason: string;
    resolution: string;
    rawError?: string;
  } | null;
  displaySettings: {
    showOnHomepage: boolean;
    minRating: number;
    maxDisplayCount: number;
    sortBy: 'LATEST' | 'HIGHEST_RATED' | 'FEATURED_FIRST';
    autoSync: boolean;
  };
}

export interface GoogleReviewSyncResult {
  success: boolean;
  retrievedCount: number;
  newCount: number;
  updatedCount: number;
  unchangedCount: number;
  errorCount: number;
  lastSyncedAt: string;
  reviews: GoogleReview[];
  errorMessage?: string;
  errorDetails?: {
    code: string | number;
    message: string;
    reason: string;
    resolution: string;
  };
}

export interface GoogleBusinessVerificationStep {
  id: string;
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN' | 'PENDING';
  message: string;
  details?: string;
}

export interface GoogleBusinessVerificationReport {
  timestamp: string;
  isHealthy: boolean;
  status: 'HEALTHY' | 'ACTION_REQUIRED' | 'FAILED';
  steps: GoogleBusinessVerificationStep[];
  accountId: string | null;
  locationId: string | null;
  placeId: string | null;
  reviewsApiWorking: boolean;
  errorMessage?: string;
  recommendedAction?: string;
}

// ----------------------------------------------------
// AUDIT TRAIL & SYSTEM LOGGING
// ----------------------------------------------------
export type AuditCategory = 
  | 'USER'
  | 'CMS'
  | 'DATABASE'
  | 'INTEGRATION'
  | 'PRICING'
  | 'QUOTE'
  | 'BOOKING'
  | 'SECURITY';

export type AuditAction = 
  // User Actions
  | 'USER_LOGIN'
  | 'USER_LOGOUT'
  | 'USER_REGISTERED'
  | 'USER_APPROVED'
  | 'USER_REJECTED'
  | 'USER_ROLE_CHANGED'
  | 'USER_PERMISSIONS_CHANGED'
  // CMS Actions
  | 'PRODUCT_CREATED'
  | 'PRODUCT_UPDATED'
  | 'PRODUCT_PUBLISHED'
  | 'PRODUCT_UNPUBLISHED'
  | 'PRODUCT_ARCHIVED'
  | 'PRODUCT_DELETED'
  | 'HOTEL_CREATED'
  | 'HOTEL_UPDATED'
  | 'HOTEL_ARCHIVED'
  | 'HOTEL_DELETED'
  | 'PACKAGE_CREATED'
  | 'PACKAGE_UPDATED'
  | 'PACKAGE_ARCHIVED'
  | 'PACKAGE_DELETED'
  | 'PACKAGE_DELETE'
  | 'DESTINATION_CREATED'
  | 'DESTINATION_UPDATED'
  | 'DESTINATION_ARCHIVED'
  | 'DESTINATION_DELETED'
  | 'REGION_CREATED'
  | 'REGION_UPDATED'
  | 'REGION_ARCHIVED'
  | 'REGION_DELETED'
  | 'CITY_HUB_CREATED'
  | 'CITY_HUB_UPDATED'
  | 'CITY_HUB_ARCHIVED'
  | 'CITY_HUB_DELETED'
  | 'FAQ_CREATED'
  | 'FAQ_UPDATED'
  | 'FAQ_DELETED'
  | 'BLOG_CREATED'
  | 'BLOG_PUBLISHED'
  | 'BLOG_UPDATED'
  | 'BLOG_ARCHIVED'
  | 'BLOG_DELETED'
  | 'REVIEW_CREATED'
  | 'REVIEW_UPDATED'
  | 'REVIEW_DELETED'
  | 'GALLERY_CREATED'
  | 'GALLERY_UPDATED'
  | 'GALLERY_DELETED'
  | 'PAGE_CREATED'
  | 'PAGE_UPDATED'
  | 'PAGE_ARCHIVED'
  | 'PAGE_DELETED'
  | 'VISA_CREATED'
  | 'VISA_UPDATED'
  | 'VISA_ARCHIVED'
  | 'VISA_DELETED'
  | 'ROSTER_RESOURCE_ADDED'
  | 'ROSTER_RESOURCE_UPDATED'
  | 'ROSTER_RESOURCE_ARCHIVED'
  | 'ROSTER_RESOURCE_DELETED'
  | 'BLACKOUT_DATE_MODIFIED'
  | 'RECORD_DELETED'
  | 'RECORD_ARCHIVED'
  | 'DELETION_BLOCKED_DEPENDENCY'
  | 'UNAUTHORIZED_DELETE_ATTEMPT'
  // Database Actions
  | 'DATABASE_HEALTH_CHECK'
  | 'DATABASE_REPAIR_EXECUTED'
  | 'COLLECTION_VERIFIED'
  | 'DATABASE_MIGRATION'
  | 'DATA_IMPORTED'
  | 'DATA_EXPORTED'
  | 'ORPHAN_CLEANUP'
  | 'SCHEMA_VALIDATED'
  // Integration Actions
  | 'INTEGRATION_CONNECTED'
  | 'INTEGRATION_DISCONNECTED'
  | 'INTEGRATION_VERIFIED'
  | 'INTEGRATION_SYNC_STARTED'
  | 'INTEGRATION_SYNC_COMPLETED'
  | 'INTEGRATION_SYNC_FAILED'
  | 'INTEGRATION_SETTINGS_UPDATED'
  | 'GBP_AUTH_CONNECTED'
  | 'GBP_LOCATION_CONFIGURED'
  | 'GBP_INTEGRATION_VERIFIED'
  | 'GBP_SYNC_STARTED'
  | 'GBP_SYNC_COMPLETED'
  | 'GBP_SYNC_FAILED'
  | 'GBP_DISCONNECTED'
  | 'REVIEW_SYNC'
  | 'REVIEW_CREATED'
  | 'REVIEW_UPDATED'
  | 'REVIEW_DELETED'
  | 'REVIEW_VISIBILITY_CHANGED'
  | 'REVIEW_FEATURED_CHANGED'
  | 'GMAIL_TEST_SENT'
  | 'GMAIL_DISPATCH_RETRY'
  | 'CALENDAR_EVENT_CREATED'
  | 'CALENDAR_SYNC_EXECUTED'
  | 'GOOGLE_SHEETS_SYNC'
  | 'GOOGLE_SHEETS_PULL'
  // Pricing & Promotion Actions
  | 'PRICE_CHANGED'
  | 'MARGIN_CHANGED'
  | 'PROMOTION_CREATED'
  | 'PROMOTION_UPDATED'
  | 'PROMOTION_ACTIVATED'
  | 'PROMOTION_PAUSED'
  | 'PROMOTION_SCHEDULED'
  | 'PROMOTION_ARCHIVED'
  | 'PROMOTION_DELETED'
  | 'PROMOTION_TARGETING_CHANGED'
  | 'PROMOTION_CTA_CHANGED'
  // Quote Actions
  | 'QUOTE_CREATED'
  | 'QUOTE_EDITED'
  | 'QUOTE_DOWNLOADED'
  | 'QUOTE_SENT'
  | 'QUOTE_CONVERTED'
  | 'QUOTE_ARCHIVED'
  | 'QUOTE_DELETED'
  // Lead & Task Actions
  | 'LEAD_CREATED'
  | 'LEAD_UPDATED'
  | 'LEAD_ARCHIVED'
  | 'LEAD_DELETED'
  | 'CALENDAR_TASK_CREATED'
  | 'CALENDAR_TASK_UPDATED'
  | 'CALENDAR_TASK_DELETED'
  // Booking Actions
  | 'BOOKING_CREATED'
  | 'BOOKING_UPDATED'
  | 'BOOKING_CANCELLED'
  | 'BOOKING_CONFIRMED'
  | 'BOOKING_EMAIL_DISPATCHED'
  // General & Settings
  | 'STATUS_UPDATED'
  | 'SETTINGS_UPDATED';

export type CMSDeletableEntityType =
  | 'Product'
  | 'Hotel'
  | 'HotelRoom'
  | 'HotelRate'
  | 'Package'
  | 'CityHub'
  | 'Destination'
  | 'MasterRegion'
  | 'DestinationRegion'
  | 'DestinationFAQ'
  | 'Blog'
  | 'Review'
  | 'Promotion'
  | 'GalleryImage'
  | 'VisaRequirement'
  | 'Visa'
  | 'CustomPage'
  | 'MenuItem'
  | 'FooterColumn'
  | 'FooterLink'
  | 'Quote'
  | 'Lead'
  | 'RosterResource'
  | 'CalendarTask'
  | 'Campaign';

export interface DependencyDetailItem {
  id: string;
  name: string;
  type: string; // e.g. 'Product', 'Hotel', 'Package', 'Quote', 'Booking', 'City Hub', 'Destination', 'Master Region', 'Calendar Task', 'Lead'
  details?: string;
  url?: string;
}

export interface DependencyGroup {
  entityType: string;
  count: number;
  label: string; // e.g. "24 Products", "12 Hotels", "3 Packages"
  items: DependencyDetailItem[];
}

export interface DeletionCheckResult {
  canHardDelete: boolean;
  hasDependencies: boolean;
  totalDependencyCount: number;
  dependencySummary: string; // e.g. "This Hub is currently being used by 24 Products, 12 Hotels and 3 Packages."
  groups: DependencyGroup[];
  canArchive: boolean;
  suggestedAction: 'ALLOW_DELETE' | 'BLOCK_AND_SUGGEST_ARCHIVE' | 'BLOCK_HARD_DELETE';
}

export interface SecureDeleteResult {
  success: boolean;
  action: 'DELETED' | 'ARCHIVED' | 'BLOCKED';
  message: string;
  dependencies?: DeletionCheckResult;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  category?: AuditCategory;
  action: AuditAction;
  entity: string;
  entityId: string;
  timestamp: string;
  details: string;
  previousValue?: string;
  newValue?: string;
  integrationService?: 'FIRESTORE' | 'GMAIL' | 'CALENDAR' | 'SHEETS' | 'NONE';
  status?: 'SUCCESS' | 'WARNING' | 'FAILED';
  clientIp?: string;
}

// ----------------------------------------------------
// INTEGRATIONS & DATABASE GOVERNANCE TYPES
// ----------------------------------------------------
export type IntegrationServiceId = 'FIRESTORE' | 'GMAIL' | 'CALENDAR' | 'SHEETS';

export type IntegrationStatus = 'CONNECTED' | 'ACTION_REQUIRED' | 'CONNECTION_FAILED' | 'NOT_CONNECTED';

export interface IntegrationSummaryItem {
  id: IntegrationServiceId;
  name: string;
  description: string;
  status: IntegrationStatus;
  statusMessage: string;
  lastSync?: string;
  lastVerification?: string;
  errorCount: number;
  iconName: string;
  isProductionReady: boolean;
  activeAccount?: string;
}

export type IssueSeverity = 'CRITICAL' | 'WARNING' | 'INFO';
export type IssueCategory = 'MISSING_FIELD' | 'BROKEN_RELATION' | 'DUPLICATE_KEY' | 'ORPHAN_RECORD' | 'PRICING_INVARIANT' | 'SCHEMA_MISMATCH';

export interface DatabaseIssueItem {
  id: string;
  collection: string;
  documentId: string;
  recordTitle: string;
  category: IssueCategory;
  severity: IssueSeverity;
  problem: string;         // Plain business language explanation of the problem
  businessImpact: string;  // Plain business language explanation of why it matters
  recommendedFix: string;  // Plain business language explanation of how to fix
  technicalDetails: {      // Expandable developer mode technical inspection
    fieldName?: string;
    expectedType?: string;
    actualValue?: any;
    invalidReferenceId?: string;
    targetCollection?: string;
    rawDocument?: Record<string, any>;
  };
  canAutoFix: boolean;
  autoFixAction?: string;
}

export interface CollectionVerificationResult {
  collectionKey: string;
  displayName: string;
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  missingFieldsCount: number;
  brokenRelationshipsCount: number;
  duplicateRecordsCount: number;
  orphanRecordsCount: number;
  lastChecked: string;
  status: 'HEALTHY' | 'ACTION_REQUIRED' | 'CRITICAL';
  issues: DatabaseIssueItem[];
}

export interface DatabaseHealthCategoryScore {
  name: string;
  score: number; // 0 - 100
  totalChecked: number;
  issuesCount: number;
  status: 'OPTIMAL' | 'FAIR' | 'ATTENTION';
}

export interface DatabaseHealthScoreReport {
  overallScore: number; // 0 - 100
  ratingLabel: 'EXCELLENT' | 'GOOD' | 'NEEDS_ATTENTION' | 'CRITICAL';
  totalCollectionsAudited: number;
  totalDocumentsAudited: number;
  totalIssuesCount: number;
  criticalIssuesCount: number;
  warningIssuesCount: number;
  categories: {
    collections: DatabaseHealthCategoryScore;
    relationships: DatabaseHealthCategoryScore;
    requiredFields: DatabaseHealthCategoryScore;
    duplicateRecords: DatabaseHealthCategoryScore;
    orphanRecords: DatabaseHealthCategoryScore;
    pricingData: DatabaseHealthCategoryScore;
    publishedProducts: DatabaseHealthCategoryScore;
  };
  collectionResults: Record<string, CollectionVerificationResult>;
  lastAuditedAt: string;
}

export interface GmailNotificationToggleConfig {
  newUserRegistration: boolean;
  userApprovalRejection: boolean;
  quoteGenerated: boolean;
  quoteDownloaded: boolean;
  bookingConfirmation: boolean;
  bookingStatusUpdate: boolean;
  bookingCancellation: boolean;
  operationsDossier: boolean;
  adminAlerts: boolean;
}

export interface GoogleCalendarSyncConfig {
  calendarId: string;
  apiKey?: string;
  accessToken?: string;
  clientId?: string;
  clientSecret?: string;
  serviceAccountEmail?: string;
  authMode?: 'API_KEY' | 'OAUTH_POPUP' | 'ACCESS_TOKEN' | 'DEMO_SIMULATION';
  accountEmail?: string;
  defaultTimeZone?: string;
  syncBookings: boolean;
  syncTransfers: boolean;
  syncActivities: boolean;
  syncGuideDuties: boolean;
  syncDriverDuties: boolean;
  syncPaymentSlas: boolean;
  autoCreateAlerts: boolean;
  enableTwoWaySync?: boolean;
  lastVerifiedAt?: string;
  lastVerifiedStatus?: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
}

export interface SheetsColumnMappingItem {
  sheetColumn: string;
  dbField: string;
  displayName: string;
  isRequired: boolean;
  dataType: 'string' | 'number' | 'currency' | 'array' | 'boolean';
  sampleValue?: string;
  status: 'MAPPED' | 'UNMAPPED' | 'OPTIONAL';
}

// ----------------------------------------------------
// DYNAMIC PRICING CMS RECORD
// ----------------------------------------------------
export interface DynamicPricingRecord {
  id: string;
  productId: string;
  productName: string;
  destinationId: string;
  supplierId: string;
  currency: CurrencyCode;
  
  // Base Net Costs
  costPrice: number;
  netPrice: number;
  adultNetPrice: number;
  childNetPrice: number;
  infantNetPrice: number;
  
  // Pricing Model
  priceModel: 'PER_PERSON' | 'PER_GROUP' | 'PER_VEHICLE';
  
  // Commercial Overrides
  markupPercent: number;
  b2bWholesaleMarkupPercent: number;
  discountPercent: number;
  taxPercent: number;
  serviceFee: number;
  
  // Calculated selling
  calculatedSellingPrice: number;
  
  // Seasonality & Validity
  season: 'High' | 'Low' | 'Shoulder' | 'All Year';
  validityFrom: string;
  validityTo: string;
  
  notes?: string;
  isActive: boolean;
  lastModifiedBy: string;
  updatedAt: string;
}

// ----------------------------------------------------
// EXTENDED GOOGLE SHEETS SYNC REPORT & MULTI-TAB ARCHITECTURE
// ----------------------------------------------------
export type MasterSheetTabName =
  | 'REGIONS'
  | 'DESTINATIONS'
  | 'HUBS'
  | 'PRODUCTS'
  | 'PRODUCT_PRICING'
  | 'PRODUCT_CAPACITY'
  | 'HOTELS'
  | 'HOTEL_ROOMS'
  | 'HOTEL_MEAL_PLANS'
  | 'HOTEL_RATES'
  | 'VISA'
  | 'VISA_RATES'
  | 'TRANSFER_ROUTES'
  | 'TRANSFER_RATES'
  | 'PACKAGES'
  | 'PACKAGE_ITEMS';

export interface SheetValidationError {
  tabName: MasterSheetTabName | string;
  rowNumber: number;
  recordId: string;
  field: string;
  value: string;
  error: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  suggestedFix: string;
}

export interface SheetTabValidationSummary {
  tabName: MasterSheetTabName | string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  warningRows: number;
  status: 'VALID' | 'WARNING' | 'ERROR';
}

export interface HierarchicalValidationReport {
  isValid: boolean;
  totalRows: number;
  validRows: number;
  errorRows: number;
  tabSummaries: Record<string, SheetTabValidationSummary>;
  errors: SheetValidationError[];
  hierarchyHealth: {
    orphanDestinations: number;
    orphanHubs: number;
    orphanProducts: number;
    orphanHotels: number;
    orphanTransfers: number;
    orphanPackages: number;
    rateMismatches: number;
  };
}

export interface SyncPreviewDiffItem {
  id: string;
  tabName: MasterSheetTabName | string;
  title: string;
  action: 'CREATE' | 'UPDATE' | 'UNCHANGED' | 'BLOCKED';
  changedFields?: string[];
  details?: string;
  rawData?: Record<string, any>;
}

export interface SyncPreviewTabDiff {
  tabName: MasterSheetTabName | string;
  createdCount: number;
  updatedCount: number;
  unchangedCount: number;
  errorCount: number;
  items: SyncPreviewDiffItem[];
}

export interface MultiTabSyncReport {
  id: string;
  timestamp: string;
  userEmail: string;
  sheetId: string;
  sheetName?: string;
  syncMode: 'FULL_SYNC' | 'SELECTED_TABS' | 'INCREMENTAL';
  tabsProcessed: string[];
  durationMs: number;
  status: 'SUCCESS' | 'COMPLETED_WITH_ERRORS' | 'FAILED';
  totalRecords: number;
  createdTotal: number;
  updatedTotal: number;
  unchangedTotal: number;
  errorsTotal: number;
  tabDiffs: Record<string, SyncPreviewTabDiff>;
  validationErrors: SheetValidationError[];
  logs: string[];
}

export interface SyncDetailedReport {
  id: string;
  timestamp: string;
  userEmail: string;
  sheetId: string;
  sheetName: string;
  durationMs: number;
  status: 'SUCCESS' | 'COMPLETED_WITH_ERRORS' | 'FAILED' | 'IN_PROGRESS';
  counts: {
    totalProcessed: number;
    newRecords: number;
    updatedRecords: number;
    unchangedRecords: number;
    removedRecords: number;
    errorsCount: number;
  };
  fieldChanges: {
    sku: string;
    productName: string;
    changedFields: string[];
  }[];
  validationErrors: {
    rowNumber: number;
    field: string;
    value: string;
    error: string;
  }[];
  logs: string[];
  multiTabReport?: MultiTabSyncReport;
}

// ----------------------------------------------------
// TRANSFER ROUTES & TRANSFER RATES ARCHITECTURE
// ----------------------------------------------------
export type TransferRouteType = 'AIRPORT_ARRIVAL' | 'AIRPORT_DEPARTURE' | 'INTERCITY' | 'POINT_TO_POINT' | 'PORT_TRANSFER';
export type TransferRateType = 'PRIVATE' | 'SIC' | 'VIP';

export interface TransferRoute {
  id: string; // e.g. TRF-TYO-HND-001
  destinationId: string; // FK to Destination
  destinationName?: string;
  fromHubId: string; // FK to CityHub
  fromHubName?: string;
  toHubId: string; // FK to CityHub
  toHubName?: string;
  routeName: string; // e.g. "Tokyo Haneda Airport -> Tokyo City Hotels"
  transferType: TransferRouteType;
  vehicleType: string; // e.g. "Executive MPV (Toyota Alphard)", "Toyota HiAce (9 Pax)"
  maxCapacity: number;
  duration?: string;
  meetingPoint?: string;
  inclusions?: string[];
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  displayOrder?: number;
  rates?: TransferRate[];
  createdAt?: string;
  updatedAt?: string;
}

export interface TransferRate {
  id: string; // e.g. TRATE-TYO-001
  routeId: string; // FK to TransferRoute
  rateType: TransferRateType;
  vehicle: string;
  capacity: number;
  currency: CurrencyCode;
  nettCost: number;
  markupBuyer?: number;
  markupAgent?: number;
  status: 'ACTIVE' | 'INACTIVE';
  validityFrom?: string;
  validityTo?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ----------------------------------------------------
// PRODUCT PRICING & CAPACITY ARCHITECTURE (SEPARATE TABS)
// ----------------------------------------------------
export interface ProductPricingRate {
  id: string; // pricing_id e.g. PRC-TYO-001-STD
  productId: string; // FK to Product
  rateType: 'Standard' | 'Peak' | 'Off-Peak' | 'Weekend' | 'Festive' | string;
  currency: CurrencyCode;
  validityFrom: string; // YYYY-MM-DD
  validityTo: string; // YYYY-MM-DD
  adultNett: number;
  childNett: number;
  cwbNett: number; // Child with bed
  cnbNett: number; // Child no bed
  infantNett: number;
  fixedCost: number;
  perPersonCost: number;
  markupBuyer: number;
  markupAgent: number;
  taxPercentage: number;
  supplierName: string;
  supplierRateReference?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductCapacityItem {
  id: string; // capacity_id
  productId: string; // FK to Product
  capacity: number;
  vehicleModel: string;
  fixedNettCost: number;
  currency?: CurrencyCode;
  status?: 'ACTIVE' | 'INACTIVE';
}

// ----------------------------------------------------
// HOTEL MEAL PLANS & VISA RATES ARCHITECTURE
// ----------------------------------------------------
export interface HotelMealPlanItem {
  id: string; // meal_plan_id e.g. MP-TYO-001-BB
  hotelId: string; // FK to Hotel
  mealCode: MealPlanCode | 'CP' | 'MAP' | 'AP';
  mealName: string;
  description: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface VisaRateItem {
  id: string; // visa_rate_id e.g. VRATE-JPN-001
  visaId: string; // FK to VisaProduct
  currency: CurrencyCode;
  validityFrom: string;
  validityTo: string;
  adultNett: number;
  childNett: number;
  infantNett: number;
  serviceFee: number;
  markupBuyer: number;
  markupAgent: number;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface PackageItemRef {
  id: string; // package_item_id e.g. PKGITEM-001
  packageId: string; // FK to B2BPackage
  dayNumber: number;
  hubId: string; // FK to CityHub
  itemType: 'product' | 'hotel' | 'transfer' | 'rail' | 'activity' | 'guide';
  itemId: string; // FK to Master Entity
  quantity: number;
  remarks?: string;
}

// ----------------------------------------------------
// HOTEL MANAGEMENT SYSTEM
// ----------------------------------------------------
export type HotelPublishStatus = 'DRAFT' | 'PREVIEW' | 'PUBLISHED' | 'UNPUBLISHED' | 'ARCHIVED';
export type MealPlanCode = 'RO' | 'BB' | 'HB' | 'FB' | 'AI';

export type HotelRateType = 'STANDARD' | 'DAY_OF_WEEK' | 'SEASONAL' | 'FESTIVE' | 'EVENT' | 'SPECIFIC_DATE';

export interface HotelNightlyRateRule {
  id: string;
  roomTypeId: string;
  mealPlan: MealPlanCode;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  rateType: HotelRateType;
  priority: number; // 5: Specific Date, 4: Event, 3: Festive, 2: Seasonal, 1: Day of Week, 0: Standard Base
  singleNetRate: number;
  doubleNetRate: number;
  tripleNetRate: number;
  extraBedRate: number;
  childRate: number;
  currency: CurrencyCode;
  daysOfWeek?: number[]; // [0, 6] for weekend, [1,2,3,4,5] for weekday
  name?: string;
  minNights?: number;
}

export interface HotelDailyPriceOverride {
  date: string; // YYYY-MM-DD
  roomTypeId?: string;
  singleNetRate: number;
  doubleNetRate: number;
  tripleNetRate?: number;
  extraBedRate?: number;
  childRate?: number;
  mealPlan?: MealPlanCode;
  seasonLabel?: string; // e.g. 'Peak Cherry Blossom', 'New Year Holiday', 'Weekend Surcharge'
  isBlocked?: boolean;
  minNights?: number;
  notes?: string;
}

export interface HotelRate {
  id: string;
  mealPlan: MealPlanCode; // Room Only, Bed & Breakfast, Half Board, Full Board, All Inclusive
  mealPlanName: string;
  singleNetRate: number;
  doubleNetRate: number;
  tripleNetRate: number;
  extraBedRate: number;
  childRate: number;
  adultNettCost?: number;
  markupPercent: number;
  taxPercent: number;
  feePercent: number;
  currency: CurrencyCode;
  validityFrom: string;
  validityTo: string;
  isWeekendPeak?: boolean;
}

export interface HotelRoomType {
  id: string;
  roomName: string;
  roomCategory: string; // e.g. 'Deluxe Suite', 'Ocean View King', 'Traditional Tatami'
  description: string;
  images: string[];
  bedType: string;
  numberOfBeds: number;
  roomSizeSqMeters: number;
  minPax?: number; // Minimum total passengers required (default 1)
  maxPax?: number; // Maximum total passengers allowed
  minAdults?: number; // Minimum adults (default 1)
  maxAdults: number; // Maximum adults (e.g. 2, 3, 4)
  minChildren?: number; // Minimum children (default 0)
  maxChildren: number; // Maximum children allowed (e.g. 1, 2, 3)
  minChildAge?: number; // e.g. 0 or 2
  maxChildAge?: number; // e.g. 11 or 12 years
  infantMaxAge?: number; // e.g. 2 years
  maxInfants?: number; // e.g. 1
  childPricingPolicy?: 'FREE_BELOW_AGE' | 'HALF_PRICE' | 'FULL_ADULT_RATE';
  maxOccupancy: number; // Overall maximum occupancy ceiling
  extraBedAvailable: boolean;
  childPolicy: string;
  amenities: string[];
  view: string;
  cancellationPolicy: string;
  rates: HotelRate[];
  dailyRateOverrides?: Record<string, HotelDailyPriceOverride>;
}

export interface HotelLocationDistances {
  airportName: string;
  airportDistanceKm: number;
  airportTransferTimeMins: number;
  railwayStationName: string;
  railwayDistanceKm: number;
  walkingDistanceMins: number;
  metroStationName: string;
  busStopName?: string;
  nearbyAttractions: string[];
  googleMapsUrl?: string;
}

export interface Hotel {
  id: string;
  name: string;
  code: string;
  destinationId: string;
  destinationName: string;
  regionId?: string;
  regionName?: string;
  hubId?: string;
  cityId: string;
  cityName: string;
  city?: string;
  country: string;
  area: string;
  starRating: number; // 3, 4, 5
  propertyType: 'LUXURY_HOTEL' | 'BOUTIQUE_RESORT' | 'RYOKAN' | 'BUSINESS_HOTEL' | 'VILLA_CHALET';
  shortDescription: string;
  description: string;
  heroImage: string;
  images: string[];
  galleryImages?: string[];
  website?: string;
  googleMapsUrl?: string;
  address: string;
  latitude: number;
  longitude: number;
  locationDetails: HotelLocationDistances;
  roomTypes: HotelRoomType[];
  amenities: string[];
  blackoutDates: string[];
  dailyRateOverrides?: Record<string, HotelDailyPriceOverride>;
  status: HotelPublishStatus;
  startingNetPrice: number;
  currency: CurrencyCode;
  createdAt: string;
  updatedAt: string;
}

// ----------------------------------------------------
// DESTINATION CITIES / HUBS & DESTINATION FAQS
// ----------------------------------------------------
export interface CityHub {
  id: string;
  destinationId: string;
  destinationName: string;
  regionId?: string;
  regionName?: string;
  name: string;
  tagline: string;
  description: string;
  heroImage: string;
  images: string[];
  productCount: number;
  hotelCount: number;
  displayOrder: number;
  highlights: string[];
  isPublished: boolean;
  status: 'ACTIVE' | 'ARCHIVED';
}

export interface DestinationFAQ {
  id: string;
  destinationId: string; // Destination ID e.g. 'japan', 'thailand', 'dubai'
  destinationName: string;
  question: string;
  answer: string;
  displayOrder: number;
  isPublished: boolean;
  category?: string;
}

// ----------------------------------------------------
// HOMEPAGE CONTROL & HAPPY CUSTOMER GALLERY
// ----------------------------------------------------
export interface HomepageFAQItem {
  id: string;
  question: string;
  answer: string;
  category?: string;
  displayOrder: number;
  isPublished: boolean;
}

export interface HeroTrustBadge {
  label: string;
  subtext: string;
  icon?: string;
}

export interface HomepageConfig {
  heroHeading: string;
  heroSubheading: string;
  heroBadgeText: string;
  heroImage: string;
  heroImageAlt?: string;
  heroOverlayOpacity?: number; // 0.3 to 0.85, default 0.65
  primaryCtaText?: string;
  primaryCtaAction?: string;
  showPrimaryCta?: boolean;
  secondaryCtaText?: string;
  secondaryCtaAction?: string;
  showSecondaryCta?: boolean;
  heroTrustBadges?: HeroTrustBadge[];
  heroSellingPoints?: string[];
  featuredDestinationIds: string[];
  destinationOrdering: string[];
  
  // Section / Module Visibility Toggles
  showHeroSection: boolean;
  showDestinationFilter: boolean;
  showCityHubs: boolean;
  showCategoryFilters: boolean;
  showProductGrid: boolean;
  showGoogleReviews: boolean;
  showHappyCustomerGallery: boolean;
  showHomepageFAQs: boolean;
  showPromotionsBanner: boolean;
  showConversionCTA: boolean;

  // Grid Layout Controls
  productGridColumns: number; // 2, 3, or 4
  destinationGridColumns: number; // 2, 3, or 4
  happyCustomerGalleryRows: number;
  happyCustomerGalleryCols: number;

  // Homepage FAQs (distinct from destination-specific FAQs)
  homepageFAQs: HomepageFAQItem[];

  // Call to Action Banner
  ctaTitle: string;
  ctaSubtitle: string;
  ctaButtonText: string;
  ctaButtonLink: string;
}

export interface GalleryImage {
  id: string;
  imageUrl: string;
  caption: string;
  customerName?: string;
  destination?: string;
  displayOrder: number;
  isPublished: boolean;
  tags?: string[];
  createdAt: string;
}

// ----------------------------------------------------
// INTERNAL COMPANY MANAGEMENT SYSTEM (LEADS & OPERATIONS & CRM)
// ----------------------------------------------------
export type LeadStatus = 
  | 'NEW' 
  | 'CONTACTED' 
  | 'QUALIFIED' 
  | 'QUOTE_CREATED' 
  | 'PROPOSAL_SAVED' 
  | 'QUOTED' 
  | 'QUOTE_DOWNLOADED' 
  | 'FOLLOW_UP' 
  | 'BOOKING_SUBMITTED' 
  | 'CONFIRMED' 
  | 'COMPLETED' 
  | 'WON' 
  | 'LOST' 
  | 'ARCHIVED';

export type LeadPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export type LeadSource = 
  | 'WEBSITE' 
  | 'DESTINATION_PAGE'
  | 'PRODUCT_PAGE'
  | 'PACKAGE_INQUIRY' 
  | 'PACKAGE_PAGE'
  | 'QUOTATION_SAVED' 
  | 'PROPOSAL_DOWNLOADED' 
  | 'PROMOTION_DEAL'
  | 'MARKETING_CAMPAIGN'
  | 'MARKETING'
  | 'CONTACT_FORM' 
  | 'ABOUT_US_PAGE'
  | 'MANUAL_ENTRY' 
  | 'REFERRAL' 
  | 'B2B_PARTNER' 
  | 'VISA_PAGE' 
  | 'VISA_PORTAL'
  | 'BOOKING_SUBMISSION'
  | 'DIRECT';

export interface LeadNote {
  id: string;
  authorId?: string;
  authorName: string;
  authorRole?: string;
  text: string;
  timestamp: string;
  isInternal?: boolean;
}

export interface LeadProductItem {
  id: string;
  productId: string;
  productName: string;
  category: string;
  destinationName: string;
  regionName?: string;
  city?: string;
  hub?: string;
  travelDate: string;
  serviceTime?: string;
  quantity: number;
  adults: number;
  children: number;
  infants: number;
  unitNetCost: number;
  unitSellingPrice: number;
  totalNetCost: number;
  totalSellingPrice: number;
  marginPercent?: number;
  currency: CurrencyCode;
  status: 'ACTIVE' | 'CONFIRMED' | 'CANCELLED' | 'REQUESTED';
  selectedAddonNames?: string[];
}

export interface LeadQuoteSnapshot {
  quoteId: string;
  quoteNumber: string;
  version: number;
  quoteDate: string;
  status: QuoteStatus;
  totalNetCost: number;
  marginAmount: number;
  marginPercent: number;
  taxAmount: number;
  feesAmount: number;
  finalSellingPrice: number;
  currency: CurrencyCode;
  buyerMarginPercent?: number;
  b2bMarginPercent?: number;
  customAccountMarginPercent?: number;
  exchangeRateUsed?: number;
  capacityTiersUsed?: string;
  infantCostIncluded?: boolean;
  itemsCount: number;
}

export interface LeadQuoteVersion {
  version: number;
  createdAt: string;
  createdBy: string;
  createdByUserType?: string;
  totalItems: number;
  totalNetCost: number;
  totalSellingPrice: number;
  marginPercent: number;
  taxTotal: number;
  currency: CurrencyCode;
  changesSummary?: string;
  pdfUrl?: string;
}

export interface LeadTimelineEvent {
  id: string;
  type: 
    | 'VIEWED_PACKAGE' 
    | 'ADDED_PRODUCT' 
    | 'QUOTE_CREATED' 
    | 'PROPOSAL_SAVED' 
    | 'QUOTE_DOWNLOADED' 
    | 'BOOKING_SUBMITTED' 
    | 'BOOKING_CONFIRMED' 
    | 'STATUS_CHANGED' 
    | 'ASSIGNMENT_CHANGED' 
    | 'PRIORITY_CHANGED'
    | 'NOTE_ADDED' 
    | 'FOLLOWUP_CREATED' 
    | 'FOLLOWUP_COMPLETED' 
    | 'EMAIL_SENT' 
    | 'CAMPAIGN_CLICK'
    | 'CUSTOM_ACTIVITY';
  title: string;
  description: string;
  timestamp: string;
  performedBy: string;
  performedByUserType?: string;
  quoteId?: string;
  quoteNumber?: string;
  bookingId?: string;
  bookingReference?: string;
  metadata?: Record<string, any>;
}

export interface LeadFollowUpTask {
  id: string;
  calendarTaskId?: string;
  taskType: 'QUOTE_FOLLOW_UP' | 'BOOKING_CONFIRMATION' | 'MANUAL_FOLLOW_UP' | 'PAYMENT_REMINDER' | 'CUSTOM';
  title: string;
  description: string;
  assignedToName: string;
  assignedToEmail: string;
  assignedDepartment: 'SALES' | 'OPERATIONS' | 'MANAGEMENT';
  createdAt: string;
  dueAt: string;
  slaHours: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | 'CANCELLED';
  googleCalendarId?: string;
  googleCalendarEventId?: string;
  googleCalendarLink?: string;
  calendarSyncStatus?: 'SYNCED' | 'NOT_SYNCED' | 'FAILED';
  completedAt?: string;
  completedBy?: string;
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
}

export interface LeadDocument {
  id: string;
  type: 'QUOTE_PDF' | 'PROPOSAL_DOC' | 'BOOKING_VOUCHER' | 'INVOICE' | 'PASSPORT_DOC' | 'ITINERARY_SHEET' | 'CUSTOM';
  title: string;
  fileUrl?: string;
  fileSize?: string;
  createdAt: string;
  createdBy: string;
  quoteId?: string;
  bookingId?: string;
}

export interface LeadAssignmentRecord {
  id: string;
  assignedStaffId: string;
  assignedStaffName: string;
  assignedStaffEmail?: string;
  assignedDepartment?: string;
  assignedBy: string;
  assignedAt: string;
  notes?: string;
}

export type CRMLead = TravelLead;

export interface TravelLead {
  id: string;
  leadNumber: string; // e.g. LED-2026-0042
  contactName: string;
  email: string;
  phone: string;
  country?: string;
  agencyName?: string;
  companyName?: string;

  // User & Account attribution
  userId?: string;
  userType?: 'BUYER' | 'B2B_AGENT' | 'PUBLIC' | 'DMC_STAFF' | 'ADMIN';
  b2bAgentId?: string;
  accountApprovalStatus?: string;

  // Source & Marketing Attribution
  source: LeadSource;
  campaignId?: string;
  campaignName?: string;
  campaignSource?: string;
  utmMedium?: string;
  utmCampaign?: string;

  // Status & Priority
  status: LeadStatus;
  priority?: LeadPriority;
  conversionStatus?: 'IN_PROGRESS' | 'CONVERTED' | 'LOST' | 'ARCHIVED';

  // Staff Assignment
  assignedStaffId: string;
  assignedStaffName: string;
  assignedStaffEmail?: string;
  assignedDepartment?: 'SALES' | 'OPERATIONS' | 'MANAGEMENT';
  assignmentHistory?: LeadAssignmentRecord[];

  // Destination & Travel Requirements
  destinationId: string;
  destinationName: string;
  regionName?: string;
  cities?: string[];
  destinationHubs?: string[];
  travelDates: string;
  travelStartDate?: string;
  travelEndDate?: string;
  numberOfNights?: number;
  paxAdults: number;
  paxChildren: number;
  paxInfants?: number;
  totalPassengers?: number;
  roomsCount?: number;
  roomOccupancy?: string;
  mealPlan?: string;
  hotelPreferences?: string;
  transportPreferences?: string;
  activityPreferences?: string;
  specialRequests?: string;
  additionalNotes?: string;
  travelRequirements: string;

  // Products Requested (Historical snapshot)
  requestedProducts?: LeadProductItem[];

  // Quotation snapshot & Version control
  quoteId?: string;
  quoteNumber?: string;
  quoteIds?: string[];
  quoteVersion?: number;
  quoteSnapshot?: LeadQuoteSnapshot;
  quoteVersions?: LeadQuoteVersion[];

  // Booking linkage
  bookingId?: string;
  bookingReference?: string;
  bookingIds?: string[];
  bookingValue?: number;
  bookingStatus?: BookingStatus;

  // Activity Timeline
  timeline?: LeadTimelineEvent[];

  // Follow-ups & Calendar integration
  followUps?: LeadFollowUpTask[];

  // Internal Notes (protected)
  notes: LeadNote[];

  // Documents
  documents?: LeadDocument[];

  // Financial Overview
  estimatedBudget: number;
  currency: CurrencyCode;

  // Timestamps
  createdAt: string;
  updatedAt: string;
  lastActivityAt?: string;
  lastActivitySummary?: string;
}

// ----------------------------------------------------
// INVOICES & VOUCHERS & FINANCIAL ACCOUNTS
// ----------------------------------------------------
export type InvoicePaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'REFUNDED';

export interface InvoiceServiceItem {
  id: string;
  serviceName: string;
  category: string;
  travelDate: string;
  quantity: number;
  unitPrice: number;
  taxAmount: number;
  totalPrice: number;
  currency: CurrencyCode;
}

export interface BookingInvoice {
  id: string;
  invoiceNumber: string; // e.g. TUB-INV-2026-1048
  bookingId: string;
  bookingReference: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  agentName?: string;
  agencyName?: string;
  invoiceDate: string;
  dueDate: string;
  services: InvoiceServiceItem[];
  subtotal: number;
  taxTotal: number;
  serviceFeeTotal: number;
  discountTotal: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  currency: CurrencyCode;
  paymentStatus: InvoicePaymentStatus;
  paymentMethod?: string;
  paymentTransactionRef?: string;
  companyName: string;
  companyAddress: string;
  companyTaxNumber: string;
  notes: string;
  terms: string;
  createdAt: string;
  updatedAt: string;
}

export interface BookingVoucher {
  id: string;
  voucherNumber: string; // e.g. TUB-VOU-2026-9021
  bookingId: string;
  bookingReference: string;
  serviceItemId: string;
  customerName: string;
  leadPaxName: string;
  totalPax: number;
  destination: string;
  city: string;
  serviceName: string;
  serviceDate: string;
  serviceTime: string;
  supplierName: string;
  supplierContact: string;
  meetingPoint: string;
  pickupInfo: string;
  emergencyContact: string;
  passengerBreakdown: string;
  specialInstructions: string;
  status: 'ISSUED' | 'REDEEMED' | 'CANCELLED';
  issuedAt: string;
}

export interface FinancialTransaction {
  id: string;
  type: 'CUSTOMER_PAYMENT' | 'SUPPLIER_PAYOUT' | 'COMMISSION_PAYMENT' | 'REFUND' | 'ADJUSTMENT';
  amount: number;
  currency: CurrencyCode;
  date: string;
  reference: string;
  description: string;
  receiptUrl?: string;
  createdBy: string;
}

export interface BookingFinancialRecord {
  id: string;
  bookingId: string;
  bookingReference: string;
  customerName: string;
  agencyName?: string;
  currency: CurrencyCode;
  
  // Sales Side
  customerSellingPrice: number;
  salesTax: number;
  salesFee: number;
  salesDiscount: number;
  totalSalesValue: number;
  amountReceived: number;
  outstandingReceivable: number;
  
  // Purchase Side
  supplierId: string;
  supplierName: string;
  supplierCost: number;
  purchaseInvoiceRef?: string;
  amountPayableToSupplier: number;
  amountPaidToSupplier: number;
  outstandingPayable: number;
  
  // Profitability
  grossMarginAmount: number;
  grossMarginPercent: number;
  netMarginAmount: number;
  
  transactions: FinancialTransaction[];
  updatedAt: string;
}

// ----------------------------------------------------
// JOB SHEETS & DAILY OPERATIONS DASHBOARD
// ----------------------------------------------------
export type JobSheetStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'ATTENTION_REQUIRED';
export type JobServiceType = 'TRANSFER' | 'TOUR' | 'ACTIVITY' | 'TICKET' | 'HOTEL_CHECKIN' | 'HOTEL_CHECKOUT' | 'GUIDE_DUTY' | 'DRIVER_DUTY';

export interface JobSheet {
  id: string;
  jobSheetNumber: string; // e.g. TUB-JOB-2026-5512
  date: string; // YYYY-MM-DD
  time: string;
  bookingId: string;
  bookingReference: string;
  customerName: string;
  customerPhone?: string;
  totalPax: number;
  destination: string;
  city: string;
  serviceType: JobServiceType;
  serviceName: string;
  pickupLocation: string;
  dropoffLocation?: string;
  assignedGuideName?: string;
  assignedGuidePhone?: string;
  assignedDriverName?: string;
  assignedDriverPhone?: string;
  assignedVehicle?: string;
  supplierName: string;
  supplierPhone: string;
  status: JobSheetStatus;
  operationalNotes: string;
  completedAt?: string;
}

// ----------------------------------------------------
// EMAIL CAMPAIGN MANAGEMENT SYSTEM
// ----------------------------------------------------
export type EmailCampaignType = 
  | 'BOOKING_CONFIRMATION' 
  | 'SAVED_QUOTE_REMINDER' 
  | 'DOWNLOADED_QUOTE_REMINDER' 
  | 'FIRST_BOOKING_REMINDER';

export interface EmailCampaignConfig {
  id: string;
  campaignType: EmailCampaignType;
  name: string;
  description: string;
  isEnabled: boolean;
  subject: string;
  templateHtml: string;
  senderName: string;
  senderEmail: string;
  triggerCondition: string;
  delayHours: number;
  dynamicVariables: string[]; // e.g. ['{{Customer Name}}', '{{Booking ID}}', '{{Destination}}', '{{Travel Date}}', '{{Amount}}', '{{Booking Link}}']
  sentCount: number;
  lastDispatchedAt?: string;
}

// Aliases for convenient CMS usage
export type Invoice = BookingInvoice;
export type ServiceVoucher = BookingVoucher;
export type EmailCampaignTemplate = EmailCampaignConfig;

// ----------------------------------------------------
// WISHLIST & CUSTOM ITINERARY FOLDERS
// ----------------------------------------------------
export interface WishlistFolder {
  id: string;
  userId: string;
  name: string;
  description?: string;
  color?: string; // Hex or tailwind color name
  createdAt: string;
  updatedAt?: string;
}

export interface WishlistItem {
  id: string;
  userId: string;
  productId: string;
  folderId: string; // 'default' or folder ID
  notes?: string;
  estimatedTravelDate?: string;
  addedAt: string;
}

// ----------------------------------------------------
// DRAG-AND-DROP ITINERARY TIMELINE
// ----------------------------------------------------
export interface ItineraryDaySlot {
  dayNumber: number;
  date: string;
  title?: string;
  destination?: string;
  city?: string;
  itemIds: string[];
}

// ----------------------------------------------------
// INSTITUTIONAL & LEGAL PAGES CONFIGURATION
// ----------------------------------------------------
export interface SitePagesConfig {
  contactPage: {
    heroTitle: string;
    heroSubtitle: string;
    officeAddress: string;
    salesEmail: string;
    opsEmail: string;
    phone: string;
    whatsappNumber: string;
    supportHours: string;
    emergencyHotline: string;
  };
  termsPage: {
    lastUpdated: string;
    title: string;
    b2bWholesaleTerms: string;
    cancellationSlaNotice: string;
    generalTermsSnippet: string;
  };
  refundPage: {
    lastUpdated: string;
    title: string;
    processingTimeDays: number;
    forceMajeurePolicy: string;
    refundConditionsSnippet: string;
  };
  privacyPage: {
    lastUpdated: string;
    title: string;
    dataControllerEmail: string;
    gdprNoticeSnippet: string;
  };
  b2bPortal: {
    announcementBanner: string;
    isAnnouncementActive: boolean;
    contractDownloadNotice: string;
  };
}

// ----------------------------------------------------
// MENU & DYNAMIC PAGES CONFIGURATION
// ----------------------------------------------------
export type MenuItemType = 'DESTINATION' | 'PAGE' | 'CUSTOM_PAGE' | 'EXTERNAL_LINK' | 'SYSTEM_VIEW' | 'CUSTOM_LINK';

export interface MenuItemConfig {
  id: string;
  label: string;
  type: MenuItemType;
  targetId: string; // e.g. 'all', 'japan', 'uk', 'europe', 'CONTACT', 'TERMS', 'PRIVACY', 'REFUND', 'BLOGS', or custom page slug
  targetUrl?: string;
  customUrl?: string;
  displayOrder: number;
  isVisible: boolean;
  badgeText?: string;
}

export interface CustomPage {
  id: string;
  title: string;
  subtitle?: string;
  slug: string;
  menuLabel?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  heroImage?: string;
  content: string; // Markdown or HTML
  showInMenu: boolean;
  menuOrder: number;
  isPublished: boolean;
  seoTitle?: string;
  seoDescription?: string;
  metaDescription?: string;
  createdAt: string;
  updatedAt: string;
}

// ----------------------------------------------------
// FOOTER NAVIGATION STRUCTURE
// ----------------------------------------------------
export interface FooterMenuLink {
  id: string;
  label: string;
  url: string;
  type: 'DESTINATION' | 'CUSTOM_PAGE' | 'SYSTEM_VIEW' | 'EXTERNAL_LINK' | 'CUSTOM_LINK';
  targetId?: string;
  displayOrder: number;
  status?: 'ACTIVE' | 'INACTIVE';
  openIn?: '_self' | '_blank';
  description?: string;
  badge?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface FooterMenuColumn {
  id: string;
  title: string;
  displayOrder: number;
  status?: 'ACTIVE' | 'INACTIVE' | 'DRAFT';
  isVisible?: boolean;
  description?: string;
  links?: FooterMenuLink[];
  items?: MenuItemConfig[];
  createdAt?: string;
  updatedAt?: string;
}

export interface FooterConfig {
  tagline: string;
  copyrightText: string;
  showSocialLinks: boolean;
  socialLinks: { platform: string; url: string }[];
  columns: FooterMenuColumn[];
  draftColumns?: FooterMenuColumn[];
  status?: 'PUBLISHED' | 'DRAFT_PENDING';
  lastPublishedAt?: string;
  lastPublishedBy?: string;
}

// ----------------------------------------------------
// VISA PRODUCTS & CHECKLIST MANAGEMENT
// ----------------------------------------------------
export type VisaEntryType = 'SINGLE_ENTRY' | 'MULTIPLE_ENTRY' | 'DOUBLE_ENTRY';

export interface VisaDocumentRequirement {
  id: string;
  name: string;
  description: string;
  isMandatory: boolean;
  fileFormatAccepted?: string;
  sampleTemplateUrl?: string;
}

export interface VisaProduct {
  id: string;
  country: string;
  countryCode?: string;
  destinationId?: string;
  visaType: string; // e.g. 'Tourist E-Visa (Single Entry)', 'Business Visa', 'Long Stay Visa'
  entryType: VisaEntryType;
  validityDays: number;
  stayDurationDays: number;
  processingTimeDays: number;
  expressProcessingAvailable: boolean;
  expressProcessingTimeDays?: number;
  embassyFee: number;
  serviceFee: number;
  expressServiceFee?: number;
  currency: CurrencyCode;
  description: string;
  documentsChecklist: string[];
  detailedRequirements?: VisaDocumentRequirement[];
  submissionSteps: string[];
  eligibilityNotes: string[];
  downloadableForms?: { id: string; name: string; url: string; fileSize?: string }[];
  faqs?: { question: string; answer: string }[];
  heroImage?: string;
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
  featured?: boolean;
  createdAt: string;
  updatedAt: string;
}

// ----------------------------------------------------
// USER ACTIVITY & TELEMETRY TRACKING
// ----------------------------------------------------
export interface UserActivityEvent {
  id: string;
  userId: string;
  userEmail: string;
  userName?: string;
  agencyName?: string;
  type: 'PROPOSAL_SAVED' | 'QUOTE_DOWNLOADED' | 'BOOKING_SUBMITTED' | 'PAGE_VIEW' | 'LOGIN' | 'CALCULATOR_USED';
  targetId?: string;
  targetTitle?: string;
  details?: Record<string, any>;
  timestamp: string;
  durationSeconds?: number;
}

export interface UserTelemetrySummary {
  userId: string;
  userEmail: string;
  userName: string;
  agencyName?: string;
  role: UserRole;
  proposalsSavedCount: number;
  savedProposals: Quotation[];
  proposalsDownloadedCount: number;
  downloadedQuotes: Quotation[];
  bookingsCount: number;
  bookings: Booking[];
  totalTimeSpentMinutes: number;
  lastActiveTimestamp: string;
  createdAt: string;
}

// ----------------------------------------------------
// GOOGLE CALENDAR TASK & GROUND SLA AUTOMATION
// ----------------------------------------------------
export type SLATaskType = 
  | 'BOOKING_CONFIRMATION'
  | 'QUOTE_FOLLOW_UP'
  | 'HOTEL_CONFIRMATION'
  | 'ACTIVITY_CONFIRMATION'
  | 'TRANSFER_CONFIRMATION'
  | 'TRANSPORT_ASSIGNMENT'
  | 'DRIVER_ASSIGNMENT'
  | 'GUIDE_ASSIGNMENT'
  | 'RESTAURANT_CONFIRMATION'
  | 'RAIL_CONFIRMATION'
  | 'TICKET_CONFIRMATION'
  | 'YACHT_CONFIRMATION'
  | 'SUPPLIER_FOLLOW_UP'
  | 'CUSTOM';

export type SLAStatus = 
  | 'WITHIN_SLA'
  | 'APPROACHING_DEADLINE'
  | 'SLA_BREACHED'
  | 'COMPLETED_ON_TIME'
  | 'COMPLETED_BREACHED';

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | 'CANCELLED';

export interface CalendarReminderOption {
  method: 'popup' | 'email';
  minutesBefore: number;
}

export interface CalendarTask {
  id: string;
  automationId?: string;
  taskType?: SLATaskType;
  title: string;
  description: string;
  assignedToEmail: string;
  assignedToName: string;
  assignedDepartment?: 'OPERATIONS' | 'SALES' | 'GROUND_OPS' | 'FINANCE';
  category: 'CLIENT_FOLLOW_UP' | 'GROUND_DISPATCH' | 'SUPPLIER_CUTOFF' | 'PAYMENT_REMINDER' | 'VIP_ARRIVAL' | 'VISA_SUBMISSION' | 'OPERATIONS_SLA';
  
  // Timestamps & SLA
  generatedAt?: string; // ISO 8601
  dueAt?: string; // ISO 8601 = generatedAt + slaHours
  slaHours?: number;
  slaStatus?: SLAStatus;
  
  // Date/Time fields for Calendar
  startDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endDate?: string;
  endTime?: string;
  
  // Relations
  bookingId?: string;
  bookingReference?: string;
  quoteId?: string;
  quoteNumber?: string;
  leadNumber?: string;
  leadId?: string;
  customerName?: string;
  customerEmail?: string;
  destination?: string;
  travelDate?: string;
  bookingType?: string;
  supplierName?: string;
  quoteValue?: number;
  currency?: string;
  requiredAction?: string;
  cmsLink?: string;
  
  // Google Calendar Sync
  googleCalendarId?: string;
  googleCalendarEventId?: string;
  googleCalendarLink?: string;
  isSyncedToGoogleCalendar: boolean;
  calendarSyncStatus?: 'SYNCED' | 'FAILED' | 'NOT_SYNCED' | 'PENDING_RETRY';
  syncError?: string;
  syncRetries?: number;
  reminders?: CalendarReminderOption[];
  
  // State
  status: TaskStatus;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  completedAt?: string;
  completedBy?: string;
  notes?: string;
  
  createdAt: string;
  updatedAt: string;
}

export interface SLAAutomationRule {
  id: string;
  ruleName: string;
  triggerEvent: 
    | 'BOOKING_CONFIRMED'
    | 'QUOTE_PDF_DOWNLOADED'
    | 'GROUND_HOTEL_BOOKED'
    | 'GROUND_TRANSFER_BOOKED'
    | 'GROUND_ACTIVITY_BOOKED'
    | 'GROUND_GUIDE_REQUESTED'
    | 'GROUND_TRANSPORT_REQUESTED'
    | 'GROUND_DRIVER_REQUESTED'
    | 'GROUND_RESTAURANT_BOOKED'
    | 'GROUND_RAIL_BOOKED'
    | 'GROUND_TICKET_BOOKED'
    | 'GROUND_YACHT_BOOKED'
    | 'SUPPLIER_FOLLOWUP_REQUIRED'
    | 'CUSTOM';
  taskType: SLATaskType;
  isEnabled: boolean;
  slaHours: number; // e.g. 12 or 24 or 6
  defaultAssignee: {
    type: 'DEPARTMENT' | 'ROLE' | 'SPECIFIC_USER';
    name: string;
    email: string;
    department?: 'OPERATIONS' | 'SALES' | 'GROUND_OPS' | 'FINANCE';
    role?: string;
  };
  department: 'OPERATIONS' | 'SALES' | 'GROUND_OPS' | 'FINANCE';
  titleTemplate: string;
  calendarId: string; // 'primary' or custom Google Calendar ID
  reminders: CalendarReminderOption[];
  applicableDestinations?: string[]; // Empty means all
  applicableProductTypes?: string[]; // Empty means all
  descriptionTemplate?: string;
  updatedAt: string;
}

export interface SLAAutomationAuditLog {
  id: string;
  triggerEvent: string;
  automationRuleId: string;
  automationRuleName: string;
  taskType: string;
  taskId: string;
  bookingId?: string;
  quoteId?: string;
  assignedUser: string;
  assignedEmail: string;
  googleCalendarId: string;
  googleCalendarEventId?: string;
  createdAt: string;
  slaDeadline: string;
  completionTime?: string;
  slaStatus: SLAStatus | string;
  calendarSyncStatus: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  error?: string;
  retries: number;
  action: string;
  performedBy?: string;
}

// ----------------------------------------------------
// B2B TRAVEL AGENT PORTAL WORKSPACE & CRM TYPES
// ----------------------------------------------------

export interface TripRouteHub {
  id: string;
  hubId: string;
  hubName: string;
  destinationId?: string;
  destinationName?: string;
  nights: number;
  order: number;
  hotelId?: string;
  roomTypeId?: string;
  roomsCount?: number;
  accommodationType?: AccommodationType;
  isManualHotel?: boolean;
  manualHotel?: ManualHotelDetails;
  notes?: string;
}

export type PackageStatus = 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'UNPUBLISHED' | 'ARCHIVED';

export type PackagePricingMode = 'LIVE' | 'LOCKED';

export interface PackageProductRef {
  productId: string;
  dayNumber: number;
  productName?: string;
  category?: ProductCategory | string;
  productType?: string;
  hubId?: string;
  hubName?: string;
  notes?: string;
  isOptional?: boolean;
  lockedAdultNetCost?: number;
  lockedChildNetCost?: number;
  lockedInfantNetCost?: number;
}

export interface PackageHotelRef {
  hotelId: string;
  hotelName?: string;
  cityName?: string;
  hubId?: string;
  hubName?: string;
  roomTypeId?: string;
  roomTypeName?: string;
  mealPlanCode?: string;
  mealPlanName?: string;
  nights: number;
  startDay: number;
  endDay: number;
  lockedRatePerNight?: number;
}

export interface PackageItineraryDay {
  dayNumber: number;
  title: string;
  hubId?: string;
  hubName?: string;
  destinationId?: string;
  destinationName?: string;
  description: string;
  operationalNotes?: string;
  hotelId?: string;
  hotelName?: string;
  roomTypeId?: string;
  mealPlan?: string;
  mealsIncluded?: {
    breakfast: boolean;
    lunch: boolean;
    dinner: boolean;
  };
  productIds: string[]; // references to master Product IDs
  transferId?: string; // reference to master transfer product
  railId?: string; // reference to master rail product
  guideIncluded?: boolean;
  freeTime?: boolean;
  notes?: string;
}

export interface PackagePricingConfig {
  pricingMode: PackagePricingMode;
  baseNetCostUSD: number;
  suggestedSellingPriceUSD: number;
  adultNettUSD?: number;
  childNettUSD?: number;
  infantNettUSD?: number;
  buyerMarkupPercent?: number;
  b2bMarkupPercent?: number;
  customMarginPercent?: number;
  taxOnMarginPercent?: number;
  commercialMarginUSD?: number;
  currency: CurrencyCode;
}

export interface PackageCustomizationRules {
  allowHotelCustomization: boolean;
  allowActivityCustomization: boolean;
  allowTransferCustomization: boolean;
  allowDurationCustomization: boolean;
  allowMealCustomization: boolean;
}

export interface PackageVisibility {
  destinationPage: boolean;
  hubPage: boolean;
  homepage: boolean;
  promotions: boolean;
  search: boolean;
  featured: boolean;
}

export interface PackageSEO {
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  canonicalUrl?: string;
}

export interface B2BPackage {
  id: string;
  title: string;
  name?: string; // Alias for title
  slug: string;
  regionId?: string;
  regionName?: string;
  destinationId: string;
  destinationName: string;
  hubIds?: string[];
  hubNames?: string[];
  durationDays: number;
  durationNights: number;
  heroImage: string;
  galleryImages?: string[];
  tagline: string;
  description: string;
  detailedDescription?: string;
  routeSummary: string[]; // e.g. ['Tokyo (3N)', 'Kyoto (2N)', 'Osaka (2N)']
  routeHubs?: TripRouteHub[];
  hotelsSummary: {
    hotelId?: string;
    name: string;
    cityName: string;
    nights: number;
    roomType: string;
    mealPlan?: string;
  }[];
  productIds: string[]; // references to Product.id
  productReferences?: PackageProductRef[];
  hotelReferences?: PackageHotelRef[];
  itinerary?: PackageItineraryDay[];
  recommendedProductIds?: string[]; // references to recommended optional master products
  pricingConfiguration?: PackagePricingConfig;
  customizationRules?: PackageCustomizationRules;
  highlights: string[];
  inclusions: string[];
  exclusions: string[];
  termsAndConditions?: string;
  cancellationPolicy?: string;
  importantInformation?: string;
  baseNetCostUSD: number;
  suggestedSellingPriceUSD: number;
  currency: CurrencyCode;
  tripType: 'LUXURY' | 'FAMILY' | 'HONEYMOON' | 'CULTURAL' | 'ADVENTURE' | 'CLASSIC';
  tags: string[];
  status?: PackageStatus;
  visibility?: PackageVisibility;
  seo?: PackageSEO;
  isFeatured?: boolean;
  isPublished: boolean;
  createdBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export type TourPackage = B2BPackage;

export interface B2BCustomer {
  id: string;
  agentId: string;
  name: string;
  email: string;
  phone: string;
  company?: string;
  country: string;
  city?: string;
  notes?: string;
  preferredDestination?: string;
  budgetPerPersonUSD?: number;
  totalQuotesCount: number;
  totalBookingsCount: number;
  tags?: string[];
  lastContactDate: string;
  createdAt: string;
}

export interface B2BTask {
  id: string;
  agentId: string;
  title: string;
  description: string;
  dueDate: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  relatedQuoteId?: string;
  relatedQuoteNumber?: string;
  relatedCustomerName?: string;
  relatedCustomerEmail?: string;
  createdAt: string;
  updatedAt: string;
}

export type B2BTabType = 
  | 'home'
  | 'dashboard' 
  | 'create-quote' 
  | 'packages' 
  | 'products' 
  | 'hotels' 
  | 'visa'
  | 'my-quotes' 
  | 'bookings' 
  | 'customers' 
  | 'tasks' 
  | 'account';

export type B2BNavTab = B2BTabType;

// ----------------------------------------------------
// B2B TRAVEL QUOTATION & PACKAGE ENGINE UPGRADE TYPES
// ----------------------------------------------------

export interface PassengerClassification {
  adults: number; // Age 11+
  cwb: number; // Child with bed (Age 5 to < 11)
  cnb: number; // Child no bed (Age 2 to < 5)
  infants: number; // Infant (Age < 2, default cost 0)
  cwbAges: number[];
  cnbAges: number[];
  infAges: number[];
  totalPax: number;
  displayText: string; // e.g., "ADT: 2 | CWB: 1 (Age 8) | CNB: 1 (Age 4) | INF: 1 (Age 1)"
}

export interface QuotationOption {
  id: string;
  optionNumber: number;
  title: string; // e.g., "Option 1: 4-Star Premium", "Option 2: 5-Star Luxury", "Option 3: Ultra Luxury / Villa"
  badge?: string;
  hotelTier?: string;
  hotelSummary?: string;
  items: QuoteItem[];
  routeHubs: TripRouteHub[];
  totalNetCost: number;
  totalSellingPrice: number;
  totalMargin: number;
  totalTaxes: number;
}

export interface FeasibilityWarning {
  id: string;
  type: 'HOTEL' | 'TRANSFER' | 'ACTIVITY' | 'RAIL' | 'GUIDE' | 'VISA' | 'INSURANCE' | 'ESIM' | 'SERVICE' | 'LOGISTICS';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  message: string;
  actionLabel?: string;
  actionType?: string;
  dayNumber?: number;
  hubId?: string;
  hubName?: string;
}

export interface FeasibilityCheckResult {
  score: number; // 0 to 10
  status: 'EXCELLENT' | 'GOOD' | 'NEEDS_ATTENTION' | 'HIGH_RISK';
  statusLabel: string;
  statusColor: string;
  warnings: FeasibilityWarning[];
  recommendations: string[];
}

export interface B2BInsurancePlan {
  id: string;
  name: string;
  provider: string;
  coverageAmountUSD: number;
  coverageSummary: string;
  costPerDayAdultUSD: number;
  costPerDayChildUSD: number;
  sellingPricePerDayAdultUSD: number;
  sellingPricePerDayChildUSD: number;
  medicalEmergencyCoverage: string;
  tripCancellationCoverage: string;
  baggageLossCoverage: string;
}

export interface B2BEsimPlan {
  id: string;
  destination: string;
  dataAllowance: string; // e.g. "5 GB", "10 GB", "Unlimited"
  validityDays: number; // e.g. 7, 10, 15, 30
  carrier: string;
  netCostUSD: number;
  sellingPriceUSD: number;
  features: string[];
}



