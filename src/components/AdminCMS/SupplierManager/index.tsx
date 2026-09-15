import React, { useState, useMemo } from 'react';
import { Supplier, SupplierStatus, User, SupplierRateCard, SupplierDocument } from '../../../types';
import { db } from '../../../services/db';
import { hasSupplierPermission } from '../../../services/permissionEngine';
import { SupplierFormModal } from './SupplierFormModal';
import { SupplierDetailDrawer } from './SupplierDetailDrawer';
import { SupplierArchiveModal } from './SupplierArchiveModal';
import { SupplierRateCardsModal } from './SupplierRateCardsModal';
import { SupplierDocumentsModal } from './SupplierDocumentsModal';
import { 
  Building2, 
  Plus, 
  Search, 
  Filter, 
  Eye, 
  Edit3, 
  Archive, 
  RotateCcw, 
  MapPin, 
  Mail, 
  PhoneCall, 
  Layers, 
  Briefcase, 
  FileSpreadsheet, 
  ShieldAlert, 
  Download, 
  LayoutGrid, 
  Table as TableIcon,
  CheckCircle2,
  Clock,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  AlertCircle
} from 'lucide-react';

interface SupplierManagerProps {
  currentUser: User | null;
  onNavigateToBooking?: (bookingId: string) => void;
}

export const SupplierManager: React.FC<SupplierManagerProps> = ({
  currentUser,
  onNavigateToBooking
}) => {
  // Permission Enforcement
  const canView = hasSupplierPermission(currentUser, 'view');
  const canCreate = hasSupplierPermission(currentUser, 'create');
  const canEdit = hasSupplierPermission(currentUser, 'edit');
  const canArchive = hasSupplierPermission(currentUser, 'archive');
  const canManageRates = hasSupplierPermission(currentUser, 'manage_rates');
  const canUploadDocs = hasSupplierPermission(currentUser, 'upload_documents');
  const canViewFinancials = hasSupplierPermission(currentUser, 'view_financial_details');

  // State
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => db.getSuppliers());
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [destinationFilter, setDestinationFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ACTIVE'); // 'ALL' | 'ACTIVE' | 'UNDER_REVIEW' | 'ARCHIVED'
  const [viewMode, setViewMode] = useState<'TABLE' | 'CARDS'>('TABLE');

  // Modals state
  const [selectedSupplierIdForDrawer, setSelectedSupplierIdForDrawer] = useState<string | null>(null);
  const [formModalSupplier, setFormModalSupplier] = useState<Supplier | null | 'NEW'>(null);
  const [archiveModalTarget, setArchiveModalTarget] = useState<{ supplier: Supplier; mode: 'archive' | 'restore' } | null>(null);
  const [rateCardModalSupplier, setRateCardModalSupplier] = useState<Supplier | null>(null);
  const [docModalSupplier, setDocModalSupplier] = useState<Supplier | null>(null);

  const refreshSuppliers = () => {
    setSuppliers(db.getSuppliers());
  };

  // Metrics
  const metrics = useMemo(() => {
    const total = suppliers.length;
    const active = suppliers.filter(s => s.status === 'ACTIVE').length;
    const underReview = suppliers.filter(s => s.status === 'UNDER_REVIEW').length;
    const archived = suppliers.filter(s => s.status === 'ARCHIVED').length;
    const totalLinkedItems = suppliers.reduce((acc, s) => acc + (s.linkedServiceItemsCount || 0), 0);
    const totalActiveBookings = suppliers.reduce((acc, s) => acc + (s.activeBookingsCount || 0), 0);
    return { total, active, underReview, archived, totalLinkedItems, totalActiveBookings };
  }, [suppliers]);

  // Unique filters
  const destinationsList = useMemo(() => {
    const set = new Set<string>();
    suppliers.forEach(s => {
      if (s.destination) set.add(s.destination);
    });
    return Array.from(set).sort();
  }, [suppliers]);

  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    suppliers.forEach(s => {
      s.categories?.forEach(c => set.add(c));
    });
    return Array.from(set).sort();
  }, [suppliers]);

  // Filtered suppliers
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => {
      // Status filter
      if (statusFilter !== 'ALL' && s.status !== statusFilter) {
        return false;
      }

      // Destination filter
      if (destinationFilter !== 'ALL' && s.destination !== destinationFilter) {
        return false;
      }

      // Category filter
      if (categoryFilter !== 'ALL' && !s.categories?.includes(categoryFilter)) {
        return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesCode = s.supplierCode?.toLowerCase().includes(q);
        const matchesName = s.name?.toLowerCase().includes(q);
        const matchesLegal = s.legalName?.toLowerCase().includes(q);
        const matchesEmail = s.email?.toLowerCase().includes(q);
        const matchesPhone = s.phone?.toLowerCase().includes(q);
        const matchesContact = s.contactPerson?.toLowerCase().includes(q);
        const matchesHubs = s.hubs?.some(h => h.toLowerCase().includes(q));
        return matchesCode || matchesName || matchesLegal || matchesEmail || matchesPhone || matchesContact || matchesHubs;
      }

      return true;
    });
  }, [suppliers, statusFilter, destinationFilter, categoryFilter, searchTerm]);

  // Handlers
  const handleSaveSupplier = (saved: Supplier) => {
    setFormModalSupplier(null);
    refreshSuppliers();
    setSelectedSupplierIdForDrawer(saved.id);
  };

  const handleConfirmArchiveToggle = (reason: string) => {
    if (!archiveModalTarget) return;
    const { supplier, mode } = archiveModalTarget;
    if (mode === 'archive') {
      db.archiveSupplier(supplier.id, reason, currentUser);
    } else {
      db.restoreSupplier(supplier.id, currentUser);
    }
    setArchiveModalTarget(null);
    refreshSuppliers();
  };

  const handleSaveRateCard = (rateCardData: any) => {
    db.createSupplierRateCard(rateCardData, currentUser);
    setRateCardModalSupplier(null);
    refreshSuppliers();
  };

  const handleUploadDocument = (docData: any) => {
    db.createSupplierDocument(docData, currentUser);
    setDocModalSupplier(null);
    refreshSuppliers();
  };

  const handleExportCSV = () => {
    const headers = [
      'Supplier Code',
      'Supplier Name',
      'Legal Name',
      'Status',
      'Destination',
      'Categories',
      'Contact Person',
      'Email',
      'Phone',
      'Emergency Phone',
      'Currency',
      'Payment Terms',
      'Credit Days',
      'Tax Number'
    ];

    const rows = filteredSuppliers.map(s => [
      `"${s.supplierCode || ''}"`,
      `"${s.name.replace(/"/g, '""')}"`,
      `"${(s.legalName || '').replace(/"/g, '""')}"`,
      `"${s.status}"`,
      `"${s.destination}"`,
      `"${(s.categories || []).join(', ')}"`,
      `"${s.contactPerson || ''}"`,
      `"${s.email || ''}"`,
      `"${s.phone || ''}"`,
      `"${s.emergencyPhone || ''}"`,
      `"${s.currency}"`,
      `"${s.paymentTerms || ''}"`,
      `"${s.commercialDetails?.creditDays ?? ''}"`,
      `"${s.taxRegistrationNumber || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `TheUnbound_Supplier_Directory_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Access check
  if (!canView) {
    return (
      <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-xs max-w-2xl mx-auto my-8 space-y-4">
        <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h3 className="text-base font-black text-slate-900">Access Restricted: Internal Only</h3>
        <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
          The Supplier Management Master Directory is restricted exclusively to authorized internal operations 
          and DMC administrative team members. External Buyers and B2B Agents do not have permission to access 
          supplier identities, commercial tariffs, or banking records.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Header & Navigation Context */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-teal-700">
            <span>Account Management</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            <span className="text-slate-900">Suppliers Master Directory</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Building2 className="w-6 h-6 text-teal-600" />
            Supplier Management
          </h1>
          <p className="text-xs text-slate-500 max-w-2xl">
            The central master directory for all ground partners, hotel suppliers, transport fleets, tour operators, 
            and guides. Powers verified dropdown allocations across the Booking Operations Desk.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 flex items-center gap-1.5 shadow-2xs cursor-pointer"
            title="Export CSV Roster"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Export Roster
          </button>

          {canCreate && (
            <button
              onClick={() => setFormModalSupplier('NEW')}
              className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Direct Supplier
            </button>
          )}
        </div>
      </div>

      {/* 2. Key Operational Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[10px] font-black uppercase text-slate-400">Total Directory</span>
          <p className="text-xl font-black text-slate-900">{metrics.total}</p>
          <span className="text-[10px] text-slate-500">Master partners</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-emerald-200/80 bg-emerald-50/20 shadow-2xs space-y-1">
          <span className="text-[10px] font-black uppercase text-emerald-700">Active Partners</span>
          <p className="text-xl font-black text-emerald-800">{metrics.active}</p>
          <span className="text-[10px] text-emerald-600 font-medium">Available for allocation</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-blue-200/80 bg-blue-50/20 shadow-2xs space-y-1">
          <span className="text-[10px] font-black uppercase text-blue-700">Under Review</span>
          <p className="text-xl font-black text-blue-800">{metrics.underReview}</p>
          <span className="text-[10px] text-blue-600 font-medium">Contracting in progress</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[10px] font-black uppercase text-slate-400">Archived</span>
          <p className="text-xl font-black text-slate-700">{metrics.archived}</p>
          <span className="text-[10px] text-slate-400 font-medium">Excluded from desk</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-teal-200/80 bg-teal-50/20 shadow-2xs space-y-1">
          <span className="text-[10px] font-black uppercase text-teal-700">Linked Services</span>
          <p className="text-xl font-black text-teal-800">{metrics.totalLinkedItems}</p>
          <span className="text-[10px] text-teal-600 font-medium">Operational items</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-indigo-200/80 bg-indigo-50/20 shadow-2xs space-y-1">
          <span className="text-[10px] font-black uppercase text-indigo-700">Active Bookings</span>
          <p className="text-xl font-black text-indigo-800">{metrics.totalActiveBookings}</p>
          <span className="text-[10px] text-indigo-600 font-medium">Live customer files</span>
        </div>
      </div>

      {/* 3. Search, Filters and View Toggle Bar */}
      <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by code (SUP-00101), name, email, hub..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-teal-500 focus:bg-white"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Dropdowns */}
          <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>Filters:</span>
            </div>

            {/* Destination filter */}
            <select
              value={destinationFilter}
              onChange={e => setDestinationFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:border-teal-500"
            >
              <option value="ALL">All Destinations</option>
              {destinationsList.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            {/* Category filter */}
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:border-teal-500"
            >
              <option value="ALL">All Categories</option>
              {categoriesList.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setViewMode('TABLE')}
                className={`p-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  viewMode === 'TABLE' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Table View"
              >
                <TableIcon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('CARDS')}
                className={`p-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  viewMode === 'CARDS' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Card View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 overflow-x-auto text-xs">
          <button
            onClick={() => setStatusFilter('ACTIVE')}
            className={`px-3 py-1 rounded-xl font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'ACTIVE'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <CheckCircle2 className="w-3 h-3" />
            Active ({metrics.active})
          </button>

          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1 rounded-xl font-bold transition-colors cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            All Statuses ({metrics.total})
          </button>

          <button
            onClick={() => setStatusFilter('UNDER_REVIEW')}
            className={`px-3 py-1 rounded-xl font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'UNDER_REVIEW'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Clock className="w-3 h-3" />
            Under Review ({metrics.underReview})
          </button>

          <button
            onClick={() => setStatusFilter('ARCHIVED')}
            className={`px-3 py-1 rounded-xl font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'ARCHIVED'
                ? 'bg-slate-700 text-white shadow-2xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Archive className="w-3 h-3" />
            Archived ({metrics.archived})
          </button>
        </div>
      </div>

      {/* 4. Results List: Table View or Cards View */}
      {filteredSuppliers.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
          <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-700">No suppliers found matching current criteria</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Try adjusting search terms, destination, or status filters, or create a new supplier record.
          </p>
          {canCreate && (
            <button
              onClick={() => setFormModalSupplier('NEW')}
              className="mt-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add New Supplier
            </button>
          )}
        </div>
      ) : viewMode === 'TABLE' ? (
        /* TABLE VIEW */
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] uppercase font-black text-slate-500">
                  <th className="px-4 py-3.5">Supplier Code</th>
                  <th className="px-4 py-3.5">Supplier Name & Entity</th>
                  <th className="px-4 py-3.5">Destination & Hubs</th>
                  <th className="px-4 py-3.5">Categories</th>
                  <th className="px-4 py-3.5">Primary Contact</th>
                  <th className="px-4 py-3.5">Commercial Terms</th>
                  <th className="px-4 py-3.5 text-center">Allocations</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSuppliers.map(s => {
                  const isArchived = s.status === 'ARCHIVED';
                  return (
                    <tr
                      key={s.id}
                      className={`hover:bg-slate-50/60 transition-colors ${
                        isArchived ? 'opacity-70 bg-slate-50/30' : ''
                      }`}
                    >
                      {/* Code */}
                      <td className="px-4 py-3.5 font-mono font-bold text-teal-800">
                        <button
                          onClick={() => setSelectedSupplierIdForDrawer(s.id)}
                          className="hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          {s.supplierCode}
                        </button>
                      </td>

                      {/* Name & Legal */}
                      <td className="px-4 py-3.5">
                        <div className="space-y-0.5">
                          <button
                            onClick={() => setSelectedSupplierIdForDrawer(s.id)}
                            className="font-bold text-slate-900 hover:text-teal-700 text-left cursor-pointer"
                          >
                            {s.name}
                          </button>
                          {s.legalName && s.legalName !== s.name && (
                            <p className="text-[11px] text-slate-400 truncate max-w-xs">{s.legalName}</p>
                          )}
                        </div>
                      </td>

                      {/* Destination & Hubs */}
                      <td className="px-4 py-3.5">
                        <div className="space-y-1">
                          <span className="font-semibold text-slate-800 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {s.destination}
                          </span>
                          {s.hubs && s.hubs.length > 0 && (
                            <p className="text-[10px] text-slate-400 truncate max-w-[150px]">
                              {s.hubs.join(', ')}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Categories */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1 max-w-[180px]">
                          {s.categories?.slice(0, 2).map(cat => (
                            <span
                              key={cat}
                              className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 text-[10px] font-semibold"
                            >
                              {cat}
                            </span>
                          ))}
                          {(s.categories?.length || 0) > 2 && (
                            <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold">
                              +{(s.categories?.length || 0) - 2}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Primary Contact */}
                      <td className="px-4 py-3.5">
                        <div className="space-y-0.5 text-[11px]">
                          <span className="font-medium text-slate-900 block">{s.contactPerson}</span>
                          <span className="text-slate-400 block">{s.email}</span>
                          <span className="text-slate-500 font-mono text-[10px]">{s.phone}</span>
                        </div>
                      </td>

                      {/* Commercial Terms */}
                      <td className="px-4 py-3.5">
                        <div className="space-y-0.5">
                          <span className="font-bold text-slate-900 font-mono">{s.currency}</span>
                          <p className="text-[11px] text-slate-500">{s.paymentTerms}</p>
                        </div>
                      </td>

                      {/* Allocations & Bookings */}
                      <td className="px-4 py-3.5 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className="font-bold text-teal-700">{s.linkedServiceItemsCount || 0}</span>
                          <span className="text-[9px] text-slate-400">
                            {s.activeBookingsCount || 0} active bkgs
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                            s.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : s.status === 'UNDER_REVIEW'
                              ? 'bg-blue-50 text-blue-800 border border-blue-200'
                              : s.status === 'ARCHIVED'
                              ? 'bg-slate-100 text-slate-600 border border-slate-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              s.status === 'ACTIVE'
                                ? 'bg-emerald-500'
                                : s.status === 'UNDER_REVIEW'
                                ? 'bg-blue-500'
                                : s.status === 'ARCHIVED'
                                ? 'bg-slate-400'
                                : 'bg-amber-500'
                            }`}
                          />
                          {s.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setSelectedSupplierIdForDrawer(s.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-teal-700 hover:bg-slate-100 cursor-pointer"
                            title="View Full Supplier Profile"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {canEdit && !isArchived && (
                            <button
                              onClick={() => setFormModalSupplier(s)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-teal-700 hover:bg-slate-100 cursor-pointer"
                              title="Edit Supplier"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}

                          {canArchive && (
                            <button
                              onClick={() =>
                                setArchiveModalTarget({
                                  supplier: s,
                                  mode: isArchived ? 'restore' : 'archive'
                                })
                              }
                              className={`p-1.5 rounded-lg cursor-pointer ${
                                isArchived
                                  ? 'text-teal-600 hover:text-teal-800 hover:bg-teal-50'
                                  : 'text-slate-400 hover:text-amber-700 hover:bg-amber-50'
                              }`}
                              title={isArchived ? 'Restore to Active' : 'Archive Supplier'}
                            >
                              {isArchived ? <RotateCcw className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* CARDS GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSuppliers.map(s => {
            const isArchived = s.status === 'ARCHIVED';
            return (
              <div
                key={s.id}
                className={`bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between gap-4 ${
                  isArchived ? 'opacity-70 bg-slate-50/40' : ''
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <span className="font-mono text-[10px] font-black px-2 py-0.5 rounded bg-teal-50 text-teal-800">
                        {s.supplierCode}
                      </span>
                      <h3 className="font-bold text-slate-900 text-sm mt-1">{s.name}</h3>
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-300" />
                        {s.destination} {s.hubs && s.hubs.length > 0 ? `• ${s.hubs[0]}` : ''}
                      </span>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        s.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-800'
                          : s.status === 'UNDER_REVIEW'
                          ? 'bg-blue-50 text-blue-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {s.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {s.categories?.map(c => (
                      <span key={c} className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-medium">
                        {c}
                      </span>
                    ))}
                  </div>

                  <div className="p-3 bg-slate-50 rounded-2xl space-y-1 text-[11px] text-slate-600">
                    <div className="font-semibold text-slate-800">{s.contactPerson}</div>
                    <div className="truncate">{s.email}</div>
                    <div>{s.phone}</div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <span>Currency: <strong className="text-slate-800">{s.currency}</strong></span>
                    <span>Linked Services: <strong className="text-teal-700">{s.linkedServiceItemsCount || 0}</strong></span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                  <button
                    onClick={() => setSelectedSupplierIdForDrawer(s.id)}
                    className="text-teal-700 font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    View Details <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex items-center gap-1">
                    {canEdit && !isArchived && (
                      <button
                        onClick={() => setFormModalSupplier(s)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                        title="Edit"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {canArchive && (
                      <button
                        onClick={() =>
                          setArchiveModalTarget({
                            supplier: s,
                            mode: isArchived ? 'restore' : 'archive'
                          })
                        }
                        className="p-1.5 rounded-lg text-slate-400 hover:text-amber-700 hover:bg-slate-100 cursor-pointer"
                        title={isArchived ? 'Restore' : 'Archive'}
                      >
                        {isArchived ? <RotateCcw className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODALS */}

      {/* Add / Edit Supplier Modal */}
      {formModalSupplier && (
        <SupplierFormModal
          initialSupplier={formModalSupplier === 'NEW' ? null : formModalSupplier}
          currentUser={currentUser}
          onClose={() => setFormModalSupplier(null)}
          onSave={handleSaveSupplier}
        />
      )}

      {/* Supplier Profile Detail Drawer */}
      {selectedSupplierIdForDrawer && (
        <SupplierDetailDrawer
          supplierId={selectedSupplierIdForDrawer}
          currentUser={currentUser}
          onClose={() => setSelectedSupplierIdForDrawer(null)}
          onEdit={supplier => {
            setSelectedSupplierIdForDrawer(null);
            setFormModalSupplier(supplier);
          }}
          onArchiveToggle={(supplier, mode) => {
            setArchiveModalTarget({ supplier, mode });
          }}
          onNavigateToBooking={onNavigateToBooking}
          onAddRateCard={supplier => setRateCardModalSupplier(supplier)}
          onUploadDocument={supplier => setDocModalSupplier(supplier)}
        />
      )}

      {/* Archive / Restore Confirmation Modal */}
      {archiveModalTarget && (
        <SupplierArchiveModal
          supplier={archiveModalTarget.supplier}
          mode={archiveModalTarget.mode}
          onClose={() => setArchiveModalTarget(null)}
          onConfirm={handleConfirmArchiveToggle}
        />
      )}

      {/* Add Rate Card Modal */}
      {rateCardModalSupplier && (
        <SupplierRateCardsModal
          supplierId={rateCardModalSupplier.id}
          supplierName={rateCardModalSupplier.name}
          onClose={() => setRateCardModalSupplier(null)}
          onSave={handleSaveRateCard}
        />
      )}

      {/* Upload Document Modal */}
      {docModalSupplier && (
        <SupplierDocumentsModal
          supplierId={docModalSupplier.id}
          supplierName={docModalSupplier.name}
          currentUserName={currentUser?.displayName || currentUser?.name || 'Operations Lead'}
          onClose={() => setDocModalSupplier(null)}
          onUpload={handleUploadDocument}
        />
      )}
    </div>
  );
};
