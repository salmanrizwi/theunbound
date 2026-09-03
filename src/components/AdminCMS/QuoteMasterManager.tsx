import React, { useState, useEffect, useMemo } from 'react';
import { Quotation, QuoteStatus, TravelLead } from '../../types';
import { AppDatabase } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../services/pricingEngine';
import { downloadQuotationPDF } from '../../services/pdfGenerator';
import { googleCalendarAutomation } from '../../services/googleCalendarAutomationService';
import { 
  FileSpreadsheet, 
  Search, 
  Filter, 
  ShieldCheck, 
  Lock, 
  Eye, 
  Trash2, 
  Download, 
  Calendar, 
  User as UserIcon, 
  DollarSign, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  FileText,
  Copy,
  Tag,
  Check,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  Building,
  Users,
  Sparkles,
  Layers,
  Link2,
  PlusCircle,
  TrendingUp,
  X,
  Compass,
  Briefcase,
  MessageCircle
} from 'lucide-react';
import { ShareWhatsAppModal } from '../B2BAgentPortal/ShareWhatsAppModal';

interface QuoteMasterManagerProps {
  onLoadQuote?: (quote: Quotation) => void;
  onNavigateToLeads?: (leadId?: string) => void;
}

export const QuoteMasterManager: React.FC<QuoteMasterManagerProps> = ({ 
  onLoadQuote,
  onNavigateToLeads 
}) => {
  const db = AppDatabase.getInstance();
  const { user, role } = useAuth();
  
  const [quotes, setQuotes] = useState<Quotation[]>(() => db.getQuotesForUser(user));
  const [allLeads, setAllLeads] = useState<TravelLead[]>(() => db.getLeadsAuthorized(user));
  
  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterUserType, setFilterUserType] = useState<string>('ALL');
  const [filterCreator, setFilterCreator] = useState<string>('ALL');
  const [filterLeadLink, setFilterLeadLink] = useState<string>('ALL');
  const [filterDestination, setFilterDestination] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'NEWEST' | 'OLDEST' | 'PRICE_HIGH' | 'MARGIN_HIGH'>('NEWEST');

  // Modals & Drawers
  const [viewingQuote, setViewingQuote] = useState<Quotation | null>(null);
  const [leadLinkModalQuote, setLeadLinkModalQuote] = useState<Quotation | null>(null);
  const [selectedLeadIdToLink, setSelectedLeadIdToLink] = useState<string>('');
  const [customLeadIdInput, setCustomLeadIdInput] = useState<string>('');
  const [whatsAppSharingQuote, setWhatsAppSharingQuote] = useState<Quotation | null>(null);
  
  // Feedback
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');
  const [actionErrorMsg, setActionErrorMsg] = useState('');

  const isB2BAgent = role === 'B2B_AGENT';
  const isAdminOrStaff = role === 'ADMIN' || role === 'TEAM_MEMBER' || role === 'DMC_STAFF';

  useEffect(() => {
    return db.subscribe(() => {
      setQuotes(db.getQuotesForUser(user));
      setAllLeads(db.getLeadsAuthorized(user));
    });
  }, [db, user]);

  const refresh = () => {
    setQuotes(db.getQuotesForUser(user));
    setAllLeads(db.getLeadsAuthorized(user));
  };

  const showSuccess = (msg: string) => {
    setActionSuccessMsg(msg);
    setActionErrorMsg('');
    setTimeout(() => setActionSuccessMsg(''), 4000);
  };

  const showError = (msg: string) => {
    setActionErrorMsg(msg);
    setActionSuccessMsg('');
    setTimeout(() => setActionErrorMsg(''), 4000);
  };

  // 1. Status Changes
  const handleStatusChange = (quoteId: string, status: QuoteStatus) => {
    const q = db.getQuoteByIdAuthorized(quoteId, user);
    if (q) {
      db.updateQuotationStatus(quoteId, status, user);
      refresh();
      showSuccess(`Quote #${q.quoteNumber} status updated to ${status}`);
    }
  };

  // 2. Deletion
  const handleDelete = (quoteId: string) => {
    const q = db.getQuoteByIdAuthorized(quoteId, user);
    if (q?.isLocked && isB2BAgent) {
      showError('Locked quotations cannot be deleted.');
      return;
    }
    if (confirm('Are you sure you want to delete this quotation master record?')) {
      db.deleteQuote(quoteId, user);
      refresh();
      if (viewingQuote?.id === quoteId) setViewingQuote(null);
      showSuccess('Quotation record removed from database.');
    }
  };

  // 3. New Version Branching
  const handleCreateNewVersion = (quoteId: string) => {
    const newQuote = db.createQuotationVersion(quoteId, user);
    if (newQuote) {
      showSuccess(`Created new draft version v${newQuote.version || 2} of quote #${newQuote.quoteNumber}`);
      refresh();
      if (onLoadQuote) {
        onLoadQuote(newQuote);
      }
    }
  };

  // 4. Download PDF
  const handleDownloadPDF = (q: Quotation) => {
    downloadQuotationPDF({
      quote: q,
      agentName: q.agentName || q.createdByName || user?.name,
      agentAgency: q.agentAgency || q.agentCompany || user?.agencyName || user?.companyName,
      agentLogoUrl: q.agentLogoUrl || user?.brandLogoUrl || user?.logoUrl,
      leadId: q.leadId
    });

    try {
      googleCalendarAutomation.triggerQuoteFollowUpSLA(q, user);
    } catch (err) {
      console.debug('Quote follow-up SLA trigger note:', err);
    }
    showSuccess(`Branded quotation proposal PDF generated for #${q.quoteNumber}`);
  };

  // 5. Convert to CRM Lead (1-Click Lead Creation from Quote)
  const handleCreateLeadFromQuote = (q: Quotation) => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const newLeadNumber = `LED-2026-${randomNum}`;
    const timestamp = new Date().toISOString();

    const createdLead: TravelLead = {
      id: `lead-${Date.now()}-${randomNum}`,
      leadNumber: newLeadNumber,
      contactName: q.clientName || 'Valued Traveler',
      email: q.clientEmail || (q.agentEmail || 'lead@example.com'),
      phone: q.clientPhone || q.agentPhone || '+1 (555) 019-2834',
      agencyName: q.agentAgency || q.agentCompany || (q.createdByUserType === 'B2B_AGENT' ? q.createdByName : undefined),
      userId: q.createdBy || user?.id,
      userType: (q.createdByUserType === 'B2B_AGENT' ? 'B2B_AGENT' : 'DMC_STAFF') as any,
      source: 'QUOTATION_SAVED',
      status: 'PROPOSAL_SAVED',
      priority: q.totalSellingPrice > 15000 ? 'URGENT' : 'HIGH',
      conversionStatus: 'IN_PROGRESS',
      assignedStaffId: user?.id || 'staff-01',
      assignedStaffName: user?.name || 'Marcus Vance (Senior Ops)',
      destinationId: (q.destination || 'japan').toLowerCase().replace(/\s+/g, '-'),
      destinationName: q.destination || 'Japan',
      estimatedBudget: q.totalSellingPrice || 0,
      currency: (q.currency || 'USD') as any,
      travelDates: `${q.travelStartDate || '2026-10-01'} to ${q.travelEndDate || '2026-10-08'}`,
      travelStartDate: q.travelStartDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      travelEndDate: q.travelEndDate || new Date(Date.now() + 37 * 86400000).toISOString().split('T')[0],
      paxAdults: q.adultsCount || q.totalPax || 2,
      paxChildren: q.childrenCount || 0,
      paxInfants: q.infantsCount || 0,
      totalPassengers: q.totalPax || (q.adultsCount ? (q.adultsCount + (q.childrenCount || 0)) : 2),
      travelRequirements: `Tailored itinerary for ${q.destination || 'Luxury Destination'} with ${q.items?.length || 0} scheduled services. Total proposal value ${q.currency || 'USD'} ${(q.totalSellingPrice || 0).toLocaleString()}.`,
      quoteId: q.id,
      quoteNumber: q.quoteNumber,
      quoteSnapshot: {
        quoteId: q.id,
        quoteNumber: q.quoteNumber,
        version: q.version || 1,
        quoteDate: timestamp,
        totalNetCost: q.totalNetCost || 0,
        marginPercent: q.overallMarkupPercent || 15,
        marginAmount: q.totalMargin || 0,
        taxAmount: q.totalTaxes || 0,
        feesAmount: 0,
        finalSellingPrice: q.totalSellingPrice || 0,
        currency: (q.currency || 'USD') as any,
        status: q.status || 'DRAFT',
        itemsCount: q.items?.length || 0
      },
      notes: [
        {
          id: `note-${Date.now()}`,
          authorId: user?.id || 'sys-01',
          authorName: user?.name || 'System CRM',
          authorRole: user?.role || 'ADMIN',
          text: `Auto-generated CRM lead from Quotation Master Record #${q.quoteNumber} (${q.title}). Gross Value: ${q.currency} ${(q.totalSellingPrice || 0).toLocaleString()}.`,
          timestamp
        }
      ],
      timeline: [
        {
          id: `tl-${Date.now()}`,
          type: 'CUSTOM_ACTIVITY',
          title: 'Quotation Master Lead Initialized',
          description: `Lead profile created with linked quote #${q.quoteNumber}`,
          timestamp,
          performedBy: user?.name || 'System Lead Engine',
          performedByUserType: user?.role || 'ADMIN'
        }
      ],
      createdAt: timestamp,
      updatedAt: timestamp,
      lastActivityAt: timestamp,
      lastActivitySummary: `Linked to active quotation #${q.quoteNumber}`
    };

    db.saveLead(createdLead, user);
    db.updateQuotationLeadId(q.id, newLeadNumber, user);
    refresh();
    setLeadLinkModalQuote(null);
    showSuccess(`Successfully converted quote #${q.quoteNumber} into CRM Lead ${newLeadNumber}!`);
  };

  // 6. Link to Existing Lead
  const handleLinkToExistingLead = (quoteId: string, leadNumber: string) => {
    if (!leadNumber.trim()) {
      showError('Please select or provide a valid Lead ID.');
      return;
    }
    const cleanLeadNum = leadNumber.trim();
    db.updateQuotationLeadId(quoteId, cleanLeadNum, user);
    
    // Also cross-link on the lead record if found
    const leads = db.getLeads();
    const targetLead = leads.find(l => l.leadNumber === cleanLeadNum || l.id === cleanLeadNum);
    if (targetLead) {
      const q = db.getQuoteByIdAuthorized(quoteId, user);
      if (q) {
        targetLead.quoteId = q.id;
        targetLead.quoteNumber = q.quoteNumber;
        targetLead.quoteSnapshot = {
          quoteId: q.id,
          quoteNumber: q.quoteNumber,
          version: q.version || 1,
          quoteDate: new Date().toISOString(),
          totalNetCost: q.totalNetCost || 0,
          marginPercent: q.overallMarkupPercent || 15,
          marginAmount: q.totalMargin || 0,
          taxAmount: q.totalTaxes || 0,
          feesAmount: 0,
          finalSellingPrice: q.totalSellingPrice || 0,
          currency: (q.currency || 'USD') as any,
          status: q.status || 'DRAFT',
          itemsCount: q.items?.length || 0
        };
        targetLead.updatedAt = new Date().toISOString();
        db.saveLead(targetLead, user);
      }
    }

    refresh();
    setLeadLinkModalQuote(null);
    showSuccess(`Linked quote to CRM Lead ${cleanLeadNum}`);
  };

  // 7. Convert Quote to Ground Booking
  const handleConvertToBooking = (q: Quotation) => {
    if (confirm(`Convert quote #${q.quoteNumber} into a live ground booking reservation?`)) {
      try {
        const bookingDraft = db.createBooking({
          sourceType: 'QUOTATION',
          quoteId: q.id,
          quoteNumber: q.quoteNumber,
          destinationName: q.destination,
          customer: {
            leadTravelerName: q.clientName || 'Valued Traveler',
            email: q.clientEmail || q.agentEmail || 'booking@example.com',
            phone: q.clientPhone || q.agentPhone || '+1-555-0199',
            agencyName: q.agentAgency || q.agentCompany,
            agentRefNumber: q.leadId || q.quoteNumber,
            totalAdults: q.adultsCount || q.totalPax || 2,
            totalChildren: q.childrenCount || 0,
            totalInfants: q.infantsCount || 0
          },
          items: (q.items || []).map((item, idx) => ({
            id: `bk-item-${Date.now()}-${idx}`,
            productId: item.product?.id || `prod-${idx}`,
            productName: item.product?.name || `Tour Service ${idx + 1}`,
            productSku: item.product?.sku || `SKU-${idx + 100}`,
            destinationName: q.destination || 'Japan',
            city: item.product?.city || 'Tokyo',
            category: item.product?.category || 'ACTIVITY',
            travelDate: item.travelDate || q.travelStartDate || new Date().toISOString().split('T')[0],
            adults: q.adultsCount || q.totalPax || 2,
            children: q.childrenCount || 0,
            infants: q.infantsCount || 0,
            totalPax: q.totalPax || 2,
            unitNetPrice: item.calculation?.totalNetCost ? (item.calculation.totalNetCost / (q.totalPax || 1)) : 100,
            unitSellingPrice: item.calculation?.finalTotalSellingPrice ? (item.calculation.finalTotalSellingPrice / (q.totalPax || 1)) : 120,
            totalPrice: item.calculation?.finalTotalSellingPrice || 120,
            currency: (q.currency || 'USD') as any,
            supplierStatus: 'PENDING_DISPATCH'
          })),
          currency: (q.currency || 'USD') as any,
          totalAmount: q.totalSellingPrice || 0,
          totalNetCost: q.totalNetCost || 0,
          travelStartDate: q.travelStartDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
          travelEndDate: q.travelEndDate || new Date(Date.now() + 21 * 86400000).toISOString().split('T')[0]
        }, user);

        // Update quote status to ACCEPTED
        db.updateQuotationStatus(q.id, 'ACCEPTED', user);
        refresh();
        showSuccess(`Created Ground Booking #${bookingDraft.bookingReference} from Quote #${q.quoteNumber}!`);
      } catch (err: any) {
        showError(`Booking conversion failed: ${err.message || 'Unknown error'}`);
      }
    }
  };

  // Extract distinct lists for filtering
  const distinctCreators = useMemo(() => {
    const map = new Map<string, { id: string; name: string; role?: string; agency?: string }>();
    quotes.forEach(q => {
      const id = q.createdBy || q.agentId || 'unknown';
      const name = q.createdByName || q.agentName || 'Anonymous Agent';
      const role = q.createdByUserType || 'B2B_AGENT';
      const agency = q.agentAgency || q.agentCompany;
      if (!map.has(id)) {
        map.set(id, { id, name, role, agency });
      }
    });
    return Array.from(map.values());
  }, [quotes]);

  const distinctDestinations = useMemo(() => {
    const set = new Set<string>();
    quotes.forEach(q => {
      if (q.destination) set.add(q.destination);
    });
    return Array.from(set);
  }, [quotes]);

  // Aggregate Metrics Calculations across quotes
  const metrics = useMemo(() => {
    const totalCount = quotes.length;
    const totalPipelineGross = quotes.reduce((acc, q) => acc + (q.totalSellingPrice || 0), 0);
    const totalNetCost = quotes.reduce((acc, q) => acc + (q.totalNetCost || 0), 0);
    const totalMargin = quotes.reduce((acc, q) => acc + (q.totalMargin || 0), 0);
    const avgMarginPercent = totalPipelineGross > 0 ? ((totalMargin / totalPipelineGross) * 100) : 0;
    const linkedToLeadCount = quotes.filter(q => !!q.leadId).length;
    const acceptedCount = quotes.filter(q => q.status === 'ACCEPTED').length;
    const issuedCount = quotes.filter(q => q.status === 'ISSUED').length;
    const draftCount = quotes.filter(q => q.status === 'DRAFT').length;

    return {
      totalCount,
      totalPipelineGross,
      totalNetCost,
      totalMargin,
      avgMarginPercent,
      linkedToLeadCount,
      acceptedCount,
      issuedCount,
      draftCount,
      activeAgentsCount: distinctCreators.length
    };
  }, [quotes, distinctCreators]);

  // Filtering & Sorting Logic
  const filteredQuotes = useMemo(() => {
    const qClean = searchQuery.toLowerCase().trim();

    return quotes.filter(q => {
      // 1. Text Search
      const matchesSearch = !qClean || 
        q.quoteNumber.toLowerCase().includes(qClean) ||
        q.title.toLowerCase().includes(qClean) ||
        q.clientName.toLowerCase().includes(qClean) ||
        (q.clientEmail && q.clientEmail.toLowerCase().includes(qClean)) ||
        (q.destination && q.destination.toLowerCase().includes(qClean)) ||
        (q.leadId && q.leadId.toLowerCase().includes(qClean)) ||
        (q.agentName && q.agentName.toLowerCase().includes(qClean)) ||
        (q.createdByName && q.createdByName.toLowerCase().includes(qClean)) ||
        (q.agentAgency && q.agentAgency.toLowerCase().includes(qClean)) ||
        (q.agentCompany && q.agentCompany.toLowerCase().includes(qClean));

      // 2. Status Filter
      const matchesStatus = filterStatus === 'ALL' || q.status === filterStatus;

      // 3. User Type Filter
      const userType = q.createdByUserType || (q.agentAgency ? 'B2B_AGENT' : 'ADMIN');
      const matchesUserType = filterUserType === 'ALL' || userType === filterUserType;

      // 4. Specific Creator Filter
      const creatorId = q.createdBy || q.agentId;
      const matchesCreator = filterCreator === 'ALL' || creatorId === filterCreator;

      // 5. Lead Association Filter
      const matchesLeadLink = 
        filterLeadLink === 'ALL' ? true :
        filterLeadLink === 'LINKED' ? !!q.leadId :
        !q.leadId;

      // 6. Destination Filter
      const matchesDestination = filterDestination === 'ALL' || q.destination === filterDestination;

      return matchesSearch && matchesStatus && matchesUserType && matchesCreator && matchesLeadLink && matchesDestination;
    }).sort((a, b) => {
      if (sortBy === 'NEWEST') {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }
      if (sortBy === 'OLDEST') {
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      }
      if (sortBy === 'PRICE_HIGH') {
        return (b.totalSellingPrice || 0) - (a.totalSellingPrice || 0);
      }
      if (sortBy === 'MARGIN_HIGH') {
        return (b.totalMargin || 0) - (a.totalMargin || 0);
      }
      return 0;
    });
  }, [quotes, searchQuery, filterStatus, filterUserType, filterCreator, filterLeadLink, filterDestination, sortBy]);

  return (
    <div className="space-y-6">
      
      {/* 1. Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-[#008972] text-xs font-bold uppercase tracking-wider">
            <FileSpreadsheet className="w-4 h-4 text-[#00C6A6]" />
            <span>Lead Management & Sales Intelligence</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Quotation Master Records
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-2xl">
            Live centralized ledger logging all client proposals created by B2B travel agents, sales staff, and travelers. Track wholesale margins, attach to CRM leads, and issue luxury dispatches.
          </p>
        </div>

        {/* Action Badges & Info */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="bg-slate-900 text-slate-200 px-4 py-2 rounded-2xl text-xs border border-slate-800 flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-[#00E5C0]" />
            <div>
              <span className="text-[10px] text-slate-400 block font-mono">ROLE-BASED AUTHORIZATION</span>
              <span className="font-bold text-[#00E5C0]">
                {isAdminOrStaff ? 'Multi-User Audit View' : 'Isolated Agent Ledger'}
              </span>
            </div>
          </div>

          <button
            onClick={refresh}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
            title="Refresh Quotes"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Notification Alerts */}
      {actionSuccessMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center space-x-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccessMsg}</span>
          </div>
          <button onClick={() => setActionSuccessMsg('')} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {actionErrorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center space-x-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{actionErrorMsg}</span>
          </div>
          <button onClick={() => setActionErrorMsg('')} className="text-rose-700 hover:text-rose-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3. KPI Analytics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        
        {/* Total Quotes Card */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Quotes</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
              {metrics.totalCount}
            </div>
            <div className="text-[10px] text-slate-500 font-medium mt-0.5 flex items-center space-x-1">
              <span className="text-blue-600 font-bold">{metrics.issuedCount} Issued</span>
              <span>•</span>
              <span className="text-emerald-600 font-bold">{metrics.acceptedCount} Won</span>
            </div>
          </div>
        </div>

        {/* Pipeline Gross Value Card */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pipeline Value</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-black text-[#008972] font-mono">
              ${Math.round(metrics.totalPipelineGross).toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-500 font-medium mt-0.5">
              Net Cost: ${Math.round(metrics.totalNetCost).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Margin Yield Card */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Avg Margin</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-black text-purple-700 font-mono">
              {metrics.avgMarginPercent.toFixed(1)}%
            </div>
            <div className="text-[10px] text-purple-600 font-bold mt-0.5">
              +${Math.round(metrics.totalMargin).toLocaleString()} Gross Margin
            </div>
          </div>
        </div>

        {/* CRM Lead Linkage Card */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">CRM Lead Linkage</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Link2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
              {metrics.linkedToLeadCount} <span className="text-xs text-slate-400 font-normal">/ {metrics.totalCount}</span>
            </div>
            <div className="text-[10px] text-amber-700 font-bold mt-0.5">
              {metrics.totalCount > 0 ? Math.round((metrics.linkedToLeadCount / metrics.totalCount) * 100) : 0}% attached to CRM
            </div>
          </div>
        </div>

        {/* Active Agents / Creators Card */}
        <div className="col-span-2 sm:col-span-1 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Active Creators</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
              {metrics.activeAgentsCount}
            </div>
            <div className="text-[10px] text-slate-500 font-medium mt-0.5">
              B2B Agencies & Ops Leads
            </div>
          </div>
        </div>
      </div>

      {/* 4. Multi-Dimensional Search & Filtering Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        {/* Search Bar Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by quote #, client name, email, agent, agency, lead ID, or destination..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#00C6A6] focus:bg-white transition-all placeholder:text-slate-400"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-[#00C6A6] cursor-pointer"
            >
              <option value="NEWEST">Sort: Newest First</option>
              <option value="OLDEST">Sort: Oldest First</option>
              <option value="PRICE_HIGH">Sort: Highest Value</option>
              <option value="MARGIN_HIGH">Sort: Highest Margin</option>
            </select>
          </div>
        </div>

        {/* Filter Dropdowns Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 pt-2 border-t border-slate-100 text-xs">
          
          {/* Status Filter */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Quote Status
            </label>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="w-full py-2 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs font-semibold focus:outline-none focus:border-[#00C6A6]"
            >
              <option value="ALL">All Statuses ({quotes.length})</option>
              <option value="DRAFT">Draft</option>
              <option value="ISSUED">Issued / Sent</option>
              <option value="ACCEPTED">Accepted / Won</option>
              <option value="EXPIRED">Expired</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>

          {/* User Type / Creator Role Filter */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Creator Role
            </label>
            <select
              value={filterUserType}
              onChange={e => setFilterUserType(e.target.value)}
              className="w-full py-2 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs font-semibold focus:outline-none focus:border-[#00C6A6]"
            >
              <option value="ALL">All Creator Types</option>
              <option value="B2B_AGENT">B2B Travel Agents</option>
              <option value="DMC_STAFF">DMC Ops & Staff</option>
              <option value="ADMIN">Administrators</option>
              <option value="BUYER">Direct Travelers / Buyers</option>
            </select>
          </div>

          {/* Specific Creator Filter */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Specific Creator
            </label>
            <select
              value={filterCreator}
              onChange={e => setFilterCreator(e.target.value)}
              className="w-full py-2 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs font-semibold focus:outline-none focus:border-[#00C6A6]"
            >
              <option value="ALL">All Creators ({distinctCreators.length})</option>
              {distinctCreators.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.agency ? `(${c.agency})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* CRM Lead Linkage Filter */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              CRM Lead Link
            </label>
            <select
              value={filterLeadLink}
              onChange={e => setFilterLeadLink(e.target.value)}
              className="w-full py-2 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs font-semibold focus:outline-none focus:border-[#00C6A6]"
            >
              <option value="ALL">All Quotes</option>
              <option value="LINKED">Linked to CRM Lead</option>
              <option value="UNLINKED">Unlinked / Standalone</option>
            </select>
          </div>

          {/* Destination Filter */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Destination
            </label>
            <select
              value={filterDestination}
              onChange={e => setFilterDestination(e.target.value)}
              className="w-full py-2 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs font-semibold focus:outline-none focus:border-[#00C6A6]"
            >
              <option value="ALL">All Destinations ({distinctDestinations.length})</option>
              {distinctDestinations.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

        </div>

        {/* Active Filter Chips & Reset */}
        {(filterStatus !== 'ALL' || filterUserType !== 'ALL' || filterCreator !== 'ALL' || filterLeadLink !== 'ALL' || filterDestination !== 'ALL' || searchQuery) && (
          <div className="flex items-center justify-between pt-2 text-xs border-t border-slate-100">
            <span className="text-slate-500 font-medium">
              Showing <strong>{filteredQuotes.length}</strong> of {quotes.length} quotation records
            </span>
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterStatus('ALL');
                setFilterUserType('ALL');
                setFilterCreator('ALL');
                setFilterLeadLink('ALL');
                setFilterDestination('ALL');
              }}
              className="text-[#008972] hover:text-[#005f4f] font-bold flex items-center space-x-1 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reset All Filters</span>
            </button>
          </div>
        )}
      </div>

      {/* 5. Master Quotation Records Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3.5 px-4">Quote # & Itinerary</th>
                <th className="py-3.5 px-4">Created By & Agency</th>
                <th className="py-3.5 px-4">Client & Travelers</th>
                <th className="py-3.5 px-4">CRM Lead Link</th>
                <th className="py-3.5 px-4">Gross Selling</th>
                <th className="py-3.5 px-4">Net / Margin</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredQuotes.map(q => {
                const creatorName = q.createdByName || q.agentName || 'Ops Team';
                const creatorRole = q.createdByUserType || (q.agentAgency ? 'B2B_AGENT' : 'ADMIN');
                const agencyName = q.agentAgency || q.agentCompany;
                const marginPercent = q.totalSellingPrice > 0 ? Math.round(((q.totalMargin || 0) / q.totalSellingPrice) * 100) : 0;

                return (
                  <tr 
                    key={q.id} 
                    className={`hover:bg-slate-50/80 transition-colors ${q.isLocked ? 'bg-slate-50/40' : ''}`}
                  >
                    
                    {/* 1. Quote # & Itinerary */}
                    <td className="py-4 px-4 min-w-[200px]">
                      <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                        <span className="font-mono text-[11px] bg-slate-900 text-[#00E5C0] px-2 py-0.5 rounded-md font-bold tracking-tight shadow-2xs">
                          {q.quoteNumber}
                        </span>
                        {q.version && (
                          <span className="text-[10px] font-bold bg-[#00C6A6]/20 text-[#008972] px-1.5 py-0.5 rounded">
                            v{q.version}
                          </span>
                        )}
                        {q.isLocked && (
                          <span className="inline-flex items-center space-x-0.5 text-[9px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded" title="Locked snapshot version">
                            <Lock className="w-2.5 h-2.5" />
                            <span>Locked</span>
                          </span>
                        )}
                      </div>
                      <div className="font-extrabold text-slate-900 text-xs mt-1.5 leading-snug line-clamp-1">
                        {q.title}
                      </div>
                      <div className="flex items-center space-x-2 text-[10px] text-slate-400 mt-0.5">
                        <span className="flex items-center space-x-1">
                          <Compass className="w-3 h-3 text-[#00C6A6]" />
                          <span>{q.destination || 'Multi-Destination'}</span>
                        </span>
                        <span>•</span>
                        <span>{q.items?.length || 0} services</span>
                      </div>
                    </td>

                    {/* 2. Created By & Agency Attribution */}
                    <td className="py-4 px-4 min-w-[170px]">
                      <div className="flex items-center space-x-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                          creatorRole === 'B2B_AGENT' 
                            ? 'bg-purple-100 text-purple-700' 
                            : creatorRole === 'BUYER'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {creatorName.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 text-xs truncate">
                            {creatorName}
                          </div>
                          {agencyName ? (
                            <div className="text-[10px] font-semibold text-purple-700 truncate flex items-center space-x-1">
                              <Building className="w-2.5 h-2.5 shrink-0" />
                              <span className="truncate">{agencyName}</span>
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-400">
                              {creatorRole === 'ADMIN' ? 'Headquarters Admin' : 'Internal Ops Staff'}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* 3. Client & Travelers */}
                    <td className="py-4 px-4 min-w-[160px]">
                      <div className="font-bold text-slate-900 text-xs">
                        {q.clientName || 'Valued Client'}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate max-w-[150px]">
                        {q.clientEmail || 'No email provided'}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {q.totalPax ? `${q.totalPax} Travelers` : 'Standard Pax'}
                      </div>
                    </td>

                    {/* 4. CRM Lead Link */}
                    <td className="py-4 px-4 min-w-[140px]">
                      {q.leadId ? (
                        <div className="space-y-1">
                          <div className="inline-flex items-center space-x-1 font-mono text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-lg font-bold">
                            <Tag className="w-3 h-3" />
                            <span>{q.leadId}</span>
                          </div>
                          {onNavigateToLeads && (
                            <div>
                              <button
                                onClick={() => onNavigateToLeads(q.leadId)}
                                className="text-[10px] text-[#008972] hover:text-[#005f4f] font-bold flex items-center space-x-1 cursor-pointer"
                              >
                                <span>View in CRM</span>
                                <ArrowRight className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-400 italic block">Unlinked</span>
                          <button
                            onClick={() => {
                              setLeadLinkModalQuote(q);
                              setSelectedLeadIdToLink('');
                              setCustomLeadIdInput('');
                            }}
                            className="inline-flex items-center space-x-1 text-[10px] font-bold text-[#008972] hover:text-white bg-[#00C6A6]/10 hover:bg-[#008972] px-2 py-1 rounded-md transition-colors cursor-pointer border border-[#00C6A6]/30"
                          >
                            <Link2 className="w-3 h-3" />
                            <span>Attach Lead</span>
                          </button>
                        </div>
                      )}
                    </td>

                    {/* 5. Gross Selling */}
                    <td className="py-4 px-4 min-w-[120px]">
                      <div className="font-extrabold font-mono text-[#008972] text-sm">
                        {formatCurrency(q.totalSellingPrice || 0, q.currency)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {q.currency || 'USD'} Gross
                      </div>
                    </td>

                    {/* 6. Net Cost / Margin */}
                    <td className="py-4 px-4 min-w-[130px]">
                      <div className="font-mono text-slate-700 text-xs">
                        Net: {formatCurrency(q.totalNetCost || 0, q.currency)}
                      </div>
                      <div className="text-[10px] text-emerald-700 font-bold flex items-center space-x-1">
                        <span>+{formatCurrency(q.totalMargin || 0, q.currency)}</span>
                        <span className="bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded font-extrabold text-[9px]">
                          {marginPercent}%
                        </span>
                      </div>
                    </td>

                    {/* 7. Status */}
                    <td className="py-4 px-4">
                      <select
                        value={q.status}
                        disabled={q.isLocked && isB2BAgent}
                        onChange={e => handleStatusChange(q.id, e.target.value as QuoteStatus)}
                        className={`text-[10px] font-extrabold py-1 px-2.5 rounded-xl border cursor-pointer ${
                          q.status === 'ACCEPTED'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : q.status === 'ISSUED'
                            ? 'bg-blue-50 text-blue-800 border-blue-300'
                            : q.status === 'EXPIRED'
                            ? 'bg-rose-50 text-rose-800 border-rose-300'
                            : 'bg-slate-100 text-slate-700 border-slate-300'
                        }`}
                      >
                        <option value="DRAFT">DRAFT</option>
                        <option value="ISSUED">ISSUED</option>
                        <option value="ACCEPTED">ACCEPTED</option>
                        <option value="EXPIRED">EXPIRED</option>
                        <option value="ARCHIVED">ARCHIVED</option>
                      </select>
                    </td>

                    {/* 8. Action Buttons Hub */}
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        
                        {/* WhatsApp Share */}
                        <button
                          onClick={() => setWhatsAppSharingQuote(q)}
                          className="p-1.5 text-emerald-600 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
                          title="Share Quote on WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </button>

                        {/* PDF Download */}
                        <button
                          onClick={() => handleDownloadPDF(q)}
                          className="p-1.5 text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
                          title="Download Branded PDF Proposal"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>

                        {/* Version Branching */}
                        <button
                          onClick={() => handleCreateNewVersion(q.id)}
                          className="p-1.5 text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors cursor-pointer"
                          title="Branch New Version (v2, v3...)"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>

                        {/* Inspect Financial Details */}
                        <button
                          onClick={() => setViewingQuote(q)}
                          className="p-1.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                          title="View Itinerary & Margin Breakdown"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {/* Open in Live Quotation Builder */}
                        {onLoadQuote && !q.isLocked && (
                          <button
                            onClick={() => onLoadQuote(q)}
                            className="p-1.5 text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                            title="Open in Interactive Quotation Builder"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Convert to Ground Booking */}
                        {isAdminOrStaff && (
                          <button
                            onClick={() => handleConvertToBooking(q)}
                            className="p-1.5 text-[#008972] hover:text-[#005f4f] bg-[#00C6A6]/10 hover:bg-[#00C6A6]/20 rounded-lg transition-colors cursor-pointer"
                            title="Convert to Ground Booking Reservation"
                          >
                            <Briefcase className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Delete Quote */}
                        {(!q.isLocked || !isB2BAgent) && (
                          <button
                            onClick={() => handleDelete(q.id)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                            title="Delete Quotation"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                      </div>
                    </td>

                  </tr>
                );
              })}

              {filteredQuotes.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <FileSpreadsheet className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <div className="font-bold text-slate-700 text-sm">No quotation records found</div>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                      No quotes matching your search query or active filter selections.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Quote Details & Financial Inspector Modal */}
      {viewingQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 p-6 sm:p-8 space-y-6">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-xs bg-slate-900 text-[#00E5C0] px-2 py-0.5 rounded font-bold">
                    {viewingQuote.quoteNumber}
                  </span>
                  {viewingQuote.version && (
                    <span className="text-[10px] font-bold bg-[#00C6A6]/20 text-[#008972] px-2 py-0.5 rounded">
                      v{viewingQuote.version}
                    </span>
                  )}
                  {viewingQuote.leadId && (
                    <span className="text-[10px] font-mono font-bold bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded">
                      Linked Lead: {viewingQuote.leadId}
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-1">{viewingQuote.title}</h3>
                <p className="text-xs text-slate-500">
                  Destination: <strong>{viewingQuote.destination || 'Unassigned'}</strong> • Created: {new Date(viewingQuote.createdAt || Date.now()).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => setViewingQuote(null)}
                className="text-slate-400 hover:text-slate-700 p-2 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Creator & Client Attribution Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Creator Card */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Author / Created By
                </span>
                <div className="font-bold text-slate-900 text-sm">
                  {viewingQuote.createdByName || viewingQuote.agentName || 'Operations Desk'}
                </div>
                <div className="text-slate-500">
                  Agency: <strong>{viewingQuote.agentAgency || viewingQuote.agentCompany || 'The Unbound Direct'}</strong>
                </div>
                <div className="text-slate-400 text-[11px]">
                  Email: {viewingQuote.agentEmail || 'N/A'} • Role: {viewingQuote.createdByUserType || 'B2B_AGENT'}
                </div>
              </div>

              {/* Client Card */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Target Traveler / Client
                </span>
                <div className="font-bold text-slate-900 text-sm">
                  {viewingQuote.clientName || 'Direct Client'}
                </div>
                <div className="text-slate-500">
                  Email: <strong>{viewingQuote.clientEmail || 'N/A'}</strong>
                </div>
                <div className="text-slate-400 text-[11px]">
                  Pax: {viewingQuote.totalPax || 2} Travelers ({viewingQuote.adultsCount || 2} Adults, {viewingQuote.childrenCount || 0} Children)
                </div>
              </div>
            </div>

            {/* Financial Summary Box */}
            <div className="bg-slate-900 text-white p-5 rounded-2xl space-y-4 shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Gross Selling Tariff</span>
                  <span className="text-2xl font-black font-mono text-[#00E5C0]">
                    {formatCurrency(viewingQuote.totalSellingPrice || 0, viewingQuote.currency)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Status</span>
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-800">
                    {viewingQuote.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-slate-800 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">Net Ground Cost</span>
                  <span className="font-mono font-bold text-white text-sm">
                    {formatCurrency(viewingQuote.totalNetCost || 0, viewingQuote.currency)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Markup Margin</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    +{formatCurrency(viewingQuote.totalMargin || 0, viewingQuote.currency)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Margin %</span>
                  <span className="font-mono font-bold text-white text-sm">
                    {viewingQuote.overallMarkupPercent || 15}%
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Taxes & Levies</span>
                  <span className="font-mono font-bold text-white text-sm">
                    {formatCurrency(viewingQuote.totalTaxes || 0, viewingQuote.currency)}
                  </span>
                </div>
              </div>
            </div>

            {/* Line Items List */}
            <div className="space-y-2 text-xs">
              <h4 className="font-bold text-slate-900 text-sm flex items-center justify-between">
                <span>Itinerary Services ({viewingQuote.items?.length || 0})</span>
                <span className="text-slate-400 font-normal text-xs">Per Item Breakdown</span>
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {(viewingQuote.items || []).map((item, idx) => (
                  <div key={idx} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 text-xs">{item.product?.name || `Custom Service ${idx + 1}`}</div>
                      <div className="text-[11px] text-slate-500">
                        Day {idx + 1} • {item.travelDate || 'Flexible Schedule'} • {item.product?.category || 'ACTIVITY'}
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      <div className="font-bold text-slate-900 text-xs">
                        {formatCurrency(item.calculation?.totalSellingPrice || 0, viewingQuote.currency)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Net: {formatCurrency(item.calculation?.totalNetCost || 0, viewingQuote.currency)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleDownloadPDF(viewingQuote)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 cursor-pointer shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF Proposal</span>
                </button>

                {onLoadQuote && !viewingQuote.isLocked && (
                  <button
                    onClick={() => {
                      onLoadQuote(viewingQuote);
                      setViewingQuote(null);
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 cursor-pointer shadow-xs"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Open in Builder</span>
                  </button>
                )}
              </div>

              <button
                onClick={() => setViewingQuote(null)}
                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs cursor-pointer"
              >
                Close View
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 7. Attach / Convert to CRM Lead Modal */}
      {leadLinkModalQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 p-6 sm:p-8 space-y-6">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Attach Quote to Lead Management
                </h3>
                <p className="text-xs text-slate-500">
                  Quote: <strong>#{leadLinkModalQuote.quoteNumber}</strong> ({leadLinkModalQuote.title})
                </p>
              </div>
              <button onClick={() => setLeadLinkModalQuote(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Option A: Convert to NEW CRM Lead (1-Click) */}
            <div className="p-5 bg-gradient-to-br from-purple-50 to-indigo-50/50 rounded-2xl border border-purple-200/80 space-y-3">
              <div className="flex items-center space-x-2 text-purple-900 font-bold text-xs">
                <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
                <span>Option A: Auto-Create New CRM Lead from Quote</span>
              </div>
              <p className="text-xs text-purple-800/80 leading-relaxed">
                Creates a new CRM pipeline lead with budget <strong>{leadLinkModalQuote.currency} {leadLinkModalQuote.totalSellingPrice?.toLocaleString()}</strong>, client details, and attached quote snapshot.
              </p>
              <button
                onClick={() => handleCreateLeadFromQuote(leadLinkModalQuote)}
                className="w-full py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Create & Link New Lead Record</span>
              </button>
            </div>

            <div className="flex items-center my-3 text-xs text-slate-400">
              <div className="flex-1 border-t border-slate-200" />
              <span className="px-3 font-semibold uppercase text-[10px]">OR</span>
              <div className="flex-1 border-t border-slate-200" />
            </div>

            {/* Option B: Link to an Existing CRM Lead */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-800">
                Option B: Link to an Existing CRM Lead
              </label>
              
              <select
                value={selectedLeadIdToLink}
                onChange={e => {
                  setSelectedLeadIdToLink(e.target.value);
                  setCustomLeadIdInput(e.target.value);
                }}
                className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#00C6A6]"
              >
                <option value="">-- Select from Active CRM Leads --</option>
                {allLeads.map(l => (
                  <option key={l.id} value={l.leadNumber}>
                    {l.leadNumber} — {l.contactName} ({l.destinationName} • {l.status})
                  </option>
                ))}
              </select>

              <div className="relative">
                <input
                  type="text"
                  value={customLeadIdInput}
                  onChange={e => setCustomLeadIdInput(e.target.value)}
                  placeholder="Or enter custom Lead ID (e.g. LED-2026-9041)..."
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-[#00C6A6]"
                />
              </div>

              <button
                onClick={() => handleLinkToExistingLead(leadLinkModalQuote.id, customLeadIdInput)}
                disabled={!customLeadIdInput.trim()}
                className={`w-full py-2.5 font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-all ${
                  customLeadIdInput.trim()
                    ? 'bg-[#008972] hover:bg-[#00705e] text-white cursor-pointer shadow-xs'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Link2 className="w-4 h-4" />
                <span>Link to Selected Lead</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* WHATSAPP SHARE MODAL */}
      {whatsAppSharingQuote && (
        <ShareWhatsAppModal
          quote={whatsAppSharingQuote}
          user={user}
          onClose={() => setWhatsAppSharingQuote(null)}
          onSuccess={() => {
            setQuotes(db.getQuotesForUser(user));
            setAllLeads(db.getLeadsAuthorized(user));
          }}
        />
      )}

    </div>
  );
};
