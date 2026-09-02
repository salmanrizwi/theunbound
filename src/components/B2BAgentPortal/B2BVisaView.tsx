import React, { useState, useMemo } from 'react';
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
  Trash2
} from 'lucide-react';
import { Product, CurrencyCode } from '../../types';
import { useQuotation } from '../../context/QuotationContext';
import { formatCurrency } from '../../services/pricingEngine';
import { useAuth } from '../../context/AuthContext';
import { AddVisaToQuoteModal } from './AddVisaToQuoteModal';

export interface VisaProduct {
  id: string;
  country: string;
  countryCode: string;
  visaType: string;
  category: 'TOURIST' | 'BUSINESS' | 'TRANSIT' | 'LONG_STAY';
  processingTimeDays: string;
  stayDuration: string;
  validity: string;
  entryType: 'Single Entry' | 'Multiple Entry' | 'Double Entry';
  wholesaleNetUSD: number;
  embassyFeeUSD: number;
  suggestedSellingUSD: number;
  imageUrl: string;
  requiredDocuments: string[];
  photoSpecs: string;
  financialRequirements: string;
  embassySubmissionType: 'Online eVisa' | 'VFS Appointment' | 'Embassy In-Person' | 'Drop Box';
  importantNotes: string[];
}

export const VISA_CATALOG: VisaProduct[] = [
  {
    id: 'visa-jpn-evisa',
    country: 'Japan',
    countryCode: 'JP',
    visaType: 'Tourist eVisa (Electronic)',
    category: 'TOURIST',
    processingTimeDays: '5 - 7 Business Days',
    stayDuration: 'Up to 30 Days',
    validity: '90 Days from issuance',
    entryType: 'Single Entry',
    wholesaleNetUSD: 35,
    embassyFeeUSD: 25,
    suggestedSellingUSD: 85,
    imageUrl: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=800&auto=format&fit=crop',
    requiredDocuments: [
      'Original Passport valid for at least 6 months with 2 blank pages',
      'Completed Japan Visa Application Form with digital signature',
      'Recent passport-size photograph (35mm x 45mm, white background, 80% face coverage)',
      'Last 6 months updated personal bank statements with minimum closing balance of $3,500',
      'Last 2 years Income Tax Returns (ITR / Form 16)',
      'Confirmed flight reservation and day-wise travel itinerary from TheUnbound DMC',
      'Hotel booking vouchers / guarantee letter from registered DMC'
    ],
    photoSpecs: '35mm x 45mm, matte finish, pure white background, taken within last 3 months.',
    financialRequirements: 'Minimum bank balance of $3,500 per traveler or family sponsor letter with employment proof.',
    embassySubmissionType: 'Online eVisa',
    importantNotes: [
      'Direct electronic visa issuance; no physical passport submission required for eligible passport holders.',
      'DMC confirmed voucher code speeds up immigration clearance at Tokyo Narita, Haneda, and Kansai airports.'
    ]
  },
  {
    id: 'visa-jpn-multi',
    country: 'Japan',
    countryCode: 'JP',
    visaType: 'Multiple Entry Tourist Visa',
    category: 'TOURIST',
    processingTimeDays: '7 - 10 Business Days',
    stayDuration: 'Up to 30 Days per visit',
    validity: '3 Years / 5 Years',
    entryType: 'Multiple Entry',
    wholesaleNetUSD: 65,
    embassyFeeUSD: 50,
    suggestedSellingUSD: 140,
    imageUrl: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=800&auto=format&fit=crop',
    requiredDocuments: [
      'Original Passport valid for at least 1 year',
      'Cover letter outlining previous international travel history',
      'Last 3 years Income Tax Returns showing taxable income exceeding $15,000/year',
      'Last 6 months bank statement with healthy balance',
      'Employment contract or Company Registration documents',
      'Day-wise multi-city travel itinerary'
    ],
    photoSpecs: '35mm x 45mm on white background, neutral facial expression.',
    financialRequirements: 'High-income applicant bracket ($15,000+ annual taxable salary or equivalent business revenue).',
    embassySubmissionType: 'VFS Appointment',
    importantNotes: [
      'Eligible travelers who have visited Japan or G7 countries within the past 3 years receive priority processing.'
    ]
  },
  {
    id: 'visa-uk-visitor',
    country: 'United Kingdom',
    countryCode: 'GB',
    visaType: 'Standard Visitor Visa Assistance',
    category: 'TOURIST',
    processingTimeDays: '15 Business Days',
    stayDuration: 'Up to 180 Days (6 Months)',
    validity: '6 Months (2 / 5 / 10 Years options)',
    entryType: 'Multiple Entry',
    wholesaleNetUSD: 85,
    embassyFeeUSD: 155,
    suggestedSellingUSD: 290,
    imageUrl: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?q=80&w=800&auto=format&fit=crop',
    requiredDocuments: [
      'Current Passport & previous passports showing travel history',
      'UK Visas & Immigration (UKVI) online application portal filing',
      'Last 6 months bank statements stamped & signed by bank manager',
      'Salary slips for last 3 months + Employer Leave Sanction Letter',
      'Income Tax Returns for the last 3 years',
      'Comprehensive day-wise UK touring itinerary with pre-booked hotels',
      'VFS Biometrics appointment scheduling'
    ],
    photoSpecs: 'Biometric photograph captured in person at VFS Global center.',
    financialRequirements: 'Sufficient disposable liquid funds covering total planned UK trip expenses plus buffer.',
    embassySubmissionType: 'VFS Appointment',
    importantNotes: [
      'Priority processing (5 business days) available at additional embassy surcharge.',
      'Our team reviews all financial documentation to ensure 0% refusal risk.'
    ]
  },
  {
    id: 'visa-schengen-c',
    country: 'France / Schengen',
    countryCode: 'FR',
    visaType: 'Schengen Short-Stay Visa (Type C)',
    category: 'TOURIST',
    processingTimeDays: '15 Business Days',
    stayDuration: 'Up to 90 Days in any 180-day period',
    validity: 'Up to 6 Months / 1 Year',
    entryType: 'Multiple Entry',
    wholesaleNetUSD: 75,
    embassyFeeUSD: 95,
    suggestedSellingUSD: 240,
    imageUrl: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=800&auto=format&fit=crop',
    requiredDocuments: [
      'Original Passport with at least 3 months validity beyond intended departure from Schengen zone',
      'Completed Schengen Visa application form',
      'Travel Medical Insurance with minimum coverage of €30,000 ($35,000)',
      'Proof of accommodation covering entire stay in Schengen states',
      'Round-trip flight reservations with PNR',
      'Last 6 months bank statement with bank seal and signature',
      'Cover letter stating purpose of trip and complete travel route'
    ],
    photoSpecs: '35mm x 45mm, Schengen ISO standard, light grey or white background.',
    financialRequirements: 'Proof of daily subsistence allowance (approx. €120/day) plus liquid bank balance.',
    embassySubmissionType: 'VFS Appointment',
    importantNotes: [
      'Main destination rule applies: apply to the consulate of the country where the traveler will spend the most nights.'
    ]
  },
  {
    id: 'visa-swiss-visitor',
    country: 'Switzerland',
    countryCode: 'CH',
    visaType: 'Swiss Alpine Visitor Visa',
    category: 'TOURIST',
    processingTimeDays: '12 - 15 Business Days',
    stayDuration: 'Up to 90 Days',
    validity: 'Up to 90 Days',
    entryType: 'Multiple Entry',
    imageUrl: 'https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?q=80&w=800&auto=format&fit=crop',
    wholesaleNetUSD: 75,
    embassyFeeUSD: 95,
    suggestedSellingUSD: 235,
    requiredDocuments: [
      'Passport valid for at least 3 months after leaving Switzerland',
      'Two recent passport photos meeting ICAO standards',
      'Comprehensive travel insurance policy valid across all Schengen countries (€30,000 minimum)',
      'Swiss Travel Pass or confirmed internal rail reservations',
      'Confirmed alpine hotel vouchers',
      'Last 3 months certified bank statements'
    ],
    photoSpecs: '35mm x 45mm, crisp contrast, neutral expression, no headwear unless religious.',
    financialRequirements: 'Minimum 100 CHF (approx. $115) per day of stay in Switzerland.',
    embassySubmissionType: 'VFS Appointment',
    importantNotes: [
      'Swiss Embassy strictly verifies pre-booked rail passes and hotel voucher references.'
    ]
  },
  {
    id: 'visa-uae-evisa',
    country: 'United Arab Emirates',
    countryCode: 'AE',
    visaType: 'Dubai 30-Day Tourist eVisa (Express)',
    category: 'TOURIST',
    processingTimeDays: '24 - 48 Hours',
    stayDuration: '30 Days',
    validity: '60 Days from issuance',
    entryType: 'Single Entry',
    wholesaleNetUSD: 40,
    embassyFeeUSD: 90,
    suggestedSellingUSD: 165,
    imageUrl: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?q=80&w=800&auto=format&fit=crop',
    requiredDocuments: [
      'Clear color copy of Passport bio-page (valid for at least 6 months)',
      'Passport size photograph on white background (JPEG format)',
      'Confirmed return flight tickets (Air Arabia, Emirates, FlyDubai or other carrier)',
      'Hotel voucher / host resident address in UAE'
    ],
    photoSpecs: 'Digital color JPEG, white background, high resolution.',
    financialRequirements: 'Standard valid passport and return airline ticket.',
    embassySubmissionType: 'Online eVisa',
    importantNotes: [
      '100% online express issuance with QR-coded immigration paperless entry.'
    ]
  }
];

interface B2BVisaViewProps {
  onOpenCreateQuote?: () => void;
}

export const B2BVisaView: React.FC<B2BVisaViewProps> = ({
  onOpenCreateQuote
}) => {
  const { user } = useAuth();
  const { items, addProductToQuote, removeProductFromQuote, currency, setIsQuoteDrawerOpen } = useQuotation();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedVisaDetails, setSelectedVisaDetails] = useState<VisaProduct | null>(null);
  const [selectedVisaForQuoteModal, setSelectedVisaForQuoteModal] = useState<VisaProduct | null>(null);
  const [downloadSuccessMessage, setDownloadSuccessMessage] = useState<string | null>(null);
  const [quoteSuccessNotification, setQuoteSuccessNotification] = useState<{ visa: VisaProduct; applicants: number } | null>(null);

  const countries = useMemo(() => {
    const list = Array.from(new Set(VISA_CATALOG.map(v => v.country)));
    return ['ALL', ...list];
  }, []);

  const filteredVisas = useMemo(() => {
    return VISA_CATALOG.filter(v => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = 
        !q ||
        v.country.toLowerCase().includes(q) ||
        v.visaType.toLowerCase().includes(q) ||
        v.stayDuration.toLowerCase().includes(q) ||
        v.entryType.toLowerCase().includes(q);

      const matchesCountry = selectedCountry === 'ALL' || v.country === selectedCountry;
      const matchesCategory = selectedCategory === 'ALL' || v.category === selectedCategory;

      return matchesSearch && matchesCountry && matchesCategory;
    });
  }, [searchQuery, selectedCountry, selectedCategory]);

  const isVisaInQuote = (visaId: string) => {
    return items.some(it => it.product.id === visaId);
  };

  const handleOpenAddVisaModal = (visa: VisaProduct) => {
    setSelectedVisaForQuoteModal(visa);
  };

  const handleRemoveVisaFromQuote = (visaId: string) => {
    const existing = items.find(it => it.product.id === visaId);
    if (existing) {
      removeProductFromQuote(existing.id);
    }
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full bg-[#00C6A6]/10 text-[#00a88c] border border-[#00C6A6]/20 text-[10px] font-bold uppercase tracking-wider">
              Travel Trade Visa Services
            </span>
            <span className="text-xs text-slate-400 font-mono">({VISA_CATALOG.length} Direct Visas)</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 font-sans mt-1">Visa Facilitation & Document Checklists</h1>
          <p className="text-xs text-slate-500 max-w-2xl mt-0.5">
            Pre-audited document verification, appointment scheduling, and online eVisa processing with guaranteed DMC support.
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
            <div className="w-8 h-8 rounded-xl bg-[#00C6A6] text-slate-950 flex items-center justify-center font-bold">
              <Check className="w-4 h-4 stroke-[3]" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">
                {quoteSuccessNotification.visa.country} {quoteSuccessNotification.visa.visaType} added to Cart!
              </div>
              <div className="text-[11px] text-[#00E5C0]">
                Configured for {quoteSuccessNotification.applicants} {quoteSuccessNotification.applicants === 1 ? 'Applicant' : 'Applicants'} under dedicated VISA section.
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => setIsQuoteDrawerOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-[#00C6A6] hover:bg-[#00E5C0] text-slate-950 text-xs font-black transition-all cursor-pointer shadow-xs flex items-center space-x-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>View Cart</span>
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
          <button onClick={() => setDownloadSuccessMessage(null)} className="text-emerald-600 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by country, visa type (e.g. Japan eVisa, UK Visitor, Schengen, Dubai)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-[#00C6A6] focus:bg-white transition-all"
          />
        </div>

        <div className="flex items-center space-x-2 w-full md:w-auto">
          <select
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none cursor-pointer hover:border-slate-300"
          >
            {countries.map(c => (
              <option key={c} value={c}>{c === 'ALL' ? 'All Countries' : c}</option>
            ))}
          </select>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none cursor-pointer hover:border-slate-300"
          >
            <option value="ALL">All Categories</option>
            <option value="TOURIST">Tourist Visas</option>
            <option value="BUSINESS">Business Visas</option>
          </select>
        </div>
      </div>

      {/* Visas Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredVisas.map(visa => {
          const inQuote = isVisaInQuote(visa.id);
          return (
            <div
              key={visa.id}
              className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:border-[#00C6A6] hover:shadow-md transition-all flex flex-col overflow-hidden group"
            >
              {/* Header Image Strip */}
              <div className="relative h-44 overflow-hidden bg-slate-100">
                <img
                  src={visa.imageUrl}
                  alt={visa.country}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent"></div>

                <div className="absolute top-3 left-3 flex items-center space-x-2">
                  <span className="px-2.5 py-1 rounded-full bg-slate-900/90 backdrop-blur-xs text-white text-[10px] font-bold tracking-wider">
                    {visa.country}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-[#00C6A6] text-slate-950 text-[10px] font-black uppercase">
                    {visa.embassySubmissionType}
                  </span>
                </div>

                <div className="absolute bottom-3 left-3 right-3 text-white">
                  <h3 className="font-bold text-base text-white leading-snug drop-shadow-xs">
                    {visa.visaType}
                  </h3>
                  <p className="text-[11px] text-slate-200 flex items-center space-x-1.5 mt-0.5">
                    <Clock className="w-3 h-3 text-[#00E5C0]" />
                    <span>Processing: {visa.processingTimeDays}</span>
                  </p>
                </div>
              </div>

              {/* Body Details */}
              <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-400 block font-medium">Stay Duration</span>
                    <span className="font-bold text-slate-800">{visa.stayDuration}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-400 block font-medium">Entry Type</span>
                    <span className="font-bold text-slate-800">{visa.entryType}</span>
                  </div>
                </div>

                {/* Key Checklist Preview */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Checklist Highlights ({visa.requiredDocuments.length} Requirements)
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
                    <span className="text-[10px] text-slate-400 block font-medium">B2B Net Rate</span>
                    <span className="text-base font-extrabold text-slate-900 font-mono">
                      {formatCurrency(visa.wholesaleNetUSD + visa.embassyFeeUSD, currency)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block font-medium">Suggested Retail</span>
                    <span className="text-xs font-bold text-emerald-600 font-mono">
                      {formatCurrency(visa.suggestedSellingUSD, currency)}
                    </span>
                  </div>
                </div>

                {/* 4 Standardized Actions */}
                <div className="space-y-2 pt-1">
                  {/* Primary & Secondary Row */}
                  <div className="grid grid-cols-2 gap-2">
                    {inQuote ? (
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handleOpenAddVisaModal(visa)}
                          className="flex-1 py-2 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center justify-center space-x-1 cursor-pointer shadow-xs"
                          title="Click to edit applicants or visa parameters in quote"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>In Cart (Edit)</span>
                        </button>
                        <button
                          onClick={() => handleRemoveVisaFromQuote(visa.id)}
                          className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-colors cursor-pointer"
                          title="Remove from Cart"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleOpenAddVisaModal(visa)}
                        className="w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs bg-[#00C6A6] hover:bg-[#00b395] text-slate-950"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Configure & Add to Cart</span>
                      </button>
                    )}

                    <button
                      onClick={() => setSelectedVisaDetails(visa)}
                      className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-300" />
                      <span>View Details</span>
                    </button>
                  </div>

                  {/* Tertiary: Download Checklist */}
                  <button
                    onClick={() => handleDownloadChecklist(visa)}
                    className="w-full py-2 px-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                    title="Download PDF/Text document checklist"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span>Download Requirements Checklist</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Details & Checklist Modal (Fits Viewport, Fixed Header/Footer, Scrollable) */}
      {selectedVisaDetails && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-hidden"
          onClick={() => setSelectedVisaDetails(null)}
        >
          <div 
            className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-pop-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Fixed Header */}
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
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] text-slate-400 block font-medium">Category</span>
                  <span className="font-extrabold text-slate-800">{selectedVisaDetails.category}</span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] text-slate-400 block font-medium">Processing Time</span>
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

              {/* Complete Mandatory Documents List */}
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

              {/* Operational SLA Notes */}
              <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 space-y-1.5">
                <h4 className="font-bold text-amber-900 flex items-center space-x-1.5 text-xs">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  <span>DMC Visa Operations Note</span>
                </h4>
                <ul className="space-y-1 text-[11px] text-amber-800 list-disc list-inside">
                  {selectedVisaDetails.importantNotes.map((note, idx) => (
                    <li key={idx}>{note}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Fixed Footer */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0 gap-3">
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">Total B2B Net Cost</span>
                <span className="text-base font-extrabold text-slate-900 font-mono">
                  {formatCurrency(selectedVisaDetails.wholesaleNetUSD + selectedVisaDetails.embassyFeeUSD, currency)}
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
                    handleOpenAddVisaModal(v);
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

      {/* Dedicated Add Visa to Quote Modal */}
      <AddVisaToQuoteModal
        visa={selectedVisaForQuoteModal}
        isOpen={Boolean(selectedVisaForQuoteModal)}
        onClose={() => setSelectedVisaForQuoteModal(null)}
        onSuccess={(visa, details) => {
          setQuoteSuccessNotification({
            visa,
            applicants: details.applicants
          });
        }}
      />
    </div>
  );
};
