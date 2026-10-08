import React, { useState } from 'react';
import { TravelLead, BookingInvoice, Booking, User } from '../../../types';
import { formatCurrency } from '../../../services/pricingEngine';
import { 
  Receipt, 
  DollarSign, 
  CreditCard, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Printer, 
  Plus, 
  ShieldCheck, 
  FileText,
  Building2,
  TrendingUp
} from 'lucide-react';

interface LeadFinancialsTabProps {
  lead: TravelLead;
  linkedInvoices: BookingInvoice[];
  financialSummary: {
    totalSellingPrice: number;
    totalNetCost: number;
    totalGrossMargin: number;
    marginPercentage: number;
    totalPaidAmount: number;
    totalBalanceDue: number;
    paymentStatus: 'PAID' | 'PARTIALLY_PAID' | 'UNPAID';
    currency: string;
    bookingsCount: number;
    invoicesCount: number;
    activeInvoiceId?: string;
  } | null;
  linkedBookings: Booking[];
  currentUser: User | null;
  onViewInvoice: (invoice: BookingInvoice) => void;
  onGenerateInvoice: (bookingId: string) => void;
}

export const LeadFinancialsTab: React.FC<LeadFinancialsTabProps> = ({
  lead,
  linkedInvoices,
  financialSummary,
  linkedBookings,
  currentUser,
  onViewInvoice,
  onGenerateInvoice
}) => {
  const isInternal = currentUser?.role === 'ADMIN' || currentUser?.role === 'TEAM_MEMBER' || currentUser?.role === 'DMC_STAFF';
  const currency = financialSummary?.currency || lead.currency || 'USD';

  // Gather all payment proofs from connected bookings
  const allPaymentProofs = linkedBookings.flatMap(b => 
    (b.paymentProofs || []).map(p => ({
      ...p,
      bookingReference: b.bookingReference
    }))
  );

  return (
    <div className="space-y-6">
      {/* 1. Commercial Financial Summary KPI Cards */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Receipt className="w-4 h-4 text-[#00C6A6]" />
              <span>Commercial & Financial Balance Summary</span>
            </h3>
            <p className="text-xs text-slate-500">
              Aggregated settlement balances across all connected operational bookings and invoices.
            </p>
          </div>

          {financialSummary && financialSummary.paymentStatus && (
            <span className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider border self-start sm:self-auto ${
              financialSummary.paymentStatus === 'PAID'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : financialSummary.paymentStatus === 'PARTIALLY_PAID'
                ? 'bg-amber-50 text-amber-800 border-amber-300'
                : 'bg-blue-50 text-blue-800 border-blue-300'
            }`}>
              {(financialSummary.paymentStatus || 'UNPAID').replace(/_/g, ' ')}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
            <span className="text-slate-400 font-semibold block text-[11px]">Total Selling Price</span>
            <span className="font-mono font-black text-slate-900 text-base sm:text-lg mt-0.5 block">
              {formatCurrency(financialSummary?.totalSellingPrice || 0, currency)}
            </span>
            <span className="text-[10px] text-slate-500 mt-1 block">
              {financialSummary?.bookingsCount || 0} Operational Bookings
            </span>
          </div>

          <div className="p-3.5 bg-emerald-50/50 rounded-2xl border border-emerald-100">
            <span className="text-emerald-700 font-semibold block text-[11px]">Received Payments</span>
            <span className="font-mono font-black text-emerald-800 text-base sm:text-lg mt-0.5 block">
              {formatCurrency(financialSummary?.totalPaidAmount || 0, currency)}
            </span>
            <span className="text-[10px] text-emerald-600 mt-1 block">
              Verified & Deposited
            </span>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
            <span className="text-slate-400 font-semibold block text-[11px]">Outstanding Balance</span>
            <span className={`font-mono font-black text-base sm:text-lg mt-0.5 block ${
              (financialSummary?.totalBalanceDue || 0) > 0 ? 'text-[#008f77]' : 'text-emerald-700'
            }`}>
              {formatCurrency(financialSummary?.totalBalanceDue || 0, currency)}
            </span>
            <span className="text-[10px] text-slate-500 mt-1 block">
              Pending Settlement
            </span>
          </div>

          {/* Internal Staff Commercial Margin or Client Payment Status */}
          {isInternal ? (
            <div className="p-3.5 bg-teal-50/50 rounded-2xl border border-teal-100">
              <span className="text-[#008f77] font-semibold block text-[11px]">Realized Gross Margin</span>
              <span className="font-mono font-black text-[#008f77] text-base sm:text-lg mt-0.5 block">
                {formatCurrency(financialSummary?.totalGrossMargin || 0, currency)}
              </span>
              <span className="text-[10px] text-[#00705d] font-bold mt-1 block">
                {financialSummary?.marginPercentage || 0}% Target Margin
              </span>
            </div>
          ) : (
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="text-slate-400 font-semibold block text-[11px]">Invoices Issued</span>
              <span className="font-mono font-black text-slate-900 text-base sm:text-lg mt-0.5 block">
                {linkedInvoices.length}
              </span>
              <span className="text-[10px] text-slate-500 mt-1 block">
                Commercial Proformas
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Proforma Invoices Table */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Receipt className="w-4 h-4 text-[#00C6A6]" />
              <span>Commercial Proforma Invoices ({linkedInvoices.length})</span>
            </h3>
            <p className="text-xs text-slate-500">
              Official DMC proforma invoice documents tied to operational ground bookings.
            </p>
          </div>

          {linkedBookings.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onGenerateInvoice(linkedBookings[0].id)}
                className="px-3 py-1.5 rounded-xl bg-[#008f77] hover:bg-[#00705d] text-white text-xs font-bold transition-colors cursor-pointer flex items-center shadow-xs"
              >
                <span>Issue Proforma Invoice</span>
              </button>
            </div>
          )}
        </div>

        {linkedInvoices.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-500 space-y-2">
            <Receipt className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-700">No Invoices Issued Yet</p>
            <p className="text-slate-400 max-w-sm mx-auto">
              Once a ground booking is created, generate a Proforma Invoice with wire transfer remittance instructions.
            </p>
          </div>
        ) : (
          <div className="border border-slate-200 rounded-2xl overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                  <th className="py-2.5 px-4">Invoice #</th>
                  <th className="py-2.5 px-4">Booking Ref</th>
                  <th className="py-2.5 px-4">Issue / Due Date</th>
                  <th className="py-2.5 px-4">Billed To</th>
                  <th className="py-2.5 px-4 text-right">Total Amount</th>
                  <th className="py-2.5 px-4 text-right">Balance Due</th>
                  <th className="py-2.5 px-4 text-center">Status</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {linkedInvoices.map(invoice => (
                  <tr key={invoice.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {invoice.invoiceNumber}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700">
                      #{invoice.bookingReference}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      <div>{new Date(invoice.issueDate).toLocaleDateString()}</div>
                      {invoice.dueDate && (
                        <div className="text-[10px] text-slate-400">
                          Due: {new Date(invoice.dueDate).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-800 font-semibold">
                      {invoice.billedToAgency || invoice.billedToName || 'Direct VIP'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      {formatCurrency(invoice.totalAmount || 0, invoice.currency)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-[#008f77]">
                      {formatCurrency(invoice.balanceDue || 0, invoice.currency)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border inline-block ${
                        invoice.paymentStatus === 'PAID'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : invoice.paymentStatus === 'PARTIALLY_PAID'
                          ? 'bg-amber-50 text-amber-800 border-amber-300'
                          : 'bg-blue-50 text-blue-800 border-blue-300'
                      }`}>
                        {invoice.paymentStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => onViewInvoice(invoice)}
                        className="px-3 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                      >
                        <Printer className="w-3 h-3" />
                        <span>View / Print</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. Payment Tranches & Uploaded Payment Proofs */}
      {allPaymentProofs.length > 0 && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-[#00C6A6]" />
            <span>Remittance Proofs & Verification History ({allPaymentProofs.length})</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {allPaymentProofs.map((proof, idx) => (
              <div 
                key={proof.id || idx}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">
                    {proof.trancheLabel || `Payment Tranche #${idx + 1}`}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    proof.status === 'VERIFIED'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : proof.status === 'REJECTED'
                      ? 'bg-rose-50 text-rose-800 border-rose-300'
                      : 'bg-amber-50 text-amber-800 border-amber-300'
                  }`}>
                    {proof.status || 'PENDING'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <span>Amount: <strong className="font-mono text-slate-900">{formatCurrency(proof.amount, proof.currency)}</strong></span>
                  <span>Booking: <strong className="font-mono text-slate-800">#{proof.bookingReference}</strong></span>
                </div>

                {proof.paymentMethod && (
                  <div className="text-[11px] text-slate-500">
                    Method: {proof.paymentMethod} {proof.transactionRef ? `• Ref: ${proof.transactionRef}` : ''}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
