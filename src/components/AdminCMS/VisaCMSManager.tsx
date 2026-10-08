import React, { Component, useState, useEffect, useMemo } from 'react';
import { AppDatabase } from '../../services/db';
import { 
  VisaProduct, 
  Destination, 
  StructuredVisaRequirement, 
  VisaAssistanceService,
  TravelProtectionPlan,
  VipGroundService,
  ConnectivityPlan,
  RequirementCategory,
  RequirementRequiredStatus,
  CurrencyCode,
  CommercialPricingDetails,
  MarginType
} from '../../types';
import { useAuth } from '../../context/AuthContext';
import { ImageUploadOrUrlInput } from '../ImageUploadOrUrlInput';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { EntitySEOSettingsTab } from './EntitySEOSettingsTab';
import { AdminWorkspaceLayout } from '../common/AdminWorkspaceLayout';
import { 
  createDefaultRequirementsForVisa, 
  createDefaultAssistanceServices,
  filterApplicableRequirements,
  generateCustomerVisaChecklist
} from '../../services/visaRequirementService';
import { formatCurrency, calculateUnifiedPrice } from '../../services/pricingEngine';
import { 
  FileText, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  CheckCircle2, 
  Clock, 
  DollarSign, 
  Globe2, 
  CheckSquare, 
  ListOrdered, 
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  Tag,
  ArrowUpDown,
  Copy,
  ChevronDown,
  ChevronUp,
  FileCheck,
  Shield,
  Smartphone,
  Sparkles,
  Plane,
  Eye,
  Sliders,
  Check,
  Table,
  Layers,
  History,
  Info,
  Calendar,
  Building2,
  FileSpreadsheet,
  AlertTriangle,
  Send,
  UserCheck,
  Percent,
  Receipt,
  Calculator,
  ArrowRight
} from 'lucide-react';

interface VisaCMSManagerProps {
  destinations: Destination[];
  initialSubTab?: string;
  onSubTabChange?: (tab: string) => void;
}

export type AncillaryServiceCategory = 'VISA_SERVICES' | 'TRAVEL_PROTECTION' | 'GROUND_CONNECTIVITY' | 'FIELD_PARITY';

export interface VisaCMSErrorBoundaryProps {
  children: React.ReactNode;
  fallbackTitle?: string;
}

export interface VisaCMSErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class VisaCMSErrorBoundary extends Component<VisaCMSErrorBoundaryProps, VisaCMSErrorBoundaryState> {
  public state: VisaCMSErrorBoundaryState = { hasError: false, error: null };

  constructor(props: VisaCMSErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): VisaCMSErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[VisaCMSManager] Uncaught rendering exception:', error, errorInfo);
  }

  render() {
    const self = this as any;
    if (self.state.hasError) {
      return (
        <div className="bg-white rounded-3xl border border-rose-200 p-8 sm:p-12 text-center max-w-xl mx-auto my-12 space-y-4 shadow-sm animate-in fade-in">
          <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto border border-rose-100">
            <AlertTriangle className="w-7 h-7 text-rose-600" />
          </div>
          <h3 className="text-lg font-black text-slate-900">
            {self.props.fallbackTitle || 'Visa & Ancillary Services encountered a component error.'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed font-mono bg-slate-50 p-3 rounded-xl border border-slate-200">
            {self.state.error?.message || 'An unexpected rendering error occurred while mounting this module.'}
          </p>
          <div className="pt-3 flex items-center justify-center gap-3">
            <button
              onClick={() => self.setState({ hasError: false, error: null })}
              className="px-5 py-2.5 bg-[#00C6A6] hover:bg-[#00E5C0] text-slate-950 rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs"
            >
              Retry
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return self.props.children;
  }
}

export const resolveAncillaryTab = (tab?: string): AncillaryServiceCategory => {
  if (!tab) return 'VISA_SERVICES';
  const clean = tab.toUpperCase().replace(/[-_]/g, '');
  if (clean === 'TRAVELPROTECTION' || clean === 'PROTECTION' || clean === 'INSURANCE') return 'TRAVEL_PROTECTION';
  if (clean === 'GROUNDCONNECTIVITY' || clean === 'GROUND' || clean === 'CONNECTIVITY' || clean === 'VIP' || clean === 'VIPCONNECTIVITY' || clean === 'VIPGROUND' || clean === 'ESIM') return 'GROUND_CONNECTIVITY';
  if (clean === 'MASTERSCHEMAMATRIX' || clean === 'FIELDPARITY' || clean === 'SCHEMAMATRIX' || clean === 'MATRIX' || clean === 'SCHEMA' || clean === 'PARITY') return 'FIELD_PARITY';
  return 'VISA_SERVICES';
};

export const VisaCMSManager: React.FC<VisaCMSManagerProps> = (props) => {
  return (
    <VisaCMSErrorBoundary fallbackTitle="Visa & Ancillary Services could not be loaded.">
      <VisaCMSManagerInner {...props} />
    </VisaCMSErrorBoundary>
  );
};

const VisaCMSManagerInner: React.FC<VisaCMSManagerProps> = ({ 
  destinations = [], 
  initialSubTab, 
  onSubTabChange 
}) => {
  const { user } = useAuth();
  const db = AppDatabase.getInstance();

  // Primary Workspace Tabs
  const [activeMainTab, setActiveMainTab] = useState<AncillaryServiceCategory>(() => resolveAncillaryTab(initialSubTab));

  // Synchronize with external tab selection
  useEffect(() => {
    if (initialSubTab) {
      setActiveMainTab(resolveAncillaryTab(initialSubTab));
    }
  }, [initialSubTab]);

  const handleTabSwitch = (tab: AncillaryServiceCategory) => {
    setActiveMainTab(tab);
    onSubTabChange?.(tab);
  };

  // Database States
  const [visas, setVisas] = useState<VisaProduct[]>(() => db.getVisas() || []);
  const [protectionPlans, setProtectionPlans] = useState<TravelProtectionPlan[]>(() => db.getTravelProtectionPlans() || []);
  const [vipServices, setVipServices] = useState<VipGroundService[]>(() => db.getVipGroundServices() || []);
  const [connectivityPlans, setConnectivityPlans] = useState<ConnectivityPlan[]>(() => db.getConnectivityPlans() || []);

  // Loading & Error States (Requirement #3: Explicit LOADING, EMPTY, ERROR, SUCCESS states)
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const handleReloadData = () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setVisas(db.getVisas() || []);
      setProtectionPlans(db.getTravelProtectionPlans() || []);
      setVipServices(db.getVipGroundServices() || []);
      setConnectivityPlans(db.getConnectivityPlans() || []);
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to reload services from database');
    } finally {
      setTimeout(() => setIsLoading(false), 200);
    }
  };

  const isVisaEmpty = (visas || []).length === 0;
  const isProtectionEmpty = (protectionPlans || []).length === 0;
  const isGroundEmpty = (vipServices || []).length === 0 && (connectivityPlans || []).length === 0;

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDestination, setSelectedDestination] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'DRAFT' | 'ARCHIVED'>('ALL');
  const [currencyFilter, setCurrencyFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Active Workspace / Drawer State for a Visa / Ancillary Service
  const [editingVisa, setEditingVisa] = useState<VisaProduct | null>(null);
  const [editingProtection, setEditingProtection] = useState<Partial<TravelProtectionPlan> | null>(null);
  const [editingVip, setEditingVip] = useState<Partial<VipGroundService> | null>(null);
  const [editingConnectivity, setEditingConnectivity] = useState<Partial<ConnectivityPlan> | null>(null);

  // Generic Service Workspace Drawer State
  const [isServiceDrawerOpen, setIsServiceDrawerOpen] = useState(false);
  const [serviceDrawerCategory, setServiceDrawerCategory] = useState<'VISA' | 'PROTECTION' | 'VIP' | 'CONNECTIVITY'>('VISA');
  const [workspaceTab, setWorkspaceTab] = useState<'BASIC' | 'COVERAGE' | 'CONFIG' | 'REQUIREMENTS' | 'PRICING' | 'ASSISTANCE' | 'UPSELLS' | 'CUSTOMER_PREVIEW' | 'SEO'>('PRICING');

  // Commercial Pricing Form State for the currently edited item
  const [pricingForm, setPricingForm] = useState<{
    currency: CurrencyCode;
    pricingUnit: string;
    nettPrice: string; // string for input management
    marginType: MarginType;
    marginValue: string;
    taxType: 'PERCENTAGE' | 'FIXED' | 'NOT_APPLICABLE';
    taxValue: string;
    serviceChargeType: 'PERCENTAGE' | 'FIXED' | 'NOT_APPLICABLE';
    serviceChargeValue: string;
  }>({
    currency: 'USD',
    pricingUnit: 'Per Applicant',
    nettPrice: '',
    marginType: 'PERCENTAGE',
    marginValue: '25',
    taxType: 'PERCENTAGE',
    taxValue: '10',
    serviceChargeType: 'FIXED',
    serviceChargeValue: '15'
  });

  // Requirements Builder Modal State (Inside Visa Workspace)
  const [isRequirementModalOpen, setIsRequirementModalOpen] = useState(false);
  const [editingRequirement, setEditingRequirement] = useState<StructuredVisaRequirement | null>(null);
  const [requirementDuplicateWarning, setRequirementDuplicateWarning] = useState<string | null>(null);

  // Assistance Service Modal State
  const [isAssistanceModalOpen, setIsAssistanceModalOpen] = useState(false);
  const [editingAssistance, setEditingAssistance] = useState<VisaAssistanceService | null>(null);

  // Delete target modal
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; type: 'VISA' | 'PROTECTION' | 'VIP' | 'CONNECTIVITY' } | null>(null);

  // Live DB Subscription
  useEffect(() => {
    return db.subscribe(() => {
      setVisas(db.getVisas());
      setProtectionPlans(db.getTravelProtectionPlans());
      setVipServices(db.getVipGroundServices());
      setConnectivityPlans(db.getConnectivityPlans());
    });
  }, [db]);

  // Unified Ancillary Inventory Items for the combined view
  const allAncillaryItems = useMemo(() => {
    const list: Array<{
      id: string;
      name: string;
      category: 'Visa Services' | 'Travel Protection' | 'Ground & Connectivity';
      rawCategory: 'VISA' | 'PROTECTION' | 'VIP' | 'CONNECTIVITY';
      serviceType: string;
      destination: string;
      provider: string;
      currency: CurrencyCode;
      nettPrice?: number;
      finalPrice: number;
      status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
      updatedAt?: string;
      originalItem: any;
      heroImage?: string;
    }> = [];

    // 1. Visas
    visas.forEach(v => {
      const finalPrice = v.pricing?.finalPrice ?? ((v.embassyFee || 0) + (v.serviceFee || 0));
      list.push({
        id: v.id,
        name: `${v.country} - ${v.visaType}`,
        category: 'Visa Services',
        rawCategory: 'VISA',
        serviceType: v.visaType,
        destination: v.country,
        provider: 'Consular Embassy & DMC Desk',
        currency: v.currency || 'USD',
        nettPrice: v.pricing?.nettPrice ?? v.embassyFee,
        finalPrice,
        status: v.status || 'ACTIVE',
        updatedAt: v.updatedAt || v.createdAt,
        originalItem: v,
        heroImage: v.heroImage
      });
    });

    // 2. Travel Protection
    protectionPlans.forEach(p => {
      const finalPrice = p.pricing?.finalPrice ?? p.sellingPricePerTrip;
      list.push({
        id: p.id,
        name: p.serviceName,
        category: 'Travel Protection',
        rawCategory: 'PROTECTION',
        serviceType: 'International Medical & Trip Insurance',
        destination: p.coverageArea || 'Worldwide',
        provider: p.provider || 'Approved Underwriter',
        currency: p.currency || 'USD',
        nettPrice: p.pricing?.nettPrice ?? p.netCostPerTrip,
        finalPrice,
        status: p.status || 'ACTIVE',
        updatedAt: p.updatedAt,
        originalItem: p
      });
    });

    // 3. VIP Ground Services
    vipServices.forEach(vip => {
      const finalPrice = vip.pricing?.finalPrice ?? vip.sellingPrice;
      const destName = (destinations || []).find(d => d.id === vip.destinationId)?.name || 'International Hub';
      const cleanType = (vip.serviceType || 'MEET_AND_GREET').replace(/_/g, ' ');
      list.push({
        id: vip.id,
        name: vip.name,
        category: 'Ground & Connectivity',
        rawCategory: 'VIP',
        serviceType: cleanType,
        destination: destName,
        provider: vip.supplierName || 'Executive Ground Partner',
        currency: vip.currency || 'USD',
        nettPrice: vip.pricing?.nettPrice ?? vip.netCost,
        finalPrice,
        status: vip.status || 'ACTIVE',
        updatedAt: vip.updatedAt,
        originalItem: vip
      });
    });

    // 4. 5G Connectivity
    connectivityPlans.forEach(c => {
      const finalPrice = c.pricing?.finalPrice ?? c.sellingPrice;
      list.push({
        id: c.id,
        name: c.name,
        category: 'Ground & Connectivity',
        rawCategory: 'CONNECTIVITY',
        serviceType: `5G eSIM (${c.dataAllowance} / ${c.validityDays} Days)`,
        destination: c.coverageZone || 'Regional',
        provider: 'TheUnbound Telecom Partner',
        currency: c.currency || 'USD',
        nettPrice: c.pricing?.nettPrice ?? c.netCost,
        finalPrice,
        status: c.status || 'ACTIVE',
        updatedAt: c.updatedAt,
        originalItem: c
      });
    });

    return list;
  }, [visas, protectionPlans, vipServices, connectivityPlans, destinations]);

  // Filtered Items
  const filteredItems = useMemo(() => {
    return allAncillaryItems.filter(item => {
      // Main tab filter
      if (activeMainTab === 'VISA_SERVICES' && item.rawCategory !== 'VISA') return false;
      if (activeMainTab === 'TRAVEL_PROTECTION' && item.rawCategory !== 'PROTECTION') return false;
      if (activeMainTab === 'GROUND_CONNECTIVITY' && item.rawCategory !== 'VIP' && item.rawCategory !== 'CONNECTIVITY') return false;

      // Category filter dropdown
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;

      // Destination filter
      if (selectedDestination !== 'all' && !(item.destination || '').toLowerCase().includes(selectedDestination.toLowerCase())) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;

      // Currency filter
      if (currencyFilter !== 'all' && item.currency !== currencyFilter) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches = 
          (item.name || '').toLowerCase().includes(q) ||
          (item.id || '').toLowerCase().includes(q) ||
          (item.destination || '').toLowerCase().includes(q) ||
          (item.provider || '').toLowerCase().includes(q) ||
          (item.serviceType || '').toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [allAncillaryItems, activeMainTab, categoryFilter, selectedDestination, statusFilter, currencyFilter, searchQuery]);

  // Central Live Pricing Calculation for the Active Form
  const livePricingCalculation = useMemo(() => {
    const rawNett = parseFloat(pricingForm.nettPrice);
    if (isNaN(rawNett) || rawNett <= 0) {
      return null;
    }

    const marginVal = parseFloat(pricingForm.marginValue) || 0;
    const taxVal = pricingForm.taxType === 'NOT_APPLICABLE' ? 0 : (parseFloat(pricingForm.taxValue) || 0);
    const feeVal = pricingForm.serviceChargeType === 'NOT_APPLICABLE' ? 0 : (parseFloat(pricingForm.serviceChargeValue) || 0);

    return calculateUnifiedPrice({
      nettPrice: rawNett,
      marginType: pricingForm.marginType,
      marginValue: marginVal,
      serviceChargeType: pricingForm.serviceChargeType === 'NOT_APPLICABLE' ? 'FIXED' : pricingForm.serviceChargeType,
      serviceChargeValue: feeVal,
      taxPercent: taxVal,
      taxApplication: 'ON_MARGIN',
      currency: pricingForm.currency
    });
  }, [pricingForm]);

  // --------------------------------------------------------------------------
  // OPEN SERVICE FOR EDITING OR CREATING
  // --------------------------------------------------------------------------
  const handleOpenCreateService = (category: 'VISA' | 'PROTECTION' | 'VIP' | 'CONNECTIVITY') => {
    const defaultDest = destinations[0] || { id: 'dest-japan', name: 'Japan' };
    setServiceDrawerCategory(category);
    setWorkspaceTab('BASIC');

    if (category === 'VISA') {
      const newId = `visa-${Date.now()}`;
      const newVisa: VisaProduct = {
        id: newId,
        country: defaultDest.name,
        countryCode: 'INTL',
        destinationId: defaultDest.id,
        visaType: 'Tourist E-Visa (Single Entry)',
        entryType: 'SINGLE_ENTRY',
        validityDays: 90,
        stayDurationDays: 30,
        processingTimeDays: 5,
        expressProcessingAvailable: true,
        expressProcessingTimeDays: 2,
        embassyFee: 35,
        serviceFee: 25,
        expressServiceFee: 50,
        currency: 'USD',
        description: 'Official electronic tourist visa for international leisure travel with complete document verification and DMC liaison.',
        documentsChecklist: [
          'Original Passport with minimum 6 months validity',
          '2 Recent passport photos on white background',
          'Confirmed flight and hotel accommodation vouchers',
          'Last 3 to 6 months bank statements'
        ],
        structuredRequirements: createDefaultRequirementsForVisa(newId, defaultDest.name, 'Tourist E-Visa'),
        assistanceServices: createDefaultAssistanceServices(newId),
        requirementVersion: 1,
        submissionSteps: [
          'Upload traveler details and scanned credentials',
          'DMC Visa Operations scrutiny & appointment scheduling',
          'Consulate lodgement & continuous tracking',
          'Electronic Visa grant dispatch'
        ],
        eligibilityNotes: [
          'Applicable for leisure tourism, trade fairs, and short visits',
          'Travelers must have clean travel history and verified hotel vouchers'
        ],
        downloadableForms: [],
        faqs: [],
        heroImage: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200&auto=format&fit=crop',
        status: 'ACTIVE',
        featured: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      setEditingVisa(newVisa);
      setEditingProtection(null);
      setEditingVip(null);
      setEditingConnectivity(null);

      // Populate pricing form
      setPricingForm({
        currency: newVisa.currency || 'USD',
        pricingUnit: 'Per Applicant',
        nettPrice: newVisa.embassyFee ? String(newVisa.embassyFee) : '',
        marginType: 'PERCENTAGE',
        marginValue: '25',
        taxType: 'PERCENTAGE',
        taxValue: '10',
        serviceChargeType: 'FIXED',
        serviceChargeValue: newVisa.serviceFee ? String(newVisa.serviceFee) : '15'
      });
    } else if (category === 'PROTECTION') {
      const newPlan: TravelProtectionPlan = {
        id: `prot-${Date.now()}`,
        serviceName: 'Comprehensive International Travel Insurance',
        provider: 'Allianz Global Assistance / Vetted Underwriter',
        coverageArea: 'Worldwide excl. US/Canada',
        medicalCoverageAmount: 250000,
        emergencyAssistanceIncluded: true,
        evacuationCoverageAmount: 100000,
        tripCancellationAmount: 5000,
        baggageLossAmount: 1500,
        validityDaysMax: 30,
        eligibilityAgeMin: 1,
        eligibilityAgeMax: 70,
        netCostPerDay: 2,
        netCostPerTrip: 30,
        sellingPricePerDay: 3.5,
        sellingPricePerTrip: 45,
        currency: 'USD',
        status: 'ACTIVE',
        terms: 'Complies with European Schengen Regulation (EC) 810/2009. 24/7 cashless medical network.',
        customerDescription: 'Consular-approved travel medical protection with cashless hospitalization and flight delay compensation.',
        inclusions: ['Cashless In-Patient Hospitalization', 'Emergency Medical Evacuation', 'Trip Interruption', 'Baggage Loss & Delay Compensation'],
        updatedAt: new Date().toISOString()
      };
      setEditingProtection(newPlan);
      setEditingVisa(null);
      setEditingVip(null);
      setEditingConnectivity(null);

      setPricingForm({
        currency: newPlan.currency || 'USD',
        pricingUnit: 'Per Traveller',
        nettPrice: String(newPlan.netCostPerTrip),
        marginType: 'PERCENTAGE',
        marginValue: '30',
        taxType: 'PERCENTAGE',
        taxValue: '10',
        serviceChargeType: 'FIXED',
        serviceChargeValue: '5'
      });
    } else if (category === 'VIP') {
      const newVip: VipGroundService = {
        id: `vip-${Date.now()}`,
        name: 'VIP Airport Meet & Assist (Arrival / Fast-Track)',
        serviceType: 'MEET_AND_GREET',
        destinationId: defaultDest.id,
        supplierName: 'Executive Ground Logistics Partner',
        shortDesc: 'Airside greeting at aerobridge gate with electric buggy and fast-track immigration escort.',
        longDesc: 'Premium airside meet and greet with dedicated concierge, priority immigration clearance, luggage assistance, and seamless chauffeur handover.',
        netCost: 120,
        defaultMarkupPercent: 25,
        sellingPrice: 150,
        pricingType: 'PER_PAX',
        currency: 'USD',
        inclusions: ['Airside Gate Greeting', 'Electric Buggy Transfer', 'Fast-Track Customs / Immigration', 'Luggage Porterage', 'Chauffeur Handover'],
        status: 'ACTIVE',
        updatedAt: new Date().toISOString()
      };
      setEditingVip(newVip);
      setEditingVisa(null);
      setEditingProtection(null);
      setEditingConnectivity(null);

      setPricingForm({
        currency: newVip.currency || 'USD',
        pricingUnit: 'Per Service',
        nettPrice: String(newVip.netCost),
        marginType: 'PERCENTAGE',
        marginValue: '25',
        taxType: 'PERCENTAGE',
        taxValue: '10',
        serviceChargeType: 'NOT_APPLICABLE',
        serviceChargeValue: '0'
      });
    } else if (category === 'CONNECTIVITY') {
      const newConn: ConnectivityPlan = {
        id: `conn-${Date.now()}`,
        name: 'Japan & Asia Regional 5G Unlimited eSIM',
        type: 'ESIM',
        coverageZone: 'Japan, South Korea, Taiwan, Singapore, Thailand',
        dataAllowance: '10GB High-Speed 5G',
        validityDays: 15,
        networkSpeed: '5G / 4G LTE High-Speed',
        netCost: 14,
        sellingPrice: 22,
        currency: 'USD',
        inclusions: ['Instant QR Code Activation', 'Zero Physical SIM Swapping', 'Hotspot / Tethering Enabled', 'Multi-Network Auto-Roaming'],
        status: 'ACTIVE',
        updatedAt: new Date().toISOString()
      };
      setEditingConnectivity(newConn);
      setEditingVisa(null);
      setEditingProtection(null);
      setEditingVip(null);

      setPricingForm({
        currency: newConn.currency || 'USD',
        pricingUnit: 'Per Unit',
        nettPrice: String(newConn.netCost),
        marginType: 'FIXED',
        marginValue: '6',
        taxType: 'PERCENTAGE',
        taxValue: '10',
        serviceChargeType: 'NOT_APPLICABLE',
        serviceChargeValue: '0'
      });
    }

    setIsServiceDrawerOpen(true);
  };

  const handleEditServiceItem = (item: any) => {
    setServiceDrawerCategory(item.rawCategory);
    setWorkspaceTab('PRICING');

    if (item.rawCategory === 'VISA') {
      const v: VisaProduct = item.originalItem;
      setEditingVisa(v);
      setEditingProtection(null);
      setEditingVip(null);
      setEditingConnectivity(null);

      const existingPricing = v.pricing;
      setPricingForm({
        currency: existingPricing?.currency || v.currency || 'USD',
        pricingUnit: existingPricing?.pricingUnit || 'Per Applicant',
        nettPrice: existingPricing?.nettPrice !== undefined ? String(existingPricing.nettPrice) : String(v.embassyFee || ''),
        marginType: (existingPricing?.marginType as MarginType) || 'PERCENTAGE',
        marginValue: existingPricing?.marginValue !== undefined ? String(existingPricing.marginValue) : '25',
        taxType: existingPricing?.taxType || 'PERCENTAGE',
        taxValue: existingPricing?.taxValue !== undefined ? String(existingPricing.taxValue) : '10',
        serviceChargeType: existingPricing?.serviceChargeType || 'FIXED',
        serviceChargeValue: existingPricing?.serviceChargeValue !== undefined ? String(existingPricing.serviceChargeValue) : String(v.serviceFee || '15')
      });
    } else if (item.rawCategory === 'PROTECTION') {
      const p: TravelProtectionPlan = item.originalItem;
      setEditingProtection(p);
      setEditingVisa(null);
      setEditingVip(null);
      setEditingConnectivity(null);

      const existingPricing = p.pricing;
      setPricingForm({
        currency: existingPricing?.currency || p.currency || 'USD',
        pricingUnit: existingPricing?.pricingUnit || 'Per Traveller',
        nettPrice: existingPricing?.nettPrice !== undefined ? String(existingPricing.nettPrice) : String(p.netCostPerTrip || ''),
        marginType: (existingPricing?.marginType as MarginType) || 'PERCENTAGE',
        marginValue: existingPricing?.marginValue !== undefined ? String(existingPricing.marginValue) : '30',
        taxType: existingPricing?.taxType || 'PERCENTAGE',
        taxValue: existingPricing?.taxValue !== undefined ? String(existingPricing.taxValue) : '10',
        serviceChargeType: existingPricing?.serviceChargeType || 'FIXED',
        serviceChargeValue: existingPricing?.serviceChargeValue !== undefined ? String(existingPricing.serviceChargeValue) : '5'
      });
    } else if (item.rawCategory === 'VIP') {
      const vip: VipGroundService = item.originalItem;
      setEditingVip(vip);
      setEditingVisa(null);
      setEditingProtection(null);
      setEditingConnectivity(null);

      const existingPricing = vip.pricing;
      setPricingForm({
        currency: existingPricing?.currency || vip.currency || 'USD',
        pricingUnit: existingPricing?.pricingUnit || 'Per Service',
        nettPrice: existingPricing?.nettPrice !== undefined ? String(existingPricing.nettPrice) : String(vip.netCost || ''),
        marginType: (existingPricing?.marginType as MarginType) || 'PERCENTAGE',
        marginValue: existingPricing?.marginValue !== undefined ? String(existingPricing.marginValue) : String(vip.defaultMarkupPercent || '25'),
        taxType: existingPricing?.taxType || 'PERCENTAGE',
        taxValue: existingPricing?.taxValue !== undefined ? String(existingPricing.taxValue) : '10',
        serviceChargeType: existingPricing?.serviceChargeType || 'NOT_APPLICABLE',
        serviceChargeValue: existingPricing?.serviceChargeValue !== undefined ? String(existingPricing.serviceChargeValue) : '0'
      });
    } else if (item.rawCategory === 'CONNECTIVITY') {
      const conn: ConnectivityPlan = item.originalItem;
      setEditingConnectivity(conn);
      setEditingVisa(null);
      setEditingProtection(null);
      setEditingVip(null);

      const existingPricing = conn.pricing;
      setPricingForm({
        currency: existingPricing?.currency || conn.currency || 'USD',
        pricingUnit: existingPricing?.pricingUnit || 'Per Unit',
        nettPrice: existingPricing?.nettPrice !== undefined ? String(existingPricing.nettPrice) : String(conn.netCost || ''),
        marginType: (existingPricing?.marginType as MarginType) || 'FIXED',
        marginValue: existingPricing?.marginValue !== undefined ? String(existingPricing.marginValue) : '6',
        taxType: existingPricing?.taxType || 'PERCENTAGE',
        taxValue: existingPricing?.taxValue !== undefined ? String(existingPricing.taxValue) : '10',
        serviceChargeType: existingPricing?.serviceChargeType || 'NOT_APPLICABLE',
        serviceChargeValue: existingPricing?.serviceChargeValue !== undefined ? String(existingPricing.serviceChargeValue) : '0'
      });
    }

    setIsServiceDrawerOpen(true);
  };

  // --------------------------------------------------------------------------
  // SAVE SERVICE WITH AUTHORITATIVE PRICING SNAPSHOT
  // --------------------------------------------------------------------------
  const handleSaveCurrentService = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const calc = livePricingCalculation;
    const finalPriceToSave = calc ? calc.finalPrice : 0;

    const pricingSnapshot: CommercialPricingDetails = {
      currency: pricingForm.currency,
      pricingUnit: pricingForm.pricingUnit,
      nettPrice: calc ? calc.nettPrice : (parseFloat(pricingForm.nettPrice) || 0),
      marginType: pricingForm.marginType,
      marginValue: parseFloat(pricingForm.marginValue) || 0,
      marginAmount: calc ? calc.marginAmount : 0,
      serviceChargeType: pricingForm.serviceChargeType,
      serviceChargeValue: parseFloat(pricingForm.serviceChargeValue) || 0,
      serviceChargeAmount: calc ? calc.serviceChargeAmount : 0,
      taxType: pricingForm.taxType,
      taxValue: parseFloat(pricingForm.taxValue) || 0,
      taxAmount: calc ? calc.taxAmount : 0,
      finalPrice: finalPriceToSave,
      pricingVersion: 1,
      lastUpdatedAt: new Date().toISOString()
    };

    if (serviceDrawerCategory === 'VISA' && editingVisa) {
      if (!editingVisa.country || !editingVisa.visaType) return;
      const syncedChecklist = editingVisa.structuredRequirements && editingVisa.structuredRequirements.length > 0
        ? editingVisa.structuredRequirements.map(r => r.name)
        : editingVisa.documentsChecklist || [];

      const updatedVisa: VisaProduct = {
        ...editingVisa,
        documentsChecklist: syncedChecklist,
        requirementVersion: (editingVisa.requirementVersion || 1) + 1,
        embassyFee: calc ? calc.nettPrice : (parseFloat(pricingForm.nettPrice) || editingVisa.embassyFee || 0),
        serviceFee: calc ? (calc.marginAmount + calc.serviceChargeAmount) : (editingVisa.serviceFee || 0),
        sellingPrice: finalPriceToSave,
        currency: pricingForm.currency,
        pricing: pricingSnapshot,
        updatedAt: new Date().toISOString()
      };

      db.saveVisa(updatedVisa, user);
      setEditingVisa(updatedVisa);
    } else if (serviceDrawerCategory === 'PROTECTION' && editingProtection) {
      if (!editingProtection.serviceName || !editingProtection.provider) return;
      const updatedProtection: TravelProtectionPlan = {
        ...(editingProtection as TravelProtectionPlan),
        currency: pricingForm.currency,
        netCostPerTrip: calc ? calc.nettPrice : (parseFloat(pricingForm.nettPrice) || 30),
        sellingPricePerTrip: finalPriceToSave,
        pricing: pricingSnapshot,
        updatedAt: new Date().toISOString()
      };

      db.saveTravelProtectionPlan(updatedProtection, user);
      setEditingProtection(updatedProtection);
    } else if (serviceDrawerCategory === 'VIP' && editingVip) {
      if (!editingVip.name || !editingVip.supplierName) return;
      const updatedVip: VipGroundService = {
        ...(editingVip as VipGroundService),
        currency: pricingForm.currency,
        netCost: calc ? calc.nettPrice : (parseFloat(pricingForm.nettPrice) || 100),
        sellingPrice: finalPriceToSave,
        pricing: pricingSnapshot,
        updatedAt: new Date().toISOString()
      };

      db.saveVipGroundService(updatedVip, user);
      setEditingVip(updatedVip);
    } else if (serviceDrawerCategory === 'CONNECTIVITY' && editingConnectivity) {
      if (!editingConnectivity.name || !editingConnectivity.dataAllowance) return;
      const updatedConn: ConnectivityPlan = {
        ...(editingConnectivity as ConnectivityPlan),
        currency: pricingForm.currency,
        netCost: calc ? calc.nettPrice : (parseFloat(pricingForm.nettPrice) || 10),
        sellingPrice: finalPriceToSave,
        pricing: pricingSnapshot,
        updatedAt: new Date().toISOString()
      };

      db.saveConnectivityPlan(updatedConn, user);
      setEditingConnectivity(updatedConn);
    }

    setIsServiceDrawerOpen(false);
  };

  // --------------------------------------------------------------------------
  // REQUIREMENTS BUILDER ACTIONS (FOR VISA SERVICES)
  // --------------------------------------------------------------------------
  const handleOpenAddRequirement = () => {
    if (!editingVisa) return;
    const currentReqs = editingVisa.structuredRequirements || [];
    const nextOrder = currentReqs.length + 1;
    
    setEditingRequirement({
      id: `REQ-${editingVisa.id}-${Date.now().toString(36).toUpperCase()}`,
      visaId: editingVisa.id,
      name: '',
      category: 'IDENTITY',
      description: '',
      requiredStatus: 'REQUIRED',
      applicableNationality: ['ALL'],
      applicableTravellerType: ['ALL'],
      documentConditions: {
        originalRequired: false,
        copyRequired: true,
        minValidityMonths: 6,
        blankPages: 2
      },
      displayOrder: nextOrder,
      status: 'ACTIVE',
      version: 1,
      createdAt: new Date().toISOString()
    });
    setRequirementDuplicateWarning(null);
    setIsRequirementModalOpen(true);
  };

  const handleSaveRequirement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVisa || !editingRequirement || !editingRequirement.name.trim()) return;

    const trimmedName = editingRequirement.name.trim();
    const existingReqs = editingVisa.structuredRequirements || [];

    const isDuplicate = existingReqs.some(
      r => r.id !== editingRequirement.id && r.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (isDuplicate) {
      setRequirementDuplicateWarning(`This requirement "${trimmedName}" already exists for this Visa configuration.`);
      return;
    }

    let updatedReqs: StructuredVisaRequirement[];
    const idx = existingReqs.findIndex(r => r.id === editingRequirement.id);
    if (idx >= 0) {
      updatedReqs = [...existingReqs];
      updatedReqs[idx] = { 
        ...editingRequirement, 
        name: trimmedName, 
        updatedAt: new Date().toISOString(),
        version: (editingRequirement.version || 1) + 1
      };
    } else {
      updatedReqs = [...existingReqs, { ...editingRequirement, name: trimmedName }];
    }

    updatedReqs.sort((a, b) => a.displayOrder - b.displayOrder);

    const updatedVisa = {
      ...editingVisa,
      structuredRequirements: updatedReqs,
      documentsChecklist: updatedReqs.map(r => r.name)
    };

    setEditingVisa(updatedVisa);
    db.saveVisa(updatedVisa, user);
    setIsRequirementModalOpen(false);
    setEditingRequirement(null);
    setRequirementDuplicateWarning(null);
  };

  const handleDuplicateRequirement = (req: StructuredVisaRequirement) => {
    if (!editingVisa) return;
    const existingReqs = editingVisa.structuredRequirements || [];
    const newReq: StructuredVisaRequirement = {
      ...req,
      id: `REQ-${editingVisa.id}-${Date.now().toString(36).toUpperCase()}`,
      name: `${req.name} (Copy)`,
      displayOrder: existingReqs.length + 1,
      version: 1,
      createdAt: new Date().toISOString()
    };
    const updated = [...existingReqs, newReq];
    const updatedVisa = {
      ...editingVisa,
      structuredRequirements: updated,
      documentsChecklist: updated.map(r => r.name)
    };
    setEditingVisa(updatedVisa);
    db.saveVisa(updatedVisa, user);
  };

  const handleReorderRequirement = (reqId: string, direction: 'UP' | 'DOWN') => {
    if (!editingVisa) return;
    const reqs = [...(editingVisa.structuredRequirements || [])].sort((a, b) => a.displayOrder - b.displayOrder);
    const index = reqs.findIndex(r => r.id === reqId);
    if (index < 0) return;
    if (direction === 'UP' && index === 0) return;
    if (direction === 'DOWN' && index === reqs.length - 1) return;

    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    const temp = reqs[index];
    reqs[index] = reqs[targetIndex];
    reqs[targetIndex] = temp;

    reqs.forEach((r, i) => {
      r.displayOrder = i + 1;
    });

    const updatedVisa = {
      ...editingVisa,
      structuredRequirements: reqs,
      documentsChecklist: reqs.map(r => r.name)
    };
    setEditingVisa(updatedVisa);
    db.saveVisa(updatedVisa, user);
  };

  const handleToggleRequirementStatus = (reqId: string) => {
    if (!editingVisa) return;
    const reqs = (editingVisa.structuredRequirements || []).map(r => {
      if (r.id === reqId) {
        return { ...r, status: r.status === 'ACTIVE' ? ('INACTIVE' as const) : ('ACTIVE' as const) };
      }
      return r;
    });
    const updatedVisa = {
      ...editingVisa,
      structuredRequirements: reqs,
      documentsChecklist: reqs.filter(r => r.status === 'ACTIVE').map(r => r.name)
    };
    setEditingVisa(updatedVisa);
    db.saveVisa(updatedVisa, user);
  };

  const handleDeleteRequirement = (reqId: string) => {
    if (!editingVisa) return;
    const reqs = (editingVisa.structuredRequirements || []).filter(r => r.id !== reqId);
    reqs.forEach((r, i) => { r.displayOrder = i + 1; });
    const updatedVisa = {
      ...editingVisa,
      structuredRequirements: reqs,
      documentsChecklist: reqs.map(r => r.name)
    };
    setEditingVisa(updatedVisa);
    db.saveVisa(updatedVisa, user);
  };

  // Field Parity Table Definition
  const fieldParityRows = [
    { category: 'Visa Product', cmsField: 'Visa ID', sheetTab: 'VISA', sheetColumn: 'visa_id', firestoreField: 'id', dataType: 'String', required: 'Yes', syncStatus: 'VERIFIED' },
    { category: 'Visa Product', cmsField: 'Destination ID', sheetTab: 'VISA', sheetColumn: 'destination_id', firestoreField: 'destinationId', dataType: 'String', required: 'Yes', syncStatus: 'VERIFIED' },
    { category: 'Visa Product', cmsField: 'Country / Jurisdiction', sheetTab: 'VISA', sheetColumn: 'country', firestoreField: 'country', dataType: 'String', required: 'Yes', syncStatus: 'VERIFIED' },
    { category: 'Visa Product', cmsField: 'Visa Classification', sheetTab: 'VISA', sheetColumn: 'visa_type', firestoreField: 'visaType', dataType: 'String', required: 'Yes', syncStatus: 'VERIFIED' },
    { category: 'Commercial Pricing', cmsField: 'Nett Price', sheetTab: 'VISA_RATES', sheetColumn: 'adult_nett', firestoreField: 'pricing.nettPrice / embassyFee', dataType: 'Number (Cost)', required: 'Yes', syncStatus: 'CENTRALIZED' },
    { category: 'Commercial Pricing', cmsField: 'Margin (Type & Value)', sheetTab: 'VISA_RATES', sheetColumn: 'markup_agent', firestoreField: 'pricing.marginValue / marginType', dataType: 'Percent / Fixed', required: 'Yes', syncStatus: 'CENTRALIZED' },
    { category: 'Commercial Pricing', cmsField: 'Service Charge', sheetTab: 'VISA_RATES', sheetColumn: 'service_fee', firestoreField: 'pricing.serviceChargeValue', dataType: 'Number / Percent', required: 'Yes', syncStatus: 'CENTRALIZED' },
    { category: 'Commercial Pricing', cmsField: 'Final Selling Price', sheetTab: 'VISA_RATES', sheetColumn: 'selling_price', firestoreField: 'pricing.finalPrice', dataType: 'Calculated Engine Output', required: 'Yes', syncStatus: 'AUTHORITATIVE' },
    { category: 'Operational Fleet', cmsField: 'Vehicles (Transfer / Private Tour)', sheetTab: 'MASTER_VEHICLES', sheetColumn: 'id / name / seatingCapacity', firestoreField: 'master_vehicles', dataType: 'VehicleMaster', required: 'Yes', syncStatus: 'AUTHORITATIVE' },
    { category: 'Operational Fleet', cmsField: 'Yachts (Private Yacht Charters)', sheetTab: 'MASTER_YACHTS', sheetColumn: 'id / name / capacity / length', firestoreField: 'master_yachts', dataType: 'YachtMaster', required: 'Yes', syncStatus: 'AUTHORITATIVE' },
    { category: 'Operational Fleet', cmsField: 'Ferries & Vessels (Marine Transits)', sheetTab: 'MASTER_FERRIES', sheetColumn: 'id / name / capacity / route', firestoreField: 'master_ferries', dataType: 'FerryMaster', required: 'Yes', syncStatus: 'AUTHORITATIVE' },
    { category: 'Travel Protection', cmsField: 'Medical Cover Amount', sheetTab: 'PROTECTION', sheetColumn: 'coverage_amount', firestoreField: 'medicalCoverageAmount', dataType: 'Number', required: 'Yes', syncStatus: 'DATABASE_BACKED' },
    { category: 'VIP Ground', cmsField: 'VIP Service Type', sheetTab: 'TRANSFER_ROUTES', sheetColumn: 'service_type', firestoreField: 'serviceType', dataType: 'Enum', required: 'Yes', syncStatus: 'VERIFIED' },
    { category: '5G Connectivity', cmsField: 'Data Allowance', sheetTab: 'PRODUCTS', sheetColumn: 'description', firestoreField: 'dataAllowance', dataType: 'String (e.g. 10GB)', required: 'Yes', syncStatus: 'DATABASE_BACKED' }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* ========================================================================= */}
      {/* TOP HEADER BANNER (THEUNBOUND BRANDED)                                    */}
      {/* ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 text-white p-6 sm:p-7 rounded-3xl shadow-xl border border-slate-800">
        <div>
          <div className="flex items-center space-x-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full bg-[#00C6A6]/20 text-[#00E5C0] border border-[#00C6A6]/30 text-[10px] font-black uppercase tracking-wider">
              Operations & Inventory
            </span>
            <span className="text-xs text-slate-400 font-mono">Consular • Protection • Ground Desk</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2.5">
            <FileCheck className="w-8 h-8 text-[#00C6A6]" />
            <span>Visa & Ancillary Services</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Centralized inventory management for Consular Visa applications, international travel insurance, VIP airport ground assistance, and regional 5G eSIM connectivity with authoritative commercial pricing.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {activeMainTab === 'VISA_SERVICES' && (
            <button
              onClick={() => handleOpenCreateService('VISA')}
              className="px-4 py-2.5 bg-[#00C6A6] hover:bg-[#00E5C0] text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Add Visa Service</span>
            </button>
          )}
          {activeMainTab === 'TRAVEL_PROTECTION' && (
            <button
              onClick={() => handleOpenCreateService('PROTECTION')}
              className="px-4 py-2.5 bg-[#00C6A6] hover:bg-[#00E5C0] text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Add Protection Plan</span>
            </button>
          )}
          {activeMainTab === 'GROUND_CONNECTIVITY' && (
            <>
              <button
                onClick={() => handleOpenCreateService('VIP')}
                className="px-4 py-2.5 bg-[#00C6A6] hover:bg-[#00E5C0] text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Add VIP Ground Service</span>
              </button>
              <button
                onClick={() => handleOpenCreateService('CONNECTIVITY')}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-black text-xs rounded-xl shadow-lg transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 border border-slate-700"
              >
                <Plus className="w-4 h-4 text-[#00C6A6]" />
                <span>Add eSIM Plan</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CATEGORY WORKSPACE NAVIGATION TABS                                        */}
      {/* ========================================================================= */}
      <div className="flex border-b border-slate-200 bg-white rounded-2xl p-1.5 shadow-xs overflow-x-auto gap-1">
        <button
          onClick={() => handleTabSwitch('VISA_SERVICES')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 shrink-0 cursor-pointer ${
            activeMainTab === 'VISA_SERVICES'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <FileText className="w-4 h-4 text-[#00C6A6]" />
          <span>Visa Services ({visas.length})</span>
        </button>

        <button
          onClick={() => handleTabSwitch('TRAVEL_PROTECTION')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 shrink-0 cursor-pointer ${
            activeMainTab === 'TRAVEL_PROTECTION'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Travel Protection ({protectionPlans.length})</span>
        </button>

        <button
          onClick={() => handleTabSwitch('GROUND_CONNECTIVITY')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 shrink-0 cursor-pointer ${
            activeMainTab === 'GROUND_CONNECTIVITY'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>Ground & Connectivity ({vipServices.length + connectivityPlans.length})</span>
        </button>

        <button
          onClick={() => handleTabSwitch('FIELD_PARITY')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 shrink-0 cursor-pointer ${
            activeMainTab === 'FIELD_PARITY'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-indigo-400" />
          <span>Master Schema Matrix</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SEARCH & FILTERS TOOLBAR                                                  */}
      {/* ========================================================================= */}
      {activeMainTab !== 'FIELD_PARITY' && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search services by name, product ID, destination, or provider..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#00C6A6] focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto flex-wrap sm:flex-nowrap">
            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 outline-none focus:border-[#00C6A6] cursor-pointer"
            >
              <option value="all">All Service Categories</option>
              <option value="Visa Services">Visa Services</option>
              <option value="Travel Protection">Travel Protection</option>
              <option value="Ground & Connectivity">Ground & Connectivity</option>
            </select>

            {/* Destination Filter */}
            <select
              value={selectedDestination}
              onChange={e => setSelectedDestination(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 outline-none focus:border-[#00C6A6] cursor-pointer"
            >
              <option value="all">All Destinations</option>
              {destinations.map(d => (
                <option key={d.id} value={d.name}>{d.name}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 outline-none focus:border-[#00C6A6] cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="DRAFT">Drafts</option>
              <option value="ARCHIVED">Archived</option>
            </select>

            {/* Currency Filter */}
            <select
              value={currencyFilter}
              onChange={e => setCurrencyFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 outline-none focus:border-[#00C6A6] cursor-pointer font-mono"
            >
              <option value="all">All Currencies</option>
              <option value="USD">USD ($)</option>
              <option value="JPY">JPY (¥)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="INR">INR (₹)</option>
            </select>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4 EXPLICIT STATES LIFECYCLE: LOADING | ERROR | EMPTY | SUCCESS            */}
      {/* ========================================================================= */}

      {/* 1. LOADING STATE */}
      {isLoading && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs space-y-4 animate-in fade-in">
          <div className="w-12 h-12 rounded-2xl bg-[#00C6A6]/10 text-[#008972] flex items-center justify-center mx-auto border border-[#00C6A6]/20">
            <Clock className="w-6 h-6 animate-spin" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {activeMainTab === 'VISA_SERVICES' && 'Loading Visa Services...'}
              {activeMainTab === 'TRAVEL_PROTECTION' && 'Loading Travel Protection...'}
              {activeMainTab === 'GROUND_CONNECTIVITY' && 'Loading Ground & Connectivity Services...'}
              {activeMainTab === 'FIELD_PARITY' && 'Loading Master Schema Matrix...'}
            </h3>
            <p className="text-xs text-slate-400 mt-1">Retrieving verified inventory from Firestore and master sync ledger.</p>
          </div>
        </div>
      )}

      {/* 2. ERROR STATE */}
      {!isLoading && loadError && (
        <div className="bg-white rounded-2xl border border-rose-200 p-10 text-center shadow-xs space-y-4 animate-in fade-in">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {activeMainTab === 'VISA_SERVICES' && 'Visa Services could not be loaded.'}
              {activeMainTab === 'TRAVEL_PROTECTION' && 'Travel Protection could not be loaded.'}
              {activeMainTab === 'GROUND_CONNECTIVITY' && 'Ground & Connectivity could not be loaded.'}
              {activeMainTab === 'FIELD_PARITY' && 'Master Schema Matrix could not be loaded.'}
            </h3>
            <p className="text-xs text-rose-600 mt-1 font-mono">{loadError}</p>
          </div>
          <div className="pt-2">
            <button
              onClick={handleReloadData}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* 3. DEDICATED EMPTY STATE (When catalog has zero records configured) */}
      {!isLoading && !loadError && activeMainTab === 'VISA_SERVICES' && isVisaEmpty && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs space-y-4 animate-in fade-in">
          <div className="w-14 h-14 rounded-2xl bg-[#00C6A6]/10 text-[#008972] flex items-center justify-center mx-auto border border-[#00C6A6]/20">
            <FileText className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-base font-bold text-slate-900">Visa Services</h3>
            <p className="text-xs text-slate-500 mt-1">
              No Visa Services available for this destination. Add your first consular visa requirements or sync from Master Google Sheets.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => handleOpenCreateService('VISA')}
              className="px-4 py-2.5 bg-[#00C6A6] hover:bg-[#00E5C0] text-slate-950 font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Visa Service</span>
            </button>
          </div>
        </div>
      )}

      {!isLoading && !loadError && activeMainTab === 'TRAVEL_PROTECTION' && isProtectionEmpty && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs space-y-4 animate-in fade-in">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-base font-bold text-slate-900">Travel Protection</h3>
            <p className="text-xs text-slate-500 mt-1">
              No Travel Protection services have been configured yet.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => handleOpenCreateService('PROTECTION')}
              className="px-4 py-2.5 bg-[#00C6A6] hover:bg-[#00E5C0] text-slate-950 font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Protection Plan</span>
            </button>
          </div>
        </div>
      )}

      {!isLoading && !loadError && activeMainTab === 'GROUND_CONNECTIVITY' && isGroundEmpty && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs space-y-4 animate-in fade-in">
          <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto border border-purple-100">
            <Sparkles className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-base font-bold text-slate-900">Ground & Connectivity</h3>
            <p className="text-xs text-slate-500 mt-1">
              No Ground & Connectivity services have been configured yet.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => handleOpenCreateService('VIP')}
              className="px-4 py-2.5 bg-[#00C6A6] hover:bg-[#00E5C0] text-slate-950 font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add VIP Ground Service</span>
            </button>
            <button
              onClick={() => handleOpenCreateService('CONNECTIVITY')}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#00C6A6]" />
              <span>Add eSIM Plan</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. SUCCESS STATE: MAIN LISTING TABLE (when category has records) */}
      {!isLoading && !loadError && activeMainTab !== 'FIELD_PARITY' && !(
        (activeMainTab === 'VISA_SERVICES' && isVisaEmpty) ||
        (activeMainTab === 'TRAVEL_PROTECTION' && isProtectionEmpty) ||
        (activeMainTab === 'GROUND_CONNECTIVITY' && isGroundEmpty)
      ) && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider font-bold">
                <tr>
                  <th className="py-3.5 px-4">Service Name & Identifier</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Destination / Coverage</th>
                  <th className="py-3.5 px-4">Supplier / Provider</th>
                  <th className="py-3.5 px-4">Final Selling Price</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <span>No services match your active search or filter criteria.</span>
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery('');
                            setCategoryFilter('all');
                            setSelectedDestination('all');
                            setStatusFilter('ALL');
                            setCurrencyFilter('all');
                          }}
                          className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                        >
                          Clear Search & Filters
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredItems.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Name & ID */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-3">
                          {item.heroImage ? (
                            <img
                              src={item.heroImage}
                              alt={item.name}
                              className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0 font-bold">
                              {item.rawCategory === 'VISA' && <FileText className="w-5 h-5 text-[#00C6A6]" />}
                              {item.rawCategory === 'PROTECTION' && <ShieldCheck className="w-5 h-5 text-emerald-500" />}
                              {item.rawCategory === 'VIP' && <Plane className="w-5 h-5 text-amber-500" />}
                              {item.rawCategory === 'CONNECTIVITY' && <Smartphone className="w-5 h-5 text-indigo-500" />}
                            </div>
                          )}
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 block text-sm truncate max-w-xs sm:max-w-md">
                              {item.name}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 block">
                              ID: {item.id} • {item.serviceType}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Category Badge */}
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                          item.rawCategory === 'VISA' ? 'bg-[#00C6A6]/10 text-[#008F77] border-[#00C6A6]/30' :
                          item.rawCategory === 'PROTECTION' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          item.rawCategory === 'VIP' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          'bg-indigo-50 text-indigo-700 border-indigo-200'
                        }`}>
                          {item.category}
                        </span>
                      </td>

                      {/* Destination / Coverage */}
                      <td className="py-3.5 px-4 font-medium text-slate-700">
                        <div className="flex items-center space-x-1.5">
                          <Globe2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-xs">{item.destination}</span>
                        </div>
                      </td>

                      {/* Supplier / Provider */}
                      <td className="py-3.5 px-4 text-slate-600">
                        <span className="text-xs truncate block max-w-xs">{item.provider}</span>
                      </td>

                      {/* Authoritative Final Selling Price */}
                      <td className="py-3.5 px-4">
                        <div className="font-black text-slate-900 text-sm font-mono text-[#008972]">
                          {formatCurrency(item.finalPrice, item.currency)}
                        </div>
                        {item.nettPrice !== undefined && (
                          <span className="text-[9px] text-slate-400 block font-mono">
                            Nett Base: {formatCurrency(item.nettPrice, item.currency)}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          item.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : item.status === 'DRAFT'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}>
                          {item.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => handleEditServiceItem(item)}
                            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-all cursor-pointer flex items-center space-x-1"
                            title="Edit Service & Commercial Pricing"
                          >
                            <Edit className="w-3.5 h-3.5 text-slate-600" />
                            <span>Edit</span>
                          </button>

                          {item.rawCategory === 'VISA' && (
                            <button
                              onClick={() => {
                                handleEditServiceItem(item);
                                setWorkspaceTab('REQUIREMENTS');
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-[#00C6A6] hover:text-slate-950 text-white font-bold text-xs transition-all shadow-xs cursor-pointer"
                              title="Manage Requirements"
                            >
                              Checklist
                            </button>
                          )}

                          <button
                            onClick={() => setDeleteTarget({ id: item.id, name: item.name, type: item.rawCategory })}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                            title="Delete Service"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: GOOGLE SHEETS & FIREBASE MASTER PARITY MATRIX                         */}
      {/* ========================================================================= */}
      {activeMainTab === 'FIELD_PARITY' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
              <span>Canonical Schema & Field Parity Architecture</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Guarantees strict bidirectional synchronization between Master Google Sheets (VISA, VISA_RATES, PROTECTION), Firebase Firestore, and the Admin Commercial Pricing Engine.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider font-bold">
                <tr>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">CMS Field Label</th>
                  <th className="py-3 px-4">Google Sheet Tab</th>
                  <th className="py-3 px-4">Sheet Column</th>
                  <th className="py-3 px-4">Firestore Field Path</th>
                  <th className="py-3 px-4">Data Type</th>
                  <th className="py-3 px-4">Parity Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {fieldParityRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-sans font-bold text-slate-800">{row.category}</td>
                    <td className="py-3 px-4 font-sans text-slate-700">{row.cmsField}</td>
                    <td className="py-3 px-4 text-indigo-700 bg-indigo-50/40">{row.sheetTab}</td>
                    <td className="py-3 px-4 text-slate-600">{row.sheetColumn}</td>
                    <td className="py-3 px-4 text-emerald-700">{row.firestoreField}</td>
                    <td className="py-3 px-4 text-slate-500 font-sans">{row.dataType}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                        {row.syncStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* WORKSPACE DRAWER / MODAL FOR ADDING & EDITING SERVICES                    */}
      {/* ========================================================================= */}
      {isServiceDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-6xl w-full overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[94vh] my-auto">
            
            {/* DRAWER HEADER */}
            <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0 border-b border-slate-800">
              <div className="flex items-center space-x-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-[#00C6A6]/20 border border-[#00C6A6]/30 flex items-center justify-center text-[#00E5C0] shrink-0">
                  {serviceDrawerCategory === 'VISA' && <FileText className="w-5 h-5" />}
                  {serviceDrawerCategory === 'PROTECTION' && <ShieldCheck className="w-5 h-5" />}
                  {serviceDrawerCategory === 'VIP' && <Plane className="w-5 h-5" />}
                  {serviceDrawerCategory === 'CONNECTIVITY' && <Smartphone className="w-5 h-5" />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#00C6A6] text-slate-950">
                      {serviceDrawerCategory === 'VISA' ? 'Visa Service' :
                       serviceDrawerCategory === 'PROTECTION' ? 'Travel Protection' :
                       serviceDrawerCategory === 'VIP' ? 'VIP Ground Service' : '5G eSIM Package'}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      ID: {editingVisa?.id || editingProtection?.id || editingVip?.id || editingConnectivity?.id || 'NEW'}
                    </span>
                  </div>
                  <h2 className="text-base sm:text-lg font-bold text-white truncate mt-0.5">
                    {editingVisa?.country ? `${editingVisa.country} - ${editingVisa.visaType}` :
                     editingProtection?.serviceName || editingVip?.name || editingConnectivity?.name || 'Configure Service'}
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsServiceDrawerOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* DRAWER BODY & DUAL COLUMN WORKSPACE */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1">
              <AdminWorkspaceLayout
                sidebar={
                  <div className="space-y-6">
                    {/* Compact Identity & Preview Context Panel */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 shadow-xs text-xs text-slate-700">
                      <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Context Summary</h4>
                      <div className="space-y-2">
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Service</span>
                          <span className="font-bold text-slate-900 leading-snug">
                            {editingVisa?.country ? `${editingVisa.country} - ${editingVisa.visaType}` :
                             editingProtection?.serviceName || editingVip?.name || editingConnectivity?.name || 'New Service'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Category</span>
                          <span className="font-medium text-slate-800">
                            {serviceDrawerCategory === 'VISA' ? 'Visa Services' :
                             serviceDrawerCategory === 'PROTECTION' ? 'Travel Protection' :
                             serviceDrawerCategory === 'VIP' ? 'VIP Ground Service' : '5G eSIM Package'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Destination / Coverage</span>
                          <span className="font-medium text-slate-800">
                            {editingVisa?.country || editingProtection?.coverageArea || editingVip?.destinationId || editingConnectivity?.coverageZone || 'Regional / Global'}
                          </span>
                        </div>
                        <div className="pt-2.5 border-t border-slate-200">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Authoritative Final Price</span>
                          <div className="text-base font-black text-[#008972] font-mono mt-0.5">
                            {formatCurrency(livePricingCalculation?.finalPrice || 0, pricingForm.currency)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Vertical Side Steps Selector */}
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs divide-y divide-slate-100">
                      <button
                        type="button"
                        onClick={() => setWorkspaceTab('BASIC')}
                        className={`w-full text-left p-3.5 transition-all text-xs font-bold flex items-center space-x-2.5 cursor-pointer ${
                          workspaceTab === 'BASIC'
                            ? 'bg-[#00C6A6]/10 text-slate-950 font-black border-l-4 border-[#00C6A6]'
                            : 'hover:bg-slate-50 text-slate-600'
                        }`}
                      >
                        <Layers className="w-4 h-4 text-slate-400" />
                        <span>1. Basic Info</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setWorkspaceTab('COVERAGE')}
                        className={`w-full text-left p-3.5 transition-all text-xs font-bold flex items-center space-x-2.5 cursor-pointer ${
                          workspaceTab === 'COVERAGE'
                            ? 'bg-[#00C6A6]/10 text-slate-950 font-black border-l-4 border-[#00C6A6]'
                            : 'hover:bg-slate-50 text-slate-600'
                        }`}
                      >
                        <Globe2 className="w-4 h-4 text-slate-400" />
                        <span>2. Destination & Coverage</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setWorkspaceTab('CONFIG')}
                        className={`w-full text-left p-3.5 transition-all text-xs font-bold flex items-center space-x-2.5 cursor-pointer ${
                          workspaceTab === 'CONFIG'
                            ? 'bg-[#00C6A6]/10 text-slate-950 font-black border-l-4 border-[#00C6A6]'
                            : 'hover:bg-slate-50 text-slate-600'
                        }`}
                      >
                        <Sliders className="w-4 h-4 text-slate-400" />
                        <span>3. Configuration</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setWorkspaceTab('PRICING')}
                        className={`w-full text-left p-3.5 transition-all text-xs font-bold flex items-center space-x-2.5 cursor-pointer ${
                          workspaceTab === 'PRICING'
                            ? 'bg-[#00C6A6]/10 text-[#008F77] font-black border-l-4 border-[#00C6A6]'
                            : 'hover:bg-slate-50 text-slate-600'
                        }`}
                      >
                        <Calculator className="w-4 h-4 text-slate-400" />
                        <span>4. Commercial Pricing</span>
                      </button>

                      {serviceDrawerCategory === 'VISA' && (
                        <button
                          type="button"
                          onClick={() => setWorkspaceTab('REQUIREMENTS')}
                          className={`w-full text-left p-3.5 transition-all text-xs font-bold flex items-center space-x-2.5 cursor-pointer ${
                            workspaceTab === 'REQUIREMENTS'
                              ? 'bg-[#00C6A6]/10 text-slate-950 font-black border-l-4 border-[#00C6A6]'
                              : 'hover:bg-slate-50 text-slate-600'
                          }`}
                        >
                          <FileText className="w-4 h-4 text-slate-400" />
                          <span>5. Requirements ({editingVisa?.structuredRequirements?.length || 0})</span>
                        </button>
                      )}

                      {serviceDrawerCategory === 'VISA' && (
                        <button
                          type="button"
                          onClick={() => setWorkspaceTab('CUSTOMER_PREVIEW')}
                          className={`w-full text-left p-3.5 transition-all text-xs font-bold flex items-center space-x-2.5 cursor-pointer ${
                            workspaceTab === 'CUSTOMER_PREVIEW'
                              ? 'bg-[#00C6A6]/10 text-slate-950 font-black border-l-4 border-[#00C6A6]'
                              : 'hover:bg-slate-50 text-slate-600'
                          }`}
                        >
                          <Eye className="w-4 h-4 text-slate-400" />
                          <span>Checklist Preview</span>
                        </button>
                      )}
                    </div>
                  </div>
                }
                content={
                  <div className="space-y-6">
                    {/* Dynamic Step Content Workspace */}
              
              {/* ================================================================= */}
              {/* WORKSPACE TAB 1: BASIC INFORMATION                               */}
              {/* ================================================================= */}
              {workspaceTab === 'BASIC' && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Service Title / Name *</label>
                      <input
                        type="text"
                        required
                        value={
                          serviceDrawerCategory === 'VISA' ? (editingVisa?.country ? `${editingVisa.country} - ${editingVisa.visaType}` : '') :
                          serviceDrawerCategory === 'PROTECTION' ? (editingProtection?.serviceName || '') :
                          serviceDrawerCategory === 'VIP' ? (editingVip?.name || '') :
                          (editingConnectivity?.name || '')
                        }
                        onChange={e => {
                          const val = e.target.value;
                          if (serviceDrawerCategory === 'VISA' && editingVisa) {
                            setEditingVisa({ ...editingVisa, visaType: val });
                          } else if (serviceDrawerCategory === 'PROTECTION' && editingProtection) {
                            setEditingProtection({ ...editingProtection, serviceName: val });
                          } else if (serviceDrawerCategory === 'VIP' && editingVip) {
                            setEditingVip({ ...editingVip, name: val });
                          } else if (serviceDrawerCategory === 'CONNECTIVITY' && editingConnectivity) {
                            setEditingConnectivity({ ...editingConnectivity, name: val });
                          }
                        }}
                        className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none focus:border-[#00C6A6]"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Service Category</label>
                      <input
                        type="text"
                        disabled
                        value={
                          serviceDrawerCategory === 'VISA' ? 'Visa Services' :
                          serviceDrawerCategory === 'PROTECTION' ? 'Travel Protection' :
                          serviceDrawerCategory === 'VIP' ? 'Ground & Connectivity (VIP Ground)' :
                          'Ground & Connectivity (5G eSIM)'
                        }
                        className="w-full px-3.5 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-500 font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Description</label>
                    <textarea
                      rows={3}
                      value={
                        serviceDrawerCategory === 'VISA' ? (editingVisa?.description || '') :
                        serviceDrawerCategory === 'PROTECTION' ? (editingProtection?.customerDescription || '') :
                        serviceDrawerCategory === 'VIP' ? (editingVip?.longDesc || editingVip?.shortDesc || '') :
                        (editingConnectivity?.inclusions?.join('\n') || '')
                      }
                      onChange={e => {
                        const val = e.target.value;
                        if (serviceDrawerCategory === 'VISA' && editingVisa) {
                          setEditingVisa({ ...editingVisa, description: val });
                        } else if (serviceDrawerCategory === 'PROTECTION' && editingProtection) {
                          setEditingProtection({ ...editingProtection, customerDescription: val });
                        } else if (serviceDrawerCategory === 'VIP' && editingVip) {
                          setEditingVip({ ...editingVip, longDesc: val, shortDesc: val });
                        }
                      }}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none focus:border-[#00C6A6]"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Hero Image URL</label>
                    <ImageUploadOrUrlInput
                      value={editingVisa?.heroImage || ''}
                      onChange={url => {
                        if (editingVisa) setEditingVisa({ ...editingVisa, heroImage: url });
                      }}
                      label="Service Visual Banner"
                    />
                  </div>
                </div>
              )}

              {/* ================================================================= */}
              {/* WORKSPACE TAB 2: DESTINATION & COVERAGE                           */}
              {/* ================================================================= */}
              {workspaceTab === 'COVERAGE' && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Destination Master Jurisdiction</label>
                      <select
                        value={
                          serviceDrawerCategory === 'VISA' ? (editingVisa?.destinationId || '') :
                          serviceDrawerCategory === 'VIP' ? (editingVip?.destinationId || '') :
                          (destinations[0]?.id || '')
                        }
                        onChange={e => {
                          const dId = e.target.value;
                          const found = destinations.find(d => d.id === dId);
                          if (serviceDrawerCategory === 'VISA' && editingVisa) {
                            setEditingVisa({
                              ...editingVisa,
                              destinationId: dId,
                              country: found?.name || editingVisa.country
                            });
                          } else if (serviceDrawerCategory === 'VIP' && editingVip) {
                            setEditingVip({ ...editingVip, destinationId: dId });
                          }
                        }}
                        className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none focus:border-[#00C6A6] cursor-pointer"
                      >
                        {destinations.map(d => (
                          <option key={d.id} value={d.id}>{d.name} ({d.country || 'International'})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Coverage Area Description</label>
                      <input
                        type="text"
                        value={
                          serviceDrawerCategory === 'PROTECTION' ? (editingProtection?.coverageArea || '') :
                          serviceDrawerCategory === 'CONNECTIVITY' ? (editingConnectivity?.coverageZone || '') :
                          (editingVisa?.country || 'Jurisdiction Specific')
                        }
                        onChange={e => {
                          const val = e.target.value;
                          if (serviceDrawerCategory === 'PROTECTION' && editingProtection) {
                            setEditingProtection({ ...editingProtection, coverageArea: val });
                          } else if (serviceDrawerCategory === 'CONNECTIVITY' && editingConnectivity) {
                            setEditingConnectivity({ ...editingConnectivity, coverageZone: val });
                          }
                        }}
                        placeholder="e.g. Worldwide excl. US/Canada, Schengen, Tokyo Haneda Airport"
                        className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none focus:border-[#00C6A6]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ================================================================= */}
              {/* WORKSPACE TAB 3: SERVICE CONFIGURATION                            */}
              {/* ================================================================= */}
              {workspaceTab === 'CONFIG' && (
                <div className="space-y-4 text-xs">
                  {serviceDrawerCategory === 'VISA' && editingVisa && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Entry Classification</label>
                        <select
                          value={editingVisa.entryType}
                          onChange={e => setEditingVisa({ ...editingVisa, entryType: e.target.value as any })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none"
                        >
                          <option value="SINGLE_ENTRY">Single Entry</option>
                          <option value="DOUBLE_ENTRY">Double Entry</option>
                          <option value="MULTIPLE_ENTRY">Multiple Entry</option>
                        </select>
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Validity (Days)</label>
                        <input
                          type="number"
                          value={editingVisa.validityDays !== undefined && !Number.isNaN(editingVisa.validityDays) ? editingVisa.validityDays : ''}
                          onChange={e => setEditingVisa({ ...editingVisa, validityDays: Number(e.target.value) })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Permitted Stay (Days)</label>
                        <input
                          type="number"
                          value={editingVisa.stayDurationDays !== undefined && !Number.isNaN(editingVisa.stayDurationDays) ? editingVisa.stayDurationDays : ''}
                          onChange={e => setEditingVisa({ ...editingVisa, stayDurationDays: Number(e.target.value) })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {serviceDrawerCategory === 'PROTECTION' && editingProtection && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Underwriter / Provider</label>
                        <input
                          type="text"
                          value={editingProtection.provider || ''}
                          onChange={e => setEditingProtection({ ...editingProtection, provider: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Medical Coverage Limit ($)</label>
                        <input
                          type="number"
                          value={editingProtection.medicalCoverageAmount || 250000}
                          onChange={e => setEditingProtection({ ...editingProtection, medicalCoverageAmount: Number(e.target.value) })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {serviceDrawerCategory === 'VIP' && editingVip && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">VIP Service Subcategory</label>
                        <select
                          value={editingVip.serviceType || 'MEET_AND_GREET'}
                          onChange={e => setEditingVip({ ...editingVip, serviceType: e.target.value as any })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none"
                        >
                          <option value="MEET_AND_GREET">Meet & Greet Concierge</option>
                          <option value="FAST_TRACK">Fast Track Immigration</option>
                          <option value="VIP_TRANSFER">Airside Transfer</option>
                          <option value="LOUNGE_ACCESS">Executive Lounge Access</option>
                          <option value="PORTERAGE">Baggage Porterage</option>
                        </select>
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Executive Ground Partner</label>
                        <input
                          type="text"
                          value={editingVip.supplierName || ''}
                          onChange={e => setEditingVip({ ...editingVip, supplierName: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {serviceDrawerCategory === 'CONNECTIVITY' && editingConnectivity && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Data Allowance</label>
                        <input
                          type="text"
                          value={editingConnectivity.dataAllowance || ''}
                          onChange={e => setEditingConnectivity({ ...editingConnectivity, dataAllowance: e.target.value })}
                          placeholder="e.g. 10GB High-Speed, Unlimited"
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Validity (Days)</label>
                        <input
                          type="number"
                          value={editingConnectivity.validityDays !== undefined && !Number.isNaN(editingConnectivity.validityDays) ? editingConnectivity.validityDays : 15}
                          onChange={e => setEditingConnectivity({ ...editingConnectivity, validityDays: Number(e.target.value) })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ================================================================= */}
              {/* WORKSPACE TAB 4: COMMERCIAL PRICING (THE CORE UPDATE)             */}
              {/* ================================================================= */}
              {workspaceTab === 'PRICING' && (
                <div className="space-y-6">
                  <div className="bg-slate-900 text-white p-5 sm:p-6 rounded-3xl border border-slate-800 shadow-xl space-y-6">
                    
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-[#00E5C0] block">
                          Central Commercial Pricing Engine
                        </span>
                        <h3 className="text-lg font-black text-white flex items-center gap-2">
                          <Receipt className="w-5 h-5 text-[#00C6A6]" />
                          <span>Commercial Tariff Configuration</span>
                        </h3>
                      </div>
                      <span className="text-xs text-slate-400 font-mono">
                        Nett + Margin + Service Charge = Final Price
                      </span>
                    </div>

                    {/* Inputs Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                      
                      {/* Currency */}
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 block mb-1.5">
                          Currency
                        </label>
                        <select
                          value={pricingForm.currency}
                          onChange={e => setPricingForm({ ...pricingForm, currency: e.target.value as CurrencyCode })}
                          className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold outline-none focus:border-[#00C6A6] cursor-pointer"
                        >
                          <option value="USD">USD ($)</option>
                          <option value="JPY">JPY (¥)</option>
                          <option value="EUR">EUR (€)</option>
                          <option value="GBP">GBP (£)</option>
                          <option value="INR">INR (₹)</option>
                          <option value="AED">AED (AED)</option>
                          <option value="THB">THB (฿)</option>
                          <option value="SGD">SGD (S$)</option>
                        </select>
                      </div>

                      {/* Pricing Unit */}
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 block mb-1.5">
                          Pricing Unit
                        </label>
                        <select
                          value={pricingForm.pricingUnit}
                          onChange={e => setPricingForm({ ...pricingForm, pricingUnit: e.target.value })}
                          className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold outline-none focus:border-[#00C6A6] cursor-pointer"
                        >
                          <option value="Per Applicant">Per Applicant</option>
                          <option value="Per Traveller">Per Traveller</option>
                          <option value="Per Trip">Per Trip</option>
                          <option value="Per Service">Per Service</option>
                          <option value="Per Unit">Per Unit</option>
                          <option value="Per Day">Per Day</option>
                        </select>
                      </div>

                      {/* Nett Price (Required Base Cost) */}
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 block mb-1.5 flex items-center justify-between">
                          <span>Nett Price (Base Cost) *</span>
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            placeholder="e.g. 5000"
                            value={pricingForm.nettPrice}
                            onChange={e => setPricingForm({ ...pricingForm, nettPrice: e.target.value })}
                            className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono font-bold outline-none focus:border-[#00C6A6]"
                          />
                        </div>
                      </div>

                      {/* Margin Type */}
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 block mb-1.5">
                          Margin Type
                        </label>
                        <select
                          value={pricingForm.marginType}
                          onChange={e => setPricingForm({ ...pricingForm, marginType: e.target.value as MarginType })}
                          className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold outline-none focus:border-[#00C6A6] cursor-pointer"
                        >
                          <option value="PERCENTAGE">Percentage (%)</option>
                          <option value="FIXED">Fixed Amount</option>
                        </select>
                      </div>

                      {/* Margin Value */}
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 block mb-1.5">
                          Margin {pricingForm.marginType === 'PERCENTAGE' ? '(%)' : '(Fixed Amount)'}
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={pricingForm.marginValue}
                          onChange={e => setPricingForm({ ...pricingForm, marginValue: e.target.value })}
                          className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono font-bold outline-none focus:border-[#00C6A6]"
                        />
                      </div>

                      {/* TAX Type */}
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 block mb-1.5">
                          TAX Type
                        </label>
                        <select
                          value={pricingForm.taxType}
                          onChange={e => setPricingForm({ ...pricingForm, taxType: e.target.value as any })}
                          className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold outline-none focus:border-[#00C6A6] cursor-pointer"
                        >
                          <option value="PERCENTAGE">Percentage (%) on Margin</option>
                          <option value="NOT_APPLICABLE">Not Applicable (0%)</option>
                        </select>
                      </div>

                      {/* TAX Value */}
                      {pricingForm.taxType !== 'NOT_APPLICABLE' && (
                        <div>
                          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 block mb-1.5">
                            TAX (%)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={pricingForm.taxValue}
                            onChange={e => setPricingForm({ ...pricingForm, taxValue: e.target.value })}
                            className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono font-bold outline-none focus:border-[#00C6A6]"
                          />
                        </div>
                      )}

                      {/* Service Charge Type */}
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 block mb-1.5">
                          Service Charge Type
                        </label>
                        <select
                          value={pricingForm.serviceChargeType}
                          onChange={e => setPricingForm({ ...pricingForm, serviceChargeType: e.target.value as any })}
                          className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold outline-none focus:border-[#00C6A6] cursor-pointer"
                        >
                          <option value="FIXED">Fixed Amount</option>
                          <option value="PERCENTAGE">Percentage (%)</option>
                          <option value="NOT_APPLICABLE">Not Applicable (0)</option>
                        </select>
                      </div>

                      {/* Service Charge Value */}
                      {pricingForm.serviceChargeType !== 'NOT_APPLICABLE' && (
                        <div>
                          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 block mb-1.5">
                            Service Charge Value
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={pricingForm.serviceChargeValue}
                            onChange={e => setPricingForm({ ...pricingForm, serviceChargeValue: e.target.value })}
                            className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono font-bold outline-none focus:border-[#00C6A6]"
                          />
                        </div>
                      )}
                    </div>

                    {/* LIVE PRICING PREVIEW (ADMIN ONLY) */}
                    <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
                      <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                          <ShieldCheck className="w-4 h-4 text-[#00C6A6]" />
                          <span>Internal Pricing Breakdown (Admin Only)</span>
                        </span>
                        <span className="text-[10px] text-[#00E5C0] font-mono">
                          Protected from B2B Agent View
                        </span>
                      </div>

                      {livePricingCalculation ? (
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
                          <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                            <span className="text-[10px] text-slate-400 block">1. Nett Base Cost</span>
                            <span className="text-sm font-bold text-slate-200 font-mono">
                              {formatCurrency(livePricingCalculation.nettPrice, pricingForm.currency)}
                            </span>
                          </div>

                          <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                            <span className="text-[10px] text-slate-400 block">2. Margin</span>
                            <span className="text-sm font-bold text-slate-200 font-mono">
                              +{formatCurrency(livePricingCalculation.marginAmount, pricingForm.currency)}
                            </span>
                          </div>

                          <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                            <span className="text-[10px] text-slate-400 block">3. Service Charge</span>
                            <span className="text-sm font-bold text-slate-200 font-mono">
                              +{formatCurrency(livePricingCalculation.serviceChargeAmount, pricingForm.currency)}
                            </span>
                          </div>

                          <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                            <span className="text-[10px] text-slate-400 block">4. Tax Amount</span>
                            <span className="text-sm font-bold text-slate-200 font-mono">
                              +{formatCurrency(livePricingCalculation.taxAmount, pricingForm.currency)}
                            </span>
                          </div>

                          <div className="bg-emerald-950/70 p-2.5 rounded-xl border border-emerald-500/40 col-span-2 sm:col-span-1">
                            <span className="text-[10px] text-[#00E5C0] font-bold block">FINAL SELLING PRICE</span>
                            <span className="text-base sm:text-lg font-black text-[#00E5C0] font-mono">
                              {formatCurrency(livePricingCalculation.finalPrice, pricingForm.currency)}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="py-4 text-center text-slate-400 text-xs">
                          Complete the Nett Price and commercial fields above to calculate the Final Price.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ================================================================= */}
              {/* WORKSPACE TAB 5: REQUIREMENTS (FOR VISA SERVICES)                 */}
              {/* ================================================================= */}
              {workspaceTab === 'REQUIREMENTS' && serviceDrawerCategory === 'VISA' && editingVisa && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <div>
                      <h4 className="text-sm font-black text-slate-900">Structured Consular Requirements</h4>
                      <p className="text-[11px] text-slate-500">
                        Total {editingVisa.structuredRequirements?.length || 0} authoritative document checklist criteria.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleOpenAddRequirement}
                      className="px-3.5 py-2 bg-[#00C6A6] hover:bg-[#00E5C0] text-slate-950 font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Requirement</span>
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {(editingVisa.structuredRequirements || []).map((req, idx) => (
                      <div
                        key={req.id}
                        className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-black text-[10px] flex items-center justify-center font-mono">
                              {idx + 1}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                              req.requiredStatus === 'REQUIRED' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                              req.requiredStatus === 'CONDITIONAL' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {req.requiredStatus}
                            </span>
                            <span className="font-black text-slate-900">{req.name}</span>
                          </div>
                          <p className="text-[11px] text-slate-500">{req.description || 'Standard requirement'}</p>
                        </div>

                        <div className="flex items-center space-x-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleReorderRequirement(req.id, 'UP')}
                            disabled={idx === 0}
                            className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-30 cursor-pointer"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReorderRequirement(req.id, 'DOWN')}
                            disabled={idx === editingVisa.structuredRequirements!.length - 1}
                            className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-30 cursor-pointer"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingRequirement(req);
                              setRequirementDuplicateWarning(null);
                              setIsRequirementModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRequirement(req.id)}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ================================================================= */}
              {/* WORKSPACE TAB: CUSTOMER CHECKLIST PREVIEW                         */}
              {/* ================================================================= */}
              {workspaceTab === 'CUSTOMER_PREVIEW' && serviceDrawerCategory === 'VISA' && editingVisa && (
                <div className="space-y-4">
                  <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl text-xs text-indigo-900">
                    <span className="font-bold block">Live Customer-Facing Document Checklist Preview</span>
                    This preview represents how the requirement checklist is presented to B2B Agents, Client Proposal PDFs, and WhatsApp dispatches.
                  </div>

                  <div className="bg-slate-50 p-5 rounded-3xl border border-slate-200 space-y-4">
                    {generateCustomerVisaChecklist(editingVisa).map((group, gIdx) => (
                      <div key={gIdx} className="space-y-2">
                        <h5 className="font-black text-xs uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#00A88F]" />
                          <span>{group.categoryTitle}</span>
                        </h5>

                        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                          {group.items.map((item, iIdx) => (
                            <div key={iIdx} className="p-3 flex items-start justify-between text-xs">
                              <div>
                                <span className="font-bold text-slate-900">{item.name}</span>
                                {item.instructions && (
                                  <p className="text-[11px] text-slate-500 mt-0.5">{item.instructions}</p>
                                )}
                              </div>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                item.required ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {item.required ? 'Mandatory' : 'Optional'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
                  </div>
                }
              />
            </div>

            {/* DRAWER FOOTER */}
            <div className="p-4 sm:p-5 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Authoritative Selling Price
                </span>
                <div className="text-xl font-black text-[#00E5C0] font-mono">
                  {formatCurrency(livePricingCalculation?.finalPrice || 0, pricingForm.currency)}
                </div>
              </div>

              <div className="flex items-center space-x-2.5 justify-end">
                <button
                  type="button"
                  onClick={() => setIsServiceDrawerOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSaveCurrentService}
                  className="px-6 py-2.5 rounded-xl bg-[#00C6A6] hover:bg-[#00E5C0] text-slate-950 font-black text-xs shadow-lg transition-all cursor-pointer flex items-center space-x-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Service & Pricing</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT STRUCTURED REQUIREMENT                                  */}
      {/* ========================================================================= */}
      {isRequirementModalOpen && editingRequirement && (
        <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <form onSubmit={handleSaveRequirement} className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 border border-slate-200 shadow-2xl animate-scaleUp my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-sm font-black text-slate-900">Configure Requirement Checklist Item</h3>
              <button
                type="button"
                onClick={() => {
                  setIsRequirementModalOpen(false);
                  setEditingRequirement(null);
                }}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {requirementDuplicateWarning && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{requirementDuplicateWarning}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Requirement Title *</label>
                <input
                  type="text"
                  required
                  value={editingRequirement.name}
                  onChange={e => setEditingRequirement({ ...editingRequirement, name: e.target.value })}
                  placeholder="e.g. Original Passport with 6-month validity"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none focus:border-[#00C6A6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Category</label>
                  <select
                    value={editingRequirement.category}
                    onChange={e => setEditingRequirement({ ...editingRequirement, category: e.target.value as RequirementCategory })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none"
                  >
                    <option value="IDENTITY">Identity & Passport</option>
                    <option value="FINANCIAL">Financial Proof</option>
                    <option value="EMPLOYMENT">Employment / Business</option>
                    <option value="ACCOMMODATION">Accommodation / Itinerary</option>
                    <option value="TRAVEL_HISTORY">Travel History</option>
                    <option value="BIOMETRIC">Photos & Biometrics</option>
                    <option value="LEGAL">Forms & Declarations</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Required Status</label>
                  <select
                    value={editingRequirement.requiredStatus}
                    onChange={e => setEditingRequirement({ ...editingRequirement, requiredStatus: e.target.value as RequirementRequiredStatus })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none"
                  >
                    <option value="REQUIRED">Mandatory (Required)</option>
                    <option value="CONDITIONAL">Conditional</option>
                    <option value="OPTIONAL">Optional</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Detailed Instructions for Applicant</label>
                <textarea
                  rows={2}
                  value={editingRequirement.description}
                  onChange={e => setEditingRequirement({ ...editingRequirement, description: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none focus:border-[#00C6A6]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setIsRequirementModalOpen(false);
                  setEditingRequirement(null);
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-[#00C6A6] hover:bg-[#00E5C0] text-slate-950 text-xs font-black shadow-xs cursor-pointer"
              >
                Save Requirement
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DELETE CONFIRM MODAL                                                      */}
      {/* ========================================================================= */}
      {deleteTarget && (
        <DeleteConfirmModal
          isOpen={true}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => {
            if (deleteTarget.type === 'VISA') {
              db.deleteVisa(deleteTarget.id, user);
              setVisas(db.getVisas());
              if (editingVisa?.id === deleteTarget.id) setEditingVisa(null);
            } else if (deleteTarget.type === 'PROTECTION') {
              db.deleteTravelProtectionPlan(deleteTarget.id, user);
              setProtectionPlans(db.getTravelProtectionPlans());
            } else if (deleteTarget.type === 'VIP') {
              db.deleteVipGroundService(deleteTarget.id, user);
              setVipServices(db.getVipGroundServices());
            } else if (deleteTarget.type === 'CONNECTIVITY') {
              db.deleteConnectivityPlan(deleteTarget.id, user);
              setConnectivityPlans(db.getConnectivityPlans());
            }
            setDeleteTarget(null);
          }}
          entityType={deleteTarget.type === 'VISA' ? 'Visa' : 'Product'}
          recordId={deleteTarget.id}
          recordTitle={deleteTarget.name}
          user={user}
        />
      )}

    </div>
  );
};

export default VisaCMSManager;
