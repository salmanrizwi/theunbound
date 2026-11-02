import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  Search,
  Filter,
  Calendar,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Clock,
  FileText,
  Archive,
  Copy,
  Edit2,
  Eye,
  Trash2,
  X,
  ShieldCheck,
  DollarSign,
  Percent,
  Package,
  MapPin,
  Building2,
  History,
  ChevronLeft,
  ChevronRight,
  Info,
  Sliders
} from 'lucide-react';
import {
  SurchargeMaster,
  SurchargeStatus,
  SurchargeCategoryType,
  SurchargeApplicationBasis,
  SurchargePeriodWindow,
  CurrencyCode,
  Product,
  Destination,
  MasterRegion,
  CityHub,
  Supplier,
  User
} from '../../types';
import { AppDatabase } from '../../services/db';
import {
  resolveEffectiveSurchargeStatus,
  generateSurchargeCode,
  validateSurchargeMaster,
  detectCentralizedSurchargeConflicts
} from '../../services/surchargeEngine';
import { formatCurrency } from '../../services/pricingEngine';

interface SurchargeManagementModuleProps {
  user?: User | null;
  initialFilterProductId?: string;
}

const SURCHARGE_CATEGORIES: Array<{ value: SurchargeCategoryType; label: string }> = [
  { value: 'PEAK_SEASON', label: 'Peak Season Surcharge' },
  { value: 'HOLIDAY_FESTIVAL', label: 'National Holiday / Festival' },
  { value: 'WEEKEND_SURCHARGE', label: 'Weekend Supplement' },
  { value: 'LATE_NIGHT_EARLY_MORNING', label: 'Late-Night / Early-Morning Supplement' },
  { value: 'SPECIAL_EVENT', label: 'Special Event / Convention Surcharge' },
  { value: 'FUEL_OPERATIONAL', label: 'Fuel / Operational Levy' },
  { value: 'CUSTOM', label: 'Custom Commercial Surcharge' }
];

const PRICING_BASIS_OPTIONS: Array<{ value: SurchargeApplicationBasis; label: string; group: string }> = [
  { value: 'PER_PERSON', label: 'Per Person (Chargeable Pax)', group: 'Passenger Based' },
  { value: 'PER_ADULT', label: 'Per Adult', group: 'Passenger Based' },
  { value: 'PER_CHILD', label: 'Per Child', group: 'Passenger Based' },
  { value: 'PER_INFANT', label: 'Per Infant', group: 'Passenger Based' },
  { value: 'FIXED_AMOUNT', label: 'Fixed Amount (Flat per Service)', group: 'Flat / Percentage' },
  { value: 'PERCENTAGE', label: 'Percentage of Product Selling Price', group: 'Flat / Percentage' },
  { value: 'PER_ROOM_NIGHT', label: 'Per Room / Per Night', group: 'Accommodation & Stay' },
  { value: 'PER_ROOM', label: 'Per Room (Entire Stay)', group: 'Accommodation & Stay' },
  { value: 'PER_NIGHT', label: 'Per Night', group: 'Accommodation & Stay' },
  { value: 'PER_VEHICLE', label: 'Per Vehicle / Vessel', group: 'Transport & Fleet' },
  { value: 'PER_HOUR', label: 'Per Hour (Guides / Charters)', group: 'Time & Unit Based' },
  { value: 'PER_DAY', label: 'Per Day', group: 'Time & Unit Based' },
  { value: 'PER_UNIT', label: 'Per Unit / Quantity', group: 'Time & Unit Based' },
  { value: 'PER_DEVICE', label: 'Per Device (eSIM / Wi-Fi)', group: 'Time & Unit Based' },
  { value: 'PER_BOOKING', label: 'Per Booking / Quotation Item', group: 'Flat / Percentage' },
  { value: 'PER_SERVICE', label: 'Per Service', group: 'Flat / Percentage' }
];

const CURRENCY_OPTIONS: CurrencyCode[] = [
  'JPY',
  'USD',
  'EUR',
  'GBP',
  'INR',
  'AED',
  'CHF',
  'SGD',
  'THB',
  'AUD',
  'CAD'
];

const TIMEZONE_OPTIONS = [
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST · UTC+9)' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (CET/CEST)' },
  { value: 'Europe/Zurich', label: 'Europe/Zurich (CET/CEST)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GST · UTC+4)' },
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST · UTC+5:30)' },
  { value: 'Asia/Bangkok', label: 'Asia/Bangkok (ICT · UTC+7)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT · UTC+8)' },
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' }
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const SurchargeManagementModule: React.FC<SurchargeManagementModuleProps> = ({
  user,
  initialFilterProductId = ''
}) => {
  const db = AppDatabase.getInstance();

  const [surcharges, setSurcharges] = useState<SurchargeMaster[]>(() => db.getSurchargeMasters(true));
  const [products, setProducts] = useState<Product[]>(() => db.getProducts());
  const [destinations] = useState<Destination[]>(() => db.getDestinations());
  const [regions] = useState<MasterRegion[]>(() => db.getMasterRegions());
  const [cityHubs] = useState<CityHub[]>(() => db.getCityHubs());
  const [suppliers] = useState<Supplier[]>(() => db.getSuppliers());

  // Listing Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [destinationFilter, setDestinationFilter] = useState<string>('ALL');
  const [regionFilter, setRegionFilter] = useState<string>('ALL');
  const [supplierFilter, setSupplierFilter] = useState<string>('ALL');
  const [surchargeTypeFilter, setSurchargeTypeFilter] = useState<string>('ALL');
  const [periodFromFilter, setPeriodFromFilter] = useState<string>('');
  const [periodToFilter, setPeriodToFilter] = useState<string>('');
  const [linkedProductFilter, setLinkedProductFilter] = useState<string>(initialFilterProductId);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Workspace Mode: LIST | FORM | VIEW_MODAL | HISTORY_MODAL
  const [viewMode, setViewMode] = useState<'LIST' | 'FORM'>('LIST');
  const [editingSurcharge, setEditingSurcharge] = useState<SurchargeMaster | null>(null);
  const [inspectingSurcharge, setInspectingSurcharge] = useState<SurchargeMaster | null>(null);
  const [historyModalSurchargeId, setHistoryModalSurchargeId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<SurchargeMaster>>({});
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [formWarnings, setFormWarnings] = useState<string[]>([]);
  const [saveBanner, setSaveBanner] = useState<string | null>(null);

  // Product Selector inside Form (Section C)
  const [prodSearch, setProdSearch] = useState('');
  const [prodCategoryFilter, setProdCategoryFilter] = useState('ALL');
  const [prodSubcategoryFilter, setProdSubcategoryFilter] = useState('ALL');
  const [prodDestinationFilter, setProdDestinationFilter] = useState('ALL');
  const [prodRegionFilter, setProdRegionFilter] = useState('ALL');
  const [prodHubFilter, setProdHubFilter] = useState('ALL');
  const [prodSupplierFilter, setProdSupplierFilter] = useState('ALL');

  // Dynamic Inclusions / Exclusions / Blackout Dates inputs
  const [newInclusion, setNewInclusion] = useState('');
  const [newExclusion, setNewExclusion] = useState('');
  const [newBlackoutDate, setNewBlackoutDate] = useState('');

  useEffect(() => {
    const refresh = () => {
      setSurcharges(db.getSurchargeMasters(true));
      setProducts(db.getProducts());
    };
    const unsubscribe = db.subscribe(refresh);
    return () => unsubscribe();
  }, [db]);

  useEffect(() => {
    if (initialFilterProductId) {
      setLinkedProductFilter(initialFilterProductId);
    }
  }, [initialFilterProductId]);

  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach(p => map.set(p.id, p));
    return map;
  }, [products]);

  // Dashboard Metrics (from live records)
  const dashboardMetrics = useMemo(() => {
    return db.getSurchargeDashboardMetrics();
  }, [surcharges, products]);

  // Detect any inactive/archived products linked to active/scheduled surcharges
  const inactiveLinkedProductAlerts = useMemo(() => {
    const alerts: Array<{ surchargeCode: string; surchargeName: string; productName: string; productSku: string; productStatus: string }> = [];
    surcharges.forEach(s => {
      const eff = resolveEffectiveSurchargeStatus(s);
      if (eff !== 'ACTIVE' && eff !== 'SCHEDULED') return;
      (s.linkedProductIds || []).forEach(pid => {
        const prod = productMap.get(pid);
        if (prod && prod.status !== 'ACTIVE') {
          alerts.push({
            surchargeCode: s.code,
            surchargeName: s.name,
            productName: prod.name,
            productSku: prod.sku,
            productStatus: prod.status
          });
        }
      });
    });
    return alerts;
  }, [surcharges, productMap]);

  // Filtered Surcharges for Listing Table
  const filteredSurcharges = useMemo(() => {
    return surcharges.filter(s => {
      const effStatus = resolveEffectiveSurchargeStatus(s);

      if (statusFilter === 'ALL') {
        if (effStatus === 'ARCHIVED') return false;
      } else if (statusFilter !== effStatus && statusFilter !== s.status) {
        return false;
      }

      if (linkedProductFilter && !(s.linkedProductIds || []).includes(linkedProductFilter)) {
        return false;
      }

      if (destinationFilter !== 'ALL') {
        const matchesDest =
          s.destinationId === destinationFilter ||
          (s.linkedProductIds || []).some(pid => productMap.get(pid)?.destinationId === destinationFilter);
        if (!matchesDest) return false;
      }

      if (regionFilter !== 'ALL') {
        const matchesReg =
          s.regionId === regionFilter ||
          (s.linkedProductIds || []).some(pid => productMap.get(pid)?.regionId === regionFilter);
        if (!matchesReg) return false;
      }

      if (supplierFilter !== 'ALL') {
        const matchesSup =
          s.supplierId === supplierFilter ||
          s.supplierName === supplierFilter ||
          (s.linkedProductIds || []).some(pid => {
            const p = productMap.get(pid);
            return (p as any)?.supplierId === supplierFilter || p?.supplierName === supplierFilter;
          });
        if (!matchesSup) return false;
      }

      if (categoryFilter !== 'ALL') {
        const matchesCat = (s.linkedProductIds || []).some(pid => productMap.get(pid)?.category === categoryFilter);
        if (!matchesCat) return false;
      }

      if (surchargeTypeFilter !== 'ALL') {
        if (surchargeTypeFilter === 'FIXED' && s.calculationType !== 'FIXED') return false;
        if (surchargeTypeFilter === 'PERCENTAGE' && s.calculationType !== 'PERCENTAGE') return false;
        if (
          surchargeTypeFilter !== 'FIXED' &&
          surchargeTypeFilter !== 'PERCENTAGE' &&
          s.surchargeCategory !== surchargeTypeFilter &&
          s.pricingBasis !== surchargeTypeFilter
        ) {
          return false;
        }
      }

      if (periodFromFilter && s.validTo < periodFromFilter) return false;
      if (periodToFilter && s.validFrom > periodToFilter) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        const matchesBasic =
          s.name.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q) ||
          (s.destinationName || '').toLowerCase().includes(q) ||
          (s.supplierName || '').toLowerCase().includes(q) ||
          (s.internalDescription || '').toLowerCase().includes(q);

        const matchesProduct = (s.linkedProductIds || []).some(pid => {
          const p = productMap.get(pid);
          return (
            p &&
            (p.name.toLowerCase().includes(q) ||
              p.sku.toLowerCase().includes(q) ||
              p.id.toLowerCase().includes(q))
          );
        });

        if (!matchesBasic && !matchesProduct) return false;
      }

      return true;
    });
  }, [
    surcharges,
    statusFilter,
    linkedProductFilter,
    destinationFilter,
    regionFilter,
    supplierFilter,
    categoryFilter,
    surchargeTypeFilter,
    periodFromFilter,
    periodToFilter,
    searchTerm,
    productMap
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredSurcharges.length / pageSize));
  const paginatedSurcharges = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSurcharges.slice(start, start + pageSize);
  }, [filteredSurcharges, currentPage, pageSize]);

  // Distinct product categories & subcategories for selector filters
  const productCategories = useMemo(() => {
    return Array.from(new Set(products.map(p => p.category).filter(Boolean))).sort();
  }, [products]);

  const productSubcategories = useMemo(() => {
    return Array.from(
      new Set(
        products
          .filter(p => prodCategoryFilter === 'ALL' || p.category === prodCategoryFilter)
          .map(p => p.subcategory)
          .filter(Boolean)
      )
    ).sort();
  }, [products, prodCategoryFilter]);

  // Filtered products inside Section C (Product Selection & Mapping)
  const filteredCatalogProducts = useMemo(() => {
    return products.filter(p => {
      if (prodCategoryFilter !== 'ALL' && p.category !== prodCategoryFilter) return false;
      if (prodSubcategoryFilter !== 'ALL' && p.subcategory !== prodSubcategoryFilter) return false;
      if (prodDestinationFilter !== 'ALL' && p.destinationId !== prodDestinationFilter) return false;
      if (prodRegionFilter !== 'ALL' && p.regionId !== prodRegionFilter) return false;
      if (prodHubFilter !== 'ALL' && p.hubId !== prodHubFilter && p.city !== prodHubFilter) return false;
      if (
        prodSupplierFilter !== 'ALL' &&
        (p as any).supplierId !== prodSupplierFilter &&
        p.supplierName !== prodSupplierFilter
      ) {
        return false;
      }
      if (prodSearch.trim()) {
        const q = prodSearch.trim().toLowerCase();
        const hit =
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q) ||
          (p.city || '').toLowerCase().includes(q) ||
          (p.category || '').toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [
    products,
    prodCategoryFilter,
    prodSubcategoryFilter,
    prodDestinationFilter,
    prodRegionFilter,
    prodHubFilter,
    prodSupplierFilter,
    prodSearch
  ]);

  // Live conflict check while editing form
  const liveFormConflicts = useMemo(() => {
    if (viewMode !== 'FORM') return [];
    return detectCentralizedSurchargeConflicts(formData, surcharges, products);
  }, [viewMode, formData, surcharges, products]);

  const handleOpenCreate = () => {
    const newCode = generateSurchargeCode(surcharges);
    const defaultStart = '2026-04-01';
    const defaultEnd = '2026-04-15';
    setEditingSurcharge(null);
    setFormErrors([]);
    setFormWarnings([]);
    setSaveBanner(null);
    setFormData({
      id: `sur-${Date.now()}`,
      code: newCode,
      name: '',
      internalDescription: '',
      surchargeCategory: 'PEAK_SEASON',
      regionId: '',
      regionName: '',
      prefecture: '',
      destinationId: '',
      destinationName: '',
      touristArea: '',
      hubId: '',
      hubName: '',
      supplierId: '',
      supplierName: '',
      internalAdminNotes: '',
      status: 'ACTIVE',
      isActive: true,
      validFrom: defaultStart,
      validTo: defaultEnd,
      bookingValidFrom: '',
      bookingValidTo: '',
      timezone: 'Asia/Tokyo',
      periods: [
        {
          id: `win-${Date.now()}`,
          label: 'Primary Surcharge Period',
          travelValidFrom: defaultStart,
          travelValidTo: defaultEnd,
          bookingValidFrom: '',
          bookingValidTo: '',
          isActive: true
        }
      ],
      recurringDaysOfWeek: [],
      blackoutDates: [],
      allowStacking: false,
      priority: 1,
      linkedProductIds: linkedProductFilter ? [linkedProductFilter] : [],
      calculationType: 'FIXED',
      pricingBasis: 'PER_PERSON',
      amount: 0,
      percentage: 0,
      currency: 'JPY',
      passengerType: 'ALL',
      minPax: 1,
      maxPax: 99,
      minQuantity: 1,
      maxQuantity: 99,
      taxApplicable: true,
      taxPercent: 10,
      taxMethod: 'ON_MARGIN',
      supplierNettSurcharge: 0,
      buyerMarkupPercent: 20,
      b2bAgentMarkupPercent: 20,
      marginType: 'PERCENTAGE',
      marginValue: 20,
      serviceFeeType: 'NONE',
      serviceFeeValue: 0,
      roundingMode: 'STANDARD',
      inclusions: [],
      exclusions: [],
      importantInformation: '',
      operationalRestrictions: '',
      availability: 'INSTANT',
      bookingCutoffHours: 24,
      advanceBookingDaysRequired: 1,
      cancellationConditions: '',
      refundConditions: '',
      internalPricingNotes: '',
      version: 1
    });
    setViewMode('FORM');
  };

  const handleOpenEdit = (surcharge: SurchargeMaster) => {
    setEditingSurcharge(surcharge);
    setFormErrors([]);
    setFormWarnings([]);
    setSaveBanner(null);
    setFormData({
      ...surcharge,
      periods:
        surcharge.periods && surcharge.periods.length > 0
          ? surcharge.periods.map(p => ({ ...p }))
          : [
              {
                id: `win-${surcharge.id}-1`,
                label: 'Primary Surcharge Period',
                travelValidFrom: surcharge.validFrom,
                travelValidTo: surcharge.validTo,
                bookingValidFrom: surcharge.bookingValidFrom || '',
                bookingValidTo: surcharge.bookingValidTo || '',
                isActive: true
              }
            ],
      linkedProductIds: [...(surcharge.linkedProductIds || [])],
      inclusions: [...(surcharge.inclusions || [])],
      exclusions: [...(surcharge.exclusions || [])],
      blackoutDates: [...(surcharge.blackoutDates || [])],
      recurringDaysOfWeek: [...(surcharge.recurringDaysOfWeek || [])]
    });
    setViewMode('FORM');
  };

  const handleDuplicate = (surcharge: SurchargeMaster) => {
    const duplicated = db.duplicateSurchargeMaster(surcharge.id, user);
    if (duplicated) {
      setSurcharges(db.getSurchargeMasters(true));
      setSaveBanner(`Duplicated "${surcharge.name}" as Draft (${duplicated.code}).`);
      setTimeout(() => setSaveBanner(null), 4000);
    }
  };

  const handleArchive = (surcharge: SurchargeMaster) => {
    const archived = db.archiveSurchargeMaster(
      surcharge.id,
      user,
      `Archived centralized surcharge "${surcharge.name}" (${surcharge.code}) via Surcharge Management.`
    );
    if (archived) {
      setSurcharges(db.getSurchargeMasters(true));
      setSaveBanner(`Archived "${surcharge.name}" (${surcharge.code}). Historical quotation snapshots preserved.`);
      setTimeout(() => setSaveBanner(null), 4000);
    }
  };

  const handleSaveForm = (targetStatus?: SurchargeStatus) => {
    const candidate: Partial<SurchargeMaster> = {
      ...formData,
      status: targetStatus || formData.status || 'ACTIVE',
      isActive: (targetStatus || formData.status) !== 'INACTIVE' && (targetStatus || formData.status) !== 'ARCHIVED' && (targetStatus || formData.status) !== 'DRAFT'
    };

    // Sync primary validFrom / validTo with first period window if periods exist
    if (candidate.periods && candidate.periods.length > 0) {
      const firstWin = candidate.periods[0];
      candidate.validFrom = candidate.validFrom || firstWin.travelValidFrom;
      candidate.validTo = candidate.validTo || firstWin.travelValidTo;
    }

    const validation = validateSurchargeMaster(candidate, surcharges, products);
    setFormErrors(validation.errors);
    setFormWarnings((validation.overlapWarnings || []).map(w => w.message));

    if (!validation.isValid) {
      return;
    }

    const saved = db.saveSurchargeMaster(candidate as SurchargeMaster, user);
    setSurcharges(db.getSurchargeMasters(true));
    const dispCode = saved.surchargeCode || saved.code || saved.id;
    setSaveBanner(
      editingSurcharge
        ? `Updated centralized surcharge "${saved.name}" (${dispCode} · v${saved.version}).`
        : `Created centralized surcharge "${saved.name}" (${dispCode}) mapped to ${saved.linkedProductIds.length} product(s).`
    );
    setViewMode('LIST');
    setTimeout(() => setSaveBanner(null), 5000);
  };

  // Product Selection Helpers
  const selectedProductIdsSet = useMemo(
    () => new Set(formData.linkedProductIds || []),
    [formData.linkedProductIds]
  );

  const handleToggleProductSelection = (productId: string) => {
    const next = new Set(selectedProductIdsSet);
    if (next.has(productId)) {
      next.delete(productId);
    } else {
      next.add(productId);
    }
    setFormData(prev => ({ ...prev, linkedProductIds: Array.from(next) }));
  };

  const handleSelectAllFilteredProducts = () => {
    const next = new Set(selectedProductIdsSet);
    filteredCatalogProducts.forEach(p => next.add(p.id));
    setFormData(prev => ({ ...prev, linkedProductIds: Array.from(next) }));
  };

  const handleRemoveSelectedProduct = (productId: string) => {
    setFormData(prev => ({
      ...prev,
      linkedProductIds: (prev.linkedProductIds || []).filter(id => id !== productId)
    }));
  };

  const handleClearAllSelectedProducts = () => {
    setFormData(prev => ({ ...prev, linkedProductIds: [] }));
  };

  // Multi-Period Window Helpers
  const handleAddPeriodWindow = () => {
    const currentPeriods = formData.periods || [];
    const newWin: SurchargePeriodWindow = {
      id: `win-${Date.now()}-${currentPeriods.length + 1}`,
      label: `Period Window #${currentPeriods.length + 1}`,
      travelStartDate: formData.validFrom || '2026-05-01',
      travelEndDate: formData.validTo || '2026-05-10',
      bookingStartDate: formData.bookingValidFrom || '',
      bookingEndDate: formData.bookingValidTo || '',
      travelValidFrom: formData.validFrom || '2026-05-01',
      travelValidTo: formData.validTo || '2026-05-10',
      bookingValidFrom: formData.bookingValidFrom || '',
      bookingValidTo: formData.bookingValidTo || ''
    };
    setFormData(prev => ({
      ...prev,
      periods: [...currentPeriods, newWin]
    }));
  };

  const handleUpdatePeriodWindow = (idx: number, patch: Partial<SurchargePeriodWindow>) => {
    const nextPeriods = [...(formData.periods || [])];
    const prevWin = nextPeriods[idx] || ({} as SurchargePeriodWindow);
    const updated: SurchargePeriodWindow = {
      ...prevWin,
      ...patch,
      travelStartDate: patch.travelStartDate || patch.travelValidFrom || prevWin.travelStartDate || prevWin.travelValidFrom || '',
      travelEndDate: patch.travelEndDate || patch.travelValidTo || prevWin.travelEndDate || prevWin.travelValidTo || '',
      bookingStartDate: patch.bookingStartDate !== undefined ? patch.bookingStartDate : (patch.bookingValidFrom !== undefined ? patch.bookingValidFrom : prevWin.bookingStartDate),
      bookingEndDate: patch.bookingEndDate !== undefined ? patch.bookingEndDate : (patch.bookingValidTo !== undefined ? patch.bookingValidTo : prevWin.bookingEndDate),
      travelValidFrom: patch.travelValidFrom || patch.travelStartDate || prevWin.travelValidFrom || prevWin.travelStartDate || '',
      travelValidTo: patch.travelValidTo || patch.travelEndDate || prevWin.travelValidTo || prevWin.travelEndDate || '',
      bookingValidFrom: patch.bookingValidFrom !== undefined ? patch.bookingValidFrom : (patch.bookingStartDate !== undefined ? patch.bookingStartDate : prevWin.bookingValidFrom),
      bookingValidTo: patch.bookingValidTo !== undefined ? patch.bookingValidTo : (patch.bookingEndDate !== undefined ? patch.bookingEndDate : prevWin.bookingValidTo)
    };
    nextPeriods[idx] = updated;
    const patchRoot: Partial<SurchargeMaster> = { periods: nextPeriods };
    if (idx === 0) {
      if (updated.travelStartDate) patchRoot.validFrom = updated.travelStartDate;
      if (updated.travelEndDate) patchRoot.validTo = updated.travelEndDate;
      if (updated.bookingStartDate !== undefined) patchRoot.bookingValidFrom = updated.bookingStartDate;
      if (updated.bookingEndDate !== undefined) patchRoot.bookingValidTo = updated.bookingEndDate;
    }
    setFormData(prev => ({ ...prev, ...patchRoot }));
  };

  const handleRemovePeriodWindow = (idx: number) => {
    const nextPeriods = (formData.periods || []).filter((_, i) => i !== idx);
    setFormData(prev => ({ ...prev, periods: nextPeriods }));
  };

  // History records for modal
  const selectedHistoryRecords = useMemo(() => {
    if (!historyModalSurchargeId) return [];
    return db.getSurchargeHistory(historyModalSurchargeId);
  }, [historyModalSurchargeId, surcharges]);

  // ============================================================================
  // RENDER: CREATE / EDIT SURCHARGE COMPLETE CONFIGURATION WORKSPACE
  // ============================================================================
  if (viewMode === 'FORM') {
    const selectedProductsList = (formData.linkedProductIds || [])
      .map(id => productMap.get(id))
      .filter((p): p is Product => Boolean(p));

    return (
      <div className="space-y-6 pb-16">
        {/* Top Header */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <button
                type="button"
                onClick={() => setViewMode('LIST')}
                className="font-bold text-slate-700 hover:text-slate-950 flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Back to Surcharges Directory</span>
              </button>
              <span>·</span>
              <span className="font-mono font-bold text-[#008972]">{formData.code}</span>
              <span>·</span>
              <span>Version v{formData.version || 1}</span>
            </div>
            <h2 className="text-xl font-black text-slate-900">
              {editingSurcharge ? `Edit Surcharge: ${editingSurcharge.name}` : 'Create Centralized Surcharge Configuration'}
            </h2>
            <p className="text-xs text-slate-500">
              Configure travel and booking surcharge periods, commercial pricing rules, operational conditions, and linked inventory products.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('LIST')}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleSaveForm('DRAFT')}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold cursor-pointer"
            >
              Save as Draft
            </button>
            <button
              type="button"
              onClick={() => handleSaveForm(formData.status === 'DRAFT' ? 'ACTIVE' : (formData.status as SurchargeStatus) || 'ACTIVE')}
              className="px-5 py-2 rounded-xl bg-[#00C6A6] hover:bg-[#008972] text-slate-950 text-xs font-black shadow-xs cursor-pointer"
            >
              {editingSurcharge ? 'Save & Publish Updates' : 'Publish Surcharge Configuration'}
            </button>
          </div>
        </div>

        {/* Validation Errors & Conflict Warnings */}
        {formErrors.length > 0 && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-black text-rose-900">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Please resolve the following validation errors before publishing:</span>
            </div>
            <ul className="list-disc pl-5 text-xs text-rose-700 space-y-1">
              {formErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {(liveFormConflicts.length > 0 || formWarnings.length > 0) && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-black text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Overlapping Surcharge Period &amp; Inventory Governance Warnings ({liveFormConflicts.length})</span>
            </div>
            <ul className="list-disc pl-5 text-xs text-amber-800 space-y-1">
              {liveFormConflicts.map((c, idx) => (
                <li key={idx}>{c.message}</li>
              ))}
              {formWarnings
                .filter(w => !liveFormConflicts.some(c => c.message === w))
                .map((w, idx) => (
                  <li key={`w-${idx}`}>{w}</li>
                ))}
            </ul>
          </div>
        )}

        {/* SECTION A: BASIC INFORMATION */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5 shadow-2xs">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                A. Basic Information &amp; Geographic Scope
              </h3>
              <p className="text-xs text-slate-500">
                Define the surcharge name, unique system code, category classification, destination hierarchy, and supplier mapping.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-slate-500">
              System ID: {formData.code}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="md:col-span-2 space-y-1">
              <label className="font-bold text-slate-700">
                Surcharge Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Golden Week Peak Season Surcharge 2026"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00C6A6]"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Unique Surcharge ID</label>
              <input
                type="text"
                readOnly
                value={formData.code || ''}
                className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl font-mono font-bold text-slate-600"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">
                Surcharge Category / Type <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.surchargeCategory || 'PEAK_SEASON'}
                onChange={e => setFormData({ ...formData, surchargeCategory: e.target.value as SurchargeCategoryType })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900"
              >
                {SURCHARGE_CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Configuration Status</label>
              <select
                value={formData.status || 'ACTIVE'}
                onChange={e => {
                  const st = e.target.value as SurchargeStatus;
                  setFormData({
                    ...formData,
                    status: st,
                    isActive: st === 'ACTIVE' || st === 'SCHEDULED'
                  });
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900"
              >
                <option value="ACTIVE">Active (Live in Quote Engine)</option>
                <option value="SCHEDULED">Scheduled (Upcoming Period)</option>
                <option value="DRAFT">Draft (Internal Preparation)</option>
                <option value="INACTIVE">Inactive (Paused)</option>
                <option value="EXPIRED">Expired</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Master Region</label>
              <select
                value={formData.regionId || ''}
                onChange={e => {
                  const reg = regions.find(r => r.id === e.target.value);
                  setFormData({
                    ...formData,
                    regionId: reg?.id || '',
                    regionName: reg?.name || ''
                  });
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
              >
                <option value="">All Regions / Global</option>
                {regions.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Destination</label>
              <select
                value={formData.destinationId || ''}
                onChange={e => {
                  const dest = destinations.find(d => d.id === e.target.value);
                  setFormData({
                    ...formData,
                    destinationId: dest?.id || '',
                    destinationName: dest?.name || ''
                  });
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
              >
                <option value="">All Destinations</option>
                {destinations.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Prefecture / State</label>
              <input
                type="text"
                value={formData.prefecture || ''}
                onChange={e => setFormData({ ...formData, prefecture: e.target.value })}
                placeholder="e.g. Tokyo, Kyoto, Yamanashi"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Tourist Area / City Hub</label>
              <input
                type="text"
                value={formData.touristArea || ''}
                onChange={e => setFormData({ ...formData, touristArea: e.target.value })}
                placeholder="e.g. Hakone / Fuji Five Lakes / Arashiyama"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Supplier (Where Applicable)</label>
              <select
                value={formData.supplierId || ''}
                onChange={e => {
                  const sup = suppliers.find(s => s.id === e.target.value);
                  setFormData({
                    ...formData,
                    supplierId: sup?.id || '',
                    supplierName: sup?.companyName || ''
                  });
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
              >
                <option value="">All Suppliers / DMC Direct</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.companyName}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2 space-y-1">
              <label className="font-bold text-slate-700">Internal Description</label>
              <input
                type="text"
                value={formData.internalDescription || ''}
                onChange={e => setFormData({ ...formData, internalDescription: e.target.value })}
                placeholder="Concise operational summary of why and when this surcharge applies..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
              />
            </div>

            <div className="md:col-span-3 space-y-1">
              <label className="font-bold text-slate-700">Internal Admin Notes (Never exposed to customers/agents)</label>
              <textarea
                rows={2}
                value={formData.internalAdminNotes || ''}
                onChange={e => setFormData({ ...formData, internalAdminNotes: e.target.value })}
                placeholder="Contractual supplier tariff reference, tariff sheet date, or dispatch guidance..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
              />
            </div>
          </div>
        </div>

        {/* SECTION B: SURCHARGE PERIOD CONFIGURATION */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5 shadow-2xs">
          <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                B. Surcharge Period Configuration (Travel Dates vs. Booking Dates)
              </h3>
              <p className="text-xs text-slate-500">
                Configure single-date, date-range, multiple surcharge windows, recurring days of week, and stacking governance.
              </p>
            </div>

            <button
              type="button"
              onClick={handleAddPeriodWindow}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5 text-[#00E5C0]" />
              <span>Add Separate Date Window</span>
            </button>
          </div>

          {/* Travel Period vs Booking Period Explainer */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
            <div className="flex items-start gap-2.5">
              <Calendar className="w-4 h-4 text-[#008972] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-900 block">Travel Period (Required)</span>
                <span className="text-slate-600 text-[11px]">
                  The service/travel dates on which the customer actually uses the product or hotel stay.
                </span>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-900 block">Booking Period (Optional)</span>
                <span className="text-slate-600 text-[11px]">
                  The reservation/issuance dates during which the quotation or booking must be created for the surcharge to apply.
                </span>
              </div>
            </div>
          </div>

          {/* Primary Period & Timezone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">
                Effective Travel Start <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={formData.validFrom || ''}
                onChange={e => {
                  const val = e.target.value;
                  setFormData(prev => {
                    const nextPeriods = [...(prev.periods || [])];
                    if (nextPeriods[0]) nextPeriods[0] = { ...nextPeriods[0], travelValidFrom: val };
                    return { ...prev, validFrom: val, periods: nextPeriods };
                  });
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">
                Effective Travel End <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                min={formData.validFrom || undefined}
                value={formData.validTo || ''}
                onChange={e => {
                  const val = e.target.value;
                  setFormData(prev => {
                    const nextPeriods = [...(prev.periods || [])];
                    if (nextPeriods[0]) nextPeriods[0] = { ...nextPeriods[0], travelValidTo: val };
                    return { ...prev, validTo: val, periods: nextPeriods };
                  });
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Booking Start (Optional)</label>
              <input
                type="date"
                value={formData.bookingValidFrom || ''}
                onChange={e => setFormData({ ...formData, bookingValidFrom: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Booking End (Optional)</label>
              <input
                type="date"
                min={formData.bookingValidFrom || undefined}
                value={formData.bookingValidTo || ''}
                onChange={e => setFormData({ ...formData, bookingValidTo: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Destination Time Zone</label>
              <select
                value={formData.timezone || 'Asia/Tokyo'}
                onChange={e => setFormData({ ...formData, timezone: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
              >
                {TIMEZONE_OPTIONS.map(tz => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Multiple Separate Surcharge Periods List */}
          {(formData.periods || []).length > 1 && (
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-800">
                Multiple Separate Surcharge Date Windows ({(formData.periods || []).length})
              </label>
              <div className="space-y-2">
                {(formData.periods || []).map((win, idx) => (
                  <div
                    key={win.id || idx}
                    className="grid grid-cols-1 sm:grid-cols-6 gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 items-end text-xs"
                  >
                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-[10px] font-bold text-slate-500">Window Label</label>
                      <input
                        type="text"
                        value={win.label || ''}
                        onChange={e => handleUpdatePeriodWindow(idx, { label: e.target.value })}
                        placeholder="e.g. Autumn Foliage Peak Window"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500">Travel From *</label>
                      <input
                        type="date"
                        value={win.travelStartDate || win.travelValidFrom || ''}
                        onChange={e => handleUpdatePeriodWindow(idx, { travelStartDate: e.target.value, travelValidFrom: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500">Travel To *</label>
                      <input
                        type="date"
                        value={win.travelEndDate || win.travelValidTo || ''}
                        onChange={e => handleUpdatePeriodWindow(idx, { travelEndDate: e.target.value, travelValidTo: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500">Booking Cutoff</label>
                      <input
                        type="date"
                        value={win.bookingEndDate || win.bookingValidTo || ''}
                        onChange={e => handleUpdatePeriodWindow(idx, { bookingEndDate: e.target.value, bookingValidTo: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-mono"
                      />
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      {idx > 0 && (
                        <button
                          type="button"
                          onClick={() => handleRemovePeriodWindow(idx)}
                          className="p-2 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 cursor-pointer"
                          title="Remove Date Window"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recurring Days of Week & Stacking Governance */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-100 text-xs">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 block">
                Recurring Days of Week (Leave unselected for all days)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {DAY_NAMES.map((dayLabel, dayIdx) => {
                  const selected = (formData.recurringDaysOfWeek || []).includes(dayIdx);
                  return (
                    <button
                      key={dayLabel}
                      type="button"
                      onClick={() => {
                        const curr = formData.recurringDaysOfWeek || [];
                        const next = selected ? curr.filter(d => d !== dayIdx) : [...curr, dayIdx];
                        setFormData({ ...formData, recurringDaysOfWeek: next });
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border cursor-pointer transition-colors ${
                        selected
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {dayLabel}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 block">Blackout / Excluded Dates</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={newBlackoutDate}
                  onChange={e => setNewBlackoutDate(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newBlackoutDate) {
                      const curr = formData.blackoutDates || [];
                      if (!curr.includes(newBlackoutDate)) {
                        setFormData({ ...formData, blackoutDates: [...curr, newBlackoutDate] });
                      }
                      setNewBlackoutDate('');
                    }
                  }}
                  className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold cursor-pointer"
                >
                  Add
                </button>
              </div>
              {(formData.blackoutDates || []).length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {(formData.blackoutDates || []).map(bd => (
                    <span
                      key={bd}
                      className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded"
                    >
                      {bd}
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            blackoutDates: (formData.blackoutDates || []).filter(x => x !== bd)
                          })
                        }
                        className="text-slate-400 hover:text-rose-600 cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-800">Allow Overlap Stacking</label>
                <input
                  type="checkbox"
                  checked={Boolean(formData.allowStacking)}
                  onChange={e => setFormData({ ...formData, allowStacking: e.target.checked })}
                  className="rounded text-[#00C6A6] focus:ring-[#00C6A6]"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                When unchecked (recommended), overlapping surcharges on the same product will not silently double-charge; only the highest-priority surcharge applies.
              </p>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] font-semibold text-slate-700">Precedence Priority (1 = Highest)</span>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={formData.priority ?? 1}
                  onChange={e => setFormData({ ...formData, priority: Number(e.target.value) || 1 })}
                  className="w-16 px-2 py-1 bg-white border border-slate-200 rounded-lg text-center font-mono font-bold"
                />
              </div>
            </div>
          </div>
        </div>

        {/* SECTION C: PRODUCT SELECTION AND MAPPING */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5 shadow-2xs">
          <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                C. Product Selection &amp; Mapping ({selectedProductsList.length} Products Linked)
              </h3>
              <p className="text-xs text-slate-500">
                Filter and select all products from the Product Management database affected by this surcharge period. Stored as actual product ID references.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleSelectAllFilteredProducts}
                className="px-3 py-1.5 rounded-xl bg-[#00C6A6]/20 hover:bg-[#00C6A6]/30 text-[#008972] text-xs font-bold cursor-pointer"
              >
                Select All Filtered ({filteredCatalogProducts.length})
              </button>
              {selectedProductsList.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllSelectedProducts}
                  className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold cursor-pointer"
                >
                  Clear Selected ({selectedProductsList.length})
                </button>
              )}
            </div>
          </div>

          {/* Product Search and Multi-Dimensional Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div className="sm:col-span-2 relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={prodSearch}
                onChange={e => setProdSearch(e.target.value)}
                placeholder="Search by Product Name, SKU, or ID..."
                className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs"
              />
            </div>

            <select
              value={prodCategoryFilter}
              onChange={e => {
                setProdCategoryFilter(e.target.value);
                setProdSubcategoryFilter('ALL');
              }}
              className="px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-xs"
            >
              <option value="ALL">All Categories</option>
              {productCategories.map(cat => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <select
              value={prodSubcategoryFilter}
              onChange={e => setProdSubcategoryFilter(e.target.value)}
              className="px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-xs"
            >
              <option value="ALL">All Subcategories</option>
              {productSubcategories.map(sub => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>

            <select
              value={prodDestinationFilter}
              onChange={e => setProdDestinationFilter(e.target.value)}
              className="px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-xs"
            >
              <option value="ALL">All Destinations</option>
              {destinations.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>

            <select
              value={prodHubFilter}
              onChange={e => setProdHubFilter(e.target.value)}
              className="px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-xs"
            >
              <option value="ALL">All Prefectures / Hubs</option>
              {cityHubs.map(h => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>

          {/* Selectable Catalog Grid */}
          <div className="border border-slate-200 rounded-xl max-h-64 overflow-y-auto divide-y divide-slate-100">
            {filteredCatalogProducts.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No products match the current filter criteria.
              </div>
            ) : (
              filteredCatalogProducts.map(prod => {
                const isSelected = selectedProductIdsSet.has(prod.id);
                return (
                  <label
                    key={prod.id}
                    className={`flex items-center justify-between p-3 text-xs cursor-pointer transition-colors ${
                      isSelected ? 'bg-[#00C6A6]/10' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleProductSelection(prod.id)}
                        className="rounded text-[#00C6A6] focus:ring-[#00C6A6]"
                      />
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 truncate">{prod.name}</div>
                        <div className="text-[11px] text-slate-500">
                          <span className="font-mono font-semibold text-slate-700">{prod.sku}</span>
                          <span> · </span>
                          <span>{prod.category}</span>
                          <span> · </span>
                          <span>{prod.city || prod.destinationName || prod.country}</span>
                          {prod.supplierName && (
                            <>
                              <span> · </span>
                              <span>{prod.supplierName}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono font-bold text-slate-700">
                        {prod.currency} {(prod.adultNetPrice || 0).toLocaleString()}
                      </span>
                      <span
                        className={`text-[10px] font-bold ${
                          prod.status === 'ACTIVE' ? 'text-emerald-700' : 'text-amber-600'
                        }`}
                      >
                        {prod.status}
                      </span>
                    </div>
                  </label>
                );
              })
            )}
          </div>

          {/* Review Selected Products Table */}
          <div className="space-y-2 pt-2">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
              Review Selected Products ({selectedProductsList.length})
            </h4>
            {selectedProductsList.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                No products selected yet. Select at least one product above to link to this surcharge configuration.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="py-2.5 px-3">Product Name</th>
                      <th className="py-2.5 px-3">Product ID / SKU</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Destination</th>
                      <th className="py-2.5 px-3">Supplier</th>
                      <th className="py-2.5 px-3">Currency</th>
                      <th className="py-2.5 px-3">Current Status</th>
                      <th className="py-2.5 px-3">Surcharge Applicability</th>
                      <th className="py-2.5 px-3 text-right">Remove</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedProductsList.map(prod => (
                      <tr key={prod.id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3 font-bold text-slate-900">{prod.name}</td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                          {prod.sku} ({prod.id})
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">{prod.category}</td>
                        <td className="py-2.5 px-3 text-slate-700">
                          {prod.city || prod.destinationName || prod.country}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {prod.supplierName || 'Direct Contract'}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{prod.currency}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`font-bold text-[11px] ${
                              prod.status === 'ACTIVE' ? 'text-emerald-700' : 'text-rose-600'
                            }`}
                          >
                            {prod.status}
                            {prod.status !== 'ACTIVE' && ' (Review Required)'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-slate-700">
                          {(formData.pricingBasis || 'PER_PERSON').replace(/_/g, ' ')} · {formData.validFrom} → {formData.validTo}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveSelectedProduct(prod.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                            title="Unlink Product"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* SECTION D: SURCHARGE PRICING CONFIGURATION & REUSED PRODUCT OPERATIONAL FIELDS */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-2xs">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
              D. Surcharge Commercial Pricing, Margin, Tax &amp; Operational Rules
            </h3>
            <p className="text-xs text-slate-500">
              Uses the central pricing engine structure: supplier nett cost, B2B/Buyer markup, tax on margin/total, passenger/unit basis, and operational restrictions.
            </p>
          </div>

          {/* Primary Pricing Basis & Amount */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">
                Calculation Type <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.calculationType || 'FIXED'}
                onChange={e => {
                  const calcType = e.target.value as 'FIXED' | 'PERCENTAGE';
                  setFormData({
                    ...formData,
                    calculationType: calcType,
                    pricingBasis: calcType === 'PERCENTAGE' ? 'PERCENTAGE' : (formData.pricingBasis === 'PERCENTAGE' ? 'PER_PERSON' : formData.pricingBasis)
                  });
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
              >
                <option value="FIXED">Fixed Monetary Surcharge</option>
                <option value="PERCENTAGE">Percentage Surcharge (%)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">
                Pricing Basis <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.pricingBasis || 'PER_PERSON'}
                onChange={e => {
                  const basis = e.target.value as SurchargeApplicationBasis;
                  setFormData({
                    ...formData,
                    pricingBasis: basis,
                    calculationType: basis === 'PERCENTAGE' ? 'PERCENTAGE' : formData.calculationType
                  });
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900"
              >
                {PRICING_BASIS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {formData.calculationType === 'PERCENTAGE' ? (
              <div className="space-y-1">
                <label className="font-bold text-slate-700">
                  Surcharge Percentage (%) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min={0}
                  max={500}
                  step="0.5"
                  value={formData.percentage ?? formData.amount ?? 0}
                  onChange={e => {
                    const val = Number(e.target.value);
                    setFormData({ ...formData, percentage: val, amount: val });
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900"
                />
              </div>
            ) : (
              <div className="space-y-1">
                <label className="font-bold text-slate-700">
                  Selling Surcharge Amount <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={formData.amount ?? 0}
                  onChange={e => setFormData({ ...formData, amount: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900"
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="font-bold text-slate-700">
                Surcharge Currency (ISO 4217) <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.currency || 'JPY'}
                onChange={e => setFormData({ ...formData, currency: e.target.value as CurrencyCode })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900"
              >
                {CURRENCY_OPTIONS.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Passenger-Specific Amounts & Pax/Quantity Bounds */}
          <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-6 gap-4 text-xs pt-2 border-t border-slate-100">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">Adult Specific Amount</label>
              <input
                type="number"
                min={0}
                value={formData.adultAmount ?? ''}
                onChange={e =>
                  setFormData({
                    ...formData,
                    adultAmount: e.target.value === '' ? undefined : Number(e.target.value)
                  })
                }
                placeholder="Default to Amount"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Child Specific Amount</label>
              <input
                type="number"
                min={0}
                value={formData.childAmount ?? ''}
                onChange={e =>
                  setFormData({
                    ...formData,
                    childAmount: e.target.value === '' ? undefined : Number(e.target.value)
                  })
                }
                placeholder="Default to Amount"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Infant Specific Amount</label>
              <input
                type="number"
                min={0}
                value={formData.infantAmount ?? ''}
                onChange={e =>
                  setFormData({
                    ...formData,
                    infantAmount: e.target.value === '' ? undefined : Number(e.target.value)
                  })
                }
                placeholder="0"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Applicable Passenger Type</label>
              <select
                value={formData.passengerType || 'ALL'}
                onChange={e => setFormData({ ...formData, passengerType: e.target.value as any })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
              >
                <option value="ALL">All Chargeable Passengers</option>
                <option value="ADULT_AND_CHILD">Adults &amp; Children</option>
                <option value="ADULT_ONLY">Adults Only</option>
                <option value="CHILD_ONLY">Children Only</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Min / Max Pax</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  value={formData.minPax ?? 1}
                  onChange={e => setFormData({ ...formData, minPax: Number(e.target.value) })}
                  className="w-1/2 px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-center font-mono"
                />
                <input
                  type="number"
                  min={1}
                  value={formData.maxPax ?? 99}
                  onChange={e => setFormData({ ...formData, maxPax: Number(e.target.value) })}
                  className="w-1/2 px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-center font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Min / Max Quantity</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  value={formData.minQuantity ?? 1}
                  onChange={e => setFormData({ ...formData, minQuantity: Number(e.target.value) })}
                  className="w-1/2 px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-center font-mono"
                />
                <input
                  type="number"
                  min={1}
                  value={formData.maxQuantity ?? 99}
                  onChange={e => setFormData({ ...formData, maxQuantity: Number(e.target.value) })}
                  className="w-1/2 px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-center font-mono"
                />
              </div>
            </div>
          </div>

          {/* Commercial Nett Cost, Markup, Tax, Fee & Rounding (Reused from Product Management) */}
          <div className="bg-slate-900 text-white p-5 rounded-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#00E5C0]" />
                <span className="text-xs font-black uppercase tracking-wider">
                  Internal Commercial Cost, Markup, Tax &amp; Rounding Configuration
                </span>
              </div>
              <span className="text-[11px] text-slate-400">
                Internal fields are restricted to Admin/Staff and never exposed on customer quotes
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-6 gap-3 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] text-slate-300 font-semibold">Supplier Nett Surcharge</label>
                <input
                  type="number"
                  min={0}
                  value={formData.supplierNettSurcharge ?? 0}
                  onChange={e => setFormData({ ...formData, supplierNettSurcharge: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl font-mono text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-[#00E5C0] font-semibold">B2B Agent Markup %</label>
                <input
                  type="number"
                  min={0}
                  value={formData.b2bAgentMarkupPercent ?? 0}
                  onChange={e =>
                    setFormData({
                      ...formData,
                      b2bAgentMarkupPercent: Number(e.target.value),
                      marginValue: Number(e.target.value)
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl font-mono text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-slate-300 font-semibold">Buyer Markup %</label>
                <input
                  type="number"
                  min={0}
                  value={formData.buyerMarkupPercent ?? 0}
                  onChange={e => setFormData({ ...formData, buyerMarkupPercent: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl font-mono text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-slate-300 font-semibold">Tax Rate % &amp; Method</label>
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    min={0}
                    value={formData.taxPercent ?? 0}
                    onChange={e => setFormData({ ...formData, taxPercent: Number(e.target.value), taxApplicable: Number(e.target.value) > 0 })}
                    className="w-16 px-2 py-2 bg-slate-800 border border-slate-700 rounded-xl font-mono text-white text-center"
                  />
                  <select
                    value={formData.taxMethod || 'ON_MARGIN'}
                    onChange={e => setFormData({ ...formData, taxMethod: e.target.value as any })}
                    className="flex-1 px-2 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-[11px]"
                  >
                    <option value="ON_MARGIN">On Margin</option>
                    <option value="ON_TOTAL">On Total</option>
                    <option value="INCLUSIVE">Inclusive</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-slate-300 font-semibold">Service Fee</label>
                <div className="flex gap-1.5">
                  <select
                    value={formData.serviceFeeType || 'NONE'}
                    onChange={e => setFormData({ ...formData, serviceFeeType: e.target.value as any })}
                    className="w-20 px-2 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-[11px]"
                  >
                    <option value="NONE">None</option>
                    <option value="PERCENTAGE">%</option>
                    <option value="FIXED">Fixed</option>
                  </select>
                  <input
                    type="number"
                    min={0}
                    value={formData.serviceFeeValue ?? 0}
                    onChange={e => setFormData({ ...formData, serviceFeeValue: Number(e.target.value) })}
                    className="flex-1 px-2 py-2 bg-slate-800 border border-slate-700 rounded-xl font-mono text-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-slate-300 font-semibold">Rounding Policy</label>
                <select
                  value={formData.roundingMode || 'STANDARD'}
                  onChange={e => setFormData({ ...formData, roundingMode: e.target.value as any })}
                  className="w-full px-2.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-[11px]"
                >
                  <option value="STANDARD">Currency Standard (JPY 0 / INR 2)</option>
                  <option value="NEAREST_INTEGER">Nearest Integer</option>
                  <option value="NEAREST_10">Nearest 10</option>
                  <option value="NEAREST_100">Nearest 100</option>
                </select>
              </div>
            </div>
          </div>

          {/* Reused Product Operational & Policy Fields (Inclusions, Exclusions, Cutoff, Cancellation) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs pt-2">
            {/* Inclusions */}
            <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <label className="font-bold text-slate-800 block">Surcharge Inclusions</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newInclusion}
                  onChange={e => setNewInclusion(e.target.value)}
                  placeholder="e.g. Peak period priority dispatch & guaranteed allotment"
                  className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newInclusion.trim()) {
                      setFormData({
                        ...formData,
                        inclusions: [...(formData.inclusions || []), newInclusion.trim()]
                      });
                      setNewInclusion('');
                    }
                  }}
                  className="px-3 py-2 bg-slate-900 text-white rounded-lg font-bold cursor-pointer"
                >
                  Add
                </button>
              </div>
              <ul className="space-y-1 pt-1">
                {(formData.inclusions || []).map((inc, i) => (
                  <li key={i} className="flex items-center justify-between bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                    <span>{inc}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          inclusions: (formData.inclusions || []).filter((_, idx) => idx !== i)
                        })
                      }
                      className="text-slate-400 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Exclusions */}
            <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <label className="font-bold text-slate-800 block">Surcharge Exclusions</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newExclusion}
                  onChange={e => setNewExclusion(e.target.value)}
                  placeholder="e.g. Express highway tolls outside designated route"
                  className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newExclusion.trim()) {
                      setFormData({
                        ...formData,
                        exclusions: [...(formData.exclusions || []), newExclusion.trim()]
                      });
                      setNewExclusion('');
                    }
                  }}
                  className="px-3 py-2 bg-slate-900 text-white rounded-lg font-bold cursor-pointer"
                >
                  Add
                </button>
              </div>
              <ul className="space-y-1 pt-1">
                {(formData.exclusions || []).map((exc, i) => (
                  <li key={i} className="flex items-center justify-between bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                    <span>{exc}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          exclusions: (formData.exclusions || []).filter((_, idx) => idx !== i)
                        })
                      }
                      className="text-slate-400 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Availability &amp; Confirmation Mode</label>
              <select
                value={formData.availability || 'INSTANT'}
                onChange={e => setFormData({ ...formData, availability: e.target.value as any })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
              >
                <option value="INSTANT">Instant Confirmation</option>
                <option value="ON_REQUEST">On Request (Subject to Peak Allocation)</option>
                <option value="LIMITED">Limited Peak Quota</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Booking Cutoff (Hours)</label>
                <input
                  type="number"
                  min={0}
                  value={formData.bookingCutoffHours ?? 24}
                  onChange={e => setFormData({ ...formData, bookingCutoffHours: Number(e.target.value) })}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Advance Days Required</label>
                <input
                  type="number"
                  min={0}
                  value={formData.advanceBookingDaysRequired ?? 1}
                  onChange={e => setFormData({ ...formData, advanceBookingDaysRequired: Number(e.target.value) })}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Important Information / Operational Restrictions</label>
              <textarea
                rows={2}
                value={formData.importantInformation || ''}
                onChange={e =>
                  setFormData({
                    ...formData,
                    importantInformation: e.target.value,
                    operationalRestrictions: e.target.value
                  })
                }
                placeholder="Peak period operational terms, minimum notice, or check-in rules..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Cancellation &amp; Refund Conditions</label>
              <textarea
                rows={2}
                value={formData.cancellationConditions || ''}
                onChange={e => setFormData({ ...formData, cancellationConditions: e.target.value })}
                placeholder="e.g. Non-refundable within 14 days of peak travel date..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>

            <div className="md:col-span-2 space-y-1">
              <label className="font-bold text-slate-700">Internal Pricing Notes</label>
              <input
                type="text"
                value={formData.internalPricingNotes || ''}
                onChange={e => setFormData({ ...formData, internalPricingNotes: e.target.value })}
                placeholder="Internal finance notes on FX conversion or supplier contract addendum..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // RENDER: CENTRALIZED SURCHARGE DASHBOARD & DIRECTORY LISTING
  // ============================================================================
  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-2xs">
        <div className="space-y-1">
          <div className="text-xs font-bold uppercase tracking-wider text-[#008972]">
            Finance &amp; Administration · Centralized Surcharge Governance
          </div>
          <h1 className="text-2xl font-black text-slate-900">Surcharge Management</h1>
          <p className="text-xs text-slate-500 max-w-3xl">
            Create and govern seasonal, holiday, weekend, and operational surcharge periods centrally. Map affected products once and automatically apply verified surcharge calculations across B2B Quote Builder, PDF, Email, and WhatsApp.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setHistoryModalSurchargeId('ALL')}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
          >
            <History className="w-4 h-4 text-slate-500" />
            <span>Version &amp; Audit History</span>
          </button>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="px-5 py-2.5 rounded-xl bg-[#00C6A6] hover:bg-[#008972] text-slate-950 text-xs font-black flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Surcharge</span>
          </button>
        </div>
      </div>

      {saveBanner && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{saveBanner}</span>
          </div>
          <button type="button" onClick={() => setSaveBanner(null)} className="text-emerald-700 hover:text-emerald-950">
            ×
          </button>
        </div>
      )}

      {/* Surcharge Dashboard — 7 Real Operational Metrics from Firestore */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 block">Total Configurations</span>
          <span className="text-2xl font-black font-mono text-slate-900">
            {dashboardMetrics.totalConfigurations}
          </span>
          <span className="text-[10px] text-slate-400 block">Central master records</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1 shadow-2xs">
          <span className="text-[11px] font-semibold text-emerald-700 block">Active Periods</span>
          <span className="text-2xl font-black font-mono text-emerald-700">
            {dashboardMetrics.activePeriods}
          </span>
          <span className="text-[10px] text-slate-400 block">Currently in effect</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1 shadow-2xs">
          <span className="text-[11px] font-semibold text-blue-700 block">Upcoming Periods</span>
          <span className="text-2xl font-black font-mono text-blue-700">
            {dashboardMetrics.upcomingPeriods}
          </span>
          <span className="text-[10px] text-slate-400 block">Scheduled future windows</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-600 block">Expired Periods</span>
          <span className="text-2xl font-black font-mono text-slate-600">
            {dashboardMetrics.expiredPeriods}
          </span>
          <span className="text-[10px] text-slate-400 block">Historical preserved</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1 shadow-2xs">
          <span className="text-[11px] font-semibold text-amber-700 block">Draft Configs</span>
          <span className="text-2xl font-black font-mono text-amber-700">
            {dashboardMetrics.draftConfigurations}
          </span>
          <span className="text-[10px] text-slate-400 block">Not applied to quotes</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1 shadow-2xs">
          <span className="text-[11px] font-semibold text-[#008972] block">Affected Products</span>
          <span className="text-2xl font-black font-mono text-[#008972]">
            {dashboardMetrics.affectedProductsCount}
          </span>
          <span className="text-[10px] text-slate-400 block">Mapped to surcharges</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-600 block">Products w/o Surcharge</span>
          <span className="text-2xl font-black font-mono text-slate-800">
            {dashboardMetrics.productsWithoutSurchargesCount}
          </span>
          <span className="text-[10px] text-slate-400 block">Standard base tariff only</span>
        </div>
      </div>

      {/* Inactive Linked Products Alert */}
      {inactiveLinkedProductAlerts.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs space-y-1">
          <div className="font-bold text-amber-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              {inactiveLinkedProductAlerts.length} linked product(s) are currently marked non-active and flagged for review:
            </span>
          </div>
          <div className="text-[11px] text-amber-800 pl-6">
            {inactiveLinkedProductAlerts.slice(0, 4).map((a, i) => (
              <span key={i} className="mr-4">
                {a.surchargeCode}: {a.productName} ({a.productSku} — {a.productStatus})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Search & Multi-Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-2xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by Surcharge Name, ID (SUR-...), Product Name/SKU, Destination, or Supplier..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00C6A6]"
            />
          </div>

          <select
            value={statusFilter}
            onChange={e => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700"
          >
            <option value="ALL">Status: All Non-Archived</option>
            <option value="ACTIVE">Active</option>
            <option value="SCHEDULED">Scheduled (Upcoming)</option>
            <option value="DRAFT">Draft</option>
            <option value="EXPIRED">Expired</option>
            <option value="INACTIVE">Inactive</option>
            <option value="ARCHIVED">Archived</option>
          </select>

          <select
            value={surchargeTypeFilter}
            onChange={e => {
              setSurchargeTypeFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700"
          >
            <option value="ALL">All Surcharge Types</option>
            <option value="FIXED">Fixed Amount</option>
            <option value="PERCENTAGE">Percentage (%)</option>
            {SURCHARGE_CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs pt-1">
          <select
            value={categoryFilter}
            onChange={e => {
              setCategoryFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700"
          >
            <option value="ALL">All Product Categories</option>
            {productCategories.map(cat => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <select
            value={destinationFilter}
            onChange={e => {
              setDestinationFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700"
          >
            <option value="ALL">All Destinations</option>
            {destinations.map(d => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          <select
            value={regionFilter}
            onChange={e => {
              setRegionFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700"
          >
            <option value="ALL">All Regions</option>
            {regions.map(r => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>

          <select
            value={supplierFilter}
            onChange={e => {
              setSupplierFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700"
          >
            <option value="ALL">All Suppliers</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>
                {s.companyName}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400 shrink-0">From:</span>
            <input
              type="date"
              value={periodFromFilter}
              onChange={e => {
                setPeriodFromFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400 shrink-0">To:</span>
            <input
              type="date"
              value={periodToFilter}
              onChange={e => {
                setPeriodToFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
            />
          </div>
        </div>

        {linkedProductFilter && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-600">
              Filtered by Product:{' '}
              <strong className="text-slate-900">
                {productMap.get(linkedProductFilter)?.name || linkedProductFilter}
              </strong>
            </span>
            <button
              type="button"
              onClick={() => setLinkedProductFilter('')}
              className="text-rose-600 hover:underline font-bold cursor-pointer"
            >
              Clear Product Filter
            </button>
          </div>
        )}
      </div>

      {/* Surcharge Listing Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4">Surcharge Name</th>
                <th className="py-3.5 px-4">Surcharge ID</th>
                <th className="py-3.5 px-4">Period Start</th>
                <th className="py-3.5 px-4">Period End</th>
                <th className="py-3.5 px-4">Affected Products</th>
                <th className="py-3.5 px-4">Surcharge Type</th>
                <th className="py-3.5 px-4">Amount</th>
                <th className="py-3.5 px-4">Currency</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Last Updated</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedSurcharges.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    No surcharge configurations match the current filters.
                  </td>
                </tr>
              ) : (
                paginatedSurcharges.map(s => {
                  const effStatus = resolveEffectiveSurchargeStatus(s);
                  const linkedCount = (s.linkedProductIds || []).length;
                  const sampleProducts = (s.linkedProductIds || [])
                    .slice(0, 2)
                    .map(pid => productMap.get(pid)?.name || pid);

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{s.name}</div>
                        <div className="text-[11px] text-slate-500">
                          {s.destinationName || 'Multi-Destination'}
                          {s.prefecture ? ` · ${s.prefecture}` : ''}
                          {s.supplierName ? ` · ${s.supplierName}` : ''}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                        {s.code}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-700">
                        {s.validFrom}
                        {s.bookingValidFrom && (
                          <span className="block text-[10px] text-slate-400">
                            Book ≥ {s.bookingValidFrom}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-700">
                        {s.validTo}
                        {s.bookingValidTo && (
                          <span className="block text-[10px] text-slate-400">
                            Book ≤ {s.bookingValidTo}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">
                          {linkedCount} {linkedCount === 1 ? 'Product' : 'Products'}
                        </div>
                        {sampleProducts.length > 0 && (
                          <div className="text-[11px] text-slate-500 truncate max-w-[200px]">
                            {sampleProducts.join(', ')}
                            {linkedCount > 2 ? ` +${linkedCount - 2} more` : ''}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">
                          {s.calculationType === 'PERCENTAGE' ? 'Percentage' : 'Fixed'} ·{' '}
                          {s.pricingBasis.replace(/_/g, ' ')}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {s.surchargeCategory.replace(/_/g, ' ')}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {s.calculationType === 'PERCENTAGE'
                          ? `${s.percentage ?? s.amount}%`
                          : Number(s.amount || 0).toLocaleString()}
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                        {s.currency}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`font-bold text-xs ${
                            effStatus === 'ACTIVE'
                              ? 'text-emerald-700'
                              : effStatus === 'SCHEDULED'
                                ? 'text-blue-700'
                                : effStatus === 'DRAFT'
                                  ? 'text-amber-700'
                                  : effStatus === 'EXPIRED'
                                    ? 'text-slate-500'
                                    : 'text-rose-700'
                          }`}
                        >
                          {effStatus}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-[11px] text-slate-500">
                        {s.updatedAt ? new Date(s.updatedAt).toLocaleDateString() : '—'}
                        <span className="block text-[10px] text-slate-400">v{s.version || 1}</span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setInspectingSurcharge(s)}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                            title="View Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(s)}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-[#008972] hover:bg-teal-50 cursor-pointer"
                            title="Edit Surcharge"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDuplicate(s)}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-blue-700 hover:bg-blue-50 cursor-pointer"
                            title="Duplicate Surcharge"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          {s.status !== 'ARCHIVED' && (
                            <button
                              type="button"
                              onClick={() => handleArchive(s)}
                              className="p-1.5 rounded-lg text-slate-600 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                              title="Archive Surcharge (Preserves Historical Snapshots)"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="text-slate-500">
            Showing{' '}
            <strong>
              {filteredSurcharges.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}–
              {Math.min(currentPage * pageSize, filteredSurcharges.length)}
            </strong>{' '}
            of <strong>{filteredSurcharges.length}</strong> surcharge configurations
          </div>

          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={e => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs"
            >
              <option value={10}>10 / page</option>
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
            </select>

            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="font-semibold text-slate-700 px-2">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* VIEW SURCHARGE DETAILS MODAL */}
      {inspectingSurcharge && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 shadow-2xl">
            <div className="p-5 bg-slate-900 text-white flex items-start justify-between">
              <div className="space-y-1">
                <div className="text-xs text-[#00E5C0] font-mono">
                  {inspectingSurcharge.code} · {resolveEffectiveSurchargeStatus(inspectingSurcharge)} · v{inspectingSurcharge.version || 1}
                </div>
                <h3 className="text-lg font-black">{inspectingSurcharge.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectingSurcharge(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[10px]">Travel Period</span>
                  <strong className="font-mono text-slate-900">
                    {inspectingSurcharge.validFrom} → {inspectingSurcharge.validTo}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Booking Window</span>
                  <strong className="font-mono text-slate-900">
                    {inspectingSurcharge.bookingValidFrom || inspectingSurcharge.bookingValidTo
                      ? `${inspectingSurcharge.bookingValidFrom || 'Any'} → ${inspectingSurcharge.bookingValidTo || 'Any'}`
                      : 'All Booking Dates'}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Pricing Basis</span>
                  <strong className="text-slate-900">
                    {inspectingSurcharge.pricingBasis.replace(/_/g, ' ')}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Configured Rate</span>
                  <strong className="font-mono text-[#008972] text-sm">
                    {inspectingSurcharge.calculationType === 'PERCENTAGE'
                      ? `${inspectingSurcharge.percentage ?? inspectingSurcharge.amount}%`
                      : `${inspectingSurcharge.currency} ${Number(inspectingSurcharge.amount || 0).toLocaleString()}`}
                  </strong>
                </div>
              </div>

              {inspectingSurcharge.internalDescription && (
                <div>
                  <span className="font-bold text-slate-700 block mb-1">Description</span>
                  <p className="text-slate-600">{inspectingSurcharge.internalDescription}</p>
                </div>
              )}

              <div>
                <span className="font-bold text-slate-800 block mb-2">
                  Affected Products ({inspectingSurcharge.linkedProductIds.length})
                </span>
                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
                  {inspectingSurcharge.linkedProductIds.map(pid => {
                    const p = productMap.get(pid);
                    return (
                      <div key={pid} className="p-2.5 flex items-center justify-between">
                        <div>
                          <div className="font-bold text-slate-900">{p?.name || pid}</div>
                          <div className="text-[11px] text-slate-500">
                            {p?.sku || pid} · {p?.category || 'Product'} · {p?.city || p?.destinationName || ''}
                          </div>
                        </div>
                        <span className="font-mono font-bold text-slate-700">
                          {p?.currency || inspectingSurcharge.currency}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const id = inspectingSurcharge.id;
                  setInspectingSurcharge(null);
                  setHistoryModalSurchargeId(id);
                }}
                className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer flex items-center gap-1.5"
              >
                <History className="w-3.5 h-3.5" />
                <span>View Version History</span>
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const target = inspectingSurcharge;
                    setInspectingSurcharge(null);
                    handleOpenEdit(target);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#00C6A6] text-slate-950 text-xs font-black cursor-pointer"
                >
                  Edit Surcharge
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VERSION & AUDIT HISTORY MODAL */}
      {historyModalSurchargeId && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[88vh] flex flex-col overflow-hidden border border-slate-200 shadow-2xl">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-black">Centralized Surcharge Version &amp; Audit Log</h3>
                <p className="text-xs text-slate-400">
                  Tracks all creation, modification, product remapping, archiving, and quotation override events.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryModalSurchargeId(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3 text-xs flex-1">
              {(historyModalSurchargeId === 'ALL' ? db.getSurchargeHistory() : selectedHistoryRecords).length === 0 ? (
                <div className="py-10 text-center text-slate-400">
                  No surcharge audit history entries recorded yet.
                </div>
              ) : (
                (historyModalSurchargeId === 'ALL' ? db.getSurchargeHistory() : selectedHistoryRecords).map(rec => (
                  <div key={rec.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">
                        {rec.surchargeName} ({rec.surchargeCode}) · v{rec.version} · {rec.action}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500">
                        {new Date(rec.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-slate-600">{rec.changeSummary}</p>
                    <div className="text-[11px] text-slate-400">
                      Actor: {rec.actorName} ({rec.actorRole})
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
