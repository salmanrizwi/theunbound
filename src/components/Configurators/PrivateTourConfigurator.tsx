import React, { useState, useMemo } from 'react';
import { Product, QuoteItem, CurrencyCode, VehicleMaster } from '../../types';
import { useQuotation } from '../../context/QuotationContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, calculateProductPrice, calculateB2BAgentPrice } from '../../services/pricingEngine';
import { generateConfigurationIdentity, getActiveUpsellsForProduct, createUpsellSnapshot } from '../../services/configuratorRegistry';
import { operationalMasterInventory } from '../../services/operationalMasterInventoryService';
import { operationalAssetEligibility } from '../../services/operationalAssetEligibilityService';
import { canUserViewInternalCostBreakdown } from '../../services/permissionEngine';
import { getInventoryDisplayName } from '../../utils/inventoryDisplayHelpers';
import { 
  X, 
  Crown, 
  Calendar, 
  Clock, 
  Users, 
  MapPin, 
  Car, 
  Sparkles, 
  ShieldCheck, 
  Check, 
  Plus, 
  Minus, 
  AlertTriangle,
  Info,
  Briefcase,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export interface PrivateTourConfiguratorProps {
  isOpen: boolean;
  itemOrProduct: Product | QuoteItem | any;
  portalOrigin?: 'BUYER' | 'B2B_AGENT' | 'B2B_QUOTE_BUILDER' | 'ADMIN_CMS' | 'CART';
  existingQuoteItemId?: string;
  initialTravelDate?: string;
  initialAdults?: number;
  initialChildren?: number;
  initialInfants?: number;
  initialServiceTime?: string;
  initialNotes?: string;
  onClose: () => void;
  onSuccess?: (configuredItem: any, details?: any) => void;
}

/**
 * ============================================================================
 * THEUNBOUND — PRIVATE TOUR CONFIGURATOR (Section 7)
 * Database-Driven Private Chauffeured Tour Configuration Engine
 * With Reusable Shared Vehicle Master Selection
 * ============================================================================
 * 
 * Rules:
 * - Product Management defines the Tour, Vehicle and base commercial pricing.
 * - Reuses existing Transfer Vehicle Master Inventory and Eligibility Rules.
 * - Layer 1: Read-only master information (Tour specifications, inclusions).
 * - Layer 2: Vehicle Selection & Capacity Validation (Master Fleet Inventory).
 * - Layer 3: Transaction details (Date, Start Time, Passenger Composition, Pickup).
 * - Layer 4: Genuine selectable options (Addons & Upsells).
 * - Price is calculated strictly via the central Pricing Engine.
 * - External B2B Agents never receive internal nett cost or margin leakage.
 */
export const PrivateTourConfigurator: React.FC<PrivateTourConfiguratorProps> = ({
  isOpen,
  itemOrProduct,
  portalOrigin = 'B2B_AGENT',
  existingQuoteItemId,
  initialTravelDate,
  initialAdults,
  initialChildren,
  initialInfants,
  initialServiceTime,
  initialNotes,
  onClose,
  onSuccess
}) => {
  const { currency, addProductToQuote, updateQuoteItem } = useQuotation();
  const { user } = useAuth();

  const product: Product = itemOrProduct?.product || itemOrProduct;
  const isEditing = Boolean(existingQuoteItemId);

  const existingConfig = (itemOrProduct as any)?.configuration_payload ||
    (itemOrProduct as any)?.metadata?.configuration_payload || {};

  // Form State: Travel & Transaction Context
  const [travelDate, setTravelDate] = useState<string>(
    existingConfig.travelDate || initialTravelDate || (itemOrProduct as QuoteItem)?.travelDate || new Date().toISOString().split('T')[0]
  );
  const [serviceTime, setServiceTime] = useState<string>(
    existingConfig.serviceTime || initialServiceTime || (itemOrProduct as QuoteItem)?.serviceTime || '09:00 AM'
  );
  const [adults, setAdults] = useState<number>(
    existingConfig.adults ?? initialAdults ?? (itemOrProduct as QuoteItem)?.pax?.adults ?? 2
  );
  const [children, setChildren] = useState<number>(
    existingConfig.children ?? initialChildren ?? (itemOrProduct as QuoteItem)?.pax?.children ?? 0
  );
  const [infants, setInfants] = useState<number>(
    existingConfig.infants ?? initialInfants ?? (itemOrProduct as QuoteItem)?.pax?.infants ?? 0
  );

  const [pickupLocation, setPickupLocation] = useState<string>(
    existingConfig.pickupLocation || ''
  );
  const [specialRequirements, setSpecialRequirements] = useState<string>(
    existingConfig.specialRequirements || initialNotes || (itemOrProduct as QuoteItem)?.notes || ''
  );

  const [selectedAddons, setSelectedAddons] = useState<string[]>(
    existingConfig.selectedAddons || (itemOrProduct as QuoteItem)?.selectedAddonIds || []
  );

  const totalPax = adults + children;

  // Step 3 pricing tiers if product defines tiered vehicle pricing
  const step3Tiers = useMemo(() => {
    return (product?.tieredPricing || []).filter(t => t.status !== 'INACTIVE');
  }, [product]);

  // Load eligible active vehicles dynamically from Firestore-backed Master Inventory
  const availableVehicles = useMemo(() => {
    // 1. Get eligible active vehicles from central Master Inventory for this product / destination
    const res = operationalAssetEligibility.getEligibleAssets({
      product,
      productType: 'Private Tours',
      destinationId: product?.destinationId,
      hubId: product?.hubId
    });
    const eligibleMasterVehicles = res.vehicles;

    // 2. Identify referenced vehicle IDs in product's Step 3 tiers or product config
    const tierVehicleIds = new Set<string>();
    for (const t of step3Tiers) {
      if (t.fleetId) tierVehicleIds.add(t.fleetId);
      if (t.vehicleId) tierVehicleIds.add(t.vehicleId);
    }
    if (product?.vehicleId) tierVehicleIds.add(product.vehicleId);
    if (product?.vehicleConfig?.vehicleId) tierVehicleIds.add(product.vehicleConfig.vehicleId);

    let list = eligibleMasterVehicles.map(v => ({
      id: v.id,
      name: v.name,
      model: v.model,
      type: v.classification || v.type,
      maxCapacity: v.seatingCapacity,
      luggageCapacity: v.luggageCapacity || 4,
      manufacturer: v.manufacturer,
      supplierId: v.supplierId,
      supplierName: v.supplierName,
      isReferencedInProduct: tierVehicleIds.has(v.id),
      status: v.status,
      masterRecord: v
    }));

    if (list.length === 0) {
      // Fallback to all active vehicles in operational inventory
      list = operationalMasterInventory.getActiveVehicles().map(v => ({
        id: v.id,
        name: v.name,
        model: v.model,
        type: v.classification || v.type,
        maxCapacity: v.seatingCapacity,
        luggageCapacity: v.luggageCapacity || 4,
        manufacturer: v.manufacturer,
        supplierId: v.supplierId,
        supplierName: v.supplierName,
        isReferencedInProduct: tierVehicleIds.has(v.id),
        status: v.status,
        masterRecord: v
      }));
    }

    // Sort: referenced in product first, then by ascending capacity
    list.sort((a, b) => {
      if (a.isReferencedInProduct && !b.isReferencedInProduct) return -1;
      if (!a.isReferencedInProduct && b.isReferencedInProduct) return 1;
      return a.maxCapacity - b.maxCapacity;
    });

    return list;
  }, [step3Tiers, product]);

  // State for selected vehicle (restores from draft or finds best fit)
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(() => {
    // 1. Existing configuration when editing or reopening a saved quote
    if (existingConfig.vehicleId) return existingConfig.vehicleId;
    if (existingConfig.assetId) return existingConfig.assetId;
    if ((itemOrProduct as QuoteItem)?.vehicleId) return (itemOrProduct as QuoteItem).vehicleId!;
    // 2. Product configured vehicle
    if (product?.vehicleId) return product.vehicleId;
    if (product?.vehicleConfig?.vehicleId) return product.vehicleConfig.vehicleId;
    // 3. Match by tier if tier exists for initial pax
    const initPax = (existingConfig.adults ?? initialAdults ?? (itemOrProduct as QuoteItem)?.pax?.adults ?? 2) +
                    (existingConfig.children ?? initialChildren ?? (itemOrProduct as QuoteItem)?.pax?.children ?? 0);
    const tierMatch = step3Tiers.find(t => initPax >= t.minPax && initPax <= t.maxPax && (t.fleetId || t.vehicleId));
    if (tierMatch) return tierMatch.fleetId || tierMatch.vehicleId!;
    // 4. Best-fit vehicle from available vehicles
    const fit = availableVehicles.find(v => v.maxCapacity >= initPax);
    return fit?.id || availableVehicles[0]?.id || '';
  });

  // Check if restored vehicle is inactive or archived
  const isSelectedVehicleInactive = useMemo(() => {
    if (!selectedVehicleId) return false;
    const v = operationalMasterInventory.getVehicleById(selectedVehicleId);
    return v ? v.status !== 'ACTIVE' : false;
  }, [selectedVehicleId]);

  const selectedVehicle = useMemo(() => {
    return availableVehicles.find(v => v.id === selectedVehicleId) || availableVehicles[0];
  }, [availableVehicles, selectedVehicleId]);

  const vehicleName = selectedVehicle?.name || product?.vehicleNameSnapshot || product?.vehicleConfig?.vehicleModel || 'Executive Vehicle';
  const vehicleType = selectedVehicle?.type || product?.vehicleTypeSnapshot || product?.vehicleConfig?.vehicleType || 'Executive MPV';
  const masterCapacity = Number(selectedVehicle?.maxCapacity) || Number(product?.capacitySnapshot) || Number(product?.vehicleConfig?.maxSeats) || Number(product?.maxPax) || 7;
  const luggageCapacity = Number(selectedVehicle?.luggageCapacity) || Number(product?.vehicleConfig?.maxLuggage) || 4;

  // Passenger capacity validation against authoritative vehicle master
  const isCapacityExceeded = totalPax > masterCapacity;

  // Check if any vehicle in fleet can accommodate the group
  const maxFleetCapacity = useMemo(() => {
    return availableVehicles.reduce((max, v) => Math.max(max, v.maxCapacity), 0);
  }, [availableVehicles]);
  const isExceedingAllFleetCapacity = totalPax > maxFleetCapacity && maxFleetCapacity > 0;

  // Suggest higher capacity vehicles if current is undersized
  const higherCapacityVehicles = useMemo(() => {
    if (!isCapacityExceeded) return [];
    return availableVehicles.filter(v => v.maxCapacity >= totalPax && v.id !== selectedVehicleId);
  }, [isCapacityExceeded, availableVehicles, totalPax, selectedVehicleId]);

  // Match exact step 3 pricing tier if product defines tiered pricing
  const matchedTier = useMemo(() => {
    return step3Tiers.find(t => {
      const vId = t.fleetId || t.vehicleId;
      const idMatches = !vId || vId === selectedVehicleId || (selectedVehicle && vId === selectedVehicle.id);
      return idMatches && totalPax >= t.minPax && totalPax <= t.maxPax;
    }) || step3Tiers.find(t => totalPax >= t.minPax && totalPax <= t.maxPax);
  }, [step3Tiers, selectedVehicleId, selectedVehicle, totalPax]);

  // Authoritative Product Upsells (Layer 4)
  const availableUpsells = useMemo(() => {
    return getActiveUpsellsForProduct(product);
  }, [product]);

  const toggleAddon = (id: string) => {
    setSelectedAddons(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Centralized Authoritative Pricing Calculation
  const pricing = useMemo(() => {
    if (!product) return { grossSellingPrice: 0, finalPrice: 0, baseSelling: 0, addonsCost: 0, currency, netCost: 0 };

    let baseSelling = 0;
    let netCost = 0;
    const currencyToUse = product.currency || currency || 'USD';

    if (step3Tiers.length > 0 && matchedTier) {
      const tierNett = matchedTier.supplierNett !== undefined 
        ? matchedTier.supplierNett 
        : (matchedTier.nettPrice !== undefined 
          ? matchedTier.nettPrice 
          : (matchedTier.netCostPerPax || 0));
      const marginPct = matchedTier.marginValue !== undefined 
        ? matchedTier.marginValue 
        : (product.b2bAgentMarkupPercent ?? product.defaultMarkupPercent ?? 20);
      const taxPct = matchedTier.taxValue !== undefined 
        ? matchedTier.taxValue 
        : (product.taxPercent ?? 10);
      const feePct = matchedTier.serviceChargeValue !== undefined 
        ? matchedTier.serviceChargeValue 
        : (product.serviceFeeFixed ?? 0);

      const b2bCalc = calculateB2BAgentPrice({
        nettCost: tierNett,
        marginPercent: marginPct,
        taxPercent: taxPct,
        serviceFeePercent: feePct,
        currency: currencyToUse
      });
      baseSelling = b2bCalc.price;
      netCost = tierNett;
    } else {
      const calc = calculateProductPrice(product, {
        productId: product.id,
        adults,
        children,
        infants,
        travelDate,
        targetCurrency: currency,
        user,
        selectedAddonIds: selectedAddons,
        selectedUpsellIds: selectedAddons,
        vehicleId: selectedVehicleId
      } as any);

      baseSelling = calc.finalTotalSellingPrice;
      netCost = calc.totalNetCost || 0;
    }

    const addonsCost = selectedAddons.reduce((sum, id) => {
      const u = availableUpsells.find(x => x.id === id);
      if (!u) return sum;
      return sum + (u.priceType === 'PER_BOOKING' ? u.price : u.price * totalPax);
    }, 0);

    const grossSellingPrice = baseSelling + (matchedTier ? addonsCost : 0);

    return {
      grossSellingPrice,
      finalPrice: grossSellingPrice,
      baseSelling,
      addonsCost,
      netCost,
      currency: currencyToUse,
      matchedTier
    };
  }, [product, adults, children, infants, travelDate, selectedAddons, selectedVehicleId, step3Tiers, matchedTier, currency, user, totalPax, availableUpsells]);

  const canViewInternalCosts = canUserViewInternalCostBreakdown(user);

  if (!isOpen || !product) return null;

  const handleSave = () => {
    if (isCapacityExceeded || isSelectedVehicleInactive) return;

    const configIdentity = generateConfigurationIdentity(
      'Private Tours',
      product.id,
      existingConfig.configuration_id
    );

    const selectedUpsellSnapshots = selectedAddons.map(id => {
      const found = availableUpsells.find(u => u.id === id);
      if (!found) return null;
      return createUpsellSnapshot(found, adults + children);
    }).filter(Boolean);

    const configurationPayload = {
      ...configIdentity,
      assetType: 'VEHICLE',
      assetId: selectedVehicle?.id || product.vehicleId || null,
      assetName: vehicleName,
      assetModel: selectedVehicle?.model || vehicleName,
      assetClassification: vehicleType,
      supplierId: selectedVehicle?.supplierId || product.supplierId,
      supplierName: selectedVehicle?.supplierName || product.supplierName,
      vehicleId: selectedVehicle?.id || product.vehicleId,
      vehicleName,
      vehicleType,
      masterCapacity,
      luggageCapacity,
      travelDate,
      serviceTime,
      duration: product.duration || 'Full Day (8 Hours)',
      adults,
      children,
      infants,
      pickupLocation: pickupLocation || 'Guest Hotel Lobby',
      selectedAddons,
      selectedUpsellSnapshots,
      specialRequirements,
      pricingSummary: pricing
    };

    const notesSummary = `${product.name} (${vehicleName} • ${masterCapacity} Seats) ${pickupLocation ? `| Pickup: ${pickupLocation}` : ''}. ${specialRequirements}`.trim();

    if (isEditing && existingQuoteItemId) {
      updateQuoteItem(existingQuoteItemId, product, {
        adults,
        children,
        infants,
        travelDate,
        serviceTime,
        notes: notesSummary,
        selectedAddonIds: selectedAddons,
        selectedUpsellIds: selectedAddons,
        selectedUpsellSnapshots: selectedUpsellSnapshots as any,
        configuration_snapshot: configurationPayload,
        vehicleId: selectedVehicle?.id,
        vehicleNameSnapshot: vehicleName,
        vehicleTypeSnapshot: vehicleType,
        vehicleCapacitySnapshot: masterCapacity,
        metadata: {
          configuration_payload: configurationPayload,
          configurator_type: 'PRIVATE_TOUR_CONFIGURATOR',
          vehicleId: selectedVehicle?.id,
          vehicleName
        }
      });
    } else {
      addProductToQuote(product, {
        adults,
        children,
        infants,
        travelDate,
        serviceTime,
        notes: notesSummary,
        selectedAddonIds: selectedAddons,
        selectedUpsellIds: selectedAddons,
        selectedUpsellSnapshots: selectedUpsellSnapshots as any,
        openDrawer: portalOrigin !== 'B2B_QUOTE_BUILDER' && portalOrigin !== 'ADMIN_CMS',
        configuration_id: configIdentity.configuration_id,
        configuration_snapshot: configurationPayload,
        pricing_snapshot: pricing,
        category: 'Private Tours',
        service_type: 'PRIVATE_TOUR_CONFIGURATOR',
        vehicleId: selectedVehicle?.id,
        vehicleNameSnapshot: vehicleName,
        vehicleTypeSnapshot: vehicleType,
        vehicleCapacitySnapshot: masterCapacity,
        metadata: {
          configuration_payload: configurationPayload,
          configurator_type: 'PRIVATE_TOUR_CONFIGURATOR',
          vehicleId: selectedVehicle?.id,
          vehicleName
        }
      });
    }

    if (onSuccess) {
      onSuccess({ product, configurationPayload, pricing });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] my-auto">
        
        {/* MODAL HEADER */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Crown className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-400 text-slate-950">
                  Private Tour Configurator
                </span>
                <span className="text-xs text-slate-400 font-medium truncate">
                  {product.destinationName || product.country || 'Japan'} • {product.city || 'Central'}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white truncate mt-0.5">
                {product.name}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          
          {/* LAYER 1: PRODUCT INFORMATION (READ-ONLY) */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                1. Product & Operational Specifications
              </span>
              <span className="text-[10px] text-slate-400 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                Authoritative Master Data
              </span>
            </div>

            {/* Tour Overview Snippet */}
            {product.shortDescription && (
              <p className="text-xs text-slate-600 leading-relaxed bg-white p-3 rounded-xl border border-slate-200">
                {product.shortDescription}
              </p>
            )}

            {/* Inclusions Tag Cloud */}
            {product.inclusions && product.inclusions.length > 0 && (
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1.5">Included in Service</span>
                <div className="flex flex-wrap gap-1.5">
                  {product.inclusions.map((inc, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-[11px] font-medium bg-white text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">
                      <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                      <span>{inc}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* LAYER 2: VEHICLE SELECTION (REUSES TRANSFER MASTER INVENTORY) */}
          {/* ========================================================================= */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Car className="w-3.5 h-3.5 text-amber-500" />
                <span>2. Vehicle Selection</span>
              </span>
              <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 font-bold uppercase">
                Master Fleet Inventory
              </span>
            </div>

            <p className="text-xs text-slate-600">
              Select an authorized fleet vehicle for this Private Tour. Supported passenger capacities and luggage allowances are validated against the authoritative vehicle master inventory.
            </p>

            {/* Vehicle Selection Dropdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Select Fleet Vehicle *
                </label>
                <select
                  value={selectedVehicleId}
                  onChange={e => setSelectedVehicleId(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  {availableVehicles.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.maxCapacity} Seats) {v.isReferencedInProduct ? '• Product Preferred' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Capacity & Luggage Badges */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className={`p-2.5 rounded-xl border ${
                  isCapacityExceeded 
                    ? 'bg-rose-50 border-rose-300 text-rose-800' 
                    : 'bg-white border-slate-200 text-slate-800'
                }`}>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Max Passenger Seats</span>
                  <span className={`font-bold block mt-0.5 ${isCapacityExceeded ? 'text-rose-600' : 'text-emerald-700'}`}>
                    {masterCapacity} Seats
                  </span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-slate-800">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Luggage Allowance</span>
                  <span className="text-slate-700 font-semibold block mt-0.5 flex items-center gap-1">
                    <Briefcase className="w-3 h-3 text-slate-400" />
                    <span>{luggageCapacity} Large Bags</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Detailed Selected Vehicle Information Card */}
            {selectedVehicle && (
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-slate-900">{selectedVehicle.name}</span>
                      <span className="text-[10px] px-2 py-0.2 rounded-full font-bold bg-slate-100 text-slate-600 border border-slate-200">
                        {selectedVehicle.type}
                      </span>
                    </div>
                    {selectedVehicle.model && selectedVehicle.model !== selectedVehicle.name && (
                      <span className="text-[11px] text-slate-500 block">{selectedVehicle.model}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Active Master Fleet</span>
                    </span>
                    {matchedTier && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        Tiered Rate Applied
                      </span>
                    )}
                  </div>
                </div>

                {/* Role-Based Vehicle Pricing Visibility */}
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 font-semibold">Pricing Model:</span>
                    <span className="font-medium text-slate-700">
                      {matchedTier 
                        ? `Configured Capacity Tier (${matchedTier.minPax}–${matchedTier.maxPax} Pax)` 
                        : 'Private Tour Chauffeured Package Included'}
                    </span>
                  </div>

                  {canViewInternalCosts && pricing.netCost > 0 && (
                    <div className="text-[11px] font-mono text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                      Internal Cost Snapshot: <strong className="text-slate-700">{formatCurrency(pricing.netCost, pricing.currency)}</strong>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Alternate Quick-Select Vehicle Chips */}
            {availableVehicles.length > 1 && (
              <div className="pt-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1.5">
                  Available Fleet Options ({availableVehicles.length} Registered)
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {availableVehicles.map(v => {
                    const isSelected = v.id === selectedVehicleId;
                    const accommodates = v.maxCapacity >= totalPax;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setSelectedVehicleId(v.id)}
                        className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium flex items-center space-x-1.5 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-400 border-amber-500 text-slate-950 font-bold shadow-xs'
                            : accommodates
                            ? 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                            : 'bg-slate-100 border-slate-200 text-slate-400 hover:border-rose-200'
                        }`}
                      >
                        <span>{v.name.split('(')[0].trim()}</span>
                        <span className={`text-[10px] px-1 py-0.2 rounded ${
                          isSelected 
                            ? 'bg-slate-900 text-white' 
                            : accommodates 
                            ? 'bg-emerald-50 text-emerald-700 font-semibold' 
                            : 'bg-rose-50 text-rose-600'
                        }`}>
                          {v.maxCapacity} Pax
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Inactive Vehicle Warning Banner */}
            {isSelectedVehicleInactive && (
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-start space-x-2.5 text-xs text-amber-900 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Vehicle Inactive in Master Inventory</span>
                  <span>
                    The selected vehicle ({vehicleName}) is currently marked as inactive or under maintenance. Please select an active fleet vehicle before continuing.
                  </span>
                </div>
              </div>
            )}

            {/* Real-Time Capacity Validation Banners */}
            {isCapacityExceeded ? (
              <div className="bg-rose-50 border border-rose-300 rounded-xl p-3 flex items-start space-x-2.5 text-xs text-rose-900 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold block">Vehicle Capacity Exceeded</span>
                  <p>
                    Configured passenger count (<strong>{totalPax} Pax</strong>) exceeds the maximum capacity of <strong>{vehicleName}</strong> (<strong>{masterCapacity} Seats</strong>).
                  </p>
                  {higherCapacityVehicles.length > 0 ? (
                    <div className="pt-1 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] text-rose-700">Recommended upgrade:</span>
                      {higherCapacityVehicles.slice(0, 2).map(hv => (
                        <button
                          key={hv.id}
                          type="button"
                          onClick={() => setSelectedVehicleId(hv.id)}
                          className="px-2 py-0.5 bg-white border border-rose-300 rounded-md text-[11px] font-bold text-rose-800 hover:bg-rose-100 cursor-pointer"
                        >
                          Switch to {hv.name} ({hv.maxCapacity} Seats)
                        </button>
                      ))}
                    </div>
                  ) : isExceedingAllFleetCapacity ? (
                    <p className="text-[11px] text-rose-700">
                      Total group size exceeds single-vehicle inventory limit ({maxFleetCapacity} Seats). Please adjust passenger count or contact operations for multi-coach charter.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-2.5 flex items-center space-x-2 text-xs text-emerald-800">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>Capacity Validated:</strong> {vehicleName} accommodates {totalPax} passenger{totalPax > 1 ? 's' : ''} (up to {masterCapacity} seats).
                </span>
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* LAYER 3: TRAVEL / BOOKING DETAILS */}
          {/* ========================================================================= */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-4">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              3. Booking & Travel Details
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-amber-500" />
                  <span>Tour Date *</span>
                </label>
                <input
                  type="date"
                  value={travelDate}
                  onChange={e => setTravelDate(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 cursor-pointer"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  <span>Departure Time *</span>
                </label>
                <input
                  type="time"
                  value={serviceTime}
                  onChange={e => setServiceTime(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 cursor-pointer"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>Hotel Pickup Location</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Palace Hotel Tokyo Lobby / Concierge Desk"
                value={pickupLocation}
                onChange={e => setPickupLocation(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900"
              />
            </div>

            {/* Passenger Composition */}
            <div className="grid grid-cols-3 gap-3 pt-1">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Adults (12+)</label>
                <div className="flex items-center space-x-1.5 bg-white p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setAdults(Math.max(1, adults - 1))}
                    className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="flex-1 text-center font-bold text-xs text-slate-900">{adults}</span>
                  <button
                    type="button"
                    onClick={() => setAdults(adults + 1)}
                    className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Children (2–11)</label>
                <div className="flex items-center space-x-1.5 bg-white p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setChildren(Math.max(0, children - 1))}
                    className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="flex-1 text-center font-bold text-xs text-slate-900">{children}</span>
                  <button
                    type="button"
                    onClick={() => setChildren(children + 1)}
                    className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Infants (0–1)</label>
                <div className="flex items-center space-x-1.5 bg-white p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setInfants(Math.max(0, infants - 1))}
                    className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="flex-1 text-center font-bold text-xs text-slate-900">{infants}</span>
                  <button
                    type="button"
                    onClick={() => setInfants(infants + 1)}
                    className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* LAYER 4: OPTIONAL EXPERIENCE UPGRADES / UPSELLS */}
          {/* ========================================================================= */}
          {availableUpsells.length > 0 && (
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>4. Optional Experience Upgrades</span>
                </span>
                <span className="text-[10px] text-slate-500 font-medium">
                  {selectedAddons.length} selected
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {availableUpsells.map(upsell => {
                  const isSelected = selectedAddons.includes(upsell.id);
                  return (
                    <button
                      key={upsell.id}
                      type="button"
                      onClick={() => toggleAddon(upsell.id)}
                      className={`p-3 rounded-xl border text-left flex items-start space-x-2.5 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-amber-50 border-amber-400 text-slate-900 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 mt-0.5 ${
                        isSelected ? 'bg-amber-500 border-amber-500 text-slate-950' : 'border-slate-300 bg-white'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-xs leading-snug">{upsell.name}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          +{formatCurrency(upsell.price, currency)} {upsell.priceType === 'PER_BOOKING' ? '(Total)' : '/ person'}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* SPECIAL REQUIREMENTS */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 block">
              Special Client Requests / Itinerary Customizations
            </label>
            <input
              type="text"
              placeholder="e.g. Guest wishes to spend extra time at Lake Kawaguchi view point"
              value={specialRequirements}
              onChange={e => setSpecialRequirements(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
            />
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
              Final Wholesale Price
            </span>
            <div className="text-xl sm:text-2xl font-black text-amber-400">
              {formatCurrency(pricing.grossSellingPrice, pricing.currency)}
            </div>
            {selectedAddons.length > 0 && (
              <span className="text-[10px] text-slate-400">
                Includes {selectedAddons.length} selected upgrade{selectedAddons.length > 1 ? 's' : ''}
              </span>
            )}
            {canViewInternalCosts && pricing.netCost > 0 && (
              <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">
                DMC Net: {formatCurrency(pricing.netCost, pricing.currency)}
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2.5 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isCapacityExceeded || isSelectedVehicleInactive}
              className={`px-6 py-2.5 rounded-xl text-xs font-black shadow-lg transition-all flex items-center space-x-1.5 ${
                isCapacityExceeded || isSelectedVehicleInactive
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : 'bg-amber-400 text-slate-950 hover:bg-amber-300 cursor-pointer'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>{isEditing ? 'Update Configuration' : 'Add to Quote'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
