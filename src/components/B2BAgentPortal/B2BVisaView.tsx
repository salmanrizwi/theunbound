import React, { useState, useMemo, useEffect } from 'react';
import { 
  FileCheck, 
  Search, 
  Filter, 
  Globe, 
  Clock, 
  CheckCircle2, 
  Download, 
  Plus, 
  Eye, 
  ShieldCheck, 
  AlertCircle, 
  FileText, 
  Check, 
  ArrowRight, 
  ExternalLink, 
  Info, 
  Calendar, 
  X, 
  Trash2,
  Shield,
  Smartphone,
  Sparkles,
  Plane,
  Award,
  DollarSign,
  Users
} from 'lucide-react';
import { 
  Product, 
  CurrencyCode, 
  QuoteItem,
  VisaProduct as MasterVisaProduct,
  TravelProtectionPlan,
  VipGroundService,
  ConnectivityPlan
} from '../../types';
import { useQuotation } from '../../context/QuotationContext';
import { formatCurrency, convertCurrency } from '../../services/pricingEngine';
import { useAuth } from '../../context/AuthContext';
import { AddVisaToQuoteModal } from './AddVisaToQuoteModal';
import { 
  TravelProtectionConfigModal, 
  VipGroundConfigModal, 
  ConnectivityConfigModal 
} from './VisaServicesAndFacilitationSection';
import { AppDatabase } from '../../services/db';

export interface VisaProduct {
  id: string;
  country: string;
  countryCode: string;
  visaType: string;
  category: 'TOURIST' | 'BUSINESS' | 'TRANSIT' | 'LONG_STAY' | string;
  processingTimeDays: string | number;
  stayDuration: string;
  validity: string;
  entryType: string;
  wholesaleNetUSD: number;
  embassyFeeUSD: number;
  suggestedSellingUSD: number;
  imageUrl: string;
  requiredDocuments: string[];
  photoSpecs: string;
  financialRequirements: string;
  embassySubmissionType: string;
  importantNotes: string[];
  destinationId?: string;
  currency?: string;
}

interface B2BVisaViewProps {
  onOpenCreateQuote?: () => void;
  initialCategory?: 'ALL' | 'VISA' | 'PROTECTION' | 'GROUND';
}

export const B2BVisaView: React.FC<B2BVisaViewProps> = ({
  onOpenCreateQuote,
  initialCategory = 'ALL'
}) => {
  const { user } = useAuth();
  const { 
    items, 
    addProductToQuote, 
    removeProductFromQuote, 
    currency, 
    setIsQuoteDrawerOpen,
    travelStartDate,
    paxConfig
  } = useQuotation();

  const [activeTab, setActiveTab] = useState<'ALL' | 'VISA' | 'PROTECTION' | 'GROUND'>(initialCategory);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDestination, setSelectedDestination] = useState<string>('ALL');

  // Modal states
  const [selectedVisaForModal, setSelectedVisaForModal] = useState<VisaProduct | MasterVisaProduct | null>(null);
  const [selectedVisaDetails, setSelectedVisaDetails] = useState<VisaProduct | null>(null);
  const [activeProtectionPlan, setActiveProtectionPlan] = useState<TravelProtectionPlan | null>(null);
  const [activeVipService, setActiveVipService] = useState<VipGroundService | null>(null);
  const [activeConnectivityPlan, setActiveConnectivityPlan] = useState<ConnectivityPlan | null>(null);

  // Success notifications & feedback
  const [downloadSuccessMessage, setDownloadSuccessMessage] = useState<string | null>(null);
  const [quoteSuccessNotification, setQuoteSuccessNotification] = useState<{ title: string; subtitle: string } | null>(null);

  // Database subscription for real-time live data
  const db = AppDatabase.getInstance();
  const [dbTick, setDbTick] = useState<number>(0);

  useEffect(() => {
    return db.subscribe(() => {
      setDbTick(t => t + 1);
    });
  }, [db]);

  // 1. Authoritative Master Data Queries
  const realVisas = useMemo(() => {
    try {
      const all = db.getVisas() || [];
      return all.filter(v => v.status === 'ACTIVE' || !v.status);
    } catch (e) {
      console.error('Error loading visas from DB:', e);
      return [];
    }
  }, [db, dbTick]);

  const realProtectionPlans = useMemo(() => {
    try {
      const all = db.getTravelProtectionPlans() || [];
      return all.filter(p => p.status === 'ACTIVE' || !p.status);
    } catch (e) {
      console.error('Error loading travel protection from DB:', e);
      return [];
    }
  }, [db, dbTick]);

  const realVipServices = useMemo(() => {
    try {
      const all = db.getVipGroundServices() || [];
      return all.filter(s => s.status === 'ACTIVE' || !s.status);
    } catch (e) {
      console.error('Error loading VIP ground services from DB:', e);
      return [];
    }
  }, [db, dbTick]);

  const realConnectivityPlans = useMemo(() => {
    try {
      const all = db.getConnectivityPlans() || [];
      return all.filter(c => c.status === 'ACTIVE' || !c.status);
    } catch (e) {
      console.error('Error loading connectivity plans from DB:', e);
      return [];
    }
  }, [db, dbTick]);

  // Map Visas to consistent interface
  const formattedVisas = useMemo<VisaProduct[]>(() => {
    return realVisas.map(v => {
      const embassy = typeof v.embassyFee === 'number' ? v.embassyFee : (typeof v.embassyFeeUSD === 'number' ? v.embassyFeeUSD : 50);
      const service = typeof v.serviceFee === 'number' ? v.serviceFee : (typeof v.wholesaleNetUSD === 'number' ? v.wholesaleNetUSD : 35);
      const suggested = typeof v.suggestedSellingUSD === 'number' ? v.suggestedSellingUSD : (embassy + service);

      return {
        id: v.id,
        country: v.country || 'International',
        countryCode: v.countryCode || 'INTL',
        visaType: v.visaType || 'Official Visa Facilitation',
        category: v.category || 'TOURIST',
        processingTimeDays: typeof v.processingTimeDays === 'number' 
          ? `${v.processingTimeDays} Business Days` 
          : (v.processingTimeDays || '3-5 Business Days'),
        stayDuration: typeof v.stayDurationDays === 'number' 
          ? `Up to ${v.stayDurationDays} Days` 
          : (v.stayDuration || '30 Days'),
        validity: typeof v.validityDays === 'number' 
          ? `${v.validityDays} Days` 
          : (v.validity || '90 Days'),
        entryType: v.entryType ? v.entryType.replace('_', ' ') : 'Single Entry',
        wholesaleNetUSD: service,
        embassyFeeUSD: embassy,
        suggestedSellingUSD: suggested,
        imageUrl: v.heroImage || v.imageUrl || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?q=80&w=800&auto=format&fit=crop',
        requiredDocuments: v.documentsChecklist || v.requiredDocuments || [
          'Original Passport valid for at least 6 months with 2 blank pages',
          'Recent passport-sized photographs (white background)',
          'Confirmed travel itinerary & round-trip flight bookings',
          'Updated bank statements for the last 3-6 months'
        ],
        photoSpecs: v.photoSpecs || '35mm x 45mm, matte finish, pure white background.',
        financialRequirements: v.financialRequirements || 'Valid liquid bank balance and proof of income/employment.',
        embassySubmissionType: v.embassySubmissionType || (v.entryType?.toLowerCase().includes('evisa') ? 'Online eVisa' : 'Embassy / VFS Submission'),
        importantNotes: v.eligibilityNotes || v.importantNotes || [
          'Pre-audited document checking by TheUnbound Consular Desk.',
          'Ensure applicant passport details match exactly.'
        ],
        destinationId: v.destinationId,
        currency: v.currency || 'USD'
      };
    });
  }, [realVisas]);

  // Dynamic filter sets based on real master data
  const availableDestinations = useMemo(() => {
    const set = new Set<string>();
    formattedVisas.forEach(v => v.country && set.add(v.country));
    realProtectionPlans.forEach(p => p.coverageArea && set.add(p.coverageArea));
    realVipServices.forEach(s => s.supplierName && set.add(s.supplierName));
    return ['ALL', ...Array.from(set).sort()];
  }, [formattedVisas, realProtectionPlans, realVipServices]);

  // Search filter
  const searchLower = searchQuery.trim().toLowerCase();

  const filteredVisas = useMemo(() => {
    return formattedVisas.filter(v => {
      const matchSearch = !searchLower || 
        v.country.toLowerCase().includes(searchLower) ||
        v.visaType.toLowerCase().includes(searchLower) ||
        v.stayDuration.toLowerCase().includes(searchLower) ||
        v.entryType.toLowerCase().includes(searchLower);

      const matchDest = selectedDestination === 'ALL' || v.country === selectedDestination;
      return matchSearch && matchDest;
    });
  }, [formattedVisas, searchLower, selectedDestination]);

  const filteredProtectionPlans = useMemo(() => {
    return realProtectionPlans.filter(p => {
      const matchSearch = !searchLower ||
        p.serviceName.toLowerCase().includes(searchLower) ||
        p.provider.toLowerCase().includes(searchLower) ||
        p.coverageArea.toLowerCase().includes(searchLower) ||
        (p.customerDescription || '').toLowerCase().includes(searchLower);

      const matchDest = selectedDestination === 'ALL' || p.coverageArea.toLowerCase().includes(selectedDestination.toLowerCase());
      return matchSearch && matchDest;
    });
  }, [realProtectionPlans, searchLower, selectedDestination]);

  const filteredVipServices = useMemo(() => {
    return realVipServices.filter(s => {
      const matchSearch = !searchLower ||
        s.name.toLowerCase().includes(searchLower) ||
        s.supplierName.toLowerCase().includes(searchLower) ||
        s.serviceType.toLowerCase().includes(searchLower) ||
        (s.shortDesc || '').toLowerCase().includes(searchLower);

      return matchSearch;
    });
  }, [realVipServices, searchLower]);

  const filteredConnectivityPlans = useMemo(() => {
    return realConnectivityPlans.filter(c => {
      const matchSearch = !searchLower ||
        c.name.toLowerCase().includes(searchLower) ||
        c.dataAllowance.toLowerCase().includes(searchLower) ||
        c.coverageZone.toLowerCase().includes(searchLower);

      const matchDest = selectedDestination === 'ALL' || c.coverageZone.toLowerCase().includes(selectedDestination.toLowerCase());
      return matchSearch && matchDest;
    });
  }, [realConnectivityPlans, searchLower, selectedDestination]);

  // Helper to check if item is in quote
  const isItemInQuote = (productId: string) => {
    return items.some(it => 
      it.product.id === productId || 
      it.master_product_id === productId || 
      (it.metadata as any)?.visaProductId === productId ||
      (it.metadata as any)?.master_product_id === productId
    );
  };

  const getQuoteItemByProductId = (productId: string): QuoteItem | undefined => {
    return items.find(it => 
      it.product.id === productId || 
      it.master_product_id === productId || 
      (it.metadata as any)?.visaProductId === productId ||
      (it.metadata as any)?.master_product_id === productId
    );
  };

  // -------------------------------------------------------------------------
  // ADD HANDLERS FOR TRAVEL PROTECTION, VIP & CONNECTIVITY
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
      destinationId: plan.coverageArea || 'global',
      destinationName: plan.coverageArea,
      country: plan.coverageArea,
      city: plan.coverageArea,
      productType: 'Travel Protection',
      name: `${plan.serviceName} (${coverageDays} Days)`,
      shortDescription: plan.customerDescription || `${plan.coverageArea} Comprehensive Medical & Travel Cover. Provider: ${plan.provider}.`,
      longDescription: `Full comprehensive travel protection covering ${adults} Adults and ${children} Children for ${coverageDays} days in ${plan.coverageArea}. Medical Coverage: $${plan.medicalCoverageAmount.toLocaleString()} USD. Inclusions: ${(plan.inclusions || []).join(', ')}.`,
      supplierId: 'sup-insurance-canonical',
      supplierName: plan.provider,
      supplierProductCode: `INS-${plan.id}`,
      category: 'Visa & Ancillary Services',
      subcategory: 'Travel Insurance',
      duration: `${coverageDays} Days`,
      operatingDays: ['All Days'],
      operatingHours: '24/7 Coverage',
      adultNetPrice: totalAdultCost,
      childNetPrice: totalChildCost,
      infantNetPrice: 0,
      currency: plan.currency || 'USD',
      defaultMarkupPercent: 0,
      taxPercent: 0,
      commissionPercent: 0,
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

    addProductToQuote(product, {
      adults,
      children,
      infants: paxConfig?.infants || 0,
      travelDate: travelStartDate || new Date().toISOString().split('T')[0],
      openDrawer: true,
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

    setActiveProtectionPlan(null);
    setQuoteSuccessNotification({
      title: `${plan.serviceName} Added to Quote!`,
      subtitle: `Covering ${adults + children} pax for ${coverageDays} days (${formatCurrency(convertedSellingPrice, currency)})`
    });
  };

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
      destinationId: 'global-ground',
      destinationName: service.supplierName || 'Airport Ground Service',
      country: 'Ground Services',
      city: 'Airport VIP Desk',
      productType: 'Ground VIP Service',
      name: service.name,
      shortDescription: service.shortDesc || `VIP Ground Service: ${service.serviceType}. Provider: ${service.supplierName}.`,
      longDescription: service.longDesc || `${service.name} provided by ${service.supplierName}. Service Type: ${service.serviceType}. Includes: ${(service.inclusions || []).join(', ')}.`,
      supplierId: 'sup-vip-ground',
      supplierName: service.supplierName,
      supplierProductCode: `VIP-${service.id}`,
      category: 'Visa & Ancillary Services',
      subcategory: 'Ground VIP Services',
      duration: 'Single Service',
      operatingDays: ['All Days'],
      operatingHours: '24/7 Service',
      adultNetPrice: service.netCost,
      childNetPrice: 0,
      infantNetPrice: 0,
      currency: service.currency || 'USD',
      defaultMarkupPercent: 0,
      taxPercent: 0,
      commissionPercent: 0,
      serviceFeeFixed: 0,
      sellingPriceStartingFrom: service.sellingPrice,
      season: 'All Year',
      validityFrom: '2026-01-01',
      validityTo: '2026-12-31',
      minPax: 1,
      maxPax: 20,
      availability: 'INSTANT',
      bookingRequiredDays: 2,
      cancellationPolicy: 'Non-refundable within 48 hours of scheduled flight arrival/departure time.',
      inclusions: service.inclusions,
      exclusions: ['Excess baggage handling exceeding 3 pieces per passenger', 'Customs duty payments'],
      importantInformation: [(service as any).terms || 'Flight details must be provided at least 48 hours prior to service execution.'],
      heroImage: 'https://images.unsplash.com/photo-1542296332-2e4473faf563?q=80&w=800&auto=format&fit=crop',
      galleryImages: ['https://images.unsplash.com/photo-1542296332-2e4473faf563?q=80&w=800&auto=format&fit=crop']
    };

    addProductToQuote(product, {
      adults: effectiveAdults,
      children: effectiveChildren,
      infants: 0,
      travelDate: serviceDate || travelStartDate || new Date().toISOString().split('T')[0],
      openDrawer: true,
      master_product_id: service.id,
      service_id: service.id,
      category: 'Visa & Ancillary Services',
      service_type: 'VIP_GROUND',
      configuration_id: `cfg-vip-${service.id}`,
      configuration_snapshot: {
        serviceDate,
        paxCount,
        isPerGroup,
        supplierName: service.supplierName,
        serviceType: service.serviceType
      },
      pricing_snapshot: {
        unitSellingUSD: sellingPrice,
        totalSellingUSD,
        convertedSellingPrice,
        currency
      },
      currency_snapshot: currency
    });

    setActiveVipService(null);
    setQuoteSuccessNotification({
      title: `${service.name} Added to Quote!`,
      subtitle: `Configured for ${paxCount} pax (${formatCurrency(convertedSellingPrice, currency)})`
    });
  };

  const handleConfirmAddConnectivity = (plan: ConnectivityPlan, quantity: number) => {
    const sellingPrice = plan.sellingPrice > 0 ? plan.sellingPrice : 0;
    if (sellingPrice <= 0) return;
    const totalSellingUSD = sellingPrice * quantity;
    const convertedSellingPrice = convertCurrency(totalSellingUSD, plan.currency || 'USD', currency);

    const product: Product = {
      id: plan.id,
      sku: `ESIM-${plan.id.toUpperCase().slice(0, 10)}`,
      destinationId: plan.coverageZone || 'global',
      destinationName: plan.coverageZone,
      country: plan.coverageZone,
      city: plan.coverageZone,
      productType: '5G Connectivity',
      name: `${plan.name} (${quantity} Profiles)`,
      shortDescription: `5G High-Speed Connectivity: ${plan.dataAllowance} in ${plan.coverageZone} for ${plan.validityDays} Days.`,
      longDescription: `Digital eSIM Data Plan: ${plan.dataAllowance} fast 5G/4G connectivity across ${plan.coverageZone}. Speed: ${plan.networkSpeed}. Validity: ${plan.validityDays} Days. Includes instant QR delivery upon confirmation.`,
      supplierId: 'sup-connectivity-global',
      supplierName: 'Global eSIM Network',
      supplierProductCode: `ESIM-${plan.id}`,
      category: 'Visa & Ancillary Services',
      subcategory: 'eSIM Connectivity',
      duration: `${plan.validityDays} Days`,
      operatingDays: ['All Days'],
      operatingHours: 'Instant Digital Activation',
      adultNetPrice: plan.netCost * quantity,
      childNetPrice: 0,
      infantNetPrice: 0,
      currency: plan.currency || 'USD',
      defaultMarkupPercent: 0,
      taxPercent: 0,
      commissionPercent: 0,
      serviceFeeFixed: 0,
      sellingPriceStartingFrom: plan.sellingPrice,
      season: 'All Year',
      validityFrom: '2026-01-01',
      validityTo: '2026-12-31',
      minPax: 1,
      maxPax: 20,
      availability: 'INSTANT',
      bookingRequiredDays: 0,
      cancellationPolicy: 'Non-refundable once digital eSIM QR profile is issued and delivered.',
      inclusions: [
        `${plan.dataAllowance} High-Speed 5G/LTE Data`,
        `Coverage in ${plan.coverageZone}`,
        'Instant Digital QR Code Activation',
        'Tethering & Mobile Hotspot Allowed',
        '24/7 Automated Technical Support'
      ],
      exclusions: ['Traditional voice calling & SMS (VOIP apps supported)'],
      importantInformation: ['Device must be carrier-unlocked and support eSIM technology.'],
      heroImage: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?q=80&w=800&auto=format&fit=crop',
      galleryImages: ['https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?q=80&w=800&auto=format&fit=crop']
    };

    addProductToQuote(product, {
      adults: quantity,
      children: 0,
      infants: 0,
      travelDate: travelStartDate || new Date().toISOString().split('T')[0],
      openDrawer: true,
      master_product_id: plan.id,
      service_id: plan.id,
      category: 'Visa & Ancillary Services',
      service_type: 'CONNECTIVITY',
      configuration_id: `cfg-esim-${plan.id}`,
      configuration_snapshot: {
        quantity,
        dataAllowance: plan.dataAllowance,
        validityDays: plan.validityDays,
        networkSpeed: plan.networkSpeed,
        coverageZone: plan.coverageZone
      },
      pricing_snapshot: {
        unitSellingUSD: sellingPrice,
        totalSellingUSD,
        convertedSellingPrice,
        currency
      },
      currency_snapshot: currency
    });

    setActiveConnectivityPlan(null);
    setQuoteSuccessNotification({
      title: `${plan.name} Added to Quote!`,
      subtitle: `${quantity} eSIM Profiles (${formatCurrency(convertedSellingPrice, currency)})`
    });
  };

  const handleDownloadChecklist = (visa: VisaProduct) => {
    const textContent = `
===========================================================
THEUNBOUND DMC — B2B VISA DOCUMENT CHECKLIST
===========================================================
Destination: ${visa.country}
Visa Type: ${visa.visaType}
Category: ${visa.category} | ${visa.entryType}
Processing Time: ${visa.processingTimeDays}
Stay Duration: ${visa.stayDuration} | Validity: ${visa.validity}
Embassy Submission: ${visa.embassySubmissionType}
-----------------------------------------------------------

MANDATORY DOCUMENTS REQUIRED:
${visa.requiredDocuments.map((doc, idx) => `[  ] ${idx + 1}. ${doc}`).join('\n')}

PHOTO SPECIFICATIONS:
${visa.photoSpecs}

FINANCIAL & SPONSORSHIP REQUIREMENTS:
${visa.financialRequirements}

OPERATIONAL NOTES:
${visa.importantNotes.map(n => `• ${n}`).join('\n')}

===========================================================
Issued by: TheUnbound Travel Agent Portal
Support: visa-operations@theunbound.in
===========================================================
`;

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${visa.country.toLowerCase()}-visa-checklist.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDownloadSuccessMessage(`Checklist for ${visa.country} downloaded successfully!`);
    setTimeout(() => setDownloadSuccessMessage(null), 3500);
  };

  const totalActiveServicesCount = formattedVisas.length + realProtectionPlans.length + realVipServices.length + realConnectivityPlans.length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-fadeIn">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full bg-[#00C6A6]/10 text-[#00a88c] border border-[#00C6A6]/20 text-[10px] font-bold uppercase tracking-wider">
              Travel Trade Services
            </span>
            <span className="text-xs text-slate-400 font-mono">({totalActiveServicesCount} Active Offerings)</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 font-sans mt-1">Visa & Ancillary Services</h1>
          <p className="text-xs text-slate-500 max-w-2xl mt-0.5">
            Pre-audited consular visa processing, comprehensive travel protection, and VIP airport & connectivity services.
          </p>
        </div>

        {onOpenCreateQuote && (
          <button
            onClick={onOpenCreateQuote}
            className="inline-flex items-center space-x-2 bg-slate-900 hover:bg-[#00C6A6] hover:text-slate-950 text-white px-5 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer shadow-xs"
          >
            <span>Open Quotation Builder ({items.length} in Quote)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Success Notification */}
      {quoteSuccessNotification && (
        <div className="bg-teal-900 text-white px-5 py-3.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg border border-[#00C6A6]/40 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-[#00C6A6] text-slate-950 flex items-center justify-center font-bold shrink-0">
              <Check className="w-4 h-4 stroke-[3]" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">{quoteSuccessNotification.title}</div>
              <div className="text-[11px] text-[#00E5C0]">{quoteSuccessNotification.subtitle}</div>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => setIsQuoteDrawerOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-[#00C6A6] hover:bg-[#00E5C0] text-slate-950 text-xs font-black transition-all cursor-pointer shadow-xs flex items-center space-x-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>View Quote / Cart</span>
            </button>
            <button
              onClick={() => setQuoteSuccessNotification(null)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {downloadSuccessMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl flex items-center justify-between text-xs font-bold animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{downloadSuccessMessage}</span>
          </div>
          <button onClick={() => setDownloadSuccessMessage(null)} className="text-emerald-600 hover:text-emerald-900 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* 3 SIMPLIFIED B2B AGENT SERVICE CATEGORY TABS */}
      {/* ------------------------------------------------------------------- */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('ALL')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
            activeTab === 'ALL'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <span>All Services</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${activeTab === 'ALL' ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-600'}`}>
            {totalActiveServicesCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('VISA')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
            activeTab === 'VISA'
              ? 'bg-[#00A88F] text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          <span>Visa Services</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${activeTab === 'VISA' ? 'bg-teal-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
            {formattedVisas.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('PROTECTION')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
            activeTab === 'PROTECTION'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Travel Protection</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${activeTab === 'PROTECTION' ? 'bg-blue-800 text-white' : 'bg-slate-100 text-slate-600'}`}>
            {realProtectionPlans.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('GROUND')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
            activeTab === 'GROUND'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Ground & Connectivity</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${activeTab === 'GROUND' ? 'bg-purple-800 text-white' : 'bg-slate-100 text-slate-600'}`}>
            {realVipServices.length + realConnectivityPlans.length}
          </span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by country, service type, provider (e.g. Japan Visa, Travel Insurance, Fast Track, eSIM)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-[#00C6A6] focus:bg-white transition-all"
          />
        </div>

        <div className="flex items-center space-x-2 w-full md:w-auto">
          <select
            value={selectedDestination}
            onChange={(e) => setSelectedDestination(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none cursor-pointer hover:border-slate-300"
          >
            {availableDestinations.map(d => (
              <option key={d} value={d}>{d === 'ALL' ? 'All Destinations / Areas' : d}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* 1. VISA SERVICES SECTION */}
      {/* ------------------------------------------------------------------- */}
      {(activeTab === 'ALL' || activeTab === 'VISA') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <div className="flex items-center space-x-2">
              <FileCheck className="w-5 h-5 text-[#00A88F]" />
              <h2 className="text-base font-black text-slate-900 font-sans">Visa Services</h2>
              <span className="text-xs text-slate-400 font-mono">({filteredVisas.length})</span>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">Pre-audited consular processing with DMC support</span>
          </div>

          {filteredVisas.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500">
              No visa products found matching your search.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredVisas.map(visa => {
                const inQuote = isItemInQuote(visa.id);
                const quoteItem = getQuoteItemByProductId(visa.id);
                const displayPrice = convertCurrency(visa.suggestedSellingUSD, 'USD', currency);

                return (
                  <div
                    key={visa.id}
                    className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:border-[#00C6A6] hover:shadow-md transition-all flex flex-col overflow-hidden group"
                  >
                    {/* Image & Tag */}
                    <div className="relative h-44 overflow-hidden bg-slate-100">
                      <img
                        src={visa.imageUrl}
                        alt={visa.country}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent"></div>

                      <div className="absolute top-3 left-3 flex items-center space-x-2">
                        <span className="px-2.5 py-1 rounded-full bg-slate-900/90 backdrop-blur-xs text-white text-[10px] font-bold tracking-wider">
                          {visa.country}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-[#00C6A6] text-slate-950 text-[10px] font-black uppercase">
                          {visa.embassySubmissionType}
                        </span>
                      </div>

                      <div className="absolute bottom-3 left-3 right-3 text-white">
                        <h3 className="font-bold text-base text-white leading-snug drop-shadow-xs truncate">
                          {visa.visaType}
                        </h3>
                        <p className="text-[11px] text-slate-200 flex items-center space-x-1.5 mt-0.5">
                          <Clock className="w-3 h-3 text-[#00E5C0]" />
                          <span>Turnaround: {visa.processingTimeDays}</span>
                        </p>
                      </div>
                    </div>

                    {/* Body */}
                    <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                          <span className="text-[10px] text-slate-400 block font-medium">Stay Duration</span>
                          <span className="font-bold text-slate-800">{visa.stayDuration}</span>
                        </div>
                        <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                          <span className="text-[10px] text-slate-400 block font-medium">Entry Type</span>
                          <span className="font-bold text-slate-800 truncate">{visa.entryType}</span>
                        </div>
                      </div>

                      {/* Checklist Highlights */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Checklist ({visa.requiredDocuments.length} Requirements)
                        </span>
                        <ul className="space-y-1 text-xs text-slate-600">
                          {visa.requiredDocuments.slice(0, 2).map((doc, idx) => (
                            <li key={idx} className="flex items-start space-x-1.5 text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5 text-[#00C6A6] shrink-0 mt-0.5" />
                              <span className="truncate">{doc}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Price Row */}
                      <div className="pt-3 border-t border-slate-100 flex items-baseline justify-between">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">From Rate</span>
                          <span className="text-base font-extrabold text-slate-900 font-mono">
                            {formatCurrency(displayPrice, currency)}
                          </span>
                          <span className="text-[10px] text-slate-400 ml-1">/ pax</span>
                        </div>
                        <span className="text-[10px] text-teal-600 font-bold bg-teal-50 px-2 py-0.5 rounded-md">
                          Fees & Vetting Incl.
                        </span>
                      </div>

                      {/* Action Buttons */}
                      <div className="space-y-2 pt-1">
                        <div className="grid grid-cols-2 gap-2">
                          {inQuote ? (
                            <div className="flex items-center space-x-1">
                              <button
                                type="button"
                                onClick={() => setSelectedVisaForModal(visa)}
                                className="flex-1 py-2 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center justify-center space-x-1 cursor-pointer shadow-xs"
                                title="Click to edit applicants in quote"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>In Quote</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => quoteItem && removeProductFromQuote(quoteItem.id)}
                                className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-colors cursor-pointer"
                                title="Remove from Quote"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setSelectedVisaForModal(visa)}
                              className="py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs bg-[#00C6A6] hover:bg-[#00b395] text-slate-950"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Configure & Add</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setSelectedVisaDetails(visa)}
                            className="py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-300" />
                            <span>Checklist</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* 2. TRAVEL PROTECTION SECTION */}
      {/* ------------------------------------------------------------------- */}
      {(activeTab === 'ALL' || activeTab === 'PROTECTION') && (
        <div className="space-y-4 pt-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-black text-slate-900 font-sans">Travel Protection</h2>
              <span className="text-xs text-slate-400 font-mono">({filteredProtectionPlans.length})</span>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">International medical coverage, trip cancellation & baggage cover</span>
          </div>

          {filteredProtectionPlans.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500">
              No travel protection plans found matching your search.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredProtectionPlans.map(plan => {
                const inQuote = isItemInQuote(plan.id);
                const quoteItem = getQuoteItemByProductId(plan.id);
                const dailyPrice = plan.sellingPricePerDay > 0 ? plan.sellingPricePerDay : (plan.sellingPricePerTrip > 0 ? plan.sellingPricePerTrip / 7 : 0);
                const displayPrice = convertCurrency(dailyPrice, plan.currency || 'USD', currency);

                return (
                  <div
                    key={plan.id}
                    className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:border-blue-500 hover:shadow-md transition-all flex flex-col justify-between p-5 space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200 shrink-0">
                            <Shield className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[9px] font-black uppercase tracking-wider">
                              {plan.provider}
                            </span>
                            <h3 className="text-sm font-bold text-slate-900 mt-0.5 leading-snug">{plan.serviceName}</h3>
                          </div>
                        </div>
                      </div>

                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {plan.customerDescription || `Worldwide comprehensive travel and medical protection with 24/7 global emergency assistance.`}
                      </p>

                      {/* Coverage Breakdown */}
                      <div className="grid grid-cols-3 gap-2 bg-blue-50/50 p-2.5 rounded-xl border border-blue-100 text-center">
                        <div>
                          <span className="text-[9px] text-blue-600 font-bold uppercase block">Medical</span>
                          <span className="text-xs font-black text-slate-900 font-mono">${(plan.medicalCoverageAmount / 1000).toFixed(0)}k</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-blue-600 font-bold uppercase block">Cancellation</span>
                          <span className="text-xs font-black text-slate-900 font-mono">${(plan.tripCancellationAmount / 1000).toFixed(0)}k</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-blue-600 font-bold uppercase block">Baggage</span>
                          <span className="text-xs font-black text-slate-900 font-mono">${(plan.baggageLossAmount / 1000).toFixed(0)}k</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 pt-2 border-t border-slate-100">
                      <div className="flex items-baseline justify-between">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold uppercase">Rate</span>
                          <span className="text-base font-black text-slate-900 font-mono">
                            {formatCurrency(displayPrice, currency)}
                          </span>
                          <span className="text-[10px] text-slate-400 ml-1">/ day / pax</span>
                        </div>
                        <span className="text-[10px] text-blue-700 font-bold">24/7 Global Claims</span>
                      </div>

                      <div className="flex items-center space-x-2">
                        {inQuote ? (
                          <>
                            <button
                              type="button"
                              onClick={() => setActiveProtectionPlan(plan)}
                              className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>In Quote (Edit)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => quoteItem && removeProductFromQuote(quoteItem.id)}
                              className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-colors cursor-pointer"
                              title="Remove from Quote"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setActiveProtectionPlan(plan)}
                            className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Configure & Add</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* 3. GROUND & CONNECTIVITY SECTION */}
      {/* ------------------------------------------------------------------- */}
      {(activeTab === 'ALL' || activeTab === 'GROUND') && (
        <div className="space-y-6 pt-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              <h2 className="text-base font-black text-slate-900 font-sans">Ground & Connectivity Services</h2>
              <span className="text-xs text-slate-400 font-mono">({filteredVipServices.length + filteredConnectivityPlans.length})</span>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">VIP airport facilitation, luggage meet & greet, and 5G eSIM connectivity</span>
          </div>

          {/* Sub-grid: VIP Airport Services */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">VIP Airport & Ground Services</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredVipServices.map(svc => {
                const inQuote = isItemInQuote(svc.id);
                const quoteItem = getQuoteItemByProductId(svc.id);
                const displayPrice = convertCurrency(svc.sellingPrice, svc.currency || 'USD', currency);

                return (
                  <div
                    key={svc.id}
                    className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:border-purple-500 hover:shadow-md transition-all flex flex-col justify-between p-5 space-y-4"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[9px] font-black uppercase tracking-wider">
                          {svc.serviceType}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">{svc.supplierName}</span>
                      </div>

                      <h4 className="text-sm font-bold text-slate-900">{svc.name}</h4>
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {svc.shortDesc || svc.longDesc}
                      </p>

                      <div className="space-y-1 pt-1">
                        {(svc.inclusions || []).slice(0, 2).map((inc, i) => (
                          <div key={i} className="flex items-center space-x-1.5 text-[11px] text-slate-600">
                            <Check className="w-3 h-3 text-purple-600 shrink-0" />
                            <span className="truncate">{inc}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3 pt-2 border-t border-slate-100">
                      <div className="flex items-baseline justify-between">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold uppercase">Price</span>
                          <span className="text-base font-black text-slate-900 font-mono">
                            {formatCurrency(displayPrice, currency)}
                          </span>
                          <span className="text-[10px] text-slate-400 ml-1">({svc.pricingType.replace('_', ' ')})</span>
                        </div>
                        <span className="text-[10px] text-purple-700 font-bold">Guaranteed SLA</span>
                      </div>

                      <div className="flex items-center space-x-2">
                        {inQuote ? (
                          <>
                            <button
                              type="button"
                              onClick={() => setActiveVipService(svc)}
                              className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>In Quote (Edit)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => quoteItem && removeProductFromQuote(quoteItem.id)}
                              className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-colors cursor-pointer"
                              title="Remove from Quote"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setActiveVipService(svc)}
                            className="w-full py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Configure & Add</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sub-grid: 5G / eSIM Connectivity Plans */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">5G / eSIM Connectivity Plans</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredConnectivityPlans.map(conn => {
                const inQuote = isItemInQuote(conn.id);
                const quoteItem = getQuoteItemByProductId(conn.id);
                const displayPrice = convertCurrency(conn.sellingPrice, conn.currency || 'USD', currency);

                return (
                  <div
                    key={conn.id}
                    className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:border-teal-500 hover:shadow-md transition-all flex flex-col justify-between p-5 space-y-4"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 text-[9px] font-black uppercase tracking-wider">
                          {conn.networkSpeed}
                        </span>
                        <span className="text-[10px] text-teal-700 font-bold">{conn.coverageZone}</span>
                      </div>

                      <h4 className="text-sm font-bold text-slate-900">{conn.name}</h4>
                      
                      <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                        <div className="p-2 rounded-xl bg-teal-50/60 border border-teal-100">
                          <span className="text-[9px] text-teal-700 block font-bold">Data Allowance</span>
                          <span className="font-extrabold text-slate-900">{conn.dataAllowance}</span>
                        </div>
                        <div className="p-2 rounded-xl bg-teal-50/60 border border-teal-100">
                          <span className="text-[9px] text-teal-700 block font-bold">Validity</span>
                          <span className="font-extrabold text-slate-900">{conn.validityDays} Days</span>
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-500">
                        Instant digital QR activation. No physical SIM swap needed.
                      </p>
                    </div>

                    <div className="space-y-3 pt-2 border-t border-slate-100">
                      <div className="flex items-baseline justify-between">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold uppercase">Price</span>
                          <span className="text-base font-black text-slate-900 font-mono">
                            {formatCurrency(displayPrice, currency)}
                          </span>
                          <span className="text-[10px] text-slate-400 ml-1">/ eSIM</span>
                        </div>
                        <span className="text-[10px] text-teal-700 font-bold">Instant Delivery</span>
                      </div>

                      <div className="flex items-center space-x-2">
                        {inQuote ? (
                          <>
                            <button
                              type="button"
                              onClick={() => setActiveConnectivityPlan(conn)}
                              className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>In Quote (Edit)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => quoteItem && removeProductFromQuote(quoteItem.id)}
                              className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-colors cursor-pointer"
                              title="Remove from Quote"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setActiveConnectivityPlan(conn)}
                            className="w-full py-2 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Configure & Add</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* MODALS */}
      {/* ------------------------------------------------------------------- */}
      {/* Dedicated Visa Configurator Modal */}
      {selectedVisaForModal && (
        <AddVisaToQuoteModal
          visa={selectedVisaForModal as any}
          isOpen={Boolean(selectedVisaForModal)}
          onClose={() => setSelectedVisaForModal(null)}
          onSuccess={(v, details) => {
            setSelectedVisaForModal(null);
            setQuoteSuccessNotification({
              title: `${v.country} ${v.visaType} Added to Quote!`,
              subtitle: `Configured for ${details.applicants} ${details.applicants === 1 ? 'Applicant' : 'Applicants'} with complete documentation checklist.`
            });
          }}
        />
      )}

      {/* Travel Protection Config Modal */}
      {activeProtectionPlan && (
        <TravelProtectionConfigModal
          plan={activeProtectionPlan}
          currentCurrency={currency}
          initialDays={7}
          initialAdults={Math.max(1, paxConfig?.adults || 1)}
          initialChildren={paxConfig?.children || 0}
          onClose={() => setActiveProtectionPlan(null)}
          onConfirm={(days, adults, children) => handleConfirmAddProtection(activeProtectionPlan, days, adults, children)}
        />
      )}

      {/* VIP Ground Service Config Modal */}
      {activeVipService && (
        <VipGroundConfigModal
          service={activeVipService}
          currentCurrency={currency}
          initialDate={travelStartDate || new Date().toISOString().split('T')[0]}
          initialPax={Math.max(1, (paxConfig?.adults || 1) + (paxConfig?.children || 0))}
          onClose={() => setActiveVipService(null)}
          onConfirm={(date, pax) => handleConfirmAddVipService(activeVipService, date, pax)}
        />
      )}

      {/* 5G Connectivity Config Modal */}
      {activeConnectivityPlan && (
        <ConnectivityConfigModal
          plan={activeConnectivityPlan}
          currentCurrency={currency}
          initialQuantity={Math.max(1, paxConfig?.adults || 1)}
          onClose={() => setActiveConnectivityPlan(null)}
          onConfirm={(qty) => handleConfirmAddConnectivity(activeConnectivityPlan, qty)}
        />
      )}

      {/* Detailed Checklist Viewer Modal */}
      {selectedVisaDetails && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-hidden animate-in fade-in"
          onClick={() => setSelectedVisaDetails(null)}
        >
          <div 
            className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-[#00C6A6]/20 flex items-center justify-center text-[#00a88c]">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 font-sans">
                    {selectedVisaDetails.country} — {selectedVisaDetails.visaType}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Submission Format: {selectedVisaDetails.embassySubmissionType} • Turnaround: {selectedVisaDetails.processingTimeDays}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedVisaDetails(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] text-slate-400 block font-medium">Category</span>
                  <span className="font-extrabold text-slate-800">{selectedVisaDetails.category}</span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] text-slate-400 block font-medium">Turnaround</span>
                  <span className="font-extrabold text-slate-800">{selectedVisaDetails.processingTimeDays}</span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] text-slate-400 block font-medium">Max Stay</span>
                  <span className="font-extrabold text-slate-800">{selectedVisaDetails.stayDuration}</span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] text-slate-400 block font-medium">Validity</span>
                  <span className="font-extrabold text-slate-800">{selectedVisaDetails.validity}</span>
                </div>
              </div>

              {/* Document Checklist */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Official Document Checklist ({selectedVisaDetails.requiredDocuments.length} Items)
                  </h3>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                    Pre-Audit Guaranteed
                  </span>
                </div>
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2.5">
                  {selectedVisaDetails.requiredDocuments.map((doc, idx) => (
                    <div key={idx} className="flex items-start space-x-2.5">
                      <div className="w-5 h-5 rounded-full bg-[#00C6A6]/20 text-[#00a88c] flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                        {idx + 1}
                      </div>
                      <span className="text-slate-700 font-medium leading-relaxed">{doc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Photo & Financial Specs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border border-slate-200 space-y-1">
                  <h4 className="font-bold text-slate-900 flex items-center space-x-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#00C6A6]" />
                    <span>Photo Specifications</span>
                  </h4>
                  <p className="text-slate-600 text-[11px] leading-relaxed">{selectedVisaDetails.photoSpecs}</p>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 space-y-1">
                  <h4 className="font-bold text-slate-900 flex items-center space-x-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Financial Proof</span>
                  </h4>
                  <p className="text-slate-600 text-[11px] leading-relaxed">{selectedVisaDetails.financialRequirements}</p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0 gap-3">
              <div>
                <span className="text-[10px] text-slate-400 block font-bold uppercase">From Selling Rate</span>
                <span className="text-base font-extrabold text-slate-900 font-mono">
                  {formatCurrency(convertCurrency(selectedVisaDetails.suggestedSellingUSD, 'USD', currency), currency)}
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleDownloadChecklist(selectedVisaDetails)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-white text-slate-700 font-bold text-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Checklist</span>
                </button>

                <button
                  onClick={() => {
                    const v = selectedVisaDetails;
                    setSelectedVisaDetails(null);
                    setSelectedVisaForModal(v);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-[#00C6A6] hover:bg-[#00b395] text-slate-950 font-black text-xs transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Configure & Add to Cart</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
