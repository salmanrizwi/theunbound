import React from 'react';
import { TravelLead, Booking, User, BookingItem } from '../../../types';
import { formatCurrency } from '../../../services/pricingEngine';
import { 
  Briefcase, 
  CheckCircle2, 
  Calendar, 
  Users, 
  FileText, 
  Receipt, 
  ShieldCheck, 
  ExternalLink,
  Printer,
  Plus,
  ArrowRight,
  Clock,
  AlertTriangle,
  Building2
} from 'lucide-react';

interface LeadBookingsTabProps {
  lead: TravelLead;
  linkedBookings: Booking[];
  currentUser: User | null;
  onOpenBooking?: (bookingId: string) => void;
  onGenerateCompleteVoucher: (bookingId: string) => void;
  onGenerateActivityVoucher: (bookingId: string, itemId: string) => void;
  onGenerateInvoice: (bookingId: string) => void;
  onNavigateToVouchersTab?: () => void;
  onNavigateToFinancialsTab?: () => void;
}

export const LeadBookingsTab: React.FC<LeadBookingsTabProps> = ({
  lead,
  linkedBookings,
  currentUser,
  onOpenBooking,
  onGenerateCompleteVoucher,
  onGenerateActivityVoucher,
  onGenerateInvoice,
  onNavigateToVouchersTab,
  onNavigateToFinancialsTab
}) => {
  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-[#00C6A6]" />
              <span>Operational Ground Bookings ({linkedBookings.length})</span>
            </h3>
            <p className="text-xs text-slate-500">
              Active operational execution records spawned from this commercial relationship.
            </p>
          </div>
        </div>

        {linkedBookings.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-500 space-y-2">
            <Briefcase className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-700">No Operational Booking Created Yet</p>
            <p className="text-slate-400 max-w-sm mx-auto">
              Once an itinerary proposal is accepted, convert it to a ground booking to allocate suppliers and issue vouchers.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {linkedBookings.map(booking => {
              const items = booking.items || [];
              const confirmedItems = items.filter(it => it.supplierConfirmationStatus === 'Confirmed');
              const vouchersCount = (booking.voucherIds?.length || 0) + (booking.vouchersList?.length || 0);
              const invoicesCount = booking.proformaInvoiceIds?.length || (booking.activeProformaInvoiceId ? 1 : 0);

              return (
                <div 
                  key={booking.id}
                  className="p-5 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-4 shadow-2xs"
                >
                  {/* Header Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#008f77] flex items-center justify-center font-bold">
                        <Building2 className="w-5 h-5 text-[#008f77]" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-black text-slate-900">
                            #{booking.bookingReference}
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            booking.status === 'CONFIRMED'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : booking.status === 'CANCELLED'
                              ? 'bg-rose-50 text-rose-800 border-rose-300'
                              : 'bg-amber-50 text-amber-800 border-amber-300'
                          }`}>
                            {booking.status}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="text-xs text-slate-600 font-medium">
                            {booking.destinationName || booking.destination || 'Japan'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Lead Traveler: <strong className="text-slate-800">{booking.customer?.leadTravelerName || lead.clientName}</strong>
                          {booking.quoteNumber && (
                            <span className="ml-2 font-mono text-[11px] text-slate-400">
                              (From Quote #{booking.quoteNumber})
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-start sm:self-auto">
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Selling</span>
                        <span className="font-mono text-base font-black text-slate-900">
                          {formatCurrency(booking.totalAmount || 0, booking.currency)}
                        </span>
                      </div>
                      {onOpenBooking && (
                        <button
                          onClick={() => onOpenBooking(booking.id)}
                          className="px-3 py-2 rounded-xl bg-[#008f77] hover:bg-[#00705d] text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                        >
                          <span>Operations Desk</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Summary Bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-white p-3 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Travel Dates</span>
                      <span className="font-bold text-slate-800">
                        {booking.travelStartDate || 'TBA'} → {booking.travelEndDate || 'TBA'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Passenger Manifest</span>
                      <span className="font-bold text-slate-800">
                        {(booking.customer?.totalAdults || 0) + (booking.customer?.totalChildren || 0) || 1} Pax
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Suppliers Allocated</span>
                      <span className="font-bold text-slate-800">
                        {confirmedItems.length} of {items.length} Confirmed
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Payment Status</span>
                      <span className={`font-bold ${
                        booking.paymentStatus === 'PAID' ? 'text-emerald-700' : 'text-blue-700'
                      }`}>
                        {booking.paymentStatus || 'PENDING'}
                      </span>
                    </div>
                  </div>

                  {/* Service Items Table */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700 uppercase tracking-wide text-[11px]">
                        Service Items & Supplier Confirmation Status ({items.length})
                      </span>
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-x-auto bg-white">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                            <th className="py-2 px-3">Service Name</th>
                            <th className="py-2 px-3">Category</th>
                            <th className="py-2 px-3">Supplier</th>
                            <th className="py-2 px-3 text-center">Status</th>
                            <th className="py-2 px-3 text-right">Voucher</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {items.map(item => {
                            const isConfirmed = item.supplierConfirmationStatus === 'Confirmed';

                            return (
                              <tr key={item.id} className="hover:bg-slate-50">
                                <td className="py-2.5 px-3 font-bold text-slate-800">
                                  {item.productName}
                                  {item.serviceDate && (
                                    <span className="text-[10px] text-slate-400 block font-normal">
                                      {item.serviceDate} {item.serviceTime || ''}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                                    {item.category || 'SERVICE'}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-slate-600">
                                  {item.supplierName || (
                                    <span className="text-slate-400 italic">Unallocated</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                    isConfirmed 
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                                      : 'bg-amber-50 text-amber-800 border-amber-300'
                                  }`}>
                                    {item.supplierConfirmationStatus || 'Pending'}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  {isConfirmed ? (
                                    <button
                                      onClick={() => onGenerateActivityVoucher(booking.id, item.id)}
                                      className="text-[11px] text-[#008f77] hover:underline font-bold cursor-pointer"
                                      title="Generate Activity-Level Voucher"
                                    >
                                      + Activity Voucher
                                    </button>
                                  ) : (
                                    <span className="text-[10px] text-slate-400 italic" title="Supplier confirmation required before issuing voucher">
                                      Requires Confirmation
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 text-xs">
                    <div className="flex items-center gap-3 text-slate-500">
                      <span>Vouchers: <strong className="text-slate-700">{vouchersCount}</strong></span>
                      <span>Invoices: <strong className="text-slate-700">{invoicesCount}</strong></span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onGenerateCompleteVoucher(booking.id)}
                        className="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-[#008f77]" />
                        <span>Issue Complete Booking Voucher</span>
                      </button>

                      <button
                        onClick={() => onGenerateInvoice(booking.id)}
                        className="px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-[#008f77] border border-teal-200 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <Receipt className="w-3.5 h-3.5 text-[#008f77]" />
                        <span>Issue Proforma Invoice</span>
                      </button>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
