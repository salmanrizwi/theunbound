import React, { useState } from 'react';
import { Product, ProductCategory, CurrencyCode, Destination, Supplier } from '../../types';
import { AppDatabase } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { SUPPLIERS } from '../../data/suppliers';
import { formatCurrency } from '../../services/pricingEngine';
import { 
  Package, 
  Plus, 
  Edit3, 
  Copy, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Search, 
  Filter, 
  Eye, 
  DollarSign, 
  Layers, 
  Clock, 
  MapPin, 
  Check, 
  AlertTriangle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface ProductManagerProps {
  destinations: Destination[];
  onViewProduct?: (product: Product) => void;
}

const CATEGORIES: ProductCategory[] = [
  'Tours', 'Hotels', 'Activities', 'Transfers', 'Rail', 'Ferries', 'Cruises', 'Private Tours', 'Day Trips', 'Guides', 'Transport', 'Travel Services'
];

export const ProductManager: React.FC<ProductManagerProps> = ({ destinations, onViewProduct }) => {
  const db = AppDatabase.getInstance();
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>(() => db.getProducts());
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDestination, setSelectedDestination] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'name' | 'price-asc' | 'price-desc' | 'updated'>('updated');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<Product>>({
    sku: '',
    name: '',
    destinationId: destinations[0]?.id || 'dest-japan',
    destinationName: destinations[0]?.name || 'Japan',
    country: 'Japan',
    city: 'Tokyo',
    productType: 'Private Day Tour',
    category: 'Private Tours',
    subcategory: 'Cultural & Heritage',
    duration: '8 Hours',
    operatingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    operatingHours: '09:00 - 17:00',
    adultNetPrice: 350,
    childNetPrice: 200,
    infantNetPrice: 0,
    currency: 'USD',
    defaultMarkupPercent: 30,
    buyerMarkupPercent: 30,
    b2bAgentMarkupPercent: 20,
    taxPercent: 10,
    commissionPercent: 10,
    serviceFeeFixed: 25,
    sellingPriceStartingFrom: 462,
    optionalUpgradeProductIds: [],
    shortDescription: '',
    longDescription: '',
    supplierId: SUPPLIERS[0]?.id || 'supp-01',
    supplierName: SUPPLIERS[0]?.name || 'Tokyo Luxury Transport & Guide Services Ltd',
    supplierProductCode: '',
    season: 'All Year',
    validityFrom: '2026-01-01',
    validityTo: '2026-12-31',
    minPax: 1,
    maxPax: 8,
    availability: 'INSTANT',
    bookingRequiredDays: 2,
    cancellationPolicy: 'Free cancellation up to 72 hours prior to service date.',
    inclusions: ['Private bilingual Blue Badge guide', 'Luxury Alphard Executive MPV charter'],
    exclusions: ['Client personal meals and temple entrance fees'],
    importantInformation: ['Please provide guest flight arrival details in advance.'],
    meetingPoint: 'Hotel Lobby Pick-up in Tokyo Central',
    pickupInformation: 'Driver will meet guests at designated hotel concierge desk.',
    images: ['https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=800&auto=format&fit=crop'],
    location: 'Tokyo, Japan',
    latitude: 35.6762,
    longitude: 139.6503,
    rating: 4.9,
    reviewCount: 28,
    status: 'ACTIVE'
  });

  const [inclusionInput, setInclusionInput] = useState('');
  const [exclusionInput, setExclusionInput] = useState('');

  const refreshProducts = () => {
    setProducts(db.getProducts());
  };

  const handleOpenCreate = () => {
    setEditingProduct(null);
    const skuGenerated = `UB-${destinations[0]?.name?.substring(0, 3).toUpperCase() || 'GLB'}-${Math.floor(100 + Math.random() * 900)}`;
    setFormData({
      sku: skuGenerated,
      name: '',
      destinationId: destinations[0]?.id || 'dest-japan',
      destinationName: destinations[0]?.name || 'Japan',
      country: 'Japan',
      city: 'Tokyo',
      productType: 'Private VIP Experience',
      category: 'Private Tours',
      subcategory: 'Culture & Luxury',
      duration: '8 Hours',
      operatingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      operatingHours: '09:00 - 17:00',
      adultNetPrice: 400,
      childNetPrice: 250,
      infantNetPrice: 0,
      currency: 'USD',
      defaultMarkupPercent: 30,
      buyerMarkupPercent: 30,
      b2bAgentMarkupPercent: 20,
      taxPercent: 10,
      commissionPercent: 10,
      serviceFeeFixed: 20,
      sellingPriceStartingFrom: 528,
      optionalUpgradeProductIds: [],
      shortDescription: '',
      longDescription: '',
      supplierId: SUPPLIERS[0]?.id || 'supp-01',
      supplierName: SUPPLIERS[0]?.name || 'Ground Supplier',
      supplierProductCode: skuGenerated,
      season: 'All Year',
      validityFrom: '2026-01-01',
      validityTo: '2026-12-31',
      minPax: 1,
      maxPax: 8,
      availability: 'INSTANT',
      bookingRequiredDays: 2,
      cancellationPolicy: 'Free cancellation up to 72 hours prior to service.',
      inclusions: ['Private guide', 'Private luxury transport'],
      exclusions: ['Meals and personal expenses'],
      importantInformation: ['Valid passport required.'],
      meetingPoint: 'Hotel Lobby Pick-up',
      pickupInformation: 'Chauffeur will hold digital nameboard in lobby.',
      images: ['https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=800&auto=format&fit=crop'],
      location: 'Tokyo, Japan',
      latitude: 35.6762,
      longitude: 139.6503,
      rating: 5.0,
      reviewCount: 0,
      status: 'ACTIVE'
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      ...product,
      buyerMarkupPercent: product.buyerMarkupPercent !== undefined ? product.buyerMarkupPercent : (product.defaultMarkupPercent || 30),
      b2bAgentMarkupPercent: product.b2bAgentMarkupPercent !== undefined ? product.b2bAgentMarkupPercent : 20,
      optionalUpgradeProductIds: product.optionalUpgradeProductIds || []
    });
    setIsModalOpen(true);
  };

  const handleDuplicate = (productId: string) => {
    const dup = db.duplicateProduct(productId, user);
    if (dup) {
      refreshProducts();
    }
  };

  const handleDelete = (productId: string) => {
    if (confirm('Are you sure you want to archive/delete this product?')) {
      db.deleteProduct(productId, user);
      refreshProducts();
    }
  };

  const handleToggleStatus = (product: Product) => {
    const nextStatus = product.status === 'ACTIVE' ? 'DRAFT' : 'ACTIVE';
    db.saveProduct({ ...product, status: nextStatus }, user);
    refreshProducts();
  };

  const calculateSellingPrice = (net: number, markup: number, tax: number, fee: number) => {
    const markupAmt = net * (markup / 100);
    const taxAmt = markupAmt * (tax / 100);
    return Math.round(net + markupAmt + taxAmt + fee);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.sku) return;

    const adultNet = Number(formData.adultNetPrice) || 0;
    const childNet = Number(formData.childNetPrice) || 0;
    const infantNet = Number(formData.infantNetPrice) || 0;
    const buyerMarkup = Number(formData.buyerMarkupPercent) || Number(formData.defaultMarkupPercent) || 30;
    const b2bAgentMarkup = Number(formData.b2bAgentMarkupPercent) || 20;
    const tax = Number(formData.taxPercent) || 10;
    const fee = Number(formData.serviceFeeFixed) || 0;
    const computedSelling = calculateSellingPrice(adultNet, buyerMarkup, tax, fee);

    const productToSave: Product = {
      id: editingProduct ? editingProduct.id : `prod-${Date.now()}`,
      sku: formData.sku || `SKU-${Date.now()}`,
      destinationId: formData.destinationId || destinations[0]?.id || 'dest-japan',
      destinationName: destinations.find(d => d.id === formData.destinationId)?.name || formData.destinationName || 'Japan',
      country: formData.country || 'Japan',
      city: formData.city || 'Tokyo',
      productType: formData.productType || 'Private Tour',
      name: formData.name || '',
      shortDescription: formData.shortDescription || '',
      longDescription: formData.longDescription || formData.shortDescription || '',
      supplierId: formData.supplierId || SUPPLIERS[0]?.id || 'supp-01',
      supplierName: SUPPLIERS.find(s => s.id === formData.supplierId)?.name || formData.supplierName || 'Ground Supplier',
      supplierProductCode: formData.supplierProductCode || formData.sku || '',
      category: (formData.category as ProductCategory) || 'Private Tours',
      subcategory: formData.subcategory || 'Luxury & Culture',
      duration: formData.duration || 'Full Day',
      operatingDays: formData.operatingDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      operatingHours: formData.operatingHours || '09:00 - 18:00',
      adultNetPrice: adultNet,
      childNetPrice: childNet,
      infantNetPrice: infantNet,
      adultNettCost: adultNet,
      childNettCost: childNet,
      infantNettCost: infantNet,
      currency: (formData.currency as CurrencyCode) || 'USD',
      defaultMarkupPercent: buyerMarkup,
      buyerMarkupPercent: buyerMarkup,
      b2bAgentMarkupPercent: b2bAgentMarkup,
      taxPercent: tax,
      commissionPercent: Number(formData.commissionPercent) || 10,
      serviceFeeFixed: fee,
      sellingPriceStartingFrom: computedSelling,
      optionalUpgradeProductIds: formData.optionalUpgradeProductIds || [],
      season: (formData.season as any) || 'All Year',
      validityFrom: formData.validityFrom || '2026-01-01',
      validityTo: formData.validityTo || '2026-12-31',
      minPax: Number(formData.minPax) || 1,
      maxPax: Number(formData.maxPax) || 10,
      availability: (formData.availability as any) || 'INSTANT',
      bookingRequiredDays: Number(formData.bookingRequiredDays) || 2,
      cancellationPolicy: formData.cancellationPolicy || 'Standard 72-hour notice.',
      inclusions: formData.inclusions || [],
      exclusions: formData.exclusions || [],
      importantInformation: formData.importantInformation || [],
      meetingPoint: formData.meetingPoint || 'Hotel Lobby',
      pickupInformation: formData.pickupInformation || 'Concierge Desk Pick-up',
      images: formData.images && formData.images.length > 0 ? formData.images : ['https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=800&auto=format&fit=crop'],
      location: `${formData.city || 'Tokyo'}, ${formData.country || 'Japan'}`,
      latitude: formData.latitude || 35.6762,
      longitude: formData.longitude || 139.6503,
      rating: formData.rating || 4.9,
      reviewCount: formData.reviewCount || 10,
      status: formData.status || 'ACTIVE',
      lastUpdated: new Date().toISOString().split('T')[0]
    };

    db.saveProduct(productToSave, user);
    refreshProducts();
    setIsModalOpen(false);
  };

  // Filter and Sort Logic
  const filtered = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.supplierName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDest = selectedDestination === 'ALL' || p.destinationId === selectedDestination;
    const matchesCat = selectedCategory === 'ALL' || p.category === selectedCategory;
    const matchesStat = selectedStatus === 'ALL' || p.status === selectedStatus;
    return matchesSearch && matchesDest && matchesCat && matchesStat;
  }).sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'price-asc') return a.adultNetPrice - b.adultNetPrice;
    if (sortBy === 'price-desc') return b.adultNetPrice - a.adultNetPrice;
    return (b.lastUpdated || '').localeCompare(a.lastUpdated || '');
  });

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2 text-[#00C6A6] text-xs font-bold uppercase tracking-wider mb-1">
            <Package className="w-4 h-4" />
            <span>Master Product Database</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">Product Management Engine ({products.length} Items)</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Create, edit, duplicate, set availability rules, net supplier rates, and wholesale commercial margins.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center space-x-2 bg-[#00C6A6] hover:bg-[#008972] text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-sm cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Product</span>
        </button>
      </div>

      {/* Search & Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
        <div className="relative md:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            placeholder="Search by title, SKU, city, supplier..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#00C6A6]"
          />
        </div>

        <div>
          <select
            value={selectedDestination}
            onChange={e => { setSelectedDestination(e.target.value); setCurrentPage(1); }}
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
            value={selectedCategory}
            onChange={e => { setSelectedCategory(e.target.value); setCurrentPage(1); }}
            className="w-full py-2 px-3 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#00C6A6]"
          >
            <option value="ALL">All Categories</option>
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={selectedStatus}
            onChange={e => { setSelectedStatus(e.target.value); setCurrentPage(1); }}
            className="w-full py-2 px-3 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#00C6A6]"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active (Live)</option>
            <option value="DRAFT">Draft</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">SKU / Product</th>
                <th className="py-3 px-4">Destination & Category</th>
                <th className="py-3 px-4">Net Cost (Adult)</th>
                <th className="py-3 px-4">Markup & Tax</th>
                <th className="py-3 px-4">Selling Price</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginated.map(product => (
                <tr key={product.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center space-x-3">
                      <img
                        src={product.images[0] || 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=200&auto=format&fit=crop'}
                        alt={product.name}
                        className="w-12 h-10 rounded-lg object-cover bg-slate-100 shrink-0 border border-slate-200"
                      />
                      <div>
                        <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-semibold border border-slate-200">
                          {product.sku}
                        </span>
                        <div className="font-bold text-slate-900 text-xs mt-0.5 max-w-xs truncate">
                          {product.name}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {product.city}, {product.country} • {product.duration}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="space-y-1">
                      <span className="inline-block text-[10px] bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded">
                        {product.destinationName}
                      </span>
                      <div className="text-[11px] text-slate-500 font-medium">
                        {product.category}
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-bold font-mono text-slate-900 text-xs">
                      {formatCurrency(product.adultNetPrice, product.currency)}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Child: {formatCurrency(product.childNetPrice, product.currency)}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="text-[11px] space-y-0.5">
                      <div>Markup: <strong className="text-emerald-700">+{product.defaultMarkupPercent}%</strong></div>
                      <div className="text-slate-400 text-[10px]">Tax: +{product.taxPercent}% • Fee: ${product.serviceFeeFixed}</div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-bold font-mono text-[#008972] text-xs">
                      {formatCurrency(product.sellingPriceStartingFrom, product.currency)}
                    </div>
                    <span className="text-[10px] text-slate-400">Gross Quoted</span>
                  </td>
                  <td className="py-3.5 px-4">
                    <button
                      onClick={() => handleToggleStatus(product)}
                      className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${
                        product.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : product.status === 'DRAFT'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {product.status === 'ACTIVE' ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <Clock className="w-3 h-3" />}
                      <span>{product.status}</span>
                    </button>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end space-x-1.5">
                      {onViewProduct && (
                        <button
                          onClick={() => onViewProduct(product)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                          title="View Live Modal"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDuplicate(product.id)}
                        className="p-1.5 text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                        title="Duplicate Product"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenEdit(product)}
                        className="p-1.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                        title="Edit Specs"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="p-1.5 text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                        title="Archive Product"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No products found matching your search and filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <div>
              Showing <strong>{(currentPage - 1) * pageSize + 1}</strong> to <strong>{Math.min(currentPage * pageSize, filtered.length)}</strong> of <strong>{filtered.length}</strong> products
            </div>
            <div className="flex items-center space-x-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="p-1.5 bg-white border border-slate-200 rounded-lg disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-semibold text-slate-800">
                Page {currentPage} of {totalPages}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="p-1.5 bg-white border border-slate-200 rounded-lg disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit / Create Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {editingProduct ? `Edit Product: ${editingProduct.name}` : 'Create New Ground Product'}
                </h3>
                <p className="text-xs text-slate-500">Configure SKU, net pricing formulas, inclusions, and operational parameters.</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-2 rounded-full cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1 sm:col-span-2">
                  <label className="font-semibold text-slate-700">Product Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name || ''}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Kyoto Private Zen Temple & Tea Masterclass"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#00C6A6]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">SKU Code *</label>
                  <input
                    type="text"
                    required
                    value={formData.sku || ''}
                    onChange={e => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                    placeholder="e.g. JPN-KYO-001"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono uppercase focus:bg-white focus:outline-none focus:border-[#00C6A6]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Destination</label>
                  <select
                    value={formData.destinationId}
                    onChange={e => {
                      const dest = destinations.find(d => d.id === e.target.value);
                      setFormData({
                        ...formData,
                        destinationId: e.target.value,
                        destinationName: dest?.name || '',
                        country: dest?.country || 'Japan'
                      });
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    {destinations.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">City / Hub</label>
                  <input
                    type="text"
                    value={formData.city || ''}
                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                    placeholder="e.g. Kyoto, Tokyo, London"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Category</label>
                  <select
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value as ProductCategory })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    {CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Duration</label>
                  <input
                    type="text"
                    value={formData.duration || ''}
                    onChange={e => setFormData({ ...formData, duration: e.target.value })}
                    placeholder="e.g. 8 Hours, 3 Days"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              {/* Net Pricing Engine Specs */}
              <div className="bg-slate-900 text-white p-5 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[#00E5C0] font-bold text-xs flex items-center space-x-1.5">
                    <DollarSign className="w-4 h-4" />
                    <span>Product Nett Cost & User-Type Markup Engine</span>
                  </span>
                  <span className="text-[10px] text-slate-400">Stored in Product Base Currency</span>
                </div>

                {/* 1. Base Nett Costs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-800">
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-300 font-medium">Base Currency</label>
                    <select
                      value={formData.currency}
                      onChange={e => setFormData({ ...formData, currency: e.target.value as CurrencyCode })}
                      className="w-full p-2 bg-white rounded-lg font-bold"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="JPY">JPY (¥)</option>
                      <option value="INR">INR (₹)</option>
                      <option value="AED">AED (AED)</option>
                      <option value="THB">THB (฿)</option>
                      <option value="AUD">AUD (A$)</option>
                      <option value="CAD">CAD (CA$)</option>
                      <option value="SGD">SGD (S$)</option>
                      <option value="CHF">CHF (CHF)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-300 font-medium">Adult Nett Cost *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={formData.adultNetPrice || 0}
                      onChange={e => setFormData({ ...formData, adultNetPrice: Number(e.target.value) })}
                      className="w-full p-2 bg-white rounded-lg font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-300 font-medium">Child Nett Cost</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.childNetPrice || 0}
                      onChange={e => setFormData({ ...formData, childNetPrice: Number(e.target.value) })}
                      className="w-full p-2 bg-white rounded-lg"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-300 font-medium">Infant Nett Cost</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.infantNetPrice || 0}
                      onChange={e => setFormData({ ...formData, infantNetPrice: Number(e.target.value) })}
                      className="w-full p-2 bg-white rounded-lg"
                    />
                  </div>
                </div>

                {/* 2. User-Type Default Markups & Tax */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-800 pt-2 border-t border-slate-800">
                  <div className="space-y-1">
                    <label className="text-[11px] text-emerald-400 font-medium">Buyer Markup %</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.buyerMarkupPercent !== undefined ? formData.buyerMarkupPercent : 30}
                      onChange={e => setFormData({ ...formData, buyerMarkupPercent: Number(e.target.value), defaultMarkupPercent: Number(e.target.value) })}
                      className="w-full p-2 bg-white rounded-lg font-semibold"
                      placeholder="e.g. 30"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-cyan-400 font-medium">B2B Agent Markup %</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.b2bAgentMarkupPercent !== undefined ? formData.b2bAgentMarkupPercent : 20}
                      onChange={e => setFormData({ ...formData, b2bAgentMarkupPercent: Number(e.target.value) })}
                      className="w-full p-2 bg-white rounded-lg font-semibold"
                      placeholder="e.g. 20"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-300 font-medium">Tax % (on Margin)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.taxPercent || 10}
                      onChange={e => setFormData({ ...formData, taxPercent: Number(e.target.value) })}
                      className="w-full p-2 bg-white rounded-lg"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-300 font-medium">Fixed Service Fee</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.serviceFeeFixed || 0}
                      onChange={e => setFormData({ ...formData, serviceFeeFixed: Number(e.target.value) })}
                      className="w-full p-2 bg-white rounded-lg"
                    />
                  </div>
                </div>

                {/* 3. Dual Live Preview */}
                <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs border-t border-slate-800 bg-slate-950/60 p-3 rounded-xl">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-semibold">Direct Buyer Delivered Rate:</span>
                    <span className="text-base font-bold font-mono text-emerald-400">
                      {formatCurrency(
                        calculateSellingPrice(
                          formData.adultNetPrice || 0,
                          formData.buyerMarkupPercent !== undefined ? formData.buyerMarkupPercent : 30,
                          formData.taxPercent || 10,
                          formData.serviceFeeFixed || 0
                        ),
                        formData.currency || 'USD'
                      )}
                    </span>
                    <span className="text-[10px] text-slate-500 ml-1.5">(Net + {formData.buyerMarkupPercent || 30}% markup)</span>
                  </div>

                  <div className="sm:text-right">
                    <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-semibold">B2B Agent Delivered Rate:</span>
                    <span className="text-base font-bold font-mono text-[#00E5C0]">
                      {formatCurrency(
                        calculateSellingPrice(
                          formData.adultNetPrice || 0,
                          formData.b2bAgentMarkupPercent !== undefined ? formData.b2bAgentMarkupPercent : 20,
                          formData.taxPercent || 10,
                          formData.serviceFeeFixed || 0
                        ),
                        formData.currency || 'USD'
                      )}
                    </span>
                    <span className="text-[10px] text-slate-500 ml-1.5">(Net + {formData.b2bAgentMarkupPercent || 20}% markup)</span>
                  </div>
                </div>
              </div>

              {/* Optional Experience Upgrades (Upsell Tagging) */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 text-slate-800 font-bold text-xs">
                    <Layers className="w-4 h-4 text-[#00C6A6]" />
                    <span>Optional Experience Upgrades (Upsell Tagging)</span>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {(formData.optionalUpgradeProductIds || []).length} experience(s) selected
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Tag optional upgrades (exclusive tastings, private chauffeur, VIP admissions) that clients or travel agents can add during booking.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 bg-white rounded-xl border border-slate-200">
                  {products.filter(p => p.id !== (editingProduct?.id || '')).map(p => {
                    const isChecked = (formData.optionalUpgradeProductIds || []).includes(p.id);
                    return (
                      <label
                        key={p.id}
                        className={`flex items-start space-x-2.5 p-2 rounded-lg border transition-colors cursor-pointer text-xs ${
                          isChecked ? 'bg-[#00C6A6]/10 border-[#00C6A6]' : 'hover:bg-slate-50 border-slate-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            const current = formData.optionalUpgradeProductIds || [];
                            if (e.target.checked) {
                              setFormData({ ...formData, optionalUpgradeProductIds: [...current, p.id] });
                            } else {
                              setFormData({ ...formData, optionalUpgradeProductIds: current.filter(id => id !== p.id) });
                            }
                          }}
                          className="mt-0.5 rounded text-[#00C6A6] focus:ring-[#00C6A6]"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-slate-900 truncate">{p.name}</div>
                          <div className="text-[10px] text-slate-500 flex items-center justify-between mt-0.5">
                            <span>{p.city} • {p.category}</span>
                            <span className="font-mono font-bold text-slate-700">{formatCurrency(p.adultNetPrice, p.currency)}</span>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Short & Long Description */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Short Summary</label>
                <textarea
                  rows={2}
                  value={formData.shortDescription || ''}
                  onChange={e => setFormData({ ...formData, shortDescription: e.target.value })}
                  placeholder="Key highlight sentence..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Full Itinerary Description</label>
                <textarea
                  rows={3}
                  value={formData.longDescription || ''}
                  onChange={e => setFormData({ ...formData, longDescription: e.target.value })}
                  placeholder="Detailed tour schedule, VIP benefits..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              {/* Image URL */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Primary Featured Image URL</label>
                <input
                  type="url"
                  value={formData.images?.[0] || ''}
                  onChange={e => setFormData({ ...formData, images: [e.target.value] })}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              {/* Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Availability Mode</label>
                  <select
                    value={formData.availability}
                    onChange={e => setFormData({ ...formData, availability: e.target.value as any })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="INSTANT">Instant Confirmation</option>
                    <option value="ON_REQUEST">On Request (24h turnaround)</option>
                    <option value="LIMITED">Limited Capacity</option>
                    <option value="SOLD_OUT">Sold Out</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Publication Status</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="ACTIVE">Active (Live in Quotation Engine)</option>
                    <option value="DRAFT">Draft (Under Review)</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#00C6A6] hover:bg-[#008972] text-slate-950 font-bold rounded-xl shadow-md cursor-pointer transition-colors"
                >
                  {editingProduct ? 'Update Product' : 'Save & Publish Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
