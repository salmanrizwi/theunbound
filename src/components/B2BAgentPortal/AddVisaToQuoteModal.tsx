import React, { useState, useMemo } from 'react';
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
  Download
} from 'lucide-react';
import { Product, CurrencyCode } from '../../types';
import { VisaProduct } from './B2BVisaView';
import { useAuth } from '../../context/AuthContext';
import { useQuotation } from '../../context/QuotationContext';
import { formatCurrency, convertCurrency } from '../../services/pricingEngine';

interface AddVisaToQuoteModalProps {
  visa: VisaProduct | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (visa: VisaProduct, details: { applicants: number; travelDate: string; notes?: string }) => void;
  existingItemId?: string;
  initialTravelDate?: string;
  initialApplicants?: number;
  initialNotes?: string;
}

export const visaProductToProduct = (visa: VisaProduct): Product => {
  return {
    id: visa.id,
    sku: `VSA-${visa.countryCode}-${visa.category}`,
    destinationId: `dest-${visa.country.toLowerCase().replace(/\s+/g, '-')}`,
    destinationName: visa.country,
    country: visa.country,
    city: 'National Embassy / eVisa Desk',
    productType: 'Visa Service',
    name: `${visa.country} ${visa.visaType}`,
    shortDescription: `Official B2B Visa Facilitation: ${visa.entryType}, ${visa.processingTimeDays} turnaround. Validity: ${visa.validity}.`,
    longDescription: `${visa.visaType} for ${visa.country}. Processing timeframe: ${visa.processingTimeDays}. Stay duration: ${visa.stayDuration}. Validity: ${visa.validity}. Submission Type: ${visa.embassySubmissionType}.`,
    supplierId: 'sup-visa-dmc',
    supplierName: 'TheUnbound Visa & Travel Desk',
    supplierProductCode: `VISA-${visa.countryCode}`,
    category: 'Travel Services',
    subcategory: 'Visa Facilitation',
    duration: visa.processingTimeDays,
    operatingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    operatingHours: '09:00 - 18:00',
    adultNetPrice: visa.wholesaleNetUSD + visa.embassyFeeUSD,
    childNetPrice: visa.wholesaleNetUSD + visa.embassyFeeUSD,
    infantNetPrice: 0,
    currency: 'USD',
    defaultMarkupPercent: Math.round(((visa.suggestedSellingUSD - (visa.wholesaleNetUSD + visa.embassyFeeUSD)) / (visa.wholesaleNetUSD + visa.embassyFeeUSD)) * 100) || 20,
    taxPercent: 0,
    commissionPercent: 10,
    serviceFeeFixed: 0,
    sellingPriceStartingFrom: visa.suggestedSellingUSD,
    season: 'All Year',
    validityFrom: '2026-01-01',
    validityTo: '2026-12-31',
    minPax: 1,
    maxPax: 20,
    availability: 'INSTANT',
    bookingRequiredDays: 5,
    cancellationPolicy: 'Non-refundable once dossier is lodged with the embassy or government portal.',
    inclusions: [
      'Document verification & dossier pre-audit',
      `Embassy fee payment facilitation ($${visa.embassyFeeUSD})`,
      'Appointment scheduling & cover letter drafting',
      'Continuous tracking & status updates'
    ],
    exclusions: [
      'Courier return charges outside metropolitan areas',
      'Optional priority embassy fast-track surcharge'
    ],
    importantInformation: visa.importantNotes,
    heroImage: visa.imageUrl,
    galleryImages: [visa.imageUrl]
  };
};

export const AddVisaToQuoteModal: React.FC<AddVisaToQuoteModalProps> = ({
  visa,
  isOpen,
  onClose,
  onSuccess,
  existingItemId,
  initialTravelDate,
  initialApplicants = 1,
  initialNotes = ''
}) => {
  const { currency, addProductToQuote, updateQuoteItem } = useQuotation();

  const [adultApplicants, setAdultApplicants] = useState<number>(initialApplicants);
  const [childApplicants, setChildApplicants] = useState<number>(0);
  const [travelDate, setTravelDate] = useState<string>(() => {
    if (initialTravelDate) return initialTravelDate;
    const d = new Date(Date.now() + 86400000 * 14);
    return d.toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState<string>(initialNotes);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen && visa) {
      if (initialTravelDate) setTravelDate(initialTravelDate);
      setAdultApplicants(initialApplicants);
      setChildApplicants(0);
      setNotes(initialNotes || '');
      setErrorMsg(null);
    }
  }, [isOpen, visa?.id, initialTravelDate, initialApplicants, initialNotes, existingItemId]);

  if (!isOpen || !visa) return null;

  const totalApplicants = adultApplicants + childApplicants;

  // Calculation in Quote Currency
  const totalNetUSD = (visa.wholesaleNetUSD + visa.embassyFeeUSD) * totalApplicants;
  const totalSellingUSD = visa.suggestedSellingUSD * totalApplicants;
  const totalNetConverted = convertCurrency(totalNetUSD, 'USD', currency);
  const totalSellingConverted = convertCurrency(totalSellingUSD, 'USD', currency);

  const handleConfirm = () => {
    if (totalApplicants < 1) {
      setErrorMsg('At least 1 visa applicant is required.');
      return;
    }

    const prod = visaProductToProduct(visa);
    const compiledNotes = notes.trim() 
      ? `${notes.trim()} | Visa Type: ${visa.visaType} (${visa.entryType})`
      : `Visa Type: ${visa.visaType} (${visa.entryType})`;

    if (existingItemId) {
      updateQuoteItem(existingItemId, prod, {
        adults: adultApplicants,
        children: childApplicants,
        infants: 0,
        travelDate,
        serviceTime: `${visa.processingTimeDays} Processing`,
        notes: compiledNotes
      });
    } else {
      addProductToQuote(prod, {
        adults: adultApplicants,
        children: childApplicants,
        infants: 0,
        travelDate,
        serviceTime: `${visa.processingTimeDays} Processing`,
        notes: compiledNotes,
        openDrawer: false
      });
    }

    if (onSuccess) {
      onSuccess(visa, {
        applicants: totalApplicants,
        travelDate,
        notes: notes.trim() || undefined
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div 
        id="add-visa-to-quote-modal"
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh] animate-scaleUp"
      >
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-5 sm:p-6 flex items-start justify-between">
          <div className="flex items-start space-x-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#00C6A6]/20 border border-[#00C6A6]/40 flex items-center justify-center text-[#00E5C0] shrink-0 mt-0.5">
              <FileCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-[#00C6A6] text-slate-950 text-[10px] font-black uppercase tracking-wider">
                  Visa Facilitation Desk
                </span>
                <span className="text-xs text-slate-300 font-bold">
                  {visa.country}
                </span>
                <span className="text-xs text-slate-400 font-mono">({visa.entryType})</span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white mt-1 leading-snug">
                {visa.country} {visa.visaType}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer shrink-0 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1 bg-slate-50/50">
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-2xl flex items-center space-x-2 text-xs font-bold animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Visa Specs Overview */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <span className="text-[10px] text-slate-400 font-bold block uppercase">Turnaround</span>
              <span className="font-bold text-slate-900 mt-0.5 block">{visa.processingTimeDays}</span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <span className="text-[10px] text-slate-400 font-bold block uppercase">Stay Allowed</span>
              <span className="font-bold text-slate-900 mt-0.5 block">{visa.stayDuration}</span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <span className="text-[10px] text-slate-400 font-bold block uppercase">Validity</span>
              <span className="font-bold text-slate-900 mt-0.5 block">{visa.validity}</span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <span className="text-[10px] text-slate-400 font-bold block uppercase">Submission</span>
              <span className="font-bold text-[#00a88c] mt-0.5 block">{visa.embassySubmissionType}</span>
            </div>
          </div>

          {/* Applicants Manifest */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-900">
                <Users className="w-4 h-4 text-[#00A88F]" />
                <span>Number of Visa Applicants</span>
              </div>
              <span className="text-xs font-extrabold text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200 font-mono">
                Total: {totalApplicants} {totalApplicants === 1 ? 'Applicant' : 'Applicants'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Adults */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Adult Applicants</span>
                  <span className="text-[10px] text-slate-500 block font-mono">
                    {formatCurrency(convertCurrency(visa.suggestedSellingUSD, 'USD', currency), currency)} / person
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-200">
                  <button
                    type="button"
                    disabled={adultApplicants <= 1 && childApplicants === 0}
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
                  <span className="text-xs font-bold text-slate-800 block">Child Applicants</span>
                  <span className="text-[10px] text-slate-500 block font-mono">
                    {formatCurrency(convertCurrency(visa.suggestedSellingUSD, 'USD', currency), currency)} / child
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
            </div>
          </div>

          {/* Intended Travel / Submission Target Date */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
            <label className="block text-xs font-bold text-slate-900 flex items-center space-x-1.5">
              <Calendar className="w-4 h-4 text-[#00A88F]" />
              <span>Intended Travel / Visa Filing Date</span>
            </label>
            <input
              type="date"
              value={travelDate}
              onChange={(e) => setTravelDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono outline-none focus:bg-white focus:ring-2 focus:ring-[#00C6A6] focus:border-[#00C6A6]"
            />
          </div>

          {/* Passport & Special Instructions */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-900">
              <FileText className="w-4 h-4 text-[#00A88F]" />
              <span>Passport Nationality & Applicant Notes</span>
            </div>
            <textarea
              rows={2}
              placeholder="e.g. Indian passport holders with US B1/B2 visa, requires appointment at New Delhi VFS, biometric submission..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-[#00C6A6] focus:border-[#00C6A6] placeholder:text-slate-400"
            />
          </div>

          {/* Real-time Commercial Price Box */}
          <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-md space-y-3">
            <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] flex items-center space-x-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#00E5C0]" />
                <span>Visa Facilitation Pricing Summary</span>
              </span>
              <span className="text-[11px] text-[#00E5C0] font-mono font-bold">
                {totalApplicants} {totalApplicants === 1 ? 'Applicant' : 'Applicants'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700">
                <span className="text-[10px] text-slate-400 block">Rate Per Applicant</span>
                <span className="text-sm font-bold text-slate-200 font-mono">
                  {formatCurrency(convertCurrency(visa.suggestedSellingUSD, 'USD', currency), currency)}
                </span>
                <span className="text-[9px] text-slate-400 block mt-0.5">
                  Complete Facilitation & Consular Processing
                </span>
              </div>

              <div className="bg-teal-950/60 p-2.5 rounded-xl border border-teal-600/40">
                <span className="text-[10px] text-teal-300 font-bold block">Final Selling Price</span>
                <span className="text-lg font-black text-[#00E5C0] font-mono">
                  {formatCurrency(totalSellingConverted, currency)}
                </span>
                <span className="text-[9px] text-teal-400 block">
                  ✓ All Fees & Applicable Taxes Included
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 bg-white border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            className="px-6 py-2.5 rounded-xl bg-[#00C6A6] hover:bg-[#00A88F] text-slate-950 text-xs font-black transition-all flex items-center space-x-2 cursor-pointer shadow-md hover:shadow-lg"
          >
            {existingItemId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>{existingItemId ? 'Update Visa in Cart' : 'Add Visa to Cart'} ({formatCurrency(totalSellingConverted, currency)})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
