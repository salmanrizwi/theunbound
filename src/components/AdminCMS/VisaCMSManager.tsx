import React, { useState, useEffect, useMemo } from 'react';
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
  CurrencyCode
} from '../../types';
import { useAuth } from '../../context/AuthContext';
import { ImageUploadOrUrlInput } from '../ImageUploadOrUrlInput';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { EntitySEOSettingsTab } from './EntitySEOSettingsTab';
import { 
  createDefaultRequirementsForVisa, 
  createDefaultAssistanceServices,
  filterApplicableRequirements,
  generateCustomerVisaChecklist
} from '../../services/visaRequirementService';
import { formatCurrency } from '../../services/pricingEngine';
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
  UserCheck
} from 'lucide-react';

interface VisaCMSManagerProps {
  destinations: Destination[];
  initialSubTab?: string;
  onSubTabChange?: (tab: string) => void;
}

export const VisaCMSManager: React.FC<VisaCMSManagerProps> = ({ 
  destinations, 
  initialSubTab, 
  onSubTabChange 
}) => {
  const { user } = useAuth();
  const db = AppDatabase.getInstance();

  // Primary Workspace Tabs
  const [activeMainTab, setActiveMainTab] = useState<'VISA_SERVICES' | 'TRAVEL_PROTECTION' | 'VIP_CONNECTIVITY' | 'FIELD_PARITY'>(() => {
    if (initialSubTab) {
      const upper = initialSubTab.toUpperCase();
      if (upper === 'TRAVEL_PROTECTION' || upper === 'PROTECTION' || upper === 'INSURANCE') return 'TRAVEL_PROTECTION';
      if (upper === 'VIP_CONNECTIVITY' || upper === 'VIP' || upper === 'CONNECTIVITY' || upper === 'ESIM') return 'VIP_CONNECTIVITY';
      if (upper === 'FIELD_PARITY' || upper === 'PARITY' || upper === 'SCHEMA') return 'FIELD_PARITY';
      return 'VISA_SERVICES';
    }
    return 'VISA_SERVICES';
  });

  // Synchronize with external tab selection
  useEffect(() => {
    if (initialSubTab) {
      const upper = initialSubTab.toUpperCase();
      if (upper === 'TRAVEL_PROTECTION' || upper === 'PROTECTION' || upper === 'INSURANCE') {
        setActiveMainTab('TRAVEL_PROTECTION');
      } else if (upper === 'VIP_CONNECTIVITY' || upper === 'VIP' || upper === 'CONNECTIVITY' || upper === 'ESIM') {
        setActiveMainTab('VIP_CONNECTIVITY');
      } else if (upper === 'FIELD_PARITY' || upper === 'PARITY' || upper === 'SCHEMA') {
        setActiveMainTab('FIELD_PARITY');
      } else if (upper === 'VISA_SERVICES' || upper === 'VISAS') {
        setActiveMainTab('VISA_SERVICES');
      }
    }
  }, [initialSubTab]);

  const handleTabSwitch = (tab: 'VISA_SERVICES' | 'TRAVEL_PROTECTION' | 'VIP_CONNECTIVITY' | 'FIELD_PARITY') => {
    setActiveMainTab(tab);
    onSubTabChange?.(tab);
  };

  // Database States
  const [visas, setVisas] = useState<VisaProduct[]>(() => db.getVisas());
  const [protectionPlans, setProtectionPlans] = useState<TravelProtectionPlan[]>(() => db.getTravelProtectionPlans());
  const [vipServices, setVipServices] = useState<VipGroundService[]>(() => db.getVipGroundServices());
  const [connectivityPlans, setConnectivityPlans] = useState<ConnectivityPlan[]>(() => db.getConnectivityPlans());

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'DRAFT' | 'ARCHIVED'>('ALL');

  // Active Workspace / Drawer State for a Visa
  const [editingVisa, setEditingVisa] = useState<VisaProduct | null>(null);
  const [workspaceTab, setWorkspaceTab] = useState<'OVERVIEW' | 'ELIGIBILITY' | 'REQUIREMENTS' | 'PROCESSING' | 'PRICING' | 'ASSISTANCE' | 'CUSTOMER_PREVIEW' | 'SEO' | 'AUDIT'>('OVERVIEW');

  // Requirements Builder Modal State (Inside Visa Workspace)
  const [isRequirementModalOpen, setIsRequirementModalOpen] = useState(false);
  const [editingRequirement, setEditingRequirement] = useState<StructuredVisaRequirement | null>(null);
  const [requirementDuplicateWarning, setRequirementDuplicateWarning] = useState<string | null>(null);

  // Assistance Service Modal State
  const [isAssistanceModalOpen, setIsAssistanceModalOpen] = useState(false);
  const [editingAssistance, setEditingAssistance] = useState<VisaAssistanceService | null>(null);

  // Protection Plan Modal State
  const [isProtectionModalOpen, setIsProtectionModalOpen] = useState(false);
  const [editingProtection, setEditingProtection] = useState<Partial<TravelProtectionPlan> | null>(null);

  // VIP Ground / 5G Connectivity Modal State
  const [isVipModalOpen, setIsVipModalOpen] = useState(false);
  const [editingVip, setEditingVip] = useState<Partial<VipGroundService> | null>(null);
  const [isConnectivityModalOpen, setIsConnectivityModalOpen] = useState(false);
  const [editingConnectivity, setEditingConnectivity] = useState<Partial<ConnectivityPlan> | null>(null);

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

  // Filtered Visas
  const filteredVisas = useMemo(() => {
    return visas.filter(v => {
      const matchesCountry = selectedCountry === 'all' || v.country.toLowerCase() === selectedCountry.toLowerCase();
      const matchesStatus = statusFilter === 'ALL' || v.status === statusFilter;
      const q = searchQuery.toLowerCase();
      const matchesSearch = 
        v.country.toLowerCase().includes(q) ||
        v.visaType.toLowerCase().includes(q) ||
        (v.description && v.description.toLowerCase().includes(q));
      return matchesCountry && matchesStatus && matchesSearch;
    });
  }, [visas, selectedCountry, statusFilter, searchQuery]);

  // Overall Stats
  const totalRequirementsCount = useMemo(() => {
    return visas.reduce((sum, v) => sum + (v.structuredRequirements?.length || 0), 0);
  }, [visas]);

  // --------------------------------------------------------------------------
  // VISA CRUD OPERATIONS
  // --------------------------------------------------------------------------
  const handleOpenCreateVisa = () => {
    const defaultDest = destinations[0] || { id: 'dest-japan', name: 'Japan' };
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
    setWorkspaceTab('OVERVIEW');
  };

  const handleSaveVisa = (visaToSave?: VisaProduct) => {
    const target = visaToSave || editingVisa;
    if (!target || !target.country || !target.visaType) return;

    // Keep checklist string array aligned with structured requirements
    const syncedChecklist = target.structuredRequirements && target.structuredRequirements.length > 0
      ? target.structuredRequirements.map(r => r.name)
      : target.documentsChecklist || [];

    const updatedVisa: VisaProduct = {
      ...target,
      documentsChecklist: syncedChecklist,
      requirementVersion: (target.requirementVersion || 1) + 1,
      updatedAt: new Date().toISOString()
    };

    db.saveVisa(updatedVisa, user);
    setEditingVisa(updatedVisa);
  };

  // --------------------------------------------------------------------------
  // REQUIREMENTS BUILDER ACTIONS (Constitution Section 16 & 17)
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

    // Duplicate prevention check (Constitution Section 17)
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

    // Sort by display order
    updatedReqs.sort((a, b) => a.displayOrder - b.displayOrder);

    const updatedVisa = {
      ...editingVisa,
      structuredRequirements: updatedReqs,
      documentsChecklist: updatedReqs.map(r => r.name)
    };

    setEditingVisa(updatedVisa);
    handleSaveVisa(updatedVisa);
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
    handleSaveVisa(updatedVisa);
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

    // Reassign clean 1-based displayOrder
    reqs.forEach((r, i) => {
      r.displayOrder = i + 1;
    });

    const updatedVisa = {
      ...editingVisa,
      structuredRequirements: reqs,
      documentsChecklist: reqs.map(r => r.name)
    };
    setEditingVisa(updatedVisa);
    handleSaveVisa(updatedVisa);
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
    handleSaveVisa(updatedVisa);
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
    handleSaveVisa(updatedVisa);
  };

  // --------------------------------------------------------------------------
  // APPLICATION ASSISTANCE SERVICES ACTIONS (Constitution Section 19)
  // --------------------------------------------------------------------------
  const handleOpenAddAssistance = () => {
    if (!editingVisa) return;
    setEditingAssistance({
      id: `ASST-${editingVisa.id}-${Date.now().toString(36).toUpperCase()}`,
      visaId: editingVisa.id,
      name: '',
      serviceType: 'DOCUMENT_VETTING',
      description: '',
      netCost: 10,
      serviceFee: 15,
      sellingPrice: 25,
      currency: editingVisa.currency || 'USD',
      includedInBaseFee: false,
      status: 'ACTIVE',
      displayOrder: (editingVisa.assistanceServices?.length || 0) + 1
    });
    setIsAssistanceModalOpen(true);
  };

  const handleSaveAssistance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVisa || !editingAssistance || !editingAssistance.name.trim()) return;

    const existing = editingVisa.assistanceServices || [];
    let updated: VisaAssistanceService[];
    const idx = existing.findIndex(a => a.id === editingAssistance.id);
    if (idx >= 0) {
      updated = [...existing];
      updated[idx] = editingAssistance;
    } else {
      updated = [...existing, editingAssistance];
    }

    const updatedVisa = {
      ...editingVisa,
      assistanceServices: updated
    };
    setEditingVisa(updatedVisa);
    handleSaveVisa(updatedVisa);
    setIsAssistanceModalOpen(false);
    setEditingAssistance(null);
  };

  const handleDeleteAssistance = (id: string) => {
    if (!editingVisa) return;
    const updated = (editingVisa.assistanceServices || []).filter(a => a.id !== id);
    const updatedVisa = {
      ...editingVisa,
      assistanceServices: updated
    };
    setEditingVisa(updatedVisa);
    handleSaveVisa(updatedVisa);
  };

  // --------------------------------------------------------------------------
  // FIELD PARITY CONTRACT MATRIX (Constitution Section 26)
  // --------------------------------------------------------------------------
  const fieldParityRows = [
    { category: 'Visa Product', cmsField: 'Visa ID', sheetTab: 'VISA', sheetColumn: 'visa_id', firestoreField: 'id', dataType: 'String', required: 'Yes', syncStatus: 'VERIFIED' },
    { category: 'Visa Product', cmsField: 'Destination ID', sheetTab: 'VISA', sheetColumn: 'destination_id', firestoreField: 'destinationId', dataType: 'String', required: 'Yes', syncStatus: 'VERIFIED' },
    { category: 'Visa Product', cmsField: 'Country / Jurisdiction', sheetTab: 'VISA', sheetColumn: 'country', firestoreField: 'country', dataType: 'String', required: 'Yes', syncStatus: 'VERIFIED' },
    { category: 'Visa Product', cmsField: 'Visa Classification', sheetTab: 'VISA', sheetColumn: 'visa_type', firestoreField: 'visaType', dataType: 'String', required: 'Yes', syncStatus: 'VERIFIED' },
    { category: 'Visa Product', cmsField: 'Target Nationality', sheetTab: 'VISA', sheetColumn: 'nationality', firestoreField: 'eligibilityNotes[0]', dataType: 'String', required: 'Yes', syncStatus: 'VERIFIED' },
    { category: 'Visa Product', cmsField: 'Entry Type', sheetTab: 'VISA', sheetColumn: 'entry_type', firestoreField: 'entryType', dataType: 'Enum (SINGLE/MULTI)', required: 'Yes', syncStatus: 'VERIFIED' },
    { category: 'Visa Product', cmsField: 'Validity Days', sheetTab: 'VISA', sheetColumn: 'validity', firestoreField: 'validityDays', dataType: 'Number', required: 'Yes', syncStatus: 'VERIFIED' },
    { category: 'Visa Product', cmsField: 'Permitted Stay Days', sheetTab: 'VISA', sheetColumn: 'stay_duration', firestoreField: 'stayDurationDays', dataType: 'Number', required: 'Yes', syncStatus: 'VERIFIED' },
    { category: 'Visa Product', cmsField: 'Processing Turnaround', sheetTab: 'VISA', sheetColumn: 'processing_days', firestoreField: 'processingTimeDays', dataType: 'Number', required: 'Yes', syncStatus: 'VERIFIED' },
    { category: 'Visa Product', cmsField: 'Documentation Checklist', sheetTab: 'VISA', sheetColumn: 'documentation', firestoreField: 'documentsChecklist / structuredRequirements', dataType: 'Delimited / Array', required: 'Yes', syncStatus: 'VERIFIED' },
    { category: 'Visa Rates', cmsField: 'Consular Embassy Fee', sheetTab: 'VISA_RATES', sheetColumn: 'adult_nett', firestoreField: 'embassyFee', dataType: 'Number (Net Tariff)', required: 'Yes', syncStatus: 'VERIFIED' },
    { category: 'Visa Rates', cmsField: 'DMC Processing Fee', sheetTab: 'VISA_RATES', sheetColumn: 'service_fee', firestoreField: 'serviceFee', dataType: 'Number (DMC Fee)', required: 'Yes', syncStatus: 'VERIFIED' },
    { category: 'Visa Rates', cmsField: 'Wholesale Markup Agent', sheetTab: 'VISA_RATES', sheetColumn: 'markup_agent', firestoreField: 'markupAgent', dataType: 'Percentage (%)', required: 'Yes', syncStatus: 'VERIFIED' },
    { category: 'Travel Protection', cmsField: 'Medical Cover Amount', sheetTab: 'N/A (Operational Master)', sheetColumn: 'coverage_amount', firestoreField: 'medicalCoverageAmount', dataType: 'Number', required: 'Yes', syncStatus: 'DATABASE_BACKED' },
    { category: 'VIP Ground', cmsField: 'VIP Service Type', sheetTab: 'TRANSFER_ROUTES', sheetColumn: 'service_type', firestoreField: 'serviceType', dataType: 'Enum', required: 'Yes', syncStatus: 'VERIFIED' },
    { category: '5G Connectivity', cmsField: 'Data Allowance', sheetTab: 'PRODUCTS', sheetColumn: 'description', firestoreField: 'dataAllowance', dataType: 'String (e.g. 10GB)', required: 'Yes', syncStatus: 'DATABASE_BACKED' }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Module Title Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-3xl shadow-xl border border-slate-800">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider">
              Operations & Inventory
            </span>
            <span className="text-xs text-slate-400 font-mono">Tier-1 Consular & Protection Desk</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <FileCheck className="w-7 h-7 text-[#00C6A6]" />
            <span>Visa & Ancillary Services</span>
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Database-driven operational engine managing official visa requirements, applicant document vetting, global travel protection plans, airport fast-track meet & assist, and 5G regional eSIMs.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handleOpenCreateVisa}
            className="px-4 py-2.5 bg-[#00C6A6] hover:bg-[#00E5C0] text-slate-950 font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>New Visa Product</span>
          </button>
        </div>
      </div>

      {/* Top Main Navigation Tabs */}
      <div className="flex border-b border-slate-200 bg-white rounded-2xl p-1.5 shadow-xs overflow-x-auto">
        <button
          onClick={() => handleTabSwitch('VISA_SERVICES')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 shrink-0 cursor-pointer ${
            activeMainTab === 'VISA_SERVICES'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <FileText className="w-4 h-4 text-[#00C6A6]" />
          <span>1. Visa Services & Application Assistance ({visas.length})</span>
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
          <span>2. Travel Protection & Medical Coverage ({protectionPlans.length})</span>
        </button>

        <button
          onClick={() => handleTabSwitch('VIP_CONNECTIVITY')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 shrink-0 cursor-pointer ${
            activeMainTab === 'VIP_CONNECTIVITY'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>3. VIP Ground Services & 5G Connectivity ({vipServices.length + connectivityPlans.length})</span>
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
          <span>Google Sheets Field Parity Matrix</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: VISA SERVICES & APPLICATION ASSISTANCE                             */}
      {/* ========================================================================= */}
      {activeMainTab === 'VISA_SERVICES' && (
        <div className="space-y-6">
          {/* Quick Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Configured Visas</span>
              <div className="text-2xl font-black text-slate-900 mt-1">{visas.length}</div>
              <span className="text-[11px] text-emerald-600 font-medium">All Consular Jurisdictions</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Structured Requirements</span>
              <div className="text-2xl font-black text-slate-900 mt-1">{totalRequirementsCount}</div>
              <span className="text-[11px] text-indigo-600 font-medium">Zero hardcoded checklist items</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Express Turnaround</span>
              <div className="text-2xl font-black text-slate-900 mt-1">
                {visas.filter(v => v.expressProcessingAvailable).length}
              </div>
              <span className="text-[11px] text-amber-600 font-medium">24–48h SLA Priority Options</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Application Assistance</span>
              <div className="text-2xl font-black text-slate-900 mt-1">
                {visas.reduce((s, v) => s + (v.assistanceServices?.length || 0), 0)}
              </div>
              <span className="text-[11px] text-[#00A88F] font-medium">Vetting & Concierge Options</span>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Search visa by country, type, or documents..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#00C6A6] focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto">
              <select
                value={selectedCountry}
                onChange={e => setSelectedCountry(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 outline-none focus:border-[#00C6A6]"
              >
                <option value="all">All Destinations</option>
                {Array.from(new Set(visas.map(v => v.country))).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 outline-none focus:border-[#00C6A6]"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="DRAFT">Drafts</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
          </div>

          {/* Visas Grid / Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider font-bold">
                  <tr>
                    <th className="py-3 px-4">Jurisdiction & Visa Type</th>
                    <th className="py-3 px-4">Classification</th>
                    <th className="py-3 px-4">Turnaround SLA</th>
                    <th className="py-3 px-4">Commercial Pricing</th>
                    <th className="py-3 px-4">Requirements</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredVisas.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        No Visa configurations match the current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredVisas.map(v => {
                      const totalSelling = (v.embassyFee || 0) + (v.serviceFee || 0);
                      const reqCount = v.structuredRequirements?.length || 0;
                      return (
                        <tr key={v.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center space-x-3">
                              <img
                                src={v.heroImage || 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=200'}
                                alt={v.country}
                                className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0"
                              />
                              <div>
                                <span className="font-bold text-slate-900 block text-sm">{v.country}</span>
                                <span className="text-[11px] text-slate-500 truncate max-w-xs block">{v.visaType}</span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 font-mono text-[11px]">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-bold">
                              {v.entryType}
                            </span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">Stay: {v.stayDurationDays}d | Valid: {v.validityDays}d</span>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex items-center space-x-1 text-slate-700 font-medium">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              <span>{v.processingTimeDays} Business Days</span>
                            </div>
                            {v.expressProcessingAvailable && (
                              <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                                Express: {v.expressProcessingTimeDays}d SLA
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900">
                              {formatCurrency(totalSelling, v.currency || 'USD')}
                            </div>
                            <span className="text-[10px] text-slate-400 block">
                              Consular: ${v.embassyFee} | DMC Fee: ${v.serviceFee}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold">
                              {reqCount} Structured Docs
                            </span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              {v.assistanceServices?.length || 0} Assistance Add-ons
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              v.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : v.status === 'DRAFT'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-slate-100 text-slate-500 border border-slate-200'
                            }`}>
                              {v.status}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => {
                                setEditingVisa(v);
                                setWorkspaceTab('REQUIREMENTS');
                              }}
                              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-[#00C6A6] hover:text-slate-950 text-white font-bold text-xs transition-all shadow-xs cursor-pointer"
                            >
                              Manage Checklist
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: TRAVEL PROTECTION & INTERNATIONAL MEDICAL COVERAGE (Sec 21 & 22)   */}
      {/* ========================================================================= */}
      {activeMainTab === 'TRAVEL_PROTECTION' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-wider border border-emerald-200">
                  Global Travel Protection
                </span>
                <span className="text-xs text-slate-400 font-mono">Consular-Approved Cashless Policies</span>
              </div>
              <h2 className="text-xl font-black text-slate-900">International Medical & Trip Protection Plans</h2>
              <p className="text-xs text-slate-500 mt-1 max-w-xl">
                Configured emergency medical hospitalization coverage, European Schengen Regulation (EC) 810/2009 compliance, baggage delay compensation, and 24/7 multilingual evacuation.
              </p>
            </div>

            <button
              onClick={() => {
                setEditingProtection({
                  id: `PROT-${Date.now()}`,
                  serviceName: 'Worldwide Elite Protection Plan',
                  provider: 'Allianz Global Assistance',
                  coverageArea: 'Worldwide excl. US/Canada',
                  medicalCoverageAmount: 250000,
                  emergencyAssistanceIncluded: true,
                  evacuationCoverageAmount: 100000,
                  tripCancellationAmount: 5000,
                  baggageLossAmount: 1500,
                  validityDaysMax: 30,
                  eligibilityAgeMin: 0,
                  eligibilityAgeMax: 80,
                  netCostPerDay: 3.5,
                  netCostPerTrip: 28,
                  sellingPricePerDay: 5.5,
                  sellingPricePerTrip: 45,
                  currency: 'USD',
                  status: 'ACTIVE',
                  terms: 'Includes cashless hospitalization, medical evacuation, and lost luggage cover.',
                  customerDescription: 'Comprehensive global travel protection with zero deductible and instant policy issuance.',
                  inclusions: [
                    'USD 250,000 Emergency Medical Cover',
                    'USD 100,000 Evacuation & Repatriation',
                    'USD 1,500 Checked Luggage cover'
                  ],
                  displayOrder: protectionPlans.length + 1
                });
                setIsProtectionModalOpen(true);
              }}
              className="px-4 py-2.5 bg-slate-900 hover:bg-[#00C6A6] hover:text-slate-950 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Protection Plan</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {protectionPlans.map(plan => (
              <div key={plan.id} className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4 hover:border-slate-300 transition-all flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wider border border-blue-200 block w-fit mb-1.5">
                        {plan.coverageArea}
                      </span>
                      <h3 className="text-base font-black text-slate-900">{plan.serviceName}</h3>
                      <p className="text-xs text-slate-400 font-medium">Provider: {plan.provider}</p>
                    </div>

                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      plan.status === 'ACTIVE'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-500 border border-slate-200'
                    }`}>
                      {plan.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    {plan.customerDescription}
                  </p>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-2.5 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                      <span className="text-[10px] font-bold uppercase text-emerald-800 block">Medical Coverage</span>
                      <span className="text-sm font-black text-emerald-950 font-mono">
                        ${plan.medicalCoverageAmount.toLocaleString()}
                      </span>
                    </div>

                    <div className="p-2.5 bg-indigo-50/50 border border-indigo-100 rounded-xl">
                      <span className="text-[10px] font-bold uppercase text-indigo-800 block">Emergency Evacuation</span>
                      <span className="text-sm font-black text-indigo-950 font-mono">
                        ${plan.evacuationCoverageAmount.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Key Policy Inclusions</span>
                    <ul className="text-xs text-slate-600 space-y-1">
                      {plan.inclusions?.map((inc, i) => (
                        <li key={i} className="flex items-center space-x-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{inc}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Client Tariff</span>
                    <div className="flex items-baseline space-x-1">
                      <span className="text-lg font-black text-slate-900 font-mono">
                        ${plan.sellingPricePerTrip}
                      </span>
                      <span className="text-xs text-slate-500">/ trip (${plan.sellingPricePerDay}/day)</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        setEditingProtection(plan);
                        setIsProtectionModalOpen(true);
                      }}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                      title="Edit Plan"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget({ id: plan.id, name: plan.serviceName, type: 'PROTECTION' })}
                      className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                      title="Delete Plan"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: VIP GROUND SERVICES & 5G CONNECTIVITY (Sec 23 & 24)                */}
      {/* ========================================================================= */}
      {activeMainTab === 'VIP_CONNECTIVITY' && (
        <div className="space-y-8">
          {/* Section A: VIP Ground Services */}
          <div className="space-y-4">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center space-x-2 mb-1">
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold uppercase tracking-wider border border-amber-200">
                    VIP Ground Logistics
                  </span>
                  <span className="text-xs text-slate-400 font-mono">White-Glove Airport & Station Concierge</span>
                </div>
                <h2 className="text-xl font-black text-slate-900">VIP Airport & Station Concierge Services</h2>
                <p className="text-xs text-slate-500 mt-1 max-w-xl">
                  Airside jet bridge meet & assist, electric buggy transfers, dedicated passport control fast-track lanes, and bullet train platform luggage porterage.
                </p>
              </div>

              <button
                onClick={() => {
                  setEditingVip({
                    id: `VIP-${Date.now()}`,
                    name: 'Tokyo Narita Airside VIP Meet & Fast Track',
                    serviceType: 'MEET_AND_GREET',
                    destinationId: 'dest-japan',
                    supplierName: 'Nippon Luxury Transit Concierge',
                    shortDesc: 'Dedicated tarmac gate greeting with golf buggy transfer and express customs escort.',
                    longDesc: 'Our certified multilingual docent meets passengers immediately at the aircraft jet bridge with a personalized name board.',
                    netCost: 140,
                    defaultMarkupPercent: 25,
                    sellingPrice: 175,
                    pricingType: 'PER_PAX',
                    currency: 'USD',
                    badge: 'Fast Track Gate Escort',
                    inclusions: [
                      'Personalized jet bridge greeting',
                      'Express biometric & customs clearance lane'
                    ],
                    status: 'ACTIVE',
                    displayOrder: vipServices.length + 1
                  });
                  setIsVipModalOpen(true);
                }}
                className="px-4 py-2.5 bg-slate-900 hover:bg-[#00C6A6] hover:text-slate-950 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add VIP Ground Service</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {vipServices.map(service => (
                <div key={service.id} className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10px] font-bold uppercase border border-amber-200 inline-block mb-1">
                        {service.badge || service.serviceType}
                      </span>
                      <h4 className="font-black text-slate-900 text-sm">{service.name}</h4>
                      <p className="text-[11px] text-slate-400">Supplier: {service.supplierName}</p>
                    </div>

                    <div className="text-right">
                      <span className="text-base font-black text-slate-900 font-mono">${service.sellingPrice}</span>
                      <span className="text-[10px] text-slate-400 block capitalize">{service.pricingType?.toLowerCase().replace('_', ' ')}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600">{service.shortDesc}</p>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-[10px] text-slate-400 font-mono">Net: ${service.netCost} | Markup: {service.defaultMarkupPercent}%</span>
                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => {
                          setEditingVip(service);
                          setIsVipModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                        title="Edit Service"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget({ id: service.id, name: service.name, type: 'VIP' })}
                        className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer"
                        title="Delete Service"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section B: 5G Connectivity & eSIM Packages */}
          <div className="space-y-4">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center space-x-2 mb-1">
                  <span className="px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 text-[10px] font-bold uppercase tracking-wider border border-teal-200">
                    5G High-Speed Connectivity
                  </span>
                  <span className="text-xs text-slate-400 font-mono">Instant Digital QR-Code Activation</span>
                </div>
                <h2 className="text-xl font-black text-slate-900">Regional & Global 5G eSIM Packages</h2>
                <p className="text-xs text-slate-500 mt-1 max-w-xl">
                  Automated wholesale eSIM profile provisioning supporting Asia 14 countries, Schengen Europe, and Global 140 countries.
                </p>
              </div>

              <button
                onClick={() => {
                  setEditingConnectivity({
                    id: `ESIM-${Date.now()}`,
                    name: '5G Regional eSIM - Asia 14 Destinations (10GB / 15 Days)',
                    type: 'ESIM',
                    coverageZone: 'Japan, Thailand, Singapore, UAE, South Korea',
                    dataAllowance: '10GB High-Speed 5G',
                    validityDays: 15,
                    networkSpeed: '5G / 4G LTE',
                    netCost: 12,
                    sellingPrice: 18,
                    currency: 'USD',
                    status: 'ACTIVE',
                    inclusions: [
                      'Instant QR-code delivery via email',
                      'Personal hotspot and tethering enabled'
                    ],
                    displayOrder: connectivityPlans.length + 1
                  });
                  setIsConnectivityModalOpen(true);
                }}
                className="px-4 py-2.5 bg-slate-900 hover:bg-[#00C6A6] hover:text-slate-950 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add 5G eSIM Package</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {connectivityPlans.map(conn => (
                <div key={conn.id} className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 text-[10px] font-bold uppercase border border-teal-200 inline-block mb-1">
                        {conn.dataAllowance}
                      </span>
                      <h4 className="font-black text-slate-900 text-sm">{conn.name}</h4>
                      <p className="text-[11px] text-slate-400">Coverage: {conn.coverageZone}</p>
                    </div>

                    <div className="text-right">
                      <span className="text-base font-black text-slate-900 font-mono">${conn.sellingPrice}</span>
                      <span className="text-[10px] text-slate-400 block">{conn.validityDays} Days Validity</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-[10px] text-slate-400 font-mono">Wholesale Net: ${conn.netCost} | Speed: {conn.networkSpeed}</span>
                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => {
                          setEditingConnectivity(conn);
                          setIsConnectivityModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                        title="Edit Package"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget({ id: conn.id, name: conn.name, type: 'CONNECTIVITY' })}
                        className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer"
                        title="Delete Package"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: GOOGLE SHEETS FIELD PARITY MATRIX (Constitution Section 26)        */}
      {/* ========================================================================= */}
      {activeMainTab === 'FIELD_PARITY' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-2">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase tracking-wider border border-indigo-200">
                Canonical Data Contract
              </span>
              <span className="text-xs text-slate-400 font-mono">Master Sync Architecture</span>
            </div>
            <h2 className="text-xl font-black text-slate-900">Google Sheets & Firestore Field Parity Matrix</h2>
            <p className="text-xs text-slate-600 max-w-3xl leading-relaxed">
              Every synced Visa, Protection, and Ground SKU field maps strictly between Master Google Sheets tabs, Sync Engine staging, and live Firestore collections. Zero frontend-only mock fields exist in this architecture.
            </p>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-white text-[10px] uppercase font-bold tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Service Category</th>
                    <th className="py-3 px-4">CMS Field Name</th>
                    <th className="py-3 px-4">Google Sheet Tab</th>
                    <th className="py-3 px-4">Google Sheet Column</th>
                    <th className="py-3 px-4">Firestore Schema Key</th>
                    <th className="py-3 px-4">Data Type</th>
                    <th className="py-3 px-4">Parity Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {fieldParityRows.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-slate-800">{row.category}</td>
                      <td className="py-3 px-4 font-sans text-slate-900">{row.cmsField}</td>
                      <td className="py-3 px-4 text-emerald-700 font-bold">{row.sheetTab}</td>
                      <td className="py-3 px-4 text-slate-600">{row.sheetColumn}</td>
                      <td className="py-3 px-4 text-indigo-700 font-bold">{row.firestoreField}</td>
                      <td className="py-3 px-4 text-slate-500 font-sans">{row.dataType}</td>
                      <td className="py-3 px-4 font-sans">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                          ✓ {row.syncStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DRAWER / MODAL: VISA WORKSPACE (Full 9-Section Workspace)                 */}
      {/* ========================================================================= */}
      {editingVisa && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-5xl w-full p-6 space-y-6 border border-slate-200 shadow-2xl animate-scaleUp my-auto max-h-[92vh] flex flex-col">
            
            {/* Workspace Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-[#00C6A6]/10 text-[#00a88c] flex items-center justify-center font-bold">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Visa Detail Workspace</span>
                    <span className="px-2 py-0.2 rounded bg-slate-100 font-mono text-[10px] font-bold text-slate-600">v{editingVisa.requirementVersion || 1}</span>
                  </div>
                  <h3 className="text-base font-black text-slate-900">{editingVisa.country} — {editingVisa.visaType}</h3>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handleSaveVisa()}
                  className="px-4 py-2 bg-[#00C6A6] hover:bg-[#00E5C0] text-slate-950 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Workspace</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditingVisa(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Workspace Navigation Subtabs */}
            <div className="flex border-b border-slate-100 overflow-x-auto space-x-1 shrink-0 pb-1">
              {[
                { id: 'OVERVIEW', label: 'Overview & Basics', icon: Info },
                { id: 'REQUIREMENTS', label: `Requirements Builder (${editingVisa.structuredRequirements?.length || 0})`, icon: CheckSquare },
                { id: 'ELIGIBILITY', label: 'Eligibility Rules', icon: UserCheck },
                { id: 'PROCESSING', label: 'SLA & Processing Steps', icon: Clock },
                { id: 'PRICING', label: 'Pricing & Tariffs', icon: DollarSign },
                { id: 'ASSISTANCE', label: `Assistance Services (${editingVisa.assistanceServices?.length || 0})`, icon: Sparkles },
                { id: 'CUSTOMER_PREVIEW', label: 'Customer-Facing Preview', icon: Eye },
                { id: 'SEO', label: 'SEO Settings', icon: Globe2 }
              ].map(tab => {
                const Icon = tab.icon;
                const active = workspaceTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setWorkspaceTab(tab.id as any)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 shrink-0 cursor-pointer ${
                      active
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Workspace Tab Content */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-6">

              {/* SECTION: OVERVIEW */}
              {workspaceTab === 'OVERVIEW' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Country / Destination Name *</label>
                      <input
                        type="text"
                        value={editingVisa.country}
                        onChange={e => setEditingVisa({ ...editingVisa, country: e.target.value })}
                        className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none focus:border-[#00C6A6]"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Visa Classification Title *</label>
                      <input
                        type="text"
                        value={editingVisa.visaType}
                        onChange={e => setEditingVisa({ ...editingVisa, visaType: e.target.value })}
                        className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none focus:border-[#00C6A6]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Entry Permission Type</label>
                      <select
                        value={editingVisa.entryType}
                        onChange={e => setEditingVisa({ ...editingVisa, entryType: e.target.value as any })}
                        className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none focus:border-[#00C6A6]"
                      >
                        <option value="SINGLE_ENTRY">Single Entry</option>
                        <option value="MULTIPLE_ENTRY">Multiple Entry</option>
                        <option value="DOUBLE_ENTRY">Double Entry</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Total Validity (Days)</label>
                      <input
                        type="number"
                        value={editingVisa.validityDays}
                        onChange={e => setEditingVisa({ ...editingVisa, validityDays: Number(e.target.value) })}
                        className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none focus:border-[#00C6A6]"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Max Stay Duration (Days)</label>
                      <input
                        type="number"
                        value={editingVisa.stayDurationDays}
                        onChange={e => setEditingVisa({ ...editingVisa, stayDurationDays: Number(e.target.value) })}
                        className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none focus:border-[#00C6A6]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Public & B2B Service Description</label>
                    <textarea
                      rows={3}
                      value={editingVisa.description}
                      onChange={e => setEditingVisa({ ...editingVisa, description: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none focus:border-[#00C6A6]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Hero / Banner Image</label>
                    <ImageUploadOrUrlInput
                      value={editingVisa.heroImage || ''}
                      onChange={url => setEditingVisa({ ...editingVisa, heroImage: url })}
                      label="Upload or enter Visa banner image URL"
                    />
                  </div>
                </div>
              )}

              {/* SECTION: REQUIREMENTS BUILDER (Section 16 & 17) */}
              {workspaceTab === 'REQUIREMENTS' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <div>
                      <h4 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                        <CheckSquare className="w-4 h-4 text-[#00A88F]" />
                        <span>Structured Visa Requirements Checklist</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Configure category-specific documents, conditions, attestation, and eligibility rules.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleOpenAddRequirement}
                      className="px-3.5 py-2 bg-[#00C6A6] hover:bg-[#00E5C0] text-slate-950 font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Add Requirement</span>
                    </button>
                  </div>

                  {/* Requirements List */}
                  <div className="space-y-2.5">
                    {(editingVisa.structuredRequirements || []).length === 0 ? (
                      <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs">
                        No structured requirements defined. Click "+ Add Requirement" to create one.
                      </div>
                    ) : (
                      editingVisa.structuredRequirements!.map((req, idx) => (
                        <div
                          key={req.id}
                          className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            req.status === 'ACTIVE'
                              ? 'bg-white border-slate-200 shadow-xs'
                              : 'bg-slate-50/70 border-slate-200 text-slate-400 opacity-60'
                          }`}
                        >
                          <div className="flex items-start space-x-3">
                            <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                              {req.displayOrder || idx + 1}
                            </span>

                            <div className="space-y-1">
                              <div className="flex items-center space-x-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  req.category === 'IDENTITY' ? 'bg-purple-100 text-purple-800' :
                                  req.category === 'FINANCIAL' ? 'bg-emerald-100 text-emerald-800' :
                                  req.category === 'TRAVEL' ? 'bg-blue-100 text-blue-800' :
                                  req.category === 'SUPPORTING' ? 'bg-amber-100 text-amber-800' :
                                  'bg-slate-100 text-slate-700'
                                }`}>
                                  {req.category}
                                </span>

                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                  req.requiredStatus === 'REQUIRED' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                                  req.requiredStatus === 'CONDITIONAL' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                  'bg-slate-100 text-slate-600'
                                }`}>
                                  {req.requiredStatus}
                                </span>

                                <span className="text-xs font-black text-slate-900">{req.name}</span>
                              </div>

                              <p className="text-[11px] text-slate-600 max-w-xl">{req.description}</p>

                              {/* Document condition tags */}
                              {req.documentConditions && (
                                <div className="flex flex-wrap gap-1.5 pt-1 text-[10px] text-slate-500">
                                  {req.documentConditions.originalRequired && <span className="bg-slate-100 px-1.5 py-0.5 rounded">Original Required</span>}
                                  {req.documentConditions.copyRequired && <span className="bg-slate-100 px-1.5 py-0.5 rounded">Copy Required</span>}
                                  {req.documentConditions.minValidityMonths && <span className="bg-slate-100 px-1.5 py-0.5 rounded">{req.documentConditions.minValidityMonths}m Min Validity</span>}
                                  {req.documentConditions.attestationRequired && <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-bold">Attested</span>}
                                  {req.documentConditions.bankStatementPeriodMonths && <span className="bg-slate-100 px-1.5 py-0.5 rounded">{req.documentConditions.bankStatementPeriodMonths}m Statements</span>}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Requirement Actions */}
                          <div className="flex items-center space-x-1 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                            <button
                              type="button"
                              onClick={() => handleReorderRequirement(req.id, 'UP')}
                              disabled={idx === 0}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-30 cursor-pointer"
                              title="Move Up"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReorderRequirement(req.id, 'DOWN')}
                              disabled={idx === editingVisa.structuredRequirements!.length - 1}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-30 cursor-pointer"
                              title="Move Down"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDuplicateRequirement(req)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                              title="Duplicate"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingRequirement(req);
                                setRequirementDuplicateWarning(null);
                                setIsRequirementModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                              title="Edit Requirement"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleRequirementStatus(req.id)}
                              className={`p-1.5 rounded-lg cursor-pointer ${
                                req.status === 'ACTIVE' ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                              }`}
                              title={req.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRequirement(req.id)}
                              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer"
                              title="Delete Requirement"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* SECTION: ELIGIBILITY */}
              {workspaceTab === 'ELIGIBILITY' && (
                <div className="space-y-4 text-xs">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Applicable Nationalities (Comma-separated or 'ALL')</label>
                    <input
                      type="text"
                      placeholder="e.g. Indian, All Eligible Passports, UK, GCC"
                      value={editingVisa.eligibilityNotes?.[0] || 'All Eligible Passports'}
                      onChange={e => {
                        const notes = [...(editingVisa.eligibilityNotes || [])];
                        notes[0] = e.target.value;
                        setEditingVisa({ ...editingVisa, eligibilityNotes: notes });
                      }}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none focus:border-[#00C6A6]"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Consular Guidelines & Applicant Scrutiny Rules</label>
                    <textarea
                      rows={4}
                      value={(editingVisa.eligibilityNotes || []).slice(1).join('\n')}
                      onChange={e => {
                        const first = editingVisa.eligibilityNotes?.[0] || 'All Eligible Passports';
                        const rest = e.target.value.split('\n').filter(Boolean);
                        setEditingVisa({ ...editingVisa, eligibilityNotes: [first, ...rest] });
                      }}
                      placeholder="One rule per line (e.g. Clean immigration history; Travel must take place inside validity period)"
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none focus:border-[#00C6A6]"
                    />
                  </div>
                </div>
              )}

              {/* SECTION: PROCESSING */}
              {workspaceTab === 'PROCESSING' && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Standard Processing (Days)</label>
                      <input
                        type="number"
                        value={editingVisa.processingTimeDays}
                        onChange={e => setEditingVisa({ ...editingVisa, processingTimeDays: Number(e.target.value) })}
                        className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Express SLA Turnaround (Days)</label>
                      <input
                        type="number"
                        value={editingVisa.expressProcessingTimeDays || 2}
                        onChange={e => setEditingVisa({ ...editingVisa, expressProcessingTimeDays: Number(e.target.value) })}
                        className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none"
                      />
                    </div>

                    <div className="flex items-center space-x-2 pt-6">
                      <input
                        type="checkbox"
                        id="express_avail_chk"
                        checked={editingVisa.expressProcessingAvailable}
                        onChange={e => setEditingVisa({ ...editingVisa, expressProcessingAvailable: e.target.checked })}
                        className="w-4 h-4 rounded text-[#00C6A6] focus:ring-0 cursor-pointer"
                      />
                      <label htmlFor="express_avail_chk" className="font-bold text-slate-700 cursor-pointer">
                        Enable Express 24-48h SLA Option
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Operational Submission Steps (Chronological Sequence)</label>
                    <textarea
                      rows={5}
                      value={(editingVisa.submissionSteps || []).join('\n')}
                      onChange={e => setEditingVisa({ ...editingVisa, submissionSteps: e.target.value.split('\n').filter(Boolean) })}
                      placeholder="Step 1: Upload credentials&#10;Step 2: Scrutiny by DMC team&#10;Step 3: Biometric appointment"
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none"
                    />
                  </div>
                </div>
              )}

              {/* SECTION: PRICING & TARIFFS */}
              {workspaceTab === 'PRICING' && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Government Consular Fee ($)</label>
                      <input
                        type="number"
                        value={editingVisa.embassyFee}
                        onChange={e => setEditingVisa({ ...editingVisa, embassyFee: Number(e.target.value) })}
                        className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">DMC Processing Service Fee ($)</label>
                      <input
                        type="number"
                        value={editingVisa.serviceFee}
                        onChange={e => setEditingVisa({ ...editingVisa, serviceFee: Number(e.target.value) })}
                        className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Express Fast-Track Surcharge ($)</label>
                      <input
                        type="number"
                        value={editingVisa.expressServiceFee || 0}
                        onChange={e => setEditingVisa({ ...editingVisa, expressServiceFee: Number(e.target.value) })}
                        className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none"
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-emerald-800">Total Standard Selling Price</span>
                      <div className="text-xl font-black text-emerald-950 font-mono">
                        ${(editingVisa.embassyFee || 0) + (editingVisa.serviceFee || 0)} {editingVisa.currency || 'USD'}
                      </div>
                    </div>
                    <span className="text-xs text-emerald-700 font-medium">Includes Consular Net + DMC Processing Margin</span>
                  </div>
                </div>
              )}

              {/* SECTION: ASSISTANCE SERVICES (Section 19) */}
              {workspaceTab === 'ASSISTANCE' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <div>
                      <h4 className="text-sm font-black text-slate-900">Application Assistance Options</h4>
                      <p className="text-[11px] text-slate-500">Document vetting, form filing, VFS biometric concierge, and appointment scheduling.</p>
                    </div>

                    <button
                      type="button"
                      onClick={handleOpenAddAssistance}
                      className="px-3.5 py-2 bg-[#00C6A6] hover:bg-[#00E5C0] text-slate-950 font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Assistance Option</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    {(editingVisa.assistanceServices || []).map(asst => (
                      <div key={asst.id} className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-black text-slate-900">{asst.name}</span>
                            {asst.includedInBaseFee && (
                              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                                Included in Base Fee
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500">{asst.description}</p>
                        </div>

                        <div className="flex items-center space-x-3 shrink-0">
                          <div className="text-right">
                            <span className="text-sm font-black text-slate-900 font-mono">${asst.sellingPrice}</span>
                            <span className="text-[10px] text-slate-400 block">Cost: ${asst.netCost}</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeleteAssistance(asst.id)}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SECTION: CUSTOMER PREVIEW (Section 35) */}
              {workspaceTab === 'CUSTOMER_PREVIEW' && (
                <div className="space-y-4">
                  <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl text-xs text-indigo-900">
                    <span className="font-bold block">Live Customer-Facing Document Checklist Preview</span>
                    This is how the structured requirement data renders on proposal PDFs, client WhatsApp summaries, and B2B Agent portal vouchers.
                  </div>

                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-6">
                    {generateCustomerVisaChecklist(editingVisa).map((group, gIdx) => (
                      <div key={gIdx} className="space-y-2">
                        <h5 className="font-black text-xs uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
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

              {/* SECTION: SEO SETTINGS */}
              {workspaceTab === 'SEO' && (
                <EntitySEOSettingsTab
                  entityType="VISA"
                  entity={editingVisa}
                  seo={editingVisa.seo}
                  onChange={newSeo => setEditingVisa({ ...editingVisa, seo: newSeo, slug: newSeo.slug || editingVisa.slug })}
                />
              )}
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
              <h3 className="text-sm font-black text-slate-900">Configure Structured Requirement</h3>
              <button
                type="button"
                onClick={() => {
                  setIsRequirementModalOpen(false);
                  setEditingRequirement(null);
                }}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {requirementDuplicateWarning && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{requirementDuplicateWarning}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Requirement Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Original Passport, Bank Statement, ITR"
                  value={editingRequirement.name}
                  onChange={e => {
                    setEditingRequirement({ ...editingRequirement, name: e.target.value });
                    setRequirementDuplicateWarning(null);
                  }}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none focus:border-[#00C6A6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Category</label>
                  <select
                    value={editingRequirement.category}
                    onChange={e => setEditingRequirement({ ...editingRequirement, category: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none"
                  >
                    <option value="IDENTITY">Identity Documents</option>
                    <option value="FINANCIAL">Financial Documents</option>
                    <option value="TRAVEL">Travel Documents</option>
                    <option value="SUPPORTING">Supporting Documents</option>
                    <option value="APPLICATION">Application Documents</option>
                    <option value="OTHER">Other / Consular</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Required Status</label>
                  <select
                    value={editingRequirement.requiredStatus}
                    onChange={e => setEditingRequirement({ ...editingRequirement, requiredStatus: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none"
                  >
                    <option value="REQUIRED">Required (Mandatory)</option>
                    <option value="OPTIONAL">Optional</option>
                    <option value="CONDITIONAL">Conditional (Rules-based)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Detailed Description & Guidance</label>
                <textarea
                  rows={2}
                  value={editingRequirement.description}
                  onChange={e => setEditingRequirement({ ...editingRequirement, description: e.target.value })}
                  placeholder="e.g. Must have 6 months validity with at least 2 blank pages"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none"
                />
              </div>

              {/* Document Conditions */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <span className="font-bold text-slate-700 block text-[11px] uppercase tracking-wider">Document Conditions</span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingRequirement.documentConditions?.originalRequired || false}
                      onChange={e => setEditingRequirement({
                        ...editingRequirement,
                        documentConditions: { ...editingRequirement.documentConditions, originalRequired: e.target.checked }
                      })}
                      className="w-3.5 h-3.5 text-[#00C6A6]"
                    />
                    <span>Original Required</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingRequirement.documentConditions?.attestationRequired || false}
                      onChange={e => setEditingRequirement({
                        ...editingRequirement,
                        documentConditions: { ...editingRequirement.documentConditions, attestationRequired: e.target.checked }
                      })}
                      className="w-3.5 h-3.5 text-[#00C6A6]"
                    />
                    <span>Bank / Notary Attestation</span>
                  </label>

                  <div>
                    <span className="text-[10px] text-slate-500 block">Min Validity (Months)</span>
                    <input
                      type="number"
                      value={editingRequirement.documentConditions?.minValidityMonths || 6}
                      onChange={e => setEditingRequirement({
                        ...editingRequirement,
                        documentConditions: { ...editingRequirement.documentConditions, minValidityMonths: Number(e.target.value) }
                      })}
                      className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs"
                    />
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 block">Statement Duration (Months)</span>
                    <input
                      type="number"
                      value={editingRequirement.documentConditions?.bankStatementPeriodMonths || 3}
                      onChange={e => setEditingRequirement({
                        ...editingRequirement,
                        documentConditions: { ...editingRequirement.documentConditions, bankStatementPeriodMonths: Number(e.target.value) }
                      })}
                      className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setIsRequirementModalOpen(false);
                  setEditingRequirement(null);
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-[#00C6A6] hover:bg-[#00E5C0] text-slate-950 text-xs font-bold shadow-xs"
              >
                Save Requirement
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT ASSISTANCE SERVICE                                      */}
      {/* ========================================================================= */}
      {isAssistanceModalOpen && editingAssistance && (
        <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <form onSubmit={handleSaveAssistance} className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 border border-slate-200 shadow-2xl animate-scaleUp my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-sm font-black text-slate-900">Application Assistance Option</h3>
              <button
                type="button"
                onClick={() => {
                  setIsAssistanceModalOpen(false);
                  setEditingAssistance(null);
                }}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Service Title *</label>
                <input
                  type="text"
                  required
                  value={editingAssistance.name}
                  onChange={e => setEditingAssistance({ ...editingAssistance, name: e.target.value })}
                  placeholder="e.g. Priority Dossier Vetting, Biometrics Escort"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Service Description</label>
                <textarea
                  rows={2}
                  value={editingAssistance.description}
                  onChange={e => setEditingAssistance({ ...editingAssistance, description: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Selling Price ($)</label>
                  <input
                    type="number"
                    value={editingAssistance.sellingPrice}
                    onChange={e => setEditingAssistance({ ...editingAssistance, sellingPrice: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Net Cost ($)</label>
                  <input
                    type="number"
                    value={editingAssistance.netCost}
                    onChange={e => setEditingAssistance({ ...editingAssistance, netCost: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setIsAssistanceModalOpen(false);
                  setEditingAssistance(null);
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-[#00C6A6] hover:bg-[#00E5C0] text-slate-950 text-xs font-bold shadow-xs"
              >
                Save Option
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT TRAVEL PROTECTION PLAN                                  */}
      {/* ========================================================================= */}
      {isProtectionModalOpen && editingProtection && (
        <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!editingProtection.serviceName || !editingProtection.provider) return;
              db.saveTravelProtectionPlan(editingProtection as TravelProtectionPlan, user);
              setIsProtectionModalOpen(false);
              setEditingProtection(null);
            }}
            className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 border border-slate-200 shadow-2xl animate-scaleUp my-auto max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-sm font-black text-slate-900">Configure Travel Protection Plan</h3>
              <button
                type="button"
                onClick={() => {
                  setIsProtectionModalOpen(false);
                  setEditingProtection(null);
                }}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Plan Name *</label>
                <input
                  type="text"
                  required
                  value={editingProtection.serviceName || ''}
                  onChange={e => setEditingProtection({ ...editingProtection, serviceName: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Provider *</label>
                  <input
                    type="text"
                    required
                    value={editingProtection.provider || ''}
                    onChange={e => setEditingProtection({ ...editingProtection, provider: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Coverage Area</label>
                  <input
                    type="text"
                    value={editingProtection.coverageArea || ''}
                    onChange={e => setEditingProtection({ ...editingProtection, coverageArea: e.target.value })}
                    placeholder="Worldwide excl. US/Canada"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Medical Coverage ($)</label>
                  <input
                    type="number"
                    value={editingProtection.medicalCoverageAmount || 250000}
                    onChange={e => setEditingProtection({ ...editingProtection, medicalCoverageAmount: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Selling Price Per Trip ($)</label>
                  <input
                    type="number"
                    value={editingProtection.sellingPricePerTrip || 45}
                    onChange={e => setEditingProtection({ ...editingProtection, sellingPricePerTrip: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Customer Description</label>
                <textarea
                  rows={2}
                  value={editingProtection.customerDescription || ''}
                  onChange={e => setEditingProtection({ ...editingProtection, customerDescription: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setIsProtectionModalOpen(false);
                  setEditingProtection(null);
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-[#00C6A6] hover:bg-[#00E5C0] text-slate-950 text-xs font-bold shadow-xs"
              >
                Save Plan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT VIP GROUND SERVICE                                      */}
      {/* ========================================================================= */}
      {isVipModalOpen && editingVip && (
        <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!editingVip.name || !editingVip.supplierName) return;
              db.saveVipGroundService(editingVip as VipGroundService, user);
              setIsVipModalOpen(false);
              setEditingVip(null);
            }}
            className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 border border-slate-200 shadow-2xl animate-scaleUp my-auto max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-sm font-black text-slate-900">Configure VIP Ground Service</h3>
              <button
                type="button"
                onClick={() => {
                  setIsVipModalOpen(false);
                  setEditingVip(null);
                }}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Service Name *</label>
                <input
                  type="text"
                  required
                  value={editingVip.name || ''}
                  onChange={e => setEditingVip({ ...editingVip, name: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Service Type</label>
                  <select
                    value={editingVip.serviceType || 'MEET_AND_GREET'}
                    onChange={e => setEditingVip({ ...editingVip, serviceType: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none"
                  >
                    <option value="MEET_AND_GREET">Meet & Greet</option>
                    <option value="FAST_TRACK">Fast Track Clearance</option>
                    <option value="VIP_TRANSFER">VIP Airport Transfer</option>
                    <option value="LOUNGE_ACCESS">Lounge Access</option>
                    <option value="PORTERAGE">Station Porterage</option>
                    <option value="CHAUFFEUR">Private Chauffeur</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Supplier Name *</label>
                  <input
                    type="text"
                    required
                    value={editingVip.supplierName || ''}
                    onChange={e => setEditingVip({ ...editingVip, supplierName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Client Price ($)</label>
                  <input
                    type="number"
                    value={editingVip.sellingPrice || 150}
                    onChange={e => setEditingVip({ ...editingVip, sellingPrice: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Net Cost ($)</label>
                  <input
                    type="number"
                    value={editingVip.netCost || 120}
                    onChange={e => setEditingVip({ ...editingVip, netCost: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Short Description</label>
                <textarea
                  rows={2}
                  value={editingVip.shortDesc || ''}
                  onChange={e => setEditingVip({ ...editingVip, shortDesc: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setIsVipModalOpen(false);
                  setEditingVip(null);
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-[#00C6A6] hover:bg-[#00E5C0] text-slate-950 text-xs font-bold shadow-xs"
              >
                Save VIP Service
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT CONNECTIVITY PLAN                                       */}
      {/* ========================================================================= */}
      {isConnectivityModalOpen && editingConnectivity && (
        <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!editingConnectivity.name || !editingConnectivity.dataAllowance) return;
              db.saveConnectivityPlan(editingConnectivity as ConnectivityPlan, user);
              setIsConnectivityModalOpen(false);
              setEditingConnectivity(null);
            }}
            className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 border border-slate-200 shadow-2xl animate-scaleUp my-auto max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-sm font-black text-slate-900">Configure 5G eSIM Package</h3>
              <button
                type="button"
                onClick={() => {
                  setIsConnectivityModalOpen(false);
                  setEditingConnectivity(null);
                }}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Package Name *</label>
                <input
                  type="text"
                  required
                  value={editingConnectivity.name || ''}
                  onChange={e => setEditingConnectivity({ ...editingConnectivity, name: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Data Allowance *</label>
                  <input
                    type="text"
                    required
                    value={editingConnectivity.dataAllowance || ''}
                    onChange={e => setEditingConnectivity({ ...editingConnectivity, dataAllowance: e.target.value })}
                    placeholder="e.g. 10GB High-Speed, Unlimited"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Validity (Days) *</label>
                  <input
                    type="number"
                    required
                    value={editingConnectivity.validityDays || 15}
                    onChange={e => setEditingConnectivity({ ...editingConnectivity, validityDays: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Coverage Zone Countries</label>
                <input
                  type="text"
                  value={editingConnectivity.coverageZone || ''}
                  onChange={e => setEditingConnectivity({ ...editingConnectivity, coverageZone: e.target.value })}
                  placeholder="e.g. Japan, Thailand, Singapore, UAE"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Client Selling Price ($)</label>
                  <input
                    type="number"
                    value={editingConnectivity.sellingPrice || 18}
                    onChange={e => setEditingConnectivity({ ...editingConnectivity, sellingPrice: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Wholesale Net Cost ($)</label>
                  <input
                    type="number"
                    value={editingConnectivity.netCost || 12}
                    onChange={e => setEditingConnectivity({ ...editingConnectivity, netCost: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setIsConnectivityModalOpen(false);
                  setEditingConnectivity(null);
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-[#00C6A6] hover:bg-[#00E5C0] text-slate-950 text-xs font-bold shadow-xs"
              >
                Save Package
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
