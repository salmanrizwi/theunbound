import React, { useState } from 'react';
import { Product, CurrencyCode, Destination, ProductCategory, SUPPORTED_CURRENCIES } from '../../types';
import { AppDatabase } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, calculateSellingPrice } from '../../services/pricingEngine';
import { 
  DollarSign, 
  Search, 
  Save, 
  RefreshCw, 
  CheckCircle2, 
  Percent, 
  Sliders, 
  Tag,
  Layers,
  Edit3,
  X,
  Plus,
  ArrowRight
} from 'lucide-react';

interface PricingManagerProps {
  destinations: Destination[];
}

export const PricingManager: React.FC<PricingManagerProps> = ({ destinations }) => {
  const db = AppDatabase.getInstance();
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>(() => db.getProducts());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedDestination, setSelectedDestination] = useState('ALL');
  const [selectedSeason, setSelectedSeason] = useState('ALL');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [editingTierProduct, setEditingTierProduct] = useState<Product | null>(null);

  // Global Margin Adjustment
  const [globalMarkupAdjust, setGlobalMarkupAdjust] = useState<number | ''>('');

  const refresh = () => {
    setProducts(db.getProducts());
  };

  const handleProductChange = (productId: string, field: keyof Product, value: any) => {
    setProducts(prev =>
      prev.map(p => {
        if (p.id !== productId) return p;
        const updated = { ...p, [field]: value };
        
        // Recalculate selling price starting from
        const net = Number(updated.adultNetPrice) || 0;
        const markup = Number(updated.defaultMarkupPercent ?? updated.buyerMarkupPercent) || 20;
        const tax = Number(updated.taxPercent) || 0;
        const fee = Number(updated.serviceFeeFixed) || 0;
        
        const computedSelling = calculateSellingPrice(net, markup, tax, fee);
        updated.sellingPriceStartingFrom = computedSelling !== null ? computedSelling : 0;
        if (field === 'currency') {
          updated.nativeCurrency = value;
        }

        return updated;
      })
    );
  };

  const handleSaveAll = () => {
    products.forEach(p => db.saveProduct(p, user));
    db.logAudit(
      user,
      'PRICE_CHANGED',
      'PricingMatrix',
      'bulk-pricing',
      `Updated pricing matrix across ${products.length} catalog items.`
    );
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleSaveSingleProduct = (product: Product) => {
    db.saveProduct(product, user);
    db.logAudit(
      user,
      'PRICE_CHANGED',
      'ProductPricing',
      product.id,
      `Updated pricing for product ${product.sku} (${product.name}).`
    );
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleApplyGlobalMarkup = () => {
    if (typeof globalMarkupAdjust !== 'number') return;
    setProducts(prev =>
      prev.map(p => {
        const net = Number(p.adultNetPrice) || 0;
        const tax = Number(p.taxPercent) || 0;
        const fee = Number(p.serviceFeeFixed) || 0;
        const computedSelling = calculateSellingPrice(net, globalMarkupAdjust, tax, fee);
        return {
          ...p,
          defaultMarkupPercent: globalMarkupAdjust,
          buyerMarkupPercent: globalMarkupAdjust,
          sellingPriceStartingFrom: computedSelling !== null ? computedSelling : 0
        };
      })
    );
  };

  const filtered = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.city && p.city.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesDest = selectedDestination === 'ALL' || p.destinationId === selectedDestination;
    const matchesSeason = selectedSeason === 'ALL' || p.season === selectedSeason;
    const matchesCat = selectedCategory === 'ALL' || p.category === selectedCategory;
    return matchesSearch && matchesDest && matchesSeason && matchesCat;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2 text-[#00C6A6] text-xs font-bold uppercase tracking-wider mb-1">
            <DollarSign className="w-4 h-4" />
            <span>Dynamic Commercial Pricing Engine</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">Commercial Pricing & Tariff Master</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Administer native currencies, wholesale net costs, agent margins, statutory taxes, and validity calendars across all inventory categories.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={refresh}
            title="Refresh database records"
            className="p-2.5 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {savedSuccess && (
            <span className="inline-flex items-center space-x-1 text-emerald-600 text-xs font-bold bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 animate-fade-in">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Pricing Saved & Published!</span>
            </span>
          )}
          <button
            onClick={handleSaveAll}
            className="inline-flex items-center space-x-2 bg-[#00C6A6] hover:bg-[#008972] text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs transition-all shadow-md cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Save All Pricing Updates</span>
          </button>
        </div>
      </div>

      {/* Global Margin Adjustment Tool */}
      <div className="bg-slate-900 text-white p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-[#00C6A6]/20 border border-[#00C6A6]/40 flex items-center justify-center text-[#00E5C0]">
            <Percent className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#00E5C0]">Batch Commercial Margin Override</h4>
            <p className="text-xs text-slate-300">Quickly apply standard gross margin % across currently filtered inventory records.</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="number"
            min="0"
            max="100"
            value={globalMarkupAdjust}
            onChange={e => setGlobalMarkupAdjust(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder="e.g. 25"
            className="w-24 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-[#00C6A6]"
          />
          <span className="text-xs text-slate-400 font-bold">%</span>
          <button
            onClick={handleApplyGlobalMarkup}
            disabled={globalMarkupAdjust === ''}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-semibold text-xs rounded-lg border border-slate-600 transition-colors cursor-pointer"
          >
            Apply To Filtered Rows
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search SKU, product title, city..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#00C6A6]"
          />
        </div>

        <div>
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="w-full py-2 px-3 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#00C6A6]"
          >
            <option value="ALL">All Categories ({products.length})</option>
            <option value="Private Tours">Private Tours</option>
            <option value="Group Tours">Group Tours</option>
            <option value="Tickets">Tickets & Attractions</option>
            <option value="Transfers">Transfers & Ground</option>
            <option value="Guides">Guides & Interpreters</option>
            <option value="Lunch / Dinner Restaurant">Restaurants & Dining</option>
            <option value="Private Yacht">Private Yacht & Charters</option>
            <option value="Hotels">Hotels & Stays</option>
            <option value="Rail / Shinkansen">Rail & Shinkansen</option>
            <option value="Visa & Ancillary Services">Visa & Ancillary</option>
          </select>
        </div>

        <div>
          <select
            value={selectedDestination}
            onChange={e => setSelectedDestination(e.target.value)}
            className="w-full py-2 px-3 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#00C6A6]"
          >
            <option value="ALL">All Destinations</option>
            {destinations.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={selectedSeason}
            onChange={e => setSelectedSeason(e.target.value)}
            className="w-full py-2 px-3 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#00C6A6]"
          >
            <option value="ALL">All Seasons</option>
            <option value="All Year">All Year</option>
            <option value="High">High Season</option>
            <option value="Shoulder">Shoulder Season</option>
            <option value="Low">Low Season</option>
          </select>
        </div>
      </div>

      {/* Pricing Matrix Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Product / SKU</th>
                <th className="py-3 px-3">Native Currency</th>
                <th className="py-3 px-3">Adult Net</th>
                <th className="py-3 px-3">Child Net</th>
                <th className="py-3 px-3">Markup %</th>
                <th className="py-3 px-3">Tax %</th>
                <th className="py-3 px-3">Fee</th>
                <th className="py-3 px-4">Selling Price (Live)</th>
                <th className="py-3 px-3">Tiers</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(product => {
                const isTiered = product.pricingMethod === 'capacity_based' || (product.tieredPricing && product.tieredPricing.length > 0);
                const currentCurrency = (product.nativeCurrency || product.currency || 'USD') as CurrencyCode;

                return (
                  <tr key={product.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 max-w-[240px]">
                      <div className="flex items-center space-x-1.5 mb-1">
                        <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-semibold border border-slate-200">
                          {product.sku}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          {product.category}
                        </span>
                      </div>
                      <div className="font-bold text-slate-900 text-xs truncate">
                        {product.name}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {product.destinationName} • {product.city || 'Standard'}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <select
                        value={currentCurrency}
                        onChange={e => handleProductChange(product.id, 'currency', e.target.value)}
                        className="py-1 px-2 bg-slate-50 border border-slate-200 rounded font-mono text-[11px] font-bold text-slate-800"
                      >
                        {SUPPORTED_CURRENCIES.map(curr => (
                          <option key={curr.code} value={curr.code}>
                            {curr.code} ({curr.symbol})
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="py-3 px-3">
                      <input
                        type="number"
                        min="0"
                        value={product.adultNetPrice ?? ''}
                        onChange={e => handleProductChange(product.id, 'adultNetPrice', Number(e.target.value))}
                        className="w-20 py-1 px-2 bg-slate-50 border border-slate-200 rounded font-mono font-bold text-slate-900 text-xs focus:bg-white focus:border-[#00C6A6]"
                      />
                    </td>

                    <td className="py-3 px-3">
                      <input
                        type="number"
                        min="0"
                        value={product.childNetPrice ?? ''}
                        onChange={e => handleProductChange(product.id, 'childNetPrice', Number(e.target.value))}
                        className="w-18 py-1 px-2 bg-slate-50 border border-slate-200 rounded font-mono text-xs focus:bg-white focus:border-[#00C6A6]"
                      />
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex items-center space-x-1">
                        <input
                          type="number"
                          min="0"
                          value={product.defaultMarkupPercent ?? product.buyerMarkupPercent ?? 20}
                          onChange={e => {
                            handleProductChange(product.id, 'defaultMarkupPercent', Number(e.target.value));
                            handleProductChange(product.id, 'buyerMarkupPercent', Number(e.target.value));
                          }}
                          className="w-16 py-1 px-2 bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold rounded font-mono text-xs focus:bg-white"
                        />
                        <span className="text-slate-400 text-[10px]">%</span>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <input
                        type="number"
                        min="0"
                        value={product.taxPercent ?? 0}
                        onChange={e => handleProductChange(product.id, 'taxPercent', Number(e.target.value))}
                        className="w-14 py-1 px-2 bg-slate-50 border border-slate-200 rounded font-mono text-xs"
                      />
                    </td>

                    <td className="py-3 px-3">
                      <input
                        type="number"
                        min="0"
                        value={product.serviceFeeFixed ?? 0}
                        onChange={e => handleProductChange(product.id, 'serviceFeeFixed', Number(e.target.value))}
                        className="w-14 py-1 px-2 bg-slate-50 border border-slate-200 rounded font-mono text-xs"
                      />
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-bold font-mono text-[#008972] text-xs">
                        {formatCurrency(product.sellingPriceStartingFrom, currentCurrency)}
                      </div>
                      <div className="text-[9px] text-slate-400">
                        {currentCurrency} Final Calculated
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <button
                        type="button"
                        onClick={() => setEditingTierProduct(product)}
                        className={`inline-flex items-center space-x-1 px-2 py-1 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                          isTiered 
                            ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' 
                            : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        <Layers className="w-3 h-3" />
                        <span>{product.tieredPricing?.length ? `${product.tieredPricing.length} Tiers` : 'Edit Tiers'}</span>
                      </button>
                    </td>

                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleSaveSingleProduct(product)}
                        className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                        title="Save this product price"
                      >
                        <Save className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    No products matched your pricing filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tiered Pricing Modal */}
      {editingTierProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div>
                <span className="text-[10px] font-bold text-slate-400 font-mono">{editingTierProduct.sku}</span>
                <h3 className="text-base font-bold text-slate-900">{editingTierProduct.name} - Tiered Pricing</h3>
              </div>
              <button
                onClick={() => setEditingTierProduct(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="font-bold text-slate-700 block mb-1">Pricing Scheme</span>
                <p className="text-slate-500 text-[11px]">
                  Configured Native Currency: <strong className="text-slate-900">{editingTierProduct.currency || 'USD'}</strong>. 
                  All tiers are evaluated during quoting based on group participant headcount.
                </p>
              </div>

              {/* Tiers List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">Passenger Capacity Tiers</span>
                  <button
                    type="button"
                    onClick={() => {
                      const currentTiers = editingTierProduct.tieredPricing || [];
                      const nextMin = currentTiers.length > 0 ? (currentTiers[currentTiers.length - 1].maxPax || 2) + 1 : 1;
                      const nextMax = nextMin + 1;
                      const newTier = {
                        id: `tier-${Date.now()}`,
                        tierId: `tier-${Date.now()}`,
                        capacityPricingRuleId: `CPR-${Date.now()}`,
                        productCategory: editingTierProduct.category,
                        tierLabel: `${nextMin}-${nextMax} Pax`,
                        minPax: nextMin,
                        maxPax: nextMax,
                        minPassengers: nextMin,
                        maxPassengers: nextMax,
                        vehicleCount: 1,
                        fleetId: editingTierProduct.vehicleId || 'FLEET-DEFAULT',
                        fleetName: editingTierProduct.vehicleNameSnapshot || 'Authoritative Fleet',
                        currency: editingTierProduct.currency || 'USD',
                        nativeCurrency: editingTierProduct.currency || 'USD',
                        nettPrice: undefined,
                        netCostPerPax: undefined,
                        marginType: 'PERCENTAGE' as const,
                        marginValue: editingTierProduct.defaultMarkupPercent || 20,
                        taxType: 'PERCENTAGE' as const,
                        taxValue: editingTierProduct.taxPercent || 10,
                        serviceChargeType: 'FIXED' as const,
                        serviceChargeValue: 0,
                        finalPrice: undefined,
                        sellingPricePerPax: undefined,
                        status: 'ACTIVE' as const
                      };
                      const updated = {
                        ...editingTierProduct,
                        pricingModel: 'CAPACITY_TIERED' as const,
                        pricingMethod: 'capacity_based' as const,
                        tieredPricing: [...currentTiers, newTier]
                      };
                      setEditingTierProduct(updated);
                    }}
                    className="inline-flex items-center space-x-1 text-[#00C6A6] font-bold hover:underline cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Tier</span>
                  </button>
                </div>

                {(editingTierProduct.tieredPricing || []).map((tier, idx) => (
                  <div key={tier.id || tier.tierId || idx} className="grid grid-cols-12 gap-2 items-center p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="col-span-3">
                      <label className="text-[9px] text-slate-400 block">Label</label>
                      <input
                        type="text"
                        value={tier.tierLabel || ''}
                        onChange={e => {
                          const updated = [...(editingTierProduct.tieredPricing || [])];
                          updated[idx] = { ...updated[idx], tierLabel: e.target.value };
                          setEditingTierProduct({ ...editingTierProduct, tieredPricing: updated });
                        }}
                        className="w-full p-1 bg-white border border-slate-200 rounded text-xs font-semibold"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[9px] text-slate-400 block">Min Pax</label>
                      <input
                        type="number"
                        min="1"
                        value={tier.minPax !== undefined ? tier.minPax : (tier.minPassengers !== undefined ? tier.minPassengers : '')}
                        onChange={e => {
                          const raw = e.target.value;
                          const v = raw === '' ? undefined : parseInt(raw, 10);
                          const updated = [...(editingTierProduct.tieredPricing || [])];
                          updated[idx] = { ...updated[idx], minPax: v as any, minPassengers: v as any };
                          setEditingTierProduct({ ...editingTierProduct, tieredPricing: updated });
                        }}
                        className="w-full p-1 bg-white border border-slate-200 rounded text-xs font-mono"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[9px] text-slate-400 block">Max Pax</label>
                      <input
                        type="number"
                        min="1"
                        value={tier.maxPax !== undefined ? tier.maxPax : (tier.maxPassengers !== undefined ? tier.maxPassengers : '')}
                        onChange={e => {
                          const raw = e.target.value;
                          const v = raw === '' ? undefined : parseInt(raw, 10);
                          const updated = [...(editingTierProduct.tieredPricing || [])];
                          updated[idx] = { ...updated[idx], maxPax: v as any, maxPassengers: v as any };
                          setEditingTierProduct({ ...editingTierProduct, tieredPricing: updated });
                        }}
                        className="w-full p-1 bg-white border border-slate-200 rounded text-xs font-mono"
                      />
                    </div>
                    <div className="col-span-1">
                      <label className="text-[9px] text-slate-400 block" title="Vehicles Required">Vehicles</label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={tier.vehicleCount || 1}
                        onChange={e => {
                          const raw = e.target.value;
                          const v = raw === '' ? 1 : Math.max(1, parseInt(raw, 10) || 1);
                          const updated = [...(editingTierProduct.tieredPricing || [])];
                          updated[idx] = { ...updated[idx], vehicleCount: v };
                          setEditingTierProduct({ ...editingTierProduct, tieredPricing: updated });
                        }}
                        className="w-full p-1 bg-white border border-slate-200 rounded text-xs font-bold text-center text-[#008972]"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[9px] text-slate-400 block">Nett Cost</label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={tier.nettPrice !== undefined ? tier.nettPrice : (tier.netCostPerPax !== undefined ? tier.netCostPerPax : '')}
                        onChange={e => {
                          const raw = e.target.value;
                          const updated = [...(editingTierProduct.tieredPricing || [])];
                          if (raw === '') {
                            updated[idx] = {
                              ...updated[idx],
                              nettPrice: undefined,
                              netCostPerPax: undefined,
                              finalPrice: undefined,
                              sellingPricePerPax: undefined
                            };
                          } else {
                            const netVal = parseFloat(raw);
                            if (!isNaN(netVal)) {
                              const markup = editingTierProduct.defaultMarkupPercent ?? 20;
                              const fin = Math.round(netVal * (1 + markup / 100));
                              updated[idx] = { 
                                ...updated[idx], 
                                netCostPerPax: netVal,
                                nettPrice: netVal,
                                finalPrice: fin,
                                sellingPricePerPax: fin
                              };
                            }
                          }
                          setEditingTierProduct({ ...editingTierProduct, tieredPricing: updated });
                        }}
                        placeholder="Nett"
                        className="w-full p-1 bg-white border border-slate-200 rounded text-xs font-mono font-bold text-slate-900"
                      />
                    </div>
                    <div className="col-span-1">
                      <label className="text-[9px] text-slate-400 block">Selling</label>
                      <span className="font-mono font-bold text-[#008972] text-xs block py-1">
                        {tier.finalPrice !== undefined ? tier.finalPrice : (tier.sellingPricePerPax !== undefined ? tier.sellingPricePerPax : '—')}
                      </span>
                    </div>
                    <div className="col-span-1 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          const updated = (editingTierProduct.tieredPricing || []).filter((_, i) => i !== idx);
                          setEditingTierProduct({ ...editingTierProduct, tieredPricing: updated });
                        }}
                        className="p-1 text-rose-500 hover:text-rose-700 cursor-pointer"
                        title="Remove tier"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingTierProduct(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleSaveSingleProduct(editingTierProduct);
                    setProducts(prev => prev.map(p => p.id === editingTierProduct.id ? editingTierProduct : p));
                    setEditingTierProduct(null);
                  }}
                  className="px-5 py-2 bg-[#00C6A6] hover:bg-[#008972] text-slate-950 font-bold rounded-xl shadow-md cursor-pointer"
                >
                  Save Tiered Pricing
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
