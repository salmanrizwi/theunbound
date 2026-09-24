import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  JapanRailJourney, 
  JapanRailSegment, 
  JourneyPortalOrigin, 
  JapanRailJourneyPassengerConfig 
} from '../../types/japanRailJourney';
import { Product, CurrencyCode, UserRole, QuoteItem } from '../../types';
import { RailCarType, RailServiceGroup, RailPricingResult } from '../../types/rail';
import { japanRailJourneyService } from '../../services/rail/JapanRailJourneyService';
import { japanRailJourneyDataService } from '../../services/rail/JapanRailJourneyDataService';
import { formatCurrency } from '../../services/currencyEngine';
import { useQuotation } from '../../context/QuotationContext';
import { useAuth } from '../../context/AuthContext';
import { 
  Train, 
  ArrowRightLeft, 
  Calendar, 
  Clock, 
  Users, 
  ShieldCheck, 
  Info, 
  CheckCircle2, 
  Sparkles, 
  X, 
  Sliders, 
  ChevronRight, 
  MapPin, 
  Search, 
  HelpCircle,
  Briefcase,
  Layers,
  FileSpreadsheet,
  AlertCircle,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Compass,
  Check,
  Building,
  RotateCcw,
  Zap,
  ArrowRight
} from 'lucide-react';

export interface JapanRailJourneyConfiguratorProps {
  portalOrigin?: JourneyPortalOrigin;
  initialProduct?: Product;
  onClose: () => void;
  onAddToQuote?: (item: QuoteItem) => void;
  onInstantBook?: (product: Product, pricingResult: RailPricingResult) => void;
  initialOriginStationId?: string;
  initialDestinationStationId?: string;
  existingQuoteItemId?: string;
  existingJourneySnapshot?: any;
}

export const JapanRailJourneyConfigurator: React.FC<JapanRailJourneyConfiguratorProps> = ({
  portalOrigin = 'BUYER',
  initialProduct,
  onClose,
  onAddToQuote,
  onInstantBook,
  initialOriginStationId = 'JP-ST-TOKYO',
  initialDestinationStationId = 'JP-ST-KYOTO',
  existingQuoteItemId,
  existingJourneySnapshot
}) => {
  const { user } = useAuth();
  const { currency, setCurrency, setItems, setIsQuoteDrawerOpen } = useQuotation();

  // Determine initial car class from product
  const defaultProductId = initialProduct?.id === 'RAIL-JP-GREEN-RESERVED' 
    ? 'RAIL-JP-GREEN-RESERVED' 
    : 'RAIL-JP-ORD-RESERVED';

  // Initialize the shared dynamic journey
  const [journey, setJourney] = useState<JapanRailJourney>(() => {
    return japanRailJourneyService.createDefaultJourney({
      portalOrigin: (portalOrigin || 'BUYER') as JourneyPortalOrigin,
      userRole: user?.role,
      currency: typeof currency === 'string' ? currency : 'JPY',
      initialOriginId: initialOriginStationId,
      initialDestId: initialDestinationStationId,
      initialProductId: defaultProductId
    });
  });

  const [activeDayNumber, setActiveDayNumber] = useState<number>(1);
  const [isSuccessFeedback, setIsSuccessFeedback] = useState<boolean>(false);
  const [isValidationDetailsOpen, setIsValidationDetailsOpen] = useState<boolean>(false);

  // Search state for stations (keyed by segmentId + type)
  const [activeStationDropdown, setActiveStationDropdown] = useState<{
    segmentId: string;
    type: 'ORIGIN' | 'DESTINATION';
  } | null>(null);
  const [stationSearchQuery, setStationSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveStationDropdown(null);
        setStationSearchQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtered stations for active search
  const filteredStations = useMemo(() => {
    return japanRailJourneyDataService.searchStations(stationSearchQuery).slice(0, 12);
  }, [stationSearchQuery]);

  // Role permissions
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'TEAM_MEMBER' || portalOrigin === 'ADMIN_CMS' || portalOrigin === 'PRODUCT_MANAGEMENT';
  const isAgent = user?.role === 'B2B_AGENT' || user?.role === 'AGENT' || portalOrigin === 'B2B_QUOTE_BUILDER' || portalOrigin === 'B2B_AGENT';

  // Handler: Add Segment
  const handleAddSegment = () => {
    const updated = japanRailJourneyService.addSegment(journey, user?.role);
    setJourney(updated);
  };

  // Handler: Remove Segment
  const handleRemoveSegment = (segmentId: string) => {
    const updated = japanRailJourneyService.removeSegment(journey, segmentId, user?.role);
    setJourney(updated);
  };

  // Handler: Reorder Segment
  const handleMoveSegment = (index: number, direction: 'UP' | 'DOWN') => {
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    const updated = japanRailJourneyService.reorderSegments(journey, index, targetIndex, user?.role);
    setJourney(updated);
  };

  // Handler: Swap Segment Stations
  const handleSwapStations = (segmentId: string) => {
    const updated = japanRailJourneyService.swapSegmentStations(journey, segmentId, user?.role);
    setJourney(updated);
  };

  // Handler: Select Station
  const handleSelectStation = (segmentId: string, type: 'ORIGIN' | 'DESTINATION', stationId: string) => {
    const updates = type === 'ORIGIN' 
      ? { origin: { stationId } as any } 
      : { destination: { stationId } as any };
    const updated = japanRailJourneyService.updateSegment(journey, segmentId, updates, user?.role);
    setJourney(updated);
    setActiveStationDropdown(null);
    setStationSearchQuery('');
  };

  // Handler: Update Segment Field
  const handleUpdateSegment = (segmentId: string, updates: Partial<JapanRailSegment>) => {
    const updated = japanRailJourneyService.updateSegment(journey, segmentId, updates, user?.role);
    setJourney(updated);
  };

  // Handler: Update Passengers
  const handleUpdatePax = (paxUpdates: Partial<JapanRailJourneyPassengerConfig>) => {
    const newPax = { ...journey.passengers, ...paxUpdates };
    const updated = japanRailJourneyService.updatePassengers(journey, newPax, user?.role);
    setJourney(updated);
  };

  // Handler: Change Currency
  const handleCurrencyChange = (newCurr: CurrencyCode) => {
    setCurrency(newCurr);
    const updated = japanRailJourneyService.setCurrency(journey, newCurr, user?.role);
    setJourney(updated);
  };

  // Handler: Apply Preset Route
  const handleApplyPreset = (preset: 'GOLDEN_ROUTE' | 'CLASSIC_KANSAI' | 'HIROSHIMA_EXTENSION' | 'ONE_WAY') => {
    const updated = japanRailJourneyService.applyPresetRoute(journey, preset, user?.role);
    setJourney(updated);
  };

  // Final Action: Add to Quote
  const handleAddToQuote = () => {
    if (!journey.validation.isValid) {
      setIsValidationDetailsOpen(true);
      return;
    }

    const quoteItem = japanRailJourneyService.convertToQuoteItem(journey, activeDayNumber);

    // Save to quotation context
    setItems(prev => {
      if (existingQuoteItemId) {
        return prev.map(it => it.id === existingQuoteItemId ? quoteItem : it);
      }
      return [...prev, quoteItem];
    });

    if (onAddToQuote) {
      onAddToQuote(quoteItem);
    }

    setIsSuccessFeedback(true);
    setTimeout(() => {
      setIsSuccessFeedback(false);
      onClose();
    }, 1200);
  };

  // Final Action: Instant Book (Buyer Portal)
  const handleInstantBook = () => {
    if (!journey.validation.isValid) {
      setIsValidationDetailsOpen(true);
      return;
    }

    const firstSegment = journey.segments[0];
    const targetProd = initialProduct || japanRailJourneyDataService.getRailProduct(firstSegment?.productId || 'RAIL-JP-ORD-RESERVED')!;
    
    if (onInstantBook && firstSegment) {
      onInstantBook(targetProd, firstSegment.pricing);
    } else {
      handleAddToQuote();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94dvh] sm:max-h-[92dvh]">
        
        {/* ========================================================================= */}
        {/* HEADER BAR (Role-Aware Context) */}
        {/* ========================================================================= */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white px-3.5 sm:px-5 py-3 sm:py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#00C6A6]/20 border border-[#00C6A6]/40 flex items-center justify-center text-[#00C6A6] shadow-inner shrink-0">
              <Train className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-widest text-[#00C6A6] bg-[#00C6A6]/10 px-1.5 sm:px-2 py-0.5 rounded border border-[#00C6A6]/30">
                  {portalOrigin === 'BUYER' ? 'Buyer Portal' : 
                   portalOrigin === 'B2B_QUOTE_BUILDER' ? 'B2B Builder' :
                   portalOrigin === 'B2B_AGENT' ? 'B2B Agent' :
                   portalOrigin === 'PRODUCT_MANAGEMENT' ? 'Inventory' : 'Admin CMS'}
                </span>
                <span className="text-slate-500">•</span>
                <span className="text-[11px] sm:text-xs text-slate-300 font-medium truncate">
                  Authoritative Rail Engine
                </span>
              </div>
              <h2 className="text-sm sm:text-lg font-black text-white font-sans tracking-tight flex items-center gap-2 mt-0.5 truncate">
                <span className="truncate">Shinkansen Dynamic Journey Configurator</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
                  {journey.segments.length} {journey.segments.length === 1 ? 'Sector' : 'Sectors'}
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Currency Switcher */}
            <div className="hidden sm:flex items-center bg-slate-800/90 border border-slate-700 rounded-lg px-2.5 py-1 text-xs">
              <span className="text-slate-400 font-bold mr-1.5">Currency:</span>
              <select
                value={journey.currency}
                onChange={(e) => handleCurrencyChange(e.target.value as CurrencyCode)}
                className="bg-transparent text-[#00E5C0] font-black outline-none cursor-pointer"
              >
                {(['USD', 'EUR', 'GBP', 'AUD', 'SGD', 'INR', 'JPY'] as CurrencyCode[]).map(c => (
                  <option key={c} value={c} className="bg-slate-900 text-white font-bold">{c}</option>
                ))}
              </select>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* QUICK PRESET BAR & PASSENGERS STRIP */}
        {/* ========================================================================= */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Presets */}
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <Compass className="w-3.5 h-3.5 text-[#00C6A6]" /> Quick Route:
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => handleApplyPreset('ONE_WAY')}
                className="text-xs px-2.5 py-1 rounded-md font-bold transition-all bg-white border border-slate-200 text-slate-700 hover:border-[#00C6A6] hover:text-[#00A88F] shadow-xs cursor-pointer"
              >
                One-Way (Tokyo ➔ Kyoto)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('GOLDEN_ROUTE')}
                className="text-xs px-2.5 py-1 rounded-md font-bold transition-all bg-white border border-slate-200 text-slate-700 hover:border-[#00C6A6] hover:text-[#00A88F] shadow-xs cursor-pointer"
              >
                Golden Route (3 Sectors)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('HIROSHIMA_EXTENSION')}
                className="text-xs px-2.5 py-1 rounded-md font-bold transition-all bg-white border border-slate-200 text-slate-700 hover:border-[#00C6A6] hover:text-[#00A88F] shadow-xs cursor-pointer"
              >
                Hiroshima Grand Tour (4 Sectors)
              </button>
            </div>
          </div>

          {/* Passenger Counters */}
          <div className="flex items-center space-x-4 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center space-x-1.5 text-xs">
              <Users className="w-3.5 h-3.5 text-[#00C6A6]" />
              <span className="font-bold text-slate-700">Adults:</span>
              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  disabled={journey.passengers.adults <= 1}
                  onClick={() => handleUpdatePax({ adults: Math.max(1, journey.passengers.adults - 1) })}
                  className="w-5 h-5 rounded bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 disabled:opacity-40 cursor-pointer"
                >
                  -
                </button>
                <span className="font-black text-slate-900 w-4 text-center">{journey.passengers.adults}</span>
                <button
                  type="button"
                  onClick={() => handleUpdatePax({ adults: journey.passengers.adults + 1 })}
                  className="w-5 h-5 rounded bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-1.5 text-xs">
              <span className="font-bold text-slate-700">Children:</span>
              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  disabled={journey.passengers.children <= 0}
                  onClick={() => handleUpdatePax({ children: Math.max(0, journey.passengers.children - 1) })}
                  className="w-5 h-5 rounded bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 disabled:opacity-40 cursor-pointer"
                >
                  -
                </button>
                <span className="font-black text-slate-900 w-4 text-center">{journey.passengers.children}</span>
                <button
                  type="button"
                  onClick={() => handleUpdatePax({ children: journey.passengers.children + 1 })}
                  className="w-5 h-5 rounded bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-1.5 text-xs">
              <span className="font-bold text-slate-500">Infants:</span>
              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  disabled={journey.passengers.infants <= 0}
                  onClick={() => handleUpdatePax({ infants: Math.max(0, journey.passengers.infants - 1) })}
                  className="w-5 h-5 rounded bg-slate-100 text-slate-500 font-bold hover:bg-slate-200 disabled:opacity-40 cursor-pointer"
                >
                  -
                </button>
                <span className="font-bold text-slate-600 w-4 text-center">{journey.passengers.infants}</span>
                <button
                  type="button"
                  onClick={() => handleUpdatePax({ infants: journey.passengers.infants + 1 })}
                  className="w-5 h-5 rounded bg-slate-100 text-slate-500 font-bold hover:bg-slate-200 cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* VALIDATION WARNINGS / ERRORS BANNER */}
        {/* ========================================================================= */}
        {(!journey.validation.isValid || journey.validation.warnings.length > 0) && (
          <div className={`px-5 py-2.5 text-xs border-b ${
            !journey.validation.isValid 
              ? 'bg-rose-50 text-rose-800 border-rose-200' 
              : 'bg-amber-50 text-amber-800 border-amber-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertCircle className={`w-4 h-4 shrink-0 ${!journey.validation.isValid ? 'text-rose-600' : 'text-amber-600'}`} />
                <span className="font-bold">
                  {!journey.validation.isValid 
                    ? `Journey Validation Alert: ${journey.validation.errors[0]}` 
                    : `Route Notice: ${journey.validation.warnings[0]}`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsValidationDetailsOpen(!isValidationDetailsOpen)}
                className="font-bold underline hover:opacity-80 cursor-pointer ml-3 shrink-0"
              >
                {isValidationDetailsOpen ? 'Hide Details' : 'View All Notices'}
              </button>
            </div>

            {isValidationDetailsOpen && (
              <div className="mt-2 pt-2 border-t border-slate-200 space-y-1">
                {journey.validation.errors.map((err, i) => (
                  <div key={i} className="text-rose-700 font-medium flex items-start gap-1.5">
                    <span className="font-bold">• Error:</span> {err}
                  </div>
                ))}
                {journey.validation.warnings.map((warn, i) => (
                  <div key={i} className="text-amber-700 font-medium flex items-start gap-1.5">
                    <span className="font-bold">• Notice:</span> {warn}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* DYNAMIC JOURNEY SECTORS LIST (Scrollable Center Area) */}
        {/* ========================================================================= */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-4 bg-slate-50/50 modal-body-scroll">
          
          {/* Visual Route Flow Banner */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center space-x-2 flex-wrap text-sm font-bold text-slate-800">
              <span className="text-slate-400 font-semibold text-xs uppercase tracking-wider">Route Path:</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {journey.segments.map((seg, idx) => (
                  <React.Fragment key={seg.segmentId}>
                    {idx === 0 && (
                      <span className="px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 font-extrabold border border-indigo-100 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-indigo-500" /> {seg.origin.stationName}
                      </span>
                    )}
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    <span className="px-2.5 py-1 rounded-md bg-[#00C6A6]/10 text-[#008F77] font-extrabold border border-[#00C6A6]/30 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-[#00C6A6]" /> {seg.destination.stationName}
                    </span>
                  </React.Fragment>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-3 text-xs text-slate-500 font-medium">
              <span>Dates: <strong className="text-slate-800">{journey.startDate}</strong> to <strong className="text-slate-800">{journey.endDate}</strong></span>
              <span>•</span>
              <span>Total Est. Travel: <strong className="text-slate-800">{Math.round(journey.segments.reduce((acc, s) => acc + (s.pricing.estimatedDurationMinutes || 0), 0) / 60)}h {journey.segments.reduce((acc, s) => acc + (s.pricing.estimatedDurationMinutes || 0), 0) % 60}m</strong></span>
            </div>
          </div>

          {/* List of Dynamic Segments */}
          <div className="space-y-3">
            {journey.segments.map((seg, index) => {
              const segHasErrors = (journey.validation.segmentErrors[seg.segmentId] || []).length > 0;
              const segHasWarnings = (journey.validation.segmentWarnings[seg.segmentId] || []).length > 0;

              return (
                <div 
                  key={seg.segmentId}
                  className={`bg-white rounded-xl border transition-all p-4 shadow-xs ${
                    segHasErrors 
                      ? 'border-rose-300 ring-2 ring-rose-100' 
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* Segment Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                    <div className="flex items-center space-x-2">
                      <span className="w-6 h-6 rounded-full bg-slate-900 text-white font-black text-xs flex items-center justify-center">
                        {index + 1}
                      </span>
                      <h3 className="text-sm font-black text-slate-900 font-sans">
                        Sector {index + 1}: {seg.origin.stationName} → {seg.destination.stationName}
                      </h3>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                        seg.carClass === 'Green' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {seg.carClass} Car
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        {seg.pricing.seasonLabel || 'Regular Season'}
                      </span>
                    </div>

                    {/* Segment Action Buttons */}
                    <div className="flex items-center space-x-1">
                      {/* Move Up */}
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => handleMoveSegment(index, 'UP')}
                        title="Move Sector Up"
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded hover:bg-slate-100 cursor-pointer"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      {/* Move Down */}
                      <button
                        type="button"
                        disabled={index === journey.segments.length - 1}
                        onClick={() => handleMoveSegment(index, 'DOWN')}
                        title="Move Sector Down"
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded hover:bg-slate-100 cursor-pointer"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      {/* Swap stations */}
                      <button
                        type="button"
                        onClick={() => handleSwapStations(seg.segmentId)}
                        title="Swap Origin & Destination"
                        className="p-1 text-indigo-500 hover:text-indigo-700 rounded hover:bg-indigo-50 cursor-pointer"
                      >
                        <ArrowRightLeft className="w-4 h-4" />
                      </button>
                      {/* Delete segment (if > 1) */}
                      {journey.segments.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSegment(seg.segmentId)}
                          title="Remove Sector"
                          className="p-1 text-rose-400 hover:text-rose-600 rounded hover:bg-rose-50 cursor-pointer ml-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Segment Configuration Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                    
                    {/* Origin Station Picker */}
                    <div className="md:col-span-3 relative">
                      <label className="text-[11px] font-black uppercase text-slate-500 block mb-1">
                        Origin Station
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveStationDropdown({ segmentId: seg.segmentId, type: 'ORIGIN' });
                          setStationSearchQuery('');
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg border border-slate-200 bg-white hover:border-[#00C6A6] text-xs font-bold text-slate-900 flex items-center justify-between cursor-pointer"
                      >
                        <div className="truncate">
                          <span className="block font-black">{seg.origin.stationName}</span>
                          <span className="text-[10px] text-slate-400">{seg.origin.stationCode} • {seg.origin.city}</span>
                        </div>
                        <Search className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
                      </button>

                      {/* Dropdown Menu */}
                      {activeStationDropdown?.segmentId === seg.segmentId && activeStationDropdown.type === 'ORIGIN' && (
                        <div ref={dropdownRef} className="absolute left-0 top-full mt-1 w-72 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-2">
                          <input
                            type="text"
                            autoFocus
                            value={stationSearchQuery}
                            onChange={(e) => setStationSearchQuery(e.target.value)}
                            placeholder="Search station or city..."
                            className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md outline-none focus:border-[#00C6A6] mb-2"
                          />
                          <div className="max-h-48 overflow-y-auto space-y-1">
                            {filteredStations.map(st => (
                              <button
                                key={st.stationId}
                                type="button"
                                onClick={() => handleSelectStation(seg.segmentId, 'ORIGIN', st.stationId)}
                                className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-100 text-xs flex items-center justify-between cursor-pointer"
                              >
                                <div>
                                  <div className="font-bold text-slate-900">{st.displayName}</div>
                                  <div className="text-[10px] text-slate-400">{st.city} • Line: {st.shinkansenLine?.split(' ')[0]}</div>
                                </div>
                                <span className="font-mono text-[10px] text-[#00A88F] font-bold">{st.stationCode}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Destination Station Picker */}
                    <div className="md:col-span-3 relative">
                      <label className="text-[11px] font-black uppercase text-slate-500 block mb-1">
                        Arrival Destination
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveStationDropdown({ segmentId: seg.segmentId, type: 'DESTINATION' });
                          setStationSearchQuery('');
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg border border-slate-200 bg-white hover:border-[#00C6A6] text-xs font-bold text-slate-900 flex items-center justify-between cursor-pointer"
                      >
                        <div className="truncate">
                          <span className="block font-black">{seg.destination.stationName}</span>
                          <span className="text-[10px] text-slate-400">{seg.destination.stationCode} • {seg.destination.city}</span>
                        </div>
                        <Search className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
                      </button>

                      {/* Dropdown Menu */}
                      {activeStationDropdown?.segmentId === seg.segmentId && activeStationDropdown.type === 'DESTINATION' && (
                        <div ref={dropdownRef} className="absolute left-0 top-full mt-1 w-72 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-2">
                          <input
                            type="text"
                            autoFocus
                            value={stationSearchQuery}
                            onChange={(e) => setStationSearchQuery(e.target.value)}
                            placeholder="Search station or city..."
                            className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md outline-none focus:border-[#00C6A6] mb-2"
                          />
                          <div className="max-h-48 overflow-y-auto space-y-1">
                            {filteredStations.map(st => (
                              <button
                                key={st.stationId}
                                type="button"
                                onClick={() => handleSelectStation(seg.segmentId, 'DESTINATION', st.stationId)}
                                className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-100 text-xs flex items-center justify-between cursor-pointer"
                              >
                                <div>
                                  <div className="font-bold text-slate-900">{st.displayName}</div>
                                  <div className="text-[10px] text-slate-400">{st.city} • Line: {st.shinkansenLine?.split(' ')[0]}</div>
                                </div>
                                <span className="font-mono text-[10px] text-[#00A88F] font-bold">{st.stationCode}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Travel Date & Time */}
                    <div className="md:col-span-3 grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-black uppercase text-slate-500 block mb-1">
                          Date
                        </label>
                        <input
                          type="date"
                          value={seg.travelDate}
                          onChange={(e) => handleUpdateSegment(seg.segmentId, { travelDate: e.target.value })}
                          className="w-full px-2.5 py-2 text-xs font-bold border border-slate-200 rounded-lg outline-none focus:border-[#00C6A6] bg-white cursor-pointer"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-black uppercase text-slate-500 block mb-1">
                          Dep Time
                        </label>
                        <input
                          type="time"
                          value={seg.departureTime}
                          onChange={(e) => handleUpdateSegment(seg.segmentId, { departureTime: e.target.value })}
                          className="w-full px-2.5 py-2 text-xs font-bold border border-slate-200 rounded-lg outline-none focus:border-[#00C6A6] bg-white cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Class & Service */}
                    <div className="md:col-span-3 grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-black uppercase text-slate-500 block mb-1">
                          Car Class
                        </label>
                        <select
                          value={seg.carClass}
                          onChange={(e) => handleUpdateSegment(seg.segmentId, { carClass: e.target.value as RailCarType })}
                          className="w-full px-2 py-2 text-xs font-bold border border-slate-200 rounded-lg outline-none focus:border-[#00C6A6] bg-white cursor-pointer"
                        >
                          <option value="Ordinary">Ordinary Car</option>
                          <option value="Green">Green (First Class)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-black uppercase text-slate-500 block mb-1">
                          Service Tier
                        </label>
                        <select
                          value={seg.serviceGroup}
                          onChange={(e) => handleUpdateSegment(seg.segmentId, { serviceGroup: e.target.value as RailServiceGroup })}
                          className="w-full px-2 py-2 text-xs font-bold border border-slate-200 rounded-lg outline-none focus:border-[#00C6A6] bg-white cursor-pointer"
                        >
                          <option value="NOZOMI_MIZUHO">Nozomi / Mizuho</option>
                          <option value="HIKARI_KODAMA_SAKURA_TSUBAME">Hikari / Kodama</option>
                        </select>
                      </div>
                    </div>

                  </div>

                  {/* Secondary Preferences & Sector Price Summary */}
                  <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                    
                    {/* Seat Preference */}
                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] font-bold text-slate-500">Seat Preference:</span>
                      <select
                        value={seg.seatPreference}
                        onChange={(e) => handleUpdateSegment(seg.segmentId, { seatPreference: e.target.value as any })}
                        className="px-2 py-1 text-xs font-semibold border border-slate-200 rounded-md outline-none bg-slate-50 cursor-pointer"
                      >
                        <option value="MT_FUJI">Mt. Fuji Side (Seats D & E)</option>
                        <option value="WINDOW">Window Seat (A or E)</option>
                        <option value="AISLE">Aisle Seat (C or D)</option>
                        <option value="PAIR">Adjacent Pair Seats</option>
                        <option value="OVERSIZED_BAGGAGE">Oversized Baggage Area (Rearmost Row)</option>
                        <option value="ANY">No Preference / Any Available</option>
                      </select>
                    </div>

                    {/* Sector Price Badge */}
                    <div className="flex items-center space-x-3 ml-auto">
                      <span className="text-slate-400 font-medium">
                        Est. Duration: <strong className="text-slate-700">{seg.formattedDuration}</strong>
                      </span>
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-400 mr-1.5">Sector Fare:</span>
                        <span className="font-black text-slate-900 font-sans text-sm">
                          {formatCurrency(seg.pricing.finalSellingPriceTargetCurrency, journey.currency)}
                        </span>
                        <span className="text-[10px] text-slate-400 ml-1 font-mono">
                          (¥{seg.pricing.finalSellingPriceJPY.toLocaleString()})
                        </span>
                      </div>
                    </div>

                  </div>

                  {/* Sector Validation Error if any */}
                  {segHasErrors && (
                    <div className="mt-2 p-2 rounded bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
                      {journey.validation.segmentErrors[seg.segmentId][0]}
                    </div>
                  )}

                </div>
              );
            })}
          </div>

          {/* Add Sector Button */}
          <div className="text-center pt-1">
            <button
              type="button"
              onClick={handleAddSegment}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl border-2 border-dashed border-[#00C6A6]/60 hover:border-[#00C6A6] text-[#00A88F] hover:bg-[#00C6A6]/5 font-black text-xs transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>ADD NEXT JOURNEY SECTOR</span>
            </button>
          </div>

        </div>

        {/* ========================================================================= */}
        {/* FOOTER BAR (Pricing Summary & Action Buttons) */}
        {/* ========================================================================= */}
        <div className="bg-slate-900 text-white px-3.5 sm:px-5 py-3 sm:py-4 border-t border-slate-800 shrink-0 pb-safe">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4">
            
            {/* Left: Day Selector (for Quote integration) */}
            <div className="flex items-center space-x-3 w-full md:w-auto justify-between md:justify-start">
              {(portalOrigin === 'B2B_QUOTE_BUILDER' || portalOrigin === 'B2B_AGENT') && (
                <div className="flex items-center space-x-1.5 bg-slate-800 border border-slate-700 px-2.5 sm:px-3 py-1.5 rounded-xl">
                  <Calendar className="w-3.5 h-3.5 text-[#00E5C0]" />
                  <span className="text-[10px] sm:text-[11px] font-bold text-slate-300">Day:</span>
                  <select
                    value={activeDayNumber}
                    onChange={(e) => setActiveDayNumber(Number(e.target.value))}
                    className="bg-transparent text-white text-xs font-black outline-none cursor-pointer"
                  >
                    {[1,2,3,4,5,6,7,8,9,10,11,12,14,15,20].map(d => (
                      <option key={d} value={d} className="bg-slate-900 text-white">Day {d}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Admin/Product Management Rate Breakdown Pill */}
              {isAdmin && (
                <div className="hidden lg:flex items-center space-x-2 text-[10px] text-slate-400 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700">
                  <Layers className="w-3 h-3 text-[#00C6A6]" />
                  <span>Cost: <strong className="text-white">¥{journey.pricing.totalSupplierCostJPY.toLocaleString()}</strong></span>
                  <span>•</span>
                  <span>Margin: <strong className="text-[#00E5C0]">¥{journey.pricing.totalMarkupJPY.toLocaleString()} ({journey.pricing.appliedMarkupPercent}%)</strong></span>
                </div>
              )}
            </div>

            {/* Right: Total Pricing & CTAs */}
            <div className="flex items-center justify-between md:justify-end space-x-3 sm:space-x-4 w-full md:w-auto">
              
              <div className="text-left md:text-right">
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Total Journey ({journey.segments.length} {journey.segments.length === 1 ? 'Sector' : 'Sectors'})
                </span>
                <div className="flex items-baseline md:justify-end gap-1 sm:gap-1.5">
                  <span className="text-lg sm:text-2xl font-black text-[#00E5C0] font-sans">
                    {formatCurrency(journey.pricing.finalSellingPriceTargetCurrency, journey.currency)}
                  </span>
                  <span className="text-[10px] sm:text-xs font-mono text-slate-400">
                    (¥{journey.pricing.finalSellingPriceJPY.toLocaleString()})
                  </span>
                </div>
                <span className="text-[9px] sm:text-[10px] text-slate-400 block">
                  Avg. {formatCurrency(journey.pricing.perPersonTargetCurrency, journey.currency)} / pax
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl border border-slate-700 text-slate-300 font-bold text-xs hover:bg-slate-800 transition-all cursor-pointer shrink-0"
                >
                  Cancel
                </button>

                {portalOrigin === 'BUYER' ? (
                  <button
                    type="button"
                    id="btn-buyer-add-rail-journey"
                    disabled={!journey.validation.isValid}
                    onClick={handleInstantBook}
                    className={`px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs font-black transition-all flex items-center space-x-1 sm:space-x-1.5 shadow-lg cursor-pointer whitespace-nowrap shrink-0 ${
                      journey.validation.isValid
                        ? 'bg-[#00C6A6] hover:bg-[#00E5C0] text-slate-950 shadow-[#00C6A6]/20'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                    }`}
                  >
                    {isSuccessFeedback ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-slate-950 shrink-0" />
                        <span>Added to Cart!</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 shrink-0" />
                        <span>ADD TO CART</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    id="btn-b2b-add-rail-quote"
                    disabled={!journey.validation.isValid}
                    onClick={handleAddToQuote}
                    className={`px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs font-black transition-all flex items-center space-x-1 sm:space-x-1.5 shadow-lg cursor-pointer whitespace-nowrap shrink-0 ${
                      journey.validation.isValid
                        ? 'bg-[#00C6A6] hover:bg-[#00E5C0] text-slate-950 shadow-[#00C6A6]/20'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                    }`}
                  >
                    {isSuccessFeedback ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-slate-950 shrink-0" />
                        <span>Quote Updated!</span>
                      </>
                    ) : (
                      <>
                        <FileSpreadsheet className="w-4 h-4 shrink-0" />
                        <span className="hidden sm:inline">ADD JOURNEY TO QUOTE</span>
                        <span className="sm:hidden">ADD TO QUOTE</span>
                      </>
                    )}
                  </button>
                )}
              </div>

            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
