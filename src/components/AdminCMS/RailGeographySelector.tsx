import React, { useMemo, useState, useEffect } from 'react';
import { AlertTriangle, CheckSquare, Globe2, MapPin, Search, X } from 'lucide-react';
import { CityHub, DestinationRegionItem } from '../../types';
import { FormField } from '../common/FormField';

export interface RailGeographyStateUpdate {
  regionId: string;
  regionName: string;
  regionIds: string[];
  regionNames: string[];
  hubId: string;
  city: string;
  hubIds: string[];
  hubNames: string[];
  warning?: string | null;
  blocked?: boolean;
}

function dedupeStrings(values: Array<string | undefined | null>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const val of values) {
    const clean = (val || '').trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    result.push(clean);
  }
  return result;
}

function resolveRegionNames(regionIds: string[], destinationRegions: DestinationRegionItem[]): string[] {
  const regMap = new Map(destinationRegions.map(r => [r.id, r.name]));
  return dedupeStrings(regionIds.map(id => regMap.get(id) || ''));
}

function resolveHubNames(hubIds: string[], cityHubs: CityHub[]): string[] {
  const hubMap = new Map(cityHubs.map(h => [h.id, h.name]));
  return dedupeStrings(hubIds.map(id => hubMap.get(id) || ''));
}

function buildRailGeographyUpdate(
  nextRegionIds: string[],
  nextHubIds: string[],
  destinationRegions: DestinationRegionItem[],
  cityHubs: CityHub[],
  warning: string | null = null,
  blocked: boolean = false
): RailGeographyStateUpdate {
  const cleanHubIds = dedupeStrings(nextHubIds);
  const cleanRegionIds = dedupeStrings(nextRegionIds);
  const cleanHubNames = resolveHubNames(cleanHubIds, cityHubs);
  const cleanRegionNames = resolveRegionNames(cleanRegionIds, destinationRegions);

  const primaryHub = cleanHubIds.length > 0 ? cityHubs.find(h => h.id === cleanHubIds[0]) : undefined;
  const primaryRegionId =
    (primaryHub?.regionId && cleanRegionIds.includes(primaryHub.regionId) ? primaryHub.regionId : undefined) ||
    cleanRegionIds[0] ||
    '';
  const primaryRegionObj = destinationRegions.find(r => r.id === primaryRegionId);

  return {
    regionId: primaryRegionId,
    regionName: primaryRegionObj?.name || primaryHub?.regionName || '',
    regionIds: cleanRegionIds,
    regionNames: cleanRegionNames,
    hubId: primaryHub?.id || cleanHubIds[0] || '',
    city: primaryHub?.name || cleanHubNames[0] || '',
    hubIds: cleanHubIds,
    hubNames: cleanHubNames,
    warning,
    blocked
  };
}

export function hydrateRailGeographyState(
  product: {
    destinationId?: string;
    regionId?: string;
    regionIds?: string[];
    regionName?: string;
    regionNames?: string[];
    hubId?: string;
    hubIds?: string[];
    hubNames?: string[];
    city?: string;
  } | null | undefined,
  destinationRegions: DestinationRegionItem[],
  cityHubs: CityHub[]
): RailGeographyStateUpdate {
  if (!product) {
    return {
      regionId: '',
      regionName: '',
      regionIds: [],
      regionNames: [],
      hubId: '',
      city: '',
      hubIds: [],
      hubNames: [],
      warning: null,
      blocked: false
    };
  }

  const destId = (product.destinationId || '').trim();
  const scopedRegions = destId ? destinationRegions.filter(r => r.destinationId === destId) : destinationRegions;
  const scopedHubs = destId ? cityHubs.filter(h => h.destinationId === destId) : cityHubs;

  const validRegionIdSet = new Set(scopedRegions.map(r => r.id));
  const validHubIdSet = new Set(scopedHubs.map(h => h.id));

  const rawHubIds = dedupeStrings([
    ...(Array.isArray(product.hubIds) ? product.hubIds : []),
    product.hubId
  ]).filter(hid => validHubIdSet.size === 0 || validHubIdSet.has(hid));

  const hubDerivedRegionIds = rawHubIds
    .map(hid => scopedHubs.find(h => h.id === hid)?.regionId)
    .filter((rid): rid is string => Boolean(rid));

  const rawRegionIds = dedupeStrings([
    ...(Array.isArray(product.regionIds) ? product.regionIds : []),
    product.regionId,
    ...hubDerivedRegionIds
  ]).filter(rid => validRegionIdSet.size === 0 || validRegionIdSet.has(rid));

  return buildRailGeographyUpdate(rawRegionIds, rawHubIds, scopedRegions, scopedHubs, null, false);
}

export function toggleRailRegionSelection(params: {
  regionId: string;
  selectedRegionIds: string[];
  selectedHubIds: string[];
  destinationRegions: DestinationRegionItem[];
  cityHubs: CityHub[];
}): RailGeographyStateUpdate {
  const { regionId, selectedRegionIds, selectedHubIds, destinationRegions, cityHubs } = params;
  const currentRegionIds = dedupeStrings(selectedRegionIds);
  const currentHubIds = dedupeStrings(selectedHubIds);
  const isSelected = currentRegionIds.includes(regionId);

  if (isSelected) {
    const dependentHubs = currentHubIds
      .map(hid => cityHubs.find(h => h.id === hid))
      .filter((h): h is CityHub => Boolean(h && h.regionId === regionId));

    if (dependentHubs.length > 0) {
      const regionName = destinationRegions.find(r => r.id === regionId)?.name || regionId;
      const hubNamesList = dependentHubs.map(h => h.name).join(', ');
      return buildRailGeographyUpdate(
        currentRegionIds,
        currentHubIds,
        destinationRegions,
        cityHubs,
        `Cannot remove region "${regionName}" because selected City Hub${dependentHubs.length > 1 ? 's' : ''} (${hubNamesList}) belong to it. Deselect those City Hub${dependentHubs.length > 1 ? 's' : ''} first.`,
        true
      );
    }

    const nextRegionIds = currentRegionIds.filter(id => id !== regionId);
    return buildRailGeographyUpdate(nextRegionIds, currentHubIds, destinationRegions, cityHubs, null, false);
  }

  const validRegion = destinationRegions.find(r => r.id === regionId);
  if (!validRegion) {
    return buildRailGeographyUpdate(
      currentRegionIds,
      currentHubIds,
      destinationRegions,
      cityHubs,
      `Region "${regionId}" does not belong to the selected destination.`,
      true
    );
  }

  const nextRegionIds = dedupeStrings([...currentRegionIds, regionId]);
  return buildRailGeographyUpdate(nextRegionIds, currentHubIds, destinationRegions, cityHubs, null, false);
}

export function selectAllRailRegionsSelection(params: {
  destinationRegions: DestinationRegionItem[];
  selectedHubIds: string[];
  cityHubs: CityHub[];
}): RailGeographyStateUpdate {
  const { destinationRegions, selectedHubIds, cityHubs } = params;
  const allRegionIds = destinationRegions.map(r => r.id);
  return buildRailGeographyUpdate(allRegionIds, selectedHubIds, destinationRegions, cityHubs, null, false);
}

export function clearAllRailRegionsSelection(params: {
  selectedRegionIds: string[];
  selectedHubIds: string[];
  destinationRegions: DestinationRegionItem[];
  cityHubs: CityHub[];
}): RailGeographyStateUpdate {
  const { selectedRegionIds, selectedHubIds, destinationRegions, cityHubs } = params;
  const currentHubIds = dedupeStrings(selectedHubIds);
  const currentRegionIds = dedupeStrings(selectedRegionIds);
  const requiredRegionIds = dedupeStrings(
    currentHubIds.map(hid => cityHubs.find(h => h.id === hid)?.regionId)
  );

  if (requiredRegionIds.length > 0) {
    const retainedRegions = currentRegionIds.filter(rid => requiredRegionIds.includes(rid));
    const nextRegionIds = retainedRegions.length > 0 ? retainedRegions : requiredRegionIds;
    const retainedNames = resolveRegionNames(nextRegionIds, destinationRegions).join(', ');
    const dependentHubNames = resolveHubNames(
      currentHubIds.filter(hid => {
        const h = cityHubs.find(item => item.id === hid);
        return h?.regionId && nextRegionIds.includes(h.regionId);
      }),
      cityHubs
    ).join(', ');

    return buildRailGeographyUpdate(
      nextRegionIds,
      currentHubIds,
      destinationRegions,
      cityHubs,
      `Manual regions cleared, but "${retainedNames}" cannot be removed while City Hubs (${dependentHubNames}) remain selected. Deselect those City Hubs first.`,
      true
    );
  }

  return buildRailGeographyUpdate([], currentHubIds, destinationRegions, cityHubs, null, false);
}

export function toggleRailHubSelection(params: {
  hubId: string;
  selectedHubIds: string[];
  selectedRegionIds: string[];
  destinationRegions: DestinationRegionItem[];
  cityHubs: CityHub[];
}): RailGeographyStateUpdate {
  const { hubId, selectedHubIds, selectedRegionIds, destinationRegions, cityHubs } = params;
  const currentHubIds = dedupeStrings(selectedHubIds);
  const currentRegionIds = dedupeStrings(selectedRegionIds);
  const hubObj = cityHubs.find(h => h.id === hubId);
  const isSelected = currentHubIds.includes(hubId);

  if (!isSelected) {
    if (!hubObj) {
      return buildRailGeographyUpdate(
        currentRegionIds,
        currentHubIds,
        destinationRegions,
        cityHubs,
        `City Hub "${hubId}" does not belong to the selected destination.`,
        true
      );
    }
    const nextHubIds = dedupeStrings([...currentHubIds, hubObj.id]);
    // Auto-include hub's parent region while preserving all existing valid regions
    const nextRegionIds = dedupeStrings([
      ...currentRegionIds,
      hubObj.regionId
    ]).filter(rid => destinationRegions.some(r => r.id === rid));
    return buildRailGeographyUpdate(nextRegionIds, nextHubIds, destinationRegions, cityHubs, null, false);
  }

  const nextHubIds = currentHubIds.filter(id => id !== hubId);
  // Preserve all valid selected regions when deselecting a hub
  return buildRailGeographyUpdate(currentRegionIds, nextHubIds, destinationRegions, cityHubs, null, false);
}

export function selectAllRailHubsSelection(params: {
  hubIdsToAdd: string[];
  selectedHubIds: string[];
  selectedRegionIds: string[];
  destinationRegions: DestinationRegionItem[];
  cityHubs: CityHub[];
}): RailGeographyStateUpdate {
  const { hubIdsToAdd, selectedHubIds, selectedRegionIds, destinationRegions, cityHubs } = params;
  const validHubs = hubIdsToAdd
    .map(hid => cityHubs.find(h => h.id === hid))
    .filter((h): h is CityHub => Boolean(h));
  const nextHubIds = dedupeStrings([...selectedHubIds, ...validHubs.map(h => h.id)]);
  const autoRegions = validHubs.map(h => h.regionId);
  const nextRegionIds = dedupeStrings([...selectedRegionIds, ...autoRegions]).filter(rid =>
    destinationRegions.some(r => r.id === rid)
  );
  return buildRailGeographyUpdate(nextRegionIds, nextHubIds, destinationRegions, cityHubs, null, false);
}

export function clearAllRailHubsSelection(params: {
  selectedRegionIds: string[];
  destinationRegions: DestinationRegionItem[];
  cityHubs: CityHub[];
}): RailGeographyStateUpdate {
  const { selectedRegionIds, destinationRegions, cityHubs } = params;
  return buildRailGeographyUpdate(selectedRegionIds, [], destinationRegions, cityHubs, null, false);
}

interface RailGeographySelectorProps {
  destinationId?: string;
  regions: DestinationRegionItem[];
  cityHubs: CityHub[];
  selectedRegionIds: string[];
  selectedHubIds: string[];
  onApplyUpdate: (update: RailGeographyStateUpdate) => void;
  compact?: boolean;
}

export const RailGeographySelector: React.FC<RailGeographySelectorProps> = ({
  destinationId,
  regions,
  cityHubs,
  selectedRegionIds,
  selectedHubIds,
  onApplyUpdate,
  compact = false
}) => {
  const [regionSearch, setRegionSearch] = useState('');
  const [hubSearch, setHubSearch] = useState('');
  const [showSelectedRegionsOnlyHubs, setShowSelectedRegionsOnlyHubs] = useState(false);
  const [regionWarning, setRegionWarning] = useState<string | null>(null);

  useEffect(() => {
    setRegionSearch('');
    setHubSearch('');
    setRegionWarning(null);
  }, [destinationId]);

  const destinationRegions = useMemo(() => {
    if (!destinationId) return [];
    return regions
      .filter(r => r.destinationId === destinationId)
      .sort((a, b) => (a.orderIndex ?? 999) - (b.orderIndex ?? 999) || (a.name || '').localeCompare(b.name || ''));
  }, [regions, destinationId]);

  const destinationHubs = useMemo(() => {
    if (!destinationId) return [];
    return cityHubs
      .filter(h => h.destinationId === destinationId)
      .sort((a, b) => (a.orderIndex ?? 999) - (b.orderIndex ?? 999) || (a.name || '').localeCompare(b.name || ''));
  }, [cityHubs, destinationId]);

  const cleanSelectedRegionIds = useMemo(
    () => dedupeStrings(selectedRegionIds).filter(rid => destinationRegions.some(r => r.id === rid)),
    [selectedRegionIds, destinationRegions]
  );

  const cleanSelectedHubIds = useMemo(
    () => dedupeStrings(selectedHubIds).filter(hid => destinationHubs.some(h => h.id === hid)),
    [selectedHubIds, destinationHubs]
  );

  const requiredRegionMap = useMemo(() => {
    const map = new Map<string, CityHub[]>();
    for (const hid of cleanSelectedHubIds) {
      const hub = destinationHubs.find(h => h.id === hid);
      if (hub?.regionId) {
        const list = map.get(hub.regionId) || [];
        list.push(hub);
        map.set(hub.regionId, list);
      }
    }
    return map;
  }, [cleanSelectedHubIds, destinationHubs]);

  const filteredRegions = useMemo(() => {
    const q = regionSearch.trim().toLowerCase();
    if (!q) return destinationRegions;
    return destinationRegions.filter(
      r => (r.name || '').toLowerCase().includes(q) || (r.id || '').toLowerCase().includes(q)
    );
  }, [destinationRegions, regionSearch]);

  const groupedHubs = useMemo(() => {
    const q = hubSearch.trim().toLowerCase();
    const groups: { region: DestinationRegionItem | null; regionId: string; regionName: string; hubs: CityHub[] }[] = [];
    const seenRegionIds = new Set<string>();

    const candidateRegions = showSelectedRegionsOnlyHubs && cleanSelectedRegionIds.length > 0
      ? destinationRegions.filter(r => cleanSelectedRegionIds.includes(r.id))
      : destinationRegions;

    for (const reg of candidateRegions) {
      seenRegionIds.add(reg.id);
      const hubsInRegion = destinationHubs.filter(h => {
        if (h.regionId !== reg.id) return false;
        if (!q) return true;
        return (
          (h.name || '').toLowerCase().includes(q) ||
          (h.id || '').toLowerCase().includes(q) ||
          (reg.name || '').toLowerCase().includes(q)
        );
      });
      if (hubsInRegion.length > 0) {
        groups.push({ region: reg, regionId: reg.id, regionName: reg.name, hubs: hubsInRegion });
      }
    }

    if (!showSelectedRegionsOnlyHubs) {
      const ungroupedHubs = destinationHubs.filter(h => {
        if (h.regionId && seenRegionIds.has(h.regionId)) return false;
        if (!q) return true;
        return (
          (h.name || '').toLowerCase().includes(q) ||
          (h.id || '').toLowerCase().includes(q) ||
          (h.regionName || '').toLowerCase().includes(q)
        );
      });
      if (ungroupedHubs.length > 0) {
        groups.push({ region: null, regionId: 'other', regionName: 'Other Hubs', hubs: ungroupedHubs });
      }
    }

    return groups;
  }, [destinationRegions, destinationHubs, hubSearch, showSelectedRegionsOnlyHubs, cleanSelectedRegionIds]);

  const visibleHubIds = useMemo(
    () => groupedHubs.flatMap(g => g.hubs.map(h => h.id)),
    [groupedHubs]
  );

  const commitUpdate = (update: RailGeographyStateUpdate) => {
    setRegionWarning(update.warning || null);
    onApplyUpdate(update);
  };

  const handleToggleRegion = (regId: string) => {
    commitUpdate(
      toggleRailRegionSelection({
        regionId: regId,
        selectedRegionIds: cleanSelectedRegionIds,
        selectedHubIds: cleanSelectedHubIds,
        destinationRegions,
        cityHubs: destinationHubs
      })
    );
  };

  const handleSelectAllRegions = () => {
    commitUpdate(
      selectAllRailRegionsSelection({
        destinationRegions,
        selectedHubIds: cleanSelectedHubIds,
        cityHubs: destinationHubs
      })
    );
  };

  const handleClearAllRegions = () => {
    commitUpdate(
      clearAllRailRegionsSelection({
        selectedRegionIds: cleanSelectedRegionIds,
        selectedHubIds: cleanSelectedHubIds,
        destinationRegions,
        cityHubs: destinationHubs
      })
    );
  };

  const handleToggleHub = (hubId: string) => {
    commitUpdate(
      toggleRailHubSelection({
        hubId,
        selectedHubIds: cleanSelectedHubIds,
        selectedRegionIds: cleanSelectedRegionIds,
        destinationRegions,
        cityHubs: destinationHubs
      })
    );
  };

  const handleSelectAllHubs = () => {
    commitUpdate(
      selectAllRailHubsSelection({
        hubIdsToAdd: visibleHubIds.length > 0 ? visibleHubIds : destinationHubs.map(h => h.id),
        selectedHubIds: cleanSelectedHubIds,
        selectedRegionIds: cleanSelectedRegionIds,
        destinationRegions,
        cityHubs: destinationHubs
      })
    );
  };

  const handleClearAllHubs = () => {
    commitUpdate(
      clearAllRailHubsSelection({
        selectedRegionIds: cleanSelectedRegionIds,
        destinationRegions,
        cityHubs: destinationHubs
      })
    );
  };

  const listMaxHeight = compact ? 'max-h-36' : 'max-h-52';

  return (
    <div className="sm:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* 2. REGIONS (TIER 2) MULTI-SELECT */}
      <FormField label="2. Regions (Tier 2 — Multi-Select)" required>
        <div className={`border border-slate-200 rounded-xl bg-white overflow-hidden ${!destinationId ? 'bg-slate-100 opacity-60 pointer-events-none' : ''}`}>
          {/* Top toolbar */}
          <div className="p-2.5 bg-slate-50 border-b border-slate-200 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center space-x-1.5 text-[11px] font-bold text-slate-700">
                <Globe2 className="w-3.5 h-3.5 text-[#008972]" />
                <span>{cleanSelectedRegionIds.length} selected</span>
                <span className="text-slate-400 font-normal">/ {destinationRegions.length}</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  disabled={!destinationId || destinationRegions.length === 0}
                  onClick={handleSelectAllRegions}
                  className="px-2 py-0.5 rounded bg-white border border-slate-200 hover:border-[#00C6A6] text-[10px] font-bold text-slate-700 cursor-pointer disabled:opacity-40"
                >
                  Select All
                </button>
                <button
                  type="button"
                  disabled={!destinationId || cleanSelectedRegionIds.length === 0}
                  onClick={handleClearAllRegions}
                  className="px-2 py-0.5 rounded bg-white border border-slate-200 hover:border-rose-300 text-[10px] font-bold text-slate-600 hover:text-rose-700 cursor-pointer disabled:opacity-40"
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              <input
                type="text"
                disabled={!destinationId}
                value={regionSearch}
                onChange={e => setRegionSearch(e.target.value)}
                placeholder={destinationId ? 'Search regions...' : 'Select Destination first'}
                className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-[#00C6A6]"
              />
              {regionSearch && (
                <button
                  type="button"
                  onClick={() => setRegionSearch('')}
                  className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Selected Region Chips */}
          {cleanSelectedRegionIds.length > 0 && (
            <div className="px-2.5 py-2 bg-teal-50/50 border-b border-slate-100 flex flex-wrap gap-1.5">
              {cleanSelectedRegionIds.map(regId => {
                const reg = destinationRegions.find(r => r.id === regId);
                const dependentHubs = requiredRegionMap.get(regId) || [];
                const isHubLinked = dependentHubs.length > 0;
                return (
                  <span
                    key={regId}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                      isHubLinked
                        ? 'bg-[#00C6A6]/15 text-[#00735f] border-[#00C6A6]/40'
                        : 'bg-white text-slate-700 border-slate-200'
                    }`}
                    title={
                      isHubLinked
                        ? `Required by selected City Hubs: ${dependentHubs.map(h => h.name).join(', ')}`
                        : 'Manually selected region'
                    }
                  >
                    <span>{reg?.name || regId}</span>
                    {isHubLinked && <span className="text-[9px] opacity-75">· Hub</span>}
                    <button
                      type="button"
                      onClick={() => handleToggleRegion(regId)}
                      className="hover:text-rose-600 cursor-pointer"
                      aria-label={`Remove region ${reg?.name || regId}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {/* Hub Dependency Warning */}
          {regionWarning && (
            <div className="px-3 py-2 bg-amber-50 border-b border-amber-200 flex items-start justify-between gap-2 text-[11px] text-amber-900">
              <div className="flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span className="font-medium leading-snug">{regionWarning}</span>
              </div>
              <button
                type="button"
                onClick={() => setRegionWarning(null)}
                className="text-amber-600 hover:text-amber-900 cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Region Checkboxes */}
          <div className={`p-2.5 space-y-1.5 ${listMaxHeight} overflow-y-auto`}>
            {!destinationId ? (
              <div className="text-slate-400 text-xs py-2">-- Select Destination First --</div>
            ) : filteredRegions.length === 0 ? (
              <div className="text-slate-400 text-xs py-2">No regions match "{regionSearch}".</div>
            ) : (
              filteredRegions.map(reg => {
                const isChecked = cleanSelectedRegionIds.includes(reg.id);
                const dependentHubs = requiredRegionMap.get(reg.id) || [];
                const totalHubsInRegion = destinationHubs.filter(h => h.regionId === reg.id).length;
                return (
                  <label
                    key={reg.id}
                    className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                      isChecked ? 'bg-teal-50/70 text-slate-900 font-bold' : 'text-slate-700 hover:bg-slate-50 font-medium'
                    }`}
                  >
                    <div className="flex items-center space-x-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleRegion(reg.id)}
                        className="rounded text-[#00C6A6] focus:ring-[#00C6A6]"
                      />
                      <span className="truncate">{reg.name}</span>
                      <span className="text-[10px] font-mono text-slate-400 shrink-0">({reg.id})</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {dependentHubs.length > 0 && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#00C6A6]/15 text-[#008972]">
                          {dependentHubs.length} hub{dependentHubs.length > 1 ? 's' : ''}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400">{totalHubsInRegion} hubs</span>
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>
      </FormField>

      {/* 3. ASSOCIATED CITY HUBS (MULTI-HUB GROUPED BY REGION) */}
      <FormField label="3. Associated City Hubs (Multi-Hub Selection)" required>
        <div className={`border border-slate-200 rounded-xl bg-white overflow-hidden ${!destinationId ? 'bg-slate-100 opacity-60 pointer-events-none' : ''}`}>
          {/* Top toolbar */}
          <div className="p-2.5 bg-slate-50 border-b border-slate-200 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center space-x-1.5 text-[11px] font-bold text-slate-700">
                <MapPin className="w-3.5 h-3.5 text-[#008972]" />
                <span>{cleanSelectedHubIds.length} selected</span>
                <span className="text-slate-400 font-normal">/ {destinationHubs.length}</span>
              </div>
              <div className="flex items-center space-x-1.5">
                {cleanSelectedRegionIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowSelectedRegionsOnlyHubs(v => !v)}
                    className={`px-2 py-0.5 rounded border text-[10px] font-bold cursor-pointer ${
                      showSelectedRegionsOnlyHubs
                        ? 'bg-[#00C6A6]/15 border-[#00C6A6] text-[#00735f]'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {showSelectedRegionsOnlyHubs ? 'Selected Regions' : 'All Regions'}
                  </button>
                )}
                <button
                  type="button"
                  disabled={!destinationId || destinationHubs.length === 0}
                  onClick={handleSelectAllHubs}
                  className="px-2 py-0.5 rounded bg-white border border-slate-200 hover:border-[#00C6A6] text-[10px] font-bold text-slate-700 cursor-pointer disabled:opacity-40"
                >
                  Select All
                </button>
                <button
                  type="button"
                  disabled={!destinationId || cleanSelectedHubIds.length === 0}
                  onClick={handleClearAllHubs}
                  className="px-2 py-0.5 rounded bg-white border border-slate-200 hover:border-rose-300 text-[10px] font-bold text-slate-600 hover:text-rose-700 cursor-pointer disabled:opacity-40"
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              <input
                type="text"
                disabled={!destinationId}
                value={hubSearch}
                onChange={e => setHubSearch(e.target.value)}
                placeholder={destinationId ? 'Search city hubs or regions...' : 'Select Destination first'}
                className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-[#00C6A6]"
              />
              {hubSearch && (
                <button
                  type="button"
                  onClick={() => setHubSearch('')}
                  className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Selected Hub Chips */}
          {cleanSelectedHubIds.length > 0 && (
            <div className="px-2.5 py-2 bg-slate-50/70 border-b border-slate-100 flex flex-wrap gap-1.5">
              {cleanSelectedHubIds.map(hubId => {
                const hub = destinationHubs.find(h => h.id === hubId);
                const regName = destinationRegions.find(r => r.id === hub?.regionId)?.name || hub?.regionName || '';
                return (
                  <span
                    key={hubId}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-white text-slate-800 border border-slate-200"
                  >
                    <span>{hub?.name || hubId}</span>
                    {regName && <span className="text-[9px] text-slate-400">({regName})</span>}
                    <button
                      type="button"
                      onClick={() => handleToggleHub(hubId)}
                      className="text-slate-400 hover:text-rose-600 cursor-pointer"
                      aria-label={`Remove hub ${hub?.name || hubId}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {/* Grouped Hub Checkboxes */}
          <div className={`p-2.5 space-y-3 ${listMaxHeight} overflow-y-auto`}>
            {!destinationId ? (
              <div className="text-slate-400 text-xs py-2">-- Select Destination First --</div>
            ) : groupedHubs.length === 0 ? (
              <div className="text-slate-400 text-xs py-2">No city hubs match your current filter.</div>
            ) : (
              groupedHubs.map(group => {
                const selectedInGroup = group.hubs.filter(h => cleanSelectedHubIds.includes(h.id)).length;
                return (
                  <div key={group.regionId} className="space-y-1">
                    <div className="flex items-center justify-between px-1.5 py-0.5 bg-slate-100/80 rounded text-[10px] font-extrabold uppercase tracking-wider text-slate-600">
                      <span className="flex items-center gap-1">
                        <CheckSquare className="w-3 h-3 text-[#008972]" />
                        <span>{group.regionName}</span>
                      </span>
                      <span className="font-mono text-slate-500">
                        {selectedInGroup}/{group.hubs.length}
                      </span>
                    </div>
                    <div className="space-y-1 pl-1">
                      {group.hubs.map(h => {
                        const isChecked = cleanSelectedHubIds.includes(h.id);
                        return (
                          <label
                            key={h.id}
                            className={`flex items-center justify-between gap-2 px-2 py-1 rounded-lg text-xs cursor-pointer transition-colors ${
                              isChecked ? 'bg-teal-50/70 text-slate-900 font-bold' : 'text-slate-700 hover:bg-slate-50 font-medium'
                            }`}
                          >
                            <div className="flex items-center space-x-2 min-w-0">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleHub(h.id)}
                                className="rounded text-[#00C6A6] focus:ring-[#00C6A6]"
                              />
                              <span className="truncate">{h.name}</span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-400 shrink-0">{h.id}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </FormField>
    </div>
  );
};
