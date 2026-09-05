import React, { useState, useEffect } from 'react';
import { Product, ProductCategory, CurrencyCode, Destination, Supplier, DestinationRegionItem, CityHub, MasterRegion, ProductPricingMethod, TransferVehicleConfig } from '../../types';
import { AppDatabase } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { SUPPLIERS } from '../../data/suppliers';
import { formatCurrency, CAPACITY_BASED_CATEGORIES } from '../../services/pricingEngine';
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
  ChevronRight,
  Image as ImageIcon,
  Sparkles,
  Building2,
  Globe2,
  Building,
  Upload,
  Camera,
  RefreshCw,
  Link2,
  Car,
  Ship,
  Anchor,
  Users,
  Calculator,
  ShieldAlert,
  Gauge
} from 'lucide-react';
import { fileToDataUrl, convertUnsplashUrl, fetchUnsplashImagesByQuery } from '../../utils/imageUtils';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { EntitySEOSettingsTab } from './EntitySEOSettingsTab';

interface ProductManagerProps {
  destinations: Destination[];
  onViewProduct?: (product: Product) => void;
}

const CATEGORIES: ProductCategory[] = [
  'Private Tours', 'Day Trips', 'Activities', 'Transfers', 'Transport', 'Private Yacht', 'Tours', 'Rail', 'Ferries', 'Guides', 'Travel Services'
];

export const ProductManager: React.FC<ProductManagerProps> = ({ destinations, onViewProduct }) => {
  const db = AppDatabase.getInstance();
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>(() => db.getProducts());
  const [masterRegions, setMasterRegions] = useState<MasterRegion[]>(() => db.getMasterRegions());
  const [regions, setRegions] = useState<DestinationRegionItem[]>(() => db.getRegions());
  const [cityHubs, setCityHubs] = useState<CityHub[]>(() => db.getCityHubs());
  
  useEffect(() => {
    return db.subscribe(() => {
      setProducts(db.getProducts());
      setMasterRegions(db.getMasterRegions());
      setRegions(db.getRegions());
      setCityHubs(db.getCityHubs());
    });
  }, []);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMasterRegion, setSelectedMasterRegion] = useState<string>('ALL');
  const [selectedDestination, setSelectedDestination] = useState<string>('ALL');
  const [selectedCityHub, setSelectedCityHub] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'name' | 'price-asc' | 'price-desc' | 'updated'>('updated');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [modalTab, setModalTab] = useState<'CONTENT' | 'SEO'>('CONTENT');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<Product>>({
    sku: '',
    name: '',
    destinationId: destinations[0]?.id || 'dest-japan',
    destinationName: destinations[0]?.name || 'Japan',
    regionId: '',
    regionName: '',
    hubId: '',
    country: 'Japan',
    city: 'Tokyo',
    productType: 'Private Day Tour',
    category: 'Private Tours',
    subcategory: 'Cultural & Heritage',
    duration: '8 Hours',
    operatingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    operatingHours: '09:00 - 17:00',
    pricingMethod: 'capacity_based',
    vehicleConfig: {
      vehicleModel: 'Toyota Hiace Grand Cabin (7-Seater)',
      vehicleType: 'Executive MPV / Van',
      maxSeats: 7,
      unitVehicleNetCost: 500,
      adultSeatCount: 1,
      childSeatCount: 1,
      infantSeatCount: 0,
      allowMultipleVehicles: true,
      autoAllocateVehicles: true,
      maxVehicles: 5
    },
    adultNetPrice: 500,
    childNetPrice: 0,
    infantNetPrice: 0,
    currency: 'USD',
    defaultMarkupPercent: 30,
    buyerMarkupPercent: 30,
    b2bAgentMarkupPercent: 20,
    taxPercent: 10,
    commissionPercent: 10,
    serviceFeeFixed: 25,
    sellingPriceStartingFrom: 660,
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
  const [newImageUrl, setNewImageUrl] = useState('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [productPhotoTab, setProductPhotoTab] = useState<'UPLOAD' | 'UNSPLASH' | 'URL'>('UPLOAD');
  const [unsplashSearchTerm, setUnsplashSearchTerm] = useState('');
  const [unsplashResults, setUnsplashResults] = useState<{ title: string; url: string; category: string }[]>(() => 
    fetchUnsplashImagesByQuery('', 'products')
  );
  const photoUploadInputRef = React.useRef<HTMLInputElement>(null);

  const handleProductPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setIsUploadingPhoto(true);
      const newUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 10 * 1024 * 1024) {
          alert(`File ${file.name} is too large. Max allowed is 10MB.`);
          continue;
        }
        const dataUrl = await fileToDataUrl(file);
        newUrls.push(dataUrl);
      }
      if (newUrls.length > 0) {
        const current = formData.images || [];
        setFormData({ ...formData, images: [...current, ...newUrls] });
      }
    } catch (err) {
      console.error('Error uploading product photo:', err);
      alert('Failed to process uploaded photos. Please try again.');
    } finally {
      setIsUploadingPhoto(false);
      if (photoUploadInputRef.current) photoUploadInputRef.current.value = '';
    }
  };

  const handleSearchUnsplashProducts = (topic?: string) => {
    const query = topic !== undefined ? topic : (unsplashSearchTerm || formData.name || formData.city || 'Japan Tour');
    const results = fetchUnsplashImagesByQuery(query, 'products');
    setUnsplashResults(results);
  };

  const refreshProducts = () => {
    setProducts(db.getProducts());
  };

  const handleOpenCreate = () => {
    setEditingProduct(null);
    setModalTab('CONTENT');
    const firstReg = masterRegions[0] || { id: 'reg-asia', name: 'Asia', code: 'ASIA' };
    const matchingDests = destinations.filter(d => !firstReg.id || d.regionId === firstReg.id);
    const targetDest = matchingDests[0] || destinations[0] || { id: 'dest-japan', name: 'Japan', regionId: firstReg.id };
    const dHubs = cityHubs.filter(h => h.destinationId === targetDest.id);
    const firstHub = dHubs[0];
    const skuGenerated = `UB-${targetDest.name.substring(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

    setFormData({
      sku: skuGenerated,
      name: '',
      regionId: firstReg.id,
      regionName: firstReg.name,
      destinationId: targetDest.id,
      destinationName: targetDest.name,
      hubId: firstHub?.id || '',
      country: targetDest.name,
      city: firstHub?.name || 'Tokyo',
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
      location: `${firstHub?.name || 'Tokyo'}, ${targetDest.name}`,
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
    setModalTab('CONTENT');
    const isCapCat = CAPACITY_BASED_CATEGORIES.includes(product.category as string);
    setFormData({
      ...product,
      pricingMethod: product.pricingMethod || (isCapCat ? 'capacity_based' : 'per_person'),
      vehicleConfig: product.vehicleConfig || (isCapCat ? {
        vehicleModel: product.name || 'Executive MPV / Van',
        vehicleType: 'Executive MPV / Van',
        maxSeats: product.maxPax || 7,
        unitVehicleNetCost: product.adultNetPrice || 500,
        adultSeatCount: 1,
        childSeatCount: 1,
        infantSeatCount: 0,
        allowMultipleVehicles: true,
        autoAllocateVehicles: true,
        maxVehicles: 5
      } : undefined),
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
    const target = products.find(p => p.id === productId) || (editingProduct?.id === productId ? editingProduct : null);
    const targetName = target ? `${target.name || 'Product'} (SKU: ${target.sku || 'N/A'})` : productId;
    setDeleteTarget({ id: productId, name: targetName });
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

    const isCapacityBased = formData.pricingMethod === 'capacity_based' || CAPACITY_BASED_CATEGORIES.includes(formData.category as string);
    const maxSeats = Number(formData.vehicleConfig?.maxSeats) || Number(formData.maxPax) || 7;
    const vehicleNet = Number(formData.vehicleConfig?.unitVehicleNetCost) || Number(formData.adultNetPrice) || 0;
    
    const adultNet = isCapacityBased ? vehicleNet : (Number(formData.adultNetPrice) || 0);
    const childNet = isCapacityBased ? 0 : (Number(formData.childNetPrice) || 0);
    const infantNet = isCapacityBased ? 0 : (Number(formData.infantNetPrice) || 0);
    const buyerMarkup = Number(formData.buyerMarkupPercent) || Number(formData.defaultMarkupPercent) || 30;
    const b2bAgentMarkup = Number(formData.b2bAgentMarkupPercent) || 20;
    const tax = Number(formData.taxPercent) || 10;
    const fee = Number(formData.serviceFeeFixed) || 0;
    const computedSelling = calculateSellingPrice(adultNet, buyerMarkup, tax, fee);

    const targetDest = destinations.find(d => d.id === formData.destinationId);
    const targetReg = masterRegions.find(r => r.id === (formData.regionId || targetDest?.regionId));
    const targetHub = cityHubs.find(h => h.id === formData.hubId);

    const productToSave: Product = {
      id: editingProduct ? editingProduct.id : `prod-${Date.now()}`,
      sku: formData.sku || `SKU-${Date.now()}`,
      destinationId: formData.destinationId || destinations[0]?.id || 'dest-japan',
      destinationName: targetDest?.name || formData.destinationName || 'Japan',
      regionId: targetReg?.id || formData.regionId || '',
      regionName: targetReg?.name || formData.regionName || '',
      hubId: formData.hubId || targetHub?.id || '',
      country: formData.country || targetDest?.country || targetDest?.name || 'Japan',
      city: formData.city || targetHub?.name || 'Tokyo',
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
      pricingMethod: isCapacityBased ? 'capacity_based' : (formData.pricingMethod || 'per_person'),
      vehicleConfig: isCapacityBased ? {
        vehicleModel: formData.vehicleConfig?.vehicleModel || formData.name || 'Executive Vehicle',
        vehicleType: formData.vehicleConfig?.vehicleType || 'Executive MPV / Van',
        maxSeats: maxSeats,
        unitVehicleNetCost: vehicleNet,
        adultSeatCount: Number(formData.vehicleConfig?.adultSeatCount ?? 1),
        childSeatCount: Number(formData.vehicleConfig?.childSeatCount ?? 1),
        infantSeatCount: Number(formData.vehicleConfig?.infantSeatCount ?? 0),
        allowMultipleVehicles: formData.vehicleConfig?.allowMultipleVehicles ?? true,
        autoAllocateVehicles: formData.vehicleConfig?.autoAllocateVehicles ?? true,
        maxVehicles: Number(formData.vehicleConfig?.maxVehicles) || 5,
        totalSeats: maxSeats,
        passengerCapacity: maxSeats,
        totalTransferCost: vehicleNet
      } : formData.vehicleConfig,
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
      maxPax: maxSeats,
      availability: (formData.availability as any) || 'INSTANT',
      bookingRequiredDays: Number(formData.bookingRequiredDays) || 2,
      cancellationPolicy: formData.cancellationPolicy || 'Standard 72-hour notice.',
      inclusions: formData.inclusions || [],
      exclusions: formData.exclusions || [],
      importantInformation: formData.importantInformation || [],
      meetingPoint: formData.meetingPoint || 'Hotel Lobby',
      pickupInformation: formData.pickupInformation || 'Concierge Desk Pick-up',
      images: formData.images && (formData.images || []).length > 0 ? formData.images : ['https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=800&auto=format&fit=crop'],
      location: `${formData.city || targetHub?.name || 'Tokyo'}, ${formData.country || targetDest?.name || 'Japan'}`,
      latitude: formData.latitude || 35.6762,
      longitude: formData.longitude || 139.6503,
      rating: formData.rating || 4.9,
      reviewCount: formData.reviewCount || 10,
      slug: formData.slug || formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      seo: formData.seo,
      status: formData.status || 'ACTIVE',
      lastUpdated: new Date().toISOString().split('T')[0]
    };

    db.saveProduct(productToSave, user);
    refreshProducts();
    setIsModalOpen(false);
  };

  // Filter and Sort Logic
  const availableDestinationsForFilter = selectedMasterRegion === 'ALL'
    ? destinations
    : destinations.filter(d => d.regionId === selectedMasterRegion);

  const availableHubsForFilter = cityHubs.filter(h => {
    const matchesReg = selectedMasterRegion === 'ALL' || h.regionId === selectedMasterRegion;
    const matchesDest = selectedDestination === 'ALL' || h.destinationId === selectedDestination;
    return matchesReg && matchesDest;
  });

  const filtered = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.regionName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.supplierName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMasterReg = selectedMasterRegion === 'ALL' || p.regionId === selectedMasterRegion;
    const matchesDest = selectedDestination === 'ALL' || p.destinationId === selectedDestination;
    const matchesHub = selectedCityHub === 'ALL' || p.hubId === selectedCityHub || p.city.toLowerCase() === selectedCityHub.toLowerCase();
    const matchesCat = selectedCategory === 'ALL' || p.category === selectedCategory;
    const matchesStat = selectedStatus === 'ALL' || p.status === selectedStatus;
    return matchesSearch && matchesMasterReg && matchesDest && matchesHub && matchesCat && matchesStat;
  }).sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'price-asc') return a.adultNetPrice - b.adultNetPrice;
    if (sortBy === 'price-desc') return b.adultNetPrice - a.adultNetPrice;
    return (b.lastUpdated || '').localeCompare(a.lastUpdated || '');
  });

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Form Cascading helpers
  const modalAvailableDestinations = formData.regionId
    ? destinations.filter(d => d.regionId === formData.regionId)
    : destinations;

  const modalAvailableHubs = cityHubs.filter(h => {
    const matchesReg = !formData.regionId || h.regionId === formData.regionId;
    const matchesDest = !formData.destinationId || h.destinationId === formData.destinationId;
    return matchesReg && matchesDest;
  });

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
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
        <div className="relative sm:col-span-2 md:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            placeholder="Search by title, SKU, region, city..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#00C6A6]"
          />
        </div>

        <div>
          <select
            value={selectedMasterRegion}
            onChange={e => { 
              setSelectedMasterRegion(e.target.value); 
              setSelectedDestination('ALL');
              setSelectedCityHub('ALL');
              setCurrentPage(1); 
            }}
            className="w-full py-2 px-3 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#00C6A6] font-semibold"
          >
            <option value="ALL">1. All Regions ({masterRegions.length})</option>
            {masterRegions.map(r => (
              <option key={r.id} value={r.id}>{r.name} ({r.code})</option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={selectedDestination}
            onChange={e => { 
              setSelectedDestination(e.target.value); 
              setSelectedCityHub('ALL');
              setCurrentPage(1); 
            }}
            className="w-full py-2 px-3 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#00C6A6] font-semibold"
          >
            <option value="ALL">2. All Destinations ({availableDestinationsForFilter.length})</option>
            {availableDestinationsForFilter.map(d => (
              <option key={d.id} value={d.id}>{d.name} {d.regionName ? `(${d.regionName})` : ''}</option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={selectedCityHub}
            onChange={e => { setSelectedCityHub(e.target.value); setCurrentPage(1); }}
            className="w-full py-2 px-3 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#00C6A6] font-semibold"
          >
            <option value="ALL">3. All City Hubs ({availableHubsForFilter.length})</option>
            {availableHubsForFilter.map(h => (
              <option key={h.id} value={h.id}>{h.name} {h.destinationName ? `(${h.destinationName})` : ''}</option>
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
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">SKU / Product</th>
                <th className="py-3 px-4">Destination Hierarchy</th>
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
                      <div className="flex items-center space-x-1.5 flex-wrap gap-1">
                        <span className="inline-block text-[10px] bg-slate-900 text-white font-bold px-2 py-0.5 rounded">
                          {product.destinationName}
                        </span>
                        {product.regionName && (
                          <span className="inline-block text-[10px] bg-[#00C6A6]/20 text-[#008972] font-extrabold px-1.5 py-0.5 rounded border border-[#00C6A6]/40">
                            {product.regionName}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium flex items-center space-x-1">
                        <span className="text-slate-700 font-semibold">{product.city}</span>
                        <span>•</span>
                        <span>{product.category}</span>
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

            {/* Modal Subtabs */}
            <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
              <button
                type="button"
                onClick={() => setModalTab('CONTENT')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  modalTab === 'CONTENT' ? 'bg-[#00C6A6] text-slate-950 shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Product Details & Pricing
              </button>
              <button
                type="button"
                onClick={() => setModalTab('SEO')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                  modalTab === 'SEO' ? 'bg-[#008972] text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Globe2 className="w-3.5 h-3.5" />
                <span>SEO & Search Indexing</span>
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              {modalTab === 'SEO' ? (
                <EntitySEOSettingsTab
                  entityType="PRODUCT"
                  entity={formData}
                  seo={formData.seo}
                  onChange={(newSeo) => setFormData(prev => ({ ...prev, seo: newSeo, slug: newSeo.slug || prev.slug }))}
                />
              ) : (
                <>
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

              {/* Connected Destination Hierarchy */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <span className="flex items-center space-x-1.5 text-slate-900">
                    <Building2 className="w-4 h-4 text-[#00C6A6]" />
                    <span>Connected Geography Hierarchy (Region → Destination → City Hub)</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tier 1 → Tier 2 → Tier 3</span>
                </div>

                {/* Live Hierarchy Breadcrumb Preview */}
                <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center gap-2 text-xs flex-wrap">
                  <span className="font-bold text-slate-400 uppercase text-[10px]">Hierarchy:</span>
                  <span className="font-bold text-[#008f77] flex items-center gap-1">
                    <Globe2 className="w-3 h-3" />
                    {formData.regionName || 'Select Region'}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-bold text-slate-800 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-[#00C6A6]" />
                    {formData.destinationName || 'Select Destination'}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-bold text-slate-900 flex items-center gap-1">
                    <Building className="w-3 h-3 text-amber-600" />
                    {formData.city || 'Select City Hub'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">1. Master Region (Tier 1) *</label>
                    <select
                      required
                      value={formData.regionId || ''}
                      onChange={e => {
                        const regId = e.target.value;
                        const reg = masterRegions.find(r => r.id === regId);
                        const matchingDests = destinations.filter(d => !regId || d.regionId === regId);
                        const nextDest = matchingDests[0] || destinations[0];
                        const matchingHubs = cityHubs.filter(h => h.destinationId === nextDest?.id);
                        const nextHub = matchingHubs[0];
                        setFormData({
                          ...formData,
                          regionId: regId,
                          regionName: reg?.name || '',
                          destinationId: nextDest?.id || formData.destinationId,
                          destinationName: nextDest?.name || formData.destinationName,
                          country: nextDest?.country || nextDest?.name || formData.country,
                          hubId: nextHub?.id || '',
                          city: nextHub?.name || 'Tokyo',
                          location: `${nextHub?.name || 'Tokyo'}, ${nextDest?.name || 'Japan'}`
                        });
                      }}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-[#00C6A6]"
                    >
                      <option value="" disabled>-- Select Region --</option>
                      {masterRegions.map(r => (
                        <option key={r.id} value={r.id}>{r.name} ({r.code})</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">2. Destination (Tier 2) *</label>
                    <select
                      required
                      value={formData.destinationId}
                      onChange={e => {
                        const destId = e.target.value;
                        const dest = destinations.find(d => d.id === destId);
                        const parentReg = masterRegions.find(r => r.id === dest?.regionId);
                        const matchingHubs = cityHubs.filter(h => h.destinationId === destId);
                        const firstHub = matchingHubs[0];
                        setFormData({
                          ...formData,
                          destinationId: destId,
                          destinationName: dest?.name || '',
                          country: dest?.country || dest?.name || 'Japan',
                          regionId: dest?.regionId || parentReg?.id || formData.regionId || '',
                          regionName: dest?.regionName || parentReg?.name || formData.regionName || '',
                          hubId: firstHub?.id || '',
                          city: firstHub?.name || 'Tokyo',
                          location: `${firstHub?.name || 'Tokyo'}, ${dest?.name || 'Japan'}`
                        });
                      }}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-[#00C6A6]"
                    >
                      {modalAvailableDestinations.map(d => (
                        <option key={d.id} value={d.id}>{d.name} {d.regionName ? `(${d.regionName})` : ''}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">3. Destination Hub / City (Tier 3) *</label>
                    <div className="flex gap-1.5">
                      <select
                        value={formData.hubId || ''}
                        onChange={e => {
                          const hId = e.target.value;
                          const hub = cityHubs.find(h => h.id === hId);
                          setFormData({
                            ...formData,
                            hubId: hId,
                            city: hub?.name || formData.city || '',
                            location: `${hub?.name || formData.city || 'Tokyo'}, ${formData.destinationName || 'Japan'}`
                          });
                        }}
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-[#00C6A6]"
                      >
                        <option value="">-- Choose City Hub --</option>
                        {modalAvailableHubs.map(h => (
                          <option key={h.id} value={h.id}>{h.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Custom City Display Name</label>
                    <input
                      type="text"
                      value={formData.city || ''}
                      onChange={e => setFormData({ ...formData, city: e.target.value })}
                      placeholder="e.g. Tokyo, Kyoto, Osaka"
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Category *</label>
                    <select
                      value={formData.category}
                      onChange={e => {
                        const newCat = e.target.value as ProductCategory;
                        const isCapCat = CAPACITY_BASED_CATEGORIES.includes(newCat);
                        setFormData({ 
                          ...formData, 
                          category: newCat,
                          pricingMethod: isCapCat ? 'capacity_based' : formData.pricingMethod || 'per_person'
                        });
                      }}
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-medium"
                    >
                      {CATEGORIES.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Duration / Format</label>
                    <input
                      type="text"
                      value={formData.duration || ''}
                      onChange={e => setFormData({ ...formData, duration: e.target.value })}
                      placeholder="e.g. 8 Hours, Full Day, 3 Days"
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Pricing Calculation Architecture Selector */}
              <div className="bg-slate-900 text-white p-5 rounded-2xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 bg-teal-500/20 text-[#00E5C0] rounded-lg">
                      <Calculator className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <span>Commercial Pricing & Calculation Engine</span>
                        {formData.pricingMethod === 'capacity_based' ? (
                          <span className="text-[10px] bg-teal-500/20 text-[#00E5C0] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border border-teal-500/30">
                            Capacity-Based Vehicle Engine
                          </span>
                        ) : (
                          <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border border-blue-500/30">
                            Per-Person Rate Engine
                          </span>
                        )}
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        {formData.pricingMethod === 'capacity_based'
                          ? 'Vehicle calculation: Total Vehicle Cost ÷ Actual Occupied Seats = Per-Person Nett Cost (Capped at Capacity).'
                          : 'Per-person calculation: Adult Net × Adults + Child Net × Children + Infant Net × Infants.'}
                      </p>
                    </div>
                  </div>

                  {/* Method Toggle Buttons */}
                  <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, pricingMethod: 'capacity_based' })}
                      className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        formData.pricingMethod === 'capacity_based'
                          ? 'bg-[#00C6A6] text-slate-950 shadow-md'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Car className="w-3.5 h-3.5" />
                      <span>Capacity-Based</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, pricingMethod: 'per_person' })}
                      className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        formData.pricingMethod === 'per_person' || !formData.pricingMethod
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Per-Person</span>
                    </button>
                  </div>
                </div>

                {/* CAPACITY-BASED VEHICLE / YACHT & SEAT ALLOCATION CONFIGURATION */}
                {formData.pricingMethod === 'capacity_based' ? (
                  <div className="space-y-4">
                    <div className="bg-slate-800/80 p-4 rounded-xl border border-teal-500/30 space-y-4">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#00E5C0] flex items-center gap-1.5">
                          {formData.category === 'Private Yacht' ? <Ship className="w-4 h-4" /> : <Car className="w-4 h-4" />}
                          <span>
                            {formData.category === 'Private Yacht' 
                              ? 'Private Yacht Specifications & Charter Capacity' 
                              : 'Vehicle Fleet & Seating Capacity Specifications'}
                          </span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {formData.category === 'Private Yacht'
                            ? 'Auto-allocates multiple yachts when guest capacity is exceeded'
                            : 'Auto-allocates multiple vehicles when capacity is exceeded'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs text-slate-800">
                        <div className="space-y-1 sm:col-span-2">
                          <label className="text-[11px] text-slate-300 font-medium">
                            {formData.category === 'Private Yacht' ? 'Yacht Model / Charter Name *' : 'Vehicle Model / Fleet Name *'}
                          </label>
                          <input
                            type="text"
                            value={formData.vehicleConfig?.vehicleModel || formData.vehicleConfig?.yachtModel || formData.vehicleConfig?.vehicleName || (formData.category === 'Private Yacht' ? 'Azimut 66 Flybridge Luxury Yacht' : 'Toyota Hiace Grand Cabin (7-Seater)')}
                            onChange={e => setFormData({
                              ...formData,
                              vehicleConfig: {
                                ...(formData.vehicleConfig || {
                                  vehicleModel: formData.category === 'Private Yacht' ? 'Azimut 66 Flybridge Luxury Yacht' : 'Toyota Hiace Grand Cabin (7-Seater)',
                                  vehicleType: formData.category === 'Private Yacht' ? 'Motor Yacht' : 'Executive MPV / Van',
                                  maxSeats: formData.category === 'Private Yacht' ? 10 : 7,
                                  unitVehicleNetCost: 500,
                                  adultSeatCount: 1,
                                  childSeatCount: 1,
                                  infantSeatCount: 0,
                                  allowMultipleVehicles: true,
                                  autoAllocateVehicles: true,
                                  maxVehicles: 5
                                }),
                                vehicleModel: e.target.value,
                                vehicleName: e.target.value,
                                yachtModel: e.target.value,
                                yachtName: e.target.value
                              }
                            })}
                            placeholder={formData.category === 'Private Yacht' ? 'e.g. Azimut 66 Flybridge (10-Pax)' : 'e.g. Toyota Hiace Grand Cabin (7-Seater)'}
                            className="w-full p-2 bg-white rounded-lg font-semibold"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] text-slate-300 font-medium">
                            {formData.category === 'Private Yacht' ? 'Yacht Classification' : 'Vehicle Classification'}
                          </label>
                          <select
                            value={formData.vehicleConfig?.vehicleType || (formData.category === 'Private Yacht' ? 'Motor Yacht' : 'Executive MPV / Van')}
                            onChange={e => setFormData({
                              ...formData,
                              vehicleConfig: {
                                ...(formData.vehicleConfig || {
                                  vehicleModel: formData.category === 'Private Yacht' ? 'Azimut 66 Flybridge Luxury Yacht' : 'Toyota Hiace Grand Cabin (7-Seater)',
                                  vehicleType: formData.category === 'Private Yacht' ? 'Motor Yacht' : 'Executive MPV / Van',
                                  maxSeats: formData.category === 'Private Yacht' ? 10 : 7,
                                  unitVehicleNetCost: 500,
                                  adultSeatCount: 1,
                                  childSeatCount: 1,
                                  infantSeatCount: 0,
                                  allowMultipleVehicles: true,
                                  autoAllocateVehicles: true,
                                  maxVehicles: 5
                                }),
                                vehicleType: e.target.value,
                                yachtType: e.target.value
                              }
                            })}
                            className="w-full p-2 bg-white rounded-lg font-medium text-xs"
                          >
                            {formData.category === 'Private Yacht' ? (
                              <>
                                <option value="Motor Yacht">Motor Yacht (Luxury Flybridge)</option>
                                <option value="Catamaran">Catamaran (High Stability)</option>
                                <option value="Sailing Yacht">Sailing Yacht / Monohull</option>
                                <option value="Superyacht">Superyacht / Megayacht</option>
                                <option value="Speedboat">Speedboat / Day Cruiser</option>
                                <option value="Gulet / Wooden Boat">Gulet / Wooden Classic</option>
                              </>
                            ) : (
                              <>
                                <option value="Executive Sedan">Executive Sedan (1–3 Seats)</option>
                                <option value="Executive MPV / Van">Executive MPV / Van (4–7 Seats)</option>
                                <option value="Minibus / Sprinter">Minibus / Sprinter (8–16 Seats)</option>
                                <option value="Luxury Coach">Luxury Coach (17–45 Seats)</option>
                                <option value="Private Yacht / Boat">Private Yacht / Boat</option>
                              </>
                            )}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] text-slate-300 font-medium">
                            {formData.category === 'Private Yacht' ? 'Max Passenger Capacity *' : 'Max Seating Capacity *'}
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={formData.vehicleConfig?.maxSeats || (formData.category === 'Private Yacht' ? 10 : 7)}
                              onChange={e => {
                                const seats = Math.max(1, Number(e.target.value));
                                setFormData({
                                  ...formData,
                                  maxPax: seats,
                                  vehicleConfig: {
                                    ...(formData.vehicleConfig || {
                                      vehicleModel: formData.category === 'Private Yacht' ? 'Azimut 66 Flybridge' : 'Toyota Hiace Grand Cabin (7-Seater)',
                                      vehicleType: formData.category === 'Private Yacht' ? 'Motor Yacht' : 'Executive MPV / Van',
                                      maxSeats: seats,
                                      unitVehicleNetCost: 500,
                                      adultSeatCount: 1,
                                      childSeatCount: 1,
                                      infantSeatCount: 0,
                                      allowMultipleVehicles: true,
                                      autoAllocateVehicles: true,
                                      maxVehicles: 5
                                    }),
                                    maxSeats: seats,
                                    passengerCapacity: seats,
                                    totalSeats: seats
                                  }
                                });
                              }}
                              className="w-full p-2 bg-white rounded-lg font-bold pr-12"
                            />
                            <span className="absolute right-2.5 top-2 text-[10px] font-bold text-slate-400">
                              {formData.category === 'Private Yacht' ? 'GUESTS' : 'SEATS'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Yacht Size / Length when Category is Private Yacht */}
                      {formData.category === 'Private Yacht' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-800 pt-2 border-t border-slate-700">
                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-300 font-medium">Yacht Length / Dimensions</label>
                            <input
                              type="text"
                              value={formData.vehicleConfig?.yachtSize || formData.vehicleConfig?.yachtLength || '66 ft / 20.8 m'}
                              onChange={e => setFormData({
                                ...formData,
                                vehicleConfig: {
                                  ...(formData.vehicleConfig || {
                                    vehicleModel: 'Azimut 66 Flybridge',
                                    vehicleType: 'Motor Yacht',
                                    maxSeats: 10,
                                    unitVehicleNetCost: 500,
                                    adultSeatCount: 1,
                                    childSeatCount: 1,
                                    infantSeatCount: 0,
                                    allowMultipleVehicles: true,
                                    autoAllocateVehicles: true,
                                    maxVehicles: 5
                                  }),
                                  yachtSize: e.target.value,
                                  yachtLength: e.target.value
                                }
                              })}
                              placeholder="e.g. 66 ft / 20.8 m"
                              className="w-full p-2 bg-white rounded-lg font-medium text-xs"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-300 font-medium">Standard Capacity Presets</label>
                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                              {[6, 8, 10, 12, 15, 20, 30, 50].map(cap => (
                                <button
                                  key={cap}
                                  type="button"
                                  onClick={() => {
                                    setFormData({
                                      ...formData,
                                      maxPax: cap,
                                      vehicleConfig: {
                                        ...(formData.vehicleConfig || {
                                          vehicleModel: 'Azimut 66 Flybridge',
                                          vehicleType: 'Motor Yacht',
                                          maxSeats: cap,
                                          unitVehicleNetCost: 500,
                                          adultSeatCount: 1,
                                          childSeatCount: 1,
                                          infantSeatCount: 0,
                                          allowMultipleVehicles: true,
                                          autoAllocateVehicles: true,
                                          maxVehicles: 5
                                        }),
                                        maxSeats: cap,
                                        passengerCapacity: cap,
                                        totalSeats: cap
                                      }
                                    });
                                  }}
                                  className={`px-2 py-1 rounded text-[11px] font-bold cursor-pointer transition-all ${
                                    (formData.vehicleConfig?.maxSeats || 10) === cap
                                      ? 'bg-[#00C6A6] text-slate-950 shadow-xs'
                                      : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                                  }`}
                                >
                                  {cap} Pax
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Total Vehicle / Yacht Net Cost & Currency */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-800 pt-2 border-t border-slate-700">
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

                        <div className="space-y-1 sm:col-span-2">
                          <label className="text-[11px] text-emerald-400 font-bold flex items-center justify-between">
                            <span>
                              {formData.category === 'Private Yacht'
                                ? `Total Unit Yacht Charter Nett Cost * (Constant for 1 to ${formData.vehicleConfig?.maxSeats || 10} Pax)`
                                : `Total Unit Vehicle Nett Cost * (Constant for 1 to ${formData.vehicleConfig?.maxSeats || 7} Pax)`}
                            </span>
                            <span className="text-[10px] text-slate-400 font-normal">DMC Contracted Cost</span>
                          </label>
                          <input
                            type="number"
                            required
                            min="0"
                            value={formData.vehicleConfig?.unitVehicleNetCost !== undefined ? formData.vehicleConfig.unitVehicleNetCost : (formData.adultNetPrice || 500)}
                            onChange={e => {
                              const cost = Number(e.target.value);
                              setFormData({
                                ...formData,
                                adultNetPrice: cost,
                                adultNettCost: cost,
                                vehicleConfig: {
                                  ...(formData.vehicleConfig || {
                                    vehicleModel: formData.category === 'Private Yacht' ? 'Azimut 66 Flybridge' : 'Toyota Hiace Grand Cabin (7-Seater)',
                                    vehicleType: formData.category === 'Private Yacht' ? 'Motor Yacht' : 'Executive MPV / Van',
                                    maxSeats: formData.category === 'Private Yacht' ? 10 : 7,
                                    unitVehicleNetCost: 500,
                                    adultSeatCount: 1,
                                    childSeatCount: 1,
                                    infantSeatCount: 0,
                                    allowMultipleVehicles: true,
                                    autoAllocateVehicles: true,
                                    maxVehicles: 5
                                  }),
                                  unitVehicleNetCost: cost,
                                  totalTransferCost: cost
                                }
                              });
                            }}
                            placeholder="e.g. 500"
                            className="w-full p-2 bg-white rounded-lg font-bold text-sm"
                          />
                        </div>
                      </div>

                      {/* Operational Occupancy Constraints */}
                      <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-700 space-y-2">
                        <div className="flex items-center justify-between text-[11px] text-slate-300 font-semibold">
                          <span className="flex items-center gap-1 text-slate-200">
                            <Gauge className="w-3.5 h-3.5 text-[#00E5C0]" />
                            <span>
                              {formData.category === 'Private Yacht' 
                                ? 'Guest Capacity & Manifest Rules' 
                                : 'Passenger Seat Occupancy Rules (Operational Constraints)'}
                            </span>
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {formData.category === 'Private Yacht' ? 'Passenger capacity slots utilized' : 'Number of physical seats occupied per person'}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-slate-800 text-xs">
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-300 font-medium">Adults</label>
                            <input
                              type="number"
                              min="1"
                              max="4"
                              value={formData.vehicleConfig?.adultSeatCount ?? 1}
                              onChange={e => setFormData({
                                ...formData,
                                vehicleConfig: {
                                  ...(formData.vehicleConfig || {
                                    vehicleModel: formData.category === 'Private Yacht' ? 'Azimut 66 Flybridge' : 'Toyota Hiace Grand Cabin (7-Seater)',
                                    vehicleType: formData.category === 'Private Yacht' ? 'Motor Yacht' : 'Executive MPV / Van',
                                    maxSeats: formData.category === 'Private Yacht' ? 10 : 7,
                                    unitVehicleNetCost: 500,
                                    adultSeatCount: 1,
                                    childSeatCount: 1,
                                    infantSeatCount: 0,
                                    allowMultipleVehicles: true,
                                    autoAllocateVehicles: true,
                                    maxVehicles: 5
                                  }),
                                  adultSeatCount: Number(e.target.value)
                                }
                              })}
                              className="w-full p-1.5 bg-white rounded text-center font-bold"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-300 font-medium">Children</label>
                            <input
                              type="number"
                              min="0"
                              max="2"
                              value={formData.vehicleConfig?.childSeatCount ?? 1}
                              onChange={e => setFormData({
                                ...formData,
                                vehicleConfig: {
                                  ...(formData.vehicleConfig || {
                                    vehicleModel: formData.category === 'Private Yacht' ? 'Azimut 66 Flybridge' : 'Toyota Hiace Grand Cabin (7-Seater)',
                                    vehicleType: formData.category === 'Private Yacht' ? 'Motor Yacht' : 'Executive MPV / Van',
                                    maxSeats: formData.category === 'Private Yacht' ? 10 : 7,
                                    unitVehicleNetCost: 500,
                                    adultSeatCount: 1,
                                    childSeatCount: 1,
                                    infantSeatCount: 0,
                                    allowMultipleVehicles: true,
                                    autoAllocateVehicles: true,
                                    maxVehicles: 5
                                  }),
                                  childSeatCount: Number(e.target.value)
                                }
                              })}
                              className="w-full p-1.5 bg-white rounded text-center font-bold"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-300 font-medium">Infants (Lap = 0 / Slot = 1)</label>
                            <input
                              type="number"
                              min="0"
                              max="1"
                              value={formData.vehicleConfig?.infantSeatCount ?? 0}
                              onChange={e => setFormData({
                                ...formData,
                                vehicleConfig: {
                                  ...(formData.vehicleConfig || {
                                    vehicleModel: formData.category === 'Private Yacht' ? 'Azimut 66 Flybridge' : 'Toyota Hiace Grand Cabin (7-Seater)',
                                    vehicleType: formData.category === 'Private Yacht' ? 'Motor Yacht' : 'Executive MPV / Van',
                                    maxSeats: formData.category === 'Private Yacht' ? 10 : 7,
                                    unitVehicleNetCost: 500,
                                    adultSeatCount: 1,
                                    childSeatCount: 1,
                                    infantSeatCount: 0,
                                    allowMultipleVehicles: true,
                                    autoAllocateVehicles: true,
                                    maxVehicles: 5
                                  }),
                                  infantSeatCount: Number(e.target.value)
                                }
                              })}
                              className="w-full p-1.5 bg-white rounded text-center font-bold"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Multi-Vehicle / Yacht Allocation Toggle */}
                      <div className="flex items-center justify-between text-xs pt-1">
                        <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.vehicleConfig?.allowMultipleVehicles ?? true}
                            onChange={e => setFormData({
                              ...formData,
                              vehicleConfig: {
                                ...(formData.vehicleConfig || {
                                  vehicleModel: formData.category === 'Private Yacht' ? 'Azimut 66 Flybridge' : 'Toyota Hiace Grand Cabin (7-Seater)',
                                  vehicleType: formData.category === 'Private Yacht' ? 'Motor Yacht' : 'Executive MPV / Van',
                                  maxSeats: formData.category === 'Private Yacht' ? 10 : 7,
                                  unitVehicleNetCost: 500,
                                  adultSeatCount: 1,
                                  childSeatCount: 1,
                                  infantSeatCount: 0,
                                  allowMultipleVehicles: true,
                                  autoAllocateVehicles: true,
                                  maxVehicles: 5
                                }),
                                allowMultipleVehicles: e.target.checked,
                                autoAllocateVehicles: e.target.checked
                              }
                            })}
                            className="rounded text-[#00C6A6] focus:ring-[#00C6A6] w-4 h-4"
                          />
                          <span>
                            {formData.category === 'Private Yacht'
                              ? `Allow auto-allocation of multiple yachts if passenger count exceeds ${formData.vehicleConfig?.maxSeats || 10} guests`
                              : `Allow auto-allocation of multiple vehicles if passenger count exceeds ${formData.vehicleConfig?.maxSeats || 7} seats`}
                          </span>
                        </label>
                        <span className="text-[10px] text-slate-400">
                          {formData.category === 'Private Yacht' ? 'Max charter: 5 yachts' : 'Max fleet: 5 vehicles'}
                        </span>
                      </div>
                    </div>

                    {/* LIVE INTERACTIVE PASSENGER CAPACITY SIMULATION TABLE */}
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#00E5C0] flex items-center gap-1.5">
                          <Calculator className="w-3.5 h-3.5" />
                          <span>
                            {formData.category === 'Private Yacht' 
                              ? 'Live Yacht Charter Capacity & Pricing Simulation Table' 
                              : 'Live Capacity-Based Pricing Simulation Table'}
                          </span>
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {formData.category === 'Private Yacht'
                            ? 'Total Yacht Nett remains constant until max capacity is exceeded'
                            : 'Total Nett remains constant until vehicle capacity is exceeded'}
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-[11px] text-left">
                          <thead>
                            <tr className="border-b border-slate-800 text-slate-400">
                              <th className="pb-1.5 font-semibold">Pax Count</th>
                              <th className="pb-1.5 font-semibold">
                                {formData.category === 'Private Yacht' ? 'Yachts' : 'Vehicles'}
                              </th>
                              <th className="pb-1.5 font-semibold text-right">
                                {formData.category === 'Private Yacht' ? 'Total Yacht Nett' : 'Total Vehicle Nett'}
                              </th>
                              <th className="pb-1.5 font-semibold text-right text-[#00E5C0]">Per-Person Nett</th>
                              <th className="pb-1.5 font-semibold text-right text-emerald-400">Buyer Delivered Total</th>
                              <th className="pb-1.5 font-semibold text-right text-emerald-300">Buyer Per-Person</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-900 text-slate-300">
                            {[1, 2, 5, (formData.vehicleConfig?.maxSeats || (formData.category === 'Private Yacht' ? 10 : 7)), (formData.vehicleConfig?.maxSeats || (formData.category === 'Private Yacht' ? 10 : 7)) + 1, (formData.vehicleConfig?.maxSeats || (formData.category === 'Private Yacht' ? 10 : 7)) * 2].filter((v, i, a) => a.indexOf(v) === i).sort((a,b) => a-b).map(simPax => {
                              const maxS = formData.vehicleConfig?.maxSeats || (formData.category === 'Private Yacht' ? 10 : 7);
                              const unitCost = formData.vehicleConfig?.unitVehicleNetCost !== undefined ? formData.vehicleConfig.unitVehicleNetCost : (formData.adultNetPrice || 500);
                              const vehCount = Math.max(1, Math.ceil(simPax / maxS));
                              const totalVehNett = vehCount * unitCost;
                              const perPersonNett = totalVehNett / simPax;
                              const buyerMarkup = formData.buyerMarkupPercent !== undefined ? formData.buyerMarkupPercent : 30;
                              const taxPct = formData.taxPercent !== undefined ? formData.taxPercent : 10;
                              const markupAmt = totalVehNett * (buyerMarkup / 100);
                              const taxAmt = markupAmt * (taxPct / 100);
                              const totalSelling = totalVehNett + markupAmt + taxAmt + (formData.serviceFeeFixed || 0);
                              const perPersonSelling = totalSelling / simPax;
                              const isFull = simPax === maxS;
                              const isOver = simPax > maxS;

                              return (
                                <tr key={simPax} className={`hover:bg-slate-900/60 ${isFull ? 'bg-teal-950/40 text-teal-200 font-semibold' : ''}`}>
                                  <td className="py-1.5 flex items-center gap-1">
                                    <Users className="w-3 h-3 text-slate-500" />
                                    <span>{simPax} {simPax === 1 ? 'Pax' : 'Pax'}</span>
                                    {isFull && <span className="text-[9px] bg-teal-500/20 text-[#00E5C0] px-1 rounded ml-1">MAX CAPACITY</span>}
                                    {isOver && (
                                      <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1 rounded ml-1">
                                        {formData.category === 'Private Yacht' ? '2nd YACHT' : '2nd VEHICLE'}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-1.5">
                                    {vehCount} {formData.category === 'Private Yacht' ? (vehCount === 1 ? 'Yacht' : 'Yachts') : (vehCount === 1 ? 'Vehicle' : 'Vehicles')}
                                  </td>
                                  <td className="py-1.5 text-right font-mono">{formatCurrency(totalVehNett, formData.currency || 'USD')}</td>
                                  <td className="py-1.5 text-right font-mono font-bold text-[#00E5C0]">{formatCurrency(perPersonNett, formData.currency || 'USD')}</td>
                                  <td className="py-1.5 text-right font-mono text-emerald-400">{formatCurrency(totalSelling, formData.currency || 'USD')}</td>
                                  <td className="py-1.5 text-right font-mono font-bold text-emerald-300">{formatCurrency(perPersonSelling, formData.currency || 'USD')}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* STANDARD PER-PERSON PRICING INPUTS */
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
                )}

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
                    <label className="text-[11px] text-slate-300 font-medium">Tax % (on Margin Only)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.taxPercent !== undefined ? formData.taxPercent : 10}
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
                    <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-semibold">
                      {formData.pricingMethod === 'capacity_based' ? 'Buyer Vehicle Delivered Rate (1 Vehicle):' : 'Direct Buyer Delivered Rate:'}
                    </span>
                    <span className="text-base font-bold font-mono text-emerald-400">
                      {formatCurrency(
                        calculateSellingPrice(
                          (formData.pricingMethod === 'capacity_based' 
                            ? (formData.vehicleConfig?.unitVehicleNetCost || formData.adultNetPrice || 500)
                            : (formData.adultNetPrice || 0)),
                          formData.buyerMarkupPercent !== undefined ? formData.buyerMarkupPercent : 30,
                          formData.taxPercent !== undefined ? formData.taxPercent : 10,
                          formData.serviceFeeFixed || 0
                        ),
                        formData.currency || 'USD'
                      )}
                    </span>
                    <span className="text-[10px] text-slate-500 ml-1.5">
                      {formData.pricingMethod === 'capacity_based' 
                        ? `(Starting at ${formatCurrency((calculateSellingPrice((formData.vehicleConfig?.unitVehicleNetCost || formData.adultNetPrice || 500), formData.buyerMarkupPercent || 30, formData.taxPercent || 10, formData.serviceFeeFixed || 0) / (formData.vehicleConfig?.maxSeats || 7)), formData.currency || 'USD')}/pax at full capacity)`
                        : `(Net + ${formData.buyerMarkupPercent || 30}% markup)`}
                    </span>
                  </div>

                  <div className="sm:text-right">
                    <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-semibold">
                      {formData.pricingMethod === 'capacity_based' ? 'B2B Agent Wholesale Rate (1 Vehicle):' : 'B2B Agent Delivered Rate:'}
                    </span>
                    <span className="text-base font-bold font-mono text-[#00E5C0]">
                      {formatCurrency(
                        calculateSellingPrice(
                          (formData.pricingMethod === 'capacity_based' 
                            ? (formData.vehicleConfig?.unitVehicleNetCost || formData.adultNetPrice || 500)
                            : (formData.adultNetPrice || 0)),
                          formData.b2bAgentMarkupPercent !== undefined ? formData.b2bAgentMarkupPercent : 20,
                          formData.taxPercent !== undefined ? formData.taxPercent : 10,
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

              {/* Multi-Picture Gallery Management */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="font-bold text-slate-800 text-xs flex items-center space-x-1.5">
                    <ImageIcon className="w-4 h-4 text-[#00C6A6]" />
                    <span>Product Pictures & Visual Media Gallery ({formData.images?.length || 0})</span>
                  </label>
                  
                  {/* Photo Mode Switcher */}
                  <div className="inline-flex items-center bg-white p-0.5 rounded-xl border border-slate-200 text-[11px] font-semibold text-slate-600">
                    <button
                      type="button"
                      onClick={() => setProductPhotoTab('UPLOAD')}
                      className={`px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer transition-all ${
                        productPhotoTab === 'UPLOAD' ? 'bg-slate-900 text-white font-bold' : 'hover:text-slate-900'
                      }`}
                    >
                      <Upload className="w-3 h-3 text-[#00C6A6]" />
                      <span>Upload Photo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setProductPhotoTab('UNSPLASH');
                        handleSearchUnsplashProducts();
                      }}
                      className={`px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer transition-all ${
                        productPhotoTab === 'UNSPLASH' ? 'bg-slate-900 text-white font-bold' : 'hover:text-slate-900'
                      }`}
                    >
                      <Sparkles className="w-3 h-3 text-[#00C6A6]" />
                      <span>Fetch Unsplash</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setProductPhotoTab('URL')}
                      className={`px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer transition-all ${
                        productPhotoTab === 'URL' ? 'bg-slate-900 text-white font-bold' : 'hover:text-slate-900'
                      }`}
                    >
                      <Link2 className="w-3 h-3 text-slate-500" />
                      <span>Paste URL</span>
                    </button>
                  </div>
                </div>

                {/* TAB 1: UPLOAD PHOTO FILE */}
                {productPhotoTab === 'UPLOAD' && (
                  <div>
                    <input
                      ref={photoUploadInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleProductPhotoUpload}
                      className="hidden"
                    />
                    <div
                      onClick={() => photoUploadInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-300 hover:border-[#00C6A6] bg-white hover:bg-[#00C6A6]/5 rounded-2xl p-4 text-center cursor-pointer transition-all group"
                    >
                      <div className="w-9 h-9 rounded-full bg-slate-50 shadow-2xs border border-slate-200 flex items-center justify-center mx-auto mb-1.5 group-hover:scale-110 transition-transform">
                        <Upload className="w-4 h-4 text-[#00C6A6]" />
                      </div>
                      <p className="text-xs font-bold text-slate-800">
                        {isUploadingPhoto ? 'Uploading Selected Photos...' : 'Click to Upload Product Photos (Single or Multiple)'}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        PNG, JPG, WEBP or HEIC up to 10MB each. Stored directly in the product catalogue.
                      </p>
                    </div>
                  </div>
                )}

                {/* TAB 2: FETCH UNSPLASH IMAGES */}
                {productPhotoTab === 'UNSPLASH' && (
                  <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2.5">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={unsplashSearchTerm}
                        onChange={e => setUnsplashSearchTerm(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSearchUnsplashProducts(); } }}
                        placeholder="Search Unsplash (e.g. Tokyo Walking Tour, Kyoto Temple, VIP Chauffeur)..."
                        className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleSearchUnsplashProducts()}
                        className="px-3.5 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center space-x-1 cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3 text-[#00C6A6]" />
                        <span>Search</span>
                      </button>
                    </div>

                    {/* Unsplash Search Results */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-44 overflow-y-auto">
                      {unsplashResults.map((item, idx) => {
                        const isAdded = (formData.images || []).includes(item.url);
                        return (
                          <div
                            key={idx}
                            onClick={() => {
                              const current = formData.images || [];
                              if (!isAdded) {
                                setFormData({ ...formData, images: [...current, item.url] });
                              }
                            }}
                            className={`group relative rounded-xl overflow-hidden aspect-4/3 cursor-pointer border transition-all ${
                              isAdded ? 'ring-2 ring-[#00C6A6] opacity-70' : 'border-slate-200 hover:border-[#00C6A6]'
                            }`}
                          >
                            <img src={item.url} alt={item.title} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 flex items-center justify-center p-1 text-center transition-opacity">
                              <span className="text-[10px] font-bold text-white">
                                {isAdded ? '✓ Added' : '+ Add Photo'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* TAB 3: DIRECT URL / UNSPLASH LINK INPUT */}
                {productPhotoTab === 'URL' && (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={newImageUrl}
                        onChange={e => setNewImageUrl(e.target.value)}
                        placeholder="Paste image or Unsplash webpage link (e.g. unsplash.com/photos/...)"
                        className="flex-1 p-2.5 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#00C6A6]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const converted = convertUnsplashUrl(newImageUrl);
                          if (converted) {
                            const current = formData.images || [];
                            if (!current.includes(converted)) {
                              setFormData({ ...formData, images: [...current, converted] });
                            }
                            setNewImageUrl('');
                          }
                        }}
                        className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center space-x-1 cursor-pointer transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Photo</span>
                      </button>
                    </div>

                    {/* Quick Presets */}
                    <div className="flex items-center space-x-2 text-[11px] text-slate-500 overflow-x-auto pb-1">
                      <span className="shrink-0 flex items-center space-x-1 font-semibold text-slate-700">
                        <Sparkles className="w-3 h-3 text-[#00C6A6]" />
                        <span>Quick Presets:</span>
                      </span>
                      {[
                        { name: 'Tokyo Tower', url: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=1200&auto=format&fit=crop' },
                        { name: 'Kyoto Garden', url: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200&auto=format&fit=crop' },
                        { name: 'VIP Chauffeur', url: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?q=80&w=1200&auto=format&fit=crop' },
                        { name: 'Mt Fuji', url: 'https://images.unsplash.com/photo-1578637387939-43c525550085?q=80&w=1200&auto=format&fit=crop' }
                      ].map((preset, pIdx) => (
                        <button
                          key={pIdx}
                          type="button"
                          onClick={() => {
                            const current = formData.images || [];
                            if (!current.includes(preset.url)) setFormData({ ...formData, images: [...current, preset.url] });
                          }}
                          className="px-2 py-0.5 bg-white border border-slate-200 rounded-md hover:border-[#00C6A6] text-slate-700 shrink-0 cursor-pointer text-[10px]"
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Picture Thumbnails Grid */}
                {formData.images && (formData.images || []).length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                    {(formData.images || []).map((imgUrl, idx) => (
                      <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-200 bg-white aspect-4/3 shadow-2xs">
                        <img src={imgUrl} alt={`Product ${idx + 1}`} className="w-full h-full object-cover" />
                        {idx === 0 && (
                          <span className="absolute top-1.5 left-1.5 bg-[#00C6A6] text-slate-950 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded shadow-xs">
                            Primary
                          </span>
                        )}
                        <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-1.5">
                          {idx !== 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const current = [...(formData.images || [])];
                                const [selected] = current.splice(idx, 1);
                                current.unshift(selected);
                                setFormData({ ...formData, images: current });
                              }}
                              className="px-2 py-1 bg-white/90 hover:bg-white text-slate-900 rounded text-[10px] font-bold cursor-pointer"
                              title="Make this the primary photo"
                            >
                              Set Primary
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              const current = (formData.images || []).filter((_, i) => i !== idx);
                              setFormData({ ...formData, images: current });
                            }}
                            className="p-1 bg-rose-600 hover:bg-rose-700 text-white rounded cursor-pointer"
                            title="Remove photo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 bg-white rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
                    No pictures attached yet. Paste a URL or click a quick preset above.
                  </div>
                )}
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
              </>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <div>
                  {editingProduct && (
                    <button
                      type="button"
                      onClick={() => handleDelete(editingProduct.id)}
                      className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl flex items-center space-x-1.5 transition-colors cursor-pointer border border-rose-200"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Product</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center space-x-3">
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
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <DeleteConfirmModal
          isOpen={Boolean(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          onSuccess={() => {
            if (editingProduct?.id === deleteTarget.id) {
              setIsModalOpen(false);
              setEditingProduct(null);
            }
            setDeleteTarget(null);
            refreshProducts();
          }}
          entityType="Product"
          recordId={deleteTarget.id}
          recordTitle={deleteTarget.name}
          user={user}
        />
      )}
    </div>
  );
};
