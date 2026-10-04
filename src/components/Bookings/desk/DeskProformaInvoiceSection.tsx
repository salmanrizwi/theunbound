import React, { useState, useMemo } from 'react';
import { Booking, BookingInvoice, User } from '../../../types';
import { AppDatabase } from '../../../services/db';
import { isInternalStaff } from '../../../services/permissionEngine';
import { formatCurrency } from '../../../services/pricingEngine';
import { ProformaInvoiceModal } from '../../AdminCMS/leads/ProformaInvoiceModal';
import { 
  Receipt, 
  Plus, 
  Eye, 
  Edit3, 
  Printer, 
  Download, 
  Share2, 
  Mail, 
  RotateCcw, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Building2, 
  Calendar, 
  History, 
  X,
  Send,
  MessageCircle,
  Sparkles,
  DollarSign,
  CreditCard,
  Layers
} from 'lucide-react';

interface DeskProformaInvoiceSectionProps {
  booking: Booking;
  currentUser: User | null;
  onRefresh: () => void;
}

export const DeskProformaInvoiceSection: React.FC<DeskProformaInvoiceSectionProps> = ({
  booking,
  currentUser,
  onRefresh
}) => {
  const db = AppDatabase.getInstance();
  const isInternal = isInternalStaff(currentUser);

  // Modals
  const [selectedInvoiceForPreview, setSelectedInvoiceForPreview] = useState<BookingInvoice | null>(null);
  const [invoiceToEdit, setInvoiceToEdit] = useState<BookingInvoice | null>(null);
  const [historyInvoice, setHistoryInvoice] = useState<BookingInvoice | null>(null);
  const [emailModalInvoice, setEmailModalInvoice] = useState<BookingInvoice | null>(null);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailSentNotice, setEmailSentNotice] = useState(false);

  // Edit fields
  const [editDueDate, setEditDueDate] = useState('');
  const [editBillingAddress, setEditBillingAddress] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editTerms, setEditTerms] = useState('');
  const [editBankName, setEditBankName] = useState('');
  const [editBankAccount, setEditBankAccount] = useState('');
  const [editSwift, setEditSwift] = useState('');
  const [editAmendmentReason, setEditAmendmentReason] = useState('');

  // All invoices associated with this booking
  const allInvoices = useMemo(() => {
    return db.getBookingInvoices(booking.id);
  }, [db, booking.id]);

  const activeInvoice = allInvoices[0]; // Most recent

  const handleGenerateInvoice = () => {
    const res = db.generateProformaInvoice(booking.id, currentUser);
    if (res.success && res.invoice) {
      setSelectedInvoiceForPreview(res.invoice);
      onRefresh();
    } else {
      alert(res.error || 'Failed to generate Proforma Invoice');
    }
  };

  const openEditModal = (inv: BookingInvoice) => {
    setInvoiceToEdit(inv);
    setEditDueDate(inv.dueDate || '');
    setEditBillingAddress(inv.billingAddress || (inv as any).customerAddress || `${inv.customerName}\n${inv.agencyName || ''}`);
    setEditNotes(inv.notes || '');
    setEditTerms(inv.terms || '');
    setEditBankName(inv.bankAccountDetails?.bankName || 'HDFC Bank Ltd');
    setEditBankAccount(inv.bankAccountDetails?.accountNumber || '50200084920192');
    setEditSwift(inv.bankAccountDetails?.swiftBic || 'HDFCINBB');
    setEditAmendmentReason('');
  };

  const handleSaveInvoiceEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceToEdit) return;

    const updated: BookingInvoice = {
      ...invoiceToEdit,
      dueDate: editDueDate,
      billingAddress: editBillingAddress,
      notes: editNotes,
      terms: editTerms,
      bankAccountDetails: {
        bankName: editBankName,
        accountName: 'TheUnbound Travel Experiences Pvt Ltd',
        accountNumber: editBankAccount,
        swiftBic: editSwift
      }
    };

    const res = db.updateBookingInvoice(booking.id, updated, currentUser, editAmendmentReason || 'Updated billing terms');
    if (res.success) {
      setInvoiceToEdit(null);
      onRefresh();
    } else {
      alert(res.error || 'Failed to update invoice');
    }
  };

  const handleReissueInvoice = (invoiceId: string) => {
    const reason = window.prompt('Enter reason for reissuing proforma invoice:', 'Updated payment terms & due date');
    if (!reason) return;

    const res = db.reissueBookingInvoice(booking.id, invoiceId, currentUser, reason);
    if (res.success) {
      onRefresh();
    } else {
      alert(res.error || 'Failed to reissue invoice');
    }
  };

  const openEmailModal = (inv: BookingInvoice) => {
    setEmailModalInvoice(inv);
    setEmailRecipient(inv.customerEmail || booking.customer?.email || booking.agentEmailSnapshot || '');
    setEmailSubject(`Proforma Invoice #${inv.invoiceNumber} - Booking #${booking.bookingReference} [TheUnbound]`);
    setEmailBody(
`Dear ${inv.customerName || 'Valued Partner'},

Please find your official Proforma Invoice #${inv.invoiceNumber} (v${inv.invoiceVersion || 1}) for Booking #${booking.bookingReference}.

INVOICE SUMMARY:
• Invoice Number: ${inv.invoiceNumber}
• Date: ${inv.invoiceDate}
• Due Date: ${inv.dueDate}
• Total Amount: ${inv.currency} ${inv.totalAmount.toLocaleString()}
• Amount Paid: ${inv.currency} ${inv.amountPaid.toLocaleString()}
• Balance Due: ${inv.currency} ${inv.balanceDue.toLocaleString()}

PAYMENT INSTRUCTIONS:
Bank Name: ${inv.bankAccountDetails?.bankName || 'HDFC Bank Ltd'}
Account Name: TheUnbound Travel Experiences Pvt Ltd
Account Number: ${inv.bankAccountDetails?.accountNumber || '50200084920192'}
SWIFT / BIC: ${inv.bankAccountDetails?.swiftBic || 'HDFCINBB'}

Please share remittance advice once transferred. Thank you!

Warm regards,
TheUnbound Finance & Operations Desk`
    );
    setEmailSentNotice(false);
  };

  const handleSendEmail = () => {
    if (emailModalInvoice) {
      db.recordBookingActivity({
        eventId: `act-email-inv-${Date.now()}`,
        bookingId: booking.id,
        eventType: 'STATUS_UPDATED',
        actorId: currentUser?.id || 'admin',
        actorRole: currentUser?.role || 'FINANCE',
        actorName: currentUser?.name || 'Finance Lead',
        timestamp: new Date().toISOString(),
        metadata: { recipient: emailRecipient, invoiceNumber: emailModalInvoice.invoiceNumber },
        description: `Dispatched Proforma Invoice #${emailModalInvoice.invoiceNumber} to ${emailRecipient}`
      }, currentUser);
    }
    setEmailSentNotice(true);
    setTimeout(() => {
      setEmailModalInvoice(null);
      setEmailSentNotice(false);
      onRefresh();
    }, 1200);
  };

  const handleShareWhatsApp = (inv: BookingInvoice) => {
    const text = `*TheUnbound Proforma Invoice*\n` +
      `Invoice No: *#${inv.invoiceNumber}* (v${inv.invoiceVersion || 1})\n` +
      `Booking Ref: *#${booking.bookingReference}*\n` +
      `Client: ${inv.customerName}\n` +
      `Total Amount: *${inv.currency} ${inv.totalAmount.toLocaleString()}*\n` +
      `Amount Paid: *${inv.currency} ${inv.amountPaid.toLocaleString()}*\n` +
      `Balance Due: *${inv.currency} ${inv.balanceDue.toLocaleString()}*\n` +
      `Payment Due Date: ${inv.dueDate}\n` +
      `Bank: ${inv.bankAccountDetails?.bankName || 'HDFC Bank'} | A/C: ${inv.bankAccountDetails?.accountNumber || '50200084920192'}`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div id="desk-proforma-invoice-section" className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-black uppercase tracking-wider text-teal-700 flex items-center gap-1.5">
              <Receipt className="w-4 h-4" />
              Authoritative Proforma Billing
            </span>
            <span className="text-slate-300">•</span>
            <span className="font-mono text-xs text-slate-500 font-bold">
              {allInvoices.length} Invoices Generated
            </span>
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Proforma Invoices & Commercial Accounts
          </h2>
          <p className="text-xs text-slate-500 max-w-2xl mt-0.5">
            Auto-generated from authoritative customer quotation selling prices. Edit payment terms, wire details, and billing remarks. Fully synchronized with payments and tranches.
          </p>
        </div>

        {isInternal && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerateInvoice}
              className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{allInvoices.length > 0 ? 'Generate New Proforma' : 'Generate Proforma Invoice'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Invoice List */}
      {allInvoices.length > 0 ? (
        <div className="space-y-4">
          {allInvoices.map((invoice, idx) => {
            const isLatest = idx === 0;
            const isPaid = invoice.paymentStatus === 'PAID';
            const isPartiallyPaid = invoice.paymentStatus === 'PARTIALLY_PAID';

            return (
              <div
                key={invoice.id}
                className={`bg-white rounded-3xl border p-6 shadow-xs space-y-5 transition-all ${
                  isLatest ? 'border-teal-300 ring-1 ring-teal-200' : 'border-slate-200 opacity-90'
                }`}
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center font-black">
                      <Receipt className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-black text-slate-900 font-mono">
                          #{invoice.invoiceNumber}
                        </h3>
                        {invoice.invoiceVersion && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-bold text-slate-600 font-mono">
                            v{invoice.invoiceVersion}
                          </span>
                        )}
                        {isLatest && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-teal-100 text-teal-800 uppercase tracking-wider">
                            Active Proforma
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">
                        Issued {invoice.invoiceDate} • Due {invoice.dueDate}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                      isPaid ? 'bg-emerald-50 text-emerald-800 border-emerald-300' :
                      isPartiallyPaid ? 'bg-blue-50 text-blue-800 border-blue-300' :
                      'bg-amber-50 text-amber-800 border-amber-300'
                    }`}>
                      {invoice.paymentStatus || 'PENDING_PAYMENT'}
                    </span>

                    <button
                      onClick={() => setSelectedInvoiceForPreview(invoice)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Preview</span>
                    </button>

                    {isInternal && (
                      <button
                        onClick={() => openEditModal(invoice)}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                    )}

                    <button
                      onClick={() => openEmailModal(invoice)}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"
                      title="Email Invoice"
                    >
                      <Mail className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleShareWhatsApp(invoice)}
                      className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-all cursor-pointer"
                      title="Share via WhatsApp"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                    </button>

                    {isInternal && (
                      <button
                        onClick={() => handleReissueInvoice(invoice.id)}
                        className="p-2 rounded-xl text-purple-600 hover:bg-purple-50 transition-all cursor-pointer"
                        title="Reissue Proforma Invoice"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {invoice.versionHistory && invoice.versionHistory.length > 0 && (
                      <button
                        onClick={() => setHistoryInvoice(invoice)}
                        className="p-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 transition-all cursor-pointer"
                        title="Version History"
                      >
                        <History className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Numbers Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Subtotal</span>
                    <span className="text-sm font-black text-slate-800 font-mono mt-0.5 block">
                      {formatCurrency(invoice.subtotal, invoice.currency)}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Selling</span>
                    <span className="text-base font-black text-slate-900 font-mono mt-0.5 block">
                      {formatCurrency(invoice.totalAmount, invoice.currency)}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Amount Paid</span>
                    <span className="text-sm font-black text-emerald-700 font-mono mt-0.5 block">
                      {formatCurrency(invoice.amountPaid, invoice.currency)}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Balance Due</span>
                    <span className={`text-sm font-black font-mono mt-0.5 block ${invoice.balanceDue > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                      {formatCurrency(invoice.balanceDue, invoice.currency)}
                    </span>
                  </div>
                </div>

                {/* Line Items Sample Preview */}
                <div className="text-xs space-y-2">
                  <div className="flex items-center justify-between text-slate-500 font-bold uppercase text-[10px]">
                    <span>Line Items Breakdown ({invoice.services?.length || 0})</span>
                    <span>Billing Currency: {invoice.currency}</span>
                  </div>

                  <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
                    {(invoice.services || []).map((srv, sIdx) => (
                      <div key={srv.id || sIdx} className="p-3 bg-white flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-slate-800">{srv.description}</span>
                          <span className="text-[10px] text-slate-400 block">
                            {srv.category} • Qty: {srv.quantity} Pax
                          </span>
                        </div>
                        <span className="font-mono font-bold text-slate-900">
                          {formatCurrency(srv.amount, invoice.currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center space-y-4">
          <Receipt className="w-12 h-12 text-slate-300 mx-auto" />
          <div className="max-w-md mx-auto">
            <h3 className="text-base font-black text-slate-900">No Proforma Invoice Generated</h3>
            <p className="text-xs text-slate-500 mt-1">
              Generate the authoritative commercial proforma invoice in native currency directly from the booking line items.
            </p>
          </div>
          {isInternal && (
            <button
              onClick={handleGenerateInvoice}
              className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all inline-flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <Sparkles className="w-4 h-4" />
              <span>Generate Proforma Invoice Now</span>
            </button>
          )}
        </div>
      )}

      {/* MODAL 1: Preview Proforma Invoice */}
      {selectedInvoiceForPreview && (
        <ProformaInvoiceModal
          invoice={selectedInvoiceForPreview}
          onClose={() => setSelectedInvoiceForPreview(null)}
        />
      )}

      {/* MODAL 2: Edit Proforma Invoice */}
      {invoiceToEdit && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={handleSaveInvoiceEdit} className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 my-8 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-teal-600" />
                  Edit Proforma Invoice #{invoiceToEdit.invoiceNumber}
                </h3>
                <p className="text-[11px] text-slate-400">
                  Update payment terms, billing remarks, and bank account remittance details.
                </p>
              </div>
              <button type="button" onClick={() => setInvoiceToEdit(null)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Payment Due Date</label>
                <input
                  type="date"
                  required
                  value={editDueDate}
                  onChange={e => setEditDueDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Bank Name</label>
                <input
                  type="text"
                  required
                  value={editBankName}
                  onChange={e => setEditBankName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Bank Account Number</label>
                <input
                  type="text"
                  required
                  value={editBankAccount}
                  onChange={e => setEditBankAccount(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">SWIFT / BIC Code</label>
                <input
                  type="text"
                  value={editSwift}
                  onChange={e => setEditSwift(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="font-bold text-slate-700 block mb-1">Billing Address & Partner Legal Name</label>
                <textarea
                  rows={2}
                  value={editBillingAddress}
                  onChange={e => setEditBillingAddress(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="font-bold text-slate-700 block mb-1">Terms & Conditions</label>
                <textarea
                  rows={2}
                  value={editTerms}
                  onChange={e => setEditTerms(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="font-bold text-slate-700 block mb-1">Commercial Notes / Remarks</label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>

              <div className="sm:col-span-2 p-3 bg-amber-50 rounded-2xl border border-amber-200">
                <label className="font-bold text-amber-900 block mb-1">Operational Amendment Reason (Audited)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Updated billing due date per partner agreement"
                  value={editAmendmentReason}
                  onChange={e => setEditAmendmentReason(e.target.value)}
                  className="w-full p-2 rounded-xl border border-amber-300 bg-white text-slate-800 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setInvoiceToEdit(null)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs cursor-pointer shadow-xs"
              >
                Save Proforma Invoice
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: History */}
      {historyInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-200 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <History className="w-4 h-4 text-purple-600" />
                  Proforma History: #{historyInvoice.invoiceNumber}
                </h3>
                <p className="text-[11px] text-slate-400">Current version: v{historyInvoice.invoiceVersion || 1}</p>
              </div>
              <button onClick={() => setHistoryInvoice(null)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 pr-1 flex-1 text-xs">
              {historyInvoice.versionHistory && historyInvoice.versionHistory.length > 0 ? (
                historyInvoice.versionHistory.map((ver, i) => (
                  <div key={i} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">Version {ver.version}</span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(ver.amendedAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-slate-600">Amended By: <strong>{ver.amendedByName || 'Operations Lead'}</strong></p>
                    <p className="text-slate-500 italic bg-white p-2 rounded-xl border border-slate-100 mt-1">
                      "{ver.reason || 'Billing adjustment'}"
                    </p>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-slate-400">No previous versions.</div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 text-right shrink-0">
              <button
                onClick={() => setHistoryInvoice(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Email Dispatch */}
      {emailModalInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Mail className="w-4 h-4 text-teal-600" />
                Dispatch Proforma Invoice via Email
              </h3>
              <button onClick={() => setEmailModalInvoice(null)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            {emailSentNotice ? (
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <h4 className="text-sm font-bold text-emerald-900">Invoice Dispatched!</h4>
                <p className="text-xs text-slate-500">Activity logged in booking timeline.</p>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Recipient Email</label>
                  <input
                    type="email"
                    required
                    value={emailRecipient}
                    onChange={e => setEmailRecipient(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Subject</label>
                  <input
                    type="text"
                    required
                    value={emailSubject}
                    onChange={e => setEmailSubject(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Email Body</label>
                  <textarea
                    rows={9}
                    value={emailBody}
                    onChange={e => setEmailBody(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-mono text-xs"
                  />
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <a
                    href={`mailto:${emailRecipient}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-teal-700 font-bold hover:underline"
                  >
                    Open in Local Email / Gmail
                  </a>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEmailModalInvoice(null)}
                      className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSendEmail}
                      className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send & Log</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
