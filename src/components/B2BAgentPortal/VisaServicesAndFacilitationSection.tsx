import React, { useState, useMemo } from 'react';
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
  AlertCircle
} from 'lucide-react';
import { Product, CurrencyCode, QuoteItem, Destination, VisaProduct } from '../../types';
import { formatCurrency, convertCurrency } from '../../services/pricingEngine';
import { INITIAL_VISAS } from '../../data/initialVisas';
import { B2B_INSURANCE_PLANS, B2B_ESIM_PLANS } from '../../utils/b2bQuotationHelpers';

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

export interface GroundServiceOption {
  id: string;
  name: string;
  category: 'GROUND_SERVICES' | 'TRAVEL_PROTECTION' | 'VISA_SERVICES';
  subcategory: string;
  shortDesc: string;
  longDesc: string;
  unitNetCostUSD: number;
  defaultMarkupPercent: number;
  pricingType: 'PER_PAX' | 'PER_PAX_PER_DAY' | 'PER_GROUP' | 'FIXED';
  inclusions: string[];
  badge?: string;
  icon: 'meet_assist' | 'fast_track' | 'lounge' | 'porter' | 'concierge' | 'insurance' | 'esim' | 'visa';
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
  const totalPayingPax = Math.max(1, adultsCount + childrenCount);
  const totalTripDays = Math.max(1, tripNights + 1);

  // Filter items in quote related to this section
  const visaItemsInQuote = useMemo(() => {
    return items.filter(it => 
      it.product.sku?.startsWith('VSA-') ||
      (it.product.category === 'Travel Services' && it.product.name?.toLowerCase().includes('visa')) ||
      it.product.name?.toLowerCase().includes('visa')
    );
  }, [items]);

  const protectionItemsInQuote = useMemo(() => {
    return items.filter(it => 
      it.product.subcategory === 'Travel Insurance' || 
      it.product.name.toLowerCase().includes('insurance') ||
      it.product.name.toLowerCase().includes('protection')
    );
  }, [items]);

  const groundServicesInQuote = useMemo(() => {
    return items.filter(it => 
      it.product.subcategory === 'Ground VIP Services' ||
      it.product.subcategory === 'eSIM Connectivity' ||
      it.product.name.toLowerCase().includes('meet & assist') ||
      it.product.name.toLowerCase().includes('fast track') ||
      it.product.name.toLowerCase().includes('lounge') ||
      it.product.name.toLowerCase().includes('porter') ||
      it.product.name.toLowerCase().includes('concierge') ||
      it.product.name.toLowerCase().includes('esim')
    );
  }, [items]);

  const allSectionItemsInQuote = useMemo(() => {
    return [...visaItemsInQuote, ...protectionItemsInQuote, ...groundServicesInQuote];
  }, [visaItemsInQuote, protectionItemsInQuote, groundServicesInQuote]);

  const sectionTotalSelling = useMemo(() => {
    return allSectionItemsInQuote.reduce((sum, it) => sum + (it.calculation?.finalTotalSellingPrice || 0), 0);
  }, [allSectionItemsInQuote]);

  // Destination-matched available Visa
  const destinationVisas = useMemo(() => {
    const destName = currentDestination.name.toLowerCase();
    const destCode = currentDestination.code?.toLowerCase() || '';
    const filtered = INITIAL_VISAS.filter(v => 
      v.destinationId === currentDestination.id ||
      v.country.toLowerCase() === destName ||
      (destCode && v.countryCode.toLowerCase() === destCode)
    );
    if (filtered.length > 0) return filtered;
    return INITIAL_VISAS.slice(0, 2);
  }, [currentDestination]);

  // Standard Ground Services Catalog tailored to destination
  const groundServicesCatalog: GroundServiceOption[] = useMemo(() => {
    const dest = currentDestination.name;
    return [
      {
        id: `svc-meet-assist-${currentDestination.id}`,
        name: `VIP Airport Meet & Assist (${dest})`,
        category: 'GROUND_SERVICES',
        subcategory: 'Ground VIP Services',
        shortDesc: `Personal curbside/aerobridge escort, luggage assistance & chauffeur handover at ${dest} arrival.`,
        longDesc: `Dedicated VIP airport concierge meets guests at the aircraft door / arrivals aerobridge, coordinates priority baggage collection, and escorts guests to their waiting private chauffeur vehicle.`,
        unitNetCostUSD: 45,
        defaultMarkupPercent: 25,
        pricingType: 'PER_PAX',
        badge: 'HIGH DEMAND',
        inclusions: [
          'Aerobridge / Gate Meet & Greet with personalized name board',
          'Luggage porterage assistance from carousel to vehicle',
          'Direct handover to private chauffeur / driver',
          'Flight tracking & delay monitoring'
        ],
        icon: 'meet_assist'
      },
      {
        id: `svc-fast-track-${currentDestination.id}`,
        name: `Fast-Track Immigration & Security Line Clearance`,
        category: 'GROUND_SERVICES',
        subcategory: 'Ground VIP Services',
        shortDesc: `Dedicated express priority diplomatic/VIP lane clearance for customs and immigration.`,
        longDesc: `Bypasses standard passenger arrival and departure queues using authorized express lanes for expedited passport control and security inspection.`,
        unitNetCostUSD: 35,
        defaultMarkupPercent: 25,
        pricingType: 'PER_PAX',
        badge: 'VIP COMFORT',
        inclusions: [
          'Expedited immigration queue access',
          'Fast-track security checkpoint clearance',
          'Dedicated airport host coordination'
        ],
        icon: 'fast_track'
      },
      {
        id: `svc-lounge-departure-${currentDestination.id}`,
        name: `Executive International Airport Departure Lounge Access`,
        category: 'GROUND_SERVICES',
        subcategory: 'Ground VIP Services',
        shortDesc: `3-Hour VIP lounge pass with premium dining, hot showers, Wi-Fi, and open bar before departure.`,
        longDesc: `Unwind before your international departure flight with comfortable seating, gourmet buffet dining, alcoholic and non-alcoholic beverages, private workstations, and shower suites.`,
        unitNetCostUSD: 40,
        defaultMarkupPercent: 20,
        pricingType: 'PER_PAX',
        badge: 'POPULAR',
        inclusions: [
          '3 Hours access to premium airport departure lounge',
          'Complimentary gourmet hot buffet and beverages',
          'High-speed Wi-Fi, flight display screens, shower facilities'
        ],
        icon: 'lounge'
      },
      {
        id: `svc-porter-rail-${currentDestination.id}`,
        name: `Intercity Luggage Forwarding & Station Porterage`,
        category: 'GROUND_SERVICES',
        subcategory: 'Ground VIP Services',
        shortDesc: `Door-to-door hotel luggage transfer between cities (Hands-Free Sightseeing).`,
        longDesc: `Same-day or next-morning heavy luggage transit between destination hotels, allowing guests to board high-speed bullet trains or excursion coaches completely unburdened.`,
        unitNetCostUSD: 28,
        defaultMarkupPercent: 20,
        pricingType: 'PER_PAX',
        badge: 'HANDS-FREE',
        inclusions: [
          'Hotel lobby pickup and direct delivery to next hub hotel',
          'Up to 2 large suitcases (30kg each) per traveler',
          'Real-time GPS luggage tracking updates'
        ],
        icon: 'porter'
      },
      {
        id: `svc-247-concierge-${currentDestination.id}`,
        name: `24/7 Dedicated Local On-Ground Tour Director & Concierge`,
        category: 'GROUND_SERVICES',
        subcategory: 'Ground VIP Services',
        shortDesc: `Dedicated WhatsApp hotline, table reservations, emergency translation & on-ground dispatch.`,
        longDesc: `Around-the-clock bilingual concierge team assisting with Michelin restaurant reservations, medical emergency liaison, translation, lost item recovery, and dynamic itinerary adjustments.`,
        unitNetCostUSD: 60,
        defaultMarkupPercent: 20,
        pricingType: 'PER_GROUP',
        badge: 'ESSENTIAL PEACE OF MIND',
        inclusions: [
          '24/7 Dedicated bilingual WhatsApp support channel',
          'Emergency medical & consular liaison support',
          'Daily activity reminders and local weather briefings',
          'Priority table bookings and secret speakeasy access'
        ],
        icon: 'concierge'
      }
    ];
  }, [currentDestination]);

  // Helper to add Ground Service
  const handleAddGroundService = (svc: GroundServiceOption) => {
    const isPerPax = svc.pricingType === 'PER_PAX';
    const isPerGroup = svc.pricingType === 'PER_GROUP';
    const effectiveAdults = isPerGroup ? 1 : adultsCount;
    const effectiveChildren = isPerGroup ? 0 : childrenCount;

    const prod = {
      id: `prod-${svc.id}-${Date.now()}`,
      sku: `GND-${svc.id.toUpperCase().slice(0, 10)}`,
      destinationId: currentDestination.id,
      destinationName: currentDestination.name,
      country: currentDestination.name,
      city: currentDestination.name,
      productType: svc.name,
      name: svc.name,
      shortDescription: svc.shortDesc,
      longDescription: svc.longDesc,
      supplierId: 'sup-ground-vip',
      supplierName: `${currentDestination.name} Ground Concierge Desk`,
      category: 'Travel Services',
      subcategory: svc.subcategory,
      adultNetPrice: svc.unitNetCostUSD,
      childNetPrice: isPerGroup ? 0 : Math.round(svc.unitNetCostUSD * 0.7),
      infantNetPrice: 0,
      currency: 'USD',
      defaultMarkupPercent: svc.defaultMarkupPercent,
      taxPercent: 0,
      commissionPercent: 10,
      serviceFeeFixed: 0,
      season: 'All Year',
      validityFrom: '2026-01-01',
      validityTo: '2026-12-31',
      minPax: 1,
      maxPax: 50,
      availability: 'INSTANT',
      inclusions: svc.inclusions,
      exclusions: ['Personal gratuities and extra baggage fees'],
      heroImage: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?q=80&w=800&auto=format&fit=crop',
      galleryImages: ['https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?q=80&w=800&auto=format&fit=crop']
    } as unknown as Product;

    onAddProduct(prod, {
      adults: effectiveAdults,
      children: effectiveChildren,
      infants: infantsCount,
      travelDate: startDate,
      openDrawer: false
    });
  };

  // Helper to add Insurance Plan
  const handleAddInsurancePlan = (plan: typeof B2B_INSURANCE_PLANS[0]) => {
    const totalAdultCost = plan.costPerDayAdultUSD * totalTripDays;
    const totalChildCost = plan.costPerDayChildUSD * totalTripDays;

    const prod = {
      id: `prod-ins-${plan.id}-${Date.now()}`,
      sku: `INS-${plan.id.toUpperCase().slice(0, 8)}`,
      destinationId: currentDestination.id,
      destinationName: currentDestination.name,
      country: currentDestination.name,
      city: 'Worldwide Cover',
      productType: 'Travel Protection',
      name: `${plan.name} (${totalTripDays} Days)`,
      shortDescription: `${plan.coverageSummary} Total Coverage: $${plan.coverageAmountUSD.toLocaleString()} USD. Provider: ${plan.provider}.`,
      longDescription: `Full comprehensive travel protection for ${adultsCount} Adults and ${childrenCount} Children covering ${totalTripDays} days in ${currentDestination.name}. Includes: ${plan.medicalEmergencyCoverage}, ${plan.tripCancellationCoverage}, ${plan.baggageLossCoverage}.`,
      supplierId: 'sup-insurance-global',
      supplierName: plan.provider,
      category: 'Travel Services',
      subcategory: 'Travel Insurance',
      adultNetPrice: totalAdultCost,
      childNetPrice: totalChildCost,
      infantNetPrice: 0,
      currency: 'USD',
      defaultMarkupPercent: 30,
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
        '24/7 International Emergency Medical Hotline',
        'COVID-19 Hospitalization & Treatment Included'
      ],
      exclusions: ['Pre-existing non-declared illnesses', 'Unlicensed extreme motorized sports'],
      heroImage: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=800&auto=format&fit=crop',
      galleryImages: ['https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=800&auto=format&fit=crop']
    } as unknown as Product;

    onAddProduct(prod, {
      adults: adultsCount,
      children: childrenCount,
      infants: infantsCount,
      travelDate: startDate,
      openDrawer: false
    });
  };

  // Helper to add eSIM
  const handleAddEsimPlan = (plan: typeof B2B_ESIM_PLANS[0]) => {
    const prod = {
      id: `prod-esim-${plan.id}-${Date.now()}`,
      sku: `ESIM-${plan.id.toUpperCase().slice(0, 8)}`,
      destinationId: currentDestination.id,
      destinationName: currentDestination.name,
      country: currentDestination.name,
      city: plan.destination,
      productType: 'eSIM Connectivity',
      name: `5G Regional eSIM (${plan.dataAllowance})`,
      shortDescription: `${plan.carrier} • ${plan.validityDays} Days Validity • Instant QR activation.`,
      longDescription: `High-speed 5G/4G international mobile data pack with instant digital QR activation for ${currentDestination.name}. Includes hotspot and Google Maps navigation support.`,
      supplierId: 'sup-esim-global',
      supplierName: plan.carrier,
      category: 'Travel Services',
      subcategory: 'eSIM Connectivity',
      adultNetPrice: plan.netCostUSD,
      childNetPrice: 0,
      infantNetPrice: 0,
      currency: 'USD',
      defaultMarkupPercent: 40,
      taxPercent: 0,
      commissionPercent: 10,
      serviceFeeFixed: 0,
      season: 'All Year',
      validityFrom: '2026-01-01',
      validityTo: '2026-12-31',
      minPax: 1,
      maxPax: 50,
      availability: 'INSTANT',
      inclusions: plan.features,
      exclusions: ['Voice calls and traditional SMS (Data only)'],
      heroImage: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?q=80&w=800&auto=format&fit=crop',
      galleryImages: ['https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?q=80&w=800&auto=format&fit=crop']
    } as unknown as Product;

    onAddProduct(prod, {
      adults: adultsCount,
      children: childrenCount,
      infants: infantsCount,
      travelDate: startDate,
      openDrawer: false
    });
  };

  // Helper to add Visa from Destination
  const handleAddDestinationVisa = (visa: VisaProduct) => {
    const isEvisa = visa.visaType.toLowerCase().includes('evisa') || visa.visaType.toLowerCase().includes('electronic');
    const totalNetPerPerson = (visa.embassyFee || 45) + (visa.serviceFee || 25);
    const countryCode = visa.countryCode || visa.country.slice(0, 3).toUpperCase();

    const prod = {
      id: `prod-visa-${visa.id}-${Date.now()}`,
      sku: `VSA-${countryCode}-${visa.id.slice(0, 4).toUpperCase()}`,
      destinationId: currentDestination.id,
      destinationName: visa.country,
      country: visa.country,
      city: `${visa.country} Visa Desk`,
      productType: `${visa.visaType} (${visa.validityDays || 30} Days)`,
      name: `${visa.country} ${visa.visaType} Facilitation`,
      shortDescription: `Official B2B embassy documentation verification, application submission, and passport return logistics.`,
      longDescription: `Full end-to-end visa facilitation for ${visa.country}. Includes government consulate fee, appointment scheduling, biometrics briefing, and application review.`,
      supplierId: 'sup-visa-consular',
      supplierName: 'TheUnbound Global Visa & Consular Network',
      category: 'Travel Services',
      subcategory: 'Visa Documentation & Facilitation',
      adultNetPrice: totalNetPerPerson,
      childNetPrice: Math.round(totalNetPerPerson * 0.8),
      infantNetPrice: Math.round(totalNetPerPerson * 0.3),
      currency: 'USD',
      defaultMarkupPercent: 20,
      taxPercent: 0,
      commissionPercent: 10,
      serviceFeeFixed: 0,
      season: 'All Year',
      validityFrom: '2026-01-01',
      validityTo: '2026-12-31',
      minPax: 1,
      maxPax: 50,
      availability: 'INSTANT',
      inclusions: [
        `Official Government / Consulate Visa Fee included ($${visa.embassyFee || 45} USD)`,
        'Document verification and checklist audit by certified visa specialist',
        'Embassy / VFS appointment scheduling & biometrics guidance',
        'Express status tracking and instant approval notification'
      ],
      exclusions: ['Courier shipping for original passports outside capital cities'],
      heroImage: visa.heroImage || 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?q=80&w=800&auto=format&fit=crop',
      galleryImages: ['https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?q=80&w=800&auto=format&fit=crop']
    } as unknown as Product;

    onAddProduct(prod, {
      adults: adultsCount,
      children: childrenCount,
      infants: infantsCount,
      travelDate: startDate,
      openDrawer: false
    });
  };

  return (
    <section className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden transition-all">
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
                VISA SERVICES & FACILITATION
              </h2>
              <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-[#00C6A6] text-slate-950">
                Option {activeOptionNumber}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Smart Travel Protection, Official Visas, 5G eSIM & VIP Ground Concierge Services
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
            <span>Browse Full Visa Catalog</span>
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
          {/* Sub-group Navigation Pills */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
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
                All Facilitation Services
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
                <span>Visa Services ({visaItemsInQuote.length})</span>
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
                <span>Travel Protection ({protectionItemsInQuote.length})</span>
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
                <span>VIP Ground Services ({groundServicesInQuote.length})</span>
              </button>
            </div>

            <div className="text-xs text-slate-500 font-medium">
              Calculating for: <span className="font-bold text-slate-900">{adultsCount} Adults, {childrenCount} Children • {totalTripDays} Days in {currentDestination.name}</span>
            </div>
          </div>

          {/* ACTIVE ATTACHED SERVICES SUMMARY (IF ANY) */}
          {allSectionItemsInQuote.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Configured Services in Option {activeOptionNumber} ({allSectionItemsInQuote.length})</span>
                </h3>
                <span className="text-xs font-bold text-slate-900">
                  Total Investment: <span className="font-mono text-emerald-700">{formatCurrency(sectionTotalSelling, currency)}</span>
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {allSectionItemsInQuote.map((item) => {
                  const isVisa = item.product.sku?.startsWith('VSA-') || item.product.name.toLowerCase().includes('visa');
                  const isInsurance = item.product.subcategory === 'Travel Insurance' || item.product.name.toLowerCase().includes('insurance');
                  const isEsim = item.product.subcategory === 'eSIM Connectivity';

                  return (
                    <div
                      key={item.id}
                      className="bg-slate-50 hover:bg-white rounded-2xl p-4 border border-slate-200 hover:border-slate-300 transition-all shadow-2xs flex flex-col justify-between space-y-3"
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
                                {item.product.sku}
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

                      <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 text-xs">
                        <span className="text-slate-500 font-medium">
                          Coverage: <strong className="text-slate-800">{item.pax.adults} Adults{item.pax.children > 0 ? `, ${item.pax.children} Children` : ''}</strong>
                        </span>

                        <div className="flex items-center space-x-2">
                          {onOpenEditItem && (
                            <button
                              type="button"
                              onClick={() => onOpenEditItem(item)}
                              className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 text-xs font-bold transition-colors cursor-pointer"
                            >
                              Edit
                            </button>
                          )}
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

          {/* 1. VISA SERVICES GROUP */}
          {(activeTab === 'ALL' || activeTab === 'VISA') && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900 flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                    <span>1. VISA SERVICES & APPLICATION ASSISTANCE</span>
                  </h3>
                  <p className="text-xs text-slate-500">Official consular eVisas, embassy submission packages & expedited documentation.</p>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {destinationVisas.map((visa) => {
                  const isInQuote = items.some(it => it.product.id.includes(visa.id) || it.product.sku?.includes(visa.countryCode));
                  const effectiveFee = visa.expressFeeUSD && visa.expressFeeUSD > 0 ? visa.expressFeeUSD : visa.consulateFeeUSD;
                  const estimatedTotalUSD = (effectiveFee + visa.serviceFeeUSD) * totalPayingPax;

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
                                {visa.country} {visa.visaType}
                              </span>
                              <span className="text-[10px] font-bold text-slate-500 font-mono">
                                Processing: {visa.processingTime}
                              </span>
                            </div>
                            <h4 className="text-sm font-black text-slate-900 mt-1.5">
                              {visa.country} Official Tourist Visa Facilitation
                            </h4>
                            <p className="text-xs text-slate-600 mt-1">
                              Comprehensive consular visa support including full document audit, appointment scheduling, and biometrics preparation.
                            </p>
                          </div>
                        </div>

                        {/* Inclusions list */}
                        <div className="mt-3 space-y-1 text-xs text-slate-600">
                          <div className="flex items-center space-x-1.5">
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>Validity: <strong>{visa.validity} ({visa.entryType})</strong></span>
                          </div>
                          <div className="flex items-center space-x-1.5">
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>Stay Duration: <strong>{visa.stayDuration}</strong></span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-emerald-200/80">
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Final Selling Price</span>
                          <span className="text-sm font-black text-slate-900 font-mono">
                            ${effectiveFee + visa.serviceFeeUSD} <span className="text-xs font-normal text-slate-500">/ person (~${estimatedTotalUSD} total)</span>
                          </span>
                        </div>

                        {isInQuote ? (
                          <div className="flex items-center space-x-2">
                            <span className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center space-x-1 shadow-2xs">
                              <Check className="w-3.5 h-3.5" />
                              <span>Added to Option {activeOptionNumber}</span>
                            </span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAddDestinationVisa(visa)}
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs"
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
            </div>
          )}

          {/* 2. TRAVEL PROTECTION GROUP */}
          {(activeTab === 'ALL' || activeTab === 'PROTECTION') && (
            <div className="space-y-4 pt-2">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
                  <span>2. TRAVEL PROTECTION & INTERNATIONAL MEDICAL COVERAGE</span>
                </h3>
                <p className="text-xs text-slate-500">Tier-1 worldwide travel insurance with emergency medical hospitalization, trip cancellation & luggage cover.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {B2B_INSURANCE_PLANS.map((plan) => {
                  const isInQuote = items.some(it => it.product.id.includes(plan.id) || it.product.name.includes(plan.name));
                  const totalEstimatedSelling = ((plan.sellingPricePerDayAdultUSD * adultsCount) + (plan.sellingPricePerDayChildUSD * childrenCount)) * totalTripDays;

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
                            ${(plan.coverageAmountUSD / 1000).toFixed(0)}k USD Max Cover
                          </span>
                        </div>

                        <h4 className="text-sm font-black text-slate-900 mt-2">
                          {plan.name}
                        </h4>
                        <p className="text-xs text-slate-600 mt-1">
                          {plan.coverageSummary}
                        </p>

                        <div className="mt-3 space-y-1 text-xs text-slate-600">
                          <div className="flex items-center space-x-1.5">
                            <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span>{plan.medicalEmergencyCoverage}</span>
                          </div>
                          <div className="flex items-center space-x-1.5">
                            <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span>{plan.tripCancellationCoverage}</span>
                          </div>
                          <div className="flex items-center space-x-1.5">
                            <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span>{plan.baggageLossCoverage}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-blue-200/80">
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Estimated Premium ({totalTripDays} Days)</span>
                          <span className="text-sm font-black text-slate-900 font-mono">
                            ${totalEstimatedSelling.toFixed(0)} USD
                          </span>
                        </div>

                        {isInQuote ? (
                          <span className="px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold flex items-center space-x-1 shadow-2xs">
                            <Check className="w-3.5 h-3.5" />
                            <span>Added to Option {activeOptionNumber}</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAddInsurancePlan(plan)}
                            className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs"
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
            </div>
          )}

          {/* 3. GROUND SERVICES & CONNECTIVITY GROUP */}
          {(activeTab === 'ALL' || activeTab === 'GROUND') && (
            <div className="space-y-4 pt-2">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-teal-500 inline-block"></span>
                  <span>3. VIP GROUND SERVICES & 5G CONNECTIVITY</span>
                </h3>
                <p className="text-xs text-slate-500">Airport meet & assist, fast track lines, station porterage, and regional 5G eSIM connectivity.</p>
              </div>

              {/* eSIM Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {B2B_ESIM_PLANS.slice(0, 2).map((plan) => {
                  const isInQuote = items.some(it => it.product.id.includes(plan.id) || it.product.name.includes(plan.dataAllowance));

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
                          {plan.dataAllowance} High-Speed Roaming
                        </h4>
                        <p className="text-xs text-slate-600 mt-1">
                          Covers {plan.destination}. Instant digital QR activation delivered immediately.
                        </p>

                        <div className="mt-3 space-y-1 text-xs text-slate-600">
                          {plan.features.slice(0, 3).map((f, i) => (
                            <div key={i} className="flex items-center space-x-1.5">
                              <Check className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                              <span>{f}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Selling Price</span>
                          <span className="text-sm font-black text-slate-900 font-mono">
                            ${plan.sellingPriceUSD} USD <span className="text-xs font-normal text-slate-500">/ device</span>
                          </span>
                        </div>

                        {isInQuote ? (
                          <span className="px-3 py-1.5 rounded-xl bg-teal-600 text-white text-xs font-bold flex items-center space-x-1 shadow-2xs">
                            <Check className="w-3.5 h-3.5" />
                            <span>Added to Option {activeOptionNumber}</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAddEsimPlan(plan)}
                            className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Configure & Add</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Ground VIP Services Cards */}
                {groundServicesCatalog.map((svc) => {
                  const isInQuote = items.some(it => it.product.name.includes(svc.name) || it.product.id.includes(svc.id));
                  const isPerGroup = svc.pricingType === 'PER_GROUP';
                  const estimatedTotalUSD = isPerGroup ? svc.unitNetCostUSD * 1.25 : svc.unitNetCostUSD * 1.25 * totalPayingPax;

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
                            {svc.pricingType === 'PER_GROUP' ? 'Per Group / Booking' : 'Per Passenger'}
                          </span>
                        </div>

                        <h4 className="text-sm font-black text-slate-900 mt-2">
                          {svc.name}
                        </h4>
                        <p className="text-xs text-slate-600 mt-1">
                          {svc.shortDesc}
                        </p>

                        <div className="mt-3 space-y-1 text-xs text-slate-600">
                          {svc.inclusions.slice(0, 3).map((inc, i) => (
                            <div key={i} className="flex items-center space-x-1.5">
                              <Check className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                              <span>{inc}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Final Selling Price</span>
                          <span className="text-sm font-black text-slate-900 font-mono">
                            ${Math.round(estimatedTotalUSD)} USD
                          </span>
                        </div>

                        {isInQuote ? (
                          <span className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold flex items-center space-x-1 shadow-2xs">
                            <Check className="w-3.5 h-3.5" />
                            <span>Added to Option {activeOptionNumber}</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAddGroundService(svc)}
                            className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs"
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
            </div>
          )}
        </div>
      )}
    </section>
  );
};
