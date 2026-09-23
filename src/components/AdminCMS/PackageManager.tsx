import React, { useState, useMemo, useEffect } from 'react';
import { 
  B2BPackage, 
  Destination, 
  Product, 
  Hotel, 
  CityHub, 
  PackageStatus, 
  PackagePricingMode,
  PackageItineraryDay,
  PackageProductRef,
  PackageHotelRef,
  CurrencyCode,
  User
} from '../../types';
import { AppDatabase } from '../../services/db';
import { formatCurrency, calculateProductPrice } from '../../services/pricingEngine';
import { 
  Package, 
  Plus, 
  Search, 
  Filter, 
  SlidersHorizontal, 
  Edit3, 
  Trash2, 
  Copy, 
  Eye, 
  Globe, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ArrowUpDown, 
  MapPin, 
  Building2, 
  Calendar, 
  DollarSign, 
  Layers, 
  ChevronRight, 
  Sparkles, 
  FileText, 
  Check, 
  X, 
  ArrowUp, 
  ArrowDown, 
  Tag, 
  Share2, 
  ShieldCheck, 
  Hotel as HotelIcon, 
  Car, 
  Compass, 
  Utensils, 
  ExternalLink,
  Lock,
  Unlock,
  Maximize2,
  RefreshCw,
  Archive
} from 'lucide-react';
import { PackageDetailModal } from '../PackageDetailModal';
import { EntitySEOSettingsTab } from './EntitySEOSettingsTab';
import { EntitySEO } from '../../types/seo';
import { useAuth } from '../../context/AuthContext';
import { DeleteConfirmModal } from './DeleteConfirmModal';

interface PackageManagerProps {
  destinations: Destination[];
  products?: Product[];
  onViewProduct?: (product: Product) => void;
  onCustomizePackage?: (pkg: B2BPackage) => void;
  onOpenQuotationBuilder?: () => void;
}

export const PackageManager: React.FC<PackageManagerProps> = ({
  destinations,
  products: propProducts = [],
  onViewProduct,
  onCustomizePackage,
  onOpenQuotationBuilder
}) => {
  const db = AppDatabase.getInstance();
  const { user } = useAuth();
  const [packages, setPackages] = useState<B2BPackage[]>(() => db.getPackages());
  const [products] = useState<Product[]>(() => propProducts.length > 0 ? propProducts : db.getProducts());
  const [hotels] = useState<Hotel[]>(() => db.getHotels());
  const [cityHubs] = useState<CityHub[]>(() => db.getCityHubs());

  // Filters & State
  const [searchQuery, setSearchQuery] = useState('');
  const [destinationFilter, setDestinationFilter] = useState('ALL');
  const [hubFilter, setHubFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [tripTypeFilter, setTripTypeFilter] = useState('ALL');
  const [pricingModeFilter, setPricingModeFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState<'CARDS' | 'TABLE'>('CARDS');
  const [sortBy, setSortBy] = useState<'NEWEST' | 'PRICE_ASC' | 'PRICE_DESC' | 'DURATION' | 'TITLE'>('NEWEST');

  // Active Editor / Preview State
  const [editingPackage, setEditingPackage] = useState<B2BPackage | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [previewPackage, setPreviewPackage] = useState<B2BPackage | null>(null);
  const [editorActiveTab, setEditorActiveTab] = useState<'GENERAL' | 'ITINERARY' | 'PRICING' | 'ADDONS' | 'SEO_PUBLISH'>('GENERAL');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Reload packages from db
  const refreshPackages = () => {
    setPackages(db.getPackages());
  };

  useEffect(() => {
    const unsub = db.subscribe(() => {
      refreshPackages();
    });
    return () => unsub();
  }, [db]);

  const showNotification = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  // Filtered and Sorted Packages
  const filteredPackages = useMemo(() => {
    return packages.filter(pkg => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        pkg.title.toLowerCase().includes(q) ||
        pkg.tagline.toLowerCase().includes(q) ||
        pkg.destinationName.toLowerCase().includes(q) ||
        (pkg.routeSummary || []).some(r => r.toLowerCase().includes(q)) ||
        (pkg.tags || []).some(t => t.toLowerCase().includes(q));

      const matchesDest = destinationFilter === 'ALL' || 
        pkg.destinationId === destinationFilter || 
        pkg.destinationName.toLowerCase() === destinationFilter.toLowerCase();

      const matchesHub = hubFilter === 'ALL' || 
        (pkg.hubIds && pkg.hubIds.includes(hubFilter)) ||
        (pkg.routeSummary && pkg.routeSummary.some(r => r.toLowerCase().includes(hubFilter.toLowerCase())));

      const matchesStatus = statusFilter === 'ALL' || 
        (statusFilter === 'PUBLISHED' && (pkg.status === 'PUBLISHED' || (pkg.isPublished && !pkg.status))) ||
        (statusFilter === 'DRAFT' && (pkg.status === 'DRAFT' || (!pkg.isPublished && (!pkg.status || pkg.status === 'DRAFT')))) ||
        (statusFilter === 'REVIEW' && pkg.status === 'REVIEW') ||
        (statusFilter === 'ARCHIVED' && pkg.status === 'ARCHIVED') ||
        (statusFilter === 'UNPUBLISHED' && (pkg.status === 'UNPUBLISHED' || (!pkg.isPublished && pkg.status !== 'DRAFT')));

      const matchesType = tripTypeFilter === 'ALL' || pkg.tripType === tripTypeFilter;

      const pricingMode = pkg.pricingConfiguration?.pricingMode || 'LIVE';
      const matchesPricing = pricingModeFilter === 'ALL' || pricingMode === pricingModeFilter;

      return matchesSearch && matchesDest && matchesHub && matchesStatus && matchesType && matchesPricing;
    }).sort((a, b) => {
      if (sortBy === 'NEWEST') {
        return new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime();
      }
      if (sortBy === 'PRICE_ASC') {
        return (a.suggestedSellingPriceUSD || a.baseNetCostUSD || 0) - (b.suggestedSellingPriceUSD || b.baseNetCostUSD || 0);
      }
      if (sortBy === 'PRICE_DESC') {
        return (b.suggestedSellingPriceUSD || b.baseNetCostUSD || 0) - (a.suggestedSellingPriceUSD || a.baseNetCostUSD || 0);
      }
      if (sortBy === 'DURATION') {
        return (b.durationDays || 0) - (a.durationDays || 0);
      }
      if (sortBy === 'TITLE') {
        return a.title.localeCompare(b.title);
      }
      return 0;
    });
  }, [packages, searchQuery, destinationFilter, hubFilter, statusFilter, tripTypeFilter, pricingModeFilter, sortBy]);

  // Statistics
  const stats = useMemo(() => {
    const total = packages.length;
    const published = packages.filter(p => p.status === 'PUBLISHED' || p.isPublished).length;
    const drafts = packages.filter(p => p.status === 'DRAFT' || (!p.isPublished && p.status !== 'ARCHIVED')).length;
    const archived = packages.filter(p => p.status === 'ARCHIVED').length;
    const totalNights = packages.reduce((acc, p) => acc + (p.durationNights || 0), 0);
    return { total, published, drafts, archived, avgNights: total ? Math.round(totalNights / total) : 0 };
  }, [packages]);

  // Handler: Create New Blank Package
  const handleCreateNew = () => {
    const defaultDest = destinations[0] || { id: 'dest-japan', name: 'Japan', slug: 'japan' };
    const destHubs = cityHubs.filter(h => h.destinationId === defaultDest.id);
    const initialHub = destHubs[0];

    const newPkg: B2BPackage = {
      id: `pkg-${Date.now()}`,
      title: 'New Luxury Itinerary Circuit',
      slug: `new-circuit-${Date.now().toString().slice(-4)}`,
      destinationId: defaultDest.id,
      destinationName: defaultDest.name,
      regionId: defaultDest.region,
      regionName: defaultDest.region,
      hubIds: initialHub ? [initialHub.id] : [],
      hubNames: initialHub ? [initialHub.name] : [],
      durationDays: 7,
      durationNights: 6,
      heroImage: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200&auto=format&fit=crop',
      galleryImages: [],
      tagline: 'Multi-City Signature Circuit with 5★ Stays & Private VIP Chauffeur',
      description: 'Comprehensive wholesale circuit itinerary designed for discerning private travelers with premium accommodation, skip-the-line entrance passes, and dedicated ground support.',
      detailedDescription: '',
      routeSummary: initialHub ? [`${initialHub.name} (6 Nights)`] : ['Tokyo (6 Nights)'],
      hotelsSummary: [],
      productIds: [],
      productReferences: [],
      hotelReferences: [],
      itinerary: Array.from({ length: 7 }, (_, i) => ({
        dayNumber: i + 1,
        title: i === 0 ? 'Arrival & Private Chauffeur Transfer' : i === 6 ? 'Departure Chauffeur & Farewell' : `Day ${i + 1} Sightseeing & Discovery`,
        hubId: initialHub?.id,
        hubName: initialHub?.name,
        description: `Scheduled private excursions, cultural immersion, and leisure time in ${initialHub?.name || 'the destination'}.`,
        productIds: [],
        mealsIncluded: { breakfast: true, lunch: false, dinner: false },
        guideIncluded: true,
        freeTime: false
      })),
      pricingConfiguration: {
        pricingMode: 'LIVE',
        baseNetCostUSD: 2800,
        suggestedSellingPriceUSD: 3750,
        buyerMarkupPercent: 25,
        b2bMarkupPercent: 12,
        currency: 'USD'
      },
      customizationRules: {
        allowHotelCustomization: true,
        allowActivityCustomization: true,
        allowTransferCustomization: true,
        allowDurationCustomization: true,
        allowMealCustomization: true
      },
      visibility: {
        destinationPage: true,
        hubPage: true,
        homepage: true,
        promotions: true,
        search: true,
        featured: false
      },
      seo: {
        metaTitle: 'Luxury Tour Package | TheUnbound DMC',
        metaDescription: 'Book exclusive ready-made tour packages with contracted wholesale rates and 24/7 ground duty management.',
        keywords: ['luxury travel', 'wholesale itinerary', 'dmc packages']
      },
      highlights: [
        'Dedicated 24/7 bilingual ground operations dispatch across all prefectures',
        'Private Mercedes-Benz chauffeur transfers throughout itinerary',
        'Accredited private licensed docents for all landmark touring'
      ],
      inclusions: [
        '6 nights 5★ luxury accommodation with daily breakfast',
        'Private airport VIP meet & greet and chauffeur transfers',
        'All listed private guided sightseeing tours with entrance fees included',
        'High-speed express rail passes with reserved seating'
      ],
      exclusions: [
        'International flights and airline taxes',
        'Travel and medical insurance',
        'Personal incidental expenditures and gratuities'
      ],
      termsAndConditions: 'Package prices are based on double occupancy. Subject to availability at time of confirmation.',
      cancellationPolicy: 'Full refund up to 30 days prior to arrival. 50% cancellation fee between 15-29 days.',
      importantInformation: 'Passport must be valid for at least 6 months beyond the intended date of departure.',
      baseNetCostUSD: 2800,
      suggestedSellingPriceUSD: 3750,
      currency: 'USD',
      tripType: 'LUXURY',
      tags: ['Best Seller', 'Contracted 5★', 'Private Chauffeur', 'High Margin'],
      status: 'DRAFT',
      isPublished: false,
      isFeatured: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setEditingPackage(newPkg);
    setEditorActiveTab('GENERAL');
    setIsEditorOpen(true);
  };

  // Handler: Edit Existing Package
  const handleEdit = (pkg: B2BPackage) => {
    // Ensure all nested arrays exist to prevent undefined errors in form
    const safePkg: B2BPackage = {
      ...pkg,
      highlights: pkg.highlights || [],
      inclusions: pkg.inclusions || [],
      exclusions: pkg.exclusions || [],
      tags: pkg.tags || [],
      routeSummary: pkg.routeSummary || [],
      hotelsSummary: pkg.hotelsSummary || [],
      productIds: pkg.productIds || [],
      itinerary: pkg.itinerary || Array.from({ length: pkg.durationDays || 5 }, (_, i) => ({
        dayNumber: i + 1,
        title: `Day ${i + 1}`,
        description: '',
        productIds: [],
        mealsIncluded: { breakfast: true, lunch: false, dinner: false }
      })),
      pricingConfiguration: pkg.pricingConfiguration || {
        pricingMode: 'LIVE',
        baseNetCostUSD: pkg.baseNetCostUSD || 2500,
        suggestedSellingPriceUSD: pkg.suggestedSellingPriceUSD || 3500,
        buyerMarkupPercent: 25,
        b2bMarkupPercent: 12,
        currency: pkg.currency || 'USD'
      },
      visibility: pkg.visibility || {
        destinationPage: true,
        hubPage: true,
        homepage: true,
        promotions: true,
        search: true,
        featured: !!pkg.isFeatured
      },
      status: pkg.status || (pkg.isPublished ? 'PUBLISHED' : 'DRAFT')
    };

    setEditingPackage(safePkg);
    setEditorActiveTab('GENERAL');
    setIsEditorOpen(true);
  };

  // Handler: Duplicate Package
  const handleDuplicate = (pkg: B2BPackage) => {
    const duplicated = db.duplicatePackage(pkg.id);
    if (duplicated) {
      refreshPackages();
      showNotification(`Duplicated "${pkg.title}" as draft copy.`, 'success');
    }
  };

  // Handler: Toggle Publish Status
  const handleTogglePublish = (pkg: B2BPackage) => {
    const nextPublished = !pkg.isPublished;
    
    // Validate before publishing
    if (nextPublished) {
      if (!pkg.destinationId) {
        showNotification('Cannot publish: Destination is missing.', 'error');
        return;
      }
      if (!pkg.durationDays || pkg.durationDays < 1) {
        showNotification('Cannot publish: Duration must be at least 1 day.', 'error');
        return;
      }
    }

    db.togglePackagePublishStatus(pkg.id, nextPublished);
    refreshPackages();
    showNotification(
      nextPublished ? `Published "${pkg.title}" to public website.` : `Unpublished "${pkg.title}".`,
      'info'
    );
  };

  // Handler: Archive
  const handleArchive = (pkg: B2BPackage) => {
    db.archivePackage(pkg.id);
    refreshPackages();
    showNotification(`Archived "${pkg.title}".`, 'info');
  };

  // Handler: Delete Package
  const handleDelete = (id: string) => {
    db.deletePackage(id);
    refreshPackages();
    setDeleteConfirmId(null);
    showNotification('Package deleted successfully.', 'info');
  };

  // Handler: Save Package from Editor Modal
  const handleSaveEditor = () => {
    if (!editingPackage) return;

    if (!editingPackage.title.trim()) {
      showNotification('Package title is required.', 'error');
      return;
    }

    // Auto-compute slug if empty
    const slug = editingPackage.slug?.trim() || editingPackage.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    
    // Auto-update durationNights
    const durationDays = Math.max(1, editingPackage.durationDays || 1);
    const durationNights = Math.max(0, durationDays - 1);

    const isPublished = editingPackage.status === 'PUBLISHED';

    const finalPkg: B2BPackage = {
      ...editingPackage,
      slug,
      durationDays,
      durationNights,
      isPublished,
      updatedAt: new Date().toISOString()
    };

    db.savePackage(finalPkg);
    refreshPackages();
    setIsEditorOpen(false);
    setEditingPackage(null);
    showNotification(`Package "${finalPkg.title}" saved successfully!`, 'success');
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {feedbackMsg && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center space-x-3 text-xs font-bold transition-all animate-in fade-in slide-in-from-bottom-4 ${
          feedbackMsg.type === 'success' 
            ? 'bg-emerald-950 text-emerald-200 border-emerald-800'
            : feedbackMsg.type === 'error'
            ? 'bg-rose-950 text-rose-200 border-rose-800'
            : 'bg-slate-900 text-slate-100 border-slate-700'
        }`}>
          <Sparkles className="w-4 h-4 text-[#00C6A6]" />
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Header & Stats Strip */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-[#008972] border border-[#00C6A6]/30 text-[10px] font-extrabold uppercase tracking-wider">
                Multi-City Tour Circuits
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {stats.published} Published • {stats.drafts} Drafts • {stats.archived} Archived
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1 flex items-center space-x-2">
              <span>Ready-Made Package Management</span>
            </h1>
            <p className="text-xs text-slate-500 max-w-2xl mt-1">
              Curate, price, and publish structured multi-city wholesale itineraries built directly from your master Products & Hotel inventory. Supports live rate calculation and instant B2B agent customization.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {onOpenQuotationBuilder && (
              <button
                onClick={onOpenQuotationBuilder}
                className="inline-flex items-center space-x-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer"
                title="Build a live bespoke quotation and convert it directly into a ready-made package"
              >
                <Layers className="w-4 h-4 text-[#008972]" />
                <span>Build via Quotation Engine</span>
              </button>
            )}

            <button
              onClick={handleCreateNew}
              className="inline-flex items-center space-x-2 bg-[#008972] hover:bg-[#007460] text-white px-5 py-2.5 rounded-2xl text-xs font-black shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Package</span>
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Circuit Inventory</span>
            <div className="flex items-baseline space-x-1.5 mt-0.5">
              <span className="text-xl font-black text-slate-900">{stats.total}</span>
              <span className="text-xs font-semibold text-slate-500">Packages</span>
            </div>
          </div>
          <div className="bg-emerald-50/50 rounded-2xl p-3.5 border border-emerald-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">Active on Website</span>
            <div className="flex items-baseline space-x-1.5 mt-0.5">
              <span className="text-xl font-black text-emerald-700">{stats.published}</span>
              <span className="text-xs font-semibold text-emerald-600">Published</span>
            </div>
          </div>
          <div className="bg-amber-50/50 rounded-2xl p-3.5 border border-amber-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">Drafts / In Review</span>
            <div className="flex items-baseline space-x-1.5 mt-0.5">
              <span className="text-xl font-black text-amber-700">{stats.drafts}</span>
              <span className="text-xs font-semibold text-amber-600">Unpublished</span>
            </div>
          </div>
          <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Average Length</span>
            <div className="flex items-baseline space-x-1.5 mt-0.5">
              <span className="text-xl font-black text-slate-900">{stats.avgNights}N / {stats.avgNights + 1}D</span>
              <span className="text-xs font-semibold text-slate-500">Circuit</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search package name, city route, destinations, tags (e.g. Japan Golden Route, Kyoto, 5★ Ryokan)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-[#008972]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Destination Filter */}
          <select
            value={destinationFilter}
            onChange={(e) => {
              setDestinationFilter(e.target.value);
              setHubFilter('ALL');
            }}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none cursor-pointer"
          >
            <option value="ALL">All Destinations</option>
            {destinations.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          {/* Hub Filter (contextual) */}
          <select
            value={hubFilter}
            onChange={(e) => setHubFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none cursor-pointer"
          >
            <option value="ALL">All City Hubs</option>
            {cityHubs
              .filter(h => destinationFilter === 'ALL' || h.destinationId === destinationFilter)
              .map(h => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))
            }
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="PUBLISHED">Published Only</option>
            <option value="DRAFT">Drafts Only</option>
            <option value="REVIEW">In Review</option>
            <option value="ARCHIVED">Archived</option>
          </select>

          {/* Trip Type Filter */}
          <select
            value={tripTypeFilter}
            onChange={(e) => setTripTypeFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none cursor-pointer"
          >
            <option value="ALL">All Travel Styles</option>
            <option value="LUXURY">Luxury 5★</option>
            <option value="CULTURAL">Cultural Heritage</option>
            <option value="HONEYMOON">Honeymoon & Romantic</option>
            <option value="ADVENTURE">Adventure & Nature</option>
            <option value="FAMILY">Family Friendly</option>
            <option value="CLASSIC">Classic Highlights</option>
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none cursor-pointer"
          >
            <option value="NEWEST">Sort: Newest First</option>
            <option value="PRICE_ASC">Sort: Price Low → High</option>
            <option value="PRICE_DESC">Sort: Price High → Low</option>
            <option value="DURATION">Sort: Duration (Longest)</option>
            <option value="TITLE">Sort: Name (A-Z)</option>
          </select>

          {/* View Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('CARDS')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${viewMode === 'CARDS' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
              title="Card Grid View"
            >
              <Layers className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('TABLE')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${viewMode === 'TABLE' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
              title="Table Dense View"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {filteredPackages.length === 0 && (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 space-y-4">
          <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
            <Package className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900">No Packages Match Filter</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Try adjusting your search query, destination, or status filter to view available circuits.
            </p>
          </div>
          <button
            onClick={() => {
              setSearchQuery('');
              setDestinationFilter('ALL');
              setHubFilter('ALL');
              setStatusFilter('ALL');
              setTripTypeFilter('ALL');
            }}
            className="inline-flex items-center space-x-1.5 bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset All Filters</span>
          </button>
        </div>
      )}

      {/* Cards View */}
      {viewMode === 'CARDS' && filteredPackages.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPackages.map(pkg => {
            const isPub = pkg.status === 'PUBLISHED' || pkg.isPublished;
            const pricingMode = pkg.pricingConfiguration?.pricingMode || 'LIVE';
            const durationText = `${pkg.durationNights || (pkg.durationDays - 1)}N / ${pkg.durationDays}D`;

            return (
              <div 
                key={pkg.id} 
                className="bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
              >
                {/* Card Top: Hero Image & Badges */}
                <div>
                  <div className="relative h-44 w-full overflow-hidden bg-slate-100">
                    <img 
                      src={pkg.heroImage || 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=800'} 
                      alt={pkg.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/30" />

                    {/* Top Badges */}
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-extrabold uppercase tracking-wider flex items-center space-x-1">
                        <MapPin className="w-3 h-3 text-[#00C6A6]" />
                        <span>{pkg.destinationName}</span>
                      </span>

                      <div className="flex items-center space-x-1.5">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider flex items-center space-x-1 ${
                          isPub 
                            ? 'bg-emerald-500 text-white' 
                            : pkg.status === 'ARCHIVED'
                            ? 'bg-slate-700 text-slate-300'
                            : 'bg-amber-400 text-slate-950'
                        }`}>
                          {isPub ? <CheckCircle2 className="w-2.5 h-2.5" /> : <Clock className="w-2.5 h-2.5" />}
                          <span>{pkg.status || (isPub ? 'PUBLISHED' : 'DRAFT')}</span>
                        </span>
                      </div>
                    </div>

                    {/* Bottom overlay in image */}
                    <div className="absolute bottom-3 left-3 right-3 text-white">
                      <span className="inline-block px-2 py-0.5 rounded-md bg-white/20 backdrop-blur-md text-[10px] font-bold uppercase tracking-wider mb-1">
                        {pkg.tripType || 'LUXURY'} • {durationText}
                      </span>
                      <h3 className="text-base font-black leading-tight line-clamp-1 drop-shadow-sm">
                        {pkg.title}
                      </h3>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 space-y-3">
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {pkg.tagline || pkg.description}
                    </p>

                    {/* Route Flow Chips */}
                    {pkg.routeSummary && pkg.routeSummary.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Circuit Route:
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {pkg.routeSummary.map((route, i) => (
                            <span 
                              key={i}
                              className="px-2 py-0.5 bg-slate-100 rounded-lg text-[10px] font-semibold text-slate-700 flex items-center space-x-1"
                            >
                              <span>{route}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Commercial Pricing Summary */}
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Nett Wholesale Cost
                        </span>
                        <span className="text-xs font-black text-slate-700">
                          {formatCurrency(pkg.baseNetCostUSD || 0, pkg.currency || 'USD')} / pax
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] font-bold text-[#008972] uppercase tracking-wider block">
                          Final Selling Price
                        </span>
                        <span className="text-sm font-black text-slate-900">
                          {formatCurrency(pkg.finalSellingPriceUSD || pkg.suggestedSellingPriceUSD || (pkg.baseNetCostUSD * 1.3), pkg.currency || 'USD')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-1.5">
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => setPreviewPackage(pkg)}
                      className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
                      title="Preview Itinerary & Customer View"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDuplicate(pkg)}
                      className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
                      title="Duplicate as Draft"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleTogglePublish(pkg)}
                      className={`p-2 rounded-xl transition-all cursor-pointer ${
                        isPub 
                          ? 'text-emerald-700 hover:bg-emerald-100' 
                          : 'text-amber-700 hover:bg-amber-100'
                      }`}
                      title={isPub ? 'Unpublish from public catalog' : 'Publish live to public catalog'}
                    >
                      {isPub ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      onClick={() => setDeleteConfirmId(pkg.id)}
                      className="p-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                      title="Delete Package"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center space-x-2">
                    {onCustomizePackage && (
                      <button
                        onClick={() => onCustomizePackage(pkg)}
                        className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-[11px] font-bold transition-all cursor-pointer"
                        title="Open in Quotation Builder"
                      >
                        Customize
                      </button>
                    )}

                    <button
                      onClick={() => handleEdit(pkg)}
                      className="inline-flex items-center space-x-1 px-3.5 py-1.5 bg-slate-900 hover:bg-[#008972] text-white rounded-xl text-[11px] font-black transition-all cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Edit</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Table View */}
      {viewMode === 'TABLE' && filteredPackages.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-3 px-4">Circuit Name & Route</th>
                  <th className="py-3 px-4">Destination</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Travel Style</th>
                  <th className="py-3 px-4 text-right">Nett Cost</th>
                  <th className="py-3 px-4 text-right">Selling Price</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPackages.map(pkg => {
                  const isPub = pkg.status === 'PUBLISHED' || pkg.isPublished;
                  return (
                    <tr key={pkg.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-3">
                          <img 
                            src={pkg.heroImage} 
                            alt="" 
                            className="w-10 h-10 rounded-xl object-cover shrink-0"
                            referrerPolicy="no-referrer"
                          />
                          <div>
                            <span className="font-bold text-slate-900 block line-clamp-1">{pkg.title}</span>
                            <span className="text-[10px] text-slate-500 block line-clamp-1">
                              {(pkg.routeSummary || []).join(' → ')}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-700">
                        {pkg.destinationName}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-600">
                        {pkg.durationNights || (pkg.durationDays - 1)}N / {pkg.durationDays}D
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 bg-slate-100 rounded-md text-[10px] font-bold text-slate-700">
                          {pkg.tripType || 'LUXURY'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-700">
                        {formatCurrency(pkg.baseNetCostUSD || 0, pkg.currency || 'USD')}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(pkg.suggestedSellingPriceUSD || (pkg.baseNetCostUSD * 1.3), pkg.currency || 'USD')}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          isPub ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {pkg.status || (isPub ? 'PUBLISHED' : 'DRAFT')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => setPreviewPackage(pkg)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg cursor-pointer"
                            title="Preview"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDuplicate(pkg)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg cursor-pointer"
                            title="Duplicate"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleEdit(pkg)}
                            className="p-1.5 text-slate-900 hover:text-[#008972] hover:bg-slate-100 rounded-lg cursor-pointer font-bold"
                            title="Edit"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(pkg.id)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <DeleteConfirmModal
          isOpen={Boolean(deleteConfirmId)}
          onClose={() => setDeleteConfirmId(null)}
          onSuccess={() => {
            setDeleteConfirmId(null);
            refreshPackages();
            showNotification('Package deleted successfully.', 'info');
          }}
          entityType="Package"
          recordId={deleteConfirmId}
          recordTitle={packages.find(p => p.id === deleteConfirmId)?.title || deleteConfirmId}
          user={user}
        />
      )}

      {/* Interactive Package Preview Modal */}
      {previewPackage && (
        <PackageDetailModal
          packageItem={previewPackage}
          onClose={() => setPreviewPackage(null)}
          onCustomizePackage={(pkg) => {
            setPreviewPackage(null);
            if (onCustomizePackage) {
              onCustomizePackage(pkg);
            }
          }}
          onInstantBook={(pkg) => {
            setPreviewPackage(null);
            if (onCustomizePackage) {
              onCustomizePackage(pkg);
            }
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* FULL PACKAGE EDITOR MODAL / DRAWER */}
      {/* ========================================================================= */}
      {isEditorOpen && editingPackage && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-5xl w-full my-auto shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-[#008972] text-white flex items-center justify-center shrink-0">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900 line-clamp-1">
                    {editingPackage.id.startsWith('pkg-') && !editingPackage.title.includes('New') ? `Edit: ${editingPackage.title}` : 'Create Ready-Made Tour Package'}
                  </h2>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {editingPackage.destinationName} • {editingPackage.durationDays} Days / {editingPackage.durationNights || editingPackage.durationDays - 1} Nights Circuit
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsEditorOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Editor Subtabs Navigation */}
            <div className="px-6 py-2.5 bg-white border-b border-slate-200 flex items-center space-x-2 overflow-x-auto shrink-0">
              {[
                { id: 'GENERAL', label: '1. Basic Info & Route', icon: FileText },
                { id: 'ITINERARY', label: '2. Day-by-Day Builder', icon: Calendar },
                { id: 'PRICING', label: '3. Pricing Engine & Margin', icon: DollarSign },
                { id: 'ADDONS', label: '4. Highlights & Policy', icon: Tag },
                { id: 'SEO_PUBLISH', label: '5. SEO & Publishing', icon: Globe }
              ].map(tab => {
                const Icon = tab.icon;
                const isActive = editorActiveTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setEditorActiveTab(tab.id as any)}
                    className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-[#008972] text-white shadow-xs'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              
              {/* TAB 1: GENERAL INFO & DESTINATION ROUTE */}
              {editorActiveTab === 'GENERAL' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="font-bold text-slate-700">Package Title *</label>
                      <input
                        type="text"
                        value={editingPackage.title}
                        onChange={(e) => setEditingPackage({ 
                          ...editingPackage, 
                          title: e.target.value,
                          slug: editingPackage.slug || e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-')
                        })}
                        placeholder="e.g. Japan Golden Route Odyssey: Tokyo, Kyoto & Osaka"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:border-[#008972] outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700">URL Slug</label>
                      <input
                        type="text"
                        value={editingPackage.slug}
                        onChange={(e) => setEditingPackage({ ...editingPackage, slug: e.target.value })}
                        placeholder="e.g. japan-golden-route-odyssey"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:border-[#008972] outline-none font-mono text-[11px]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700">Travel Style / Trip Type</label>
                      <select
                        value={editingPackage.tripType}
                        onChange={(e) => setEditingPackage({ ...editingPackage, tripType: e.target.value as any })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:border-[#008972] outline-none cursor-pointer"
                      >
                        <option value="LUXURY">Luxury 5★ VIP</option>
                        <option value="CULTURAL">Cultural & Heritage</option>
                        <option value="HONEYMOON">Honeymoon & Romantic</option>
                        <option value="ADVENTURE">Adventure & Nature</option>
                        <option value="FAMILY">Family Friendly</option>
                        <option value="CLASSIC">Classic Highlights</option>
                      </select>
                    </div>

                    {/* Destination & Region Auto-Link */}
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700">Destination *</label>
                      <select
                        value={editingPackage.destinationId}
                        onChange={(e) => {
                          const selected = destinations.find(d => d.id === e.target.value);
                          if (selected) {
                            setEditingPackage({
                              ...editingPackage,
                              destinationId: selected.id,
                              destinationName: selected.name,
                              regionId: selected.region,
                              regionName: selected.region
                            });
                          }
                        }}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:border-[#008972] outline-none cursor-pointer"
                      >
                        {destinations.map(d => (
                          <option key={d.id} value={d.id}>{d.name} ({d.country})</option>
                        ))}
                      </select>
                    </div>

                    {/* Duration Controls */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="font-bold text-slate-700">Total Days</label>
                        <input
                          type="number"
                          min="1"
                          max="30"
                          value={editingPackage.durationDays}
                          onChange={(e) => {
                            const days = parseInt(e.target.value) || 1;
                            setEditingPackage({
                              ...editingPackage,
                              durationDays: days,
                              durationNights: Math.max(0, days - 1)
                            });
                          }}
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-900 focus:border-[#008972] outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="font-bold text-slate-700">Total Nights</label>
                        <input
                          type="number"
                          min="0"
                          max="30"
                          value={editingPackage.durationNights || editingPackage.durationDays - 1}
                          onChange={(e) => setEditingPackage({ ...editingPackage, durationNights: parseInt(e.target.value) || 0 })}
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-900 focus:border-[#008972] outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5 md:col-span-2">
                      <label className="font-bold text-slate-700">Hero Image URL</label>
                      <input
                        type="text"
                        value={editingPackage.heroImage}
                        onChange={(e) => setEditingPackage({ ...editingPackage, heroImage: e.target.value })}
                        placeholder="https://images.unsplash.com/..."
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:border-[#008972] outline-none"
                      />
                    </div>

                    <div className="space-y-1.5 md:col-span-2">
                      <label className="font-bold text-slate-700">Tagline / Subheading</label>
                      <input
                        type="text"
                        value={editingPackage.tagline}
                        onChange={(e) => setEditingPackage({ ...editingPackage, tagline: e.target.value })}
                        placeholder="e.g. Tokyo • Mt Fuji & Hakone • Kyoto • Osaka Classic Multi-City Itinerary"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:border-[#008972] outline-none"
                      />
                    </div>

                    <div className="space-y-1.5 md:col-span-2">
                      <label className="font-bold text-slate-700">Overview Description</label>
                      <textarea
                        rows={3}
                        value={editingPackage.description}
                        onChange={(e) => setEditingPackage({ ...editingPackage, description: e.target.value })}
                        placeholder="Detailed narrative describing the journey, target demographic, and experience..."
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:border-[#008972] outline-none leading-relaxed"
                      />
                    </div>

                    {/* Route Summary Array Editor */}
                    <div className="space-y-2 md:col-span-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="font-bold text-slate-800">City Route Summary Points</label>
                          <p className="text-[10px] text-slate-500">Add the city sequence and stay counts (e.g. "Tokyo (3 Nights)", "Kyoto (2 Nights)")</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEditingPackage({
                            ...editingPackage,
                            routeSummary: [...(editingPackage.routeSummary || []), 'New City (1 Night)']
                          })}
                          className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-[11px] font-bold text-slate-700 cursor-pointer flex items-center space-x-1"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add City Point</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 pt-2">
                        {(editingPackage.routeSummary || []).map((route, idx) => (
                          <div key={idx} className="flex items-center space-x-1 bg-white p-1.5 rounded-xl border border-slate-200">
                            <input
                              type="text"
                              value={route}
                              onChange={(e) => {
                                const copy = [...(editingPackage.routeSummary || [])];
                                copy[idx] = e.target.value;
                                setEditingPackage({ ...editingPackage, routeSummary: copy });
                              }}
                              className="w-full px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const copy = (editingPackage.routeSummary || []).filter((_, i) => i !== idx);
                                setEditingPackage({ ...editingPackage, routeSummary: copy });
                              }}
                              className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: DAY-BY-DAY VISUAL ITINERARY BUILDER */}
              {editorActiveTab === 'ITINERARY' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-black text-slate-900">Visual Day-by-Day Circuit Builder</h3>
                      <p className="text-[11px] text-slate-500">
                        Assign master products, hotels, and intercity transfers for each day. References master product inventory directly.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const days = editingPackage.itinerary || [];
                        const nextDayNum = days.length + 1;
                        const newDay: PackageItineraryDay = {
                          dayNumber: nextDayNum,
                          title: `Day ${nextDayNum} Excursions & Discovery`,
                          description: 'Private guided sightseeing and cultural activities.',
                          productIds: [],
                          mealsIncluded: { breakfast: true, lunch: false, dinner: false },
                          guideIncluded: true,
                          freeTime: false
                        };
                        setEditingPackage({
                          ...editingPackage,
                          durationDays: nextDayNum,
                          durationNights: nextDayNum - 1,
                          itinerary: [...days, newDay]
                        });
                      }}
                      className="px-3 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Day {((editingPackage.itinerary || []).length) + 1}</span>
                    </button>
                  </div>

                  {/* Day-by-Day List */}
                  <div className="space-y-4">
                    {(editingPackage.itinerary || []).map((day, dayIdx) => {
                      const dayProducts = products.filter(p => (day.productIds || []).includes(p.id));

                      return (
                        <div 
                          key={dayIdx} 
                          className="bg-slate-50 rounded-2xl p-4 border border-slate-200/90 space-y-4"
                        >
                          {/* Day Header */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
                            <div className="flex items-center space-x-2.5">
                              <span className="w-7 h-7 rounded-xl bg-[#008972] text-white flex items-center justify-center font-black text-xs shrink-0">
                                {day.dayNumber}
                              </span>
                              <input
                                type="text"
                                value={day.title}
                                onChange={(e) => {
                                  const copy = [...(editingPackage.itinerary || [])];
                                  copy[dayIdx] = { ...copy[dayIdx], title: e.target.value };
                                  setEditingPackage({ ...editingPackage, itinerary: copy });
                                }}
                                placeholder="Day Title (e.g. Tokyo Imperial Heritage & Tea Master Experience)"
                                className="font-bold text-slate-900 text-xs px-2.5 py-1 bg-white border border-slate-200 rounded-lg w-72 focus:border-[#008972] outline-none"
                              />
                            </div>

                            <div className="flex items-center space-x-2">
                              {/* Hub Selector */}
                              <select
                                value={day.hubId || ''}
                                onChange={(e) => {
                                  const hub = cityHubs.find(h => h.id === e.target.value);
                                  const copy = [...(editingPackage.itinerary || [])];
                                  copy[dayIdx] = { 
                                    ...copy[dayIdx], 
                                    hubId: hub?.id, 
                                    hubName: hub?.name 
                                  };
                                  setEditingPackage({ ...editingPackage, itinerary: copy });
                                }}
                                className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none cursor-pointer"
                              >
                                <option value="">Select City Hub</option>
                                {cityHubs
                                  .filter(h => h.destinationId === editingPackage.destinationId)
                                  .map(h => (
                                    <option key={h.id} value={h.id}>{h.name}</option>
                                  ))
                                }
                              </select>

                              {/* Remove Day */}
                              <button
                                type="button"
                                onClick={() => {
                                  const copy = (editingPackage.itinerary || []).filter((_, i) => i !== dayIdx);
                                  // renumber days
                                  const renumbered = copy.map((d, i) => ({ ...d, dayNumber: i + 1 }));
                                  setEditingPackage({ 
                                    ...editingPackage, 
                                    durationDays: Math.max(1, renumbered.length),
                                    durationNights: Math.max(0, renumbered.length - 1),
                                    itinerary: renumbered 
                                  });
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                                title="Remove Day"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Day Description */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-slate-400">Day Schedule & Narrative</label>
                            <textarea
                              rows={2}
                              value={day.description}
                              onChange={(e) => {
                                const copy = [...(editingPackage.itinerary || [])];
                                copy[dayIdx] = { ...copy[dayIdx], description: e.target.value };
                                setEditingPackage({ ...editingPackage, itinerary: copy });
                              }}
                              placeholder="Detail the morning, afternoon, and evening activities..."
                              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-[#008972]"
                            />
                          </div>

                          {/* Assigned Master Products for this Day */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold uppercase text-slate-400 flex items-center space-x-1">
                                <Package className="w-3 h-3 text-[#008972]" />
                                <span>Master Products / Excursions on Day {day.dayNumber}</span>
                              </span>

                              {/* Add Product Dropdown */}
                              <select
                                onChange={(e) => {
                                  const prodId = e.target.value;
                                  if (!prodId) return;
                                  const currentProdIds = day.productIds || [];
                                  if (!currentProdIds.includes(prodId)) {
                                    const copy = [...(editingPackage.itinerary || [])];
                                    copy[dayIdx] = { ...copy[dayIdx], productIds: [...currentProdIds, prodId] };
                                    
                                    // Also sync top-level productIds
                                    const allProdIds = Array.from(new Set([...(editingPackage.productIds || []), prodId]));
                                    setEditingPackage({ 
                                      ...editingPackage, 
                                      itinerary: copy,
                                      productIds: allProdIds
                                    });
                                  }
                                  e.target.value = '';
                                }}
                                className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 outline-none cursor-pointer"
                              >
                                <option value="">+ Add Product from Master Inventory</option>
                                {products
                                  .filter(p => p.destinationId === editingPackage.destinationId || p.destinationName.toLowerCase() === editingPackage.destinationName.toLowerCase())
                                  .map(p => (
                                    <option key={p.id} value={p.id}>
                                      {p.name} ({p.category} • {formatCurrency(p.adultNetPrice, p.currency)})
                                    </option>
                                  ))
                                }
                              </select>
                            </div>

                            {/* List of Products on this day */}
                            {dayProducts.length === 0 ? (
                              <p className="text-[11px] text-slate-400 italic bg-white p-2.5 rounded-xl border border-dashed border-slate-200">
                                No master products assigned for this day. Use dropdown above to attach tours, transfers, or experiences.
                              </p>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {dayProducts.map(prod => (
                                  <div 
                                    key={prod.id} 
                                    className="bg-white p-2 rounded-xl border border-slate-200 flex items-center justify-between"
                                  >
                                    <div className="flex items-center space-x-2 min-w-0">
                                      <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[9px] font-extrabold uppercase text-slate-600">
                                        {prod.category}
                                      </span>
                                      <span className="font-bold text-slate-800 text-[11px] truncate" title={prod.name}>
                                        {prod.name}
                                      </span>
                                    </div>

                                    <div className="flex items-center space-x-2 shrink-0">
                                      <span className="font-mono text-[10px] font-bold text-slate-600">
                                        {formatCurrency(prod.adultNetPrice, prod.currency)}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const copy = [...(editingPackage.itinerary || [])];
                                          copy[dayIdx] = {
                                            ...copy[dayIdx],
                                            productIds: (copy[dayIdx].productIds || []).filter(id => id !== prod.id)
                                          };
                                          setEditingPackage({ ...editingPackage, itinerary: copy });
                                        }}
                                        className="text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Hotel / Meal Specs */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/80">
                            {/* Assigned Hotel */}
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase text-slate-400 flex items-center space-x-1">
                                <HotelIcon className="w-3 h-3 text-[#008972]" />
                                <span>Assigned Hotel / Accommodation</span>
                              </label>
                              <select
                                value={day.hotelId || ''}
                                onChange={(e) => {
                                  const hot = hotels.find(h => h.id === e.target.value);
                                  const copy = [...(editingPackage.itinerary || [])];
                                  copy[dayIdx] = {
                                    ...copy[dayIdx],
                                    hotelId: hot?.id,
                                    hotelName: hot?.name,
                                    roomTypeId: hot?.roomTypes?.[0]?.id
                                  };
                                  setEditingPackage({ ...editingPackage, itinerary: copy });
                                }}
                                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none cursor-pointer"
                              >
                                <option value="">Contracted Hotel Roster</option>
                                {hotels
                                  .filter(h => h.destinationId === editingPackage.destinationId)
                                  .map(h => (
                                    <option key={h.id} value={h.id}>{h.name} ({h.starRating}★ in {h.city})</option>
                                  ))
                                }
                              </select>
                            </div>

                            {/* Meals Included Checkboxes */}
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase text-slate-400 flex items-center space-x-1">
                                <Utensils className="w-3 h-3 text-[#008972]" />
                                <span>Meals Included</span>
                              </label>
                              <div className="flex items-center space-x-4 pt-1">
                                <label className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={day.mealsIncluded?.breakfast ?? true}
                                    onChange={(e) => {
                                      const copy = [...(editingPackage.itinerary || [])];
                                      copy[dayIdx] = {
                                        ...copy[dayIdx],
                                        mealsIncluded: {
                                          breakfast: e.target.checked,
                                          lunch: !!copy[dayIdx].mealsIncluded?.lunch,
                                          dinner: !!copy[dayIdx].mealsIncluded?.dinner
                                        }
                                      };
                                      setEditingPackage({ ...editingPackage, itinerary: copy });
                                    }}
                                    className="rounded text-[#008972] focus:ring-0"
                                  />
                                  <span>Breakfast</span>
                                </label>

                                <label className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={day.mealsIncluded?.lunch ?? false}
                                    onChange={(e) => {
                                      const copy = [...(editingPackage.itinerary || [])];
                                      copy[dayIdx] = {
                                        ...copy[dayIdx],
                                        mealsIncluded: {
                                          breakfast: !!copy[dayIdx].mealsIncluded?.breakfast,
                                          lunch: e.target.checked,
                                          dinner: !!copy[dayIdx].mealsIncluded?.dinner
                                        }
                                      };
                                      setEditingPackage({ ...editingPackage, itinerary: copy });
                                    }}
                                    className="rounded text-[#008972] focus:ring-0"
                                  />
                                  <span>Lunch</span>
                                </label>

                                <label className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={day.mealsIncluded?.dinner ?? false}
                                    onChange={(e) => {
                                      const copy = [...(editingPackage.itinerary || [])];
                                      copy[dayIdx] = {
                                        ...copy[dayIdx],
                                        mealsIncluded: {
                                          breakfast: !!copy[dayIdx].mealsIncluded?.breakfast,
                                          lunch: !!copy[dayIdx].mealsIncluded?.lunch,
                                          dinner: e.target.checked
                                        }
                                      };
                                      setEditingPackage({ ...editingPackage, itinerary: copy });
                                    }}
                                    className="rounded text-[#008972] focus:ring-0"
                                  />
                                  <span>Dinner</span>
                                </label>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 3: PRICING ENGINE & COMMERCIAL MARGIN */}
              {editorActiveTab === 'PRICING' && (
                <div className="space-y-6">
                  {/* Pricing Mode Toggle */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs flex items-center space-x-1.5">
                        <DollarSign className="w-4 h-4 text-[#008972]" />
                        <span>Commercial Pricing Engine Configuration</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Choose whether package prices recalculate live from master inventory or stay locked.
                      </p>
                    </div>

                    <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setEditingPackage({
                          ...editingPackage,
                          pricingConfiguration: {
                            ...(editingPackage.pricingConfiguration || { baseNetCostUSD: 2500, suggestedSellingPriceUSD: 3500, currency: 'USD' }),
                            pricingMode: 'LIVE'
                          }
                        })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                          (editingPackage.pricingConfiguration?.pricingMode || 'LIVE') === 'LIVE'
                            ? 'bg-[#008972] text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Live Master Pricing</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setEditingPackage({
                          ...editingPackage,
                          pricingConfiguration: {
                            ...(editingPackage.pricingConfiguration || { baseNetCostUSD: 2500, suggestedSellingPriceUSD: 3500, currency: 'USD' }),
                            pricingMode: 'LOCKED'
                          }
                        })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                          editingPackage.pricingConfiguration?.pricingMode === 'LOCKED'
                            ? 'bg-slate-900 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>Locked Package Pricing</span>
                      </button>
                    </div>
                  </div>

                  {/* Commercial Margin & Markup Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                      <label className="font-bold text-slate-800 text-xs block">
                        Base Nett Wholesale Cost (USD)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editingPackage.baseNetCostUSD || 0}
                        onChange={(e) => {
                          const net = parseFloat(e.target.value) || 0;
                          const buyerMarkup = editingPackage.pricingConfiguration?.buyerMarkupPercent || 25;
                          const suggested = Math.round(net * (1 + buyerMarkup / 100));
                          setEditingPackage({
                            ...editingPackage,
                            baseNetCostUSD: net,
                            suggestedSellingPriceUSD: suggested,
                            finalSellingPriceUSD: suggested,
                            pricingConfiguration: {
                              ...(editingPackage.pricingConfiguration || { pricingMode: 'LIVE', currency: 'USD' }),
                              baseNetCostUSD: net,
                              suggestedSellingPriceUSD: suggested,
                              finalSellingPriceUSD: suggested
                            }
                          });
                        }}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono font-black text-slate-900 text-sm outline-none focus:border-[#008972]"
                      />
                      <span className="text-[10px] text-slate-500 block">Calculated wholesale cost across all circuit days</span>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                      <label className="font-bold text-slate-800 text-xs block">
                        Buyer Markup % (Retail)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={editingPackage.pricingConfiguration?.buyerMarkupPercent ?? 25}
                        onChange={(e) => {
                          const markup = parseFloat(e.target.value) || 0;
                          const net = editingPackage.baseNetCostUSD || 0;
                          const suggested = Math.round(net * (1 + markup / 100));
                          setEditingPackage({
                            ...editingPackage,
                            suggestedSellingPriceUSD: suggested,
                            finalSellingPriceUSD: suggested,
                            pricingConfiguration: {
                              ...(editingPackage.pricingConfiguration || { pricingMode: 'LIVE', currency: 'USD', baseNetCostUSD: net }),
                              buyerMarkupPercent: markup,
                              suggestedSellingPriceUSD: suggested,
                              finalSellingPriceUSD: suggested
                            }
                          });
                        }}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono font-black text-slate-900 text-sm outline-none focus:border-[#008972]"
                      />
                      <span className="text-[10px] text-slate-500 block">Standard markup applied for retail consumer views</span>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                      <label className="font-bold text-slate-800 text-xs block">
                        B2B Wholesale Markup %
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={editingPackage.pricingConfiguration?.b2bMarkupPercent ?? 12}
                        onChange={(e) => {
                          const b2bMarkup = parseFloat(e.target.value) || 0;
                          setEditingPackage({
                            ...editingPackage,
                            pricingConfiguration: {
                              ...(editingPackage.pricingConfiguration || { pricingMode: 'LIVE', currency: 'USD', baseNetCostUSD: 0, suggestedSellingPriceUSD: 0 }),
                              b2bMarkupPercent: b2bMarkup
                            }
                          });
                        }}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono font-black text-slate-900 text-sm outline-none focus:border-[#008972]"
                      />
                      <span className="text-[10px] text-slate-500 block">Wholesale markup applied for authenticated B2B Agents</span>
                    </div>
                  </div>

                  {/* Pricing Simulation Breakdown */}
                  <div className="bg-emerald-950 text-emerald-100 p-5 rounded-3xl space-y-4">
                    <div className="flex items-center justify-between border-b border-emerald-800/80 pb-3">
                      <h4 className="font-black text-white text-xs flex items-center space-x-2">
                        <Sparkles className="w-4 h-4 text-[#00C6A6]" />
                        <span>Live Role-Based Quotation Output</span>
                      </h4>
                      <span className="text-[10px] font-mono uppercase text-emerald-400">All amounts in USD</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <span className="text-[10px] uppercase text-emerald-300 font-bold block">Wholesale Net Cost</span>
                        <span className="text-xl font-black text-white font-mono">
                          {formatCurrency(editingPackage.baseNetCostUSD || 0, 'USD')}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-emerald-300 font-bold block">B2B Agent Wholesale Rate</span>
                        <span className="text-xl font-black text-[#00C6A6] font-mono">
                          {formatCurrency(
                            (editingPackage.baseNetCostUSD || 0) * (1 + (editingPackage.pricingConfiguration?.b2bMarkupPercent || 12) / 100),
                            'USD'
                          )}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-emerald-300 font-bold block">Final Selling Price (Retail)</span>
                        <span className="text-xl font-black text-amber-300 font-mono">
                          {formatCurrency(editingPackage.finalSellingPriceUSD || editingPackage.suggestedSellingPriceUSD || (editingPackage.baseNetCostUSD * 1.25), 'USD')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: HIGHLIGHTS, INCLUSIONS & EXCLUSIONS */}
              {editorActiveTab === 'ADDONS' && (
                <div className="space-y-6">
                  {/* Highlights Bullet List */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-800">Key Highlights (Bullet Points)</label>
                      <button
                        type="button"
                        onClick={() => setEditingPackage({
                          ...editingPackage,
                          highlights: [...(editingPackage.highlights || []), 'New highlight bullet point']
                        })}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold cursor-pointer"
                      >
                        + Add Highlight
                      </button>
                    </div>

                    <div className="space-y-2">
                      {(editingPackage.highlights || []).map((hl, idx) => (
                        <div key={idx} className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={hl}
                            onChange={(e) => {
                              const copy = [...(editingPackage.highlights || [])];
                              copy[idx] = e.target.value;
                              setEditingPackage({ ...editingPackage, highlights: copy });
                            }}
                            className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-[#008972]"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const copy = (editingPackage.highlights || []).filter((_, i) => i !== idx);
                              setEditingPackage({ ...editingPackage, highlights: copy });
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Inclusions & Exclusions */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-emerald-800">What is Included</label>
                        <button
                          type="button"
                          onClick={() => setEditingPackage({
                            ...editingPackage,
                            inclusions: [...(editingPackage.inclusions || []), 'Included item']
                          })}
                          className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md text-[11px] font-bold cursor-pointer"
                        >
                          + Add Included
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        {(editingPackage.inclusions || []).map((inc, idx) => (
                          <div key={idx} className="flex items-center space-x-1.5">
                            <input
                              type="text"
                              value={inc}
                              onChange={(e) => {
                                const copy = [...(editingPackage.inclusions || [])];
                                copy[idx] = e.target.value;
                                setEditingPackage({ ...editingPackage, inclusions: copy });
                              }}
                              className="flex-1 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const copy = (editingPackage.inclusions || []).filter((_, i) => i !== idx);
                                setEditingPackage({ ...editingPackage, inclusions: copy });
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-rose-800">What is Excluded</label>
                        <button
                          type="button"
                          onClick={() => setEditingPackage({
                            ...editingPackage,
                            exclusions: [...(editingPackage.exclusions || []), 'Excluded item']
                          })}
                          className="px-2 py-0.5 bg-rose-50 text-rose-700 rounded-md text-[11px] font-bold cursor-pointer"
                        >
                          + Add Excluded
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        {(editingPackage.exclusions || []).map((exc, idx) => (
                          <div key={idx} className="flex items-center space-x-1.5">
                            <input
                              type="text"
                              value={exc}
                              onChange={(e) => {
                                const copy = [...(editingPackage.exclusions || [])];
                                copy[idx] = e.target.value;
                                setEditingPackage({ ...editingPackage, exclusions: copy });
                              }}
                              className="flex-1 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const copy = (editingPackage.exclusions || []).filter((_, i) => i !== idx);
                                setEditingPackage({ ...editingPackage, exclusions: copy });
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Terms & Policies */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700">Cancellation Policy</label>
                      <textarea
                        rows={3}
                        value={editingPackage.cancellationPolicy || ''}
                        onChange={(e) => setEditingPackage({ ...editingPackage, cancellationPolicy: e.target.value })}
                        placeholder="Cancellation deadlines, refundable tiers..."
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700">Important Information / Visa Notes</label>
                      <textarea
                        rows={3}
                        value={editingPackage.importantInformation || ''}
                        onChange={(e) => setEditingPackage({ ...editingPackage, importantInformation: e.target.value })}
                        placeholder="Luggage allowances, passport validity, tipping guidelines..."
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: SEO, VISIBILITY & PUBLISHING */}
              {editorActiveTab === 'SEO_PUBLISH' && (
                <div className="space-y-6">
                  {/* Status Selection */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                    <label className="font-bold text-slate-900 text-xs block">Publishing Status *</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {[
                        { id: 'PUBLISHED', label: 'Published Live', color: 'emerald' },
                        { id: 'DRAFT', label: 'Draft', color: 'amber' },
                        { id: 'REVIEW', label: 'In Review', color: 'blue' },
                        { id: 'ARCHIVED', label: 'Archived', color: 'slate' }
                      ].map(st => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => setEditingPackage({
                            ...editingPackage,
                            status: st.id as PackageStatus,
                            isPublished: st.id === 'PUBLISHED'
                          })}
                          className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer text-center ${
                            (editingPackage.status || (editingPackage.isPublished ? 'PUBLISHED' : 'DRAFT')) === st.id
                              ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Visibility Toggles */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                    <label className="font-bold text-slate-900 text-xs block">Public Catalog Visibility</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <label className="flex items-center space-x-2 bg-white p-3 rounded-xl border border-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingPackage.visibility?.destinationPage ?? true}
                          onChange={(e) => setEditingPackage({
                            ...editingPackage,
                            visibility: { ...(editingPackage.visibility || { hubPage: true, homepage: true, promotions: true, search: true, featured: false }), destinationPage: e.target.checked }
                          })}
                          className="rounded text-[#008972]"
                        />
                        <span className="font-bold text-slate-800 text-xs">Destination Pages</span>
                      </label>

                      <label className="flex items-center space-x-2 bg-white p-3 rounded-xl border border-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingPackage.visibility?.homepage ?? true}
                          onChange={(e) => setEditingPackage({
                            ...editingPackage,
                            visibility: { ...(editingPackage.visibility || { destinationPage: true, hubPage: true, promotions: true, search: true, featured: false }), homepage: e.target.checked }
                          })}
                          className="rounded text-[#008972]"
                        />
                        <span className="font-bold text-slate-800 text-xs">Homepage Featured</span>
                      </label>

                      <label className="flex items-center space-x-2 bg-white p-3 rounded-xl border border-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingPackage.visibility?.featured ?? false}
                          onChange={(e) => setEditingPackage({
                            ...editingPackage,
                            isFeatured: e.target.checked,
                            visibility: { ...(editingPackage.visibility || { destinationPage: true, hubPage: true, homepage: true, promotions: true, search: true }), featured: e.target.checked }
                          })}
                          className="rounded text-[#008972]"
                        />
                        <span className="font-bold text-slate-800 text-xs">Badge: "Editor's Choice"</span>
                      </label>
                    </div>
                  </div>

                  {/* Advanced SEO, Open Graph & Structured Data Settings */}
                  <div className="pt-2">
                    <EntitySEOSettingsTab
                      entityType="PACKAGE"
                      entity={{
                        ...editingPackage,
                        name: editingPackage.title,
                        description: editingPackage.description || editingPackage.tagline
                      }}
                      seo={editingPackage.seo as EntitySEO}
                      onChange={(newSeo) => setEditingPackage({
                        ...editingPackage,
                        seo: newSeo,
                        slug: newSeo.slug || editingPackage.slug
                      })}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="px-6 py-3.5 border-t border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Cancel
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleSaveEditor}
                  className="px-6 py-2 bg-[#008972] hover:bg-[#007460] text-white font-black rounded-xl text-xs shadow-sm transition-all cursor-pointer flex items-center space-x-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Package Circuit</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
