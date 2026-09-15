import React, { useRef } from 'react';
import { BookingVoucher } from '../../types';
import { 
  Printer, 
  Download, 
  CheckCircle2, 
  MapPin, 
  Calendar, 
  Clock, 
  Users, 
  Phone, 
  FileText, 
  ShieldCheck, 
  AlertTriangle,
  Building2,
  Share2,
  X
} from 'lucide-react';

interface VoucherDocumentViewProps {
  voucher: BookingVoucher;
  onClose?: () => void;
  onRegenerate?: () => void;
  isOutdated?: boolean;
}

export const VoucherDocumentView: React.FC<VoucherDocumentViewProps> = ({
  voucher,
  onClose,
  onRegenerate,
  isOutdated = false
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const serviceItems = voucher.serviceItemsSnapshot || [
    {
      itemId: voucher.serviceItemId || 'srv-1',
      productName: voucher.serviceName,
      category: 'GROUND_SERVICE',
      destination: voucher.destination,
      city: voucher.city,
      serviceDate: voucher.serviceDate,
      serviceTime: voucher.serviceTime,
      supplierName: voucher.supplierName,
      supplierConfirmationRef: voucher.supplierConfirmationRef || 'CONFIRMED',
      adults: voucher.totalPax,
      totalPax: voucher.totalPax,
      meetingPoint: voucher.meetingPoint
    }
  ];

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden print:shadow-none print:border-none">
      {/* Top Action Bar */}
      <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center font-black text-xs">
            TUB
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">Official Service Voucher</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-teal-500/30 text-teal-300 border border-teal-500/40">
                v{voucher.version || 1}
              </span>
              {isOutdated && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/30 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Potentially Outdated
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              Voucher No: {voucher.voucherNumber} • Ref: {voucher.bookingReference}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isOutdated && onRegenerate && (
            <button
              onClick={onRegenerate}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              Regenerate Voucher
            </button>
          )}
          <button
            onClick={handlePrint}
            className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" /> Print / PDF
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {isOutdated && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center justify-between text-xs text-amber-900 print:hidden">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Attention:</strong> One or more service items or supplier pricing details were modified after this voucher was generated. Please regenerate to guarantee operational accuracy.
            </span>
          </div>
        </div>
      )}

      {/* Printable Document Body */}
      <div ref={printRef} className="p-8 space-y-8 print:p-0 print:space-y-6">
        {/* Document Header */}
        <div className="border-b-2 border-slate-900 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black tracking-tight text-slate-950 font-serif">TheUnbound</span>
              <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold uppercase tracking-wider">
                DMC & Ground Logistics
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Unbound Experiences India Pvt Ltd • Authorized Destination Management Network
            </p>
            <p className="text-[11px] text-slate-400">
              Emergency Dispatch 24/7: +91 9811654959 • operations@theunbound.in
            </p>
          </div>

          <div className="text-left md:text-right bg-slate-50 md:bg-transparent p-4 md:p-0 rounded-2xl md:rounded-none border md:border-none border-slate-200">
            <span className="text-[10px] font-black uppercase tracking-widest text-teal-700 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-full">
              CONFIRMED GROUND VOUCHER
            </span>
            <div className="mt-2 text-lg font-black text-slate-900 tracking-tight">
              {voucher.voucherNumber}
            </div>
            <p className="text-xs text-slate-600 font-medium">
              Booking Ref: <strong className="text-slate-900">{voucher.bookingReference}</strong>
            </p>
            <p className="text-[11px] text-slate-400">
              Issued Date: {new Date(voucher.issuedAt || voucher.generatedAt || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Lead Passenger & Booking Details Bento */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              <Users className="w-3.5 h-3.5 text-teal-600" />
              Lead Traveler & Party
            </div>
            <div className="text-sm font-black text-slate-900">
              {voucher.leadPaxName || voucher.customerName || 'Primary Guest'}
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Total Party: <strong>{voucher.totalPax} Traveler(s)</strong>
            </p>
            {voucher.passengerBreakdown && (
              <p className="text-[11px] text-slate-500 mt-0.5">
                {voucher.passengerBreakdown}
              </p>
            )}
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              <Calendar className="w-3.5 h-3.5 text-teal-600" />
              Travel Itinerary & Dates
            </div>
            <div className="text-sm font-black text-slate-900">
              {voucher.destination || 'Destination Ground Package'}
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Service Date: <strong>{voucher.serviceDate}</strong>
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Scheduled Time: {voucher.serviceTime || '09:00 AM (Check individual service)'}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-teal-50/50 border border-teal-200">
            <div className="flex items-center gap-2 text-xs font-bold text-teal-800 uppercase tracking-wider mb-2">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
              Confirmation Status
            </div>
            <div className="text-sm font-black text-teal-950 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
              Operational Lock Active
            </div>
            <p className="text-xs text-teal-900/80 mt-1">
              Supplier Ref: <strong>{voucher.supplierConfirmationRef || 'Direct Ground Allocation'}</strong>
            </p>
            <p className="text-[10px] text-teal-700/80 mt-0.5">
              Present this voucher upon check-in or chauffeur meetup.
            </p>
          </div>
        </div>

        {/* Confirmed Services Breakdown Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-teal-600" />
              Confirmed Service Items ({serviceItems.length})
            </h4>
            <span className="text-[11px] text-slate-500 font-medium">
              Verified ground arrangements
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-700 uppercase font-black tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Service & Details</th>
                  <th className="px-4 py-3">Date & Time</th>
                  <th className="px-4 py-3">Location / Hub</th>
                  <th className="px-4 py-3">Supplier & Confirmation Ref</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {serviceItems.map((item: any, idx: number) => (
                  <tr key={item.itemId || idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3.5 font-black text-slate-400 text-xs">
                      {idx + 1}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-slate-900">{item.productName || item.serviceName}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                        <span>Category: {item.category || 'Ground Service'}</span>
                        <span>•</span>
                        <span>Party: {item.totalPax || voucher.totalPax} Pax</span>
                      </div>
                      {item.meetingPoint && (
                        <div className="text-[11px] text-teal-800 mt-1 flex items-start gap-1">
                          <MapPin className="w-3 h-3 text-teal-600 shrink-0 mt-0.5" />
                          <span>Meeting / Pickup: {item.meetingPoint}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="font-bold text-slate-900">{item.serviceDate || voucher.serviceDate}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {item.serviceTime || '09:00 AM'}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-slate-800">{item.city || item.destination || voucher.destination}</div>
                      <div className="text-[11px] text-slate-400">{voucher.destination}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-slate-900">{item.supplierName || voucher.supplierName}</div>
                      <div className="text-[11px] font-mono text-teal-700 font-bold mt-0.5">
                        Ref: {item.supplierConfirmationRef || voucher.supplierConfirmationRef || 'CONFIRMED'}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 w-fit">
                        <CheckCircle2 className="w-3 h-3" /> Confirmed
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Meeting, Pickup & Ground Instructions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <h5 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-teal-600" />
              Meeting Point & Pick-up Instructions
            </h5>
            <p className="text-xs text-slate-700 leading-relaxed">
              {voucher.pickupInfo || voucher.meetingPoint || 'Representative / Chauffeur will hold digital name board with lead passenger surname at arrival terminal or hotel reception.'}
            </p>
            {voucher.dropoffInfo && (
              <p className="text-xs text-slate-600">
                <strong>Drop-off Location:</strong> {voucher.dropoffInfo}
              </p>
            )}
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <h5 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-teal-600" />
              Emergency & On-Ground Support
            </h5>
            <p className="text-xs text-slate-700 leading-relaxed">
              24/7 Operations Hotline: <strong>{voucher.emergencyContact || '+91 9811654959'}</strong>
            </p>
            <p className="text-[11px] text-slate-500">
              For any schedule adjustments, flight delays, or immediate driver assistance, contact our emergency desk immediately with Booking Reference <strong>{voucher.bookingReference}</strong>.
            </p>
          </div>
        </div>

        {/* Special Instructions & Terms */}
        <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200 text-slate-600 text-[11px] space-y-1.5">
          <div className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
            Terms of Ground Service & Passenger Identification
          </div>
          <p>
            {voucher.specialInstructions || 'Passengers must carry valid government photo identification. Please arrive at the designated meeting point at least 15 minutes prior to scheduled departure.'}
          </p>
          <p className="text-slate-400">
            {voucher.termsAndConditions || 'This voucher constitutes official proof of reservation issued by TheUnbound DMC. Valid only for the passenger(s) and confirmed dates stated above. Non-transferable.'}
          </p>
        </div>

        {/* Document Footer */}
        <div className="pt-4 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between text-[11px] text-slate-400 gap-2">
          <span>System Version: {voucher.templateVersion || 'v2.4-Authoritative-DMC'}</span>
          <span>Generated By: {voucher.generatedByName || 'TheUnbound Operations Hub'}</span>
          <span>Verification Hash: {voucher.id}</span>
        </div>
      </div>
    </div>
  );
};
