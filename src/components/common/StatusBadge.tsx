import React from 'react';

export type StatusType =
  | 'ACTIVE'
  | 'DRAFT'
  | 'INACTIVE'
  | 'ARCHIVED'
  | 'PENDING'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'IN_PROGRESS'
  | 'NEW'
  | string;

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  size = 'md',
  className = ''
}) => {
  const norm = (status || '').toUpperCase();
  const displayLabel = label || status || 'UNKNOWN';

  let styleClasses = 'bg-slate-100 text-slate-700 border-slate-200';
  let dotColor = 'bg-slate-400';

  if (norm === 'ACTIVE' || norm === 'CONFIRMED' || norm === 'COMPLETED') {
    styleClasses = 'bg-emerald-50 text-emerald-800 border-emerald-200/80';
    dotColor = 'bg-emerald-500';
  } else if (norm === 'DRAFT' || norm === 'PENDING' || norm === 'IN_PROGRESS' || norm === 'NEW') {
    styleClasses = 'bg-amber-50 text-amber-800 border-amber-200/80';
    dotColor = 'bg-amber-500';
  } else if (norm === 'INACTIVE' || norm === 'CANCELLED' || norm === 'ARCHIVED') {
    styleClasses = 'bg-rose-50 text-rose-800 border-rose-200/80';
    dotColor = 'bg-rose-500';
  }

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-bold rounded-full border ${sizeClasses} ${styleClasses} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      <span>{displayLabel}</span>
    </span>
  );
};
