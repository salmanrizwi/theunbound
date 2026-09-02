import React from 'react';
import { LucideIcon, Loader2 } from 'lucide-react';

export type CMSButtonVariant = 
  | 'primary'      // High-priority main action: Save, Create, Publish, Confirm, Submit, Generate, Book
  | 'secondary'    // Supporting actions: Edit, Preview, Configure, View, Duplicate
  | 'tertiary'     // Low-priority / Ghost: Cancel, Back, Reset, Close
  | 'destructive'  // Dangerous actions: Delete, Remove, Deactivate, Cancel Booking
  | 'outline'      // Neutral bordered button
  | 'success';     // Positive / Approved status action

export type CMSButtonSize = 'sm' | 'md' | 'lg';

export interface CMSButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: CMSButtonVariant;
  size?: CMSButtonSize;
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  loadingText?: string;
  fullWidth?: boolean;
  children?: React.ReactNode;
}

export const CMSButton: React.FC<CMSButtonProps> = ({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconPosition = 'left',
  loading = false,
  loadingText,
  fullWidth = false,
  className = '',
  disabled,
  children,
  ...props
}) => {
  // Base styles: accessible click target, font styling, transitions, focus ring
  const baseStyles = "inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-150 cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.98]";

  // Size definitions with comfortable click targets (min 36px desktop, accessible mobile)
  const sizeStyles: Record<CMSButtonSize, { container: string; icon: string }> = {
    sm: {
      container: "h-8 px-3 py-1 text-xs gap-1.5 min-w-[32px]",
      icon: "w-3.5 h-3.5"
    },
    md: {
      container: "h-9 sm:h-10 px-4 py-2 text-xs sm:text-sm gap-2 min-w-[36px]",
      icon: "w-4 h-4"
    },
    lg: {
      container: "h-11 sm:h-12 px-5 py-2.5 text-sm sm:text-base gap-2.5 min-w-[44px]",
      icon: "w-5 h-5"
    }
  };

  // Hierarchy styling according to design guidelines
  const variantStyles: Record<CMSButtonVariant, string> = {
    primary: "bg-[#008972] hover:bg-[#007561] text-white shadow-xs hover:shadow-md focus:ring-[#00C6A6] ring-1 ring-[#00C6A6]/30",
    secondary: "bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/80 hover:border-slate-600 focus:ring-slate-400 shadow-2xs",
    tertiary: "bg-transparent hover:bg-slate-800/60 text-slate-400 hover:text-white border border-transparent focus:ring-slate-500",
    destructive: "bg-rose-600 hover:bg-rose-700 text-white shadow-xs hover:shadow-md focus:ring-rose-500 ring-1 ring-rose-500/30",
    outline: "bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-400 focus:ring-slate-400 shadow-2xs",
    success: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs hover:shadow-md focus:ring-emerald-500 ring-1 ring-emerald-500/30"
  };

  const selectedSize = sizeStyles[size] || sizeStyles.md;
  const selectedVariant = variantStyles[variant] || variantStyles.primary;
  const widthStyle = fullWidth ? "w-full" : "";

  return (
    <button
      disabled={disabled || loading}
      className={`${baseStyles} ${selectedSize.container} ${selectedVariant} ${widthStyle} ${className}`}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className={`${selectedSize.icon} animate-spin`} />
          <span>{loadingText || children}</span>
        </>
      ) : (
        <>
          {Icon && iconPosition === 'left' && (
            <Icon className={`${selectedSize.icon} shrink-0`} />
          )}
          {children && <span className="truncate">{children}</span>}
          {Icon && iconPosition === 'right' && (
            <Icon className={`${selectedSize.icon} shrink-0`} />
          )}
        </>
      )}
    </button>
  );
};
