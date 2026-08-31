import React, { useState, useMemo } from 'react';
import { 
  PlusCircle, 
  FileText, 
  BookmarkCheck, 
  Users, 
  CheckSquare, 
  Layers, 
  Building2, 
  ShoppingBag, 
  TrendingUp, 
  DollarSign, 
  Clock, 
  ArrowRight, 
  Copy, 
  Eye, 
  Calendar, 
  MapPin, 
  Sparkles, 
  ArrowUpRight, 
  ChevronRight, 
  FileDown, 
  AlertCircle,
  CheckCircle2,
  PhoneCall,
  Mail,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useQuotation } from '../../context/QuotationContext';
import { B2BNavTab, Quotation, B2BPackage, Destination, Product, Hotel } from '../../types';
import { AppDatabase } from '../../services/db';
import { formatCurrency } from '../../services/pricingEngine';

interface B2BDashboardViewProps {
  onNavigate: (tab: B2BNavTab) => void;
  onOpenCreateQuoteWithDestination?: (destSlug: string) => void;
  onOpenPackageCustomizer?: (pkg: B2BPackage) => void;
  onLoadQuote: (quote: Quotation) => void;
  destinations: Destination[];
  products: Product[];
  hotels: Hotel[];
}

export const B2BDashboardView: React.FC<B2BDashboardViewProps> = ({
  onNavigate,
  onOpenCreateQuoteWithDestination,
  onOpenPackageCustomizer,
  onLoadQuote,
  destinations = [],
  products = [],
  hotels = []
}) => {
  const { user } = useAuth();
  const { savedQuotes, currency } = useQuotation();
  const db = AppDatabase.getInstance();

  const packages = useMemo(() => db.getPackages(), [db]);
  const customers = useMemo(() => db.getB2BCustomers(user?.id), [db, user]);
  const tasks = useMemo(() => db.getB2BTasks(user?.id), [db, user]);
  const bookings = useMemo(() => db.getBookingsForUser(user), [db, user]);

  // Quotes metrics
  const quotesList = useMemo(() => db.getAllSavedQuotesForUser(user), [db, user]);
  
  const draftQuotes = quotesList.filter(q => q.status === 'DRAFT' || q.status === 'IN_PROGRESS');
  const sentQuotes = quotesList.filter(q => q.status === 'SENT' || q.status === 'SENT_TO_CLIENT' || q.status === 'VIEWED');
  const approvedQuotes = quotesList.filter(q => q.status === 'APPROVED' || q.status === 'ACCEPTED');
  const convertedQuotes = quotesList.filter(q => q.status === 'CONVERTED' || q.status === 'CONFIRMED' || q.status === 'BOOKING_SUBMITTED');

  // Pipeline revenue calculation
  const totalPipelineValue = quotesList.reduce((sum, q) => sum + (q.totalSellingPrice || 0), 0);
  const totalConfirmedBookingsValue = bookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);

  // Quick Duplicate Handler
  const handleQuickDuplicate = (quote: Quotation) => {
    const duplicated = db.duplicateQuotation(quote.id, user);
    if (duplicated) {
      onLoadQuote(duplicated);
      onNavigate('CREATE_QUOTE');
    }
  };

  // Pending urgent tasks
  const pendingTasks = tasks.filter(t => t.status !== 'COMPLETED').slice(0, 4);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Agent Welcome & Operational Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#00C6A6]/20 text-[#00E5C0] border border-[#00C6A6]/30 uppercase tracking-wider">
                B2B Agency Console
              </span>
              <span className="text-xs text-slate-400 font-mono">ID: {user?.id || 'usr-agent-01'}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white font-sans">
              Welcome, {user?.name || 'Elena Rostova'}
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Wholesale tariff engine connected • Build custom multi-city itineraries, manage client quotes, and lock guaranteed ground operations SLAs.
            </p>
          </div>

          {/* Big Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => onNavigate('CREATE_QUOTE')}
              className="inline-flex items-center space-x-2 bg-[#00C6A6] hover:bg-[#00E5C0] text-slate-950 px-5 py-3 rounded-2xl text-xs font-black transition-all shadow-lg shadow-[#00C6A6]/20 hover:scale-[1.02] cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create New Quote</span>
            </button>

            <button
              onClick={() => onNavigate('PACKAGES')}
              className="inline-flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-3 rounded-2xl text-xs font-bold border border-slate-700 transition-colors cursor-pointer"
            >
              <Layers className="w-4 h-4 text-[#00C6A6]" />
              <span>Ready-Made Packages</span>
            </button>
          </div>
        </div>
      </div>

      {/* Commercial Overview KPI Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Quotes */}
        <div 
          onClick={() => onNavigate('MY_QUOTES')}
          className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs hover:border-[#00C6A6] transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Active Quotes</span>
            <div className="p-2 rounded-xl bg-slate-50 text-slate-700 group-hover:bg-[#00C6A6]/10 group-hover:text-[#00C6A6] transition-colors">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">{quotesList.length}</span>
            <span className="text-xs text-slate-500 font-medium">({draftQuotes.length} drafts)</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 flex items-center space-x-1">
            <span>{approvedQuotes.length} approved by client</span>
          </p>
        </div>

        {/* Metric 2: Pipeline Value */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pipeline Value</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-extrabold text-slate-900 font-mono">
              {formatCurrency(totalPipelineValue || 18450, currency)}
            </span>
          </div>
          <p className="text-[11px] text-emerald-600 font-bold mt-1">
            Wholesale + Margin Total
          </p>
        </div>

        {/* Metric 3: Confirmed Bookings */}
        <div 
          onClick={() => onNavigate('BOOKINGS')}
          className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs hover:border-[#00C6A6] transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Bookings & Vouchers</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition-colors">
              <BookmarkCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">{bookings.length}</span>
            <span className="text-xs text-blue-600 font-bold">24-48h SLA</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {bookings.filter(b => b.status === 'CONFIRMED').length} confirmed vouchers
          </p>
        </div>

        {/* Metric 4: Clients in CRM */}
        <div 
          onClick={() => onNavigate('CUSTOMERS')}
          className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs hover:border-[#00C6A6] transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Client Database</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600 group-hover:bg-purple-100 transition-colors">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">{customers.length}</span>
            <span className="text-xs text-slate-500 font-medium">Active CRM</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            High net-worth traveler profiles
          </p>
        </div>
      </div>

      {/* Fast Action Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <button
          onClick={() => onNavigate('CREATE_QUOTE')}
          className="p-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl border border-slate-800 flex flex-col items-center justify-center text-center space-y-1.5 transition-all hover:scale-[1.02] cursor-pointer"
        >
          <PlusCircle className="w-5 h-5 text-[#00E5C0]" />
          <span className="text-xs font-bold">Create Quote</span>
          <span className="text-[10px] text-slate-400">11-Step Builder</span>
        </button>

        <button
          onClick={() => onNavigate('PACKAGES')}
          className="p-3.5 bg-white hover:bg-slate-50 text-slate-900 rounded-2xl border border-slate-200/80 flex flex-col items-center justify-center text-center space-y-1.5 transition-all hover:scale-[1.02] cursor-pointer"
        >
          <Layers className="w-5 h-5 text-indigo-600" />
          <span className="text-xs font-bold">Saved Packages</span>
          <span className="text-[10px] text-slate-500">{packages.length} Ready-Made</span>
        </button>

        <button
          onClick={() => onNavigate('PRODUCTS')}
          className="p-3.5 bg-white hover:bg-slate-50 text-slate-900 rounded-2xl border border-slate-200/80 flex flex-col items-center justify-center text-center space-y-1.5 transition-all hover:scale-[1.02] cursor-pointer"
        >
          <ShoppingBag className="w-5 h-5 text-teal-600" />
          <span className="text-xs font-bold">Tours Catalog</span>
          <span className="text-[10px] text-slate-500">{products.length} Contracted</span>
        </button>

        <button
          onClick={() => onNavigate('HOTELS')}
          className="p-3.5 bg-white hover:bg-slate-50 text-slate-900 rounded-2xl border border-slate-200/80 flex flex-col items-center justify-center text-center space-y-1.5 transition-all hover:scale-[1.02] cursor-pointer"
        >
          <Building2 className="w-5 h-5 text-amber-600" />
          <span className="text-xs font-bold">5★ Hotels</span>
          <span className="text-[10px] text-slate-500">{hotels.length} Properties</span>
        </button>

        <button
          onClick={() => onNavigate('CUSTOMERS')}
          className="p-3.5 bg-white hover:bg-slate-50 text-slate-900 rounded-2xl border border-slate-200/80 flex flex-col items-center justify-center text-center space-y-1.5 transition-all hover:scale-[1.02] cursor-pointer"
        >
          <Users className="w-5 h-5 text-purple-600" />
          <span className="text-xs font-bold">Customers</span>
          <span className="text-[10px] text-slate-500">{customers.length} Profiles</span>
        </button>

        <button
          onClick={() => onNavigate('TASKS')}
          className="p-3.5 bg-white hover:bg-slate-50 text-slate-900 rounded-2xl border border-slate-200/80 flex flex-col items-center justify-center text-center space-y-1.5 transition-all hover:scale-[1.02] cursor-pointer"
        >
          <CheckSquare className="w-5 h-5 text-rose-600" />
          <span className="text-xs font-bold">Follow-Ups</span>
          <span className="text-[10px] text-rose-600 font-bold">{pendingTasks.length} Pending</span>
        </button>
      </div>

      {/* Main 2-Column Split: Left = Recent Quotes & Ready Packages, Right = Follow-ups & Fast Destinations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Section: Recent Client Quotations */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-[#00C6A6]" />
                <h2 className="text-base font-bold text-slate-900">Recent Quotations & Proposals</h2>
              </div>
              <button
                onClick={() => onNavigate('MY_QUOTES')}
                className="text-xs font-bold text-teal-700 hover:text-teal-800 flex items-center space-x-1 cursor-pointer"
              >
                <span>View All ({quotesList.length})</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {quotesList.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-3">
                <FileText className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-xs text-slate-500">No active quotes yet. Start your first client quotation in seconds.</p>
                <button
                  onClick={() => onNavigate('CREATE_QUOTE')}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-[#00C6A6]" />
                  <span>Launch Quotation Builder</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-wider font-bold text-[10px]">
                      <th className="pb-2.5">Quote Ref / Client</th>
                      <th className="pb-2.5">Destination</th>
                      <th className="pb-2.5">Items</th>
                      <th className="pb-2.5">Total Value</th>
                      <th className="pb-2.5">Status</th>
                      <th className="pb-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {quotesList.slice(0, 5).map(quote => (
                      <tr key={quote.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3">
                          <div className="font-bold text-slate-900">{quote.clientName || 'Private Traveler'}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{quote.quoteNumber}</div>
                        </td>
                        <td className="py-3">
                          <span className="inline-flex items-center space-x-1 font-medium text-slate-700">
                            <MapPin className="w-3 h-3 text-[#00C6A6]" />
                            <span>{quote.destination || 'Japan'}</span>
                          </span>
                        </td>
                        <td className="py-3 text-slate-600 font-medium">
                          {quote.items?.length || 0} products
                        </td>
                        <td className="py-3 font-mono font-bold text-slate-900">
                          {formatCurrency(quote.totalSellingPrice, quote.currency || currency)}
                        </td>
                        <td className="py-3">
                          <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            quote.status === 'APPROVED' || quote.status === 'CONFIRMED' || quote.status === 'CONVERTED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : quote.status === 'SENT' || quote.status === 'SENT_TO_CLIENT'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {quote.status}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            <button
                              onClick={() => {
                                onLoadQuote(quote);
                                onNavigate('CREATE_QUOTE');
                              }}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] cursor-pointer"
                              title="Edit / Continue Quote"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleQuickDuplicate(quote)}
                              className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
                              title="Duplicate Quote for repeat client"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section: Ready-Made Itinerary Packages */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  <span>Ready-Made Packages (Instant Customization)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pre-crafted luxury itineraries with pre-allocated 5★ hotels and tours. Click to customize.
                </p>
              </div>

              <button
                onClick={() => onNavigate('PACKAGES')}
                className="text-xs font-bold text-teal-700 hover:text-teal-800 flex items-center space-x-1 cursor-pointer"
              >
                <span>View All ({packages.length})</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {packages.slice(0, 2).map(pkg => (
                <div 
                  key={pkg.id} 
                  className="border border-slate-200 rounded-2xl overflow-hidden hover:shadow-md hover:border-[#00C6A6] transition-all flex flex-col group"
                >
                  <div className="h-36 relative overflow-hidden">
                    <img
                      src={pkg.heroImage}
                      alt={pkg.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent"></div>
                    <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full bg-slate-900/80 backdrop-blur text-[10px] font-bold text-[#00E5C0]">
                      {pkg.durationNights}N / {pkg.durationDays}D
                    </div>
                    <div className="absolute bottom-2.5 left-2.5 right-2.5 text-white">
                      <span className="text-[10px] text-slate-300 uppercase tracking-wider font-bold block">{pkg.destinationName}</span>
                      <h3 className="text-xs font-bold truncate">{pkg.title}</h3>
                    </div>
                  </div>

                  <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3 bg-white">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap gap-1">
                        {pkg.routeSummary.slice(0, 3).map((r, i) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-medium">
                            {r}
                          </span>
                        ))}
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                        {pkg.tagline}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 block leading-tight">Starting Net Tariff</span>
                        <span className="text-xs font-black text-slate-900 font-mono">
                          {formatCurrency(pkg.baseNetCostUSD, currency)}
                        </span>
                      </div>

                      <button
                        onClick={() => {
                          if (onOpenPackageCustomizer) {
                            onOpenPackageCustomizer(pkg);
                          } else {
                            onNavigate('CREATE_QUOTE');
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-[#00C6A6] hover:text-slate-950 text-white text-xs font-bold transition-colors cursor-pointer"
                      >
                        Customize
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Follow-ups & Hub Quick Launch */}
        <div className="lg:col-span-4 space-y-6">
          {/* Urgent Follow-Ups & Tasks */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckSquare className="w-5 h-5 text-rose-500" />
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Pending Follow-Ups
                </h2>
              </div>
              <button
                onClick={() => onNavigate('TASKS')}
                className="text-[11px] font-bold text-teal-700 hover:underline cursor-pointer"
              >
                Manage ({tasks.length})
              </button>
            </div>

            {pendingTasks.length === 0 ? (
              <div className="p-4 bg-emerald-50 rounded-2xl text-emerald-800 text-xs flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>All client follow-up reminders are up to date!</span>
              </div>
            ) : (
              <div className="space-y-2.5">
                {pendingTasks.map(task => (
                  <div 
                    key={task.id}
                    className="p-3 rounded-2xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200/70 transition-colors space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold text-slate-800 leading-snug">
                        {task.title}
                      </span>
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase shrink-0 ${
                        task.priority === 'URGENT' || task.priority === 'HIGH'
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-slate-200 text-slate-700'
                      }`}>
                        {task.priority}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span className="flex items-center space-x-1">
                        <Users className="w-3 h-3 text-slate-400" />
                        <span>{task.relatedCustomerName || 'Client'}</span>
                      </span>
                      <span className="flex items-center space-x-1 font-mono">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>Due: {task.dueDate}</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Destination Hub Launchpad */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center space-x-2">
              <MapPin className="w-5 h-5 text-[#00C6A6]" />
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Frequent Destinations
              </h2>
            </div>
            <p className="text-xs text-slate-500">
              One-click quote initialization for contracted wholesale territories:
            </p>

            <div className="space-y-2">
              {(destinations || []).map(d => (
                <button
                  key={d.id}
                  onClick={() => {
                    if (onOpenCreateQuoteWithDestination) {
                      onOpenCreateQuoteWithDestination(d.slug);
                    } else {
                      onNavigate('CREATE_QUOTE');
                    }
                  }}
                  className="w-full p-3 rounded-2xl border border-slate-200/80 hover:border-[#00C6A6] hover:bg-slate-50 flex items-center justify-between transition-all group cursor-pointer text-left"
                >
                  <div className="flex items-center space-x-3">
                    <img
                      src={d.heroImage}
                      alt={d.name}
                      className="w-10 h-10 rounded-xl object-cover"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-900 group-hover:text-[#00C6A6] transition-colors block">
                        {d.name}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        {d.country} • Tokyo, Kyoto, Osaka Hubs
                      </span>
                    </div>
                  </div>

                  <span className="p-1.5 rounded-lg bg-slate-100 text-slate-600 group-hover:bg-[#00C6A6] group-hover:text-slate-950 transition-colors">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* DMC 24/7 Ops Emergency Assistance Card */}
          <div className="bg-slate-900 rounded-3xl p-5 border border-slate-800 text-white space-y-2.5">
            <div className="flex items-center space-x-2">
              <Zap className="w-4 h-4 text-[#00E5C0]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#00E5C0]">
                24/7 DMC Ground Dispatch SLA
              </h3>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Guaranteed instant response for on-tour passenger manifests, emergency chauffeur dispatches, and private guide swaps.
            </p>
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Direct Ops Hotline:</span>
              <span className="font-mono font-bold text-white">+91 98710 24890</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
