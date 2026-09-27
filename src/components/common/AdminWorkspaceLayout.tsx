import React from 'react';

interface AdminWorkspaceLayoutProps {
  sidebar: React.ReactNode;
  content: React.ReactNode;
  actions?: React.ReactNode;
}

export const AdminWorkspaceLayout: React.FC<AdminWorkspaceLayoutProps> = ({
  sidebar,
  content,
  actions
}) => {
  return (
    <div className="space-y-6">
      {/* Main Responsive Two-Column Grid Layout (25% / 75%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN - 25% (lg:col-span-3) */}
        <div className="lg:col-span-3 space-y-6 lg:sticky lg:top-6">
          {sidebar}
        </div>

        {/* RIGHT COLUMN - 75% (lg:col-span-9) */}
        <div className="lg:col-span-9 space-y-6">
          {content}
        </div>
      </div>

      {/* Sticky Bottom Action Bar */}
      {actions && (
        <div className="sticky bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md border-t border-slate-200 -mx-6 px-6 py-4 mt-8 flex items-center justify-between shadow-lg">
          {actions}
        </div>
      )}
    </div>
  );
};
