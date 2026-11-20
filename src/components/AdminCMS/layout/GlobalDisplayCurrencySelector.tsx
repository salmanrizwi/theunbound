import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Coins, Lock, RefreshCw, Search } from 'lucide-react';
import { CurrencyCode, SUPPORTED_CURRENCIES, User } from '../../../types';
import { useDisplayCurrency } from '../../../context/DisplayCurrencyContext';
import { canUserEditDisplayCurrency } from '../../../services/displayCurrencyService';
import { toast } from '../../../services/toastService';

interface GlobalDisplayCurrencySelectorProps {
  currentUser?: User | null;
  compact?: boolean;
}

export const GlobalDisplayCurrencySelector: React.FC<GlobalDisplayCurrencySelectorProps> = ({
  currentUser,
  compact = false
}) => {
  const {
    displayCurrency,
    canEditDisplayCurrency,
    isUpdating,
    setGlobalDisplayCurrency
  } = useDisplayCurrency();

  const effectiveCanEdit = currentUser ? canUserEditDisplayCurrency(currentUser) : canEditDisplayCurrency;

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const activeCurrencyObj = useMemo(
    () => SUPPORTED_CURRENCIES.find(c => c.code === displayCurrency) || SUPPORTED_CURRENCIES[0],
    [displayCurrency]
  );

  const filteredCurrencies = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return SUPPORTED_CURRENCIES;
    return SUPPORTED_CURRENCIES.filter(
      c =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.symbol.toLowerCase().includes(q)
    );
  }, [searchTerm]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setTimeout(() => searchInputRef.current?.focus(), 40);
    }
  }, [isOpen]);

  const handleSelectCurrency = async (nextCode: CurrencyCode) => {
    setIsOpen(false);
    if (nextCode === displayCurrency) return;

    if (!effectiveCanEdit) {
      toast.error('Only authorised Administrators can change the Global Display Currency.');
      return;
    }

    const res = await setGlobalDisplayCurrency(nextCode, currentUser);
    if (res.success) {
      toast.success(`Display currency updated to ${nextCode}`);
    } else {
      toast.error(res.error || 'Failed to update display currency');
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        id="global-display-currency-btn"
        type="button"
        disabled={isUpdating}
        onClick={() => {
          if (!effectiveCanEdit) {
            toast.info(`Global Display Currency is set to ${displayCurrency} (Admin-controlled).`);
            return;
          }
          setIsOpen(prev => !prev);
        }}
        title={
          effectiveCanEdit
            ? `Global Display Currency: ${activeCurrencyObj.code} (${activeCurrencyObj.name}). Click to switch portal-wide display currency.`
            : `Display Currency: ${activeCurrencyObj.code} (Only Administrators can change portal display currency)`
        }
        className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all select-none ${
          effectiveCanEdit
            ? 'bg-slate-50 hover:bg-slate-100 border-slate-200/90 text-slate-800 cursor-pointer shadow-2xs'
            : 'bg-slate-50 border-slate-200/70 text-slate-600 cursor-default'
        }`}
      >
        {isUpdating ? (
          <RefreshCw className="w-3.5 h-3.5 text-[#008972] animate-spin shrink-0" />
        ) : (
          <Coins className="w-3.5 h-3.5 text-[#008972] shrink-0" />
        )}
        {!compact && (
          <span className="hidden xl:inline text-[11px] font-semibold text-slate-400">
            Display:
          </span>
        )}
        <span className="font-mono font-extrabold text-slate-900">
          {activeCurrencyObj.symbol} {activeCurrencyObj.code}
        </span>
        {effectiveCanEdit ? (
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        ) : (
          <Lock className="w-3 h-3 text-slate-400" />
        )}
      </button>

      {isOpen && effectiveCanEdit && (
        <div
          id="global-display-currency-menu"
          className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 z-50 animate-in fade-in duration-150"
        >
          <div className="px-2.5 py-1.5 border-b border-slate-100 mb-1.5">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Global Display Currency
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
              Converts monetary views &amp; KPIs portal-wide without modifying source records.
            </p>
          </div>

          <div className="relative mb-1.5 px-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter currency (USD, INR, JPY...)"
              className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#00C6A6]"
            />
          </div>

          <div className="max-h-60 overflow-y-auto space-y-0.5 pr-0.5">
            {filteredCurrencies.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400">No matching currencies</div>
            ) : (
              filteredCurrencies.map((curr) => {
                const isSelected = curr.code === displayCurrency;
                return (
                  <button
                    key={curr.code}
                    type="button"
                    data-currency-option={curr.code}
                    onClick={() => handleSelectCurrency(curr.code)}
                    className={`w-full text-left px-2.5 py-2 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#00C6A6]/15 text-[#008972] font-extrabold'
                        : 'text-slate-700 hover:bg-slate-50 font-semibold'
                    }`}
                  >
                    <div className="flex items-center space-x-2 min-w-0">
                      <span className="w-7 text-center font-mono font-bold text-slate-900 bg-slate-100 rounded-md py-0.5 text-[11px] shrink-0">
                        {curr.symbol}
                      </span>
                      <div className="truncate">
                        <span className="font-mono font-bold">{curr.code}</span>
                        <span className="text-[11px] text-slate-500 ml-1.5">{curr.name}</span>
                      </div>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-[#008972] shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
