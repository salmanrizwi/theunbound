import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Destination, CityHub, PassengerClassification, HeroSearchParams, HeroDiscoveryFieldConfig } from '../../types';
import { 
  MapPin, 
  Building2, 
  Calendar, 
  Users, 
  Compass, 
  Search, 
  Sparkles, 
  ChevronDown, 
  Plus, 
  Minus, 
  Check, 
  Layers,
  ArrowRight,
  X
} from 'lucide-react';
import { navigateTo } from '../../services/portalRouter';
import { countingEngine } from '../../services/countingEngine';

interface HeroDiscoveryPanelProps {
  destinations: Destination[];
  selectedDestinationId?: string;
  selectedHubId?: string;
  config?: HeroDiscoveryFieldConfig;
  onSearch?: (params: HeroSearchParams) => void;
  className?: string;
  isCompact?: boolean;
}

const TRAVEL_STYLES = [
  'All Travel Styles',
  'Luxury Escapes',
  'Private Guided',
  'Family Journeys',
  'Rail & City Gateways',
  'Cultural Immersion',
  'Active & Adventure',
  'MICE & Corporate'
];

const PRODUCT_TYPES = [
  'All Products',
  'Tours & Sightseeing',
  'Day Activities',
  'Executive Transfers',
  'Private Guided',
  'Bespoke Packages',
  'Luxury Stays',
  'Visa Services'
];

export const HeroDiscoveryPanel: React.FC<HeroDiscoveryPanelProps> = ({
  destinations = [],
  selectedDestinationId,
  selectedHubId,
  config,
  onSearch,
  className = '',
  isCompact = false
}) => {
  // Destination state
  const [destinationId, setDestinationId] = useState<string>(selectedDestinationId || '');
  const [hubId, setHubId] = useState<string>(selectedHubId || '');

  // Dates state
  const tomorrow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  }, []);

  const returnDateDefault = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  }, []);

  const [startDate, setStartDate] = useState<string>(tomorrow);
  const [endDate, setEndDate] = useState<string>(returnDateDefault);

  // Travelers state based on TheUnbound PassengerClassification
  const [adults, setAdults] = useState<number>(2);
  const [cwb, setCwb] = useState<number>(0);
  const [cnb, setCnb] = useState<number>(0);
  const [infants, setInfants] = useState<number>(0);

  // Style & Product type
  const [travelStyle, setTravelStyle] = useState<string>(config?.defaultTravelStyle || 'All Travel Styles');
  const [productType, setProductType] = useState<string>('All Products');

  // Popover controls
  const [isTravelersOpen, setIsTravelersOpen] = useState<boolean>(false);
  const travelersRef = useRef<HTMLDivElement>(null);

  // Sync if props change
  useEffect(() => {
    if (selectedDestinationId) {
      setDestinationId(selectedDestinationId);
    }
  }, [selectedDestinationId]);

  useEffect(() => {
    if (selectedHubId) {
      setHubId(selectedHubId);
    }
  }, [selectedHubId]);

  // Close travelers popover on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (travelersRef.current && !travelersRef.current.contains(event.target as Node)) {
        setIsTravelersOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute trip duration
  const tripDurationDays = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    if (end < start) return 0;
    const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 1;
  }, [startDate, endDate]);

  // Validate dates
  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    if (endDate && val > endDate) {
      // Shift end date 5 days ahead
      const nextDate = new Date(val);
      nextDate.setDate(nextDate.getDate() + 7);
      setEndDate(nextDate.toISOString().split('T')[0]);
    }
  };

  const handleEndDateChange = (val: string) => {
    if (startDate && val < startDate) {
      setEndDate(startDate);
    } else {
      setEndDate(val);
    }
  };

  // Selected Destination Object
  const selectedDest = useMemo(() => {
    if (!destinationId) return undefined;
    return destinations.find(d => d.id === destinationId || d.slug === destinationId);
  }, [destinations, destinationId]);

  // Available Hubs cascading from selected Destination
  const availableHubs = useMemo(() => {
    if (!destinationId || destinationId === 'all') {
      // Return empty or top hubs across all destinations
      return [];
    }
    // Get from countingEngine / cities in destination
    if (selectedDest?.cities && selectedDest.cities.length > 0) {
      return selectedDest.cities.map(c => ({
        id: c.id,
        name: c.name,
        tagline: c.tagline
      }));
    }
    const filtered = countingEngine.getFilteredHubs({ destinationId });
    return filtered.map(h => ({
      id: h.id,
      name: h.name,
      tagline: h.tagline
    }));
  }, [destinationId, selectedDest]);

  // When destination changes, reset hub if invalid
  const handleDestinationChange = (newDestId: string) => {
    setDestinationId(newDestId);
    setHubId(''); // Reset cascading hub
  };

  // Passenger counts summary text
  const totalPax = adults + cwb + cnb + infants;
  const travelersSummaryText = useMemo(() => {
    const parts: string[] = [];
    if (adults > 0) parts.push(`${adults} Adult${adults > 1 ? 's' : ''}`);
    const childrenTotal = cwb + cnb;
    if (childrenTotal > 0) parts.push(`${childrenTotal} Child${childrenTotal > 1 ? 'ren' : ''}`);
    if (infants > 0) parts.push(`${infants} Infant${infants > 1 ? 's' : ''}`);
    return parts.length > 0 ? parts.join(', ') : '2 Adults';
  }, [adults, cwb, cnb, infants]);

  // Execute Search
  const handleExecuteSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const currentDest = selectedDest;
    const selectedHub = availableHubs.find(h => h.id === hubId);

    const passengerData: PassengerClassification = {
      adults,
      cwb,
      cnb,
      infants,
      cwbAges: Array(cwb).fill(8),
      cnbAges: Array(cnb).fill(4),
      infAges: Array(infants).fill(1),
      totalPax,
      displayText: `ADT: ${adults} | CWB: ${cwb} | CNB: ${cnb} | INF: ${infants}`
    };

    const searchParams: HeroSearchParams = {
      destinationId: currentDest?.id,
      destinationSlug: currentDest?.slug,
      destinationName: currentDest?.name,
      hubId: selectedHub?.id,
      hubName: selectedHub?.name,
      startDate,
      endDate,
      durationDays: tripDurationDays,
      travelers: passengerData,
      travelStyle: travelStyle === 'All Travel Styles' ? undefined : travelStyle,
      productType: productType === 'All Products' ? undefined : productType
    };

    if (onSearch) {
      onSearch(searchParams);
    } else {
      // Default: If destination is chosen, navigate to that destination page or quote builder
      if (currentDest?.slug) {
        navigateTo(`/destinations/${currentDest.slug}`);
      } else {
        navigateTo('/b2b/quote-builder');
      }
    }
  };

  // Quick launch AI Planner with current parameters
  const handleLaunchAiPlanner = () => {
    const destParam = selectedDest?.slug ? `?dest=${selectedDest.slug}` : '';
    navigateTo(`/b2b/ai-planner${destParam}`);
  };

  const showDestination = config?.showDestination !== false;
  const showHub = config?.showHub !== false;
  const showDates = config?.showDates !== false;
  const showTravelers = config?.showTravelers !== false;
  const showTravelStyle = config?.showTravelStyle === true;
  const showProductType = config?.showProductType === true;
  const showAiShortcut = config?.showAiPlannerShortcut !== false;
  const ctaButtonText = config?.ctaText || 'Search Inventory';

  return (
    <div className={`w-full max-w-5xl mx-auto ${className}`} id="hero-discovery-panel">
      {/* Outer Card with crisp light surface & controlled padding */}
      <div className="bg-white/95 backdrop-blur-xl rounded-xl sm:rounded-2xl p-2 sm:p-2.5 md:p-3 shadow-2xl border border-white/60 text-slate-900 transition-all">
        {/* Top Operational Pill & AI Quick Assist Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2 mb-2 border-b border-slate-100 text-xs">
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider bg-teal-50 text-[#008972] border border-teal-200/80">
              <Compass className="w-3 h-3 mr-1 text-[#00C6A6]" />
              DMC Trip Discovery Desk
            </span>
            <span className="text-[10px] sm:text-[11px] text-slate-500 hidden md:inline">
              Contracted wholesale itineraries & licensed ground services
            </span>
          </div>

          {showAiShortcut && (
            <button
              type="button"
              id="hero-ai-planner-quick-btn"
              onClick={handleLaunchAiPlanner}
              className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold text-slate-700 hover:text-[#008972] bg-slate-50 hover:bg-teal-50/80 border border-slate-200 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3 h-3 text-[#00C6A6]" />
              <span>Generate with AI in 30s</span>
              <ArrowRight className="w-3 h-3 ml-0.5 text-slate-400" />
            </button>
          )}
        </div>

        {/* Main Discovery Form */}
        <form onSubmit={handleExecuteSearch} className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2">
            {/* 1. Destination Field */}
            {showDestination && (
              <div className="lg:col-span-3 bg-slate-50/90 hover:bg-slate-100/90 border border-slate-200/90 rounded-xl p-2 transition-colors group">
                <label className="block text-[9px] font-extrabold uppercase tracking-wider text-slate-500 mb-0.5 flex items-center">
                  <MapPin className="w-3 h-3 mr-1 text-[#00C6A6]" />
                  Destination Gateway
                </label>
                <div className="relative">
                  <select
                    id="hero-search-destination-select"
                    value={destinationId}
                    onChange={(e) => handleDestinationChange(e.target.value)}
                    className="w-full bg-transparent text-xs sm:text-sm font-bold text-slate-900 focus:outline-none appearance-none cursor-pointer pr-5 py-0.5"
                  >
                    <option value="">All Global Gateways ({destinations.length})</option>
                    {destinations.map(d => (
                      <option key={d.id || d.slug} value={d.id || d.slug}>
                        {d.name} ({d.country})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none group-hover:text-slate-700" />
                </div>
                <div className="text-[9px] text-slate-400 truncate">
                  {selectedDest ? `${selectedDest.cities?.length || 0} Managed Hubs` : 'Select destination'}
                </div>
              </div>
            )}

            {/* 2. Cascading Hub/City Field */}
            {showHub && (
              <div className="lg:col-span-2 bg-slate-50/90 hover:bg-slate-100/90 border border-slate-200/90 rounded-xl p-2 transition-colors group">
                <label className="block text-[9px] font-extrabold uppercase tracking-wider text-slate-500 mb-0.5 flex items-center">
                  <Building2 className="w-3 h-3 mr-1 text-[#00C6A6]" />
                  Regional Hub
                </label>
                <div className="relative">
                  <select
                    id="hero-search-hub-select"
                    value={hubId}
                    onChange={(e) => setHubId(e.target.value)}
                    disabled={!destinationId || availableHubs.length === 0}
                    className="w-full bg-transparent text-xs sm:text-sm font-bold text-slate-900 focus:outline-none appearance-none cursor-pointer pr-5 py-0.5 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <option value="">{destinationId ? 'All Hubs & Cities' : 'Select Gateway'}</option>
                    {availableHubs.map(h => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none group-hover:text-slate-700" />
                </div>
                <div className="text-[9px] text-slate-400 truncate">
                  {destinationId ? (availableHubs.length > 0 ? `${availableHubs.length} operational hubs` : 'Direct operations') : 'Cascades from gateway'}
                </div>
              </div>
            )}

            {/* 3. Travel Dates Field */}
            {showDates && (
              <div className="lg:col-span-3 bg-slate-50/90 hover:bg-slate-100/90 border border-slate-200/90 rounded-xl p-2 transition-colors">
                <div className="flex items-center justify-between mb-0.5">
                  <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center">
                    <Calendar className="w-3 h-3 mr-1 text-[#00C6A6]" />
                    Travel Window
                  </label>
                  {tripDurationDays > 0 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-teal-100/80 text-[#008972]">
                      {tripDurationDays} {tripDurationDays === 1 ? 'Night' : 'Nights'}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <input
                      type="date"
                      id="hero-search-start-date"
                      value={startDate}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => handleStartDateChange(e.target.value)}
                      className="w-full bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer py-0.5"
                    />
                  </div>
                  <div>
                    <input
                      type="date"
                      id="hero-search-end-date"
                      value={endDate}
                      min={startDate || new Date().toISOString().split('T')[0]}
                      onChange={(e) => handleEndDateChange(e.target.value)}
                      className="w-full bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer py-0.5"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 4. Travelers Selector with Popover */}
            {showTravelers && (
              <div className="lg:col-span-2 relative" ref={travelersRef}>
                <div 
                  id="hero-search-travelers-trigger"
                  onClick={() => setIsTravelersOpen(!isTravelersOpen)}
                  className="bg-slate-50/90 hover:bg-slate-100/90 border border-slate-200/90 rounded-xl p-2 transition-colors cursor-pointer group h-full flex flex-col justify-between"
                >
                  <label className="block text-[9px] font-extrabold uppercase tracking-wider text-slate-500 mb-0.5 flex items-center pointer-events-none">
                    <Users className="w-3 h-3 mr-1 text-[#00C6A6]" />
                    Travelers / Pax
                  </label>
                  <div className="flex items-center justify-between">
                    <div className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                      {travelersSummaryText}
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 shrink-0 ml-1" />
                  </div>
                  <div className="text-[9px] text-slate-400">
                    {totalPax} Total Guests
                  </div>
                </div>

                {/* Travelers Popover (Passenger Classification) */}
                {isTravelersOpen && (
                  <div className="absolute top-full left-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 z-50 text-slate-900 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Passenger Classification</h4>
                        <p className="text-[10px] text-slate-500">TheUnbound standard B2B DMC pricing tiers</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsTravelersOpen(false)}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-3">
                      {/* Adults (11+ yrs) */}
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-slate-900">Adults (ADT)</div>
                          <div className="text-[10px] text-slate-500">Age 11+ years</div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => setAdults(Math.max(1, adults - 1))}
                            disabled={adults <= 1}
                            className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-6 text-center text-xs font-bold">{adults}</span>
                          <button
                            type="button"
                            onClick={() => setAdults(adults + 1)}
                            className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Child With Bed (CWB: 5 to <11) */}
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-slate-900">Child With Bed (CWB)</div>
                          <div className="text-[10px] text-slate-500">Age 5 to &lt;11 years</div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => setCwb(Math.max(0, cwb - 1))}
                            disabled={cwb <= 0}
                            className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-6 text-center text-xs font-bold">{cwb}</span>
                          <button
                            type="button"
                            onClick={() => setCwb(cwb + 1)}
                            className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Child No Bed (CNB: 2 to <5) */}
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-slate-900">Child No Bed (CNB)</div>
                          <div className="text-[10px] text-slate-500">Age 2 to &lt;5 years</div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => setCnb(Math.max(0, cnb - 1))}
                            disabled={cnb <= 0}
                            className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-6 text-center text-xs font-bold">{cnb}</span>
                          <button
                            type="button"
                            onClick={() => setCnb(cnb + 1)}
                            className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Infant (INF: < 2) */}
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-slate-900">Infant (INF)</div>
                          <div className="text-[10px] text-slate-500">Age &lt; 2 years</div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => setInfants(Math.max(0, infants - 1))}
                            disabled={infants <= 0}
                            className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-6 text-center text-xs font-bold">{infants}</span>
                          <button
                            type="button"
                            onClick={() => setInfants(infants + 1)}
                            className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-600">Total: {totalPax} Pax</span>
                      <button
                        type="button"
                        onClick={() => setIsTravelersOpen(false)}
                        className="px-4 py-1.5 rounded-lg bg-[#00C6A6] text-slate-950 text-xs font-bold hover:bg-[#00E5C0] transition-colors cursor-pointer"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 5. Search Action Button */}
            <div className="lg:col-span-2 flex items-stretch">
              <button
                type="submit"
                id="hero-discovery-submit-btn"
                className="w-full bg-[#00C6A6] hover:bg-[#00E5C0] text-slate-950 font-black px-4 py-2.5 rounded-xl shadow-lg shadow-teal-900/20 hover:shadow-teal-500/25 transition-all flex items-center justify-center space-x-1.5 active:scale-95 cursor-pointer text-xs sm:text-sm"
              >
                <Search className="w-4 h-4 text-slate-950" />
                <span>{ctaButtonText}</span>
              </button>
            </div>
          </div>

          {/* Optional Row 2: Travel Style & Product Type tags */}
          {(showTravelStyle || showProductType) && (
            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-3 text-xs">
              {showTravelStyle && (
                <div className="flex items-center space-x-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Style:</span>
                  <select
                    value={travelStyle}
                    onChange={(e) => setTravelStyle(e.target.value)}
                    className="bg-slate-100 text-slate-700 text-xs font-medium rounded-lg px-2 py-1 focus:outline-none border-none cursor-pointer"
                  >
                    {TRAVEL_STYLES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              )}

              {showProductType && (
                <div className="flex items-center space-x-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Product:</span>
                  <select
                    value={productType}
                    onChange={(e) => setProductType(e.target.value)}
                    className="bg-slate-100 text-slate-700 text-xs font-medium rounded-lg px-2 py-1 focus:outline-none border-none cursor-pointer"
                  >
                    {PRODUCT_TYPES.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
