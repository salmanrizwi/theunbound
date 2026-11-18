import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  History,
  Eye,
  RotateCcw,
  GitCompare,
  CheckCircle2,
  ShieldCheck,
  Calendar,
  Users,
  MapPin,
  Package,
  RefreshCw,
  ArrowRight,
  ExternalLink,
  Lock,
  FileText,
  AlertCircle
} from 'lucide-react';
import { Quotation, QuoteItem, QuoteVersionRecord, TripRouteHub, User } from '../../types';
import { AppDatabase } from '../../services/db';
import { canUserViewInternalCostBreakdown } from '../../services/permissionEngine';
import { formatCurrency } from '../../services/pricingEngine';

export interface QuotationVersionDiffResult {
  versionA: QuoteVersionRecord;
  versionB: QuoteVersionRecord;
  priceA: number;
  priceB: number;
  priceDelta: number;
  currencyChanged: boolean;
  datesChanged: boolean;
  paxChanged: boolean;
  scopeChanged: boolean;
  brandingChanged: boolean;
  hubDiffs: Array<{
    key: string;
    hubName: string;
    changeType: 'ADDED' | 'REMOVED' | 'MODIFIED';
    detail: string;
  }>;
  itemDiffs: Array<{
    key: string;
    name: string;
    category: string;
    changeType: 'ADDED' | 'REMOVED' | 'MODIFIED';
    detail: string;
  }>;
  unchangedItemsCount: number;
  netCostDelta?: number;
  marginDelta?: number;
}

export function computeQuotationVersionDiff(
  versionA: QuoteVersionRecord,
  versionB: QuoteVersionRecord,
  includeInternalCostDiff = false
): QuotationVersionDiffResult {
  const priceA = Number(versionA.totalSellingPrice ?? versionA.authoritativeSnapshot?.pricing?.finalCustomerSellingPrice ?? 0);
  const priceB = Number(versionB.totalSellingPrice ?? versionB.authoritativeSnapshot?.pricing?.finalCustomerSellingPrice ?? 0);
  const currA = versionA.currency || 'USD';
  const currB = versionB.currency || 'USD';

  const hubsA = Array.isArray(versionA.routeHubs) ? versionA.routeHubs : [];
  const hubsB = Array.isArray(versionB.routeHubs) ? versionB.routeHubs : [];
  const hubKey = (h: TripRouteHub, idx: number) =>
    (h.itineraryHubOccurrenceId || h.id)
      ? String(h.itineraryHubOccurrenceId || h.id)
      : `${h.hubId || h.hubName}::${idx}`;
  const hubMapA = new Map<string, TripRouteHub>();
  const hubMapB = new Map<string, TripRouteHub>();
  hubsA.forEach((h, idx) => hubMapA.set(hubKey(h, idx), h));
  hubsB.forEach((h, idx) => hubMapB.set(hubKey(h, idx), h));

  const hubDiffs: QuotationVersionDiffResult['hubDiffs'] = [];
  const allHubKeys = new Set([...hubMapA.keys(), ...hubMapB.keys()]);
  allHubKeys.forEach(k => {
    const a = hubMapA.get(k);
    const b = hubMapB.get(k);
    if (!a && b) {
      hubDiffs.push({
        key: k,
        hubName: b.hubName || 'Hub',
        changeType: 'ADDED',
        detail: `${b.nights || 1}N (${b.accommodationType || 'STANDARD'})`
      });
    } else if (a && !b) {
      hubDiffs.push({
        key: k,
        hubName: a.hubName || 'Hub',
        changeType: 'REMOVED',
        detail: `Was ${a.nights || 1}N`
      });
    } else if (a && b) {
      const diffs: string[] = [];
      if ((a.hubName || '') !== (b.hubName || '')) {
        diffs.push(`Hub: ${a.hubName || 'Hub'} → ${b.hubName || 'Hub'}`);
      }
      if ((a.nights || 0) !== (b.nights || 0)) {
        diffs.push(`Nights: ${a.nights || 0}N → ${b.nights || 0}N`);
      }
      if ((a.order || 0) !== (b.order || 0)) {
        diffs.push(`Sequence: Stop #${a.order || 0} → Stop #${b.order || 0}`);
      }
      if ((a.hotelId || '') !== (b.hotelId || '') || (a.manualHotel?.hotelName || '') !== (b.manualHotel?.hotelName || '')) {
        diffs.push('Hotel assignment changed');
      }
      if ((a.checkInDate || '') !== (b.checkInDate || '') || (a.checkOutDate || '') !== (b.checkOutDate || '')) {
        diffs.push('Stay dates updated');
      }
      if ((a.accommodationType || '') !== (b.accommodationType || '')) {
        diffs.push(`Scope: ${a.accommodationType || 'Default'} → ${b.accommodationType || 'Default'}`);
      }
      if (diffs.length > 0) {
        hubDiffs.push({
          key: k,
          hubName: b.hubName || a.hubName || 'Hub',
          changeType: 'MODIFIED',
          detail: diffs.join(' · ')
        });
      }
    }
  });

  const itemsA = Array.isArray(versionA.items) ? versionA.items : [];
  const itemsB = Array.isArray(versionB.items) ? versionB.items : [];
  const itemKey = (it: QuoteItem, idx: number) =>
    it.id ? String(it.id) : `${it.product?.id || it.product?.name || 'item'}::${it.travelDate || ''}::${idx}`;
  const itemMapA = new Map<string, QuoteItem>();
  const itemMapB = new Map<string, QuoteItem>();
  itemsA.forEach((it, idx) => itemMapA.set(itemKey(it, idx), it));
  itemsB.forEach((it, idx) => itemMapB.set(itemKey(it, idx), it));

  const itemDiffs: QuotationVersionDiffResult['itemDiffs'] = [];
  let unchangedItemsCount = 0;
  const allItemKeys = new Set([...itemMapA.keys(), ...itemMapB.keys()]);
  allItemKeys.forEach(k => {
    const a = itemMapA.get(k);
    const b = itemMapB.get(k);
    if (!a && b) {
      itemDiffs.push({
        key: k,
        name: b.product?.name || b.notes || 'Quotation Service',
        category: b.product?.category || b.product?.productType || 'Service',
        changeType: 'ADDED',
        detail: `${b.travelDate || 'Flexible date'} · ${currB} ${Number(b.calculation?.finalTotalSellingPrice || 0).toLocaleString()}`
      });
    } else if (a && !b) {
      itemDiffs.push({
        key: k,
        name: a.product?.name || a.notes || 'Quotation Service',
        category: a.product?.category || a.product?.productType || 'Service',
        changeType: 'REMOVED',
        detail: `Removed (${a.travelDate || 'Flexible date'})`
      });
    } else if (a && b) {
      const diffs: string[] = [];
      if ((a.product?.name || '') !== (b.product?.name || '')) {
        diffs.push(`Service: ${a.product?.name || 'Previous'} → ${b.product?.name || 'Updated'}`);
      }
      const pa = Number(a.calculation?.finalTotalSellingPrice || 0);
      const pb = Number(b.calculation?.finalTotalSellingPrice || 0);
      if (Math.abs(pa - pb) > 0.01) {
        diffs.push(`Price: ${pa.toLocaleString()} → ${pb.toLocaleString()}`);
      }
      if ((a.travelDate || '') !== (b.travelDate || '')) {
        diffs.push(`Date: ${a.travelDate || '—'} → ${b.travelDate || '—'}`);
      }
      if (
        (a.pax?.adults || 0) !== (b.pax?.adults || 0) ||
        (a.pax?.children || 0) !== (b.pax?.children || 0)
      ) {
        diffs.push(`Pax: ${a.pax?.adults || 0}A/${a.pax?.children || 0}C → ${b.pax?.adults || 0}A/${b.pax?.children || 0}C`);
      }
      if (diffs.length > 0) {
        itemDiffs.push({
          key: k,
          name: b.product?.name || a.product?.name || 'Service',
          category: b.product?.category || b.product?.productType || 'Service',
          changeType: 'MODIFIED',
          detail: diffs.join(' · ')
        });
      } else {
        unchangedItemsCount += 1;
      }
    }
  });

  const netA = Number(versionA.totalNetCost ?? 0);
  const netB = Number(versionB.totalNetCost ?? 0);
  const marginA = Number(versionA.marginAmount ?? (priceA - netA));
  const marginB = Number(versionB.marginAmount ?? (priceB - netB));

  return {
    versionA,
    versionB,
    priceA,
    priceB,
    priceDelta: priceB - priceA,
    currencyChanged: currA !== currB,
    datesChanged:
      (versionA.travelStartDate || '') !== (versionB.travelStartDate || '') ||
      (versionA.travelEndDate || '') !== (versionB.travelEndDate || ''),
    paxChanged:
      (versionA.adultsCount || 0) !== (versionB.adultsCount || 0) ||
      (versionA.childrenCount || 0) !== (versionB.childrenCount || 0) ||
      (versionA.infantsCount || 0) !== (versionB.infantsCount || 0),
    scopeChanged: (versionA.quotationScope || 'HOTEL_LAND') !== (versionB.quotationScope || 'HOTEL_LAND'),
    brandingChanged: (versionA.brandingMode || 'STANDARD') !== (versionB.brandingMode || 'STANDARD'),
    hubDiffs,
    itemDiffs,
    unchangedItemsCount,
    ...(includeInternalCostDiff
      ? {
          netCostDelta: netB - netA,
          marginDelta: marginB - marginA
        }
      : {})
  };
}

export interface QuotationVersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  quoteId: string;
  initialQuote?: Quotation | null;
  currentUser: User | null;
  initialTab?: 'HISTORY' | 'INSPECT' | 'COMPARE';
  initialVersion?: number;
  onOpenVersion?: (quoteId: string, version: number, mode: 'inspect' | 'readonly') => void;
  onRestoreVersion?: (quoteId: string, version: number) => void;
}

export const QuotationVersionHistoryModal: React.FC<QuotationVersionHistoryModalProps> = ({
  isOpen,
  onClose,
  quoteId,
  initialQuote,
  currentUser,
  initialTab = 'HISTORY',
  initialVersion,
  onOpenVersion,
  onRestoreVersion
}) => {
  const db = AppDatabase.getInstance();
  const canViewInternalCosts = useMemo(
    () => canUserViewInternalCostBreakdown(currentUser),
    [currentUser]
  );

  const [refreshTick, setRefreshTick] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<'HISTORY' | 'INSPECT' | 'COMPARE'>(initialTab);
  const [inspectedVersionNum, setInspectedVersionNum] = useState<number | null>(initialVersion ?? null);
  const [compareLeftVer, setCompareLeftVer] = useState<number | null>(null);
  const [compareRightVer, setCompareRightVer] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen || !quoteId) return;
    setActiveTab(initialTab);
    if (initialVersion) {
      setInspectedVersionNum(initialVersion);
    }
    let cancelled = false;
    setIsSyncing(true);
    db.fetchQuotationVersionsFromFirestoreAsync(quoteId, currentUser)
      .then(() => {
        if (!cancelled) {
          setRefreshTick(t => t + 1);
          setIsSyncing(false);
        }
      })
      .catch(() => {
        if (!cancelled) setIsSyncing(false);
      });

    const unsub = db.subscribeToCollections(['quotations', `quote_versions_${quoteId}`], () => {
      setRefreshTick(t => t + 1);
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [isOpen, quoteId, currentUser, initialTab, initialVersion, db]);

  const quoteRecord = useMemo(() => {
    return db.getQuoteByIdAuthorized(quoteId, currentUser) || initialQuote || null;
  }, [db, quoteId, currentUser, initialQuote, refreshTick]);

  const versions = useMemo(() => {
    if (!quoteId) return [];
    return db.getQuotationVersions(quoteId, currentUser);
  }, [db, quoteId, currentUser, refreshTick]);

  // Initialize default compare versions cleanly when versions list updates
  useEffect(() => {
    if (versions.length === 0) return;
    const latestVer = versions[0].version;
    const prevVer = versions[1]?.version ?? latestVer;
    setCompareRightVer(curr => (curr && versions.some(v => v.version === curr) ? curr : latestVer));
    setCompareLeftVer(curr => (curr && versions.some(v => v.version === curr) ? curr : prevVer));
    setInspectedVersionNum(curr => (curr && versions.some(v => v.version === curr) ? curr : latestVer));
  }, [versions]);

  // Hydrate split-document sections on demand whenever inspecting or comparing a version
  useEffect(() => {
    if (!isOpen || !quoteId || versions.length === 0) return;
    const needed: number[] = [];
    if (activeTab === 'INSPECT' && inspectedVersionNum) {
      needed.push(inspectedVersionNum);
    } else if (activeTab === 'COMPARE') {
      if (compareLeftVer) needed.push(compareLeftVer);
      if (compareRightVer && compareRightVer !== compareLeftVer) needed.push(compareRightVer);
    }
    const unhydrated = needed.filter(verNum => {
      const match = versions.find(v => v.version === verNum);
      return match && match.storageFormat === 'SPLIT_SECTIONS_V2' && !match.hasHydratedSections;
    });
    if (unhydrated.length === 0) return;

    let cancelled = false;
    setIsSyncing(true);
    Promise.all(unhydrated.map(verNum => db.loadQuotationVersionFullAsync(quoteId, verNum, currentUser).catch(() => null)))
      .finally(() => {
        if (!cancelled) {
          setRefreshTick(t => t + 1);
          setIsSyncing(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, quoteId, activeTab, inspectedVersionNum, compareLeftVer, compareRightVer, versions, currentUser, db]);

  const inspectedVersion = useMemo(
    () => versions.find(v => v.version === inspectedVersionNum) || versions[0] || null,
    [versions, inspectedVersionNum]
  );

  const compareDiff = useMemo(() => {
    const left = versions.find(v => v.version === compareLeftVer);
    const right = versions.find(v => v.version === compareRightVer);
    if (!left || !right) return null;
    return computeQuotationVersionDiff(left, right, canViewInternalCosts);
  }, [versions, compareLeftVer, compareRightVer, canViewInternalCosts]);

  if (!isOpen) return null;

  const latestVerNumber = versions[0]?.version || quoteRecord?.latestVersion || quoteRecord?.version || 1;
  const displayQuoteRef = quoteRecord?.quoteNumber || quoteId;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/65 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={`Version History for ${displayQuoteRef}`}
    >
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] my-auto">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950 text-white flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#00C6A6]/15 border border-[#00C6A6]/40 text-[#00E5C0] flex items-center justify-center shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-slate-800 text-[#00E5C0] border border-slate-700">
                  {displayQuoteRef}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  LATEST: v{latestVerNumber}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300">
                  {versions.length} Saved {versions.length === 1 ? 'Version' : 'Versions'}
                </span>
              </div>
              <h3 className="text-sm font-black text-white truncate mt-1">
                {quoteRecord?.title || `Quotation ${displayQuoteRef}`}
              </h3>
              <p className="text-[11px] text-slate-400 truncate">
                {quoteRecord?.clientName || 'Client'}
                {quoteRecord?.agentAgency ? ` · ${quoteRecord.agentAgency}` : ''}
                {quoteRecord?.destination ? ` · ${quoteRecord.destination}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setIsSyncing(true);
                db.fetchQuotationVersionsFromFirestoreAsync(quoteId, currentUser)
                  .finally(() => {
                    setRefreshTick(t => t + 1);
                    setIsSyncing(false);
                  });
              }}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Refresh saved versions from Firestore"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-[#00E5C0]' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              aria-label="Close Version History"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('HISTORY')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'HISTORY'
                  ? 'bg-slate-900 text-[#00E5C0]'
                  : 'text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Version Timeline ({versions.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('INSPECT')}
              disabled={!inspectedVersion}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-40 ${
                activeTab === 'INSPECT'
                  ? 'bg-slate-900 text-[#00E5C0]'
                  : 'text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Snapshot Inspector{inspectedVersion ? ` (v${inspectedVersion.version})` : ''}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('COMPARE')}
              disabled={versions.length < 2}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-40 ${
                activeTab === 'COMPARE'
                  ? 'bg-slate-900 text-[#00E5C0]'
                  : 'text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              <GitCompare className="w-3.5 h-3.5" />
              <span>Compare Versions</span>
            </button>
          </div>

          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-teal-600" />
            <span>Saved snapshots are immutable. Versions are created only via Save Draft.</span>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/40">
          {versions.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-2">
              <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
              <h4 className="text-sm font-bold text-slate-900">No Saved Versions Found</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Click <strong>Save Draft</strong> inside the Quote Builder to record the first immutable saved version (v1).
              </p>
            </div>
          ) : activeTab === 'HISTORY' ? (
            <div className="space-y-3">
              {versions.map(v => {
                const isLatest = Boolean(v.isLatest || v.version === latestVerNumber);
                const curr = v.currency || quoteRecord?.currency || 'USD';
                const totalSelling = Number(v.totalSellingPrice ?? 0);
                return (
                  <div
                    key={v.id || `${quoteId}__v${v.version}`}
                    className={`rounded-2xl border p-4 bg-white transition-all shadow-2xs ${
                      isLatest ? 'border-teal-300 ring-1 ring-teal-500/20' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-lg font-mono text-xs font-black bg-slate-900 text-[#00E5C0]">
                            v{v.version}
                          </span>
                          {isLatest && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              LATEST
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-teal-600" />
                            Immutable
                          </span>
                          {v.restoredFromVersion && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              Restored from v{v.restoredFromVersion}
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                            {v.status || quoteRecord?.status || 'DRAFT'}
                          </span>
                        </div>

                        <p className="text-xs font-bold text-slate-900">
                          {v.changesSummary || `Saved quotation version v${v.version}`}
                        </p>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                          <span>
                            Saved {new Date(v.createdAt || v.updatedAt).toLocaleString()}
                          </span>
                          <span>
                            By <strong className="text-slate-700">{v.savedByName || v.updatedBy || 'Consultant'}</strong>
                            {v.savedByRole ? ` (${v.savedByRole})` : ''}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {v.totalHubs ?? (v.routeHubs || []).length} Hubs
                          </span>
                          <span className="flex items-center gap-1">
                            <Package className="w-3 h-3 text-slate-400" />
                            {v.totalItems ?? (v.items || []).length} Services
                          </span>
                          {v.totalPax && (
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3 text-slate-400" />
                              {v.totalPax} Pax
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3 shrink-0">
                        <div className="text-left lg:text-right pr-2">
                          <span className="text-[10px] font-bold uppercase text-slate-400 block">
                            Customer Selling Total
                          </span>
                          <span className="text-base font-black text-slate-900 font-mono">
                            {formatCurrency(totalSelling, curr as any)}
                          </span>
                          {canViewInternalCosts && v.totalNetCost !== undefined && (
                            <span className="block text-[10px] text-indigo-700 font-semibold">
                              Nett: {formatCurrency(Number(v.totalNetCost || 0), curr as any)} · Margin: {formatCurrency(Number(v.totalMargin ?? (totalSelling - Number(v.totalNetCost || 0))), curr as any)}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setInspectedVersionNum(v.version);
                              setActiveTab('INSPECT');
                            }}
                            className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-teal-600" />
                            <span>View Version</span>
                          </button>

                          {onOpenVersion && (
                            <button
                              type="button"
                              onClick={() => {
                                onOpenVersion(quoteId, v.version, isLatest ? 'inspect' : 'readonly');
                                onClose();
                              }}
                              className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                              title={`Open immutable snapshot v${v.version} in Builder (read-only)`}
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Open Version</span>
                            </button>
                          )}

                          {versions.length >= 2 && (
                            <button
                              type="button"
                              onClick={() => {
                                setCompareLeftVer(v.version);
                                setCompareRightVer(isLatest && versions[1] ? versions[1].version : latestVerNumber);
                                setActiveTab('COMPARE');
                              }}
                              className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <GitCompare className="w-3.5 h-3.5 text-slate-500" />
                              <span>Compare</span>
                            </button>
                          )}

                          {onRestoreVersion && (
                            <button
                              type="button"
                              onClick={() => {
                                onRestoreVersion(quoteId, v.version);
                                onClose();
                              }}
                              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-[#00E5C0] text-[11px] font-black flex items-center gap-1 cursor-pointer shadow-2xs"
                              title={`Load v${v.version} into Quote Builder as an unsaved working draft`}
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Restore</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : activeTab === 'INSPECT' && inspectedVersion ? (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-500">Viewing Saved Snapshot:</span>
                  <select
                    value={inspectedVersion.version}
                    onChange={e => setInspectedVersionNum(Number(e.target.value))}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-900"
                  >
                    {versions.map(ver => (
                      <option key={ver.version} value={ver.version}>
                        v{ver.version}{ver.isLatest ? ' (LATEST)' : ''} — {formatCurrency(Number(ver.totalSellingPrice || 0), (ver.currency || 'USD') as any)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  {onOpenVersion && (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenVersion(quoteId, inspectedVersion.version, inspectedVersion.isLatest ? 'inspect' : 'readonly');
                        onClose();
                      }}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1 cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Open v{inspectedVersion.version} in Builder</span>
                    </button>
                  )}
                  {onRestoreVersion && (
                    <button
                      type="button"
                      onClick={() => {
                        onRestoreVersion(quoteId, inspectedVersion.version);
                        onClose();
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-[#00E5C0] text-xs font-black flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Restore v{inspectedVersion.version} as Unsaved Draft</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Snapshot Metadata Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-1">
                  <span className="text-[10px] font-black uppercase text-slate-400">Client & Passengers</span>
                  <p className="text-xs font-bold text-slate-900">{inspectedVersion.clientName || quoteRecord?.clientName || 'Client'}</p>
                  <p className="text-[11px] text-slate-500">
                    {inspectedVersion.adultsCount ?? quoteRecord?.adultsCount ?? 2} Adults
                    {(inspectedVersion.childrenCount ?? 0) > 0 ? ` · ${inspectedVersion.childrenCount} Children` : ''}
                    {(inspectedVersion.infantsCount ?? 0) > 0 ? ` · ${inspectedVersion.infantsCount} Infants` : ''}
                  </p>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-1">
                  <span className="text-[10px] font-black uppercase text-slate-400">Travel Window & Scope</span>
                  <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-teal-600" />
                    <span>{inspectedVersion.travelStartDate || quoteRecord?.travelStartDate || '—'} → {inspectedVersion.travelEndDate || quoteRecord?.travelEndDate || '—'}</span>
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Scope: {inspectedVersion.quotationScope || quoteRecord?.quotationScope || 'HOTEL_LAND'} · Branding: {inspectedVersion.brandingMode || 'STANDARD'}
                  </p>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-1">
                  <span className="text-[10px] font-black uppercase text-slate-400">Saved Pricing Snapshot</span>
                  <p className="text-base font-black text-teal-700 font-mono">
                    {formatCurrency(Number(inspectedVersion.totalSellingPrice ?? 0), (inspectedVersion.currency || 'USD') as any)}
                  </p>
                  {canViewInternalCosts && inspectedVersion.totalNetCost !== undefined && (
                    <p className="text-[11px] text-indigo-700 font-semibold">
                      Internal Nett: {formatCurrency(Number(inspectedVersion.totalNetCost || 0), (inspectedVersion.currency || 'USD') as any)} · Margin: {formatCurrency(Number(inspectedVersion.totalMargin || 0), (inspectedVersion.currency || 'USD') as any)}
                    </p>
                  )}
                </div>
              </div>

              {/* Route Hubs */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2.5">
                <h5 className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Route Hubs ({(inspectedVersion.routeHubs || []).length})
                </h5>
                {(inspectedVersion.routeHubs || []).length === 0 ? (
                  <p className="text-xs text-slate-400">No route hubs recorded in this snapshot.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {(inspectedVersion.routeHubs || []).map((hub, idx) => (
                      <div key={hub.id || idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">Stop {idx + 1}: {hub.hubName}</span>
                          <span className="px-2 py-0.5 rounded bg-teal-50 text-teal-800 font-bold text-[10px]">
                            {hub.nights || 1}N
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {hub.manualHotel?.hotelName
                            ? `Manual Hotel: ${hub.manualHotel.hotelName}`
                            : hub.hotelId
                              ? `Hotel Linked (${hub.hotelId})`
                              : hub.accommodationType === 'NO_ACCOMMODATION'
                                ? 'Land Only / No Accommodation'
                                : 'Hotel Pending'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Itinerary Items */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2.5">
                <h5 className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Services & Products ({(inspectedVersion.items || []).length})
                </h5>
                {(inspectedVersion.items || []).length === 0 ? (
                  <p className="text-xs text-slate-400">No line items recorded in this snapshot.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {(inspectedVersion.items || []).map((it, idx) => (
                      <div key={it.id || idx} className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900">{it.product?.name || 'Service Item'}</p>
                          <p className="text-[11px] text-slate-500">
                            {it.product?.category || it.product?.productType || 'Service'}
                            {it.travelDate ? ` · ${it.travelDate}` : ''}
                            {it.pax ? ` · ${it.pax.adults || 0}A/${it.pax.children || 0}C` : ''}
                          </p>
                        </div>
                        <span className="font-mono font-bold text-slate-900 shrink-0">
                          {formatCurrency(
                            Number(it.calculation?.finalTotalSellingPrice || 0),
                            (it.calculation?.targetCurrency || inspectedVersion.currency || 'USD') as any
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Terms Snippet */}
              {inspectedVersion.termsAndConditions && (
                <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-teal-600" />
                    <h5 className="text-xs font-black uppercase tracking-wider text-slate-700">
                      Snapshot Commercial Terms
                    </h5>
                  </div>
                  <p className="text-[11px] text-slate-600 whitespace-pre-line max-h-40 overflow-y-auto bg-slate-50 p-3 rounded-xl border border-slate-100">
                    {inspectedVersion.termsAndConditions}
                  </p>
                </div>
              )}
            </div>
          ) : activeTab === 'COMPARE' && compareDiff ? (
            <div className="space-y-4">
              {/* Selectors */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 grid grid-cols-1 md:grid-cols-11 gap-3 items-center">
                <div className="md:col-span-5 space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 block">Baseline Version (A)</label>
                  <select
                    value={compareDiff.versionA.version}
                    onChange={e => setCompareLeftVer(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-900"
                  >
                    {versions.map(v => (
                      <option key={v.version} value={v.version}>
                        v{v.version}{v.isLatest ? ' (LATEST)' : ''} · {new Date(v.createdAt).toLocaleDateString()} · {formatCurrency(Number(v.totalSellingPrice || 0), (v.currency || 'USD') as any)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-1 flex justify-center">
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </div>
                <div className="md:col-span-5 space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 block">Comparison Version (B)</label>
                  <select
                    value={compareDiff.versionB.version}
                    onChange={e => setCompareRightVer(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-900"
                  >
                    {versions.map(v => (
                      <option key={v.version} value={v.version}>
                        v{v.version}{v.isLatest ? ' (LATEST)' : ''} · {new Date(v.createdAt).toLocaleDateString()} · {formatCurrency(Number(v.totalSellingPrice || 0), (v.currency || 'USD') as any)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Financial & High-Level Delta */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-1">
                  <span className="text-[10px] font-black uppercase text-slate-400">v{compareDiff.versionA.version} Customer Total</span>
                  <p className="text-lg font-black text-slate-900 font-mono">
                    {formatCurrency(compareDiff.priceA, (compareDiff.versionA.currency || 'USD') as any)}
                  </p>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-1">
                  <span className="text-[10px] font-black uppercase text-slate-400">v{compareDiff.versionB.version} Customer Total</span>
                  <p className="text-lg font-black text-slate-900 font-mono">
                    {formatCurrency(compareDiff.priceB, (compareDiff.versionB.currency || 'USD') as any)}
                  </p>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-1">
                  <span className="text-[10px] font-black uppercase text-slate-400">Price Variance</span>
                  <p className={`text-lg font-black font-mono ${
                    compareDiff.priceDelta > 0
                      ? 'text-emerald-700'
                      : compareDiff.priceDelta < 0
                        ? 'text-rose-700'
                        : 'text-slate-600'
                  }`}>
                    {compareDiff.currencyChanged
                      ? 'Currency Changed'
                      : `${compareDiff.priceDelta >= 0 ? '+' : ''}${formatCurrency(compareDiff.priceDelta, (compareDiff.versionB.currency || 'USD') as any)}`}
                  </p>
                  {canViewInternalCosts && compareDiff.netCostDelta !== undefined && !compareDiff.currencyChanged && (
                    <p className="text-[10px] text-indigo-700 font-semibold">
                      Nett Δ: {compareDiff.netCostDelta >= 0 ? '+' : ''}{formatCurrency(compareDiff.netCostDelta, (compareDiff.versionB.currency || 'USD') as any)} · Margin Δ: {(compareDiff.marginDelta || 0) >= 0 ? '+' : ''}{formatCurrency(compareDiff.marginDelta || 0, (compareDiff.versionB.currency || 'USD') as any)}
                    </p>
                  )}
                </div>
              </div>

              {/* Metadata Changes */}
              {(compareDiff.datesChanged || compareDiff.paxChanged || compareDiff.scopeChanged || compareDiff.brandingChanged) && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-1.5 text-xs text-amber-950">
                  <span className="font-black uppercase text-[10px] tracking-wider block">Header & Parameter Changes</span>
                  {compareDiff.datesChanged && (
                    <p>• Travel Dates: {compareDiff.versionA.travelStartDate}–{compareDiff.versionA.travelEndDate} → {compareDiff.versionB.travelStartDate}–{compareDiff.versionB.travelEndDate}</p>
                  )}
                  {compareDiff.paxChanged && (
                    <p>• Passengers: {compareDiff.versionA.adultsCount || 0}A/{compareDiff.versionA.childrenCount || 0}C → {compareDiff.versionB.adultsCount || 0}A/{compareDiff.versionB.childrenCount || 0}C</p>
                  )}
                  {compareDiff.scopeChanged && (
                    <p>• Quotation Scope: {compareDiff.versionA.quotationScope || 'HOTEL_LAND'} → {compareDiff.versionB.quotationScope || 'HOTEL_LAND'}</p>
                  )}
                  {compareDiff.brandingChanged && (
                    <p>• Branding Mode: {compareDiff.versionA.brandingMode || 'STANDARD'} → {compareDiff.versionB.brandingMode || 'STANDARD'}</p>
                  )}
                </div>
              )}

              {/* Hub Diffs */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2.5">
                <h5 className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Route Hub Changes ({compareDiff.hubDiffs.length})
                </h5>
                {compareDiff.hubDiffs.length === 0 ? (
                  <p className="text-xs text-slate-400">No route hub differences between v{compareDiff.versionA.version} and v{compareDiff.versionB.version}.</p>
                ) : (
                  <div className="space-y-1.5">
                    {compareDiff.hubDiffs.map(hd => (
                      <div key={hd.key} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 text-xs">
                        <div>
                          <span className="font-bold text-slate-900">{hd.hubName}</span>
                          <span className="text-slate-500 ml-2">{hd.detail}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                          hd.changeType === 'ADDED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : hd.changeType === 'REMOVED'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                        }`}>
                          {hd.changeType}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Item Diffs */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-black uppercase tracking-wider text-slate-700">
                    Product & Service Line Diff ({compareDiff.itemDiffs.length} changed · {compareDiff.unchangedItemsCount} unchanged)
                  </h5>
                </div>
                {compareDiff.itemDiffs.length === 0 ? (
                  <p className="text-xs text-slate-400">All products and services match between v{compareDiff.versionA.version} and v{compareDiff.versionB.version}.</p>
                ) : (
                  <div className="space-y-1.5">
                    {compareDiff.itemDiffs.map(idiff => (
                      <div key={idiff.key} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <span className="font-bold text-slate-900">{idiff.name}</span>
                          <span className="text-[10px] text-slate-400 ml-2 uppercase">{idiff.category}</span>
                          <p className="text-[11px] text-slate-600">{idiff.detail}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                          idiff.changeType === 'ADDED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : idiff.changeType === 'REMOVED'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                        }`}>
                          {idiff.changeType}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
