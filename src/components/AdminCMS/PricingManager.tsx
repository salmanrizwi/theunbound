import React, { useState } from 'react';
import { Product, CurrencyCode, Destination } from '../../types';
import { AppDatabase } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../services/pricingEngine';
import { 
  DollarSign, 
  Search, 
  Filter, 
  Save, 
  RefreshCw, 
  CheckCircle2, 
  Percent, 
  TrendingUp, 
  Sliders, 
  ShieldCheck,
  Building2,
  Calendar,
  AlertCircle
} from 'lucide-react';

interface PricingManagerProps {
  destinations: Destination[];
}

export const PricingManager: React.FC<PricingManagerProps> = ({ destinations }) => {
  const db = AppDatabase.getInstance();
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>(() => db.getProducts());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDestination, setSelectedDestination] = useState('ALL');
  const [selectedSeason, setSelectedSeason] = useState('ALL');
  const [savedSuccess, setSavedSuccess] = useState(false);

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
        const markup = Number(updated.defaultMarkupPercent) || 20;
        const tax = Number(updated.taxPercent) || 10;
        const fee = Number(updated.serviceFeeFixed) || 0;
        const gross = net * (1 + markup / 100);
        const withTax = gross * (1 + tax / 100);
        updated.sellingPriceStartingFrom = Math.round(withTax + fee);

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

  const handleApplyGlobalMarkup = () => {
    if (typeof globalMarkupAdjust !== 'number') return;
    setProducts(prev =>
      prev.map(p => {
        const net = Number(p.adultNetPrice) || 0;
        const tax = Number(p.taxPercent) || 10;
        const fee = Number(p.serviceFeeFixed) || 0;
        const gross = net * (1 + globalMarkupAdjust / 100);
        const withTax = gross * (1 + tax / 100);
        return {
          ...p,
          defaultMarkupPercent: globalMarkupAdjust,
          sellingPriceStartingFrom: Math.round(withTax + fee)
        };
      })
    );
  };

  const filtered = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.city.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDest = selectedDestination === 'ALL' || p.destinationId === selectedDestination;
    const matchesSeason = selectedSeason === 'ALL' || p.season === selectedSeason;
    return matchesSearch && matchesDest && matchesSeason;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2 text-[#00C6A6] text-xs font-bold uppercase tracking-wider mb-1">
            <DollarSign className="w-4 h-4" />
            <span>Dynamic Commercial Matrix</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">Pricing & Commercial Margin Manager</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage cost prices, contracted wholesale net tariffs, adult/child margins, taxes, and validity dates without code edits.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {savedSuccess && (
            <span className="inline-flex items-center space-x-1 text-emerald-600 text-xs font-bold bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Changes Saved to Database!</span>
            </span>
          )}
          <button
            onClick={handleSaveAll}
            className="inline-flex items-center space-x-2 bg-[#00C6A6] hover:bg-[#008972] text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs transition-all shadow-md cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Save Pricing Updates</span>
          </button>
        </div>
      </div>

      {/* Global Margin Tool */}
      <div className="bg-slate-900 text-white p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-[#00C6A6]/20 border border-[#00C6A6]/40 flex items-center justify-center text-[#00E5C0]">
            <Percent className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#00E5C0]">Batch Commercial Override</h4>
            <p className="text-xs text-slate-300">Set standard gross margin % across all displayed inventory rows.</p>
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
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
                <th className="py-3 px-3">Currency</th>
                <th className="py-3 px-3">Adult Net Cost</th>
                <th className="py-3 px-3">Child Net Cost</th>
                <th className="py-3 px-3">Markup %</th>
                <th className="py-3 px-3">Tax %</th>
                <th className="py-3 px-3">Fee ($)</th>
                <th className="py-3 px-4">Calculated Selling</th>
                <th className="py-3 px-3">Season</th>
                <th className="py-3 px-3">Validity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(product => (
                <tr key={product.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4">
                    <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-semibold border border-slate-200">
                      {product.sku}
                    </span>
                    <div className="font-bold text-slate-900 text-xs mt-0.5 max-w-xs truncate">
                      {product.name}
                    </div>
                    <div className="text-[10px] text-slate-400">{product.destinationName} • {product.supplierName}</div>
                  </td>

                  <td className="py-3 px-3">
                    <select
                      value={product.currency}
                      onChange={e => handleProductChange(product.id, 'currency', e.target.value)}
                      className="py-1 px-2 bg-slate-50 border border-slate-200 rounded font-mono text-[11px]"
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                      <option value="JPY">JPY</option>
                    </select>
                  </td>

                  <td className="py-3 px-3">
                    <input
                      type="number"
                      min="0"
                      value={product.adultNetPrice}
                      onChange={e => handleProductChange(product.id, 'adultNetPrice', Number(e.target.value))}
                      className="w-20 py-1 px-2 bg-slate-50 border border-slate-200 rounded font-mono font-bold text-slate-900 text-xs focus:bg-white focus:border-[#00C6A6]"
                    />
                  </td>

                  <td className="py-3 px-3">
                    <input
                      type="number"
                      min="0"
                      value={product.childNetPrice}
                      onChange={e => handleProductChange(product.id, 'childNetPrice', Number(e.target.value))}
                      className="w-18 py-1 px-2 bg-slate-50 border border-slate-200 rounded font-mono text-xs focus:bg-white focus:border-[#00C6A6]"
                    />
                  </td>

                  <td className="py-3 px-3">
                    <div className="flex items-center space-x-1">
                      <input
                        type="number"
                        min="0"
                        value={product.defaultMarkupPercent}
                        onChange={e => handleProductChange(product.id, 'defaultMarkupPercent', Number(e.target.value))}
                        className="w-16 py-1 px-2 bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold rounded font-mono text-xs focus:bg-white"
                      />
                      <span className="text-slate-400 text-[10px]">%</span>
                    </div>
                  </td>

                  <td className="py-3 px-3">
                    <input
                      type="number"
                      min="0"
                      value={product.taxPercent}
                      onChange={e => handleProductChange(product.id, 'taxPercent', Number(e.target.value))}
                      className="w-14 py-1 px-2 bg-slate-50 border border-slate-200 rounded font-mono text-xs"
                    />
                  </td>

                  <td className="py-3 px-3">
                    <input
                      type="number"
                      min="0"
                      value={product.serviceFeeFixed}
                      onChange={e => handleProductChange(product.id, 'serviceFeeFixed', Number(e.target.value))}
                      className="w-14 py-1 px-2 bg-slate-50 border border-slate-200 rounded font-mono text-xs"
                    />
                  </td>

                  <td className="py-3 px-4">
                    <span className="font-bold font-mono text-[#008972] text-xs">
                      {formatCurrency(product.sellingPriceStartingFrom, product.currency)}
                    </span>
                  </td>

                  <td className="py-3 px-3">
                    <select
                      value={product.season}
                      onChange={e => handleProductChange(product.id, 'season', e.target.value)}
                      className="py-1 px-2 bg-slate-50 border border-slate-200 rounded text-[11px]"
                    >
                      <option value="All Year">All Year</option>
                      <option value="High">High</option>
                      <option value="Shoulder">Shoulder</option>
                      <option value="Low">Low</option>
                    </select>
                  </td>

                  <td className="py-3 px-3 text-[10px] text-slate-400 font-mono">
                    {product.validityTo || '2026-12-31'}
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    No products matched your pricing filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
