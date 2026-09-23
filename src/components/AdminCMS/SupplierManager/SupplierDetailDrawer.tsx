import React, { useState, useEffect } from 'react';
import { 
  Supplier, 
  SupplierRateCard, 
  SupplierDocument, 
  SupplierActivityHistory, 
  SupplierAllocationRecord, 
  User, 
  SupplierStatus 
} from '../../../types';
import { db } from '../../../services/db';
import { hasSupplierPermission } from '../../../services/permissionEngine';
import { 
  X, 
  Building2, 
  User as UserIcon, 
  CreditCard, 
  FileSpreadsheet, 
  Globe2, 
  History, 
  Calendar, 
  Clock, 
  PhoneCall, 
  Mail, 
  MapPin, 
  ShieldCheck, 
  Edit3, 
  Archive, 
  RotateCcw, 
  Plus, 
  Trash2, 
  ExternalLink, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Eye, 
  EyeOff, 
  Download,
  DollarSign,
  Briefcase
} from 'lucide-react';

interface SupplierDetailDrawerProps {
  supplierId: string;
  currentUser: User | null;
  onClose: () => void;
  onEdit: (supplier: Supplier) => void;
  onArchiveToggle: (supplier: Supplier, mode: 'archive' | 'restore') => void;
  onNavigateToBooking?: (bookingId: string) => void;
  onAddRateCard: (supplier: Supplier) => void;
  onUploadDocument: (supplier: Supplier) => void;
}

export const SupplierDetailDrawer: React.FC<SupplierDetailDrawerProps> = ({
  supplierId,
  currentUser,
  onClose,
  onEdit,
  onArchiveToggle,
  onNavigateToBooking,
  onAddRateCard,
  onUploadDocument
}) => {
  const [supplier, setSupplier] = useState<Supplier | null>(() => db.getSupplierById(supplierId));
  const [rateCards, setRateCards] = useState<SupplierRateCard[]>([]);
  const [documents, setDocuments] = useState<SupplierDocument[]>([]);
  const [activity, setActivity] = useState<SupplierActivityHistory[]>([]);
  const [allocations, setAllocations] = useState<SupplierAllocationRecord[]>([]);

  const [activeTab, setActiveTab] = useState<
    'OVERVIEW' | 'COVERAGE' | 'COMMERCIAL' | 'RATE_CARDS' | 'DOCUMENTS' | 'ALLOCATIONS' | 'AUDIT'
  >('OVERVIEW');

  const [showBankDetails, setShowBankDetails] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  const canEdit = hasSupplierPermission(currentUser, 'edit');
  const canArchive = hasSupplierPermission(currentUser, 'archive');
  const canViewFinancials = hasSupplierPermission(currentUser, 'view_financial_details');
  const canManageFinancials = hasSupplierPermission(currentUser, 'manage_financial_details');
  const canManageRates = hasSupplierPermission(currentUser, 'manage_rates');
  const canUploadDocs = hasSupplierPermission(currentUser, 'upload_documents');

  const refreshData = () => {
    const s = db.getSupplierById(supplierId);
    setSupplier(s);
    if (s) {
      setRateCards(db.getSupplierRateCards(s.id));
      setDocuments(db.getSupplierDocuments(s.id));
      setActivity(db.getSupplierActivity(s.id));
      setAllocations(db.getSupplierAllocations(s.id));
    }
  };

  useEffect(() => {
    refreshData();
  }, [supplierId]);

  if (!supplier) {
    return (
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-white shadow-2xl p-6 flex flex-col justify-center items-center">
        <p className="text-slate-500 font-bold mb-4">Supplier record not found.</p>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
        >
          Close Drawer
        </button>
      </div>
    );
  }

  const handleStatusChange = (newStatus: SupplierStatus) => {
    if (!canEdit) return;
    db.setSupplierStatus(supplier.id, newStatus, currentUser, `Status changed from ${supplier.status} to ${newStatus}`);
    refreshData();
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    setIsSubmittingNote(true);
    db.logSupplierActivity({
      supplierId: supplier.id,
      action: 'NOTE_ADDED',
      summary: `Operational Note: ${newNote.trim()}`,
      details: newNote.trim(),
      performedBy: currentUser?.id || 'system',
      performedByName: currentUser?.name || 'Authorized User',
      performedByEmail: currentUser?.email
    });
    setNewNote('');
    setIsSubmittingNote(false);
    refreshData();
  };

  const handleDeleteRateCard = (cardId: string) => {
    if (!canManageRates) return;
    if (confirm('Are you sure you want to remove this contracted rate card?')) {
      db.deleteSupplierRateCard(cardId, currentUser);
      refreshData();
    }
  };

  const handleDeleteDocument = (docId: string) => {
    if (!canUploadDocs) return;
    if (confirm('Are you sure you want to remove this document attachment?')) {
      db.deleteSupplierDocument(docId, currentUser);
      refreshData();
    }
  };

  const isArchived = supplier.status === 'ARCHIVED';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-3xl bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
        {/* Top Header */}
        <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex flex-col gap-3 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-teal-600 text-white rounded-2xl shadow-xs">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[11px] font-black px-2 py-0.5 rounded-lg bg-teal-100 text-teal-900">
                    {supplier.supplierCode}
                  </span>
                  <h2 className="text-lg font-black text-slate-900">{supplier.name}</h2>
                </div>
                {supplier.legalName && supplier.legalName !== supplier.name && (
                  <p className="text-xs text-slate-500 font-medium">Legal: {supplier.legalName}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Quick Actions */}
              {canEdit && !isArchived && (
                <button
                  onClick={() => onEdit(supplier)}
                  className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-teal-600" />
                  Edit
                </button>
              )}

              {canArchive && (
                <button
                  onClick={() => onArchiveToggle(supplier, isArchived ? 'restore' : 'archive')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border shadow-xs cursor-pointer ${
                    isArchived
                      ? 'bg-teal-50 border-teal-200 text-teal-800 hover:bg-teal-100'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-200'
                  }`}
                >
                  {isArchived ? (
                    <>
                      <RotateCcw className="w-3.5 h-3.5 text-teal-600" />
                      Restore
                    </>
                  ) : (
                    <>
                      <Archive className="w-3.5 h-3.5 text-amber-600" />
                      Archive
                    </>
                  )}
                </button>
              )}

              <button
                onClick={onClose}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Status and Badges row */}
          <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-slate-500 font-semibold">Status:</span>
              {canEdit ? (
                <select
                  value={supplier.status}
                  onChange={e => handleStatusChange(e.target.value as SupplierStatus)}
                  className={`px-2.5 py-1 rounded-lg font-bold border text-xs cursor-pointer ${
                    supplier.status === 'ACTIVE'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : supplier.status === 'UNDER_REVIEW'
                      ? 'bg-blue-50 text-blue-800 border-blue-300'
                      : supplier.status === 'ARCHIVED'
                      ? 'bg-slate-100 text-slate-700 border-slate-300'
                      : 'bg-amber-50 text-amber-800 border-amber-300'
                  }`}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="UNDER_REVIEW">UNDER REVIEW</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                </select>
              ) : (
                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-bold">
                  {supplier.status}
                </span>
              )}

              <span className="text-slate-300">|</span>
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-400" />
                {supplier.destination}
              </span>

              {supplier.categories.map(c => (
                <span key={c} className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 font-medium text-[11px]">
                  {c}
                </span>
              ))}
            </div>

            <div className="flex items-center gap-3 text-slate-500 font-medium text-[11px]">
              <span>Linked Items: <strong className="text-slate-900">{supplier.linkedServiceItemsCount || 0}</strong></span>
              <span>Active Bookings: <strong className="text-teal-700">{supplier.activeBookingsCount || 0}</strong></span>
            </div>
          </div>
        </div>

        {/* Tab Strip */}
        <div className="flex items-center gap-1 px-5 pt-3 border-b border-slate-200 bg-white overflow-x-auto shrink-0 text-xs">
          <button
            onClick={() => setActiveTab('OVERVIEW')}
            className={`px-3 py-2 font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'OVERVIEW'
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5" />
            Profile & Contacts
          </button>

          <button
            onClick={() => setActiveTab('COVERAGE')}
            className={`px-3 py-2 font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'COVERAGE'
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Globe2 className="w-3.5 h-3.5" />
            Coverage & Hubs
          </button>

          <button
            onClick={() => setActiveTab('COMMERCIAL')}
            className={`px-3 py-2 font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'COMMERCIAL'
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            Commercials & Bank
          </button>

          <button
            onClick={() => setActiveTab('RATE_CARDS')}
            className={`px-3 py-2 font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'RATE_CARDS'
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            Rate Cards ({rateCards.length})
          </button>

          <button
            onClick={() => setActiveTab('DOCUMENTS')}
            className={`px-3 py-2 font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'DOCUMENTS'
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Contracts ({documents.length})
          </button>

          <button
            onClick={() => setActiveTab('ALLOCATIONS')}
            className={`px-3 py-2 font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'ALLOCATIONS'
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            Allocations ({allocations.length})
          </button>

          <button
            onClick={() => setActiveTab('AUDIT')}
            className={`px-3 py-2 font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'AUDIT'
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Audit Ledger ({activity.length})
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs">
          {/* TAB 1: OVERVIEW & CONTACTS */}
          {activeTab === 'OVERVIEW' && (
            <div className="space-y-5">
              {/* Primary Contact Banner */}
              <div className="p-4 rounded-2xl bg-teal-50/70 border border-teal-100 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">{supplier.contactPerson}</span>
                    <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 font-bold text-[10px]">
                      Primary Dispatch Contact
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-slate-600 flex-wrap pt-1">
                    <a href={`mailto:${supplier.email}`} className="flex items-center gap-1 hover:text-teal-700 font-medium">
                      <Mail className="w-3.5 h-3.5 text-teal-600" />
                      {supplier.email}
                    </a>
                    <a href={`tel:${supplier.phone}`} className="flex items-center gap-1 hover:text-teal-700 font-medium">
                      <PhoneCall className="w-3.5 h-3.5 text-teal-600" />
                      {supplier.phone}
                    </a>
                    {supplier.emergencyPhone && (
                      <span className="flex items-center gap-1 font-bold text-rose-700">
                        <Clock className="w-3.5 h-3.5" />
                        24x7 Emergency: {supplier.emergencyPhone}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Company Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Corporate Identity</h4>
                  <div className="space-y-1.5">
                    <div>
                      <span className="text-slate-400">Legal Registered Name:</span>{' '}
                      <strong className="text-slate-800">{supplier.legalName || supplier.name}</strong>
                    </div>
                    {supplier.tradingName && (
                      <div>
                        <span className="text-slate-400">Trading As:</span>{' '}
                        <strong className="text-slate-800">{supplier.tradingName}</strong>
                      </div>
                    )}
                    <div>
                      <span className="text-slate-400">Tax / VAT Registration:</span>{' '}
                      <strong className="text-slate-800 font-mono">{supplier.taxRegistrationNumber || 'Not provided'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Website:</span>{' '}
                      {supplier.website ? (
                        <a href={supplier.website} target="_blank" rel="noreferrer" className="text-teal-600 hover:underline inline-flex items-center gap-1">
                          {supplier.website} <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-slate-400">None</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Geographic Base</h4>
                  <div className="space-y-1.5">
                    <div>
                      <span className="text-slate-400">Country:</span>{' '}
                      <strong className="text-slate-800">{supplier.country}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Primary Destination:</span>{' '}
                      <strong className="text-slate-800">{supplier.destination}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">City Hubs:</span>{' '}
                      <strong className="text-slate-800">{supplier.hubs?.join(', ') || 'Nationwide'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Physical Address:</span>{' '}
                      <strong className="text-slate-800">{supplier.address || 'On file'}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Department Contacts List */}
              {supplier.contactPersons && supplier.contactPersons.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-900">
                    All Department Contacts ({supplier.contactPersons.length})
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {supplier.contactPersons.map((cp, idx) => (
                      <div key={idx} className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800">{cp.name}</span>
                          {cp.isPrimary ? (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-teal-50 text-teal-700">Primary</span>
                          ) : (
                            <span className="text-[9px] text-slate-400">{cp.role || cp.designation}</span>
                          )}
                        </div>
                        <div className="text-slate-600 space-y-0.5 text-[11px]">
                          <div>Email: <a href={`mailto:${cp.email}`} className="text-teal-600">{cp.email}</a></div>
                          <div>Phone: {cp.phone}</div>
                          {cp.emergencyPhone && (
                            <div className="text-rose-700 font-bold">24x7: {cp.emergencyPhone}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {supplier.notes && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                  <h4 className="text-[10px] font-black uppercase text-slate-400">Internal Operational Notes</h4>
                  <p className="text-slate-700 whitespace-pre-line leading-relaxed">{supplier.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: COVERAGE & HUBS */}
          {activeTab === 'COVERAGE' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-teal-600" />
                    City Hubs & Operating Reach
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {supplier.hubs && supplier.hubs.length > 0 ? (
                      supplier.hubs.map(h => (
                        <span key={h} className="px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-slate-800 font-medium">
                          {h}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400 italic">No specific hubs defined</span>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-teal-600" />
                    Operating Schedule & SLAs
                  </h4>
                  <div className="space-y-1.5 text-slate-600">
                    <div>
                      <span className="text-slate-400">Operating Hours:</span>{' '}
                      <strong className="text-slate-800">{supplier.serviceCoverage?.operatingHours || 'Standard Business Hours'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Operating Days:</span>{' '}
                      <strong className="text-slate-800">{supplier.serviceCoverage?.operatingDays?.join(', ') || 'All week'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Supported Languages:</span>{' '}
                      <strong className="text-slate-800">{supplier.serviceCoverage?.languagesSupported?.join(', ') || 'English'}</strong>
                    </div>
                    <div className="pt-1">
                      {supplier.serviceCoverage?.has24x7Support ? (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-bold border border-emerald-200 flex items-center gap-1 w-fit">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          24/7 Live Passenger Support Enabled
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Office hours only</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-2">
                <h4 className="text-xs font-bold text-slate-900">Supported Service Categories</h4>
                <div className="flex flex-wrap gap-2">
                  {supplier.categories.map(cat => (
                    <span key={cat} className="px-3 py-1.5 rounded-xl bg-teal-50 text-teal-800 border border-teal-200 font-bold text-xs flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                      {cat}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: COMMERCIALS & BANKING */}
          {activeTab === 'COMMERCIAL' && (
            <div className="space-y-5">
              {!canViewFinancials ? (
                <div className="p-6 bg-slate-50 border border-slate-200 rounded-3xl text-center space-y-2">
                  <ShieldCheck className="w-8 h-8 text-slate-400 mx-auto" />
                  <h4 className="font-bold text-slate-800">Commercial Access Restricted</h4>
                  <p className="text-slate-500 text-xs max-w-md mx-auto">
                    Your account role does not have permission to view commercial tariffs and bank details.
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Settlement Currency</span>
                      <p className="text-lg font-black text-slate-900">{supplier.currency}</p>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Payment Terms</span>
                      <p className="text-sm font-bold text-teal-800">{supplier.paymentTerms}</p>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Credit Window</span>
                      <p className="text-lg font-black text-slate-900">
                        {supplier.commercialDetails?.creditDays ?? 30} <span className="text-xs font-normal text-slate-500">Days</span>
                      </p>
                    </div>
                  </div>

                  {/* Cancellation terms */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                    <h4 className="text-xs font-bold text-slate-900">Contractual Cancellation Policy</h4>
                    <p className="text-slate-700 leading-relaxed">
                      {supplier.cancellationTerms || 'Standard agreed cancellation tiers apply.'}
                    </p>
                  </div>

                  {/* Bank Details with security toggle */}
                  <div className="p-5 bg-white rounded-2xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-teal-600" />
                        <h4 className="text-xs font-bold text-slate-900">Direct Wire & Banking Details</h4>
                      </div>
                      <button
                        onClick={() => setShowBankDetails(!showBankDetails)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        {showBankDetails ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        {showBankDetails ? 'Mask Banking Details' : 'Reveal Banking Details'}
                      </button>
                    </div>

                    {supplier.bankDetails ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
                        <div className="p-3 bg-slate-50 rounded-xl">
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Bank Name</span>
                          <span className="font-bold text-slate-900">{supplier.bankDetails.bankName}</span>
                        </div>

                        <div className="p-3 bg-slate-50 rounded-xl">
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Account Name</span>
                          <span className="font-bold text-slate-900">{supplier.bankDetails.accountName}</span>
                        </div>

                        <div className="p-3 bg-slate-50 rounded-xl">
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Account Number</span>
                          <span className="font-mono font-bold text-slate-900">
                            {showBankDetails
                              ? supplier.bankDetails.accountNumber
                              : `•••• •••• ${supplier.bankDetails.accountNumber.slice(-4)}`}
                          </span>
                        </div>

                        <div className="p-3 bg-slate-50 rounded-xl">
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">SWIFT / BIC Code</span>
                          <span className="font-mono font-bold text-slate-900 uppercase">
                            {showBankDetails
                              ? supplier.bankDetails.swiftBic || 'N/A'
                              : '••••••••'}
                          </span>
                        </div>

                        {supplier.bankDetails.iban && (
                          <div className="p-3 bg-slate-50 rounded-xl">
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">IBAN</span>
                            <span className="font-mono font-bold text-slate-900">
                              {showBankDetails ? supplier.bankDetails.iban : '••••••••••••••••'}
                            </span>
                          </div>
                        )}

                        {supplier.bankDetails.branchAddress && (
                          <div className="p-3 bg-slate-50 rounded-xl">
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Branch</span>
                            <span className="text-slate-800">{supplier.bankDetails.branchAddress}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-slate-400 italic py-2">No bank account details recorded for this supplier.</p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 4: RATE CARDS */}
          {activeTab === 'RATE_CARDS' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Contracted Tariff & Rate Cards</h4>
                  <p className="text-[11px] text-slate-500">Contracted rates referenced during operational quote and pricing</p>
                </div>
                {canManageRates && (
                  <button
                    onClick={() => onAddRateCard(supplier)}
                    className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Rate Card
                  </button>
                )}
              </div>

              {rateCards.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-3xl border border-slate-200 space-y-2">
                  <DollarSign className="w-8 h-8 text-slate-400 mx-auto" />
                  <h5 className="font-bold text-slate-700">No contracted rate cards yet</h5>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Add contracted net rates for transfers, day tours, or guides to auto-populate supplier prices.
                  </p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-2xl overflow-x-auto shadow-xs">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-black text-slate-500">
                        <th className="px-4 py-2.5">Service Name</th>
                        <th className="px-4 py-2.5">Category</th>
                        <th className="px-4 py-2.5">Adult Net Rate</th>
                        <th className="px-4 py-2.5">Validity</th>
                        <th className="px-4 py-2.5">Status</th>
                        {canManageRates && <th className="px-4 py-2.5 text-right">Action</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rateCards.map(rc => (
                        <tr key={rc.id} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 font-bold text-slate-900">{rc.serviceName}</td>
                          <td className="px-4 py-3 text-slate-600">{rc.serviceCategory}</td>
                          <td className="px-4 py-3 font-mono font-bold text-teal-800">
                            {rc.currency} {rc.rateAdult.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            <span className="text-[10px] text-slate-400 font-normal ml-1">/{rc.unitType?.replace('PER_', '').toLowerCase()}</span>
                          </td>
                          <td className="px-4 py-3 text-slate-500 text-[11px]">
                            {rc.validFrom} to {rc.validTo}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              rc.isActive ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {rc.isActive ? 'ACTIVE' : 'INACTIVE'}
                            </span>
                          </td>
                          {canManageRates && (
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => handleDeleteRateCard(rc.id)}
                                className="p-1 rounded-lg text-slate-400 hover:text-rose-600 cursor-pointer"
                                title="Delete Rate Card"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: DOCUMENTS & CONTRACTS */}
          {activeTab === 'DOCUMENTS' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Contracts, Tariffs & Compliance Documents</h4>
                  <p className="text-[11px] text-slate-500">Official agreements and regulatory licenses</p>
                </div>
                {canUploadDocs && (
                  <button
                    onClick={() => onUploadDocument(supplier)}
                    className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Upload Document
                  </button>
                )}
              </div>

              {documents.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-3xl border border-slate-200 space-y-2">
                  <FileText className="w-8 h-8 text-slate-400 mx-auto" />
                  <h5 className="font-bold text-slate-700">No documents attached</h5>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Upload executed Master Service Agreements (MSAs), signed tariff sheets, and business insurance certificates.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {documents.map(doc => (
                    <div key={doc.id} className="p-3.5 bg-white border border-slate-200 rounded-2xl flex items-start justify-between gap-3 shadow-xs">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-teal-50 text-teal-700 rounded-xl mt-0.5">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[9px] uppercase">
                            {doc.documentType}
                          </span>
                          <h5 className="font-bold text-slate-900 text-xs">{doc.title}</h5>
                          <p className="text-[10px] text-slate-400 font-mono">{doc.fileName} • {doc.fileSize || '1 MB'}</p>
                          <p className="text-[10px] text-slate-500">
                            Uploaded by {doc.uploadedBy} on {new Date(doc.uploadedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {canUploadDocs && (
                          <button
                            onClick={() => handleDeleteDocument(doc.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 cursor-pointer"
                            title="Remove Document"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 6: ALLOCATIONS */}
          {activeTab === 'ALLOCATIONS' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Active Service Item Allocations</h4>
                  <p className="text-[11px] text-slate-500">
                    Live services and historical assignments across TheUnbound booking operations
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-teal-50 text-teal-800 font-bold text-xs">
                  {allocations.length} Services Allocated
                </span>
              </div>

              {allocations.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-3xl border border-slate-200 space-y-2">
                  <Briefcase className="w-8 h-8 text-slate-400 mx-auto" />
                  <h5 className="font-bold text-slate-700">No active service allocations</h5>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    This supplier has not been assigned to any customer bookings yet. When assigned via the 
                    Booking Operations Desk, allocations will track here in real time.
                  </p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-2xl overflow-x-auto shadow-xs">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-black text-slate-500">
                        <th className="px-4 py-2.5">Booking Ref</th>
                        <th className="px-4 py-2.5">Service Item</th>
                        <th className="px-4 py-2.5">Customer / Passenger</th>
                        <th className="px-4 py-2.5">Date</th>
                        <th className="px-4 py-2.5">Status</th>
                        <th className="px-4 py-2.5 text-right">Desk Link</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {allocations.map(alloc => (
                        <tr key={alloc.id} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 font-mono font-bold text-teal-700">
                            {alloc.bookingReference}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-900">
                            {alloc.serviceName}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {alloc.customerName || 'Group Traveler'}
                          </td>
                          <td className="px-4 py-3 text-slate-500 text-[11px]">
                            {alloc.serviceDate || 'Upcoming'}
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800">
                              {alloc.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {onNavigateToBooking ? (
                              <button
                                onClick={() => {
                                  onClose();
                                  onNavigateToBooking(alloc.bookingId);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                              >
                                View Booking <ExternalLink className="w-3 h-3" />
                              </button>
                            ) : (
                              <span className="text-slate-400 font-mono text-[10px]">{alloc.bookingId}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 7: AUDIT & ACTIVITY HISTORY */}
          {activeTab === 'AUDIT' && (
            <div className="space-y-4">
              {/* Add Note Form */}
              <form onSubmit={handleAddNote} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <label className="text-[10px] font-bold uppercase text-slate-500">
                  Add Operational Audit Note
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={newNote}
                    onChange={e => setNewNote(e.target.value)}
                    placeholder="Log a call, rate negotiation update, performance review note..."
                    className="flex-1 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-teal-500"
                  />
                  <button
                    type="submit"
                    disabled={isSubmittingNote}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    Log Note
                  </button>
                </div>
              </form>

              {activity.length === 0 ? (
                <p className="text-slate-400 italic text-center py-6">No activity history recorded yet.</p>
              ) : (
                <div className="space-y-2.5 border-l-2 border-teal-200 pl-4 ml-2">
                  {activity.map(act => (
                    <div key={act.id} className="relative pb-2 space-y-0.5">
                      <div className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-teal-600 ring-4 ring-white" />
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span className="font-bold text-teal-800 uppercase tracking-wide">{act.action}</span>
                        <span>{new Date(act.timestamp).toLocaleString()}</span>
                      </div>
                      <p className="text-xs text-slate-800 font-medium">{act.summary}</p>
                      <span className="text-[10px] text-slate-400">By: {act.performedBy}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
