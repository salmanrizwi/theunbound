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
  | 'Hotels' 
  | 'Activities' 
  | 'Transfers' 
  | 'Tours' 
  | 'Rail' 
  | 'Ferries' 
  | 'Cruises' 
  | 'Private Tours' 
  | 'Day Trips' 
  | 'Guides' 
  | 'Transport' 
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

export type UserApprovalStatus = 'APPROVED' | 'PENDING' | 'REJECTED';

export interface UserPermissionAccess {
  canAccessPricingCalculator?: boolean;
  canCreateBookings?: boolean;
  canExportPDF?: boolean;
  canViewWholesaleNetRates?: boolean;
  canAccessCMS?: boolean;
  canAccessRoster?: boolean;
  canAccessFinancials?: boolean;
  canManageUsers?: boolean;
}

export interface User {
  id: string;
  name: string;
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
  meetingPoint: string;
  pickupInformation: string;
  
  images: string[];
  videoUrl?: string;
  location: string;
  latitude: number;
  longitude: number;
  rating: number;
  reviewCount: number;
  status: 'ACTIVE' | 'ARCHIVED' | 'DRAFT';
  lastUpdated: string;
  addons?: ProductAddon[];
  
  // Advanced Pricing & Operational Enhancements
  tieredPricing?: TieredPrice[];
  datePricingOverrides?: Record<string, ProductDatePricingOverride>;
  vehicleConfig?: TransferVehicleConfig;
  isTransfer?: boolean;
}

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
  vehicleName: string; // e.g. 'Toyota Alphard Luxury VIP'
  vehicleType: string; // e.g. 'Luxury MPV'
  totalSeats: number; // e.g. 7
  driverSeats: number; // e.g. 1
  passengerCapacity: number; // e.g. 6
  totalTransferCost: number; // e.g. 200 (Fixed total vehicle cost)
  currency: CurrencyCode;
  route?: string;
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
  pricePerPerson: number;
  
  // Transparency badge
  dmcMarginAmount: number;
  dmcMarginPercent: number;
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
  notes?: string;
  selectedAddonIds: string[];
  calculation: PricingCalculationResult;
}

export type QuoteStatus = 'DRAFT' | 'ISSUED' | 'SENT_TO_CLIENT' | 'ACCEPTED' | 'EXPIRED' | 'CONFIRMED' | 'BOOKING_SUBMITTED' | 'ARCHIVED';

export interface QuoteVersionRecord {
  version: number;
  updatedAt: string;
  updatedBy: string;
  changesSummary: string;
  totalSellingPrice: number;
}

export interface QuoteActivityRecord {
  id: string;
  action: 'CREATED' | 'EDITED' | 'PRINTED' | 'DOWNLOADED' | 'SENT' | 'STATUS_CHANGED' | 'BOOKED';
  timestamp: string;
  userName: string;
  details: string;
}

export interface Quotation {
  id: string;
  quoteNumber: string;
  version?: number;
  parentQuoteId?: string;
  isLocked?: boolean;
  leadId?: string;
  agentLogoUrl?: string;
  agentEmail?: string;
  agentAgency?: string;
  versionHistory?: QuoteVersionRecord[];
  activityLog?: QuoteActivityRecord[];
  title: string;
  clientName: string;
  clientEmail?: string;
  clientCompany?: string;
  agentId: string;
  agentName: string;
  destination: string;
  currency: CurrencyCode;
  items: QuoteItem[];
  overallDiscountPercent: number;
  overallMarkupPercent?: number;
  agentNotes: string;
  termsAndConditions: string;
  status: QuoteStatus;
  createdAt: string;
  updatedAt: string;
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
export type BookingStatus = 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type BookingSourceType = 'QUOTATION' | 'PRODUCT_DIRECT';

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
}

export interface BookingSupplierAllocation {
  supplierId: string;
  supplierName: string;
  supplierType: 'HOTEL' | 'TRANSPORT' | 'GUIDE' | 'ACTIVITY' | 'DMC_PARTNER';
  serviceName: string;
  status: 'PENDING_DISPATCH' | 'SENT_TO_SUPPLIER' | 'CONFIRMED_BY_SUPPLIER' | 'REJECTED_BY_SUPPLIER' | 'AMENDMENT_REQUESTED';
  supplierConfirmationRef?: string;
  dispatchedAt?: string;
  confirmedAt?: string;
  assignedContact?: string;
  contactPhone?: string;
  contactEmail?: string;
  notes?: string;
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
  supplierStatus?: 'PENDING_DISPATCH' | 'SENT_TO_SUPPLIER' | 'CONFIRMED_BY_SUPPLIER' | 'REJECTED_BY_SUPPLIER' | 'AMENDMENT_REQUESTED';
  supplierConfirmationRef?: string;
  supplierNotes?: string;
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
  fullName: string;
  dateOfBirth?: string;
  passportNumber?: string;
  passportExpiry?: string;
  nationality?: string;
  isLeadPax: boolean;
  passportFrontUrl?: string;
  passportBackUrl?: string;
  panCardUrl?: string; // Only for lead passenger
  panNumber?: string;
}

export interface BookingPaymentProof {
  id: string;
  amount: number;
  currency: CurrencyCode;
  trancheLabel: string; // e.g. "Tranche 1 (Deposit 30%)", "Tranche 2 (Final Balance)"
  paymentDate: string;
  transactionRef: string;
  proofFileUrl: string;
  verifiedStatus: 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED';
  notes?: string;
}

export interface Booking {
  id: string;
  bookingReference: string; // e.g. TUB-BK-2026-8492
  sourceType: BookingSourceType;
  quoteId?: string;
  quoteNumber?: string;
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
  paymentStatus?: 'PENDING_PAYMENT' | 'PARTIALLY_PAID' | 'PAID' | 'REFUNDED';
  supplierAllocationStatus?: 'UNALLOCATED' | 'DISPATCHED_TO_SUPPLIERS' | 'PARTIALLY_CONFIRMED' | 'FULLY_CONFIRMED_BY_SUPPLIERS';
  supplierAllocations?: BookingSupplierAllocation[];
  
  // Passenger & Document Uploads (up to N pax)
  passengers?: BookingPassenger[];
  
  // Multi-tranche Payment Proofs
  paymentProofs?: BookingPaymentProof[];
  
  // Supplier & Ground Operations Fields
  paymentCutoffDate?: string;
  serviceDate?: string;
  serviceTime?: string;
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
// PROMOTIONS & MARKETING CAMPAIGNS
// ----------------------------------------------------
export type PromotionDiscountType = 'PERCENTAGE' | 'FIXED';
export type PromotionAudience = 'ALL' | 'BUYER' | 'B2B_AGENT';
export type PromotionPlacement = 'BANNER' | 'MODAL' | 'SLIDER' | 'PRODUCT_PAGE' | 'DESTINATION_PAGE' | 'PROMO_SECTION';
export type PromotionFrequency = 'ONCE_PER_SESSION' | 'ONCE_PER_DAY' | 'ALWAYS';

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
  
  // Lifecycle
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  priority: number; // 1 (highest) to 10
  isActive: boolean;
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
// GOOGLE REVIEWS INTEGRATION
// ----------------------------------------------------
export interface GoogleReview {
  id: string;
  authorName: string;
  authorAvatar?: string;
  rating: number; // 1 to 5
  reviewText: string;
  date: string;
  relativeTimeDescription?: string;
  destination?: string;
  locationName?: string;
  source: 'GOOGLE_BUSINESS' | 'TRIPADVISOR' | 'DIRECT_B2B_PARTNER';
  verifiedPartner: boolean;
  isFeatured: boolean;
  isVisible: boolean;
  displayOrder: number;
  helpfulCount?: number;
  responseFromOwner?: {
    text: string;
    date: string;
  };
}

// ----------------------------------------------------
// AUDIT TRAIL & SYSTEM LOGGING
// ----------------------------------------------------
export type AuditAction = 
  | 'PRODUCT_CREATED'
  | 'PRODUCT_UPDATED'
  | 'PRODUCT_ARCHIVED'
  | 'PRICE_CHANGED'
  | 'PROMOTION_CREATED'
  | 'PROMOTION_UPDATED'
  | 'PROMOTION_DELETED'
  | 'BLOG_CREATED'
  | 'BLOG_PUBLISHED'
  | 'BLOG_UPDATED'
  | 'DESTINATION_UPDATED'
  | 'BOOKING_CREATED'
  | 'BOOKING_UPDATED'
  | 'BOOKING_CANCELLED'
  | 'GOOGLE_SHEETS_SYNC'
  | 'REVIEW_UPDATED'
  | 'ROSTER_RESOURCE_ADDED'
  | 'ROSTER_RESOURCE_UPDATED'
  | 'BLACKOUT_DATE_MODIFIED'
  | 'USER_ROLE_CHANGED'
  | 'USER_APPROVED'
  | 'USER_REJECTED'
  | 'STATUS_UPDATED'
  | 'SETTINGS_UPDATED';

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: AuditAction;
  entity: string;
  entityId: string;
  timestamp: string;
  details: string;
  previousValue?: string;
  newValue?: string;
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
// EXTENDED GOOGLE SHEETS SYNC REPORT
// ----------------------------------------------------
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
  country: string;
  area: string;
  starRating: number; // 3, 4, 5
  propertyType: 'LUXURY_HOTEL' | 'BOUTIQUE_RESORT' | 'RYOKAN' | 'BUSINESS_HOTEL' | 'VILLA_CHALET';
  shortDescription: string;
  description: string;
  heroImage: string;
  images: string[];
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

export interface HomepageConfig {
  heroHeading: string;
  heroSubheading: string;
  heroBadgeText: string;
  heroImage: string;
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
// INTERNAL COMPANY MANAGEMENT SYSTEM (LEADS & OPERATIONS)
// ----------------------------------------------------
export type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'QUOTED' | 'FOLLOW_UP' | 'WON' | 'LOST';
export type LeadSource = 'WEBSITE' | 'CONTACT_FORM' | 'QUOTATION_SAVED' | 'PROPOSAL_DOWNLOADED' | 'MARKETING' | 'MANUAL_ENTRY' | 'REFERRAL' | 'B2B_PARTNER' | 'VISA_PAGE' | 'VISA_PORTAL';

export interface LeadNote {
  id: string;
  authorName: string;
  text: string;
  timestamp: string;
}

export interface TravelLead {
  id: string;
  leadNumber: string; // e.g. LED-2026-0042
  contactName: string;
  email: string;
  phone: string;
  agencyName?: string;
  source: LeadSource;
  status: LeadStatus;
  assignedStaffId: string;
  assignedStaffName: string;
  destinationId: string;
  destinationName: string;
  travelDates: string;
  paxAdults: number;
  paxChildren: number;
  estimatedBudget: number;
  currency: CurrencyCode;
  travelRequirements: string;
  notes: LeadNote[];
  quoteId?: string;
  quoteNumber?: string;
  bookingId?: string;
  bookingReference?: string;
  createdAt: string;
  updatedAt: string;
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
  type: 'DESTINATION' | 'CUSTOM_PAGE' | 'SYSTEM_VIEW' | 'EXTERNAL_LINK';
  targetId?: string;
  displayOrder: number;
}

export interface FooterMenuColumn {
  id: string;
  title: string;
  displayOrder: number;
  links?: FooterMenuLink[];
  items?: MenuItemConfig[];
}

export interface FooterConfig {
  tagline: string;
  copyrightText: string;
  showSocialLinks: boolean;
  socialLinks: { platform: string; url: string }[];
  columns: FooterMenuColumn[];
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
export interface CalendarTask {
  id: string;
  title: string;
  description: string;
  assignedToEmail: string;
  assignedToName: string;
  category: 'CLIENT_FOLLOW_UP' | 'GROUND_DISPATCH' | 'SUPPLIER_CUTOFF' | 'PAYMENT_REMINDER' | 'VIP_ARRIVAL' | 'VISA_SUBMISSION';
  startDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endDate?: string;
  endTime?: string;
  bookingReference?: string;
  leadNumber?: string;
  googleCalendarEventId?: string;
  googleCalendarLink?: string;
  isSyncedToGoogleCalendar: boolean;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  createdAt: string;
  updatedAt: string;
}
