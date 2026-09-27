import React, { useState, useMemo, useEffect } from 'react';
import { CurrencyCode, ProductCategory, TieredPrice, CityHub, Destination } from '../../types';
import { 
  Car, 
  Ship, 
  Users, 
  AlertTriangle, 
  Plus, 
  Trash2, 
  ShieldCheck, 
  Calculator, 
  Check, 
  HelpCircle,
  Info,
  Sliders,
  DollarSign,
  Briefcase,
  Layers,
  Settings,
  Gauge
} from 'lucide-react';
import { formatCurrency } from '../../services/pricingEngine';
import { OperationalAssetSelector, SelectedAssetPayload } from '../AdminCMS/OperationalAssetSelector';

export type PricingMode = 'capacity_based' | 'per_person' | 'hourly_based' | 'restaurant';

export interface TierValidationError {
  type: 'overlap' | 'gap' | 'invalid_range' | 'duplicate' | 'incomplete_coverage';
  message: string;
}

interface PricingConfigurationComponentProps {
  category: ProductCategory;
  currency: CurrencyCode;
  onCurrencyChange: (currency: CurrencyCode) => void;
  status?: string;
  
  // Margin & Tax Rules
  buyerMarginPercent: number;
  onBuyerMarginChange: (margin: number) => void;
  
  b2bAgentMarginPercent: number;
  onB2bAgentMarginChange: (margin: number) => void;
  
  taxPercent: number;
  onTaxPercentChange: (tax: number) => void;
  
  serviceFeeFixed: number;
  onServiceFeeFixedChange: (fee: number) => void;

  // Capacity-based tiers
  tieredPricing?: TieredPrice[];
  onTieredPricingChange?: (tiers: TieredPrice[]) => void;

  // Per-person prices
  adultNetPrice: number;
  onAdultNetPriceChange: (price: number) => void;
  childNetPrice: number;
  onChildNetPriceChange: (price: number) => void;
  infantNetPrice: number;
  onInfantNetPriceChange: (price: number) => void;

  // Hourly (Guide)
  hourlyNetPrice?: number;
  onHourlyNetPriceChange?: (price: number) => void;
  minHours?: number;
  onMinHoursChange?: (hours: number) => void;

  // Read-only / Admin indicator
  isAdminView?: boolean;

  // Operational vehicle/yacht snaps passed from form state
  vehicleConfig?: any;
  onVehicleConfigChange?: (config: any) => void;
  destinations?: Destination[];
  cityHubs?: CityHub[];
  destinationId?: string;
  hubId?: string;
  vehicleId?: string;
  onVehicleIdChange?: (id: string | undefined) => void;
  vehicleNameSnapshot?: string;
  onVehicleNameSnapshotChange?: (name: string | undefined) => void;
  vehicleTypeSnapshot?: string;
  onVehicleTypeSnapshotChange?: (type: string | undefined) => void;
  capacitySnapshot?: number;
  onCapacitySnapshotChange?: (capacity: number | undefined) => void;
}

export const PricingConfigurationComponent: React.FC<PricingConfigurationComponentProps> = ({
  category,
  currency,
  onCurrencyChange,
  status = 'ACTIVE',
  buyerMarginPercent,
  onBuyerMarginChange,
  b2bAgentMarginPercent,
  onB2bAgentMarginChange,
  taxPercent,
  onTaxPercentChange,
  serviceFeeFixed,
  onServiceFeeFixedChange,
  tieredPricing = [],
  onTieredPricingChange,
  adultNetPrice,
  onAdultNetPriceChange,
  childNetPrice,
  onChildNetPriceChange,
  infantNetPrice,
  onInfantNetPriceChange,
  hourlyNetPrice = 0,
  onHourlyNetPriceChange,
  minHours = 0,
  onMinHoursChange,
  isAdminView = true,
  vehicleConfig,
  onVehicleConfigChange,
  destinations = [],
  cityHubs = [],
  destinationId,
  hubId,
  vehicleId,
  onVehicleIdChange,
  vehicleNameSnapshot,
  onVehicleNameSnapshotChange,
  vehicleTypeSnapshot,
  onVehicleTypeSnapshotChange,
  capacitySnapshot,
  onCapacitySnapshotChange
}) => {
  // Determine pricing mode based on category
  const pricingMode: PricingMode = 
    (category === 'Private Tours' || category === 'Transfers' || category === 'Private Yacht')
      ? 'capacity_based'
      : (category === 'Guides')
      ? 'hourly_based'
      : (category === 'Lunch / Dinner Restaurant')
      ? 'restaurant'
      : 'per_person';

  // Live Simulator state
  const [testPassengerCount, setTestPassengerCount] = useState<number>(2);

  // Helper formula for final selling price calculation (net -> margin -> tax -> fee)
  const calcSellingPrice = (net: number, marginPct: number) => {
    if (!net || net <= 0) return 0;
    const markupAmt = net * (marginPct / 100);
    const taxAmt = markupAmt * (taxPercent / 100);
    return Math.round(net + markupAmt + taxAmt + serviceFeeFixed);
  };

  const handleUpdateTier = (index: number, field: keyof TieredPrice, val: any) => {
    if (!onTieredPricingChange) return;
    const updated = [...tieredPricing];
    updated[index] = { ...updated[index], [field]: val };
    onTieredPricingChange(updated);
  };

  const handleAddTier = () => {
    if (!onTieredPricingChange) return;
    const nextMin = (tieredPricing[tieredPricing.length - 1]?.maxPax || 0) + 1;
    const nextMax = nextMin + 2;
    const newTier: TieredPrice = {
      id: `tier-${Date.now()}`,
      tierLabel: `${nextMin}–${nextMax} Pax`,
      minPax: nextMin,
      maxPax: nextMax,
      netCostPerPax: 0
    };
    onTieredPricingChange([...tieredPricing, newTier]);
  };

  const handleRemoveTier = (index: number) => {
    if (!onTieredPricingChange) return;
    onTieredPricingChange(tieredPricing.filter((_, i) => i !== index));
  };

  // Operational vehicle properties
  const maxSeats = Number(vehicleConfig?.maxSeats) || Number(capacitySnapshot) || 6;
  const isYacht = category === 'Private Yacht';

  // Tier validation function
  const tierValidationErrors = useMemo<TierValidationError[]>(() => {
    if (pricingMode !== 'capacity_based') return [];
    
    const errors: TierValidationError[] = [];
    if (tieredPricing.length === 0) {
      errors.push({
        type: 'incomplete_coverage',
        message: `No capacity pricing tiers configured. Pax range 1–${maxSeats} must be covered.`
      });
      return errors;
    }

    // Sort tiers by minPax to check gaps and overlaps
    const sortedTiers = [...tieredPricing].sort((a, b) => a.minPax - b.minPax);

    // Check invalid ranges & empty fields
    for (const tier of tieredPricing) {
      if (!tier.minPax || tier.minPax < 1) {
        errors.push({
          type: 'invalid_range',
          message: `Min pax must be at least 1 in tier "${tier.tierLabel || ''}".`
        });
      }
      if (!tier.maxPax || tier.maxPax < 1) {
        errors.push({
          type: 'invalid_range',
          message: `Max pax must be at least 1 in tier "${tier.tierLabel || ''}".`
        });
      }
      if (tier.minPax > tier.maxPax) {
        errors.push({
          type: 'invalid_range',
          message: `Invalid range: Min Pax (${tier.minPax}) is greater than Max Pax (${tier.maxPax}) in tier "${tier.tierLabel || ''}".`
        });
      }
      if (tier.netCostPerPax < 0 || isNaN(tier.netCostPerPax)) {
        errors.push({
          type: 'invalid_range',
          message: `Nett Cost cannot be negative in tier "${tier.tierLabel || ''}".`
        });
      }
    }

    // Check duplicate ranges
    const seenRanges = new Set<string>();
    for (const t of tieredPricing) {
      const key = `${t.minPax}-${t.maxPax}`;
      if (seenRanges.has(key)) {
        errors.push({
          type: 'duplicate',
          message: `Duplicate tier range detected for: ${t.minPax}–${t.maxPax} Pax.`
        });
      }
      seenRanges.add(key);
    }

    // Check overlaps and gaps
    for (let i = 0; i < sortedTiers.length - 1; i++) {
      const current = sortedTiers[i];
      const next = sortedTiers[i + 1];
      
      if (current.minPax > current.maxPax) continue;

      if (current.maxPax >= next.minPax) {
        errors.push({
          type: 'overlap',
          message: `Overlap detected: Tier "${current.tierLabel || `${current.minPax}-${current.maxPax}`}" overlaps with "${next.tierLabel || `${next.minPax}-${next.maxPax}`}".`
        });
      } else if (current.maxPax + 1 < next.minPax) {
        errors.push({
          type: 'gap',
          message: `Gap detected: No pricing tier covers ${current.maxPax + 1} to ${next.minPax - 1} Pax.`
        });
      }
    }

    // Check overall coverage (must cover 1 to maxSeats)
    if (sortedTiers.length > 0) {
      const firstMin = sortedTiers[0].minPax;
      const lastMax = sortedTiers[sortedTiers.length - 1].maxPax;
      
      if (firstMin > 1) {
        errors.push({
          type: 'incomplete_coverage',
          message: `Coverage gap: Pax 1 to ${firstMin - 1} have no configured pricing.`
        });
      }
      
      if (lastMax < maxSeats) {
        errors.push({
          type: 'incomplete_coverage',
          message: `Pricing coverage is incomplete. Pax ${lastMax + 1} to ${maxSeats} have no configured tier.`
        });
      }
    }

    return errors;
  }, [pricingMode, tieredPricing, maxSeats]);

  // Expose error status to global form validation if required
  useEffect(() => {
    if (pricingMode === 'capacity_based') {
      const hasErrors = tierValidationErrors.length > 0;
      if (window) {
        (window as any)._pricingTiersValid = !hasErrors;
      }
    } else {
      if (window) {
        (window as any)._pricingTiersValid = true;
      }
    }
  }, [tierValidationErrors, pricingMode]);

  // Capacity-Based Live Simulator Calculations
  const simulation = useMemo(() => {
    if (pricingMode !== 'capacity_based' || maxSeats <= 0) return null;

    const pax = testPassengerCount;
    const allocationStrategy = vehicleConfig?.allocationStrategy || 'Occupancy Split';
    const allowMultiple = vehicleConfig?.allowMultipleVehicles ?? true;
    const maxVehicles = Number(vehicleConfig?.maxVehicles) || 5;

    // Seating rules overrides
    const adultSeatsPerPax = vehicleConfig?.adultSeatCount ?? 1;
    const childSeatsPerPax = vehicleConfig?.childSeatCount ?? 1;
    const totalRequiredSeats = pax * adultSeatsPerPax; // Simplified for simulator

    // CEILING(Passenger Count / Maximum Vehicle Capacity)
    let vehiclesRequired = 1;
    let isExceeded = false;
    let errorMessage = '';

    if (totalRequiredSeats <= maxSeats) {
      vehiclesRequired = 1;
    } else {
      if (allowMultiple) {
        vehiclesRequired = Math.ceil(totalRequiredSeats / maxSeats);
        if (vehiclesRequired > maxVehicles) {
          vehiclesRequired = maxVehicles;
          isExceeded = true;
          errorMessage = `Exceeds max vehicles constraint (${maxVehicles} vehicles max).`;
        }
      } else {
        vehiclesRequired = 1;
        isExceeded = true;
        errorMessage = `Single vehicle max capacity is ${maxSeats} Pax (allowMultiple is Disabled).`;
      }
    }

    // Distribute passengers across vehicles
    const vehicleDistribution: number[] = [];
    if (allocationStrategy === 'Occupancy Split') {
      // Seq split (e.g. 8 pax -> 6 pax and 2 pax)
      let remaining = totalRequiredSeats;
      for (let i = 0; i < vehiclesRequired; i++) {
        const allocated = Math.min(remaining, maxSeats);
        vehicleDistribution.push(allocated);
        remaining -= allocated;
      }
    } else {
      // Even split (e.g. 8 pax -> 4 pax and 4 pax)
      const base = Math.floor(totalRequiredSeats / vehiclesRequired);
      let remainder = totalRequiredSeats % vehiclesRequired;
      for (let i = 0; i < vehiclesRequired; i++) {
        const count = base + (remainder > 0 ? 1 : 0);
        vehicleDistribution.push(count);
        if (remainder > 0) remainder--;
      }
    }

    // Calculate nett costs for distributed vehicles
    let totalNett = 0;
    const vehicleBreakdown = vehicleDistribution.map((vCount, idx) => {
      // Find matching tier
      const matchingTier = tieredPricing.find(t => vCount >= t.minPax && vCount <= t.maxPax);
      const tierNett = matchingTier ? matchingTier.netCostPerPax : (adultNetPrice || 0);
      totalNett += tierNett;
      return {
        vehicleNumber: idx + 1,
        paxCount: vCount,
        tierName: matchingTier ? matchingTier.tierLabel : 'Default base rate',
        tierNett,
      };
    });

    const buyerSelling = calcSellingPrice(totalNett, buyerMarginPercent);
    const b2bSelling = calcSellingPrice(totalNett, b2bAgentMarginPercent);

    return {
      vehiclesRequired,
      isExceeded,
      errorMessage,
      vehicleBreakdown,
      totalNett,
      buyerSelling,
      b2bSelling,
      vehicleDistribution
    };
  }, [testPassengerCount, tieredPricing, maxSeats, vehicleConfig, adultNetPrice, buyerMarginPercent, b2bAgentMarginPercent, taxPercent, serviceFeeFixed]);

  if (pricingMode !== 'capacity_based') {
    // RENDER STANDARD PER-PERSON OR HOURLY INTERFACES (UNCHANGED BUT CLEANED UP)
    return (
      <div className="space-y-5 bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>Pricing & Commercial Margin Engine</span>
              <span className="text-[10px] bg-blue-500/10 text-blue-700 font-extrabold px-2 py-0.5 rounded border border-blue-500/20 uppercase tracking-wider">
                {pricingMode === 'hourly_based' ? 'Hourly Rate Engine' : 'Per-Person Rate Engine'}
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure baseline nett supplier costs and commercial markups.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Currency</label>
              <select
                value={currency}
                onChange={(e) => onCurrencyChange(e.target.value as CurrencyCode)}
                className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:border-[#00C6A6]"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="JPY">JPY (¥)</option>
                <option value="INR">INR (₹)</option>
                <option value="AED">AED (AED)</option>
                <option value="AUD">AUD ($)</option>
                <option value="THB">THB (฿)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Commercial margins grid */}
        {isAdminView && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
            <div>
              <label className="text-[10px] text-slate-600 font-semibold uppercase">Buyer Margin (%)</label>
              <input
                type="number"
                value={buyerMarginPercent ?? ''}
                onChange={(e) => onBuyerMarginChange(Number(e.target.value))}
                className="w-full mt-1 p-2 bg-white border border-slate-200 rounded-lg font-bold text-slate-900 focus:outline-none focus:border-[#00C6A6]"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-600 font-semibold uppercase">B2B Agent Margin (%)</label>
              <input
                type="number"
                value={b2bAgentMarginPercent ?? ''}
                onChange={(e) => onB2bAgentMarginChange(Number(e.target.value))}
                className="w-full mt-1 p-2 bg-white border border-slate-200 rounded-lg font-bold text-slate-900 focus:outline-none focus:border-[#00C6A6]"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-600 font-semibold uppercase">Tax / VAT (%)</label>
              <input
                type="number"
                value={taxPercent ?? ''}
                onChange={(e) => onTaxPercentChange(Number(e.target.value))}
                className="w-full mt-1 p-2 bg-white border border-slate-200 rounded-lg font-medium text-slate-800 focus:outline-none focus:border-[#00C6A6]"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-600 font-semibold uppercase">Service Fee ({currency})</label>
              <input
                type="number"
                value={serviceFeeFixed ?? ''}
                onChange={(e) => onServiceFeeFixedChange(Number(e.target.value))}
                className="w-full mt-1 p-2 bg-white border border-slate-200 rounded-lg font-medium text-slate-800 focus:outline-none focus:border-[#00C6A6]"
              />
            </div>
          </div>
        )}

        {/* Form controls for Per-person / Hourly rates */}
        {pricingMode === 'hourly_based' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-slate-600 font-semibold uppercase">Base Hourly Net Cost ({currency})</label>
                <input
                  type="number"
                  value={hourlyNetPrice ?? ''}
                  onChange={(e) => onHourlyNetPriceChange && onHourlyNetPriceChange(Number(e.target.value))}
                  className="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-slate-900 text-xs"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-600 font-semibold uppercase">Minimum Hours Commitment</label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={minHours ?? ''}
                  onChange={(e) => onMinHoursChange && onMinHoursChange(Number(e.target.value))}
                  className="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900 text-xs"
                />
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Duration</th>
                    <th className="p-3">Net Supplier Cost</th>
                    <th className="p-3">Buyer Selling Price</th>
                    <th className="p-3">B2B Agent Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[1, 2, 4, 8].map((hrs) => {
                    const net = hrs * hourlyNetPrice;
                    return (
                      <tr key={hrs} className="hover:bg-slate-50/60">
                        <td className="p-3 font-bold text-slate-900">{hrs} Hour{hrs > 1 ? 's' : ''} Service</td>
                        <td className="p-3 font-mono font-bold text-slate-700">{currency} {net.toLocaleString()}</td>
                        <td className="p-3 font-mono font-black text-slate-900">{currency} {calcSellingPrice(net, buyerMarginPercent).toLocaleString()}</td>
                        <td className="p-3 font-mono font-bold text-emerald-700">{currency} {calcSellingPrice(net, b2bAgentMarginPercent).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Passenger Classification</th>
                    {isAdminView && <th className="p-3">Base/Net ({currency})</th>}
                    {isAdminView && <th className="p-3">Buyer Selling Price</th>}
                    {isAdminView && <th className="p-3">B2B Agent Price</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="hover:bg-slate-50/60">
                    <td className="p-3 font-bold text-slate-900">Adult (12+ Yrs)</td>
                    {isAdminView && (
                      <td className="p-3">
                        <input
                          type="number"
                          value={adultNetPrice ?? ''}
                          onChange={(e) => onAdultNetPriceChange(Number(e.target.value))}
                          className="p-1.5 bg-slate-50 border border-slate-200 rounded-md font-mono font-bold text-slate-900 w-28 text-xs focus:outline-none focus:border-[#00C6A6]"
                        />
                      </td>
                    )}
                    {isAdminView && (
                      <td className="p-3 font-mono font-black text-slate-900">
                        {currency} {calcSellingPrice(adultNetPrice, buyerMarginPercent).toLocaleString()}
                      </td>
                    )}
                    {isAdminView && (
                      <td className="p-3 font-mono font-bold text-emerald-700">
                        {currency} {calcSellingPrice(adultNetPrice, b2bAgentMarginPercent).toLocaleString()}
                      </td>
                    )}
                  </tr>

                  <tr className="hover:bg-slate-50/60">
                    <td className="p-3 font-bold text-slate-900">Child (2–11 Yrs)</td>
                    {isAdminView && (
                      <td className="p-3">
                        <input
                          type="number"
                          value={childNetPrice ?? ''}
                          onChange={(e) => onChildNetPriceChange(Number(e.target.value))}
                          className="p-1.5 bg-slate-50 border border-slate-200 rounded-md font-mono font-bold text-slate-900 w-28 text-xs focus:outline-none focus:border-[#00C6A6]"
                        />
                      </td>
                    )}
                    {isAdminView && (
                      <td className="p-3 font-mono font-black text-slate-900">
                        {currency} {calcSellingPrice(childNetPrice, buyerMarginPercent).toLocaleString()}
                      </td>
                    )}
                    {isAdminView && (
                      <td className="p-3 font-mono font-bold text-emerald-700">
                        {currency} {calcSellingPrice(childNetPrice, b2bAgentMarginPercent).toLocaleString()}
                      </td>
                    )}
                  </tr>

                  <tr className="hover:bg-slate-50/60">
                    <td className="p-3 font-bold text-slate-900">Infant (0–1 Yr)</td>
                    {isAdminView && (
                      <td className="p-3">
                        <input
                          type="number"
                          value={infantNetPrice ?? ''}
                          onChange={(e) => onInfantNetPriceChange(Number(e.target.value))}
                          className="p-1.5 bg-slate-50 border border-slate-200 rounded-md font-mono font-bold text-slate-900 w-28 text-xs focus:outline-none focus:border-[#00C6A6]"
                        />
                      </td>
                    )}
                    {isAdminView && (
                      <td className="p-3 font-mono font-black text-slate-900">
                        {currency} {calcSellingPrice(infantNetPrice, buyerMarginPercent).toLocaleString()}
                      </td>
                    )}
                    {isAdminView && (
                      <td className="p-3 font-mono font-bold text-emerald-700">
                        {currency} {calcSellingPrice(infantNetPrice, b2bAgentMarginPercent).toLocaleString()}
                      </td>
                    )}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================================================
  // REDESIGNED CAPACITY-BASED PRICING & COMMERCIAL ENGINE (SECTIONS 15–25)
  // ==========================================================================
  return (
    <div className="space-y-6 bg-slate-900 text-slate-200 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
      
      {/* Decorative premium element */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Main Premium Redesigned Header (Sections 15 & 45) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center space-x-2 text-xs font-black text-[#00C6A6] uppercase tracking-wider mb-1">
            <Calculator className="w-4 h-4 shrink-0" />
            <span>PRICING & COMMERCIAL ENGINE</span>
            <span className="bg-teal-500/10 border border-teal-500/30 text-[#00E5C0] font-extrabold px-2 py-0.5 rounded text-[10px] tracking-widest uppercase">
              CAPACITY BASED
            </span>
          </div>
          <h2 className="text-base font-black text-white">
            {category === 'Private Yacht' ? 'Private Yacht Charter' : category.replace(/s$/, '')} Rates & Operational Mechanics
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Configure database-driven fleet assets, progressive passenger capacity pricing tiers, and commercial formulas.
          </p>
        </div>

        <div className="flex flex-row items-center gap-3 bg-slate-950 p-2.5 rounded-xl border border-slate-800 self-start sm:self-center">
          <div className="text-xs">
            <span className="text-slate-500 block text-[9px] font-bold uppercase tracking-wider">Currency</span>
            <span className="font-bold text-[#00E5C0]">{currency}</span>
          </div>
          <div className="w-[1px] h-6 bg-slate-800" />
          <div className="text-xs">
            <span className="text-slate-500 block text-[9px] font-bold uppercase tracking-wider">Status</span>
            <span className={`inline-flex items-center gap-1 font-bold ${status === 'ACTIVE' ? 'text-teal-400' : 'text-amber-400'}`}>
              <Check className="w-2.5 h-2.5 shrink-0" />
              {status}
            </span>
          </div>
        </div>
      </div>

      {/* 01 COMMERCIAL RULES SECTION */}
      <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded-lg bg-teal-500/10 border border-teal-500/20 text-[#00C6A6] flex items-center justify-center font-black text-xs">
            01
          </div>
          <h3 className="text-xs font-black uppercase text-white tracking-wider">Commercial Rules</h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5 text-xs">
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Native Currency *</label>
            <select
              value={currency}
              onChange={(e) => onCurrencyChange(e.target.value as CurrencyCode)}
              className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl font-black text-[#00E5C0] text-xs focus:outline-none focus:border-[#00C6A6]"
            >
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="JPY">JPY (¥)</option>
              <option value="INR">INR (₹)</option>
              <option value="AED">AED (AED)</option>
              <option value="AUD">AUD (A$)</option>
              <option value="THB">THB (฿)</option>
              <option value="CHF">CHF (CHF)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Buyer Margin (%) *</label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="200"
                value={buyerMarginPercent ?? ''}
                onChange={(e) => onBuyerMarginChange(Number(e.target.value))}
                className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl font-bold text-white text-xs focus:outline-none focus:border-[#00C6A6]"
              />
              <span className="absolute right-2.5 top-2 text-slate-500 font-bold text-[10px]">%</span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">B2B Agent Margin (%) *</label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="200"
                value={b2bAgentMarginPercent ?? ''}
                onChange={(e) => onB2bAgentMarginChange(Number(e.target.value))}
                className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl font-bold text-white text-xs focus:outline-none focus:border-[#00C6A6]"
              />
              <span className="absolute right-2.5 top-2 text-slate-500 font-bold text-[10px]">%</span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Tax / VAT (%) *</label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                value={taxPercent ?? ''}
                onChange={(e) => onTaxPercentChange(Number(e.target.value))}
                className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl font-bold text-slate-300 text-xs focus:outline-none focus:border-[#00C6A6]"
              />
              <span className="absolute right-2.5 top-2 text-slate-500 font-bold text-[10px]">%</span>
            </div>
          </div>

          <div className="space-y-1 col-span-2 sm:col-span-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Service Charge *</label>
            <div className="relative">
              <span className="absolute left-2.5 top-2.5 text-slate-500 text-[10px] font-mono">
                {currency === 'JPY' ? '¥' : (currency === 'EUR' ? '€' : (currency === 'GBP' ? '£' : '$'))}
              </span>
              <input
                type="number"
                min="0"
                value={serviceFeeFixed ?? ''}
                onChange={(e) => onServiceFeeFixedChange(Number(e.target.value))}
                className="w-full pl-6 pr-2 p-2 bg-slate-900 border border-slate-700 rounded-xl font-bold text-slate-300 text-xs focus:outline-none focus:border-[#00C6A6]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 02 FLEET CONFIGURATION SECTION */}
      <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-lg bg-teal-500/10 border border-teal-500/20 text-[#00C6A6] flex items-center justify-center font-black text-xs">
              02
            </div>
            <h3 className="text-xs font-black uppercase text-white tracking-wider">Fleet Configuration</h3>
          </div>

          <span className="text-[10px] text-slate-500 italic">
            Snapshots are automatically synchronized from the Fleet Master.
          </span>
        </div>

        {/* Use the standalone OperationalAssetSelector directly inside this clean layout */}
        <div className="space-y-3 bg-slate-900/40 p-4 rounded-xl border border-slate-800">
          <label className="text-[11px] font-bold text-slate-300 block">
            {isYacht 
              ? 'Select Charter Yacht from Authoritative Master Database *' 
              : 'Select Operational Vehicle from Authoritative Fleet Database *'}
          </label>
          <OperationalAssetSelector
            assetType={isYacht ? 'YACHT' : 'VEHICLE'}
            selectedId={vehicleId || vehicleConfig?.vehicleId}
            selectedName={vehicleNameSnapshot || vehicleConfig?.vehicleModel}
            selectedType={vehicleTypeSnapshot || vehicleConfig?.vehicleType}
            selectedCapacity={capacitySnapshot || vehicleConfig?.maxSeats}
            destinationId={destinationId}
            hubId={hubId}
            onSelect={(asset: SelectedAssetPayload) => {
              if (onVehicleIdChange) onVehicleIdChange(asset.id);
              if (onVehicleNameSnapshotChange) onVehicleNameSnapshotChange(asset.name);
              if (onVehicleTypeSnapshotChange) onVehicleTypeSnapshotChange(asset.type);
              if (onCapacitySnapshotChange) onCapacitySnapshotChange(asset.capacity);

              if (onVehicleConfigChange) {
                onVehicleConfigChange({
                  ...vehicleConfig,
                  vehicleId: asset.id,
                  vehicleModel: asset.name,
                  vehicleName: asset.name,
                  vehicleType: asset.type,
                  maxSeats: asset.capacity,
                  passengerCapacity: asset.capacity,
                  totalSeats: asset.capacity,
                  maxLuggage: asset.luggageCapacity || vehicleConfig?.maxLuggage || 4,
                  unitVehicleNetCost: adultNetPrice || vehicleConfig?.unitVehicleNetCost || 45000,
                  allowMultipleVehicles: vehicleConfig?.allowMultipleVehicles ?? true,
                  autoAllocateVehicles: vehicleConfig?.autoAllocateVehicles ?? true,
                  maxVehicles: vehicleConfig?.maxVehicles || 5,
                  allocationStrategy: vehicleConfig?.allocationStrategy || 'Occupancy Split'
                });
              }
            }}
            onClear={() => {
              if (onVehicleIdChange) onVehicleIdChange(undefined);
              if (onVehicleNameSnapshotChange) onVehicleNameSnapshotChange(undefined);
              if (onVehicleTypeSnapshotChange) onVehicleTypeSnapshotChange(undefined);
              if (onCapacitySnapshotChange) onCapacitySnapshotChange(undefined);
              if (onVehicleConfigChange) onVehicleConfigChange(undefined);
            }}
          />

          {/* Snapshot Specifications Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">Model / Asset</span>
              <span className="text-white font-black truncate block mt-0.5">
                {vehicleNameSnapshot || vehicleConfig?.vehicleModel || 'No Asset Selected'}
              </span>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">Classification</span>
              <span className="text-slate-300 font-bold block mt-0.5">
                {vehicleTypeSnapshot || vehicleConfig?.vehicleType || '—'}
              </span>
            </div>

            <div className="p-3 bg-[#00C6A6]/5 rounded-xl border border-teal-500/20">
              <span className="text-[10px] text-teal-400 block uppercase font-black tracking-wider">Max Capacity</span>
              <span className="text-[#00E5C0] font-black block mt-0.5">
                {maxSeats} {isYacht ? 'Guests' : 'Seats'}
              </span>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">
                {isYacht ? 'Vessel Specs' : 'Luggage Limit'}
              </span>
              <span className="text-slate-300 font-bold block mt-0.5">
                {isYacht 
                  ? (vehicleConfig?.yachtSize || 'Premium Charter')
                  : `${vehicleConfig?.maxLuggage || 4} Suitcases`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 03 CAPACITY & TIERED PRICING SECTION */}
      <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-lg bg-teal-500/10 border border-teal-500/20 text-[#00C6A6] flex items-center justify-center font-black text-xs">
              03
            </div>
            <h3 className="text-xs font-black uppercase text-white tracking-wider">Capacity & Tiered Pricing</h3>
          </div>

          <button
            type="button"
            onClick={handleAddTier}
            className="text-xs font-black text-[#00E5C0] hover:text-[#00C6A6] transition-colors flex items-center gap-1 cursor-pointer bg-teal-500/10 border border-teal-500/20 px-3 py-1.5 rounded-xl self-start sm:self-center"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Pricing Tier</span>
          </button>
        </div>

        {/* Tier validation alerts */}
        {tierValidationErrors.length > 0 && (
          <div className="p-3.5 bg-red-950/40 border border-red-500/30 rounded-xl text-red-200 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-red-400">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Critical Configuration Validation Errors ({tierValidationErrors.length})</span>
            </div>
            <ul className="list-disc pl-4 space-y-0.5 font-medium text-red-300">
              {tierValidationErrors.map((err, idx) => (
                <li key={idx}>{err.message}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Validation success */}
        {tierValidationErrors.length === 0 && (
          <div className="p-3 bg-teal-950/20 border border-teal-500/20 rounded-xl text-teal-300 text-xs flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-teal-400 shrink-0" />
            <span className="font-bold">Pricing coverage is complete and valid. All ranges between 1 and {maxSeats} Pax are successfully covered.</span>
          </div>
        )}

        {/* Tiers Editor Table */}
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/90 shadow-2xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 font-bold uppercase text-[9px] tracking-wider">
                <th className="p-3.5">Tier Label</th>
                <th className="p-3.5">Min Pax</th>
                <th className="p-3.5">Max Pax</th>
                <th className="p-3.5 text-right">Supplier Unit Nett Cost ({currency}) *</th>
                <th className="p-3.5 text-right text-emerald-400">Buyer Price</th>
                <th className="p-3.5 text-right text-[#00E5C0]">B2B Agent Price</th>
                <th className="p-3.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {tieredPricing.map((tier, idx) => {
                const buyerPrice = calcSellingPrice(tier.netCostPerPax, buyerMarginPercent);
                const agentPrice = calcSellingPrice(tier.netCostPerPax, b2bAgentMarginPercent);

                return (
                  <tr key={tier.id} className="hover:bg-slate-900/60 transition-colors">
                    <td className="p-3.5">
                      <input
                        type="text"
                        value={tier.tierLabel ?? ''}
                        onChange={(e) => handleUpdateTier(idx, 'tierLabel', e.target.value)}
                        placeholder={`Tier ${idx + 1}`}
                        className="p-1.5 bg-slate-900 border border-slate-700 rounded-lg font-bold text-white w-32 text-xs focus:outline-none focus:border-[#00C6A6]"
                      />
                    </td>
                    <td className="p-3.5">
                      <input
                        type="number"
                        min="1"
                        value={tier.minPax ?? ''}
                        onChange={(e) => handleUpdateTier(idx, 'minPax', Number(e.target.value))}
                        className="p-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white w-16 text-center text-xs font-semibold focus:outline-none focus:border-[#00C6A6]"
                      />
                    </td>
                    <td className="p-3.5">
                      <input
                        type="number"
                        min="1"
                        value={tier.maxPax ?? ''}
                        onChange={(e) => handleUpdateTier(idx, 'maxPax', Number(e.target.value))}
                        className="p-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white w-16 text-center text-xs font-semibold focus:outline-none focus:border-[#00C6A6]"
                      />
                    </td>
                    <td className="p-3.5 text-right">
                      <input
                        type="number"
                        min="0"
                        value={tier.netCostPerPax ?? ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? 0 : Number(e.target.value);
                          handleUpdateTier(idx, 'netCostPerPax', val);
                          // Sync first tier net cost to adultNetPrice for legacy fallback compatibility
                          if (idx === 0 && onAdultNetPriceChange) {
                            onAdultNetPriceChange(val);
                          }
                        }}
                        className="p-1.5 bg-slate-900 border border-slate-700 rounded-lg font-mono font-bold text-[#00E5C0] w-32 text-right text-xs focus:outline-none focus:border-[#00C6A6]"
                      />
                    </td>
                    <td className="p-3.5 text-right font-mono font-black text-emerald-400">
                      {formatCurrency(buyerPrice, currency)}
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-teal-300">
                      {formatCurrency(agentPrice, currency)}
                    </td>
                    <td className="p-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveTier(idx)}
                        className="text-slate-500 hover:text-red-500 transition-colors p-1.5 cursor-pointer bg-red-500/10 hover:bg-red-500/20 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {tieredPricing.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    <Layers className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                    <span className="font-bold text-xs block">No Capacity Tiers Configured</span>
                    <span className="text-[11px] mt-1 block">Click "Add Pricing Tier" to begin configuring progressive fleet prices.</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 04 VEHICLE ALLOCATION SECTION */}
      <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded-lg bg-teal-500/10 border border-teal-500/20 text-[#00C6A6] flex items-center justify-center font-black text-xs">
            04
          </div>
          <h3 className="text-xs font-black uppercase text-white tracking-wider">Vehicle Allocation</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Allocation Mode</label>
            <select
              value={vehicleConfig?.autoAllocateVehicles ? 'Automatic' : 'Manual'}
              onChange={(e) => {
                if (onVehicleConfigChange) {
                  onVehicleConfigChange({
                    ...vehicleConfig,
                    autoAllocateVehicles: e.target.value === 'Automatic',
                    allowMultipleVehicles: e.target.value === 'Automatic'
                  });
                }
              }}
              className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-[#00C6A6]"
            >
              <option value="Automatic">Automatic (Add vehicles dynamically)</option>
              <option value="Manual">Manual Fixed Quantity</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Allocation Strategy</label>
            <select
              value={vehicleConfig?.allocationStrategy || 'Occupancy Split'}
              onChange={(e) => {
                if (onVehicleConfigChange) {
                  onVehicleConfigChange({
                    ...vehicleConfig,
                    allocationStrategy: e.target.value
                  });
                }
              }}
              className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-[#00C6A6]"
            >
              <option value="Occupancy Split">Occupancy Split (Sequential fill)</option>
              <option value="Even Split">Even Split (Distribute evenly)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Maximum Vehicles Limit</label>
            <input
              type="number"
              min="1"
              max="20"
              value={vehicleConfig?.maxVehicles ?? 5}
              onChange={(e) => {
                if (onVehicleConfigChange) {
                  onVehicleConfigChange({
                    ...vehicleConfig,
                    maxVehicles: Number(e.target.value)
                  });
                }
              }}
              className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-bold focus:outline-none focus:border-[#00C6A6]"
            />
          </div>
        </div>

        <p className="text-[10.5px] text-slate-500 flex items-start gap-1">
          <Info className="w-3.5 h-3.5 text-teal-500 shrink-0 mt-0.5" />
          <span>
            When passenger count exceeds the selected vehicle's maximum capacity of <strong>{maxSeats} Pax</strong>, additional vehicles are automatically allocated. Occupancy Split fills full vehicles first, while Even Split distributes passengers balanced across identical fleet assets.
          </span>
        </p>
      </div>

      {/* 05 LIVE PRICING PREVIEW (SIMULATOR) */}
      <div className="bg-slate-950 p-5 rounded-2xl border border-teal-500/30 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-lg bg-teal-500/20 border border-teal-500/30 text-[#00C6A6] flex items-center justify-center font-black text-xs">
              05
            </div>
            <h3 className="text-xs font-black uppercase text-[#00E5C0] tracking-wider">Live Pricing Simulator (Preview)</h3>
          </div>
          <span className="text-[9px] bg-teal-500/10 text-teal-400 border border-teal-500/20 font-bold px-2 py-0.5 rounded uppercase tracking-wider">
            PREVIEW ONLY
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 text-xs">
          {/* Simulator Controls */}
          <div className="md:col-span-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Test Passenger Count</label>
              <div className="flex items-center space-x-2">
                <input
                  type="range"
                  min="1"
                  max={(maxSeats || 6) * (vehicleConfig?.maxVehicles || 5)}
                  value={testPassengerCount || 1}
                  onChange={(e) => setTestPassengerCount(Number(e.target.value) || 1)}
                  className="w-full accent-[#00C6A6]"
                />
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={testPassengerCount || 1}
                  onChange={(e) => setTestPassengerCount(Math.max(1, Number(e.target.value) || 1))}
                  className="w-16 p-1 bg-slate-950 border border-slate-700 rounded text-center text-[#00E5C0] font-black"
                />
              </div>
              <div className="text-[10px] text-slate-500">
                Adjust slider to test how the engine scales vehicle quantity and tier matching.
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
              <div className="text-slate-500 text-[10px] font-bold uppercase">Simulated Fleet</div>
              <div className="text-white font-black">{vehicleNameSnapshot || vehicleConfig?.vehicleModel || 'No Asset Selected'}</div>
              <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
                <span>Seats Unit Cap:</span>
                <span className="font-bold text-[#00E5C0]">{maxSeats} Pax</span>
              </div>
              <div className="text-[10px] text-slate-400 flex justify-between">
                <span>Required Quantity:</span>
                <span className="font-bold text-white">{simulation?.vehiclesRequired} Vehicle(s)</span>
              </div>
            </div>
          </div>

          {/* Simulator Output */}
          <div className="md:col-span-8 space-y-4">
            {simulation?.isExceeded ? (
              <div className="p-4 bg-red-950/30 border border-red-500/20 rounded-xl text-red-200 text-xs">
                <AlertTriangle className="w-5 h-5 text-red-400 mb-1.5" />
                <span className="font-bold block">Physical Capacity Constraint Exceeded!</span>
                <p className="text-[11px] text-red-300 mt-0.5">{simulation.errorMessage}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Allocation Breakdown</div>
                
                <div className="space-y-2">
                  {simulation?.vehicleBreakdown.map((veh) => (
                    <div key={veh.vehicleNumber} className="flex items-center justify-between p-3 bg-slate-900/60 border border-slate-800 rounded-xl">
                      <div className="flex items-center space-x-2">
                        <Car className="w-4 h-4 text-slate-400 shrink-0" />
                        <div>
                          <div className="font-black text-white text-xs">Vehicle #{veh.vehicleNumber}</div>
                          <div className="text-[10px] text-slate-400">
                            Occupancy: <strong>{veh.paxCount} Pax</strong> • Matched Tier: <strong className="text-teal-400">{veh.tierName}</strong>
                          </div>
                        </div>
                      </div>
                      <div className="text-right font-mono">
                        <span className="text-slate-500 text-[9px] block">NETT COST</span>
                        <span className="font-bold text-[#00E5C0]">{formatCurrency(veh.tierNett, currency)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Final Selling Breakdown */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
                  <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl">
                    <span className="text-slate-500 text-[9px] font-bold block uppercase tracking-wider">Combined Total Nett</span>
                    <div className="font-mono text-white text-base font-bold mt-0.5">
                      {formatCurrency(simulation?.totalNett, currency)}
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Supplier Gross Cost</span>
                  </div>

                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                    <span className="text-emerald-400 text-[9px] font-black block uppercase tracking-wider">Buyer Selling Price</span>
                    <div className="font-mono text-emerald-300 text-lg font-black mt-0.5">
                      {formatCurrency(simulation?.buyerSelling, currency)}
                    </div>
                    <span className="text-[10.5px] text-emerald-400 block mt-0.5">Delivered Base Price</span>
                  </div>

                  <div className="p-3 bg-teal-500/10 border border-teal-500/20 rounded-xl">
                    <span className="text-[#00C6A6] text-[9px] font-black block uppercase tracking-wider">B2B Agent Wholesale</span>
                    <div className="font-mono text-[#00E5C0] text-lg font-black mt-0.5">
                      {formatCurrency(simulation?.b2bSelling, currency)}
                    </div>
                    <span className="text-[10.5px] text-teal-400 block mt-0.5">Agent Contracted Rate</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};
