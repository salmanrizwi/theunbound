import React, { useState, useMemo } from 'react';
import { Product, QuoteItem, CurrencyCode } from '../../types';
import { useQuotation } from '../../context/QuotationContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, calculateProductPrice } from '../../services/pricingEngine';
import { generateConfigurationIdentity, getActiveUpsellsForProduct, createUpsellSnapshot } from '../../services/configuratorRegistry';
import { 
  X, 
  Ticket, 
  Calendar, 
  Clock, 
  Users, 
  MapPin, 
  Sparkles, 
  ShieldCheck, 
  Check, 
  Plus, 
  Minus, 
  User,
  QrCode,
  Info
} from 'lucide-react';

export interface TicketConfiguratorProps {
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
 * THEUNBOUND — TICKET CONFIGURATOR (Section 9)
 * Database-Driven Attraction Pass & Admission Voucher Engine
 * ============================================================================
 * 
 * Rules:
 * - Product Management defines Admission Tiers, Redemption Rules, and Pricing.
 * - Layer 1: Read-only master information (Redemption method, cutoff, inclusions).
 * - Layer 2: Genuine selectable options (Ticket Tiers from product, Upsells).
 * - Layer 3: Transaction details (Visit Date, Quantity / Pax, Lead Traveler).
 * - Price is calculated strictly via the central Pricing Engine.
 */
export const TicketConfigurator: React.FC<TicketConfiguratorProps> = ({
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

  // Available Ticket Tiers from Master Product
  const tierOptions = useMemo(() => {
    if (product?.ticketConfig?.ticketTiers && product.ticketConfig.ticketTiers.length > 0) {
      return product.ticketConfig.ticketTiers.map(t => ({
        id: t.id,
        name: t.name,
        adultPrice: t.sellingPriceStartingFrom || (t.adultNetPrice ? Math.round(t.adultNetPrice * 1.25) : 45),
        childPrice: t.childNetPrice ? Math.round(t.childNetPrice * 1.25) : Math.round((t.sellingPriceStartingFrom || 45) * 0.6)
      }));
    }
    const defaultAdult = product?.sellingPriceStartingFrom || (product?.adultNetPrice ? Math.round(product.adultNetPrice * 1.25) : 45);
    const defaultChild = product?.childNetPrice ? Math.round(product.childNetPrice * 1.25) : Math.round(defaultAdult * 0.6);
    return [
      { 
        id: 'standard', 
        name: product?.ticketConfig?.ticketType ? `${product.ticketConfig.ticketType.replace(/_/g, ' ')}` : 'Standard General Admission',
        adultPrice: defaultAdult,
        childPrice: defaultChild
      }
    ];
  }, [product]);

  // Form State (Layer 3: Transaction Details)
  const [visitDate, setVisitDate] = useState<string>(
    existingConfig.visitDate || initialTravelDate || (itemOrProduct as QuoteItem)?.travelDate || new Date().toISOString().split('T')[0]
  );
  const [timeSlot, setTimeSlot] = useState<string>(
    existingConfig.timeSlot || initialServiceTime || (itemOrProduct as QuoteItem)?.serviceTime || '10:00 AM'
  );
  const [ticketTier, setTicketTier] = useState<string>(
    existingConfig.ticketTier || tierOptions[0]?.name || 'Standard Admission'
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

  const [leadTravelerName, setLeadTravelerName] = useState<string>(
    existingConfig.leadTravelerName || ''
  );
  const [leadTravelerEmail, setLeadTravelerEmail] = useState<string>(
    existingConfig.leadTravelerEmail || ''
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

  // Centralized Authoritative Pricing Calculation
  const selectedTier = tierOptions.find(t => t.name === ticketTier) || tierOptions[0];

  const pricing = useMemo(() => {
    if (!product) return { grossSellingPrice: 0, finalPrice: 0, baseSelling: 0, addonsCost: 0, currency };
    const calc = calculateProductPrice(product, {
      productId: product.id,
      adults,
      children,
      infants: 0,
      travelDate: visitDate,
      targetCurrency: currency,
      user,
      selectedAddonIds: selectedAddons,
      selectedUpsellIds: selectedAddons
    });

    return {
      grossSellingPrice: calc.finalTotalSellingPrice,
      finalPrice: calc.finalTotalSellingPrice,
      adultPrice: calc.adultPricePerPax,
      childPrice: calc.childPricePerPax,
      baseAdultTotal: calc.adultsSubtotalSelling,
      baseChildTotal: calc.childrenSubtotalSelling,
      addonsCost: calc.addonsSubtotalSelling || 0,
      currency: calc.currency,
      calcResult: calc
    };
  }, [selectedTier, product, adults, children, visitDate, selectedAddons, currency, user]);

  if (!isOpen || !product) return null;

  const handleSave = () => {
    const configIdentity = generateConfigurationIdentity(
      'Tickets',
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
      visitDate,
      timeSlot,
      ticketTier,
      adults,
      children,
      infants,
      leadTravelerName,
      leadTravelerEmail,
      redemptionMethod: product.ticketConfig?.redemptionMethod || 'INSTANT_QR_VOUCHER',
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
        travelDate: visitDate,
        serviceTime: timeSlot,
        notes: `${ticketTier} (${timeSlot}) ${leadTravelerName ? `| Lead: ${leadTravelerName}` : ''}. ${specialInstructions}`,
        selectedAddonIds: selectedAddons,
        selectedUpsellIds: selectedAddons,
        selectedUpsellSnapshots: selectedUpsellSnapshots as any
      });
    } else {
      addProductToQuote(product, {
        adults,
        children,
        infants,
        travelDate: visitDate,
        serviceTime: timeSlot,
        notes: `${ticketTier} (${timeSlot}) ${leadTravelerName ? `| Lead: ${leadTravelerName}` : ''}. ${specialInstructions}`,
        selectedAddonIds: selectedAddons,
        selectedUpsellIds: selectedAddons,
        selectedUpsellSnapshots: selectedUpsellSnapshots as any,
        configuration_id: configIdentity.configuration_id,
        configuration_snapshot: configurationPayload,
        pricing_snapshot: pricing,
        category: 'Tickets',
        service_type: 'TICKET_CONFIGURATOR',
        metadata: {
          configuration_payload: configurationPayload,
          configurator_type: 'TICKET_CONFIGURATOR'
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
            <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
              <Ticket className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-400 text-slate-950">
                  Ticket Configurator
                </span>
                <span className="text-xs text-slate-400 font-medium truncate">
                  {product.destinationName || product.country || 'Japan'} • {product.city || 'Attraction'}
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
                1. Attraction & Voucher Specifications
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

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 block uppercase font-bold flex items-center gap-1">
                  <QrCode className="w-3 h-3 text-purple-500" />
                  <span>Redemption</span>
                </span>
                <span className="text-slate-900 font-bold truncate block mt-0.5">
                  {product.ticketConfig?.redemptionMethod ? product.ticketConfig.redemptionMethod.replace(/_/g, ' ') : 'Instant QR Voucher'}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 block uppercase font-bold flex items-center gap-1">
                  <Clock className="w-3 h-3 text-purple-500" />
                  <span>Cutoff Policy</span>
                </span>
                <span className="text-slate-900 font-bold block mt-0.5">
                  {product.ticketConfig?.bookingCutoffHours ? `${product.ticketConfig.bookingCutoffHours}h Prior` : 'Instant Access'}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200 col-span-2 sm:col-span-1">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Category Tier</span>
                <span className="text-slate-900 font-bold truncate block mt-0.5">
                  {product.ticketConfig?.ticketType ? product.ticketConfig.ticketType.replace(/_/g, ' ') : 'General Entry Pass'}
                </span>
              </div>
            </div>
          </div>

          {/* LAYER 2: CONFIGURABLE TICKET TIERS */}
          {tierOptions.length > 1 && (
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                2. Select Admission Tier
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {tierOptions.map(tier => {
                  const isSelected = ticketTier === tier.name;
                  return (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => setTicketTier(tier.name)}
                      className={`p-3 rounded-xl border text-left flex items-start space-x-2.5 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-purple-50 border-purple-400 text-purple-950 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                        isSelected ? 'bg-purple-600 border-purple-600 text-white' : 'border-slate-300 bg-white'
                      }`}>
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-xs leading-snug">{tier.name}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {formatCurrency(tier.adultPrice, currency)} / Adult
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* LAYER 3: TRAVEL / BOOKING DETAILS */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-4">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              3. Date & Ticket Quantity
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-purple-500" />
                  <span>Entry Date *</span>
                </label>
                <input
                  type="date"
                  value={visitDate}
                  onChange={e => setVisitDate(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-purple-500" />
                  <span>Entry Time Slot / Session</span>
                </label>
                <input
                  type="text"
                  value={timeSlot}
                  onChange={e => setTimeSlot(e.target.value)}
                  placeholder="e.g. 10:00 AM — Morning Admission"
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
                  required
                />
              </div>
            </div>

            {/* Ticket Quantities */}
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

            {/* Lead Traveler Details for Voucher Issuance */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Lead Traveler Full Name</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. John Doe (as per Passport)"
                  value={leadTravelerName}
                  onChange={e => setLeadTravelerName(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Lead Traveler Email (for Digital Pass Delivery)
                </label>
                <input
                  type="email"
                  placeholder="e.g. traveler@example.com"
                  value={leadTravelerEmail}
                  onChange={e => setLeadTravelerEmail(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900"
                />
              </div>
            </div>
          </div>

          {/* LAYER 2: OPTIONAL EXPERIENCE UPGRADES / UPSELLS */}
          {availableUpsells.length > 0 && (
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-500" />
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
                          ? 'bg-purple-50 border-purple-400 text-purple-950 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 mt-0.5 ${
                        isSelected ? 'bg-purple-600 border-purple-600 text-white' : 'border-slate-300 bg-white'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-xs leading-snug">{upsell.name}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          +{formatCurrency(upsell.price, currency)} {upsell.priceType === 'PER_BOOKING' ? '(Total)' : '/ ticket'}
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
              Special Handling / Wheelchair Access Requests
            </label>
            <input
              type="text"
              placeholder="e.g. Wheelchair accessible entry required"
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
            <div className="text-xl sm:text-2xl font-black text-purple-400">
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
              className="px-6 py-2.5 rounded-xl text-xs font-black shadow-lg transition-all cursor-pointer flex items-center space-x-1.5 bg-purple-500 text-white hover:bg-purple-400"
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
