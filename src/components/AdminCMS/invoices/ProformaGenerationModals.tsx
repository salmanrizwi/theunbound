import React from 'react';
import { ProformaPreflightError } from '../../../services/proformaInvoicePreflight';
import { BookingInvoice } from '../../../types';
import { formatCurrency } from '../../../services/pricingEngine';
import { 
  AlertTriangle, 
  X, 
  CheckCircle2, 
  ExternalLink, 
  FileText, 
  Download, 
  Eye, 
  ShieldAlert,
  ArrowRight,
  UserCheck,
  DollarSign
} from 'lucide-react';

interface ErrorModalProps {
  error: ProformaPreflightError | null;
  onClose: () => void;
  onNavigateToBooking?: (bookingId: string) => void;
}

export const ProformaGenerationErrorModal: React.FC<ErrorModalProps> = ({
  error,
  onClose,
  onNavigateToBooking
}) => {
  if (!error) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden text-slate-900 font-sans">
        {/* Header */}
        <div className="bg-rose-50 border-b border-rose-100 p-5 flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-100 border border-rose-200 text-rose-700 flex items-center justify-center shrink-0 shadow-xs">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 block">
                Invoice Generation Preflight Check Failed
              </span>
              <h3 className="text-base font-black text-slate-900 tracking-tight mt-0.5">
                {error.title}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-rose-100/60 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Main Error Explanation */}
          <div className="text-xs text-slate-700 leading-relaxed font-medium">
            {error.message}
          </div>

          {/* Missing Requirements List */}
          {error.missingRequirements && error.missingRequirements.length > 0 && (
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
              <span className="text-[11px] font-bold text-slate-900 uppercase tracking-wider block">
                Required Information Missing:
              </span>
              <ul className="space-y-1.5">
                {error.missingRequirements.map((req, idx) => (
                  <li key={idx} className="flex items-center space-x-2 text-xs text-rose-900 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Actionable Instruction */}
          <div className="bg-amber-50/80 p-3.5 rounded-2xl border border-amber-200/80 text-xs text-amber-950 space-y-1">
            <span className="font-bold block text-[11px] uppercase tracking-wider text-amber-900">
              Next Action Required:
            </span>
            <p className="text-amber-800 leading-normal">
              {error.actionableInstruction}
            </p>
          </div>

          {/* Audit Reference */}
          {error.referenceId && (
            <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between pt-1 border-t border-slate-100">
              <span>System Preflight Guard Active</span>
              <span>REF: {error.referenceId}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 p-4 border-t border-slate-100 flex flex-wrap items-center justify-end gap-2">
          {error.bookingId && onNavigateToBooking && (
            <button
              onClick={() => {
                onClose();
                onNavigateToBooking(error.bookingId!);
              }}
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all cursor-pointer flex items-center space-x-2 shadow-xs"
            >
              <span>Go to Booking Details</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#00C6A6]" />
            </button>
          )}

          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

interface SuccessModalProps {
  invoice: BookingInvoice | null;
  onClose: () => void;
  onViewInvoice?: (invoice: BookingInvoice) => void;
  onDownloadPdf?: (invoice: BookingInvoice) => void;
}

export const ProformaGenerationSuccessModal: React.FC<SuccessModalProps> = ({
  invoice,
  onClose,
  onViewInvoice,
  onDownloadPdf
}) => {
  if (!invoice) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden text-slate-900 font-sans">
        {/* Header */}
        <div className="bg-emerald-50 border-b border-emerald-100 p-5 flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0 shadow-xs">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block">
                Official Commercial Document Issued
              </span>
              <h3 className="text-base font-black text-slate-900 tracking-tight mt-0.5">
                Proforma Invoice Generated
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-emerald-100/60 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
              <span className="text-xs text-slate-500 font-medium">Invoice Number</span>
              <span className="text-xs font-mono font-black text-slate-900 px-2.5 py-1 bg-white rounded-lg border border-slate-200">
                {invoice.invoiceNumber}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
              <span className="text-xs text-slate-500 font-medium">Booking Reference</span>
              <span className="text-xs font-mono font-bold text-slate-800">
                {invoice.bookingReference}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
              <span className="text-xs text-slate-500 font-medium">Billed Customer / Agent</span>
              <span className="text-xs font-bold text-slate-900">
                {invoice.customerName || invoice.billedToName}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">Total Amount</span>
              <span className="text-sm font-mono font-black text-emerald-700">
                {formatCurrency(invoice.totalAmount || 0, invoice.currency)}
              </span>
            </div>
          </div>

          <div className="text-xs text-slate-600">
            The Proforma Invoice has been saved to the database and linked to Booking <span className="font-bold font-mono text-slate-900">#{invoice.bookingReference}</span>.
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 p-4 border-t border-slate-100 flex flex-wrap items-center justify-end gap-2">
          {onViewInvoice && (
            <button
              onClick={() => {
                onClose();
                onViewInvoice(invoice);
              }}
              className="px-4 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-800 hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1.5"
            >
              <Eye className="w-3.5 h-3.5 text-slate-600" />
              <span>View Invoice</span>
            </button>
          )}

          {onDownloadPdf && (
            <button
              onClick={() => {
                onDownloadPdf(invoice);
              }}
              className="px-4 py-2.5 rounded-xl bg-[#008f77] hover:bg-[#00705d] text-white text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
