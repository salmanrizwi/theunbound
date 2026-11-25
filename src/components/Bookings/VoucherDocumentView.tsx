import React, { useMemo, useRef, useState } from 'react';
import { Booking, BookingItem, BookingVoucher } from '../../types';
import {
  Printer,
  Download,
  CheckCircle2,
  MapPin,
  Calendar,
  Clock,
  Users,
  Phone,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
  Car,
  Ticket,
  Building2,
  Loader2,
  X
} from 'lucide-react';
import { AppDatabase } from '../../services/db';
import {
  formatPassengerBreakdown,
  formatReadableDate,
  groupBookingItemsByDay,
  hydrateBookingServiceItem,
  HydratedBookingServiceItem,
  sanitizeVerifiedGoogleMapsUrl,
  sortBookingItemsChronologically
} from '../../services/bookingOperationsSyncService';
import {
  generateActivityVoucherPDF,
  generateCompleteVoucherPDF
} from '../../services/bookingDocumentPdfService';

interface VoucherDocumentViewProps {
  voucher: BookingVoucher;
  booking?: Booking | null;
  onClose?: () => void;
  onRegenerate?: () => void;
  isOutdated?: boolean;
}

export const VoucherDocumentView: React.FC<VoucherDocumentViewProps> = ({
  voucher,
  booking: propBooking,
  onClose,
  onRegenerate,
  isOutdated = false
}) => {
  const printRef = useRef<HTMLDivElement>(null);
  const db = AppDatabase.getInstance();
  const companyProfile = db.getCentralCompanyProfile();
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const resolvedBooking = useMemo(() => {
    if (propBooking) return propBooking;
    if (voucher.bookingId) {
      return db.getBookingById(voucher.bookingId, db.getCurrentUser()) || null;
    }
    return null;
  }, [propBooking, voucher.bookingId, db]);

  const effectiveOutdated = isOutdated || Boolean(voucher.isOutdated);

  // Hydrate authoritative services for Complete Voucher or single Activity Voucher
  const { confirmedItems, pendingItems, singleHydratedItem } = useMemo(() => {
    if (voucher.isCompleteBookingVoucher) {
      const rawList: BookingItem[] =
        resolvedBooking?.items && resolvedBooking.items.length > 0
          ? resolvedBooking.items
          : ((voucher.serviceItemsSnapshot || []) as BookingItem[]);
      const hydrated = rawList
        .filter(it => !it.isCancelled && it.operationalStatus !== 'Cancelled')
        .map(it => hydrateBookingServiceItem(it, resolvedBooking));
      return {
        confirmedItems: sortBookingItemsChronologically(hydrated.filter(it => it.isConfirmedForVoucher)),
        pendingItems: sortBookingItemsChronologically(hydrated.filter(it => !it.isConfirmedForVoucher)),
        singleHydratedItem: null as HydratedBookingServiceItem | null
      };
    }

    const rawItem = resolvedBooking?.items?.find(it => it.id === voucher.serviceItemId);
    if (rawItem) {
      const h = hydrateBookingServiceItem(rawItem, resolvedBooking);
      return {
        confirmedItems: [h],
        pendingItems: [] as HydratedBookingServiceItem[],
        singleHydratedItem: h
      };
    }
    return {
      confirmedItems: [] as HydratedBookingServiceItem[],
      pendingItems: [] as HydratedBookingServiceItem[],
      singleHydratedItem: null as HydratedBookingServiceItem | null
    };
  }, [voucher, resolvedBooking]);

  const dayGroups = useMemo(() => {
    if (!voucher.isCompleteBookingVoucher) return [];
    return groupBookingItemsByDay(confirmedItems, resolvedBooking?.travelStartDate);
  }, [voucher.isCompleteBookingVoucher, confirmedItems, resolvedBooking?.travelStartDate]);

  const handleDownloadPdf = async () => {
    if (isDownloadingPdf) return;
    setIsDownloadingPdf(true);
    try {
      if (voucher.isCompleteBookingVoucher && resolvedBooking) {
        const res = generateCompleteVoucherPDF(voucher, resolvedBooking, companyProfile);
        res.download();
      } else {
        const res = generateActivityVoucherPDF(voucher, resolvedBooking, companyProfile);
        res.download();
      }
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const verifiedMapsUrl = sanitizeVerifiedGoogleMapsUrl(
    singleHydratedItem?.resolvedGoogleMapsUrl || voucher.googleMapsUrl
  );

  const renderServiceDetailCard = (item: HydratedBookingServiceItem, idxLabel: string, isPending: boolean) => {
    const itemMaps = sanitizeVerifiedGoogleMapsUrl(item.resolvedGoogleMapsUrl);
    return (
      <div
        key={item.id || idxLabel}
        className={`rounded-2xl border p-4 space-y-3 ${
          isPending ? 'bg-amber-50/40 border-amber-200' : 'bg-white border-slate-200'
        }`}
      >
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-2 pb-2.5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white text-[10px] font-black font-mono">
                {idxLabel}
              </span>
              <h4 className="text-sm font-black text-slate-900">{item.productName}</h4>
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold">
                {item.category}
              </span>
            </div>
            {(item.destination || item.hub) && (
              <p className="text-[11px] text-slate-500 mt-0.5">
                {[item.destination, item.hub].filter(Boolean).join(' • ')}
              </p>
            )}
          </div>
          <div className="text-right">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                isPending
                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              }`}
            >
              {isPending ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
              {isPending ? item.resolvedCanonicalAllocationStatus : 'Supplier Confirmed'}
            </span>
            {!isPending && item.supplierConfirmationRef && (
              <div className="text-[10px] font-mono font-bold text-[#008972] mt-0.5">
                Ref: {item.supplierConfirmationRef}
              </div>
            )}
          </div>
        </div>

        {/* Schedule & Passengers */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <div className="text-[10px] font-bold uppercase text-slate-400">Service Date</div>
            <div className="font-bold text-slate-900 mt-0.5">
              {item.resolvedServiceDate ? formatReadableDate(item.resolvedServiceDate) : 'Pending'}
            </div>
          </div>

          {item.isTicketedActivity ? (
            <div className="p-2.5 rounded-xl bg-teal-50/70 border border-teal-100">
              <div className="text-[10px] font-bold uppercase text-teal-700 flex items-center gap-1">
                <Ticket className="w-3 h-3" /> Ticket Entry Time
              </div>
              <div className="font-black text-teal-950 mt-0.5">
                {item.resolvedTicketEntryTime || item.resolvedStartTime || 'To Be Confirmed'}
                {item.resolvedTimeZone ? ` (${item.resolvedTimeZone})` : ''}
              </div>
            </div>
          ) : item.isTransportService ? (
            <div className="p-2.5 rounded-xl bg-teal-50/70 border border-teal-100">
              <div className="text-[10px] font-bold uppercase text-teal-700 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Pickup Time
              </div>
              <div className="font-black text-teal-950 mt-0.5">
                {item.resolvedPickupTime || item.resolvedStartTime || 'To Be Confirmed'}
              </div>
            </div>
          ) : (
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <div className="text-[10px] font-bold uppercase text-slate-400">Start Time</div>
              <div className="font-bold text-slate-900 mt-0.5">
                {item.resolvedStartTime || 'As Scheduled'}
              </div>
            </div>
          )}

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <div className="text-[10px] font-bold uppercase text-slate-400">Passengers</div>
            <div className="font-bold text-slate-900 mt-0.5">{item.resolvedPassengerBreakdown}</div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <div className="text-[10px] font-bold uppercase text-slate-400">Operating Partner</div>
            <div className="font-bold text-slate-900 mt-0.5">{item.supplierName || 'Pending Allocation'}</div>
          </div>
        </div>

        {/* Description & Overview */}
        {item.resolvedDescription && (
          <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-100 text-xs text-slate-700 leading-relaxed">
            <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Service Description</span>
            {item.resolvedDescription}
          </div>
        )}
        {item.resolvedOverview && item.resolvedOverview !== item.resolvedDescription && (
          <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-100 text-xs text-slate-700 leading-relaxed">
            <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Operational Overview</span>
            {item.resolvedOverview}
          </div>
        )}

        {/* TRANSPORT ONLY BLOCK */}
        {item.isTransportService && (item.vehicleType || item.resolvedPickupLocation || item.resolvedDropoffLocation) && (
          <div className="p-3 rounded-xl bg-teal-50/40 border border-teal-200/70 space-y-2 text-xs">
            <div className="text-[10px] font-black uppercase text-teal-800 flex items-center gap-1.5">
              <Car className="w-3.5 h-3.5" /> Vehicle &amp; Transfer Details
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-slate-800">
              {item.vehicleType && (
                <div><span className="text-slate-500">Vehicle:</span> <strong>{item.vehicleType}</strong></div>
              )}
              {item.vehicleSeaterCapacity && (
                <div><span className="text-slate-500">Capacity:</span> <strong>{item.vehicleSeaterCapacity} Seats</strong></div>
              )}
              {item.luggageCapacity && (
                <div><span className="text-slate-500">Luggage:</span> <strong>{item.luggageCapacity}</strong></div>
              )}
              {item.resolvedPickupLocation && (
                <div className="col-span-2 sm:col-span-1"><span className="text-slate-500">Pickup:</span> <strong>{item.resolvedPickupLocation}</strong></div>
              )}
              {item.resolvedDropoffLocation && (
                <div className="col-span-2 sm:col-span-1"><span className="text-slate-500">Drop-off:</span> <strong>{item.resolvedDropoffLocation}</strong></div>
              )}
              {item.routeDetails && (
                <div className="col-span-2 sm:col-span-3"><span className="text-slate-500">Route:</span> <strong>{item.routeDetails}</strong></div>
              )}
            </div>
          </div>
        )}

        {/* Meeting Point / Venue Address / Maps Link */}
        {!item.isTransportService && (item.resolvedMeetingPoint || item.resolvedAddress || itemMaps) && (
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs space-y-1.5">
            {item.resolvedMeetingPoint && (
              <div><strong className="text-slate-900">Meeting Point:</strong> {item.resolvedMeetingPoint}</div>
            )}
            {item.resolvedAddress && (
              <div><strong className="text-slate-900">Address:</strong> {item.resolvedAddress}</div>
            )}
            {itemMaps && (
              <a
                href={itemMaps}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[#008972] hover:underline font-bold"
              >
                <MapPin className="w-3.5 h-3.5" /> Open Verified Google Maps Location <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}

        {/* Inclusions & Exclusions */}
        {(item.resolvedInclusions.length > 0 || item.resolvedExclusions.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {item.resolvedInclusions.length > 0 && (
              <div className="p-3 rounded-xl bg-emerald-50/40 border border-emerald-100">
                <div className="text-[10px] font-black uppercase text-emerald-800 mb-1">Inclusions</div>
                <ul className="list-disc pl-4 space-y-0.5 text-slate-700">
                  {item.resolvedInclusions.map((inc, i) => <li key={i}>{inc}</li>)}
                </ul>
              </div>
            )}
            {item.resolvedExclusions.length > 0 && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                <div className="text-[10px] font-black uppercase text-slate-600 mb-1">Exclusions</div>
                <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
                  {item.resolvedExclusions.map((exc, i) => <li key={i}>{exc}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        {item.resolvedImportantInstructions && (
          <div className="p-3 rounded-xl bg-teal-50/50 border border-teal-200/70 text-xs text-teal-950">
            <strong className="text-[10px] uppercase tracking-wider block text-[#008972] mb-0.5">Important Instructions</strong>
            {item.resolvedImportantInstructions}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden print:shadow-none print:border-none">
      {/* Top Action Bar */}
      <div className="bg-white text-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-900 text-[#00C6A6] flex items-center justify-center font-black text-xs">
            TUB
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-black text-slate-900">
                {voucher.isCompleteBookingVoucher ? 'COMPLETE BOOKING VOUCHER' : 'ACTIVITY VOUCHER'}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-teal-50 text-[#008972] border border-teal-200">
                v{voucher.version || 1}
              </span>
              {effectiveOutdated && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-300 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-600" /> Outdated -- Reissue Required
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              Voucher No: <strong className="font-mono text-slate-700">{voucher.voucherNumber}</strong> • Booking Ref:{' '}
              <strong className="text-slate-700">{voucher.bookingReference}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {effectiveOutdated && onRegenerate && (
            <button
              onClick={onRegenerate}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              Regenerate Voucher
            </button>
          )}
          <button
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            className="px-4 py-1.5 rounded-xl bg-[#008972] hover:bg-[#007360] text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-60"
          >
            {isDownloadingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>Download Official PDF</span>
          </button>
          <button
            onClick={handlePrint}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" /> Print
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Close Voucher Preview"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Voucher Body */}
      <div ref={printRef} className="p-6 sm:p-8 space-y-6 bg-white text-slate-900">
        {/* Brand Header */}
        <div className="rounded-2xl bg-[#0B1F2A] text-white p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-4 border-[#008972]">
          <div>
            <div className="text-xl font-black tracking-tight flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#00C6A6]" />
              <span>{companyProfile.companyName || 'TheUnbound'}</span>
            </div>
            <p className="text-xs text-teal-200 mt-1">
              {voucher.isCompleteBookingVoucher
                ? 'Consolidated Multi-Service Travel Operations Voucher'
                : 'Official Activity & Experience Operational Voucher'}
            </p>
            <p className="text-[11px] text-slate-300 mt-2">
              Booking Ref: <strong className="font-mono text-white">#{voucher.bookingReference}</strong> • Issued:{' '}
              {formatReadableDate((voucher.issuedAt || '').slice(0, 10))}
            </p>
          </div>
          <div className="text-left sm:text-right space-y-1">
            <div className="text-xs font-black tracking-widest text-[#00C6A6] uppercase">
              {voucher.isCompleteBookingVoucher ? 'COMPLETE BOOKING VOUCHER' : 'ACTIVITY VOUCHER'}
            </div>
            <div className="text-sm font-black font-mono">
              {voucher.voucherNumber} (v{voucher.version || 1})
            </div>
            <div className="text-[11px] text-slate-300 uppercase">
              Status: {effectiveOutdated ? 'OUTDATED' : voucher.status}
            </div>
          </div>
        </div>

        {effectiveOutdated && (
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block">Voucher Outdated</strong>
              <span>{voucher.outdatedReason || 'Booking service details changed after this voucher was issued. Reissue before customer dispatch.'}</span>
            </div>
          </div>
        )}

        {/* COMPLETE BOOKING VOUCHER VIEW */}
        {voucher.isCompleteBookingVoucher ? (
          <div className="space-y-6">
            {/* Booking Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Lead Traveller</span>
                <strong className="text-slate-900 text-sm">{voucher.leadPaxName}</strong>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Travel Dates</span>
                <strong className="text-slate-900">
                  {resolvedBooking?.travelStartDate
                    ? `${formatReadableDate(resolvedBooking.travelStartDate)} - ${formatReadableDate(resolvedBooking.travelEndDate)}`
                    : formatReadableDate(voucher.serviceDate)}
                </strong>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Passengers</span>
                <strong className="text-slate-900">
                  {resolvedBooking?.travelers
                    ? formatPassengerBreakdown(
                        resolvedBooking.travelers.adults || 0,
                        resolvedBooking.travelers.children || 0,
                        resolvedBooking.travelers.infants || 0
                      )
                    : voucher.passengerBreakdown}
                </strong>
              </div>
            </div>

            {pendingItems.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>{pendingItems.length} Service(s) Pending Supplier Confirmation:</strong> Listed separately below. Confirmed services are grouped chronologically by actual travel date.
                </div>
              </div>
            )}

            {/* Day-Wise Chronological Confirmed Itinerary */}
            <div className="space-y-5">
              {dayGroups.map(grp => (
                <div key={grp.dayKey} className="space-y-3">
                  <div className="px-4 py-2 rounded-xl bg-[#0B1F2A] text-white flex items-center justify-between text-xs">
                    <span className="font-black text-[#00C6A6] uppercase tracking-wider">
                      {grp.dayNumber !== null ? `DAY ${grp.dayNumber}` : 'UNSCHEDULED DATE'}
                    </span>
                    <span className="font-semibold flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-teal-300" />
                      {grp.displayDateLabel}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {grp.items.map((it, idx) => renderServiceDetailCard(it, `D${grp.dayNumber ?? '?'}-${idx + 1}`, false))}
                  </div>
                </div>
              ))}
            </div>

            {/* Separate Pending Services Section */}
            {pendingItems.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-amber-200">
                <h4 className="text-xs font-black uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" /> Services Pending Supplier Confirmation (Not Yet Confirmed)
                </h4>
                <div className="space-y-3">
                  {pendingItems.map((it, idx) => renderServiceDetailCard(it, `P${idx + 1}`, true))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* INDIVIDUAL ACTIVITY VOUCHER VIEW */
          <div className="space-y-5">
            {singleHydratedItem ? (
              renderServiceDetailCard(singleHydratedItem, 'ACTIVITY', !singleHydratedItem.isConfirmedForVoucher)
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 rounded-2xl bg-teal-50/70 border border-teal-200">
                    <span className="text-[10px] font-bold uppercase text-teal-700 block">Service Date</span>
                    <strong className="text-slate-900">{formatReadableDate(voucher.serviceDate)}</strong>
                  </div>
                  <div className="p-3 rounded-2xl bg-teal-50/70 border border-teal-200">
                    <span className="text-[10px] font-bold uppercase text-teal-700 block">Entry / Start Time</span>
                    <strong className="text-slate-900">{voucher.ticketEntryTime || voucher.startTime || voucher.serviceTime || 'TBD'}</strong>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Passengers</span>
                    <strong className="text-slate-900">{voucher.passengerBreakdown}</strong>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Confirmation Ref</span>
                    <strong className="font-mono text-[#008972]">{voucher.supplierConfirmationRef || 'Pending'}</strong>
                  </div>
                </div>

                {(voucher.serviceDescription || voucher.activityDescription) && (
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed">
                    <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Service Description</span>
                    {voucher.serviceDescription || voucher.activityDescription}
                  </div>
                )}

                {(voucher.meetingPoint || voucher.address || verifiedMapsUrl) && (
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                    {voucher.meetingPoint && <div><strong>Meeting Point:</strong> {voucher.meetingPoint}</div>}
                    {voucher.address && <div><strong>Venue Address:</strong> {voucher.address}</div>}
                    {verifiedMapsUrl && (
                      <a href={verifiedMapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#008972] font-bold hover:underline">
                        <MapPin className="w-3.5 h-3.5" /> Open Verified Google Maps Link <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Operational Support & Footer */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="flex items-start gap-2">
            <Phone className="w-4 h-4 text-[#008972] shrink-0 mt-0.5" />
            <div>
              <div className="text-[10px] font-black uppercase text-slate-400">24/7 Emergency Support</div>
              <div className="font-bold text-slate-900">{voucher.emergencyContact || companyProfile.phone}</div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-[#008972] shrink-0 mt-0.5" />
            <div>
              <div className="text-[10px] font-black uppercase text-slate-400">Lead Traveller &amp; Manifest</div>
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-500" />
                {voucher.leadPaxName} ({voucher.totalPax} Guest{voucher.totalPax === 1 ? '' : 's'})
              </div>
            </div>
          </div>
        </div>

        {voucher.termsAndConditions && (
          <p className="text-[11px] text-slate-500 leading-relaxed pt-2 border-t border-slate-100">
            <strong className="text-slate-700">Terms:</strong> {voucher.termsAndConditions}
          </p>
        )}
      </div>
    </div>
  );
};
