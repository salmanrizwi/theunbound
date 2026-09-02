import React, { useState, useMemo, useEffect } from 'react';
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
  Check
} from 'lucide-react';
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
  PackageItineraryDay
} from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useQuotation } from '../../context/QuotationContext';
import { formatCurrency, convertCurrency } from '../../services/pricingEngine';
import { ProposalDocumentView } from '../ProposalDocumentView';
import { ProductDetailModal } from '../ProductDetailModal';
import { PricingCalculatorModal } from '../PricingCalculatorModal';
import { ManualHotelFormModal } from './ManualHotelFormModal';
import { VISA_CATALOG, VisaProduct } from './B2BVisaView';
import { AddVisaToQuoteModal, visaProductToProduct } from './AddVisaToQuoteModal';
import { AddAddonModal } from './AddAddonModal';
import { 
  classifyPassengers, 
  STANDARD_OPERATIONAL_REMARKS, 
  generateTransferSuggestions, 
  checkItineraryFeasibility,
  TransferSuggestion
} from '../../utils/b2bQuotationHelpers';
import { AppDatabase } from '../../services/db';
import { hotelToProduct, manualHotelToProduct, calculateHotelStayPrice, validateRoomOccupancy, OccupancyValidationResult } from '../../utils/hotelHelpers';
import { downloadQuotationPDF } from '../../services/pdfGenerator';
import { googleCalendarAutomation } from '../../services/googleCalendarAutomationService';
import { EmailNotificationService } from '../../services/emailNotificationService';

export type QuotationScope = 'HOTEL_LAND' | 'LAND_ONLY' | 'HOTEL_ONLY';

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

export interface UnifiedB2BQuotationBuilderProps {
  initialDestinationSlug?: string;
  destinations?: Destination[];
  products?: Product[];
  hotels?: Hotel[];
  cityHubs?: CityHub[];
  onBackToDashboard?: () => void;
  onViewMyQuotes?: () => void;
  onConvertToBooking?: (quote: Quotation) => void;
  onBookQuotation?: (quote: Quotation) => void;
  onViewProductDetails?: (product: Product) => void;
  onOpenSpecs?: () => void;
}

export const UnifiedB2BQuotationBuilder: React.FC<UnifiedB2BQuotationBuilderProps> = ({
  initialDestinationSlug,
  destinations = [],
  products = [],
  hotels: propHotels = [],
  cityHubs: propCityHubs = [],
  onBackToDashboard,
  onViewMyQuotes,
  onConvertToBooking,
  onBookQuotation,
  onViewProductDetails,
  onOpenSpecs
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
    saveCurrentQuote
  } = useQuotation();

  // Local agent markup state
  const [agentMarkupPercent, setAgentMarkupPercent] = useState<number>(12);

  // Top-Level View State (Itinerary Builder vs Official Proposal Preview)
  const [activeViewTab, setActiveViewTab] = useState<'BUILDER' | 'PROPOSAL_PREVIEW'>('BUILDER');
  const [activeStepId, setActiveStepId] = useState<number>(1);

  // Destination & Specs State
  const defaultDest = useMemo(() => {
    if (initialDestinationSlug) {
      const found = destinations.find(d => d.slug === initialDestinationSlug || d.id === initialDestinationSlug);
      if (found) return found;
    }
    return destinations[0] || {
      id: 'dest-japan',
      name: 'Japan',
      slug: 'japan',
      code: 'JP',
      description: 'Land of the Rising Sun',
      heroImage: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e',
      regions: ['Honshu', 'Kanto', 'Kansai'],
      active: true,
      currency: 'JPY',
      featured: true
    };
  }, [destinations, initialDestinationSlug]);

  const [currentDestination, setCurrentDestination] = useState<Destination>(defaultDest);

  // Client Details & Specs
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');
  const [tripType, setTripType] = useState('FIT Luxury');
  const [quotationScope, setQuotationScope] = useState<QuotationScope>('HOTEL_LAND');

  // Travel Dates & Passengers
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 21);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 28);
    return d.toISOString().split('T')[0];
  });

  const [adultsCount, setAdultsCount] = useState<number>(2);
  const [childrenCount, setChildrenCount] = useState<number>(0);
  const [infantsCount, setInfantsCount] = useState<number>(0);
  const [childAges, setChildAges] = useState<number[]>([]);
  const [nationality, setNationality] = useState<string>('Indian');
  const [travelStyle, setTravelStyle] = useState<string>('FIT Luxury');
  const [mealPlanPreference, setMealPlanPreference] = useState<string>('CP (Breakfast Included)');
  const [roomingConfig, setRoomingConfig] = useState({
    roomsCount: 1,
    extraBedRequired: true
  });
  const [visaAssistanceChoice, setVisaAssistanceChoice] = useState<'YES' | 'NO' | 'NOT_REQUIRED' | 'LATER'>('NOT_REQUIRED');

  // Quotation Multi-Options State (Option 1, Option 2, Option 3)
  const [activeOptionTab, setActiveOptionTab] = useState<number>(1);
  const [showComparisonMatrixModal, setShowComparisonMatrixModal] = useState<boolean>(false);
  const [showDuplicateOptionModal, setShowDuplicateOptionModal] = useState<boolean>(false);

  // In-Builder Toast Notification (Replaces Cart Drawer popping up)
  const [builderToast, setBuilderToast] = useState<{ message: string; type: 'SUCCESS' | 'INFO' | 'WARNING' } | null>(null);

  const showBuilderToast = (message: string, type: 'SUCCESS' | 'INFO' | 'WARNING' = 'SUCCESS') => {
    setBuilderToast({ message, type });
    setTimeout(() => {
      setBuilderToast(prev => (prev?.message === message ? null : prev));
    }, 3500);
  };

  // Independent Options Data Storage
  interface OptionDataState {
    optionNumber: number;
    title: string;
    badge: string;
    hotelTier: string;
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
      items: [],
      routeHubs: [],
      dayThemes: {},
      agentMarkupPercent: 12,
      overallDiscountPercent: 0
    },
    2: {
      optionNumber: 2,
      title: 'Option 2: 5-Star Luxury Upgrade',
      badge: 'UPGRADED',
      hotelTier: '5-Star Luxury',
      items: [],
      routeHubs: [],
      dayThemes: {},
      agentMarkupPercent: 15,
      overallDiscountPercent: 0
    },
    3: {
      optionNumber: 3,
      title: 'Option 3: Signature / Private Villa',
      badge: 'ULTRA-LUXE',
      hotelTier: 'Signature / Private Villa',
      items: [],
      routeHubs: [],
      dayThemes: {},
      agentMarkupPercent: 18,
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

  // Dynamic Passenger Classification Engine
  const passengerClassification = useMemo(() => {
    return classifyPassengers(adultsCount, childAges, infantsCount);
  }, [adultsCount, childAges, infantsCount]);

  // Handle Changing Child Count
  const handleSetChildrenCount = (newCount: number) => {
    const safeCount = Math.max(0, newCount);
    setChildrenCount(safeCount);
    setChildAges(prev => {
      const next = [...prev];
      if (safeCount > next.length) {
        for (let i = next.length; i < safeCount; i++) {
          next.push(7); // Default child age 7 (CWB)
        }
      } else if (safeCount < next.length) {
        next.splice(safeCount);
      }
      return next;
    });
  };

  const handleUpdateChildAge = (index: number, age: number) => {
    setChildAges(prev => {
      const next = [...prev];
      next[index] = age;
      return next;
    });
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

  // Auto-Save State
  const [autoSaveStatus, setAutoSaveStatus] = useState<'SAVED' | 'SAVING' | 'IDLE'>('SAVED');
  const [lastSavedTimestamp, setLastSavedTimestamp] = useState<string>('Just now');
  const [activeQuoteId] = useState<string>(() => `QTE-${Date.now().toString(36).toUpperCase()}`);
  const [quoteNumber] = useState<string>(() => `QTE-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
  const [quoteVersion] = useState<number>(1);

  // City Hubs for Destination
  const destinationHubs = useMemo(() => {
    const filtered = propCityHubs.filter(h => 
      h.destinationId === currentDestination.id || 
      h.country?.toLowerCase() === currentDestination.name.toLowerCase()
    );
    if (filtered.length > 0) return filtered;

    // Fallback Japanese hubs
    return [
      { id: 'hub-tokyo', name: 'Tokyo Metropolitan Hub', slug: 'tokyo', destinationId: currentDestination.id, destinationName: currentDestination.name, hubName: 'Tokyo', region: 'Kanto', isMajor: true, airportCodes: ['NRT', 'HND'], description: 'Ultra-modern metropolis, culinary capital, and cultural center.' },
      { id: 'hub-kyoto', name: 'Kyoto Cultural Hub', slug: 'kyoto', destinationId: currentDestination.id, destinationName: currentDestination.name, hubName: 'Kyoto', region: 'Kansai', isMajor: true, airportCodes: ['KIX', 'ITM'], description: 'Ancient imperial temples, serene zen gardens, and geisha districts.' },
      { id: 'hub-osaka', name: 'Osaka Culinary Hub', slug: 'osaka', destinationId: currentDestination.id, destinationName: currentDestination.name, hubName: 'Osaka', region: 'Kansai', isMajor: true, airportCodes: ['KIX', 'ITM'], description: 'Gastronomy haven, neon canals, and vibrant commerce.' },
      { id: 'hub-hakone', name: 'Hakone Onsen & Mt Fuji Hub', slug: 'hakone', destinationId: currentDestination.id, destinationName: currentDestination.name, hubName: 'Hakone', region: 'Chubu', isMajor: false, airportCodes: [], description: 'Hot springs ryokan retreats with Mount Fuji panoramas.' }
    ];
  }, [propCityHubs, currentDestination]);

  // Route Hubs Sequence
  const [routeHubs, setRouteHubs] = useState<TripRouteHub[]>([
    {
      id: 'rhub-1',
      hubId: 'hub-tokyo',
      hubName: 'Tokyo',
      nights: 3,
      order: 1,
      hotelId: undefined,
      notes: 'Initial international arrival at Haneda/Narita'
    },
    {
      id: 'rhub-2',
      hubId: 'hub-kyoto',
      hubName: 'Kyoto',
      nights: 2,
      order: 2,
      hotelId: undefined,
      notes: 'Shinkansen bullet train transit to historic cultural capital'
    },
    {
      id: 'rhub-3',
      hubId: 'hub-osaka',
      hubName: 'Osaka',
      nights: 2,
      order: 3,
      hotelId: undefined,
      notes: 'Gastronomy, Dotonbori nightlife and departure flight via KIX'
    }
  ]);

  // Route Validation
  const routeTotalNights = useMemo(() => {
    return routeHubs.reduce((acc, h) => acc + (h.nights || 0), 0);
  }, [routeHubs]);

  // Hotels list for destination
  const availableHotels = useMemo(() => {
    const list = propHotels.filter(h => 
      h.destinationId === currentDestination.id || 
      h.country?.toLowerCase() === currentDestination.name.toLowerCase()
    );
    if (list.length > 0) return list;
    return propHotels;
  }, [propHotels, currentDestination]);

  // Products list for destination
  const availableProducts = useMemo(() => {
    const list = products.filter(p => 
      p.destinationId === currentDestination.id || 
      p.country?.toLowerCase() === currentDestination.name.toLowerCase() ||
      p.destinationName?.toLowerCase() === currentDestination.name.toLowerCase()
    );
    if (list.length > 0) return list;
    return products;
  }, [products, currentDestination]);

  // Day Theme and Notes customization
  const [dayThemes, setDayThemes] = useState<Record<number, string>>({});
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
  const [quickAddCategory, setQuickAddCategory] = useState('ALL');
  const [filterByDayCityOnly, setFilterByDayCityOnly] = useState<boolean>(true);
  const [inspectingProduct, setInspectingProduct] = useState<Product | null>(null);
  const [calculatorProduct, setCalculatorProduct] = useState<Product | null>(null);

  // Save as Package Modal State
  const [isSavePackageModalOpen, setIsSavePackageModalOpen] = useState(false);
  const [packageFormData, setPackageFormData] = useState({
    title: '',
    tagline: '',
    description: '',
    tripType: 'LUXURY' as const,
    pricingMode: 'LIVE_DYNAMIC' as const,
    status: 'PUBLISHED' as const,
    featured: true
  });
  const [packageSavedNotice, setPackageSavedNotice] = useState<string | null>(null);

  // Helper to open quick add modal for a day slot
  const handleOpenQuickAddModal = (slot: { dayNumber: number; dateString: string; hub?: TripRouteHub | null }) => {
    const dayCity = slot.hub?.hubName || currentDestination.name;
    setQuickAddModalDay({
      dayNum: slot.dayNumber,
      dateString: slot.dateString,
      hubName: dayCity,
      hubId: slot.hub?.hubId || slot.hub?.id
    });
    setQuickAddSearch('');
    setQuickAddCategory('ALL');
    setFilterByDayCityOnly(true);
  };

  // Helper to view product details
  const handleOpenProductDetails = (prod: Product) => {
    setInspectingProduct(prod);
    if (onViewProductDetails) {
      onViewProductDetails(prod);
    }
  };

  // Inline Item Customizer Modal
  const [editingItem, setEditingItem] = useState<QuoteItem | null>(null);
  const [editFormData, setEditFormData] = useState<{
    travelDate: string;
    serviceTime: string;
    adults: number;
    children: number;
    infants: number;
    notes: string;
    selectedAddonIds: string[];
  }>({
    travelDate: '',
    serviceTime: '',
    adults: 2,
    children: 0,
    infants: 0,
    notes: '',
    selectedAddonIds: []
  });

  // Email Proposal Modal
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
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
      if (lead.notes) setAgentNotes(lead.notes);
    }
  };

  // Switch Active Option Tab (with automatic state preservation)
  const handleSwitchOptionTab = (targetOptNum: number) => {
    if (targetOptNum === activeOptionTab) return;

    // 1. Save current option state
    setOptionsData(prev => ({
      ...prev,
      [activeOptionTab]: {
        ...prev[activeOptionTab],
        items: [...items],
        routeHubs: [...routeHubs],
        dayThemes: { ...dayThemes },
        agentMarkupPercent,
        overallDiscountPercent
      }
    }));

    // 2. Target option data
    const targetOpt = optionsData[targetOptNum];
    let targetItems = targetOpt?.items || [];
    let targetHubs = targetOpt?.routeHubs || [];
    let targetThemes = targetOpt?.dayThemes || {};
    let targetMarkup = targetOpt?.agentMarkupPercent ?? agentMarkupPercent;
    let targetDiscount = targetOpt?.overallDiscountPercent ?? 0;

    // If target has no hubs, inherit routeHubs structure without hotels
    if (targetHubs.length === 0 && routeHubs.length > 0) {
      targetHubs = routeHubs.map(h => ({
        ...h,
        id: `rhub-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        hotelId: undefined,
        roomTypeId: undefined,
        manualHotel: undefined,
        isManualHotel: false
      }));
    }

    setItems(targetItems);
    setRouteHubs(targetHubs);
    setDayThemes(targetThemes);
    setAgentMarkupPercent(targetMarkup);
    setOverallDiscountPercent(targetDiscount);
    setActiveOptionTab(targetOptNum);

    showBuilderToast(`Switched to Option ${targetOptNum}: ${targetOpt?.title || `Option ${targetOptNum}`}`, 'INFO');
  };

  // Duplicate an option to another option slot
  const handleDuplicateOption = (fromOptNum: number, toOptNum: number) => {
    const sourceOpt = fromOptNum === activeOptionTab
      ? {
          items: [...items],
          routeHubs: [...routeHubs],
          dayThemes: { ...dayThemes },
          agentMarkupPercent,
          overallDiscountPercent
        }
      : optionsData[fromOptNum];

    const clonedItems: QuoteItem[] = (sourceOpt?.items || []).map(it => ({
      ...it,
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
    }));

    const clonedHubs: TripRouteHub[] = (sourceOpt?.routeHubs || []).map(h => ({
      ...h,
      id: `rhub-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
    }));

    const clonedThemes: Record<number, string> = { ...(sourceOpt?.dayThemes || {}) };

    setOptionsData(prev => ({
      ...prev,
      [toOptNum]: {
        ...prev[toOptNum],
        items: clonedItems,
        routeHubs: clonedHubs,
        dayThemes: clonedThemes,
        agentMarkupPercent: sourceOpt?.agentMarkupPercent ?? 15,
        overallDiscountPercent: sourceOpt?.overallDiscountPercent ?? 0
      }
    }));

    // Switch to target option
    setItems(clonedItems);
    setRouteHubs(clonedHubs);
    setDayThemes(clonedThemes);
    setAgentMarkupPercent(sourceOpt?.agentMarkupPercent ?? 15);
    setOverallDiscountPercent(sourceOpt?.overallDiscountPercent ?? 0);
    setActiveOptionTab(toOptNum);

    showBuilderToast(`Option ${fromOptNum} successfully cloned to Option ${toOptNum}!`, 'SUCCESS');
  };

  // Silent Product Add (Suppresses Cart Drawer popup in builder)
  const handleAddProductToQuoteSilently = (product: Product, options?: any) => {
    addProductToQuote(product, { ...options, openDrawer: false });
    showBuilderToast(`✓ Added "${product.name}" to Option ${activeOptionTab}`, 'SUCCESS');
  };

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

      const dayNetCost = dayItems.reduce((sum, it) => sum + (it.calculation?.totalNetCost || 0), 0);
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
        dayNetCost,
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

  // Grouped items
  const hotelItems = useMemo(() => items.filter(isHotelQuoteItem), [items]);
  const visaItems = useMemo(() => items.filter(isVisaQuoteItem), [items]);
  const experienceItems = useMemo(() => items.filter(it => !isHotelQuoteItem(it) && !isVisaQuoteItem(it)), [items]);

  const hasInsurance = useMemo(() => {
    return items.some(it => 
      it.product.subcategory === 'Travel Insurance' || 
      it.product.name.toLowerCase().includes('insurance')
    );
  }, [items]);

  const hasEsim = useMemo(() => {
    return items.some(it => 
      it.product.subcategory === 'eSIM Connectivity' || 
      it.product.name.toLowerCase().includes('esim')
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

  // Add Suggested Transfer Helper
  const handleAddSuggestedTransfer = (s: TransferSuggestion) => {
    const targetDay = calendarDays.find(d => d.dayNumber === s.dayNumber);
    const dateStr = targetDay?.dateString || startDate;

    const prod = {
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
      galleryImages: ['https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?q=80&w=800&auto=format&fit=crop']
    } as unknown as Product;

    handleAddProductToQuoteSilently(prod, { 
      travelDate: dateStr, 
      adults: adultsCount, 
      children: childrenCount, 
      infants: infantsCount 
    });
  };

  const hotelTotalSelling = useMemo(() => hotelItems.reduce((sum, it) => sum + (it.calculation?.finalTotalSellingPrice || 0), 0), [hotelItems]);
  const visaTotalSelling = useMemo(() => visaItems.reduce((sum, it) => sum + (it.calculation?.finalTotalSellingPrice || 0), 0), [visaItems]);
  const experienceTotalSelling = useMemo(() => experienceItems.reduce((sum, it) => sum + (it.calculation?.finalTotalSellingPrice || 0), 0), [experienceItems]);

  const finalClientPrice = useMemo(() => {
    return totalSellingPrice * (1 + (agentMarkupPercent || 0) / 100);
  }, [totalSellingPrice, agentMarkupPercent]);

  // Dynamic 3-Option Calculations Engine
  const computedQuotationOptions: QuotationOption[] = useMemo(() => {
    return [1, 2, 3].map(optNum => {
      const optState = optNum === activeOptionTab
        ? {
            items,
            routeHubs,
            agentMarkupPercent,
            overallDiscountPercent,
            title: optionsData[optNum]?.title || `Option ${optNum}`,
            badge: optionsData[optNum]?.badge || '',
            hotelTier: optionsData[optNum]?.hotelTier || ''
          }
        : {
            items: optionsData[optNum]?.items || [],
            routeHubs: optionsData[optNum]?.routeHubs || [],
            agentMarkupPercent: optionsData[optNum]?.agentMarkupPercent ?? 12,
            overallDiscountPercent: optionsData[optNum]?.overallDiscountPercent ?? 0,
            title: optionsData[optNum]?.title || `Option ${optNum}`,
            badge: optionsData[optNum]?.badge || '',
            hotelTier: optionsData[optNum]?.hotelTier || ''
          };

      const optItems = optState.items;
      const net = optItems.reduce((acc, it) => acc + (it.calculation?.totalNetCost || it.product.priceB2B * (it.pax.adults + it.pax.children)), 0);
      const selling = optItems.reduce((acc, it) => acc + (it.calculation?.finalTotalSellingPrice || it.product.priceSelling * (it.pax.adults + it.pax.children)), 0);
      const margin = selling - net;

      return {
        id: `opt-${optNum}`,
        optionNumber: optNum,
        title: optState.title,
        badge: optState.badge,
        hotelTier: optState.hotelTier,
        items: optItems,
        routeHubs: optState.routeHubs,
        totalNetCost: net,
        totalSellingPrice: selling,
        totalMargin: margin,
        totalTaxes: selling * 0.05
      };
    });
  }, [items, routeHubs, agentMarkupPercent, overallDiscountPercent, optionsData, activeOptionTab]);

  // Sync / Auto-Save Quote to AppDatabase
  const handleSaveDraft = () => {
    setAutoSaveStatus('SAVING');
    try {
      const activeQuote: Quotation = {
        id: activeQuoteId,
        quoteNumber,
        version: quoteVersion,
        title: `${currentDestination.name} Bespoke Journey (${tripNights} Nights)`,
        destination: currentDestination.name,
        items,
        currency,
        overallMarkupPercent: agentMarkupPercent,
        overallDiscountPercent: overallDiscountPercent || 0,
        totalNetCost,
        totalSellingPrice: finalClientPrice,
        totalTaxes: 0,
        totalMargin: totalMarginAmount + (finalClientPrice - totalSellingPrice),
        clientName: clientName || 'Client Name Pending',
        clientEmail: clientEmail || 'client@example.com',
        clientCompany: clientCompany || user?.agencyName || 'Direct B2B Client',
        agentId: user?.id || 'usr-agent-01',
        agentName: user?.name || 'Travel Consultant',
        agentAgency: user?.agencyName || 'Partner Agency',
        agentNotes: agentNotes || '',
        termsAndConditions: 'All wholesale rates valid for 14 days. 20% deposit secures itinerary reservations.',
        status: 'DRAFT',
        travelStartDate: startDate,
        travelEndDate: endDate,
        totalPax: (adultsCount || 2) + (childrenCount || 0) + (infantsCount || 0),
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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        validUntil: new Date(Date.now() + 86400000 * 14).toISOString(),
        leadId: selectedLeadId || undefined,
        scope: quotationScope,
        routeHubs,
        dayThemes
      };

      db.saveQuote(activeQuote, user, 'EDITED');
      setAutoSaveStatus('SAVED');
      setLastSavedTimestamp(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      return activeQuote;
    } catch (e) {
      console.error('Auto-save error:', e);
      setAutoSaveStatus('IDLE');
      return null;
    }
  };

  // Auto-Save Effect when items or specs change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (items.length > 0 || clientName) {
        handleSaveDraft();
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [items, clientName, clientEmail, startDate, endDate, agentMarkupPercent, currency, routeHubs, quotationScope]);

  // Balance Nights Helper
  const handleAutoBalanceNights = () => {
    if (routeHubs.length === 0) return;
    const count = routeHubs.length;
    const baseNights = Math.floor(tripNights / count);
    const remainder = tripNights % count;

    setRouteHubs(prev =>
      prev.map((hub, idx) => ({
        ...hub,
        nights: idx === 0 ? baseNights + remainder : baseNights
      }))
    );
  };

  // Add Hub to Route
  const handleAddHubToRoute = (hubId: string) => {
    const hub = destinationHubs.find(h => h.id === hubId);
    if (!hub) return;
    const newOrder = routeHubs.length + 1;
    setRouteHubs(prev => [
      ...prev,
      {
        id: `rhub-${Date.now()}`,
        hubId: hub.id,
        hubName: hub.hubName || hub.name,
        nights: 2,
        order: newOrder,
        notes: `Stay in ${hub.hubName || hub.name}`
      }
    ]);
  };

  // Remove Hub from Route
  const handleRemoveHubFromRoute = (hubId: string) => {
    if (routeHubs.length <= 1) return;
    setRouteHubs(prev => 
      prev.filter(h => h.id !== hubId).map((h, idx) => ({ ...h, order: idx + 1 }))
    );
  };

  // Adjust Hub Nights
  const handleAdjustHubNights = (hubId: string, delta: number) => {
    setRouteHubs(prev =>
      prev.map(h => {
        if (h.id === hubId) {
          const updated = Math.max(1, (h.nights || 1) + delta);
          return { ...h, nights: updated };
        }
        return h;
      })
    );
  };

  // Helper to compute check-in / check-out dates for a hub
  const getHubDates = (hubOrder: number, hubNights: number) => {
    let accumulated = 0;
    for (let i = 0; i < hubOrder - 1; i++) {
      accumulated += (routeHubs[i]?.nights || 1);
    }

    const checkInDate = new Date(startDate);
    checkInDate.setDate(checkInDate.getDate() + accumulated);
    const checkInIso = checkInDate.toISOString().split('T')[0];

    const checkOutDate = new Date(checkInDate);
    checkOutDate.setDate(checkOutDate.getDate() + Math.max(1, hubNights || 1));
    const checkOutIso = checkOutDate.toISOString().split('T')[0];

    return {
      checkInIso,
      checkOutIso,
      checkInFormatted: checkInDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      checkOutFormatted: checkOutDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    };
  };

  // Helper to remove hotel stay for a specific hub
  const handleRemoveHotelForHub = (hubId: string) => {
    const targetHub = routeHubs.find(h => h.id === hubId);
    if (!targetHub) return;

    // Find and remove matching hotel items
    const matchingItems = items.filter(it => 
      isHotelQuoteItem(it) &&
      (it.notes?.includes(targetHub.hubName) || (targetHub.hotelId && it.product.id.includes(targetHub.hotelId)))
    );

    matchingItems.forEach(it => removeProductFromQuote(it.id));

    setRouteHubs(prev =>
      prev.map(h => (h.id === hubId ? { ...h, hotelId: undefined, roomTypeId: undefined, roomsCount: undefined } : h))
    );
  };

  // Add or Update Hotel Stay for a Hub with Room Type, Rooms Count, and Clean Final Price
  const handleSelectHotelForHub = (
    hubOrder: number, 
    hotel: Hotel | null, 
    roomTypeId?: string, 
    roomsCount: number = 1
  ) => {
    const targetHub = routeHubs.find(h => h.order === hubOrder);
    if (!targetHub) return;

    if (!hotel) {
      handleRemoveHotelForHub(targetHub.id);
      return;
    }

    // Calculate dates for this hub
    const { checkInIso, checkOutIso } = getHubDates(hubOrder, targetHub.nights || 1);

    // Selected room type and rate
    const selectedRoom = hotel.roomTypes?.find(r => r.id === roomTypeId) || hotel.roomTypes?.[0];
    const selectedRate = selectedRoom?.rates?.[0];

    const nights = targetHub.nights || 1;
    const safeRooms = Math.max(1, roomsCount || 1);

    // Remove existing hotel items for this hub
    const existingHotelItems = items.filter(it => 
      isHotelQuoteItem(it) &&
      (it.notes?.includes(targetHub.hubName) || (targetHub.hotelId && it.product.id.includes(targetHub.hotelId)))
    );
    existingHotelItems.forEach(it => removeProductFromQuote(it.id));

    // Validate occupancy for current passenger counts
    const occupancy = validateRoomOccupancy(selectedRoom, safeRooms, adultsCount, childrenCount, infantsCount);

    if (occupancy.isValid) {
      // Create hotel product item (with 0 taxes & fees)
      const hotelProduct = hotelToProduct(hotel, selectedRoom, selectedRate, nights, safeRooms);
      
      // Add for check-in date
      addProductToQuote(hotelProduct, {
        adults: adultsCount,
        children: childrenCount,
        infants: infantsCount,
        travelDate: checkInIso,
        notes: `${hotel.name} • ${selectedRoom?.roomName || 'Luxury Room'} • ${safeRooms} ${safeRooms > 1 ? 'Rooms' : 'Room'} • ${nights} Nights in ${targetHub.hubName} [Check-in: ${checkInIso}, Check-out: ${checkOutIso}]`,
        openDrawer: false
      });
    }

    // Update hub state
    setRouteHubs(prev =>
      prev.map(h => (h.id === targetHub.id ? { 
        ...h, 
        hotelId: hotel.id, 
        roomTypeId: selectedRoom?.id,
        roomsCount: safeRooms,
        isManualHotel: false,
        accommodationType: 'master',
        manualHotel: undefined
      } : h))
    );
  };

  // Open Add Manual Hotel Modal
  const handleOpenAddManualHotel = (hubId?: string) => {
    setManualHotelModalHubId(hubId || routeHubs[0]?.id);
    setManualHotelModalInitialData(null);
    setIsManualHotelModalOpen(true);
  };

  // Open Edit Manual Hotel Modal
  const handleOpenEditManualHotel = (hubId: string) => {
    const targetHub = routeHubs.find(h => h.id === hubId);
    if (!targetHub) return;
    setManualHotelModalHubId(hubId);
    setManualHotelModalInitialData(targetHub.manualHotel || null);
    setIsManualHotelModalOpen(true);
  };

  // Save Manual Hotel & Rate (Strictly Quotation-Level • No Master DB modification)
  const handleSaveManualHotel = (manualData: ManualHotelDetails) => {
    const targetHub = routeHubs.find(h => h.id === manualData.hubId || h.hubName.toLowerCase() === manualData.city.toLowerCase()) || routeHubs[0];
    if (!targetHub) return;

    // 1. Remove any previous hotel items for this hub
    const existingHotelItems = items.filter(it => 
      isHotelQuoteItem(it) &&
      (it.notes?.includes(targetHub.hubName) || 
       (targetHub.hotelId && it.product.id.includes(targetHub.hotelId)) || 
       (it.manualHotelDetails?.hubId === targetHub.id) ||
       it.product.name.toLowerCase().includes(targetHub.hubName.toLowerCase()))
    );
    existingHotelItems.forEach(it => removeProductFromQuote(it.id));

    // 2. Convert manual details into a standardized Product object
    const hotelProduct = manualHotelToProduct(manualData, currentDestination);

    // 3. Add to quotation items
    const mealDesc = manualData.mealPlanName || manualData.mealPlan;
    const stayNote = `${manualData.hotelName} [Manual Accommodation] • ${manualData.roomType} • ${manualData.numberOfRooms} ${manualData.numberOfRooms > 1 ? 'Rooms' : 'Room'} • ${manualData.numberOfNights} Nights in ${targetHub.hubName} (${mealDesc}) [Check-in: ${manualData.checkInDate}, Check-out: ${manualData.checkOutDate}]`;

    addProductToQuote(hotelProduct, {
      adults: adultsCount,
      children: childrenCount,
      infants: infantsCount,
      travelDate: manualData.checkInDate,
      notes: stayNote,
      openDrawer: false
    });

    // 4. Update routeHubs state
    setRouteHubs(prev =>
      prev.map(h => {
        if (h.id === targetHub.id) {
          return {
            ...h,
            hotelId: hotelProduct.id,
            roomTypeId: 'manual-room',
            roomsCount: manualData.numberOfRooms,
            nights: manualData.numberOfNights,
            isManualHotel: true,
            accommodationType: 'manual',
            manualHotel: manualData
          };
        }
        return h;
      })
    );

    // 5. Add audit log record to current quote
    try {
      const allQuotes = db.getAllSavedQuotes();
      const activeQuote = allQuotes.find(q => q.id === (activeQuoteId || quoteNumber));
      if (activeQuote) {
        const updatedQuote: Quotation = {
          ...activeQuote,
          activityLog: [
            ...(activeQuote.activityLog || []),
            {
              id: `act-${Date.now()}`,
              timestamp: new Date().toISOString(),
              userName: user?.name || 'B2B Agent',
              userRole: user?.role || 'B2B_AGENT',
              action: 'PRICING_UPDATED' as const,
              details: `Added manual hotel: ${manualData.hotelName} (${manualData.roomType}, ${manualData.numberOfRooms}R × ${manualData.numberOfNights}N @ ${manualData.rateCurrency} ${manualData.ratePerNight}/nt) for ${targetHub.hubName}`
            }
          ]
        };
        db.saveQuote(updatedQuote, user, 'EDITED');
      }
    } catch (e) {
      console.warn('Manual hotel activity log notice:', e);
    }
  };

  // Remove Manual Hotel Stay for a Hub
  const handleRemoveManualHotel = (hubId: string) => {
    const targetHub = routeHubs.find(h => h.id === hubId);
    if (!targetHub) return;

    const hotelName = targetHub.manualHotel?.hotelName || 'Manual Hotel';

    // Remove matching items
    const matchingItems = items.filter(it => 
      isHotelQuoteItem(it) &&
      (it.notes?.includes(targetHub.hubName) || 
       (targetHub.hotelId && it.product.id.includes(targetHub.hotelId)) || 
       (it.manualHotelDetails?.hubId === targetHub.id))
    );
    matchingItems.forEach(it => removeProductFromQuote(it.id));

    // Reset hub
    setRouteHubs(prev =>
      prev.map(h => (h.id === hubId ? { 
        ...h, 
        hotelId: undefined, 
        roomTypeId: undefined, 
        roomsCount: undefined,
        isManualHotel: undefined,
        accommodationType: undefined,
        manualHotel: undefined
      } : h))
    );

    // Audit log
    try {
      const allQuotes = db.getAllSavedQuotes();
      const activeQuote = allQuotes.find(q => q.id === (activeQuoteId || quoteNumber));
      if (activeQuote) {
        const updatedQuote: Quotation = {
          ...activeQuote,
          activityLog: [
            ...(activeQuote.activityLog || []),
            {
              id: `act-${Date.now()}`,
              timestamp: new Date().toISOString(),
              userName: user?.name || 'B2B Agent',
              userRole: user?.role || 'B2B_AGENT',
              action: 'EDITED' as const,
              details: `Removed manual hotel: ${hotelName} from ${targetHub.hubName}`
            }
          ]
        };
        db.saveQuote(updatedQuote, user, 'EDITED');
      }
    } catch (e) {
      console.warn('Manual hotel remove notice:', e);
    }
  };

  // Open Edit Item Modal
  const handleOpenEditItem = (item: QuoteItem) => {
    setEditingItem(item);
    setEditFormData({
      travelDate: item.travelDate || '',
      serviceTime: item.serviceTime || '09:30 AM',
      adults: item.pax?.adults ?? 2,
      children: item.pax?.children ?? 0,
      infants: item.pax?.infants ?? 0,
      notes: item.notes || '',
      selectedAddonIds: item.selectedAddonIds || []
    });
  };

  // Save Edit Item
  const handleSaveEditItem = () => {
    if (!editingItem) return;
    if (updateItemFull) {
      updateItemFull(editingItem.id, {
        travelDate: editFormData.travelDate,
        serviceTime: editFormData.serviceTime,
        pax: {
          adults: editFormData.adults,
          children: editFormData.children,
          infants: editFormData.infants
        },
        selectedAddonIds: editFormData.selectedAddonIds,
        notes: editFormData.notes
      });
    } else {
      updateItemTravelDate(editingItem.id, editFormData.travelDate);
      updateItemPax(editingItem.id, {
        adults: editFormData.adults,
        children: editFormData.children,
        infants: editFormData.infants
      });
      if (updateItemNotes) updateItemNotes(editingItem.id, editFormData.notes);
    }
    setEditingItem(null);
  };

  // Download PDF Action
  const handleDownloadPDF = () => {
    const saved = handleSaveDraft();
    if (!saved) return;
    try {
      downloadQuotationPDF({
        quote: saved,
        agentName: user?.name || 'B2B Partner Agent',
        agentAgency: user?.agencyName || 'Luxury Travel Partners',
        agentEmail: user?.email || 'agent@theunbound.com',
        leadId: selectedLeadId || saved.leadId
      });
      // Auto-schedule Google Calendar 24h Quote Follow-Up SLA
      googleCalendarAutomation.triggerQuoteFollowUpSLA(saved, user);
    } catch (err) {
      console.error('PDF export error:', err);
    }
  };

  // Open Email Modal
  const handleOpenEmailModal = () => {
    const saved = handleSaveDraft();
    if (!saved) return;
    setEmailRecipient(clientEmail || 'client@example.com');
    setEmailSubject(`Bespoke Itinerary & Quotation Proposal [${saved.quoteNumber}] - ${currentDestination.name}`);
    setEmailMessage(
      `Dear ${clientName || 'Valued Guest'},\n\n` +
      `We are pleased to present your tailored itinerary proposal for ${currentDestination.name} (${startDate} to ${endDate}).\n\n` +
      `Total Package Investment: ${formatCurrency(finalClientPrice, currency)}\n\n` +
      `Please review the attached itinerary breakdown and let us know if you would like any adjustments.`
    );
    setEmailSuccessMessage(null);
    setEmailErrorMessage(null);
    setIsEmailModalOpen(true);
  };

  // Send Email Proposal via EmailNotificationService
  const handleSendProposalEmail = async () => {
    const saved = handleSaveDraft();
    if (!saved) return;

    setIsSendingEmail(true);
    setEmailErrorMessage(null);
    setEmailSuccessMessage(null);

    try {
      const emailService = EmailNotificationService.getInstance();
      const generatedEmail = emailService.generateQuotationProposalEmail(
        {
          ...saved,
          clientEmail: emailRecipient,
          clientName: clientName || 'Valued Guest',
          totalSellingPrice: finalClientPrice
        },
        {
          name: user?.name || 'B2B Partner Agent',
          agencyName: user?.agencyName || 'Luxury Partner Agency',
          email: user?.email || 'agent@theunbound.com'
        }
      );

      const result = await emailService.sendViaGmailApi(
        emailRecipient,
        emailSubject,
        generatedEmail.fullHtml
      );

      if (result.success) {
        setEmailSuccessMessage(`Proposal email dispatched successfully to ${emailRecipient}! (Message ID: ${result.messageId || 'SENT'})`);
        setTimeout(() => {
          setIsEmailModalOpen(false);
          setEmailSuccessMessage(null);
        }, 3000);
      } else {
        setEmailSuccessMessage(`Proposal saved & simulated dispatch to ${emailRecipient}. (Google Workspace authorization active).`);
        setTimeout(() => {
          setIsEmailModalOpen(false);
          setEmailSuccessMessage(null);
        }, 3500);
      }
    } catch (err: any) {
      setEmailErrorMessage(err?.message || 'Failed to dispatch email. Please try again.');
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Convert to Confirmed Booking Action
  const handleConvertBooking = () => {
    const saved = handleSaveDraft();
    if (!saved) return;

    try {
      db.updateQuotationStatus(saved.id, 'APPROVED', user);
      if (onConvertToBooking) {
        onConvertToBooking(saved);
      } else if (onBookQuotation) {
        onBookQuotation(saved);
      }
    } catch (err) {
      console.error('Booking conversion error:', err);
    }
  };

  // Open Save as Ready-Made Package Modal
  const handleOpenSavePackageModal = () => {
    if (!canSaveAsPackage) return;
    const defaultTitle = `${currentDestination.name} ${tripNights}N/${tripNights + 1}D ${tripType} Discovery`;
    const defaultTagline = `Signature ${tripNights}-night curated circuit featuring ${routeHubs.map(h => h.hubName).join(' → ')}.`;
    
    setPackageFormData({
      title: defaultTitle,
      tagline: defaultTagline,
      description: `Comprehensive multi-city luxury touring circuit including ${items.length} master experiences and premium accommodations across ${routeHubs.map(h => h.hubName).join(', ')}.`,
      tripType: (tripType.toUpperCase().includes('LUXURY') ? 'LUXURY' : 'BOUTIQUE') as any,
      pricingMode: 'LIVE_DYNAMIC',
      status: 'PUBLISHED',
      featured: true
    });
    setIsSavePackageModalOpen(true);
  };

  // Save Current Itinerary as a Master Ready-Made Package
  const handleConfirmSavePackage = () => {
    if (!packageFormData.title.trim()) return;

    // Collect all master product IDs
    const allProdIds: string[] = [];
    const allHotelIds: string[] = [];

    // Build day-wise itinerary structure referencing master product IDs
    const daySlotsCount = tripNights + 1;
    const itineraryDays: PackageItineraryDay[] = [];

    for (let dayNum = 1; dayNum <= daySlotsCount; dayNum++) {
      const slot = daySlots.find(s => s.dayNumber === dayNum);
      const dayProds = slot ? slot.productItems.map(i => i.product.id) : [];
      dayProds.forEach(id => {
        if (!allProdIds.includes(id)) allProdIds.push(id);
      });

      const dayHubName = slot?.hub?.hubName || currentDestination.name;

      itineraryDays.push({
        dayNumber: dayNum,
        title: dayThemes[dayNum] || `Day ${dayNum}: Exploring ${dayHubName}`,
        hubId: slot?.hub?.hubId || slot?.hub?.id,
        hubName: dayHubName,
        destinationId: currentDestination.id,
        destinationName: currentDestination.name,
        description: `Scheduled master experiences and private transfers in ${dayHubName}.`,
        productIds: dayProds,
        mealsIncluded: {
          breakfast: true,
          lunch: false,
          dinner: false
        }
      });
    }

    // Build Hotel refs
    hotelItems.forEach(h => {
      if (h.hotelId && !allHotelIds.includes(h.hotelId)) {
        allHotelIds.push(h.hotelId);
      }
    });

    const routeSummary = routeHubs.map(h => `${h.hubName} (${h.nights || 1}N)`);

    const newPackage: B2BPackage = {
      id: `pkg-${Date.now()}`,
      title: packageFormData.title.trim(),
      slug: packageFormData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
      tagline: packageFormData.tagline.trim(),
      description: packageFormData.description.trim(),
      regionId: currentDestination.regionId || 'asia',
      regionName: currentDestination.regionName || 'Asia',
      destinationId: currentDestination.id,
      destinationName: currentDestination.name,
      hubIds: routeHubs.map(h => h.hubId || h.id),
      durationDays: tripNights + 1,
      durationNights: tripNights,
      tripType: packageFormData.tripType as any,
      heroImage: currentDestination.heroImage || 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200',
      galleryImages: [
        currentDestination.heroImage || 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=800',
        'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=800'
      ],
      routeSummary,
      hotelsSummary: routeHubs.map(h => ({
        name: `${h.hubName} Luxury Hotel / Ryokan`,
        cityName: h.hubName,
        nights: h.nights || 1,
        roomType: 'Deluxe Room'
      })),
      itinerary: itineraryDays,
      productIds: allProdIds,
      pricingConfiguration: {
        pricingMode: packageFormData.pricingMode,
        baseNetCostUSD: totalNetCost || 2500,
        suggestedSellingPriceUSD: finalClientPrice || 3250,
        b2bMarkupPercent: agentMarkupPercent || 12,
        currency
      },
      highlights: [
        `${tripNights} Nights luxury accommodations in ${routeHubs.map(h => h.hubName).join(', ')}`,
        'Daily private transfers and English-speaking local guides',
        'Direct 24/7 on-ground DMC concierge support'
      ],
      inclusions: [
        `${tripNights} Nights luxury hotel accommodations with daily breakfast`,
        `All master excursions and private transfers as detailed in circuit`,
        `Direct 24/7 on-ground DMC concierge support`
      ],
      exclusions: [
        'International airfare & visas',
        'Personal travel insurance & gratuities'
      ],
      baseNetCostUSD: totalNetCost || 2500,
      suggestedSellingPriceUSD: finalClientPrice || 3250,
      currency,
      tags: ['Featured', 'Bestseller', currentDestination.name],
      status: packageFormData.status,
      isPublished: packageFormData.status === 'PUBLISHED',
      isFeatured: packageFormData.featured,
      visibility: {
        destinationPage: true,
        hubPage: true,
        homepage: packageFormData.featured,
        promotions: false,
        search: true,
        featured: packageFormData.featured
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.savePackage(newPackage, user);
    setIsSavePackageModalOpen(false);
    setPackageSavedNotice(`Package "${newPackage.title}" published successfully to Ready-Made Packages.`);
    setTimeout(() => setPackageSavedNotice(null), 4000);
  };

  // Quick Add Products Filter - strictly filters by the day's city/hub if filterByDayCityOnly is active
  const quickAddFilteredProducts = useMemo(() => {
    if (!quickAddModalDay) return [];
    const targetCity = quickAddModalDay.hubName;
    const targetHubId = quickAddModalDay.hubId;

    return availableProducts.filter(p => {
      // 1. City / Hub Filter: When active, only show products tagged for this day's city (e.g. Tokyo, Kyoto)
      if (filterByDayCityOnly && targetCity) {
        const matchesCity = isProductMatchingCity(p, targetCity, targetHubId);
        if (!matchesCity) return false;
      }

      // 2. Category Filter
      const matchCat = quickAddCategory === 'ALL' || p.category === quickAddCategory;
      if (!matchCat) return false;

      // 3. Search text query
      const matchSearch = !quickAddSearch || 
        p.name.toLowerCase().includes(quickAddSearch.toLowerCase()) ||
        p.description?.toLowerCase().includes(quickAddSearch.toLowerCase()) ||
        p.shortDescription?.toLowerCase().includes(quickAddSearch.toLowerCase()) ||
        p.city?.toLowerCase().includes(quickAddSearch.toLowerCase()) ||
        p.location?.toLowerCase().includes(quickAddSearch.toLowerCase()) ||
        p.subcategory?.toLowerCase().includes(quickAddSearch.toLowerCase());

      return matchCat && matchSearch;
    });
  }, [availableProducts, quickAddModalDay, quickAddCategory, quickAddSearch, filterByDayCityOnly]);

  // Total products in catalog tagged specifically for this day's city/hub
  const totalCityProductsCount = useMemo(() => {
    if (!quickAddModalDay) return 0;
    return availableProducts.filter(p => isProductMatchingCity(p, quickAddModalDay.hubName, quickAddModalDay.hubId)).length;
  }, [availableProducts, quickAddModalDay]);

  // Product categories for filter
  const productCategories = ['ALL', 'Activity', 'Tour', 'Transfer', 'Transport', 'Rail', 'Guide', 'Restaurant', 'Private Yacht'];

  return (
    <div 
      id="quote-builder-shell"
      className="fixed inset-0 z-30 bg-slate-100/95 text-slate-900 flex flex-col font-sans selection:bg-[#00C6A6] selection:text-slate-950 overflow-hidden"
    >
      {/* ========================================================================= */}
      {/* TOP WORKSPACE NAVIGATION & CONTROLS — FIXED AT TOP OF VIEWPORT */}
      {/* ========================================================================= */}
      <header 
        id="quote-builder-fixed-header"
        className="shrink-0 w-full z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 py-2.5 shadow-xs"
      >
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Left: Back + Quote Info + Customer + Destination + Dates + Pax + Status */}
          <div className="flex flex-wrap items-center gap-2.5">
            {(onBackToDashboard || onViewMyQuotes) && (
              <button
                type="button"
                onClick={() => {
                  if (onBackToDashboard) onBackToDashboard();
                  else if (onViewMyQuotes) onViewMyQuotes();
                }}
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer border border-slate-200 text-xs font-bold flex items-center space-x-1"
                title="Back to Quotes"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Back to Quotes</span>
              </button>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded-lg text-xs font-mono font-black bg-slate-900 text-[#00E5C0]">
                {quoteNumber}
              </span>

              <span className="text-xs font-black text-slate-900">
                {clientName || 'New Client'}
              </span>

              <span className="text-slate-300">•</span>

              <span className="text-xs font-bold text-slate-700 flex items-center space-x-1">
                <MapPin className="w-3.5 h-3.5 text-teal-600" />
                <span>{currentDestination.name}</span>
              </span>

              <span className="text-slate-300">•</span>

              <span className="text-xs text-slate-600 font-medium">
                {startDate ? new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''} – {endDate ? new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''} ({tripNights}N)
              </span>

              <span className="text-slate-300">•</span>

              <span className="text-xs text-slate-600 font-semibold">
                {adultsCount} Adults{childrenCount > 0 ? ` · ${childrenCount} Child${childrenCount > 1 ? 'ren' : ''}` : ''}{infantsCount > 0 ? ` · ${infantsCount} Infant${infantsCount > 1 ? 's' : ''}` : ''}
              </span>

              {/* Status Badge */}
              {feasibility.warnings.length > 0 ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 flex items-center space-x-1">
                  <AlertTriangle className="w-3 h-3 text-amber-700" />
                  <span>{feasibility.warnings.length} Alerts</span>
                </span>
              ) : items.length > 0 ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                  <span>Ready</span>
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                  Draft
                </span>
              )}
            </div>
          </div>

          {/* Right: Currency + Save Draft + Preview + Generate Quotation */}
          <div className="flex items-center space-x-2">
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 border border-slate-200 outline-none cursor-pointer"
            >
              {SUPPORTED_CURRENCIES.map(curr => (
                <option key={curr.code} value={curr.code}>{curr.code} ({curr.symbol})</option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleSaveDraft}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-200 transition-all cursor-pointer shadow-2xs"
            >
              Save Draft
            </button>

            <button
              type="button"
              onClick={() => {
                handleSaveDraft();
                setActiveViewTab(activeViewTab === 'PROPOSAL_PREVIEW' ? 'BUILDER' : 'PROPOSAL_PREVIEW');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 shadow-2xs ${
                activeViewTab === 'PROPOSAL_PREVIEW'
                  ? 'bg-slate-900 text-[#00E5C0]'
                  : 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-teal-600" />
              <span>{activeViewTab === 'PROPOSAL_PREVIEW' ? 'Return to Editor' : 'Preview'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                handleSaveDraft();
                setActiveViewTab('PROPOSAL_PREVIEW');
              }}
              className="px-3.5 py-1.5 rounded-xl bg-[#00C6A6] hover:bg-[#00B598] text-slate-950 text-xs font-black transition-all cursor-pointer flex items-center space-x-1.5 shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Generate Quotation</span>
            </button>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* SCROLLABLE QUOTE BUILDER WORKSPACE AREA (INDEPENDENT SCROLL) */}
      {/* ========================================================================= */}
      <div 
        id="quote-builder-workspace-scroll-area"
        className="flex-1 overflow-y-auto overflow-x-hidden w-full min-h-0 relative bg-slate-100/90"
      >
        {/* ========================================================================= */}
        {/* VIEW: OFFICIAL PROPOSAL PRESENTATION PREVIEW */}
        {/* ========================================================================= */}
        {activeViewTab === 'PROPOSAL_PREVIEW' ? (
          <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 space-y-6 pb-32">
          {/* Back to Editor Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between shadow-xs">
            <div className="flex items-center space-x-2 text-xs text-slate-600">
              <Sparkles className="w-4 h-4 text-[#00A88F]" />
              <span>Client Presentation Mode: Review official proposal layout before dispatching.</span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setActiveViewTab('BUILDER')}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200 transition-colors cursor-pointer"
              >
                ← Return to Editor
              </button>
              <button
                type="button"
                onClick={handleOpenEmailModal}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1.5 shadow-xs"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Send to Client</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadPDF}
                className="px-3.5 py-1.5 rounded-xl bg-[#00C6A6] text-slate-950 text-xs font-black hover:bg-[#00B598] transition-colors cursor-pointer flex items-center space-x-1.5 shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download PDF</span>
              </button>
            </div>
          </div>

          {/* Render Full Proposal Document */}
          <ProposalDocumentView
            quote={{
              id: activeQuoteId,
              quoteNumber,
              version: quoteVersion,
              title: `${currentDestination.name} Bespoke Travel Proposal`,
              destination: currentDestination.name,
              items,
              currency,
              overallMarkupPercent: agentMarkupPercent,
              overallDiscountPercent: overallDiscountPercent || 0,
              totalNetCost,
              totalSellingPrice: finalClientPrice,
              totalTaxes: 0,
              totalMargin: totalMarginAmount + (finalClientPrice - totalSellingPrice),
              clientName: clientName || 'Valued Guest',
              clientEmail: clientEmail || 'client@example.com',
              clientCompany: clientCompany || user?.agencyName || 'Direct B2B Client',
              agentId: user?.id || 'usr-agent-01',
              agentName: user?.name || 'Travel Consultant',
              agentAgency: user?.agencyName || 'Partner Agency',
              agentNotes: agentNotes || '',
              termsAndConditions: 'All wholesale rates are confidential and valid for licensed travel partners.',
              status: 'DRAFT',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              validUntil: new Date(Date.now() + 86400000 * 14).toISOString(),
              travelStartDate: startDate,
              travelEndDate: endDate,
              totalPax: adultsCount + childrenCount + infantsCount,
              routeHubs,
              dayThemes
            }}
            agentUser={user}
            onClose={() => setActiveViewTab('BUILDER')}
            onPrint={() => window.print()}
            onDownloadPdf={handleDownloadPDF}
            onShareLink={() => {
              navigator.clipboard.writeText(window.location.href);
              alert('Proposal preview link copied to clipboard!');
            }}
          />
        </main>
      ) : (
        /* ========================================================================= */
        /* VIEW: PRIMARY ITINERARY BUILDER & DAY-WISE WORKSPACE (GUIDED WORKSPACE) */
        /* ========================================================================= */
        <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 pb-36">
          <StepByStepQuotationWorkspace
              activeStepId={activeStepId}
              setActiveStepId={setActiveStepId}
              currentDestination={currentDestination}
              destinations={destinations}
              onSelectDestination={(dest) => setCurrentDestination(dest)}
              destinationHubs={destinationHubs}
              availableHotels={availableHotels}
              products={products}
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
              setQuotationScope={setQuotationScope}
              startDate={startDate}
              setStartDate={setStartDate}
              endDate={endDate}
              setEndDate={setEndDate}
              tripNights={tripNights}
              adultsCount={adultsCount}
              setAdultsCount={setAdultsCount}
              childrenCount={childrenCount}
              onSetChildrenCount={handleSetChildrenCount}
              infantsCount={infantsCount}
              setInfantsCount={setInfantsCount}
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
              setRouteHubs={setRouteHubs}
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
              agentMarkupPercent={agentMarkupPercent}
              setAgentMarkupPercent={setAgentMarkupPercent}
              overallDiscountPercent={overallDiscountPercent}
              setOverallDiscountPercent={setOverallDiscountPercent}
              totalNetCost={totalNetCost}
              totalSellingPrice={totalSellingPrice}
              finalClientPrice={finalClientPrice}
              totalMarginAmount={totalMarginAmount}
              quotationOptions={computedQuotationOptions}
              activeOptionTab={activeOptionTab}
              onSelectOptionTab={handleSwitchOptionTab}
              transferSuggestions={transferSuggestions}
              onAddSuggestedTransfer={handleAddSuggestedTransfer}
              feasibility={feasibility}
              onOpenManualHotelModal={(hubId) => {
                setManualHotelModalHubId(hubId);
                setManualHotelModalInitialData(null);
                setIsManualHotelModalOpen(true);
              }}
              onOpenVisaPickerModal={() => setShowVisaPickerModal(true)}
              onOpenAddonModal={(cat) => {
                if (cat) setAddonModalCategory(cat);
                setShowAddonModal(true);
              }}
              onOpenQuickAddProductModal={handleOpenQuickAddModal}
              onOpenProductDetails={handleOpenProductDetails}
              onOpenCalculator={(prod) => setCalculatorProduct(prod)}
              onSaveDraft={handleSaveDraft}
              onPreviewQuotation={() => {
                handleSaveDraft();
                setActiveViewTab('PROPOSAL_PREVIEW');
              }}
              onDownloadPDF={handleDownloadPDF}
              onOpenEmailModal={handleOpenEmailModal}
              onConvertBooking={handleConvertBooking}
              onOpenSavePackageModal={handleOpenSavePackageModal}
              canSaveAsPackage={canSaveAsPackage}
              canAddManualHotel={canAddManualHotel}
              autoSaveStatus={autoSaveStatus}
              lastSavedTimestamp={lastSavedTimestamp}
              onSelectHotelForHub={handleSelectHotelForHub}
              onRemoveHotelForHub={handleRemoveHotelForHub}
              onOpenEditManualHotel={handleOpenEditManualHotel}
              onRemoveManualHotel={handleRemoveManualHotel}
              onOpenEditItem={handleOpenEditItem}
              dayThemes={dayThemes}
              setDayThemes={setDayThemes}
            />
        </main>
      )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: QUICK ADD PRODUCT MODAL (CITY-FILTERED BY DAY) */}
      {/* ========================================================================= */}
      {quickAddModalDay && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[88vh] animate-scaleUp">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-teal-50/80 to-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] uppercase font-black text-teal-700 tracking-wider">Experience Catalog</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#00C6A6] text-white shadow-2xs">
                    📍 {quickAddModalDay.hubName}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                  Add Experience to Day {quickAddModalDay.dayNum}
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
                    <span>Target City:</span>
                    <span className="text-teal-800 bg-teal-100/70 px-2 py-0.5 rounded-md font-mono">
                      📍 {quickAddModalDay.hubName}
                    </span>
                  </span>
                </div>

                {/* City vs All Toggle */}
                <div className="flex items-center space-x-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setFilterByDayCityOnly(true)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      filterByDayCityOnly
                        ? 'bg-[#00C6A6] text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    📍 {quickAddModalDay.hubName} Only ({totalCityProductsCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterByDayCityOnly(false)}
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

              {/* Category Pills */}
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {productCategories.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setQuickAddCategory(cat)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      quickAddCategory === cat
                        ? 'bg-[#00C6A6] text-white'
                        : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
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
                        ? `No products tagged for ${quickAddModalDay.hubName} matching your filter.`
                        : `No products matching your search in ${currentDestination.name}.`
                      }
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {filterByDayCityOnly 
                        ? `You can switch to view all available products across ${currentDestination.name} or adjust your filters.`
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
                quickAddFilteredProducts.map(prod => (
                  <div
                    key={prod.id}
                    className="bg-white p-3.5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 hover:shadow-xs transition-all"
                  >
                    {/* Thumbnail & Product Details */}
                    <div className="flex items-start space-x-3 min-w-0 flex-1">
                      {prod.images && prod.images.length > 0 ? (
                        <img
                          src={prod.images[0]}
                          alt={prod.name}
                          referrerPolicy="no-referrer"
                          className="w-16 h-16 rounded-xl object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-teal-50 border border-teal-200 text-[#00A88F] flex items-center justify-center shrink-0">
                          <Compass className="w-6 h-6" />
                        </div>
                      )}

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
                              From: {formatCurrency(prod.pricing.sellingPrice || prod.pricing.costPrice || 0, currency)}
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
                          handleAddProductToQuoteSilently(prod, {
                            adults: adultsCount,
                            children: childrenCount,
                            infants: infantsCount,
                            travelDate: quickAddModalDay.dateString
                          });
                          setQuickAddModalDay(null);
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-[#00C6A6] hover:bg-[#00A88F] text-white font-bold text-xs transition-colors cursor-pointer shadow-xs flex items-center space-x-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add to Day {quickAddModalDay.dayNum}</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: INLINE SERVICE CUSTOMIZER */}
      {/* ========================================================================= */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 space-y-4 border border-slate-200 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <span className="text-[10px] uppercase font-bold text-teal-700 block">Service Customizer</span>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate max-w-xs">{editingItem.product.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Day / Date Reassignment */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Assigned Date & Day</label>
                <select
                  value={editFormData.travelDate}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, travelDate: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none focus:bg-white focus:border-[#00C6A6]"
                >
                  {daySlots.map(slot => (
                    <option key={slot.dateString} value={slot.dateString}>
                      Day {slot.dayNumber} ({slot.dayOfWeek}, {slot.formattedDate}) - {slot.hub?.hubName || 'General'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Service Time */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Service Pickup / Activity Time</label>
                <input
                  type="text"
                  placeholder="e.g. 09:30 AM or 14:00 PM"
                  value={editFormData.serviceTime}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, serviceTime: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none focus:bg-white focus:border-[#00C6A6]"
                />
              </div>

              {/* Pax for this item */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Participants for this Service</label>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-slate-50 p-2 rounded-xl border border-slate-200 flex items-center justify-between">
                    <span className="text-[10px] text-slate-600 font-bold">Adults</span>
                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        disabled={editFormData.adults <= 1}
                        onClick={() => setEditFormData(prev => ({ ...prev, adults: Math.max(1, prev.adults - 1) }))}
                        className="w-5 h-5 rounded bg-white hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold cursor-pointer"
                      >
                        -
                      </button>
                      <span className="font-bold text-slate-900 w-4 text-center">{editFormData.adults}</span>
                      <button
                        type="button"
                        onClick={() => setEditFormData(prev => ({ ...prev, adults: prev.adults + 1 }))}
                        className="w-5 h-5 rounded bg-white hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-2 rounded-xl border border-slate-200 flex items-center justify-between">
                    <span className="text-[10px] text-slate-600 font-bold">Children</span>
                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        disabled={editFormData.children <= 0}
                        onClick={() => setEditFormData(prev => ({ ...prev, children: Math.max(0, prev.children - 1) }))}
                        className="w-5 h-5 rounded bg-white hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold cursor-pointer"
                      >
                        -
                      </button>
                      <span className="font-bold text-slate-900 w-4 text-center">{editFormData.children}</span>
                      <button
                        type="button"
                        onClick={() => setEditFormData(prev => ({ ...prev, children: prev.children + 1 }))}
                        className="w-5 h-5 rounded bg-white hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-2 rounded-xl border border-slate-200 flex items-center justify-between">
                    <span className="text-[10px] text-slate-600 font-bold">Infants</span>
                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        disabled={editFormData.infants <= 0}
                        onClick={() => setEditFormData(prev => ({ ...prev, infants: Math.max(0, prev.infants - 1) }))}
                        className="w-5 h-5 rounded bg-white hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold cursor-pointer"
                      >
                        -
                      </button>
                      <span className="font-bold text-slate-900 w-4 text-center">{editFormData.infants}</span>
                      <button
                        type="button"
                        onClick={() => setEditFormData(prev => ({ ...prev, infants: prev.infants + 1 }))}
                        className="w-5 h-5 rounded bg-white hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Voucher Special Instructions</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Vegetarian lunch requested; meet driver at hotel lobby..."
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none focus:bg-white focus:border-[#00C6A6]"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEditItem}
                className="px-5 py-2 rounded-xl bg-[#00C6A6] text-white text-xs font-bold hover:bg-[#00A88F] cursor-pointer shadow-xs"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EMAIL PROPOSAL */}
      {/* ========================================================================= */}
      {isEmailModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 border border-slate-200 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Email Itinerary Proposal</h3>
                  <p className="text-xs text-slate-500">Dispatch bespoke HTML quote to client inbox.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEmailModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Feedback Notifications */}
            {emailSuccessMessage && (
              <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-xs text-teal-800 font-medium">
                ✓ {emailSuccessMessage}
              </div>
            )}
            {emailErrorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium">
                {emailErrorMessage}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Recipient Email</label>
                <input
                  type="email"
                  value={emailRecipient}
                  onChange={(e) => setEmailRecipient(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 font-mono outline-none focus:bg-white focus:border-[#00C6A6]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Subject</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none focus:bg-white focus:border-[#00C6A6]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Personal Message Note</label>
                <textarea
                  rows={4}
                  value={emailMessage}
                  onChange={(e) => setEmailMessage(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none focus:bg-white focus:border-[#00C6A6]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsEmailModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSendingEmail || !emailRecipient}
                onClick={handleSendProposalEmail}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold disabled:opacity-50 flex items-center space-x-2 cursor-pointer shadow-xs"
              >
                {isSendingEmail ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Proposal Email</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PRODUCT DETAIL MODAL */}
      {/* ========================================================================= */}
      {inspectingProduct && (
        <ProductDetailModal
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
              travelDate: quickAddModalDay?.dateString || initialDate || startDate
            });
            setInspectingProduct(null);
            setQuickAddModalDay(null);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: PRICING CALCULATOR MODAL */}
      {/* ========================================================================= */}
      {calculatorProduct && (
        <PricingCalculatorModal
          product={calculatorProduct}
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-scaleUp">
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-[#008972] text-white flex items-center justify-center">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black">Save as Ready-Made Package</h3>
                  <p className="text-xs text-slate-300">
                    Publish this circuit directly to the Master Packages catalog for B2B agents & travelers.
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
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Trip Style</label>
                  <select
                    value={packageFormData.tripType}
                    onChange={(e) => setPackageFormData({ ...packageFormData, tripType: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 font-bold outline-none"
                  >
                    <option value="LUXURY">LUXURY (5-Star)</option>
                    <option value="BOUTIQUE">BOUTIQUE & HERITAGE</option>
                    <option value="HONEYMOON">HONEYMOON ESCAPE</option>
                    <option value="FAMILY">FAMILY CIRCUIT</option>
                    <option value="ADVENTURE">ADVENTURE & NATURE</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Commercial Pricing Mode</label>
                  <select
                    value={packageFormData.pricingMode}
                    onChange={(e) => setPackageFormData({ ...packageFormData, pricingMode: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 font-bold outline-none"
                  >
                    <option value="LIVE_DYNAMIC">LIVE DYNAMIC (Calculates live tariffs)</option>
                    <option value="FIXED_LOCKED">FIXED LOCKED (Guaranteed price quote)</option>
                  </select>
                </div>
              </div>

              {/* Summary Stats */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Duration</span>
                  <span className="font-extrabold text-slate-800">{tripNights}N / {tripNights + 1}D</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Services Included</span>
                  <span className="font-extrabold text-slate-800">{items.length} master items</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Starting Price</span>
                  <span className="font-extrabold text-[#008972] font-mono">{formatCurrency(finalClientPrice, currency)}</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-semibold">
                Uses master product references without duplicating inventory.
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
                  Publish Package
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Package Saved Toast Notice */}
      {packageSavedNotice && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-950 text-white border border-[#00C6A6]/40 p-4 rounded-2xl shadow-2xl flex items-center space-x-3 animate-slideUp">
          <div className="w-8 h-8 rounded-xl bg-[#008972] text-white flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-black text-white">{packageSavedNotice}</p>
            <p className="text-[10px] text-slate-400">Available across Destination pages, B2B Agent Portal, and CMS.</p>
          </div>
        </div>
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
                  <h3 className="text-base font-bold text-white">Select Visa & Travel Facilitation</h3>
                  <p className="text-xs text-slate-400">Browse verified B2B eVisas and consular facilitation packages.</p>
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
                {['ALL', 'TOURIST', 'BUSINESS', 'TRANSIT', 'LONG_STAY'].map(cat => (
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
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* List of Visas */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-3 flex-1">
              {VISA_CATALOG
                .filter(visa => {
                  const matchesSearch = !visaPickerSearch.trim() || 
                    visa.country.toLowerCase().includes(visaPickerSearch.toLowerCase()) ||
                    visa.visaType.toLowerCase().includes(visaPickerSearch.toLowerCase()) ||
                    visa.category.toLowerCase().includes(visaPickerSearch.toLowerCase());
                  const matchesCat = visaPickerCategory === 'ALL' || visa.category === visaPickerCategory;
                  return matchesSearch && matchesCat;
                })
                .map(visa => {
                  const isCurrentDest = visa.country.toLowerCase() === currentDestination.name.toLowerCase();
                  const alreadyInQuote = isVisaInQuote(visa.id);

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
                            {visa.category}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                          <span className="flex items-center space-x-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>{visa.processingTimeDays}</span>
                          </span>
                          <span>•</span>
                          <span>{visa.entryType}</span>
                          <span>•</span>
                          <span>Validity: {visa.validity}</span>
                          <span>•</span>
                          <span className="text-teal-700 font-medium">{visa.embassySubmissionType}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200">
                        <div className="text-left sm:text-right">
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Selling Price</span>
                          <span className="text-sm font-black text-slate-900 font-mono">
                            {formatCurrency(convertCurrency(visa.suggestedSellingUSD, 'USD', currency), currency)}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setShowVisaPickerModal(false);
                            setSelectedVisaForQuoteModal(visa);
                          }}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs ${
                            alreadyInQuote
                              ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          }`}
                        >
                          {alreadyInQuote ? 'Configure Additional' : 'Configure & Add'}
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-slate-500 font-medium">
                Showing {VISA_CATALOG.length} verified visa facilitation pathways.
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
          onClose={() => setSelectedVisaForQuoteModal(null)}
          initialTravelDate={startDate}
          initialApplicants={adultsCount + childrenCount}
          onSuccess={(visa, details) => {
            setSelectedVisaForQuoteModal(null);
            // Open toast or update status
            setAutoSaveStatus('SAVED');
            setLastSavedTimestamp(new Date().toLocaleTimeString());
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
      {/* FLOATING IN-BUILDER TOAST NOTIFICATION */}
      {/* ========================================================================= */}
      {builderToast && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce-short shadow-2xl">
          <div className={`px-4 py-3 rounded-2xl flex items-center space-x-3 text-xs font-bold border backdrop-blur-md ${
            builderToast.type === 'SUCCESS'
              ? 'bg-slate-900/95 text-[#00E5C0] border-teal-500/40 shadow-teal-500/10'
              : builderToast.type === 'WARNING'
              ? 'bg-amber-900/95 text-amber-200 border-amber-500/40 shadow-amber-500/10'
              : 'bg-slate-900/95 text-white border-slate-700 shadow-black/20'
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
