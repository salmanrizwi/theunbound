import React, { useState, useMemo, useEffect } from 'react';
import { 
  ShieldCheck, 
  Globe, 
  Sparkles, 
  Plane, 
  Plus, 
  Trash2, 
  Check, 
  Info, 
  Clock, 
  Users, 
  FileCheck, 
  ChevronDown, 
  ChevronUp, 
  Sliders, 
  DollarSign,
  Luggage,
  Shield,
  Smartphone,
  Award,
  CheckCircle2,
  AlertCircle,
  Search,
  ExternalLink,
  X,
  AlertTriangle,
  Calendar
} from 'lucide-react';
import { 
  Product, 
  CurrencyCode, 
  QuoteItem, 
  Destination, 
  VisaProduct,
  TravelProtectionPlan,
  VipGroundService,
  ConnectivityPlan
} from '../../types';
import { formatCurrency, convertCurrency } from '../../services/pricingEngine';
import { AppDatabase } from '../../services/db';
import { VisaServiceAndFacilitationConfigurator } from '../Configurators/VisaServiceAndFacilitationConfigurator';

export interface VisaServicesAndFacilitationSectionProps {
  currentDestination: Destination;
  currency: CurrencyCode;
  items: QuoteItem[];
  adultsCount: number;
  childrenCount: number;
  infantsCount: number;
  tripNights: number;
  startDate: string;
  onAddProduct: (product: Product, options?: any) => void;
  onRemoveProduct: (itemId: string) => void;
  onOpenVisaPickerModal: () => void;
  onOpenEditItem?: (item: QuoteItem) => void;
  activeOptionNumber?: number;
}

export const VisaServicesAndFacilitationSection: React.FC<VisaServicesAndFacilitationSectionProps> = ({
  currentDestination,
  currency,
  items,
  adultsCount,
  childrenCount,
  infantsCount,
  tripNights,
  startDate,
  onAddProduct,
  onRemoveProduct,
  onOpenVisaPickerModal,
  onOpenEditItem,
  activeOptionNumber = 1
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'ALL' | 'VISA' | 'PROTECTION' | 'GROUND'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDestinationFilter, setSelectedDestinationFilter] = useState<string>('ALL');
  const [selectedVisaTypeFilter, setSelectedVisaTypeFilter] = useState<string>('ALL');
  const [selectedProviderFilter, setSelectedProviderFilter] = useState<string>('ALL');

  // Active configurator states
  const [activeConfiguringVisa, setActiveConfiguringVisa] = useState<VisaProduct | null>(null);
  const [activeConfiguringProtection, setActiveConfiguringProtection] = useState<TravelProtectionPlan | null>(null);
  const [activeConfiguringVip, setActiveConfiguringVip] = useState<VipGroundService | null>(null);
  const [activeConfiguringConnectivity, setActiveConfiguringConnectivity] = useState<ConnectivityPlan | null>(null);
  const [deactivatedServiceNotice, setDeactivatedServiceNotice] = useState<string | null>(null);

  const totalPayingPax = Math.max(1, adultsCount + childrenCount);
  const totalTripDays = Math.max(1, tripNights + 1);

  // Live database subscription for real-time sync with CMS Admin (Firebase / Firestore)
  const db = AppDatabase.getInstance();
  const [dbTick, setDbTick] = useState<number>(0);

  useEffect(() => {
    return db.subscribe(() => setDbTick(t => t + 1));
  }, [db]);

  // -------------------------------------------------------------------------
  // 1. FILTER QUOTE ITEMS BELONGING TO VISA & ANCILLARY SERVICES
  // -------------------------------------------------------------------------
  const visaItemsInQuote = useMemo(() => {
    return items.filter(it => 
      it.service_type === 'VISA' ||
      it.category === 'Visa & Ancillary Services' ||
      it.product.sku?.startsWith('VSA-') ||
      it.product.sku?.startsWith('VISA-') ||
      it.product.productType === 'Visa Service' ||
      it.product.subcategory === 'Visa Facilitation' ||
      (it.product.category === 'Travel Services' && it.product.name?.toLowerCase().includes('visa')) ||
      it.product.name?.toLowerCase().includes('visa')
    );
  }, [items]);

  const protectionItemsInQuote = useMemo(() => {
    return items.filter(it => 
      it.service_type === 'TRAVEL_PROTECTION' ||
      it.product.subcategory === 'Travel Insurance' || 
      it.product.productType === 'Travel Protection' ||
      it.product.name.toLowerCase().includes('insurance') ||
      it.product.name.toLowerCase().includes('protection') ||
      it.product.sku?.startsWith('INS-')
    );
  }, [items]);

  const groundServicesInQuote = useMemo(() => {
    return items.filter(it => 
      it.service_type === 'VIP_GROUND' ||
      it.service_type === 'CONNECTIVITY' ||
      it.product.subcategory === 'Ground VIP Services' ||
      it.product.subcategory === 'eSIM Connectivity' ||
      it.product.productType === '5G Connectivity' ||
      it.product.sku?.startsWith('VIP-') ||
      it.product.sku?.startsWith('ESIM-') ||
      it.product.name.toLowerCase().includes('meet & assist') ||
      it.product.name.toLowerCase().includes('fast track') ||
      it.product.name.toLowerCase().includes('lounge') ||
      it.product.name.toLowerCase().includes('porter') ||
      it.product.name.toLowerCase().includes('concierge') ||
      it.product.name.toLowerCase().includes('esim')
    );
  }, [items]);

  const allSectionItemsInQuote = useMemo(() => {
    // Unique by item id
    const map = new Map<string, QuoteItem>();
    [...visaItemsInQuote, ...protectionItemsInQuote, ...groundServicesInQuote].forEach(it => {
      map.set(it.id, it);
    });
    return Array.from(map.values());
  }, [visaItemsInQuote, protectionItemsInQuote, groundServicesInQuote]);

  const sectionTotalSelling = useMemo(() => {
    return allSectionItemsInQuote.reduce((sum, it) => sum + (it.calculation?.finalTotalSellingPrice || 0), 0);
  }, [allSectionItemsInQuote]);

  // -------------------------------------------------------------------------
  // 2. QUERY REAL PRODUCTION PRODUCTS FROM FIREBASE / FIRESTORE (NO DUMMY DATA)
  // -------------------------------------------------------------------------
  const realVisas = useMemo(() => {
    try {
      const all = db.getVisas() || [];
      return all.filter(v => v.status === 'ACTIVE' || !v.status);
    } catch (e) {
      console.error('Error loading visas from database:', e);
      return [];
    }
  }, [db, dbTick]);

  const realProtectionPlans = useMemo(() => {
    try {
      const all = db.getTravelProtectionPlans() || [];
      return all.filter(p => p.status === 'ACTIVE');
    } catch (e) {
      console.error('Error loading travel protection plans from database:', e);
      return [];
    }
  }, [db, dbTick]);

  const realVipServices = useMemo(() => {
    try {
      const all = db.getVipGroundServices() || [];
      return all.filter(s => s.status === 'ACTIVE');
    } catch (e) {
      console.error('Error loading VIP ground services from database:', e);
      return [];
    }
  }, [db, dbTick]);

  const realConnectivityPlans = useMemo(() => {
    try {
      const all = db.getConnectivityPlans() || [];
      return all.filter(c => c.status === 'ACTIVE');
    } catch (e) {
      console.error('Error loading connectivity plans from database:', e);
      return [];
    }
  }, [db, dbTick]);

  // Dynamic filter sets based strictly on production master inventory (no hardcoded filters)
  const availableDestinations = useMemo(() => {
    const set = new Set<string>();
    realVisas.forEach(v => v.country && set.add(v.country));
    realProtectionPlans.forEach(p => p.coverageArea && set.add(p.coverageArea));
    return Array.from(set).sort();
  }, [realVisas, realProtectionPlans]);

  const availableVisaTypes = useMemo(() => {
    const set = new Set<string>();
    realVisas.forEach(v => {
      if (v.entryType) set.add(v.entryType);
    });
    return Array.from(set).sort();
  }, [realVisas]);

  const availableProviders = useMemo(() => {
    const set = new Set<string>();
    realProtectionPlans.forEach(p => p.provider && set.add(p.provider));
    realVipServices.forEach(s => s.supplierName && set.add(s.supplierName));
    return Array.from(set).sort();
  }, [realProtectionPlans, realVipServices]);

  // Destination relevance & search filter helpers
  const destinationLower = (currentDestination?.name || '').toLowerCase();
  const searchLower = searchQuery.trim().toLowerCase();

  const filteredVisas = useMemo(() => {
    return realVisas.filter(visa => {
      const matchesSearch = !searchLower || 
        visa.country.toLowerCase().includes(searchLower) ||
        visa.visaType.toLowerCase().includes(searchLower) ||
        (visa.description || '').toLowerCase().includes(searchLower) ||
        visa.id.toLowerCase().includes(searchLower);

      const matchesDest = selectedDestinationFilter === 'ALL' || visa.country === selectedDestinationFilter;
      const matchesVisaType = selectedVisaTypeFilter === 'ALL' || visa.entryType === selectedVisaTypeFilter;

      return matchesSearch && matchesDest && matchesVisaType;
    });
  }, [realVisas, searchLower, selectedDestinationFilter, selectedVisaTypeFilter]);

  const filteredProtectionPlans = useMemo(() => {
    return realProtectionPlans.filter(plan => {
      const matchesSearch = !searchLower ||
        plan.serviceName.toLowerCase().includes(searchLower) ||
        plan.provider.toLowerCase().includes(searchLower) ||
        plan.coverageArea.toLowerCase().includes(searchLower) ||
        (plan.customerDescription || '').toLowerCase().includes(searchLower) ||
        plan.id.toLowerCase().includes(searchLower);

      const matchesDest = selectedDestinationFilter === 'ALL' || plan.coverageArea.toLowerCase().includes(selectedDestinationFilter.toLowerCase());
      const matchesProvider = selectedProviderFilter === 'ALL' || plan.provider === selectedProviderFilter;

      return matchesSearch && matchesDest && matchesProvider;
    });
  }, [realProtectionPlans, searchLower, selectedDestinationFilter, selectedProviderFilter]);

  const filteredVipServices = useMemo(() => {
    return realVipServices.filter(svc => {
      const matchesSearch = !searchLower ||
        svc.name.toLowerCase().includes(searchLower) ||
        svc.supplierName.toLowerCase().includes(searchLower) ||
        svc.serviceType.toLowerCase().includes(searchLower) ||
        (svc.shortDesc || '').toLowerCase().includes(searchLower) ||
        svc.id.toLowerCase().includes(searchLower);

      const matchesProvider = selectedProviderFilter === 'ALL' || svc.supplierName === selectedProviderFilter;

      return matchesSearch && matchesProvider;
    });
  }, [realVipServices, searchLower, selectedProviderFilter]);

  const filteredConnectivityPlans = useMemo(() => {
    return realConnectivityPlans.filter(plan => {
      const matchesSearch = !searchLower ||
        plan.name.toLowerCase().includes(searchLower) ||
        plan.dataAllowance.toLowerCase().includes(searchLower) ||
        plan.coverageZone.toLowerCase().includes(searchLower) ||
        plan.id.toLowerCase().includes(searchLower);

      const matchesDest = selectedDestinationFilter === 'ALL' || plan.coverageZone.toLowerCase().includes(selectedDestinationFilter.toLowerCase());

      return matchesSearch && matchesDest;
    });
  }, [realConnectivityPlans, searchLower, selectedDestinationFilter]);

  const totalActiveProductsCount = filteredVisas.length + filteredProtectionPlans.length + filteredVipServices.length + filteredConnectivityPlans.length;

  // -------------------------------------------------------------------------
  // 3. EDIT ITEM HANDLER WITH HISTORICAL DEACTIVATION CHECK
  // -------------------------------------------------------------------------
  const handleEditQuoteItem = (item: QuoteItem) => {
    const masterId = item.master_product_id || item.product.id;
    
    // Check if it's a Visa
    const visa = db.getVisas().find(v => v.id === masterId || v.id === (item.metadata as any)?.visaProductId);
    if (visa) {
      if (visa.status === 'ACTIVE' || !visa.status) {
        setActiveConfiguringVisa(visa);
        return;
      } else {
        setDeactivatedServiceNotice(`The visa product "${visa.country} ${visa.visaType}" is no longer active in master inventory. Historical quotation configuration has been preserved.`);
        return;
      }
    }

    // Check if it's Travel Protection
    const protection = db.getTravelProtectionPlans().find(p => p.id === masterId);
    if (protection) {
      if (protection.status === 'ACTIVE') {
        setActiveConfiguringProtection(protection);
        return;
      } else {
        setDeactivatedServiceNotice(`The travel protection plan "${protection.serviceName}" is no longer active. Historical quotation configuration has been preserved.`);
        return;
      }
    }

    // Check if it's VIP Ground Service
    const vip = db.getVipGroundServices().find(s => s.id === masterId);
    if (vip) {
      if (vip.status === 'ACTIVE') {
        setActiveConfiguringVip(vip);
        return;
      } else {
        setDeactivatedServiceNotice(`The VIP ground service "${vip.name}" is no longer active. Historical quotation configuration has been preserved.`);
        return;
      }
    }

    // Check if it's Connectivity Plan
    const conn = db.getConnectivityPlans().find(c => c.id === masterId);
    if (conn) {
      if (conn.status === 'ACTIVE') {
        setActiveConfiguringConnectivity(conn);
        return;
      } else {
        setDeactivatedServiceNotice(`The connectivity plan "${conn.name}" is no longer active. Historical quotation configuration has been preserved.`);
        return;
      }
    }

    // Fallback: if caller provided onOpenEditItem
    if (onOpenEditItem) {
      onOpenEditItem(item);
    }
  };

  // -------------------------------------------------------------------------
  // 4. ADD TRAVEL PROTECTION PLAN (REAL PRODUCT FLOW)
  // -------------------------------------------------------------------------
  const handleConfirmAddProtection = (plan: TravelProtectionPlan, coverageDays: number, adults: number, children: number) => {
    const dailyPrice = plan.sellingPricePerDay > 0 ? plan.sellingPricePerDay : (plan.sellingPricePerTrip > 0 ? plan.sellingPricePerTrip / coverageDays : 0);
    if (dailyPrice <= 0) return;
    const childDailyPrice = Math.round(dailyPrice * 0.7);
    const totalAdultCost = dailyPrice * coverageDays;
    const totalChildCost = childDailyPrice * coverageDays;
    const totalSellingUSD = (totalAdultCost * adults) + (totalChildCost * children);

    const convertedSellingPrice = convertCurrency(totalSellingUSD, plan.currency || 'USD', currency);

    const product: Product = {
      id: plan.id,
      sku: `INS-${plan.id.toUpperCase().slice(0, 10)}`,
      destinationId: currentDestination.id,
      destinationName: currentDestination.name,
      country: currentDestination.name,
      city: plan.coverageArea,
      productType: 'Travel Protection',
      name: `${plan.serviceName} (${coverageDays} Days)`,
      shortDescription: plan.customerDescription || `${plan.coverageArea} Comprehensive Medical & Travel Cover. Provider: ${plan.provider}.`,
      longDescription: `Full comprehensive travel protection covering ${adults} Adults and ${children} Children for ${coverageDays} days in ${currentDestination.name}. Medical Coverage: $${plan.medicalCoverageAmount.toLocaleString()} USD. Inclusions: ${plan.inclusions.join(', ')}.`,
      supplierId: 'sup-insurance-canonical',
      supplierName: plan.provider,
      supplierProductCode: `INS-${plan.id}`,
      category: 'Visa & Ancillary Services',
      subcategory: 'Travel Insurance',
      duration: `${coverageDays} Days`,
      operatingDays: ['All Days'],
      operatingHours: '24/7 Coverage',
      adultNetPrice: plan.netCostPerDay * coverageDays,
      childNetPrice: Math.round(plan.netCostPerDay * 0.7) * coverageDays,
      infantNetPrice: 0,
      currency: plan.currency || 'USD',
      defaultMarkupPercent: 30,
      taxPercent: 0,
      commissionPercent: 15,
      serviceFeeFixed: 0,
      sellingPriceStartingFrom: dailyPrice,
      season: 'All Year',
      validityFrom: '2026-01-01',
      validityTo: '2026-12-31',
      minPax: 1,
      maxPax: 50,
      availability: 'INSTANT',
      bookingRequiredDays: 0,
      cancellationPolicy: 'Non-refundable once policy certificate is activated',
      inclusions: plan.inclusions,
      exclusions: ['Pre-existing non-declared illnesses', 'Unlicensed motorized racing'],
      importantInformation: [plan.terms || 'Comprehensive travel insurance coverage. Valid for stated destinations and duration.'],
      heroImage: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=800&auto=format&fit=crop',
      galleryImages: ['https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=800&auto=format&fit=crop']
    };

    onAddProduct(product, {
      adults,
      children,
      infants: infantsCount,
      travelDate: startDate,
      openDrawer: false,
      master_product_id: plan.id,
      service_id: plan.id,
      category: 'Visa & Ancillary Services',
      service_type: 'TRAVEL_PROTECTION',
      configuration_id: `cfg-prot-${plan.id}`,
      configuration_snapshot: {
        coverageDays,
        adults,
        children,
        medicalCoverageAmount: plan.medicalCoverageAmount,
        tripCancellationAmount: plan.tripCancellationAmount,
        baggageLossAmount: plan.baggageLossAmount,
        provider: plan.provider,
        coverageArea: plan.coverageArea
      },
      pricing_snapshot: {
        dailyPriceUSD: dailyPrice,
        totalSellingUSD,
        convertedSellingPrice,
        currency
      },
      currency_snapshot: currency
    });

    setActiveConfiguringProtection(null);
  };

  // -------------------------------------------------------------------------
  // 5. ADD VIP GROUND SERVICE (REAL PRODUCT FLOW)
  // -------------------------------------------------------------------------
  const handleConfirmAddVipService = (service: VipGroundService, serviceDate: string, paxCount: number) => {
    const isPerGroup = service.pricingType === 'PER_VEHICLE' || service.pricingType === 'FIXED';
    const effectiveAdults = isPerGroup ? 1 : paxCount;
    const effectiveChildren = 0;
    const sellingPrice = service.sellingPrice > 0 ? service.sellingPrice : 0;
    if (sellingPrice <= 0) return;
    const totalSellingUSD = isPerGroup ? sellingPrice : sellingPrice * paxCount;
    const convertedSellingPrice = convertCurrency(totalSellingUSD, service.currency || 'USD', currency);

    const product: Product = {
      id: service.id,
      sku: `VIP-${service.id.toUpperCase().slice(0, 10)}`,
      destinationId: service.destinationId || currentDestination.id,
      destinationName: currentDestination.name,
      country: currentDestination.name,
      city: currentDestination.name,
      productType: service.serviceType,
      name: service.name,
      shortDescription: service.shortDesc || `VIP ground assistance by ${service.supplierName}`,
      longDescription: service.longDesc || service.shortDesc || '',
      supplierId: service.supplierId || 'sup-vip-ground',
      supplierName: service.supplierName || `${currentDestination.name} Ground Concierge Desk`,
      supplierProductCode: `VIP-${service.id}`,
      category: 'Visa & Ancillary Services',
      subcategory: 'Ground VIP Services',
      duration: 'Flexible',
      operatingDays: ['All Days'],
      operatingHours: '24/7 Operations',
      adultNetPrice: service.netCost,
      childNetPrice: isPerGroup ? 0 : Math.round(service.netCost * 0.7),
      infantNetPrice: 0,
      currency: service.currency || 'USD',
      defaultMarkupPercent: service.defaultMarkupPercent || 25,
      taxPercent: 0,
      commissionPercent: 10,
      serviceFeeFixed: 0,
      sellingPriceStartingFrom: sellingPrice,
      season: 'All Year',
      validityFrom: '2026-01-01',
      validityTo: '2026-12-31',
      minPax: 1,
      maxPax: 50,
      availability: 'INSTANT',
      bookingRequiredDays: 1,
      cancellationPolicy: 'Free cancellation up to 48 hours before service execution',
      inclusions: service.inclusions || [],
      exclusions: ['Personal gratuities and extra baggage handling outside contract'],
      importantInformation: ['Please arrive at meeting point 15 minutes prior to confirmed service time.'],
      heroImage: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?q=80&w=800&auto=format&fit=crop',
      galleryImages: ['https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?q=80&w=800&auto=format&fit=crop']
    };

    onAddProduct(product, {
      adults: effectiveAdults,
      children: effectiveChildren,
      infants: infantsCount,
      travelDate: serviceDate || startDate,
      openDrawer: false,
      master_product_id: service.id,
      service_id: service.id,
      category: 'Visa & Ancillary Services',
      service_type: 'VIP_GROUND',
      configuration_id: `cfg-vip-${service.id}`,
      configuration_snapshot: {
        serviceDate: serviceDate || startDate,
        paxCount,
        pricingType: service.pricingType,
        serviceType: service.serviceType,
        supplierName: service.supplierName
      },
      pricing_snapshot: {
        unitSellingUSD: sellingPrice,
        totalSellingUSD,
        convertedSellingPrice,
        currency
      },
      currency_snapshot: currency
    });

    setActiveConfiguringVip(null);
  };

  // -------------------------------------------------------------------------
  // 6. ADD 5G CONNECTIVITY PLAN (REAL PRODUCT FLOW)
  // -------------------------------------------------------------------------
  const handleConfirmAddConnectivity = (plan: ConnectivityPlan, devicesCount: number) => {
    const unitSellingUSD = plan.sellingPrice > 0 ? plan.sellingPrice : 0;
    if (unitSellingUSD <= 0) return;
    const totalSellingUSD = unitSellingUSD * devicesCount;
    const convertedSellingPrice = convertCurrency(totalSellingUSD, plan.currency || 'USD', currency);

    const product: Product = {
      id: plan.id,
      sku: `ESIM-${plan.id.toUpperCase().slice(0, 10)}`,
      destinationId: currentDestination.id,
      destinationName: currentDestination.name,
      country: currentDestination.name,
      city: plan.coverageZone || currentDestination.name,
      productType: '5G Connectivity',
      name: `${plan.name} (${plan.dataAllowance})`,
      shortDescription: `${plan.coverageZone} • ${plan.dataAllowance} • ${plan.validityDays} Days Validity • Instant QR activation.`,
      longDescription: `High-speed 5G mobile data pack with instant digital QR activation for ${currentDestination.name}. Network speed: ${plan.networkSpeed}. Validity: ${plan.validityDays} days.`,
      supplierId: 'sup-connectivity-global',
      supplierName: '5G Regional Direct Roaming',
      supplierProductCode: `ESIM-${plan.id}`,
      category: 'Visa & Ancillary Services',
      subcategory: 'eSIM Connectivity',
      duration: `${plan.validityDays} Days`,
      operatingDays: ['All Days'],
      operatingHours: 'Instant Digital Activation',
      adultNetPrice: plan.netCost,
      childNetPrice: 0,
      infantNetPrice: 0,
      currency: plan.currency || 'USD',
      defaultMarkupPercent: 35,
      taxPercent: 0,
      commissionPercent: 10,
      serviceFeeFixed: 0,
      sellingPriceStartingFrom: unitSellingUSD,
      season: 'All Year',
      validityFrom: '2026-01-01',
      validityTo: '2026-12-31',
      minPax: 1,
      maxPax: 50,
      availability: 'INSTANT',
      bookingRequiredDays: 0,
      cancellationPolicy: 'Non-refundable once digital QR profile is issued',
      inclusions: plan.inclusions || [
        `${plan.dataAllowance} High-Speed 5G Roaming`,
        `${plan.validityDays} Days Continuous Validity`,
        plan.networkSpeed,
        'Instant digital QR code delivery'
      ],
      exclusions: ['Voice calls and traditional SMS (High-Speed Data Only)'],
      importantInformation: ['Compatible with unlocked eSIM enabled smartphones.'],
      heroImage: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?q=80&w=800&auto=format&fit=crop',
      galleryImages: ['https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?q=80&w=800&auto=format&fit=crop']
    };

    onAddProduct(product, {
      adults: devicesCount,
      children: 0,
      infants: 0,
      travelDate: startDate,
      openDrawer: false,
      master_product_id: plan.id,
      service_id: plan.id,
      category: 'Visa & Ancillary Services',
      service_type: 'CONNECTIVITY',
      configuration_id: `cfg-esim-${plan.id}`,
      configuration_snapshot: {
        devicesCount,
        dataAllowance: plan.dataAllowance,
        validityDays: plan.validityDays,
        networkSpeed: plan.networkSpeed,
        coverageZone: plan.coverageZone
      },
      pricing_snapshot: {
        unitSellingUSD,
        totalSellingUSD,
        convertedSellingPrice,
        currency
      },
      currency_snapshot: currency
    });

    setActiveConfiguringConnectivity(null);
  };

  return (
    <section className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden transition-all">
      {/* Deactivated service notice banner */}
      {deactivatedServiceNotice && (
        <div className="bg-amber-50 border-b border-amber-200 p-3.5 px-6 flex items-center justify-between gap-3 text-amber-900 text-xs">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="font-medium">{deactivatedServiceNotice}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setDeactivatedServiceNotice(null)}
            className="text-amber-700 hover:text-amber-900 font-bold text-xs p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div 
        className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex flex-wrap items-center justify-between gap-4 cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#00C6A6]/20 border border-[#00C6A6]/40 text-[#00E5C0] flex items-center justify-center shrink-0 shadow-inner">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                VISA & ANCILLARY SERVICES
              </h2>
              <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-[#00C6A6] text-slate-950">
                Option {activeOptionNumber}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Official Visas, Travel Protection, 5G Connectivity & VIP Ground Services from Master Inventory
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3" onClick={(e) => e.stopPropagation()}>
          <div className="text-right hidden sm:block">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Attached Services</span>
            <span className="text-sm font-black text-[#00E5C0] font-mono">
              {allSectionItemsInQuote.length} Selected • {formatCurrency(sectionTotalSelling, currency)}
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenVisaPickerModal}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 transition-colors cursor-pointer flex items-center space-x-1.5"
          >
            <Globe className="w-3.5 h-3.5 text-[#00C6A6]" />
            <span>Browse Full Visa & Ancillary Catalog</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-8 h-8 rounded-xl bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-5 sm:p-6 space-y-6">
          {/* Sub-group Navigation & Search Controls */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-200">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('ALL')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'ALL'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Services ({totalActiveProductsCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('VISA')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                  activeTab === 'VISA'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>1. Visa Services & Application Assistance ({filteredVisas.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('PROTECTION')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                  activeTab === 'PROTECTION'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>2. Travel Protection & Medical ({filteredProtectionPlans.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('GROUND')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                  activeTab === 'GROUND'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>3. VIP Ground & 5G Connectivity ({filteredVipServices.length + filteredConnectivityPlans.length})</span>
              </button>
            </div>

            {/* Dynamic Search Box */}
            <div className="relative min-w-[240px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search real services, country, type..."
                className="w-full pl-8 pr-7 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:bg-white focus:border-teal-500 outline-none transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Dynamic Production Filters (Only rendered if corresponding master data exists) */}
          {(availableDestinations.length > 1 || availableVisaTypes.length > 1 || availableProviders.length > 1) && (
            <div className="flex flex-wrap items-center gap-2.5 pt-1 pb-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1">
                <Sliders className="w-3.5 h-3.5" />
                <span>Filters:</span>
              </span>

              {availableDestinations.length > 1 && (
                <select
                  value={selectedDestinationFilter}
                  onChange={(e) => setSelectedDestinationFilter(e.target.value)}
                  className="px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-teal-500 cursor-pointer"
                >
                  <option value="ALL">All Destinations ({availableDestinations.length})</option>
                  {availableDestinations.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              )}

              {availableVisaTypes.length > 1 && (activeTab === 'ALL' || activeTab === 'VISA') && (
                <select
                  value={selectedVisaTypeFilter}
                  onChange={(e) => setSelectedVisaTypeFilter(e.target.value)}
                  className="px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-teal-500 cursor-pointer"
                >
                  <option value="ALL">All Visa Types ({availableVisaTypes.length})</option>
                  {availableVisaTypes.map(t => (
                    <option key={t} value={t}>{t.replace('_', ' ')}</option>
                  ))}
                </select>
              )}

              {availableProviders.length > 1 && (activeTab === 'ALL' || activeTab === 'PROTECTION' || activeTab === 'GROUND') && (
                <select
                  value={selectedProviderFilter}
                  onChange={(e) => setSelectedProviderFilter(e.target.value)}
                  className="px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-teal-500 cursor-pointer"
                >
                  <option value="ALL">All Providers ({availableProviders.length})</option>
                  {availableProviders.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              )}

              {(selectedDestinationFilter !== 'ALL' || selectedVisaTypeFilter !== 'ALL' || selectedProviderFilter !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDestinationFilter('ALL');
                    setSelectedVisaTypeFilter('ALL');
                    setSelectedProviderFilter('ALL');
                  }}
                  className="px-2.5 py-1 rounded-xl text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                >
                  Clear Filters
                </button>
              )}
            </div>
          )}

          {/* ACTIVE ATTACHED SERVICES SUMMARY (IF ANY) */}
          {allSectionItemsInQuote.length > 0 && (
            <div className="space-y-3 bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Configured Visa & Ancillary Services in Option {activeOptionNumber} ({allSectionItemsInQuote.length})</span>
                </h3>
                <span className="text-xs font-bold text-slate-900">
                  Total Investment: <span className="font-mono text-emerald-700">{formatCurrency(sectionTotalSelling, currency)}</span>
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {allSectionItemsInQuote.map((item) => {
                  const isVisa = item.service_type === 'VISA' || item.product.sku?.startsWith('VSA-') || item.product.sku?.startsWith('VISA-') || item.product.name.toLowerCase().includes('visa');
                  const isInsurance = item.service_type === 'TRAVEL_PROTECTION' || item.product.subcategory === 'Travel Insurance' || item.product.name.toLowerCase().includes('insurance');
                  const isEsim = item.service_type === 'CONNECTIVITY' || item.product.subcategory === 'eSIM Connectivity';

                  return (
                    <div
                      key={item.id}
                      className="bg-white rounded-2xl p-4 border border-slate-200 hover:border-slate-300 transition-all shadow-2xs flex flex-col justify-between space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start space-x-3 min-w-0">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isVisa 
                              ? 'bg-emerald-100 text-emerald-700' 
                              : isInsurance 
                              ? 'bg-blue-100 text-blue-700' 
                              : 'bg-teal-100 text-teal-700'
                          }`}>
                            {isVisa ? <Globe className="w-4 h-4" /> : isInsurance ? <ShieldCheck className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center space-x-2">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                                isVisa ? 'bg-emerald-100 text-emerald-800' : isInsurance ? 'bg-blue-100 text-blue-800' : 'bg-teal-100 text-teal-800'
                              }`}>
                                {isVisa ? 'Visa Service' : isInsurance ? 'Travel Protection' : isEsim ? '5G Connectivity' : 'VIP Ground'}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {item.master_product_id || item.product.sku}
                              </span>
                            </div>
                            <h4 className="text-sm font-bold text-slate-900 mt-1 truncate">
                              {item.product.name}
                            </h4>
                            <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                              {item.product.shortDescription}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-[10px] text-slate-400 block">Selling Price</span>
                          <span className="text-sm font-black text-slate-900 font-mono">
                            {formatCurrency(item.calculation?.finalTotalSellingPrice || 0, currency)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                        <span className="text-slate-500 font-medium">
                          Coverage: <strong className="text-slate-800">{item.pax.adults} Adults{item.pax.children > 0 ? `, ${item.pax.children} Children` : ''}</strong>
                        </span>

                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => handleEditQuoteItem(item)}
                            className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer"
                          >
                            Configure
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemoveProduct(item.id)}
                            className="px-2.5 py-1 rounded-lg bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Remove</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 1. VISA SERVICES & APPLICATION ASSISTANCE */}
          {(activeTab === 'ALL' || activeTab === 'VISA') && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900 flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                    <span>1. VISA SERVICES & APPLICATION ASSISTANCE</span>
                  </h3>
                  <p className="text-xs text-slate-500">Official consular eVisas, embassy submission packages & expedited documentation from Master Inventory.</p>
                </div>
                <button
                  type="button"
                  onClick={onOpenVisaPickerModal}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center space-x-1 cursor-pointer"
                >
                  <span>Explore Other Countries</span>
                  <Globe className="w-3.5 h-3.5" />
                </button>
              </div>

              {filteredVisas.length === 0 ? (
                <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-2">
                  <p className="text-xs font-bold text-slate-600">No active services available.</p>
                  <p className="text-[11px] text-slate-400">Products created or enabled in Operations & Inventory → Visa & Ancillary Services will appear here dynamically.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredVisas.map((visa) => {
                    const isInQuote = items.some(it => it.master_product_id === visa.id || it.product.id === visa.id || it.product.sku?.includes(visa.id));
                    const totalFeeUSD = (visa.embassyFee || 0) + (visa.serviceFee || 0);
                    const hasValidPrice = totalFeeUSD > 0;
                    const estimatedTotalQuoteCurrency = convertCurrency(totalFeeUSD * totalPayingPax, visa.currency || 'USD', currency);

                    return (
                      <div
                        key={visa.id}
                        className="bg-emerald-50/40 hover:bg-emerald-50/70 rounded-2xl p-4.5 border border-emerald-200 transition-all flex flex-col justify-between space-y-3.5"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-900 border border-emerald-300">
                                  {visa.country} • {visa.visaType}
                                </span>
                                <span className="text-[10px] font-bold text-slate-500 font-mono">
                                  Processing: {visa.processingTimeDays} Days
                                </span>
                              </div>
                              <h4 className="text-sm font-black text-slate-900 mt-1.5">
                                {visa.country} {visa.visaType}
                              </h4>
                              <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                                {visa.description || 'Comprehensive consular visa support including full document audit, appointment scheduling, and biometrics preparation.'}
                              </p>
                            </div>
                          </div>

                          {/* Inclusions list */}
                          <div className="mt-3 space-y-1 text-xs text-slate-600">
                            <div className="flex items-center space-x-1.5">
                              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>Validity: <strong>{visa.validityDays} Days ({visa.entryType?.replace('_', ' ') || 'Single Entry'})</strong></span>
                            </div>
                            <div className="flex items-center space-x-1.5">
                              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>Stay Duration: <strong>{visa.stayDurationDays} Days</strong></span>
                            </div>
                            {visa.assistanceServices && visa.assistanceServices.length > 0 && (
                              <div className="flex items-center space-x-1.5 text-emerald-800">
                                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>{visa.assistanceServices.length} Application Assistance Options Available</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-emerald-200/80">
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase font-bold block">Master Selling Price</span>
                            {hasValidPrice ? (
                              <span className="text-sm font-black text-slate-900 font-mono">
                                {formatCurrency(convertCurrency(totalFeeUSD, visa.currency || 'USD', currency), currency)} <span className="text-xs font-normal text-slate-500">/ person (~{formatCurrency(estimatedTotalQuoteCurrency, currency)} total)</span>
                              </span>
                            ) : (
                              <span className="text-xs font-bold text-amber-700">Price unavailable for this service.</span>
                            )}
                          </div>

                          {isInQuote ? (
                            <button
                              type="button"
                              onClick={() => setActiveConfiguringVisa(visa)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-xs font-bold flex items-center space-x-1 border border-emerald-300 transition-colors cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5 text-emerald-700" />
                              <span>Configured</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={!hasValidPrice}
                              onClick={() => hasValidPrice && setActiveConfiguringVisa(visa)}
                              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 shadow-xs ${
                                hasValidPrice
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                              }`}
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Configure & Add</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 2. TRAVEL PROTECTION & INTERNATIONAL MEDICAL COVERAGE */}
          {(activeTab === 'ALL' || activeTab === 'PROTECTION') && (
            <div className="space-y-4 pt-2">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
                  <span>2. TRAVEL PROTECTION & INTERNATIONAL MEDICAL COVERAGE</span>
                </h3>
                <p className="text-xs text-slate-500">Tier-1 worldwide travel insurance with emergency medical hospitalization, trip cancellation & luggage cover from Master Inventory.</p>
              </div>

              {filteredProtectionPlans.length === 0 ? (
                <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-2">
                  <p className="text-xs font-bold text-slate-600">No active services available.</p>
                  <p className="text-[11px] text-slate-400">Products created or enabled in Operations & Inventory → Visa & Ancillary Services will appear here dynamically.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredProtectionPlans.map((plan) => {
                    const isInQuote = items.some(it => it.master_product_id === plan.id || it.product.id === plan.id);
                    const dailyRate = plan.sellingPricePerDay > 0 ? plan.sellingPricePerDay : (plan.sellingPricePerTrip > 0 ? plan.sellingPricePerTrip / totalTripDays : 0);
                    const hasValidPrice = dailyRate > 0;
                    const totalEstimatedUSD = ((dailyRate * adultsCount) + (dailyRate * 0.7 * childrenCount)) * totalTripDays;
                    const totalEstimatedQuote = convertCurrency(totalEstimatedUSD, plan.currency || 'USD', currency);

                    return (
                      <div
                        key={plan.id}
                        className="bg-blue-50/40 hover:bg-blue-50/70 rounded-2xl p-4.5 border border-blue-200 transition-all flex flex-col justify-between space-y-3.5"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-blue-100 text-blue-900 border border-blue-300">
                              {plan.provider}
                            </span>
                            <span className="text-[11px] font-extrabold text-blue-700 font-mono">
                              ${(plan.medicalCoverageAmount / 1000).toFixed(0)}k USD Medical Cover
                            </span>
                          </div>

                          <h4 className="text-sm font-black text-slate-900 mt-2">
                            {plan.serviceName}
                          </h4>
                          <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                            {plan.customerDescription || plan.terms}
                          </p>

                          <div className="mt-3 space-y-1 text-xs text-slate-600">
                            <div className="flex items-center space-x-1.5">
                              <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span>Coverage Area: <strong>{plan.coverageArea}</strong></span>
                            </div>
                            <div className="flex items-center space-x-1.5">
                              <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span>Trip Cancellation: <strong>${(plan.tripCancellationAmount / 1000).toFixed(0)}k USD Cover</strong></span>
                            </div>
                            <div className="flex items-center space-x-1.5">
                              <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span>Baggage & Loss: <strong>${(plan.baggageLossAmount / 1000).toFixed(0)}k USD Protection</strong></span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-blue-200/80">
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase font-bold block">Estimated Premium ({totalTripDays} Days)</span>
                            {hasValidPrice ? (
                              <span className="text-sm font-black text-slate-900 font-mono">
                                {formatCurrency(totalEstimatedQuote, currency)}
                              </span>
                            ) : (
                              <span className="text-xs font-bold text-amber-700">Price unavailable for this service.</span>
                            )}
                          </div>

                          {isInQuote ? (
                            <button
                              type="button"
                              onClick={() => setActiveConfiguringProtection(plan)}
                              className="px-3 py-1.5 rounded-xl bg-blue-100 hover:bg-blue-200 text-blue-900 text-xs font-bold flex items-center space-x-1 border border-blue-300 transition-colors cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5 text-blue-700" />
                              <span>Configured</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={!hasValidPrice}
                              onClick={() => hasValidPrice && setActiveConfiguringProtection(plan)}
                              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 shadow-xs ${
                                hasValidPrice
                                  ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                              }`}
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Configure & Add</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 3. VIP GROUND SERVICES & 5G CONNECTIVITY */}
          {(activeTab === 'ALL' || activeTab === 'GROUND') && (
            <div className="space-y-4 pt-2">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-teal-500 inline-block"></span>
                  <span>3. VIP GROUND SERVICES & 5G CONNECTIVITY</span>
                </h3>
                <p className="text-xs text-slate-500">Airport meet & assist, fast track lines, station porterage, and regional 5G eSIM connectivity from Master Inventory.</p>
              </div>

              {filteredVipServices.length === 0 && filteredConnectivityPlans.length === 0 ? (
                <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-2">
                  <p className="text-xs font-bold text-slate-600">No active services available.</p>
                  <p className="text-[11px] text-slate-400">Products created or enabled in Operations & Inventory → Visa & Ancillary Services will appear here dynamically.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Connectivity Plans */}
                  {filteredConnectivityPlans.map((plan) => {
                    const isInQuote = items.some(it => it.master_product_id === plan.id || it.product.id === plan.id);
                    const unitPriceUSD = plan.sellingPrice > 0 ? plan.sellingPrice : 0;
                    const hasValidPrice = unitPriceUSD > 0;
                    const unitPriceQuote = convertCurrency(unitPriceUSD, plan.currency || 'USD', currency);

                    return (
                      <div
                        key={plan.id}
                        className="bg-slate-50 hover:bg-white rounded-2xl p-4.5 border border-slate-200 transition-all flex flex-col justify-between space-y-3.5"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-teal-100 text-teal-900 border border-teal-300">
                              Instant 5G eSIM
                            </span>
                            <span className="text-[11px] font-bold text-slate-500">
                              {plan.validityDays} Days Validity
                            </span>
                          </div>

                          <h4 className="text-sm font-black text-slate-900 mt-2">
                            {plan.name}
                          </h4>
                          <p className="text-xs text-slate-600 mt-1">
                            Covers {plan.coverageZone}. {plan.dataAllowance} high-speed data. Instant QR code delivery.
                          </p>

                          <div className="mt-3 space-y-1 text-xs text-slate-600">
                            <div className="flex items-center space-x-1.5">
                              <Check className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                              <span>Network: <strong>{plan.networkSpeed}</strong></span>
                            </div>
                            <div className="flex items-center space-x-1.5">
                              <Check className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                              <span>Data Allowance: <strong>{plan.dataAllowance}</strong></span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase font-bold block">Selling Price</span>
                            {hasValidPrice ? (
                              <span className="text-sm font-black text-slate-900 font-mono">
                                {formatCurrency(unitPriceQuote, currency)} <span className="text-xs font-normal text-slate-500">/ device</span>
                              </span>
                            ) : (
                              <span className="text-xs font-bold text-amber-700">Price unavailable for this service.</span>
                            )}
                          </div>

                          {isInQuote ? (
                            <button
                              type="button"
                              onClick={() => setActiveConfiguringConnectivity(plan)}
                              className="px-3 py-1.5 rounded-xl bg-teal-100 hover:bg-teal-200 text-teal-900 text-xs font-bold flex items-center space-x-1 border border-teal-300 transition-colors cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5 text-teal-700" />
                              <span>Configured</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={!hasValidPrice}
                              onClick={() => hasValidPrice && setActiveConfiguringConnectivity(plan)}
                              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 shadow-xs ${
                                hasValidPrice
                                  ? 'bg-teal-600 hover:bg-teal-700 text-white cursor-pointer'
                                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                              }`}
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Configure & Add</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* VIP Ground Services */}
                  {filteredVipServices.map((svc) => {
                    const isInQuote = items.some(it => it.master_product_id === svc.id || it.product.id === svc.id);
                    const isPerGroup = svc.pricingType === 'PER_VEHICLE' || svc.pricingType === 'FIXED';
                    const unitPriceUSD = svc.sellingPrice > 0 ? svc.sellingPrice : 0;
                    const hasValidPrice = unitPriceUSD > 0;
                    const unitPriceQuote = convertCurrency(unitPriceUSD, svc.currency || 'USD', currency);

                    return (
                      <div
                        key={svc.id}
                        className="bg-slate-50 hover:bg-white rounded-2xl p-4.5 border border-slate-200 transition-all flex flex-col justify-between space-y-3.5"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-slate-200 text-slate-800">
                              {svc.badge || 'VIP Ground'}
                            </span>
                            <span className="text-[11px] font-bold text-slate-500">
                              {isPerGroup ? 'Per Group / Booking' : 'Per Passenger'}
                            </span>
                          </div>

                          <h4 className="text-sm font-black text-slate-900 mt-2">
                            {svc.name}
                          </h4>
                          <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                            {svc.shortDesc || svc.longDesc}
                          </p>

                          <div className="mt-3 space-y-1 text-xs text-slate-600">
                            {(svc.inclusions || []).slice(0, 3).map((inc, i) => (
                              <div key={i} className="flex items-center space-x-1.5">
                                <Check className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                                <span>{inc}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase font-bold block">Selling Price</span>
                            {hasValidPrice ? (
                              <span className="text-sm font-black text-slate-900 font-mono">
                                {formatCurrency(unitPriceQuote, currency)} {isPerGroup ? '' : <span className="text-xs font-normal text-slate-500">/ person</span>}
                              </span>
                            ) : (
                              <span className="text-xs font-bold text-amber-700">Price unavailable for this service.</span>
                            )}
                          </div>

                          {isInQuote ? (
                            <button
                              type="button"
                              onClick={() => setActiveConfiguringVip(svc)}
                              className="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-900 text-xs font-bold flex items-center space-x-1 transition-colors cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5 text-slate-700" />
                              <span>Configured</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={!hasValidPrice}
                              onClick={() => hasValidPrice && setActiveConfiguringVip(svc)}
                              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 shadow-xs ${
                                hasValidPrice
                                  ? 'bg-slate-900 hover:bg-slate-800 text-white cursor-pointer'
                                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                              }`}
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Configure & Add</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* MODAL 1: VISA & ANCILLARY SERVICES VISA CONFIGURATOR */}
      {/* ------------------------------------------------------------------- */}
      {activeConfiguringVisa && (
        <VisaServiceAndFacilitationConfigurator
          isOpen={Boolean(activeConfiguringVisa)}
          visa={activeConfiguringVisa}
          portalOrigin="B2B_QUOTE_BUILDER"
          initialTravelDate={startDate}
          initialAdults={adultsCount}
          initialChildren={childrenCount}
          initialInfants={infantsCount}
          onClose={() => setActiveConfiguringVisa(null)}
          onSuccess={() => {
            setActiveConfiguringVisa(null);
          }}
        />
      )}

      {/* ------------------------------------------------------------------- */}
      {/* MODAL 2: TRAVEL PROTECTION CONFIGURATOR MODAL */}
      {/* ------------------------------------------------------------------- */}
      {activeConfiguringProtection && (
        <TravelProtectionConfigModal
          plan={activeConfiguringProtection}
          currentCurrency={currency}
          initialDays={totalTripDays}
          initialAdults={adultsCount}
          initialChildren={childrenCount}
          onClose={() => setActiveConfiguringProtection(null)}
          onConfirm={(days, adults, children) => handleConfirmAddProtection(activeConfiguringProtection, days, adults, children)}
        />
      )}

      {/* ------------------------------------------------------------------- */}
      {/* MODAL 3: VIP GROUND SERVICE CONFIGURATOR MODAL */}
      {/* ------------------------------------------------------------------- */}
      {activeConfiguringVip && (
        <VipGroundConfigModal
          service={activeConfiguringVip}
          currentCurrency={currency}
          initialDate={startDate}
          initialPax={totalPayingPax}
          onClose={() => setActiveConfiguringVip(null)}
          onConfirm={(date, pax) => handleConfirmAddVipService(activeConfiguringVip, date, pax)}
        />
      )}

      {/* ------------------------------------------------------------------- */}
      {/* MODAL 4: 5G CONNECTIVITY CONFIGURATOR MODAL */}
      {/* ------------------------------------------------------------------- */}
      {activeConfiguringConnectivity && (
        <ConnectivityConfigModal
          plan={activeConfiguringConnectivity}
          currentCurrency={currency}
          initialQuantity={Math.max(1, adultsCount)}
          onClose={() => setActiveConfiguringConnectivity(null)}
          onConfirm={(qty) => handleConfirmAddConnectivity(activeConfiguringConnectivity, qty)}
        />
      )}
    </section>
  );
};

// ---------------------------------------------------------------------------
// SUB-MODAL COMPONENT: Travel Protection Configurator
// ---------------------------------------------------------------------------
interface TravelProtectionConfigModalProps {
  plan: TravelProtectionPlan;
  currentCurrency: CurrencyCode;
  initialDays: number;
  initialAdults: number;
  initialChildren: number;
  onClose: () => void;
  onConfirm: (days: number, adults: number, children: number) => void;
}

const TravelProtectionConfigModal: React.FC<TravelProtectionConfigModalProps> = ({
  plan,
  currentCurrency,
  initialDays,
  initialAdults,
  initialChildren,
  onClose,
  onConfirm
}) => {
  const [coverageDays, setCoverageDays] = useState<number>(Math.max(1, initialDays));
  const [adults, setAdults] = useState<number>(Math.max(1, initialAdults));
  const [children, setChildren] = useState<number>(Math.max(0, initialChildren));

  const dailyPriceUSD = plan.sellingPricePerDay > 0 ? plan.sellingPricePerDay : (plan.sellingPricePerTrip > 0 ? plan.sellingPricePerTrip / coverageDays : 0);
  const hasValidPrice = dailyPriceUSD > 0;
  const totalSellingUSD = ((dailyPriceUSD * adults) + (dailyPriceUSD * 0.7 * children)) * coverageDays;
  const totalSellingQuote = convertCurrency(totalSellingUSD, plan.currency || 'USD', currentCurrency);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col max-h-[92dvh] animate-scaleUp">
        <div className="bg-slate-900 text-white p-5 flex items-start justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-blue-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="px-2 py-0.5 rounded-full bg-blue-500 text-slate-950 text-[9px] font-black uppercase tracking-wider">
                Visa & Ancillary Services
              </span>
              <h3 className="text-base font-bold text-white mt-0.5">{plan.serviceName}</h3>
              <p className="text-xs text-slate-400">{plan.provider} • {plan.coverageArea}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {/* Coverage highlights */}
          <div className="grid grid-cols-3 gap-2 bg-blue-50/60 p-3.5 rounded-2xl border border-blue-100 text-center">
            <div>
              <span className="text-[10px] text-blue-700 font-bold uppercase block">Medical</span>
              <span className="text-sm font-black text-slate-900 font-mono">${(plan.medicalCoverageAmount / 1000).toFixed(0)}k</span>
            </div>
            <div>
              <span className="text-[10px] text-blue-700 font-bold uppercase block">Cancellation</span>
              <span className="text-sm font-black text-slate-900 font-mono">${(plan.tripCancellationAmount / 1000).toFixed(0)}k</span>
            </div>
            <div>
              <span className="text-[10px] text-blue-700 font-bold uppercase block">Baggage</span>
              <span className="text-sm font-black text-slate-900 font-mono">${(plan.baggageLossAmount / 1000).toFixed(0)}k</span>
            </div>
          </div>

          {/* Configuration inputs */}
          <div className="space-y-3 pt-1">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Coverage Duration (Days)</label>
              <input
                type="number"
                min={1}
                max={plan.validityDaysMax || 90}
                value={coverageDays}
                onChange={(e) => setCoverageDays(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Adult Travelers (12+ yrs)</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={adults}
                  onChange={(e) => setAdults(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Child Travelers (0-11 yrs)</label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={children}
                  onChange={(e) => setChildren(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Inclusions */}
          <div className="space-y-1.5 pt-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Master Inclusions</span>
            <div className="space-y-1">
              {(plan.inclusions || []).map((inc, i) => (
                <div key={i} className="flex items-center space-x-1.5 text-xs text-slate-600">
                  <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>{inc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Calculated Selling Price</span>
            {hasValidPrice ? (
              <span className="text-base font-black text-slate-900 font-mono">
                {formatCurrency(totalSellingQuote, currentCurrency)}
              </span>
            ) : (
              <span className="text-xs font-bold text-amber-700">Price unavailable for this service.</span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!hasValidPrice}
              onClick={() => hasValidPrice && onConfirm(coverageDays, adults, children)}
              className={`px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition-colors ${
                hasValidPrice
                  ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
              }`}
            >
              Add to Quote
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// SUB-MODAL COMPONENT: VIP Ground Service Configurator
// ---------------------------------------------------------------------------
interface VipGroundConfigModalProps {
  service: VipGroundService;
  currentCurrency: CurrencyCode;
  initialDate: string;
  initialPax: number;
  onClose: () => void;
  onConfirm: (date: string, pax: number) => void;
}

const VipGroundConfigModal: React.FC<VipGroundConfigModalProps> = ({
  service,
  currentCurrency,
  initialDate,
  initialPax,
  onClose,
  onConfirm
}) => {
  const [date, setDate] = useState<string>(initialDate || '');
  const [pax, setPax] = useState<number>(Math.max(1, initialPax));

  const isPerGroup = service.pricingType === 'PER_VEHICLE' || service.pricingType === 'FIXED';
  const unitSellingUSD = service.sellingPrice > 0 ? service.sellingPrice : 0;
  const hasValidPrice = unitSellingUSD > 0;
  const totalSellingUSD = isPerGroup ? unitSellingUSD : unitSellingUSD * pax;
  const totalSellingQuote = convertCurrency(totalSellingUSD, service.currency || 'USD', currentCurrency);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col max-h-[92dvh] animate-scaleUp">
        <div className="bg-slate-900 text-white p-5 flex items-start justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <span className="px-2 py-0.5 rounded-full bg-teal-500 text-slate-950 text-[9px] font-black uppercase tracking-wider">
                Visa & Ancillary Services
              </span>
              <h3 className="text-base font-bold text-white mt-0.5">{service.name}</h3>
              <p className="text-xs text-slate-400">{service.supplierName} • {isPerGroup ? 'Per Booking' : 'Per Pax'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
          <p className="text-xs text-slate-600 leading-relaxed">
            {service.longDesc || service.shortDesc}
          </p>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Service Execution Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 outline-none focus:border-teal-500"
              />
            </div>
            {!isPerGroup && (
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Travelers Count</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={pax}
                  onChange={(e) => setPax(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 outline-none focus:border-teal-500"
                />
              </div>
            )}
          </div>

          <div className="space-y-1.5 pt-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Master Inclusions</span>
            <div className="space-y-1">
              {(service.inclusions || []).map((inc, i) => (
                <div key={i} className="flex items-center space-x-1.5 text-xs text-slate-600">
                  <Check className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  <span>{inc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Calculated Selling Price</span>
            {hasValidPrice ? (
              <span className="text-base font-black text-slate-900 font-mono">
                {formatCurrency(totalSellingQuote, currentCurrency)}
              </span>
            ) : (
              <span className="text-xs font-bold text-amber-700">Price unavailable for this service.</span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!hasValidPrice}
              onClick={() => hasValidPrice && onConfirm(date, pax)}
              className={`px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition-colors ${
                hasValidPrice
                  ? 'bg-teal-600 hover:bg-teal-700 text-white cursor-pointer'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
              }`}
            >
              Add to Quote
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// SUB-MODAL COMPONENT: 5G Connectivity Configurator
// ---------------------------------------------------------------------------
interface ConnectivityConfigModalProps {
  plan: ConnectivityPlan;
  currentCurrency: CurrencyCode;
  initialQuantity: number;
  onClose: () => void;
  onConfirm: (quantity: number) => void;
}

const ConnectivityConfigModal: React.FC<ConnectivityConfigModalProps> = ({
  plan,
  currentCurrency,
  initialQuantity,
  onClose,
  onConfirm
}) => {
  const [quantity, setQuantity] = useState<number>(Math.max(1, initialQuantity));

  const unitSellingUSD = plan.sellingPrice > 0 ? plan.sellingPrice : 0;
  const hasValidPrice = unitSellingUSD > 0;
  const totalSellingUSD = unitSellingUSD * quantity;
  const totalSellingQuote = convertCurrency(totalSellingUSD, plan.currency || 'USD', currentCurrency);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col max-h-[92dvh] animate-scaleUp">
        <div className="bg-slate-900 text-white p-5 flex items-start justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <span className="px-2 py-0.5 rounded-full bg-teal-500 text-slate-950 text-[9px] font-black uppercase tracking-wider">
                Visa & Ancillary Services
              </span>
              <h3 className="text-base font-bold text-white mt-0.5">{plan.name}</h3>
              <p className="text-xs text-slate-400">{plan.coverageZone} • {plan.dataAllowance} • {plan.validityDays} Days</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
          <div className="bg-teal-50/60 p-3.5 rounded-2xl border border-teal-100 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-teal-700 font-bold uppercase block">Speed & Network</span>
              <span className="text-xs font-bold text-slate-900">{plan.networkSpeed}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-teal-700 font-bold uppercase block">Activation Type</span>
              <span className="text-xs font-bold text-teal-800">Instant QR Delivery</span>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Number of eSIM Devices / Profiles</label>
            <input
              type="number"
              min={1}
              max={50}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 outline-none focus:border-teal-500"
            />
          </div>

          <div className="space-y-1.5 pt-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Master Inclusions</span>
            <div className="space-y-1">
              {(plan.inclusions || [
                `${plan.dataAllowance} High-Speed Roaming`,
                `${plan.validityDays} Days Validity`,
                plan.networkSpeed,
                'Instant digital QR code delivery'
              ]).map((inc, i) => (
                <div key={i} className="flex items-center space-x-1.5 text-xs text-slate-600">
                  <Check className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  <span>{inc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Calculated Selling Price</span>
            {hasValidPrice ? (
              <span className="text-base font-black text-slate-900 font-mono">
                {formatCurrency(totalSellingQuote, currentCurrency)}
              </span>
            ) : (
              <span className="text-xs font-bold text-amber-700">Price unavailable for this service.</span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!hasValidPrice}
              onClick={() => hasValidPrice && onConfirm(quantity)}
              className={`px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition-colors ${
                hasValidPrice
                  ? 'bg-teal-600 hover:bg-teal-700 text-white cursor-pointer'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
              }`}
            >
              Add to Quote
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Aliases for modern naming & clean backward compatibility
export const VisaAndAncillaryServicesSection = VisaServicesAndFacilitationSection;
