import React from 'react';

interface SectionCardProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export const SectionCard: React.FC<SectionCardProps> = ({ title, description, children, className = '' }) => {
  return (
    <div className={`theunbound-card ${className}`}>
      {(title || description) && (
        <div className="mb-4">
          {title && <h3 className="text-sm font-bold text-slate-900">{title}</h3>}
          {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
        </div>
      )}
      {children}
    </div>
  );
};
