import React, { useState, useMemo, useEffect } from 'react';
import { AppDatabase } from '../../../services/db';
import { BookingInvoice, BookingUploadedInvoice, Booking, User } from '../../../types';
import { useAuth } from '../../../context/AuthContext';
import { formatCurrency } from '../../../services/pricingEngine';
import { 
  validateProformaInvoicePreflight, 
  ProformaPreflightError 
} from '../../../services/proformaInvoicePreflight';
import { 
  ProformaGenerationErrorModal, 
  ProformaGenerationSuccessModal 
} from './ProformaGenerationModals';
import { ProformaInvoiceModal } from '../leads/ProformaInvoiceModal';
import { BookingOperationsDesk } from '../../Bookings/BookingOperationsDesk';
import { 
  FileText, 
  UploadCloud, 
  Plus, 
  Search, 
  Filter, 
  Eye, 
  Download, 
  DollarSign, 
  Receipt, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  RefreshCw, 
  FileCheck, 
  Building2, 
  ChevronRight, 
  X,
  CreditCard,
  Layers,
  ArrowRight,
  ExternalLink
} from 'lucide-react';

export const UnifiedInvoicesManager: React.FC = () => {
  const { user } = useAuth();
  const db = AppDatabase.getInstance();

  const [activeTab, setActiveTab] = useState<'ALL' | 'PROFORMA' | 'MANUAL' | 'PAYMENT_LEDGER'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Database Data
  const [bookings, setBookings] = useState<Booking[]>(db.getAllBookings());
  const [proformaInvoices, setProformaInvoices] = useState<BookingInvoice[]>(db.getBookingInvoices());
  const [uploadedInvoices, setUploadedInvoices] = useState<BookingUploadedInvoice[]>(db.getUploadedInvoices());

  // Proforma Generation States
  const [isSelectBookingModalOpen, setIsUploadBookingModalOpen] = useState(false);
  const [selectedBookingIdForGen, setSelectedBookingIdForGen] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [preflightError, setPreflightError] = useState<ProformaPreflightError | null>(null);
  const [generatedSuccessInvoice, setGeneratedSuccessInvoice] = useState<BookingInvoice | null>(null);

  // View / Edit / Upload Modals
  const [previewProformaInvoice, setPreviewProformaInvoice] = useState<BookingInvoice | null>(null);
  const [selectedBookingForDesk, setSelectedBookingForDesk] = useState<Booking | null>(null);

  // Manual Invoice Upload Modal States
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualInvoiceToReplace, setManualInvoiceToReplace] = useState<BookingUploadedInvoice | null>(null);
  const [manualBookingId, setManualBookingId] = useState('');
  const [manualInvoiceType, setManualInvoiceType] = useState('Supplier Invoice');
  const [manualInvoiceNumber, setManualInvoiceNumber] = useState('');
  const [manualInvoiceDate, setManualInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [manualInvoiceCurrency, setManualInvoiceCurrency] = useState('USD');
  const [manualInvoiceAmount, setManualInvoiceAmount] = useState('');
  const [manualInvoiceNotes, setManualInvoiceNotes] = useState('');
  const [uploadedFile, setUploadedFile] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [uploadedFileSize, setUploadedFileSize] = useState('');
  const [uploadedMimeType, setUploadedMimeType] = useState('application/pdf');
  const [uploadError, setUploadError] = useState<string | null>(null);

  const refreshData = () => {
    setBookings(db.getAllBookings());
    setProformaInvoices(db.getBookingInvoices());
    setUploadedInvoices(db.getUploadedInvoices());
  };

  useEffect(() => {
    return db.subscribe(() => {
      refreshData();
    });
  }, []);

  // Combined Unified Invoice Items
  const unifiedInvoicesList = useMemo(() => {
    const list: Array<{
      id: string;
      invoiceNumber: string;
      type: 'PROFORMA' | 'MANUAL';
      bookingId: string;
      bookingReference: string;
      customerOrAgent: string;
      amount: number;
      currency: string;
      status: string;
      date: string;
      createdBy: string;
      originalProforma?: BookingInvoice;
      originalManual?: BookingUploadedInvoice;
    }> = [];

    proformaInvoices.forEach(inv => {
      list.push({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        type: 'PROFORMA',
        bookingId: inv.bookingId,
        bookingReference: inv.bookingReference || 'BK-SYS',
        customerOrAgent: inv.customerName || inv.billedToName || inv.agentName || 'Valued Guest',
        amount: inv.totalAmount || inv.subtotal || 0,
        currency: inv.currency || 'USD',
        status: inv.paymentStatus || 'GENERATED',
        date: inv.invoiceDate || inv.createdAt?.split('T')[0] || new Date().toISOString().split('T')[0],
        createdBy: inv.agentName || 'System',
        originalProforma: inv
      });
    });

    uploadedInvoices.forEach(inv => {
      if (inv.status === 'ARCHIVED') return;
      const b = bookings.find(item => item.id === inv.bookingId);
      list.push({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        type: 'MANUAL',
        bookingId: inv.bookingId,
        bookingReference: b?.bookingReference || inv.bookingReference || 'BK-MANUAL',
        customerOrAgent: inv.uploadedByName || b?.customer?.leadTravelerName || 'Supplier / Accounts',
        amount: inv.amount || 0,
        currency: inv.currency || 'USD',
        status: inv.paymentStatus || 'UPLOADED',
        date: inv.invoiceDate || inv.uploadedAt?.split('T')[0] || new Date().toISOString().split('T')[0],
        createdBy: inv.uploadedByName || 'Accounts',
        originalManual: inv
      });
    });

    // Filter by tab and search
    return list.filter(item => {
      if (activeTab === 'PROFORMA' && item.type !== 'PROFORMA') return false;
      if (activeTab === 'MANUAL' && item.type !== 'MANUAL') return false;

      if (statusFilter !== 'ALL' && item.status.toUpperCase() !== statusFilter.toUpperCase()) {
        return false;
      }

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        item.invoiceNumber.toLowerCase().includes(q) ||
        item.bookingReference.toLowerCase().includes(q) ||
        item.customerOrAgent.toLowerCase().includes(q)
      );
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [proformaInvoices, uploadedInvoices, bookings, activeTab, searchQuery, statusFilter]);

  // Primary Action: Generate Proforma Invoice
  const triggerProformaGeneration = (bookingId: string) => {
    if (isGenerating) return;
    setIsGenerating(true);

    try {
      // 1. Preflight Validation
      const precheck = validateProformaInvoicePreflight(bookingId, user);
      if (!precheck.valid || precheck.error) {
        setPreflightError(precheck.error || null);
        setIsGenerating(false);
        return;
      }

      // 2. Perform Generation via Canonical Database Service
      const res = db.generateProformaInvoice(bookingId, user, true);
      if (res.success && res.invoice) {
        refreshData();
        setGeneratedSuccessInvoice(res.invoice);
        // Log Audit Event
        db.logAudit(
          user,
          'INVOICE_GENERATED' as any,
          'BookingInvoice',
          res.invoice.id,
          `Proforma Invoice #${res.invoice.invoiceNumber} generated for Booking #${res.invoice.bookingReference}`
        );
      } else {
        setPreflightError({
          code: 'UNKNOWN_ERROR',
          title: 'Invoice Generation Failed',
          message: res.error || 'An unexpected error occurred during database invoice creation.',
          missingRequirements: ['Database authorization and valid pricing state'],
          actionableInstruction: 'Please check your connection and try again.',
          bookingId
        });
      }
    } catch (err: any) {
      setPreflightError({
        code: 'UNKNOWN_ERROR',
        title: 'Invoice Service Execution Error',
        message: err?.message || 'The invoice generation pipeline failed during execution.',
        missingRequirements: ['Valid booking data structure'],
        actionableInstruction: 'Please verify the booking details before retrying.',
        bookingId
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Manual Invoice Upload Handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File size exceeds maximum 10MB limit.');
      return;
    }

    setUploadError(null);
    setUploadedFileName(file.name);
    setUploadedFileSize(`${(file.size / (1024 * 1024)).toFixed(2)} MB`);
    setUploadedMimeType(file.type || 'application/pdf');

    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadedFile(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveManualInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualBookingId) {
      setUploadError('Please select a target booking for this invoice.');
      return;
    }
    if (!uploadedFile && !manualInvoiceToReplace) {
      setUploadError('Please select an invoice document file to upload.');
      return;
    }

    const b = bookings.find(item => item.id === manualBookingId);
    if (!b) {
      setUploadError('Target booking not found.');
      return;
    }

    const numericAmount = parseFloat(manualInvoiceAmount) || 0;
    const invNumber = manualInvoiceNumber.trim() || `MAN-INV-${Date.now().toString().slice(-6)}`;

    const invId = manualInvoiceToReplace?.invoiceId || `INV-UPL-${Date.now().toString(36).toUpperCase()}`;

    const newManualInv: BookingUploadedInvoice = {
      id: manualInvoiceToReplace?.id || `uploaded-inv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      invoiceId: invId,
      bookingId: b.id,
      bookingReference: b.bookingReference,
      invoiceType: manualInvoiceType as any,
      associationType: 'BOOKING',
      invoiceNumber: invNumber,
      invoiceDate: manualInvoiceDate,
      currency: manualInvoiceCurrency,
      amount: numericAmount,
      uploadedFile: uploadedFile || manualInvoiceToReplace?.uploadedFile || '',
      uploadedFileName: uploadedFileName || manualInvoiceToReplace?.uploadedFileName || 'Document.pdf',
      fileSize: uploadedFileSize || manualInvoiceToReplace?.fileSize || '1.0 MB',
      mimeType: uploadedMimeType || manualInvoiceToReplace?.mimeType || 'application/pdf',
      notes: manualInvoiceNotes,
      uploadedAt: new Date().toISOString(),
      uploadedBy: user?.id || 'usr-acc',
      uploadedByName: user?.name || 'Accounts Lead',
      status: 'ACTIVE'
    };

    db.saveUploadedInvoice(newManualInv, user);
    refreshData();
    setIsManualModalOpen(false);
  };

  return (
    <div className="space-y-6 text-slate-900 font-sans">
      {/* Header Bar */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-[#008f77] font-bold text-xs uppercase tracking-wider mb-1">
            <Receipt className="w-4 h-4" />
            <span>Finance & Administration • Central Commercial Billing</span>
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Unified Invoices Workspace
          </h2>
          <p className="text-xs text-slate-500 max-w-2xl mt-0.5">
            Authoritative billing module consolidating system-generated Proforma Invoices, supplier manual invoices, wire transfer instructions, and booking financial ledgers.
          </p>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex items-center space-x-2.5 shrink-0">
          <button
            onClick={() => setIsUploadBookingModalOpen(true)}
            disabled={isGenerating}
            className="px-4 py-2.5 rounded-2xl bg-[#008f77] hover:bg-[#00705d] text-white text-xs font-bold transition-all cursor-pointer flex items-center space-x-2 shadow-xs disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
                <span>Generating Proforma Invoice...</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 text-emerald-200" />
                <span>Generate Proforma Invoice</span>
              </>
            )}
          </button>

          <button
            onClick={() => {
              setManualInvoiceToReplace(null);
              setManualBookingId(bookings[0]?.id || '');
              setUploadedFile('');
              setUploadedFileName('');
              setUploadError(null);
              setIsManualModalOpen(true);
            }}
            className="px-4 py-2.5 rounded-2xl bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 text-xs font-bold transition-all cursor-pointer flex items-center space-x-2 shadow-xs"
          >
            <UploadCloud className="w-4 h-4 text-slate-600" />
            <span>Upload Manual Invoice</span>
          </button>
        </div>
      </div>

      {/* Workspace Tabs & Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Tab Selector */}
        <div className="flex items-center space-x-1 bg-slate-100 p-1.5 rounded-xl border border-slate-200 overflow-x-auto">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'ALL' ? 'bg-[#008f77] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Invoices ({proformaInvoices.length + uploadedInvoices.length})
          </button>
          <button
            onClick={() => setActiveTab('PROFORMA')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'PROFORMA' ? 'bg-[#008f77] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Proforma Invoices ({proformaInvoices.length})
          </button>
          <button
            onClick={() => setActiveTab('MANUAL')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'MANUAL' ? 'bg-[#008f77] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Manual Invoices ({uploadedInvoices.length})
          </button>
          <button
            onClick={() => setActiveTab('PAYMENT_LEDGER')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'PAYMENT_LEDGER' ? 'bg-[#008f77] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Payment Ledgers & Balances
          </button>
        </div>

        {/* Search & Status Filter */}
        <div className="flex items-center space-x-2">
          <div className="relative flex-1 md:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search invoice or booking #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-hidden focus:border-[#00C6A6]"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-hidden"
          >
            <option value="ALL">All Statuses</option>
            <option value="GENERATED">Generated</option>
            <option value="UNPAID">Unpaid</option>
            <option value="PARTIALLY_PAID">Partially Paid</option>
            <option value="PAID">Paid</option>
            <option value="UPLOADED">Uploaded</option>
          </select>
        </div>
      </div>

      {/* TAB CONTENT: INVOICES LIST (Unified Table) */}
      {activeTab !== 'PAYMENT_LEDGER' ? (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/80 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Invoice #</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Booking Ref</th>
                  <th className="py-3.5 px-4">Billed Customer / Agent</th>
                  <th className="py-3.5 px-4 text-right">Amount</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {unifiedInvoicesList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="font-bold text-slate-700 text-sm">No Invoices Found</p>
                      <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                        No commercial invoices match the active search filter. Click "Generate Proforma Invoice" above to create an official billing statement.
                      </p>
                    </td>
                  </tr>
                ) : (
                  unifiedInvoicesList.map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${
                          inv.type === 'PROFORMA' 
                            ? 'bg-teal-50 text-teal-800 border border-teal-200' 
                            : 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                        }`}>
                          {inv.type}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                        <button
                          onClick={() => {
                            const b = bookings.find(item => item.id === inv.bookingId);
                            if (b) setSelectedBookingForDesk(b);
                          }}
                          className="hover:text-[#008f77] hover:underline cursor-pointer flex items-center space-x-1"
                        >
                          <span>{inv.bookingReference}</span>
                          <ExternalLink className="w-3 h-3 text-slate-400" />
                        </button>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {inv.customerOrAgent}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-black text-right text-slate-900">
                        {formatCurrency(inv.amount, inv.currency)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          inv.status === 'PAID' 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : inv.status === 'PARTIALLY_PAID' 
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 font-mono">
                        {inv.date}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          {inv.type === 'PROFORMA' && inv.originalProforma && (
                            <button
                              onClick={() => setPreviewProformaInvoice(inv.originalProforma!)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                              title="View Proforma Invoice"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {inv.type === 'MANUAL' && inv.originalManual && (
                            <button
                              onClick={() => {
                                if (inv.originalManual?.uploadedFile) {
                                  window.open(inv.originalManual.uploadedFile, '_blank');
                                }
                              }}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                              title="Download Manual Invoice"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* PAYMENT LEDGERS & BALANCES TAB */
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center space-x-2">
                <CreditCard className="w-4 h-4 text-[#008f77]" />
                <span>Integrated Booking Payment Ledgers & Outstanding Balances</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Authoritative view of client wire remittances, installment tranches, and outstanding balances linked directly to invoices.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bookings.map(b => {
              const invoices = db.getBookingInvoices(b.id);
              const totalTurnover = b.totalAmount || 0;
              const paidAmount = (b as any).paidAmount || (b.paymentStatus === 'PAID' ? totalTurnover : 0);
              const balance = Math.max(0, totalTurnover - paidAmount);

              return (
                <div key={b.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-slate-900">{b.bookingReference}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      b.paymentStatus === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {b.paymentStatus || 'UNPAID'}
                    </span>
                  </div>

                  <div className="text-xs text-slate-700 font-bold">
                    {b.customer?.leadTravelerName || 'Valued Guest'}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-200">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Total Price</span>
                      <span className="font-mono font-bold text-slate-900">{formatCurrency(totalTurnover, b.currency)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Balance Due</span>
                      <span className="font-mono font-black text-rose-700">{formatCurrency(balance, b.currency)}</span>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between text-[11px] text-slate-500">
                    <span>{invoices.length} Proforma Invoices</span>
                    <button
                      onClick={() => setSelectedBookingForDesk(b)}
                      className="text-[#008f77] font-bold hover:underline cursor-pointer flex items-center space-x-1"
                    >
                      <span>Open Desk</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL: Select Booking for Proforma Generation */}
      {isSelectBookingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden text-slate-900 font-sans">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase text-[#00C6A6] tracking-wider block">
                  Commercial Invoicing
                </span>
                <h3 className="text-base font-black text-white tracking-tight">
                  Select Booking for Proforma Generation
                </h3>
              </div>
              <button
                onClick={() => setIsUploadBookingModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600">
                Choose an operational ground booking to issue an authoritative Proforma Invoice with wire transfer remittance instructions:
              </p>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {bookings.length === 0 ? (
                  <div className="p-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-500 space-y-1">
                    <p className="font-bold text-slate-700">No Operational Bookings Available</p>
                    <p className="text-slate-400">Convert a lead or quotation into a ground booking first before issuing a proforma invoice.</p>
                  </div>
                ) : (
                  bookings.map(b => (
                    <div
                      key={b.id}
                      onClick={() => setSelectedBookingIdForGen(b.id)}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                        selectedBookingIdForGen === b.id 
                          ? 'border-[#008f77] bg-teal-50/60 font-bold shadow-xs' 
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div>
                        <div className="font-mono font-bold text-slate-900">{b.bookingReference}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{b.customer?.leadTravelerName || 'Valued Guest'}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-black text-slate-900">{formatCurrency(b.totalAmount || 0, b.currency)}</div>
                        <div className="text-[10px] text-slate-400">{b.status}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-slate-50 p-4 border-t border-slate-100 flex items-center justify-end space-x-2">
              <button
                onClick={() => setIsUploadBookingModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={isGenerating}
                onClick={() => {
                  setIsUploadBookingModalOpen(false);
                  triggerProformaGeneration(selectedBookingIdForGen);
                }}
                className="px-4 py-2 rounded-xl bg-[#008f77] hover:bg-[#00705d] text-white text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isGenerating ? 'Validating...' : 'Generate Proforma Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PREFLIGHT ERROR POPUP */}
      <ProformaGenerationErrorModal
        error={preflightError}
        onClose={() => setPreflightError(null)}
        onNavigateToBooking={(bId) => {
          const b = bookings.find(item => item.id === bId);
          if (b) setSelectedBookingForDesk(b);
        }}
      />

      {/* GENERATION SUCCESS MODAL */}
      <ProformaGenerationSuccessModal
        invoice={generatedSuccessInvoice}
        onClose={() => setGeneratedSuccessInvoice(null)}
        onViewInvoice={(inv) => setPreviewProformaInvoice(inv)}
      />

      {/* PROFORMA PREVIEW MODAL */}
      {previewProformaInvoice && (
        <ProformaInvoiceModal
          invoice={previewProformaInvoice}
          onClose={() => setPreviewProformaInvoice(null)}
        />
      )}

      {/* BOOKING OPERATIONS DESK MODAL */}
      {selectedBookingForDesk && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs p-4 sm:p-6 flex justify-center">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-5xl w-full p-6 my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-4">
              <h3 className="text-base font-black text-slate-900">
                Booking Operations Desk #{selectedBookingForDesk.bookingReference}
              </h3>
              <button
                onClick={() => setSelectedBookingForDesk(null)}
                className="p-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <BookingOperationsDesk
              bookingId={selectedBookingForDesk.id}
              currentUser={user}
              onBack={() => {
                setSelectedBookingForDesk(null);
                refreshData();
              }}
              initialSection="PROFORMA_INVOICE"
            />
          </div>
        </div>
      )}

      {/* MANUAL INVOICE UPLOAD MODAL */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden text-slate-900 font-sans">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase text-indigo-300 tracking-wider block">
                  Manual Invoices
                </span>
                <h3 className="text-base font-black text-white tracking-tight">
                  {manualInvoiceToReplace ? 'Replace Uploaded Invoice' : 'Upload Manual Supplier Invoice'}
                </h3>
              </div>
              <button
                onClick={() => setIsManualModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveManualInvoice} className="p-6 space-y-4">
              {uploadError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium">
                  {uploadError}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Target Booking *</label>
                <select
                  value={manualBookingId}
                  onChange={(e) => setManualBookingId(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
                  required
                >
                  {bookings.map(b => (
                    <option key={b.id} value={b.id}>
                      #{b.bookingReference} — {b.customer?.leadTravelerName || 'Guest'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Invoice Number</label>
                  <input
                    type="text"
                    placeholder="e.g. SUP-INV-9921"
                    value={manualInvoiceNumber}
                    onChange={(e) => setManualInvoiceNumber(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Amount & Currency</label>
                  <div className="flex space-x-1">
                    <select
                      value={manualInvoiceCurrency}
                      onChange={(e) => setManualInvoiceCurrency(e.target.value)}
                      className="w-20 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="JPY">JPY</option>
                      <option value="GBP">GBP</option>
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={manualInvoiceAmount}
                      onChange={(e) => setManualInvoiceAmount(e.target.value)}
                      className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Select Invoice File (PDF / Image) *</label>
                <input
                  type="file"
                  accept="application/pdf,image/png,image/jpeg"
                  onChange={handleFileChange}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-100 file:text-slate-800 hover:file:bg-slate-200 cursor-pointer"
                />
                {uploadedFileName && (
                  <div className="text-[11px] text-emerald-700 font-semibold mt-1">
                    Selected: {uploadedFileName} ({uploadedFileSize})
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
                >
                  Save Manual Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
