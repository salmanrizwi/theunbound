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
  ChevronDown,
  LayoutGrid,
  List,
  BookmarkCheck,
  X,
  Users,
  Sparkles,
  ArrowRight,
  Trash2
} from 'lucide-react';
import { Product, Destination } from '../../types';
import { useQuotation } from '../../context/QuotationContext';
import { formatCurrency } from '../../services/pricingEngine';
import { AddProductToQuoteModal } from './AddProductToQuoteModal';

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
  const { items, addProductToQuote, removeProductFromQuote, currency, setIsQuoteDrawerOpen } = useQuotation();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDestination, setSelectedDestination] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [selectedProductDetails, setSelectedProductDetails] = useState<Product | null>(null);
  const [selectedProductForQuoteModal, setSelectedProductForQuoteModal] = useState<Product | null>(null);
  const [quoteSuccessNotification, setQuoteSuccessNotification] = useState<{ product: Product; details: any } | null>(null);

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

  const handleOpenAddProductModal = (prod: Product) => {
    setSelectedProductForQuoteModal(prod);
  };

  const handleRemoveFromQuote = (productId: string) => {
    const existing = items.find(it => it.product.id === productId);
    if (existing) {
      removeProductFromQuote(existing.id);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full bg-[#00C6A6]/10 text-[#00a88c] border border-[#00C6A6]/20 text-[10px] font-bold uppercase tracking-wider">
              B2B Contracted Tariff Inventory
            </span>
            <span className="text-xs text-slate-400 font-mono">({products.length} Direct Wholesale SKUs)</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 font-sans mt-1">Tours, Transfers & Ground Products</h1>
          <p className="text-xs text-slate-500 max-w-2xl mt-0.5">
            Search private tours, chauffeured excursions, bullet train tickets, and exclusive museum VIP entries across all destinations.
          </p>
        </div>

        <button
          onClick={onOpenCreateQuote}
          className="inline-flex items-center space-x-2 bg-slate-900 hover:bg-[#00C6A6] hover:text-slate-950 text-white px-5 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer shadow-xs"
        >
          <span>Open Quotation Builder ({items.length} in Quote)</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Success Notification */}
      {quoteSuccessNotification && (
        <div className="bg-teal-900 text-white px-5 py-3.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg border border-[#00C6A6]/40 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-[#00C6A6] text-slate-950 flex items-center justify-center font-bold">
              <Check className="w-4 h-4 stroke-[3]" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">
                {quoteSuccessNotification.product.name} added to Cart!
              </div>
              <div className="text-[11px] text-[#00E5C0]">
                Scheduled for {quoteSuccessNotification.details?.travelDate || 'Selected Date'} ({quoteSuccessNotification.details?.adults || 2} Adults).
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => setIsQuoteDrawerOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-[#00C6A6] hover:bg-[#00E5C0] text-slate-950 text-xs font-black transition-all cursor-pointer shadow-xs flex items-center space-x-1.5"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>View Cart</span>
            </button>
            <button
              onClick={onOpenCreateQuote}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center space-x-1.5 border border-slate-700"
            >
              <span>Build Quote</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setQuoteSuccessNotification(null)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search tours by name, SKU, city (e.g. Tokyo VIP, teamLab, Edinburgh Castle, Swiss Pass)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-[#00C6A6] focus:bg-white transition-all"
          />
        </div>

        <div className="flex items-center space-x-2 w-full md:w-auto">
          <select
            value={selectedDestination}
            onChange={(e) => setSelectedDestination(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none cursor-pointer hover:border-slate-300"
          >
            <option value="ALL">All Destinations</option>
            {destinations.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none cursor-pointer hover:border-slate-300"
          >
            <option value="ALL">All Categories</option>
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'grid' ? 'bg-white shadow-xs text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'table' ? 'bg-white shadow-xs text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Table View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Grid Mode */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProducts.map(prod => {
            const inQuote = isProductInQuote(prod.id);
            return (
              <div
                key={prod.id}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:border-[#00C6A6] hover:shadow-md transition-all flex flex-col overflow-hidden group"
              >
                {/* Image */}
                <div className="relative h-44 overflow-hidden bg-slate-100">
                  <img
                    src={prod.heroImage || 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=800&auto=format&fit=crop'}
                    alt={prod.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-xs text-white px-2 py-0.5 rounded-md text-[10px] font-bold">
                    {prod.city}, {prod.country}
                  </div>
                  <div className="absolute top-3 right-3 bg-[#00C6A6] text-slate-950 px-2 py-0.5 rounded-md text-[10px] font-black uppercase">
                    {prod.category}
                  </div>
                </div>

                {/* Details */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm line-clamp-1 group-hover:text-[#00a88c] transition-colors">
                      {prod.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                      {prod.shortDescription}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center space-x-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-medium text-slate-700">{prod.duration || 'Flexible'}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center space-x-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="font-bold text-emerald-700">Direct SLA</span>
                    </div>
                  </div>

                  {/* Price Row */}
                  <div className="pt-2 border-t border-slate-100 flex items-baseline justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">B2B Net Tariff</span>
                      <span className="text-sm font-extrabold text-slate-900 font-mono">
                        {formatCurrency(prod.adultNetPrice, prod.currency || currency)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block font-medium">Suggested Retail</span>
                      <span className="text-xs font-bold text-emerald-600 font-mono">
                        {formatCurrency(prod.sellingPriceStartingFrom, prod.currency || currency)}
                      </span>
                    </div>
                  </div>

                    {/* 3 Standard Actions */}
                    <div className="space-y-1.5 pt-1">
                      {inQuote ? (
                        <div className="flex items-center space-x-1.5">
                          <button
                            onClick={() => handleOpenAddProductModal(prod)}
                            className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs"
                            title="Click to edit configuration in cart"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>In Cart (Edit)</span>
                          </button>
                          <button
                            onClick={() => handleRemoveFromQuote(prod.id)}
                            className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-colors cursor-pointer"
                            title="Remove from Quote"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleOpenAddProductModal(prod)}
                          className="w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs bg-[#00C6A6] hover:bg-[#00b395] text-slate-950"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Configure & Add to Quote</span>
                        </button>
                      )}

                    {/* Card Actions: View Details & Configure */}
                    <button
                      onClick={() => setSelectedProductDetails(prod)}
                      className="w-full py-2 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-500" />
                      <span>View Details</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
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
                  <th className="py-3 px-4 text-right">Actions</th>
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
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {isSelected ? (
                            <div className="flex items-center space-x-1">
                              <button
                                onClick={() => handleOpenAddProductModal(prod)}
                                className="px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white flex items-center space-x-1"
                                title="Click to edit configuration in cart"
                              >
                                <Check className="w-3 h-3" />
                                <span>In Cart (Edit)</span>
                              </button>
                              <button
                                onClick={() => handleRemoveFromQuote(prod.id)}
                                className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 border border-rose-200"
                                title="Remove from Cart"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleOpenAddProductModal(prod)}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer bg-[#00C6A6] hover:bg-[#00b395] text-slate-950 flex items-center space-x-1"
                              title="Configure & Add to Quote"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Configure & Add</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Standardized Product Details Modal (Fits Viewport, Fixed Header/Footer, Scrollable Body) */}
      {selectedProductDetails && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-hidden"
          onClick={() => setSelectedProductDetails(null)}
        >
          <div 
            className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-pop-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Fixed Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
              <div>
                <span className="text-[10px] font-bold text-[#00a88c] uppercase tracking-wider block">
                  {selectedProductDetails.city}, {selectedProductDetails.country} • {selectedProductDetails.category}
                </span>
                <h2 className="text-lg font-black text-slate-900 font-sans">
                  {selectedProductDetails.name}
                </h2>
                <span className="text-xs text-slate-400 font-mono">SKU: {selectedProductDetails.sku}</span>
              </div>
              <button
                onClick={() => setSelectedProductDetails(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
              {selectedProductDetails.heroImage && (
                <div className="h-52 rounded-2xl overflow-hidden bg-slate-100">
                  <img
                    src={selectedProductDetails.heroImage}
                    alt={selectedProductDetails.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}

              <div className="space-y-2">
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Product Description</h4>
                <p className="text-slate-600 leading-relaxed">
                  {selectedProductDetails.longDescription || selectedProductDetails.shortDescription}
                </p>
              </div>

              {/* Inclusions & Exclusions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100 space-y-2">
                  <span className="font-bold text-emerald-900 uppercase text-[10px] tracking-wider block">Inclusions</span>
                  <ul className="space-y-1 text-emerald-950 text-[11px]">
                    {selectedProductDetails.inclusions?.map((inc, i) => (
                      <li key={i} className="flex items-start space-x-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{inc}</span>
                      </li>
                    )) || <li>Full ground logistics and licensed guide escort.</li>}
                  </ul>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-700 uppercase text-[10px] tracking-wider block">Terms & SLA</span>
                  <p className="text-slate-600 text-[11px]">
                    {selectedProductDetails.cancellationPolicy || 'Standard 48-hour free cancellation prior to service start date.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Fixed Footer */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0 gap-3">
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">B2B Net Tariff</span>
                <span className="text-base font-extrabold text-slate-900 font-mono">
                  {formatCurrency(selectedProductDetails.adultNetPrice, selectedProductDetails.currency || currency)}
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setSelectedProductDetails(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-white text-slate-700 font-bold text-xs cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    const p = selectedProductDetails;
                    setSelectedProductDetails(null);
                    handleOpenAddProductModal(p);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-[#00C6A6] hover:bg-[#00b395] text-slate-950 font-black text-xs transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Configure & Add to Quote</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Add Product to Quote Modal */}
      <AddProductToQuoteModal
        product={selectedProductForQuoteModal}
        isOpen={Boolean(selectedProductForQuoteModal)}
        onClose={() => setSelectedProductForQuoteModal(null)}
        onSuccess={(product, details) => {
          setQuoteSuccessNotification({
            product,
            details
          });
        }}
      />
    </div>
  );
};
