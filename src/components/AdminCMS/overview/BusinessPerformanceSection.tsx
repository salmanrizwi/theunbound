import React, { useState } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  MapPin, 
  Package, 
  Layers, 
  ArrowRight, 
  Calendar,
  DollarSign,
  Compass,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';
import { 
  BusinessPerformanceData, 
  PerformanceGranularity 
} from '../../../services/dashboardMetricsService';
import { CurrencyCode } from '../../../types';
import { CurrencyEngine } from '../../../services/currencyEngine';

interface BusinessPerformanceSectionProps {
  performance: BusinessPerformanceData;
  onSelectGranularity: (granularity: PerformanceGranularity) => void;
  baseCurrency: CurrencyCode;
  isAuthorizedForFinance: boolean;
  onNavigate: (section: string, subTab?: string) => void;
}

export const BusinessPerformanceSection: React.FC<BusinessPerformanceSectionProps> = ({
  performance,
  onSelectGranularity,
  baseCurrency,
  isAuthorizedForFinance,
  onNavigate
}) => {
  const [activeRankingsTab, setActiveRankingsTab] = useState<'DESTINATIONS' | 'PRODUCTS'>('DESTINATIONS');
  const fx = CurrencyEngine.getInstance();
  const { timeline, funnel, rankings, granularity } = performance;

  // Compute max values for proportional bar scaling
  const maxBookingCount = Math.max(...timeline.map(t => t.bookingsCount), 1);
  const maxLeadsCount = Math.max(...timeline.map(t => t.leadsCount), 1);
  const maxQuotesCount = Math.max(...timeline.map(t => t.quotesCount), 1);

  return (
    <section id="cms-business-performance-section" className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-7 shadow-xs space-y-6">
      {/* Section Header with Granularity Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-[#008972] flex items-center justify-center font-bold">
              <BarChart3 className="w-4 h-4" />
            </div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
              Business Performance & Conversion Funnel
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Authoritative longitudinal trajectory, drop-off dynamics, and destination demand rankings.
          </p>
        </div>

        {/* Granularity Toggle */}
        <div className="flex items-center bg-slate-50 p-1 rounded-2xl border border-slate-200/80 self-start sm:self-auto">
          {(['DAILY', 'WEEKLY', 'MONTHLY'] as PerformanceGranularity[]).map(g => (
            <button
              key={g}
              id={`granularity-toggle-${g.toLowerCase()}`}
              onClick={() => onSelectGranularity(g)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                granularity === g
                  ? 'bg-white text-slate-900 shadow-2xs font-extrabold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {g.charAt(0) + g.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Trajectory Timeline Visualization */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
          <div className="flex items-center space-x-4">
            <span className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#008972]" />
              <span className="text-slate-600">Bookings</span>
            </span>
            <span className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
              <span className="text-slate-600">Leads</span>
            </span>
            <span className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-purple-500" />
              <span className="text-slate-600">Quotes</span>
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
            {timeline.length} interval buckets analyzed
          </span>
        </div>

        {timeline.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            No activity recorded in this date range.
          </div>
        ) : (
          <div className="overflow-x-auto pb-2">
            <div className="min-w-[640px] flex items-end justify-between gap-2 h-44 pt-6 px-2 border-b border-slate-100">
              {timeline.map((bucket, idx) => {
                const bHeight = Math.max(6, Math.round((bucket.bookingsCount / maxBookingCount) * 110));
                const lHeight = Math.max(6, Math.round((bucket.leadsCount / maxLeadsCount) * 110));
                const qHeight = Math.max(6, Math.round((bucket.quotesCount / maxQuotesCount) * 110));

                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 group relative">
                    {/* Tooltip on hover */}
                    <div className="absolute -top-12 z-20 hidden group-hover:flex flex-col items-center bg-slate-900 text-white text-[10px] px-2.5 py-1 rounded-lg shadow-xl pointer-events-none whitespace-nowrap">
                      <div className="font-bold">{bucket.label}</div>
                      <div className="text-slate-300">
                        {bucket.bookingsCount} Bks · {bucket.leadsCount} Lds · {bucket.quotesCount} Qts
                        {isAuthorizedForFinance && bucket.bookingsValue > 0 && ` · ${fx.format(bucket.bookingsValue, baseCurrency)}`}
                      </div>
                    </div>

                    {/* Bars Stack / Group */}
                    <div className="w-full flex items-end justify-center space-x-1">
                      <div 
                        style={{ height: `${bHeight}px` }} 
                        className="w-2.5 bg-[#008972] rounded-t-sm transition-all group-hover:bg-[#00C6A6]"
                      />
                      <div 
                        style={{ height: `${lHeight}px` }} 
                        className="w-2.5 bg-blue-500 rounded-t-sm transition-all group-hover:bg-blue-400"
                      />
                      <div 
                        style={{ height: `${qHeight}px` }} 
                        className="w-2.5 bg-purple-500 rounded-t-sm transition-all group-hover:bg-purple-400"
                      />
                    </div>

                    {/* Label below bar */}
                    <span className="text-[10px] font-bold text-slate-500 truncate w-full text-center group-hover:text-slate-900">
                      {bucket.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Grid: Authoritative Sales Funnel & Destination/Product Demand */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
        {/* Sales Funnel (5 Cols on lg) */}
        <div className="lg:col-span-5 bg-slate-50/80 rounded-2xl border border-slate-200/80 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200/70 pb-3">
            <div>
              <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                Full Lifecycle Funnel
              </h3>
              <p className="text-[11px] text-slate-500">Real transaction progression across stages</p>
            </div>
            <div className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-extrabold border border-emerald-200">
              {funnel.overallConversionRate}% Overall
            </div>
          </div>

          <div className="space-y-3 text-xs">
            {/* Stage 1: Leads */}
            <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs space-y-1">
              <div className="flex items-center justify-between font-bold">
                <span className="text-slate-600">1. Inbound Leads</span>
                <span className="text-slate-900 text-sm font-black">{funnel.leads}</span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full rounded-full w-full" />
              </div>
            </div>

            {/* Drop-off 1 */}
            <div className="flex items-center justify-center text-[10px] font-bold text-slate-400">
              <span>↓ {funnel.leadToQuoteRate}% converted to quotation</span>
            </div>

            {/* Stage 2: Quotes */}
            <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs space-y-1">
              <div className="flex items-center justify-between font-bold">
                <span className="text-slate-600">2. Quotes Generated</span>
                <span className="text-slate-900 text-sm font-black">{funnel.quotes}</span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div 
                  style={{ width: `${Math.min(100, Math.max(10, funnel.leadToQuoteRate))}%` }} 
                  className="bg-purple-500 h-full rounded-full" 
                />
              </div>
            </div>

            {/* Drop-off 2 */}
            <div className="flex items-center justify-center text-[10px] font-bold text-slate-400">
              <span>↓ {funnel.quoteToSharedRate}% shared with customer</span>
            </div>

            {/* Stage 3: Shared Proposals */}
            <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs space-y-1">
              <div className="flex items-center justify-between font-bold">
                <span className="text-slate-600">3. Shared Proposals</span>
                <span className="text-slate-900 text-sm font-black">{funnel.sharedQuotes}</span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div 
                  style={{ width: `${Math.min(100, Math.max(10, funnel.quoteToSharedRate))}%` }} 
                  className="bg-indigo-500 h-full rounded-full" 
                />
              </div>
            </div>

            {/* Drop-off 3 */}
            <div className="flex items-center justify-center text-[10px] font-bold text-slate-400">
              <span>↓ {funnel.sharedToAcceptedRate}% accepted by client</span>
            </div>

            {/* Stage 4: Accepted Quotes & Bookings */}
            <div className="bg-white p-3 rounded-xl border border-emerald-200/80 shadow-2xs space-y-1">
              <div className="flex items-center justify-between font-bold">
                <span className="text-emerald-800">4. Confirmed Bookings</span>
                <span className="text-emerald-700 text-sm font-black">{funnel.bookings}</span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div 
                  style={{ width: `${Math.min(100, Math.max(10, funnel.overallConversionRate))}%` }} 
                  className="bg-[#008972] h-full rounded-full" 
                />
              </div>
            </div>
          </div>
        </div>

        {/* Product & Destination Performance Rankings (7 Cols on lg) */}
        <div className="lg:col-span-7 bg-slate-50/80 rounded-2xl border border-slate-200/80 p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/70 pb-3">
            <div>
              <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                Product & Destination Demand
              </h3>
              <p className="text-[11px] text-slate-500">Most requested & highest booked inventory</p>
            </div>

            {/* Tab switch */}
            <div className="flex items-center space-x-1 bg-white p-1 rounded-xl border border-slate-200/80">
              <button
                onClick={() => setActiveRankingsTab('DESTINATIONS')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeRankingsTab === 'DESTINATIONS'
                    ? 'bg-[#008972] text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Destinations
              </button>
              <button
                onClick={() => setActiveRankingsTab('PRODUCTS')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeRankingsTab === 'PRODUCTS'
                    ? 'bg-[#008972] text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Products
              </button>
            </div>
          </div>

          {activeRankingsTab === 'DESTINATIONS' ? (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold text-slate-700 mb-2 flex items-center space-x-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#008972]" />
                  <span>Top Booked Destinations</span>
                </h4>
                {rankings.topBookedDestinations.length === 0 ? (
                  <div className="py-4 text-center text-xs text-slate-400 bg-white rounded-xl border border-slate-200/70">
                    No destination booking records in selected period.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {rankings.topBookedDestinations.map((d, i) => (
                      <div key={i} className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200/70 text-xs">
                        <div className="flex items-center space-x-2.5">
                          <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-extrabold flex items-center justify-center text-[10px]">
                            {i + 1}
                          </span>
                          <span className="font-bold text-slate-900">{d.destination}</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className="font-extrabold text-[#008972]">{d.count} Bookings</span>
                          {isAuthorizedForFinance && d.value > 0 && (
                            <span className="text-slate-500 font-mono text-[11px]">
                              {fx.format(d.value, baseCurrency)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-700 mb-2 flex items-center space-x-1.5">
                  <Compass className="w-3.5 h-3.5 text-blue-600" />
                  <span>Top Quoted Destinations</span>
                </h4>
                {rankings.topQuotedDestinations.length === 0 ? (
                  <div className="py-4 text-center text-xs text-slate-400 bg-white rounded-xl border border-slate-200/70">
                    No destination quote records in selected period.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {rankings.topQuotedDestinations.map((d, i) => (
                      <div key={i} className="p-2.5 bg-white rounded-xl border border-slate-200/70 text-xs flex items-center justify-between">
                        <span className="font-bold text-slate-800 truncate mr-2">{d.destination}</span>
                        <span className="text-xs font-black text-purple-700 shrink-0">{d.count} Quotes</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold text-slate-700 mb-2 flex items-center space-x-1.5">
                  <Package className="w-3.5 h-3.5 text-[#008972]" />
                  <span>Top Requested Products</span>
                </h4>
                {rankings.topRequestedProducts.length === 0 ? (
                  <div className="py-4 text-center text-xs text-slate-400 bg-white rounded-xl border border-slate-200/70">
                    No product requests in selected period.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {rankings.topRequestedProducts.map((p, i) => (
                      <div key={i} className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200/70 text-xs">
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-extrabold flex items-center justify-center text-[10px] shrink-0">
                            {i + 1}
                          </span>
                          <span className="font-bold text-slate-900 truncate">{p.productName}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-bold shrink-0">
                            {p.category}
                          </span>
                        </div>
                        <span className="font-extrabold text-[#008972] shrink-0 ml-2">{p.count} Quoted</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-700 mb-2 flex items-center space-x-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Top Booked Categories</span>
                </h4>
                {rankings.topBookedCategories.length === 0 ? (
                  <div className="py-4 text-center text-xs text-slate-400 bg-white rounded-xl border border-slate-200/70">
                    No booking categories in selected period.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {rankings.topBookedCategories.map((c, i) => (
                      <div key={i} className="p-2.5 bg-white rounded-xl border border-slate-200/70 text-xs flex items-center justify-between">
                        <span className="font-bold text-slate-800">{c.category}</span>
                        <span className="font-black text-[#008972]">{c.count} items</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
