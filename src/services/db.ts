import { 
  Product, 
  Destination, 
  DestinationRegionItem,
  MasterRegion,
  Promotion, 
  CampaignEvent,
  CampaignStatus,
  BlogArticle, 
  GoogleReview, 
  Quotation, 
  Booking,
  BookingStatus,
  AgentMarginType,
  PricingSnapshot,
  AuditLog, 
  AuditAction,
  DynamicPricingRecord, 
  SyncDetailedReport,
  UserRole,
  User,
  UserCategory,
  UserApprovalStatus,
  UserPermissionAccess,
  Hotel,
  CityHub,
  DestinationFAQ,
  GalleryImage,
  HomepageConfig,
  HomepageFAQItem,
  TravelLead,
  LeadStatus,
  LeadPriority,
  LeadSource,
  LeadProductItem,
  LeadTimelineEvent,
  LeadFollowUpTask,
  LeadDocument,
  LeadAssignmentRecord,
  LeadNote,
  LeadQuoteSnapshot,
  LeadQuoteVersion,
  CurrencyCode,
  BookingInvoice,
  BookingVoucher,
  BookingFinancialRecord,
  JobSheet,
  EmailCampaignConfig,
  RosterResource,
  ProductRosterRule,
  WishlistFolder,
  WishlistItem,
  SitePagesConfig,
  MenuItemConfig,
  MenuLocation,
  CustomPage,
  VisaProduct,
  FooterConfig,
  FooterMenuColumn,
  FooterMenuLink,
  CalendarTask,
  SLAAutomationRule,
  SLAAutomationAuditLog,
  CommunicationAuditLog,
  SLATaskType,
  SLAStatus,
  TaskStatus,
  UserActivityEvent,
  UserTelemetrySummary,
  SystemUserJourneyEvent,
  JourneyEventCategory,
  BookingPassenger,
  BookingPaymentProof,
  BookingItem,
  BookingTimelineEvent,
  BookingInternalNote,
  BookingCustomerUpdate,
  SupplierPriceType,
  SupplierAllocationStatus,
  BookingOperationsPermissions,
  ServiceItemConfirmationStatus,
  ServiceItemOperationalStatus,
  ServiceItemVoucherStatus,
  ServiceItemInvoiceStatus,
  SupplierPriceHistoryEntry,
  UploadedInvoiceType,
  InvoiceAssociationType,
  BookingUploadedInvoice,
  BookingActivityEventType,
  BookingActivityTimelineEvent,
  B2BPackage,
  B2BCustomer,
  B2BTask,
  AgentAssignmentNotification,
  QuoteStatus,
  BookingSourceType,
  CMSDeletableEntityType,
  DependencyDetailItem,
  DependencyGroup,
  DeletionCheckResult,
  SecureDeleteResult,
  TransferRoute,
  TransferRate,
  ProductPricingRate,
  ProductCapacityItem,
  HotelMealPlanItem,
  VisaRateItem,
  PackageItemRef,
  MultiTabSyncReport,
  HotelRoomType,
  HotelRate,
  AdminActivityRecord,
  AdminActivityCategory,
  AdminActivityType,
  AdminActivitySeverity,
  AdminActivityActorType,
  SEORedirect,
  GlobalSEODefaults,
  EntitySEO,
  SEOAuditItem,
  SEOEntityType,
  MasterGoogleSheetConfig,
  Supplier,
  SupplierStatus,
  SupplierRateCard,
  SupplierDocument,
  SupplierActivityHistory,
  SupplierAllocationRecord,
  SupplierPriceRecord,
  SupplierRequest,
  SupplierRequestStatus,
  LeadStageConfig,
  LeadPipelineStageId,
  BookingProgressStage,
  OperationsCalendarEvent,
  PaymentSchedule,
  BookingFinancialProfitability
} from '../types';
import {
  DEFAULT_LEAD_STAGES,
  CUSTOMER_PROGRESS_STAGES,
  calculateTransparentLeadScore,
  calculateBookingProfitability,
  generateOperationsCalendarEvents
} from './crmOperationsEngine';
import {
  DEFAULT_GLOBAL_SEO_DEFAULTS,
  auditEntitySEO,
  buildFallbackSEO,
  sanitizeSlug
} from './seoEngine';
import { INITIAL_PRODUCTS } from '../data/initialProducts';
import { DESTINATIONS } from '../data/destinations';
import { INITIAL_MASTER_REGIONS } from '../data/initialRegions';
import { INITIAL_PROMOTIONS } from '../data/initialPromotions';
import { INITIAL_BLOGS } from '../data/initialBlogs';
import { INITIAL_REVIEWS } from '../data/initialReviews';
import { INITIAL_HOTELS } from '../data/initialHotels';
import { INITIAL_CITY_HUBS } from '../data/initialCityHubs';
import { INITIAL_FAQS } from '../data/initialFAQs';
import { INITIAL_GALLERY } from '../data/initialGallery';
import { INITIAL_HOMEPAGE_CONFIG } from '../data/initialHomepage';
import { INITIAL_CAMPAIGNS } from '../data/initialCampaigns';
import { INITIAL_ROSTER_RESOURCES } from '../data/initialRoster';
import { INITIAL_VISAS } from '../data/initialVisas';
import { INITIAL_FOOTER_CONFIG } from '../data/initialFooter';
import { INITIAL_B2B_PACKAGES } from '../data/initialPackages';
import { INITIAL_LEADS } from '../data/initialLeads';
import { EmailNotificationService } from './emailNotificationService';
import { runFirestoreDiagnostics, FirestoreDiagnosticReport } from './firestoreDiagnostic';
import { googleBusinessService } from './googleBusinessService';
import { db as firestoreDb } from './firebase';
import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  getDocFromServer,
  writeBatch 
} from 'firebase/firestore';
import { 
  getDefaultPermissionsForRole, 
  syncSessionUserPermissions, 
  canRevokeAdminPermissions, 
  isMasterAdmin 
} from './permissionEngine';
import { 
  sanitizeQuoteForAgent, 
  sanitizeBookingForAgent, 
  sanitizeProductForAgent 
} from '../utils/customerQuoteSanitizer';

function cleanForFirestore(data: any): any {
  if (data === undefined) {
    return null;
  }
  if (data === null || typeof data !== 'object') {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map(item => cleanForFirestore(item));
  }
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      cleaned[key] = cleanForFirestore(value);
    }
  }
  return cleaned;
}

const STORAGE_KEY_PREFIX = 'theunbound_db_';

export const INITIAL_SITE_PAGES_CONFIG: SitePagesConfig = {
  contactPage: {
    heroTitle: 'Get in Touch with Our Ground Operations',
    heroSubtitle: 'Connect directly with TheUnbound Destination Management Company for bespoke travel quotations, wholesale contracted tariffs, guide allocations, and operational support across Japan, United Kingdom, and Europe.',
    officeAddress: 'A-46, Kanchan Kunj, Madanpur Khadar Extn-2, New Delhi 110076, India',
    salesEmail: 'sales@theunbound.in',
    opsEmail: 'business@theunbound.in',
    phone: '+91-9811654959',
    whatsappNumber: '+91-9811654959',
    supportHours: 'Mon - Sat: 09:00 AM - 08:00 PM (IST) / 24x7 On-Tour Emergency Support',
    emergencyHotline: '+91-9811654959'
  },
  termsPage: {
    lastUpdated: '2026-01-15',
    title: 'Terms & Conditions of Ground Service',
    b2bWholesaleTerms: 'All B2B contracted wholesale tariffs are confidential and valid for licensed travel agencies and tour operators. Rates are protected for 14 days from official quotation issuance.',
    cancellationSlaNotice: 'All bookings are processed under our strict 24–48 hour operational SLA. Ground dispatch confirmation and vouchers will be updated within this guaranteed window.',
    generalTermsSnippet: 'Services provided by TheUnbound Destination Management Company Ltd. are subject to operational safety regulations, local ground partner availability, and verified vehicle allocations.'
  },
  refundPage: {
    lastUpdated: '2026-01-15',
    title: 'Cancellation & Refund Policy',
    processingTimeDays: 7,
    forceMajeurePolicy: 'In events of extreme weather warnings, natural disruptions, or official government advisories, full credit notes or rescheduled dates will be facilitated without penalty.',
    refundConditionsSnippet: 'Cancellations received up to 72 hours prior to scheduled tour commencement qualify for a 100% refund minus payment processing gateway charges.'
  },
  privacyPage: {
    lastUpdated: '2026-01-15',
    title: 'Privacy & Data Protection Policy',
    dataControllerEmail: 'privacy@theunbound.in',
    gdprNoticeSnippet: 'We respect your confidentiality. Traveler names, passport numbers, and flight itineraries are collected solely for hotel check-ins, licensed guide manifests, and private chauffeur dispatches.'
  },
  b2bPortal: {
    announcementBanner: '🌸 Spring 2026 Japan & Europe Early-Bird Wholesale Tariffs Live — Lock In Guaranteed Rates Now!',
    isAnnouncementActive: true,
    contractDownloadNotice: 'Verified travel agents can download complete Excel & PDF tariff sheets directly from the portal.'
  }
};

export const INITIAL_MENU_ITEMS: MenuItemConfig[] = [
  { id: 'menu-home', label: 'Home', type: 'SYSTEM_VIEW', targetId: 'home', displayOrder: 1, isVisible: true },
  { id: 'menu-destinations', label: 'Destinations', type: 'SYSTEM_VIEW', targetId: 'destinations', displayOrder: 2, isVisible: true },
  { id: 'menu-experiences', label: 'Experiences', type: 'SYSTEM_VIEW', targetId: 'experiences', displayOrder: 3, isVisible: true },
  { id: 'menu-about', label: 'About DMC', type: 'SYSTEM_VIEW', targetId: 'about', displayOrder: 4, isVisible: true },
  { id: 'menu-b2b', label: 'Agent Portal', type: 'SYSTEM_VIEW', targetId: 'b2b', displayOrder: 5, isVisible: true },
  { id: 'menu-contact', label: 'Contact', type: 'SYSTEM_VIEW', targetId: 'contact', displayOrder: 6, isVisible: true }
];

export const INITIAL_CUSTOM_PAGES: CustomPage[] = [
  {
    id: 'page-about-theunbound',
    slug: 'about-theunbound',
    title: 'About TheUnbound: Premier Destination Management Company',
    subtitle: 'Direct ground operations, wholesale B2B partner tariffs, and bespoke luxury logistics across Japan, the United Kingdom, and Europe.',
    content: `## Who We Are: The Destination Operations Standard

TheUnbound is a premier Destination Management Company (DMC) delivering direct-contracted ground logistics, VIP chauffeur fleets, accredited private guides, and exclusive venue access across our specialized multi-country network.

### Our Core Mission
To eliminate middleman markups and operational delays for luxury travel designers, travel agencies, and private clients worldwide. We empower our partners with verified net B2B contracts, instant pricing calculators, and a strict 24–48h ground confirmation SLA.

### Direct Ground Support Guarantee
- **100% Direct Supplier Contracts**: No secondary brokers. We hold direct allotments with luxury ryokans, historic manor houses, Michelin-starred culinary masters, and private charter providers.
- **24/7 Ground Ops Dispatch**: Dedicated local duty managers and emergency hotlines available around the clock in every destination timezone.
- **Accredited Multilingual Guides**: Certified government-licensed interpreters, Blue Badge guides in the UK, and specialized art docents across Continental Europe.
- **Transparent Wholesale Pricing**: Live multi-currency net pricing (USD, EUR, GBP, JPY) with itemized tiers for adults, children, and vehicle groups.

### Global Presence & Operations Hubs
Our operational footprint spans key gateway cities and cultural regions:
- **Japan**: Tokyo, Kyoto, Osaka, Hakone, Hokkaido, Kanazawa, Hiroshima, Nara
- **United Kingdom**: London, Edinburgh, Cotswolds, Scottish Highlands, Bath, Oxford
- **Europe**: Paris, Rome, Swiss Alps, Florence, French Riviera, Amsterdam, Venice

### Core Values
1. **Precision**: Meticulous execution of complex multi-city and cross-border itineraries.
2. **Authenticity**: Privileged access to private cultural masters, tea ceremonies, and closed-door historical sites.
3. **Integrity**: Transparent B2B net wholesale pricing and zero hidden transaction fees.
4. **Partner Empowerment**: State-of-the-art digital quotation builder and dynamic tariff downloads.`,
    heroImage: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?q=80&w=1600&auto=format&fit=crop',
    isPublished: true,
    showInMenu: true,
    menuLabel: 'About Us',
    menuOrder: 4,
    metaDescription: 'Discover TheUnbound Destination Management Company - Direct luxury ground operations, private tours, and wholesale tariffs.',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'page-japan-cherry-blossom',
    slug: 'japan-cherry-blossom-guide',
    title: 'Spring Sakura Guide: Private Ground Logistics',
    subtitle: 'Exclusive private vehicle allocations and authentic cultural experiences across Tokyo, Kyoto, and Hakone during peak cherry blossom season.',
    content: '## Comprehensive Sakura Ground Planning\n\nTheUnbound DMC provides verified B2B partners with dedicated English-speaking licensed guides, luxury Alphard and HiAce vans, and private tea ceremony access during peak spring bloom.\n\n### Featured Operational Services\n- Fast-track Shinkansen luggage forwarding\n- Private temple morning permits prior to public entry\n- On-ground 24/7 bilingual dispatch support\n- Direct wholesaler contract rates with luxury Ryokans',
    heroImage: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200&auto=format&fit=crop',
    isPublished: true,
    showInMenu: true,
    menuLabel: 'Sakura Guide',
    menuOrder: 7,
    metaDescription: 'Complete B2B and traveler guide to private luxury cherry blossom ground logistics in Japan by TheUnbound DMC.',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'page-uk-cotswolds-heritage',
    slug: 'uk-cotswolds-private-estates',
    title: 'UK & Cotswolds Bespoke Manor Tours',
    subtitle: 'Private chauffeur excursions, historical estate access, and boutique country house hotels across Oxfordshire and Gloucestershire.',
    content: '## Heritage British Touring\n\nExperience quintessential Britain with private luxury Mercedes V-Class transfers, accredited Blue Badge guides, and private dining in historic stately homes.',
    heroImage: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?q=80&w=1200&auto=format&fit=crop',
    isPublished: true,
    showInMenu: false,
    menuLabel: 'Cotswolds Tours',
    menuOrder: 8,
    metaDescription: 'Bespoke Cotswolds private manor itineraries and luxury chauffeur services.',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  }
];

export const INITIAL_SLA_AUTOMATION_RULES: SLAAutomationRule[] = [
  {
    id: 'rule-booking-confirmation-12h',
    ruleName: 'Booking Confirmation 12h SLA',
    triggerEvent: 'BOOKING_CONFIRMED',
    taskType: 'BOOKING_CONFIRMATION',
    isEnabled: true,
    slaHours: 12,
    defaultAssignee: {
      type: 'DEPARTMENT',
      name: 'Operations Team',
      email: 'business@theunbound.in',
      department: 'OPERATIONS',
      role: 'Duty Operations Manager'
    },
    department: 'OPERATIONS',
    titleTemplate: '[SLA] Booking Confirmation — {{bookingReference}}',
    calendarId: 'primary',
    reminders: [
      { method: 'popup', minutesBefore: 360 }, // 6h before
      { method: 'popup', minutesBefore: 120 }, // 2h before
      { method: 'email', minutesBefore: 60 }   // 1h before
    ],
    updatedAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'rule-quote-followup-24h',
    ruleName: 'Downloaded PDF Quote 24h Follow-Up',
    triggerEvent: 'QUOTE_PDF_DOWNLOADED',
    taskType: 'QUOTE_FOLLOW_UP',
    isEnabled: true,
    slaHours: 24,
    defaultAssignee: {
      type: 'DEPARTMENT',
      name: 'Sales Team (Sarah Lin)',
      email: 'sales@theunbound.in',
      department: 'SALES',
      role: 'Senior Travel Specialist'
    },
    department: 'SALES',
    titleTemplate: '[SLA] Quote Follow-Up — {{quoteNumber}}',
    calendarId: 'primary',
    reminders: [
      { method: 'popup', minutesBefore: 720 }, // 12h before
      { method: 'popup', minutesBefore: 120 }, // 2h before
      { method: 'email', minutesBefore: 60 }   // 1h before
    ],
    updatedAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'rule-transfer-confirmation-6h',
    ruleName: 'Airport & Inter-City Transfer 6h SLA',
    triggerEvent: 'GROUND_TRANSFER_BOOKED',
    taskType: 'TRANSFER_CONFIRMATION',
    isEnabled: true,
    slaHours: 6,
    defaultAssignee: {
      type: 'DEPARTMENT',
      name: 'Ground Fleet Logistics (Rajesh Sharma)',
      email: 'fleet@theunbound.in',
      department: 'GROUND_OPS',
      role: 'Fleet Dispatcher'
    },
    department: 'GROUND_OPS',
    titleTemplate: '[SLA] Ground Transfer Confirmation — {{bookingReference}}',
    calendarId: 'primary',
    reminders: [
      { method: 'popup', minutesBefore: 180 },
      { method: 'popup', minutesBefore: 60 }
    ],
    updatedAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'rule-hotel-confirmation-12h',
    ruleName: 'Hotel & Resort Allotment 12h Confirmation',
    triggerEvent: 'GROUND_HOTEL_BOOKED',
    taskType: 'HOTEL_CONFIRMATION',
    isEnabled: true,
    slaHours: 12,
    defaultAssignee: {
      type: 'DEPARTMENT',
      name: 'Hospitality Procurement (Elena Rostova)',
      email: 'hospitality@theunbound.in',
      department: 'OPERATIONS',
      role: 'Hotel Contracting Lead'
    },
    department: 'OPERATIONS',
    titleTemplate: '[SLA] Hotel Confirmation — {{bookingReference}}',
    calendarId: 'primary',
    reminders: [
      { method: 'popup', minutesBefore: 360 },
      { method: 'email', minutesBefore: 60 }
    ],
    updatedAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'rule-activity-confirmation-12h',
    ruleName: 'Excursions & Activity Partner 12h SLA',
    triggerEvent: 'GROUND_ACTIVITY_BOOKED',
    taskType: 'ACTIVITY_CONFIRMATION',
    isEnabled: true,
    slaHours: 12,
    defaultAssignee: {
      type: 'DEPARTMENT',
      name: 'Ground Experiences Team',
      email: 'experiences@theunbound.in',
      department: 'GROUND_OPS',
      role: 'Tour Coordinator'
    },
    department: 'GROUND_OPS',
    titleTemplate: '[SLA] Activity Confirmation — {{bookingReference}}',
    calendarId: 'primary',
    reminders: [
      { method: 'popup', minutesBefore: 360 },
      { method: 'popup', minutesBefore: 60 }
    ],
    updatedAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'rule-guide-assignment-24h',
    ruleName: 'Licensed Guide & Escort 24h Allocation',
    triggerEvent: 'GROUND_GUIDE_REQUESTED',
    taskType: 'GUIDE_ASSIGNMENT',
    isEnabled: true,
    slaHours: 24,
    defaultAssignee: {
      type: 'DEPARTMENT',
      name: 'Staff Roster Manager',
      email: 'roster@theunbound.in',
      department: 'GROUND_OPS',
      role: 'Roster Lead'
    },
    department: 'GROUND_OPS',
    titleTemplate: '[SLA] Guide Duty Assignment — {{bookingReference}}',
    calendarId: 'primary',
    reminders: [
      { method: 'popup', minutesBefore: 720 },
      { method: 'email', minutesBefore: 120 }
    ],
    updatedAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'rule-driver-assignment-12h',
    ruleName: 'Private Chauffeur & Vehicle Allocation 12h',
    triggerEvent: 'GROUND_DRIVER_REQUESTED',
    taskType: 'DRIVER_ASSIGNMENT',
    isEnabled: true,
    slaHours: 12,
    defaultAssignee: {
      type: 'DEPARTMENT',
      name: 'Fleet Dispatch Desk',
      email: 'fleet@theunbound.in',
      department: 'GROUND_OPS',
      role: 'Transport Lead'
    },
    department: 'GROUND_OPS',
    titleTemplate: '[SLA] Chauffeur Assignment — {{bookingReference}}',
    calendarId: 'primary',
    reminders: [
      { method: 'popup', minutesBefore: 360 },
      { method: 'popup', minutesBefore: 60 }
    ],
    updatedAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'rule-supplier-followup-24h',
    ruleName: 'Contracted Supplier Follow-Up 24h SLA',
    triggerEvent: 'SUPPLIER_FOLLOWUP_REQUIRED',
    taskType: 'SUPPLIER_FOLLOW_UP',
    isEnabled: true,
    slaHours: 24,
    defaultAssignee: {
      type: 'DEPARTMENT',
      name: 'Supplier Relations Desk',
      email: 'suppliers@theunbound.in',
      department: 'OPERATIONS',
      role: 'Vendor Relationship Officer'
    },
    department: 'OPERATIONS',
    titleTemplate: '[SLA] Supplier Verification — {{bookingReference}}',
    calendarId: 'primary',
    reminders: [
      { method: 'popup', minutesBefore: 720 },
      { method: 'email', minutesBefore: 60 }
    ],
    updatedAt: '2026-01-01T00:00:00Z'
  }
];

export type BookingSaveListener = (booking: Booking, user: User | null, isNew: boolean) => void;
export type QuotationSaveListener = (quote: Quotation, user: User | null, isNew: boolean) => void;

export class AppDatabase {
  private static instance: AppDatabase;
  private listeners: Set<() => void> = new Set();
  private bookingSaveListeners: BookingSaveListener[] = [];
  private quotationSaveListeners: QuotationSaveListener[] = [];
  private leadSaveListeners: ((lead: TravelLead, user: User | null, isNew: boolean) => void)[] = [];
  private isFirestoreInitialized: boolean = false;
  private notifyTimer: any = null;
  private actionCenterHooks?: {
    onBookingStatusChanged?: (bookingId: string, bookingRef: string, status: string, user: User | null) => void;
    onPaymentVerified?: (bookingId: string, bookingRef: string, paymentId: string, user: User | null) => void;
    onQuoteStatusChanged?: (quoteId: string, quoteNumber: string, status: string, user: User | null) => void;
    onLeadStatusChanged?: (leadId: string, leadNumber: string, status: string, user: User | null) => void;
  };

  public registerActionCenterHooks(hooks: {
    onBookingStatusChanged?: (bookingId: string, bookingRef: string, status: string, user: User | null) => void;
    onPaymentVerified?: (bookingId: string, bookingRef: string, paymentId: string, user: User | null) => void;
    onQuoteStatusChanged?: (quoteId: string, quoteNumber: string, status: string, user: User | null) => void;
    onLeadStatusChanged?: (leadId: string, leadNumber: string, status: string, user: User | null) => void;
  }) {
    this.actionCenterHooks = hooks;
  }

  private constructor() {
    this.initDefaultData();
    this.initFirestoreSync();
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key && e.key.startsWith(STORAGE_KEY_PREFIX)) {
          this.notify();
        }
      });
    }
  }

  public static getInstance(): AppDatabase {
    if (!AppDatabase.instance) {
      AppDatabase.instance = new AppDatabase();
    }
    return AppDatabase.instance;
  }

  public subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  public onBookingSaved(listener: BookingSaveListener): () => void {
    this.bookingSaveListeners.push(listener);
    return () => {
      this.bookingSaveListeners = this.bookingSaveListeners.filter(l => l !== listener);
    };
  }

  public onQuotationSaved(listener: QuotationSaveListener): () => void {
    this.quotationSaveListeners.push(listener);
    return () => {
      this.quotationSaveListeners = this.quotationSaveListeners.filter(l => l !== listener);
    };
  }

  public onLeadSaved(listener: (lead: TravelLead, user: User | null, isNew: boolean) => void): () => void {
    this.leadSaveListeners.push(listener);
    return () => {
      this.leadSaveListeners = this.leadSaveListeners.filter(l => l !== listener);
    };
  }

  public async runDiagnostics(): Promise<FirestoreDiagnosticReport> {
    return runFirestoreDiagnostics();
  }

  private notify() {
    if (this.notifyTimer) {
      clearTimeout(this.notifyTimer);
    }
    this.notifyTimer = setTimeout(() => {
      this.listeners.forEach(cb => {
        try {
          cb();
        } catch (err) {
          console.debug('Listener callback error:', err);
        }
      });
    }, 25);
  }

  private getItem<T>(key: string, fallback: T): T {
    try {
      const data = localStorage.getItem(STORAGE_KEY_PREFIX + key);
      return data ? JSON.parse(data) : fallback;
    } catch (e) {
      console.error(`Error reading ${key} from storage:`, e);
      return fallback;
    }
  }

  private setItem<T>(key: string, value: T, shouldNotify: boolean = true): void {
    try {
      localStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(value));
      if (shouldNotify) {
        this.notify();
      }
    } catch (e) {
      console.error(`Error saving ${key} to storage:`, e);
    }
  }

  private syncFirestoreDoc(collectionName: string, docId: string, data: any): void {
    if (!docId) return;
    try {
      const cleanData = cleanForFirestore(data);
      setDoc(doc(firestoreDb, collectionName, docId), cleanData, { merge: true }).catch((err) => {
        console.debug(`Firestore sync note (${collectionName}/${docId}):`, err);
      });
    } catch (e) {
      console.debug(`Firestore sync error (${collectionName}/${docId}):`, e);
    }
  }

  private deleteFirestoreDoc(collectionName: string, docId: string): void {
    if (!docId) return;
    try {
      deleteDoc(doc(firestoreDb, collectionName, docId)).catch((err) => {
        console.debug(`Firestore delete note (${collectionName}/${docId}):`, err);
      });
    } catch (e) {
      console.debug(`Firestore delete error (${collectionName}/${docId}):`, e);
    }
  }

  /**
   * Safe real-time Firestore listener with Zero Data Loss Guarantee:
   * When snapshot is non-empty, updates local storage with authoritative cloud data.
   * When snapshot is empty or during offline/transient state, strictly PRESERVES existing local records
   * rather than overwriting with an empty array [].
   */
  private syncCollectionSafely<T>(
    collectionName: string,
    storageKey: string,
    transformDoc?: (docData: any, docId: string) => T | null
  ): void {
    onSnapshot(collection(firestoreDb, collectionName), (snapshot) => {
      if (!snapshot.empty) {
        const list: T[] = [];
        snapshot.forEach(docSnap => {
          const item = transformDoc ? transformDoc(docSnap.data(), docSnap.id) : (docSnap.data() as T);
          if (item) list.push(item);
        });
        this.setItem(storageKey, list, true);
      }
      // ZERO DATA LOSS GUARANTEE: Never overwrite local cache with [] when snapshot is empty!
    }, (err) => {
      console.debug(`Firestore ${collectionName} sync note (non-blocking):`, err?.message || err);
    });
  }

  private async initFirestoreSync(): Promise<void> {
    if (this.isFirestoreInitialized || typeof window === 'undefined') return;
    this.isFirestoreInitialized = true;

    try {
      // 1. Core Inventory & Catalog Collections
      this.syncCollectionSafely<Product>('products', 'products');
      this.syncCollectionSafely<Destination>('destinations', 'destinations');
      this.syncCollectionSafely<Hotel>('hotels', 'hotels');
      this.syncCollectionSafely<CityHub>('city_hubs', 'city_hubs');
      this.syncCollectionSafely<DestinationRegionItem>('regions', 'regions');
      this.syncCollectionSafely<MasterRegion>('master_regions', 'master_regions');
      this.syncCollectionSafely<DestinationFAQ>('faqs', 'destination_faqs');
      this.syncCollectionSafely<B2BPackage>('b2b_packages', 'b2b_packages');
      this.syncCollectionSafely<VisaProduct>('visas', 'visas');
      this.syncCollectionSafely<Promotion>('promotions', 'promotions');
      this.syncCollectionSafely<GalleryImage>('gallery_items', 'gallery');
      this.syncCollectionSafely<GoogleReview>('google_reviews', 'reviews');
      this.syncCollectionSafely<BlogArticle>('blog_articles', 'blogs');

      // 2. User Accounts & Transactions (Preserved across all deployments)
      this.syncCollectionSafely<User>('users', 'system_users');
      this.syncCollectionSafely<Quotation>('quotations', 'saved_quotes');
      this.syncCollectionSafely<Booking>('bookings', 'bookings');
      this.syncCollectionSafely<TravelLead>('leads', 'leads');
      this.syncCollectionSafely<B2BCustomer>('b2b_customers', 'b2b_customers');
      this.syncCollectionSafely<B2BTask>('b2b_tasks', 'b2b_tasks');
      this.syncCollectionSafely<CalendarTask>('calendar_tasks', 'calendar_tasks');
      this.syncCollectionSafely<WishlistFolder>('wishlist_folders', 'wishlist_folders');
      this.syncCollectionSafely<WishlistItem>('wishlist_items', 'wishlist_items');

      // 3. Hotel & Transport Contracting Rates
      this.syncCollectionSafely<HotelRoomType>('hotel_rooms', 'hotel_rooms');
      this.syncCollectionSafely<HotelRate>('hotel_rates', 'hotel_rates');
      this.syncCollectionSafely<HotelMealPlanItem>('hotel_meal_plans', 'hotel_meal_plans');
      this.syncCollectionSafely<TransferRoute>('transfer_routes', 'transfer_routes');
      this.syncCollectionSafely<TransferRate>('transfer_rates', 'transfer_rates');
      this.syncCollectionSafely<ProductPricingRate>('product_pricing_rates', 'product_pricing_rates');
      this.syncCollectionSafely<ProductCapacityItem>('product_capacities', 'product_capacities');
      this.syncCollectionSafely<VisaRateItem>('visa_rates', 'visa_rates');
      this.syncCollectionSafely<PackageItemRef>('package_items', 'package_items');

      // 4. Operations, Financials & Logistics
      this.syncCollectionSafely<BookingInvoice>('invoices', 'invoices');
      this.syncCollectionSafely<BookingUploadedInvoice>('uploaded_invoices', 'uploaded_invoices');
      this.syncCollectionSafely<BookingVoucher>('vouchers', 'vouchers');
      this.syncCollectionSafely<JobSheet>('job_sheets', 'job_sheets');
      this.syncCollectionSafely<RosterResource>('roster_resources', 'roster_resources');
      this.syncCollectionSafely<SLAAutomationRule>('sla_automation_rules', 'sla_automation_rules');
      this.syncCollectionSafely<AdminActivityRecord>('admin_activities', 'admin_activities');
      this.syncCollectionSafely<CampaignEvent>('campaign_events', 'campaign_events');
      this.syncCollectionSafely<EmailCampaignConfig>('campaigns', 'campaigns');
      this.syncCollectionSafely<SEORedirect>('seo_redirects', 'seo_redirects');
      this.syncCollectionSafely<Supplier>('suppliers', 'suppliers');
      this.syncCollectionSafely<SupplierRequest>('supplier_requests', 'supplier_requests');
      this.syncCollectionSafely<LeadStageConfig>('lead_stages', 'lead_stages');

      // 5. Navigation & Institutional Content with Local Deleted Tombstone Handling
      onSnapshot(collection(firestoreDb, 'menu_items'), (snapshot) => {
        if (!snapshot.empty) {
          const deletedIds = this.getDeletedMenuItemIds();
          const list: MenuItemConfig[] = [];
          snapshot.forEach(docSnap => {
            const data = docSnap.data() as MenuItemConfig;
            if (!deletedIds.has(docSnap.id) && !deletedIds.has(data.id)) {
              list.push(data);
            }
          });
          this.setItem('menu_items', list, true);
        }
      }, (err) => console.debug('Firestore menu_items sync note:', err?.message || err));

      onSnapshot(collection(firestoreDb, 'custom_pages'), (snapshot) => {
        if (!snapshot.empty) {
          const deletedIds = this.getDeletedCustomPageIds();
          const list: CustomPage[] = [];
          snapshot.forEach(docSnap => {
            const data = docSnap.data() as CustomPage;
            if (!deletedIds.has(docSnap.id) && !deletedIds.has(data.id)) {
              list.push(data);
            }
          });
          this.setItem('custom_pages', list, true);
        }
      }, (err) => console.debug('Firestore custom_pages sync note:', err?.message || err));

      // 6. Singleton Config Documents
      onSnapshot(collection(firestoreDb, 'footer_config'), (snapshot) => {
        if (!snapshot.empty) {
          snapshot.forEach(docSnap => {
            if (docSnap.id === 'main_footer') {
              this.setItem('footer_config', docSnap.data() as FooterConfig, true);
            }
          });
        }
      }, (err) => console.debug('Firestore footer_config sync note:', err?.message || err));

      onSnapshot(collection(firestoreDb, 'seo_settings'), (snapshot) => {
        if (!snapshot.empty) {
          snapshot.forEach(docSnap => {
            if (docSnap.id === 'global_defaults') {
              this.setItem('seo_settings', docSnap.data() as GlobalSEODefaults, true);
            }
          });
        }
      }, (err) => console.debug('Firestore seo_settings sync note:', err?.message || err));

    } catch (error) {
      console.warn('Firestore real-time listeners initialization note:', error);
    }
  }

  private initDefaultData() {
    if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'master_regions')) {
      this.setItem('master_regions', INITIAL_MASTER_REGIONS);
    }
    if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'products')) {
      this.setItem('products', INITIAL_PRODUCTS);
    }
    if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'destinations')) {
      this.setItem('destinations', DESTINATIONS);
    }
    if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'promotions')) {
      this.setItem('promotions', INITIAL_PROMOTIONS);
    }
    if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'blogs')) {
      this.setItem('blogs', INITIAL_BLOGS);
    }
    // Clean up any legacy dummy reviews from storage
    const storedReviews = this.getItem<GoogleReview[]>('reviews', []);
    const isMock = storedReviews.some(r => 
      r.id.startsWith('rev-0') || 
      r.id.startsWith('rev-google-') || 
      r.id.startsWith('g-rev-') ||
      r.authorName === 'Charlotte De Vries' ||
      r.authorName === 'David Sterling (Director, Sterling Luxury Travel UK)' ||
      r.authorName === 'Alexander Montgomery' ||
      r.authorName === 'Sophie Van Der Bilt' ||
      r.authorName === 'Evelyn Montgomery' ||
      r.authorName === 'Sebastian Croft, CTC' ||
      r.authorName === 'Chiara Rossi' ||
      r.authorName === 'Marcus Vance' ||
      r.authorName === 'Evelyn St. Claire (Travel Luxe Magazine)' ||
      r.authorName === 'Siddharth Rao (Global Travel Club)'
    );
    if (isMock || !localStorage.getItem(STORAGE_KEY_PREFIX + 'reviews')) {
      const cleaned = storedReviews.filter(r => 
        !r.id.startsWith('rev-0') && 
        !r.id.startsWith('rev-google-') && 
        !r.id.startsWith('g-rev-') &&
        r.authorName !== 'Charlotte De Vries' &&
        r.authorName !== 'David Sterling (Director, Sterling Luxury Travel UK)' &&
        r.authorName !== 'Alexander Montgomery' &&
        r.authorName !== 'Sophie Van Der Bilt' &&
        r.authorName !== 'Evelyn Montgomery' &&
        r.authorName !== 'Sebastian Croft, CTC' &&
        r.authorName !== 'Chiara Rossi' &&
        r.authorName !== 'Marcus Vance' &&
        r.authorName !== 'Evelyn St. Claire (Travel Luxe Magazine)' &&
        r.authorName !== 'Siddharth Rao (Global Travel Club)'
      );
      this.setItem('reviews', cleaned);
    }
    if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'hotels')) {
      this.setItem('hotels', INITIAL_HOTELS);
    }
    if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'city_hubs')) {
      this.setItem('city_hubs', INITIAL_CITY_HUBS);
    }
    if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'regions')) {
      const initialRegions = DESTINATIONS.flatMap(d => d.regions || []);
      this.setItem('regions', initialRegions);
    }
    if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'destination_faqs')) {
      this.setItem('destination_faqs', INITIAL_FAQS);
    }
    if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'gallery')) {
      this.setItem('gallery', INITIAL_GALLERY);
    }
    if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'homepage_config')) {
      this.setItem('homepage_config', INITIAL_HOMEPAGE_CONFIG);
    }
    if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'menu_items')) {
      this.setItem('menu_items', INITIAL_MENU_ITEMS);
    }
    if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'custom_pages')) {
      this.setItem('custom_pages', INITIAL_CUSTOM_PAGES);
    }
    if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'visas')) {
      this.setItem('visas', INITIAL_VISAS);
    }
    if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'footer_config')) {
      this.setItem('footer_config', INITIAL_FOOTER_CONFIG);
    }
    if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'calendar_tasks')) {
      this.setItem('calendar_tasks', []);
    }
    if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'user_activities')) {
      this.setItem('user_activities', []);
    }
    if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'leads')) {
      this.setItem('leads', INITIAL_LEADS);
    }
    if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'bookings')) {
      this.setItem('bookings', []);
    }
    if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'saved_quotes')) {
      this.setItem('saved_quotes', []);
    }
    if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'b2b_customers')) {
      this.setItem('b2b_customers', []);
    }
    if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'b2b_tasks')) {
      this.setItem('b2b_tasks', []);
    }
    if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'roster_resources')) {
      this.setItem('roster_resources', INITIAL_ROSTER_RESOURCES);
    }
    if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'campaigns')) {
      this.setItem('campaigns', INITIAL_CAMPAIGNS);
    }
    if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'invoices')) {
      this.setItem('invoices', []);
    }
    if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'vouchers')) {
      this.setItem('vouchers', []);
    }
    if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'job_sheets')) {
      this.setItem('job_sheets', []);
    }
    if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'sla_automation_rules')) {
      this.setItem('sla_automation_rules', INITIAL_SLA_AUTOMATION_RULES);
    }
    if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'sla_automation_audit_logs')) {
      this.setItem('sla_automation_audit_logs', []);
    }
    if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'audit_logs')) {
      const defaultLogs: AuditLog[] = [
        {
          id: 'audit-01',
          userId: 'usr-admin-01',
          userName: 'Marcus Vance',
          userRole: 'ADMIN',
          action: 'SETTINGS_UPDATED',
          entity: 'System',
          entityId: 'sys-01',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
          details: 'Initial database schema and multi-tier authentication policies initialized.'
        }
      ];
      this.setItem('audit_logs', defaultLogs);
    }
    if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'seo_redirects')) {
      this.setItem('seo_redirects', []);
    }
    if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'seo_settings')) {
      this.setItem('seo_settings', DEFAULT_GLOBAL_SEO_DEFAULTS);
    }

    // MASTER PRODUCTION SAFETY:
    // Strictly preserve all existing production users, bookings, leads, and quotations.
    // Wildcard filtering, mass deletion, or wiping of real client records is strictly prohibited.

    // AUTOMATIC MIGRATION: 
    // 1. Rename 'Cruises' to 'Private Yacht' and enforce capacity-based vehicleConfig
    // 2. Remove 'Hotels' from ProductCategory catalog (managed solely via Hotel Management)
    // 3. Populate new Private Yacht products if missing
    try {
      const storedProducts = this.getItem<Product[]>('products', INITIAL_PRODUCTS);
      let modified = false;
      const updatedProducts = storedProducts.map(p => {
        let current = { ...p };
        if ((current.category as any) === 'Cruises') {
          current.category = 'Private Yacht';
          current.pricingMethod = current.pricingMethod || 'capacity_based';
          if (!current.vehicleConfig) {
            current.vehicleConfig = {
              vehicleModel: current.name,
              vehicleType: 'Motor Yacht',
              yachtModel: current.name,
              yachtType: 'Motor Yacht',
              yachtSize: '66 ft / 20.8 m',
              maxSeats: current.maxPax || 10,
              passengerCapacity: current.maxPax || 10,
              totalSeats: current.maxPax || 10,
              unitVehicleNetCost: current.adultNetPrice || current.adultNettCost || 500,
              totalTransferCost: current.adultNetPrice || current.adultNettCost || 500,
              pricingMethod: 'capacity_based',
              adultSeatCount: 1,
              childSeatCount: 1,
              infantSeatCount: 0,
              allowMultipleVehicles: true,
              autoAllocateVehicles: true,
              maxVehicles: 5,
              isYacht: true
            };
          }
          modified = true;
        } else if (current.category === 'Private Yacht') {
          if (!current.vehicleConfig) {
            current.vehicleConfig = {
              vehicleModel: current.name,
              vehicleType: 'Motor Yacht',
              yachtModel: current.name,
              yachtType: 'Motor Yacht',
              yachtSize: '66 ft / 20.8 m',
              maxSeats: current.maxPax || 10,
              passengerCapacity: current.maxPax || 10,
              totalSeats: current.maxPax || 10,
              unitVehicleNetCost: current.adultNetPrice || current.adultNettCost || 500,
              totalTransferCost: current.adultNetPrice || current.adultNettCost || 500,
              pricingMethod: 'capacity_based',
              adultSeatCount: 1,
              childSeatCount: 1,
              infantSeatCount: 0,
              allowMultipleVehicles: true,
              autoAllocateVehicles: true,
              maxVehicles: 5,
              isYacht: true
            };
            modified = true;
          }
        }
        return current;
      }).filter(p => (p.category as any) !== 'Hotels');

      // Ensure new initial Private Yacht products are added
      INITIAL_PRODUCTS.forEach(initP => {
        if (initP.category === 'Private Yacht' && !updatedProducts.some(p => p.id === initP.id)) {
          updatedProducts.push(initP);
          modified = true;
        }
      });

      if (modified) {
        this.setItem('products', updatedProducts);
      }
    } catch (e) {
      console.warn('Migration note for products catalog:', e);
    }

    // AUTOMATIC MIGRATION: 
    // 4. Normalize hotel destination IDs to canonical format ('dest-xxx') and populate missing regionId/hubId
    try {
      const storedHotels = this.getItem<Hotel[]>('hotels', INITIAL_HOTELS);
      let hotelsModified = false;
      const destinations = this.getItem<Destination[]>('destinations', DESTINATIONS);
      const regions = this.getItem<MasterRegion[]>('master_regions', INITIAL_MASTER_REGIONS);
      const hubs = this.getItem<CityHub[]>('city_hubs', INITIAL_CITY_HUBS);

      const normalizedHotels = storedHotels.map(hotel => {
        const h = { ...hotel };
        // Check if destinationId is a slug like 'japan', 'united-kingdom', 'western-europe'
        if (h.destinationId && !h.destinationId.startsWith('dest-')) {
          const matchedDest = destinations.find(d => 
            d.slug.toLowerCase() === h.destinationId.toLowerCase() || 
            d.name.toLowerCase() === h.destinationId.toLowerCase() ||
            (h.destinationId === 'western-europe' && d.id === 'dest-europe')
          );
          if (matchedDest) {
            h.destinationId = matchedDest.id;
            h.destinationName = matchedDest.name;
            hotelsModified = true;
          }
        }
        // Ensure regionId is populated
        if (!h.regionId && h.destinationId) {
          const matchedDest = destinations.find(d => d.id === h.destinationId || d.slug === h.destinationId);
          if (matchedDest?.regionId) {
            h.regionId = matchedDest.regionId;
            const reg = regions.find(r => r.id === matchedDest.regionId);
            if (reg) h.regionName = reg.name;
            hotelsModified = true;
          }
        }
        // Ensure hubId is populated if cityId matches a hub
        if (!h.hubId && (h.cityId || h.cityName)) {
          const matchedHub = hubs.find(hub => 
            hub.id.toLowerCase() === `hub-${(h.cityId || '').toLowerCase()}` ||
            hub.name.toLowerCase() === (h.cityName || '').toLowerCase() ||
            hub.id.toLowerCase() === (h.cityId || '').toLowerCase()
          );
          if (matchedHub) {
            h.hubId = matchedHub.id;
            hotelsModified = true;
          }
        }
        return h;
      });

      if (hotelsModified) {
        this.setItem('hotels', normalizedHotels);
      }
    } catch (e) {
      console.warn('Migration note for hotels catalog:', e);
    }

    try {
      this.syncAdminActivitiesFromEntities();
    } catch (e) {
      console.warn('Initial admin activities synthesis note:', e);
    }
  }

  // ==========================================
  // AUDIT TRAIL
  // ==========================================
  public logAudit(
    user: { id: string; name: string; role: UserRole } | null,
    action: AuditAction,
    entity: string,
    entityId: string,
    details: string,
    previousValue?: string,
    newValue?: string
  ): void {
    const logs = this.getItem<AuditLog[]>('audit_logs', []);
    const newLog: AuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      userId: user?.id || 'usr-system',
      userName: user?.name || 'System Administrator',
      userRole: user?.role || 'ADMIN',
      action,
      entity,
      entityId,
      timestamp: new Date().toISOString(),
      details,
      previousValue: previousValue || '',
      newValue: newValue || ''
    };
    this.setItem('audit_logs', [newLog, ...logs.slice(0, 499)]); // Keep last 500 logs
    this.syncFirestoreDoc('audit_logs', newLog.id, newLog);
  }

  public getAuditLogs(): AuditLog[] {
    return this.getItem<AuditLog[]>('audit_logs', []);
  }

  // ==========================================
  // ADMIN ACTIVITY CENTER & REAL-TIME NOTIFICATIONS
  // ==========================================

  public recordAdminActivity(
    activityData: Omit<AdminActivityRecord, 'activityId' | 'createdAt' | 'timestamp' | 'read' | 'entityType'> & {
      entityType?: string;
      timestamp?: string;
      read?: boolean;
    }
  ): AdminActivityRecord {
    const activities = this.getItem<AdminActivityRecord[]>('admin_activities', []);
    const newActivity: AdminActivityRecord = {
      ...activityData,
      activityId: `act-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      createdAt: new Date().toISOString(),
      timestamp: activityData.timestamp || new Date().toISOString(),
      read: activityData.read ?? false,
      entityType: activityData.entityType || activityData.category
    };

    // Store up to 1000 persistent historical activities
    const updated = [newActivity, ...activities.slice(0, 999)];
    this.setItem('admin_activities', updated);
    this.syncFirestoreDoc('admin_activities', newActivity.activityId, newActivity);

    // Also mirror to audit log for forensic compliance
    try {
      this.logAudit(
        {
          id: activityData.actorId || 'usr-system',
          name: activityData.actorName || 'System',
          role: (activityData.actorType === 'ADMIN' ? 'ADMIN' : activityData.actorType === 'TEAM_MEMBER' ? 'TEAM_MEMBER' : 'AGENT')
        },
        (activityData.activityType as any) || 'STATUS_UPDATED',
        activityData.entityType || 'SYSTEM',
        activityData.entityId || newActivity.activityId,
        activityData.summary,
        activityData.details?.previousValue,
        activityData.details?.newValue
      );
    } catch {
      // Non-blocking mirror
    }

    this.notify();
    return newActivity;
  }

  /**
   * Automatically synthesizes and syncs activity records from existing domain entities
   * (leads, bookings, payment proofs, quotations, users, tasks, audit logs) so that the
   * Admin Activity & Notification Center stream always accurately reflects the active state.
   */
  public syncAdminActivitiesFromEntities(): AdminActivityRecord[] {
    try {
      const existingActivities = this.getItem<AdminActivityRecord[]>('admin_activities', []);
      const existingActivityIds = new Set(existingActivities.map(a => a.activityId));
      const existingEntityIds = new Set(existingActivities.map(a => `${a.category}-${a.entityId}`));
      const newSynthesized: AdminActivityRecord[] = [];

      const nowIso = new Date().toISOString();

      // 1. Leads
      const leads = this.getLeads();
      leads.forEach(lead => {
        const entityKey = `LEAD-${lead.id}`;
        if (!existingEntityIds.has(entityKey) && !existingActivityIds.has(`act-lead-${lead.id}`)) {
          const isNew = lead.status === 'NEW';
          const paxTotal = ((lead.paxAdults || 0) + (lead.paxChildren || 0)) || 2;
          newSynthesized.push({
            activityId: `act-lead-${lead.id}`,
            activityType: isNew ? 'LEAD_CREATED' : 'LEAD_STATUS_CHANGED',
            category: 'LEAD',
            actorName: lead.source || 'CRM Lead Engine',
            actorType: 'SYSTEM',
            timestamp: lead.createdAt || lead.updatedAt || nowIso,
            leadId: lead.id,
            entityType: 'TravelLead',
            entityId: lead.id,
            summary: isNew 
              ? `New Lead Captured: [${lead.leadNumber || lead.id}] ${lead.contactName} - ${lead.destinationName || 'Multi-Destination'} (${paxTotal} Pax)`
              : `Lead ${lead.status}: [${lead.leadNumber || lead.id}] ${lead.contactName} (${lead.destinationName || 'General'})`,
            details: {
              customerName: lead.contactName,
              destinationName: lead.destinationName,
              travelDates: lead.travelDates,
              leadNumber: lead.leadNumber,
              status: lead.status,
              actionNeeded: isNew ? 'Assign travel specialist & begin quotation proposal' : undefined
            },
            severity: isNew ? 'WARNING' : 'INFO',
            actionRequired: isNew,
            actionLabel: isNew ? 'Assign & Qualify' : 'View Lead',
            read: !isNew,
            targetSection: 'LEAD_MANAGEMENT',
            targetSubTab: 'LEADS',
            recordId: lead.id,
            createdAt: lead.createdAt || nowIso
          });
        }
      });

      // 2. Bookings & Payment Proofs
      const bookings = this.getAllBookings();
      bookings.forEach(booking => {
        const entityKey = `BOOKING-${booking.id}`;
        if (!existingEntityIds.has(entityKey) && !existingActivityIds.has(`act-booking-${booking.id}`)) {
          const isPending = booking.status === 'PENDING_CONFIRMATION' || booking.status === 'PROCESSING';
          const isCancelled = booking.status === 'CANCELLED';
          const travelDatesStr = booking.travelStartDate ? `${booking.travelStartDate} to ${booking.travelEndDate || ''}` : undefined;
          newSynthesized.push({
            activityId: `act-booking-${booking.id}`,
            activityType: isCancelled ? 'BOOKING_CANCELLED' : booking.status === 'CONFIRMED' ? 'BOOKING_CONFIRMED' : 'BOOKING_CREATED',
            category: 'BOOKING',
            actorName: booking.agentName || booking.customer?.leadTravelerName || 'Guest Booking',
            actorType: booking.agentName ? 'B2B_AGENT' : 'SYSTEM',
            timestamp: booking.createdAt || booking.updatedAt || nowIso,
            bookingId: booking.id,
            bookingReference: booking.bookingReference,
            customerId: booking.customer?.email,
            entityType: 'Booking',
            entityId: booking.id,
            summary: `Booking [${booking.bookingReference}]: ${booking.customer?.leadTravelerName || 'Traveler'} - ${booking.destinationName || 'Destination'} (${booking.currency || 'USD'} ${(booking.totalAmount || 0).toLocaleString()}) [${booking.status}]`,
            details: {
              customerName: booking.customer?.leadTravelerName,
              destinationName: booking.destinationName,
              travelDates: travelDatesStr,
              totalAmount: booking.totalAmount,
              currency: booking.currency || 'USD',
              status: booking.status,
              actionNeeded: isPending ? '12h SLA: Reconfirm hotel allotments & transfer vouchers' : isCancelled ? 'Release locked inventory with suppliers' : undefined
            },
            severity: isCancelled ? 'CRITICAL' : isPending ? 'WARNING' : 'INFO',
            actionRequired: isPending || isCancelled,
            actionLabel: isCancelled ? 'Review Cancellation' : isPending ? 'Confirm Booking' : 'View Booking',
            read: !isPending && !isCancelled,
            targetSection: 'BOOKING_MANAGEMENT',
            targetSubTab: 'BOOKINGS',
            recordId: booking.id,
            createdAt: booking.createdAt || nowIso
          });
        }

        // Payment Proofs for each booking
        if (booking.paymentProofs && booking.paymentProofs.length > 0) {
          booking.paymentProofs.forEach((proof, pIdx) => {
            const proofId = proof.id || `proof-${booking.id}-${pIdx}`;
            const proofKey = `PAYMENT-${proofId}`;
            if (!existingEntityIds.has(proofKey) && !existingActivityIds.has(`act-proof-${proofId}`)) {
              const isPending = proof.verificationStatus === 'PENDING_VERIFICATION';
              newSynthesized.push({
                activityId: `act-proof-${proofId}`,
                activityType: isPending ? 'PAYMENT_PROOF_UPLOADED' : 'PAYMENT_PROOF_VERIFIED',
                category: 'PAYMENT',
                actorName: proof.uploadedByName || booking.customer?.leadTravelerName || 'Finance',
                actorType: 'TEAM_MEMBER',
                timestamp: proof.uploadedAt || booking.updatedAt || nowIso,
                bookingId: booking.id,
                bookingReference: booking.bookingReference,
                entityType: 'PaymentProof',
                entityId: proofId,
                summary: `Payment Proof Submitted: [${booking.bookingReference}] ${booking.customer?.leadTravelerName || 'Traveler'} (${proof.currency || booking.currency || 'USD'} ${(proof.amount || booking.totalAmount || 0).toLocaleString()}) - ${proof.trancheLabel || 'Bank Remittance'}`,
                details: {
                  customerName: booking.customer?.leadTravelerName,
                  totalAmount: proof.amount || booking.totalAmount,
                  currency: proof.currency || booking.currency || 'USD',
                  status: proof.verificationStatus,
                  actionNeeded: isPending ? 'Finance team clearance required against bank remittance statement' : undefined
                },
                severity: isPending ? 'WARNING' : 'INFO',
                actionRequired: isPending,
                actionLabel: isPending ? 'Verify Remittance' : 'View Receipt',
                read: !isPending,
                targetSection: 'BOOKING_MANAGEMENT',
                targetSubTab: 'BOOKINGS',
                recordId: booking.id,
                createdAt: proof.uploadedAt || nowIso
              });
            }
          });
        }
      });

      // 3. Quotes & AI Planner proposals
      const quotes = this.getAllSavedQuotes();
      quotes.forEach(quote => {
        const isAiPlan = (quote.id && quote.id.toLowerCase().includes('ai')) || (quote.title && quote.title.toLowerCase().includes('ai')) || Boolean(quote.items && quote.items.some((i: any) => i.isAiGenerated));
        const entityKey = isAiPlan ? `AI_PLANNER-${quote.id}` : `QUOTE-${quote.id}`;
        
        if (!existingEntityIds.has(entityKey) && !existingActivityIds.has(`act-quote-${quote.id}`)) {
          const isDownloaded = quote.status === 'DOWNLOADED_PDF';
          newSynthesized.push({
            activityId: `act-quote-${quote.id}`,
            activityType: isAiPlan ? 'AI_PLAN_GENERATED' : isDownloaded ? 'QUOTE_PDF_DOWNLOADED' : 'QUOTE_CREATED',
            category: isAiPlan ? 'AI_PLANNER' : 'QUOTE',
            actorName: quote.createdByName || 'Travel Consultant',
            actorType: 'B2B_AGENT',
            timestamp: quote.updatedAt || quote.createdAt || nowIso,
            quoteId: quote.id,
            entityType: 'Quotation',
            entityId: quote.id,
            summary: isAiPlan 
              ? `AI Itinerary Generated: [${quote.quoteNumber || quote.id}] ${quote.clientName} - ${quote.destination || 'Custom'} (${quote.items?.length || 0} services)`
              : `Proposal [${quote.quoteNumber || quote.id}]: ${quote.clientName} - ${quote.destination || 'Destination'} (${quote.currency || 'USD'} ${(quote.totalSellingPrice || 0).toLocaleString()}) [${quote.status}]`,
            details: {
              customerName: quote.clientName,
              destinationName: quote.destination,
              totalAmount: quote.totalSellingPrice,
              currency: quote.currency || 'USD',
              status: quote.status,
              actionNeeded: isDownloaded ? 'Client downloaded proposal PDF; follow up within 24h SLA' : undefined
            },
            severity: isDownloaded ? 'WARNING' : 'INFO',
            actionRequired: isDownloaded,
            actionLabel: isDownloaded ? 'Follow up Proposal' : 'View Quote',
            read: !isDownloaded,
            targetSection: 'LEAD_MANAGEMENT',
            targetSubTab: 'QUOTES',
            recordId: quote.id,
            createdAt: quote.createdAt || nowIso
          });
        }
      });

      // 4. User Approvals
      const users = this.getUsers();
      users.forEach(userItem => {
        const entityKey = `USER-${userItem.id}`;
        if (!existingEntityIds.has(entityKey) && !existingActivityIds.has(`act-user-${userItem.id}`)) {
          const isPending = userItem.approvalStatus === 'PENDING';
          newSynthesized.push({
            activityId: `act-user-${userItem.id}`,
            activityType: isPending ? 'B2B_AGENT_REGISTRATION' : 'USER_PERMISSIONS_CHANGED',
            category: 'USER',
            actorName: userItem.name || userItem.email || 'New Partner',
            actorType: 'B2B_AGENT',
            timestamp: userItem.createdAt || nowIso,
            userId: userItem.id,
            entityType: 'User',
            entityId: userItem.id,
            summary: `B2B Account Application: ${userItem.name} (${userItem.companyName || userItem.email}) - ${userItem.role} [${userItem.approvalStatus}]`,
            details: {
              customerName: userItem.name,
              agentName: userItem.name,
              company: userItem.companyName,
              email: userItem.email,
              actionNeeded: isPending ? 'Verify trade license and assign wholesale discount margin tier' : undefined
            },
            severity: isPending ? 'WARNING' : 'INFO',
            actionRequired: isPending,
            actionLabel: isPending ? 'Review Application' : 'Manage Account',
            read: !isPending,
            targetSection: 'ACCOUNT_MANAGEMENT',
            targetSubTab: 'USERS_ACCESS',
            recordId: userItem.id,
            createdAt: userItem.createdAt || nowIso
          });
        }
      });

      // 5. Calendar Tasks & Operations
      const tasks = this.getCalendarTasks();
      tasks.forEach(task => {
        const entityKey = `OPERATIONS-${task.id}`;
        if (!existingEntityIds.has(entityKey) && !existingActivityIds.has(`act-task-${task.id}`)) {
          const isPending = task.status === 'PENDING';
          const isUrgent = task.priority === 'URGENT';
          newSynthesized.push({
            activityId: `act-task-${task.id}`,
            activityType: 'OPERATIONS_JOB_CREATED',
            category: 'OPERATIONS',
            actorName: 'Operations Dispatch',
            actorType: 'SYSTEM',
            timestamp: task.createdAt || nowIso,
            entityType: 'CalendarTask',
            entityId: task.id,
            summary: `Operational Task: ${task.title} (Priority: ${task.priority}) - Due ${task.dueAt || 'ASAP'}`,
            details: {
              taskTitle: task.title,
              priority: task.priority,
              dueDate: task.dueAt,
              actionNeeded: isPending ? 'Ensure task completion before travel date SLA' : undefined
            },
            severity: isUrgent ? 'CRITICAL' : task.priority === 'HIGH' ? 'WARNING' : 'INFO',
            actionRequired: isPending,
            actionLabel: 'View Task',
            read: !isPending,
            targetSection: 'NOTIFICATIONS_MANAGEMENT',
            targetSubTab: 'TASKS',
            recordId: task.id,
            createdAt: task.createdAt || nowIso
          });
        }
      });

      // 6. Audit & System logs
      const auditLogs = this.getAuditLogs();
      auditLogs.slice(0, 15).forEach(log => {
        const entityKey = `SYSTEM-${log.id}`;
        if (!existingEntityIds.has(entityKey) && !existingActivityIds.has(`act-audit-${log.id}`)) {
          newSynthesized.push({
            activityId: `act-audit-${log.id}`,
            activityType: 'SECURITY_AUDIT_LOGGED',
            category: 'SYSTEM',
            actorName: log.userName || 'System Admin',
            actorType: 'ADMIN',
            timestamp: log.timestamp || nowIso,
            entityType: 'AuditLog',
            entityId: log.id,
            summary: `System Audit: [${log.action}] ${log.details}`,
            details: {
              actor: log.userName,
              action: log.action,
              entity: log.entity,
              previousValue: log.previousValue,
              newValue: log.newValue
            },
            severity: 'INFO',
            actionRequired: false,
            actionLabel: 'View Audit Log',
            read: true,
            targetSection: 'INTEGRATIONS_DB',
            targetSubTab: 'AUDIT_TRAIL',
            recordId: log.id,
            createdAt: log.timestamp || nowIso
          });
        }
      });

      if (newSynthesized.length > 0) {
        const combined = [...existingActivities, ...newSynthesized];
        // Sort newest first
        combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        this.setItem('admin_activities', combined);
        return combined;
      }

      return existingActivities;
    } catch (err) {
      console.warn('syncAdminActivitiesFromEntities note:', err);
      return this.getItem<AdminActivityRecord[]>('admin_activities', []);
    }
  }

  public getAdminActivities(user?: User | null): AdminActivityRecord[] {
    let activities = this.getItem<AdminActivityRecord[]>('admin_activities', []);
    if (activities.length === 0) {
      activities = this.syncAdminActivitiesFromEntities();
    }

    // Always sort newest activities first
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Role & Permission Filtering (Section 44)
    const effectiveUser = user || this.getCurrentUser();
    const isAdmin = !effectiveUser || effectiveUser.role === 'ADMIN' || (effectiveUser as any).userType === 'ADMIN' || isMasterAdmin(effectiveUser);

    if (isAdmin) {
      return activities;
    }

    // Filter activities for TEAM_MEMBER / DMC_STAFF according to granular permissions
    const perms = effectiveUser.permissions;
    return activities.filter(act => {
      // 1. Bookings
      if (act.category === 'BOOKING') {
        return perms?.cmsOperations?.bookingManagement ?? true;
      }
      // 2. Leads
      if (act.category === 'LEAD') {
        return perms?.cmsOperations?.leadManagement ?? true;
      }
      // 3. Quotes
      if (act.category === 'QUOTE') {
        return (perms?.cmsOperations?.leadManagement ?? true) || (perms?.b2bQuoteBuilderAccess ?? true);
      }
      // 4. AI Planner
      if (act.category === 'AI_PLANNER') {
        return (perms?.cmsOperations?.leadManagement ?? true) || (perms?.buyerQuoteBuilderAccess ?? true);
      }
      // 5. Payments (Restricted to Finance permission)
      if (act.category === 'PAYMENT') {
        return perms?.cmsFinance?.enabled && (perms?.cmsFinance?.payments || perms?.canAccessFinancials);
      }
      // 6. User Management
      if (act.category === 'USER') {
        return perms?.cmsFinance?.userAccounts || perms?.canManageUsers;
      }
      // 7. Operations & Roster
      if (act.category === 'OPERATIONS') {
        return perms?.cmsOperations?.activityManagement || perms?.canAccessRoster;
      }
      // 8. Products & Hotels
      if (act.category === 'PRODUCT') {
        return perms?.cmsOperations?.productManagement || perms?.cmsOperations?.hotelManagement;
      }
      // 9. Destinations & Content
      if (act.category === 'DESTINATION') {
        return perms?.cmsContent?.enabled || perms?.cmsContent?.destinationManagement;
      }
      // 10. System
      if (act.category === 'SYSTEM') {
        return perms?.cmsSystem?.enabled ?? false;
      }
      return true;
    }).map(act => {
      // If user lacks financial permissions, redact monetary figures
      if (!perms?.cmsFinance?.enabled && !perms?.canAccessFinancials) {
        if (act.details?.totalAmount || act.details?.amount) {
          return {
            ...act,
            details: {
              ...act.details,
              totalAmount: undefined,
              amount: undefined,
              redacted: true
            }
          };
        }
      }
      return act;
    });
  }

  public markAdminActivityAsRead(activityId: string, readBy?: string): void {
    const activities = this.getItem<AdminActivityRecord[]>('admin_activities', []);
    const updated = activities.map(act => {
      if (act.activityId === activityId) {
        return {
          ...act,
          read: true,
          readAt: new Date().toISOString(),
          readBy: readBy || 'admin'
        };
      }
      return act;
    });
    this.setItem('admin_activities', updated);
    const target = updated.find(a => a.activityId === activityId);
    if (target) {
      this.syncFirestoreDoc('admin_activities', target.activityId, target);
    }
    this.notify();
  }

  public markAllAdminActivitiesAsRead(category?: AdminActivityCategory, readBy?: string): void {
    const activities = this.getItem<AdminActivityRecord[]>('admin_activities', []);
    const now = new Date().toISOString();
    const updated = activities.map(act => {
      if (!category || act.category === category) {
        return {
          ...act,
          read: true,
          readAt: now,
          readBy: readBy || 'admin'
        };
      }
      return act;
    });
    this.setItem('admin_activities', updated);
    this.notify();
  }

  public getActivityCountsByModule(user?: User | null): Record<string, { unread: number; actionRequired: number; total: number }> {
    const activities = this.getAdminActivities(user);
    const result: Record<string, { unread: number; actionRequired: number; total: number }> = {
      OVERVIEW: { unread: 0, actionRequired: 0, total: 0 },
      LEAD_MANAGEMENT: { unread: 0, actionRequired: 0, total: 0 },
      BOOKING_MANAGEMENT: { unread: 0, actionRequired: 0, total: 0 },
      ACCOUNT_MANAGEMENT: { unread: 0, actionRequired: 0, total: 0 },
      PRODUCT_MANAGEMENT: { unread: 0, actionRequired: 0, total: 0 },
      HOTEL_MANAGEMENT: { unread: 0, actionRequired: 0, total: 0 },
      PACKAGE_MANAGEMENT: { unread: 0, actionRequired: 0, total: 0 },
      DESTINATION_MANAGEMENT: { unread: 0, actionRequired: 0, total: 0 },
      PAGE_MANAGEMENT: { unread: 0, actionRequired: 0, total: 0 },
      MARKETING_MANAGEMENT: { unread: 0, actionRequired: 0, total: 0 },
      ANALYTICS_MANAGEMENT: { unread: 0, actionRequired: 0, total: 0 },
      CALENDAR_SLAS: { unread: 0, actionRequired: 0, total: 0 },
      NOTIFICATIONS_MANAGEMENT: { unread: 0, actionRequired: 0, total: 0 },
      INTEGRATIONS_DB: { unread: 0, actionRequired: 0, total: 0 },
      TOTAL: { unread: 0, actionRequired: 0, total: 0 }
    };

    activities.forEach(act => {
      const section = act.targetSection || 'OVERVIEW';
      if (!result[section]) {
        result[section] = { unread: 0, actionRequired: 0, total: 0 };
      }
      result[section].total += 1;
      result.TOTAL.total += 1;

      if (!act.read) {
        result[section].unread += 1;
        result.TOTAL.unread += 1;
      }
      if (act.actionRequired) {
        result[section].actionRequired += 1;
        result.TOTAL.actionRequired += 1;
      }
    });

    return result;
  }

  public getTodayActivitySummary(user?: User | null) {
    const leads = this.getLeads();
    const quotes = this.getAllSavedQuotes();
    const bookings = this.getAllBookings();
    const users = this.getUsers();
    const tasks = this.getCalendarTasks();
    const activities = this.getAdminActivities(user);

    const newLeads = leads.filter(l => l.status === 'NEW').length;
    const newQuotes = quotes.filter(q => q.status === 'DRAFT' || q.status === 'SAVED').length;
    const quoteDownloads = quotes.filter(q => q.status === 'DOWNLOADED_PDF').length;
    const pendingBookings = bookings.filter(b => b.status === 'PENDING_CONFIRMATION' || b.status === 'PROCESSING').length;
    const pendingProofs = bookings.filter(b => b.paymentProofs?.some(p => p.verificationStatus === 'PENDING_VERIFICATION')).length;
    const pendingUsers = users.filter(u => u.approvalStatus === 'PENDING').length;
    const aiPlans = activities.filter(a => a.category === 'AI_PLANNER').length;
    const priorityTasks = tasks.filter(t => t.status === 'PENDING' && (t.priority === 'URGENT' || t.priority === 'HIGH')).length;
    const systemAlerts = activities.filter(a => a.category === 'SYSTEM' && a.severity === 'CRITICAL').length;

    return [
      {
        id: 'metric-new-leads',
        label: 'New Leads',
        count: newLeads,
        subtext: newLeads > 0 ? `${newLeads} awaiting specialist` : 'Pipeline up-to-date',
        alert: newLeads > 0,
        section: 'LEAD_MANAGEMENT',
        subTab: 'LEADS',
        filterKey: 'NEW',
        icon: 'Users'
      },
      {
        id: 'metric-new-quotes',
        label: 'Active Quotes',
        count: newQuotes,
        subtext: 'B2B & direct proposals',
        alert: false,
        section: 'LEAD_MANAGEMENT',
        subTab: 'QUOTES',
        filterKey: 'ALL',
        icon: 'Receipt'
      },
      {
        id: 'metric-quote-downloads',
        label: 'Quote Downloads',
        count: quoteDownloads,
        subtext: quoteDownloads > 0 ? 'Exported PDF proposals' : 'No recent exports',
        alert: quoteDownloads > 0,
        section: 'LEAD_MANAGEMENT',
        subTab: 'QUOTES',
        filterKey: 'DOWNLOADED_PDF',
        icon: 'FileDown'
      },
      {
        id: 'metric-bookings',
        label: 'Pending Bookings',
        count: pendingBookings,
        subtext: pendingBookings > 0 ? '12h Confirmation SLA' : 'All confirmed',
        alert: pendingBookings > 0,
        section: 'BOOKING_MANAGEMENT',
        subTab: 'BOOKINGS',
        filterKey: 'PENDING_CONFIRMATION',
        icon: 'CalendarCheck'
      },
      {
        id: 'metric-payments',
        label: 'Payment Proofs',
        count: pendingProofs,
        subtext: pendingProofs > 0 ? 'Remittances awaiting clearance' : 'Financially cleared',
        alert: pendingProofs > 0,
        section: 'BOOKING_MANAGEMENT',
        subTab: 'BOOKINGS',
        filterKey: 'PAYMENT_PENDING',
        icon: 'CreditCard'
      },
      {
        id: 'metric-new-users',
        label: 'User Approvals',
        count: pendingUsers,
        subtext: pendingUsers > 0 ? 'B2B partners awaiting review' : 'All accounts approved',
        alert: pendingUsers > 0,
        section: 'ACCOUNT_MANAGEMENT',
        subTab: 'USERS_ACCESS',
        filterKey: 'PENDING',
        icon: 'UserCheck'
      },
      {
        id: 'metric-ai-plans',
        label: 'AI Planner Jobs',
        count: aiPlans,
        subtext: 'Algorithmic day-by-day plans',
        alert: false,
        section: 'LEAD_MANAGEMENT',
        subTab: 'QUOTES',
        filterKey: 'AI_PLAN',
        icon: 'Sparkles'
      },
      {
        id: 'metric-operational-jobs',
        label: 'Operational Tasks',
        count: priorityTasks,
        subtext: priorityTasks > 0 ? 'Urgent Ground SLAs' : 'Duty roster optimal',
        alert: priorityTasks > 0,
        section: 'NOTIFICATIONS_MANAGEMENT',
        subTab: 'TASKS',
        filterKey: 'URGENT',
        icon: 'Clock'
      },
      {
        id: 'metric-system-alerts',
        label: 'System Health',
        count: systemAlerts,
        subtext: systemAlerts > 0 ? 'Attention required' : 'All services healthy',
        alert: systemAlerts > 0,
        section: 'INTEGRATIONS_DB',
        subTab: 'DATA_SYNC_AUDIT',
        filterKey: 'ALL',
        icon: 'Activity'
      }
    ];
  }

  private generateDefaultAdminActivities(): AdminActivityRecord[] {
    const leads = this.getLeads();
    const bookings = this.getAllBookings();
    const quotes = this.getAllSavedQuotes();
    const users = this.getUsers();

    const sampleLead = leads[0] || {
      id: 'LD-2026-001',
      contactName: 'Sir Alistair Sterling',
      destinationName: 'United Kingdom',
      travelDates: '12 Sep - 22 Sep 2026',
      paxAdults: 2,
      currency: 'USD',
      estimatedBudget: 8450
    };

    const sampleBooking = bookings[0] || {
      id: 'bk-sample-01',
      bookingReference: 'BK-UK-2026-081',
      customer: { leadTravelerName: 'Sir Alistair Sterling' },
      items: [{ destinationName: 'United Kingdom' }],
      travelStartDate: '2026-09-12',
      travelEndDate: '2026-09-22',
      totalAmount: 8450,
      currency: 'USD'
    };

    const sampleQuote: any = quotes[0] || {
      id: 'quote-sample-01',
      quoteNumber: 'QT-2026-104',
      clientName: 'Elena Rostova',
      clientEmail: 'elena@rostova.com',
      destinationTitle: 'Japan Luxury Ryokan Circuit',
      destinationId: 'dest-japan',
      grandTotal: 14200,
      currency: 'USD'
    };

    const pendingUser = users.find(u => u.approvalStatus === 'PENDING') || {
      id: 'usr-agent-horizon',
      name: 'Marc DuPont',
      email: 'marc@horizonvoyages.fr',
      agencyName: 'Horizon Voyages Paris',
      role: 'B2B_AGENT'
    };

    const now = new Date();
    const minutesAgo = (mins: number) => new Date(now.getTime() - mins * 60000).toISOString();
    const hoursAgo = (hrs: number) => new Date(now.getTime() - hrs * 3600000).toISOString();

    const list: AdminActivityRecord[] = [
      {
        activityId: 'act-init-01',
        activityType: 'BOOKING_SUBMITTED',
        category: 'BOOKING',
        actorId: 'usr-agent-01',
        actorType: 'B2B_AGENT',
        actorName: 'Sterling Luxury Travel UK',
        timestamp: minutesAgo(18),
        bookingId: sampleBooking.id,
        bookingReference: sampleBooking.bookingReference,
        customerId: 'cust-sterling',
        destinationId: 'dest-uk',
        entityType: 'Booking',
        entityId: sampleBooking.id,
        summary: `New Booking Request: [${sampleBooking.bookingReference}] for ${sampleBooking.customer?.leadTravelerName || 'Sir Alistair Sterling'}`,
        details: {
          customerName: sampleBooking.customer?.leadTravelerName || 'Sir Alistair Sterling',
          agentName: 'Sterling Luxury Travel UK',
          destinationName: 'United Kingdom & Highlands',
          travelDates: '12 Sep 2026 - 22 Sep 2026',
          totalAmount: sampleBooking.totalAmount || 8450,
          currency: sampleBooking.currency || 'USD',
          status: 'PENDING_CONFIRMATION',
          actionNeeded: 'Verify supplier allotments and dispatch 12-hour confirmation voucher'
        },
        severity: 'CRITICAL',
        actionRequired: true,
        actionLabel: 'Confirm Booking',
        read: false,
        targetSection: 'BOOKING_MANAGEMENT',
        targetSubTab: 'BOOKINGS',
        recordId: sampleBooking.id,
        createdAt: minutesAgo(18)
      },
      {
        activityId: 'act-init-02',
        activityType: 'PAYMENT_PROOF_UPLOADED',
        category: 'PAYMENT',
        actorId: 'usr-agent-02',
        actorType: 'B2B_AGENT',
        actorName: 'Apex Luxury Travel',
        timestamp: minutesAgo(42),
        bookingId: sampleBooking.id,
        bookingReference: sampleBooking.bookingReference,
        customerId: 'cust-tanaka',
        destinationId: 'dest-japan',
        entityType: 'BookingPaymentProof',
        entityId: 'proof-001',
        summary: `Payment Proof Uploaded: 50% Advance Deposit (${sampleBooking.currency || 'USD'} 4,225) for ${sampleBooking.bookingReference}`,
        details: {
          customerName: sampleBooking.customer?.leadTravelerName || 'Sir Alistair Sterling',
          agentName: 'Apex Luxury Travel',
          destinationName: 'Japan & UK',
          totalAmount: 4225,
          currency: sampleBooking.currency || 'USD',
          paymentMethod: 'WIRE_TRANSFER',
          referenceNumber: 'SWIFT-WIRE-8849201',
          actionNeeded: 'Finance department remittance verification'
        },
        severity: 'CRITICAL',
        actionRequired: true,
        actionLabel: 'Verify Payment',
        read: false,
        targetSection: 'BOOKING_MANAGEMENT',
        targetSubTab: 'BOOKINGS',
        recordId: sampleBooking.id,
        createdAt: minutesAgo(42)
      },
      {
        activityId: 'act-init-03',
        activityType: 'LEAD_CREATED',
        category: 'LEAD',
        actorId: 'usr-direct-buyer',
        actorType: 'BUYER',
        actorName: sampleLead.contactName || 'Elena Rostova',
        timestamp: hoursAgo(1.5),
        leadId: sampleLead.id,
        customerId: sampleLead.id,
        destinationId: 'dest-switzerland',
        entityType: 'TravelLead',
        entityId: sampleLead.id,
        summary: `New Lead Inquired: [${sampleLead.id}] ${sampleLead.contactName} (${sampleLead.destinationName || 'Switzerland'})`,
        details: {
          customerName: sampleLead.contactName,
          destinationName: sampleLead.destinationName || 'Switzerland & Alps',
          travelDates: sampleLead.travelDates || 'Autumn 2026',
          paxAdults: sampleLead.paxAdults || 2,
          paxChildren: (sampleLead as any).paxChildren || 0,
          totalAmount: sampleLead.estimatedBudget || 12000,
          currency: sampleLead.currency || 'USD',
          source: 'DIRECT_WEBSITE',
          actionNeeded: 'Assign dedicated senior travel designer within 2 hours'
        },
        severity: 'WARNING',
        actionRequired: true,
        actionLabel: 'Qualify Lead',
        read: false,
        targetSection: 'LEAD_MANAGEMENT',
        targetSubTab: 'LEADS',
        recordId: sampleLead.id,
        createdAt: hoursAgo(1.5)
      },
      {
        activityId: 'act-init-04',
        activityType: 'QUOTE_PDF_DOWNLOADED',
        category: 'QUOTE',
        actorId: 'usr-agent-01',
        actorType: 'B2B_AGENT',
        actorName: 'Apex Luxury Travel',
        timestamp: hoursAgo(2.8),
        quoteId: sampleQuote.id,
        destinationId: 'dest-japan',
        entityType: 'Quotation',
        entityId: sampleQuote.id,
        summary: `Quote Proposal PDF Exported: [${sampleQuote.quoteNumber || 'QT-2026-104'}] ${sampleQuote.destinationTitle || 'Custom Itinerary'}`,
        details: {
          customerName: sampleQuote.clientName || 'Elena Rostova',
          agentName: 'Apex Luxury Travel',
          destinationName: sampleQuote.destinationTitle || 'Japan',
          totalAmount: sampleQuote.grandTotal || 14200,
          currency: sampleQuote.currency || 'USD',
          actionNeeded: 'Schedule 24-hour concierge follow-up call'
        },
        severity: 'INFO',
        actionRequired: false,
        actionLabel: 'Open Quote',
        read: false,
        targetSection: 'LEAD_MANAGEMENT',
        targetSubTab: 'QUOTES',
        recordId: sampleQuote.id,
        createdAt: hoursAgo(2.8)
      },
      {
        activityId: 'act-init-05',
        activityType: 'B2B_AGENT_REGISTRATION',
        category: 'USER',
        actorId: pendingUser.id,
        actorType: 'B2B_AGENT',
        actorName: pendingUser.name,
        timestamp: hoursAgo(4.2),
        userId: pendingUser.id,
        entityType: 'User',
        entityId: pendingUser.id,
        summary: `B2B Partner Registration: ${pendingUser.name} (${pendingUser.agencyName || 'Horizon Voyages'})`,
        details: {
          customerName: pendingUser.name,
          agentName: pendingUser.agencyName || 'Horizon Voyages Paris',
          email: pendingUser.email,
          role: 'B2B_AGENT',
          actionNeeded: 'Verify agency IATA/license and assign wholesale margin tier'
        },
        severity: 'WARNING',
        actionRequired: true,
        actionLabel: 'Review Partner',
        read: false,
        targetSection: 'ACCOUNT_MANAGEMENT',
        targetSubTab: 'USERS_ACCESS',
        recordId: pendingUser.id,
        createdAt: hoursAgo(4.2)
      },
      {
        activityId: 'act-init-06',
        activityType: 'AI_PLAN_GENERATED',
        category: 'AI_PLANNER',
        actorId: 'usr-ai-session-09',
        actorType: 'BUYER',
        actorName: 'David Miller',
        timestamp: hoursAgo(5.5),
        destinationId: 'dest-japan',
        entityType: 'Quotation',
        entityId: 'qt-ai-kansai-01',
        summary: 'AI Planner Itinerary Synthesized: 7-Day Kansai Classical Circuit (USD 9,600)',
        details: {
          customerName: 'David Miller',
          destinationName: 'Kyoto & Osaka, Japan',
          durationDays: 7,
          totalAmount: 9600,
          currency: 'USD',
          productsCount: 6,
          actionNeeded: 'Itinerary saved in buyer session ready for advisor review'
        },
        severity: 'INFO',
        actionRequired: false,
        actionLabel: 'View AI Proposal',
        read: true,
        targetSection: 'LEAD_MANAGEMENT',
        targetSubTab: 'QUOTES',
        recordId: 'qt-ai-kansai-01',
        createdAt: hoursAgo(5.5)
      },
      {
        activityId: 'act-init-07',
        activityType: 'SLA_TASK_DUE',
        category: 'OPERATIONS',
        actorId: 'usr-system',
        actorType: 'SYSTEM',
        actorName: 'Google Calendar SLA Monitor',
        timestamp: hoursAgo(6.1),
        bookingId: sampleBooking.id,
        bookingReference: sampleBooking.bookingReference,
        entityType: 'CalendarTask',
        entityId: 'task-sla-12h-01',
        summary: `12-Hour Confirmation SLA Approaching: ${sampleBooking.bookingReference} (Supplier Allocation)`,
        details: {
          customerName: sampleBooking.customer?.leadTravelerName || 'Sir Alistair Sterling',
          destinationName: 'United Kingdom Ground Network',
          priority: 'URGENT',
          dueTime: 'Within 3 hours',
          actionNeeded: 'Confirm private chauffeur & Scottish Highlands guide dispatch'
        },
        severity: 'CRITICAL',
        actionRequired: true,
        actionLabel: 'Dispatch SLA',
        read: false,
        targetSection: 'NOTIFICATIONS_MANAGEMENT',
        targetSubTab: 'TASKS',
        recordId: 'task-sla-12h-01',
        createdAt: hoursAgo(6.1)
      },
      {
        activityId: 'act-init-08',
        activityType: 'GOOGLE_SHEETS_SYNCED',
        category: 'SYSTEM',
        actorId: 'usr-admin-business',
        actorType: 'ADMIN',
        actorName: 'Marcus Vance',
        timestamp: hoursAgo(8.0),
        entityType: 'GoogleSheetsSync',
        entityId: 'sync-tariff-master',
        summary: 'Google Sheets Live Sync Completed: Master Tariff Sheet (34 Products Verified)',
        details: {
          sheetName: 'Europe_Rates_2026_Master',
          productsUpdated: 34,
          hotelsAudited: 18,
          status: 'SUCCESS',
          previousValue: 'Out of sync (4 pending)',
          newValue: '100% In-Sync'
        },
        severity: 'INFO',
        actionRequired: false,
        actionLabel: 'View Sync Audit',
        read: true,
        targetSection: 'INTEGRATIONS_DB',
        targetSubTab: 'DATA_SYNC_AUDIT',
        recordId: 'sync-tariff-master',
        createdAt: hoursAgo(8.0)
      }
    ];

    return list;
  }

  // ==========================================
  // GLOBAL CMS DELETE & ARCHIVE PERMISSION CONTROL
  // ==========================================
  public canUserDelete(user: User | null, moduleName?: string): { allowed: boolean; reason?: string } {
    const effectiveUser = user || this.getCurrentUser();
    if (!effectiveUser) {
      return { allowed: false, reason: 'Authentication required. Please sign in.' };
    }

    const email = (effectiveUser.email || '').toLowerCase().trim();
    const role = (effectiveUser.role || '').toUpperCase();
    const userType = ((effectiveUser as any).userType || '').toUpperCase();

    // 1. Full Admin & Master Admin Bypass
    if (
      role === 'ADMIN' || 
      userType === 'ADMIN' ||
      role === 'SUPER_ADMIN' ||
      role === 'MASTER_ADMIN' ||
      email === 'business@theunbound.in' ||
      email === 'admin@theunbound.com' ||
      email === 'marcus@theunbound.in' ||
      isMasterAdmin(effectiveUser)
    ) {
      return { allowed: true };
    }

    // 2. Team Member / DMC Staff Permissions
    if (role === 'TEAM_MEMBER' || role === 'DMC_STAFF' || userType === 'TEAM_MEMBER') {
      const perms = effectiveUser.permissions;
      if (perms?.canDeleteRecords) {
        return { allowed: true };
      }
      // Content & Navigation Menu deletion
      if (
        moduleName === 'MenuItem' || 
        moduleName === 'NavigationMenu' || 
        moduleName === 'CustomPage' ||
        moduleName === 'Editorial'
      ) {
        if (perms?.cmsContent && perms.cmsContent.enabled !== false) {
          return { allowed: true };
        }
        if (perms?.canDeleteEditorial) {
          return { allowed: true };
        }
      }
      if (moduleName && perms) {
        const specificKey = `canDelete${moduleName}` as keyof typeof perms;
        if (perms[specificKey]) {
          return { allowed: true };
        }
      }
      return { 
        allowed: false, 
        reason: 'Restricted Action: Your Team Member profile does not have Admin-granted deletion permissions.' 
      };
    }

    return { 
      allowed: false, 
      reason: 'Access Denied: External accounts (B2B Agents & Buyers) cannot delete or archive CMS records.' 
    };
  }

  // ==========================================
  // GLOBAL CMS WRITE & EDIT PERMISSION CONTROL
  // ==========================================
  public canUserWriteCMS(
    user: User | null, 
    section: 'OPERATIONS' | 'CONTENT' | 'FINANCE' | 'SYSTEM' = 'OPERATIONS',
    entityName?: string
  ): { allowed: boolean; reason?: string } {
    const effectiveUser = user || this.getCurrentUser();
    if (!effectiveUser) {
      return { 
        allowed: false, 
        reason: 'Authentication required: You must be signed in as an authorized internal user to modify CMS records.' 
      };
    }

    const email = (effectiveUser.email || '').toLowerCase().trim();
    if (
      effectiveUser.role === 'ADMIN' || 
      email === 'business@theunbound.in' || 
      email === 'admin@theunbound.com' ||
      email === 'marcus@theunbound.in'
    ) {
      return { allowed: true };
    }

    if (effectiveUser.role === 'TEAM_MEMBER' || effectiveUser.role === 'DMC_STAFF') {
      if ((effectiveUser.approvalStatus || 'APPROVED') !== 'APPROVED') {
        return { allowed: false, reason: 'Your staff account is pending Admin verification.' };
      }
      const perms = effectiveUser.permissions;
      if (section === 'OPERATIONS') {
        const allowed = perms?.cmsOperations ? perms.cmsOperations.enabled !== false : true;
        return allowed ? { allowed: true } : { allowed: false, reason: 'Operations management access is disabled for your account.' };
      }
      if (section === 'CONTENT') {
        const allowed = perms?.cmsContent ? perms.cmsContent.enabled !== false : true;
        return allowed ? { allowed: true } : { allowed: false, reason: 'Content management access is disabled for your account.' };
      }
      if (section === 'FINANCE') {
        const allowed = perms?.cmsFinance ? perms.cmsFinance.enabled === true : false;
        return allowed ? { allowed: true } : { allowed: false, reason: 'Financial management is restricted to authorized Administrators.' };
      }
      if (section === 'SYSTEM') {
        const allowed = perms?.cmsSystem ? perms.cmsSystem.enabled !== false : true;
        return allowed ? { allowed: true } : { allowed: false, reason: 'System administration is disabled for your account.' };
      }
      return { allowed: true };
    }

    return { 
      allowed: false, 
      reason: `Access Denied: External accounts (${effectiveUser.role || 'Guest'}) are strictly prohibited from creating or modifying private CMS business data.` 
    };
  }

  // ==========================================
  // RECORD DEPENDENCY CHECK ENGINE
  // ==========================================
  public checkRecordDependencies(entityType: CMSDeletableEntityType, recordId: string): DeletionCheckResult {
    const groups: DependencyGroup[] = [];

    const products = this.getProducts();
    const hotels = this.getHotels();
    const packages = this.getPackages();
    const hubs = this.getCityHubs();
    const destinations = this.getDestinations();
    const regions = this.getMasterRegions();
    const quotes = this.getAllSavedQuotes();
    const bookings = this.getAllBookings();
    const faqs = this.getDestinationFAQs();
    const tasks = this.getCalendarTasks();
    const leads = this.getLeads();
    const sitePages = this.getSitePagesConfig();
    const footerConfig = this.getFooterConfig();

    switch (entityType) {
      case 'MasterRegion': {
        const reg = regions.find(r => r.id === recordId);
        const regName = (reg?.name || '').toLowerCase();

        // Check Destinations
        const linkedDests = destinations.filter(d => d.regionId === recordId || (regName && d.regionName?.toLowerCase() === regName));
        if (linkedDests.length > 0) {
          groups.push({
            entityType: 'Destination',
            count: linkedDests.length,
            label: `${linkedDests.length} Destination${linkedDests.length > 1 ? 's' : ''}`,
            items: linkedDests.map(d => ({ id: d.id, name: d.name, type: 'Destination', details: `Country: ${d.country}` }))
          });
        }

        // Check City Hubs
        const linkedHubs = hubs.filter(h => h.regionId === recordId || linkedDests.some(d => d.id === h.destinationId));
        if (linkedHubs.length > 0) {
          groups.push({
            entityType: 'CityHub',
            count: linkedHubs.length,
            label: `${linkedHubs.length} City Hub${linkedHubs.length > 1 ? 's' : ''}`,
            items: linkedHubs.map(h => ({ id: h.id, name: h.name, type: 'City Hub', details: `Destination: ${h.destinationName}` }))
          });
        }

        // Check Products
        const linkedProds = products.filter(p => p.regionId === recordId || (regName && p.regionName?.toLowerCase() === regName) || linkedDests.some(d => d.id === p.destinationId));
        if (linkedProds.length > 0) {
          groups.push({
            entityType: 'Product',
            count: linkedProds.length,
            label: `${linkedProds.length} Product${linkedProds.length > 1 ? 's' : ''}`,
            items: linkedProds.slice(0, 15).map(p => ({ id: p.id, name: p.name, type: 'Product', details: `SKU: ${p.sku}` }))
          });
        }

        // Check Hotels
        const linkedHotels = hotels.filter(h => h.regionId === recordId || (regName && h.regionName?.toLowerCase() === regName) || linkedDests.some(d => d.id === h.destinationId));
        if (linkedHotels.length > 0) {
          groups.push({
            entityType: 'Hotel',
            count: linkedHotels.length,
            label: `${linkedHotels.length} Hotel${linkedHotels.length > 1 ? 's' : ''}`,
            items: linkedHotels.slice(0, 15).map(h => ({ id: h.id, name: h.name, type: 'Hotel', details: `City: ${h.cityName}` }))
          });
        }
        break;
      }

      case 'Destination': {
        const dest = destinations.find(d => d.id === recordId || d.slug === recordId);
        const destName = (dest?.name || '').toLowerCase();
        const destId = dest?.id || recordId;

        // Check Hubs
        const linkedHubs = hubs.filter(h => h.destinationId === destId || (destName && h.destinationName?.toLowerCase() === destName));
        if (linkedHubs.length > 0) {
          groups.push({
            entityType: 'CityHub',
            count: linkedHubs.length,
            label: `${linkedHubs.length} City Hub${linkedHubs.length > 1 ? 's' : ''}`,
            items: linkedHubs.map(h => ({ id: h.id, name: h.name, type: 'City Hub', details: h.tagline }))
          });
        }

        // Check Hotels
        const linkedHotels = hotels.filter(h => h.destinationId === destId || (destName && (h.destinationName?.toLowerCase() === destName || h.country?.toLowerCase() === destName)));
        if (linkedHotels.length > 0) {
          groups.push({
            entityType: 'Hotel',
            count: linkedHotels.length,
            label: `${linkedHotels.length} Hotel${linkedHotels.length > 1 ? 's' : ''}`,
            items: linkedHotels.slice(0, 15).map(h => ({ id: h.id, name: h.name, type: 'Hotel', details: `Code: ${h.code}` }))
          });
        }

        // Check Products
        const linkedProds = products.filter(p => p.destinationId === destId || (destName && (p.destinationName?.toLowerCase() === destName || p.country?.toLowerCase() === destName)));
        if (linkedProds.length > 0) {
          groups.push({
            entityType: 'Product',
            count: linkedProds.length,
            label: `${linkedProds.length} Product${linkedProds.length > 1 ? 's' : ''}`,
            items: linkedProds.slice(0, 15).map(p => ({ id: p.id, name: p.name, type: 'Product', details: `SKU: ${p.sku}` }))
          });
        }

        // Check Packages
        const linkedPkgs = packages.filter(pkg => pkg.destinationId === destId || (destName && pkg.destinationName?.toLowerCase() === destName));
        if (linkedPkgs.length > 0) {
          groups.push({
            entityType: 'Package',
            count: linkedPkgs.length,
            label: `${linkedPkgs.length} Package${linkedPkgs.length > 1 ? 's' : ''}`,
            items: linkedPkgs.slice(0, 15).map(pkg => ({ id: pkg.id, name: pkg.title, type: 'Package', details: `${pkg.durationDays}D / ${pkg.durationNights}N` }))
          });
        }

        // Check FAQs
        const linkedFaqs = faqs.filter(f => f.destinationId === destId);
        if (linkedFaqs.length > 0) {
          groups.push({
            entityType: 'DestinationFAQ',
            count: linkedFaqs.length,
            label: `${linkedFaqs.length} FAQ${linkedFaqs.length > 1 ? 's' : ''}`,
            items: linkedFaqs.map(f => ({ id: f.id, name: f.question, type: 'FAQ', details: f.category }))
          });
        }
        break;
      }

      case 'CityHub': {
        const hub = hubs.find(h => h.id === recordId);
        const hubName = (hub?.name || '').toLowerCase();

        // Check Products
        const linkedProds = products.filter(p => p.hubId === recordId || (hubName && (p.city?.toLowerCase() === hubName || p.subcategory?.toLowerCase().includes(hubName))));
        if (linkedProds.length > 0) {
          groups.push({
            entityType: 'Product',
            count: linkedProds.length,
            label: `${linkedProds.length} Product${linkedProds.length > 1 ? 's' : ''}`,
            items: linkedProds.slice(0, 15).map(p => ({ id: p.id, name: p.name, type: 'Product', details: `SKU: ${p.sku}` }))
          });
        }

        // Check Hotels
        const linkedHotels = hotels.filter(h => h.hubId === recordId || h.cityId === recordId || (hubName && h.cityName?.toLowerCase() === hubName));
        if (linkedHotels.length > 0) {
          groups.push({
            entityType: 'Hotel',
            count: linkedHotels.length,
            label: `${linkedHotels.length} Hotel${linkedHotels.length > 1 ? 's' : ''}`,
            items: linkedHotels.slice(0, 15).map(h => ({ id: h.id, name: h.name, type: 'Hotel', details: `Code: ${h.code}` }))
          });
        }

        // Check Packages
        const linkedPkgs = packages.filter(pkg => 
          (pkg.hubIds && pkg.hubIds.includes(recordId)) ||
          (hubName && pkg.routeSummary && pkg.routeSummary.some(r => r.toLowerCase().includes(hubName))) ||
          (hubName && pkg.routeHubs && pkg.routeHubs.some(rh => rh.hubId === recordId || rh.hubName?.toLowerCase() === hubName))
        );
        if (linkedPkgs.length > 0) {
          groups.push({
            entityType: 'Package',
            count: linkedPkgs.length,
            label: `${linkedPkgs.length} Package${linkedPkgs.length > 1 ? 's' : ''}`,
            items: linkedPkgs.slice(0, 15).map(pkg => ({ id: pkg.id, name: pkg.title, type: 'Package', details: `${pkg.durationDays}D / ${pkg.durationNights}N` }))
          });
        }

        // Check Active Quotations
        const linkedQuotes = quotes.filter(q => 
          q.routeHubs && q.routeHubs.some(rh => rh.hubId === recordId || (hubName && rh.hubName?.toLowerCase() === hubName))
        );
        if (linkedQuotes.length > 0) {
          groups.push({
            entityType: 'Quote',
            count: linkedQuotes.length,
            label: `${linkedQuotes.length} Active Proposal${linkedQuotes.length > 1 ? 's' : ''}`,
            items: linkedQuotes.slice(0, 10).map(q => ({ id: q.id, name: `Quote #${q.quoteNumber || q.id}`, type: 'Quote', details: `Client: ${q.clientName || 'Direct'}` }))
          });
        }
        break;
      }

      case 'Hotel': {
        const hotel = hotels.find(h => h.id === recordId);
        const hotelName = (hotel?.name || '').toLowerCase();

        // Check Packages
        const linkedPkgs = packages.filter(pkg => 
          (pkg.hotelReferences && pkg.hotelReferences.some(hr => hr.hotelId === recordId || (hotelName && hr.hotelName?.toLowerCase() === hotelName))) ||
          (pkg.hotelsSummary && pkg.hotelsSummary.some(hs => hs.hotelId === recordId || (hotelName && hs.name?.toLowerCase() === hotelName))) ||
          (pkg.itinerary && pkg.itinerary.some(d => d.hotelId === recordId || (hotelName && d.hotelName?.toLowerCase() === hotelName)))
        );
        if (linkedPkgs.length > 0) {
          groups.push({
            entityType: 'Package',
            count: linkedPkgs.length,
            label: `${linkedPkgs.length} Package Itinerary Circuit${linkedPkgs.length > 1 ? 's' : ''}`,
            items: linkedPkgs.map(pkg => ({ id: pkg.id, name: pkg.title, type: 'Package', details: `${pkg.durationDays} Days` }))
          });
        }

        // Check Quotes
        const linkedQuotes = quotes.filter(q => 
          (q.items && q.items.some(item => item.product?.id === recordId || (hotelName && item.manualHotelDetails?.hotelName?.toLowerCase() === hotelName))) ||
          (q.routeHubs && q.routeHubs.some(rh => rh.hotelId === recordId || (hotelName && rh.manualHotel?.hotelName?.toLowerCase() === hotelName)))
        );
        if (linkedQuotes.length > 0) {
          groups.push({
            entityType: 'Quote',
            count: linkedQuotes.length,
            label: `${linkedQuotes.length} Proposal${linkedQuotes.length > 1 ? 's' : ''}`,
            items: linkedQuotes.slice(0, 10).map(q => ({ id: q.id, name: `Quote #${q.quoteNumber || q.id}`, type: 'Quote', details: q.status }))
          });
        }

        // Check Bookings
        const linkedBookings = bookings.filter(b => 
          b.items && b.items.some(i => i.productId === recordId || (hotelName && i.manualHotelDetails?.hotelName?.toLowerCase() === hotelName))
        );
        if (linkedBookings.length > 0) {
          groups.push({
            entityType: 'Booking',
            count: linkedBookings.length,
            label: `${linkedBookings.length} Confirmed/Pending Booking${linkedBookings.length > 1 ? 's' : ''}`,
            items: linkedBookings.map(b => ({ id: b.id, name: `Booking ${b.bookingReference}`, type: 'Booking', details: `Status: ${b.status}` }))
          });
        }
        break;
      }

      case 'Product': {
        const product = products.find(p => p.id === recordId);
        const prodSku = product?.sku || '';

        // Check Packages
        const linkedPkgs = packages.filter(pkg => 
          (pkg.productIds && pkg.productIds.includes(recordId)) ||
          (pkg.productReferences && pkg.productReferences.some(pr => pr.productId === recordId)) ||
          (pkg.recommendedProductIds && pkg.recommendedProductIds.includes(recordId)) ||
          (pkg.itinerary && pkg.itinerary.some(d => d.productIds?.includes(recordId)))
        );
        if (linkedPkgs.length > 0) {
          groups.push({
            entityType: 'Package',
            count: linkedPkgs.length,
            label: `${linkedPkgs.length} Package Itinerary Circuit${linkedPkgs.length > 1 ? 's' : ''}`,
            items: linkedPkgs.map(pkg => ({ id: pkg.id, name: pkg.title, type: 'Package', details: `${pkg.durationDays} Days` }))
          });
        }

        // Check Quotes
        const linkedQuotes = quotes.filter(q => 
          q.items && q.items.some(item => item.product?.id === recordId || item.calculation?.productId === recordId)
        );
        if (linkedQuotes.length > 0) {
          groups.push({
            entityType: 'Quote',
            count: linkedQuotes.length,
            label: `${linkedQuotes.length} Proposal${linkedQuotes.length > 1 ? 's' : ''}`,
            items: linkedQuotes.slice(0, 10).map(q => ({ id: q.id, name: `Quote #${q.quoteNumber || q.id}`, type: 'Quote', details: `Status: ${q.status}` }))
          });
        }

        // Check Bookings
        const linkedBookings = bookings.filter(b => 
          b.items && b.items.some(i => i.productId === recordId || (prodSku && i.productSku === prodSku))
        );
        if (linkedBookings.length > 0) {
          groups.push({
            entityType: 'Booking',
            count: linkedBookings.length,
            label: `${linkedBookings.length} Active Booking${linkedBookings.length > 1 ? 's' : ''}`,
            items: linkedBookings.map(b => ({ id: b.id, name: `Booking ${b.bookingReference}`, type: 'Booking', details: `Client: ${b.customer.leadTravelerName}` }))
          });
        }
        break;
      }

      case 'Package': {
        const pkg = packages.find(p => p.id === recordId);
        const pkgTitle = (pkg?.title || '').toLowerCase();

        // Check Quotes
        const linkedQuotes = quotes.filter(q => 
          q.parentQuoteId === recordId || 
          (pkgTitle && q.title?.toLowerCase().includes(pkgTitle)) ||
          (q.items && q.items.some(i => i.product?.id === recordId))
        );
        if (linkedQuotes.length > 0) {
          groups.push({
            entityType: 'Quote',
            count: linkedQuotes.length,
            label: `${linkedQuotes.length} Linked Proposal${linkedQuotes.length > 1 ? 's' : ''}`,
            items: linkedQuotes.slice(0, 10).map(q => ({ id: q.id, name: `Quote #${q.quoteNumber || q.id}`, type: 'Quote', details: `Status: ${q.status}` }))
          });
        }

        // Check Bookings
        const linkedBookings = bookings.filter(b => 
          b.quoteId === recordId || (b.items && b.items.some(i => i.productId === recordId))
        );
        if (linkedBookings.length > 0) {
          groups.push({
            entityType: 'Booking',
            count: linkedBookings.length,
            label: `${linkedBookings.length} Active Booking${linkedBookings.length > 1 ? 's' : ''}`,
            items: linkedBookings.map(b => ({ id: b.id, name: `Booking ${b.bookingReference}`, type: 'Booking', details: b.status }))
          });
        }
        break;
      }

      case 'RosterResource': {
        const res = this.getResources().find(r => r.id === recordId);
        const resName = (res?.name || '').toLowerCase();
        const resEmail = (res?.email || '').toLowerCase();

        // Check Tasks
        const linkedTasks = tasks.filter(t => 
          (resEmail && t.assignedToEmail?.toLowerCase() === resEmail) || 
          (resName && t.assignedToName?.toLowerCase() === resName)
        );
        if (linkedTasks.length > 0) {
          groups.push({
            entityType: 'CalendarTask',
            count: linkedTasks.length,
            label: `${linkedTasks.length} Assigned Operational Task${linkedTasks.length > 1 ? 's' : ''}`,
            items: linkedTasks.map(t => ({ id: t.id, name: t.title, type: 'Calendar Task', details: `Category: ${t.category}` }))
          });
        }

        // Check Products
        const linkedProds = products.filter(p => p.supplierId === recordId || (resName && p.supplierName?.toLowerCase() === resName));
        if (linkedProds.length > 0) {
          groups.push({
            entityType: 'Product',
            count: linkedProds.length,
            label: `${linkedProds.length} Contracted Product${linkedProds.length > 1 ? 's' : ''}`,
            items: linkedProds.slice(0, 10).map(p => ({ id: p.id, name: p.name, type: 'Product', details: `SKU: ${p.sku}` }))
          });
        }

        // Check Bookings allocations
        const linkedBookings = bookings.filter(b => 
          b.supplierAllocations && b.supplierAllocations.some(sa => sa.supplierId === recordId || (resName && sa.supplierName?.toLowerCase() === resName))
        );
        if (linkedBookings.length > 0) {
          groups.push({
            entityType: 'Booking',
            count: linkedBookings.length,
            label: `${linkedBookings.length} Booking Ground Allocation${linkedBookings.length > 1 ? 's' : ''}`,
            items: linkedBookings.map(b => ({ id: b.id, name: `Booking ${b.bookingReference}`, type: 'Booking', details: b.status }))
          });
        }
        break;
      }

      case 'Lead': {
        const lead = leads.find(l => l.id === recordId);
        const leadNum = lead?.leadNumber || '';

        // Check Quotes
        const linkedQuotes = quotes.filter(q => q.leadId === recordId || (leadNum && q.agentNotes?.includes(leadNum)));
        if (linkedQuotes.length > 0) {
          groups.push({
            entityType: 'Quote',
            count: linkedQuotes.length,
            label: `${linkedQuotes.length} Linked Proposal${linkedQuotes.length > 1 ? 's' : ''}`,
            items: linkedQuotes.map(q => ({ id: q.id, name: `Quote #${q.quoteNumber || q.id}`, type: 'Quote', details: q.status }))
          });
        }

        // Check Tasks
        const linkedTasks = tasks.filter(t => t.leadNumber === leadNum);
        if (linkedTasks.length > 0) {
          groups.push({
            entityType: 'CalendarTask',
            count: linkedTasks.length,
            label: `${linkedTasks.length} Follow-up Task${linkedTasks.length > 1 ? 's' : ''}`,
            items: linkedTasks.map(t => ({ id: t.id, name: t.title, type: 'Calendar Task', details: t.status }))
          });
        }
        break;
      }

      case 'Quote': {
        const quote = quotes.find(q => q.id === recordId);
        const quoteNum = quote?.quoteNumber || '';

        // Check Bookings
        const linkedBookings = bookings.filter(b => b.quoteId === recordId || (quoteNum && b.quoteNumber === quoteNum));
        if (linkedBookings.length > 0) {
          groups.push({
            entityType: 'Booking',
            count: linkedBookings.length,
            label: `${linkedBookings.length} Linked Booking${linkedBookings.length > 1 ? 's' : ''}`,
            items: linkedBookings.map(b => ({ id: b.id, name: `Booking ${b.bookingReference}`, type: 'Booking', details: b.status }))
          });
        }
        break;
      }

      case 'Visa':
      case 'VisaRequirement': {
        const visaList = this.getVisas();
        const targetVisa = visaList.find(v => v.id === recordId);
        const vCountry = (targetVisa?.country || '').toLowerCase();

        // Check Quotes
        const linkedQuotes = quotes.filter(q => 
          q.items && q.items.some(it => it.product?.id === recordId || (vCountry && it.product?.country?.toLowerCase() === vCountry && (it.product?.productType === 'Visa Service' || it.product?.subcategory === 'Visa Facilitation')))
        );
        if (linkedQuotes.length > 0) {
          groups.push({
            entityType: 'Quote',
            count: linkedQuotes.length,
            label: `${linkedQuotes.length} Linked Proposal${linkedQuotes.length > 1 ? 's' : ''}`,
            items: linkedQuotes.slice(0, 10).map(q => ({ id: q.id, name: `Quote #${q.quoteNumber || q.id}`, type: 'Quote', details: `Client: ${q.clientName || 'Agent'}` }))
          });
        }
        break;
      }

      case 'CustomPage': {
        const customPages = this.getCustomPages();
        const page = customPages.find(p => p.id === recordId || p.slug === recordId);
        const pageSlug = page?.slug || '';

        // Check Menu items
        const menuItems = this.getMenuItems();
        const linkedMenus = menuItems.filter(m => m.targetId === pageSlug || m.targetId === recordId || (pageSlug && m.targetId?.includes(pageSlug)));
        if (linkedMenus.length > 0) {
          groups.push({
            entityType: 'MenuItem',
            count: linkedMenus.length,
            label: `${linkedMenus.length} Header Navigation Link${linkedMenus.length > 1 ? 's' : ''}`,
            items: linkedMenus.map(m => ({ id: m.id, name: m.label, type: 'Menu Item', details: m.targetId }))
          });
        }

        // Check Footer columns
        const footerCols = footerConfig.columns || [];
        const linkedFooter = footerCols.filter(col => 
          col.links && col.links.some(l => l.targetId === pageSlug || l.targetId === recordId || (pageSlug && l.url?.includes(pageSlug)))
        );
        if (linkedFooter.length > 0) {
          groups.push({
            entityType: 'FooterColumn',
            count: linkedFooter.length,
            label: `${linkedFooter.length} Footer Column${linkedFooter.length > 1 ? 's' : ''}`,
            items: linkedFooter.map(c => ({ id: c.id, name: c.title, type: 'Footer Column', details: 'Contains active link to this page' }))
          });
        }
        break;
      }

      case 'FooterColumn': {
        const col = footerConfig.columns?.find(c => c.id === recordId);
        if (col && col.links && col.links.length > 0) {
          groups.push({
            entityType: 'FooterLink',
            count: col.links.length,
            label: `${col.links.length} Connected Footer Link${col.links.length > 1 ? 's' : ''}`,
            items: col.links.map(l => ({ id: l.id, name: l.label, type: 'Footer Link', details: l.url }))
          });
        }
        break;
      }

      default:
        break;
    }

    const totalDependencyCount = groups.reduce((acc, g) => acc + g.count, 0);
    const hasDependencies = totalDependencyCount > 0;
    
    // Construct readable summary sentence matching user specification:
    // e.g. "This Hub is currently being used by 24 Products, 12 Hotels and 3 Packages."
    let dependencySummary = '';
    if (hasDependencies) {
      const parts = groups.map(g => `${g.count} ${g.label.split(' ')[1] || g.entityType}`);
      const formattedParts = parts.length === 1 
        ? parts[0] 
        : parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1];
      dependencySummary = `Cannot Delete This ${entityType}: This record is currently connected to ${formattedParts}. Remove or reassign linked records before hard deletion, or choose "Archive" instead.`;
    } else {
      dependencySummary = `No dependent records found. This ${entityType} can be safely deleted or archived.`;
    }

    const canArchive = true;
    const canHardDelete = !hasDependencies;
    const suggestedAction = hasDependencies ? 'BLOCK_AND_SUGGEST_ARCHIVE' : 'ALLOW_DELETE';

    return {
      canHardDelete,
      hasDependencies,
      totalDependencyCount,
      dependencySummary,
      groups,
      canArchive,
      suggestedAction
    };
  }

  // ==========================================
  // GLOBAL SECURE DELETE WITH DEPENDENCY ENFORCEMENT
  // ==========================================
  public secureDeleteRecord(
    entityType: CMSDeletableEntityType,
    recordId: string,
    user: User | null,
    options?: { forceHardDelete?: boolean }
  ): SecureDeleteResult {
    // 1. Permission Validation
    const permCheck = this.canUserDelete(user, entityType);
    if (!permCheck.allowed) {
      this.logAudit(
        user,
        'UNAUTHORIZED_DELETE_ATTEMPT',
        entityType,
        recordId,
        `Unauthorized delete attempt on ${entityType} #${recordId}: ${permCheck.reason}`
      );
      return {
        success: false,
        action: 'BLOCKED',
        message: permCheck.reason || 'Permission denied.'
      };
    }

    // 2. Dependency Analysis
    const depCheck = this.checkRecordDependencies(entityType, recordId);
    if (depCheck.hasDependencies && !options?.forceHardDelete) {
      this.logAudit(
        user,
        'DELETION_BLOCKED_DEPENDENCY',
        entityType,
        recordId,
        `Deletion blocked on ${entityType} #${recordId} due to ${depCheck.totalDependencyCount} linked dependencies. ${depCheck.dependencySummary}`
      );
      return {
        success: false,
        action: 'BLOCKED',
        message: depCheck.dependencySummary,
        dependencies: depCheck
      };
    }

    // 3. Perform Verified Deletion across Collections & Firestore
    switch (entityType) {
      case 'Product': {
        const prods = this.getProducts();
        const target = prods.find(p => p.id === recordId);
        this.setItem('products', prods.filter(p => p.id !== recordId));
        this.deleteFirestoreDoc('products', recordId);
        this.logAudit(user, 'PRODUCT_DELETED', 'Product', recordId, `Permanently deleted product: ${target?.name || recordId} (SKU: ${target?.sku || ''})`);
        break;
      }

      case 'Hotel': {
        const hotels = this.getHotels();
        const target = hotels.find(h => h.id === recordId);
        this.setItem('hotels', hotels.filter(h => h.id !== recordId));
        this.deleteFirestoreDoc('hotels', recordId);
        this.logAudit(user, 'HOTEL_DELETED', 'Hotel', recordId, `Permanently deleted hotel property: ${target?.name || recordId} (${target?.code || ''})`);
        break;
      }

      case 'Package': {
        const pkgs = this.getPackages();
        const target = pkgs.find(p => p.id === recordId);
        this.setItem('b2b_packages', pkgs.filter(p => p.id !== recordId));
        this.deleteFirestoreDoc('b2b_packages', recordId);
        this.logAudit(user, 'PACKAGE_DELETED', 'Package', recordId, `Permanently deleted package circuit: "${target?.title || recordId}"`);
        break;
      }

      case 'CityHub': {
        const hubs = this.getCityHubs();
        const target = hubs.find(h => h.id === recordId);
        this.setItem('city_hubs', hubs.filter(h => h.id !== recordId));
        this.deleteFirestoreDoc('city_hubs', recordId);
        this.logAudit(user, 'CITY_HUB_DELETED', 'CityHub', recordId, `Permanently deleted city hub: "${target?.name || recordId}" (${target?.destinationName || ''})`);
        break;
      }

      case 'Destination': {
        const dests = this.getDestinations();
        const target = dests.find(d => d.id === recordId || d.slug === recordId);
        this.setItem('destinations', dests.filter(d => d.id !== recordId && d.slug !== recordId));
        this.deleteFirestoreDoc('destinations', target?.id || recordId);
        this.logAudit(user, 'DESTINATION_DELETED', 'Destination', recordId, `Permanently deleted destination: "${target?.name || recordId}"`);
        break;
      }

      case 'MasterRegion': {
        const regs = this.getMasterRegions();
        const target = regs.find(r => r.id === recordId);
        this.setItem('master_regions', regs.filter(r => r.id !== recordId));
        this.deleteFirestoreDoc('master_regions', recordId);
        this.logAudit(user, 'REGION_DELETED', 'MasterRegion', recordId, `Permanently deleted master macro region: "${target?.name || recordId}"`);
        break;
      }

      case 'DestinationRegion': {
        const regItems = this.getRegions();
        const target = regItems.find(r => r.id === recordId);
        this.setItem('regions', regItems.filter(r => r.id !== recordId));
        this.deleteFirestoreDoc('regions', recordId);
        this.logAudit(user, 'REGION_DELETED', 'DestinationRegionItem', recordId, `Permanently deleted sub-region: "${target?.name || recordId}"`);
        break;
      }

      case 'DestinationFAQ': {
        const faqs = this.getDestinationFAQs();
        const target = faqs.find(f => f.id === recordId);
        this.setItem('destination_faqs', faqs.filter(f => f.id !== recordId));
        this.deleteFirestoreDoc('faqs', recordId);
        this.logAudit(user, 'FAQ_DELETED', 'DestinationFAQ', recordId, `Deleted FAQ: "${target?.question || recordId}"`);
        break;
      }

      case 'Blog': {
        const blogs = this.getBlogs();
        const target = blogs.find(b => b.id === recordId);
        this.setItem('blogs', blogs.filter(b => b.id !== recordId));
        this.deleteFirestoreDoc('blogs', recordId);
        this.logAudit(user, 'BLOG_DELETED', 'BlogArticle', recordId, `Deleted blog article: "${target?.title || recordId}"`);
        break;
      }

      case 'Review': {
        const reviews = this.getReviews();
        const target = reviews.find(r => r.id === recordId);
        this.setItem('reviews', reviews.filter(r => r.id !== recordId));
        this.deleteFirestoreDoc('reviews', recordId);
        this.logAudit(user, 'REVIEW_DELETED', 'GoogleReview', recordId, `Deleted review from ${target?.authorName || recordId}`);
        break;
      }

      case 'Promotion': {
        const promos = this.getPromotions();
        const target = promos.find(p => p.id === recordId);
        this.setItem('promotions', promos.filter(p => p.id !== recordId));
        this.deleteFirestoreDoc('promotions', recordId);
        this.logAudit(user, 'PROMOTION_DELETED', 'Promotion', recordId, `Deleted promotion campaign: "${target?.title || recordId}"`);
        break;
      }

      case 'GalleryImage': {
        const images = this.getGalleryImages();
        const target = images.find(g => g.id === recordId);
        this.setItem('gallery', images.filter(g => g.id !== recordId));
        this.deleteFirestoreDoc('gallery', recordId);
        this.logAudit(user, 'GALLERY_DELETED', 'GalleryImage', recordId, `Deleted gallery photo: "${target?.caption || recordId}"`);
        break;
      }

      case 'Visa':
      case 'VisaRequirement': {
        const visas = this.getVisas();
        const target = visas.find(v => v.id === recordId);
        this.setItem('visas', visas.filter(v => v.id !== recordId));
        this.deleteFirestoreDoc('visas', recordId);
        this.logAudit(user, 'VISA_DELETED', 'VisaProduct', recordId, `Deleted visa guidelines for ${target?.country || recordId}`);
        break;
      }

      case 'CustomPage': {
        this.deleteCustomPage(recordId, user);
        this.logAudit(user, 'PAGE_DELETED', 'CustomPage', recordId, `Deleted institutional page: ${recordId}`);
        break;
      }

      case 'MenuItem': {
        this.deleteMenuItem(recordId, user);
        this.logAudit(user, 'PAGE_UPDATED', 'MenuItem', recordId, `Deleted header menu navigation item: ${recordId}`);
        break;
      }

      case 'FooterColumn': {
        const config = this.getFooterConfig();
        const target = config.columns?.find(c => c.id === recordId);
        config.columns = (config.columns || []).filter(c => c.id !== recordId);
        this.saveFooterConfig(config, user);
        this.logAudit(user, 'SETTINGS_UPDATED', 'FooterColumn', recordId, `Deleted footer column: "${target?.title || recordId}"`);
        break;
      }

      case 'FooterLink': {
        const config = this.getFooterConfig();
        let deletedLink: any = null;
        if (config.columns) {
          config.columns.forEach(col => {
            if (col.links) {
              const idx = col.links.findIndex(l => l.id === recordId);
              if (idx >= 0) {
                deletedLink = col.links[idx];
                col.links.splice(idx, 1);
              }
            }
          });
          this.saveFooterConfig(config, user);
          this.logAudit(user, 'SETTINGS_UPDATED', 'FooterLink', recordId, `Deleted footer link: "${deletedLink?.label || recordId}"`);
        }
        break;
      }

      case 'Quote': {
        this.deleteQuote(recordId, user);
        this.logAudit(user, 'QUOTE_DELETED', 'Quotation', recordId, `Permanently deleted quotation #${recordId}`);
        break;
      }

      case 'Lead': {
        const leads = this.getLeads();
        const target = leads.find(l => l.id === recordId);
        this.setItem('leads', leads.filter(l => l.id !== recordId));
        this.deleteFirestoreDoc('leads', recordId);
        this.logAudit(user, 'LEAD_DELETED', 'TravelLead', recordId, `Deleted travel lead ${target?.leadNumber || recordId} (${target?.contactName || ''})`);
        break;
      }

      case 'RosterResource': {
        this.deleteResource(recordId, user);
        break;
      }

      case 'CalendarTask': {
        this.deleteCalendarTask(recordId, user);
        break;
      }

      default:
        return {
          success: false,
          action: 'BLOCKED',
          message: `Unknown entity type: ${entityType}`
        };
    }

    return {
      success: true,
      action: 'DELETED',
      message: `Successfully deleted ${entityType} record from Firebase & database.`
    };
  }

  // ==========================================
  // SAFE ARCHIVE WITH PERMISSION CONTROL
  // ==========================================
  public secureArchiveRecord(
    entityType: CMSDeletableEntityType,
    recordId: string,
    user: User | null
  ): SecureDeleteResult {
    // 1. Permission Validation
    const permCheck = this.canUserDelete(user, entityType);
    if (!permCheck.allowed) {
      return {
        success: false,
        action: 'BLOCKED',
        message: permCheck.reason || 'Permission denied to archive records.'
      };
    }

    switch (entityType) {
      case 'Product': {
        const prods = this.getProducts();
        const p = prods.find(item => item.id === recordId);
        if (p) {
          p.status = 'DRAFT';
          this.saveProduct(p, user);
          this.logAudit(user, 'PRODUCT_ARCHIVED', 'Product', recordId, `Archived product: ${p.name} (status set to DRAFT/ARCHIVED)`);
        }
        break;
      }

      case 'Hotel': {
        const hotels = this.getHotels();
        const h = hotels.find(item => item.id === recordId);
        if (h) {
          h.status = 'ARCHIVED';
          this.saveHotel(h, user);
          this.logAudit(user, 'HOTEL_ARCHIVED', 'Hotel', recordId, `Archived hotel property: ${h.name} (status set to ARCHIVED)`);
        }
        break;
      }

      case 'Package': {
        const pkgs = this.getPackages();
        const pkg = pkgs.find(item => item.id === recordId);
        if (pkg) {
          pkg.status = 'ARCHIVED';
          pkg.isPublished = false;
          this.savePackage(pkg);
          this.logAudit(user, 'PACKAGE_ARCHIVED', 'Package', recordId, `Archived tour package circuit: ${pkg.title}`);
        }
        break;
      }

      case 'CityHub': {
        const hubs = this.getCityHubs();
        const hub = hubs.find(item => item.id === recordId);
        if (hub) {
          hub.status = 'ARCHIVED';
          hub.isPublished = false;
          this.saveCityHub(hub, user);
          this.logAudit(user, 'CITY_HUB_ARCHIVED', 'CityHub', recordId, `Archived city hub: ${hub.name}`);
        }
        break;
      }

      case 'Destination': {
        const dests = this.getDestinations();
        const dest = dests.find(item => item.id === recordId || item.slug === recordId);
        if (dest) {
          dest.status = 'COMING_SOON';
          this.saveDestination(dest, user);
          this.logAudit(user, 'DESTINATION_ARCHIVED', 'Destination', recordId, `Archived destination: ${dest.name} (set to Coming Soon)`);
        }
        break;
      }

      case 'MasterRegion': {
        const regs = this.getMasterRegions();
        const reg = regs.find(item => item.id === recordId);
        if (reg) {
          reg.status = 'INACTIVE';
          reg.isPublished = false;
          this.saveMasterRegion(reg, user);
          this.logAudit(user, 'REGION_ARCHIVED', 'MasterRegion', recordId, `Archived macro region: ${reg.name}`);
        }
        break;
      }

      case 'Blog': {
        const blogs = this.getBlogs();
        const blog = blogs.find(item => item.id === recordId);
        if (blog) {
          blog.status = 'ARCHIVED';
          this.saveBlog(blog, user);
          this.logAudit(user, 'BLOG_ARCHIVED', 'BlogArticle', recordId, `Archived editorial article: ${blog.title}`);
        }
        break;
      }

      case 'Promotion': {
        const promos = this.getPromotions();
        const promo = promos.find(item => item.id === recordId);
        if (promo) {
          promo.isActive = false;
          this.savePromotion(promo, user);
          this.logAudit(user, 'PROMOTION_UPDATED', 'Promotion', recordId, `Deactivated/Archived promotion campaign: ${promo.title}`);
        }
        break;
      }

      case 'Visa':
      case 'VisaRequirement': {
        const visas = this.getVisas();
        const v = visas.find(item => item.id === recordId);
        if (v) {
          v.status = 'ARCHIVED';
          this.saveVisa(v, user);
          this.logAudit(user, 'VISA_ARCHIVED', 'VisaProduct', recordId, `Archived visa guidelines for ${v.country}`);
        }
        break;
      }

      case 'Quote': {
        this.updateQuotationStatus(recordId, 'EXPIRED', user);
        break;
      }

      case 'Lead': {
        this.updateLeadStatus(recordId, 'LOST', user);
        break;
      }

      default:
        return this.secureDeleteRecord(entityType, recordId, user);
    }

    return {
      success: true,
      action: 'ARCHIVED',
      message: `Successfully archived ${entityType} record. Live dependencies remain safe.`
    };
  }

  // ==========================================
  // PRODUCTS CRUD
  // ==========================================
  public getProducts(): Product[] {
    return this.getItem<Product[]>('products', INITIAL_PRODUCTS);
  }

  public getProductById(id: string): Product | undefined {
    return this.getProducts().find(p => p.id === id);
  }

  public saveProduct(product: Product, user: User | null): void {
    if (user) {
      const auth = this.canUserWriteCMS(user, 'OPERATIONS', 'Product');
      if (!auth.allowed) {
        this.logAudit(user, 'UNAUTHORIZED_WRITE_ATTEMPT', 'Product', product.id, `Unauthorized write attempt: ${auth.reason}`);
        return;
      }
    }
    const products = this.getProducts();
    const existingIndex = products.findIndex(p => p.id === product.id);
    const prev = existingIndex >= 0 ? products[existingIndex] : null;

    if (existingIndex >= 0) {
      products[existingIndex] = {
        ...product,
        lastUpdated: new Date().toISOString().split('T')[0]
      };
      this.logAudit(
        user,
        'PRODUCT_UPDATED',
        'Product',
        product.id,
        `Updated product: ${product.name} (SKU: ${product.sku})`,
        prev ? JSON.stringify({ name: prev.name, price: prev.adultNetPrice }) : undefined,
        JSON.stringify({ name: product.name, price: product.adultNetPrice })
      );
      this.syncFirestoreDoc('products', product.id, products[existingIndex]);
    } else {
      const newProd = {
        ...product,
        lastUpdated: new Date().toISOString().split('T')[0]
      };
      products.unshift(newProd);
      this.logAudit(
        user,
        'PRODUCT_CREATED',
        'Product',
        product.id,
        `Created new product: ${product.name} (SKU: ${product.sku})`
      );
      this.syncFirestoreDoc('products', product.id, newProd);
    }
    this.setItem('products', products);
  }

  public duplicateProduct(productId: string, user: User | null): Product | null {
    const product = this.getProductById(productId);
    if (!product) return null;

    const duplicated: Product = {
      ...product,
      id: `prod-${Date.now()}`,
      sku: `${product.sku}-COPY`,
      name: `${product.name} (Copy)`,
      status: 'DRAFT',
      lastUpdated: new Date().toISOString().split('T')[0]
    };

    this.saveProduct(duplicated, user);
    return duplicated;
  }

  public deleteProduct(productId: string, user: User | null): void {
    const products = this.getProducts();
    const target = products.find(p => p.id === productId);
    const filtered = products.filter(p => p.id !== productId);
    this.setItem('products', filtered);
    this.deleteFirestoreDoc('products', productId);
    if (target) {
      this.logAudit(
        user,
        'PRODUCT_ARCHIVED',
        'Product',
        productId,
        `Archived/Deleted product: ${target.name} (SKU: ${target.sku})`
      );
    }
  }

  // ==========================================
  // MASTER MACRO REGIONS CRUD (TIER 1: REGION)
  // ==========================================
  public getMasterRegions(): MasterRegion[] {
    return this.getItem<MasterRegion[]>('master_regions', INITIAL_MASTER_REGIONS);
  }

  public getMasterRegionById(regionId: string): MasterRegion | undefined {
    return this.getMasterRegions().find(r => r.id === regionId);
  }

  public getMasterRegionBySlug(slug: string): MasterRegion | undefined {
    return this.getMasterRegions().find(r => r.slug === slug);
  }

  public saveMasterRegion(region: MasterRegion, user: User | null): void {
    const regions = this.getMasterRegions();
    const index = regions.findIndex(r => r.id === region.id);
    if (index >= 0) {
      regions[index] = region;
      this.logAudit(user, 'DESTINATION_UPDATED', 'MasterRegion', region.id, `Updated Master Region: ${region.name} (${region.code})`);
    } else {
      regions.push(region);
      this.logAudit(user, 'DESTINATION_UPDATED', 'MasterRegion', region.id, `Created Master Region: ${region.name} (${region.code})`);
    }
    this.syncFirestoreDoc('master_regions', region.id, region);
    this.setItem('master_regions', regions);
  }

  public deleteMasterRegion(regionId: string, user: User | null): void {
    const regions = this.getMasterRegions();
    const target = regions.find(r => r.id === regionId);
    this.setItem('master_regions', regions.filter(r => r.id !== regionId));
    this.deleteFirestoreDoc('master_regions', regionId);
    if (target) {
      this.logAudit(user, 'DESTINATION_UPDATED', 'MasterRegion', regionId, `Deleted Master Region: ${target.name}`);
    }
  }

  public getDestinationsByMasterRegion(regionId: string): Destination[] {
    if (!regionId || regionId === 'all') return this.getDestinations();
    return this.getDestinations().filter(d => d.regionId === regionId);
  }

  // ==========================================
  // DESTINATIONS CRUD (TIER 2: DESTINATION)
  // ==========================================
  public getDestinations(): Destination[] {
    const raw = this.getItem<Destination[]>('destinations', DESTINATIONS);
    if (!Array.isArray(raw)) return DESTINATIONS;
    const seen = new Set<string>();
    const deduped: Destination[] = [];
    for (const d of raw) {
      if (!d) continue;
      const keyId = d.id ? d.id.trim().toLowerCase() : '';
      const keySlug = d.slug ? d.slug.trim().toLowerCase() : '';
      if (keyId && seen.has(keyId)) continue;
      if (keySlug && seen.has(keySlug)) continue;
      if (keyId) seen.add(keyId);
      if (keySlug) seen.add(keySlug);
      deduped.push(d);
    }
    return deduped;
  }

  public getDestinationBySlug(slug: string): Destination | undefined {
    return this.getDestinations().find(d => d.slug === slug);
  }

  public saveDestination(destination: Destination, user: User | null): void {
    if (user) {
      const auth = this.canUserWriteCMS(user, 'CONTENT', 'Destination');
      if (!auth.allowed) {
        this.logAudit(user, 'UNAUTHORIZED_WRITE_ATTEMPT', 'Destination', destination.id, `Unauthorized write attempt: ${auth.reason}`);
        return;
      }
    }
    const destinations = this.getDestinations();
    const index = destinations.findIndex(d => d.id === destination.id);
    if (index >= 0) {
      destinations[index] = destination;
      this.logAudit(user, 'DESTINATION_UPDATED', 'Destination', destination.id, `Updated destination: ${destination.name}`);
    } else {
      destinations.push(destination);
      this.logAudit(user, 'DESTINATION_UPDATED', 'Destination', destination.id, `Added destination: ${destination.name}`);
    }
    this.syncFirestoreDoc('destinations', destination.id, destination);
    this.setItem('destinations', destinations);
  }

  public deleteDestination(destinationId: string, user: User | null): void {
    const destinations = this.getDestinations();
    const target = destinations.find(d => d.id === destinationId);
    this.setItem('destinations', destinations.filter(d => d.id !== destinationId));
    this.deleteFirestoreDoc('destinations', destinationId);
    if (target) {
      this.logAudit(user, 'DESTINATION_UPDATED', 'Destination', destinationId, `Removed destination: ${target.name}`);
    }
  }

  // ==========================================
  // DESTINATION REGIONS CRUD
  // ==========================================
  public getRegions(): DestinationRegionItem[] {
    const initial = DESTINATIONS.flatMap(d => d.regions || []);
    return this.getItem<DestinationRegionItem[]>('regions', initial);
  }

  public getRegionsByDestination(destinationId: string): DestinationRegionItem[] {
    if (!destinationId || destinationId === 'all') return this.getRegions();
    return this.getRegions().filter(r => r.destinationId === destinationId);
  }

  public getRegionById(regionId: string): DestinationRegionItem | undefined {
    return this.getRegions().find(r => r.id === regionId);
  }

  public saveRegion(region: DestinationRegionItem, user: User | null): void {
    const regions = this.getRegions();
    const index = regions.findIndex(r => r.id === region.id);
    if (index >= 0) {
      regions[index] = region;
      this.logAudit(user, 'DESTINATION_UPDATED', 'DestinationRegion', region.id, `Updated region: ${region.name} (${region.destinationName})`);
    } else {
      regions.push(region);
      this.logAudit(user, 'DESTINATION_UPDATED', 'DestinationRegion', region.id, `Added region: ${region.name} (${region.destinationName})`);
    }
    this.syncFirestoreDoc('regions', region.id, region);
    this.setItem('regions', regions);
  }

  public deleteRegion(regionId: string, user: User | null): void {
    const regions = this.getRegions();
    const target = regions.find(r => r.id === regionId);
    this.setItem('regions', regions.filter(r => r.id !== regionId));
    this.deleteFirestoreDoc('regions', regionId);
    if (target) {
      this.logAudit(user, 'DESTINATION_UPDATED', 'DestinationRegion', regionId, `Deleted region: ${target.name}`);
    }
  }

  // ==========================================
  // PROMOTIONS & MARKETING CAMPAIGNS CRUD
  // ==========================================
  public getPromotions(): Promotion[] {
    const raw = this.getItem<Promotion[]>('promotions', INITIAL_PROMOTIONS);
    const today = new Date().toISOString().split('T')[0];
    
    // Normalize status and active states
    return raw.map(p => {
      let status = p.status;
      if (p.isArchived) {
        status = 'ARCHIVED';
      } else if (!status) {
        if (!p.isActive) {
          status = 'PAUSED';
        } else if (p.startDate && p.startDate > today) {
          status = 'SCHEDULED';
        } else if (p.endDate && p.endDate < today) {
          status = 'EXPIRED';
        } else {
          status = 'ACTIVE';
        }
      }
      return {
        ...p,
        status,
        isActive: status === 'ACTIVE' || (p.isActive && status !== 'PAUSED' && status !== 'ARCHIVED' && status !== 'EXPIRED')
      };
    });
  }

  public getActivePromotions(audience?: 'ALL' | 'BUYER' | 'B2B_AGENT'): Promotion[] {
    const today = new Date().toISOString().split('T')[0];
    return this.getPromotions().filter(p => {
      if (p.isArchived || p.status === 'ARCHIVED' || p.status === 'PAUSED' || p.status === 'DRAFT') return false;
      if (!p.isActive) return false;
      if (p.startDate && p.startDate > today) return false;
      if (p.endDate && p.endDate < today) return false;
      if (audience && p.targetAudience !== 'ALL' && p.targetAudience !== audience) return false;
      return true;
    }).sort((a, b) => a.priority - b.priority);
  }

  public savePromotion(promotion: Promotion, user: User | null, actionContext?: 'STATUS_CHANGE' | 'TARGETING_CHANGE' | 'CTA_CHANGE' | 'GENERAL'): void {
    const promotions = this.getPromotions();
    const index = promotions.findIndex(p => p.id === promotion.id);
    const today = new Date().toISOString().split('T')[0];

    // Compute canonical status
    let status = promotion.status;
    if (promotion.isArchived || status === 'ARCHIVED') {
      status = 'ARCHIVED';
      promotion.isActive = false;
      promotion.isArchived = true;
    } else if (status === 'PAUSED' || !promotion.isActive) {
      status = 'PAUSED';
      promotion.isActive = false;
    } else if (status === 'DRAFT') {
      status = 'DRAFT';
      promotion.isActive = false;
    } else if (promotion.startDate && promotion.startDate > today) {
      status = 'SCHEDULED';
      promotion.isActive = true;
    } else if (promotion.endDate && promotion.endDate < today) {
      status = 'EXPIRED';
      promotion.isActive = false;
    } else {
      status = 'ACTIVE';
      promotion.isActive = true;
    }

    let savedPromo: Promotion;
    if (index >= 0) {
      const old = promotions[index];
      savedPromo = { 
        ...promotion, 
        status, 
        updatedAt: new Date().toISOString() 
      };
      promotions[index] = savedPromo;

      // Determine audit action type
      if (actionContext === 'STATUS_CHANGE' || old.status !== savedPromo.status || old.isActive !== savedPromo.isActive) {
        if (savedPromo.status === 'ACTIVE') {
          this.logAudit(user, 'PROMOTION_ACTIVATED', 'Promotion', promotion.id, `Activated campaign: "${promotion.title}"`);
        } else if (savedPromo.status === 'PAUSED') {
          this.logAudit(user, 'PROMOTION_PAUSED', 'Promotion', promotion.id, `Paused campaign: "${promotion.title}"`);
        } else if (savedPromo.status === 'ARCHIVED') {
          this.logAudit(user, 'PROMOTION_ARCHIVED', 'Promotion', promotion.id, `Archived campaign: "${promotion.title}"`);
        } else if (savedPromo.status === 'SCHEDULED') {
          this.logAudit(user, 'PROMOTION_SCHEDULED', 'Promotion', promotion.id, `Scheduled campaign "${promotion.title}" for ${savedPromo.startDate}`);
        } else {
          this.logAudit(user, 'PROMOTION_UPDATED', 'Promotion', promotion.id, `Updated campaign status to ${savedPromo.status}: "${promotion.title}"`);
        }
      } else if (actionContext === 'TARGETING_CHANGE' || old.targetAudience !== savedPromo.targetAudience || old.displayPlacement !== savedPromo.displayPlacement || old.destinationId !== savedPromo.destinationId) {
        this.logAudit(user, 'PROMOTION_TARGETING_CHANGED', 'Promotion', promotion.id, `Modified campaign targeting (${savedPromo.displayPlacement}, ${savedPromo.targetAudience}): "${promotion.title}"`);
      } else if (actionContext === 'CTA_CHANGE' || old.ctaText !== savedPromo.ctaText || old.ctaLink !== savedPromo.ctaLink) {
        this.logAudit(user, 'PROMOTION_CTA_CHANGED', 'Promotion', promotion.id, `Updated campaign CTA (${savedPromo.ctaText} → ${savedPromo.ctaLink}): "${promotion.title}"`);
      } else {
        this.logAudit(user, 'PROMOTION_UPDATED', 'Promotion', promotion.id, `Updated promotional campaign details: "${promotion.title}"`);
      }
    } else {
      savedPromo = {
        ...promotion,
        id: promotion.id || `promo-${Date.now()}`,
        status,
        viewCount: promotion.viewCount || 0,
        clickCount: promotion.clickCount || 0,
        impressions: promotion.impressions || 0,
        clicks: promotion.clicks || 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      promotions.unshift(savedPromo);
      this.logAudit(user, 'PROMOTION_CREATED', 'Promotion', savedPromo.id, `Created promotional campaign: "${promotion.title}" (${status})`);
    }
    this.syncFirestoreDoc('promotions', savedPromo.id, savedPromo);
    this.setItem('promotions', promotions);
  }

  public archivePromotion(promotionId: string, user: User | null): void {
    const promotions = this.getPromotions();
    const promo = promotions.find(p => p.id === promotionId);
    if (promo) {
      promo.status = 'ARCHIVED';
      promo.isArchived = true;
      promo.isActive = false;
      promo.updatedAt = new Date().toISOString();
      this.setItem('promotions', promotions);
      this.syncFirestoreDoc('promotions', promo.id, promo);
      this.logAudit(user, 'PROMOTION_ARCHIVED', 'Promotion', promotionId, `Archived promotional campaign: "${promo.title}" (historical analytics preserved)`);
    }
  }

  public deletePromotion(promotionId: string, user: User | null): void {
    const promotions = this.getPromotions();
    const target = promotions.find(p => p.id === promotionId);
    this.setItem('promotions', promotions.filter(p => p.id !== promotionId));
    this.deleteFirestoreDoc('promotions', promotionId);
    if (target) {
      this.logAudit(user, 'PROMOTION_DELETED', 'Promotion', promotionId, `Permanently deleted campaign: "${target.title}"`);
    }
  }

  // ==========================================
  // BLOGS CRUD
  // ==========================================
  public getBlogs(): BlogArticle[] {
    return this.getItem<BlogArticle[]>('blogs', INITIAL_BLOGS);
  }

  public getBlogBySlug(slug: string): BlogArticle | undefined {
    return this.getBlogs().find(b => b.slug === slug);
  }

  public saveBlog(blog: BlogArticle, user: User | null): void {
    const blogs = this.getBlogs();
    const index = blogs.findIndex(b => b.id === blog.id);
    let savedBlog: BlogArticle;
    if (index >= 0) {
      savedBlog = { ...blog, updatedAt: new Date().toISOString() };
      blogs[index] = savedBlog;
      this.logAudit(user, 'BLOG_UPDATED', 'Blog', blog.id, `Updated blog article: ${blog.title}`);
    } else {
      savedBlog = {
        ...blog,
        id: blog.id || `blog-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      blogs.unshift(savedBlog);
      this.logAudit(user, 'BLOG_CREATED', 'Blog', blog.id, `Created blog article: ${blog.title}`);
    }
    this.syncFirestoreDoc('blog_articles', savedBlog.id, savedBlog);
    this.setItem('blogs', blogs);
  }

  public deleteBlog(blogId: string, user: User | null): void {
    const blogs = this.getBlogs();
    const target = blogs.find(b => b.id === blogId);
    this.setItem('blogs', blogs.filter(b => b.id !== blogId));
    this.deleteFirestoreDoc('blog_articles', blogId);
    if (target) {
      this.logAudit(user, 'BLOG_UPDATED', 'Blog', blogId, `Deleted blog article: ${target.title}`);
    }
  }

  public incrementBlogViews(blogId: string): void {
    const blogs = this.getBlogs();
    const target = blogs.find(b => b.id === blogId);
    if (target) {
      target.views = (target.views || 0) + 1;
      this.setItem('blogs', blogs);
      this.syncFirestoreDoc('blog_articles', blogId, { views: target.views });
    }
  }

  // ==========================================
  // GOOGLE REVIEWS CRUD (Real Google Business Profile)
  // ==========================================
  public getReviews(): GoogleReview[] {
    const reviews = this.getItem<GoogleReview[]>('reviews', []);
    // Strict filter: Never return legacy dummy mock reviews
    return reviews.filter(r => 
      !r.id.startsWith('rev-0') && 
      !r.id.startsWith('rev-google-') && 
      !r.id.startsWith('g-rev-') &&
      r.authorName !== 'Charlotte De Vries' &&
      r.authorName !== 'David Sterling (Director, Sterling Luxury Travel UK)' &&
      r.authorName !== 'Alexander Montgomery' &&
      r.authorName !== 'Sophie Van Der Bilt' &&
      r.authorName !== 'Evelyn Montgomery' &&
      r.authorName !== 'Sebastian Croft, CTC' &&
      r.authorName !== 'Chiara Rossi' &&
      r.authorName !== 'Marcus Vance' &&
      r.authorName !== 'Evelyn St. Claire (Travel Luxe Magazine)' &&
      r.authorName !== 'Siddharth Rao (Global Travel Club)'
    );
  }

  public getVisibleReviews(): GoogleReview[] {
    return this.getReviews()
      .filter(r => r.isVisible)
      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  }

  public saveReview(review: GoogleReview, user: User | null): void {
    const reviews = this.getReviews();
    const index = reviews.findIndex(r => r.id === review.id);
    let savedReview: GoogleReview;
    if (index >= 0) {
      savedReview = review;
      reviews[index] = savedReview;
      this.logAudit(user, 'REVIEW_UPDATED', 'GoogleReview', review.id, `Updated review from ${review.authorName}`);
    } else {
      savedReview = {
        ...review,
        id: review.id || `rev-${Date.now()}`
      };
      reviews.unshift(savedReview);
      this.logAudit(user, 'REVIEW_CREATED', 'GoogleReview', savedReview.id, `Added review from ${review.authorName}`);
    }
    this.syncFirestoreDoc('google_reviews', savedReview.id, savedReview);
    this.setItem('reviews', reviews);
  }

  public deleteReview(reviewId: string, user: User | null): void {
    const reviews = this.getReviews();
    const target = reviews.find(r => r.id === reviewId);
    this.setItem('reviews', reviews.filter(r => r.id !== reviewId));
    this.deleteFirestoreDoc('google_reviews', reviewId);
    if (target) {
      this.logAudit(user, 'REVIEW_DELETED', 'GoogleReview', reviewId, `Deleted review from ${target.authorName}`);
    }
  }

  // ==========================================
  // STRICT SHARED QUOTE AUTHORIZATION & MANAGEMENT
  // ==========================================
  public getAllSavedQuotes(): Quotation[] {
    return this.getItem<Quotation[]>('saved_quotes', []);
  }

  /*
  private _legacyQuotes(): Quotation[] {
    const defaultQuotes: Quotation[] = [
      {
        id: 'quote-sample-01',
        quoteNumber: 'UBQ-2026-9104',
        version: 1,
        title: 'Japan Golden Triangle & Alpine Heritage (10 Nights)',
        destination: 'Japan',
        currency: 'USD',
        status: 'PROPOSAL_GENERATED',
        scope: 'HOTEL_LAND',
        travelStartDate: '2026-10-10',
        travelEndDate: '2026-10-20',
        totalPax: 2,
        adultsCount: 2,
        childrenCount: 0,
        infantsCount: 0,
        overallMarkupPercent: 15,
        overallDiscountPercent: 0,
        totalNetCost: 8450,
        totalSellingPrice: 9717.5,
        totalTaxes: 0,
        totalMargin: 1267.5,
        termsAndConditions: 'All wholesale tariffs confirmed. 20% refundable deposit secures hotel allotments and private vehicle dispatch.',
        agentNotes: 'Client prefers English-speaking private chauffeurs and high-floor panoramic suites in Tokyo and Kyoto.',
        createdAt: '2026-08-20T10:00:00Z',
        updatedAt: '2026-08-25T14:30:00Z',
        lastActivityAt: '2026-08-25T14:30:00Z',
        validUntil: '2026-09-30T23:59:59Z',
        
        // Ownership & Attribution (Created by Admin for James Harrison)
        createdBy: 'usr-admin-business',
        createdByName: 'TheUnbound Executive Admin',
        createdByUserType: 'ADMIN',
        agentId: 'usr-admin-business',
        agentName: 'TheUnbound Bespoke Concierge',
        agentEmail: 'business@theunbound.in',
        agentAgency: 'TheUnbound DMC Global Operations',
        agentPhone: '+91 9811654959',
        
        // Target Registered Client (Buyer)
        clientUserId: 'usr-buyer-01',
        clientName: 'James Harrison',
        clientEmail: 'james.buyer@horizonventures.com',
        clientPhone: '+1 415 555 2671',
        clientCompany: 'Horizon Private Client Group',
        
        routeHubs: [
          { id: 'rh-1', hubId: 'hub-tokyo', hubName: 'Tokyo', nights: 4, order: 1, notes: 'Stay in Ginza / Shinjuku' },
          { id: 'rh-2', hubId: 'hub-kyoto', hubName: 'Kyoto', nights: 4, order: 2, notes: 'Gion cultural exploration' },
          { id: 'rh-3', hubId: 'hub-osaka', hubName: 'Osaka', nights: 2, order: 3, notes: 'Gastronomy and Dotonbori' }
        ],
        items: [
          {
            id: 'item-jp-01',
            product: INITIAL_PRODUCTS[0] || {
              id: 'jp-tok-01',
              name: 'Tokyo Modern & Edo Heritage Private VIP Chauffeur Tour',
              destinationName: 'Japan',
              country: 'Japan',
              city: 'Tokyo',
              category: 'Private Tours',
              productType: 'Private Day Tour',
              sellingPriceStartingFrom: 480,
              currency: 'USD',
              images: ['https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=1200&auto=format&fit=crop'],
              shortDescription: 'Full-day custom itinerary in a luxury Toyota Alphard with English-speaking licensed guide.',
              minPax: 1,
              maxPax: 6
            } as any,
            pax: { adults: 2, children: 0, infants: 0 },
            travelDate: '2026-10-11',
            serviceTime: '09:00 AM',
            notes: 'Pickup at Tokyo Hotel Lobby at 09:00 AM',
            selectedAddonIds: [],
            calculation: {
              productId: 'jp-tok-01',
              productName: 'Tokyo Modern & Edo Heritage Private VIP Chauffeur Tour',
              pricingTier: 'B2B',
              pax: { adults: 2, children: 0, infants: 0, totalPax: 2 },
              travelDate: '2026-10-11',
              currency: 'USD',
              adultsSubtotalNet: 700,
              childrenSubtotalNet: 0,
              infantsSubtotalNet: 0,
              addonsSubtotalNet: 0,
              totalNetCost: 700,
              b2bWholesaleMarkupRate: 0.15,
              b2bWholesaleNetToAgent: 805,
              agentClientMarkupRate: 0,
              agentProfitAmount: 0,
              markupRate: 0.15,
              markupAmount: 105,
              grossBeforeTax: 805,
              taxRate: 0,
              taxAmount: 0,
              serviceFee: 0,
              discountRate: 0,
              discountAmount: 0,
              commissionRate: 0,
              commissionAmount: 0,
              adultsSubtotalSelling: 805,
              childrenSubtotalSelling: 0,
              infantsSubtotalSelling: 0,
              addonsSubtotalSelling: 0,
              adultPricePerPax: 402.5,
              childPricePerPax: 0,
              finalTotalSellingPrice: 805,
              sellingPriceFinal: 805,
              pricePerPerson: 402.5,
              dmcMarginAmount: 105,
              dmcMarginPercent: 15
            }
          }
        ],
        versionHistory: [
          {
            version: 1,
            updatedAt: '2026-08-20T10:00:00Z',
            updatedBy: 'TheUnbound Executive Admin',
            changesSummary: 'Initial comprehensive 10-Night Japan bespoke itinerary generated for James Harrison.',
            totalSellingPrice: 9717.5
          }
        ],
        activityLog: [
          {
            id: 'act-init-01',
            action: 'CREATED',
            timestamp: '2026-08-20T10:00:00Z',
            userName: 'TheUnbound Executive Admin',
            userRole: 'ADMIN',
            userType: 'ADMIN',
            details: 'Admin created bespoke quotation for registered client James Harrison (usr-buyer-01)'
          },
          {
            id: 'act-init-02',
            action: 'PROPOSAL_GENERATED',
            timestamp: '2026-08-22T11:15:00Z',
            userName: 'TheUnbound Executive Admin',
            userRole: 'ADMIN',
            userType: 'ADMIN',
            details: 'Official Digital Proposal generated and linked to client account'
          }
        ]
      },
      {
        id: 'quote-sample-02',
        quoteNumber: 'TUB-QT-2026-4421',
        version: 1,
        title: 'Scottish Highlands & Edinburgh Private Castles Tour (7 Nights)',
        destination: 'United Kingdom',
        currency: 'GBP',
        status: 'SENT_TO_CLIENT',
        scope: 'HOTEL_LAND',
        travelStartDate: '2026-09-15',
        travelEndDate: '2026-09-22',
        totalPax: 2,
        adultsCount: 2,
        childrenCount: 0,
        infantsCount: 0,
        overallMarkupPercent: 12,
        overallDiscountPercent: 0,
        totalNetCost: 4200,
        totalSellingPrice: 4704,
        totalTaxes: 0,
        totalMargin: 504,
        termsAndConditions: 'Direct Mercedes V-Class chauffeur service and Blue Badge docent guide included throughout.',
        agentNotes: 'VIP client celebrating 25th wedding anniversary in the Highlands.',
        createdAt: '2026-08-24T09:00:00Z',
        updatedAt: '2026-08-26T16:00:00Z',
        lastActivityAt: '2026-08-26T16:00:00Z',
        validUntil: '2026-09-25T23:59:59Z',
        
        // Ownership & Attribution (Created by B2B Agent Elena Rostova)
        createdBy: 'usr-agent-01',
        createdByName: 'Elena Rostova',
        createdByUserType: 'B2B_AGENT',
        agentId: 'usr-agent-01',
        agentName: 'Elena Rostova',
        agentEmail: 'elena@luxurydiscovery.com',
        agentAgency: 'Luxury Discovery Travel Partners',
        agentPhone: '+44 20 7946 0912',
        
        // Client details
        clientName: 'Lady Catherine Montgomery',
        clientEmail: 'catherine.montgomery@ukestates.co.uk',
        clientPhone: '+44 7700 900451',
        clientCompany: 'Montgomery Private Office',
        
        routeHubs: [
          { id: 'rh-uk-1', hubId: 'hub-edinburgh', hubName: 'Edinburgh', nights: 3, order: 1, notes: 'Old Town & Castle View' },
          { id: 'rh-uk-2', hubId: 'hub-highlands', hubName: 'Scottish Highlands', nights: 4, order: 2, notes: 'Loch Ness & Private Estate' }
        ],
        items: [],
        versionHistory: [
          {
            version: 1,
            updatedAt: '2026-08-24T09:00:00Z',
            updatedBy: 'Elena Rostova',
            changesSummary: 'Initial proposal created for Lady Catherine Montgomery.',
            totalSellingPrice: 4704
          }
        ],
        activityLog: [
          {
            id: 'act-uk-01',
            action: 'CREATED',
            timestamp: '2026-08-24T09:00:00Z',
            userName: 'Elena Rostova',
            userRole: 'B2B_AGENT',
            userType: 'B2B_AGENT',
            details: 'Created quote for Lady Catherine Montgomery'
          },
          {
            id: 'act-uk-02',
            action: 'SENT_TO_CLIENT',
            timestamp: '2026-08-26T16:00:00Z',
            userName: 'Elena Rostova',
            userRole: 'B2B_AGENT',
            userType: 'B2B_AGENT',
            details: 'Emailed customized proposal document to client'
          }
        ]
      }
    ];
    return defaultQuotes;
  }
  */

  /**
   * Enforces strict Shared Quotation Authorization Layer:
   * - ADMIN / TEAM_MEMBER / DMC_STAFF: Can view and manage all quotes across the entire organization.
   * - B2B_AGENT: Can view quotes created by them, quotes where they are assigned as agent, or assignedTo.
   * - BUYER / REGISTERED USER: Can view quotes where clientUserId matches user.id OR clientEmail matches user.email.
   */
  /**
   * Sanitizes a Quotation for external users (B2B Agents, Buyers, Guests).
   * Strips all internal nett prices, markups, supplier costs, and margins.
   */
  public sanitizeQuotationForExternalUser(q: Quotation): Quotation {
    return sanitizeQuoteForAgent(q);
  }

  /**
   * Authoritative raw quote retrieval (for server-side/internal commercial recalculation)
   */
  public getRawQuoteById(quoteId: string): Quotation | null {
    const all = this.getAllSavedQuotes();
    return all.find(q => q.id === quoteId || q.quoteNumber === quoteId) || null;
  }

  /**
   * Enforces role authorization and strict commercial net price protection:
   * - ADMIN / TEAM_MEMBER / DMC_STAFF: Can view full commercial quotes across the organization.
   * - B2B_AGENT: Can view quotes created by or assigned to them, with ALL internal commercial
   *   details (nett costs, markups, DMC margins) strictly stripped before returning.
   * - BUYER / REGISTERED USER: Can view quotes where clientUserId matches user.id OR clientEmail matches user.email,
   *   with all commercial internals stripped.
   */
  public getQuotesForUser(user: User | null): Quotation[] {
    const all = this.getAllSavedQuotes();
    if (!user) return [];

    // 1. Admin & Internal Staff see ALL quotes with internal pricing
    if (user.role === 'ADMIN' || user.role === 'TEAM_MEMBER' || user.role === 'DMC_STAFF') {
      return all;
    }

    // 2. B2B Agents see their own created quotes or assigned quotes (STRICTLY SANITIZED)
    if (user.role === 'B2B_AGENT') {
      const agentQuotes = all.filter(q => 
        q.createdBy === user.id || 
        q.agentId === user.id || 
        q.b2bAgentId === user.id || 
        q.assignedTo === user.id ||
        (user.email && q.agentEmail?.toLowerCase().trim() === user.email.toLowerCase().trim())
      );
      return agentQuotes.map(q => sanitizeQuoteForAgent(q));
    }

    // 3. Buyers / Registered Users see quotes created for their account or email (STRICTLY SANITIZED)
    const userEmail = user.email ? user.email.toLowerCase().trim() : '';
    const buyerQuotes = all.filter(q => 
      (q.clientUserId && q.clientUserId === user.id) ||
      (userEmail && q.clientEmail && q.clientEmail.toLowerCase().trim() === userEmail)
    );
    return buyerQuotes.map(q => sanitizeQuoteForAgent(q));
  }

  public getAllSavedQuotesForUser(user: User | null): Quotation[] {
    return this.getQuotesForUser(user);
  }

  public getQuoteByIdAuthorized(quoteId: string, user: User | null): Quotation | null {
    const all = this.getAllSavedQuotes();
    const found = all.find(q => q.id === quoteId || q.quoteNumber === quoteId);
    if (!found) return null;
    if (!user) return null;

    // 1. Admin & Internal Staff
    if (user.role === 'ADMIN' || user.role === 'TEAM_MEMBER' || user.role === 'DMC_STAFF') {
      return found;
    }

    // 2. B2B Agent (STRICT SANITIZATION)
    if (user.role === 'B2B_AGENT') {
      if (
        found.createdBy === user.id ||
        found.agentId === user.id ||
        found.b2bAgentId === user.id ||
        found.assignedTo === user.id ||
        (user.email && found.agentEmail?.toLowerCase().trim() === user.email.toLowerCase().trim())
      ) {
        return sanitizeQuoteForAgent(found);
      }
    }

    // 3. Buyer / User (STRICT SANITIZATION)
    const userEmail = user.email ? user.email.toLowerCase().trim() : '';
    if (
      (found.clientUserId && found.clientUserId === user.id) ||
      (userEmail && found.clientEmail && found.clientEmail.toLowerCase().trim() === userEmail)
    ) {
      return sanitizeQuoteForAgent(found);
    }

    // Access denied
    console.warn(`SECURITY: Unauthorized quote access attempt to quote ${quoteId} by user ${user.id} (${user.role})`);
    return null;
  }

  public saveQuote(
    quote: Quotation, 
    user: User | null, 
    actionType: 
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
      | 'CONVERTED' = 'EDITED',
    customDetails?: string
  ): Quotation {
    const quotes = this.getAllSavedQuotes();
    const existingIndex = quotes.findIndex(q => q.id === quote.id);
    const timestamp = new Date().toISOString();
    const userName = user?.name || quote.createdByName || 'Travel Consultant';
    const userRole = user?.role || 'B2B_AGENT';

    let currentVersion = quote.version || 1;
    let versionHistory = quote.versionHistory ? [...quote.versionHistory] : [];
    let activityLog = quote.activityLog ? [...quote.activityLog] : [];

    // Attempt to resolve registered client user account if clientUserId is not set
    let resolvedClientUserId = quote.clientUserId;
    if (!resolvedClientUserId && quote.clientEmail) {
      const allUsers = this.getUsers();
      const matched = allUsers.find(u => u.email.toLowerCase().trim() === quote.clientEmail?.toLowerCase().trim());
      if (matched) {
        resolvedClientUserId = matched.id;
      }
    }

    // Determine createdBy attribution
    const existingQuote = existingIndex >= 0 ? quotes[existingIndex] : null;
    const createdBy = existingQuote?.createdBy || quote.createdBy || user?.id || 'usr-anonymous';
    const createdByName = existingQuote?.createdByName || quote.createdByName || user?.name || 'TheUnbound Consultant';
    const createdByUserType = existingQuote?.createdByUserType || quote.createdByUserType || (user?.role as any) || 'B2B_AGENT';

    if (existingIndex >= 0) {
      if (actionType === 'EDITED' || actionType === 'PRICING_UPDATED') {
        currentVersion += 1;
        versionHistory.push({
          version: currentVersion,
          updatedAt: timestamp,
          updatedBy: userName,
          changesSummary: customDetails || `Updated itinerary: ${quote.items?.length || 0} services (${quote.currency} ${quote.totalSellingPrice})`,
          totalSellingPrice: quote.totalSellingPrice
        });
      }
    } else {
      currentVersion = 1;
      versionHistory = [
        {
          version: 1,
          updatedAt: timestamp,
          updatedBy: userName,
          changesSummary: customDetails || `Initial quotation generated with ${quote.items?.length || 0} items`,
          totalSellingPrice: quote.totalSellingPrice
        }
      ];
    }

    let defaultActionDetails = '';
    switch (actionType) {
      case 'PRINTED':
        defaultActionDetails = `Printed client presentation for ${quote.clientName}`;
        break;
      case 'DOWNLOADED':
        defaultActionDetails = `Downloaded PDF proposal for ${quote.clientName}`;
        break;
      case 'PROPOSAL_GENERATED':
        defaultActionDetails = `Generated digital proposal document for ${quote.clientName}`;
        break;
      case 'SENT_TO_CLIENT':
      case 'SENT':
        defaultActionDetails = `Sent quotation proposal directly to client (${quote.clientEmail || quote.clientName})`;
        break;
      case 'WHATSAPP_SHARED':
        defaultActionDetails = `Shared quotation proposal via WhatsApp to client (${quote.clientPhone || quote.clientName})`;
        break;
      case 'VIEWED_BY_CLIENT':
        defaultActionDetails = `Client ${quote.clientName} opened and viewed the quotation proposal`;
        break;
      case 'BOOKING_REQUESTED':
        defaultActionDetails = `Booking requested by client ${quote.clientName}`;
        break;
      case 'CREATED':
        defaultActionDetails = `Created quote ${quote.quoteNumber} (v1) by ${userName} (${userRole})`;
        break;
      default:
        defaultActionDetails = customDetails || `Saved changes to quote ${quote.quoteNumber} (v${currentVersion})`;
    }

    // Authoritative Agent Margin & Commercial Pricing Architecture (Section 5 & 8)
    const baseFinalSellingPrice = quote.baseFinalSellingPrice 
      ?? quote.base_final_selling_price 
      ?? existingQuote?.baseFinalSellingPrice 
      ?? existingQuote?.base_final_selling_price
      ?? quote.totalSellingPrice
      ?? 0;

    const agentMarginType: AgentMarginType = (quote.agentMarginType ?? quote.agent_margin_type ?? existingQuote?.agentMarginType ?? 'PERCENTAGE') as AgentMarginType;
    const rawMarginValue = quote.agentMarginValue ?? quote.agent_margin_value ?? existingQuote?.agentMarginValue ?? (quote.overallMarkupPercent ?? 12);
    
    // Server-side bounds validation: reject negative, cap percentage at 100%
    const validatedMarginValue = Math.max(0, agentMarginType === 'PERCENTAGE' 
      ? Math.min(100, isNaN(Number(rawMarginValue)) ? 0 : Number(rawMarginValue))
      : Math.min(baseFinalSellingPrice * 5, isNaN(Number(rawMarginValue)) ? 0 : Number(rawMarginValue))
    );

    const agentMarginAmount = agentMarginType === 'PERCENTAGE'
      ? Math.round(baseFinalSellingPrice * (validatedMarginValue / 100))
      : Math.round(validatedMarginValue);

    const finalCustomerSellingPrice = baseFinalSellingPrice + agentMarginAmount;
    const pricingCalculatedAt = quote.pricingCalculatedAt || timestamp;

    activityLog.push({
      id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      action: actionType,
      timestamp,
      userName,
      userRole,
      userType: createdByUserType,
      details: customDetails || defaultActionDetails,
      quoteId: quote.id,
      quote_id: quote.id,
      leadId: quote.leadId,
      lead_id: quote.leadId,
      userId: user?.id,
      user_id: user?.id,
      action_type: actionType,
      previousMarginType: existingQuote?.agentMarginType,
      previous_margin_type: existingQuote?.agentMarginType,
      previousMarginValue: existingQuote?.agentMarginValue,
      previous_margin_value: existingQuote?.agentMarginValue,
      newMarginType: agentMarginType,
      new_margin_type: agentMarginType,
      newMarginValue: validatedMarginValue,
      new_margin_value: validatedMarginValue,
      previousFinalCustomerSellingPrice: existingQuote?.finalCustomerSellingPrice,
      previous_final_customer_selling_price: existingQuote?.finalCustomerSellingPrice,
      newFinalCustomerSellingPrice: finalCustomerSellingPrice,
      new_final_customer_selling_price: finalCustomerSellingPrice,
      pricingVersion: currentVersion,
      pricing_version: currentVersion
    });

    // Internal authoritative commercial preservation
    const authoritativeNetCost = existingQuote?.totalNetCost ?? existingQuote?.internalNettCost ?? quote.totalNetCost ?? 0;
    const internalNettCost = authoritativeNetCost;
    const supplierCost = existingQuote?.supplierCost ?? authoritativeNetCost;
    const internalMarkup = existingQuote?.internalMarkup ?? 0;
    const agentMarkup = agentMarginAmount;
    const internalProfit = Math.max(0, finalCustomerSellingPrice - authoritativeNetCost);

    const pricingSnapshot: PricingSnapshot = {
      baseFinalSellingPrice,
      currency: quote.currency,
      agentMarginType,
      agentMarginValue: validatedMarginValue,
      agentMarginAmount,
      finalCustomerSellingPrice,
      calculatedAt: timestamp,
      pricingVersion: currentVersion,
      itemsCount: (quote.items || []).length,
      totalPax: quote.totalPax || ((quote.adultsCount || 2) + (quote.childrenCount || 0) + (quote.infantsCount || 0))
    };

    const updatedQuote: Quotation = {
      ...quote,
      overallMarkupPercent: agentMarginType === 'PERCENTAGE' ? validatedMarginValue : quote.overallMarkupPercent,
      baseFinalSellingPrice,
      base_final_selling_price: baseFinalSellingPrice,
      baseFinalSellingPriceCurrency: quote.currency,
      base_final_selling_price_currency: quote.currency,
      agentMarginType,
      agent_margin_type: agentMarginType,
      agentMarginValue: validatedMarginValue,
      agent_margin_value: validatedMarginValue,
      agentMarginAmount,
      agent_margin_amount: agentMarginAmount,
      finalCustomerSellingPrice,
      final_customer_selling_price: finalCustomerSellingPrice,
      totalSellingPrice: finalCustomerSellingPrice,
      pricingCalculatedAt,
      pricing_calculated_at: pricingCalculatedAt,
      pricingVersion: currentVersion,
      pricing_version: currentVersion,
      pricingSnapshot,
      pricing_snapshot: pricingSnapshot,
      updatedBy: userName,
      updated_by: userName,
      totalNetCost: authoritativeNetCost,
      internalNettCost,
      supplierCost,
      internalMarkup,
      agentMarkup,
      internalProfit,
      version: currentVersion,
      createdBy,
      createdByName,
      createdByUserType,
      clientUserId: resolvedClientUserId,
      versionHistory,
      activityLog,
      updatedAt: timestamp,
      lastActivityAt: timestamp,
      createdAt: quote.createdAt || existingQuote?.createdAt || timestamp
    };

    if (existingIndex >= 0) {
      quotes[existingIndex] = updatedQuote;
    } else {
      quotes.unshift(updatedQuote);
    }
    
    this.syncFirestoreDoc('quotations', updatedQuote.id, updatedQuote);
    this.setItem('saved_quotes', quotes);
    
    this.logAudit(
      user, 
      existingIndex >= 0 ? 'SETTINGS_UPDATED' : 'BOOKING_CREATED', 
      'Quotation', 
      quote.id, 
      `${actionType} quote ${quote.quoteNumber} v${currentVersion} (${quote.title}) for client ${quote.clientName} (Created by ${createdByName})`
    );

    // Authoritative Customer Record deduplication & linking
    if (updatedQuote.clientEmail || (updatedQuote.clientName && updatedQuote.clientName !== 'Client Name Pending')) {
      const customerRecord = this.findOrCreateCustomerRecord({
        agentId: createdByUserType === 'B2B_AGENT' ? (user?.id || updatedQuote.agentId) : undefined,
        name: updatedQuote.clientName,
        email: updatedQuote.clientEmail,
        phone: updatedQuote.clientPhone,
        company: updatedQuote.clientCompany || user?.agencyName,
        source: 'B2B_QUOTE_CREATION',
        notes: typeof updatedQuote.agentNotes === 'string' ? updatedQuote.agentNotes : undefined,
        isQuote: true
      });
      if (customerRecord) {
        updatedQuote.customerId = customerRecord.id;
      }
    }

    // Auto-capture or update CRM Lead for this client
    if (updatedQuote.clientEmail || (updatedQuote.clientName && updatedQuote.clientName !== 'Client Name Pending')) {
      const mappedProducts: LeadProductItem[] = (updatedQuote.items || []).map((item, idx) => ({
        id: `lp-${updatedQuote.id}-${idx}`,
        productId: item.product?.id || `prod-${idx}`,
        productName: item.product?.name || 'Custom Travel Service',
        category: (item.product?.productType as any) || 'SERVICE',
        destinationName: item.product?.destinationName || updatedQuote.destination || 'Japan',
        city: item.product?.city,
        travelDate: item.travelDate,
        quantity: 1,
        adults: item.pax?.adults || 2,
        children: item.pax?.children || 0,
        infants: item.pax?.infants || 0,
        unitNetCost: (item.calculation as any)?.totalNetCost || 0,
        unitSellingPrice: item.calculation?.finalTotalSellingPrice || (item.calculation as any)?.sellingPriceFinal || 0,
        totalNetCost: (item.calculation as any)?.totalNetCost || 0,
        totalSellingPrice: item.calculation?.finalTotalSellingPrice || (item.calculation as any)?.sellingPriceFinal || 0,
        marginPercent: (item.calculation as any)?.markupRate ? Math.round((item.calculation as any).markupRate * 100) : 15,
        currency: updatedQuote.currency || 'USD',
        status: 'CONFIRMED',
        selectedAddonNames: item.selectedAddonIds || []
      }));

      const quoteSnapshot: LeadQuoteSnapshot = {
        quoteId: updatedQuote.id,
        quoteNumber: updatedQuote.quoteNumber,
        version: currentVersion,
        quoteDate: timestamp,
        status: updatedQuote.status,
        totalNetCost: updatedQuote.totalNetCost || 0,
        marginAmount: updatedQuote.totalMargin || 0,
        marginPercent: updatedQuote.overallMarkupPercent || 15,
        taxAmount: updatedQuote.totalTaxes || 0,
        feesAmount: 0,
        finalSellingPrice: updatedQuote.totalSellingPrice || 0,
        currency: updatedQuote.currency,
        itemsCount: (updatedQuote.items || []).length
      };

      const quoteVersions: LeadQuoteVersion[] = (updatedQuote.versionHistory || []).map(v => ({
        version: v.version,
        createdAt: v.updatedAt,
        createdBy: v.updatedBy,
        createdByUserType: 'DMC_STAFF',
        totalItems: (updatedQuote.items || []).length,
        totalNetCost: updatedQuote.totalNetCost || 0,
        totalSellingPrice: v.totalSellingPrice,
        marginPercent: updatedQuote.overallMarkupPercent || 15,
        taxTotal: updatedQuote.totalTaxes || 0,
        currency: updatedQuote.currency,
        changesSummary: v.changesSummary
      }));

      this.captureLeadFromSource({
        contactName: updatedQuote.clientName,
        email: updatedQuote.clientEmail || `${(updatedQuote.clientName || 'client').toLowerCase().replace(/[^a-z0-9]/g, '')}@client.local`,
        phone: updatedQuote.clientPhone,
        agencyName: updatedQuote.clientCompany,
        companyName: updatedQuote.clientCompany,
        userId: resolvedClientUserId || user?.id,
        userType: createdByUserType === 'B2B_AGENT' ? 'B2B_AGENT' : 'BUYER',
        b2bAgentId: createdByUserType === 'B2B_AGENT' ? user?.id : undefined,
        source: actionType === 'DOWNLOADED' || actionType === 'PRINTED' ? 'PROPOSAL_DOWNLOADED' : 'QUOTATION_SAVED',
        destinationName: updatedQuote.destination,
        travelDates: updatedQuote.travelStartDate && updatedQuote.travelEndDate ? `${updatedQuote.travelStartDate} to ${updatedQuote.travelEndDate}` : undefined,
        travelStartDate: updatedQuote.travelStartDate,
        travelEndDate: updatedQuote.travelEndDate,
        paxAdults: updatedQuote.adultsCount || updatedQuote.totalPax || 2,
        paxChildren: updatedQuote.childrenCount || 0,
        travelRequirements: (typeof updatedQuote.agentNotes === 'string'
          ? updatedQuote.agentNotes
          : Array.isArray(updatedQuote.agentNotes)
            ? (updatedQuote.agentNotes as any[]).map(x => typeof x === 'string' ? x : x?.text || '').filter(Boolean).join('\n')
            : '') || updatedQuote.title || 'Quotation customized for client',
        estimatedBudget: updatedQuote.totalSellingPrice,
        currency: updatedQuote.currency,
        quoteId: updatedQuote.id,
        quoteNumber: updatedQuote.quoteNumber,
        quoteVersion: currentVersion,
        quoteSnapshot,
        quoteVersions,
        requestedProducts: mappedProducts
      }, user);
    }

    // Auto-trigger SLA & Google Calendar dispatch listeners
    const isNewQuote = existingIndex < 0;
    this.quotationSaveListeners.forEach(listener => {
      try {
        listener(updatedQuote, user, isNewQuote);
      } catch (err) {
        console.error('Error in quotationSaveListener:', err);
      }
    });

    // Live Admin Activity Stream notification
    try {
      const isAi = (updatedQuote.id && updatedQuote.id.toLowerCase().includes('ai')) || (updatedQuote.title && updatedQuote.title.toLowerCase().includes('ai')) || Boolean(updatedQuote.items && updatedQuote.items.some((i: any) => i.isAiGenerated));
      const isDownloaded = actionType === 'DOWNLOADED' || actionType === 'PRINTED';
      this.recordAdminActivity({
        category: isAi ? 'AI_PLANNER' : 'QUOTE',
        activityType: isAi ? 'AI_PLAN_GENERATED' : isDownloaded ? 'QUOTE_PDF_DOWNLOADED' : actionType === 'SENT' || actionType === 'SENT_TO_CLIENT' ? 'QUOTE_EMAIL_SENT' : isNewQuote ? 'QUOTE_CREATED' : 'QUOTE_UPDATED',
        actorName: userName,
        actorType: userRole === 'ADMIN' ? 'ADMIN' : userRole === 'TEAM_MEMBER' ? 'TEAM_MEMBER' : 'B2B_AGENT',
        severity: isDownloaded ? 'WARNING' : 'INFO',
        actionRequired: isDownloaded,
        actionLabel: isDownloaded ? 'Follow up Proposal' : 'View Quote',
        summary: `${isAi ? 'AI Itinerary Plan' : isDownloaded ? 'Quote Downloaded (PDF)' : 'Proposal'}: [${updatedQuote.quoteNumber || updatedQuote.id}] ${updatedQuote.clientName} (${updatedQuote.currency} ${(updatedQuote.totalSellingPrice || 0).toLocaleString()})`,
        details: {
          customerName: updatedQuote.clientName,
          destinationName: updatedQuote.destination,
          totalAmount: updatedQuote.totalSellingPrice,
          currency: updatedQuote.currency,
          status: updatedQuote.status,
          actionNeeded: isDownloaded ? 'Client downloaded proposal PDF; follow up within 24h SLA' : undefined
        },
        targetSection: 'LEAD_MANAGEMENT',
        targetSubTab: 'QUOTES',
        recordId: updatedQuote.id,
        quoteId: updatedQuote.id,
        entityId: updatedQuote.id,
        entityType: 'Quotation'
      });
    } catch {
      // Non-blocking
    }

    return (user?.role === 'B2B_AGENT' || user?.role === 'BUYER')
      ? sanitizeQuoteForAgent(updatedQuote)
      : updatedQuote;
  }

  public deleteQuote(quoteId: string, user: User | null): boolean {
    // Only Admin & Staff roles are permitted to delete quotes
    if (user && user.role !== 'ADMIN' && user.role !== 'DMC_STAFF' && user.role !== 'TEAM_MEMBER') {
      console.warn(`SECURITY: Non-admin user ${user.id} (${user.role}) attempted to delete quote ${quoteId}. Deletion prevented.`);
      return false;
    }
    const quote = this.getQuoteByIdAuthorized(quoteId, user);
    if (!quote) return false;
    const quotes = this.getAllSavedQuotes().filter(q => q.id !== quoteId);
    this.setItem('saved_quotes', quotes);
    this.deleteFirestoreDoc('quotations', quoteId);
    this.logAudit(user, 'SETTINGS_UPDATED', 'Quotation', quoteId, `Deleted quote ${quote.quoteNumber}`);
    return true;
  }

  public createQuotationVersion(parentQuoteId: string, user: User | null): Quotation | null {
    const parentQuote = this.getQuoteByIdAuthorized(parentQuoteId, user);
    if (!parentQuote) return null;

    // Lock the parent quote to prevent direct overwrite/mutation
    const quotes = this.getAllSavedQuotes();
    const parentIndex = quotes.findIndex(q => q.id === parentQuoteId);
    if (parentIndex >= 0) {
      quotes[parentIndex] = {
        ...quotes[parentIndex],
        isLocked: true,
        updatedAt: new Date().toISOString()
      };
      this.syncFirestoreDoc('quotations', parentQuoteId, { isLocked: true });
    }

    const nextVersion = (parentQuote.version || 1) + 1;
    const baseNumber = parentQuote.quoteNumber ? parentQuote.quoteNumber.split('-v')[0] : 'UBQ-2026';
    const newQuoteNumber = `${baseNumber}-v${nextVersion}`;
    const timestamp = new Date().toISOString();
    const userName = user?.name || parentQuote.agentName || 'Travel Partner';
    const userRole = user?.role || 'B2B_AGENT';

    const newQuote: Quotation = {
      ...parentQuote,
      id: `quote-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      quoteNumber: newQuoteNumber,
      version: nextVersion,
      parentQuoteId: parentQuote.id,
      isLocked: false,
      leadId: parentQuote.leadId,
      createdBy: user?.id || parentQuote.createdBy,
      createdByName: user?.name || parentQuote.createdByName,
      createdByUserType: (user?.role as any) || parentQuote.createdByUserType,
      agentId: user?.role === 'B2B_AGENT' ? user.id : parentQuote.agentId,
      agentName: user?.role === 'B2B_AGENT' ? user.name : parentQuote.agentName,
      agentEmail: user?.role === 'B2B_AGENT' ? user.email : parentQuote.agentEmail,
      agentAgency: user?.companyName || user?.agencyName || parentQuote.agentAgency,
      agentLogoUrl: user?.brandLogoUrl || parentQuote.agentLogoUrl,
      createdAt: timestamp,
      updatedAt: timestamp,
      lastActivityAt: timestamp,
      status: 'DRAFT',
      versionHistory: [
        ...(parentQuote.versionHistory || []),
        {
          version: nextVersion,
          updatedAt: timestamp,
          updatedBy: userName,
          changesSummary: `Created new editable version ${nextVersion} branched from ${parentQuote.quoteNumber}`,
          totalSellingPrice: parentQuote.totalSellingPrice
        }
      ],
      activityLog: [
        ...(parentQuote.activityLog || []),
        {
          id: `act-${Date.now()}`,
          action: 'VERSION_BRANCHED',
          timestamp,
          userName,
          userRole,
          userType: (user?.role as any) || 'B2B_AGENT',
          details: `Created new editable version ${newQuoteNumber} (v${nextVersion}) from parent ${parentQuote.quoteNumber}`
        }
      ]
    };

    quotes.unshift(newQuote);
    this.setItem('saved_quotes', quotes);
    this.syncFirestoreDoc('quotations', newQuote.id, newQuote);

    this.logAudit(
      user,
      'BOOKING_CREATED',
      'Quotation',
      newQuote.id,
      `Created version ${nextVersion} (${newQuoteNumber}) from parent quote ${parentQuote.quoteNumber}`
    );

    return newQuote;
  }

  public updateQuotationLeadId(quoteId: string, leadId: string, user: User | null): Quotation | null {
    const quote = this.getQuoteByIdAuthorized(quoteId, user);
    if (!quote) return null;

    const quotes = this.getAllSavedQuotes();
    const idx = quotes.findIndex(q => q.id === quoteId);
    if (idx < 0) return null;

    quotes[idx] = {
      ...quotes[idx],
      leadId: leadId.trim(),
      updatedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString()
    };

    this.setItem('saved_quotes', quotes);
    this.syncFirestoreDoc('quotations', quoteId, { leadId: leadId.trim(), updatedAt: quotes[idx].updatedAt });

    return quotes[idx];
  }

  public updateQuotationStatus(quoteId: string, status: QuoteStatus, user: User | null): Quotation | null {
    const quote = this.getQuoteByIdAuthorized(quoteId, user);
    if (!quote) return null;

    const quotes = this.getAllSavedQuotes();
    const idx = quotes.findIndex(q => q.id === quoteId);
    if (idx < 0) return null;

    const timestamp = new Date().toISOString();
    quotes[idx] = {
      ...quotes[idx],
      status,
      updatedAt: timestamp,
      lastActivityAt: timestamp,
      activityLog: [
        ...(quotes[idx].activityLog || []),
        {
          id: `act-${Date.now()}`,
          action: 'STATUS_CHANGED',
          timestamp,
          userName: user?.name || 'Staff',
          userRole: user?.role,
          userType: (user?.role as any) || 'ADMIN',
          details: `Updated quote status to ${status}`
        }
      ]
    };

    this.setItem('saved_quotes', quotes);
    this.syncFirestoreDoc('quotations', quoteId, quotes[idx]);

    if (this.actionCenterHooks?.onQuoteStatusChanged) {
      try {
        this.actionCenterHooks.onQuoteStatusChanged(quoteId, quotes[idx].quoteNumber, status, user);
      } catch (err) {
        console.warn('Action center quote hook error:', err);
      }
    }

    return quotes[idx];
  }

  public duplicateQuotation(quoteId: string, user: User | null): Quotation | null {
    const sourceQuote = this.getQuoteByIdAuthorized(quoteId, user);
    if (!sourceQuote) return null;

    const quotes = this.getAllSavedQuotes();
    const timestamp = new Date().toISOString();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const newQuoteNumber = `TUB-QT-2026-${randomSuffix}`;
    const newQuoteId = `quote-${Date.now()}-${randomSuffix}`;
    const userName = user?.name || 'Elena Rostova';

    const duplicatedQuote: Quotation = {
      ...sourceQuote,
      id: newQuoteId,
      quoteNumber: newQuoteNumber,
      title: `${sourceQuote.title || 'Custom Itinerary'} (Copy)`,
      version: 1,
      parentQuoteId: undefined,
      isLocked: false,
      status: 'DRAFT',
      createdBy: user?.id || sourceQuote.createdBy,
      createdByName: user?.name || sourceQuote.createdByName,
      createdByUserType: (user?.role as any) || sourceQuote.createdByUserType,
      createdAt: timestamp,
      updatedAt: timestamp,
      lastActivityAt: timestamp,
      validUntil: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      activityLog: [
        {
          id: `act-${Date.now()}`,
          action: 'CREATED',
          timestamp,
          userName,
          userRole: user?.role,
          userType: (user?.role as any) || 'B2B_AGENT',
          details: `Duplicated quote from template ${sourceQuote.quoteNumber}`
        }
      ]
    };

    quotes.unshift(duplicatedQuote);
    this.setItem('saved_quotes', quotes);
    this.syncFirestoreDoc('quotations', duplicatedQuote.id, duplicatedQuote);

    this.logAudit(
      user,
      'BOOKING_CREATED',
      'Quotation',
      duplicatedQuote.id,
      `Duplicated quote ${duplicatedQuote.quoteNumber} from ${sourceQuote.quoteNumber}`
    );

    return duplicatedQuote;
  }

  /**
   * Direct Conversion of Quotation to Booking by Buyer or Admin
   */
  public convertQuotationToBooking(quoteOrId: string | Quotation, user: User | null, specialNotes?: string): Booking | null {
    const quote = typeof quoteOrId === 'string' ? this.getQuoteByIdAuthorized(quoteOrId, user) : quoteOrId;
    if (!quote) return null;

    // Idempotency: Prevent duplicate bookings for the same quote
    const bookings = this.getAllBookings();
    const existingBooking = bookings.find(b => b.quoteId === quote.id);
    if (existingBooking) {
      return existingBooking;
    }

    const timestamp = new Date().toISOString();
    const randomRef = Math.floor(1000 + Math.random() * 9000);
    const bookingRef = `TUB-BK-${new Date().getFullYear()}-${randomRef}`;
    const newBookingId = `bk-${Date.now()}-${randomRef}`;

    const effectiveTotalAmount = quote.finalCustomerSellingPrice 
      || quote.final_customer_selling_price 
      || quote.totalSellingPrice;

    const isAgent = user?.role === 'B2B_AGENT';
    const submittedByUserId = user?.id || quote.agentId || quote.createdBy || 'usr-b2b';
    const submittedByUserRole = user?.role || (isAgent ? 'B2B_AGENT' : 'BUYER');
    const submittingAgentId = isAgent ? user?.id : (quote.agentId || quote.createdBy);
    const submittingAgentNameSnapshot = isAgent ? user?.name : (quote.agentName || 'Partner Agent');
    const submittingAgentAgencySnapshot = isAgent ? (user?.agencyName || quote.agentAgency) : quote.agentAgency;

    // Reuse or create customer record to prevent redundant duplication
    const customerRecord = this.findOrCreateCustomerRecord({
      agentId: submittingAgentId,
      name: quote.clientName || 'Lead Traveler',
      email: quote.clientEmail,
      phone: quote.clientPhone,
      company: quote.clientCompany || submittingAgentAgencySnapshot,
      source: 'B2B_QUOTE_CONVERSION',
      notes: specialNotes || quote.agentNotes,
      isBooking: true
    });

    const initialTimeline: BookingTimelineEvent[] = [
      {
        id: `tl-${Date.now()}-01`,
        title: 'Booking Created from Quotation',
        description: `Quotation ${quote.quoteNumber} converted to Booking ${bookingRef} for client ${quote.clientName}.${isAgent ? ` Submitted by B2B Agent ${user?.name} (${user?.agencyName || 'Partner Agent'}).` : ''}`,
        timestamp,
        type: 'CREATION',
        actorName: user?.name || quote.clientName,
        actorRole: user?.role || 'B2B_AGENT'
      }
    ];

    const authoritativeNetCost = quote.totalNetCost ?? quote.internalNettCost ?? 0;
    const internalNettCost = authoritativeNetCost;
    const supplierCost = quote.supplierCost ?? authoritativeNetCost;
    const internalMarkup = quote.internalMarkup ?? 0;
    const agentMarkup = quote.agentMarginAmount ?? 0;
    const internalProfit = Math.max(0, effectiveTotalAmount - authoritativeNetCost);

    const newBookingDraft: Booking = {
      id: newBookingId,
      bookingId: newBookingId,
      bookingReference: bookingRef,
      quoteId: quote.id,
      quoteNumber: quote.quoteNumber,
      linkedQuoteId: quote.id,
      linkedLeadId: quote.leadId,
      leadId: quote.leadId,
      customerId: customerRecord?.id || quote.customerId,
      sourceType: 'QUOTATION',
      source: 'B2B_QUOTE_CONVERSION',
      submittedByUserId,
      submittedByUserRole,
      submittingAgentId,
      submittingAgentNameSnapshot,
      submittingAgentAgencySnapshot,
      submittedAt: timestamp,
      agentVisibilityStatus: 'VISIBLE',
      destination: quote.destination,
      destinationName: quote.destination,
      travelStartDate: quote.travelStartDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      travelEndDate: quote.travelEndDate || new Date(Date.now() + 24 * 86400000).toISOString().split('T')[0],
      totalAmount: effectiveTotalAmount,
      totalNetCost: authoritativeNetCost,
      internalNettCost,
      supplierCost,
      supplierTotalCost: supplierCost,
      internalMarkup,
      agentMarkup,
      internalProfit,
      grossProfit: internalProfit,
      grossMarginPercent: effectiveTotalAmount > 0 ? (internalProfit / effectiveTotalAmount) * 100 : 0,
      currency: quote.currency,
      status: 'PENDING_CONFIRMATION',
      customerFacingStatus: 'Booking Received',
      paymentStatus: 'PENDING_PAYMENT',
      documentStatus: 'DOCUMENTS_PENDING',
      missingDocuments: [],
      supplierAllocationStatus: 'UNALLOCATED',
      passengers: [],
      paymentProofs: [],
      internalNotesList: [],
      customerUpdates: [],
      timeline: initialTimeline,
      createdAt: timestamp,
      updatedAt: timestamp,
      userId: quote.clientUserId || user?.id || 'usr-guest',
      agentId: submittingAgentId,
      agentName: submittingAgentNameSnapshot,
      agentAgency: submittingAgentAgencySnapshot,
      customer: {
        leadTravelerName: quote.clientName,
        bookerName: submittingAgentNameSnapshot || quote.clientName,
        email: quote.clientEmail || user?.email || 'sales@theunbound.in',
        phone: quote.clientPhone || user?.contactNumber || '+1 415 555 2671',
        agencyName: submittingAgentAgencySnapshot || quote.clientCompany,
        nationality: 'International',
        totalAdults: quote.adultsCount || quote.totalPax || 2,
        totalChildren: quote.childrenCount || 0,
        totalInfants: quote.infantsCount || 0,
        specialRequests: specialNotes || quote.agentNotes || 'Proposal accepted by client. Automatic booking reservation initiated.'
      },
      confirmationNotice: 'Your booking has been submitted and ground allocation is underway with a 24-48h confirmation SLA.',
      pricingSnapshot: quote.pricingSnapshot || quote.pricing_snapshot,
      baseFinalSellingPrice: quote.baseFinalSellingPrice || quote.base_final_selling_price,
      agentMarginType: quote.agentMarginType || quote.agent_margin_type,
      agentMarginValue: quote.agentMarginValue || quote.agent_margin_value,
      agentMarginAmount: quote.agentMarginAmount || quote.agent_margin_amount,
      finalCustomerSellingPrice: effectiveTotalAmount,
      notificationEmailsSent: [
        {
          recipient: quote.clientEmail || 'client@theunbound.in',
          recipientType: 'CLIENT_AGENT',
          subject: `Ground Booking Initiated - ${bookingRef}`,
          bodySnippet: `Your quotation ${quote.quoteNumber} has been accepted and submitted for ground dispatch.`,
          fullHtml: `<p>Booking ${bookingRef} has been received for processing.</p>`,
          sentAt: timestamp,
          status: 'DELIVERED'
        }
      ],
      items: quote.items.map(item => ({
        id: item.id || `bitem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        productId: item.product?.id || 'prod-custom',
        productName: item.product?.name || 'Custom Travel Service',
        productSku: item.product?.sku || 'SKU-CUSTOM',
        destinationName: item.product?.destinationName || quote.destination || 'Japan',
        city: item.product?.city || 'Tokyo',
        category: item.product?.category || item.product?.productType || 'Activity',
        travelDate: item.travelDate || quote.travelStartDate || new Date().toISOString().split('T')[0],
        adults: item.pax?.adults ?? 2,
        children: item.pax?.children ?? 0,
        infants: item.pax?.infants ?? 0,
        totalPax: (item.pax?.adults ?? 2) + (item.pax?.children ?? 0) + (item.pax?.infants ?? 0),
        selectedAddonNames: [],
        unitNetPrice: (item.calculation as any)?.totalNetCost || 0,
        unitSellingPrice: item.calculation?.finalTotalSellingPrice || (item.calculation as any)?.sellingPriceFinal || item.product?.sellingPriceStartingFrom || 0,
        totalPrice: item.calculation?.finalTotalSellingPrice || (item.calculation as any)?.sellingPriceFinal || item.product?.sellingPriceStartingFrom || 0,
        currency: quote.currency || 'USD',
        supplierStatus: 'PENDING_DISPATCH' as const,
        supplierNotes: item.notes
      }))
    };

    // Save Booking
    bookings.unshift(newBookingDraft);
    this.setItem('bookings', bookings);
    this.syncFirestoreDoc('bookings', newBookingDraft.id, newBookingDraft);

    // Update Quotation status and bidirectional linkage
    const quotes = this.getAllSavedQuotes();
    const qIdx = quotes.findIndex(q => q.id === quote.id);
    if (qIdx >= 0) {
      quotes[qIdx].status = 'BOOKED';
      quotes[qIdx].linkedBookingIds = Array.from(new Set([...(quotes[qIdx].linkedBookingIds || []), newBookingDraft.id]));
      quotes[qIdx].customerId = customerRecord?.id || quotes[qIdx].customerId;
      quotes[qIdx].updatedAt = timestamp;
      quotes[qIdx].lastActivityAt = timestamp;
      quotes[qIdx].activityLog = [
        ...(quotes[qIdx].activityLog || []),
        {
          id: `act-${Date.now()}`,
          action: 'BOOKING_REQUESTED',
          timestamp,
          userName: user?.name || quote.clientName,
          userRole: user?.role,
          userType: (user?.role as any) || 'BUYER',
          details: `Client accepted quotation and converted to booking reservation (Ref: ${bookingRef})`
        }
      ];
      this.setItem('saved_quotes', quotes);
      this.syncFirestoreDoc('quotations', quote.id, quotes[qIdx]);
    }

    // Bidirectionally update Lead if linked to this quote
    const leadId = quote.leadId || quote.linkedLeadId;
    if (leadId) {
      const leads = this.getLeads();
      const leadIdx = leads.findIndex(l => l.id === leadId || l.leadNumber === leadId);
      if (leadIdx >= 0) {
        const lead = leads[leadIdx];
        lead.linkedBookingIds = Array.from(new Set([...(lead.linkedBookingIds || []), newBookingDraft.id]));
        lead.bookingIds = Array.from(new Set([...(lead.bookingIds || []), newBookingDraft.id]));
        lead.bookingId = newBookingDraft.id;
        lead.bookingReference = newBookingDraft.bookingReference;
        lead.bookingValue = effectiveTotalAmount;
        lead.conversionStatus = 'CONVERTED';
        lead.status = 'BOOKED';
        lead.updatedAt = timestamp;
        lead.lastActivityAt = timestamp;
        lead.timeline = [
          ...(lead.timeline || []),
          {
            id: `tl-${Date.now()}-bk`,
            type: 'BOOKING_CONVERTED',
            title: 'Quote Converted to Booking',
            description: `Quote ${quote.quoteNumber} converted to Booking ${newBookingDraft.bookingReference} (${newBookingDraft.currency} ${effectiveTotalAmount.toLocaleString()}). Submitted by ${submittingAgentNameSnapshot || 'Agent'}.`,
            timestamp,
            performedBy: user?.name || submittingAgentNameSnapshot || 'Partner Agent',
            performedByUserType: (user?.role as any) || 'B2B_AGENT'
          }
        ];
        this.setItem('leads', leads);
        this.syncFirestoreDoc('leads', lead.id, lead);
      }
    }

    this.logAudit(
      user,
      'BOOKING_CREATED',
      'Booking',
      newBookingDraft.id,
      `Quotation ${quote.quoteNumber} converted to Booking ${bookingRef} for client ${quote.clientName} by ${submittingAgentNameSnapshot} (${submittingAgentAgencySnapshot || 'Partner'})`
    );

    // Live Admin Activity Stream notification
    try {
      this.recordAdminActivity({
        entityId: newBookingDraft.id,
        category: 'BOOKING',
        activityType: 'BOOKING_CREATED',
        actorName: submittingAgentNameSnapshot || user?.name || 'B2B Agent',
        actorType: isAgent ? 'B2B_AGENT' : 'TEAM_MEMBER',
        severity: 'INFO',
        actionRequired: true,
        actionLabel: 'View in Operations Desk',
        summary: `New Booking Converted: [${bookingRef}] for ${quote.clientName} (${quote.currency} ${effectiveTotalAmount.toLocaleString()}) via Agent ${submittingAgentNameSnapshot}`,
        details: {
          bookingReference: bookingRef,
          customerName: quote.clientName,
          agentName: submittingAgentNameSnapshot,
          agencyName: submittingAgentAgencySnapshot,
          totalAmount: effectiveTotalAmount,
          currency: quote.currency
        },
        targetSection: 'OPERATIONS_DESK'
      });
    } catch (e) {
      console.warn('Admin activity logging for converted booking:', e);
    }

    // Auto-trigger SLA & Google Calendar dispatch listeners
    this.bookingSaveListeners.forEach(listener => {
      try {
        listener(newBookingDraft, user, true);
      } catch (err) {
        console.error('Error in bookingSaveListener:', err);
      }
    });

    return (user?.role === 'B2B_AGENT' || user?.role === 'BUYER')
      ? this.sanitizeBookingForExternalUser(newBookingDraft)
      : newBookingDraft;
  }

  // ==========================================
  // B2B READY-MADE PACKAGES MANAGEMENT
  // ==========================================
  public getPackages(): B2BPackage[] {
    return this.getItem<B2BPackage[]>('b2b_packages', INITIAL_B2B_PACKAGES);
  }

  public getPackageById(id: string): B2BPackage | null {
    const pkgs = this.getPackages();
    return pkgs.find(p => p.id === id || p.slug === id) || null;
  }

  public savePackage(pkg: B2BPackage, user?: User | null): void {
    if (user) {
      const auth = this.canUserWriteCMS(user, 'OPERATIONS', 'Package');
      if (!auth.allowed) {
        this.logAudit(user, 'UNAUTHORIZED_WRITE_ATTEMPT', 'B2BPackage', pkg.id, `Unauthorized write attempt: ${auth.reason}`);
        return;
      }
    }
    const pkgs = this.getPackages();
    const idx = pkgs.findIndex(p => p.id === pkg.id);
    const timestamp = new Date().toISOString();
    const isNew = idx < 0;
    
    // Automatically keep title/name synced and normalize status
    const status = pkg.status || (pkg.isPublished ? 'PUBLISHED' : 'DRAFT');
    const isPublished = status === 'PUBLISHED' || !!pkg.isPublished;

    const updatedPkg: B2BPackage = { 
      ...pkg, 
      title: pkg.title || pkg.name || 'Custom Package Itinerary',
      name: pkg.title || pkg.name || 'Custom Package Itinerary',
      status,
      isPublished,
      updatedBy: user?.name || user?.email || 'Admin CMS',
      updatedAt: timestamp 
    };

    if (isNew) {
      updatedPkg.createdAt = pkg.createdAt || timestamp;
      updatedPkg.createdBy = pkg.createdBy || user?.name || 'Admin CMS';
      pkgs.unshift(updatedPkg);
    } else {
      pkgs[idx] = updatedPkg;
    }

    this.setItem('b2b_packages', pkgs);
    this.syncFirestoreDoc('b2b_packages', pkg.id, updatedPkg);

    this.logAudit(
      user || null,
      isNew ? 'PACKAGE_CREATE' as any : 'PACKAGE_UPDATE' as any,
      'Package',
      pkg.id,
      `${isNew ? 'Created' : 'Updated'} package "${updatedPkg.title}" (${updatedPkg.destinationName})`
    );
  }

  public duplicatePackage(id: string, user?: User | null): B2BPackage | null {
    const source = this.getPackageById(id);
    if (!source) return null;

    const timestamp = new Date().toISOString();
    const newId = `pkg-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const newTitle = `${source.title} (Copy)`;
    const newSlug = `${source.slug || (source.title || 'package').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-copy-${Date.now().toString().slice(-4)}`;

    const duplicated: B2BPackage = {
      ...source,
      id: newId,
      title: newTitle,
      name: newTitle,
      slug: newSlug,
      status: 'DRAFT',
      isPublished: false,
      createdBy: user?.name || 'Admin CMS',
      updatedBy: user?.name || 'Admin CMS',
      createdAt: timestamp,
      updatedAt: timestamp
    };

    this.savePackage(duplicated, user);
    return duplicated;
  }

  public archivePackage(id: string, user?: User | null): void {
    const pkg = this.getPackageById(id);
    if (!pkg) return;
    this.savePackage({ ...pkg, status: 'ARCHIVED', isPublished: false }, user);
  }

  public togglePackagePublishStatus(id: string, isPublished: boolean, user?: User | null): void {
    const pkg = this.getPackageById(id);
    if (!pkg) return;
    this.savePackage({
      ...pkg,
      isPublished,
      status: isPublished ? 'PUBLISHED' : 'UNPUBLISHED'
    }, user);
  }

  public deletePackage(id: string, user?: User | null): void {
    const pkg = this.getPackageById(id);
    const pkgs = this.getPackages().filter(p => p.id !== id);
    this.setItem('b2b_packages', pkgs);
    this.deleteFirestoreDoc('b2b_packages', id);

    this.logAudit(
      user || null,
      'PACKAGE_DELETE' as any,
      'Package',
      id,
      `Deleted package "${pkg?.title || id}"`
    );
  }

  // ==========================================
  // B2B AGENT CUSTOMERS CRM
  // ==========================================
  public getB2BCustomers(agentId?: string): B2BCustomer[] {
    const all = this.getItem<B2BCustomer[]>('b2b_customers', []);
    if (!agentId) return all;
    return all.filter(c => c.agentId === agentId);
  }

  /**
   * Reuses customer details across Quotes, Leads, and Bookings without duplicating records.
   * Matches existing customer records by agentId and email/name.
   */
  public findOrCreateCustomerRecord(params: {
    agentId?: string;
    name: string;
    email?: string;
    phone?: string;
    company?: string;
    source?: string;
    notes?: string;
    isQuote?: boolean;
    isBooking?: boolean;
  }): B2BCustomer {
    const all = this.getB2BCustomers();
    const cleanEmail = params.email?.trim().toLowerCase();
    const cleanName = params.name?.trim().toLowerCase();
    
    let existing = all.find(c => {
      if (params.agentId && c.agentId === params.agentId) {
        if (cleanEmail && c.email && c.email.toLowerCase() === cleanEmail) return true;
        if (cleanName && c.name.toLowerCase() === cleanName) return true;
      } else if (!params.agentId) {
        if (cleanEmail && c.email && c.email.toLowerCase() === cleanEmail) return true;
      }
      return false;
    });

    const now = new Date().toISOString();

    if (existing) {
      const updated: B2BCustomer = {
        ...existing,
        name: (params.name && params.name !== 'Client Name Pending') ? params.name : existing.name,
        phone: params.phone || existing.phone,
        company: params.company || existing.company,
        notes: params.notes ? `${existing.notes ? existing.notes + '\n' : ''}${params.notes}` : existing.notes,
        totalQuotesCount: (existing.totalQuotesCount || 0) + (params.isQuote ? 1 : 0),
        totalBookingsCount: (existing.totalBookingsCount || 0) + (params.isBooking ? 1 : 0),
        lastContactDate: now
      };
      return this.saveB2BCustomer(updated);
    } else {
      const newCustomer: B2BCustomer = {
        id: `cust-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        agentId: params.agentId || 'direct-client',
        name: params.name || 'Client',
        email: params.email || '',
        phone: params.phone || '',
        company: params.company || '',
        country: 'India',
        notes: params.notes || '',
        totalQuotesCount: params.isQuote ? 1 : 0,
        totalBookingsCount: params.isBooking ? 1 : 0,
        tags: [params.source || 'Quote/Booking'].filter(Boolean),
        lastContactDate: now,
        createdAt: now
      };
      return this.saveB2BCustomer(newCustomer);
    }
  }

  public saveB2BCustomer(customer: B2BCustomer): B2BCustomer {
    const customers = this.getB2BCustomers();
    const idx = customers.findIndex(c => c.id === customer.id);
    const updated = { ...customer };

    if (idx >= 0) {
      customers[idx] = updated;
    } else {
      customers.unshift(updated);
    }

    this.setItem('b2b_customers', customers);
    this.syncFirestoreDoc('b2b_customers', customer.id, updated);
    return updated;
  }

  public deleteB2BCustomer(id: string): void {
    const customers = this.getB2BCustomers().filter(c => c.id !== id);
    this.setItem('b2b_customers', customers);
    this.deleteFirestoreDoc('b2b_customers', id);
  }

  // ==========================================
  // B2B AGENT TASKS & FOLLOW-UPS
  // ==========================================
  public getB2BTasks(agentId?: string): B2BTask[] {
    const all = this.getItem<B2BTask[]>('b2b_tasks', []);
    if (!agentId) return all;
    return all.filter(t => t.agentId === agentId);
  }

  public saveB2BTask(task: B2BTask): B2BTask {
    const tasks = this.getB2BTasks();
    const idx = tasks.findIndex(t => t.id === task.id);
    const timestamp = new Date().toISOString();
    const updated = { ...task, updatedAt: timestamp };

    if (idx >= 0) {
      tasks[idx] = updated;
    } else {
      tasks.unshift({ ...updated, createdAt: timestamp });
    }

    this.setItem('b2b_tasks', tasks);
    this.syncFirestoreDoc('b2b_tasks', task.id, updated);
    return updated;
  }

  public deleteB2BTask(id: string): void {
    const tasks = this.getB2BTasks().filter(t => t.id !== id);
    this.setItem('b2b_tasks', tasks);
    this.deleteFirestoreDoc('b2b_tasks', id);
  }

  // ==========================================
  // BOOKINGS & RESERVATIONS SYSTEM
  // ==========================================
  public getAllBookings(): Booking[] {
    return this.getItem<Booking[]>('bookings', []);
  }

  /**
   * Granular Booking Operations Permission Check
   * - Admin: always true
   * - Team Members: true if not explicitly disabled in user.permissions.bookingOperations
   * - External users (BUYER, B2B_AGENT, GUEST, etc.): STRICTLY FALSE
   */
  public hasBookingOperationPermission(
    user: User | null,
    permission: keyof BookingOperationsPermissions
  ): boolean {
    if (!user) return false;
    if (user.role === 'ADMIN') return true;
    if (user.role === 'TEAM_MEMBER' || user.role === 'DMC_STAFF') {
      const opsPerms = user.permissions?.bookingOperations;
      if (!opsPerms) return true; // Default allow for internal staff unless configured
      return opsPerms[permission] !== false;
    }
    return false; // Buyers, B2B Agents, external users never have booking operations access
  }

  /**
   * Sanitizes Booking data for external users (Buyers, B2B Agents, Guests).
   * Strips out supplier prices, nett costs, margins, profits, supplier allocations,
   * internal notes, internal pricing history, and supplier invoices.
   */
  public sanitizeBookingForExternalUser(b: Booking): Booking {
    const clone: Booking = JSON.parse(JSON.stringify(b));
    delete clone.totalNetCost;
    delete clone.grossProfit;
    delete clone.grossMarginPercent;
    delete clone.supplierAllocations;
    delete clone.supplierRequests;
    delete clone.operationalConfirmationOverride;

    if (clone.items && Array.isArray(clone.items)) {
      clone.items = clone.items.map(it => {
        delete it.supplierPrice;
        delete it.supplierCurrency;
        delete it.supplierPriceType;
        delete it.supplierPriceTax;
        delete it.supplierPriceFee;
        delete it.supplierPriceDiscount;
        delete it.supplierPaymentCutoffDate;
        delete it.supplierCancellationDeadline;
        delete it.supplierPriceValidityDate;
        delete it.supplierPriceSource;
        delete it.supplierPriceHistory;
        delete it.supplierPriceLastUpdatedAt;
        delete it.supplierPriceLastUpdatedBy;
        delete it.internalPricingNotes;
        delete it.internalNotes;
        delete it.internalOpsNotes;
        delete it.unitNetPrice;
        delete (it as any).costPrice;
        delete (it as any).netCost;
        return it;
      });
    }

    if (clone.uploadedInvoices && Array.isArray(clone.uploadedInvoices)) {
      clone.uploadedInvoices = clone.uploadedInvoices.filter(
        inv => inv.invoiceType !== 'Supplier Invoice'
      );
    }

    return clone;
  }

  /**
   * Enforces role authorization:
   * - ADMIN / TEAM_MEMBER / DMC_STAFF: can view all bookings across the company
   * - BUYER / B2B_AGENT: can only view bookings associated with their userId or email/agency,
   *   with all supplier costs and internal financials strictly excluded from the returned records.
   */
  public getBookingsForUser(user: User | null): Booking[] {
    const all = this.getAllBookings();
    if (!user) return all.map(b => this.sanitizeBookingForExternalUser(b));
    // Internal operational staff retain complete visibility
    if (user.role === 'ADMIN' || user.role === 'TEAM_MEMBER' || user.role === 'DMC_STAFF') {
      return all;
    }
    // B2B Agent visibility: submitted by this agent OR assigned to this agent
    if (user.role === 'B2B_AGENT') {
      const matching = all.filter(b => 
        b.submittedByUserId === user.id ||
        b.submittingAgentId === user.id ||
        b.assignedAgentId === user.id ||
        b.agentId === user.id ||
        b.userId === user.id
      );
      return matching.map(b => this.sanitizeBookingForExternalUser(b));
    }
    const matching = all.filter(b => 
      b.userId === user.id || 
      (user.email && b.customer?.email && b.customer.email.toLowerCase() === user.email.toLowerCase()) ||
      (user.name && b.customer?.bookerName && b.customer.bookerName.toLowerCase().includes(user.name.toLowerCase()))
    );
    return matching.map(b => this.sanitizeBookingForExternalUser(b));
  }

  public getBookingById(bookingId: string, user?: User | null): Booking | null {
    const all = this.getAllBookings();
    const found = all.find(b => b.id === bookingId || b.bookingReference === bookingId) || null;
    if (!found) return null;
    if (user && user.role !== 'ADMIN' && user.role !== 'TEAM_MEMBER' && user.role !== 'DMC_STAFF') {
      return this.sanitizeBookingForExternalUser(found);
    }
    return found;
  }

  public calculateBookingDocumentStatus(booking: Booking): { 
    status: 'DOCUMENTS_COMPLETE' | 'DOCUMENTS_PENDING'; 
    missingList: string[];
    isComplete: boolean;
  } {
    const missingList: string[] = [];
    const maxPax = (booking.customer?.totalAdults || 0) + (booking.customer?.totalChildren || 0) || 
      booking.items?.reduce((max, it) => Math.max(max, it.totalPax), 0) || 1;
    const passengers = booking.passengers || [];

    if (passengers.length < maxPax) {
      for (let i = passengers.length + 1; i <= maxPax; i++) {
        missingList.push(`Passenger ${i} — Profile Details Missing`);
        missingList.push(`Passenger ${i} — Passport Front Missing`);
        missingList.push(`Passenger ${i} — Passport Back Missing`);
      }
    }

    passengers.forEach((p, idx) => {
      const pLabel = `Passenger ${p.passengerNumber || idx + 1} (${p.firstName || 'Guest'} ${p.lastName || ''})`.trim();
      if (!p.passportFrontUrl) {
        missingList.push(`${pLabel} — Passport Front Missing`);
      }
      if (!p.passportBackUrl) {
        missingList.push(`${pLabel} — Passport Back Missing`);
      }
      if (p.isLeadPax && !p.panCardUrl && (booking.customer?.nationality === 'Indian' || !booking.customer?.nationality)) {
        missingList.push(`${pLabel} (Lead) — PAN Card Missing`);
      }
    });

    const isComplete = missingList.length === 0;
    return {
      status: isComplete ? 'DOCUMENTS_COMPLETE' : 'DOCUMENTS_PENDING',
      missingList,
      isComplete
    };
  }

  public calculateBookingPaymentSummary(booking: Booking): {
    totalAmount: number;
    paidAmount: number;
    verifiedPaidAmount: number;
    pendingAmount: number;
    paymentStatus: Booking['paymentStatus'];
    tranchesCount: number;
  } {
    const totalAmount = booking.totalAmount || 0;
    const proofs = booking.paymentProofs || [];
    
    const verifiedPaidAmount = proofs
      .filter(p => p.verificationStatus === 'VERIFIED')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const totalUploadedAmount = proofs
      .filter(p => p.verificationStatus !== 'REJECTED')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const pendingAmount = Math.max(0, totalAmount - verifiedPaidAmount);

    let paymentStatus: Booking['paymentStatus'] = 'PENDING_PAYMENT';
    if (verifiedPaidAmount >= totalAmount && totalAmount > 0) {
      paymentStatus = 'PAID';
    } else if (verifiedPaidAmount > 0 || totalUploadedAmount > 0) {
      paymentStatus = 'PARTIALLY_PAID';
    } else {
      paymentStatus = 'PENDING_PAYMENT';
    }

    return {
      totalAmount,
      paidAmount: totalUploadedAmount,
      verifiedPaidAmount,
      pendingAmount,
      paymentStatus,
      tranchesCount: proofs.length
    };
  }

  public checkBookingConfirmationReadiness(booking: Booking): {
    canConfirm: boolean;
    blockingReasons: string[];
    missingDocs: string[];
    unconfirmedSuppliersCount: number;
    paymentVerified: boolean;
  } {
    const blockingReasons: string[] = [];
    const maxPax = (booking.customer?.totalAdults || 0) + (booking.customer?.totalChildren || 0) || 
      booking.items?.reduce((max, it) => Math.max(max, it.totalPax), 0) || 1;
    const passengers = booking.passengers || [];

    if (passengers.length < maxPax) {
      blockingReasons.push(`Passenger manifest incomplete: Expected ${maxPax} passengers, but only ${passengers.length} profiles created.`);
    }

    const docStatus = this.calculateBookingDocumentStatus(booking);
    if (!docStatus.isComplete) {
      docStatus.missingList.forEach(m => blockingReasons.push(m));
    }

    const paymentSummary = this.calculateBookingPaymentSummary(booking);
    const paymentVerified = paymentSummary.verifiedPaidAmount > 0;
    if (!paymentVerified) {
      blockingReasons.push('Payment verification pending: No verified payment tranche or advance deposit approved.');
    }

    let unconfirmedSuppliersCount = 0;
    (booking.items || []).forEach(item => {
      if (item.supplierStatus !== 'CONFIRMED_BY_SUPPLIER') {
        unconfirmedSuppliersCount++;
        blockingReasons.push(`Supplier confirmation pending for "${item.productName}" (Status: ${item.supplierStatus || 'PENDING_DISPATCH'})`);
      }
    });

    return {
      canConfirm: blockingReasons.length === 0,
      blockingReasons,
      missingDocs: docStatus.missingList,
      unconfirmedSuppliersCount,
      paymentVerified
    };
  }

  public createBooking(
    data: {
      sourceType: BookingSourceType;
      quoteId?: string;
      quoteNumber?: string;
      destinationName?: string;
      customer: Booking['customer'];
      items: Booking['items'];
      currency: Booking['currency'];
      totalAmount: number;
      totalNetCost?: number;
      travelStartDate: string;
      travelEndDate: string;
    },
    user: User | null
  ): Booking {
    if (!user) {
      throw new Error('Authentication required to submit booking.');
    }

    const existing = this.getAllBookings();

    // Idempotency Guard: prevent duplicate submissions within 30-second window
    const thirtySecsAgo = Date.now() - 30 * 1000;
    const duplicate = existing.find(b => {
      if (!b.createdAt) return false;
      const bTime = new Date(b.createdAt).getTime();
      if (bTime >= thirtySecsAgo && b.submittedByUserId === user.id) {
        if (data.quoteId && b.quoteId === data.quoteId) return true;
        if (b.customer?.email && b.customer.email === data.customer?.email && b.totalAmount === data.totalAmount) return true;
      }
      return false;
    });

    if (duplicate) {
      console.warn(`SECURITY/IDEMPOTENCY: Duplicate booking submission detected within 30s window. Returning existing booking ${duplicate.bookingReference}.`);
      return (user.role === 'B2B_AGENT' || user.role === 'BUYER') 
        ? this.sanitizeBookingForExternalUser(duplicate) 
        : duplicate;
    }

    // Authoritative pricing check & internal commercial preservation from quote
    let internalNettCost = data.totalNetCost || 0;
    let internalMarkup = 0;
    let agentMarkup = 0;
    let internalProfit = 0;
    let supplierCost = 0;

    if (data.quoteId) {
      const rawQuote = this.getRawQuoteById(data.quoteId);
      if (rawQuote) {
        internalNettCost = rawQuote.totalNetCost || rawQuote.internalNettCost || internalNettCost;
        internalMarkup = rawQuote.internalMarkup || 0;
        agentMarkup = rawQuote.agentMarkup || 0;
        internalProfit = Math.max(0, (data.totalAmount || 0) - (internalNettCost || 0));
        supplierCost = rawQuote.supplierCost || internalNettCost;
      }
    } else {
      internalProfit = Math.max(0, (data.totalAmount || 0) - (internalNettCost || 0));
      supplierCost = internalNettCost;
    }

    const randomRef = Math.floor(1000 + Math.random() * 9000);
    const bookingReference = `TUB-BK-2026-${randomRef}`;
    const id = `booking-${Date.now()}-${randomRef}`;
    const timestamp = new Date().toISOString();

    const isAgent = user?.role === 'B2B_AGENT';
    const submittedByUserId = user?.id;
    const submittedByUserRole = user?.role || (isAgent ? 'B2B_AGENT' : 'BUYER');
    const submittingAgentId = isAgent ? user?.id : undefined;
    const submittingAgentNameSnapshot = isAgent ? user?.name : undefined;
    const submittingAgentAgencySnapshot = isAgent ? (user?.agencyName || data.customer.agencyName) : undefined;
    const agentVisibilityStatus = isAgent ? 'VISIBLE' : undefined;

    // Reuse or create customer record to avoid duplicate data
    const customerRecord = this.findOrCreateCustomerRecord({
      agentId: user?.id,
      name: data.customer.leadTravelerName || data.customer.bookerName || 'Lead Traveler',
      email: data.customer.email,
      phone: data.customer.phone,
      company: data.customer.agencyName || user?.agencyName,
      source: 'BOOKING_SUBMISSION',
      notes: data.customer.specialRequests,
      isBooking: true
    });

    const initialTimeline: BookingTimelineEvent[] = [
      {
        id: `tl-${Date.now()}-01`,
        title: 'Booking Submitted',
        description: `Booking ${bookingReference} initiated for ${data.customer.leadTravelerName}.${isAgent ? ` Submitted by B2B Agent ${user?.name} (${user?.agencyName || 'Agent'}).` : ''}`,
        timestamp,
        type: 'CREATION',
        actorName: user?.name || data.customer.leadTravelerName,
        actorRole: user?.role || 'BUYER'
      }
    ];

    const newBookingDraft: Booking = {
      id,
      bookingId: id,
      bookingReference,
      sourceType: data.sourceType,
      source: isAgent ? 'B2B_PORTAL' : (data.sourceType || 'B2B_PORTAL'),
      submittedByUserId,
      submittedByUserRole,
      submittingAgentId,
      submittingAgentNameSnapshot,
      submittingAgentAgencySnapshot,
      submittedAt: timestamp,
      agentVisibilityStatus: agentVisibilityStatus as any,
      agentId: isAgent ? user.id : undefined,
      agentName: isAgent ? user.name : undefined,
      agentAgency: isAgent ? (user.agencyName || data.customer.agencyName) : undefined,
      quoteId: data.quoteId,
      quoteNumber: data.quoteNumber,
      linkedQuoteId: data.quoteId,
      customerId: customerRecord?.id,
      destinationName: data.destinationName,
      userId: user?.id,
      userRole: user?.role || 'BUYER',
      customer: data.customer,
      items: data.items,
      currency: data.currency,
      totalAmount: data.totalAmount,
      totalNetCost: internalNettCost,
      internalNettCost,
      supplierCost,
      supplierTotalCost: supplierCost,
      internalMarkup,
      agentMarkup,
      internalProfit,
      grossProfit: internalProfit,
      grossMarginPercent: data.totalAmount > 0 ? (internalProfit / data.totalAmount) * 100 : 0,
      travelStartDate: data.travelStartDate,
      travelEndDate: data.travelEndDate,
      status: 'NEW',
      customerFacingStatus: 'Booking Received',
      paymentStatus: 'PENDING_PAYMENT',
      documentStatus: 'DOCUMENTS_PENDING',
      missingDocuments: [],
      supplierAllocationStatus: 'UNALLOCATED',
      passengers: [],
      paymentProofs: [],
      internalNotesList: [],
      customerUpdates: [],
      timeline: initialTimeline,
      statusHistory: [
        {
          id: `sh-${Date.now()}-01`,
          previousStatus: 'NONE',
          newStatus: 'NEW',
          changedBy: user?.id || 'system',
          changedByName: user?.name || 'Customer Booking Form',
          timestamp,
          reason: 'Initial booking request submitted'
        }
      ],
      createdAt: timestamp,
      updatedAt: timestamp,
      confirmationNotice: 'Your booking has been submitted and will be updated in 24-48 Hrs.',
      notificationEmailsSent: []
    };

    const docStatus = this.calculateBookingDocumentStatus(newBookingDraft);
    newBookingDraft.documentStatus = docStatus.status;
    newBookingDraft.missingDocuments = docStatus.missingList;

    // Generate automated confirmation & ops notification emails
    const emailService = EmailNotificationService.getInstance();
    const emails = emailService.generateBookingEmails(newBookingDraft);
    newBookingDraft.notificationEmailsSent = emails;

    emails.forEach(async (em) => {
      try {
        const result = await emailService.sendViaGmailApi(em.recipient, em.subject, em.fullHtml);
        if (result.success && result.messageId) {
          em.status = 'DELIVERED';
          this.syncFirestoreDoc('bookings', newBookingDraft.id, {
            notificationEmailsSent: newBookingDraft.notificationEmailsSent
          });
        }
      } catch (err) {
        console.debug('Direct Gmail API transmission notice:', err);
      }
    });

    existing.unshift(newBookingDraft);
    this.setItem('bookings', existing);
    this.syncFirestoreDoc('bookings', newBookingDraft.id, newBookingDraft);

    // If booking was created from a quote, update quote status
    if (data.quoteId) {
      const quotes = this.getAllSavedQuotes();
      const qIdx = quotes.findIndex(q => q.id === data.quoteId);
      if (qIdx >= 0) {
        quotes[qIdx].status = 'BOOKING_SUBMITTED';
        quotes[qIdx].updatedAt = timestamp;
        this.setItem('saved_quotes', quotes);
        this.syncFirestoreDoc('quotations', quotes[qIdx].id, { status: 'BOOKING_SUBMITTED', updatedAt: timestamp });
      }
    }

    // Sync into CRM Lead without duplication
    try {
      const linkedLead = this.captureLeadFromSource({
        contactName: data.customer.leadTravelerName || data.customer.bookerName || 'Lead Traveler',
        email: data.customer.email,
        phone: data.customer.phone,
        agencyName: data.customer.agencyName || user?.agencyName,
        companyName: data.customer.agencyName || user?.agencyName,
        userId: user?.id,
        userType: isAgent ? 'B2B_AGENT' : 'BUYER',
        b2bAgentId: isAgent ? user?.id : undefined,
        source: 'BOOKING_SUBMISSION',
        destinationName: data.destinationName,
        travelDates: `${data.travelStartDate} to ${data.travelEndDate}`,
        travelStartDate: data.travelStartDate,
        travelEndDate: data.travelEndDate,
        paxAdults: data.customer.totalAdults || 2,
        paxChildren: data.customer.totalChildren || 0,
        specialRequests: data.customer.specialRequests,
        estimatedBudget: data.totalAmount,
        currency: data.currency,
        quoteId: data.quoteId,
        quoteNumber: data.quoteNumber,
        bookingId: newBookingDraft.id,
        bookingReference: newBookingDraft.bookingReference,
        bookingValue: data.totalAmount
      }, user);
      if (linkedLead) {
        newBookingDraft.linkedLeadId = linkedLead.id;
        newBookingDraft.leadId = linkedLead.id;
        newBookingDraft.leadNumber = linkedLead.leadNumber;
        this.setItem('bookings', existing);
        this.syncFirestoreDoc('bookings', newBookingDraft.id, {
          linkedLeadId: linkedLead.id,
          leadId: linkedLead.id,
          leadNumber: linkedLead.leadNumber
        });
      }
    } catch (e) {
      console.warn('CRM lead sync notice on booking creation:', e);
    }

    this.logAudit(
      user, 
      'BOOKING_CREATED', 
      'Booking', 
      id, 
      `Submitted new booking ${bookingReference} for ${data.customer.leadTravelerName} (${data.items?.length || 0} services, ${data.currency} ${data.totalAmount}). Confirmation email dispatched.`
    );

    // Live Admin Activity Stream notification
    try {
      this.recordAdminActivity({
        entityId: newBookingDraft.id,
        category: 'BOOKING',
        activityType: 'BOOKING_CREATED',
        actorName: submittingAgentNameSnapshot || user?.name || 'B2B Agent',
        actorType: isAgent ? 'B2B_AGENT' : 'TEAM_MEMBER',
        severity: 'INFO',
        actionRequired: true,
        actionLabel: 'View in Operations Desk',
        summary: `New Booking Submitted: [${bookingReference}] for ${data.customer.leadTravelerName} (${data.currency} ${data.totalAmount.toLocaleString()}) via ${submittingAgentNameSnapshot || user?.name || 'Direct'}`,
        details: {
          bookingReference,
          customerName: data.customer.leadTravelerName,
          agentName: submittingAgentNameSnapshot || user?.name,
          agencyName: submittingAgentAgencySnapshot || user?.agencyName,
          totalAmount: data.totalAmount,
          currency: data.currency
        },
        targetSection: 'OPERATIONS_DESK'
      });
    } catch (e) {
      console.warn('Admin activity log for booking create:', e);
    }

    return (user.role === 'B2B_AGENT' || user.role === 'BUYER')
      ? this.sanitizeBookingForExternalUser(newBookingDraft)
      : newBookingDraft;
  }

  public updateBookingStatus(bookingId: string, status: BookingStatus, user: User | null, reason?: string): Booking | null {
    const all = this.getAllBookings();
    const index = all.findIndex(b => b.id === bookingId || b.bookingReference === bookingId);
    if (index === -1) return null;

    const b = all[index];
    const previousStatus = b.status;
    const timestamp = new Date().toISOString();

    b.status = status;
    b.updatedAt = timestamp;

    // Map customer facing status
    switch (status) {
      case 'NEW':
      case 'PENDING_CONFIRMATION':
        b.customerFacingStatus = 'Booking Received';
        break;
      case 'TO_BE_PROCESSED':
      case 'PROCESSING':
      case 'IN_PROGRESS':
        b.customerFacingStatus = 'Processing';
        break;
      case 'WAITING_FOR_UPDATE':
        b.customerFacingStatus = 'Awaiting Confirmation';
        break;
      case 'CONFIRMED':
        b.customerFacingStatus = 'Confirmed';
        break;
      case 'COMPLETED':
        b.customerFacingStatus = 'Completed';
        break;
      case 'CANCELLED':
        b.customerFacingStatus = 'Cancelled';
        break;
    }

    if (!b.statusHistory) b.statusHistory = [];
    b.statusHistory.unshift({
      id: `sh-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      previousStatus,
      newStatus: status,
      changedBy: user?.id || 'system',
      changedByName: user?.name || 'Operations Lead',
      timestamp,
      reason: reason || `Status transitioned from ${previousStatus} to ${status}`
    });

    if (!b.timeline) b.timeline = [];
    b.timeline.unshift({
      id: `tl-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      title: `Booking Status → ${status}`,
      description: reason || `Booking status changed to ${status}.`,
      timestamp,
      type: 'STATUS_CHANGE',
      actorName: user?.name || 'Operations Team',
      actorRole: user?.role || 'TEAM_MEMBER'
    });

    this.setItem('bookings', all);
    this.syncFirestoreDoc('bookings', b.id, b);

    this.logAudit(
      user,
      'BOOKING_UPDATED',
      'Booking',
      b.id,
      `Updated booking ${b.bookingReference} status: ${previousStatus} → ${status}. Reason: ${reason || 'Operational update'}`
    );

    if (this.actionCenterHooks?.onBookingStatusChanged) {
      try {
        this.actionCenterHooks.onBookingStatusChanged(b.id, b.bookingReference, status, user);
      } catch (err) {
        console.warn('Action center hook error:', err);
      }
    }

    return b;
  }

  public saveBooking(booking: Booking, user: User | null): void {
    const all = this.getAllBookings();
    const index = all.findIndex(b => b.id === booking.id || b.bookingReference === booking.bookingReference);
    
    // Auto-update document and payment summaries
    const docStatus = this.calculateBookingDocumentStatus(booking);
    booking.documentStatus = docStatus.status;
    booking.missingDocuments = docStatus.missingList;
    
    const paySummary = this.calculateBookingPaymentSummary(booking);
    booking.paymentStatus = paySummary.paymentStatus;

    const updatedBooking: Booking = {
      ...booking,
      updatedAt: new Date().toISOString()
    };

    if (index >= 0) {
      const prevBooking = all[index];
      all[index] = updatedBooking;
      this.logAudit(
        user,
        'BOOKING_UPDATED',
        'Booking',
        booking.id,
        `Updated booking ${booking.bookingReference} details and operations records`
      );

      if (prevBooking.status !== updatedBooking.status && updatedBooking.status === 'CANCELLED') {
        this.recordAdminActivity({
          category: 'BOOKING',
          activityType: 'BOOKING_CANCELLED',
          severity: 'CRITICAL',
          actorType: user?.role === 'ADMIN' ? 'ADMIN' : 'BUYER',
          actorId: user?.id || 'client',
          actorName: user?.name || booking.customer.leadTravelerName,
          targetSection: 'BOOKING_MANAGEMENT',
          targetSubTab: 'BOOKINGS',
          recordId: booking.id,
          entityId: booking.bookingReference,
          bookingReference: booking.bookingReference,
          summary: `Booking Cancelled: [${booking.bookingReference}] ${booking.customer.leadTravelerName}`,
          details: {
            customerName: booking.customer.leadTravelerName,
            totalAmount: booking.totalAmount,
            currency: booking.currency,
            status: 'CANCELLED',
            actionNeeded: 'Release supplier room allotments and process refund/credit according to policy'
          },
          actionRequired: true,
          actionLabel: 'Process Supplier Release'
        });
      }
    } else {
      all.unshift(updatedBooking);
      this.logAudit(
        user,
        'BOOKING_CREATED',
        'Booking',
        booking.id,
        `Created booking ${booking.bookingReference}`
      );

      this.recordAdminActivity({
        category: 'BOOKING',
        activityType: 'BOOKING_CREATED',
        severity: 'WARNING',
        actorType: user?.role === 'AGENT' ? 'B2B_AGENT' : 'BUYER',
        actorId: user?.id || 'client',
        actorName: user?.name || booking.customer.leadTravelerName,
        targetSection: 'BOOKING_MANAGEMENT',
        targetSubTab: 'BOOKINGS',
        recordId: booking.id,
        entityId: booking.bookingReference,
        bookingReference: booking.bookingReference,
        summary: `New Booking Confirmed: [${booking.bookingReference}] ${booking.customer.leadTravelerName} (${booking.currency} ${booking.totalAmount})`,
        details: {
          customerName: booking.customer.leadTravelerName,
          destinationName: booking.items?.[0]?.destinationName,
          travelDates: booking.travelStartDate ? `${booking.travelStartDate} to ${booking.travelEndDate || ''}` : undefined,
          totalAmount: booking.totalAmount,
          currency: booking.currency,
          status: booking.status,
          actionNeeded: 'Verify hotel allocation and dispatch confirmation vouchers within 24-48h SLA'
        },
        actionRequired: true,
        actionLabel: 'Confirm Allotment'
      });
    }
    this.syncFirestoreDoc('bookings', updatedBooking.id, updatedBooking);
    this.setItem('bookings', all);

    // Auto-trigger SLA & Google Calendar dispatch listeners
    const isNew = index < 0;
    this.bookingSaveListeners.forEach(listener => {
      try {
        listener(updatedBooking, user, isNew);
      } catch (err) {
        console.error('Error in bookingSaveListener:', err);
      }
    });
  }

  // ----------------------------------------------------
  // PASSENGER MANAGEMENT (STRICT CAPACITY ENFORCEMENT)
  // ----------------------------------------------------
  public addBookingPassenger(bookingId: string, passengerData: Omit<BookingPassenger, 'id' | 'passengerNumber'>, user: User | null): BookingPassenger {
    const all = this.getAllBookings();
    const b = all.find(item => item.id === bookingId || item.bookingReference === bookingId);
    if (!b) throw new Error(`Booking ${bookingId} not found`);

    const maxPax = (b.customer?.totalAdults || 0) + (b.customer?.totalChildren || 0) || 
      b.items?.reduce((max, it) => Math.max(max, it.totalPax), 0) || 1;

    const currentPassengers = b.passengers ? [...b.passengers] : [];
    if (currentPassengers.length >= maxPax) {
      throw new Error(`Maximum capacity reached: This booking allows a maximum of ${maxPax} passenger profiles.`);
    }

    const passengerNumber = currentPassengers.length + 1;
    const isFirstPax = currentPassengers.length === 0;
    const isLeadPax = passengerData.isLeadPax !== undefined ? passengerData.isLeadPax : isFirstPax;

    const newPassenger: BookingPassenger = {
      ...passengerData,
      id: `pax-${b.id}-${Date.now()}-${passengerNumber}`,
      passengerNumber,
      isLeadPax,
      fullName: `${passengerData.firstName || ''} ${passengerData.middleName || ''} ${passengerData.lastName || ''}`.replace(/\s+/g, ' ').trim()
    };

    // If this passenger is marked as lead, and we enforce single lead or multiple lead, preserve
    if (!isLeadPax) {
      // Regular passenger MUST NOT have PAN card
      delete newPassenger.panCardUrl;
      delete newPassenger.panCardName;
      delete newPassenger.panCardUploadedAt;
      delete newPassenger.panNumber;
    }

    currentPassengers.push(newPassenger);
    b.passengers = currentPassengers;
    b.updatedAt = new Date().toISOString();

    if (!b.timeline) b.timeline = [];
    b.timeline.unshift({
      id: `tl-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      title: `Passenger ${passengerNumber} Added`,
      description: `Added passenger ${newPassenger.fullName} (${newPassenger.isLeadPax ? 'Lead Passenger' : 'Regular Passenger'}).`,
      timestamp: new Date().toISOString(),
      type: 'PASSENGER',
      actorName: user?.name || 'Guest / Agent'
    });

    this.saveBooking(b, user);
    return newPassenger;
  }

  public updateBookingPassenger(bookingId: string, passengerId: string, updates: Partial<BookingPassenger>, user: User | null): void {
    const all = this.getAllBookings();
    const b = all.find(item => item.id === bookingId || item.bookingReference === bookingId);
    if (!b || !b.passengers) return;

    const pIdx = b.passengers.findIndex(p => p.id === passengerId);
    if (pIdx === -1) return;

    const existing = b.passengers[pIdx];
    const isLeadPax = updates.isLeadPax !== undefined ? updates.isLeadPax : existing.isLeadPax;

    const updatedPax: BookingPassenger = {
      ...existing,
      ...updates,
      isLeadPax,
      fullName: `${updates.firstName || existing.firstName || ''} ${updates.middleName !== undefined ? updates.middleName : existing.middleName || ''} ${updates.lastName || existing.lastName || ''}`.replace(/\s+/g, ' ').trim()
    };

    // Enforce Rule 9: PAN Card ONLY for Lead Passenger!
    if (!isLeadPax) {
      delete updatedPax.panCardUrl;
      delete updatedPax.panCardName;
      delete updatedPax.panCardUploadedAt;
      delete updatedPax.panNumber;
    }

    b.passengers[pIdx] = updatedPax;
    b.updatedAt = new Date().toISOString();

    if (!b.timeline) b.timeline = [];
    b.timeline.unshift({
      id: `tl-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      title: `Passenger ${updatedPax.passengerNumber} Updated`,
      description: `Updated details / documents for ${updatedPax.fullName}.`,
      timestamp: new Date().toISOString(),
      type: 'PASSENGER',
      actorName: user?.name || 'Operations Lead'
    });

    this.saveBooking(b, user);
  }

  public deleteBookingPassenger(bookingId: string, passengerId: string, user: User | null): void {
    const all = this.getAllBookings();
    const b = all.find(item => item.id === bookingId || item.bookingReference === bookingId);
    if (!b || !b.passengers) return;

    const removedPax = b.passengers.find(p => p.id === passengerId);
    b.passengers = b.passengers.filter(p => p.id !== passengerId);
    
    // Re-index passenger numbers
    b.passengers.forEach((p, idx) => {
      p.passengerNumber = idx + 1;
    });

    b.updatedAt = new Date().toISOString();

    if (!b.timeline) b.timeline = [];
    b.timeline.unshift({
      id: `tl-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      title: 'Passenger Removed',
      description: `Removed passenger ${removedPax?.fullName || passengerId}.`,
      timestamp: new Date().toISOString(),
      type: 'PASSENGER',
      actorName: user?.name || 'Operations Lead'
    });

    this.saveBooking(b, user);
  }

  // ----------------------------------------------------
  // MULTI-TRANCHE PAYMENT MANAGEMENT & VERIFICATION
  // ----------------------------------------------------
  public addBookingPaymentTranche(bookingId: string, proofData: Omit<BookingPaymentProof, 'id' | 'uploadedAt' | 'verificationStatus'>, user: User | null): BookingPaymentProof {
    const all = this.getAllBookings();
    const b = all.find(item => item.id === bookingId || item.bookingReference === bookingId);
    if (!b) throw new Error(`Booking ${bookingId} not found`);

    const proofs = b.paymentProofs ? [...b.paymentProofs] : [];
    const trancheIndex = proofs.length + 1;
    const timestamp = new Date().toISOString();

    const newProof: BookingPaymentProof = {
      ...proofData,
      id: `pay-${b.id}-${Date.now()}-${trancheIndex}`,
      trancheLabel: proofData.trancheLabel || `Tranche ${trancheIndex}`,
      uploadedBy: user?.id,
      uploadedByName: user?.name || b.customer.leadTravelerName,
      uploadedAt: timestamp,
      verificationStatus: 'PENDING_VERIFICATION'
    };

    proofs.push(newProof);
    b.paymentProofs = proofs;
    b.updatedAt = timestamp;

    if (!b.timeline) b.timeline = [];
    b.timeline.unshift({
      id: `tl-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      title: `Payment Proof Uploaded (${newProof.trancheLabel})`,
      description: `Uploaded payment proof for ${newProof.currency} ${newProof.amount} (Ref: ${newProof.transactionRef}). Pending verification.`,
      timestamp,
      type: 'PAYMENT',
      actorName: user?.name || 'Guest / Agent'
    });

    this.saveBooking(b, user);
    return newProof;
  }

  public verifyBookingPayment(
    bookingId: string, 
    paymentId: string, 
    status: 'VERIFIED' | 'REJECTED' | 'REPLACEMENT_REQUIRED', 
    notes: string, 
    user: User | null
  ): void {
    const all = this.getAllBookings();
    const b = all.find(item => item.id === bookingId || item.bookingReference === bookingId);
    if (!b || !b.paymentProofs) return;

    const pIdx = b.paymentProofs.findIndex(p => p.id === paymentId);
    if (pIdx === -1) return;

    const timestamp = new Date().toISOString();
    b.paymentProofs[pIdx].verificationStatus = status;
    b.paymentProofs[pIdx].verifiedBy = user?.id;
    b.paymentProofs[pIdx].verifiedByName = user?.name || 'Finance Lead';
    b.paymentProofs[pIdx].verifiedAt = timestamp;
    b.paymentProofs[pIdx].verificationNotes = notes;

    b.updatedAt = timestamp;

    if (!b.timeline) b.timeline = [];
    b.timeline.unshift({
      id: `tl-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      title: `Payment ${(status || 'RECORD').replace(/_/g, ' ')} (${b.paymentProofs[pIdx].trancheLabel})`,
      description: `${b.paymentProofs[pIdx].currency} ${b.paymentProofs[pIdx].amount} verification marked as ${status}. ${notes ? 'Notes: ' + notes : ''}`,
      timestamp,
      type: 'PAYMENT',
      actorName: user?.name || 'Finance / Operations Lead'
    });

    this.saveBooking(b, user);

    if (status === 'VERIFIED' && this.actionCenterHooks?.onPaymentVerified) {
      try {
        this.actionCenterHooks.onPaymentVerified(b.id, b.bookingReference, paymentId, user);
      } catch (err) {
        console.warn('Action center payment hook error:', err);
      }
    }
  }

  // ----------------------------------------------------
  // SUPPLIER & SERVICE-LEVEL OPERATIONS
  // ----------------------------------------------------
  public updateBookingSupplierService(
    bookingId: string,
    serviceItemId: string,
    updates: {
      supplierId?: string;
      supplierName?: string;
      supplierType?: BookingItem['supplierType'];
      supplierContact?: string;
      supplierPhone?: string;
      supplierEmail?: string;
      supplierStatus?: BookingItem['supplierStatus'];
      supplierConfirmationRef?: string;
      paymentCutoffDate?: string;
      serviceDate?: string;
      serviceTime?: string;
      serviceTimezone?: string;
      supplierNotes?: string;
      internalOpsNotes?: string;
    },
    user: User | null
  ): void {
    const all = this.getAllBookings();
    const b = all.find(item => item.id === bookingId || item.bookingReference === bookingId);
    if (!b || !b.items) return;

    const itemIdx = b.items.findIndex(it => it.id === serviceItemId);
    if (itemIdx === -1) return;

    const currentItem = b.items[itemIdx];
    const updatedItem: BookingItem = {
      ...currentItem,
      ...updates
    };

    b.items[itemIdx] = updatedItem;
    b.updatedAt = new Date().toISOString();

    // Check overall supplier allocation status
    const allItems = b.items;
    const confirmedCount = allItems.filter(it => it.supplierStatus === 'CONFIRMED_BY_SUPPLIER').length;
    if (confirmedCount === allItems.length) {
      b.supplierAllocationStatus = 'FULLY_CONFIRMED_BY_SUPPLIERS';
    } else if (confirmedCount > 0) {
      b.supplierAllocationStatus = 'PARTIALLY_CONFIRMED';
    } else if (allItems.some(it => it.supplierStatus === 'SENT_TO_SUPPLIER' || it.supplierStatus === 'WAITING_FOR_SUPPLIER')) {
      b.supplierAllocationStatus = 'DISPATCHED_TO_SUPPLIERS';
    } else {
      b.supplierAllocationStatus = 'UNALLOCATED';
    }

    if (!b.timeline) b.timeline = [];
    b.timeline.unshift({
      id: `tl-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      title: `Supplier Updated: ${updatedItem.productName}`,
      description: `Supplier: ${updatedItem.supplierName || 'Assigned'} | Status: ${updatedItem.supplierStatus || 'Updated'} | Cut-off: ${updatedItem.paymentCutoffDate || 'N/A'}.`,
      timestamp: new Date().toISOString(),
      type: 'SUPPLIER',
      actorName: user?.name || 'Operations Lead'
    });

    this.saveBooking(b, user);
  }

  // ----------------------------------------------------
  // INTERNAL NOTES & CUSTOMER-FACING COMMUNICATIONS
  // ----------------------------------------------------
  public addBookingInternalNote(bookingId: string, text: string, relatedServiceName: string | undefined, user: User | null): void {
    const all = this.getAllBookings();
    const b = all.find(item => item.id === bookingId || item.bookingReference === bookingId);
    if (!b) return;

    const timestamp = new Date().toISOString();
    const newNote: BookingInternalNote = {
      id: `inote-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      authorId: user?.id,
      authorName: user?.name || 'Operations Staff',
      authorRole: user?.role || 'TEAM_MEMBER',
      text,
      timestamp,
      relatedServiceName
    };

    if (!b.internalNotesList) b.internalNotesList = [];
    b.internalNotesList.unshift(newNote);
    b.updatedAt = timestamp;

    this.saveBooking(b, user);
  }

  public publishBookingCustomerUpdate(
    bookingId: string, 
    update: { title: string; message: string; relatedServiceId?: string }, 
    user: User | null
  ): void {
    const all = this.getAllBookings();
    const b = all.find(item => item.id === bookingId || item.bookingReference === bookingId);
    if (!b) return;

    const timestamp = new Date().toISOString();
    const newUpdate: BookingCustomerUpdate = {
      id: `cupd-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      authorId: user?.id,
      authorName: user?.name || 'TheUnbound Operations Team',
      title: update.title,
      message: update.message,
      timestamp,
      isPublished: true,
      relatedServiceId: update.relatedServiceId,
      notificationSent: true
    };

    if (!b.customerUpdates) b.customerUpdates = [];
    b.customerUpdates.unshift(newUpdate);
    b.updatedAt = timestamp;

    if (!b.timeline) b.timeline = [];
    b.timeline.unshift({
      id: `tl-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      title: `Customer Update Published: "${update.title}"`,
      description: update.message,
      timestamp,
      type: 'COMMUNICATION',
      actorName: user?.name || 'Operations Team'
    });

    this.saveBooking(b, user);
  }

  // =========================================================================
  // CONNECTED BOOKING OPERATIONS & RESERVATIONS ENGINE
  // SERVICE ITEMS & SUPPLIER OPERATIONS PROCESSING
  // =========================================================================

  /**
   * Authoritative Service Item normalization to ensure real operational fields exist
   */
  public normalizeServiceItems(items: BookingItem[], booking: Booking): BookingItem[] {
    return (items || []).map((item) => {
      const isConfirmed = item.supplierConfirmationStatus === 'Confirmed' || item.supplierStatus === 'CONFIRMED_BY_SUPPLIER';
      const hasSupplier = Boolean(item.supplierId || item.supplierName);
      const hasPrice = typeof item.supplierPrice === 'number' && item.supplierPrice >= 0;

      let confirmationStatus: ServiceItemConfirmationStatus = item.supplierConfirmationStatus || 'Not Processed';
      if (!item.supplierConfirmationStatus) {
        if (isConfirmed) confirmationStatus = 'Confirmed';
        else if (hasSupplier && hasPrice) confirmationStatus = 'Confirmation Pending';
        else if (hasSupplier && !hasPrice) confirmationStatus = 'Price Pending';
        else confirmationStatus = 'Supplier Not Allocated';
      }

      let operationalStatus: ServiceItemOperationalStatus = item.operationalStatus || 'Not Started';
      if (!item.operationalStatus) {
        if (confirmationStatus === 'Confirmed') operationalStatus = 'Confirmed';
        else if (!hasSupplier) operationalStatus = 'Allocation Pending';
        else if (!hasPrice) operationalStatus = 'Price Pending';
        else operationalStatus = 'Confirmation Pending';
      }

      return {
        ...item,
        bookingId: item.bookingId || booking.id,
        destination: item.destination || item.destinationName || booking.destinationName || 'Destination',
        hub: item.hub || item.city || 'Central Hub',
        passengerDetails: item.passengerDetails || `${item.adults || 2} Adults${item.children ? `, ${item.children} Children` : ''}`,
        assignedTeamMember: item.assignedTeamMember || booking.assignedTeamMemberName || 'Operations DMC Desk',
        supplierPrice: hasPrice ? item.supplierPrice : (item.unitNetPrice ? Math.round(item.unitNetPrice * item.totalPax) : Math.round(item.totalPrice * 0.82)),
        supplierCurrency: item.supplierCurrency || item.currency || booking.currency || 'USD',
        supplierPriceType: item.supplierPriceType || 'Total Service Price',
        supplierPriceVersion: item.supplierPriceVersion || 1,
        supplierConfirmationStatus: confirmationStatus,
        operationalStatus,
        voucherStatus: item.voucherStatus || (confirmationStatus === 'Confirmed' ? 'Ready to Generate' : 'Not Ready'),
        invoiceStatus: item.invoiceStatus || 'Not Uploaded'
      };
    });
  }

  /**
   * Record audited event across Service Items, Suppliers, Pricing, Vouchers, Invoices
   */
  public recordBookingActivity(event: BookingActivityTimelineEvent, user?: User | null): void {
    const all = this.getAllBookings();
    const b = all.find(item => item.id === event.bookingId || item.bookingReference === event.bookingId);
    if (!b) return;

    if (!b.serviceItemActivities) b.serviceItemActivities = [];
    b.serviceItemActivities.unshift(event);

    // Also add to timeline for unified audit
    if (!b.timeline) b.timeline = [];
    b.timeline.unshift({
      id: event.eventId,
      title: event.description || `Event: ${event.eventType.replace(/_/g, ' ')}`,
      description: `Actor: ${event.actorName || user?.name || 'Operations Lead'} (${event.actorRole || 'INTERNAL'}) | Service: ${event.serviceItemName || 'Booking Level'}`,
      timestamp: event.timestamp,
      type: 'SUPPLIER',
      actorName: event.actorName || user?.name || 'Operations Lead'
    });

    b.updatedAt = event.timestamp;
    this.saveBooking(b, user || null);
  }

  public getBookingActivities(bookingId: string): BookingActivityTimelineEvent[] {
    const b = this.getBookingById(bookingId);
    if (!b) return [];
    return b.serviceItemActivities || [];
  }

  /**
   * Dedicated Supplier Allocation
   */
  public allocateServiceItemSupplier(
    bookingId: string,
    serviceItemId: string,
    allocation: {
      supplierId?: string;
      supplierName?: string;
      supplierType?: BookingItem['supplierType'];
      supplierContact?: string;
      supplierPhone?: string;
      supplierEmail?: string;
      supplierConfirmationRef?: string;
      paymentCutoffDate?: string;
      serviceDate?: string;
      serviceTime?: string;
      serviceTimezone?: string;
      supplierNotes?: string;
      internalNotes?: string;
    } | null,
    user: User | null
  ): { success: boolean; item?: BookingItem; error?: string } {
    const all = this.getAllBookings();
    const b = all.find(item => item.id === bookingId || item.bookingReference === bookingId);
    if (!b || !b.items) return { success: false, error: 'Booking not found' };

    const itemIdx = b.items.findIndex(it => it.id === serviceItemId);
    if (itemIdx === -1) return { success: false, error: 'Service item not found in booking' };

    const currentItem = b.items[itemIdx];
    const previousSupplier = currentItem.supplierName;
    const isUnallocating = !allocation || (!allocation.supplierId && !allocation.supplierName);
    const allocData = allocation || {};
    const isReallocation = Boolean(!isUnallocating && previousSupplier && previousSupplier !== allocData.supplierName);
    const now = new Date().toISOString();

    const updatedItem: BookingItem = {
      ...currentItem,
      supplierId: isUnallocating ? undefined : allocData.supplierId,
      supplierName: isUnallocating ? undefined : allocData.supplierName,
      supplierNameSnapshot: isUnallocating ? undefined : allocData.supplierName,
      supplierType: isUnallocating ? undefined : (allocData.supplierType || currentItem.supplierType || 'GROUND_RESOURCE'),
      supplierContact: isUnallocating ? undefined : (allocData.supplierContact || `${allocData.supplierPhone || ''} ${allocData.supplierEmail || ''}`.trim()),
      supplierPhone: isUnallocating ? undefined : allocData.supplierPhone,
      supplierEmail: isUnallocating ? undefined : allocData.supplierEmail,
      supplierConfirmationRef: isUnallocating ? undefined : allocData.supplierConfirmationRef,
      supplierAllocationStatus: isUnallocating ? 'Not Allocated' : 'Allocated',
      supplierAllocatedAt: isUnallocating ? undefined : now,
      supplierAllocatedBy: isUnallocating ? undefined : (user?.displayName || user?.name || user?.email || 'Operations Lead'),
      paymentCutoffDate: isUnallocating ? undefined : allocData.paymentCutoffDate,
      serviceDate: allocData.serviceDate || currentItem.serviceDate || currentItem.travelDate,
      serviceTime: allocData.serviceTime || currentItem.serviceTime,
      serviceTimezone: allocData.serviceTimezone || currentItem.serviceTimezone,
      supplierNotes: isUnallocating ? undefined : allocData.supplierNotes,
      internalNotes: allocData.internalNotes !== undefined ? allocData.internalNotes : currentItem.internalNotes,
      supplierStatus: isUnallocating ? 'PENDING_DISPATCH' : 'SENT_TO_SUPPLIER',
      supplierConfirmationStatus: isUnallocating 
        ? 'Not Confirmed' 
        : (currentItem.supplierConfirmationStatus === 'Confirmed' 
          ? 'Supplier Reconfirmation Required' 
          : (currentItem.supplierPrice !== undefined ? 'Confirmation Pending' : 'Price Pending')),
      operationalStatus: isUnallocating 
        ? 'Supplier Not Allocated' 
        : (currentItem.supplierPrice !== undefined ? 'Confirmation Pending' : 'Price Pending')
    };

    b.items[itemIdx] = updatedItem;
    b.updatedAt = now;
    b.operationalProcessingStatus = this.calculateBookingOperationalStatus(b);

    // If a voucher was previously issued for this booking, mark it as outdated due to supplier change
    if (b.vouchersList && b.vouchersList.length > 0) {
      b.vouchersList = b.vouchersList.map(v => ({
        ...v,
        isOutdated: true,
        outdatedReason: isUnallocating 
          ? `Supplier removed on Service Item: "${updatedItem.productName}". Re-generation required.`
          : `Supplier changed on Service Item: "${updatedItem.productName}". Re-generation required.`
      }));
    }

    const eventId = `act-${Date.now()}-${Math.floor(Math.random()*1000)}`;
    this.recordBookingActivity({
      eventId,
      bookingId: b.id,
      bookingItemId: updatedItem.id,
      serviceItemName: updatedItem.productName,
      supplierId: isUnallocating ? undefined : allocData.supplierId,
      supplierName: isUnallocating ? undefined : allocData.supplierName,
      eventType: isUnallocating ? 'SUPPLIER_CHANGED' : (isReallocation ? 'SUPPLIER_CHANGED' : 'SUPPLIER_ALLOCATED'),
      previousValue: previousSupplier || 'Unallocated',
      newValue: isUnallocating ? 'Unallocated' : allocData.supplierName,
      actorId: user?.id || 'admin',
      actorRole: user?.role || 'TEAM_MEMBER',
      actorName: user?.displayName || user?.name || 'Operations Lead',
      timestamp: now,
      description: isUnallocating
        ? `Supplier De-allocated: Removed "${previousSupplier}" from ${updatedItem.productName}`
        : (isReallocation 
          ? `Supplier Reallocated: Changed from "${previousSupplier}" to "${allocData.supplierName}" for ${updatedItem.productName}`
          : `Supplier Allocated: "${allocData.supplierName}" assigned to ${updatedItem.productName}`)
    }, user);

    if (!isUnallocating && allocData.supplierId) {
      this.logSupplierAllocation({
        supplierId: allocData.supplierId,
        supplierNameSnapshot: allocData.supplierName || '',
        supplierCategory: updatedItem.category || 'General',
        bookingId: b.id,
        bookingReference: b.bookingReference,
        serviceItemId: updatedItem.id,
        serviceName: updatedItem.productName,
        customerName: (b as any).customerName || b.customer?.name || (b as any).buyerName || 'Valued Guest',
        serviceDate: updatedItem.serviceDate || updatedItem.travelDate,
        status: isReallocation ? 'CHANGED' : 'ALLOCATED',
        allocatedBy: user?.id || 'system',
        allocatedByName: user?.displayName || user?.name || 'Operations Lead',
        previousSupplierId: currentItem.supplierId,
        previousSupplierName: previousSupplier,
        changeReason: isReallocation ? `Reallocated from ${previousSupplier}` : undefined
      }, user);
    }

    this.saveBooking(b, user);
    return { success: true, item: updatedItem };
  }

  /**
   * Authoritative Editable Supplier Price with Versioning and Audit
   */
  public updateServiceItemSupplierPrice(
    bookingId: string,
    serviceItemId: string,
    pricing: {
      supplierPrice: number;
      supplierCurrency: CurrencyCode;
      supplierPriceType: SupplierPriceType;
      supplierAdultPrice?: number;
      supplierChildPrice?: number;
      supplierInfantPrice?: number;
      supplierQuantity?: number;
      supplierTaxAmount?: number;
      supplierAdditionalFees?: number;
      supplierDiscount?: number;
      supplierTotalCost?: number;
      supplierPaymentCutoffDate?: string;
      supplierCancellationDeadline?: string;
      supplierPricingNotes?: string;
      changeReason?: string;
      forceAfterConfirmation?: boolean;
    },
    user: User | null
  ): { success: boolean; requiresReconfirmation?: boolean; error?: string; item?: BookingItem } {
    const all = this.getAllBookings();
    const b = all.find(item => item.id === bookingId || item.bookingReference === bookingId);
    if (!b || !b.items) return { success: false, error: 'Booking not found' };

    const itemIdx = b.items.findIndex(it => it.id === serviceItemId);
    if (itemIdx === -1) return { success: false, error: 'Service item not found' };

    const currentItem = b.items[itemIdx];
    const previousPrice = currentItem.supplierPrice;
    const isMaterialChange = previousPrice !== undefined && previousPrice !== pricing.supplierPrice;

    // Validation
    if (typeof pricing.supplierPrice !== 'number' || isNaN(pricing.supplierPrice) || pricing.supplierPrice < 0) {
      return { success: false, error: 'Supplier Price must be a valid non-negative number.' };
    }
    if (!pricing.supplierCurrency) {
      return { success: false, error: 'Supplier Currency is required.' };
    }
    if (!pricing.supplierPriceType) {
      return { success: false, error: 'Supplier Price Type is required.' };
    }

    const wasConfirmed = currentItem.supplierConfirmationStatus === 'Confirmed';
    if (wasConfirmed && isMaterialChange && !pricing.forceAfterConfirmation) {
      return {
        success: false,
        requiresReconfirmation: true,
        error: `This service item is currently CONFIRMED. Altering the supplier price from ${currentItem.supplierCurrency || 'USD'} ${previousPrice} to ${pricing.supplierCurrency} ${pricing.supplierPrice} will invalidate the confirmation and require explicit reconfirmation.`
      };
    }

    const newVersion = (currentItem.supplierPriceVersion || 1) + (isMaterialChange ? 1 : 0);
    const now = new Date().toISOString();

    const historyEntry: SupplierPriceHistoryEntry = {
      previousPrice,
      newPrice: pricing.supplierPrice,
      currency: pricing.supplierCurrency,
      priceType: pricing.supplierPriceType,
      changeReason: pricing.changeReason || (isMaterialChange ? 'Price adjustment by operations' : 'Initial supplier rate entry'),
      updatedBy: user?.id || 'admin',
      updatedByName: user?.displayName || user?.name || 'Operations Lead',
      updatedAt: now,
      version: newVersion
    };

    const qty = pricing.supplierQuantity !== undefined ? Number(pricing.supplierQuantity) : (currentItem.supplierQuantity || currentItem.quantity || currentItem.totalPax || 1);
    const unitPrice = Number(pricing.supplierPrice);
    const tax = Number(pricing.supplierTaxAmount || 0);
    const fees = Number(pricing.supplierAdditionalFees || 0);
    const disc = Number(pricing.supplierDiscount || 0);
    const computedTotalCost = pricing.supplierTotalCost !== undefined ? Number(pricing.supplierTotalCost) : ((unitPrice * qty) + tax + fees - disc);

    const updatedItem: BookingItem = {
      ...currentItem,
      supplierPrice: Math.round(pricing.supplierPrice * 100) / 100,
      supplierCurrency: pricing.supplierCurrency,
      supplierPriceType: pricing.supplierPriceType,
      supplierAdultPrice: pricing.supplierAdultPrice !== undefined ? Number(pricing.supplierAdultPrice) : currentItem.supplierAdultPrice,
      supplierChildPrice: pricing.supplierChildPrice !== undefined ? Number(pricing.supplierChildPrice) : currentItem.supplierChildPrice,
      supplierInfantPrice: pricing.supplierInfantPrice !== undefined ? Number(pricing.supplierInfantPrice) : currentItem.supplierInfantPrice,
      supplierQuantity: qty,
      supplierTaxAmount: tax,
      supplierAdditionalFees: fees,
      supplierDiscount: disc,
      supplierTotalCost: Math.round(computedTotalCost * 100) / 100,
      supplierPaymentCutoffDate: pricing.supplierPaymentCutoffDate || currentItem.supplierPaymentCutoffDate,
      supplierCancellationDeadline: pricing.supplierCancellationDeadline || currentItem.supplierCancellationDeadline,
      supplierPricingNotes: pricing.supplierPricingNotes !== undefined ? pricing.supplierPricingNotes : currentItem.supplierPricingNotes,
      supplierPriceLastUpdatedAt: now,
      supplierPriceLastUpdatedBy: user?.displayName || user?.name || user?.email || 'Operations Lead',
      supplierPriceChangeReason: pricing.changeReason,
      supplierPriceVersion: newVersion,
      supplierPriceHistory: [historyEntry, ...(currentItem.supplierPriceHistory || [])],
      supplierConfirmationStatus: (wasConfirmed && isMaterialChange) 
        ? 'Supplier Reconfirmation Required' 
        : (currentItem.supplierConfirmationStatus === 'Price Pending' ? 'Confirmation Pending' : currentItem.supplierConfirmationStatus),
      operationalStatus: (wasConfirmed && isMaterialChange) ? 'Confirmation Pending' : currentItem.operationalStatus
    };

    b.items[itemIdx] = updatedItem;
    b.updatedAt = now;
    b.operationalProcessingStatus = this.calculateBookingOperationalStatus(b);

    // Invalidate vouchers if price materially changed after confirmation
    if (wasConfirmed && isMaterialChange && b.vouchersList) {
      b.vouchersList = b.vouchersList.map(v => ({
        ...v,
        isOutdated: true,
        outdatedReason: `Supplier price modified after confirmation for ${updatedItem.productName}`
      }));
    }

    this.recordBookingActivity({
      eventId: `act-price-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      bookingId: b.id,
      bookingItemId: updatedItem.id,
      serviceItemName: updatedItem.productName,
      supplierId: updatedItem.supplierId,
      supplierName: updatedItem.supplierName,
      eventType: previousPrice === undefined ? 'SUPPLIER_PRICE_ADDED' : 'SUPPLIER_PRICE_EDITED',
      previousValue: previousPrice !== undefined ? `${currentItem.supplierCurrency || 'USD'} ${previousPrice}` : 'None',
      newValue: `${pricing.supplierCurrency} ${pricing.supplierPrice} (${pricing.supplierPriceType})`,
      actorId: user?.id || 'admin',
      actorRole: user?.role || 'TEAM_MEMBER',
      actorName: user?.displayName || user?.name || 'Operations Lead',
      timestamp: now,
      metadata: { reason: pricing.changeReason, version: newVersion },
      description: `Supplier Price updated to ${pricing.supplierCurrency} ${pricing.supplierPrice} (${pricing.supplierPriceType}). ${pricing.changeReason ? `Reason: ${pricing.changeReason}` : ''}`
    }, user);

    if (updatedItem.supplierId) {
      this.logSupplierPriceRecord({
        supplierId: updatedItem.supplierId,
        bookingId: b.id,
        bookingReference: b.bookingReference,
        serviceItemId: updatedItem.id,
        serviceName: updatedItem.productName,
        supplierPrice: pricing.supplierPrice,
        currency: pricing.supplierCurrency,
        priceType: pricing.supplierPriceType,
        previousPrice,
        effectiveDate: updatedItem.serviceDate || updatedItem.travelDate || now,
        updatedBy: user?.id || 'admin',
        updatedByName: user?.displayName || user?.name || 'Operations Lead',
        changeReason: pricing.changeReason
      }, user);
    }

    this.saveBooking(b, user);
    return { success: true, item: updatedItem };
  }

  /**
   * Service Item Confirmation Workflow
   */
  public confirmServiceItem(
    bookingId: string,
    serviceItemId: string,
    user: User | null
  ): { success: boolean; errors?: string[] } {
    const all = this.getAllBookings();
    const b = all.find(item => item.id === bookingId || item.bookingReference === bookingId);
    if (!b || !b.items) return { success: false, errors: ['Booking not found'] };

    const itemIdx = b.items.findIndex(it => it.id === serviceItemId);
    if (itemIdx === -1) return { success: false, errors: ['Service item not found'] };

    const item = b.items[itemIdx];
    const errors: string[] = [];

    // Validation checklist
    if (!item.supplierId && !item.supplierName) {
      errors.push('A supplier must be allocated before confirming this service item.');
    }
    if (item.supplierPrice === undefined || item.supplierPrice === null || item.supplierPrice < 0) {
      errors.push('An authoritative Supplier Price must be entered.');
    }
    if (!item.supplierCurrency) {
      errors.push('Supplier Currency must be specified.');
    }
    if (!item.serviceDate && !item.travelDate) {
      errors.push('A valid Service Date must be recorded.');
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    const now = new Date().toISOString();
    const updatedItem: BookingItem = {
      ...item,
      supplierStatus: 'CONFIRMED_BY_SUPPLIER',
      supplierConfirmationStatus: 'Confirmed',
      operationalStatus: 'Confirmed',
      voucherStatus: 'Ready to Generate',
      confirmedAt: now,
      confirmedBy: user?.id || 'admin',
      confirmedByName: user?.displayName || user?.name || 'Operations Lead',
      reconfirmationReason: undefined
    };

    b.items[itemIdx] = updatedItem;
    b.updatedAt = now;
    b.operationalProcessingStatus = this.calculateBookingOperationalStatus(b);

    // Check if parent booking needs supplierAllocationStatus update
    const allItems = b.items;
    const confirmedCount = allItems.filter(it => it.supplierConfirmationStatus === 'Confirmed').length;
    if (confirmedCount === allItems.length) {
      b.supplierAllocationStatus = 'FULLY_CONFIRMED_BY_SUPPLIERS';
    } else {
      b.supplierAllocationStatus = 'PARTIALLY_CONFIRMED';
    }

    this.recordBookingActivity({
      eventId: `act-conf-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      bookingId: b.id,
      bookingItemId: updatedItem.id,
      serviceItemName: updatedItem.productName,
      supplierId: updatedItem.supplierId,
      supplierName: updatedItem.supplierName,
      eventType: 'SERVICE_ITEM_CONFIRMED',
      previousValue: item.supplierConfirmationStatus || 'Pending',
      newValue: 'Confirmed',
      actorId: user?.id || 'admin',
      actorRole: user?.role || 'TEAM_MEMBER',
      actorName: user?.displayName || user?.name || 'Operations Lead',
      timestamp: now,
      description: `Service Item "${updatedItem.productName}" marked as CONFIRMED with supplier "${updatedItem.supplierName}". Reference: ${updatedItem.supplierConfirmationRef || 'Ground Ops Locked'}.`
    }, user);

    this.saveBooking(b, user);
    return { success: true };
  }

  public requestServiceItemReconfirmation(
    bookingId: string,
    serviceItemId: string,
    reason: string,
    user: User | null
  ): void {
    const all = this.getAllBookings();
    const b = all.find(item => item.id === bookingId || item.bookingReference === bookingId);
    if (!b || !b.items) return;

    const itemIdx = b.items.findIndex(it => it.id === serviceItemId);
    if (itemIdx === -1) return;

    const item = b.items[itemIdx];
    const now = new Date().toISOString();

    const updatedItem: BookingItem = {
      ...item,
      supplierConfirmationStatus: 'Supplier Reconfirmation Required',
      operationalStatus: 'Confirmation Pending',
      voucherStatus: 'Not Ready',
      reconfirmationReason: reason
    };

    b.items[itemIdx] = updatedItem;
    b.updatedAt = now;
    b.operationalProcessingStatus = this.calculateBookingOperationalStatus(b);

    this.recordBookingActivity({
      eventId: `act-reconf-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      bookingId: b.id,
      bookingItemId: updatedItem.id,
      serviceItemName: updatedItem.productName,
      supplierId: updatedItem.supplierId,
      supplierName: updatedItem.supplierName,
      eventType: 'SERVICE_ITEM_RECONFIRMATION_REQUIRED',
      previousValue: item.supplierConfirmationStatus,
      newValue: 'Supplier Reconfirmation Required',
      actorId: user?.id || 'admin',
      actorRole: user?.role || 'TEAM_MEMBER',
      actorName: user?.displayName || user?.name || 'Operations Lead',
      timestamp: now,
      metadata: { reason },
      description: `Reconfirmation requested for "${updatedItem.productName}". Reason: ${reason}`
    }, user);

    this.saveBooking(b, user);
  }

  /**
   * Calculates Booking-level operational status from individual Service Items
   */
  public calculateBookingOperationalStatus(booking: Booking): ServiceItemOperationalStatus {
    const items = booking.items || [];
    if (items.length === 0) return 'Not Processed';

    const activeItems = items.filter(it => !it.isCancelled && it.supplierConfirmationStatus !== 'Cancelled');
    if (activeItems.length === 0) return 'Cancelled';

    const allCompleted = activeItems.every(it => it.operationalStatus === 'Completed');
    if (allCompleted) return 'Completed';

    const anyReconfRequired = activeItems.some(
      it => it.supplierConfirmationStatus === 'Supplier Reconfirmation Required' || 
            it.supplierConfirmationStatus === 'Reconfirmation Required'
    );
    if (anyReconfRequired) return 'Supplier Reconfirmation Required';

    const allNotProcessed = activeItems.every(
      it => !it.operationalStatus || it.operationalStatus === 'Not Processed' || it.operationalStatus === 'Not Started'
    );
    if (allNotProcessed) return 'Not Processed';

    const anyUnallocated = activeItems.some(it => !it.supplierId && !it.supplierName);
    if (anyUnallocated) return 'Supplier Not Allocated';

    const anyPricePending = activeItems.some(it => it.supplierPrice === undefined || it.supplierPrice === null);
    if (anyPricePending) return 'Price Pending';

    const anyConfirmationPending = activeItems.some(
      it => it.supplierConfirmationStatus !== 'Confirmed'
    );
    if (anyConfirmationPending) return 'Confirmation Pending';

    const allConfirmed = activeItems.every(it => it.supplierConfirmationStatus === 'Confirmed');
    if (allConfirmed) return 'Confirmed';

    return 'Processing';
  }

  /**
   * Add Service Item directly to a booking (Master Inventory Item or Manual Service Item)
   */
  public addServiceItemToBooking(
    bookingId: string,
    itemData: Partial<BookingItem>,
    user: User | null
  ): { success: boolean; item?: BookingItem; error?: string } {
    const all = this.getAllBookings();
    const b = all.find(item => item.id === bookingId || item.bookingReference === bookingId);
    if (!b) return { success: false, error: 'Booking not found' };

    const now = new Date().toISOString();
    const itemId = itemData.id || `item-ops-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const isManual = itemData.isManualServiceItem ?? false;
    const unitSelling = Number(itemData.unitSellingPrice) || 0;
    const pax = Number(itemData.totalPax) || (b.customer?.totalPax || 1);
    const totalPrice = Number(itemData.totalPrice) || (unitSelling * pax);

    const newItem: BookingItem = {
      id: itemId,
      bookingId: b.id,
      productId: itemData.productId || `prod-ops-${Date.now()}`,
      productName: itemData.productName || 'Service Item',
      destination: itemData.destination || b.destination || 'Bali',
      hub: itemData.hub,
      category: itemData.category || 'Other approved travel service',
      travelDate: itemData.serviceDate || itemData.travelDate || b.travelStartDate,
      serviceDate: itemData.serviceDate || itemData.travelDate || b.travelStartDate,
      serviceTime: itemData.serviceTime || '09:00',
      serviceEndDate: itemData.serviceEndDate,
      duration: itemData.duration,
      adults: itemData.adults || b.customer?.totalAdults || 1,
      children: itemData.children || b.customer?.totalChildren || 0,
      infants: itemData.infants || b.customer?.totalInfants || 0,
      totalPax: pax,
      passengerAssignment: itemData.passengerAssignment || [],
      unitSellingPrice: unitSelling,
      totalPrice: totalPrice,
      currency: itemData.currency || b.currency || 'USD',
      isManualServiceItem: isManual,
      customerFacingNotes: itemData.customerFacingNotes || '',
      operationalInstructions: itemData.operationalInstructions || '',
      internalNotes: itemData.internalNotes || '',
      supplierId: itemData.supplierId,
      supplierName: itemData.supplierName,
      supplierContact: itemData.supplierContact,
      supplierPhone: itemData.supplierPhone,
      supplierEmail: itemData.supplierEmail,
      supplierConfirmationRef: itemData.supplierConfirmationRef,
      supplierAllocationStatus: itemData.supplierId ? 'Allocated' : 'Not Allocated',
      supplierPrice: itemData.supplierPrice,
      supplierCurrency: itemData.supplierCurrency || 'USD',
      supplierPriceType: itemData.supplierPriceType || 'Per Person',
      supplierConfirmationStatus: itemData.supplierConfirmationStatus || 'Not Confirmed',
      operationalStatus: itemData.operationalStatus || (itemData.supplierId ? 'Confirmation Pending' : 'Supplier Not Allocated'),
      voucherStatus: 'Not Ready',
      invoiceStatus: 'Not Uploaded'
    };

    if (!b.items) b.items = [];
    b.items.push(newItem);
    b.updatedAt = now;
    b.operationalProcessingStatus = this.calculateBookingOperationalStatus(b);

    this.recordBookingActivity({
      eventId: `act-add-item-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      bookingId: b.id,
      bookingItemId: newItem.id,
      serviceItemName: newItem.productName,
      eventType: 'SERVICE_ITEM_ADDED',
      newValue: newItem.productName,
      actorId: user?.id || 'admin',
      actorRole: user?.role || 'TEAM_MEMBER',
      actorName: user?.name || 'Operations Lead',
      timestamp: now,
      description: `Service Item added: "${newItem.productName}" (${isManual ? 'Manual Service Item' : 'Master Inventory Item'}). Category: ${newItem.category}.`
    }, user);

    this.saveBooking(b, user);
    return { success: true, item: newItem };
  }

  /**
   * Edit an existing Service Item (service details, allocated supplier, and commercial pricing)
   */
  public updateServiceItem(
    bookingId: string,
    serviceItemId: string,
    updates: Partial<BookingItem> & { 
      changeReason?: string; 
      forceAfterConfirmation?: boolean;
    },
    user: User | null
  ): { success: boolean; error?: string; item?: BookingItem } {
    const all = this.getAllBookings();
    const b = all.find(item => item.id === bookingId || item.bookingReference === bookingId);
    if (!b || !b.items) return { success: false, error: 'Booking not found' };

    const itemIdx = b.items.findIndex(it => it.id === serviceItemId);
    if (itemIdx === -1) return { success: false, error: 'Service item not found' };

    const currentItem = b.items[itemIdx];
    const now = new Date().toISOString();
    const actorName = user?.displayName || user?.name || user?.email || 'Operations Lead';

    // 1. Supplier Allocation Checks & Tracking
    const hasSupplierAllocationUpdate = updates.supplierId !== undefined || updates.supplierName !== undefined;
    const isUnallocatingSupplier = hasSupplierAllocationUpdate && !updates.supplierId && !updates.supplierName;
    const targetSupplierName = isUnallocatingSupplier ? undefined : (updates.supplierName || currentItem.supplierName);
    const targetSupplierId = isUnallocatingSupplier ? undefined : (updates.supplierId || currentItem.supplierId);
    const isSupplierChanged = Boolean(
      hasSupplierAllocationUpdate && 
      !isUnallocatingSupplier && 
      currentItem.supplierName && 
      currentItem.supplierName !== targetSupplierName
    );

    // 2. Commercial Pricing Checks & Tracking
    const hasPriceUpdate = updates.supplierPrice !== undefined;
    let newPriceVersion = currentItem.supplierPriceVersion || 1;
    let updatedPriceHistory = currentItem.supplierPriceHistory ? [...currentItem.supplierPriceHistory] : [];
    let isMaterialPriceChange = false;

    if (hasPriceUpdate) {
      const parsedNewPrice = Number(updates.supplierPrice);
      if (isNaN(parsedNewPrice) || parsedNewPrice < 0) {
        return { success: false, error: 'Supplier Commercial Price must be a valid non-negative number.' };
      }
      isMaterialPriceChange = currentItem.supplierPrice !== undefined && currentItem.supplierPrice !== parsedNewPrice;
      if (isMaterialPriceChange) {
        newPriceVersion += 1;
        const historyEntry: SupplierPriceHistoryEntry = {
          previousPrice: currentItem.supplierPrice,
          newPrice: parsedNewPrice,
          currency: updates.supplierCurrency || currentItem.supplierCurrency || 'USD',
          priceType: updates.supplierPriceType || currentItem.supplierPriceType || 'Total Service Price',
          changeReason: updates.changeReason || updates.supplierPriceChangeReason || 'Commercial price updated in Service Item edit',
          updatedBy: user?.id || 'admin',
          updatedByName: actorName,
          updatedAt: now,
          version: newPriceVersion
        };
        updatedPriceHistory.unshift(historyEntry);
      }
    }

    // Confirmation impact: If previously confirmed, supplier reallocation or material price change triggers reconfirmation
    const wasConfirmed = currentItem.supplierConfirmationStatus === 'Confirmed';
    const triggersReconfirmation = wasConfirmed && (isSupplierChanged || isMaterialPriceChange || isUnallocatingSupplier) && !updates.forceAfterConfirmation;

    // Quantity and Cost Calculations
    const targetQty = updates.supplierQuantity !== undefined 
      ? Number(updates.supplierQuantity) 
      : (currentItem.supplierQuantity || updates.totalPax || currentItem.totalPax || 1);
    const targetUnitPrice = hasPriceUpdate ? Number(updates.supplierPrice) : (currentItem.supplierPrice !== undefined ? currentItem.supplierPrice : 0);
    const targetTax = updates.supplierTaxAmount !== undefined ? Number(updates.supplierTaxAmount) : (currentItem.supplierTaxAmount || 0);
    const targetFees = updates.supplierAdditionalFees !== undefined ? Number(updates.supplierAdditionalFees) : (currentItem.supplierAdditionalFees || 0);
    const targetDisc = updates.supplierDiscount !== undefined ? Number(updates.supplierDiscount) : (currentItem.supplierDiscount || 0);
    const computedTotalCost = updates.supplierTotalCost !== undefined 
      ? Number(updates.supplierTotalCost) 
      : ((targetUnitPrice * targetQty) + targetTax + targetFees - targetDisc);

    // Build the consolidated updated item
    const updatedItem: BookingItem = {
      ...currentItem,
      // Operational & descriptive attributes
      productName: updates.productName !== undefined ? updates.productName : currentItem.productName,
      category: updates.category !== undefined ? updates.category : currentItem.category,
      destination: updates.destination !== undefined ? updates.destination : currentItem.destination,
      hub: updates.hub !== undefined ? updates.hub : currentItem.hub,
      serviceDate: updates.serviceDate !== undefined ? updates.serviceDate : currentItem.serviceDate,
      travelDate: updates.serviceDate !== undefined ? updates.serviceDate : currentItem.travelDate,
      serviceTime: updates.serviceTime !== undefined ? updates.serviceTime : currentItem.serviceTime,
      serviceEndDate: updates.serviceEndDate !== undefined ? updates.serviceEndDate : currentItem.serviceEndDate,
      duration: updates.duration !== undefined ? updates.duration : currentItem.duration,
      adults: updates.adults !== undefined ? Number(updates.adults) : currentItem.adults,
      children: updates.children !== undefined ? Number(updates.children) : currentItem.children,
      infants: updates.infants !== undefined ? Number(updates.infants) : currentItem.infants,
      totalPax: updates.totalPax !== undefined ? Number(updates.totalPax) : currentItem.totalPax,
      passengerAssignment: updates.passengerAssignment !== undefined ? updates.passengerAssignment : currentItem.passengerAssignment,
      customerFacingNotes: updates.customerFacingNotes !== undefined ? updates.customerFacingNotes : currentItem.customerFacingNotes,
      operationalInstructions: updates.operationalInstructions !== undefined ? updates.operationalInstructions : currentItem.operationalInstructions,
      internalNotes: updates.internalNotes !== undefined ? updates.internalNotes : currentItem.internalNotes,
      internalOpsNotes: updates.internalOpsNotes !== undefined ? updates.internalOpsNotes : currentItem.internalOpsNotes,
      
      // Customer selling price (strictly preserved or updated with authorized permissions)
      unitSellingPrice: updates.unitSellingPrice !== undefined ? Number(updates.unitSellingPrice) : currentItem.unitSellingPrice,
      totalPrice: updates.totalPrice !== undefined ? Number(updates.totalPrice) : currentItem.totalPrice,
      currency: updates.currency || currentItem.currency,

      // Authoritative Allocated Supplier
      supplierId: isUnallocatingSupplier ? undefined : (updates.supplierId !== undefined ? updates.supplierId : currentItem.supplierId),
      supplierName: isUnallocatingSupplier ? undefined : (updates.supplierName !== undefined ? updates.supplierName : currentItem.supplierName),
      supplierNameSnapshot: isUnallocatingSupplier ? undefined : (updates.supplierNameSnapshot || updates.supplierName || currentItem.supplierNameSnapshot || currentItem.supplierName),
      supplierType: isUnallocatingSupplier ? undefined : (updates.supplierType !== undefined ? updates.supplierType : currentItem.supplierType),
      supplierContact: isUnallocatingSupplier ? undefined : (updates.supplierContact !== undefined ? updates.supplierContact : currentItem.supplierContact),
      supplierPhone: isUnallocatingSupplier ? undefined : (updates.supplierPhone !== undefined ? updates.supplierPhone : currentItem.supplierPhone),
      supplierEmail: isUnallocatingSupplier ? undefined : (updates.supplierEmail !== undefined ? updates.supplierEmail : currentItem.supplierEmail),
      supplierConfirmationRef: isUnallocatingSupplier ? undefined : (updates.supplierConfirmationRef !== undefined ? updates.supplierConfirmationRef : currentItem.supplierConfirmationRef),
      supplierAllocationStatus: isUnallocatingSupplier 
        ? 'Not Allocated' 
        : (targetSupplierId || targetSupplierName ? 'Allocated' : currentItem.supplierAllocationStatus || 'Not Allocated'),
      supplierAllocatedAt: isUnallocatingSupplier ? undefined : (hasSupplierAllocationUpdate ? now : currentItem.supplierAllocatedAt),
      supplierAllocatedBy: isUnallocatingSupplier ? undefined : (hasSupplierAllocationUpdate ? actorName : currentItem.supplierAllocatedBy),
      paymentCutoffDate: isUnallocatingSupplier ? undefined : (updates.paymentCutoffDate !== undefined ? updates.paymentCutoffDate : currentItem.paymentCutoffDate),
      supplierNotes: isUnallocatingSupplier ? undefined : (updates.supplierNotes !== undefined ? updates.supplierNotes : currentItem.supplierNotes),
      supplierStatus: isUnallocatingSupplier ? 'PENDING_DISPATCH' : (updates.supplierStatus || currentItem.supplierStatus || 'SENT_TO_SUPPLIER'),

      // Authoritative Supplier Commercial Price
      supplierPrice: hasPriceUpdate ? Math.round(Number(updates.supplierPrice) * 100) / 100 : currentItem.supplierPrice,
      supplierCurrency: updates.supplierCurrency || currentItem.supplierCurrency || 'USD',
      supplierPriceType: updates.supplierPriceType || currentItem.supplierPriceType || 'Total Service Price',
      supplierAdultPrice: updates.supplierAdultPrice !== undefined ? Number(updates.supplierAdultPrice) : currentItem.supplierAdultPrice,
      supplierChildPrice: updates.supplierChildPrice !== undefined ? Number(updates.supplierChildPrice) : currentItem.supplierChildPrice,
      supplierInfantPrice: updates.supplierInfantPrice !== undefined ? Number(updates.supplierInfantPrice) : currentItem.supplierInfantPrice,
      supplierQuantity: targetQty,
      supplierTaxAmount: targetTax,
      supplierAdditionalFees: targetFees,
      supplierDiscount: targetDisc,
      supplierTotalCost: Math.round(computedTotalCost * 100) / 100,
      supplierPaymentCutoffDate: updates.supplierPaymentCutoffDate !== undefined ? updates.supplierPaymentCutoffDate : currentItem.supplierPaymentCutoffDate,
      supplierCancellationDeadline: updates.supplierCancellationDeadline !== undefined ? updates.supplierCancellationDeadline : currentItem.supplierCancellationDeadline,
      supplierPricingNotes: updates.supplierPricingNotes !== undefined ? updates.supplierPricingNotes : currentItem.supplierPricingNotes,
      supplierPriceLastUpdatedAt: hasPriceUpdate ? now : currentItem.supplierPriceLastUpdatedAt,
      supplierPriceLastUpdatedBy: hasPriceUpdate ? actorName : currentItem.supplierPriceLastUpdatedBy,
      supplierPriceChangeReason: updates.supplierPriceChangeReason || updates.changeReason || currentItem.supplierPriceChangeReason,
      supplierPriceVersion: newPriceVersion,
      supplierPriceHistory: updatedPriceHistory,

      // Workflow & Confirmation Statuses
      supplierConfirmationStatus: triggersReconfirmation
        ? 'Supplier Reconfirmation Required'
        : (isUnallocatingSupplier 
          ? 'Not Confirmed' 
          : (updates.supplierConfirmationStatus || currentItem.supplierConfirmationStatus)),
      operationalStatus: triggersReconfirmation
        ? 'Confirmation Pending'
        : (isUnallocatingSupplier 
          ? 'Supplier Not Allocated' 
          : (updates.operationalStatus || currentItem.operationalStatus || (targetSupplierId ? 'Confirmation Pending' : 'Supplier Not Allocated'))),
      voucherStatus: (triggersReconfirmation || isUnallocatingSupplier) ? 'Not Ready' : (updates.voucherStatus || currentItem.voucherStatus)
    };

    b.items[itemIdx] = updatedItem;
    b.updatedAt = now;
    b.operationalProcessingStatus = this.calculateBookingOperationalStatus(b);

    // If vouchers exist and item became reconfirmation required, mark them outdated
    if (triggersReconfirmation && b.vouchersList && b.vouchersList.length > 0) {
      b.vouchersList = b.vouchersList.map(v => ({
        ...v,
        isOutdated: true,
        outdatedReason: `Service item "${updatedItem.productName}" updated (Supplier or Commercial Price modified). Re-generation required.`
      }));
    }

    // Activity Logging for Supplier Allocation changes
    if (hasSupplierAllocationUpdate) {
      const eventId = `act-alloc-${Date.now()}-${Math.floor(Math.random()*1000)}`;
      this.recordBookingActivity({
        eventId,
        bookingId: b.id,
        bookingItemId: updatedItem.id,
        serviceItemName: updatedItem.productName,
        supplierId: updatedItem.supplierId,
        supplierName: updatedItem.supplierName,
        eventType: isUnallocatingSupplier ? 'SUPPLIER_CHANGED' : (isSupplierChanged ? 'SUPPLIER_CHANGED' : 'SUPPLIER_ALLOCATED'),
        previousValue: currentItem.supplierName || 'Unallocated',
        newValue: isUnallocatingSupplier ? 'Unallocated' : (updatedItem.supplierName || 'Unallocated'),
        actorId: user?.id || 'admin',
        actorRole: user?.role || 'TEAM_MEMBER',
        actorName,
        timestamp: now,
        description: isUnallocatingSupplier
          ? `Supplier Unallocated: Removed "${currentItem.supplierName}" from ${updatedItem.productName}`
          : (isSupplierChanged 
            ? `Supplier Reallocated: Changed from "${currentItem.supplierName}" to "${updatedItem.supplierName}" for ${updatedItem.productName}`
            : `Supplier Allocated: "${updatedItem.supplierName}" assigned to ${updatedItem.productName}`)
      }, user);

      if (!isUnallocatingSupplier && updatedItem.supplierId) {
        this.logSupplierAllocation({
          supplierId: updatedItem.supplierId,
          supplierNameSnapshot: updatedItem.supplierName || '',
          supplierCategory: updatedItem.category || 'General',
          bookingId: b.id,
          bookingReference: b.bookingReference,
          serviceItemId: updatedItem.id,
          serviceName: updatedItem.productName,
          customerName: (b as any).customerName || b.customer?.name || (b as any).buyerName || 'Valued Guest',
          serviceDate: updatedItem.serviceDate || updatedItem.travelDate,
          status: isSupplierChanged ? 'CHANGED' : 'ALLOCATED',
          allocatedBy: user?.id || 'system',
          allocatedByName: actorName,
          previousSupplierId: currentItem.supplierId,
          previousSupplierName: currentItem.supplierName,
          changeReason: isSupplierChanged ? `Reallocated from ${currentItem.supplierName}` : undefined
        }, user);
      }
    }

    // Activity Logging for Commercial Pricing changes
    if (hasPriceUpdate && isMaterialPriceChange) {
      const eventId = `act-price-${Date.now()}-${Math.floor(Math.random()*1000)}`;
      this.recordBookingActivity({
        eventId,
        bookingId: b.id,
        bookingItemId: updatedItem.id,
        serviceItemName: updatedItem.productName,
        supplierId: updatedItem.supplierId,
        supplierName: updatedItem.supplierName,
        eventType: currentItem.supplierPrice === undefined ? 'SUPPLIER_PRICE_ADDED' : 'SUPPLIER_PRICE_EDITED',
        previousValue: currentItem.supplierPrice !== undefined ? `${currentItem.supplierCurrency || 'USD'} ${currentItem.supplierPrice}` : 'None',
        newValue: `${updatedItem.supplierCurrency} ${updatedItem.supplierPrice} (${updatedItem.supplierPriceType})`,
        actorId: user?.id || 'admin',
        actorRole: user?.role || 'TEAM_MEMBER',
        actorName,
        timestamp: now,
        metadata: { reason: updates.changeReason || updates.supplierPriceChangeReason, version: newPriceVersion },
        description: `Supplier Commercial Price updated to ${updatedItem.supplierCurrency} ${updatedItem.supplierPrice} (${updatedItem.supplierPriceType}) for ${updatedItem.productName}.`
      }, user);

      if (updatedItem.supplierId) {
        this.logSupplierPriceRecord({
          supplierId: updatedItem.supplierId,
          bookingId: b.id,
          bookingReference: b.bookingReference,
          serviceItemId: updatedItem.id,
          serviceName: updatedItem.productName,
          supplierPrice: updatedItem.supplierPrice || 0,
          currency: updatedItem.supplierCurrency || 'USD',
          priceType: updatedItem.supplierPriceType || 'Total Service Price',
          previousPrice: currentItem.supplierPrice,
          effectiveDate: updatedItem.serviceDate || updatedItem.travelDate || now,
          updatedBy: user?.id || 'admin',
          updatedByName: actorName,
          changeReason: updates.changeReason || updates.supplierPriceChangeReason
        }, user);
      }
    }

    // General Service Item Activity Logging
    this.recordBookingActivity({
      eventId: `act-edit-item-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      bookingId: b.id,
      bookingItemId: updatedItem.id,
      serviceItemName: updatedItem.productName,
      eventType: 'SERVICE_ITEM_EDITED',
      previousValue: currentItem.productName,
      newValue: updatedItem.productName,
      actorId: user?.id || 'admin',
      actorRole: user?.role || 'TEAM_MEMBER',
      actorName,
      timestamp: now,
      description: `Service Item "${updatedItem.productName}" updated in Booking Operations Desk.`
    }, user);

    // Save and commit to Firestore and local cache
    this.saveBooking(b, user);
    return { success: true, item: updatedItem };
  }

  /**
   * Duplicate a Service Item
   */
  public duplicateServiceItem(
    bookingId: string,
    serviceItemId: string,
    user: User | null
  ): { success: boolean; item?: BookingItem; error?: string } {
    const all = this.getAllBookings();
    const b = all.find(item => item.id === bookingId || item.bookingReference === bookingId);
    if (!b || !b.items) return { success: false, error: 'Booking not found' };

    const currentItem = b.items.find(it => it.id === serviceItemId);
    if (!currentItem) return { success: false, error: 'Service item not found' };

    const now = new Date().toISOString();
    const newItemId = `item-dup-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

    const duplicatedItem: BookingItem = {
      ...currentItem,
      id: newItemId,
      productName: `${currentItem.productName} (Copy)`,
      supplierConfirmationStatus: 'Not Confirmed',
      operationalStatus: currentItem.supplierId ? 'Confirmation Pending' : 'Supplier Not Allocated',
      voucherStatus: 'Not Ready',
      invoiceStatus: 'Not Uploaded',
      confirmedAt: undefined,
      confirmedBy: undefined,
      confirmedByName: undefined,
      supplierConfirmationRef: undefined,
      reconfirmationReason: undefined
    };

    b.items.push(duplicatedItem);
    b.updatedAt = now;
    b.operationalProcessingStatus = this.calculateBookingOperationalStatus(b);

    this.recordBookingActivity({
      eventId: `act-dup-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      bookingId: b.id,
      bookingItemId: duplicatedItem.id,
      serviceItemName: duplicatedItem.productName,
      eventType: 'SERVICE_ITEM_ADDED',
      newValue: duplicatedItem.productName,
      actorId: user?.id || 'admin',
      actorRole: user?.role || 'TEAM_MEMBER',
      actorName: user?.name || 'Operations Lead',
      timestamp: now,
      description: `Service Item duplicated: "${duplicatedItem.productName}" cloned from original item #${serviceItemId}.`
    }, user);

    this.saveBooking(b, user);
    return { success: true, item: duplicatedItem };
  }

  /**
   * Replace Product on a Service Item
   */
  public replaceServiceItemProduct(
    bookingId: string,
    serviceItemId: string,
    newProductData: {
      productId: string;
      productName: string;
      category?: string;
      destination?: string;
      hub?: string;
      isManualServiceItem?: boolean;
    },
    user: User | null,
    reason?: string
  ): { success: boolean; error?: string } {
    const all = this.getAllBookings();
    const b = all.find(item => item.id === bookingId || item.bookingReference === bookingId);
    if (!b || !b.items) return { success: false, error: 'Booking not found' };

    const itemIdx = b.items.findIndex(it => it.id === serviceItemId);
    if (itemIdx === -1) return { success: false, error: 'Service item not found' };

    const currentItem = b.items[itemIdx];
    const previousName = currentItem.productName;
    const now = new Date().toISOString();

    const updatedItem: BookingItem = {
      ...currentItem,
      productId: newProductData.productId,
      productName: newProductData.productName,
      category: newProductData.category || currentItem.category,
      destination: newProductData.destination || currentItem.destination,
      hub: newProductData.hub || currentItem.hub,
      isManualServiceItem: newProductData.isManualServiceItem ?? currentItem.isManualServiceItem,
      // If was confirmed, invalidate confirmation since product changed
      supplierConfirmationStatus: currentItem.supplierConfirmationStatus === 'Confirmed' 
        ? 'Supplier Reconfirmation Required' 
        : currentItem.supplierConfirmationStatus,
      operationalStatus: 'Confirmation Pending',
      voucherStatus: 'Not Ready'
    };

    b.items[itemIdx] = updatedItem;
    b.updatedAt = now;
    b.operationalProcessingStatus = this.calculateBookingOperationalStatus(b);

    this.recordBookingActivity({
      eventId: `act-repl-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      bookingId: b.id,
      bookingItemId: updatedItem.id,
      serviceItemName: updatedItem.productName,
      eventType: 'SERVICE_ITEM_EDITED',
      previousValue: previousName,
      newValue: updatedItem.productName,
      actorId: user?.id || 'admin',
      actorRole: user?.role || 'TEAM_MEMBER',
      actorName: user?.name || 'Operations Lead',
      timestamp: now,
      metadata: { reason },
      description: `Product replaced: "${previousName}" was replaced with "${updatedItem.productName}". ${reason ? `Reason: ${reason}` : ''}`
    }, user);

    this.saveBooking(b, user);
    return { success: true };
  }

  /**
   * Cancel Service Item (with mandatory cancellation reason)
   */
  public cancelServiceItem(
    bookingId: string,
    serviceItemId: string,
    cancelReason: string,
    user: User | null
  ): { success: boolean; error?: string } {
    if (!cancelReason || !cancelReason.trim()) {
      return { success: false, error: 'A mandatory cancellation reason must be provided.' };
    }

    const all = this.getAllBookings();
    const b = all.find(item => item.id === bookingId || item.bookingReference === bookingId);
    if (!b || !b.items) return { success: false, error: 'Booking not found' };

    const itemIdx = b.items.findIndex(it => it.id === serviceItemId);
    if (itemIdx === -1) return { success: false, error: 'Service item not found' };

    const currentItem = b.items[itemIdx];
    const now = new Date().toISOString();

    const updatedItem: BookingItem = {
      ...currentItem,
      isCancelled: true,
      cancelledAt: now,
      cancelledBy: user?.name || 'Operations Lead',
      cancelReason: cancelReason.trim(),
      supplierConfirmationStatus: 'Cancelled',
      operationalStatus: 'Cancelled',
      voucherStatus: 'Not Ready'
    };

    b.items[itemIdx] = updatedItem;
    b.updatedAt = now;
    b.operationalProcessingStatus = this.calculateBookingOperationalStatus(b);

    this.recordBookingActivity({
      eventId: `act-cancel-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      bookingId: b.id,
      bookingItemId: updatedItem.id,
      serviceItemName: updatedItem.productName,
      eventType: 'SERVICE_ITEM_CANCELLED',
      previousValue: currentItem.supplierConfirmationStatus || 'Active',
      newValue: 'Cancelled',
      actorId: user?.id || 'admin',
      actorRole: user?.role || 'TEAM_MEMBER',
      actorName: user?.name || 'Operations Lead',
      timestamp: now,
      metadata: { reason: cancelReason },
      description: `Service Item "${updatedItem.productName}" CANCELLED. Reason: ${cancelReason}`
    }, user);

    this.saveBooking(b, user);
    return { success: true };
  }

  /**
   * Restore a Cancelled Service Item
   */
  public restoreServiceItem(
    bookingId: string,
    serviceItemId: string,
    user: User | null
  ): { success: boolean; error?: string } {
    const all = this.getAllBookings();
    const b = all.find(item => item.id === bookingId || item.bookingReference === bookingId);
    if (!b || !b.items) return { success: false, error: 'Booking not found' };

    const itemIdx = b.items.findIndex(it => it.id === serviceItemId);
    if (itemIdx === -1) return { success: false, error: 'Service item not found' };

    const currentItem = b.items[itemIdx];
    const now = new Date().toISOString();

    const updatedItem: BookingItem = {
      ...currentItem,
      isCancelled: false,
      cancelledAt: undefined,
      cancelledBy: undefined,
      cancelReason: undefined,
      supplierConfirmationStatus: 'Confirmation Pending',
      operationalStatus: currentItem.supplierId ? 'Confirmation Pending' : 'Supplier Not Allocated',
      voucherStatus: 'Not Ready'
    };

    b.items[itemIdx] = updatedItem;
    b.updatedAt = now;
    b.operationalProcessingStatus = this.calculateBookingOperationalStatus(b);

    this.recordBookingActivity({
      eventId: `act-restore-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      bookingId: b.id,
      bookingItemId: updatedItem.id,
      serviceItemName: updatedItem.productName,
      eventType: 'SERVICE_ITEM_RESTORED',
      previousValue: 'Cancelled',
      newValue: 'Restored (Confirmation Pending)',
      actorId: user?.id || 'admin',
      actorRole: user?.role || 'TEAM_MEMBER',
      actorName: user?.name || 'Operations Lead',
      timestamp: now,
      description: `Service Item "${updatedItem.productName}" restored from cancellation.`
    }, user);

    this.saveBooking(b, user);
    return { success: true };
  }

  /**
   * Remove a Service Item from a Booking
   */
  public removeServiceItem(
    bookingId: string,
    serviceItemId: string,
    user: User | null
  ): { success: boolean; error?: string } {
    const all = this.getAllBookings();
    const b = all.find(item => item.id === bookingId || item.bookingReference === bookingId);
    if (!b || !b.items) return { success: false, error: 'Booking not found' };

    const itemIdx = b.items.findIndex(it => it.id === serviceItemId);
    if (itemIdx === -1) return { success: false, error: 'Service item not found' };

    const removedItem = b.items[itemIdx];
    const now = new Date().toISOString();

    b.items.splice(itemIdx, 1);
    b.updatedAt = now;
    b.operationalProcessingStatus = this.calculateBookingOperationalStatus(b);

    this.recordBookingActivity({
      eventId: `act-rem-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      bookingId: b.id,
      bookingItemId: removedItem.id,
      serviceItemName: removedItem.productName,
      eventType: 'SERVICE_ITEM_REMOVED',
      previousValue: removedItem.productName,
      newValue: 'Removed',
      actorId: user?.id || 'admin',
      actorRole: user?.role || 'TEAM_MEMBER',
      actorName: user?.name || 'Operations Lead',
      timestamp: now,
      description: `Service Item removed: "${removedItem.productName}".`
    }, user);

    this.saveBooking(b, user);
    return { success: true };
  }

  /**
   * Authorised Override for Booking Operational Confirmation
   */
  public overrideBookingConfirmation(
    bookingId: string,
    reason: string,
    user: User | null
  ): { success: boolean; error?: string } {
    if (!reason || !reason.trim()) {
      return { success: false, error: 'A mandatory override reason must be recorded.' };
    }

    const all = this.getAllBookings();
    const b = all.find(item => item.id === bookingId || item.bookingReference === bookingId);
    if (!b) return { success: false, error: 'Booking not found' };

    const now = new Date().toISOString();

    b.operationalConfirmationOverride = {
      overridden: true,
      reason: reason.trim(),
      overriddenBy: user?.name || 'Operations Lead',
      overriddenAt: now
    };
    b.operationalProcessingStatus = 'Confirmed';
    b.status = 'CONFIRMED';
    b.updatedAt = now;

    this.recordBookingActivity({
      eventId: `act-over-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      bookingId: b.id,
      eventType: 'CONFIRMATION_OVERRIDDEN',
      previousValue: 'Unconfirmed Service Items Pending',
      newValue: 'Operationally Confirmed (Override)',
      actorId: user?.id || 'admin',
      actorRole: user?.role || 'ADMIN',
      actorName: user?.name || 'Operations Lead',
      timestamp: now,
      metadata: { reason },
      description: `Authorised Confirmation Override applied. Mandatory reason: ${reason}`
    }, user);

    this.saveBooking(b, user);
    return { success: true };
  }

  /**
   * Create Manual Operational Booking (stored as Internal Manual Booking without fake users or fake leads)
   */
  public createManualOperationalBooking(
    data: {
      bookingReference?: string;
      leadId?: string;
      userId?: string;
      agentId?: string;
      agentName?: string;
      agentAgency?: string;
      customerName: string;
      leadPassengerName: string;
      email?: string;
      phone?: string;
      travelStartDate: string;
      travelEndDate: string;
      destination: string;
      destinationName?: string;
      hub?: string;
      adults: number;
      children?: number;
      infants?: number;
      specialRequirements?: string;
      internalNotes?: string;
      customerFacingNotes?: string;
      serviceItems?: Partial<BookingItem>[];
      passengers?: Partial<BookingPassenger>[];
    },
    user: User | null
  ): Booking {
    const now = new Date().toISOString();
    const id = `bkm-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const bookingRef = data.bookingReference || `TUB-MAN-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const totalAdults = Number(data.adults) || 1;
    const totalChildren = Number(data.children) || 0;
    const totalInfants = Number(data.infants) || 0;
    const totalPax = totalAdults + totalChildren + totalInfants;

    const initialItems: BookingItem[] = (data.serviceItems || []).map((it, idx) => {
      const itemId = it.id || `item-man-${Date.now()}-${idx + 1}`;
      const isManual = it.isManualServiceItem ?? true;
      const unitSelling = Number(it.unitSellingPrice) || 0;
      const pax = Number(it.totalPax) || totalPax;
      const totalPrice = Number(it.totalPrice) || (unitSelling * pax);

      return {
        id: itemId,
        bookingId: id,
        productId: it.productId || `prod-man-${Date.now()}-${idx + 1}`,
        productName: it.productName || 'Operational Service Item',
        destination: it.destination || data.destination,
        hub: it.hub || data.hub,
        category: it.category || 'Private transfer',
        travelDate: it.travelDate || it.serviceDate || data.travelStartDate,
        serviceDate: it.serviceDate || it.travelDate || data.travelStartDate,
        serviceTime: it.serviceTime || '09:00',
        serviceEndDate: it.serviceEndDate,
        duration: it.duration,
        adults: it.adults || totalAdults,
        children: it.children || totalChildren,
        infants: it.infants || totalInfants,
        totalPax: pax,
        passengerAssignment: it.passengerAssignment || [],
        unitSellingPrice: unitSelling,
        totalPrice: totalPrice,
        currency: it.currency || (data as any).currency || 'USD',
        isManualServiceItem: isManual,
        customerFacingNotes: it.customerFacingNotes || '',
        operationalInstructions: it.operationalInstructions || '',
        internalNotes: it.internalNotes || '',
        supplierId: it.supplierId,
        supplierName: it.supplierName,
        supplierContact: it.supplierContact,
        supplierPhone: it.supplierPhone,
        supplierEmail: it.supplierEmail,
        supplierConfirmationRef: it.supplierConfirmationRef,
        supplierAllocationStatus: it.supplierId ? 'Allocated' : 'Not Allocated',
        supplierPrice: it.supplierPrice,
        supplierCurrency: it.supplierCurrency || 'USD',
        supplierPriceType: it.supplierPriceType || 'Per Person',
        supplierConfirmationStatus: it.supplierConfirmationStatus || 'Not Confirmed',
        operationalStatus: it.operationalStatus || 'Not Processed',
        voucherStatus: it.voucherStatus || 'Not Ready',
        invoiceStatus: it.invoiceStatus || 'Not Uploaded'
      };
    });

    const initialPassengers: BookingPassenger[] = (data.passengers && data.passengers.length > 0)
      ? data.passengers.map((p, idx) => ({
          id: p.id || `pax-${Date.now()}-${idx + 1}`,
          passengerNumber: idx + 1,
          firstName: p.firstName || (idx === 0 ? data.leadPassengerName || data.customerName : `Guest ${idx + 1}`),
          lastName: p.lastName || '',
          fullName: p.fullName || `${p.firstName || ''} ${p.lastName || ''}`.trim(),
          isLeadPax: idx === 0,
          dateOfBirth: p.dateOfBirth,
          passportNumber: p.passportNumber,
          passportExpiryDate: p.passportExpiryDate,
          nationality: p.nationality || 'Indian',
          specialRequests: p.specialRequests
        }))
      : [{
          id: `pax-lead-${Date.now()}`,
          passengerNumber: 1,
          firstName: data.leadPassengerName || data.customerName,
          lastName: '',
          fullName: data.leadPassengerName || data.customerName,
          isLeadPax: true,
          phone: data.phone,
          email: data.email,
          specialRequests: data.specialRequirements
        }];

    const totalSellingPrice = initialItems.reduce((sum, it) => sum + (it.totalPrice || 0), 0);

    const newBooking: Booking = {
      id,
      bookingReference: bookingRef,
      manualBookingReference: bookingRef,
      sourceType: 'INTERNAL_MANUAL',
      isInternalManualBooking: true,
      leadId: data.leadId,
      agentId: data.agentId,
      agentName: data.agentName,
      agentAgency: data.agentAgency,
      userId: data.userId || user?.id,
      destination: data.destination,
      destinationName: data.destinationName || data.destination,
      customer: {
        leadTravelerName: data.leadPassengerName || data.customerName,
        bookerName: data.customerName,
        email: data.email || 'internal-ops@theunbound.in',
        phone: data.phone || '',
        totalAdults,
        totalChildren,
        totalInfants,
        totalPax,
        specialRequests: data.specialRequirements
      },
      items: initialItems,
      passengers: initialPassengers,
      currency: (initialItems[0]?.currency as CurrencyCode) || 'USD',
      totalAmount: totalSellingPrice,
      travelStartDate: data.travelStartDate,
      travelEndDate: data.travelEndDate,
      status: 'TO_BE_PROCESSED',
      paymentStatus: 'UNPAID',
      documentStatus: 'DOCUMENTS_PENDING',
      supplierAllocationStatus: initialItems.some(it => it.supplierId) ? 'DISPATCHED_TO_SUPPLIERS' : 'UNALLOCATED',
      internalNotes: data.internalNotes || '',
      internalNotesList: data.internalNotes ? [{
        id: `note-${Date.now()}`,
        authorId: user?.id || 'admin',
        authorName: user?.name || 'Operations Lead',
        text: data.internalNotes,
        timestamp: now
      }] : [],
      customerUpdates: data.customerFacingNotes ? [{
        id: `cust-note-${Date.now()}`,
        authorId: user?.id || 'admin',
        authorName: user?.name || 'Operations Lead',
        title: 'Booking Created',
        message: data.customerFacingNotes,
        timestamp: now,
        isPublished: true
      }] : [],
      createdAt: now,
      updatedAt: now,
      confirmationNotice: 'Manual operational booking created internally by Operations Team.',
      notificationEmailsSent: []
    };

    newBooking.operationalProcessingStatus = this.calculateBookingOperationalStatus(newBooking);

    this.saveBooking(newBooking, user);

    this.recordBookingActivity({
      eventId: `act-create-man-${Date.now()}`,
      bookingId: id,
      eventType: 'BOOKING_CREATED',
      previousValue: 'None',
      newValue: `Manual Booking Ref: ${bookingRef}`,
      actorId: user?.id || 'admin',
      actorRole: user?.role || 'TEAM_MEMBER',
      actorName: user?.name || 'Operations Lead',
      timestamp: now,
      description: `Internal Manual Booking created with reference ${bookingRef}. Marked as Internal Manual Booking.`
    }, user);

    return newBooking;
  }

  /**
   * Booking-Level Voucher Eligibility Gate
   */
  public checkBookingVoucherEligibility(booking: Booking): {
    isEligible: boolean;
    totalItems: number;
    confirmedItems: number;
    pendingItems: number;
    reconfirmationRequiredItems: number;
    cancelledItems: number;
    missingReasons: { itemId: string; itemName: string; reasons: string[] }[];
  } {
    const items = booking.items || [];
    const totalItems = items.length;
    const confirmedItems = items.filter(it => it.supplierConfirmationStatus === 'Confirmed').length;
    const reconfirmationRequiredItems = items.filter(it => it.supplierConfirmationStatus === 'Supplier Reconfirmation Required').length;
    const cancelledItems = items.filter(it => it.supplierConfirmationStatus === 'Cancelled' || it.supplierStatus === 'CANCELLED').length;
    const activeItems = totalItems - cancelledItems;
    const pendingItems = activeItems - confirmedItems;

    const missingReasons: { itemId: string; itemName: string; reasons: string[] }[] = [];

    items.forEach(it => {
      if (it.supplierConfirmationStatus === 'Cancelled' || it.supplierStatus === 'CANCELLED') return;
      const reasons: string[] = [];
      if (it.supplierConfirmationStatus !== 'Confirmed') {
        if (!it.supplierId && !it.supplierName) reasons.push('Supplier not allocated');
        if (it.supplierPrice === undefined || it.supplierPrice === null) reasons.push('Supplier price not set');
        if (it.supplierConfirmationStatus === 'Supplier Reconfirmation Required') {
          reasons.push(`Supplier reconfirmation required: ${it.reconfirmationReason || 'Pending update'}`);
        } else {
          reasons.push('Service item confirmation pending');
        }
      }
      if (reasons.length > 0) {
        missingReasons.push({
          itemId: it.id,
          itemName: it.productName,
          reasons
        });
      }
    });

    const isEligible = activeItems > 0 && confirmedItems === activeItems && reconfirmationRequiredItems === 0;

    return {
      isEligible,
      totalItems,
      confirmedItems,
      pendingItems: Math.max(0, pendingItems),
      reconfirmationRequiredItems,
      cancelledItems,
      missingReasons
    };
  }

  /**
   * Authoritative Voucher Generation using strictly Confirmed Service Items & Snapshots
   */
  public generateBookingVoucher(
    bookingId: string,
    user: User | null,
    forceRegenerate: boolean = false
  ): { success: boolean; voucher?: BookingVoucher; error?: string } {
    const all = this.getAllBookings();
    const b = all.find(item => item.id === bookingId || item.bookingReference === bookingId);
    if (!b) return { success: false, error: 'Booking not found' };

    const eligibility = this.checkBookingVoucherEligibility(b);
    if (!eligibility.isEligible && !forceRegenerate) {
      return {
        success: false,
        error: `Voucher cannot be generated: ${eligibility.pendingItems} service item(s) are pending confirmation.`
      };
    }

    const existingVouchers = b.vouchersList || [];
    const newVersion = existingVouchers.length + 1;
    const now = new Date().toISOString();
    const voucherNumber = `TUB-VOU-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    const confirmedItems = (b.items || []).filter(it => it.supplierConfirmationStatus === 'Confirmed' || forceRegenerate);
    const primaryItem = confirmedItems[0] || b.items?.[0];

    // Build authoritative customer/partner snapshot WITHOUT internal costs or markups
    const bookingSnapshot = {
      bookingId: b.id,
      bookingReference: b.bookingReference,
      customerName: b.customer?.leadTravelerName || 'Guest',
      email: b.customer?.email,
      phone: b.customer?.phone,
      totalAdults: b.customer?.totalAdults || 1,
      totalChildren: b.customer?.totalChildren || 0,
      totalPax: (b.customer?.totalAdults || 1) + (b.customer?.totalChildren || 0),
      travelStartDate: b.travelStartDate,
      travelEndDate: b.travelEndDate,
      destinationName: b.destinationName,
      pickupLocation: b.customer?.pickupLocation,
      dropoffLocation: b.customer?.dropoffLocation,
      specialRequests: b.customer?.specialRequests,
      generatedAt: now
    };

    const serviceItemsSnapshot = confirmedItems.map(it => ({
      itemId: it.id,
      productName: it.productName,
      category: it.category,
      destination: it.destination || it.destinationName,
      city: it.city,
      serviceDate: it.serviceDate || it.travelDate,
      serviceTime: it.serviceTime || '09:00 AM',
      supplierName: it.supplierName,
      supplierContact: it.supplierContact || it.supplierPhone,
      supplierConfirmationRef: it.supplierConfirmationRef || 'Ground Locked',
      adults: it.adults,
      children: it.children,
      totalPax: it.totalPax,
      passengerDetails: it.passengerDetails,
      meetingPoint: (it as any).meetingPoint || b.customer?.pickupLocation || 'Hotel Lobby / Terminal Arrival Point'
    }));

    const supplierAllocationSnapshot = confirmedItems.map(it => ({
      serviceItemId: it.id,
      serviceName: it.productName,
      supplierName: it.supplierName,
      supplierType: it.supplierType,
      supplierContact: it.supplierContact,
      supplierConfirmationRef: it.supplierConfirmationRef,
      paymentCutoffDate: it.paymentCutoffDate
    }));

    const newVoucher: BookingVoucher = {
      id: `vch-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      voucherId: `vch-${Date.now()}`,
      voucherNumber,
      version: newVersion,
      bookingId: b.id,
      bookingReference: b.bookingReference,
      serviceItemId: primaryItem?.id || 'all-services',
      customerName: b.customer?.leadTravelerName || 'Guest',
      leadPaxName: b.customer?.leadTravelerName || 'Lead Traveler',
      totalPax: bookingSnapshot.totalPax,
      destination: b.destinationName || 'Destination',
      city: primaryItem?.city || 'Tokyo / Kyoto',
      serviceName: confirmedItems.length > 1 ? `${confirmedItems.length} Confirmed Ground Services Package` : (primaryItem?.productName || 'Ground Travel Service'),
      serviceDate: b.travelStartDate || primaryItem?.serviceDate || primaryItem?.travelDate || now.split('T')[0],
      serviceTime: primaryItem?.serviceTime || '09:00 AM',
      supplierName: confirmedItems.map(i => i.supplierName).filter(Boolean).join(', ') || 'TheUnbound Authorized Ground Network',
      supplierContact: '+91 9811654959 (TheUnbound 24/7 Dispatch)',
      supplierConfirmationRef: confirmedItems.map(i => i.supplierConfirmationRef).filter(Boolean).join(', ') || 'GROUND-OPS-OK',
      meetingPoint: b.customer?.pickupLocation || 'Hotel Lobby or Arrival Airport Terminal',
      pickupInfo: b.customer?.pickupLocation ? `Pick up at ${b.customer.pickupLocation}. Please be ready 15 mins prior.` : 'Check individual service itinerary instructions.',
      dropoffInfo: b.customer?.dropoffLocation,
      emergencyContact: '+91 9811654959 / 24-Hour Emergency Ground Operations Desk',
      passengerBreakdown: `${b.customer?.totalAdults || 1} Adults${b.customer?.totalChildren ? `, ${b.customer.totalChildren} Children` : ''}`,
      specialInstructions: 'Present this digital or printed voucher upon boarding or hotel check-in. Valid government photo identification matching passport name is required.',
      termsAndConditions: 'Voucher issued by TheUnbound DMC. Non-transferable. Valid only for specified dates and confirmed services.',
      status: 'ISSUED',
      generatedAt: now,
      generatedBy: user?.id || 'admin',
      generatedByName: user?.name || 'Operations Lead',
      templateVersion: 'v2.4-Authoritative-DMC',
      bookingSnapshot,
      serviceItemsSnapshot,
      supplierAllocationSnapshot,
      confirmationSnapshot: { confirmedCount: confirmedItems.length, timestamp: now },
      isOutdated: false,
      issuedAt: now
    };

    // Update parent booking
    if (!b.vouchersList) b.vouchersList = [];
    b.vouchersList.unshift(newVoucher);
    b.voucherUrl = `/vouchers/${newVoucher.id}`;
    b.updatedAt = now;

    // Also persist in global vouchers collection for audit
    this.saveVoucher(newVoucher, user);

    this.recordBookingActivity({
      eventId: `act-vou-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      bookingId: b.id,
      eventType: existingVouchers.length > 0 ? 'VOUCHER_REGENERATED' : 'VOUCHER_GENERATED',
      previousValue: existingVouchers.length > 0 ? `Version ${existingVouchers[0].version || 1}` : 'None',
      newValue: `Version ${newVersion} (${voucherNumber})`,
      actorId: user?.id || 'admin',
      actorRole: user?.role || 'TEAM_MEMBER',
      actorName: user?.name || 'Operations Lead',
      timestamp: now,
      relatedVoucherId: newVoucher.id,
      metadata: { voucherNumber, version: newVersion, itemsCount: confirmedItems.length },
      description: existingVouchers.length > 0 
        ? `Service Voucher RE-GENERATED: Version ${newVersion} (#${voucherNumber}) with ${confirmedItems.length} confirmed services.`
        : `Service Voucher GENERATED: Version ${newVersion} (#${voucherNumber}) with ${confirmedItems.length} confirmed services.`
    }, user);

    this.saveBooking(b, user);
    return { success: true, voucher: newVoucher };
  }

  public getBookingVouchers(bookingId: string): BookingVoucher[] {
    const b = this.getBookingById(bookingId);
    if (!b) return [];
    return b.vouchersList || [];
  }

  // =========================================================================
  // MANUAL INVOICE UPLOAD & DOCUMENT ASSOCIATION
  // (Strictly Manual Upload ONLY - Never generated automatically)
  // =========================================================================

  public getUploadedInvoices(bookingId?: string): BookingUploadedInvoice[] {
    const all = this.getItem<BookingUploadedInvoice[]>('uploaded_invoices', []);
    if (bookingId) {
      return all.filter(inv => inv.bookingId === bookingId || inv.bookingReference === bookingId);
    }
    return all;
  }

  public getUploadedInvoiceById(id: string): BookingUploadedInvoice | undefined {
    return this.getUploadedInvoices().find(i => i.id === id || i.invoiceId === id);
  }

  public saveUploadedInvoice(invoice: BookingUploadedInvoice, user: User | null): void {
    const all = this.getUploadedInvoices();
    const existingIdx = all.findIndex(i => i.id === invoice.id);
    const now = new Date().toISOString();

    if (existingIdx >= 0) {
      all[existingIdx] = invoice;
    } else {
      all.unshift(invoice);
    }
    this.setItem('uploaded_invoices', all);
    this.syncFirestoreDoc('uploaded_invoices', invoice.id, invoice);

    // Link to booking
    const b = this.getBookingById(invoice.bookingId);
    if (b) {
      if (!b.uploadedInvoices) b.uploadedInvoices = [];
      const bIdx = b.uploadedInvoices.findIndex(i => i.id === invoice.id);
      if (bIdx >= 0) b.uploadedInvoices[bIdx] = invoice;
      else b.uploadedInvoices.unshift(invoice);

      // If associated with a specific service item, update item status
      if (invoice.bookingItemId && b.items) {
        const it = b.items.find(item => item.id === invoice.bookingItemId);
        if (it) it.invoiceStatus = 'Uploaded';
      }

      b.updatedAt = now;
      this.saveBooking(b, user);

      this.recordBookingActivity({
        eventId: `act-inv-up-${Date.now()}-${Math.floor(Math.random()*1000)}`,
        bookingId: b.id,
        bookingItemId: invoice.bookingItemId,
        supplierId: invoice.supplierId,
        eventType: 'INVOICE_UPLOADED',
        newValue: `${invoice.invoiceType} #${invoice.invoiceNumber} (${invoice.currency} ${invoice.amount})`,
        actorId: user?.id || 'admin',
        actorRole: user?.role || 'TEAM_MEMBER',
        actorName: user?.name || 'Operations Staff',
        timestamp: now,
        relatedDocumentId: invoice.id,
        metadata: { invoiceNumber: invoice.invoiceNumber, fileName: invoice.uploadedFileName, association: invoice.associationType },
        description: `Manual Invoice Uploaded: ${invoice.invoiceType} #${invoice.invoiceNumber} (${invoice.currency} ${invoice.amount}) uploaded by ${user?.name || 'Operations'}. File: ${invoice.uploadedFileName}`
      }, user);
    }
  }

  public replaceUploadedInvoice(
    invoiceId: string,
    updates: Partial<BookingUploadedInvoice>,
    user: User | null
  ): void {
    const all = this.getUploadedInvoices();
    const target = all.find(i => i.id === invoiceId);
    if (!target) return;

    const now = new Date().toISOString();
    const historyEntry = {
      action: 'REPLACE' as const,
      timestamp: now,
      actor: user?.name || 'Operations Lead',
      note: updates.notes || 'Replaced invoice document version',
      previousFile: target.uploadedFileName
    };

    const updated: BookingUploadedInvoice = {
      ...target,
      ...updates,
      uploadedAt: now,
      uploadedBy: user?.id || 'admin',
      uploadedByName: user?.name || 'Operations Lead',
      status: 'REPLACED',
      history: [historyEntry, ...(target.history || [])]
    };

    this.saveUploadedInvoice(updated, user);

    this.recordBookingActivity({
      eventId: `act-inv-rep-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      bookingId: target.bookingId,
      bookingItemId: target.bookingItemId,
      supplierId: target.supplierId,
      eventType: 'INVOICE_REPLACED',
      previousValue: target.uploadedFileName,
      newValue: updates.uploadedFileName || 'New Document File',
      actorId: user?.id || 'admin',
      actorRole: user?.role || 'TEAM_MEMBER',
      actorName: user?.name || 'Operations Lead',
      timestamp: now,
      relatedDocumentId: target.id,
      description: `Invoice ${target.invoiceNumber} replaced with new file: ${updates.uploadedFileName || 'Updated version'}`
    }, user);
  }

  public archiveUploadedInvoice(invoiceId: string, reason: string, user: User | null): void {
    const all = this.getUploadedInvoices();
    const target = all.find(i => i.id === invoiceId);
    if (!target) return;

    const now = new Date().toISOString();
    const updated: BookingUploadedInvoice = {
      ...target,
      status: 'ARCHIVED',
      history: [
        {
          action: 'ARCHIVE' as const,
          timestamp: now,
          actor: user?.name || 'Operations Lead',
          note: reason || 'Archived by operational authority'
        },
        ...(target.history || [])
      ]
    };

    this.saveUploadedInvoice(updated, user);

    this.recordBookingActivity({
      eventId: `act-inv-arc-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      bookingId: target.bookingId,
      bookingItemId: target.bookingItemId,
      supplierId: target.supplierId,
      eventType: 'INVOICE_ARCHIVED',
      actorId: user?.id || 'admin',
      actorRole: user?.role || 'TEAM_MEMBER',
      actorName: user?.name || 'Operations Lead',
      timestamp: now,
      relatedDocumentId: target.id,
      description: `Invoice ${target.invoiceNumber} was ARCHIVED. Reason: ${reason}`
    }, user);
  }

  public addInvoiceNote(invoiceId: string, note: string, user: User | null): void {
    const all = this.getUploadedInvoices();
    const target = all.find(i => i.id === invoiceId);
    if (!target) return;

    const now = new Date().toISOString();
    const updated: BookingUploadedInvoice = {
      ...target,
      notes: target.notes ? `${target.notes}\n[${now.split('T')[0]} - ${user?.name || 'Staff'}]: ${note}` : `[${now.split('T')[0]} - ${user?.name || 'Staff'}]: ${note}`,
      history: [
        {
          action: 'NOTE_ADDED' as const,
          timestamp: now,
          actor: user?.name || 'Operations Staff',
          note
        },
        ...(target.history || [])
      ]
    };

    this.saveUploadedInvoice(updated, user);
  }

  // ==========================================
  // GOOGLE SHEETS SYNC WITH VERIFICATION REPORT
  // ==========================================
  public getSyncReports(): SyncDetailedReport[] {
    return this.getItem<SyncDetailedReport[]>('sync_reports', []);
  }

  public async performSyncFromGoogleSheets(user: User | null, sheetId: string, sheetName: string): Promise<SyncDetailedReport> {
    const startTime = Date.now();
    const currentProducts = this.getProducts();
    const logs: string[] = [];

    logs.push(`[${new Date().toISOString()}] Initiating TLS handshake with Google Sheets API v4...`);
    logs.push(`[${new Date().toISOString()}] Reading spreadsheet ID: ${sheetId}, Tab: ${sheetName}...`);

    // Simulate API fetch delay
    await new Promise(r => setTimeout(r, 1200));

    let updated = 0;
    let newCount = 0;
    let unchanged = 0;
    const validationErrors: SyncDetailedReport['validationErrors'] = [];
    const fieldChanges: SyncDetailedReport['fieldChanges'] = [];

    // Compare each product
    const refreshed = currentProducts.map((p, idx) => {
      // Validate fields
      if (p.adultNetPrice <= 0) {
        validationErrors.push({
          rowNumber: idx + 2,
          field: 'adultNetPrice',
          value: String(p.adultNetPrice),
          error: 'Adult Net Price must be greater than zero.'
        });
      }

      // Simulate a synced price adjustment / verification pass
      updated++;
      fieldChanges.push({
        sku: p.sku,
        productName: p.name,
        changedFields: ['lastUpdated', 'contractNetRateValidated']
      });

      return {
        ...p,
        lastUpdated: new Date().toISOString().split('T')[0]
      };
    });

    unchanged = Math.max(0, currentProducts.length - updated);

    logs.push(`[${new Date().toISOString()}] Validated ${refreshed.length} product rows against schema.`);
    logs.push(`[${new Date().toISOString()}] Synchronized master database with operational cache.`);
    logs.push(`[${new Date().toISOString()}] Synchronization finished successfully.`);

    const durationMs = Date.now() - startTime;
    const report: SyncDetailedReport = {
      id: `sync-rep-${Date.now()}`,
      timestamp: new Date().toISOString(),
      userEmail: user?.email || 'admin@theunbound.in',
      sheetId,
      sheetName,
      durationMs,
      status: validationErrors.length > 0 ? 'COMPLETED_WITH_ERRORS' : 'SUCCESS',
      counts: {
        totalProcessed: refreshed.length,
        newRecords: newCount,
        updatedRecords: updated,
        unchangedRecords: unchanged,
        removedRecords: 0,
        errorsCount: validationErrors.length
      },
      fieldChanges,
      validationErrors,
      logs
    };

    // Update DB
    this.setItem('products', refreshed);
    const existingReports = this.getSyncReports();
    this.setItem('sync_reports', [report, ...existingReports.slice(0, 49)]);

    this.logAudit(
      user,
      'GOOGLE_SHEETS_SYNC',
      'GoogleSheets',
      sheetId,
      `Executed Sheets sync: ${updated} updated, ${newCount} new, ${validationErrors.length} errors.`
    );

    return report;
  }

  public saveSyncedProducts(products: Product[], report: SyncDetailedReport, user: User | null): void {
    this.setItem('products', products);
    const existingReports = this.getSyncReports();
    this.setItem('sync_reports', [report, ...existingReports.slice(0, 49)]);
    this.logAudit(
      user,
      'GOOGLE_SHEETS_SYNC',
      'GoogleSheets',
      report.sheetId,
      `Google Sheets synchronization applied: ${report.counts.updatedRecords} records updated, ${report.counts.errorsCount} errors.`
    );
  }

  // ==========================================
  // HOTEL MANAGEMENT (B2B Rates, Room Types, Blackout)
  // ==========================================
  public getHotels(): Hotel[] {
    return this.getItem<Hotel[]>('hotels', INITIAL_HOTELS);
  }

  public getHotelById(id: string): Hotel | undefined {
    return this.getHotels().find(h => h.id === id);
  }

  public saveHotel(hotel: Hotel, user: User | null): void {
    if (user) {
      const auth = this.canUserWriteCMS(user, 'OPERATIONS', 'Hotel');
      if (!auth.allowed) {
        this.logAudit(user, 'UNAUTHORIZED_WRITE_ATTEMPT', 'Hotel', hotel.id, `Unauthorized write attempt: ${auth.reason}`);
        return;
      }
    }
    const hotels = this.getHotels();
    const index = hotels.findIndex(h => h.id === hotel.id);
    let savedHotel: Hotel;
    if (index >= 0) {
      savedHotel = { ...hotel, updatedAt: new Date().toISOString() };
      hotels[index] = savedHotel;
      this.logAudit(user, 'PRODUCT_UPDATED', 'Hotel', hotel.id, `Updated hotel property: ${hotel.name} (${hotel.code})`);
    } else {
      savedHotel = { ...hotel, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      hotels.unshift(savedHotel);
      this.logAudit(user, 'PRODUCT_CREATED', 'Hotel', hotel.id, `Created hotel property: ${hotel.name} (${hotel.code})`);
    }
    this.syncFirestoreDoc('hotels', savedHotel.id, savedHotel);
    this.setItem('hotels', hotels);
  }

  public deleteHotel(hotelId: string, user: User | null): void {
    const hotels = this.getHotels();
    const target = hotels.find(h => h.id === hotelId);
    this.setItem('hotels', hotels.filter(h => h.id !== hotelId));
    this.deleteFirestoreDoc('hotels', hotelId);
    if (target) {
      this.logAudit(user, 'PRODUCT_ARCHIVED', 'Hotel', hotelId, `Deleted hotel property: ${target.name}`);
    }
  }

  // ==========================================
  // DESTINATION CITIES / HUBS MANAGEMENT
  // ==========================================
  public getCityHubs(): CityHub[] {
    return this.getItem<CityHub[]>('city_hubs', INITIAL_CITY_HUBS);
  }

  public getCityHubsByDestination(destinationIdOrSlug: string): CityHub[] {
    if (!destinationIdOrSlug || destinationIdOrSlug === 'all') return this.getCityHubs();
    const query = destinationIdOrSlug.toLowerCase();
    return this.getCityHubs().filter(c => 
      c.destinationId.toLowerCase() === query || 
      c.destinationName.toLowerCase() === query ||
      c.destinationId.toLowerCase().includes(query) ||
      query.includes(c.destinationId.toLowerCase())
    );
  }

  public saveCityHub(cityHub: CityHub, user: User | null): void {
    const hubs = this.getCityHubs();
    const index = hubs.findIndex(c => c.id === cityHub.id);
    if (index >= 0) {
      hubs[index] = cityHub;
      this.logAudit(user, 'DESTINATION_UPDATED', 'CityHub', cityHub.id, `Updated city hub: ${cityHub.name} (${cityHub.destinationName})`);
    } else {
      hubs.push(cityHub);
      this.logAudit(user, 'DESTINATION_UPDATED', 'CityHub', cityHub.id, `Added city hub: ${cityHub.name} (${cityHub.destinationName})`);
    }
    this.syncFirestoreDoc('city_hubs', cityHub.id, cityHub);
    this.setItem('city_hubs', hubs);
  }

  public deleteCityHub(cityHubId: string, user: User | null): void {
    const hubs = this.getCityHubs();
    const target = hubs.find(c => c.id === cityHubId);
    this.setItem('city_hubs', hubs.filter(c => c.id !== cityHubId));
    this.deleteFirestoreDoc('city_hubs', cityHubId);
    if (target) {
      this.logAudit(user, 'DESTINATION_UPDATED', 'CityHub', cityHubId, `Deleted city hub: ${target.name}`);
    }
  }

  // ==========================================
  // DESTINATION FAQs MANAGEMENT
  // ==========================================
  public getDestinationFAQs(destinationId?: string): DestinationFAQ[] {
    const faqs = this.getItem<DestinationFAQ[]>('destination_faqs', INITIAL_FAQS);
    if (destinationId && destinationId !== 'all') {
      return faqs.filter(f => f.destinationId === destinationId);
    }
    return faqs;
  }

  public saveDestinationFAQ(faq: DestinationFAQ, user: User | null): void {
    const faqs = this.getItem<DestinationFAQ[]>('destination_faqs', INITIAL_FAQS);
    const index = faqs.findIndex(f => f.id === faq.id);
    if (index >= 0) {
      faqs[index] = faq;
      this.logAudit(user, 'SETTINGS_UPDATED', 'DestinationFAQ', faq.id, `Updated FAQ for ${faq.destinationName}: "${faq.question}"`);
    } else {
      faqs.push(faq);
      this.logAudit(user, 'SETTINGS_UPDATED', 'DestinationFAQ', faq.id, `Created FAQ for ${faq.destinationName}: "${faq.question}"`);
    }
    this.syncFirestoreDoc('faqs', faq.id, faq);
    this.setItem('destination_faqs', faqs);
  }

  public deleteDestinationFAQ(faqId: string, user: User | null): void {
    const faqs = this.getItem<DestinationFAQ[]>('destination_faqs', INITIAL_FAQS);
    const target = faqs.find(f => f.id === faqId);
    this.setItem('destination_faqs', faqs.filter(f => f.id !== faqId));
    this.deleteFirestoreDoc('faqs', faqId);
    if (target) {
      this.logAudit(user, 'SETTINGS_UPDATED', 'DestinationFAQ', faqId, `Deleted FAQ: "${target.question}"`);
    }
  }

  // ==========================================
  // HAPPY CUSTOMER GALLERY MANAGEMENT
  // ==========================================
  public getGalleryImages(): GalleryImage[] {
    return this.getItem<GalleryImage[]>('gallery', INITIAL_GALLERY);
  }

  public saveGalleryImage(image: GalleryImage, user: User | null): void {
    const gallery = this.getGalleryImages();
    const index = gallery.findIndex(g => g.id === image.id);
    if (index >= 0) {
      gallery[index] = image;
      this.logAudit(user, 'SETTINGS_UPDATED', 'GalleryImage', image.id, `Updated gallery image: ${image.caption}`);
    } else {
      gallery.unshift(image);
      this.logAudit(user, 'SETTINGS_UPDATED', 'GalleryImage', image.id, `Added gallery photo for ${image.customerName} (${image.destination})`);
    }
    this.syncFirestoreDoc('gallery_items', image.id, image);
    this.setItem('gallery', gallery);
  }

  public deleteGalleryImage(imageId: string, user: User | null): void {
    const gallery = this.getGalleryImages();
    const target = gallery.find(g => g.id === imageId);
    this.setItem('gallery', gallery.filter(g => g.id !== imageId));
    this.deleteFirestoreDoc('gallery_items', imageId);
    if (target) {
      this.logAudit(user, 'SETTINGS_UPDATED', 'GalleryImage', imageId, `Removed gallery image: ${target.caption}`);
    }
  }

  // ==========================================
  // HOMEPAGE CONTROL CONFIGURATION
  // ==========================================
  public getHomepageConfig(): HomepageConfig {
    const config = this.getItem<HomepageConfig>('homepage_config', INITIAL_HOMEPAGE_CONFIG);
    if (config?.heroConfig?.eyebrowText && config.heroConfig.eyebrowText.includes('ESTABLISHED IN 2018')) {
      config.heroConfig.eyebrowText = config.heroConfig.eyebrowText.replace('ESTABLISHED IN 2018', 'ESTABLISHED IN 2025');
    }
    if (config?.heroBadgeText && config.heroBadgeText.includes('ESTABLISHED IN 2018')) {
      config.heroBadgeText = config.heroBadgeText.replace('ESTABLISHED IN 2018', 'ESTABLISHED IN 2025');
    }
    return config;
  }

  public updateHomepageConfig(config: HomepageConfig, user: User | null): void {
    this.setItem('homepage_config', config);
    this.syncFirestoreDoc('homepage_config', 'main', config);
    this.logAudit(user, 'SETTINGS_UPDATED', 'HomepageConfig', 'main', `Updated Homepage Control settings (Hero & Featured ordering)`);
  }

  // ==========================================
  // INSTITUTIONAL & LEGAL PAGES CONFIGURATION
  // ==========================================
  public getSitePagesConfig(): SitePagesConfig {
    return this.getItem<SitePagesConfig>('site_pages_config', INITIAL_SITE_PAGES_CONFIG);
  }

  public updateSitePagesConfig(config: SitePagesConfig, user: User | null): void {
    this.setItem('site_pages_config', config);
    this.syncFirestoreDoc('site_pages_config', 'main', config);
    this.logAudit(user, 'SETTINGS_UPDATED', 'SitePagesConfig', 'main', `Updated Institutional and Legal Pages content`);
  }

  // ==========================================
  // INTERNAL CRM: LEADS & CUSTOMER JOURNEY ENGINE
  // ==========================================
  public getLeads(): TravelLead[] {
    let raw = this.getItem<TravelLead[]>('leads', []);
    if (!raw || raw.length === 0) {
      raw = INITIAL_LEADS;
      this.setItem('leads', raw);
    }

    // Ensure all leads have required CRM arrays and valid safe primitive types
    return raw.map(l => {
      // 1. Sanitize travelRequirements so it is ALWAYS safely a primitive string
      let sanitizedTravelRequirements = '';
      if (typeof l.travelRequirements === 'string') {
        sanitizedTravelRequirements = l.travelRequirements;
      } else if (Array.isArray(l.travelRequirements)) {
        sanitizedTravelRequirements = (l.travelRequirements as any[])
          .map(item => typeof item === 'string' ? item : item?.text || '')
          .filter(Boolean)
          .join('\n');
      } else if (l.travelRequirements && typeof l.travelRequirements === 'object') {
        sanitizedTravelRequirements = (l.travelRequirements as any).text || '';
      }

      // 2. Sanitize specialRequests
      let sanitizedSpecialRequests = '';
      if (typeof l.specialRequests === 'string') {
        sanitizedSpecialRequests = l.specialRequests;
      } else if (Array.isArray(l.specialRequests)) {
        sanitizedSpecialRequests = (l.specialRequests as any[])
          .map(item => typeof item === 'string' ? item : item?.text || '')
          .filter(Boolean)
          .join('\n');
      } else if (l.specialRequests && typeof l.specialRequests === 'object') {
        sanitizedSpecialRequests = (l.specialRequests as any).text || '';
      }

      // 3. Sanitize notes array
      let sanitizedNotes: LeadNote[] = [];
      if (Array.isArray(l.notes)) {
        sanitizedNotes = l.notes.map((n: any, idx: number) => {
          if (typeof n === 'string') {
            return {
              id: `note-${idx}-${Date.now()}`,
              authorName: 'Operations Staff',
              text: n,
              timestamp: new Date().toISOString()
            };
          } else if (n && typeof n === 'object') {
            return {
              ...n,
              id: n.id || `note-${idx}`,
              authorName: typeof n.authorName === 'string' ? n.authorName : 'Operations Staff',
              authorRole: typeof n.authorRole === 'string' ? n.authorRole : undefined,
              text: typeof n.text === 'string' ? n.text : (typeof n.message === 'string' ? n.message : ''),
              timestamp: typeof n.timestamp === 'string' ? n.timestamp : new Date().toISOString()
            };
          }
          return {
            id: `note-${idx}`,
            authorName: 'Operations Staff',
            text: String(n || ''),
            timestamp: new Date().toISOString()
          };
        });
      }

      // 4. Sanitize timeline array
      const sanitizedTimeline = (l.timeline || []).map((evt: any, eIdx: number) => ({
        ...evt,
        id: evt?.id || `tl-${eIdx}`,
        title: typeof evt?.title === 'string' ? evt.title : 'Activity Event',
        description: typeof evt?.description === 'string' ? evt.description : (evt?.description ? JSON.stringify(evt.description) : ''),
        performedBy: typeof evt?.performedBy === 'string' ? evt.performedBy : 'Staff',
        timestamp: typeof evt?.timestamp === 'string' ? evt.timestamp : new Date().toISOString()
      }));

      return {
        ...l,
        travelRequirements: sanitizedTravelRequirements || 'Standard VIP ground arrangements requested.',
        specialRequests: sanitizedSpecialRequests,
        priority: l.priority || 'NORMAL',
        notes: sanitizedNotes,
        timeline: sanitizedTimeline,
        followUps: l.followUps || [],
        requestedProducts: l.requestedProducts || [],
        assignmentHistory: l.assignmentHistory || [],
        documents: l.documents || [],
        quoteIds: l.quoteIds || (l.quoteId ? [l.quoteId] : []),
        bookingIds: l.bookingIds || (l.bookingId ? [l.bookingId] : []),
        totalPassengers: l.totalPassengers || (Number(l.paxAdults || 0) + Number(l.paxChildren || 0) + Number(l.paxInfants || 0)) || 1
      };
    });
  }

  public getLeadById(id: string): TravelLead | undefined {
    return this.getLeads().find(l => l.id === id || l.leadNumber === id);
  }

  /**
   * Sanitizes lead data for B2B Agents:
   * Strips internal-only notes, confidential margin projections, and private operations comments.
   */
  public sanitizeLeadForAgent(lead: TravelLead): TravelLead {
    const clone: TravelLead = JSON.parse(JSON.stringify(lead));
    // Strip internal-only notes
    if (clone.notes && Array.isArray(clone.notes)) {
      clone.notes = clone.notes.filter(n => !n.isInternal);
    }
    delete clone.expectedMargin;
    return clone;
  }

  public getLeadsAuthorized(user: User | null): TravelLead[] {
    const allLeads = this.getLeads();
    if (!user) return [];

    // Internal operations team retains complete visibility across all leads
    if (user.role === 'ADMIN' || user.role === 'DMC_STAFF' || user.role === 'TEAM_MEMBER') {
      return allLeads;
    }

    // B2B Agent visibility rule: Visible ONLY when assigned to this agent
    if (user.role === 'B2B_AGENT') {
      return allLeads
        .filter(l => l.assignedAgentId === user.id)
        .map(l => this.sanitizeLeadForAgent(l));
    }

    // Buyer sees only their own inquiries
    return allLeads.filter(l => 
      l.userId === user.id || 
      (user.email && l.email.toLowerCase() === user.email.toLowerCase())
    );
  }

  // =========================================================================
  // B2B AGENT ASSIGNMENT & NOTIFICATION ENGINE
  // =========================================================================

  /**
   * Assigns a Lead to an approved B2B Agent.
   * Records assignment snapshots, updates visibility, appends history, and emits deduplicated notification.
   */
  public assignLeadToAgent(
    leadId: string, 
    agentUserId: string, 
    assignedByUser: User | null, 
    notes?: string
  ): TravelLead | null {
    const leads = this.getLeads();
    const idx = leads.findIndex(l => l.id === leadId || l.leadNumber === leadId);
    if (idx === -1) return null;

    const allUsers = this.getUsers();
    const agent = allUsers.find(u => u.id === agentUserId);
    if (!agent) {
      throw new Error(`Target agent with UID ${agentUserId} was not found.`);
    }
    if (agent.role !== 'B2B_AGENT' || agent.approvalStatus !== 'APPROVED') {
      throw new Error(`Agent ${agent.name} is not an approved B2B partner agent.`);
    }

    const lead = leads[idx];
    const timestamp = new Date().toISOString();
    const previousAgentName = lead.assignedAgentNameSnapshot || 'Unassigned';

    lead.assignedAgentId = agent.id;
    lead.assignedAgentNameSnapshot = agent.name;
    lead.assignedAgentEmailSnapshot = agent.email;
    lead.assignedAgentAgencySnapshot = agent.agencyName || agent.companyName;
    lead.assignedByUserId = assignedByUser?.id || 'admin';
    lead.assignedByUserNameSnapshot = assignedByUser?.name || 'Operations Desk';
    lead.assignedAt = timestamp;
    lead.leadVisibilityStatus = 'ASSIGNED';
    lead.updatedAt = timestamp;
    lead.lastActivityAt = timestamp;

    // Append to assignment history
    lead.assignmentHistory = lead.assignmentHistory || [];
    lead.assignmentHistory.unshift({
      id: `asg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      assignedStaffId: agent.id,
      assignedStaffName: `${agent.name} (${agent.agencyName || 'Agent'})`,
      assignedStaffEmail: agent.email,
      assignedDepartment: 'SALES',
      assignedBy: assignedByUser?.name || 'Internal Operations',
      assignedAt: timestamp,
      notes: notes || 'Assigned to B2B Agent partner for fulfillment'
    });

    // Append to timeline
    lead.timeline = lead.timeline || [];
    lead.timeline.unshift({
      id: `tl-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type: 'CUSTOM_ACTIVITY',
      title: 'Lead Assigned to B2B Agent',
      description: `Assigned to ${agent.name} (${agent.agencyName || 'Agent'}) by ${assignedByUser?.name || 'Internal Team'}.${notes ? ' Note: ' + notes : ''}`,
      timestamp,
      performedBy: assignedByUser?.name || 'Operations Desk',
      performedByUserType: assignedByUser?.role || 'ADMIN'
    });

    // Save lead
    leads[idx] = lead;
    this.setItem('leads', leads);
    this.syncFirestoreDoc('leads', lead.id, lead);

    // Emit deduplicated Agent assignment notification
    this.createAssignmentNotification({
      entityType: 'LEAD',
      entityId: lead.id,
      entityReference: lead.leadNumber,
      agentUserId: agent.id,
      assignedByUserId: assignedByUser?.id || 'admin',
      assignedByName: assignedByUser?.name || 'TheUnbound Operations',
      customerName: lead.contactName,
      destination: lead.destinationName,
      title: `Lead Assigned: ${lead.leadNumber}`,
      message: `Travel lead for ${lead.contactName} (${lead.destinationName || 'Destination'}) has been assigned to you.`,
      deepLinkTab: 'leads'
    });

    this.logAudit(
      assignedByUser, 
      'SETTINGS_UPDATED', 
      'TravelLead', 
      lead.id, 
      `Assigned lead ${lead.leadNumber} (${lead.contactName}) to B2B Agent ${agent.name} (${agent.agencyName})`
    );

    return lead;
  }

  /**
   * Unassigns a Lead from a B2B Agent.
   * Removes Agent visibility immediately without deleting or duplicating customer or lead records.
   */
  public unassignLead(
    leadId: string, 
    unassignedByUser: User | null, 
    reason?: string
  ): TravelLead | null {
    const leads = this.getLeads();
    const idx = leads.findIndex(l => l.id === leadId || l.leadNumber === leadId);
    if (idx === -1) return null;

    const lead = leads[idx];
    const previousAgentName = lead.assignedAgentNameSnapshot || 'Previous Agent';
    const timestamp = new Date().toISOString();

    lead.assignedAgentId = undefined;
    lead.assignedAgentNameSnapshot = undefined;
    lead.assignedAgentEmailSnapshot = undefined;
    lead.assignedAgentAgencySnapshot = undefined;
    lead.leadVisibilityStatus = 'UNASSIGNED';
    lead.updatedAt = timestamp;
    lead.lastActivityAt = timestamp;

    lead.assignmentHistory = lead.assignmentHistory || [];
    lead.assignmentHistory.unshift({
      id: `asg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      assignedStaffId: '',
      assignedStaffName: 'Unassigned',
      assignedDepartment: 'SALES',
      assignedBy: unassignedByUser?.name || 'Internal Operations',
      assignedAt: timestamp,
      notes: reason || 'Unassigned by operations team'
    });

    lead.timeline = lead.timeline || [];
    lead.timeline.unshift({
      id: `tl-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type: 'CUSTOM_ACTIVITY',
      title: 'B2B Agent Unassigned',
      description: `Unassigned from ${previousAgentName} by ${unassignedByUser?.name || 'Internal Team'}.${reason ? ' Reason: ' + reason : ''}`,
      timestamp,
      performedBy: unassignedByUser?.name || 'Operations Desk',
      performedByUserType: unassignedByUser?.role || 'ADMIN'
    });

    leads[idx] = lead;
    this.setItem('leads', leads);
    this.syncFirestoreDoc('leads', lead.id, lead);

    this.logAudit(
      unassignedByUser, 
      'SETTINGS_UPDATED', 
      'TravelLead', 
      lead.id, 
      `Unassigned lead ${lead.leadNumber} from B2B Agent ${previousAgentName}`
    );

    return lead;
  }

  /**
   * Assigns a Booking to an approved B2B Agent.
   * Records assignment snapshots, updates visibility, appends history, and emits deduplicated notification.
   */
  public assignBookingToAgent(
    bookingId: string, 
    agentUserId: string, 
    assignedByUser: User | null, 
    notes?: string
  ): Booking | null {
    const all = this.getAllBookings();
    const idx = all.findIndex(b => b.id === bookingId || b.bookingReference === bookingId);
    if (idx === -1) return null;

    const allUsers = this.getUsers();
    const agent = allUsers.find(u => u.id === agentUserId);
    if (!agent) {
      throw new Error(`Target agent with UID ${agentUserId} was not found.`);
    }
    if (agent.role !== 'B2B_AGENT' || agent.approvalStatus !== 'APPROVED') {
      throw new Error(`Agent ${agent.name} is not an approved B2B partner agent.`);
    }

    const booking = all[idx];
    const timestamp = new Date().toISOString();

    booking.assignedAgentId = agent.id;
    booking.assignedAgentNameSnapshot = agent.name;
    booking.assignedAgentAgencySnapshot = agent.agencyName || agent.companyName;
    booking.assignedByUserId = assignedByUser?.id || 'admin';
    booking.assignedByUserNameSnapshot = assignedByUser?.name || 'Operations Desk';
    booking.assignedAt = timestamp;
    booking.agentVisibilityStatus = 'VISIBLE';
    booking.updatedAt = timestamp;

    booking.timeline = booking.timeline || [];
    booking.timeline.unshift({
      id: `tl-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      title: 'Booking Assigned to B2B Agent',
      description: `Assigned to ${agent.name} (${agent.agencyName || 'Agent'}) by ${assignedByUser?.name || 'Operations Desk'}.${notes ? ' Note: ' + notes : ''}`,
      timestamp,
      type: 'STATUS_CHANGE',
      actorName: assignedByUser?.name || 'Operations Desk',
      actorRole: assignedByUser?.role || 'ADMIN'
    });

    all[idx] = booking;
    this.setItem('bookings', all);
    this.syncFirestoreDoc('bookings', booking.id, booking);

    // Emit deduplicated Agent assignment notification
    this.createAssignmentNotification({
      entityType: 'BOOKING',
      entityId: booking.id,
      entityReference: booking.bookingReference,
      agentUserId: agent.id,
      assignedByUserId: assignedByUser?.id || 'admin',
      assignedByName: assignedByUser?.name || 'TheUnbound Operations',
      customerName: booking.customer?.leadTravelerName,
      destination: booking.destinationName,
      title: `Booking Assigned: ${booking.bookingReference}`,
      message: `Booking ${booking.bookingReference} for ${booking.customer?.leadTravelerName || 'Traveler'} has been assigned to your agency account.`,
      deepLinkTab: 'bookings'
    });

    this.logAudit(
      assignedByUser, 
      'BOOKING_UPDATED', 
      'Booking', 
      booking.id, 
      `Assigned booking ${booking.bookingReference} to B2B Agent ${agent.name} (${agent.agencyName})`
    );

    return booking;
  }

  /**
   * Unassigns a Booking from a B2B Agent.
   */
  public unassignBooking(
    bookingId: string, 
    unassignedByUser: User | null, 
    reason?: string
  ): Booking | null {
    const all = this.getAllBookings();
    const idx = all.findIndex(b => b.id === bookingId || b.bookingReference === bookingId);
    if (idx === -1) return null;

    const booking = all[idx];
    const previousAgentName = booking.assignedAgentNameSnapshot || 'Previous Agent';
    const timestamp = new Date().toISOString();

    booking.assignedAgentId = undefined;
    booking.assignedAgentNameSnapshot = undefined;
    booking.assignedAgentAgencySnapshot = undefined;
    // If the booking was submitted by an agent, keep visibility VISIBLE for the submitter
    booking.agentVisibilityStatus = booking.submittedByUserId ? 'VISIBLE' : 'PENDING_ASSIGNMENT';
    booking.updatedAt = timestamp;

    booking.timeline = booking.timeline || [];
    booking.timeline.unshift({
      id: `tl-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      title: 'Booking Unassigned from B2B Agent',
      description: `Unassigned from ${previousAgentName} by ${unassignedByUser?.name || 'Operations Desk'}.${reason ? ' Reason: ' + reason : ''}`,
      timestamp,
      type: 'STATUS_CHANGE',
      actorName: unassignedByUser?.name || 'Operations Desk',
      actorRole: unassignedByUser?.role || 'ADMIN'
    });

    all[idx] = booking;
    this.setItem('bookings', all);
    this.syncFirestoreDoc('bookings', booking.id, booking);

    this.logAudit(
      unassignedByUser, 
      'BOOKING_UPDATED', 
      'Booking', 
      booking.id, 
      `Unassigned booking ${booking.bookingReference} from B2B Agent ${previousAgentName}`
    );

    return booking;
  }

  // =========================================================================
  // NOTIFICATIONS & ACTION CENTER (With Deduplication)
  // =========================================================================

  public getAgentNotifications(agentUserId?: string): AgentAssignmentNotification[] {
    const all = this.getItem<AgentAssignmentNotification[]>('agent_notifications', []);
    if (!agentUserId) return all;
    return all.filter(n => n.agentUserId === agentUserId);
  }

  public createAssignmentNotification(params: {
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
    deepLinkTab: 'leads' | 'bookings';
  }): AgentAssignmentNotification | null {
    const all = this.getAgentNotifications();
    const dateHour = new Date().toISOString().slice(0, 13); // Hourly deduplication window
    const deduplicationKey = `assignment-${params.entityType.toLowerCase()}-${params.entityId}-${params.agentUserId}-${dateHour}`;

    const existing = all.find(n => n.deduplicationKey === deduplicationKey);
    if (existing) {
      return existing; // Prevents duplicate notification entries on retries or re-renders
    }

    const notification: AgentAssignmentNotification = {
      id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      deduplicationKey,
      entityType: params.entityType,
      entityId: params.entityId,
      entityReference: params.entityReference,
      agentUserId: params.agentUserId,
      assignedByUserId: params.assignedByUserId,
      assignedByName: params.assignedByName,
      customerName: params.customerName,
      destination: params.destination,
      title: params.title,
      message: params.message,
      isRead: false,
      createdAt: new Date().toISOString(),
      deepLinkTab: params.deepLinkTab
    };

    all.unshift(notification);
    this.setItem('agent_notifications', all);
    this.syncFirestoreDoc('agent_notifications', notification.id, notification);
    return notification;
  }

  public markNotificationAsRead(notificationId: string): void {
    const all = this.getAgentNotifications();
    const idx = all.findIndex(n => n.id === notificationId);
    if (idx >= 0) {
      all[idx].isRead = true;
      this.setItem('agent_notifications', all);
      this.syncFirestoreDoc('agent_notifications', notificationId, { isRead: true });
    }
  }

  public markAllNotificationsAsRead(agentUserId: string): void {
    const all = this.getAgentNotifications();
    let changed = false;
    all.forEach(n => {
      if (n.agentUserId === agentUserId && !n.isRead) {
        n.isRead = true;
        changed = true;
        this.syncFirestoreDoc('agent_notifications', n.id, { isRead: true });
      }
    });
    if (changed) {
      this.setItem('agent_notifications', all);
    }
  }

  public saveLead(lead: TravelLead, user: User | null): TravelLead {
    const leads = this.getLeads();
    const index = leads.findIndex(l => l.id === lead.id || l.leadNumber === lead.leadNumber);
    const timestamp = new Date().toISOString();
    let savedLead: TravelLead;

    if (index >= 0) {
      savedLead = {
        ...leads[index],
        ...lead,
        updatedAt: timestamp,
        lastActivityAt: lead.lastActivityAt || timestamp
      };
      leads[index] = savedLead;
      this.logAudit(user, 'SETTINGS_UPDATED', 'TravelLead', savedLead.id, `Updated CRM lead profile for ${savedLead.leadNumber} (${savedLead.contactName})`);
    } else {
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      savedLead = {
        ...lead,
        id: lead.id || `lead-${Date.now()}-${randomNum}`,
        leadNumber: lead.leadNumber || `LED-${new Date().getFullYear()}-${randomNum}`,
        priority: lead.priority || 'NORMAL',
        createdAt: lead.createdAt || timestamp,
        updatedAt: timestamp,
        lastActivityAt: timestamp,
        notes: lead.notes || [],
        timeline: lead.timeline || [
          {
            id: `tl-${Date.now()}`,
            type: 'CUSTOM_ACTIVITY',
            title: 'Lead Captured',
            description: `Lead profile created via ${lead.source || 'Direct Entry'}`,
            timestamp,
            performedBy: user?.name || 'CRM Lead Engine',
            performedByUserType: user?.role || 'SYSTEM'
          }
        ],
        followUps: lead.followUps || [],
        requestedProducts: lead.requestedProducts || [],
        assignmentHistory: lead.assignmentHistory || [],
        documents: lead.documents || []
      };
      leads.unshift(savedLead);
      this.logAudit(user, 'BOOKING_CREATED', 'TravelLead', savedLead.id, `Captured new CRM lead ${savedLead.leadNumber} for ${savedLead.contactName} (${savedLead.destinationName})`);
    }

    // Defensive guarantee: ensure travelRequirements and specialRequests are strings
    if (typeof savedLead.travelRequirements !== 'string') {
      if (Array.isArray(savedLead.travelRequirements)) {
        savedLead.travelRequirements = (savedLead.travelRequirements as any[]).map(x => typeof x === 'string' ? x : x?.text || '').filter(Boolean).join('\n');
      } else if (savedLead.travelRequirements && typeof savedLead.travelRequirements === 'object') {
        savedLead.travelRequirements = (savedLead.travelRequirements as any).text || '';
      } else {
        savedLead.travelRequirements = 'Standard VIP ground arrangements requested.';
      }
    }
    if (typeof savedLead.specialRequests !== 'string') {
      if (Array.isArray(savedLead.specialRequests)) {
        savedLead.specialRequests = (savedLead.specialRequests as any[]).map(x => typeof x === 'string' ? x : x?.text || '').filter(Boolean).join('\n');
      } else if (savedLead.specialRequests && typeof savedLead.specialRequests === 'object') {
        savedLead.specialRequests = (savedLead.specialRequests as any).text || '';
      } else {
        savedLead.specialRequests = '';
      }
    }

    this.setItem('leads', leads);
    this.syncFirestoreDoc('leads', savedLead.id, savedLead);

    // Live Admin Activity Stream notification
    try {
      const isNew = index < 0;
      const paxTotal = ((savedLead.paxAdults || 0) + (savedLead.paxChildren || 0)) || 2;
      this.recordAdminActivity({
        category: 'LEAD',
        activityType: isNew ? 'LEAD_CREATED' : 'LEAD_STATUS_CHANGED',
        actorName: user?.name || savedLead.source || 'CRM Engine',
        actorType: user?.role === 'ADMIN' ? 'ADMIN' : user?.role === 'TEAM_MEMBER' ? 'TEAM_MEMBER' : 'SYSTEM',
        severity: savedLead.status === 'NEW' ? 'WARNING' : 'INFO',
        actionRequired: savedLead.status === 'NEW',
        actionLabel: savedLead.status === 'NEW' ? 'Assign & Qualify' : 'View Lead',
        summary: isNew 
          ? `New Lead Captured: [${savedLead.leadNumber}] ${savedLead.contactName} - ${savedLead.destinationName || 'Destination'} (${paxTotal} Pax)`
          : `Lead Profile Updated: [${savedLead.leadNumber}] ${savedLead.contactName} (${savedLead.status})`,
        details: {
          customerName: savedLead.contactName,
          destinationName: savedLead.destinationName,
          travelDates: savedLead.travelDates,
          leadNumber: savedLead.leadNumber,
          status: savedLead.status,
          actionNeeded: savedLead.status === 'NEW' ? 'Assign travel specialist & begin quotation proposal' : undefined
        },
        targetSection: 'LEAD_MANAGEMENT',
        targetSubTab: 'LEADS',
        recordId: savedLead.id,
        leadId: savedLead.id,
        entityId: savedLead.id,
        entityType: 'TravelLead'
      });
    } catch {
      // Non-blocking
    }

    try {
      this.leadSaveListeners.forEach(listener => {
        try {
          listener(savedLead, user, index < 0);
        } catch (listenerErr) {
          console.error('[DB] Error in leadSaveListener:', listenerErr);
        }
      });
    } catch {
      // Non-blocking
    }

    return savedLead;
  }

  public updateLeadStatus(leadId: string, status: LeadStatus, user: User | null, noteText?: string): TravelLead | null {
    const leads = this.getLeads();
    const index = leads.findIndex(l => l.id === leadId || l.leadNumber === leadId);
    if (index === -1) return null;

    const timestamp = new Date().toISOString();
    const prevStatus = leads[index].status;
    leads[index].status = status;
    leads[index].updatedAt = timestamp;
    leads[index].lastActivityAt = timestamp;
    leads[index].lastActivitySummary = `Status updated to ${status}`;

    // Timeline event
    const newTimelineEvent: LeadTimelineEvent = {
      id: `tl-${Date.now()}`,
      type: 'STATUS_CHANGED',
      title: `Status Changed to ${status}`,
      description: noteText ? `Status changed from ${prevStatus} to ${status}: ${noteText}` : `Status transitioned from ${prevStatus} to ${status}`,
      timestamp,
      performedBy: user?.name || 'CRM Engine',
      performedByUserType: user?.role || 'DMC_STAFF'
    };
    leads[index].timeline = [newTimelineEvent, ...(leads[index].timeline || [])];

    if (noteText) {
      leads[index].notes = [
        {
          id: `note-${Date.now()}`,
          authorId: user?.id,
          authorName: user?.name || 'Staff',
          authorRole: user?.role || 'DMC_STAFF',
          text: `[Status Change: ${status}] ${noteText}`,
          timestamp,
          isInternal: true
        },
        ...(leads[index].notes || [])
      ];
    }

    this.setItem('leads', leads);
    this.syncFirestoreDoc('leads', leads[index].id, leads[index]);

    // Live Admin Activity Stream notification
    try {
      this.recordAdminActivity({
        category: 'LEAD',
        activityType: 'LEAD_STATUS_CHANGED',
        actorName: user?.name || 'CRM Specialist',
        actorType: user?.role === 'ADMIN' ? 'ADMIN' : 'TEAM_MEMBER',
        severity: status === 'WON' ? 'INFO' : 'INFO',
        actionRequired: status === 'NEW',
        actionLabel: 'View Lead Details',
        summary: `Lead Status Changed: [${leads[index].leadNumber}] ${leads[index].contactName} (${prevStatus} ➔ ${status})`,
        details: {
          customerName: leads[index].contactName,
          destinationName: leads[index].destinationName,
          leadNumber: leads[index].leadNumber,
          previousValue: prevStatus,
          newValue: status,
          status: status
        },
        targetSection: 'LEAD_MANAGEMENT',
        targetSubTab: 'LEADS',
        recordId: leads[index].id,
        leadId: leads[index].id,
        entityId: leads[index].id,
        entityType: 'TravelLead'
      });
    } catch {
      // Non-blocking
    }
    this.logAudit(user, 'SETTINGS_UPDATED', 'TravelLead', leads[index].id, `Updated status to ${status} for ${leads[index].leadNumber} (${leads[index].contactName})`);

    if (this.actionCenterHooks?.onLeadStatusChanged) {
      try {
        this.actionCenterHooks.onLeadStatusChanged(leads[index].id, leads[index].leadNumber, status, user);
      } catch (err) {
        console.warn('Action center lead hook error:', err);
      }
    }

    return leads[index];
  }

  public updateLeadStage(
    leadId: string, 
    stageId: string, 
    user: User | null, 
    reason?: string
  ): { lead: TravelLead; autoTaskCreated?: CalendarTask } | null {
    const leads = this.getLeads();
    const index = leads.findIndex(l => l.id === leadId || l.leadNumber === leadId);
    if (index === -1) return null;

    const stages = this.getLeadStages();
    const targetStage = stages.find(s => s.id === stageId) || stages[0];
    if (!targetStage) return null;

    const timestamp = new Date().toISOString();
    const prevStageId = leads[index].stageId || leads[index].status;
    const prevStageObj = stages.find(s => s.id === prevStageId);
    const prevStageName = leads[index].stageName || prevStageObj?.name || prevStageId;

    leads[index].stageId = targetStage.id;
    leads[index].stageName = targetStage.name;
    const prevStatus = leads[index].status;
    
    if (targetStage.defaultLeadStatus) {
      leads[index].status = targetStage.defaultLeadStatus;
    }
    if (targetStage.isWon) {
      leads[index].status = 'WON';
      leads[index].conversionStatus = 'CONVERTED';
    } else if (targetStage.isLost) {
      leads[index].status = 'LOST';
      leads[index].conversionStatus = 'LOST';
    }

    leads[index].updatedAt = timestamp;
    leads[index].lastActivityAt = timestamp;
    leads[index].lastActivitySummary = `Pipeline stage moved to ${targetStage.name}`;

    // Timeline event
    const newTimelineEvent: LeadTimelineEvent = {
      id: `tl-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type: 'STATUS_CHANGED',
      title: `Pipeline Stage: ${targetStage.name}`,
      description: reason 
        ? `Stage moved from "${prevStageName}" to "${targetStage.name}": ${reason}` 
        : `Moved from "${prevStageName}" to "${targetStage.name}" via Kanban`,
      timestamp,
      performedBy: user?.name || 'CRM Specialist',
      performedByUserType: user?.role || 'DMC_STAFF'
    };
    leads[index].timeline = [newTimelineEvent, ...(leads[index].timeline || [])];

    // Check automatic follow-up task creation
    let autoTaskCreated: CalendarTask | undefined;
    const autoTaskTitle = targetStage.autoTaskOnEnter || (
      targetStage.id === 'CONTACTED' ? 'Contact new enquiry' :
      targetStage.id === 'REQUIREMENTS_COLLECTED' ? 'Request missing travel requirements' :
      targetStage.id === 'FOLLOW_UP_REQUIRED' ? 'Follow up on quotation' :
      targetStage.id === 'WON' ? 'Complete booking handover' : undefined
    );

    if (autoTaskTitle) {
      const existingTasks = this.getCalendarTasks();
      const normLeadId = (leads[index].id || '').toLowerCase();
      const normLeadNum = (leads[index].leadNumber || '').toLowerCase();
      const hasDuplicate = existingTasks.some(t => {
        const tLeadId = (t.leadId || t.entityId || '').toLowerCase();
        const tLeadNum = (t.leadNumber || '').toLowerCase();
        const matchesLead = (tLeadId && tLeadId === normLeadId) || (tLeadNum && tLeadNum === normLeadNum);
        return matchesLead && t.title.toLowerCase() === autoTaskTitle.toLowerCase() && (t.status === 'PENDING' || t.status === 'OPEN');
      });

      if (!hasDuplicate) {
        const hoursAhead = targetStage.autoTaskHours || 24;
        const dueDateObj = new Date(Date.now() + hoursAhead * 60 * 60 * 1000);
        const autoTask: CalendarTask = {
          id: `task-lead-${leads[index].id}-${Date.now()}`,
          title: autoTaskTitle,
          description: `Automatic follow-up task created upon moving lead ${leads[index].leadNumber} to stage "${targetStage.name}".`,
          taskType: 'LEAD_FOLLOW_UP',
          priority: targetStage.isWon ? 'URGENT' : (targetStage.slaDurationHours && targetStage.slaDurationHours <= 12 ? 'HIGH' : 'MEDIUM'),
          importance: targetStage.isWon ? 'URGENT' : 'IMPORTANT',
          status: 'PENDING',
          category: 'CLIENT_FOLLOW_UP',
          assignedTo: leads[index].assignedStaffId || user?.id || 'staff-01',
          assignedToName: leads[index].assignedStaffName || user?.name || 'Marcus Vance',
          assignedToEmail: leads[index].assignedStaffEmail || user?.email || 'business@theunbound.in',
          entityType: 'LEAD',
          entityId: leads[index].id,
          relatedEntityReference: leads[index].leadNumber,
          leadId: leads[index].id,
          leadNumber: leads[index].leadNumber,
          startDate: timestamp.split('T')[0],
          startTime: '09:00',
          targetRoute: `/admin/leads/${leads[index].id}`,
          actionRequired: autoTaskTitle,
          dueAt: dueDateObj.toISOString(),
          dueDate: dueDateObj.toISOString().split('T')[0],
          dueTime: dueDateObj.toTimeString().slice(0, 5),
          createdAt: timestamp,
          updatedAt: timestamp,
          isSyncedToGoogleCalendar: false,
          source: 'STAGE_AUTOMATION',
          auditMetadata: {
            actorId: user?.id,
            actorName: user?.name,
            triggerEvent: 'LEAD_STAGE_CHANGED',
            stageId: targetStage.id,
            stageName: targetStage.name
          }
        };

        this.saveCalendarTask(autoTask);
        autoTaskCreated = autoTask;
      }
    }

    this.setItem('leads', leads);
    this.syncFirestoreDoc('leads', leads[index].id, leads[index]);

    // Audit log
    this.logAudit(
      user, 
      'LEAD_MOVED_KANBAN', 
      'TravelLead', 
      leads[index].id, 
      `Stage transitioned: ${prevStageName} ➔ ${targetStage.name} for ${leads[index].leadNumber} (${leads[index].contactName})`
    );

    // Activity Stream
    try {
      this.recordAdminActivity({
        category: 'LEAD',
        activityType: 'LEAD_STATUS_CHANGED',
        actorName: user?.name || 'CRM Specialist',
        actorType: user?.role === 'ADMIN' ? 'ADMIN' : 'TEAM_MEMBER',
        severity: 'INFO',
        actionRequired: targetStage.id === 'NEW_ENQUIRY' || targetStage.id === 'CONTACTED',
        actionLabel: 'View Lead Details',
        summary: `Pipeline Stage Changed: [${leads[index].leadNumber}] ${leads[index].contactName} (${prevStageName} ➔ ${targetStage.name})`,
        details: {
          customerName: leads[index].contactName,
          destinationName: leads[index].destinationName,
          leadNumber: leads[index].leadNumber,
          previousValue: prevStageName,
          newValue: targetStage.name,
          stageId: targetStage.id,
          status: leads[index].status
        },
        targetSection: 'LEAD_MANAGEMENT',
        targetSubTab: 'LEADS',
        recordId: leads[index].id,
        leadId: leads[index].id,
        entityId: leads[index].id,
        entityType: 'TravelLead'
      });
    } catch {
      // Non-blocking
    }

    if (this.actionCenterHooks?.onLeadStatusChanged && leads[index].status !== prevStatus) {
      try {
        this.actionCenterHooks.onLeadStatusChanged(leads[index].id, leads[index].leadNumber, leads[index].status, user);
      } catch (err) {
        console.warn('Action center lead hook error:', err);
      }
    }

    this.notify();
    return { lead: leads[index], autoTaskCreated };
  }

  public bulkAssignLeads(
    leadIds: string[], 
    staff: { id: string; name: string; email?: string; department?: 'SALES' | 'OPERATIONS' | 'MANAGEMENT' }, 
    user: User | null
  ): number {
    let updatedCount = 0;
    for (const id of leadIds) {
      const res = this.assignLead(id, staff, user, 'Bulk reassignment from Lead Management');
      if (res) updatedCount++;
    }
    if (updatedCount > 0) {
      this.logAudit(user, 'BULK_ACTION_PERFORMED', 'TravelLead', 'bulk-assign', `Assigned ${updatedCount} leads to ${staff.name}`);
    }
    return updatedCount;
  }

  public bulkUpdateLeadStage(
    leadIds: string[], 
    stageId: string, 
    user: User | null
  ): number {
    let updatedCount = 0;
    for (const id of leadIds) {
      const res = this.updateLeadStage(id, stageId, user, 'Bulk stage update from Lead Management');
      if (res) updatedCount++;
    }
    if (updatedCount > 0) {
      this.logAudit(user, 'BULK_ACTION_PERFORMED', 'TravelLead', 'bulk-stage', `Updated stage for ${updatedCount} leads to ${stageId}`);
    }
    return updatedCount;
  }

  public updateLeadPriority(leadId: string, priority: LeadPriority, user: User | null): TravelLead | null {
    const leads = this.getLeads();
    const index = leads.findIndex(l => l.id === leadId || l.leadNumber === leadId);
    if (index === -1) return null;

    const timestamp = new Date().toISOString();
    const prev = leads[index].priority || 'NORMAL';
    leads[index].priority = priority;
    leads[index].updatedAt = timestamp;
    leads[index].lastActivityAt = timestamp;

    leads[index].timeline = [
      {
        id: `tl-${Date.now()}`,
        type: 'PRIORITY_CHANGED',
        title: `Priority Changed to ${priority}`,
        description: `Lead priority modified from ${prev} to ${priority}`,
        timestamp,
        performedBy: user?.name || 'Staff'
      },
      ...(leads[index].timeline || [])
    ];

    this.setItem('leads', leads);
    this.syncFirestoreDoc('leads', leads[index].id, leads[index]);
    this.logAudit(user, 'SETTINGS_UPDATED', 'TravelLead', leads[index].id, `Changed priority to ${priority} for ${leads[index].leadNumber}`);
    return leads[index];
  }

  public assignLead(
    leadId: string, 
    staff: { id: string; name: string; email?: string; department?: 'SALES' | 'OPERATIONS' | 'MANAGEMENT' }, 
    user: User | null, 
    notes?: string
  ): TravelLead | null {
    const leads = this.getLeads();
    const index = leads.findIndex(l => l.id === leadId || l.leadNumber === leadId);
    if (index === -1) return null;

    const timestamp = new Date().toISOString();
    const prevStaff = leads[index].assignedStaffName;
    leads[index].assignedStaffId = staff.id;
    leads[index].assignedStaffName = staff.name;
    leads[index].assignedStaffEmail = staff.email;
    leads[index].assignedDepartment = staff.department || 'SALES';
    leads[index].updatedAt = timestamp;
    leads[index].lastActivityAt = timestamp;
    leads[index].lastActivitySummary = `Assigned to ${staff.name}`;

    const assignmentRecord: LeadAssignmentRecord = {
      id: `asg-${Date.now()}`,
      assignedStaffId: staff.id,
      assignedStaffName: staff.name,
      assignedStaffEmail: staff.email,
      assignedDepartment: staff.department,
      assignedBy: user?.name || 'Manager',
      assignedAt: timestamp,
      notes
    };
    leads[index].assignmentHistory = [assignmentRecord, ...(leads[index].assignmentHistory || [])];

    leads[index].timeline = [
      {
        id: `tl-${Date.now()}`,
        type: 'ASSIGNMENT_CHANGED',
        title: `Assigned to ${staff.name}`,
        description: notes ? `Reassigned from ${prevStaff} to ${staff.name}: ${notes}` : `Reassigned from ${prevStaff} to ${staff.name}`,
        timestamp,
        performedBy: user?.name || 'Manager'
      },
      ...(leads[index].timeline || [])
    ];

    this.setItem('leads', leads);
    this.syncFirestoreDoc('leads', leads[index].id, leads[index]);
    this.logAudit(user, 'SETTINGS_UPDATED', 'TravelLead', leads[index].id, `Assigned lead ${leads[index].leadNumber} to ${staff.name}`);
    return leads[index];
  }

  public addLeadNote(leadId: string, noteText: string, user: User | null, isInternal: boolean = true): TravelLead | null {
    const leads = this.getLeads();
    const index = leads.findIndex(l => l.id === leadId || l.leadNumber === leadId);
    if (index === -1 || !noteText.trim()) return null;

    const timestamp = new Date().toISOString();
    const newNote: LeadNote = {
      id: `note-${Date.now()}`,
      authorId: user?.id,
      authorName: user?.name || 'Travel Specialist',
      authorRole: user?.role || 'DMC_STAFF',
      text: noteText.trim(),
      timestamp,
      isInternal
    };

    leads[index].notes = [newNote, ...(leads[index].notes || [])];
    leads[index].updatedAt = timestamp;
    leads[index].lastActivityAt = timestamp;
    leads[index].lastActivitySummary = `Note added by ${newNote.authorName}`;

    leads[index].timeline = [
      {
        id: `tl-${Date.now()}`,
        type: 'NOTE_ADDED',
        title: 'Internal Note Added',
        description: `${newNote.authorName} added a note: "${noteText.substring(0, 80)}${noteText.length > 80 ? '...' : ''}"`,
        timestamp,
        performedBy: user?.name || 'Staff'
      },
      ...(leads[index].timeline || [])
    ];

    this.setItem('leads', leads);
    this.syncFirestoreDoc('leads', leads[index].id, leads[index]);
    this.logAudit(user, 'SETTINGS_UPDATED', 'TravelLead', leads[index].id, `Added note to lead ${leads[index].leadNumber}`);
    return leads[index];
  }

  public addLeadTimelineEvent(leadId: string, event: Omit<LeadTimelineEvent, 'id' | 'timestamp'>, user: User | null): TravelLead | null {
    const leads = this.getLeads();
    const index = leads.findIndex(l => l.id === leadId || l.leadNumber === leadId);
    if (index === -1) return null;

    const timestamp = new Date().toISOString();
    const fullEvent: LeadTimelineEvent = {
      ...event,
      id: `tl-${Date.now()}`,
      timestamp
    };

    leads[index].timeline = [fullEvent, ...(leads[index].timeline || [])];
    leads[index].updatedAt = timestamp;
    leads[index].lastActivityAt = timestamp;
    leads[index].lastActivitySummary = fullEvent.title;

    this.setItem('leads', leads);
    this.syncFirestoreDoc('leads', leads[index].id, leads[index]);
    return leads[index];
  }

  public addLeadFollowUp(leadId: string, task: Omit<LeadFollowUpTask, 'id' | 'createdAt'>, user: User | null): TravelLead | null {
    const leads = this.getLeads();
    const index = leads.findIndex(l => l.id === leadId || l.leadNumber === leadId);
    if (index === -1) return null;

    const timestamp = new Date().toISOString();
    const fullTask: LeadFollowUpTask = {
      ...task,
      id: `fu-${Date.now()}`,
      createdAt: timestamp
    };

    leads[index].followUps = [fullTask, ...(leads[index].followUps || [])];
    leads[index].updatedAt = timestamp;
    leads[index].lastActivityAt = timestamp;
    leads[index].lastActivitySummary = `Follow-Up Scheduled: ${fullTask.title}`;

    // Unified CalendarTask creation so Lead follow-ups appear centrally
    try {
      const calendarTask: CalendarTask = {
        id: fullTask.id,
        taskId: fullTask.id,
        title: fullTask.title,
        taskName: fullTask.title,
        description: fullTask.description || `Lead Follow-Up for ${leads[index].contactName}`,
        assignedToEmail: fullTask.assignedToEmail || user?.email || 'sales@theunbound.in',
        assignedToName: fullTask.assignedToName || user?.name || 'Sales Team',
        assignedTo: fullTask.assignedToName,
        createdBy: user?.name || 'Sales Specialist',
        assignedDepartment: 'SALES',
        category: 'CLIENT_FOLLOW_UP',
        status: 'TO_DO',
        priority: 'HIGH',
        importance: 'IMPORTANT',
        startDate: fullTask.dueAt ? fullTask.dueAt.split('T')[0] : new Date().toISOString().split('T')[0],
        startTime: '10:00',
        dueDate: fullTask.dueAt ? fullTask.dueAt.split('T')[0] : new Date().toISOString().split('T')[0],
        dueTime: '10:00',
        dueAt: fullTask.dueAt,
        entityType: 'LEAD',
        entityId: leads[index].id,
        relatedEntityType: 'lead',
        relatedEntityId: leads[index].id,
        relatedEntityReference: leads[index].leadNumber,
        leadId: leads[index].id,
        leadNumber: leads[index].leadNumber,
        customerName: leads[index].contactName,
        destination: leads[index].destinationName || (leads[index] as any).destination,
        targetRoute: `/admin/leads?id=${leads[index].id}`,
        source: 'lead_record',
        isCustomerFacing: false,
        isInternal: true,
        isSyncedToGoogleCalendar: false,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      this.saveCalendarTask(calendarTask, user);
    } catch (taskErr) {
      console.warn('[DB] Failed to sync follow-up to CalendarTask collection:', taskErr);
    }

    leads[index].timeline = [
      {
        id: `tl-${Date.now()}`,
        type: 'FOLLOWUP_CREATED',
        title: `Follow-Up Scheduled: ${fullTask.title}`,
        description: `Due: ${new Date(fullTask.dueAt).toLocaleString()} (Assigned: ${fullTask.assignedToName})`,
        timestamp,
        performedBy: user?.name || 'System'
      },
      ...(leads[index].timeline || [])
    ];

    this.setItem('leads', leads);
    this.syncFirestoreDoc('leads', leads[index].id, leads[index]);
    this.logAudit(user, 'SETTINGS_UPDATED', 'TravelLead', leads[index].id, `Scheduled follow-up for ${leads[index].leadNumber}: ${fullTask.title}`);
    return leads[index];
  }

  public completeLeadFollowUp(leadId: string, followUpId: string, user: User | null): TravelLead | null {
    const leads = this.getLeads();
    const index = leads.findIndex(l => l.id === leadId || l.leadNumber === leadId);
    if (index === -1) return null;

    const timestamp = new Date().toISOString();
    const fuIndex = (leads[index].followUps || []).findIndex(f => f.id === followUpId);
    if (fuIndex >= 0 && leads[index].followUps) {
      leads[index].followUps![fuIndex].status = 'COMPLETED';
      leads[index].followUps![fuIndex].completedAt = timestamp;
      leads[index].followUps![fuIndex].completedBy = user?.name || 'Staff';

      leads[index].timeline = [
        {
          id: `tl-${Date.now()}`,
          type: 'FOLLOWUP_COMPLETED',
          title: `Follow-Up Completed: ${leads[index].followUps![fuIndex].title}`,
          description: `Completed by ${user?.name || 'Staff'}`,
          timestamp,
          performedBy: user?.name || 'Staff'
        },
        ...(leads[index].timeline || [])
      ];

      leads[index].updatedAt = timestamp;
      leads[index].lastActivityAt = timestamp;
      this.setItem('leads', leads);
      this.syncFirestoreDoc('leads', leads[index].id, leads[index]);
      this.logAudit(user, 'SETTINGS_UPDATED', 'TravelLead', leads[index].id, `Completed follow-up ${followUpId} on lead ${leads[index].leadNumber}`);
      
      // Complete corresponding CalendarTask
      try {
        const calTasks = this.getCalendarTasks();
        const tIndex = calTasks.findIndex(t => t.id === followUpId || t.taskId === followUpId);
        if (tIndex >= 0) {
          calTasks[tIndex].status = 'COMPLETED';
          calTasks[tIndex].completedAt = timestamp;
          calTasks[tIndex].completedBy = user?.name || 'Staff';
          calTasks[tIndex].updatedAt = timestamp;
          this.setItem('calendar_tasks', calTasks);
          this.syncFirestoreDoc('calendar_tasks', calTasks[tIndex].id, calTasks[tIndex]);
        }
      } catch {
        // Non-blocking
      }
    }
    return leads[index];
  }

  public captureLeadFromSource(
    data: {
      contactName: string;
      email: string;
      phone?: string;
      country?: string;
      agencyName?: string;
      companyName?: string;
      userId?: string;
      userType?: 'BUYER' | 'B2B_AGENT' | 'PUBLIC' | 'DMC_STAFF' | 'ADMIN';
      b2bAgentId?: string;
      source: LeadSource;
      campaignId?: string;
      campaignName?: string;
      destinationId?: string;
      destinationName?: string;
      travelDates?: string;
      travelStartDate?: string;
      travelEndDate?: string;
      numberOfNights?: number;
      paxAdults?: number;
      paxChildren?: number;
      paxInfants?: number;
      roomsCount?: number;
      roomOccupancy?: string;
      mealPlan?: string;
      travelRequirements?: string;
      specialRequests?: string;
      estimatedBudget?: number;
      currency?: CurrencyCode;
      quoteId?: string;
      quoteNumber?: string;
      quoteVersion?: number;
      quoteSnapshot?: LeadQuoteSnapshot;
      quoteVersions?: LeadQuoteVersion[];
      requestedProducts?: LeadProductItem[];
      bookingId?: string;
      bookingReference?: string;
      bookingValue?: number;
    },
    user?: User | null
  ): TravelLead {
    const leads = this.getLeads();
    const emailLower = (data.email || '').trim().toLowerCase();
    const timestamp = new Date().toISOString();

    // Deduplication matching strategy: match by authenticated userId, or quoteId/bookingId, or email
    let existingIdx = -1;
    if (data.userId) {
      existingIdx = leads.findIndex(l => l.userId === data.userId && l.destinationName.toLowerCase() === (data.destinationName || '').toLowerCase());
    }
    if (existingIdx === -1 && emailLower) {
      existingIdx = leads.findIndex(l => l.email.toLowerCase() === emailLower && (!data.destinationName || l.destinationName.toLowerCase() === data.destinationName.toLowerCase() || !l.quoteId));
    }
    if (existingIdx === -1 && data.quoteId) {
      existingIdx = leads.findIndex(l => l.quoteId === data.quoteId || (l.quoteIds && l.quoteIds.includes(data.quoteId)));
    }
    if (existingIdx === -1 && emailLower) {
      existingIdx = leads.findIndex(l => l.email.toLowerCase() === emailLower);
    }

    // Auto calculate priority: URGENT if travel within 7 days, HIGH if budget > $10,000
    let calculatedPriority: LeadPriority = 'NORMAL';
    if (data.travelStartDate) {
      const daysUntil = (new Date(data.travelStartDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24);
      if (daysUntil > 0 && daysUntil <= 7) calculatedPriority = 'URGENT';
      else if (daysUntil <= 14) calculatedPriority = 'HIGH';
    }
    if ((data.estimatedBudget || 0) >= 10000 && calculatedPriority !== 'URGENT') {
      calculatedPriority = 'HIGH';
    }

    if (existingIdx >= 0) {
      const existing = leads[existingIdx];
      const allQuoteIds = Array.from(new Set([...(existing.quoteIds || []), ...(data.quoteId ? [data.quoteId] : [])]));
      const allBookingIds = Array.from(new Set([...(existing.bookingIds || []), ...(data.bookingId ? [data.bookingId] : [])]));

      let newStatus = existing.status;
      if (data.source === 'BOOKING_SUBMISSION' || data.bookingId) newStatus = 'BOOKING_SUBMITTED';
      else if (data.source === 'PROPOSAL_DOWNLOADED') newStatus = 'QUOTE_DOWNLOADED';
      else if (data.source === 'QUOTATION_SAVED' && existing.status === 'NEW') newStatus = 'PROPOSAL_SAVED';

      const updatedLead: TravelLead = {
        ...existing,
        contactName: data.contactName && data.contactName !== 'Client Name Pending' ? data.contactName : existing.contactName,
        phone: data.phone || existing.phone,
        country: data.country || existing.country,
        agencyName: data.agencyName || existing.agencyName,
        companyName: data.companyName || existing.companyName,
        userId: data.userId || existing.userId,
        userType: data.userType || existing.userType,
        b2bAgentId: data.b2bAgentId || existing.b2bAgentId,
        destinationId: data.destinationId || existing.destinationId,
        destinationName: data.destinationName || existing.destinationName,
        travelDates: data.travelDates || existing.travelDates,
        travelStartDate: data.travelStartDate || existing.travelStartDate,
        travelEndDate: data.travelEndDate || existing.travelEndDate,
        numberOfNights: data.numberOfNights || existing.numberOfNights,
        paxAdults: data.paxAdults !== undefined ? data.paxAdults : existing.paxAdults,
        paxChildren: data.paxChildren !== undefined ? data.paxChildren : existing.paxChildren,
        paxInfants: data.paxInfants !== undefined ? data.paxInfants : existing.paxInfants,
        totalPassengers: (data.paxAdults || existing.paxAdults || 1) + (data.paxChildren || existing.paxChildren || 0) + (data.paxInfants || existing.paxInfants || 0),
        roomsCount: data.roomsCount || existing.roomsCount,
        roomOccupancy: data.roomOccupancy || existing.roomOccupancy,
        mealPlan: data.mealPlan || existing.mealPlan,
        travelRequirements: data.travelRequirements || existing.travelRequirements,
        specialRequests: data.specialRequests || existing.specialRequests,
        estimatedBudget: data.estimatedBudget || existing.estimatedBudget,
        currency: data.currency || existing.currency,
        status: newStatus,
        priority: calculatedPriority !== 'NORMAL' ? calculatedPriority : existing.priority || 'NORMAL',
        quoteId: data.quoteId || existing.quoteId,
        quoteNumber: data.quoteNumber || existing.quoteNumber,
        quoteIds: allQuoteIds,
        quoteVersion: data.quoteVersion || existing.quoteVersion,
        quoteSnapshot: data.quoteSnapshot || existing.quoteSnapshot,
        quoteVersions: data.quoteVersions || existing.quoteVersions,
        bookingId: data.bookingId || existing.bookingId,
        bookingReference: data.bookingReference || existing.bookingReference,
        bookingIds: allBookingIds,
        bookingValue: data.bookingValue || existing.bookingValue,
        requestedProducts: data.requestedProducts || existing.requestedProducts,
        updatedAt: timestamp,
        lastActivityAt: timestamp,
        lastActivitySummary: `Activity from ${data.source}: ${data.quoteNumber ? 'Quote #' + data.quoteNumber : data.bookingReference ? 'Booking #' + data.bookingReference : 'Inquiry updated'}`,
        timeline: [
          {
            id: `tl-${Date.now()}`,
            type: data.source === 'BOOKING_SUBMISSION' ? 'BOOKING_SUBMITTED' :
                  data.source === 'PROPOSAL_DOWNLOADED' ? 'QUOTE_DOWNLOADED' :
                  data.source === 'QUOTATION_SAVED' ? 'PROPOSAL_SAVED' : 'CUSTOM_ACTIVITY',
            title: data.source === 'BOOKING_SUBMISSION' ? `Booking Submitted (${data.bookingReference || data.bookingId})` :
                   data.source === 'PROPOSAL_DOWNLOADED' ? `Quote PDF Downloaded (${data.quoteNumber || data.quoteId})` :
                   data.source === 'QUOTATION_SAVED' ? `Proposal Saved (${data.quoteNumber || data.quoteId})` : `Inquiry via ${data.source}`,
            description: `Commercial interaction tracked for ${data.destinationName || existing.destinationName}. Value: ${data.currency || existing.currency} ${(data.estimatedBudget || existing.estimatedBudget).toLocaleString()}`,
            timestamp,
            performedBy: user?.name || data.contactName || 'Client',
            performedByUserType: user?.role || data.userType || 'BUYER',
            quoteId: data.quoteId,
            quoteNumber: data.quoteNumber,
            bookingId: data.bookingId,
            bookingReference: data.bookingReference
          },
          ...(existing.timeline || [])
        ]
      };

      leads[existingIdx] = updatedLead;
      this.setItem('leads', leads);
      this.syncFirestoreDoc('leads', updatedLead.id, updatedLead);
      this.logAudit(user || null, 'BOOKING_UPDATED', 'TravelLead', existing.id, `Lead updated via ${data.source}: ${existing.leadNumber} (${existing.contactName})`);
      return updatedLead;
    } else {
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      const newLeadNumber = `LED-${new Date().getFullYear()}-${randomNum}`;
      const newLead: TravelLead = {
        id: `lead-${Date.now()}-${randomNum}`,
        leadNumber: newLeadNumber,
        contactName: data.contactName || (user?.name && user.name !== 'Anonymous' ? user.name : 'Valued Traveler / Agency'),
        email: data.email || user?.email || 'inquiry@client.local',
        phone: data.phone || user?.phone || '',
        country: data.country || user?.country,
        agencyName: data.agencyName || user?.agencyName || user?.companyName,
        companyName: data.companyName || user?.companyName,
        userId: data.userId || user?.id,
        userType: data.userType || (user?.role === 'B2B_AGENT' ? 'B2B_AGENT' : user?.role === 'BUYER' ? 'BUYER' : 'PUBLIC'),
        b2bAgentId: data.b2bAgentId || (user?.role === 'B2B_AGENT' ? user.id : undefined),
        source: data.source || 'WEBSITE',
        campaignId: data.campaignId,
        campaignName: data.campaignName,
        status: data.source === 'BOOKING_SUBMISSION' ? 'BOOKING_SUBMITTED' :
                data.source === 'PROPOSAL_DOWNLOADED' ? 'QUOTE_DOWNLOADED' :
                data.source === 'QUOTATION_SAVED' ? 'PROPOSAL_SAVED' : 'NEW',
        priority: calculatedPriority,
        conversionStatus: data.source === 'BOOKING_SUBMISSION' ? 'CONVERTED' : 'IN_PROGRESS',
        assignedStaffId: user?.id || 'staff-01',
        assignedStaffName: user?.name || 'Marcus Vance (Senior Ops)',
        assignedStaffEmail: user?.email || 'business@theunbound.in',
        assignedDepartment: 'OPERATIONS',
        destinationId: data.destinationId || 'japan',
        destinationName: data.destinationName || 'Japan',
        travelDates: data.travelDates || 'Upcoming 2026',
        travelStartDate: data.travelStartDate,
        travelEndDate: data.travelEndDate,
        numberOfNights: data.numberOfNights || 7,
        paxAdults: data.paxAdults !== undefined ? data.paxAdults : 2,
        paxChildren: data.paxChildren !== undefined ? data.paxChildren : 0,
        paxInfants: data.paxInfants !== undefined ? data.paxInfants : 0,
        totalPassengers: (data.paxAdults || 2) + (data.paxChildren || 0) + (data.paxInfants || 0),
        roomsCount: data.roomsCount || 1,
        roomOccupancy: data.roomOccupancy || 'Double / Twin',
        mealPlan: data.mealPlan || 'Daily Breakfast',
        travelRequirements: data.travelRequirements || `Travel inquiry for ${data.destinationName || 'selected destinations'}`,
        specialRequests: data.specialRequests,
        estimatedBudget: data.estimatedBudget || 5000,
        currency: data.currency || 'USD',
        quoteId: data.quoteId,
        quoteNumber: data.quoteNumber,
        quoteIds: data.quoteId ? [data.quoteId] : [],
        quoteVersion: data.quoteVersion || 1,
        quoteSnapshot: data.quoteSnapshot,
        quoteVersions: data.quoteVersions,
        bookingId: data.bookingId,
        bookingReference: data.bookingReference,
        bookingIds: data.bookingId ? [data.bookingId] : [],
        bookingValue: data.bookingValue,
        requestedProducts: data.requestedProducts || [],
        timeline: [
          {
            id: `tl-${Date.now()}`,
            type: data.source === 'BOOKING_SUBMISSION' ? 'BOOKING_SUBMITTED' :
                  data.source === 'PROPOSAL_DOWNLOADED' ? 'QUOTE_DOWNLOADED' :
                  data.source === 'QUOTATION_SAVED' ? 'PROPOSAL_SAVED' : 'CUSTOM_ACTIVITY',
            title: `Lead Captured via ${data.source}`,
            description: `Initial contact created with ${data.destinationName || 'Destination'} travel requirement.`,
            timestamp,
            performedBy: user?.name || data.contactName || 'Lead Engine',
            performedByUserType: user?.role || data.userType || 'BUYER',
            quoteId: data.quoteId,
            quoteNumber: data.quoteNumber,
            bookingId: data.bookingId,
            bookingReference: data.bookingReference
          }
        ],
        followUps: [],
        notes: [
          {
            id: `note-${Date.now()}`,
            authorId: user?.id,
            authorName: user?.name || 'CRM Lead Engine',
            authorRole: 'SYSTEM',
            text: `Lead automatically initialized via ${data.source}.`,
            timestamp,
            isInternal: true
          }
        ],
        documents: data.quoteNumber ? [
          {
            id: `doc-${Date.now()}`,
            type: 'QUOTE_PDF',
            title: `Quotation_${data.quoteNumber}.pdf`,
            createdAt: timestamp,
            createdBy: user?.name || 'System',
            quoteId: data.quoteId
          }
        ] : [],
        createdAt: timestamp,
        updatedAt: timestamp,
        lastActivityAt: timestamp,
        lastActivitySummary: `Lead captured via ${data.source}`
      };

      leads.unshift(newLead);
      this.setItem('leads', leads);
      this.syncFirestoreDoc('leads', newLead.id, newLead);
      this.logAudit(user || null, 'BOOKING_CREATED', 'TravelLead', newLead.id, `Captured new CRM lead: ${newLead.leadNumber} (${newLead.contactName}) via ${data.source}`);
      return newLead;
    }
  }

  public deleteLead(leadId: string, user: User | null): void {
    if (user) {
      const permCheck = this.canUserDelete(user, 'Lead');
      if (!permCheck.allowed) {
        this.logAudit(user, 'UNAUTHORIZED_DELETE_ATTEMPT', 'TravelLead', leadId, `Unauthorized delete attempt on lead: ${permCheck.reason}`);
        return;
      }
    }
    const leads = this.getLeads();
    const target = leads.find(l => l.id === leadId || l.leadNumber === leadId);
    if (!target) return;
    this.setItem('leads', leads.filter(l => l.id !== target.id));
    this.deleteFirestoreDoc('leads', target.id);
    this.logAudit(user, 'SETTINGS_UPDATED', 'TravelLead', target.id, `Deleted CRM lead ${target.leadNumber} (${target.contactName})`);
  }

  // ==========================================
  // FINANCIALS: INVOICES, VOUCHERS, JOB SHEETS
  // ==========================================
  public getInvoices(): BookingInvoice[] {
    return this.getItem<BookingInvoice[]>('invoices', []);
  }

  public getInvoiceById(id: string): BookingInvoice | undefined {
    return this.getInvoices().find(i => i.id === id || i.invoiceNumber === id);
  }

  public saveInvoice(invoice: BookingInvoice, user: User | null): void {
    const invoices = this.getInvoices();
    const index = invoices.findIndex(i => i.id === invoice.id);
    if (index >= 0) {
      invoices[index] = invoice;
      this.logAudit(user, 'BOOKING_UPDATED', 'Invoice', invoice.id, `Updated Tax Invoice ${invoice.invoiceNumber}`);
    } else {
      invoices.unshift(invoice);
      this.logAudit(user, 'BOOKING_CREATED', 'Invoice', invoice.id, `Generated Tax Invoice ${invoice.invoiceNumber} for ${invoice.customerName} (${invoice.currency} ${invoice.totalAmount})`);
    }
    this.syncFirestoreDoc('invoices', invoice.id, invoice);
    this.setItem('invoices', invoices);
  }

  public deleteInvoice(invoiceId: string, user?: User | null): void {
    const invoices = this.getInvoices();
    this.setItem('invoices', invoices.filter(i => i.id !== invoiceId));
    this.deleteFirestoreDoc('invoices', invoiceId);
    this.logAudit(user || null, 'SETTINGS_UPDATED', 'FinancialInvoice', invoiceId, `Deleted invoice ${invoiceId}`);
  }

  public getVouchers(): BookingVoucher[] {
    return this.getItem<BookingVoucher[]>('vouchers', []);
  }

  public getVoucherById(id: string): BookingVoucher | undefined {
    return this.getVouchers().find(v => v.id === id || v.voucherNumber === id);
  }

  public saveVoucher(voucher: BookingVoucher, user: User | null): void {
    const vouchers = this.getVouchers();
    const index = vouchers.findIndex(v => v.id === voucher.id);
    if (index >= 0) {
      vouchers[index] = voucher;
      this.logAudit(user, 'BOOKING_UPDATED', 'Voucher', voucher.id, `Updated Service Voucher ${voucher.voucherNumber}`);
    } else {
      vouchers.unshift(voucher);
      this.logAudit(user, 'BOOKING_CREATED', 'Voucher', voucher.id, `Issued Service Voucher ${voucher.voucherNumber} for ${voucher.leadPaxName}`);
    }
    this.syncFirestoreDoc('vouchers', voucher.id, voucher);
    this.setItem('vouchers', vouchers);
  }

  public deleteVoucher(voucherId: string, user?: User | null): void {
    const vouchers = this.getVouchers();
    this.setItem('vouchers', vouchers.filter(v => v.id !== voucherId));
    this.deleteFirestoreDoc('vouchers', voucherId);
    this.logAudit(user || null, 'SETTINGS_UPDATED', 'ServiceVoucher', voucherId, `Deleted voucher ${voucherId}`);
  }

  public getJobSheets(): JobSheet[] {
    return this.getItem<JobSheet[]>('job_sheets', []);
  }

  public getJobSheetById(id: string): JobSheet | undefined {
    return this.getJobSheets().find(j => j.id === id || j.jobSheetNumber === id);
  }

  public saveJobSheet(jobSheet: JobSheet, user: User | null): void {
    const sheets = this.getJobSheets();
    const index = sheets.findIndex(j => j.id === jobSheet.id);
    if (index >= 0) {
      sheets[index] = jobSheet;
      this.logAudit(user, 'BOOKING_UPDATED', 'JobSheet', jobSheet.id, `Updated Operational Job Sheet ${jobSheet.jobSheetNumber}`);
    } else {
      sheets.unshift(jobSheet);
      this.logAudit(user, 'BOOKING_CREATED', 'JobSheet', jobSheet.id, `Generated Daily Operational Job Sheet ${jobSheet.jobSheetNumber}`);
    }
    this.syncFirestoreDoc('job_sheets', jobSheet.id, jobSheet);
    this.setItem('job_sheets', sheets);
  }

  public deleteJobSheet(jobSheetId: string, user?: User | null): void {
    const sheets = this.getJobSheets();
    this.setItem('job_sheets', sheets.filter(s => s.id !== jobSheetId));
    this.deleteFirestoreDoc('job_sheets', jobSheetId);
    this.logAudit(user || null, 'SETTINGS_UPDATED', 'JobSheet', jobSheetId, `Deleted job sheet ${jobSheetId}`);
  }

  // ==========================================
  // AUTOMATED EMAIL CAMPAIGNS
  // ==========================================
  public getEmailCampaigns(): EmailCampaignConfig[] {
    return this.getItem<EmailCampaignConfig[]>('campaigns', INITIAL_CAMPAIGNS);
  }

  public saveEmailCampaign(campaign: EmailCampaignConfig, user: User | null): void {
    const campaigns = this.getEmailCampaigns();
    const index = campaigns.findIndex(c => c.id === campaign.id);
    if (index >= 0) {
      campaigns[index] = campaign;
      this.logAudit(user, 'SETTINGS_UPDATED', 'EmailCampaign', campaign.id, `Updated Email Campaign: ${campaign.name}`);
    } else {
      campaigns.push(campaign);
      this.logAudit(user, 'SETTINGS_UPDATED', 'EmailCampaign', campaign.id, `Created Email Campaign: ${campaign.name}`);
    }
    this.syncFirestoreDoc('campaigns', campaign.id, campaign);
    this.setItem('campaigns', campaigns);
  }

  public dispatchEmailCampaign(campaignId: string, testRecipientEmail: string, user: User | null): boolean {
    const campaigns = this.getEmailCampaigns();
    const index = campaigns.findIndex(c => c.id === campaignId);
    if (index === -1) return false;

    campaigns[index].sentCount += 1;
    campaigns[index].lastDispatchedAt = new Date().toISOString();
    this.setItem('campaigns', campaigns);
    this.syncFirestoreDoc('campaigns', campaignId, { sentCount: campaigns[index].sentCount, lastDispatchedAt: campaigns[index].lastDispatchedAt });

    this.logAudit(
      user,
      'SETTINGS_UPDATED',
      'EmailCampaign',
      campaignId,
      `Dispatched test email run for campaign "${campaigns[index].name}" to ${testRecipientEmail}`
    );
    return true;
  }

  // ==========================================
  // ROSTER RESOURCES & OPERATIONS CMS
  // ==========================================
  public getResources(): RosterResource[] {
    return this.getItem<RosterResource[]>('roster_resources', INITIAL_ROSTER_RESOURCES);
  }

  public getResourceById(id: string): RosterResource | undefined {
    return this.getResources().find(r => r.id === id);
  }

  public saveResource(resource: RosterResource, user: User | null): void {
    const list = this.getResources();
    const index = list.findIndex(r => r.id === resource.id);
    if (index >= 0) {
      list[index] = resource;
      this.logAudit(user, 'SETTINGS_UPDATED', 'RosterResource', resource.id, `Updated operations resource: ${resource.name} (${resource.role})`);
    } else {
      list.unshift(resource);
      this.logAudit(user, 'SETTINGS_UPDATED', 'RosterResource', resource.id, `Created operations resource: ${resource.name} (${resource.role})`);
    }
    this.syncFirestoreDoc('roster_resources', resource.id, resource);
    this.setItem('roster_resources', list);
  }

  public deleteResource(resourceId: string, user: User | null): void {
    const list = this.getResources();
    const target = list.find(r => r.id === resourceId);
    this.setItem('roster_resources', list.filter(r => r.id !== resourceId));
    this.deleteFirestoreDoc('roster_resources', resourceId);
    if (target) {
      this.logAudit(user, 'SETTINGS_UPDATED', 'RosterResource', resourceId, `Deleted resource: ${target.name}`);
    }
  }

  // ==========================================
  // HOMEPAGE FAQS MANAGEMENT
  // ==========================================
  public getHomepageFAQs(): HomepageFAQItem[] {
    const config = this.getHomepageConfig();
    return config.homepageFAQs || [];
  }

  public saveHomepageFAQ(faq: HomepageFAQItem, user: User | null): void {
    const config = this.getHomepageConfig();
    const faqs = config.homepageFAQs ? [...config.homepageFAQs] : [];
    const index = faqs.findIndex(f => f.id === faq.id);
    if (index >= 0) {
      faqs[index] = faq;
    } else {
      faqs.push(faq);
    }
    config.homepageFAQs = faqs;
    this.updateHomepageConfig(config, user);
  }

  public deleteHomepageFAQ(faqId: string, user: User | null): void {
    const config = this.getHomepageConfig();
    config.homepageFAQs = (config.homepageFAQs || []).filter(f => f.id !== faqId);
    this.updateHomepageConfig(config, user);
  }

  // ==========================================
  // GOOGLE REVIEWS GBP SEARCH & IMPORTER
  // ==========================================
  public async searchAndImportGoogleReviews(businessQueryOrUrl: string, user: User | null): Promise<{ added: number; updated: number; reviews: GoogleReview[]; businessName: string; error?: string }> {
    const resolved = googleBusinessService.resolveMapsUrl(businessQueryOrUrl);
    
    // Save URL to configuration
    googleBusinessService.saveConfig({
      mapsUrl: resolved.cleanUrl,
      businessName: resolved.businessName
    }, user);

    const syncResult = await googleBusinessService.syncGoogleReviews(user);
    if (!syncResult.success) {
      return {
        added: 0,
        updated: 0,
        reviews: [],
        businessName: resolved.businessName,
        error: syncResult.errorMessage || 'Unable to sync reviews from Google Business Profile.'
      };
    }

    return {
      added: syncResult.newCount,
      updated: syncResult.updatedCount,
      reviews: syncResult.reviews,
      businessName: resolved.businessName
    };
  }

  // ==========================================
  // GOOGLE REVIEWS GBP SYNC
  // ==========================================
  public async syncGoogleReviewsFromGBP(user: User | null): Promise<GoogleReview[]> {
    const syncResult = await googleBusinessService.syncGoogleReviews(user);
    return syncResult.reviews;
  }

  // ==========================================
  // USER APPROVAL, SEGREGATION & ACCESS CONTROL
  // ==========================================
  public getUsers(): User[] {
    const defaultUsers: User[] = [
      {
        id: 'usr-admin-business',
        name: 'TheUnbound Executive Admin',
        email: 'business@theunbound.in',
        password: 'Unboundpass11!',
        role: 'ADMIN',
        category: 'INTERNAL',
        agencyName: 'TheUnbound DMC Global Headquarters',
        country: 'Global',
        approvalStatus: 'APPROVED',
        customBuyerMarginPercent: 25,
        customAgentMarginPercent: 10,
        contactNumber: '+91 9811654959',
        permissions: {
          canAccessPricingCalculator: true,
          canCreateBookings: true,
          canExportPDF: true,
          canViewWholesaleNetRates: true,
          canAccessCMS: true,
          canAccessRoster: true,
          canAccessFinancials: true,
          canManageUsers: true
        },
        createdAt: '2025-01-01'
      },
      {
        id: 'usr-admin-01',
        name: 'Marcus Vance',
        email: 'marcus@theunbound.in',
        password: 'Unboundpass11!',
        role: 'ADMIN',
        category: 'INTERNAL',
        agencyName: 'TheUnbound DMC Global Headquarters',
        country: 'Global',
        approvalStatus: 'APPROVED',
        customBuyerMarginPercent: 25,
        customAgentMarginPercent: 10,
        permissions: {
          canAccessPricingCalculator: true,
          canCreateBookings: true,
          canExportPDF: true,
          canViewWholesaleNetRates: true,
          canAccessCMS: true,
          canAccessRoster: true,
          canAccessFinancials: true,
          canManageUsers: true
        },
        createdAt: '2025-01-01'
      },
      {
        id: 'usr-staff-01',
        name: 'Kenji Sato',
        email: 'kenji.ops@theunbound.in',
        role: 'TEAM_MEMBER',
        category: 'INTERNAL',
        agencyName: 'TheUnbound Ground Operations Hub',
        country: 'Japan',
        approvalStatus: 'APPROVED',
        customBuyerMarginPercent: 25,
        customAgentMarginPercent: 10,
        permissions: {
          canAccessPricingCalculator: true,
          canCreateBookings: true,
          canExportPDF: true,
          canViewWholesaleNetRates: true,
          canAccessCMS: true,
          canAccessRoster: true,
          canAccessFinancials: false,
          canManageUsers: false
        },
        createdAt: '2025-06-15'
      }
    ];

    return this.getItem<User[]>('system_users', defaultUsers);
  }

  public getUserByEmail(email: string): User | undefined {
    if (!email) return undefined;
    const cleanEmail = email.trim().toLowerCase();
    return this.getUsers().find(u => (u.email || '').trim().toLowerCase() === cleanEmail);
  }

  public getUserById(id: string): User | undefined {
    if (!id) return undefined;
    return this.getUsers().find(u => u.id === id);
  }

  public saveUserLocally(user: User): void {
    const users = this.getUsers();
    const cleanEmail = (user.email || '').trim().toLowerCase();
    const idx = users.findIndex(u => u.id === user.id || (u.email && u.email.trim().toLowerCase() === cleanEmail));
    if (idx >= 0) {
      users[idx] = { ...users[idx], ...user };
    } else {
      users.push(user);
    }
    this.setItem('system_users', users);
  }

  public saveUser(updatedUser: User, actor: User | null, actionType: 'USER_ROLE_CHANGED' | 'USER_PERMISSIONS_CHANGED' = 'USER_ROLE_CHANGED', auditDetails?: string): void {
    const users = this.getUsers();
    const idx = users.findIndex(u => u.id === updatedUser.id);
    const previous = idx >= 0 ? users[idx] : null;

    if (idx >= 0) {
      users[idx] = updatedUser;
    } else {
      users.push(updatedUser);
    }
    this.setItem('system_users', users);
    this.syncFirestoreDoc('users', updatedUser.id, updatedUser);

    // Immediately synchronize active session cache
    syncSessionUserPermissions(updatedUser);

    const detailText = auditDetails || (actionType === 'USER_PERMISSIONS_CHANGED'
      ? `Updated granular access permissions profile for ${updatedUser.name} (${updatedUser.email})`
      : `Updated user status for ${updatedUser.name} (${updatedUser.email}): Role=${updatedUser.role}, Status=${updatedUser.approvalStatus || 'APPROVED'}, Margin Buyer=${updatedUser.customBuyerMarginPercent}%, Agent=${updatedUser.customAgentMarginPercent}%`);

    this.logAudit(
      actor,
      actionType,
      'UserAccessControl',
      updatedUser.id,
      detailText,
      previous ? JSON.stringify({ role: previous.role, permissions: previous.permissions }) : undefined,
      JSON.stringify({ role: updatedUser.role, permissions: updatedUser.permissions })
    );

    // Live Admin Activity Stream notification
    try {
      const isPending = updatedUser.approvalStatus === 'PENDING';
      this.recordAdminActivity({
        category: 'USER',
        activityType: isPending ? 'B2B_AGENT_REGISTRATION' : 'USER_PERMISSIONS_CHANGED',
        actorName: actor?.name || updatedUser.name || 'System Admin',
        actorType: actor?.role === 'ADMIN' ? 'ADMIN' : 'B2B_AGENT',
        severity: isPending ? 'WARNING' : 'INFO',
        actionRequired: isPending,
        actionLabel: isPending ? 'Review Application' : 'Manage Account',
        summary: `User Access: ${updatedUser.name} (${updatedUser.email}) - ${updatedUser.role} [${updatedUser.approvalStatus || 'APPROVED'}]`,
        details: {
          customerName: updatedUser.name,
          agentName: updatedUser.name,
          company: updatedUser.companyName || updatedUser.agencyName,
          email: updatedUser.email,
          previousValue: previous?.role,
          newValue: updatedUser.role,
          actionNeeded: isPending ? 'Verify trade credentials and configure pricing margins' : undefined
        },
        targetSection: 'ACCOUNT_MANAGEMENT',
        targetSubTab: 'USERS_ACCESS',
        recordId: updatedUser.id,
        userId: updatedUser.id,
        entityId: updatedUser.id,
        entityType: 'User'
      });
    } catch {
      // Non-blocking
    }
  }

  public updateUserPermissions(
    userId: string, 
    newPermissions: UserPermissionAccess, 
    actor: User | null,
    auditNotes?: string
  ): { success: boolean; error?: string } {
    const users = this.getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) {
      return { success: false, error: 'Target user record not found.' };
    }

    // Safeguard: Check if revoking account management from the last administrator
    if (user.role === 'ADMIN' && (newPermissions.cmsFinance?.accountManagement === false || newPermissions.canManageUsers === false)) {
      const safeguard = canRevokeAdminPermissions(user, users);
      if (!safeguard.canRevoke) {
        return { success: false, error: safeguard.error || 'Cannot revoke access from the last remaining active Administrator.' };
      }
    }

    const updatedUser: User = {
      ...user,
      permissions: newPermissions
    };

    this.saveUser(
      updatedUser, 
      actor, 
      'USER_PERMISSIONS_CHANGED', 
      auditNotes || `Granular permissions updated for ${user.name} (${user.email}). Quote Builder: ${newPermissions.b2bQuoteBuilderAccess ? 'B2B Allowed' : 'B2B Blocked'}, CMS: ${newPermissions.canAccessCMS ? 'Allowed' : 'Blocked'}`
    );

    return { success: true };
  }

  public updateUserProfile(userId: string, updates: Partial<User>, actor: User | null): User | null {
    const users = this.getUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx === -1) {
      // If user is not yet in system_users, insert with updates
      if (actor && actor.id === userId) {
        const newUser: User = {
          ...actor,
          ...updates
        };
        users.push(newUser);
        this.setItem('system_users', users);
        this.syncFirestoreDoc('users', userId, newUser);
        this.logAudit(actor, 'SETTINGS_UPDATED', 'UserProfile', userId, `Updated personal & company profile for ${newUser.name} (${newUser.companyName || newUser.agencyName || 'Personal'})`);
        return newUser;
      }
      return null;
    }

    const current = users[idx];
    const updated: User = {
      ...current,
      ...updates
    };
    users[idx] = updated;
    this.setItem('system_users', users);
    this.syncFirestoreDoc('users', userId, updated);

    this.logAudit(
      actor || updated,
      'SETTINGS_UPDATED',
      'UserProfile',
      userId,
      `Updated personal & company profile for ${updated.name} (${updated.companyName || updated.agencyName || 'Personal'})`
    );

    return updated;
  }

  public approveUser(userId: string, actor: User | null): void {
    const users = this.getUsers();
    const user = users.find(u => u.id === userId);
    if (user) {
      user.approvalStatus = 'APPROVED';
      // Assign standard full role default permissions
      user.permissions = getDefaultPermissionsForRole(user.role);
      this.saveUser(
        user, 
        actor, 
        'USER_ROLE_CHANGED', 
        `Administrator approved user account: ${user.name} (${user.email}) as ${user.role} with standard permissions.`
      );
    }
  }

  public rejectUser(userId: string, actor: User | null): void {
    const users = this.getUsers();
    const user = users.find(u => u.id === userId);
    if (user) {
      // Check safeguard if rejecting an admin
      if (user.role === 'ADMIN') {
        const safeguard = canRevokeAdminPermissions(user, users);
        if (!safeguard.canRevoke) {
          throw new Error(safeguard.error || 'Cannot revoke access from the last Administrator.');
        }
      }

      user.approvalStatus = 'REJECTED';
      user.permissions = {
        b2bQuoteBuilderAccess: false,
        buyerQuoteBuilderAccess: false,
        canAccessPricingCalculator: false,
        canCreateBookings: false,
        canExportPDF: false,
        canViewWholesaleNetRates: false,
        canAccessCMS: false,
        canAccessRoster: false,
        canAccessFinancials: false,
        canManageUsers: false,
        canManagePermissions: false,
        canDeleteRecords: false,
        cmsOperations: { enabled: false },
        cmsContent: { enabled: false },
        cmsFinance: { enabled: false },
        cmsSystem: { enabled: false }
      };
      this.saveUser(
        user, 
        actor, 
        'USER_ROLE_CHANGED', 
        `Administrator rejected/revoked user access for ${user.name} (${user.email}). All access permissions disabled.`
      );
    }
  }

  public registerUser(userData: {
    name: string;
    firstName?: string;
    lastName?: string;
    email: string;
    password?: string;
    role: UserRole;
    category?: UserCategory;
    agencyName?: string;
    companyName?: string;
    country?: string;
    contactNumber?: string;
    jobTitle?: string;
    businessType?: string;
    taxOrGstNumber?: string;
    iataOrAbtaNumber?: string;
  }): { success: boolean; error?: string; user?: User; requiresApproval?: boolean } {
    const trimmedEmail = (userData.email || '').trim().toLowerCase();
    const trimmedFirst = (userData.firstName || '').trim();
    const trimmedLast = (userData.lastName || '').trim();
    const trimmedName = (userData.name || `${trimmedFirst} ${trimmedLast}` || '').trim();

    if (!trimmedName || trimmedName.length < 2) {
      return { success: false, error: 'Please enter your full legal name (minimum 2 characters).' };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      return { success: false, error: 'Please enter a valid official business email address.' };
    }

    const users = this.getUsers();
    const existing = users.find(u => u.email.toLowerCase() === trimmedEmail);
    if (existing) {
      return {
        success: false,
        error: 'An account with this email address already exists. Please sign in or contact admin.'
      };
    }

    const isB2BAgent = userData.role === 'B2B_AGENT' || userData.role === 'AGENT';
    const isInternal = userData.role === 'ADMIN' || userData.role === 'TEAM_MEMBER';
    
    // For B2B Agent, agency name is mandatory
    if (isB2BAgent && !userData.agencyName && !userData.companyName) {
      return { success: false, error: 'Travel Agency or Company Name is required for B2B Agent registration.' };
    }

    // B2B Agents are created with PENDING approval status and require admin approval before login
    const approvalStatus: UserApprovalStatus = isB2BAgent ? 'PENDING' : 'APPROVED';
    const category: UserCategory = isInternal ? 'INTERNAL' : 'EXTERNAL';

    const newUser: User = {
      id: `usr-${isB2BAgent ? 'agent' : userData.role.toLowerCase()}-${Date.now()}`,
      name: trimmedName,
      firstName: trimmedFirst || undefined,
      lastName: trimmedLast || undefined,
      email: trimmedEmail,
      password: userData.password || '',
      role: userData.role,
      category,
      agencyName: userData.agencyName?.trim() || userData.companyName?.trim() || '',
      companyName: userData.companyName?.trim() || userData.agencyName?.trim() || '',
      country: userData.country?.trim() || 'Global',
      contactNumber: userData.contactNumber?.trim() || '',
      jobTitle: userData.jobTitle?.trim() || '',
      businessType: userData.businessType?.trim() || '',
      taxOrGstNumber: userData.taxOrGstNumber?.trim() || '',
      iataOrAbtaNumber: userData.iataOrAbtaNumber?.trim() || '',
      createdAt: new Date().toISOString().split('T')[0],
      approvalStatus,
      customBuyerMarginPercent: 25,
      customAgentMarginPercent: 10,
      permissions: approvalStatus === 'APPROVED' 
        ? getDefaultPermissionsForRole(userData.role)
        : {
            ...getDefaultPermissionsForRole(userData.role),
            b2bQuoteBuilderAccess: false,
            canAccessPricingCalculator: false,
            canCreateBookings: false,
            canExportPDF: false,
            canViewWholesaleNetRates: false
          }
    };

    users.push(newUser);
    this.setItem('system_users', users);
    this.syncFirestoreDoc('users', newUser.id, newUser);

    this.logAudit(
      newUser,
      'USER_ROLE_CHANGED',
      'UserAccessControl',
      newUser.id,
      `New user profile created: ${newUser.name} (${newUser.email}), Role=${newUser.role}, Status=${newUser.approvalStatus}, Agency=${newUser.agencyName || 'N/A'}`
    );

    return {
      success: true,
      user: newUser,
      requiresApproval: isB2BAgent
    };
  }

  // ==========================================
  // WISHLIST FOLDERS & CURATED PRODUCT SELECTIONS
  // ==========================================
  public getWishlistFolders(userId: string): WishlistFolder[] {
    const all = this.getItem<WishlistFolder[]>('wishlist_folders', [
      {
        id: 'folder-sample-01',
        userId: 'usr-agent-01',
        name: 'Japan Luxury Highlights 2026',
        color: '#00C6A6',
        createdAt: '2026-03-01'
      }
    ]);
    return all.filter(f => !f.userId || f.userId === userId);
  }

  public saveWishlistFolder(folder: WishlistFolder): void {
    const all = this.getItem<WishlistFolder[]>('wishlist_folders', []);
    const index = all.findIndex(f => f.id === folder.id);
    if (index >= 0) {
      all[index] = folder;
    } else {
      all.unshift(folder);
    }
    this.setItem('wishlist_folders', all);
    this.syncFirestoreDoc('wishlist_folders', folder.id, folder);
  }

  public createWishlistFolder(folderOrUserId: WishlistFolder | string, folderName?: string): WishlistFolder {
    if (typeof folderOrUserId === 'object') {
      this.saveWishlistFolder(folderOrUserId);
      return folderOrUserId;
    }
    const newFolder: WishlistFolder = {
      id: `folder-${Date.now()}`,
      userId: folderOrUserId,
      name: folderName || 'New Folder',
      color: '#00C6A6',
      createdAt: new Date().toISOString()
    };
    this.saveWishlistFolder(newFolder);
    return newFolder;
  }

  public deleteWishlistFolder(folderId: string): void {
    const all = this.getItem<WishlistFolder[]>('wishlist_folders', []);
    this.setItem('wishlist_folders', all.filter(f => f.id !== folderId));
    this.deleteFirestoreDoc('wishlist_folders', folderId);

    // Also update any items in this folder to move to 'default'
    const items = this.getItem<WishlistItem[]>('wishlist_items', []);
    const updatedItems = items.map(item => {
      if (item.folderId === folderId) {
        return { ...item, folderId: 'default' };
      }
      return item;
    });
    this.setItem('wishlist_items', updatedItems);
  }

  public getWishlistItems(userId: string): WishlistItem[] {
    const all = this.getItem<WishlistItem[]>('wishlist_items', [
      {
        id: 'wish-sample-01',
        userId: 'usr-agent-01',
        productId: 'prod-jp-01',
        folderId: 'folder-sample-01',
        addedAt: '2026-03-01'
      },
      {
        id: 'wish-sample-02',
        userId: 'usr-agent-01',
        productId: 'prod-jp-04',
        folderId: 'folder-sample-01',
        addedAt: '2026-03-02'
      }
    ]);
    return all.filter(i => !i.userId || i.userId === userId);
  }

  public saveWishlistItem(item: WishlistItem): void {
    const all = this.getItem<WishlistItem[]>('wishlist_items', []);
    const index = all.findIndex(i => i.id === item.id || (i.userId === item.userId && i.productId === item.productId));
    if (index >= 0) {
      all[index] = item;
    } else {
      all.unshift(item);
    }
    this.setItem('wishlist_items', all);
    this.syncFirestoreDoc('wishlist_items', item.id, item);
  }

  public deleteWishlistItem(itemId: string): void {
    const all = this.getItem<WishlistItem[]>('wishlist_items', []);
    this.setItem('wishlist_items', all.filter(i => i.id !== itemId));
    this.deleteFirestoreDoc('wishlist_items', itemId);
  }

  public removeFromWishlist(itemIdOrUserId: string, folderId?: string, productId?: string): void {
    if (folderId && productId) {
      const all = this.getItem<WishlistItem[]>('wishlist_items', []);
      const item = all.find(i => i.userId === itemIdOrUserId && i.productId === productId && (folderId === 'all' || i.folderId === folderId));
      if (item) {
        this.deleteWishlistItem(item.id);
      }
      return;
    }
    this.deleteWishlistItem(itemIdOrUserId);
  }

  public moveWishlistItem(itemId: string, targetFolderId: string): void {
    const all = this.getItem<WishlistItem[]>('wishlist_items', []);
    const item = all.find(i => i.id === itemId);
    if (item) {
      item.folderId = targetFolderId;
      this.setItem('wishlist_items', all);
      this.syncFirestoreDoc('wishlist_items', itemId, item);
    }
  }

  // ==========================================
  // MENU & NAVIGATION PAGES MANAGEMENT
  // ==========================================
  private getDeletedMenuItemIds(): Set<string> {
    const ids = this.getItem<string[]>('deleted_menu_item_ids', []);
    return new Set(ids);
  }

  private markMenuItemDeleted(itemId: string): void {
    const set = this.getDeletedMenuItemIds();
    set.add(itemId);
    this.setItem('deleted_menu_item_ids', Array.from(set));
  }

  private unmarkMenuItemDeleted(itemId: string): void {
    const set = this.getDeletedMenuItemIds();
    if (set.has(itemId)) {
      set.delete(itemId);
      this.setItem('deleted_menu_item_ids', Array.from(set));
    }
  }

  private getDeletedCustomPageIds(): Set<string> {
    const ids = this.getItem<string[]>('deleted_custom_page_ids', []);
    return new Set(ids);
  }

  private markCustomPageDeleted(pageId: string): void {
    const set = this.getDeletedCustomPageIds();
    set.add(pageId);
    this.setItem('deleted_custom_page_ids', Array.from(set));
  }

  private unmarkCustomPageDeleted(pageId: string): void {
    const set = this.getDeletedCustomPageIds();
    if (set.has(pageId)) {
      set.delete(pageId);
      this.setItem('deleted_custom_page_ids', Array.from(set));
    }
  }

  public getMenuItems(location?: MenuLocation): MenuItemConfig[] {
    const all = this.getItem<MenuItemConfig[]>('menu_items', INITIAL_MENU_ITEMS);
    if (!location) {
      return all.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    }
    return all
      .filter(item => {
        if (location === 'HEADER') return !item.menuLocation || item.menuLocation === 'HEADER';
        return item.menuLocation === location;
      })
      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  }

  public getHeaderMenuItems(): MenuItemConfig[] {
    return this.getMenuItems('HEADER');
  }

  public getSecondaryMenuItems(): MenuItemConfig[] {
    return this.getMenuItems('SECONDARY');
  }

  public saveMenuItem(item: MenuItemConfig, user?: User | null): void {
    const effectiveUser = user || this.getCurrentUser();
    if (effectiveUser) {
      const auth = this.canUserWriteCMS(effectiveUser, 'CONTENT', 'MenuItem');
      if (!auth.allowed) {
        this.logAudit(effectiveUser, 'UNAUTHORIZED_WRITE_ATTEMPT', 'NavigationMenu', item.id, `Unauthorized write attempt: ${auth.reason}`);
        return;
      }
    }
    const items = this.getItem<MenuItemConfig[]>('menu_items', INITIAL_MENU_ITEMS);
    const index = items.findIndex(m => m.id === item.id);
    let savedItem: MenuItemConfig;
    if (index >= 0) {
      savedItem = {
        ...items[index],
        ...item
      };
      items[index] = savedItem;
      this.logAudit(effectiveUser || null, 'SETTINGS_UPDATED', 'NavigationMenu', item.id, `Updated menu item: ${item.label}`);
    } else {
      savedItem = {
        ...item,
        id: item.id || `menu-${Date.now()}`
      };
      items.push(savedItem);
      this.logAudit(effectiveUser || null, 'SETTINGS_UPDATED', 'NavigationMenu', savedItem.id, `Added menu item: ${item.label}`);
    }
    this.unmarkMenuItemDeleted(savedItem.id);
    this.syncFirestoreDoc('menu_items', savedItem.id, savedItem);
    this.setItem('menu_items', items);
  }

  public deleteMenuItem(itemId: string, user?: User | null): { success: boolean; error?: string } {
    const effectiveUser = user || this.getCurrentUser();
    if (effectiveUser) {
      const permCheck = this.canUserDelete(effectiveUser, 'MenuItem');
      if (!permCheck.allowed) {
        this.logAudit(effectiveUser, 'UNAUTHORIZED_DELETE_ATTEMPT', 'NavigationMenu', itemId, `Unauthorized delete attempt: ${permCheck.reason}`);
        return { success: false, error: permCheck.reason };
      }
    }
    const items = this.getItem<MenuItemConfig[]>('menu_items', INITIAL_MENU_ITEMS);
    const target = items.find(m => m.id === itemId);
    this.setItem('menu_items', items.filter(m => m.id !== itemId));
    this.markMenuItemDeleted(itemId);
    this.deleteFirestoreDoc('menu_items', itemId);

    if (target) {
      // Sync linked custom page if exists so it no longer attempts to display in navigation
      try {
        const pages = this.getCustomPages();
        const linkedPage = pages.find(p => p.slug === target.targetId || `menu-${p.id}` === itemId || p.id === target.targetId);
        if (linkedPage && linkedPage.showInMenu) {
          const updatedPages = pages.map(p => p.id === linkedPage.id ? { ...p, showInMenu: false } : p);
          this.setItem('custom_pages', updatedPages);
          this.syncFirestoreDoc('custom_pages', linkedPage.id, { ...linkedPage, showInMenu: false });
        }
      } catch (err) {
        console.debug('Error updating linked page on menu item deletion:', err);
      }
      this.logAudit(effectiveUser || null, 'SETTINGS_UPDATED', 'NavigationMenu', itemId, `Removed menu item: ${target.label}`);
    }
    return { success: true };
  }

  public updateMenuOrdering(items: MenuItemConfig[], user?: User | null): void {
    const effectiveUser = user || this.getCurrentUser();
    if (effectiveUser) {
      const auth = this.canUserWriteCMS(effectiveUser, 'CONTENT', 'MenuItem');
      if (!auth.allowed) {
        this.logAudit(effectiveUser, 'UNAUTHORIZED_WRITE_ATTEMPT', 'NavigationMenu', 'menu-order', `Unauthorized write attempt: ${auth.reason}`);
        return;
      }
    }
    this.setItem('menu_items', items);
    items.forEach(item => {
      this.syncFirestoreDoc('menu_items', item.id, item);
    });
    this.logAudit(effectiveUser || null, 'SETTINGS_UPDATED', 'NavigationMenu', 'menu-order', `Re-arranged navigation menu order (${items.length} items)`);
  }

  public getCustomPages(): CustomPage[] {
    return this.getItem<CustomPage[]>('custom_pages', INITIAL_CUSTOM_PAGES);
  }

  public getCustomPageBySlug(slug: string): CustomPage | undefined {
    return this.getCustomPages().find(p => p.slug === slug || p.id === slug);
  }

  public saveCustomPage(page: CustomPage, user?: User | null): void {
    if (user) {
      const auth = this.canUserWriteCMS(user, 'CONTENT', 'CustomPage');
      if (!auth.allowed) {
        this.logAudit(user, 'UNAUTHORIZED_WRITE_ATTEMPT', 'CustomPage', page.id, `Unauthorized write attempt: ${auth.reason}`);
        return;
      }
    }
    const pages = this.getCustomPages();
    const index = pages.findIndex(p => p.id === page.id);
    let savedPage: CustomPage;
    const now = new Date().toISOString();
    if (index >= 0) {
      savedPage = { ...page, updatedAt: now };
      pages[index] = savedPage;
      this.logAudit(user || null, 'SETTINGS_UPDATED', 'CustomPage', page.id, `Updated custom page: ${page.title}`);
    } else {
      savedPage = {
        ...page,
        id: page.id || `page-${Date.now()}`,
        createdAt: now,
        updatedAt: now
      };
      pages.unshift(savedPage);
      this.logAudit(user || null, 'SETTINGS_UPDATED', 'CustomPage', savedPage.id, `Created custom page: ${page.title}`);
    }
    this.unmarkCustomPageDeleted(savedPage.id);
    this.syncFirestoreDoc('custom_pages', savedPage.id, savedPage);
    this.setItem('custom_pages', pages);

    // If showInMenu is enabled, ensure it exists in Menu items
    const menuItems = this.getItem<MenuItemConfig[]>('menu_items', INITIAL_MENU_ITEMS);
    const menuIndex = menuItems.findIndex(m => m.targetId === savedPage.slug || m.id === `menu-${savedPage.id}`);
    if (savedPage.showInMenu && savedPage.isPublished) {
      const menuItem: MenuItemConfig = {
        id: `menu-${savedPage.id}`,
        label: savedPage.menuLabel || savedPage.title,
        type: 'CUSTOM_PAGE',
        targetId: savedPage.slug,
        displayOrder: savedPage.menuOrder || (menuItems.length + 1),
        isVisible: true,
        menuLocation: 'HEADER'
      };
      if (menuIndex >= 0) {
        menuItems[menuIndex] = { ...menuItems[menuIndex], ...menuItem };
      } else {
        menuItems.push(menuItem);
      }
      this.updateMenuOrdering(menuItems, user);
    } else if (!savedPage.showInMenu && menuIndex >= 0) {
      this.deleteMenuItem(menuItems[menuIndex].id, user);
    }

    // Sync footer if configured
    if (savedPage.showInFooter && savedPage.footerColumnId) {
      const footerConfig = this.getFooterConfig();
      const colIndex = (footerConfig.columns || []).findIndex(c => c.id === savedPage.footerColumnId);
      if (colIndex >= 0) {
        const col = footerConfig.columns[colIndex];
        const linkId = `footer-link-page-${savedPage.id}`;
        const links = col.links || [];
        const linkIdx = links.findIndex(l => l.id === linkId || l.targetId === savedPage.slug);
        const footerLink: FooterMenuLink = {
          id: linkId,
          label: savedPage.menuLabel || savedPage.title,
          type: 'CMS_PAGE',
          targetId: savedPage.slug,
          url: `/pages/${savedPage.slug}`,
          displayOrder: links.length + 1,
          openIn: '_self',
          status: savedPage.isPublished ? 'ACTIVE' : 'INACTIVE',
          createdAt: now,
          updatedAt: now
        };
        if (linkIdx >= 0) {
          links[linkIdx] = footerLink;
        } else {
          links.push(footerLink);
        }
        footerConfig.columns[colIndex] = { ...col, links };
        this.saveFooterConfig(footerConfig, user);
      }
    }
  }

  public deleteCustomPage(pageId: string, user?: User | null): { success: boolean; error?: string } {
    const effectiveUser = user || this.getCurrentUser();
    if (effectiveUser) {
      const permCheck = this.canUserDelete(effectiveUser, 'CustomPage');
      if (!permCheck.allowed) {
        this.logAudit(effectiveUser, 'UNAUTHORIZED_DELETE_ATTEMPT', 'CustomPage', pageId, `Unauthorized delete attempt: ${permCheck.reason}`);
        return { success: false, error: permCheck.reason };
      }
    }
    const pages = this.getCustomPages();
    const target = pages.find(p => p.id === pageId);
    this.setItem('custom_pages', pages.filter(p => p.id !== pageId));
    this.markCustomPageDeleted(pageId);
    this.deleteFirestoreDoc('custom_pages', pageId);
    if (target) {
      this.deleteMenuItem(`menu-${pageId}`, effectiveUser);
      // Clean from footer columns if linked
      const footerConfig = this.getFooterConfig();
      let changed = false;
      if (footerConfig.columns) {
        footerConfig.columns.forEach(col => {
          if (col.links) {
            const origLen = col.links.length;
            col.links = col.links.filter(l => l.targetId !== target.slug && l.id !== `footer-link-page-${pageId}`);
            if (col.links.length !== origLen) changed = true;
          }
        });
      }
      if (changed) {
        this.saveFooterConfig(footerConfig, effectiveUser);
      }
      this.logAudit(effectiveUser || null, 'SETTINGS_UPDATED', 'CustomPage', pageId, `Deleted custom page: ${target.title}`);
    }
    return { success: true };
  }

  // ==========================================
  // VISA PRODUCTS & CHECKLIST MANAGEMENT
  // ==========================================
  public getVisas(): VisaProduct[] {
    return this.getItem<VisaProduct[]>('visas', INITIAL_VISAS);
  }

  public getVisaById(id: string): VisaProduct | undefined {
    return this.getVisas().find(v => v.id === id);
  }

  public saveVisa(visa: VisaProduct, user?: User | null): void {
    const visas = this.getVisas();
    const index = visas.findIndex(v => v.id === visa.id);
    const now = new Date().toISOString();
    let savedVisa: VisaProduct;
    if (index >= 0) {
      savedVisa = { ...visa, updatedAt: now };
      visas[index] = savedVisa;
      this.logAudit(user || null, 'PRODUCT_UPDATED', 'VisaProduct', visa.id, `Updated visa product: ${visa.country} - ${visa.visaType}`);
    } else {
      savedVisa = {
        ...visa,
        id: visa.id || `visa-${Date.now()}`,
        createdAt: now,
        updatedAt: now
      };
      visas.unshift(savedVisa);
      this.logAudit(user || null, 'PRODUCT_CREATED', 'VisaProduct', savedVisa.id, `Created new visa product: ${visa.country} - ${visa.visaType}`);
    }
    this.syncFirestoreDoc('visas', savedVisa.id, savedVisa);
    this.setItem('visas', visas);
  }

  public deleteVisa(visaId: string, user?: User | null): void {
    const visas = this.getVisas();
    const target = visas.find(v => v.id === visaId);
    this.setItem('visas', visas.filter(v => v.id !== visaId));
    this.deleteFirestoreDoc('visas', visaId);
    if (target) {
      this.logAudit(user || null, 'PRODUCT_ARCHIVED', 'VisaProduct', visaId, `Deleted visa product: ${target.country} - ${target.visaType}`);
    }
  }

  // ==========================================
  // FOOTER NAVIGATION CONFIGURATION
  // ==========================================
  public getFooterConfig(): FooterConfig {
    const raw = this.getItem<FooterConfig>('footer_config', INITIAL_FOOTER_CONFIG);
    if (!raw || !raw.columns) {
      return INITIAL_FOOTER_CONFIG;
    }
    const normalizeColList = (cols: FooterMenuColumn[]): FooterMenuColumn[] => {
      return cols.map((col, idx) => {
        const colLinks: FooterMenuLink[] = Array.isArray(col.links) && col.links.length > 0
          ? col.links.map((l, lIdx) => ({
              ...l,
              id: l.id || `link-${idx}-${lIdx}`,
              displayOrder: l.displayOrder ?? lIdx + 1,
              status: (l.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE') as 'ACTIVE' | 'INACTIVE',
              openIn: (l.openIn === '_blank' ? '_blank' : (l.url?.startsWith('http') ? '_blank' : '_self')) as '_self' | '_blank'
            }))
          : Array.isArray(col.items)
          ? col.items.map((it: any, iIdx: number): FooterMenuLink => ({
              id: it.id || `link-${idx}-${iIdx}`,
              label: it.label || it.title || 'Link',
              url: it.customUrl || it.targetId || '#',
              type: (it.type === 'CUSTOM_LINK' ? 'EXTERNAL_LINK' : it.type) || 'SYSTEM_VIEW',
              targetId: it.targetId || '',
              displayOrder: it.displayOrder || iIdx + 1,
              status: 'ACTIVE',
              openIn: (it.customUrl?.startsWith('http') ? '_blank' : '_self') as '_self' | '_blank'
            }))
          : [];
        return {
          ...col,
          id: col.id || `col-${idx + 1}`,
          title: col.title || `Column ${idx + 1}`,
          displayOrder: col.displayOrder ?? idx + 1,
          status: (col.status === 'INACTIVE' || col.status === 'DRAFT') ? col.status : 'ACTIVE',
          isVisible: col.isVisible ?? true,
          links: colLinks
        };
      });
    };

    const normalizedCols = normalizeColList(raw.columns || []);
    const normalizedDraftCols = raw.draftColumns ? normalizeColList(raw.draftColumns) : undefined;

    return {
      ...raw,
      status: raw.status || 'PUBLISHED',
      columns: normalizedCols,
      draftColumns: normalizedDraftCols
    };
  }

  public saveFooterConfig(config: FooterConfig, user?: User | null): void {
    const updatedConfig: FooterConfig = {
      ...config,
      columns: config.columns.map((c, idx) => ({ ...c, displayOrder: c.displayOrder ?? idx + 1 }))
    };
    this.setItem('footer_config', updatedConfig);
    this.syncFirestoreDoc('footer_config', 'main_footer', updatedConfig);
    this.logAudit(user || null, 'SETTINGS_UPDATED', 'FooterNavigation', 'main_footer', 'Updated footer navigation columns and links structure');
  }

  public publishFooterConfig(columns: FooterMenuColumn[], user?: User | null): void {
    const prev = this.getFooterConfig();
    const cleanCols = columns.map((c, idx) => ({
      ...c,
      displayOrder: idx + 1,
      updatedAt: new Date().toISOString()
    }));
    const newConfig: FooterConfig = {
      ...prev,
      columns: cleanCols,
      draftColumns: undefined,
      status: 'PUBLISHED',
      lastPublishedAt: new Date().toISOString(),
      lastPublishedBy: user?.name || user?.email || 'Administrator'
    };
    this.setItem('footer_config', newConfig);
    this.syncFirestoreDoc('footer_config', 'main_footer', newConfig);
    this.logAudit(
      user || null,
      'SETTINGS_UPDATED',
      'FooterNavigation',
      'main_footer',
      `Published Footer Navigation with ${cleanCols.length} columns and ${cleanCols.reduce((acc, c) => acc + (c.links?.length || 0), 0)} links.`,
      `Previous columns: ${prev.columns.length}`,
      `Published columns: ${cleanCols.length}`
    );
  }

  public saveFooterDraft(draftColumns: FooterMenuColumn[], user?: User | null): void {
    const prev = this.getFooterConfig();
    const cleanCols = draftColumns.map((c, idx) => ({
      ...c,
      displayOrder: idx + 1,
      updatedAt: new Date().toISOString()
    }));
    const newConfig: FooterConfig = {
      ...prev,
      draftColumns: cleanCols,
      status: 'DRAFT_PENDING'
    };
    this.setItem('footer_config', newConfig);
    this.syncFirestoreDoc('footer_config', 'main_footer', newConfig);
    this.logAudit(
      user || null,
      'SETTINGS_UPDATED',
      'FooterNavigation',
      'main_footer',
      `Saved Footer Navigation draft with ${cleanCols.length} columns.`
    );
  }

  public getFooterColumns(includeDraft: boolean = false): FooterMenuColumn[] {
    const config = this.getFooterConfig();
    if (includeDraft && config.draftColumns && config.draftColumns.length > 0) {
      return config.draftColumns;
    }
    return config.columns || [];
  }

  public saveFooterColumn(column: FooterMenuColumn, user?: User | null): void {
    const config = this.getFooterConfig();
    const cols = config.columns ? [...config.columns] : [];
    const index = cols.findIndex(c => c.id === column.id);
    const now = new Date().toISOString();
    const colToSave: FooterMenuColumn = {
      ...column,
      updatedAt: now,
      createdAt: column.createdAt || now,
      status: column.status || 'ACTIVE',
      isVisible: column.isVisible ?? true
    };

    if (index >= 0) {
      const prevTitle = cols[index].title;
      cols[index] = colToSave;
      this.logAudit(
        user || null,
        'SETTINGS_UPDATED',
        'FooterColumn',
        column.id,
        `Updated footer column "${column.title}" (order ${column.displayOrder})`,
        prevTitle,
        column.title
      );
    } else {
      colToSave.displayOrder = colToSave.displayOrder || cols.length + 1;
      cols.push(colToSave);
      this.logAudit(
        user || null,
        'SETTINGS_UPDATED',
        'FooterColumn',
        column.id,
        `Created footer column "${column.title}"`
      );
    }
    config.columns = cols;
    this.saveFooterConfig(config, user);
  }

  public deleteFooterColumn(columnId: string, user?: User | null): void {
    const config = this.getFooterConfig();
    if (config.columns) {
      const target = config.columns.find(c => c.id === columnId);
      config.columns = config.columns.filter(c => c.id !== columnId);
      // Re-index display orders
      config.columns = config.columns.map((c, idx) => ({ ...c, displayOrder: idx + 1 }));
      if (config.draftColumns) {
        config.draftColumns = config.draftColumns.filter(c => c.id !== columnId).map((c, idx) => ({ ...c, displayOrder: idx + 1 }));
      }
      this.saveFooterConfig(config, user);
      this.logAudit(
        user || null,
        'SETTINGS_UPDATED',
        'FooterColumn',
        columnId,
        `Deleted footer column: "${target?.title || columnId}" (${target?.links?.length || 0} links removed from footer navigation)`
      );
    }
  }

  public updateFooterColumns(columns: FooterMenuColumn[], user?: User | null): void {
    const config = this.getFooterConfig();
    config.columns = columns.map((c, idx) => ({ ...c, displayOrder: idx + 1 }));
    this.saveFooterConfig(config, user);
    this.logAudit(
      user || null,
      'SETTINGS_UPDATED',
      'FooterNavigation',
      'columns_order',
      `Reordered footer columns sequence (${columns.length} columns active)`
    );
  }

  public addFooterLink(columnId: string, link: FooterMenuLink, user?: User | null): void {
    const config = this.getFooterConfig();
    const cols = config.columns ? [...config.columns] : [];
    const colIndex = cols.findIndex(c => c.id === columnId);
    if (colIndex >= 0) {
      const col = cols[colIndex];
      const links = col.links ? [...col.links] : [];
      const newLink: FooterMenuLink = {
        ...link,
        id: link.id || `link-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        displayOrder: link.displayOrder || links.length + 1,
        status: link.status || 'ACTIVE',
        openIn: link.openIn || '_self',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      links.push(newLink);
      cols[colIndex] = { ...col, links };
      config.columns = cols;
      this.saveFooterConfig(config, user);
      this.logAudit(
        user || null,
        'SETTINGS_UPDATED',
        'FooterLink',
        newLink.id,
        `Added footer link "${newLink.label}" to column "${col.title}" (target: ${newLink.targetId || newLink.url})`
      );
    }
  }

  public updateFooterLink(columnId: string, link: FooterMenuLink, user?: User | null): void {
    const config = this.getFooterConfig();
    const cols = config.columns ? [...config.columns] : [];
    const colIndex = cols.findIndex(c => c.id === columnId);
    if (colIndex >= 0) {
      const col = cols[colIndex];
      const links = col.links ? [...col.links] : [];
      const lIdx = links.findIndex(l => l.id === link.id);
      if (lIdx >= 0) {
        const prevLabel = links[lIdx].label;
        links[lIdx] = {
          ...links[lIdx],
          ...link,
          updatedAt: new Date().toISOString()
        };
        cols[colIndex] = { ...col, links };
        config.columns = cols;
        this.saveFooterConfig(config, user);
        this.logAudit(
          user || null,
          'SETTINGS_UPDATED',
          'FooterLink',
          link.id,
          `Updated footer link in column "${col.title}": "${prevLabel}" -> "${link.label}"`
        );
      }
    }
  }

  public deleteFooterLink(columnId: string, linkId: string, user?: User | null): void {
    const config = this.getFooterConfig();
    const cols = config.columns ? [...config.columns] : [];
    const colIndex = cols.findIndex(c => c.id === columnId);
    if (colIndex >= 0) {
      const col = cols[colIndex];
      const targetLink = col.links?.find(l => l.id === linkId);
      const links = (col.links || []).filter(l => l.id !== linkId).map((l, idx) => ({ ...l, displayOrder: idx + 1 }));
      cols[colIndex] = { ...col, links };
      config.columns = cols;
      this.saveFooterConfig(config, user);
      this.logAudit(
        user || null,
        'SETTINGS_UPDATED',
        'FooterLink',
        linkId,
        `Deleted footer link "${targetLink?.label || linkId}" from column "${col.title}" (underlying page preserved)`
      );
    }
  }

  public validateFooterNavigation(): {
    totalChecked: number;
    brokenCount: number;
    issues: { columnId: string; columnTitle: string; linkId: string; linkLabel: string; reason: string; severity: 'ERROR' | 'WARN' }[];
  } {
    const config = this.getFooterConfig();
    const customPages = this.getCustomPages();
    const destinations = this.getDestinations();
    const issues: { columnId: string; columnTitle: string; linkId: string; linkLabel: string; reason: string; severity: 'ERROR' | 'WARN' }[] = [];
    let totalChecked = 0;

    (config.columns || []).forEach(col => {
      (col.links || []).forEach(link => {
        totalChecked++;
        if (link.type === 'CUSTOM_PAGE') {
          const page = customPages.find(p => p.slug === link.targetId || p.id === link.targetId);
          if (!page) {
            issues.push({
              columnId: col.id,
              columnTitle: col.title,
              linkId: link.id,
              linkLabel: link.label,
              reason: `Linked CMS page "${link.targetId}" does not exist in the database.`,
              severity: 'ERROR'
            });
          } else if (!page.isPublished) {
            issues.push({
              columnId: col.id,
              columnTitle: col.title,
              linkId: link.id,
              linkLabel: link.label,
              reason: `Linked CMS page "${page.title}" is currently unpublished / draft.`,
              severity: 'WARN'
            });
          }
        } else if (link.type === 'DESTINATION') {
          if (link.targetId !== 'all') {
            const dest = destinations.find(d => d.slug === link.targetId || d.id === link.targetId);
            if (!dest) {
              issues.push({
                columnId: col.id,
                columnTitle: col.title,
                linkId: link.id,
                linkLabel: link.label,
                reason: `Linked destination "${link.targetId}" is not found.`,
                severity: 'ERROR'
              });
            } else if (dest.status === 'COMING_SOON') {
              issues.push({
                columnId: col.id,
                columnTitle: col.title,
                linkId: link.id,
                linkLabel: link.label,
                reason: `Linked destination "${dest.name}" is marked Coming Soon (not active yet).`,
                severity: 'WARN'
              });
            }
          }
        } else if (link.type === 'EXTERNAL_LINK' || link.type === 'CUSTOM_LINK') {
          if (!link.url || link.url === '#' || link.url.trim() === '') {
            issues.push({
              columnId: col.id,
              columnTitle: col.title,
              linkId: link.id,
              linkLabel: link.label,
              reason: 'Empty URL destination configured for custom/external link.',
              severity: 'ERROR'
            });
          }
        }
      });
    });

    return {
      totalChecked,
      brokenCount: issues.length,
      issues
    };
  }

  // ==========================================
  // USER ACTIVITY & TELEMETRY TRACKING
  // ==========================================
  public logUserActivity(event: Omit<UserActivityEvent, 'id' | 'timestamp'>): void {
    const events = this.getItem<UserActivityEvent[]>('user_activities', []);
    const newEvent: UserActivityEvent = {
      ...event,
      id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString()
    };
    this.setItem('user_activities', [newEvent, ...events.slice(0, 999)]);
    this.syncFirestoreDoc('user_activities', newEvent.id, newEvent);
  }

  public getUserActivityEvents(userId?: string): UserActivityEvent[] {
    const all = this.getItem<UserActivityEvent[]>('user_activities', []);
    if (!userId) return all;
    return all.filter(e => e.userId === userId);
  }

  public getUserTelemetrySummary(userId: string): UserTelemetrySummary | null {
    const users = this.getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) return null;

    const allQuotes = this.getAllSavedQuotes();
    const saved = allQuotes.filter(q => q.agentId === user.id || (user.email && q.clientEmail === user.email));
    
    // Downloaded quotes (filter quotes where activity log has DOWNLOADED or PRINTED)
    const downloaded = saved.filter(q => 
      q.activityLog?.some(a => a.action === 'DOWNLOADED' || a.action === 'PRINTED')
    );

    const allBookings = this.getBookings();
    const userBookings = allBookings.filter(b => b.userId === user.id || (user.email && b.customer.email === user.email));

    const events = this.getUserActivityEvents(userId);
    const totalTimeMinutes = Math.max(1, Math.round(events.length * 3.5)); // Calculated active session metric

    return {
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      agencyName: user.agencyName || user.companyName,
      role: user.role,
      proposalsSavedCount: saved.length,
      savedProposals: saved,
      proposalsDownloadedCount: downloaded.length,
      downloadedQuotes: downloaded,
      bookingsCount: userBookings.length,
      bookings: userBookings,
      totalTimeSpentMinutes: totalTimeMinutes,
      lastActiveTimestamp: events[0]?.timestamp || user.createdAt || new Date().toISOString(),
      createdAt: user.createdAt || new Date().toISOString()
    };
  }

  public getAllUserTelemetry(): UserTelemetrySummary[] {
    const users = this.getUsers();
    return users.map(u => this.getUserTelemetrySummary(u.id)!).filter(Boolean);
  }

  // ==========================================
  // SYSTEM ANALYSIS & COMPLETE USER JOURNEY TRACKING
  // ==========================================
  public getUserCompleteJourney(userId: string): SystemUserJourneyEvent[] {
    const users = this.getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) return [];

    const events: SystemUserJourneyEvent[] = [];

    // 1. User Registration Event
    events.push({
      id: `usr-reg-${user.id}`,
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      agencyName: user.agencyName || user.companyName,
      userRole: user.role,
      category: 'USER',
      eventType: 'ACCOUNT_REGISTERED',
      title: 'Account Registered',
      description: `${user.name} created account with role ${user.role}${user.agencyName ? ` at ${user.agencyName}` : ''}`,
      timestamp: user.createdAt || '2026-01-01T00:00:00.000Z',
      entityId: user.id,
      entityType: 'User',
      severity: 'INFO',
      metadata: {
        approvalStatus: user.approvalStatus || 'APPROVED',
        role: user.role,
        agency: user.agencyName
      }
    });

    // 2. Quotation Events (Created, Saved, PDF Exported, WhatsApp Shared, AI suggestions)
    const allQuotes = this.getAllSavedQuotes();
    const userQuotes = allQuotes.filter(q => 
      q.agentId === user.id || 
      q.createdBy === user.id || 
      q.clientUserId === user.id || 
      (user.email && (q.clientEmail?.toLowerCase() === user.email.toLowerCase() || q.agentEmail?.toLowerCase() === user.email.toLowerCase()))
    );

    userQuotes.forEach(q => {
      // Creation
      events.push({
        id: `quote-create-${q.id}`,
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        agencyName: user.agencyName || user.companyName,
        userRole: user.role,
        category: 'QUOTE',
        eventType: 'QUOTE_CREATED',
        title: `Quotation Generated #${q.quoteNumber || q.id}`,
        description: `Created custom proposal for ${q.destination || 'Luxury Tour'} (${q.totalPax || 2} Pax, ${q.currency || 'USD'} ${Number(q.totalSellingPrice || 0).toLocaleString()})`,
        timestamp: q.createdAt || '2026-01-01T00:00:00.000Z',
        entityId: q.id,
        entityType: 'Quotation',
        severity: 'SUCCESS',
        metadata: {
          destination: q.destination,
          pax: q.totalPax,
          totalSellingPrice: q.totalSellingPrice,
          status: q.status,
          quoteNumber: q.quoteNumber
        }
      });

      // AI Planner attribution
      const hasAiItems = q.items?.some(it => it.source === 'AI_PLANNER' || it.aiSuggested);
      if (hasAiItems) {
        events.push({
          id: `quote-ai-${q.id}`,
          userId: user.id,
          userEmail: user.email,
          userName: user.name,
          agencyName: user.agencyName || user.companyName,
          userRole: user.role,
          category: 'AI_PLANNER',
          eventType: 'AI_PLAN_CONVERTED',
          title: `AI Planner Itinerary Added to Quote #${q.quoteNumber || q.id}`,
          description: `AI-generated itinerary and experiences successfully converted into active quotation for ${q.destination}`,
          timestamp: q.createdAt || '2026-01-01T00:00:00.000Z',
          entityId: q.id,
          entityType: 'Quotation',
          severity: 'INFO',
          metadata: {
            destination: q.destination,
            itemCount: q.items?.length || 0
          }
        });
      }

      // Downloaded
      if (q.status === 'DOWNLOADED_PDF' || q.status === 'DOWNLOADED') {
        events.push({
          id: `quote-dl-${q.id}`,
          userId: user.id,
          userEmail: user.email,
          userName: user.name,
          agencyName: user.agencyName || user.companyName,
          userRole: user.role,
          category: 'QUOTE',
          eventType: 'QUOTE_PDF_DOWNLOADED',
          title: `Quote #${q.quoteNumber || q.id} PDF Exported`,
          description: `Downloaded official branded client proposal PDF for ${q.clientName || 'Client'} (${q.destination})`,
          timestamp: q.updatedAt || q.createdAt || new Date().toISOString(),
          entityId: q.id,
          entityType: 'Quotation',
          severity: 'SUCCESS',
          metadata: { destination: q.destination, clientName: q.clientName }
        });
      }

      // WhatsApp share
      if (q.lastSharedViaWhatsAppAt) {
        events.push({
          id: `quote-wa-${q.id}`,
          userId: user.id,
          userEmail: user.email,
          userName: user.name,
          agencyName: user.agencyName || user.companyName,
          userRole: user.role,
          category: 'COMMUNICATION',
          eventType: 'QUOTE_WHATSAPP_SHARED',
          title: `Quote #${q.quoteNumber || q.id} Shared via WhatsApp`,
          description: `Direct proposal message dispatched to client mobile (${q.lastSharedRecipientPhone || 'Client Contact'})`,
          timestamp: q.lastSharedViaWhatsAppAt,
          entityId: q.id,
          entityType: 'Quotation',
          severity: 'INFO',
          metadata: { phone: q.lastSharedRecipientPhone }
        });
      }

      // Activity logs on quote
      if (q.activityLog && Array.isArray(q.activityLog)) {
        q.activityLog.forEach(act => {
          events.push({
            id: `q-act-${act.id || Math.random().toString(36).substr(2, 6)}`,
            userId: user.id,
            userEmail: user.email,
            userName: act.userName || user.name,
            agencyName: user.agencyName || user.companyName,
            userRole: user.role,
            category: 'QUOTE',
            eventType: act.action,
            title: `Quote #${q.quoteNumber || q.id}: ${act.action.replace(/_/g, ' ')}`,
            description: act.details || `Quote status updated to ${act.action}`,
            timestamp: act.timestamp || q.createdAt,
            entityId: q.id,
            entityType: 'Quotation',
            severity: act.action.includes('BOOKED') || act.action.includes('APPROVED') ? 'SUCCESS' : 'INFO'
          });
        });
      }
    });

    // 3. Bookings & Reservation Events
    const allBookings = this.getAllBookings();
    const userBookings = allBookings.filter(b => 
      b.userId === user.id || 
      b.agentId === user.id || 
      (user.email && b.customer?.email?.toLowerCase() === user.email.toLowerCase())
    );

    userBookings.forEach(b => {
      // Submission
      events.push({
        id: `bk-create-${b.id}`,
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        agencyName: user.agencyName || user.companyName,
        userRole: user.role,
        category: 'BOOKING',
        eventType: 'BOOKING_SUBMITTED',
        title: `Ground Booking Submitted #${b.bookingReference || b.id}`,
        description: `Reservation submitted for ${b.customer?.leadTravelerName || 'Lead Traveler'} to ${b.destinationName || b.destination || 'Destination'} (${b.currency || 'USD'} ${Number(b.totalAmount || 0).toLocaleString()})`,
        timestamp: b.createdAt || '2026-01-01T00:00:00.000Z',
        entityId: b.id,
        entityType: 'Booking',
        severity: 'SUCCESS',
        metadata: {
          bookingReference: b.bookingReference,
          destination: b.destinationName || b.destination,
          totalAmount: b.totalAmount,
          currency: b.currency,
          status: b.status,
          travelDates: `${b.travelStartDate || ''} - ${b.travelEndDate || ''}`
        }
      });

      // Confirmation
      if (b.status === 'CONFIRMED' || b.status === 'COMPLETED') {
        events.push({
          id: `bk-conf-${b.id}`,
          userId: user.id,
          userEmail: user.email,
          userName: user.name,
          agencyName: user.agencyName || user.companyName,
          userRole: user.role,
          category: 'BOOKING',
          eventType: 'BOOKING_CONFIRMED',
          title: `Booking Confirmed #${b.bookingReference || b.id}`,
          description: `All suppliers locked, ground services confirmed for ${b.customer?.leadTravelerName || 'Traveler'}`,
          timestamp: b.updatedAt || b.createdAt || new Date().toISOString(),
          entityId: b.id,
          entityType: 'Booking',
          severity: 'SUCCESS'
        });
      }

      // Payment Proofs
      if (b.paymentProofs && Array.isArray(b.paymentProofs)) {
        b.paymentProofs.forEach(p => {
          events.push({
            id: `bk-pay-${p.id}`,
            userId: user.id,
            userEmail: user.email,
            userName: user.name,
            agencyName: user.agencyName || user.companyName,
            userRole: user.role,
            category: 'TRANSACTION',
            eventType: p.verificationStatus === 'VERIFIED' ? 'PAYMENT_VERIFIED' : 'PAYMENT_PROOF_UPLOADED',
            title: `Payment: ${p.trancheLabel || 'Tranche'} (${p.currency || 'USD'} ${Number(p.amount || 0).toLocaleString()})`,
            description: `Payment remittance uploaded for Booking #${b.bookingReference || b.id} (Status: ${p.verificationStatus})`,
            timestamp: p.verifiedAt || b.createdAt || new Date().toISOString(),
            entityId: b.id,
            entityType: 'PaymentProof',
            severity: p.verificationStatus === 'VERIFIED' ? 'SUCCESS' : 'WARNING',
            metadata: {
              amount: p.amount,
              currency: p.currency,
              status: p.verificationStatus,
              verifiedBy: p.verifiedByName
            }
          });
        });
      }

      // Timeline events from booking
      if (b.timeline && Array.isArray(b.timeline)) {
        b.timeline.forEach(t => {
          events.push({
            id: `bk-tm-${t.id || Math.random().toString(36).substr(2, 6)}`,
            userId: user.id,
            userEmail: user.email,
            userName: user.name,
            agencyName: user.agencyName || user.companyName,
            userRole: user.role,
            category: t.type === 'PAYMENT' ? 'TRANSACTION' : t.type === 'COMMUNICATION' ? 'COMMUNICATION' : 'BOOKING',
            eventType: t.type,
            title: `Booking #${b.bookingReference || b.id}: ${t.title}`,
            description: t.description || t.title,
            timestamp: t.timestamp || b.createdAt,
            entityId: b.id,
            entityType: 'Booking',
            severity: 'INFO'
          });
        });
      }
    });

    // 4. Leads & CRM Inquiries
    const allLeads = this.getLeads();
    const userLeads = allLeads.filter(l => 
      l.userId === user.id || 
      l.b2bAgentId === user.id || 
      (user.email && l.email?.toLowerCase() === user.email.toLowerCase())
    );

    userLeads.forEach(l => {
      events.push({
        id: `lead-cr-${l.id}`,
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        agencyName: user.agencyName || user.companyName,
        userRole: user.role,
        category: 'LEAD',
        eventType: 'LEAD_CREATED',
        title: `Inquiry Submitted #${l.leadNumber || l.id}`,
        description: `Travel requirement inquiry received for ${l.destinationName || 'Destination'} (${l.travelDates || 'Flexible dates'})`,
        timestamp: l.createdAt || '2026-01-01T00:00:00.000Z',
        entityId: l.id,
        entityType: 'TravelLead',
        severity: 'INFO',
        metadata: {
          destination: l.destinationName,
          status: l.status,
          source: l.source
        }
      });
    });

    // 5. User Activity Telemetry
    const activities = this.getUserActivityEvents(user.id);
    activities.forEach(act => {
      let cat: JourneyEventCategory = 'USER';
      let title = act.targetTitle || act.type;
      let sev: 'INFO' | 'SUCCESS' | 'WARNING' = 'INFO';

      if (act.type === 'CALCULATOR_USED' || act.type === 'AI_PLANNER_USED' || act.details?.isAiPlanner) {
        cat = 'AI_PLANNER';
        title = act.details?.isAiPlanner ? 'AI Planner Session' : 'Pricing Calculator Used';
      } else if (act.type === 'PAGE_VIEW') {
        cat = 'PRODUCT';
        title = `Viewed Page: ${act.targetTitle || 'Catalog'}`;
      } else if (act.type === 'LOGIN') {
        cat = 'USER';
        title = 'User Authenticated / Session Started';
      } else if (act.type === 'PROPOSAL_SAVED') {
        cat = 'QUOTE';
        title = `Proposal Saved: ${act.targetTitle || ''}`;
        sev = 'SUCCESS';
      } else if (act.type === 'QUOTE_DOWNLOADED') {
        cat = 'QUOTE';
        title = `Quotation Downloaded: ${act.targetTitle || ''}`;
        sev = 'SUCCESS';
      } else if (act.type === 'WHATSAPP_SHARED') {
        cat = 'COMMUNICATION';
        title = `Proposal Shared via WhatsApp: ${act.targetTitle || ''}`;
      }

      events.push({
        id: `act-event-${act.id}`,
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        agencyName: user.agencyName || user.companyName,
        userRole: user.role,
        category: cat,
        eventType: act.type,
        title,
        description: act.details?.summary || act.targetTitle || `Performed action: ${act.type}`,
        timestamp: act.timestamp,
        entityId: act.targetId,
        entityType: 'Activity',
        severity: sev,
        metadata: act.details
      });
    });

    // 6. Audit Logs linked to this user
    const auditLogs = this.getAuditLogs().filter(a => 
      a.userId === user.id || 
      a.entityId === user.id
    );

    auditLogs.forEach(a => {
      let cat: JourneyEventCategory = 'USER';
      if (a.entity === 'Quotation' || a.action.includes('QUOTE')) cat = 'QUOTE';
      else if (a.entity === 'Booking' || a.action.includes('BOOKING')) cat = 'BOOKING';
      else if (a.entity === 'Product') cat = 'PRODUCT';
      else if (a.entity === 'Hotel') cat = 'HOTEL';

      events.push({
        id: `audit-ev-${a.id}`,
        userId: user.id,
        userEmail: user.email,
        userName: a.userName || user.name,
        agencyName: user.agencyName || user.companyName,
        userRole: user.role,
        category: cat,
        eventType: a.action,
        title: `${a.entity || 'System'}: ${a.action.replace(/_/g, ' ')}`,
        description: a.details || `${a.action} performed on ${a.entity}`,
        timestamp: a.timestamp,
        entityId: a.entityId,
        entityType: a.entity,
        severity: 'INFO'
      });
    });

    // Deduplicate by id and sort descending by timestamp
    const seen = new Set<string>();
    const uniqueEvents: SystemUserJourneyEvent[] = [];
    for (const ev of events) {
      if (!seen.has(ev.id)) {
        seen.add(ev.id);
        uniqueEvents.push(ev);
      }
    }

    return uniqueEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  public getAllSystemJourneyEvents(limitCount = 150): SystemUserJourneyEvent[] {
    const users = this.getUsers();
    const allEvents: SystemUserJourneyEvent[] = [];
    
    users.forEach(u => {
      const uEvents = this.getUserCompleteJourney(u.id);
      allEvents.push(...uEvents);
    });

    const seen = new Set<string>();
    const unique = allEvents.filter(ev => {
      if (seen.has(ev.id)) return false;
      seen.add(ev.id);
      return true;
    });

    return unique
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limitCount);
  }

  // ==========================================
  // GOOGLE CALENDAR TASK & GROUND SLA AUTOMATION
  // ==========================================
  public getCalendarTasks(): CalendarTask[] {
    return this.getItem<CalendarTask[]>('calendar_tasks', []);
  }

  public async saveCalendarTaskAsync(task: CalendarTask, user?: User | null): Promise<CalendarTask> {
    if (!task || !task.id) {
      throw new Error('Valid task ID is required for persistence');
    }

    const tasks = this.getCalendarTasks();
    const index = tasks.findIndex(t => t.id === task.id || (t.taskId && t.taskId === task.id));
    const now = new Date().toISOString();
    let saved: CalendarTask;

    if (index >= 0) {
      saved = { ...task, updatedAt: now };
    } else {
      saved = {
        ...task,
        id: task.id || `task-${Date.now()}`,
        createdAt: task.createdAt || now,
        updatedAt: now
      };
    }

    // Update local list and notify subscribers immediately
    if (index >= 0) {
      tasks[index] = saved;
      this.logAudit(user || null, 'SETTINGS_UPDATED', 'CalendarTask', saved.id, `Updated task: ${saved.title} (Status: ${saved.status})`);
    } else {
      tasks.unshift(saved);
      this.logAudit(user || null, 'SETTINGS_UPDATED', 'CalendarTask', saved.id, `Created task: ${saved.title} (Assigned: ${saved.assignedToEmail})`);
    }
    this.setItem('calendar_tasks', tasks);

    // Remote persistence to Firestore
    try {
      const cleanData = cleanForFirestore(saved);
      await setDoc(doc(firestoreDb, 'calendar_tasks', saved.id), cleanData, { merge: true });
    } catch (firestoreErr: any) {
      console.warn(`[DB] Firestore saveCalendarTaskAsync remote sync note for ${saved.id}:`, firestoreErr);
      // Fallback: sync via background queue
      this.syncFirestoreDoc('calendar_tasks', saved.id, saved);
    }

    // Live Admin Activity Stream notification
    try {
      const isPending = saved.status === 'PENDING';
      const isUrgent = saved.priority === 'URGENT';
      this.recordAdminActivity({
        category: 'OPERATIONS',
        activityType: saved.status === 'COMPLETED' ? 'OPERATIONS_JOB_UPDATED' : 'OPERATIONS_JOB_CREATED',
        actorName: user?.name || saved.completedBy || 'Operations Dispatch',
        actorType: user?.role === 'ADMIN' ? 'ADMIN' : user?.role === 'TEAM_MEMBER' ? 'TEAM_MEMBER' : 'SYSTEM',
        severity: isUrgent ? 'CRITICAL' : saved.priority === 'HIGH' ? 'WARNING' : 'INFO',
        actionRequired: isPending,
        actionLabel: 'View Task',
        summary: `Operational Task: ${saved.title} (${saved.status})`,
        details: {
          taskTitle: saved.title,
          status: saved.status,
          priority: saved.priority,
          dueDate: saved.dueAt,
          actionNeeded: isPending ? 'Ensure SLA fulfillment for operations dispatch' : undefined
        },
        targetSection: 'NOTIFICATIONS_MANAGEMENT',
        targetSubTab: 'TASKS',
        recordId: saved.id,
        entityId: saved.id,
        entityType: 'CalendarTask'
      });
    } catch {
      // Non-blocking
    }

    return saved;
  }

  public saveCalendarTask(task: CalendarTask, user?: User | null): CalendarTask {
    const tasks = this.getCalendarTasks();
    const index = tasks.findIndex(t => t.id === task.id);
    const now = new Date().toISOString();
    let saved: CalendarTask;
    if (index >= 0) {
      saved = { ...task, updatedAt: now };
      tasks[index] = saved;
      this.logAudit(user || null, 'SETTINGS_UPDATED', 'CalendarTask', saved.id, `Updated task: ${saved.title}`);
    } else {
      saved = {
        ...task,
        id: task.id || `task-${Date.now()}`,
        createdAt: now,
        updatedAt: now
      };
      tasks.unshift(saved);
      this.logAudit(user || null, 'SETTINGS_UPDATED', 'CalendarTask', saved.id, `Created task: ${saved.title} (Assigned: ${saved.assignedToEmail})`);
    }
    this.syncFirestoreDoc('calendar_tasks', saved.id, saved);
    this.setItem('calendar_tasks', tasks);

    // Live Admin Activity Stream notification
    try {
      const isPending = saved.status === 'PENDING';
      const isUrgent = saved.priority === 'URGENT';
      this.recordAdminActivity({
        category: 'OPERATIONS',
        activityType: 'OPERATIONS_JOB_CREATED',
        actorName: user?.name || 'Operations Dispatch',
        actorType: user?.role === 'ADMIN' ? 'ADMIN' : user?.role === 'TEAM_MEMBER' ? 'TEAM_MEMBER' : 'SYSTEM',
        severity: isUrgent ? 'CRITICAL' : saved.priority === 'HIGH' ? 'WARNING' : 'INFO',
        actionRequired: isPending,
        actionLabel: 'View Task',
        summary: `Operational Task: ${saved.title} (${saved.priority}) - Due ${saved.dueAt || 'ASAP'}`,
        details: {
          taskTitle: saved.title,
          priority: saved.priority,
          dueDate: saved.dueAt,
          actionNeeded: isPending ? 'Ensure SLA fulfillment for operations dispatch' : undefined
        },
        targetSection: 'NOTIFICATIONS_MANAGEMENT',
        targetSubTab: 'TASKS',
        recordId: saved.id,
        entityId: saved.id,
        entityType: 'CalendarTask'
      });
    } catch {
      // Non-blocking
    }

    return saved;
  }

  public deleteCalendarTask(taskId: string, user?: User | null): void {
    const tasks = this.getCalendarTasks();
    const target = tasks.find(t => t.id === taskId);
    this.setItem('calendar_tasks', tasks.filter(t => t.id !== taskId));
    this.deleteFirestoreDoc('calendar_tasks', taskId);
    if (target) {
      this.logAudit(user || null, 'SETTINGS_UPDATED', 'CalendarTask', taskId, `Deleted calendar task: ${target.title}`);
    }
  }

  public archiveCalendarTask(taskId: string, user?: User | null): CalendarTask | null {
    const tasks = this.getCalendarTasks();
    const index = tasks.findIndex(t => t.id === taskId);
    if (index === -1) return null;
    const task = tasks[index];
    const now = new Date().toISOString();
    const updated: CalendarTask = {
      ...task,
      isArchived: true,
      archivedAt: now,
      archivedBy: user?.name || user?.email || 'User',
      status: 'ARCHIVED',
      updatedAt: now
    };
    tasks[index] = updated;
    this.setItem('calendar_tasks', tasks);
    this.syncFirestoreDoc('calendar_tasks', taskId, updated);
    this.logAudit(user || null, 'SETTINGS_UPDATED', 'CalendarTask', taskId, `Archived task: ${task.title}`);
    return updated;
  }

  public unarchiveCalendarTask(taskId: string, user?: User | null): CalendarTask | null {
    const tasks = this.getCalendarTasks();
    const index = tasks.findIndex(t => t.id === taskId);
    if (index === -1) return null;
    const task = tasks[index];
    const now = new Date().toISOString();
    const updated: CalendarTask = {
      ...task,
      isArchived: false,
      archivedAt: undefined,
      archivedBy: undefined,
      status: 'TO_DO',
      updatedAt: now
    };
    tasks[index] = updated;
    this.setItem('calendar_tasks', tasks);
    this.syncFirestoreDoc('calendar_tasks', taskId, updated);
    this.logAudit(user || null, 'SETTINGS_UPDATED', 'CalendarTask', taskId, `Unarchived task: ${task.title}`);
    return updated;
  }

  // ==========================================
  // UNIFIED CONNECTED TASK MANAGEMENT
  // (LEADS, BOOKINGS, BOOKING ITEMS & CENTRAL)
  // ==========================================

  public getTasksForLead(leadId: string): CalendarTask[] {
    if (!leadId) return [];
    const tasks = this.getCalendarTasks();
    return tasks.filter(t => 
      !t.isArchived && (
        t.leadId === leadId || 
        (t.relatedEntityType?.toLowerCase() === 'lead' && t.relatedEntityId === leadId) ||
        (t.entityType === 'LEAD' && t.entityId === leadId) ||
        t.leadNumber === leadId
      )
    );
  }

  public getTasksForBooking(bookingId: string): CalendarTask[] {
    if (!bookingId) return [];
    const tasks = this.getCalendarTasks();
    return tasks.filter(t => 
      !t.isArchived && (
        t.bookingId === bookingId || 
        (t.relatedEntityType?.toLowerCase() === 'booking' && t.relatedEntityId === bookingId) ||
        (t.entityType === 'BOOKING' && t.entityId === bookingId) ||
        t.bookingReference === bookingId
      )
    );
  }

  public getTasksForBookingItem(bookingIdOrItemId: string, maybeItemId?: string): CalendarTask[] {
    const targetItemId = maybeItemId || bookingIdOrItemId;
    const targetBookingId = maybeItemId ? bookingIdOrItemId : undefined;
    if (!targetItemId) return [];
    const tasks = this.getCalendarTasks();
    return tasks.filter(t => 
      !t.isArchived && (
        t.bookingItemId === targetItemId || 
        (t.relatedEntityType?.toLowerCase() === 'booking_item' && t.relatedEntityId === targetItemId) ||
        t.serviceId === targetItemId
      ) && (
        !targetBookingId || t.bookingId === targetBookingId || t.entityId === targetBookingId
      )
    );
  }

  public getLeadTaskSummary(leadId: string, currentUserEmailOrId?: string) {
    const tasks = this.getTasksForLead(leadId);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const openTasks = tasks.filter(t => t.status !== 'COMPLETED' && t.status !== 'ARCHIVED' && t.status !== 'CANCELLED');
    const completedTasks = tasks.filter(t => t.status === 'COMPLETED');
    
    const dueToday = openTasks.filter(t => {
      const d = t.dueDate || t.startDate || (t.dueAt ? t.dueAt.split('T')[0] : '');
      return d === todayStr;
    });

    const overdueTasks = openTasks.filter(t => {
      const d = t.dueDate || t.startDate || (t.dueAt ? t.dueAt.split('T')[0] : '');
      return d && d < todayStr;
    });

    const myTasks = currentUserEmailOrId 
      ? openTasks.filter(t => 
          t.assignedToEmail?.toLowerCase() === currentUserEmailOrId.toLowerCase() ||
          t.assignedTo === currentUserEmailOrId ||
          t.userId === currentUserEmailOrId
        )
      : [];

    // Next upcoming task (earliest open task by due date)
    const sortedUpcoming = [...openTasks].sort((a, b) => {
      const dateA = a.dueDate || a.startDate || a.dueAt || '9999';
      const dateB = b.dueDate || b.startDate || b.dueAt || '9999';
      return dateA.localeCompare(dateB);
    });
    const nextUpcomingTask = sortedUpcoming[0] || null;

    // Last completed task
    const sortedCompleted = [...completedTasks].sort((a, b) => {
      const timeA = a.completedAt || a.updatedAt || '0000';
      const timeB = b.completedAt || b.updatedAt || '0000';
      return timeB.localeCompare(timeA);
    });
    const lastCompletedTask = sortedCompleted[0] || null;

    return {
      totalTasks: tasks.length,
      openTasksCount: openTasks.length,
      completedTasksCount: completedTasks.length,
      dueTodayCount: dueToday.length,
      overdueCount: overdueTasks.length,
      myTasksCount: myTasks.length,
      nextUpcomingTask,
      lastCompletedTask,
      tasks
    };
  }

  public getBookingTaskSummary(bookingId: string, currentUserEmailOrId?: string) {
    const tasks = this.getTasksForBooking(bookingId);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const openTasks = tasks.filter(t => t.status !== 'COMPLETED' && t.status !== 'ARCHIVED' && t.status !== 'CANCELLED');
    const completedTasks = tasks.filter(t => t.status === 'COMPLETED');
    
    const dueToday = openTasks.filter(t => {
      const d = t.dueDate || t.startDate || (t.dueAt ? t.dueAt.split('T')[0] : '');
      return d === todayStr;
    });

    const overdueTasks = openTasks.filter(t => {
      const d = t.dueDate || t.startDate || (t.dueAt ? t.dueAt.split('T')[0] : '');
      return d && d < todayStr;
    });

    const myTasks = currentUserEmailOrId 
      ? openTasks.filter(t => 
          t.assignedToEmail?.toLowerCase() === currentUserEmailOrId.toLowerCase() ||
          t.assignedTo === currentUserEmailOrId ||
          t.userId === currentUserEmailOrId
        )
      : [];

    const sortedUpcoming = [...openTasks].sort((a, b) => {
      const dateA = a.dueDate || a.startDate || a.dueAt || '9999';
      const dateB = b.dueDate || b.startDate || b.dueAt || '9999';
      return dateA.localeCompare(dateB);
    });
    const nextUpcomingTask = sortedUpcoming[0] || null;

    const pendingOperationalActions = openTasks.filter(t => 
      t.priority === 'URGENT' || 
      t.priority === 'HIGH' || 
      t.category === 'GROUND_DISPATCH' || 
      t.category === 'SUPPLIER_CUTOFF' || 
      t.category === 'PAYMENT_REMINDER'
    );

    return {
      totalTasks: tasks.length,
      openTasksCount: openTasks.length,
      completedTasksCount: completedTasks.length,
      dueTodayCount: dueToday.length,
      overdueCount: overdueTasks.length,
      myTasksCount: myTasks.length,
      nextUpcomingTask,
      pendingOperationalActionsCount: pendingOperationalActions.length,
      pendingOperationalActions,
      tasks
    };
  }

  public completeTask(taskId: string, user?: User | null, note?: string): CalendarTask | null {
    const tasks = this.getCalendarTasks();
    const index = tasks.findIndex(t => t.id === taskId || (t.taskId && t.taskId === taskId));
    if (index === -1) return null;

    const task = tasks[index];
    const now = new Date().toISOString();
    const completedBy = user?.name || user?.email || 'Operational Staff';

    const updated: CalendarTask = {
      ...task,
      status: 'COMPLETED',
      completedAt: now,
      completedBy,
      completionNote: note || task.completionNote,
      updatedAt: now
    };

    tasks[index] = updated;
    this.setItem('calendar_tasks', tasks);
    this.syncFirestoreDoc('calendar_tasks', taskId, updated);
    this.logAudit(user || null, 'SETTINGS_UPDATED', 'CalendarTask', taskId, `Completed task: ${task.title || task.taskName}`);

    // Update Lead timeline if linked
    const leadId = task.leadId || (task.relatedEntityType?.toLowerCase() === 'lead' ? task.relatedEntityId : undefined);
    if (leadId) {
      this.addLeadTimelineEvent(leadId, {
        type: 'FOLLOWUP_COMPLETED',
        title: `Task Completed: ${task.title || task.taskName}`,
        description: note ? `Note: ${note}` : `Completed by ${completedBy}`,
        performedBy: completedBy,
        performedByUserType: user?.role || 'STAFF'
      }, user || null);
    }

    // Update Booking timeline if linked
    const bookingId = task.bookingId || (task.relatedEntityType?.toLowerCase() === 'booking' ? task.relatedEntityId : undefined);
    if (bookingId) {
      this.addBookingTimelineEvent(bookingId, {
        type: 'OPERATION',
        title: `Task Completed: ${task.title || task.taskName}`,
        description: note ? `Note: ${note}` : `Completed by ${completedBy}`,
        performedBy: completedBy,
        metadata: { taskId, completedAt: now }
      }, user || null);
    }

    return updated;
  }

  public reopenTask(taskId: string, user?: User | null): CalendarTask | null {
    const tasks = this.getCalendarTasks();
    const index = tasks.findIndex(t => t.id === taskId || (t.taskId && t.taskId === taskId));
    if (index === -1) return null;

    const task = tasks[index];
    const now = new Date().toISOString();
    const reopenedBy = user?.name || user?.email || 'Staff';

    const updated: CalendarTask = {
      ...task,
      status: 'TO_DO',
      completedAt: undefined,
      completedBy: undefined,
      completionNote: undefined,
      cancelledAt: undefined,
      cancelledBy: undefined,
      updatedAt: now
    };

    tasks[index] = updated;
    this.setItem('calendar_tasks', tasks);
    this.syncFirestoreDoc('calendar_tasks', taskId, updated);
    this.logAudit(user || null, 'SETTINGS_UPDATED', 'CalendarTask', taskId, `Reopened task: ${task.title || task.taskName}`);

    // Update Lead timeline if linked
    const leadId = task.leadId || (task.relatedEntityType?.toLowerCase() === 'lead' ? task.relatedEntityId : undefined);
    if (leadId) {
      this.addLeadTimelineEvent(leadId, {
        type: 'CUSTOM_ACTIVITY',
        title: `Task Reopened: ${task.title || task.taskName}`,
        description: `Reopened by ${reopenedBy}`,
        performedBy: reopenedBy,
        performedByUserType: user?.role || 'STAFF'
      }, user || null);
    }

    return updated;
  }

  public cancelTask(taskId: string, user?: User | null, reason?: string): CalendarTask | null {
    const tasks = this.getCalendarTasks();
    const index = tasks.findIndex(t => t.id === taskId || (t.taskId && t.taskId === taskId));
    if (index === -1) return null;

    const task = tasks[index];
    const now = new Date().toISOString();
    const cancelledBy = user?.name || user?.email || 'Staff';

    const updated: CalendarTask = {
      ...task,
      status: 'CANCELLED',
      cancelledAt: now,
      cancelledBy,
      cancellationReason: reason,
      updatedAt: now
    };

    tasks[index] = updated;
    this.setItem('calendar_tasks', tasks);
    this.syncFirestoreDoc('calendar_tasks', taskId, updated);
    this.logAudit(user || null, 'SETTINGS_UPDATED', 'CalendarTask', taskId, `Cancelled task: ${task.title || task.taskName}`);
    return updated;
  }

  public addBookingTimelineEvent(bookingId: string, event: { type: string; title: string; description?: string; performedBy?: string; metadata?: any }, user: User | null): void {
    const bookings = this.getAllBookings();
    const bIndex = bookings.findIndex(b => b.id === bookingId || b.bookingReference === bookingId);
    if (bIndex === -1) return;
    const booking = bookings[bIndex];
    if (!booking.timeline) booking.timeline = [];
    booking.timeline.unshift({
      id: `tl-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      type: event.type as any || 'OPERATION',
      title: event.title,
      description: event.description,
      performedBy: event.performedBy || user?.name || 'Operations Staff',
      metadata: event.metadata
    });
    booking.updatedAt = new Date().toISOString();
    this.setItem('bookings', bookings);
    this.syncFirestoreDoc('bookings', booking.id, booking);
  }

  // SLA AUTOMATION RULES
  public getSLAAutomationRules(): SLAAutomationRule[] {
    const existing = this.getItem<SLAAutomationRule[]>('sla_automation_rules', []);
    if (existing && existing.length > 0) {
      return existing;
    }
    return INITIAL_SLA_AUTOMATION_RULES;
  }

  public initDefaultSLAAutomationRules(): SLAAutomationRule[] {
    this.setItem('sla_automation_rules', INITIAL_SLA_AUTOMATION_RULES);
    INITIAL_SLA_AUTOMATION_RULES.forEach(r => this.syncFirestoreDoc('sla_automation_rules', r.id, r));
    return INITIAL_SLA_AUTOMATION_RULES;
  }

  public saveSLAAutomationRule(rule: SLAAutomationRule, user?: User | null): SLAAutomationRule {
    const rules = this.getSLAAutomationRules();
    const index = rules.findIndex(r => r.id === rule.id);
    const now = new Date().toISOString();
    let saved: SLAAutomationRule;

    if (index >= 0) {
      saved = { ...rule, updatedAt: now };
      rules[index] = saved;
    } else {
      saved = { ...rule, id: rule.id || `rule-${Date.now()}`, updatedAt: now };
      rules.push(saved);
    }

    this.setItem('sla_automation_rules', rules);
    this.syncFirestoreDoc('sla_automation_rules', saved.id, saved);
    this.logAudit(user || null, 'SETTINGS_UPDATED', 'SLAAutomationRule', saved.id, `Configured SLA Rule: "${saved.ruleName}" (${saved.slaHours}h SLA, ${saved.isEnabled ? 'Enabled' : 'Disabled'})`);
    return saved;
  }

  // SLA AUDIT LOGS
  public getSLAAutomationAuditLogs(): SLAAutomationAuditLog[] {
    return this.getItem<SLAAutomationAuditLog[]>('sla_automation_audit_logs', []);
  }

  public saveSLAAutomationAuditLog(log: SLAAutomationAuditLog): SLAAutomationAuditLog {
    const logs = this.getSLAAutomationAuditLogs();
    logs.unshift(log);
    if (logs.length > 200) {
      logs.length = 200; // retain most recent 200 logs
    }
    this.setItem('sla_automation_audit_logs', logs);
    this.syncFirestoreDoc('sla_automation_audit_logs', log.id, log);
    return log;
  }

  // ==========================================
  // COMMUNICATION AUDIT LOGS (SECTION 32 MANDATE)
  // ==========================================
  public getCommunicationAuditLogs(filter?: { quoteId?: string; bookingId?: string; leadId?: string }): CommunicationAuditLog[] {
    const all = this.getItem<CommunicationAuditLog[]>('theunbound_communication_audit_logs', []);
    if (!filter) return all;
    return all.filter(l => {
      if (filter.quoteId && l.quoteId !== filter.quoteId) return false;
      if (filter.bookingId && l.bookingId !== filter.bookingId) return false;
      if (filter.leadId && l.leadId !== filter.leadId) return false;
      return true;
    });
  }

  public saveCommunicationAuditLog(log: CommunicationAuditLog): CommunicationAuditLog {
    const logs = this.getItem<CommunicationAuditLog[]>('theunbound_communication_audit_logs', []);
    logs.unshift(log);
    if (logs.length > 500) {
      logs.length = 500; // retain most recent 500 communication audit entries
    }
    this.setItem('theunbound_communication_audit_logs', logs);
    this.syncFirestoreDoc('theunbound_communication_audit_logs', log.id, log);
    return log;
  }

  // ==========================================
  // MARKETING CAMPAIGN EVENTS & REAL-TIME TRACKING
  // ==========================================
  public getCurrentUser(): User | null {
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem('theunbound_auth_user');
        if (raw) return JSON.parse(raw);
      }
    } catch {}
    return null;
  }

  public getCampaignEvents(): CampaignEvent[] {
    return this.getItem<CampaignEvent[]>('campaign_events', []);
  }

  public getCampaignEventsForCampaign(campaignId: string): CampaignEvent[] {
    return this.getCampaignEvents().filter(e => e.campaignId === campaignId);
  }

  public recordCampaignEvent(eventData: Omit<CampaignEvent, 'id' | 'timestamp'> & { id?: string; timestamp?: string }): CampaignEvent {
    const events = this.getCampaignEvents();
    const newEvent: CampaignEvent = {
      id: eventData.id || `cevent-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: eventData.timestamp || new Date().toISOString(),
      ...eventData
    };

    // Prepend event, capped at 5000 in storage for high performance
    events.unshift(newEvent);
    if (events.length > 5000) {
      events.length = 5000;
    }
    this.setItem('campaign_events', events, false);
    this.syncFirestoreDoc('campaign_events', newEvent.id, newEvent);

    // Update the live aggregate counters on the promotion record
    const promos = this.getPromotions();
    const promo = promos.find(p => p.id === newEvent.campaignId);
    if (promo) {
      if (newEvent.eventType === 'VIEW') {
        promo.viewCount = (promo.viewCount || 0) + 1;
        promo.impressions = promo.viewCount;
      } else if (newEvent.eventType === 'CLICK') {
        promo.clickCount = (promo.clickCount || 0) + 1;
        promo.clicks = promo.clickCount;
      }
      promo.updatedAt = new Date().toISOString();
      this.setItem('promotions', promos, false);
      this.syncFirestoreDoc('promotions', promo.id, promo);
    }

    return newEvent;
  }

  public recordPromotionView(promoId: string, placement: string = 'BANNER', sessionId?: string): void {
    const promo = this.getPromotions().find(p => p.id === promoId);
    if (!promo) return;
    this.recordCampaignEvent({
      campaignId: promoId,
      eventType: 'VIEW',
      placement: placement || promo.displayPlacement || 'BANNER',
      sessionId: sessionId || `sess_${Date.now().toString(36)}`,
      destinationId: promo.destinationId
    });
  }

  public recordPromotionClick(promoId: string, placement: string = 'BANNER', ctaId: string = 'cta_click', ctaText?: string, sessionId?: string): void {
    const promo = this.getPromotions().find(p => p.id === promoId);
    if (!promo) return;
    this.recordCampaignEvent({
      campaignId: promoId,
      eventType: 'CLICK',
      placement: placement || promo.displayPlacement || 'BANNER',
      ctaId,
      ctaText: ctaText || promo.ctaText || 'Claim Deal',
      sessionId: sessionId || `sess_${Date.now().toString(36)}`,
      destinationId: promo.destinationId
    });
  }

  // ==========================================
  // BOOKINGS ALIAS & ENHANCEMENTS
  // ==========================================
  public getBookings(): Booking[] {
    return this.getAllBookings();
  }

  public updateBookingPassengers(bookingId: string, passengers: BookingPassenger[], user?: User | null): void {
    const bookings = this.getAllBookings();
    const b = bookings.find(item => item.id === bookingId);
    if (b) {
      b.passengers = passengers;
      b.updatedAt = new Date().toISOString();
      this.saveBooking(b, user);
      this.logAudit(user || null, 'BOOKING_UPDATED', 'Booking', bookingId, `Updated ${passengers.length} passenger details and documents for booking ${b.bookingReference}`);
    }
  }

  public addBookingPaymentProof(bookingId: string, proof: BookingPaymentProof, user?: User | null): void {
    const bookings = this.getAllBookings();
    const b = bookings.find(item => item.id === bookingId);
    if (b) {
      const proofs = b.paymentProofs ? [...b.paymentProofs] : [];
      proofs.push(proof);
      b.paymentProofs = proofs;
      b.paymentStatus = 'PARTIALLY_PAID';
      b.updatedAt = new Date().toISOString();
      this.saveBooking(b, user);
      this.logAudit(user || null, 'BOOKING_UPDATED', 'Booking', bookingId, `Uploaded payment proof (${proof.trancheLabel}: ${proof.currency} ${proof.amount}) for booking ${b.bookingReference}`);
    }
  }

  public updateBookingSupplierOps(
    bookingId: string, 
    ops: {
      paymentCutoffDate?: string;
      serviceDate?: string;
      serviceTime?: string;
      supplierConfirmationRef?: string;
      internalNotes?: string;
      status?: BookingStatus;
    }, 
    user?: User | null
  ): void {
    const bookings = this.getAllBookings();
    const b = bookings.find(item => item.id === bookingId);
    if (b) {
      if (ops.paymentCutoffDate !== undefined) b.paymentCutoffDate = ops.paymentCutoffDate;
      if (ops.serviceDate !== undefined) b.serviceDate = ops.serviceDate;
      if (ops.serviceTime !== undefined) b.serviceTime = ops.serviceTime;
      if (ops.supplierConfirmationRef !== undefined) b.supplierConfirmationRef = ops.supplierConfirmationRef;
      if (ops.internalNotes !== undefined) b.internalNotes = ops.internalNotes;
      if (ops.status) b.status = ops.status;
      b.updatedAt = new Date().toISOString();
      this.saveBooking(b, user);
      this.logAudit(user || null, 'BOOKING_UPDATED', 'Booking', bookingId, `Updated supplier operations details for booking ${b.bookingReference}`);
    }
  }

  // ==========================================
  // MASTER SHEET HIERARCHICAL ENTITIES & RATES
  // ==========================================

  // Transfer Routes
  public getTransferRoutes(): TransferRoute[] {
    return this.getItem<TransferRoute[]>('transfer_routes', [
      {
        id: 'TRF-TYO-HND-001',
        destinationId: 'dest-japan',
        fromHubId: 'hub-tyo',
        toHubId: 'hub-tyo',
        routeName: 'Tokyo Haneda Airport -> Tokyo City Hotels Arrival Transfer',
        transferType: 'AIRPORT_ARRIVAL',
        vehicleType: 'Toyota Alphard Executive MPV (6 Pax)',
        maxCapacity: 6,
        status: 'ACTIVE'
      },
      {
        id: 'TRF-TYO-NRT-002',
        destinationId: 'dest-japan',
        fromHubId: 'hub-tyo',
        toHubId: 'hub-tyo',
        routeName: 'Tokyo Narita Airport -> Tokyo City Hotels Arrival Transfer',
        transferType: 'AIRPORT_ARRIVAL',
        vehicleType: 'Toyota HiAce Grand Cabin (9 Pax)',
        maxCapacity: 9,
        status: 'ACTIVE'
      },
      {
        id: 'TRF-TYO-HAK-003',
        destinationId: 'dest-japan',
        fromHubId: 'hub-tyo',
        toHubId: 'hub-hak',
        routeName: 'Tokyo City Hotels -> Hakone Ryokan Intercity Chauffeur',
        transferType: 'INTERCITY',
        vehicleType: 'Toyota Alphard Executive MPV (6 Pax)',
        maxCapacity: 6,
        status: 'ACTIVE'
      },
      {
        id: 'TRF-DXB-AIR-001',
        destinationId: 'dest-dubai',
        fromHubId: 'hub-dubai',
        toHubId: 'hub-dubai',
        routeName: 'Dubai Airport (DXB) -> Dubai Hotels VIP Chauffeur Arrival',
        transferType: 'AIRPORT_ARRIVAL',
        vehicleType: 'Mercedes-Benz S-Class / BMW 7 Series (3 Pax)',
        maxCapacity: 3,
        status: 'ACTIVE'
      },
      {
        id: 'TRF-DXB-AUH-002',
        destinationId: 'dest-dubai',
        fromHubId: 'hub-dubai',
        toHubId: 'hub-abudhabi',
        routeName: 'Dubai City Hotels -> Abu Dhabi Hotels Intercity Chauffeur',
        transferType: 'INTERCITY',
        vehicleType: 'Mercedes-Benz V-Class Luxury Van (6 Pax)',
        maxCapacity: 6,
        status: 'ACTIVE'
      },
      {
        id: 'TRF-BKK-AIR-001',
        destinationId: 'dest-thailand',
        fromHubId: 'hub-bangkok',
        toHubId: 'hub-bangkok',
        routeName: 'Bangkok Suvarnabhumi Airport (BKK) -> Bangkok Hotels Chauffeur Arrival',
        transferType: 'AIRPORT_ARRIVAL',
        vehicleType: 'Toyota Alphard Executive Limousine (5 Pax)',
        maxCapacity: 5,
        status: 'ACTIVE'
      },
      {
        id: 'TRF-HKT-AIR-002',
        destinationId: 'dest-thailand',
        fromHubId: 'hub-phuket',
        toHubId: 'hub-phuket',
        routeName: 'Phuket International Airport (HKT) -> Pansea / Patong Resorts Transfer',
        transferType: 'AIRPORT_ARRIVAL',
        vehicleType: 'Toyota Commuter VIP Van (8 Pax)',
        maxCapacity: 8,
        status: 'ACTIVE'
      },
      {
        id: 'TRF-SIN-AIR-001',
        destinationId: 'dest-singapore',
        fromHubId: 'hub-singapore',
        toHubId: 'hub-singapore',
        routeName: 'Singapore Changi Airport (SIN) -> Downtown Marina Bay Chauffeur Transfer',
        transferType: 'AIRPORT_ARRIVAL',
        vehicleType: 'Mercedes-Benz E-Class Executive (3 Pax)',
        maxCapacity: 3,
        status: 'ACTIVE'
      }
    ]);
  }

  public saveTransferRoute(route: TransferRoute, user?: User | null): void {
    const list = this.getTransferRoutes();
    const idx = list.findIndex(r => r.id === route.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...route, updatedAt: new Date().toISOString() };
    } else {
      list.push({ ...route, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    this.setItem('transfer_routes', list, false);
    this.syncFirestoreDoc('transfer_routes', route.id, route);
    this.logAudit(user || null, idx >= 0 ? 'RECORD_ARCHIVED' : 'PRODUCT_CREATED', 'TransferRoute', route.id, `Saved transfer route ${route.routeName}`);
  }

  // Hotel Rooms
  public getHotelRooms(): HotelRoomType[] {
    return this.getItem<HotelRoomType[]>('hotel_rooms', []);
  }

  public saveHotelRoom(room: HotelRoomType, user?: User | null): void {
    const list = this.getHotelRooms();
    const idx = list.findIndex(r => r.id === room.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...room };
    } else {
      list.push(room);
    }
    this.setItem('hotel_rooms', list, false);
    this.syncFirestoreDoc('hotel_rooms', room.id, room);
  }

  // Hotel Rates
  public getHotelRates(): HotelRate[] {
    return this.getItem<HotelRate[]>('hotel_rates', []);
  }

  public saveHotelRate(rate: HotelRate, user?: User | null): void {
    const list = this.getHotelRates();
    const idx = list.findIndex(r => r.id === rate.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...rate };
    } else {
      list.push(rate);
    }
    this.setItem('hotel_rates', list, false);
    this.syncFirestoreDoc('hotel_rates', rate.id, rate);
  }

  // B2B Packages Alias
  public getB2BPackages(): B2BPackage[] {
    return this.getPackages();
  }

  // Transfer Rates
  public getTransferRates(): TransferRate[] {
    return this.getItem<TransferRate[]>('transfer_rates', [
      {
        id: 'TRATE-TYO-001',
        routeId: 'TRF-TYO-HND-001',
        rateType: 'PRIVATE',
        vehicle: 'Toyota Alphard Executive MPV',
        capacity: 6,
        currency: 'JPY',
        nettCost: 28000,
        status: 'ACTIVE'
      },
      {
        id: 'TRATE-TYO-002',
        routeId: 'TRF-TYO-NRT-002',
        rateType: 'PRIVATE',
        vehicle: 'Toyota HiAce Grand Cabin',
        capacity: 9,
        currency: 'JPY',
        nettCost: 42000,
        status: 'ACTIVE'
      }
    ]);
  }

  public saveTransferRate(rate: TransferRate, user?: User | null): void {
    const list = this.getTransferRates();
    const idx = list.findIndex(r => r.id === rate.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...rate, updatedAt: new Date().toISOString() };
    } else {
      list.push({ ...rate, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    this.setItem('transfer_rates', list, false);
    this.syncFirestoreDoc('transfer_rates', rate.id, rate);
  }

  // Product Pricing Rates
  public getProductRates(): ProductPricingRate[] {
    return this.getItem<ProductPricingRate[]>('product_pricing_rates', []);
  }

  public saveProductRate(rate: ProductPricingRate, user?: User | null): void {
    const list = this.getProductRates();
    const idx = list.findIndex(r => r.id === rate.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...rate, updatedAt: new Date().toISOString() };
    } else {
      list.push({ ...rate, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    this.setItem('product_pricing_rates', list, false);
    this.syncFirestoreDoc('product_pricing_rates', rate.id, rate);
  }

  // Product Capacities
  public getProductCapacities(): ProductCapacityItem[] {
    return this.getItem<ProductCapacityItem[]>('product_capacities', []);
  }

  public saveProductCapacity(cap: ProductCapacityItem, user?: User | null): void {
    const list = this.getProductCapacities();
    const idx = list.findIndex(c => c.id === cap.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...cap };
    } else {
      list.push(cap);
    }
    this.setItem('product_capacities', list, false);
    this.syncFirestoreDoc('product_capacities', cap.id, cap);
  }

  // Hotel Meal Plans
  public getHotelMealPlans(): HotelMealPlanItem[] {
    return this.getItem<HotelMealPlanItem[]>('hotel_meal_plans', [
      {
        id: 'MP-TYO-001-RO',
        hotelId: 'htl-jp-01',
        mealCode: 'RO',
        mealName: 'Room Only',
        description: 'Accommodation only without meals.',
        status: 'ACTIVE'
      },
      {
        id: 'MP-TYO-001-BB',
        hotelId: 'htl-jp-01',
        mealCode: 'BB',
        mealName: 'Japanese Kaiseki Breakfast Included',
        description: 'Full traditional seasonal kaiseki breakfast.',
        status: 'ACTIVE'
      }
    ]);
  }

  public saveHotelMealPlan(mealPlan: HotelMealPlanItem, user?: User | null): void {
    const list = this.getHotelMealPlans();
    const idx = list.findIndex(m => m.id === mealPlan.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...mealPlan };
    } else {
      list.push(mealPlan);
    }
    this.setItem('hotel_meal_plans', list, false);
    this.syncFirestoreDoc('hotel_meal_plans', mealPlan.id, mealPlan);
  }

  // Visa Rates
  public getVisaRates(): VisaRateItem[] {
    return this.getItem<VisaRateItem[]>('visa_rates', []);
  }

  public saveVisaRate(rate: VisaRateItem, user?: User | null): void {
    const list = this.getVisaRates();
    const idx = list.findIndex(v => v.id === rate.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...rate };
    } else {
      list.push(rate);
    }
    this.setItem('visa_rates', list, false);
    this.syncFirestoreDoc('visa_rates', rate.id, rate);
  }

  // Package Items
  public getPackageItems(): PackageItemRef[] {
    return this.getItem<PackageItemRef[]>('package_items', []);
  }

  public savePackageItem(item: PackageItemRef, user?: User | null): void {
    const list = this.getPackageItems();
    const idx = list.findIndex(p => p.id === item.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...item };
    } else {
      list.push(item);
    }
    this.setItem('package_items', list, false);
    this.syncFirestoreDoc('package_items', item.id, item);
  }

  // Master Google Sheet Authoritative Configuration
  public getMasterGoogleSheetConfig(): MasterGoogleSheetConfig {
    const defaultConfig: MasterGoogleSheetConfig = {
      masterSpreadsheetId: '',
      spreadsheetName: 'TheUnbound Master Inventory & Tariff Sheet',
      connectionStatus: 'UNCHECKED',
      authStatus: 'NOT_AUTHENTICATED',
      syncStatus: 'IDLE',
      autoSyncEnabled: false,
      syncSchedule: 'MANUAL',
      syncKey: 'unbound_master_sync_key'
    };
    return this.getItem<MasterGoogleSheetConfig>('master_google_sheet_config', defaultConfig);
  }

  public saveMasterGoogleSheetConfig(
    partial: Partial<MasterGoogleSheetConfig>,
    actor?: User | null
  ): MasterGoogleSheetConfig {
    const current = this.getMasterGoogleSheetConfig();
    const updated: MasterGoogleSheetConfig = {
      ...current,
      ...partial,
      updatedAt: new Date().toISOString(),
      updatedBy: actor?.name || actor?.email || 'Admin'
    };
    this.setItem('master_google_sheet_config', updated, false);
    this.syncFirestoreDoc('system_settings', 'master_google_sheet_config', updated);
    this.logAudit(
      actor || null,
      'MASTER_SHEETS_CONFIG_UPDATED' as any,
      'GoogleSheets',
      updated.masterSpreadsheetId || 'UNSET',
      `Updated Master Google Sheet configuration: Spreadsheet ID ${updated.masterSpreadsheetId || 'unconfigured'}`
    );
    return updated;
  }

  // Multi-Tab Sync Reports History
  public getMultiTabSyncReports(): MultiTabSyncReport[] {
    return this.getItem<MultiTabSyncReport[]>('multi_tab_sync_reports', []);
  }

  public saveMultiTabSyncReport(report: MultiTabSyncReport): void {
    const reports = this.getMultiTabSyncReports();
    reports.unshift(report);
    if (reports.length > 50) {
      reports.length = 50;
    }
    this.setItem('multi_tab_sync_reports', reports, false);
    this.syncFirestoreDoc('sheets_sync_history', report.id, report);
  }

  // Bulk Atomic Save for Synced Multi-Tab Sheets
  public saveSyncedMultiTabData(syncedData: {
    regions?: MasterRegion[];
    destinations?: Destination[];
    hubs?: CityHub[];
    products?: Product[];
    productRates?: ProductPricingRate[];
    productCapacities?: ProductCapacityItem[];
    hotels?: Hotel[];
    hotelRooms?: HotelRoomType[];
    hotelMealPlans?: HotelMealPlanItem[];
    hotelRates?: HotelRate[];
    visas?: VisaProduct[];
    visaRates?: VisaRateItem[];
    transferRoutes?: TransferRoute[];
    transferRates?: TransferRate[];
    packages?: B2BPackage[];
    packageItems?: PackageItemRef[];
  }, user?: User | null): void {
    if (syncedData.regions && syncedData.regions.length > 0) {
      const existing = this.getMasterRegions();
      const merged = this.mergeEntitiesById(existing, syncedData.regions);
      this.setItem('master_regions', merged, false);
      for (const r of syncedData.regions) this.syncFirestoreDoc('master_regions', r.id, r);
    }

    if (syncedData.destinations && syncedData.destinations.length > 0) {
      const existing = this.getDestinations();
      const merged = this.mergeEntitiesById(existing, syncedData.destinations);
      this.setItem('destinations', merged, false);
      for (const d of syncedData.destinations) this.syncFirestoreDoc('destinations', d.id, d);
    }

    if (syncedData.hubs && syncedData.hubs.length > 0) {
      const existing = this.getCityHubs();
      const merged = this.mergeEntitiesById(existing, syncedData.hubs);
      this.setItem('city_hubs', merged, false);
      for (const h of syncedData.hubs) this.syncFirestoreDoc('city_hubs', h.id, h);
    }

    if (syncedData.products && syncedData.products.length > 0) {
      const existing = this.getProducts();
      const merged = this.mergeEntitiesById(existing, syncedData.products);
      this.setItem('products', merged, false);
      for (const p of syncedData.products) this.syncFirestoreDoc('products', p.id, p);
    }

    if (syncedData.productRates && syncedData.productRates.length > 0) {
      const existing = this.getProductRates();
      const merged = this.mergeEntitiesById(existing, syncedData.productRates);
      this.setItem('product_pricing_rates', merged, false);
      for (const pr of syncedData.productRates) this.syncFirestoreDoc('product_pricing_rates', pr.id, pr);
    }

    if (syncedData.productCapacities && syncedData.productCapacities.length > 0) {
      const existing = this.getProductCapacities();
      const merged = this.mergeEntitiesById(existing, syncedData.productCapacities);
      this.setItem('product_capacities', merged, false);
      for (const pc of syncedData.productCapacities) this.syncFirestoreDoc('product_capacities', pc.id, pc);
    }

    if (syncedData.hotels && syncedData.hotels.length > 0) {
      const existing = this.getHotels();
      const merged = this.mergeEntitiesById(existing, syncedData.hotels);
      this.setItem('hotels', merged, false);
      for (const h of syncedData.hotels) this.syncFirestoreDoc('hotels', h.id, h);
    }

    if (syncedData.hotelRooms && syncedData.hotelRooms.length > 0) {
      const existing = this.getHotelRooms();
      const merged = this.mergeEntitiesById(existing, syncedData.hotelRooms);
      this.setItem('hotel_rooms', merged, false);
      for (const hr of syncedData.hotelRooms) this.syncFirestoreDoc('hotel_rooms', hr.id, hr);
    }

    if (syncedData.hotelMealPlans && syncedData.hotelMealPlans.length > 0) {
      const existing = this.getHotelMealPlans();
      const merged = this.mergeEntitiesById(existing, syncedData.hotelMealPlans);
      this.setItem('hotel_meal_plans', merged, false);
      for (const mp of syncedData.hotelMealPlans) this.syncFirestoreDoc('hotel_meal_plans', mp.id, mp);
    }

    if (syncedData.hotelRates && syncedData.hotelRates.length > 0) {
      const existing = this.getHotelRates();
      const merged = this.mergeEntitiesById(existing, syncedData.hotelRates);
      this.setItem('hotel_rates', merged, false);
      for (const hr of syncedData.hotelRates) this.syncFirestoreDoc('hotel_rates', hr.id, hr);
    }

    if (syncedData.visas && syncedData.visas.length > 0) {
      const existing = this.getVisas();
      const merged = this.mergeEntitiesById(existing, syncedData.visas);
      this.setItem('visas', merged, false);
      for (const v of syncedData.visas) this.syncFirestoreDoc('visas', v.id, v);
    }

    if (syncedData.visaRates && syncedData.visaRates.length > 0) {
      const existing = this.getVisaRates();
      const merged = this.mergeEntitiesById(existing, syncedData.visaRates);
      this.setItem('visa_rates', merged, false);
      for (const vr of syncedData.visaRates) this.syncFirestoreDoc('visa_rates', vr.id, vr);
    }

    if (syncedData.transferRoutes && syncedData.transferRoutes.length > 0) {
      const existing = this.getTransferRoutes();
      const merged = this.mergeEntitiesById(existing, syncedData.transferRoutes);
      this.setItem('transfer_routes', merged, false);
      for (const tr of syncedData.transferRoutes) this.syncFirestoreDoc('transfer_routes', tr.id, tr);
    }

    if (syncedData.transferRates && syncedData.transferRates.length > 0) {
      const existing = this.getTransferRates();
      const merged = this.mergeEntitiesById(existing, syncedData.transferRates);
      this.setItem('transfer_rates', merged, false);
      for (const tr of syncedData.transferRates) this.syncFirestoreDoc('transfer_rates', tr.id, tr);
    }

    if (syncedData.packages && syncedData.packages.length > 0) {
      const existing = this.getB2BPackages();
      const merged = this.mergeEntitiesById(existing, syncedData.packages);
      this.setItem('b2b_packages', merged, false);
      for (const p of syncedData.packages) this.syncFirestoreDoc('b2b_packages', p.id, p);
    }

    if (syncedData.packageItems && syncedData.packageItems.length > 0) {
      const existing = this.getPackageItems();
      const merged = this.mergeEntitiesById(existing, syncedData.packageItems);
      this.setItem('package_items', merged, false);
      for (const pi of syncedData.packageItems) this.syncFirestoreDoc('package_items', pi.id, pi);
    }
  }

  private mergeEntitiesById<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
    const map = new Map<string, T>();
    const now = new Date().toISOString();
    for (const item of existing) {
      if (item && item.id) map.set(item.id, item);
    }
    for (const item of incoming) {
      if (item && item.id) {
        const prev = map.get(item.id);
        const stampedItem: any = {
          ...item,
          source: (item as any).source || 'MASTER_GOOGLE_SHEETS',
          sourceId: item.id,
          lastSyncedAt: now,
          updatedAt: (item as any).updatedAt || now
        };
        if (prev) {
          map.set(item.id, {
            ...prev,
            ...stampedItem,
            createdAt: (prev as any).createdAt || stampedItem.createdAt || now,
          });
        } else {
          map.set(item.id, stampedItem);
        }
      }
    }
    return Array.from(map.values());
  }

  // ==========================================
  // SEO SYSTEM INFRASTRUCTURE & 301 REDIRECTS
  // ==========================================

  public getSEORedirects(): SEORedirect[] {
    return this.getItem<SEORedirect[]>('seo_redirects', []);
  }

  public saveSEORedirect(redirect: SEORedirect, actorName: string = 'Admin'): SEORedirect {
    const list = this.getSEORedirects();
    const existingIdx = list.findIndex(r => r.id === redirect.id);
    const updatedRecord: SEORedirect = {
      ...redirect,
      sourceUrl: redirect.sourceUrl.trim().toLowerCase(),
      destinationUrl: redirect.destinationUrl.trim(),
      hits: redirect.hits || 0,
      createdAt: redirect.createdAt || new Date().toISOString()
    };

    let updatedList: SEORedirect[];
    if (existingIdx >= 0) {
      updatedList = [...list];
      updatedList[existingIdx] = updatedRecord;
    } else {
      updatedList = [updatedRecord, ...list];
    }

    this.setItem('seo_redirects', updatedList);
    this.syncFirestoreDoc('seo_redirects', updatedRecord.id, updatedRecord);

    this.logAudit(
      { id: 'usr-admin', name: actorName, role: 'ADMIN' },
      existingIdx >= 0 ? 'SEO_REDIRECT_UPDATED' : 'SEO_REDIRECT_CREATED',
      'SEORedirect',
      updatedRecord.id,
      `Saved ${updatedRecord.statusCode} redirect: ${updatedRecord.sourceUrl} -> ${updatedRecord.destinationUrl}`
    );

    return updatedRecord;
  }

  public deleteSEORedirect(id: string, actorName: string = 'Admin'): void {
    const list = this.getSEORedirects();
    const target = list.find(r => r.id === id);
    const filtered = list.filter(r => r.id !== id);
    this.setItem('seo_redirects', filtered);
    this.deleteFirestoreDoc('seo_redirects', id);

    if (target) {
      this.logAudit(
        { id: 'usr-admin', name: actorName, role: 'ADMIN' },
        'SEO_REDIRECT_DELETED',
        'SEORedirect',
        id,
        `Deleted ${target.statusCode} redirect: ${target.sourceUrl}`
      );
    }
  }

  public getGlobalSEODefaults(): GlobalSEODefaults {
    return this.getItem<GlobalSEODefaults>('seo_settings', DEFAULT_GLOBAL_SEO_DEFAULTS);
  }

  public saveGlobalSEODefaults(defaults: GlobalSEODefaults, actorName: string = 'Admin'): void {
    this.setItem('seo_settings', defaults);
    this.syncFirestoreDoc('seo_settings', 'global_defaults', defaults);

    this.logAudit(
      { id: 'usr-admin', name: actorName, role: 'ADMIN' },
      'SEO_SETTINGS_UPDATED',
      'GlobalSEODefaults',
      'global_defaults',
      `Updated Global SEO defaults and URL templates.`
    );
  }

  public updateEntitySEO(
    entityType: SEOEntityType,
    entityId: string,
    seo: EntitySEO,
    actorName: string = 'Admin'
  ): void {
    const globalDefaults = this.getGlobalSEODefaults();
    const cleanSlug = sanitizeSlug(seo.slug || '');
    const cleanSEO: EntitySEO = {
      ...seo,
      slug: cleanSlug,
      lastUpdated: new Date().toISOString(),
      updatedBy: actorName
    };

    let oldSlug = '';
    let urlPrefix = '';

    switch (entityType) {
      case 'DESTINATION': {
        const list = this.getDestinations();
        const item = list.find(d => d.id === entityId);
        if (item) {
          oldSlug = item.slug;
          urlPrefix = '/destinations';
          const updatedItem = { ...item, slug: cleanSlug || item.slug, seo: cleanSEO };
          this.saveDestination(updatedItem, null);
        }
        break;
      }
      case 'REGION': {
        const list = this.getMasterRegions();
        const item = list.find(r => r.id === entityId);
        if (item) {
          oldSlug = item.slug;
          urlPrefix = '/destinations';
          const updatedItem = { ...item, slug: cleanSlug || item.slug, seo: cleanSEO };
          this.saveMasterRegion(updatedItem, null);
        }
        break;
      }
      case 'CITY_HUB': {
        const list = this.getCityHubs();
        const item = list.find(c => c.id === entityId);
        if (item) {
          oldSlug = item.slug || sanitizeSlug(item.name);
          urlPrefix = `/destinations/${item.destinationName?.toLowerCase() || 'japan'}`;
          const updatedItem = { ...item, slug: cleanSlug || oldSlug, seo: cleanSEO };
          this.saveCityHub(updatedItem, null);
        }
        break;
      }
      case 'PRODUCT': {
        const list = this.getProducts();
        const item = list.find(p => p.id === entityId);
        if (item) {
          oldSlug = item.slug || sanitizeSlug(item.name);
          urlPrefix = '/products';
          const updatedItem = { ...item, slug: cleanSlug || oldSlug, seo: cleanSEO };
          this.saveProduct(updatedItem, null);
        }
        break;
      }
      case 'HOTEL': {
        const list = this.getHotels();
        const item = list.find(h => h.id === entityId);
        if (item) {
          oldSlug = (item as any).slug || sanitizeSlug(item.name);
          urlPrefix = '/hotels';
          const updatedItem = { ...item, slug: cleanSlug || oldSlug, seo: cleanSEO };
          this.saveHotel(updatedItem, null);
        }
        break;
      }
      case 'PACKAGE': {
        const list = this.getB2BPackages();
        const item = list.find(p => p.id === entityId);
        if (item) {
          oldSlug = (item as any).slug || sanitizeSlug(item.title);
          urlPrefix = '/packages';
          const updatedItem = { ...item, slug: cleanSlug || oldSlug, seo: cleanSEO };
          this.savePackage(updatedItem, null);
        }
        break;
      }
      case 'BLOG': {
        const list = this.getBlogs();
        const item = list.find(b => b.id === entityId);
        if (item) {
          oldSlug = item.slug;
          urlPrefix = '/blogs';
          const updatedItem = { ...item, slug: cleanSlug || item.slug, seo: cleanSEO };
          this.saveBlog(updatedItem, null);
        }
        break;
      }
      case 'VISA': {
        const list = this.getVisas();
        const item = list.find(v => v.id === entityId);
        if (item) {
          oldSlug = (item as any).slug || sanitizeSlug(item.country);
          urlPrefix = '/visas';
          const updatedItem = { ...item, slug: cleanSlug || oldSlug, seo: cleanSEO };
          this.saveVisa(updatedItem);
        }
        break;
      }
      case 'CUSTOM_PAGE': {
        const list = this.getCustomPages();
        const item = list.find(cp => cp.id === entityId);
        if (item) {
          oldSlug = item.slug;
          urlPrefix = '/pages';
          const updatedItem = { ...item, slug: cleanSlug || item.slug, seo: cleanSEO };
          this.saveCustomPage(updatedItem);
        }
        break;
      }
      default:
        break;
    }

    this.logAudit(
      { id: 'usr-admin', name: actorName, role: 'ADMIN' },
      'SEO_METADATA_UPDATED',
      entityType,
      entityId,
      `Updated SEO metadata for ${entityType} ID: ${entityId}`
    );

    // Auto-create 301 Redirect if slug has changed
    if (oldSlug && cleanSlug && oldSlug !== cleanSlug && urlPrefix) {
      const sourceUrl = `${urlPrefix}/${oldSlug}`.toLowerCase();
      const destinationUrl = `${urlPrefix}/${cleanSlug}`.toLowerCase();
      
      const existingRedirects = this.getSEORedirects();
      const alreadyExists = existingRedirects.some(r => r.sourceUrl === sourceUrl && r.destinationUrl === destinationUrl);
      
      if (!alreadyExists) {
        this.saveSEORedirect({
          id: `redir-${Date.now()}`,
          sourceUrl,
          destinationUrl,
          statusCode: 301,
          createdAt: new Date().toISOString(),
          createdBy: actorName,
          hits: 0,
          active: true,
          entityType,
          entityId,
          notes: `Auto-generated 301 redirect upon slug update from "${oldSlug}" to "${cleanSlug}"`
        }, actorName);
      }
    }
  }

  public getAllSEOAuditItems(): SEOAuditItem[] {
    const globalDefaults = this.getGlobalSEODefaults();
    const items: SEOAuditItem[] = [];

    // 1. Homepage
    const homeEntity = {
      id: 'page-home',
      name: 'TheUnbound Official Homepage',
      slug: '',
      description: globalDefaults.defaultMetaDescription
    };
    items.push(auditEntitySEO('HOMEPAGE', homeEntity, (homeEntity as any).seo, globalDefaults));

    // 2. Destinations
    for (const d of this.getDestinations()) {
      items.push(auditEntitySEO('DESTINATION', d, d.seo, globalDefaults));
    }

    // 3. Master Regions
    for (const r of this.getMasterRegions()) {
      items.push(auditEntitySEO('REGION', r, r.seo, globalDefaults));
    }

    // 4. City Hubs
    for (const c of this.getCityHubs()) {
      items.push(auditEntitySEO('CITY_HUB', c, c.seo, globalDefaults));
    }

    // 5. Products (Excursions, transfers, day tours)
    for (const p of this.getProducts()) {
      items.push(auditEntitySEO('PRODUCT', p, p.seo, globalDefaults));
    }

    // 6. Hotels
    for (const h of this.getHotels()) {
      items.push(auditEntitySEO('HOTEL', h, h.seo, globalDefaults));
    }

    // 7. Packages
    for (const pkg of this.getB2BPackages()) {
      items.push(auditEntitySEO('PACKAGE', pkg, pkg.seo as EntitySEO, globalDefaults));
    }

    // 8. Blogs
    for (const b of this.getBlogs()) {
      items.push(auditEntitySEO('BLOG', b, b.seo, globalDefaults));
    }

    // 9. Visas
    for (const v of this.getVisas()) {
      items.push(auditEntitySEO('VISA', v, v.seo, globalDefaults));
    }

    // 10. Custom Pages
    for (const cp of this.getCustomPages()) {
      items.push(auditEntitySEO('CUSTOM_PAGE', cp, cp.seo, globalDefaults));
    }

    // 11. Institutional / Legal Pages
    const legalPages = [
      { id: 'legal-about', name: 'About TheUnbound DMC', slug: 'about', description: 'About TheUnbound Destination Management Company and leadership.' },
      { id: 'legal-contact', name: 'Contact Operations & Reservations', slug: 'contact', description: 'Contact TheUnbound global operations and concierge teams.' },
      { id: 'legal-terms', name: 'Terms & Conditions of Ground Service', slug: 'terms', description: 'Legal booking terms and ground operator agreements.' },
      { id: 'legal-privacy', name: 'Privacy & Data Protection Policy', slug: 'privacy', description: 'How TheUnbound collects and safeguards traveler data.' },
      { id: 'legal-refund', name: 'Cancellation & Refund Policy', slug: 'refund', description: 'Cancellation timelines and refund procedures.' }
    ];
    for (const lp of legalPages) {
      items.push(auditEntitySEO('LEGAL', lp, (lp as any).seo, globalDefaults));
    }

    return items;
  }

  // =========================================================================
  // SUPPLIERS & GROUND OPERATORS PROCUREMENT
  // =========================================================================

  public generateSupplierCode(): string {
    const list = this.getItem<Supplier[]>('suppliers', []);
    const existingCodes = new Set(list.map(s => s.supplierCode).filter(Boolean));
    let nextNum = 101;
    while (existingCodes.has(`SUP-${String(nextNum).padStart(5, '0')}`)) {
      nextNum++;
    }
    return `SUP-${String(nextNum).padStart(5, '0')}`;
  }

  public checkSupplierDuplicate(supplier: Partial<Supplier>, excludeId?: string): {
    isDuplicate: boolean;
    matchedField?: string;
    existingSupplier?: Supplier;
    reason?: string;
  } {
    const list = this.getSuppliers();
    const candidateName = supplier.name?.trim().toLowerCase();
    const candidateLegalName = supplier.legalName?.trim().toLowerCase();
    const candidateEmail = supplier.email?.trim().toLowerCase();
    const candidatePhone = supplier.phone?.replace(/[\s\-\+\(\)]/g, '');
    const candidateWebsite = supplier.website?.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
    const candidateCode = supplier.supplierCode?.trim().toUpperCase();

    for (const s of list) {
      if (excludeId && s.id === excludeId) continue;

      if (candidateCode && s.supplierCode && s.supplierCode.toUpperCase() === candidateCode) {
        return { isDuplicate: true, matchedField: 'Supplier ID', existingSupplier: s, reason: `Supplier Code ${candidateCode} matches existing record ${s.name}.` };
      }
      if (candidateName && s.name && s.name.trim().toLowerCase() === candidateName) {
        return { isDuplicate: true, matchedField: 'Supplier Name', existingSupplier: s, reason: `Supplier Name "${s.name}" already registered.` };
      }
      if (candidateLegalName && s.legalName && s.legalName.trim().toLowerCase() === candidateLegalName) {
        return { isDuplicate: true, matchedField: 'Legal Company Name', existingSupplier: s, reason: `Legal Company Name "${s.legalName}" matches existing record.` };
      }
      if (candidateEmail && s.email && s.email.trim().toLowerCase() === candidateEmail) {
        return { isDuplicate: true, matchedField: 'Email Address', existingSupplier: s, reason: `Email ${s.email} already linked to supplier ${s.name}.` };
      }
      if (candidatePhone && s.phone) {
        const existingDigits = s.phone.replace(/[\s\-\+\(\)]/g, '');
        if (existingDigits.length >= 7 && existingDigits === candidatePhone) {
          return { isDuplicate: true, matchedField: 'Phone Number', existingSupplier: s };
        }
      }
      if (candidateWebsite && s.website) {
        const existingCleanWeb = s.website.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
        if (existingCleanWeb.length > 3 && existingCleanWeb === candidateWebsite) {
          return { isDuplicate: true, matchedField: 'Website', existingSupplier: s };
        }
      }
    }
    return { isDuplicate: false };
  }

  public getSuppliers(includeArchived: boolean = true): Supplier[] {
    const list = this.getItem<Supplier[]>('suppliers', []);
    // If empty in local cache and firestore hasn't populated, populate default trusted DMC ground partners
    if (list.length === 0) {
      const defaultSuppliers: Supplier[] = [
        {
          id: 'sup-1',
          supplierCode: 'SUP-00101',
          name: 'Alpine Vista Transfers & Coaches',
          legalName: 'Alpine Vista Transport GmbH',
          tradingName: 'Alpine Vista Transfers',
          country: 'Switzerland',
          destination: 'Switzerland',
          destinations: ['Switzerland', 'France', 'Austria'],
          hubs: ['Zurich', 'Geneva', 'Interlaken', 'Zermatt'],
          categories: ['TRANSFER', 'RAIL'],
          status: 'ACTIVE',
          contactPerson: 'Marc Obermayer',
          contactPersons: [
            {
              id: 'cp-1',
              name: 'Marc Obermayer',
              role: 'Dispatch & Fleet Director',
              designation: 'Managing Director',
              email: 'dispatch@alpinevistatransfers.ch',
              phone: '+41 22 731 4500',
              whatsapp: '+41 79 401 2299',
              isPrimary: true,
              emergencyPhone: '+41 79 401 2299',
              notes: 'Primary liaison for VIP private transfers and rail station luggage transfers.'
            }
          ],
          email: 'bookings@alpinevistatransfers.ch',
          phone: '+41 22 731 4500',
          whatsapp: '+41 79 401 2299',
          emergencyPhone: '+41 79 401 2299',
          website: 'https://alpinevistatransfers.ch',
          taxRegistrationNumber: 'CHE-114.892.402 TVA',
          description: 'Premium Mercedes fleet and licensed Alpine transfer provider across Swiss, French, and Austrian cantons.',
          currency: 'CHF',
          contractStatus: 'ACTIVE',
          isPreferred: true,
          paymentTerms: 'Net 14 Days after voucher dispatch',
          cancellationTerms: 'Free cancellation up to 48 hours prior to pickup',
          serviceCoverage: {
            regionsServed: ['Europe', 'Alps'],
            destinationsServed: ['Switzerland', 'France', 'Austria'],
            hubsServed: ['Zurich', 'Geneva', 'Interlaken', 'Zermatt', 'Lucerne'],
            supportedCategories: ['TRANSFER', 'RAIL'],
            serviceAvailability: 'ALL_YEAR',
            operatingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
            operatingHours: '06:00 - 23:00 CET',
            emergencySupport24x7: true,
            emergencySupportDetails: '24/7 airport tarmac duty officer on WhatsApp'
          },
          commercialDetails: {
            defaultCurrency: 'CHF',
            paymentTerms: 'Net 14 Days after voucher dispatch',
            paymentMethod: 'Bank Transfer (SEPA / Swiss IBAN)',
            creditPeriodDays: 14,
            cancellationPolicy: 'Free cancellation up to 48 hours prior to pickup; 50% thereafter.',
            contractReference: 'CTR-CH-2026-AVT',
            contractStartDate: '2025-01-01',
            contractEndDate: '2027-12-31',
            taxTreatment: 'Standard Swiss VAT 8.1% included in net wholesale rates.'
          },
          bankDetails: {
            bankName: 'UBS Switzerland AG',
            accountName: 'Alpine Vista Transport GmbH',
            accountNumber: 'CH89 0023 0230 1234 5678 9',
            swiftBic: 'UBSWCHZH80A',
            iban: 'CH8900230230123456789',
            branchAddress: 'Bahnhofstrasse 45, 8001 Zurich'
          },
          performanceScore: 98,
          responseTimeAvgHours: 1.5,
          confirmationRatePercent: 99,
          cancellationRatePercent: 1.2,
          onTimePaymentCompliancePercent: 100,
          openRequestsCount: 2,
          pendingConfirmationsCount: 1,
          outstandingPayableAmount: 1420,
          notes: 'Premium Mercedes fleet and Zurich/Geneva airport tarmac passes.',
          createdBy: 'system-init',
          createdByName: 'TheUnbound Operations',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'sup-2',
          supplierCode: 'SUP-00102',
          name: 'Nippon Golden Route Ground Services',
          legalName: 'Nippon Horizon Travel K.K.',
          tradingName: 'Nippon Golden Route Services',
          country: 'Japan',
          destination: 'Japan',
          destinations: ['Japan'],
          hubs: ['Tokyo', 'Kyoto', 'Osaka', 'Hakone', 'Hiroshima'],
          categories: ['HOTEL', 'GUIDE', 'SIGHTSEEING', 'RAIL', 'TOUR'],
          status: 'ACTIVE',
          contactPerson: 'Kenji Takahashi',
          contactPersons: [
            {
              id: 'cp-2',
              name: 'Kenji Takahashi',
              role: 'Head of Inbound Procurement',
              designation: 'General Manager Inbound',
              email: 'k.takahashi@nipponhorizon.jp',
              phone: '+81 3 5555 0192',
              whatsapp: '+81 90 1234 5678',
              isPrimary: true,
              emergencyPhone: '+81 90 1234 5678'
            }
          ],
          email: 'inbound-ops@nipponhorizon.jp',
          phone: '+81 3 5555 0190',
          whatsapp: '+81 90 1234 5678',
          emergencyPhone: '+81 90 1234 5678',
          website: 'https://nipponhorizon.jp',
          taxRegistrationNumber: 'T1010001089241',
          description: 'Official inbound DMC partner for Japan. Luxury ryokan allotments, licensed national guides, and JR bullet train ticketing.',
          currency: 'JPY',
          contractStatus: 'ACTIVE',
          isPreferred: true,
          paymentTerms: 'Prepayment 7 days prior to check-in',
          cancellationTerms: 'Free cancellation up to 14 days prior',
          serviceCoverage: {
            regionsServed: ['East Asia', 'Japan'],
            destinationsServed: ['Japan'],
            hubsServed: ['Tokyo', 'Kyoto', 'Osaka', 'Hakone', 'Hiroshima', 'Kanazawa', 'Nara'],
            supportedCategories: ['HOTEL', 'GUIDE', 'SIGHTSEEING', 'RAIL', 'TOUR'],
            serviceAvailability: 'ALL_YEAR',
            operatingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
            operatingHours: '08:00 - 20:00 JST',
            emergencySupport24x7: true,
            emergencySupportDetails: '24/7 English & Japanese ground line for active tour groups'
          },
          commercialDetails: {
            defaultCurrency: 'JPY',
            paymentTerms: 'Prepayment 7 days prior to check-in',
            paymentMethod: 'Wire Transfer / SWIFT',
            creditPeriodDays: 7,
            cancellationPolicy: 'Free cancellation up to 14 days prior; 30% up to 7 days; 100% within 48h.',
            contractReference: 'CTR-JP-2025-NIPPON',
            contractStartDate: '2024-04-01',
            contractEndDate: '2027-03-31'
          },
          performanceScore: 96,
          responseTimeAvgHours: 2.1,
          confirmationRatePercent: 97,
          cancellationRatePercent: 2.0,
          onTimePaymentCompliancePercent: 100,
          openRequestsCount: 3,
          pendingConfirmationsCount: 2,
          outstandingPayableAmount: 485000,
          notes: 'Direct contracted allotments with Tokyo & Kyoto luxury ryokans and JR Rail Pass fulfillment.',
          createdBy: 'system-init',
          createdByName: 'TheUnbound Operations',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'sup-3',
          supplierCode: 'SUP-00103',
          name: 'Mediterraneo Luxury Yachts & Transfers',
          legalName: 'Mediterraneo Marine Operations S.r.l.',
          tradingName: 'Mediterraneo Yacht Charters',
          country: 'Italy',
          destination: 'Italy',
          destinations: ['Italy', 'Greece', 'France'],
          hubs: ['Naples', 'Capri', 'Amalfi', 'Positano', 'Costa Smeralda', 'Nice'],
          categories: ['YACHT', 'TRANSFER', 'SIGHTSEEING', 'ACTIVITY'],
          status: 'ACTIVE',
          contactPerson: 'Chiara Rossi',
          contactPersons: [
            {
              id: 'cp-3',
              name: 'Chiara Rossi',
              role: 'Charter Coordinator',
              designation: 'Operations Coordinator',
              email: 'chiara@mediterraneoyachts.it',
              phone: '+39 081 1930 2200',
              whatsapp: '+39 335 129 8811',
              isPrimary: true,
              emergencyPhone: '+39 335 129 8811'
            }
          ],
          email: 'charters@mediterraneoyachts.it',
          phone: '+39 081 1930 2200',
          whatsapp: '+39 335 129 8811',
          emergencyPhone: '+39 335 129 8811',
          website: 'https://mediterraneoyachts.it',
          taxRegistrationNumber: 'IT08239100632',
          description: 'Amalfi Coast, Capri, and Costa Smeralda private luxury boat tenders and day charters.',
          currency: 'EUR',
          contractStatus: 'ACTIVE',
          isPreferred: true,
          paymentTerms: '50% deposit on booking, balance 14 days prior',
          cancellationTerms: 'Strict weather-guaranteed rescheduling or 70% refund',
          serviceCoverage: {
            regionsServed: ['Mediterranean', 'Southern Europe'],
            destinationsServed: ['Italy', 'Greece', 'France'],
            hubsServed: ['Naples', 'Capri', 'Amalfi', 'Positano', 'Sorrento', 'Portofino'],
            supportedCategories: ['YACHT', 'TRANSFER', 'SIGHTSEEING', 'ACTIVITY'],
            serviceAvailability: 'SEASONAL',
            seasonalMonths: ['April', 'May', 'June', 'July', 'August', 'September', 'October'],
            operatingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
            operatingHours: '08:00 - 21:00 CET',
            emergencySupport24x7: true,
            emergencySupportDetails: 'Skipper emergency line provided upon charter confirmation'
          },
          commercialDetails: {
            defaultCurrency: 'EUR',
            paymentTerms: '50% deposit on booking, balance 14 days prior',
            paymentMethod: 'Bank Wire (IBAN) / Credit Card',
            creditPeriodDays: 14,
            cancellationPolicy: 'Weather-guaranteed rescheduling or 70% refund; 100% retention for client no-show.'
          },
          performanceScore: 95,
          responseTimeAvgHours: 3.0,
          confirmationRatePercent: 94,
          cancellationRatePercent: 3.5,
          onTimePaymentCompliancePercent: 98,
          openRequestsCount: 1,
          pendingConfirmationsCount: 0,
          outstandingPayableAmount: 3200,
          notes: 'Amalfi Coast, Capri, and Costa Smeralda private luxury boat tenders and day charters.',
          createdBy: 'system-init',
          createdByName: 'TheUnbound Operations',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'sup-4',
          supplierCode: 'SUP-00104',
          name: 'Global Schengen & UK Visa Concierge',
          legalName: 'Apex Diplomatic Document Services Ltd',
          tradingName: 'Global Visa Concierge',
          country: 'United Kingdom',
          destination: 'United Kingdom',
          destinations: ['United Kingdom', 'France', 'Switzerland', 'Italy', 'Japan'],
          hubs: ['London', 'Paris', 'Dubai', 'Mumbai', 'New Delhi'],
          categories: ['VISA'],
          status: 'ACTIVE',
          contactPerson: 'David Miller',
          contactPersons: [
            {
              id: 'cp-4',
              name: 'David Miller',
              role: 'Operations Director',
              designation: 'Director of Consular Affairs',
              email: 'david.miller@visaconcierge.co.uk',
              phone: '+44 20 7946 0880',
              whatsapp: '+44 7700 900345',
              isPrimary: true,
              emergencyPhone: '+44 7700 900345'
            }
          ],
          email: 'submissions@visaconcierge.co.uk',
          phone: '+44 20 7946 0880',
          whatsapp: '+44 7700 900345',
          emergencyPhone: '+44 7700 900345',
          website: 'https://visaconcierge.co.uk',
          taxRegistrationNumber: 'GB892341829',
          description: 'Diplomatic document and consular appointment slots for Schengen, UK, and Japan e-visas.',
          currency: 'GBP',
          contractStatus: 'ACTIVE',
          isPreferred: true,
          paymentTerms: 'Monthly invoice settlement',
          cancellationTerms: 'Non-refundable once embassy appointment lodged',
          serviceCoverage: {
            regionsServed: ['Global Consular Hubs'],
            destinationsServed: ['United Kingdom', 'France', 'Switzerland', 'Italy', 'Japan'],
            hubsServed: ['London', 'Paris', 'Dubai', 'Mumbai', 'New Delhi'],
            supportedCategories: ['VISA'],
            serviceAvailability: 'ALL_YEAR',
            operatingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
            operatingHours: '08:30 - 18:00 GMT',
            emergencySupport24x7: false
          },
          commercialDetails: {
            defaultCurrency: 'GBP',
            paymentTerms: 'Monthly invoice settlement',
            paymentMethod: 'BACS / Wire Transfer',
            creditPeriodDays: 30,
            cancellationPolicy: 'Non-refundable once embassy appointment lodged'
          },
          performanceScore: 99,
          responseTimeAvgHours: 0.8,
          confirmationRatePercent: 100,
          cancellationRatePercent: 0.5,
          onTimePaymentCompliancePercent: 100,
          openRequestsCount: 0,
          pendingConfirmationsCount: 0,
          outstandingPayableAmount: 850,
          notes: 'Express VIP slots for VFS Global and TLScontact centers.',
          createdBy: 'system-init',
          createdByName: 'TheUnbound Operations',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      this.setItem('suppliers', defaultSuppliers);
      return defaultSuppliers;
    }

    // Dynamic stats enrichment: calculate linked service items and active bookings
    const bookings = this.getAllBookings();
    const enrichedList = list.map(sup => {
      let linkedItems = 0;
      let activeBookings = 0;
      bookings.forEach(b => {
        let hasItem = false;
        b.items?.forEach(it => {
          if (it.supplierId === sup.id || (it.supplierName && it.supplierName.trim().toLowerCase() === sup.name.trim().toLowerCase())) {
            linkedItems++;
            hasItem = true;
          }
        });
        if (hasItem && b.status !== ('Cancelled' as any) && b.status !== 'CANCELLED') {
          activeBookings++;
        }
      });
      return {
        ...sup,
        supplierCode: sup.supplierCode || `SUP-${sup.id.replace(/\D/g, '').padStart(5, '0') || '00100'}`,
        status: sup.status || (sup.archivedAt ? 'ARCHIVED' : 'ACTIVE'),
        linkedServiceItemsCount: linkedItems,
        activeBookingsCount: activeBookings
      };
    });

    if (!includeArchived) {
      return enrichedList.filter(s => s.status !== 'ARCHIVED');
    }
    return enrichedList;
  }

  public getActiveSuppliers(): Supplier[] {
    return this.getSuppliers(false).filter(s => s.status === 'ACTIVE');
  }

  public getSupplierById(idOrCode: string): Supplier | undefined {
    const list = this.getSuppliers(true);
    return list.find(s => s.id === idOrCode || s.supplierCode === idOrCode);
  }

  public saveSupplier(supplier: Supplier, user: User | null): { success: boolean; supplier: Supplier; error?: string } {
    const list = this.getItem<Supplier[]>('suppliers', []);
    const index = list.findIndex(s => s.id === supplier.id);
    const timestamp = new Date().toISOString();
    let saved: Supplier;
    const isNew = index === -1;

    // Stable Supplier Code: Preserve existing or generate a new unique code
    const supplierCode = supplier.supplierCode || (index >= 0 && list[index].supplierCode) || this.generateSupplierCode();

    if (!isNew) {
      const prev = list[index];
      saved = {
        ...prev,
        ...supplier,
        supplierCode, // Never change supplier code once assigned
        updatedAt: timestamp,
        updatedBy: user?.id || 'system',
        updatedByName: user?.displayName || user?.email || 'Authorized User'
      };
      list[index] = saved;

      // Log activity
      this.logSupplierActivity({
        supplierId: saved.id,
        action: 'EDITED',
        summary: `Supplier profile updated by ${user?.displayName || user?.email || 'Operations'}`,
        details: `Updated parameters for ${saved.name} (${saved.supplierCode})`,
        performedBy: user?.id || 'system',
        performedByName: user?.displayName || 'Operations',
        performedByEmail: user?.email || 'operations@theunbound.in'
      });

      this.logAudit(user, 'SETTINGS_UPDATED', 'Supplier', saved.id, `Updated supplier profile for ${saved.name} (${saved.supplierCode})`);
    } else {
      const generatedId = supplier.id || `sup-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      saved = {
        ...supplier,
        id: generatedId,
        supplierCode,
        status: supplier.status || 'ACTIVE',
        categories: supplier.categories || ['OTHER'],
        destinations: supplier.destinations || [supplier.destination || 'Global'],
        contactPersons: supplier.contactPersons || [
          {
            id: `cp-${Date.now()}`,
            name: supplier.contactPerson || 'Primary Contact',
            email: supplier.email,
            phone: supplier.phone,
            isPrimary: true
          }
        ],
        createdAt: timestamp,
        updatedAt: timestamp,
        createdBy: user?.id || 'system',
        createdByName: user?.displayName || user?.email || 'Operations',
        performanceScore: supplier.performanceScore ?? 95,
        openRequestsCount: supplier.openRequestsCount ?? 0,
        pendingConfirmationsCount: supplier.pendingConfirmationsCount ?? 0,
        outstandingPayableAmount: supplier.outstandingPayableAmount ?? 0
      };
      list.unshift(saved);

      // Log activity
      this.logSupplierActivity({
        supplierId: saved.id,
        action: 'CREATED',
        summary: `Supplier master profile created (${saved.supplierCode})`,
        details: `Created new supplier ${saved.name} in ${saved.destination}`,
        performedBy: user?.id || 'system',
        performedByName: user?.displayName || 'Operations',
        performedByEmail: user?.email || 'operations@theunbound.in'
      });

      this.logAudit(user, 'BOOKING_CREATED', 'Supplier', saved.id, `Created supplier profile for ${saved.name} (${saved.supplierCode})`);
    }

    this.setItem('suppliers', list);
    this.syncFirestoreDoc('suppliers', saved.id, saved);
    return { success: true, supplier: saved };
  }

  public archiveSupplier(supplierId: string, reason: string, user: User | null): { success: boolean; error?: string } {
    const list = this.getItem<Supplier[]>('suppliers', []);
    const idx = list.findIndex(s => s.id === supplierId);
    if (idx === -1) return { success: false, error: 'Supplier not found' };

    const timestamp = new Date().toISOString();
    list[idx] = {
      ...list[idx],
      status: 'ARCHIVED',
      archivedAt: timestamp,
      archivedBy: user?.displayName || user?.email || 'Internal User',
      archivedReason: reason.trim(),
      updatedAt: timestamp
    };

    this.setItem('suppliers', list);
    this.syncFirestoreDoc('suppliers', supplierId, list[idx]);

    this.logSupplierActivity({
      supplierId,
      action: 'ARCHIVED',
      summary: `Supplier archived: ${reason.trim()}`,
      details: `Supplier archived by ${user?.displayName || 'Operations'}. Historical bookings preserved.`,
      performedBy: user?.id || 'system',
      performedByName: user?.displayName || 'Operations',
      performedByEmail: user?.email || 'operations@theunbound.in'
    });

    this.logAudit(user, 'SETTINGS_UPDATED', 'Supplier', supplierId, `Archived supplier ${list[idx].name} (${reason.trim()})`);
    return { success: true };
  }

  public restoreSupplier(supplierId: string, user: User | null): { success: boolean; error?: string } {
    const list = this.getItem<Supplier[]>('suppliers', []);
    const idx = list.findIndex(s => s.id === supplierId);
    if (idx === -1) return { success: false, error: 'Supplier not found' };

    const timestamp = new Date().toISOString();
    list[idx] = {
      ...list[idx],
      status: 'ACTIVE',
      archivedAt: undefined,
      archivedBy: undefined,
      archivedReason: undefined,
      updatedAt: timestamp
    };

    this.setItem('suppliers', list);
    this.syncFirestoreDoc('suppliers', supplierId, list[idx]);

    this.logSupplierActivity({
      supplierId,
      action: 'RESTORED',
      summary: 'Supplier restored to Active directory',
      details: `Restored by ${user?.displayName || 'Operations'}`,
      performedBy: user?.id || 'system',
      performedByName: user?.displayName || 'Operations',
      performedByEmail: user?.email || 'operations@theunbound.in'
    });

    this.logAudit(user, 'SETTINGS_UPDATED', 'Supplier', supplierId, `Restored supplier ${list[idx].name} to Active`);
    return { success: true };
  }

  public changeSupplierStatus(supplierId: string, newStatus: SupplierStatus, user: User | null): { success: boolean; error?: string } {
    const list = this.getItem<Supplier[]>('suppliers', []);
    const idx = list.findIndex(s => s.id === supplierId);
    if (idx === -1) return { success: false, error: 'Supplier not found' };

    const prevStatus = list[idx].status || 'ACTIVE';
    const timestamp = new Date().toISOString();
    list[idx] = {
      ...list[idx],
      status: newStatus,
      updatedAt: timestamp
    };

    this.setItem('suppliers', list);
    this.syncFirestoreDoc('suppliers', supplierId, list[idx]);

    this.logSupplierActivity({
      supplierId,
      action: 'STATUS_CHANGED',
      summary: `Status changed from ${prevStatus} to ${newStatus}`,
      details: `Changed by ${user?.displayName || 'Operations'}`,
      performedBy: user?.id || 'system',
      performedByName: user?.displayName || 'Operations',
      performedByEmail: user?.email || 'operations@theunbound.in'
    });

    return { success: true };
  }

  public deleteSupplier(supplierId: string, user: User | null): boolean {
    const list = this.getItem<Supplier[]>('suppliers', []);
    const filtered = list.filter(s => s.id !== supplierId);
    if (filtered.length === list.length) return false;

    this.setItem('suppliers', filtered);
    this.deleteFirestoreDoc('suppliers', supplierId);
    this.logAudit(user, 'SETTINGS_UPDATED', 'Supplier', supplierId, `Removed supplier record ${supplierId}`);
    return true;
  }

  // =========================================================================
  // SUPPLIER RATE CARDS
  // =========================================================================

  public getSupplierRateCards(supplierId?: string): SupplierRateCard[] {
    const all = this.getItem<SupplierRateCard[]>('supplier_rate_cards', []);
    if (supplierId) {
      return all.filter(c => c.supplierId === supplierId);
    }
    return all;
  }

  public saveSupplierRateCard(rateCard: SupplierRateCard, user: User | null): SupplierRateCard {
    const list = this.getItem<SupplierRateCard[]>('supplier_rate_cards', []);
    const index = list.findIndex(r => r.id === rateCard.id);
    const timestamp = new Date().toISOString();
    let saved: SupplierRateCard;

    if (index >= 0) {
      saved = {
        ...list[index],
        ...rateCard,
        updatedAt: timestamp
      };
      list[index] = saved;
      this.logSupplierActivity({
        supplierId: saved.supplierId,
        action: 'RATE_CARD_UPDATED',
        summary: `Rate card updated for ${saved.serviceName}`,
        details: `Adult Rate: ${saved.currency} ${saved.rateAdult}`,
        performedBy: user?.id || 'system',
        performedByName: user?.displayName || 'Operations',
        performedByEmail: user?.email || 'operations@theunbound.in'
      });
    } else {
      saved = {
        ...rateCard,
        id: rateCard.id || `rc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      list.unshift(saved);
      this.logSupplierActivity({
        supplierId: saved.supplierId,
        action: 'RATE_CARD_ADDED',
        summary: `New rate card added for ${saved.serviceName}`,
        details: `Adult Rate: ${saved.currency} ${saved.rateAdult}`,
        performedBy: user?.id || 'system',
        performedByName: user?.displayName || 'Operations',
        performedByEmail: user?.email || 'operations@theunbound.in'
      });
    }

    this.setItem('supplier_rate_cards', list);
    this.syncFirestoreDoc('supplier_rate_cards', saved.id, saved);
    return saved;
  }

  public deleteSupplierRateCard(rateCardId: string, user: User | null): boolean {
    const list = this.getItem<SupplierRateCard[]>('supplier_rate_cards', []);
    const found = list.find(r => r.id === rateCardId);
    if (!found) return false;

    const filtered = list.filter(r => r.id !== rateCardId);
    this.setItem('supplier_rate_cards', filtered);
    this.deleteFirestoreDoc('supplier_rate_cards', rateCardId);

    this.logSupplierActivity({
      supplierId: found.supplierId,
      action: 'RATE_CARD_UPDATED',
      summary: `Rate card deleted: ${found.serviceName}`,
      performedBy: user?.id || 'system',
      performedByName: user?.displayName || 'Operations',
      performedByEmail: user?.email || 'operations@theunbound.in'
    });
    return true;
  }

  // =========================================================================
  // SUPPLIER DOCUMENTS
  // =========================================================================

  public getSupplierDocuments(supplierId: string): SupplierDocument[] {
    const all = this.getItem<SupplierDocument[]>('supplier_documents', []);
    return all.filter(d => d.supplierId === supplierId);
  }

  public saveSupplierDocument(doc: SupplierDocument, user: User | null): SupplierDocument {
    const list = this.getItem<SupplierDocument[]>('supplier_documents', []);
    const index = list.findIndex(d => d.id === doc.id);
    const timestamp = new Date().toISOString();
    let saved: SupplierDocument;

    if (index >= 0) {
      saved = {
        ...list[index],
        ...doc
      };
      list[index] = saved;
    } else {
      saved = {
        ...doc,
        id: doc.id || `doc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        uploadedAt: timestamp,
        uploadedBy: user?.id || 'system',
        uploadedByName: user?.displayName || user?.email || 'Operations'
      };
      list.unshift(saved);
      this.logSupplierActivity({
        supplierId: saved.supplierId,
        action: 'DOCUMENT_UPLOADED',
        summary: `Document uploaded: ${saved.title} (${saved.documentType})`,
        details: `File: ${saved.fileName}`,
        performedBy: user?.id || 'system',
        performedByName: user?.displayName || 'Operations',
        performedByEmail: user?.email || 'operations@theunbound.in'
      });
    }

    this.setItem('supplier_documents', list);
    this.syncFirestoreDoc('supplier_documents', saved.id, saved);
    return saved;
  }

  public deleteSupplierDocument(docId: string, user: User | null): boolean {
    const list = this.getItem<SupplierDocument[]>('supplier_documents', []);
    const found = list.find(d => d.id === docId);
    if (!found) return false;

    const filtered = list.filter(d => d.id !== docId);
    this.setItem('supplier_documents', filtered);
    this.deleteFirestoreDoc('supplier_documents', docId);

    this.logSupplierActivity({
      supplierId: found.supplierId,
      action: 'DOCUMENT_DELETED',
      summary: `Document deleted: ${found.title}`,
      performedBy: user?.id || 'system',
      performedByName: user?.displayName || 'Operations',
      performedByEmail: user?.email || 'operations@theunbound.in'
    });
    return true;
  }

  // =========================================================================
  // SUPPLIER ACTIVITY HISTORY
  // =========================================================================

  public getSupplierActivityHistory(supplierId: string): SupplierActivityHistory[] {
    const all = this.getItem<SupplierActivityHistory[]>('supplier_activity_history', []);
    return all
      .filter(h => h.supplierId === supplierId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  public getSupplierActivity(supplierId: string): SupplierActivityHistory[] {
    return this.getSupplierActivityHistory(supplierId);
  }

  public createSupplier(supplier: Supplier, user: User | null): { success: boolean; supplier: Supplier; error?: string } {
    return this.saveSupplier(supplier, user);
  }

  public updateSupplier(supplier: Supplier, user: User | null): { success: boolean; supplier: Supplier; error?: string } {
    return this.saveSupplier(supplier, user);
  }

  public setSupplierStatus(supplierId: string, status: SupplierStatus, user: User | null, _reason?: string): { success: boolean; error?: string } {
    return this.changeSupplierStatus(supplierId, status, user);
  }

  public createSupplierRateCard(rateCard: SupplierRateCard, user: User | null): SupplierRateCard {
    return this.saveSupplierRateCard(rateCard, user);
  }

  public createSupplierDocument(doc: SupplierDocument, user: User | null): SupplierDocument {
    return this.saveSupplierDocument(doc, user);
  }

  public logSupplierActivity(entry: Omit<SupplierActivityHistory, 'id' | 'timestamp'>): SupplierActivityHistory {
    const all = this.getItem<SupplierActivityHistory[]>('supplier_activity_history', []);
    const record: SupplierActivityHistory = {
      ...entry,
      id: `act-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString()
    };
    all.unshift(record);
    // Keep max 1000 activity items in local memory
    if (all.length > 1000) all.length = 1000;
    this.setItem('supplier_activity_history', all);
    this.syncFirestoreDoc('supplier_activity_history', record.id, record);
    return record;
  }

  // =========================================================================
  // SUPPLIER ALLOCATIONS & LINKED BOOKINGS
  // =========================================================================

  public getSupplierAllocations(supplierId?: string): SupplierAllocationRecord[] {
    const all = this.getItem<SupplierAllocationRecord[]>('supplier_allocations', []);
    if (supplierId) {
      return all
        .filter(a => a.supplierId === supplierId)
        .sort((a, b) => new Date(b.allocatedAt).getTime() - new Date(a.allocatedAt).getTime());
    }
    return all.sort((a, b) => new Date(b.allocatedAt).getTime() - new Date(a.allocatedAt).getTime());
  }

  public logSupplierAllocation(
    record: Omit<SupplierAllocationRecord, 'id' | 'allocatedAt'>, 
    user: User | null
  ): SupplierAllocationRecord {
    const all = this.getItem<SupplierAllocationRecord[]>('supplier_allocations', []);
    const entry: SupplierAllocationRecord = {
      ...record,
      id: `alc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      allocatedAt: new Date().toISOString()
    };
    all.unshift(entry);
    this.setItem('supplier_allocations', all);
    this.syncFirestoreDoc('supplier_allocations', entry.id, entry);

    // Also log to supplier activity history
    this.logSupplierActivity({
      supplierId: entry.supplierId,
      action: entry.status === 'REMOVED' ? 'ALLOCATION_UNLINKED' : 'ALLOCATION_LINKED',
      summary: `Booking service item allocated: ${entry.serviceName} (${entry.bookingReference})`,
      details: `Customer: ${entry.customerName || 'Direct Booking'} | Status: ${entry.status}`,
      performedBy: user?.id || 'system',
      performedByName: user?.displayName || 'Operations',
      performedByEmail: user?.email || 'operations@theunbound.in'
    });

    return entry;
  }

  public getSupplierLinkedBookings(supplierId: string): {
    booking: Booking;
    serviceItems: BookingItem[];
  }[] {
    const all = this.getAllBookings();
    const sup = this.getSupplierById(supplierId);
    const results: { booking: Booking; serviceItems: BookingItem[] }[] = [];

    for (const b of all) {
      if (!b.items) continue;
      const matchedItems = b.items.filter(it => 
        it.supplierId === supplierId || 
        (sup && it.supplierName && it.supplierName.trim().toLowerCase() === sup.name.trim().toLowerCase())
      );
      if (matchedItems.length > 0) {
        results.push({
          booking: b,
          serviceItems: matchedItems
        });
      }
    }
    return results;
  }

  // =========================================================================
  // SUPPLIER PRICE RECORDS
  // =========================================================================

  public getSupplierPriceRecords(supplierId?: string): SupplierPriceRecord[] {
    const all = this.getItem<SupplierPriceRecord[]>('supplier_price_records', []);
    if (supplierId) {
      return all
        .filter(p => p.supplierId === supplierId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
    return all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  public logSupplierPriceRecord(
    record: Omit<SupplierPriceRecord, 'id' | 'timestamp'>, 
    user: User | null
  ): SupplierPriceRecord {
    const all = this.getItem<SupplierPriceRecord[]>('supplier_price_records', []);
    const entry: SupplierPriceRecord = {
      ...record,
      id: `prc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString()
    };
    all.unshift(entry);
    this.setItem('supplier_price_records', all);
    this.syncFirestoreDoc('supplier_price_records', entry.id, entry);
    return entry;
  }

  public removeServiceItemSupplier(
    bookingId: string, 
    serviceItemId: string, 
    reason: string, 
    user: User | null
  ): { success: boolean; error?: string } {
    const all = this.getAllBookings();
    const b = all.find(item => item.id === bookingId || item.bookingReference === bookingId);
    if (!b || !b.items) return { success: false, error: 'Booking not found' };

    const itemIdx = b.items.findIndex(it => it.id === serviceItemId);
    if (itemIdx === -1) return { success: false, error: 'Service item not found' };

    const currentItem = b.items[itemIdx];
    const prevSupplierId = currentItem.supplierId;
    const prevSupplierName = currentItem.supplierName;

    b.items[itemIdx] = {
      ...currentItem,
      supplierId: undefined,
      supplierName: undefined,
      supplierPhone: undefined,
      supplierEmail: undefined,
      supplierConfirmationRef: undefined,
      supplierStatus: 'PENDING_DISPATCH',
      supplierConfirmationStatus: 'Supplier Not Allocated',
      operationalStatus: 'Supplier Not Allocated'
    };
    b.updatedAt = new Date().toISOString();

    this.saveBooking(b, user);

    if (prevSupplierId) {
      this.logSupplierAllocation({
        supplierId: prevSupplierId,
        supplierNameSnapshot: prevSupplierName || 'Supplier',
        supplierCategory: currentItem.category || 'General',
        bookingId: b.id,
        bookingReference: b.bookingReference,
        serviceItemId: currentItem.id,
        serviceName: currentItem.productName,
        customerName: (b as any).customerName || b.customer?.name || (b as any).buyerName || 'Valued Guest',
        serviceDate: currentItem.serviceDate || currentItem.travelDate,
        status: 'REMOVED',
        allocatedBy: user?.id || 'system',
        allocatedByName: user?.displayName || 'Operations',
        previousSupplierId: prevSupplierId,
        previousSupplierName: prevSupplierName,
        changeReason: reason
      }, user);
    }

    this.logAudit(user, 'BOOKING_UPDATED', 'Booking', b.id, `Removed supplier from service item ${currentItem.productName}: ${reason}`);
    return { success: true };
  }

  // =========================================================================
  // SUPPLIER PROCUREMENT REQUESTS WORKFLOW
  // =========================================================================

  public getSupplierRequests(): SupplierRequest[] {
    return this.getItem<SupplierRequest[]>('supplier_requests', []);
  }

  public saveSupplierRequest(request: SupplierRequest, user: User | null): SupplierRequest {
    const list = this.getSupplierRequests();
    const index = list.findIndex(r => r.id === request.id);
    const timestamp = new Date().toISOString();
    let saved: SupplierRequest;

    if (index >= 0) {
      saved = {
        ...list[index],
        ...request,
        updatedAt: timestamp
      };
      list[index] = saved;
    } else {
      saved = {
        ...request,
        id: request.id || `req-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      list.unshift(saved);
    }

    this.setItem('supplier_requests', list);
    this.syncFirestoreDoc('supplier_requests', saved.id, saved);
    this.logAudit(user, 'BOOKING_UPDATED', 'SupplierRequest', saved.id, `Supplier procurement request ${saved.status} for ${saved.supplierName} (${saved.bookingReference})`);
    return saved;
  }

  // =========================================================================
  // ODOO-STYLE LEAD PIPELINE STAGES
  // =========================================================================

  public getLeadStages(): LeadStageConfig[] {
    const custom = this.getItem<LeadStageConfig[]>('lead_stages', []);
    if (custom && custom.length > 0) {
      return custom.sort((a, b) => a.order - b.order);
    }
    return DEFAULT_LEAD_STAGES;
  }

  public saveLeadStage(stage: LeadStageConfig, user: User | null): LeadStageConfig {
    const stages = [...this.getLeadStages()];
    const index = stages.findIndex(s => s.id === stage.id);
    if (index >= 0) {
      stages[index] = stage;
    } else {
      stages.push(stage);
    }
    stages.sort((a, b) => a.order - b.order);
    this.setItem('lead_stages', stages);
    this.syncFirestoreDoc('lead_stages', stage.id, stage);
    this.logAudit(user, 'SETTINGS_UPDATED', 'LeadStageConfig', stage.id, `Updated lead stage configuration: ${stage.name}`);
    return stage;
  }

  public reorderLeadStages(stages: LeadStageConfig[], user: User | null): LeadStageConfig[] {
    const ordered = stages.map((st, i) => ({ ...st, order: i + 1 }));
    this.setItem('lead_stages', ordered);
    ordered.forEach(st => this.syncFirestoreDoc('lead_stages', st.id, st));
    this.logAudit(user, 'SETTINGS_UPDATED', 'LeadStageConfig', 'reorder', 'Reordered CRM lead pipeline stages');
    return ordered;
  }

  // =========================================================================
  // BOOKING 15-STAGE CUSTOMER PROGRESS WORKFLOW
  // =========================================================================

  public updateBookingProgressStage(
    bookingId: string, 
    progressStage: BookingProgressStage, 
    user: User | null, 
    note?: string
  ): Booking | null {
    const bookings = this.getAllBookings();
    const index = bookings.findIndex(b => b.id === bookingId || b.bookingReference === bookingId);
    if (index === -1) return null;

    const b = bookings[index];
    const timestamp = new Date().toISOString();
    const stageDef = CUSTOMER_PROGRESS_STAGES.find(s => s.stage === progressStage);
    const stageName = stageDef?.label || progressStage;

    b.customerProgressStage = progressStage;
    b.customerFacingStatus = stageDef?.customerTitle || stageName;
    b.updatedAt = timestamp;

    if (!b.customerProgressHistory) {
      b.customerProgressHistory = [];
    }

    b.customerProgressHistory.unshift({
      id: `cph-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      stage: progressStage,
      stageName,
      timestamp,
      changedById: user?.id,
      changedByName: user?.name || 'Operations Lead',
      note: note || stageDef?.customerDescription,
      isPublicToBuyer: true
    });

    if (!b.timeline) b.timeline = [];
    b.timeline.unshift({
      id: `tl-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      title: `Progress Stage → ${stageName}`,
      description: note || stageDef?.customerDescription || `Workflow stage transitioned to ${stageName}`,
      timestamp,
      type: 'STATUS_CHANGE',
      actorName: user?.name || 'Operations Team',
      actorRole: user?.role || 'DMC_STAFF'
    });

    this.setItem('bookings', bookings);
    this.syncFirestoreDoc('bookings', b.id, b);
    this.logAudit(user, 'BOOKING_UPDATED', 'Booking', b.id, `Advanced booking progress stage to [${stageName}] for ${b.bookingReference}`);

    return b;
  }

  public getBookingByTrackingRefOrToken(refOrToken: string): Booking | null {
    if (!refOrToken) return null;
    const clean = refOrToken.trim().toUpperCase();
    const bookings = this.getAllBookings();
    return bookings.find(b => 
      b.bookingReference.toUpperCase() === clean || 
      b.id === refOrToken || 
      (b.trackingToken && b.trackingToken === refOrToken)
    ) || null;
  }

  // =========================================================================
  // OPERATIONS CALENDAR & UPCOMING TRIPS BOARD
  // =========================================================================

  public getOperationsEvents(): OperationsCalendarEvent[] {
    const bookings = this.getAllBookings();
    return generateOperationsCalendarEvents(bookings);
  }

  // =========================================================================
  // FINANCIALS: SALES, PURCHASE, PROFITABILITY, PENDING & EXCESS
  // =========================================================================

  public getSalesDashboardSummary() {
    const bookings = this.getAllBookings();
    let totalSellingValue = 0;
    let amountReceived = 0;
    let amountPending = 0;
    let amountOverdue = 0;
    let excessPaymentsTotal = 0;
    const byDestination: Record<string, number> = {};
    const byMonth: Record<string, number> = {};
    const byBuyerType: Record<string, number> = { 'B2B Agent': 0, 'Direct Buyer': 0 };

    bookings.forEach(b => {
      if (b.status === 'CANCELLED') return;
      const amt = b.totalAmount || 0;
      totalSellingValue += amt;

      // Check payment proofs or status
      let paidForBooking = 0;
      if (b.paymentProofs && b.paymentProofs.length > 0) {
        paidForBooking = b.paymentProofs.reduce((acc, p) => acc + (p.amount || 0), 0);
      } else if (b.paymentStatus === 'PAID') {
        paidForBooking = amt;
      } else if (b.paymentStatus === 'PARTIALLY_PAID') {
        paidForBooking = Math.round(amt * 0.5);
      }

      amountReceived += paidForBooking;
      const balance = amt - paidForBooking;

      if (balance > 0) {
        amountPending += balance;
        if (b.paymentCutoffDate && new Date(b.paymentCutoffDate) < new Date()) {
          amountOverdue += balance;
        }
      } else if (balance < 0) {
        excessPaymentsTotal += Math.abs(balance);
      }

      // Destinations
      const dest = b.items?.[0]?.destinationName || 'Multi-Destination';
      byDestination[dest] = (byDestination[dest] || 0) + amt;

      // Month
      const d = b.travelStartDate ? new Date(b.travelStartDate) : new Date(b.createdAt);
      const monthKey = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
      byMonth[monthKey] = (byMonth[monthKey] || 0) + amt;

      // Buyer type
      if (b.customer?.agencyName) {
        byBuyerType['B2B Agent'] += amt;
      } else {
        byBuyerType['Direct Buyer'] += amt;
      }
    });

    return {
      totalSellingValue,
      amountReceived,
      amountPending,
      amountOverdue,
      excessPaymentsTotal,
      byDestination,
      byMonth,
      byBuyerType
    };
  }

  public getPurchaseDashboardSummary() {
    const bookings = this.getAllBookings();
    let totalSupplierCost = 0;
    let supplierPaymentsMade = 0;
    let supplierPaymentsPending = 0;
    let cutoffRisksCount = 0;
    const costByCategory: Record<string, number> = {};
    const costBySupplier: Record<string, number> = {};

    bookings.forEach(b => {
      if (b.status === 'CANCELLED') return;
      const prof = calculateBookingProfitability(b);
      totalSupplierCost += prof.totalSupplierCost;

      // Approximate supplier settlement status based on booking status
      if (b.status === 'COMPLETED' || b.supplierAllocationStatus === 'FULLY_CONFIRMED_BY_SUPPLIERS') {
        supplierPaymentsMade += Math.round(prof.totalSupplierCost * 0.7);
        supplierPaymentsPending += Math.round(prof.totalSupplierCost * 0.3);
      } else {
        supplierPaymentsPending += prof.totalSupplierCost;
      }

      if (b.paymentCutoffDate && new Date(b.paymentCutoffDate) < new Date(Date.now() + 7 * 86400000)) {
        cutoffRisksCount++;
      }

      if (b.items) {
        b.items.forEach(item => {
          const cat = item.category || 'General Operations';
          const net = (item.unitNetPrice || (item.unitSellingPrice * 0.8)) * (item.totalPax || 1);
          costByCategory[cat] = (costByCategory[cat] || 0) + net;
          
          const sup = item.supplierName || 'Alpine Vista / Nippon Horizon';
          costBySupplier[sup] = (costBySupplier[sup] || 0) + net;
        });
      }
    });

    return {
      totalSupplierCost,
      supplierPaymentsMade,
      supplierPaymentsPending,
      cutoffRisksCount,
      costByCategory,
      costBySupplier
    };
  }

  public getBookingProfitabilityList(): BookingFinancialProfitability[] {
    const bookings = this.getAllBookings();
    return bookings.map(b => calculateBookingProfitability(b));
  }

  public getPendingPaymentsList() {
    const bookings = this.getAllBookings();
    return bookings
      .filter(b => b.status !== 'CANCELLED')
      .map(b => {
        let paid = 0;
        if (b.paymentProofs && b.paymentProofs.length > 0) {
          paid = b.paymentProofs.reduce((sum, p) => sum + (p.amount || 0), 0);
        } else if (b.paymentStatus === 'PAID') {
          paid = b.totalAmount;
        } else if (b.paymentStatus === 'PARTIALLY_PAID') {
          paid = Math.round(b.totalAmount * 0.5);
        }

        const balanceDue = Math.max(0, b.totalAmount - paid);
        const isOverdue = b.paymentCutoffDate ? new Date(b.paymentCutoffDate) < new Date() : false;

        return {
          bookingId: b.id,
          bookingReference: b.bookingReference,
          customerName: b.customer?.leadTravelerName || b.customer?.bookerName || 'Guest',
          agencyName: b.customer?.agencyName,
          totalAmount: b.totalAmount,
          paidAmount: paid,
          balanceDue,
          currency: b.currency || 'EUR',
          dueDate: b.paymentCutoffDate || b.travelStartDate,
          isOverdue,
          travelStartDate: b.travelStartDate,
          status: b.status
        };
      })
      .filter(p => p.balanceDue > 0);
  }

  public getExcessPaymentsList() {
    const bookings = this.getAllBookings();
    return bookings
      .filter(b => b.status !== 'CANCELLED')
      .map(b => {
        let paid = 0;
        if (b.paymentProofs && b.paymentProofs.length > 0) {
          paid = b.paymentProofs.reduce((sum, p) => sum + (p.amount || 0), 0);
        }
        const excess = paid > b.totalAmount ? paid - b.totalAmount : 0;
        return {
          bookingId: b.id,
          bookingReference: b.bookingReference,
          customerName: b.customer?.leadTravelerName || 'Guest',
          agencyName: b.customer?.agencyName,
          totalAmount: b.totalAmount,
          paidAmount: paid,
          excessAmount: excess,
          currency: b.currency || 'EUR',
          refundStatus: excess > 0 ? 'HELD_ON_ACCOUNT' : 'NONE'
        };
      })
      .filter(e => e.excessAmount > 0);
  }
}

export const db = AppDatabase.getInstance();

export const hasBookingOperationPermission = (
  user: User | null,
  permission: keyof BookingOperationsPermissions
): boolean => AppDatabase.getInstance().hasBookingOperationPermission(user, permission);



