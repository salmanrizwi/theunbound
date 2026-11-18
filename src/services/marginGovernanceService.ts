import {
  doc,
  getDoc,
  runTransaction
} from 'firebase/firestore';
import {
  CurrencyCode,
  MarginConfigurationStatus,
  Product,
  ProductMarginAuditRecord,
  ProductMarginConfigRecord,
  User
} from '../types';
import { auth, db as firestoreDb } from './firebase';
import { AppDatabase, cleanForFirestore } from './db';
import { masterDataCache } from './masterDataCache';
import {
  calculateB2BAgentPrice,
  calculateUnifiedPrice,
  clearPricingEngineCache
} from './pricingEngine';

export interface MarginGovernanceFilterParams {
  search?: string;
  category?: string;
  destinationId?: string;
  regionId?: string;
  hubId?: string;
  supplierId?: string;
  productStatus?: string;
  marginStatus?: 'ALL' | MarginConfigurationStatus;
  page?: number;
  pageSize?: number;
}

export interface MarginGovernanceRow {
  product: Product;
  marginConfig: ProductMarginConfigRecord | null;
  configStatus: MarginConfigurationStatus;
  effectiveMarginType: 'PERCENTAGE' | 'FIXED';
  effectiveMarginValue: number | null;
  commissionPercent: number;
  baseNetCost: number;
  currency: CurrencyCode | string;
  currentSellingPrice: number;
  version: number;
  updatedAt: string;
  updatedByName: string;
  updatedByEmail: string;
}

export interface MarginGovernanceSummary {
  totalProducts: number;
  configuredCount: number;
  unconfiguredCount: number;
  inactiveCount: number;
  recentlyUpdatedCount: number;
}

export interface MarginGovernanceValidationResult {
  valid: boolean;
  error?: string;
  marginType: 'PERCENTAGE' | 'FIXED';
  marginValue?: number;
  commissionPercent?: number;
}

export interface SaveProductMarginParams {
  productId: string;
  marginType: 'PERCENTAGE' | 'FIXED';
  marginValue: number | string;
  commissionPercent?: number | string;
  status?: 'ACTIVE' | 'INACTIVE';
  reason?: string;
  expectedVersion?: number;
  changeSource?: 'MARGIN_GOVERNANCE' | 'PRODUCT_MANAGEMENT' | 'BULK_GOVERNANCE';
  actor: User | null;
}

export interface SaveProductMarginResponse {
  success: boolean;
  code?: 'VALIDATION_ERROR' | 'FORBIDDEN' | 'NOT_FOUND' | 'VERSION_CONFLICT' | 'PERSISTENCE_FAILED';
  error?: string;
  product?: Product;
  marginConfig?: ProductMarginConfigRecord;
  auditLog?: ProductMarginAuditRecord;
  currentVersion?: number;
  currentConfig?: ProductMarginConfigRecord | null;
  source?: 'BACKEND_TRANSACTION' | 'FIRESTORE_TRANSACTION' | 'LOCAL_STORE_AUDIT';
}

export interface BulkMarginSaveParams {
  productIds: string[];
  marginType: 'PERCENTAGE' | 'FIXED';
  marginValue: number | string;
  commissionPercent?: number | string;
  applyCommissionUpdate?: boolean;
  status?: 'ACTIVE' | 'INACTIVE';
  reason?: string;
  expectedVersions?: Record<string, number>;
  actor: User | null;
  simulateFailureForProductIds?: string[];
}

export interface BulkMarginSaveResponse {
  success: boolean;
  partialSuccess: boolean;
  batchId: string;
  totalRequested: number;
  succeededIds: string[];
  failedItems: Array<{
    productId: string;
    sku?: string;
    productName?: string;
    code: string;
    error: string;
  }>;
  updatedProducts: Product[];
  updatedConfigs: ProductMarginConfigRecord[];
  auditLogs: ProductMarginAuditRecord[];
  error?: string;
}

const MASTER_ADMIN_EMAILS = new Set([
  'business@theunbound.in',
  'admin@theunbound.com',
  'marcus@theunbound.in'
]);

/**
 * Enforces strict Admin / Finance Admin RBAC for Margin & Commission Governance.
 */
export function canUserManageMargins(user: User | null): { allowed: boolean; reason?: string } {
  if (!user) {
    return { allowed: false, reason: 'Authentication required to manage product margins.' };
  }
  const email = (user.email || '').trim().toLowerCase();
  if (MASTER_ADMIN_EMAILS.has(email)) {
    return { allowed: true };
  }
  const role = String(user.role || (user as any).userType || '').toUpperCase();
  if (role === 'BUYER' || role === 'B2B_AGENT' || role === 'AGENT' || role === 'AGENCY_OWNER') {
    return {
      allowed: false,
      reason: `Forbidden: External role "${role}" has no access to internal Margin & Commission Governance.`
    };
  }
  if (user.approvalStatus && user.approvalStatus !== 'APPROVED') {
    return { allowed: false, reason: 'Account is not approved for financial governance.' };
  }
  if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
    return { allowed: true };
  }
  if (role === 'TEAM_MEMBER' || role === 'DMC_STAFF') {
    const perms: any = user.permissions || {};
    if (perms.canAccessFinancials === true || perms.cmsFinance?.enabled === true) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: 'Forbidden: Team member lacks Finance & Margin Governance permission.'
    };
  }
  return { allowed: false, reason: `Forbidden: Role "${role}" cannot modify margins.` };
}

/**
 * Strictly validates margin & commission inputs.
 * Never silently converts invalid, empty, or malformed input into 0.
 */
export function validateMarginGovernanceInput(input: {
  marginType: 'PERCENTAGE' | 'FIXED' | string;
  marginValue: unknown;
  commissionPercent?: unknown;
}): MarginGovernanceValidationResult {
  const mType: 'PERCENTAGE' | 'FIXED' = input.marginType === 'FIXED' ? 'FIXED' : 'PERCENTAGE';
  if (input.marginType !== 'PERCENTAGE' && input.marginType !== 'FIXED') {
    return {
      valid: false,
      error: `Invalid margin type "${String(input.marginType)}".`,
      marginType: mType
    };
  }

  if (input.marginValue === undefined || input.marginValue === null || String(input.marginValue).trim() === '') {
    return {
      valid: false,
      error: 'Margin value is required and cannot be blank.',
      marginType: mType
    };
  }

  const rawMarginStr = String(input.marginValue).trim();
  if (!/^-?\d+(\.\d+)?$/.test(rawMarginStr)) {
    return {
      valid: false,
      error: `Invalid margin format "${rawMarginStr}". Enter a valid numeric amount.`,
      marginType: mType
    };
  }

  const parsedMargin = Number(rawMarginStr);
  if (!Number.isFinite(parsedMargin) || Number.isNaN(parsedMargin)) {
    return {
      valid: false,
      error: 'Margin value must be a valid finite number.',
      marginType: mType
    };
  }

  if (parsedMargin < 0) {
    return {
      valid: false,
      error: 'Margin value cannot be negative.',
      marginType: mType
    };
  }

  if (mType === 'PERCENTAGE' && parsedMargin > 500) {
    return {
      valid: false,
      error: 'Percentage margin cannot exceed 500%.',
      marginType: mType
    };
  }

  if (mType === 'FIXED' && parsedMargin > 10000000) {
    return {
      valid: false,
      error: 'Fixed margin amount exceeds maximum allowed commercial ceiling.',
      marginType: mType
    };
  }

  const decPart = rawMarginStr.split('.')[1];
  if (decPart && decPart.length > 2) {
    return {
      valid: false,
      error: 'Margin value supports at most 2 decimal places.',
      marginType: mType
    };
  }

  let parsedComm: number | undefined = undefined;
  if (input.commissionPercent !== undefined && input.commissionPercent !== null && String(input.commissionPercent).trim() !== '') {
    const rawCommStr = String(input.commissionPercent).trim();
    if (!/^-?\d+(\.\d+)?$/.test(rawCommStr)) {
      return {
        valid: false,
        error: `Invalid commission percentage "${rawCommStr}".`,
        marginType: mType
      };
    }
    const commNum = Number(rawCommStr);
    if (!Number.isFinite(commNum) || commNum < 0 || commNum > 100) {
      return {
        valid: false,
        error: 'Commission percentage must be between 0% and 100%.',
        marginType: mType
      };
    }
    const commDec = rawCommStr.split('.')[1];
    if (commDec && commDec.length > 2) {
      return {
        valid: false,
        error: 'Commission percentage supports at most 2 decimal places.',
        marginType: mType
      };
    }
    parsedComm = Math.round(commNum * 100) / 100;
  }

  return {
    valid: true,
    marginType: mType,
    marginValue: Math.round(parsedMargin * 100) / 100,
    commissionPercent: parsedComm
  };
}

export function resolveProductServiceFeeParams(product: Product): {
  serviceChargeType: 'PERCENTAGE' | 'FIXED';
  serviceChargeValue: number;
} {
  const fixedVal = Number((product as any).serviceFeeFixed);
  if (Number.isFinite(fixedVal) && fixedVal > 0) {
    return { serviceChargeType: 'FIXED', serviceChargeValue: fixedVal };
  }
  const pctVal = Number((product as any).serviceFeePercent);
  if (Number.isFinite(pctVal) && pctVal > 0) {
    return { serviceChargeType: 'PERCENTAGE', serviceChargeValue: pctVal };
  }
  const rawFee = Number((product as any).serviceFee);
  if (Number.isFinite(rawFee) && rawFee > 0) {
    return rawFee <= 100
      ? { serviceChargeType: 'PERCENTAGE', serviceChargeValue: rawFee }
      : { serviceChargeType: 'FIXED', serviceChargeValue: rawFee };
  }
  return { serviceChargeType: 'PERCENTAGE', serviceChargeValue: 0 };
}

export function previewB2BSellingPriceForProduct(params: {
  product: Product;
  marginType: 'PERCENTAGE' | 'FIXED';
  marginValue: number;
  status?: 'ACTIVE' | 'INACTIVE';
}): number {
  const { product, marginType, marginValue, status = 'ACTIVE' } = params;
  const isCap =
    product.pricingMethod === 'capacity_based' ||
    ['Private Tours', 'Transfers', 'Private Yacht', 'Ferry'].includes(String(product.category || ''));
  const nett = isCap
    ? Number(product.vehicleConfig?.unitVehicleNetCost ?? product.adultNetPrice ?? 0)
    : Number(product.adultNetPrice ?? 0);
  const tax = Number(product.taxPercent ?? 0);
  const { serviceChargeType, serviceChargeValue } = resolveProductServiceFeeParams(product);
  const currency = (product.nativeCurrency || product.currency || 'USD') as CurrencyCode;

  if (status === 'INACTIVE') {
    return calculateUnifiedPrice({
      nettPrice: nett,
      quantity: 1,
      marginType: 'PERCENTAGE',
      marginValue: 0,
      taxPercent: tax,
      serviceChargeType,
      serviceChargeValue,
      currency
    }).finalPrice;
  }

  return calculateUnifiedPrice({
    nettPrice: nett,
    quantity: 1,
    marginType,
    marginValue,
    taxPercent: tax,
    serviceChargeType,
    serviceChargeValue,
    currency
  }).finalPrice;
}

export function buildMarginGovernanceRow(
  product: Product,
  config?: ProductMarginConfigRecord | null
): MarginGovernanceRow {
  const effectiveMarginType: 'PERCENTAGE' | 'FIXED' =
    config?.marginType === 'FIXED' || product.marginType === 'FIXED' ? 'FIXED' : 'PERCENTAGE';

  const rawPct =
    config?.b2bAgentMarkupPercent ??
    product.b2bAgentMarkupPercent ??
    product.defaultMarkupPercent;
  const rawFixed = config?.marginFixed ?? product.marginFixed;

  const effectiveMarginValue: number | null =
    config?.marginValue !== undefined && config?.marginValue !== null
      ? Number(config.marginValue)
      : effectiveMarginType === 'FIXED'
        ? (rawFixed !== undefined && rawFixed !== null ? Number(rawFixed) : null)
        : (rawPct !== undefined && rawPct !== null ? Number(rawPct) : null);

  const isExplicitInactive =
    config?.status === 'INACTIVE' ||
    product.marginStatus === 'INACTIVE' ||
    product.status === 'ARCHIVED';

  const configStatus: MarginConfigurationStatus = isExplicitInactive
    ? 'INACTIVE'
    : effectiveMarginValue !== null && Number.isFinite(effectiveMarginValue)
      ? 'CONFIGURED'
      : 'NOT_CONFIGURED';

  const isCap =
    product.pricingMethod === 'capacity_based' ||
    ['Private Tours', 'Transfers', 'Private Yacht', 'Ferry'].includes(String(product.category || ''));
  const baseNetCost = isCap
    ? Number(product.vehicleConfig?.unitVehicleNetCost ?? product.adultNetPrice ?? 0)
    : Number(product.adultNetPrice ?? 0);
  const currency = (product.nativeCurrency || product.currency || 'USD') as CurrencyCode;

  const currentSellingPrice =
    effectiveMarginValue !== null
      ? previewB2BSellingPriceForProduct({
          product,
          marginType: effectiveMarginType,
          marginValue: effectiveMarginValue,
          status: isExplicitInactive ? 'INACTIVE' : 'ACTIVE'
        })
      : Number(product.sellingPriceStartingFrom || 0);

  return {
    product,
    marginConfig: config || null,
    configStatus,
    effectiveMarginType,
    effectiveMarginValue,
    commissionPercent: Number(config?.commissionPercent ?? product.commissionPercent ?? 0),
    baseNetCost,
    currency,
    currentSellingPrice,
    version: Math.max(Number(config?.version || 0), Number(product.marginConfigVersion || 0)),
    updatedAt: config?.updatedAt || product.marginUpdatedAt || product.updatedAt || product.lastUpdated || '',
    updatedByName: config?.updatedByName || product.marginUpdatedByName || 'System',
    updatedByEmail: config?.updatedByEmail || product.marginUpdatedByEmail || ''
  };
}

export function queryLocalMarginGovernanceCatalog(
  filters: MarginGovernanceFilterParams = {}
): {
  summary: MarginGovernanceSummary;
  rows: MarginGovernanceRow[];
  totalFiltered: number;
  page: number;
  pageSize: number;
  totalPages: number;
} {
  const db = AppDatabase.getInstance();
  const products = db.getProducts();
  const configs = db.getProductMarginConfigs();
  const cfgMap = new Map<string, ProductMarginConfigRecord>();
  configs.forEach((c) => {
    if (c?.productId) cfgMap.set(c.productId, c);
  });

  const allRows = products.map((p) => buildMarginGovernanceRow(p, cfgMap.get(p.id)));
  const nowMs = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  const summary: MarginGovernanceSummary = {
    totalProducts: allRows.length,
    configuredCount: allRows.filter((r) => r.configStatus === 'CONFIGURED').length,
    unconfiguredCount: allRows.filter((r) => r.configStatus === 'NOT_CONFIGURED').length,
    inactiveCount: allRows.filter((r) => r.configStatus === 'INACTIVE').length,
    recentlyUpdatedCount: allRows.filter((r) => {
      const ts = r.updatedAt ? new Date(r.updatedAt).getTime() : 0;
      return ts > 0 && nowMs - ts <= sevenDaysMs;
    }).length
  };

  const q = (filters.search || '').trim().toLowerCase();
  const filtered = allRows.filter((row) => {
    const p = row.product;
    if (q) {
      const hay = `${p.name || ''} ${p.id || ''} ${p.sku || ''} ${p.destinationName || ''} ${p.city || ''} ${p.supplierName || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (filters.category && filters.category !== 'ALL' && p.category !== filters.category) return false;
    if (filters.destinationId && filters.destinationId !== 'ALL' && p.destinationId !== filters.destinationId) return false;
    if (filters.regionId && filters.regionId !== 'ALL' && p.regionId !== filters.regionId) return false;
    if (
      filters.hubId &&
      filters.hubId !== 'ALL' &&
      p.hubId !== filters.hubId &&
      !(Array.isArray(p.hubIds) && p.hubIds.includes(filters.hubId))
    ) {
      return false;
    }
    if (filters.supplierId && filters.supplierId !== 'ALL' && p.supplierId !== filters.supplierId) return false;
    if (filters.productStatus && filters.productStatus !== 'ALL' && p.status !== filters.productStatus) return false;
    if (filters.marginStatus && filters.marginStatus !== 'ALL' && row.configStatus !== filters.marginStatus) return false;
    return true;
  });

  const pageSize = Math.max(1, Math.min(100, filters.pageSize || 25));
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(Math.max(1, filters.page || 1), totalPages);
  const start = (page - 1) * pageSize;

  return {
    summary,
    rows: filtered.slice(start, start + pageSize),
    totalFiltered: filtered.length,
    page,
    pageSize,
    totalPages
  };
}

/**
 * Fetches server-filtered/paginated product margin governance records when authenticated in browser.
 * Returns null if no live browser session / backend endpoint is reachable.
 */
export async function fetchMarginGovernanceFromServer(
  filters: MarginGovernanceFilterParams = {}
): Promise<{
  summary: MarginGovernanceSummary;
  rows: MarginGovernanceRow[];
  totalFiltered: number;
  page: number;
  pageSize: number;
  totalPages: number;
} | null> {
  if (typeof window === 'undefined' || !auth.currentUser) {
    return null;
  }
  try {
    const token = await auth.currentUser.getIdToken();
    const qs = new URLSearchParams();
    if (filters.search) qs.set('q', filters.search);
    if (filters.category && filters.category !== 'ALL') qs.set('category', filters.category);
    if (filters.destinationId && filters.destinationId !== 'ALL') qs.set('destinationId', filters.destinationId);
    if (filters.regionId && filters.regionId !== 'ALL') qs.set('regionId', filters.regionId);
    if (filters.hubId && filters.hubId !== 'ALL') qs.set('hubId', filters.hubId);
    if (filters.supplierId && filters.supplierId !== 'ALL') qs.set('supplierId', filters.supplierId);
    if (filters.productStatus && filters.productStatus !== 'ALL') qs.set('productStatus', filters.productStatus);
    if (filters.marginStatus && filters.marginStatus !== 'ALL') qs.set('marginStatus', filters.marginStatus);
    qs.set('page', String(filters.page || 1));
    qs.set('pageSize', String(filters.pageSize || 25));

    const res = await fetch(`/api/admin/margins/products?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      return null;
    }
    const json = await res.json();
    if (!json?.success || !Array.isArray(json.rows)) {
      return null;
    }

    const mappedRows: MarginGovernanceRow[] = json.rows.map((entry: any) =>
      buildMarginGovernanceRow(entry.product as Product, entry.marginConfig as ProductMarginConfigRecord | null)
    );
    const updatedProducts = mappedRows.map((r) => r.product);
    const updatedConfigs = mappedRows
      .map((r) => r.marginConfig)
      .filter((c): c is ProductMarginConfigRecord => Boolean(c));
    if (updatedProducts.length > 0 || updatedConfigs.length > 0) {
      AppDatabase.getInstance().applySavedMarginGovernanceBatch(updatedProducts, updatedConfigs, []);
    }

    return {
      summary: json.summary,
      rows: mappedRows,
      totalFiltered: json.pagination?.totalItems ?? mappedRows.length,
      page: json.pagination?.page ?? (filters.page || 1),
      pageSize: json.pagination?.pageSize ?? (filters.pageSize || 25),
      totalPages: json.pagination?.totalPages ?? 1
    };
  } catch (err) {
    console.debug('[MarginGovernance] Server discovery fallback to local cache:', err);
    return null;
  }
}

export async function fetchProductMarginDetailFromServer(productId: string): Promise<{
  product?: Product;
  marginConfig?: ProductMarginConfigRecord | null;
  auditLogs: ProductMarginAuditRecord[];
} | null> {
  if (typeof window === 'undefined' || !auth.currentUser) {
    return null;
  }
  try {
    const token = await auth.currentUser.getIdToken();
    const res = await fetch(`/api/admin/margins/products/${encodeURIComponent(productId)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json?.success) return null;
    if (json.product) {
      AppDatabase.getInstance().applySavedMarginGovernanceBatch(
        [json.product],
        json.marginConfig ? [json.marginConfig] : [],
        Array.isArray(json.auditLogs) ? json.auditLogs : []
      );
    }
    return {
      product: json.product,
      marginConfig: json.marginConfig,
      auditLogs: Array.isArray(json.auditLogs) ? json.auditLogs : []
    };
  } catch {
    return null;
  }
}

/**
 * Commits an authoritative transactional update directly via Firebase SDK runTransaction
 * when backend REST endpoint is unavailable in browser, preserving rules & optimistic concurrency.
 */
async function commitViaFirestoreSdkTransaction(params: {
  productId: string;
  marginType: 'PERCENTAGE' | 'FIXED';
  marginValue: number;
  commissionPercent?: number;
  status?: 'ACTIVE' | 'INACTIVE';
  reason?: string;
  expectedVersion?: number;
  changeSource: 'MARGIN_GOVERNANCE' | 'PRODUCT_MANAGEMENT' | 'BULK_GOVERNANCE';
  actor: User;
  batchId?: string;
}): Promise<SaveProductMarginResponse> {
  const { productId, marginType, marginValue, commissionPercent, status, reason, expectedVersion, changeSource, actor, batchId } = params;
  const prodRef = doc(firestoreDb, 'products', productId);
  const cfgRef = doc(firestoreDb, 'product_margin_configs', productId);

  const txResult = await runTransaction(firestoreDb, async (tx) => {
    const [prodSnap, cfgSnap] = await Promise.all([tx.get(prodRef), tx.get(cfgRef)]);
    if (!prodSnap.exists()) {
      throw Object.assign(new Error(`Product "${productId}" was not found in Firestore.`), { code: 'NOT_FOUND' });
    }
    const product = { ...prodSnap.data(), id: prodSnap.id } as Product;
    const existingCfg = cfgSnap.exists() ? (cfgSnap.data() as ProductMarginConfigRecord) : null;
    const currentVersion = Math.max(Number(existingCfg?.version || 0), Number(product.marginConfigVersion || 0));

    if (expectedVersion !== undefined && expectedVersion !== currentVersion) {
      throw Object.assign(
        new Error(`Margin configuration for "${product.name || productId}" was modified concurrently (expected v${expectedVersion}, current v${currentVersion}).`),
        { code: 'VERSION_CONFLICT', currentVersion, currentConfig: existingCfg }
      );
    }

    const nowIso = new Date().toISOString();
    const nextVersion = currentVersion + 1;
    const nextStatus: 'ACTIVE' | 'INACTIVE' = status || existingCfg?.status || product.marginStatus || 'ACTIVE';
    const nextCommission =
      commissionPercent !== undefined
        ? commissionPercent
        : Number(existingCfg?.commissionPercent ?? product.commissionPercent ?? 0);
    const syncedPct =
      marginType === 'PERCENTAGE'
        ? marginValue
        : Number(product.b2bAgentMarkupPercent ?? product.defaultMarkupPercent ?? 0);
    const syncedFixed = marginType === 'FIXED' ? marginValue : 0;

    const recomputedSelling = previewB2BSellingPriceForProduct({
      product,
      marginType,
      marginValue,
      status: nextStatus
    });

    const prodFee = resolveProductServiceFeeParams(product);
    const updatedTiers = Array.isArray(product.tieredPricing) && product.tieredPricing.length > 0
      ? product.tieredPricing.map((t) => {
          const tNet = Number(t.supplierNett ?? t.nettPrice ?? t.netCostPerPax ?? product.adultNetPrice ?? 0);
          const tTax = t.taxValue !== undefined ? Number(t.taxValue) : Number(product.taxPercent ?? 0);
          const tFeeType: 'PERCENTAGE' | 'FIXED' =
            t.serviceChargeValue !== undefined
              ? (t.serviceChargeType === 'FIXED' ? 'FIXED' : 'PERCENTAGE')
              : prodFee.serviceChargeType;
          const tFeeVal = t.serviceChargeValue !== undefined ? Number(t.serviceChargeValue) : prodFee.serviceChargeValue;
          const tPrice = calculateUnifiedPrice({
            nettPrice: tNet,
            quantity: 1,
            marginType: nextStatus === 'INACTIVE' ? 'PERCENTAGE' : marginType,
            marginValue: nextStatus === 'INACTIVE' ? 0 : marginValue,
            taxPercent: tTax,
            serviceChargeType: tFeeType,
            serviceChargeValue: tFeeVal,
            currency: (t.currency || product.currency || 'USD') as CurrencyCode
          }).finalPrice;
          return {
            ...t,
            marginType,
            marginValue,
            finalPrice: tPrice,
            sellingPricePerPax: tPrice
          };
        })
      : product.tieredPricing;

    const actorUid = auth.currentUser?.uid || actor.id;
    const actorEmail = auth.currentUser?.email || actor.email || 'business@theunbound.in';
    const actorRole = actor.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'ADMIN';

    const productPatch: Partial<Product> = {
      defaultMarkupPercent: syncedPct,
      b2bAgentMarkupPercent: syncedPct,
      marginType,
      marginFixed: syncedFixed,
      commissionPercent: nextCommission,
      marginStatus: nextStatus,
      marginConfigVersion: nextVersion,
      sellingPriceStartingFrom: recomputedSelling,
      ...(Array.isArray(updatedTiers) ? { tieredPricing: updatedTiers } : {}),
      marginUpdatedAt: nowIso,
      marginUpdatedBy: actorUid,
      marginUpdatedByName: actor.name || actorEmail,
      marginUpdatedByEmail: actorEmail,
      marginLastChangeReason: reason || 'Updated in Margin & Commission Governance',
      updatedAt: nowIso,
      lastUpdated: nowIso.split('T')[0],
      updatedBy: actorUid,
      updatedByRole: actorRole,
      updatedByEmail: actorEmail
    } as any;

    const nextConfig: ProductMarginConfigRecord = {
      id: productId,
      productId,
      sku: product.sku || productId,
      productName: product.name || product.title || productId,
      category: String(product.category || ''),
      destinationId: product.destinationId || '',
      destinationName: product.destinationName || '',
      regionId: product.regionId,
      regionName: product.regionName,
      hubId: product.hubId,
      city: product.city,
      supplierId: product.supplierId,
      supplierName: product.supplierName,
      currency: product.nativeCurrency || product.currency || 'USD',
      marginType,
      marginValue,
      b2bAgentMarkupPercent: syncedPct,
      defaultMarkupPercent: syncedPct,
      marginFixed: syncedFixed,
      commissionPercent: nextCommission,
      isActive: nextStatus === 'ACTIVE',
      status: nextStatus,
      applicableScope: 'ALL_B2B',
      version: nextVersion,
      createdAt: existingCfg?.createdAt || nowIso,
      updatedAt: nowIso,
      updatedByUid: actorUid,
      updatedByEmail: actorEmail,
      updatedByName: actor.name || actorEmail,
      updatedByRole: actorRole,
      changeReason: reason || 'Updated via Margin & Commission Governance',
      changeSource,
      schemaVersion: 1
    };

    const prevVal = existingCfg?.marginValue ?? (product.b2bAgentMarkupPercent ?? product.defaultMarkupPercent ?? null);
    const logId = `PMA-${productId.replace(/[^a-zA-Z0-9_-]/g, '_')}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const auditLog: ProductMarginAuditRecord = {
      id: logId,
      productId,
      sku: product.sku || productId,
      productName: product.name || productId,
      action: !existingCfg ? 'MARGIN_CREATED' : (changeSource === 'BULK_GOVERNANCE' ? 'MARGIN_BULK_UPDATED' : 'MARGIN_UPDATED'),
      previousMarginType: (existingCfg?.marginType || product.marginType || 'PERCENTAGE') as 'PERCENTAGE' | 'FIXED',
      newMarginType: marginType,
      previousMarginValue: prevVal !== undefined ? Number(prevVal) : null,
      newMarginValue: marginValue,
      previousCommissionPercent: existingCfg?.commissionPercent ?? product.commissionPercent ?? null,
      newCommissionPercent: nextCommission,
      previousStatus: existingCfg ? existingCfg.status : (prevVal !== null ? 'ACTIVE' : 'NOT_CONFIGURED'),
      newStatus: nextStatus,
      previousVersion: currentVersion,
      newVersion: nextVersion,
      reason: reason || '',
      changeSource,
      ...(batchId ? { batchId } : {}),
      actorUid,
      actorEmail,
      actorName: actor.name || actorEmail,
      actorRole,
      timestamp: nowIso
    };

    tx.set(prodRef, cleanForFirestore(productPatch), { merge: true });
    tx.set(cfgRef, cleanForFirestore(nextConfig));
    tx.set(doc(firestoreDb, 'product_margin_audit_logs', logId), cleanForFirestore(auditLog));

    const updatedProduct: Product = { ...product, ...productPatch };
    return { updatedProduct, nextConfig, auditLog };
  });

  // Read back from Firestore to confirm
  const readBackSnap = await getDoc(prodRef);
  const confirmedProduct = readBackSnap.exists()
    ? ({ ...txResult.updatedProduct, ...readBackSnap.data(), id: productId } as Product)
    : txResult.updatedProduct;

  AppDatabase.getInstance().applySavedMarginGovernanceBatch(
    [confirmedProduct],
    [txResult.nextConfig],
    [txResult.auditLog]
  );
  clearPricingEngineCache();

  return {
    success: true,
    product: confirmedProduct,
    marginConfig: txResult.nextConfig,
    auditLog: txResult.auditLog,
    source: 'FIRESTORE_TRANSACTION'
  };
}

/**
 * Authoritative single-product Margin & Commission update.
 * 1. Enforces Admin/Finance RBAC.
 * 2. Strictly validates all fields (rejects empty/NaN/negative/malformed).
 * 3. Persists transactionally via backend API (/api/admin/margins/products/:productId)
 *    with optimistic concurrency check (expectedVersion) or verified Firestore transaction.
 * 4. Updates AppDatabase & invalidates pricing caches ONLY AFTER persistence confirms.
 */
export async function saveProductMargin(params: SaveProductMarginParams): Promise<SaveProductMarginResponse> {
  const rbac = canUserManageMargins(params.actor);
  if (!rbac.allowed) {
    return { success: false, code: 'FORBIDDEN', error: rbac.reason };
  }

  const validation = validateMarginGovernanceInput({
    marginType: params.marginType,
    marginValue: params.marginValue,
    commissionPercent: params.commissionPercent
  });
  if (!validation.valid || validation.marginValue === undefined) {
    return {
      success: false,
      code: 'VALIDATION_ERROR',
      error: validation.error || 'Invalid margin configuration input.'
    };
  }

  const changeSource = params.changeSource || 'MARGIN_GOVERNANCE';

  // Browser + Firebase Auth -> Call backend transactional endpoint first
  if (typeof window !== 'undefined' && auth.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch(`/api/admin/margins/products/${encodeURIComponent(params.productId)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          marginType: validation.marginType,
          marginValue: validation.marginValue,
          commissionPercent: validation.commissionPercent,
          status: params.status,
          reason: params.reason,
          expectedVersion: params.expectedVersion,
          changeSource
        })
      });

      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.success && json.product) {
        AppDatabase.getInstance().applySavedMarginGovernanceBatch(
          [json.product as Product],
          json.marginConfig ? [json.marginConfig as ProductMarginConfigRecord] : [],
          json.auditLog ? [json.auditLog as ProductMarginAuditRecord] : []
        );
        clearPricingEngineCache();
        return {
          success: true,
          product: json.product,
          marginConfig: json.marginConfig,
          auditLog: json.auditLog,
          source: 'BACKEND_TRANSACTION'
        };
      }

      if (res.status === 409) {
        return {
          success: false,
          code: 'VERSION_CONFLICT',
          error: json?.error || 'Concurrent edit conflict detected.',
          currentVersion: json?.currentVersion,
          currentConfig: json?.currentConfig || null
        };
      }
      if (res.status === 401 || res.status === 403) {
        return { success: false, code: 'FORBIDDEN', error: json?.error || 'Authorization denied.' };
      }
      if (res.status === 400) {
        return { success: false, code: 'VALIDATION_ERROR', error: json?.error || 'Validation failed.' };
      }
      if (res.status === 404) {
        return { success: false, code: 'NOT_FOUND', error: json?.error || 'Product not found.' };
      }

      // If server returned 503/500 (e.g. external REST network issue), attempt direct Firestore SDK transaction
      if (res.status >= 500) {
        return await commitViaFirestoreSdkTransaction({
          productId: params.productId,
          marginType: validation.marginType,
          marginValue: validation.marginValue,
          commissionPercent: validation.commissionPercent,
          status: params.status,
          reason: params.reason,
          expectedVersion: params.expectedVersion,
          changeSource,
          actor: params.actor!
        });
      }

      return {
        success: false,
        code: 'PERSISTENCE_FAILED',
        error: json?.error || `Failed to save margin (HTTP ${res.status}).`
      };
    } catch (err: any) {
      if (err?.code === 'VERSION_CONFLICT') {
        return {
          success: false,
          code: 'VERSION_CONFLICT',
          error: err.message,
          currentVersion: err.currentVersion,
          currentConfig: err.currentConfig
        };
      }
      try {
        return await commitViaFirestoreSdkTransaction({
          productId: params.productId,
          marginType: validation.marginType,
          marginValue: validation.marginValue,
          commissionPercent: validation.commissionPercent,
          status: params.status,
          reason: params.reason,
          expectedVersion: params.expectedVersion,
          changeSource,
          actor: params.actor!
        });
      } catch (txErr: any) {
        if (txErr?.code === 'VERSION_CONFLICT') {
          return {
            success: false,
            code: 'VERSION_CONFLICT',
            error: txErr.message,
            currentVersion: txErr.currentVersion,
            currentConfig: txErr.currentConfig
          };
        }
        return {
          success: false,
          code: 'PERSISTENCE_FAILED',
          error: txErr?.message || err?.message || 'Unable to persist margin configuration to Firestore.'
        };
      }
    }
  }

  // Deterministic transactional execution for Node/test environments without live Firebase browser session
  const db = AppDatabase.getInstance();
  const product = db.getProductById(params.productId);
  if (!product) {
    return {
      success: false,
      code: 'NOT_FOUND',
      error: `Product "${params.productId}" was not found.`
    };
  }

  const existingConfigs = db.getProductMarginConfigs();
  const existingCfg = existingConfigs.find((c) => c.productId === product.id) || null;
  const currentVersion = Math.max(Number(existingCfg?.version || 0), Number(product.marginConfigVersion || 0));

  if (params.expectedVersion !== undefined && params.expectedVersion !== currentVersion) {
    return {
      success: false,
      code: 'VERSION_CONFLICT',
      error: `Margin configuration for "${product.name}" was updated concurrently (expected v${params.expectedVersion}, latest v${currentVersion}).`,
      currentVersion,
      currentConfig: existingCfg
    };
  }

  const nowIso = new Date().toISOString();
  const nextVersion = currentVersion + 1;
  const nextStatus: 'ACTIVE' | 'INACTIVE' = params.status || existingCfg?.status || product.marginStatus || 'ACTIVE';
  const nextCommission =
    validation.commissionPercent !== undefined
      ? validation.commissionPercent
      : Number(existingCfg?.commissionPercent ?? product.commissionPercent ?? 0);
  const syncedPct =
    validation.marginType === 'PERCENTAGE'
      ? validation.marginValue
      : Number(product.b2bAgentMarkupPercent ?? product.defaultMarkupPercent ?? 0);
  const syncedFixed = validation.marginType === 'FIXED' ? validation.marginValue : 0;

  const prodFeeLocal = resolveProductServiceFeeParams(product);
  const updatedTiers = Array.isArray(product.tieredPricing) && product.tieredPricing.length > 0
    ? product.tieredPricing.map((t) => {
        const tNet = Number(t.supplierNett ?? t.nettPrice ?? t.netCostPerPax ?? product.adultNetPrice ?? 0);
        const tTax = t.taxValue !== undefined ? Number(t.taxValue) : Number(product.taxPercent ?? 0);
        const tFeeType: 'PERCENTAGE' | 'FIXED' =
          t.serviceChargeValue !== undefined
            ? (t.serviceChargeType === 'FIXED' ? 'FIXED' : 'PERCENTAGE')
            : prodFeeLocal.serviceChargeType;
        const tFeeVal = t.serviceChargeValue !== undefined ? Number(t.serviceChargeValue) : prodFeeLocal.serviceChargeValue;
        const tPrice = calculateUnifiedPrice({
          nettPrice: tNet,
          quantity: 1,
          marginType: nextStatus === 'INACTIVE' ? 'PERCENTAGE' : validation.marginType,
          marginValue: nextStatus === 'INACTIVE' ? 0 : validation.marginValue!,
          taxPercent: tTax,
          serviceChargeType: tFeeType,
          serviceChargeValue: tFeeVal,
          currency: (t.currency || product.currency || 'USD') as CurrencyCode
        }).finalPrice;
        return {
          ...t,
          marginType: validation.marginType,
          marginValue: validation.marginValue,
          finalPrice: tPrice,
          sellingPricePerPax: tPrice
        };
      })
    : product.tieredPricing;

  const recomputedSelling = previewB2BSellingPriceForProduct({
    product,
    marginType: validation.marginType,
    marginValue: validation.marginValue,
    status: nextStatus
  });

  const actor = params.actor!;
  const updatedProduct: Product = {
    ...product,
    defaultMarkupPercent: syncedPct,
    b2bAgentMarkupPercent: syncedPct,
    marginType: validation.marginType,
    marginFixed: syncedFixed,
    commissionPercent: nextCommission,
    marginStatus: nextStatus,
    marginConfigVersion: nextVersion,
    sellingPriceStartingFrom: recomputedSelling,
    ...(Array.isArray(updatedTiers) ? { tieredPricing: updatedTiers } : {}),
    marginUpdatedAt: nowIso,
    marginUpdatedBy: actor.id,
    marginUpdatedByName: actor.name,
    marginUpdatedByEmail: actor.email,
    marginLastChangeReason: params.reason || 'Updated via Margin & Commission Governance',
    updatedAt: nowIso,
    lastUpdated: nowIso.split('T')[0]
  };

  const marginConfig: ProductMarginConfigRecord = {
    id: product.id,
    productId: product.id,
    sku: product.sku || product.id,
    productName: product.name || product.title || product.id,
    category: String(product.category || ''),
    destinationId: product.destinationId || '',
    destinationName: product.destinationName || '',
    regionId: product.regionId,
    regionName: product.regionName,
    hubId: product.hubId,
    city: product.city,
    supplierId: product.supplierId,
    supplierName: product.supplierName,
    currency: product.nativeCurrency || product.currency || 'USD',
    marginType: validation.marginType,
    marginValue: validation.marginValue,
    b2bAgentMarkupPercent: syncedPct,
    defaultMarkupPercent: syncedPct,
    marginFixed: syncedFixed,
    commissionPercent: nextCommission,
    isActive: nextStatus === 'ACTIVE',
    status: nextStatus,
    applicableScope: 'ALL_B2B',
    version: nextVersion,
    createdAt: existingCfg?.createdAt || nowIso,
    updatedAt: nowIso,
    updatedByUid: actor.id,
    updatedByEmail: actor.email,
    updatedByName: actor.name,
    updatedByRole: actor.role,
    changeReason: params.reason || 'Updated via Margin & Commission Governance',
    changeSource,
    schemaVersion: 1
  };

  const prevVal = existingCfg?.marginValue ?? (product.b2bAgentMarkupPercent ?? product.defaultMarkupPercent ?? null);
  const logId = `PMA-${product.id.replace(/[^a-zA-Z0-9_-]/g, '_')}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const auditLog: ProductMarginAuditRecord = {
    id: logId,
    productId: product.id,
    sku: product.sku || product.id,
    productName: product.name || product.id,
    action: !existingCfg ? 'MARGIN_CREATED' : (changeSource === 'BULK_GOVERNANCE' ? 'MARGIN_BULK_UPDATED' : 'MARGIN_UPDATED'),
    previousMarginType: (existingCfg?.marginType || product.marginType || 'PERCENTAGE') as 'PERCENTAGE' | 'FIXED',
    newMarginType: validation.marginType,
    previousMarginValue: prevVal !== undefined ? Number(prevVal) : null,
    newMarginValue: validation.marginValue,
    previousCommissionPercent: existingCfg?.commissionPercent ?? product.commissionPercent ?? null,
    newCommissionPercent: nextCommission,
    previousStatus: existingCfg ? existingCfg.status : (prevVal !== null ? 'ACTIVE' : 'NOT_CONFIGURED'),
    newStatus: nextStatus,
    previousVersion: currentVersion,
    newVersion: nextVersion,
    reason: params.reason,
    changeSource,
    actorUid: actor.id,
    actorEmail: actor.email,
    actorName: actor.name,
    actorRole: actor.role,
    timestamp: nowIso
  };

  db.applySavedMarginGovernanceBatch([updatedProduct], [marginConfig], [auditLog]);
  clearPricingEngineCache();

  return {
    success: true,
    product: updatedProduct,
    marginConfig,
    auditLog,
    source: 'LOCAL_STORE_AUDIT'
  };
}

/**
 * Bounded bulk update with explicit validation, per-product isolation, and partial failure reporting.
 */
export async function bulkSaveProductMargins(params: BulkMarginSaveParams): Promise<BulkMarginSaveResponse> {
  const batchId = `BULK-MG-${Date.now()}`;
  const uniqueIds = Array.from(new Set((params.productIds || []).map((id) => String(id || '').trim()).filter(Boolean)));

  const rbac = canUserManageMargins(params.actor);
  if (!rbac.allowed) {
    return {
      success: false,
      partialSuccess: false,
      batchId,
      totalRequested: uniqueIds.length,
      succeededIds: [],
      failedItems: uniqueIds.map((id) => ({ productId: id, code: 'FORBIDDEN', error: rbac.reason || 'Forbidden' })),
      updatedProducts: [],
      updatedConfigs: [],
      auditLogs: [],
      error: rbac.reason
    };
  }

  if (uniqueIds.length === 0) {
    return {
      success: false,
      partialSuccess: false,
      batchId,
      totalRequested: 0,
      succeededIds: [],
      failedItems: [],
      updatedProducts: [],
      updatedConfigs: [],
      auditLogs: [],
      error: 'Select at least one product to apply bulk margin configuration.'
    };
  }

  if (uniqueIds.length > 100) {
    return {
      success: false,
      partialSuccess: false,
      batchId,
      totalRequested: uniqueIds.length,
      succeededIds: [],
      failedItems: [],
      updatedProducts: [],
      updatedConfigs: [],
      auditLogs: [],
      error: 'Bulk updates are limited to 100 products per batch.'
    };
  }

  const validation = validateMarginGovernanceInput({
    marginType: params.marginType,
    marginValue: params.marginValue,
    commissionPercent: params.applyCommissionUpdate ? params.commissionPercent : undefined
  });
  if (!validation.valid || validation.marginValue === undefined) {
    return {
      success: false,
      partialSuccess: false,
      batchId,
      totalRequested: uniqueIds.length,
      succeededIds: [],
      failedItems: [],
      updatedProducts: [],
      updatedConfigs: [],
      auditLogs: [],
      error: validation.error || 'Invalid bulk margin payload.'
    };
  }

  // Call backend bulk endpoint when running in authenticated browser session (and no test failure simulation requested)
  if (typeof window !== 'undefined' && auth.currentUser && !params.simulateFailureForProductIds?.length) {
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch('/api/admin/margins/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          productIds: uniqueIds,
          marginType: validation.marginType,
          marginValue: validation.marginValue,
          ...(params.applyCommissionUpdate && validation.commissionPercent !== undefined
            ? { commissionPercent: validation.commissionPercent }
            : {}),
          status: params.status,
          reason: params.reason,
          expectedVersions: params.expectedVersions,
          batchId
        })
      });

      const json = await res.json().catch(() => ({}));
      if (json && Array.isArray(json.updatedProducts)) {
        AppDatabase.getInstance().applySavedMarginGovernanceBatch(
          json.updatedProducts as Product[],
          (json.updatedConfigs || []) as ProductMarginConfigRecord[],
          (json.auditLogs || []) as ProductMarginAuditRecord[]
        );
        clearPricingEngineCache();
        const db = AppDatabase.getInstance();
        return {
          success: Boolean(json.success),
          partialSuccess: Boolean(json.partialSuccess),
          batchId: json.batchId || batchId,
          totalRequested: uniqueIds.length,
          succeededIds: json.succeededIds || [],
          failedItems: (json.failedItems || []).map((f: any) => {
            const prod = db.getProductById(f.productId);
            return {
              productId: f.productId,
              sku: prod?.sku,
              productName: prod?.name,
              code: f.code || 'FAILED',
              error: f.error || 'Failed to update product margin.'
            };
          }),
          updatedProducts: json.updatedProducts,
          updatedConfigs: json.updatedConfigs || [],
          auditLogs: json.auditLogs || [],
          error: json.error
        };
      }
    } catch (err) {
      console.debug('[MarginGovernance] Bulk endpoint fallback to per-item transactional save:', err);
    }
  }

  // Per-item isolated execution (guarantees partial failures never corrupt successful or unselected products)
  const db = AppDatabase.getInstance();
  const simulatedFailures = new Set(params.simulateFailureForProductIds || []);
  const succeededIds: string[] = [];
  const failedItems: BulkMarginSaveResponse['failedItems'] = [];
  const updatedProducts: Product[] = [];
  const updatedConfigs: ProductMarginConfigRecord[] = [];
  const auditLogs: ProductMarginAuditRecord[] = [];

  for (const pid of uniqueIds) {
    const prodSnapshot = db.getProductById(pid);
    if (simulatedFailures.has(pid)) {
      failedItems.push({
        productId: pid,
        sku: prodSnapshot?.sku,
        productName: prodSnapshot?.name,
        code: 'TRANSIENT_WRITE_ERROR',
        error: `Simulated persistence failure for "${prodSnapshot?.name || pid}". Retry safely.`
      });
      continue;
    }

    const r = await saveProductMargin({
      productId: pid,
      marginType: validation.marginType,
      marginValue: validation.marginValue,
      commissionPercent: params.applyCommissionUpdate ? validation.commissionPercent : undefined,
      status: params.status,
      reason: params.reason || `Bulk governance update (${batchId})`,
      expectedVersion: params.expectedVersions?.[pid],
      changeSource: 'BULK_GOVERNANCE',
      actor: params.actor
    });

    if (r.success && r.product) {
      succeededIds.push(pid);
      updatedProducts.push(r.product);
      if (r.marginConfig) updatedConfigs.push(r.marginConfig);
      if (r.auditLog) auditLogs.push(r.auditLog);
    } else {
      failedItems.push({
        productId: pid,
        sku: prodSnapshot?.sku,
        productName: prodSnapshot?.name,
        code: r.code || 'PERSISTENCE_FAILED',
        error: r.error || 'Failed to persist product margin.'
      });
    }
  }

  return {
    success: failedItems.length === 0,
    partialSuccess: succeededIds.length > 0 && failedItems.length > 0,
    batchId,
    totalRequested: uniqueIds.length,
    succeededIds,
    failedItems,
    updatedProducts,
    updatedConfigs,
    auditLogs
  };
}
