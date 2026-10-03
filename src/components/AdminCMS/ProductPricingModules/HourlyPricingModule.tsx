import React from 'react';
import { CurrencyCode, GuideConfig } from '../../../types';
import { formatCurrency } from '../../../services/pricingEngine';
import { Languages, Clock, Award, Users } from 'lucide-react';

interface HourlyPricingModuleProps {
  currency: CurrencyCode;
  guideConfig?: GuideConfig;
  buyerMarkupPercent: number;
  b2bAgentMarkupPercent: number;
  taxPercent: number;
  serviceFeeFixed: number;
  onChange: (updatedConfig: GuideConfig) => void;
  onCurrencyChange: (currency: CurrencyCode) => void;
}

const ALL_LANGUAGES = [
  'English',
  'Japanese',
  'Spanish',
  'French',
  'German',
  'Mandarin Chinese',
  'Italian',
  'Russian',
  'Arabic',
  'Hindi',
  'Portuguese'
];

export const HourlyPricingModule: React.FC<HourlyPricingModuleProps> = ({
  currency,
  guideConfig,
  buyerMarkupPercent,
  b2bAgentMarkupPercent,
  taxPercent,
  serviceFeeFixed,
  onChange,
  onCurrencyChange
}) => {
  const currentConfig: GuideConfig = {
    languages: guideConfig?.languages || ['English', 'Japanese'],
    primaryLanguage: guideConfig?.primaryLanguage || 'English',
    guideType: guideConfig?.guideType || 'LICENSED_NATIONAL_GUIDE',
    rateType: 'HOURLY',
    hourlyNetRate: guideConfig?.hourlyNetRate ?? 60,
    minHours: guideConfig?.minHours ?? 4,
    overtimeHourlyRate: guideConfig?.overtimeHourlyRate ?? 80,
    maxGroupSize: guideConfig?.maxGroupSize ?? 10
  };

  const updateConfig = (patch: Partial<GuideConfig>) => {
    onChange({ ...currentConfig, ...patch });
  };

  const calculateDelivered = (hourlyNet: number, markup: number) => {
    const markupAmt = hourlyNet * (markup / 100);
    const taxAmt = markupAmt * (taxPercent / 100);
    return Math.round(hourlyNet + markupAmt + taxAmt + serviceFeeFixed);
  };

  const hourlyBuyerSelling = calculateDelivered(currentConfig.hourlyNetRate || 60, buyerMarkupPercent);
  const hourlyAgentSelling = calculateDelivered(currentConfig.hourlyNetRate || 60, b2bAgentMarkupPercent);
  const minBookingBuyerTotal = hourlyBuyerSelling * (currentConfig.minHours || 4);

  return (
    <div className="space-y-4">
      {/* Hourly Pricing & Commercial Parameters */}
      <div className="bg-slate-800/80 p-4 rounded-xl border border-amber-500/30 space-y-4">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-amber-300 flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            <span>Guide Hourly-Based Pricing Module (Mandatory)</span>
          </span>
          <span className="text-[10px] text-amber-200/70 font-mono">
            Rate = Hourly Base Net × Duration (Min: {currentConfig.minHours}h)
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-800">
          <div className="space-y-1">
            <label className="text-[11px] text-slate-300 font-medium">Base Currency</label>
            <select
              value={currency}
              onChange={e => onCurrencyChange(e.target.value as CurrencyCode)}
              className="w-full p-2 bg-white rounded-lg font-bold"
            >
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="JPY">JPY (¥)</option>
              <option value="INR">INR (₹)</option>
              <option value="AED">AED (AED)</option>
              <option value="THB">THB (฿)</option>
              <option value="AUD">AUD (A$)</option>
              <option value="CAD">CAD (CA$)</option>
              <option value="SGD">SGD (S$)</option>
              <option value="CHF">CHF (CHF)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-emerald-400 font-bold">Hourly Base Nett Cost *</label>
            <input
              type="number"
              min="0"
              required
              value={currentConfig.hourlyNetRate !== undefined && !Number.isNaN(currentConfig.hourlyNetRate) ? currentConfig.hourlyNetRate : ''}
              onChange={e => updateConfig({ hourlyNetRate: Number(e.target.value) })}
              placeholder="e.g. 60"
              className="w-full p-2 bg-white rounded-lg font-bold text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-slate-300 font-medium">Min Duration (Hours) *</label>
            <input
              type="number"
              min="1"
              max="24"
              value={currentConfig.minHours !== undefined && !Number.isNaN(currentConfig.minHours) ? currentConfig.minHours : ''}
              onChange={e => updateConfig({ minHours: Number(e.target.value) })}
              className="w-full p-2 bg-white rounded-lg font-bold"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-slate-300 font-medium">Overtime Hourly Nett</label>
            <input
              type="number"
              min="0"
              value={currentConfig.overtimeHourlyRate !== undefined && !Number.isNaN(currentConfig.overtimeHourlyRate) ? currentConfig.overtimeHourlyRate : ''}
              onChange={e => updateConfig({ overtimeHourlyRate: Number(e.target.value) })}
              placeholder="e.g. 80"
              className="w-full p-2 bg-white rounded-lg"
            />
          </div>
        </div>

        {/* Live Hourly Rate Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-slate-950/70 p-3 rounded-xl border border-slate-700/60 text-xs">
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Buyer Delivered / Hour:</span>
            <span className="font-mono font-bold text-emerald-400 text-sm">
              {formatCurrency(hourlyBuyerSelling, currency)} / hr
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">B2B Agent Delivered / Hour:</span>
            <span className="font-mono font-bold text-[#00E5C0] text-sm">
              {formatCurrency(hourlyAgentSelling, currency)} / hr
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Min Booking Delivered Total:</span>
            <span className="font-mono font-bold text-amber-300 text-sm">
              {formatCurrency(minBookingBuyerTotal, currency)} ({currentConfig.minHours} hrs)
            </span>
          </div>
        </div>
      </div>

      {/* Guide Credentials & Language Selection */}
      <div className="bg-slate-800/80 p-4 rounded-xl border border-amber-500/30 space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-amber-300">
          <span className="flex items-center gap-1.5">
            <Languages className="w-4 h-4" />
            <span>Guide Accreditation & Language Fluency</span>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-800">
          <div className="space-y-1">
            <label className="text-[11px] text-slate-300 font-medium">Accreditation / Qualification</label>
            <select
              value={currentConfig.guideType}
              onChange={e => updateConfig({ guideType: e.target.value as any })}
              className="w-full p-2 bg-white rounded-lg font-medium text-xs"
            >
              <option value="LICENSED_NATIONAL_GUIDE">National Government Licensed Docent</option>
              <option value="LOCAL_EXPERT">Local Resident / Culture Specialist</option>
              <option value="CHAUFFEUR_GUIDE">Bilingual Chauffeur-Guide</option>
              <option value="SPECIALIST_ACADEMIC">Academic / Art Historian Expert</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-slate-300 font-medium">Max Group Size Per Guide</label>
            <input
              type="number"
              min="1"
              max="50"
              value={currentConfig.maxGroupSize !== undefined && !Number.isNaN(currentConfig.maxGroupSize) ? currentConfig.maxGroupSize : ''}
              onChange={e => updateConfig({ maxGroupSize: Number(e.target.value) })}
              className="w-full p-2 bg-white rounded-lg font-bold text-xs"
            />
          </div>
        </div>

        {/* Multi-Language Badges */}
        <div className="space-y-1.5 pt-1">
          <label className="text-[11px] text-slate-300 font-medium flex items-center justify-between">
            <span>Select Supported Languages</span>
            <span className="text-[10px] text-slate-400">Primary: {currentConfig.primaryLanguage}</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {ALL_LANGUAGES.map(lang => {
              const active = currentConfig.languages || [];
              const isSelected = active.includes(lang);
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => {
                    const next = isSelected ? active.filter(l => l !== lang) : [...active, lang];
                    updateConfig({
                      languages: next,
                      primaryLanguage: next.includes(currentConfig.primaryLanguage || '') ? currentConfig.primaryLanguage : (next[0] || 'English')
                    });
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-amber-400 text-slate-950 shadow-xs'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {isSelected ? '✓ ' : '+ '}{lang}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
