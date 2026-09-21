import React, { useState, useEffect } from 'react';
import { AppDatabase } from '../../services/db';
import { BookingInvoice, BookingVoucher, JobSheet, Booking, BookingUploadedInvoice } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { BookingOperationsDesk } from '../Bookings/BookingOperationsDesk';
import { VoucherDocumentView } from '../Bookings/VoucherDocumentView';
import { formatCurrency } from '../../services/pricingEngine';
import { 
  FileText, 
  DollarSign, 
  Receipt, 
  UploadCloud, 
  FileCheck, 
  Building2,
  Calendar,
  X,
  Layers,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Eye,
  Download,
  Search,
  CheckCircle2,
  Clock,
  ExternalLink
} from 'lucide-react';

export const FinancialsManager: React.FC = () => {
  const { user } = useAuth();
  const db = AppDatabase.getInstance();
  const [activeTab, setActiveTab] = useState<'CONNECTED_OPS' | 'INVOICES' | 'VOUCHERS' | 'MARGINS'>('CONNECTED_OPS');
  
  const [bookings, setBookings] = useState<Booking[]>(db.getAllBookings());
  const [vouchers, setVouchers] = useState<BookingVoucher[]>(db.getVouchers());
  const [uploadedInvoices, setUploadedInvoices] = useState<BookingUploadedInvoice[]>(db.getUploadedInvoices());
  
  const [selectedBookingForOps, setSelectedBookingForOps] = useState<Booking | null>(null);
  const [selectedVoucherForView, setSelectedVoucherForView] = useState<BookingVoucher | null>(null);
  const [selectedInvoiceForView, setSelectedInvoiceForView] = useState<BookingUploadedInvoice | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const refreshData = () => {
    setBookings(db.getAllBookings());
    setVouchers(db.getVouchers());
    setUploadedInvoices(db.getUploadedInvoices());
    if (selectedBookingForOps) {
      const refreshed = db.getAllBookings().find(b => b.id === selectedBookingForOps.id);
      if (refreshed) setSelectedBookingForOps(refreshed);
    }
  };

  useEffect(() => {
    return db.subscribe(() => {
      refreshData();
    });
  }, [selectedBookingForOps?.id]);

  // Filter bookings
  const filteredBookings = bookings.filter(b => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      b.bookingReference.toLowerCase().includes(q) ||
      b.customer?.leadTravelerName?.toLowerCase().includes(q) ||
      b.destinationName?.toLowerCase().includes(q)
    );
  });

  // Calculate high-level financial operations overview
  const totalClientTurnover = bookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
  const totalSupplierPayable = bookings.reduce((sum, b) => {
    const items = db.normalizeServiceItems(b.items || [], b);
    return sum + items.reduce((iSum, it) => iSum + (it.supplierPrice || 0), 0);
  }, 0);
  const totalGrossMargin = totalClientTurnover - totalSupplierPayable;
  const overallMarginPercent = totalClientTurnover > 0 ? Math.round((totalGrossMargin / totalClientTurnover) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-teal-700 font-bold text-xs uppercase tracking-wider mb-1">
            <DollarSign className="w-4 h-4" />
            <span>Connected Financial Operations & Reservations Engine</span>
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Financial Operations & Dispatch Documents
          </h2>
          <p className="text-xs text-slate-500 max-w-2xl mt-0.5">
            Unified operational workflow merging service item review, supplier allocation, commercial rate tracking, validation-gated ground vouchers, and strictly manual invoice processing.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center space-x-1 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 overflow-x-auto">
          <button
            onClick={() => {
              setActiveTab('CONNECTED_OPS');
              setSelectedBookingForOps(null);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'CONNECTED_OPS' ? 'bg-[#008f77] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Booking Operations Engine
          </button>
          <button
            onClick={() => setActiveTab('INVOICES')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'INVOICES' ? 'bg-[#008f77] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Manual Invoices ({uploadedInvoices.length})
          </button>
          <button
            onClick={() => setActiveTab('VOUCHERS')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'VOUCHERS' ? 'bg-[#008f77] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Confirmed Vouchers ({vouchers.length})
          </button>
          <button
            onClick={() => setActiveTab('MARGINS')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'MARGINS' ? 'bg-[#008f77] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Supplier Margin Analysis
          </button>
        </div>
      </div>

      {/* TAB 1: CONNECTED OPERATIONS ENGINE (Primary Merged View) */}
      {activeTab === 'CONNECTED_OPS' && (
        <div className="space-y-6">
          {selectedBookingForOps ? (
            <div className="space-y-4">
              <BookingOperationsDesk
                bookingId={selectedBookingForOps.id}
                currentUser={user}
                onBack={() => {
                  setSelectedBookingForOps(null);
                  refreshData();
                }}
                initialSection="FINANCIALS"
              />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Search & Filter */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search by Booking Reference, Traveler, Destination..."
                    className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div className="text-xs text-slate-500">
                  Select a booking to enter its <strong>Booking Operations & Reservations Engine</strong>.
                </div>
              </div>

              {/* Bookings Operations Matrix */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredBookings.map(b => {
                  const items = db.normalizeServiceItems(b.items || [], b);
                  const eligibility = db.checkBookingVoucherEligibility(b);
                  const invCount = db.getUploadedInvoices(b.id).length;
                  const supplierCost = items.reduce((s, it) => s + (it.supplierPrice || 0), 0);
                  const marginPct = b.totalAmount > 0 ? Math.round(((b.totalAmount - supplierCost) / b.totalAmount) * 100) : 0;

                  return (
                    <div 
                      key={b.id}
                      className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs hover:shadow-md transition-all space-y-4 flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="px-2.5 py-1 rounded-full text-xs font-black bg-teal-50 text-teal-800 border border-teal-200">
                            {b.bookingReference}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            b.status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {b.status}
                          </span>
                        </div>

                        <div>
                          <h3 className="text-sm font-black text-slate-900 line-clamp-1">
                            {b.customer?.leadTravelerName || 'Direct Guest'}
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {b.destinationName || 'Destination'} • {b.travelStartDate || 'Flexible Dates'}
                          </p>
                        </div>

                        {/* Operational Stats Grid */}
                        <div className="grid grid-cols-3 gap-2 text-center text-xs py-1 bg-slate-50 rounded-2xl p-2 border border-slate-100">
                          <div>
                            <div className="text-[10px] uppercase font-bold text-slate-400">Services</div>
                            <div className="font-black text-slate-900 mt-0.5">
                              {eligibility.confirmedItems}/{eligibility.totalItems}
                            </div>
                            <div className="text-[9px] text-emerald-600 font-bold">Confirmed</div>
                          </div>

                          <div>
                            <div className="text-[10px] uppercase font-bold text-slate-400">Voucher</div>
                            <div className="font-black text-slate-900 mt-0.5">
                              {b.vouchersList && b.vouchersList.length > 0 ? `v${b.vouchersList[0].version || 1}` : (eligibility.isEligible ? 'Ready' : 'Pending')}
                            </div>
                            <div className="text-[9px] text-slate-500">Dispatch</div>
                          </div>

                          <div>
                            <div className="text-[10px] uppercase font-bold text-slate-400">Invoices</div>
                            <div className="font-black text-slate-900 mt-0.5">
                              {invCount}
                            </div>
                            <div className="text-[9px] text-blue-600 font-bold">Uploaded</div>
                          </div>
                        </div>

                        {/* Commercial Pricing Summary */}
                        <div className="text-xs space-y-1 pt-1">
                          <div className="flex items-center justify-between text-slate-500">
                            <span>Selling Price:</span>
                            <span className="font-bold text-slate-800">{b.currency} {b.totalAmount?.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between text-slate-500">
                            <span>Supplier Cost:</span>
                            <span className="font-bold text-teal-800">{b.currency} {supplierCost.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-400">
                            <span>Est. Margin:</span>
                            <span className="font-bold text-emerald-700">~{marginPct}%</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => setSelectedBookingForOps(b)}
                        className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Layers className="w-3.5 h-3.5 text-teal-400" />
                        Open Booking Operations Desk
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MANUAL INVOICES OVERVIEW */}
      {activeTab === 'INVOICES' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 tracking-tight">
                  Authorised Manual Invoices Repository
                </h3>
                <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                  Zero Automated Invoicing Policy
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Every invoice in this repository was manually uploaded, verified, and linked to a verified booking or service item.
              </p>
            </div>
            <div className="text-xs text-slate-600 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200">
              Total Invoices: <strong>{uploadedInvoices.length}</strong>
            </div>
          </div>

          {uploadedInvoices.length === 0 ? (
            <div className="p-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 space-y-2">
              <UploadCloud className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-xs font-bold text-slate-700">No manual invoices uploaded yet</p>
              <p className="text-[11px] text-slate-400">
                To upload invoices, open any booking from the Booking Operations Engine tab and use the Manual Invoice Upload Desk.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Invoice Number</th>
                    <th className="px-4 py-3">Booking Ref</th>
                    <th className="px-4 py-3">Type & Scope</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Uploaded By & Date</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {uploadedInvoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3.5 font-bold font-mono text-slate-900">
                        {inv.invoiceNumber}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-teal-800 font-bold">
                        {inv.bookingReference}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-800">{inv.invoiceType}</div>
                        <div className="text-[10px] text-slate-400">{inv.associationType}</div>
                      </td>
                      <td className="px-4 py-3.5 font-bold text-slate-900">
                        {inv.currency} {inv.amount?.toLocaleString()}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        <div>{inv.uploadedByName}</div>
                        <div className="text-[10px] text-slate-400">{new Date(inv.uploadedAt).toLocaleDateString()}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {inv.uploadedFile && (
                            <a
                              href={inv.uploadedFile}
                              download={inv.uploadedFileName}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                              title="Download File"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <button
                            onClick={() => {
                              const b = bookings.find(item => item.id === inv.bookingId);
                              if (b) {
                                setSelectedBookingForOps(b);
                                setActiveTab('CONNECTED_OPS');
                              }
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                          >
                            <span>Open Booking</span>
                            <ArrowRight className="w-3 h-3" />
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
      )}

      {/* TAB 3: CONFIRMED VOUCHERS OVERVIEW */}
      {activeTab === 'VOUCHERS' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight">
                Confirmed Ground Service Vouchers
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Authoritative vouchers generated exclusively after all required service items have been confirmed.
              </p>
            </div>
            <div className="text-xs text-slate-600 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200">
              Total Vouchers: <strong>{vouchers.length}</strong>
            </div>
          </div>

          {vouchers.length === 0 ? (
            <div className="p-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 space-y-2">
              <FileCheck className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-xs font-bold text-slate-700">No vouchers generated yet</p>
              <p className="text-[11px] text-slate-400">
                Confirm all service items within a booking to unlock official ground voucher generation.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Voucher #</th>
                    <th className="px-4 py-3">Booking Ref</th>
                    <th className="px-4 py-3">Traveler</th>
                    <th className="px-4 py-3">Service Date</th>
                    <th className="px-4 py-3">Version & Issued</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {vouchers.map(v => (
                    <tr key={v.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3.5 font-bold font-mono text-slate-900">
                        {v.voucherNumber}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-teal-800 font-bold">
                        {v.bookingReference}
                      </td>
                      <td className="px-4 py-3.5 font-bold text-slate-800">
                        {v.leadPaxName || v.customerName} ({v.totalPax} Pax)
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {v.serviceDate}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-teal-50 text-teal-800 border border-teal-200">
                          v{v.version || 1}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {new Date(v.issuedAt || v.generatedAt!).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={() => setSelectedVoucherForView(v)}
                          className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 ml-auto cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" /> View Voucher
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: MARGIN ANALYSIS */}
      {activeTab === 'MARGINS' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
          <div className="pb-4 border-b border-slate-100">
            <h3 className="text-base font-black text-slate-900 tracking-tight">
              Operational Gross Margin Analysis
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Calculated dynamically from real customer selling prices and internal supplier rates.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Total Client Turnover</span>
              <div className="text-2xl font-black text-slate-900">
                USD {totalClientTurnover.toLocaleString()}
              </div>
              <p className="text-[11px] text-slate-500">Across {bookings.length} reservations</p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Total Supplier Payable</span>
              <div className="text-2xl font-black text-teal-800">
                USD {totalSupplierPayable.toLocaleString()}
              </div>
              <p className="text-[11px] text-slate-500">Allocated ground partners & hotels</p>
            </div>

            <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-1">
              <span className="text-[10px] uppercase font-bold text-emerald-800">Operational Margin</span>
              <div className="text-2xl font-black text-emerald-900">
                USD {totalGrossMargin.toLocaleString()} ({overallMarginPercent}%)
              </div>
              <p className="text-[11px] text-emerald-700">Authoritative DMC margin</p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VOUCHER VIEWER */}
      {selectedVoucherForView && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-4xl w-full my-8">
            <VoucherDocumentView
              voucher={selectedVoucherForView}
              isOutdated={selectedVoucherForView.isOutdated}
              onClose={() => setSelectedVoucherForView(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
