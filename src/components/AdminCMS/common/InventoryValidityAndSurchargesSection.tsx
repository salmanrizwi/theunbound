import React, { useMemo } from 'react';
import {
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Percent,
  DollarSign,
  ExternalLink,
  ShieldCheck,
  Layers
} from 'lucide-react';
import {
  CurrencyCode,
  InventoryValidity,
  SurchargeApplicationBasis
} from '../../../types';
import {
  validateInventoryValidityAndSurcharges
} from '../../../services/pricingEngine';
import { AppDatabase } from '../../../services/db';
import { resolveEffectiveSurchargeStatus } from '../../../services/surchargeEngine';

export interface InventoryValidityAndSurchargesSectionProps {
  productId?: string;
  productName?: string;
  category?: string;
  productType?: string;
  destinationId?: string;
  destinationName?: string;
  country?: string;
  validFrom?: string;
  validTo?: string;
  nativeCurrency?: CurrencyCode | string;
  defaultApplicationBasis?: SurchargeApplicationBasis;
  categoryLabel?: string;
  requireValidity?: boolean;
  onChangeValidity: (next: { validFrom: string; validTo: string; validity: InventoryValidity }) => void;
}

export const InventoryValidityAndSurchargesSection: React.FC<InventoryValidityAndSurchargesSectionProps> = ({
  productId,
  productName,
  category,
  productType,
  destinationId,
  destinationName,
  country,
  validFrom = '',
  validTo = '',
  nativeCurrency = 'USD',
  categoryLabel = 'Inventory Record',
  requireValidity = true,
  onChangeValidity
}) => {
  const validation = useMemo(
    () =>
      validateInventoryValidityAndSurcharges({
        validityFrom: validFrom,
        validityTo: validTo,
        surcharges: [],
        requireValidity,
        nativeCurrency
      }),
    [validFrom, validTo, requireValidity, nativeCurrency]
  );

  // Fetch linked and category/destination-matched centralized surcharges from Finance & Administration -> Surcharge Management
  const linkedCentralizedSurcharges = useMemo(() => {
    const db = AppDatabase.getInstance();
    if (productId || category || productType || destinationId || destinationName || country) {
      return db.getSurchargesForProduct(productId || '', {
        category: category || categoryLabel,
        productType,
        destinationId,
        destinationName,
        country
      });
    }
    return [];
  }, [productId, category, categoryLabel, productType, destinationId, destinationName, country]);

  const handleValidFromChange = (val: string) => {
    onChangeValidity({
      validFrom: val,
      validTo,
      validity: { validFrom: val, validTo }
    });
  };

  const handleValidToChange = (val: string) => {
    onChangeValidity({
      validFrom,
      validTo: val,
      validity: { validFrom, validTo: val }
    });
  };

  const handleNavigateToCentralizedSurcharges = (
    surchargeId?: string,
    action: 'view' | 'edit' = 'edit'
  ) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('admin-cms-navigate', {
          detail: {
            section: 'SURCHARGE_MANAGEMENT',
            filterProductId: productId || '',
            filterProductName: productName || '',
            selectedSurchargeId: surchargeId || '',
            action: surchargeId ? action : undefined
          }
        })
      );
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. VALIDITY PERIOD SECTION */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#00C6A6]/15 text-[#008972] flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Commercial Validity Period ({categoryLabel})
              </h4>
              <p className="text-[11px] text-slate-500">
                Defines the active date window during which this inventory is eligible for quotations and bookings.
              </p>
            </div>
          </div>

          {validation.isValid && validFrom && validTo ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Valid: {validFrom} → {validTo}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Validity Dates Required</span>
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-700">
              Valid From {requireValidity && <span className="text-rose-500">*</span>}
            </label>
            <input
              type="date"
              value={validFrom}
              onChange={e => handleValidFromChange(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00C6A6]"
            />
            <p className="text-[10px] text-slate-400">
              First date on which this inventory rate is valid for service.
            </p>
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-700">
              Valid To {requireValidity && <span className="text-rose-500">*</span>}
            </label>
            <input
              type="date"
              value={validTo}
              min={validFrom || undefined}
              onChange={e => handleValidToChange(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00C6A6]"
            />
            <p className="text-[10px] text-slate-400">
              Last date on which this inventory rate is valid (must be ≥ Valid From).
            </p>
          </div>
        </div>

        {validation.errors.length > 0 && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-800">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>Validity Validation Requirements:</span>
            </div>
            <ul className="list-disc pl-5 text-[11px] text-rose-700 space-y-0.5">
              {validation.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 2. CENTRALIZED SURCHARGE REFERENCE PANEL (Read-Only Governance) */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-slate-900 text-[#00E5C0] flex items-center justify-center shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Centralized Surcharge Governance ({linkedCentralizedSurcharges.length} Applicable)
              </h4>
              <p className="text-[11px] text-slate-500">
                All surcharges are governed centrally under <strong>Finance &amp; Administration → Surcharge Management</strong>. Product-level surcharge editing is disabled.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleNavigateToCentralizedSurcharges()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer shrink-0 shadow-2xs"
          >
            <span>Manage in Finance &amp; Administration → Surcharge Management</span>
            <ExternalLink className="w-3.5 h-3.5 text-[#00E5C0]" />
          </button>
        </div>

        {linkedCentralizedSurcharges.length === 0 ? (
          <div className="p-4 rounded-xl border border-dashed border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-xs text-slate-600">
              <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0" />
              <span>
                No centralized surcharge rules currently match this inventory item. Standard contracted tariff applies across all valid travel dates.
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleNavigateToCentralizedSurcharges()}
              className="text-[11px] font-bold text-[#008972] hover:text-slate-900 underline shrink-0 cursor-pointer"
            >
              Configure in Surcharge Management →
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto bg-white rounded-xl border border-slate-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 px-3">Surcharge Name &amp; ID</th>
                  <th className="py-2.5 px-3">Match Scope</th>
                  <th className="py-2.5 px-3">Travel Period</th>
                  <th className="py-2.5 px-3">Pricing Basis</th>
                  <th className="py-2.5 px-3">Rate / Amount</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Governance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {linkedCentralizedSurcharges.map(sur => {
                  const effStatus = resolveEffectiveSurchargeStatus(sur);
                  const isDirectLink = productId && Array.isArray(sur.linkedProductIds) && sur.linkedProductIds.includes(productId);
                  return (
                    <tr
                      key={sur.id}
                      onClick={() => handleNavigateToCentralizedSurcharges(sur.id, 'view')}
                      className="hover:bg-slate-50/90 cursor-pointer transition-colors"
                      title="Open in Finance & Administration → Surcharge Management"
                    >
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900">{sur.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {sur.code} · {sur.surchargeCategory.replace(/_/g, ' ')}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-[11px] text-slate-600">
                        {isDirectLink
                          ? 'Direct Product Link'
                          : sur.applyToAllCategoryProducts
                            ? 'Category / Destination Rule'
                            : 'Scope Match'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700">
                        {sur.validFrom} → {sur.validTo}
                        {sur.periods && sur.periods.length > 1 && (
                          <span className="block text-[10px] text-slate-400">
                            +{sur.periods.length - 1} additional window(s)
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-[11px] text-slate-700 font-medium">
                        {sur.pricingBasis.replace(/_/g, ' ')}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                        {sur.calculationType === 'PERCENTAGE' ? (
                          <span className="inline-flex items-center gap-0.5 text-amber-700">
                            <Percent className="w-3 h-3" />
                            {sur.percentage ?? sur.amount}%
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 text-emerald-700">
                            <DollarSign className="w-3 h-3" />
                            {sur.currency} {Number(sur.amount || 0).toLocaleString()}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-[11px] font-bold">
                        <span
                          className={
                            effStatus === 'ACTIVE'
                              ? 'text-emerald-700'
                              : effStatus === 'SCHEDULED'
                                ? 'text-blue-700'
                                : effStatus === 'EXPIRED'
                                  ? 'text-slate-400'
                                  : 'text-amber-700'
                          }
                        >
                          {effStatus}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            handleNavigateToCentralizedSurcharges(sur.id, 'edit');
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold cursor-pointer"
                        >
                          <span>Edit Rule</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
