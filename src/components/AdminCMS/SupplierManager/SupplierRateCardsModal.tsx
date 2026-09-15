import React, { useState } from 'react';
import { SupplierRateCard, CurrencyCode } from '../../../types';
import { X, Calendar, DollarSign, Tag, Check, AlertCircle } from 'lucide-react';

interface SupplierRateCardsModalProps {
  supplierId: string;
  supplierName: string;
  initialRateCard?: SupplierRateCard | null;
  onClose: () => void;
  onSave: (rateCardData: Omit<SupplierRateCard, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

export const SupplierRateCardsModal: React.FC<SupplierRateCardsModalProps> = ({
  supplierId,
  supplierName,
  initialRateCard,
  onClose,
  onSave
}) => {
  const [serviceName, setServiceName] = useState(initialRateCard?.serviceName || '');
  const [serviceCategory, setServiceCategory] = useState(initialRateCard?.serviceCategory || 'Transfers');
  const [destination, setDestination] = useState(initialRateCard?.destination || 'Japan');
  const [rateAdult, setRateAdult] = useState(initialRateCard?.rateAdult?.toString() || '');
  const [rateChild, setRateChild] = useState(initialRateCard?.rateChild?.toString() || '');
  const [currency, setCurrency] = useState<CurrencyCode>(initialRateCard?.currency || 'USD');
  const [unitType, setUnitType] = useState<SupplierRateCard['unitType']>(initialRateCard?.unitType || 'PER_PERSON');
  const [validFrom, setValidFrom] = useState(initialRateCard?.validFrom || new Date().toISOString().split('T')[0]);
  const [validTo, setValidTo] = useState(initialRateCard?.validTo || new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0]);
  const [notes, setNotes] = useState(initialRateCard?.notes || '');
  const [isActive, setIsActive] = useState(initialRateCard?.isActive ?? true);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceName.trim()) {
      setError('Service name is required');
      return;
    }
    const adultNum = parseFloat(rateAdult);
    if (isNaN(adultNum) || adultNum < 0) {
      setError('Valid adult net rate is required');
      return;
    }

    onSave({
      supplierId,
      serviceName: serviceName.trim(),
      serviceCategory,
      destination,
      rateAdult: adultNum,
      rateChild: rateChild ? parseFloat(rateChild) : undefined,
      currency,
      unitType,
      validFrom,
      validTo,
      notes: notes.trim() || undefined,
      isActive
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-teal-600" />
              {initialRateCard ? 'Edit Contracted Rate Card' : 'Add Contracted Rate Card'}
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">Supplier: {supplierName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500">Service / Product Name *</label>
            <input
              type="text"
              required
              value={serviceName}
              onChange={e => setServiceName(e.target.value)}
              placeholder="e.g. Haneda Airport Private Sedan Transfer"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-teal-500 mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500">Category</label>
              <select
                value={serviceCategory}
                onChange={e => setServiceCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-teal-500 mt-1"
              >
                <option value="Transfers">Transfers & Transport</option>
                <option value="Hotels">Hotels & Accommodation</option>
                <option value="Activities">Activities & Excursions</option>
                <option value="Day Tours">Day Tours & Sightseeing</option>
                <option value="Guides">Guides & Interpreters</option>
                <option value="Rail">Rail & Bullet Train</option>
                <option value="Visa">Visa Services</option>
                <option value="Private Yachts">Private Yacht Charters</option>
                <option value="Sub-DMC">Ground Handling / DMC</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500">Destination</label>
              <input
                type="text"
                value={destination}
                onChange={e => setDestination(e.target.value)}
                placeholder="e.g. Japan"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-teal-500 mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500">Adult Net Rate *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={rateAdult}
                onChange={e => setRateAdult(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-teal-500 mt-1"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500">Child Net Rate</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={rateChild}
                onChange={e => setRateChild(e.target.value)}
                placeholder="Optional"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-800 focus:outline-none focus:border-teal-500 mt-1"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500">Currency</label>
              <select
                value={currency}
                onChange={e => setCurrency(e.target.value as CurrencyCode)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold focus:outline-none focus:border-teal-500 mt-1"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="JPY">JPY (¥)</option>
                <option value="INR">INR (₹)</option>
                <option value="AUD">AUD (A$)</option>
                <option value="SGD">SGD (S$)</option>
                <option value="AED">AED (AED)</option>
                <option value="THB">THB (฿)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500">Pricing Basis</label>
              <select
                value={unitType}
                onChange={e => setUnitType(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-teal-500 mt-1"
              >
                <option value="PER_PERSON">Per Person</option>
                <option value="PER_UNIT">Per Unit / Vehicle</option>
                <option value="PER_HOUR">Per Hour</option>
                <option value="PER_DAY">Per Day</option>
                <option value="FLAT_FEE">Flat Fee</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500">Valid From</label>
              <input
                type="date"
                value={validFrom}
                onChange={e => setValidFrom(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-teal-500 mt-1"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500">Valid To</label>
              <input
                type="date"
                value={validTo}
                onChange={e => setValidTo(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-teal-500 mt-1"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500">Contract Notes / Seasonality</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Includes English speaking driver; Peak season surcharge applies April"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-teal-500 mt-1"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isActiveRate"
              checked={isActive}
              onChange={e => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300"
            />
            <label htmlFor="isActiveRate" className="text-xs text-slate-700 font-medium">
              Rate card is Active and available for operational quotation
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold cursor-pointer"
            >
              {initialRateCard ? 'Update Rate Card' : 'Save Rate Card'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
