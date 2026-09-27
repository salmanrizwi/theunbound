import React, { useState, useMemo } from 'react';
import { Product, QuoteItem, CurrencyCode } from '../../types';
import { useQuotation } from '../../context/QuotationContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, calculateProductPrice } from '../../services/pricingEngine';
import { generateConfigurationIdentity, getActiveUpsellsForProduct, createUpsellSnapshot } from '../../services/configuratorRegistry';
import { 
  X, 
  Utensils, 
  Calendar, 
  Clock, 
  Users, 
  MapPin, 
  Sparkles, 
  ShieldCheck, 
  Check, 
  Plus, 
  Minus, 
  Info
} from 'lucide-react';

export interface RestaurantConfiguratorProps {
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
 * THEUNBOUND — RESTAURANT CONFIGURATOR (Section 12)
 * Database-Driven Dining & Culinary Experience Configuration Engine
 * ============================================================================
 * 
 * Rules:
 * - Product Management defines restaurant name, specialty, meal regimes, and course rate.
 * - Layer 1: Read-only master information (Specialty, location, dietary support).
 * - Layer 2: Genuine selectable options (Configured meals, Upsells).
 * - Layer 3: Transaction details (Date, Seating Time, Guests).
 * - Price is calculated strictly via the central Pricing Engine.
 */
export const RestaurantConfigurator: React.FC<RestaurantConfiguratorProps> = ({
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

  // Authoritative Meals configured on Product
  const configuredMeals: ('Breakfast' | 'Lunch' | 'Dinner')[] = useMemo(() => {
    if (product?.mealSelect && product.mealSelect.length > 0) {
      return product.mealSelect;
    }
    return ['Lunch', 'Dinner'];
  }, [product]);

  // Form State (Layer 3: Transaction Details)
  const [selectedMeal, setSelectedMeal] = useState<'Breakfast' | 'Lunch' | 'Dinner'>(
    existingConfig.selectedMeal || configuredMeals[0] || 'Dinner'
  );
  const [reservationDate, setReservationDate] = useState<string>(
    existingConfig.reservationDate || initialTravelDate || (itemOrProduct as QuoteItem)?.travelDate || new Date().toISOString().split('T')[0]
  );
  const [seatingTime, setSeatingTime] = useState<string>(
    existingConfig.seatingTime || initialServiceTime || (itemOrProduct as QuoteItem)?.serviceTime || (selectedMeal === 'Lunch' ? '12:30 PM' : '07:00 PM')
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

  const [dietaryRequirements, setDietaryRequirements] = useState<string>(
    existingConfig.dietaryRequirements || initialNotes || (itemOrProduct as QuoteItem)?.notes || ''
  );

  const [selectedAddons, setSelectedAddons] = useState<string[]>(
    existingConfig.selectedAddons || (itemOrProduct as QuoteItem)?.selectedAddonIds || []
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

  // Centralized Authoritative Dining Pricing Calculation
  const pricing = useMemo(() => {
    if (!product) return { grossSellingPrice: 0, finalPrice: 0, baseSelling: 0, addonsCost: 0, currency };
    const calc = calculateProductPrice(product, {
      productId: product.id,
      adults,
      children,
      infants: 0,
      travelDate: reservationDate,
      targetCurrency: currency,
      user,
      selectedAddonIds: selectedAddons,
      selectedUpsellIds: selectedAddons
    });

    return {
      grossSellingPrice: calc.finalTotalSellingPrice,
      finalPrice: calc.finalTotalSellingPrice,
      adultCoverRate: calc.adultPricePerPax,
      childCoverRate: calc.childPricePerPax,
      baseAdultTotal: calc.adultsSubtotalSelling,
      baseChildTotal: calc.childrenSubtotalSelling,
      addonsCost: calc.addonsSubtotalSelling || 0,
      currency: calc.currency,
      calcResult: calc
    };
  }, [product, adults, children, reservationDate, selectedAddons, currency, user]);

  if (!isOpen || !product) return null;

  const handleSave = () => {
    const configIdentity = generateConfigurationIdentity(
      'Lunch / Dinner Restaurant',
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
      restaurantName: product.restaurantName || product.name,
      specialty: product.specialty || '',
      selectedMeal,
      reservationDate,
      seatingTime,
      adults,
      children,
      infants,
      dietaryRequirements,
      selectedAddons,
      selectedUpsellSnapshots,
      pricingSummary: pricing
    };

    if (isEditing && existingQuoteItemId) {
      updateQuoteItem(existingQuoteItemId, product, {
        adults,
        children,
        infants,
        travelDate: reservationDate,
        serviceTime: seatingTime,
        notes: `${product.name} (${selectedMeal} at ${seatingTime}). ${dietaryRequirements}`,
        selectedAddonIds: selectedAddons,
        selectedUpsellIds: selectedAddons,
        selectedUpsellSnapshots: selectedUpsellSnapshots as any
      });
    } else {
      addProductToQuote(product, {
        adults,
        children,
        infants,
        travelDate: reservationDate,
        serviceTime: seatingTime,
        notes: `${product.name} (${selectedMeal} at ${seatingTime}). ${dietaryRequirements}`,
        selectedAddonIds: selectedAddons,
        selectedUpsellIds: selectedAddons,
        selectedUpsellSnapshots: selectedUpsellSnapshots as any,
        configuration_id: configIdentity.configuration_id,
        configuration_snapshot: configurationPayload,
        pricing_snapshot: pricing,
        category: 'Lunch / Dinner Restaurant',
        service_type: 'RESTAURANT_CONFIGURATOR',
        metadata: {
          configuration_payload: configurationPayload,
          configurator_type: 'RESTAURANT_CONFIGURATOR'
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
            <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
              <Utensils className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-400 text-slate-950">
                  Restaurant Configurator
                </span>
                <span className="text-xs text-slate-400 font-medium truncate">
                  {product.destinationName || product.country || 'Japan'} • {product.city || 'Dining'}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white truncate mt-0.5">
                {product.restaurantName || product.name}
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
                1. Restaurant & Culinary Overview
              </span>
              <span className="text-[10px] text-slate-400 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                Authoritative Master Data
              </span>
            </div>

            {product.specialty && (
              <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-xs">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Specialty Cuisine</span>
                <span className="text-slate-900 font-bold block mt-0.5">{product.specialty}</span>
              </div>
            )}

            {product.shortDescription && (
              <p className="text-xs text-slate-600 leading-relaxed bg-white p-3 rounded-xl border border-slate-200">
                {product.shortDescription}
              </p>
            )}

            {/* Dietary Accommodations */}
            {product.restaurantConfig?.dietaryAccommodations && product.restaurantConfig.dietaryAccommodations.length > 0 && (
              <div className="pt-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1.5">Dietary Accommodations Supported</span>
                <div className="flex flex-wrap gap-1.5">
                  {product.restaurantConfig.dietaryAccommodations.map((diet, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-[11px] font-medium bg-white text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">
                      <Check className="w-3 h-3 text-rose-600 shrink-0" />
                      <span>{diet}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* LAYER 2: CONFIGURABLE MEAL PERIOD */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              2. Select Meal Period
            </span>

            <div className="flex flex-wrap gap-2.5">
              {configuredMeals.map(meal => {
                const isSelected = selectedMeal === meal;
                return (
                  <button
                    key={meal}
                    type="button"
                    onClick={() => {
                      setSelectedMeal(meal);
                      setSeatingTime(meal === 'Lunch' ? '12:30 PM' : '07:00 PM');
                    }}
                    className={`px-5 py-2.5 rounded-xl border font-bold text-xs transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-rose-50 border-rose-400 text-rose-950 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    {isSelected ? '✓ ' : ''}{meal} Course
                  </button>
                );
              })}
            </div>
          </div>

          {/* LAYER 3: TRAVEL / BOOKING DETAILS */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-4">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              3. Dining Date, Time & Covers
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-rose-500" />
                  <span>Reservation Date *</span>
                </label>
                <input
                  type="date"
                  value={reservationDate}
                  onChange={e => setReservationDate(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-rose-500" />
                  <span>Seating Time *</span>
                </label>
                <input
                  type="text"
                  value={seatingTime}
                  onChange={e => setSeatingTime(e.target.value)}
                  placeholder="e.g. 07:00 PM"
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
                  required
                />
              </div>
            </div>

            {/* Guest Counts */}
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
                  <Sparkles className="w-3.5 h-3.5 text-rose-500" />
                  <span>4. Optional Dining Upgrades</span>
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
                          ? 'bg-rose-50 border-rose-400 text-slate-900 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 mt-0.5 ${
                        isSelected ? 'bg-rose-500 border-rose-500 text-white' : 'border-slate-300 bg-white'
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

          {/* DIETARY & SPECIAL INSTRUCTIONS */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 block">
              Guest Dietary Restrictions & Allergies
            </label>
            <input
              type="text"
              placeholder="e.g. 1 Guest with severe crustacean allergy, 1 vegetarian cover"
              value={dietaryRequirements}
              onChange={e => setDietaryRequirements(e.target.value)}
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
            <div className="text-xl sm:text-2xl font-black text-rose-400">
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
              className="px-6 py-2.5 rounded-xl text-xs font-black shadow-lg transition-all cursor-pointer flex items-center space-x-1.5 bg-rose-500 text-white hover:bg-rose-400"
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
