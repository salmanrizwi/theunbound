import React, { useState, useEffect } from 'react';
import { CurrencyCode } from '../types';
import { ExchangeRateService, ExchangeRateData } from '../services/exchangeRateService';
import { formatCurrency } from '../services/pricingEngine';
import { useQuotation } from '../context/QuotationContext';
import { 
  ArrowRightLeft, 
  RefreshCw, 
  TrendingUp, 
  Globe, 
  Check,
  ChevronDown
} from 'lucide-react';

interface CurrencyConverterWidgetProps {
  currentCurrency?: CurrencyCode;
  onCurrencyChange?: (newCurrency: CurrencyCode) => void;
  baseCurrency?: CurrencyCode;
  baseAmount?: number;
  compact?: boolean;
}

const POPULAR_CURRENCIES: { code: CurrencyCode; name: string; symbol: string }[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'AED' },
  { code: 'THB', name: 'Thai Baht', symbol: '฿' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' }
];

export const CurrencyConverterWidget: React.FC<CurrencyConverterWidgetProps> = ({
  currentCurrency: propCurrentCurrency,
  onCurrencyChange: propOnCurrencyChange,
  baseCurrency = 'USD',
  baseAmount,
  compact = false
}) => {
  const quoteContext = useQuotation();
  
  const currentCurrency: CurrencyCode = propCurrentCurrency || quoteContext.currency;
  const onCurrencyChange = propOnCurrencyChange || quoteContext.setCurrency;

  const [fxData, setFxData] = useState<ExchangeRateData>(() => ExchangeRateService.getInstance().getData());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [testAmount, setTestAmount] = useState<number>(baseAmount || 1000);

  useEffect(() => {
    const unsub = ExchangeRateService.getInstance().subscribe((data) => {
      setFxData(data);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (baseAmount !== undefined) {
      setTestAmount(baseAmount);
    }
  }, [baseAmount]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await ExchangeRateService.getInstance().fetchLiveRates();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const exchangeService = ExchangeRateService.getInstance();
  const convertedAmount = exchangeService.convert(testAmount, baseCurrency, currentCurrency);
  const oneUnitConverted = exchangeService.convert(1, baseCurrency, currentCurrency);

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 bg-slate-900/90 text-white px-2.5 py-1 rounded-xl border border-slate-700 text-xs shadow-xs">
        <Globe className="w-3.5 h-3.5 text-[#00C6A6]" />
        <span className="text-[10px] text-slate-400 font-mono">Currency:</span>
        <select
          value={currentCurrency}
          onChange={(e) => onCurrencyChange(e.target.value as CurrencyCode)}
          className="bg-slate-800 text-white font-bold text-xs rounded-lg px-2 py-0.5 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-[#00C6A6] cursor-pointer"
        >
          {POPULAR_CURRENCIES.map(c => (
            <option key={c.code} value={c.code}>
              {c.code} ({c.symbol}) - {c.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleRefresh}
          className="p-1 text-slate-400 hover:text-[#00E5C0] transition-colors cursor-pointer"
          title="Refresh Live FX Rates"
        >
          <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-[#00E5C0]' : ''}`} />
        </button>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 text-white rounded-2xl p-4 border border-slate-800 shadow-lg space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg bg-[#00C6A6]/20 text-[#00E5C0] flex items-center justify-center">
            <ArrowRightLeft className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-white">
              Live Currency Converter
            </h4>
            <span className="text-[10px] text-emerald-400 flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Live Interbank Rates</span>
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] font-bold text-slate-300 flex items-center space-x-1 transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-[#00E5C0]' : ''}`} />
          <span>Sync FX</span>
        </button>
      </div>

      {/* Currency Selection Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 pt-1">
        {POPULAR_CURRENCIES.map(c => {
          const isSelected = currentCurrency === c.code;
          return (
            <button
              key={c.code}
              type="button"
              onClick={() => onCurrencyChange(c.code)}
              className={`px-2 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between border cursor-pointer ${
                isSelected
                  ? 'bg-[#00C6A6] text-slate-950 border-[#00C6A6] shadow-sm font-extrabold'
                  : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700/80'
              }`}
            >
              <span>{c.code}</span>
              <span className="text-[10px] opacity-70">({c.symbol})</span>
            </button>
          );
        })}
      </div>

      {/* Conversion Rate Snapshot */}
      <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 flex items-center justify-between text-xs">
        <div>
          <span className="text-[10px] text-slate-400 block font-mono">Current Pair Rate:</span>
          <span className="font-bold text-white font-mono">
            1 {baseCurrency} = {formatCurrency(oneUnitConverted, currentCurrency)}
          </span>
        </div>

        {baseAmount !== undefined && (
          <div className="text-right">
            <span className="text-[10px] text-slate-400 block font-mono">
              Original ({baseCurrency}): {formatCurrency(baseAmount, baseCurrency)}
            </span>
            <span className="font-extrabold text-sm text-[#00E5C0] font-mono">
              ≈ {formatCurrency(convertedAmount, currentCurrency)}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/80">
        <span>Feed: Open ER & Live Interbank Market</span>
        <span className="font-mono">Synced: {new Date(fxData.lastUpdated).toLocaleTimeString()}</span>
      </div>
    </div>
  );
};
