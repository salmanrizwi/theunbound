import React, { useState, useEffect, useRef } from 'react';
import { 
  Product, 
  ProductCategory, 
  CurrencyCode, 
  Destination, 
  Supplier, 
  CityHub, 
  MasterRegion,
  TieredPrice,
  ProductUpsell
} from '../../types';
import { 
  ArrowLeft, 
  Save, 
  Eye, 
  Plus, 
  Trash2, 
  Sparkles, 
  Car, 
  Users, 
  Ticket, 
  Compass, 
  Ship, 
  Anchor,
  ExternalLink,
  Languages, 
  Utensils, 
  Clock, 
  MapPin, 
  Globe2, 
  FileText,
  DollarSign,
  AlertTriangle,
  Upload,
  Layers,
  Percent,
  Activity,
  UserCheck,
  Briefcase,
  Edit2,
  CheckCircle,
  XCircle,
  ArrowUp,
  ArrowDown,
  Info,
  ShieldCheck,
  Check,
  X,
  Train
} from 'lucide-react';
import { SectionCard } from '../common/SectionCard';
import { FormField } from '../common/FormField';
import { PageHeader } from '../common/PageHeader';
import { PricingConfigurationComponent } from '../common/PricingConfigurationComponent';
import { ProductPreviewCard } from '../common/ProductPreviewCard';
import { AppDatabase } from '../../services/db';
import { MasterDataService } from '../../services/masterDataService';
import { getActiveUpsellsForProduct, resolveProductUpsells } from '../../services/configuratorRegistry';
import { ExistingProductUpsellSelectorModal } from './ExistingProductUpsellSelectorModal';
import { OperationalAssetSelector, SelectedAssetPayload } from './OperationalAssetSelector';
import { OperationalAssetsManager } from './OperationalAssetsManager';
import { calculateUnifiedPrice, calculateB2BAgentPrice } from '../../services/pricingEngine';
import { RichTextEditor } from '../common/RichTextEditor';

interface ProductUpdateWorkspaceProps {
  product: Product | null; // null means Create mode
  destinations: Destination[];
  masterRegions: MasterRegion[];
  cityHubs: CityHub[];
  suppliers: Supplier[];
  onSave: (savedProduct: Product) => void;
  onCancel: () => void;
}

const CATEGORIES_MAPPING: { label: string; value: ProductCategory; icon: any; desc: string }[] = [
  { label: 'Private Tour', value: 'Private Tours', icon: Car, desc: 'Private chauffeured tour with vehicle pricing.' },
  { label: 'Group Tour', value: 'Group Tours', icon: Users, desc: 'Shared scheduled departures with per-person rates.' },
  { label: 'Ticket', value: 'Tickets', icon: Ticket, desc: 'Timed entries and attraction passes.' },
  { label: 'Transfer', value: 'Transfers', icon: Car, desc: 'Airport & intercity dynamic ground transfers.' },
  { label: 'Guide', value: 'Guides', icon: Languages, desc: 'Licensed local multilingual guide services.' },
  { label: 'Restaurant', value: 'Lunch / Dinner Restaurant', icon: Utensils, desc: 'Gourmet meal courses and dining reservations.' },
  { label: 'Private Yacht', value: 'Private Yacht', icon: Ship, desc: 'Luxury yacht charters and skipper services.' },
  { label: 'Ferry', value: 'Ferry', icon: Anchor, desc: 'Scheduled passenger ferry and maritime transit with route ports.' },
  { label: 'Rail', value: 'Rail', icon: Train, desc: 'High-speed bullet train smartEX routes and services.' },
];

export const ProductUpdateWorkspace: React.FC<ProductUpdateWorkspaceProps> = ({
  product,
  destinations,
  masterRegions,
  cityHubs,
  suppliers,
  onSave,
  onCancel
}) => {
  const db = AppDatabase.getInstance();

  // Form State
  const [activeCategory, setActiveCategory] = useState<ProductCategory>(
    product?.category || 'Private Tours'
  );

  const [isOperationalAssetsManagerOpen, setIsOperationalAssetsManagerOpen] = useState(false);
  const [operationalAssetsManagerTab, setOperationalAssetsManagerTab] = useState<'VEHICLES' | 'YACHTS' | 'FERRIES'>('VEHICLES');

  // Sections 13 & 33: New products start with completely empty cascading selections (no auto-selection)
  const createCleanWorkspaceFormData = (): Partial<Product> => ({
    sku: `UB-${Math.floor(100000 + Math.random() * 900000)}`,
    name: '',
    title: '',
    shortDescription: '',
    longDescription: '',
    category: 'Private Tours',
    subcategory: '',
    destinationId: '',
    destinationName: '',
    regionId: '',
    regionName: '',
    hubId: '',
    country: '',
    city: '',
    productType: 'Private Tour',
    duration: '',
    operatingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    operatingHours: '',
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
    inclusions: [],
    exclusions: [],
    importantInformation: [],
    meetingPoint: '',
    pickupInformation: '',
    pickupPoint: '',
    dropoffPoint: '',
    images: [],
    status: 'ACTIVE',
    pricingMethod: 'capacity_based',
    tieredPricing: [],
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
    mealSelect: [],
    upsells: []
  });

  const [formData, setFormData] = useState<Partial<Product>>(() => {
    if (product) return { 
      ...product,
      hubIds: product.hubIds || (product.hubId ? [product.hubId] : [])
    };
    return createCleanWorkspaceFormData();
  });

  // Section 14: Audit existing product hierarchy on load without auto-repairing or modifying data
  const [hierarchyIntegrityIssue, setHierarchyIntegrityIssue] = useState<string | null>(() => {
    if (!product) return null;
    const masterData = MasterDataService.getInstance();
    const audit = masterData.auditProductHierarchy(product);
    return !audit.valid ? audit.issues.join('; ') : null;
  });

  // All Master Products catalog for upsell selector and live resolution
  const [allMasterProducts, setAllMasterProducts] = useState<Product[]>([]);
  const [isProductSelectorOpen, setIsProductSelectorOpen] = useState(false);

  useEffect(() => {
    const prods = db.getProducts();
    setAllMasterProducts(prods);

    const unsub = db.subscribe(() => {
      setAllMasterProducts(db.getProducts());
    });
    return unsub;
  }, []);

  // Keep state sync with product changes and resolve live master upsells
  const currentProductIdRef = useRef<string | undefined>(product?.id);

  useEffect(() => {
    if (product && product.id !== currentProductIdRef.current) {
      currentProductIdRef.current = product.id;
      const prods = allMasterProducts.length > 0 ? allMasterProducts : db.getProducts();
      const resolvedUpsells = resolveProductUpsells(product, prods);
      setFormData({ 
        ...product,
        upsells: resolvedUpsells
      });
      setActiveCategory(product.category);
    }
  }, [product?.id]);

  // When allMasterProducts first loads, populate upsells if not already resolved
  useEffect(() => {
    if (product && allMasterProducts.length > 0) {
      setFormData(prev => {
        if (!prev.upsells || prev.upsells.length === 0) {
          const resolvedUpsells = resolveProductUpsells(product, allMasterProducts);
          return { ...prev, upsells: resolvedUpsells };
        }
        return prev;
      });
    }
  }, [allMasterProducts.length]);

  // Sync pricing method and configs when category changes
  const handleSelectCategory = (category: ProductCategory) => {
    setActiveCategory(category);
    const isCap = category === 'Private Tours' || category === 'Transfers' || category === 'Private Yacht';
    const isHourly = category === 'Guides';
    
    setFormData(prev => ({
      ...prev,
      category,
      pricingMethod: isCap ? 'capacity_based' : isHourly ? 'hourly_based' : 'per_person',
      productType: category.replace(/s$/, '')
    }));
  };

  // Live calculation helper
  const calculateSellingPrice = (net?: number, markupPercent?: number) => {
    if (net === undefined || net === null || isNaN(net) || net <= 0) return 0;
    const markupAmt = net * ((markupPercent || 0) / 100);
    const taxAmt = markupAmt * ((formData.taxPercent || 0) / 100);
    const subtotal = net + markupAmt + taxAmt;
    const feeAmt = subtotal * ((formData.serviceFeeFixed || 0) / 100);
    return Math.round(subtotal + feeAmt);
  };

  // Authoritative B2B Agent Price calculation
  const effectiveMargin = formData.b2bAgentMarkupPercent !== undefined 
    ? formData.b2bAgentMarkupPercent 
    : (formData.defaultMarkupPercent || 0);

  const b2bCalc = calculateB2BAgentPrice({
    nettCost: formData.pricingMethod === 'capacity_based' 
      ? (formData.vehicleConfig?.unitVehicleNetCost !== undefined ? formData.vehicleConfig.unitVehicleNetCost : (formData.adultNetPrice || 0))
      : (formData.adultNetPrice || 0),
    marginPercent: effectiveMargin,
    taxPercent: formData.taxPercent || 0,
    serviceFeePercent: formData.serviceFeeFixed || 0,
    currency: (formData.currency || formData.nativeCurrency || 'USD') as CurrencyCode
  });

  const currentAdultSellingPrice = b2bCalc.price;

  // Inclusions/Exclusions Temp Inputs
  const [newInclusion, setNewInclusion] = useState('');
  const [newExclusion, setNewExclusion] = useState('');

  // Upsell Modal / Form State (For Standalone Upsells or Editing)
  const [isUpsellModalOpen, setIsUpsellModalOpen] = useState(false);
  const [editingUpsellId, setEditingUpsellId] = useState<string | null>(null);
  const [upsellForm, setUpsellForm] = useState<Partial<ProductUpsell>>({
    name: '',
    shortDescription: '',
    price: 45,
    netCost: 30,
    currency: formData.currency || 'USD',
    status: 'ACTIVE',
    priceType: 'PER_PERSON'
  });

  const handleOpenAddStandaloneUpsell = () => {
    setEditingUpsellId(null);
    setUpsellForm({
      name: '',
      shortDescription: '',
      price: 50,
      netCost: 35,
      currency: formData.currency || 'USD',
      status: 'ACTIVE',
      displayOrder: (formData.upsells?.length || 0) + 1,
      priceType: 'PER_PERSON',
      isExistingProduct: false
    });
    setIsUpsellModalOpen(true);
  };

  const handleOpenAddExistingProductUpsell = () => {
    setIsProductSelectorOpen(true);
  };

  const handleSelectExistingProduct = (newUpsell: ProductUpsell) => {
    setFormData(prev => ({
      ...prev,
      upsells: [...(prev.upsells || []), newUpsell]
    }));
  };

  const handleOpenEditUpsell = (upsell: ProductUpsell) => {
    setEditingUpsellId(upsell.id);
    setUpsellForm({ ...upsell });
    setIsUpsellModalOpen(true);
  };

  const handleSaveUpsell = (e: React.FormEvent) => {
    e.preventDefault();
    if (!upsellForm.name?.trim()) {
      alert('Upsell name is required.');
      return;
    }

    const currentUpsells = [...(formData.upsells || [])];

    if (editingUpsellId) {
      // Edit existing
      const updated = currentUpsells.map(u => 
        u.id === editingUpsellId ? { ...u, ...(upsellForm as ProductUpsell) } : u
      );
      setFormData(prev => ({ ...prev, upsells: updated }));
    } else {
      // Add new
      const newUpsell: ProductUpsell = {
        id: `upsell-${Date.now()}`,
        productId: formData.id || '',
        name: upsellForm.name.trim(),
        shortDescription: upsellForm.shortDescription || '',
        description: upsellForm.shortDescription || '',
        price: Number(upsellForm.price) || 0,
        netCost: Number(upsellForm.netCost) || Math.round((Number(upsellForm.price) || 0) * 0.75),
        currency: (upsellForm.currency || formData.currency || 'USD') as CurrencyCode,
        status: upsellForm.status || 'ACTIVE',
        displayOrder: currentUpsells.length + 1,
        priceType: upsellForm.priceType || 'PER_PERSON'
      };
      setFormData(prev => ({ ...prev, upsells: [...currentUpsells, newUpsell] }));
    }

    setIsUpsellModalOpen(false);
  };

  const handleToggleUpsellStatus = (upsellId: string) => {
    setFormData(prev => ({
      ...prev,
      upsells: (prev.upsells || []).map(u => {
        if (u.id === upsellId) {
          const nextStatus = u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
          return { ...u, status: nextStatus };
        }
        return u;
      })
    }));
  };

  const handleReorderUpsell = (index: number, direction: 'up' | 'down') => {
    const list = [...(formData.upsells || [])];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;

    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;

    const reordered = list.map((item, idx) => ({ ...item, displayOrder: idx + 1 }));
    setFormData(prev => ({ ...prev, upsells: reordered }));
  };

  const handleDeleteUpsell = (upsellId: string) => {
    // Soft archive / deactivation to protect historical snapshots (Section 35)
    if (confirm('Deactivate this Optional Experience Upgrade? (Existing quotes will retain their historical record).')) {
      setFormData(prev => ({
        ...prev,
        upsells: (prev.upsells || []).map(u => 
          u.id === upsellId ? { ...u, status: 'ARCHIVED' } : u
        ).filter(u => u.status !== 'ARCHIVED')
      }));
    }
  };

  // Inclusions/Exclusions Handlers
  const handleAddInclusion = () => {
    if (!newInclusion.trim()) return;
    setFormData(prev => ({
      ...prev,
      inclusions: [...(prev.inclusions || []), newInclusion.trim()]
    }));
    setNewInclusion('');
  };

  const handleRemoveInclusion = (index: number) => {
    setFormData(prev => ({
      ...prev,
      inclusions: (prev.inclusions || []).filter((_, i) => i !== index)
    }));
  };

  const handleAddExclusion = () => {
    if (!newExclusion.trim()) return;
    setFormData(prev => ({
      ...prev,
      exclusions: [...(prev.exclusions || []), newExclusion.trim()]
    }));
    setNewExclusion('');
  };

  const handleRemoveExclusion = (index: number) => {
    setFormData(prev => ({
      ...prev,
      exclusions: (prev.exclusions || []).filter((_, i) => i !== index)
    }));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name?.trim()) {
      alert('Product Name is required.');
      return;
    }

    const isCap = activeCategory === 'Private Tours' || 
      activeCategory === 'Transfers' || 
      activeCategory === 'Private Yacht' || 
      activeCategory === 'Private Tour' || 
      activeCategory === 'Transfer' || 
      activeCategory === 'Yacht' ||
      activeCategory === 'Ferry' ||
      activeCategory === 'Ferries';

    // Requirement 13: Master Inventory Validation when saving a Ferry Product
    if (activeCategory === 'Ferry' || activeCategory === 'Ferries') {
      const masterFerries = db.getFerries();
      const configuredVesselIds = new Set<string>();
      if (formData.vehicleConfig?.vesselId) configuredVesselIds.add(formData.vehicleConfig.vesselId);
      if ((formData as any).vesselId) configuredVesselIds.add((formData as any).vesselId);
      (formData.tieredPricing || []).forEach(t => {
        if (t.fleetId) configuredVesselIds.add(t.fleetId);
      });

      if (configuredVesselIds.size > 0) {
        for (const vId of configuredVesselIds) {
          const vessel = masterFerries.find(f => f.id === vId || f.name === vId);
          if (!vessel) {
            alert(`Invalid Ferry/Vessel ("${vId}"): Vessel does not exist in Authoritative Operational Master Inventory.`);
            return;
          }
          if (vessel.status === 'INACTIVE') {
            alert(`Invalid Ferry/Vessel ("${vessel.name}"): Vessel is marked as INACTIVE in Authoritative Operational Master Inventory.`);
            return;
          }
        }
      }
    }

    const sortedTiers = [...(formData.tieredPricing || [])].sort((a, b) => a.minPax - b.minPax);

    if (isCap) {
      // Rule 8/9/10: Operational asset is required in tiered pricing for capacity-based categories
      const hasOperationalAsset = (formData.tieredPricing || []).some(t => t.fleetId || t.vehicleId) || 
                                  formData.vehicleId || 
                                  formData.yachtId || 
                                  (formData.vehicleConfig?.vehicleType && activeCategory !== 'Private Yacht' && activeCategory !== 'Yacht');
                                  
      if (!hasOperationalAsset) {
        alert('Vehicle / Fleet Operational Selection is required.');
        return;
      }


      // Check tiered pricing validation rules (overlap, gap, duplicate, coverage) on save
      if (sortedTiers.length === 0) {
        alert('Pricing tiers coverage is incomplete. Please add capacity pricing tiers.');
        return;
      }
      for (const tier of sortedTiers) {
        if (tier.minPax > tier.maxPax) {
          alert(`Invalid range: Min Pax (${tier.minPax}) is greater than Max Pax (${tier.maxPax}) in tier "${tier.tierLabel || ''}".`);
          return;
        }
        const netVal = tier.supplierNett !== undefined 
          ? tier.supplierNett 
          : (tier.nettPrice !== undefined ? tier.nettPrice : tier.netCostPerPax);
        if (netVal === undefined || isNaN(Number(netVal)) || Number(netVal) <= 0) {
          alert(`Supplier Nett * is required and must be greater than 0 in tier "${tier.tierLabel || `${tier.minPax}–${tier.maxPax} Pax`}".`);
          return;
        }
      }
      
      const seenRanges = new Set<string>();
      for (const t of sortedTiers) {
        const key = `${t.minPax}-${t.maxPax}`;
        if (seenRanges.has(key)) {
          alert(`Duplicate tier range detected for: ${t.minPax}–${t.maxPax} Pax.`);
          return;
        }
        seenRanges.add(key);
      }
      
      for (let i = 0; i < sortedTiers.length - 1; i++) {
        const current = sortedTiers[i];
        const next = sortedTiers[i + 1];
        if (current.maxPax >= next.minPax) {
          alert(`Overlap detected: Tier "${current.tierLabel || `${current.minPax}-${current.maxPax}`}" overlaps with "${next.tierLabel || `${next.minPax}-${next.maxPax}`}".`);
          return;
        }
      }
    }

    if ((activeCategory === 'Transfers' || activeCategory === 'Transfer') && (!formData.fromHubId || !formData.toHubId)) {
      alert('From Hub and To Hub are required for Transfers.');
      return;
    }

    if (!formData.currency && !formData.nativeCurrency) {
      alert('Product Native Currency is required.');
      return;
    }

    // Sections 24 & 25: Canonical hierarchy validation
    const masterData = MasterDataService.getInstance();
    let validatedRegion: any;
    let validatedDestination: any;
    let validatedHub: any;

    if (activeCategory === 'Rail') {
      const hubIds = formData.hubIds || [];
      if (hubIds.length === 0) {
        alert('At least one associated City Hub is required for Rail products.');
        return;
      }
      for (const hId of hubIds) {
        const hierarchy = masterData.validateHierarchy(formData.regionId, formData.destinationId, hId);
        if (!hierarchy.valid) {
          alert(`Data Integrity Error for Associated Hub (${hId}): ${hierarchy.error}`);
          return;
        }
        validatedRegion = hierarchy.region;
        validatedDestination = hierarchy.destination;
      }
      if (hubIds[0]) {
        validatedHub = masterData.getHubById(hubIds[0]);
      }
    } else {
      const hierarchy = masterData.validateHierarchy(formData.regionId, formData.destinationId, formData.hubId);
      if (!hierarchy.valid) {
        alert(`Data Integrity Error: ${hierarchy.error}`);
        return;
      }
      validatedRegion = hierarchy.region;
      validatedDestination = hierarchy.destination;
      validatedHub = hierarchy.hub;
    }

    const chosenCurrency = (formData.nativeCurrency || formData.currency) as CurrencyCode;

    // Direct alignment to prevent zero net cost mapping bugs
    const syncedNet = isCap && sortedTiers.length > 0 
      ? (sortedTiers[0].supplierNett ?? sortedTiers[0].nettPrice ?? sortedTiers[0].netCostPerPax ?? 0) 
      : (formData.adultNetPrice || 0);

    const syncedTiers = (formData.tieredPricing || []).map(t => {
      const netVal = t.supplierNett !== undefined 
        ? Number(t.supplierNett) 
        : (t.nettPrice !== undefined ? Number(t.nettPrice) : (t.netCostPerPax !== undefined ? Number(t.netCostPerPax) : 0));
      const mVal = t.marginValue !== undefined ? Number(t.marginValue) : (formData.b2bAgentMarkupPercent || formData.buyerMarkupPercent || 20);
      const mType = t.marginType || 'PERCENTAGE';
      const tVal = t.taxValue !== undefined ? Number(t.taxValue) : (formData.taxPercent || 10);
      const tType = t.taxType || 'PERCENTAGE';
      const sVal = t.serviceChargeValue !== undefined ? Number(t.serviceChargeValue) : (formData.serviceFeeFixed || 0);
      const sType = t.serviceChargeType || 'PERCENTAGE';

      const unifiedRes = calculateUnifiedPrice({
        nettPrice: netVal,
        quantity: 1,
        marginType: mType as any,
        marginValue: mVal,
        taxPercent: tType === 'NOT_APPLICABLE' ? 0 : tVal,
        serviceChargeType: sType === 'NOT_APPLICABLE' ? 'FIXED' : sType as any,
        serviceChargeValue: sType === 'NOT_APPLICABLE' ? 0 : sVal,
        currency: (t.currency || chosenCurrency) as CurrencyCode
      });

      const calculatedFinal = unifiedRes.finalPrice;

      return {
        ...t,
        capacityPricingRuleId: t.capacityPricingRuleId || `CPR-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        productCategory: activeCategory,
        minPax: t.minPax !== undefined ? Number(t.minPax) : (t.minPassengers !== undefined ? Number(t.minPassengers) : 1),
        minPassengers: t.minPax !== undefined ? Number(t.minPax) : (t.minPassengers !== undefined ? Number(t.minPassengers) : 1),
        maxPax: t.maxPax !== undefined ? Number(t.maxPax) : (t.maxPassengers !== undefined ? Number(t.maxPassengers) : 1),
        maxPassengers: t.maxPax !== undefined ? Number(t.maxPax) : (t.maxPassengers !== undefined ? Number(t.maxPassengers) : 1),
        vehicleCount: t.vehicleCount && Number(t.vehicleCount) > 0 ? Number(t.vehicleCount) : 1,
        currency: t.currency || chosenCurrency,
        nativeCurrency: t.nativeCurrency || t.currency || chosenCurrency,
        supplierNett: netVal, // Authoritative Supplier Nett
        nettPrice: netVal,
        netCostPerPax: netVal,
        marginType: mType,
        marginValue: mVal,
        taxType: tType,
        taxValue: tVal,
        serviceChargeType: sType,
        serviceChargeValue: sVal,
        finalPrice: t.finalPrice !== undefined ? Number(t.finalPrice) : calculatedFinal,
        sellingPricePerPax: t.finalPrice !== undefined ? Number(t.finalPrice) : calculatedFinal,
        status: t.status || 'ACTIVE'
      };
    });

    const capacityTiersPayload = syncedTiers.map(t => ({
      tierId: t.id,
      capacityPricingRuleId: t.capacityPricingRuleId,
      productCategory: t.productCategory,
      minPassengers: t.minPassengers,
      maxPassengers: t.maxPassengers,
      vehicleCount: t.vehicleCount,
      fleetId: t.fleetId,
      fleetName: t.fleetName,
      nativeCurrency: t.nativeCurrency,
      currency: t.currency,
      supplierNett: t.supplierNett,
      nettPrice: t.nettPrice,
      marginType: t.marginType,
      marginValue: t.marginValue,
      taxType: t.taxType,
      taxValue: t.taxValue,
      serviceChargeType: t.serviceChargeType,
      serviceChargeValue: t.serviceChargeValue,
      finalPrice: t.finalPrice,
      status: t.status
    }));

    const finalProduct: Product = {
      ...(formData as Product),
      id: product?.id || `prod-${Date.now()}`,
      category: activeCategory,
      regionId: validatedRegion.id,
      regionName: validatedRegion.name,
      destinationId: validatedDestination.id,
      destinationName: validatedDestination.name,
      country: validatedDestination.country || validatedDestination.name,
      hubId: validatedHub ? validatedHub.id : (formData.hubId || ''),
      city: validatedHub ? validatedHub.name : (formData.city || validatedDestination.name),
      hubIds: formData.hubIds || (validatedHub ? [validatedHub.id] : []),
      pricingModel: isCap 
        ? 'CAPACITY_TIERED' 
        : (activeCategory === 'Guides' ? 'PER_HOUR' : (activeCategory === 'Lunch / Dinner Restaurant' ? 'MEAL_PASSENGER' : (activeCategory === 'Tickets' ? 'PER_PERSON' : 'PER_PERSON'))),
      pricingMethod: isCap ? 'capacity_based' : (activeCategory === 'Guides' ? 'hourly_based' : 'per_person'),
      currency: chosenCurrency,
      nativeCurrency: chosenCurrency,
      adultNetPrice: syncedNet,
      adultNettCost: syncedNet,
      tieredPricing: isCap ? syncedTiers : (formData.tieredPricing || []),
      capacityTiers: isCap ? capacityTiersPayload : undefined,
      mealPricing: (formData as any).mealPricing || formData.restaurantConfig?.mealPricing || [],
      restaurantConfig: {
        ...(formData.restaurantConfig || {}),
        mealPricing: (formData as any).mealPricing || formData.restaurantConfig?.mealPricing || []
      },
      vehicleConfig: isCap ? {
        ...(formData.vehicleConfig || {}),
        unitVehicleNetCost: syncedNet,
        totalTransferCost: syncedNet,
      } : formData.vehicleConfig,
      sellingPriceStartingFrom: currentAdultSellingPrice,
      lastUpdated: new Date().toISOString().split('T')[0]
    };

    onSave(finalProduct);
  };

  const handleSaveDraft = () => {
    if (!formData.currency && !formData.nativeCurrency) {
      alert('Product Native Currency is required.');
      return;
    }

    // Sections 24 & 25: Canonical hierarchy validation
    const masterData = MasterDataService.getInstance();
    let validatedRegion: any;
    let validatedDestination: any;
    let validatedHub: any;

    if (activeCategory === 'Rail') {
      const hubIds = formData.hubIds || [];
      if (hubIds.length > 0) {
        for (const hId of hubIds) {
          const hierarchy = masterData.validateHierarchy(formData.regionId, formData.destinationId, hId);
          if (hierarchy.valid) {
            validatedRegion = hierarchy.region;
            validatedDestination = hierarchy.destination;
          }
        }
        if (hubIds[0]) {
          validatedHub = masterData.getHubById(hubIds[0]);
        }
      }
      if (!validatedRegion || !validatedDestination) {
        // Fallback checks
        validatedRegion = masterData.getRegionById(formData.regionId!);
        validatedDestination = masterData.getDestinationById(formData.destinationId!);
      }
    } else {
      const hierarchy = masterData.validateHierarchy(formData.regionId, formData.destinationId, formData.hubId);
      if (!hierarchy.valid) {
        alert(`Data Integrity Error: ${hierarchy.error}`);
        return;
      }
      validatedRegion = hierarchy.region;
      validatedDestination = hierarchy.destination;
      validatedHub = hierarchy.hub;
    }

    const chosenCurrency = (formData.nativeCurrency || formData.currency) as CurrencyCode;

    const draftProduct: Product = {
      ...(formData as Product),
      id: product?.id || `prod-${Date.now()}`,
      category: activeCategory,
      regionId: validatedRegion ? validatedRegion.id : (formData.regionId || ''),
      regionName: validatedRegion ? validatedRegion.name : (formData.regionName || ''),
      destinationId: validatedDestination ? validatedDestination.id : (formData.destinationId || ''),
      destinationName: validatedDestination ? validatedDestination.name : (formData.destinationName || ''),
      country: validatedDestination ? (validatedDestination.country || validatedDestination.name) : (formData.country || ''),
      hubId: validatedHub ? validatedHub.id : (formData.hubId || ''),
      city: validatedHub ? validatedHub.name : (formData.city || ''),
      hubIds: formData.hubIds || (validatedHub ? [validatedHub.id] : []),
      currency: chosenCurrency,
      nativeCurrency: chosenCurrency,
      status: 'DRAFT',
      sellingPriceStartingFrom: currentAdultSellingPrice,
      lastUpdated: new Date().toISOString().split('T')[0]
    };
    onSave(draftProduct);
  };

  // Calculate active upsells count
  const activeUpsells = (formData.upsells || []).filter(u => u.status === 'ACTIVE');

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 pb-20">
      
      {/* 1. Page Header Standard (Section 5) */}
      <PageHeader
        breadcrumbs={[
          { label: 'Home' },
          { label: 'Products', onClick: onCancel },
          { label: product ? 'Update Product' : 'New Product' }
        ]}
        title={product ? 'Update Master Product' : 'Create New Product'}
        description="Authoritative master source for all product specs, category rules, commercial pricing, and upsells."
        backLabel="Back to Products"
        onBack={onCancel}
        status={formData.status || 'ACTIVE'}
        statusOptions={[
          { label: 'Active', value: 'ACTIVE' },
          { label: 'Draft', value: 'DRAFT' },
          { label: 'Inactive', value: 'INACTIVE' },
          { label: 'Archived', value: 'ARCHIVED' }
        ]}
        onStatusChange={(newStatus) => setFormData({ ...formData, status: newStatus as any })}
      />

      {/* Main Responsive Two-Column Grid Layout (25% / 75%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN - 25% (lg:col-span-3) */}
        {/* Product Preview + Product Category Selection Panel */}
        <div className="lg:col-span-3 space-y-6 lg:sticky lg:top-6">
          
          {/* Real-Time Product Preview */}
          <div className="space-y-2">
            <h3 className="field-label text-slate-400 font-bold px-2 uppercase tracking-wider text-[11px]">Product Preview</h3>
            <ProductPreviewCard
              name={formData.name || 'Untitled Master Experience'}
              category={activeCategory}
              cityName={formData.city || 'Tokyo'}
              destinationName={formData.destinationName || 'Japan'}
              duration={formData.duration || '8 Hours'}
              imageUrl={formData.images?.[0]}
              currency={formData.currency || 'USD'}
              startingPrice={currentAdultSellingPrice}
              status={formData.status || 'ACTIVE'}
              capacityText={formData.pricingMethod === 'capacity_based' ? (formData.tieredPricing?.[0]?.tierLabel || '1-2 Pax') : undefined}
              upsellCount={activeUpsells.length}
              routeText={formData.fromHubName && formData.toHubName ? `${formData.fromHubName} ➔ ${formData.toHubName}` : undefined}
              languageText={formData.guideConfig?.languages ? formData.guideConfig.languages.join(', ') : undefined}
              mealsText={formData.mealSelect && formData.mealSelect.length > 0 ? formData.mealSelect.join(' / ') : undefined}
            />
          </div>

          {/* Product Category selection list */}
          <div className="space-y-2">
            <h3 className="field-label text-slate-400 font-bold px-2 uppercase tracking-wider text-[11px]">Product Category</h3>
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs divide-y divide-slate-100">
              {CATEGORIES_MAPPING.map(cat => {
                const IconComp = cat.icon;
                const isSelected = activeCategory === cat.value;
                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => handleSelectCategory(cat.value)}
                    className={`w-full text-left p-3.5 transition-all flex items-center space-x-3 cursor-pointer ${
                      isSelected 
                        ? 'bg-[#00C6A6]/10 text-slate-950 font-bold border-l-4 border-[#00C6A6]' 
                        : 'hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <IconComp className={`w-4 h-4 ${isSelected ? 'text-[#00C6A6]' : 'text-slate-400'}`} />
                    <div>
                      <div className="text-xs font-bold leading-tight">{cat.label}</div>
                      <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{cat.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-slate-600">
              <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-900">
                <ShieldCheck className="w-4 h-4 text-[#00C6A6]" />
                <span>Category Governance</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Product Management is the single master authority. Fields configured here directly feed B2B configurators, central pricing calculations, and quote builders.
              </p>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN - 75% (lg:col-span-9) */}
        {/* Complete Product Management Form */}
        <form onSubmit={handleFormSubmit} className="lg:col-span-9 space-y-6">
          
          {/* Section 14: Data Integrity Issue Warning Banner */}
          {hierarchyIntegrityIssue && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start space-x-3 text-amber-900 shadow-xs">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <div className="font-bold text-sm text-amber-950">Data Integrity Warning</div>
                <p className="text-amber-800 leading-relaxed">
                  This Product contains an outdated or invalid Region / Destination / Hub relationship: <strong>{hierarchyIntegrityIssue}</strong>.
                </p>
                <p className="text-amber-700">
                  Please select the correct current hierarchy relationships below before saving. Opening this form has not altered any saved database records.
                </p>
              </div>
            </div>
          )}

          {/* Card 1: Basic Information */}
          <SectionCard 
            title="1. Basic Information" 
            description="Standard geographical, identity, and destination hierarchy details."
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Product Name" required>
                <input
                  type="text"
                  required
                  value={formData.name || ''}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Kyoto Private Zen Temple Experience"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:bg-white focus:border-[#00C6A6] focus:outline-none"
                />
              </FormField>

              <FormField label="Product ID (SKU)" required>
                <input
                  type="text"
                  required
                  readOnly={!!product}
                  value={formData.sku || ''}
                  onChange={e => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                  className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono read-only:opacity-80"
                />
              </FormField>

              {/* Cascading Region (Tier 1) */}
              <FormField label="Master Region (Tier 1)" required>
                <select
                  required
                  value={formData.regionId || ''}
                  onChange={e => {
                    const regId = e.target.value;
                    const reg = masterRegions.find(r => r.id === regId);
                    setFormData({ 
                      ...formData, 
                      regionId: reg?.id || '', 
                      regionName: reg?.name || '',
                      destinationId: '',
                      destinationName: '',
                      hubId: '',
                      city: '',
                      country: ''
                    });
                  }}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs focus:border-[#00C6A6] focus:outline-none"
                >
                  <option value="">-- Select Master Region --</option>
                  {masterRegions.map(r => (
                    <option key={r.id} value={r.id}>{r.name} ({r.id})</option>
                  ))}
                </select>
              </FormField>

              {/* Cascading Destination (Tier 2) strictly filtered by selected Region */}
              <FormField label="Destination (Tier 2)" required>
                <select
                  required
                  disabled={!formData.regionId}
                  value={formData.destinationId || ''}
                  onChange={e => {
                    const destId = e.target.value;
                    const dest = destinations.find(d => d.id === destId);
                    setFormData({ 
                      ...formData, 
                      destinationId: dest?.id || '', 
                      destinationName: dest?.name || '',
                      country: dest?.country || dest?.name || '',
                      hubId: '',
                      city: ''
                    });
                  }}
                  className={`w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs focus:border-[#00C6A6] focus:outline-none ${!formData.regionId ? 'bg-slate-100 cursor-not-allowed opacity-60' : ''}`}
                >
                  <option value="">{formData.regionId ? '-- Select Destination --' : '-- Select Region First --'}</option>
                  {destinations
                    .filter(d => d.regionId === formData.regionId)
                    .map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.id})</option>
                    ))}
                </select>
              </FormField>

              {/* Cascading City Hub (Tier 3) strictly filtered by selected Destination */}
              {activeCategory === 'Rail' ? (
                <FormField label="Associated City Hubs (Multi-Hub Selection)" required>
                  <div className={`p-3 bg-white border border-slate-200 rounded-lg space-y-2 max-h-40 overflow-y-auto ${!formData.destinationId ? 'bg-slate-100 cursor-not-allowed opacity-60' : ''}`}>
                    {!formData.destinationId ? (
                      <div className="text-slate-400 text-xs">-- Select Destination First --</div>
                    ) : (
                      cityHubs
                        .filter(h => h.destinationId === formData.destinationId)
                        .map(h => {
                          const isChecked = (formData.hubIds || []).includes(h.id);
                          return (
                            <label key={h.id} className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={e => {
                                  const checked = e.target.checked;
                                  const currentIds = formData.hubIds || [];
                                  let nextIds: string[];
                                  if (checked) {
                                    nextIds = [...currentIds, h.id];
                                  } else {
                                    nextIds = currentIds.filter(id => id !== h.id);
                                  }
                                  setFormData({
                                    ...formData,
                                    hubIds: nextIds,
                                    hubId: nextIds[0] || '',
                                    city: cityHubs.find(ch => ch.id === nextIds[0])?.name || ''
                                  });
                                }}
                                className="rounded text-[#00C6A6] focus:ring-[#00C6A6]"
                              />
                              <span>{h.name} ({h.id})</span>
                            </label>
                          );
                        })
                    )}
                  </div>
                </FormField>
              ) : (
                <FormField label="City Hub (Tier 3)" required>
                  <select
                    required
                    disabled={!formData.destinationId}
                    value={formData.hubId || ''}
                    onChange={e => {
                      const hubId = e.target.value;
                      const hub = cityHubs.find(h => h.id === hubId);
                      setFormData({ 
                        ...formData, 
                        hubId: hub?.id || '', 
                        city: hub?.name || '',
                        hubIds: hub?.id ? [hub.id] : []
                      });
                    }}
                    className={`w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs focus:border-[#00C6A6] focus:outline-none ${!formData.destinationId ? 'bg-slate-100 cursor-not-allowed opacity-60' : ''}`}
                  >
                    <option value="">{formData.destinationId ? '-- Select City Hub --' : '-- Select Destination First --'}</option>
                    {cityHubs
                      .filter(h => h.destinationId === formData.destinationId)
                      .map(h => (
                        <option key={h.id} value={h.id}>{h.name} ({h.id})</option>
                      ))}
                  </select>
                </FormField>
              )}

              <FormField label="Duration (Hours / Days)">
                <input
                  type="text"
                  value={formData.duration || ''}
                  onChange={e => setFormData({ ...formData, duration: e.target.value })}
                  placeholder="e.g. 8 Hours or Half Day (4 Hours)"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                />
              </FormField>
            </div>
          </SectionCard>

          {/* Card 2: CATEGORY-SPECIFIC OPERATIONAL FIELDS (Sections 27 & 28) */}
          


          {/* GROUP TOUR */}
          {activeCategory === 'Group Tours' && (
            <SectionCard title="2. Group Tour Logistics & Meeting Points" description="Configure departure spots, pickup points, and coach capacity.">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Designated Pickup Point" required>
                  <input
                    type="text"
                    value={formData.pickupPoint || ''}
                    onChange={e => setFormData({ ...formData, pickupPoint: e.target.value })}
                    placeholder="e.g. Shinjuku Station West Exit Concourse"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                </FormField>

                <FormField label="Designated Drop-off Point" required>
                  <input
                    type="text"
                    value={formData.dropoffPoint || ''}
                    onChange={e => setFormData({ ...formData, dropoffPoint: e.target.value })}
                    placeholder="e.g. Tokyo Station Marunouchi Plaza"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                </FormField>

                <FormField label="Max Coach / Group Capacity" required>
                  <input
                    type="number"
                    value={formData.maxPax || 25}
                    onChange={e => setFormData({ ...formData, maxPax: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                </FormField>

                <FormField label="Operating Days">
                  <input
                    type="text"
                    value={(formData.operatingDays || []).join(', ')}
                    onChange={e => setFormData({ ...formData, operatingDays: e.target.value.split(',').map(s => s.trim()) })}
                    placeholder="Mon, Wed, Fri, Sun"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                </FormField>
              </div>
            </SectionCard>
          )}

          {/* TICKET */}
          {activeCategory === 'Tickets' && (
            <SectionCard title="2. Ticket Type & Admission Settings" description="Define entry tiers, admission passes, and QR redemption format.">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Ticket Type / Category" required>
                  <select
                    value={formData.ticketConfig?.ticketType || 'TIMED_ENTRY'}
                    onChange={e => setFormData({
                      ...formData,
                      ticketConfig: { ...(formData.ticketConfig || {}), ticketType: e.target.value as any }
                    })}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold"
                  >
                    <option value="STANDARD">Standard General Admission</option>
                    <option value="VIP_FAST_TRACK">VIP Fast Track / Skip-the-Line</option>
                    <option value="TIMED_ENTRY">Timed Entry Slot Pass</option>
                    <option value="MULTI_DAY_PASS">Multi-Day Explorer Pass</option>
                    <option value="FLEXIBLE">Open Dated Flexible Pass</option>
                  </select>
                </FormField>

                <FormField label="Redemption Method">
                  <select
                    value={formData.ticketConfig?.redemptionMethod || 'INSTANT_QR_VOUCHER'}
                    onChange={e => setFormData({
                      ...formData,
                      ticketConfig: { ...(formData.ticketConfig || {}), redemptionMethod: e.target.value as any }
                    })}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs"
                  >
                    <option value="INSTANT_QR_VOUCHER">Instant QR Code Digital Scan</option>
                    <option value="MOBILE_VOUCHER">Mobile Smartphone Voucher</option>
                    <option value="PRINTED_VOUCHER">Printed Paper Voucher</option>
                    <option value="WILL_CALL_COUNTER">Will Call Box Office Counter</option>
                  </select>
                </FormField>

                <FormField label="Available Time Slots (Comma Separated)">
                  <input
                    type="text"
                    value={(formData.ticketConfig?.entryTimeSlots || ['09:00 - 11:00', '11:00 - 13:00', '13:00 - 15:00', '15:00 - 17:00']).join(', ')}
                    onChange={e => setFormData({
                      ...formData,
                      ticketConfig: {
                        ...(formData.ticketConfig || {}),
                        entryTimeSlots: e.target.value.split(',').map(s => s.trim())
                      }
                    })}
                    placeholder="09:00 - 11:00, 11:00 - 13:00..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                </FormField>

                <FormField label="Pass Validity (Days)">
                  <input
                    type="number"
                    value={formData.ticketConfig?.validityDays || 1}
                    onChange={e => setFormData({
                      ...formData,
                      ticketConfig: { ...(formData.ticketConfig || {}), validityDays: Number(e.target.value) }
                    })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                </FormField>
              </div>
            </SectionCard>
          )}

          {/* TRANSFER */}
          {activeCategory === 'Transfers' && (
            <SectionCard title="2. Transfer Route & Logistics (from_hub_id ➔ to_hub_id)" description="Enforces structured hub-to-hub connections for automatic itinerary routing with database-driven fleet assets.">
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Origin City Hub (from_hub_id)" required>
                    <select
                      value={formData.fromHubId || ''}
                      onChange={e => {
                        const hub = cityHubs.find(h => h.id === e.target.value);
                        setFormData({ ...formData, fromHubId: hub?.id, fromHubName: hub?.name });
                      }}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-900"
                    >
                      <option value="">-- Select Origin Hub --</option>
                      {cityHubs.map(h => (
                        <option key={h.id} value={h.id}>{h.name}</option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="Destination City Hub (to_hub_id)" required>
                    <select
                      value={formData.toHubId || ''}
                      onChange={e => {
                        const hub = cityHubs.find(h => h.id === e.target.value);
                        setFormData({ ...formData, toHubId: hub?.id, toHubName: hub?.name });
                      }}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-900"
                    >
                      <option value="">-- Select Destination Hub --</option>
                      {cityHubs.map(h => (
                        <option key={h.id} value={h.id}>{h.name}</option>
                      ))}
                    </select>
                  </FormField>
                </div>
              </div>
            </SectionCard>
          )}

          {/* GUIDE */}
          {activeCategory === 'Guides' && (
            <SectionCard title="2. Guide Languages & Qualifications" description="Define licensed language proficiencies and hourly pricing parameters.">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Languages Offered (Comma Separated)" required>
                  <input
                    type="text"
                    value={(formData.guideConfig?.languages || ['English', 'Japanese']).join(', ')}
                    onChange={e => setFormData({
                      ...formData,
                      guideConfig: {
                        ...(formData.guideConfig || {}),
                        languages: e.target.value.split(',').map(s => s.trim())
                      }
                    })}
                    placeholder="English, Japanese, French, Spanish..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold"
                  />
                </FormField>

                <FormField label="Minimum Required Hours" required>
                  <input
                    type="number"
                    min="1"
                    value={formData.minHours !== undefined && !Number.isNaN(formData.minHours) ? formData.minHours : (formData.guideConfig?.minHours !== undefined && !Number.isNaN(formData.guideConfig.minHours) ? formData.guideConfig.minHours : '')}
                    onChange={e => {
                      const val = e.target.value === '' || isNaN(Number(e.target.value)) ? undefined : Number(e.target.value);
                      setFormData({
                        ...formData,
                        minHours: val,
                        guideConfig: { ...(formData.guideConfig || {}), minHours: val }
                      });
                    }}
                    placeholder="Enter min hours"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                </FormField>

                <FormField label="Hourly Net Cost Rate" required>
                  <input
                    type="number"
                    min="0"
                    value={formData.hourlyNettCost !== undefined && !Number.isNaN(formData.hourlyNettCost) ? formData.hourlyNettCost : (formData.adultNetPrice !== undefined && !Number.isNaN(formData.adultNetPrice) ? formData.adultNetPrice : '')}
                    onChange={e => {
                      const val = e.target.value === '' || isNaN(Number(e.target.value)) ? undefined : Number(e.target.value);
                      setFormData({
                        ...formData,
                        hourlyNettCost: val,
                        adultNetPrice: val
                      });
                    }}
                    placeholder="Enter hourly net cost"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-semibold"
                  />
                </FormField>

                <FormField label="Hourly Selling Rate (Optional direct override)">
                  <input
                    type="number"
                    min="0"
                    value={formData.hourlyPrice !== undefined && !Number.isNaN(formData.hourlyPrice) ? formData.hourlyPrice : ''}
                    onChange={e => setFormData({
                      ...formData,
                      hourlyPrice: e.target.value === '' || isNaN(Number(e.target.value)) ? undefined : Number(e.target.value)
                    })}
                    placeholder="Auto-calculated from markup or enter rate"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-emerald-700"
                  />
                </FormField>
              </div>
            </SectionCard>
          )}

          {/* RESTAURANT */}
          {activeCategory === 'Lunch / Dinner Restaurant' && (
            <SectionCard title="2. Restaurant Information & Meal Select" description="Configure dining regimes (Breakfast, Lunch, Dinner) and course menus.">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Restaurant Name" required>
                  <input
                    type="text"
                    value={formData.restaurantName || formData.name || ''}
                    onChange={e => setFormData({ ...formData, restaurantName: e.target.value, name: e.target.value })}
                    placeholder="e.g. Gion Kaiseki Matsuro"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold"
                  />
                </FormField>

                <FormField label="Specialty Cuisine" required>
                  <input
                    type="text"
                    value={formData.specialty || ''}
                    onChange={e => setFormData({ ...formData, specialty: e.target.value })}
                    placeholder="e.g. Traditional Kyoto Kaiseki, Omakase Sushi"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                </FormField>

                <FormField label="Meal Regimes Supported (Multi-Select)" required>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {(['Breakfast', 'Lunch', 'Dinner'] as const).map(meal => {
                      const isChecked = (formData.mealSelect || []).includes(meal);
                      return (
                        <button
                          key={meal}
                          type="button"
                          onClick={() => {
                            const current = formData.mealSelect || [];
                            const next = isChecked ? current.filter(m => m !== meal) : [...current, meal];
                            setFormData({ ...formData, mealSelect: next });
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                            isChecked
                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {isChecked ? '✓ ' : '+ '}{meal}
                        </button>
                      );
                    })}
                  </div>
                </FormField>

                <FormField label="Primary Course Base Net Price">
                  <input
                    type="number"
                    min="0"
                    value={formData.adultNetPrice !== undefined ? formData.adultNetPrice : ''}
                    onChange={e => setFormData({ ...formData, adultNetPrice: e.target.value === '' ? undefined : Number(e.target.value) })}
                    placeholder="Enter Course Base Net Price"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </FormField>
              </div>
            </SectionCard>
          )}

          {/* FERRY */}
          {(activeCategory === 'Ferry' || activeCategory === 'Ferries') && (
            <SectionCard title="2. Ferry / Vessel Master & Route Specifications" description="Configure departure/arrival ports, vessel specifications, and baggage policies.">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Departure Port / Pier" required>
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
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold"
                  />
                </FormField>

                <FormField label="Arrival Port / Pier" required>
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
                    placeholder="e.g. Miyajima Ferry Terminal"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold"
                  />
                </FormField>
              </div>
            </SectionCard>
          )}



          {/* Card 3: Pricing Configuration Component (Section 20) */}
          <PricingConfigurationComponent
            category={activeCategory}
            currency={formData.currency || formData.nativeCurrency || 'USD'}
            onCurrencyChange={(curr) => setFormData(prev => ({ ...prev, currency: curr, nativeCurrency: curr }))}
            status={formData.status}
            buyerMarginPercent={formData.buyerMarkupPercent}
            onBuyerMarginChange={(margin) => setFormData(prev => ({ ...prev, buyerMarkupPercent: margin, defaultMarkupPercent: margin }))}
            b2bAgentMarginPercent={formData.b2bAgentMarkupPercent}
            onB2bAgentMarginChange={(margin) => setFormData(prev => ({ ...prev, b2bAgentMarkupPercent: margin }))}
            taxPercent={formData.taxPercent}
            onTaxPercentChange={(tax) => setFormData(prev => ({ ...prev, taxPercent: tax }))}
            serviceFeeFixed={formData.serviceFeeFixed}
            onServiceFeeFixedChange={(fee) => setFormData(prev => ({ ...prev, serviceFeeFixed: fee }))}
            tieredPricing={formData.tieredPricing || []}
            onTieredPricingChange={(tiers) => setFormData(prev => ({ ...prev, tieredPricing: tiers }))}
            adultNetPrice={formData.adultNetPrice}
            onAdultNetPriceChange={(price) => setFormData(prev => ({ ...prev, adultNetPrice: price }))}
            childNetPrice={formData.childNetPrice}
            onChildNetPriceChange={(price) => setFormData(prev => ({ ...prev, childNetPrice: price }))}
            infantNetPrice={formData.infantNetPrice}
            onInfantNetPriceChange={(price) => setFormData(prev => ({ ...prev, infantNetPrice: price }))}
            hourlyNetPrice={formData.hourlyNettCost !== undefined ? formData.hourlyNettCost : formData.adultNetPrice}
            onHourlyNetPriceChange={(price) => setFormData(prev => ({ ...prev, adultNetPrice: price, hourlyNettCost: price }))}
            minHours={formData.minHours}
            onMinHoursChange={(hours) => setFormData(prev => ({ ...prev, minHours: hours }))}
            isAdminView={true}
            vehicleConfig={formData.vehicleConfig}
            onVehicleConfigChange={(config) => setFormData(prev => ({ ...prev, vehicleConfig: config }))}
            destinations={destinations}
            cityHubs={cityHubs}
            destinationId={formData.destinationId}
            hubId={formData.hubId}
            vehicleId={formData.vehicleId}
            onVehicleIdChange={(vid) => setFormData(prev => ({ ...prev, vehicleId: vid }))}
            vehicleNameSnapshot={formData.vehicleNameSnapshot}
            onVehicleNameSnapshotChange={(name) => setFormData(prev => ({ ...prev, vehicleNameSnapshot: name }))}
            vehicleTypeSnapshot={formData.vehicleTypeSnapshot}
            onVehicleTypeSnapshotChange={(type) => setFormData(prev => ({ ...prev, vehicleTypeSnapshot: type }))}
            capacitySnapshot={formData.capacitySnapshot}
            onCapacitySnapshotChange={(cap) => setFormData(prev => ({ ...prev, capacitySnapshot: cap }))}
            ticketConfig={formData.ticketConfig}
            onTicketConfigChange={(tc) => setFormData(prev => ({ ...prev, ticketConfig: tc }))}
            guideConfig={formData.guideConfig}
            onGuideConfigChange={(gc) => setFormData(prev => ({ ...prev, guideConfig: gc }))}
            restaurantConfig={formData.restaurantConfig}
            onRestaurantConfigChange={(rc) => setFormData(prev => ({ ...prev, restaurantConfig: rc }))}
            mealPricing={(formData as any).mealPricing || formData.restaurantConfig?.mealPricing || []}
            onMealPricingChange={(mp) => setFormData(prev => ({ ...prev, mealPricing: mp, restaurantConfig: { ...(prev.restaurantConfig || {}), mealPricing: mp } }))}
            fromHubId={formData.fromHubId}
            toHubId={formData.toHubId}
            fromHubName={formData.fromHubName}
            toHubName={formData.toHubName}
          />

          {/* Inline Inclusions & Exclusions Section (Refined from Right-Side repeatables to fit the 75% Right form layout) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Inclusions Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs">
              <h4 className="text-sm font-black text-slate-900 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <Compass className="w-4 h-4 text-[#00C6A6]" />
                <span>Inclusions</span>
              </h4>
              <p className="text-[11px] text-slate-400">Specify what is explicitly covered or paid for in this master product.</p>
              <div className="space-y-2">
                {(formData.inclusions || []).length === 0 ? (
                  <div className="text-[11px] text-slate-400 italic">No inclusions specified yet.</div>
                ) : (
                  (formData.inclusions || []).map((inc, i) => (
                    <div key={i} className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-lg gap-2">
                      <span className="text-slate-600 leading-tight font-semibold">{inc}</span>
                      <button 
                        type="button" 
                        onClick={() => handleRemoveInclusion(i)}
                        className="text-slate-400 hover:text-red-500 cursor-pointer p-0.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
                <div className="flex gap-1.5 pt-2">
                  <input
                    type="text"
                    placeholder="e.g. English-speaking guide, temple entry"
                    value={newInclusion}
                    onChange={e => setNewInclusion(e.target.value)}
                    className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#00C6A6]"
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddInclusion();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddInclusion}
                    className="p-2 bg-[#00C6A6]/20 text-[#008972] rounded-lg hover:bg-[#00C6A6]/40 cursor-pointer transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Exclusions Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs">
              <h4 className="text-sm font-black text-slate-900 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>Exclusions</span>
              </h4>
              <p className="text-[11px] text-slate-400">Specify what is excluded to prevent any communication issues with travelers.</p>
              <div className="space-y-2">
                {(formData.exclusions || []).length === 0 ? (
                  <div className="text-[11px] text-slate-400 italic">No exclusions specified yet.</div>
                ) : (
                  (formData.exclusions || []).map((exc, i) => (
                    <div key={i} className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-lg gap-2">
                      <span className="text-slate-600 leading-tight font-semibold">{exc}</span>
                      <button 
                        type="button" 
                        onClick={() => handleRemoveExclusion(i)}
                        className="text-slate-400 hover:text-red-500 cursor-pointer p-0.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
                <div className="flex gap-1.5 pt-2">
                  <input
                    type="text"
                    placeholder="e.g. Lunch & drinks, gratuities"
                    value={newExclusion}
                    onChange={e => setNewExclusion(e.target.value)}
                    className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#00C6A6]"
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddExclusion();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddExclusion}
                    className="p-2 bg-amber-500/10 text-amber-600 rounded-lg hover:bg-amber-500/25 cursor-pointer transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

          </div>

          {/* Card 4: DEDICATED OPTIONAL EXPERIENCE UPGRADES / UPSELLS MANAGEMENT (Sections 1-35) */}
          <SectionCard 
            title="4. Optional Experience Upgrades / Upsells" 
            description="Official product-based upsell relationships referencing live catalog inventory + optional standalone add-ons."
          >
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="text-xs text-slate-500">
                  Total Configured: <strong>{(formData.upsells || []).length} Upsells</strong> ({activeUpsells.length} Active)
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleOpenAddExistingProductUpsell}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#00C6A6] text-slate-950 text-xs font-black hover:bg-[#008972] transition-colors cursor-pointer shadow-xs"
                    title="Select and link an existing live product from inventory (No duplication)"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>+ Add Existing Product as Upsell</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenAddStandaloneUpsell}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition-colors cursor-pointer border border-slate-200"
                    title="Create custom standalone non-product upgrade"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Standalone Custom</span>
                  </button>
                </div>
              </div>

              {/* Upsell Items List */}
              <div className="space-y-2.5">
                {(formData.upsells || []).length === 0 ? (
                  <div className="p-8 rounded-2xl border border-dashed border-slate-200 text-center space-y-2 bg-slate-50/50">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                      <Sparkles className="w-5 h-5 text-[#00C6A6]" />
                    </div>
                    <div className="text-xs font-bold text-slate-700">No experience upgrades linked yet</div>
                    <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                      Click <strong>"+ Add Existing Product as Upsell"</strong> to link live inventory (e.g. English Speaking Guide, Ropeway Ticket, Kaiseki Lunch) or add a standalone custom add-on.
                    </p>
                  </div>
                ) : (
                  (formData.upsells || []).map((upsell, idx) => {
                    const isActive = upsell.status === 'ACTIVE';
                    const isType1 = upsell.isExistingProduct || Boolean(upsell.upsellProductId);

                    // Find live product if type 1
                    const liveTarget = isType1 
                      ? allMasterProducts.find(p => p.id === upsell.upsellProductId || p.product_id === upsell.upsellProductId)
                      : null;

                    const thumbImg = liveTarget?.images?.[0] || upsell.imageUrl || 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=400';
                    const displayName = liveTarget?.name || upsell.name;
                    const displaySku = liveTarget?.sku || upsell.sku;
                    const displayCategory = liveTarget?.category || upsell.category;
                    const displayLocation = liveTarget?.destinationName || liveTarget?.city || upsell.destinationName;

                    return (
                      <div 
                        key={upsell.id || idx}
                        className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isActive 
                            ? 'bg-white border-slate-200 shadow-xs hover:border-slate-300' 
                            : 'bg-slate-50 border-slate-200 opacity-60'
                        }`}
                      >
                        <div className="flex items-start space-x-3 min-w-0">
                          {/* Reorder Buttons */}
                          <div className="flex flex-col space-y-0.5 shrink-0 pt-0.5">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleReorderUpsell(idx, 'up')}
                              className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                              title="Move Up (Display Order)"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === (formData.upsells?.length || 0) - 1}
                              onClick={() => handleReorderUpsell(idx, 'down')}
                              className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                              title="Move Down (Display Order)"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          </div>

                          {/* Product Thumbnail */}
                          <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                            <img
                              src={thumbImg}
                              alt={displayName}
                              className="w-full h-full object-cover"
                            />
                          </div>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {/* Relationship Type Badge */}
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                isType1 
                                  ? 'bg-[#00C6A6]/20 text-[#008972] border border-[#00C6A6]/40' 
                                  : 'bg-slate-100 text-slate-700 border border-slate-200'
                              }`}>
                                {isType1 ? 'Master Product Reference' : 'Standalone Custom'}
                              </span>

                              {displayCategory && (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                  {displayCategory}
                                </span>
                              )}

                              {displaySku && (
                                <span className="text-[10px] font-mono font-bold text-slate-400">
                                  {displaySku}
                                </span>
                              )}

                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                isActive 
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}>
                                {upsell.status}
                              </span>
                            </div>

                            <h4 className="text-xs font-black text-slate-900 truncate mt-1">
                              {displayName}
                            </h4>

                            <div className="flex items-center space-x-2 text-[11px] text-slate-500 mt-0.5">
                              {displayLocation && <span>{displayLocation}</span>}
                              {upsell.priceType && <span>• {upsell.priceType.replace('_', ' ')}</span>}
                              {upsell.customLabel && (
                                <span className="text-[#008972] font-semibold">
                                  • Tag: "{upsell.customLabel}"
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Price & Actions */}
                        <div className="flex items-center space-x-3 shrink-0 justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                          <div className="text-right">
                            <div className="text-xs font-black font-mono text-[#008972]">
                              +{upsell.currency} {upsell.price.toLocaleString()}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {isType1 ? 'Live Master Pricing' : `Net: ${upsell.currency} ${(upsell.netCost || Math.round(upsell.price * 0.75)).toLocaleString()}`}
                            </div>
                          </div>

                          <div className="flex items-center space-x-1">
                            <button
                              type="button"
                              onClick={() => handleToggleUpsellStatus(upsell.id)}
                              className={`p-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                                isActive 
                                  ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100' 
                                  : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                              }`}
                              title={isActive ? 'Deactivate Option (Will not be offered to Agents)' : 'Activate Option'}
                            >
                              {isActive ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenEditUpsell(upsell)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs cursor-pointer"
                              title="Edit Upsell Configuration"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteUpsell(upsell.id)}
                              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs cursor-pointer"
                              title="Remove Upsell Relationship (Does not delete underlying master product)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </SectionCard>

          {/* Card 5: Tour Description */}
          <SectionCard title="5. Product Description" description="Write a compelling, structured overview with headings, paragraphs, and lists for agents and travelers.">
            <RichTextEditor
              value={formData.longDescription || formData.shortDescription || ''}
              onChange={html => setFormData({ ...formData, longDescription: html, description: html })}
              placeholder="Detailed overview of the operational workflow, highlights, and itinerary..."
              minHeight="200px"
              helperText="Use Headings (H2, H3), bullet points, and emphasis to present a professional, structured overview."
            />
          </SectionCard>

          {/* Card 6: Summary */}
          <SectionCard title="6. Summary" description="Short teaser text used for catalog listings.">
            <FormField label="Short Summary">
              <input
                type="text"
                value={formData.shortDescription || ''}
                onChange={e => setFormData({ ...formData, shortDescription: e.target.value, summary: e.target.value })}
                placeholder="A refined luxury experience in Japan."
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              />
            </FormField>
          </SectionCard>

          {/* Card 7: Media & Gallery */}
          <SectionCard title="7. Media & Gallery Images" description="Add primary hero image and showcase photo gallery.">
            <div className="space-y-3">
              <FormField label="Primary Image URL">
                <input
                  type="text"
                  value={formData.images?.[0] || ''}
                  onChange={e => setFormData({ ...formData, images: [e.target.value] })}
                  placeholder="Paste high-res Unsplash image URL"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                />
              </FormField>
            </div>
          </SectionCard>

          {/* Bottom Sticky Action Area (Section 33) */}
          <div className="sticky bottom-0 bg-white/95 backdrop-blur-md p-4 border-t border-slate-100 rounded-t-2xl shadow-lg flex items-center justify-between gap-4 z-20">
            <button
              type="button"
              onClick={onCancel}
              className="text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors"
            >
              Cancel & Exit
            </button>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSaveDraft}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Save as Draft
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-[#00C6A6] hover:bg-[#008972] text-slate-950 text-xs font-black transition-colors cursor-pointer flex items-center space-x-2 shadow-xs"
              >
                <Save className="w-4 h-4" />
                <span>Save Product</span>
              </button>
            </div>
          </div>

        </form>

      </div>

      {/* MODAL: ADD / EDIT UPSELL MODAL (Section 19) */}
      {isUpsellModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-[#00C6A6]" />
                <h3 className="text-base font-black text-slate-900">
                  {editingUpsellId ? 'Edit Optional Experience Upgrade' : 'Add Optional Experience Upgrade'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsUpsellModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUpsell} className="space-y-4">
              <FormField label="Upgrade / Upsell Name" required>
                <input
                  type="text"
                  required
                  value={upsellForm.name || ''}
                  onChange={e => setUpsellForm({ ...upsellForm, name: e.target.value })}
                  placeholder="e.g. Lake Kawaguchi Ropeway Pass"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:bg-white focus:border-[#00C6A6] focus:outline-none"
                />
              </FormField>

              <FormField label="Short Description">
                <textarea
                  value={upsellForm.shortDescription || ''}
                  onChange={e => setUpsellForm({ ...upsellForm, shortDescription: e.target.value })}
                  rows={2}
                  placeholder="Brief overview of the experience upgrade..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                />
              </FormField>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Selling Price" required>
                  <input
                    type="number"
                    required
                    min={0}
                    value={upsellForm.price || 0}
                    onChange={e => setUpsellForm({ ...upsellForm, price: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-emerald-700"
                  />
                </FormField>

                <FormField label="Net Supplier Cost">
                  <input
                    type="number"
                    min={0}
                    value={upsellForm.netCost || 0}
                    onChange={e => setUpsellForm({ ...upsellForm, netCost: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Price Type">
                  <select
                    value={upsellForm.priceType || 'PER_PERSON'}
                    onChange={e => setUpsellForm({ ...upsellForm, priceType: e.target.value as any })}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs"
                  >
                    <option value="PER_PERSON">Per Person</option>
                    <option value="PER_BOOKING">Per Booking / Vehicle</option>
                    <option value="PER_DAY">Per Day</option>
                  </select>
                </FormField>

                <FormField label="Status">
                  <select
                    value={upsellForm.status || 'ACTIVE'}
                    onChange={e => setUpsellForm({ ...upsellForm, status: e.target.value as any })}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                  >
                    <option value="ACTIVE">Active (Selectable)</option>
                    <option value="INACTIVE">Inactive (Hidden)</option>
                  </select>
                </FormField>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsUpsellModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#00C6A6] text-slate-950 text-xs font-black hover:bg-[#008972] cursor-pointer shadow-xs"
                >
                  {editingUpsellId ? 'Save Changes' : 'Add Upsell'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD EXISTING PRODUCT AS UPSELL MODAL (Sections 3-10) */}
      <ExistingProductUpsellSelectorModal
        isOpen={isProductSelectorOpen}
        onClose={() => setIsProductSelectorOpen(false)}
        currentProduct={formData}
        existingUpsells={formData.upsells || []}
        allProducts={allMasterProducts}
        destinations={destinations}
        masterRegions={masterRegions}
        cityHubs={cityHubs}
        onSelectProduct={handleSelectExistingProduct}
      />

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
