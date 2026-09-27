import React, { useState, useMemo } from 'react';
import { Product, QuoteItem, CurrencyCode } from '../../types';
import { useQuotation } from '../../context/QuotationContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, calculateProductPrice } from '../../services/pricingEngine';
import { generateConfigurationIdentity, getActiveUpsellsForProduct, createUpsellSnapshot } from '../../services/configuratorRegistry';
import { 
  X, 
  Car, 
  Calendar, 
  Clock, 
  Users, 
  MapPin, 
  Plane, 
  Briefcase, 
  ShieldCheck, 
  Check, 
  Plus, 
  Minus, 
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Info
} from 'lucide-react';

export interface TransferConfiguratorProps {
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
 * THEUNBOUND — TRANSFER CONFIGURATOR (Section 10)
 * Database-Driven Ground Transfer Configuration Engine
 * ============================================================================
 * 
 * Rules:
 * - Route is defined by Product Management (from_hub_id ➔ to_hub_id) and is READ-ONLY.
 * - Vehicle & Capacity are loaded from authoritative Product configuration (snapshots).
 * - Agent configures transaction details: Date, Time, Pax, Luggage, and Product Upsells.
 * - Central Pricing Engine calculates final Agent selling price. Zero internal cost leakage.
 */
export const TransferConfigurator: React.FC<TransferConfiguratorProps> = ({
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

  // Form State (Layer 3: Transaction-Level Context)
  const [travelDate, setTravelDate] = useState<string>(
    existingConfig.travelDate || initialTravelDate || (itemOrProduct as QuoteItem)?.travelDate || new Date().toISOString().split('T')[0]
  );
  const [pickupTime, setPickupTime] = useState<string>(
    existingConfig.pickupTime || existingConfig.transferTime || initialServiceTime || (itemOrProduct as QuoteItem)?.serviceTime || '10:00 AM'
  );
  const [flightNumber, setFlightNumber] = useState<string>(
    existingConfig.flightNumber || ''
  );
  const [pickupAddress, setPickupAddress] = useState<string>(
    existingConfig.pickupAddress || existingConfig.pickupLocation || ''
  );
  const [dropoffAddress, setDropoffAddress] = useState<string>(
    existingConfig.dropoffAddress || existingConfig.dropoffLocation || ''
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

  const [checkedLuggageCount, setCheckedLuggageCount] = useState<number>(
    existingConfig.checkedLuggageCount ?? 2
  );
  const [handLuggageCount, setHandLuggageCount] = useState<number>(
    existingConfig.handLuggageCount ?? 2
  );

  const [selectedAddons, setSelectedAddons] = useState<string[]>(
    existingConfig.selectedAddons || (itemOrProduct as QuoteItem)?.selectedAddonIds || []
  );
  const [specialInstructions, setSpecialInstructions] = useState<string>(
    existingConfig.specialInstructions || initialNotes || (itemOrProduct as QuoteItem)?.notes || ''
  );

  // Authoritative Product Information (Layer 1)
  const originHubName = product?.fromHubName || (product?.fromHubId ? `Hub: ${product.fromHubId}` : `${product?.city || product?.destinationName || 'Origin Hub'}`);
  const destinationHubName = product?.toHubName || (product?.toHubId ? `Hub: ${product.toHubId}` : 'Destination Hub');
  
  const vehicleName = product?.vehicleNameSnapshot || product?.vehicleConfig?.vehicleModel || 'Authoritative Fleet Vehicle';
  const vehicleType = product?.vehicleTypeSnapshot || product?.vehicleConfig?.vehicleType || 'Executive MPV';
  const masterCapacity = Number(product?.capacitySnapshot) || Number(product?.vehicleConfig?.maxSeats) || Number(product?.maxPax) || 5;
  const maxLuggage = Number(product?.vehicleConfig?.maxLuggage) || 4;

  // Authoritative Product Upsells (Layer 2)
  const availableUpsells = useMemo(() => {
    return getActiveUpsellsForProduct(product);
  }, [product]);

  const toggleAddon = (addonId: string) => {
    setSelectedAddons(prev => 
      prev.includes(addonId) ? prev.filter(id => id !== addonId) : [...prev, addonId]
    );
  };

  // Capacity Validation
  const totalPax = adults + children;
  const isCapacityExceeded = totalPax > masterCapacity;
  const isLuggageExceeded = checkedLuggageCount > maxLuggage;

  // Centralized Authoritative Pricing Calculation
  const pricing = useMemo(() => {
    if (!product) return { grossSellingPrice: 0, finalPrice: 0, baseSelling: 0, addonsCost: 0, currency };
    const calc = calculateProductPrice(product, {
      productId: product.id,
      adults,
      children,
      infants,
      travelDate,
      targetCurrency: currency,
      user,
      selectedAddonIds: selectedAddons,
      selectedUpsellIds: selectedAddons
    });

    return {
      grossSellingPrice: calc.finalTotalSellingPrice,
      finalPrice: calc.finalTotalSellingPrice,
      baseSelling: calc.adultsSubtotalSelling,
      addonsCost: calc.addonsSubtotalSelling || 0,
      currency: calc.currency,
      calcResult: calc
    };
  }, [product, adults, children, infants, travelDate, selectedAddons, currency, user]);

  if (!isOpen || !product) return null;

  const handleSave = () => {
    if (isCapacityExceeded) return;

    const configIdentity = generateConfigurationIdentity(
      'Transfers',
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
      fromHub: originHubName,
      toHub: destinationHubName,
      vehicleName,
      vehicleType,
      masterCapacity,
      maxLuggage,
      travelDate,
      pickupTime,
      flightNumber,
      pickupAddress: pickupAddress || originHubName,
      dropoffAddress: dropoffAddress || destinationHubName,
      adults,
      children,
      infants,
      checkedLuggageCount,
      handLuggageCount,
      selectedAddons,
      selectedUpsellSnapshots,
      specialInstructions,
      pricingSummary: pricing
    };

    if (isEditing && existingQuoteItemId) {
      updateQuoteItem(existingQuoteItemId, product, {
        adults,
        children,
        infants,
        travelDate,
        serviceTime: pickupTime,
        notes: `${originHubName} ➔ ${destinationHubName} (${vehicleName}) ${flightNumber ? `| Flight: ${flightNumber}` : ''}. ${specialInstructions}`,
        selectedAddonIds: selectedAddons,
        selectedUpsellIds: selectedAddons,
        selectedUpsellSnapshots: selectedUpsellSnapshots as any
      });
    } else {
      addProductToQuote(product, {
        adults,
        children,
        infants,
        travelDate,
        serviceTime: pickupTime,
        notes: `${originHubName} ➔ ${destinationHubName} (${vehicleName}) ${flightNumber ? `| Flight: ${flightNumber}` : ''}. ${specialInstructions}`,
        selectedAddonIds: selectedAddons,
        selectedUpsellIds: selectedAddons,
        selectedUpsellSnapshots: selectedUpsellSnapshots as any,
        configuration_id: configIdentity.configuration_id,
        configuration_snapshot: configurationPayload,
        pricing_snapshot: pricing,
        category: 'Transfers',
        service_type: 'TRANSFER_CONFIGURATOR',
        metadata: {
          configuration_payload: configurationPayload,
          configurator_type: 'TRANSFER_CONFIGURATOR'
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
            <div className="w-10 h-10 rounded-2xl bg-[#00C6A6]/20 border border-[#00C6A6]/30 flex items-center justify-center text-[#00C6A6] shrink-0">
              <Car className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#00C6A6] text-slate-950">
                  Transfer Configurator
                </span>
                <span className="text-xs text-slate-400 font-medium truncate">
                  {product.destinationName || product.country || 'Japan'}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white truncate mt-0.5">
                {product.name || 'Private Airport & City Transfer'}
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

        {/* MODAL BODY (SCROLLABLE) */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          
          {/* LAYER 1: PRODUCT INFORMATION (READ-ONLY) */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                1. Product Route & Vehicle
              </span>
              <span className="text-[10px] text-slate-400 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                Authoritative Master Data
              </span>
            </div>

            {/* Hub-to-Hub Route Banner (Read-Only) */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-2 min-w-0">
                <MapPin className="w-4 h-4 text-[#00C6A6] shrink-0" />
                <div className="text-xs font-bold text-slate-800 truncate">
                  <span className="text-slate-500 font-normal">From: </span>{originHubName}
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-300 hidden sm:block shrink-0" />
              <div className="flex items-center space-x-2 min-w-0">
                <MapPin className="w-4 h-4 text-cyan-600 shrink-0" />
                <div className="text-xs font-bold text-slate-800 truncate">
                  <span className="text-slate-500 font-normal">To: </span>{destinationHubName}
                </div>
              </div>
            </div>

            {/* Selected Vehicle Specs (Read-Only) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 text-xs">
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Vehicle Model</span>
                <span className="text-slate-900 font-bold truncate block mt-0.5">{vehicleName}</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Classification</span>
                <span className="text-slate-700 font-semibold truncate block mt-0.5">{vehicleType}</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Master Capacity</span>
                <span className="text-[#00C6A6] font-bold block mt-0.5">{masterCapacity} Passengers</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Max Luggage</span>
                <span className="text-slate-700 font-semibold block mt-0.5">{maxLuggage} Large Bags</span>
              </div>
            </div>
          </div>

          {/* LAYER 3: TRAVEL / BOOKING DETAILS */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-4">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              2. Travel & Transaction Details
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-[#00C6A6]" />
                  <span>Transfer Date *</span>
                </label>
                <input
                  type="date"
                  value={travelDate}
                  onChange={e => setTravelDate(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-[#00C6A6]" />
                  <span>Pickup Time *</span>
                </label>
                <input
                  type="time"
                  value={pickupTime}
                  onChange={e => setPickupTime(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1 flex items-center gap-1">
                  <Plane className="w-3.5 h-3.5 text-slate-400" />
                  <span>Flight / Train Number (Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. NH 007 or Shinkansen Nozomi 42"
                  value={flightNumber}
                  onChange={e => setFlightNumber(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>Specific Drop-off Location</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Palace Hotel Tokyo Lobby"
                  value={dropoffAddress}
                  onChange={e => setDropoffAddress(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900"
                />
              </div>
            </div>

            {/* Passenger & Luggage Counts */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Adults (12+)</label>
                <div className="flex items-center space-x-1.5 bg-white p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setAdults(Math.max(1, adults - 1))}
                    className="p-1 rounded-lg hover:bg-slate-100 text-slate-600"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="flex-1 text-center font-bold text-xs text-slate-900">{adults}</span>
                  <button
                    type="button"
                    onClick={() => setAdults(adults + 1)}
                    className="p-1 rounded-lg hover:bg-slate-100 text-slate-600"
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
                    className="p-1 rounded-lg hover:bg-slate-100 text-slate-600"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="flex-1 text-center font-bold text-xs text-slate-900">{children}</span>
                  <button
                    type="button"
                    onClick={() => setChildren(children + 1)}
                    className="p-1 rounded-lg hover:bg-slate-100 text-slate-600"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Checked Luggage</label>
                <div className="flex items-center space-x-1.5 bg-white p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setCheckedLuggageCount(Math.max(0, checkedLuggageCount - 1))}
                    className="p-1 rounded-lg hover:bg-slate-100 text-slate-600"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="flex-1 text-center font-bold text-xs text-slate-900">{checkedLuggageCount}</span>
                  <button
                    type="button"
                    onClick={() => setCheckedLuggageCount(checkedLuggageCount + 1)}
                    className="p-1 rounded-lg hover:bg-slate-100 text-slate-600"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Hand Luggage</label>
                <div className="flex items-center space-x-1.5 bg-white p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setHandLuggageCount(Math.max(0, handLuggageCount - 1))}
                    className="p-1 rounded-lg hover:bg-slate-100 text-slate-600"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="flex-1 text-center font-bold text-xs text-slate-900">{handLuggageCount}</span>
                  <button
                    type="button"
                    onClick={() => setHandLuggageCount(handLuggageCount + 1)}
                    className="p-1 rounded-lg hover:bg-slate-100 text-slate-600"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Capacity Warning Banner */}
            {isCapacityExceeded && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start space-x-2.5 text-xs text-rose-800 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Vehicle Capacity Exceeded</span>
                  <span>
                    The total passenger count ({totalPax} Pax) exceeds the maximum capacity ({masterCapacity} Seats) for {vehicleName}. Please adjust passengers or select an appropriate Transfer Product.
                  </span>
                </div>
              </div>
            )}

            {isLuggageExceeded && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-center space-x-2 text-xs text-amber-800">
                <Info className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Checked luggage count ({checkedLuggageCount}) exceeds vehicle standard boot limit ({maxLuggage} bags).
                </span>
              </div>
            )}
          </div>

          {/* LAYER 2: OPTIONAL EXPERIENCE UPGRADES / UPSELLS */}
          {availableUpsells.length > 0 && (
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#00C6A6]" />
                  <span>3. Optional Experience Upgrades</span>
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
                          ? 'bg-[#00C6A6]/10 border-[#00C6A6] text-slate-900 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 mt-0.5 ${
                        isSelected ? 'bg-[#00C6A6] border-[#00C6A6] text-slate-950' : 'border-slate-300 bg-white'
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

          {/* SPECIAL INSTRUCTIONS */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 block">
              Special Handling & Notes
            </label>
            <input
              type="text"
              placeholder="e.g. VIP guest, requires English speaking driver greeting with name sign"
              value={specialInstructions}
              onChange={e => setSpecialInstructions(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
            />
          </div>
        </div>

        {/* MODAL FOOTER (STICKY PRICE SUMMARY & ACTIONS) */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
              Final Price
            </span>
            <div className="text-xl sm:text-2xl font-black text-[#00C6A6]">
              {formatCurrency(pricing.grossSellingPrice, currency)}
            </div>
            {selectedAddons.length > 0 && (
              <span className="text-[10px] text-slate-400">
                Includes {selectedAddons.length} selected upgrade{selectedAddons.length > 1 ? 's' : ''}
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
              disabled={isCapacityExceeded}
              className={`px-6 py-2.5 rounded-xl text-xs font-black shadow-lg transition-all cursor-pointer flex items-center space-x-1.5 ${
                isCapacityExceeded
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : 'bg-[#00C6A6] text-slate-950 hover:bg-[#008972]'
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
