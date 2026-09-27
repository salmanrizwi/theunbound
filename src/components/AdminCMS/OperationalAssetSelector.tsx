import React, { useState, useMemo, useRef, useEffect } from 'react';
import { VehicleMaster, YachtMaster, FerryMaster } from '../../types';
import { AppDatabase } from '../../services/db';
import { 
  Car, 
  Ship, 
  Anchor, 
  Search, 
  ChevronDown, 
  Check, 
  X, 
  Plus, 
  MapPin, 
  Users, 
  Briefcase, 
  ExternalLink,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

export type OperationalAssetType = 'VEHICLE' | 'YACHT' | 'FERRY';

export interface SelectedAssetPayload {
  id: string;
  name: string;
  model: string;
  type: string;
  classification: string;
  capacity: number;
  luggageCapacity?: number;
  length?: string;
  dimensions?: string;
  route?: string;
  origin?: string;
  destination?: string;
  operator?: string;
  supplierId?: string;
  supplierName?: string;
}

interface OperationalAssetSelectorProps {
  assetType: OperationalAssetType;
  selectedId?: string;
  selectedName?: string;
  selectedType?: string;
  selectedCapacity?: number;
  selectedDimensions?: string;
  destinationId?: string;
  hubId?: string;
  onSelect: (asset: SelectedAssetPayload) => void;
  onClear: () => void;
  onOpenMasterManager?: () => void;
  readOnly?: boolean;
}

export const OperationalAssetSelector: React.FC<OperationalAssetSelectorProps> = ({
  assetType,
  selectedId,
  selectedName,
  selectedType,
  selectedCapacity,
  selectedDimensions,
  destinationId,
  hubId,
  onSelect,
  onClear,
  onOpenMasterManager,
  readOnly = false
}) => {
  const db = AppDatabase.getInstance();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterByDestination, setFilterByDestination] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Load authoritative master records
  const vehicles = useMemo(() => db.getVehicles(), [isOpen]);
  const yachts = useMemo(() => db.getYachts(), [isOpen]);
  const ferries = useMemo(() => db.getFerries(), [isOpen]);

  const activeRecords = useMemo(() => {
    if (assetType === 'VEHICLE') {
      return vehicles.filter(v => v.status === 'ACTIVE');
    }
    if (assetType === 'YACHT') {
      return yachts.filter(y => y.status === 'ACTIVE');
    }
    return ferries.filter(f => f.status === 'ACTIVE');
  }, [assetType, vehicles, yachts, ferries]);

  // Filter by query and destination/hub
  const filteredRecords = useMemo(() => {
    return activeRecords.filter(item => {
      // Destination filter if enabled and destinationId exists
      if (filterByDestination && destinationId && (item as any).destinationId) {
        if ((item as any).destinationId !== destinationId) {
          // Allow if no destination specific or matching
          return false;
        }
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const name = (item.name || '').toLowerCase();
      const model = ((item as any).model || '').toLowerCase();
      const type = ((item as any).type || (item as any).classification || '').toLowerCase();
      const location = `${(item as any).hubName || ''} ${(item as any).destinationName || ''}`.toLowerCase();
      const route = ((item as any).route || '').toLowerCase();
      return name.includes(q) || model.includes(q) || type.includes(q) || location.includes(q) || route.includes(q);
    });
  }, [activeRecords, searchQuery, filterByDestination, destinationId]);

  // Find currently selected record
  const currentRecord = useMemo(() => {
    if (!selectedId) return null;
    return activeRecords.find(r => r.id === selectedId) || null;
  }, [activeRecords, selectedId]);

  const assetLabel = assetType === 'VEHICLE' ? 'Vehicle' : assetType === 'YACHT' ? 'Yacht' : 'Ferry / Vessel';
  const Icon = assetType === 'VEHICLE' ? Car : assetType === 'YACHT' ? Ship : Anchor;
  const capacityUnit = assetType === 'VEHICLE' ? 'Seats' : assetType === 'YACHT' ? 'Guests' : 'Passengers';

  return (
    <div className="space-y-3" ref={dropdownRef}>
      {/* Selector Input Trigger */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <label className="font-semibold text-slate-200 flex items-center gap-1.5">
            <Icon className="w-3.5 h-3.5 text-[#00E5C0]" />
            <span>Select {assetLabel} from Master Database *</span>
          </label>
          {onOpenMasterManager && (
            <button
              type="button"
              onClick={onOpenMasterManager}
              className="text-[11px] text-[#00E5C0] hover:underline flex items-center gap-1 cursor-pointer font-medium"
            >
              <span>Manage {assetLabel} Master</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="relative">
          <div
            role="button"
            tabIndex={readOnly ? -1 : 0}
            aria-disabled={readOnly}
            onClick={() => {
              if (!readOnly) setIsOpen(!isOpen);
            }}
            onKeyDown={(e) => {
              if (!readOnly && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                setIsOpen(!isOpen);
              }
            }}
            className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all select-none ${
              readOnly ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
            } ${
              selectedId
                ? 'bg-slate-900 border-[#00C6A6] text-white shadow-xs'
                : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-500'
            }`}
          >
            <div className="flex items-center gap-2.5 truncate">
              <div className={`p-1.5 rounded-lg ${selectedId ? 'bg-[#00C6A6]/20 text-[#00E5C0]' : 'bg-slate-800 text-slate-500'}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="truncate">
                {selectedId ? (
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-xs truncate">
                      {selectedName || currentRecord?.name || 'Selected Asset'}
                    </span>
                    <span className="text-[10px] bg-teal-500/20 text-[#00E5C0] px-1.5 py-0.5 rounded font-mono font-semibold">
                      {selectedCapacity ? `${selectedCapacity} ${capacityUnit}` : ''}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400">
                    [ Select {assetLabel} ▼ ] — Search authoritative {assetLabel.toLowerCase()} inventory...
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              {selectedId && !readOnly && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClear();
                  }}
                  title="Clear Selection"
                  className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>
          </div>

          {/* Search Dropdown Popover */}
          {isOpen && (
            <div className="absolute z-50 left-0 right-0 mt-1.5 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2.5 space-y-2 text-xs">
              {/* Search input & filter */}
              <div className="space-y-1.5">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    autoFocus
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={`Search ${assetLabel.toLowerCase()}s by name, model, classification, or hub...`}
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-[#00C6A6]"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-2 text-slate-400 hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {destinationId && (
                  <div className="flex items-center justify-between text-[11px] px-1 text-slate-400">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filterByDestination}
                        onChange={(e) => setFilterByDestination(e.target.checked)}
                        className="rounded text-[#00C6A6] focus:ring-[#00C6A6] w-3.5 h-3.5"
                      />
                      <span>Filter by Destination Fleet</span>
                    </label>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {filteredRecords.length} available
                    </span>
                  </div>
                )}
              </div>

              {/* Records List */}
              <div className="max-h-60 overflow-y-auto space-y-1 divide-y divide-slate-800/60 pr-1">
                {filteredRecords.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 space-y-1.5">
                    <AlertCircle className="w-5 h-5 mx-auto text-amber-400/80" />
                    <p className="text-xs font-semibold text-slate-300">
                      No active {assetLabel.toLowerCase()}s found
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {filterByDestination
                        ? 'Try unchecking the destination filter, or add new assets in the Master Inventory.'
                        : 'No records match your query in the master inventory.'}
                    </p>
                    {onOpenMasterManager && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsOpen(false);
                          onOpenMasterManager();
                        }}
                        className="mt-2 text-xs font-bold text-[#00E5C0] hover:underline cursor-pointer"
                      >
                        + Create in {assetLabel} Master
                      </button>
                    )}
                  </div>
                ) : (
                  filteredRecords.map((item) => {
                    const isSelected = item.id === selectedId;
                    const cap = (item as any).seatingCapacity || (item as any).capacity || 0;
                    const classification = (item as any).classification || (item as any).type || (item as any).vesselClass || '';
                    const location = (item as any).hubName || (item as any).destinationName || '';
                    const length = (item as any).length || (item as any).dimensions || '';
                    const route = (item as any).route || '';

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          onSelect({
                            id: item.id,
                            name: item.name,
                            model: (item as any).model || item.name,
                            type: (item as any).type || '',
                            classification,
                            capacity: cap,
                            luggageCapacity: (item as any).luggageCapacity,
                            length: (item as any).length,
                            dimensions: (item as any).dimensions,
                            route: (item as any).route,
                            origin: (item as any).origin,
                            destination: (item as any).destination,
                            operator: (item as any).operator,
                            supplierId: (item as any).supplierId,
                            supplierName: (item as any).supplierName
                          });
                          setIsOpen(false);
                        }}
                        className={`w-full p-2.5 rounded-lg text-left transition-all flex items-start justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-teal-950/60 text-white border border-teal-500/40'
                            : 'hover:bg-slate-800/80 text-slate-200'
                        }`}
                      >
                        <div className="space-y-1 min-w-0 pr-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs text-white">{item.name}</span>
                            <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono">
                              ID: {item.id}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-slate-400 flex-wrap">
                            {classification && (
                              <span className="bg-slate-800/80 text-teal-300 px-1.5 py-0.5 rounded text-[10px] font-medium">
                                {classification}
                              </span>
                            )}
                            <span className="text-emerald-400 font-bold">
                              {cap} {capacityUnit}
                            </span>
                            {length && (
                              <span className="text-slate-400 text-[10px]">
                                • {length}
                              </span>
                            )}
                            {location && (
                              <span className="text-slate-400 flex items-center gap-0.5 text-[10px]">
                                <MapPin className="w-2.5 h-2.5 text-slate-500" />
                                {location}
                              </span>
                            )}
                            {route && (
                              <span className="text-slate-400 text-[10px]">
                                • Route: {route}
                              </span>
                            )}
                          </div>
                        </div>

                        {isSelected && (
                          <div className="p-1 bg-[#00C6A6] text-slate-950 rounded-full flex-shrink-0">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Authoritative Selected Asset Read-Only Inspection Display */}
      {selectedId ? (
        <div className="bg-slate-950 p-3 rounded-xl border border-teal-500/30 space-y-2 text-xs">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400 flex items-center gap-1 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-[#00E5C0]" />
              <span>Authoritative Master Record Snapshot</span>
            </span>
            <span className="text-[10px] bg-teal-500/20 text-[#00E5C0] font-mono px-1.5 py-0.5 rounded font-bold">
              ID: {selectedId}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
                {assetLabel} Classification
              </span>
              <span className="font-semibold text-white truncate block">
                {selectedType || currentRecord?.classification || (currentRecord as any)?.type || '—'}
              </span>
            </div>

            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
                Authoritative Capacity
              </span>
              <span className="font-bold text-[#00E5C0] truncate block">
                {selectedCapacity !== undefined ? `${selectedCapacity} ${capacityUnit}` : '—'}
              </span>
            </div>

            {assetType === 'VEHICLE' && (
              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
                  Luggage Allowance
                </span>
                <span className="font-semibold text-slate-200 truncate block">
                  {(currentRecord as any)?.luggageCapacity ? `${(currentRecord as any).luggageCapacity} Standard Suitcases` : 'Controlled'}
                </span>
              </div>
            )}

            {assetType === 'YACHT' && (
              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
                  Length / Dimensions
                </span>
                <span className="font-semibold text-slate-200 truncate block">
                  {selectedDimensions || (currentRecord as any)?.length || '—'}
                </span>
              </div>
            )}

            {assetType === 'FERRY' && (
              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
                  Ferry Route
                </span>
                <span className="font-semibold text-slate-200 truncate block">
                  {(currentRecord as any)?.route || '—'}
                </span>
              </div>
            )}

            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
                Home Port / Hub
              </span>
              <span className="font-semibold text-slate-200 truncate block">
                {(currentRecord as any)?.hubName || (currentRecord as any)?.destinationName || 'National Fleet'}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-slate-500 flex-shrink-0" />
            <span>
              <strong>No {assetLabel.toLowerCase()} selected.</strong> Search the {assetLabel} Master above to select an authoritative operational asset.
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">Capacity: —</span>
        </div>
      )}
    </div>
  );
};
