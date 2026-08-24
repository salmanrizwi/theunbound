import React, { useState } from 'react';
import { Booking, SentEmailRecord } from '../types';
import { formatCurrency } from '../services/pricingEngine';
import { 
  CheckCircle2, 
  X, 
  Copy, 
  Check, 
  Mail, 
  Clock, 
  ShieldCheck, 
  Printer, 
  Phone, 
  ExternalLink,
  ChevronRight,
  Send,
  FileCheck
} from 'lucide-react';

interface BookingConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  onOpenMyBookings?: () => void;
}

export const BookingConfirmationModal: React.FC<BookingConfirmationModalProps> = ({
  isOpen,
  onClose,
  booking,
  onOpenMyBookings
}) => {
  const [copiedRef, setCopiedRef] = useState(false);
  const [activeEmailTab, setActiveEmailTab] = useState<'CLIENT' | 'DMC'>('CLIENT');

  if (!isOpen || !booking) return null;

  const handleCopyRef = () => {
    navigator.clipboard.writeText(booking.bookingReference);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  const clientEmail = booking.notificationEmailsSent.find(e => e.recipientType === 'CLIENT_AGENT');
  const dmcEmail = booking.notificationEmailsSent.find(e => e.recipientType === 'DMC_OPS');

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-3xl w-full overflow-hidden my-auto max-h-[92vh] flex flex-col">
        
        {/* Modal Header Banner */}
        <div className="bg-slate-900 text-white p-6 relative overflow-hidden shrink-0 border-b-2 border-[#00C6A6]">
          <div className="flex items-start justify-between relative z-10">
            <div className="flex items-center space-x-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#00E5C0] bg-white/10 px-2 py-0.5 rounded-md">
                  Reservation Received
                </span>
                <h2 className="text-2xl font-black font-sans mt-1 text-white">
                  Booking Request Submitted!
                </h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  Reference: <span className="font-mono font-bold text-white">{booking.bookingReference}</span>
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 24-48 Hour SLA Notification Alert Banner */}
        <div className="bg-emerald-50 border-b border-emerald-200 p-4 sm:p-5 flex items-start space-x-3.5 shrink-0">
          <Clock className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="text-xs font-black text-emerald-950 uppercase tracking-wider block">
              24–48 Hours Update Notice
            </span>
            <p className="text-xs text-emerald-800 leading-relaxed font-medium">
              Your booking has been submitted and will be updated in <strong>24–48 Hrs</strong>. Automated confirmation emails have been dispatched to <strong>{booking.customer.email}</strong> and <strong>sales@theunbound.in</strong>.
            </p>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          
          {/* Quick Info Ribbon */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Booking Reference</span>
              <div className="flex items-center space-x-1.5 mt-1">
                <span className="font-mono font-bold text-xs text-slate-900 truncate">{booking.bookingReference}</span>
                <button
                  onClick={handleCopyRef}
                  className="p-1 hover:bg-slate-200 rounded text-slate-600 transition-colors cursor-pointer"
                  title="Copy Reference Code"
                >
                  {copiedRef ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Lead Traveler</span>
              <span className="font-bold text-xs text-slate-900 block truncate mt-1">{booking.customer.leadTravelerName}</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Status</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-200 mt-1">
                Pending 24-48h Update
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900 text-white">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#00E5C0] block">Total Amount</span>
              <span className="font-mono font-extrabold text-sm text-[#00E5C0] block mt-1">
                {formatCurrency(booking.totalAmount, booking.currency)}
              </span>
            </div>
          </div>

          {/* Booked Services Breakdown */}
          <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
              <FileCheck className="w-4 h-4 text-[#008972]" />
              <span>Booked Ground Services ({booking.items.length})</span>
            </h4>

            <div className="space-y-2">
              {booking.items.map((item, idx) => (
                <div key={idx} className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-slate-900">{item.productName}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      📅 {item.travelDate} • 📍 {item.destinationName} ({item.city}) • 👥 {item.totalPax} Pax
                    </div>
                    {item.selectedAddonNames && item.selectedAddonNames.length > 0 && (
                      <div className="text-[10px] text-sky-600 font-medium mt-0.5">
                        + Addons: {item.selectedAddonNames.join(', ')}
                      </div>
                    )}
                  </div>
                  <div className="text-right font-mono font-bold text-slate-900">
                    {formatCurrency(item.totalPrice, item.currency)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Automated Email Transcripts Preview Box */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <div className="bg-slate-900 p-3.5 flex items-center justify-between text-white">
              <div className="flex items-center space-x-2">
                <Mail className="w-4 h-4 text-[#00E5C0]" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Automated Email Notification Transcripts
                </span>
              </div>
              
              <div className="flex items-center space-x-1 bg-white/10 p-0.5 rounded-lg text-xs">
                <button
                  onClick={() => setActiveEmailTab('CLIENT')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                    activeEmailTab === 'CLIENT'
                      ? 'bg-white text-slate-900'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  To Traveler / Agent
                </button>
                <button
                  onClick={() => setActiveEmailTab('DMC')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                    activeEmailTab === 'DMC'
                      ? 'bg-white text-slate-900'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  To DMC Operations Desk
                </button>
              </div>
            </div>

            <div className="p-4 bg-slate-50 text-xs border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-slate-600 font-medium">
              <div>
                <strong>Recipient:</strong> <span className="font-mono text-slate-900">{activeEmailTab === 'CLIENT' ? booking.customer.email : 'sales@theunbound.in'}</span>
              </div>
              <div>
                <strong>Subject:</strong> <span className="text-slate-900">{activeEmailTab === 'CLIENT' ? clientEmail?.subject : dmcEmail?.subject}</span>
              </div>
            </div>

            {/* Email HTML Preview Frame */}
            <div className="p-4 bg-white max-h-72 overflow-y-auto">
              <div 
                dangerouslySetInnerHTML={{ 
                  __html: activeEmailTab === 'CLIENT' ? (clientEmail?.fullHtml || '') : (dmcEmail?.fullHtml || '') 
                }} 
              />
            </div>
          </div>

          {/* Operational Contact Assistance */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-slate-200 flex items-center justify-center text-slate-700 shrink-0">
                <Phone className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-slate-900 block">Need Immediate Ground Support?</span>
                <span className="text-slate-600 text-[11px]">
                  Landline: 011-41185542 • WhatsApp: +91-9811654959, +91-9718894959
                </span>
              </div>
            </div>

            <a
              href="mailto:sales@theunbound.in"
              className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl text-slate-800 font-bold text-xs transition-colors shrink-0"
            >
              Email Operations Desk
            </a>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <button
            onClick={() => window.print()}
            className="w-full sm:w-auto px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Booking Dossier</span>
          </button>

          <div className="flex items-center space-x-3 w-full sm:w-auto">
            {onOpenMyBookings && (
              <button
                onClick={() => {
                  onClose();
                  onOpenMyBookings();
                }}
                className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                View in My Bookings
              </button>
            )}

            <button
              onClick={onClose}
              className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
