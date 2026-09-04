import React from 'react';
import { 
  X, 
  Layers, 
  Building2, 
  Compass, 
  Car, 
  ShieldCheck, 
  DollarSign, 
  FileDown, 
  BookmarkCheck, 
  Copy, 
  ArrowRight, 
  Check, 
  Sparkles,
  Award,
  Globe2
} from 'lucide-react';
import { QuotationOption, CurrencyCode, TripRouteHub } from '../../types';
import { formatCurrency } from '../../services/pricingEngine';

export interface QuotationOptionDetailedData {
  id: string;
  optionNumber: number;
  title: string;
  badge: string;
  hotelTier?: string;
  hotelSummary?: string;
  itemsCount: number;
  hotelsCount: number;
  activitiesCount: number;
  transfersCount: number;
  visasCount: number;
  insuranceIncluded: boolean;
  totalNetCost: number;
  totalSellingPrice: number;
  finalClientPrice: number;
  totalMarginAmount: number;
  agentMarkupPercent: number;
  hubHotels: Array<{
    hubName: string;
    hotelName: string;
    roomType: string;
    nights: number;
  }>;
}

export interface OptionComparisonMatrixModalProps {
  isOpen: boolean;
  onClose: () => void;
  currency: CurrencyCode;
  totalPax: number;
  destinationName: string;
  optionsData: QuotationOptionDetailedData[];
  activeOptionNumber: number;
  onSelectOption: (optionNumber: number) => void;
  onDuplicateOption: (fromOptionNumber: number, toOptionNumber: number) => void;
  onConvertOptionToBooking: (optionNumber: number) => void;
  onDownloadOptionPDF: (optionNumber?: number) => void;
}

export const OptionComparisonMatrixModal: React.FC<OptionComparisonMatrixModalProps> = ({
  isOpen,
  onClose,
  currency,
  totalPax,
  destinationName,
  optionsData,
  activeOptionNumber,
  onSelectOption,
  onDuplicateOption,
  onConvertOptionToBooking,
  onDownloadOptionPDF
}) => {
  if (!isOpen) return null;

  const baseOption = optionsData.find(o => o.optionNumber === 1) || optionsData[0];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-3xl border border-slate-200 w-full max-w-6xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-2xl bg-[#00C6A6]/20 border border-[#00C6A6]/40 text-[#00E5C0] flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                  Multi-Option Itinerary & Pricing Comparison
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-[#00C6A6] text-slate-950">
                  {destinationName}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Side-by-side evaluation of Option 1 (Standard), Option 2 (Upgraded) & Option 3 (Signature)
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => onDownloadOptionPDF(undefined)}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 transition-colors cursor-pointer flex items-center space-x-1.5"
              title="Download consolidated PDF containing all 3 options"
            >
              <FileDown className="w-3.5 h-3.5 text-[#00C6A6]" />
              <span className="hidden sm:inline">Export Full Comparison PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {/* Comparison Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {optionsData.map((opt) => {
              const isActive = activeOptionNumber === opt.optionNumber;
              const perPersonPrice = totalPax > 0 ? opt.finalClientPrice / totalPax : opt.finalClientPrice;
              const basePrice = baseOption ? baseOption.finalClientPrice : opt.finalClientPrice;
              const priceDiff = opt.finalClientPrice - basePrice;
              const perPaxDiff = totalPax > 0 ? priceDiff / totalPax : priceDiff;

              return (
                <div
                  key={opt.optionNumber}
                  className={`rounded-3xl border-2 transition-all flex flex-col justify-between overflow-hidden shadow-xs ${
                    isActive 
                      ? 'border-[#00C6A6] bg-slate-50/70 ring-4 ring-[#00C6A6]/10' 
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  {/* Top Header Card */}
                  <div className={`p-5 border-b ${
                    isActive ? 'bg-[#00C6A6]/10 border-[#00C6A6]/30' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        opt.optionNumber === 1 
                          ? 'bg-blue-100 text-blue-900 border border-blue-200' 
                          : opt.optionNumber === 2 
                          ? 'bg-purple-100 text-purple-900 border border-purple-200' 
                          : 'bg-amber-100 text-amber-900 border border-amber-200'
                      }`}>
                        {opt.badge || `Option ${opt.optionNumber}`}
                      </span>

                      {isActive && (
                        <span className="flex items-center space-x-1 text-xs font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-300">
                          <Check className="w-3.5 h-3.5" />
                          <span>Currently Editing</span>
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-black text-slate-900 mt-2">
                      {opt.title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {opt.hotelTier || (opt.optionNumber === 1 ? 'Standard 4-Star Premium' : opt.optionNumber === 2 ? '5-Star Luxury' : 'Signature / Villa')}
                    </p>

                    {/* Price Banner */}
                    <div className="mt-4 pt-3 border-t border-slate-200/80 flex items-baseline justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Final Selling Price</span>
                        <div className="text-xl font-black text-slate-900 font-mono">
                          {formatCurrency(opt.finalClientPrice, currency)}
                        </div>
                        <span className="text-xs text-slate-500 font-medium">
                          {formatCurrency(perPersonPrice, currency)} <span className="text-[10px]">/ person ({totalPax} Pax)</span>
                        </span>
                      </div>

                      {opt.optionNumber !== 1 && priceDiff !== 0 && (
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">vs Option 1</span>
                          <span className={`text-xs font-black px-2 py-0.5 rounded-md font-mono ${
                            priceDiff > 0 ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'
                          }`}>
                            {priceDiff > 0 ? `+${formatCurrency(priceDiff, currency)}` : `-${formatCurrency(Math.abs(priceDiff), currency)}`}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Body Specs */}
                  <div className="p-5 space-y-4 flex-1">
                    {/* Hotels by Hub */}
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">
                        Accommodation Stays
                      </span>
                      {opt.hubHotels.length === 0 ? (
                        <div className="p-3 rounded-xl bg-slate-100 border border-dashed border-slate-200 text-center text-xs text-slate-500">
                          No hotels assigned yet
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {opt.hubHotels.map((hh, idx) => (
                            <div key={idx} className="p-2.5 rounded-xl bg-white border border-slate-200 text-xs flex items-start space-x-2">
                              <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                              <div className="min-w-0">
                                <span className="font-bold text-slate-900 block truncate">{hh.hotelName}</span>
                                <span className="text-[11px] text-slate-500 block truncate">
                                  {hh.hubName} • {hh.nights}N ({hh.roomType})
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Service Counts Metric Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center space-x-2">
                        <Compass className="w-4 h-4 text-emerald-600 shrink-0" />
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold block uppercase">Activities</span>
                          <span className="font-bold text-slate-900 font-mono">{opt.activitiesCount} Included</span>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center space-x-2">
                        <Car className="w-4 h-4 text-blue-600 shrink-0" />
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold block uppercase">Transfers</span>
                          <span className="font-bold text-slate-900 font-mono">{opt.transfersCount} Included</span>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center space-x-2">
                        <Globe2 className="w-4 h-4 text-teal-600 shrink-0" />
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold block uppercase">Visa Service</span>
                          <span className="font-bold text-slate-900 font-mono">{opt.visasCount > 0 ? `${opt.visasCount} Attached` : 'Optional'}</span>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center space-x-2">
                        <ShieldCheck className="w-4 h-4 text-purple-600 shrink-0" />
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold block uppercase">Protection</span>
                          <span className="font-bold text-slate-900 font-mono">{opt.insuranceIncluded ? 'Included' : 'None'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Commercials Summary */}
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
                      <div className="flex justify-between text-slate-500">
                        <span>Total Services:</span>
                        <span className="font-mono font-bold text-slate-800">{opt.itemsCount} Included</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>Rate Guarantee:</span>
                        <span className="font-medium text-emerald-700 font-sans">All Taxes & Fees Included</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-2">
                    {!isActive ? (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectOption(opt.optionNumber);
                          onClose();
                        }}
                        className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer flex items-center justify-center space-x-1.5 shadow-xs"
                      >
                        <Layers className="w-3.5 h-3.5 text-[#00C6A6]" />
                        <span>Switch & Customize Option {opt.optionNumber}</span>
                      </button>
                    ) : (
                      <div className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold text-center">
                        ✓ Active Editing Mode
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onConvertOptionToBooking(opt.optionNumber);
                          onClose();
                        }}
                        className="py-2 rounded-xl bg-[#00C6A6] hover:bg-[#00E5C0] text-slate-950 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center space-x-1"
                      >
                        <BookmarkCheck className="w-3.5 h-3.5" />
                        <span>Accept & Book</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onDownloadOptionPDF(opt.optionNumber)}
                        className="py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 transition-colors cursor-pointer flex items-center justify-center space-x-1"
                      >
                        <FileDown className="w-3.5 h-3.5" />
                        <span>Option PDF</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
