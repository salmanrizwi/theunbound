import React, { useState } from 'react';
import { X, Copy, ArrowRight, Check, Sparkles, Layers, Info } from 'lucide-react';

export interface OptionDuplicateModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeOptionNumber: number;
  onConfirmDuplicate: (fromOptionNumber: number, toOptionNumber: number) => void;
}

export const OptionDuplicateModal: React.FC<OptionDuplicateModalProps> = ({
  isOpen,
  onClose,
  activeOptionNumber,
  onConfirmDuplicate
}) => {
  const [sourceOption, setSourceOption] = useState<number>(activeOptionNumber);
  const [targetOption, setTargetOption] = useState<number>(activeOptionNumber === 1 ? 2 : 1);

  if (!isOpen) return null;

  const handleDuplicate = () => {
    if (sourceOption === targetOption) return;
    onConfirmDuplicate(sourceOption, targetOption);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-3xl border border-slate-200 w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-[#00C6A6]/20 border border-[#00C6A6]/40 text-[#00E5C0] flex items-center justify-center shrink-0">
              <Copy className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Duplicate Quotation Option</h3>
              <p className="text-xs text-slate-400">Clone full itinerary & services into another tier</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-5">
          <div className="p-3 rounded-2xl bg-teal-50/80 border border-teal-200 flex items-start space-x-2.5 text-xs text-teal-900">
            <Info className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
            <span>
              Duplicating will clone all booked hotels, activities, transfers, day themes, and visa services from <strong>Option {sourceOption}</strong> into <strong>Option {targetOption}</strong> with separate instances.
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                Source Option (Copy From)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => {
                      setSourceOption(num);
                      if (targetOption === num) {
                        setTargetOption(num === 1 ? 2 : 1);
                      }
                    }}
                    className={`py-2.5 rounded-xl border text-xs font-black transition-all cursor-pointer ${
                      sourceOption === num
                        ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Option {num}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-center my-1">
              <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center">
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                Target Option (Paste / Overwrite To)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((num) => (
                  <button
                    key={num}
                    type="button"
                    disabled={sourceOption === num}
                    onClick={() => setTargetOption(num)}
                    className={`py-2.5 rounded-xl border text-xs font-black transition-all cursor-pointer ${
                      sourceOption === num
                        ? 'opacity-40 cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                        : targetOption === num
                        ? 'border-[#00C6A6] bg-[#00C6A6]/10 text-slate-950 font-black shadow-xs ring-2 ring-[#00C6A6]/20'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Option {num}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDuplicate}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black transition-all shadow-xs cursor-pointer flex items-center space-x-2"
          >
            <Copy className="w-3.5 h-3.5 text-[#00C6A6]" />
            <span>Duplicate Option {sourceOption} → Option {targetOption}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
