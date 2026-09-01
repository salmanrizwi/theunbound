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
      color: 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300',
      activeBorder: 'border-stone-800 dark:border-stone-200'
    },
    {
      id: 'STATUS_NEW',
      label: 'New Bookings',
      count: newBookings,
      icon: Sparkles,
      color: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
      activeBorder: 'border-amber-500'
    },
    {
      id: 'STATUS_TO_BE_PROCESSED',
      label: 'To Be Processed',
      count: toBeProcessed,
      icon: Clock,
      color: 'bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300',
      activeBorder: 'border-orange-500'
    },
    {
      id: 'STATUS_PROCESSING',
      label: 'Processing',
      count: processing,
      icon: RefreshCw,
      color: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
      activeBorder: 'border-blue-500'
    },
    {
      id: 'STATUS_WAITING_FOR_UPDATE',
      label: 'Waiting for Update',
      count: waitingForUpdate,
      icon: HelpCircle,
      color: 'bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300',
      activeBorder: 'border-purple-500'
    },
    {
      id: 'PAY_PENDING',
      label: 'Payment Pending',
      count: paymentPending,
      icon: AlertCircle,
      color: 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300',
      activeBorder: 'border-rose-500'
    },
    {
      id: 'PAY_PARTIAL',
      label: 'Partially Paid',
      count: paymentPartially,
      icon: Coins,
      color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300',
      activeBorder: 'border-yellow-500'
    },
    {
      id: 'PAY_PAID',
      label: 'Payment Completed',
      count: paymentCompleted,
      icon: CheckCircle2,
      color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
      activeBorder: 'border-emerald-500'
    },
    {
      id: 'DOCS_PENDING',
      label: 'Documents Pending',
      count: documentsPending,
      icon: FileWarning,
      color: 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200',
      activeBorder: 'border-amber-600'
    },
    {
      id: 'SUPPLIER_PENDING',
      label: 'Supplier Pending',
      count: supplierPending,
      icon: Building2,
      color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300',
      activeBorder: 'border-indigo-500'
    },
    {
      id: 'STATUS_CONFIRMED',
      label: 'Confirmed',
      count: confirmed,
      icon: CheckCheck,
      color: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200',
      activeBorder: 'border-emerald-600'
    },
    {
      id: 'STATUS_CANCELLED',
      label: 'Cancelled',
      count: cancelled,
      icon: XCircle,
      color: 'bg-stone-200 text-stone-800 dark:bg-stone-800 dark:text-stone-300',
      activeBorder: 'border-stone-500'
    },
    {
      id: 'STATUS_COMPLETED',
      label: 'Completed',
      count: completed,
      icon: Archive,
      color: 'bg-teal-100 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300',
      activeBorder: 'border-teal-500'
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
            className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
              isActive 
                ? `${card.activeBorder} ring-2 ring-amber-500/20 bg-white dark:bg-stone-900 shadow-sm` 
                : 'border-stone-200 dark:border-stone-800 bg-white/70 dark:bg-stone-900/70 hover:border-stone-300 dark:hover:border-stone-700'
            }`}
          >
            <div className="flex items-center justify-between gap-1 mb-2">
              <span className={`p-1.5 rounded-lg ${card.color}`}>
                <Icon className="w-4 h-4" />
              </span>
              <span className={`text-xl font-bold font-mono ${card.count > 0 ? 'text-stone-900 dark:text-stone-100' : 'text-stone-400 dark:text-stone-600'}`}>
                {card.count}
              </span>
            </div>
            <p className="text-xs font-medium text-stone-600 dark:text-stone-400 truncate">
              {card.label}
            </p>
          </button>
        );
      })}
    </div>
  );
};
