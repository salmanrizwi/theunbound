import React, { useState, useMemo } from 'react';
import { Product, QuoteItem, CurrencyCode } from '../../types';
import { useQuotation } from '../../context/QuotationContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, calculateProductPrice } from '../../services/pricingEngine';
import { generateConfigurationIdentity, getActiveUpsellsForProduct, createUpsellSnapshot } from '../../services/configuratorRegistry';
import { 
  X, 
  Anchor, 
  Calendar, 
  Clock, 
  Users, 
  MapPin, 
  Sparkles, 
  ShieldCheck, 
  Check, 
  Plus, 
  Minus, 
  ArrowRight,
  Info
} from 'lucide-react';

export interface FerryConfiguratorProps {
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
 * THEUNBOUND — FERRY & VESSEL CONFIGURATOR
 * Database-Driven Maritime Vessel & Ferry Transfer Configuration Engine
 * ============================================================================
 * 
 * Rules:
 * - Product Management defines vessel snapshot, ports (departure/arrival), and fares.
 * - Layer 1: Read-only master information (Vessel line, class, ports, capacity).
 * - Layer 2: Genuine selectable options (Trip type, Upsells).
 * - Layer 3: Transaction details (Sailing Date, Time Slot, Passenger counts).
 * - Price is calculated strictly via the central Pricing Engine.
 */
export const FerryConfigurator: React.FC<FerryConfiguratorProps> = ({
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

  // Authoritative Vessel & Route Data (Layer 1)
  const vesselName = product?.ferryNameSnapshot || product?.ferryConfig?.ferryLine || product?.name || 'Authoritative Marine Ferry';
  const vesselClass = product?.ferryTypeSnapshot || product?.ferryConfig?.vesselClass || 'High-Speed Express Ferry';
  const departurePort = product?.ferryConfig?.departurePort || product?.city || 'Departure Port';
  const arrivalPort = product?.ferryConfig?.arrivalPort || 'Island Port Terminal';
  const masterCapacity = Number(product?.ferryCapacitySnapshot) || Number(product?.ferryConfig?.capacity) || Number(product?.maxPax) || 200;

  // Form State (Layer 3: Transaction Details)
  const [tripType, setTripType] = useState<'ONE_WAY' | 'ROUND_TRIP'>(
    existingConfig.tripType || 'ONE_WAY'
  );
  const [departureDate, setDepartureDate] = useState<string>(
    existingConfig.departureDate || initialTravelDate || (itemOrProduct as QuoteItem)?.travelDate || new Date().toISOString().split('T')[0]
  );
  const [returnDate, setReturnDate] = useState<string>(
    existingConfig.returnDate || ''
  );
  const [departureSlot, setDepartureSlot] = useState<string>(
    existingConfig.departureSlot || initialServiceTime || (itemOrProduct as QuoteItem)?.serviceTime || '09:00 AM — Morning Sailing'
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

  const [selectedAddons, setSelectedAddons] = useState<string[]>(
    existingConfig.selectedAddons || (itemOrProduct as QuoteItem)?.selectedAddonIds || []
  );
  const [specialInstructions, setSpecialInstructions] = useState<string>(
    existingConfig.specialInstructions || initialNotes || (itemOrProduct as QuoteItem)?.notes || ''
  );

  // Authoritative Product Upsells (Layer 2)
  const availableUpsells = useMemo(() => {
    return getActiveUpsellsForProduct(product);
  }, [product]);

  const toggleAddon = (id: string) => {
    setSelectedAddons(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Centralized Authoritative Per-Passenger Ferry Pricing
  const pricing = useMemo(() => {
    if (!product) return { grossSellingPrice: 0, finalPrice: 0, baseSelling: 0, addonsCost: 0, currency };
    const tripMultiplier = tripType === 'ROUND_TRIP' ? 2 : 1;
    const calc = calculateProductPrice(product, {
      productId: product.id,
      adults,
      children,
      infants: 0,
      quantity: tripMultiplier,
      travelDate: departureDate,
      targetCurrency: currency,
      user,
      selectedAddonIds: selectedAddons,
      selectedUpsellIds: selectedAddons
    });

    return {
      grossSellingPrice: calc.finalTotalSellingPrice,
      finalPrice: calc.finalTotalSellingPrice,
      adultFare: calc.adultPricePerPax,
      childFare: calc.childPricePerPax,
      baseAdultTotal: calc.adultsSubtotalSelling,
      baseChildTotal: calc.childrenSubtotalSelling,
      addonsCost: calc.addonsSubtotalSelling || 0,
      currency: calc.currency,
      calcResult: calc
    };
  }, [product, tripType, adults, children, departureDate, selectedAddons, currency, user]);

  if (!isOpen || !product) return null;

  const handleSave = () => {
    const configIdentity = generateConfigurationIdentity(
      'Ferries',
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
      vesselName,
      vesselClass,
      departurePort,
      arrivalPort,
      tripType,
      departureDate,
      returnDate: tripType === 'ROUND_TRIP' ? returnDate : undefined,
      departureSlot,
      adults,
      children,
      infants,
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
        travelDate: departureDate,
        serviceTime: departureSlot,
        notes: `${vesselName} (${departurePort} ➔ ${arrivalPort}) [${tripType}]. ${specialInstructions}`,
        selectedAddonIds: selectedAddons,
        selectedUpsellIds: selectedAddons,
        selectedUpsellSnapshots: selectedUpsellSnapshots as any
      });
    } else {
      addProductToQuote(product, {
        adults,
        children,
        infants,
        travelDate: departureDate,
        serviceTime: departureSlot,
        notes: `${vesselName} (${departurePort} ➔ ${arrivalPort}) [${tripType}]. ${specialInstructions}`,
        selectedAddonIds: selectedAddons,
        selectedUpsellIds: selectedAddons,
        selectedUpsellSnapshots: selectedUpsellSnapshots as any,
        configuration_id: configIdentity.configuration_id,
        configuration_snapshot: configurationPayload,
        pricing_snapshot: pricing,
        category: 'Ferries',
        service_type: 'FERRY_CONFIGURATOR',
        metadata: {
          configuration_payload: configurationPayload,
          configurator_type: 'FERRY_CONFIGURATOR'
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
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
              <Anchor className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-400 text-slate-950">
                  Ferry Configurator
                </span>
                <span className="text-xs text-slate-400 font-medium truncate">
                  {product.destinationName || product.country || 'Japan'} • Marine Transfer
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
                1. Vessel & Port Logistics
              </span>
              <span className="text-[10px] text-slate-400 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                Authoritative Master Data
              </span>
            </div>

            {/* Ports Route Banner */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-2 min-w-0">
                <MapPin className="w-4 h-4 text-cyan-600 shrink-0" />
                <div className="text-xs font-bold text-slate-800 truncate">
                  <span className="text-slate-500 font-normal">Departure: </span>{departurePort}
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-300 hidden sm:block shrink-0" />
              <div className="flex items-center space-x-2 min-w-0">
                <MapPin className="w-4 h-4 text-[#00C6A6] shrink-0" />
                <div className="text-xs font-bold text-slate-800 truncate">
                  <span className="text-slate-500 font-normal">Arrival: </span>{arrivalPort}
                </div>
              </div>
            </div>

            {/* Vessel Specifications */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Vessel Line</span>
                <span className="text-slate-900 font-bold truncate block mt-0.5">{vesselName}</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Classification</span>
                <span className="text-slate-700 font-semibold truncate block mt-0.5">{vesselClass}</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200 col-span-2 sm:col-span-1">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Licensed Capacity</span>
                <span className="text-cyan-600 font-bold block mt-0.5">{masterCapacity} Pax</span>
              </div>
            </div>
          </div>

          {/* LAYER 2: CONFIGURABLE TRIP TYPE */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              2. Trip Format
            </span>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setTripType('ONE_WAY')}
                className={`p-3 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer ${
                  tripType === 'ONE_WAY'
                    ? 'bg-cyan-50 border-cyan-400 text-cyan-950 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                {tripType === 'ONE_WAY' ? '✓ ' : ''}One-Way Passage
              </button>

              <button
                type="button"
                onClick={() => setTripType('ROUND_TRIP')}
                className={`p-3 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer ${
                  tripType === 'ROUND_TRIP'
                    ? 'bg-cyan-50 border-cyan-400 text-cyan-950 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                {tripType === 'ROUND_TRIP' ? '✓ ' : ''}Round-Trip Return Passage
              </button>
            </div>
          </div>

          {/* LAYER 3: TRAVEL / BOOKING DETAILS */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-4">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              3. Sailing Schedule & Passengers
            </span>

            <div className={`grid gap-3 ${tripType === 'ROUND_TRIP' ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-cyan-500" />
                  <span>Departure Date *</span>
                </label>
                <input
                  type="date"
                  value={departureDate}
                  onChange={e => setDepartureDate(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
                  required
                />
              </div>

              {tripType === 'ROUND_TRIP' && (
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-cyan-500" />
                    <span>Return Date *</span>
                  </label>
                  <input
                    type="date"
                    value={returnDate}
                    onChange={e => setReturnDate(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
                    required
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-cyan-500" />
                  <span>Sailing Slot *</span>
                </label>
                <input
                  type="text"
                  value={departureSlot}
                  onChange={e => setDepartureSlot(e.target.value)}
                  placeholder="e.g. 09:00 AM — Morning Departure"
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
                  required
                />
              </div>
            </div>

            {/* Passenger Counts */}
            <div className="grid grid-cols-3 gap-3 pt-1">
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
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Infants (0–1)</label>
                <div className="flex items-center space-x-1.5 bg-white p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setInfants(Math.max(0, infants - 1))}
                    className="p-1 rounded-lg hover:bg-slate-100 text-slate-600"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="flex-1 text-center font-bold text-xs text-slate-900">{infants}</span>
                  <button
                    type="button"
                    onClick={() => setInfants(infants + 1)}
                    className="p-1 rounded-lg hover:bg-slate-100 text-slate-600"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* LAYER 2: OPTIONAL EXPERIENCE UPGRADES / UPSELLS */}
          {availableUpsells.length > 0 && (
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-500" />
                  <span>4. Optional Ferry Upgrades</span>
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
                          ? 'bg-cyan-50 border-cyan-400 text-slate-900 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 mt-0.5 ${
                        isSelected ? 'bg-cyan-500 border-cyan-500 text-white' : 'border-slate-300 bg-white'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-xs leading-snug">{upsell.name}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          +{formatCurrency(upsell.price, currency)} {upsell.priceType === 'PER_BOOKING' ? '(Total)' : '/ passenger'}
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
              Pier Assistance & Special Requests
            </label>
            <input
              type="text"
              placeholder="e.g. Priority boarding assistance, excess baggage transport"
              value={specialInstructions}
              onChange={e => setSpecialInstructions(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
            />
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
              Final Price
            </span>
            <div className="text-xl sm:text-2xl font-black text-cyan-400">
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
              className="px-6 py-2.5 rounded-xl text-xs font-black shadow-lg transition-all cursor-pointer flex items-center space-x-1.5 bg-cyan-400 text-slate-950 hover:bg-cyan-300"
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
