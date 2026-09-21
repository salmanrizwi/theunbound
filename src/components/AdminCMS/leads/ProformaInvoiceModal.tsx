import React, { useRef } from 'react';
import { BookingInvoice } from '../../../types';
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
  AlertCircle,
  FileText
} from 'lucide-react';

interface ProformaInvoiceModalProps {
  invoice: BookingInvoice;
  onClose: () => void;
}

export const ProformaInvoiceModal: React.FC<ProformaInvoiceModalProps> = ({
  invoice,
  onClose
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const isPaid = invoice.paymentStatus === 'PAID';
  const isPartiallyPaid = invoice.paymentStatus === 'PARTIALLY_PAID';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl space-y-6 my-8 border border-slate-200">
        
        {/* Top Control Bar (Hidden on Print) */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 print:hidden">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-teal-50 text-[#008f77]">
              <Receipt className="w-5 h-5 text-[#008f77]" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <span>Proforma Invoice</span>
                <span className="font-mono text-xs text-slate-500 font-normal">#{invoice.invoiceNumber}</span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Authoritative commercial proforma connected to Booking #{invoice.bookingReference}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Invoice Printable Area */}
        <div ref={printRef} className="space-y-6 text-slate-900 bg-white">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between gap-4 pb-6 border-b border-slate-200">
            <div>
              <div className="text-xl font-black tracking-tight text-slate-950 flex items-center gap-2">
                <Building2 className="w-6 h-6 text-[#008f77]" />
                <span>The Unbound Luxury Travel</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">Ground Handling & Destination Management Operations</p>
              <p className="text-xs text-slate-500">Registration: TUB-DMC-882910 • GSTIN: 27AABCT1234F1Z5</p>
              <p className="text-xs text-slate-500">Contact: accounts@theunbound.in • +91 22 4900 8800</p>
            </div>

            <div className="text-left sm:text-right space-y-1">
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider border ${
                isPaid 
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                  : isPartiallyPaid 
                  ? 'bg-amber-50 text-amber-800 border-amber-300' 
                  : 'bg-blue-50 text-blue-800 border-blue-300'
              }`}>
                {(invoice.paymentStatus || 'UNPAID').replace(/_/g, ' ')}
              </span>
              <div className="font-mono text-sm font-black text-slate-900 mt-2">
                {invoice.invoiceNumber}
              </div>
              <div className="text-xs text-slate-500">
                Issue Date: <strong className="text-slate-800">{new Date(invoice.issueDate).toLocaleDateString()}</strong>
              </div>
              {invoice.dueDate && (
                <div className="text-xs text-slate-500">
                  Payment Due: <strong className="text-slate-800">{new Date(invoice.dueDate).toLocaleDateString()}</strong>
                </div>
              )}
            </div>
          </div>

          {/* Billed To & Booking Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Billed To (B2B Partner / Client)
              </span>
              <div className="font-bold text-sm text-slate-900">
                {invoice.billedToAgency || invoice.billedToName || 'Direct VIP Client'}
              </div>
              {invoice.billedToAgency && invoice.billedToName && (
                <div className="text-slate-600 mt-0.5">Attn: {invoice.billedToName}</div>
              )}
              {invoice.billedToEmail && (
                <div className="text-slate-500 mt-0.5">{invoice.billedToEmail}</div>
              )}
              {invoice.billedToGstin && (
                <div className="text-slate-500 mt-0.5 font-mono">GSTIN: {invoice.billedToGstin}</div>
              )}
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Operational Booking Details
              </span>
              <div className="text-slate-700">
                Booking Reference: <strong className="font-mono text-slate-900">#{invoice.bookingReference}</strong>
              </div>
              {invoice.leadTravelerName && (
                <div className="text-slate-700 mt-0.5">
                  Lead Traveler: <strong className="text-slate-900">{invoice.leadTravelerName}</strong> ({invoice.totalPax || 1} Pax)
                </div>
              )}
              {invoice.destination && (
                <div className="text-slate-700 mt-0.5">
                  Destination: <strong className="text-slate-900">{invoice.destination}</strong>
                </div>
              )}
              {invoice.travelDates && (
                <div className="text-slate-700 mt-0.5">
                  Travel Dates: <strong className="text-slate-900">{invoice.travelDates}</strong>
                </div>
              )}
            </div>
          </div>

          {/* Services & Line Items Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                  <th className="py-2.5 px-4">#</th>
                  <th className="py-2.5 px-4">Service Description</th>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4 text-center">Pax</th>
                  <th className="py-2.5 px-4 text-right">Selling Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoice.items && invoice.items.length > 0 ? (
                  invoice.items.map((item, idx) => (
                    <tr key={item.id || idx} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 block">{item.productName}</span>
                        {item.category && (
                          <span className="text-[10px] text-slate-500 uppercase">{item.category}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{item.serviceDate || 'Scheduled'}</td>
                      <td className="py-3 px-4 text-center font-semibold text-slate-700">{item.pax || 1}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(item.totalPrice || 0, invoice.currency)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="py-3 px-4 text-slate-400 font-mono">1</td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      Ground Itinerary Arrangements & VIP Concierge
                    </td>
                    <td className="py-3 px-4 text-slate-600">{invoice.travelDates || 'TBA'}</td>
                    <td className="py-3 px-4 text-center font-semibold text-slate-700">{invoice.totalPax || 1}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      {formatCurrency(invoice.totalAmount || 0, invoice.currency)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Totals & Settlement Calculation */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pt-2">
            {/* Bank Remittance Info */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs w-full sm:max-w-xs space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Remittance & Wire Transfer Details
              </span>
              <p className="text-slate-700"><strong>Bank:</strong> Standard Chartered Bank</p>
              <p className="text-slate-700"><strong>A/C Name:</strong> The Unbound Travel Pvt Ltd</p>
              <p className="text-slate-700 font-mono"><strong>A/C No:</strong> 019283746501</p>
              <p className="text-slate-700 font-mono"><strong>SWIFT / IFSC:</strong> SCBLINBBXXX</p>
              <p className="text-[11px] text-slate-500 mt-2 italic">
                *Please quote Proforma #{invoice.invoiceNumber} on remittance instructions.
              </p>
            </div>

            {/* Financial Totals */}
            <div className="w-full sm:max-w-xs space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Gross Itinerary Total:</span>
                <span className="font-mono font-bold text-slate-900">
                  {formatCurrency(invoice.totalAmount || 0, invoice.currency)}
                </span>
              </div>

              {invoice.taxAmount !== undefined && invoice.taxAmount > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Applicable GST / Taxes:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatCurrency(invoice.taxAmount, invoice.currency)}
                  </span>
                </div>
              )}

              <div className="flex justify-between text-slate-600">
                <span>Payments Received:</span>
                <span className="font-mono font-bold text-emerald-700">
                  - {formatCurrency(invoice.paidAmount || 0, invoice.currency)}
                </span>
              </div>

              <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-black text-slate-900">
                <span>Balance Due:</span>
                <span className={`font-mono ${invoice.balanceDue > 0 ? 'text-[#008f77]' : 'text-emerald-700'}`}>
                  {formatCurrency(invoice.balanceDue || 0, invoice.currency)}
                </span>
              </div>
            </div>
          </div>

          {/* Operational & Booking Notes */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-500 leading-relaxed">
            <strong className="text-slate-700">Terms & Confirmation Policy:</strong> This document represents an authoritative commercial proforma invoice issued against ground operational booking #{invoice.bookingReference}. Activity and booking vouchers are issued upon receipt of scheduled advance deposit. Services are subject to DMC general ground fulfillment terms.
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 print:hidden">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 rounded-xl bg-[#008f77] hover:bg-[#00705d] text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / Save PDF</span>
          </button>
        </div>

      </div>
    </div>
  );
};
