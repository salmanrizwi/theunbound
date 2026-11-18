import React, { useState, useMemo, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { 
  Building2, 
  MapPin, 
  Clock, 
  Calendar, 
  Users, 
  Plus, 
  Trash2, 
  Eye, 
  Sparkles, 
  FileText, 
  Download,
  ChevronDown, 
  ChevronUp, 
  Search, 
  Lock, 
  DollarSign, 
  Percent, 
  ArrowLeft,
  X,
  Layers,
  CheckCircle2,
  RefreshCw,
  Send,
  Car,
  Compass,
  BookmarkCheck,
  BedDouble,
  Mail,
  MessageCircle,
  Sliders,
  Briefcase,
  UserCheck,
  AlertTriangle,
  AlertCircle,
  ShieldAlert,
  Info,
  Globe,
  FileCheck,
  ShieldCheck,
  LayoutGrid,
  ListOrdered,
  Copy,
  Columns,
  Split,
  Check,
  Loader2,
  History,
  RotateCcw
} from 'lucide-react';
import { sanitizeProductForAgent } from '../../utils/customerQuoteSanitizer';
import { COMMERCIAL_QUOTATION_TERMS_PLAIN_TEXT } from '../../constants/commercialQuotationTerms';
import { destinationTermsService, DestinationTermsReadinessResult } from '../../services/destinationTermsService';
import { StepByStepQuotationWorkspace } from './StepByStepQuotationWorkspace';
import { VisaServicesAndFacilitationSection } from './VisaServicesAndFacilitationSection';
import { OptionComparisonMatrixModal } from './OptionComparisonMatrixModal';
import { OptionDuplicateModal } from './OptionDuplicateModal';
import { 
  Product, 
  Destination, 
  CurrencyCode, 
  QuoteItem, 
  Quotation, 
  QuotationOption,
  Hotel, 
  CityHub, 
  TripRouteHub,
  SUPPORTED_CURRENCIES,
  HotelRoomType,
  HotelRate,
  MealPlanCode,
  ManualHotelDetails,
  B2BPackage,
  PackageItineraryDay,
  AgentMarginType,
  TravelLead,
  QuoteBrandingMode,
  QuotationCommercialTermsSnapshot,
  QuotationTermsExceptionApproval,
  QuotationOutputOptionKey
} from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useQuotation } from '../../context/QuotationContext';
import { formatCurrency, convertCurrency, calculateQuoteInternalBreakdown, calculateProductPrice, calculateProductPriceForAgent, roundCurrencyAmount, buildQuotationCurrencySnapshot, resolveQuoteAgencyPricingContext } from '../../services/pricingEngine';
import { performanceMonitor } from '../../services/performanceMonitor';
import { backgroundJobService, BackgroundJobRecord } from '../../services/backgroundJobService';
import { canonicalImageService } from '../../services/imageService';
import { sanitizeImageUrl } from '../../utils/imageUtils';
import { ProposalDocumentView } from '../ProposalDocumentView';
import { B2BViewDetailsModal } from '../B2BViewDetailsModal';
import { RailJourneyModal } from '../RailJourneyModal';
import { PricingCalculatorModal } from '../PricingCalculatorModal';
import { GlobalConfiguratorRouter } from '../Configurators/GlobalConfiguratorRouter';
import { isRailProduct, isRailQuoteItem } from '../../services/rail/JapanRailJourneyDataService';
import { 
  AUTHORITATIVE_PRODUCT_CATEGORIES, 
  AuthoritativeProductCategory, 
  normalizeProductCategory, 
  resolveProductCategoryEnum, 
  DISPLAY_TO_CATEGORY_ENUM 
} from '../../services/configuratorRegistry';
import { ManualHotelFormModal } from './ManualHotelFormModal';
import { VisaProduct } from '../../types';
import { AddVisaToQuoteModal, visaProductToProduct } from './AddVisaToQuoteModal';
import { AddAddonModal } from './AddAddonModal';
import { ShareWhatsAppModal } from './ShareWhatsAppModal';
import { canUserShareQuoteWhatsApp, canUserViewInternalCostBreakdown } from '../../services/permissionEngine';
import { 
  classifyPassengers, 
  STANDARD_OPERATIONAL_REMARKS, 
  generateTransferSuggestions, 
  checkItineraryFeasibility,
  TransferSuggestion
} from '../../utils/b2bQuotationHelpers';
import { AppDatabase } from '../../services/db';
import { hotelToProduct, manualHotelToProduct, isManualHotelPricingComplete, calculateHotelStayPrice, validateRoomOccupancy, OccupancyValidationResult } from '../../utils/hotelHelpers';
import {
  doesHotelItemBelongToHubOccurrence,
  generateAccommodationStayId,
  getHubOccurrenceId,
  computeStayDatesForHub
} from '../../utils/hubStayMatching';
import { downloadQuotationPDF } from '../../services/pdfGenerator';
import { googleCalendarAutomation } from '../../services/googleCalendarAutomationService';
import { EmailNotificationService } from '../../services/emailNotificationService';
import { formatPlainTextQuotationToHtml } from '../../services/quoteEmailFormatter';
import { DestinationRelevanceService, matchesDestination } from '../../services/destinationRelevanceService';
import { QuotationScope } from '../../types';
import { buildAgencyBrandingSnapshotFromUser, validateWhiteLabelReadiness } from '../../services/quotePresentationModel';
import { PackageDetailModal } from '../PackageDetailModal';
import {
  buildMasterPackageFromQuoteWorkspace,
  saveAndVerifyMasterPackageFromQuote,
  normalizeMasterPackageTripType,
  MasterPackageVerificationReport
} from '../../services/packageToQuoteTransformer';
import {
  buildAuthoritativeQuotationSnapshot,
  recordQuotationGenerationEvent,
  validateQuotationOutputConsistency
} from '../../services/quotationSnapshotService';
import { QuotationVersionHistoryModal } from '../Quotations/QuotationVersionHistoryModal';
import { inventoryVisibilityService } from '../../services/inventoryVisibilityService';
import {
  quotationOperationsService,
  withBoundedTimeout
} from '../../services/quotationOperationsService';

// Helper to check if a product is tagged with or matches a specific city / hub
export const isProductMatchingCity = (product: Product, targetCityName?: string, targetHubId?: string): boolean => {
  if (!targetCityName && !targetHubId) return true;
  
  const target = (targetCityName || '').trim().toLowerCase();
  if (!target || target === 'all' || target === 'general') return true;

  // Direct hubId match
  if (targetHubId && product.hubId && (
    product.hubId.toLowerCase() === targetHubId.toLowerCase() || 
    targetHubId.toLowerCase().includes(product.hubId.toLowerCase()) || 
    product.hubId.toLowerCase().includes(targetHubId.toLowerCase())
  )) {
    return true;
  }

  const pCity = (product.city || '').trim().toLowerCase();
  const pLocation = (product.location || '').trim().toLowerCase();
  const pName = (product.name || '').trim().toLowerCase();
  const pSubcategory = (product.subcategory || '').trim().toLowerCase();
  const pDesc = (product.shortDescription || product.longDescription || '').trim().toLowerCase();

  // 1. Direct city equality or containment (e.g. "Tokyo", "Kyoto", "Osaka")
  if (pCity) {
    if (pCity === target || pCity.includes(target) || target.includes(pCity)) {
      return true;
    }
  }

  // 2. Check location or name or description or hubId contains target city
  if (
    pLocation.includes(target) ||
    pName.includes(target) ||
    pSubcategory.includes(target) ||
    pDesc.includes(target) ||
    (product.hubId && product.hubId.toLowerCase().includes(target))
  ) {
    return true;
  }

  return false;
};

function shallowRecordEqual<T extends Record<string | number, any>>(a?: T, b?: T): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (let i = 0; i < keysA.length; i++) {
    const k = keysA[i];
    if (a[k] !== b[k]) return false;
  }
  return true;
}

export interface UnifiedB2BQuotationBuilderProps {
  initialDestinationSlug?: string;
  targetQuoteId?: string;
  targetQuoteVersion?: number;
  initialMode?: 'inspect' | 'edit' | 'clone' | 'readonly' | 'restore';
  isNewQuoteMode?: boolean;
  prefillLead?: TravelLead | null;
  destinations?: Destination[];
  products?: Product[];
  hotels?: Hotel[];
  cityHubs?: CityHub[];
  onBackToDashboard?: () => void;
  onViewMyQuotes?: () => void;
  onNavigateToPackages?: (packageId?: string) => void;
  onConvertToBooking?: (quote: Quotation) => void;
  onBookQuotation?: (quote: Quotation) => void;
  onViewProductDetails?: (product: Product) => void;
  onOpenSpecs?: () => void;
  onConfigureDestinationTerms?: (targetId: string) => void;
  onQuoteSaved?: (quote: Quotation) => void;
}

const UnifiedB2BQuotationBuilderBase: React.FC<UnifiedB2BQuotationBuilderProps> = ({
  initialDestinationSlug,
  targetQuoteId,
  targetQuoteVersion,
  initialMode = 'edit',
  isNewQuoteMode = false,
  prefillLead,
  destinations = [],
  products = [],
  hotels: propHotels = [],
  cityHubs: propCityHubs = [],
  onBackToDashboard,
  onViewMyQuotes,
  onNavigateToPackages,
  onConvertToBooking,
  onBookQuotation,
  onViewProductDetails,
  onOpenSpecs,
  onConfigureDestinationTerms,
  onQuoteSaved
}) => {
  const { user } = useAuth();
  const db = AppDatabase.getInstance();

  // Permission Check for Saving as Master Ready-Made Package
  // When B2B Agent is taken to Quotation Builder, "Save as package" button must NOT be visible to B2B Agent.
  const canSaveAsPackage = Boolean(
    user &&
    user.role !== 'B2B_AGENT' &&
    (user.role === 'ADMIN' || 
     user.role === 'DMC_STAFF' || 
     (user as any).role === 'SUPER_ADMIN' ||
     (user.role === 'TEAM_MEMBER' && user.permissions?.canManagePackages !== false))
  );

  // Master Quotation Context
  const { 
    items, 
    setItems,
    addProductToQuote, 
    removeProductFromQuote, 
    updateItemPax, 
    updateItemTravelDate, 
    updateItemServiceTime, 
    updateItemFull, 
    updateItemNotes,
    currency, 
    setCurrency,
    clientName, 
    setClientName,
    clientEmail, 
    setClientEmail,
    clientCompany, 
    setClientCompany,
    clientPhone,
    setClientPhone,
    agentNotes,
    setAgentNotes,
    overallDiscountPercent,
    setOverallDiscountPercent,
    totalNetCost,
    totalSellingPrice,
    totalMarginAmount,
    saveCurrentQuote,
    quoteTitle,
    setQuoteTitle,
    sourcePackageId,
    setSourcePackageId,
    sourcePackageName,
    setSourcePackageName,
    quotationScope: contextQuotationScope,
    setQuotationScope: setContextQuotationScope,
    routeHubs: contextRouteHubs,
    setRouteHubs: setContextRouteHubs,
    paxConfig: contextPaxConfig,
    setPaxConfig: setContextPaxConfig,
    dayThemes: contextDayThemes,
    setDayThemes: setContextDayThemes,
    dayDescriptions: contextDayDescriptions,
    setDayDescriptions: setContextDayDescriptions,
    dayOverviews: contextDayOverviews,
    setDayOverviews: setContextDayOverviews,
    dayNotes: contextDayNotes,
    setDayNotes: setContextDayNotes,
    itineraryOverview: contextItineraryOverview,
    setItineraryOverview: setContextItineraryOverview,
    inclusions: contextInclusions,
    setInclusions: setContextInclusions,
    exclusions: contextExclusions,
    setExclusions: setContextExclusions,
    importantInformation: contextImportantInformation,
    setImportantInformation: setContextImportantInformation,
    cancellationPolicy: contextCancellationPolicy,
    setCancellationPolicy: setContextCancellationPolicy,
    destination: contextDestination,
    travelStartDate: contextStartDate,
    travelEndDate: contextEndDate,
    setQuotationDates: setContextQuotationDates,
    handoffPayload,
    quoteSource,
    priceRefreshNotice,
    clearQuote,
    setIsQuoteDrawerOpen,
    draftDestinationReview,
    destinationVisibilityError,
    clearDestinationVisibilityError
  } = useQuotation();

  // Strictly close global cart drawer on entry into the B2B Quote Builder
  useEffect(() => {
    setIsQuoteDrawerOpen(false);
  }, []);

  // Local agent markup & margin state (Section 2 & Step 9) — Default is 0 (no unrequested 10% markup)
  const [agentMarginType, setAgentMarginType] = useState<AgentMarginType>('PERCENTAGE');
  const [agentMarginValue, setAgentMarginValue] = useState<number>(0);
  const [agentMarkupPercent, setAgentMarkupPercent] = useState<number>(0);
  const [adminBasePriceUpdatedNotification, setAdminBasePriceUpdatedNotification] = useState<Quotation['adminBasePriceUpdatedNotification']>(undefined);

  const updateItemAdditionalMarkup = useCallback((itemId: string, markupType: AgentMarginType, markupValue: number) => {
    const safeVal = Number.isFinite(Number(markupValue)) && Number(markupValue) > 0 ? Number(markupValue) : 0;
    setItems(prev => prev.map(it => {
      if (it.id !== itemId) return it;
      return {
        ...it,
        agentAdditionalMarkupType: markupType,
        agentAdditionalMarkupValue: safeVal
      };
    }));
  }, [setItems]);

  // Admin Manual Margin on Total Nett Cost (Step 7) — Default mode is 'ADD' (Add to Existing Margin)
  const [adminManualMarginType, setAdminManualMarginType] = useState<'PERCENTAGE' | 'FIXED'>('PERCENTAGE');
  const [adminManualMarginValue, setAdminManualMarginValue] = useState<number>(0);
  const [adminMarginMode, setAdminMarginMode] = useState<'REPLACE' | 'ADD'>('ADD');

  // Quote-specific Agency Pricing Context (prevents Admin's own profile from overriding the quote's B2B agency settings)
  const [quoteCompanyId, setQuoteCompanyId] = useState<string | undefined>(undefined);
  const [quoteAgentId, setQuoteAgentId] = useState<string | undefined>(undefined);
  const [quoteAgentAgency, setQuoteAgentAgency] = useState<string | undefined>(undefined);
  const [quoteProductLevelMarginEnabled, setQuoteProductLevelMarginEnabled] = useState<boolean | undefined>(undefined);
  const [quoteAgentLevelMarginPercent, setQuoteAgentLevelMarginPercent] = useState<number | undefined>(undefined);

  // Top-Level View State & Independent Per-Tab Scroll Restoration
  const [activeViewTab, setActiveViewTab] = useState<'BUILDER' | 'PROPOSAL_PREVIEW'>('BUILDER');
  const workspaceScrollRef = useRef<HTMLDivElement | null>(null);
  const scrollTopMapRef = useRef<{ BUILDER: number; PROPOSAL_PREVIEW: number }>({
    BUILDER: 0,
    PROPOSAL_PREVIEW: 0
  });
  const activeViewTabRef = useRef<'BUILDER' | 'PROPOSAL_PREVIEW'>(activeViewTab);
  activeViewTabRef.current = activeViewTab;

  const handleWorkspaceScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    scrollTopMapRef.current[activeViewTabRef.current] = e.currentTarget.scrollTop;
  }, []);

  const switchViewTab = useCallback((nextTab: 'BUILDER' | 'PROPOSAL_PREVIEW') => {
    if (workspaceScrollRef.current) {
      scrollTopMapRef.current[activeViewTabRef.current] = workspaceScrollRef.current.scrollTop;
    }
    setActiveViewTab(nextTab);
  }, []);

  useLayoutEffect(() => {
    const el = workspaceScrollRef.current;
    if (el) {
      el.scrollTop = scrollTopMapRef.current[activeViewTab] || 0;
    }
  }, [activeViewTab]);

  const [activeStepId, setActiveStepId] = useState<number>(1);
  const [brandingMode, setBrandingMode] = useState<QuoteBrandingMode>('STANDARD');

  // Strict Active B2B Destinations (never expose INACTIVE / COMING_SOON / DRAFT / ARCHIVED for new quotes or selectors)
  const activeB2BDestinations = useMemo(() => {
    const passedActive = (destinations || []).filter(d => inventoryVisibilityService.isDestinationActiveForB2B(d));
    if (passedActive.length > 0) return passedActive;
    return inventoryVisibilityService.getB2BActiveDestinations();
  }, [destinations]);

  // Destination & Specs State
  const defaultDest = useMemo(() => {
    if (initialDestinationSlug) {
      const found = activeB2BDestinations.find(d => d.slug === initialDestinationSlug || d.id === initialDestinationSlug);
      if (found) return found;
    }
    return activeB2BDestinations[0] || {
      id: 'dest-unavailable',
      name: 'No Active Destination',
      slug: '',
      code: '',
      description: '',
      heroImage: '',
      regions: [],
      status: 'INACTIVE',
      active: false,
      currency: 'USD',
      featured: false
    };
  }, [activeB2BDestinations, initialDestinationSlug]);

  const [currentDestination, setCurrentDestination] = useState<Destination>(defaultDest);

  // Client Details & Specs
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');
  const [tripType, setTripType] = useState('FIT Luxury');
  const [quotationScope, setQuotationScope] = useState<QuotationScope>(() => contextQuotationScope || 'HOTEL_LAND');

  // Travel Dates & Passengers
  const [startDate, setStartDate] = useState<string>(() => {
    if (contextStartDate) return contextStartDate;
    const d = new Date();
    d.setDate(d.getDate() + 21);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    if (contextEndDate) return contextEndDate;
    const d = new Date();
    d.setDate(d.getDate() + 28);
    return d.toISOString().split('T')[0];
  });

  const [adultsCount, setAdultsCount] = useState<number>(() => contextPaxConfig?.adults || 2);
  const [childrenCount, setChildrenCount] = useState<number>(() => contextPaxConfig?.children || 0);
  const [infantsCount, setInfantsCount] = useState<number>(() => contextPaxConfig?.infants || 0);
  const [childAges, setChildAges] = useState<number[]>(() => contextPaxConfig?.childAges || []);
  const childAgesRef = useRef<number[]>(childAges);
  childAgesRef.current = childAges;
  const [nationality, setNationality] = useState<string>('Indian');
  const [travelStyle, setTravelStyle] = useState<string>('FIT Luxury');
  const [mealPlanPreference, setMealPlanPreference] = useState<string>('CP (Breakfast Included)');
  const [roomingConfig, setRoomingConfig] = useState({
    roomsCount: 1,
    extraBedRequired: true
  });
  const [visaAssistanceChoice, setVisaAssistanceChoice] = useState<'YES' | 'NO' | 'NOT_REQUIRED' | 'LATER'>('NOT_REQUIRED');

  // Synchronize state when QuotationContext changes (e.g. from AI Planner handoff)
  useEffect(() => {
    if (contextStartDate) setStartDate(contextStartDate);
    if (contextEndDate) setEndDate(contextEndDate);
  }, [contextStartDate, contextEndDate]);

  // Initialize QuotationContext travel dates on mount if not yet populated
  useEffect(() => {
    if (startDate && endDate && !contextStartDate && !contextEndDate) {
      setContextQuotationDates(startDate, endDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (contextQuotationScope) {
      setQuotationScope(contextQuotationScope);
    }
  }, [contextQuotationScope]);

  useEffect(() => {
    if (contextPaxConfig) {
      setAdultsCount(contextPaxConfig.adults ?? 2);
      setChildrenCount(contextPaxConfig.children ?? 0);
      setChildAges(contextPaxConfig.childAges ?? []);
      setInfantsCount(contextPaxConfig.infants ?? 0);
    }
  }, [contextPaxConfig]);

  useEffect(() => {
    if (contextDestination) {
      const qDestLower = contextDestination.toLowerCase();
      const found = activeB2BDestinations.find(d => 
        (d.name || '').toLowerCase() === qDestLower ||
        (d.slug || '').toLowerCase() === qDestLower ||
        (d.id || '').toLowerCase() === qDestLower
      );
      if (found && found.id !== currentDestination.id) {
        setCurrentDestination(found);
      }
    }
  }, [contextDestination, activeB2BDestinations, currentDestination.id]);

  // Quotation Multi-Options State (Option 1, Option 2, Option 3)
  const [activeOptionTab, setActiveOptionTab] = useState<number>(1);
  const [showComparisonMatrixModal, setShowComparisonMatrixModal] = useState<boolean>(false);
  const [showDuplicateOptionModal, setShowDuplicateOptionModal] = useState<boolean>(false);

  // In-Builder Toast Notification (Replaces Cart Drawer popping up)
  const [builderToast, setBuilderToast] = useState<{ message: string; type: 'SUCCESS' | 'INFO' | 'WARNING' } | null>(null);

  const showBuilderToast = useCallback((message: string, type: 'SUCCESS' | 'INFO' | 'WARNING' = 'SUCCESS') => {
    setBuilderToast({ message, type });
    setTimeout(() => {
      setBuilderToast(prev => (prev?.message === message ? null : prev));
    }, 3500);
  }, []);

  // Independent Options Data Storage
  interface OptionDataState {
    optionNumber: number;
    title: string;
    badge: string;
    hotelTier: string;
    scope?: QuotationScope;
    items: QuoteItem[];
    routeHubs: TripRouteHub[];
    dayThemes: Record<number, string>;
    agentMarkupPercent: number;
    overallDiscountPercent: number;
  }

  const [optionsData, setOptionsData] = useState<Record<number, OptionDataState>>({
    1: {
      optionNumber: 1,
      title: 'Option 1: Standard 4-Star Premium',
      badge: 'POPULAR CHOICE',
      hotelTier: '4-Star Premium',
      scope: 'HOTEL_LAND',
      items: [],
      routeHubs: [],
      dayThemes: {},
      agentMarkupPercent: 0,
      overallDiscountPercent: 0
    },
    2: {
      optionNumber: 2,
      title: 'Option 2: 5-Star Luxury Upgrade',
      badge: 'UPGRADED',
      hotelTier: '5-Star Luxury',
      scope: 'HOTEL_LAND',
      items: [],
      routeHubs: [],
      dayThemes: {},
      agentMarkupPercent: 0,
      overallDiscountPercent: 0
    },
    3: {
      optionNumber: 3,
      title: 'Option 3: Signature / Private Villa',
      badge: 'ULTRA-LUXE',
      hotelTier: 'Signature / Private Villa',
      scope: 'HOTEL_LAND',
      items: [],
      routeHubs: [],
      dayThemes: {},
      agentMarkupPercent: 0,
      overallDiscountPercent: 0
    }
  });

  const [quotationOptions, setQuotationOptions] = useState<QuotationOption[]>([
    {
      id: 'opt-1',
      optionNumber: 1,
      title: 'Option 1: Standard 4-Star Premium',
      badge: 'POPULAR CHOICE',
      hotelTier: '4-Star Premium',
      items: [],
      routeHubs: [],
      totalNetCost: 0,
      totalSellingPrice: 0,
      totalMargin: 0,
      totalTaxes: 0
    }
  ]);

  // Addon Modal (Insurance, eSIM, VIP Services)
  const [showAddonModal, setShowAddonModal] = useState<boolean>(false);
  const [addonModalCategory, setAddonModalCategory] = useState<'ALL' | 'INSURANCE' | 'ESIM' | 'SERVICES'>('ALL');

  // WhatsApp Share Modal State
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState<boolean>(false);
  const [whatsAppModalQuote, setWhatsAppModalQuote] = useState<Quotation | null>(null);

  // Dynamic Passenger Classification Engine
  const passengerClassification = useMemo(() => {
    return classifyPassengers(adultsCount, childAges, infantsCount);
  }, [adultsCount, childAges, infantsCount]);

  // Dynamic Internal Cost Access check
  const canViewInternalCosts = canUserViewInternalCostBreakdown(user);

  // Live Pricing State for Ready-Made Packages & Quotation Tariffs
  const [packagePricingStatus, setPackagePricingStatus] = useState<'IDLE' | 'CALCULATING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [packagePricingError, setPackagePricingError] = useState<{ message: string; failedItems: string[] } | null>(null);
  const activePricingRequestIdRef = useRef<number>(0);
  const lastCalculatedPackageSessionRef = useRef<string>('');

  // Authoritative Central Pricing Engine: recalculate all quote items with latest database tariffs, margin rules, and pax
  const recalculateItemsWithLatestTariffs = useCallback((
    targetItems: QuoteItem[],
    nextAdults: number,
    nextChildren: number,
    nextInfants: number,
    targetCurrency: CurrencyCode,
    dateDiffDays: number = 0
  ): { updatedItems: QuoteItem[]; failedItems: Array<{ id: string; name: string; error?: string }> } => {
    const pricingTier = user && user.role !== 'PUBLIC' ? 'B2B' : 'B2C';
    const shiftIsoDate = (iso?: string): string | undefined => {
      if (!iso || dateDiffDays === 0) return iso;
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      d.setDate(d.getDate() + dateDiffDays);
      return d.toISOString().split('T')[0];
    };

    const db = AppDatabase.getInstance();
    const masterProducts = db.getProducts();
    const masterHotels = db.getHotels();
    const failedItems: Array<{ id: string; name: string; error?: string }> = [];

    const updatedItems = targetItems.map(item => {
      const nextTravelDate = shiftIsoDate(item.travelDate) || item.travelDate;
      const nextCheckIn = shiftIsoDate(item.checkInDate) || item.checkInDate;
      const nextCheckOut = shiftIsoDate(item.checkOutDate) || item.checkOutDate;
      const nextManualDetails = item.manualHotelDetails
        ? {
            ...item.manualHotelDetails,
            checkInDate: shiftIsoDate(item.manualHotelDetails.checkInDate) || item.manualHotelDetails.checkInDate,
            checkOutDate: shiftIsoDate(item.manualHotelDetails.checkOutDate) || item.manualHotelDetails.checkOutDate
          }
        : item.manualHotelDetails;

      // 1. Retrieve current product Nett Prices and latest master records
      let effectiveProduct: Product = item.product;
      if ((item.isManualHotel || (item.product as any)?.accommodationType === 'manual') && nextManualDetails) {
        effectiveProduct = manualHotelToProduct(nextManualDetails, currentDestination);
      } else if (
        item.hotelId ||
        item.product.id?.startsWith('hotel-prod-') ||
        item.product.productType === 'Hotel' ||
        item.product.productType === 'Hotel & Resort'
      ) {
        const hotel = masterHotels.find(
          h =>
            (item.hotelId && h.id === item.hotelId) ||
            (item.product.id && item.product.id.startsWith(`hotel-prod-${h.id}-`)) ||
            (h.name || '').toLowerCase() === (item.product.name || '').toLowerCase()
        );
        if (hotel) {
          const roomType =
            hotel.roomTypes?.find(
              r =>
                r.id === item.roomTypeId ||
                (item.product.id && item.product.id.includes(`-${r.id}-`)) ||
                (r.roomName && item.product.shortDescription?.toLowerCase().includes(r.roomName.toLowerCase()))
            ) || hotel.roomTypes?.[0];
          const rate = roomType?.rates?.[0];
          const nights = item.nights || (item.product as any)?.nights || 1;
          const safeRooms = item.roomsCount || (item.product as any)?.roomsCount || Math.max(1, Math.ceil(nextAdults / 2));
          const hotelProd = hotelToProduct(hotel, roomType, rate, nights, safeRooms);
          if (hotelProd) {
            effectiveProduct = hotelProd;
          }
        }
      } else {
        const matched = masterProducts.find(p =>
          p.id === item.product.id ||
          p.product_id === item.product.id ||
          (item.master_product_id && (p.id === item.master_product_id || p.product_id === item.master_product_id)) ||
          (item.service_id && (p.id === item.service_id || p.product_id === item.service_id)) ||
          (item.product.sku && p.sku === item.product.sku)
        );
        if (matched) {
          effectiveProduct = matched;
        }
      }

      // 2. Sanitize product for B2B Agents to conceal internal nett costs
      const sanitizedProduct = !canViewInternalCosts ? sanitizeProductForAgent(effectiveProduct) : effectiveProduct;

      // 3. Centralized Pricing Engine Execution
      const calcParams = {
        productId: effectiveProduct.id,
        productName: sanitizedProduct.name || effectiveProduct.name,
        itemId: item.id,
        quoteId: activeQuoteId,
        pricingTier: 'B2B' as const,
        adults: nextAdults,
        children: nextChildren,
        infants: nextInfants,
        travelDate: nextTravelDate,
        serviceEndDate: nextCheckOut || item.checkOutDate,
        nights: item.nights || nextManualDetails?.numberOfNights || (effectiveProduct as any).nights,
        roomsCount: item.roomsCount || nextManualDetails?.numberOfRooms || (effectiveProduct as any).roomsCount,
        targetCurrency,
        selectedAddonIds: item.selectedAddonIds || [],
        userRole: user?.role || 'B2B_AGENT',
        user,
        companyId: user?.companyId,
        agencyName: user?.agencyName
      };

      let calculation: any;
      try {
        calculation = !canViewInternalCosts
          ? (calculateProductPriceForAgent(effectiveProduct, calcParams) as any)
          : calculateProductPrice(effectiveProduct, calcParams);
      } catch (err: any) {
        console.error(`Tariff calculation error for ${effectiveProduct.name}:`, err);
        failedItems.push({ id: item.id, name: effectiveProduct.name || item.product.name, error: err?.message });
        calculation = item.calculation;
      }

      return {
        ...item,
        product: sanitizedProduct,
        pax: { adults: nextAdults, children: nextChildren, infants: nextInfants },
        travelDate: nextTravelDate,
        checkInDate: nextCheckIn,
        checkOutDate: nextCheckOut,
        hubId: item.hubId || item.itineraryHubOccurrenceId || nextManualDetails?.hubId,
        itineraryHubOccurrenceId: item.itineraryHubOccurrenceId || item.hubId || nextManualDetails?.itineraryHubOccurrenceId || nextManualDetails?.hubId,
        accommodationStayId: item.accommodationStayId || nextManualDetails?.accommodationStayId,
        manualHotelDetails: nextManualDetails,
        calculation,
        pricing_snapshot: {
          ...(item.pricing_snapshot || {}),
          ...calculation,
          inventoryId: effectiveProduct.id,
          selectedServiceDate: nextTravelDate,
          basePriceSnapshot: calculation?.baseSellingPriceBeforeSurcharges ?? calculation?.finalTotalSellingPrice ?? 0,
          currency: targetCurrency,
          finalCalculatedPrice: calculation?.finalTotalSellingPrice ?? calculation?.sellingPriceFinal ?? 0,
          pricingRuleVersion: calculation?.rateVersion || 'v2.1-validity-surcharge',
          capturedAt: new Date().toISOString()
        },
        currency_snapshot: targetCurrency
      };
    });

    return { updatedItems, failedItems };
  }, [user, canViewInternalCosts, currentDestination]);

  // Backward-compatible helper for pax and date delta changes
  const recalculateItemsForPaxAndDateShift = useCallback((
    targetItems: QuoteItem[],
    nextAdults: number,
    nextChildren: number,
    nextInfants: number,
    dateDiffDays: number = 0
  ): QuoteItem[] => {
    return recalculateItemsWithLatestTariffs(targetItems, nextAdults, nextChildren, nextInfants, currency, dateDiffDays).updatedItems;
  }, [recalculateItemsWithLatestTariffs, currency]);

  // Handle Start Date change (automatically shifts End Date and all scheduled items by the date delta)
  const handleChangeStartDate = (newStartDate: string) => {
    if (!newStartDate) {
      setStartDate(newStartDate);
      return;
    }
    const prevStart = new Date(startDate);
    const nextStart = new Date(newStartDate);
    let nextEndDate = endDate;

    if (!isNaN(prevStart.getTime()) && !isNaN(nextStart.getTime())) {
      const diffDays = Math.round((nextStart.getTime() - prevStart.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays !== 0) {
        const currentNights = routeHubs.reduce((acc, h) => acc + (h.nights || 0), 0) || tripNights || 7;
        const computedEnd = new Date(nextStart);
        computedEnd.setDate(computedEnd.getDate() + Math.max(1, currentNights));
        nextEndDate = computedEnd.toISOString().split('T')[0];

        if (items.length > 0) {
          const shiftedItems = recalculateItemsForPaxAndDateShift(items, adultsCount, childrenCount, infantsCount, diffDays);
          setItems(shiftedItems);
        }
        if (routeHubs.length > 0) {
          const shiftIso = (iso?: string) => {
            if (!iso) return iso;
            const d = new Date(iso);
            if (isNaN(d.getTime())) return iso;
            d.setDate(d.getDate() + diffDays);
            return d.toISOString().split('T')[0];
          };
          handleUpdateRouteHubs(prevHubs =>
            prevHubs.map(h => ({
              ...h,
              checkInDate: shiftIso(h.checkInDate),
              checkOutDate: shiftIso(h.checkOutDate),
              manualHotel: h.manualHotel
                ? {
                    ...h.manualHotel,
                    checkInDate: shiftIso(h.manualHotel.checkInDate) || h.manualHotel.checkInDate,
                    checkOutDate: shiftIso(h.manualHotel.checkOutDate) || h.manualHotel.checkOutDate
                  }
                : h.manualHotel
            }))
          );
        }
      }
    }

    setStartDate(newStartDate);
    setEndDate(nextEndDate);
    setContextQuotationDates(newStartDate, nextEndDate);
  };

  const handleChangeEndDate = (newEndDate: string) => {
    setEndDate(newEndDate);
    setContextQuotationDates(startDate, newEndDate);
  };

  // Handle Changing Adult Count
  const handleSetAdultsCount = (newAdults: number) => {
    const safeAdults = Math.max(1, newAdults);
    setAdultsCount(safeAdults);
    setContextPaxConfig(prev => ({ ...prev, adults: safeAdults }));
    if (items.length > 0) {
      setItems(prev => recalculateItemsForPaxAndDateShift(prev, safeAdults, childrenCount, infantsCount, 0));
    }
  };

  // Handle Changing Child Count
  const handleSetChildrenCount = (newCount: number) => {
    const safeCount = Math.max(0, newCount);
    setChildrenCount(safeCount);
    let updatedAges = [...childAges];
    if (safeCount > updatedAges.length) {
      for (let i = updatedAges.length; i < safeCount; i++) {
        updatedAges.push(7); // Default child age 7 (CWB)
      }
    } else if (safeCount < updatedAges.length) {
      updatedAges.splice(safeCount);
    }
    childAgesRef.current = updatedAges;
    setChildAges(updatedAges);
    setContextPaxConfig(prev => ({ ...prev, children: safeCount, childAges: updatedAges }));
    if (items.length > 0) {
      setItems(prev => recalculateItemsForPaxAndDateShift(prev, adultsCount, safeCount, infantsCount, 0));
    }
  };

  // Handle Changing Infant Count
  const handleSetInfantsCount = (newInfants: number) => {
    const safeInfants = Math.max(0, newInfants);
    setInfantsCount(safeInfants);
    setContextPaxConfig(prev => ({ ...prev, infants: safeInfants }));
    if (items.length > 0) {
      setItems(prev => recalculateItemsForPaxAndDateShift(prev, adultsCount, childrenCount, safeInfants, 0));
    }
  };

  const handleUpdateChildAge = (index: number, age: number) => {
    const next = [...childAgesRef.current];
    next[index] = age;
    childAgesRef.current = next;
    setChildAges(next);
    setContextPaxConfig(p => ({ ...p, childAges: next }));
  };

  // Calculate Nights from Dates
  const tripNights = useMemo(() => {
    if (!startDate || !endDate) return 7;
    const s = new Date(startDate);
    const e = new Date(endDate);
    const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 1;
  }, [startDate, endDate]);

  // Section Accordion Visibility
  const [isSpecsExpanded, setIsSpecsExpanded] = useState<boolean>(true);
  const [isRouteExpanded, setIsRouteExpanded] = useState<boolean>(true);
  const [isHotelSectionExpanded, setIsHotelSectionExpanded] = useState<boolean>(true);

  // Explicit Save Draft Lifecycle & Authoritative Version State (Zero Autosave)
  const [autoSaveStatus, setAutoSaveStatus] = useState<'SAVED' | 'SAVING' | 'IDLE' | 'FAILED'>('IDLE');
  const [autoSaveError, setAutoSaveError] = useState<string | null>(null);
  const [lastSavedTimestamp, setLastSavedTimestamp] = useState<string>('');
  const [activeBackgroundJobs, setActiveBackgroundJobs] = useState<BackgroundJobRecord[]>(() => backgroundJobService.getActiveJobs());
  const [activeQuoteId, setActiveQuoteId] = useState<string>(() => targetQuoteId && !isNewQuoteMode ? targetQuoteId : `QTE-${Date.now().toString(36).toUpperCase()}`);
  const [quoteNumber, setQuoteNumber] = useState<string>(() => `QTE-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
  const [quoteVersion, setQuoteVersion] = useState<number>(() => targetQuoteVersion || 1);
  const [latestSavedVersion, setLatestSavedVersion] = useState<number>(() => targetQuoteVersion || 1);
  const [versionCount, setVersionCount] = useState<number>(0);
  const [restoredFromVersion, setRestoredFromVersion] = useState<number | undefined>(undefined);
  const [isReadOnlyHistoricalMode, setIsReadOnlyHistoricalMode] = useState<boolean>(initialMode === 'readonly');
  const [hasExplicitlySaved, setHasExplicitlySaved] = useState<boolean>(Boolean(targetQuoteId && !isNewQuoteMode));
  const [isSavingExplicitly, setIsSavingExplicitly] = useState<boolean>(false);
  const [baselineSavedHash, setBaselineSavedHash] = useState<string>('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [authoritativeSavedQuote, setAuthoritativeSavedQuote] = useState<Quotation | null>(null);
  const [outputSyncError, setOutputSyncError] = useState<string | null>(null);
  const [outputBusyOption, setOutputBusyOption] = useState<QuotationOutputOptionKey | null>(null);
  const [isVersionHistoryModalOpen, setIsVersionHistoryModalOpen] = useState<boolean>(false);
  const [pendingLeaveAction, setPendingLeaveAction] = useState<(() => void) | null>(null);
  const [pendingOutputRequest, setPendingOutputRequest] = useState<{
    option: QuotationOutputOptionKey;
    label: string;
    onResolved: (quote: Quotation) => void | Promise<void>;
  } | null>(null);

  // Destination-Wise Commercial Quotation Terms State
  const [loadedQuoteStatus, setLoadedQuoteStatus] = useState<Quotation['status']>('DRAFT');
  const [loadedIsLocked, setLoadedIsLocked] = useState<boolean>(false);
  const [loadedFinalisedSnapshot, setLoadedFinalisedSnapshot] = useState<QuotationCommercialTermsSnapshot | null>(null);
  const [termsExceptionApproval, setTermsExceptionApproval] = useState<QuotationTermsExceptionApproval | undefined>(undefined);
  const [termsRefreshTick, setTermsRefreshTick] = useState<number>(0);
  const [hasDraftTermsUpdateAvailable, setHasDraftTermsUpdateAvailable] = useState<boolean>(false);
  const [termsSyncLoading, setTermsSyncLoading] = useState<boolean>(false);
  const [adminMissingTermsNotifiedKey, setAdminMissingTermsNotifiedKey] = useState<string>('');

  const builderMountStartRef = useRef<number>(typeof performance !== 'undefined' ? performance.now() : Date.now());
  const prevStepIdRef = useRef<number>(activeStepId);
  const lastSavedHashRef = useRef<string>('');
  const isExplicitSavingRef = useRef<boolean>(false);
  const hydratedSessionKeyRef = useRef<string>('');
  const pendingBaselineCommitRef = useRef<boolean>(false);
  const nextHubUidRef = useRef<number>(0);
  const isInternalHubMutationRef = useRef<boolean>(false);
  const loadedTermsTargetsRef = useRef<Set<string>>(new Set());
  const pendingSaveRequestIdRef = useRef<{ workingHash: string; requestId: string } | null>(null);
  const emailIdempotencyKeyRef = useRef<{ signature: string; key: string } | null>(null);

  // Measure Quote Builder mount latency and subscribe to active background jobs (e.g. PDF exports)
  useEffect(() => {
    const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - builderMountStartRef.current;
    performanceMonitor.recordTiming('QUOTE_BUILDER_INIT', targetQuoteId ? 'Load Existing Quote' : 'New Quote Builder', elapsed, {
      targetQuoteId: targetQuoteId || undefined
    });
    const unsubJobs = backgroundJobService.subscribe(() => {
      setActiveBackgroundJobs(backgroundJobService.getActiveJobs());
    });
    return () => unsubJobs();
  }, []);

  // Track step navigation timings
  useEffect(() => {
    if (prevStepIdRef.current !== activeStepId) {
      const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
      requestAnimationFrame(() => {
        const dt = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
        performanceMonitor.recordTiming('QUOTE_STEP_SWITCH', `Step ${prevStepIdRef.current} -> Step ${activeStepId}`, dt);
        prevStepIdRef.current = activeStepId;
      });
    }
  }, [activeStepId]);

  // Authoritative Quote Loading & Async Firestore Deep-Link Hydration (Respects Historical, Restore & Working States)
  useEffect(() => {
    let cancelled = false;
    const sessionKey = targetQuoteId && !isNewQuoteMode
      ? `quote:${targetQuoteId}:v${targetQuoteVersion ?? 'latest'}:${initialMode}`
      : sourcePackageId
        ? `pkg:${sourcePackageId}`
        : `new:${prefillLead?.id || 'blank'}`;

    if (hydratedSessionKeyRef.current === sessionKey) {
      return;
    }

    if (targetQuoteId && !isNewQuoteMode) {
      const applyQuoteData = (q: Quotation, opts: { isRestore: boolean; isReadOnlyHist: boolean; viewingVer: number; highestVer: number; totalVers: number; restoredFrom?: number; authBase: Quotation }) => {
        if (cancelled) return;
        setLoadError(null);
        setActiveQuoteId(q.id);
        setQuoteNumber(q.quoteNumber);
        setQuoteVersion(opts.viewingVer);
        setLatestSavedVersion(opts.highestVer);
        setVersionCount(opts.totalVers);
        setRestoredFromVersion(opts.restoredFrom);
        setIsReadOnlyHistoricalMode(opts.isReadOnlyHist);
        setHasExplicitlySaved(true);
        setAutoSaveStatus(opts.isRestore ? 'IDLE' : 'SAVED');
        setAutoSaveError(null);
        setLastSavedTimestamp(opts.isRestore ? '' : 'Loaded');
        setLoadedQuoteStatus(q.status || 'DRAFT');
        setLoadedIsLocked(opts.isRestore ? false : Boolean(q.isLocked || opts.isReadOnlyHist));
        setTermsExceptionApproval(q.termsExceptionApproval);
        setAuthoritativeSavedQuote(opts.authBase);
        setOutputSyncError(null);

        if (opts.isRestore) {
          pendingBaselineCommitRef.current = false;
          setBaselineSavedHash('__UNSAVED_RESTORE__');
        } else {
          pendingBaselineCommitRef.current = true;
        }

        const isLoadedFinalised = Boolean(
          !opts.isRestore && (
            q.isLocked ||
            opts.isReadOnlyHist ||
            q.termsStatus === 'QUOTATION_FINALISED' ||
            (q.status as string) === 'ISSUED' ||
            q.status === 'SENT' ||
            q.status === 'APPROVED' ||
            q.status === 'ACCEPTED' ||
            q.status === 'CONVERTED'
          )
        );
        if (isLoadedFinalised && q.commercialTermsSnapshot && q.commercialTermsSnapshot.entries?.length > 0) {
          setLoadedFinalisedSnapshot(q.commercialTermsSnapshot);
        } else {
          setLoadedFinalisedSnapshot(null);
        }

        // Hydrate all fields from authoritative record or historical snapshot
        setClientName(q.clientName || '');
        setClientEmail(q.clientEmail || '');
        setClientPhone(q.clientPhone || '');
        setClientCompany(q.clientCompany || '');
        setAgentNotes(q.agentNotes || '');
        if (q.currency) setCurrency(q.currency);
        const rawLeadRef = q.leadId || q.linkedLeadId || '';
        if (rawLeadRef) {
          const matchedLead = db.getLeads().find(l => l.id === rawLeadRef || l.leadNumber === rawLeadRef);
          setSelectedLeadId(matchedLead ? matchedLead.id : rawLeadRef);
        } else {
          setSelectedLeadId('');
        }
        if (q.travelStartDate) setStartDate(q.travelStartDate);
        if (q.travelEndDate) setEndDate(q.travelEndDate);
        if (q.travelStartDate && q.travelEndDate) {
          setContextQuotationDates(q.travelStartDate, q.travelEndDate);
        }
        if (q.adultsCount) setAdultsCount(q.adultsCount);
        if (q.childrenCount !== undefined) setChildrenCount(q.childrenCount);
        if (q.infantsCount !== undefined) setInfantsCount(q.infantsCount);
        if (q.childAges) setChildAges(q.childAges);
        setAgentMarginType(q.agentMarginType || (q as any).agent_margin_type || 'PERCENTAGE');
        const safeMarginVal = Math.max(0, Number(q.agentMarginValue ?? (q as any).agent_margin_value ?? q.overallMarkupPercent ?? 0) || 0);
        setAgentMarginValue(safeMarginVal);
        setAgentMarkupPercent((q.agentMarginType || 'PERCENTAGE') === 'PERCENTAGE' ? safeMarginVal : 0);
        setAdminBasePriceUpdatedNotification(q.adminBasePriceUpdatedNotification);

        const savedAdminMarginType = q.adminManualMarginType || (q as any).admin_manual_margin_type || q.pricingSnapshot?.adminManualMarginType || (q as any).pricing_snapshot?.adminManualMarginType;
        setAdminManualMarginType(savedAdminMarginType === 'FIXED' ? 'FIXED' : 'PERCENTAGE');
        const savedAdminMarginValue = q.adminManualMarginValue ?? (q as any).admin_manual_margin_value ?? q.pricingSnapshot?.adminManualMarginValue ?? (q as any).pricing_snapshot?.adminManualMarginValue;
        setAdminManualMarginValue(Math.max(0, Number(savedAdminMarginValue ?? 0) || 0));
        const savedAdminMarginMode = q.adminMarginMode || (q as any).admin_margin_mode || q.pricingSnapshot?.adminMarginMode || (q as any).pricing_snapshot?.adminMarginMode;
        setAdminMarginMode(savedAdminMarginMode === 'REPLACE' ? 'REPLACE' : 'ADD');
        setOverallDiscountPercent(Math.max(0, Number(q.overallDiscountPercent || 0) || 0));

        setQuoteCompanyId((q as any).companyId || undefined);
        setQuoteAgentId(q.agentId || q.createdBy || undefined);
        setQuoteAgentAgency(q.agentAgency || undefined);
        setQuoteProductLevelMarginEnabled(
          q.productLevelMarginEnabled !== undefined
            ? Boolean(q.productLevelMarginEnabled)
            : (q.activeMarginMode ? q.activeMarginMode === 'PRODUCT_LEVEL' : undefined)
        );
        setQuoteAgentLevelMarginPercent(
          typeof q.agentLevelMarginPercent === 'number' ? q.agentLevelMarginPercent : undefined
        );

        const loadedScope: QuotationScope = (q.quotationScope as QuotationScope) || (q.scope as QuotationScope) || 'HOTEL_LAND';
        setQuotationScope(loadedScope);
        setContextQuotationScope(loadedScope === 'LAND_ONLY' ? 'LAND_ONLY' : 'HOTEL_LAND');
        setBrandingMode(q.brandingMode || q.brandingSnapshot?.mode || 'STANDARD');
        if (q.title) setQuoteTitle(q.title);
        if (q.sourcePackageId !== undefined) setSourcePackageId(q.sourcePackageId || null);
        if (q.sourcePackageName !== undefined) setSourcePackageName(q.sourcePackageName || '');
        if (q.dayDescriptions) {
          setDayDescriptions(q.dayDescriptions);
          setContextDayDescriptions(q.dayDescriptions);
        }
        if (q.dayOverviews) {
          setDayOverviews(q.dayOverviews);
          setContextDayOverviews(q.dayOverviews);
        }
        if (q.dayNotes) {
          setDayNotes(q.dayNotes);
          setContextDayNotes(q.dayNotes);
        }
        if (q.itineraryOverview || (q as any).narrative) {
          setItineraryOverview(q.itineraryOverview || (q as any).narrative || '');
          setContextItineraryOverview(q.itineraryOverview || (q as any).narrative || '');
        }
        if (q.inclusions) setContextInclusions(q.inclusions);
        if (q.exclusions) setContextExclusions(q.exclusions);
        if (q.importantInformation !== undefined) setContextImportantInformation(q.importantInformation || '');
        if (q.cancellationPolicy !== undefined) setContextCancellationPolicy(q.cancellationPolicy || '');

        const normalizeLoadedHubs = (hubsList: TripRouteHub[], scopeVal: QuotationScope): TripRouteHub[] => {
          return (hubsList || []).map(h => {
            if (scopeVal === 'LAND_ONLY') {
              const snapshot = (h.hotelId || h.manualHotel || h.isManualHotel)
                ? {
                    accommodationType: (h.isManualHotel || h.manualHotel ? 'manual' : 'hotel') as any,
                    hotelId: h.hotelId,
                    roomTypeId: h.roomTypeId,
                    roomsCount: h.roomsCount,
                    isManualHotel: h.isManualHotel,
                    manualHotel: h.manualHotel
                  }
                : h.savedAccommodationSnapshot;
              return {
                ...h,
                accommodationType: 'NO_ACCOMMODATION',
                overriddenByLandOnly: true,
                savedAccommodationSnapshot: snapshot,
                hotelId: undefined,
                roomTypeId: undefined,
                isManualHotel: false,
                manualHotel: undefined
              };
            }
            if (h.accommodationType === 'none' || h.accommodationType === 'NO_ACCOMMODATION') {
              return {
                ...h,
                accommodationType: 'NO_ACCOMMODATION',
                hotelId: undefined,
                roomTypeId: undefined,
                isManualHotel: false,
                manualHotel: undefined
              };
            }
            return h;
          });
        };

        if (q.items) {
          const cleanedLoadedItems = loadedScope === 'LAND_ONLY'
            ? q.items.filter(it => !(
                it.product.productType === 'Hotel' ||
                it.product.productType === 'Hotel & Resort' ||
                it.isManualHotel === true ||
                it.product.accommodationType === 'manual' ||
                (it.product as any).category === 'Hotels'
              ))
            : q.items;
          setItems(cleanedLoadedItems);
        }
        if (q.routeHubs) {
          const normalizedHubs = normalizeLoadedHubs(q.routeHubs, loadedScope);
          routeHubsRef.current = normalizedHubs;
          isInternalHubMutationRef.current = true;
          setRouteHubs(normalizedHubs);
          setContextRouteHubs(normalizedHubs);
        }
        if (q.options && q.options.length > 0) {
          setOptionsData(prev => {
            const next = { ...prev };
            q.options!.forEach((opt, idx) => {
              const optNum = opt.optionNumber || (idx + 1);
              const optScope = (opt.scope as QuotationScope) || (optNum === 1 ? loadedScope : (next[optNum]?.scope || loadedScope));
              const optRawItems = opt.items || [];
              const optCleanedItems = optScope === 'LAND_ONLY'
                ? optRawItems.filter(it => !(
                    it.product.productType === 'Hotel' ||
                    it.product.productType === 'Hotel & Resort' ||
                    it.isManualHotel === true ||
                    it.product.accommodationType === 'manual' ||
                    (it.product as any).category === 'Hotels'
                  ))
                : optRawItems;
              next[optNum] = {
                ...next[optNum],
                optionNumber: optNum,
                title: opt.title || next[optNum]?.title || `Option ${optNum}`,
                badge: opt.badge || next[optNum]?.badge || '',
                hotelTier: opt.hotelTier || next[optNum]?.hotelTier || '',
                scope: optScope,
                items: optCleanedItems,
                routeHubs: normalizeLoadedHubs(opt.routeHubs || [], optScope),
                dayThemes: q.dayThemes || {}
              };
            });
            return next;
          });
        }
        if (q.dayThemes) {
          setDayThemes(q.dayThemes);
          setContextDayThemes(q.dayThemes);
        }
        if (q.destination) {
          const qDestLower = q.destination.toLowerCase();
          const allKnownDestinations = db.getDestinations();
          const dMatch =
            activeB2BDestinations.find(d =>
              (d.name || '').toLowerCase() === qDestLower ||
              (d.id || '').toLowerCase() === qDestLower
            ) ||
            allKnownDestinations.find(d =>
              (d.name || '').toLowerCase() === qDestLower ||
              (d.id || '').toLowerCase() === qDestLower
            );
          if (dMatch) setCurrentDestination(dMatch);
        }
      };

      const hydrateQuote = async (initialQ: Quotation) => {
        if (cancelled) return;
        let q = initialQ;
        const needsDehydratedRecovery =
          !q.items ||
          q.items.length === 0 ||
          q.items.some((it: any) => Boolean(it?.__dehydratedToVersionId)) ||
          (q.options || []).some((o: any) => Boolean((o as any)?.__dehydratedToVersionId));
        if ((q.masterHydratedFromVersionId || q.latestVersionId) && needsDehydratedRecovery) {
          const targetHydrateVer = q.masterHydratedFromVersionId || q.latestVersionId || Number(q.latestVersion || q.version || 1);
          const hydratedMaster = await db.hydrateMasterQuotationFromVersionAsync(q.id, targetHydrateVer, user).catch(() => null);
          if (cancelled) return;
          if (hydratedMaster) q = hydratedMaster;
        }

        const versions = db.getQuotationVersions(q.id, user);
        const highestVer = Math.max(versions[0]?.version || 0, q.latestVersion || 0, q.version || 1);
        const desiredVer = targetQuoteVersion || highestVer;

        // Reconstruct split sections on demand if target version isn't yet hydrated in memory
        const desiredManifest = versions.find(v => v.version === desiredVer);
        if (desiredManifest && desiredManifest.storageFormat === 'SPLIT_SECTIONS_V2' && !desiredManifest.hasHydratedSections) {
          await db.loadQuotationVersionFullAsync(q.id, desiredVer, user).catch(() => null);
          if (cancelled) return;
        }
        const hydratedVersions = db.getQuotationVersions(q.id, user);

        if (initialMode === 'restore') {
          const restoredDraft = await db.prepareRestoredWorkingQuoteAsync(q.id, desiredVer, user);
          if (cancelled) return;
          hydratedSessionKeyRef.current = sessionKey;
          if (restoredDraft) {
            applyQuoteData(restoredDraft, {
              isRestore: true,
              isReadOnlyHist: false,
              viewingVer: highestVer,
              highestVer,
              totalVers: hydratedVersions.length || 1,
              restoredFrom: restoredDraft.restoredFromVersion || desiredVer,
              authBase: q
            });
            showBuilderToast(`Loaded v${desiredVer} into working draft (Unsaved — click Save Draft to create v${highestVer + 1})`, 'INFO');
          } else {
            applyQuoteData(q, {
              isRestore: true,
              isReadOnlyHist: false,
              viewingVer: highestVer,
              highestVer,
              totalVers: hydratedVersions.length || 1,
              restoredFrom: desiredVer,
              authBase: q
            });
          }
          return;
        }

        const isHistVer = Boolean(targetQuoteVersion && targetQuoteVersion < highestVer);
        const isReadOnlyHist = initialMode === 'readonly' || isHistVer;
        if (targetQuoteVersion && hydratedVersions.some(v => v.version === targetQuoteVersion)) {
          const vSnap = hydratedVersions.find(v => v.version === targetQuoteVersion)!;
          const snapshotQuote: Quotation = {
            ...q,
            version: vSnap.version,
            title: vSnap.title || q.title,
            destination: vSnap.destination || q.destination,
            clientName: vSnap.clientName || q.clientName,
            clientEmail: vSnap.clientEmail ?? q.clientEmail,
            clientPhone: vSnap.clientPhone ?? q.clientPhone,
            clientCompany: vSnap.clientCompany ?? q.clientCompany,
            nationality: vSnap.nationality ?? q.nationality,
            travelStyle: vSnap.travelStyle ?? q.travelStyle,
            mealPlanPreference: vSnap.mealPlanPreference ?? q.mealPlanPreference,
            travelStartDate: vSnap.travelStartDate || q.travelStartDate,
            travelEndDate: vSnap.travelEndDate || q.travelEndDate,
            totalPax: vSnap.totalPax ?? q.totalPax,
            adultsCount: vSnap.adultsCount ?? q.adultsCount,
            childrenCount: vSnap.childrenCount ?? q.childrenCount,
            infantsCount: vSnap.infantsCount ?? q.infantsCount,
            childAges: vSnap.childAges ?? q.childAges,
            currency: vSnap.currency || q.currency,
            items: (vSnap.items && vSnap.items.length > 0 ? vSnap.items : q.items),
            routeHubs: (vSnap.routeHubs && vSnap.routeHubs.length > 0 ? vSnap.routeHubs : q.routeHubs),
            dayThemes: vSnap.dayThemes ?? q.dayThemes,
            dayDescriptions: vSnap.dayDescriptions ?? q.dayDescriptions,
            dayOverviews: vSnap.dayOverviews ?? q.dayOverviews,
            dayNotes: vSnap.dayNotes ?? q.dayNotes,
            itineraryOverview: vSnap.itineraryOverview ?? q.itineraryOverview,
            inclusions: vSnap.inclusions ?? q.inclusions,
            exclusions: vSnap.exclusions ?? q.exclusions,
            importantInformation: vSnap.importantInformation ?? q.importantInformation,
            cancellationPolicy: vSnap.cancellationPolicy ?? q.cancellationPolicy,
            options: vSnap.options ?? q.options,
            activeOptionId: vSnap.activeOptionId ?? q.activeOptionId,
            quotationScope: vSnap.quotationScope ?? q.quotationScope,
            brandingMode: vSnap.brandingMode ?? q.brandingMode,
            brandingSnapshot: vSnap.brandingSnapshot ?? q.brandingSnapshot,
            commercialTermsSnapshot: vSnap.commercialTermsSnapshot ?? q.commercialTermsSnapshot,
            termsAndConditions: vSnap.termsAndConditions ?? q.termsAndConditions,
            authoritativeSnapshot: vSnap.authoritativeSnapshot ?? q.authoritativeSnapshot,
            pricingSnapshot: vSnap.pricingSnapshot ?? q.pricingSnapshot,
            theUnboundBaseSellingPrice: vSnap.theUnboundBaseSellingPrice ?? q.theUnboundBaseSellingPrice,
            adminManualMarginType: vSnap.adminManualMarginType ?? vSnap.pricingSnapshot?.adminManualMarginType ?? q.adminManualMarginType,
            adminManualMarginValue: vSnap.adminManualMarginValue ?? vSnap.pricingSnapshot?.adminManualMarginValue ?? q.adminManualMarginValue,
            adminManualMarginAmount: vSnap.adminManualMarginAmount ?? vSnap.pricingSnapshot?.adminManualMarginAmount ?? q.adminManualMarginAmount,
            adminMarginMode: vSnap.adminMarginMode ?? vSnap.pricingSnapshot?.adminMarginMode ?? q.adminMarginMode,
            revisedSellingPrice: vSnap.revisedSellingPrice ?? vSnap.pricingSnapshot?.revisedSellingPrice ?? q.revisedSellingPrice,
            productLevelMarginEnabled: vSnap.productLevelMarginEnabled ?? q.productLevelMarginEnabled,
            agentLevelMarginPercent: vSnap.agentLevelMarginPercent ?? q.agentLevelMarginPercent,
            activeMarginMode: vSnap.activeMarginMode ?? q.activeMarginMode,
            companyId: (vSnap as any).companyId ?? (q as any).companyId,
            agentAgency: (vSnap as any).agentAgency ?? q.agentAgency,
            agentId: vSnap.agentId ?? q.agentId,
            agentMarginType: vSnap.agentMarginType ?? q.agentMarginType,
            agentMarginValue: vSnap.agentMarginValue ?? q.agentMarginValue,
            agentMarginAmount: vSnap.agentMarginAmount ?? q.agentMarginAmount,
            overallDiscountPercent: vSnap.overallDiscountPercent ?? q.overallDiscountPercent,
            totalSellingPrice: vSnap.totalSellingPrice ?? vSnap.finalCustomerSellingPrice ?? q.totalSellingPrice,
            finalCustomerSellingPrice:
              vSnap.finalCustomerSellingPrice ??
              vSnap.totalSellingPrice ??
              vSnap.authoritativeSnapshot?.pricing?.finalCustomerSellingPrice ??
              q.finalCustomerSellingPrice ??
              q.totalSellingPrice
          };
          hydratedSessionKeyRef.current = sessionKey;
          applyQuoteData(snapshotQuote, {
            isRestore: false,
            isReadOnlyHist,
            viewingVer: vSnap.version,
            highestVer,
            totalVers: hydratedVersions.length || 1,
            authBase: snapshotQuote
          });
        } else {
          hydratedSessionKeyRef.current = sessionKey;
          applyQuoteData(q, {
            isRestore: false,
            isReadOnlyHist,
            viewingVer: highestVer,
            highestVer,
            totalVers: hydratedVersions.length || 1,
            authBase: q
          });
        }

        // Sync Firestore versions metadata quietly in background without touching active working draft fields
        db.fetchQuotationVersionsFromFirestoreAsync(q.id, user)
          .then(remoteVers => {
            if (cancelled || !remoteVers || remoteVers.length === 0) return;
            const remoteHighest = remoteVers[0]?.version || highestVer;
            setLatestSavedVersion(remoteHighest);
            setVersionCount(remoteVers.length);
          })
          .catch(() => undefined);
      };

      const localQuote = db.getQuoteByIdAuthorized(targetQuoteId, user);
      if (localQuote) {
        void hydrateQuote(localQuote);
      } else {
        db.fetchQuotationByIdFromFirestore(targetQuoteId, user)
          .then(remoteQuote => {
            if (cancelled) return;
            if (!remoteQuote) {
              setLoadError(`Quotation record #${targetQuoteId} could not be found or you do not have permission to view it.`);
              return;
            }
            void hydrateQuote(remoteQuote);
          })
          .catch(() => {
            if (!cancelled) {
              setLoadError(`Quotation record #${targetQuoteId} could not be found or you do not have permission to view it.`);
            }
          });
      }
      return () => {
        cancelled = true;
      };
    } else if (!targetQuoteId && (quoteSource === 'PACKAGE' || sourcePackageId)) {
      hydratedSessionKeyRef.current = sessionKey;
      // Package Customization Mode: initialize fresh quote identity while preserving all loaded package state
      setActiveQuoteId(`QTE-${Date.now().toString(36).toUpperCase()}`);
      setQuoteNumber(`QTE-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
      setQuoteVersion(1);
      setHasExplicitlySaved(false);
      setLoadError(null);
      setAutoSaveStatus('IDLE');
      setAutoSaveError(null);
      setLoadedQuoteStatus('DRAFT');
      setLoadedIsLocked(false);
      setLoadedFinalisedSnapshot(null);
      setTermsExceptionApproval(undefined);
      setHasDraftTermsUpdateAvailable(false);
      setActiveStepId(1);
      setActiveViewTab('BUILDER');
      setActiveOptionTab(1);
      setBrandingMode('STANDARD');
      setAgentMarginType('PERCENTAGE');
      setAgentMarginValue(0);
      setAgentMarkupPercent(0);
      setOverallDiscountPercent(0);
      setAdminManualMarginType('PERCENTAGE');
      setAdminManualMarginValue(0);
      setAdminMarginMode('ADD');
      setQuoteCompanyId(undefined);
      setQuoteAgentId(undefined);
      setQuoteAgentAgency(undefined);
      setQuoteProductLevelMarginEnabled(undefined);
      setQuoteAgentLevelMarginPercent(undefined);
      if (!quoteTitle && sourcePackageName) {
        setQuoteTitle(sourcePackageName);
      }
      if (contextStartDate) {
        setStartDate(contextStartDate);
      }
      if (contextEndDate) {
        setEndDate(contextEndDate);
      }
      if (contextPaxConfig) {
        setAdultsCount(contextPaxConfig.adults ?? 2);
        setChildrenCount(contextPaxConfig.children ?? 0);
        setInfantsCount(contextPaxConfig.infants ?? 0);
        if (contextPaxConfig.childAges) {
          setChildAges(contextPaxConfig.childAges);
        }
      }
      if (contextQuotationScope) {
        setQuotationScope(contextQuotationScope);
      }
      if (contextRouteHubs && contextRouteHubs.length > 0) {
        routeHubsRef.current = contextRouteHubs;
        setRouteHubs(contextRouteHubs);
      }
      if (contextDayThemes) {
        setDayThemes(contextDayThemes);
      }
      if (contextDayDescriptions) {
        setDayDescriptions(contextDayDescriptions);
      }
      if (contextDayOverviews) {
        setDayOverviews(contextDayOverviews);
      }
      if (contextDayNotes) {
        setDayNotes(contextDayNotes);
      }
      if (contextItineraryOverview) {
        setItineraryOverview(contextItineraryOverview);
      }
      setOptionsData(prev => ({
        ...prev,
        1: {
          ...prev[1],
          title: sourcePackageName ? `Option 1: ${sourcePackageName}` : prev[1].title,
          scope: contextQuotationScope || 'HOTEL_LAND',
          items: items || [],
          routeHubs: contextRouteHubs || [],
          dayThemes: contextDayThemes || {}
        }
      }));
    } else if (isNewQuoteMode) {
      hydratedSessionKeyRef.current = sessionKey;
      // In new quote mode, start clean in-memory workspace without creating records
      setActiveQuoteId(`QTE-${Date.now().toString(36).toUpperCase()}`);
      setQuoteNumber(`QTE-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
      setQuoteVersion(1);
      setLatestSavedVersion(1);
      setVersionCount(0);
      setRestoredFromVersion(undefined);
      setIsReadOnlyHistoricalMode(false);
      setHasExplicitlySaved(false);
      setBaselineSavedHash('');
      pendingBaselineCommitRef.current = true;
      setLoadError(null);
      setAutoSaveStatus('IDLE');
      setBrandingMode('STANDARD');
      setAgentMarginType('PERCENTAGE');
      setAgentMarginValue(0);
      setAgentMarkupPercent(0);
      setOverallDiscountPercent(0);
      setAdminManualMarginType('PERCENTAGE');
      setAdminManualMarginValue(0);
      setAdminMarginMode('ADD');
      setQuoteCompanyId(undefined);
      setQuoteAgentId(undefined);
      setQuoteAgentAgency(undefined);
      setQuoteProductLevelMarginEnabled(undefined);
      setQuoteAgentLevelMarginPercent(undefined);

      if (prefillLead) {
        setClientName(prefillLead.contactName || prefillLead.clientName || '');
        setClientEmail(prefillLead.email || '');
        setClientPhone(prefillLead.phone || '');
        setClientCompany(prefillLead.agencyName || '');
        setSelectedLeadId(prefillLead.id || prefillLead.leadNumber || '');
        if (prefillLead.paxAdults || prefillLead.passengersCount) {
          setAdultsCount(prefillLead.paxAdults || prefillLead.passengersCount || 2);
        }
        if (prefillLead.paxChildren !== undefined) {
          setChildrenCount(prefillLead.paxChildren);
        }
        if (prefillLead.destinationName) {
          const pLeadDestLower = prefillLead.destinationName.toLowerCase();
          const dMatch = activeB2BDestinations.find(d => 
            (d.name || '').toLowerCase() === pLeadDestLower || 
            (d.id || '').toLowerCase() === (prefillLead.destinationId || '').toLowerCase()
          );
          if (dMatch) setCurrentDestination(dMatch);
        }
        if (prefillLead.travelStartDate) setStartDate(prefillLead.travelStartDate);
        if (prefillLead.travelEndDate) setEndDate(prefillLead.travelEndDate);
        if (prefillLead.travelStartDate && prefillLead.travelEndDate) {
          setContextQuotationDates(prefillLead.travelStartDate, prefillLead.travelEndDate);
        }
      } else {
        setContextQuotationDates(startDate, endDate);
        setSelectedLeadId('');
      }
    }
  }, [targetQuoteId, isNewQuoteMode, prefillLead, sourcePackageId, quoteSource]);

  // Automatically execute live pricing calculation as soon as a Ready-Made Package is loaded
  useEffect(() => {
    const isPackageSession = Boolean(sourcePackageId || quoteSource === 'PACKAGE');
    if (!isPackageSession) {
      return;
    }
    if (!items || items.length === 0) {
      return;
    }

    const sessionKey = `${sourcePackageId || 'pkg'}_items_${items.length}_pax_${adultsCount}_${childrenCount}_${infantsCount}_curr_${currency}_start_${startDate}_tgt_${targetQuoteId || 'new'}`;

    if (lastCalculatedPackageSessionRef.current === sessionKey) {
      return;
    }

    setPackagePricingStatus('CALCULATING');
    setPackagePricingError(null);
    const requestId = ++activePricingRequestIdRef.current;

    try {
      const { updatedItems, failedItems } = recalculateItemsWithLatestTariffs(
        items,
        adultsCount,
        childrenCount,
        infantsCount,
        currency,
        0
      );

      if (activePricingRequestIdRef.current !== requestId) {
        return;
      }

      if (failedItems.length > 0 && failedItems.length === items.length) {
        setPackagePricingStatus('ERROR');
        setPackagePricingError({
          message: 'Unable to calculate live wholesale tariffs for package components.',
          failedItems: failedItems.map(f => f.name)
        });
        return;
      }

      setItems(updatedItems);
      setOptionsData(prev => ({
        ...prev,
        1: {
          ...prev[1],
          items: updatedItems
        }
      }));
      lastCalculatedPackageSessionRef.current = sessionKey;
      setPackagePricingStatus('SUCCESS');

      if (failedItems.length > 0) {
        setPackagePricingError({
          message: `${failedItems.length} component(s) could not be live-priced and used baseline catalog rate.`,
          failedItems: failedItems.map(f => f.name)
        });
      }
    } catch (err: any) {
      if (activePricingRequestIdRef.current === requestId) {
        setPackagePricingStatus('ERROR');
        setPackagePricingError({
          message: err?.message || 'Error executing live pricing calculation.',
          failedItems: []
        });
      }
    }
  }, [
    sourcePackageId, 
    quoteSource, 
    items, 
    adultsCount, 
    childrenCount, 
    infantsCount, 
    currency, 
    startDate, 
    targetQuoteId, 
    recalculateItemsWithLatestTariffs, 
    setItems
  ]);

  const handleRetryPackagePricing = useCallback(() => {
    lastCalculatedPackageSessionRef.current = '';
    setPackagePricingStatus('CALCULATING');
    setPackagePricingError(null);
    const requestId = ++activePricingRequestIdRef.current;

    setTimeout(() => {
      try {
        const { updatedItems, failedItems } = recalculateItemsWithLatestTariffs(
          items,
          adultsCount,
          childrenCount,
          infantsCount,
          currency,
          0
        );
        if (activePricingRequestIdRef.current !== requestId) return;
        if (failedItems.length > 0 && failedItems.length === items.length) {
          setPackagePricingStatus('ERROR');
          setPackagePricingError({
            message: 'Unable to calculate live wholesale tariffs for package components.',
            failedItems: failedItems.map(f => f.name)
          });
          return;
        }
        setItems(updatedItems);
        setOptionsData(prev => ({
          ...prev,
          1: {
            ...prev[1],
            items: updatedItems
          }
        }));
        lastCalculatedPackageSessionRef.current = `${sourcePackageId || 'pkg'}_items_${items.length}_pax_${adultsCount}_${childrenCount}_${infantsCount}_curr_${currency}_start_${startDate}_tgt_${targetQuoteId || 'new'}`;
        setPackagePricingStatus('SUCCESS');
        showBuilderToast('Live pricing recalculated successfully', 'SUCCESS');
      } catch (err: any) {
        if (activePricingRequestIdRef.current === requestId) {
          setPackagePricingStatus('ERROR');
          setPackagePricingError({
            message: err?.message || 'Error recalculating tariffs.',
            failedItems: []
          });
        }
      }
    }, 40);
  }, [
    items, 
    adultsCount, 
    childrenCount, 
    infantsCount, 
    currency, 
    startDate, 
    sourcePackageId, 
    targetQuoteId, 
    recalculateItemsWithLatestTariffs, 
    setItems,
    showBuilderToast
  ]);

  // City Hubs for Destination (strictly destination-aware via DestinationRelevanceService)
  const destinationHubs = useMemo(() => {
    return DestinationRelevanceService.getInstance().getRelevantHubs(currentDestination.id);
  }, [currentDestination]);

  // Expanded structural equality helper to eliminate ping-pong re-render loops across routeHubs <-> context
  const areRouteHubsEqual = (a?: TripRouteHub[], b?: TripRouteHub[]): boolean => {
    if (a === b) return true;
    if (!a || !b) return !a && !b;
    if (a.length !== b.length) return false;
    return a.every((hub, idx) => {
      const other = b[idx];
      return Boolean(
        other &&
        hub.id === other.id &&
        (hub.itineraryHubOccurrenceId || hub.id) === (other.itineraryHubOccurrenceId || other.id) &&
        (hub.accommodationStayId || '') === (other.accommodationStayId || '') &&
        hub.hubId === other.hubId &&
        (hub.hubName || '') === (other.hubName || '') &&
        Number(hub.nights || 0) === Number(other.nights || 0) &&
        hub.accommodationType === other.accommodationType &&
        (hub.hotelId || '') === (other.hotelId || '') &&
        (hub.roomTypeId || '') === (other.roomTypeId || '') &&
        Number(hub.roomsCount || 0) === Number(other.roomsCount || 0) &&
        Boolean(hub.isManualHotel) === Boolean(other.isManualHotel) &&
        (hub.manualHotel?.hotelName || '') === (other.manualHotel?.hotelName || '') &&
        Number(hub.manualHotel?.ratePerNight || 0) === Number(other.manualHotel?.ratePerNight || 0) &&
        (hub.notes || '') === (other.notes || '') &&
        (hub.checkInDate || '') === (other.checkInDate || '') &&
        (hub.checkOutDate || '') === (other.checkOutDate || '') &&
        hub.order === other.order
      );
    });
  };

  // Route Hubs Sequence (dynamic - starts empty unless provided by context or AI Planner)
  const [routeHubs, setRouteHubs] = useState<TripRouteHub[]>(() => {
    if (contextRouteHubs && contextRouteHubs.length > 0) {
      return contextRouteHubs;
    }
    return [];
  });
  const routeHubsRef = useRef<TripRouteHub[]>(routeHubs);
  routeHubsRef.current = routeHubs;

  // Single-direction sync ONLY when external context changes outside local handleUpdateRouteHubs
  useEffect(() => {
    if (isInternalHubMutationRef.current) {
      isInternalHubMutationRef.current = false;
      return;
    }
    if (contextRouteHubs && contextRouteHubs.length > 0 && !areRouteHubsEqual(contextRouteHubs, routeHubsRef.current)) {
      routeHubsRef.current = contextRouteHubs;
      setRouteHubs(contextRouteHubs);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextRouteHubs]);

  // Keep hub hotel assignments synchronized when hotel items are removed from cart
  const prevCartItemsRef = useRef<QuoteItem[]>(items);
  useEffect(() => {
    const prevItems = prevCartItemsRef.current;
    prevCartItemsRef.current = items;
    if (prevItems.length <= items.length) return;

    const currentIds = new Set(items.map(i => i.id));
    const removedItems = prevItems.filter(i => !currentIds.has(i.id));
    if (removedItems.length === 0) return;

    const isHotelItemCheck = (it: QuoteItem): boolean =>
      it.product?.productType === 'Hotel' ||
      it.product?.productType === 'Hotel & Resort' ||
      it.isManualHotel === true ||
      it.product?.accommodationType === 'manual' ||
      (it.product as any)?.category === 'Hotels';

    const removedHotels = removedItems.filter(isHotelItemCheck);
    if (removedHotels.length > 0) {
      const remainingHotels = items.filter(isHotelItemCheck);
      handleUpdateRouteHubs(prevHubs => {
        if (prevHubs.length === 0) return prevHubs;
        let changed = false;
        const nextHubs = prevHubs.map(h => {
          const wasRemovedForHub = removedHotels.some(rem =>
            doesHotelItemBelongToHubOccurrence(rem, h, prevHubs)
          );
          if (!wasRemovedForHub) return h;

          const stillHasHotelForHub = remainingHotels.some(rem =>
            doesHotelItemBelongToHubOccurrence(rem, h, prevHubs)
          );
          if (stillHasHotelForHub) return h;

          changed = true;
          return {
            ...h,
            hotelId: undefined,
            roomTypeId: undefined,
            roomsCount: undefined,
            accommodationStayId: undefined,
            roomConfiguration: undefined,
            isManualHotel: false,
            manualHotel: undefined,
            accommodationType: 'NO_ACCOMMODATION' as const
          };
        });
        return changed ? nextHubs : prevHubs;
      });
    }
  }, [items, activeOptionTab]);

  // Unified atomic route hub updater — updates local routeHubs, contextRouteHubs, and active option in one pass without render cascades or nested context setState calls
  const handleUpdateRouteHubs: React.Dispatch<React.SetStateAction<TripRouteHub[]>> = useCallback((updaterOrValue) => {
    const prev = routeHubsRef.current;
    const next = typeof updaterOrValue === 'function'
      ? (updaterOrValue as (p: TripRouteHub[]) => TripRouteHub[])(prev)
      : updaterOrValue;
    if (areRouteHubsEqual(prev, next)) return;
    routeHubsRef.current = next;
    isInternalHubMutationRef.current = true;
    setRouteHubs(next);
    setContextRouteHubs(next);
    setOptionsData(prevOpts => {
      if (areRouteHubsEqual(prevOpts[activeOptionTab]?.routeHubs, next)) return prevOpts;
      return {
        ...prevOpts,
        [activeOptionTab]: {
          ...prevOpts[activeOptionTab],
          routeHubs: next
        }
      };
    });
  }, [activeOptionTab, setContextRouteHubs]);

  // Predictable state transition when switching Land-Only Mode ON or OFF
  const handleChangeQuotationScope = (nextScope: QuotationScope) => {
    setQuotationScope(nextScope);
    if (nextScope === 'LAND_ONLY') {
      // Remove all active hotel charges from current quote items while preserving non-accommodation items
      const hotelItemsToRemove = items.filter(it =>
        it.product.productType === 'Hotel' ||
        it.product.productType === 'Hotel & Resort' ||
        it.isManualHotel === true ||
        it.product.accommodationType === 'manual' ||
        (it.product as any).category === 'Hotels'
      );
      hotelItemsToRemove.forEach(it => removeProductFromQuote(it.id));

      // Preserve existing hotel / manual hotel configuration in savedAccommodationSnapshot and set every hub to NO_ACCOMMODATION
      const updated = routeHubs.map(h => {
        const hasConfiguredHotel = Boolean(
          (h.hotelId || h.manualHotel || h.isManualHotel) &&
          h.accommodationType !== 'none' &&
          h.accommodationType !== 'NO_ACCOMMODATION'
        );
        const snapshot = hasConfiguredHotel
          ? {
              accommodationType: (h.isManualHotel || h.manualHotel ? 'manual' : 'hotel') as any,
              hotelId: h.hotelId,
              roomTypeId: h.roomTypeId,
              roomsCount: h.roomsCount,
              isManualHotel: h.isManualHotel,
              manualHotel: h.manualHotel
            }
          : h.savedAccommodationSnapshot;
        return {
          ...h,
          accommodationType: 'NO_ACCOMMODATION' as const,
          overriddenByLandOnly: true,
          savedAccommodationSnapshot: snapshot,
          hotelId: undefined,
          roomTypeId: undefined,
          isManualHotel: false,
          manualHotel: undefined
        };
      });
      routeHubsRef.current = updated;
      setRouteHubs(updated);
      isInternalHubMutationRef.current = true;
      setContextRouteHubs(updated);
      setOptionsData(prevOpts => ({
        ...prevOpts,
        [activeOptionTab]: {
          ...prevOpts[activeOptionTab],
          scope: 'LAND_ONLY',
          routeHubs: updated,
          items: items.filter(it => !hotelItemsToRemove.some(rem => rem.id === it.id))
        }
      }));
    } else {
      // Switching Land-Only Mode OFF:
      // Keep NO_ACCOMMODATION selected initially for sections that were overridden by Land-Only Mode,
      // and retain savedAccommodationSnapshot so the user can restore with confirmation or choose any of the 3 options.
      const updated = routeHubs.map(h => {
        if (h.overriddenByLandOnly || h.accommodationType === 'NO_ACCOMMODATION' || h.accommodationType === 'none') {
          return {
            ...h,
            accommodationType: 'NO_ACCOMMODATION' as const,
            hotelId: undefined,
            roomTypeId: undefined,
            isManualHotel: false,
            manualHotel: undefined
          };
        }
        return h;
      });
      routeHubsRef.current = updated;
      setRouteHubs(updated);
      isInternalHubMutationRef.current = true;
      setContextRouteHubs(updated);
      setOptionsData(prevOpts => ({
        ...prevOpts,
        [activeOptionTab]: {
          ...prevOpts[activeOptionTab],
          scope: nextScope,
          routeHubs: updated
        }
      }));
    }
  };

  // Route Validation
  const routeTotalNights = useMemo(() => {
    return routeHubs.reduce((acc, h) => acc + (h.nights || 0), 0);
  }, [routeHubs]);

  // Hotels list for destination (strictly destination-aware via DestinationRelevanceService)
  const availableHotels = useMemo(() => {
    return DestinationRelevanceService.getInstance().getRelevantHotels(currentDestination.id);
  }, [currentDestination]);

  // Products list for destination (strictly destination-aware via DestinationRelevanceService)
  const availableProducts = useMemo(() => {
    return DestinationRelevanceService.getInstance().getRelevantProducts(currentDestination.id).allDestinationProducts;
  }, [currentDestination]);

  // Destination Change Safety and Sanitization State
  const [pendingDestination, setPendingDestination] = useState<Destination | null>(null);
  const [showDestinationChangeModal, setShowDestinationChangeModal] = useState<boolean>(false);

  const handleDestinationChange = (newDest: Destination) => {
    if (!inventoryVisibilityService.isDestinationActiveForB2B(newDest)) {
      showBuilderToast(`Destination "${newDest.name}" is not Active and is excluded from B2B sales.`, 'WARNING');
      return;
    }
    if (newDest.id === currentDestination.id) return;

    // Check if there are existing items or route hubs incompatible with new destination
    const incompatibleItems = items.filter(it => {
      if (it.product.subcategory === 'Travel Insurance' || it.product.subcategory === 'eSIM Connectivity') return false;
      return !matchesDestination(newDest.id, it.product.destinationId, it.product.country);
    });

    const incompatibleHubs = routeHubs.filter(h => {
      return !matchesDestination(newDest.id, h.destinationId);
    });

    const relService = DestinationRelevanceService.getInstance();
    const compatibility = relService.validateEntireQuoteForDestination(newDest.id, {
      routeHubs,
      items
    });

    if (!compatibility.isCompatible) {
      setPendingDestination(newDest);
      setShowDestinationChangeModal(true);
    } else {
      // Clean switch
      setCurrentDestination(newDest);
      setBuilderToast({
        message: `Active destination set to ${newDest.name}.`,
        type: 'SUCCESS'
      });
    }
  };

  const confirmDestinationChange = () => {
    if (!pendingDestination) return;

    const relService = DestinationRelevanceService.getInstance();
    const sanitized = relService.sanitizeQuoteForDestination(pendingDestination.id, items, routeHubs);

    // Apply sanitized items and route hubs
    setItems(sanitized.cleanedItems);
    handleUpdateRouteHubs(sanitized.cleanedRouteHubs);

    // Switch destination
    setCurrentDestination(pendingDestination);
    setPendingDestination(null);
    setShowDestinationChangeModal(false);

    if (sanitized.removedCount > 0) {
      setBuilderToast({
        message: `Switched to ${pendingDestination.name}. Removed ${sanitized.removedCount} non-matching items from previous destination.`,
        type: 'WARNING'
      });
    } else {
      setBuilderToast({
        message: `Switched active destination to ${pendingDestination.name}.`,
        type: 'SUCCESS'
      });
    }
  };

  // Day Theme, Descriptions, Overviews and Notes customization
  const [dayThemes, setDayThemes] = useState<Record<number, string>>(() => contextDayThemes || {});
  const [dayDescriptions, setDayDescriptions] = useState<Record<number, string>>(() => contextDayDescriptions || {});
  const [dayOverviews, setDayOverviews] = useState<Record<number, string>>(() => contextDayOverviews || {});
  const [dayNotes, setDayNotes] = useState<Record<number, string>>(() => contextDayNotes || {});
  const [itineraryOverview, setItineraryOverview] = useState<string>(() => contextItineraryOverview || '');

  const dayThemesRef = useRef(dayThemes);
  dayThemesRef.current = dayThemes;
  const dayDescriptionsRef = useRef(dayDescriptions);
  dayDescriptionsRef.current = dayDescriptions;

  useEffect(() => {
    if (contextDayThemes && Object.keys(contextDayThemes).length > 0) {
      setDayThemes(prev => (shallowRecordEqual(prev, contextDayThemes) ? prev : contextDayThemes));
    }
  }, [contextDayThemes]);

  useEffect(() => {
    if (contextDayDescriptions && Object.keys(contextDayDescriptions).length > 0) {
      setDayDescriptions(prev => (shallowRecordEqual(prev, contextDayDescriptions) ? prev : contextDayDescriptions));
    }
  }, [contextDayDescriptions]);

  useEffect(() => {
    if (contextDayOverviews && Object.keys(contextDayOverviews).length > 0) {
      setDayOverviews(prev => (shallowRecordEqual(prev, contextDayOverviews) ? prev : contextDayOverviews));
    }
  }, [contextDayOverviews]);

  useEffect(() => {
    if (contextDayNotes && Object.keys(contextDayNotes).length > 0) {
      setDayNotes(prev => (shallowRecordEqual(prev, contextDayNotes) ? prev : contextDayNotes));
    }
  }, [contextDayNotes]);

  useEffect(() => {
    if (contextItineraryOverview) {
      setItineraryOverview(prev => (prev === contextItineraryOverview ? prev : contextItineraryOverview));
    }
  }, [contextItineraryOverview]);

  const handleUpdateDayThemes: React.Dispatch<React.SetStateAction<Record<number, string>>> = useCallback((updaterOrValue) => {
    const next = typeof updaterOrValue === 'function' ? updaterOrValue(dayThemesRef.current) : updaterOrValue;
    dayThemesRef.current = next;
    setDayThemes(next);
    setContextDayThemes(next);
  }, [setContextDayThemes]);

  const handleUpdateDayDescriptions: React.Dispatch<React.SetStateAction<Record<number, string>>> = useCallback((updaterOrValue) => {
    const next = typeof updaterOrValue === 'function' ? updaterOrValue(dayDescriptionsRef.current) : updaterOrValue;
    dayDescriptionsRef.current = next;
    setDayDescriptions(next);
    setDayOverviews(next);
    setContextDayDescriptions(next);
    setContextDayOverviews(next);
  }, [setContextDayDescriptions, setContextDayOverviews]);

  const handleUpdateItineraryOverview = useCallback((overview: string) => {
    setItineraryOverview(overview);
    setContextItineraryOverview(overview);
  }, [setContextItineraryOverview]);
  const [selectedHubFilter, setSelectedHubFilter] = useState<string>('ALL');

  // Visa Section & Picker Modal State
  const [isVisaSectionExpanded, setIsVisaSectionExpanded] = useState<boolean>(true);
  const [selectedVisaForQuoteModal, setSelectedVisaForQuoteModal] = useState<VisaProduct | null>(null);
  const [showVisaPickerModal, setShowVisaPickerModal] = useState<boolean>(false);
  const [visaPickerSearch, setVisaPickerSearch] = useState<string>('');
  const [visaPickerCategory, setVisaPickerCategory] = useState<string>('ALL');

  // Quick Add Modal State
  const [quickAddModalDay, setQuickAddModalDay] = useState<{ 
    dayNum: number; 
    dateString: string; 
    hubName: string; 
    hubId?: string;
  } | null>(null);
  const [quickAddSearch, setQuickAddSearch] = useState('');
  const [debouncedQuickAddSearch, setDebouncedQuickAddSearch] = useState('');
  const [quickAddVisibleLimit, setQuickAddVisibleLimit] = useState<number>(30);
  const [quickAddCategory, setQuickAddCategory] = useState('ALL');
  const [filterByDayCityOnly, setFilterByDayCityOnly] = useState<boolean>(true);
  const [inspectingProduct, setInspectingProduct] = useState<Product | null>(null);
  const [calculatorProduct, setCalculatorProduct] = useState<Product | null>(null);
  const [editingRailItem, setEditingRailItem] = useState<QuoteItem | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuickAddSearch(quickAddSearch);
      setQuickAddVisibleLimit(30);
    }, 150);
    return () => clearTimeout(timer);
  }, [quickAddSearch]);

  useEffect(() => {
    setQuickAddVisibleLimit(30);
  }, [quickAddModalDay, quickAddCategory, filterByDayCityOnly]);

  // Save as Package Modal State
  const [isSavePackageModalOpen, setIsSavePackageModalOpen] = useState(false);
  const [packageFormData, setPackageFormData] = useState<{
    title: string;
    tagline: string;
    description: string;
    tripType: B2BPackage['tripType'];
    status: 'PUBLISHED' | 'DRAFT';
    featured: boolean;
    updateExisting: boolean;
  }>({
    title: '',
    tagline: '',
    description: '',
    tripType: 'LUXURY',
    status: 'PUBLISHED',
    featured: true,
    updateExisting: true
  });
  const [packageSavedNotice, setPackageSavedNotice] = useState<string | null>(null);
  const [savePackageError, setSavePackageError] = useState<string | null>(null);
  const [lastSavedMasterPackage, setLastSavedMasterPackage] = useState<B2BPackage | null>(null);
  const [lastPackageVerificationReport, setLastPackageVerificationReport] = useState<MasterPackageVerificationReport | null>(null);
  const [viewingSavedMasterPackage, setViewingSavedMasterPackage] = useState<B2BPackage | null>(null);

  // Helper to open quick add modal for a day slot
  const handleOpenQuickAddModal = useCallback((slot: { dayNumber: number; dateString: string; hub?: TripRouteHub | null }) => {
    const resolvedHubName = slot.hub?.hubName?.trim() || '';
    const resolvedHubId = slot.hub?.hubId?.trim() || '';
    setQuickAddModalDay({
      dayNum: slot.dayNumber,
      dateString: slot.dateString,
      hubName: resolvedHubName,
      hubId: resolvedHubId || undefined
    });
    setQuickAddSearch('');
    setQuickAddCategory('ALL');
    setFilterByDayCityOnly(true);
  }, []);

  // Helper to view product details
  const handleOpenProductDetails = useCallback((prod: Product) => {
    setInspectingProduct(prod);
    if (onViewProductDetails) {
      onViewProductDetails(prod);
    }
  }, [onViewProductDetails]);

  // Dedicated Service Configurator State (Zero Generic Customizer Architecture)
  const [editingServiceItem, setEditingServiceItem] = useState<QuoteItem | null>(null);
  const [configuringQuickAddProduct, setConfiguringQuickAddProduct] = useState<{
    product: Product;
    dateString: string;
    dayNum: number;
  } | null>(null);

  // Email Proposal Modal (Canonical QuotePresentationModel Renderer)
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailModalQuote, setEmailModalQuote] = useState<Quotation | null>(null);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailCustomNote, setEmailCustomNote] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [emailPreviewHtml, setEmailPreviewHtml] = useState('');
  const [emailRichHtml, setEmailRichHtml] = useState('');
  const [emailSimpleHtml, setEmailSimpleHtml] = useState('');
  const [plainTextSubView, setPlainTextSubView] = useState<'PREVIEW' | 'EDIT'>('PREVIEW');
  const [emailPreviewTab, setEmailPreviewTab] = useState<'HTML_PREVIEW' | 'FULL_TEXT'>('HTML_PREVIEW');
  const [emailCopied, setEmailCopied] = useState(false);
  const [emailCopiedMode, setEmailCopiedMode] = useState<'RICH_HTML' | 'PLAIN_TEXT' | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSuccessMessage, setEmailSuccessMessage] = useState<string | null>(null);
  const [emailErrorMessage, setEmailErrorMessage] = useState<string | null>(null);

  // Manual Hotel / Custom Rate Modal State
  const [isManualHotelModalOpen, setIsManualHotelModalOpen] = useState(false);
  const [manualHotelModalHubId, setManualHotelModalHubId] = useState<string | undefined>(undefined);
  const [manualHotelModalInitialData, setManualHotelModalInitialData] = useState<Partial<ManualHotelDetails> | null>(null);

  // Permission Check for Manual Accommodation & Rates
  const canAddManualHotel = Boolean(
    user?.role === 'ADMIN' ||
    user?.role === 'TEAM_MEMBER' ||
    user?.role === 'DMC_STAFF' ||
    user?.permissions?.canAddManualHotelRates !== false
  );

  // Leads dropdown
  const crmLeads = useMemo(() => {
    return db.getLeads();
  }, [db]);

  // Handle selecting an existing lead
  const handleSelectLead = (leadId: string) => {
    setSelectedLeadId(leadId);
    if (!leadId) return;
    const lead = crmLeads.find(l => l.id === leadId);
    if (lead) {
      setClientName(lead.contactName || '');
      setClientEmail(lead.email || '');
      setClientCompany(lead.agencyName || '');
      if (lead.phone) setClientPhone(lead.phone);
      if (lead.notes) {
        if (typeof lead.notes === 'string') {
          setAgentNotes(lead.notes);
        } else if (Array.isArray(lead.notes)) {
          const notesText = (lead.notes as any[])
            .map((n: any) => typeof n === 'string' ? n : n?.text || '')
            .filter(Boolean)
            .join('\n');
          setAgentNotes(notesText);
        }
      }
    }
  };

  // Switch Active Option Tab (with automatic state preservation)
  const handleSwitchOptionTab = (targetOptNum: number) => {
    if (targetOptNum === activeOptionTab) return;

    // 1. Save current option state including its independent scope and routeHubs
    setOptionsData(prev => ({
      ...prev,
      [activeOptionTab]: {
        ...prev[activeOptionTab],
        scope: quotationScope,
        items: [...items],
        routeHubs: [...routeHubs],
        dayThemes: { ...dayThemes },
        agentMarkupPercent,
        overallDiscountPercent
      }
    }));

    // 2. Target option data
    const targetOpt = optionsData[targetOptNum];
    const targetScope: QuotationScope = targetOpt?.scope || 'HOTEL_LAND';
    let targetItems = targetOpt?.items || [];
    let targetHubs = targetOpt?.routeHubs || [];
    let targetThemes = targetOpt?.dayThemes || {};
    let targetMarkup = targetOpt?.agentMarkupPercent ?? agentMarkupPercent;
    let targetDiscount = targetOpt?.overallDiscountPercent ?? 0;

    // If target has no hubs yet, inherit routeHubs city/nights structure without hotels
    if (targetHubs.length === 0 && routeHubs.length > 0) {
      targetHubs = routeHubs.map(h => ({
        ...h,
        id: `rhub-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        hotelId: undefined,
        roomTypeId: undefined,
        manualHotel: undefined,
        isManualHotel: false,
        savedAccommodationSnapshot: undefined,
        overriddenByLandOnly: targetScope === 'LAND_ONLY',
        accommodationType: targetScope === 'LAND_ONLY' ? 'NO_ACCOMMODATION' : undefined
      }));
    }

    setQuotationScope(targetScope);
    setItems(targetItems);
    routeHubsRef.current = targetHubs;
    isInternalHubMutationRef.current = true;
    setRouteHubs(targetHubs);
    setContextRouteHubs(targetHubs);
    setDayThemes(targetThemes);
    setAgentMarkupPercent(targetMarkup);
    setOverallDiscountPercent(targetDiscount);
    setActiveOptionTab(targetOptNum);

    showBuilderToast(`Switched to Option ${targetOptNum}: ${targetOpt?.title || `Option ${targetOptNum}`}`, 'INFO');
  };

  // Keep stored optionsData items synchronized when quotation currency changes
  useEffect(() => {
    setOptionsData(prev => {
      const next = { ...prev };
      ([1, 2, 3] as const).forEach(optNum => {
        if (!next[optNum] || !Array.isArray(next[optNum].items) || next[optNum].items.length === 0) return;
        next[optNum] = {
          ...next[optNum],
          items: next[optNum].items.map(item => {
            if (item.calculation?.currency === currency) return item;
            const calcFn = canViewInternalCosts ? calculateProductPrice : calculateProductPriceForAgent;
            const calculation = calcFn(item.product, {
              productId: item.product.id,
              productName: item.product.name,
              itemId: item.id,
              quoteId: activeQuoteId,
              pricingTier: user && user.role !== 'PUBLIC' ? 'B2B' : 'B2C',
              adults: item.pax?.adults || adultsCount || 2,
              children: item.pax?.children || childrenCount || 0,
              infants: item.pax?.infants || infantsCount || 0,
              travelDate: item.travelDate || startDate,
              serviceEndDate: item.checkOutDate || item.manualHotelDetails?.checkOutDate,
              nights: item.nights || item.manualHotelDetails?.numberOfNights || (item.product as any)?.nights,
              roomsCount: item.roomsCount || item.manualHotelDetails?.numberOfRooms || (item.product as any)?.roomsCount,
              targetCurrency: currency,
              selectedAddonIds: item.selectedAddonIds || []
            }) as any;
            return {
              ...item,
              calculation
            };
          })
        };
      });
      return next;
    });
  }, [currency]);

  // Duplicate an option to another option slot
  const handleDuplicateOption = (fromOptNum: number, toOptNum: number) => {
    const sourceOpt = fromOptNum === activeOptionTab
      ? {
          scope: quotationScope,
          items: [...items],
          routeHubs: [...routeHubs],
          dayThemes: { ...dayThemes },
          agentMarkupPercent,
          overallDiscountPercent
        }
      : optionsData[fromOptNum];

    const hubIdMap = new Map<string, string>();
    const clonedHubs: TripRouteHub[] = (sourceOpt?.routeHubs || []).map(h => {
      const newHubId = `rhub-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      hubIdMap.set(h.id, newHubId);
      return {
        ...h,
        id: newHubId,
        manualHotel: h.manualHotel ? { ...h.manualHotel, hubId: newHubId } : undefined,
        savedAccommodationSnapshot: h.savedAccommodationSnapshot
          ? {
              ...h.savedAccommodationSnapshot,
              manualHotel: h.savedAccommodationSnapshot.manualHotel
                ? { ...h.savedAccommodationSnapshot.manualHotel, hubId: newHubId }
                : undefined
            }
          : undefined
      };
    });

    const clonedItems: QuoteItem[] = (sourceOpt?.items || []).map(it => {
      const oldHubId = it.hubId || it.manualHotelDetails?.hubId;
      const mappedHubId = (oldHubId && hubIdMap.get(oldHubId)) || oldHubId;
      return {
        ...it,
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        hubId: mappedHubId,
        manualHotelDetails: it.manualHotelDetails
          ? { ...it.manualHotelDetails, hubId: mappedHubId }
          : undefined
      };
    });

    const clonedThemes: Record<number, string> = { ...(sourceOpt?.dayThemes || {}) };
    const clonedScope: QuotationScope = sourceOpt?.scope || quotationScope;

    setOptionsData(prev => ({
      ...prev,
      [toOptNum]: {
        ...prev[toOptNum],
        scope: clonedScope,
        items: clonedItems,
        routeHubs: clonedHubs,
        dayThemes: clonedThemes,
        agentMarkupPercent: sourceOpt?.agentMarkupPercent ?? 0,
        overallDiscountPercent: sourceOpt?.overallDiscountPercent ?? 0
      }
    }));

    // Switch to target option
    setQuotationScope(clonedScope);
    setItems(clonedItems);
    routeHubsRef.current = clonedHubs;
    isInternalHubMutationRef.current = true;
    setRouteHubs(clonedHubs);
    setContextRouteHubs(clonedHubs);
    setDayThemes(clonedThemes);
    setAgentMarkupPercent(sourceOpt?.agentMarkupPercent ?? 0);
    setOverallDiscountPercent(sourceOpt?.overallDiscountPercent ?? 0);
    setActiveOptionTab(toOptNum);

    showBuilderToast(`Option ${fromOptNum} successfully cloned to Option ${toOptNum}!`, 'SUCCESS');
  };

  // Silent Product Add (Suppresses Cart Drawer popup in builder)
  const handleAddProductToQuoteSilently = useCallback((product: Product, options?: any) => {
    // Enforce strict ACTIVE destination visibility for any new product addition
    const isManualHotelEntry = Boolean(options?.isManualHotel || (product as any)?.accommodationType === 'manual');
    if (isManualHotelEntry) {
      if (!inventoryVisibilityService.isDestinationActiveForB2B(currentDestination)) {
        showBuilderToast(`Cannot add services: destination "${currentDestination.name}" is not Active.`, 'WARNING');
        return;
      }
    } else if (!inventoryVisibilityService.isEntityAccessibleInB2B('PRODUCT', product)) {
      showBuilderToast(`Service "${product.name}" belongs to a non-active destination and cannot be added.`, 'WARNING');
      return;
    }

    // Japan Rail / Shinkansen products MUST only use Shinkansen Dynamic Journey Configurator
    if (isRailProduct(product)) {
      setInspectingProduct(product);
      return;
    }
    addProductToQuote(product, { ...options, openDrawer: false });
    showBuilderToast(`✓ Added "${product.name}" to Option ${activeOptionTab}`, 'SUCCESS');
  }, [addProductToQuote, activeOptionTab, showBuilderToast, currentDestination]);

  // Generate Calendar Days
  const calendarDays = useMemo(() => {
    if (!startDate || !endDate) return [];
    const list: Array<{ dayNumber: number; dateString: string; dayOfWeek: string; formattedDate: string }> = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      const base = new Date();
      for (let i = 0; i < 7; i++) {
        const d = new Date(base);
        d.setDate(base.getDate() + i);
        const iso = d.toISOString().split('T')[0];
        list.push({
          dayNumber: i + 1,
          dateString: iso,
          dayOfWeek: d.toLocaleDateString('en-US', { weekday: 'short' }),
          formattedDate: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        });
      }
      return list;
    }

    const current = new Date(start);
    let dayCount = 1;
    while (current <= end) {
      const iso = current.toISOString().split('T')[0];
      list.push({
        dayNumber: dayCount,
        dateString: iso,
        dayOfWeek: current.toLocaleDateString('en-US', { weekday: 'short' }),
        formattedDate: current.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      });
      current.setDate(current.getDate() + 1);
      dayCount++;
    }
    return list;
  }, [startDate, endDate]);

  // Map Days to Route Hubs
  const daySlots = useMemo(() => {
    if (calendarDays.length === 0) return [];

    const sortedHubs = [...routeHubs].sort((a, b) => a.order - b.order);

    return calendarDays.map((calDay) => {
      let activeHub: TripRouteHub | null = null;
      let isTransitionDay = false;
      let prevHub: TripRouteHub | null = null;

      if (sortedHubs.length > 0) {
        let runningNightCount = 0;
        for (let i = 0; i < sortedHubs.length; i++) {
          const hub = sortedHubs[i];
          const hubNights = hub.nights || 1;
          const hubStartDay = runningNightCount + 1;
          const hubEndDay = runningNightCount + hubNights;

          if (calDay.dayNumber >= hubStartDay && calDay.dayNumber <= hubEndDay) {
            activeHub = hub;
            if (calDay.dayNumber === hubStartDay && i > 0) {
              isTransitionDay = true;
              prevHub = sortedHubs[i - 1];
            }
            break;
          }
          runningNightCount += hubNights;
        }

        if (!activeHub && sortedHubs.length > 0) {
          activeHub = sortedHubs[sortedHubs.length - 1];
        }
      }

      // Helper predicate for Hotel quotation items
      const isHotelQuoteItem = (it: QuoteItem): boolean => {
        return it.product.productType === 'Hotel' || 
               it.product.productType === 'Hotel & Resort' || 
               it.isManualHotel === true || 
               it.product.accommodationType === 'manual' ||
               (it.product as any).category === 'Hotels';
      };

      // Helper predicate for Visa quotation items
      const isVisaQuoteItem = (it: QuoteItem): boolean => {
        return it.product.productType === 'Visa Service' || 
               it.product.subcategory === 'Visa Facilitation' || 
               it.product.sku?.startsWith('VSA-') ||
               (it.product.category === 'Travel Services' && it.product.name?.toLowerCase().includes('visa')) ||
               Boolean(it.product.name?.toLowerCase().includes('visa') && it.product.name?.toLowerCase().includes('entry'));
      };

      // Find items matching this day's date
      const dayItems = items.filter(it => it.travelDate === calDay.dateString);
      const dayHotelItems = dayItems.filter(isHotelQuoteItem);
      const dayProductItems = dayItems.filter(it => !isHotelQuoteItem(it) && !isVisaQuoteItem(it));

      const daySellingPrice = dayItems.reduce((sum, it) => sum + (it.calculation?.finalTotalSellingPrice || 0), 0);

      return {
        dayNumber: calDay.dayNumber,
        dateString: calDay.dateString,
        dayOfWeek: calDay.dayOfWeek,
        formattedDate: calDay.formattedDate,
        hub: activeHub,
        isTransitionDay,
        prevHub,
        hotelItems: dayHotelItems,
        productItems: dayProductItems,
        daySellingPrice
      };
    });
  }, [calendarDays, routeHubs, items]);

  // Helper predicate for Hotel quotation items
  const isHotelQuoteItem = (it: QuoteItem): boolean => {
    return it.product.productType === 'Hotel' || 
           it.product.productType === 'Hotel & Resort' || 
           it.isManualHotel === true || 
           it.product.accommodationType === 'manual' ||
           (it.product as any).category === 'Hotels';
  };

  // Helper predicate for Visa quotation items
  const isVisaQuoteItem = (it: QuoteItem): boolean => {
    return it.product.productType === 'Visa Service' || 
           it.product.subcategory === 'Visa Facilitation' || 
           it.product.sku?.startsWith('VSA-') ||
           (it.product.category === 'Travel Services' && it.product.name?.toLowerCase().includes('visa')) ||
           Boolean(it.product.name?.toLowerCase().includes('visa') && it.product.name?.toLowerCase().includes('entry'));
  };

  const isVisaInQuote = (visaId: string): boolean => {
    return items.some(it => it.product.id === visaId || it.product.sku?.includes(visaId));
  };

  // Grouped items (excluding hotel charges when Land-Only Mode is active or for NO_ACCOMMODATION hubs)
  const hotelItems = useMemo(() => {
    if (quotationScope === 'LAND_ONLY') return [];
    const noAccHubIds = new Set(
      routeHubs
        .filter(h => h.accommodationType === 'NO_ACCOMMODATION' || h.accommodationType === 'none')
        .map(h => h.id)
    );
    return items.filter(it => {
      if (!isHotelQuoteItem(it)) return false;
      const itemHubId = it.hubId || it.manualHotelDetails?.hubId;
      if (itemHubId && noAccHubIds.has(itemHubId)) return false;
      return true;
    });
  }, [items, quotationScope, routeHubs]);
  const visaItems = useMemo(() => items.filter(isVisaQuoteItem), [items]);
  const experienceItems = useMemo(() => items.filter(it => !isHotelQuoteItem(it) && !isVisaQuoteItem(it)), [items]);

  const effectivePricedItems = useMemo(() => {
    if (quotationScope === 'LAND_ONLY') {
      return items.filter(it => !isHotelQuoteItem(it));
    }
    const noAccHubIds = new Set(
      routeHubs
        .filter(h => h.accommodationType === 'NO_ACCOMMODATION' || h.accommodationType === 'none')
        .map(h => h.id)
    );
    if (noAccHubIds.size === 0) return items;
    return items.filter(it => {
      if (!isHotelQuoteItem(it)) return true;
      const itemHubId = it.hubId || it.manualHotelDetails?.hubId;
      return !(itemHubId && noAccHubIds.has(itemHubId));
    });
  }, [items, quotationScope, routeHubs]);

  const hasInsurance = useMemo(() => {
    return items.some(it => 
      it.product.subcategory === 'Travel Insurance' || 
      (it.product.name || '').toLowerCase().includes('insurance')
    );
  }, [items]);

  const hasEsim = useMemo(() => {
    return items.some(it => 
      it.product.subcategory === 'eSIM Connectivity' || 
      (it.product.name || '').toLowerCase().includes('esim')
    );
  }, [items]);

  // Dynamic Transfer Suggestions
  const transferSuggestions = useMemo(() => {
    return generateTransferSuggestions(routeHubs, calendarDays.length || (tripNights + 1));
  }, [routeHubs, calendarDays.length, tripNights]);

  // Feasibility Check Engine (Score & Diagnostics)
  const feasibility = useMemo(() => {
    return checkItineraryFeasibility(
      routeHubs,
      items,
      calendarDays.length || (tripNights + 1),
      visaAssistanceChoice,
      hasInsurance,
      hasEsim
    );
  }, [routeHubs, items, calendarDays.length, tripNights, visaAssistanceChoice, hasInsurance, hasEsim]);

  // Add Suggested Transfer Helper (Prefers Authoritative Master Products from availableProducts)
  const handleAddSuggestedTransfer = (s: TransferSuggestion) => {
    if (!inventoryVisibilityService.isDestinationActiveForB2B(currentDestination)) {
      showBuilderToast(`Cannot add suggested transfer: destination "${currentDestination.name}" is not Active.`, 'WARNING');
      return;
    }
    const targetDay = calendarDays.find(d => d.dayNumber === s.dayNumber);
    const dateStr = targetDay?.dateString || startDate;

    const sFrom = (s.fromCity || '').toLowerCase();
    const sTo = (s.toCity || '').toLowerCase();

    // Look for matching master product in availableProducts
    const matchedMaster = availableProducts.find(p => {
      const isTrf = (p.category || '').toLowerCase().includes('transfer') || Boolean((p as any).isTransfer);
      if (!isTrf) return false;
      const pName = (p.name || '').toLowerCase();
      const pFrom = (p.fromHubName || '').toLowerCase();
      const pTo = (p.toHubName || '').toLowerCase();
      const pCity = (p.city || '').toLowerCase();

      if (s.type === 'INTERCITY') {
        const matchesFrom = sFrom && (pName.includes(sFrom) || pFrom.includes(sFrom) || pCity.includes(sFrom));
        const matchesTo = sTo && (pName.includes(sTo) || pTo.includes(sTo));
        return Boolean(matchesFrom && matchesTo);
      } else {
        const targetCity = s.type === 'AIRPORT_ARRIVAL' ? sTo : sFrom;
        return targetCity && (pName.includes(targetCity) || pFrom.includes(targetCity) || pTo.includes(targetCity) || pCity.includes(targetCity));
      }
    });

    const prod = matchedMaster || ({
      id: `prod-transfer-${s.id}-${Date.now()}`,
      sku: `TRF-${s.type}`,
      destinationId: currentDestination.id,
      destinationName: currentDestination.name,
      country: currentDestination.name,
      city: s.fromCity || currentDestination.name,
      productType: 'Private Vehicle Transfer',
      name: `${s.title} (${s.vehicleType})`,
      shortDescription: s.description,
      longDescription: `Confirmed private ground transfer from ${s.fromCity || 'Pickup'} to ${s.toCity || 'Dropoff'}. Vehicle type: ${s.vehicleType}. Includes tolls, fuel, parking fees, and commercial driver insurance.`,
      supplierId: 'sup-ground-logistics',
      supplierName: `${currentDestination.name} Ground Logistics Network`,
      category: 'Transfers',
      subcategory: s.type === 'INTERCITY' ? 'Intercity Transfer' : 'Airport Transfer',
      adultNetPrice: s.estimatedCostUSD || 65,
      childNetPrice: 0,
      infantNetPrice: 0,
      currency: 'USD',
      defaultMarkupPercent: 20,
      taxPercent: 0,
      commissionPercent: 10,
      serviceFeeFixed: 0,
      season: 'All Year',
      validityFrom: '2026-01-01',
      validityTo: '2026-12-31',
      minPax: 1,
      maxPax: 20,
      availability: 'INSTANT',
      inclusions: [
        `Private Air-Conditioned ${s.vehicleType}`,
        'Commercial Chauffeur with Name Board Signage',
        'All Highway Tolls, Airport Parking & Fuel',
        '60 Minutes Complimentary Flight Delay Waiting Time'
      ],
      exclusions: ['Driver tips and personal luggage handling extras'],
      heroImage: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?q=80&w=800&auto=format&fit=crop',
      galleryImages: ['https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?q=80&w=800&auto=format&fit=crop'],
      status: 'ACTIVE'
    } as unknown as Product);

    handleAddProductToQuoteSilently(prod, { 
      travelDate: dateStr, 
      adults: adultsCount, 
      children: childrenCount, 
      infants: infantsCount,
      notes: `${s.fromLocation || s.fromCity || 'Pickup'} ➔ ${s.toLocation || s.toCity || 'Dropoff'}`
    });
  };

  const hotelTotalSelling = useMemo(() => hotelItems.reduce((sum, it) => sum + (it.calculation?.finalTotalSellingPrice || 0), 0), [hotelItems]);
  const visaTotalSelling = useMemo(() => visaItems.reduce((sum, it) => sum + (it.calculation?.finalTotalSellingPrice || 0), 0), [visaItems]);
  const experienceTotalSelling = useMemo(() => experienceItems.reduce((sum, it) => sum + (it.calculation?.finalTotalSellingPrice || 0), 0), [experienceItems]);

  const quoteAgencyContext = useMemo(() => {
    return resolveQuoteAgencyPricingContext(
      {
        companyId: quoteCompanyId,
        agentAgency: quoteAgentAgency,
        agentId: quoteAgentId,
        productLevelMarginEnabled: quoteProductLevelMarginEnabled,
        agentLevelMarginPercent: quoteAgentLevelMarginPercent
      },
      user
    );
  }, [quoteCompanyId, quoteAgentAgency, quoteAgentId, quoteProductLevelMarginEnabled, quoteAgentLevelMarginPercent, user]);

  const agencyPricingSettings = useMemo(() => ({
    productLevelMarginEnabled: quoteAgencyContext.productLevelMarginEnabled,
    agentLevelMarginPercent: quoteAgencyContext.agentLevelMarginPercent,
    activeMarginMode: quoteAgencyContext.activeMarginMode
  }), [quoteAgencyContext]);
  const isProductLevelMarginActive = agencyPricingSettings.productLevelMarginEnabled !== false;

  const liveQuoteBreakdown = useMemo(() => {
    return calculateQuoteInternalBreakdown({
      items: effectivePricedItems,
      targetCurrency: currency,
      agentMarginType,
      agentMarginValue: Math.max(0, Number(agentMarginValue) || 0),
      overallDiscountPercent: overallDiscountPercent || 0,
      userRole: user?.role,
      user,
      companyId: quoteAgencyContext.companyId,
      agencyName: quoteAgencyContext.agencyName,
      productLevelMarginEnabled: isProductLevelMarginActive,
      customAgentMarginPercent: agencyPricingSettings.agentLevelMarginPercent,
      scope: quotationScope,
      routeHubs,
      adminManualMarginType,
      adminManualMarginValue,
      adminMarginMode
    });
  }, [
    effectivePricedItems,
    currency,
    agentMarginType,
    agentMarginValue,
    overallDiscountPercent,
    user,
    quoteAgencyContext.companyId,
    quoteAgencyContext.agencyName,
    isProductLevelMarginActive,
    agencyPricingSettings.agentLevelMarginPercent,
    quotationScope,
    routeHubs,
    adminManualMarginType,
    adminManualMarginValue,
    adminMarginMode
  ]);

  const step7InternalBreakdown = canViewInternalCosts ? liveQuoteBreakdown : null;

  const baseFinalSellingPrice = useMemo(() => {
    if (liveQuoteBreakdown && (liveQuoteBreakdown.itemizedBreakdown.some(ib => !ib.isExcludedNoAccommodation) || liveQuoteBreakdown.theUnboundBaseSellingPrice > 0)) {
      return roundCurrencyAmount(liveQuoteBreakdown.theUnboundBaseSellingPrice, currency);
    }
    return roundCurrencyAmount(
      quotationScope === 'LAND_ONLY'
        ? effectivePricedItems.reduce((sum, it) => sum + (it.calculation?.finalTotalSellingPrice || 0), 0)
        : totalSellingPrice,
      currency
    );
  }, [liveQuoteBreakdown, totalSellingPrice, quotationScope, effectivePricedItems, currency]);

  const additionalMarginAmount = useMemo(() => {
    if (liveQuoteBreakdown) {
      return roundCurrencyAmount(Math.max(0, liveQuoteBreakdown.partnerMarginAmount), currency);
    }
    return 0;
  }, [liveQuoteBreakdown, currency]);

  const finalCustomerSellingPrice = useMemo(() => {
    if (liveQuoteBreakdown) {
      return Math.max(baseFinalSellingPrice, roundCurrencyAmount(liveQuoteBreakdown.finalPackagePrice, currency));
    }
    return Math.max(baseFinalSellingPrice, roundCurrencyAmount(baseFinalSellingPrice + additionalMarginAmount, currency));
  }, [liveQuoteBreakdown, baseFinalSellingPrice, additionalMarginAmount, currency]);

  const finalClientPrice = finalCustomerSellingPrice;

  // Dynamic 3-Option Calculations Engine (reuses liveQuoteBreakdown for active option & fast-paths empty inactive options)
  const computedQuotationOptions: QuotationOption[] = useMemo(() => {
    return [1, 2, 3].map(optNum => {
      const isCurrentActiveOption = optNum === activeOptionTab;
      const optState = isCurrentActiveOption
        ? {
            scope: quotationScope,
            items: effectivePricedItems,
            routeHubs,
            agentMarkupPercent: agentMarginType === 'PERCENTAGE' ? Math.max(0, agentMarginValue) : 0,
            overallDiscountPercent,
            title: optionsData[optNum]?.title || `Option ${optNum}`,
            badge: optionsData[optNum]?.badge || '',
            hotelTier: optionsData[optNum]?.hotelTier || ''
          }
        : {
            scope: optionsData[optNum]?.scope || 'HOTEL_LAND',
            items: (optionsData[optNum]?.scope === 'LAND_ONLY')
              ? (optionsData[optNum]?.items || []).filter(it => !isHotelQuoteItem(it))
              : (optionsData[optNum]?.items || []),
            routeHubs: optionsData[optNum]?.routeHubs || [],
            agentMarkupPercent: Math.max(0, optionsData[optNum]?.agentMarkupPercent ?? 0),
            overallDiscountPercent: optionsData[optNum]?.overallDiscountPercent ?? 0,
            title: optionsData[optNum]?.title || `Option ${optNum}`,
            badge: optionsData[optNum]?.badge || '',
            hotelTier: optionsData[optNum]?.hotelTier || ''
          };

      const optItems = optState.items;
      if (!isCurrentActiveOption && optItems.length === 0) {
        return {
          id: `opt-${optNum}`,
          optionNumber: optNum,
          title: optState.title,
          badge: optState.badge,
          hotelTier: optState.hotelTier,
          scope: optState.scope,
          items: optItems,
          routeHubs: optState.routeHubs,
          totalNetCost: 0,
          totalSellingPrice: 0,
          totalMargin: 0,
          totalTaxes: 0
        };
      }

      const optBreakdown = isCurrentActiveOption
        ? liveQuoteBreakdown
        : calculateQuoteInternalBreakdown({
            items: optItems,
            targetCurrency: currency,
            agentMarginType: 'PERCENTAGE',
            agentMarginValue: Math.max(0, optState.agentMarkupPercent ?? 0),
            overallDiscountPercent: optState.overallDiscountPercent ?? 0,
            userRole: user?.role,
            user,
            companyId: quoteAgencyContext.companyId,
            agencyName: quoteAgencyContext.agencyName,
            productLevelMarginEnabled: isProductLevelMarginActive,
            customAgentMarginPercent: agencyPricingSettings.agentLevelMarginPercent,
            adminManualMarginType,
            adminManualMarginValue,
            adminMarginMode,
            scope: optState.scope,
            routeHubs: optState.routeHubs
          });

      const optMarkupAmount = isCurrentActiveOption
        ? additionalMarginAmount
        : optBreakdown.partnerMarginAmount;
      const optFinalClientPrice = isCurrentActiveOption
        ? finalCustomerSellingPrice
        : optBreakdown.finalPackagePrice;

      return {
        id: `opt-${optNum}`,
        optionNumber: optNum,
        title: optState.title,
        badge: optState.badge,
        hotelTier: optState.hotelTier,
        scope: optState.scope,
        items: optItems,
        routeHubs: optState.routeHubs,
        totalNetCost: canViewInternalCosts && optBreakdown && optBreakdown.isComplete ? optBreakdown.totalNettCost : 0,
        totalSellingPrice: isCurrentActiveOption
          ? finalCustomerSellingPrice
          : optFinalClientPrice,
        totalMargin: canViewInternalCosts && optBreakdown ? optBreakdown.totalMargin : optMarkupAmount,
        totalTaxes: canViewInternalCosts && optBreakdown ? optBreakdown.taxAmount : 0
      };
    });
  }, [
    liveQuoteBreakdown,
    effectivePricedItems,
    routeHubs,
    quotationScope,
    agentMarginType,
    agentMarginValue,
    additionalMarginAmount,
    finalCustomerSellingPrice,
    overallDiscountPercent,
    optionsData,
    activeOptionTab,
    canViewInternalCosts,
    currency,
    user,
    quoteAgencyContext.companyId,
    quoteAgencyContext.agencyName,
    isProductLevelMarginActive,
    agencyPricingSettings.agentLevelMarginPercent,
    adminManualMarginType,
    adminManualMarginValue,
    adminMarginMode
  ]);

  // Lightweight deterministic dirty hash to skip redundant background auto-saves
  const buildSaveStateHash = useCallback(() => {
    const itemSig = items
      .map(
        it =>
          `${it.id}:${it.product?.id}:${it.travelDate || ''}:${it.pax?.adults || 0}:${it.pax?.children || 0}:${it.pax?.infants || 0}:${it.calculation?.finalTotalSellingPrice || 0}:${it.agentAdditionalMarkupType || ''}:${it.agentAdditionalMarkupValue || 0}:${(it.selectedAddonIds || []).join(',')}:${it.serviceTime || ''}:${it.notes || ''}`
      )
      .join('|');
    const hubSig = routeHubs
      .map(
        h =>
          `${h.id}:${h.hubId}:${h.nights}:${h.accommodationType || ''}:${h.hotelId || ''}:${h.roomTypeId || ''}:${h.roomsCount || 1}:${h.manualHotel?.ratePerNight || 0}`
      )
      .join('|');
    return [
      activeQuoteId,
      quoteTitle,
      currentDestination?.id,
      clientName,
      clientEmail,
      clientPhone,
      clientCompany,
      agentNotes,
      selectedLeadId,
      startDate,
      endDate,
      adultsCount,
      childrenCount,
      infantsCount,
      currency,
      quotationScope,
      brandingMode,
      quoteCompanyId || '',
      quoteAgentId || '',
      quoteAgencyContext.productLevelMarginEnabled ? '1' : '0',
      quoteAgencyContext.agentLevelMarginPercent,
      liveQuoteBreakdown?.surchargesTotal || 0,
      agentMarginType,
      agentMarginValue,
      adminManualMarginType,
      adminManualMarginValue,
      adminMarginMode,
      overallDiscountPercent,
      itineraryOverview,
      JSON.stringify(dayThemes),
      JSON.stringify(dayDescriptions),
      JSON.stringify(dayOverviews),
      JSON.stringify(dayNotes),
      itemSig,
      hubSig
    ].join('::');
  }, [
    activeQuoteId,
    quoteTitle,
    currentDestination?.id,
    clientName,
    clientEmail,
    clientPhone,
    clientCompany,
    agentNotes,
    selectedLeadId,
    startDate,
    endDate,
    adultsCount,
    childrenCount,
    infantsCount,
    currency,
    quotationScope,
    brandingMode,
    quoteCompanyId,
    quoteAgentId,
    quoteAgencyContext.productLevelMarginEnabled,
    quoteAgencyContext.agentLevelMarginPercent,
    liveQuoteBreakdown?.surchargesTotal,
    agentMarginType,
    agentMarginValue,
    adminManualMarginType,
    adminManualMarginValue,
    adminMarginMode,
    overallDiscountPercent,
    itineraryOverview,
    dayThemes,
    dayDescriptions,
    dayOverviews,
    dayNotes,
    items,
    routeHubs
  ]);

  const currentWorkingHash = buildSaveStateHash();

  const previewUpdatedAtRef = useRef<{ hash: string; ts: string }>({
    hash: '',
    ts: new Date().toISOString()
  });
  if (previewUpdatedAtRef.current.hash !== currentWorkingHash) {
    previewUpdatedAtRef.current = { hash: currentWorkingHash, ts: new Date().toISOString() };
  }

  useEffect(() => {
    if (pendingBaselineCommitRef.current) {
      pendingBaselineCommitRef.current = false;
      setBaselineSavedHash(currentWorkingHash);
      lastSavedHashRef.current = currentWorkingHash;
    }
  }, [currentWorkingHash]);

  const hasUnsavedChanges = useMemo(() => {
    if (isReadOnlyHistoricalMode) return false;
    if (restoredFromVersion !== undefined) return true;
    if (!hasExplicitlySaved) {
      return Boolean(
        items.length > 0 ||
        routeHubs.length > 0 ||
        (clientName && clientName.trim() !== '') ||
        (quoteTitle && quoteTitle.trim() !== '') ||
        (agentNotes && agentNotes.trim() !== '')
      );
    }
    if (!baselineSavedHash) return false;
    return currentWorkingHash !== baselineSavedHash;
  }, [
    isReadOnlyHistoricalMode,
    restoredFromVersion,
    hasExplicitlySaved,
    baselineSavedHash,
    currentWorkingHash,
    items.length,
    routeHubs.length,
    clientName,
    quoteTitle,
    agentNotes
  ]);

  // Warn browser tab reload/close when unsaved changes exist (never silently autosaves)
  useEffect(() => {
    if (!hasUnsavedChanges || isReadOnlyHistoricalMode) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasUnsavedChanges, isReadOnlyHistoricalMode]);

  const requestNavigationWithUnsavedGuard = (navAction: () => void) => {
    if (hasUnsavedChanges && !isReadOnlyHistoricalMode) {
      setPendingLeaveAction(() => navAction);
      return;
    }
    navAction();
  };

  // Switch into working restored draft (non-persisting) or open another saved version from banner/modal
  const handleSwitchBuilderVersion = async (qId: string, ver: number, targetMode: 'inspect' | 'readonly' | 'restore') => {
    const target = db.getQuoteByIdAuthorized(qId, user);
    if (!target) return;
    hydratedSessionKeyRef.current = '';
    const loadedSnap = await db.loadQuotationVersionFullAsync(target.id, ver, user).catch(() => null);
    const versions = db.getQuotationVersions(target.id, user);
    const highestVer = Math.max(versions[0]?.version || 0, target.latestVersion || 0, target.version || 1);

    if (targetMode === 'restore') {
      const restoredDraft = await db.prepareRestoredWorkingQuoteAsync(target.id, ver, user);
      const qToApply = restoredDraft || target;
      setRestoredFromVersion(ver);
      setIsReadOnlyHistoricalMode(false);
      setLoadedIsLocked(false);
      setQuoteVersion(highestVer);
      setLatestSavedVersion(highestVer);
      setVersionCount(versions.length || 1);
      setBaselineSavedHash('__UNSAVED_RESTORE__');
      setAutoSaveStatus('IDLE');
      setLastSavedTimestamp('');
      if (qToApply.clientName) setClientName(qToApply.clientName);
      if (qToApply.clientEmail !== undefined) setClientEmail(qToApply.clientEmail || '');
      if (qToApply.clientPhone !== undefined) setClientPhone(qToApply.clientPhone || '');
      if (qToApply.clientCompany !== undefined) setClientCompany(qToApply.clientCompany || '');
      if (qToApply.currency) setCurrency(qToApply.currency);
      if (qToApply.travelStartDate) setStartDate(qToApply.travelStartDate);
      if (qToApply.travelEndDate) setEndDate(qToApply.travelEndDate);
      if (qToApply.adultsCount) setAdultsCount(qToApply.adultsCount);
      if (qToApply.childrenCount !== undefined) setChildrenCount(qToApply.childrenCount);
      if (qToApply.infantsCount !== undefined) setInfantsCount(qToApply.infantsCount);
      if (qToApply.title) setQuoteTitle(qToApply.title);
      if (qToApply.items) setItems(qToApply.items);
      if (qToApply.routeHubs) handleUpdateRouteHubs(qToApply.routeHubs);
      if (qToApply.dayThemes) handleUpdateDayThemes(qToApply.dayThemes);
      if (qToApply.dayDescriptions) handleUpdateDayDescriptions(qToApply.dayDescriptions);
      if (qToApply.itineraryOverview !== undefined) handleUpdateItineraryOverview(qToApply.itineraryOverview || '');
      if (qToApply.agentMarginType) setAgentMarginType(qToApply.agentMarginType);
      const restoredAgentVal = Math.max(0, Number(qToApply.agentMarginValue ?? qToApply.overallMarkupPercent ?? 0) || 0);
      setAgentMarginValue(restoredAgentVal);
      setAgentMarkupPercent((qToApply.agentMarginType || 'PERCENTAGE') === 'PERCENTAGE' ? restoredAgentVal : 0);
      setOverallDiscountPercent(Math.max(0, Number(qToApply.overallDiscountPercent || 0) || 0));
      const restoredScope = (qToApply.quotationScope as QuotationScope) || (qToApply.scope as QuotationScope) || 'HOTEL_LAND';
      setQuotationScope(restoredScope);
      setContextQuotationScope(restoredScope === 'LAND_ONLY' ? 'LAND_ONLY' : 'HOTEL_LAND');
      setBrandingMode(qToApply.brandingMode || qToApply.brandingSnapshot?.mode || 'STANDARD');
      const rAdminType = qToApply.adminManualMarginType || (qToApply as any).admin_manual_margin_type || qToApply.pricingSnapshot?.adminManualMarginType;
      setAdminManualMarginType(rAdminType === 'FIXED' ? 'FIXED' : 'PERCENTAGE');
      const rAdminVal = qToApply.adminManualMarginValue ?? (qToApply as any).admin_manual_margin_value ?? qToApply.pricingSnapshot?.adminManualMarginValue;
      setAdminManualMarginValue(Math.max(0, Number(rAdminVal ?? 0) || 0));
      const rAdminMode = qToApply.adminMarginMode || (qToApply as any).admin_margin_mode || qToApply.pricingSnapshot?.adminMarginMode;
      setAdminMarginMode(rAdminMode === 'REPLACE' ? 'REPLACE' : 'ADD');
      setQuoteCompanyId((qToApply as any).companyId || undefined);
      setQuoteAgentId(qToApply.agentId || qToApply.createdBy || undefined);
      setQuoteAgentAgency(qToApply.agentAgency || undefined);
      setQuoteProductLevelMarginEnabled(
        qToApply.productLevelMarginEnabled !== undefined
          ? Boolean(qToApply.productLevelMarginEnabled)
          : (qToApply.activeMarginMode ? qToApply.activeMarginMode === 'PRODUCT_LEVEL' : undefined)
      );
      setQuoteAgentLevelMarginPercent(
        typeof qToApply.agentLevelMarginPercent === 'number' ? qToApply.agentLevelMarginPercent : undefined
      );
      setAuthoritativeSavedQuote(qToApply);
      showBuilderToast(`Loaded v${ver} into working draft (Unsaved — click Save Draft to create v${highestVer + 1})`, 'INFO');
      return;
    }

    const vSnap = loadedSnap || versions.find(v => v.version === ver);
    const readOnlyHist = targetMode === 'readonly' || ver < highestVer;
    const snapQuote: Quotation = vSnap
      ? {
          ...target,
          version: vSnap.version,
          title: vSnap.title || target.title,
          destination: vSnap.destination || target.destination,
          clientName: vSnap.clientName || target.clientName,
          clientEmail: vSnap.clientEmail ?? target.clientEmail,
          clientPhone: vSnap.clientPhone ?? target.clientPhone,
          clientCompany: vSnap.clientCompany ?? target.clientCompany,
          travelStartDate: vSnap.travelStartDate || target.travelStartDate,
          travelEndDate: vSnap.travelEndDate || target.travelEndDate,
          adultsCount: vSnap.adultsCount ?? target.adultsCount,
          childrenCount: vSnap.childrenCount ?? target.childrenCount,
          infantsCount: vSnap.infantsCount ?? target.infantsCount,
          currency: vSnap.currency || target.currency,
          items: vSnap.items && vSnap.items.length > 0 ? vSnap.items : target.items,
          routeHubs: vSnap.routeHubs && vSnap.routeHubs.length > 0 ? vSnap.routeHubs : target.routeHubs,
          dayThemes: vSnap.dayThemes ?? target.dayThemes,
          dayDescriptions: vSnap.dayDescriptions ?? target.dayDescriptions,
          itineraryOverview: vSnap.itineraryOverview ?? target.itineraryOverview,
          quotationScope: vSnap.quotationScope ?? target.quotationScope,
          brandingMode: vSnap.brandingMode ?? target.brandingMode,
          brandingSnapshot: vSnap.brandingSnapshot ?? target.brandingSnapshot,
          commercialTermsSnapshot: vSnap.commercialTermsSnapshot ?? target.commercialTermsSnapshot,
          termsAndConditions: vSnap.termsAndConditions ?? target.termsAndConditions,
          authoritativeSnapshot: vSnap.authoritativeSnapshot ?? target.authoritativeSnapshot,
          pricingSnapshot: vSnap.pricingSnapshot ?? target.pricingSnapshot,
          theUnboundBaseSellingPrice: vSnap.theUnboundBaseSellingPrice ?? target.theUnboundBaseSellingPrice,
          adminManualMarginType: vSnap.adminManualMarginType ?? vSnap.pricingSnapshot?.adminManualMarginType ?? target.adminManualMarginType,
          adminManualMarginValue: vSnap.adminManualMarginValue ?? vSnap.pricingSnapshot?.adminManualMarginValue ?? target.adminManualMarginValue,
          adminManualMarginAmount: vSnap.adminManualMarginAmount ?? vSnap.pricingSnapshot?.adminManualMarginAmount ?? target.adminManualMarginAmount,
          adminMarginMode: vSnap.adminMarginMode ?? vSnap.pricingSnapshot?.adminMarginMode ?? target.adminMarginMode,
          revisedSellingPrice: vSnap.revisedSellingPrice ?? vSnap.pricingSnapshot?.revisedSellingPrice ?? target.revisedSellingPrice,
          companyId: (vSnap as any).companyId ?? (target as any).companyId,
          agentAgency: (vSnap as any).agentAgency ?? target.agentAgency,
          agentId: vSnap.agentId ?? target.agentId,
          productLevelMarginEnabled: vSnap.productLevelMarginEnabled ?? target.productLevelMarginEnabled,
          agentLevelMarginPercent: vSnap.agentLevelMarginPercent ?? target.agentLevelMarginPercent,
          activeMarginMode: vSnap.activeMarginMode ?? target.activeMarginMode,
          agentMarginType: vSnap.agentMarginType ?? target.agentMarginType,
          agentMarginValue: vSnap.agentMarginValue ?? target.agentMarginValue,
          agentMarginAmount: vSnap.agentMarginAmount ?? target.agentMarginAmount,
          overallDiscountPercent: vSnap.overallDiscountPercent ?? target.overallDiscountPercent,
          totalSellingPrice: vSnap.totalSellingPrice ?? target.totalSellingPrice,
          finalCustomerSellingPrice: vSnap.totalSellingPrice ?? target.finalCustomerSellingPrice
        }
      : target;
    setRestoredFromVersion(undefined);
    setIsReadOnlyHistoricalMode(readOnlyHist);
    setLoadedIsLocked(Boolean(snapQuote.isLocked || readOnlyHist));
    setQuoteVersion(snapQuote.version || ver);
    setLatestSavedVersion(highestVer);
    setVersionCount(versions.length || 1);
    setAuthoritativeSavedQuote(snapQuote);
    setAutoSaveStatus('SAVED');
    if (snapQuote.clientName) setClientName(snapQuote.clientName);
    if (snapQuote.clientEmail !== undefined) setClientEmail(snapQuote.clientEmail || '');
    if (snapQuote.currency) setCurrency(snapQuote.currency);
    if (snapQuote.travelStartDate) setStartDate(snapQuote.travelStartDate);
    if (snapQuote.travelEndDate) setEndDate(snapQuote.travelEndDate);
    if (snapQuote.title) setQuoteTitle(snapQuote.title);
    if (snapQuote.items) setItems(snapQuote.items);
    if (snapQuote.routeHubs) handleUpdateRouteHubs(snapQuote.routeHubs);
    if (snapQuote.dayThemes) handleUpdateDayThemes(snapQuote.dayThemes);
    if (snapQuote.dayDescriptions) handleUpdateDayDescriptions(snapQuote.dayDescriptions);
    setAgentMarginType(snapQuote.agentMarginType || 'PERCENTAGE');
    const histAgentVal = Math.max(0, Number(snapQuote.agentMarginValue ?? snapQuote.overallMarkupPercent ?? 0) || 0);
    setAgentMarginValue(histAgentVal);
    setAgentMarkupPercent((snapQuote.agentMarginType || 'PERCENTAGE') === 'PERCENTAGE' ? histAgentVal : 0);
    setOverallDiscountPercent(Math.max(0, Number(snapQuote.overallDiscountPercent || 0) || 0));
    const histScope = (snapQuote.quotationScope as QuotationScope) || (snapQuote.scope as QuotationScope) || 'HOTEL_LAND';
    setQuotationScope(histScope);
    setContextQuotationScope(histScope === 'LAND_ONLY' ? 'LAND_ONLY' : 'HOTEL_LAND');
    setBrandingMode(snapQuote.brandingMode || snapQuote.brandingSnapshot?.mode || 'STANDARD');
    setAdminManualMarginType(snapQuote.adminManualMarginType === 'FIXED' ? 'FIXED' : 'PERCENTAGE');
    setAdminManualMarginValue(Math.max(0, Number(snapQuote.adminManualMarginValue ?? 0) || 0));
    setAdminMarginMode(snapQuote.adminMarginMode === 'REPLACE' ? 'REPLACE' : 'ADD');
    setQuoteCompanyId((snapQuote as any).companyId || undefined);
    setQuoteAgentId(snapQuote.agentId || snapQuote.createdBy || undefined);
    setQuoteAgentAgency(snapQuote.agentAgency || undefined);
    setQuoteProductLevelMarginEnabled(
      snapQuote.productLevelMarginEnabled !== undefined
        ? Boolean(snapQuote.productLevelMarginEnabled)
        : (snapQuote.activeMarginMode ? snapQuote.activeMarginMode === 'PRODUCT_LEVEL' : undefined)
    );
    setQuoteAgentLevelMarginPercent(
      typeof snapQuote.agentLevelMarginPercent === 'number' ? snapQuote.agentLevelMarginPercent : undefined
    );
    pendingBaselineCommitRef.current = true;
  };

  // Balance Nights Helper
  const handleAutoBalanceNights = () => {
    if (routeHubs.length === 0) return;
    handleUpdateRouteHubs(prev => {
      if (prev.length === 0) return prev;
      const count = prev.length;
      const baseNights = Math.floor(tripNights / count);
      const remainder = tripNights % count;
      return prev.map((hub, idx) => ({
        ...hub,
        nights: idx === 0 ? baseNights + remainder : baseNights
      }));
    });
  };

  // Add Hub to Route (Repeated hubs are always permitted; each occurrence gets a unique itineraryHubOccurrenceId)
  const handleAddHubToRoute = (hubId: string) => {
    const hub = destinationHubs.find(h => h.id === hubId);
    if (!hub) return;
    const uid = `rhub-${Date.now()}-${++nextHubUidRef.current}`;
    handleUpdateRouteHubs(prev => [
      ...prev,
      {
        id: uid,
        itineraryHubOccurrenceId: uid,
        hubId: hub.id,
        hubName: hub.hubName || hub.name,
        nights: 2,
        order: prev.length + 1,
        notes: `Stay in ${hub.hubName || hub.name}`
      }
    ]);
  };

  // Remove Hub from Route (removes only the deleted occurrence and its linked hotel items)
  const handleDeleteHubOccurrenceItems = useCallback((deletedHub: TripRouteHub, currentHubsSnapshot?: TripRouteHub[]) => {
    const hubsRef = currentHubsSnapshot || routeHubs;
    const toRemove = items.filter(it => doesHotelItemBelongToHubOccurrence(it, deletedHub, hubsRef));
    toRemove.forEach(it => removeProductFromQuote(it.id));
  }, [items, routeHubs, removeProductFromQuote]);

  const handleRemoveHubFromRoute = (hubId: string) => {
    const targetHub = routeHubs.find(h => h.id === hubId || getHubOccurrenceId(h) === hubId);
    if (targetHub) {
      handleDeleteHubOccurrenceItems(targetHub, routeHubs);
    }
    handleUpdateRouteHubs(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter(h => h.id !== hubId && getHubOccurrenceId(h) !== hubId).map((h, idx) => ({ ...h, order: idx + 1 }));
    });
  };

  // Sync linked hotel QuoteItems when a specific hub occurrence's nights or stay dates change
  const handleSyncHubStayToHotelItems = useCallback((updatedHub: TripRouteHub, nextHubsList: TripRouteHub[]) => {
    const dates = computeStayDatesForHub(nextHubsList, getHubOccurrenceId(updatedHub), startDate, updatedHub.nights);
    const matchingIds = new Set(
      items.filter(it => doesHotelItemBelongToHubOccurrence(it, updatedHub, nextHubsList)).map(it => it.id)
    );
    if (matchingIds.size === 0) return;

    const syncedItems = items.map(it => {
      if (!matchingIds.has(it.id)) return it;
      const nextNights = Math.max(1, updatedHub.nights || dates.nights || 1);
      const nextManual = it.manualHotelDetails
        ? {
            ...it.manualHotelDetails,
            numberOfNights: nextNights,
            nights: nextNights,
            checkInDate: dates.checkInIso,
            checkOutDate: dates.checkOutIso
          }
        : it.manualHotelDetails;
      return {
        ...it,
        nights: nextNights,
        travelDate: dates.checkInIso,
        checkInDate: dates.checkInIso,
        checkOutDate: dates.checkOutIso,
        manualHotelDetails: nextManual
      };
    });

    const { updatedItems } = recalculateItemsWithLatestTariffs(
      syncedItems,
      adultsCount,
      childrenCount,
      infantsCount,
      currency,
      0
    );
    setItems(updatedItems);
  }, [items, startDate, recalculateItemsWithLatestTariffs, adultsCount, childrenCount, infantsCount, currency, setItems]);

  // Adjust Hub Nights
  const handleAdjustHubNights = (hubId: string, delta: number) => {
    let updatedHubSnapshot: TripRouteHub | null = null;
    const nextHubs = routeHubs.map(h => {
      if (h.id === hubId || getHubOccurrenceId(h) === hubId) {
        const updatedNights = Math.max(1, (h.nights || 1) + delta);
        let nextCheckOut = h.checkOutDate;
        if (h.checkInDate) {
          const ci = new Date(h.checkInDate);
          if (!isNaN(ci.getTime())) {
            ci.setDate(ci.getDate() + updatedNights);
            nextCheckOut = ci.toISOString().split('T')[0];
          }
        }
        updatedHubSnapshot = {
          ...h,
          nights: updatedNights,
          ...(nextCheckOut ? { checkOutDate: nextCheckOut } : {})
        };
        return updatedHubSnapshot;
      }
      return h;
    });
    handleUpdateRouteHubs(nextHubs);
    if (updatedHubSnapshot) {
      handleSyncHubStayToHotelItems(updatedHubSnapshot, nextHubs);
    }
  };

  // Helper to compute check-in / check-out dates for a specific hub occurrence (supports hubId or numeric order)
  const getHubDates = useCallback((hubIdOrOrder: string | number, hubNights?: number) => {
    return computeStayDatesForHub(routeHubs, hubIdOrOrder, startDate, hubNights);
  }, [routeHubs, startDate]);

  // Helper to remove hotel stay for a specific hub occurrence (sets hub to NO_ACCOMMODATION without touching sibling hubs)
  const handleRemoveHotelForHub = (hubId: string) => {
    const targetHub = routeHubs.find(h => h.id === hubId || getHubOccurrenceId(h) === hubId);
    if (!targetHub) return;

    // Strictly remove matching hotel items ONLY for this occurrence
    const matchingItems = items.filter(it => doesHotelItemBelongToHubOccurrence(it, targetHub, routeHubs));
    matchingItems.forEach(it => removeProductFromQuote(it.id));

    handleUpdateRouteHubs(prev =>
      prev.map(h => (h.id === targetHub.id ? {
        ...h,
        hotelId: undefined,
        roomTypeId: undefined,
        roomsCount: undefined,
        accommodationStayId: undefined,
        roomConfiguration: undefined,
        isManualHotel: false,
        manualHotel: undefined,
        accommodationType: 'NO_ACCOMMODATION',
        overriddenByLandOnly: false
      } : h))
    );
  };

  // Add or Update Hotel Stay for a Specific Hub Occurrence (supports unique hub.id or order)
  const handleSelectHotelForHub = (
    hubIdOrOrder: string | number, 
    hotel: Hotel | null, 
    roomTypeId?: string, 
    roomsCount: number = 1
  ) => {
    const targetHub =
      typeof hubIdOrOrder === 'string'
        ? routeHubs.find(h => h.id === hubIdOrOrder || getHubOccurrenceId(h) === hubIdOrOrder)
        : routeHubs.find(h => h.order === hubIdOrOrder);
    if (!targetHub) return;

    const targetOccId = getHubOccurrenceId(targetHub);

    if (!hotel) {
      handleRemoveHotelForHub(targetHub.id);
      return;
    }

    // Calculate dates strictly for this hub occurrence
    const { checkInIso, checkOutIso } = getHubDates(targetOccId, targetHub.nights || 1);

    // Selected room type and rate
    const selectedRoom = hotel.roomTypes?.find(r => r.id === roomTypeId) || hotel.roomTypes?.[0];
    const selectedRate = selectedRoom?.rates?.[0];

    const nights = targetHub.nights || 1;
    const safeRooms = Math.max(1, roomsCount || 1);
    const stayId = targetHub.accommodationStayId || generateAccommodationStayId(targetOccId);

    // Strictly remove existing hotel items ONLY for this hub occurrence
    const existingHotelItems = items.filter(it =>
      doesHotelItemBelongToHubOccurrence(it, targetHub, routeHubs)
    );
    existingHotelItems.forEach(it => removeProductFromQuote(it.id));

    // Validate occupancy for current passenger counts
    const occupancy = validateRoomOccupancy(selectedRoom, safeRooms, adultsCount, childrenCount, infantsCount);

    if (occupancy.isValid) {
      const hotelProduct = hotelToProduct(hotel, selectedRoom, selectedRate, nights, safeRooms);
      
      addProductToQuote(hotelProduct, {
        adults: adultsCount,
        children: childrenCount,
        infants: infantsCount,
        travelDate: checkInIso,
        hubId: targetHub.id,
        itineraryHubOccurrenceId: targetOccId,
        accommodationStayId: stayId,
        hotelId: hotel.id,
        roomTypeId: selectedRoom?.id,
        mealPlanCode: selectedRate?.mealPlanCode,
        roomsCount: safeRooms,
        nights,
        checkInDate: checkInIso,
        checkOutDate: checkOutIso,
        isManualHotel: false,
        accommodationType: 'hotel',
        configuration_snapshot: {
          roomTypeId: selectedRoom?.id,
          roomTypeName: selectedRoom?.roomName,
          mealPlanName: selectedRate?.mealPlanName,
          roomsCount: safeRooms,
          nights,
          itineraryHubOccurrenceId: targetOccId,
          accommodationStayId: stayId
        },
        notes: `${hotel.name} • ${selectedRoom?.roomName || 'Luxury Room'} • ${safeRooms} ${safeRooms > 1 ? 'Rooms' : 'Room'} • ${nights} Nights in ${targetHub.hubName} [Stay #${targetHub.order} | Check-in: ${checkInIso}, Check-out: ${checkOutIso}]`,
        openDrawer: false
      });
    }

    const roomConfiguration = {
      roomTypeId: selectedRoom?.id,
      roomTypeName: selectedRoom?.roomName,
      roomsCount: safeRooms,
      mealPlanCode: selectedRate?.mealPlanCode,
      mealPlanName: selectedRate?.mealPlanName,
      adults: adultsCount,
      children: childrenCount,
      infants: infantsCount
    };

    // Update ONLY this hub occurrence state
    handleUpdateRouteHubs(prev =>
      prev.map(h => (h.id === targetHub.id ? { 
        ...h,
        itineraryHubOccurrenceId: targetOccId,
        accommodationStayId: stayId,
        hotelId: hotel.id, 
        roomTypeId: selectedRoom?.id,
        mealPlanCode: selectedRate?.mealPlanCode,
        mealPlan: selectedRate?.mealPlanName,
        roomsCount: safeRooms,
        roomConfiguration,
        checkInDate: checkInIso,
        checkOutDate: checkOutIso,
        isManualHotel: false,
        accommodationType: 'hotel',
        overriddenByLandOnly: false,
        manualHotel: undefined,
        savedAccommodationSnapshot: {
          accommodationType: 'hotel',
          hotelId: hotel.id,
          roomTypeId: selectedRoom?.id,
          roomsCount: safeRooms,
          isManualHotel: false
        }
      } : h))
    );
  };

  // Open Add Manual Hotel Modal
  const handleOpenAddManualHotel = (hubId?: string) => {
    const targetHub = routeHubs.find(h => h.id === hubId || getHubOccurrenceId(h) === hubId) || routeHubs[0];
    setManualHotelModalHubId(targetHub?.id);
    setManualHotelModalInitialData(targetHub?.manualHotel || targetHub?.savedAccommodationSnapshot?.manualHotel || null);
    setIsManualHotelModalOpen(true);
  };

  // Open Edit Manual Hotel Modal
  const handleOpenEditManualHotel = (hubId: string) => {
    const targetHub = routeHubs.find(h => h.id === hubId || getHubOccurrenceId(h) === hubId);
    if (!targetHub) return;
    setManualHotelModalHubId(targetHub.id);
    setManualHotelModalInitialData(targetHub.manualHotel || targetHub.savedAccommodationSnapshot?.manualHotel || null);
    setIsManualHotelModalOpen(true);
  };

  // Save Manual Hotel & Rate (Strictly scoped to one itinerary hub occurrence)
  const handleSaveManualHotel = (manualData: ManualHotelDetails) => {
    const explicitId = manualData.itineraryHubOccurrenceId || manualData.hubId;
    const targetHub =
      (explicitId
        ? routeHubs.find(h => h.id === explicitId || getHubOccurrenceId(h) === explicitId)
        : routeHubs.find(h => h.hubName.toLowerCase() === manualData.city.toLowerCase())) ||
      routeHubs[0];
    if (!targetHub) return;

    const targetOccId = getHubOccurrenceId(targetHub);
    const stayId = manualData.accommodationStayId || targetHub.accommodationStayId || generateAccommodationStayId(targetOccId);

    const normalizedManualData: ManualHotelDetails = {
      ...manualData,
      hubId: targetHub.id,
      itineraryHubOccurrenceId: targetOccId,
      accommodationStayId: stayId
    };

    // 1. Strictly remove previous hotel items ONLY for this hub occurrence
    const existingHotelItems = items.filter(it =>
      doesHotelItemBelongToHubOccurrence(it, targetHub, routeHubs)
    );
    existingHotelItems.forEach(it => removeProductFromQuote(it.id));

    // 2. Convert manual details into a standardized Product object
    const hotelProduct = manualHotelToProduct(normalizedManualData, currentDestination);

    // 3. Add to quotation items
    const mealDesc = normalizedManualData.mealPlanName || normalizedManualData.mealPlan;
    const stayNote = `${normalizedManualData.hotelName} [Manual Accommodation] • ${normalizedManualData.roomType} • ${normalizedManualData.numberOfRooms} ${(normalizedManualData.numberOfRooms || 1) > 1 ? 'Rooms' : 'Room'} • ${normalizedManualData.numberOfNights} Nights in ${targetHub.hubName} (${mealDesc}) [Stay #${targetHub.order} | Check-in: ${normalizedManualData.checkInDate}, Check-out: ${normalizedManualData.checkOutDate}]`;

    addProductToQuote(hotelProduct, {
      adults: adultsCount,
      children: childrenCount,
      infants: infantsCount,
      travelDate: normalizedManualData.checkInDate,
      hubId: targetHub.id,
      itineraryHubOccurrenceId: targetOccId,
      accommodationStayId: stayId,
      hotelId: hotelProduct.id,
      roomTypeId: 'manual-room',
      mealPlanCode: normalizedManualData.mealPlan,
      roomsCount: normalizedManualData.numberOfRooms,
      nights: normalizedManualData.numberOfNights,
      checkInDate: normalizedManualData.checkInDate,
      checkOutDate: normalizedManualData.checkOutDate,
      isManualHotel: true,
      manualHotelDetails: normalizedManualData,
      accommodationType: 'manual',
      notes: stayNote,
      openDrawer: false
    });

    const roomConfiguration = {
      roomTypeId: 'manual-room',
      roomTypeName: normalizedManualData.roomType,
      roomsCount: normalizedManualData.numberOfRooms || 1,
      mealPlanCode: normalizedManualData.mealPlan,
      mealPlanName: normalizedManualData.mealPlanName || String(normalizedManualData.mealPlan),
      adults: adultsCount,
      children: childrenCount,
      infants: infantsCount
    };

    // 4. Update ONLY this hub occurrence in routeHubs
    handleUpdateRouteHubs(prev =>
      prev.map(h => {
        if (h.id === targetHub.id) {
          return {
            ...h,
            itineraryHubOccurrenceId: targetOccId,
            accommodationStayId: stayId,
            hotelId: hotelProduct.id,
            roomTypeId: 'manual-room',
            roomsCount: normalizedManualData.numberOfRooms,
            nights: normalizedManualData.numberOfNights || h.nights,
            checkInDate: normalizedManualData.checkInDate,
            checkOutDate: normalizedManualData.checkOutDate,
            roomConfiguration,
            isManualHotel: true,
            accommodationType: 'manual',
            overriddenByLandOnly: false,
            manualHotel: normalizedManualData,
            savedAccommodationSnapshot: {
              accommodationType: 'manual',
              hotelId: hotelProduct.id,
              roomTypeId: 'manual-room',
              roomsCount: normalizedManualData.numberOfRooms,
              isManualHotel: true,
              manualHotel: normalizedManualData
            }
          };
        }
        return h;
      })
    );
  };

  // Remove Manual Hotel Stay ONLY for a Specific Hub Occurrence
  const handleRemoveManualHotel = (hubId: string) => {
    const targetHub = routeHubs.find(h => h.id === hubId || getHubOccurrenceId(h) === hubId);
    if (!targetHub) return;

    const matchingItems = items.filter(it =>
      doesHotelItemBelongToHubOccurrence(it, targetHub, routeHubs)
    );
    matchingItems.forEach(it => removeProductFromQuote(it.id));

    handleUpdateRouteHubs(prev =>
      prev.map(h => (h.id === targetHub.id ? { 
        ...h, 
        hotelId: undefined, 
        roomTypeId: undefined, 
        roomsCount: undefined,
        accommodationStayId: undefined,
        roomConfiguration: undefined,
        isManualHotel: undefined,
        accommodationType: 'NO_ACCOMMODATION',
        overriddenByLandOnly: false,
        manualHotel: undefined
      } : h))
    );
  };

  // Open Dedicated Configurator for Service Item (Hotel -> Hotel Configurator, Rail -> Shinkansen Configurator, Activity -> Activity Configurator)
  const handleOpenEditItem = useCallback((item: QuoteItem) => {
    if (isRailQuoteItem(item) || isRailProduct(item.product) || item.railJourneyDetails || (item.product.category || '').toLowerCase() === 'rail') {
      setEditingRailItem(item);
    } else {
      setEditingServiceItem(item);
    }
  }, []);

  // Validate that all items have valid exchange rates and live tariffs before final quote generation
  const validateFxBeforeFinalGeneration = (): boolean => {
    if (packagePricingStatus === 'CALCULATING') {
      showBuilderToast('Live wholesale tariffs are currently calculating. Please wait a moment...', 'WARNING');
      return false;
    }
    if (packagePricingStatus === 'ERROR') {
      showBuilderToast('Cannot generate quote: live pricing calculation encountered an error. Please retry tariffs.', 'WARNING');
      return false;
    }
    const missingPairs = new Set<string>(step7InternalBreakdown?.missingCurrencyPairs || []);
    effectivePricedItems.forEach(it => {
      const fx = it.calculation?.fxDetails;
      if (fx && fx.isValid === false) {
        missingPairs.add(fx.rateDirection || `${fx.sourceCurrency} -> ${fx.targetCurrency}`);
      }
    });
    if (missingPairs.size > 0) {
      showBuilderToast(
        `Missing or unavailable exchange rate for ${Array.from(missingPairs).join(', ')}. Final quote generation is blocked until a valid rate is available.`,
        'WARNING'
      );
      return false;
    }
    return true;
  };

  // =========================================================================
  // DESTINATION-WISE COMMERCIAL QUOTATION TERMS RESOLUTION & ENFORCEMENT
  // =========================================================================
  const canManageDestinationTerms = Boolean(
    user &&
    (user.role === 'ADMIN' ||
      (user as any).role === 'SUPER_ADMIN' ||
      user.role === 'DMC_STAFF' ||
      (user.role === 'TEAM_MEMBER' && user.permissions?.cmsContent?.enabled !== false))
  );
  const isAdminTermsApprover = Boolean(
    user &&
    (user.role === 'ADMIN' || (user as any).role === 'SUPER_ADMIN' || user.role === 'DMC_STAFF')
  );

  const extractedTermsTargets = useMemo(() => {
    return destinationTermsService.extractQuotationDestinationTargets({
      destinationId: currentDestination?.id,
      destinationName: currentDestination?.name,
      routeHubs,
      items
    });
  }, [currentDestination?.id, currentDestination?.name, routeHubs, items]);

  const termsTargetSignature = useMemo(() => {
    return extractedTermsTargets.map((t) => t.targetId).join('|');
  }, [extractedTermsTargets]);

  const isQuoteTermsFinalised = Boolean(
    loadedFinalisedSnapshot &&
    loadedFinalisedSnapshot.entries.length > 0 &&
    (loadedIsLocked ||
      loadedQuoteStatus === 'ISSUED' ||
      loadedQuoteStatus === 'SENT' ||
      loadedQuoteStatus === 'APPROVED' ||
      loadedQuoteStatus === 'ACCEPTED' ||
      loadedQuoteStatus === 'CONVERTED')
  );

  // Targeted Firestore read ONLY for newly added destination(s) / route hubs (prevents loading-spinner flicker on hub edits)
  useEffect(() => {
    if (isQuoteTermsFinalised) return;
    let cancelled = false;
    const targetIds = extractedTermsTargets.map((t) => t.targetId);
    if (targetIds.length === 0) return;

    const missingTargetIds = targetIds.filter(id => !loadedTermsTargetsRef.current.has(id));
    if (missingTargetIds.length === 0) return;

    setTermsSyncLoading(true);
    destinationTermsService
      .loadPublishedTermsForTargetsAsync(missingTargetIds)
      .then(() => {
        if (!cancelled) {
          missingTargetIds.forEach(id => loadedTermsTargetsRef.current.add(id));
          setTermsRefreshTick((n) => n + 1);
          setTermsSyncLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setTermsSyncLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [termsTargetSignature, isQuoteTermsFinalised]);

  // Listen for Admin CMS publication updates while a Draft quotation is open
  useEffect(() => {
    return destinationTermsService.subscribe(() => {
      if (isQuoteTermsFinalised) return;
      setHasDraftTermsUpdateAvailable(true);
      setTermsRefreshTick((n) => n + 1);
    });
  }, [isQuoteTermsFinalised]);

  // Clear stale Admin exception override whenever itinerary destinations change
  useEffect(() => {
    if (!termsExceptionApproval || isQuoteTermsFinalised) return;
    const targetIdSet = new Set(extractedTermsTargets.map((t) => t.targetId));
    const stillMatches = termsExceptionApproval.missingDestinationIds.some((id) => targetIdSet.has(id));
    if (!stillMatches) {
      setTermsExceptionApproval(undefined);
    }
  }, [termsTargetSignature, isQuoteTermsFinalised]);

  const termsResolution = useMemo<{
    isImmutableFrozen: boolean;
    readiness: DestinationTermsReadinessResult;
  }>(() => {
    if (isQuoteTermsFinalised && loadedFinalisedSnapshot) {
      return {
        isImmutableFrozen: true,
        readiness: {
          termsStatus: 'QUOTATION_FINALISED',
          canFinalise: true,
          canExportCompleteQuote: true,
          missingTargets: [],
          resolvedEntries: loadedFinalisedSnapshot.entries,
          snapshot: loadedFinalisedSnapshot
        }
      };
    }

    const readiness = destinationTermsService.evaluateQuotationCommercialTerms({
      quoteId: activeQuoteId,
      quoteVersion,
      destinationId: currentDestination?.id,
      destinationName: currentDestination?.name,
      routeHubs,
      items,
      user,
      isFinalised: false,
      termsExceptionApproval
    });

    return {
      isImmutableFrozen: false,
      readiness
    };
  }, [
    isQuoteTermsFinalised,
    loadedFinalisedSnapshot,
    activeQuoteId,
    quoteVersion,
    currentDestination?.id,
    currentDestination?.name,
    routeHubs,
    items,
    user,
    termsExceptionApproval,
    termsRefreshTick
  ]);

  const handleRefreshDraftTerms = useCallback(async () => {
    const targetIds = extractedTermsTargets.map((t) => t.targetId);
    if (targetIds.length === 0) return;
    setTermsSyncLoading(true);
    try {
      await destinationTermsService.loadPublishedTermsForTargetsAsync(targetIds, true);
      setHasDraftTermsUpdateAvailable(false);
      setTermsRefreshTick((n) => n + 1);
      showBuilderToast('Destination Commercial Quotation Terms refreshed from latest published CMS configuration.', 'SUCCESS');
    } finally {
      setTermsSyncLoading(false);
    }
  }, [extractedTermsTargets]);

  const handleNotifyAdminMissingTerms = useCallback(async () => {
    if (termsResolution.readiness.missingTargets.length === 0) return;
    await destinationTermsService.notifyAdminMissingTermsAsync({
      quoteId: activeQuoteId,
      quoteNumber,
      missingTargets: termsResolution.readiness.missingTargets,
      user
    });
    setAdminMissingTermsNotifiedKey(termsTargetSignature);
    showBuilderToast(
      `Admin notified to configure Commercial Quotation Terms for: ${termsResolution.readiness.missingTargets.map((m) => m.targetName).join(', ')}`,
      'SUCCESS'
    );
  }, [activeQuoteId, quoteNumber, termsResolution.readiness.missingTargets, termsTargetSignature, user]);

  const handleApproveTermsException = useCallback((reason: string) => {
    if (!isAdminTermsApprover) {
      showBuilderToast('Only Admins can approve a Commercial Quotation Terms exception.', 'WARNING');
      return;
    }
    const cleanReason = (reason || '').trim();
    if (cleanReason.length < 5) {
      showBuilderToast('Please enter a mandatory approval reason (minimum 5 characters).', 'WARNING');
      return;
    }
    const missing = termsResolution.readiness.missingTargets;
    const approval: QuotationTermsExceptionApproval = {
      approved: true,
      approvedBy: user?.name || user?.email || 'Admin',
      approvedByEmail: user?.email || undefined,
      approvedAt: new Date().toISOString(),
      reason: cleanReason,
      missingDestinationIds: missing.map((m) => m.targetId),
      missingDestinationNames: missing.map((m) => m.targetName)
    };
    setTermsExceptionApproval(approval);
    showBuilderToast('Admin exception approved for missing destination terms.', 'SUCCESS');
  }, [isAdminTermsApprover, termsResolution.readiness.missingTargets, user]);

  const validateTermsBeforeExportOrFinalise = (): boolean => {
    if (termsResolution.readiness.canExportCompleteQuote) return true;
    const missingNames = termsResolution.readiness.missingTargets.map((t) => t.targetName).join(', ');
    showBuilderToast(
      `Commercial Quotation Terms are not configured for: ${missingNames || currentDestination.name}. Configure destination terms or obtain Admin exception approval before exporting or finalising.`,
      'WARNING'
    );
    setActiveStepId(7);
    return false;
  };

  // Authoritative central draft builder for all 7 Output Options
  const buildActiveQuotationDraft = (modeOverride?: QuoteBrandingMode): Quotation => {
    const existingSaved = db.getQuoteByIdAuthorized(activeQuoteId, user);
    const activeBrandMode: QuoteBrandingMode = modeOverride || brandingMode;
    const brandSnap = buildAgencyBrandingSnapshotFromUser(user, existingSaved || authoritativeSavedQuote, activeBrandMode);
    const totalPaxCount = (adultsCount || 2) + (childrenCount || 0) + (infantsCount || 0);
    return {
      ...(existingSaved || {}),
      // Clear cached historical pricing snapshots on active draft so Save Draft & pricing engine compute from latest working state
      authoritativeSnapshot: undefined,
      pricingSnapshot: undefined,
      pricing_snapshot: undefined,
      currencyConversionSnapshot: undefined,
      currency_conversion_snapshot: undefined,
      id: activeQuoteId,
      quoteNumber,
      version: quoteVersion || existingSaved?.version || 1,
      title: quoteTitle || (sourcePackageName ? `${sourcePackageName} (${tripNights} Nights)` : `${currentDestination.name} Bespoke Journey (${tripNights} Nights)`),
      destination: currentDestination.name,
      sourcePackageId: sourcePackageId || undefined,
      sourcePackageName: sourcePackageName || undefined,
      activeOptionId: `opt-${activeOptionTab}`,
      quotationScope: quotationScope === 'LAND_ONLY' ? 'LAND_ONLY' : 'HOTEL_LAND',
      scope: quotationScope,
      items: effectivePricedItems,
      currency,
      overallMarkupPercent: agentMarginType === 'PERCENTAGE' ? agentMarginValue : 0,
      overallDiscountPercent: overallDiscountPercent || 0,
      totalNetCost: canViewInternalCosts && liveQuoteBreakdown?.isComplete ? liveQuoteBreakdown.totalNettCost : 0,
      totalSellingPrice: finalCustomerSellingPrice,
      totalTaxes: canViewInternalCosts && liveQuoteBreakdown ? liveQuoteBreakdown.taxAmount : 0,
      totalMargin: canViewInternalCosts && liveQuoteBreakdown ? liveQuoteBreakdown.totalMargin : additionalMarginAmount,
      theUnboundBaseSellingPrice: baseFinalSellingPrice,
      baseFinalSellingPrice,
      base_final_selling_price: baseFinalSellingPrice,
      baseFinalSellingPriceCurrency: currency,
      base_final_selling_price_currency: currency,
      ...(canViewInternalCosts
        ? {
            adminManualMarginType,
            admin_manual_margin_type: adminManualMarginType,
            adminManualMarginValue,
            admin_manual_margin_value: adminManualMarginValue,
            adminManualMarginAmount: liveQuoteBreakdown?.adminManualMarginAmount ?? 0,
            admin_manual_margin_amount: liveQuoteBreakdown?.adminManualMarginAmount ?? 0,
            adminMarginMode,
            admin_margin_mode: adminMarginMode,
            revisedSellingPrice: liveQuoteBreakdown?.revisedSellingPrice ?? baseFinalSellingPrice,
            revised_selling_price: liveQuoteBreakdown?.revisedSellingPrice ?? baseFinalSellingPrice
          }
        : {}),
      agentMarginType,
      agent_margin_type: agentMarginType,
      agentMarginValue,
      agent_margin_value: agentMarginValue,
      agentMarginAmount: additionalMarginAmount,
      agent_margin_amount: additionalMarginAmount,
      productLevelAgentMarkupTotal: liveQuoteBreakdown?.productLevelAgentMarkupTotal ?? 0,
      overallAgentMarkupAmount: liveQuoteBreakdown?.overallAgentMarkupAmount ?? additionalMarginAmount,
      totalAgentAdditionalMarkupAmount: additionalMarginAmount,
      finalCustomerSellingPrice,
      final_customer_selling_price: finalCustomerSellingPrice,
      surchargesTotal: liveQuoteBreakdown?.surchargesTotal,
      appliedSurcharges: liveQuoteBreakdown?.appliedSurcharges,
      clientName: clientName || 'Client Name Pending',
      clientEmail: clientEmail || 'client@example.com',
      clientPhone: clientPhone || '',
      clientCompany: clientCompany || user?.agencyName || 'Direct B2B Client',
      companyId: quoteAgencyContext.companyId ?? (existingSaved as any)?.companyId,
      agentId: quoteAgentId || existingSaved?.agentId || existingSaved?.createdBy || user?.id || 'usr-agent-01',
      agentName: existingSaved?.agentName || (brandSnap as any).specialistName || brandSnap.agencyName || user?.name || 'Travel Consultant',
      agentAgency: quoteAgentAgency || existingSaved?.agentAgency || brandSnap.agencyName || user?.agencyName || 'Partner Agency',
      ...(canViewInternalCosts
        ? {
            productLevelMarginEnabled: isProductLevelMarginActive,
            agentLevelMarginPercent: agencyPricingSettings.agentLevelMarginPercent,
            activeMarginMode: agencyPricingSettings.activeMarginMode
          }
        : {}),
      agentEmail: existingSaved?.agentEmail || brandSnap.email || user?.email || '',
      agentPhone: existingSaved?.agentPhone || brandSnap.phone || user?.phone || '',
      agentLogoUrl: brandSnap.logoUrl || user?.brandLogoUrl,
      brandingMode: activeBrandMode,
      brandingSnapshot: brandSnap,
      agentNotes: agentNotes || '',
      termsStatus: termsResolution.readiness.termsStatus,
      commercialTermsSnapshot: termsResolution.readiness.snapshot,
      missingTermsDestinations: termsResolution.readiness.missingTargets,
      termsExceptionApproval,
      termsAndConditions: termsResolution.readiness.snapshot.combinedPlainText || COMMERCIAL_QUOTATION_TERMS_PLAIN_TEXT,
      status: existingSaved?.isLocked ? existingSaved.status : (loadedQuoteStatus || 'DRAFT'),
      isLocked: existingSaved?.isLocked ?? loadedIsLocked,
      travelStartDate: startDate,
      travelEndDate: endDate,
      totalPax: totalPaxCount,
      adultsCount,
      childrenCount,
      infantsCount,
      childAges,
      nationality,
      travelStyle,
      mealPlanPreference,
      roomingConfig: {
        roomsCount: roomingConfig.roomsCount || 1,
        adultsPerRoom: Math.max(1, Math.ceil((adultsCount || 2) / (roomingConfig.roomsCount || 1))),
        cwbPerRoom: 0,
        cnbPerRoom: 0,
        infPerRoom: 0,
        extraBed: Boolean(roomingConfig.extraBedRequired)
      },
      passengerBreakdown: passengerClassification,
      visaAssistanceChoice,
      feasibilityScore: feasibility.score,
      options: computedQuotationOptions,
      createdAt: existingSaved?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      validUntil: existingSaved?.validUntil || new Date(Date.now() + 14 * 86400000).toISOString(),
      leadId: selectedLeadId || '',
      linkedLeadId: selectedLeadId || undefined,
      routeHubs,
      dayThemes,
      dayDescriptions,
      dayOverviews,
      dayNotes,
      itineraryOverview: itineraryOverview || undefined,
      narrative: itineraryOverview || undefined,
      inclusions: contextInclusions && contextInclusions.length > 0 ? contextInclusions : undefined,
      exclusions: contextExclusions && contextExclusions.length > 0 ? contextExclusions : undefined,
      importantInformation: contextImportantInformation || undefined,
      cancellationPolicy: contextCancellationPolicy || undefined,
      generationHistory: authoritativeSavedQuote?.generationHistory || existingSaved?.generationHistory || []
    };
  };

  const getOutputActionLabel = (opt: QuotationOutputOptionKey): string => {
    switch (opt) {
      case 'PREVIEW_PROPOSAL': return 'Preview Client Proposal';
      case 'DOWNLOAD_PDF': return 'Download PDF Itinerary';
      case 'SEND_EMAIL': return 'Send Proposal via Email';
      case 'SHARE_WHATSAPP': return 'Share via WhatsApp';
      case 'SAVE_MASTER_PACKAGE': return 'Save as Master Package';
      case 'CONVERT_BOOKING': return 'Convert to Confirmed Booking';
      default: return 'Save Quotation Draft';
    }
  };

  // Strict non-mutating output resolver: NEVER silently saves dirty working edits or bumps version.
  const runOutputWithAuthoritativeSnapshot = async (
    outputOption: QuotationOutputOptionKey,
    onResolved: (readyQuote: Quotation) => void | Promise<void>
  ): Promise<void> => {
    if (isReadOnlyHistoricalMode && authoritativeSavedQuote) {
      const activeSnap =
        authoritativeSavedQuote.brandingMode === brandingMode
          ? authoritativeSavedQuote
          : {
              ...authoritativeSavedQuote,
              brandingMode,
              brandingSnapshot: buildAgencyBrandingSnapshotFromUser(user, authoritativeSavedQuote, brandingMode)
            };
      await onResolved(activeSnap);
      return;
    }

    if (!hasExplicitlySaved || hasUnsavedChanges || !authoritativeSavedQuote) {
      setPendingOutputRequest({
        option: outputOption,
        label: getOutputActionLabel(outputOption),
        onResolved
      });
      return;
    }

    setOutputBusyOption(outputOption);
    setOutputSyncError(null);
    try {
      let baseSaved = db.getQuoteByIdAuthorized(authoritativeSavedQuote.id, user) || authoritativeSavedQuote;
      const baseNeedsHydration =
        !baseSaved.items ||
        baseSaved.items.length === 0 ||
        baseSaved.items.some((it: any) => Boolean(it?.__dehydratedToVersionId)) ||
        (baseSaved.options || []).some((o: any) => Boolean((o as any)?.__dehydratedToVersionId));
      if ((baseSaved.masterHydratedFromVersionId || baseSaved.latestVersionId) && baseNeedsHydration) {
        const hydrateVerRef = baseSaved.masterHydratedFromVersionId || baseSaved.latestVersionId || Number(baseSaved.latestVersion || baseSaved.version || 1);
        baseSaved = (await withBoundedTimeout(
          db.hydrateMasterQuotationFromVersionAsync(baseSaved.id, hydrateVerRef, user),
          15000,
          'Hydrate Quotation Snapshot'
        )) || baseSaved;
      }
      const effectiveMode = brandingMode || baseSaved.brandingMode || 'STANDARD';
      const brandSnap =
        baseSaved.brandingSnapshot?.mode === effectiveMode
          ? baseSaved.brandingSnapshot
          : buildAgencyBrandingSnapshotFromUser(user, baseSaved, effectiveMode);

      const snapshotCandidate: Quotation = {
        ...baseSaved,
        activeOptionId: `opt-${activeOptionTab}`,
        brandingMode: effectiveMode,
        brandingSnapshot: brandSnap
      };

      const targetVerNum = latestSavedVersion || baseSaved.version || 1;
      const candProductMarkupTotal = Number(snapshotCandidate.productLevelAgentMarkupTotal ?? 0);
      const snapProductMarkupTotal = Number(snapshotCandidate.authoritativeSnapshot?.pricing?.productLevelAgentMarkupTotal ?? 0);
      const canReuseCachedOutputSnap = Boolean(
        snapshotCandidate.authoritativeSnapshot &&
          snapshotCandidate.brandingMode === baseSaved.brandingMode &&
          snapshotCandidate.authoritativeSnapshot.pricing?.currency === snapshotCandidate.currency &&
          Number(snapshotCandidate.authoritativeSnapshot.versionNumber || targetVerNum) === Number(targetVerNum) &&
          (!snapshotCandidate.activeOptionId || !snapshotCandidate.authoritativeSnapshot.selectedOptionId || snapshotCandidate.authoritativeSnapshot.selectedOptionId === snapshotCandidate.activeOptionId) &&
          (snapshotCandidate.isLocked ||
            (
              snapshotCandidate.authoritativeSnapshot.itinerary?.itemsCount === (snapshotCandidate.items || []).length &&
              (snapshotCandidate.authoritativeSnapshot.pricing?.agentMarginType || 'PERCENTAGE') === (snapshotCandidate.agentMarginType || 'PERCENTAGE') &&
              Math.abs(Number(snapshotCandidate.authoritativeSnapshot.pricing?.agentMarginValue ?? 0) - Number(snapshotCandidate.agentMarginValue ?? 0)) < 0.0001 &&
              Math.abs(Number(snapshotCandidate.authoritativeSnapshot.pricing?.overallDiscountPercent ?? 0) - Number(snapshotCandidate.overallDiscountPercent ?? 0)) < 0.0001 &&
              Math.abs(candProductMarkupTotal - snapProductMarkupTotal) < 0.05 &&
              (snapshotCandidate.authoritativeSnapshot.pricing?.adminMarginMode ?? 'ADD') === (snapshotCandidate.adminMarginMode ?? 'ADD') &&
              (snapshotCandidate.authoritativeSnapshot.pricing?.adminManualMarginType ?? 'PERCENTAGE') === (snapshotCandidate.adminManualMarginType ?? 'PERCENTAGE') &&
              Math.abs(Number(snapshotCandidate.authoritativeSnapshot.pricing?.adminManualMarginValue ?? 0) - Number(snapshotCandidate.adminManualMarginValue ?? 0)) < 0.0001 &&
              (!snapshotCandidate.authoritativeSnapshot.pricing?.activeMarginMode ||
                snapshotCandidate.authoritativeSnapshot.pricing.activeMarginMode === (snapshotCandidate.activeMarginMode || quoteAgencyContext.activeMarginMode)) &&
              JSON.stringify(snapshotCandidate.surchargeOverrides || []) === JSON.stringify(snapshotCandidate.authoritativeSnapshot.pricing?.surchargeOverrides || [])
            ))
      );
      const builtSnap = canReuseCachedOutputSnap
        ? snapshotCandidate.authoritativeSnapshot!
        : buildAuthoritativeQuotationSnapshot(snapshotCandidate, {
            existingSaved: baseSaved,
            versionNumber: targetVerNum,
            selectedOptionIndexOrId: `opt-${activeOptionTab}`,
            brandingMode: effectiveMode,
            user,
            preserveExistingPricingIfLocked: Boolean(baseSaved.isLocked)
          });

      const preparedQuote: Quotation = {
        ...snapshotCandidate,
        snapshotHash: builtSnap.snapshotHash,
        snapshotVersion: builtSnap.versionNumber,
        authoritativeSnapshot: builtSnap
      };

      const report = validateQuotationOutputConsistency(preparedQuote, {
        selectedOptionIndexOrId: preparedQuote.activeOptionId,
        brandingMode: effectiveMode
      });
      if (!report.isValid) {
        const msg = `Synchronisation check blocked ${getOutputActionLabel(outputOption)}: ${report.mismatches[0]}`;
        setOutputSyncError(msg);
        showBuilderToast(msg, 'WARNING');
        return;
      }
      await onResolved(preparedQuote);
    } catch (err: any) {
      const msg = err?.message || `Failed to prepare quotation snapshot for ${outputOption}.`;
      setOutputSyncError(msg);
      showBuilderToast(msg, 'WARNING');
    } finally {
      setOutputBusyOption(null);
    }
  };

  // Output Option 1: EXPLICIT "Save Draft" — ONLY action that creates a sequential immutable saved version (max + 1)
  const handleExplicitSaveDraft = async (): Promise<Quotation | null> => {
    if (isReadOnlyHistoricalMode) {
      showBuilderToast(
        `Viewing historical saved version v${quoteVersion} (read-only). Click "Restore v${quoteVersion} as Working Draft" to create a new version.`,
        'WARNING'
      );
      return null;
    }
    if (!hasExplicitlySaved && !inventoryVisibilityService.isDestinationActiveForB2B(currentDestination)) {
      showBuilderToast(
        `Cannot save a new quotation for non-active destination "${currentDestination.name}". Please select an Active destination.`,
        'WARNING'
      );
      return null;
    }
    if (isExplicitSavingRef.current) {
      return null;
    }

    isExplicitSavingRef.current = true;
    setIsSavingExplicitly(true);
    setOutputBusyOption('SAVE_DRAFT');
    setOutputSyncError(null);
    setAutoSaveStatus('SAVING');
    setAutoSaveError(null);

    const savedHash = currentWorkingHash;
    const reuseSaveReq = pendingSaveRequestIdRef.current && pendingSaveRequestIdRef.current.workingHash === savedHash;
    const clientSaveRequestId = reuseSaveReq
      ? pendingSaveRequestIdRef.current!.requestId
      : `save-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    pendingSaveRequestIdRef.current = { workingHash: savedHash, requestId: clientSaveRequestId };

    const targetNextVersion = hasExplicitlySaved ? (Math.max(latestSavedVersion, quoteVersion) + 1) : 1;
    const saveOp = quotationOperationsService.startOperation({
      operationType: 'SAVE_DRAFT',
      quoteId: activeQuoteId,
      versionId: `v${targetNextVersion}`,
      uid: user?.id,
      idempotencyKey: clientSaveRequestId
    });

    try {
      const draft = buildActiveQuotationDraft();
      const existingSaved = hasExplicitlySaved ? (db.getQuoteByIdAuthorized(draft.id, user) || authoritativeSavedQuote) : null;

      const builtSnapshot = buildAuthoritativeQuotationSnapshot(
        {
          ...draft,
          version: targetNextVersion,
          versionNumber: targetNextVersion,
          snapshotVersion: targetNextVersion
        },
        {
          existingSaved,
          versionNumber: targetNextVersion,
          selectedOptionIndexOrId: `opt-${activeOptionTab}`,
          brandingMode,
          user,
          preserveExistingPricingIfLocked: false,
          recalculateIfDirty: true
        }
      );

      const enrichedDraft: Quotation = {
        ...draft,
        activeOptionId: builtSnapshot.selectedOptionId,
        brandingMode: builtSnapshot.branding.mode,
        brandingSnapshot: builtSnapshot.branding.snapshot,
        theUnboundBaseSellingPrice: builtSnapshot.pricing.theUnboundBaseSellingPrice,
        baseFinalSellingPrice: builtSnapshot.pricing.baseFinalSellingPrice,
        base_final_selling_price: builtSnapshot.pricing.baseFinalSellingPrice,
        agentMarginType: builtSnapshot.pricing.agentMarginType,
        agentMarginValue: builtSnapshot.pricing.agentMarginValue,
        agentMarginAmount: builtSnapshot.pricing.agentMarginAmount,
        productLevelAgentMarkupTotal: builtSnapshot.pricing.productLevelAgentMarkupTotal,
        overallAgentMarkupAmount: builtSnapshot.pricing.overallAgentMarkupAmount,
        totalAgentAdditionalMarkupAmount: builtSnapshot.pricing.totalAgentAdditionalMarkupAmount,
        ...(canViewInternalCosts && (builtSnapshot.pricing.adminMarginMode || builtSnapshot.pricing.adminManualMarginValue !== undefined)
          ? {
              adminManualMarginType: builtSnapshot.pricing.adminManualMarginType,
              admin_manual_margin_type: builtSnapshot.pricing.adminManualMarginType,
              adminManualMarginValue: builtSnapshot.pricing.adminManualMarginValue,
              admin_manual_margin_value: builtSnapshot.pricing.adminManualMarginValue,
              adminManualMarginAmount: builtSnapshot.pricing.adminManualMarginAmount,
              admin_manual_margin_amount: builtSnapshot.pricing.adminManualMarginAmount,
              adminMarginMode: builtSnapshot.pricing.adminMarginMode,
              admin_margin_mode: builtSnapshot.pricing.adminMarginMode,
              revisedSellingPrice: builtSnapshot.pricing.revisedSellingPrice,
              revised_selling_price: builtSnapshot.pricing.revisedSellingPrice
            }
          : {}),
        finalCustomerSellingPrice: builtSnapshot.pricing.finalCustomerSellingPrice,
        final_customer_selling_price: builtSnapshot.pricing.finalCustomerSellingPrice,
        totalSellingPrice: builtSnapshot.pricing.finalCustomerSellingPrice,
        totalTaxes: canViewInternalCosts ? builtSnapshot.pricing.taxesTotal : 0,
        hotelAccommodationTotal: builtSnapshot.pricing.hotelAccommodationTotal,
        landPartTotal: builtSnapshot.pricing.landPartTotal,
        surchargesTotal: builtSnapshot.pricing.surchargesTotal,
        appliedSurcharges: builtSnapshot.pricing.appliedSurcharges,
        surchargeOverrides: builtSnapshot.pricing.surchargeOverrides,
        currencyConversionSnapshot: builtSnapshot.pricing.currencyConversionSnapshot,
        termsStatus: builtSnapshot.commercialTerms.termsStatus || draft.termsStatus,
        commercialTermsSnapshot: builtSnapshot.commercialTerms.snapshot || draft.commercialTermsSnapshot,
        termsAndConditions: builtSnapshot.commercialTerms.plainText,
        snapshotVersion: builtSnapshot.versionNumber,
        snapshotHash: builtSnapshot.snapshotHash,
        authoritativeSnapshot: builtSnapshot
      };

      const consistencyReport = validateQuotationOutputConsistency(enrichedDraft, {
        selectedOptionIndexOrId: enrichedDraft.activeOptionId,
        brandingMode: enrichedDraft.brandingMode
      });
      if (!consistencyReport.isValid) {
        const msg = `Save blocked due to consistency mismatch: ${consistencyReport.mismatches[0]}`;
        quotationOperationsService.markFailed(saveOp.operationId, new Error(msg));
        setOutputSyncError(msg);
        setAutoSaveStatus('FAILED');
        setAutoSaveError(msg);
        showBuilderToast(msg, 'WARNING');
        return null;
      }

      const saveRes = await withBoundedTimeout(
        db.saveQuotationExplicitVersionAsync({
          quote: enrichedDraft,
          user,
          clientSaveRequestId,
          restoredFromVersion
        }),
        30000,
        'Save Quotation Draft'
      );

      const genRec = recordQuotationGenerationEvent(db, saveRes.quote, {
        outputOption: 'SAVE_DRAFT',
        status: 'SUCCEEDED',
        brandingMode: saveRes.quote.brandingMode,
        selectedOptionId: saveRes.quote.activeOptionId,
        user
      });

      const persistedQuote = genRec.updatedQuote;
      pendingSaveRequestIdRef.current = null;

      hydratedSessionKeyRef.current = `quote:${persistedQuote.id}:v${saveRes.versionNumber}:edit`;
      lastSavedHashRef.current = savedHash;
      setBaselineSavedHash(savedHash);
      setActiveQuoteId(persistedQuote.id);
      setQuoteNumber(persistedQuote.quoteNumber || persistedQuote.id);
      setQuoteVersion(saveRes.versionNumber);
      setLatestSavedVersion(saveRes.versionNumber);
      setVersionCount(persistedQuote.versionCount || (persistedQuote.versionHistory?.length ?? saveRes.versionNumber));
      setRestoredFromVersion(undefined);
      setHasExplicitlySaved(true);
      setAuthoritativeSavedQuote(persistedQuote);
      setLoadedQuoteStatus(persistedQuote.status);
      setAutoSaveStatus('SAVED');
      setAutoSaveError(null);
      setLastSavedTimestamp(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      quotationOperationsService.markSucceeded(saveOp.operationId, {
        versionId: `v${saveRes.versionNumber}`,
        resultRef: persistedQuote.snapshotHash || persistedQuote.id
      });
      onQuoteSaved?.(persistedQuote);

      showBuilderToast(
        `✓ Saved quotation version v${saveRes.versionNumber} (${persistedQuote.snapshotHash || ''})`,
        'SUCCESS'
      );
      return persistedQuote;
    } catch (err: any) {
      const msg = err?.message || 'Failed to persist quotation version to Firestore.';
      quotationOperationsService.markFailed(saveOp.operationId, err);
      setOutputSyncError(msg);
      setAutoSaveStatus('FAILED');
      setAutoSaveError(msg);
      showBuilderToast(`Save failed: ${msg}`, 'WARNING');
      return null;
    } finally {
      isExplicitSavingRef.current = false;
      setIsSavingExplicitly(false);
      setOutputBusyOption(null);
    }
  };

  // Memoized ProposalDocumentView quote prop so unrelated UI state changes do not rebuild/remount preview
  const previewQuote = useMemo(() => {
    if (activeViewTab !== 'PROPOSAL_PREVIEW') return null;
    const baseQ = authoritativeSavedQuote || {
      ...buildActiveQuotationDraft(),
      updatedAt: previewUpdatedAtRef.current.ts
    };
    if (baseQ.brandingMode === brandingMode && baseQ.brandingSnapshot?.mode === brandingMode) {
      return baseQ;
    }
    return {
      ...baseQ,
      brandingMode,
      brandingSnapshot: buildAgencyBrandingSnapshotFromUser(user, baseQ, brandingMode)
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeViewTab, authoritativeSavedQuote, brandingMode, user, currentWorkingHash, activeOptionTab]);

  // Output Option 2: Preview Client Proposal (reads authoritative saved snapshot; never auto-saves)
  const handlePreviewProposal = async () => {
    if (packagePricingStatus === 'CALCULATING') {
      showBuilderToast('Live wholesale tariffs are currently calculating. Please wait...', 'WARNING');
      return;
    }
    if (packagePricingStatus === 'ERROR') {
      showBuilderToast('Cannot generate quote: live pricing calculation encountered an error. Please retry tariffs.', 'WARNING');
      return;
    }
    await runOutputWithAuthoritativeSnapshot('PREVIEW_PROPOSAL', (synced) => {
      const rec = recordQuotationGenerationEvent(db, synced, {
        outputOption: 'PREVIEW_PROPOSAL',
        status: 'SUCCEEDED',
        brandingMode: synced.brandingMode,
        selectedOptionId: synced.activeOptionId,
        user
      });
      setAuthoritativeSavedQuote(rec.updatedQuote);
      switchViewTab('PROPOSAL_PREVIEW');
    });
  };

  // Output Option 3: Download PDF Itinerary (reads authoritative saved snapshot; never auto-saves)
  const handleDownloadPDF = async () => {
    if (!validateFxBeforeFinalGeneration()) return;
    if (!validateTermsBeforeExportOrFinalise()) return;
    await runOutputWithAuthoritativeSnapshot('DOWNLOAD_PDF', async (synced) => {
      const pdfOp = quotationOperationsService.startOperation({
        operationType: 'PDF_GENERATE',
        quoteId: synced.id,
        versionId: `v${synced.version || 1}`,
        uid: user?.id,
        idempotencyKey: `pdf:${synced.id}:v${synced.version || 1}:${synced.snapshotHash || 'live'}`
      });
      let recordedFailure = false;
      try {
        const pdfResult = await withBoundedTimeout(
          downloadQuotationPDF({
            quote: synced,
            agentName: (synced.brandingSnapshot as any)?.specialistName || synced.brandingSnapshot?.agencyName || synced.agentName || user?.name || 'Travel Specialist',
            agentAgency: synced.brandingSnapshot?.agencyName || synced.agentAgency || user?.agencyName || 'Partner Travel Agency',
            agentEmail: synced.brandingSnapshot?.email || synced.agentEmail || user?.email || '',
            agentPhone: synced.brandingSnapshot?.phone || synced.agentPhone || user?.phone || '',
            agentLogoUrl: synced.brandingSnapshot?.logoUrl || synced.agentLogoUrl || user?.brandLogoUrl,
            agentAddress: synced.brandingSnapshot?.address,
            agentRegisteredAddress: synced.brandingSnapshot?.registeredAddress,
            agentCurrentAddress: synced.brandingSnapshot?.currentAddress,
            agentWebsite: synced.brandingSnapshot?.website,
            footerText: synced.brandingSnapshot?.footerText,
            disclaimer: synced.brandingSnapshot?.disclaimer,
            brandingMode: synced.brandingMode || brandingMode,
            selectedOptionIndexOrId: synced.activeOptionId || `opt-${activeOptionTab}`,
            snapshotHash: synced.snapshotHash,
            leadId: selectedLeadId || synced.leadId,
            onComplete: () => {
              const rec = recordQuotationGenerationEvent(db, synced, {
                outputOption: 'DOWNLOAD_PDF',
                status: 'SUCCEEDED',
                brandingMode: synced.brandingMode,
                selectedOptionId: synced.activeOptionId,
                user
              });
              setAuthoritativeSavedQuote(rec.updatedQuote);
            },
            onError: (err) => {
              recordedFailure = true;
              const rec = recordQuotationGenerationEvent(db, synced, {
                outputOption: 'DOWNLOAD_PDF',
                status: 'FAILED',
                brandingMode: synced.brandingMode,
                selectedOptionId: synced.activeOptionId,
                errorMessage: err.message,
                user
              });
              setAuthoritativeSavedQuote(rec.updatedQuote);
            }
          }),
          60000,
          'PDF Generation'
        );

        if (!pdfResult.success) {
          const errMsg = pdfResult.error || 'PDF generation failed. Please retry.';
          quotationOperationsService.markFailed(pdfOp.operationId, new Error(errMsg));
          setOutputSyncError(`PDF Export Failed: ${errMsg}`);
          showBuilderToast(`PDF export failed: ${errMsg}`, 'WARNING');
          return;
        }

        quotationOperationsService.markSucceeded(pdfOp.operationId, {
          versionId: `v${synced.version || 1}`,
          resultRef: synced.quoteNumber || synced.id
        });
        showBuilderToast(`✓ PDF Itinerary generated for ${synced.quoteNumber || synced.id}`, 'SUCCESS');
        googleCalendarAutomation.triggerQuoteFollowUpSLA(synced, user);
      } catch (err: any) {
        const errMsg = err?.message || 'PDF generation timed out or failed.';
        quotationOperationsService.markFailed(pdfOp.operationId, err);
        if (!recordedFailure) {
          const rec = recordQuotationGenerationEvent(db, synced, {
            outputOption: 'DOWNLOAD_PDF',
            status: 'FAILED',
            brandingMode: synced.brandingMode,
            selectedOptionId: synced.activeOptionId,
            errorMessage: errMsg,
            user
          });
          setAuthoritativeSavedQuote(rec.updatedQuote);
        }
        setOutputSyncError(`PDF Export Failed: ${errMsg}`);
        showBuilderToast(`PDF export failed: ${errMsg}`, 'WARNING');
      }
    });
  };

  // Output Option 5: Share via WhatsApp (reads authoritative saved snapshot; never auto-saves)
  const handleShareWhatsApp = async () => {
    if (!validateFxBeforeFinalGeneration()) return;
    if (!validateTermsBeforeExportOrFinalise()) return;
    const permCheck = canUserShareQuoteWhatsApp(user);
    if (!permCheck.allowed) {
      showBuilderToast(permCheck.reason || 'You are not authorized to share quotations via WhatsApp.', 'WARNING');
      return;
    }

    await runOutputWithAuthoritativeSnapshot('SHARE_WHATSAPP', (synced) => {
      setWhatsAppModalQuote(synced);
      setIsWhatsAppModalOpen(true);
    });
  };

  // Helper to sync canonical email preview when note, branding, or quote changes
  const refreshCanonicalEmailContent = (quoteObj: Quotation, customNoteText: string, modeOverride?: QuoteBrandingMode) => {
    const activeMode = modeOverride || quoteObj.brandingMode || brandingMode;
    const snap =
      quoteObj.brandingSnapshot?.mode === activeMode
        ? quoteObj.brandingSnapshot
        : buildAgencyBrandingSnapshotFromUser(user, quoteObj, activeMode);
    const safeRecipient = (emailRecipient || clientEmail || (quoteObj.clientEmail && quoteObj.clientEmail !== 'client@example.com' ? quoteObj.clientEmail : '') || '').trim();
    const canonical = emailService.buildCanonicalQuotationEmail(
      {
        ...quoteObj,
        brandingMode: activeMode,
        brandingSnapshot: snap,
        clientEmail: safeRecipient,
        clientName: clientName || quoteObj.clientName || 'Valued Guest'
      },
      {
        name: (snap as any).specialistName || snap.agencyName || user?.name || quoteObj.agentName || 'Travel Specialist',
        agencyName: snap.agencyName || user?.agencyName || quoteObj.agentAgency || (activeMode === 'WHITE_LABEL' ? 'Partner Travel Agency' : 'TheUnbound Partner Agency'),
        email: snap.email || user?.email || quoteObj.agentEmail || (activeMode === 'WHITE_LABEL' ? '' : 'sales@theunbound.in'),
        phone: snap.phone || user?.phone || quoteObj.agentPhone || (activeMode === 'WHITE_LABEL' ? '' : '+91-9811654959'),
        logoUrl: snap.logoUrl || user?.brandLogoUrl || quoteObj.agentLogoUrl,
        website: snap.website || (user as any)?.website,
        address: snap.address || (user as any)?.businessAddress,
        primaryColor: snap.primaryColor || (user as any)?.brandPrimaryColor,
        accentColor: snap.accentColor || (user as any)?.brandAccentColor,
        brandingMode: activeMode,
        selectedOptionIndexOrId: quoteObj.activeOptionId || `opt-${activeOptionTab}`,
        customNote: customNoteText
      }
    );
    setEmailMessage(canonical.textBody);
    setEmailRichHtml(canonical.proposalViewHtml);
    setEmailSimpleHtml(canonical.simpleSemanticHtml);
    setEmailPreviewHtml(canonical.proposalViewHtml);
    return canonical;
  };

  // Output Option 4: Open Email Modal with Authoritative Saved Snapshot (never auto-saves)
  const handleOpenEmailModal = async () => {
    if (!validateFxBeforeFinalGeneration()) return;
    if (!validateTermsBeforeExportOrFinalise()) return;
    await runOutputWithAuthoritativeSnapshot('SEND_EMAIL', (synced) => {
      setEmailModalQuote(synced);
      const rawCandidate = (clientEmail || synced.clientEmail || '').trim();
      const defaultRecipient = /^client@example\.com$/i.test(rawCandidate) ? '' : rawCandidate;
      setEmailRecipient(defaultRecipient);
      setEmailCustomNote('');
      emailIdempotencyKeyRef.current = null;
      const canonical = refreshCanonicalEmailContent(
        {
          ...synced,
          clientEmail: defaultRecipient,
          clientName: clientName || synced.clientName || 'Valued Guest'
        },
        ''
      );
      setEmailSubject(canonical.subject);
      setEmailPreviewTab('HTML_PREVIEW');
      setPlainTextSubView('PREVIEW');
      setEmailCopied(false);
      setEmailSuccessMessage(null);
      setEmailErrorMessage(null);
      setIsEmailModalOpen(true);
    });
  };

  // Copy Complete Quotation as Formatted Rich Text (text/html + text/plain fallback)
  const handleCopyFormattedQuotation = async () => {
    // Option 1 uses rich proposal view HTML, Option 2 uses simple semantic rich text HTML
    const htmlToCopy = emailPreviewTab === 'HTML_PREVIEW'
      ? (emailRichHtml || emailPreviewHtml)
      : (emailSimpleHtml || formatPlainTextQuotationToHtml(emailMessage));
    const plainTextFallback = emailMessage;

    let successMode: 'RICH_HTML' | 'PLAIN_TEXT' | null = null;

    try {
      if (typeof window !== 'undefined' && typeof window.ClipboardItem !== 'undefined' && navigator?.clipboard?.write) {
        const blobHtml = new Blob([htmlToCopy], { type: 'text/html' });
        const blobText = new Blob([plainTextFallback], { type: 'text/plain' });
        const item = new ClipboardItem({
          'text/html': blobHtml,
          'text/plain': blobText,
        });
        await navigator.clipboard.write([item]);
        successMode = 'RICH_HTML';
      } else {
        // Fallback using temporary off-screen container selection for browsers without ClipboardItem
        const container = document.createElement('div');
        container.innerHTML = htmlToCopy;
        container.style.position = 'fixed';
        container.style.pointerEvents = 'none';
        container.style.opacity = '0';
        container.style.left = '-9999px';
        document.body.appendChild(container);

        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(container);
        selection?.removeAllRanges();
        selection?.addRange(range);

        const successful = document.execCommand('copy');
        selection?.removeAllRanges();
        document.body.removeChild(container);

        if (successful) {
          successMode = 'RICH_HTML';
        } else if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(plainTextFallback);
          successMode = 'PLAIN_TEXT';
        }
      }
    } catch (err) {
      console.warn('Rich text clipboard write encountered issue, falling back to plain text:', err);
      try {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(plainTextFallback);
          successMode = 'PLAIN_TEXT';
        }
      } catch (fallbackErr) {
        console.error('All clipboard operations failed:', fallbackErr);
      }
    }

    if (successMode) {
      setEmailCopiedMode(successMode);
      setEmailCopied(true);
      setTimeout(() => {
        setEmailCopied(false);
        setEmailCopiedMode(null);
      }, 3000);
    }
  };

  const handleCopyEmailText = handleCopyFormattedQuotation;

  // Send Complete Email Proposal via EmailNotificationService (uses authoritative saved snapshot; never bumps version)
  const handleSendProposalEmail = async () => {
    if (isSendingEmail) return;
    if (!validateTermsBeforeExportOrFinalise()) return;
    const cleanRecipient = emailRecipient.trim();
    if (!cleanRecipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanRecipient)) {
      setEmailErrorMessage('Please enter a valid recipient email address before dispatching.');
      return;
    }

    const synced = emailModalQuote || authoritativeSavedQuote;
    if (!synced) {
      showBuilderToast('Please save draft before sending quotation email.', 'WARNING');
      return;
    }

    setIsSendingEmail(true);
    setEmailErrorMessage(null);
    setEmailSuccessMessage(null);

    const activeMode = synced.brandingMode || brandingMode;
    const finalSubjectPreview = emailSubject.trim() || synced.title || synced.quoteNumber || 'Quotation Proposal';
    const idempotencySignature = `${synced.id}:v${synced.version || latestSavedVersion || 1}:${cleanRecipient.toLowerCase()}:${activeMode}:${finalSubjectPreview}`;
    const idempotencyKey =
      emailIdempotencyKeyRef.current?.signature === idempotencySignature
        ? emailIdempotencyKeyRef.current.key
        : `quote-email-${synced.id}-v${synced.version || latestSavedVersion || 1}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    emailIdempotencyKeyRef.current = { signature: idempotencySignature, key: idempotencyKey };

    const emailOp = quotationOperationsService.startOperation({
      operationType: 'EMAIL_SEND',
      quoteId: synced.id,
      versionId: `v${synced.version || latestSavedVersion || 1}`,
      uid: user?.id,
      idempotencyKey
    });

    try {
      const snap =
        synced.brandingSnapshot?.mode === activeMode
          ? synced.brandingSnapshot
          : buildAgencyBrandingSnapshotFromUser(user, synced, activeMode);
      const emailService = EmailNotificationService.getInstance();
      const generatedEmail = emailService.generateQuotationProposalEmail(
        {
          ...synced,
          brandingMode: activeMode,
          brandingSnapshot: snap,
          clientEmail: cleanRecipient,
          clientName: clientName || synced.clientName || 'Valued Guest'
        },
        {
          name: (snap as any).specialistName || user?.name || synced.agentName || 'Travel Specialist',
          agencyName: snap.agencyName || user?.agencyName || synced.agentAgency || (activeMode === 'WHITE_LABEL' ? 'Partner Travel Agency' : 'Luxury Partner Agency'),
          email: snap.email || user?.email || synced.agentEmail || (activeMode === 'WHITE_LABEL' ? '' : 'sales@theunbound.in'),
          phone: snap.phone || user?.phone || synced.agentPhone || (activeMode === 'WHITE_LABEL' ? '' : '+91-9811654959'),
          logoUrl: snap.logoUrl || user?.brandLogoUrl || synced.agentLogoUrl,
          website: snap.website || (user as any)?.website,
          address: snap.address || (user as any)?.businessAddress,
          primaryColor: snap.primaryColor || (user as any)?.brandPrimaryColor,
          accentColor: snap.accentColor || (user as any)?.brandAccentColor,
          brandingMode: activeMode,
          selectedOptionIndexOrId: synced.activeOptionId || `opt-${activeOptionTab}`,
          customNote: emailCustomNote,
          formattingMode: emailPreviewTab === 'HTML_PREVIEW' ? 'PROPOSAL_VIEW' : 'PLAIN_TEXT'
        }
      );

      const finalSubject = emailSubject.trim() || generatedEmail.subject;
      const finalHtmlBody = emailPreviewTab === 'HTML_PREVIEW'
        ? (emailRichHtml && emailRichHtml.trim() ? emailRichHtml : generatedEmail.proposalViewHtml || generatedEmail.fullHtml)
        : (emailSimpleHtml && emailSimpleHtml.trim() ? emailSimpleHtml : formatPlainTextQuotationToHtml(emailMessage));

      const result = await withBoundedTimeout(
        emailService.sendViaGmailApi(
          cleanRecipient,
          finalSubject,
          finalHtmlBody,
          {
            quoteId: synced.id,
            leadId: synced.leadId,
            recipientType: 'BUYER',
            eventType: 'QUOTE_EMAIL_SENT',
            idempotencyKey,
            sentBy: user?.id,
            sentByName: user?.name || 'Agent'
          },
          emailMessage
        ),
        25000,
        'Email Dispatch'
      );

      if (result.success) {
        const frozenSnap = synced.commercialTermsSnapshot || termsResolution.readiness.snapshot;
        const updatedQuote: Quotation = {
          ...synced,
          clientEmail: cleanRecipient,
          status: synced.status === 'DRAFT' ? 'SENT' : synced.status,
          isLocked: true,
          termsStatus: 'QUOTATION_FINALISED',
          commercialTermsSnapshot: frozenSnap,
          authoritativeSnapshot: synced.authoritativeSnapshot
            ? {
                ...synced.authoritativeSnapshot,
                status: synced.status === 'DRAFT' ? 'SENT' : synced.status,
                isLocked: true,
                commercialTerms: {
                  ...synced.authoritativeSnapshot.commercialTerms,
                  termsStatus: 'QUOTATION_FINALISED',
                  snapshot: frozenSnap
                }
              }
            : undefined
        };

        let emailSaved = db.saveQuote(updatedQuote, user, 'SENT', `Complete quotation emailed to ${cleanRecipient}`);
        try {
          emailSaved = await withBoundedTimeout(
            db.saveQuoteAsync(updatedQuote, user, 'SENT', `Complete quotation emailed to ${cleanRecipient}`),
            12000,
            'Quotation Email Status Persistence'
          );
        } catch (persistErr: any) {
          console.warn('Email sent but cloud status sync failed:', persistErr?.message);
        }

        const genRec = recordQuotationGenerationEvent(db, emailSaved, {
          outputOption: 'SEND_EMAIL',
          status: 'SUCCEEDED',
          brandingMode: activeMode,
          selectedOptionId: emailSaved.activeOptionId,
          recipient: cleanRecipient,
          user
        });
        setAuthoritativeSavedQuote(genRec.updatedQuote);
        setLoadedIsLocked(true);
        if (frozenSnap && frozenSnap.entries?.length > 0) {
          setLoadedFinalisedSnapshot(frozenSnap);
        }
        setLoadedQuoteStatus(genRec.updatedQuote.status);
        if (cleanRecipient !== clientEmail) {
          setClientEmail(cleanRecipient);
        }
        emailIdempotencyKeyRef.current = null;

        const channelLabel = result.providerStatus === 'EMAIL_ACCEPTED_RELAY' ? 'via Transactional Relay' : 'via Gmail API';
        const msg = `Complete quotation proposal dispatched to ${cleanRecipient} ${channelLabel}${result.alreadySent ? ' (already delivered)' : ''}! (Ref: ${synced.quoteNumber} • ID: ${result.messageId || 'SENT'})`;
        quotationOperationsService.markSucceeded(emailOp.operationId, {
          versionId: `v${synced.version || latestSavedVersion || 1}`,
          resultRef: `${result.providerStatus || 'EMAIL'}:${result.messageId || 'SENT'}`
        });
        setEmailSuccessMessage(msg);
        showBuilderToast(`✓ Complete quotation emailed to ${cleanRecipient}`, 'SUCCESS');
        setTimeout(() => {
          setIsEmailModalOpen(false);
          setEmailSuccessMessage(null);
        }, 2200);
      } else {
        const failErr = result.error || 'Unable to dispatch email';
        quotationOperationsService.markFailed(emailOp.operationId, new Error(failErr));
        recordQuotationGenerationEvent(db, synced, {
          outputOption: 'SEND_EMAIL',
          status: 'FAILED',
          brandingMode: activeMode,
          selectedOptionId: synced.activeOptionId,
          recipient: cleanRecipient,
          errorMessage: failErr,
          user
        });
        setEmailErrorMessage(`Email delivery failed. Reason: ${failErr}. Retry using the button below, or copy the formatted proposal / open in your mail client.`);
      }
    } catch (err: any) {
      const errMsg = err?.message || 'Network error';
      quotationOperationsService.markFailed(emailOp.operationId, err);
      recordQuotationGenerationEvent(db, synced, {
        outputOption: 'SEND_EMAIL',
        status: 'FAILED',
        recipient: cleanRecipient,
        errorMessage: errMsg,
        user
      });
      setEmailErrorMessage(`Email delivery failed. Reason: ${errMsg}. Please retry.`);
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Output Option 7: Convert to Confirmed Booking (Idempotent, never auto-saves dirty working edits)
  const handleConvertBooking = async () => {
    if (!validateFxBeforeFinalGeneration()) return;
    if (!validateTermsBeforeExportOrFinalise()) return;
    await runOutputWithAuthoritativeSnapshot('CONVERT_BOOKING', async (synced) => {
      try {
        const frozenSnap = synced.commercialTermsSnapshot || termsResolution.readiness.snapshot;
        const finalisedQuote: Quotation = {
          ...synced,
          isLocked: true,
          termsStatus: 'QUOTATION_FINALISED',
          commercialTermsSnapshot: frozenSnap,
          authoritativeSnapshot: synced.authoritativeSnapshot
            ? {
                ...synced.authoritativeSnapshot,
                isLocked: true,
                commercialTerms: {
                  ...synced.authoritativeSnapshot.commercialTerms,
                  termsStatus: 'QUOTATION_FINALISED',
                  snapshot: frozenSnap
                }
              }
            : undefined
        };
        const persistedFinal = db.saveQuote(finalisedQuote, user, 'STATUS_CHANGED', 'Frozen Commercial Quotation Terms on booking conversion');
        db.updateQuotationStatus(persistedFinal.id, 'APPROVED', user);
        if (frozenSnap && frozenSnap.entries?.length > 0) {
          setLoadedFinalisedSnapshot(frozenSnap);
        }
        setLoadedQuoteStatus('APPROVED');
        setLoadedIsLocked(true);
        const booking = db.convertQuotationToBooking(persistedFinal, user);
        const rec = recordQuotationGenerationEvent(db, { ...persistedFinal, status: 'BOOKED' }, {
          outputOption: 'CONVERT_BOOKING',
          status: 'SUCCEEDED',
          brandingMode: persistedFinal.brandingMode,
          selectedOptionId: persistedFinal.activeOptionId,
          targetEntityId: booking?.id,
          targetReference: booking?.bookingReference || booking?.id,
          user
        });
        setAuthoritativeSavedQuote(rec.updatedQuote);
        if (onConvertToBooking) {
          onConvertToBooking(rec.updatedQuote);
        } else if (onBookQuotation) {
          onBookQuotation(rec.updatedQuote);
        }
        showBuilderToast(`Quotation converted to Booking (${booking?.bookingReference || booking?.id || 'Confirmed'})!`, 'SUCCESS');
      } catch (err: any) {
        console.error('Booking conversion error:', err);
        recordQuotationGenerationEvent(db, synced, {
          outputOption: 'CONVERT_BOOKING',
          status: 'FAILED',
          errorMessage: err?.message || 'Booking conversion encountered an issue.',
          user
        });
        showBuilderToast(err?.message || 'Booking conversion encountered an issue.', 'WARNING');
      }
    });
  };

  // Resolve currently linked Master Package (from sourcePackageId or lastSavedMasterPackage)
  const linkedExistingMasterPackage = useMemo(() => {
    const candidateId = lastSavedMasterPackage?.id || sourcePackageId;
    if (!candidateId) return null;
    return db.getPackages().find(p => p.id === candidateId) || lastSavedMasterPackage || null;
  }, [db, lastSavedMasterPackage, sourcePackageId]);

  // Open Save as Ready-Made Package Modal
  const handleOpenSavePackageModal = () => {
    if (!canSaveAsPackage) return;
    setSavePackageError(null);

    const existingPkg = linkedExistingMasterPackage;
    const cleanQuoteTitle = (quoteTitle || '').trim();
    const isGenericQuoteTitle =
      !cleanQuoteTitle ||
      cleanQuoteTitle.toLowerCase().includes('new quotation') ||
      cleanQuoteTitle.toLowerCase().includes('bespoke quotation');

    const defaultTitle = existingPkg?.title ||
      (!isGenericQuoteTitle
        ? cleanQuoteTitle
        : `${currentDestination.name} ${tripNights}N/${tripNights + 1}D ${tripType} Discovery`);

    const routeHubNames = (routeHubs || []).map(h => h.hubName).filter(Boolean);
    const defaultTagline = existingPkg?.tagline ||
      `Signature ${tripNights}-night curated circuit featuring ${routeHubNames.length > 0 ? routeHubNames.join(' → ') : currentDestination.name}.`;

    const defaultDescription = existingPkg?.description ||
      (itineraryOverview && itineraryOverview.trim().length > 0
        ? itineraryOverview.trim()
        : `Comprehensive multi-city luxury touring circuit including ${items.length} master experiences and premium accommodations across ${routeHubNames.length > 0 ? routeHubNames.join(', ') : currentDestination.name}.`);

    setPackageFormData({
      title: defaultTitle,
      tagline: defaultTagline,
      description: defaultDescription,
      tripType: existingPkg?.tripType || normalizeMasterPackageTripType(tripType || travelStyle),
      status: existingPkg?.status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED',
      featured: existingPkg ? Boolean(existingPkg.isFeatured) : true,
      updateExisting: Boolean(existingPkg)
    });
    setIsSavePackageModalOpen(true);
  };

  // Live preview of the Ready-Made Package & Centralized Pricing Engine calculation for the modal
  const liveMasterPackagePreview = useMemo(() => {
    if (!isSavePackageModalOpen) return null;
    try {
      return buildMasterPackageFromQuoteWorkspace({
        title: packageFormData.title || `${currentDestination.name} ${tripNights}N/${tripNights + 1}D Circuit`,
        tagline: packageFormData.tagline,
        description: packageFormData.description,
        tripType: packageFormData.tripType,
        status: packageFormData.status,
        featured: packageFormData.featured,
        currentDestination,
        quotationScope,
        routeHubs,
        items: effectivePricedItems,
        calendarDays,
        daySlots,
        dayThemes,
        dayDescriptions,
        dayOverviews,
        dayNotes,
        inclusions: contextInclusions,
        exclusions: contextExclusions,
        importantInformation: contextImportantInformation,
        cancellationPolicy: contextCancellationPolicy,
        termsAndConditions: termsResolution.readiness.snapshot.combinedPlainText || undefined,
        itineraryOverview,
        sourceQuoteId: activeQuoteId,
        sourceSnapshotVersion: quoteVersion,
        sourceSnapshotHash: authoritativeSavedQuote?.snapshotHash,
        currency,
        adultsCount,
        childrenCount,
        infantsCount,
        existingPackageId: packageFormData.updateExisting ? linkedExistingMasterPackage?.id : null,
        updateExisting: packageFormData.updateExisting,
        user
      });
    } catch (err) {
      console.error('Error building live master package preview:', err);
      return null;
    }
  }, [
    isSavePackageModalOpen,
    packageFormData,
    currentDestination,
    tripNights,
    quotationScope,
    routeHubs,
    effectivePricedItems,
    calendarDays,
    daySlots,
    dayThemes,
    dayDescriptions,
    dayOverviews,
    dayNotes,
    contextInclusions,
    contextExclusions,
    contextImportantInformation,
    contextCancellationPolicy,
    termsResolution.readiness.snapshot.combinedPlainText,
    itineraryOverview,
    activeQuoteId,
    quoteVersion,
    authoritativeSavedQuote?.snapshotHash,
    currency,
    adultsCount,
    childrenCount,
    infantsCount,
    linkedExistingMasterPackage,
    user
  ]);

  // Output Option 6: Save Current Itinerary as a Master Ready-Made Package (uses authoritative saved snapshot; never auto-saves)
  const handleConfirmSavePackage = async () => {
    if (!packageFormData.title.trim()) {
      setSavePackageError('Package Title is required.');
      return;
    }

    setSavePackageError(null);

    await runOutputWithAuthoritativeSnapshot('SAVE_MASTER_PACKAGE', async (synced) => {
      const result = saveAndVerifyMasterPackageFromQuote({
        title: packageFormData.title.trim(),
        tagline: packageFormData.tagline.trim(),
        description: packageFormData.description.trim(),
        tripType: packageFormData.tripType,
        status: packageFormData.status,
        featured: packageFormData.featured,
        currentDestination,
        quotationScope: synced.quotationScope || quotationScope,
        routeHubs: synced.routeHubs || routeHubs,
        items: synced.items || effectivePricedItems,
        calendarDays,
        daySlots,
        dayThemes: synced.dayThemes || dayThemes,
        dayDescriptions: synced.dayDescriptions || dayDescriptions,
        dayOverviews: synced.dayOverviews || dayOverviews,
        dayNotes: synced.dayNotes || dayNotes,
        inclusions: synced.inclusions || contextInclusions,
        exclusions: synced.exclusions || contextExclusions,
        importantInformation: synced.importantInformation || contextImportantInformation,
        cancellationPolicy: synced.cancellationPolicy || contextCancellationPolicy,
        termsAndConditions: synced.commercialTermsSnapshot?.combinedPlainText || synced.termsAndConditions,
        itineraryOverview: synced.itineraryOverview || itineraryOverview,
        sourceQuoteId: synced.id,
        sourceSnapshotVersion: synced.snapshotVersion || synced.version,
        sourceSnapshotHash: synced.snapshotHash,
        currency: synced.currency || currency,
        adultsCount: synced.adultsCount || adultsCount,
        childrenCount: synced.childrenCount ?? childrenCount,
        infantsCount: synced.infantsCount ?? infantsCount,
        existingPackageId: packageFormData.updateExisting ? linkedExistingMasterPackage?.id : null,
        updateExisting: packageFormData.updateExisting,
        user
      });

      if (!result.success || !result.pkg) {
        recordQuotationGenerationEvent(db, synced, {
          outputOption: 'SAVE_MASTER_PACKAGE',
          status: 'FAILED',
          errorMessage: result.error || 'Failed to generate and synchronize Ready-Made Package.',
          user
        });
        setSavePackageError(result.error || 'Failed to generate and synchronize Ready-Made Package.');
        return;
      }

      try {
        await db.savePackageAsync(result.pkg, user);
      } catch (saveErr) {
        console.warn('Async save warning:', saveErr);
      }

      setSourcePackageId(result.pkg.id);
      setSourcePackageName(result.pkg.title);
      setLastSavedMasterPackage(result.pkg);
      setLastPackageVerificationReport(result.verificationReport || null);
      setIsSavePackageModalOpen(false);

      const linkedQuote = db.saveQuote(
        {
          ...synced,
          sourcePackageId: result.pkg.id,
          sourcePackageName: result.pkg.title
        },
        user,
        'SAVED',
        'Linked source master package'
      );
      const rec = recordQuotationGenerationEvent(db, linkedQuote, {
        outputOption: 'SAVE_MASTER_PACKAGE',
        status: 'SUCCEEDED',
        targetEntityId: result.pkg.id,
        targetReference: result.pkg.slug || result.pkg.id,
        user
      });
      setAuthoritativeSavedQuote(rec.updatedQuote);

      const actionWord = result.verificationReport?.isUpdate ? 'updated and synchronized in' : 'published and synchronized to';
      setPackageSavedNotice(`Master Package "${result.pkg.title}" (${result.pkg.id}) ${actionWord} Ready-Made Packages.`);
    });
  };

  // Active base products for the day modal based on city filter scope
  const quickAddBaseProducts = useMemo(() => {
    if (!quickAddModalDay) return [];
    const targetCity = quickAddModalDay.hubName;
    const targetHubId = quickAddModalDay.hubId;

    if (filterByDayCityOnly) {
      if (!targetCity && !targetHubId) {
        return [];
      }
      return DestinationRelevanceService.getInstance().getRelevantProducts(
        currentDestination.id,
        targetHubId || targetCity
      ).hubActivities;
    } else {
      return availableProducts;
    }
  }, [quickAddModalDay, filterByDayCityOnly, currentDestination, availableProducts]);

  // Dynamically extract and categorize the actual available product categories for this day/destination context
  const quickAddAvailableCategories = useMemo(() => {
    if (!quickAddModalDay || quickAddBaseProducts.length === 0) {
      return [{ id: 'ALL', label: 'All Experiences', count: quickAddBaseProducts.length }];
    }

    // Map each base product to its authoritative canonical category
    const categoryCounts: Record<string, number> = {};

    quickAddBaseProducts.forEach(p => {
      const canonical = normalizeProductCategory(p.category);
      if (canonical) {
        categoryCounts[canonical] = (categoryCounts[canonical] || 0) + 1;
      } else if (p.category) {
        categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
      }
    });

    // Build the list of categories in authoritative priority order
    const dynamicList: { id: string; label: string; count: number }[] = [
      { id: 'ALL', label: 'All Experiences', count: quickAddBaseProducts.length }
    ];

    AUTHORITATIVE_PRODUCT_CATEGORIES.forEach(cat => {
      if (categoryCounts[cat] && categoryCounts[cat] > 0) {
        dynamicList.push({
          id: cat,
          label: cat,
          count: categoryCounts[cat]
        });
      }
    });

    // Any other categories that were not in AUTHORITATIVE_PRODUCT_CATEGORIES
    Object.keys(categoryCounts).forEach(cat => {
      if (!(AUTHORITATIVE_PRODUCT_CATEGORIES as readonly string[]).includes(cat) && categoryCounts[cat] > 0) {
        dynamicList.push({
          id: cat,
          label: cat,
          count: categoryCounts[cat]
        });
      }
    });

    return dynamicList;
  }, [quickAddModalDay, quickAddBaseProducts]);

  // Quick Add Products Filter - strictly filters by category and debounced search term
  const quickAddFilteredProducts = useMemo(() => {
    if (!quickAddModalDay) return [];
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const q = (debouncedQuickAddSearch || '').trim().toLowerCase();

    const filtered = quickAddBaseProducts.filter(p => {
      // 1. Category Filter using Canonical Mapping
      if (quickAddCategory !== 'ALL') {
        const prodCatEnum = resolveProductCategoryEnum(p);
        const prodNormCat = normalizeProductCategory(p.category);
        const targetCatEnum = (DISPLAY_TO_CATEGORY_ENUM as any)[quickAddCategory] || resolveProductCategoryEnum({ category: quickAddCategory });

        const matchesCat = 
          p.category === quickAddCategory ||
          prodNormCat === quickAddCategory ||
          (prodCatEnum && targetCatEnum && (
            prodCatEnum === targetCatEnum || 
            (targetCatEnum === 'RAIL' && (prodCatEnum === 'RAIL' || prodCatEnum === 'SHINKANSEN')) ||
            (targetCatEnum === 'SHINKANSEN' && (prodCatEnum === 'RAIL' || prodCatEnum === 'SHINKANSEN'))
          )) ||
          ((p.category || '').toLowerCase().includes(quickAddCategory.toLowerCase())) ||
          ((p.subcategory || '').toLowerCase().includes(quickAddCategory.toLowerCase()));

        if (!matchesCat) return false;
      }

      // 2. Search text query
      if (!q) return true;

      const matchSearch =
        (p.name || '').toLowerCase().includes(q) ||
        (p.longDescription || '').toLowerCase().includes(q) ||
        (p.shortDescription || '').toLowerCase().includes(q) ||
        (p.city || '').toLowerCase().includes(q) ||
        (p.location || '').toLowerCase().includes(q) ||
        (p.subcategory || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q);

      return matchSearch;
    });

    if (q) {
      const dt = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
      performanceMonitor.recordTiming('PRODUCT_SEARCH', `QuickAdd: "${q}"`, dt, { results: filtered.length });
    }
    return filtered;
  }, [quickAddModalDay, quickAddBaseProducts, quickAddCategory, debouncedQuickAddSearch]);

  // Total products in catalog tagged specifically for this day's city/hub
  const totalCityProductsCount = useMemo(() => {
    if (!quickAddModalDay) return 0;
    return DestinationRelevanceService.getInstance().getRelevantProducts(
      currentDestination.id, 
      quickAddModalDay.hubId || quickAddModalDay.hubName
    ).hubActivities.length;
  }, [currentDestination, quickAddModalDay]);

  if (loadError) {
    return (
      <div className="min-h-[500px] flex flex-col items-center justify-center p-8 bg-white rounded-3xl border border-slate-200 text-center max-w-xl mx-auto my-12 shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mb-4">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-black text-slate-900 mb-2">Quotation Record Unavailable</h3>
        <p className="text-sm text-slate-600 mb-6">{loadError}</p>
        <div className="flex items-center gap-3">
          {(onViewMyQuotes || onBackToDashboard) && (
            <button
              onClick={onViewMyQuotes || onBackToDashboard}
              className="px-4 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Return to Quotation Master Records
            </button>
          )}
        </div>
      </div>
    );
  }

  // Stable refs & callbacks for StepByStepQuotationWorkspace to avoid unnecessary child re-renders
  const adminAuditContextRef = useRef({
    canViewInternalCosts,
    user,
    activeQuoteId,
    quoteNumber,
    adminMarginMode,
    adminManualMarginType,
    adminManualMarginValue
  });
  adminAuditContextRef.current = {
    canViewInternalCosts,
    user,
    activeQuoteId,
    quoteNumber,
    adminMarginMode,
    adminManualMarginType,
    adminManualMarginValue
  };

  const agentMarginTypeRef = useRef(agentMarginType);
  agentMarginTypeRef.current = agentMarginType;
  const agentMarginValueRef = useRef(agentMarginValue);
  agentMarginValueRef.current = agentMarginValue;

  const handleDismissAdminBasePriceNotification = useCallback(() => {
    setAdminBasePriceUpdatedNotification(undefined);
  }, []);

  const handleSetAdminManualMarginType = useCallback((newType: 'PERCENTAGE' | 'FIXED') => {
    const ctx = adminAuditContextRef.current;
    if (newType === ctx.adminManualMarginType) return;
    const prevSummary = `${ctx.adminMarginMode} | ${ctx.adminManualMarginType} ${ctx.adminManualMarginValue}`;
    const nextSummary = `${ctx.adminMarginMode} | ${newType} ${ctx.adminManualMarginValue}`;
    setAdminManualMarginType(newType);
    if (ctx.canViewInternalCosts) {
      db.logAudit(
        ctx.user ? { id: ctx.user.id, name: ctx.user.name, role: ctx.user.role } : null,
        'MARGIN_CHANGED',
        'Quotation',
        ctx.activeQuoteId,
        `Admin changed Manual Margin Type for ${ctx.quoteNumber || ctx.activeQuoteId} from ${ctx.adminManualMarginType} to ${newType} (working draft; click Save Draft to save version).`,
        prevSummary,
        nextSummary
      );
    }
  }, [db]);

  const handleSetAdminManualMarginValue = useCallback((newVal: number) => {
    const safeVal = Math.max(0, Number.isFinite(Number(newVal)) ? Number(newVal) : 0);
    setAdminManualMarginValue(safeVal);
  }, []);

  const handleSetAdminMarginMode = useCallback((newMode: 'REPLACE' | 'ADD') => {
    const ctx = adminAuditContextRef.current;
    if (newMode === ctx.adminMarginMode) return;
    const prevSummary = `${ctx.adminMarginMode} | ${ctx.adminManualMarginType} ${ctx.adminManualMarginValue}`;
    const nextSummary = `${newMode} | ${ctx.adminManualMarginType} ${ctx.adminManualMarginValue}`;
    setAdminMarginMode(newMode);
    if (ctx.canViewInternalCosts) {
      db.logAudit(
        ctx.user ? { id: ctx.user.id, name: ctx.user.name, role: ctx.user.role } : null,
        'MARGIN_CHANGED',
        'Quotation',
        ctx.activeQuoteId,
        `Admin switched Manual Margin Mode for ${ctx.quoteNumber || ctx.activeQuoteId} from ${ctx.adminMarginMode} to ${newMode} (working draft; click Save Draft to save version).`,
        prevSummary,
        nextSummary
      );
    }
  }, [db]);

  const handleCommitAdminManualMarginAudit = useCallback((prevVal: number, nextVal: number) => {
    const ctx = adminAuditContextRef.current;
    if (!ctx.canViewInternalCosts || Math.abs(prevVal - nextVal) < 0.0001) return;
    db.logAudit(
      ctx.user ? { id: ctx.user.id, name: ctx.user.name, role: ctx.user.role } : null,
      'MARGIN_CHANGED',
      'Quotation',
      ctx.activeQuoteId,
      `Admin updated Manual Margin Value for ${ctx.quoteNumber || ctx.activeQuoteId} in ${ctx.adminMarginMode} mode (${ctx.adminManualMarginType}) from ${prevVal} to ${nextVal} (working draft; click Save Draft to save version).`,
      `${ctx.adminMarginMode} | ${ctx.adminManualMarginType} ${prevVal}`,
      `${ctx.adminMarginMode} | ${ctx.adminManualMarginType} ${nextVal}`
    );
  }, [db]);

  const handleSetAgentMarginType = useCallback((t: AgentMarginType) => {
    setAgentMarginType(t);
    if (t === 'PERCENTAGE') setAgentMarkupPercent(agentMarginValueRef.current);
  }, []);

  const handleSetAgentMarginValue = useCallback((val: number) => {
    const safeVal = Math.max(0, Number(val) || 0);
    setAgentMarginValue(safeVal);
    if (agentMarginTypeRef.current === 'PERCENTAGE') setAgentMarkupPercent(safeVal);
  }, []);

  const handleSetAgentMarkupPercentProp = useCallback((val: number) => {
    const safeVal = Math.max(0, Number(val) || 0);
    setAgentMarginType('PERCENTAGE');
    setAgentMarginValue(safeVal);
    setAgentMarkupPercent(safeVal);
  }, []);

  const handleOpenVisaPickerModal = useCallback(() => setShowVisaPickerModal(true), []);
  const handleOpenAddonModal = useCallback((cat?: 'ALL' | 'INSURANCE' | 'ESIM' | 'SERVICES') => {
    if (cat) setAddonModalCategory(cat);
    setShowAddonModal(true);
  }, []);
  const handleOpenCalculatorForStep = useCallback((prod: Product) => {
    if (isRailProduct(prod)) {
      setInspectingProduct(prod);
    } else {
      setCalculatorProduct(prod);
    }
  }, []);
  const handleOpenCartDrawerForStep = useCallback(() => {
    setIsQuoteDrawerOpen(true, { explicitFromQuoteBuilder: true });
  }, [setIsQuoteDrawerOpen]);
  const handleOpenVersionHistoryForStep = useMemo(
    () => (hasExplicitlySaved ? () => setIsVersionHistoryModalOpen(true) : undefined),
    [hasExplicitlySaved]
  );
  const handleViewSavedMasterPackageForStep = useMemo(
    () =>
      linkedExistingMasterPackage
        ? () => {
            const latestPkg = db.getPackages().find(p => p.id === linkedExistingMasterPackage.id) || linkedExistingMasterPackage;
            setViewingSavedMasterPackage(latestPkg);
          }
        : undefined,
    [linkedExistingMasterPackage, db]
  );
  const handleNavigateToPackagesForStep = useMemo(
    () =>
      onNavigateToPackages
        ? () => onNavigateToPackages(linkedExistingMasterPackage?.id)
        : undefined,
    [onNavigateToPackages, linkedExistingMasterPackage?.id]
  );
  const selectedOptionIdStr = useMemo(() => `opt-${activeOptionTab}`, [activeOptionTab]);
  const adminMissingTermsNotifiedBool = Boolean(
    adminMissingTermsNotifiedKey === termsTargetSignature && termsTargetSignature.length > 0
  );

  return (
    <div 
      id="quote-builder-shell"
      className="fixed inset-0 z-30 bg-slate-100/95 text-slate-900 flex flex-col font-sans selection:bg-[#00C6A6] selection:text-slate-950 overflow-hidden"
    >
      {/* ========================================================================= */}
      {/* TOP WORKSPACE NAVIGATION & CONTROLS — COMPACT SINGLE-ROW TOOLBAR */}
      {/* ========================================================================= */}
      <header 
        id="quote-builder-fixed-header"
        className="shrink-0 w-full z-40 bg-white border-b border-slate-200 px-3 sm:px-4 lg:px-5 py-1.5 sm:py-2 shadow-xs sticky top-0"
      >
        <div className="w-full max-w-[1920px] mx-auto flex items-center justify-between gap-2 xl:gap-3 flex-nowrap min-w-0">
          {/* Left: Back + Quote Info + Customer + Destination + Dates + Pax + Status */}
          <div className="flex items-center gap-1.5 xl:gap-2 min-w-0 shrink overflow-hidden flex-nowrap">
            {(onBackToDashboard || onViewMyQuotes) && (
              <button
                type="button"
                onClick={() => {
                  const navigateOut = () => {
                    if (onBackToDashboard) onBackToDashboard();
                    else if (onViewMyQuotes) onViewMyQuotes();
                  };
                  requestNavigationWithUnsavedGuard(navigateOut);
                }}
                className="h-[34px] px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer border border-slate-200 text-xs font-semibold flex items-center gap-1 shrink-0 whitespace-nowrap"
                title="Back to Quotes"
                aria-label="Back to Quotes"
              >
                <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
                <span>Quotes</span>
              </button>
            )}

            <div className="flex items-center gap-1.5 xl:gap-2 min-w-0 shrink overflow-hidden flex-nowrap text-xs">
              {/* Quote Reference & Version */}
              <span className="px-2 py-1 rounded-md text-[11px] font-mono font-bold bg-slate-900 text-[#00E5C0] shrink-0 whitespace-nowrap">
                {quoteNumber} <span className="text-slate-400 font-normal">v{quoteVersion}</span>
              </span>

              {/* Explicit Version & Save Status Badge */}
              {isReadOnlyHistoricalMode ? (
                <span
                  className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0 whitespace-nowrap flex items-center gap-1"
                  title={`Viewing immutable saved version v${quoteVersion} (Latest: v${latestSavedVersion})`}
                >
                  <Lock className="w-2.5 h-2.5" />
                  <span>Viewing v{quoteVersion} (Read-Only)</span>
                </span>
              ) : autoSaveStatus === 'FAILED' ? (
                <button
                  type="button"
                  onClick={() => handleExplicitSaveDraft()}
                  className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 shrink-0 whitespace-nowrap cursor-pointer flex items-center gap-1"
                  title={autoSaveError || 'Save failed — click Save Draft to retry'}
                >
                  <AlertCircle className="w-3 h-3" />
                  <span>Retry Save</span>
                </button>
              ) : isSavingExplicitly || autoSaveStatus === 'SAVING' ? (
                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200 shrink-0 whitespace-nowrap flex items-center gap-1">
                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  <span>Saving v{hasExplicitlySaved ? latestSavedVersion + 1 : 1}...</span>
                </span>
              ) : restoredFromVersion !== undefined ? (
                <span
                  className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 shrink-0 whitespace-nowrap"
                  title={`Loaded from v${restoredFromVersion}. Click Save Draft to create v${latestSavedVersion + 1}.`}
                >
                  Restored v{restoredFromVersion} (Unsaved)
                </span>
              ) : !hasExplicitlySaved ? (
                <span
                  className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 shrink-0 whitespace-nowrap"
                  title="New Draft in Memory — click Save Draft to persist v1"
                >
                  Unsaved Draft
                </span>
              ) : hasUnsavedChanges ? (
                <span
                  className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 shrink-0 whitespace-nowrap"
                  title={`Latest saved: v${latestSavedVersion}. Working edits are unsaved until you click Save Draft.`}
                >
                  Unsaved Changes (Saved v{latestSavedVersion})
                </span>
              ) : (
                <span
                  className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0 whitespace-nowrap"
                  title={lastSavedTimestamp ? `Saved v${latestSavedVersion} (${lastSavedTimestamp})` : `Saved v${latestSavedVersion}`}
                >
                  Saved v{latestSavedVersion}
                </span>
              )}

              {activeBackgroundJobs.length > 0 && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0 whitespace-nowrap flex items-center gap-1">
                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  <span>{activeBackgroundJobs[0].label} ({activeBackgroundJobs[0].progressPercent}%)</span>
                </span>
              )}

              {/* Client Name */}
              <span 
                className="text-xs font-bold text-slate-900 truncate max-w-[90px] xl:max-w-[130px] shrink" 
                title={clientName || 'New Client'}
              >
                {clientName || 'New Client'}
              </span>

              <span className="text-slate-300 shrink-0 select-none">·</span>

              {/* Destination */}
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1 shrink-0 whitespace-nowrap">
                <MapPin className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                <span className="truncate max-w-[80px] xl:max-w-[120px]">{currentDestination.name}</span>
              </span>

              <span className="text-slate-300 shrink-0 select-none">·</span>

              {/* Travel Dates */}
              <span className="text-slate-600 font-medium shrink-0 whitespace-nowrap text-[11px] xl:text-xs">
                {startDate ? new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}–{endDate ? new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''} ({tripNights}N)
              </span>

              <span className="text-slate-300 shrink-0 select-none">·</span>

              {/* Passenger Count */}
              <span className="text-slate-600 font-semibold shrink-0 whitespace-nowrap text-[11px] xl:text-xs">
                <span className="hidden xl:inline">
                  {adultsCount} Adults{childrenCount > 0 ? ` · ${childrenCount} Child${childrenCount > 1 ? 'ren' : ''}` : ''}{infantsCount > 0 ? ` · ${infantsCount} Infant${infantsCount > 1 ? 's' : ''}` : ''}
                </span>
                <span className="xl:hidden">
                  {adultsCount}A{childrenCount > 0 ? `·${childrenCount}C` : ''}{infantsCount > 0 ? `·${infantsCount}I` : ''}
                </span>
              </span>

              {/* Status / Feasibility Alerts Badge */}
              {sourcePackageName && (
                <span
                  className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200 flex items-center gap-1 shrink-0 whitespace-nowrap max-w-[180px] truncate"
                  title={`Customizing Package: ${sourcePackageName}`}
                >
                  <Sparkles className="w-3 h-3 text-teal-600 shrink-0" />
                  <span className="truncate">Pkg: {sourcePackageName}</span>
                </span>
              )}
              {feasibility.warnings.length > 0 ? (
                <span 
                  className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1 shrink-0 whitespace-nowrap" 
                  title={`${feasibility.warnings.length} Alerts`}
                >
                  <AlertTriangle className="w-3 h-3 text-amber-700 shrink-0" />
                  <span>{feasibility.warnings.length} Alert{feasibility.warnings.length > 1 ? 's' : ''}</span>
                </span>
              ) : items.length > 0 ? (
                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1 shrink-0 whitespace-nowrap">
                  <CheckCircle2 className="w-3 h-3 text-emerald-700 shrink-0" />
                  <span className="hidden xl:inline">Ready</span>
                </span>
              ) : null}
            </div>
          </div>

          {/* Right: Single Compact Authoritative Action Group */}
          <div className="flex items-center gap-1.5 xl:gap-2 shrink-0 flex-nowrap">
            {/* Currency Selector (105-115px wide) */}
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
              aria-label="Quotation Currency"
              className="h-[34px] w-[108px] px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 border border-slate-200 outline-none cursor-pointer shrink-0 transition-colors"
            >
              {SUPPORTED_CURRENCIES.map(curr => (
                <option key={curr.code} value={curr.code}>{curr.code} ({curr.symbol})</option>
              ))}
            </select>

            {/* Versions History Button (only after at least 1 saved version exists) */}
            {hasExplicitlySaved && (
              <button
                type="button"
                onClick={() => setIsVersionHistoryModalOpen(true)}
                className="h-[34px] px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors cursor-pointer flex items-center gap-1 shrink-0 whitespace-nowrap"
                title="View saved versions, compare snapshots, or restore an earlier version"
                aria-label="Version History"
              >
                <History className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                <span>Versions ({Math.max(versionCount, latestSavedVersion, 1)})</span>
              </button>
            )}

            {/* Explicit Save Draft Button — ONLY version-creating action */}
            <button
              type="button"
              disabled={isSavingExplicitly || isReadOnlyHistoricalMode}
              onClick={() => handleExplicitSaveDraft()}
              className={`h-[34px] px-2.5 rounded-lg text-xs font-semibold border transition-colors shrink-0 whitespace-nowrap flex items-center gap-1 ${
                isReadOnlyHistoricalMode
                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                  : isSavingExplicitly
                    ? 'bg-teal-50 text-teal-700 border-teal-200 cursor-wait'
                    : hasUnsavedChanges || !hasExplicitlySaved
                      ? 'bg-slate-900 hover:bg-slate-800 text-[#00E5C0] border-slate-900 cursor-pointer shadow-2xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200 cursor-pointer'
              }`}
              title={
                isReadOnlyHistoricalMode
                  ? 'Historical version is read-only. Restore as working draft to save changes.'
                  : 'Save explicit quotation draft version'
              }
              aria-label="Save Draft"
            >
              {isSavingExplicitly ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>
                  {!hasExplicitlySaved
                    ? 'Save Draft v1'
                    : hasUnsavedChanges
                      ? `Save Draft v${latestSavedVersion + 1}`
                      : 'Save Draft'}
                </span>
              )}
            </button>

            {/* WhatsApp */}
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="h-[34px] px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap shadow-2xs"
              title="Share quotation via WhatsApp"
              aria-label="WhatsApp"
            >
              <MessageCircle className="w-3.5 h-3.5 shrink-0" />
              <span>WhatsApp</span>
            </button>

            {/* Email */}
            <button
              type="button"
              onClick={handleOpenEmailModal}
              className="h-[34px] px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap shadow-2xs"
              title="Send quotation via Email"
              aria-label="Email"
            >
              <Mail className="w-3.5 h-3.5 shrink-0" />
              <span>Email</span>
            </button>

            {/* ⬇ PDF */}
            <button
              type="button"
              onClick={handleDownloadPDF}
              className="h-[34px] px-2.5 rounded-lg bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold border border-slate-200 transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap shadow-2xs"
              title="Download official PDF quotation"
              aria-label="Download PDF"
            >
              <Download className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              <span>PDF</span>
            </button>

            {/* Edit Quote (Return to Editor) */}
            <button
              type="button"
              onClick={() => switchViewTab('BUILDER')}
              className={`h-[34px] px-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap shadow-2xs ${
                activeViewTab === 'PROPOSAL_PREVIEW'
                  ? 'bg-slate-900 text-[#00E5C0] hover:bg-slate-800'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
              }`}
              title="Return to Quote Editor"
              aria-label="Edit Quote"
            >
              <FileText className="w-3.5 h-3.5 text-teal-500 shrink-0" />
              <span>Edit Quote</span>
            </button>

            {/* Generate Quote */}
            <button
              type="button"
              disabled={packagePricingStatus === 'CALCULATING'}
              onClick={handlePreviewProposal}
              className={`h-[34px] px-3 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0 whitespace-nowrap shadow-xs ${
                packagePricingStatus === 'CALCULATING'
                  ? 'bg-slate-200 text-slate-500 cursor-not-allowed opacity-75'
                  : 'bg-[#00C6A6] hover:bg-[#00B598] text-slate-950 cursor-pointer'
              }`}
              title="Generate and preview client quotation"
              aria-label="Generate Quote"
            >
              {packagePricingStatus === 'CALCULATING' ? (
                <RefreshCw className="w-3.5 h-3.5 shrink-0 animate-spin text-teal-600" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>{packagePricingStatus === 'CALCULATING' ? 'Calculating...' : 'Generate Quote'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* SCROLLABLE QUOTE BUILDER WORKSPACE AREA (INDEPENDENT SCROLL) */}
      {/* ========================================================================= */}
      <div 
        id="quote-builder-workspace-scroll-area"
        ref={workspaceScrollRef}
        onScroll={handleWorkspaceScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden w-full min-h-0 relative bg-slate-100/90"
      >
        {/* Historical Read-Only / Restored Draft Context Banner */}
        {isReadOnlyHistoricalMode && (
          <div className="bg-indigo-950 text-white px-4 sm:px-6 py-2.5 border-b border-indigo-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs">
              <Lock className="w-4 h-4 text-indigo-300 shrink-0" />
              <span>
                <strong>Viewing Historical Saved Version v{quoteVersion} (Read-Only).</strong>{' '}
                Latest saved version is <strong>v{latestSavedVersion}</strong>. Saved snapshots are immutable.
              </span>
            </div>
            <div className="flex items-center gap-2">
              {quoteVersion < latestSavedVersion && (
                <button
                  type="button"
                  onClick={() => handleSwitchBuilderVersion(activeQuoteId, latestSavedVersion, 'inspect')}
                  className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold cursor-pointer"
                >
                  Open Latest v{latestSavedVersion}
                </button>
              )}
              <button
                type="button"
                onClick={() => handleSwitchBuilderVersion(activeQuoteId, quoteVersion, 'restore')}
                className="px-3 py-1 rounded-lg bg-[#00C6A6] hover:bg-[#00B598] text-slate-950 text-xs font-black flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore v{quoteVersion} as Working Draft</span>
              </button>
            </div>
          </div>
        )}

        {!isReadOnlyHistoricalMode && restoredFromVersion !== undefined && (
          <div className="bg-amber-50 text-amber-950 px-4 sm:px-6 py-2 border-b border-amber-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                <strong>Restored from v{restoredFromVersion} (Unsaved Working Draft).</strong>{' '}
                Latest saved version remains <strong>v{latestSavedVersion}</strong> until you click <strong>Save Draft</strong>.
              </span>
            </div>
            <button
              type="button"
              disabled={isSavingExplicitly}
              onClick={() => handleExplicitSaveDraft()}
              className="px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-[#00E5C0] text-xs font-black cursor-pointer disabled:opacity-50"
            >
              Save Draft as v{latestSavedVersion + 1}
            </button>
          </div>
        )}

        {/* Non-Active Destination Review Banner (Preserves Historical Quotes & Drafts) */}
        {(draftDestinationReview?.requiresReview || (activeQuoteId && !inventoryVisibilityService.isDestinationActiveForB2B(currentDestination))) && (
          <div className="bg-amber-50 border-b border-amber-300 text-amber-950 px-4 sm:px-6 py-2.5 flex items-start gap-2.5 text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="font-black uppercase tracking-wide text-[11px] text-amber-900">
                Destination Inactive — Review Required
              </div>
              <p className="text-amber-900 leading-snug">
                This quotation references a destination ({draftDestinationReview?.affectedDestinations?.join(', ') || currentDestination.name}) that is currently non-active. Existing saved items and finalized snapshots are preserved intact, but adding new items from non-active destinations is disabled.
              </p>
            </div>
          </div>
        )}

        {destinationVisibilityError && (
          <div className="bg-rose-50 border-b border-rose-200 text-rose-900 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 font-semibold">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{destinationVisibilityError}</span>
            </div>
            <button
              type="button"
              onClick={clearDestinationVisibilityError}
              className="text-rose-700 hover:text-rose-950 font-bold cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW: OFFICIAL PROPOSAL PRESENTATION PREVIEW */}
        {/* ========================================================================= */}
        {activeViewTab === 'PROPOSAL_PREVIEW' ? (
          <main className="w-full max-w-[1920px] mx-auto min-w-0 px-4 sm:px-6 py-8 space-y-6 pb-32">
          {/* Client Presentation Mode Informational Strip & White-Label Branding Switcher */}
          <div className="bg-white px-4 py-3 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-xs print:hidden max-w-5xl mx-auto">
            <div className="flex items-center space-x-2.5">
              <Sparkles className="w-4 h-4 text-[#00A88F] shrink-0" />
              <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="font-bold text-slate-900">Client Presentation Mode</span>
                <span className="text-slate-300 hidden sm:inline">—</span>
                <span>Review the live proposal layout and branding before dispatching.</span>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Branding:</span>
              <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setBrandingMode('STANDARD');
                  }}
                  className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    brandingMode === 'STANDARD'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Standard Quote
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBrandingMode('WHITE_LABEL');
                  }}
                  className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    brandingMode === 'WHITE_LABEL'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  White-Label Quote
                </button>
              </div>
            </div>
          </div>

          {/* Render Full Proposal Document from Memoized Authoritative Snapshot */}
          {previewQuote && (
            <ProposalDocumentView
              quote={previewQuote}
              agentUser={user}
              selectedOptionIndexOrId={selectedOptionIdStr}
              onDownloadPdf={handleDownloadPDF}
              onShareWhatsApp={handleShareWhatsApp}
              onSendEmail={handleOpenEmailModal}
            />
          )}
        </main>
      ) : (
        /* ========================================================================= */
        /* VIEW: PRIMARY ITINERARY BUILDER & DAY-WISE WORKSPACE (GUIDED WORKSPACE) */
        /* ========================================================================= */
        <main className="w-full max-w-[1920px] mx-auto min-w-0 px-4 sm:px-6 py-6 pb-36">
          <StepByStepQuotationWorkspace
              activeStepId={activeStepId}
              setActiveStepId={setActiveStepId}
              currentDestination={currentDestination}
              destinations={activeB2BDestinations}
              onSelectDestination={handleDestinationChange}
              destinationHubs={destinationHubs}
              availableHotels={availableHotels}
              products={availableProducts}
              crmLeads={crmLeads}
              currency={currency}
              setCurrency={setCurrency}
              selectedLeadId={selectedLeadId}
              onSelectLead={handleSelectLead}
              clientName={clientName}
              setClientName={setClientName}
              clientEmail={clientEmail}
              setClientEmail={setClientEmail}
              clientCompany={clientCompany}
              setClientCompany={setClientCompany}
              clientPhone={clientPhone}
              setClientPhone={setClientPhone}
              agentNotes={agentNotes}
              setAgentNotes={setAgentNotes}
              tripType={tripType}
              setTripType={setTripType}
              quotationScope={quotationScope}
              setQuotationScope={handleChangeQuotationScope}
              startDate={startDate}
              setStartDate={handleChangeStartDate}
              endDate={endDate}
              setEndDate={handleChangeEndDate}
              tripNights={tripNights}
              adultsCount={adultsCount}
              setAdultsCount={handleSetAdultsCount}
              childrenCount={childrenCount}
              onSetChildrenCount={handleSetChildrenCount}
              infantsCount={infantsCount}
              setInfantsCount={handleSetInfantsCount}
              childAges={childAges}
              onUpdateChildAge={handleUpdateChildAge}
              passengerClassification={passengerClassification}
              nationality={nationality}
              setNationality={setNationality}
              travelStyle={travelStyle}
              setTravelStyle={setTravelStyle}
              mealPlanPreference={mealPlanPreference}
              setMealPlanPreference={setMealPlanPreference}
              roomingConfig={roomingConfig}
              setRoomingConfig={setRoomingConfig}
              visaAssistanceChoice={visaAssistanceChoice}
              setVisaAssistanceChoice={setVisaAssistanceChoice}
              routeHubs={routeHubs}
              setRouteHubs={handleUpdateRouteHubs}
              routeTotalNights={routeTotalNights}
              getHubDates={getHubDates}
              calendarDays={calendarDays}
              items={items}
              addProductToQuote={handleAddProductToQuoteSilently}
              removeProductFromQuote={removeProductFromQuote}
              updateItemPax={updateItemPax}
              updateItemTravelDate={updateItemTravelDate}
              updateItemServiceTime={updateItemServiceTime}
              updateItemNotes={updateItemNotes}
              updateItemAdditionalMarkup={updateItemAdditionalMarkup}
              adminBasePriceUpdatedNotification={adminBasePriceUpdatedNotification}
              onDismissAdminBasePriceNotification={handleDismissAdminBasePriceNotification}
              quoteCompanyId={quoteAgencyContext.companyId}
              quoteAgentId={quoteAgencyContext.agentId}
              quoteAgentAgency={quoteAgencyContext.agencyName}
              productLevelMarginEnabled={isProductLevelMarginActive}
              agentLevelMarginPercent={agencyPricingSettings.agentLevelMarginPercent}
              baseFinalSellingPrice={baseFinalSellingPrice}
              adminManualMarginType={adminManualMarginType}
              setAdminManualMarginType={handleSetAdminManualMarginType}
              adminManualMarginValue={adminManualMarginValue}
              setAdminManualMarginValue={handleSetAdminManualMarginValue}
              adminMarginMode={adminMarginMode}
              setAdminMarginMode={handleSetAdminMarginMode}
              onCommitAdminManualMarginAudit={handleCommitAdminManualMarginAudit}
              agentMarginType={agentMarginType}
              setAgentMarginType={handleSetAgentMarginType}
              agentMarginValue={agentMarginValue}
              setAgentMarginValue={handleSetAgentMarginValue}
              agentMarginAmount={additionalMarginAmount}
              finalCustomerSellingPrice={finalCustomerSellingPrice}
              agentMarkupPercent={agentMarginType === 'PERCENTAGE' ? agentMarginValue : 0}
              setAgentMarkupPercent={handleSetAgentMarkupPercentProp}
              overallDiscountPercent={overallDiscountPercent}
              setOverallDiscountPercent={setOverallDiscountPercent}
              totalNetCost={totalNetCost}
              totalSellingPrice={totalSellingPrice}
              finalClientPrice={finalCustomerSellingPrice}
              totalMarginAmount={totalMarginAmount}
              quotationOptions={computedQuotationOptions}
              activeOptionTab={activeOptionTab}
              onSelectOptionTab={handleSwitchOptionTab}
              transferSuggestions={transferSuggestions}
              onAddSuggestedTransfer={handleAddSuggestedTransfer}
              feasibility={feasibility}
              onOpenManualHotelModal={handleOpenAddManualHotel}
              onOpenVisaPickerModal={handleOpenVisaPickerModal}
              onOpenAddonModal={handleOpenAddonModal}
              onOpenQuickAddProductModal={handleOpenQuickAddModal}
              onOpenProductDetails={handleOpenProductDetails}
              onOpenCalculator={handleOpenCalculatorForStep}
              onSaveDraft={handleExplicitSaveDraft}
              onPreviewQuotation={handlePreviewProposal}
              onDownloadPDF={handleDownloadPDF}
              onShareWhatsApp={handleShareWhatsApp}
              onOpenEmailModal={handleOpenEmailModal}
              onConvertBooking={handleConvertBooking}
              onOpenSavePackageModal={handleOpenSavePackageModal}
              linkedMasterPackageId={linkedExistingMasterPackage?.id || null}
              linkedMasterPackageTitle={linkedExistingMasterPackage?.title || null}
              onViewSavedMasterPackage={handleViewSavedMasterPackageForStep}
              onNavigateToPackagesModule={handleNavigateToPackagesForStep}
              canSaveAsPackage={canSaveAsPackage}
              canAddManualHotel={canAddManualHotel}
              autoSaveStatus={autoSaveStatus}
              lastSavedTimestamp={lastSavedTimestamp}
              hasUnsavedChanges={hasUnsavedChanges}
              isSavingExplicitly={isSavingExplicitly}
              latestSavedVersion={latestSavedVersion}
              restoredFromVersion={restoredFromVersion}
              isReadOnlyHistoricalMode={isReadOnlyHistoricalMode}
              onOpenVersionHistory={handleOpenVersionHistoryForStep}
              precomputedQuoteBreakdown={liveQuoteBreakdown}
              onRetryAutoSave={handleExplicitSaveDraft}
              quoteNumber={quoteNumber}
              quoteVersion={quoteVersion}
              onSelectHotelForHub={handleSelectHotelForHub}
              onRemoveHotelForHub={handleRemoveHotelForHub}
              onOpenEditManualHotel={handleOpenEditManualHotel}
              onRemoveManualHotel={handleRemoveManualHotel}
              onSyncHubStayToHotelItems={handleSyncHubStayToHotelItems}
              onDeleteHubOccurrenceItems={handleDeleteHubOccurrenceItems}
              onOpenEditItem={handleOpenEditItem}
              dayThemes={dayThemes}
              setDayThemes={handleUpdateDayThemes}
              dayDescriptions={dayDescriptions}
              setDayDescriptions={handleUpdateDayDescriptions}
              itineraryOverview={itineraryOverview}
              setItineraryOverview={handleUpdateItineraryOverview}
              sourcePackageName={sourcePackageName}
              packagePricingStatus={packagePricingStatus}
              packagePricingError={packagePricingError}
              onRetryPackagePricing={handleRetryPackagePricing}
              quoteTitle={quoteTitle}
              setQuoteTitle={setQuoteTitle}
              brandingMode={brandingMode}
              setBrandingMode={setBrandingMode}
              onOpenCartDrawer={handleOpenCartDrawerForStep}
              termsReadiness={termsResolution.readiness}
              isFinalisedTermsLocked={termsResolution.isImmutableFrozen}
              termsSyncLoading={termsSyncLoading}
              canManageDestinationTerms={canManageDestinationTerms}
              isAdminTermsApprover={isAdminTermsApprover}
              hasDraftTermsUpdateAvailable={hasDraftTermsUpdateAvailable}
              adminMissingTermsNotified={adminMissingTermsNotifiedBool}
              onRefreshDraftTerms={handleRefreshDraftTerms}
              onNotifyAdminMissingTerms={handleNotifyAdminMissingTerms}
              onConfigureDestinationTerms={onConfigureDestinationTerms}
              onApproveTermsException={handleApproveTermsException}
              outputSyncError={outputSyncError}
              outputBusyOption={outputBusyOption}
            />
        </main>
      )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: QUICK ADD PRODUCT MODAL (CITY-FILTERED BY DAY) */}
      {/* ========================================================================= */}
      {quickAddModalDay && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[88vh] my-auto animate-scaleUp">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-teal-50/80 to-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] uppercase font-black text-teal-700 tracking-wider">Experience Catalog</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#00C6A6] text-white shadow-2xs">
                    📍 {quickAddModalDay.hubName || 'Unassigned Hub'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-200/80 text-slate-700">
                    Day {quickAddModalDay.dayNum} • {quickAddModalDay.dateString}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                  Browse Experiences for this day
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setQuickAddModalDay(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* City Tag Filter Bar & Scope Switcher */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center space-x-1.5 text-xs text-slate-700">
                  <span className="font-bold text-slate-900 flex items-center space-x-1">
                    <span>Target Hub:</span>
                    <span className="text-teal-800 bg-teal-100/70 px-2 py-0.5 rounded-md font-mono">
                      📍 {quickAddModalDay.hubName || 'No Hub Selected'}
                    </span>
                  </span>
                </div>

                {/* City vs All Toggle */}
                <div className="flex items-center space-x-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => {
                      setFilterByDayCityOnly(true);
                      setQuickAddCategory('ALL');
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      filterByDayCityOnly
                        ? 'bg-[#00C6A6] text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    📍 {quickAddModalDay.hubName || 'Assigned Hub'} Only ({totalCityProductsCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFilterByDayCityOnly(false);
                      setQuickAddCategory('ALL');
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      !filterByDayCityOnly
                        ? 'bg-[#00C6A6] text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    🌐 All {currentDestination.name} ({availableProducts.length})
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder={`Search ${filterByDayCityOnly ? quickAddModalDay.hubName : currentDestination.name} experiences, tours, transfers...`}
                  value={quickAddSearch}
                  onChange={(e) => setQuickAddSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-[#00C6A6]"
                />
                {quickAddSearch && (
                  <button
                    type="button"
                    onClick={() => setQuickAddSearch('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Category Pills (Dynamically computed from available products for this day/context) */}
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {quickAddAvailableCategories.map(catItem => {
                  const isSelected = quickAddCategory === catItem.id;
                  return (
                    <button
                      key={catItem.id}
                      type="button"
                      onClick={() => setQuickAddCategory(catItem.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1.5 ${
                        isSelected
                          ? 'bg-[#00C6A6] text-white shadow-2xs'
                          : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                      }`}
                    >
                      <span>{catItem.label}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                        isSelected 
                          ? 'bg-teal-900/30 text-white' 
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {catItem.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Product List */}
            <div className="p-4 overflow-y-auto space-y-2.5 flex-1 bg-slate-100/40">
              {quickAddFilteredProducts.length === 0 ? (
                <div className="text-center py-10 px-4 bg-white rounded-2xl border border-dashed border-slate-300 space-y-3">
                  <Compass className="w-8 h-8 text-slate-400 mx-auto" />
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-700">
                      {filterByDayCityOnly 
                        ? (!quickAddModalDay.hubName && !quickAddModalDay.hubId)
                          ? `No City Hub is assigned to Day ${quickAddModalDay.dayNum}.`
                          : `No products tagged for ${quickAddModalDay.hubName} Hub matching your filter.`
                        : `No products matching your search in ${currentDestination.name}.`
                      }
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {filterByDayCityOnly 
                        ? (!quickAddModalDay.hubName && !quickAddModalDay.hubId)
                          ? `Assign a City Hub in Step 2 (Route & City Plan) to receive Hub-matched recommendations, or switch to browse all ${currentDestination.name} products.`
                          : `You can switch to view all available products across ${currentDestination.name} or adjust your filters.`
                        : 'Try searching with different keywords or changing the category filter.'
                      }
                    </p>
                  </div>
                  {filterByDayCityOnly && (
                    <button
                      type="button"
                      onClick={() => setFilterByDayCityOnly(false)}
                      className="px-3.5 py-1.5 rounded-xl bg-teal-50 hover:bg-[#00C6A6] text-teal-800 hover:text-white border border-teal-200 text-xs font-bold transition-colors cursor-pointer"
                    >
                      Browse All {currentDestination.name} Products ({availableProducts.length})
                    </button>
                  )}
                </div>
              ) : (
                <>
                {quickAddFilteredProducts.slice(0, quickAddVisibleLimit).map(prod => (
                  <div
                    key={prod.id}
                    className="bg-white p-3.5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 hover:shadow-xs transition-all"
                  >
                    {/* Thumbnail & Product Details */}
                    <div className="flex items-start space-x-3 min-w-0 flex-1">
                      <img
                        src={canonicalImageService.resolveProductImage(prod)}
                        alt={prod.name}
                        width={64}
                        height={64}
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        className="w-16 h-16 rounded-xl object-cover border border-slate-200 shrink-0"
                        onError={(e) => {
                          const fallback = sanitizeImageUrl('', prod.category || prod.city);
                          if ((e.currentTarget as HTMLImageElement).src !== fallback) {
                            (e.currentTarget as HTMLImageElement).src = fallback;
                          }
                        }}
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {prod.category}
                          </span>
                          {(prod.city || quickAddModalDay.hubName) && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200 flex items-center space-x-1">
                              <span>📍</span>
                              <span>{prod.city || quickAddModalDay.hubName}</span>
                            </span>
                          )}
                          {prod.duration && (
                            <span className="text-[10px] text-slate-500">
                              ⏱️ {prod.duration}
                            </span>
                          )}
                        </div>

                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                          {prod.name}
                        </h4>
                        <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                          {prod.shortDescription || prod.description}
                        </p>

                        <div className="flex items-center space-x-3 text-[10px] text-slate-500 mt-1">
                          <span>Supplier: {prod.supplierName || 'DMC Verified'}</span>
                          {prod.pricing && (
                            <span className="font-mono text-slate-700 font-bold">
                              From: {formatCurrency(
                                convertCurrency(
                                  prod.pricing.sellingPrice || prod.pricing.costPrice || prod.adultNetPrice || 0,
                                  (prod.currency as CurrencyCode) || 'USD',
                                  currency
                                ),
                                currency
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions: View Details & Add to Day */}
                    <div className="flex items-center justify-end space-x-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleOpenProductDetails(prod)}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1 border border-slate-200"
                        title="View Product Details, Inclusions, Schedule & Supplier terms"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Details</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setConfiguringQuickAddProduct({
                            product: prod,
                            dateString: quickAddModalDay.dateString,
                            dayNum: quickAddModalDay.dayNum
                          });
                          setQuickAddModalDay(null);
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-[#00C6A6] hover:bg-[#00A88F] text-white font-bold text-xs transition-colors cursor-pointer shadow-xs flex items-center"
                      >
                        <span>Add to Day {quickAddModalDay.dayNum}</span>
                      </button>
                    </div>
                  </div>
                ))}
                {quickAddFilteredProducts.length > quickAddVisibleLimit && (
                  <div className="pt-2 flex justify-center">
                    <button
                      type="button"
                      onClick={() => setQuickAddVisibleLimit(prev => prev + 30)}
                      className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-xs font-bold text-slate-700 shadow-2xs cursor-pointer"
                    >
                      Show More Products ({quickAddFilteredProducts.length - quickAddVisibleLimit} remaining)
                    </button>
                  </div>
                )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EMAIL PROPOSAL (COMPLETE CANONICAL QUOTATION COMPOSER & PREVIEW) */}
      {/* ========================================================================= */}
      {isEmailModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full border border-slate-200 shadow-2xl animate-scaleUp my-auto max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-indigo-900 via-slate-900 to-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 flex items-center justify-center">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-bold text-white">Send Complete Quotation Email</h3>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-teal-500/20 text-[#00E5C0] border border-teal-400/30">
                      100% Quote Preview Parity
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Dispatches the complete day-by-day itinerary, hotels, rail, visa, inclusions, exclusions, and commercial terms.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEmailModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 overflow-y-auto grow">
              {/* Feedback Notifications */}
              {emailSuccessMessage && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 font-semibold flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{emailSuccessMessage}</span>
                </div>
              )}
              {emailErrorMessage && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 font-semibold">
                  {emailErrorMessage}
                </div>
              )}

              {/* Canonical Quotation Summary Strip & Branding Mode Switcher */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-bold bg-slate-900 text-[#00E5C0] px-2.5 py-1 rounded-lg">
                    {quoteNumber} (v{quoteVersion})
                  </span>
                  <span className="font-bold text-slate-800">{currentDestination.name}</span>
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-600">{tripNights + 1} Days / {tripNights} Nights</span>
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-600">{adultsCount} Adults{childrenCount > 0 ? `, ${childrenCount} Children` : ''}</span>
                  <span className="text-slate-400">•</span>
                  <span className="text-teal-700 font-bold">{items.length} Configured Services</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="inline-flex rounded-xl bg-white p-0.5 border border-slate-200">
                    <button
                      type="button"
                      onClick={() => {
                        setBrandingMode('STANDARD');
                        const targetQuote = emailModalQuote || authoritativeSavedQuote;
                        if (targetQuote) {
                          const snap = buildAgencyBrandingSnapshotFromUser(user, targetQuote, 'STANDARD');
                          const nextAuthSnap = buildAuthoritativeQuotationSnapshot(
                            { ...targetQuote, brandingMode: 'STANDARD', brandingSnapshot: snap },
                            {
                              existingSaved: targetQuote,
                              versionNumber: targetQuote.version || latestSavedVersion || 1,
                              selectedOptionIndexOrId: targetQuote.activeOptionId || `opt-${activeOptionTab}`,
                              brandingMode: 'STANDARD',
                              user,
                              preserveExistingPricingIfLocked: true
                            }
                          );
                          const updated: Quotation = {
                            ...targetQuote,
                            brandingMode: 'STANDARD',
                            brandingSnapshot: snap,
                            snapshotHash: nextAuthSnap.snapshotHash,
                            authoritativeSnapshot: nextAuthSnap
                          };
                          setEmailModalQuote(updated);
                          const canonical = refreshCanonicalEmailContent(updated, emailCustomNote, 'STANDARD');
                          setEmailSubject(canonical.subject);
                        }
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                        brandingMode === 'STANDARD' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Standard
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setBrandingMode('WHITE_LABEL');
                        const targetQuote = emailModalQuote || authoritativeSavedQuote;
                        if (targetQuote) {
                          const snap = buildAgencyBrandingSnapshotFromUser(user, targetQuote, 'WHITE_LABEL');
                          const nextAuthSnap = buildAuthoritativeQuotationSnapshot(
                            { ...targetQuote, brandingMode: 'WHITE_LABEL', brandingSnapshot: snap },
                            {
                              existingSaved: targetQuote,
                              versionNumber: targetQuote.version || latestSavedVersion || 1,
                              selectedOptionIndexOrId: targetQuote.activeOptionId || `opt-${activeOptionTab}`,
                              brandingMode: 'WHITE_LABEL',
                              user,
                              preserveExistingPricingIfLocked: true
                            }
                          );
                          const updated: Quotation = {
                            ...targetQuote,
                            brandingMode: 'WHITE_LABEL',
                            brandingSnapshot: snap,
                            snapshotHash: nextAuthSnap.snapshotHash,
                            authoritativeSnapshot: nextAuthSnap
                          };
                          setEmailModalQuote(updated);
                          const canonical = refreshCanonicalEmailContent(updated, emailCustomNote, 'WHITE_LABEL');
                          setEmailSubject(canonical.subject);
                        }
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                        brandingMode === 'WHITE_LABEL' ? 'bg-amber-600 text-white' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      White-Label
                    </button>
                  </div>
                  <div className="font-mono font-black text-sm text-slate-900">
                    Total: {formatCurrency(emailModalQuote?.authoritativeSnapshot?.pricing.finalCustomerSellingPrice ?? emailModalQuote?.finalCustomerSellingPrice ?? finalClientPrice, emailModalQuote?.currency || currency)}
                  </div>
                </div>
              </div>

              {/* Recipient, Subject & Optional Personal Note */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Recipient Email *</label>
                  <input
                    type="email"
                    value={emailRecipient}
                    onChange={(e) => setEmailRecipient(e.target.value)}
                    placeholder="client@example.com"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 font-mono outline-none focus:bg-white focus:border-[#00C6A6]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Email Subject Line *</label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 font-semibold outline-none focus:bg-white focus:border-[#00C6A6]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Personal Specialist Note <span className="text-slate-400 font-normal">(Optional — prepended to full quotation)</span>
                </label>
                <input
                  type="text"
                  value={emailCustomNote}
                  onChange={(e) => {
                    const nextNote = e.target.value;
                    setEmailCustomNote(nextNote);
                    if (emailModalQuote) {
                      refreshCanonicalEmailContent(emailModalQuote, nextNote);
                    }
                  }}
                  placeholder="e.g. Please find your complete day-by-day Japan quotation below. All bullet train and hotel allocations are held for 48 hours."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none focus:bg-white focus:border-[#00C6A6]"
                />
              </div>

              {/* Two Formatting Modes: Option 1 (Rich HTML Preview) vs Option 2 (Complete Formatted Quotation) */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setEmailPreviewTab('HTML_PREVIEW')}
                      className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center space-x-1.5 ${
                        emailPreviewTab === 'HTML_PREVIEW'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>Option 1: Rich HTML Quotation Preview</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">Proposal View</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEmailPreviewTab('FULL_TEXT')}
                      className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center space-x-1.5 ${
                        emailPreviewTab === 'FULL_TEXT'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>Option 2: Complete Formatted Quotation</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">Copy Rich Text</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyFormattedQuotation}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200 transition-colors cursor-pointer flex items-center space-x-1.5 shadow-2xs"
                    title="Copy formatted rich text quotation to clipboard (ready to paste into Gmail, Outlook, or docs)"
                  >
                    {emailCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700 font-extrabold">
                          {emailCopiedMode === 'RICH_HTML' ? 'Copied Formatted Quotation!' : 'Copied Plain-Text (Fallback)!'}
                        </span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Copy Formatted Quotation</span>
                      </>
                    )}
                  </button>
                </div>

                {emailPreviewTab === 'HTML_PREVIEW' ? (
                  <div className="space-y-1.5">
                    <div className="text-[11px] text-slate-500">
                      <span>Matches the authoritative <strong>Proposal View</strong> layout (responsive fluid email container, dark curated banner, route hubs, cards, and consolidated total).</span>
                    </div>
                    <div className="border border-slate-200 rounded-2xl bg-slate-100 p-2 sm:p-4 max-h-[420px] overflow-y-auto">
                      <div
                        className="bg-white rounded-xl shadow-xs overflow-hidden mx-auto"
                        dangerouslySetInnerHTML={{ __html: emailRichHtml || emailPreviewHtml }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="text-[11px] text-slate-500">
                        <span>Semantic rich-text quotation ready to copy & paste into email composers (preserves bold headings, lists & structure).</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={handleCopyFormattedQuotation}
                          className="px-3 py-1 rounded-lg cursor-pointer transition-all bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center space-x-1.5 shadow-2xs"
                          title="Copy formatted quotation (rich text) to paste into any email composer"
                        >
                          {emailCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>{emailCopiedMode === 'RICH_HTML' ? 'Copied Formatted Quotation!' : 'Copied (Fallback)!'}</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy Formatted Quotation</span>
                            </>
                          )}
                        </button>
                        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-medium">
                          <button
                            type="button"
                            onClick={() => setPlainTextSubView('PREVIEW')}
                            className={`px-2.5 py-1 rounded-md cursor-pointer transition-all ${
                              plainTextSubView === 'PREVIEW'
                                ? 'bg-slate-900 text-white font-bold'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Formatted Text Preview
                          </button>
                          <button
                            type="button"
                            onClick={() => setPlainTextSubView('EDIT')}
                            className={`px-2.5 py-1 rounded-md cursor-pointer transition-all ${
                              plainTextSubView === 'EDIT'
                                ? 'bg-slate-900 text-white font-bold'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Edit Quotation Text
                          </button>
                        </div>
                      </div>
                    </div>

                    {plainTextSubView === 'PREVIEW' ? (
                      <div className="border border-slate-200 rounded-2xl bg-slate-50 p-3 sm:p-4 max-h-[420px] overflow-y-auto">
                        <div
                          className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-xs mx-auto max-w-2xl text-left"
                          dangerouslySetInnerHTML={{
                            __html: emailSimpleHtml || formatPlainTextQuotationToHtml(emailMessage)
                          }}
                        />
                      </div>
                    ) : (
                      <textarea
                        rows={15}
                        value={emailMessage}
                        onChange={(e) => {
                          const nextMsg = e.target.value;
                          setEmailMessage(nextMsg);
                          setEmailSimpleHtml(formatPlainTextQuotationToHtml(nextMsg));
                        }}
                        className="w-full p-3.5 rounded-2xl bg-slate-900 text-slate-100 border border-slate-800 text-xs font-mono leading-relaxed outline-none focus:border-[#00C6A6]"
                      />
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center space-x-2">
                <a
                  href={`mailto:${encodeURIComponent(emailRecipient)}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailMessage.slice(0, 1800))}`}
                  className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 transition-colors no-underline"
                  title="Open in your default desktop/mobile email app"
                >
                  Open in Mail App
                </a>
              </div>

              <div className="flex items-center space-x-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setIsEmailModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-200/70 text-slate-700 text-xs font-bold hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSendingEmail || !emailRecipient}
                  onClick={handleSendProposalEmail}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black disabled:opacity-50 flex items-center space-x-2 cursor-pointer shadow-md shadow-indigo-600/20"
                >
                  {isSendingEmail ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending Quotation...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>
                        {emailPreviewTab === 'HTML_PREVIEW'
                          ? 'Send Proposal View Email'
                          : 'Send Plain-Text Quotation Email'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SHARE ON WHATSAPP MODAL */}
      {/* ========================================================================= */}
      {isWhatsAppModalOpen && whatsAppModalQuote && (
        <ShareWhatsAppModal
          quote={whatsAppModalQuote}
          user={user}
          selectedOptionIndex={Math.max(0, activeOptionTab - 1)}
          onClose={() => {
            setIsWhatsAppModalOpen(false);
            setWhatsAppModalQuote(null);
          }}
          onBrandingModeChange={(mode) => {
            setBrandingMode(mode);
            const targetQuote = whatsAppModalQuote || authoritativeSavedQuote;
            if (targetQuote) {
              const snap = buildAgencyBrandingSnapshotFromUser(user, targetQuote, mode);
              const nextAuthSnap = buildAuthoritativeQuotationSnapshot(
                { ...targetQuote, brandingMode: mode, brandingSnapshot: snap },
                {
                  existingSaved: targetQuote,
                  versionNumber: targetQuote.version || latestSavedVersion || 1,
                  selectedOptionIndexOrId: targetQuote.activeOptionId || `opt-${activeOptionTab}`,
                  brandingMode: mode,
                  user,
                  preserveExistingPricingIfLocked: true
                }
              );
              setWhatsAppModalQuote({
                ...targetQuote,
                brandingMode: mode,
                brandingSnapshot: snap,
                snapshotHash: nextAuthSnap.snapshotHash,
                authoritativeSnapshot: nextAuthSnap
              });
            }
          }}
          onSuccess={(updatedQuote) => {
            if (updatedQuote.clientPhone && setClientPhone) {
              setClientPhone(updatedQuote.clientPhone);
            }
            const rec = recordQuotationGenerationEvent(db, updatedQuote, {
              outputOption: 'SHARE_WHATSAPP',
              status: 'SUCCEEDED',
              brandingMode: updatedQuote.brandingMode || brandingMode,
              selectedOptionId: updatedQuote.activeOptionId || `opt-${activeOptionTab}`,
              recipient: updatedQuote.lastSharedRecipientPhone || updatedQuote.clientPhone,
              user
            });
            setAuthoritativeSavedQuote(rec.updatedQuote);
            setWhatsAppModalQuote(rec.updatedQuote);
            setLoadedQuoteStatus(rec.updatedQuote.status);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: JAPAN RAIL JOURNEY SELECTION & CONFIGURATOR */}
      {/* ========================================================================= */}
      {(inspectingProduct || editingRailItem) && (
        (inspectingProduct && isRailProduct(inspectingProduct)) ||
        editingRailItem
      ) && (
        <RailJourneyModal
          product={editingRailItem?.product || inspectingProduct!}
          portalOrigin="B2B_QUOTE_BUILDER"
          existingQuoteItemId={editingRailItem?.id}
          existingJourneySnapshot={editingRailItem?.japanRailJourneySnapshot || (editingRailItem as any)?.metadata?.journeySnapshot || (editingRailItem as any)?.railJourneyDetails}
          initialOriginStationId={editingRailItem?.railJourneyDetails?.originStationId || 'JP-ST-TOKYO'}
          initialDestinationStationId={editingRailItem?.railJourneyDetails?.destinationStationId || 'JP-ST-KYOTO'}
          onClose={() => {
            setInspectingProduct(null);
            setEditingRailItem(null);
          }}
          onAddToQuote={(item) => {
            if (editingRailItem) {
              removeProductFromQuote(editingRailItem.id);
            }
            setInspectingProduct(null);
            setEditingRailItem(null);
            showBuilderToast(editingRailItem ? `✓ Updated Shinkansen Journey in Quote` : `✓ Added Shinkansen Journey to Quote`, 'SUCCESS');
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: AUTHORITATIVE DEDICATED CATEGORY CONFIGURATOR ROUTER */}
      {/* ========================================================================= */}
      {editingServiceItem && (
        <GlobalConfiguratorRouter
          isOpen={true}
          itemOrProduct={editingServiceItem}
          portalOrigin="B2B_QUOTE_BUILDER"
          existingQuoteItemId={editingServiceItem.id}
          initialTravelDate={editingServiceItem.travelDate}
          initialAdults={editingServiceItem.pax?.adults || adultsCount}
          initialChildren={editingServiceItem.pax?.children || childrenCount}
          initialInfants={editingServiceItem.pax?.infants || infantsCount}
          initialServiceTime={editingServiceItem.serviceTime}
          initialNotes={editingServiceItem.notes}
          onClose={() => setEditingServiceItem(null)}
          onSuccess={() => {
            setEditingServiceItem(null);
            showBuilderToast('✓ Service configuration updated (unsaved until Save Draft)', 'SUCCESS');
          }}
        />
      )}

      {configuringQuickAddProduct && (
        <GlobalConfiguratorRouter
          isOpen={true}
          itemOrProduct={configuringQuickAddProduct.product}
          portalOrigin="B2B_QUOTE_BUILDER"
          initialTravelDate={configuringQuickAddProduct.dateString}
          initialAdults={adultsCount}
          initialChildren={childrenCount}
          initialInfants={infantsCount}
          onClose={() => setConfiguringQuickAddProduct(null)}
          onSuccess={(configuredItem) => {
            const dayNum = configuringQuickAddProduct.dayNum;
            const prodName = configuredItem?.name || configuringQuickAddProduct.product.name;
            setConfiguringQuickAddProduct(null);
            setQuickAddModalDay(null);
            showBuilderToast(`✓ Added ${prodName} to Day ${dayNum} (click Save Draft to persist)`, 'SUCCESS');
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: PRODUCT DETAIL MODAL */}
      {/* ========================================================================= */}
      {inspectingProduct && !isRailProduct(inspectingProduct) && (
        <B2BViewDetailsModal
          product={inspectingProduct}
          onClose={() => setInspectingProduct(null)}
          onOpenCalculator={(prod) => {
            setInspectingProduct(null);
            setCalculatorProduct(prod);
          }}
          onBookProduct={(prod, initialDate, adults, children) => {
            addProductToQuote(prod, {
              adults: adults || adultsCount,
              children: children || childrenCount,
              infants: infantsCount,
              travelDate: quickAddModalDay?.dateString || initialDate || startDate,
              openDrawer: false
            });
            setInspectingProduct(null);
            setQuickAddModalDay(null);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: PRICING CALCULATOR MODAL */}
      {/* ========================================================================= */}
      {calculatorProduct && !isRailProduct(calculatorProduct) && (
        <PricingCalculatorModal
          product={calculatorProduct}
          portalOrigin="B2B_QUOTE_BUILDER"
          onClose={() => setCalculatorProduct(null)}
          onAddedToQuote={() => {
            setCalculatorProduct(null);
            setQuickAddModalDay(null);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: MANUAL HOTEL / RATE ENTRY MODAL */}
      {/* ========================================================================= */}
      <ManualHotelFormModal
        isOpen={isManualHotelModalOpen}
        onClose={() => setIsManualHotelModalOpen(false)}
        onSave={handleSaveManualHotel}
        initialData={manualHotelModalInitialData}
        routeHubs={routeHubs}
        defaultHubId={manualHotelModalHubId}
        getHubDates={getHubDates}
        quoteCurrency={currency}
        agentMarkupPercent={agentMarkupPercent}
        adultsCount={adultsCount}
        childrenCount={childrenCount}
        infantsCount={infantsCount}
      />

      {/* ========================================================================= */}
      {/* MODAL: SAVE AS MASTER READY-MADE PACKAGE MODAL */}
      {/* ========================================================================= */}
      {isSavePackageModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-scaleUp my-auto max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-[#008972] text-white flex items-center justify-center">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-black">
                      {linkedExistingMasterPackage && packageFormData.updateExisting
                        ? 'Update Synchronized Master Package'
                        : 'Save as Ready-Made Master Package'}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/20 text-[#00E5C0] border border-teal-400/30">
                      Centralized Pricing Engine
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Synchronizes complete itinerary, hotels, products, and live B2B pricing to Ready-Made Packages.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSavePackageModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700/50 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Fields */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {savePackageError && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-bold flex items-start space-x-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{savePackageError}</span>
                </div>
              )}

              {/* Existing Master Package Synchronization Banner */}
              {linkedExistingMasterPackage && (
                <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200 flex flex-wrap items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="text-[11px] font-black text-emerald-900 flex items-center space-x-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Linked Master Package ID: <code className="font-mono">{linkedExistingMasterPackage.id}</code></span>
                    </div>
                    <p className="text-[11px] text-emerald-700">
                      {packageFormData.updateExisting
                        ? 'Saving will update the existing Ready-Made Package without creating duplicates.'
                        : 'Saving will create a separate new Master Package in the catalog.'}
                    </p>
                  </div>
                  <div className="inline-flex rounded-xl bg-white p-0.5 border border-emerald-200 text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setPackageFormData(prev => ({ ...prev, updateExisting: true }))}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        packageFormData.updateExisting
                          ? 'bg-emerald-700 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Update Existing
                    </button>
                    <button
                      type="button"
                      onClick={() => setPackageFormData(prev => ({ ...prev, updateExisting: false }))}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        !packageFormData.updateExisting
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Save as New
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Package Title *</label>
                <input
                  type="text"
                  value={packageFormData.title}
                  onChange={(e) => setPackageFormData({ ...packageFormData, title: e.target.value })}
                  placeholder="e.g. Tokyo & Kyoto Imperial Heritage Circuit"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 font-bold focus:bg-white focus:border-[#008972] outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Tagline</label>
                <input
                  type="text"
                  value={packageFormData.tagline}
                  onChange={(e) => setPackageFormData({ ...packageFormData, tagline: e.target.value })}
                  placeholder="e.g. 5 Nights / 6 Days Classic Japan with 5★ Stays & Shinkansen"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:border-[#008972] outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Full Description</label>
                <textarea
                  rows={3}
                  value={packageFormData.description}
                  onChange={(e) => setPackageFormData({ ...packageFormData, description: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:border-[#008972] outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Package Category</label>
                  <select
                    value={packageFormData.tripType}
                    onChange={(e) => setPackageFormData({ ...packageFormData, tripType: e.target.value as B2BPackage['tripType'] })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 font-bold outline-none"
                  >
                    <option value="LUXURY">LUXURY (5-Star)</option>
                    <option value="CULTURAL">CULTURAL & HERITAGE</option>
                    <option value="HONEYMOON">HONEYMOON ESCAPE</option>
                    <option value="FAMILY">FAMILY CIRCUIT</option>
                    <option value="ADVENTURE">ADVENTURE & NATURE</option>
                    <option value="CLASSIC">CLASSIC DISCOVERY</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Catalog Status</label>
                  <select
                    value={packageFormData.status}
                    onChange={(e) => setPackageFormData({ ...packageFormData, status: e.target.value as 'PUBLISHED' | 'DRAFT' })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 font-bold outline-none"
                  >
                    <option value="PUBLISHED">PUBLISHED (Live for B2B Agents)</option>
                    <option value="DRAFT">DRAFT (Internal CMS Only)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Featured Visibility</label>
                  <button
                    type="button"
                    onClick={() => setPackageFormData(prev => ({ ...prev, featured: !prev.featured }))}
                    className={`w-full px-3 py-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer flex items-center justify-between ${
                      packageFormData.featured
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <span>{packageFormData.featured ? 'Featured Circuit' : 'Standard Circuit'}</span>
                    <span className={`w-2 h-2 rounded-full ${packageFormData.featured ? 'bg-emerald-600' : 'bg-slate-400'}`} />
                  </button>
                </div>
              </div>

              {/* Synchronized Structure & Centralized Pricing Engine Summary */}
              {liveMasterPackagePreview && (
                <div className="space-y-3">
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Duration</span>
                      <span className="font-extrabold text-slate-800">
                        {liveMasterPackagePreview.pkg.durationNights}N / {liveMasterPackagePreview.pkg.durationDays}D
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Route Hubs</span>
                      <span className="font-extrabold text-slate-800">
                        {(liveMasterPackagePreview.pkg.routeHubs || []).length || 1} City Hubs
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Accommodations</span>
                      <span className="font-extrabold text-slate-800">
                        {quotationScope === 'LAND_ONLY'
                          ? 'Land-Only'
                          : `${(liveMasterPackagePreview.pkg.hotelsSummary || []).length} Stays`}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Linked Services</span>
                      <span className="font-extrabold text-slate-800">
                        {(liveMasterPackagePreview.pkg.productIds || []).length} Products
                      </span>
                    </div>
                  </div>

                  {/* Admin Centralized Pricing Breakdown: Nett Price & Calculated Selling Price */}
                  <div className="p-4 bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl text-white flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                        Nett Price (Centralized Engine)
                      </span>
                      <span className="text-base font-black font-mono text-slate-100">
                        {formatCurrency(liveMasterPackagePreview.livePricing.netPriceTarget, currency)}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        Live sum of product & hotel Nett tariffs ({adultsCount} Adults{childrenCount > 0 ? `, ${childrenCount} Children` : ''})
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-[#00E5C0] tracking-wider block">
                        Calculated Selling Price
                      </span>
                      <span className="text-lg font-black font-mono text-[#00E5C0]">
                        {formatCurrency(liveMasterPackagePreview.livePricing.sellingPriceTarget, currency)}
                      </span>
                      <span className="text-[10px] text-slate-300 block">
                        Dynamic B2B selling price (no fixed manual margin)
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <span className="text-[11px] text-slate-500 font-semibold">
                Synchronizes directly with Ready-Made Packages & B2B Agent Portal.
              </span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setIsSavePackageModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSavePackage}
                  disabled={!packageFormData.title.trim()}
                  className="px-5 py-2 rounded-xl bg-[#008972] hover:bg-[#007360] text-white text-xs font-black transition-all cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {linkedExistingMasterPackage && packageFormData.updateExisting
                    ? 'Update Master Package'
                    : 'Save as Master Package'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Package Saved Banner with Direct View Ready-Made Package Action */}
      {packageSavedNotice && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-950 text-white border border-[#00C6A6]/50 p-4 rounded-2xl shadow-2xl max-w-md w-full animate-slideUp space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-xl bg-[#008972] text-white flex items-center justify-center shrink-0 mt-0.5">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-black text-white">{packageSavedNotice}</p>
                {lastPackageVerificationReport && (
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Verified {lastPackageVerificationReport.itineraryDaysCount} itinerary days, {lastPackageVerificationReport.verifiedProductsCount} linked products • Nett {formatCurrency(lastPackageVerificationReport.netPriceTarget, lastPackageVerificationReport.currency)} / Selling {formatCurrency(lastPackageVerificationReport.sellingPriceTarget, lastPackageVerificationReport.currency)}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPackageSavedNotice(null)}
              className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800">
            {lastSavedMasterPackage && (
              <button
                type="button"
                onClick={() => {
                  const latestPkg = db.getPackages().find(p => p.id === lastSavedMasterPackage.id) || lastSavedMasterPackage;
                  setViewingSavedMasterPackage(latestPkg);
                }}
                className="px-3 py-1.5 rounded-xl bg-[#008972] hover:bg-[#007360] text-white text-[11px] font-bold transition-colors cursor-pointer flex items-center space-x-1.5"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View Ready-Made Package</span>
              </button>
            )}
            {onNavigateToPackages && lastSavedMasterPackage && (
              <button
                type="button"
                onClick={() => {
                  setPackageSavedNotice(null);
                  onNavigateToPackages(lastSavedMasterPackage.id);
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold transition-colors cursor-pointer"
              >
                Open Ready-Made Packages
              </button>
            )}
          </div>
        </div>
      )}

      {/* Ready-Made Package Detail Modal (View Generated Package Directly) */}
      {viewingSavedMasterPackage && (
        <PackageDetailModal
          pkg={viewingSavedMasterPackage}
          onClose={() => setViewingSavedMasterPackage(null)}
          onCustomizeInBuilder={(pkgToCustomize) => {
            setViewingSavedMasterPackage(null);
            showBuilderToast(`Package "${pkgToCustomize.title}" is already loaded in this workspace.`, 'INFO');
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: VISA CATALOG PICKER MODAL */}
      {/* ========================================================================= */}
      {showVisaPickerModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-scaleUp my-auto flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-4 sm:p-6 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Visa & Ancillary Services Catalog</h3>
                  <p className="text-xs text-slate-400">Browse verified B2B eVisas and consular facilitation from Master Inventory.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowVisaPickerModal(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Filter Bar */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-3 shrink-0">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={visaPickerSearch}
                  onChange={(e) => setVisaPickerSearch(e.target.value)}
                  placeholder="Search by country, visa type, or code (e.g. Japan, Schengen, eVisa)..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 font-medium outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
                {['ALL', 'SINGLE_ENTRY', 'MULTIPLE_ENTRY'].map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setVisaPickerCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      visaPickerCategory === cat
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {cat === 'ALL' ? 'ALL' : cat.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* List of Visas */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-3 flex-1">
              {(() => {
                const activeVisas = inventoryVisibilityService.getB2BActiveVisas();
                const filtered = activeVisas.filter(visa => {
                  const q = (visaPickerSearch || '').trim().toLowerCase();
                  const matchesSearch = !q || 
                    (visa.country || '').toLowerCase().includes(q) ||
                    (visa.visaType || '').toLowerCase().includes(q) ||
                    (visa.description || '').toLowerCase().includes(q);
                  const matchesCat = visaPickerCategory === 'ALL' || visa.entryType === visaPickerCategory;
                  return matchesSearch && matchesCat;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="p-8 text-center text-slate-500 space-y-2">
                      <p className="text-xs font-bold">No active Visa & Ancillary Services are available.</p>
                      <p className="text-[11px] text-slate-400">Products saved in Operations & Inventory → Visa & Ancillary Services will appear here dynamically.</p>
                    </div>
                  );
                }

                return filtered.map(visa => {
                  const isCurrentDest = (visa.country || '').toLowerCase() === (currentDestination?.name || '').toLowerCase();
                  const alreadyInQuote = isVisaInQuote(visa.id);
                  const totalFeeUSD = (visa.embassyFee || 0) + (visa.serviceFee || 0);

                  return (
                    <div
                      key={visa.id}
                      className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                        isCurrentDest 
                          ? 'bg-emerald-50/40 border-emerald-300 hover:border-emerald-500' 
                          : 'bg-slate-50 hover:bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-black text-slate-900 flex items-center space-x-1.5">
                            <span>{visa.country}</span>
                            <span className="text-slate-400">•</span>
                            <span className="text-emerald-700">{visa.visaType}</span>
                          </span>
                          {isCurrentDest && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white">
                              Current Destination
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white text-slate-600 border border-slate-200">
                            {visa.entryType?.replace('_', ' ') || 'Single Entry'}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                          <span className="flex items-center space-x-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>{visa.processingTimeDays} Days Processing</span>
                          </span>
                          <span>•</span>
                          <span>Validity: {visa.validityDays} Days</span>
                          <span>•</span>
                          <span>Stay: {visa.stayDurationDays} Days</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200">
                        <div className="text-left sm:text-right">
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Selling Price</span>
                          {totalFeeUSD > 0 ? (
                            <span className="text-sm font-black text-slate-900 font-mono">
                              {formatCurrency(convertCurrency(totalFeeUSD, visa.currency || 'USD', currency), currency)}
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-amber-700">Price unavailable for this service.</span>
                          )}
                        </div>

                        <button
                          type="button"
                          disabled={totalFeeUSD <= 0}
                          onClick={() => {
                            if (totalFeeUSD <= 0) return;
                            setShowVisaPickerModal(false);
                            setSelectedVisaForQuoteModal(visa);
                          }}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs ${
                            totalFeeUSD <= 0
                              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                              : alreadyInQuote
                              ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300 cursor-pointer'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                          }`}
                        >
                          {alreadyInQuote ? 'Configure Additional' : 'Configure & Add'}
                        </button>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-slate-500 font-medium">
                Showing {inventoryVisibilityService.getB2BActiveVisas().length} verified production visa pathways from Master Inventory.
              </span>
              <button
                type="button"
                onClick={() => setShowVisaPickerModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD VISA TO QUOTE DETAILED CONFIGURATION MODAL */}
      {/* ========================================================================= */}
      {selectedVisaForQuoteModal && (
        <AddVisaToQuoteModal
          visa={selectedVisaForQuoteModal}
          isOpen={Boolean(selectedVisaForQuoteModal)}
          portalOrigin="B2B_QUOTE_BUILDER"
          onClose={() => setSelectedVisaForQuoteModal(null)}
          initialTravelDate={startDate}
          initialApplicants={adultsCount + childrenCount}
          onSuccess={(visa, details) => {
            setSelectedVisaForQuoteModal(null);
            showBuilderToast(`✓ Visa facilitation added (${visa.name}) — click Save Draft to save version`, 'SUCCESS');
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: COMPREHENSIVE ADDONS (INSURANCE, ESIM, VIP SERVICES) */}
      {/* ========================================================================= */}
      {showAddonModal && (
        <AddAddonModal
          isOpen={showAddonModal}
          category={addonModalCategory}
          onClose={() => setShowAddonModal(false)}
          onAddAddon={(prod) => {
            handleAddProductToQuoteSilently(prod, {
              adults: adultsCount,
              children: childrenCount,
              infants: infantsCount,
              travelDate: startDate
            });
            setShowAddonModal(false);
          }}
          destinationName={currentDestination.name}
          durationNights={tripNights}
          adultsCount={adultsCount}
          childrenCount={childrenCount}
          currency={currency}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: OPTION COMPARISON MATRIX (OPTION 1, OPTION 2, OPTION 3) */}
      {/* ========================================================================= */}
      {showComparisonMatrixModal && (
        <OptionComparisonMatrixModal
          isOpen={showComparisonMatrixModal}
          onClose={() => setShowComparisonMatrixModal(false)}
          options={computedQuotationOptions}
          activeOptionNumber={activeOptionTab}
          currency={currency}
          onSelectOption={(optNum) => {
            handleSwitchOptionTab(optNum);
            setShowComparisonMatrixModal(false);
          }}
          onDuplicateOption={(fromNum, toNum) => {
            handleDuplicateOption(fromNum, toNum);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: DUPLICATE OPTION MODAL */}
      {/* ========================================================================= */}
      {showDuplicateOptionModal && (
        <OptionDuplicateModal
          isOpen={showDuplicateOptionModal}
          onClose={() => setShowDuplicateOptionModal(false)}
          sourceOptionNumber={activeOptionTab}
          options={computedQuotationOptions}
          onConfirmDuplicate={(fromNum, toNum) => {
            handleDuplicateOption(fromNum, toNum);
            setShowDuplicateOptionModal(false);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: DESTINATION CHANGE SANITIZATION CONFIRMATION */}
      {/* ========================================================================= */}
      {showDestinationChangeModal && pendingDestination && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-150 my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Switch Destination?</h3>
                <p className="text-xs text-slate-500">From {currentDestination.name} to {pendingDestination.name}</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Your quote currently has inventory items or itinerary hubs configured for <strong>{currentDestination.name}</strong>. Switching destination will remove items and hubs that do not belong to <strong>{pendingDestination.name}</strong> to prevent incompatible travel bookings.
            </p>
            <div className="flex items-center justify-end space-x-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setPendingDestination(null);
                  setShowDestinationChangeModal(false);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDestinationChange}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 transition-colors shadow-xs cursor-pointer"
              >
                Switch to {pendingDestination.name}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: QUOTATION VERSION HISTORY & COMPARE */}
      {/* ========================================================================= */}
      {isVersionHistoryModalOpen && hasExplicitlySaved && (
        <QuotationVersionHistoryModal
          isOpen={isVersionHistoryModalOpen}
          onClose={() => setIsVersionHistoryModalOpen(false)}
          quoteId={activeQuoteId}
          initialQuote={authoritativeSavedQuote}
          currentUser={user}
          onOpenVersion={(qId, ver, m) => handleSwitchBuilderVersion(qId, ver, m)}
          onRestoreVersion={(qId, ver) => handleSwitchBuilderVersion(qId, ver, 'restore')}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: OUTPUT ACTION UNSAVED CHANGES GATE */}
      {/* ========================================================================= */}
      {pendingOutputRequest && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">Unsaved Working Changes</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Action: <strong>{pendingOutputRequest.label}</strong>
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              {!hasExplicitlySaved
                ? 'This quotation has not been saved yet. Save Draft v1 first so all outputs (Preview, PDF, Email, WhatsApp, Booking) use the exact authoritative saved snapshot.'
                : `You have unsaved edits in the builder. Latest saved version is v${latestSavedVersion}. Would you like to explicitly Save Draft v${latestSavedVersion + 1} before running ${pendingOutputRequest.label}?`}
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                disabled={isSavingExplicitly}
                onClick={async () => {
                  const req = pendingOutputRequest;
                  setPendingOutputRequest(null);
                  const saved = await handleExplicitSaveDraft();
                  if (saved) {
                    await req.onResolved(saved);
                  }
                }}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-[#00E5C0] text-xs font-black cursor-pointer disabled:opacity-50"
              >
                {hasExplicitlySaved ? `Save Draft v${latestSavedVersion + 1} & Continue` : 'Save Draft v1 & Continue'}
              </button>
              {hasExplicitlySaved && authoritativeSavedQuote && (
                <button
                  type="button"
                  onClick={async () => {
                    const req = pendingOutputRequest;
                    setPendingOutputRequest(null);
                    setOutputBusyOption(req.option);
                    setOutputSyncError(null);
                    try {
                      let baseSaved = db.getQuoteByIdAuthorized(authoritativeSavedQuote.id, user) || authoritativeSavedQuote;
                      const needsHydrate =
                        !baseSaved.items ||
                        baseSaved.items.length === 0 ||
                        baseSaved.items.some((it: any) => Boolean(it?.__dehydratedToVersionId)) ||
                        (baseSaved.options || []).some((o: any) => Boolean((o as any)?.__dehydratedToVersionId));
                      if ((baseSaved.masterHydratedFromVersionId || baseSaved.latestVersionId) && needsHydrate) {
                        const verRef = baseSaved.masterHydratedFromVersionId || baseSaved.latestVersionId || Number(baseSaved.latestVersion || baseSaved.version || 1);
                        baseSaved = (await withBoundedTimeout(
                          db.hydrateMasterQuotationFromVersionAsync(baseSaved.id, verRef, user),
                          15000,
                          'Hydrate Saved Quotation'
                        )) || baseSaved;
                      }
                      const modeToUse = brandingMode || baseSaved.brandingMode || 'STANDARD';
                      const bSnap = baseSaved.brandingSnapshot?.mode === modeToUse
                        ? baseSaved.brandingSnapshot
                        : buildAgencyBrandingSnapshotFromUser(user, baseSaved, modeToUse);
                      const candidate: Quotation = {
                        ...baseSaved,
                        activeOptionId: `opt-${activeOptionTab}`,
                        brandingMode: modeToUse,
                        brandingSnapshot: bSnap
                      };
                      const savedVerNum = latestSavedVersion || baseSaved.version || 1;
                      const builtSnap = buildAuthoritativeQuotationSnapshot(candidate, {
                        existingSaved: baseSaved,
                        versionNumber: savedVerNum,
                        selectedOptionIndexOrId: `opt-${activeOptionTab}`,
                        brandingMode: modeToUse,
                        user,
                        preserveExistingPricingIfLocked: Boolean(baseSaved.isLocked)
                      });
                      const preparedSaved: Quotation = {
                        ...candidate,
                        snapshotHash: builtSnap.snapshotHash,
                        snapshotVersion: builtSnap.versionNumber,
                        authoritativeSnapshot: builtSnap
                      };
                      const report = validateQuotationOutputConsistency(preparedSaved, {
                        selectedOptionIndexOrId: preparedSaved.activeOptionId,
                        brandingMode: modeToUse
                      });
                      if (!report.isValid) {
                        const msg = `Synchronisation check blocked ${req.label}: ${report.mismatches[0]}`;
                        setOutputSyncError(msg);
                        showBuilderToast(msg, 'WARNING');
                        return;
                      }
                      await req.onResolved(preparedSaved);
                    } catch (err: any) {
                      const msg = err?.message || `Failed to prepare last saved snapshot for ${req.label}.`;
                      setOutputSyncError(msg);
                      showBuilderToast(msg, 'WARNING');
                    } finally {
                      setOutputBusyOption(null);
                    }
                  }}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  Use Last Saved v{latestSavedVersion} Without Saving Edits
                </button>
              )}
              <button
                type="button"
                onClick={() => setPendingOutputRequest(null)}
                className="w-full px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: LEAVE QUOTE BUILDER UNSAVED GUARD */}
      {/* ========================================================================= */}
      {pendingLeaveAction && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">Leave With Unsaved Changes?</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Quotation #{quoteNumber}
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Your working edits are not saved and will <strong>not</strong> be autosaved. Click <strong>Continue Editing</strong> if you want to save a draft first, or <strong>Leave Without Saving</strong> to discard working changes.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPendingLeaveAction(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-[#00E5C0] text-xs font-black cursor-pointer"
              >
                Continue Editing
              </button>
              <button
                type="button"
                onClick={() => {
                  const act = pendingLeaveAction;
                  setPendingLeaveAction(null);
                  act();
                }}
                className="px-4 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold cursor-pointer"
              >
                Leave Without Saving
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* FLOATING IN-BUILDER TOAST NOTIFICATION */}
      {/* ========================================================================= */}
      {builderToast && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce-short shadow-2xl">
          <div className={`px-4 py-3 rounded-2xl flex items-center space-x-3 text-xs font-bold border ${
            builderToast.type === 'SUCCESS'
              ? 'bg-slate-900 text-[#00E5C0] border-teal-500/40 shadow-teal-500/10'
              : builderToast.type === 'WARNING'
              ? 'bg-amber-900 text-amber-200 border-amber-500/40 shadow-amber-500/10'
              : 'bg-slate-900 text-white border-slate-700 shadow-black/20'
          }`}>
            <div className="w-6 h-6 rounded-full bg-[#00E5C0]/20 text-[#00E5C0] flex items-center justify-center shrink-0">
              <Check className="w-3.5 h-3.5" />
            </div>
            <span>{builderToast.message}</span>
            <button
              type="button"
              onClick={() => setBuilderToast(null)}
              className="text-slate-400 hover:text-white p-1 ml-2 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const UnifiedB2BQuotationBuilder = React.memo(UnifiedB2BQuotationBuilderBase);
