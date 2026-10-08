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
  X,
  LayoutGrid,
  List,
  Grid,
  Plus,
  Edit2,
  Trash2,
  ChevronDown,
  Check,
  ArrowUpRight,
  MessageSquare,
  History,
  UserCheck,
  RefreshCw,
  Eye,
  UserPlus
} from 'lucide-react';
import { TravelLead, B2BCustomer, User } from '../../types';
import { AppDatabase } from '../../services/db';
import { useAuth } from '../../context/AuthContext';

interface B2BMyLeadsAndClientsCRMViewProps {
  initialSubView?: 'assigned-leads' | 'clients';
  onCreateQuoteFromLead: (lead: TravelLead) => void;
  onCreateQuoteForCustomer?: (customer: B2BCustomer) => void;
  onNavigateToBooking?: (bookingReference: string) => void;
}

type LeadViewMode = 'kanban' | 'list' | 'card';

export const B2BMyLeadsAndClientsCRMView: React.FC<B2BMyLeadsAndClientsCRMViewProps> = ({
  initialSubView = 'assigned-leads',
  onCreateQuoteFromLead,
  onCreateQuoteForCustomer,
  onNavigateToBooking
}) => {
  const { user } = useAuth();
  const db = AppDatabase.getInstance();

  // Top-level CRM sub-view: 'assigned-leads' or 'clients'
  const [activeSubTab, setActiveSubTab] = useState<'assigned-leads' | 'clients'>(initialSubView);
  
  // Lead view mode: kanban | list | card
  const [leadViewMode, setLeadViewMode] = useState<LeadViewMode>('card');

  // Lead state loaded via authoritative authorized method
  const [leads, setLeads] = useState<TravelLead[]>(() => db.getLeadsAuthorized(user));
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ASSIGNED' | 'QUOTED' | 'CONVERTED'>('ALL');
  const [selectedLead, setSelectedLead] = useState<TravelLead | null>(null);

  // Client Directory State
  const [refreshClientsTrigger, setRefreshClientsTrigger] = useState(0);
  const customers = useMemo(() => {
    return db.getB2BCustomers(user?.id);
  }, [db, user, refreshClientsTrigger]);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<B2BCustomer | null>(null);
  const [clientFormData, setClientFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    country: 'United Kingdom',
    city: 'London',
    preferredDestination: 'Japan',
    budgetPerPersonUSD: 6000,
    notes: ''
  });

  // Communication & Follow-up in Lead Details modal
  const [detailTab, setDetailTab] = useState<'overview' | 'quotes' | 'bookings' | 'followups' | 'communications' | 'timeline'>('overview');
  const [newFollowUpNote, setNewFollowUpNote] = useState('');
  const [newFollowUpDate, setNewFollowUpDate] = useState('');
  const [newCommType, setNewCommType] = useState<'EMAIL' | 'CALL' | 'WHATSAPP' | 'NOTE'>('NOTE');
  const [newCommNote, setNewCommNote] = useState('');

  // Real-time synchronization
  useEffect(() => {
    const unsub = db.subscribe(() => {
      setLeads(db.getLeadsAuthorized(user));
    });
    return unsub;
  }, [user, db]);

  // Sync subTab if prop changes
  useEffect(() => {
    if (initialSubView) {
      setActiveSubTab(initialSubView);
    }
  }, [initialSubView]);

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    let list = [...leads];

    if (statusFilter === 'ASSIGNED') {
      list = list.filter(l => l.status === 'NEW' || l.leadVisibilityStatus === 'ASSIGNED_TO_AGENT' || l.status === 'QUALIFIED' || (!l.quoteNumber && !l.bookingReference));
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

  // Filtered Clients
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      if (!clientSearchQuery.trim()) return true;
      const q = clientSearchQuery.toLowerCase().trim();
      return (
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.company && c.company.toLowerCase().includes(q)) ||
        c.country.toLowerCase().includes(q)
      );
    });
  }, [customers, clientSearchQuery]);

  // Stats
  const stats = useMemo(() => {
    const total = leads.length;
    const pendingQuotes = leads.filter(l => !l.quoteNumber && !l.bookingReference).length;
    const quoted = leads.filter(l => !!l.quoteNumber).length;
    const converted = leads.filter(l => !!l.bookingReference || l.status === 'BOOKED').length;
    const totalPipelineValue = leads.reduce((acc, l) => acc + Number(l.estimatedBudget || 0), 0);
    return { total, pendingQuotes, quoted, converted, totalPipelineValue };
  }, [leads]);

  // Client form submit
  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientFormData.name || !clientFormData.email) return;

    const newCustomer: B2BCustomer = {
      id: editingCustomer ? editingCustomer.id : `cust-${Date.now()}`,
      agentId: user?.id || 'usr-agent-01',
      name: clientFormData.name,
      email: clientFormData.email,
      phone: clientFormData.phone,
      company: clientFormData.company,
      country: clientFormData.country,
      city: clientFormData.city,
      preferredDestination: clientFormData.preferredDestination,
      budgetPerPersonUSD: Number(clientFormData.budgetPerPersonUSD) || 5000,
      notes: clientFormData.notes,
      totalQuotesCount: editingCustomer ? editingCustomer.totalQuotesCount : 0,
      totalBookingsCount: editingCustomer ? editingCustomer.totalBookingsCount : 0,
      lastContactDate: new Date().toISOString().split('T')[0],
      createdAt: editingCustomer ? editingCustomer.createdAt : new Date().toISOString().split('T')[0]
    };

    db.saveB2BCustomer(newCustomer);
    setIsAddClientModalOpen(false);
    setEditingCustomer(null);
    setClientFormData({
      name: '',
      email: '',
      phone: '',
      company: '',
      country: 'United Kingdom',
      city: 'London',
      preferredDestination: 'Japan',
      budgetPerPersonUSD: 6000,
      notes: ''
    });
    setRefreshClientsTrigger(prev => prev + 1);
  };

  const handleDeleteCustomer = (id: string) => {
    if (window.confirm('Are you sure you want to remove this client profile?')) {
      db.deleteB2BCustomer(id);
      setRefreshClientsTrigger(prev => prev + 1);
    }
  };

  // Add follow up to selected lead
  const handleAddFollowUp = () => {
    if (!selectedLead || !newFollowUpNote.trim()) return;
    const updatedLead: TravelLead = {
      ...selectedLead,
      followUps: [
        ...(selectedLead.followUps || []),
        {
          id: `flw-${Date.now()}`,
          note: newFollowUpNote.trim(),
          dueDate: newFollowUpDate || new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
          isCompleted: false,
          createdAt: new Date().toISOString(),
          createdByStaffName: user?.name || 'Agent'
        } as any
      ],
      updatedAt: new Date().toISOString()
    };
    db.saveLead(updatedLead, user);
    setSelectedLead(updatedLead);
    setNewFollowUpNote('');
    setNewFollowUpDate('');
  };

  // Add communication log
  const handleAddCommunication = () => {
    if (!selectedLead || !newCommNote.trim()) return;
    const newEntry = {
      id: `comm-${Date.now()}`,
      channel: newCommType,
      message: newCommNote.trim(),
      timestamp: new Date().toISOString(),
      author: user?.name || 'Agent'
    };
    const updatedLead: TravelLead = {
      ...selectedLead,
      notes: [
        ...(selectedLead.notes || []),
        {
          id: newEntry.id,
          content: `[${newCommType}] ${newCommNote.trim()}`,
          createdAt: newEntry.timestamp,
          authorName: newEntry.author,
          isInternal: false
        }
      ],
      updatedAt: new Date().toISOString()
    };
    db.saveLead(updatedLead, user);
    setSelectedLead(updatedLead);
    setNewCommNote('');
  };

  // Kanban Stage definitions
  const kanbanStages = [
    {
      id: 'NEW',
      label: 'New Inquiries',
      color: 'border-teal-500 text-teal-700 bg-teal-50/60',
      badgeColor: 'bg-teal-100 text-teal-800',
      match: (l: TravelLead) => (l.status === 'NEW' || !l.status) && !l.quoteNumber && !l.bookingReference
    },
    {
      id: 'QUALIFIED',
      label: 'Qualified & In Progress',
      color: 'border-sky-500 text-sky-700 bg-sky-50/60',
      badgeColor: 'bg-sky-100 text-sky-800',
      match: (l: TravelLead) => (l.status === 'QUALIFIED' || l.status === 'CONTACTED' || l.status === 'PROPOSAL_SAVED') && !l.quoteNumber && !l.bookingReference
    },
    {
      id: 'QUOTED',
      label: 'Quoted / In Review',
      color: 'border-indigo-500 text-indigo-700 bg-indigo-50/60',
      badgeColor: 'bg-indigo-100 text-indigo-800',
      match: (l: TravelLead) => (l.status === 'QUOTED' || !!l.quoteNumber) && !l.bookingReference
    },
    {
      id: 'CONVERTED',
      label: 'Booked / Won',
      color: 'border-emerald-500 text-emerald-700 bg-emerald-50/60',
      badgeColor: 'bg-emerald-100 text-emerald-800',
      match: (l: TravelLead) => l.status === 'BOOKED' || l.status === 'WON' || !!l.bookingReference
    }
  ];

  return (
    <div id="b2b-my-leads-and-clients-crm" className="w-full max-w-full min-w-0 px-4 sm:px-6 lg:px-8 xl:px-10 py-6 sm:py-8 space-y-6">
      {/* 1. Breadcrumb Hierarchy */}
      <nav className="flex items-center space-x-2 text-xs text-slate-500" aria-label="Breadcrumb">
        <span className="font-semibold text-slate-700">Accounts</span>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <span className="font-semibold text-slate-800">My Leads and Clients (CRM)</span>
        {activeSubTab === 'assigned-leads' && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-bold text-[#008f77]">Assigned Leads</span>
          </>
        )}
        {activeSubTab === 'clients' && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-bold text-purple-700">Client Directory</span>
          </>
        )}
      </nav>

      {/* 2. Header Banner */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-80 bg-gradient-to-l from-teal-50/60 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-md bg-teal-50 border border-[#00C6A6]/30 text-[#008f77] text-[10px] font-black uppercase tracking-wider">
                Accounts Module
              </span>
              <span className="text-xs text-slate-400 font-medium">Authoritative B2B CRM Access</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
              My Leads and Clients (CRM)
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
              Wholesale relationship hub. Access assigned traveler opportunities, manage client profiles, and build bespoke proposals directly from inquiries.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <div className="px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-center min-w-[90px]">
              <span className="block text-xl font-black text-slate-900">{stats.total}</span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Assigned Leads</span>
            </div>
            <div className="px-4 py-2.5 rounded-2xl bg-teal-50 border border-teal-200 text-center min-w-[90px]">
              <span className="block text-xl font-black text-[#008f77]">{stats.pendingQuotes}</span>
              <span className="text-[10px] font-bold text-[#008f77] uppercase tracking-wider">Need Action</span>
            </div>
            <div className="px-4 py-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-center min-w-[90px]">
              <span className="block text-xl font-black text-emerald-800">{stats.converted}</span>
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Booked</span>
            </div>
            <div className="px-4 py-2.5 rounded-2xl bg-purple-50 border border-purple-200 text-center min-w-[90px]">
              <span className="block text-xl font-black text-purple-900">{customers.length}</span>
              <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">Client Profiles</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Primary CRM Navigation: [Assigned Leads] vs [Client Directory] */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center space-x-2">
          {/* ASSIGNED LEADS BUTTON / TAB (PRIMARY REQUIRED ACCESS) */}
          <button
            id="crm-tab-assigned-leads-btn"
            onClick={() => setActiveSubTab('assigned-leads')}
            className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-2 shadow-xs ${
              activeSubTab === 'assigned-leads'
                ? 'bg-slate-950 text-white shadow-sm'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Users className={`w-4 h-4 ${activeSubTab === 'assigned-leads' ? 'text-[#00E5C0]' : 'text-slate-500'}`} />
            <span>Assigned Leads</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeSubTab === 'assigned-leads' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
            }`}>
              {leads.length}
            </span>
            {stats.pendingQuotes > 0 && (
              <span className="w-2 h-2 rounded-full bg-[#00E5C0] animate-pulse" />
            )}
          </button>

          {/* CLIENT DIRECTORY TAB */}
          <button
            id="crm-tab-client-directory-btn"
            onClick={() => setActiveSubTab('clients')}
            className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-2 shadow-xs ${
              activeSubTab === 'clients'
                ? 'bg-slate-950 text-white shadow-sm'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Building2 className={`w-4 h-4 ${activeSubTab === 'clients' ? 'text-[#00E5C0]' : 'text-slate-500'}`} />
            <span>Client Profiles</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeSubTab === 'clients' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
            }`}>
              {customers.length}
            </span>
          </button>
        </div>

        {/* Right side helper note */}
        <div className="text-[11px] text-slate-400 font-medium">
          Authoritative path: <span className="font-mono text-slate-600">Accounts → My Leads and Clients (CRM) → Assigned Leads</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. ASSIGNED LEADS MODULE                                                 */}
      {/* ========================================================================= */}
      {activeSubTab === 'assigned-leads' && (
        <div className="space-y-5">
          {/* Controls Bar: Search + Status Filter + Lead View Modes (Kanban, List, Card) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Search */}
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                id="assigned-leads-search-input"
                placeholder="Search traveler, lead #, destination, quote #..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#00C6A6] transition-colors"
              />
            </div>

            {/* Status Tabs */}
            <div className="flex items-center space-x-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
              {(['ALL', 'ASSIGNED', 'QUOTED', 'CONVERTED'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors shrink-0 cursor-pointer ${
                    statusFilter === tab 
                      ? 'bg-slate-900 text-white' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab === 'ALL' && `All (${leads.length})`}
                  {tab === 'ASSIGNED' && `Need Action (${stats.pendingQuotes})`}
                  {tab === 'QUOTED' && `Quoted (${stats.quoted})`}
                  {tab === 'CONVERTED' && `Booked (${stats.converted})`}
                </button>
              ))}
            </div>

            {/* View Mode Switcher: Kanban | List | Card */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
              <button
                id="lead-view-card-btn"
                onClick={() => setLeadViewMode('card')}
                title="Card View"
                className={`p-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
                  leadViewMode === 'card'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Card</span>
              </button>

              <button
                id="lead-view-list-btn"
                onClick={() => setLeadViewMode('list')}
                title="List View"
                className={`p-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
                  leadViewMode === 'list'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">List</span>
              </button>

              <button
                id="lead-view-kanban-btn"
                onClick={() => setLeadViewMode('kanban')}
                title="Kanban View"
                className={`p-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
                  leadViewMode === 'kanban'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Kanban</span>
              </button>
            </div>
          </div>

          {/* Empty State */}
          {filteredLeads.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-4 shadow-xs">
              <div className="w-14 h-14 rounded-2xl bg-teal-50 text-[#00C6A6] flex items-center justify-center mx-auto border border-teal-100">
                <Users className="w-7 h-7" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-base font-bold text-slate-900">
                  {searchQuery ? 'No matching leads found' : 'No Assigned Leads in Workspace'}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {searchQuery 
                    ? 'Try broadening your search query or reset the filter tabs.' 
                    : 'Inquiries assigned to your agency account by central operations will appear here.'}
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
            <>
              {/* =============================================================== */}
              {/* LEAD VIEW 1: CARD VIEW                                         */}
              {/* =============================================================== */}
              {leadViewMode === 'card' && (
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

                          {/* Linked References */}
                          {(lead.quoteNumber || lead.bookingReference) && (
                            <div className="pt-2 border-t border-slate-100 space-y-1">
                              {lead.quoteNumber && (
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-slate-400">Quote:</span>
                                  <span className="font-mono font-bold text-sky-700">#{lead.quoteNumber}</span>
                                </div>
                              )}
                              {lead.bookingReference && (
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-slate-400">Booking:</span>
                                  <span className="font-mono font-bold text-emerald-700">#{lead.bookingReference}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Card Actions */}
                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedLead(lead);
                              setDetailTab('overview');
                            }}
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

              {/* =============================================================== */}
              {/* LEAD VIEW 2: LIST VIEW                                         */}
              {/* =============================================================== */}
              {leadViewMode === 'list' && (
                <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <tr>
                          <th className="py-3.5 px-4">Lead #</th>
                          <th className="py-3.5 px-4">Client / Traveler</th>
                          <th className="py-3.5 px-4">Destination & Dates</th>
                          <th className="py-3.5 px-4">Party Size</th>
                          <th className="py-3.5 px-4">Est. Budget</th>
                          <th className="py-3.5 px-4">Status</th>
                          <th className="py-3.5 px-4">Linked Docs</th>
                          <th className="py-3.5 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {filteredLeads.map(lead => {
                          const isBooked = !!lead.bookingReference || lead.status === 'BOOKED';
                          const isQuoted = !!lead.quoteNumber || lead.status === 'QUOTED';

                          return (
                            <tr key={lead.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-3 px-4 font-mono font-bold text-slate-900">
                                {lead.leadNumber || 'LED-DIRECT'}
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-bold text-slate-900">{lead.contactName || 'Inquiring Traveler'}</div>
                                <div className="text-[10px] text-slate-400">{lead.email || lead.phone || 'Portal inquiry'}</div>
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-semibold text-slate-800 flex items-center gap-1">
                                  <MapPin className="w-3 h-3 text-[#00C6A6]" />
                                  <span>{lead.destinationName || 'Multi-Destination'}</span>
                                </div>
                                <div className="text-[10px] text-slate-400">{lead.travelDates || 'Flexible'}</div>
                              </td>
                              <td className="py-3 px-4 font-medium">
                                {lead.paxAdults || 2} Adults {lead.paxChildren ? `+ ${lead.paxChildren} Ch` : ''}
                              </td>
                              <td className="py-3 px-4 font-mono font-bold text-slate-900">
                                {lead.estimatedBudget ? `${lead.currency || 'USD'} ${Number(lead.estimatedBudget).toLocaleString()}` : '—'}
                              </td>
                              <td className="py-3 px-4">
                                {isBooked ? (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800">
                                    Booked
                                  </span>
                                ) : isQuoted ? (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-sky-100 text-sky-800">
                                    Quoted
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-800">
                                    Action Required
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 font-mono text-[11px]">
                                {lead.quoteNumber && <span className="text-sky-700 block">#{lead.quoteNumber}</span>}
                                {lead.bookingReference && <span className="text-emerald-700 block">#{lead.bookingReference}</span>}
                                {!lead.quoteNumber && !lead.bookingReference && <span className="text-slate-400">—</span>}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end space-x-1.5">
                                  <button
                                    onClick={() => {
                                      setSelectedLead(lead);
                                      setDetailTab('overview');
                                    }}
                                    className="px-2.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-950 hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer"
                                  >
                                    Details
                                  </button>
                                  <button
                                    onClick={() => onCreateQuoteFromLead(lead)}
                                    className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1"
                                  >
                                    <FileText className="w-3 h-3 text-[#00E5C0]" />
                                    <span>Quote</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* =============================================================== */}
              {/* LEAD VIEW 3: KANBAN BOARD                                      */}
              {/* =============================================================== */}
              {leadViewMode === 'kanban' && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
                  {kanbanStages.map(stage => {
                    const stageLeads = filteredLeads.filter(stage.match);
                    const stageValue = stageLeads.reduce((acc, l) => acc + Number(l.estimatedBudget || 0), 0);

                    return (
                      <div 
                        key={stage.id} 
                        className="bg-slate-50 border border-slate-200 rounded-3xl p-4 flex flex-col space-y-3 min-h-[500px]"
                      >
                        {/* Column Header */}
                        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                          <div>
                            <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                              <span>{stage.label}</span>
                              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${stage.badgeColor}`}>
                                {stageLeads.length}
                              </span>
                            </h4>
                            <span className="text-[10px] text-slate-400 font-mono">
                              ${stageValue.toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {/* Column Cards */}
                        <div className="space-y-3 flex-1 overflow-y-auto">
                          {stageLeads.length === 0 ? (
                            <div className="p-6 text-center text-slate-400 text-xs italic border border-dashed border-slate-200 rounded-2xl">
                              No leads in this stage
                            </div>
                          ) : (
                            stageLeads.map(lead => (
                              <div
                                key={lead.id}
                                onClick={() => {
                                  setSelectedLead(lead);
                                  setDetailTab('overview');
                                }}
                                className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-teal-400 shadow-xs hover:shadow-md transition-all cursor-pointer space-y-2.5 group"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-mono text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                    {lead.leadNumber || 'LED-DIRECT'}
                                  </span>
                                  {lead.destinationName && (
                                    <span className="text-[10px] text-slate-500 font-medium truncate max-w-[110px]">
                                      {lead.destinationName}
                                    </span>
                                  )}
                                </div>

                                <div>
                                  <h5 className="text-xs font-bold text-slate-900 group-hover:text-[#008f77] transition-colors line-clamp-1">
                                    {lead.contactName || 'Inquiring Traveler'}
                                  </h5>
                                  {lead.companyName && (
                                    <span className="text-[10px] text-slate-400 truncate block">
                                      {lead.companyName}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100">
                                  <span className="text-slate-400">
                                    {lead.paxAdults || 2} Adults
                                  </span>
                                  <span className="font-mono font-bold text-slate-800">
                                    {lead.estimatedBudget ? `${lead.currency || '$'}${Number(lead.estimatedBudget).toLocaleString()}` : ''}
                                  </span>
                                </div>

                                <div className="pt-2 flex items-center justify-between gap-1">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedLead(lead);
                                      setDetailTab('overview');
                                    }}
                                    className="text-[10px] text-slate-500 hover:text-slate-900 font-bold px-2 py-1 rounded bg-slate-50"
                                  >
                                    View
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onCreateQuoteFromLead(lead);
                                    }}
                                    className="text-[10px] text-white bg-slate-900 hover:bg-slate-800 font-bold px-2.5 py-1 rounded flex items-center space-x-1"
                                  >
                                    <FileText className="w-2.5 h-2.5 text-[#00E5C0]" />
                                    <span>Quote</span>
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. CLIENT DIRECTORY MODULE                                              */}
      {/* ========================================================================= */}
      {activeSubTab === 'clients' && (
        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search clients by name, email, company..."
                value={clientSearchQuery}
                onChange={(e) => setClientSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#00C6A6] transition-colors"
              />
            </div>

            <button
              onClick={() => {
                setEditingCustomer(null);
                setClientFormData({
                  name: '',
                  email: '',
                  phone: '',
                  company: '',
                  country: 'United Kingdom',
                  city: 'London',
                  preferredDestination: 'Japan',
                  budgetPerPersonUSD: 6000,
                  notes: ''
                });
                setIsAddClientModalOpen(true);
              }}
              className="px-4 py-2.5 bg-slate-950 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center shadow-xs shrink-0"
            >
              <span>Add New Client Profile</span>
            </button>
          </div>

          {filteredCustomers.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-4 shadow-xs">
              <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto border border-purple-100">
                <Users className="w-7 h-7" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-base font-bold text-slate-900">
                  {clientSearchQuery ? 'No matching clients found' : 'No Client Profiles Yet'}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {clientSearchQuery 
                    ? 'Try searching with different terms.' 
                    : 'Create direct profiles for your agency travelers to quickly assign them to quotes and track repeat bookings.'}
                </p>
              </div>
              <button
                onClick={() => setIsAddClientModalOpen(true)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Add First Client
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCustomers.map(customer => (
                <div
                  key={customer.id}
                  className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 font-black text-sm flex items-center justify-center border border-purple-100">
                        {customer.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => {
                            setEditingCustomer(customer);
                            setClientFormData({
                              name: customer.name,
                              email: customer.email,
                              phone: customer.phone || '',
                              company: customer.company || '',
                              country: customer.country || '',
                              city: customer.city || '',
                              preferredDestination: customer.preferredDestination || '',
                              budgetPerPersonUSD: customer.budgetPerPersonUSD || 5000,
                              notes: customer.notes || ''
                            });
                            setIsAddClientModalOpen(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteCustomer(customer.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-slate-950 line-clamp-1">{customer.name}</h3>
                      {customer.company && (
                        <p className="text-xs text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{customer.company}</span>
                        </p>
                      )}
                    </div>

                    <div className="space-y-1 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <a href={`mailto:${customer.email}`} className="flex items-center gap-1.5 hover:text-purple-700 truncate">
                        <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{customer.email}</span>
                      </a>
                      {customer.phone && (
                        <a href={`tel:${customer.phone}`} className="flex items-center gap-1.5 hover:text-purple-700">
                          <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{customer.phone}</span>
                        </a>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-[10px] text-slate-400 block uppercase font-bold">Preferred</span>
                        <span className="font-semibold text-slate-800 truncate block">
                          {customer.preferredDestination || 'Global'}
                        </span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-[10px] text-slate-400 block uppercase font-bold">Est. Budget</span>
                        <span className="font-mono font-bold text-slate-900 block">
                          ${Number(customer.budgetPerPersonUSD || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-400">
                      {customer.totalQuotesCount || 0} quotes • {customer.totalBookingsCount || 0} bookings
                    </span>
                    {onCreateQuoteForCustomer && (
                      <button
                        onClick={() => onCreateQuoteForCustomer(customer)}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1"
                      >
                        <FileText className="w-3 h-3 text-[#00E5C0]" />
                        <span>Create Quote</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. COMPREHENSIVE CRM DETAIL MODAL: 7 SECTIONS                            */}
      {/* ========================================================================= */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-100 w-full max-w-5xl md:max-w-6xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh] my-auto">
            {/* Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center space-x-2">
                <span className="font-mono text-xs font-black text-slate-900 bg-white border border-slate-200 px-2 py-0.5 rounded-md shadow-xs">
                  {selectedLead.leadNumber || 'LED-DIRECT'}
                </span>
                <span className="text-sm font-black text-slate-900">CRM Workspace: {selectedLead.contactName}</span>
              </div>
              <button
                onClick={() => setSelectedLead(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Split Main Body into 25/75 Grid Layout */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-100/50">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start h-full">

                {/* LEFT 25% COLUMN - Sticky Context/Navigation Panel */}
                <div className="lg:col-span-3 space-y-4 lg:sticky lg:top-0">
                  
                  {/* Lead Context Summary Card */}
                  <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3 text-xs">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Lead Context</span>
                    <div className="space-y-2">
                      <div>
                        <span className="text-slate-400 text-[10px] block">Client Name</span>
                        <span className="font-bold text-slate-800 text-sm block">{selectedLead.contactName}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">Company / Agency</span>
                        <span className="font-bold text-slate-800 block">{selectedLead.companyName || selectedLead.agencyName || 'Independent Guest'}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 mt-1">
                        <div>
                          <span className="text-slate-400 text-[9px] block">Destination</span>
                          <span className="font-semibold text-slate-800">{selectedLead.destinationName || 'Japan'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[9px] block">Budget Per Person</span>
                          <span className="font-semibold text-teal-600">${Number(selectedLead.estimatedBudget || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Contact Channels Card */}
                  <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2 text-xs">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Contact Channels</span>
                    <div className="space-y-1.5">
                      <a href={`mailto:${selectedLead.email}`} className="flex items-center gap-1.5 font-medium text-teal-600 hover:underline break-all">
                        <Mail className="w-3.5 h-3.5" />
                        {selectedLead.email || 'No email specified'}
                      </a>
                      <a href={`tel:${selectedLead.phone}`} className="flex items-center gap-1.5 font-medium text-slate-800 hover:underline">
                        <Phone className="w-3.5 h-3.5" />
                        {selectedLead.phone || 'No phone specified'}
                      </a>
                    </div>
                  </div>

                  {/* Section Navigation - Vertical Tabs */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                    <div className="p-3 bg-slate-50 border-b border-slate-200">
                      <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Sections</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {[
                        { id: 'overview', label: 'Lead & Client Profile', icon: Users },
                        { id: 'quotes', label: 'Assigned Quotes', icon: FileText },
                        { id: 'bookings', label: 'Bookings Converted', icon: BookmarkCheck },
                        { id: 'followups', label: 'Follow-ups', icon: Clock },
                        { id: 'communications', label: 'Communications', icon: MessageSquare },
                        { id: 'timeline', label: 'Activity Timeline', icon: History }
                      ].map(tab => {
                        const isActive = detailTab === tab.id;
                        const Icon = tab.icon;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setDetailTab(tab.id as any)}
                            className={`w-full px-4 py-3 text-left text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                              isActive
                                ? 'bg-slate-900 text-white shadow-inner'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                            }`}
                          >
                            <Icon className={`w-4 h-4 ${isActive ? 'text-[#00E5C0]' : 'text-slate-400'}`} />
                            <span>{tab.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                </div>

                {/* RIGHT 75% COLUMN - Dynamic Workspace Panel */}
                <div className="lg:col-span-9 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs min-h-[450px]">
                  {/* TAB 1: LEAD & CLIENT DETAILS */}
                  {detailTab === 'overview' && (
                <div className="space-y-4">
                  {/* Client Details Section */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2.5">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Client Contact Details
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <span className="text-slate-400 text-[10px] block">Client Name</span>
                        <span className="font-bold text-slate-900 text-sm">{selectedLead.contactName}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">Company / Agency</span>
                        <span className="font-bold text-slate-900">{selectedLead.companyName || selectedLead.agencyName || 'Independent Guest'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">Email</span>
                        <a href={`mailto:${selectedLead.email}`} className="font-medium text-[#008f77] hover:underline">
                          {selectedLead.email || 'Not specified'}
                        </a>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">Phone</span>
                        <a href={`tel:${selectedLead.phone}`} className="font-medium text-slate-900 hover:underline">
                          {selectedLead.phone || 'Not specified'}
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Lead Requirements Section */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2.5">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Travel Requirements & Budget
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
                        <span className="text-[10px] text-slate-400 block">Adults</span>
                        <span className="text-base font-bold text-slate-900">{selectedLead.paxAdults || 2}</span>
                      </div>
                      <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
                        <span className="text-[10px] text-slate-400 block">Children</span>
                        <span className="text-base font-bold text-slate-900">{selectedLead.paxChildren || 0}</span>
                      </div>
                      <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
                        <span className="text-[10px] text-slate-400 block">Estimated Budget</span>
                        <span className="text-base font-bold text-[#008f77]">
                          {selectedLead.currency || 'USD'} {Number(selectedLead.estimatedBudget || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div>
                        <span className="text-slate-400 text-[10px] block">Target Destination</span>
                        <span className="font-bold text-slate-900">{selectedLead.destinationName || 'Multi-Destination Tour'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">Travel Dates</span>
                        <span className="font-bold text-slate-900">{selectedLead.travelDates || selectedLead.travelStartDate || 'Flexible Dates'}</span>
                      </div>
                    </div>

                    {selectedLead.travelRequirements && (
                      <div className="pt-2 border-t border-slate-200 mt-2">
                        <span className="text-slate-400 text-[10px] block mb-1">Traveler Notes & Special Requests</span>
                        <p className="text-slate-700 bg-white p-3 rounded-xl border border-slate-200 leading-relaxed">
                          {selectedLead.travelRequirements}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: ASSIGNED QUOTES */}
              {detailTab === 'quotes' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">Linked Quotations</span>
                    <button
                      onClick={() => {
                        const leadToQuote = selectedLead;
                        setSelectedLead(null);
                        onCreateQuoteFromLead(leadToQuote);
                      }}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold flex items-center cursor-pointer"
                    >
                      <span>Create New Quote Version</span>
                    </button>
                  </div>

                  {selectedLead.quoteNumber ? (
                    <div className="p-4 rounded-2xl bg-teal-50/60 border border-teal-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-base text-slate-900">
                          Quote #{selectedLead.quoteNumber}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-teal-100 text-[#008f77]">
                          Active Proposal
                        </span>
                      </div>
                      <p className="text-slate-600 text-xs">
                        This quotation was generated directly for this lead inquiry.
                      </p>
                      <button
                        onClick={() => {
                          const leadToQuote = selectedLead;
                          setSelectedLead(null);
                          onCreateQuoteFromLead(leadToQuote);
                        }}
                        className="text-xs font-bold text-[#008f77] hover:underline cursor-pointer flex items-center space-x-1 pt-1"
                      >
                        <span>Open in Quote Builder</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-200">
                      No proposal created yet for this lead. Click "Create New Quote Version" above.
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: BOOKING REFERENCES */}
              {detailTab === 'bookings' && (
                <div className="space-y-4">
                  <span className="font-bold text-slate-900">Booking Confirmations</span>
                  {selectedLead.bookingReference ? (
                    <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-base text-emerald-950">
                          Booking #{selectedLead.bookingReference}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                          Confirmed Voucher
                        </span>
                      </div>
                      <p className="text-slate-600 text-xs">
                        This lead has converted into an authoritative operational booking voucher.
                      </p>
                      {onNavigateToBooking && (
                        <button
                          onClick={() => {
                            setSelectedLead(null);
                            onNavigateToBooking(selectedLead.bookingReference!);
                          }}
                          className="text-xs font-bold text-emerald-800 hover:underline cursor-pointer flex items-center space-x-1 pt-1"
                        >
                          <span>View in Bookings Management</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-200">
                      No booking has been confirmed yet. Proposals can be converted into bookings from My Quotes.
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: FOLLOW-UPS */}
              {detailTab === 'followups' && (
                <div className="space-y-4">
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                    <span className="font-bold text-slate-900 block">Schedule a Follow-up</span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Action item (e.g. Call traveler to review itinerary revisions)..."
                        value={newFollowUpNote}
                        onChange={(e) => setNewFollowUpNote(e.target.value)}
                        className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"
                      />
                      <input
                        type="date"
                        value={newFollowUpDate}
                        onChange={(e) => setNewFollowUpDate(e.target.value)}
                        className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"
                      />
                      <button
                        onClick={handleAddFollowUp}
                        className="px-3 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {(selectedLead.followUps || []).length === 0 ? (
                      <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-2xl">
                        No pending follow-ups scheduled.
                      </div>
                    ) : (
                      selectedLead.followUps?.map((flw, i) => (
                        <div key={flw.id || i} className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
                          <div className="space-y-0.5">
                            <p className="font-bold text-slate-900">{flw.note}</p>
                            <span className="text-[10px] text-slate-400">Due: {flw.dueDate}</span>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                            Pending
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 5: COMMUNICATIONS HISTORY */}
              {detailTab === 'communications' && (
                <div className="space-y-4">
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                    <span className="font-bold text-slate-900 block">Log Client Communication</span>
                    <div className="flex gap-2">
                      <select
                        value={newCommType}
                        onChange={(e) => setNewCommType(e.target.value as any)}
                        className="px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                      >
                        <option value="NOTE">General Note</option>
                        <option value="CALL">Phone Call</option>
                        <option value="EMAIL">Email Sent</option>
                        <option value="WHATSAPP">WhatsApp</option>
                      </select>
                      <input
                        type="text"
                        placeholder="Log message or client notes..."
                        value={newCommNote}
                        onChange={(e) => setNewCommNote(e.target.value)}
                        className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"
                      />
                      <button
                        onClick={handleAddCommunication}
                        className="px-3 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 cursor-pointer"
                      >
                        Log
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {(!selectedLead.notes || selectedLead.notes.length === 0) ? (
                      <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-2xl">
                        No communication history logged yet.
                      </div>
                    ) : (
                      selectedLead.notes.map(note => (
                        <div key={note.id} className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span className="font-bold text-slate-700">{note.authorName || 'Agent'}</span>
                            <span>{new Date(note.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="text-slate-800 text-xs">{note.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 6: ACTIVITY TIMELINE */}
              {detailTab === 'timeline' && (
                <div className="space-y-3">
                  <span className="font-bold text-slate-900 block">Audit & Activity Log</span>
                  <div className="border-l-2 border-slate-200 pl-4 space-y-4 ml-2">
                    <div className="relative">
                      <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-[#00C6A6]" />
                      <p className="font-bold text-slate-900">Lead Assigned to Agency</p>
                      <p className="text-[10px] text-slate-400">
                        Assigned by {selectedLead.assignedByUserNameSnapshot || 'Central Operations'}
                        {selectedLead.assignedAt && ` on ${new Date(selectedLead.assignedAt).toLocaleString()}`}
                      </p>
                    </div>

                    {selectedLead.quoteNumber && (
                      <div className="relative">
                        <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-sky-500" />
                        <p className="font-bold text-slate-900">Proposal Created: #{selectedLead.quoteNumber}</p>
                        <p className="text-[10px] text-slate-400">Active quotation available for client review</p>
                      </div>
                    )}

                    {selectedLead.bookingReference && (
                      <div className="relative">
                        <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        <p className="font-bold text-slate-900">Booking Confirmed: #{selectedLead.bookingReference}</p>
                        <p className="text-[10px] text-slate-400">Voucher confirmed by operational desk</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div> {/* End lg:col-span-9 */}
          </div> {/* End grid */}
        </div> {/* End flex-1 overflow-y-auto */}

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 flex items-center justify-between gap-2 bg-white shrink-0">
              <button
                type="button"
                onClick={() => setSelectedLead(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-bold cursor-pointer"
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

      {/* ========================================================================= */}
      {/* 7. ADD / EDIT CLIENT PROFILE MODAL                                      */}
      {/* ========================================================================= */}
      {isAddClientModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh] my-auto">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
              <h3 className="font-black text-sm text-slate-900">
                {editingCustomer ? 'Edit Client Profile' : 'Add New Client to CRM'}
              </h3>
              <button
                onClick={() => {
                  setIsAddClientModalOpen(false);
                  setEditingCustomer(null);
                }}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={clientFormData.name}
                    onChange={(e) => setClientFormData({ ...clientFormData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900"
                    placeholder="e.g. Lord Alexander Wright"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={clientFormData.email}
                    onChange={(e) => setClientFormData({ ...clientFormData, email: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900"
                    placeholder="client@luxurytravel.com"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={clientFormData.phone}
                    onChange={(e) => setClientFormData({ ...clientFormData, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900"
                    placeholder="+44 20 7946 0912"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Company / Organization</label>
                  <input
                    type="text"
                    value={clientFormData.company}
                    onChange={(e) => setClientFormData({ ...clientFormData, company: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900"
                    placeholder="Private Client / Bespoke Club"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Country</label>
                  <input
                    type="text"
                    value={clientFormData.country}
                    onChange={(e) => setClientFormData({ ...clientFormData, country: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Preferred Destination</label>
                  <input
                    type="text"
                    value={clientFormData.preferredDestination}
                    onChange={(e) => setClientFormData({ ...clientFormData, preferredDestination: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900"
                    placeholder="e.g. Japan, Maldives"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Est. Budget per Person ($)</label>
                  <input
                    type="number"
                    value={clientFormData.budgetPerPersonUSD}
                    onChange={(e) => setClientFormData({ ...clientFormData, budgetPerPersonUSD: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddClientModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-950 text-white rounded-xl font-bold hover:bg-slate-800 cursor-pointer"
                >
                  {editingCustomer ? 'Update Client' : 'Save Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
