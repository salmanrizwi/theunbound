import React, { useState } from 'react';
import { Trash2, Archive, AlertTriangle, X, ShieldAlert } from 'lucide-react';
import { CalendarTask } from '../../../types';

interface DeleteTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: CalendarTask | null;
  onConfirmDelete: (reason: string) => void;
  onConfirmArchive: (reason: string) => void;
}

export const DeleteTaskModal: React.FC<DeleteTaskModalProps> = ({
  isOpen,
  onClose,
  task,
  onConfirmDelete,
  onConfirmArchive
}) => {
  if (!isOpen || !task) return null;

  const [reason, setReason] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-5 bg-rose-50/70 border-b border-rose-100 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Delete or Archive Task?</h3>
              <p className="text-xs text-slate-500">Remove from active work planner</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
            <p className="text-xs font-extrabold text-slate-900">{task.title}</p>
            {task.assignedToName && (
              <p className="text-[11px] text-slate-500 mt-0.5">Assigned to: {task.assignedToName}</p>
            )}
          </div>

          {/* Safety Confirmation Notice */}
          <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-start space-x-2.5">
            <ShieldAlert className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div className="text-[11px] text-emerald-900 leading-relaxed">
              <strong>Your business records are completely safe.</strong> Deleting or archiving this task will <em>never</em> delete the related Lead, Quotation, Booking, Supplier, or Customer record.
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Reason for Removal (Optional)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Completed via direct phone call, Duplicate task..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden"
            />
          </div>

          {/* Actions */}
          <div className="space-y-2 pt-2">
            <button
              type="button"
              onClick={() => onConfirmArchive(reason)}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-colors cursor-pointer shadow-xs"
            >
              <Archive className="w-3.5 h-3.5 text-[#00E5C0]" />
              <span>Archive Task (Recommended for History)</span>
            </button>

            <button
              type="button"
              onClick={() => onConfirmDelete(reason)}
              className="w-full py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Permanently</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 px-4 text-slate-500 hover:text-slate-700 text-xs font-semibold text-center cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
