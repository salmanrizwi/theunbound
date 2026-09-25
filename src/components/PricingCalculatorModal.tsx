import React, { useState, useMemo } from 'react';
import { Product, CurrencyCode, SUPPORTED_CURRENCIES } from '../types';
import { useAuth } from '../context/AuthContext';
import { useQuotation } from '../context/QuotationContext';
import { useRoster } from '../context/RosterContext';
import { calculateProductPrice, formatCurrency, convertCurrency } from '../services/pricingEngine';
import { canUserViewWholesaleRates, canUserAccessB2BInventory } from '../services/permissionEngine';
import { RosterCalendarPicker } from './RosterCalendarPicker';
import { 
  X, 
  Calculator, 
  Users, 
  Calendar, 
  DollarSign, 
  Sparkles, 
  ShieldAlert, 
  ShieldCheck,
  Lock,
  Percent, 
  Plus, 
  Check, 
  Info,
  Layers,
  ArrowRight,
  AlertOctagon,
  CalendarX,
  Building2
} from 'lucide-react';
import { RailJourneyModal } from './RailJourneyModal';
import { isRailProduct } from '../services/rail/JapanRailJourneyDataService';
import { isHotelService, isVisaService } from '../services/configuratorRoutingEngine';
import { HotelConfigurator } from './B2BAgentPortal/AddHotelToQuoteModal';
import { VisaServiceAndFacilitationConfigurator } from './Configurators/VisaServiceAndFacilitationConfigurator';

interface PricingCalculatorModalProps {
  product: Product;
  onClose: () => void;
  onAddedToQuote?: () => void;
}

export const PricingCalculatorModal: React.FC<PricingCalculatorModalProps> = ({
  product,
  onClose,
  onAddedToQuote
}) => {
  const { user, role, openAuthModal } = useAuth();

  // NON-NEGOTIABLE RULE: Japan Rail / Shinkansen products MUST only use Shinkansen Dynamic Journey Configurator
  if (isRailProduct(product)) {
    return (
      <RailJourneyModal
        product={product}
        portalOrigin={role === 'BUYER' ? 'BUYER' : 'B2B_AGENT'}
        onClose={onClose}
        onAddToQuote={() => {
          onClose();
          if (onAddedToQuote) onAddedToQuote();
        }}
      />
    );
  }

  // NON-NEGOTIABLE RULE: Hotel / Accommodation products MUST only use Hotel Configurator
  if (isHotelService(product)) {
    return (
      <HotelConfigurator
        hotel={{
          id: product.id,
          name: product.name,
          city: product.city || 'Tokyo',
          country: product.country || 'Japan',
          destinationId: product.destinationId || 'dest-japan',
          starRating: 5,
          roomTypes: [
            {
              id: `room-${product.id}`,
              name: 'Deluxe Room',
              rates: [
                {
                  id: `rate-${product.id}`,
                  name: 'Standard Wholesale Rate',
                  mealPlan: 'BB',
                  singleNetRate: product.adultNetPrice || 250,
                  doubleNetRate: product.adultNetPrice || 300,
                  tripleNetRate: (product.adultNetPrice || 300) * 1.4,
                  extraBedRate: 80,
                  childRate: 40,
                  markupPercent: product.defaultMarkupPercent || 15,
                  taxPercent: 10,
                  feePercent: 2.5,
                  currency: product.currency || 'USD',
                  validityFrom: '2026-01-01',
                  validityTo: '2026-12-31'
                }
              ]
            }
          ]
        } as any}
        isOpen={true}
        onClose={onClose}
        onSuccess={() => {
          onClose();
          if (onAddedToQuote) onAddedToQuote();
        }}
      />
    );
  }

  // NON-NEGOTIABLE RULE: Visa & Ancillary Services products MUST only use Visa & Ancillary Services Configurator
  if (isVisaService(product)) {
    return (
      <VisaServiceAndFacilitationConfigurator
        isOpen={true}
        itemOrProduct={product}
        portalOrigin={role === 'BUYER' ? 'BUYER' : 'B2B_AGENT'}
        onClose={onClose}
        onSuccess={() => {
          onClose();
          if (onAddedToQuote) onAddedToQuote();
        }}
      />
    );
  }

  const isAuthorized = canUserAccessB2BInventory(user).allowed;

  if (!isAuthorized) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="relative bg-white rounded-3xl max-w-lg w-full p-8 text-center space-y-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
          <button 
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 mx-auto">
            <Lock className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-black text-slate-900">Authorised B2B Agent Access Only</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              This dynamic pricing calculator is available exclusively to authorised B2B Agents. Please log in or register as a B2B Agent to continue.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={() => {
                onClose();
                openAuthModal('Sign in to calculate B2B wholesale rates.');
              }}
              className="flex-1 py-3 px-4 rounded-xl bg-[#00C6A6] hover:bg-[#00b094] text-slate-950 font-bold text-xs shadow-md transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              <span>Login as B2B Agent</span>
            </button>
            <button
              onClick={() => {
                onClose();
                openAuthModal('Register your agency to access wholesale pricing.');
              }}
              className="flex-1 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <Building2 className="w-4 h-4 text-[#00C6A6]" />
              <span>Register Agency</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { currency: globalCurrency, addProductToQuote } = useQuotation();
  const { checkDateAvailability, getNextAvailableDate } = useRoster();

  const [adults, setAdults] = useState<number>(2);
  const [childrenCount, setChildrenCount] = useState<number>(0);
  const [infantsCount, setInfantsCount] = useState<number>(0);
  const [travelDate, setTravelDate] = useState<string>(() => {
    const d = new Date(Date.now() + 86400000 * 14);
    return d.toISOString().split('T')[0];
  });
  const [targetCurrency, setTargetCurrency] = useState<CurrencyCode>(globalCurrency);
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [agentNotes, setAgentNotes] = useState<string>('');
  const [showCalendarPicker, setShowCalendarPicker] = useState<boolean>(true);

  const availability = checkDateAvailability(product.id, travelDate, adults + childrenCount);

  const calculation = useMemo(() => {
    return calculateProductPrice(product, {
      productId: product.id,
      adults,
      children: childrenCount,
      infants: infantsCount,
      travelDate,
      targetCurrency,
      selectedAddonIds,
      customMarkupPercent: product.defaultMarkupPercent,
      customDiscountPercent: 0
    });
  }, [
    product,
    adults,
    childrenCount,
    infantsCount,
    travelDate,
    targetCurrency,
    selectedAddonIds
  ]);

  const toggleAddon = (addonId: string) => {
    setSelectedAddonIds(prev =>
      prev.includes(addonId) ? prev.filter(id => id !== addonId) : [...prev, addonId]
    );
  };

  const handleAddToQuotation = () => {
    addProductToQuote(product, {
      adults,
      children: childrenCount,
      infants: infantsCount,
      travelDate,
      selectedAddonIds
    });
    if (onAddedToQuote) onAddedToQuote();
    onClose();
  };

  const canViewWholesale = canUserViewWholesaleRates(user);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div 
        id="pricing-calculator-dialog"
        className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 max-w-4xl w-full overflow-hidden flex flex-col max-h-[94dvh] sm:max-h-[90vh]"
      >
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 sm:p-6 flex items-start justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#00C6A6]/20 border border-[#00C6A6]/40 flex items-center justify-center text-[#00E5C0]">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#00C6A6]">
                  DMC Dynamic Pricing Engine
                </span>
                <span className="text-slate-500">•</span>
                <span className="text-xs text-slate-300 font-mono">{product.sku}</span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold font-sans text-white leading-tight">
                {product.name}
              </h2>
            </div>
          </div>

          <button
            id="close-calc-modal-btn"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
          {/* Left Column: Calculation Parameters */}
          <div className="lg:col-span-7 space-y-6">
            {/* Passenger Selection */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2.5 flex items-center space-x-1.5">
                <Users className="w-4 h-4 text-[#008972]" />
                <span>Passenger Manifest (Pax)</span>
              </label>

              <div className="grid grid-cols-3 gap-3">
                {/* Adults */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-slate-700">Adults (12+)</span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {formatCurrency(calculation.adultPricePerPax, targetCurrency)} / pax
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setAdults(Math.max(1, adults - 1))}
                      className="w-7 h-7 rounded bg-white border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 flex items-center justify-center cursor-pointer"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={product.maxPax || 20}
                      value={adults}
                      onChange={(e) => setAdults(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full text-center font-bold text-sm bg-white border border-slate-200 rounded py-1"
                    />
                    <button
                      onClick={() => setAdults(Math.min(product.maxPax || 20, adults + 1))}
                      className="w-7 h-7 rounded bg-white border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 flex items-center justify-center cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Children */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-slate-700">Children (3-11)</span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {formatCurrency(calculation.childPricePerPax, targetCurrency)} / pax
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setChildrenCount(Math.max(0, childrenCount - 1))}
                      className="w-7 h-7 rounded bg-white border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 flex items-center justify-center cursor-pointer"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={childrenCount}
                      onChange={(e) => setChildrenCount(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full text-center font-bold text-sm bg-white border border-slate-200 rounded py-1"
                    />
                    <button
                      onClick={() => setChildrenCount(childrenCount + 1)}
                      className="w-7 h-7 rounded bg-white border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 flex items-center justify-center cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Infants */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-slate-700">Infants (0-2)</span>
                    <span className="text-[10px] text-emerald-600 font-mono">Free</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setInfantsCount(Math.max(0, infantsCount - 1))}
                      className="w-7 h-7 rounded bg-white border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 flex items-center justify-center cursor-pointer"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={0}
                      max={5}
                      value={infantsCount}
                      onChange={(e) => setInfantsCount(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full text-center font-bold text-sm bg-white border border-slate-200 rounded py-1"
                    />
                    <button
                      onClick={() => setInfantsCount(infantsCount + 1)}
                      className="w-7 h-7 rounded bg-white border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 flex items-center justify-center cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Travel Date & Roster Availability Calendar */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
                  <Calendar className="w-4 h-4 text-[#008972]" />
                  <span>Travel Date & DMC Roster Availability</span>
                </label>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowCalendarPicker(!showCalendarPicker)}
                    className="text-[11px] font-bold text-[#008972] hover:underline cursor-pointer"
                  >
                    {showCalendarPicker ? 'Hide Calendar' : 'Show Roster Calendar'}
                  </button>
                </div>
              </div>

              {/* Interactive Roster Calendar Component */}
              {showCalendarPicker && (
                <RosterCalendarPicker
                  productId={product.id}
                  selectedDate={travelDate}
                  onSelectDate={(newDate) => setTravelDate(newDate)}
                  paxCount={adults + childrenCount}
                  minDate={product.validityFrom}
                  maxDate={product.validityTo}
                />
              )}

              {/* Manual Date Input & Settlement Currency */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Selected Travel Date
                  </label>
                  <input
                    type="date"
                    value={travelDate}
                    min={product.validityFrom}
                    max={product.validityTo}
                    onChange={(e) => setTravelDate(e.target.value)}
                    className={`w-full bg-slate-50 border rounded-xl p-2.5 text-xs font-semibold text-slate-900 focus:ring-1 focus:bg-white ${
                      availability.isAvailable
                        ? 'border-slate-200 focus:ring-[#00C6A6]'
                        : 'border-rose-300 bg-rose-50 text-rose-900 focus:ring-rose-400'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center space-x-1">
                    <DollarSign className="w-3 h-3 text-[#008972]" />
                    <span>Settlement Currency</span>
                  </label>
                  <select
                    value={targetCurrency}
                    onChange={(e) => setTargetCurrency(e.target.value as CurrencyCode)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-900 focus:ring-1 focus:ring-[#00C6A6] focus:bg-white cursor-pointer"
                  >
                    {SUPPORTED_CURRENCIES.map(c => (
                      <option key={c.code} value={c.code}>{c.code} ({c.symbol}) - {c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Optional Add-ons */}
            {product.addons && (product.addons || []).length > 0 && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center space-x-1.5">
                  <Sparkles className="w-4 h-4 text-[#008972]" />
                  <span>Optional Experience Upgrades</span>
                </label>
                <div className="space-y-2">
                  {(product.addons || []).map((addon) => {
                    const isSelected = selectedAddonIds.includes(addon.id);
                    const convertedAddonPrice = convertCurrency(addon.pricePerPax, addon.currency, targetCurrency);
                    return (
                      <div
                        key={addon.id}
                        onClick={() => toggleAddon(addon.id)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start justify-between ${
                          isSelected
                            ? 'bg-[#00C6A6]/10 border-[#00C6A6] ring-1 ring-[#00C6A6]'
                            : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start space-x-2.5">
                          <div className={`w-5 h-5 rounded mt-0.5 flex items-center justify-center border ${
                            isSelected ? 'bg-[#00C6A6] border-[#00C6A6] text-slate-950' : 'bg-white border-slate-300'
                          }`}>
                            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900">{addon.name}</p>
                            <p className="text-[11px] text-slate-500 leading-snug">{addon.description}</p>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-slate-900 shrink-0 ml-3">
                          +{formatCurrency(convertedAddonPrice, targetCurrency)}/pax
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quotation Policy & Guaranteed Rates Notice */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#00C6A6]" />
                  <span>DMC Contracted Travel Terms</span>
                </span>
                <span className="inline-flex items-center space-x-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                  <Lock className="w-2.5 h-2.5" />
                  <span>{(role === 'ADMIN' || role === 'DMC_STAFF') ? 'Wholesale Protected' : 'Rate Guaranteed'}</span>
                </span>
              </div>

              <p className="text-[11px] text-slate-500 leading-snug">
                All itinerary quotes are computed from direct DMC contracts with guaranteed wholesale parity and full ground logistics support.
              </p>
            </div>
          </div>

          {/* Right Column: Quotation Summary Breakdown Table */}
          <div className="lg:col-span-5 bg-slate-900 text-white rounded-2xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-[#00C6A6]">
                  Quotation Summary
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {targetCurrency}
                </span>
              </div>

              {/* Breakdown Rows */}
              <div className="space-y-2.5 text-xs">
                {/* Capacity-Based Vehicle / Yacht Info Badge */}
                {calculation.pricingMethod === 'capacity_based' && (
                  <div className="bg-teal-950/40 p-2.5 rounded-xl border border-teal-500/30 text-[11px] text-teal-200 mb-2 space-y-1">
                    <div className="flex items-center justify-between font-bold text-[#00E5C0]">
                      <span>{product.category === 'Private Yacht' ? 'Private Yacht Charter' : 'Capacity-Based Fleet Allocation'}</span>
                      <span>{calculation.vehicleCount} {product.category === 'Private Yacht' ? (calculation.vehicleCount === 1 ? 'Yacht' : 'Yachts') : (calculation.vehicleCount === 1 ? 'Vehicle' : 'Vehicles')}</span>
                    </div>
                    <div className="flex justify-between text-slate-400 text-[10px]">
                      <span>Max Capacity per unit: {calculation.maxSeatsPerVehicle || product.vehicleConfig?.maxSeats || product.maxPax || 7} Pax</span>
                      <span>Total Allocation: {calculation.vehicleCount} Unit(s)</span>
                    </div>
                  </div>
                )}

                {/* Adults */}
                <div className="flex justify-between text-slate-300">
                  <span>Adult Participants ({adults} × {formatCurrency(calculation.adultPricePerPax, targetCurrency)})</span>
                  <span className="font-mono">{formatCurrency(calculation.adultsSubtotalSelling, targetCurrency)}</span>
                </div>

                {/* Children */}
                {childrenCount > 0 && (
                  <div className="flex justify-between text-slate-300">
                    <span>Child Participants ({childrenCount} × {formatCurrency(calculation.childPricePerPax, targetCurrency)})</span>
                    <span className="font-mono">{formatCurrency(calculation.childrenSubtotalSelling, targetCurrency)}</span>
                  </div>
                )}

                {/* Infants */}
                {infantsCount > 0 && (
                  <div className="flex justify-between text-slate-300">
                    <span>Infant Participants ({infantsCount} × {formatCurrency(calculation.infantsSubtotalSelling / infantsCount, targetCurrency)})</span>
                    <span className="font-mono">{formatCurrency(calculation.infantsSubtotalSelling, targetCurrency)}</span>
                  </div>
                )}

                {/* Addons */}
                {calculation.addonsSubtotalSelling > 0 && (
                  <div className="flex justify-between text-slate-300">
                    <span>Selected Experiences & Add-ons ({selectedAddonIds.length})</span>
                    <span className="font-mono">+{formatCurrency(calculation.addonsSubtotalSelling, targetCurrency)}</span>
                  </div>
                )}

                {/* Internal DMC Profit & Margin (Strictly Visible ONLY to Admin and DMC Staff) */}
                {(role === 'ADMIN' || role === 'DMC_STAFF') && (
                  <div className="mt-3 pt-3 border-t border-slate-800 space-y-1.5 text-[11px]">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Internal DMC Management Data</p>
                    <div className="flex justify-between text-slate-400">
                      <span>Contract Base Net:</span>
                      <span className="font-mono">{formatCurrency(calculation.totalNetCost, targetCurrency)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Contract Markup ({product.defaultMarkupPercent}%):</span>
                      <span className="font-mono">+{formatCurrency(calculation.markupAmount, targetCurrency)}</span>
                    </div>
                    {calculation.serviceFee > 0 && (
                      <div className="flex justify-between text-slate-400">
                        <span>Operational Service Fee:</span>
                        <span className="font-mono">+{formatCurrency(calculation.serviceFee, targetCurrency)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-400">
                      <span>Destination Tax & VAT ({product.taxPercent}%):</span>
                      <span className="font-mono">+{formatCurrency(calculation.taxAmount, targetCurrency)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[#00E5C0] font-bold pt-1 border-t border-slate-800">
                      <span className="flex items-center space-x-1">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>Gross Margin:</span>
                      </span>
                      <span className="font-mono">{formatCurrency(calculation.dmcMarginAmount, targetCurrency)} ({(Number(calculation.dmcMarginPercent) || 0).toFixed(1)}%)</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Total Selling Price Banner */}
            <div className="pt-4 border-t border-slate-800 mt-6">
              <div className="flex items-baseline justify-between mb-1">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Final Selling Price
                  </span>
                  <p className="text-2xl font-black text-[#00E5C0] font-sans">
                    {formatCurrency(calculation.finalTotalSellingPrice, targetCurrency)}
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">Per Person:</span>
                  <span className="text-sm font-bold text-white font-mono">
                    {formatCurrency(calculation.pricePerPerson, targetCurrency)}
                  </span>
                </div>
              </div>

              {/* Roster Availability Warning Notice if Unavailable */}
              {!availability.isAvailable && (
                <div className="mt-3 p-3 rounded-xl bg-rose-950/80 border border-rose-700 text-rose-200 text-xs space-y-2">
                  <div className="flex items-start space-x-2">
                    <CalendarX className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="font-bold text-rose-100 block">
                        Booking Locked: Date is unavailable in DMC Roster
                      </span>
                      <p className="text-[11px] text-rose-300 mt-0.5 leading-snug">
                        {availability.reason}
                      </p>
                    </div>
                  </div>

                  <div className="pt-1.5 border-t border-rose-800/80 flex items-center justify-between">
                    <span className="text-[10px] text-rose-400">
                      Product cannot be quoted or reserved on this day.
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const next = getNextAvailableDate(product.id, travelDate);
                        if (next) setTravelDate(next);
                      }}
                      className="text-[11px] font-bold text-[#00E5C0] hover:underline cursor-pointer flex items-center space-x-1"
                    >
                      <span>Jump to Next Open Date</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}

              {/* Action Button */}
              <button
                id="btn-add-to-quote-from-calc"
                disabled={!availability.isAvailable}
                onClick={handleAddToQuotation}
                className={`w-full mt-4 font-bold py-3.5 px-4 rounded-xl text-sm transition-all flex items-center justify-center space-x-2 ${
                  availability.isAvailable
                    ? 'bg-[#00C6A6] hover:bg-[#008972] text-slate-950 shadow-md shadow-[#00C6A6]/20 cursor-pointer hover:scale-102'
                    : 'bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed opacity-90'
                }`}
              >
                {availability.isAvailable ? (
                  <>
                    <span>Add to Multi-Product Quotation</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 text-rose-400" />
                    <span>Unavailable in Roster — Cannot Be Booked</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
