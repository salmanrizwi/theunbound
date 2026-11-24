import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Promotion,
  PromotionDiscountType,
  PromotionAudience,
  PromotionPlacement,
  PromotionFrequency,
  PromotionBookingValidityPolicy,
  PromotionReportRow,
  PromotionRedemptionRecord,
  PromotionReservationRecord,
  CampaignStatus,
  CurrencyCode,
  Destination,
  Product
} from '../../types';
import { AppDatabase } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import {
  isPromotionCodeUnique,
  normalizePromotionCode,
  resolveEffectivePromotionStatus
} from '../../services/promotionEngine';
import { fetchAdminPromotionReportAsync } from '../../services/promotionApiService';
import { buildBookingManualDiscountReport } from '../../services/bookingManualDiscountEngine';
import { formatCurrency } from '../../services/pricingEngine';
import {
  Tag,
  Plus,
  Edit3,
  Trash2,
  CheckCircle2,
  XCircle,
  Calendar,
  Percent,
  DollarSign,
  Search,
  BarChart3,
  ShieldAlert,
  RefreshCw,
  PauseCircle,
  Ban,
  PlayCircle,
  History,
  Copy,
  Check,
  AlertTriangle,
  Users,
  Globe2,
  Package,
  Sliders
} from 'lucide-react';

interface PromotionManagerProps {
  destinations: Destination[];
  products: Product[];
}

const PRODUCT_CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'HOTEL', label: 'Hotels & Stays' },
  { value: 'ACTIVITY', label: 'Activities & Experiences' },
  { value: 'TRANSFER', label: 'Airport & Intercity Transfers' },
  { value: 'VEHICLE', label: 'Private Vehicles & Fleet' },
  { value: 'GUIDE', label: 'Licensed Guides' },
  { value: 'RAIL', label: 'Rail / Shinkansen' },
  { value: 'VISA', label: 'Visa Services' },
  { value: 'PACKAGE', label: 'Pre-Curated Packages' },
  { value: 'ADDON', label: 'Add-ons & Protection' }
];

const SUPPORTED_CURRENCIES: CurrencyCode[] = ['INR', 'USD', 'JPY', 'EUR', 'GBP', 'AED', 'SGD'];

const STATUS_BADGE_STYLES: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  SCHEDULED: 'bg-sky-100 text-sky-800 border-sky-200',
  DRAFT: 'bg-slate-100 text-slate-700 border-slate-200',
  PAUSED: 'bg-amber-100 text-amber-800 border-amber-200',
  DISABLED: 'bg-rose-100 text-rose-800 border-rose-200',
  EXPIRED: 'bg-slate-200 text-slate-600 border-slate-300',
  ARCHIVED: 'bg-slate-200 text-slate-500 border-slate-300'
};

function createDefaultFormData(): Partial<Promotion> {
  const today = new Date().toISOString().split('T')[0];
  const plus90 = new Date(Date.now() + 86400000 * 90).toISOString().split('T')[0];
  return {
    title: '',
    subtitle: '',
    description: '',
    internalAdminNotes: '',
    promoCode: '',
    normalizedPromoCode: '',
    caseInsensitiveCode: true,
    promotionType: 'DISCOUNT_CODE',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    currency: 'INR',
    minBookingValue: 0,
    minEligibleBaseSellingPrice: 0,
    maxDiscount: 0,
    maxDiscountAmount: 0,
    maxDiscountPerQuotation: 0,
    bannerImage: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1600&auto=format&fit=crop',
    ctaText: 'Explore Exclusive Tariffs',
    ctaLink: '',
    targetAudience: 'B2B_AGENT',
    displayPlacement: 'BANNER',
    frequency: 'ALWAYS',
    destinationId: 'all',
    applicableDestinationIds: [],
    applyToAllDestinations: true,
    applicableProductCategories: [],
    applicableProductIds: [],
    applyToAllProducts: true,
    applicableAgencyIds: [],
    applicableAgentIds: [],
    applyToAllAgents: true,
    minPassengers: 0,
    totalUsageLimit: 0,
    maxUsesPerAgent: 0,
    maxUsesPerAgency: 0,
    maxUsesPerBooking: 1,
    oneTimePerUser: false,
    allowReuseOnRevisedQuotation: true,
    newQuotationsOnly: false,
    allowOnDraftQuotations: true,
    allowAtBookingConfirmation: true,
    bookingValidityPolicy: 'REQUIRE_REACCEPTANCE',
    startDate: today,
    endDate: plus90,
    priority: 1,
    status: 'ACTIVE',
    isActive: true,
    couponChannel: 'B2B_AGENT',
    fundingSource: 'THEUNBOUND_MARGIN',
    permittedForExistingBookings: false,
    requiresAdminApproval: false
  };
}

export const PromotionManager: React.FC<PromotionManagerProps> = ({ destinations, products }) => {
  const db = AppDatabase.getInstance();
  const { user } = useAuth();

  // Active sub-tab: Catalog vs Reporting
  const [activeTab, setActiveTab] = useState<'CATALOG' | 'REPORTING'>('CATALOG');

  // Data State
  const [promotions, setPromotions] = useState<Promotion[]>(() => db.getPromotions());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAudience, setFilterAudience] = useState<string>('ALL');
  const [filterPlacement, setFilterPlacement] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<{ type: 'SUCCESS' | 'ERROR'; text: string } | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
  const [formData, setFormData] = useState<Partial<Promotion>>(createDefaultFormData);
  const [formError, setFormError] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [agentSearch, setAgentSearch] = useState('');

  // Reporting & Redemption History State
  const [reportRows, setReportRows] = useState<PromotionReportRow[]>([]);
  const [redemptions, setRedemptions] = useState<PromotionRedemptionRecord[]>([]);
  const [reservations, setReservations] = useState<PromotionReservationRecord[]>([]);
  const [reportSource, setReportSource] = useState<'SERVER' | 'LOCAL'>('LOCAL');
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [reportFilterPromoId, setReportFilterPromoId] = useState<string>('ALL');
  const [reportSearch, setReportSearch] = useState('');

  // Directory Data for Eligibility Targeting
  const agencies = useMemo(() => db.getCompanies(), [db, promotions]);
  const b2bAgents = useMemo(
    () =>
      db
        .getUsers()
        .filter((u) => u.role === 'B2B_AGENT' || u.userType === 'B2B_AGENT' || u.agencyName),
    [db, promotions]
  );

  const refreshPromos = useCallback(() => {
    setPromotions(db.getPromotions());
  }, [db]);

  const loadReportingData = useCallback(async () => {
    setIsLoadingReport(true);
    try {
      const res = await fetchAdminPromotionReportAsync();
      setReportRows(res.rows);
      setRedemptions(res.redemptions);
      setReservations(res.reservations);
      setReportSource(res.source);
    } finally {
      setIsLoadingReport(false);
    }
  }, []);

  useEffect(() => {
    const unsub = db.subscribe(() => {
      refreshPromos();
    });
    return () => unsub();
  }, [db, refreshPromos]);

  useEffect(() => {
    loadReportingData();
  }, [loadReportingData, promotions.length]);

  const redemptionCountByPromo = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of redemptions) {
      if (r.status === 'REDEEMED') {
        map.set(r.promotionId, (map.get(r.promotionId) || 0) + 1);
      }
    }
    return map;
  }, [redemptions]);

  const showToast = (type: 'SUCCESS' | 'ERROR', text: string) => {
    setStatusFeedback({ type, text });
    window.setTimeout(() => {
      setStatusFeedback((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  };

  const handleOpenCreate = () => {
    setEditingPromo(null);
    setFormData(createDefaultFormData());
    setFormError(null);
    setProductSearch('');
    setAgentSearch('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (promo: Promotion) => {
    setEditingPromo(promo);
    setFormData({
      ...createDefaultFormData(),
      ...promo,
      promoCode: promo.promoCode || '',
      normalizedPromoCode: promo.normalizedPromoCode || normalizePromotionCode(promo.promoCode),
      caseInsensitiveCode: promo.caseInsensitiveCode !== false,
      promotionType: promo.promotionType || (promo.promoCode ? 'DISCOUNT_CODE' : 'CAMPAIGN_BANNER'),
      minEligibleBaseSellingPrice: promo.minEligibleBaseSellingPrice ?? promo.minBookingValue ?? 0,
      maxDiscount: promo.maxDiscount ?? promo.maxDiscountAmount ?? 0,
      maxDiscountAmount: promo.maxDiscountAmount ?? promo.maxDiscount ?? 0,
      maxDiscountPerQuotation: promo.maxDiscountPerQuotation ?? 0,
      applicableDestinationIds:
        promo.applicableDestinationIds && promo.applicableDestinationIds.length > 0
          ? promo.applicableDestinationIds
          : promo.destinationId && promo.destinationId !== 'all'
            ? [promo.destinationId]
            : [],
      applyToAllDestinations:
        promo.applyToAllDestinations ??
        (!promo.applicableDestinationIds?.length && (!promo.destinationId || promo.destinationId === 'all')),
      applicableProductCategories: promo.applicableProductCategories || [],
      applicableProductIds: promo.applicableProductIds || [],
      applyToAllProducts: promo.applyToAllProducts ?? true,
      applicableAgencyIds: promo.applicableAgencyIds || [],
      applicableAgentIds: promo.applicableAgentIds || [],
      applyToAllAgents:
        promo.applyToAllAgents ??
        (!promo.applicableAgencyIds?.length && !promo.applicableAgentIds?.length),
      minPassengers: promo.minPassengers || 0,
      totalUsageLimit: promo.totalUsageLimit || 0,
      maxUsesPerAgent: promo.maxUsesPerAgent || 0,
      maxUsesPerAgency: promo.maxUsesPerAgency || 0,
      maxUsesPerBooking: promo.maxUsesPerBooking || 1,
      oneTimePerUser: Boolean(promo.oneTimePerUser),
      allowReuseOnRevisedQuotation: promo.allowReuseOnRevisedQuotation !== false,
      newQuotationsOnly: Boolean(promo.newQuotationsOnly),
      allowOnDraftQuotations: promo.allowOnDraftQuotations !== false,
      allowAtBookingConfirmation: promo.allowAtBookingConfirmation !== false,
      bookingValidityPolicy: promo.bookingValidityPolicy || 'REQUIRE_REACCEPTANCE',
      status: promo.status || (promo.isActive ? 'ACTIVE' : 'PAUSED'),
      couponChannel: promo.couponChannel || 'B2B_AGENT',
      fundingSource: promo.fundingSource || 'THEUNBOUND_MARGIN',
      permittedForExistingBookings: Boolean(
        promo.permittedForExistingBookings ??
          (promo.couponChannel === 'ADMIN_MANUAL' || promo.couponChannel === 'BOTH')
      ),
      requiresAdminApproval: Boolean(promo.requiresAdminApproval)
    });
    setFormError(null);
    setProductSearch('');
    setAgentSearch('');
    setIsModalOpen(true);
  };

  const normalizedDraftCode = normalizePromotionCode(formData.promoCode);
  const codeConflict = useMemo(() => {
    if (!normalizedDraftCode) return false;
    return !isPromotionCodeUnique(promotions, normalizedDraftCode, editingPromo?.id).unique;
  }, [promotions, normalizedDraftCode, editingPromo?.id]);

  const toggleArraySelection = (
    field:
      | 'applicableDestinationIds'
      | 'applicableProductCategories'
      | 'applicableProductIds'
      | 'applicableAgencyIds'
      | 'applicableAgentIds',
    value: string
  ) => {
    setFormData((prev) => {
      const current = Array.isArray(prev[field]) ? [...(prev[field] as string[])] : [];
      const exists = current.includes(value);
      const next = exists ? current.filter((v) => v !== value) : [...current, value];
      return { ...prev, [field]: next };
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.title?.trim()) {
      setFormError('Promotion name is required.');
      return;
    }

    const numericDiscount = Number(formData.discountValue);
    if (!Number.isFinite(numericDiscount) || numericDiscount <= 0) {
      setFormError('Discount value must be greater than 0.');
      return;
    }

    if (formData.discountType === 'PERCENTAGE' && numericDiscount > 100) {
      setFormError('Percentage discount cannot exceed 100%.');
      return;
    }

    if (formData.startDate && formData.endDate && formData.endDate < formData.startDate) {
      setFormError('End date cannot be earlier than start date.');
      return;
    }

    if (normalizedDraftCode && codeConflict) {
      setFormError(`Discount code "${normalizedDraftCode}" is already assigned to another promotion.`);
      return;
    }

    if (formData.promotionType === 'DISCOUNT_CODE' && !normalizedDraftCode) {
      setFormError('Please enter a Discount Code for a Discount Code promotion.');
      return;
    }

    const selectedStatus: CampaignStatus =
      formData.status || (formData.isActive ? 'ACTIVE' : 'PAUSED');
    const isActiveFlag = selectedStatus === 'ACTIVE' || selectedStatus === 'SCHEDULED';

    const minBase = Math.max(0, Number(formData.minEligibleBaseSellingPrice || 0) || 0);
    const maxCap = Math.max(0, Number(formData.maxDiscount || 0) || 0);
    const maxPerQuote = Math.max(0, Number(formData.maxDiscountPerQuotation || 0) || 0);

    const destIds = formData.applyToAllDestinations
      ? []
      : (formData.applicableDestinationIds || []).filter(Boolean);
    const prodIds = formData.applyToAllProducts
      ? []
      : (formData.applicableProductIds || []).filter(Boolean);
    const agencyIds = formData.applyToAllAgents
      ? []
      : (formData.applicableAgencyIds || []).filter(Boolean);
    const agentIds = formData.applyToAllAgents
      ? []
      : (formData.applicableAgentIds || []).filter(Boolean);

    const promoToSave: Promotion = {
      id: editingPromo ? editingPromo.id : `promo-${Date.now()}`,
      title: formData.title.trim(),
      subtitle: (formData.subtitle || '').trim(),
      description: (formData.description || '').trim(),
      internalAdminNotes: (formData.internalAdminNotes || '').trim(),
      promoCode: normalizedDraftCode,
      normalizedPromoCode: normalizedDraftCode || undefined,
      caseInsensitiveCode: formData.caseInsensitiveCode !== false,
      promotionType: formData.promotionType || (normalizedDraftCode ? 'DISCOUNT_CODE' : 'CAMPAIGN_BANNER'),
      configVersion: editingPromo ? (editingPromo.configVersion || 1) + 1 : 1,
      discountType: (formData.discountType as PromotionDiscountType) || 'PERCENTAGE',
      discountValue: numericDiscount,
      currency: (formData.currency as CurrencyCode) || 'INR',
      minBookingValue: minBase,
      minEligibleBaseSellingPrice: minBase,
      maxDiscount: maxCap || undefined,
      maxDiscountAmount: maxCap || undefined,
      maxDiscountPerQuotation: maxPerQuote || undefined,
      bannerImage: formData.bannerImage || '',
      ctaText: formData.ctaText || 'Learn More',
      ctaLink: formData.ctaLink || '',
      targetAudience: (formData.targetAudience as PromotionAudience) || 'B2B_AGENT',
      displayPlacement: (formData.displayPlacement as PromotionPlacement) || 'BANNER',
      frequency: (formData.frequency as PromotionFrequency) || 'ALWAYS',
      destinationId: destIds.length === 1 ? destIds[0] : 'all',
      applicableDestinationIds: destIds,
      applyToAllDestinations: formData.applyToAllDestinations !== false,
      applicableProductCategories: formData.applicableProductCategories || [],
      applicableProductIds: prodIds,
      applyToAllProducts: formData.applyToAllProducts !== false,
      applicableAgencyIds: agencyIds,
      applicableAgentIds: agentIds,
      applyToAllAgents: formData.applyToAllAgents !== false,
      minPassengers: Math.max(0, Number(formData.minPassengers || 0) || 0) || undefined,
      totalUsageLimit: Math.max(0, Number(formData.totalUsageLimit || 0) || 0) || undefined,
      maxUsesPerAgent: Math.max(0, Number(formData.maxUsesPerAgent || 0) || 0) || undefined,
      maxUsesPerAgency: Math.max(0, Number(formData.maxUsesPerAgency || 0) || 0) || undefined,
      maxUsesPerBooking: Math.max(1, Number(formData.maxUsesPerBooking || 1) || 1),
      oneTimePerUser: Boolean(formData.oneTimePerUser),
      allowReuseOnRevisedQuotation: formData.allowReuseOnRevisedQuotation !== false,
      newQuotationsOnly: Boolean(formData.newQuotationsOnly),
      allowOnDraftQuotations: formData.allowOnDraftQuotations !== false,
      allowAtBookingConfirmation: formData.allowAtBookingConfirmation !== false,
      bookingValidityPolicy:
        (formData.bookingValidityPolicy as PromotionBookingValidityPolicy) || 'REQUIRE_REACCEPTANCE',
      startDate: formData.startDate || '',
      endDate: formData.endDate || '',
      priority: Number(formData.priority) || 1,
      status: selectedStatus,
      isActive: isActiveFlag,
      viewCount: editingPromo?.viewCount || 0,
      clickCount: editingPromo?.clickCount || 0,
      totalApplicationsCount: editingPromo?.totalApplicationsCount || 0,
      successfulRedemptionsCount: editingPromo?.successfulRedemptionsCount || 0,
      failedApplicationsCount: editingPromo?.failedApplicationsCount || 0,
      totalDiscountValueGranted: editingPromo?.totalDiscountValueGranted || 0,
      couponChannel: formData.couponChannel || 'B2B_AGENT',
      fundingSource: formData.fundingSource || 'THEUNBOUND_MARGIN',
      permittedForExistingBookings: Boolean(
        formData.couponChannel === 'ADMIN_MANUAL' || formData.couponChannel === 'BOTH'
          ? formData.permittedForExistingBookings !== false
          : formData.permittedForExistingBookings
      ),
      requiresAdminApproval: Boolean(formData.requiresAdminApproval),
      adminManualRedemptionsCount: editingPromo?.adminManualRedemptionsCount || 0,
      adminManualDiscountValueGranted: editingPromo?.adminManualDiscountValueGranted || 0,
      createdBy: editingPromo?.createdBy || user?.id,
      updatedBy: user?.id,
      createdAt: editingPromo?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      db.savePromotion(promoToSave, user);
      refreshPromos();
      setIsModalOpen(false);
      showToast(
        'SUCCESS',
        editingPromo
          ? `Updated promotion "${promoToSave.title}" (v${promoToSave.configVersion}).`
          : `Created promotion "${promoToSave.title}".`
      );
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save promotion.');
    }
  };

  const handleLifecycleChange = (promo: Promotion, targetStatus: CampaignStatus) => {
    if (targetStatus === 'DISABLED') {
      db.disablePromotion(promo.id, user);
      showToast('SUCCESS', `Disabled "${promo.title}". Historical quotations and redemption records are preserved.`);
    } else {
      const nextActive = targetStatus === 'ACTIVE' || targetStatus === 'SCHEDULED';
      db.savePromotion(
        {
          ...promo,
          status: targetStatus,
          isActive: nextActive,
          isArchived: targetStatus === 'ARCHIVED'
        },
        user
      );
      showToast('SUCCESS', `Set "${promo.title}" status to ${targetStatus}.`);
    }
    refreshPromos();
  };

  const handleDelete = (id: string) => {
    const target = promotions.find((p) => p.id === id);
    const title = target?.title || 'this promotion';
    const historicalCount = redemptionCountByPromo.get(id) || target?.successfulRedemptionsCount || 0;

    if (historicalCount > 0) {
      db.disablePromotion(id, user);
      if (editingPromo?.id === id) {
        setIsModalOpen(false);
        setEditingPromo(null);
      }
      refreshPromos();
      showToast(
        'SUCCESS',
        `"${title}" has ${historicalCount} historical redemption(s) and was safely DISABLED instead of deleted to preserve audit history.`
      );
      return;
    }

    db.deletePromotion(id, user);
    if (editingPromo?.id === id) {
      setIsModalOpen(false);
      setEditingPromo(null);
    }
    refreshPromos();
    showToast('SUCCESS', `Removed promotion "${title}".`);
  };

  const handleCopyCode = (promo: Promotion) => {
    if (!promo.promoCode) return;
    navigator.clipboard?.writeText(promo.promoCode).catch(() => {});
    setCopiedCodeId(promo.id);
    window.setTimeout(() => setCopiedCodeId((prev) => (prev === promo.id ? null : prev)), 1500);
  };

  const filteredPromotions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return promotions.filter((p) => {
      const effectiveStatus = resolveEffectivePromotionStatus(p);
      const matchesSearch =
        !q ||
        p.title.toLowerCase().includes(q) ||
        (p.promoCode && p.promoCode.toLowerCase().includes(q)) ||
        (p.description && p.description.toLowerCase().includes(q));
      const matchesAudience = filterAudience === 'ALL' || p.targetAudience === filterAudience;
      const matchesPlacement = filterPlacement === 'ALL' || p.displayPlacement === filterPlacement;
      const matchesStatus =
        filterStatus === 'ALL' ||
        effectiveStatus === filterStatus ||
        (filterStatus === 'INACTIVE' && effectiveStatus !== 'ACTIVE');
      return matchesSearch && matchesAudience && matchesPlacement && matchesStatus;
    });
  }, [promotions, searchQuery, filterAudience, filterPlacement, filterStatus]);

  const filteredReportRows = useMemo(() => {
    const q = reportSearch.trim().toLowerCase();
    return reportRows.filter((row) => {
      if (reportFilterPromoId !== 'ALL' && row.promotionId !== reportFilterPromoId) return false;
      if (!q) return true;
      return (
        row.promotionName.toLowerCase().includes(q) ||
        row.code.toLowerCase().includes(q) ||
        row.status.toLowerCase().includes(q)
      );
    });
  }, [reportRows, reportFilterPromoId, reportSearch]);

  const filteredRedemptions = useMemo(() => {
    const q = reportSearch.trim().toLowerCase();
    return redemptions.filter((rec) => {
      if (reportFilterPromoId !== 'ALL' && rec.promotionId !== reportFilterPromoId) return false;
      if (!q) return true;
      return (
        rec.code.toLowerCase().includes(q) ||
        rec.promotionName.toLowerCase().includes(q) ||
        (rec.bookingReference || rec.bookingId).toLowerCase().includes(q) ||
        (rec.quotationNumber || rec.quotationId).toLowerCase().includes(q) ||
        (rec.agencyName || '').toLowerCase().includes(q) ||
        (rec.agentName || '').toLowerCase().includes(q)
      );
    });
  }, [redemptions, reportFilterPromoId, reportSearch]);

  const reportTotals = useMemo(() => {
    const activeCodes = promotions.filter(
      (p) => Boolean(p.promoCode) && resolveEffectivePromotionStatus(p) === 'ACTIVE'
    ).length;
    const totalRedemptions = reportRows.reduce((sum, r) => sum + r.successfulRedemptions, 0);
    const pendingReservations = reportRows.reduce((sum, r) => sum + r.pendingReservations, 0);
    const totalDiscountGranted = reportRows.reduce((sum, r) => sum + r.totalDiscountValueGranted, 0);
    return { activeCodes, totalRedemptions, pendingReservations, totalDiscountGranted };
  }, [promotions, reportRows]);

  const visibleProductsForSelect = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    const list = q
      ? products.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.sku || '').toLowerCase().includes(q) ||
            (p.category || '').toLowerCase().includes(q)
        )
      : products;
    return list.slice(0, 60);
  }, [products, productSearch]);

  const visibleAgentsForSelect = useMemo(() => {
    const q = agentSearch.trim().toLowerCase();
    const list = q
      ? b2bAgents.filter(
          (u) =>
            u.name.toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q) ||
            (u.agencyName || '').toLowerCase().includes(q)
        )
      : b2bAgents;
    return list.slice(0, 60);
  }, [b2bAgents, agentSearch]);

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2 text-[#008972] text-xs font-bold uppercase tracking-wider mb-1">
            <Tag className="w-4 h-4" />
            <span>Marketing Management &bull; Discount Codes &amp; Commercial Offers</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">Promotion Management Engine</h2>
          <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
            Configure discount codes applied strictly to TheUnbound Base Selling Price (never supplier nett cost), eligibility rules, usage limits, booking validity policies, and live redemption analytics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('CATALOG')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                activeTab === 'CATALOG'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Promotions ({promotions.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('REPORTING');
                loadReportingData();
              }}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                activeTab === 'REPORTING'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Reporting &amp; Redemptions</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center space-x-1.5 bg-[#00C6A6] hover:bg-[#008972] text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Promotion</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {statusFeedback && (
        <div
          className={`flex items-center justify-between px-4 py-3 rounded-xl border text-xs font-medium ${
            statusFeedback.type === 'SUCCESS'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center space-x-2">
            {statusFeedback.type === 'SUCCESS' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{statusFeedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusFeedback(null)}
            className="text-current opacity-60 hover:opacity-100 font-bold px-1.5 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 1: PROMOTIONS & DISCOUNT CODES CATALOG                            */}
      {/* ===================================================================== */}
      {activeTab === 'CATALOG' && (
        <>
          {/* Filters & Search */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search promotion name or discount code..."
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#00C6A6]"
              />
            </div>

            <select
              value={filterAudience}
              onChange={(e) => setFilterAudience(e.target.value)}
              className="w-full py-2 px-3 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#00C6A6]"
            >
              <option value="ALL">All Audiences</option>
              <option value="B2B_AGENT">B2B Agents Only</option>
              <option value="BUYER">Retail Buyers Only</option>
            </select>

            <select
              value={filterPlacement}
              onChange={(e) => setFilterPlacement(e.target.value)}
              className="w-full py-2 px-3 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#00C6A6]"
            >
              <option value="ALL">All Placements</option>
              <option value="BANNER">Top Hero Banner</option>
              <option value="MODAL">Entry Popup Modal</option>
              <option value="PRODUCT_PAGE">Product Page Badge</option>
              <option value="DESTINATION_PAGE">Destination Showcase</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full py-2 px-3 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#00C6A6]"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="DRAFT">Draft</option>
              <option value="PAUSED">Paused</option>
              <option value="DISABLED">Disabled</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </div>

          {/* Promotions Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Promotion &amp; Discount Code</th>
                    <th className="py-3 px-4">Base Price Discount</th>
                    <th className="py-3 px-4">Eligibility Scope</th>
                    <th className="py-3 px-4">Validity Window</th>
                    <th className="py-3 px-4">Usage &amp; Limits</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPromotions.map((promo) => {
                    const effectiveStatus = resolveEffectivePromotionStatus(promo);
                    const badgeStyle =
                      STATUS_BADGE_STYLES[effectiveStatus] || STATUS_BADGE_STYLES.DRAFT;
                    const redeemedCount =
                      redemptionCountByPromo.get(promo.id) ??
                      promo.successfulRedemptionsCount ??
                      0;
                    const maxCap = promo.maxDiscountAmount || promo.maxDiscount || 0;
                    const minBase =
                      promo.minEligibleBaseSellingPrice || promo.minBookingValue || 0;

                    return (
                      <tr key={promo.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 max-w-xs">
                          <div className="font-bold text-slate-900 text-xs">{promo.title}</div>
                          {promo.promoCode ? (
                            <div className="flex items-center space-x-1.5 mt-1">
                              <span className="inline-block font-mono text-[10px] bg-teal-50 text-teal-900 px-2 py-0.5 rounded border border-teal-200 font-bold tracking-wide">
                                {promo.promoCode}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyCode(promo)}
                                className="p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                                title="Copy code"
                              >
                                {copiedCodeId === promo.id ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400">Banner / No Code</span>
                          )}
                          {promo.internalAdminNotes && (
                            <div className="text-[10px] text-amber-700 mt-1 truncate" title={promo.internalAdminNotes}>
                              Internal note: {promo.internalAdminNotes}
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="inline-flex items-center space-x-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200 text-xs">
                            {promo.discountType === 'PERCENTAGE' ? (
                              <>
                                <Percent className="w-3 h-3" />
                                <span>{promo.discountValue}% OFF</span>
                              </>
                            ) : (
                              <>
                                <DollarSign className="w-3 h-3" />
                                <span>
                                  {promo.discountValue.toLocaleString()} {promo.currency || 'INR'} OFF
                                </span>
                              </>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-1 space-y-0.5">
                            {maxCap > 0 && (
                              <div>
                                Cap: {maxCap.toLocaleString()} {promo.currency || 'INR'}
                              </div>
                            )}
                            {minBase > 0 && (
                              <div>
                                Min Base: {minBase.toLocaleString()} {promo.currency || 'INR'}
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="text-[11px] text-slate-700 space-y-0.5">
                            <div>
                              <span className="text-slate-400">Dest:</span>{' '}
                              <strong>
                                {promo.applyToAllDestinations !== false &&
                                (!promo.applicableDestinationIds ||
                                  promo.applicableDestinationIds.length === 0)
                                  ? 'All'
                                  : `${promo.applicableDestinationIds?.length || 1} selected`}
                              </strong>
                            </div>
                            <div>
                              <span className="text-slate-400">Categories:</span>{' '}
                              <strong>
                                {!promo.applicableProductCategories?.length
                                  ? 'All'
                                  : promo.applicableProductCategories.join(', ')}
                              </strong>
                            </div>
                            <div>
                              <span className="text-slate-400">Agents:</span>{' '}
                              <strong>
                                {promo.applyToAllAgents !== false &&
                                !promo.applicableAgencyIds?.length &&
                                !promo.applicableAgentIds?.length
                                  ? promo.targetAudience
                                  : `${promo.applicableAgencyIds?.length || 0} agencies / ${promo.applicableAgentIds?.length || 0} agents`}
                              </strong>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                          <div className="flex items-center space-x-1 text-[11px]">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span>
                              {promo.startDate || 'Immediate'} &rarr; {promo.endDate || 'Open'}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Booking stage:{' '}
                            {promo.allowAtBookingConfirmation !== false ? 'Allowed' : 'Quote Only'}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="text-[11px] text-slate-700 space-y-0.5">
                            <div>
                              Redeemed: <strong>{redeemedCount}</strong>
                              {promo.totalUsageLimit ? ` / ${promo.totalUsageLimit}` : ' / Unlimited'}
                            </div>
                            {promo.maxUsesPerAgent ? (
                              <div className="text-[10px] text-slate-500">
                                Per Agent: {promo.maxUsesPerAgent}
                              </div>
                            ) : null}
                            {promo.maxUsesPerAgency ? (
                              <div className="text-[10px] text-slate-500">
                                Per Agency: {promo.maxUsesPerAgency}
                              </div>
                            ) : null}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-md border text-[10px] font-bold uppercase tracking-wide ${badgeStyle}`}
                          >
                            <span>{effectiveStatus}</span>
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            {effectiveStatus === 'ACTIVE' ? (
                              <button
                                type="button"
                                onClick={() => handleLifecycleChange(promo, 'PAUSED')}
                                className="p-1.5 text-amber-600 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors cursor-pointer"
                                title="Pause Promotion"
                              >
                                <PauseCircle className="w-3.5 h-3.5" />
                              </button>
                            ) : effectiveStatus !== 'EXPIRED' ? (
                              <button
                                type="button"
                                onClick={() => handleLifecycleChange(promo, 'ACTIVE')}
                                className="p-1.5 text-emerald-600 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
                                title="Activate Promotion"
                              >
                                <PlayCircle className="w-3.5 h-3.5" />
                              </button>
                            ) : null}

                            {effectiveStatus !== 'DISABLED' && (
                              <button
                                type="button"
                                onClick={() => handleLifecycleChange(promo, 'DISABLED')}
                                className="p-1.5 text-slate-500 hover:text-rose-700 bg-slate-100 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Disable Promotion (Preserves History)"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleOpenEdit(promo)}
                              className="p-1.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                              title="Edit Promotion"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDelete(promo.id)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                              title={
                                redeemedCount > 0
                                  ? 'Disable Promotion (Has Historical Redemptions)'
                                  : 'Delete Promotion'
                              }
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredPromotions.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400">
                        {promotions.length === 0
                          ? 'No promotions configured yet. Click "Create Promotion" to launch your first discount code.'
                          : 'No promotions match your search filter criteria.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: REPORTING & REDEMPTION HISTORY                                 */}
      {/* ===================================================================== */}
      {activeTab === 'REPORTING' && (
        <div className="space-y-6">
          {/* KPI Summary Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Active Discount Codes
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{reportTotals.activeCodes}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Out of {promotions.length} total campaigns
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Successful Redemptions
              </div>
              <div className="text-2xl font-bold text-emerald-700 mt-1">
                {reportTotals.totalRedemptions}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Confirmed bookings with discount applied
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Active Reservations
              </div>
              <div className="text-2xl font-bold text-sky-700 mt-1">
                {reportTotals.pendingReservations}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Temporary holds awaiting booking completion
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Total Discount Granted
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                {reportTotals.totalDiscountGranted.toLocaleString(undefined, {
                  maximumFractionDigits: 2
                })}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Aggregate promotional savings granted
              </div>
            </div>
          </div>

          {/* Report Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div className="flex flex-1 flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={reportSearch}
                  onChange={(e) => setReportSearch(e.target.value)}
                  placeholder="Search by code, booking ref, quote #, agency, or agent..."
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#00C6A6]"
                />
              </div>

              <select
                value={reportFilterPromoId}
                onChange={(e) => setReportFilterPromoId(e.target.value)}
                className="py-2 px-3 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#00C6A6]"
              >
                <option value="ALL">All Promotions</option>
                {promotions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.promoCode ? `${p.promoCode} — ${p.title}` : p.title}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={loadReportingData}
              disabled={isLoadingReport}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-semibold cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingReport ? 'animate-spin' : ''}`} />
              <span>Refresh Report</span>
            </button>
          </div>

          {/* Promotion Performance Summary Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <BarChart3 className="w-4 h-4 text-[#008972]" />
                <h3 className="text-sm font-bold text-slate-900">Promotion Utilization Summary</h3>
              </div>
              <span className="text-[11px] text-slate-400">
                {filteredReportRows.length} promotion(s) &bull; {reservations.length} reservation log(s)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Code &amp; Name</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Configured Discount</th>
                    <th className="py-3 px-4 text-right">Redeemed</th>
                    <th className="py-3 px-4 text-right">Pending / Released</th>
                    <th className="py-3 px-4 text-right">Remaining</th>
                    <th className="py-3 px-4 text-right">Total Granted</th>
                    <th className="py-3 px-4 text-right">Agencies / Agents</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredReportRows.map((row) => (
                    <tr key={row.promotionId} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{row.promotionName}</div>
                        <div className="font-mono text-[10px] text-teal-800 font-semibold">
                          {row.code || 'NO CODE'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${
                            STATUS_BADGE_STYLES[row.status] || STATUS_BADGE_STYLES.DRAFT
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {row.discountType === 'PERCENTAGE'
                          ? `${row.discountValue}%`
                          : `${row.discountValue.toLocaleString()} ${row.currency || 'INR'}`}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-700">
                        {row.successfulRedemptions}
                        {row.totalUsageLimit ? ` / ${row.totalUsageLimit}` : ''}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-500">
                        {row.pendingReservations} / {row.releasedReservations}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-800">
                        {row.remainingUsage === null ? 'Unlimited' : row.remainingUsage}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {row.totalDiscountValueGranted.toLocaleString(undefined, {
                          maximumFractionDigits: 2
                        })}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-600">
                        {row.uniqueAgenciesCount} / {row.uniqueAgentsCount}
                      </td>
                    </tr>
                  ))}
                  {filteredReportRows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No promotion metrics found for the current filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detailed Redemption Audit History Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <History className="w-4 h-4 text-[#008972]" />
                <h3 className="text-sm font-bold text-slate-900">Redemption Audit History</h3>
              </div>
              <span className="text-[11px] text-slate-400">
                {filteredRedemptions.length} record(s) &bull; Source: {reportSource}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Code &amp; Promotion</th>
                    <th className="py-3 px-4">Booking / Quote</th>
                    <th className="py-3 px-4">Agency &amp; B2B Agent</th>
                    <th className="py-3 px-4 text-right">Pre-Discount Base</th>
                    <th className="py-3 px-4 text-right">Discount Granted</th>
                    <th className="py-3 px-4">Stage &amp; Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRedemptions.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 whitespace-nowrap text-[11px] text-slate-500">
                        {new Date(rec.redeemedAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-teal-800 text-[11px]">{rec.code}</div>
                        <div className="text-[11px] text-slate-700">{rec.promotionName}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">
                          {rec.bookingReference || rec.bookingId}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Quote {rec.quotationNumber || rec.quotationId} (v{rec.quotationVersion})
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">
                          {rec.agencyName || 'Direct B2B'}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {rec.agentName || rec.agentUid}
                          {rec.agentEmail ? ` (${rec.agentEmail})` : ''}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600">
                        {rec.currency} {rec.preDiscountBaseSellingPrice.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                        -{rec.currency} {rec.discountAmount.toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-block px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                          {rec.status}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {rec.appliedStage === 'BOOKING_CONFIRMATION'
                            ? 'Booking Stage'
                            : 'Quotation Stage'}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredRedemptions.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400">
                        No promotion redemptions recorded yet. Redemptions appear here automatically when a B2B booking is confirmed with a discount code.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Admin Manual Booking Discounts Utilization & Margin Impact (Strictly Distinct from B2B Promos) */}
          {(() => {
            const manualReport = buildBookingManualDiscountReport({
              bookings: db.getAllBookings()
            });
            return (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-indigo-50/40">
                  <div>
                    <h3 className="text-sm font-black text-slate-900">
                      Admin Manual Booking Discounts &amp; Margin-Funded Coupons
                    </h3>
                    <p className="text-xs text-slate-500">
                      Tracked independently from B2B Agent promotional redemptions. Funded strictly from TheUnbound&apos;s applicable margin.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-800 font-bold">
                      {manualReport.totalActiveAdjustments} Active
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold">
                      {manualReport.totalReversedAdjustments} Reversed
                    </span>
                    {manualReport.totalLossOverrideCount > 0 && (
                      <span className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 font-bold">
                        {manualReport.totalLossOverrideCount} Loss Overrides
                      </span>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase text-[10px]">
                      <tr>
                        <th className="py-3 px-4">Booking</th>
                        <th className="py-3 px-4">Agency / Agent</th>
                        <th className="py-3 px-4 text-right">Supplier Nett</th>
                        <th className="py-3 px-4 text-right">B2B Promo</th>
                        <th className="py-3 px-4 text-right">Admin Manual</th>
                        <th className="py-3 px-4 text-right">Remaining Margin</th>
                        <th className="py-3 px-4 text-right">Revised Selling</th>
                        <th className="py-3 px-4">Last Adjusted By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {manualReport.rows.map(row => (
                        <tr key={row.bookingId} className="hover:bg-slate-50/70">
                          <td className="py-3 px-4">
                            <div className="font-mono font-bold text-slate-900">{row.bookingReference}</div>
                            <div className="text-[10px] text-slate-500">{row.customerName}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-800">{row.agencyName || 'Direct'}</div>
                            <div className="text-[10px] text-slate-400">{row.agentName || '—'}</div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-rose-700">
                            {formatCurrency(row.supplierNettCost, row.currency)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-sky-700">
                            -{formatCurrency(row.b2bPromotionDiscountAmount, row.currency)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-indigo-700">
                            -{formatCurrency(row.adminManualDiscountTotal, row.currency)}
                          </td>
                          <td className={`py-3 px-4 text-right font-mono font-bold ${row.remainingTheUnboundMargin < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                            {formatCurrency(row.remainingTheUnboundMargin, row.currency)}
                            {row.hasLossOverride && (
                              <span className="block text-[9px] font-black text-rose-600 uppercase">Loss Override</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-black text-slate-900">
                            {formatCurrency(row.revisedCustomerSellingPrice, row.currency)}
                          </td>
                          <td className="py-3 px-4 text-slate-500">
                            <div>{row.lastAdjustedByName || 'Admin'}</div>
                            {row.lastAdjustedAt && (
                              <div className="text-[10px] text-slate-400">
                                {new Date(row.lastAdjustedAt).toLocaleDateString()}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                      {manualReport.rows.length === 0 && (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-400">
                            No Admin manual booking discounts recorded yet. Apply margin-funded discounts from Admin CMS → Booking Management → Pricing, Discounts &amp; Financials.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ===================================================================== */}
      {/* CREATE / EDIT PROMOTION & DISCOUNT CODE MODAL                         */}
      {/* ===================================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200 p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {editingPromo
                    ? 'Edit Promotion & Discount Code'
                    : 'Create Promotion & Discount Code'}
                </h3>
                <p className="text-xs text-slate-500">
                  Discounts apply strictly to TheUnbound Base Selling Price (Stage 1) before Agent Additional Markup. Supplier nett cost is never reduced.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-2 rounded-full cursor-pointer"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="flex items-center space-x-2 bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl text-xs font-medium">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-6 text-xs">
              {/* SECTION A: BASIC PROMOTION DETAILS & DISCOUNT CODE */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
                  <Tag className="w-4 h-4 text-[#008972]" />
                  <span>A. Discount Code Configuration &amp; Basic Details</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Promotion Name *</label>
                    <input
                      type="text"
                      required
                      maxLength={200}
                      value={formData.title || ''}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="e.g. Autumn Japan B2B Launch Offer"
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#00C6A6]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Promotion Type</label>
                    <select
                      value={formData.promotionType || 'DISCOUNT_CODE'}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          promotionType: e.target.value as Promotion['promotionType']
                        })
                      }
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#00C6A6]"
                    >
                      <option value="DISCOUNT_CODE">Discount Code Only</option>
                      <option value="HYBRID">Discount Code + Campaign Banner</option>
                      <option value="CAMPAIGN_BANNER">Campaign Banner Only</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">
                      Discount Code {formData.promotionType === 'DISCOUNT_CODE' ? '*' : '(Optional)'}
                    </label>
                    <input
                      type="text"
                      maxLength={64}
                      value={formData.promoCode || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, promoCode: e.target.value.toUpperCase() })
                      }
                      placeholder="e.g. JAPAN10 or SAKURA2027"
                      className={`w-full p-2.5 bg-white border rounded-xl uppercase font-mono font-bold tracking-wider focus:outline-none ${
                        codeConflict
                          ? 'border-rose-400 text-rose-700 bg-rose-50/40'
                          : 'border-slate-200 focus:border-[#00C6A6]'
                      }`}
                    />
                    {normalizedDraftCode && (
                      <div className="flex items-center justify-between text-[10px] pt-0.5">
                        <span className="text-slate-500">
                          Normalized key: <strong className="font-mono">{normalizedDraftCode}</strong>
                        </span>
                        {codeConflict ? (
                          <span className="text-rose-600 font-bold">Duplicate code detected!</span>
                        ) : (
                          <span className="text-emerald-600 font-semibold">Code available</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Subtitle / Tagline</label>
                    <input
                      type="text"
                      maxLength={240}
                      value={formData.subtitle || ''}
                      onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                      placeholder="e.g. 10% Off Base Selling Price"
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#00C6A6]"
                    />
                  </div>
                </div>

                {/* Coupon Channel & Admin Manual Booking Discount Configuration */}
                <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-200/70 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-wider text-indigo-900">
                      Discount Channel &amp; Margin Funding Governance
                    </span>
                    <span className="text-[10px] font-bold text-indigo-700">
                      Strictly separates B2B Agent Promos vs Admin Manual Booking Coupons
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700">Coupon Application Channel</label>
                      <select
                        value={formData.couponChannel || 'B2B_AGENT'}
                        onChange={(e) => {
                          const ch = e.target.value as Promotion['couponChannel'];
                          setFormData({
                            ...formData,
                            couponChannel: ch,
                            permittedForExistingBookings:
                              ch === 'ADMIN_MANUAL' || ch === 'BOTH'
                                ? true
                                : formData.permittedForExistingBookings
                          });
                        }}
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                      >
                        <option value="B2B_AGENT">B2B Agent Quotation / Booking Promo Only</option>
                        <option value="ADMIN_MANUAL">Admin Manual Booking Coupon Only (Margin-Funded)</option>
                        <option value="BOTH">Both B2B Agent Promo &amp; Admin Manual Booking Coupon</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700">Funding Source</label>
                      <select
                        value={formData.fundingSource || 'THEUNBOUND_MARGIN'}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            fundingSource: e.target.value as Promotion['fundingSource']
                          })
                        }
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                      >
                        <option value="THEUNBOUND_MARGIN">TheUnbound Margin (Never reduces Supplier Nett)</option>
                        <option value="MARKETING_BUDGET">Marketing Budget (Tracked Against Margin)</option>
                        <option value="SHARED">Shared Commercial Pool</option>
                      </select>
                    </div>
                  </div>

                  {(formData.couponChannel === 'ADMIN_MANUAL' || formData.couponChannel === 'BOTH') && (
                    <div className="flex flex-wrap items-center gap-5 pt-1 text-xs">
                      <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.permittedForExistingBookings !== false}
                          onChange={(e) =>
                            setFormData({ ...formData, permittedForExistingBookings: e.target.checked })
                          }
                          className="rounded border-slate-300 text-indigo-600"
                        />
                        <span>Permitted on Existing Bookings in Booking Management</span>
                      </label>

                      <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(formData.requiresAdminApproval)}
                          onChange={(e) =>
                            setFormData({ ...formData, requiresAdminApproval: e.target.checked })
                          }
                          className="rounded border-slate-300 text-indigo-600"
                        />
                        <span>Requires Admin Approval Reference</span>
                      </label>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">
                      Customer / Agent-Facing Description
                    </label>
                    <textarea
                      rows={2}
                      maxLength={2000}
                      value={formData.description || ''}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Safe description shown on applied promo badges and proposals..."
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#00C6A6]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-amber-800">
                      Internal Admin Notes (Strictly Hidden from B2B Agents)
                    </label>
                    <textarea
                      rows={2}
                      maxLength={4000}
                      value={formData.internalAdminNotes || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, internalAdminNotes: e.target.value })
                      }
                      placeholder="Commercial approval ref, campaign budget, sales owner notes..."
                      className="w-full p-2.5 bg-amber-50/40 border border-amber-200 rounded-xl focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <label className="inline-flex items-center space-x-2 text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.caseInsensitiveCode !== false}
                    onChange={(e) =>
                      setFormData({ ...formData, caseInsensitiveCode: e.target.checked })
                    }
                    className="w-4 h-4 rounded border-slate-300 text-[#00C6A6]"
                  />
                  <span className="font-medium">
                    Case-insensitive code matching (recommended — trims whitespace and matches uppercase)
                  </span>
                </label>
              </div>

              {/* SECTION B: DISCOUNT RULES */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
                  <Percent className="w-4 h-4 text-[#008972]" />
                  <span>B. Discount Rules (Applied Strictly to TheUnbound Base Selling Price)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Discount Type *</label>
                    <select
                      value={formData.discountType || 'PERCENTAGE'}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          discountType: e.target.value as PromotionDiscountType
                        })
                      }
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl"
                    >
                      <option value="PERCENTAGE">Percentage (%)</option>
                      <option value="FIXED">Fixed Amount</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">
                      Discount Value {formData.discountType === 'PERCENTAGE' ? '(%)' : '(Amount)'} *
                    </label>
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="any"
                      max={formData.discountType === 'PERCENTAGE' ? 100 : undefined}
                      value={formData.discountValue ?? 0}
                      onChange={(e) =>
                        setFormData({ ...formData, discountValue: Number(e.target.value) })
                      }
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-emerald-700"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Promotion Currency</label>
                    <select
                      value={formData.currency || 'INR'}
                      onChange={(e) =>
                        setFormData({ ...formData, currency: e.target.value as CurrencyCode })
                      }
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl"
                    >
                      {SUPPORTED_CURRENCIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">
                      Maximum Discount Cap ({formData.currency || 'INR'})
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={formData.maxDiscount ?? 0}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          maxDiscount: Number(e.target.value),
                          maxDiscountAmount: Number(e.target.value)
                        })
                      }
                      placeholder="0 = No cap"
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">
                      Max Discount Per Quotation ({formData.currency || 'INR'})
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={formData.maxDiscountPerQuotation ?? 0}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          maxDiscountPerQuotation: Number(e.target.value)
                        })
                      }
                      placeholder="0 = No per-quote cap"
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">
                      Min Eligible Base Selling Price ({formData.currency || 'INR'})
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={formData.minEligibleBaseSellingPrice ?? 0}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          minEligibleBaseSellingPrice: Number(e.target.value),
                          minBookingValue: Number(e.target.value)
                        })
                      }
                      placeholder="0 = No minimum"
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION C: APPLICABILITY RULES */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
                  <Globe2 className="w-4 h-4 text-[#008972]" />
                  <span>C. Eligibility &amp; Applicability Scope</span>
                </div>

                {/* Destinations */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-slate-700">Eligible Destinations</label>
                    <label className="inline-flex items-center space-x-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.applyToAllDestinations !== false}
                        onChange={(e) =>
                          setFormData({ ...formData, applyToAllDestinations: e.target.checked })
                        }
                        className="w-3.5 h-3.5 rounded text-[#00C6A6]"
                      />
                      <span className="text-[11px] font-semibold text-slate-600">
                        Apply to all destinations
                      </span>
                    </label>
                  </div>
                  {formData.applyToAllDestinations === false && (
                    <div className="flex flex-wrap gap-2 bg-white p-3 rounded-xl border border-slate-200 max-h-32 overflow-y-auto">
                      {destinations.map((dest) => {
                        const selected = (formData.applicableDestinationIds || []).includes(dest.id);
                        return (
                          <button
                            key={dest.id}
                            type="button"
                            onClick={() => toggleArraySelection('applicableDestinationIds', dest.id)}
                            className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer transition-colors ${
                              selected
                                ? 'bg-teal-600 text-white border-teal-600'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {dest.name}
                          </button>
                        );
                      })}
                      {destinations.length === 0 && (
                        <span className="text-slate-400">No destinations available.</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Product Categories */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-slate-700">
                      Eligible Product Categories{' '}
                      <span className="font-normal text-slate-400">(leave none selected for all)</span>
                    </label>
                    {(formData.applicableProductCategories?.length || 0) > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({ ...formData, applicableProductCategories: [] })
                        }
                        className="text-[11px] text-teal-700 hover:underline font-semibold cursor-pointer"
                      >
                        Clear categories
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 bg-white p-3 rounded-xl border border-slate-200">
                    {PRODUCT_CATEGORY_OPTIONS.map((cat) => {
                      const selected = (formData.applicableProductCategories || []).includes(
                        cat.value
                      );
                      return (
                        <button
                          key={cat.value}
                          type="button"
                          onClick={() =>
                            toggleArraySelection('applicableProductCategories', cat.value)
                          }
                          className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer transition-colors ${
                            selected
                              ? 'bg-teal-600 text-white border-teal-600'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {cat.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Specific Products */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-slate-700 flex items-center space-x-1.5">
                      <Package className="w-3.5 h-3.5 text-slate-400" />
                      <span>Specific Products</span>
                    </label>
                    <label className="inline-flex items-center space-x-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.applyToAllProducts !== false}
                        onChange={(e) =>
                          setFormData({ ...formData, applyToAllProducts: e.target.checked })
                        }
                        className="w-3.5 h-3.5 rounded text-[#00C6A6]"
                      />
                      <span className="text-[11px] font-semibold text-slate-600">
                        Apply to all products
                      </span>
                    </label>
                  </div>
                  {formData.applyToAllProducts === false && (
                    <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                      <input
                        type="text"
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        placeholder="Filter products by name or SKU..."
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px]"
                      />
                      <div className="max-h-32 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {visibleProductsForSelect.map((prod) => {
                          const selected = (formData.applicableProductIds || []).includes(prod.id);
                          return (
                            <label
                              key={prod.id}
                              className={`flex items-center space-x-2 px-2.5 py-1.5 rounded-lg border cursor-pointer text-[11px] ${
                                selected
                                  ? 'bg-teal-50 border-teal-300 text-teal-900 font-semibold'
                                  : 'bg-white border-slate-100 text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() =>
                                  toggleArraySelection('applicableProductIds', prod.id)
                                }
                                className="rounded text-[#00C6A6]"
                              />
                              <span className="truncate">{prod.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Specific Agencies & B2B Agents */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-slate-700 flex items-center space-x-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span>Eligible Agencies &amp; B2B Agents</span>
                    </label>
                    <label className="inline-flex items-center space-x-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.applyToAllAgents !== false}
                        onChange={(e) =>
                          setFormData({ ...formData, applyToAllAgents: e.target.checked })
                        }
                        className="w-3.5 h-3.5 rounded text-[#00C6A6]"
                      />
                      <span className="text-[11px] font-semibold text-slate-600">
                        Apply to all B2B agents &amp; agencies
                      </span>
                    </label>
                  </div>

                  {formData.applyToAllAgents === false && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                        <div className="text-[11px] font-bold text-slate-700">
                          Specific Agencies ({formData.applicableAgencyIds?.length || 0} selected)
                        </div>
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {agencies.map((ag) => {
                            const selected = (formData.applicableAgencyIds || []).includes(ag.id);
                            return (
                              <label
                                key={ag.id}
                                className="flex items-center space-x-2 text-[11px] cursor-pointer py-0.5"
                              >
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() =>
                                    toggleArraySelection('applicableAgencyIds', ag.id)
                                  }
                                  className="rounded text-[#00C6A6]"
                                />
                                <span className="truncate">{ag.name}</span>
                              </label>
                            );
                          })}
                          {agencies.length === 0 && (
                            <div className="text-[11px] text-slate-400">No agencies registered.</div>
                          )}
                        </div>
                      </div>

                      <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                        <div className="text-[11px] font-bold text-slate-700">
                          Specific B2B Agents ({formData.applicableAgentIds?.length || 0} selected)
                        </div>
                        <input
                          type="text"
                          value={agentSearch}
                          onChange={(e) => setAgentSearch(e.target.value)}
                          placeholder="Filter agents..."
                          className="w-full px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px]"
                        />
                        <div className="max-h-24 overflow-y-auto space-y-1">
                          {visibleAgentsForSelect.map((agUser) => {
                            const selected = (formData.applicableAgentIds || []).includes(agUser.id);
                            return (
                              <label
                                key={agUser.id}
                                className="flex items-center space-x-2 text-[11px] cursor-pointer py-0.5"
                              >
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() =>
                                    toggleArraySelection('applicableAgentIds', agUser.id)
                                  }
                                  className="rounded text-[#00C6A6]"
                                />
                                <span className="truncate">
                                  {agUser.name} ({agUser.email})
                                </span>
                              </label>
                            );
                          })}
                          {visibleAgentsForSelect.length === 0 && (
                            <div className="text-[11px] text-slate-400">No matching B2B agents.</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Minimum Passengers</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.minPassengers ?? 0}
                      onChange={(e) =>
                        setFormData({ ...formData, minPassengers: Number(e.target.value) })
                      }
                      placeholder="0 = No minimum"
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Target Audience</label>
                    <select
                      value={formData.targetAudience || 'B2B_AGENT'}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          targetAudience: e.target.value as PromotionAudience
                        })
                      }
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl"
                    >
                      <option value="B2B_AGENT">B2B Agents Only</option>
                      <option value="ALL">All Audiences</option>
                      <option value="BUYER">Retail Buyers Only</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION D: USAGE RESTRICTIONS & BOOKING POLICY */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
                  <Sliders className="w-4 h-4 text-[#008972]" />
                  <span>D. Usage Limits, Quote Rules &amp; Booking Validity Policy</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Total Usage Limit</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.totalUsageLimit ?? 0}
                      onChange={(e) =>
                        setFormData({ ...formData, totalUsageLimit: Number(e.target.value) })
                      }
                      placeholder="0 = Unlimited"
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Max Per B2B Agent</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.maxUsesPerAgent ?? 0}
                      onChange={(e) =>
                        setFormData({ ...formData, maxUsesPerAgent: Number(e.target.value) })
                      }
                      placeholder="0 = Unlimited"
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Max Per Agency</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.maxUsesPerAgency ?? 0}
                      onChange={(e) =>
                        setFormData({ ...formData, maxUsesPerAgency: Number(e.target.value) })
                      }
                      placeholder="0 = Unlimited"
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Max Per Booking</label>
                    <input
                      type="number"
                      min="1"
                      max="1"
                      value={formData.maxUsesPerBooking ?? 1}
                      onChange={(e) =>
                        setFormData({ ...formData, maxUsesPerBooking: Number(e.target.value) || 1 })
                      }
                      className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.oneTimePerUser)}
                      onChange={(e) =>
                        setFormData({ ...formData, oneTimePerUser: e.target.checked })
                      }
                      className="w-4 h-4 rounded text-[#00C6A6]"
                    />
                    <span>One-time use per B2B Agent</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.allowReuseOnRevisedQuotation !== false}
                      onChange={(e) =>
                        setFormData({ ...formData, allowReuseOnRevisedQuotation: e.target.checked })
                      }
                      className="w-4 h-4 rounded text-[#00C6A6]"
                    />
                    <span>Reusable on revised quotations</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.newQuotationsOnly)}
                      onChange={(e) =>
                        setFormData({ ...formData, newQuotationsOnly: e.target.checked })
                      }
                      className="w-4 h-4 rounded text-[#00C6A6]"
                    />
                    <span>New quotations only</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.allowOnDraftQuotations !== false}
                      onChange={(e) =>
                        setFormData({ ...formData, allowOnDraftQuotations: e.target.checked })
                      }
                      className="w-4 h-4 rounded text-[#00C6A6]"
                    />
                    <span>Allowed on draft quotations</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.allowAtBookingConfirmation !== false}
                      onChange={(e) =>
                        setFormData({ ...formData, allowAtBookingConfirmation: e.target.checked })
                      }
                      className="w-4 h-4 rounded text-[#00C6A6]"
                    />
                    <span>Allowed at booking confirmation stage</span>
                  </label>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">
                    Booking Revalidation Policy (if promotion expires or pauses between quote and booking)
                  </label>
                  <select
                    value={formData.bookingValidityPolicy || 'REQUIRE_REACCEPTANCE'}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        bookingValidityPolicy: e.target.value as PromotionBookingValidityPolicy
                      })
                    }
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl"
                  >
                    <option value="REQUIRE_REACCEPTANCE">
                      Require Re-acceptance — Notify agent and confirm booking at updated non-discounted price
                    </option>
                    <option value="BLOCK_IF_EXPIRED">
                      Strict Block — Prevent booking confirmation until invalid promotion is removed
                    </option>
                    <option value="HONOR_QUOTE_SNAPSHOT">
                      Honor Quoted Snapshot — Retain discount if it was validly locked on the quotation
                    </option>
                  </select>
                </div>
              </div>

              {/* SECTION E: LIFECYCLE, DATES & DISPLAY PLACEMENT */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
                  <Calendar className="w-4 h-4 text-[#008972]" />
                  <span>E. Validity Window, Lifecycle Status &amp; Campaign Display</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Start Date *</label>
                    <input
                      type="date"
                      required
                      value={formData.startDate || ''}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">End Date *</label>
                    <input
                      type="date"
                      required
                      value={formData.endDate || ''}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Lifecycle Status</label>
                    <select
                      value={formData.status || 'ACTIVE'}
                      onChange={(e) => {
                        const st = e.target.value as CampaignStatus;
                        setFormData({
                          ...formData,
                          status: st,
                          isActive: st === 'ACTIVE' || st === 'SCHEDULED'
                        });
                      }}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold"
                    >
                      <option value="DRAFT">Draft</option>
                      <option value="ACTIVE">Active</option>
                      <option value="SCHEDULED">Scheduled</option>
                      <option value="PAUSED">Paused</option>
                      <option value="DISABLED">Disabled</option>
                      <option value="EXPIRED">Expired</option>
                    </select>
                  </div>
                </div>

                {formData.promotionType !== 'DISCOUNT_CODE' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-200/70">
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700">Display Placement</label>
                      <select
                        value={formData.displayPlacement || 'BANNER'}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            displayPlacement: e.target.value as PromotionPlacement
                          })
                        }
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl"
                      >
                        <option value="BANNER">Top Hero Banner</option>
                        <option value="MODAL">Popup Modal</option>
                        <option value="PRODUCT_PAGE">Product Page</option>
                        <option value="DESTINATION_PAGE">Destination Page</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700">Popup Frequency</label>
                      <select
                        value={formData.frequency || 'ALWAYS'}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            frequency: e.target.value as PromotionFrequency
                          })
                        }
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl"
                      >
                        <option value="ONCE_PER_SESSION">Once Per Session</option>
                        <option value="ONCE_PER_DAY">Once Per Day</option>
                        <option value="ALWAYS">Always</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700">Banner Image URL</label>
                      <input
                        type="url"
                        value={formData.bannerImage || ''}
                        onChange={(e) => setFormData({ ...formData, bannerImage: e.target.value })}
                        placeholder="https://images.unsplash.com/..."
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <div>
                  {editingPromo && (
                    <button
                      type="button"
                      onClick={() => handleDelete(editingPromo.id)}
                      className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl flex items-center space-x-1.5 transition-colors cursor-pointer border border-rose-200"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>
                        {(redemptionCountByPromo.get(editingPromo.id) ||
                          editingPromo.successfulRedemptionsCount ||
                          0) > 0
                          ? 'Disable (Preserve History)'
                          : 'Delete Promotion'}
                      </span>
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
                    disabled={codeConflict}
                    className="px-6 py-2.5 bg-[#00C6A6] hover:bg-[#008972] disabled:opacity-50 text-slate-950 font-bold rounded-xl shadow-md cursor-pointer transition-colors"
                  >
                    {editingPromo ? 'Save Promotion Changes' : 'Create & Publish Promotion'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
