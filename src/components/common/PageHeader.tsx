import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  description?: string;
  backLabel?: string;
  onBack?: () => void;
  status?: string;
  statusOptions?: { label: string; value: string }[];
  onStatusChange?: (status: string) => void;
  primaryAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
    disabled?: boolean;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
    disabled?: boolean;
  };
  children?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  backLabel,
  onBack,
  status,
  statusOptions,
  onStatusChange,
  primaryAction,
  secondaryAction,
  children,
  className = ''
}) => {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 border-b border-slate-200 ${className}`}>
      <div className="space-y-1 min-w-0">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center space-x-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{backLabel || 'Back'}</span>
          </button>
        )}
        <h1 className="text-2xl font-black text-slate-900 tracking-tight truncate">
          {title}
        </h1>
        {description && (
          <p className="text-xs text-slate-500 leading-relaxed max-w-3xl">
            {description}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 shrink-0">
        {statusOptions && onStatusChange && (
          <div className="flex items-center gap-2">
            <span className="field-label text-slate-400">Status</span>
            <select
              value={status}
              onChange={(e) => onStatusChange(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:border-[#00C6A6] focus:outline-none shadow-xs"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {secondaryAction && (
          <button
            type="button"
            onClick={secondaryAction.onClick}
            disabled={secondaryAction.disabled}
            className="btn-secondary"
          >
            {secondaryAction.icon}
            <span>{secondaryAction.label}</span>
          </button>
        )}

        {primaryAction && (
          <button
            type="button"
            onClick={primaryAction.onClick}
            disabled={primaryAction.disabled}
            className="btn-primary"
          >
            {primaryAction.icon}
            <span>{primaryAction.label}</span>
          </button>
        )}

        {children}
      </div>
    </div>
  );
};
