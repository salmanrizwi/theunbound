import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  History,
  Layers,
  Lock,
  Percent,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldAlert,
  Sliders,
  X
} from 'lucide-react';
import {
  CurrencyCode,
  Destination,
  MarginConfigurationStatus,
  ProductMarginAuditRecord
} from '../../types';
import { AppDatabase } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { PRODUCT_CMS_CATEGORIES } from '../../services/configuratorRegistry';
import { formatCurrency } from '../../services/pricingEngine';
import {
  BulkMarginSaveResponse,
  canUserManageMargins,
  fetchMarginGovernanceFromServer,
  fetchProductMarginDetailFromServer,
  MarginGovernanceFilterParams,
  MarginGovernanceRow,
  MarginGovernanceSummary,
  previewB2BSellingPriceForProduct,
  queryLocalMarginGovernanceCatalog,
  saveProductMargin,
  bulkSaveProductMargins,
  validateMarginGovernanceInput
} from '../../services/marginGovernanceService';

interface MarginCommissionGovernanceViewProps {
  destinations: Destination[];
}

type EditorSaveState = 'IDLE' | 'UNSAVED' | 'SAVING' | 'SAVED' | 'FAILED' | 'CONFLICT';

export const MarginCommissionGovernanceView: React.FC<MarginCommissionGovernanceViewProps> = ({
  destinations
}) => {
  const db = AppDatabase.getInstance();
  const { user } = useAuth();
  const rbac = useMemo(() => canUserManageMargins(user), [user]);

  // Discovery & Filter State
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [destinationFilter, setDestinationFilter] = useState('ALL');
  const [regionFilter, setRegionFilter] = useState('ALL');
  const [hubFilter, setHubFilter] = useState('ALL');
  const [supplierFilter, setSupplierFilter] = useState('ALL');
  const [productStatusFilter, setProductStatusFilter] = useState('ALL');
  const [marginStatusFilter, setMarginStatusFilter] = useState<'ALL' | MarginConfigurationStatus>('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Catalog & Data State
  const [loading, setLoading] = useState(false);
  const [catalogRevision, setCatalogRevision] = useState(0);
  const [rows, setRows] = useState<MarginGovernanceRow[]>([]);
  const [summary, setSummary] = useState<MarginGovernanceSummary>({
    totalProducts: 0,
    configuredCount: 0,
    unconfiguredCount: 0,
    inactiveCount: 0,
    recentlyUpdatedCount: 0
  });
  const [totalFiltered, setTotalFiltered] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [dataSourceLabel, setDataSourceLabel] = useState<'FIRESTORE_API' | 'LOCAL_SYNC'>('LOCAL_SYNC');

  // Master Reference Lists
  const [regions, setRegions] = useState(() => db.getRegions());
  const [cityHubs, setCityHubs] = useState(() => db.getCityHubs());
  const [suppliers, setSuppliers] = useState(() => db.getSuppliers());

  // Agency Mode Status Note
  const [agencyPricingMode, setAgencyPricingMode] = useState(() => db.resolveAgencyPricingSettings());

  // Multi-select Bulk Selection Map (preserves selection across pagination)
  const [selectedRowsMap, setSelectedRowsMap] = useState<Record<string, MarginGovernanceRow>>({});

  // Individual Editor State
  const [activeRow, setActiveRow] = useState<MarginGovernanceRow | null>(null);
  const [editMarginType, setEditMarginType] = useState<'PERCENTAGE' | 'FIXED'>('PERCENTAGE');
  const [editMarginValueStr, setEditMarginValueStr] = useState<string>('');
  const [editCommissionStr, setEditCommissionStr] = useState<string>('0');
  const [editStatus, setEditStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [editReason, setEditReason] = useState<string>('');
  const [editorSaveState, setEditorSaveState] = useState<EditorSaveState>('IDLE');
  const [editorStatusMessage, setEditorStatusMessage] = useState<string | null>(null);
  const [conflictInfo, setConflictInfo] = useState<{ currentVersion?: number; message: string } | null>(null);
  const [confirmLargeChangeRequired, setConfirmLargeChangeRequired] = useState(false);
  const [confirmLargeChangeChecked, setConfirmLargeChangeChecked] = useState(false);
  const [productAuditLogs, setProductAuditLogs] = useState<ProductMarginAuditRecord[]>([]);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false);

  // Bulk Configuration Modal State
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkMarginType, setBulkMarginType] = useState<'PERCENTAGE' | 'FIXED'>('PERCENTAGE');
  const [bulkMarginValueStr, setBulkMarginValueStr] = useState<string>('');
  const [bulkApplyCommission, setBulkApplyCommission] = useState(false);
  const [bulkCommissionStr, setBulkCommissionStr] = useState<string>('0');
  const [bulkStatus, setBulkStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [bulkReason, setBulkReason] = useState<string>('');
  const [bulkConfirmChecked, setBulkConfirmChecked] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkMarginSaveResponse | null>(null);

  // Global Recent Audit Log Drawer
  const [showRecentAuditDrawer, setShowRecentAuditDrawer] = useState(false);
  const [recentAuditLogs, setRecentAuditLogs] = useState<ProductMarginAuditRecord[]>([]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 180);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Subscribe to Firestore + AppDatabase collections
  useEffect(() => {
    const unsubProd = db.ensureCollectionSynced('products', 'products');
    const unsubCfg = db.ensureCollectionSynced('product_margin_configs', 'product_margin_configs');
    const unsubAudit = db.ensureCollectionSynced('product_margin_audit_logs', 'product_margin_audit_logs');
    const unsubStore = db.subscribeToCollections(
      ['products', 'product_margin_configs', 'product_margin_audit_logs', 'regions', 'city_hubs', 'suppliers', 'agency_pricing_settings'],
      () => {
        setRegions(db.getRegions());
        setCityHubs(db.getCityHubs());
        setSuppliers(db.getSuppliers());
        setAgencyPricingMode(db.resolveAgencyPricingSettings());
        setRecentAuditLogs(db.getProductMarginAuditLogs().slice(0, 40));
        setCatalogRevision((r) => r + 1);
      }
    );
    setRecentAuditLogs(db.getProductMarginAuditLogs().slice(0, 40));
    return () => {
      unsubProd();
      unsubCfg();
      unsubAudit();
      unsubStore();
    };
  }, [db]);

  const filters: MarginGovernanceFilterParams = useMemo(
    () => ({
      search: debouncedSearch,
      category: categoryFilter,
      destinationId: destinationFilter,
      regionId: regionFilter,
      hubId: hubFilter,
      supplierId: supplierFilter,
      productStatus: productStatusFilter,
      marginStatus: marginStatusFilter,
      page,
      pageSize
    }),
    [
      debouncedSearch,
      categoryFilter,
      destinationFilter,
      regionFilter,
      hubFilter,
      supplierFilter,
      productStatusFilter,
      marginStatusFilter,
      page,
      pageSize
    ]
  );

  const loadCatalog = useCallback(
    async (preferServer: boolean) => {
      // Immediate local render so UI stays crisp
      const localRes = queryLocalMarginGovernanceCatalog(filters);
      setSummary(localRes.summary);
      setRows(localRes.rows);
      setTotalFiltered(localRes.totalFiltered);
      setTotalPages(localRes.totalPages);
      setDataSourceLabel('LOCAL_SYNC');

      if (!preferServer) return;
      setLoading(true);
      try {
        const serverRes = await fetchMarginGovernanceFromServer(filters);
        if (serverRes) {
          setSummary(serverRes.summary);
          setRows(serverRes.rows);
          setTotalFiltered(serverRes.totalFiltered);
          setTotalPages(serverRes.totalPages);
          setDataSourceLabel('FIRESTORE_API');
        }
      } finally {
        setLoading(false);
      }
    },
    [filters]
  );

  useEffect(() => {
    void loadCatalog(true);
  }, [loadCatalog, catalogRevision]);

  const availableRegions = useMemo(
    () => (destinationFilter === 'ALL' ? regions : regions.filter((r) => r.destinationId === destinationFilter)),
    [regions, destinationFilter]
  );

  const availableHubs = useMemo(
    () =>
      cityHubs.filter((h) => {
        const matchDest = destinationFilter === 'ALL' || h.destinationId === destinationFilter;
        const matchReg = regionFilter === 'ALL' || h.regionId === regionFilter;
        return matchDest && matchReg;
      }),
    [cityHubs, destinationFilter, regionFilter]
  );

  const resetAllFilters = () => {
    setSearchInput('');
    setDebouncedSearch('');
    setCategoryFilter('ALL');
    setDestinationFilter('ALL');
    setRegionFilter('ALL');
    setHubFilter('ALL');
    setSupplierFilter('ALL');
    setProductStatusFilter('ALL');
    setMarginStatusFilter('ALL');
    setPage(1);
  };

  // Selection helpers
  const selectedIds = useMemo(() => Object.keys(selectedRowsMap), [selectedRowsMap]);
  const selectedRowsList = useMemo(() => Object.values(selectedRowsMap), [selectedRowsMap]);
  const allPageSelected = rows.length > 0 && rows.every((r) => Boolean(selectedRowsMap[r.product.id]));

  const toggleRowSelection = (row: MarginGovernanceRow) => {
    setSelectedRowsMap((prev) => {
      const next = { ...prev };
      if (next[row.product.id]) {
        delete next[row.product.id];
      } else {
        next[row.product.id] = row;
      }
      return next;
    });
  };

  const toggleSelectAllCurrentPage = () => {
    setSelectedRowsMap((prev) => {
      const next = { ...prev };
      if (allPageSelected) {
        rows.forEach((r) => delete next[r.product.id]);
      } else {
        rows.forEach((r) => {
          next[r.product.id] = r;
        });
      }
      return next;
    });
  };

  // Open Individual Margin Editor
  const openEditorForRow = async (row: MarginGovernanceRow) => {
    setActiveRow(row);
    setEditMarginType(row.effectiveMarginType);
    setEditMarginValueStr(row.effectiveMarginValue !== null ? String(row.effectiveMarginValue) : '');
    setEditCommissionStr(String(row.commissionPercent ?? 0));
    setEditStatus(row.configStatus === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE');
    setEditReason('');
    setEditorSaveState('IDLE');
    setEditorStatusMessage(null);
    setConflictInfo(null);
    setConfirmLargeChangeRequired(false);
    setConfirmLargeChangeChecked(false);
    setProductAuditLogs(db.getProductMarginAuditLogs(row.product.id));

    setLoadingAuditLogs(true);
    try {
      const serverDetail = await fetchProductMarginDetailFromServer(row.product.id);
      if (serverDetail) {
        if (serverDetail.auditLogs) {
          setProductAuditLogs(serverDetail.auditLogs);
        }
        if (serverDetail.product) {
          const fresh = queryLocalMarginGovernanceCatalog({ search: row.product.id, pageSize: 10 }).rows.find(
            (r) => r.product.id === row.product.id
          );
          if (fresh) {
            setActiveRow(fresh);
            setEditMarginType(fresh.effectiveMarginType);
            setEditMarginValueStr(fresh.effectiveMarginValue !== null ? String(fresh.effectiveMarginValue) : '');
            setEditCommissionStr(String(fresh.commissionPercent ?? 0));
            setEditStatus(fresh.configStatus === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE');
          }
        }
      }
    } finally {
      setLoadingAuditLogs(false);
    }
  };

  const resetEditorToLastSaved = () => {
    if (!activeRow) return;
    setEditMarginType(activeRow.effectiveMarginType);
    setEditMarginValueStr(activeRow.effectiveMarginValue !== null ? String(activeRow.effectiveMarginValue) : '');
    setEditCommissionStr(String(activeRow.commissionPercent ?? 0));
    setEditStatus(activeRow.configStatus === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE');
    setEditReason('');
    setEditorSaveState('IDLE');
    setEditorStatusMessage(null);
    setConflictInfo(null);
    setConfirmLargeChangeRequired(false);
    setConfirmLargeChangeChecked(false);
  };

  // Real-time validation & preview in Individual Editor
  const editValidation = useMemo(
    () =>
      validateMarginGovernanceInput({
        marginType: editMarginType,
        marginValue: editMarginValueStr,
        commissionPercent: editCommissionStr
      }),
    [editMarginType, editMarginValueStr, editCommissionStr]
  );

  const editPreviewSellingPrice = useMemo(() => {
    if (!activeRow || !editValidation.valid || editValidation.marginValue === undefined) return null;
    return previewB2BSellingPriceForProduct({
      product: activeRow.product,
      marginType: editValidation.marginType,
      marginValue: editValidation.marginValue,
      status: editStatus
    });
  }, [activeRow, editValidation, editStatus]);

  const hasUnsavedEditorChanges = useMemo(() => {
    if (!activeRow) return false;
    const savedVal = activeRow.effectiveMarginValue !== null ? String(activeRow.effectiveMarginValue) : '';
    const savedComm = String(activeRow.commissionPercent ?? 0);
    const savedStatus = activeRow.configStatus === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
    return (
      editMarginType !== activeRow.effectiveMarginType ||
      editMarginValueStr.trim() !== savedVal ||
      editCommissionStr.trim() !== savedComm ||
      editStatus !== savedStatus
    );
  }, [activeRow, editMarginType, editMarginValueStr, editCommissionStr, editStatus]);

  useEffect(() => {
    if (!activeRow) return;
    if (editorSaveState === 'SAVING') return;
    if (hasUnsavedEditorChanges && editorSaveState !== 'FAILED' && editorSaveState !== 'CONFLICT') {
      setEditorSaveState('UNSAVED');
    } else if (!hasUnsavedEditorChanges && editorSaveState === 'UNSAVED') {
      setEditorSaveState('IDLE');
    }
  }, [activeRow, hasUnsavedEditorChanges, editorSaveState]);

  const isLargeChange = useMemo(() => {
    if (!activeRow || !editValidation.valid || editValidation.marginValue === undefined) return false;
    const prevVal = activeRow.effectiveMarginValue;
    if (editStatus === 'INACTIVE' && activeRow.configStatus !== 'INACTIVE') return true;
    if (editMarginType !== activeRow.effectiveMarginType) return true;
    if (prevVal !== null && Math.abs(editValidation.marginValue - prevVal) >= 15) return true;
    if (editValidation.marginType === 'PERCENTAGE' && editValidation.marginValue === 0 && prevVal !== 0) return true;
    return false;
  }, [activeRow, editValidation, editMarginType, editStatus]);

  const handleSaveSingleMargin = async () => {
    if (!activeRow) return;
    if (!editValidation.valid || editValidation.marginValue === undefined) {
      setEditorSaveState('FAILED');
      setEditorStatusMessage(editValidation.error || 'Please correct invalid margin input before saving.');
      return;
    }

    if (isLargeChange && !confirmLargeChangeChecked) {
      setConfirmLargeChangeRequired(true);
      return;
    }

    setEditorSaveState('SAVING');
    setEditorStatusMessage('Persisting transactional update to Firestore...');
    setConflictInfo(null);

    const res = await saveProductMargin({
      productId: activeRow.product.id,
      marginType: editValidation.marginType,
      marginValue: editValidation.marginValue,
      commissionPercent: editValidation.commissionPercent ?? 0,
      status: editStatus,
      reason: editReason.trim() || 'Updated via Margin & Commission Governance',
      expectedVersion: activeRow.version,
      changeSource: 'MARGIN_GOVERNANCE',
      actor: user
    });

    if (res.success && res.product) {
      const updatedRow = queryLocalMarginGovernanceCatalog({ search: activeRow.product.id, pageSize: 10 }).rows.find(
        (r) => r.product.id === activeRow.product.id
      );
      if (updatedRow) {
        setActiveRow(updatedRow);
        setEditMarginType(updatedRow.effectiveMarginType);
        setEditMarginValueStr(updatedRow.effectiveMarginValue !== null ? String(updatedRow.effectiveMarginValue) : '');
        setEditCommissionStr(String(updatedRow.commissionPercent ?? 0));
        setEditStatus(updatedRow.configStatus === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE');
        // Refresh selection map entry if selected
        setSelectedRowsMap((prev) => (prev[updatedRow.product.id] ? { ...prev, [updatedRow.product.id]: updatedRow } : prev));
      }
      setProductAuditLogs(db.getProductMarginAuditLogs(activeRow.product.id));
      setConfirmLargeChangeRequired(false);
      setConfirmLargeChangeChecked(false);
      setEditReason('');
      setEditorSaveState('SAVED');
      setEditorStatusMessage(
        `Saved & synchronized (v${res.marginConfig?.version ?? (activeRow.version + 1)}) via ${
          res.source === 'BACKEND_TRANSACTION' ? 'Server Transaction' : 'Verified Firestore Transaction'
        }.`
      );
      await loadCatalog(false);
      return;
    }

    if (res.code === 'VERSION_CONFLICT') {
      setEditorSaveState('CONFLICT');
      setConflictInfo({
        currentVersion: res.currentVersion,
        message: res.error || 'This product margin was updated by another admin session.'
      });
      setEditorStatusMessage(res.error || 'Concurrent edit conflict detected.');
      return;
    }

    setEditorSaveState('FAILED');
    setEditorStatusMessage(res.error || 'Failed to save margin configuration.');
  };

  const handleReloadAfterConflict = async () => {
    if (!activeRow) return;
    await loadCatalog(true);
    const detail = await fetchProductMarginDetailFromServer(activeRow.product.id);
    const freshRow = queryLocalMarginGovernanceCatalog({ search: activeRow.product.id, pageSize: 10 }).rows.find(
      (r) => r.product.id === activeRow.product.id
    );
    if (freshRow) {
      await openEditorForRow(freshRow);
      setEditorStatusMessage('Reloaded latest server margin configuration.');
    } else if (detail?.product) {
      setConflictInfo(null);
      setEditorSaveState('IDLE');
    }
  };

  // Bulk validation & execution
  const bulkValidation = useMemo(
    () =>
      validateMarginGovernanceInput({
        marginType: bulkMarginType,
        marginValue: bulkMarginValueStr,
        commissionPercent: bulkApplyCommission ? bulkCommissionStr : undefined
      }),
    [bulkMarginType, bulkMarginValueStr, bulkApplyCommission, bulkCommissionStr]
  );

  const openBulkModal = () => {
    setBulkMarginType('PERCENTAGE');
    setBulkMarginValueStr('');
    setBulkApplyCommission(false);
    setBulkCommissionStr('0');
    setBulkStatus('ACTIVE');
    setBulkReason('');
    setBulkConfirmChecked(false);
    setBulkResult(null);
    setIsBulkModalOpen(true);
  };

  const executeBulkSave = async (targetIds: string[]) => {
    if (!bulkValidation.valid || bulkValidation.marginValue === undefined) return;
    setBulkSaving(true);
    try {
      const expectedVersions: Record<string, number> = {};
      targetIds.forEach((id) => {
        const r = selectedRowsMap[id];
        if (r) expectedVersions[id] = r.version;
      });

      const response = await bulkSaveProductMargins({
        productIds: targetIds,
        marginType: bulkValidation.marginType,
        marginValue: bulkValidation.marginValue,
        commissionPercent: bulkApplyCommission ? bulkValidation.commissionPercent : undefined,
        applyCommissionUpdate: bulkApplyCommission,
        status: bulkStatus,
        reason: bulkReason.trim() || 'Bulk update via Margin & Commission Governance',
        expectedVersions,
        actor: user
      });
      setBulkResult(response);
      // Update selectedRowsMap for succeeded entries
      if (response.succeededIds.length > 0) {
        await loadCatalog(false);
        const refreshed = queryLocalMarginGovernanceCatalog({ pageSize: 100 }).rows;
        setSelectedRowsMap((prev) => {
          const next = { ...prev };
          response.succeededIds.forEach((id) => {
            const match = refreshed.find((r) => r.product.id === id);
            if (match && next[id]) next[id] = match;
          });
          return next;
        });
      }
    } finally {
      setBulkSaving(false);
    }
  };

  if (!rbac.allowed) {
    return (
      <div className="bg-white border border-rose-200 rounded-2xl p-8 text-center space-y-3">
        <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900">Access Restricted — Admin & Finance Only</h3>
        <p className="text-xs text-slate-600 max-w-md mx-auto">
          {rbac.reason || 'You do not have permission to view or modify product margins and commission configurations.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-[#008972] text-[11px] font-bold uppercase tracking-wider">
            <Sliders className="w-3.5 h-3.5" />
            <span>Finance & Administration</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Margin & Commission Governance</h2>
          <p className="text-xs text-slate-500">
            Single-source product margin and commission control synchronized directly with Product Management and the central pricing engine.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-[11px] text-slate-700 font-medium">
            Active Agency Mode:{' '}
            <strong className="text-slate-900">
              {agencyPricingMode.productLevelMarginEnabled
                ? 'Product-Level Margin (ON)'
                : `Internal Agent-Level Margin (${agencyPricingMode.agentLevelMarginPercent}%)`}
            </strong>
          </div>

          <button
            type="button"
            onClick={() => {
              setRecentAuditLogs(db.getProductMarginAuditLogs().slice(0, 50));
              setShowRecentAuditDrawer(true);
            }}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
          >
            <History className="w-3.5 h-3.5 text-slate-500" />
            <span>Audit Log</span>
          </button>

          <button
            type="button"
            onClick={() => void loadCatalog(true)}
            disabled={loading}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total Products</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900">{summary.totalProducts}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">Configured Margins</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-emerald-700">{summary.configuredCount}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">Not Configured</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-amber-700">{summary.unconfiguredCount}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Inactive Margins</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-700">{summary.inactiveCount}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#008972]">Updated (7 Days)</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-[#008972]">{summary.recentlyUpdatedCount}</div>
        </div>
      </div>

      {/* Discovery & Filtering Controls */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by Product Name, Product ID, SKU, city, or supplier..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:border-[#008972]"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:outline-none focus:border-[#008972]"
          >
            <option value="ALL">All Categories</option>
            {PRODUCT_CMS_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <select
            value={marginStatusFilter}
            onChange={(e) => {
              setMarginStatusFilter(e.target.value as any);
              setPage(1);
            }}
            className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium focus:bg-white focus:outline-none focus:border-[#008972]"
          >
            <option value="ALL">All Margin Statuses</option>
            <option value="CONFIGURED">Configured Only</option>
            <option value="NOT_CONFIGURED">Not Configured</option>
            <option value="INACTIVE">Inactive Margins</option>
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <select
            value={destinationFilter}
            onChange={(e) => {
              setDestinationFilter(e.target.value);
              setRegionFilter('ALL');
              setHubFilter('ALL');
              setPage(1);
            }}
            className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:outline-none focus:border-[#008972]"
          >
            <option value="ALL">All Destinations</option>
            {destinations.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          <select
            value={regionFilter}
            onChange={(e) => {
              setRegionFilter(e.target.value);
              setHubFilter('ALL');
              setPage(1);
            }}
            className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:outline-none focus:border-[#008972]"
          >
            <option value="ALL">All Regions</option>
            {availableRegions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>

          <select
            value={hubFilter}
            onChange={(e) => {
              setHubFilter(e.target.value);
              setPage(1);
            }}
            className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:outline-none focus:border-[#008972]"
          >
            <option value="ALL">All City Hubs</option>
            {availableHubs.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>

          <select
            value={supplierFilter}
            onChange={(e) => {
              setSupplierFilter(e.target.value);
              setPage(1);
            }}
            className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:outline-none focus:border-[#008972]"
          >
            <option value="ALL">All Suppliers</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <div className="flex items-center space-x-2">
            <select
              value={productStatusFilter}
              onChange={(e) => {
                setProductStatusFilter(e.target.value);
                setPage(1);
              }}
              className="flex-1 py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:outline-none focus:border-[#008972]"
            >
              <option value="ALL">All Product Status</option>
              <option value="ACTIVE">Active Products</option>
              <option value="DRAFT">Draft Products</option>
              <option value="ARCHIVED">Archived</option>
            </select>

            <button
              type="button"
              onClick={resetAllFilters}
              title="Reset Filters"
              className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-50 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Multi-Select Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="bg-slate-900 text-white rounded-2xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3 text-xs">
            <span className="font-mono font-bold text-[#00C6A6] tabular-nums">{selectedIds.length}</span>
            <span className="font-semibold">product(s) selected for bulk margin governance</span>
            <button
              type="button"
              onClick={() => setSelectedRowsMap({})}
              className="text-slate-400 hover:text-white underline cursor-pointer ml-2"
            >
              Clear selection
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={openBulkModal}
              disabled={selectedIds.length > 100}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[#00C6A6] hover:bg-[#008972] text-slate-950 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Configure Selected Margins ({selectedIds.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Product Governance Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={toggleSelectAllCurrentPage}
                    aria-label="Select all products on page"
                    className="rounded border-slate-300 text-[#008972] focus:ring-[#008972] cursor-pointer"
                  />
                </th>
                <th className="py-3 px-3">Product Name</th>
                <th className="py-3 px-3">Product ID / SKU</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Destination</th>
                <th className="py-3 px-3">Supplier</th>
                <th className="py-3 px-3 text-right">Current Margin</th>
                <th className="py-3 px-3">Margin Type</th>
                <th className="py-3 px-3 text-right">Commission %</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Last Updated</th>
                <th className="py-3 px-3">Updated By</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => {
                const p = row.product;
                const isSelected = Boolean(selectedRowsMap[p.id]);
                return (
                  <tr
                    key={p.id}
                    className={`transition-colors ${isSelected ? 'bg-teal-50/40' : 'hover:bg-slate-50/80'}`}
                  >
                    <td className="py-3 px-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRowSelection(row)}
                        aria-label={`Select ${p.name}`}
                        className="rounded border-slate-300 text-[#008972] focus:ring-[#008972] cursor-pointer"
                      />
                    </td>
                    <td className="py-3 px-3 max-w-[230px]">
                      <div className="font-semibold text-slate-900 truncate" title={p.name}>
                        {p.name}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono tabular-nums mt-0.5">
                        Net: {formatCurrency(row.baseNetCost, row.currency as CurrencyCode)} • Sell:{' '}
                        {formatCurrency(row.currentSellingPrice, row.currency as CurrencyCode)}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-mono text-[11px] font-semibold text-slate-800">{p.sku}</div>
                      <div className="font-mono text-[10px] text-slate-400 truncate max-w-[140px]" title={p.id}>
                        {p.id}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-700 whitespace-nowrap">{p.category}</td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="text-slate-800 font-medium">{p.destinationName || '—'}</div>
                      <div className="text-[10px] text-slate-400">{p.city || p.regionName || ''}</div>
                    </td>
                    <td className="py-3 px-3 text-slate-600 max-w-[140px] truncate" title={p.supplierName || ''}>
                      {p.supplierName || '—'}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                      {row.effectiveMarginValue === null ? (
                        <span className="text-amber-700 font-sans font-semibold text-[11px]">Unset</span>
                      ) : row.effectiveMarginType === 'FIXED' ? (
                        formatCurrency(row.effectiveMarginValue, row.currency as CurrencyCode)
                      ) : (
                        `${row.effectiveMarginValue}%`
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-700 whitespace-nowrap">
                      {row.effectiveMarginType}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                      {row.commissionPercent}%
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`text-[11px] font-semibold ${
                          row.configStatus === 'CONFIGURED'
                            ? 'text-emerald-700'
                            : row.configStatus === 'INACTIVE'
                              ? 'text-slate-500'
                              : 'text-amber-700'
                        }`}
                      >
                        {row.configStatus === 'CONFIGURED'
                          ? 'Configured'
                          : row.configStatus === 'INACTIVE'
                            ? 'Inactive'
                            : 'Not Configured'}
                      </span>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px] text-slate-500">
                      {row.updatedAt ? row.updatedAt.slice(0, 10) : '—'}
                      {row.version > 0 && <span className="ml-1 text-slate-400">v{row.version}</span>}
                    </td>
                    <td className="py-3 px-3 text-[11px] text-slate-600 max-w-[130px] truncate" title={row.updatedByEmail || row.updatedByName}>
                      {row.updatedByName || 'System'}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => void openEditorForRow(row)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 hover:border-[#008972] hover:text-[#008972] bg-white text-slate-700 font-semibold text-[11px] transition-colors cursor-pointer"
                      >
                        Configure
                      </button>
                    </td>
                  </tr>
                );
              })}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-slate-400 text-xs">
                    No catalog products match the active governance filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center space-x-3">
            <span>
              Showing <strong className="text-slate-900 font-mono tabular-nums">{rows.length}</strong> of{' '}
              <strong className="text-slate-900 font-mono tabular-nums">{totalFiltered}</strong> matching products
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-[11px] text-slate-500">
              Source: {dataSourceLabel === 'FIRESTORE_API' ? 'Firestore Live Query' : 'Synchronized Catalog'}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="py-1 px-2 bg-white border border-slate-200 rounded-lg text-xs font-mono"
            >
              <option value={10}>10 / page</option>
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>

            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono tabular-nums text-xs px-2">
              Page {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Individual Margin & Commission Editor Modal */}
      {activeRow && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <div className="text-[11px] font-mono text-slate-500">
                  {activeRow.product.sku} • ID: {activeRow.product.id} • Version v{activeRow.version}
                </div>
                <h3 className="text-base font-bold text-slate-900">{activeRow.product.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveRow(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 text-xs">
              {/* Product Context & Live Pricing Preview */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Wholesale Nett Cost</div>
                  <div className="mt-1 text-base font-bold font-mono tabular-nums text-slate-900">
                    {formatCurrency(activeRow.baseNetCost, activeRow.currency as CurrencyCode)}
                  </div>
                  <div className="text-[10px] text-slate-500">{activeRow.product.category}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Saved Selling Price</div>
                  <div className="mt-1 text-base font-bold font-mono tabular-nums text-slate-700">
                    {formatCurrency(activeRow.currentSellingPrice, activeRow.currency as CurrencyCode)}
                  </div>
                  <div className="text-[10px] text-slate-500">Tax {activeRow.product.taxPercent ?? 0}% • Fee {activeRow.product.serviceFeeFixed ?? 0}%</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-[#008972] font-semibold">Proposed Selling Price</div>
                  <div className="mt-1 text-base font-bold font-mono tabular-nums text-[#008972]">
                    {editPreviewSellingPrice !== null
                      ? formatCurrency(editPreviewSellingPrice, activeRow.currency as CurrencyCode)
                      : 'Invalid Input'}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {editStatus === 'INACTIVE' ? 'Margin Disabled (0%)' : `${editMarginType} preview`}
                  </div>
                </div>
              </div>

              {/* Explicit Save / Conflict / Validation Status Banner */}
              {editorSaveState !== 'IDLE' && (
                <div
                  className={`p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-2 ${
                    editorSaveState === 'SAVED'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : editorSaveState === 'FAILED' || editorSaveState === 'CONFLICT'
                        ? 'bg-rose-50 border-rose-200 text-rose-900'
                        : editorSaveState === 'SAVING'
                          ? 'bg-slate-100 border-slate-300 text-slate-800'
                          : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    {editorSaveState === 'SAVED' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                    {(editorSaveState === 'FAILED' || editorSaveState === 'CONFLICT') && (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    {editorSaveState === 'SAVING' && <RefreshCw className="w-4 h-4 animate-spin text-slate-600 shrink-0" />}
                    {editorSaveState === 'UNSAVED' && <Clock className="w-4 h-4 text-amber-600 shrink-0" />}
                    <span className="font-semibold">
                      {editorSaveState === 'UNSAVED' && 'Unsaved Changes'}
                      {editorSaveState === 'SAVING' && 'Saving...'}
                      {editorSaveState === 'SAVED' && 'Saved'}
                      {editorSaveState === 'FAILED' && 'Save Failed'}
                      {editorSaveState === 'CONFLICT' && 'Concurrent Edit Conflict'}
                      {editorStatusMessage ? ` — ${editorStatusMessage}` : ''}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    {editorSaveState === 'CONFLICT' && (
                      <button
                        type="button"
                        onClick={() => void handleReloadAfterConflict()}
                        className="px-3 py-1 rounded-lg bg-rose-700 hover:bg-rose-800 text-white font-bold text-[11px] cursor-pointer"
                      >
                        Reload Latest (v{conflictInfo?.currentVersion ?? '?'})
                      </button>
                    )}
                    {editorSaveState === 'FAILED' && (
                      <button
                        type="button"
                        onClick={() => void handleSaveSingleMargin()}
                        className="px-3 py-1 rounded-lg bg-rose-700 hover:bg-rose-800 text-white font-bold text-[11px] cursor-pointer"
                      >
                        Retry Save
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Form Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Margin Calculation Type</label>
                  <select
                    value={editMarginType}
                    onChange={(e) => setEditMarginType(e.target.value as 'PERCENTAGE' | 'FIXED')}
                    className="w-full py-2 px-3 bg-white border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-[#008972]"
                  >
                    <option value="PERCENTAGE">Percentage Markup (%)</option>
                    <option value="FIXED">Fixed Amount ({activeRow.currency})</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {editMarginType === 'PERCENTAGE' ? 'Margin Value (%)' : `Fixed Margin Amount (${activeRow.currency})`}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={editMarginValueStr}
                      onChange={(e) => setEditMarginValueStr(e.target.value)}
                      placeholder={editMarginType === 'PERCENTAGE' ? 'e.g. 22' : 'e.g. 500'}
                      className={`w-full py-2 px-3 pr-9 border rounded-lg font-mono tabular-nums font-bold text-slate-900 focus:outline-none ${
                        editValidation.valid ? 'border-slate-200 focus:border-[#008972]' : 'border-rose-400 bg-rose-50/40'
                      }`}
                    />
                    <span className="absolute right-3 top-2 text-slate-400 font-mono">
                      {editMarginType === 'PERCENTAGE' ? '%' : activeRow.currency}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Commission % (Independent Tracking)</label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={editCommissionStr}
                      onChange={(e) => setEditCommissionStr(e.target.value)}
                      placeholder="0"
                      className="w-full py-2 px-3 pr-9 border border-slate-200 rounded-lg font-mono tabular-nums text-slate-900 focus:outline-none focus:border-[#008972]"
                    />
                    <span className="absolute right-3 top-2 text-slate-400 font-mono">%</span>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Margin Configuration Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
                    className="w-full py-2 px-3 bg-white border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-[#008972]"
                  >
                    <option value="ACTIVE">ACTIVE — Applied by Pricing Engine</option>
                    <option value="INACTIVE">INACTIVE — Product Margin Disabled (0%)</option>
                  </select>
                </div>
              </div>

              {!editValidation.valid && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 font-medium">
                  {editValidation.error}
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Change Reason / Commercial Justification</label>
                <input
                  type="text"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="e.g. Q2 Wholesale contract alignment with Kyoto Ground Supplier"
                  className="w-full py-2 px-3 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-[#008972]"
                />
              </div>

              {confirmLargeChangeRequired && isLargeChange && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 space-y-2">
                  <div className="flex items-center space-x-2 text-amber-900 font-bold">
                    <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Significant Margin Change Confirmation Required</span>
                  </div>
                  <p className="text-amber-800">
                    This update changes the margin type, sets status to INACTIVE/0%, or shifts margin by 15+ percentage points.
                    Historical saved quotations remain immutable; new quotations will immediately use this configuration.
                  </p>
                  <label className="flex items-center space-x-2 text-amber-950 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmLargeChangeChecked}
                      onChange={(e) => setConfirmLargeChangeChecked(e.target.checked)}
                      className="rounded border-amber-400 text-[#008972]"
                    />
                    <span>I confirm this commercial margin change</span>
                  </label>
                </div>
              )}

              {/* Product Margin Audit History */}
              <div className="border-t border-slate-200 pt-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-800 flex items-center space-x-1.5">
                    <History className="w-3.5 h-3.5 text-slate-500" />
                    <span>Audit History for {activeRow.product.sku}</span>
                  </h4>
                  {loadingAuditLogs && <span className="text-[11px] text-slate-400">Syncing history...</span>}
                </div>

                {productAuditLogs.length === 0 ? (
                  <div className="text-slate-400 text-[11px] py-3 bg-slate-50 rounded-lg px-3 border border-slate-100">
                    No prior margin governance audit entries recorded for this product yet.
                  </div>
                ) : (
                  <div className="max-h-44 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
                    {productAuditLogs.map((log) => (
                      <div key={log.id} className="p-3 bg-white flex items-start justify-between gap-3 text-[11px]">
                        <div>
                          <div className="font-semibold text-slate-900">
                            {log.previousMarginValue !== null ? `${log.previousMarginValue}` : 'Unset'} →{' '}
                            <span className="text-[#008972] font-mono tabular-nums">
                              {log.newMarginValue} {log.newMarginType === 'FIXED' ? activeRow.currency : '%'}
                            </span>{' '}
                            <span className="text-slate-400 font-mono">
                              (v{log.previousVersion} → v{log.newVersion})
                            </span>
                          </div>
                          {log.reason && <div className="text-slate-500 mt-0.5">{log.reason}</div>}
                        </div>
                        <div className="text-right shrink-0 text-slate-400">
                          <div className="text-slate-700 font-medium">{log.actorName || log.actorEmail}</div>
                          <div className="font-mono text-[10px]">{log.timestamp ? log.timestamp.slice(0, 19).replace('T', ' ') : ''}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={resetEditorToLastSaved}
                disabled={editorSaveState === 'SAVING'}
                className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs cursor-pointer disabled:opacity-50"
              >
                Reset to Last Saved
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setActiveRow(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveSingleMargin()}
                  disabled={editorSaveState === 'SAVING' || !editValidation.valid}
                  className="inline-flex items-center space-x-1.5 px-5 py-2 rounded-xl bg-[#00C6A6] hover:bg-[#008972] disabled:opacity-50 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{editorSaveState === 'SAVING' ? 'Saving...' : 'Save Margin Configuration'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Configuration Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <div className="text-[11px] font-mono text-[#008972] font-bold">
                  BULK GOVERNANCE • {selectedRowsList.length} PRODUCT(S)
                </div>
                <h3 className="text-base font-bold text-slate-900">Bulk Margin & Commission Update</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Margin Type</label>
                  <select
                    value={bulkMarginType}
                    onChange={(e) => setBulkMarginType(e.target.value as 'PERCENTAGE' | 'FIXED')}
                    className="w-full py-2 px-3 border border-slate-200 rounded-lg bg-white text-slate-900 font-medium"
                  >
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FIXED">Fixed Amount</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    New Margin Value {bulkMarginType === 'PERCENTAGE' ? '(%)' : '(Amount)'}
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={bulkMarginValueStr}
                    onChange={(e) => setBulkMarginValueStr(e.target.value)}
                    placeholder={bulkMarginType === 'PERCENTAGE' ? 'e.g. 20' : 'e.g. 250'}
                    className="w-full py-2 px-3 border border-slate-200 rounded-lg font-mono tabular-nums font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Margin Status</label>
                  <select
                    value={bulkStatus}
                    onChange={(e) => setBulkStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
                    className="w-full py-2 px-3 border border-slate-200 rounded-lg bg-white text-slate-900 font-medium"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded-xl p-3 space-y-2 bg-slate-50">
                  <label className="flex items-center space-x-2 font-semibold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bulkApplyCommission}
                      onChange={(e) => setBulkApplyCommission(e.target.checked)}
                      className="rounded border-slate-300 text-[#008972]"
                    />
                    <span>Also update Commission % across selected items</span>
                  </label>
                  {bulkApplyCommission && (
                    <input
                      type="text"
                      inputMode="decimal"
                      value={bulkCommissionStr}
                      onChange={(e) => setBulkCommissionStr(e.target.value)}
                      placeholder="Commission %"
                      className="w-full py-1.5 px-3 border border-slate-200 rounded-lg bg-white font-mono tabular-nums"
                    />
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Bulk Change Reason</label>
                  <input
                    type="text"
                    value={bulkReason}
                    onChange={(e) => setBulkReason(e.target.value)}
                    placeholder="e.g. Seasonal Margin Realignment"
                    className="w-full py-2 px-3 border border-slate-200 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              {!bulkValidation.valid && bulkMarginValueStr !== '' && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 font-medium">
                  {bulkValidation.error}
                </div>
              )}

              {/* Preview Affected Products */}
              <div>
                <h4 className="font-bold text-slate-800 mb-2">Affected Products Preview ({selectedRowsList.length})</h4>
                <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px]">
                      <tr>
                        <th className="py-2 px-3">Product</th>
                        <th className="py-2 px-3 text-right">Current Margin</th>
                        <th className="py-2 px-3 text-right">Proposed Margin</th>
                        <th className="py-2 px-3 text-right">Current → Proposed Selling</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedRowsList.map((row) => {
                        const proposedSelling =
                          bulkValidation.valid && bulkValidation.marginValue !== undefined
                            ? previewB2BSellingPriceForProduct({
                                product: row.product,
                                marginType: bulkValidation.marginType,
                                marginValue: bulkValidation.marginValue,
                                status: bulkStatus
                              })
                            : null;
                        return (
                          <tr key={row.product.id}>
                            <td className="py-2 px-3">
                              <div className="font-semibold text-slate-900 truncate max-w-[210px]">{row.product.name}</div>
                              <div className="font-mono text-[10px] text-slate-400">{row.product.sku}</div>
                            </td>
                            <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-600">
                              {row.effectiveMarginValue === null
                                ? 'Unset'
                                : row.effectiveMarginType === 'FIXED'
                                  ? formatCurrency(row.effectiveMarginValue, row.currency as CurrencyCode)
                                  : `${row.effectiveMarginValue}%`}
                            </td>
                            <td className="py-2 px-3 text-right font-mono tabular-nums font-bold text-[#008972]">
                              {bulkValidation.valid && bulkValidation.marginValue !== undefined
                                ? bulkMarginType === 'FIXED'
                                  ? formatCurrency(bulkValidation.marginValue, row.currency as CurrencyCode)
                                  : `${bulkValidation.marginValue}%`
                                : '—'}
                            </td>
                            <td className="py-2 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                              <span className="text-slate-500">
                                {formatCurrency(row.currentSellingPrice, row.currency as CurrencyCode)}
                              </span>
                              <ArrowRight className="w-3 h-3 inline mx-1 text-slate-400" />
                              <span className="font-bold text-slate-900">
                                {proposedSelling !== null
                                  ? formatCurrency(proposedSelling, row.currency as CurrencyCode)
                                  : '—'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Partial/Complete Bulk Execution Result */}
              {bulkResult && (
                <div
                  className={`p-4 rounded-xl border space-y-2.5 ${
                    bulkResult.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-amber-50 border-amber-300 text-amber-950'
                  }`}
                >
                  <div className="font-bold flex items-center justify-between">
                    <span>
                      Batch {bulkResult.batchId}: {bulkResult.succeededIds.length} succeeded, {bulkResult.failedItems.length} failed
                    </span>
                    {bulkResult.failedItems.length > 0 && (
                      <button
                        type="button"
                        disabled={bulkSaving || !bulkValidation.valid}
                        onClick={() => void executeBulkSave(bulkResult.failedItems.map((f) => f.productId))}
                        className="px-3 py-1 rounded-lg bg-amber-800 hover:bg-amber-900 text-white text-[11px] font-bold cursor-pointer"
                      >
                        Retry Failed Items Only ({bulkResult.failedItems.length})
                      </button>
                    )}
                  </div>
                  {bulkResult.failedItems.length > 0 && (
                    <div className="space-y-1 text-[11px] bg-white/80 rounded-lg p-2.5 border border-amber-200">
                      {bulkResult.failedItems.map((f) => (
                        <div key={f.productId} className="text-rose-800">
                          <strong className="font-mono">{f.productId}</strong>: {f.error}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <label className="flex items-center space-x-2 text-slate-800 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={bulkConfirmChecked}
                  onChange={(e) => setBulkConfirmChecked(e.target.checked)}
                  className="rounded border-slate-300 text-[#008972]"
                />
                <span>
                  I confirm updating margin configuration for {selectedRowsList.length} selected product(s). Saved quotations will remain unaffected.
                </span>
              </label>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                disabled={bulkSaving || !bulkValidation.valid || !bulkConfirmChecked}
                onClick={() => void executeBulkSave(selectedIds)}
                className="inline-flex items-center space-x-1.5 px-5 py-2 rounded-xl bg-[#00C6A6] hover:bg-[#008972] disabled:opacity-50 text-slate-950 font-bold text-xs cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{bulkSaving ? 'Applying Bulk Update...' : `Apply to ${selectedIds.length} Product(s)`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Recent Margin Audit Drawer */}
      {showRecentAuditDrawer && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-end">
          <div className="bg-white h-full max-w-lg w-full border-l border-slate-200 shadow-2xl flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Margin & Commission Audit Trail</h3>
                <p className="text-xs text-slate-500">Immutable record of product margin and commission updates</p>
              </div>
              <button
                type="button"
                onClick={() => setShowRecentAuditDrawer(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 divide-y divide-slate-100 text-xs">
              {recentAuditLogs.length === 0 ? (
                <div className="py-12 text-center text-slate-400">No margin audit entries recorded yet.</div>
              ) : (
                recentAuditLogs.map((log) => (
                  <div key={log.id} className="py-3.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 truncate max-w-[240px]">{log.productName || log.productId}</span>
                      <span className="font-mono text-[10px] text-slate-400">
                        v{log.previousVersion} → v{log.newVersion}
                      </span>
                    </div>
                    <div className="text-slate-600">
                      Margin:{' '}
                      <span className="font-mono tabular-nums">
                        {log.previousMarginValue !== null ? log.previousMarginValue : 'Unset'} →{' '}
                        <strong className="text-[#008972]">
                          {log.newMarginValue} {log.newMarginType === 'FIXED' ? '(Fixed)' : '%'}
                        </strong>
                      </span>{' '}
                      • Commission:{' '}
                      <span className="font-mono tabular-nums">
                        {log.previousCommissionPercent ?? 0}% → {log.newCommissionPercent ?? 0}%
                      </span>
                    </div>
                    {log.reason && <div className="text-[11px] text-slate-500">{log.reason}</div>}
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                      <span>
                        {log.actorName || log.actorEmail} ({log.changeSource})
                      </span>
                      <span className="font-mono">{log.timestamp ? log.timestamp.slice(0, 19).replace('T', ' ') : ''}</span>
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
