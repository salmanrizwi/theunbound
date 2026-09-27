import React, { useState, useMemo } from 'react';
import { Product, QuoteItem, CurrencyCode } from '../../types';
import { useQuotation } from '../../context/QuotationContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, calculateProductPrice } from '../../services/pricingEngine';
import { generateConfigurationIdentity, getActiveUpsellsForProduct, createUpsellSnapshot } from '../../services/configuratorRegistry';
import { 
  X, 
  Ship, 
  Calendar, 
  Clock, 
  Users, 
  MapPin, 
  Anchor, 
  Sparkles, 
  ShieldCheck, 
  Check, 
  Plus, 
  Minus, 
  AlertTriangle,
  Info
} from 'lucide-react';

export interface PrivateYachtConfiguratorProps {
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
 * THEUNBOUND — PRIVATE YACHT CONFIGURATOR (Section 13)
 * Database-Driven Luxury Yacht Charter Configuration Engine
 * ============================================================================
 * 
 * Rules:
 * - Product Management defines vessel snapshot, dimensions, crew, and base charter cost.
 * - Layer 1: Read-only master information (Yacht dimensions, builder, capacity).
 * - Layer 2: Genuine selectable options (Product Upsells).
 * - Layer 3: Transaction details (Charter Date, Slot, Duration, Guests).
 * - Price is calculated strictly via the central Pricing Engine.
 */
export const PrivateYachtConfigurator: React.FC<PrivateYachtConfiguratorProps> = ({
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

  // Form State (Layer 3: Transaction Details)
  const [travelDate, setTravelDate] = useState<string>(
    existingConfig.travelDate || initialTravelDate || (itemOrProduct as QuoteItem)?.travelDate || new Date().toISOString().split('T')[0]
  );
  const [charterSlot, setCharterSlot] = useState<string>(
    existingConfig.charterSlot || initialServiceTime || (itemOrProduct as QuoteItem)?.serviceTime || '02:00 PM'
  );
  const [durationHours, setDurationHours] = useState<number>(
    existingConfig.durationHours || 4
  );
  const [adults, setAdults] = useState<number>(
    existingConfig.adults ?? initialAdults ?? (itemOrProduct as QuoteItem)?.pax?.adults ?? 4
  );
  const [children, setChildren] = useState<number>(
    existingConfig.children ?? initialChildren ?? (itemOrProduct as QuoteItem)?.pax?.children ?? 0
  );
  const [infants, setInfants] = useState<number>(
    existingConfig.infants ?? initialInfants ?? (itemOrProduct as QuoteItem)?.pax?.infants ?? 0
  );

  const [departureMarina, setDepartureMarina] = useState<string>(
    existingConfig.departureMarina || product?.city ? `${product.city} Marina Pier` : 'Designated Luxury Marina Pier'
  );
  const [cateringNotes, setCateringNotes] = useState<string>(
    existingConfig.cateringNotes || initialNotes || (itemOrProduct as QuoteItem)?.notes || ''
  );

  const [selectedAddons, setSelectedAddons] = useState<string[]>(
    existingConfig.selectedAddons || (itemOrProduct as QuoteItem)?.selectedAddonIds || []
  );

  // Authoritative Yacht Details (Layer 1)
  const yachtName = product?.yachtNameSnapshot || product?.vehicleConfig?.yachtModel || product?.name || 'Luxury Motor Yacht';
  const yachtType = product?.yachtTypeSnapshot || product?.vehicleConfig?.yachtType || 'Flybridge Cruiser';
  const yachtDimensions = product?.vehicleConfig?.yachtSize || '65 ft / 20m';
  const masterCapacity = Number(product?.yachtCapacitySnapshot) || Number(product?.capacitySnapshot) || Number(product?.vehicleConfig?.maxSeats) || Number(product?.maxPax) || 12;

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
  const totalGuests = adults + children;
  const isCapacityExceeded = totalGuests > masterCapacity;

  // Centralized Authoritative Capacity-Based Yacht Pricing
  const pricing = useMemo(() => {
    if (!product) return { grossSellingPrice: 0, finalPrice: 0, baseCharterSelling: 0, addonsCost: 0, currency };
    const calc = calculateProductPrice(product, {
      productId: product.id,
      adults,
      children,
      infants: 0,
      travelDate,
      targetCurrency: currency,
      user,
      selectedAddonIds: selectedAddons,
      selectedUpsellIds: selectedAddons
    });

    return {
      grossSellingPrice: calc.finalTotalSellingPrice,
      finalPrice: calc.finalTotalSellingPrice,
      baseCharterSelling: calc.adultsSubtotalSelling,
      addonsCost: calc.addonsSubtotalSelling || 0,
      currency: calc.currency,
      calcResult: calc
    };
  }, [product, adults, children, travelDate, selectedAddons, currency, user]);

  if (!isOpen || !product) return null;

  const handleSave = () => {
    if (isCapacityExceeded) return;

    const configIdentity = generateConfigurationIdentity(
      'Private Yacht',
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
      yachtName,
      yachtType,
      yachtDimensions,
      masterCapacity,
      travelDate,
      charterSlot,
      durationHours,
      adults,
      children,
      infants,
      departureMarina,
      selectedAddons,
      selectedUpsellSnapshots,
      cateringNotes,
      pricingSummary: pricing
    };

    if (isEditing && existingQuoteItemId) {
      updateQuoteItem(existingQuoteItemId, product, {
        adults,
        children,
        infants,
        travelDate,
        serviceTime: charterSlot,
        notes: `Private Yacht (${yachtName}, ${yachtDimensions}) | ${departureMarina}. ${cateringNotes}`,
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
        serviceTime: charterSlot,
        notes: `Private Yacht (${yachtName}, ${yachtDimensions}) | ${departureMarina}. ${cateringNotes}`,
        selectedAddonIds: selectedAddons,
        selectedUpsellIds: selectedAddons,
        selectedUpsellSnapshots: selectedUpsellSnapshots as any,
        configuration_id: configIdentity.configuration_id,
        configuration_snapshot: configurationPayload,
        pricing_snapshot: pricing,
        category: 'Private Yacht',
        service_type: 'PRIVATE_YACHT_CONFIGURATOR',
        metadata: {
          configuration_payload: configurationPayload,
          configurator_type: 'PRIVATE_YACHT_CONFIGURATOR'
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
                  Private Yacht Configurator
                </span>
                <span className="text-xs text-slate-400 font-medium truncate">
                  {product.destinationName || product.country || 'Japan'} • {product.city || 'Marina'}
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
                1. Vessel Specifications & Dimensions
              </span>
              <span className="text-[10px] text-slate-400 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                Authoritative Master Data
              </span>
            </div>

            {product.shortDescription && (
              <p className="text-xs text-slate-600 leading-relaxed bg-white p-3 rounded-xl border border-slate-200">
                {product.shortDescription}
              </p>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Vessel Model</span>
                <span className="text-slate-900 font-bold truncate block mt-0.5">{yachtName}</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Classification</span>
                <span className="text-slate-700 font-semibold truncate block mt-0.5">{yachtType}</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Length / Dimensions</span>
                <span className="text-slate-700 font-semibold truncate block mt-0.5">{yachtDimensions}</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Master Capacity</span>
                <span className="text-cyan-600 font-bold block mt-0.5">{masterCapacity} Guests</span>
              </div>
            </div>

            {/* Crew Complement Details */}
            {product.vehicleConfig?.skipperName && (
              <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-xs">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Crew Complement</span>
                <span className="text-slate-900 font-medium block mt-0.5">{product.vehicleConfig.skipperName}</span>
              </div>
            )}
          </div>

          {/* LAYER 3: TRAVEL / BOOKING DETAILS */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-4">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              2. Charter Date, Duration & Guests
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-cyan-500" />
                  <span>Charter Date *</span>
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
                  <Clock className="w-3.5 h-3.5 text-cyan-500" />
                  <span>Embarkation Time *</span>
                </label>
                <input
                  type="time"
                  value={charterSlot}
                  onChange={e => setCharterSlot(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Charter Duration
                </label>
                <div className="flex items-center space-x-1.5 bg-white p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setDurationHours(Math.max(2, durationHours - 1))}
                    className="p-1 rounded-lg hover:bg-slate-100 text-slate-600"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="flex-1 text-center font-bold text-xs text-slate-900">{durationHours} Hours</span>
                  <button
                    type="button"
                    onClick={() => setDurationHours(durationHours + 1)}
                    className="p-1 rounded-lg hover:bg-slate-100 text-slate-600"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>Departure Marina Pier</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Marina Pier #3 / Tokyo Bay"
                value={departureMarina}
                onChange={e => setDepartureMarina(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900"
              />
            </div>

            {/* Guest Counts */}
            <div className="grid grid-cols-3 gap-3 pt-1">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Adults</label>
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
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Children</label>
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
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Infants</label>
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

            {/* Capacity Warning Banner */}
            {isCapacityExceeded && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start space-x-2.5 text-xs text-rose-800 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Yacht Passenger Capacity Exceeded</span>
                  <span>
                    Total guest count ({totalGuests} Guests) exceeds maritime license limit ({masterCapacity} Pax) for {yachtName}. Please adjust guest count.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* LAYER 2: OPTIONAL EXPERIENCE UPGRADES / UPSELLS */}
          {availableUpsells.length > 0 && (
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-500" />
                  <span>3. Optional Maritime Upgrades</span>
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
                        isSelected ? 'bg-cyan-500 border-cyan-500 text-slate-950' : 'border-slate-300 bg-white'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-xs leading-snug">{upsell.name}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          +{formatCurrency(upsell.price, currency)} {upsell.priceType === 'PER_BOOKING' ? '(Total)' : '/ guest'}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* CATERING & SPECIAL REQUESTS */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 block">
              Onboard Catering & Cruising Customizations
            </label>
            <input
              type="text"
              placeholder="e.g. Champagne toast on boarding, special sunset cruising route"
              value={cateringNotes}
              onChange={e => setCateringNotes(e.target.value)}
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
              disabled={isCapacityExceeded}
              className={`px-6 py-2.5 rounded-xl text-xs font-black shadow-lg transition-all cursor-pointer flex items-center space-x-1.5 ${
                isCapacityExceeded
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : 'bg-cyan-400 text-slate-950 hover:bg-cyan-300'
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
