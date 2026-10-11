import React, { useMemo, useState, useRef } from 'react';
import {
  Calendar,
  Plus,
  Trash2,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Power,
  Tag,
  FileText,
  Edit2
} from 'lucide-react';
import {
  CurrencyCode,
  InventorySurcharge,
  InventoryValidity,
  SurchargeApplicationBasis
} from '../../../types';
import {
  validateInventoryValidityAndSurcharges,
  formatCurrency
} from '../../../services/pricingEngine';

export interface InventoryValidityAndSurchargesSectionProps {
  validFrom: string;
  validTo: string;
  surcharges: InventorySurcharge[];
  nativeCurrency?: CurrencyCode | string;
  defaultApplicationBasis?: SurchargeApplicationBasis;
  categoryLabel?: string;
  requireValidity?: boolean;
  compact?: boolean;
  onChangeValidity: (next: { validFrom: string; validTo: string; validity: InventoryValidity }) => void;
  onChangeSurcharges: (next: InventorySurcharge[]) => void;
}

const SUPPORTED_CURRENCIES: CurrencyCode[] = [
  'USD',
  'JPY',
  'EUR',
  'GBP',
  'INR',
  'AED',
  'SGD',
  'AUD',
  'THB',
  'CHF'
];

const APPLICATION_BASIS_OPTIONS: { value: SurchargeApplicationBasis; label: string }[] = [
  { value: 'PER_PERSON', label: 'Per Person (Chargeable Pax)' },
  { value: 'PER_ADULT', label: 'Per Adult' },
  { value: 'PER_VEHICLE', label: 'Per Vehicle / Charter Unit' },
  { value: 'PER_HOUR', label: 'Per Billable Hour' },
  { value: 'PER_ROOM_NIGHT', label: 'Per Room / Night' },
  { value: 'PER_NIGHT', label: 'Per Night' },
  { value: 'PER_DAY', label: 'Per Coverage / Service Day' },
  { value: 'PER_DEVICE', label: 'Per Device / eSIM Profile' },
  { value: 'PER_SERVICE', label: 'Per Service' },
  { value: 'PER_BOOKING', label: 'Per Booking (Flat)' }
];

function formatHumanDate(isoDate?: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate.trim())) return isoDate || 'Not configured';
  const [y, m, d] = isoDate.trim().split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (isNaN(dt.getTime())) return isoDate;
  return dt.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  });
}

export function createStableSurchargeId(): string {
  return `SUR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
}

export const InventoryValidityAndSurchargesSection: React.FC<InventoryValidityAndSurchargesSectionProps> = ({
  validFrom,
  validTo,
  surcharges = [],
  nativeCurrency = 'USD',
  defaultApplicationBasis = 'PER_PERSON',
  categoryLabel,
  requireValidity = true,
  compact = false,
  onChangeValidity,
  onChangeSurcharges
}) => {
  const safeCurrency = (nativeCurrency || 'USD') as CurrencyCode;
  const [editingSurchargeId, setEditingSurchargeId] = useState<string | null>(null);
  const nameInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const validation = useMemo(
    () =>
      validateInventoryValidityAndSurcharges({
        validity: { validFrom: validFrom || '', validTo: validTo || '' },
        surcharges,
        requireValidity,
        nativeCurrency: safeCurrency
      }),
    [validFrom, validTo, surcharges, requireValidity, safeCurrency]
  );

  const handleValidFromChange = (newFrom: string) => {
    onChangeValidity({
      validFrom: newFrom,
      validTo: validTo || '',
      validity: {
        validFrom: newFrom,
        validTo: validTo || ''
      }
    });
  };

  const handleValidToChange = (newTo: string) => {
    onChangeValidity({
      validFrom: validFrom || '',
      validTo: newTo,
      validity: {
        validFrom: validFrom || '',
        validTo: newTo
      }
    });
  };

  const handleAddSurcharge = () => {
    const newId = createStableSurchargeId();
    const newEntry: InventorySurcharge = {
      surchargeId: newId,
      name: '',
      validFrom: validFrom || '',
      validTo: validTo || '',
      type: 'FIXED',
      value: 0,
      currency: safeCurrency,
      applicationBasis: defaultApplicationBasis,
      status: 'ACTIVE',
      internalNotes: ''
    };
    onChangeSurcharges([...surcharges, newEntry]);
    setEditingSurchargeId(newId);
    setTimeout(() => {
      nameInputRefs.current[newId]?.focus();
    }, 50);
  };

  const handleFocusEditSurcharge = (surchargeId: string) => {
    setEditingSurchargeId(surchargeId);
    setTimeout(() => {
      nameInputRefs.current[surchargeId]?.focus();
    }, 20);
  };

  const handleUpdateSurcharge = (surchargeId: string, patch: Partial<InventorySurcharge>) => {
    const next = surcharges.map(item =>
      item.surchargeId === surchargeId ? { ...item, ...patch } : item
    );
    onChangeSurcharges(next);
  };

  const handleToggleSurchargeStatus = (surchargeId: string) => {
    const next = surcharges.map(item =>
      item.surchargeId === surchargeId
        ? { ...item, status: (item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE') as 'ACTIVE' | 'INACTIVE' }
        : item
    );
    onChangeSurcharges(next);
  };

  const handleRemoveSurcharge = (surchargeId: string) => {
    onChangeSurcharges(surcharges.filter(item => item.surchargeId !== surchargeId));
    if (editingSurchargeId === surchargeId) {
      setEditingSurchargeId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* 1. VALIDITY PERIOD SECTION */}
      <div className={`bg-white border border-slate-200 rounded-xl ${compact ? 'p-4' : 'p-5'} shadow-sm space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#008972] flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                Validity Period {categoryLabel ? `— ${categoryLabel}` : ''}
              </h4>
              <p className="text-xs text-slate-500">
                Commercial sellable validity window enforced across search, configurators, quotes, and booking submission.
              </p>
            </div>
          </div>
          {validFrom && validTo && validation.errors.filter(e => e.startsWith('Valid ')).length === 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {formatHumanDate(validFrom)} – {formatHumanDate(validTo)}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Valid From {requireValidity && <span className="text-rose-500">*</span>}
            </label>
            <input
              type="date"
              aria-label="Valid From"
              value={validFrom || ''}
              onChange={e => handleValidFromChange(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#00C6A6] focus:border-[#00C6A6] outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Valid To {requireValidity && <span className="text-rose-500">*</span>}
            </label>
            <input
              type="date"
              aria-label="Valid To"
              value={validTo || ''}
              onChange={e => handleValidToChange(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#00C6A6] focus:border-[#00C6A6] outline-none"
            />
          </div>
        </div>

        {validation.errors.filter(e => e.startsWith('Valid ')).length > 0 && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-700">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              {validation.errors
                .filter(e => e.startsWith('Valid '))
                .map((err, i) => (
                  <p key={i} className="font-semibold">
                    {err}
                  </p>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* 2. REPEATABLE SURCHARGES SECTION */}
      <div className={`bg-white border border-slate-200 rounded-xl ${compact ? 'p-4' : 'p-5'} shadow-sm space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">Surcharges</h4>
              <p className="text-xs text-slate-500">
                Configure multiple named seasonal or peak surcharge periods evaluated in native currency ({safeCurrency}) prior to FX conversion.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAddSurcharge}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add Surcharge</span>
          </button>
        </div>

        {/* Overlap Warnings */}
        {validation.warnings.length > 0 && (
          <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-800">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-amber-900">
                Overlapping Active Surcharge Periods Detected
              </p>
              {validation.warnings.map((warn, idx) => (
                <p key={idx}>{warn}</p>
              ))}
              <p className="text-[11px] text-amber-700">
                Each active matching surcharge with a distinct ID is evaluated according to its configured rule without duplicate application of the same surcharge. Verify whether these periods are intended to overlap.
              </p>
            </div>
          </div>
        )}

        {/* Surcharge Validation Errors */}
        {validation.errors.filter(e => !e.startsWith('Valid ')).length > 0 && (
          <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-700">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-rose-900">Surcharge Configuration Errors</p>
              {validation.errors
                .filter(e => !e.startsWith('Valid '))
                .map((err, idx) => (
                  <p key={idx}>{err}</p>
                ))}
            </div>
          </div>
        )}

        {surcharges.length === 0 ? (
          <div className="border border-dashed border-slate-200 rounded-lg p-6 text-center bg-slate-50/60">
            <p className="text-xs font-semibold text-slate-600">
              No surcharge periods configured for this inventory record.
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Use &ldquo;+ Add Surcharge&rdquo; to define peak dates (e.g., New Year, Cherry Blossom, Golden Week) with fixed or percentage surcharges.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {surcharges.map((surcharge, index) => {
              const isActive = surcharge.status === 'ACTIVE';
              const isFocusedEditing = editingSurchargeId === surcharge.surchargeId;
              const basisLabel =
                APPLICATION_BASIS_OPTIONS.find(b => b.value === surcharge.applicationBasis)?.label ||
                surcharge.applicationBasis ||
                defaultApplicationBasis;
              const formattedValue =
                surcharge.type === 'PERCENTAGE'
                  ? `${surcharge.value || 0}%`
                  : `${formatCurrency(Number(surcharge.value) || 0, (surcharge.currency || safeCurrency) as CurrencyCode)}`;

              return (
                <div
                  key={surcharge.surchargeId || `sur-idx-${index}`}
                  className={`border rounded-lg p-4 transition-all ${
                    isFocusedEditing
                      ? 'border-[#00C6A6] bg-teal-50/15 ring-1 ring-[#00C6A6]/30'
                      : isActive
                      ? 'border-slate-200 bg-slate-50/40'
                      : 'border-slate-200 bg-slate-100/60 opacity-80'
                  }`}
                >
                  {/* Summary Header Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2.5 border-b border-slate-200/80">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-bold text-slate-900">
                        Surcharge {index + 1} — {surcharge.name?.trim() || 'Unnamed Surcharge'}
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                          isActive
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-slate-200 text-slate-600 border border-slate-300'
                        }`}
                      >
                        {isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleFocusEditSurcharge(surcharge.surchargeId)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Edit surcharge details"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleSurchargeStatus(surcharge.surchargeId)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold border transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                            : 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700'
                        }`}
                        title={isActive ? 'Deactivate surcharge period' : 'Activate surcharge period'}
                      >
                        <Power className="w-3 h-3" />
                        <span>{isActive ? 'Deactivate' : 'Activate'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveSurcharge(surcharge.surchargeId)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
                        title="Remove surcharge period"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>

                  {/* Live Summary Line */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-xs">
                    <span className="text-slate-600 font-medium">
                      {surcharge.validFrom ? formatHumanDate(surcharge.validFrom) : 'Start Date Pending'} –{' '}
                      {surcharge.validTo ? formatHumanDate(surcharge.validTo) : 'End Date Pending'}
                    </span>
                    <span className="font-bold text-slate-900 font-mono">
                      Surcharge: {formattedValue} ({basisLabel})
                    </span>
                  </div>

                  {/* Form Fields Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                        Surcharge Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        ref={el => {
                          nameInputRefs.current[surcharge.surchargeId] = el;
                        }}
                        type="text"
                        value={surcharge.name || ''}
                        onFocus={() => setEditingSurchargeId(surcharge.surchargeId)}
                        onChange={e =>
                          handleUpdateSurcharge(surcharge.surchargeId, { name: e.target.value })
                        }
                        placeholder="e.g. New Year or Cherry Blossom"
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-900 focus:ring-2 focus:ring-[#00C6A6] focus:border-[#00C6A6] outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                        From (Valid From) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={surcharge.validFrom || ''}
                        onFocus={() => setEditingSurchargeId(surcharge.surchargeId)}
                        onChange={e =>
                          handleUpdateSurcharge(surcharge.surchargeId, { validFrom: e.target.value })
                        }
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-900 focus:ring-2 focus:ring-[#00C6A6] focus:border-[#00C6A6] outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                        To (Valid To) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={surcharge.validTo || ''}
                        onFocus={() => setEditingSurchargeId(surcharge.surchargeId)}
                        onChange={e =>
                          handleUpdateSurcharge(surcharge.surchargeId, { validTo: e.target.value })
                        }
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-900 focus:ring-2 focus:ring-[#00C6A6] focus:border-[#00C6A6] outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                        Type <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={surcharge.type || 'FIXED'}
                        onFocus={() => setEditingSurchargeId(surcharge.surchargeId)}
                        onChange={e =>
                          handleUpdateSurcharge(surcharge.surchargeId, {
                            type: e.target.value as 'FIXED' | 'PERCENTAGE',
                            currency: e.target.value === 'FIXED' ? (surcharge.currency || safeCurrency) : surcharge.currency
                          })
                        }
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-900 focus:ring-2 focus:ring-[#00C6A6] focus:border-[#00C6A6] outline-none"
                      >
                        <option value="FIXED">Fixed Amount</option>
                        <option value="PERCENTAGE">Percentage (%)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                        Value <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={surcharge.value === undefined || surcharge.value === null || Number.isNaN(Number(surcharge.value)) ? '' : surcharge.value}
                        onFocus={() => setEditingSurchargeId(surcharge.surchargeId)}
                        onChange={e =>
                          handleUpdateSurcharge(surcharge.surchargeId, {
                            value: e.target.value === '' ? ('' as any) : parseFloat(e.target.value)
                          })
                        }
                        placeholder="0.00"
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-mono font-semibold text-slate-900 focus:ring-2 focus:ring-[#00C6A6] focus:border-[#00C6A6] outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                        Currency {surcharge.type === 'FIXED' && <span className="text-rose-500">*</span>}
                      </label>
                      <select
                        value={surcharge.currency || safeCurrency}
                        disabled={surcharge.type === 'PERCENTAGE'}
                        onFocus={() => setEditingSurchargeId(surcharge.surchargeId)}
                        onChange={e =>
                          handleUpdateSurcharge(surcharge.surchargeId, {
                            currency: e.target.value as CurrencyCode
                          })
                        }
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-900 disabled:bg-slate-100 disabled:text-slate-400 focus:ring-2 focus:ring-[#00C6A6] focus:border-[#00C6A6] outline-none"
                      >
                        {SUPPORTED_CURRENCIES.map(curr => (
                          <option key={curr} value={curr}>
                            {curr}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                        Basis <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={surcharge.applicationBasis || defaultApplicationBasis}
                        onFocus={() => setEditingSurchargeId(surcharge.surchargeId)}
                        onChange={e =>
                          handleUpdateSurcharge(surcharge.surchargeId, {
                            applicationBasis: e.target.value as SurchargeApplicationBasis
                          })
                        }
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-900 focus:ring-2 focus:ring-[#00C6A6] focus:border-[#00C6A6] outline-none"
                      >
                        {APPLICATION_BASIS_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-3">
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                        <span className="inline-flex items-center gap-1">
                          <FileText className="w-3 h-3 text-slate-400" />
                          Internal Notes (Admin-Only — Hidden from B2B Agents)
                        </span>
                      </label>
                      <input
                        type="text"
                        value={surcharge.internalNotes || ''}
                        onFocus={() => setEditingSurchargeId(surcharge.surchargeId)}
                        onChange={e =>
                          handleUpdateSurcharge(surcharge.surchargeId, { internalNotes: e.target.value })
                        }
                        placeholder="Optional internal commercial notes, supplier contract clause, etc."
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs text-slate-700 focus:ring-2 focus:ring-[#00C6A6] focus:border-[#00C6A6] outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                        Status
                      </label>
                      <select
                        value={surcharge.status || 'ACTIVE'}
                        onFocus={() => setEditingSurchargeId(surcharge.surchargeId)}
                        onChange={e =>
                          handleUpdateSurcharge(surcharge.surchargeId, {
                            status: e.target.value as 'ACTIVE' | 'INACTIVE'
                          })
                        }
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-900 focus:ring-2 focus:ring-[#00C6A6] focus:border-[#00C6A6] outline-none"
                      >
                        <option value="ACTIVE">Active</option>
                        <option value="INACTIVE">Inactive</option>
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-[11px] text-slate-500">
          Admin must configure the actual dates and amounts. Surcharges are evaluated in native currency ({safeCurrency}) by the centralized Pricing Engine and converted via CurrencyConversionService.
        </p>
      </div>
    </div>
  );
};
