import React from 'react';
import { 
  Calendar, 
  RefreshCw, 
  DollarSign, 
  Clock, 
  ShieldCheck, 
  Layers,
  ChevronDown
} from 'lucide-react';
import { CurrencyCode, User } from '../../../types';
import { DateRangeOption } from '../../../services/dashboardMetricsService';

interface OverviewHeaderProps {
  currentUser: User | null;
  selectedDateRange: DateRangeOption;
  onSelectDateRange: (opt: DateRangeOption) => void;
  customStartDate: string;
  customEndDate: string;
  onChangeCustomStart: (val: string) => void;
  onChangeCustomEnd: (val: string) => void;
  selectedCurrency: CurrencyCode;
  onSelectCurrency: (curr: CurrencyCode) => void;
  lastUpdated: Date;
  onRefresh: () => void;
  isRefreshing: boolean;
  comparisonLabel: string;
}

const SUPPORTED_CURRENCIES: CurrencyCode[] = ['USD', 'EUR', 'GBP', 'INR', 'AED', 'SGD', 'AUD', 'JPY', 'CAD', 'CHF', 'THB'];

export const OverviewHeader: React.FC<OverviewHeaderProps> = ({
  currentUser,
  selectedDateRange,
  onSelectDateRange,
  customStartDate,
  customEndDate,
  onChangeCustomStart,
  onChangeCustomEnd,
  selectedCurrency,
  onSelectCurrency,
  lastUpdated,
  onRefresh,
  isRefreshing,
  comparisonLabel
}) => {
  const dateOptions: { id: DateRangeOption; label: string }[] = [
    { id: 'TODAY', label: 'Today' },
    { id: 'YESTERDAY', label: 'Yesterday' },
    { id: 'THIS_WEEK', label: 'This Week' },
    { id: 'LAST_WEEK', label: 'Last Week' },
    { id: 'THIS_MONTH', label: 'This Month' },
    { id: 'LAST_MONTH', label: 'Last Month' },
    { id: 'CUSTOM', label: 'Custom Range' }
  ];

  return (
    <header id="cms-overview-header" className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-7 shadow-xs space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center space-x-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00C6A6] animate-pulse" />
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
              Operations & Business Command Centre
            </h1>
            <span className="text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#00C6A6]/10 text-[#008972] border border-[#00C6A6]/30">
              Live Production
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-3xl">
            Centralized operational intelligence: Real-time bookings, pipeline leads, quotes, ground dispatch, supplier fulfillment & system integrity.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* User role identity */}
          <div className="flex items-center space-x-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
            <ShieldCheck className="w-4 h-4 text-[#008972]" />
            <div className="text-left">
              <div className="font-bold text-slate-800 text-[11px] leading-tight">
                {currentUser?.name || 'Administrator'}
              </div>
              <div className="text-[10px] text-slate-400 font-medium">
                {currentUser?.role || 'ADMIN'} · Full Access
              </div>
            </div>
          </div>

          {/* Refresh Button */}
          <button
            id="cms-refresh-metrics-btn"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center space-x-2 px-3.5 py-2 bg-slate-900 hover:bg-[#008972] text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Syncing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Global Filter Bar: Date Range + Currency + Period Notice */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pt-1">
        {/* Date Range Selector Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-slate-400 mr-1 flex items-center space-x-1">
            <Calendar className="w-3.5 h-3.5" />
            <span>Period:</span>
          </span>
          {dateOptions.map(opt => {
            const isSelected = selectedDateRange === opt.id;
            return (
              <button
                key={opt.id}
                id={`date-pill-${opt.id.toLowerCase()}`}
                onClick={() => onSelectDateRange(opt.id)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#008972] text-white shadow-2xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200/80'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Currency Selector & Timestamp */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Comparison period tag */}
          <div className="text-[11px] text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/80 flex items-center space-x-1">
            <span className="text-slate-400 font-medium">Vs:</span>
            <span className="font-semibold text-slate-700">{comparisonLabel}</span>
          </div>

          {/* Currency Switcher */}
          <div className="flex items-center space-x-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200/80">
            <DollarSign className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-bold text-slate-500">Display Currency:</span>
            <select
              id="cms-currency-select"
              value={selectedCurrency}
              onChange={(e) => onSelectCurrency(e.target.value as CurrencyCode)}
              className="bg-transparent text-xs font-extrabold text-slate-800 border-none outline-hidden cursor-pointer"
            >
              {SUPPORTED_CURRENCIES.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Last Updated */}
          <div className="text-[11px] text-slate-400 flex items-center space-x-1">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>
              Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        </div>
      </div>

      {/* Custom Date Pickers (when CUSTOM is chosen) */}
      {selectedDateRange === 'CUSTOM' && (
        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-wrap items-center gap-4 animate-in fade-in duration-150">
          <div className="flex items-center space-x-2">
            <label className="text-xs font-bold text-slate-600">From:</label>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => onChangeCustomStart(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
            />
          </div>
          <div className="flex items-center space-x-2">
            <label className="text-xs font-bold text-slate-600">To:</label>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => onChangeCustomEnd(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
            />
          </div>
          <span className="text-[11px] text-slate-400">
            Metrics will aggregate data within this explicit date interval.
          </span>
        </div>
      )}
    </header>
  );
};
