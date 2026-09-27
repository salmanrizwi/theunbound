import React from 'react';
import { CurrencyCode, TicketConfig, TicketTierPrice } from '../../../types';
import { formatCurrency } from '../../../services/pricingEngine';
import { Ticket, Plus, Trash2, CheckCircle2, QrCode } from 'lucide-react';

interface TicketTypePricingModuleProps {
  currency: CurrencyCode;
  ticketConfig?: TicketConfig;
  buyerMarkupPercent: number;
  b2bAgentMarkupPercent: number;
  taxPercent: number;
  serviceFeeFixed: number;
  onChange: (updatedConfig: TicketConfig) => void;
}

export const TicketTypePricingModule: React.FC<TicketTypePricingModuleProps> = ({
  currency,
  ticketConfig,
  buyerMarkupPercent,
  b2bAgentMarkupPercent,
  taxPercent,
  serviceFeeFixed,
  onChange
}) => {
  const currentConfig: TicketConfig = {
    ticketType: ticketConfig?.ticketType || 'STANDARD',
    redemptionMethod: ticketConfig?.redemptionMethod || 'INSTANT_QR_VOUCHER',
    bookingCutoffHours: ticketConfig?.bookingCutoffHours ?? 2,
    instantConfirmation: ticketConfig?.instantConfirmation ?? true,
    ticketTiers: ticketConfig?.ticketTiers && ticketConfig.ticketTiers.length > 0 ? ticketConfig.ticketTiers : [
      {
        id: 'tier-std-01',
        name: 'Standard General Admission',
        tierType: 'STANDARD',
        adultNetPrice: 45,
        childNetPrice: 25,
        infantNetPrice: 0,
        buyerMarkupPercent: buyerMarkupPercent || 30,
        b2bAgentMarkupPercent: b2bAgentMarkupPercent || 20,
        redemptionMethod: 'INSTANT_QR_VOUCHER',
        bookingCutoffHours: 2,
        status: 'ACTIVE'
      },
      {
        id: 'tier-vip-02',
        name: 'VIP Priority Fast Track Express',
        tierType: 'VIP_FAST_TRACK',
        adultNetPrice: 85,
        childNetPrice: 50,
        infantNetPrice: 0,
        buyerMarkupPercent: buyerMarkupPercent || 30,
        b2bAgentMarkupPercent: b2bAgentMarkupPercent || 20,
        redemptionMethod: 'INSTANT_QR_VOUCHER',
        bookingCutoffHours: 4,
        status: 'ACTIVE'
      }
    ]
  };

  const calculateDelivered = (net: number, markup: number) => {
    const markupAmt = net * (markup / 100);
    const taxAmt = markupAmt * (taxPercent / 100);
    return Math.round(net + markupAmt + taxAmt + serviceFeeFixed);
  };

  const addTicketTier = () => {
    const newTier: TicketTierPrice = {
      id: `tier-${Date.now()}`,
      name: 'New Admission Option / Pass',
      tierType: 'STANDARD',
      adultNetPrice: 50,
      childNetPrice: 30,
      infantNetPrice: 0,
      buyerMarkupPercent: buyerMarkupPercent || 30,
      b2bAgentMarkupPercent: b2bAgentMarkupPercent || 20,
      redemptionMethod: 'INSTANT_QR_VOUCHER',
      bookingCutoffHours: 2,
      status: 'ACTIVE'
    };
    onChange({
      ...currentConfig,
      ticketTiers: [...(currentConfig.ticketTiers || []), newTier]
    });
  };

  const updateTicketTier = (index: number, patch: Partial<TicketTierPrice>) => {
    const updated = [...(currentConfig.ticketTiers || [])];
    updated[index] = { ...updated[index], ...patch };
    onChange({
      ...currentConfig,
      ticketTiers: updated
    });
  };

  const removeTicketTier = (index: number) => {
    const updated = (currentConfig.ticketTiers || []).filter((_, i) => i !== index);
    onChange({
      ...currentConfig,
      ticketTiers: updated
    });
  };

  return (
    <div className="bg-slate-800/80 p-4 rounded-xl border border-blue-500/30 space-y-4">
      {/* Header & Global Rules */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700/80 pb-3">
        <div className="flex items-center space-x-2">
          <Ticket className="w-4 h-4 text-blue-400" />
          <div>
            <h5 className="text-xs font-bold text-white">Ticket-Type Pricing & Admission Tiers</h5>
            <p className="text-[10px] text-slate-400">
              Maintain separate rates and redemption policies per ticket option without creating duplicate products
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={addTicketTier}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold cursor-pointer transition-all shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Ticket Type</span>
        </button>
      </div>

      {/* Ticket Tier Cards */}
      <div className="space-y-3">
        {(currentConfig.ticketTiers || []).map((tier, idx) => {
          const adultDelivered = calculateDelivered(tier.adultNetPrice, tier.buyerMarkupPercent || buyerMarkupPercent);
          return (
            <div key={tier.id || idx} className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center space-x-2 flex-1">
                  <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-300 text-[11px] font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <input
                    type="text"
                    value={tier.name}
                    onChange={e => updateTicketTier(idx, { name: e.target.value })}
                    placeholder="Ticket Tier Name (e.g. Standard Admission, Express Fast Track)"
                    className="flex-1 p-1.5 bg-white text-slate-900 rounded-lg text-xs font-bold"
                  />
                </div>
                <div className="flex items-center space-x-2 shrink-0">
                  <select
                    value={tier.tierType || 'STANDARD'}
                    onChange={e => updateTicketTier(idx, { tierType: e.target.value as any })}
                    className="p-1.5 bg-slate-800 text-slate-200 border border-slate-700 rounded-lg text-xs"
                  >
                    <option value="STANDARD">Standard Pass</option>
                    <option value="VIP_FAST_TRACK">VIP Fast Track</option>
                    <option value="TIMED_ENTRY">Timed Entry Slot</option>
                    <option value="MULTI_DAY_PASS">Multi-Day Explorer</option>
                    <option value="FLEXIBLE">Flexible Open Date</option>
                  </select>
                  {(currentConfig.ticketTiers || []).length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTicketTier(idx)}
                      className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg cursor-pointer transition-colors"
                      title="Delete this ticket tier"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Pricing & Rules Row */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs text-slate-800">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-300 font-medium">Adult Net ({currency}) *</label>
                  <input
                    type="number"
                    min="0"
                    value={tier.adultNetPrice ?? 0}
                    onChange={e => updateTicketTier(idx, { adultNetPrice: Number(e.target.value) || 0 })}
                    className="w-full p-1.5 bg-white rounded font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-300 font-medium">Child Net ({currency})</label>
                  <input
                    type="number"
                    min="0"
                    value={tier.childNetPrice ?? 0}
                    onChange={e => updateTicketTier(idx, { childNetPrice: Number(e.target.value) || 0 })}
                    className="w-full p-1.5 bg-white rounded font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-300 font-medium">Buyer Markup %</label>
                  <input
                    type="number"
                    min="0"
                    value={tier.buyerMarkupPercent !== undefined ? tier.buyerMarkupPercent : (buyerMarkupPercent ?? 0)}
                    onChange={e => updateTicketTier(idx, { buyerMarkupPercent: Number(e.target.value) || 0 })}
                    className="w-full p-1.5 bg-white rounded font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-300 font-medium">Redemption Method</label>
                  <select
                    value={tier.redemptionMethod || 'INSTANT_QR_VOUCHER'}
                    onChange={e => updateTicketTier(idx, { redemptionMethod: e.target.value as any })}
                    className="w-full p-1.5 bg-white rounded font-medium text-[11px]"
                  >
                    <option value="INSTANT_QR_VOUCHER">Instant QR Code</option>
                    <option value="MOBILE_VOUCHER">Mobile Voucher</option>
                    <option value="PRINTED_VOUCHER">Printed Paper</option>
                    <option value="WILL_CALL_COUNTER">Box Office Will Call</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-emerald-400 font-bold">Buyer Selling (Adult)</label>
                  <div className="p-1.5 bg-slate-950 border border-slate-800 rounded font-mono font-bold text-emerald-400 text-center">
                    {formatCurrency(adultDelivered, currency)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
