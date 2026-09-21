import React from 'react';
import { 
  Calendar, 
  Building2, 
  Car, 
  Compass, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Layers, 
  Send, 
  FileCheck, 
  CheckSquare, 
  XCircle,
  HelpCircle
} from 'lucide-react';
import { HorizonDailyMetrics, OperationalHorizonFilters } from './horizonTypes';

interface OperationalHorizonSummaryCardsProps {
  metrics: HorizonDailyMetrics;
  filters: OperationalHorizonFilters;
  onFilterChange: (updates: Partial<OperationalHorizonFilters>) => void;
}

export const OperationalHorizonSummaryCards: React.FC<OperationalHorizonSummaryCardsProps> = ({
  metrics,
  filters,
  onFilterChange
}) => {
  const cards = [
    {
      id: 'TOTAL',
      label: 'Scheduled Items',
      value: metrics.totalScheduled,
      icon: Calendar,
      active: filters.quickFilter === 'ALL' && filters.category === 'ALL',
      onClick: () => onFilterChange({ quickFilter: 'ALL', category: 'ALL' }),
      bgColor: 'bg-white',
      textColor: 'text-slate-900',
      iconColor: 'text-[#008972]',
      borderColor: 'border-slate-200'
    },
    {
      id: 'CHECK_INS',
      label: 'Hotel Check-ins',
      value: metrics.hotelCheckIns,
      subValue: `${metrics.hotelCheckOuts} Out`,
      icon: Building2,
      active: filters.category === 'HOTEL_CHECK_IN',
      onClick: () => onFilterChange({ category: 'HOTEL_CHECK_IN', quickFilter: 'ALL' }),
      bgColor: 'bg-white',
      textColor: 'text-slate-900',
      iconColor: 'text-blue-600',
      borderColor: 'border-slate-200'
    },
    {
      id: 'TRANSFERS',
      label: 'Transfers & Chauffeurs',
      value: metrics.transfers,
      icon: Car,
      active: filters.category === 'TRANSFER',
      onClick: () => onFilterChange({ category: 'TRANSFER', quickFilter: 'ALL' }),
      bgColor: 'bg-white',
      textColor: 'text-slate-900',
      iconColor: 'text-amber-600',
      borderColor: 'border-slate-200'
    },
    {
      id: 'TOURS',
      label: 'Tours & Experiences',
      value: metrics.activitiesAndTours,
      icon: Compass,
      active: filters.category === 'TOUR' || filters.category === 'ACTIVITY',
      onClick: () => onFilterChange({ category: 'TOUR', quickFilter: 'ALL' }),
      bgColor: 'bg-white',
      textColor: 'text-slate-900',
      iconColor: 'text-emerald-600',
      borderColor: 'border-slate-200'
    },
    {
      id: 'CONFIRMED',
      label: 'Confirmed Services',
      value: metrics.confirmedServices,
      subValue: `${metrics.pendingConfirmations} Awaiting`,
      icon: CheckCircle2,
      active: filters.operationalStatus === 'Confirmed',
      onClick: () => onFilterChange({ operationalStatus: filters.operationalStatus === 'Confirmed' ? 'ALL' : 'Confirmed' }),
      bgColor: 'bg-white',
      textColor: 'text-slate-900',
      iconColor: 'text-teal-600',
      borderColor: 'border-slate-200'
    },
    {
      id: 'DISPATCH_READY',
      label: 'Ready for Dispatch',
      value: metrics.readyForDispatch,
      subValue: `${metrics.inProgress} Active`,
      icon: Send,
      active: filters.quickFilter === 'READY_DISPATCH',
      onClick: () => onFilterChange({ quickFilter: filters.quickFilter === 'READY_DISPATCH' ? 'ALL' : 'READY_DISPATCH' }),
      bgColor: 'bg-white',
      textColor: 'text-slate-900',
      iconColor: 'text-indigo-600',
      borderColor: 'border-slate-200'
    },
    {
      id: 'MISSING_SUPPLIER',
      label: 'Missing Supplier',
      value: metrics.missingSuppliers,
      icon: HelpCircle,
      active: filters.quickFilter === 'MISSING_SUPPLIER',
      onClick: () => onFilterChange({ quickFilter: filters.quickFilter === 'MISSING_SUPPLIER' ? 'ALL' : 'MISSING_SUPPLIER' }),
      bgColor: metrics.missingSuppliers > 0 ? 'bg-amber-50/50' : 'bg-white',
      textColor: metrics.missingSuppliers > 0 ? 'text-amber-900' : 'text-slate-900',
      iconColor: 'text-amber-600',
      borderColor: metrics.missingSuppliers > 0 ? 'border-amber-200' : 'border-slate-200'
    },
    {
      id: 'ATTENTION',
      label: 'Needs Attention',
      value: metrics.itemsRequiringAttention,
      subValue: metrics.conflictsCount > 0 ? `${metrics.conflictsCount} Conflicts` : undefined,
      icon: AlertTriangle,
      active: filters.quickFilter === 'NEEDS_ATTENTION',
      onClick: () => onFilterChange({ quickFilter: filters.quickFilter === 'NEEDS_ATTENTION' ? 'ALL' : 'NEEDS_ATTENTION' }),
      bgColor: metrics.itemsRequiringAttention > 0 ? 'bg-rose-50/70' : 'bg-white',
      textColor: metrics.itemsRequiringAttention > 0 ? 'text-rose-900' : 'text-slate-900',
      iconColor: 'text-rose-600',
      borderColor: metrics.itemsRequiringAttention > 0 ? 'border-rose-200' : 'border-slate-200'
    }
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3" id="horizon-summary-metrics">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <button
            key={card.id}
            type="button"
            onClick={card.onClick}
            className={`flex flex-col justify-between p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
              card.bgColor
            } ${
              card.active 
                ? 'ring-2 ring-[#008972] border-[#008972] shadow-sm' 
                : `${card.borderColor} hover:border-slate-300 hover:shadow-2xs`
            }`}
          >
            <div className="flex items-center justify-between w-full mb-2">
              <span className="text-[11px] font-bold text-slate-500 line-clamp-1">
                {card.label}
              </span>
              <Icon className={`w-4 h-4 shrink-0 ${card.iconColor}`} />
            </div>
            
            <div className="flex items-baseline justify-between gap-1.5 mt-auto">
              <span className={`text-xl font-black tracking-tight ${card.textColor}`}>
                {card.value}
              </span>
              {card.subValue && (
                <span className="text-[10px] font-semibold text-slate-400 truncate">
                  {card.subValue}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};
