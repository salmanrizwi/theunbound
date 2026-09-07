import React from 'react';
import { LucideIcon } from 'lucide-react';

interface SectionHeaderProps {
  eyebrow?: string;
  eyebrowIcon?: LucideIcon;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  align?: 'left' | 'center';
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  eyebrow,
  eyebrowIcon: EyebrowIcon,
  title,
  subtitle,
  action,
  align = 'left',
  className = ''
}) => {
  const isCenter = align === 'center';

  return (
    <div className={`flex flex-col ${isCenter ? 'items-center text-center' : 'sm:flex-row sm:items-end justify-between'} gap-3 mb-6 ${className}`}>
      <div className={isCenter ? 'max-w-2xl mx-auto' : 'max-w-3xl'}>
        {eyebrow && (
          <div className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-teal-50 text-[#008972] border border-teal-100 mb-2 ${isCenter ? 'mx-auto' : ''}`}>
            {EyebrowIcon && <EyebrowIcon className="w-3.5 h-3.5 text-[#00C6A6]" />}
            <span>{eyebrow}</span>
          </div>
        )}
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight leading-tight">
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>

      {action && (
        <div className={`shrink-0 ${isCenter ? 'pt-2' : ''}`}>
          {action}
        </div>
      )}
    </div>
  );
};
