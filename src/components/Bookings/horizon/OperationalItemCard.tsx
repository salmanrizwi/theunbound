import React, { useState } from 'react';
import { 
  Building2, 
  Car, 
  Compass, 
  Sparkles, 
  MapPin, 
  Clock, 
  Users, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  FileCheck, 
  Send, 
  Edit3, 
  ArrowRight, 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  Check, 
  HelpCircle,
  Phone,
  User as UserIcon,
  ShieldCheck,
  CheckSquare,
  FileText
} from 'lucide-react';
import { OperationalItem } from './horizonTypes';
import { formatCurrency } from '../../../services/pricingEngine';
import { formatDispatchManifestMessage } from './horizonUtils';

interface OperationalItemCardProps {
  item: OperationalItem;
  isInternal: boolean;
  onOpenBooking: (bookingId: string) => void;
  onQuickDispatch: (item: OperationalItem) => void;
  onQuickStatusUpdate?: (item: OperationalItem, newStatus: string) => void;
  compactMode?: boolean;
}

export const OperationalItemCard: React.FC<OperationalItemCardProps> = ({
  item,
  isInternal,
  onOpenBooking,
  onQuickDispatch,
  onQuickStatusUpdate,
  compactMode = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  // Category Icon & Color
  const getCategoryTheme = () => {
    switch (item.category) {
      case 'HOTEL':
        return {
          icon: Building2,
          badgeBg: 'bg-blue-50 text-blue-800 border-blue-200',
          accentBorder: 'border-l-blue-500'
        };
      case 'TRANSFER':
        return {
          icon: Car,
          badgeBg: 'bg-amber-50 text-amber-800 border-amber-200',
          accentBorder: 'border-l-amber-500'
        };
      case 'TOUR':
        return {
          icon: Compass,
          badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          accentBorder: 'border-l-emerald-500'
        };
      case 'ACTIVITY':
        return {
          icon: Sparkles,
          badgeBg: 'bg-purple-50 text-purple-800 border-purple-200',
          accentBorder: 'border-l-purple-500'
        };
      default:
        return {
          icon: FileText,
          badgeBg: 'bg-slate-100 text-slate-800 border-slate-200',
          accentBorder: 'border-l-slate-400'
        };
    }
  };

  const theme = getCategoryTheme();
  const Icon = theme.icon;

  const handleCopyManifest = (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = formatDispatchManifestMessage(item);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Status Badge Color
  const getStatusBadgeClass = () => {
    const st = (item.operationalStatus || '').toLowerCase();
    if (st.includes('confirmed')) return 'bg-teal-50 text-teal-800 border-teal-200';
    if (st.includes('dispatch') || st.includes('ready')) return 'bg-indigo-50 text-indigo-800 border-indigo-200';
    if (st.includes('progress') || st.includes('ongoing')) return 'bg-blue-50 text-blue-800 border-blue-200';
    if (st.includes('completed')) return 'bg-slate-100 text-slate-700 border-slate-200';
    if (st.includes('cancel')) return 'bg-rose-50 text-rose-800 border-rose-200';
    return 'bg-amber-50 text-amber-800 border-amber-200';
  };

  return (
    <div 
      className={`bg-white rounded-2xl border border-slate-200 hover:border-slate-300 shadow-2xs hover:shadow-xs transition-all overflow-hidden ${
        item.conflicts.length > 0 ? 'border-rose-300 ring-1 ring-rose-300/40' : ''
      }`}
      id={`horizon-item-${item.id}`}
    >
      <div className="p-4 sm:p-5">
        {/* Top Row: Time, Category, Booking Ref & Quick Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3">
          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
            {/* Time badge */}
            <div className="flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-slate-900 text-white font-mono text-xs font-black shadow-2xs">
              <Clock className="w-3.5 h-3.5 text-[#00E5C0]" />
              <span>{item.reportingTime || item.startTime || 'Time Not Specified'}</span>
            </div>

            {/* Specific Type label */}
            <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl text-xs font-bold border ${theme.badgeBg}`}>
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{item.operationalTypeLabel}</span>
            </span>

            {/* Booking Reference Pill */}
            <button
              type="button"
              onClick={() => onOpenBooking(item.bookingId)}
              className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 font-mono text-xs font-bold transition-colors cursor-pointer inline-flex items-center space-x-1"
              title="Open authoritative booking workspace"
            >
              <span>#{item.bookingReference}</span>
              <ArrowRight className="w-3 h-3 text-slate-400" />
            </button>
          </div>

          {/* Right Top Statuses & Actions */}
          <div className="flex items-center space-x-1.5 shrink-0">
            {/* Operational Status Pill */}
            <span className={`px-2.5 py-1 rounded-xl text-xs font-bold border ${getStatusBadgeClass()}`}>
              {item.operationalStatus}
            </span>

            {/* Quick Dispatch Edit */}
            <button
              type="button"
              onClick={() => onQuickDispatch(item)}
              className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
              title="Ground Dispatch & Details"
            >
              <Edit3 className="w-4 h-4" />
            </button>

            {/* Copy Manifest Text */}
            <button
              type="button"
              onClick={handleCopyManifest}
              className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
              title="Copy WhatsApp / SMS Manifest"
            >
              {copied ? <Check className="w-4 h-4 text-teal-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
            </button>
          </div>
        </div>

        {/* Middle Section: Service Name, Destination, Lead Passenger */}
        <div className="space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
              {item.title}
            </h4>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
            <span className="flex items-center space-x-1 text-slate-900 font-medium">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <span><strong>{item.leadPassengerName}</strong> ({item.totalPax} Pax)</span>
            </span>

            <span className="flex items-center space-x-1 text-slate-500">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span>{item.destination} • {item.hub}</span>
            </span>

            {item.b2bAgentName && (
              <span className="text-slate-400 font-medium">
                Agency: <strong className="text-slate-600">{item.b2bAgentName}</strong>
              </span>
            )}
          </div>
        </div>

        {/* Operational Dispatch Badges & Routes */}
        <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs">
          {/* Pickup / Meeting point */}
          {(item.pickupLocation || item.operationalType === 'HOTEL_CHECK_IN') && (
            <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                {item.category === 'TRANSFER' ? 'Pickup Location' : 'Meeting / Check-In Point'}
              </span>
              <p className="text-xs font-semibold text-slate-800 line-clamp-1 mt-0.5">
                {item.pickupLocation || item.title}
              </p>
            </div>
          )}

          {/* Drop-off / Destination */}
          {item.dropoffLocation && (
            <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Drop-Off Destination
              </span>
              <p className="text-xs font-semibold text-slate-800 line-clamp-1 mt-0.5">
                {item.dropoffLocation}
              </p>
            </div>
          )}

          {/* Supplier & Confirmation */}
          <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Contracted Supplier
            </span>
            <div className="flex items-center justify-between mt-0.5">
              <p className="text-xs font-semibold text-slate-800 line-clamp-1">
                {item.supplierName || <span className="text-amber-600 font-bold">Unallocated</span>}
              </p>
              {item.supplierConfirmationRef && (
                <span className="text-[10px] font-mono text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200 shrink-0 ml-1">
                  {item.supplierConfirmationRef}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Fleet or Guide specifics if present */}
        {(item.driverName || item.guideName) && (
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs bg-teal-50/50 p-2 px-3 rounded-xl border border-teal-100 text-teal-900">
            {item.driverName && (
              <span className="flex items-center space-x-1">
                <Car className="w-3.5 h-3.5 text-teal-600" />
                <span>Chauffeur: <strong>{item.driverName}</strong> {item.driverPhone && `(${item.driverPhone})`}</span>
                {item.licensePlate && <span className="font-mono text-[10px] bg-white px-1 rounded border border-teal-200">[{item.licensePlate}]</span>}
              </span>
            )}
            {item.guideName && (
              <span className="flex items-center space-x-1">
                <Compass className="w-3.5 h-3.5 text-teal-600" />
                <span>Guide: <strong>{item.guideName}</strong> [{item.tourLanguage || 'English'}]</span>
              </span>
            )}
          </div>
        )}

        {/* Conflicts and Attention Warnings */}
        {(item.conflicts.length > 0 || item.attentionFlags.length > 0) && (
          <div className="mt-2.5 space-y-1">
            {item.conflicts.map(c => (
              <div 
                key={c.id} 
                className="flex items-center space-x-2 text-xs font-bold text-rose-800 bg-rose-50 p-2 rounded-xl border border-rose-200"
              >
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{c.title}: {c.message}</span>
              </div>
            ))}

            {item.attentionFlags.map(f => (
              <div 
                key={f.id} 
                className={`flex items-center space-x-2 text-xs font-semibold p-1.5 px-2.5 rounded-xl border ${
                  f.severity === 'critical'
                    ? 'bg-rose-50 text-rose-800 border-rose-200'
                    : f.severity === 'warning'
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-blue-50 text-blue-800 border-blue-200'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{f.label}: {f.description}</span>
              </div>
            ))}
          </div>
        )}

        {/* Expandable Secondary Details */}
        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-3 text-xs">
            {/* Operational Instructions */}
            {item.operationalInstructions && (
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 text-slate-700">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                  Operational Instructions
                </span>
                <p className="leading-relaxed">{item.operationalInstructions}</p>
              </div>
            )}

            {/* Internal Ops Notes (Only for internal staff) */}
            {isInternal && item.internalOpsNotes && (
              <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/70 text-amber-900">
                <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block mb-0.5">
                  Internal Ops Notes (Restricted)
                </span>
                <p className="leading-relaxed">{item.internalOpsNotes}</p>
              </div>
            )}

            {/* Voucher and Commercial Status */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
              <div className="flex items-center space-x-2">
                <FileCheck className="w-4 h-4 text-slate-400" />
                <span>Voucher Status: <strong className="text-slate-800">{item.voucherStatus || 'Ready to Generate'}</strong></span>
                {item.voucherCode && <span className="font-mono text-xs text-teal-800 font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200">#{item.voucherCode}</span>}
              </div>

              {/* Commercial Price strictly hidden from B2B agents */}
              {isInternal && item.supplierPrice !== undefined && (
                <div className="text-slate-500 font-mono text-xs">
                  Commercial Nett Cost: <strong className="text-slate-900">{formatCurrency(item.supplierPrice, item.supplierCurrency || 'USD')}</strong>
                </div>
              )}
            </div>

            {/* Quick Status Workflow Buttons */}
            {onQuickStatusUpdate && (
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <span className="text-[11px] font-bold text-slate-500 mr-1">Quick Action:</span>
                <button
                  type="button"
                  onClick={() => onQuickStatusUpdate(item, 'Ready for Dispatch')}
                  className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-bold text-xs border border-indigo-200 transition-colors cursor-pointer"
                >
                  Mark Ready for Dispatch
                </button>
                <button
                  type="button"
                  onClick={() => onQuickStatusUpdate(item, 'In Progress')}
                  className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold text-xs border border-blue-200 transition-colors cursor-pointer"
                >
                  Mark In Progress
                </button>
                <button
                  type="button"
                  onClick={() => onQuickStatusUpdate(item, 'Completed')}
                  className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold text-xs border border-teal-200 transition-colors cursor-pointer"
                >
                  Mark Completed
                </button>
              </div>
            )}
          </div>
        )}

        {/* Footer expand toggle & open desk button */}
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center space-x-1 font-bold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <span>{isExpanded ? 'Hide Details' : 'View Operational Details'}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => onOpenBooking(item.bookingId)}
            className="inline-flex items-center space-x-1 text-[#008972] hover:text-[#00705d] font-bold transition-colors cursor-pointer"
          >
            <span>Open in Booking Operations Desk</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
