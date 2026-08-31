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
  Info
} from 'lucide-react';
import { 
  Product, 
  Destination, 
  CurrencyCode, 
  QuoteItem, 
  Quotation, 
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

      // Find items matching this day's date
      const dayItems = items.filter(it => it.travelDate === calDay.dateString);
      const dayHotelItems = dayItems.filter(isHotelQuoteItem);
      const dayProductItems = dayItems.filter(it => !isHotelQuoteItem(it));

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

  // Grouped items
  const hotelItems = useMemo(() => items.filter(isHotelQuoteItem), [items]);
  const experienceItems = useMemo(() => items.filter(it => !isHotelQuoteItem(it)), [items]);

  const hotelTotalSelling = useMemo(() => hotelItems.reduce((sum, it) => sum + (it.calculation?.finalTotalSellingPrice || 0), 0), [hotelItems]);
  const experienceTotalSelling = useMemo(() => experienceItems.reduce((sum, it) => sum + (it.calculation?.finalTotalSellingPrice || 0), 0), [experienceItems]);

  const finalClientPrice = useMemo(() => {
    return totalSellingPrice * (1 + (agentMarkupPercent || 0) / 100);
  }, [totalSellingPrice, agentMarkupPercent]);

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
    <div className="w-full min-h-screen bg-slate-100/90 text-slate-900 flex flex-col font-sans pb-24 selection:bg-[#00C6A6] selection:text-slate-950">
      {/* ========================================================================= */}
      {/* TOP WORKSPACE NAVIGATION & CONTROLS */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 py-3.5 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Left: Title & Live Indicators */}
          <div className="flex items-center space-x-3">
            {onBackToDashboard && (
              <button
                type="button"
                onClick={onBackToDashboard}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer border border-slate-200"
                title="Back to Dashboard"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 flex items-center space-x-2">
                  <Compass className="w-5 h-5 text-[#00A88F]" />
                  <span>Day-Wise Itinerary Builder</span>
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-teal-50 text-teal-700 border border-teal-200">
                  {quoteNumber}
                </span>
                <span className="hidden sm:inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  <CheckCircle2 className="w-3 h-3 text-[#00A88F]" />
                  <span>{autoSaveStatus === 'SAVING' ? 'Saving to Cloud...' : `Cloud Saved (${lastSavedTimestamp})`}</span>
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {currentDestination.name} • {tripNights} Nights • {items.length} Included Services
              </p>
            </div>
          </div>

          {/* Center / Right: View Mode Toggle & Primary Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* View Switcher: Builder vs Proposal Document */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveViewTab('BUILDER')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center space-x-1.5 ${
                  activeViewTab === 'BUILDER'
                    ? 'bg-[#00C6A6] text-slate-950 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Itinerary Editor</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  handleSaveDraft();
                  setActiveViewTab('PROPOSAL_PREVIEW');
                }}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center space-x-1.5 ${
                  activeViewTab === 'PROPOSAL_PREVIEW'
                    ? 'bg-[#00C6A6] text-slate-950 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Proposal Preview</span>
              </button>
            </div>

            {/* Currency Selector */}
            <div className="relative">
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 border border-slate-200 outline-none cursor-pointer"
              >
                {SUPPORTED_CURRENCIES.map(curr => (
                  <option key={curr.code} value={curr.code}>{curr.code} ({curr.symbol})</option>
                ))}
              </select>
            </div>

            {/* Fast Action Buttons */}
            <button
              type="button"
              onClick={handleOpenEmailModal}
              className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
              title="Email Itinerary Proposal to Client"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Email</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPDF}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold border border-slate-200 transition-colors cursor-pointer shadow-xs"
              title="Download Branded PDF Proposal"
            >
              <Download className="w-3.5 h-3.5 text-[#00A88F]" />
              <span className="hidden md:inline">Download PDF</span>
            </button>

            {canSaveAsPackage && (
              <button
                type="button"
                onClick={handleOpenSavePackageModal}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
                title="Save & Publish as a Master Ready-Made Package"
              >
                <Layers className="w-3.5 h-3.5 text-[#00C6A6]" />
                <span className="hidden sm:inline">Save as Package</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleConvertBooking}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-[#00C6A6] hover:bg-[#00B598] text-slate-950 text-xs font-black transition-all cursor-pointer shadow-xs"
            >
              <BookmarkCheck className="w-4 h-4" />
              <span>Convert to Booking</span>
            </button>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* VIEW: OFFICIAL PROPOSAL PRESENTATION PREVIEW */}
      {/* ========================================================================= */}
      {activeViewTab === 'PROPOSAL_PREVIEW' ? (
        <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 space-y-6">
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
        /* VIEW: PRIMARY ITINERARY BUILDER & DAY-WISE WORKSPACE */
        /* ========================================================================= */
        <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6">
          {/* --------------------------------------------------------------------- */}
          {/* SECTION 1: QUOTE HEADER / TRIP & CLIENT SPECIFICATIONS */}
          {/* --------------------------------------------------------------------- */}
          <section className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between cursor-pointer" onClick={() => setIsSpecsExpanded(!isSpecsExpanded)}>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 text-[#00A88F] flex items-center justify-center">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center space-x-2">
                    <span>Trip & Client Specifications</span>
                    <span className="text-[11px] font-normal text-slate-500">
                      ({clientName || 'New Client'} • {tripNights} Nights • {adultsCount} Adults{childrenCount > 0 ? `, ${childrenCount} Ch` : ''})
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500">Specify traveler details, dates, passengers, and package scope.</p>
                </div>
              </div>
              <button type="button" className="text-slate-400 hover:text-slate-600 p-1">
                {isSpecsExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
            </div>

            {isSpecsExpanded && (
              <div className="pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fadeIn">
                {/* Client Lead Quick Select */}
                <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>Select CRM Lead / Client</span>
                    <UserCheck className="w-3.5 h-3.5 text-teal-600" />
                  </label>
                  <select
                    value={selectedLeadId}
                    onChange={(e) => handleSelectLead(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#00C6A6] focus:border-[#00C6A6] outline-none"
                  >
                    <option value="">-- New / Custom Traveler --</option>
                    {crmLeads.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.contactName} {l.agencyName ? `(${l.agencyName})` : ''} - {l.destinationName || 'Tour'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Client Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Client / Lead Traveler Name</label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="e.g. John & Sarah Sterling"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#00C6A6] focus:border-[#00C6A6] outline-none"
                  />
                </div>

                {/* Client Email */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Client Email</label>
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="traveler@luxury.com"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#00C6A6] focus:border-[#00C6A6] outline-none font-mono"
                  />
                </div>

                {/* Destination Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Primary Destination</label>
                  <select
                    value={currentDestination.id}
                    onChange={(e) => {
                      const dest = destinations.find(d => d.id === e.target.value);
                      if (dest) setCurrentDestination(dest);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 font-bold focus:bg-white focus:ring-2 focus:ring-[#00C6A6] focus:border-[#00C6A6] outline-none"
                  >
                    {destinations.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.code || 'INTL'})</option>
                    ))}
                  </select>
                </div>

                {/* Start Date */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Travel Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#00C6A6] focus:border-[#00C6A6] outline-none font-mono"
                  />
                </div>

                {/* End Date */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Travel End Date <span className="text-[#00A88F]">({tripNights} Nights)</span>
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#00C6A6] focus:border-[#00C6A6] outline-none font-mono"
                  />
                </div>

                {/* Passenger Breakdown */}
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>Passengers / Participants</span>
                    <span className="text-teal-700 font-bold">Total: {adultsCount + childrenCount + infantsCount} Guests</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {/* Adults */}
                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-200 flex items-center justify-between">
                      <span className="text-[11px] text-slate-600 font-bold">Adults</span>
                      <div className="flex items-center space-x-1.5">
                        <button
                          type="button"
                          disabled={adultsCount <= 1}
                          onClick={() => setAdultsCount(Math.max(1, adultsCount - 1))}
                          className="w-5 h-5 rounded bg-white hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold text-xs disabled:opacity-30 cursor-pointer"
                        >
                          -
                        </button>
                        <span className="text-xs font-bold text-slate-900 w-4 text-center">{adultsCount}</span>
                        <button
                          type="button"
                          onClick={() => setAdultsCount(adultsCount + 1)}
                          className="w-5 h-5 rounded bg-white hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold text-xs cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Children */}
                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-200 flex items-center justify-between">
                      <span className="text-[11px] text-slate-600 font-bold">Children</span>
                      <div className="flex items-center space-x-1.5">
                        <button
                          type="button"
                          disabled={childrenCount <= 0}
                          onClick={() => setChildrenCount(Math.max(0, childrenCount - 1))}
                          className="w-5 h-5 rounded bg-white hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold text-xs disabled:opacity-30 cursor-pointer"
                        >
                          -
                        </button>
                        <span className="text-xs font-bold text-slate-900 w-4 text-center">{childrenCount}</span>
                        <button
                          type="button"
                          onClick={() => setChildrenCount(childrenCount + 1)}
                          className="w-5 h-5 rounded bg-white hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold text-xs cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Infants */}
                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-200 flex items-center justify-between">
                      <span className="text-[11px] text-slate-600 font-bold">Infants</span>
                      <div className="flex items-center space-x-1.5">
                        <button
                          type="button"
                          disabled={infantsCount <= 0}
                          onClick={() => setInfantsCount(Math.max(0, infantsCount - 1))}
                          className="w-5 h-5 rounded bg-white hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold text-xs disabled:opacity-30 cursor-pointer"
                        >
                          -
                        </button>
                        <span className="text-xs font-bold text-slate-900 w-4 text-center">{infantsCount}</span>
                        <button
                          type="button"
                          onClick={() => setInfantsCount(infantsCount + 1)}
                          className="w-5 h-5 rounded bg-white hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold text-xs cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quotation Scope Selector */}
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700">Quotation Scope & Service Inclusions</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setQuotationScope('HOTEL_LAND')}
                      className={`p-2 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer ${
                        quotationScope === 'HOTEL_LAND'
                          ? 'bg-teal-50 border-[#00C6A6] text-teal-800 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      🏨 Full Package (Hotel + Land)
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuotationScope('LAND_ONLY')}
                      className={`p-2 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer ${
                        quotationScope === 'LAND_ONLY'
                          ? 'bg-teal-50 border-[#00C6A6] text-teal-800 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      🗺️ Land Experiences Only
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuotationScope('HOTEL_ONLY')}
                      className={`p-2 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer ${
                        quotationScope === 'HOTEL_ONLY'
                          ? 'bg-teal-50 border-[#00C6A6] text-teal-800 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      🛏️ Hotel Stays Only
                    </button>
                  </div>
                </div>

                {/* Special Instructions */}
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700">Special Logistics & Client Instructions</label>
                  <input
                    type="text"
                    value={agentNotes}
                    onChange={(e) => setAgentNotes(e.target.value)}
                    placeholder="e.g. VIP clients celebrating 10th anniversary; private luxury transfer required on arrival..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#00C6A6] focus:border-[#00C6A6] outline-none"
                  />
                </div>
              </div>
            )}
          </section>

          {/* --------------------------------------------------------------------- */}
          {/* SECTION 2: MULTI-CITY ROUTE & HUB SEQUENCER */}
          {/* --------------------------------------------------------------------- */}
          <section className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between cursor-pointer" onClick={() => setIsRouteExpanded(!isRouteExpanded)}>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
                  <Compass className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center space-x-2">
                    <span>Itinerary Route & City Hubs</span>
                    <span className="text-xs font-mono font-bold text-[#00A88F]">
                      ({routeTotalNights} / {tripNights} Nights Allocated)
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500">Sequence city stays across {currentDestination.name}. Day slots update automatically.</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {routeTotalNights !== tripNights && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAutoBalanceNights();
                    }}
                    className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-bold hover:bg-amber-100 transition-colors cursor-pointer"
                  >
                    Auto-Balance Nights
                  </button>
                )}
                <button type="button" className="text-slate-400 hover:text-slate-600 p-1">
                  {isRouteExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {isRouteExpanded && (
              <div className="pt-4 border-t border-slate-200 space-y-4 animate-fadeIn">
                {/* Route Flow Visualizer */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {routeHubs.map((hub, idx) => (
                    <div 
                      key={hub.id}
                      className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200 space-y-2 relative group hover:border-slate-300 hover:bg-white transition-all shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-mono font-bold text-slate-600">
                          Hub #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveHubFromRoute(hub.id)}
                          className="text-slate-400 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          title="Remove Hub"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center space-x-2">
                        <MapPin className="w-4 h-4 text-[#00A88F] shrink-0" />
                        <h4 className="text-sm font-bold text-slate-900 truncate">{hub.hubName}</h4>
                      </div>

                      {/* Nights Control */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                        <span className="text-[11px] text-slate-500 font-medium">Duration:</span>
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            disabled={hub.nights <= 1}
                            onClick={() => handleAdjustHubNights(hub.id, -1)}
                            className="w-5 h-5 rounded bg-white hover:bg-slate-200 border border-slate-300 disabled:opacity-30 text-slate-700 font-bold text-xs cursor-pointer"
                          >
                            -
                          </button>
                          <span className="text-xs font-bold text-teal-700 font-mono">{hub.nights} Nights</span>
                          <button
                            type="button"
                            onClick={() => handleAdjustHubNights(hub.id, 1)}
                            className="w-5 h-5 rounded bg-white hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold text-xs cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Add Hub Card */}
                  <div className="bg-slate-50/60 rounded-2xl p-3.5 border border-dashed border-slate-300 flex flex-col items-center justify-center space-y-2 text-center">
                    <span className="text-xs font-bold text-slate-600">+ Add Destination Hub</span>
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          handleAddHubToRoute(e.target.value);
                          e.target.value = '';
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-xs text-slate-800 outline-none cursor-pointer focus:border-[#00C6A6]"
                    >
                      <option value="">Select City Hub...</option>
                      {destinationHubs.map(h => (
                        <option key={h.id} value={h.id}>{h.hubName || h.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* --------------------------------------------------------------------- */}
          {/* SECTION 3: ACCOMMODATION / HOTEL SELECTION SECTION */}
          {/* --------------------------------------------------------------------- */}
          {quotationScope !== 'LAND_ONLY' && (
            <section className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between cursor-pointer" onClick={() => setIsHotelSectionExpanded(!isHotelSectionExpanded)}>
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center space-x-2">
                      <span>Accommodations & Hotel Stays</span>
                      <span className="text-xs font-mono font-bold text-indigo-600">
                        ({hotelItems.length} Hotels Booked • {formatCurrency(hotelTotalSelling, currency)})
                      </span>
                    </h2>
                    <p className="text-xs text-slate-500">Select contracted luxury properties per hub or enter manual quotation rates.</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2.5">
                  {canAddManualHotel && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenAddManualHotel();
                      }}
                      className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5 text-amber-600" />
                      <span>+ Add Manual Hotel / Rate</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setQuotationScope('LAND_ONLY');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Skip Accommodation (Land Only)
                  </button>
                  <button type="button" className="text-slate-400 hover:text-slate-600 p-1">
                    {isHotelSectionExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {isHotelSectionExpanded && (
                <div className="pt-4 border-t border-slate-200 space-y-4 animate-fadeIn">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {routeHubs.map(hub => {
                      const { checkInFormatted, checkOutFormatted } = getHubDates(hub.order, hub.nights || 1);

                      // Available hotels for this hub
                      const currentHubHotels = availableHotels.filter(h => 
                        h.cityName?.toLowerCase() === hub.hubName.toLowerCase() ||
                        h.destinationId === currentDestination.id ||
                        h.country?.toLowerCase() === currentDestination.name.toLowerCase()
                      );
                      const hotelsToDisplay = currentHubHotels.length > 0 ? currentHubHotels : availableHotels;

                      // Assigned item
                      const assignedItem = hotelItems.find(it => 
                        it.notes?.includes(hub.hubName) || 
                        (hub.hotelId && it.product.id.includes(hub.hotelId)) ||
                        (it.manualHotelDetails?.hubId === hub.id) ||
                        it.product.name.toLowerCase().includes(hub.hubName.toLowerCase())
                      );

                      // Check if manual hotel
                      const isManualStay = Boolean(
                        hub.isManualHotel || 
                        hub.manualHotel || 
                        assignedItem?.isManualHotel || 
                        assignedItem?.product?.accommodationType === 'manual' ||
                        assignedItem?.accommodationType === 'manual'
                      );
                      const manualDetails = hub.manualHotel || assignedItem?.manualHotelDetails;
                      
                      const selectedHotel = !isManualStay ? (
                        availableHotels.find(h => h.id === hub.hotelId) || 
                        (assignedItem ? availableHotels.find(h => assignedItem.product.id.includes(h.id)) : undefined)
                      ) : undefined;

                      // Selected room and rate calculations for Master Hotel
                      const selectedRoom = selectedHotel?.roomTypes?.find(r => r.id === hub.roomTypeId) || selectedHotel?.roomTypes?.[0];
                      const selectedRate = selectedRoom?.rates?.[0];
                      const baseNightly = selectedRate?.doubleNetRate || selectedRate?.singleNetRate || selectedHotel?.startingNetPrice || 200;
                      const hotelCurr = selectedRate?.currency || selectedHotel?.currency || 'USD';
                      const nightlyInQuoteCurrency = convertCurrency(baseNightly, hotelCurr, currency);
                      const currentRoomsCount = hub.roomsCount || 1;
                      const currentNights = hub.nights || 1;
                      const totalStayNet = nightlyInQuoteCurrency * currentNights * currentRoomsCount;
                      const finalSellingStayPrice = totalStayNet * (1 + (agentMarkupPercent || 0) / 100);

                      // Occupancy validation cross-check
                      const occupancy = validateRoomOccupancy(
                        selectedRoom,
                        currentRoomsCount,
                        adultsCount,
                        childrenCount,
                        infantsCount
                      );

                      // Manual Hotel Calculated Selling Price
                      const manualSellingPrice = assignedItem?.calculation?.finalTotalSellingPrice || assignedItem?.calculation?.totalSellingPrice || (
                        manualDetails ? (
                          convertCurrency(
                            (manualDetails.rateType === 'TOTAL' 
                              ? manualDetails.ratePerNight 
                              : manualDetails.rateType === 'PER_PERSON' 
                                ? manualDetails.ratePerNight * (adultsCount + childrenCount) * (manualDetails.numberOfNights || hub.nights || 1)
                                : manualDetails.ratePerNight * (manualDetails.numberOfRooms || hub.roomsCount || 1) * (manualDetails.numberOfNights || hub.nights || 1)
                            ),
                            manualDetails.rateCurrency,
                            currency
                          ) * (1 + (agentMarkupPercent || 0) / 100)
                        ) : 0
                      );

                      return (
                        <div key={hub.id} className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3.5 shadow-xs">
                          {/* Hub Card Header */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-1.5 min-w-0">
                              <MapPin className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                              <span className="text-xs font-bold text-slate-900 truncate">
                                {hub.hubName} Hub
                              </span>
                              <span className="text-[11px] font-mono font-bold text-teal-700">
                                • {hub.nights} {hub.nights === 1 ? 'Night' : 'Nights'}
                              </span>
                            </div>
                            {isManualStay ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 shrink-0 flex items-center space-x-1">
                                <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                                <span>Manual Stay</span>
                              </span>
                            ) : selectedHotel ? (
                              occupancy.isValid ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200 shrink-0">
                                  Stay Configured
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 shrink-0 flex items-center space-x-1">
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                  <span>Occupancy Exceeded</span>
                                </span>
                              )
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-600 border border-slate-300 shrink-0">
                                Not Assigned
                              </span>
                            )}
                          </div>

                          {/* Dates Indicator */}
                          <div className="flex items-center space-x-1.5 text-[11px] text-slate-600 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                            <Calendar className="w-3 h-3 text-slate-500 shrink-0" />
                            <span>{checkInFormatted} → {checkOutFormatted}</span>
                          </div>

                          {/* CASE 1: MANUALLY ADDED HOTEL STAY */}
                          {isManualStay && manualDetails ? (
                            <div className="bg-amber-50/60 rounded-xl p-3.5 border border-amber-300 space-y-3 shadow-xs animate-fadeIn">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="flex items-center space-x-1.5">
                                    <span className="px-1.5 py-0.5 rounded bg-amber-200/80 text-amber-900 text-[9px] font-extrabold uppercase tracking-wider">
                                      Quotation-Only Rate
                                    </span>
                                    <span className="text-[10px] font-bold text-amber-800">
                                      {manualDetails.starRating}
                                    </span>
                                  </div>
                                  <h5 className="text-xs font-bold text-slate-900 mt-1">
                                    {manualDetails.hotelName}
                                  </h5>
                                  <p className="text-[10px] text-slate-600">
                                    {manualDetails.city} {manualDetails.address ? `• ${manualDetails.address}` : ''}
                                  </p>
                                </div>
                                <div className="flex items-center space-x-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditManualHotel(hub.id)}
                                    className="p-1 rounded-md bg-white hover:bg-amber-100 border border-amber-200 text-amber-800 text-[10px] font-bold transition-colors cursor-pointer"
                                    title="Edit Manual Hotel & Rate"
                                  >
                                    <Sliders className="w-3 h-3 text-amber-800" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveManualHotel(hub.id)}
                                    className="p-1 rounded-md bg-white hover:bg-rose-100 border border-rose-200 text-rose-600 text-[10px] font-bold transition-colors cursor-pointer"
                                    title="Remove Manual Stay"
                                  >
                                    <Trash2 className="w-3 h-3 text-rose-600" />
                                  </button>
                                </div>
                              </div>

                              {/* Room & Stay Specs */}
                              <div className="bg-white/90 rounded-lg p-2.5 border border-amber-200 space-y-1.5 text-[11px]">
                                <div className="flex items-center justify-between text-slate-900 font-semibold">
                                  <span>Room: {manualDetails.roomType}</span>
                                  <span className="text-[10px] font-mono text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                                    {manualDetails.mealPlanName || manualDetails.mealPlan}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                                  <span>Units: {manualDetails.numberOfRooms} {manualDetails.numberOfRooms > 1 ? 'Rooms' : 'Room'} × {manualDetails.numberOfNights} Nights</span>
                                  <span>Net: {formatCurrency(manualDetails.ratePerNight, manualDetails.rateCurrency)}/{manualDetails.rateType === 'TOTAL' ? 'stay' : manualDetails.rateType === 'PER_PERSON' ? 'pax' : 'nt'}</span>
                                </div>
                              </div>

                              {/* Price Display */}
                              <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-slate-900">Final Selling Price:</span>
                                  <span className="text-sm font-extrabold font-mono text-emerald-600">
                                    {formatCurrency(manualSellingPrice, currency)}
                                  </span>
                                </div>
                                <p className="text-[10px] text-emerald-700 font-medium">
                                  ✓ Clean fixed-stay price • Includes agent markup
                                </p>
                              </div>

                              <div className="flex items-center justify-between pt-1 border-t border-amber-200/80 text-[10px]">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditManualHotel(hub.id)}
                                  className="text-amber-800 hover:text-amber-900 font-bold underline cursor-pointer"
                                >
                                  Modify Rate or Room Specs
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveManualHotel(hub.id)}
                                  className="text-rose-600 hover:text-rose-700 font-bold cursor-pointer"
                                >
                                  Switch to Database Property
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* CASE 2: MASTER HOTEL SELECTOR & OPTION TO ADD MANUAL */
                            <div className="space-y-3">
                              {/* Hotel Selector */}
                              <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                                  <span>Select Contracted Hotel</span>
                                  {canAddManualHotel && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenAddManualHotel(hub.id)}
                                      className="text-[10px] text-amber-800 hover:text-amber-900 font-bold hover:underline cursor-pointer"
                                    >
                                      + Custom Rate
                                    </button>
                                  )}
                                </label>
                                <select
                                  value={selectedHotel?.id || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === 'ADD_MANUAL_HOTEL_ACTION') {
                                      handleOpenAddManualHotel(hub.id);
                                    } else if (val && val !== 'LAND_ONLY_HUB') {
                                      const h = availableHotels.find(x => x.id === val);
                                      if (h) {
                                        handleSelectHotelForHub(hub.order, h, h.roomTypes?.[0]?.id, currentRoomsCount);
                                      }
                                    } else {
                                      handleRemoveHotelForHub(hub.id);
                                    }
                                  }}
                                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 outline-none cursor-pointer focus:border-[#00C6A6] focus:ring-2 focus:ring-[#00C6A6]/20"
                                >
                                  <option value="">-- Choose Hotel for {hub.hubName} --</option>
                                  <option value="LAND_ONLY_HUB">No Accommodation (Arranged by Client)</option>
                                  {canAddManualHotel && (
                                    <option value="ADD_MANUAL_HOTEL_ACTION">
                                      ✨ + Add Manual Hotel / Custom Rate...
                                    </option>
                                  )}
                                  {hotelsToDisplay.map(h => (
                                    <option key={h.id} value={h.id}>
                                      {h.name} ({h.starRating || 5}★) - from {h.currency || 'USD'} {h.startingNetPrice || 250}/nt
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* If Master Hotel Selected */}
                              {selectedHotel ? (
                                <div className="bg-white rounded-xl p-3.5 border border-slate-200 space-y-3 shadow-xs">
                                  {/* Hotel Property Pill */}
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <h5 className="text-xs font-bold text-slate-900">{selectedHotel.name}</h5>
                                      <p className="text-[10px] text-slate-500">
                                        {selectedHotel.starRating}★ {selectedHotel.propertyType?.replace('_', ' ') || 'Luxury Hotel'} • {selectedHotel.area || selectedHotel.cityName}
                                      </p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveHotelForHub(hub.id)}
                                      className="text-[11px] text-red-500 hover:text-red-600 font-bold cursor-pointer shrink-0"
                                    >
                                      Remove
                                    </button>
                                  </div>

                                  {/* Room Type Dropdown */}
                                  <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                                      <span>Room Type & Meal Plan</span>
                                      <span className="text-[10px] text-teal-700 font-medium">
                                        {selectedHotel.roomTypes?.length || 1} available
                                      </span>
                                    </label>
                                    <select
                                      value={selectedRoom?.id || ''}
                                      onChange={(e) => {
                                        handleSelectHotelForHub(hub.order, selectedHotel, e.target.value, currentRoomsCount);
                                      }}
                                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none cursor-pointer focus:bg-white focus:border-[#00C6A6]"
                                    >
                                      {(selectedHotel.roomTypes || []).map(r => {
                                        const rRate = r.rates?.[0];
                                        const rPrice = rRate?.doubleNetRate || selectedHotel.startingNetPrice || 200;
                                        const rCurr = rRate?.currency || selectedHotel.currency || 'USD';
                                        const rConverted = convertCurrency(rPrice, rCurr, currency);
                                        const mealName = rRate?.mealPlanName || 'Bed & Breakfast';

                                        return (
                                          <option key={r.id} value={r.id}>
                                            {r.roomName} • {mealName} ({formatCurrency(rConverted, currency)}/nt)
                                          </option>
                                        );
                                      })}
                                    </select>

                                    {/* Room Capacity Breakdown Badge */}
                                    <div className="flex items-center flex-wrap gap-1 text-[10px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200">
                                      <span className="font-semibold text-slate-700">Room Limit:</span>
                                      <span className="bg-white text-teal-800 px-1.5 py-0.5 rounded font-mono border border-slate-200">
                                        Max {occupancy.perRoomAdults} Adults
                                      </span>
                                      <span className="bg-white text-teal-800 px-1.5 py-0.5 rounded font-mono border border-slate-200">
                                        Max {occupancy.perRoomChildren} Child
                                      </span>
                                      <span className="bg-white text-teal-800 px-1.5 py-0.5 rounded font-mono border border-slate-200">
                                        Max {occupancy.perRoomInfants} Inf
                                      </span>
                                      <span className="text-slate-500">
                                        (Max {occupancy.perRoomTotalPax} Total)
                                      </span>
                                    </div>
                                  </div>

                                  {/* Number of Rooms Dropdown */}
                                  <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                                      <span>Number of Rooms</span>
                                      <span className="text-[10px] text-slate-500 font-mono">
                                        Cap: {occupancy.maxAllowedAdults} Adults / {occupancy.maxAllowedTotalPax} Total
                                      </span>
                                    </label>
                                    <select
                                      value={currentRoomsCount}
                                      onChange={(e) => {
                                        const newRooms = parseInt(e.target.value, 10) || 1;
                                        handleSelectHotelForHub(hub.order, selectedHotel, selectedRoom?.id, newRooms);
                                      }}
                                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none cursor-pointer focus:bg-white focus:border-[#00C6A6]"
                                    >
                                      <option value="1">1 Room (Max {occupancy.perRoomAdults} Adults, {occupancy.perRoomTotalPax} Guests)</option>
                                      <option value="2">2 Rooms (Max {occupancy.perRoomAdults * 2} Adults, {occupancy.perRoomTotalPax * 2} Guests)</option>
                                      <option value="3">3 Rooms (Max {occupancy.perRoomAdults * 3} Adults, {occupancy.perRoomTotalPax * 3} Guests)</option>
                                      <option value="4">4 Rooms (Max {occupancy.perRoomAdults * 4} Adults, {occupancy.perRoomTotalPax * 4} Guests)</option>
                                      <option value="5">5 Rooms (Max {occupancy.perRoomAdults * 5} Adults, {occupancy.perRoomTotalPax * 5} Guests)</option>
                                      <option value="6">6 Rooms (Max {occupancy.perRoomAdults * 6} Adults)</option>
                                      <option value="7">7 Rooms (Max {occupancy.perRoomAdults * 7} Adults)</option>
                                      <option value="8">8 Rooms (Max {occupancy.perRoomAdults * 8} Adults)</option>
                                    </select>
                                  </div>

                                  {/* OCCUPANCY VALIDATION & PRICE DISPLAY */}
                                  {!occupancy.isValid ? (
                                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 space-y-2.5 text-rose-900 animate-fadeIn shadow-xs">
                                      <div className="flex items-start space-x-2">
                                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                                        <div>
                                          <h6 className="text-xs font-bold text-rose-900">
                                            Passenger Exceeding Maximum Occupancy
                                          </h6>
                                          <p className="text-[11px] text-rose-700 mt-0.5">
                                            Your party exceeds the maximum guest occupancy for {currentRoomsCount} {currentRoomsCount > 1 ? 'rooms' : 'room'} of this type.
                                          </p>
                                        </div>
                                      </div>

                                      {/* Error Breakdown */}
                                      <div className="bg-white rounded-lg p-2.5 border border-rose-200 space-y-1.5 text-[11px]">
                                        {occupancy.errors.map((err, idx) => (
                                          <div key={idx} className="flex items-start space-x-1.5 text-rose-800 font-medium">
                                            <span className="text-rose-600 font-bold">•</span>
                                            <span>{err}</span>
                                          </div>
                                        ))}
                                        <div className="pt-1.5 border-t border-rose-100 flex flex-wrap items-center justify-between text-[10px] text-rose-700">
                                          <span>Current Party: <strong>{adultsCount} Adults{childrenCount > 0 ? `, ${childrenCount} Ch` : ''}{infantsCount > 0 ? `, ${infantsCount} Inf` : ''}</strong></span>
                                          <span>Room Limit ({currentRoomsCount}x): <strong>Max {occupancy.maxAllowedAdults} Adults ({occupancy.maxAllowedTotalPax} Total)</strong></span>
                                        </div>
                                      </div>

                                      {/* 1-Click Action to Adjust Rooms */}
                                      <button
                                        type="button"
                                        onClick={() => handleSelectHotelForHub(hub.order, selectedHotel, selectedRoom?.id, occupancy.recommendedRoomsCount)}
                                        className="w-full py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center space-x-1.5 shadow-xs cursor-pointer"
                                      >
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>Auto-Adjust to {occupancy.recommendedRoomsCount} Rooms</span>
                                      </button>
                                      <p className="text-[10px] text-rose-600 text-center italic">
                                        Price is withheld until passenger occupancy complies with hotel policy.
                                      </p>
                                    </div>
                                  ) : (
                                    <div className="space-y-2.5 animate-fadeIn">
                                      {/* Occupancy Verified Pill */}
                                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 flex items-center justify-between text-[11px] text-emerald-800 font-medium">
                                        <div className="flex items-center space-x-1.5">
                                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                          <span>Occupancy Verified ({adultsCount} Ad{childrenCount > 0 ? `, ${childrenCount} Ch` : ''}{infantsCount > 0 ? `, ${infantsCount} Inf` : ''})</span>
                                        </div>
                                        <span className="text-[10px] text-emerald-700 font-mono">
                                          {currentRoomsCount} {currentRoomsCount > 1 ? 'Rooms' : 'Room'} (Max {occupancy.maxAllowedTotalPax} Pax)
                                        </span>
                                      </div>

                                      {/* Final Selling Price Calculation Box */}
                                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                                          <span>Nightly Rate:</span>
                                          <span className="font-mono text-slate-700">{formatCurrency(nightlyInQuoteCurrency, currency)} / night</span>
                                        </div>
                                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                                          <span>Stay Calculation:</span>
                                          <span className="font-mono text-slate-700">{currentNights} Nights × {currentRoomsCount} {currentRoomsCount > 1 ? 'Rooms' : 'Room'}</span>
                                        </div>
                                        <div className="pt-1.5 border-t border-slate-200 flex items-center justify-between">
                                          <span className="text-xs font-bold text-slate-900">Final Selling Price:</span>
                                          <span className="text-sm font-extrabold font-mono text-emerald-600">
                                            {formatCurrency(finalSellingStayPrice, currency)}
                                          </span>
                                        </div>
                                        <p className="text-[10px] text-emerald-700 font-medium">
                                          ✓ Clean final selling price • No additional taxes or fees
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <p className="text-[10px] text-slate-400 italic">
                                    Leave unassigned if accommodation is booked separately by client.
                                  </p>
                                  {canAddManualHotel && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenAddManualHotel(hub.id)}
                                      className="w-full py-2 px-3 rounded-xl border border-dashed border-amber-300 hover:border-amber-400 bg-amber-50/40 hover:bg-amber-50 text-amber-900 text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-2xs"
                                    >
                                      <Plus className="w-3.5 h-3.5 text-amber-600" />
                                      <span>+ Add Manual Hotel / Custom Rate</span>
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* --------------------------------------------------------------------- */}
          {/* SECTION 4: DAY-WISE ITINERARY CANVAS (THE CORE WORKSPACE) */}
          {/* --------------------------------------------------------------------- */}
          <section className="space-y-4">
            {/* Filter Tabs by Hub */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-bold text-slate-500 mr-2">Filter Days:</span>
                <button
                  type="button"
                  onClick={() => setSelectedHubFilter('ALL')}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    selectedHubFilter === 'ALL'
                      ? 'bg-[#00C6A6] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  All Days ({daySlots.length})
                </button>
                {routeHubs.map(h => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => setSelectedHubFilter(h.hubName)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      selectedHubFilter === h.hubName
                        ? 'bg-[#00C6A6] text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {h.hubName}
                  </button>
                ))}
              </div>

              <div className="text-xs text-slate-500 font-mono">
                {experienceItems.length} Experiences • {hotelItems.length} Hotels
              </div>
            </div>

            {/* Timeline of Days */}
            <div className="space-y-5">
              {daySlots
                .filter(slot => selectedHubFilter === 'ALL' || slot.hub?.hubName === selectedHubFilter)
                .map((slot) => (
                  <div
                    key={slot.dateString}
                    className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs hover:border-slate-300 transition-colors"
                  >
                    {/* Day Header */}
                    <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-50 to-slate-100/60 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 text-[#00A88F] flex flex-col items-center justify-center font-bold">
                          <span className="text-[9px] uppercase tracking-wider text-slate-500 font-mono">Day</span>
                          <span className="text-sm font-black leading-none">{slot.dayNumber}</span>
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="text-sm sm:text-base font-bold text-slate-900">
                              {slot.dayOfWeek}, {slot.formattedDate}
                            </h3>
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white text-teal-800 border border-slate-200 shadow-2xs">
                              📍 {slot.hub?.hubName || currentDestination.name}
                            </span>
                            {slot.isTransitionDay && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                🚅 Transit from {slot.prevHub?.hubName}
                              </span>
                            )}
                          </div>
                          {/* Editable Day Theme */}
                          <input
                            type="text"
                            placeholder="Add day theme (e.g. Arrival in Tokyo, Imperial Palace & Shinjuku Night Tour)..."
                            value={dayThemes[slot.dayNumber] || ''}
                            onChange={(e) => setDayThemes(prev => ({ ...prev, [slot.dayNumber]: e.target.value }))}
                            className="text-xs text-slate-800 placeholder:text-slate-400 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-[#00C6A6] outline-none w-full max-w-md py-0.5 mt-0.5"
                          />
                        </div>
                      </div>

                      {/* Header Actions */}
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-slate-900 font-mono bg-white px-2.5 py-1 rounded-xl border border-slate-200 shadow-2xs">
                          {formatCurrency(slot.daySellingPrice, currency)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleOpenQuickAddModal(slot)}
                          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#00C6A6] hover:bg-[#00A88F] text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Product</span>
                        </button>
                      </div>
                    </div>

                    {/* Day Body Content */}
                    <div className="p-4 sm:p-6 space-y-4">
                      {/* Night Accommodation Badge for this Day */}
                      {quotationScope !== 'LAND_ONLY' && (
                        <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200 flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center">
                              <BedDouble className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                Night {slot.dayNumber} Stay • {slot.hub?.hubName}
                              </span>
                              {slot.hotelItems.length > 0 ? (
                                <span className="text-xs font-bold text-slate-900">
                                  {slot.hotelItems[0].product.name}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400 italic">
                                  No hotel specified for this night (Self-arranged or covered by multi-night stay)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Scheduled Day Experiences & Products */}
                      {slot.productItems.length === 0 ? (
                        <div className="bg-slate-50/60 rounded-2xl p-6 border border-dashed border-slate-300 text-center space-y-2">
                          <Compass className="w-6 h-6 text-slate-400 mx-auto" />
                          <p className="text-xs text-slate-500 font-medium">
                            No activities or transfers added for Day {slot.dayNumber} ({slot.hub?.hubName || currentDestination.name}) yet.
                          </p>
                          <button
                            type="button"
                            onClick={() => handleOpenQuickAddModal(slot)}
                            className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-300 transition-colors inline-flex items-center space-x-1.5 cursor-pointer shadow-2xs"
                          >
                            <Plus className="w-3.5 h-3.5 text-[#00A88F]" />
                            <span>Browse Experiences for {slot.hub?.hubName || 'this day'}</span>
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {slot.productItems.map((item) => (
                            <div
                              key={item.id}
                              className="bg-slate-50 rounded-2xl p-3.5 sm:p-4 border border-slate-200 hover:border-slate-300 hover:bg-white transition-all flex flex-wrap items-center justify-between gap-3 shadow-xs"
                            >
                              <div className="flex items-center space-x-3 min-w-0 flex-1">
                                <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 text-[#00A88F] flex items-center justify-center shrink-0">
                                  {item.product.category === 'Transfer' || item.product.category === 'Transport' ? (
                                    <Car className="w-4 h-4" />
                                  ) : (
                                    <Compass className="w-4 h-4" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center space-x-2">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                                      {item.serviceTime || '09:30 AM'}
                                    </span>
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white text-slate-600 border border-slate-200">
                                      {item.product.category}
                                    </span>
                                    {item.product.city && (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                        📍 {item.product.city}
                                      </span>
                                    )}
                                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                                      {item.product.name}
                                    </h4>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 mt-1">
                                    <span>Duration: {item.product.duration || 'Half Day'}</span>
                                    <span>Pax: {item.pax.adults} Adults{item.pax.children > 0 ? `, ${item.pax.children} Ch` : ''}</span>
                                    {item.notes && (
                                      <span className="text-amber-700 font-mono">Note: {item.notes}</span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Price & Actions */}
                              <div className="flex items-center space-x-2 shrink-0">
                                <span className="text-xs sm:text-sm font-bold text-slate-900 font-mono mr-1">
                                  {formatCurrency(item.calculation?.finalTotalSellingPrice || 0, currency)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleOpenProductDetails(item.product)}
                                  className="p-1.5 rounded-lg bg-white hover:bg-teal-50 text-slate-600 hover:text-teal-700 border border-slate-200 transition-colors cursor-pointer"
                                  title="View Product Details"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditItem(item)}
                                  className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 transition-colors cursor-pointer"
                                  title="Edit Service Time / Pax / Notes"
                                >
                                  <Sliders className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeProductFromQuote(item.id)}
                                  className="p-1.5 rounded-lg bg-white hover:bg-red-50 text-slate-400 hover:text-red-600 border border-slate-200 transition-colors cursor-pointer"
                                  title="Remove Service"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Recommended Highlights for this Day / Hub */}
                      {availableProducts.length > 0 && (
                        <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center space-x-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-[#00A88F]" />
                              <span>Recommended for {slot.hub?.hubName || currentDestination.name}</span>
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">City-Matched Experiences</span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                            {availableProducts
                              .filter(p => {
                                const matchDest = p.destinationId === currentDestination.id || 
                                  p.country?.toLowerCase() === currentDestination.name.toLowerCase();
                                if (!matchDest) return false;
                                const dayCity = slot.hub?.hubName || currentDestination.name;
                                const matchCity = isProductMatchingCity(p, dayCity, slot.hub?.hubId || slot.hub?.id);
                                if (!matchCity) return false;
                                const alreadyAdded = slot.productItems.some(it => it.product.id === p.id);
                                if (alreadyAdded) return false;
                                return true;
                              })
                              .slice(0, 3)
                              .map(recProd => (
                                <div
                                  key={recProd.id}
                                  className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between gap-2 text-xs"
                                >
                                  <div className="min-w-0">
                                    <span className="font-bold text-slate-900 block truncate">{recProd.name}</span>
                                    <span className="text-[10px] text-slate-500">{recProd.city || slot.hub?.hubName} • {recProd.category}</span>
                                  </div>
                                  <div className="flex items-center space-x-1.5 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenProductDetails(recProd)}
                                      className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-bold transition-colors cursor-pointer"
                                      title="View Details"
                                    >
                                      <Eye className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        addProductToQuote(recProd, {
                                          adults: adultsCount,
                                          children: childrenCount,
                                          infants: infantsCount,
                                          travelDate: slot.dateString
                                        });
                                      }}
                                      className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-[#00C6A6] text-teal-800 hover:text-white border border-teal-200 font-bold text-[11px] transition-colors cursor-pointer"
                                    >
                                      + Add
                                    </button>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </section>

          {/* --------------------------------------------------------------------- */}
          {/* SECTION 5: PERSISTENT LIVE PRICING & COMMERCIAL SUMMARY */}
          {/* --------------------------------------------------------------------- */}
          <section className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 text-[#00A88F] flex items-center justify-center">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Live Commercial Pricing Engine</h3>
                  <p className="text-xs text-slate-500">
                    Real-time contract tariff calculation, custom agent margin, and confidential nett costs.
                  </p>
                </div>
              </div>

              {/* Agent Margin Slider & Input */}
              <div className="flex items-center space-x-3 bg-slate-50 p-2 rounded-2xl border border-slate-200">
                <span className="text-xs font-bold text-slate-700 flex items-center space-x-1">
                  <Percent className="w-3.5 h-3.5 text-teal-600" />
                  <span>Agent Markup:</span>
                </span>
                <input
                  type="range"
                  min="0"
                  max="40"
                  step="1"
                  value={agentMarkupPercent}
                  onChange={(e) => setAgentMarkupPercent(Number(e.target.value))}
                  className="w-24 accent-[#00C6A6] cursor-pointer"
                />
                <span className="text-xs font-mono font-bold text-teal-800 w-10 text-right">
                  {agentMarkupPercent}%
                </span>
              </div>
            </div>

            {/* Pricing Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">Accommodations</span>
                <span className="text-sm font-bold text-slate-900 font-mono mt-1 block">
                  {formatCurrency(hotelTotalSelling, currency)}
                </span>
                <span className="text-[10px] text-slate-500">{hotelItems.length} properties</span>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">Land Experiences</span>
                <span className="text-sm font-bold text-slate-900 font-mono mt-1 block">
                  {formatCurrency(experienceTotalSelling, currency)}
                </span>
                <span className="text-[10px] text-slate-500">{experienceItems.length} activities</span>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">Wholesale Nett</span>
                <span className="text-sm font-bold text-slate-700 font-mono mt-1 block">
                  {formatCurrency(totalNetCost, currency)}
                </span>
                <span className="text-[10px] text-amber-700 flex items-center space-x-1">
                  <Lock className="w-2.5 h-2.5" />
                  <span>Confidential</span>
                </span>
              </div>

              <div className="bg-teal-50/80 p-3.5 rounded-2xl border border-teal-200">
                <span className="text-[11px] text-teal-800 font-bold uppercase tracking-wider block">Final Client Price</span>
                <span className="text-lg font-black text-teal-950 font-mono mt-0.5 block">
                  {formatCurrency(finalClientPrice, currency)}
                </span>
                <span className="text-[10px] text-teal-700">
                  {tripNights} Nights • {adultsCount + childrenCount} Pax
                </span>
              </div>
            </div>
          </section>
        </main>
      )}

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
                          addProductToQuote(prod, {
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
    </div>
  );
};
