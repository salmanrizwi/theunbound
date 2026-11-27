import React, { useMemo, useRef, useState } from 'react';
import { Booking, BookingInvoice } from '../../../types';
import { formatCurrency } from '../../../services/pricingEngine';
import {
  Printer,
  Download,
  X,
  Receipt,
  Building2,
  Calendar,
  CreditCard,
  CheckCircle2,
  FileText,
  Info,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { AppDatabase } from '../../../services/db';
import {
  evaluateProformaInvoiceFreshness,
  formatPassengerBreakdown,
  formatReadableDate,
  hydrateBookingServiceItem,
  resolveAuthoritativeProformaAmount,
  sortBookingItemsChronologically
} from '../../../services/bookingOperationsSyncService';
import { downloadProformaInvoiceDocument } from '../../../services/proformaInvoiceService';

interface ProformaInvoiceModalProps {
  invoice: BookingInvoice;
  booking?: Booking | null;
  onClose: () => void;
}

export const ProformaInvoiceModal: React.FC<ProformaInvoiceModalProps> = ({
  invoice,
  booking: propBooking,
  onClose
}) => {
  const printRef = useRef<HTMLDivElement>(null);
  const db = AppDatabase.getInstance();
  const companyProfile = db.getCentralCompanyProfile();
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const resolvedBooking = useMemo(() => {
    if (propBooking) return propBooking;
    if (invoice.bookingId) {
      return db.getBookingById(invoice.bookingId, db.getCurrentUser()) || null;
    }
    return null;
  }, [propBooking, invoice.bookingId, db]);

  // IMMUTABLE SNAPSHOT RULE:
  // Always display this Proforma Invoice's own committed snapshot amount so historical versions
  // are never overwritten after later discounts; evaluate freshness separately to flag Outdated/Superseded.
  const authoritative = useMemo(() => {
    const hasLockedAmount =
      typeof invoice.proformaFinalBookingAmount === 'number' ||
      (typeof invoice.totalAmount === 'number' && invoice.totalAmount > 0);
    const fallback = !hasLockedAmount && resolvedBooking ? resolveAuthoritativeProformaAmount(resolvedBooking) : null;
    const finalAmt = hasLockedAmount
      ? Number(invoice.proformaFinalBookingAmount ?? invoice.totalAmount ?? 0)
      : Number(fallback?.finalBookingAmount ?? 0);
    const hasLockedPaid = typeof invoice.amountPaid === 'number' || typeof invoice.paidAmount === 'number';
    const paid = hasLockedPaid
      ? Math.max(0, Number(invoice.amountPaid ?? invoice.paidAmount ?? 0))
      : Number(fallback?.amountPaid ?? 0);
    const balanceDue = Math.max(0, Math.round((finalAmt - paid) * 100) / 100);
    const creditBalance = Math.max(0, Math.round((paid - finalAmt) * 100) / 100);
    return {
      finalBookingAmount: finalAmt,
      currency: invoice.currency || fallback?.currency || resolvedBooking?.currency || 'USD',
      amountPaid: paid,
      balanceDue,
      creditBalance,
      sourcePricingSnapshotId:
        invoice.sourcePricingSnapshotId ||
        fallback?.sourcePricingSnapshotId ||
        `SNAP-v${invoice.sourcePricingSnapshotVersion || fallback?.sourcePricingSnapshotVersion || 1}`,
      sourcePricingSnapshotVersion:
        invoice.sourcePricingSnapshotVersion || fallback?.sourcePricingSnapshotVersion || 1
    };
  }, [resolvedBooking, invoice]);

  const freshness = useMemo(() => {
    const siblingInvoices = resolvedBooking ? db.getBookingInvoices(resolvedBooking.id) : undefined;
    return evaluateProformaInvoiceFreshness(invoice, resolvedBooking, siblingInvoices);
  }, [invoice, resolvedBooking, db]);

  const scopeServices = useMemo(() => {
    if (invoice.services && invoice.services.length > 0) {
      return invoice.services.map((srv: any, idx: number) => ({
        id: srv.id || `srv-${idx}`,
        name: srv.description || srv.serviceName || srv.productName || 'Travel Service',
        category: srv.category || 'Service',
        date: srv.serviceDate || srv.travelDate || 'Scheduled',
        pax: srv.pax || srv.quantity || invoice.totalPax || 1
      }));
    }
    if (resolvedBooking?.items && resolvedBooking.items.length > 0) {
      return sortBookingItemsChronologically(
        resolvedBooking.items
          .filter(it => !it.isCancelled && it.operationalStatus !== 'Cancelled')
          .map(it => hydrateBookingServiceItem(it, resolvedBooking))
      ).map(it => ({
        id: it.id,
        name: it.productName,
        category: it.category || 'Service',
        date: it.resolvedServiceDate ? formatReadableDate(it.resolvedServiceDate) : 'Scheduled',
        pax: it.totalPax
      }));
    }
    return (invoice.items || []).map((srv: any, idx: number) => ({
      id: srv.id || `srv-${idx}`,
      name: srv.description || srv.serviceName || srv.productName || 'Travel Service',
      category: srv.category || 'Service',
      date: srv.serviceDate || srv.travelDate || 'Scheduled',
      pax: srv.pax || srv.quantity || 1
    }));
  }, [resolvedBooking, invoice.services, invoice.items, invoice.totalPax]);

  const handleDownloadPdf = async () => {
    if (isDownloadingPdf) return;
    setIsDownloadingPdf(true);
    try {
      await downloadProformaInvoiceDocument(invoice, resolvedBooking, companyProfile);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const isPaid = authoritative.balanceDue === 0 && authoritative.finalBookingAmount > 0;
  const isPartiallyPaid = !isPaid && authoritative.amountPaid > 0;

  const resolvedTotalPax = Math.max(
    1,
    Number(
      invoice.totalPax ||
        resolvedBooking?.customer?.totalPax ||
        ((resolvedBooking?.travelers?.adults || 0) + (resolvedBooking?.travelers?.children || 0)) ||
        1
    )
  );
  const resolvedPerPerson =
    typeof invoice.perPersonPrice === 'number' && invoice.perPersonPrice > 0
      ? invoice.perPersonPrice
      : Math.round((authoritative.finalBookingAmount / resolvedTotalPax) * 100) / 100;

  const paxSummary = invoice.totalPax
    ? `${invoice.totalPax} Passenger(s)`
    : resolvedBooking?.travelers
    ? formatPassengerBreakdown(
        resolvedBooking.travelers.adults || 0,
        resolvedBooking.travelers.children || 0,
        resolvedBooking.travelers.infants || 0
      )
    : 'As Per Booking';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl space-y-6 my-8 border border-slate-200 max-h-[92vh] overflow-y-auto">
        {/* Top Control Bar (Hidden on Print) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-50 text-[#008f77]">
              <Receipt className="w-5 h-5 text-[#008f77]" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <span>PROFORMA INVOICE</span>
                <span className="font-mono text-xs text-slate-500 font-normal">#{invoice.invoiceNumber}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-teal-50 text-[#008f77] border border-teal-200">
                  v{invoice.invoiceVersion || 1}
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Booking #{invoice.bookingReference} • Snapshot {authoritative.sourcePricingSnapshotId}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              className="px-4 py-2 rounded-xl bg-[#008972] hover:bg-[#007360] text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-60"
            >
              {isDownloadingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>Download Proforma PDF</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              aria-label="Close Proforma Invoice"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Proforma Area */}
        <div ref={printRef} className="space-y-6 text-slate-900 bg-white">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between gap-4 pb-5 border-b border-slate-200">
            <div className="space-y-1">
              <div className="text-xl font-black tracking-tight text-slate-950 flex items-center gap-2">
                <Building2 className="w-6 h-6 text-[#008f77]" />
                <span>{companyProfile.legalName || companyProfile.companyName || invoice.companyName}</span>
              </div>
              <p className="text-xs text-[#008f77] font-bold">
                PROFORMA INVOICE — Preliminary Commercial &amp; Payment Reference (Not a Tax Invoice)
              </p>
              <div className="text-xs text-slate-500 space-y-0.5 pt-1">
                <p>
                  <strong>Registered Address:</strong>{' '}
                  {companyProfile.registeredAddress || invoice.companyRegisteredAddress || invoice.companyAddress}
                </p>
                {(companyProfile.currentAddress || invoice.companyCurrentAddress) && (
                  <p>
                    <strong>Current Address:</strong>{' '}
                    {companyProfile.currentAddress || invoice.companyCurrentAddress}
                  </p>
                )}
                <p>
                  Contact: {companyProfile.email || invoice.companyEmail || companyProfile.salesEmail} •{' '}
                  {companyProfile.phone || invoice.companyPhone}
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right space-y-1.5">
              <div className="inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-slate-900 text-white">
                PROFORMA INVOICE
              </div>
              <div>
                <span
                  className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider border ${
                    isPaid
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : isPartiallyPaid
                      ? 'bg-amber-50 text-amber-800 border-amber-300'
                      : 'bg-blue-50 text-blue-800 border-blue-300'
                  }`}
                >
                  {isPaid ? 'PAID' : isPartiallyPaid ? 'PARTIALLY PAID' : 'UNPAID'}
                </span>
              </div>
              <div className="text-sm font-black font-mono text-slate-900 pt-1">
                #{invoice.invoiceNumber}
              </div>
              <div className="text-xs text-slate-500">
                Issued: <strong className="text-slate-700">{formatReadableDate(invoice.invoiceDate || invoice.issueDate)}</strong>
              </div>
              <div className="text-xs text-slate-500">
                Due Date: <strong className="text-slate-700">{invoice.dueDate ? formatReadableDate(invoice.dueDate) : 'Prior to Cut-off'}</strong>
              </div>
            </div>
          </div>

          {/* Outdated / Superseded Snapshot Banner (Historical Invoice Remains Strictly Immutable) */}
          {(freshness.isOutdated || freshness.isSupersededByNewerVersion) && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 flex items-start gap-2.5 text-xs text-amber-950 print:hidden">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold">
                  {freshness.statusLabel === 'SUPERSEDED'
                    ? 'Superseded Historical Proforma Invoice (Immutable Record)'
                    : 'Outdated Proforma Invoice — Booking Price Was Revised After Issuance'}
                </p>
                <p className="text-[11px] text-amber-900 leading-relaxed">
                  {freshness.reason ||
                    `This invoice remains locked to Snapshot v${freshness.invoiceSnapshotVersion}. Current booking pricing is Snapshot v${freshness.latestSnapshotVersion}.`}
                </p>
              </div>
            </div>
          )}

          {/* Explicit Proforma Notice */}
          <div className="p-3.5 rounded-2xl bg-teal-50/70 border border-teal-200/80 flex items-start gap-2.5 text-xs text-teal-950">
            <Info className="w-4 h-4 text-[#008972] shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              {invoice.documentNotice ||
                'This document is a Proforma Invoice issued solely for booking confirmation and payment remittance purposes. It is not a final statutory invoice.'}
            </p>
          </div>

          {/* Billed To & Booking Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Billed To</span>
              <p className="text-sm font-black text-slate-900">
                {invoice.agencyName || invoice.billedToAgency || resolvedBooking?.agencyName || 'Direct Partner'}
              </p>
              <p className="text-slate-700 font-semibold">
                Attn: {invoice.customerName || invoice.billedToName || resolvedBooking?.customer?.leadTravelerName || 'Booking Contact'}
              </p>
              <p className="text-slate-600">{invoice.customerEmail || invoice.billedToEmail}</p>
              {invoice.billingAddress && <p className="text-slate-500">{invoice.billingAddress}</p>}
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Booking Summary</span>
              <p className="text-slate-700">
                <strong className="text-slate-900">Booking Ref:</strong> #{invoice.bookingReference}
              </p>
              <p className="text-slate-700">
                <strong className="text-slate-900">Destination:</strong> {invoice.destination || resolvedBooking?.destination || 'Ground Itinerary'}
              </p>
              <p className="text-slate-700">
                <strong className="text-slate-900">Travel Dates:</strong> {invoice.travelDates || `${resolvedBooking?.travelStartDate || ''} - ${resolvedBooking?.travelEndDate || ''}`}
              </p>
              <p className="text-slate-700">
                <strong className="text-slate-900">Passengers:</strong> {paxSummary} ({formatCurrency(resolvedPerPerson, authoritative.currency)} / pax)
              </p>
            </div>
          </div>

          {/* Scope of Booked Services (Descriptive schedule ONLY — NO separate tax/fee/price breakdown) */}
          {scopeServices.length > 0 && (
            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider">
                <span>Booked Services Scope ({scopeServices.length})</span>
                <span>Currency: {authoritative.currency}</span>
              </div>
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-4 font-bold">#</th>
                    <th className="py-2.5 px-4 font-bold">Service Description</th>
                    <th className="py-2.5 px-4 font-bold">Category</th>
                    <th className="py-2.5 px-4 font-bold">Service Date</th>
                    <th className="py-2.5 px-4 font-bold text-right">PAX</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {scopeServices.map((srv, idx) => (
                    <tr key={srv.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-4 font-mono text-slate-400 font-bold">{idx + 1}</td>
                      <td className="py-2.5 px-4 font-bold text-slate-900">{srv.name}</td>
                      <td className="py-2.5 px-4 text-slate-600">{srv.category}</td>
                      <td className="py-2.5 px-4 text-slate-600">{srv.date}</td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-700">{srv.pax}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Authoritative Commercial Total — FINAL BOOKING AMOUNT ONLY */}
          <div className="rounded-2xl bg-slate-950 text-white p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-black uppercase tracking-widest text-teal-300">
                  Final Booking Amount
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Authoritative consolidated total from committed booking snapshot ({authoritative.sourcePricingSnapshotId}).
                </p>
              </div>
              <div className="text-2xl font-black font-mono text-white">
                {formatCurrency(authoritative.finalBookingAmount, authoritative.currency)}
              </div>
            </div>

            {authoritative.amountPaid > 0 && (
              <div className="pt-3 border-t border-slate-800 space-y-1.5 text-xs">
                <div className="flex justify-between text-emerald-300 font-semibold">
                  <span>Amount Received To Date</span>
                  <span className="font-mono">{formatCurrency(authoritative.amountPaid, authoritative.currency)}</span>
                </div>
                <div className="flex justify-between text-teal-300 font-black text-sm">
                  <span>Balance Due</span>
                  <span className="font-mono">{formatCurrency(authoritative.balanceDue, authoritative.currency)}</span>
                </div>
                {authoritative.creditBalance > 0 && (
                  <div className="flex justify-between text-amber-300 font-bold text-xs pt-1">
                    <span>Credit / Overpayment Balance</span>
                    <span className="font-mono">{formatCurrency(authoritative.creditBalance, authoritative.currency)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Payment / Bank Wire Remittance Details (Dynamically Sourced — Never Hardcoded) */}
          {invoice.bankAccountDetails && (invoice.bankAccountDetails.bankName || invoice.bankAccountDetails.accountNumber) && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
              <div className="font-black text-slate-800 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-[#008972]" />
                <span>Wire Remittance Instructions</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700">
                {invoice.bankAccountDetails.bankName && (
                  <p><strong>Bank Name:</strong> {invoice.bankAccountDetails.bankName}</p>
                )}
                {invoice.bankAccountDetails.accountName && (
                  <p><strong>Account Name:</strong> {invoice.bankAccountDetails.accountName}</p>
                )}
                {invoice.bankAccountDetails.accountNumber && (
                  <p><strong>Account Number:</strong> <span className="font-mono">{invoice.bankAccountDetails.accountNumber}</span></p>
                )}
                {invoice.bankAccountDetails.swiftBic && (
                  <p><strong>SWIFT / BIC:</strong> <span className="font-mono">{invoice.bankAccountDetails.swiftBic}</span></p>
                )}
                {invoice.bankAccountDetails.iban && (
                  <p><strong>IBAN / Routing:</strong> <span className="font-mono">{invoice.bankAccountDetails.iban}</span></p>
                )}
                <p><strong>Payment Reference:</strong> <span className="font-mono font-bold">#{invoice.bookingReference}</span></p>
              </div>
            </div>
          )}

          {/* Notes & Terms */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[11px] text-slate-600 pt-2 border-t border-slate-100">
            <div>
              <div className="font-bold text-slate-800 uppercase text-[10px] mb-1 flex items-center gap-1">
                <FileText className="w-3 h-3 text-[#008972]" /> Billing Notes
              </div>
              <p className="leading-relaxed">
                {invoice.notes || `Proforma Invoice issued for Booking Reference #${invoice.bookingReference}.`}
              </p>
            </div>
            <div>
              <div className="font-bold text-slate-800 uppercase text-[10px] mb-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-[#008972]" /> Proforma Terms
              </div>
              <p className="leading-relaxed">
                {invoice.terms || 'Payment due as per booking cut-off terms. Bank transfer charges are borne by the remitter.'}
              </p>
            </div>
          </div>

          <div className="text-[10px] text-slate-400 flex items-center justify-between pt-3 border-t border-slate-100">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Issued by {companyProfile.companyName || 'TheUnbound'}
            </span>
            <span className="font-mono">Proforma v{invoice.invoiceVersion || 1} • {authoritative.sourcePricingSnapshotId}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
