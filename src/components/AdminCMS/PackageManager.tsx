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
import { AdminWorkspaceLayout } from '../common/AdminWorkspaceLayout';
import { ReadyMadePackageBuilder } from './ReadyMadePackageBuilder';

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
      const q = (searchQuery || '').toLowerCase().trim();
      const matchesSearch = !q || 
        (pkg.title || '').toLowerCase().includes(q) ||
        (pkg.tagline || '').toLowerCase().includes(q) ||
        (pkg.destinationName || '').toLowerCase().includes(q) ||
        (pkg.routeSummary || []).some(r => (r || '').toLowerCase().includes(q)) ||
        (pkg.tags || []).some(t => (t || '').toLowerCase().includes(q));

      const matchesDest = destinationFilter === 'ALL' || 
        pkg.destinationId === destinationFilter || 
        (pkg.destinationName || '').toLowerCase() === (destinationFilter || '').toLowerCase();

      const matchesHub = hubFilter === 'ALL' || 
        (pkg.hubIds && pkg.hubIds.includes(hubFilter)) ||
        (pkg.routeSummary && pkg.routeSummary.some(r => (r || '').toLowerCase().includes((hubFilter || '').toLowerCase())));

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

    const newPkg: B2BPackage = {
      id: `pkg-${Date.now()}`,
      title: 'New Luxury Itinerary Circuit',
      slug: `new-circuit-${Date.now().toString().slice(-4)}`,
      destinationId: defaultDest.id,
      destinationName: defaultDest.name,
      regionId: defaultDest.region,
      regionName: defaultDest.region,
      hubIds: [], // Explicitly empty array! No hub selected by default
      hubNames: [], // Explicitly empty array!
      durationDays: 7,
      durationNights: 6,
      heroImage: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200&auto=format&fit=crop',
      galleryImages: [],
      tagline: 'Multi-City Signature Circuit with 5★ Stays & Private VIP Chauffeur',
      description: 'Comprehensive wholesale circuit itinerary designed for discerning private travelers with premium accommodation, skip-the-line entrance passes, and dedicated ground support.',
      detailedDescription: '',
      routeSummary: [], // Explicitly empty array
      routeHubs: [], // Explicitly empty array
      hotelsSummary: [],
      productIds: [],
      productReferences: [],
      hotelReferences: [],
      itinerary: Array.from({ length: 7 }, (_, i) => ({
        dayNumber: i + 1,
        title: i === 0 ? 'Arrival & Private Chauffeur Transfer' : i === 6 ? 'Departure Chauffeur & Farewell' : `Day ${i + 1} Sightseeing & Discovery`,
        hubId: undefined,
        hubName: undefined,
        description: `Scheduled private excursions, cultural immersion, and leisure time in ${defaultDest.name}.`,
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
    // Load the package's actual saved hub IDs and preserve empty selections
    const safePkg: B2BPackage = {
      ...pkg,
      hubIds: Array.isArray(pkg.hubIds) ? [...pkg.hubIds] : [],
      hubNames: Array.isArray(pkg.hubNames) ? [...pkg.hubNames] : [],
      routeHubs: Array.isArray(pkg.routeHubs) ? [...pkg.routeHubs] : [],
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

  // Handler: Save Package from Dedicated Package Builder
  const handleSaveReadyMadePackage = async (savedPkg: B2BPackage, publishImmediately: boolean = false) => {
    const isPublished = publishImmediately || savedPkg.status === 'PUBLISHED';
    const finalPkg: B2BPackage = {
      ...savedPkg,
      hubIds: Array.from(new Set(savedPkg.hubIds || [])),
      hubNames: Array.from(new Set(savedPkg.hubNames || [])),
      routeHubs: savedPkg.routeHubs || [],
      status: isPublished ? 'PUBLISHED' : (savedPkg.status || 'DRAFT'),
      isPublished,
      updatedAt: new Date().toISOString()
    };

    try {
      await db.savePackageAsync(finalPkg, user);
    } catch {
      db.savePackage(finalPkg, user);
    }
    refreshPackages();
    setIsEditorOpen(false);
    setEditingPackage(null);
    showNotification(
      publishImmediately 
        ? `Package "${finalPkg.title}" published live successfully to website and B2B portal!` 
        : `Package "${finalPkg.title}" saved successfully as draft template.`,
      'success'
    );
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
              className="inline-flex items-center bg-[#008972] hover:bg-[#007460] text-white px-5 py-2.5 rounded-2xl text-xs font-black shadow-sm transition-all cursor-pointer"
            >
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
      {/* READY-MADE PACKAGE BUILDER WORKSPACE */}
      {/* ========================================================================= */}
      {isEditorOpen && editingPackage && (
        <ReadyMadePackageBuilder
          initialPackage={editingPackage}
          destinations={destinations}
          products={products}
          hotels={hotels}
          cityHubs={cityHubs}
          onSave={handleSaveReadyMadePackage}
          onClose={() => {
            setIsEditorOpen(false);
            setEditingPackage(null);
          }}
        />
      )}
    </div>
  );
};
