import React from 'react';
import { Booking, BookingStatus } from '../../types';
import { 
  ClipboardList, 
  Sparkles, 
  Clock, 
  RefreshCw, 
  HelpCircle, 
  AlertCircle, 
  Coins, 
  CheckCircle2, 
  FileWarning, 
  Building2, 
  CheckCheck, 
  XCircle, 
  Archive
} from 'lucide-react';

interface BookingDashboardCardsProps {
  bookings: Booking[];
  activeFilter: string;
  onSelectFilter: (filterKey: string) => void;
}

export const BookingDashboardCards: React.FC<BookingDashboardCardsProps> = ({
  bookings,
  activeFilter,
  onSelectFilter
}) => {
  // Compute exact live counts
  const total = bookings.length;
  const newBookings = bookings.filter(b => b.status === 'NEW' || b.status === 'PENDING_CONFIRMATION').length;
  const toBeProcessed = bookings.filter(b => b.status === 'TO_BE_PROCESSED').length;
  const processing = bookings.filter(b => b.status === 'PROCESSING' || b.status === 'IN_PROGRESS').length;
  const waitingForUpdate = bookings.filter(b => b.status === 'WAITING_FOR_UPDATE').length;
  
  const paymentPending = bookings.filter(b => b.paymentStatus === 'PENDING_PAYMENT').length;
  const paymentPartially = bookings.filter(b => b.paymentStatus === 'PARTIALLY_PAID').length;
  const paymentCompleted = bookings.filter(b => b.paymentStatus === 'PAID').length;
  
  const documentsPending = bookings.filter(b => b.documentStatus === 'DOCUMENTS_PENDING' || (b.missingDocuments && b.missingDocuments.length > 0)).length;
  const supplierPending = bookings.filter(b => b.supplierAllocationStatus !== 'FULLY_CONFIRMED_BY_SUPPLIERS' && b.status !== 'CANCELLED' && b.status !== 'COMPLETED').length;
  
  const confirmed = bookings.filter(b => b.status === 'CONFIRMED').length;
  const cancelled = bookings.filter(b => b.status === 'CANCELLED').length;
  const completed = bookings.filter(b => b.status === 'COMPLETED').length;

  const cards = [
    {
      id: 'ALL',
      label: 'Total Bookings',
      count: total,
      icon: ClipboardList,
      color: 'bg-slate-100 text-slate-700',
      activeBorder: 'border-slate-900'
    },
    {
      id: 'STATUS_NEW',
      label: 'New Bookings',
      count: newBookings,
      icon: Sparkles,
      color: 'bg-teal-50 text-[#008f77]',
      activeBorder: 'border-[#00C6A6]'
    },
    {
      id: 'STATUS_TO_BE_PROCESSED',
      label: 'To Be Processed',
      count: toBeProcessed,
      icon: Clock,
      color: 'bg-amber-50 text-amber-700',
      activeBorder: 'border-amber-500'
    },
    {
      id: 'STATUS_PROCESSING',
      label: 'Processing',
      count: processing,
      icon: RefreshCw,
      color: 'bg-blue-50 text-blue-700',
      activeBorder: 'border-blue-500'
    },
    {
      id: 'STATUS_WAITING_FOR_UPDATE',
      label: 'Waiting for Update',
      count: waitingForUpdate,
      icon: HelpCircle,
      color: 'bg-purple-50 text-purple-700',
      activeBorder: 'border-purple-500'
    },
    {
      id: 'PAY_PENDING',
      label: 'Payment Pending',
      count: paymentPending,
      icon: AlertCircle,
      color: 'bg-rose-50 text-rose-700',
      activeBorder: 'border-rose-500'
    },
    {
      id: 'PAY_PARTIAL',
      label: 'Partially Paid',
      count: paymentPartially,
      icon: Coins,
      color: 'bg-amber-50 text-amber-700',
      activeBorder: 'border-amber-500'
    },
    {
      id: 'PAY_PAID',
      label: 'Payment Completed',
      count: paymentCompleted,
      icon: CheckCircle2,
      color: 'bg-emerald-50 text-emerald-700',
      activeBorder: 'border-emerald-500'
    },
    {
      id: 'DOCS_PENDING',
      label: 'Documents Pending',
      count: documentsPending,
      icon: FileWarning,
      color: 'bg-orange-50 text-orange-700',
      activeBorder: 'border-orange-500'
    },
    {
      id: 'SUPPLIER_PENDING',
      label: 'Supplier Pending',
      count: supplierPending,
      icon: Building2,
      color: 'bg-indigo-50 text-indigo-700',
      activeBorder: 'border-indigo-500'
    },
    {
      id: 'STATUS_CONFIRMED',
      label: 'Confirmed',
      count: confirmed,
      icon: CheckCheck,
      color: 'bg-emerald-100 text-emerald-800',
      activeBorder: 'border-emerald-600'
    },
    {
      id: 'STATUS_CANCELLED',
      label: 'Cancelled',
      count: cancelled,
      icon: XCircle,
      color: 'bg-slate-100 text-slate-600',
      activeBorder: 'border-slate-500'
    },
    {
      id: 'STATUS_COMPLETED',
      label: 'Completed',
      count: completed,
      icon: Archive,
      color: 'bg-teal-100 text-teal-800',
      activeBorder: 'border-[#008f77]'
    }
  ];

  return (
    <div id="booking-dashboard-metrics-grid" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
      {cards.map((card) => {
        const Icon = card.icon;
        const isActive = activeFilter === card.id;
        return (
          <button
            key={card.id}
            id={`filter-btn-${card.id.toLowerCase()}`}
            onClick={() => onSelectFilter(card.id)}
            className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer ${
              isActive 
                ? `${card.activeBorder} ring-2 ring-[#00C6A6]/20 bg-teal-50/30 shadow-xs` 
                : 'border-slate-200 bg-white hover:border-slate-300 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between gap-1 mb-2">
              <span className={`p-1.5 rounded-xl ${card.color}`}>
                <Icon className="w-4 h-4" />
              </span>
              <span className={`text-xl font-black font-mono ${card.count > 0 ? 'text-slate-900' : 'text-slate-400'}`}>
                {card.count}
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-600 truncate">
              {card.label}
            </p>
          </button>
        );
      })}
    </div>
  );
};
