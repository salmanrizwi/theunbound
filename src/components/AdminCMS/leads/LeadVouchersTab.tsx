import React, { useState } from 'react';
import { TravelLead, BookingVoucher } from '../../../types';
import { 
  ShieldCheck, 
  FileText, 
  Printer, 
  Calendar, 
  MapPin, 
  Users, 
  CheckCircle2, 
  Clock, 
  Eye, 
  Filter, 
  Search,
  Building2,
  Sparkles
} from 'lucide-react';

interface LeadVouchersTabProps {
  lead: TravelLead;
  linkedVouchers: BookingVoucher[];
  onViewVoucher: (voucher: BookingVoucher) => void;
}

export const LeadVouchersTab: React.FC<LeadVouchersTabProps> = ({
  lead,
  linkedVouchers,
  onViewVoucher
}) => {
  const [filterType, setFilterType] = useState<'ALL' | 'COMPLETE' | 'ACTIVITY'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredVouchers = linkedVouchers.filter(v => {
    const isComplete = v.isCompleteBookingVoucher || Boolean(v.serviceItemsSnapshot && v.serviceItemsSnapshot.length > 0);
    if (filterType === 'COMPLETE' && !isComplete) return false;
    if (filterType === 'ACTIVITY' && isComplete) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNum = v.voucherNumber?.toLowerCase().includes(q);
      const matchSrv = v.serviceName?.toLowerCase().includes(q);
      const matchSup = v.supplierName?.toLowerCase().includes(q);
      const matchRef = v.bookingReference?.toLowerCase().includes(q);
      if (!matchNum && !matchSrv && !matchSup && !matchRef) return false;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#00C6A6]" />
              <span>Issued Service & Booking Vouchers ({linkedVouchers.length})</span>
            </h3>
            <p className="text-xs text-slate-500">
              Authoritative operational fulfillment vouchers issued for confirmed activities and whole itineraries.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
              <button
                onClick={() => setFilterType('ALL')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  filterType === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({linkedVouchers.length})
              </button>
              <button
                onClick={() => setFilterType('COMPLETE')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  filterType === 'COMPLETE' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Complete
              </button>
              <button
                onClick={() => setFilterType('ACTIVITY')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  filterType === 'ACTIVITY' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Activity-Level
              </button>
            </div>
          </div>
        </div>

        {/* Search */}
        {linkedVouchers.length > 0 && (
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search vouchers by number, service, supplier, or booking reference..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#00C6A6]"
            />
          </div>
        )}

        {/* Vouchers List */}
        {filteredVouchers.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-500 space-y-2">
            <ShieldCheck className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-700">No Vouchers Found</p>
            <p className="text-slate-400 max-w-sm mx-auto">
              Vouchers are issued once supplier services are confirmed. Generate complete itinerary vouchers or single activity vouchers in the Bookings tab.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredVouchers.map(voucher => {
              const isComplete = voucher.isCompleteBookingVoucher || Boolean(voucher.serviceItemsSnapshot && voucher.serviceItemsSnapshot.length > 0);
              const itemsCount = voucher.serviceItemsSnapshot?.length || 1;

              return (
                <div 
                  key={voucher.id || voucher.voucherNumber}
                  className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition-colors space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase border ${
                          isComplete 
                            ? 'bg-purple-50 text-purple-800 border-purple-200' 
                            : 'bg-teal-50 text-[#008f77] border-teal-200'
                        }`}>
                          {isComplete ? 'Complete Booking Voucher' : 'Activity Voucher'}
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-900">
                          {voucher.voucherNumber}
                        </span>
                      </div>

                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        {voucher.status || 'ISSUED'}
                      </span>
                    </div>

                    <h4 className="text-xs font-black text-slate-900 leading-snug">
                      {voucher.serviceName || (isComplete ? 'Complete Tour Package Voucher' : 'Ground Service Arrangement')}
                    </h4>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 bg-white p-2.5 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-slate-400 block">Lead Traveler</span>
                        <span className="font-bold text-slate-800 truncate block">
                          {voucher.leadTravelerName || lead.clientName}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Service Date</span>
                        <span className="font-bold text-slate-800 truncate block">
                          {voucher.serviceDate || 'Scheduled Itinerary'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Destination</span>
                        <span className="font-bold text-slate-800 truncate block">
                          {voucher.city || voucher.destination || lead.destinationName}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Supplier</span>
                        <span className="font-bold text-slate-800 truncate block">
                          {voucher.supplierName || 'Unbound Operations'}
                        </span>
                      </div>
                    </div>

                    {isComplete && itemsCount > 1 && (
                      <div className="text-[10px] text-slate-500 font-medium">
                        Contains snapshot of <strong>{itemsCount} verified services</strong>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-xs">
                    <span className="text-[10px] text-slate-400">
                      Issued: {new Date(voucher.issuedAt).toLocaleDateString()}
                    </span>
                    <button
                      onClick={() => onViewVoucher(voucher)}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>View & Print</span>
                    </button>
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
