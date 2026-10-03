import React, { useState, useEffect } from 'react';
import { 
  Product, 
  ProductCategory, 
  CurrencyCode, 
  Destination, 
  Supplier, 
  DestinationRegionItem, 
  CityHub, 
  MasterRegion, 
  ProductPricingMethod, 
  TransferVehicleConfig,
  TicketConfig,
  GuideConfig,
  RestaurantConfig,
  FerryConfig
} from '../../types';
import { ModuleMasterSyncBar } from './common/ModuleMasterSyncBar';
import { AppDatabase } from '../../services/db';
import { MasterDataService } from '../../services/masterDataService';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, CAPACITY_BASED_CATEGORIES, calculateB2BAgentPrice } from '../../services/pricingEngine';
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
  Gauge,
  Train,
  Sliders,
  Code,
  FileText,
  ExternalLink,
  Settings,
  Ticket,
  Utensils,
  Wine,
  Languages,
  CalendarDays,
  CheckSquare,
  X,
  Tag
} from 'lucide-react';
import { fileToDataUrl, convertUnsplashUrl, fetchUnsplashImagesByQuery } from '../../utils/imageUtils';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { EntitySEOSettingsTab } from './EntitySEOSettingsTab';
import { ProductUpdateWorkspace } from './ProductUpdateWorkspace';
import { JapanRailJourneyConfigurator } from '../JapanRail/JapanRailJourneyConfigurator';
import { GlobalConfiguratorRouter } from '../Configurators/GlobalConfiguratorRouter';
import { AUTHORITATIVE_PRODUCT_CATEGORIES, PRODUCT_CMS_CATEGORIES, resolveAuthoritativeCategory, CONFIGURATOR_REGISTRY_MAP } from '../../services/configuratorRegistry';
import { OperationalAssetSelector, SelectedAssetPayload } from './OperationalAssetSelector';
import { OperationalAssetsManager } from './OperationalAssetsManager';

interface ProductManagerProps {
  destinations: Destination[];
  onViewProduct?: (product: Product) => void;
}

const CATEGORIES: ProductCategory[] = [...PRODUCT_CMS_CATEGORIES];

export const ProductManager: React.FC<ProductManagerProps> = ({ destinations, onViewProduct }) => {
  const db = AppDatabase.getInstance();
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>(() => db.getProducts());
  const [masterRegions, setMasterRegions] = useState<MasterRegion[]>(() => db.getMasterRegions());
  const [regions, setRegions] = useState<DestinationRegionItem[]>(() => db.getRegions());
  const [cityHubs, setCityHubs] = useState<CityHub[]>(() => db.getCityHubs());
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => db.getSuppliers());
  
  useEffect(() => {
    return db.subscribe(() => {
      setProducts(db.getProducts());
      setMasterRegions(db.getMasterRegions());
      setRegions(db.getRegions());
      setCityHubs(db.getCityHubs());
      setSuppliers(db.getSuppliers());
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
  const [testingRailProduct, setTestingRailProduct] = useState<Product | null>(null);
  const [testingConfigProduct, setTestingConfigProduct] = useState<Product | null>(null);
  const [inspectingProduct, setInspectingProduct] = useState<Product | null>(null);
  const [isOperationalAssetsManagerOpen, setIsOperationalAssetsManagerOpen] = useState(false);
  const [operationalAssetsManagerTab, setOperationalAssetsManagerTab] = useState<'VEHICLES' | 'YACHTS' | 'FERRIES'>('VEHICLES');

  // Form State: Starts 100% clean for new products (no fabricated pricing or operational presets)
  const createCleanProductFormData = (): Partial<Product> => ({
    sku: `UB-PROD-${Math.floor(100000 + Math.random() * 900000)}`,
    name: '',
    title: '',
    shortDescription: '',
    longDescription: '',
    destinationId: '',
    destinationName: '',
    regionId: '',
    regionName: '',
    hubId: '',
    country: '',
    city: '',
    productType: '',
    category: 'Private Tours',
    subcategory: '',
    duration: '',
    operatingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    operatingHours: '',
    pricingMethod: 'capacity_based',
    vehicleConfig: undefined,
    vehicleId: undefined,
    vehicleNameSnapshot: undefined,
    vehicleTypeSnapshot: undefined,
    capacitySnapshot: undefined,
    yachtId: undefined,
    yachtNameSnapshot: undefined,
    yachtTypeSnapshot: undefined,
    yachtCapacitySnapshot: undefined,
    ferryId: undefined,
    ferryNameSnapshot: undefined,
    ferryTypeSnapshot: undefined,
    ferryCapacitySnapshot: undefined,
    adultNetPrice: undefined,
    childNetPrice: undefined,
    infantNetPrice: undefined,
    currency: 'USD',
    nativeCurrency: 'USD',
    defaultMarkupPercent: undefined,
    buyerMarkupPercent: undefined,
    b2bAgentMarkupPercent: undefined,
    taxPercent: undefined,
    commissionPercent: undefined,
    serviceFeeFixed: undefined,
    sellingPriceStartingFrom: undefined,
    optionalUpgradeProductIds: [],
    inclusions: [],
    exclusions: [],
    importantInformation: [],
    meetingPoint: '',
    pickupInformation: '',
    images: [],
    location: '',
    latitude: 35.6762,
    longitude: 139.6503,
    rating: 5.0,
    reviewCount: 0,
    status: 'ACTIVE'
  });

  const [formData, setFormData] = useState<Partial<Product>>(() => 
    createCleanProductFormData()
  );

  const [inclusionInput, setInclusionInput] = useState('');
  const [exclusionInput, setExclusionInput] = useState('');

  const handleCategoryChange = (newCat: ProductCategory) => {
    if (editingProduct && editingProduct.category !== newCat) {
      const confirmed = window.confirm(
        `Changing category from "${editingProduct.category}" to "${newCat}" will update the active operational fields and pricing structure. Do you wish to proceed?`
      );
      if (!confirmed) return;
    }
    const isCapCat = CAPACITY_BASED_CATEGORIES.includes(newCat as string);
    setFormData(prev => ({
      ...prev,
      category: newCat,
      pricingMethod: isCapCat ? 'capacity_based' : (newCat === 'Guides' ? 'per_person' : prev.pricingMethod || 'per_person')
    }));
  };

  const handleAddInclusion = () => {
    if (!inclusionInput.trim()) return;
    const current = formData.inclusions || [];
    if (!current.includes(inclusionInput.trim())) {
      setFormData({ ...formData, inclusions: [...current, inclusionInput.trim()] });
    }
    setInclusionInput('');
  };

  const handleRemoveInclusion = (idx: number) => {
    const current = [...(formData.inclusions || [])];
    current.splice(idx, 1);
    setFormData({ ...formData, inclusions: current });
  };

  const handleAddExclusion = () => {
    if (!exclusionInput.trim()) return;
    const current = formData.exclusions || [];
    if (!current.includes(exclusionInput.trim())) {
      setFormData({ ...formData, exclusions: [...current, exclusionInput.trim()] });
    }
    setExclusionInput('');
  };

  const handleRemoveExclusion = (idx: number) => {
    const current = [...(formData.exclusions || [])];
    current.splice(idx, 1);
    setFormData({ ...formData, exclusions: current });
  };
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
    setFormData(createCleanProductFormData());
    setIsModalOpen(true);
  };

  const handleOpenEdit = (product: Product) => {
    setEditingProduct(product);
    setModalTab('CONTENT');
    const isCapCat = CAPACITY_BASED_CATEGORIES.includes(product.category as string);
    setFormData({
      ...product,
      pricingMethod: product.pricingMethod || (isCapCat ? 'capacity_based' : 'per_person'),
      // Load actual saved data - never synthesize defaults for existing records
      vehicleConfig: product.vehicleConfig,
      buyerMarkupPercent: product.buyerMarkupPercent,
      b2bAgentMarkupPercent: product.b2bAgentMarkupPercent,
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

  const calculateSellingPrice = (net?: number, markup?: number, tax?: number, fee?: number): number | null => {
    if (net === undefined || net === null || isNaN(net) || net <= 0) return null;
    const effectiveMarkup = markup !== undefined && !isNaN(markup) ? markup : 0;
    const effectiveTax = tax !== undefined && !isNaN(tax) ? tax : 0;
    const effectiveFee = fee !== undefined && !isNaN(fee) ? fee : 0;
    const markupAmt = net * (effectiveMarkup / 100);
    const taxAmt = markupAmt * (effectiveTax / 100);
    const subtotal = net + markupAmt + taxAmt;
    const feeAmt = subtotal * (effectiveFee / 100);
    return Math.round(subtotal + feeAmt);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.sku) return;

    const isCapacityBased = formData.pricingMethod === 'capacity_based' || CAPACITY_BASED_CATEGORIES.includes(formData.category as string);
    const maxSeats = Number(formData.vehicleConfig?.maxSeats) || Number(formData.capacitySnapshot) || Number(formData.maxPax) || 0;
    const vehicleNet = formData.vehicleConfig?.unitVehicleNetCost !== undefined ? Number(formData.vehicleConfig.unitVehicleNetCost) : (formData.adultNetPrice !== undefined ? Number(formData.adultNetPrice) : 0);
    
    const adultNet = isCapacityBased ? vehicleNet : (Number(formData.adultNetPrice) || 0);
    const childNet = isCapacityBased ? 0 : (Number(formData.childNetPrice) || 0);
    const infantNet = isCapacityBased ? 0 : (Number(formData.infantNetPrice) || 0);
    const marginPercent = formData.b2bAgentMarkupPercent !== undefined && !isNaN(Number(formData.b2bAgentMarkupPercent))
      ? Number(formData.b2bAgentMarkupPercent)
      : (formData.defaultMarkupPercent !== undefined && !isNaN(Number(formData.defaultMarkupPercent)) ? Number(formData.defaultMarkupPercent) : 0);
    const tax = formData.taxPercent !== undefined && !isNaN(Number(formData.taxPercent)) ? Number(formData.taxPercent) : 0;
    const fee = formData.serviceFeeFixed !== undefined && !isNaN(Number(formData.serviceFeeFixed)) ? Number(formData.serviceFeeFixed) : 0;
    
    const b2bCalc = calculateB2BAgentPrice({
      nettCost: adultNet,
      marginPercent,
      taxPercent: tax,
      serviceFeePercent: fee,
      currency: (formData.currency as CurrencyCode) || 'USD'
    });
    const computedSelling = b2bCalc.price;

    // Canonical Hierarchy Validation
    const masterData = MasterDataService.getInstance();
    const hierarchy = masterData.validateHierarchy(formData.regionId, formData.destinationId, formData.hubId);
    if (!hierarchy.valid) {
      alert(`Data Integrity Error: ${hierarchy.error}`);
      return;
    }

    const productToSave: Product = {
      id: editingProduct ? editingProduct.id : `prod-${Date.now()}`,
      sku: formData.sku || `SKU-${Date.now()}`,
      regionId: hierarchy.region!.id,
      regionName: hierarchy.region!.name,
      destinationId: hierarchy.destination!.id,
      destinationName: hierarchy.destination!.name,
      country: hierarchy.destination!.country || hierarchy.destination!.name,
      hubId: hierarchy.hub ? hierarchy.hub.id : (formData.hubId || ''),
      city: hierarchy.hub ? hierarchy.hub.name : (formData.city || hierarchy.destination!.name),
      productType: formData.productType || '',
      name: formData.name || '',
      shortDescription: formData.shortDescription || '',
      longDescription: formData.longDescription || formData.shortDescription || '',
      supplierId: formData.supplierId || suppliers[0]?.id || '',
      supplierName: suppliers.find(s => s.id === formData.supplierId)?.name || formData.supplierName || 'Ground Supplier',
      supplierProductCode: formData.supplierProductCode || formData.sku || '',
      category: (formData.category as ProductCategory) || 'Private Tours',
      subcategory: formData.subcategory || '',
      duration: formData.duration || '',
      operatingDays: formData.operatingDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      operatingHours: formData.operatingHours || '',
      pricingMethod: isCapacityBased ? 'capacity_based' : (formData.pricingMethod || 'per_person'),
      vehicleId: formData.vehicleId,
      vehicleNameSnapshot: formData.vehicleNameSnapshot,
      vehicleTypeSnapshot: formData.vehicleTypeSnapshot,
      capacitySnapshot: formData.capacitySnapshot,
      yachtId: formData.yachtId,
      yachtNameSnapshot: formData.yachtNameSnapshot,
      yachtTypeSnapshot: formData.yachtTypeSnapshot,
      yachtCapacitySnapshot: formData.yachtCapacitySnapshot,
      ferryId: formData.ferryId,
      ferryNameSnapshot: formData.ferryNameSnapshot,
      ferryTypeSnapshot: formData.ferryTypeSnapshot,
      ferryCapacitySnapshot: formData.ferryCapacitySnapshot,
      vehicleConfig: isCapacityBased && (formData.vehicleConfig || formData.vehicleId || formData.yachtId) ? {
        ...(formData.vehicleConfig || {}),
        vehicleModel: formData.vehicleConfig?.vehicleModel || formData.vehicleNameSnapshot || formData.yachtNameSnapshot || '',
        vehicleType: formData.vehicleConfig?.vehicleType || formData.vehicleTypeSnapshot || formData.yachtTypeSnapshot || '',
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
      currency: (formData.currency as CurrencyCode) || (formData.nativeCurrency as CurrencyCode) || 'USD',
      nativeCurrency: (formData.nativeCurrency as CurrencyCode) || (formData.currency as CurrencyCode) || 'USD',
      defaultMarkupPercent: marginPercent,
      buyerMarkupPercent: undefined,
      b2bAgentMarkupPercent: marginPercent,
      taxPercent: tax,
      commissionPercent: Number(formData.commissionPercent) || 0,
      serviceFeeFixed: fee,
      sellingPriceStartingFrom: computedSelling !== null ? computedSelling : 0,
      optionalUpgradeProductIds: formData.optionalUpgradeProductIds || [],
      season: (formData.season as any) || 'All Year',
      validityFrom: formData.validityFrom || '2026-01-01',
      validityTo: formData.validityTo || '2026-12-31',
      minPax: Number(formData.minPax) || 1,
      maxPax: maxSeats > 0 ? maxSeats : (Number(formData.maxPax) || 1),
      availability: (formData.availability as any) || 'INSTANT',
      bookingRequiredDays: Number(formData.bookingRequiredDays) || 1,
      cancellationPolicy: formData.cancellationPolicy || '',
      inclusions: formData.inclusions || [],
      exclusions: formData.exclusions || [],
      importantInformation: formData.importantInformation || [],
      meetingPoint: formData.meetingPoint || '',
      pickupInformation: formData.pickupInformation || '',
      images: formData.images && (formData.images || []).length > 0 ? formData.images : [],
      location: `${formData.city || ''}, ${formData.country || ''}`.replace(/^,\s*|,\s*$/g, ''),
      latitude: formData.latitude || 35.6762,
      longitude: formData.longitude || 139.6503,
      rating: formData.rating || 5.0,
      reviewCount: formData.reviewCount || 0,
      slug: formData.slug || (formData.name || 'product').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      seo: formData.seo,
      status: formData.status || 'ACTIVE',
      ticketConfig: formData.ticketConfig,
      guideConfig: formData.guideConfig,
      restaurantConfig: formData.restaurantConfig,
      ferryConfig: formData.ferryConfig,
      configuration: formData.configuration || editingProduct?.configuration,
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
    const q = (searchQuery || '').toLowerCase().trim();
    const matchesSearch = !q ||
      (p.name || '').toLowerCase().includes(q) ||
      (p.sku || '').toLowerCase().includes(q) ||
      (p.city || '').toLowerCase().includes(q) ||
      (p.regionName || '').toLowerCase().includes(q) ||
      (p.supplierName || '').toLowerCase().includes(q);
    const matchesMasterReg = selectedMasterRegion === 'ALL' || p.regionId === selectedMasterRegion;
    const matchesDest = selectedDestination === 'ALL' || p.destinationId === selectedDestination;
    const matchesHub = selectedCityHub === 'ALL' || p.hubId === selectedCityHub || (p.city || '').toLowerCase() === (selectedCityHub || '').toLowerCase();
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

  if (isModalOpen) {
    return (
      <ProductUpdateWorkspace
        product={editingProduct}
        destinations={destinations}
        masterRegions={masterRegions}
        cityHubs={cityHubs}
        suppliers={suppliers}
        onSave={(savedProduct) => {
          db.saveProduct(savedProduct, user);
          refreshProducts();
          setIsModalOpen(false);
        }}
        onCancel={() => setIsModalOpen(false)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumbs & Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
        <nav className="flex items-center space-x-1.5 text-xs text-slate-500 font-medium">
          <span className="hover:text-slate-800 transition-colors cursor-pointer">Home</span>
          <span className="text-slate-300">/</span>
          <span className="text-[#008972] font-semibold">Products</span>
        </nav>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1 border-t border-slate-100">
          <div>
            <div className="flex items-center space-x-2 text-[#008972] text-xs font-bold uppercase tracking-wider mb-1">
              <Package className="w-4 h-4" />
              <span>Master Product Database ({products.length} Items)</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Products</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage your travel products, pricing, availability rules, and wholesale commercial margins.
            </p>
          </div>

          <div className="flex items-center space-x-2.5 shrink-0">
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center space-x-2 bg-[#00C6A6] hover:bg-[#008972] text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add Product</span>
            </button>
          </div>
        </div>
      </div>

      {/* Google Sheets Master Sync Bar */}
      <ModuleMasterSyncBar 
        moduleType="PRODUCTS" 
        onSyncCompleted={refreshProducts} 
      />

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
                      <div className="text-[11px] text-slate-500 font-medium flex items-center space-x-1 flex-wrap gap-1">
                        <span className="text-slate-700 font-semibold">{product.city}</span>
                        <span>•</span>
                        <span>{product.category}</span>
                        {((product.upsells && product.upsells.length > 0) || (product.addons && product.addons.length > 0)) && (
                          <span className="inline-flex items-center space-x-0.5 px-1.5 py-0.5 rounded bg-teal-50 border border-teal-200 text-[#008972] text-[9px] font-extrabold">
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>{(product.upsells?.length || product.addons?.length || 0)} Upsells</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    {(!product.adultNetPrice && !(product.vehicleConfig?.unitVehicleNetCost) && !product.sellingPriceStartingFrom) ? (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold" title="Pricing record incomplete. Please edit product to configure base rates.">
                        <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                        <span>Pricing Pending</span>
                      </span>
                    ) : (
                      <>
                        <div className="font-bold font-mono text-slate-900 text-xs">
                          {formatCurrency(product.adultNetPrice ?? product.vehicleConfig?.unitVehicleNetCost, product.nativeCurrency || product.currency)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Child: {formatCurrency(product.childNetPrice, product.nativeCurrency || product.currency)}
                        </div>
                      </>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="text-[11px] space-y-0.5">
                      <div>Markup: <strong className="text-emerald-700">+{product.defaultMarkupPercent}%</strong></div>
                      <div className="text-slate-400 text-[10px]">Tax: +{product.taxPercent}% • Fee: {formatCurrency(product.serviceFeeFixed, product.nativeCurrency || product.currency)}</div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    {(!product.sellingPriceStartingFrom && !(product.adultNetPrice || product.vehicleConfig?.unitVehicleNetCost)) ? (
                      <span className="text-[10px] font-bold text-amber-700 font-mono">Rate Unconfigured</span>
                    ) : (
                      <>
                        <div className="font-bold font-mono text-[#008972] text-xs">
                          {formatCurrency(product.sellingPriceStartingFrom, product.nativeCurrency || product.currency)}
                        </div>
                        <span className="text-[10px] text-slate-400">Gross Quoted ({product.nativeCurrency || product.currency})</span>
                      </>
                    )}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-4xl w-full max-h-[94dvh] sm:max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 p-4 sm:p-6 pb-4 shrink-0 bg-white">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  {editingProduct ? `Edit Product: ${editingProduct.name}` : 'Create New Ground Product'}
                </h3>
                <p className="text-xs text-slate-500">Configure SKU, net pricing formulas, inclusions, and operational parameters.</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 sm:p-2 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Subtabs */}
            <div className="flex items-center space-x-2 border-b border-slate-200 px-4 sm:px-6 py-2.5 shrink-0 bg-slate-50 overflow-x-auto">
              <button
                type="button"
                onClick={() => setModalTab('CONTENT')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  modalTab === 'CONTENT' ? 'bg-[#00C6A6] text-slate-950 shadow-xs' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                1. Product Information & Category Details
              </button>
              <button
                type="button"
                onClick={() => setModalTab('SEO')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 whitespace-nowrap ${
                  modalTab === 'SEO' ? 'bg-[#008972] text-white shadow-xs' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Globe2 className="w-3.5 h-3.5" />
                <span>2. SEO & Search Indexing</span>
              </button>
            </div>

            <form onSubmit={handleSave} className="flex-1 flex flex-col overflow-hidden text-xs">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 modal-body-scroll">
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
                        setFormData({
                          ...formData,
                          regionId: regId,
                          regionName: reg?.name || '',
                          destinationId: '',
                          destinationName: '',
                          country: '',
                          hubId: '',
                          city: '',
                          location: ''
                        });
                      }}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-[#00C6A6]"
                    >
                      <option value="">-- Select Master Region --</option>
                      {masterRegions.map(r => (
                        <option key={r.id} value={r.id}>{r.name} ({r.id})</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">2. Destination (Tier 2) *</label>
                    <select
                      required
                      disabled={!formData.regionId}
                      value={formData.destinationId || ''}
                      onChange={e => {
                        const destId = e.target.value;
                        const dest = destinations.find(d => d.id === destId);
                        setFormData({
                          ...formData,
                          destinationId: destId,
                          destinationName: dest?.name || '',
                          country: dest?.country || dest?.name || '',
                          hubId: '',
                          city: '',
                          location: dest?.name || ''
                        });
                      }}
                      className={`w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-[#00C6A6] ${!formData.regionId ? 'bg-slate-100 cursor-not-allowed opacity-60' : ''}`}
                    >
                      <option value="">{formData.regionId ? '-- Select Destination --' : '-- Select Region First --'}</option>
                      {destinations
                        .filter(d => d.regionId === formData.regionId)
                        .map(d => (
                          <option key={d.id} value={d.id}>{d.name} ({d.id})</option>
                        ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">3. Destination Hub / City (Tier 3) *</label>
                    <div className="flex gap-1.5">
                      <select
                        disabled={!formData.destinationId}
                        value={formData.hubId || ''}
                        onChange={e => {
                          const hId = e.target.value;
                          const hub = cityHubs.find(h => h.id === hId);
                          setFormData({
                            ...formData,
                            hubId: hId,
                            city: hub?.name || formData.city || '',
                            location: `${hub?.name || formData.city || ''}, ${formData.destinationName || ''}`.replace(/^,\s*|,\s*$/g, '')
                          });
                        }}
                        className={`w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-[#00C6A6] ${!formData.destinationId ? 'bg-slate-100 cursor-not-allowed opacity-60' : ''}`}
                      >
                        <option value="">{formData.destinationId ? '-- Select City Hub --' : '-- Select Destination First --'}</option>
                        {cityHubs
                          .filter(h => h.destinationId === formData.destinationId)
                          .map(h => (
                            <option key={h.id} value={h.id}>{h.name} ({h.id})</option>
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

              {/* DYNAMIC CATEGORY-SPECIFIC OPERATIONAL & PRICING SPECIFICATIONS */}
              <div className="bg-slate-900 text-white p-5 rounded-2xl space-y-4">
                {/* Category Header Banner */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 bg-teal-500/20 text-[#00E5C0] rounded-lg">
                      {formData.category === 'Private Tours' && <Car className="w-4 h-4" />}
                      {formData.category === 'Group Tours' && <Users className="w-4 h-4" />}
                      {formData.category === 'Transfers' && <Car className="w-4 h-4" />}
                      {formData.category === 'Tickets' && <Ticket className="w-4 h-4" />}
                      {formData.category === 'Private Yacht' && <Ship className="w-4 h-4" />}
                      {formData.category === 'Ferries' && <Anchor className="w-4 h-4" />}
                      {formData.category === 'Guides' && <Languages className="w-4 h-4" />}
                      {formData.category === 'Lunch / Dinner Restaurant' && <Utensils className="w-4 h-4" />}
                      {!['Private Tours', 'Group Tours', 'Transfers', 'Tickets', 'Private Yacht', 'Ferries', 'Guides', 'Lunch / Dinner Restaurant'].includes(formData.category || '') && <Calculator className="w-4 h-4" />}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <span>{formData.category} — Operational & Rate Specifications</span>
                        {formData.pricingMethod === 'capacity_based' ? (
                          <span className="text-[10px] bg-teal-500/20 text-[#00E5C0] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border border-teal-500/30">
                            Capacity-Based Vehicle
                          </span>
                        ) : (
                          <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border border-blue-500/30">
                            Per-Person Rate
                          </span>
                        )}
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        {formData.category === 'Private Tours' && 'Private chauffeured tour with capacity-based fleet allocation and fixed unit vehicle cost.'}
                        {formData.category === 'Group Tours' && 'Shared scheduled departure with per-person rate tiers and minimum pax thresholds.'}
                        {formData.category === 'Transfers' && 'Dedicated airport/intercity transfer with luggage limits and flight number requirements.'}
                        {formData.category === 'Tickets' && 'Direct admissions and timed entries with instant redemption barcodes and age tiering.'}
                        {formData.category === 'Private Yacht' && 'Private vessel charter with skipper, crew, fuel, and passenger manifest capacity.'}
                        {formData.category === 'Ferries' && 'Scheduled passenger ferry and maritime transit with route ports and baggage policies.'}
                        {formData.category === 'Guides' && 'Professional licensed guide services with supported languages and expertise badges.'}
                        {formData.category === 'Lunch / Dinner Restaurant' && 'Curated culinary reservations with set menus, dietary compliance, and drink packages.'}
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

                {/* 1. CATEGORY: PRIVATE TOURS & TRANSFERS & PRIVATE YACHT (Capacity-Based) */}
                {formData.pricingMethod === 'capacity_based' ? (
                  <div className="space-y-4">
                    <div className="bg-slate-800/80 p-4 rounded-xl border border-teal-500/30 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                        <span className="font-bold text-[#00E5C0] flex items-center gap-1.5">
                          {formData.category === 'Private Yacht' ? <Ship className="w-4 h-4" /> : <Car className="w-4 h-4 text-[#00E5C0]" />}
                          <span>
                            {formData.category === 'Private Yacht' 
                              ? 'Authoritative Yacht Master Asset & Capacity Specifications' 
                              : 'Authoritative Vehicle Master Asset & Capacity Specifications'}
                          </span>
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setOperationalAssetsManagerTab(formData.category === 'Private Yacht' ? 'YACHTS' : 'VEHICLES');
                              setIsOperationalAssetsManagerOpen(true);
                            }}
                            className="text-[11px] text-teal-300 hover:text-white underline font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <span>Manage {formData.category === 'Private Yacht' ? 'Yacht' : 'Vehicle'} Database</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Transfers Hub-to-Hub Routing */}
                      {formData.category === 'Transfers' && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-900/90 p-3 rounded-lg border border-slate-700">
                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-300 font-medium">Origin Hub (From) *</label>
                            <select
                              value={formData.fromHubId || ''}
                              onChange={e => {
                                const h = cityHubs.find(hub => hub.id === e.target.value);
                                setFormData(prev => ({ ...prev, fromHubId: h?.id || '', fromHubName: h?.name || '' }));
                              }}
                              className="w-full p-2 bg-white rounded-lg font-semibold text-slate-900"
                            >
                              <option value="">-- Select Origin Hub --</option>
                              {cityHubs.map(h => (
                                <option key={h.id} value={h.id}>{h.name} ({h.code || h.id})</option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-300 font-medium">Destination Hub (To) *</label>
                            <select
                              value={formData.toHubId || ''}
                              onChange={e => {
                                const h = cityHubs.find(hub => hub.id === e.target.value);
                                setFormData(prev => ({ ...prev, toHubId: h?.id || '', toHubName: h?.name || '' }));
                              }}
                              className="w-full p-2 bg-white rounded-lg font-semibold text-slate-900"
                            >
                              <option value="">-- Select Destination Hub --</option>
                              {cityHubs.map(h => (
                                <option key={h.id} value={h.id}>{h.name} ({h.code || h.id})</option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-300 font-medium">Transfer Route Type</label>
                            <select
                              value={formData.vehicleConfig?.route || 'Airport Transfer (Airport ↔ Hotel)'}
                              onChange={e => setFormData(prev => ({
                                ...prev,
                                vehicleConfig: { ...(prev.vehicleConfig || {}), route: e.target.value }
                              }))}
                              className="w-full p-2 bg-white rounded-lg font-medium text-slate-900 text-xs"
                            >
                              <option value="Airport Transfer (Airport ↔ Hotel)">Airport Transfer (Airport ↔ Hotel)</option>
                              <option value="Station Transfer (Bullet Train Station ↔ Hotel)">Station Transfer (Bullet Train Station ↔ Hotel)</option>
                              <option value="Intercity Chauffeur (e.g. Tokyo → Hakone)">Intercity Chauffeur (e.g. Tokyo → Hakone)</option>
                              <option value="City Point-to-Point (Dinner / Meeting)">City Point-to-Point (Dinner / Meeting)</option>
                              <option value="Full-Day Chauffeur Standby (10 Hours)">Full-Day Chauffeur Standby (10 Hours)</option>
                            </select>
                          </div>
                        </div>
                      )}

                      {formData.category !== 'Transfers' && (
                        <>
                          {/* Searchable Database Operational Asset Selector */}
                          <div className="space-y-2">
                        <label className="text-xs text-slate-300 font-semibold block">
                          {formData.category === 'Private Yacht' 
                            ? 'Select Operational Yacht from Authoritative Master Database *' 
                            : 'Select Operational Vehicle from Authoritative Fleet Database *'}
                        </label>
                        <OperationalAssetSelector
                          assetType={formData.category === 'Private Yacht' ? 'YACHT' : 'VEHICLE'}
                          selectedId={formData.category === 'Private Yacht' ? (formData.yachtId || formData.vehicleConfig?.yachtId) : (formData.vehicleId || formData.vehicleConfig?.vehicleId)}
                          selectedName={formData.category === 'Private Yacht' ? (formData.yachtNameSnapshot || formData.vehicleConfig?.yachtName || formData.vehicleConfig?.vehicleModel) : (formData.vehicleNameSnapshot || formData.vehicleConfig?.vehicleName || formData.vehicleConfig?.vehicleModel)}
                          selectedType={formData.category === 'Private Yacht' ? (formData.yachtTypeSnapshot || formData.vehicleConfig?.yachtType || formData.vehicleConfig?.vehicleType) : (formData.vehicleTypeSnapshot || formData.vehicleConfig?.vehicleType)}
                          selectedCapacity={formData.category === 'Private Yacht' ? (formData.yachtCapacitySnapshot || formData.vehicleConfig?.maxSeats) : (formData.capacitySnapshot || formData.vehicleConfig?.maxSeats)}
                          selectedDimensions={formData.vehicleConfig?.yachtSize || formData.vehicleConfig?.yachtLength}
                          destinationId={formData.destinationId}
                          hubId={formData.hubId}
                          onSelect={(asset: SelectedAssetPayload) => {
                            if (formData.category === 'Private Yacht') {
                              setFormData(prev => ({
                                ...prev,
                                yachtId: asset.id,
                                yachtNameSnapshot: asset.name,
                                yachtTypeSnapshot: asset.type,
                                yachtCapacitySnapshot: asset.capacity,
                                maxPax: asset.capacity,
                                vehicleConfig: {
                                  ...(prev.vehicleConfig || {}),
                                  yachtId: asset.id,
                                  yachtName: asset.name,
                                  yachtModel: asset.model,
                                  yachtType: asset.type,
                                  vehicleModel: asset.name,
                                  vehicleType: asset.type,
                                  maxSeats: asset.capacity,
                                  passengerCapacity: asset.capacity,
                                  totalSeats: asset.capacity,
                                  yachtSize: asset.length || asset.dimensions || '',
                                  yachtLength: asset.length || '',
                                  skipperName: asset.operator || 'Licensed Skipper & Crew',
                                  allowMultipleVehicles: prev.vehicleConfig?.allowMultipleVehicles ?? true,
                                  autoAllocateVehicles: prev.vehicleConfig?.autoAllocateVehicles ?? true,
                                  maxVehicles: prev.vehicleConfig?.maxVehicles || 5
                                }
                              }));
                            } else {
                              setFormData(prev => ({
                                ...prev,
                                vehicleId: asset.id,
                                vehicleNameSnapshot: asset.name,
                                vehicleTypeSnapshot: asset.type,
                                capacitySnapshot: asset.capacity,
                                maxPax: asset.capacity,
                                vehicleConfig: {
                                  ...(prev.vehicleConfig || {}),
                                  vehicleId: asset.id,
                                  vehicleName: asset.name,
                                  vehicleModel: asset.model,
                                  vehicleType: asset.type,
                                  maxSeats: asset.capacity,
                                  passengerCapacity: asset.capacity,
                                  totalSeats: asset.capacity,
                                  maxLuggage: asset.luggageCapacity !== undefined ? asset.luggageCapacity : (prev.vehicleConfig?.maxLuggage || 4),
                                  adultSeatCount: prev.vehicleConfig?.adultSeatCount ?? 1,
                                  childSeatCount: prev.vehicleConfig?.childSeatCount ?? 1,
                                  infantSeatCount: prev.vehicleConfig?.infantSeatCount ?? 0,
                                  allowMultipleVehicles: prev.vehicleConfig?.allowMultipleVehicles ?? true,
                                  autoAllocateVehicles: prev.vehicleConfig?.autoAllocateVehicles ?? true,
                                  maxVehicles: prev.vehicleConfig?.maxVehicles || 5
                                }
                              }));
                            }
                          }}
                          onClear={() => {
                            if (formData.category === 'Private Yacht') {
                              setFormData(prev => ({
                                ...prev,
                                yachtId: undefined,
                                yachtNameSnapshot: undefined,
                                yachtTypeSnapshot: undefined,
                                yachtCapacitySnapshot: undefined,
                                vehicleConfig: prev.vehicleConfig ? {
                                  ...prev.vehicleConfig,
                                  yachtId: undefined,
                                  yachtName: undefined,
                                  yachtModel: undefined,
                                  yachtType: undefined,
                                  yachtSize: undefined,
                                  maxSeats: 0
                                } : undefined
                              }));
                            } else {
                              setFormData(prev => ({
                                ...prev,
                                vehicleId: undefined,
                                vehicleNameSnapshot: undefined,
                                vehicleTypeSnapshot: undefined,
                                capacitySnapshot: undefined,
                                vehicleConfig: prev.vehicleConfig ? {
                                  ...prev.vehicleConfig,
                                  vehicleId: undefined,
                                  vehicleName: undefined,
                                  vehicleModel: undefined,
                                  vehicleType: undefined,
                                  maxSeats: 0
                                } : undefined
                              }));
                            }
                          }}
                          onOpenMasterManager={() => {
                            setOperationalAssetsManagerTab(formData.category === 'Private Yacht' ? 'YACHTS' : 'VEHICLES');
                            setIsOperationalAssetsManagerOpen(true);
                          }}
                        />
                      </div>

                      {/* Authoritative Specs Grid (Loaded from Database Snapshot) */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-700/80 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase font-semibold">
                            {formData.category === 'Private Yacht' ? 'Yacht Model / Charter' : 'Vehicle Model'}
                          </span>
                          <span className="text-white font-bold truncate block">
                            {formData.category === 'Private Yacht' 
                              ? (formData.yachtNameSnapshot || formData.vehicleConfig?.vehicleModel || '—')
                              : (formData.vehicleNameSnapshot || formData.vehicleConfig?.vehicleModel || 'Not Selected')}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase font-semibold">Classification</span>
                          <span className="text-slate-200 font-semibold block">
                            {formData.category === 'Private Yacht'
                              ? (formData.yachtTypeSnapshot || formData.vehicleConfig?.vehicleType || '—')
                              : (formData.vehicleTypeSnapshot || formData.vehicleConfig?.vehicleType || 'Not Selected')}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase font-semibold">
                            {formData.category === 'Private Yacht' ? 'Max Guest Capacity' : 'Authoritative Capacity'}
                          </span>
                          <span className="text-[#00E5C0] font-bold block">
                            {formData.category === 'Private Yacht'
                              ? (formData.yachtCapacitySnapshot || formData.vehicleConfig?.maxSeats ? `${formData.yachtCapacitySnapshot || formData.vehicleConfig?.maxSeats} Guests` : '—')
                              : (formData.capacitySnapshot || formData.vehicleConfig?.maxSeats ? `${formData.capacitySnapshot || formData.vehicleConfig?.maxSeats} Seats` : '—')}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase font-semibold">
                            {formData.category === 'Private Yacht' ? 'Length / Dimensions' : 'Luggage Capacity'}
                          </span>
                          <span className="text-slate-300 font-medium block">
                            {formData.category === 'Private Yacht'
                              ? (formData.vehicleConfig?.yachtSize || formData.vehicleConfig?.yachtLength || '—')
                              : (formData.vehicleConfig?.maxLuggage !== undefined ? `${formData.vehicleConfig.maxLuggage} Suitcases` : '—')}
                          </span>
                        </div>
                      </div>

                      {/* Base Currency & Contracted Commercial Nett Cost (Section 10: Empty-First) */}
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
                                ? `Contracted Charter Nett Cost * (Constant for 1 to ${formData.yachtCapacitySnapshot || formData.vehicleConfig?.maxSeats || 'Max'} Guests)`
                                : `Contracted Vehicle Unit Nett Cost * (Constant for 1 to ${formData.capacitySnapshot || formData.vehicleConfig?.maxSeats || 'Max'} Seats)`}
                            </span>
                            <span className="text-[10px] text-slate-400 font-normal">Authoritative Supplier Rate</span>
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={formData.vehicleConfig?.unitVehicleNetCost !== undefined ? formData.vehicleConfig.unitVehicleNetCost : (formData.adultNetPrice !== undefined ? formData.adultNetPrice : '')}
                            onChange={e => {
                              const val = e.target.value === '' ? undefined : Number(e.target.value);
                              setFormData(prev => ({
                                ...prev,
                                adultNetPrice: val,
                                adultNettCost: val,
                                vehicleConfig: {
                                  ...(prev.vehicleConfig || {}),
                                  unitVehicleNetCost: val,
                                  totalTransferCost: val
                                }
                              }));
                            }}
                            placeholder="Enter Contracted Nett Cost (e.g. 16500)"
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
                                ? 'Guest Manifest Constraints' 
                                : 'Passenger Seat Occupancy Rules (Operational Constraints)'}
                            </span>
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {formData.category === 'Private Yacht' ? 'Passenger capacity slots utilized' : 'Physical seats occupied per passenger'}
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
                              onChange={e => setFormData(prev => ({
                                ...prev,
                                vehicleConfig: { ...(prev.vehicleConfig || {}), adultSeatCount: Number(e.target.value) }
                              }))}
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
                              onChange={e => setFormData(prev => ({
                                ...prev,
                                vehicleConfig: { ...(prev.vehicleConfig || {}), childSeatCount: Number(e.target.value) }
                              }))}
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
                              onChange={e => setFormData(prev => ({
                                ...prev,
                                vehicleConfig: { ...(prev.vehicleConfig || {}), infantSeatCount: Number(e.target.value) }
                              }))}
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
                            onChange={e => setFormData(prev => ({
                              ...prev,
                              vehicleConfig: {
                                ...(prev.vehicleConfig || {}),
                                allowMultipleVehicles: e.target.checked,
                                autoAllocateVehicles: e.target.checked
                              }
                            }))}
                            className="rounded text-[#00C6A6] focus:ring-[#00C6A6] w-4 h-4"
                          />
                          <span>
                            {formData.category === 'Private Yacht'
                              ? `Allow auto-allocation of multiple yachts if passenger count exceeds maximum guest capacity`
                              : `Allow auto-allocation of multiple vehicles if passenger count exceeds seating capacity`}
                          </span>
                        </label>
                        <span className="text-[10px] text-slate-400">
                          {formData.category === 'Private Yacht' ? 'Max charter: 5 yachts' : 'Max fleet: 5 vehicles'}
                        </span>
                      </div>
                        </>
                      )}
                    </div>

                    {/* LIVE INTERACTIVE PASSENGER CAPACITY SIMULATION TABLE */}
                    {formData.category !== 'Transfers' && (
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

                      {(() => {
                        const maxS = Number(formData.vehicleConfig?.maxSeats) || Number(formData.capacitySnapshot) || Number(formData.yachtCapacitySnapshot) || 0;
                        const unitCost = formData.vehicleConfig?.unitVehicleNetCost !== undefined ? Number(formData.vehicleConfig.unitVehicleNetCost) : (formData.adultNetPrice !== undefined ? Number(formData.adultNetPrice) : 0);

                        if (!maxS || maxS <= 0 || !unitCost || unitCost <= 0) {
                          return (
                            <div className="py-8 px-4 text-center border border-dashed border-slate-800 rounded-lg bg-slate-900/30">
                              <Calculator className="w-6 h-6 text-slate-600 mx-auto mb-2" />
                              <p className="text-xs font-semibold text-slate-300">Simulation Breakdown Unavailable</p>
                              <p className="text-[11px] text-slate-500 mt-1 max-w-md mx-auto">
                                {formData.category === 'Private Yacht'
                                  ? 'Select an authoritative yacht from the Yacht Master database and enter the contracted charter nett cost above to calculate capacity breakdown and delivered rates.'
                                  : 'Select an operational vehicle from the Vehicle Master database and enter the contracted vehicle nett cost above to calculate capacity breakdown and delivered rates.'}
                              </p>
                            </div>
                          );
                        }

                        const simPaxList = [1, 2, Math.max(2, Math.ceil(maxS / 2)), maxS, maxS + 1, maxS * 2]
                          .filter((v, i, a) => a.indexOf(v) === i && v > 0)
                          .sort((a, b) => a - b);

                        return (
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
                                  <th className="pb-1.5 font-semibold text-right text-teal-400">Price</th>
                                  <th className="pb-1.5 font-semibold text-right text-teal-300">Per-Person</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-900 text-slate-300">
                                {simPaxList.map(simPax => {
                                  const vehCount = Math.max(1, Math.ceil(simPax / maxS));
                                  const totalVehNett = vehCount * unitCost;
                                  const perPersonNett = totalVehNett / simPax;
                                  const marginPct = formData.b2bAgentMarkupPercent !== undefined ? formData.b2bAgentMarkupPercent : (formData.defaultMarkupPercent || 0);
                                  const taxPct = formData.taxPercent !== undefined ? formData.taxPercent : 0;
                                  const feePct = formData.serviceFeeFixed !== undefined ? formData.serviceFeeFixed : 0;
                                  
                                  const b2bCalc = calculateB2BAgentPrice({
                                    nettCost: totalVehNett,
                                    marginPercent: marginPct,
                                    taxPercent: taxPct,
                                    serviceFeePercent: feePct,
                                    currency: (formData.currency as CurrencyCode) || 'USD'
                                  });
                                  const totalSelling = b2bCalc.price;
                                  const perPersonSelling = Math.round((totalSelling / simPax) * 100) / 100;
                                  const isFull = simPax === maxS;
                                  const isOver = simPax > maxS;

                                  return (
                                    <tr key={simPax} className={`hover:bg-slate-900/60 ${isFull ? 'bg-teal-950/40 text-teal-200 font-semibold' : ''}`}>
                                      <td className="py-1.5 flex items-center gap-1">
                                        <Users className="w-3 h-3 text-slate-500" />
                                        <span>{simPax} Pax</span>
                                        {isFull && <span className="text-[9px] bg-teal-500/20 text-[#00E5C0] px-1 rounded ml-1 font-bold">MAX CAPACITY</span>}
                                        {isOver && (
                                          <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1 rounded ml-1 font-bold">
                                            {formData.category === 'Private Yacht' ? '2nd YACHT' : '2nd VEHICLE'}
                                          </span>
                                        )}
                                      </td>
                                      <td className="py-1.5">
                                        {vehCount} {formData.category === 'Private Yacht' ? (vehCount === 1 ? 'Yacht' : 'Yachts') : (vehCount === 1 ? 'Vehicle' : 'Vehicles')}
                                      </td>
                                      <td className="py-1.5 text-right font-mono">{formatCurrency(totalVehNett, formData.currency || 'USD')}</td>
                                      <td className="py-1.5 text-right font-mono font-bold text-[#00E5C0]">{formatCurrency(perPersonNett, formData.currency || 'USD')}</td>
                                      <td className="py-1.5 text-right font-mono text-teal-400">{formatCurrency(totalSelling, formData.currency || 'USD')}</td>
                                      <td className="py-1.5 text-right font-mono font-bold text-teal-300">{formatCurrency(perPersonSelling, formData.currency || 'USD')}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        );
                      })()}
                    </div>
                    )}
                  </div>
                ) : (
                  /* 2. CATEGORY: STANDARD PER-PERSON PRICING INPUTS (Group Tours, Tickets, Ferries, Guides, Restaurant) */
                  <div className="space-y-4">
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
                          min="0"
                          value={formData.adultNetPrice !== undefined ? formData.adultNetPrice : ''}
                          onChange={e => setFormData({ ...formData, adultNetPrice: e.target.value === '' ? undefined : Number(e.target.value) })}
                          placeholder="Enter Adult Nett Cost"
                          className="w-full p-2 bg-white rounded-lg font-bold text-slate-900"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] text-slate-300 font-medium">Child Nett Cost</label>
                        <input
                          type="number"
                          min="0"
                          value={formData.childNetPrice !== undefined ? formData.childNetPrice : ''}
                          onChange={e => setFormData({ ...formData, childNetPrice: e.target.value === '' ? undefined : Number(e.target.value) })}
                          placeholder="Enter Child Nett Cost"
                          className="w-full p-2 bg-white rounded-lg text-slate-900"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] text-slate-300 font-medium">Infant Nett Cost</label>
                        <input
                          type="number"
                          min="0"
                          value={formData.infantNetPrice !== undefined ? formData.infantNetPrice : ''}
                          onChange={e => setFormData({ ...formData, infantNetPrice: e.target.value === '' ? undefined : Number(e.target.value) })}
                          placeholder="Enter Infant Nett Cost"
                          className="w-full p-2 bg-white rounded-lg text-slate-900"
                        />
                      </div>
                    </div>

                    {/* Category-Specific Detailed Attributes */}
                    {/* TICKETS ATTRIBUTES */}
                    {formData.category === 'Tickets' && (
                      <div className="bg-slate-800/80 p-3.5 rounded-xl border border-blue-500/30 space-y-3">
                        <div className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                          <Ticket className="w-3.5 h-3.5" />
                          <span>Attraction Ticket & Admission Rules</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-800">
                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-300 font-medium">Ticket Type / Tier</label>
                            <select
                              value={formData.ticketConfig?.ticketType || 'STANDARD'}
                              onChange={e => setFormData({
                                ...formData,
                                ticketConfig: {
                                  ...(formData.ticketConfig || {}),
                                  ticketType: e.target.value as any
                                }
                              })}
                              className="w-full p-2 bg-white rounded-lg font-medium text-xs"
                            >
                              <option value="STANDARD">Standard Admission Pass</option>
                              <option value="VIP_FAST_TRACK">VIP Fast Track / Express Pass</option>
                              <option value="TIMED_ENTRY">Timed Entry Slot</option>
                              <option value="MULTI_DAY_PASS">Multi-Day Explorer Pass</option>
                              <option value="FLEXIBLE">Flexible Date Open Ticket</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-300 font-medium">Redemption Method</label>
                            <select
                              value={formData.ticketConfig?.redemptionMethod || 'INSTANT_QR_VOUCHER'}
                              onChange={e => setFormData({
                                ...formData,
                                ticketConfig: {
                                  ...(formData.ticketConfig || {}),
                                  redemptionMethod: e.target.value as any
                                }
                              })}
                              className="w-full p-2 bg-white rounded-lg font-medium text-xs"
                            >
                              <option value="INSTANT_QR_VOUCHER">Instant QR Code / Mobile Barcode</option>
                              <option value="MOBILE_VOUCHER">Mobile Digital Voucher</option>
                              <option value="PRINTED_VOUCHER">Printed Paper Voucher Required</option>
                              <option value="WILL_CALL_COUNTER">Will Call Box Office Counter</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-300 font-medium">Booking Cutoff (Hours)</label>
                            <input
                              type="number"
                              min="0"
                              value={formData.ticketConfig?.bookingCutoffHours ?? 2}
                              onChange={e => setFormData({
                                ...formData,
                                ticketConfig: {
                                  ...(formData.ticketConfig || {}),
                                  bookingCutoffHours: Number(e.target.value)
                                }
                              })}
                              placeholder="e.g. 2 Hours prior"
                              className="w-full p-2 bg-white rounded-lg font-semibold text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* GUIDES ATTRIBUTES */}
                    {formData.category === 'Guides' && (
                      <div className="bg-slate-800/80 p-3.5 rounded-xl border border-amber-500/30 space-y-3">
                        <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                          <Languages className="w-3.5 h-3.5" />
                          <span>Professional Guide Credentials & Languages</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-800">
                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-300 font-medium">Guide Qualification</label>
                            <select
                              value={formData.guideConfig?.guideType || 'LICENSED_NATIONAL_GUIDE'}
                              onChange={e => setFormData({
                                ...formData,
                                guideConfig: {
                                  ...(formData.guideConfig || {}),
                                  guideType: e.target.value as any
                                }
                              })}
                              className="w-full p-2 bg-white rounded-lg font-medium text-xs"
                            >
                              <option value="LICENSED_NATIONAL_GUIDE">National Government Licensed Guide</option>
                              <option value="LOCAL_EXPERT">Local Resident / Culture Specialist</option>
                              <option value="CHAUFFEUR_GUIDE">Bilingual Chauffeur-Guide</option>
                              <option value="SPECIALIST_ACADEMIC">Academic / Art Historian Expert</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-300 font-medium">Rate Service Format</label>
                            <select
                              value={formData.guideConfig?.rateType || 'FULL_DAY'}
                              onChange={e => setFormData({
                                ...formData,
                                guideConfig: {
                                  ...(formData.guideConfig || {}),
                                  rateType: e.target.value as any
                                }
                              })}
                              className="w-full p-2 bg-white rounded-lg font-medium text-xs"
                            >
                              <option value="FULL_DAY">Full-Day Service (8 Hours)</option>
                              <option value="HALF_DAY">Half-Day Service (4 Hours)</option>
                              <option value="HOURLY">Hourly Consultation</option>
                              <option value="NIGHT_TOUR">Night Gastronomy Tour (3.5 Hours)</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-300 font-medium">Max Group Size Per Guide</label>
                            <input
                              type="number"
                              min="1"
                              max="50"
                              value={formData.guideConfig?.maxGroupSize ?? 10}
                              onChange={e => setFormData({
                                ...formData,
                                guideConfig: {
                                  ...(formData.guideConfig || {}),
                                  maxGroupSize: Number(e.target.value)
                                }
                              })}
                              className="w-full p-2 bg-white rounded-lg font-bold text-xs"
                            />
                          </div>
                        </div>

                        {/* Languages list */}
                        <div className="space-y-1 pt-1">
                          <label className="text-[11px] text-slate-300 font-medium">Supported Languages</label>
                          <div className="flex flex-wrap gap-1.5">
                            {['English', 'Japanese', 'Spanish', 'French', 'German', 'Mandarin Chinese', 'Italian', 'Russian', 'Arabic', 'Hindi', 'Portuguese'].map(lang => {
                              const activeLangs = formData.guideConfig?.languages || ['English', 'Japanese'];
                              const isSelected = activeLangs.includes(lang);
                              return (
                                <button
                                  key={lang}
                                  type="button"
                                  onClick={() => {
                                    const nextLangs = isSelected
                                      ? activeLangs.filter(l => l !== lang)
                                      : [...activeLangs, lang];
                                    setFormData({
                                      ...formData,
                                      guideConfig: {
                                        ...(formData.guideConfig || {}),
                                        languages: nextLangs
                                      }
                                    });
                                  }}
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                                    isSelected
                                      ? 'bg-amber-400 text-slate-950 shadow-xs'
                                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                  }`}
                                >
                                  {isSelected ? '✓ ' : '+ '}{lang}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* RESTAURANT ATTRIBUTES */}
                    {formData.category === 'Lunch / Dinner Restaurant' && (
                      <div className="bg-slate-800/80 p-3.5 rounded-xl border border-rose-500/30 space-y-3">
                        <div className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                          <Utensils className="w-3.5 h-3.5" />
                          <span>Dining & Culinary Experience Specifications</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-800">
                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-300 font-medium">Meal / Course Format</label>
                            <select
                              value={formData.restaurantConfig?.mealType || 'KAISEKI_DINNER'}
                              onChange={e => setFormData({
                                ...formData,
                                restaurantConfig: {
                                  ...(formData.restaurantConfig || {}),
                                  mealType: e.target.value as any
                                }
                              })}
                              className="w-full p-2 bg-white rounded-lg font-medium text-xs"
                            >
                              <option value="KAISEKI_DINNER">Multi-Course Kaiseki Dinner</option>
                              <option value="OMAKASE">Chef's Omakase Sushi</option>
                              <option value="SET_LUNCH">Traditional Japanese Set Lunch</option>
                              <option value="MULTI_COURSE">Western Fine Dining Course</option>
                              <option value="BUFFET">Luxury Gourmet Buffet</option>
                              <option value="AFTERNOON_TEA">Traditional Tea Ceremony & Sweets</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-300 font-medium">Seating Environment</label>
                            <select
                              value={formData.restaurantConfig?.seatingType || 'PRIVATE_ROOM_TATAMI'}
                              onChange={e => setFormData({
                                ...formData,
                                restaurantConfig: {
                                  ...(formData.restaurantConfig || {}),
                                  seatingType: e.target.value as any
                                }
                              })}
                              className="w-full p-2 bg-white rounded-lg font-medium text-xs"
                            >
                              <option value="PRIVATE_ROOM_TATAMI">Private Room (Traditional Tatami)</option>
                              <option value="PRIVATE_ROOM_TABLE">Private Room (Modern Table & Chairs)</option>
                              <option value="CHEF_COUNTER">Chef's Counter Seating</option>
                              <option value="MAIN_DINING">Main Dining Hall</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-300 font-medium">Beverage Package</label>
                            <select
                              value={formData.restaurantConfig?.beveragePackage || 'STANDARD_TEA_WATER'}
                              onChange={e => setFormData({
                                ...formData,
                                restaurantConfig: {
                                  ...(formData.restaurantConfig || {}),
                                  beveragePackage: e.target.value as any
                                }
                              })}
                              className="w-full p-2 bg-white rounded-lg font-medium text-xs"
                            >
                              <option value="STANDARD_TEA_WATER">Standard Green Tea & Mineral Water</option>
                              <option value="NOMIHOUDAI_ALL_YOU_CAN_DRINK">All-You-Can-Drink (Nomihoudai 2h)</option>
                              <option value="SAKE_PAIRING">Sommelier Curated Sake Pairing (5 Glasses)</option>
                              <option value="SOMMELIER_WINE_PAIRING">Premium Wine Pairing</option>
                              <option value="NON_ALCOHOLIC_PAIRING">Artisanal Non-Alcoholic Pairing</option>
                            </select>
                          </div>
                        </div>

                        {/* Dietary Accommodations */}
                        <div className="space-y-1 pt-1">
                          <label className="text-[11px] text-slate-300 font-medium">Dietary Accommodations Supported</label>
                          <div className="flex flex-wrap gap-1.5">
                            {['Vegetarian', 'Halal-friendly (No Pork/Alcohol)', 'Gluten-Free', 'No Seafood', 'Vegan', 'Nut Allergy Safe', 'Egg Allergy Safe', 'Dairy Free'].map(diet => {
                              const activeDiets = formData.restaurantConfig?.dietaryAccommodations || ['Vegetarian', 'Halal-friendly (No Pork/Alcohol)'];
                              const isSelected = activeDiets.includes(diet);
                              return (
                                <button
                                  key={diet}
                                  type="button"
                                  onClick={() => {
                                    const nextDiets = isSelected
                                      ? activeDiets.filter(d => d !== diet)
                                      : [...activeDiets, diet];
                                    setFormData({
                                      ...formData,
                                      restaurantConfig: {
                                        ...(formData.restaurantConfig || {}),
                                        dietaryAccommodations: nextDiets
                                      }
                                    });
                                  }}
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                                    isSelected
                                      ? 'bg-rose-400 text-slate-950 shadow-xs'
                                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                  }`}
                                >
                                  {isSelected ? '✓ ' : '+ '}{diet}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* FERRIES ATTRIBUTES */}
                    {formData.category === 'Ferries' && (
                      <div className="bg-slate-800/80 p-3.5 rounded-xl border border-cyan-500/30 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                          <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                            <Anchor className="w-3.5 h-3.5" />
                            <span>Authoritative Ferry Master & Marine Logistics</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setOperationalAssetsManagerTab('FERRIES');
                              setIsOperationalAssetsManagerOpen(true);
                            }}
                            className="text-[11px] text-cyan-300 hover:text-white underline font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <span>Manage Ferry Master Database</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Searchable Ferry Vessel Selector */}
                        <div className="space-y-1">
                          <label className="text-xs text-slate-300 font-semibold block">Select Ferry / Vessel from Master Database *</label>
                          <OperationalAssetSelector
                            assetType="FERRY"
                            selectedId={formData.ferryId || formData.ferryConfig?.vesselId}
                            selectedName={formData.ferryNameSnapshot || formData.ferryConfig?.ferryLine}
                            selectedType={formData.ferryTypeSnapshot || formData.ferryConfig?.vesselClass}
                            selectedCapacity={formData.ferryCapacitySnapshot || formData.ferryConfig?.capacity}
                            destinationId={formData.destinationId}
                            hubId={formData.hubId}
                            onSelect={(asset: SelectedAssetPayload) => {
                              setFormData(prev => ({
                                ...prev,
                                ferryId: asset.id,
                                ferryNameSnapshot: asset.name,
                                ferryTypeSnapshot: asset.type,
                                ferryCapacitySnapshot: asset.capacity,
                                ferryConfig: {
                                  ...(prev.ferryConfig || {}),
                                  vesselId: asset.id,
                                  ferryLine: asset.name,
                                  vesselClass: asset.classification || asset.type,
                                  capacity: asset.capacity,
                                  departurePort: asset.origin || prev.ferryConfig?.departurePort || '',
                                  arrivalPort: asset.destination || prev.ferryConfig?.arrivalPort || '',
                                  operator: asset.operator || ''
                                }
                              }));
                            }}
                            onClear={() => {
                              setFormData(prev => ({
                                ...prev,
                                ferryId: undefined,
                                ferryNameSnapshot: undefined,
                                ferryTypeSnapshot: undefined,
                                ferryCapacitySnapshot: undefined,
                                ferryConfig: undefined
                              }));
                            }}
                            onOpenMasterManager={() => {
                              setOperationalAssetsManagerTab('FERRIES');
                              setIsOperationalAssetsManagerOpen(true);
                            }}
                          />
                        </div>

                        {/* Specs Grid from Snapshot */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-700/80 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-400 block uppercase font-semibold">Vessel Line</span>
                            <span className="text-white font-bold truncate block">
                              {formData.ferryNameSnapshot || formData.ferryConfig?.ferryLine || '—'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block uppercase font-semibold">Vessel Class</span>
                            <span className="text-slate-200 font-semibold block">
                              {formData.ferryTypeSnapshot || formData.ferryConfig?.vesselClass || '—'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block uppercase font-semibold">Capacity</span>
                            <span className="text-cyan-300 font-bold block">
                              {formData.ferryCapacitySnapshot || formData.ferryConfig?.capacity ? `${formData.ferryCapacitySnapshot || formData.ferryConfig?.capacity} Pax` : '—'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block uppercase font-semibold">Departure / Arrival</span>
                            <span className="text-slate-300 font-medium block truncate">
                              {formData.ferryConfig?.departurePort && formData.ferryConfig?.arrivalPort ? `${formData.ferryConfig.departurePort} ➔ ${formData.ferryConfig.arrivalPort}` : '—'}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-800 pt-1">
                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-300 font-medium">Departure Port / Pier</label>
                            <input
                              type="text"
                              value={formData.ferryConfig?.departurePort || ''}
                              onChange={e => setFormData({
                                ...formData,
                                ferryConfig: {
                                  ...(formData.ferryConfig || {}),
                                  departurePort: e.target.value
                                }
                              })}
                              placeholder="e.g. Miyajimaguchi Pier"
                              className="w-full p-2 bg-white rounded-lg font-medium text-xs text-slate-900"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-300 font-medium">Arrival Port / Pier</label>
                            <input
                              type="text"
                              value={formData.ferryConfig?.arrivalPort || ''}
                              onChange={e => setFormData({
                                ...formData,
                                ferryConfig: {
                                  ...(formData.ferryConfig || {}),
                                  arrivalPort: e.target.value
                                }
                              })}
                              placeholder="e.g. Miyajima Island Terminal"
                              className="w-full p-2 bg-white rounded-lg font-medium text-xs text-slate-900"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Commercial Pricing Inputs (Single B2B Agent Price Model) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-800 pt-2 border-t border-slate-800">
                  <div className="space-y-1">
                    <label className="text-[11px] text-[#00E5C0] font-medium">B2B Margin %</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.b2bAgentMarkupPercent !== undefined ? formData.b2bAgentMarkupPercent : ''}
                      onChange={e => {
                        const val = e.target.value === '' ? undefined : Number(e.target.value);
                        setFormData({ ...formData, b2bAgentMarkupPercent: val, defaultMarkupPercent: val });
                      }}
                      className="w-full p-2 bg-white rounded-lg font-semibold text-slate-900"
                      placeholder="e.g. 50"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-300 font-medium">Tax % (on Margin Only)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.taxPercent !== undefined ? formData.taxPercent : ''}
                      onChange={e => {
                        const val = e.target.value === '' ? undefined : Number(e.target.value);
                        setFormData({ ...formData, taxPercent: val });
                      }}
                      className="w-full p-2 bg-white rounded-lg text-slate-900"
                      placeholder="e.g. 18"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-300 font-medium">Service Fee %</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.serviceFeeFixed !== undefined ? formData.serviceFeeFixed : ''}
                      onChange={e => {
                        const val = e.target.value === '' ? undefined : Number(e.target.value);
                        setFormData({ ...formData, serviceFeeFixed: val });
                      }}
                      className="w-full p-2 bg-white rounded-lg text-slate-900"
                      placeholder="e.g. 3"
                    />
                  </div>
                </div>

                {/* Commercial Pricing Live Preview & Authoritative Breakdown */}
                {(() => {
                  const effectiveNet = formData.pricingMethod === 'capacity_based' 
                    ? (formData.vehicleConfig?.unitVehicleNetCost !== undefined ? Number(formData.vehicleConfig.unitVehicleNetCost) : (formData.adultNetPrice !== undefined ? Number(formData.adultNetPrice) : undefined))
                    : (formData.adultNetPrice !== undefined ? Number(formData.adultNetPrice) : undefined);
                  
                  const hasValidNett = effectiveNet !== undefined && !isNaN(effectiveNet) && effectiveNet >= 0;
                  const marginPct = Number(formData.b2bAgentMarkupPercent) || Number(formData.defaultMarkupPercent) || 0;
                  const taxPct = Number(formData.taxPercent) || 0;
                  const feePct = Number(formData.serviceFeeFixed) || 0;
                  const curr = (formData.currency as CurrencyCode) || 'USD';

                  if (!hasValidNett) {
                    return (
                      <div className="pt-3 border-t border-slate-800 bg-slate-950/60 p-3 rounded-xl text-center text-amber-400 font-semibold text-xs italic">
                        Price unavailable (Enter Nett Cost to calculate Price)
                      </div>
                    );
                  }

                  const b2bRes = calculateB2BAgentPrice({
                    nettCost: effectiveNet,
                    marginPercent: marginPct,
                    taxPercent: taxPct,
                    serviceFeePercent: feePct,
                    currency: curr
                  });

                  return (
                    <div className="pt-3 border-t border-slate-800 bg-slate-950/80 p-3.5 rounded-xl space-y-2 text-xs">
                      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                        <span className="text-slate-400 text-[11px] uppercase tracking-wider font-semibold">Authoritative Price Breakdown:</span>
                        <div className="text-right">
                          <span className="text-slate-400 text-[10px] mr-2">Calculated Commercial Price:</span>
                          <span className="text-base font-bold font-mono text-[#00E5C0]">
                            {formatCurrency(b2bRes.price, curr)}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px] font-mono text-slate-300">
                        <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                          <span className="text-slate-500 block text-[9px] uppercase font-sans">Nett Cost</span>
                          <span className="font-semibold">{formatCurrency(b2bRes.nettCost, curr)}</span>
                        </div>
                        <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                          <span className="text-slate-500 block text-[9px] uppercase font-sans">B2B Margin ({b2bRes.marginPercent}%)</span>
                          <span className="text-emerald-400 font-semibold">+{formatCurrency(b2bRes.marginAmount, curr)}</span>
                        </div>
                        <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                          <span className="text-slate-500 block text-[9px] uppercase font-sans">Tax ({b2bRes.taxPercent}%)</span>
                          <span className="text-cyan-400 font-semibold">+{formatCurrency(b2bRes.taxAmount, curr)}</span>
                        </div>
                        <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                          <span className="text-slate-500 block text-[9px] uppercase font-sans">Service Fee ({b2bRes.serviceFeePercent}%)</span>
                          <span className="text-indigo-400 font-semibold">+{formatCurrency(b2bRes.serviceFeeAmount, curr)}</span>
                        </div>
                        <div className="bg-[#00C6A6]/10 p-2 rounded-lg border border-[#00C6A6]/30 col-span-2 sm:col-span-1">
                          <span className="text-[#00C6A6] block text-[9px] uppercase font-sans font-bold">Price</span>
                          <span className="text-[#00E5C0] font-bold text-xs">{formatCurrency(b2bRes.price, curr)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
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
              </div>

              {/* Actions Footer */}
              <div className="flex flex-col sm:flex-row items-center justify-between p-4 sm:px-6 py-3 border-t border-slate-100 bg-white/95 backdrop-blur-xs shrink-0 gap-3">
                <div className="w-full sm:w-auto">
                  {editingProduct && (
                    <button
                      type="button"
                      onClick={() => handleDelete(editingProduct.id)}
                      className="w-full sm:w-auto px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl flex items-center justify-center space-x-1.5 transition-colors cursor-pointer border border-rose-200"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Product</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="w-full sm:w-auto px-5 py-2.5 text-slate-600 hover:text-slate-800 font-semibold cursor-pointer border border-slate-200 rounded-xl hover:bg-slate-50 text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-full sm:w-auto px-6 py-2.5 bg-[#00C6A6] hover:bg-[#008972] text-slate-950 font-bold rounded-xl shadow-md cursor-pointer transition-colors text-center"
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

      {/* Shared Japan Rail Dynamic Journey Configurator Modal */}
      {testingRailProduct && (
        <JapanRailJourneyConfigurator
          portalOrigin="PRODUCT_MANAGEMENT"
          initialProduct={testingRailProduct}
          onClose={() => setTestingRailProduct(null)}
        />
      )}

      {/* Shared Dedicated Configurator Router for CMS Admin */}
      {testingConfigProduct && (
        <GlobalConfiguratorRouter
          isOpen={true}
          itemOrProduct={testingConfigProduct}
          portalOrigin="ADMIN_CMS"
          onClose={() => setTestingConfigProduct(null)}
          onSuccess={(result) => {
            setTestingConfigProduct(null);
            refreshProducts();
            if (result?.configurationPayload) {
              setFormData(prev => ({
                ...prev,
                configuration: {
                  configuration_id: result.configurationPayload.configuration_id || `cfg-${prev.sku || testingConfigProduct.id}`,
                  product_id: prev.id || testingConfigProduct.id,
                  product_category: prev.category as any,
                  configurator_type: result.configurationPayload.configurator_type || CONFIGURATOR_REGISTRY_MAP[resolveAuthoritativeCategory(prev as any)]?.configuratorType,
                  configuration_version: 1,
                  configuration_schema_version: '1.0.0',
                  configuration_data: result.configurationPayload,
                  status: 'ACTIVE',
                  updated_at: new Date().toISOString()
                }
              }));
            }
          }}
        />
      )}

      {/* Admin Product & Configuration Inspector Modal (Section 11) */}
      {inspectingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-4xl w-full max-h-[92dvh] flex flex-col overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95">
            {/* Header */}
            <div className="bg-slate-900 text-white p-5 border-b border-slate-800 flex items-start justify-between shrink-0">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold bg-[#00C6A6] text-slate-950">
                    {inspectingProduct.sku}
                  </span>
                  <span className="text-xs text-slate-400">•</span>
                  <span className="text-xs font-semibold text-[#00E5C0]">
                    {inspectingProduct.category}
                  </span>
                  <span className="text-xs text-slate-400">•</span>
                  <span className="text-xs text-slate-300 font-medium">
                    {inspectingProduct.city}, {inspectingProduct.country}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-white truncate">
                  {inspectingProduct.name}
                </h3>
              </div>
              <button
                onClick={() => setInspectingProduct(null)}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-6 text-xs flex-1 modal-body-scroll">
              {/* SECTION 1: Product Information */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-[#008972]" />
                    <span>Product Commercial & Operational Information</span>
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    inspectingProduct.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {inspectingProduct.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Net Cost (Adult / Unit)</span>
                    <strong className="text-slate-900 font-mono text-sm">{formatCurrency(inspectingProduct.adultNetPrice, inspectingProduct.currency)}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Selling Starting From</span>
                    <strong className="text-[#008972] font-mono text-sm">{formatCurrency(inspectingProduct.sellingPriceStartingFrom, inspectingProduct.currency)}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Duration</span>
                    <span className="font-semibold text-slate-800">{inspectingProduct.duration}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Capacity / Pax</span>
                    <span className="font-semibold text-slate-800">{inspectingProduct.minPax} - {inspectingProduct.maxPax} Pax</span>
                  </div>
                </div>
              </div>

              {/* SECTION 2: Category Specific Attributes & Details */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center space-x-2">
                    <Sliders className="w-4 h-4 text-[#008972]" />
                    <span className="font-bold text-slate-900 text-xs">
                      Category Specifications ({inspectingProduct.category})
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-teal-100 text-teal-800">
                    {inspectingProduct.pricingMethod === 'capacity_based' ? 'Capacity-Based Engine' : 'Per-Person Engine'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  {inspectingProduct.vehicleConfig && (
                    <>
                      <div className="bg-white p-3 rounded-xl border border-slate-200">
                        <span className="text-slate-400 text-[10px] block uppercase font-semibold">Vehicle / Vessel Model</span>
                        <span className="font-bold text-slate-900 text-xs truncate block">
                          {inspectingProduct.vehicleConfig.vehicleModel || inspectingProduct.vehicleConfig.vehicleName || 'Standard Fleet'}
                        </span>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-slate-200">
                        <span className="text-slate-400 text-[10px] block uppercase font-semibold">Max Pax Capacity</span>
                        <span className="font-bold text-[#008972] text-xs truncate block">
                          {inspectingProduct.vehicleConfig.maxSeats || inspectingProduct.maxPax} Pax
                        </span>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-slate-200">
                        <span className="text-slate-400 text-[10px] block uppercase font-semibold">Unit Vehicle Nett</span>
                        <span className="font-mono text-slate-900 font-bold text-xs block">
                          {formatCurrency(inspectingProduct.vehicleConfig.unitVehicleNetCost || inspectingProduct.adultNetPrice, inspectingProduct.currency)}
                        </span>
                      </div>
                    </>
                  )}

                  {inspectingProduct.ticketConfig && (
                    <>
                      <div className="bg-white p-3 rounded-xl border border-slate-200">
                        <span className="text-slate-400 text-[10px] block uppercase font-semibold">Ticket Type</span>
                        <span className="font-bold text-slate-900 text-xs truncate block">
                          {inspectingProduct.ticketConfig.ticketType}
                        </span>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-slate-200">
                        <span className="text-slate-400 text-[10px] block uppercase font-semibold">Redemption</span>
                        <span className="font-bold text-blue-700 text-xs truncate block">
                          {inspectingProduct.ticketConfig.redemptionMethod}
                        </span>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-slate-200">
                        <span className="text-slate-400 text-[10px] block uppercase font-semibold">Cutoff</span>
                        <span className="font-bold text-slate-900 text-xs block">
                          {inspectingProduct.ticketConfig.bookingCutoffHours || 2} Hours
                        </span>
                      </div>
                    </>
                  )}

                  {inspectingProduct.guideConfig && (
                    <>
                      <div className="bg-white p-3 rounded-xl border border-slate-200">
                        <span className="text-slate-400 text-[10px] block uppercase font-semibold">Guide Qualification</span>
                        <span className="font-bold text-slate-900 text-xs truncate block">
                          {inspectingProduct.guideConfig.guideType}
                        </span>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-slate-200">
                        <span className="text-slate-400 text-[10px] block uppercase font-semibold">Languages</span>
                        <span className="font-bold text-amber-700 text-xs truncate block">
                          {(inspectingProduct.guideConfig.languages || ['English', 'Japanese']).join(', ')}
                        </span>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-slate-200">
                        <span className="text-slate-400 text-[10px] block uppercase font-semibold">Rate Format</span>
                        <span className="font-bold text-slate-900 text-xs block">
                          {inspectingProduct.guideConfig.rateType}
                        </span>
                      </div>
                    </>
                  )}

                  {inspectingProduct.restaurantConfig && (
                    <>
                      <div className="bg-white p-3 rounded-xl border border-slate-200">
                        <span className="text-slate-400 text-[10px] block uppercase font-semibold">Course Format</span>
                        <span className="font-bold text-slate-900 text-xs truncate block">
                          {inspectingProduct.restaurantConfig.mealType}
                        </span>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-slate-200">
                        <span className="text-slate-400 text-[10px] block uppercase font-semibold">Seating</span>
                        <span className="font-bold text-rose-700 text-xs truncate block">
                          {inspectingProduct.restaurantConfig.seatingType}
                        </span>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-slate-200">
                        <span className="text-slate-400 text-[10px] block uppercase font-semibold">Drink Package</span>
                        <span className="font-bold text-slate-900 text-xs block truncate">
                          {inspectingProduct.restaurantConfig.beveragePackage}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* Inclusions & Exclusions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
                    <span className="text-emerald-800 font-bold text-[11px] block mb-1">Inclusions:</span>
                    <ul className="text-[11px] text-slate-700 space-y-0.5 list-disc pl-4">
                      {(inspectingProduct.inclusions || []).map((inc, i) => (
                        <li key={i}>{inc}</li>
                      ))}
                      {(!inspectingProduct.inclusions || inspectingProduct.inclusions.length === 0) && (
                        <li className="text-slate-400 italic list-none pl-0">No specific inclusions defined.</li>
                      )}
                    </ul>
                  </div>

                  <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-100">
                    <span className="text-rose-800 font-bold text-[11px] block mb-1">Exclusions:</span>
                    <ul className="text-[11px] text-slate-700 space-y-0.5 list-disc pl-4">
                      {(inspectingProduct.exclusions || []).map((exc, i) => (
                        <li key={i}>{exc}</li>
                      ))}
                      {(!inspectingProduct.exclusions || inspectingProduct.exclusions.length === 0) && (
                        <li className="text-slate-400 italic list-none pl-0">Standard personal expenses excluded.</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center space-x-2">
                {onViewProduct && (
                  <button
                    onClick={() => {
                      const prod = inspectingProduct;
                      setInspectingProduct(null);
                      onViewProduct(prod);
                    }}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Customer Modal</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    const prod = inspectingProduct;
                    setInspectingProduct(null);
                    handleOpenEdit(prod);
                  }}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Specs</span>
                </button>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setInspectingProduct(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-bold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Operational Assets Master Database Modal */}
      {isOperationalAssetsManagerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <OperationalAssetsManager
              destinations={destinations}
              cityHubs={cityHubs}
              suppliers={suppliers}
              initialTab={operationalAssetsManagerTab}
              onClose={() => setIsOperationalAssetsManagerOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
