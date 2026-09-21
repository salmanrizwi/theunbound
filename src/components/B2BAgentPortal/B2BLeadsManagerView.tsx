import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  MapPin, 
  Calendar, 
  DollarSign, 
  Clock, 
  ArrowRight, 
  FileText, 
  Phone, 
  Mail, 
  Building2, 
  CheckCircle2, 
  Sparkles,
  ChevronRight,
  BookmarkCheck,
  AlertCircle,
  Tag,
  Shield,
  ExternalLink,
  HelpCircle,
  UserCheck,
  X
} from 'lucide-react';
import { TravelLead, User } from '../../types';
import { AppDatabase } from '../../services/db';
import { useAuth } from '../../context/AuthContext';

interface B2BLeadsManagerViewProps {
  onCreateQuoteFromLead: (lead: TravelLead) => void;
  onNavigateToBooking?: (bookingReference: string) => void;
}

export const B2BLeadsManagerView: React.FC<B2BLeadsManagerViewProps> = ({
  onCreateQuoteFromLead,
  onNavigateToBooking
}) => {
  const { user } = useAuth();
  const db = AppDatabase.getInstance();

  const [leads, setLeads] = useState<TravelLead[]>(() => db.getLeadsAuthorized(user));
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ASSIGNED' | 'QUOTED' | 'CONVERTED'>('ALL');
  const [selectedLead, setSelectedLead] = useState<TravelLead | null>(null);

  useEffect(() => {
    const unsub = db.subscribe(() => {
      setLeads(db.getLeadsAuthorized(user));
    });
    return unsub;
  }, [user]);

  // Filtered leads
  const filteredLeads = useMemo(() => {
    let list = [...leads];

    if (statusFilter === 'ASSIGNED') {
      list = list.filter(l => l.status === 'NEW' || l.leadVisibilityStatus === 'ASSIGNED_TO_AGENT' || l.status === 'QUALIFIED');
    } else if (statusFilter === 'QUOTED') {
      list = list.filter(l => l.status === 'QUOTED' || l.quoteNumber || (l.quoteVersions && l.quoteVersions.length > 0));
    } else if (statusFilter === 'CONVERTED') {
      list = list.filter(l => l.status === 'BOOKED' || l.bookingReference || l.bookingId);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(l => 
        l.contactName?.toLowerCase().includes(q) ||
        l.leadNumber?.toLowerCase().includes(q) ||
        l.destinationName?.toLowerCase().includes(q) ||
        l.email?.toLowerCase().includes(q) ||
        l.phone?.toLowerCase().includes(q) ||
        l.companyName?.toLowerCase().includes(q) ||
        l.quoteNumber?.toLowerCase().includes(q) ||
        l.bookingReference?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [leads, statusFilter, searchQuery]);

  // Stats
  const stats = useMemo(() => {
    const total = leads.length;
    const pendingQuotes = leads.filter(l => !l.quoteNumber && !l.bookingReference).length;
    const quoted = leads.filter(l => !!l.quoteNumber).length;
    const converted = leads.filter(l => !!l.bookingReference || l.status === 'BOOKED').length;
    return { total, pendingQuotes, quoted, converted };
  }, [leads]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-80 bg-gradient-to-l from-teal-50/60 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-md bg-teal-50 border border-[#00C6A6]/30 text-[#008f77] text-[10px] font-black uppercase tracking-wider">
                Assigned Inquiries
              </span>
              <span className="text-xs text-slate-400 font-medium">B2B Partner Lead Management</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
              Assigned Leads & Inquiries
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
              Travel inquiries and bespoke requests assigned directly to your agency account by TheUnbound central operations team.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="px-4 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-center">
              <span className="block text-xl font-black text-slate-900">{stats.total}</span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Assigned</span>
            </div>
            <div className="px-4 py-2 rounded-2xl bg-teal-50 border border-teal-200 text-center">
              <span className="block text-xl font-black text-[#008f77]">{stats.pendingQuotes}</span>
              <span className="text-[10px] font-bold text-[#008f77] uppercase tracking-wider">Need Quote</span>
            </div>
            <div className="px-4 py-2 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
              <span className="block text-xl font-black text-emerald-800">{stats.converted}</span>
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Booked</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search traveler, lead #, destination..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#00C6A6] transition-colors"
          />
        </div>

        <div className="flex items-center space-x-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {(['ALL', 'ASSIGNED', 'QUOTED', 'CONVERTED'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors shrink-0 cursor-pointer ${
                statusFilter === tab 
                  ? 'bg-slate-950 text-white' 
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              {tab === 'ALL' && `All Leads (${leads.length})`}
              {tab === 'ASSIGNED' && `Need Action (${stats.pendingQuotes})`}
              {tab === 'QUOTED' && `Quoted (${stats.quoted})`}
              {tab === 'CONVERTED' && `Booked (${stats.converted})`}
            </button>
          ))}
        </div>
      </div>

      {/* Leads List */}
      {filteredLeads.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-4 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-teal-50 text-[#00C6A6] flex items-center justify-center mx-auto border border-teal-100">
            <Users className="w-7 h-7" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-base font-bold text-slate-900">
              {searchQuery ? 'No matching leads found' : 'No Assigned Leads Yet'}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {searchQuery 
                ? 'Try broadening your search query or reset the filter tabs.' 
                : 'When TheUnbound central operations team assigns an inquiry or traveler request to your agency account, it will immediately appear in this workspace and trigger an Action Center alert.'}
            </p>
          </div>
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setStatusFilter('ALL'); }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Clear Search Filter
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLeads.map(lead => {
            const isBooked = !!lead.bookingReference || lead.status === 'BOOKED';
            const isQuoted = !!lead.quoteNumber || lead.status === 'QUOTED';

            return (
              <div
                key={lead.id}
                className="bg-white border border-slate-200 hover:border-slate-300 rounded-3xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4 group"
              >
                <div className="space-y-3">
                  {/* Card Top: Reference and Status */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-1.5">
                      <span className="font-mono text-[11px] font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                        {lead.leadNumber || 'LED-DIRECT'}
                      </span>
                      {lead.destinationName && (
                        <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-[#00C6A6]" />
                          <span>{lead.destinationName}</span>
                        </span>
                      )}
                    </div>

                    {isBooked ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Booked</span>
                      </span>
                    ) : isQuoted ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-100 text-sky-800 flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        <span>Quoted</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 animate-pulse">
                        Action Required
                      </span>
                    )}
                  </div>

                  {/* Customer Details */}
                  <div>
                    <h3 className="text-base font-bold text-slate-950 group-hover:text-[#008f77] transition-colors line-clamp-1">
                      {lead.contactName || 'Inquiring Traveler'}
                    </h3>
                    {lead.companyName && (
                      <p className="text-xs text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                        <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{lead.companyName}</span>
                      </p>
                    )}
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-1 text-xs text-slate-600 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                    {lead.email && (
                      <a 
                        href={`mailto:${lead.email}`} 
                        className="flex items-center gap-1.5 hover:text-[#008f77] transition-colors truncate"
                      >
                        <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{lead.email}</span>
                      </a>
                    )}
                    {lead.phone && (
                      <a 
                        href={`tel:${lead.phone}`} 
                        className="flex items-center gap-1.5 hover:text-[#008f77] transition-colors"
                      >
                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{lead.phone}</span>
                      </a>
                    )}
                    {!lead.email && !lead.phone && (
                      <p className="text-[11px] text-slate-400 italic">Contact via portal inquiry</p>
                    )}
                  </div>

                  {/* Travel Requirements Summary */}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">Dates</span>
                      <span className="font-medium text-slate-800 truncate block">
                        {lead.travelDates || (lead.travelStartDate ? `${lead.travelStartDate}` : 'Flexible 2026')}
                      </span>
                    </div>

                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">Party Size</span>
                      <span className="font-bold text-slate-900 block">
                        {lead.paxAdults || 2} Adults {lead.paxChildren ? `• ${lead.paxChildren} Ch` : ''}
                      </span>
                    </div>
                  </div>

                  {lead.estimatedBudget && (
                    <div className="flex items-center justify-between text-xs px-1 text-slate-600">
                      <span className="text-slate-400 font-medium">Budget:</span>
                      <span className="font-mono font-bold text-slate-900">
                        {lead.currency || 'USD'} {Number(lead.estimatedBudget).toLocaleString()}
                      </span>
                    </div>
                  )}

                  {/* Assigned Internal Team Member Strip */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-slate-700 truncate max-w-[190px]">
                      <UserCheck className="w-3.5 h-3.5 text-[#008f77] shrink-0" />
                      <span className="truncate text-[11px] font-semibold">
                        Ops Lead: {lead.assignedTeamMemberNameSnapshot || lead.assignedStaffName || 'Central Operations'}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {lead.assignedTeamMemberDepartment || lead.assignedDepartment || 'SALES'}
                    </span>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedLead(lead)}
                    className="px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    View Details
                  </button>

                  <button
                    type="button"
                    onClick={() => onCreateQuoteFromLead(lead)}
                    className="flex-1 px-3 py-2 rounded-xl text-xs font-bold bg-slate-950 hover:bg-slate-800 text-white transition-colors cursor-pointer flex items-center justify-center space-x-1.5 shadow-xs"
                  >
                    <FileText className="w-3.5 h-3.5 text-[#00E5C0]" />
                    <span>{isQuoted ? 'New Version' : 'Create Quote'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lead Detail Modal */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center space-x-2">
                <span className="font-mono text-xs font-black text-slate-900 bg-white border border-slate-200 px-2 py-0.5 rounded-md shadow-xs">
                  {selectedLead.leadNumber || 'LED-DIRECT'}
                </span>
                <span className="text-xs font-bold text-slate-600">Assigned Inquiry Details</span>
              </div>
              <button
                onClick={() => setSelectedLead(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div>
                <h2 className="text-xl font-black text-slate-900">{selectedLead.contactName}</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Assigned by {selectedLead.assignedByUserNameSnapshot || 'TheUnbound Operations'}
                  {selectedLead.assignedAt && ` on ${new Date(selectedLead.assignedAt).toLocaleDateString()}`}
                </p>
              </div>

              {/* Dedicated Internal Team Member Card */}
              <div className="bg-teal-50/50 p-4 rounded-2xl border border-[#00C6A6]/30 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-[#008f77] uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Your Dedicated Central Operations Specialist</span>
                  </div>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-white text-[#008f77] border border-[#00C6A6]/20">
                    {selectedLead.assignedTeamMemberDepartment || selectedLead.assignedDepartment || 'SALES'}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <div>
                    <span className="font-bold text-slate-900 text-sm block">
                      {selectedLead.assignedTeamMemberNameSnapshot || selectedLead.assignedStaffName || 'Central Operations Team'}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {selectedLead.assignedTeamMemberEmailSnapshot || selectedLead.assignedStaffEmail || 'business@theunbound.in'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 max-w-[200px] text-right">
                    Direct coordinator for custom pricing, supplier rates, and itinerary customization.
                  </p>
                </div>
              </div>

              {/* Contact Information */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2 text-xs">
                <div className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Contact Information</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Email</span>
                    <span className="font-medium text-slate-900">{selectedLead.email || 'Not specified'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Phone</span>
                    <span className="font-medium text-slate-900">{selectedLead.phone || 'Not specified'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Agency / Company</span>
                    <span className="font-medium text-slate-900">{selectedLead.companyName || selectedLead.agencyName || 'Independent'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Destination</span>
                    <span className="font-medium text-slate-900">{selectedLead.destinationName || 'Multi-Destination'}</span>
                  </div>
                </div>
              </div>

              {/* Trip Requirements */}
              <div className="space-y-2 text-xs">
                <div className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Travel Requirements & Pax</div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 block">Adults</span>
                    <span className="text-sm font-bold text-slate-900">{selectedLead.paxAdults || 2}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 block">Children</span>
                    <span className="text-sm font-bold text-slate-900">{selectedLead.paxChildren || 0}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 block">Est. Budget</span>
                    <span className="text-sm font-bold text-[#008f77]">
                      {selectedLead.currency || 'USD'} {Number(selectedLead.estimatedBudget || 0).toLocaleString()}
                    </span>
                  </div>
                </div>

                {selectedLead.travelRequirements && (
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 mt-2">
                    <span className="text-[10px] text-slate-400 block mb-1 font-bold uppercase">Special Requests & Notes</span>
                    <p className="text-slate-700 leading-relaxed">{selectedLead.travelRequirements}</p>
                  </div>
                )}
              </div>

              {/* Linked Records */}
              {(selectedLead.quoteNumber || selectedLead.bookingReference) && (
                <div className="p-4 rounded-2xl bg-teal-50/60 border border-teal-100 space-y-2 text-xs">
                  <span className="font-bold text-[#008f77] uppercase tracking-wider text-[10px] block">
                    Linked Quotations & Bookings
                  </span>
                  {selectedLead.quoteNumber && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Active Proposal:</span>
                      <span className="font-mono font-bold text-slate-900">#{selectedLead.quoteNumber}</span>
                    </div>
                  )}
                  {selectedLead.bookingReference && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Confirmed Booking:</span>
                      <span className="font-mono font-bold text-emerald-800">#{selectedLead.bookingReference}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setSelectedLead(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-bold transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const leadToQuote = selectedLead;
                  setSelectedLead(null);
                  onCreateQuoteFromLead(leadToQuote);
                }}
                className="px-4 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1.5 shadow-xs"
              >
                <FileText className="w-3.5 h-3.5 text-[#00E5C0]" />
                <span>Create B2B Quote from Lead</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
