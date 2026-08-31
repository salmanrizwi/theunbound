import React, { useState, useMemo } from 'react';
import { 
  ShoppingBag, 
  Search, 
  Filter, 
  MapPin, 
  Clock, 
  Plus, 
  Check, 
  Eye, 
  ShieldCheck, 
  Layers,
  ChevronDown
} from 'lucide-react';
import { Product, Destination } from '../../types';
import { useQuotation } from '../../context/QuotationContext';
import { formatCurrency } from '../../services/pricingEngine';

interface B2BProductsCatalogViewProps {
  products: Product[];
  destinations: Destination[];
  onOpenCreateQuote: () => void;
}

export const B2BProductsCatalogView: React.FC<B2BProductsCatalogViewProps> = ({
  products,
  destinations,
  onOpenCreateQuote
}) => {
  const { items, addProductToQuote, removeProductFromQuote, currency } = useQuotation();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDestination, setSelectedDestination] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedProductDetails, setSelectedProductDetails] = useState<Product | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.shortDescription.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.country.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesDest = selectedDestination === 'ALL' || p.destinationId === selectedDestination || p.country.toLowerCase() === selectedDestination.toLowerCase();
      const matchesCat = selectedCategory === 'ALL' || p.category === selectedCategory;

      return matchesSearch && matchesDest && matchesCat;
    });
  }, [products, searchQuery, selectedDestination, selectedCategory]);

  const isProductInQuote = (productId: string) => {
    return items.some(it => it.product.id === productId);
  };

  const toggleProduct = (prod: Product) => {
    const existing = items.find(it => it.product.id === prod.id);
    if (existing) {
      removeProductFromQuote(existing.id);
    } else {
      addProductToQuote(prod, {
        adults: 2,
        children: 0,
        infants: 0
      });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded-md bg-teal-100 text-teal-800 text-[10px] font-bold uppercase tracking-wider">
              B2B Contracted Tariff Inventory
            </span>
            <span className="text-xs text-slate-400">({products.length} Direct Wholesale SKUs)</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 font-sans mt-1">Wholesale Tours & Activities Catalog</h1>
          <p className="text-xs text-slate-500 max-w-2xl mt-0.5">
            Search private tours, chauffeured excursions, rail tickets, and exclusive museum VIP entries across all destinations.
          </p>
        </div>

        <button
          onClick={onOpenCreateQuote}
          className="inline-flex items-center space-x-2 bg-slate-900 hover:bg-[#00C6A6] hover:text-slate-950 text-white px-5 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer"
        >
          <span>Open Quotation Builder ({items.length} in Quote)</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search tours by name, SKU, city (e.g. Tokyo VIP, teamLab, Edinburgh Castle, Swiss Pass)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-[#00C6A6]"
          />
        </div>

        <div className="flex items-center space-x-2 w-full md:w-auto">
          <select
            value={selectedDestination}
            onChange={(e) => setSelectedDestination(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none cursor-pointer"
          >
            <option value="ALL">All Destinations</option>
            {destinations.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none cursor-pointer"
          >
            <option value="ALL">All Categories</option>
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Products High-Density Table / Grid */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold text-[10px]">
                <th className="py-3 px-4">SKU / Product Name</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Net Wholesale</th>
                <th className="py-3 px-4">Starting Retail</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map(prod => {
                const isSelected = isProductInQuote(prod.id);
                return (
                  <tr key={prod.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="font-bold text-slate-900 line-clamp-1">{prod.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{prod.sku || prod.id}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center space-x-1 font-medium text-slate-700">
                        <MapPin className="w-3 h-3 text-[#00C6A6]" />
                        <span>{prod.city}, {prod.country}</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700">
                        {prod.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-medium font-mono">
                      {prod.duration || 'Full Day'}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      {formatCurrency(prod.adultNetPrice, prod.currency || currency)}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-500">
                      {formatCurrency(prod.sellingPriceStartingFrom, prod.currency || currency)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => setSelectedProductDetails(prod)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                          title="View Tariff Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => toggleProduct(prod)}
                          className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-900 hover:bg-[#00C6A6] hover:text-slate-950 text-white'
                          }`}
                        >
                          {isSelected ? '✓ In Quote' : '+ Add'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Details Modal */}
      {selectedProductDetails && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold text-[#00C6A6] uppercase tracking-wider block">
                  {selectedProductDetails.city}, {selectedProductDetails.country} • {selectedProductDetails.category}
                </span>
                <h3 className="text-lg font-bold text-slate-900">{selectedProductDetails.name}</h3>
                <span className="text-xs text-slate-400 font-mono">SKU: {selectedProductDetails.sku}</span>
              </div>
              <button
                onClick={() => setSelectedProductDetails(null)}
                className="p-1.5 text-slate-400 hover:text-slate-900 rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {selectedProductDetails.longDescription || selectedProductDetails.shortDescription}
            </p>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 block">Adult Net Wholesale:</span>
                <span className="font-mono font-bold text-slate-900">
                  {formatCurrency(selectedProductDetails.adultNetPrice, selectedProductDetails.currency || currency)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Child Net Wholesale:</span>
                <span className="font-mono font-bold text-slate-900">
                  {formatCurrency(selectedProductDetails.childNetPrice, selectedProductDetails.currency || currency)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Cancellation Policy:</span>
                <span className="text-slate-700 text-[11px]">{selectedProductDetails.cancellationPolicy || 'Standard 48-hour terms.'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Instant SLA Availability:</span>
                <span className="text-emerald-700 font-bold">Guaranteed Direct Confirmation</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => setSelectedProductDetails(null)}
                className="text-xs font-bold text-slate-500 hover:text-slate-900"
              >
                Close
              </button>

              <button
                onClick={() => {
                  toggleProduct(selectedProductDetails);
                  setSelectedProductDetails(null);
                }}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-[#00C6A6] hover:text-slate-950 text-white text-xs font-bold transition-all cursor-pointer"
              >
                {isProductInQuote(selectedProductDetails.id) ? 'Remove from Quote' : 'Add to Active Quote'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
