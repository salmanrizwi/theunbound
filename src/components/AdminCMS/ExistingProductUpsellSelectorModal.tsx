import React, { useState, useMemo } from 'react';
import { 
  Product, 
  ProductCategory, 
  Destination, 
  CityHub, 
  MasterRegion, 
  ProductUpsell 
} from '../../types';
import { 
  Search, 
  X, 
  Sparkles, 
  Check, 
  Filter, 
  MapPin, 
  Layers, 
  DollarSign, 
  Info, 
  AlertTriangle, 
  Building2, 
  Tag,
  Car,
  Users,
  Ticket,
  Languages,
  Utensils,
  Ship,
  Compass,
  ArrowRight
} from 'lucide-react';
import { validateUpsellRelationship, createProductUpsellRelationship } from '../../services/configuratorRegistry';

interface ExistingProductUpsellSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProduct: Partial<Product>;
  existingUpsells: ProductUpsell[];
  allProducts: Product[];
  destinations: Destination[];
  masterRegions: MasterRegion[];
  cityHubs: CityHub[];
  onSelectProduct: (newUpsell: ProductUpsell) => void;
}

const CATEGORY_TABS: { label: string; value: ProductCategory | 'ALL'; icon: any }[] = [
  { label: 'All Categories', value: 'ALL', icon: Layers },
  { label: 'Private Tours', value: 'Private Tours', icon: Car },
  { label: 'Group Tours', value: 'Group Tours', icon: Users },
  { label: 'Tickets', value: 'Tickets', icon: Ticket },
  { label: 'Transfers', value: 'Transfers', icon: Car },
  { label: 'Guides', value: 'Guides', icon: Languages },
  { label: 'Restaurants', value: 'Lunch / Dinner Restaurant', icon: Utensils },
  { label: 'Private Yacht', value: 'Private Yacht', icon: Ship }
];

export const ExistingProductUpsellSelectorModal: React.FC<ExistingProductUpsellSelectorModalProps> = ({
  isOpen,
  onClose,
  currentProduct,
  existingUpsells,
  allProducts,
  destinations,
  masterRegions,
  cityHubs,
  onSelectProduct
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | 'ALL'>('ALL');
  const [selectedDestinationId, setSelectedDestinationId] = useState<string>('ALL');
  const [selectedHubId, setSelectedHubId] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'ALL'>('ACTIVE');
  const [prioritizeDestination, setPrioritizeDestination] = useState<boolean>(true);
  const [priceType, setPriceType] = useState<'PER_PERSON' | 'PER_BOOKING' | 'PER_VEHICLE' | 'PER_DAY' | 'HOURLY'>('PER_PERSON');
  const [customLabel, setCustomLabel] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [selectedProductForConfig, setSelectedProductForConfig] = useState<Product | null>(null);

  const currentProductId = currentProduct.id || currentProduct.product_id || '';
  const currentDestinationId = currentProduct.destinationId || '';
  const currentHubId = currentProduct.hubId || currentProduct.cityHubId || '';

  // Filter and prioritize products
  const filteredProducts = useMemo(() => {
    return allProducts.filter(p => {
      // 1. Status Filter
      if (statusFilter === 'ACTIVE' && p.status && p.status !== 'ACTIVE') {
        return false;
      }

      // 2. Category Filter
      if (selectedCategory !== 'ALL' && p.category !== selectedCategory) {
        return false;
      }

      // 3. Destination Filter
      if (selectedDestinationId !== 'ALL' && p.destinationId !== selectedDestinationId) {
        return false;
      }

      // 4. Hub Filter
      if (selectedHubId !== 'ALL' && (p.hubId !== selectedHubId && p.cityHubId !== selectedHubId)) {
        return false;
      }

      // 5. Search Term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const nameMatch = (p.name || '').toLowerCase().includes(query);
        const skuMatch = (p.sku || '').toLowerCase().includes(query);
        const idMatch = (p.id || '').toLowerCase().includes(query);
        const catMatch = (p.category || '').toLowerCase().includes(query);
        const destMatch = (p.destinationName || '').toLowerCase().includes(query);
        const cityMatch = (p.city || '').toLowerCase().includes(query);
        const descMatch = (p.shortDescription || p.summary || '').toLowerCase().includes(query);
        if (!nameMatch && !skuMatch && !idMatch && !catMatch && !destMatch && !cityMatch && !descMatch) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      // Intelligent Relevance Prioritization (Section 6)
      if (prioritizeDestination) {
        const aMatchesDest = a.destinationId === currentDestinationId ? 1 : 0;
        const bMatchesDest = b.destinationId === currentDestinationId ? 1 : 0;
        if (aMatchesDest !== bMatchesDest) {
          return bMatchesDest - aMatchesDest;
        }

        const aMatchesHub = (a.hubId === currentHubId || a.cityHubId === currentHubId) ? 1 : 0;
        const bMatchesHub = (b.hubId === currentHubId || b.cityHubId === currentHubId) ? 1 : 0;
        if (aMatchesHub !== bMatchesHub) {
          return bMatchesHub - aMatchesHub;
        }
      }
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [
    allProducts,
    statusFilter,
    selectedCategory,
    selectedDestinationId,
    selectedHubId,
    searchTerm,
    prioritizeDestination,
    currentDestinationId,
    currentHubId
  ]);

  if (!isOpen) return null;

  const handleSelect = (target: Product) => {
    // Validate Protection Rules
    const validation = validateUpsellRelationship(
      currentProductId,
      target,
      existingUpsells,
      allProducts
    );

    if (!validation.isValid) {
      alert(validation.error);
      return;
    }

    // Determine appropriate default price type
    const defaultPriceType = target.category === 'Guides' ? 'HOURLY' : 
      (target.category === 'Transfers' || target.category === 'Private Yacht' ? 'PER_BOOKING' : 'PER_PERSON');

    setPriceType(defaultPriceType);
    setSelectedProductForConfig(target);
  };

  const handleConfirmAddRelationship = () => {
    if (!selectedProductForConfig) return;

    const newUpsell = createProductUpsellRelationship(
      currentProduct,
      selectedProductForConfig,
      {
        displayOrder: existingUpsells.length + 1,
        customLabel: customLabel.trim() || undefined,
        internalNotes: internalNotes.trim() || undefined,
        priceType
      }
    );

    onSelectProduct(newUpsell);
    setSelectedProductForConfig(null);
    setCustomLabel('');
    setInternalNotes('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 animate-fadeIn">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-4xl w-full flex flex-col max-h-[92vh] overflow-hidden animate-scaleUp">
        
        {/* Header */}
        <div className="px-6 py-4 bg-white text-slate-800 flex items-center justify-between shrink-0 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200/80 text-[#008972] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-[#00C6A6]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal-50 text-[#008972] border border-teal-200/60">
                  Master Product Selector
                </span>
                <span className="text-xs text-slate-500">
                  Add Existing Product as Upsell
                </span>
              </div>
              <h2 className="text-base font-black text-slate-900 truncate mt-0.5">
                Link Live Experience Upgrade to "{currentProduct.name || 'Current Product'}"
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Controls & Search */}
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200/80 space-y-3 shrink-0">
          {/* Search Bar & Prioritize Destination Toggle */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search products by Name, SKU (PRD-...), Hub, Destination or Keywords..."
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#00C6A6] focus:border-transparent outline-none"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Smart Prioritization Switch (Section 6) */}
            <div className="flex items-center space-x-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shrink-0">
              <span className="text-[11px] font-bold text-slate-700">Prioritize Same Destination:</span>
              <button
                type="button"
                onClick={() => setPrioritizeDestination(!prioritizeDestination)}
                className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer p-0.5 ${
                  prioritizeDestination ? 'bg-[#00C6A6]' : 'bg-slate-300'
                }`}
                title={prioritizeDestination ? 'Destination relevance active' : 'Showing all products alphabetically'}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    prioritizeDestination ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Category Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORY_TABS.map(tab => {
              const Icon = tab.icon;
              const isSelected = selectedCategory === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setSelectedCategory(tab.value)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center space-x-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-teal-50 border border-teal-200/90 text-[#008972] shadow-2xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-[#008972]' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Secondary Dropdowns: Destination & Hub */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <div className="flex items-center space-x-1.5">
              <span className="text-[10px] font-bold uppercase text-slate-400">Destination:</span>
              <select
                value={selectedDestinationId}
                onChange={e => setSelectedDestinationId(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-700 focus:outline-none"
              >
                <option value="ALL">All Destinations</option>
                {destinations.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-1.5">
              <span className="text-[10px] font-bold uppercase text-slate-400">Hub:</span>
              <select
                value={selectedHubId}
                onChange={e => setSelectedHubId(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-700 focus:outline-none"
              >
                <option value="ALL">All City Hubs</option>
                {cityHubs.map(h => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-1.5 ml-auto">
              <span className="text-[10px] font-bold uppercase text-slate-400">Status:</span>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-700 focus:outline-none"
              >
                <option value="ACTIVE">Active Only</option>
                <option value="ALL">All Statuses</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content: Selected Configuration Step OR Product Grid */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {selectedProductForConfig ? (
            /* Step 2: Configure Relationship Parameters (Display Order, Price Type, Optional Custom Label) */
            <div className="max-w-xl mx-auto bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 overflow-hidden shrink-0">
                    <img
                      src={selectedProductForConfig.images?.[0] || 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=400'}
                      alt={selectedProductForConfig.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#008972] bg-[#00C6A6]/10 px-2 py-0.5 rounded-md">
                      {selectedProductForConfig.category}
                    </span>
                    <h3 className="text-sm font-black text-slate-900 mt-0.5">
                      {selectedProductForConfig.name}
                    </h3>
                    <div className="text-[11px] text-slate-500 font-mono">
                      SKU: {selectedProductForConfig.sku || 'N/A'} • {selectedProductForConfig.destinationName || selectedProductForConfig.city}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedProductForConfig(null)}
                  className="text-xs font-bold text-slate-400 hover:text-slate-600 underline cursor-pointer"
                >
                  Change
                </button>
              </div>

              {/* Authoritative Live Price Info Notice */}
              <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3 flex items-start space-x-2.5">
                <Info className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-900">
                  <span className="font-bold">Authoritative Live Product Master:</span> This relationship will dynamically use "{selectedProductForConfig.name}" live master pricing (<span className="font-mono font-bold">{selectedProductForConfig.currency || 'USD'} {(selectedProductForConfig.sellingPriceStartingFrom || selectedProductForConfig.adultNetPrice || 0).toLocaleString()}</span>) and central margin rules. No product duplication will occur.
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Price Calculation Unit</label>
                  <select
                    value={priceType}
                    onChange={e => setPriceType(e.target.value as any)}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-[#00C6A6]"
                  >
                    <option value="PER_PERSON">Per Person (Pax)</option>
                    <option value="PER_BOOKING">Per Booking / Vehicle</option>
                    <option value="PER_DAY">Per Day</option>
                    <option value="HOURLY">Hourly Duration Rate</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Optional Relationship Label</label>
                  <input
                    type="text"
                    value={customLabel}
                    onChange={e => setCustomLabel(e.target.value)}
                    placeholder="e.g. Recommended Private Add-on"
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-[#00C6A6]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Internal Operations Notes (Admin Only)</label>
                <textarea
                  value={internalNotes}
                  onChange={e => setInternalNotes(e.target.value)}
                  rows={2}
                  placeholder="Optional notes regarding supplier confirmation or timetable coordination..."
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-[#00C6A6]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setSelectedProductForConfig(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Back to List
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAddRelationship}
                  className="px-5 py-2 rounded-xl bg-[#00C6A6] hover:bg-[#008972] text-slate-950 text-xs font-black transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Confirm & Add Upsell Relationship</span>
                </button>
              </div>
            </div>
          ) : (
            /* Step 1: Product Selection Cards Grid */
            <div>
              <div className="flex items-center justify-between text-xs text-slate-500 font-bold mb-3">
                <span>Available Products ({filteredProducts.length})</span>
                {prioritizeDestination && currentDestinationId && (
                  <span className="text-[11px] text-[#008972] font-semibold flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    Prioritizing matching location
                  </span>
                )}
              </div>

              {filteredProducts.length === 0 ? (
                <div className="p-12 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl space-y-2">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                    <Search className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-700">No matching products found</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Try loosening your search query or toggling "All Categories" and "All Destinations".
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredProducts.map(p => {
                    const targetId = p.id || p.product_id;
                    const isSelf = targetId === currentProductId;
                    const isAlreadyLinked = existingUpsells.some(u => 
                      (u.upsellProductId === targetId || u.id === targetId || u.name.toLowerCase() === p.name.toLowerCase()) && 
                      u.status !== 'ARCHIVED'
                    );

                    // Check circular
                    const isCircular = Array.isArray(p.upsells) && p.upsells.some(u => 
                      (u.upsellProductId === currentProductId || u.productId === currentProductId) && u.status === 'ACTIVE'
                    );

                    const isSelectable = !isSelf && !isAlreadyLinked && !isCircular && p.status === 'ACTIVE';

                    let blockReason = '';
                    if (isSelf) blockReason = 'Self-Upsell Prohibited';
                    else if (isAlreadyLinked) blockReason = 'Already Linked as Upsell';
                    else if (isCircular) blockReason = 'Circular Reference Detected';
                    else if (p.status !== 'ACTIVE') blockReason = `Status: ${p.status}`;

                    const startingPrice = p.sellingPriceStartingFrom || 
                      (p.hourlyPrice || p.adultNetPrice || 0);

                    return (
                      <div
                        key={p.id}
                        className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between ${
                          isSelectable
                            ? 'bg-white border-slate-200 hover:border-[#00C6A6] hover:shadow-md cursor-pointer group'
                            : 'bg-slate-50 border-slate-200/80 opacity-60 cursor-not-allowed'
                        }`}
                        onClick={() => {
                          if (isSelectable) handleSelect(p);
                        }}
                      >
                        <div className="flex items-start space-x-3">
                          <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                            <img
                              src={p.images?.[0] || 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=400'}
                              alt={p.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center space-x-1.5">
                              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                                {p.category}
                              </span>
                              {p.sku && (
                                <span className="text-[10px] font-mono font-bold text-slate-400">
                                  {p.sku}
                                </span>
                              )}
                              {p.destinationId === currentDestinationId && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                                  Same Location
                                </span>
                              )}
                            </div>

                            <h4 className="text-xs font-black text-slate-900 line-clamp-1 mt-1 group-hover:text-[#008972] transition-colors">
                              {p.name}
                            </h4>

                            <div className="text-[11px] text-slate-400 truncate mt-0.5">
                              {p.destinationName || p.city} {p.hubId ? `• ${p.hubId}` : ''}
                            </div>
                          </div>
                        </div>

                        {/* Bottom Row: Price & Select Action */}
                        <div className="pt-2.5 mt-2 border-t border-slate-100 flex items-center justify-between">
                          <div>
                            <div className="text-[10px] text-slate-400 font-medium">Master Live Rate</div>
                            <div className="text-xs font-black font-mono text-[#008972]">
                              From {p.currency || 'USD'} {startingPrice.toLocaleString()} {p.category === 'Guides' ? '/ hr' : ''}
                            </div>
                          </div>

                          {isSelectable ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelect(p);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-[#00C6A6] hover:bg-[#008972] text-slate-950 hover:text-white text-xs font-bold transition-colors flex items-center space-x-1 cursor-pointer shadow-2xs"
                            >
                              <span>Select</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-200 text-slate-600">
                              {blockReason}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-[#00C6A6]" />
            <span>Master Inventory Reference Model: Upsells link directly to existing product records.</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
