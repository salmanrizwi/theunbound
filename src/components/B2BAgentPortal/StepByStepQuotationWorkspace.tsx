import React, { useMemo, useState } from 'react';
import { 
  Building2, 
  Car, 
  Compass, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  Circle, 
  Clock, 
  ArrowRight, 
  ArrowLeft, 
  Calendar, 
  Users, 
  MapPin, 
  Sparkles, 
  Plus, 
  Trash2, 
  Edit3, 
  Copy, 
  ChevronUp, 
  ChevronDown, 
  Layers, 
  DollarSign, 
  FileText, 
  Mail, 
  Download, 
  BookmarkCheck, 
  Globe, 
  Wifi, 
  Luggage, 
  Search, 
  Filter, 
  Check, 
  RefreshCw,
  Zap,
  Info,
  Sliders,
  BedDouble,
  Plane,
  FileCheck,
  Eye,
  MessageCircle,
  Lock,
  Save,
  Percent,
  Train,
  Shield,
  Smartphone,
  X
} from 'lucide-react';
import { isRailQuoteItem } from '../../services/rail/JapanRailJourneyDataService';
import { getInventoryDisplayName, getInventoryConfigurationSummary } from '../../utils/inventoryDisplayHelpers';
import { 
  QuoteItem, 
  QuotationOption, 
  Product, 
  Hotel, 
  Destination, 
  CityHub, 
  TripRouteHub, 
  CurrencyCode, 
  SUPPORTED_CURRENCIES,
  ManualHotelDetails,
  PassengerClassification,
  CRMLead,
  QuotationScope,
  VisaProduct,
  FeasibilityCheckResult,
  AgentMarginType
} from '../../types';
import { formatCurrency, convertCurrency, resolveCapacityPricingTier } from '../../services/pricingEngine';
import { TransferSuggestion, B2B_INSURANCE_PLANS, B2B_ESIM_PLANS } from '../../utils/b2bQuotationHelpers';
import { validateRoomOccupancy, hotelToProduct, manualHotelToProduct } from '../../utils/hotelHelpers';
import { VisaServicesAndFacilitationSection } from './VisaServicesAndFacilitationSection';
import { DestinationRelevanceService, matchesDestination } from '../../services/destinationRelevanceService';
import { AppDatabase } from '../../services/db';
import { TransferConfigurator } from '../Configurators/TransferConfigurator';
import { RichTextRenderer } from '../common/RichTextRenderer';

// Helper to check if a product matches a target city/hub
export const isProductMatchingCity = (product: Product, targetCityName?: string, targetHubId?: string): boolean => {
  if (!targetCityName && !targetHubId) return true;
  const prodCity = (product.city || (product as any).cityName || '').toLowerCase();
  const prodDesc = (product.shortDescription || product.longDescription || product.name || '').toLowerCase();
  const target = (targetCityName || '').toLowerCase();
  
  if (prodCity && target && (prodCity.includes(target) || target.includes(prodCity))) return true;
  if (prodDesc && target && prodDesc.includes(target)) return true;
  return false;
};

export interface StepByStepQuotationWorkspaceProps {
  // Current Active Step (1 to 9)
  activeStepId: number;
  setActiveStepId: (step: number) => void;

  // Master Data & Context
  currentDestination: Destination;
  destinations: Destination[];
  onSelectDestination: (dest: Destination) => void;
  destinationHubs: CityHub[];
  availableHotels: Hotel[];
  products: Product[];
  crmLeads: CRMLead[];
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;

  // Lead & Client Details
  selectedLeadId: string;
  onSelectLead: (leadId: string) => void;
  clientName: string;
  setClientName: (name: string) => void;
  clientEmail: string;
  setClientEmail: (email: string) => void;
  clientCompany: string;
  setClientCompany: (comp: string) => void;
  clientPhone: string;
  setClientPhone: (phone: string) => void;
  agentNotes: string;
  setAgentNotes: (notes: string) => void;
  tripType: string;
  setTripType: (t: string) => void;
  quotationScope: QuotationScope;
  setQuotationScope: (s: QuotationScope) => void;

  // Dates & Passenger Specs
  startDate: string;
  setStartDate: (d: string) => void;
  endDate: string;
  setEndDate: (d: string) => void;
  tripNights: number;
  adultsCount: number;
  setAdultsCount: (n: number) => void;
  childrenCount: number;
  onSetChildrenCount: (n: number) => void;
  infantsCount: number;
  setInfantsCount: (n: number) => void;
  childAges: number[];
  onUpdateChildAge: (index: number, age: number) => void;
  passengerClassification: PassengerClassification;
  nationality: string;
  setNationality: (nat: string) => void;
  travelStyle: string;
  setTravelStyle: (s: string) => void;
  mealPlanPreference: string;
  setMealPlanPreference: (m: string) => void;
  roomingConfig: { roomsCount: number; extraBedRequired: boolean };
  setRoomingConfig: React.Dispatch<React.SetStateAction<{ roomsCount: number; extraBedRequired: boolean }>>;
  visaAssistanceChoice: 'YES' | 'NO' | 'NOT_REQUIRED' | 'LATER';
  setVisaAssistanceChoice: (c: 'YES' | 'NO' | 'NOT_REQUIRED' | 'LATER') => void;

  // Route Hubs
  routeHubs: TripRouteHub[];
  setRouteHubs: React.Dispatch<React.SetStateAction<TripRouteHub[]>>;
  routeTotalNights: number;
  getHubDates: (order: number, nights: number) => { checkInFormatted: string; checkOutFormatted: string };
  calendarDays: Array<{ dayNumber: number; dateString: string; dayOfWeek: string; formattedDate: string }>;

  // Quote Items & Calculations
  items: QuoteItem[];
  addProductToQuote: (product: Product, options?: any) => void;
  removeProductFromQuote: (itemId: string) => void;
  updateItemPax: (itemId: string, adults: number, children: number, infants: number) => void;
  updateItemTravelDate: (itemId: string, travelDate: string) => void;
  updateItemServiceTime: (itemId: string, time: string) => void;
  updateItemNotes: (itemId: string, notes: string) => void;

  // Hotel Actions
  onSelectHotelForHub?: (hubOrder: number, hotel: Hotel, roomTypeId?: string, roomsCount?: number) => void;
  onRemoveHotelForHub?: (hubId: string) => void;
  onOpenEditManualHotel?: (hubId: string) => void;
  onRemoveManualHotel?: (hubId: string) => void;

  // Item & Day Customization
  onOpenEditItem?: (item: QuoteItem) => void;
  dayThemes?: Record<number, string>;
  setDayThemes?: React.Dispatch<React.SetStateAction<Record<number, string>>>;

  // Pricing & Margins
  baseFinalSellingPrice?: number;
  agentMarginType?: AgentMarginType;
  setAgentMarginType?: (type: AgentMarginType) => void;
  agentMarginValue?: number;
  setAgentMarginValue?: (val: number) => void;
  agentMarginAmount?: number;
  finalCustomerSellingPrice?: number;
  agentMarkupPercent: number;
  setAgentMarkupPercent: (m: number) => void;
  overallDiscountPercent: number;
  setOverallDiscountPercent: (d: number) => void;
  totalNetCost: number;
  totalSellingPrice: number;
  finalClientPrice: number;
  totalMarginAmount: number;

  // Multi-Option State
  quotationOptions: QuotationOption[];
  activeOptionTab: number;
  onSelectOptionTab: (optNum: number) => void;

  // Transfer Recommendations (Optional / Legacy Compatibility)
  transferSuggestions?: TransferSuggestion[];
  onAddSuggestedTransfer?: (s: TransferSuggestion) => void;

  // Feasibility
  feasibility: FeasibilityCheckResult;

  // Modals & Action Triggers
  onOpenManualHotelModal: (hubId?: string) => void;
  onOpenVisaPickerModal: () => void;
  onOpenAddonModal: (category?: 'ALL' | 'INSURANCE' | 'ESIM' | 'SERVICES') => void;
  onOpenQuickAddProductModal: (slot: { dayNumber: number; dateString: string; hub?: TripRouteHub | null }) => void;
  onOpenProductDetails: (prod: Product) => void;
  onOpenCalculator?: (prod: Product) => void;
  onSaveDraft: () => void;
  onPreviewQuotation: () => void;
  onDownloadPDF: () => void;
  onShareWhatsApp?: () => void;
  onOpenEmailModal: () => void;
  onConvertBooking: () => void;
  onOpenSavePackageModal?: () => void;
  canSaveAsPackage?: boolean;
  canAddManualHotel?: boolean;
  autoSaveStatus: 'SAVED' | 'SAVING' | 'IDLE';
  lastSavedTimestamp: string;
}

export const StepByStepQuotationWorkspace: React.FC<StepByStepQuotationWorkspaceProps> = ({
  activeStepId,
  setActiveStepId,
  currentDestination,
  destinations,
  onSelectDestination,
  destinationHubs,
  availableHotels,
  products,
  crmLeads,
  currency,
  setCurrency,
  selectedLeadId,
  onSelectLead,
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
  tripType,
  setTripType,
  quotationScope,
  setQuotationScope,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  tripNights,
  adultsCount,
  setAdultsCount,
  childrenCount,
  onSetChildrenCount,
  infantsCount,
  setInfantsCount,
  childAges,
  onUpdateChildAge,
  passengerClassification,
  nationality,
  setNationality,
  travelStyle,
  setTravelStyle,
  mealPlanPreference,
  setMealPlanPreference,
  roomingConfig,
  setRoomingConfig,
  visaAssistanceChoice,
  setVisaAssistanceChoice,
  routeHubs,
  setRouteHubs,
  routeTotalNights,
  getHubDates,
  calendarDays,
  items,
  addProductToQuote,
  removeProductFromQuote,
  updateItemPax,
  updateItemTravelDate,
  updateItemServiceTime,
  updateItemNotes,
  onSelectHotelForHub,
  onRemoveHotelForHub,
  onOpenEditManualHotel,
  onRemoveManualHotel,
  onOpenEditItem,
  dayThemes = {},
  setDayThemes,
  baseFinalSellingPrice,
  agentMarginType: propAgentMarginType,
  setAgentMarginType: propSetAgentMarginType,
  agentMarginValue: propAgentMarginValue,
  setAgentMarginValue: propSetAgentMarginValue,
  agentMarginAmount: propAgentMarginAmount,
  finalCustomerSellingPrice: propFinalCustomerSellingPrice,
  agentMarkupPercent,
  setAgentMarkupPercent,
  overallDiscountPercent,
  setOverallDiscountPercent,
  totalNetCost,
  totalSellingPrice,
  finalClientPrice,
  totalMarginAmount,
  quotationOptions,
  activeOptionTab,
  onSelectOptionTab,
  transferSuggestions,
  onAddSuggestedTransfer,
  feasibility,
  onOpenManualHotelModal,
  onOpenVisaPickerModal,
  onOpenAddonModal,
  onOpenQuickAddProductModal,
  onOpenProductDetails,
  onOpenCalculator,
  onSaveDraft,
  onPreviewQuotation,
  onDownloadPDF,
  onShareWhatsApp,
  onOpenEmailModal,
  onConvertBooking,
  onOpenSavePackageModal,
  canSaveAsPackage,
  canAddManualHotel,
  autoSaveStatus,
  lastSavedTimestamp
}) => {
  // Local fallback margin state if not provided externally
  const [internalMarginType, setInternalMarginType] = useState<AgentMarginType>(propAgentMarginType || 'PERCENTAGE');
  const [internalMarginValue, setInternalMarginValue] = useState<number>(
    propAgentMarginValue !== undefined ? propAgentMarginValue : (agentMarkupPercent || 10)
  );

  const effectiveMarginType = propAgentMarginType || internalMarginType;
  const effectiveMarginValue = propAgentMarginValue !== undefined ? propAgentMarginValue : internalMarginValue;

  const handleUpdateMarginType = (newType: AgentMarginType) => {
    setInternalMarginType(newType);
    if (propSetAgentMarginType) {
      propSetAgentMarginType(newType);
    }
  };

  const handleUpdateMarginValue = (val: number) => {
    setInternalMarginValue(val);
    if (propSetAgentMarginValue) {
      propSetAgentMarginValue(val);
    }
    if (effectiveMarginType === 'PERCENTAGE') {
      setAgentMarkupPercent(val);
    }
  };

  const effectiveBasePrice = baseFinalSellingPrice !== undefined ? baseFinalSellingPrice : totalSellingPrice;
  const effectiveMarginAmount = propAgentMarginAmount !== undefined
    ? propAgentMarginAmount
    : effectiveMarginType === 'PERCENTAGE'
      ? Math.round(effectiveBasePrice * ((effectiveMarginValue || 0) / 100))
      : Math.round(effectiveMarginValue || 0);

  const effectiveFinalPrice = propFinalCustomerSellingPrice !== undefined
    ? propFinalCustomerSellingPrice
    : (effectiveBasePrice + effectiveMarginAmount);

  // Filter items by category
  const hotelItems = useMemo(() => items.filter(it => 
    (it.product.category || '').toLowerCase().includes('hotel') ||
    (it.product.category || '').toLowerCase().includes('accommodation') ||
    it.isManualHotel ||
    (it as any).hotelDetails !== undefined
  ), [items]);

  const transferItems = useMemo(() => items.filter(it => 
    Boolean((it.product as any).isTransfer) ||
    (it.product.category || '').toLowerCase().includes('transfer') ||
    (it.product.productType || '').toLowerCase().includes('transfer') ||
    (it.product.subcategory || '').toLowerCase().includes('transfer') ||
    (it.product.subcategory || '').toLowerCase().includes('chauffeur') ||
    (it.product.category || '').toLowerCase().includes('transport')
  ), [items]);

  // Master Transfer Products fetched dynamically from Product -> Category -> Transfers
  const allMasterTransferProducts = useMemo(() => {
    const directList = (products || []).filter(p => {
      const cat = (p.category || '').toLowerCase();
      const sub = (p.subcategory || '').toLowerCase();
      const type = (p.productType || '').toLowerCase();
      return (
        cat === 'transfers' ||
        cat === 'transfer' ||
        cat.includes('transfer') ||
        sub.includes('transfer') ||
        sub.includes('chauffeur') ||
        type.includes('transfer') ||
        Boolean((p as any).isTransfer)
      );
    });
    if (directList.length > 0) return directList;
    
    try {
      const db = AppDatabase.getInstance();
      return db.getProducts().filter(p => 
        (p.status === 'ACTIVE' || !p.status) &&
        matchesDestination(currentDestination?.id, p.destinationId, p.destinationName, p.country) &&
        ((p.category || '').toLowerCase().includes('transfer') || Boolean((p as any).isTransfer))
      );
    } catch {
      return [];
    }
  }, [products, currentDestination]);

  const isJapan = useMemo(() => {
    return matchesDestination(currentDestination?.id, 'dest-japan', 'Japan', 'Japan') ||
      (currentDestination?.name || '').toLowerCase().includes('japan') ||
      (currentDestination?.country || '').toLowerCase().includes('japan') ||
      (currentDestination?.slug || '').toLowerCase().includes('japan');
  }, [currentDestination]);

  const japanRailMasterProducts = useMemo(() => {
    const relevanceService = DestinationRelevanceService.getInstance();
    const railList = relevanceService.getRelevantRailProducts(currentDestination?.id || currentDestination?.name);
    if (railList.length > 0) return railList;
    try {
      const db = AppDatabase.getInstance();
      return db.getProducts().filter(p => 
        (p.status === 'ACTIVE' || !p.status) &&
        (p.id === 'RAIL-JP-ORD-RESERVED' || p.id === 'RAIL-JP-GREEN-RESERVED' || (p.category || '').toLowerCase() === 'rail')
      );
    } catch {
      return (products || []).filter(p => p.id === 'RAIL-JP-ORD-RESERVED' || p.id === 'RAIL-JP-GREEN-RESERVED');
    }
  }, [products, currentDestination]);

  const railItems = useMemo(() => items.filter(it => 
    isRailQuoteItem(it) || 
    (it.product?.category || '').toLowerCase() === 'rail' || 
    it.railJourneyDetails ||
    it.product?.id === 'RAIL-JP-ORD-RESERVED' ||
    it.product?.id === 'RAIL-JP-GREEN-RESERVED'
  ), [items]);

  const totalRailSellingPrice = useMemo(() => {
    return railItems.reduce((sum, it) => sum + (it.calculation?.finalTotalSellingPrice || 0), 0);
  }, [railItems]);

  // Hub Matching Algorithm for movements
  const getMatchingTransfersForMovement = (
    movement: { type: string; fromHubId?: string; toHubId?: string; fromHub?: TripRouteHub; toHub?: TripRouteHub; hub?: TripRouteHub },
    allTransfers: Product[]
  ): Product[] => {
    return allTransfers.filter(p => {
      const pName = (p.name || '').toLowerCase();
      const pCity = (p.city || '').toLowerCase();
      const pFrom = (p.fromHubName || '').toLowerCase();
      const pTo = (p.toHubName || '').toLowerCase();
      const pSub = (p.subcategory || '').toLowerCase();
      const pType = (p.productType || '').toLowerCase();
      const pRouteType = ((p as any).routeType || '').toUpperCase();

      if (movement.type === 'ARRIVAL') {
        const hubId = movement.hub?.hubId || movement.toHubId;
        const hubName = (movement.hub?.hubName || '').toLowerCase();
        
        const idMatch = (p.hubId && p.hubId === hubId) || (p.toHubId && p.toHubId === hubId) || (p.fromHubId && p.fromHubId === hubId);
        const nameMatch = hubName && (
          pName.includes(hubName) || pCity.includes(hubName) || pFrom.includes(hubName) || pTo.includes(hubName)
        );

        const isIntercityOther = (pSub.includes('intercity') || pType.includes('intercity') || pRouteType === 'INTERCITY') &&
          p.fromHubId && p.toHubId && p.fromHubId !== p.toHubId;

        const isArrivalRelated = 
          pRouteType === 'AIRPORT_ARRIVAL' ||
          pSub.includes('airport') ||
          pType.includes('airport') ||
          pName.includes('airport') ||
          pName.includes('arrival') ||
          !isIntercityOther;

        return (idMatch || nameMatch) && isArrivalRelated && !isIntercityOther;
      }

      if (movement.type === 'INTERCITY') {
        const fromId = movement.fromHub?.hubId || movement.fromHubId;
        const toId = movement.toHub?.hubId || movement.toHubId;
        const fromName = (movement.fromHub?.hubName || '').toLowerCase();
        const toName = (movement.toHub?.hubName || '').toLowerCase();

        const idMatch = (
          (p.fromHubId && p.toHubId && p.fromHubId === fromId && p.toHubId === toId) ||
          (p.hubId && p.toHubId && p.hubId === fromId && p.toHubId === toId)
        );

        const nameMatch = fromName && toName && (
          (pFrom.includes(fromName) || pCity.includes(fromName) || pName.includes(fromName)) &&
          (pTo.includes(toName) || pName.includes(toName))
        );

        return Boolean(idMatch || nameMatch);
      }

      if (movement.type === 'DEPARTURE') {
        const hubId = movement.hub?.hubId || movement.fromHubId;
        const hubName = (movement.hub?.hubName || '').toLowerCase();

        const idMatch = (p.hubId && p.hubId === hubId) || (p.fromHubId && p.fromHubId === hubId) || (p.toHubId && p.toHubId === hubId);
        const nameMatch = hubName && (
          pName.includes(hubName) || pCity.includes(hubName) || pFrom.includes(hubName) || pTo.includes(hubName)
        );

        const isIntercityOther = (pSub.includes('intercity') || pType.includes('intercity') || pRouteType === 'INTERCITY') &&
          p.fromHubId && p.toHubId && p.fromHubId !== p.toHubId;

        const isDepartureRelated = 
          pRouteType === 'AIRPORT_DEPARTURE' ||
          pSub.includes('airport') ||
          pType.includes('airport') ||
          pName.includes('departure') ||
          pName.includes('airport') ||
          pName.includes('kix') ||
          pName.includes('hnd') ||
          pName.includes('nrt') ||
          !isIntercityOther;

        return (idMatch || nameMatch) && isDepartureRelated && !isIntercityOther;
      }

      return false;
    });
  };

  // Itinerary Route Movements
  const transitMovements = useMemo(() => {
    const sorted = [...routeHubs].sort((a, b) => a.order - b.order);
    if (sorted.length === 0) return [];

    const list: Array<{
      id: string;
      type: 'ARRIVAL' | 'INTERCITY' | 'DEPARTURE';
      title: string;
      badge: string;
      fromName: string;
      toName: string;
      fromHubId?: string;
      toHubId?: string;
      fromHub?: TripRouteHub;
      toHub?: TripRouteHub;
      hub?: TripRouteHub;
      suggestedDay: number;
      suggestedDate: string;
      matchingProducts: Product[];
    }> = [];
    const totalDays = calendarDays.length || (tripNights + 1);

    // 1. Hub 1 Arrival
    const firstHub = sorted[0];
    const arrivalDate = firstHub.checkInDate || startDate || calendarDays[0]?.dateString || '';
    list.push({
      id: `mov-arr-${firstHub.id}`,
      type: 'ARRIVAL',
      title: `Day 1 Arrival: Gateway / Airport ➔ ${firstHub.hubName} Hotel`,
      badge: 'Airport Gateway Arrival',
      fromName: `${firstHub.hubName} International Gateway`,
      toName: `${firstHub.hubName} Hotel / Accommodation`,
      toHubId: firstHub.hubId || firstHub.id,
      hub: firstHub,
      suggestedDay: 1,
      suggestedDate: arrivalDate,
      matchingProducts: getMatchingTransfersForMovement({
        type: 'ARRIVAL',
        toHubId: firstHub.hubId || firstHub.id,
        hub: firstHub
      }, allMasterTransferProducts)
    });

    // 2. Inter-Hub Transit movements between consecutive hubs
    let runningDays = 1 + (firstHub.nights || 1);
    for (let i = 0; i < sorted.length - 1; i++) {
      const fromH = sorted[i];
      const toH = sorted[i + 1];
      const transDate = toH.checkInDate || fromH.checkOutDate || calendarDays[runningDays - 1]?.dateString || '';

      list.push({
        id: `mov-inter-${fromH.id}-${toH.id}`,
        type: 'INTERCITY',
        title: `Day ${runningDays} Inter-Hub: ${fromH.hubName} Hotel ➔ ${toH.hubName} Hotel`,
        badge: 'Inter-Hub Transit',
        fromName: `${fromH.hubName} Hotel`,
        toName: `${toH.hubName} Hotel`,
        fromHubId: fromH.hubId || fromH.id,
        toHubId: toH.hubId || toH.id,
        fromHub: fromH,
        toHub: toH,
        suggestedDay: runningDays,
        suggestedDate: transDate,
        matchingProducts: getMatchingTransfersForMovement({
          type: 'INTERCITY',
          fromHub: fromH,
          toHub: toH,
          fromHubId: fromH.hubId || fromH.id,
          toHubId: toH.hubId || toH.id
        }, allMasterTransferProducts)
      });

      runningDays += (toH.nights || 1);
    }

    // 3. Final Hub Departure
    const lastHub = sorted[sorted.length - 1];
    const departureDate = lastHub.checkOutDate || endDate || calendarDays[totalDays - 1]?.dateString || '';
    list.push({
      id: `mov-dep-${lastHub.id}`,
      type: 'DEPARTURE',
      title: `Day ${totalDays} Departure: ${lastHub.hubName} Hotel ➔ Gateway / Airport`,
      badge: 'Airport Gateway Departure',
      fromName: `${lastHub.hubName} Hotel`,
      toName: `${lastHub.hubName} International Gateway`,
      fromHubId: lastHub.hubId || lastHub.id,
      hub: lastHub,
      suggestedDay: totalDays,
      suggestedDate: departureDate,
      matchingProducts: getMatchingTransfersForMovement({
        type: 'DEPARTURE',
        fromHubId: lastHub.hubId || lastHub.id,
        hub: lastHub
      }, allMasterTransferProducts)
    });

    return list;
  }, [routeHubs, calendarDays, startDate, endDate, tripNights, allMasterTransferProducts]);

  // Route Conflict Detection: Incompatible transfers that no longer match the active route hubs
  const activeHubIds = useMemo(() => new Set(routeHubs.map(h => (h.hubId || h.id).toLowerCase())), [routeHubs]);
  const activeHubNames = useMemo(() => routeHubs.map(h => h.hubName.toLowerCase()), [routeHubs]);

  const invalidTransfers = useMemo(() => {
    if (routeHubs.length === 0) return transferItems;
    return transferItems.filter(item => {
      const p = item.product;
      const pHubId = (p.hubId || '').toLowerCase();
      const pFromId = (p.fromHubId || '').toLowerCase();
      const pToId = (p.toHubId || '').toLowerCase();

      const idMatches = 
        (pHubId && activeHubIds.has(pHubId)) ||
        (pFromId && activeHubIds.has(pFromId)) ||
        (pToId && activeHubIds.has(pToId));
      
      if (idMatches) return false;

      const pName = (p.name || '').toLowerCase();
      const pCity = (p.city || '').toLowerCase();
      const pFrom = (p.fromHubName || '').toLowerCase();
      const pTo = (p.toHubName || '').toLowerCase();
      const notes = (item.notes || '').toLowerCase();

      const nameMatches = activeHubNames.some(name => 
        pName.includes(name) || pCity.includes(name) || pFrom.includes(name) || pTo.includes(name) || notes.includes(name)
      );

      return !nameMatches;
    });
  }, [transferItems, routeHubs, activeHubIds, activeHubNames]);

  // Financial summary for ground transfers
  const totalTransfersSellingPrice = useMemo(() => {
    return transferItems.reduce((sum, it) => sum + (it.calculation?.finalTotalSellingPrice || 0), 0);
  }, [transferItems]);

  const totalTransfersNetCost = useMemo(() => {
    return transferItems.reduce((sum, it) => sum + (it.calculation?.totalNetCost || 0), 0);
  }, [transferItems]);

  // Combined Ground Logistics (All Transfer Fleet + Rail + Custom Transfers)
  const groundLogisticsItems = useMemo(() => {
    return [...transferItems, ...railItems];
  }, [transferItems, railItems]);

  const failedGroundItems = useMemo(() => {
    return groundLogisticsItems.filter(it => 
      !it.calculation || 
      it.calculation.finalTotalSellingPrice === undefined || 
      it.calculation.finalTotalSellingPrice === null || 
      (it.calculation as any).error ||
      (it as any).pricingError
    );
  }, [groundLogisticsItems]);

  const isGroundPricingFailed = failedGroundItems.length > 0;

  const isGroundPricingLoading = useMemo(() => {
    return groundLogisticsItems.some(it => 
      (it as any).isCalculating || 
      (it.calculation as any)?.isLoading || 
      (it.calculation as any)?.status === 'PENDING'
    );
  }, [groundLogisticsItems]);

  const totalGroundLogisticsPrice = useMemo(() => {
    if (isGroundPricingFailed) return null;
    return groundLogisticsItems.reduce((sum, it) => sum + (it.calculation?.finalTotalSellingPrice || 0), 0);
  }, [groundLogisticsItems, isGroundPricingFailed]);

  const totalGroundLogisticsNet = useMemo(() => {
    return groundLogisticsItems.reduce((sum, it) => sum + (it.calculation?.totalNetCost || 0), 0);
  }, [groundLogisticsItems]);

  const railTotal = useMemo(() => {
    return railItems.reduce((sum, it) => sum + (it.calculation?.finalTotalSellingPrice || 0), 0);
  }, [railItems]);

  const customTransferTotal = useMemo(() => {
    return transferItems
      .filter(it => it.product.id.includes('custom-transfer') || it.product.sku?.startsWith('TRF-CUST'))
      .reduce((sum, it) => sum + (it.calculation?.finalTotalSellingPrice || 0), 0);
  }, [transferItems]);

  const transferFleetTotal = useMemo(() => {
    return transferItems
      .filter(it => !it.product.id.includes('custom-transfer') && !it.product.sku?.startsWith('TRF-CUST'))
      .reduce((sum, it) => sum + (it.calculation?.finalTotalSellingPrice || 0), 0);
  }, [transferItems]);

  const getLegIndexForItem = (item: QuoteItem) => {
    const legId = (item as any).quoteLegId || (item as any).legId;
    if (legId) {
      return transitMovements.findIndex(m => m.id === legId);
    }
    return transitMovements.findIndex(m => {
      if (item.travelDate && m.suggestedDate && item.travelDate === m.suggestedDate) {
        if (m.fromHubId && (item.product.fromHubId === m.fromHubId || item.product.hubId === m.fromHubId)) return true;
        if (m.toHubId && (item.product.toHubId === m.toHubId || item.product.hubId === m.toHubId)) return true;
      }
      return false;
    });
  };

  // Step 4 UI State - Leg-Scoped Ground Movement Selection
  const [legOptionState, setLegOptionState] = useState<Record<string, 'NONE' | 'OPTIONS' | 'FLEET' | 'RAIL' | 'CUSTOM'>>({});
  const [step4FleetSearch, setStep4FleetSearch] = useState('');
  const [step4SelectedHubFilter, setStep4SelectedHubFilter] = useState<string>('ALL');

  // Day-Wise Ground Movement Management State (Step 4)
  const [expandedDayNumbers, setExpandedDayNumbers] = useState<Record<number, boolean>>({ 1: true });
  const [activeAddMovementDayNumber, setActiveAddMovementDayNumber] = useState<number | null>(null);

  const toggleExpandDay = (dayNum: number) => {
    setExpandedDayNumbers(prev => ({ ...prev, [dayNum]: prev[dayNum] === false }));
  };

  const handleOpenCustomTransferModalForDay = (slot: any) => {
    const dayNum = slot.dayNumber;
    const dateStr = slot.dateString || startDate;
    const fromCity = slot.prevHub?.hubName || slot.hub?.hubName || currentDestination.name;
    const toCity = slot.hub?.hubName || currentDestination.name;

    setCustomTransferMovement({
      suggestedDate: dateStr,
      suggestedDay: dayNum,
      fromName: fromCity,
      toName: toCity,
      hub: slot.hub
    });

    setCustomTransferForm({
      routeName: `${fromCity} ➔ ${toCity} Private Transfer`,
      fromLocation: `${fromCity} Pickup Point / Hotel`,
      toLocation: `${toCity} Drop-off Destination / Hotel`,
      travelDate: dateStr,
      serviceTime: '10:00 AM',
      vehicleType: 'Executive MPV / Van (Toyota Alphard)',
      maxPax: Math.max(4, adultsCount + childrenCount),
      maxLuggage: 5,
      netCost: 150,
      currency: currency as CurrencyCode,
      markupPercent: 15,
      specialNotes: `Day ${dayNum} ground transfer for ${adultsCount + childrenCount} Passengers.`
    });

    setIsCustomTransferModalOpen(true);
  };

  // Transfer Configurator Modal state
  const [isTransferConfiguratorOpen, setIsTransferConfiguratorOpen] = useState(false);
  const [selectedTransferProductForConfig, setSelectedTransferProductForConfig] = useState<Product | null>(null);
  const [configuratorMovement, setConfiguratorMovement] = useState<any>(null);
  const [editingTransferQuoteItemId, setEditingTransferQuoteItemId] = useState<string | undefined>(undefined);
  const [editingTransferQuoteItem, setEditingTransferQuoteItem] = useState<QuoteItem | null>(null);

  // Custom Transfer Service Modal state
  const [isCustomTransferModalOpen, setIsCustomTransferModalOpen] = useState(false);
  const [expandedItemDetails, setExpandedItemDetails] = useState<Record<string, boolean>>({});
  const [customTransferMovement, setCustomTransferMovement] = useState<any>(null);
  const [customTransferForm, setCustomTransferForm] = useState({
    routeName: '',
    fromLocation: '',
    toLocation: '',
    travelDate: '',
    serviceTime: '10:00 AM',
    vehicleType: 'Executive MPV / Van (Toyota Alphard)',
    maxPax: 6,
    maxLuggage: 5,
    netCost: 150,
    currency: currency as CurrencyCode,
    markupPercent: 15,
    specialNotes: ''
  });

  const handleOpenConfigureTransfer = (prod: Product, movement?: any) => {
    setEditingTransferQuoteItem(null);
    setEditingTransferQuoteItemId(undefined);
    setSelectedTransferProductForConfig(prod);
    setConfiguratorMovement(movement || null);
    setIsTransferConfiguratorOpen(true);
  };

  const handleOpenEditTransferConfig = (item: QuoteItem) => {
    setEditingTransferQuoteItem(item);
    setEditingTransferQuoteItemId(item.id);
    setSelectedTransferProductForConfig(item.product);
    setConfiguratorMovement(null);
    setIsTransferConfiguratorOpen(true);
  };

  const handleQuickAddTransfer = (product: Product, movement?: any) => {
    const totalPax = adultsCount + childrenCount;
    const tierRes = resolveCapacityPricingTier({ product, passengerCount: totalPax });
    const vehiclesNeeded = tierRes.vehiclesRequired;

    const fromText = movement?.fromName || product.fromHubName || 'Departure Hub';
    const toText = movement?.toName || product.toHubName || 'Arrival Hub';
    const travelDate = movement?.suggestedDate || startDate || new Date().toISOString().split('T')[0];

    const notes = `${fromText} ➔ ${toText} • ${vehiclesNeeded > 1 ? `${vehiclesNeeded} × Vehicles Allocated` : (tierRes.vehicleName || product.name)}`;

    addProductToQuote(product, {
      travelDate,
      adults: adultsCount,
      children: childrenCount,
      infants: infantsCount,
      notes,
      quoteLegId: movement?.id,
      legId: movement?.id,
      openDrawer: false
    });
  };

  const handleOpenCustomTransferModal = (movement?: any) => {
    setCustomTransferMovement(movement || null);
    setCustomTransferForm({
      routeName: movement ? `${movement.fromName} ➔ ${movement.toName}` : 'Custom Chauffeur Transfer',
      fromLocation: movement ? movement.fromName : '',
      toLocation: movement ? movement.toName : '',
      travelDate: movement ? movement.suggestedDate : startDate,
      serviceTime: '10:00 AM',
      vehicleType: 'Executive MPV / Van (Toyota Alphard)',
      maxPax: Math.max(4, adultsCount + childrenCount),
      maxLuggage: 5,
      netCost: 150,
      currency: currency,
      markupPercent: 15,
      specialNotes: ''
    });
    setIsCustomTransferModalOpen(true);
  };

  const handleSaveCustomTransfer = () => {
    if (!customTransferForm.routeName) return;
    const net = Number(customTransferForm.netCost) || 100;
    const markup = Number(customTransferForm.markupPercent) || 15;

    const customProduct: Product = {
      id: `prod-custom-transfer-${Date.now()}`,
      sku: `TRF-CUST-${Date.now().toString().slice(-4)}`,
      destinationId: currentDestination.id,
      destinationName: currentDestination.name,
      country: currentDestination.name,
      city: customTransferMovement?.hub?.hubName || currentDestination.name,
      hubId: customTransferMovement?.hub?.hubId || customTransferMovement?.hub?.id,
      fromHubName: customTransferForm.fromLocation,
      toHubName: customTransferForm.toLocation,
      productType: 'Private Chauffeur Transfer',
      isTransfer: true,
      name: customTransferForm.routeName,
      shortDescription: `Custom private transfer: ${customTransferForm.fromLocation} ➔ ${customTransferForm.toLocation} (${customTransferForm.vehicleType})`,
      longDescription: `Tailored ground logistics service. Vehicle: ${customTransferForm.vehicleType}. Max ${customTransferForm.maxPax} passengers and ${customTransferForm.maxLuggage} luggage cases. Notes: ${customTransferForm.specialNotes || 'Direct private chauffeur'}.`,
      supplierId: 'sup-custom-logistics',
      supplierName: `${currentDestination.name} Ground Logistics Network`,
      category: 'Transfers',
      subcategory: customTransferMovement?.badge || 'Private Chauffeur',
      duration: 'Scheduled Service',
      pricingMethod: 'capacity_based',
      adultNetPrice: net,
      childNetPrice: 0,
      infantNetPrice: 0,
      currency: customTransferForm.currency,
      defaultMarkupPercent: markup,
      b2bAgentMarkupPercent: markup,
      taxPercent: 0,
      commissionPercent: 0,
      serviceFeeFixed: 0,
      season: 'All Year',
      validityFrom: '2025-01-01',
      validityTo: '2026-12-31',
      minPax: 1,
      maxPax: customTransferForm.maxPax,
      availability: 'INSTANT',
      bookingRequiredDays: 1,
      cancellationPolicy: 'Free cancellation up to 24 hours prior.',
      vehicleConfig: {
        vehicleName: customTransferForm.vehicleType,
        vehicleModel: customTransferForm.vehicleType,
        vehicleType: customTransferForm.vehicleType,
        maxSeats: customTransferForm.maxPax,
        totalSeats: customTransferForm.maxPax,
        maxLuggage: customTransferForm.maxLuggage,
        unitVehicleNetCost: net,
        totalTransferCost: net,
        currency: customTransferForm.currency,
        route: `${customTransferForm.fromLocation} ➔ ${customTransferForm.toLocation}`,
        allowMultipleVehicles: true,
        autoAllocateVehicles: true,
        maxVehicles: 3,
        pricingMethod: 'capacity_based'
      },
      inclusions: [
        `Private Air-Conditioned ${customTransferForm.vehicleType}`,
        'Uniformed Professional Chauffeur',
        'Expressway Tolls, Fuel, and Luggage Porterage'
      ],
      exclusions: ['Gratuities and personal extras'],
      status: 'ACTIVE'
    } as unknown as Product;

    addProductToQuote(customProduct, {
      travelDate: customTransferForm.travelDate || customTransferMovement?.suggestedDate || startDate,
      serviceTime: customTransferForm.serviceTime,
      adults: adultsCount,
      children: childrenCount,
      infants: infantsCount,
      notes: `${customTransferForm.fromLocation} ➔ ${customTransferForm.toLocation} | Time: ${customTransferForm.serviceTime} | ${customTransferForm.specialNotes || 'Custom Transfer'}`,
      quoteLegId: customTransferMovement?.id,
      legId: customTransferMovement?.id,
      openDrawer: false
    });

    setIsCustomTransferModalOpen(false);
  };

  const visaItems = useMemo(() => items.filter(it => 
    Boolean((it.product as any).isVisa) ||
    it.service_type === 'VISA' ||
    it.category === 'Visa & Ancillary Services' ||
    (it.product.category || '').toLowerCase().includes('visa') ||
    it.product.sku?.startsWith('VSA-') ||
    it.product.sku?.startsWith('VISA-') ||
    it.product.productType === 'Visa Service' ||
    it.product.subcategory === 'Visa Facilitation' ||
    (it.product.name || '').toLowerCase().includes('visa')
  ), [items]);

  const addonItems = useMemo(() => items.filter(it => {
    const cat = (it.product.category || '').toLowerCase();
    const sub = (it.product.subcategory || '').toLowerCase();
    const pName = (it.product.name || '').toLowerCase();
    const isVisaRel = Boolean((it.product as any).isVisa) ||
      it.service_type === 'VISA' ||
      it.product.sku?.startsWith('VSA-') ||
      it.product.sku?.startsWith('VISA-') ||
      pName.includes('visa');
    if (isVisaRel) return false;

    return (
      Boolean((it as any).isOptionalService) ||
      Boolean((it.product as any).isOptionalService) ||
      it.product.id?.startsWith('addon-') ||
      it.service_type === 'TRAVEL_PROTECTION' ||
      it.service_type === 'CONNECTIVITY' ||
      it.service_type === 'VIP_GROUND' ||
      cat.includes('insurance') ||
      cat.includes('esim') ||
      cat.includes('service') ||
      cat.includes('addon') ||
      cat.includes('optional') ||
      sub.includes('insurance') ||
      sub.includes('esim') ||
      sub.includes('concierge') ||
      sub.includes('optional')
    );
  }), [items]);

  const activityItems = useMemo(() => {
    const excludedIds = new Set([
      ...hotelItems.map(i => i.id),
      ...transferItems.map(i => i.id),
      ...railItems.map(i => i.id),
      ...visaItems.map(i => i.id),
      ...addonItems.map(i => i.id)
    ]);
    return items.filter(it => !excludedIds.has(it.id));
  }, [items, hotelItems, transferItems, railItems, visaItems, addonItems]);

  const addonTotalSelling = useMemo(() => {
    return addonItems.reduce((sum, it) => sum + (it.calculation?.finalTotalSellingPrice || 0), 0);
  }, [addonItems]);

  const handleQuickAddOptionalInsurance = (plan: typeof B2B_INSURANCE_PLANS[0]) => {
    const totalDays = Math.max(1, tripNights + 1);
    const totalAdultCost = plan.costPerDayAdultUSD * totalDays * adultsCount;
    const totalChildCost = plan.costPerDayChildUSD * totalDays * childrenCount;
    const totalNetCost = totalAdultCost + totalChildCost;
    const totalAdultSelling = plan.sellingPricePerDayAdultUSD * totalDays * adultsCount;
    const totalChildSelling = plan.sellingPricePerDayChildUSD * totalDays * childrenCount;
    const totalSelling = totalAdultSelling + totalChildSelling;
    const markupPercent = Math.round(((totalSelling - totalNetCost) / Math.max(1, totalNetCost)) * 100);

    const product = {
      id: `addon-${plan.id}-${Date.now()}`,
      sku: `INS-${plan.id.toUpperCase()}`,
      destinationId: currentDestination.id || 'dest-global',
      destinationName: currentDestination.name || 'Worldwide',
      country: currentDestination.name || 'International',
      city: 'Global Protection Desk',
      productType: 'Travel Insurance',
      isOptionalService: true,
      name: `${plan.name} (${totalDays} Days)`,
      shortDescription: `${plan.coverageSummary} Total Coverage: $${plan.coverageAmountUSD.toLocaleString()} USD. Provider: ${plan.provider}.`,
      longDescription: `Full comprehensive travel insurance for ${adultsCount} Adults and ${childrenCount} Children covering ${totalDays} days of travel in ${currentDestination.name}. Includes: ${plan.medicalEmergencyCoverage}, ${plan.tripCancellationCoverage}, ${plan.baggageLossCoverage}.`,
      supplierId: 'sup-insurance-global',
      supplierName: plan.provider,
      category: 'Optional Services',
      subcategory: 'Travel Insurance',
      adultNetPrice: plan.costPerDayAdultUSD * totalDays,
      childNetPrice: plan.costPerDayChildUSD * totalDays,
      infantNetPrice: 0,
      currency: 'USD' as CurrencyCode,
      defaultMarkupPercent: markupPercent,
      taxPercent: 0,
      commissionPercent: 15,
      serviceFeeFixed: 0,
      season: 'All Year',
      validityFrom: '2026-01-01',
      validityTo: '2026-12-31',
      minPax: 1,
      maxPax: 50,
      availability: 'INSTANT',
      inclusions: [
        plan.medicalEmergencyCoverage,
        plan.tripCancellationCoverage,
        plan.baggageLossCoverage,
        '24/7 International Medical Assistance Helpline'
      ],
      exclusions: ['Pre-existing medical conditions unless declared'],
      status: 'ACTIVE'
    } as unknown as Product;

    addProductToQuote(product, {
      adults: adultsCount,
      children: childrenCount,
      infants: 0,
      travelDate: startDate,
      openDrawer: false
    });
  };

  const handleQuickAddOptionalEsim = (plan: typeof B2B_ESIM_PLANS[0]) => {
    const markupPercent = Math.round(((plan.sellingPriceUSD - plan.netCostUSD) / Math.max(1, plan.netCostUSD)) * 100);
    const product = {
      id: `addon-${plan.id}-${Date.now()}`,
      sku: `ESIM-${plan.id.toUpperCase()}`,
      destinationId: currentDestination.id,
      destinationName: currentDestination.name,
      country: currentDestination.name,
      city: 'Instant Digital eSIM Portal',
      productType: 'Digital Connectivity',
      isOptionalService: true,
      name: `${currentDestination.name} 5G eSIM (${plan.dataAllowance}, ${plan.validityDays} Days)`,
      shortDescription: `Instant high-speed 5G/4G connectivity for ${currentDestination.name}. QR-code email delivery.`,
      longDescription: `Digital eSIM data plan with ${plan.dataAllowance} valid for ${plan.validityDays} days.`,
      supplierId: 'sup-esim-global',
      supplierName: plan.carrier,
      category: 'Optional Services',
      subcategory: 'eSIM Connectivity',
      adultNetPrice: plan.netCostUSD,
      childNetPrice: 0,
      infantNetPrice: 0,
      currency: 'USD' as CurrencyCode,
      defaultMarkupPercent: markupPercent,
      taxPercent: 0,
      commissionPercent: 20,
      serviceFeeFixed: 0,
      season: 'All Year',
      validityFrom: '2026-01-01',
      validityTo: '2026-12-31',
      minPax: 1,
      maxPax: 20,
      availability: 'INSTANT',
      inclusions: [
        `${plan.dataAllowance} High-Speed 5G Data`,
        `${plan.validityDays} Days Continuous Validity`,
        'Instant QR Code Email Delivery',
        'Hotspot / Mobile Tethering Allowed'
      ],
      exclusions: ['Traditional voice calls / SMS (Data-only)'],
      status: 'ACTIVE'
    } as unknown as Product;

    addProductToQuote(product, {
      adults: Math.max(1, adultsCount),
      children: 0,
      infants: 0,
      travelDate: startDate,
      openDrawer: false
    });
  };

  const handleQuickAddOptionalVipService = (serviceType: 'VIP_MEET_GREET' | 'LUGGAGE_VAN' | 'PORTABLE_WIFI') => {
    const totalDays = Math.max(1, tripNights + 1);
    let name = '';
    let desc = '';
    let netCost = 45;
    let selling = 65;

    if (serviceType === 'VIP_MEET_GREET') {
      name = 'VIP Airport Tarmac / Aerobridge Fast-Track Meet & Greet';
      desc = 'Dedicated airport escort directly from aerobridge, fast-track immigration clearance, luggage assistance & escort to chauffeur vehicle.';
      netCost = 75;
      selling = 110;
    } else if (serviceType === 'LUGGAGE_VAN') {
      name = 'Dedicated Chauffeur Luggage Support Van';
      desc = 'Separate dedicated luggage support van for excess golf bags, family luggage, and VIP shopping boxes.';
      netCost = 90;
      selling = 135;
    } else {
      name = `Unlimited Pocket Wi-Fi Router (${totalDays} Days Airport Pickup & Drop)`;
      desc = 'Portable 5G Pocket Wi-Fi connecting up to 8 devices simultaneously with all-day battery life.';
      netCost = 6 * totalDays;
      selling = 10 * totalDays;
    }

    const product = {
      id: `addon-service-${serviceType.toLowerCase()}-${Date.now()}`,
      sku: `SVC-${serviceType}`,
      destinationId: currentDestination.id,
      destinationName: currentDestination.name,
      country: currentDestination.name,
      city: 'Airport VIP Ground Services',
      productType: 'VIP Concierge Service',
      isOptionalService: true,
      name,
      shortDescription: desc,
      longDescription: desc,
      supplierId: 'sup-ground-vip',
      supplierName: `${currentDestination.name} VIP Concierge Operations`,
      category: 'Optional Services',
      subcategory: 'Ground Concierge',
      adultNetPrice: netCost,
      childNetPrice: 0,
      infantNetPrice: 0,
      currency: 'USD' as CurrencyCode,
      defaultMarkupPercent: Math.round(((selling - netCost) / Math.max(1, netCost)) * 100),
      taxPercent: 0,
      commissionPercent: 10,
      serviceFeeFixed: 0,
      season: 'All Year',
      validityFrom: '2026-01-01',
      validityTo: '2026-12-31',
      minPax: 1,
      maxPax: 20,
      availability: 'INSTANT',
      inclusions: [desc, '24/7 Operations Duty Manager Coordination'],
      exclusions: ['Personal gratuities'],
      status: 'ACTIVE'
    } as unknown as Product;

    addProductToQuote(product, {
      adults: 1,
      children: 0,
      infants: 0,
      travelDate: startDate,
      openDrawer: false
    });
  };

  const [selectedHubFilter, setSelectedHubFilter] = useState<string>('ALL');

  // Compute rich day slots with dates, active hub, transition info, and scheduled items
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

      const isHotelQuoteItem = (it: QuoteItem): boolean => {
        return it.product.productType === 'Hotel' || 
               it.product.productType === 'Hotel & Resort' || 
               it.isManualHotel === true || 
               it.product.accommodationType === 'manual' ||
               (it.product as any).category === 'Hotels';
      };

      const isVisaQuoteItem = (it: QuoteItem): boolean => {
        return it.product.productType === 'Visa Service' || 
               it.product.subcategory === 'Visa Facilitation' || 
               it.product.sku?.startsWith('VSA-') ||
               (it.product.category === 'Travel Services' && it.product.name?.toLowerCase().includes('visa')) ||
               Boolean(it.product.name?.toLowerCase().includes('visa') && it.product.name?.toLowerCase().includes('entry'));
      };

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

  const hotelTotalSelling = useMemo(() => {
    return hotelItems.reduce((sum, it) => sum + (it.calculation?.finalTotalSellingPrice || 0), 0);
  }, [hotelItems]);

  const handleSelectHotel = (hubOrder: number, hotel: Hotel, roomTypeId?: string, roomsCount: number = 1) => {
    if (onSelectHotelForHub) {
      onSelectHotelForHub(hubOrder, hotel, roomTypeId, roomsCount);
      return;
    }
    const targetHub = routeHubs.find(h => h.order === hubOrder);
    if (!targetHub) return;
    const checkInIso = targetHub.checkInDate || startDate;
    const checkOutIso = targetHub.checkOutDate || endDate;
    const selectedRoom = hotel.roomTypes?.find(r => r.id === roomTypeId) || hotel.roomTypes?.[0];
    const selectedRate = selectedRoom?.rates?.[0];
    const nights = targetHub.nights || 1;
    const safeRooms = Math.max(1, roomsCount || 1);

    const existingHotelItems = items.filter(it => 
      (it.product.category || '').toLowerCase().includes('hotel') &&
      (it.notes?.includes(targetHub.hubName) || (targetHub.hotelId && it.product.id.includes(targetHub.hotelId)))
    );
    existingHotelItems.forEach(it => removeProductFromQuote(it.id));

    const occupancy = validateRoomOccupancy(selectedRoom, safeRooms, adultsCount, childrenCount, infantsCount);
    if (occupancy.isValid) {
      const hotelProduct = hotelToProduct(hotel, selectedRoom, selectedRate, nights, safeRooms);
      addProductToQuote(hotelProduct, {
        adults: adultsCount,
        children: childrenCount,
        infants: infantsCount,
        travelDate: checkInIso,
        notes: `${hotel.name} • ${selectedRoom?.roomName || 'Luxury Room'} • ${safeRooms} ${safeRooms > 1 ? 'Rooms' : 'Room'} • ${nights} Nights in ${targetHub.hubName} [Check-in: ${checkInIso}, Check-out: ${checkOutIso}]`,
        openDrawer: false
      });
    }

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

  const handleRemoveHotel = (hubId: string) => {
    if (onRemoveHotelForHub) {
      onRemoveHotelForHub(hubId);
      return;
    }
    const targetHub = routeHubs.find(h => h.id === hubId);
    if (!targetHub) return;
    const existingHotelItems = items.filter(it => 
      (it.product.category || '').toLowerCase().includes('hotel') &&
      (it.notes?.includes(targetHub.hubName) || (targetHub.hotelId && it.product.id.includes(targetHub.hotelId)))
    );
    existingHotelItems.forEach(it => removeProductFromQuote(it.id));
    setRouteHubs(prev =>
      prev.map(h => (h.id === hubId ? { 
        ...h, 
        hotelId: undefined, 
        roomTypeId: undefined, 
        roomsCount: 1,
        isManualHotel: false,
        accommodationType: 'master',
        manualHotel: undefined
      } : h))
    );
  };

  const handleRemoveManual = (hubId: string) => {
    if (onRemoveManualHotel) {
      onRemoveManualHotel(hubId);
      return;
    }
    const targetHub = routeHubs.find(h => h.id === hubId);
    if (!targetHub) return;
    const existingItems = items.filter(it => 
      it.isManualHotel && 
      (it.notes?.includes(targetHub.hubName) || (it.manualHotelDetails?.hubId === hubId))
    );
    existingItems.forEach(it => removeProductFromQuote(it.id));
    setRouteHubs(prev =>
      prev.map(h => (h.id === hubId ? {
        ...h,
        hotelId: undefined,
        roomTypeId: undefined,
        isManualHotel: false,
        manualHotel: undefined
      } : h))
    );
  };

  // Compute live step statuses and summary tags
  const stepStatuses = useMemo(() => {
    // 1. Trip Details
    let s1Status: 'COMPLETED' | 'IN_PROGRESS' | 'WARNING' | 'NOT_STARTED' = 'NOT_STARTED';
    if (clientName && startDate && endDate && adultsCount > 0) {
      s1Status = 'COMPLETED';
    } else if (clientName || startDate) {
      s1Status = 'IN_PROGRESS';
    }

    // 2. Destinations & Route
    let s2Status: 'COMPLETED' | 'IN_PROGRESS' | 'WARNING' | 'NOT_STARTED' = 'NOT_STARTED';
    if (routeHubs.length > 0) {
      if (routeTotalNights === tripNights) {
        s2Status = 'COMPLETED';
      } else {
        s2Status = 'WARNING';
      }
    }

    // 3. Hotels & Accommodation
    let s3Status: 'COMPLETED' | 'IN_PROGRESS' | 'WARNING' | 'NOT_STARTED' = 'NOT_STARTED';
    if (quotationScope === 'LAND_ONLY') {
      s3Status = 'COMPLETED';
    } else {
      if (hotelItems.length >= routeHubs.length && hotelItems.length > 0) {
        s3Status = 'COMPLETED';
      } else if (hotelItems.length > 0) {
        s3Status = 'WARNING';
      } else {
        s3Status = 'NOT_STARTED';
      }
    }

    // 4. Activities & Experiences
    let s4Status: 'COMPLETED' | 'IN_PROGRESS' | 'WARNING' | 'NOT_STARTED' = 'NOT_STARTED';
    if (activityItems.length >= 2) {
      s4Status = 'COMPLETED';
    } else if (activityItems.length === 1) {
      s4Status = 'IN_PROGRESS';
    } else {
      s4Status = 'NOT_STARTED';
    }

    // 5. Visa & Ancillary Services
    let s5Status: 'COMPLETED' | 'IN_PROGRESS' | 'NOT_STARTED' = 'NOT_STARTED';
    if (visaItems.length > 0) {
      s5Status = 'COMPLETED';
    } else {
      s5Status = 'NOT_STARTED';
    }

    // 6. Optional Services
    let s6Status: 'COMPLETED' | 'IN_PROGRESS' | 'NOT_STARTED' = 'NOT_STARTED';
    if (addonItems.length > 0) {
      s6Status = 'COMPLETED';
    } else {
      s6Status = 'NOT_STARTED';
    }

    // 7. Review & Feasibility
    let s7Status: 'COMPLETED' | 'WARNING' | 'NOT_STARTED' = 'NOT_STARTED';
    if (feasibility.score >= 8.5) {
      s7Status = 'COMPLETED';
    } else if (feasibility.warnings.length > 0) {
      s7Status = 'WARNING';
    } else {
      s7Status = 'COMPLETED';
    }

    // 8. Pricing & Margin
    let s8Status: 'COMPLETED' | 'IN_PROGRESS' | 'NOT_STARTED' = 'NOT_STARTED';
    if (items.length > 0 && effectiveFinalPrice > 0) {
      s8Status = 'COMPLETED';
    } else {
      s8Status = 'NOT_STARTED';
    }

    return {
      step1: s1Status,
      step2: s2Status,
      step3: s3Status,
      step4: s4Status,
      step5: s5Status,
      step6: s6Status,
      step7: s7Status,
      step8: s8Status
    };
  }, [
    clientName, 
    startDate, 
    endDate, 
    adultsCount, 
    routeHubs, 
    routeTotalNights, 
    tripNights, 
    quotationScope, 
    hotelItems, 
    activityItems, 
    addonItems, 
    visaItems, 
    calendarDays.length,
    feasibility, 
    items.length, 
    effectiveFinalPrice
  ]);

  // Overall Quote Completeness Calculation (8 Steps)
  const quoteCompleteness = useMemo(() => {
    let completedSteps = 0;
    if (stepStatuses.step1 === 'COMPLETED') completedSteps++;
    if (stepStatuses.step2 === 'COMPLETED') completedSteps++;
    if (stepStatuses.step3 === 'COMPLETED') completedSteps++;
    if (stepStatuses.step4 === 'COMPLETED') completedSteps++;
    if (stepStatuses.step5 === 'COMPLETED') completedSteps++;
    if (stepStatuses.step6 === 'COMPLETED') completedSteps++;
    if (stepStatuses.step7 === 'COMPLETED') completedSteps++;
    if (stepStatuses.step8 === 'COMPLETED') completedSteps++;

    const percent = Math.round((completedSteps / 8) * 100);
    return { completedSteps, percent };
  }, [stepStatuses]);

  // Step definitions array (1 to 8)
  const stepsList = [
    {
      id: 1,
      name: 'Trip Details',
      shortDesc: 'Customer, Destination & Dates',
      status: stepStatuses.step1,
      summary: `${tripNights} Nights • ${passengerClassification.classificationSummary}`,
      icon: Users
    },
    {
      id: 2,
      name: 'Destinations & Route',
      shortDesc: 'Multi-City Route Sequence',
      status: stepStatuses.step2,
      summary: `${routeHubs.length} Cities • ${routeTotalNights} Nights`,
      icon: MapPin
    },
    {
      id: 3,
      name: 'Hotels & Accommodation Stays',
      shortDesc: 'Contracted Properties & Stays',
      status: stepStatuses.step3,
      summary: quotationScope === 'LAND_ONLY' ? 'Skipped (Land Only)' : `${hotelItems.length} Hotels Booked`,
      icon: Building2
    },
    {
      id: 4,
      name: 'Activities & Experiences',
      shortDesc: 'Curated Tours, Rail & Experiences',
      status: stepStatuses.step4,
      summary: `${activityItems.length} Products Added`,
      icon: Compass
    },
    {
      id: 5,
      name: 'Visa & Ancillary Services',
      shortDesc: 'Official Visas, Travel Protection & VIP Services',
      status: stepStatuses.step5,
      summary: `${visaItems.length} Services Configured`,
      icon: ShieldCheck
    },
    {
      id: 6,
      name: 'Optional Services',
      shortDesc: 'Upgrades & Add-ons',
      status: stepStatuses.step6,
      summary: `${addonItems.length} Options Selected`,
      icon: Sparkles
    },
    {
      id: 7,
      name: 'Review & Feasibility',
      shortDesc: 'Operational Diagnostics & Check',
      status: stepStatuses.step7,
      summary: `Score ${feasibility.score}/10 (${feasibility.status})`,
      icon: CheckCircle2
    },
    {
      id: 8,
      name: 'Pricing & Margin',
      shortDesc: 'Commercial Calculations & Export',
      status: stepStatuses.step8,
      summary: `${currency} ${effectiveFinalPrice.toLocaleString()}`,
      icon: DollarSign
    }
  ];

  // Helper to render step status icon
  const renderStepStatusIcon = (status: 'COMPLETED' | 'IN_PROGRESS' | 'WARNING' | 'NOT_STARTED') => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />;
      case 'IN_PROGRESS':
        return <Clock className="w-4 h-4 text-teal-600 shrink-0" />;
      case 'WARNING':
        return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />;
      case 'NOT_STARTED':
      default:
        return <Circle className="w-4 h-4 text-slate-300 shrink-0" />;
    }
  };

  // Route Hub Handlers
  const handleAddHub = (hub: CityHub) => {
    const newHub: TripRouteHub = {
      id: `rhub-${Date.now()}`,
      hubId: hub.id,
      hubName: hub.name,
      nights: 2,
      order: routeHubs.length + 1,
      notes: ''
    };
    setRouteHubs([...routeHubs, newHub]);
  };

  const handleUpdateHubNights = (id: string, nights: number) => {
    const safeNights = Math.max(1, nights);
    setRouteHubs(routeHubs.map(h => h.id === id ? { ...h, nights: safeNights } : h));
  };

  const handleDeleteHub = (id: string) => {
    const filtered = routeHubs.filter(h => h.id !== id);
    const reindexed = filtered.map((h, idx) => ({ ...h, order: idx + 1 }));
    setRouteHubs(reindexed);
  };

  const handleMoveHub = (index: number, direction: 'UP' | 'DOWN') => {
    const newIndex = direction === 'UP' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= routeHubs.length) return;
    const newArr = [...routeHubs];
    const temp = newArr[index];
    newArr[index] = newArr[newIndex];
    newArr[newIndex] = temp;
    const reordered = newArr.map((h, idx) => ({ ...h, order: idx + 1 }));
    setRouteHubs(reordered);
  };

  return (
    <div className="w-full space-y-6 pb-24">
      {/* Top Banner: Quote Completeness & Multi-Option Tier Switcher */}
      <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Left: Completeness Meter */}
        <div className="space-y-1.5 w-full md:w-auto">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
              Quote Completeness:
            </span>
            <span className="text-xs font-black text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
              {quoteCompleteness.percent}% Complete ({quoteCompleteness.completedSteps} of 8 Steps)
            </span>
            <span className="text-[11px] text-slate-400 font-medium">
              • Auto-Saved {lastSavedTimestamp}
            </span>
          </div>
          {/* Progress Bar */}
          <div className="w-full md:w-80 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
            <div 
              className="h-full bg-gradient-to-r from-teal-500 to-[#00C6A6] transition-all duration-300 rounded-full"
              style={{ width: `${quoteCompleteness.percent}%` }}
            />
          </div>
        </div>

        {/* Right: Multi-Option Tier Selector */}
        <div className="flex items-center space-x-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <span className="text-xs font-bold text-slate-400 shrink-0 hidden sm:inline">Tier Option:</span>
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shrink-0">
            {[1, 2, 3].map(optNum => (
              <button
                key={optNum}
                type="button"
                onClick={() => onSelectOptionTab(optNum)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeOptionTab === optNum
                    ? 'bg-slate-900 text-[#00E5C0] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Option {optNum} {optNum === 1 ? '(4★ Premium)' : optNum === 2 ? '(5★ Luxury)' : '(Signature)'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Two-Column Step-by-Step Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ========================================================================= */}
        {/* LEFT COLUMN: STICKY STEP NAVIGATION (4 Cols on lg, 3 Cols on xl) */}
        {/* ========================================================================= */}
        <aside className="lg:col-span-4 xl:col-span-3 space-y-3 lg:sticky lg:top-6 min-w-0">
          <div className="bg-white rounded-3xl border border-slate-200 p-4 shadow-xs space-y-2">
            <div className="px-2 py-1 flex items-center justify-between">
              <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Quotation Workflow
              </span>
              <span className="text-[11px] font-bold text-slate-400">
                Step {activeStepId} of 8
              </span>
            </div>

            <nav className="space-y-1.5" aria-label="Quotation steps">
              {stepsList.map(step => {
                const isActive = activeStepId === step.id;
                const Icon = step.icon;

                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setActiveStepId(step.id)}
                    className={`w-full text-left p-3 rounded-2xl transition-all flex items-center justify-between cursor-pointer border ${
                      isActive
                        ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-[#00C6A6]/30'
                        : 'bg-white hover:bg-slate-50 border-slate-100 text-slate-700 hover:border-slate-200'
                    }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                        isActive 
                          ? 'bg-slate-800 text-[#00E5C0] border-slate-700' 
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>

                      <div className="min-w-0 pr-2">
                        <div className="flex items-center space-x-1.5">
                          <span className={`text-xs font-bold truncate ${isActive ? 'text-white' : 'text-slate-900'}`}>
                            {step.id}. {step.name}
                          </span>
                        </div>
                        <p className={`text-[11px] truncate font-medium ${isActive ? 'text-slate-300' : 'text-slate-400'}`}>
                          {step.summary}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 pl-1">
                      {renderStepStatusIcon(step.status)}
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Quick Context Card */}
          <div className="bg-slate-900 text-white rounded-3xl p-4.5 border border-slate-800 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black tracking-wider uppercase text-teal-400">
                Live Pricing Snapshot
              </span>
              <span className="text-xs font-mono font-bold text-slate-400">
                {currency}
              </span>
            </div>

            <div>
              <div className="text-2xl font-black font-mono text-white">
                {formatCurrency(finalClientPrice, currency)}
              </div>
              <p className="text-[11px] text-slate-400">
                Guaranteed Final Price • All Inclusive
              </p>
            </div>

            <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 block">Total Pax</span>
                <span className="font-bold text-slate-200">
                  {adultsCount + childrenCount + infantsCount} Travelers
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Duration</span>
                <span className="font-bold text-slate-200">
                  {tripNights} Nights / {tripNights + 1} Days
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: ACTIVE STEP CONTENT WORKSPACE (8 Cols on lg, 9 Cols on xl) */}
        {/* ========================================================================= */}
        <main className="lg:col-span-8 xl:col-span-9 space-y-6 min-w-0">
          {/* STEP 1: TRIP DETAILS */}
          {activeStepId === 1 && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6 animate-fadeIn">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-900">Step 1: Trip Details</h2>
                    <p className="text-xs text-slate-500">Configure traveler profile, travel dates, passenger ages, and rooming.</p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200">
                  Step 1 of 8
                </span>
              </div>

              {/* Client & CRM Leads */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                    Customer / Lead Information
                  </label>
                  {crmLeads.length > 0 && (
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-slate-400">Import CRM Lead:</span>
                      <select
                        value={selectedLeadId}
                        onChange={(e) => onSelectLead(e.target.value)}
                        className="text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 rounded-xl px-2.5 py-1 outline-none cursor-pointer"
                      >
                        <option value="">Select Existing CRM Lead...</option>
                        {crmLeads.map(lead => (
                          <option key={lead.id} value={lead.id}>
                            {lead.contactName} ({lead.agencyName || 'Direct'})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Client Full Name *</label>
                    <input
                      type="text"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="e.g. Robert & Sarah Vance"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:bg-white focus:border-teal-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Client Email</label>
                    <input
                      type="email"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      placeholder="client@agency.com"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:bg-white focus:border-teal-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Phone / WhatsApp</label>
                    <input
                      type="tel"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      placeholder="+1 (555) 019-2834"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:bg-white focus:border-teal-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Agency / Company</label>
                    <input
                      type="text"
                      value={clientCompany}
                      onChange={(e) => setClientCompany(e.target.value)}
                      placeholder="Elite Luxury Travel Ltd"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:bg-white focus:border-teal-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Destination & Travel Dates */}
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                  Destination, Scope & Travel Dates
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Destination Country *</label>
                    <select
                      value={currentDestination.id}
                      onChange={(e) => {
                        const found = destinations.find(d => d.id === e.target.value);
                        if (found) onSelectDestination(found);
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:bg-white focus:border-teal-500 outline-none cursor-pointer"
                    >
                      {destinations.map(dest => (
                        <option key={dest.id} value={dest.id}>{dest.name} ({dest.code})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Quotation Scope</label>
                    <select
                      value={quotationScope}
                      onChange={(e) => setQuotationScope(e.target.value as QuotationScope)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:bg-white focus:border-teal-500 outline-none cursor-pointer"
                    >
                      <option value="HOTEL_LAND">Hotel & Land Package (Full)</option>
                      <option value="LAND_ONLY">Land Package Only (No Hotel)</option>
                      <option value="HOTEL_ONLY">Hotel Accommodation Only</option>
                      <option value="FULL_PACKAGE">Full Package (Inc Flights/Visas)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Start Date (Check-in)</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:bg-white focus:border-teal-500 outline-none cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                      End Date ({tripNights} Nights)
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:bg-white focus:border-teal-500 outline-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Passenger Breakdown & Child Ages */}
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                    Passenger Breakdown & Ages
                  </label>
                  <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                    Classification: {passengerClassification.classificationSummary}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">Adults (11+ yrs)</span>
                      <span className="text-[10px] text-slate-500">ADT Tariff</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => setAdultsCount(Math.max(1, adultsCount - 1))}
                        className="w-7 h-7 rounded-lg bg-white border border-slate-300 text-xs font-bold hover:bg-slate-100 cursor-pointer"
                      >
                        -
                      </button>
                      <span className="w-6 text-center text-xs font-black">{adultsCount}</span>
                      <button
                        type="button"
                        onClick={() => setAdultsCount(adultsCount + 1)}
                        className="w-7 h-7 rounded-lg bg-white border border-slate-300 text-xs font-bold hover:bg-slate-100 cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">Children (2–10 yrs)</span>
                      <span className="text-[10px] text-slate-500">CWB / CNB Rates</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => onSetChildrenCount(Math.max(0, childrenCount - 1))}
                        className="w-7 h-7 rounded-lg bg-white border border-slate-300 text-xs font-bold hover:bg-slate-100 cursor-pointer"
                      >
                        -
                      </button>
                      <span className="w-6 text-center text-xs font-black">{childrenCount}</span>
                      <button
                        type="button"
                        onClick={() => onSetChildrenCount(childrenCount + 1)}
                        className="w-7 h-7 rounded-lg bg-white border border-slate-300 text-xs font-bold hover:bg-slate-100 cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">Infants (&lt;2 yrs)</span>
                      <span className="text-[10px] text-slate-500">INF Tariff (FOC)</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => setInfantsCount(Math.max(0, infantsCount - 1))}
                        className="w-7 h-7 rounded-lg bg-white border border-slate-300 text-xs font-bold hover:bg-slate-100 cursor-pointer"
                      >
                        -
                      </button>
                      <span className="w-6 text-center text-xs font-black">{infantsCount}</span>
                      <button
                        type="button"
                        onClick={() => setInfantsCount(infantsCount + 1)}
                        className="w-7 h-7 rounded-lg bg-white border border-slate-300 text-xs font-bold hover:bg-slate-100 cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Child Individual Ages */}
                {childrenCount > 0 && (
                  <div className="p-3 bg-teal-50/70 rounded-2xl border border-teal-200 space-y-2">
                    <span className="text-xs font-bold text-teal-900 block">
                      Individual Child Age Classification (Determines CWB vs CNB):
                    </span>
                    <div className="flex flex-wrap gap-2.5">
                      {Array.from({ length: childrenCount }).map((_, idx) => {
                        const currentAge = childAges[idx] || 7;
                        const isCWB = currentAge >= 6;
                        return (
                          <div key={idx} className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-xl border border-teal-200 text-xs">
                            <span className="font-bold text-slate-700">Child #{idx + 1} Age:</span>
                            <select
                              value={currentAge}
                              onChange={(e) => onUpdateChildAge(idx, parseInt(e.target.value, 10))}
                              className="font-bold text-teal-800 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 outline-none"
                            >
                              {[2, 3, 4, 5, 6, 7, 8, 9, 10].map(a => (
                                <option key={a} value={a}>{a} yrs ({a >= 6 ? 'CWB' : 'CNB'})</option>
                              ))}
                            </select>
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${isCWB ? 'bg-amber-100 text-amber-900' : 'bg-blue-100 text-blue-900'}`}>
                              {isCWB ? 'With Bed' : 'No Bed'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Rooming & Preferences */}
              <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Number of Rooms</label>
                  <select
                    value={roomingConfig.roomsCount}
                    onChange={(e) => setRoomingConfig({ ...roomingConfig, roomsCount: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 outline-none cursor-pointer"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(r => (
                      <option key={r} value={r}>{r} {r === 1 ? 'Room' : 'Rooms'}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Extra Bed Required</label>
                  <select
                    value={roomingConfig.extraBedRequired ? 'YES' : 'NO'}
                    onChange={(e) => setRoomingConfig({ ...roomingConfig, extraBedRequired: e.target.value === 'YES' })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 outline-none cursor-pointer"
                  >
                    <option value="YES">Yes, Extra Bed</option>
                    <option value="NO">No Extra Bed</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Nationality</label>
                  <input
                    type="text"
                    value={nationality}
                    onChange={(e) => setNationality(e.target.value)}
                    placeholder="e.g. Indian, American"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Meal Plan</label>
                  <select
                    value={mealPlanPreference}
                    onChange={(e) => setMealPlanPreference(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 outline-none cursor-pointer"
                  >
                    <option value="CP (Breakfast Included)">CP (Breakfast Included)</option>
                    <option value="MAP (Breakfast + Dinner)">MAP (Half Board)</option>
                    <option value="AP (All Meals)">AP (Full Board)</option>
                    <option value="EP (Room Only)">EP (Room Only)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: DESTINATIONS & ROUTE */}
          {activeStepId === 2 && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6 animate-fadeIn">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-900">Step 2: Destinations & Route</h2>
                    <p className="text-xs text-slate-500">Configure city hubs, night allocations, and sequence.</p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200">
                  Step 2 of 8
                </span>
              </div>

              {/* Nights Balance Alert */}
              <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                routeTotalNights === tripNights
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}>
                <div className="flex items-center space-x-2 text-xs font-bold">
                  {routeTotalNights === tripNights ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  )}
                  <span>
                    Route Nights: {routeTotalNights} Nights • Total Itinerary: {tripNights} Nights
                    {routeTotalNights !== tripNights && ' (Discrepancy detected)'}
                  </span>
                </div>
                {routeTotalNights !== tripNights && (
                  <button
                    type="button"
                    onClick={() => {
                      // Adjust last hub to balance
                      if (routeHubs.length > 0) {
                        const diff = tripNights - routeTotalNights;
                        const last = routeHubs[routeHubs.length - 1];
                        handleUpdateHubNights(last.id, Math.max(1, (last.nights || 1) + diff));
                      }
                    }}
                    className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Auto-Balance Nights
                  </button>
                )}
              </div>

              {/* Route Sequence Visualizer */}
              {routeHubs.length > 0 ? (
                <div className="space-y-2">
                  <span className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                    Route Sequence:
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    {routeHubs.map((hub, idx) => (
                      <React.Fragment key={hub.id}>
                        <div className="bg-slate-900 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-2xs">
                          <span className="text-[#00E5C0]">Day {idx + 1}:</span>
                          <span>{hub.hubName}</span>
                          <span className="text-slate-400 font-mono">({hub.nights}N)</span>
                        </div>
                        {idx < routeHubs.length - 1 && (
                          <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Route Hubs List */}
              <div className="space-y-3">
                <span className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                  Configured City Hubs & Stays:
                </span>

                {routeHubs.length === 0 ? (
                  <div className="p-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 text-center space-y-2">
                    <MapPin className="w-7 h-7 text-slate-400 mx-auto" />
                    <h4 className="text-xs font-bold text-slate-800">No City Hubs Configured</h4>
                    <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                      Click any destination hub below to add it to your travel route and begin allocating nights.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {routeHubs.map((hub, idx) => {
                      const { checkInFormatted, checkOutFormatted } = getHubDates(hub.order, hub.nights || 1);

                      return (
                        <div key={hub.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-xl bg-slate-900 text-[#00E5C0] font-black flex items-center justify-center text-xs shrink-0">
                              #{hub.order}
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-slate-900">{hub.hubName} Hub</h4>
                              <p className="text-[11px] text-slate-500">
                                {checkInFormatted} → {checkOutFormatted} • {hub.nights} {hub.nights === 1 ? 'Night' : 'Nights'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                            <div className="flex items-center space-x-1 bg-white px-2 py-1 rounded-xl border border-slate-200">
                              <span className="text-xs text-slate-500 font-semibold">Nights:</span>
                              <button
                                type="button"
                                onClick={() => handleUpdateHubNights(hub.id, (hub.nights || 1) - 1)}
                                className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-xs font-bold cursor-pointer"
                              >
                                -
                              </button>
                              <span className="w-6 text-center text-xs font-bold">{hub.nights}</span>
                              <button
                                type="button"
                                onClick={() => handleUpdateHubNights(hub.id, (hub.nights || 1) + 1)}
                                className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-xs font-bold cursor-pointer"
                              >
                                +
                              </button>
                            </div>

                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleMoveHub(idx, 'UP')}
                              className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 disabled:opacity-30 cursor-pointer"
                              title="Move Up"
                            >
                              <ChevronUp className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              disabled={idx === routeHubs.length - 1}
                              onClick={() => handleMoveHub(idx, 'DOWN')}
                              className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 disabled:opacity-30 cursor-pointer"
                              title="Move Down"
                            >
                              <ChevronDown className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteHub(hub.id)}
                              className="p-1.5 rounded-lg bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-600 cursor-pointer"
                              title="Delete Hub"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Add Destination Hub */}
              <div className="pt-4 border-t border-slate-100 space-y-2">
                <span className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                  + Add Another Destination Hub:
                </span>
                <div className="flex flex-wrap gap-2">
                  {destinationHubs.map(hub => (
                    <button
                      key={hub.id}
                      type="button"
                      onClick={() => handleAddHub(hub)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-900 border border-slate-200 text-xs font-bold text-slate-700 transition-all cursor-pointer flex items-center space-x-1.5"
                    >
                      <Plus className="w-3.5 h-3.5 text-teal-600" />
                      <span>+ {hub.hubName || hub.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: HOTELS & ACCOMMODATION */}
          {activeStepId === 3 && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6 animate-fadeIn">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-900">Step 3: Hotels & Accommodation Stays</h2>
                    <p className="text-xs text-slate-500">Contracted 4★ & 5★ luxury properties, custom room configurations, and bespoke rates.</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {canAddManualHotel && (
                    <button
                      type="button"
                      onClick={() => onOpenManualHotelModal()}
                      className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5 text-amber-600" />
                      <span>+ Custom / Manual Hotel</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setQuotationScope(quotationScope === 'LAND_ONLY' ? 'FULL_PACKAGE' : 'LAND_ONLY')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                      quotationScope === 'LAND_ONLY'
                        ? 'bg-purple-100 text-purple-900 border-purple-300'
                        : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    {quotationScope === 'LAND_ONLY' ? '✓ Land-Only Package' : 'Land-Only Mode'}
                  </button>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200">
                    Step 3 of 8
                  </span>
                </div>
              </div>

              {/* Total Hotel Summary Bar */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-xl bg-teal-100/70 text-teal-800 flex items-center justify-center font-bold text-xs">
                    🏨
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      {routeHubs.length} Route Hubs • {routeTotalNights} Total Nights Accommodation
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Party Size: {adultsCount} Adults{childrenCount > 0 ? `, ${childrenCount} Children` : ''}{infantsCount > 0 ? `, ${infantsCount} Infants` : ''}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-500">Accommodation Total:</span>
                  <span className="text-sm font-black font-mono text-emerald-600 bg-white px-3 py-1 rounded-xl border border-slate-200 shadow-2xs">
                    {formatCurrency(hotelTotalSelling, currency)}
                  </span>
                </div>
              </div>

              {/* Hub Accommodations Grid */}
              <div className="space-y-5">
                {routeHubs.map(hub => {
                  const assignedItem = hotelItems.find(it => 
                    it.notes?.includes(hub.hubName) || 
                    (hub.hotelId && it.product.id.includes(hub.hotelId)) ||
                    (it.manualHotelDetails?.hubId === hub.id) ||
                    it.product.name.toLowerCase().includes(hub.hubName.toLowerCase())
                  );

                  const { checkInFormatted, checkOutFormatted } = getHubDates(hub.order, hub.nights || 1);

                  const hotelsToDisplay = DestinationRelevanceService.getInstance().getRelevantHotels(
                    currentDestination.id,
                    hub.hubId || hub.hubName
                  );

                  const isManualStay = Boolean(
                    hub.isManualHotel || 
                    hub.manualHotel || 
                    assignedItem?.isManualHotel || 
                    assignedItem?.product?.accommodationType === 'manual' || 
                    (assignedItem as any)?.accommodationType === 'manual'
                  );
                  const manualDetails: ManualHotelDetails | undefined = hub.manualHotel || assignedItem?.manualHotelDetails;

                  const selectedHotel = !isManualStay ? (
                    availableHotels.find(h => h.id === hub.hotelId) || 
                    (assignedItem ? availableHotels.find(h => assignedItem.product.id.includes(h.id)) : undefined)
                  ) : undefined;

                  const selectedRoom = selectedHotel?.roomTypes?.find(r => r.id === hub.roomTypeId) || selectedHotel?.roomTypes?.[0];
                  const selectedRate = selectedRoom?.rates?.[0];
                  const currentRoomsCount = hub.roomsCount || 1;
                  const currentNights = hub.nights || 1;

                  const nightlyInQuoteCurrency = selectedHotel 
                    ? convertCurrency(
                        (selectedRate as any)?.startingSellingRateUSD || (selectedRate as any)?.sellingRateUSD || selectedHotel.startingPriceB2B || Math.round(((selectedRate?.doubleNetRate || selectedRate?.singleNetRate || selectedHotel.startingNetPrice || 200) * 1.3)), 
                        selectedRate?.currency || selectedHotel.currency || 'USD', 
                        currency
                      )
                    : 0;

                  const totalStaySelling = nightlyInQuoteCurrency * currentNights * currentRoomsCount;
                  const finalSellingStayPrice = totalStaySelling * (1 + (agentMarkupPercent || 0) / 100);

                  const occupancy = validateRoomOccupancy(selectedRoom, currentRoomsCount, adultsCount, childrenCount, infantsCount);

                  const manualSellingPrice = assignedItem?.calculation?.finalTotalSellingPrice || 
                    assignedItem?.calculation?.totalSellingPrice || 
                    (manualDetails ? convertCurrency(
                      (manualDetails.rateType === 'TOTAL_STAY' 
                        ? manualDetails.ratePerNight 
                        : manualDetails.rateType === 'PER_PERSON_PER_NIGHT' 
                          ? manualDetails.ratePerNight * (adultsCount + childrenCount) * (manualDetails.numberOfNights || hub.nights || 1)
                          : manualDetails.ratePerNight * (manualDetails.numberOfRooms || hub.roomsCount || 1) * (manualDetails.numberOfNights || hub.nights || 1)),
                      manualDetails.rateCurrency, 
                      currency
                    ) * (1 + (agentMarkupPercent || 0) / 100) : 0);

                  return (
                    <div 
                      key={hub.id} 
                      className={`p-5 rounded-2xl border transition-all space-y-4 ${
                        isManualStay
                          ? 'bg-amber-50/40 border-amber-200'
                          : selectedHotel
                            ? occupancy.isValid ? 'bg-slate-50/90 border-slate-200' : 'bg-rose-50/40 border-rose-200'
                            : 'bg-slate-50/50 border-slate-200'
                      }`}
                    >
                      {/* Hub Header with Status */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200/80">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-7 h-7 rounded-lg bg-teal-50 border border-teal-200 text-[#00A88F] flex items-center justify-center font-bold text-xs">
                            {hub.order}
                          </div>
                          <div>
                            <span className="text-xs font-black text-slate-900 block">
                              {hub.hubName} Hub • {hub.nights} {hub.nights > 1 ? 'Nights' : 'Night'} Stay
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono">
                              {checkInFormatted} → {checkOutFormatted}
                            </span>
                          </div>
                        </div>

                        <div>
                          {isManualStay ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 shrink-0 flex items-center space-x-1">
                              <span>✨ Manual Stay</span>
                            </span>
                          ) : selectedHotel ? (
                            occupancy.isValid ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200 shrink-0">
                                ✓ Stay Configured
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 shrink-0 flex items-center space-x-1">
                                <AlertTriangle className="w-2.5 h-2.5" />
                                <span>Occupancy Exceeded</span>
                              </span>
                            )
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600 border border-slate-300 shrink-0">
                              Not Assigned
                            </span>
                          )}
                        </div>
                      </div>

                      {/* CASE 1: MANUALLY ADDED HOTEL STAY */}
                      {isManualStay && manualDetails ? (
                        <div className="bg-amber-50/70 rounded-xl p-4 border border-amber-300 space-y-3 shadow-xs animate-fadeIn">
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
                                onClick={() => onOpenEditManualHotel ? onOpenEditManualHotel(hub.id) : onOpenManualHotelModal(hub.id)}
                                className="p-1.5 rounded-lg bg-white hover:bg-amber-100 border border-amber-200 text-amber-800 text-[10px] font-bold transition-colors cursor-pointer"
                                title="Edit Manual Hotel & Rate"
                              >
                                <Sliders className="w-3.5 h-3.5 text-amber-800" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveManual(hub.id)}
                                className="p-1.5 rounded-lg bg-white hover:bg-rose-100 border border-rose-200 text-rose-600 text-[10px] font-bold transition-colors cursor-pointer"
                                title="Remove Manual Stay"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
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
                              <span>{manualDetails.numberOfNights} Nights Stay</span>
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
                              ✓ Clean fixed-stay price • Includes all taxes & fees
                            </p>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-amber-200/80 text-[10px]">
                            <button
                              type="button"
                              onClick={() => onOpenEditManualHotel ? onOpenEditManualHotel(hub.id) : onOpenManualHotelModal(hub.id)}
                              className="text-amber-800 hover:text-amber-900 font-bold underline cursor-pointer"
                            >
                              Modify Rate or Room Specs
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveManual(hub.id)}
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
                                  onClick={() => onOpenManualHotelModal(hub.id)}
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
                                  onOpenManualHotelModal(hub.id);
                                } else if (val && val !== 'LAND_ONLY_HUB') {
                                  const h = availableHotels.find(x => x.id === val);
                                  if (h) {
                                    handleSelectHotel(hub.order, h, h.roomTypes?.[0]?.id, currentRoomsCount);
                                  }
                                } else {
                                  handleRemoveHotel(hub.id);
                                }
                              }}
                              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 outline-none cursor-pointer focus:border-[#00C6A6] focus:ring-2 focus:ring-[#00C6A6]/20 shadow-2xs"
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
                                  {h.name} ({h.starRating || 5}★) {h.city ? `• ${h.city}` : ''}
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
                                  onClick={() => handleRemoveHotel(hub.id)}
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
                                    handleSelectHotel(hub.order, selectedHotel, e.target.value, currentRoomsCount);
                                  }}
                                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none cursor-pointer focus:bg-white focus:border-[#00C6A6]"
                                >
                                  {(selectedHotel.roomTypes || []).map(r => {
                                    const rRate = r.rates?.[0];
                                    const rPrice = (rRate as any)?.startingSellingRateUSD || (rRate as any)?.sellingRateUSD || selectedHotel.startingPriceB2B || Math.round(((rRate?.doubleNetRate || selectedHotel.startingNetPrice || 200) * 1.3));
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
                                    handleSelectHotel(hub.order, selectedHotel, selectedRoom?.id, newRooms);
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
                                    onClick={() => handleSelectHotel(hub.order, selectedHotel, selectedRoom?.id, occupancy.recommendedRoomsCount)}
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
                                  onClick={() => onOpenManualHotelModal(hub.id)}
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

          {/* STEP 4: ACTIVITIES & EXPERIENCES */}
          {activeStepId === 4 && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6 animate-fadeIn">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center">
                    <Compass className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-900">Step 4: Activities & Experiences</h2>
                    <p className="text-xs text-slate-500">Day-by-day itinerary builder, curated excursions, Shinkansen bullet train rail journeys, and product configurations.</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {japanRailMasterProducts.length > 0 && matchesDestination(currentDestination.id, 'dest-japan', 'Japan', 'Japan') && (
                    <button
                      type="button"
                      onClick={() => onOpenProductDetails(japanRailMasterProducts[0])}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-[#00E5C0] text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 shadow-2xs"
                    >
                      <Train className="w-3.5 h-3.5" />
                      <span>🚅 Configure Japan Rail / Shinkansen</span>
                    </button>
                  )}
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200">
                    Step 4 of 8
                  </span>
                </div>
              </div>

              {/* Japan Rail Quick Config Banner if Destination is Japan */}
              {matchesDestination(currentDestination.id, 'dest-japan', 'Japan', 'Japan') && (
                <div className="p-4 bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl border border-slate-800 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-[#00E5C0] flex items-center justify-center border border-[#00E5C0]/30">
                        <Train className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-white">
                          Japan High-Speed Shinkansen Bullet Train Network
                        </h4>
                        <p className="text-[11px] text-slate-300">
                          Configure dynamic smartEX bullet train routes (Tokyo, Kyoto, Osaka, Hiroshima, Hakata & beyond).
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                      Live smartEX Rates (JPY)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {japanRailMasterProducts.map(prod => {
                      const isGreen = prod.id === 'RAIL-JP-GREEN-RESERVED' || prod.carType === 'Green' || (prod.name || '').toLowerCase().includes('green');
                      const label = isGreen ? 'Green Car (First Class Reserved)' : 'Ordinary Car (Reserved Seat)';

                      return (
                        <div
                          key={prod.id}
                          className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/80 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-slate-100 block truncate">{label}</span>
                            <span className="text-[10px] text-slate-400">
                              {isGreen ? '2x2 luxury seating, hot towel service' : 'Guaranteed reserved seating across Japan network'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => onOpenProductDetails(prod)}
                            className="px-3 py-1.5 rounded-lg bg-[#00C6A6] hover:bg-[#00A88F] text-slate-950 font-black text-xs transition-colors shrink-0 cursor-pointer flex items-center space-x-1"
                          >
                            <Sliders className="w-3 h-3" />
                            <span>Configure</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Hub Filter Tabs & Summary */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-1 border-b border-slate-100">
                <div className="flex items-center flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedHubFilter('ALL')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      selectedHubFilter === 'ALL'
                        ? 'bg-slate-900 text-[#00E5C0] shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    All Days ({calendarDays.length})
                  </button>
                  {routeHubs.map(h => (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => setSelectedHubFilter(h.hubName)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        selectedHubFilter === h.hubName
                          ? 'bg-slate-900 text-[#00E5C0] shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      📍 {h.hubName} ({h.nights}n)
                    </button>
                  ))}
                </div>

                <div className="text-xs text-slate-500 font-medium">
                  {activityItems.length} Activities & Experiences Scheduled
                </div>
              </div>

              {/* Day-Wise Activities Canvas */}
              <div className="space-y-6">
                {daySlots
                  .filter(slot => selectedHubFilter === 'ALL' || slot.hub?.hubName === selectedHubFilter)
                  .map(slot => (
                    <div
                      key={slot.dayNumber}
                      className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-all hover:border-slate-300"
                    >
                      {/* Day Header */}
                      <div className="p-4 bg-gradient-to-r from-slate-50 to-slate-100/60 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 text-[#00A88F] flex flex-col items-center justify-center font-bold shrink-0">
                            <span className="text-[9px] uppercase tracking-wider text-slate-500 font-mono">Day</span>
                            <span className="text-sm font-black leading-none">{slot.dayNumber}</span>
                          </div>
                          <div>
                            <div className="flex items-center flex-wrap gap-2">
                              <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                                {slot.dayOfWeek}, {slot.formattedDate}
                              </h3>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white text-teal-800 border border-slate-200 shadow-2xs">
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
                              onChange={(e) => setDayThemes?.(prev => ({ ...prev, [slot.dayNumber]: e.target.value }))}
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
                            onClick={() => onOpenQuickAddProductModal({ dayNumber: slot.dayNumber, dateString: slot.dateString, hub: slot.hub })}
                            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#00C6A6] hover:bg-[#00A88F] text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>+ Add Product</span>
                          </button>
                        </div>
                      </div>

                      {/* Day Body Content */}
                      <div className="p-4 sm:p-5 space-y-4">
                        {/* Night Accommodation Badge for this Day */}
                        {quotationScope !== 'LAND_ONLY' && (
                          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 flex items-center justify-between">
                            <div className="flex items-center space-x-2.5">
                              <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center">
                                <BedDouble className="w-3.5 h-3.5" />
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
                          <div className="bg-slate-50/60 rounded-xl p-5 border border-dashed border-slate-300 text-center space-y-2">
                            <Compass className="w-5 h-5 text-slate-400 mx-auto" />
                            <p className="text-xs text-slate-500 font-medium">
                              No activities or transfers scheduled for Day {slot.dayNumber} ({slot.hub?.hubName || currentDestination.name}) yet.
                            </p>
                            <button
                              type="button"
                              onClick={() => onOpenQuickAddProductModal({ dayNumber: slot.dayNumber, dateString: slot.dateString, hub: slot.hub })}
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
                                className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 hover:border-slate-300 hover:bg-white transition-all shadow-2xs space-y-3"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                      isRailQuoteItem(item)
                                        ? 'bg-indigo-50 border border-indigo-200 text-indigo-700'
                                        : item.product.category === 'Transfer' || item.product.category === 'Transport'
                                        ? 'bg-teal-50 border border-teal-200 text-[#00A88F]'
                                        : 'bg-teal-50 border border-teal-200 text-[#00A88F]'
                                    }`}>
                                      {isRailQuoteItem(item) ? (
                                        <Train className="w-4 h-4" />
                                      ) : item.product.category === 'Transfer' || item.product.category === 'Transport' ? (
                                        <Car className="w-3.5 h-3.5" />
                                      ) : (
                                        <Compass className="w-3.5 h-3.5" />
                                      )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                                          {item.serviceTime || '09:30 AM'}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                          isRailQuoteItem(item)
                                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                            : 'bg-white text-slate-600 border border-slate-200'
                                        }`}>
                                          {isRailQuoteItem(item) ? '🚄 Shinkansen Rail' : item.product.category}
                                        </span>
                                        {item.product.city && (
                                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                            📍 {item.product.city}
                                          </span>
                                        )}
                                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                                          {item.customTitle || item.title || item.product.name}
                                        </h4>
                                      </div>

                                      {/* Shinkansen Route & Seat Specifications */}
                                      {isRailQuoteItem(item) && item.railJourneyDetails && (
                                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-700 bg-indigo-50/70 border border-indigo-100 px-2 py-1 rounded-lg">
                                          <span className="font-extrabold text-indigo-900">
                                            {item.railJourneyDetails.originStationName} → {item.railJourneyDetails.destinationStationName}
                                          </span>
                                          <span>•</span>
                                          <span className="font-semibold text-slate-700">
                                            {item.railJourneyDetails.carType} Class ({item.railJourneyDetails.seatType})
                                          </span>
                                          <span>•</span>
                                          <span className="text-indigo-800 font-medium">
                                            {item.railJourneyDetails.serviceGroup === 'NOZOMI_MIZUHO' ? 'Nozomi Super Express' : 'Hikari/Kodama'}
                                          </span>
                                          {item.railJourneyDetails.seatPreference && (
                                            <>
                                              <span>•</span>
                                              <span className="text-slate-500">Seat: {item.railJourneyDetails.seatPreference}</span>
                                            </>
                                          )}
                                        </div>
                                      )}

                                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 mt-1">
                                        <span>Pax: {item.pax.adults} Adults{item.pax.children > 0 ? `, ${item.pax.children} Ch` : ''}</span>
                                        {!isRailQuoteItem(item) && item.product.duration && (
                                          <span>Duration: {item.product.duration}</span>
                                        )}
                                        {item.notes && !isRailQuoteItem(item) && (
                                          <span className="text-amber-700 font-mono">Note: {item.notes}</span>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => setExpandedItemDetails(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                                          className="text-[#008f77] hover:text-[#00705d] font-bold text-[10px] cursor-pointer flex items-center space-x-1"
                                        >
                                          <span>{expandedItemDetails[item.id] ? 'Hide Specs & Inclusions' : 'Show Specs & Inclusions'}</span>
                                        </button>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Price & Actions: View, Edit/Customise, Delete */}
                                  <div className="flex items-center space-x-2 shrink-0">
                                    <span className="text-xs sm:text-sm font-bold text-slate-900 font-mono mr-1">
                                      {formatCurrency(item.calculation?.finalTotalSellingPrice || 0, currency)}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => onOpenProductDetails(item.product)}
                                      className="p-1.5 rounded-lg bg-white hover:bg-teal-50 text-slate-600 hover:text-teal-700 border border-slate-200 transition-colors cursor-pointer"
                                      title="View Product Details"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onOpenEditItem ? onOpenEditItem(item) : undefined}
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

                                {/* Expanded Snapshot Panel */}
                                {expandedItemDetails[item.id] && (
                                  <div className="border-t border-slate-200 pt-3 mt-1.5 space-y-3 text-xs text-slate-600 animate-in slide-in-from-top-1 duration-150">
                                    {/* Overview & Specifications */}
                                    <div className="space-y-1">
                                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Overview & Specifications</span>
                                      <RichTextRenderer 
                                        content={item.contentSnapshot?.overviewSpecifications || item.product.longDescription || item.product.description || item.product.shortDescription || ''}
                                        className="text-xs text-slate-600 leading-relaxed font-sans"
                                      />
                                    </div>

                                    {/* Inclusions */}
                                    {((item.contentSnapshot?.inclusions && item.contentSnapshot.inclusions.length > 0) || (item.product.inclusions && item.product.inclusions.length > 0)) && (
                                      <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Inclusions</span>
                                        <div className="flex flex-wrap gap-1.5">
                                          {(item.contentSnapshot?.inclusions || item.product.inclusions || []).map((inc: string, iIdx: number) => (
                                            <span key={iIdx} className="text-[10px] bg-white text-emerald-950 px-2 py-0.5 rounded border border-emerald-200 flex items-center space-x-1 font-medium">
                                              <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                                              <span>{inc}</span>
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* Exclusions */}
                                    {((item.contentSnapshot?.exclusions && item.contentSnapshot.exclusions.length > 0) || (item.product.exclusions && item.product.exclusions.length > 0)) && (
                                      <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">Exclusions</span>
                                        <div className="flex flex-wrap gap-1.5">
                                          {(item.contentSnapshot?.exclusions || item.product.exclusions || []).map((exc: string, eIdx: number) => (
                                            <span key={eIdx} className="text-[10px] bg-white text-rose-950 px-2 py-0.5 rounded border border-rose-200 flex items-center space-x-1 font-medium">
                                              <span className="text-rose-500 font-bold shrink-0">✕</span>
                                              <span>{exc}</span>
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Recommended Highlights for this Day / Hub */}
                        {products.length > 0 && (
                          <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center space-x-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-[#00A88F]" />
                                <span>Recommended for {slot.hub?.hubName || currentDestination.name}</span>
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium">City-Matched Experiences</span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                              {DestinationRelevanceService.getInstance().getRelevantProducts(
                                currentDestination.id,
                                slot.hub?.hubId || slot.hub?.hubName
                              ).hubActivities
                                .filter(p => !slot.productItems.some(it => it.product.id === p.id))
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
                                    <div className="shrink-0">
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
                                        className="px-2.5 py-1.5 rounded-lg bg-[#00C6A6] hover:bg-[#00A88F] text-white font-bold text-[11px] transition-colors cursor-pointer shadow-2xs flex items-center space-x-1"
                                        title="Directly add to day itinerary"
                                      >
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>Configure & Add</span>
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
            </div>
          )}

          {/* STEP 5: VISA & ANCILLARY SERVICES */}
          {activeStepId === 5 && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-900">Step 5: Visa & Ancillary Services</h2>
                    <p className="text-xs text-slate-500">Official consular visas, visa facilitation, travel protection, and VIP ancillary services.</p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200">
                  Step 5 of 8
                </span>
              </div>

              <VisaServicesAndFacilitationSection
                currentDestination={currentDestination}
                currency={currency}
                items={items}
                adultsCount={adultsCount}
                childrenCount={childrenCount}
                infantsCount={infantsCount}
                tripNights={tripNights}
                startDate={startDate}
                onAddProduct={addProductToQuote}
                onRemoveProduct={removeProductFromQuote}
                onOpenVisaPickerModal={onOpenVisaPickerModal}
                onOpenEditItem={onOpenEditItem}
                activeOptionNumber={activeOptionTab}
              />
            </div>
          )}

          {/* STEP 6: OPTIONAL SERVICES */}
          {activeStepId === 6 && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6 animate-fadeIn">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-900">Step 6: Optional Services</h2>
                    <p className="text-xs text-slate-500">Optional upgrades, international travel protection, 5G eSIM connectivity, and VIP airport & ground add-ons.</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => onOpenAddonModal('ALL')}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-[#00E5C0] text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Browse Full Add-ons Catalog</span>
                  </button>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200">
                    Step 6 of 8
                  </span>
                </div>
              </div>

              {/* Optional Services Summary Banner */}
              <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase text-[#00E5C0] tracking-wider block">
                    Optional Services & Upgrades Summary
                  </span>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-2xl font-black font-mono text-white">
                      {formatCurrency(addonTotalSelling, currency)}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      • {addonItems.length} {addonItems.length === 1 ? 'Option' : 'Options'} Selected
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenAddonModal('INSURANCE')}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1.5"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>Travel Protection</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenAddonModal('ESIM')}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-300 border border-slate-700 text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1.5"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>5G eSIM Data</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenAddonModal('SERVICES')}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-[#00E5C0] border border-slate-700 text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1.5"
                  >
                    <Plane className="w-3.5 h-3.5" />
                    <span>VIP Concierge</span>
                  </button>
                </div>
              </div>

              {/* Active Optional Services in Quote */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                    Selected Optional Services in Quotation ({addonItems.length})
                  </h3>
                  {addonItems.length > 0 && (
                    <span className="text-xs font-mono font-bold text-emerald-700">
                      Subtotal: {formatCurrency(addonTotalSelling, currency)}
                    </span>
                  )}
                </div>

                {addonItems.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-slate-50 border border-dashed border-slate-300 text-center space-y-2">
                    <Sparkles className="w-7 h-7 text-slate-400 mx-auto" />
                    <h4 className="text-xs font-bold text-slate-800">No Optional Services Added Yet</h4>
                    <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                      Select from the optional travel insurance plans, high-speed 5G eSIMs, or VIP airport & ground concierge upgrades below to enhance your client proposal.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {addonItems.map(item => (
                      <div
                        key={item.id}
                        className="p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-all flex flex-col justify-between space-y-3 shadow-2xs"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 min-w-0">
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase bg-teal-100 text-teal-900 border border-teal-200">
                              {item.product.subcategory || item.product.category || 'Optional Service'}
                            </span>
                            <h4 className="text-xs sm:text-sm font-black text-slate-900 truncate">
                              {getInventoryDisplayName(item)}
                            </h4>
                            <p className="text-[11px] text-slate-500 line-clamp-2">
                              {item.product.shortDescription || item.notes}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-[10px] text-slate-400 block">Selling Price</span>
                            <span className="text-sm font-black font-mono text-emerald-600">
                              {formatCurrency(item.calculation?.finalTotalSellingPrice || 0, currency)}
                            </span>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs">
                          <span className="text-[11px] text-slate-500 font-medium">
                            Pax: <strong className="text-slate-800">{item.pax.adults} Adults{item.pax.children > 0 ? `, ${item.pax.children} Ch` : ''}</strong>
                          </span>
                          <div className="flex items-center space-x-2">
                            {onOpenEditItem && (
                              <button
                                type="button"
                                onClick={() => onOpenEditItem(item)}
                                className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold cursor-pointer"
                              >
                                Configure
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => removeProductFromQuote(item.id)}
                              className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-bold cursor-pointer flex items-center space-x-1"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Remove</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 1. Optional VIP Airport & Concierge Upgrades */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Plane className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                      VIP Airport Fast-Track, Luggage & Concierge Upgrades
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">Instant Confirmation</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl border border-slate-200 bg-emerald-50/30 hover:border-emerald-300 transition-all flex flex-col justify-between space-y-3">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-900">VIP Fast-Track</span>
                      <h4 className="text-xs font-bold text-slate-900">Airport Aerobridge Meet & Greet</h4>
                      <p className="text-[11px] text-slate-600">Personal escort from aircraft door through express immigration & luggage hall.</p>
                    </div>
                    <div className="pt-2 border-t border-emerald-200/80 flex items-center justify-between">
                      <span className="text-sm font-black font-mono text-slate-900">
                        {formatCurrency(convertCurrency(110, 'USD', currency), currency)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleQuickAddOptionalVipService('VIP_MEET_GREET')}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer flex items-center space-x-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Option</span>
                      </button>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl border border-slate-200 bg-emerald-50/30 hover:border-emerald-300 transition-all flex flex-col justify-between space-y-3">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-900">Ground Luggage</span>
                      <h4 className="text-xs font-bold text-slate-900">Dedicated Luggage Support Van</h4>
                      <p className="text-[11px] text-slate-600">Separate dedicated luggage van for excess baggage, golf bags, and shopping boxes.</p>
                    </div>
                    <div className="pt-2 border-t border-emerald-200/80 flex items-center justify-between">
                      <span className="text-sm font-black font-mono text-slate-900">
                        {formatCurrency(convertCurrency(135, 'USD', currency), currency)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleQuickAddOptionalVipService('LUGGAGE_VAN')}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer flex items-center space-x-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Option</span>
                      </button>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl border border-slate-200 bg-emerald-50/30 hover:border-emerald-300 transition-all flex flex-col justify-between space-y-3">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-900">5G Device</span>
                      <h4 className="text-xs font-bold text-slate-900">Pocket Wi-Fi Hotspot ({tripNights + 1} Days)</h4>
                      <p className="text-[11px] text-slate-600">Unlimited portable 5G hotspot for up to 8 devices with airport pickup & return.</p>
                    </div>
                    <div className="pt-2 border-t border-emerald-200/80 flex items-center justify-between">
                      <span className="text-sm font-black font-mono text-slate-900">
                        {formatCurrency(convertCurrency(10 * Math.max(1, tripNights + 1), 'USD', currency), currency)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleQuickAddOptionalVipService('PORTABLE_WIFI')}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer flex items-center space-x-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Option</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Optional International Travel Protection Plans */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Optional International Travel Insurance Plans ({tripNights + 1} Days)
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {B2B_INSURANCE_PLANS.map(plan => {
                    const totalDays = Math.max(1, tripNights + 1);
                    const estSellingUSD = (plan.sellingPricePerDayAdultUSD * totalDays * adultsCount) +
                                          (plan.sellingPricePerDayChildUSD * totalDays * childrenCount);
                    return (
                      <div key={plan.id} className="p-4 rounded-2xl border border-slate-200 bg-amber-50/30 hover:border-amber-300 transition-all flex flex-col justify-between space-y-3">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-900">
                              ${(plan.coverageAmountUSD / 1000).toFixed(0)}k Medical Cover
                            </span>
                            <span className="text-xs font-bold text-slate-500">{plan.provider.split('/')[0]}</span>
                          </div>
                          <h4 className="text-xs sm:text-sm font-black text-slate-900">{plan.name}</h4>
                          <p className="text-[11px] text-slate-600">{plan.coverageSummary}</p>
                        </div>

                        <div className="pt-2 border-t border-amber-200/80 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] text-slate-400 block">Total for {adultsCount + childrenCount} Pax ({totalDays} Days)</span>
                            <span className="text-sm font-black font-mono text-slate-900">
                              {formatCurrency(convertCurrency(estSellingUSD, 'USD', currency), currency)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleQuickAddOptionalInsurance(plan)}
                            className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer flex items-center space-x-1 shadow-2xs"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Insurance</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 3. Optional 5G eSIM Data Packs */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center space-x-2">
                  <Smartphone className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Instant International 5G eSIM Connectivity
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {B2B_ESIM_PLANS.map(plan => (
                    <div key={plan.id} className="p-4 rounded-2xl border border-slate-200 bg-blue-50/30 hover:border-blue-300 transition-all flex flex-col justify-between space-y-3">
                      <div className="space-y-1">
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-900">
                          {plan.dataAllowance}
                        </span>
                        <h4 className="text-xs font-black text-slate-900 mt-1">{plan.destination}</h4>
                        <p className="text-[11px] text-slate-600">{plan.validityDays} Days Validity • {plan.carrier}</p>
                      </div>

                      <div className="pt-2 border-t border-blue-200/80 flex items-center justify-between">
                        <span className="text-sm font-black font-mono text-slate-900">
                          {formatCurrency(convertCurrency(plan.sellingPriceUSD, 'USD', currency), currency)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleQuickAddOptionalEsim(plan)}
                          className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer flex items-center space-x-1 shadow-2xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add eSIM</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 7: REVIEW & FEASIBILITY */}
          {activeStepId === 7 && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6 animate-fadeIn">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-900">Step 7: Review & Feasibility</h2>
                    <p className="text-xs text-slate-500">Live feasibility diagnostics, route coherence, and chronological day-by-day itinerary validation.</p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200">
                  Step 7 of 8
                </span>
              </div>

              {/* Feasibility Score Card */}
              <div className="p-5 rounded-2xl bg-slate-900 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase text-[#00E5C0] tracking-wider">
                    Feasibility & Operational Readiness Score
                  </span>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-3xl font-black font-mono text-white">{feasibility.score}</span>
                    <span className="text-slate-400 text-sm font-bold">/ 10.0</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase ${
                      feasibility.status === 'EXCELLENT' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                    }`}>
                      {feasibility.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Analyzed across hotel allocations, airport transit buffers, sightseeing densities, and child policies.
                  </p>
                </div>
              </div>

              {/* Warnings List with Direct Edit Buttons */}
              {feasibility.warnings.length > 0 && (
                <div className="space-y-2.5">
                  <span className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                    Operational Warnings & Recommendations:
                  </span>
                  {feasibility.warnings.map((w, idx) => (
                    <div key={idx} className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-between text-xs text-amber-900">
                      <div className="flex items-center space-x-2 pr-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>{w.message}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const msgLower = w.message.toLowerCase();
                          if (msgLower.includes('hotel') || msgLower.includes('accommodation')) {
                            setActiveStepId(3);
                          } else if (msgLower.includes('sightseeing') || msgLower.includes('tour') || msgLower.includes('experiences') || msgLower.includes('activit') || msgLower.includes('transfer') || msgLower.includes('rail') || msgLower.includes('transit')) {
                            setActiveStepId(4);
                          } else if (msgLower.includes('visa') || msgLower.includes('ancillary')) {
                            setActiveStepId(5);
                          } else if (msgLower.includes('optional') || msgLower.includes('insurance') || msgLower.includes('esim')) {
                            setActiveStepId(6);
                          } else {
                            setActiveStepId(2);
                          }
                        }}
                        className="px-3 py-1 bg-amber-700 text-white rounded-lg font-bold shrink-0 hover:bg-amber-800 cursor-pointer"
                      >
                        Edit Step →
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Itinerary Summary Snapshot */}
              <div className="space-y-3">
                <span className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                  Itinerary Snapshot:
                </span>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Destinations</span>
                    <span className="font-bold text-slate-900">{routeHubs.length} City Hubs</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Hotels & Stays</span>
                    <span className="font-bold text-slate-900">{hotelItems.length} Hotels</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Activities & Products</span>
                    <span className="font-bold text-slate-900">{activityItems.length + groundLogisticsItems.length} Experiences</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Visa & Ancillary</span>
                    <span className="font-bold text-slate-900">{visaItems.length} Services</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Optional Services</span>
                    <span className="font-bold text-slate-900">{addonItems.length} Options</span>
                  </div>
                </div>
              </div>

              {/* Chronological Day-by-Day Itinerary & Schedule Review */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                      Chronological Day-by-Day Itinerary Review ({calendarDays.length} Days)
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Complete daily service agenda across accommodations, ground logistics, activities, and ancillary services.
                    </p>
                  </div>
                  <div className="text-xs text-slate-500 font-medium">
                    {items.length} Total Services Scheduled
                  </div>
                </div>

                {/* Hub Filter Tabs */}
                <div className="flex items-center flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedHubFilter('ALL')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      selectedHubFilter === 'ALL'
                        ? 'bg-slate-900 text-[#00E5C0] shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    All Days ({calendarDays.length})
                  </button>
                  {routeHubs.map(h => (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => setSelectedHubFilter(h.hubName)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        selectedHubFilter === h.hubName
                          ? 'bg-slate-900 text-[#00E5C0] shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      📍 {h.hubName} ({h.nights}n)
                    </button>
                  ))}
                </div>

                {/* Day Cards */}
                <div className="space-y-3">
                  {daySlots
                    .filter(slot => selectedHubFilter === 'ALL' || slot.hub?.hubName === selectedHubFilter)
                    .map(slot => {
                      const dayItems = items.filter(it => it.travelDate === slot.dateString);
                      const dayAccommodations = dayItems.filter(it => (it.product.category || '').toLowerCase().includes('hotel') || (it.product.category || '').toLowerCase().includes('accommodation') || it.isManualHotel);
                      const dayTransfers = dayItems.filter(it => (it.product as any).isTransfer || (it.product.category || '').toLowerCase().includes('transfer') || (it.product.category || '').toLowerCase().includes('transport') || isRailQuoteItem(it));
                      const dayActivities = dayItems.filter(it => !dayAccommodations.includes(it) && !dayTransfers.includes(it) && !visaItems.includes(it) && !addonItems.includes(it));
                      const dayAncillaryItems = dayItems.filter(it => visaItems.includes(it) || addonItems.includes(it));
                      const dayTotalSelling = dayItems.reduce((acc, it) => acc + (it.calculation?.finalTotalSellingPrice || 0), 0);

                      return (
                        <div key={slot.dayNumber} className="bg-slate-50/70 rounded-2xl border border-slate-200 p-4 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200/80">
                            <div className="flex items-center space-x-2.5">
                              <span className="w-8 h-8 rounded-xl bg-slate-900 text-white font-black text-xs flex items-center justify-center font-mono">
                                D{slot.dayNumber}
                              </span>
                              <div className="flex items-center space-x-2">
                                <span className="font-bold text-xs text-slate-900">{slot.dayOfWeek}, {slot.formattedDate}</span>
                                {slot.hub && (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                                    📍 {slot.hub.hubName}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center space-x-3">
                              {dayTotalSelling > 0 && (
                                <span className="text-xs font-mono font-bold text-slate-700">
                                  Day Total: {formatCurrency(dayTotalSelling, currency)}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => onOpenQuickAddProductModal(slot)}
                                className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 text-xs font-bold transition-all cursor-pointer flex items-center space-x-1 shadow-2xs"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add Experience</span>
                              </button>
                            </div>
                          </div>

                          {/* Day Theme Input */}
                          <div className="flex items-center space-x-2">
                            <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <input
                              type="text"
                              value={dayThemes[slot.dayNumber] || ''}
                              onChange={(e) => setDayThemes?.(prev => ({ ...prev, [slot.dayNumber]: e.target.value }))}
                              placeholder={`Day ${slot.dayNumber} Theme / Highlights (e.g. Arrival & City Discovery)`}
                              className="w-full text-xs font-medium text-slate-800 placeholder-slate-400 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-teal-500 transition-colors"
                            />
                          </div>

                          {dayItems.length === 0 ? (
                            <div className="p-3 rounded-xl bg-white border border-dashed border-slate-200 text-center text-xs text-slate-400">
                              No activities or services scheduled for this day yet.
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                              {dayAccommodations.map((it, idx) => (
                                <div key={idx} className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                                  <div className="flex items-center space-x-2 truncate">
                                    <Building2 className="w-4 h-4 text-teal-600 shrink-0" />
                                    <span className="font-bold text-slate-900 truncate">{getInventoryDisplayName(it)}</span>
                                  </div>
                                  <span className="text-[10px] font-mono text-slate-500 shrink-0 ml-2">
                                    {formatCurrency(it.calculation?.finalTotalSellingPrice || 0, currency)}
                                  </span>
                                </div>
                              ))}
                              {dayTransfers.map((it, idx) => (
                                <div key={idx} className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                                  <div className="flex items-center space-x-2 truncate">
                                    <Car className="w-4 h-4 text-teal-600 shrink-0" />
                                    <span className="font-bold text-slate-900 truncate">{getInventoryDisplayName(it)}</span>
                                  </div>
                                  <span className="text-[10px] font-mono text-slate-500 shrink-0 ml-2">
                                    {formatCurrency(it.calculation?.finalTotalSellingPrice || 0, currency)}
                                  </span>
                                </div>
                              ))}
                              {dayActivities.map((it, idx) => (
                                <div key={idx} className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                                  <div className="flex items-center space-x-2 truncate">
                                    <Compass className="w-4 h-4 text-teal-600 shrink-0" />
                                    <span className="font-bold text-slate-900 truncate">{getInventoryDisplayName(it)}</span>
                                  </div>
                                  <span className="text-[10px] font-mono text-slate-500 shrink-0 ml-2">
                                    {formatCurrency(it.calculation?.finalTotalSellingPrice || 0, currency)}
                                  </span>
                                </div>
                              ))}
                              {dayAncillaryItems.map((it, idx) => (
                                <div key={idx} className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                                  <div className="flex items-center space-x-2 truncate">
                                    <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
                                    <span className="font-bold text-slate-900 truncate">{getInventoryDisplayName(it)}</span>
                                  </div>
                                  <span className="text-[10px] font-mono text-slate-500 shrink-0 ml-2">
                                    {formatCurrency(it.calculation?.finalTotalSellingPrice || 0, currency)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 8: PRICING & MARGIN */}
          {activeStepId === 8 && (() => {
            const hotelsTotalSelling = hotelItems.reduce((sum, it) => sum + (it.calculation?.finalTotalSellingPrice || 0), 0);
            const activitiesTotalSelling = activityItems.reduce((sum, it) => sum + (it.calculation?.finalTotalSellingPrice || 0), 0);
            const transfersTotalSelling = groundLogisticsItems.reduce((sum, it) => sum + (it.calculation?.finalTotalSellingPrice || 0), 0);
            const visaTotalSelling = visaItems.reduce((sum, it) => sum + (it.calculation?.finalTotalSellingPrice || 0), 0);
            const optionalTotalSelling = addonItems.reduce((sum, it) => sum + (it.calculation?.finalTotalSellingPrice || 0), 0);

            const totalPax = Math.max(1, adultsCount + childrenCount + infantsCount);
            const marginPercentageValue = effectiveMarginType === 'PERCENTAGE' 
              ? effectiveMarginValue 
              : effectiveBasePrice > 0 
                ? Number(((effectiveMarginAmount / effectiveBasePrice) * 100).toFixed(1)) 
                : 0;

            const isNegativeMargin = (effectiveMarginValue || 0) < 0;
            const isHighMargin = effectiveMarginType === 'PERCENTAGE' && (effectiveMarginValue || 0) > 100;

            return (
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6 animate-fadeIn">
                {/* Step Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center">
                      <DollarSign className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-slate-900">Step 8: Pricing & Margin</h2>
                      <p className="text-xs text-slate-500">Authoritative system base pricing, partner agent margin controls, and quotation dispatch actions.</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200">
                      Step 8 of 8
                    </span>
                    {lastSavedTimestamp && (
                      <span className="text-[11px] font-medium text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
                        Auto-saved {lastSavedTimestamp}
                      </span>
                    )}
                  </div>
                </div>

                {/* 3 Core Commercial Architecture Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {/* CARD 1: SYSTEM BASE SELLING PRICE (AUTHORITATIVE) */}
                  <div className="bg-slate-50/80 rounded-2xl border border-slate-200 p-5 space-y-3.5 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-slate-200 text-slate-800">
                          <Lock className="w-3 h-3 text-slate-600" />
                          <span>Authoritative System Base</span>
                        </span>

                        {/* Currency Selector */}
                        <select
                          value={currency}
                          onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                          className="px-2 py-0.5 rounded-md bg-white border border-slate-300 text-xs font-bold text-slate-900 outline-none cursor-pointer"
                        >
                          {SUPPORTED_CURRENCIES.map(curr => (
                            <option key={curr.code} value={curr.code}>{curr.code} ({curr.symbol})</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <span className="text-[11px] font-bold text-slate-500 block">
                          Contracted Wholesale Base
                        </span>
                        <span className="text-2xl font-black font-mono text-slate-900">
                          {formatCurrency(effectiveBasePrice, currency)}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Calculated from wholesale inventory supplier tariffs, platform commercial markups, and taxes. Protected unmodifiable baseline.
                      </p>
                    </div>

                    {/* Breakdown List */}
                    <div className="pt-2 border-t border-slate-200/80 space-y-1 text-[11px] text-slate-600">
                      {hotelsTotalSelling > 0 && (
                        <div className="flex justify-between">
                          <span>🏨 Hotels & Accommodation Stays:</span>
                          <span className="font-mono font-bold text-slate-800">{formatCurrency(hotelsTotalSelling, currency)}</span>
                        </div>
                      )}
                      {activitiesTotalSelling > 0 && (
                        <div className="flex justify-between">
                          <span>🎡 Activities & Experiences:</span>
                          <span className="font-mono font-bold text-slate-800">{formatCurrency(activitiesTotalSelling, currency)}</span>
                        </div>
                      )}
                      {transfersTotalSelling > 0 && (
                        <div className="flex justify-between">
                          <span>🚗 Ground & Rail Logistics:</span>
                          <span className="font-mono font-bold text-slate-800">{formatCurrency(transfersTotalSelling, currency)}</span>
                        </div>
                      )}
                      {visaTotalSelling > 0 && (
                        <div className="flex justify-between">
                          <span>📋 Visa & Ancillary Services:</span>
                          <span className="font-mono font-bold text-slate-800">{formatCurrency(visaTotalSelling, currency)}</span>
                        </div>
                      )}
                      {optionalTotalSelling > 0 && (
                        <div className="flex justify-between">
                          <span>✨ Optional Services:</span>
                          <span className="font-mono font-bold text-slate-800">{formatCurrency(optionalTotalSelling, currency)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* CARD 2: ADDITIONAL AGENT MARGIN (CONTROLS) */}
                  <div className="bg-white rounded-2xl border-2 border-teal-200/80 p-5 space-y-3.5 shadow-2xs flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-teal-50 text-teal-800 border border-teal-200">
                          <Percent className="w-3 h-3 text-teal-600" />
                          <span>Partner Margin Controls</span>
                        </span>

                        {/* Mode Switcher */}
                        <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px]">
                          <button
                            type="button"
                            onClick={() => handleUpdateMarginType('PERCENTAGE')}
                            className={`px-2 py-1 rounded-md font-bold transition-all cursor-pointer ${
                              effectiveMarginType === 'PERCENTAGE'
                                ? 'bg-slate-900 text-[#00E5C0] shadow-2xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            %
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateMarginType('FIXED')}
                            className={`px-2 py-1 rounded-md font-bold transition-all cursor-pointer ${
                              effectiveMarginType === 'FIXED'
                                ? 'bg-slate-900 text-[#00E5C0] shadow-2xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {currency}
                          </button>
                        </div>
                      </div>

                      {/* Margin Input Field */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-600 block">
                          {effectiveMarginType === 'PERCENTAGE' ? 'Agency Markup Percentage (%)' : `Fixed Margin Amount (${currency})`}
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            step={effectiveMarginType === 'PERCENTAGE' ? '0.5' : '10'}
                            value={Number.isNaN(effectiveMarginValue) ? 0 : (effectiveMarginValue ?? 0)}
                            onChange={(e) => handleUpdateMarginValue(parseFloat(e.target.value) || 0)}
                            className={`w-full text-base font-black font-mono text-slate-900 bg-slate-50 border rounded-xl px-3 py-2 outline-none transition-all ${
                              isNegativeMargin ? 'border-rose-400 bg-rose-50' : 'border-slate-300 focus:border-teal-500 focus:bg-white'
                            }`}
                            placeholder="0"
                          />
                          <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400 font-mono">
                            {effectiveMarginType === 'PERCENTAGE' ? '%' : currency}
                          </span>
                        </div>
                        {isNegativeMargin && (
                          <p className="text-[10px] font-bold text-rose-600">Margin value cannot be negative.</p>
                        )}
                        {isHighMargin && (
                          <p className="text-[10px] font-bold text-amber-600">Markup exceeds 100% of base wholesale price.</p>
                        )}
                      </div>

                      {/* Quick Presets */}
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Quick Presets</span>
                        <div className="flex flex-wrap gap-1">
                          {effectiveMarginType === 'PERCENTAGE' ? (
                            [5, 10, 12, 15, 20].map(pct => (
                              <button
                                key={pct}
                                type="button"
                                onClick={() => handleUpdateMarginValue(pct)}
                                className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                                  effectiveMarginValue === pct
                                    ? 'bg-teal-600 text-white'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                }`}
                              >
                                +{pct}%
                              </button>
                            ))
                          ) : (
                            [100, 250, 500, 1000].map(amt => (
                              <button
                                key={amt}
                                type="button"
                                onClick={() => handleUpdateMarginValue(amt)}
                                className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                                  effectiveMarginValue === amt
                                    ? 'bg-teal-600 text-white'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                }`}
                              >
                                +{formatCurrency(amt, currency)}
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Calculated Margin Subtotal */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Net Retained Margin:</span>
                      <span className="font-mono font-black text-emerald-700">
                        + {formatCurrency(effectiveMarginAmount, currency)} ({marginPercentageValue}%)
                      </span>
                    </div>
                  </div>

                  {/* CARD 3: FINAL CUSTOMER SELLING PRICE (CLIENT-FACING) */}
                  <div className="bg-slate-900 text-white rounded-2xl border border-slate-800 p-5 space-y-3.5 shadow-lg flex flex-col justify-between relative overflow-hidden">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-[#00E5C0] border border-[#00E5C0]/30">
                          <Check className="w-3 h-3 text-[#00E5C0]" />
                          <span>Final Customer Selling Price</span>
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {totalPax} Guests
                        </span>
                      </div>

                      <div>
                        <span className="text-[11px] font-bold text-slate-400 block">
                          Client-Facing Total Proposal Price
                        </span>
                        <span className="text-3xl font-black font-mono text-[#00E5C0] block">
                          {formatCurrency(effectiveFinalPrice, currency)}
                        </span>
                        <span className="text-xs font-mono text-slate-300 font-medium mt-0.5 block">
                          {formatCurrency(Math.round(effectiveFinalPrice / totalPax), currency)} / Traveler
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-[11px] text-slate-300 space-y-1 font-mono">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Base Selling:</span>
                          <span>{formatCurrency(effectiveBasePrice, currency)}</span>
                        </div>
                        <div className="flex justify-between text-[#00E5C0]">
                          <span>Partner Margin:</span>
                          <span>+ {formatCurrency(effectiveMarginAmount, currency)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                      <span>✓ Synchronized with Itinerary</span>
                      <span>All Inclusions Confirmed</span>
                    </div>
                  </div>
                </div>

                {/* COMMERCIAL SUMMARY & BOOKING CONVERSION */}
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                      Commercial Pricing Ready
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Use the top header action bar to save draft, share via WhatsApp, send email, download PDF, or generate the quotation preview.
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    {lastSavedTimestamp && (
                      <span className="text-[11px] text-slate-400 font-medium">
                        Last saved: {lastSavedTimestamp}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={onConvertBooking}
                      className="px-4 py-2 rounded-xl bg-[#00C6A6] hover:bg-[#00B598] text-slate-950 text-xs font-black transition-all cursor-pointer flex items-center justify-center space-x-1.5 shadow-xs"
                    >
                      <BookmarkCheck className="w-4 h-4" />
                      <span>Convert to Booking</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Navigation Controls: Previous / Next Step */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <button
              type="button"
              disabled={activeStepId === 1}
              onClick={() => setActiveStepId(Math.max(1, activeStepId - 1))}
              className="px-4 py-2.5 rounded-2xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-1.5 shadow-2xs"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>← Previous Step</span>
            </button>

            <span className="text-xs font-bold text-slate-400 hidden sm:inline">
              Step {activeStepId} of 8: {stepsList.find(s => s.id === activeStepId)?.name}
            </span>

            {activeStepId < 8 ? (
              <button
                type="button"
                onClick={() => setActiveStepId(activeStepId + 1)}
                className="px-5 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-[#00E5C0] text-xs font-black transition-all cursor-pointer flex items-center space-x-1.5 shadow-md"
              >
                <span>Next: {stepsList.find(s => s.id === activeStepId + 1)?.name}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <span className="px-4 py-2 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>All 8 Steps Configured</span>
              </span>
            )}
          </div>
        </main>
      </div>

      {/* ========================================================================= */}
      {/* REAL-TIME FIXED STICKY PRICING SUMMARY BAR AT BOTTOM (INFORMATIONAL ONLY) */}
      {/* ========================================================================= */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md text-white border-t border-slate-800 px-4 sm:px-8 py-3 shadow-2xl">
        <div className="w-full max-w-[1920px] mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Left: Summary Stats */}
          <div className="flex items-center space-x-4">
            <div>
              <span className="text-[10px] font-black uppercase text-teal-400 tracking-wider block">
                Total Client Price ({currency})
              </span>
              <span className="text-xl font-black font-mono text-white">
                {formatCurrency(effectiveFinalPrice, currency)}
              </span>
            </div>

            <div className="hidden md:flex items-center space-x-2 text-xs text-slate-400 border-l border-slate-800 pl-4">
              <span>{adultsCount + childrenCount + infantsCount} Pax</span>
              <span>•</span>
              <span>{tripNights} Nights</span>
              <span>•</span>
              <span>{routeHubs.length} Cities</span>
              <span>•</span>
              <span>{items.length} Included Items</span>
            </div>
          </div>

          {/* Right: Per-Traveler Breakdown */}
          <div className="flex items-center space-x-3 text-xs text-slate-300 font-mono">
            <span>
              {formatCurrency(Math.round(effectiveFinalPrice / Math.max(1, adultsCount + childrenCount + infantsCount)), currency)} / Traveler
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DEDICATED TRANSFER CONFIGURATOR MODAL */}
      {/* ========================================================================= */}
      {isTransferConfiguratorOpen && selectedTransferProductForConfig && (
        <TransferConfigurator
          isOpen={isTransferConfiguratorOpen}
          itemOrProduct={editingTransferQuoteItem || selectedTransferProductForConfig}
          portalOrigin="B2B_QUOTE_BUILDER"
          existingQuoteItemId={editingTransferQuoteItemId}
          initialTravelDate={editingTransferQuoteItem?.travelDate || configuratorMovement?.suggestedDate || startDate}
          initialAdults={editingTransferQuoteItem?.pax?.adults ?? adultsCount}
          initialChildren={editingTransferQuoteItem?.pax?.children ?? childrenCount}
          initialInfants={editingTransferQuoteItem?.pax?.infants ?? infantsCount}
          initialServiceTime={editingTransferQuoteItem?.serviceTime || '10:00 AM'}
          initialNotes={editingTransferQuoteItem?.notes || (configuratorMovement ? `${configuratorMovement.fromName} ➔ ${configuratorMovement.toName}` : '')}
          onClose={() => {
            setIsTransferConfiguratorOpen(false);
            setSelectedTransferProductForConfig(null);
            setEditingTransferQuoteItem(null);
            setEditingTransferQuoteItemId(undefined);
            setConfiguratorMovement(null);
          }}
          onSuccess={() => {
            setIsTransferConfiguratorOpen(false);
            setSelectedTransferProductForConfig(null);
            setEditingTransferQuoteItem(null);
            setEditingTransferQuoteItemId(undefined);
            setConfiguratorMovement(null);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* CUSTOM TRANSFER SERVICE MODAL (For routes without master products) */}
      {/* ========================================================================= */}
      {isCustomTransferModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh] animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-teal-900 to-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-[#00E5C0]/20 border border-[#00E5C0]/30 text-[#00E5C0] flex items-center justify-center">
                  <Car className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-wide">Add Custom Transfer Service</h3>
                  <p className="text-[11px] text-teal-300">
                    Bespoke ground logistics for routes with custom supplier rates
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCustomTransferModalOpen(false)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Transfer Service / Route Name *</label>
                <input
                  type="text"
                  value={customTransferForm.routeName}
                  onChange={(e) => setCustomTransferForm(prev => ({ ...prev, routeName: e.target.value }))}
                  placeholder="e.g. Hiroshima Station ➔ Grand Prince Hotel Executive Chauffeur"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 outline-none focus:bg-white focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Pickup Location / Gateway</label>
                  <input
                    type="text"
                    value={customTransferForm.fromLocation}
                    onChange={(e) => setCustomTransferForm(prev => ({ ...prev, fromLocation: e.target.value }))}
                    placeholder="e.g. Hiroshima Station Shinkansen Exit"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none focus:bg-white focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Drop-off Destination / Hotel</label>
                  <input
                    type="text"
                    value={customTransferForm.toLocation}
                    onChange={(e) => setCustomTransferForm(prev => ({ ...prev, toLocation: e.target.value }))}
                    placeholder="e.g. Grand Prince Hotel Hiroshima"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none focus:bg-white focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Service Date</label>
                  <input
                    type="date"
                    value={customTransferForm.travelDate}
                    onChange={(e) => setCustomTransferForm(prev => ({ ...prev, travelDate: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none focus:bg-white focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Scheduled Time</label>
                  <input
                    type="text"
                    value={customTransferForm.serviceTime}
                    onChange={(e) => setCustomTransferForm(prev => ({ ...prev, serviceTime: e.target.value }))}
                    placeholder="e.g. 10:30 AM"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none focus:bg-white focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Vehicle Class</label>
                  <select
                    value={customTransferForm.vehicleType}
                    onChange={(e) => setCustomTransferForm(prev => ({ ...prev, vehicleType: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none focus:bg-white focus:border-teal-500 cursor-pointer"
                  >
                    <option value="Executive MPV / Van (Toyota Alphard)">Executive MPV (Alphard)</option>
                    <option value="Executive Sedan (Lexus / Crown)">Executive Sedan</option>
                    <option value="Minibus / Sprinter (HiAce 10 Pax)">Minibus (HiAce 10 Pax)</option>
                    <option value="Luxury Coach (20+ Pax)">Luxury Coach</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Max Pax Capacity</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={customTransferForm.maxPax ?? 4}
                    onChange={(e) => setCustomTransferForm(prev => ({ ...prev, maxPax: Number(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none focus:bg-white focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Max Luggage Bags</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={customTransferForm.maxLuggage ?? 4}
                    onChange={(e) => setCustomTransferForm(prev => ({ ...prev, maxLuggage: Number(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none focus:bg-white focus:border-teal-500"
                  />
                </div>
              </div>

              {/* Pricing calculation row */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Wholesale Net Cost</label>
                  <div className="flex items-center space-x-1">
                    <span className="text-xs font-bold text-slate-500 font-mono">{customTransferForm.currency}</span>
                    <input
                      type="number"
                      min={0}
                      value={customTransferForm.netCost ?? 0}
                      onChange={(e) => setCustomTransferForm(prev => ({ ...prev, netCost: Number(e.target.value) || 0 }))}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-900 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Markup %</label>
                  <div className="flex items-center space-x-1">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={customTransferForm.markupPercent ?? 0}
                      onChange={(e) => setCustomTransferForm(prev => ({ ...prev, markupPercent: Number(e.target.value) || 0 }))}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-900 font-mono"
                    />
                    <span className="text-xs font-bold text-slate-500">%</span>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Client Selling Price</div>
                  <div className="text-sm font-black text-teal-700 font-mono">
                    {formatCurrency(Math.round(customTransferForm.netCost * (1 + customTransferForm.markupPercent / 100)), customTransferForm.currency)}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Dispatch Notes & Special Requests</label>
                <textarea
                  rows={2}
                  value={customTransferForm.specialNotes}
                  onChange={(e) => setCustomTransferForm(prev => ({ ...prev, specialNotes: e.target.value }))}
                  placeholder="e.g. Flight JL044 tracking, driver meets at central gate with client nameboard..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none focus:bg-white focus:border-teal-500"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setIsCustomTransferModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-white hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCustomTransfer}
                disabled={!customTransferForm.routeName}
                className="px-5 py-2 rounded-xl bg-[#00C6A6] hover:bg-[#00B598] disabled:opacity-50 text-slate-950 text-xs font-black transition-all cursor-pointer shadow-xs flex items-center space-x-1.5"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Confirm & Add to Quotation</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
