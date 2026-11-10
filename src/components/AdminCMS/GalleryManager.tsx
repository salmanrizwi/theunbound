import React from 'react';
import { HappyCustomerGalleryManager } from './HappyCustomerGalleryManager';
import { Sparkles, LayoutTemplate } from 'lucide-react';

export const GalleryManager: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#008972] border border-teal-200 flex items-center justify-center font-bold">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-slate-900">Happy Customer Gallery CMS</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-[#008972] border border-teal-200">
                Integrated Homepage Section
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Directly synchronised with Firebase Storage and Firestore. Position and visibility are also managed via <strong>Homepage Management → Sequence & Ordering</strong>.
            </p>
          </div>
        </div>
      </div>
      <HappyCustomerGalleryManager />
    </div>
  );
};
