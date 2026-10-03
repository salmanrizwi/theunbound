import React, { useState, useMemo, useEffect } from 'react';
import { 
  CurrencyCode, 
  ProductCategory, 
  TieredPrice, 
  CityHub, 
  Destination,
  TicketConfig,
  TicketTierPrice,
  GuideConfig,
  RestaurantConfig,
  RestaurantMealPriceItem,
  MarginType
} from '../../types';
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
  Gauge,
  Copy,
  Clock,
  Utensils,
  Ticket as TicketIcon,
  Tag,
  ArrowRight,
  Shield,
  Percent,
  CheckCircle2,
  Calendar
} from 'lucide-react';
import { formatCurrency, calculateUnifiedPrice } from '../../services/pricingEngine';
import { OperationalAssetSelector, SelectedAssetPayload } from '../AdminCMS/OperationalAssetSelector';
import { AppDatabase } from '../../services/db';

export type PricingMode = 'capacity_based' | 'per_person' | 'hourly_based' | 'restaurant' | 'ticket';

export interface TierValidationError {
  type: 'overlap' | 'invalid_range' | 'negative_cost';
  message: string;
}

// ----------------------------------------------------------------------------
// Controlled Authoritative Inputs for Capacity Tier Pricing (Sections 2, 4, 5, 6)
// ----------------------------------------------------------------------------
interface SupplierNettInputProps {
  value: number | undefined;
  placeholder?: string;
  currency?: CurrencyCode | string;
  id?: string;
  className?: string;
  onChange: (val: number | undefined) => void;
}

const isSafeNumber = (val: any): boolean => val !== undefined && val !== null && typeof val === 'number' && !Number.isNaN(val);
const safeNumVal = (val: any, fallback: any = ''): any => (val !== undefined && val !== null && typeof val === 'number' && !Number.isNaN(val) ? val : fallback);

export const SupplierNettInput: React.FC<SupplierNettInputProps> = ({
  value,
  placeholder = 'Nett Cost',
  id,
  className = "p-1.5 bg-slate-900 border border-slate-700 rounded-lg font-mono font-bold text-[#00E5C0] w-28 text-right text-xs focus:outline-none focus:border-[#00C6A6]",
  onChange
}) => {
  const [buffer, setBuffer] = useState<string>(() => (isSafeNumber(value) ? String(value) : ''));

  useEffect(() => {
    const clean = buffer.trim();
    const currentNum = (clean === '' || clean === '.') ? undefined : parseFloat(clean);
    const normalizedValue = isSafeNumber(value) ? value : undefined;
    if (normalizedValue !== currentNum) {
      setBuffer(normalizedValue !== undefined ? String(normalizedValue) : '');
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Sanitize commas on paste e.g. "1,250.50" -> "1250.50"
    const raw = e.target.value.replace(/,/g, '');
    // Allow valid decimal representation while typing: digits and at most one decimal point
    if (raw === '' || /^[0-9]*\.?[0-9]*$/.test(raw)) {
      setBuffer(raw);
      if (raw === '' || raw === '.') {
        onChange(undefined);
      } else {
        const parsed = parseFloat(raw);
        if (!isNaN(parsed) && isFinite(parsed)) {
          onChange(parsed);
        }
      }
    }
  };

  const handleBlur = () => {
    const clean = buffer.trim();
    if (clean === '' || clean === '.') {
      setBuffer('');
      onChange(undefined);
    } else {
      const parsed = parseFloat(clean);
      if (!isNaN(parsed) && isFinite(parsed)) {
        // Keep valid representation without truncating user-typed decimals
        onChange(parsed);
      } else {
        setBuffer('');
        onChange(undefined);
      }
    }
  };

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      value={buffer}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
      autoComplete="off"
      spellCheck={false}
    />
  );
};

interface DecimalInputProps {
  value: number | undefined;
  placeholder?: string;
  className?: string;
  onChange: (val: number | undefined) => void;
}

export const DecimalInput: React.FC<DecimalInputProps> = ({
  value,
  placeholder = '',
  className = "p-1.5 bg-slate-900 border border-slate-700 rounded-lg font-mono text-white text-xs w-14 text-right focus:outline-none focus:border-[#00C6A6]",
  onChange
}) => {
  const [buffer, setBuffer] = useState<string>(() => (isSafeNumber(value) ? String(value) : ''));

  useEffect(() => {
    const clean = buffer.trim();
    const currentNum = (clean === '' || clean === '.') ? undefined : parseFloat(clean);
    const normalizedValue = isSafeNumber(value) ? value : undefined;
    if (normalizedValue !== currentNum) {
      setBuffer(normalizedValue !== undefined ? String(normalizedValue) : '');
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/,/g, '');
    if (raw === '' || /^[0-9]*\.?[0-9]*$/.test(raw)) {
      setBuffer(raw);
      if (raw === '' || raw === '.') {
        onChange(undefined);
      } else {
        const parsed = parseFloat(raw);
        if (!isNaN(parsed) && isFinite(parsed)) {
          onChange(parsed);
        }
      }
    }
  };

  const handleBlur = () => {
    const clean = buffer.trim();
    if (clean === '' || clean === '.') {
      setBuffer('');
      onChange(undefined);
    } else {
      const parsed = parseFloat(clean);
      if (!isNaN(parsed) && isFinite(parsed)) {
        onChange(parsed);
      } else {
        setBuffer('');
        onChange(undefined);
      }
    }
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={buffer}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
      autoComplete="off"
      spellCheck={false}
    />
  );
};

export interface PricingConfigurationComponentProps {
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

  // Capacity-based tiers (Private Tour, Transfer, Private Yacht)
  tieredPricing?: TieredPrice[];
  onTieredPricingChange?: (tiers: TieredPrice[]) => void;

  // Per-person prices (Group Tour, Tickets fallback)
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
  guideConfig?: GuideConfig;
  onGuideConfigChange?: (config: GuideConfig) => void;

  // Ticket Specific Configuration
  ticketConfig?: TicketConfig;
  onTicketConfigChange?: (config: TicketConfig) => void;

  // Restaurant Specific Configuration
  restaurantConfig?: RestaurantConfig;
  onRestaurantConfigChange?: (config: RestaurantConfig) => void;
  mealPricing?: RestaurantMealPriceItem[];
  onMealPricingChange?: (pricing: RestaurantMealPriceItem[]) => void;

  // Transfer route details
  fromHubId?: string;
  toHubId?: string;
  fromHubName?: string;
  toHubName?: string;

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
  buyerMarginPercent = 20,
  onBuyerMarginChange,
  b2bAgentMarginPercent = 15,
  onB2bAgentMarginChange,
  taxPercent = 10,
  onTaxPercentChange,
  serviceFeeFixed = 0,
  onServiceFeeFixedChange,
  tieredPricing = [],
  onTieredPricingChange,
  adultNetPrice = 0,
  onAdultNetPriceChange,
  childNetPrice = 0,
  onChildNetPriceChange,
  infantNetPrice = 0,
  onInfantNetPriceChange,
  hourlyNetPrice = 0,
  onHourlyNetPriceChange,
  minHours = 4,
  onMinHoursChange,
  guideConfig,
  onGuideConfigChange,
  ticketConfig,
  onTicketConfigChange,
  restaurantConfig,
  onRestaurantConfigChange,
  mealPricing,
  onMealPricingChange,
  fromHubId,
  toHubId,
  fromHubName,
  toHubName,
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
  // Determine pricing mode based strictly on category (supporting both singular and plural forms)
  const pricingMode: PricingMode = useMemo(() => {
    if (
      category === 'Private Tours' || 
      category === 'Private Tour' || 
      category === 'Transfers' || 
      category === 'Transfer' || 
      category === 'Private Yacht' || 
      category === 'Yacht' ||
      category === 'Ferries' ||
      category === 'Ferry' ||
      category === 'Ferries & Vessels'
    ) {
      return 'capacity_based';
    }
    if (category === 'Guides' || category === 'Guide') {
      return 'hourly_based';
    }
    if (category === 'Lunch / Dinner Restaurant' || category === 'Restaurant') {
      return 'restaurant';
    }
    if (category === 'Tickets' || category === 'Ticket') {
      return 'ticket';
    }
    return 'per_person';
  }, [category]);

  const isTransfer = category === 'Transfers' || category === 'Transfer';
  const isYacht = category === 'Private Yacht' || category === 'Yacht';
  const isFerry = category === 'Ferries' || category === 'Ferry' || category === 'Ferries & Vessels';

  // Live Simulator state
  const [testPassengerCount, setTestPassengerCount] = useState<number>(2);

  // Available Fleet / Yacht / Ferry assets for tier row selection
  const availableVehicles = useMemo(() => {
    try {
      return AppDatabase.getInstance().getVehicles().filter(v => v.status !== 'INACTIVE');
    } catch {
      return [];
    }
  }, []);

  const availableYachts = useMemo(() => {
    try {
      return AppDatabase.getInstance().getYachts().filter(y => y.status !== 'INACTIVE');
    } catch {
      return [];
    }
  }, []);

  const availableFerries = useMemo(() => {
    try {
      return AppDatabase.getInstance().getFerries().filter(f => f.status !== 'INACTIVE');
    } catch {
      return [];
    }
  }, []);

  // Helper formula for calculating selling price
  const calcSellingPrice = (net: number, marginPct: number) => {
    if (!net || net <= 0) return 0;
    return calculateUnifiedPrice({
      nettPrice: net,
      quantity: 1,
      marginType: 'PERCENTAGE',
      marginValue: marginPct,
      taxPercent: taxPercent || 0,
      serviceChargeType: 'PERCENTAGE',
      serviceChargeValue: serviceFeeFixed || 0,
      currency: currency || 'USD'
    }).finalPrice;
  };

  // Helper formula for calculating tier final price using central calculateUnifiedPrice
  const calcTierFinalPrice = (tier: Partial<TieredPrice>): number | undefined => {
    const netVal = tier.supplierNett !== undefined 
      ? tier.supplierNett 
      : (tier.nettPrice !== undefined ? tier.nettPrice : tier.netCostPerPax);
    if (netVal === undefined || isNaN(netVal)) return undefined;

    const mType = tier.marginType || 'PERCENTAGE';
    const mVal = tier.marginValue !== undefined ? tier.marginValue : (b2bAgentMarginPercent || buyerMarginPercent || 20);

    const tType = tier.taxType || 'PERCENTAGE';
    const tVal = tType === 'NOT_APPLICABLE' ? 0 : (tier.taxValue !== undefined ? tier.taxValue : (taxPercent || 10));

    const sType = tier.serviceChargeType || 'PERCENTAGE';
    const sVal = sType === 'NOT_APPLICABLE' ? 0 : (tier.serviceChargeValue !== undefined ? tier.serviceChargeValue : (serviceFeeFixed || 0));

    return calculateUnifiedPrice({
      nettPrice: netVal,
      quantity: 1,
      marginType: mType as any,
      marginValue: mVal,
      taxPercent: tVal,
      serviceChargeType: sType as any,
      serviceChargeValue: sVal,
      currency: currency || 'USD'
    }).finalPrice;
  };

  // --------------------------------------------------------------------------
  // CAPACITY & TIERED PRICING HANDLERS (Sections 5, 6, 7, 8, 9, 10)
  // --------------------------------------------------------------------------
  const handleUpdateTier = (
    index: number, 
    patchOrField: keyof TieredPrice | Partial<TieredPrice>, 
    val?: any
  ) => {
    if (!onTieredPricingChange) return;
    const updated = [...tieredPricing];
    const prev = updated[index] || ({} as TieredPrice);

    const patch: Partial<TieredPrice> = typeof patchOrField === 'string'
      ? { [patchOrField]: val }
      : patchOrField;

    const merged: TieredPrice = {
      ...prev,
      ...patch
    };

    // Keep Pax Range fields synchronized
    if ('minPax' in patch) merged.minPassengers = patch.minPax;
    if ('minPassengers' in patch) merged.minPax = patch.minPassengers;
    if ('maxPax' in patch) merged.maxPassengers = patch.maxPax;
    if ('maxPassengers' in patch) merged.maxPax = patch.maxPassengers;

    // Keep Supplier Nett and Nett Price fields synchronized across canonical model
    if ('supplierNett' in patch) {
      merged.supplierNett = patch.supplierNett;
      merged.nettPrice = patch.supplierNett;
      merged.netCostPerPax = patch.supplierNett as any;
    }
    if ('nettPrice' in patch) {
      merged.supplierNett = patch.nettPrice;
      merged.netCostPerPax = patch.nettPrice as any;
    }
    if ('netCostPerPax' in patch) {
      merged.supplierNett = patch.netCostPerPax;
      merged.nettPrice = patch.netCostPerPax;
    }

    // Recalculate Final Price immediately using Central Pricing Formula
    const calculatedFinal = calcTierFinalPrice(merged);
    merged.finalPrice = calculatedFinal;
    merged.sellingPricePerPax = calculatedFinal;

    updated[index] = merged;
    onTieredPricingChange(updated);
  };

  const handleAddTier = () => {
    if (!onTieredPricingChange) return;
    const lastTier = tieredPricing[tieredPricing.length - 1];
    const nextMin = lastTier?.maxPax ? lastTier.maxPax + 1 : 1;
    const nextMax = nextMin + 2;

    // Requirement 17: A new pricing tier should begin with no asset selected. The Admin explicitly selects the asset.
    const newTier: TieredPrice = {
      id: `tier-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      capacityPricingRuleId: `CPR-${Date.now()}`,
      productCategory: category,
      tierLabel: `${nextMin}–${nextMax} Pax`,
      minPax: nextMin,
      maxPax: nextMax,
      minPassengers: nextMin,
      maxPassengers: nextMax,
      vehicleCount: 1,
      fleetId: '',
      fleetName: '',
      pricingUnit: 'Per Vehicle',
      currency: currency || 'USD',
      nativeCurrency: currency || 'USD',
      supplierNett: undefined,
      nettPrice: undefined,
      netCostPerPax: undefined as any,
      marginType: 'PERCENTAGE',
      marginValue: undefined,
      taxType: 'PERCENTAGE',
      taxValue: undefined,
      serviceChargeType: 'FIXED',
      serviceChargeValue: undefined,
      finalPrice: undefined,
      sellingPricePerPax: undefined,
      effectiveFrom: '',
      effectiveTo: '',
      status: 'ACTIVE'
    };
    onTieredPricingChange([...tieredPricing, newTier]);
  };

  const handleDuplicateTier = (index: number) => {
    if (!onTieredPricingChange || !tieredPricing[index]) return;
    const source = tieredPricing[index];
    const duplicated: TieredPrice = {
      ...source,
      id: `tier-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      tierLabel: `${source.tierLabel} (Copy)`,
      minPax: (source.maxPax || 1) + 1,
      maxPax: (source.maxPax || 1) + 3,
      minPassengers: (source.maxPax || 1) + 1,
      maxPassengers: (source.maxPax || 1) + 3,
      status: 'ACTIVE'
    };
    onTieredPricingChange([...tieredPricing, duplicated]);
  };

  const handleRemoveTier = (index: number) => {
    if (!onTieredPricingChange) return;
    onTieredPricingChange(tieredPricing.filter((_, i) => i !== index));
  };

  // Operational vehicle/yacht physical properties (master reference only)
  const physicalFleetCapacity = Number(capacitySnapshot) || Number(vehicleConfig?.maxSeats) || (isYacht ? 12 : 7);

  // Validation: Check invalid ranges, negative costs, or direct overlaps within same fleet option
  const tierValidationErrors = useMemo<TierValidationError[]>(() => {
    if (pricingMode !== 'capacity_based') return [];
    const errors: TierValidationError[] = [];

    const activeTiers = tieredPricing.filter(t => t.status !== 'INACTIVE');
    for (const tier of activeTiers) {
      if (!tier.minPax || tier.minPax < 1) {
        errors.push({
          type: 'invalid_range',
          message: `Min Pax must be at least 1 in tier "${tier.tierLabel || ''}".`
        });
      }
      if (!tier.maxPax || tier.maxPax < 1) {
        errors.push({
          type: 'invalid_range',
          message: `Max Pax must be at least 1 in tier "${tier.tierLabel || ''}".`
        });
      }
      if (tier.minPax > tier.maxPax) {
        errors.push({
          type: 'invalid_range',
          message: `Invalid range: Min Pax (${tier.minPax}) is greater than Max Pax (${tier.maxPax}) in tier "${tier.tierLabel || ''}".`
        });
      }
      const netVal = tier.supplierNett !== undefined 
        ? tier.supplierNett 
        : (tier.nettPrice !== undefined ? tier.nettPrice : tier.netCostPerPax);
      if (netVal !== undefined && (netVal < 0 || isNaN(netVal))) {
        errors.push({
          type: 'negative_cost',
          message: `Supplier Nett cannot be negative in tier "${tier.tierLabel || ''}".`
        });
      }
    }

    // Check overlaps
    const sorted = [...activeTiers].sort((a, b) => a.minPax - b.minPax);
    for (let i = 0; i < sorted.length - 1; i++) {
      const cur = sorted[i];
      const next = sorted[i + 1];
      if (cur.minPax <= cur.maxPax && next.minPax <= next.maxPax) {
        if (cur.maxPax >= next.minPax) {
          errors.push({
            type: 'overlap',
            message: `Range overlap: Tier "${cur.tierLabel || `${cur.minPax}-${cur.maxPax}`}" overlaps with "${next.tierLabel || `${next.minPax}-${next.maxPax}`}".`
          });
        }
      }
    }

    return errors;
  }, [pricingMode, tieredPricing]);

  // Capacity-Based Live Simulator Calculations (Section 9 & 10)
  const simulation = useMemo(() => {
    if (pricingMode !== 'capacity_based') return null;

    const pax = testPassengerCount;
    const activeTiers = tieredPricing.filter(t => t.status !== 'INACTIVE');
    const sortedTiers = [...activeTiers].sort((a, b) => a.minPax - b.minPax);

    let matchedTier: TieredPrice | undefined = undefined;
    let vehiclesRequired = 1;
    let totalNett = 0;
    let tierDescription = '';

    if (sortedTiers.length > 0) {
      matchedTier = sortedTiers.find(t => pax >= t.minPax && pax <= t.maxPax);

      if (matchedTier) {
        vehiclesRequired = matchedTier.vehicleCount !== undefined && matchedTier.vehicleCount > 0 ? matchedTier.vehicleCount : 1;
        totalNett = matchedTier.nettPrice !== undefined ? matchedTier.nettPrice : matchedTier.netCostPerPax;
        tierDescription = matchedTier.tierLabel || `${matchedTier.minPax}–${matchedTier.maxPax} Pax`;
      } else {
        // Passenger count exceeds configured tiers: scale using product's highest configured tier capacity
        const highestTier = sortedTiers[sortedTiers.length - 1];
        const highestCapacity = highestTier.maxPax || physicalFleetCapacity;
        const highestVehicles = highestTier.vehicleCount || 1;
        const capacityPerVehicle = Math.max(1, Math.floor(highestCapacity / highestVehicles));
        
        vehiclesRequired = Math.ceil(pax / capacityPerVehicle);
        const tierUnitCost = highestTier.nettPrice !== undefined ? highestTier.nettPrice : highestTier.netCostPerPax;
        totalNett = Math.ceil(vehiclesRequired / highestVehicles) * tierUnitCost;
        tierDescription = `Scales dynamically (+${vehiclesRequired} vehicles using rule: ${capacityPerVehicle} pax/vehicle)`;
      }
    } else {
      totalNett = adultNetPrice || 0;
      tierDescription = 'Baseline net rate (No tiers configured)';
    }

    const b2bSelling = calcSellingPrice(totalNett, b2bAgentMarginPercent || buyerMarginPercent || 20);

    return {
      pax,
      vehiclesRequired,
      matchedTier,
      tierDescription,
      totalNett,
      buyerSelling: b2bSelling,
      b2bSelling
    };
  }, [testPassengerCount, pricingMode, tieredPricing, adultNetPrice, buyerMarginPercent, b2bAgentMarginPercent, physicalFleetCapacity, taxPercent, serviceFeeFixed]);

  // --------------------------------------------------------------------------
  // RESTAURANT MEAL PRICING HANDLERS (Sections 18 & 19)
  // --------------------------------------------------------------------------
  const activeMeals: ('Breakfast' | 'Lunch' | 'Dinner')[] = useMemo(() => {
    if (restaurantConfig?.mealSelect && restaurantConfig.mealSelect.length > 0) {
      return restaurantConfig.mealSelect;
    }
    return ['Lunch', 'Dinner'];
  }, [restaurantConfig]);

  const currentMealPricing: RestaurantMealPriceItem[] = useMemo(() => {
    if (mealPricing && mealPricing.length > 0) {
      return mealPricing;
    }
    if (restaurantConfig?.mealPricing && restaurantConfig.mealPricing.length > 0) {
      return restaurantConfig.mealPricing;
    }
    // Generate default structure for active meals
    return activeMeals.map(meal => ({
      id: `meal-${meal.toLowerCase()}`,
      meal,
      adultNettPrice: adultNetPrice || (meal === 'Dinner' ? 12000 : 6500),
      childNettPrice: childNetPrice || (meal === 'Dinner' ? 6000 : 3250),
      infantNettPrice: 0,
      currency,
      marginType: 'PERCENTAGE',
      marginValue: buyerMarginPercent,
      taxType: 'PERCENTAGE',
      taxValue: taxPercent,
      serviceChargeType: 'FIXED',
      serviceChargeValue: serviceFeeFixed,
      adultFinalPrice: calcSellingPrice(adultNetPrice || (meal === 'Dinner' ? 12000 : 6500), buyerMarginPercent),
      childFinalPrice: calcSellingPrice(childNetPrice || (meal === 'Dinner' ? 6000 : 3250), buyerMarginPercent),
      status: 'ACTIVE'
    }));
  }, [mealPricing, restaurantConfig, activeMeals, adultNetPrice, childNetPrice, currency, buyerMarginPercent, taxPercent, serviceFeeFixed]);

  const handleUpdateMealPrice = (mealName: string, field: keyof RestaurantMealPriceItem, val: any) => {
    const updated = currentMealPricing.map(item => {
      if (item.meal.toLowerCase() !== mealName.toLowerCase()) return item;
      const nextItem = { ...item, [field]: val };
      if (field === 'adultNettPrice') {
        nextItem.adultFinalPrice = calcSellingPrice(Number(val), nextItem.marginValue || buyerMarginPercent);
        if (mealName === 'Lunch' && onAdultNetPriceChange) onAdultNetPriceChange(Number(val));
      }
      if (field === 'childNettPrice') {
        nextItem.childFinalPrice = calcSellingPrice(Number(val), nextItem.marginValue || buyerMarginPercent);
        if (mealName === 'Lunch' && onChildNetPriceChange) onChildNetPriceChange(Number(val));
      }
      return nextItem;
    });

    if (onMealPricingChange) onMealPricingChange(updated);
    if (onRestaurantConfigChange) {
      onRestaurantConfigChange({
        ...(restaurantConfig || {}),
        mealPricing: updated
      });
    }
  };

  // --------------------------------------------------------------------------
  // TICKET TYPE PRICING HANDLERS (Section 15)
  // --------------------------------------------------------------------------
  const ticketTiers: TicketTierPrice[] = useMemo(() => {
    if (ticketConfig?.ticketTiers && ticketConfig.ticketTiers.length > 0) {
      return ticketConfig.ticketTiers;
    }
    return [
      {
        id: 'tier-std',
        name: 'Standard General Admission',
        tierType: 'STANDARD',
        adultNetPrice: adultNetPrice || 4500,
        childNetPrice: childNetPrice || 2250,
        infantNetPrice: 0,
        currency,
        sellingPriceStartingFrom: calcSellingPrice(adultNetPrice || 4500, buyerMarginPercent),
        status: 'ACTIVE'
      }
    ];
  }, [ticketConfig, adultNetPrice, childNetPrice, currency, buyerMarginPercent]);

  const handleUpdateTicketTier = (index: number, field: keyof TicketTierPrice, val: any) => {
    const updated = [...ticketTiers];
    const prev = updated[index] || ({} as TicketTierPrice);
    const nextItem: TicketTierPrice = { ...prev, [field]: val };
    if (field === 'adultNetPrice') {
      nextItem.sellingPriceStartingFrom = calcSellingPrice(Number(val), buyerMarginPercent);
      if (index === 0 && onAdultNetPriceChange) onAdultNetPriceChange(Number(val));
    }
    if (field === 'childNetPrice' && index === 0 && onChildNetPriceChange) {
      onChildNetPriceChange(Number(val));
    }
    updated[index] = nextItem;
    if (onTicketConfigChange) {
      onTicketConfigChange({
        ...(ticketConfig || {}),
        ticketTiers: updated
      });
    }
  };

  const handleAddTicketTier = () => {
    const newTier: TicketTierPrice = {
      id: `ticket-tier-${Date.now()}`,
      name: `Ticket Tier ${ticketTiers.length + 1}`,
      tierType: 'STANDARD',
      adultNetPrice: adultNetPrice || 5000,
      childNetPrice: childNetPrice || 2500,
      infantNetPrice: 0,
      currency,
      sellingPriceStartingFrom: calcSellingPrice(adultNetPrice || 5000, buyerMarginPercent),
      status: 'ACTIVE'
    };
    if (onTicketConfigChange) {
      onTicketConfigChange({
        ...(ticketConfig || {}),
        ticketTiers: [...ticketTiers, newTier]
      });
    }
  };

  const handleRemoveTicketTier = (index: number) => {
    const updated = ticketTiers.filter((_, i) => i !== index);
    if (onTicketConfigChange) {
      onTicketConfigChange({
        ...(ticketConfig || {}),
        ticketTiers: updated
      });
    }
  };

  // --------------------------------------------------------------------------
  // 1. RENDER RESTAURANT MEAL + PASSENGER PRICING (Sections 18 & 19)
  // --------------------------------------------------------------------------
  if (pricingMode === 'restaurant') {
    return (
      <div className="space-y-6 bg-slate-900 text-slate-200 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center space-x-2 text-xs font-black text-[#00C6A6] uppercase tracking-wider mb-1">
              <Utensils className="w-4 h-4 shrink-0" />
              <span>MEAL & PASSENGER PRICING ENGINE</span>
              <span className="bg-rose-500/10 border border-rose-500/30 text-rose-300 font-extrabold px-2 py-0.5 rounded text-[10px] tracking-widest uppercase">
                RESTAURANT
              </span>
            </div>
            <h2 className="text-base font-black text-white">
              Restaurant Meal Regimes & Passenger Tariffs
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Configure independent Adult and Child pricing across Breakfast, Lunch, and Dinner. Adult and Child tariffs are never combined.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Native Currency</label>
              <select
                value={currency}
                onChange={(e) => onCurrencyChange(e.target.value as CurrencyCode)}
                className="p-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-[#00E5C0] focus:outline-none focus:border-[#00C6A6]"
              >
                <option value="JPY">JPY (¥)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="THB">THB (฿)</option>
                <option value="AED">AED (AED)</option>
                <option value="INR">INR (₹)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Global Commercial Margins */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-xs">
          <div>
            <label className="text-[10px] text-[#00E5C0] font-bold uppercase tracking-wider block">B2B Margin (%)</label>
            <input
              type="number"
              min="0"
              value={safeNumVal(b2bAgentMarginPercent ?? buyerMarginPercent)}
              onChange={(e) => {
                const val = Number(e.target.value);
                onB2bAgentMarginChange(val);
                if (onBuyerMarginChange) onBuyerMarginChange(val);
              }}
              className="w-full mt-1 p-2 bg-slate-900 border border-slate-700 rounded-lg font-bold text-white text-xs focus:outline-none focus:border-[#00C6A6]"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Tax / VAT (%)</label>
            <input
              type="number"
              min="0"
              value={safeNumVal(taxPercent)}
              onChange={(e) => onTaxPercentChange(Number(e.target.value))}
              className="w-full mt-1 p-2 bg-slate-900 border border-slate-700 rounded-lg font-medium text-slate-300 text-xs focus:outline-none focus:border-[#00C6A6]"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Service Fee ({currency})</label>
            <input
              type="number"
              min="0"
              value={safeNumVal(serviceFeeFixed)}
              onChange={(e) => onServiceFeeFixedChange(Number(e.target.value))}
              className="w-full mt-1 p-2 bg-slate-900 border border-slate-700 rounded-lg font-medium text-slate-300 text-xs focus:outline-none focus:border-[#00C6A6]"
            />
          </div>
        </div>

        {/* Meal-Specific Pricing Table */}
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/90 shadow-2xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 font-bold uppercase text-[9px] tracking-wider">
                <th className="p-3.5">Meal Regime</th>
                <th className="p-3.5">Adult Nett Cost ({currency}) *</th>
                <th className="p-3.5 text-emerald-400">Adult Final Price</th>
                <th className="p-3.5">Child Nett Cost ({currency}) *</th>
                <th className="p-3.5 text-emerald-400">Child Final Price</th>
                <th className="p-3.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {currentMealPricing.map((item) => {
                const adultFinal = calcSellingPrice(item.adultNettPrice, buyerMarginPercent);
                const childFinal = calcSellingPrice(item.childNettPrice, buyerMarginPercent);

                return (
                  <tr key={item.meal} className="hover:bg-slate-900/60 transition-colors">
                    <td className="p-3.5 font-bold text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-rose-400" />
                      <span>{item.meal}</span>
                    </td>
                    <td className="p-3.5">
                      <input
                        type="number"
                        min="0"
                        value={safeNumVal(item.adultNettPrice)}
                        onChange={(e) => handleUpdateMealPrice(item.meal, 'adultNettPrice', Number(e.target.value))}
                        className="p-1.5 bg-slate-900 border border-slate-700 rounded-lg font-mono font-bold text-[#00E5C0] w-32 text-xs focus:outline-none focus:border-[#00C6A6]"
                      />
                    </td>
                    <td className="p-3.5 font-mono font-black text-emerald-400">
                      {formatCurrency(adultFinal, currency)}
                    </td>
                    <td className="p-3.5">
                      <input
                        type="number"
                        min="0"
                        value={safeNumVal(item.childNettPrice)}
                        onChange={(e) => handleUpdateMealPrice(item.meal, 'childNettPrice', Number(e.target.value))}
                        className="p-1.5 bg-slate-900 border border-slate-700 rounded-lg font-mono font-bold text-[#00E5C0] w-32 text-xs focus:outline-none focus:border-[#00C6A6]"
                      />
                    </td>
                    <td className="p-3.5 font-mono font-black text-emerald-400">
                      {formatCurrency(childFinal, currency)}
                    </td>
                    <td className="p-3.5 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-500/10 text-teal-400 border border-teal-500/20">
                        Active
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // 2. RENDER TICKET PER-PERSON PRICING (Section 15)
  // --------------------------------------------------------------------------
  if (pricingMode === 'ticket') {
    return (
      <div className="space-y-6 bg-slate-900 text-slate-200 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center space-x-2 text-xs font-black text-[#00C6A6] uppercase tracking-wider mb-1">
              <TicketIcon className="w-4 h-4 shrink-0" />
              <span>PER-PERSON TICKET PRICING ENGINE</span>
              <span className="bg-purple-500/10 border border-purple-500/30 text-purple-300 font-extrabold px-2 py-0.5 rounded text-[10px] tracking-widest uppercase">
                TICKETS
              </span>
            </div>
            <h2 className="text-base font-black text-white">
              Ticket Tier Structure & Passenger Classifications
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Configure Ticket Types (Standard Admission, VIP, Timed Entry) with distinct Adult, Child, and Infant rates.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleAddTicketTier}
              className="text-xs font-black text-[#00E5C0] hover:text-[#00C6A6] transition-colors flex items-center gap-1 cursor-pointer bg-teal-500/10 border border-teal-500/20 px-3 py-1.5 rounded-xl"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Ticket Tier</span>
            </button>
          </div>
        </div>

        {/* Global Commercial Margins */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-xs">
          <div>
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Buyer Margin (%)</label>
            <input
              type="number"
              min="0"
              value={safeNumVal(buyerMarginPercent)}
              onChange={(e) => onBuyerMarginChange(Number(e.target.value))}
              className="w-full mt-1 p-2 bg-slate-900 border border-slate-700 rounded-lg font-bold text-white text-xs focus:outline-none focus:border-[#00C6A6]"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">B2B Agent Margin (%)</label>
            <input
              type="number"
              min="0"
              value={safeNumVal(b2bAgentMarginPercent)}
              onChange={(e) => onB2bAgentMarginChange(Number(e.target.value))}
              className="w-full mt-1 p-2 bg-slate-900 border border-slate-700 rounded-lg font-bold text-white text-xs focus:outline-none focus:border-[#00C6A6]"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Tax / VAT (%)</label>
            <input
              type="number"
              min="0"
              value={safeNumVal(taxPercent)}
              onChange={(e) => onTaxPercentChange(Number(e.target.value))}
              className="w-full mt-1 p-2 bg-slate-900 border border-slate-700 rounded-lg font-medium text-slate-300 text-xs focus:outline-none focus:border-[#00C6A6]"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Service Fee ({currency})</label>
            <input
              type="number"
              min="0"
              value={safeNumVal(serviceFeeFixed)}
              onChange={(e) => onServiceFeeFixedChange(Number(e.target.value))}
              className="w-full mt-1 p-2 bg-slate-900 border border-slate-700 rounded-lg font-medium text-slate-300 text-xs focus:outline-none focus:border-[#00C6A6]"
            />
          </div>
        </div>

        {/* Ticket Tiers Editor Table */}
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/90 shadow-2xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 font-bold uppercase text-[9px] tracking-wider">
                <th className="p-3.5">Ticket Tier Name</th>
                <th className="p-3.5">Adult Nett ({currency}) *</th>
                <th className="p-3.5 text-emerald-400">Adult Final</th>
                <th className="p-3.5">Child Nett ({currency})</th>
                <th className="p-3.5 text-emerald-400">Child Final</th>
                <th className="p-3.5">Infant Nett ({currency})</th>
                <th className="p-3.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {ticketTiers.map((tier, idx) => {
                const adultFinal = calcSellingPrice(tier.adultNetPrice, buyerMarginPercent);
                const childFinal = calcSellingPrice(tier.childNetPrice || 0, buyerMarginPercent);

                return (
                  <tr key={tier.id} className="hover:bg-slate-900/60 transition-colors">
                    <td className="p-3.5">
                      <input
                        type="text"
                        value={tier.name || ''}
                        onChange={(e) => handleUpdateTicketTier(idx, 'name', e.target.value)}
                        className="p-1.5 bg-slate-900 border border-slate-700 rounded-lg font-bold text-white w-44 text-xs focus:outline-none focus:border-[#00C6A6]"
                      />
                    </td>
                    <td className="p-3.5">
                      <input
                        type="number"
                        min="0"
                        value={safeNumVal(tier.adultNetPrice)}
                        onChange={(e) => handleUpdateTicketTier(idx, 'adultNetPrice', Number(e.target.value))}
                        className="p-1.5 bg-slate-900 border border-slate-700 rounded-lg font-mono font-bold text-[#00E5C0] w-28 text-xs focus:outline-none focus:border-[#00C6A6]"
                      />
                    </td>
                    <td className="p-3.5 font-mono font-black text-emerald-400">
                      {formatCurrency(adultFinal, currency)}
                    </td>
                    <td className="p-3.5">
                      <input
                        type="number"
                        min="0"
                        value={safeNumVal(tier.childNetPrice)}
                        onChange={(e) => handleUpdateTicketTier(idx, 'childNetPrice', Number(e.target.value))}
                        className="p-1.5 bg-slate-900 border border-slate-700 rounded-lg font-mono font-bold text-[#00E5C0] w-28 text-xs focus:outline-none focus:border-[#00C6A6]"
                      />
                    </td>
                    <td className="p-3.5 font-mono font-black text-emerald-400">
                      {formatCurrency(childFinal, currency)}
                    </td>
                    <td className="p-3.5">
                      <input
                        type="number"
                        min="0"
                        value={safeNumVal(tier.infantNetPrice)}
                        onChange={(e) => handleUpdateTicketTier(idx, 'infantNetPrice', Number(e.target.value))}
                        className="p-1.5 bg-slate-900 border border-slate-700 rounded-lg font-mono font-bold text-[#00E5C0] w-24 text-xs focus:outline-none focus:border-[#00C6A6]"
                      />
                    </td>
                    <td className="p-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveTicketTier(idx)}
                        disabled={ticketTiers.length === 1}
                        className="text-slate-500 hover:text-red-400 transition-colors p-1.5 cursor-pointer disabled:opacity-30"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // 3. RENDER GUIDE PER-HOUR PRICING (Section 17)
  // --------------------------------------------------------------------------
  if (pricingMode === 'hourly_based') {
    const effectiveMinHours = minHours || 4;
    const hourlyNet = hourlyNetPrice || adultNetPrice || 6000;
    const hourlySelling = calcSellingPrice(hourlyNet, buyerMarginPercent);
    const hourlyAgentSelling = calcSellingPrice(hourlyNet, b2bAgentMarginPercent);

    return (
      <div className="space-y-6 bg-slate-900 text-slate-200 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center space-x-2 text-xs font-black text-[#00C6A6] uppercase tracking-wider mb-1">
              <Clock className="w-4 h-4 shrink-0" />
              <span>PER-HOUR GUIDE PRICING ENGINE</span>
              <span className="bg-amber-500/10 border border-amber-500/30 text-amber-300 font-extrabold px-2 py-0.5 rounded text-[10px] tracking-widest uppercase">
                HOURLY
              </span>
            </div>
            <h2 className="text-base font-black text-white">
              Professional Guide Tariff & Minimum Hours Commitment
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Configure base hourly supplier costs and minimum hours. Multi-hour bookings calculate directly as Hourly Final Price × Hours.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Native Currency</label>
              <select
                value={currency}
                onChange={(e) => onCurrencyChange(e.target.value as CurrencyCode)}
                className="p-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-[#00E5C0] focus:outline-none focus:border-[#00C6A6]"
              >
                <option value="JPY">JPY (¥)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="THB">THB (฿)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Global Commercial Margins */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-xs">
          <div>
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Buyer Margin (%)</label>
            <input
              type="number"
              min="0"
              value={safeNumVal(buyerMarginPercent)}
              onChange={(e) => onBuyerMarginChange(Number(e.target.value))}
              className="w-full mt-1 p-2 bg-slate-900 border border-slate-700 rounded-lg font-bold text-white text-xs focus:outline-none focus:border-[#00C6A6]"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">B2B Agent Margin (%)</label>
            <input
              type="number"
              min="0"
              value={safeNumVal(b2bAgentMarginPercent)}
              onChange={(e) => onB2bAgentMarginChange(Number(e.target.value))}
              className="w-full mt-1 p-2 bg-slate-900 border border-slate-700 rounded-lg font-bold text-white text-xs focus:outline-none focus:border-[#00C6A6]"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Tax / VAT (%)</label>
            <input
              type="number"
              min="0"
              value={safeNumVal(taxPercent)}
              onChange={(e) => onTaxPercentChange(Number(e.target.value))}
              className="w-full mt-1 p-2 bg-slate-900 border border-slate-700 rounded-lg font-medium text-slate-300 text-xs focus:outline-none focus:border-[#00C6A6]"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Service Fee ({currency})</label>
            <input
              type="number"
              min="0"
              value={safeNumVal(serviceFeeFixed)}
              onChange={(e) => onServiceFeeFixedChange(Number(e.target.value))}
              className="w-full mt-1 p-2 bg-slate-900 border border-slate-700 rounded-lg font-medium text-slate-300 text-xs focus:outline-none focus:border-[#00C6A6]"
            />
          </div>
        </div>

        {/* Hourly Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
              Base Hourly Nett Cost ({currency}) *
            </label>
            <input
              type="number"
              min="0"
              value={hourlyNet}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (onHourlyNetPriceChange) onHourlyNetPriceChange(val);
                if (onAdultNetPriceChange) onAdultNetPriceChange(val);
              }}
              className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg font-mono font-bold text-[#00E5C0] text-xs focus:outline-none focus:border-[#00C6A6]"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
              Minimum Commitment (Hours) *
            </label>
            <input
              type="number"
              min="1"
              max="12"
              value={effectiveMinHours}
              onChange={(e) => onMinHoursChange && onMinHoursChange(Number(e.target.value))}
              className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg font-bold text-white text-xs focus:outline-none focus:border-[#00C6A6]"
            />
          </div>
        </div>

        {/* Multi-hour Pricing Simulation Table */}
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/90 shadow-2xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 font-bold uppercase text-[9px] tracking-wider">
                <th className="p-3.5">Duration</th>
                <th className="p-3.5">Supplier Nett Cost</th>
                <th className="p-3.5 text-emerald-400">Buyer Final Selling Price</th>
                <th className="p-3.5 text-teal-300">B2B Agent Final Price</th>
                <th className="p-3.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {[1, 2, 4, 6, 8].map((hrs) => {
                const billable = Math.max(effectiveMinHours, hrs);
                const net = billable * hourlyNet;
                const buyerPrice = calcSellingPrice(net, buyerMarginPercent);
                const agentPrice = calcSellingPrice(net, b2bAgentMarginPercent);

                return (
                  <tr key={hrs} className="hover:bg-slate-900/60 transition-colors">
                    <td className="p-3.5 font-bold text-white">
                      {hrs} Hour{hrs > 1 ? 's' : ''} Service {hrs < effectiveMinHours && <span className="text-[10px] text-amber-400 italic">({effectiveMinHours}h minimum applies)</span>}
                    </td>
                    <td className="p-3.5 font-mono font-bold text-slate-300">
                      {formatCurrency(net, currency)}
                    </td>
                    <td className="p-3.5 font-mono font-black text-emerald-400">
                      {formatCurrency(buyerPrice, currency)}
                    </td>
                    <td className="p-3.5 font-mono font-bold text-teal-300">
                      {formatCurrency(agentPrice, currency)}
                    </td>
                    <td className="p-3.5 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-500/10 text-teal-400 border border-teal-500/20">
                        {hrs >= effectiveMinHours ? 'Standard' : 'Min Billed'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // 4. RENDER STANDARD PER-PERSON GROUP TOUR PRICING (Section 16)
  // --------------------------------------------------------------------------
  if (pricingMode === 'per_person') {
    const adultSelling = calcSellingPrice(adultNetPrice, buyerMarginPercent);
    const childSelling = calcSellingPrice(childNetPrice, buyerMarginPercent);
    const infantSelling = calcSellingPrice(infantNetPrice, buyerMarginPercent);

    return (
      <div className="space-y-6 bg-slate-900 text-slate-200 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center space-x-2 text-xs font-black text-[#00C6A6] uppercase tracking-wider mb-1">
              <Users className="w-4 h-4 shrink-0" />
              <span>PER-PERSON PASSENGER PRICING ENGINE</span>
              <span className="bg-blue-500/10 border border-blue-500/30 text-blue-300 font-extrabold px-2 py-0.5 rounded text-[10px] tracking-widest uppercase">
                GROUP TOUR
              </span>
            </div>
            <h2 className="text-base font-black text-white">
              Group Tour Passenger Classifications & Net Tariffs
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Configure baseline wholesale supplier costs and commercial markups across Adult, Child, and Infant classifications.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Native Currency</label>
              <select
                value={currency}
                onChange={(e) => onCurrencyChange(e.target.value as CurrencyCode)}
                className="p-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-[#00E5C0] focus:outline-none focus:border-[#00C6A6]"
              >
                <option value="JPY">JPY (¥)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="THB">THB (฿)</option>
                <option value="AED">AED (AED)</option>
                <option value="INR">INR (₹)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Commercial margins grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-xs">
          <div>
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Buyer Margin (%)</label>
            <input
              type="number"
              min="0"
              value={safeNumVal(buyerMarginPercent)}
              onChange={(e) => onBuyerMarginChange(Number(e.target.value))}
              className="w-full mt-1 p-2 bg-slate-900 border border-slate-700 rounded-lg font-bold text-white text-xs focus:outline-none focus:border-[#00C6A6]"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">B2B Agent Margin (%)</label>
            <input
              type="number"
              min="0"
              value={safeNumVal(b2bAgentMarginPercent)}
              onChange={(e) => onB2bAgentMarginChange(Number(e.target.value))}
              className="w-full mt-1 p-2 bg-slate-900 border border-slate-700 rounded-lg font-bold text-white text-xs focus:outline-none focus:border-[#00C6A6]"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Tax / VAT (%)</label>
            <input
              type="number"
              min="0"
              value={safeNumVal(taxPercent)}
              onChange={(e) => onTaxPercentChange(Number(e.target.value))}
              className="w-full mt-1 p-2 bg-slate-900 border border-slate-700 rounded-lg font-medium text-slate-300 text-xs focus:outline-none focus:border-[#00C6A6]"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Service Fee ({currency})</label>
            <input
              type="number"
              min="0"
              value={safeNumVal(serviceFeeFixed)}
              onChange={(e) => onServiceFeeFixedChange(Number(e.target.value))}
              className="w-full mt-1 p-2 bg-slate-900 border border-slate-700 rounded-lg font-medium text-slate-300 text-xs focus:outline-none focus:border-[#00C6A6]"
            />
          </div>
        </div>

        {/* Passenger classifications table */}
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/90 shadow-2xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 font-bold uppercase text-[9px] tracking-wider">
                <th className="p-3.5">Passenger Classification</th>
                <th className="p-3.5">Wholesale Nett Cost ({currency}) *</th>
                <th className="p-3.5 text-emerald-400">Buyer Final Selling Price</th>
                <th className="p-3.5 text-teal-300">B2B Agent Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              <tr className="hover:bg-slate-900/60 transition-colors">
                <td className="p-3.5 font-bold text-white">Adult (12+ Yrs)</td>
                <td className="p-3.5">
                  <input
                    type="number"
                    min="0"
                    value={safeNumVal(adultNetPrice)}
                    onChange={(e) => onAdultNetPriceChange(Number(e.target.value))}
                    className="p-1.5 bg-slate-900 border border-slate-700 rounded-lg font-mono font-bold text-[#00E5C0] w-32 text-xs focus:outline-none focus:border-[#00C6A6]"
                  />
                </td>
                <td className="p-3.5 font-mono font-black text-emerald-400">
                  {formatCurrency(adultSelling, currency)}
                </td>
                <td className="p-3.5 font-mono font-bold text-teal-300">
                  {formatCurrency(calcSellingPrice(adultNetPrice, b2bAgentMarginPercent), currency)}
                </td>
              </tr>

              <tr className="hover:bg-slate-900/60 transition-colors">
                <td className="p-3.5 font-bold text-white">Child (2–11 Yrs)</td>
                <td className="p-3.5">
                  <input
                    type="number"
                    min="0"
                    value={safeNumVal(childNetPrice)}
                    onChange={(e) => onChildNetPriceChange(Number(e.target.value))}
                    className="p-1.5 bg-slate-900 border border-slate-700 rounded-lg font-mono font-bold text-[#00E5C0] w-32 text-xs focus:outline-none focus:border-[#00C6A6]"
                  />
                </td>
                <td className="p-3.5 font-mono font-black text-emerald-400">
                  {formatCurrency(childSelling, currency)}
                </td>
                <td className="p-3.5 font-mono font-bold text-teal-300">
                  {formatCurrency(calcSellingPrice(childNetPrice, b2bAgentMarginPercent), currency)}
                </td>
              </tr>

              <tr className="hover:bg-slate-900/60 transition-colors">
                <td className="p-3.5 font-bold text-white">Infant (0–1 Yr)</td>
                <td className="p-3.5">
                  <input
                    type="number"
                    min="0"
                    value={safeNumVal(infantNetPrice)}
                    onChange={(e) => onInfantNetPriceChange(Number(e.target.value))}
                    className="p-1.5 bg-slate-900 border border-slate-700 rounded-lg font-mono font-bold text-[#00E5C0] w-32 text-xs focus:outline-none focus:border-[#00C6A6]"
                  />
                </td>
                <td className="p-3.5 font-mono font-black text-emerald-400">
                  {formatCurrency(infantSelling, currency)}
                </td>
                <td className="p-3.5 font-mono font-bold text-teal-300">
                  {formatCurrency(calcSellingPrice(infantNetPrice, b2bAgentMarginPercent), currency)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // 5. RENDER CAPACITY & TIERED PRICING MODULE (Sections 2–14, 20)
  // --------------------------------------------------------------------------
  return (
    <div className="space-y-6 bg-slate-900 text-slate-200 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
      
      {/* Decorative premium glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Main Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center space-x-2 text-xs font-black text-[#00C6A6] uppercase tracking-wider mb-1">
            <Calculator className="w-4 h-4 shrink-0" />
            <span>CAPACITY & TIERED PRICING ENGINE</span>
            <span className="bg-teal-500/10 border border-teal-500/30 text-[#00E5C0] font-extrabold px-2 py-0.5 rounded text-[10px] tracking-widest uppercase">
              {isTransfer ? 'TRANSFERS' : isYacht ? 'PRIVATE YACHT' : 'PRIVATE TOURS'}
            </span>
          </div>
          <h2 className="text-base font-black text-white">
            {isYacht ? 'Private Yacht Charter' : isTransfer ? 'Transfer Route' : 'Private Tour'} Capacity & Tiered Pricing Architecture
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Commercial capacity is product-specific and completely independent of vehicle physical seating. Each tier maps a passenger range to required vehicle count and applicable price.
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
          <h3 className="text-xs font-black uppercase text-white tracking-wider">Commercial Rules & Markups</h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5 text-xs">
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Native Currency *</label>
            <select
              value={currency}
              onChange={(e) => onCurrencyChange(e.target.value as CurrencyCode)}
              className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl font-black text-[#00E5C0] text-xs focus:outline-none focus:border-[#00C6A6]"
            >
              <option value="JPY">JPY (¥)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="THB">THB (฿)</option>
              <option value="AED">AED (AED)</option>
              <option value="AUD">AUD (A$)</option>
              <option value="INR">INR (₹)</option>
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
                value={safeNumVal(buyerMarginPercent)}
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
                value={safeNumVal(b2bAgentMarginPercent)}
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
                value={safeNumVal(taxPercent)}
                onChange={(e) => onTaxPercentChange(Number(e.target.value))}
                className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl font-bold text-slate-300 text-xs focus:outline-none focus:border-[#00C6A6]"
              />
              <span className="absolute right-2.5 top-2 text-slate-500 font-bold text-[10px]">%</span>
            </div>
          </div>

          <div className="space-y-1 col-span-2 sm:col-span-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Service Charge *</label>
            <input
              type="number"
              min="0"
              value={safeNumVal(serviceFeeFixed)}
              onChange={(e) => onServiceFeeFixedChange(Number(e.target.value))}
              className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl font-bold text-slate-300 text-xs focus:outline-none focus:border-[#00C6A6]"
            />
          </div>
        </div>
      </div>

      {/* Transfer Route Context */}
      {isTransfer && (
        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">Transfer Origin & Destination</span>
            <span className="text-white font-bold block mt-0.5">
              {fromHubName || 'From Hub'} ➔ {toHubName || 'To Hub'}
            </span>
          </div>
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">Transfer Capacity Rule Separation</span>
            <span className="text-teal-400 font-bold block mt-0.5">
              Transfer rules are strictly separate from Private Tour rules.
            </span>
          </div>
        </div>
      )}

      {/* 02 DYNAMIC CAPACITY & TIERED PRICING MODULE */}
      <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-lg bg-teal-500/10 border border-teal-500/20 text-[#00C6A6] flex items-center justify-center font-black text-xs">
              02
            </div>
            <h3 className="text-xs font-black uppercase text-white tracking-wider">
              Product-Specific Capacity Pricing Tiers
            </h3>
          </div>

          <button
            type="button"
            onClick={handleAddTier}
            className="text-xs font-black text-[#00E5C0] hover:text-[#00C6A6] transition-colors flex items-center gap-1 cursor-pointer bg-teal-500/10 border border-teal-500/20 px-3 py-1.5 rounded-xl self-start sm:self-center"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Capacity Tier</span>
          </button>
        </div>

        {/* Validation Errors */}
        {tierValidationErrors.length > 0 && (
          <div className="p-3.5 bg-red-950/40 border border-red-500/30 rounded-xl text-red-200 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-red-400">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Configuration Validation Notices ({tierValidationErrors.length})</span>
            </div>
            <ul className="list-disc pl-4 space-y-0.5 font-medium text-red-300">
              {tierValidationErrors.map((err, idx) => (
                <li key={idx}>{err.message}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Tiers Editor Table */}
        <div className="border border-slate-800 rounded-xl overflow-x-auto bg-slate-950/90 shadow-2xs">
          <table className="w-full text-left text-xs border-collapse min-w-[1050px]">
            <thead>
              <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 font-bold uppercase text-[9px] tracking-wider">
                <th className="p-3 w-48">{isYacht ? 'Yacht Asset' : isFerry ? 'Ferry / Vessel' : 'Fleet Vehicle'}</th>
                <th className="p-3 w-32">Pax Range</th>
                <th className="p-3 w-20 text-center">Vehicles</th>
                <th className="p-3 w-20">Currency</th>
                <th className="p-3 w-28 text-right">Supplier Nett *</th>
                <th className="p-3 w-32 text-center">Margin</th>
                <th className="p-3 w-28 text-center">Tax</th>
                <th className="p-3 w-28 text-center">Service Fee</th>
                <th className="p-3 w-36 text-right">Price</th>
                <th className="p-3 w-20 text-center">Status</th>
                <th className="p-3 w-20 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {tieredPricing.map((tier, idx) => {
                const tierNett = tier.supplierNett !== undefined ? tier.supplierNett : (tier.nettPrice !== undefined ? tier.nettPrice : tier.netCostPerPax);
                const calculatedTierFinal = calcTierFinalPrice(tier);
                const buyerFinal = tier.finalPrice !== undefined 
                  ? tier.finalPrice 
                  : (calculatedTierFinal !== undefined ? calculatedTierFinal : (tierNett !== undefined ? calcSellingPrice(tierNett, buyerMarginPercent) : undefined));
                const agentFinal = tierNett !== undefined 
                  ? calcSellingPrice(tierNett, b2bAgentMarginPercent) 
                  : undefined;
                const vehicleCountVal = tier.vehicleCount !== undefined && tier.vehicleCount > 0 ? tier.vehicleCount : 1;

                const activeAssetList = isYacht ? availableYachts : isFerry ? availableFerries : availableVehicles;

                return (
                  <tr key={tier.id || idx} className="hover:bg-slate-900/60 transition-colors">
                    {/* Fleet / Vehicle / Yacht / Vessel selection directly inside Step 3 */}
                    <td className="p-2.5">
                      <select
                        value={tier.fleetId || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          const foundAsset = activeAssetList.find(a => a.id === val || a.name === val);
                          handleUpdateTier(idx, {
                            fleetId: foundAsset?.id || val,
                            fleetName: foundAsset?.name || val
                          });
                        }}
                        className="p-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-medium text-xs focus:outline-none focus:border-[#00C6A6] w-full"
                      >
                        <option value="">
                          {tier.fleetName ? tier.fleetName : `-- Select ${isYacht ? 'Yacht' : isFerry ? 'Ferry / Vessel' : 'Vehicle'} --`}
                        </option>
                        {activeAssetList.map(a => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Pax Range: Min Pax & Max Pax */}
                    <td className="p-2.5">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="1"
                          value={tier.minPax !== undefined ? tier.minPax : (tier.minPassengers !== undefined ? tier.minPassengers : '')}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const num = raw === '' ? undefined : parseInt(raw, 10);
                            handleUpdateTier(idx, { minPax: num, minPassengers: num });
                          }}
                          placeholder="Min"
                          className="p-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white w-14 text-center text-xs font-semibold focus:outline-none focus:border-[#00C6A6]"
                        />
                        <span className="text-slate-500 font-bold text-xs">–</span>
                        <input
                          type="number"
                          min="1"
                          value={tier.maxPax !== undefined ? tier.maxPax : (tier.maxPassengers !== undefined ? tier.maxPassengers : '')}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const num = raw === '' ? undefined : parseInt(raw, 10);
                            handleUpdateTier(idx, { maxPax: num, maxPassengers: num });
                          }}
                          placeholder="Max"
                          className="p-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white w-14 text-center text-xs font-semibold focus:outline-none focus:border-[#00C6A6]"
                        />
                      </div>
                    </td>

                    {/* Vehicles Required */}
                    <td className="p-2.5 text-center">
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={vehicleCountVal}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const num = raw === '' ? 1 : Math.max(1, parseInt(raw, 10) || 1);
                          handleUpdateTier(idx, { vehicleCount: num });
                        }}
                        className="p-1.5 bg-slate-900 border border-slate-700 rounded-lg text-[#00E5C0] w-14 text-center text-xs font-black focus:outline-none focus:border-[#00C6A6]"
                      />
                    </td>

                    {/* Native Currency */}
                    <td className="p-2.5">
                      <select
                        value={tier.currency || tier.nativeCurrency || currency || 'USD'}
                        onChange={(e) => {
                          const c = e.target.value as CurrencyCode;
                          handleUpdateTier(idx, { currency: c, nativeCurrency: c });
                        }}
                        className="p-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs font-bold focus:outline-none focus:border-[#00C6A6] w-full"
                      >
                        <option value="JPY">JPY</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="GBP">GBP</option>
                        <option value="THB">THB</option>
                        <option value="AED">AED</option>
                        <option value="AUD">AUD</option>
                        <option value="INR">INR</option>
                        <option value="SGD">SGD</option>
                        <option value="CAD">CAD</option>
                        <option value="CHF">CHF</option>
                      </select>
                    </td>

                    {/* Supplier Nett Cost (Authoritative Controlled Admin Input) */}
                    <td className="p-2.5 text-right">
                      <SupplierNettInput
                        id={`supplier-nett-${tier.id || idx}`}
                        value={tier.supplierNett !== undefined ? tier.supplierNett : (tier.nettPrice !== undefined && tier.nettPrice > 0 ? tier.nettPrice : (tier.netCostPerPax !== undefined && (tier.netCostPerPax as any) > 0 ? tier.netCostPerPax : undefined))}
                        placeholder="Nett Cost"
                        currency={tier.currency || tier.nativeCurrency || currency}
                        onChange={(num) => {
                          handleUpdateTier(idx, {
                            supplierNett: num,
                            nettPrice: num,
                            netCostPerPax: num as any
                          });
                        }}
                      />
                    </td>

                    {/* Margin: Type & Value */}
                    <td className="p-2.5">
                      <div className="flex items-center gap-1 justify-center">
                        <select
                          value={tier.marginType || 'PERCENTAGE'}
                          onChange={(e) => handleUpdateTier(idx, { marginType: e.target.value as 'PERCENTAGE' | 'FIXED' })}
                          className="p-1 bg-slate-900 border border-slate-700 rounded text-[10px] text-slate-300 font-bold"
                        >
                          <option value="PERCENTAGE">%</option>
                          <option value="FIXED">Fix</option>
                        </select>
                        <DecimalInput
                          value={tier.marginValue}
                          placeholder={`${buyerMarginPercent || 20}`}
                          onChange={(num) => handleUpdateTier(idx, { marginValue: num })}
                        />
                      </div>
                    </td>

                    {/* Tax: Type & Value */}
                    <td className="p-2.5">
                      <div className="flex items-center gap-1 justify-center">
                        <select
                          value={tier.taxType || 'PERCENTAGE'}
                          onChange={(e) => handleUpdateTier(idx, { taxType: e.target.value as any })}
                          className="p-1 bg-slate-900 border border-slate-700 rounded text-[10px] text-slate-300 font-bold"
                        >
                          <option value="PERCENTAGE">%</option>
                          <option value="FIXED">Fix</option>
                          <option value="NOT_APPLICABLE">N/A</option>
                        </select>
                        {tier.taxType !== 'NOT_APPLICABLE' && (
                          <DecimalInput
                            value={tier.taxValue}
                            placeholder={`${taxPercent || 10}`}
                            className="p-1.5 bg-slate-900 border border-slate-700 rounded-lg font-mono text-white text-xs w-12 text-right focus:outline-none focus:border-[#00C6A6]"
                            onChange={(num) => handleUpdateTier(idx, { taxValue: num })}
                          />
                        )}
                      </div>
                    </td>

                    {/* Service Fee: Type & Value */}
                    <td className="p-2.5">
                      <div className="flex items-center gap-1 justify-center">
                        <select
                          value={tier.serviceChargeType || 'FIXED'}
                          onChange={(e) => handleUpdateTier(idx, { serviceChargeType: e.target.value as any })}
                          className="p-1 bg-slate-900 border border-slate-700 rounded text-[10px] text-slate-300 font-bold"
                        >
                          <option value="FIXED">Fix</option>
                          <option value="PERCENTAGE">%</option>
                          <option value="NOT_APPLICABLE">N/A</option>
                        </select>
                        {tier.serviceChargeType !== 'NOT_APPLICABLE' && (
                          <DecimalInput
                            value={tier.serviceChargeValue}
                            placeholder={`${serviceFeeFixed || 0}`}
                            className="p-1.5 bg-slate-900 border border-slate-700 rounded-lg font-mono text-white text-xs w-12 text-right focus:outline-none focus:border-[#00C6A6]"
                            onChange={(num) => handleUpdateTier(idx, { serviceChargeValue: num })}
                          />
                        )}
                      </div>
                    </td>

                    {/* Calculated Final Price (B2B Price) */}
                    <td className="p-2.5 text-right font-mono">
                      <span className="font-black text-[#00E5C0] text-xs block">
                        {calculatedTierFinal !== undefined ? formatCurrency(calculatedTierFinal, tier.currency || currency) : '—'}
                      </span>
                    </td>

                    {/* Status Toggle */}
                    <td className="p-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleUpdateTier(idx, { status: tier.status === 'INACTIVE' ? 'ACTIVE' : 'INACTIVE' })}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                          tier.status === 'INACTIVE'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {tier.status || 'ACTIVE'}
                      </button>
                    </td>

                    {/* Actions: Duplicate & Delete */}
                    <td className="p-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleDuplicateTier(idx)}
                          className="text-slate-400 hover:text-white transition-colors p-1.5 cursor-pointer bg-slate-800 hover:bg-slate-700 rounded-lg"
                          title="Duplicate Tier"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveTier(idx)}
                          className="text-slate-400 hover:text-red-400 transition-colors p-1.5 cursor-pointer bg-red-500/10 hover:bg-red-500/20 rounded-lg"
                          title="Delete Tier"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {tieredPricing.length === 0 && (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-slate-500">
                    <Layers className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                    <span className="font-bold text-xs block">No Capacity Tiers Configured</span>
                    <span className="text-[11px] mt-1 block">Click "Add Capacity Tier" to configure product-specific passenger ranges, vehicles, and rates.</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 04 LIVE CAPACITY SIMULATOR (Section 9 & 10) */}
      {simulation && (
        <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded-lg bg-teal-500/10 border border-teal-500/20 text-[#00C6A6] flex items-center justify-center font-black text-xs">
                04
              </div>
              <h3 className="text-xs font-black uppercase text-white tracking-wider">Live Pricing & Vehicle Scale Simulator</h3>
            </div>
            <span className="text-[10px] text-slate-400">
              Evaluates rules for quotes and agent bookings.
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-center">
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                Test Passenger Headcount
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={testPassengerCount}
                  onChange={(e) => setTestPassengerCount(Math.max(1, Number(e.target.value)))}
                  className="w-24 p-2 bg-slate-900 border border-slate-700 rounded-xl font-bold text-white text-xs focus:outline-none focus:border-[#00C6A6]"
                />
                <span className="text-xs text-slate-400">Pax</span>
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">Applicable Tier Rule</span>
              <span className="text-[#00E5C0] font-black text-xs block mt-0.5">
                {simulation.tierDescription}
              </span>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">Vehicles Required</span>
              <span className="text-white font-black text-xs block mt-0.5">
                {simulation.vehiclesRequired} {simulation.vehiclesRequired > 1 ? 'Vehicles' : 'Vehicle'}
              </span>
            </div>

            <div className="p-3 bg-emerald-950/20 rounded-xl border border-emerald-500/30">
              <span className="text-[10px] text-emerald-400 block uppercase font-black tracking-wider">Delivered Final Price</span>
              <span className="text-emerald-300 font-black text-sm block mt-0.5">
                {formatCurrency(simulation.buyerSelling, currency)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
