import React, { useState } from 'react';
import { Supplier } from '../../../types';
import { AlertTriangle, Archive, RotateCcw, X } from 'lucide-react';

interface SupplierArchiveModalProps {
  supplier: Supplier;
  mode: 'archive' | 'restore';
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export const SupplierArchiveModal: React.FC<SupplierArchiveModalProps> = ({
  supplier,
  mode,
  onClose,
  onConfirm
}) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError(`Please provide a reason to ${mode} this supplier.`);
      return;
    }
    onConfirm(reason.trim());
  };

  const isArchive = mode === 'archive';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-xl ${isArchive ? 'bg-amber-100 text-amber-700' : 'bg-teal-100 text-teal-700'}`}>
              {isArchive ? <Archive className="w-5 h-5" /> : <RotateCcw className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">
                {isArchive ? 'Archive Supplier Record' : 'Restore Supplier to Active'}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                {supplier.supplierCode} • {supplier.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className={`p-3.5 rounded-2xl border text-xs space-y-1.5 ${
          isArchive ? 'bg-amber-50/70 border-amber-200 text-amber-900' : 'bg-teal-50/70 border-teal-200 text-teal-900'
        }`}>
          <div className="flex items-center gap-2 font-bold">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{isArchive ? 'Operational Impact Warning' : 'Reactivation Notice'}</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            {isArchive ? (
              <>
                Archiving will <strong>deactivate this supplier</strong> and exclude them from future 
                booking supplier allocation dropdowns. Existing linked bookings and historical rate cards 
                remain securely preserved in the audit ledger.
              </>
            ) : (
              <>
                Restoring this supplier will return their status to <strong>ACTIVE</strong>, making them immediately 
                selectable in the Booking Operations & Supplier Allocation Desk.
              </>
            )}
          </p>
        </div>

        {error && (
          <p className="text-xs font-semibold text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500">
              Audit Justification / Reason *
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={e => {
                setReason(e.target.value);
                setError('');
              }}
              placeholder={isArchive ? "e.g. Contract expired, commercial renegotiation, or temporary suspension..." : "e.g. Contract renewal executed, compliance cleared..."}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-teal-500 mt-1"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`px-4 py-2 rounded-xl text-xs font-bold text-white cursor-pointer ${
                isArchive ? 'bg-amber-600 hover:bg-amber-500' : 'bg-teal-600 hover:bg-teal-500'
              }`}
            >
              {isArchive ? 'Confirm Archive' : 'Confirm Restore'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
