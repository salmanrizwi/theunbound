import React, { useState, useMemo } from 'react';
import { CityHub, DestinationCity } from '../types';
import { countingEngine } from '../services/countingEngine';
import { 
  MapPin, 
  Layers, 
  Sparkles, 
  Building2, 
  Compass, 
  ArrowRight, 
  Info, 
  X, 
  CheckCircle2, 
  ChevronRight, 
  SlidersHorizontal,
  Globe2,
  Calendar,
  Eye
} from 'lucide-react';

interface CityHubsProps {
  hubs?: CityHub[];
  cities?: DestinationCity[];
  selectedCity: string;
  onSelectCity: (cityIdOrName: string) => void;
  destinationName?: string;
  parentRegionName?: string;
  totalProductsCount?: number;
}

export const CityHubs: React.FC<CityHubsProps> = ({
  hubs = [],
  cities = [],
  selectedCity,
  onSelectCity,
  destinationName,
  parentRegionName,
  totalProductsCount
}) => {
  const [selectedSubRegion, setSelectedSubRegion] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'sequence' | 'grouped'>('sequence');
  const [inspectingHub, setInspectingHub] = useState<CityHub | null>(null);

  // Normalize incoming data into rich CityHub array with synchronized live metrics
  const normalizedHubs: CityHub[] = useMemo(() => {
    const rawList: CityHub[] = (hubs && hubs.length > 0)
      ? [...hubs]
      : (cities || []).map((c, idx) => ({
          id: c.id,
          destinationId: destinationName?.toLowerCase() || 'dest',
          destinationName: destinationName || 'Destination',
          regionId: '',
          regionName: '',
          name: c.name,
          tagline: c.tagline || 'Contracted DMC Gateway & Touring Center',
          description: 'Major regional gateway with verified direct DMC contracts, hotel allocations, and local licensed guides.',
          heroImage: c.image || 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?q=80&w=1200&auto=format&fit=crop',
          images: [c.image || 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?q=80&w=1200&auto=format&fit=crop'],
          productCount: c.productCount || 0,
          hotelCount: 3,
          displayOrder: idx + 1,
          highlights: ['Local Sightseeing', 'Private Transit', 'Curated Excursions'],
          isPublished: true,
          status: 'ACTIVE'
        }));

    // Deduplicate by hub id / name
    const seenIds = new Set<string>();
    const uniqueRawList = rawList.filter(h => {
      const key = (h.id || h.name || '').trim().toLowerCase();
      if (!key || seenIds.has(key)) return false;
      seenIds.add(key);
      return true;
    });

    return uniqueRawList
      .map(hub => {
        const metrics = countingEngine.getHubMetrics(hub.id || hub.name);
        return {
          ...hub,
          productCount: metrics.productsCount,
          hotelCount: metrics.hotelsCount
        };
      })
      .sort((a, b) => (a.displayOrder || 1) - (b.displayOrder || 1));
  }, [hubs, cities, destinationName]);

  // Extract unique sub-regions
  const subRegions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    normalizedHubs.forEach((h, idx) => {
      const regName = h.regionName || 'General Region';
      const regId = h.regionId || `subreg-${regName.toLowerCase().replace(/\s+/g, '-')}-${idx}`;
      if (!map.has(regName)) {
        map.set(regName, { id: regId, name: regName, count: 0 });
      }
      map.get(regName)!.count += 1;
    });
    return Array.from(map.values());
  }, [normalizedHubs]);

  // Filtered hubs based on sub-region filter
  const displayedHubs = useMemo(() => {
    if (selectedSubRegion === 'all') {
      return normalizedHubs;
    }
    return normalizedHubs.filter(h => 
      (h.regionName && h.regionName === selectedSubRegion) || 
      (h.regionId && h.regionId === selectedSubRegion)
    );
  }, [normalizedHubs, selectedSubRegion]);

  // Grouped hubs by sub-region
  const groupedHubs = useMemo(() => {
    const groups: { regionName: string; regionId: string; hubs: CityHub[] }[] = [];
    normalizedHubs.forEach(hub => {
      const rName = hub.regionName || 'Core Touring Territory';
      let grp = groups.find(g => g.regionName === rName);
      if (!grp) {
        grp = { regionName: rName, regionId: hub.regionId || rName, hubs: [] };
        groups.push(grp);
      }
      grp.hubs.push(hub);
    });
    return groups;
  }, [normalizedHubs]);

  if (normalizedHubs.length === 0) {
    return null;
  }

  return (
    <div className="mb-8 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs">
      {/* 1. Header with Breadcrumb Hierarchy & View Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          {/* Hierarchy Breadcrumb Tag */}
          <div className="flex items-center flex-wrap gap-1.5 text-xs font-bold text-slate-500 mb-1">
            <span className="text-[#008972] bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 flex items-center space-x-1">
              <Globe2 className="w-3 h-3 text-[#00C6A6]" />
              <span>{parentRegionName || 'DMC Network'}</span>
            </span>
            <ChevronRight className="w-3 h-3 text-slate-400" />
            <span className="text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md font-extrabold">
              {destinationName || 'Destination'}
            </span>
            <ChevronRight className="w-3 h-3 text-slate-400" />
            <span className="text-[#00C6A6] font-semibold flex items-center space-x-1">
              <Layers className="w-3 h-3" />
              <span>{normalizedHubs.length} Hierarchical Hubs Tagged</span>
            </span>
          </div>

          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-2">
            <MapPin className="w-5 h-5 text-[#00C6A6]" />
            <span>Touring Hubs & Regional Gateways in {destinationName || 'Destination'}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Organized in curated touring order. Click any hub card to instantly filter local tours, private transfers, and contracted hotels.
          </p>
        </div>

        {/* View Controls & Clear Selection */}
        <div className="flex items-center flex-wrap gap-2 shrink-0">
          {selectedCity && (
            <button
              onClick={() => onSelectCity('')}
              className="inline-flex items-center space-x-1 text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg font-bold border border-emerald-200 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear Hub Filter (Showing All {normalizedHubs.length})</span>
            </button>
          )}

          {/* Sequence vs Grouped Toggle */}
          {subRegions.length > 1 && (
            <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setViewMode('sequence')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'sequence'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Touring Order (1–{normalizedHubs.length})
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grouped')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'grouped'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                By Region ({subRegions.length})
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. Sub-Region Filter Pills (if multiple sub-regions exist) */}
      {subRegions.length > 1 && viewMode === 'sequence' && (
        <div className="flex items-center gap-1.5 overflow-x-auto py-3 no-scrollbar border-b border-slate-100 mb-4">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 flex items-center space-x-1 mr-1">
            <SlidersHorizontal className="w-3 h-3" />
            <span>Region Filter:</span>
          </span>
          <button
            type="button"
            onClick={() => setSelectedSubRegion('all')}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              selectedSubRegion === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Hubs ({normalizedHubs.length})
          </button>
          {subRegions.map((sr, srIdx) => (
            <button
              key={`subreg-btn-${sr.id || sr.name}-${srIdx}`}
              type="button"
              onClick={() => setSelectedSubRegion(sr.name)}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedSubRegion === sr.name
                  ? 'bg-[#00C6A6] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {sr.name} ({sr.count})
            </button>
          ))}
        </div>
      )}

      {/* 3. Hubs Grid: Sequence Mode */}
      {viewMode === 'sequence' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 pt-3">
          {displayedHubs.map((hub, hubIdx) => {
            const isSelected = selectedCity.toLowerCase() === hub.name.toLowerCase() || 
                               selectedCity.toLowerCase() === hub.id.toLowerCase() ||
                               (hub.name.includes(selectedCity) && selectedCity !== '');

            return (
              <div
                key={`hub-seq-${hub.id || hub.name}-${hubIdx}`}
                id={`hub-card-${hub.id}`}
                className={`group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 border bg-white flex flex-col ${
                  isSelected
                    ? 'ring-2 ring-[#00C6A6] border-transparent shadow-md scale-[1.02]'
                    : 'border-slate-200 hover:border-[#00C6A6]/60 hover:shadow-md'
                }`}
                onClick={() => onSelectCity(isSelected ? '' : hub.name)}
              >
                {/* Image & Badges */}
                <div className="aspect-16/10 w-full relative overflow-hidden bg-slate-100">
                  <img
                    src={hub.heroImage || (hub.images && hub.images[0]) || 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?q=80&w=800&auto=format&fit=crop'}
                    alt={hub.name}
                    className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/30 to-transparent" />

                  {/* Top Badges: Sequence Order & Region */}
                  <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-1">
                    {/* Order Tag */}
                    <span className="bg-slate-900/90 backdrop-blur-xs text-white text-[10px] font-black px-2 py-0.5 rounded-md border border-white/20 shadow-xs flex items-center space-x-1">
                      <span className="text-[#00C6A6]">#{hub.displayOrder || 1}</span>
                      <span>Hub</span>
                    </span>

                    {/* Quick Preview Eye */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setInspectingHub(hub);
                      }}
                      className="bg-black/60 hover:bg-[#00C6A6] text-white p-1 rounded-md transition-colors shadow-xs"
                      title="View Hub Dossier & Logistics"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Bottom Text Over Image */}
                  <div className="absolute bottom-2 left-3 right-3 text-white">
                    {hub.regionName && (
                      <p className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider truncate mb-0.5">
                        {hub.regionName}
                      </p>
                    )}
                    <h3 className="text-base font-extrabold leading-tight text-white drop-shadow-xs truncate">
                      {hub.name}
                    </h3>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-3 flex-1 flex flex-col justify-between space-y-2.5">
                  <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                    {hub.tagline || hub.description || 'Contracted touring hub with local guide networks.'}
                  </p>

                  {/* Highlights Badges */}
                  {hub.highlights && (hub.highlights || []).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {(hub.highlights || []).slice(0, 2).map((hl, hIdx) => (
                        <span
                          key={hIdx}
                          className="bg-slate-100 text-slate-600 text-[10px] px-1.5 py-0.5 rounded font-medium truncate max-w-full"
                        >
                          • {hl}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Inventory Metrics & Action Footer */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <div className="flex items-center space-x-2 text-slate-500 font-semibold">
                      <span className="flex items-center space-x-1">
                        <Compass className="w-3 h-3 text-[#00C6A6]" />
                        <span>{hub.productCount === 1 ? '1 Tour' : `${hub.productCount || 0} Tours`}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <Building2 className="w-3 h-3 text-blue-500" />
                        <span>{hub.hotelCount === 1 ? '1 Stay' : `${hub.hotelCount || 0} Stays`}</span>
                      </span>
                    </div>

                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                      isSelected 
                        ? 'bg-[#00C6A6] text-white' 
                        : 'text-[#008972] group-hover:text-[#00C6A6]'
                    }`}>
                      {isSelected ? 'Selected' : 'Filter →'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* 4. Hubs Grid: Grouped by Sub-Region Mode */
        <div className="space-y-6 pt-3">
          {groupedHubs.map((group, gIdx) => (
            <div key={`group-sec-${group.regionId || group.regionName}-${gIdx}`} className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#00C6A6]" />
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    {group.regionName}
                  </h3>
                  <span className="text-xs font-semibold text-slate-400 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                    {(group.hubs || []).length} Hubs
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
                {(group.hubs || []).map((hub, hIdx) => {
                  const isSelected = selectedCity.toLowerCase() === hub.name.toLowerCase() || 
                                     selectedCity.toLowerCase() === hub.id.toLowerCase();
                  return (
                    <div
                      key={`grouped-hub-${hub.id || hub.name}-${hIdx}`}
                      onClick={() => onSelectCity(isSelected ? '' : hub.name)}
                      className={`p-3 rounded-xl border bg-white cursor-pointer transition-all ${
                        isSelected 
                          ? 'border-[#00C6A6] ring-2 ring-[#00C6A6]/20 shadow-xs' 
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <img
                          src={hub.heroImage}
                          alt={hub.name}
                          className="w-12 h-12 rounded-lg object-cover shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-1.5">
                            <span className="text-[10px] font-black text-[#008972] bg-emerald-50 px-1.5 py-0.2 rounded">
                              #{hub.displayOrder}
                            </span>
                            <h4 className="text-xs font-bold text-slate-900 truncate">{hub.name}</h4>
                          </div>
                          <p className="text-[10px] text-slate-500 truncate mt-0.5">
                            {hub.productCount === 1 ? '1 Tour' : `${hub.productCount || 0} Tours`} • {hub.hotelCount === 1 ? '1 Stay' : `${hub.hotelCount || 0} Stays`}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 5. Hub Dossier / Inspection Modal */}
      {inspectingHub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-200">
            {/* Modal Image Header */}
            <div className="relative h-48 sm:h-56 w-full">
              <img
                src={inspectingHub.heroImage}
                alt={inspectingHub.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent" />
              
              <button
                type="button"
                onClick={() => setInspectingHub(null)}
                className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black text-white rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="absolute bottom-4 left-6 right-6 text-white">
                <div className="flex items-center space-x-2 mb-1">
                  <span className="bg-[#00C6A6] text-white text-[10px] font-black px-2 py-0.5 rounded">
                    Hierarchical Hub #{inspectingHub.displayOrder}
                  </span>
                  {inspectingHub.regionName && (
                    <span className="bg-white/20 backdrop-blur-xs text-white text-[10px] font-semibold px-2 py-0.5 rounded">
                      {inspectingHub.regionName}
                    </span>
                  )}
                </div>
                <h3 className="text-2xl font-black">{inspectingHub.name}</h3>
                <p className="text-xs text-slate-200 font-medium">{inspectingHub.tagline}</p>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Touring Dossier & Logistics
                </h4>
                <p className="text-sm text-slate-700 leading-relaxed">
                  {inspectingHub.description}
                </p>
              </div>

              {inspectingHub.highlights && (inspectingHub.highlights || []).length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Key Highlights & Experiences
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(inspectingHub.highlights || []).map((h, i) => (
                      <div key={i} className="flex items-center space-x-2 text-xs text-slate-700 bg-slate-50 p-2 rounded-xl border border-slate-100">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#00C6A6] shrink-0" />
                        <span className="font-medium">{h}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Connected Capacities */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-100 text-center">
                  <span className="text-xs text-emerald-800 font-semibold block">DMC Verified Tours</span>
                  <span className="text-lg font-black text-emerald-950">
                    {inspectingHub.productCount === 1 ? '1 Tour' : `${inspectingHub.productCount || 0} Tours`}
                  </span>
                </div>
                <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-100 text-center">
                  <span className="text-xs text-blue-800 font-semibold block">Contracted Hotel Inventory</span>
                  <span className="text-lg font-black text-blue-950">
                    {inspectingHub.hotelCount === 1 ? '1 Stay' : `${inspectingHub.hotelCount || 0} Stays`}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setInspectingHub(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Close Dossier
              </button>
              <button
                type="button"
                onClick={() => {
                  onSelectCity(inspectingHub.name);
                  setInspectingHub(null);
                }}
                className="px-5 py-2 text-xs font-bold text-white bg-[#00C6A6] hover:bg-[#008972] rounded-xl shadow-xs transition-colors cursor-pointer flex items-center space-x-1.5"
              >
                <span>Filter Experiences for {inspectingHub.name}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
