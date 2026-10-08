export * from './types/seo';
export * from './types/rail';
import type { EntitySEO } from './types/seo';
import type { RailBookingItemDetails } from './types/rail';

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
  | 'Group Tours'
  | 'Transfers' 
  | 'Tickets'
  | 'Private Yacht' 
  | 'Ferries' 
  | 'Ferry'
  | 'Guides' 
  | 'Hotels'
  | 'Visa & Ancillary Services'
  | 'Rail / Shinkansen'
  | 'Lunch / Dinner Restaurant'
  // Legacy migration aliases (auto-normalized by ConfiguratorRegistry)
  | 'Day Trips'
  | 'Activities'
  | 'Transport'
  | 'Tours'
  | 'Rail'
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

export type CurrencyPairStatus = 'ACTIVE' | 'PAUSED' | 'STALE';

export interface CurrencyPairConfig {
  id: string; // e.g. "USD_INR", "JPY_INR"
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  googleFinanceLiveRate?: number; // Raw live rate evaluated by =GOOGLEFINANCE() in Google Sheets
  googleFinanceFormula?: string; // e.g. =GOOGLEFINANCE("CURRENCY:USDINR")
  xeLiveRate: number; // Raw live market rate (Google Finance / interbank)
  manualAdjustment: number; // Absolute value added to live rate (e.g. +1.00, +0.03)
  effectiveRate: number; // liveRate + manualAdjustment
  status: CurrencyPairStatus;
  lastFetchedAt: string;
  lastUpdatedAt: string;
  updatedBy?: string;
  updatedByName?: string;
  notes?: string;
}

export interface CurrencyAuditLog {
  id: string;
  pairId: string;
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  previousLiveRate: number;
  newLiveRate: number;
  previousAdjustment: number;
  newAdjustment: number;
  previousEffectiveRate: number;
  newEffectiveRate: number;
  changedByUserId: string;
  changedByName: string;
  changedByEmail?: string;
  reason: string;
  timestamp: string;
}

export interface CurrencySettings {
  baseCurrency: CurrencyCode;
  googleSheetsSyncEnabled?: boolean;
  googleSheetId?: string;
  googleSheetTabName?: string;
  googleFinanceProviderEnabled?: boolean;
  xeProviderEnabled?: boolean;
  cacheTtlMinutes: number;
  fallbackPolicy: 'USE_LAST_VALID' | 'USE_BASELINE' | 'BLOCK_TRANSACTION';
  staleThresholdMinutes: number;
  lastGlobalSyncAt: string;
  autoSyncIntervalMinutes: number;
}

export interface FXRateDetails {
  nativeCurrency: CurrencyCode;
  targetCurrency: CurrencyCode;
  googleFinanceLiveRate?: number;
  googleFinanceFormula?: string;
  xeLiveRate: number;
  manualAdjustment: number;
  effectiveRate: number;
  isConverted: boolean;
  rateTimestamp: string;
  provider: string;
}

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

export interface CMSSystemAnalysisPermissions {
  enabled: boolean;
  view?: boolean;
  userAnalysis?: boolean;
  activityAnalysis?: boolean;
  transactionAnalysis?: boolean;
  export?: boolean;
}

export interface BookingOperationsPermissions {
  view?: boolean;
  create_manual?: boolean;
  edit?: boolean;
  manage_service_items?: boolean;
  allocate_supplier?: boolean;
  view_supplier_prices?: boolean;
  manage_supplier_prices?: boolean;
  confirm_service_items?: boolean;
  generate_vouchers?: boolean;
  upload_invoices?: boolean;
  view_internal_financials?: boolean;
  override_confirmation?: boolean;
  manage_supplier_records?: boolean;
}

export interface SupplierPermissions {
  view?: boolean;
  create?: boolean;
  edit?: boolean;
  archive?: boolean;
  restore?: boolean;
  manage_contacts?: boolean;
  manage_services?: boolean;
  view_financial_details?: boolean;
  manage_financial_details?: boolean;
  view_activity_history?: boolean;
  manage_rates?: boolean;
  upload_documents?: boolean;
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
  shareWhatsApp?: boolean; // Controls whether user can share quotation via WhatsApp
  canShareWhatsAppQuotes?: boolean; // Alias for permission matrix control

  // Booking Operations & Supplier Allocation Desk Granular Permissions
  bookingOperations?: BookingOperationsPermissions;

  // Supplier Management Master Directory Granular Permissions
  suppliers?: SupplierPermissions;

  // Tasks & Follow-Ups Granular Permissions
  tasksView?: boolean;
  tasksCreate?: boolean;
  tasksEdit?: boolean;
  tasksAssign?: boolean;
  tasksComplete?: boolean;
  tasksDelete?: boolean;
  tasksManageAutomaticFollowups?: boolean;
  leadTasksView?: boolean;
  leadTasksCreate?: boolean;
  bookingTasksView?: boolean;
  bookingTasksCreate?: boolean;
  bookingItemTasksView?: boolean;
  bookingItemTasksCreate?: boolean;

  // CMS Access & Hierarchical Modules
  canAccessCMS?: boolean;
  cmsOperations?: CMSOperationsPermissions;
  cmsContent?: CMSContentPermissions;
  cmsFinance?: CMSFinancePermissions;
  cmsSystem?: CMSSystemPermissions;
  cmsSystemAnalysis?: CMSSystemAnalysisPermissions;

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

export type VerificationStatus = 'VERIFIED' | 'PENDING_VERIFICATION' | 'UNVERIFIED' | 'REJECTED';

export interface Company {
  id: string;
  name: string;
  legalName?: string;
  businessType?: string;
  logoUrl?: string;
  brandLogoUrl?: string;
  website?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  taxOrGstNumber?: string;
  iataOrAbtaNumber?: string;
  verificationStatus: VerificationStatus;
  tier?: 'TIER_1_DIRECT_DMC' | 'PREFERRED_PARTNER' | 'STANDARD_PARTNER';
  notes?: string;
  primaryContactUserId?: string;
  primaryContactName?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
  linkedUserIds?: string[];
  createdAt: string;
  updatedAt?: string;
}

export interface User {
  id: string;
  name: string;
  displayName?: string;
  userType?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  password?: string;
  role: UserRole;
  category?: UserCategory;
  department?: string;
  companyId?: string;
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
  updatedAt?: string;
  lastLoginAt?: string;
  approvalStatus?: UserApprovalStatus;
  verificationStatus?: VerificationStatus;
  isDeactivated?: boolean;
  deactivatedAt?: string;
  notes?: string;
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
  seo?: EntitySEO;
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
  status: 'ACTIVE' | 'COMING_SOON' | 'DRAFT' | 'INACTIVE' | 'ARCHIVED';
  primaryCtaText?: string;
  showPrimaryCta?: boolean;
  secondaryCtaText?: string;
  showSecondaryCta?: boolean;
  trustBadgeText?: string;
  heroConfig?: UniversalHeroConfig;
  seo?: EntitySEO;
}

export type SupplierCategory = 
  | 'HOTEL' 
  | 'TRANSFER' 
  | 'ACTIVITY' 
  | 'TOUR' 
  | 'RAIL' 
  | 'GUIDE' 
  | 'VISA' 
  | 'YACHT' 
  | 'CRUISE' 
  | 'TRANSPORT' 
  | 'RESTAURANT' 
  | 'EVENT' 
  | 'FLIGHT' 
  | 'SIGHTSEEING' 
  | 'INSURANCE' 
  | 'ESIM' 
  | 'DMC_GROUND' 
  | 'OTHER';

export type SupplierStatus = 'ACTIVE' | 'INACTIVE' | 'UNDER_REVIEW' | 'SUSPENDED' | 'ARCHIVED';

export interface SupplierContactPerson {
  id: string;
  name: string;
  role?: string;
  designation?: string;
  email: string;
  phone: string;
  whatsapp?: string;
  isPrimary?: boolean;
  isSecondary?: boolean;
  isEmergency?: boolean;
  emergencyPhone?: string;
  notes?: string;
}

export interface SupplierBankDetails {
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  swiftBic?: string;
  iban?: string;
  routingCode?: string;
  branchAddress?: string;
}

export interface SupplierServiceCoverage {
  regionsServed: string[];
  destinationsServed: string[];
  hubsServed: string[];
  cityHubsServed?: string[];
  supportedCategories: SupplierCategory[];
  serviceCategories?: SupplierCategory[];
  languagesSupported?: string[];
  has24x7Support?: boolean;
  serviceAvailability: 'ALL_YEAR' | 'SEASONAL' | 'CUSTOM';
  seasonalMonths?: string[];
  operatingDays?: string[];
  operatingHours?: string;
  emergencySupport24x7?: boolean;
  emergencySupportDetails?: string;
}

export interface SupplierCommercialDetails {
  defaultCurrency: CurrencyCode;
  paymentTerms: string;
  standardPaymentTerms?: string;
  paymentMethod?: string;
  creditPeriodDays?: number;
  creditDays?: number;
  cancellationPolicy?: string;
  cancellationPolicyTerms?: string;
  contractReference?: string;
  contractStartDate?: string;
  contractEndDate?: string;
  taxTreatment?: string;
  internalCommercialNotes?: string;
  bankDetails?: SupplierBankDetails;
}

export interface SupplierRateCard {
  id: string;
  supplierId: string;
  serviceName: string;
  serviceCategory: SupplierCategory;
  destination: string;
  hub?: string;
  rateAdult: number;
  rateChild?: number;
  rateInfant?: number;
  rateUnit?: 'PER_PERSON' | 'PER_VEHICLE' | 'PER_GROUP' | 'PER_UNIT';
  unitType?: string;
  capacity?: number;
  currency: CurrencyCode;
  validFrom: string;
  validTo: string;
  inclusions?: string;
  exclusions?: string;
  terms?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierDocument {
  id: string;
  supplierId: string;
  title: string;
  documentType: 'CONTRACT' | 'RATE_SHEET' | 'INVOICE' | 'AGREEMENT' | 'COMPLIANCE' | 'INSURANCE' | 'OTHER';
  fileUrl?: string;
  fileName: string;
  fileSize?: string;
  notes?: string;
  uploadedBy: string;
  uploadedByName: string;
  uploadedAt: string;
}

export interface SupplierActivityHistory {
  id: string;
  supplierId: string;
  action: 
    | 'CREATED' 
    | 'EDITED' 
    | 'STATUS_CHANGED' 
    | 'ARCHIVED' 
    | 'RESTORED' 
    | 'CONTACT_UPDATED' 
    | 'COVERAGE_UPDATED' 
    | 'COMMERCIAL_UPDATED' 
    | 'RATE_CARD_ADDED' 
    | 'RATE_CARD_UPDATED' 
    | 'DOCUMENT_UPLOADED' 
    | 'DOCUMENT_DELETED' 
    | 'ALLOCATION_LINKED' 
    | 'ALLOCATION_UNLINKED'
    | 'NOTE_ADDED';
  summary: string;
  details?: string;
  performedBy: string;
  performedByName: string;
  performedByEmail: string;
  timestamp: string;
}

export interface SupplierAllocationRecord {
  id: string;
  supplierId: string;
  supplierNameSnapshot: string;
  supplierCategory: string;
  supplierDestination?: string;
  bookingId: string;
  bookingReference: string;
  serviceItemId: string;
  serviceName: string;
  customerName?: string;
  serviceDate?: string;
  status: 'ALLOCATED' | 'CONFIRMED' | 'REJECTED' | 'CHANGED' | 'REMOVED';
  allocatedBy: string;
  allocatedByName: string;
  allocatedAt: string;
  previousSupplierId?: string;
  previousSupplierName?: string;
  changeReason?: string;
}

export interface SupplierPriceRecord {
  id: string;
  supplierId: string;
  bookingId: string;
  bookingReference: string;
  serviceItemId: string;
  serviceName: string;
  supplierPrice: number;
  currency: CurrencyCode;
  priceType: string;
  previousPrice?: number;
  effectiveDate: string;
  updatedBy: string;
  updatedByName: string;
  changeReason?: string;
  timestamp: string;
}

export interface Supplier {
  id: string;
  supplierCode?: string; // Stable immutable unique ID (e.g. SUP-00101)
  name: string;
  legalName?: string;
  tradingName?: string;
  supplierType?: string;
  country: string;
  state?: string;
  city?: string;
  address?: string;
  destination: string;
  destinations?: string[];
  hubs?: string[];
  categories?: SupplierCategory[];
  status?: SupplierStatus;
  contactPerson: string;
  contactPersons?: SupplierContactPerson[];
  email: string;
  phone: string;
  whatsapp?: string;
  emergencyPhone?: string;
  website: string;
  taxRegistrationNumber?: string;
  description?: string;
  currency: CurrencyCode;
  contractStatus?: 'ACTIVE' | 'PENDING_RENEWAL' | 'UNDER_REVIEW';
  isPreferred?: boolean;
  paymentTerms: string;
  cancellationTerms: string;
  serviceCoverage?: SupplierServiceCoverage;
  commercialDetails?: SupplierCommercialDetails;
  bankDetails?: SupplierBankDetails; // Protected
  performanceScore?: number; // 0-100
  responseTimeAvgHours?: number;
  confirmationRatePercent?: number;
  cancellationRatePercent?: number;
  onTimePaymentCompliancePercent?: number;
  openRequestsCount?: number;
  pendingConfirmationsCount?: number;
  outstandingPayableAmount?: number;
  linkedServiceItemsCount?: number;
  activeBookingsCount?: number;
  notes?: string;
  createdBy?: string;
  createdByName?: string;
  createdAt?: string;
  updatedBy?: string;
  updatedByName?: string;
  updatedAt?: string;
  archivedAt?: string;
  archivedBy?: string;
  archivedReason?: string;
}

export type SupplierRequestStatus = 
  | 'DRAFT' 
  | 'SENT' 
  | 'SUPPLIER_ACKNOWLEDGED' 
  | 'OFFER_RECEIVED' 
  | 'CONFIRMED' 
  | 'REJECTED' 
  | 'CANCELLED';

export interface SupplierRequest {
  id: string;
  bookingId: string;
  bookingReference: string;
  serviceItemId?: string;
  serviceName: string;
  category: SupplierCategory;
  supplierId: string;
  supplierName: string;
  supplierEmail: string;
  supplierPhone?: string;
  requestDate: string;
  deadlineDate: string;
  status: SupplierRequestStatus;
  sentVia?: 'EMAIL' | 'WHATSAPP' | 'PORTAL';
  quoteReceivedAmount?: number;
  quoteCurrency?: CurrencyCode;
  confirmationReference?: string;
  cancellationCutoffDate?: string;
  paymentCutoffDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}


export interface ProductAddon {
  id: string;
  name: string;
  description: string;
  pricePerPax: number;
  currency: CurrencyCode;
  selectedByDefault?: boolean;
}

/**
 * Authoritative Master Product Upsell / Optional Experience Upgrade
 * Managed directly in Admin Product Management (Section 16-22 & Product-Based Upsell Architecture)
 * Supports:
 * 1. TYPE 1: Existing Product Upsell (upsellProductId pointing to master Product record)
 * 2. TYPE 2: Standalone Structured Upsell (custom ad-hoc experience)
 */
export interface ProductUpsell {
  id: string; // Stable Relationship ID or Upsell ID
  relationshipId?: string; // Canonical alias for id
  parentProductId?: string; // Parent Master Product ID
  productId?: string; // Alias for parentProductId
  upsellProductId?: string; // Master Product ID of the referenced existing product (TYPE 1)
  isExistingProduct?: boolean; // True if referencing an existing master product
  name: string; // Authoritative product name or custom title
  sku?: string; // SKU of referenced product
  shortDescription?: string;
  description?: string;
  price: number; // Selling price / display price
  netCost?: number; // Base net supplier cost
  currency: CurrencyCode;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  displayOrder: number;
  category?: ProductCategory | string;
  destinationId?: string;
  destinationName?: string;
  hubId?: string;
  imageUrl?: string;
  supplierId?: string;
  supplierName?: string;
  isRequired?: boolean;
  maxQuantity?: number;
  priceType?: 'PER_PERSON' | 'PER_BOOKING' | 'PER_VEHICLE' | 'PER_DAY' | 'HOURLY';
  customLabel?: string;
  internalNotes?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}

/**
 * Authoritative Upsell Relationship representation in Master Inventory & Master Sync
 */
export interface UpsellRelationship {
  id: string; // relationship_id
  relationship_id?: string;
  parentProductId: string; // parent_product_id
  parent_product_id?: string;
  upsellProductId: string; // upsell_product_id
  upsell_product_id?: string;
  displayOrder: number;
  display_order?: number;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  customLabel?: string;
  custom_label?: string;
  internalNotes?: string;
  internal_notes?: string;
  createdAt: string;
  created_at?: string;
  updatedAt: string;
  updated_at?: string;
  createdBy?: string;
  created_by?: string;
}

/**
 * Historical snapshot stored on Quotes / Bookings when an upsell is selected
 * Guarantees historical data protection and operational tracking (Section 22, 34)
 */
export interface SelectedUpsellSnapshot {
  upsellId: string;
  upsellProductId?: string; // Master Product ID if Type 1
  isExistingProduct?: boolean;
  parentProductId?: string;
  upsellNameSnapshot: string;
  categorySnapshot?: ProductCategory | string;
  skuSnapshot?: string;
  supplierIdSnapshot?: string;
  supplierNameSnapshot?: string;
  imageUrlSnapshot?: string;
  priceSnapshot: number;
  netCostSnapshot?: number;
  currencySnapshot: CurrencyCode;
  selectedAt: string;
  quantity?: number;
  priceType?: 'PER_PERSON' | 'PER_BOOKING' | 'PER_VEHICLE' | 'PER_DAY' | 'HOURLY';
  customLabel?: string;
}

export interface Product {
  id: string;
  product_id?: string;
  sku: string;
  destinationId: string;
  destinationName: string;
  destination?: string;
  regionId?: string;
  regionName?: string;
  hubId?: string;
  hubIds?: string[];
  fromHubId?: string;
  toHubId?: string;
  fromHubName?: string;
  toHubName?: string;
  cityHubId?: string;
  country: string;
  city: string;
  productType: string;
  listingName?: string;
  name: string;
  title?: string;
  slug?: string;
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
  nativeCurrency?: CurrencyCode;
  
  // Commercial parameters
  defaultMarkupPercent: number;
  buyerMarkupPercent?: number; // Default Buyer markup % (e.g. 30%)
  b2bAgentMarkupPercent?: number; // Default B2B Agent markup % (e.g. 20%)
  taxPercent: number;
  taxMethod?: 'on_margin' | 'on_total' | string;
  taxBase?: 'margin' | 'total' | string;
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
  
  // Content & Overview fields
  summary?: string; // Canonical alias for shortDescription
  description?: string; // Canonical alias for longDescription
  cancellationPolicy: string;
  inclusions: string[];
  exclusions: string[];
  importantInformation: string[];
  meetingPoint?: string;
  pickupInformation?: string;
  pickupPoint?: string; // Pickup Point for Group Tours & Day Tours
  dropoffLocation?: string; // Drop-off Point for Tours
  dropoffPoint?: string; // Alias for dropoffLocation
  
  // Restaurant specific master fields
  restaurantName?: string;
  specialty?: string;
  mealSelect?: ('Breakfast' | 'Lunch' | 'Dinner')[];
  mealPricing?: RestaurantMealPriceItem[];
  
  // Guide specific master fields
  hourlyPrice?: number;
  hourlyNettCost?: number;
  minHours?: number;
  
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
  upsells?: ProductUpsell[]; // Authoritative Master Upsells / Optional Experience Upgrades (Section 16-22)
  
  // Advanced Pricing & Operational Enhancements
  pricingModel?: 'CAPACITY_TIERED' | 'PER_PERSON' | 'PER_HOUR' | 'MEAL_PASSENGER' | string;
  pricingMethod?: 'per_person' | 'capacity_based' | 'fixed_stay' | 'hourly_based';
  tieredPricing?: TieredPrice[];
  capacityTiers?: any[];
  datePricingOverrides?: Record<string, ProductDatePricingOverride>;
  vehicleConfig?: TransferVehicleConfig;
  vehicleId?: string;
  vehicleNameSnapshot?: string;
  vehicleTypeSnapshot?: string;
  capacitySnapshot?: number;
  yachtId?: string;
  yachtNameSnapshot?: string;
  yachtTypeSnapshot?: string;
  yachtCapacitySnapshot?: number;
  ferryId?: string;
  ferryNameSnapshot?: string;
  ferryTypeSnapshot?: string;
  ferryCapacitySnapshot?: number;
  ticketConfig?: TicketConfig;
  guideConfig?: GuideConfig;
  restaurantConfig?: RestaurantConfig;
  ferryConfig?: FerryConfig;
  isTransfer?: boolean;
  accommodationType?: AccommodationType;
  isManualHotel?: boolean;
  manualHotelDetails?: ManualHotelDetails;
  seo?: EntitySEO;
  metadata?: Record<string, any>;
  configuration?: MasterProductConfiguration;
}

export interface TicketTierPrice {
  id: string;
  name: string; // e.g. "Standard Admission", "VIP Fast Track Pass", "Timed Entry Slot", "Multi-Day Explorer Pass"
  tierType?: 'STANDARD' | 'VIP_FAST_TRACK' | 'TIMED_ENTRY' | 'MULTI_DAY_PASS' | 'FLEXIBLE';
  adultNetPrice: number;
  childNetPrice?: number;
  infantNetPrice?: number;
  buyerMarkupPercent?: number;
  b2bAgentMarkupPercent?: number;
  sellingPriceStartingFrom?: number;
  currency?: CurrencyCode;
  description?: string;
  redemptionMethod?: 'INSTANT_QR_VOUCHER' | 'MOBILE_VOUCHER' | 'PRINTED_VOUCHER' | 'WILL_CALL_COUNTER';
  bookingCutoffHours?: number;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface TicketConfig {
  ticketType?: 'STANDARD' | 'VIP_FAST_TRACK' | 'TIMED_ENTRY' | 'MULTI_DAY_PASS' | 'FLEXIBLE';
  ticketTierName?: string;
  ticketTiers?: TicketTierPrice[];
  redemptionMethod?: 'INSTANT_QR_VOUCHER' | 'MOBILE_VOUCHER' | 'PRINTED_VOUCHER' | 'WILL_CALL_COUNTER';
  validityDays?: number;
  instantConfirmation?: boolean;
  bookingCutoffHours?: number;
  entryTimeSlots?: string[];
  cancellationPolicyNotice?: string;
  childAgeMin?: number;
  childAgeMax?: number;
  infantAgeMax?: number;
}

export interface GuideConfig {
  languages?: string[];
  primaryLanguage?: string;
  additionalLanguages?: string[];
  guideType?: 'LICENSED_NATIONAL_GUIDE' | 'LOCAL_EXPERT' | 'CHAUFFEUR_GUIDE' | 'SPECIALIST_ACADEMIC';
  specialization?: string[];
  rateType?: 'FULL_DAY' | 'HALF_DAY' | 'HOURLY' | 'NIGHT_TOUR';
  hourlyNetRate?: number; // Base net hourly rate to supplier
  hourlySellingRate?: number; // Calculated delivered hourly rate
  minHours?: number; // Minimum booking duration (e.g. 4 Hours)
  overtimeHourlyRate?: number; // Overtime hourly rate
  maxGroupSize?: number;
  includesGuideTransportation?: boolean;
  includesGuideMeals?: boolean;
  meetingInstructions?: string;
}

export interface RestaurantConfig {
  restaurantName?: string;
  specialty?: string; // Specialty dish / cuisine highlight (e.g. "Edo-mae Sushi & Seasonal Nigiri")
  mealSelect?: ('Breakfast' | 'Lunch' | 'Dinner')[]; // Selectable meal types (Breakfast, Lunch, Dinner)
  mealTypes?: string[];
  mealType?: 'SET_LUNCH' | 'KAISEKI_DINNER' | 'OMAKASE' | 'MULTI_COURSE' | 'BUFFET' | 'AFTERNOON_TEA' | 'A_LA_CARTE';
  cuisineType?: string;
  seatingType?: 'PRIVATE_ROOM_TATAMI' | 'PRIVATE_ROOM_TABLE' | 'CHEF_COUNTER' | 'MAIN_DINING';
  dietaryAccommodations?: string[];
  beveragePackage?: 'NONE' | 'NOMIHOUDAI_ALL_YOU_CAN_DRINK' | 'SOMMELIER_WINE_PAIRING' | 'SAKE_PAIRING' | 'NON_ALCOHOLIC_PAIRING' | 'STANDARD_TEA_WATER';
  durationMinutes?: number;
  reservationCancellationHours?: number;
  dressCode?: string;
  mealPricing?: RestaurantMealPriceItem[];
}

export interface RestaurantMealPriceItem {
  id?: string;
  meal: 'Breakfast' | 'Lunch' | 'Dinner' | string;
  adultNettPrice: number;
  childNettPrice: number;
  infantNettPrice?: number;
  currency?: CurrencyCode;
  marginType?: 'PERCENTAGE' | 'FIXED';
  marginValue?: number;
  taxType?: 'PERCENTAGE' | 'FIXED' | 'NOT_APPLICABLE';
  taxValue?: number;
  serviceChargeType?: 'PERCENTAGE' | 'FIXED' | 'NOT_APPLICABLE';
  serviceChargeValue?: number;
  adultFinalPrice?: number;
  childFinalPrice?: number;
  infantFinalPrice?: number;
  status?: 'ACTIVE' | 'INACTIVE';
}

export type PricingModelType = 
  | 'CAPACITY_TIERED' 
  | 'PER_PERSON' 
  | 'PER_HOUR' 
  | 'MEAL_PASSENGER' 
  | 'RAIL_FARE' 
  | 'ROOM_NIGHT' 
  | 'APPLICANT' 
  | 'TRAVELLER' 
  | 'SERVICE_UNIT' 
  | 'PLAN_DURATION';

export interface FerryConfig {
  vesselId?: string;
  vesselName?: string;
  ferryLine?: string;
  departurePort?: string;
  arrivalPort?: string;
  vesselType?: 'HIGH_SPEED_HYDROFOIL' | 'SIGHTSEEING_CRUISE' | 'STANDARD_CAR_FERRY' | 'CATAMARAN';
  vesselClass?: string;
  capacity?: number;
  seatingClass?: 'STANDARD' | 'FIRST_CLASS_GREEN' | 'VIP_OBSERVATION_LOUNGE';
  luggageAllowanceBags?: number;
  isRoundTrip?: boolean;
  departureSchedule?: string[];
}

export interface MasterProductConfiguration<T = Record<string, any>> {
  configuration_id: string;
  product_id: string;
  product_category: string;
  configurator_type: string;
  configuration_version: number;
  configuration_schema_version: string;
  configuration_data: T;
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export type ProductPricingMethod = 'per_person' | 'capacity_based' | 'fixed_stay' | 'hourly_based';

export interface TieredPrice {
  id: string;
  tierLabel: string; // e.g. '1–3 Pax', '4–6 Pax', '7–12 Pax'
  minPax: number;
  maxPax: number;
  vehicleCount?: number; // Number of vehicles required for this tier (e.g. 1 or 2)
  netCostPerPax: number; // Base net cost
  sellingPricePerPax?: number; // Calculated final selling price
  
  // Section 8 Canonical Capacity Tier Data Structure:
  capacityPricingRuleId?: string;
  productId?: string;
  productCategory?: string;
  fleetId?: string;
  fleetName?: string;
  vehicleId?: string;
  vehicleName?: string;
  minPassengers?: number;
  maxPassengers?: number;
  pricingUnit?: 'Per Vehicle' | 'Per Person' | 'Per Tier';
  nativeCurrency?: CurrencyCode;
  currency?: CurrencyCode;
  supplierNett?: number; // Authoritative Admin-entered supplier/base/nett cost input
  nettPrice?: number;
  marginType?: 'PERCENTAGE' | 'FIXED';
  marginValue?: number;
  taxType?: 'PERCENTAGE' | 'FIXED' | 'NOT_APPLICABLE';
  taxValue?: number;
  serviceChargeType?: 'PERCENTAGE' | 'FIXED' | 'NOT_APPLICABLE';
  serviceChargeValue?: number;
  finalPrice?: number;
  effectiveFrom?: string;
  effectiveTo?: string;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface ProductDatePricingOverride {
  date: string; // YYYY-MM-DD
  dayOfWeek: string; // 'Monday', 'Tuesday', etc.
  netPrice: number;
  sellingPrice?: number;
  isBlackout?: boolean;
  notes?: string;
}

export interface VehicleMaster {
  id: string; // e.g. 'veh-alphard-01'
  name: string; // e.g. 'Toyota Alphard Executive MPV'
  model: string; // e.g. 'Toyota Alphard Executive Lounge (7-Seater)'
  type: string; // e.g. 'Executive MPV'
  classification: string; // e.g. 'Executive MPV / Van (4–7 Seats)'
  manufacturer: string; // e.g. 'Toyota'
  seatingCapacity: number; // e.g. 7
  luggageCapacity: number; // e.g. 4
  destinationId?: string;
  destinationName?: string;
  hubId?: string;
  hubName?: string;
  supplierId?: string;
  supplierName?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface YachtMaster {
  id: string; // e.g. 'yacht-azimut-66'
  name: string; // e.g. 'Ocean Pearl (Azimut 66 Flybridge)'
  model: string; // e.g. 'Azimut 66 Flybridge'
  type: string; // e.g. 'Motor Yacht'
  classification: string; // e.g. 'Motor Yacht (Luxury Flybridge)'
  capacity: number; // Max guest capacity (e.g. 12 Guests)
  length: string; // e.g. '66 ft / 20.8 m'
  dimensions?: string; // e.g. '66 ft LOA x 17.2 ft Beam'
  destinationId?: string;
  destinationName?: string;
  hubId?: string;
  hubName?: string;
  supplierId?: string;
  supplierName?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface FerryMaster {
  id: string; // e.g. 'ferry-miyajima-01'
  name: string; // e.g. 'JR Miyajima Ferry (Nanaura Maru)'
  type: string; // e.g. 'Standard Ferry'
  vesselClass: string; // e.g. 'Standard Car & Passenger Ferry'
  capacity: number; // e.g. 800
  route: string; // e.g. 'Miyajimaguchi ↔ Miyajima Island'
  origin: string; // e.g. 'Miyajimaguchi Pier'
  destination: string; // e.g. 'Miyajima Island Terminal'
  operator?: string; // e.g. 'JR West Miyajima Ferry Co.'
  destinationId?: string;
  destinationName?: string;
  hubId?: string;
  hubName?: string;
  supplierId?: string;
  supplierName?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TransferVehicleConfig {
  vehicleId?: string;
  vehicleNameSnapshot?: string;
  vehicleTypeSnapshot?: string;
  capacitySnapshot?: number;
  yachtId?: string;
  yachtNameSnapshot?: string;
  yachtTypeSnapshot?: string;
  ferryId?: string;
  ferryNameSnapshot?: string;
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
  skipperName?: string; // e.g. 'Captain Kenji Sato (Master 200GT)'
  
  // Occupancy rules (Configurable by Admin)
  adultSeatCount?: number; // default 1 seat
  childSeatCount?: number; // default 1 seat
  infantSeatCount?: number; // default 0 seats (lap child) or 1 seat
  
  // Multi-vehicle / yacht & Capacity allocation rules
  allowMultipleVehicles?: boolean;
  autoAllocateVehicles?: boolean;
  maxVehicles?: number;
  pricingMethod?: 'capacity_based' | 'per_person';
  allocationStrategy?: string;
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
  selectedUpsellIds?: string[]; // Selected Master Upsell IDs
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
  price?: number;
  finalTotalSellingPrice: number;
  totalSellingPrice?: number;
  sellingPriceFinal: number;
  pricePerPerson: number;
  marginAmount?: number;
  serviceFeeAmount?: number;

  // Native Commercial Calculation (Calculate Native First, Convert Second)
  nativeCurrency?: CurrencyCode;
  nativeTotalNetCost?: number;
  nativeGrossBeforeTax?: number;
  nativeMarkupAmount?: number;
  nativeTaxAmount?: number;
  nativeFinalSellingPrice?: number;
  nativePricePerPerson?: number;
  fxDetails?: FXRateDetails;
  
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

  // Master Pricing Source of Truth & Audit Metadata
  rateId?: string;
  rateVersion?: string | number;
  rateEffectiveFrom?: string;
  rateEffectiveTo?: string;
  isAuthoritative?: boolean;
  sourceCollection?: string;
  pricingRequestId?: string;
  calculatedAt?: string;

  // Protected Internal Commercial Fields (CMS/Admin Only)
  internalNettCost?: number;
  internalMarkup?: number;
  agentMarkup?: number;
  internalProfit?: number;
  supplierCost?: number;
  rateSnapshot?: any;
  pricingVersion?: number | string;
  commercialNotes?: string;
}

/**
 * Internal Commercial Pricing Response (CMS/Admin Only)
 * Contains private supplier costs, margins, and wholesale markups.
 */
export type InternalPricingResponse = PricingCalculationResult;

/**
 * Sanitized Customer-Facing Pricing Response for B2B Agents
 * STRICT GUARANTEE: Never contains internal nett price, supplier cost,
 * dmc margin, or wholesale markup calculations.
 */
export interface AgentPricingResponse {
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

  // Final Quoted Breakdown (Selling Price)
  adultsSubtotalSelling: number;
  childrenSubtotalSelling: number;
  infantsSubtotalSelling: number;
  addonsSubtotalSelling: number;
  adultPricePerPax: number;
  childPricePerPax: number;

  // Final Customer-Facing Results
  price?: number;
  finalTotalSellingPrice: number;
  totalSellingPrice?: number;
  sellingPriceFinal: number;
  pricePerPerson: number;

  // Customer-Facing Taxes and Fees (Without internal cost breakdowns)
  taxAmount?: number;
  serviceFee?: number;
  discountAmount?: number;

  // Safe Vehicle Details (Without unitVehicleNetCost or totalVehicleNetCost)
  isCapacityBased?: boolean;
  pricingMethod?: 'per_person' | 'capacity_based' | 'fixed_stay';
  vehicleDetails?: {
    vehicleName?: string;
    vehicleModel: string;
    vehicleType: string;
    maxSeats: number;
    occupiedSeats: number;
    vehiclesAllocated: number;
    capacityExceeded?: boolean;
    capacityErrorMessage?: string;
    seatBreakdown?: {
      adultSeats: number;
      childSeats: number;
      infantSeats: number;
      totalSeats: number;
    };
    allowMultipleVehicles?: boolean;
  };

  // Safe Metadata
  rateEffectiveTo?: string;
  isAuthoritative?: boolean;
  calculatedAt?: string;
}

export type QuoteItemSource = 'AI_PLANNER' | 'USER' | 'SYSTEM';

export interface QuoteItemContentSnapshot {
  overviewSpecifications: string;
  inclusions: string[];
  exclusions: string[];
  snapshotVersion?: string;
  sourceType: string;
  sourceId: string;
  capturedAt: string;
}

export interface QuoteItem {
  id: string;
  product: Product;
  productId?: string;
  customTitle?: string;
  title?: string;
  productName?: string;
  category?: string;
  pax: {
    adults: number;
    children: number;
    infants: number;
  };
  travelDate: string;
  serviceTime?: string;
  notes?: string;
  selectedAddonIds: string[];
  selectedUpsellIds?: string[]; // Selected Master Upsell IDs
  selectedUpsellSnapshots?: SelectedUpsellSnapshot[]; // Frozen historical upsells snapshot (Section 22, 34)
  selected_options?: Record<string, any>; // Compact configuration options selected by agent (Section 31)
  calculation: PricingCalculationResult | AgentPricingResponse;
  accommodationType?: AccommodationType;
  isManualHotel?: boolean;
  manualHotelDetails?: ManualHotelDetails;
  source?: QuoteItemSource;
  aiSuggested?: boolean;
  railJourneyDetails?: RailBookingItemDetails;
  japanRailJourneySnapshot?: any;
  shinkansenJourneyPayload?: any;
  master_product_id?: string;
  service_id?: string;
  service_type?: 'VISA' | 'TRAVEL_PROTECTION' | 'VIP_GROUND' | 'CONNECTIVITY' | string;
  configuration_id?: string;
  configuration_snapshot?: any;
  pricing_snapshot?: any;
  currency_snapshot?: CurrencyCode | string;
  parent_product_id?: string; // Links upsell quote item to parent product (Section 15-18)
  parent_item_id?: string; // Links upsell quote item to parent quote item
  upsell_relationship_id?: string; // Authoritative relationship ID
  is_upsell?: boolean; // Indicates if this quote item was added as an upsell
  upsell_type?: 'EXISTING_PRODUCT' | 'STANDALONE';
  visaSnapshot?: QuoteVisaSnapshot;
  contentSnapshot?: QuoteItemContentSnapshot;
  metadata?: Record<string, any>;
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
  | 'BOOKED'
  | 'BOOKING_SUBMITTED' 
  | 'ARCHIVED';

export interface QuoteVersionRecord {
  id?: string;
  version: number;
  versionNumber?: number;
  quoteId?: string;
  leadId?: string;
  previousVersionId?: string;
  updatedAt: string;
  updatedBy: string;
  createdByName?: string;
  createdAt?: string;
  status?: 'draft' | 'saved' | 'shared' | 'downloaded' | 'accepted' | 'converted' | 'expired' | 'cancelled' | QuoteStatus;
  proposalStatus?: 'draft' | 'saved' | 'shared' | 'downloaded' | 'accepted' | 'converted' | 'expired' | 'cancelled';
  changesSummary: string;
  title?: string;
  destination?: string;
  travelStartDate?: string;
  travelEndDate?: string;
  totalPax?: number;
  adultsCount?: number;
  childrenCount?: number;
  infantsCount?: number;
  currency?: CurrencyCode;
  totalNetCost?: number;
  totalSellingPrice: number;
  marginPercent?: number;
  marginAmount?: number;
  items?: QuoteItem[];
  pricingSnapshot?: PricingSnapshot;
  passengerBreakdown?: any;
  roomingConfig?: any;
  agentNotes?: string;
  termsAndConditions?: string;
  bookingId?: string;
  bookingReference?: string;
  sharedHistory?: {
    type: 'WHATSAPP' | 'EMAIL' | 'DOWNLOAD';
    recipient?: string;
    timestamp: string;
  }[];
}

export type AgentMarginType = 'PERCENTAGE' | 'FIXED';

export interface PricingSnapshot {
  baseFinalSellingPrice: number;
  currency: CurrencyCode;
  agentMarginType: AgentMarginType;
  agentMarginValue: number;
  agentMarginAmount: number;
  finalCustomerSellingPrice: number;
  calculatedAt: string;
  pricingVersion: number | string;
  itemsCount: number;
  totalPax: number;
  categoryBreakdown?: {
    hotels: number;
    activities: number;
    transfers: number;
    visas: number;
    others: number;
  };
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
    | 'WHATSAPP_SHARED'
    | 'CONVERTED';
  timestamp: string;
  userName: string;
  userRole?: string;
  userType?: 'ADMIN' | 'TEAM_MEMBER' | 'B2B_AGENT' | 'DMC_STAFF' | 'BUYER' | 'PUBLIC';
  details: string;

  // Audit Fields (Section 13 Compliance)
  quoteId?: string;
  quote_id?: string;
  leadId?: string;
  lead_id?: string;
  bookingId?: string;
  booking_id?: string;
  userId?: string;
  user_id?: string;
  action_type?: string;
  previousMarginType?: AgentMarginType;
  previous_margin_type?: AgentMarginType;
  previousMarginValue?: number;
  previous_margin_value?: number;
  newMarginType?: AgentMarginType;
  new_margin_type?: AgentMarginType;
  newMarginValue?: number;
  new_margin_value?: number;
  previousFinalCustomerSellingPrice?: number;
  previous_final_customer_selling_price?: number;
  newFinalCustomerSellingPrice?: number;
  new_final_customer_selling_price?: number;
  pricingVersion?: number | string;
  pricing_version?: number | string;
}

export interface Quotation {
  id: string;
  quoteId?: string;
  quoteNumber: string;
  version?: number;
  versionNumber?: number;
  parentQuoteId?: string;
  previousVersionId?: string;
  isLatestVersion?: boolean;
  isLocked?: boolean;
  leadId?: string;
  linkedLeadId?: string;
  customerId?: string;
  bookingId?: string;
  bookingReference?: string;
  linkedBookingIds?: string[];
  proposalStatus?: 'draft' | 'saved' | 'shared' | 'downloaded' | 'accepted' | 'converted' | 'expired' | 'cancelled';
  pricingSnapshotId?: string;
  
  // Ownership & Creation Attribution
  createdBy?: string;
  createdByName?: string;
  createdByUserType?: 'ADMIN' | 'TEAM_MEMBER' | 'B2B_AGENT' | 'DMC_STAFF' | 'BUYER' | 'PUBLIC';
  createdByAgentId?: string;
  assignedTeamMemberId?: string;
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
  lastSharedViaWhatsAppAt?: string;
  lastSharedRecipientPhone?: string;
  validUntil: string;
  
  // Aggregated totals
  totalNetCost: number;
  totalSellingPrice: number;
  totalTaxes: number;
  totalMargin: number;

  // Authoritative Commercial & Agent Margin Architecture (Section 8 Compliance)
  baseFinalSellingPrice?: number;
  base_final_selling_price?: number;
  baseFinalSellingPriceCurrency?: CurrencyCode;
  base_final_selling_price_currency?: CurrencyCode;
  agentMarginType?: AgentMarginType;
  agent_margin_type?: AgentMarginType;
  agentMarginValue?: number;
  agent_margin_value?: number;
  agentMarginAmount?: number;
  agent_margin_amount?: number;
  finalCustomerSellingPrice?: number;
  final_customer_selling_price?: number;
  pricingCalculatedAt?: string;
  pricing_calculated_at?: string;
  pricingVersion?: number | string;
  pricing_version?: number | string;
  pricingSnapshot?: PricingSnapshot;
  pricing_snapshot?: PricingSnapshot;
  totalGroundLogisticsSnapshot?: number;
  transactionCurrencySnapshot?: CurrencyCode;
  pricingVersionSnapshot?: number | string;
  updatedBy?: string;
  updated_by?: string;

  // Protected Internal Commercial Fields (CMS/Admin Only)
  internalNettCost?: number;
  internalMarkup?: number;
  agentMarkup?: number;
  internalProfit?: number;
  supplierCost?: number;
  rateSnapshot?: any;
  commercialNotes?: string;
}

/**
 * Sanitized Quotation DTO for B2B Agents
 * STRICT GUARANTEE: Never exposes internal nett costs, supplier margins, or commercial markups.
 */
export interface AgentQuotationResponse {
  id: string;
  quoteNumber: string;
  version?: number;
  parentQuoteId?: string;
  isLocked?: boolean;
  leadId?: string;

  // Agent Details
  agentId: string;
  agentName: string;
  agentEmail?: string;
  agentAgency?: string;
  agentCompany?: string;
  agentLogoUrl?: string;
  agentPhone?: string;

  // Client Details
  clientUserId?: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientCompany?: string;

  // Itinerary
  title: string;
  destination: string;
  currency: CurrencyCode;
  items: QuoteItem[];
  overallDiscountPercent: number;
  agentNotes: string;
  termsAndConditions: string;
  status: QuoteStatus;
  travelStartDate?: string;
  travelEndDate?: string;
  totalPax?: number;
  adultsCount?: number;
  childrenCount?: number;
  infantsCount?: number;
  options?: QuotationOption[];
  activeOptionId?: string;
  routeHubs?: TripRouteHub[];
  dayThemes?: Record<number, string>;
  createdAt: string;
  updatedAt: string;
  validUntil: string;

  // Authoritative Agent-Facing Commercial Fields (Section 5 & 8 Compliance)
  baseFinalSellingPrice?: number;
  base_final_selling_price?: number;
  baseFinalSellingPriceCurrency?: CurrencyCode;
  base_final_selling_price_currency?: CurrencyCode;
  agentMarginType?: AgentMarginType;
  agent_margin_type?: AgentMarginType;
  agentMarginValue?: number;
  agent_margin_value?: number;
  agentMarginAmount?: number;
  agent_margin_amount?: number;
  finalCustomerSellingPrice?: number;
  final_customer_selling_price?: number;
  pricingCalculatedAt?: string;
  pricing_calculated_at?: string;
  pricingVersion?: number | string;
  pricing_version?: number | string;
  pricingSnapshot?: PricingSnapshot;
  pricing_snapshot?: PricingSnapshot;

  // Customer-Facing Totals ONLY
  totalSellingPrice: number;
  totalTaxes: number;
}

// ----------------------------------------------------
// BOOKINGS & RESERVATIONS SYSTEM
// ----------------------------------------------------
export type BookingStatus = 
  | 'DRAFT'
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
  | 'FAILED'
  | 'UNPAID';

export type BookingDocumentStatus = 'DOCUMENTS_COMPLETE' | 'DOCUMENTS_PENDING';

export type BookingSupplierStatus = 
  | 'PENDING' 
  | 'REQUESTED' 
  | 'PARTIALLY_CONFIRMED' 
  | 'CONFIRMED' 
  | 'REJECTED' 
  | 'ALTERNATIVE_REQUIRED' 
  | 'CANCELLED';

export type BookingSourceType = 'QUOTATION' | 'PRODUCT_DIRECT' | 'PACKAGE' | 'B2B_PORTAL' | 'MANUAL' | 'INTERNAL_MANUAL';

export interface BookingCustomerInfo {
  leadTravelerName: string;
  bookerName?: string;
  name?: string;
  email: string;
  phone: string;
  agencyName?: string;
  agentRefNumber?: string;
  specialRequests?: string;
  flightDetails?: string;
  pickupLocation?: string;
  dropoffLocation?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  nationality?: string;
  adults?: number;
  children?: number;
  infants?: number;
  totalAdults?: number;
  totalChildren?: number;
  totalInfants?: number;
  totalPax?: number;
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

export type SupplierPriceType = 
  | 'Per Person'
  | 'Per Vehicle'
  | 'Per Room'
  | 'Per Service'
  | 'Per Group'
  | 'Per Night'
  | 'Per Ticket'
  | 'Per Yacht'
  | 'Total Service Price'
  | 'Per Passenger'
  | 'Per Unit';

export type SupplierAllocationStatus = 
  | 'Not Allocated'
  | 'Allocation Pending'
  | 'Allocated'
  | 'Supplier Changed'
  | 'Supplier Reconfirmation Required'
  | 'Supplier Cancelled';

export type ServiceItemConfirmationStatus = 
  | 'Not Confirmed'
  | 'Confirmation Requested'
  | 'Confirmation Pending'
  | 'Confirmed'
  | 'Reconfirmation Required'
  | 'Cancelled'
  | 'Not Processed'
  | 'Supplier Not Allocated'
  | 'Price Pending'
  | 'Supplier Reconfirmation Required';

export type ServiceItemOperationalStatus = 
  | 'Not Processed'
  | 'Processing'
  | 'Supplier Not Allocated'
  | 'Price Pending'
  | 'Confirmation Pending'
  | 'Confirmed'
  | 'Supplier Reconfirmation Required'
  | 'Cancelled'
  | 'Completed'
  | 'Not Started'
  | 'Allocation Pending'
  | 'In Progress';

export type ServiceItemVoucherStatus = 
  | 'Not Ready'
  | 'Ready to Generate'
  | 'Generated'
  | 'Outdated'
  | 'Reissued';

export type ServiceItemInvoiceStatus = 
  | 'Not Uploaded'
  | 'Uploaded'
  | 'Verified'
  | 'Replaced'
  | 'Archived';

export interface SupplierPriceHistoryEntry {
  previousPrice?: number;
  newPrice: number;
  currency: CurrencyCode;
  priceType: SupplierPriceType;
  changeReason?: string;
  updatedBy: string;
  updatedByName?: string;
  updatedAt: string;
  version: number;
}

export type UploadedInvoiceType = 
  | 'Supplier Invoice'
  | 'Proforma Invoice'
  | 'Tax Invoice'
  | 'Commercial Invoice'
  | 'Other authorised invoice type';

export type InvoiceAssociationType = 
  | 'BOOKING'
  | 'SERVICE_ITEM'
  | 'SUPPLIER'
  | 'PAYMENT';

export interface BookingUploadedInvoice {
  id: string;
  invoiceId: string;
  bookingId: string;
  bookingReference: string;
  bookingItemId?: string;
  serviceItemName?: string;
  supplierId?: string;
  supplierName?: string;
  associationType: InvoiceAssociationType;
  invoiceType: UploadedInvoiceType;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  currency: CurrencyCode;
  amount: number;
  uploadedFile?: string;
  uploadedFileName: string;
  fileSize?: string;
  mimeType?: string;
  storagePath?: string;
  uploadedBy: string;
  uploadedByName?: string;
  uploadedAt: string;
  status: 'ACTIVE' | 'VERIFIED' | 'REPLACED' | 'ARCHIVED';
  notes?: string;
  history?: {
    action: 'UPLOAD' | 'REPLACE' | 'ARCHIVE' | 'NOTE_ADDED' | 'STATUS_CHANGE';
    timestamp: string;
    actor: string;
    note?: string;
    previousFile?: string;
  }[];
}

export type BookingActivityEventType = 
  | 'BOOKING_CREATED'
  | 'SERVICE_ITEM_CREATED'
  | 'SERVICE_ITEM_ADDED'
  | 'SERVICE_ITEM_EDITED'
  | 'SERVICE_ITEM_REMOVED'
  | 'SERVICE_ITEM_CANCELLED'
  | 'SERVICE_ITEM_RESTORED'
  | 'SUPPLIER_ALLOCATED'
  | 'SUPPLIER_CHANGED'
  | 'SUPPLIER_PRICE_ADDED'
  | 'SUPPLIER_PRICE_EDITED'
  | 'SUPPLIER_PRICE_CHANGE_REASON_ADDED'
  | 'SUPPLIER_CONFIRMATION_REQUESTED'
  | 'SUPPLIER_CONFIRMATION_RECEIVED'
  | 'SERVICE_ITEM_CONFIRMED'
  | 'SERVICE_ITEM_RECONFIRMATION_REQUIRED'
  | 'CONFIRMATION_OVERRIDDEN'
  | 'VOUCHER_ELIGIBILITY_REACHED'
  | 'VOUCHER_GENERATED'
  | 'VOUCHER_DOWNLOADED'
  | 'VOUCHER_REGENERATED'
  | 'INVOICE_UPLOADED'
  | 'INVOICE_REPLACED'
  | 'INVOICE_ARCHIVED'
  | 'INVOICE_DOWNLOADED'
  | 'INVOICE_GENERATED'
  | 'VOUCHER_DISPATCHED'
  | 'PAYMENT_RECORDED'
  | 'STATUS_UPDATED'
  | 'BOOKING_STATUS_CHANGED'
  | 'OTHER';

export interface BookingActivityTimelineEvent {
  eventId: string;
  bookingId: string;
  bookingItemId?: string;
  serviceItemName?: string;
  supplierId?: string;
  supplierName?: string;
  eventType: BookingActivityEventType;
  previousValue?: any;
  newValue?: any;
  actorId: string;
  actorRole: string;
  actorName?: string;
  timestamp: string;
  relatedDocumentId?: string;
  relatedVoucherId?: string;
  metadata?: Record<string, any>;
  description?: string;
}

export interface BookingItem {
  id: string;
  bookingId?: string;
  productId: string;
  productName: string;
  title?: string;
  sku?: string;
  productSku?: string;
  vehicle?: string;
  destinationName?: string;
  destination?: string;
  city?: string;
  hub?: string;
  category: string;
  travelDate: string;
  adults: number;
  children: number;
  infants: number;
  totalPax: number;
  passengerDetails?: string;
  assignedTeamMember?: string;
  assignedTeamMemberId?: string;
  selectedAddonNames?: string[];
  unitNetPrice?: number;
  unitSellingPrice: number;
  totalPrice: number;
  currency: CurrencyCode;
  supplierId?: string;
  supplierName?: string;
  supplierNameSnapshot?: string;
  supplierType?: 'HOTEL' | 'TRANSPORT' | 'GUIDE' | 'ACTIVITY' | 'DMC_PARTNER' | 'RESTAURANT' | 'TICKET_PARTNER' | 'GROUND_RESOURCE';
  supplierContact?: string;
  supplierPhone?: string;
  supplierEmail?: string;
  supplierStatus?: 'PENDING_DISPATCH' | 'SENT_TO_SUPPLIER' | 'WAITING_FOR_SUPPLIER' | 'CONFIRMED_BY_SUPPLIER' | 'REJECTED_BY_SUPPLIER' | 'ALTERNATIVE_REQUIRED' | 'AMENDMENT_REQUESTED' | 'CANCELLED';
  supplierConfirmationRef?: string;
  supplierAllocationStatus?: SupplierAllocationStatus;
  supplierAllocatedAt?: string;
  supplierAllocatedBy?: string;
  paymentCutoffDate?: string;
  serviceDate?: string;
  serviceTime?: string;
  serviceTimezone?: string;
  supplierNotes?: string;
  internalOpsNotes?: string;
  internalNotes?: string;

  // Authoritative Supplier Price (Separate from Customer Selling Price / Margin)
  supplierPrice?: number;
  supplierCurrency?: CurrencyCode;
  supplierPriceType?: SupplierPriceType;
  supplierAdultPrice?: number;
  supplierChildPrice?: number;
  supplierInfantPrice?: number;
  supplierQuantity?: number;
  supplierTaxAmount?: number;
  supplierAdditionalFees?: number;
  supplierDiscount?: number;
  supplierTotalCost?: number;
  supplierPricingNotes?: string;
  supplierPriceLastUpdatedAt?: string;
  supplierPriceLastUpdatedBy?: string;
  supplierPriceChangeReason?: string;
  supplierPriceVersion?: number;
  supplierPriceHistory?: SupplierPriceHistoryEntry[];

  // Connected Operational & Workflow Statuses
  isManualServiceItem?: boolean;
  customerFacingNotes?: string;
  operationalInstructions?: string;
  passengerAssignment?: string[];
  supplierPriceTax?: number;
  supplierPriceFee?: number;
  supplierPriceDiscount?: number;
  supplierPaymentCutoffDate?: string;
  supplierCancellationDeadline?: string;
  supplierPriceValidityDate?: string;
  supplierPriceSource?: string;
  internalPricingNotes?: string;
  quantity?: number;
  serviceEndDate?: string;
  duration?: string;
  configuration_id?: string;
  configuration_snapshot?: any;
  pricing_snapshot?: any;
  configurator_type?: string;
  isCancelled?: boolean;
  cancelledAt?: string;
  cancelledBy?: string;
  cancelReason?: string;

  supplierConfirmationStatus?: ServiceItemConfirmationStatus;
  operationalStatus?: ServiceItemOperationalStatus;
  voucherStatus?: ServiceItemVoucherStatus;
  invoiceStatus?: ServiceItemInvoiceStatus;
  pickupLocation?: string;
  dropoffLocation?: string;
  cityHub?: string;
  confirmedAt?: string;
  confirmedBy?: string;
  confirmedByName?: string;
  reconfirmationReason?: string;

  accommodationType?: AccommodationType;
  isManualHotel?: boolean;
  manualHotelDetails?: ManualHotelDetails;
  
  // Independent Upsell Service Item Relationships (Section 19-21)
  parentBookingItemId?: string; // Links upsell service item to parent booking item
  parentProductId?: string; // Master Product ID of parent product
  upsellRelationshipId?: string; // Authoritative relationship ID
  isUpsellServiceItem?: boolean; // Indicates if this booking item is an upsell child service
  upsellType?: 'EXISTING_PRODUCT' | 'STANDALONE';
  
  // Operational Workflow & Service Details
  workflowStage?: 
    | 'REQUESTED' 
    | 'SOURCING_REQUIRED' 
    | 'SUPPLIER_CONTACTED' 
    | 'SUPPLIER_RESPONSE_PENDING' 
    | 'OPTION_RECEIVED' 
    | 'AWAITING_APPROVAL' 
    | 'PAYMENT_REQUIRED' 
    | 'PAYMENT_SENT' 
    | 'CONFIRMED' 
    | 'VOUCHER_RECEIVED' 
    | 'VOUCHER_ISSUED' 
    | 'COMPLETED' 
    | 'CANCELLED';
  serviceFlightDetails?: {
    flightNumber?: string;
    airline?: string;
    pnr?: string;
    departureAirport?: string;
    arrivalAirport?: string;
    departureTime?: string;
    arrivalTime?: string;
    baggageAllowance?: string;
  };
  serviceHotelDetails?: {
    hotelName?: string;
    roomType?: string;
    mealPlan?: string;
    checkInDate?: string;
    checkOutDate?: string;
    confirmationNumber?: string;
    voucherCode?: string;
  };
  serviceVisaDetails?: {
    visaType?: string;
    country?: string;
    submissionDate?: string;
    appointmentDate?: string;
    biometricDate?: string;
    approvalStatus?: 'NOT_SUBMITTED' | 'SUBMITTED' | 'APPOINTMENT_BOOKED' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED';
    trackingNumber?: string;
  };
  serviceTransferDetails?: {
    pickupPoint?: string;
    dropoffPoint?: string;
    pickupTime?: string;
    vehicleType?: string;
    driverName?: string;
    driverPhone?: string;
    licensePlate?: string;
  };
  serviceSightseeingDetails?: {
    tourLanguage?: string;
    guideName?: string;
    guidePhone?: string;
    meetingPoint?: string;
    duration?: string;
    voucherCode?: string;
  };
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
  visaCopyUrl?: string;
  visaCopyName?: string;
  visaCopyUploadedAt?: string;
  documentVerificationStatus?: 'MISSING' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
  documentRejectionReason?: string;
  documentRejectionNotes?: string;
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
  type: 'CREATION' | 'PASSENGER' | 'DOCUMENT' | 'PAYMENT' | 'SUPPLIER' | 'STATUS_CHANGE' | 'COMMUNICATION' | 'SLA_REMINDER' | string;
  actorName?: string;
  actorRole?: string;
  performedBy?: string;
  metadata?: any;
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

export type BookingAssignmentStatus =
  | 'pending_agent_assignment'
  | 'pending_internal_assignment'
  | 'assigned'
  | 'reassigned';

export interface BookingAssignmentHistoryItem {
  id: string;
  timestamp: string;
  type: 'INITIAL_CREATION' | 'AGENT_ASSIGNMENT' | 'INTERNAL_TEAM_ASSIGNMENT' | 'REASSIGNMENT';
  previousAgentId?: string;
  previousAgentName?: string;
  newAgentId?: string;
  newAgentName?: string;
  previousTeamMemberId?: string;
  previousTeamMemberName?: string;
  newTeamMemberId?: string;
  newTeamMemberName?: string;
  assignedByUserId: string;
  assignedByUserNameSnapshot: string;
  assignedByUserRole?: string;
  reason?: string;
  notes?: string;
}

export interface Booking {
  // B2B Agent & Internal Team Member Mandatory Ownership Architecture
  bookingId?: string;
  source?: BookingSourceType | string;
  submittedByUserId?: string;
  submittedByUserRole?: UserRole | string;
  submittingAgentId?: string;
  submittingAgentNameSnapshot?: string;
  submittingAgentAgencySnapshot?: string;
  submittedAt?: string;

  agentId?: string;
  agentName?: string;
  b2bAgentId?: string;
  b2bAgentName?: string;
  agencyName?: string;
  agentNameSnapshot?: string;
  agentEmailSnapshot?: string;
  agentAgency?: string;
  agentAgencySnapshot?: string;

  assignedAgentId?: string;
  assignedAgentNameSnapshot?: string;
  assignedAgentAgencySnapshot?: string;

  assignedTeamMemberId?: string;
  assignedTeamMemberName?: string;
  operationalOwnerName?: string;
  assignedTeamMemberNameSnapshot?: string;
  assignedTeamMemberEmailSnapshot?: string;
  hubName?: string;
  isDeleted?: boolean;

  assignmentStatus?: BookingAssignmentStatus;
  assignedAt?: string;
  assignedByUserId?: string;
  assignedByUserNameSnapshot?: string;

  lastReassignedAt?: string;
  lastReassignedByUserId?: string;
  lastReassignedByUserNameSnapshot?: string;

  assignmentNotes?: string;
  assignmentHistory?: BookingAssignmentHistoryItem[];

  agentVisibilityStatus?: 'VISIBLE' | 'HIDDEN' | 'PENDING_ASSIGNMENT';
  linkedLeadId?: string;
  linkedQuoteId?: string;
  customerId?: string;

  id: string;
  bookingReference: string; // e.g. TUB-BK-2026-8492
  sourceType: BookingSourceType;
  destination?: string;
  destinationName?: string;
  userId?: string;
  userRole?: UserRole;
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
  
  // Customer-Facing 15-Stage Workflow & Tracking
  customerProgressStage?: BookingProgressStage;
  customerProgressHistory?: BookingProgressHistoryItem[];
  trackingToken?: string; // Secure token for guest/buyer tracking lookup

  // CRM & Agency Linkage
  leadId?: string;
  leadNumber?: string;
  agencyId?: string;
  quoteId?: string;
  quoteNumber?: string;
  sourceQuoteId?: string;
  sourceQuoteVersionId?: string;
  bookingVersionNumber?: number;
  voucherIds?: string[];
  completeVoucherId?: string;
  completeBookingVoucherId?: string;
  activityVoucherIds?: string[];
  proformaInvoiceIds?: string[];
  activeProformaInvoiceId?: string;
  paymentIds?: string[];
  taskIds?: string[];
  documentIds?: string[];

  // Operational & Desk Specific Fields
  isInternalManualBooking?: boolean;
  manualBookingReference?: string;
  operationalProcessingStatus?: ServiceItemOperationalStatus;
  operationalConfirmationOverride?: {
    overridden: boolean;
    reason: string;
    overriddenBy: string;
    overriddenAt: string;
  };

  // Supplier Requests & Sourcing
  supplierRequests?: SupplierRequest[];

  // Financial & Profitability Tracking
  paymentSchedule?: PaymentSchedule;
  excessPaymentAmount?: number;
  pendingPaymentAmount?: number;
  grossProfit?: number;
  grossMarginPercent?: number;
  supplierTotalCost?: number;
  
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
  
  // Financial Invoices & Service Vouchers (Connected Booking Operations)
  proformaInvoiceUrl?: string;
  taxInvoiceUrl?: string;
  voucherUrl?: string;
  uploadedInvoices?: BookingUploadedInvoice[];
  vouchersList?: BookingVoucher[];
  serviceItemActivities?: BookingActivityTimelineEvent[];
  
  createdAt: string;
  updatedAt: string;
  confirmationNotice?: string; // "Your booking has been submitted and will be updated in 24-48 Hrs."
  notificationEmailsSent?: SentEmailRecord[];

  // Protected Internal Commercial Fields (CMS/Admin Only)
  internalNettCost?: number;
  internalMarkup?: number;
  agentMarkup?: number;
  internalProfit?: number;
  supplierCost?: number;
  rateSnapshot?: any;
  pricingVersion?: number | string;
  commercialNotes?: string;

  // Authoritative Commercial & Agent Margin Architecture
  baseFinalSellingPrice?: number;
  base_final_selling_price?: number;
  agentMarginType?: AgentMarginType;
  agent_margin_type?: AgentMarginType;
  agentMarginValue?: number;
  agent_margin_value?: number;
  agentMarginAmount?: number;
  agent_margin_amount?: number;
  finalCustomerSellingPrice?: number;
  final_customer_selling_price?: number;
  pricingSnapshot?: PricingSnapshot;
  pricing_snapshot?: PricingSnapshot;
}

/**
 * Sanitized Booking Response DTO for B2B Agents
 * STRICT GUARANTEE: Never exposes internal supplier cost, net prices, or gross profit.
 */
export interface AgentBookingResponse {
  id: string;
  bookingId: string;
  bookingReference: string;
  sourceType: BookingSourceType;
  source: string;
  submittingAgentId?: string;
  submittingAgentNameSnapshot?: string;
  submittingAgentAgencySnapshot?: string;
  submittedAt: string;
  destinationName?: string;
  customer: BookingCustomerInfo;
  items: BookingItem[]; // Sanitized items (without unitNetPrice, supplierPrice, etc.)
  passengers?: BookingPassenger[];
  currency: CurrencyCode;
  totalAmount: number; // ONLY final selling price
  travelStartDate: string;
  travelEndDate: string;
  status: BookingStatus;
  customerFacingStatus?: string;
  paymentStatus?: BookingPaymentStatus;
  documentStatus?: BookingDocumentStatus;
  missingDocuments?: string[];
  quoteId?: string;
  quoteNumber?: string;
  leadId?: string;
  timeline?: BookingTimelineEvent[];
  createdAt: string;
  updatedAt: string;
  confirmationNotice?: string;
  notificationEmailsSent?: SentEmailRecord[];
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

export interface MasterGoogleSheetConfig {
  masterSpreadsheetId: string;
  spreadsheetName: string;
  connectionStatus: 'CONNECTED' | 'DISCONNECTED' | 'AUTHENTICATION_REQUIRED' | 'CONFIG_ERROR' | 'UNCHECKED';
  authStatus: 'AUTHENTICATED' | 'TOKEN_EXPIRED' | 'NOT_AUTHENTICATED';
  lastSuccessfulConnectionCheck?: string;
  lastSuccessfulSync?: string;
  lastFailedSync?: string;
  syncStatus: 'IDLE' | 'SYNCING' | 'SUCCESS' | 'FAILED' | 'COMPLETED_WITH_WARNINGS';
  autoSyncEnabled?: boolean;
  syncSchedule?: string;
  syncKey?: string;
  updatedAt?: string;
  updatedBy?: string;
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
  seo?: EntitySEO;
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
  | 'USER_DELETED'
  | 'USER_ARCHIVED'
  | 'BOOKING_DELETED'
  | 'TRANSFER_ROUTE_DELETED'
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
  | 'UNAUTHORIZED_WRITE_ATTEMPT'
  | 'SEO_REDIRECT_CREATED'
  | 'SEO_REDIRECT_UPDATED'
  | 'SEO_REDIRECT_DELETED'
  | 'SEO_SETTINGS_UPDATED'
  | 'SEO_METADATA_UPDATED'
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
  | 'QUOTE_WHATSAPP_SHARED'
  | 'WHATSAPP_QUOTE_SHARE_INITIATED'
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
  | 'SETTINGS_UPDATED'
  | 'LEAD_MOVED_KANBAN'
  | 'BULK_ACTION_PERFORMED';

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
  | 'Campaign'
  | 'User'
  | 'Booking'
  | 'TransferRoute';

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

// ====================================================
// ADMIN ACTIVITY CENTER & UNIFIED NOTIFICATIONS
// ====================================================

export type AdminActivityCategory = 
  | 'USER'
  | 'LEAD'
  | 'QUOTE'
  | 'AI_PLANNER'
  | 'BOOKING'
  | 'PAYMENT'
  | 'OPERATIONS'
  | 'PRODUCT'
  | 'DESTINATION'
  | 'SYSTEM';

export type AdminActivitySeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export type AdminActivityActorType = 
  | 'BUYER' 
  | 'B2B_AGENT' 
  | 'ADMIN' 
  | 'TEAM_MEMBER' 
  | 'AI_PLANNER' 
  | 'SYSTEM';

export type AdminActivityType =
  // User Activities
  | 'USER_REGISTERED'
  | 'USER_APPROVED'
  | 'USER_REJECTED'
  | 'USER_PROFILE_UPDATED'
  | 'USER_DISABLED'
  | 'USER_ENABLED'
  | 'B2B_AGENT_REGISTRATION'
  | 'BUYER_REGISTRATION'
  | 'USER_PERMISSIONS_CHANGED'
  // Lead Activities
  | 'LEAD_CREATED'
  | 'LEAD_STATUS_CHANGED'
  | 'LEAD_ASSIGNED'
  | 'LEAD_PRIORITY_CHANGED'
  | 'LEAD_CONVERTED'
  | 'LEAD_NOTE_ADDED'
  | 'LEAD_DELETED'
  // Quote Activities
  | 'QUOTE_CREATED'
  | 'QUOTE_SAVED'
  | 'QUOTE_UPDATED'
  | 'QUOTE_PDF_GENERATED'
  | 'QUOTE_PDF_DOWNLOADED'
  | 'QUOTE_EMAIL_SENT'
  | 'QUOTE_WHATSAPP_SHARED'
  | 'QUOTE_CONVERTED_TO_BOOKING'
  | 'QUOTE_EXPIRED'
  // AI Planner Activities
  | 'AI_PLANNER_OPENED'
  | 'AI_PLAN_GENERATED'
  | 'AI_PLAN_REGENERATED'
  | 'AI_OPTION_SELECTED'
  | 'AI_QUOTE_MODIFIED'
  | 'AI_QUOTE_SAVED'
  | 'AI_QUOTE_GENERATED'
  | 'AI_PLANNING_ERROR'
  // Booking Activities
  | 'BOOKING_SUBMITTED'
  | 'BOOKING_CREATED'
  | 'BOOKING_UPDATED'
  | 'BOOKING_CONFIRMED'
  | 'BOOKING_CANCELLED'
  | 'SUPPLIER_STATUS_UPDATED'
  | 'VOUCHER_GENERATED'
  | 'INVOICE_GENERATED'
  // Payment Activities
  | 'PAYMENT_INITIATED'
  | 'PAYMENT_RECEIVED'
  | 'PAYMENT_PROOF_UPLOADED'
  | 'PAYMENT_PROOF_VERIFIED'
  | 'PAYMENT_PROOF_REJECTED'
  | 'PAYMENT_OVERDUE'
  // Operations Activities
  | 'OPERATIONS_JOB_CREATED'
  | 'OPERATIONS_JOB_UPDATED'
  | 'OPERATIONS_JOB_ASSIGNED'
  | 'OPERATIONS_ROSTER_UPDATED'
  | 'OPERATIONS_NOTE_ADDED'
  | 'SLA_TASK_DUE'
  | 'SLA_BREACH_WARNING'
  // Product & Inventory Activities
  | 'PRODUCT_CREATED'
  | 'PRODUCT_UPDATED'
  | 'HOTEL_CREATED'
  | 'HOTEL_UPDATED'
  | 'RATE_UPDATED'
  | 'PACKAGE_CREATED'
  | 'PACKAGE_UPDATED'
  | 'VISAS_UPDATED'
  // Destination & Content Activities
  | 'DESTINATION_CREATED'
  | 'DESTINATION_UPDATED'
  | 'CITY_HUB_UPDATED'
  | 'PAGE_UPDATED'
  | 'MENU_UPDATED'
  | 'BLOG_PUBLISHED'
  | 'REVIEW_SYNCED'
  // System & Integration Activities
  | 'GOOGLE_SHEETS_SYNCED'
  | 'GMAIL_SENT'
  | 'CALENDAR_SYNCED'
  | 'INTEGRATION_ERROR'
  | 'FIRESTORE_HEALTH_ALERT'
  | 'SECURITY_AUDIT_LOGGED';

export interface AdminActivityRecord {
  activityId: string;
  activityType: AdminActivityType;
  category: AdminActivityCategory;
  actorId?: string;
  actorType?: AdminActivityActorType;
  actorName: string;
  timestamp: string; // ISO 8601 string
  
  // Reference IDs
  leadId?: string;
  quoteId?: string;
  bookingId?: string;
  bookingReference?: string;
  customerId?: string;
  destinationId?: string;
  hubId?: string;
  productId?: string;
  hotelId?: string;
  userId?: string;
  
  entityType: string;
  entityId: string;
  summary: string;
  details: {
    customerName?: string;
    agentName?: string;
    destinationName?: string;
    travelDates?: string;
    totalAmount?: number;
    currency?: string;
    previousValue?: string;
    newValue?: string;
    itemType?: string;
    reason?: string;
    actionNeeded?: string;
    [key: string]: any;
  };
  severity: AdminActivitySeverity;
  actionRequired: boolean;
  actionLabel?: string;
  read: boolean;
  readAt?: string;
  readBy?: string;
  
  // Deep Linking Target Destination
  targetRoute?: string;
  targetSection: string;
  targetSubTab?: string;
  recordId?: string;
  
  createdAt: string;
}

export interface AdminActivityFilter {
  category?: AdminActivityCategory | 'ALL';
  severity?: AdminActivitySeverity | 'ALL';
  actionRequiredOnly?: boolean;
  unreadOnly?: boolean;
  dateRange?: 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'ALL_TIME';
  searchQuery?: string;
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
  | 'INSTRUCTIONS'
  | 'MASTER_DATA'
  | 'PRODUCTS'
  | 'HOTELS'
  | 'VISA_ANCILLARY'
  | 'RAIL'
  | 'PACKAGES'
  | 'REGIONS'
  | 'DESTINATIONS'
  | 'HUBS'
  | 'PRODUCT_PRICING'
  | 'PRODUCT_CAPACITY'
  | 'HOTEL_ROOMS'
  | 'HOTEL_MEAL_PLANS'
  | 'HOTEL_RATES'
  | 'VISA'
  | 'VISA_RATES'
  | 'TRAVEL_PROTECTION'
  | 'VIP_GROUND'
  | 'CONNECTIVITY'
  | 'TRANSFER_ROUTES'
  | 'TRANSFER_RATES'
  | 'PACKAGE_ITEMS'
  | 'FX_RATES'
  | 'RAIL_STATIONS'
  | 'RAIL_SERVICES'
  | 'RAIL_ROUTES'
  | 'RAIL_FARES'
  | 'RAIL_CLASS_RULES';

export type DynamicModulePresetId = 
  | 'all_canonical' 
  | 'products_catalog' 
  | 'hotels_allotments' 
  | 'visa_ancillaries' 
  | 'japan_rail_dynamic';

export interface DynamicWorkbookInspectionReport {
  presetId: DynamicModulePresetId;
  presetName: string;
  schemaVersion: string;
  isValid: boolean;
  requiredTabs: string[];
  foundTabs: string[];
  missingTabs: string[];
  unexpectedTabs: string[];
  matchedSchemas: {
    schemaId: string;
    canonicalTabName: string;
    matchedSheetName: string;
    totalRows: number;
    discoveredColumns: string[];
    missingRequiredColumns: string[];
    unexpectedColumns: string[];
    status: 'READY' | 'WARNING' | 'BLOCKED';
  }[];
  errorMessage?: string;
}

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
    orphanRailStations?: number;
    orphanRailRoutes?: number;
    orphanRailFares?: number;
    orphanRailServices?: number;
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
  presetId?: DynamicModulePresetId;
  presetName?: string;
  syncMode: 'FULL_SYNC' | 'SELECTED_TABS' | 'INCREMENTAL' | 'PRESET_SYNC';
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
  supplierNett?: number;
  currency?: CurrencyCode;
  nativeCurrency?: CurrencyCode;
  category?: string;
  fleetId?: string;
  minPassengers?: number;
  maxPassengers?: number;
  vehicleCount?: number;
  margin?: number;
  tax?: number;
  serviceCharge?: number;
  finalPrice?: number;
  effectiveFrom?: string;
  effectiveTo?: string;
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
  hotel_id?: string;
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
  slug?: string;
  seo?: EntitySEO;
}

// ----------------------------------------------------
// DESTINATION CITIES / HUBS & DESTINATION FAQS
// ----------------------------------------------------
export interface CityHub {
  id: string;
  hub_id?: string;
  airportCode?: string;
  railwayStation?: string;
  latitude?: number;
  longitude?: number;
  destinationId: string;
  destinationName: string;
  regionId?: string;
  regionName?: string;
  name: string;
  slug?: string;
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
  seo?: EntitySEO;
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

// ----------------------------------------------------
// UNIVERSAL HERO ARCHITECTURE (CMS-DRIVEN & MULTI-CONTEXT)
// ----------------------------------------------------
export type HeroContextType = 'HOMEPAGE' | 'DESTINATION' | 'CAMPAIGN' | 'CUSTOM';
export type HeroOverlayIntensity = 'none' | 'light' | 'medium' | 'strong' | 'custom';
export type HeroFocalPoint = 'center' | 'top' | 'bottom' | 'left' | 'right';

export interface HeroMediaConfig {
  desktopImageUrl?: string;
  tabletImageUrl?: string;
  mobileImageUrl?: string;
  videoUrl?: string;
  mobileVideoUrl?: string;
  posterImageUrl?: string;
  altText?: string;
  focalPoint?: HeroFocalPoint;
  overlayIntensity?: HeroOverlayIntensity;
  overlayOpacity?: number; // 0.0 to 1.0, e.g. 0.65
  enableAmbientGrid?: boolean;
}

export interface HeroCtaConfig {
  showPrimaryCta?: boolean;
  primaryCtaText?: string;
  primaryCtaAction?: 'EXPLORE_PRODUCTS' | 'DESTINATION_FILTER' | 'QUOTE_BUILDER' | 'AI_PLANNER' | 'CUSTOM';
  primaryCtaLink?: string;
  showSecondaryCta?: boolean;
  secondaryCtaText?: string;
  secondaryCtaAction?: 'EXPLORE_PRODUCTS' | 'DESTINATION_FILTER' | 'QUOTE_BUILDER' | 'AI_PLANNER' | 'CUSTOM';
  secondaryCtaLink?: string;
}

export interface HeroDiscoveryFieldConfig {
  showDestination?: boolean;
  showHub?: boolean;
  showDates?: boolean;
  showTravelers?: boolean;
  showTravelStyle?: boolean;
  showProductType?: boolean;
  showAiPlannerShortcut?: boolean;
  ctaText?: string;
  defaultTravelStyle?: string;
}

export interface HeroTrustItem {
  id?: string;
  title: string;
  description: string;
  icon?: string;
  link?: string;
}

export interface HeroPromotionConfig {
  enabled?: boolean;
  mode?: 'AUTO_PRIORITY' | 'MANUAL';
  manualPromotionId?: string;
  customBadge?: string;
}

export interface UniversalHeroConfig {
  id?: string;
  context?: HeroContextType;
  // Core Copy
  eyebrowText?: string;
  heading?: string;
  headingHighlight?: string; // Highlighted portion in accent color
  subheading?: string;
  
  // Media & Visuals
  media?: HeroMediaConfig;
  
  // Three Pillars & Trust
  showPillars?: boolean;
  pillar1Title?: string;
  pillar1Subtitle?: string;
  pillar2Title?: string;
  pillar2Subtitle?: string;
  pillar3Title?: string;
  pillar3Subtitle?: string;
  
  // CTAs
  ctas?: HeroCtaConfig;
  
  // Search & Discovery Panel
  showDiscoveryPanel?: boolean;
  discoveryPanelConfig?: HeroDiscoveryFieldConfig;
  
  // Promotion Integration
  promotion?: HeroPromotionConfig;
  
  // Trust / Value Strip
  showTrustStrip?: boolean;
  trustItems?: HeroTrustItem[];
  
  // AI Quick Banner
  showAiQuickBanner?: boolean;
  aiQuickBannerText?: string;
  aiQuickBannerSubtext?: string;
  
  // Status & Scheduling
  status?: 'DRAFT' | 'PUBLISHED' | 'SCHEDULED' | 'EXPIRED';
  publishedAt?: string;
  scheduledAt?: string;
  expiresAt?: string;
}

export interface HeroSearchParams {
  destinationId?: string;
  destinationSlug?: string;
  destinationName?: string;
  hubId?: string;
  hubName?: string;
  startDate?: string;
  endDate?: string;
  durationDays?: number;
  travelers: PassengerClassification;
  travelStyle?: string;
  productType?: string;
}

export interface HomepageHubConfigItem {
  hubId: string; // References authoritative CityHub.id in Firestore 'city_hubs'
  enabled: boolean;
  displayOrder: number;
  featured?: boolean;
  badge?: string; // e.g. "Direct Operations Desk", "Key Gateway", "Fleet Dispatch"
  titleOverride?: string; // Optional homepage title override
  descriptionOverride?: string; // Optional short description override
  imageOverride?: string; // Optional hub image override
  destinationIdOverride?: string; // Optional destination link override
  customUrl?: string; // Optional custom destination link URL / route
  ctaLabel?: string; // Optional custom CTA label
  ctaAction?: string; // Optional custom CTA action / route
  inventoryCountOverride?: {
    totalProducts?: number;
    hotels?: number;
  };
}

export interface HomepageAffiliation {
  id: string; // 'aff-jata', 'aff-msme', 'aff-nidhi'
  name: string; // 'JATA', 'MSME', 'NIDHI'
  fullName: string;
  type: string;
  logo?: string;
  description: string;
  verificationReference?: string;
  officialLink: string;
  displayOrder: number;
  isActive: boolean;
}

export interface HomepageNewsletterConfig {
  enabled: boolean;
  eyebrow?: string;
  heading?: string;
  description?: string;
  emailPlaceholder?: string;
  buttonText?: string;
  privacyText?: string;
  successHeading?: string;
  successDescription?: string;
  alreadySubscribedMessage?: string;
  errorMessage?: string;
  sendyListId?: string;
}

export interface HomepageConfig {
  heroHeading: string;
  heroSubheading: string;
  heroBadgeText: string;
  heroImage: string;
  heroMobileImage?: string;
  heroImageAlt?: string;
  heroOverlayOpacity?: number; // 0.0 to 1.0, default 0.65
  primaryCtaText?: string;
  primaryCtaAction?: string;
  showPrimaryCta?: boolean;
  secondaryCtaText?: string;
  secondaryCtaAction?: string;
  showSecondaryCta?: boolean;
  heroTrustBadges?: HeroTrustBadge[];
  heroSellingPoints?: string[];
  heroConfig?: UniversalHeroConfig;
  featuredDestinationIds: string[];
  destinationOrdering: string[];
  
  // Homepage Hubs CMS Fields (Authoritative Firestore Hub references)
  homepageHubs?: HomepageHubConfigItem[];
  hubSectionTitle?: string;
  hubSectionSubtitle?: string;
  hubSectionBadge?: string;
  hubGridColumns?: number; // 2, 3, or 4

  // Hero Section Customization Fields (Directly connected to BuyerHeroSection)
  heroHighlightText?: string;
  heroStatusBadgeText?: string;
  heroTradeBadgeText?: string;
  heroVisualPanelTitle?: string;
  heroVisualPanelDescription?: string;
  heroVisualMaxHeight?: number; // Safe limit 300-480px
  heroVideoUrl?: string;
  showHeroPillars?: boolean;
  pillar1Title?: string;
  pillar1Subtitle?: string;
  pillar2Title?: string;
  pillar2Subtitle?: string;
  pillar3Title?: string;
  pillar3Subtitle?: string;
  showHeroGateways?: boolean;
  heroOperationalHighlights?: string[];
  heroQuickStats?: Array<{ label: string; value: string; sublabel?: string }>;

  // Module Display Order (Controls the live homepage section sequence)
  homepageModuleOrder?: string[];

  // Section / Module Visibility Toggles (The 9 live modules on the homepage)
  showHeroSection: boolean;
  showBrandIntroduction?: boolean;
  brandIntroductionBadge?: string;
  brandIntroductionTitle?: string;
  brandIntroductionSubtitle?: string;
  showDestinationFilter: boolean;
  destinationSectionBadge?: string;
  destinationSectionTitle?: string;
  destinationSectionSubtitle?: string;
  showCityHubs: boolean;
  showPartnershipBenefits?: boolean;
  partnershipBenefitsBadge?: string;
  partnershipBenefitsTitle?: string;
  partnershipBenefitsSubtitle?: string;
  showOnboardingProcess?: boolean;
  onboardingProcessBadge?: string;
  onboardingProcessTitle?: string;
  onboardingProcessSubtitle?: string;
  showAffiliationsSection?: boolean;
  affiliationsSectionBadge?: string;
  affiliationsSectionTitle?: string;
  affiliationsSectionSubtitle?: string;
  affiliations?: HomepageAffiliation[];
  showGoogleReviews: boolean;
  showHomepageFAQs: boolean;
  showConversionCTA: boolean;
  showNewsletterSection?: boolean;
  showHotelsSection?: boolean;
  showRailSection?: boolean;
  showExperiencesSection?: boolean;
  showPackagesSection?: boolean;
  showVisaSection?: boolean;
  newsletterConfig?: HomepageNewsletterConfig;
  tradeContactEmail?: string;

  // Grid Layout Controls (Supported on the live homepage)
  destinationGridColumns: number; // 2, 3, or 4

  // Homepage FAQs (distinct from destination-specific FAQs)
  homepageFAQs: HomepageFAQItem[];

  // Call to Action Banner
  ctaTitle: string;
  ctaSubtitle: string;
  ctaButtonText: string;
  ctaButtonLink: string;

  // Concurrency & Metadata
  version?: number;
  updatedAt?: string;
  updatedBy?: string;
  homepageSections?: Record<string, { sequence: number; active: boolean; updatedAt?: string; updatedBy?: string }>;

  // Legacy fields kept optional for non-destructive Firestore compatibility
  showCategoryFilters?: boolean;
  showProductGrid?: boolean;
  showHappyCustomerGallery?: boolean;
  showPromotionsBanner?: boolean;
  productGridColumns?: number;
  happyCustomerGalleryRows?: number;
  happyCustomerGalleryCols?: number;
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
  | 'BOOKED'
  | 'CONFIRMED' 
  | 'COMPLETED' 
  | 'WON' 
  | 'LOST' 
  | 'ARCHIVED';

export type LeadPipelineStageId = 
  | 'NEW_ENQUIRY'
  | 'CONTACTED'
  | 'QUALIFICATION_REQUIRED'
  | 'REQUIREMENTS_COLLECTED'
  | 'PLANNING_IN_PROGRESS'
  | 'QUOTE_DRAFTED'
  | 'QUOTE_SENT'
  | 'FOLLOW_UP_REQUIRED'
  | 'NEGOTIATION'
  | 'BOOKING_EXPECTED'
  | 'BOOKING_CONFIRMED'
  | 'WON'
  | 'LOST'
  | 'ON_HOLD'
  | 'INVALID_OR_DUPLICATE';

export interface LeadStageConfig {
  id: LeadPipelineStageId | string;
  name: string;
  description?: string;
  order: number;
  color: string;
  probability: number; // 0 - 100%
  slaDurationHours?: number;
  isActive: boolean;
  isOpen?: boolean;
  isWon?: boolean;
  isLost?: boolean;
  isOnHold?: boolean;
  autoTaskOnEnter?: string;
  autoTaskOnLeave?: string;
  autoTaskHours?: number;
  defaultLeadStatus: LeadStatus;
}

export interface LeadScoreFactor {
  factor: string;
  points: number;
  maxPoints: number;
  explanation: string;
}

export type LeadActivityType = 
  | 'USER_ACTION' 
  | 'AUDIT_EVENT' 
  | 'SYSTEM_EVENT' 
  | 'NOTIFICATION' 
  | 'TASK' 
  | 'EMAIL' 
  | 'CALL' 
  | 'MEETING';

export interface LeadActivityItem {
  id: string;
  type: LeadActivityType;
  title: string;
  description: string;
  timestamp: string;
  authorId?: string;
  authorName: string;
  authorRole?: string;
  meta?: Record<string, any>;
}

export interface CustomerTravelRequirements {
  preferredDestination?: string;
  destinationNames?: string[];
  travelStartDate?: string;
  travelEndDate?: string;
  isDatesFlexible?: boolean;
  numberOfNights?: number;
  adults: number;
  children: number;
  infants?: number;
  roomsCount?: number;
  roomCategory?: string;
  hotelCategory?: '3_STAR' | '4_STAR' | '5_STAR' | 'LUXURY_BOUTIQUE' | 'RESORT';
  mealPlan?: 'ROOM_ONLY' | 'BED_AND_BREAKFAST' | 'HALF_BOARD' | 'FULL_BOARD' | 'ALL_INCLUSIVE';
  transportType?: 'PRIVATE_CAR' | 'LUXURY_VAN' | 'COACH' | 'TRAIN_PASS' | 'SELF_DRIVE' | 'NONE';
  activities?: string[];
  visaRequired?: boolean;
  flightsRequired?: boolean;
  budgetAmount?: number;
  budgetCurrency?: CurrencyCode;
  specialRequests?: string;
}

// ----------------------------------------------------
// CUSTOMER-FACING 15-STAGE BOOKING PROGRESS MODEL
// ----------------------------------------------------
export type BookingProgressStage = 
  | 'ENQUIRY_RECEIVED'
  | 'REQUIREMENTS_REVIEW'
  | 'PROPOSAL_PREPARING'
  | 'PROPOSAL_SENT'
  | 'BOOKING_REQUEST_RECEIVED'
  | 'BOOKING_PROCESSING'
  | 'SUPPLIER_CONFIRMATION_IN_PROGRESS'
  | 'PAYMENT_PENDING'
  | 'DOCUMENTS_PENDING'
  | 'PARTIALLY_CONFIRMED'
  | 'BOOKING_CONFIRMED'
  | 'VOUCHERS_READY'
  | 'TRAVEL_SUPPORT_ACTIVE'
  | 'TRIP_COMPLETED'
  | 'CANCELLED';

export interface BookingProgressHistoryItem {
  id: string;
  stage: BookingProgressStage;
  stageName: string;
  timestamp: string;
  changedById?: string;
  changedByName: string;
  note?: string;
  isPublicToBuyer: boolean;
}

// ----------------------------------------------------
// FINANCIAL INSTALLMENTS & OPERATIONS CALENDAR
// ----------------------------------------------------
export interface PaymentInstallmentItem {
  id: string;
  title: string;
  installmentNumber: number;
  amount: number;
  currency: CurrencyCode;
  dueDate: string;
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'PARTIAL';
  paidAmount?: number;
  paidDate?: string;
  paymentMethod?: string;
  paymentProofId?: string;
  notes?: string;
}

export interface PaymentSchedule {
  bookingId: string;
  bookingReference: string;
  totalAmount: number;
  currency: CurrencyCode;
  installments: PaymentInstallmentItem[];
  tranches?: any[];
  totalPaid: number;
  balanceDue: number;
  excessAmount?: number;
  paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'REFUNDED';
  updatedAt: string;
}

export interface BookingFinancialProfitability {
  bookingId: string;
  bookingReference: string;
  sellingPrice: number;
  totalSupplierCost: number;
  grossMarginAmount: number;
  grossMarginPercent: number;
  agencyCommissionAmount?: number;
  netProfitAmount: number;
  netProfitMarginPercent: number;
  currency: CurrencyCode;
}

export interface OperationsCalendarEvent {
  id: string;
  type: 
    | 'CHECK_IN' 
    | 'CHECK_OUT' 
    | 'FLIGHT' 
    | 'VISA_DEADLINE' 
    | 'PAYMENT_CUTOFF' 
    | 'SUPPLIER_DEADLINE' 
    | 'VOUCHER_DEADLINE' 
    | 'SIGHTSEEING' 
    | 'TRANSFER';
  title: string;
  description: string;
  bookingId: string;
  bookingReference: string;
  customerName: string;
  destination: string;
  supplierName?: string;
  date: string;
  time?: string;
  status: 'UPCOMING' | 'DUE_SOON' | 'OVERDUE' | 'COMPLETED' | 'CANCELLED';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  actionUrl?: string;
  assignedStaffName?: string;
}


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
    | 'BOOKING_CONVERTED'
    | 'STATUS_CHANGED' 
    | 'ASSIGNMENT_CHANGED' 
    | 'PRIORITY_CHANGED'
    | 'NOTE_ADDED' 
    | 'FOLLOWUP_CREATED' 
    | 'FOLLOWUP_COMPLETED' 
    | 'EMAIL_SENT' 
    | 'WHATSAPP_QUOTE_SHARED'
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

export type LeadAssignmentType = 
  | 'INITIAL_CREATION' 
  | 'ASSIGN_AGENT' 
  | 'REASSIGN_AGENT' 
  | 'UNASSIGN_AGENT'
  | 'ASSIGN_INTERNAL' 
  | 'REASSIGN_INTERNAL' 
  | 'UNASSIGN_INTERNAL' 
  | 'MIGRATION';

export interface LeadAssignmentRecord {
  id: string;
  type?: LeadAssignmentType;
  // Internal team member assignment (legacy & dual model)
  assignedStaffId?: string;
  assignedStaffName?: string;
  assignedStaffEmail?: string;
  assignedDepartment?: string;
  previousTeamMemberId?: string;
  previousTeamMemberName?: string;
  newTeamMemberId?: string;
  newTeamMemberName?: string;
  // B2B Agent commercial relationship assignment
  previousAgentId?: string;
  previousAgentName?: string;
  newAgentId?: string;
  newAgentName?: string;
  // Actor audit trail
  assignedByUserId?: string;
  assignedByUserNameSnapshot?: string;
  assignedByUserRole?: string;
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
  stageId?: LeadPipelineStageId | string;
  stageName?: string;
  priority?: LeadPriority;
  conversionStatus?: 'IN_PROGRESS' | 'CONVERTED' | 'LOST' | 'ARCHIVED';

  // Odoo-Style Sales & Ops Ownership & Scoring
  salesOwnerId?: string;
  salesOwnerName?: string;
  salesOwnerEmail?: string;
  operationsOwnerId?: string;
  operationsOwnerName?: string;
  operationsOwnerEmail?: string;
  accountManagerId?: string;
  accountManagerName?: string;
  probability?: number; // 0 - 100%
  expectedRevenue?: number;
  expectedMargin?: number;
  score?: number; // 0 - 100
  scoreBreakdown?: LeadScoreFactor[];
  requirementsSummary?: CustomerTravelRequirements;
  activitiesStream?: LeadActivityItem[];

  // Agency & Contact Linkage
  agencyId?: string;
  contactId?: string;

  // B2B Agent Connection & Authoritative Assignment (Commercial Owner)
  leadId?: string;
  createdByUserId?: string;
  createdByUserRole?: UserRole | string;
  // Submitting Agent (Origin of lead - immutable reference)
  submittingAgentId?: string;
  submittingAgentNameSnapshot?: string;
  submittingAgentAgencySnapshot?: string;
  submittingAgencyNameSnapshot?: string;
  submittingAgentEmailSnapshot?: string;
  // Responsible Agent (Current Commercial Account Owner - kept in sync with assignedAgentId)
  responsibleAgentId?: string;
  responsibleAgentNameSnapshot?: string;
  responsibleAgentAgencySnapshot?: string;
  responsibleAgencyNameSnapshot?: string;
  responsibleAgentEmailSnapshot?: string;
  agentAssignmentStatus?: 'assigned' | 'pending_assignment' | 'reassigned';
  // Legacy fields kept for strict backward compatibility
  assignedAgentId?: string;
  assignedAgentNameSnapshot?: string;
  assignedAgentEmailSnapshot?: string;
  assignedAgentAgencySnapshot?: string;
  assignedByUserId?: string;
  assignedByUserNameSnapshot?: string;
  assignedAt?: string;
  lastReassignedAt?: string;
  lastReassignedByUserId?: string;
  lastReassignedByUserNameSnapshot?: string;
  assignmentNotes?: string;
  leadVisibilityStatus?: 'ASSIGNED' | 'UNASSIGNED' | 'INTERNAL_ONLY';
  linkedQuoteIds?: string[];
  linkedBookingIds?: string[];
  customerId?: string;

  // Internal Team Member Assignment (Operational & Coordination Owner)
  assignedTeamMemberId?: string;
  assignedTeamMemberNameSnapshot?: string;
  assignedTeamMemberEmailSnapshot?: string;
  assignedTeamMemberDepartment?: 'SALES' | 'OPERATIONS' | 'MANAGEMENT' | string;
  assignmentStatus?: 'pending_internal_assignment' | 'assigned' | 'reassigned' | 'needs_assignment' | 'pending_assignment';
  // Legacy Staff Assignment fields (kept in sync with assignedTeamMemberId / assignedTeamMemberNameSnapshot)
  assignedStaffId?: string;
  assignedStaffName?: string;
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
  activeQuoteId?: string;
  latestQuoteVersionId?: string;
  lastQuoteVersionNumber?: number;
  quoteVersion?: number;
  quoteSnapshot?: LeadQuoteSnapshot;
  quoteVersions?: LeadQuoteVersion[];

  // Booking linkage
  bookingId?: string;
  bookingReference?: string;
  bookingIds?: string[];
  activeBookingId?: string;
  bookingValue?: number;
  bookingStatus?: BookingStatus;

  // Operational & Commercial Documents & Financial linkage
  voucherIds?: string[];
  completeVoucherId?: string;
  activityVoucherIds?: string[];
  invoiceIds?: string[];
  activeInvoiceId?: string;
  paymentIds?: string[];
  taskIds?: string[];
  communicationIds?: string[];
  lastProposalActivityAt?: string;
  lastBookingActivityAt?: string;
  lastFinancialActivityAt?: string;

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
  leadId?: string;
  sourceQuoteId?: string;
  invoiceVersion?: number;
  isProforma?: boolean;
  responsibleAgentId?: string;
  assignedTeamMemberId?: string;
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
  // Enhanced Operational & Versioning Fields
  previousInvoiceId?: string;
  amendmentReason?: string;
  amendedBy?: string;
  amendedByName?: string;
  amendedAt?: string;
  billingAddress?: string;
  taxDisplayRate?: string;
  bankAccountDetails?: {
    bankName: string;
    accountName: string;
    accountNumber: string;
    swiftBic: string;
    iban?: string;
  };
  versionHistory?: {
    version: number;
    invoiceNumber: string;
    amendedAt: string;
    amendedByName?: string;
    reason?: string;
    totalAmount: number;
    currency: string;
  }[];
  // Modal & Printable Display Alias Fields
  issueDate?: string;
  billedToAgency?: string;
  billedToName?: string;
  billedToEmail?: string;
  billedToGstin?: string;
  leadTravelerName?: string;
  totalPax?: number;
  destination?: string;
  travelDates?: string;
  items?: InvoiceServiceItem[] | any[];
  paidAmount?: number;
  taxAmount?: number;
}

export interface BookingVoucher {
  id: string;
  voucherId?: string; // explicit voucher ID
  voucherNumber: string; // e.g. TUB-VOU-2026-9021
  version?: number;
  bookingId: string;
  bookingReference: string;
  leadId?: string;
  isCompleteBookingVoucher?: boolean;
  responsibleAgentId?: string;
  assignedTeamMemberId?: string;
  serviceItemId?: string;
  customerName?: string;
  leadPaxName: string;
  totalPax: number;
  destination: string;
  city: string;
  serviceName: string;
  serviceDate: string;
  serviceTime: string;
  supplierName: string;
  supplierContact: string;
  supplierConfirmationRef?: string;
  meetingPoint: string;
  pickupInfo: string;
  dropoffInfo?: string;
  hotelAddress?: string;
  roomDetails?: string;
  mealPlan?: string;
  emergencyContact: string;
  passengerBreakdown: string;
  specialInstructions: string;
  termsAndConditions?: string;
  status: 'ISSUED' | 'REDEEMED' | 'CANCELLED' | 'OUTDATED' | 'REISSUED' | 'draft' | 'generated' | 'amended' | 'issued' | 'reissued' | 'cancelled';
  generatedAt?: string;
  generatedBy?: string;
  generatedByName?: string;
  documentUrl?: string;
  storagePath?: string;
  bookingSnapshot?: any;
  serviceItemsSnapshot?: any[];
  supplierAllocationSnapshot?: any[];
  confirmationSnapshot?: any;
  templateVersion?: string;
  isOutdated?: boolean;
  outdatedReason?: string;
  previousVoucherId?: string;
  issuedAt: string;
  // Enhanced Fields for Activity and Complete Vouchers
  voucherTitle?: string;
  activityDescription?: string;
  category?: string;
  groupingType?: 'activity' | 'service_item' | 'category' | 'day' | 'combined';
  bookedPrice?: number;
  currency?: string;
  pricingSnapshot?: { customerPrice: number; currency: string };
  configurationSnapshot?: any;
  vehicle?: string;
  capacityTier?: string;
  guide?: string;
  guideLanguage?: string;
  ticketType?: string;
  meal?: string;
  selectedOptions?: string[];
  startTime?: string;
  endTime?: string;
  reportingTime?: string;
  operationalInstructions?: string;
  importantInformation?: string;
  productId?: string;
  productSku?: string;
  hub?: string;
  adults?: number;
  children?: number;
  infants?: number;
  passengerNames?: string[];
  inclusions?: string[];
  exclusions?: string[];
  amendmentReason?: string;
  amendedBy?: string;
  amendedByName?: string;
  amendedAt?: string;
  visibilityConfig?: Record<string, boolean>;
  displayOrder?: number;
  versionHistory?: {
    version: number;
    voucherNumber: string;
    amendedAt: string;
    amendedByName?: string;
    amendmentReason?: string;
    status: string;
  }[];
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
export type MenuLocation = 'HEADER' | 'SECONDARY' | 'FOOTER';

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
  menuLocation?: MenuLocation; // 'HEADER' | 'SECONDARY' | 'FOOTER' (defaults to 'HEADER')
  parentId?: string; // For hierarchy / dropdowns
  children?: MenuItemConfig[]; // Nested items if any
  openIn?: '_self' | '_blank';
  icon?: string;
}

export type CustomPageLayout = 'DEFAULT' | 'HERO_BANNER' | 'FEATURED_SHOWCASE' | 'SPLIT_ENQUIRY' | 'STANDARD' | 'HERO_SIDEBAR' | 'MINIMAL' | 'FEATURE_GRID';

export interface CustomPageBlock {
  id: string;
  type: 'RICHTEXT' | 'FEATURE_GRID' | 'CTA_BOX' | 'FAQ_ACCORDION' | 'IMAGE_GALLERY' | 'DESTINATION_CARDS' | 'RICH_TEXT' | 'CTA' | 'FAQ';
  title?: string;
  subtitle?: string;
  content?: string;
  items?: {
    title: string;
    description: string;
    icon?: string;
    linkUrl?: string;
    imageUrl?: string;
  }[];
  data?: any;
}

export interface CustomPage {
  id: string;
  title: string;
  subtitle?: string;
  slug: string;
  menuLabel?: string;
  menuLocation?: MenuLocation;
  heroTitle?: string;
  heroSubtitle?: string;
  heroImage?: string;
  content: string; // Markdown or HTML
  showInMenu: boolean;
  menuOrder: number;
  isPublished: boolean;
  layoutTemplate?: CustomPageLayout;
  ctaButtonText?: string;
  ctaButtonUrl?: string;
  showInFooter?: boolean;
  footerColumnId?: string;
  blocks?: CustomPageBlock[];
  seoTitle?: string;
  seoDescription?: string;
  metaTitle?: string;
  metaDescription?: string;
  ogImage?: string;
  keywords?: string[];
  author?: string;
  createdAt: string;
  updatedAt: string;
  seo?: EntitySEO;
}

// ----------------------------------------------------
// FOOTER NAVIGATION STRUCTURE
// ----------------------------------------------------
export interface FooterMenuLink {
  id: string;
  label: string;
  url: string;
  type: 'DESTINATION' | 'CUSTOM_PAGE' | 'CMS_PAGE' | 'SYSTEM_VIEW' | 'EXTERNAL_LINK' | 'CUSTOM_LINK';
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

export type RequirementCategory = 
  | 'IDENTITY'
  | 'FINANCIAL'
  | 'TRAVEL'
  | 'SUPPORTING'
  | 'APPLICATION'
  | 'OTHER';

export type RequirementRequiredStatus = 'REQUIRED' | 'OPTIONAL' | 'CONDITIONAL';

export interface StructuredVisaRequirement {
  id: string; // e.g. REQ-JPN-PPT-01
  visaId: string; // FK to VisaProduct
  name: string; // e.g. "Original Passport"
  category: RequirementCategory;
  description: string;
  requiredStatus: RequirementRequiredStatus;
  applicableNationality: string[]; // e.g. ['ALL'] or ['Indian', 'All Eligible']
  applicableVisaType?: string; // 'ALL' or specific
  applicableTravellerType?: ('ADULT' | 'CHILD' | 'INFANT' | 'MINOR' | 'STUDENT' | 'EMPLOYED' | 'SELF_EMPLOYED' | 'RETIRED' | 'SPONSORED' | 'ALL')[];
  conditionRule?: {
    conditionType: 'EMPLOYMENT_STATUS' | 'TRAVELLER_TYPE' | 'SPONSORSHIP' | 'PREVIOUS_PASSPORT' | 'CUSTOM';
    conditionValue: string;
    description: string;
  };
  documentConditions?: {
    originalRequired?: boolean;
    copyRequired?: boolean;
    translationRequired?: boolean;
    attestationRequired?: boolean;
    minValidityMonths?: number;
    blankPages?: number;
    copiesCount?: number;
    photoQuantity?: number;
    photoSize?: string;
    photoBackground?: string;
    bankStatementPeriodMonths?: number;
    fileFormatsAccepted?: string[];
  };
  notes?: string;
  displayOrder: number;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  version: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface VisaAssistanceService {
  id: string;
  visaId?: string;
  name: string;
  serviceType: 'DOCUMENT_VETTING' | 'FORM_FILLING' | 'APPOINTMENT_BOOKING' | 'BIOMETRIC_CONCIERGE' | 'EXPRESS_SUBMISSION' | 'STATUS_TRACKING' | 'FULL_CONCIERGE';
  description: string;
  netCost: number;
  serviceFee: number;
  sellingPrice: number;
  currency: CurrencyCode;
  includedInBaseFee: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  displayOrder?: number;
}

export type MarginType = 'PERCENTAGE' | 'FIXED';
export type CommercialPricingTaxType = 'PERCENTAGE' | 'FIXED' | 'NOT_APPLICABLE';
export type CommercialPricingServiceChargeType = 'PERCENTAGE' | 'FIXED' | 'NOT_APPLICABLE';

export interface CommercialPricingDetails {
  currency: CurrencyCode;
  pricingUnit?: string; // 'PER_APPLICANT' | 'PER_TRAVELLER' | 'PER_TRIP' | 'PER_SERVICE' | 'PER_UNIT' | 'PER_DAY'
  nettPrice?: number;
  marginType?: MarginType | 'PERCENTAGE' | 'FIXED';
  marginValue?: number;
  marginAmount?: number;
  serviceChargeType?: CommercialPricingServiceChargeType;
  serviceChargeValue?: number;
  serviceChargeAmount?: number;
  taxType?: CommercialPricingTaxType;
  taxValue?: number;
  taxAmount?: number;
  finalPrice?: number;
  pricingVersion?: number;
  lastUpdatedAt?: string;
}

export interface TravelProtectionPlan {
  id: string;
  serviceName: string;
  provider: string;
  coverageArea: string; // "Worldwide excl. US/Canada" | "Worldwide incl. US/Canada" | "Schengen" | "Asia Regional"
  destinationId?: string;
  medicalCoverageAmount: number;
  emergencyAssistanceIncluded: boolean;
  evacuationCoverageAmount: number;
  tripCancellationAmount: number;
  baggageLossAmount: number;
  validityDaysMax: number;
  eligibilityAgeMin: number;
  eligibilityAgeMax: number;
  netCostPerDay: number;
  netCostPerTrip: number;
  sellingPricePerDay: number;
  sellingPricePerTrip: number;
  currency: CurrencyCode;
  pricing?: CommercialPricingDetails;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  terms: string;
  customerDescription: string;
  inclusions: string[];
  displayOrder?: number;
  updatedAt?: string;
}

export interface VipGroundService {
  id: string;
  name: string;
  serviceType: 'MEET_AND_GREET' | 'VIP_TRANSFER' | 'CHAUFFEUR' | 'FAST_TRACK' | 'LOUNGE_ACCESS' | 'PORTERAGE' | 'CONCIERGE';
  destinationId: string;
  hubId?: string;
  supplierId?: string;
  supplierName: string;
  shortDesc: string;
  longDesc: string;
  netCost: number;
  defaultMarkupPercent: number;
  sellingPrice: number;
  pricingType: 'PER_PAX' | 'PER_VEHICLE' | 'FIXED';
  currency: CurrencyCode;
  pricing?: CommercialPricingDetails;
  inclusions: string[];
  badge?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  displayOrder?: number;
  updatedAt?: string;
}

export interface ConnectivityPlan {
  id: string;
  name: string;
  type: 'ESIM' | 'PHYSICAL_SIM';
  coverageZone: string;
  dataAllowance: string;
  validityDays: number;
  networkSpeed: string; // e.g. "5G / 4G LTE"
  netCost: number;
  sellingPrice: number;
  currency: CurrencyCode;
  pricing?: CommercialPricingDetails;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  inclusions: string[];
  displayOrder?: number;
  updatedAt?: string;
}

export interface QuoteVisaSnapshot {
  visaId: string;
  visaName: string;
  destination: string;
  visaType: string;
  applicantNationality: string;
  applicantProfile?: string;
  selectedAssistanceServices?: VisaAssistanceService[];
  applicableChecklist: StructuredVisaRequirement[];
  pricing: {
    embassyFee: number;
    serviceFee: number;
    assistanceFee: number;
    totalSellingPrice: number;
  };
  currency: CurrencyCode;
  requirementVersion: number;
  capturedAt: string;
}

export interface BookingVisaChecklistItem {
  requirementId: string;
  requirementName: string;
  category: RequirementCategory;
  requiredStatus: RequirementRequiredStatus;
  status: 'PENDING' | 'REQUESTED' | 'RECEIVED' | 'UNDER_REVIEW' | 'ACCEPTED' | 'REJECTED' | 'NOT_APPLICABLE';
  documentUrl?: string;
  documentName?: string;
  uploadedAt?: string;
  rejectionReason?: string;
  notes?: string;
}

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
  listingName?: string;
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
  sellingPrice?: number;
  pricing?: CommercialPricingDetails;
  description: string;
  documentsChecklist: string[];
  structuredRequirements?: StructuredVisaRequirement[];
  assistanceServices?: VisaAssistanceService[];
  requirementVersion?: number;
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
  slug?: string;
  seo?: EntitySEO;
}

// ----------------------------------------------------
// USER ACTIVITY & TELEMETRY TRACKING & SYSTEM ANALYSIS
// ----------------------------------------------------
export type JourneyEventCategory = 
  | 'USER'
  | 'PRODUCT'
  | 'HOTEL'
  | 'PACKAGE'
  | 'VISA'
  | 'AI_PLANNER'
  | 'QUOTE'
  | 'BOOKING'
  | 'TRANSACTION'
  | 'LEAD'
  | 'CART'
  | 'COMMUNICATION';

export interface SystemUserJourneyEvent {
  id: string;
  userId: string;
  userEmail: string;
  userName?: string;
  agencyName?: string;
  userRole?: UserRole;
  category: JourneyEventCategory;
  eventType: string; // e.g. 'REGISTERED', 'LOGIN', 'QUOTE_CREATED', 'QUOTE_SAVED', 'QUOTE_PDF_DOWNLOADED', 'QUOTE_WHATSAPP_SHARED', 'AI_PLANNER_SEARCH', 'AI_PLAN_GENERATED', 'BOOKING_SUBMITTED', 'BOOKING_CONFIRMED', 'PAYMENT_PROOF_UPLOADED', 'PAYMENT_VERIFIED', 'PRODUCT_VIEWED', 'HOTEL_VIEWED', 'PACKAGE_CUSTOMIZED', 'LEAD_CREATED'
  title: string;
  description: string;
  timestamp: string;
  entityId?: string;
  entityType?: string;
  metadata?: Record<string, any>;
  iconName?: string;
  severity?: 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL';
}

export interface UserActivityEvent {
  id: string;
  userId: string;
  userEmail: string;
  userName?: string;
  agencyName?: string;
  type: 'PROPOSAL_SAVED' | 'QUOTE_DOWNLOADED' | 'BOOKING_SUBMITTED' | 'PAGE_VIEW' | 'LOGIN' | 'CALCULATOR_USED' | 'AI_PLANNER_USED' | 'WHATSAPP_SHARED';
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

export type TaskStatus = 
  | 'TO_DO'
  | 'OPEN' 
  | 'PENDING' 
  | 'IN_PROGRESS' 
  | 'WAITING_FOR_REPLY' 
  | 'COMPLETED' 
  | 'DISMISSED' 
  | 'SNOOZED' 
  | 'OVERDUE' 
  | 'CANCELLED'
  | 'ARCHIVED';

export type TaskImportance = 'LOW' | 'NORMAL' | 'IMPORTANT' | 'URGENT';

export type ActionCenterEntityType = 
  | 'BOOKING' 
  | 'LEAD' 
  | 'QUOTE' 
  | 'PAYMENT' 
  | 'CUSTOMER' 
  | 'USER' 
  | 'PRODUCT' 
  | 'HOTEL' 
  | 'DESTINATION' 
  | 'TRANSFER' 
  | 'PACKAGE' 
  | 'VISA' 
  | 'JOB'
  | 'TASK'
  | 'SUPPLIER'
  | 'BUYER'
  | 'B2B_AGENT'
  | 'DOCUMENT'
  | 'PASSENGER';

export interface ActionTarget {
  entityType: ActionCenterEntityType;
  entityId: string;
  targetRoute: string;
  section: string;
  subTab: string;
  recordId: string;
  targetElementId?: string;
  filterIds?: string[];
  filterStatus?: string;
  actionRequired?: string;
  label: string;
  isRecordAvailable: boolean;
}

export type ActionCenterPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | 'CRITICAL' | 'OVERDUE';

export interface CalendarReminderOption {
  method: 'popup' | 'email';
  minutesBefore: number;
}

export interface CalendarTask {
  id: string;
  taskId?: string; // Action Center canonical taskId alias
  taskName?: string; // Canonical business task name
  automationId?: string;
  taskType?: SLATaskType | string;
  title: string;
  description: string;
  assignedToEmail: string;
  assignedToName: string;
  assignedTo?: string;
  createdBy?: string;
  assignedDepartment?: 'OPERATIONS' | 'SALES' | 'GROUND_OPS' | 'FINANCE';
  category: 'CLIENT_FOLLOW_UP' | 'GROUND_DISPATCH' | 'SUPPLIER_CUTOFF' | 'PAYMENT_REMINDER' | 'VIP_ARRIVAL' | 'VISA_SUBMISSION' | 'OPERATIONS_SLA';
  
  // Timestamps & SLA
  generatedAt?: string; // ISO 8601
  dueAt?: string; // ISO 8601 = generatedAt + slaHours
  dueDate?: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  reminderAt?: string; // ISO 8601
  slaHours?: number;
  slaStatus?: SLAStatus;
  snoozedUntil?: string; // ISO 8601
  dismissedAt?: string; // ISO 8601
  dismissedBy?: string;
  
  // Date/Time fields for Calendar
  startDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endDate?: string;
  endTime?: string;
  
  // Relations & Connected Entity links (Lead, Booking, Booking Item, etc.)
  entityType?: ActionCenterEntityType;
  entityId?: string;
  relatedEntityType?: 'lead' | 'booking' | 'booking_item' | 'buyer' | 'b2b_agent' | 'supplier' | 'quote' | 'payment' | 'document' | ActionCenterEntityType | string;
  relatedEntityId?: string;
  relatedEntityReference?: string;
  bookingItemId?: string;
  bookingItemName?: string;
  serviceCategory?: string;
  buyerId?: string;
  b2bAgentId?: string;
  b2bAgentName?: string;
  supplierId?: string;
  targetRoute?: string;
  bookingId?: string;
  bookingReference?: string;
  quoteId?: string;
  quoteNumber?: string;
  leadNumber?: string;
  leadId?: string;
  customerId?: string;
  userId?: string;
  paymentId?: string;
  serviceId?: string;
  voucherId?: string;
  customerName?: string;
  customerEmail?: string;
  destination?: string;
  travelDate?: string;
  bookingType?: string;
  supplierName?: string;
  quoteValue?: number;
  currency?: string;
  requiredAction?: string;
  actionRequired?: string; // Alias for Action Center
  cmsLink?: string;
  source?: 'lead_record' | 'booking_record' | 'booking_item_record' | 'tasks_central' | 'automatic' | 'payment_activity' | 'supplier_activity' | string;
  isCustomerFacing?: boolean;
  isInternal?: boolean;
  autoTaskKey?: string; // Idempotency key to avoid duplicate automatic task creation
  
  // Google Calendar Sync
  syncWithGoogleCalendar?: boolean;
  googleCalendarSyncStatus?: 'NOT_SYNCED' | 'SYNCED' | 'SYNC_FAILED' | 'SYNCING' | 'DISCONNECTED';
  googleCalendarId?: string;
  googleCalendarEventId?: string;
  googleCalendarEventUrl?: string;
  googleCalendarLink?: string;
  googleCalendarAccount?: string;
  googleCalendarName?: string;
  googleCalendarTimezone?: string;
  googleCalendarLastSyncedAt?: string;
  googleCalendarSyncError?: string;
  googleCalendarSyncVersion?: number;
  googleCalendarSource?: string;
  googleCalendarCreatedAt?: string;
  googleCalendarUpdatedAt?: string;
  googleCalendarDeletedAt?: string;
  isSyncedToGoogleCalendar: boolean;
  calendarSyncStatus?: 'SYNCED' | 'FAILED' | 'NOT_SYNCED' | 'PENDING_RETRY';
  syncError?: string;
  syncRetries?: number;
  reminders?: CalendarReminderOption[];
  
  // State
  status: TaskStatus;
  previousStatus?: TaskStatus;
  priority: ActionCenterPriority;
  isOrphan?: boolean;
  isFlaggedForRepair?: boolean;
  completedAt?: string;
  completedBy?: string;
  completionNote?: string;
  completionSource?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  snoozedBy?: string;
  notes?: string;
  importance?: TaskImportance;
  repeat?: 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
  reminderPreset?: 'NONE' | 'ON_DUE_DATE' | 'ONE_DAY_BEFORE' | 'TWO_DAYS_BEFORE' | 'CUSTOM';
  timePreset?: 'NONE' | 'MORNING' | 'AFTERNOON' | 'EVENING' | 'CUSTOM';
  isArchived?: boolean;
  archivedAt?: string;
  archivedBy?: string;
  assignmentHistory?: Array<{ id: string; assignedToName: string; assignedToEmail: string; assignedByName: string; timestamp: string; note?: string; }>;
  comments?: Array<{ id: string; authorName: string; authorEmail?: string; content: string; createdAt: string; }>;
  auditMetadata?: Record<string, any>;
  
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
  mealPlan?: string;
  mealPlanId?: string;
  roomsCount?: number;
  accommodationType?: AccommodationType;
  isManualHotel?: boolean;
  manualHotel?: ManualHotelDetails;
  notes?: string;
  source?: QuoteItemSource;
  aiSuggested?: boolean;
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
  suggestedSellingPriceUSD?: number;
  finalSellingPriceUSD?: number;
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
  package_id?: string;
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
  suggestedSellingPriceUSD?: number;
  finalSellingPriceUSD?: number;
  currency: CurrencyCode;
  tripType: 'LUXURY' | 'FAMILY' | 'HONEYMOON' | 'CULTURAL' | 'ADVENTURE' | 'CLASSIC';
  tags: string[];
  status?: PackageStatus;
  visibility?: PackageVisibility;
  seo?: PackageSEO | EntitySEO;
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
  | 'wishlist'
  | 'create-quote' 
  | 'packages' 
  | 'products' 
  | 'hotels' 
  | 'visa'
  | 'my-quotes' 
  | 'crm'
  | 'leads'
  | 'bookings' 
  | 'customers' 
  | 'tasks' 
  | 'account';

export type B2BNavTab = B2BTabType;

export interface AgentAssignmentNotification {
  id: string;
  deduplicationKey: string;
  entityType: 'LEAD' | 'BOOKING';
  entityId: string;
  entityReference: string;
  agentUserId: string;
  assignedByUserId: string;
  assignedByName: string;
  customerName?: string;
  destination?: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  deepLinkTab: 'leads' | 'bookings';
}

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

// ----------------------------------------------------
// AI PLANNER & INTELLIGENT B2B QUOTE BUILDER TYPES
// ----------------------------------------------------

export type RequirementFieldStatus = 'CONFIRMED' | 'INFERRED' | 'MISSING';

export interface AiPlannerRequirementItem<T = any> {
  value: T;
  status: RequirementFieldStatus;
  sourceText?: string;
  confidence?: number;
}

export interface AiPlannerStructuredRequirements {
  destination: AiPlannerRequirementItem<string>;
  destinationId?: string;
  hubs: AiPlannerRequirementItem<string[]>;
  hubIds?: string[];
  travelers: {
    adults: AiPlannerRequirementItem<number>;
    children: AiPlannerRequirementItem<number>;
    infants: AiPlannerRequirementItem<number>;
    childAges: AiPlannerRequirementItem<number[]>;
  };
  duration: {
    nights: AiPlannerRequirementItem<number>;
    days: AiPlannerRequirementItem<number>;
  };
  travelDates: {
    startDate: AiPlannerRequirementItem<string | null>;
    endDate: AiPlannerRequirementItem<string | null>;
  };
  hotelPreference: {
    category: AiPlannerRequirementItem<string>;
    mealPlan: AiPlannerRequirementItem<string | null>;
    roomCount: AiPlannerRequirementItem<number>;
  };
  travelStyle: AiPlannerRequirementItem<string[]>;
  transportPreference: AiPlannerRequirementItem<'PRIVATE' | 'SHARED' | 'TRAIN' | 'MIXED'>;
  budget?: AiPlannerRequirementItem<{
    amount: number;
    currency: CurrencyCode;
    basis: 'per_person' | 'total';
  } | null>;
  interests: AiPlannerRequirementItem<string[]>;
  visaAssistance: AiPlannerRequirementItem<'YES' | 'NO' | 'NOT_REQUIRED'>;
  specialRequests?: string[];
  arrivalCity?: string;
  departureCity?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
}

export interface AiPlannerFollowUpQuestion {
  id: string;
  question: string;
  field: string;
  placeholder?: string;
  options?: string[];
  currentValue?: any;
  resolved: boolean;
}

export interface AiPlannerDayItem {
  type: 'HOTEL' | 'ACTIVITY' | 'TRANSFER' | 'VISA' | 'OPTIONAL';
  id: string;
  name: string;
  category?: string;
  hubId?: string;
  hubName?: string;
  timeSlot?: 'MORNING' | 'AFTERNOON' | 'EVENING' | 'FULL_DAY';
  serviceTime?: string;
  productId?: string;
  hotelId?: string;
  roomTypeId?: string;
  transferRouteId?: string;
  notes?: string;
  sellingPriceFormatted?: string;
  sellingPrice: number;
  reasoning?: string;
  product?: Product;
  source?: 'AI_PLANNER' | 'USER' | 'SYSTEM';
}

export type AiPlannerRefinementType = 
  | 'ADD_HUB'
  | 'REMOVE_HUB'
  | 'ADD_ACTIVITY'
  | 'REMOVE_ACTIVITY'
  | 'REPLACE_ACTIVITY'
  | 'UPGRADE_HOTEL'
  | 'DOWNGRADE_HOTEL'
  | 'REPLACE_HOTEL'
  | 'UPGRADE_TRANSFER'
  | 'CHANGE_PACE'
  | 'ADD_NIGHT'
  | 'REMOVE_NIGHT'
  | 'CHANGE_DATES'
  | 'REDUCE_PRICE';

export interface AiPlannerRefinementItem {
  refinementId: string;
  type: AiPlannerRefinementType;
  entityId?: string;
  label: string;
  description?: string;
  status: 'PENDING' | 'APPLIED' | 'DISMISSED';
  appliedAt?: string;
  source: 'AI_PLANNER' | 'USER' | 'SYSTEM';
  details?: Record<string, any>;
}

export interface AiPlannerRefinementState {
  appliedRefinements: AiPlannerRefinementItem[];
  dismissedRefinements: string[];
  suggestedRefinements: AiPlannerRefinementItem[];
}

export interface AiPlannerDaySlot {
  dayNumber: number;
  dateString: string;
  formattedDate: string;
  hubId: string;
  hubName: string;
  themeTitle: string;
  isTransitionDay: boolean;
  fromHubName?: string;
  toHubName?: string;
  items: AiPlannerDayItem[];
}

export interface AiPlannerOptionPlan {
  optionNumber: 1 | 2 | 3;
  optionKey: 'BEST_MATCH' | 'BEST_VALUE' | 'PREMIUM';
  title: string;
  badge: string;
  tagline: string;
  hotelTier: string;
  destinationId: string;
  destinationName: string;
  routeSummary: string[];
  routeHubs: TripRouteHub[];
  days: AiPlannerDaySlot[];
  items: QuoteItem[];
  dayThemes: Record<number, string>;
  totalSellingPrice: number;
  perPersonSellingPrice: number;
  currency: CurrencyCode;
  feasibility: FeasibilityCheckResult;
  reasoning: string;
  highlights: string[];
  appliedRefinements?: AiPlannerRefinementItem[];
  dismissedRefinements?: string[];
  suggestedRefinements?: AiPlannerRefinementItem[];
}

export interface AiPlannerResult {
  requirements: AiPlannerStructuredRequirements;
  confirmedSummary: string[];
  inferredSummary: string[];
  missingSummary: string[];
  followUpQuestions: AiPlannerFollowUpQuestion[];
  options: AiPlannerOptionPlan[];
  selectedOptionIndex: number;
  generatedAt: string;
  plannerVersion: string;
  promptText: string;
  assumptions: string[];
  inventoryStatus: {
    destinationFound: boolean;
    hubsFound: number;
    hotelsFound: number;
    activitiesFound: number;
    transfersFound: number;
    warnings: string[];
  };
}

export type AiPlannerActivityAction =
  | 'AI_PLANNER_OPENED'
  | 'AI_REQUEST_SUBMITTED'
  | 'AI_PLAN_GENERATED'
  | 'AI_PLAN_REGENERATED'
  | 'AI_OPTION_SELECTED'
  | 'AI_PLAN_OPENED_IN_QUOTE_BUILDER'
  | 'AI_PLAN_MODIFIED'
  | 'AI_PLAN_SAVED'
  | 'QUOTE_GENERATED';

export interface AiPlannerActivityEvent {
  id: string;
  userId: string;
  userName?: string;
  userRole?: string;
  quoteId?: string;
  leadId?: string;
  timestamp: string;
  action: AiPlannerActivityAction;
  source: 'AI_PLANNER';
  details?: Record<string, any>;
  destination?: string;
  pax?: number;
  nights?: number;
  totalSellingPrice?: number;
  currency?: CurrencyCode;
}

export interface AiPlannerAdminConfig {
  enabledGlobally: boolean;
  modelProvider: 'GEMINI_FLASH' | 'INTELLIGENT_ENGINE' | 'HYBRID';
  modelName: string;
  maxAlternatives: number;
  defaultPlannerBehavior: 'STRICT_INVENTORY' | 'RECOMMEND_CLOSEST';
  allowedDataSources: string[];
  plannerVersion: string;
  loggingEnabled: boolean;
  timeoutMs: number;
  updatedAt: string;
  updatedBy?: string;
}

export interface AiPlannerPermissionAuditLog {
  id: string;
  actorUserId: string;
  actorName: string;
  targetUserId: string;
  targetUserName: string;
  targetUserEmail: string;
  permission: 'aiPlanner.access';
  previousValue: boolean;
  newValue: boolean;
  timestamp: string;
  reason: string;
}

export interface AiQuoteReadinessItem {
  status: 'COMPLETE' | 'NEEDS_SELECTION' | 'OPTIONAL' | 'NOT_REQUESTED' | 'PASSED' | 'CALCULATED';
  label: string;
  detail: string;
}

export interface AiQuoteReadiness {
  tripDetails: AiQuoteReadinessItem;
  route: AiQuoteReadinessItem;
  hotels: AiQuoteReadinessItem;
  rooms: AiQuoteReadinessItem;
  mealPlans: AiQuoteReadinessItem;
  transfers: AiQuoteReadinessItem;
  activities: AiQuoteReadinessItem;
  visa: AiQuoteReadinessItem;
  optionalServices: AiQuoteReadinessItem;
  feasibility: AiQuoteReadinessItem;
  pricing: AiQuoteReadinessItem;
  isReadyForHandoff: boolean;
}

export interface QuoteBuilderHandoffPayload {
  source: 'AI_PLANNER';
  plannerVersion: string;
  createdAt: string;
  createdBy?: string;
  requirementSnapshot: AiPlannerStructuredRequirements;
  destination: {
    id: string;
    name: string;
    slug?: string;
    code?: string;
  };
  travelDates: {
    startDate: string;
    endDate: string;
    nights: number;
  };
  pax: {
    adults: number;
    children: number;
    childAges: number[];
    infants: number;
    classificationSummary?: string;
  };
  routeHubs: TripRouteHub[];
  items: QuoteItem[];
  dayThemes: Record<number, string>;
  calculatedSellingPrice: number;
  currency: CurrencyCode;
  readiness: AiQuoteReadiness;
  badge?: string;
}

// ----------------------------------------------------
// THEUNBOUND AUTHORITATIVE COMMUNICATION STANDARD TYPES
// ----------------------------------------------------

export type CommunicationChannel = 'PDF' | 'EMAIL' | 'WHATSAPP' | 'NOTIFICATION' | 'PREVIEW';
export type CommunicationRole = 'BUYER' | 'B2B_AGENT' | 'ADMIN_OPS';

export type CommunicationEventType =
  | 'QUOTE_EMAIL_SENT'
  | 'QUOTE_PDF_GENERATED'
  | 'QUOTE_WHATSAPP_SHARED'
  | 'QUOTE_STATUS_CHANGED'
  | 'BOOKING_EMAIL_SENT'
  | 'BOOKING_STATUS_UPDATED'
  | 'PAYMENT_NOTIFICATION_SENT'
  | 'PAYMENT_PROOF_SUBMITTED'
  | 'PAYMENT_PROOF_VERIFIED'
  | 'LEAD_NOTIFICATION_SENT'
  | 'OPERATIONAL_ALERT_SENT'
  | 'COMMUNICATION_FAILED';

export interface CommunicationAuditLog {
  id: string;
  communicationId: string;
  quoteId?: string;
  bookingId?: string;
  leadId?: string;
  recipientId?: string;
  recipientEmail?: string;
  recipientPhone?: string;
  recipientType: 'BUYER' | 'B2B_AGENT' | 'DMC_OPS' | 'ADMIN' | 'SUPPLIER';
  channel: CommunicationChannel;
  eventType: CommunicationEventType;
  templateVersion: string;
  dataSnapshotVersion?: number;
  dataSnapshot?: any;
  sentAt: string;
  sentBy?: string;
  sentByName?: string;
  deliveryStatus: 'SUCCESS' | 'DELIVERED' | 'FAILED' | 'PENDING';
  failureReason?: string;
}

// ----------------------------------------------------
// THEUNBOUND GLOBAL IMAGE ARCHITECTURE TYPES
// ----------------------------------------------------

export type ImageEntityType = 'PRODUCT' | 'HOTEL' | 'PACKAGE' | 'VISA' | 'RAIL' | 'DESTINATION' | 'REGION' | 'HUB' | 'HERO' | 'BANNER' | 'CUSTOM';
export type ImageRole = 'PRIMARY' | 'GALLERY' | 'THUMBNAIL' | 'CARD' | 'HERO' | 'LOGO' | 'MAP' | 'DOCUMENT';
export type ImageSyncStatus = 'PENDING' | 'FETCHING' | 'SYNCED' | 'FAILED' | 'INVALID' | 'STALE' | 'DISABLED';

export interface ImageMetadata {
  imageId: string;
  entityType: ImageEntityType;
  entityId: string;
  role: ImageRole;
  storagePath?: string;
  storageUrl?: string;
  sourceUrl: string;
  altText?: string;
  width?: number;
  height?: number;
  mimeType?: string;
  fileSize?: number;
  checksum?: string;
  status: ImageSyncStatus;
  createdAt: string;
  updatedAt: string;
  lastSyncedAt?: string;
}



