import React from 'react';
import { 
  CalendarCheck, 
  Users, 
  FileText, 
  TrendingUp, 
  CreditCard, 
  Briefcase, 
  DollarSign, 
  Building2, 
  ArrowUpRight, 
  ArrowDownRight, 
  Lock,
  ChevronRight
} from 'lucide-react';
import { KeyBusinessMetrics } from '../../../services/dashboardMetricsService';
import { CurrencyEngine } from '../../../services/currencyEngine';

interface KeyBusinessMetricsGridProps {
  metrics: KeyBusinessMetrics;
  onNavigate: (section: string, subTab?: string, recordId?: string) => void;
}

export const KeyBusinessMetricsGrid: React.FC<KeyBusinessMetricsGridProps> = ({
  metrics,
  onNavigate
}) => {
  const fx = CurrencyEngine.getInstance();

  return (
    <section id="cms-key-business-metrics" className="space-y-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">
            Key Business Metrics
          </h2>
          <p className="text-xs text-slate-500">
            Authoritative transactional volumes, pipeline conversions and partner roster in selected period.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* CARD 1: Total Bookings */}
        <div 
          id="metric-card-total-bookings"
          onClick={() => onNavigate('BOOKING_MANAGEMENT', 'BOOKINGS')}
          className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs hover:border-[#008972]/50 transition-all flex flex-col justify-between group cursor-pointer"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 group-hover:text-slate-600 transition-colors">
                Total Bookings
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CalendarCheck className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-3 flex items-baseline space-x-2.5">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {metrics.totalBookings.current}
              </span>
              <span className={`inline-flex items-center text-xs font-extrabold px-2 py-0.5 rounded-full ${
                metrics.totalBookings.percentChange >= 0 
                  ? 'bg-emerald-50 text-emerald-700' 
                  : 'bg-rose-50 text-rose-700'
              }`}>
                {metrics.totalBookings.percentChange >= 0 ? (
                  <ArrowUpRight className="w-3 h-3 mr-0.5" />
                ) : (
                  <ArrowDownRight className="w-3 h-3 mr-0.5" />
                )}
                {Math.abs(metrics.totalBookings.percentChange)}%
              </span>
            </div>

            <div className="text-[11px] text-slate-400 mt-1">
              vs {metrics.totalBookings.previous} in previous period
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <div className="flex items-center space-x-2">
              <span className="text-emerald-700 font-bold">{metrics.totalBookings.confirmed} Conf</span>
              <span className="text-slate-300">·</span>
              <span className="text-amber-700 font-bold">{metrics.totalBookings.pending} Pend</span>
              <span className="text-slate-300">·</span>
              <span className="text-slate-500 font-medium">{metrics.totalBookings.cancelled} Canc</span>
            </div>
            <span className="text-[#008972] font-bold group-hover:translate-x-0.5 transition-transform flex items-center">
              View <ChevronRight className="w-3 h-3 ml-0.5" />
            </span>
          </div>
        </div>

        {/* CARD 2: Total Leads */}
        <div 
          id="metric-card-total-leads"
          onClick={() => onNavigate('LEAD_MANAGEMENT', 'LEADS')}
          className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs hover:border-[#008972]/50 transition-all flex flex-col justify-between group cursor-pointer"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 group-hover:text-slate-600 transition-colors">
                Total Leads
              </span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-3 flex items-baseline space-x-2.5">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {metrics.totalLeads.current}
              </span>
              <span className={`inline-flex items-center text-xs font-extrabold px-2 py-0.5 rounded-full ${
                metrics.totalLeads.percentChange >= 0 
                  ? 'bg-emerald-50 text-emerald-700' 
                  : 'bg-rose-50 text-rose-700'
              }`}>
                {metrics.totalLeads.percentChange >= 0 ? (
                  <ArrowUpRight className="w-3 h-3 mr-0.5" />
                ) : (
                  <ArrowDownRight className="w-3 h-3 mr-0.5" />
                )}
                {Math.abs(metrics.totalLeads.percentChange)}%
              </span>
            </div>

            <div className="text-[11px] text-slate-400 mt-1">
              vs {metrics.totalLeads.previous} in previous period
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <div className="flex items-center space-x-1.5 truncate">
              <span className="text-blue-700 font-bold">{metrics.totalLeads.newCount} New</span>
              <span className="text-slate-300">·</span>
              <span className="text-indigo-700 font-bold">{metrics.totalLeads.openCount} Open</span>
              <span className="text-slate-300">·</span>
              <span className="text-emerald-700 font-bold">{metrics.totalLeads.convertedCount} Conv</span>
            </div>
            <span className="text-[#008972] font-bold group-hover:translate-x-0.5 transition-transform flex items-center">
              View <ChevronRight className="w-3 h-3 ml-0.5" />
            </span>
          </div>
        </div>

        {/* CARD 3: Total Quotes */}
        <div 
          id="metric-card-total-quotes"
          onClick={() => onNavigate('LEAD_MANAGEMENT', 'QUOTES')}
          className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs hover:border-[#008972]/50 transition-all flex flex-col justify-between group cursor-pointer"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 group-hover:text-slate-600 transition-colors">
                Total Quotes
              </span>
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-3 flex items-baseline space-x-2.5">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {metrics.totalQuotes.current}
              </span>
              <span className={`inline-flex items-center text-xs font-extrabold px-2 py-0.5 rounded-full ${
                metrics.totalQuotes.percentChange >= 0 
                  ? 'bg-emerald-50 text-emerald-700' 
                  : 'bg-rose-50 text-rose-700'
              }`}>
                {metrics.totalQuotes.percentChange >= 0 ? (
                  <ArrowUpRight className="w-3 h-3 mr-0.5" />
                ) : (
                  <ArrowDownRight className="w-3 h-3 mr-0.5" />
                )}
                {Math.abs(metrics.totalQuotes.percentChange)}%
              </span>
            </div>

            <div className="text-[11px] text-slate-400 mt-1">
              vs {metrics.totalQuotes.previous} in previous period
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <div className="flex items-center space-x-1.5 truncate">
              <span className="text-slate-600 font-bold">{metrics.totalQuotes.draftCount} Draft</span>
              <span className="text-slate-300">·</span>
              <span className="text-purple-700 font-bold">{metrics.totalQuotes.sentCount} Shared</span>
              <span className="text-slate-300">·</span>
              <span className="text-emerald-700 font-bold">{metrics.totalQuotes.acceptedCount} Acc</span>
            </div>
            <span className="text-[#008972] font-bold group-hover:translate-x-0.5 transition-transform flex items-center">
              View <ChevronRight className="w-3 h-3 ml-0.5" />
            </span>
          </div>
        </div>

        {/* CARD 4: Quote-to-Booking Conversion */}
        <div 
          id="metric-card-conversion-rate"
          onClick={() => onNavigate('LEAD_MANAGEMENT', 'QUOTES')}
          className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs hover:border-[#008972]/50 transition-all flex flex-col justify-between group cursor-pointer"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 group-hover:text-slate-600 transition-colors">
                Quote Conversion Rate
              </span>
              <div className="w-8 h-8 rounded-xl bg-teal-50 text-[#008972] flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-3 flex items-baseline space-x-2.5">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {metrics.quoteToBookingConversion.ratePercent}%
              </span>
              <span className={`inline-flex items-center text-xs font-extrabold px-2 py-0.5 rounded-full ${
                metrics.quoteToBookingConversion.rateChange >= 0 
                  ? 'bg-emerald-50 text-emerald-700' 
                  : 'bg-rose-50 text-rose-700'
              }`}>
                {metrics.quoteToBookingConversion.rateChange >= 0 ? '+' : ''}
                {metrics.quoteToBookingConversion.rateChange}%
              </span>
            </div>

            <div className="text-[11px] text-slate-400 mt-1">
              {metrics.quoteToBookingConversion.convertedQuotes} of {metrics.quoteToBookingConversion.totalQuotes} converted
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-medium">Pipeline Efficiency</span>
            <span className="text-[#008972] font-bold group-hover:translate-x-0.5 transition-transform flex items-center">
              Inspect <ChevronRight className="w-3 h-3 ml-0.5" />
            </span>
          </div>
        </div>

        {/* CARD 5: Total Booking Value (Customer Selling Value Only) */}
        <div 
          id="metric-card-booking-value"
          onClick={() => onNavigate('BOOKING_MANAGEMENT', 'BOOKINGS')}
          className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs hover:border-[#008972]/50 transition-all flex flex-col justify-between group cursor-pointer"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 group-hover:text-slate-600 transition-colors">
                Total Booking Value
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>

            {metrics.bookingValue.isAuthorized ? (
              <>
                <div className="mt-3 flex items-baseline space-x-2.5">
                  <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                    {fx.format(metrics.bookingValue.currentTotal, metrics.bookingValue.currency)}
                  </span>
                  <span className={`inline-flex items-center text-xs font-extrabold px-2 py-0.5 rounded-full ${
                    metrics.bookingValue.percentChange >= 0 
                      ? 'bg-emerald-50 text-emerald-700' 
                      : 'bg-rose-50 text-rose-700'
                  }`}>
                    {metrics.bookingValue.percentChange >= 0 ? '+' : ''}
                    {metrics.bookingValue.percentChange}%
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Customer Selling Value · No internal costs shown
                </div>
              </>
            ) : (
              <div className="mt-3 py-2 flex items-center space-x-2 text-slate-400">
                <Lock className="w-4 h-4 text-slate-300" />
                <span className="text-xs font-bold text-slate-500">Restricted to Admin/Finance</span>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            {metrics.bookingValue.isAuthorized ? (
              <div className="flex items-center space-x-2 text-slate-500">
                <span>Conf: {fx.format(metrics.bookingValue.confirmedValue, metrics.bookingValue.currency)}</span>
              </div>
            ) : (
              <span className="text-slate-400">Role-gated clearance</span>
            )}
            <span className="text-[#008972] font-bold group-hover:translate-x-0.5 transition-transform flex items-center">
              Ledger <ChevronRight className="w-3 h-3 ml-0.5" />
            </span>
          </div>
        </div>

        {/* CARD 6: Active B2B Agents */}
        <div 
          id="metric-card-active-agents"
          onClick={() => onNavigate('ACCOUNT_MANAGEMENT', 'USERS_ACCESS')}
          className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs hover:border-[#008972]/50 transition-all flex flex-col justify-between group cursor-pointer"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 group-hover:text-slate-600 transition-colors">
                Active B2B Agents
              </span>
              <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                <Briefcase className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-3 flex items-baseline space-x-2.5">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {metrics.activeAgents.totalActive}
              </span>
              {metrics.activeAgents.newlyVerifiedInPeriod > 0 && (
                <span className="inline-flex items-center text-xs font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                  +{metrics.activeAgents.newlyVerifiedInPeriod} new
                </span>
              )}
            </div>

            <div className="text-[11px] text-slate-400 mt-1">
              Verified agency partners · Direct buyers excluded
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <div className="flex items-center space-x-1.5">
              <span className="text-amber-700 font-bold">{metrics.activeAgents.pendingVerification} Pending</span>
              <span className="text-slate-300">·</span>
              <span className="text-slate-500">{metrics.activeAgents.suspendedInactive} Susp</span>
            </div>
            <span className="text-[#008972] font-bold group-hover:translate-x-0.5 transition-transform flex items-center">
              Roster <ChevronRight className="w-3 h-3 ml-0.5" />
            </span>
          </div>
        </div>

        {/* CARD 7: Pending Payments */}
        <div 
          id="metric-card-pending-payments"
          onClick={() => onNavigate('BOOKING_MANAGEMENT', 'PAYMENTS')}
          className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs hover:border-[#008972]/50 transition-all flex flex-col justify-between group cursor-pointer"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 group-hover:text-slate-600 transition-colors">
                Pending Payments
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-3 flex items-baseline space-x-2.5">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {metrics.pendingPayments.bookingsWithPendingPaymentsCount}
              </span>
              {metrics.pendingPayments.overduePaymentsCount > 0 && (
                <span className="inline-flex items-center text-xs font-extrabold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                  {metrics.pendingPayments.overduePaymentsCount} Overdue
                </span>
              )}
            </div>

            <div className="text-[11px] text-slate-400 mt-1">
              {metrics.pendingPayments.isAuthorized ? (
                <span>Outstanding: {fx.format(metrics.pendingPayments.totalOutstandingAmount, metrics.pendingPayments.currency)}</span>
              ) : (
                <span>Bookings with unpaid installments</span>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-amber-700 font-bold">Tranches & Receipts</span>
            <span className="text-[#008972] font-bold group-hover:translate-x-0.5 transition-transform flex items-center">
              Schedules <ChevronRight className="w-3 h-3 ml-0.5" />
            </span>
          </div>
        </div>

        {/* CARD 8: Active Suppliers */}
        <div 
          id="metric-card-active-suppliers"
          onClick={() => onNavigate('ACCOUNT_MANAGEMENT', 'SUPPLIERS')}
          className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs hover:border-[#008972]/50 transition-all flex flex-col justify-between group cursor-pointer"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 group-hover:text-slate-600 transition-colors">
                Active DMC Suppliers
              </span>
              <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                <Building2 className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-3 flex items-baseline space-x-2.5">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {metrics.activeSuppliers.totalActive}
              </span>
              {metrics.activeSuppliers.pendingReview > 0 && (
                <span className="inline-flex items-center text-xs font-extrabold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                  {metrics.activeSuppliers.pendingReview} in review
                </span>
              )}
            </div>

            <div className="text-[11px] text-slate-400 mt-1">
              Hotels, ground transport, activities & guides
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <div className="flex items-center space-x-1.5 text-slate-500">
              <span>{metrics.activeSuppliers.missingDocs} missing docs</span>
            </div>
            <span className="text-[#008972] font-bold group-hover:translate-x-0.5 transition-transform flex items-center">
              Directory <ChevronRight className="w-3 h-3 ml-0.5" />
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
