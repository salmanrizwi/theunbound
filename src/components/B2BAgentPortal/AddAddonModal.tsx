import React, { useState } from 'react';
import { 
  X, 
  ShieldCheck, 
  Wifi, 
  Plus, 
  Check, 
  Info, 
  DollarSign, 
  Users, 
  Calendar,
  Sparkles,
  Plane,
  Luggage,
  Shield,
  Smartphone
} from 'lucide-react';
import { Product, CurrencyCode } from '../../types';
import { useQuotation } from '../../context/QuotationContext';
import { formatCurrency, convertCurrency } from '../../services/pricingEngine';
import { B2B_INSURANCE_PLANS, B2B_ESIM_PLANS } from '../../utils/b2bQuotationHelpers';

interface AddAddonModalProps {
  isOpen: boolean;
  onClose: () => void;
  destinationName: string;
  totalDays: number;
  adultsCount: number;
  childrenCount: number;
  initialCategory?: 'ALL' | 'INSURANCE' | 'ESIM' | 'SERVICES';
  onAdded?: (productName: string) => void;
}

export const AddAddonModal: React.FC<AddAddonModalProps> = ({
  isOpen,
  onClose,
  destinationName,
  totalDays,
  adultsCount,
  childrenCount,
  initialCategory = 'ALL',
  onAdded
}) => {
  const { currency, addProductToQuote } = useQuotation();
  const [activeTab, setActiveTab] = useState<'ALL' | 'INSURANCE' | 'ESIM' | 'SERVICES'>(initialCategory);
  const [selectedDays, setSelectedDays] = useState<number>(Math.max(1, totalDays || 7));
  const [selectedAdults, setSelectedAdults] = useState<number>(Math.max(1, adultsCount || 2));
  const [selectedChildren, setSelectedChildren] = useState<number>(childrenCount || 0);

  if (!isOpen) return null;

  const handleAddInsurance = (plan: typeof B2B_INSURANCE_PLANS[0]) => {
    const totalAdultCost = plan.costPerDayAdultUSD * selectedDays * selectedAdults;
    const totalChildCost = plan.costPerDayChildUSD * selectedDays * selectedChildren;
    const totalNetCost = totalAdultCost + totalChildCost;

    const totalAdultSelling = plan.sellingPricePerDayAdultUSD * selectedDays * selectedAdults;
    const totalChildSelling = plan.sellingPricePerDayChildUSD * selectedDays * selectedChildren;
    const totalSelling = totalAdultSelling + totalChildSelling;

    const markupPercent = Math.round(((totalSelling - totalNetCost) / Math.max(1, totalNetCost)) * 100);

    const product = {
      id: `addon-${plan.id}-${Date.now()}`,
      sku: `INS-${plan.id.toUpperCase()}`,
      destinationId: `dest-global`,
      destinationName: destinationName || 'Worldwide',
      country: destinationName || 'International',
      city: 'Global Protection Desk',
      productType: 'Travel Insurance',
      name: `${plan.name} (${selectedDays} Days)`,
      shortDescription: `${plan.coverageSummary} Total Coverage: $${plan.coverageAmountUSD.toLocaleString()} USD. Provider: ${plan.provider}.`,
      longDescription: `Full comprehensive travel insurance for ${selectedAdults} Adults and ${selectedChildren} Children covering ${selectedDays} days of travel in ${destinationName}. Includes: ${plan.medicalEmergencyCoverage}, ${plan.tripCancellationCoverage}, ${plan.baggageLossCoverage}.`,
      supplierId: 'sup-insurance-global',
      supplierName: plan.provider,
      category: 'Travel Services',
      subcategory: 'Travel Insurance',
      adultNetPrice: plan.costPerDayAdultUSD * selectedDays,
      childNetPrice: plan.costPerDayChildUSD * selectedDays,
      infantNetPrice: 0,
      currency: 'USD',
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
        '24/7 International Medical Assistance Helpline',
        'COVID-19 Quarantine & Treatment Coverage'
      ],
      exclusions: ['Pre-existing medical conditions unless declared', 'Extreme uncertified adventure sports'],
      heroImage: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=800&auto=format&fit=crop',
      galleryImages: ['https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=800&auto=format&fit=crop']
    } as unknown as Product;

    addProductToQuote(product, { adults: selectedAdults, children: selectedChildren, infants: 0 });
    onAdded?.(product.name);
    onClose();
  };

  const handleAddEsim = (plan: typeof B2B_ESIM_PLANS[0]) => {
    const markupPercent = Math.round(((plan.sellingPriceUSD - plan.netCostUSD) / Math.max(1, plan.netCostUSD)) * 100);

    const product = {
      id: `addon-${plan.id}-${Date.now()}`,
      sku: `ESIM-${plan.id.toUpperCase()}`,
      destinationId: `dest-${destinationName.toLowerCase().replace(/\s+/g, '-')}`,
      destinationName: destinationName || 'Pan-Asia',
      country: destinationName || 'Regional',
      city: 'Instant Digital eSIM Portal',
      productType: 'Digital Connectivity',
      name: `${destinationName} 5G eSIM (${plan.dataAllowance}, ${plan.validityDays} Days)`,
      shortDescription: `Instant high-speed 5G/4G connectivity for ${destinationName}. QR-code email delivery. Tethering & hotspot supported.`,
      longDescription: `Digital eSIM data plan with ${plan.dataAllowance} valid for ${plan.validityDays} days. Roams seamlessly on top tier mobile carriers. Instant automatic connection upon arrival.`,
      supplierId: 'sup-esim-global',
      supplierName: plan.carrier,
      category: 'Travel Services',
      subcategory: 'eSIM Connectivity',
      adultNetPrice: plan.netCostUSD,
      childNetPrice: 0,
      infantNetPrice: 0,
      currency: 'USD',
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
        'Hotspot / Mobile Tethering Allowed',
        'No physical SIM card swapping required'
      ],
      exclusions: ['Traditional voice calls / SMS (Data-only; use WhatsApp/FaceTime)'],
      heroImage: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?q=80&w=800&auto=format&fit=crop',
      galleryImages: ['https://images.unsplash.com/photo-1563986768609-322da13575f3?q=80&w=800&auto=format&fit=crop']
    } as unknown as Product;

    addProductToQuote(product, { adults: 1, children: 0, infants: 0 });
    onAdded?.(product.name);
    onClose();
  };

  const handleAddVipService = (serviceType: 'VIP_MEET_GREET' | 'LUGGAGE_VAN' | 'PORTABLE_WIFI') => {
    let name = '';
    let desc = '';
    let netCost = 45;
    let selling = 65;

    if (serviceType === 'VIP_MEET_GREET') {
      name = `VIP Airport Tarmac / Aerobridge Fast-Track Meet & Greet`;
      desc = `Dedicated airport escort directly from aerobridge, fast-track immigration clearance, luggage assistance & escort to chauffeur vehicle.`;
      netCost = 75;
      selling = 110;
    } else if (serviceType === 'LUGGAGE_VAN') {
      name = `Dedicated Chauffeur Luggage Support Van`;
      desc = `Separate dedicated luggage support van for excess golf bags, family luggage, and VIP shopping boxes.`;
      netCost = 90;
      selling = 135;
    } else {
      name = `Unlimited Pocket Wi-Fi Router (Airport Pickup & Drop)`;
      desc = `Portable 5G Pocket Wi-Fi connecting up to 8 devices simultaneously with all-day battery life.`;
      netCost = 6 * selectedDays;
      selling = 10 * selectedDays;
    }

    const product = {
      id: `addon-service-${serviceType.toLowerCase()}-${Date.now()}`,
      sku: `SVC-${serviceType}`,
      destinationId: `dest-${destinationName.toLowerCase().replace(/\s+/g, '-')}`,
      destinationName: destinationName || 'General Destination',
      country: destinationName || 'General',
      city: 'Airport VIP Ground Services',
      productType: 'VIP Concierge Service',
      name: name,
      shortDescription: desc,
      longDescription: desc,
      supplierId: 'sup-ground-vip',
      supplierName: 'TheUnbound VIP Operations',
      category: 'Travel Services',
      subcategory: 'Ground Concierge',
      adultNetPrice: netCost,
      childNetPrice: 0,
      infantNetPrice: 0,
      currency: 'USD',
      defaultMarkupPercent: Math.round(((selling - netCost) / netCost) * 100),
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
      exclusions: ['Tips and personal gratuities'],
      heroImage: 'https://images.unsplash.com/photo-1542296332-2e4473faf563?q=80&w=800&auto=format&fit=crop',
      galleryImages: ['https://images.unsplash.com/photo-1542296332-2e4473faf563?q=80&w=800&auto=format&fit=crop']
    } as unknown as Product;

    addProductToQuote(product, { adults: 1, children: 0, infants: 0 });
    onAdded?.(product.name);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-slate-900 text-white p-6 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-[#00C6A6]/20 text-[#00E5C0] flex items-center justify-center border border-[#00C6A6]/40">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Add Travel Protection & Ground Services</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Pre-contracted wholesale add-ons for {destinationName || 'Destination'} ({selectedDays} Days • {selectedAdults} Adults{selectedChildren ? `, ${selectedChildren} Children` : ''})
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Tabs */}
        <div className="px-6 pt-4 border-b border-slate-200 flex items-center space-x-2 bg-slate-50">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all cursor-pointer border-b-2 ${
              activeTab === 'ALL'
                ? 'border-[#00C6A6] text-slate-950 bg-white shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            All Services
          </button>
          <button
            onClick={() => setActiveTab('INSURANCE')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all cursor-pointer border-b-2 flex items-center space-x-1.5 ${
              activeTab === 'INSURANCE'
                ? 'border-[#00C6A6] text-slate-950 bg-white shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-amber-500" />
            <span>Travel Insurance ({B2B_INSURANCE_PLANS.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('ESIM')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all cursor-pointer border-b-2 flex items-center space-x-1.5 ${
              activeTab === 'ESIM'
                ? 'border-[#00C6A6] text-slate-950 bg-white shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5 text-blue-500" />
            <span>5G eSIM Data ({B2B_ESIM_PLANS.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('SERVICES')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all cursor-pointer border-b-2 flex items-center space-x-1.5 ${
              activeTab === 'SERVICES'
                ? 'border-[#00C6A6] text-slate-950 bg-white shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Plane className="w-3.5 h-3.5 text-emerald-500" />
            <span>VIP Airport & Ground</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 max-h-[65vh] overflow-y-auto space-y-6">
          
          {/* 1. Travel Insurance Section */}
          {(activeTab === 'ALL' || activeTab === 'INSURANCE') && (
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  International Travel Insurance Plans
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {B2B_INSURANCE_PLANS.map(plan => {
                  const estSelling = (plan.sellingPricePerDayAdultUSD * selectedDays * selectedAdults) + 
                                     (plan.sellingPricePerDayChildUSD * selectedDays * selectedChildren);
                  return (
                    <div key={plan.id} className="p-4 rounded-2xl border border-slate-200 bg-amber-50/30 hover:border-amber-400 transition-all flex flex-col justify-between space-y-3">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-900">
                            ${(plan.coverageAmountUSD / 1000).toFixed(0)}k Cover
                          </span>
                          <span className="text-xs font-bold text-slate-500">{plan.provider.split('/')[0]}</span>
                        </div>
                        <h5 className="text-sm font-black text-slate-900 leading-tight">{plan.name}</h5>
                        <p className="text-xs text-slate-600">{plan.coverageSummary}</p>
                        <div className="text-[11px] text-slate-500 space-y-0.5 pt-1">
                          <div className="flex items-center space-x-1">
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span>{plan.medicalEmergencyCoverage}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span>{plan.tripCancellationCoverage}</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-amber-200/80 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-slate-400 block">Total for {selectedDays} Days:</span>
                          <span className="text-sm font-black font-mono text-slate-900">
                            {formatCurrency(convertCurrency(estSelling, 'USD', currency), currency)}
                          </span>
                        </div>
                        <button
                          onClick={() => handleAddInsurance(plan)}
                          className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black transition-colors flex items-center space-x-1 cursor-pointer shadow-xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add to Cart</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. 5G eSIM Section */}
          {(activeTab === 'ALL' || activeTab === 'ESIM') && (
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Smartphone className="w-4 h-4 text-blue-600" />
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Instant International 5G eSIM Plans
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {B2B_ESIM_PLANS.map(plan => (
                  <div key={plan.id} className="p-4 rounded-2xl border border-slate-200 bg-blue-50/30 hover:border-blue-400 transition-all flex flex-col justify-between space-y-3">
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-900">
                        {plan.dataAllowance}
                      </span>
                      <h5 className="text-xs font-black text-slate-900 leading-snug">{plan.destination}</h5>
                      <p className="text-[11px] text-slate-600">{plan.validityDays} Days • {plan.carrier}</p>
                      <div className="text-[10px] text-slate-500 space-y-0.5 pt-1">
                        {plan.features.slice(0, 2).map((f, i) => (
                          <div key={i} className="flex items-center space-x-1">
                            <Check className="w-2.5 h-2.5 text-blue-600" />
                            <span>{f}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-blue-200/80 flex items-center justify-between">
                      <div className="text-sm font-black font-mono text-slate-900">
                        {formatCurrency(convertCurrency(plan.sellingPriceUSD, 'USD', currency), currency)}
                      </div>
                      <button
                        onClick={() => handleAddEsim(plan)}
                        className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black transition-colors flex items-center space-x-1 cursor-pointer shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add eSIM</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. VIP Airport & Concierge Section */}
          {(activeTab === 'ALL' || activeTab === 'SERVICES') && (
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Plane className="w-4 h-4 text-emerald-600" />
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  VIP Concierge & Ground Add-ons
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl border border-slate-200 bg-emerald-50/30 hover:border-emerald-400 transition-all flex flex-col justify-between space-y-3">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-900">VIP Fast-Track</span>
                    <h5 className="text-xs font-bold text-slate-900">Airport Aerobridge Meet & Greet</h5>
                    <p className="text-[11px] text-slate-600">Personal escort from aircraft door through express immigration.</p>
                  </div>
                  <div className="pt-2 border-t border-emerald-200/80 flex items-center justify-between">
                    <span className="text-sm font-bold font-mono text-slate-900">
                      {formatCurrency(convertCurrency(110, 'USD', currency), currency)}
                    </span>
                    <button
                      onClick={() => handleAddVipService('VIP_MEET_GREET')}
                      className="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                    >
                      + Add
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 bg-emerald-50/30 hover:border-emerald-400 transition-all flex flex-col justify-between space-y-3">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-900">Ground Luggage</span>
                    <h5 className="text-xs font-bold text-slate-900">Dedicated Luggage Support Van</h5>
                    <p className="text-[11px] text-slate-600">Separate van for excess baggage, golf bags, and VIP equipment.</p>
                  </div>
                  <div className="pt-2 border-t border-emerald-200/80 flex items-center justify-between">
                    <span className="text-sm font-bold font-mono text-slate-900">
                      {formatCurrency(convertCurrency(135, 'USD', currency), currency)}
                    </span>
                    <button
                      onClick={() => handleAddVipService('LUGGAGE_VAN')}
                      className="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                    >
                      + Add
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 bg-emerald-50/30 hover:border-emerald-400 transition-all flex flex-col justify-between space-y-3">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-900">5G Device</span>
                    <h5 className="text-xs font-bold text-slate-900">Pocket Wi-Fi Hotspot ({selectedDays} Days)</h5>
                    <p className="text-[11px] text-slate-600">Unlimited portable hotspot for up to 8 mobile devices.</p>
                  </div>
                  <div className="pt-2 border-t border-emerald-200/80 flex items-center justify-between">
                    <span className="text-sm font-bold font-mono text-slate-900">
                      {formatCurrency(convertCurrency(10 * selectedDays, 'USD', currency), currency)}
                    </span>
                    <button
                      onClick={() => handleAddVipService('PORTABLE_WIFI')}
                      className="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                    >
                      + Add
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500 flex items-center space-x-1.5">
            <Info className="w-4 h-4 text-slate-400" />
            <span>All add-on services include guaranteed allotment and 24/7 ground desk SLA.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
