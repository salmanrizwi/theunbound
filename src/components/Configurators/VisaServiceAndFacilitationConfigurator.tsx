import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  Users, 
  Calendar, 
  Clock, 
  Check, 
  Plus, 
  FileText, 
  ShieldCheck, 
  Sparkles, 
  FileCheck,
  AlertCircle,
  MapPin,
  Lock,
  Download,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Shield,
  Layers,
  HelpCircle,
  Globe2,
  Briefcase,
  UserCheck,
  Plane,
  BadgePercent,
  Search,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  CreditCard
} from 'lucide-react';
import { 
  Product, 
  CurrencyCode, 
  StructuredVisaRequirement, 
  VisaAssistanceService,
  QuoteVisaSnapshot,
  RequirementCategory,
  VisaProduct as MasterVisaProduct
} from '../../types';
import { VisaProduct as B2BVisaProduct } from '../B2BAgentPortal/B2BVisaView';
import { useAuth } from '../../context/AuthContext';
import { useQuotation } from '../../context/QuotationContext';
import { formatCurrency, convertCurrency } from '../../services/pricingEngine';
import { AppDatabase } from '../../services/db';
import { 
  createDefaultRequirementsForVisa, 
  createDefaultAssistanceServices,
  filterApplicableRequirements
} from '../../services/visaRequirementService';

export type VisaProduct = MasterVisaProduct | B2BVisaProduct;

export interface VisaConfiguratorProps {
  isOpen: boolean;
  visa?: VisaProduct | null;
  itemOrProduct?: any | null;
  portalOrigin?: 'BUYER' | 'B2B_AGENT' | 'B2B_QUOTE_BUILDER' | 'ADMIN_CMS';
  existingQuoteItemId?: string;
  initialTravelDate?: string;
  initialAdults?: number;
  initialChildren?: number;
  initialInfants?: number;
  initialNationality?: string;
  initialProfile?: string;
  initialNotes?: string;
  onClose: () => void;
  onSuccess?: (configuredItem: any, details?: any) => void;
}

export const visaProductToProduct = (visa: VisaProduct): Product => {
  const v = visa as any;
  const embassy = v.embassyFee ?? v.embassyFeeUSD ?? 30;
  const service = v.serviceFee ?? v.wholesaleNetUSD ?? 25;
  const suggestedSelling = v.suggestedSellingUSD ?? (embassy + service * 1.3);
  const validity = v.validityDays ? `${v.validityDays} Days` : (v.validity || '30 Days');
  const stayDuration = v.stayDurationDays ? `${v.stayDurationDays} Days` : (v.stayDuration || '15 Days');

  return {
    id: v.id,
    sku: `VSA-${v.countryCode || 'INTL'}-${v.id.slice(-6).toUpperCase()}`,
    destinationId: v.destinationId || `dest-${(v.country || 'world').toLowerCase().replace(/\s+/g, '-')}`,
    destinationName: v.country,
    country: v.country,
    city: 'National Embassy / eVisa Desk',
    productType: 'Visa Service',
    name: `${v.country} ${v.visaType}`,
    shortDescription: `Official B2B Visa Facilitation: ${v.entryType || 'Single Entry'}, ${v.processingTimeDays || 5} day turnaround. Validity: ${validity}.`,
    longDescription: `${v.visaType} for ${v.country}. Processing timeframe: ${v.processingTimeDays || 5} working days. Stay duration: ${stayDuration}. Validity: ${validity}. Submission Type: ${v.entryType || 'Online'}.`,
    supplierId: 'sup-visa-dmc',
    supplierName: 'TheUnbound Visa & Travel Desk',
    supplierProductCode: `VISA-${v.countryCode || 'INTL'}`,
    category: 'Travel Services',
    subcategory: 'Visa Facilitation',
    duration: `${v.processingTimeDays || 5} Days`,
    operatingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    operatingHours: '09:00 - 18:00',
    adultNetPrice: embassy + service,
    childNetPrice: embassy + service,
    infantNetPrice: 0,
    currency: v.currency || 'USD',
    defaultMarkupPercent: Math.round(((suggestedSelling - (embassy + service)) / (embassy + service)) * 100) || 20,
    taxPercent: 0,
    commissionPercent: 10,
    serviceFeeFixed: 0,
    sellingPriceStartingFrom: suggestedSelling,
    season: 'All Year',
    validityFrom: '2026-01-01',
    validityTo: '2027-12-31',
    minPax: 1,
    maxPax: 20,
    availability: 'INSTANT',
    bookingRequiredDays: 5,
    cancellationPolicy: 'Non-refundable once dossier is lodged with the embassy or government portal.',
    inclusions: [
      'Document verification & dossier pre-audit',
      `Embassy fee payment facilitation ($${embassy})`,
      'Appointment scheduling & cover letter drafting',
      'Continuous tracking & status updates'
    ],
    exclusions: [
      'Courier return charges outside metropolitan areas',
      'Optional priority embassy fast-track surcharge'
    ],
    importantInformation: v.eligibilityNotes || v.importantNotes || [],
    heroImage: v.heroImage || v.imageUrl || 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200&auto=format&fit=crop',
    galleryImages: [v.heroImage || v.imageUrl || 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200&auto=format&fit=crop']
  };
};

const COMMON_NATIONALITIES = [
  'Indian',
  'United Kingdom',
  'United States',
  'Singapore',
  'Australia',
  'Canada',
  'United Arab Emirates',
  'Philippines',
  'Indonesia',
  'Malaysia',
  'South Africa',
  'Saudi Arabia',
  'European Union / Schengen',
  'All Eligible Nationalities'
];

export const VisaServiceAndFacilitationConfigurator: React.FC<VisaConfiguratorProps> = ({
  isOpen,
  visa: initialVisaProp,
  itemOrProduct,
  portalOrigin = 'B2B_AGENT',
  existingQuoteItemId,
  initialTravelDate,
  initialAdults = 1,
  initialChildren = 0,
  initialInfants = 0,
  initialNationality = 'Indian',
  initialProfile = 'EMPLOYED',
  initialNotes = '',
  onClose,
  onSuccess
}) => {
  const { user, role } = useAuth();
  const { currency, addProductToQuote, updateQuoteItem } = useQuotation();
  const db = AppDatabase.getInstance();

  // 1. Authoritative canonical Visas catalog from db
  const allVisas = useMemo(() => db.getVisas(), [db]);

  // Determine initial target visa
  const resolvedTargetVisa = useMemo(() => {
    if (initialVisaProp) return initialVisaProp;
    if (itemOrProduct) {
      if (itemOrProduct.entryType && itemOrProduct.country) {
        return itemOrProduct as VisaProduct;
      }
      const prod = itemOrProduct.product || itemOrProduct;
      const metaVisaId = itemOrProduct.metadata?.visaProductId || itemOrProduct.metadata?.visaConfigurationPayload?.visaId || prod.id;
      const found = allVisas.find(v => v.id === metaVisaId || v.country.toLowerCase() === (prod.country || '').toLowerCase() || prod.name?.toLowerCase().includes(v.country.toLowerCase()));
      if (found) return found;
    }
    return allVisas[0] || null;
  }, [initialVisaProp, itemOrProduct, allVisas]);

  // Active Selected Visa (allows switching in configurator)
  const [selectedVisa, setSelectedVisa] = useState<VisaProduct | null>(resolvedTargetVisa);

  // Sync state if resolved target visa changes externally
  useEffect(() => {
    if (resolvedTargetVisa) {
      setSelectedVisa(resolvedTargetVisa);
    }
  }, [resolvedTargetVisa]);

  // Pre-fill existing configurations if editing
  const existingConfig = useMemo(() => {
    if (!itemOrProduct) return null;
    return itemOrProduct.visaSnapshot || 
           itemOrProduct.metadata?.visaConfigurationPayload || 
           itemOrProduct.serviceVisaDetails || 
           null;
  }, [itemOrProduct]);

  // Applicant Information State
  const [applicantName, setApplicantName] = useState<string>(() => existingConfig?.applicantName || existingConfig?.travellerName || '');
  const [passportNationality, setPassportNationality] = useState<string>(() => existingConfig?.applicantNationality || initialNationality);
  const [applicantProfile, setApplicantProfile] = useState<string>(() => existingConfig?.applicantProfile || initialProfile);
  const [sponsorshipStatus, setSponsorshipStatus] = useState<'SELF_FUNDED' | 'SPONSORED_FAMILY' | 'SPONSORED_COMPANY'>(() => existingConfig?.sponsorshipStatus || 'SELF_FUNDED');
  const [hasPreviousPassport, setHasPreviousPassport] = useState<'YES' | 'NO'>(() => existingConfig?.hasPreviousPassport || 'NO');
  const [purposeOfTravel, setPurposeOfTravel] = useState<'LEISURE_TOURISM' | 'BUSINESS_CONFERENCE' | 'FAMILY_VISIT' | 'TRANSIT'>(() => existingConfig?.purposeOfTravel || 'LEISURE_TOURISM');

  // Party Size & Dates
  const [adultApplicants, setAdultApplicants] = useState<number>(() => itemOrProduct?.pax?.adults ?? initialAdults);
  const [childApplicants, setChildApplicants] = useState<number>(() => itemOrProduct?.pax?.children ?? initialChildren);
  const [infantApplicants, setInfantApplicants] = useState<number>(() => itemOrProduct?.pax?.infants ?? initialInfants);

  const [travelDate, setTravelDate] = useState<string>(() => {
    if (existingConfig?.travelDate) return existingConfig.travelDate;
    if (initialTravelDate) return initialTravelDate;
    if (itemOrProduct?.travelDate) return itemOrProduct.travelDate;
    const d = new Date(Date.now() + 86400000 * 21);
    return d.toISOString().split('T')[0];
  });

  const [submissionDate, setSubmissionDate] = useState<string>(() => {
    if (existingConfig?.submissionDate) return existingConfig.submissionDate;
    const d = new Date(Date.now() + 86400000 * 5);
    return d.toISOString().split('T')[0];
  });

  const [notes, setNotes] = useState<string>(() => existingConfig?.notes || initialNotes || itemOrProduct?.notes || '');
  const [selectedAssistanceIds, setSelectedAssistanceIds] = useState<string[]>([]);
  const [isChecklistExpanded, setIsChecklistExpanded] = useState<boolean>(true);
  const [checklistFilter, setChecklistFilter] = useState<'ALL' | 'REQUIRED' | 'CONDITIONAL'>('ALL');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load canonical assistance services for selected visa
  const availableAssistanceServices: VisaAssistanceService[] = useMemo(() => {
    if (!selectedVisa) return [];
    if (selectedVisa.assistanceServices && selectedVisa.assistanceServices.length > 0) {
      return selectedVisa.assistanceServices;
    }
    return createDefaultAssistanceServices(selectedVisa.id);
  }, [selectedVisa]);

  // Auto-select included assistance services & existing saved selections
  useEffect(() => {
    if (selectedVisa) {
      const savedIds = existingConfig?.selectedAssistanceServices?.map((s: any) => s.id) || [];
      const includedIds = availableAssistanceServices.filter(a => a.includedInBaseFee).map(a => a.id);
      const merged = Array.from(new Set([...includedIds, ...savedIds]));
      setSelectedAssistanceIds(merged);
    }
  }, [selectedVisa?.id, availableAssistanceServices, existingConfig]);

  // Load canonical structured requirements for selected visa
  const allStructuredRequirements: StructuredVisaRequirement[] = useMemo(() => {
    if (!selectedVisa) return [];
    if (selectedVisa.structuredRequirements && selectedVisa.structuredRequirements.length > 0) {
      return selectedVisa.structuredRequirements;
    }
    return createDefaultRequirementsForVisa(selectedVisa.id, selectedVisa.country, selectedVisa.visaType);
  }, [selectedVisa]);

  // Calculate Dynamic Checklist based on user inputs (Constitution Section 5, 6, 8, 9)
  const dynamicChecklist: StructuredVisaRequirement[] = useMemo(() => {
    if (!allStructuredRequirements || allStructuredRequirements.length === 0) return [];
    return filterApplicableRequirements(allStructuredRequirements, {
      nationality: passportNationality,
      travellerType: applicantProfile,
      visaType: selectedVisa?.visaType || 'Tourist',
      isEmployed: applicantProfile === 'EMPLOYED',
      isSelfEmployed: applicantProfile === 'SELF_EMPLOYED',
      isSponsored: sponsorshipStatus !== 'SELF_FUNDED' || applicantProfile === 'SPONSORED',
      hasPreviousPassport: hasPreviousPassport === 'YES'
    });
  }, [allStructuredRequirements, passportNationality, applicantProfile, sponsorshipStatus, hasPreviousPassport, selectedVisa]);

  // Filtered Checklist for display
  const displayChecklist = useMemo(() => {
    if (checklistFilter === 'REQUIRED') {
      return dynamicChecklist.filter(r => r.requiredStatus === 'REQUIRED');
    }
    if (checklistFilter === 'CONDITIONAL') {
      return dynamicChecklist.filter(r => r.requiredStatus === 'CONDITIONAL');
    }
    return dynamicChecklist;
  }, [dynamicChecklist, checklistFilter]);

  if (!isOpen || !selectedVisa) return null;

  const totalApplicants = adultApplicants + childApplicants + infantApplicants;

  // Selected assistance objects
  const selectedAssistanceObjects = availableAssistanceServices.filter(a => selectedAssistanceIds.includes(a.id));
  const extraAssistancePerApplicantUSD = selectedAssistanceObjects
    .filter(a => !a.includedInBaseFee)
    .reduce((sum, a) => sum + (a.sellingPrice || 0), 0);
  const extraAssistanceTotalUSD = extraAssistancePerApplicantUSD * totalApplicants;

  // Pricing Architecture
  const embassyFeeUSD = selectedVisa.embassyFee || (selectedVisa as any).embassyFeeUSD || 30;
  const serviceFeeUSD = selectedVisa.serviceFee || (selectedVisa as any).wholesaleNetUSD || 25;
  const suggestedSellingUSD = (selectedVisa as any).suggestedSellingUSD || (embassyFeeUSD + serviceFeeUSD * 1.3);

  const baseRatePerApplicantUSD = suggestedSellingUSD;
  const totalRatePerApplicantUSD = baseRatePerApplicantUSD + extraAssistancePerApplicantUSD;
  const partyTotalSellingUSD = (baseRatePerApplicantUSD * totalApplicants) + extraAssistanceTotalUSD;

  // Commercial Net calculations for Admin & Team Member
  const assistanceNetPerApplicantUSD = selectedAssistanceObjects.reduce((sum, a) => sum + (a.netCost || 0), 0);
  const totalNetPerApplicantUSD = embassyFeeUSD + serviceFeeUSD + assistanceNetPerApplicantUSD;
  const partyTotalNetUSD = totalNetPerApplicantUSD * totalApplicants;
  const partyGrossProfitUSD = partyTotalSellingUSD - partyTotalNetUSD;
  const profitMarginPercent = partyTotalSellingUSD > 0 ? Math.round((partyGrossProfitUSD / partyTotalSellingUSD) * 100) : 0;

  // Currency Conversions
  const convertedSellingRate = convertCurrency(totalRatePerApplicantUSD, 'USD', currency);
  const convertedTotalPartySelling = convertCurrency(partyTotalSellingUSD, 'USD', currency);
  const convertedTotalNet = convertCurrency(partyTotalNetUSD, 'USD', currency);
  const convertedProfit = convertCurrency(partyGrossProfitUSD, 'USD', currency);

  // Toggle assistance selection
  const toggleAssistance = (asstId: string) => {
    setSelectedAssistanceIds(prev => 
      prev.includes(asstId) ? prev.filter(id => id !== asstId) : [...prev, asstId]
    );
  };

  // Confirm and save configured visa into Quote / Cart
  const handleConfirm = () => {
    if (totalApplicants < 1) {
      setErrorMsg('At least 1 visa applicant is required.');
      return;
    }

    const prod = visaProductToProduct(selectedVisa);
    // Enrich with dynamic calculated rate
    prod.sellingPriceStartingFrom = totalRatePerApplicantUSD;
    prod.adultNetPrice = totalNetPerApplicantUSD;

    // Build immutable snapshot
    const visaSnapshot: QuoteVisaSnapshot = {
      visaId: selectedVisa.id,
      visaName: `${selectedVisa.country} ${selectedVisa.visaType}`,
      destination: selectedVisa.country,
      visaType: selectedVisa.visaType,
      applicantNationality: passportNationality,
      applicantProfile,
      selectedAssistanceServices: selectedAssistanceObjects,
      applicableChecklist: dynamicChecklist,
      pricing: {
        embassyFee: embassyFeeUSD,
        serviceFee: serviceFeeUSD,
        assistanceFee: extraAssistancePerApplicantUSD,
        totalSellingPrice: totalRatePerApplicantUSD
      },
      currency: 'USD',
      requirementVersion: selectedVisa.requirementVersion || 1,
      capturedAt: new Date().toISOString()
    };

    const compiledNotes = [
      applicantName ? `Primary Applicant: ${applicantName}` : null,
      `Nationality: ${passportNationality} (${applicantProfile})`,
      `Purpose: ${purposeOfTravel.replace('_', ' ')}`,
      selectedAssistanceObjects.length > 0 ? `Assistance: ${selectedAssistanceObjects.map(a => a.name).join(', ')}` : null,
      notes.trim() ? `Remarks: ${notes.trim()}` : null
    ].filter(Boolean).join(' | ');

    const fullConfigurationPayload = {
      ...visaSnapshot,
      travellerName: applicantName,
      passportNationality,
      applicantProfile,
      sponsorshipStatus,
      hasPreviousPassport,
      purposeOfTravel,
      submissionDate,
      travelDate,
      adults: adultApplicants,
      children: childApplicants,
      infants: infantApplicants,
      notes: notes.trim(),
      commercialSnapshot: {
        totalNetUSD: partyTotalNetUSD,
        totalSellingUSD: partyTotalSellingUSD,
        grossProfitUSD: partyGrossProfitUSD,
        marginPercent: profitMarginPercent
      }
    };

    const targetItemId = existingQuoteItemId || (itemOrProduct as any)?.id;

    if (targetItemId) {
      updateQuoteItem(targetItemId, prod, {
        adults: adultApplicants,
        children: childApplicants,
        infants: infantApplicants,
        travelDate,
        serviceTime: `${selectedVisa.processingTimeDays} Days Processing`,
        notes: compiledNotes,
        selectedAddonIds: selectedAssistanceIds
      });
    } else {
      addProductToQuote(prod, {
        adults: adultApplicants,
        children: childApplicants,
        infants: infantApplicants,
        travelDate,
        serviceTime: `${selectedVisa.processingTimeDays} Days Processing`,
        notes: compiledNotes,
        selectedAddonIds: selectedAssistanceIds,
        openDrawer: false
      });
    }

    if (onSuccess) {
      onSuccess(prod, {
        visa: selectedVisa,
        snapshot: fullConfigurationPayload,
        applicants: totalApplicants,
        travelDate
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200">
      <div 
        id="visa-service-and-facilitation-configurator"
        className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 max-w-4xl w-full overflow-hidden flex flex-col max-h-[94dvh] sm:max-h-[92dvh] animate-scaleUp"
      >
        {/* Header: Dedicated Visa Service & Facilitation Configurator */}
        <div className="bg-slate-900 text-white p-3.5 sm:p-5 flex items-start justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-start space-x-2.5 sm:space-x-3.5 min-w-0">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-[#00C6A6]/20 border border-[#00C6A6]/40 flex items-center justify-center text-[#00E5C0] shrink-0 mt-0.5">
              <FileCheck className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="px-2 py-0.5 rounded-full bg-[#00C6A6] text-slate-950 text-[9px] sm:text-[10px] font-black uppercase tracking-wider">
                  Visa Service & Facilitation Configurator
                </span>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[9px] sm:text-[10px] font-bold border border-slate-700">
                  {selectedVisa.country}
                </span>
                <span className="text-[10px] sm:text-xs text-slate-400 font-mono">({selectedVisa.entryType.replace('_', ' ')})</span>
              </div>
              <h2 className="text-sm sm:text-lg font-bold text-white mt-1 leading-snug truncate">
                {selectedVisa.country} {selectedVisa.visaType}
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 line-clamp-1">
                Authoritative Visa Inventory • Turnaround: {selectedVisa.processingTimeDays} Days • Stay: {selectedVisa.stayDurationDays} Days • Validity: {selectedVisa.validityDays} Days
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer shrink-0 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-3.5 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto flex-1 bg-slate-50/50 modal-body-scroll">
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-2xl flex items-center space-x-2.5 text-xs font-bold animate-in fade-in">
              <AlertCircle className="w-4.5 h-4.5 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. VISA SERVICE SELECTION & SWITCHER */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-900">
                <Globe2 className="w-4 h-4 text-[#00A88F]" />
                <span>Authorized Visa Product Catalog</span>
              </div>
              <span className="text-[10px] font-bold text-slate-400">
                {allVisas.length} Available Destinations
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Destination & Visa Category
                </label>
                <select
                  value={selectedVisa.id}
                  onChange={(e) => {
                    const found = allVisas.find(v => v.id === e.target.value);
                    if (found) setSelectedVisa(found);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-bold outline-none focus:bg-white focus:ring-2 focus:ring-[#00C6A6]"
                >
                  {allVisas.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.country} - {v.visaType} ({v.processingTimeDays}d)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Purpose of Travel
                </label>
                <select
                  value={purposeOfTravel}
                  onChange={(e) => setPurposeOfTravel(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-bold outline-none focus:bg-white focus:ring-2 focus:ring-[#00C6A6]"
                >
                  <option value="LEISURE_TOURISM">Leisure & Holiday Tourism</option>
                  <option value="BUSINESS_CONFERENCE">Business Meetings & Trade Delegation</option>
                  <option value="FAMILY_VISIT">Family & Friend Visit</option>
                  <option value="TRANSIT">Airport Transit / Stopover</option>
                </select>
              </div>
            </div>
          </div>

          {/* 2. APPLICANT INFORMATION & PROFILE (Dynamic Checklist Drivers) */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-900">
                <Users className="w-4 h-4 text-[#00A88F]" />
                <span>Applicant Details & Eligibility Profile</span>
              </div>
              <span className="text-[10px] text-teal-700 font-mono font-bold bg-teal-50 px-2 py-0.5 rounded-md border border-teal-100">
                Checklist Rules Engine Active
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Primary Applicant Name / Reference */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Lead Traveller Name / File Ref
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={applicantName}
                  onChange={(e) => setApplicantName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-[#00C6A6]"
                />
              </div>

              {/* Passport Nationality */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Passport Nationality
                </label>
                <select
                  value={passportNationality}
                  onChange={(e) => setPassportNationality(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-bold outline-none focus:bg-white focus:ring-2 focus:ring-[#00C6A6]"
                >
                  {COMMON_NATIONALITIES.map(nat => (
                    <option key={nat} value={nat}>{nat}</option>
                  ))}
                </select>
              </div>

              {/* Applicant Profile */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Applicant Profile / Status
                </label>
                <select
                  value={applicantProfile}
                  onChange={(e) => setApplicantProfile(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-bold outline-none focus:bg-white focus:ring-2 focus:ring-[#00C6A6]"
                >
                  <option value="EMPLOYED">Salaried Employee</option>
                  <option value="SELF_EMPLOYED">Business Owner / Partner</option>
                  <option value="STUDENT">Student / Academic</option>
                  <option value="RETIRED">Retired Individual</option>
                  <option value="SPONSORED">Sponsored Traveller</option>
                  <option value="MINOR">Minor / Child (Under 18)</option>
                  <option value="OTHER">Other / Freelancer</option>
                </select>
              </div>
            </div>

            {/* Conditional Rules Triggers: Sponsorship & Previous Passports */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-[11px] font-bold text-slate-800 block mb-1.5">
                  Financial Sponsorship Status
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSponsorshipStatus('SELF_FUNDED')}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      sponsorshipStatus === 'SELF_FUNDED'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Self-Funded
                  </button>
                  <button
                    type="button"
                    onClick={() => setSponsorshipStatus('SPONSORED_FAMILY')}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      sponsorshipStatus === 'SPONSORED_FAMILY'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Family Sponsored
                  </button>
                  <button
                    type="button"
                    onClick={() => setSponsorshipStatus('SPONSORED_COMPANY')}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      sponsorshipStatus === 'SPONSORED_COMPANY'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Corporate
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-[11px] font-bold text-slate-800 block mb-1.5">
                  Previous Expired / Stamped Passports
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setHasPreviousPassport('YES')}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      hasPreviousPassport === 'YES'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Yes (Has Previous)
                  </button>
                  <button
                    type="button"
                    onClick={() => setHasPreviousPassport('NO')}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      hasPreviousPassport === 'NO'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    No (First Passport)
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 3. APPLICANT MANIFEST & DATES */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-900">
                <Users className="w-4 h-4 text-[#00A88F]" />
                <span>Number of Visa Applicants & Travel Timing</span>
              </div>
              <span className="text-xs font-extrabold text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200 font-mono">
                Total: {totalApplicants} {totalApplicants === 1 ? 'Applicant' : 'Applicants'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Adults */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Adults (12+)</span>
                  <span className="text-[10px] text-slate-500 block font-mono">
                    {formatCurrency(convertedSellingRate, currency)} / pax
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-200">
                  <button
                    type="button"
                    disabled={adultApplicants <= 1 && childApplicants === 0 && infantApplicants === 0}
                    onClick={() => setAdultApplicants(Math.max(0, adultApplicants - 1))}
                    className="w-7 h-7 rounded-lg bg-white hover:bg-slate-200 border border-slate-300 text-slate-800 font-black text-xs disabled:opacity-30 cursor-pointer flex items-center justify-center"
                  >
                    -
                  </button>
                  <span className="text-xs font-black font-mono text-slate-900">{adultApplicants}</span>
                  <button
                    type="button"
                    onClick={() => setAdultApplicants(adultApplicants + 1)}
                    className="w-7 h-7 rounded-lg bg-white hover:bg-slate-200 border border-slate-300 text-slate-800 font-black text-xs cursor-pointer flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Children */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Children (2-11)</span>
                  <span className="text-[10px] text-slate-500 block font-mono">
                    {formatCurrency(convertedSellingRate, currency)} / child
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-200">
                  <button
                    type="button"
                    disabled={childApplicants <= 0}
                    onClick={() => setChildApplicants(Math.max(0, childApplicants - 1))}
                    className="w-7 h-7 rounded-lg bg-white hover:bg-slate-200 border border-slate-300 text-slate-800 font-black text-xs disabled:opacity-30 cursor-pointer flex items-center justify-center"
                  >
                    -
                  </button>
                  <span className="text-xs font-black font-mono text-slate-900">{childApplicants}</span>
                  <button
                    type="button"
                    onClick={() => setChildApplicants(childApplicants + 1)}
                    className="w-7 h-7 rounded-lg bg-white hover:bg-slate-200 border border-slate-300 text-slate-800 font-black text-xs cursor-pointer flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Infants */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Infants (0-2)</span>
                  <span className="text-[10px] text-slate-500 block font-mono">
                    Consular Free / Facilitation Only
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-200">
                  <button
                    type="button"
                    disabled={infantApplicants <= 0}
                    onClick={() => setInfantApplicants(Math.max(0, infantApplicants - 1))}
                    className="w-7 h-7 rounded-lg bg-white hover:bg-slate-200 border border-slate-300 text-slate-800 font-black text-xs disabled:opacity-30 cursor-pointer flex items-center justify-center"
                  >
                    -
                  </button>
                  <span className="text-xs font-black font-mono text-slate-900">{infantApplicants}</span>
                  <button
                    type="button"
                    onClick={() => setInfantApplicants(infantApplicants + 1)}
                    className="w-7 h-7 rounded-lg bg-white hover:bg-slate-200 border border-slate-300 text-slate-800 font-black text-xs cursor-pointer flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Travel and Submission Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center space-x-1">
                  <Calendar className="w-3.5 h-3.5 text-[#00A88F]" />
                  <span>Intended Travel Departure Date</span>
                </label>
                <input
                  type="date"
                  value={travelDate}
                  onChange={(e) => setTravelDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono outline-none focus:bg-white focus:ring-2 focus:ring-[#00C6A6]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5 text-[#00A88F]" />
                  <span>Target Dossier Lodgement Date</span>
                </label>
                <input
                  type="date"
                  value={submissionDate}
                  onChange={(e) => setSubmissionDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono outline-none focus:bg-white focus:ring-2 focus:ring-[#00C6A6]"
                />
              </div>
            </div>
          </div>

          {/* 4. DYNAMIC VISA CHECKLIST & REQUIREMENTS ENGINE */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 text-[#00A88F] flex items-center justify-center shrink-0">
                  <FileCheck className="w-4.5 h-4.5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">
                      Consular Requirements & Document Checklist
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-[#00A88F] text-[10px] font-bold font-mono">
                      {dynamicChecklist.length} Applicable Items
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Calculated dynamically for {passportNationality} ({applicantProfile.replace('_', ' ')})
                  </span>
                </div>
              </div>

              {/* Checklist Filter Tabs */}
              <div className="flex items-center space-x-1 self-start sm:self-auto bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setChecklistFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                    checklistFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  All ({dynamicChecklist.length})
                </button>
                <button
                  type="button"
                  onClick={() => setChecklistFilter('REQUIRED')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                    checklistFilter === 'REQUIRED' ? 'bg-white text-rose-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Mandatory
                </button>
                <button
                  type="button"
                  onClick={() => setChecklistFilter('CONDITIONAL')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                    checklistFilter === 'CONDITIONAL' ? 'bg-white text-amber-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Conditional
                </button>
              </div>
            </div>

            {/* Checklist items */}
            <div className="p-4 space-y-2.5 max-h-72 overflow-y-auto bg-slate-50/50">
              {displayChecklist.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  No documents found matching the filter criteria.
                </div>
              ) : (
                displayChecklist.map((req, idx) => (
                  <div 
                    key={req.id || idx}
                    className="p-3 rounded-xl bg-white border border-slate-200 text-xs space-y-1.5 shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <CheckSquare className="w-3.5 h-3.5 text-[#00A88F] shrink-0" />
                        <span className="font-bold text-slate-900">{req.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">[{req.category}]</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider shrink-0 ${
                        req.requiredStatus === 'REQUIRED'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : req.requiredStatus === 'CONDITIONAL'
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        {req.requiredStatus}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 pl-5.5 leading-relaxed">
                      {req.description}
                    </p>

                    {/* Conditional Rule explanation if applicable */}
                    {req.conditionRule && (
                      <div className="ml-5.5 p-1.5 rounded-lg bg-amber-50/70 border border-amber-200 text-[10px] text-amber-900 font-medium flex items-center space-x-1.5">
                        <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                        <span>Rule: {req.conditionRule.description || req.conditionRule.conditionValue}</span>
                      </div>
                    )}

                    {/* Document condition tags */}
                    {req.documentConditions && (
                      <div className="flex flex-wrap gap-1.5 pl-5.5 pt-0.5">
                        {req.documentConditions.minValidityMonths && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-mono">
                            Min {req.documentConditions.minValidityMonths} mo validity
                          </span>
                        )}
                        {req.documentConditions.originalRequired && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold">
                            Original Required
                          </span>
                        )}
                        {req.documentConditions.copyRequired && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px]">
                            Copy Required
                          </span>
                        )}
                        {req.documentConditions.photoQuantity && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px]">
                            {req.documentConditions.photoQuantity} Photos ({req.documentConditions.photoSize || '35x45mm'})
                          </span>
                        )}
                        {req.documentConditions.bankStatementPeriodMonths && (
                          <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px]">
                            {req.documentConditions.bankStatementPeriodMonths} Months Stamped Statements
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 5. APPLICATION ASSISTANCE & FACILITATION ADD-ONS */}
          {availableAssistanceServices.length > 0 && (
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center space-x-2 text-xs font-bold text-slate-900">
                  <Sparkles className="w-4 h-4 text-[#00A88F]" />
                  <span>Application Assistance & VIP Facilitation Services</span>
                </div>
                <span className="text-[10px] text-slate-400 font-medium">Configurable per applicant</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {availableAssistanceServices.map(asst => {
                  const isSelected = selectedAssistanceIds.includes(asst.id);
                  const isIncluded = asst.includedInBaseFee;

                  return (
                    <div
                      key={asst.id}
                      onClick={() => !isIncluded && toggleAssistance(asst.id)}
                      className={`p-3 rounded-xl border transition-all text-xs flex flex-col justify-between space-y-2 ${
                        isIncluded 
                          ? 'bg-teal-50/50 border-teal-200 text-slate-900 cursor-default'
                          : isSelected
                          ? 'bg-teal-50/80 border-[#00C6A6] text-slate-900 shadow-xs cursor-pointer'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-white hover:border-slate-300 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-slate-900 leading-snug">{asst.name}</span>
                        {isIncluded ? (
                          <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 text-[9px] font-black uppercase tracking-wider shrink-0">
                            Included in Base
                          </span>
                        ) : (
                          <span className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-[#00C6A6] border-[#00C6A6] text-slate-950' : 'bg-white border-slate-300'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-500 leading-snug">
                        {asst.description}
                      </p>

                      <div className="pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[11px] font-mono">
                        <span className="text-slate-400">Additional Fee:</span>
                        <span className="font-bold text-slate-900">
                          {isIncluded ? 'FREE' : `+${formatCurrency(convertCurrency(asst.sellingPrice, 'USD', currency), currency)} / pax`}
                        </span>
                      </div>

                      {/* Admin Cost View */}
                      {role === 'ADMIN' && (
                        <div className="text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-100 flex justify-between">
                          <span>Net: ${asst.netCost}</span>
                          <span>Fee: ${asst.serviceFee}</span>
                          <span className="text-emerald-600 font-bold">Margin: ${(asst.sellingPrice - asst.netCost)}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 6. APPLICANT NOTES & SPECIAL INSTRUCTIONS */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-900">
              <FileText className="w-4 h-4 text-[#00A88F]" />
              <span>Special Consular Instructions & Agent Notes</span>
            </div>
            <textarea
              rows={2}
              placeholder="e.g. Applicant holds valid US B1/B2 visa, requires appointment at New Delhi VFS, biometric queue escort needed..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-[#00C6A6] placeholder:text-slate-400"
            />
          </div>

          {/* 7. REAL-TIME PRICING BREAKDOWN (Role-Aware) */}
          <div className="bg-slate-900 text-white p-4.5 rounded-2xl shadow-md space-y-3">
            <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4 text-[#00E5C0]" />
                <span>Commercial Facilitation Pricing Summary</span>
              </span>
              <span className="text-[11px] text-[#00E5C0] font-mono font-bold">
                {totalApplicants} {totalApplicants === 1 ? 'Applicant' : 'Applicants'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700">
                <span className="text-[10px] text-slate-400 block">Unit Rate / Applicant</span>
                <span className="text-base font-bold text-slate-200 font-mono">
                  {formatCurrency(convertedSellingRate, currency)}
                </span>
                <span className="text-[9px] text-slate-400 block mt-0.5">
                  Embassy (${embassyFeeUSD}) + Service (${serviceFeeUSD}) {extraAssistancePerApplicantUSD > 0 ? `+ Add-ons ($${extraAssistancePerApplicantUSD})` : ''}
                </span>
              </div>

              {/* Role-based Middle Card */}
              {role === 'ADMIN' ? (
                <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700">
                  <span className="text-[10px] text-slate-400 block">DMC Net & Margin (Admin)</span>
                  <span className="text-base font-bold text-amber-400 font-mono">
                    {formatCurrency(convertedProfit, currency)} ({profitMarginPercent}%)
                  </span>
                  <span className="text-[9px] text-slate-400 block mt-0.5">
                    Total Wholesale Net: {formatCurrency(convertedTotalNet, currency)}
                  </span>
                </div>
              ) : (
                <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700">
                  <span className="text-[10px] text-slate-400 block">Turnaround & Processing</span>
                  <span className="text-base font-bold text-slate-200 font-mono">
                    {selectedVisa.processingTimeDays} Days
                  </span>
                  <span className="text-[9px] text-slate-400 block mt-0.5">
                    Embassy verified turnaround
                  </span>
                </div>
              )}

              <div className="bg-teal-950/60 p-2.5 rounded-xl border border-teal-600/40">
                <span className="text-[10px] text-teal-300 font-bold block">Party Final Selling Price</span>
                <span className="text-xl font-black text-[#00E5C0] font-mono">
                  {formatCurrency(convertedTotalPartySelling, currency)}
                </span>
                <span className="text-[9px] text-teal-400 block">
                  ✓ All Consular Fees, Vetting & Add-ons Included
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-5 bg-white border-t border-slate-200 flex items-center justify-between gap-2.5 sm:gap-3 shrink-0 pb-safe">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer shrink-0"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl bg-[#00C6A6] hover:bg-[#00A88F] text-slate-950 text-xs font-black transition-all flex items-center space-x-1.5 sm:space-x-2 cursor-pointer shadow-md hover:shadow-lg whitespace-nowrap min-w-0"
          >
            {existingQuoteItemId ? <Check className="w-4 h-4 stroke-[3] shrink-0" /> : <Plus className="w-4 h-4 stroke-[3] shrink-0" />}
            <span className="truncate">
              <span className="hidden sm:inline">{existingQuoteItemId ? 'Update Visa in Quote' : 'Add Visa to Quote'}</span>
              <span className="sm:hidden">{existingQuoteItemId ? 'Update Visa' : 'Add to Quote'}</span> ({formatCurrency(convertedTotalPartySelling, currency)})
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

// Aliases for global mapping and full backwards-compatibility
export const VisaConfigurator = VisaServiceAndFacilitationConfigurator;
