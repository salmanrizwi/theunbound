import React from 'react';
import { CurrencyCode } from '../../../types';
import { formatCurrency } from '../../../services/pricingEngine';
import { Users, DollarSign } from 'lucide-react';

interface PerPersonPricingModuleProps {
  currency: CurrencyCode;
  adultNetPrice: number;
  childNetPrice: number;
  infantNetPrice: number;
  buyerMarkupPercent: number;
  b2bAgentMarkupPercent: number;
  taxPercent: number;
  serviceFeeFixed: number;
  onPriceChange: (adultNet: number, childNet: number, infantNet: number) => void;
  onCurrencyChange: (currency: CurrencyCode) => void;
}

export const PerPersonPricingModule: React.FC<PerPersonPricingModuleProps> = ({
  currency,
  adultNetPrice,
  childNetPrice,
  infantNetPrice,
  buyerMarkupPercent,
  b2bAgentMarkupPercent,
  taxPercent,
  serviceFeeFixed,
  onPriceChange,
  onCurrencyChange
}) => {
  const calculateDelivered = (net: number, markup: number) => {
    const markupAmt = net * (markup / 100);
    const taxAmt = markupAmt * (taxPercent / 100);
    return Math.round(net + markupAmt + taxAmt + serviceFeeFixed);
  };

  return (
    <div className="space-y-4">
      <div className="bg-slate-800/80 p-4 rounded-xl border border-blue-500/30 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-blue-300 flex items-center gap-1.5">
            <Users className="w-4 h-4" />
            <span>Per-Person Confidential Rate Structure</span>
          </span>
          <span className="text-[10px] text-slate-400">
            Net contracted supplier rates before markup & taxes
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
            <label className="text-[11px] text-slate-300 font-medium">Adult Nett Cost *</label>
            <input
              type="number"
              required
              min="0"
              value={adultNetPrice !== undefined && !Number.isNaN(adultNetPrice) ? adultNetPrice : ''}
              onChange={e => onPriceChange(Number(e.target.value), childNetPrice, infantNetPrice)}
              className="w-full p-2 bg-white rounded-lg font-bold"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-slate-300 font-medium">Child Nett Cost</label>
            <input
              type="number"
              min="0"
              value={childNetPrice !== undefined && !Number.isNaN(childNetPrice) ? childNetPrice : ''}
              onChange={e => onPriceChange(adultNetPrice, Number(e.target.value), infantNetPrice)}
              className="w-full p-2 bg-white rounded-lg"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-slate-300 font-medium">Infant Nett Cost</label>
            <input
              type="number"
              min="0"
              value={infantNetPrice !== undefined && !Number.isNaN(infantNetPrice) ? infantNetPrice : ''}
              onChange={e => onPriceChange(adultNetPrice, childNetPrice, Number(e.target.value))}
              className="w-full p-2 bg-white rounded-lg"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
