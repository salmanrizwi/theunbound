import React, { useState } from 'react';
import { 
  PlaneTakeoff, 
  PlaneLanding, 
  Car, 
  Ticket, 
  AlertCircle, 
  Clock, 
  Users, 
  MapPin, 
  CheckCircle2, 
  ChevronRight, 
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  PhoneCall,
  Compass
} from 'lucide-react';
import { OperationsTodayData } from '../../../services/dashboardMetricsService';
import { Booking } from '../../../types';

interface OperationalHorizonSectionProps {
  operationsToday: OperationsTodayData;
  bookings: Booking[];
  onNavigate: (section: string, subTab?: string, recordId?: string) => void;
}

export const OperationalHorizonSection: React.FC<OperationalHorizonSectionProps> = ({
  operationsToday,
  bookings,
  onNavigate
}) => {
  const [activeTab, setActiveTab] = useState<'ARRIVALS' | 'DEPARTURES' | 'ACTIVITIES' | 'TRANSFERS' | 'ACTIONS'>('ARRIVALS');

  const { arrivals, departures, activities, transfers, supplierActions, paymentsDue } = operationsToday;

  // Compute operational health flags
  const missingFlightDetailsCount = bookings.filter(b => 
    b.status === 'CONFIRMED' && 
    b.travelDates?.startDate && 
    b.travelDates.startDate.slice(0, 10) === operationsToday.operationalDate &&
    (!b.flightDetails || !b.flightDetails.arrivalFlightNumber)
  ).length;

  const missingPickupVouchersCount = bookings.filter(b => 
    b.status === 'CONFIRMED' && 
    b.travelDates?.startDate && 
    b.travelDates.startDate.slice(0, 10) === operationsToday.operationalDate &&
    (!b.vouchersList || b.vouchersList.length === 0)
  ).length;

  return (
    <section id="cms-operational-horizon-section" className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-7 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
              <Compass className="w-4 h-4" />
            </div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
              Operational Horizon & Ground Dispatch Desk
            </h2>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
              Live Horizon: {operationsToday.operationalDate}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Airport meet-and-greets, ground transport dispatches, daily excursions and supplier reconfirmations.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => onNavigate('BOOKING_MANAGEMENT', 'BOOKINGS')}
            className="flex items-center space-x-1 px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <span>All Bookings</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* SLA Alert Badges if flight or pickup vouchers are missing today */}
      {(missingFlightDetailsCount > 0 || missingPickupVouchersCount > 0 || supplierActions.length > 0) && (
        <div className="flex flex-wrap items-center gap-2.5 p-3.5 bg-amber-50/70 rounded-2xl border border-amber-200/80 text-xs text-amber-900">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="font-bold">Ground Dispatch Attention:</span>
          {missingFlightDetailsCount > 0 && (
            <span className="bg-amber-100 px-2 py-0.5 rounded-md font-semibold text-amber-800">
              {missingFlightDetailsCount} Arrival{missingFlightDetailsCount === 1 ? '' : 's'} missing flight number
            </span>
          )}
          {missingPickupVouchersCount > 0 && (
            <span className="bg-amber-100 px-2 py-0.5 rounded-md font-semibold text-amber-800">
              {missingPickupVouchersCount} Arrival{missingPickupVouchersCount === 1 ? '' : 's'} missing voucher
            </span>
          )}
          {supplierActions.length > 0 && (
            <span className="bg-rose-100 px-2 py-0.5 rounded-md font-extrabold text-rose-800 border border-rose-200">
              {supplierActions.length} Supplier Confirmation Pending
            </span>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 pb-3">
        {[
          { id: 'ARRIVALS', label: `Arrivals (${arrivals.length})`, icon: PlaneLanding },
          { id: 'DEPARTURES', label: `Departures (${departures.length})`, icon: PlaneTakeoff },
          { id: 'ACTIVITIES', label: `Excursions (${activities.length})`, icon: Ticket },
          { id: 'TRANSFERS', label: `Transfers (${transfers.length})`, icon: Car },
          { id: 'ACTIONS', label: `Supplier Actions (${supplierActions.length})`, icon: ShieldAlert }
        ].map(tab => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                isSelected
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/80'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content Display */}
      <div className="space-y-3">
        {/* ARRIVALS */}
        {activeTab === 'ARRIVALS' && (
          <div>
            {arrivals.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400 bg-slate-50/50 rounded-2xl border border-slate-100">
                No guest arrivals scheduled for today's operational horizon.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {arrivals.map((arr, idx) => (
                  <div key={idx} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between text-xs gap-3">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                        <PlaneLanding className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="font-black text-slate-900 truncate">{arr.clientName}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-bold">
                            {arr.bookingRef}
                          </span>
                        </div>
                        <div className="text-slate-400 text-[11px] flex items-center space-x-2 mt-0.5">
                          <span>{arr.pax} Pax</span>
                          <span>·</span>
                          <span>Dest: {arr.destination}</span>
                          <span>·</span>
                          <span>Partner: {arr.supplierName}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => onNavigate('BOOKING_MANAGEMENT', 'BOOKINGS', arr.bookingId)}
                      className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center space-x-1 shrink-0"
                    >
                      <span>Dispatch</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* DEPARTURES */}
        {activeTab === 'DEPARTURES' && (
          <div>
            {departures.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400 bg-slate-50/50 rounded-2xl border border-slate-100">
                No guest departures scheduled for today.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {departures.map((dep, idx) => (
                  <div key={idx} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between text-xs gap-3">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                        <PlaneTakeoff className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="font-black text-slate-900 truncate">{dep.clientName}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-bold">
                            {dep.bookingRef}
                          </span>
                        </div>
                        <div className="text-slate-400 text-[11px] flex items-center space-x-2 mt-0.5">
                          <span>{dep.pax} Pax</span>
                          <span>·</span>
                          <span>Departing {dep.destination}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => onNavigate('BOOKING_MANAGEMENT', 'BOOKINGS', dep.bookingId)}
                      className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center space-x-1 shrink-0"
                    >
                      <span>Checkout</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ACTIVITIES */}
        {activeTab === 'ACTIVITIES' && (
          <div>
            {activities.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400 bg-slate-50/50 rounded-2xl border border-slate-100">
                No tour activities scheduled today.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {activities.map((act, idx) => (
                  <div key={idx} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between text-xs gap-3">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                        <Ticket className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-900 truncate">{act.serviceName}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-500 font-medium">
                            {act.category}
                          </span>
                        </div>
                        <div className="text-slate-400 text-[11px] flex items-center space-x-2 mt-0.5">
                          <span>Ref: {act.bookingRef}</span>
                          <span>·</span>
                          <span>{act.pax} Pax</span>
                          <span>·</span>
                          <span>Time: {act.time}</span>
                          <span>·</span>
                          <span>Guide/Supplier: {act.supplierName}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => onNavigate('BOOKING_MANAGEMENT', 'BOOKINGS', act.bookingId)}
                      className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center space-x-1 shrink-0"
                    >
                      <span>Voucher</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TRANSFERS */}
        {activeTab === 'TRANSFERS' && (
          <div>
            {transfers.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400 bg-slate-50/50 rounded-2xl border border-slate-100">
                No ground transfers scheduled today.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {transfers.map((tr, idx) => (
                  <div key={idx} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between text-xs gap-3">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                        <Car className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 truncate">{tr.serviceName}</div>
                        <div className="text-slate-400 text-[11px] flex flex-wrap items-center gap-2 mt-0.5">
                          <span>Ref: {tr.bookingRef}</span>
                          <span>·</span>
                          <span>Pickup: {tr.pickupTime} @ {tr.pickupLocation}</span>
                          <span>·</span>
                          <span>Drop: {tr.dropoffLocation}</span>
                          <span>·</span>
                          <span>Vehicle: {tr.vehicleType}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => onNavigate('BOOKING_MANAGEMENT', 'BOOKINGS', tr.bookingId)}
                      className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center space-x-1 shrink-0"
                    >
                      <span>Driver Details</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SUPPLIER ACTIONS */}
        {activeTab === 'ACTIONS' && (
          <div>
            {supplierActions.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400 bg-slate-50/50 rounded-2xl border border-slate-100">
                All supplier service confirmations are up-to-date.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {supplierActions.map((act) => (
                  <div key={act.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between text-xs gap-3">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 font-bold">
                        !
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-900 truncate">{act.serviceName}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-extrabold">
                            {act.actionType}
                          </span>
                        </div>
                        <div className="text-slate-400 text-[11px] flex items-center space-x-2 mt-0.5">
                          <span>Booking: {act.bookingRef}</span>
                          <span>·</span>
                          <span>Partner: {act.supplierName}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => onNavigate('ACCOUNT_MANAGEMENT', 'SUPPLIERS')}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs flex items-center space-x-1 shrink-0"
                    >
                      <span>Reconfirm</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
