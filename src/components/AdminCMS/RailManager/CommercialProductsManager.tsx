import React, { useState, useEffect, useMemo } from 'react';
import { 
  JapanRailCommercialProduct, 
  RailCarType, 
  RailSeatType 
} from '../../../types/rail';
import { AppDatabase } from '../../../services/db';
import { useAuth } from '../../../context/AuthContext';
import { formatCurrency } from '../../../services/currencyEngine';
import { INITIAL_JAPAN_RAIL_COMMERCIAL_PRODUCTS } from '../../../data/initialRailCommercialProducts';
import { 
  Train, 
  Sparkles, 
  ShieldCheck, 
  Edit3, 
  Check, 
  X, 
  AlertTriangle, 
  Info, 
  DollarSign, 
  Layers, 
  CheckCircle2, 
  Plus, 
  Trash2, 
  ArrowRight,
  Eye,
  RefreshCw,
  Archive,
  Power
} from 'lucide-react';

interface CommercialProductsManagerProps {
  onSelectProductForConfig?: (productCode: string) => void;
}

export const CommercialProductsManager: React.FC<CommercialProductsManagerProps> = ({
  onSelectProductForConfig
}) => {
  const { user } = useAuth();
  const db = useMemo(() => AppDatabase.getInstance(), []);

  // Live products from DB
  const [products, setProducts] = useState<JapanRailCommercialProduct[]>(() => 
    db.getJapanRailCommercialProducts()
  );
  const [selectedProductCode, setSelectedProductCode] = useState<'ORDINARY_RESERVED' | 'GREEN_RESERVED'>('ORDINARY_RESERVED');
  const [activeMode, setActiveMode] = useState<'LIST' | 'EDIT'>('EDIT');
  const [formData, setFormData] = useState<JapanRailCommercialProduct>(() => {
    const list = db.getJapanRailCommercialProducts();
    return list.find(p => p.productCode === 'ORDINARY_RESERVED') || INITIAL_JAPAN_RAIL_COMMERCIAL_PRODUCTS[0];
  });

  const [toastMessage, setToastMessage] = useState<{ type: 'SUCCESS' | 'ERROR' | 'INFO'; text: string } | null>(null);
  const [newInclusion, setNewInclusion] = useState('');
  const [newExclusion, setNewExclusion] = useState('');
  const [newInfo, setNewInfo] = useState('');

  // Subscribe to DB updates
  useEffect(() => {
    const unsub = db.subscribe(() => {
      const live = db.getJapanRailCommercialProducts();
      setProducts(live);
    });
    return () => unsub();
  }, [db]);

  // Sync formData when selected product changes
  useEffect(() => {
    const target = products.find(p => p.productCode === selectedProductCode) || 
                   INITIAL_JAPAN_RAIL_COMMERCIAL_PRODUCTS.find(p => p.productCode === selectedProductCode);
    if (target) {
      setFormData(JSON.parse(JSON.stringify(target)));
    }
  }, [selectedProductCode, products]);

  const showToast = (type: 'SUCCESS' | 'ERROR' | 'INFO', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4500);
  };

  const selectedProduct = useMemo(() => {
    return products.find(p => p.productCode === selectedProductCode) || 
           INITIAL_JAPAN_RAIL_COMMERCIAL_PRODUCTS.find(p => p.productCode === selectedProductCode) || 
           formData;
  }, [products, selectedProductCode, formData]);

  // Historical reference count for security
  const referenceCounts = useMemo(() => {
    const quotes = db.getAllSavedQuotes();
    const bookings = db.getBookings();

    const getCounts = (code: string, id: string) => {
      const quoteRefs = quotes.filter(q => 
        q.items?.some(i => i.productId === id || i.productId === code || (i as any).commercialProductId === code || (i as any).commercialProductId === id)
      ).length;
      const bookingRefs = bookings.filter(b => 
        b.items?.some(i => i.productId === id || i.productId === code || (i as any).commercialProductId === code || (i as any).commercialProductId === id)
      ).length;
      return { quotes: quoteRefs, bookings: bookingRefs, total: quoteRefs + bookingRefs };
    };

    return {
      ORDINARY_RESERVED: getCounts('ORDINARY_RESERVED', 'RAIL-JP-ORD-RESERVED'),
      GREEN_RESERVED: getCounts('GREEN_RESERVED', 'RAIL-JP-GREEN-RESERVED')
    };
  }, [db, products]);

  // Handle Save
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!formData.productName.trim()) {
        showToast('ERROR', 'Product Name is required.');
        return;
      }

      if (formData.productCode !== 'ORDINARY_RESERVED' && formData.productCode !== 'GREEN_RESERVED') {
        showToast('ERROR', 'Only ORDINARY_RESERVED and GREEN_RESERVED commercial master products are supported.');
        return;
      }

      const saved = db.saveJapanRailCommercialProduct(formData, user);
      showToast('SUCCESS', `Successfully saved Commercial Master Product: ${saved.productName} (${saved.productCode})`);
      setProducts(db.getJapanRailCommercialProducts());
    } catch (err: any) {
      showToast('ERROR', err?.message || 'Failed to save Commercial Master Product.');
    }
  };

  // Handle Toggle Active/Inactive
  const handleToggleStatus = (prod: JapanRailCommercialProduct) => {
    try {
      const nextStatus = prod.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      const updated = { ...prod, status: nextStatus as any };
      db.saveJapanRailCommercialProduct(updated, user);
      showToast('SUCCESS', `Product ${prod.productCode} status updated to ${nextStatus}.`);
    } catch (err: any) {
      showToast('ERROR', err?.message || 'Failed to update status.');
    }
  };

  // Handle Archive
  const handleArchive = (prod: JapanRailCommercialProduct) => {
    try {
      const res = db.deleteJapanRailCommercialProduct(prod.productCode, user);
      showToast('INFO', res.message);
    } catch (err: any) {
      showToast('ERROR', err?.message || 'Failed to archive product.');
    }
  };

  // Reset to Canonical
  const handleResetToCanonical = () => {
    if (!confirm('Reset all 2 Commercial Master Products to authoritative canonical definitions? This will preserve all historical transactional references.')) {
      return;
    }
    try {
      for (const p of INITIAL_JAPAN_RAIL_COMMERCIAL_PRODUCTS) {
        db.saveJapanRailCommercialProduct(p, user);
      }
      showToast('SUCCESS', 'Reset 2 Commercial Master Products to canonical specifications.');
    } catch (err: any) {
      showToast('ERROR', err?.message || 'Failed to reset commercial products.');
    }
  };

  // Inclusions / Exclusions / Info list handlers
  const handleAddInclusion = () => {
    if (!newInclusion.trim()) return;
    setFormData(prev => ({
      ...prev,
      inclusions: [...(prev.inclusions || []), newInclusion.trim()]
    }));
    setNewInclusion('');
  };

  const handleRemoveInclusion = (idx: number) => {
    setFormData(prev => ({
      ...prev,
      inclusions: (prev.inclusions || []).filter((_, i) => i !== idx)
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

  const handleRemoveExclusion = (idx: number) => {
    setFormData(prev => ({
      ...prev,
      exclusions: (prev.exclusions || []).filter((_, i) => i !== idx)
    }));
  };

  const handleAddInfo = () => {
    if (!newInfo.trim()) return;
    setFormData(prev => ({
      ...prev,
      importantInformation: [...(prev.importantInformation || []), newInfo.trim()]
    }));
    setNewInfo('');
  };

  const handleRemoveInfo = (idx: number) => {
    setFormData(prev => ({
      ...prev,
      importantInformation: (prev.importantInformation || []).filter((_, i) => i !== idx)
    }));
  };

  // Sample Dynamic Route Fare calculation for demonstration
  const samplePricing = useMemo(() => {
    const isGreen = formData.productCode === 'GREEN_RESERVED';
    const baseNett = isGreen ? 19040 : 13970;
    const marginPct = formData.pricingConfiguration?.marginValue ?? 12;
    const marginAmt = Math.round(baseNett * (marginPct / 100));
    const taxPct = formData.pricingConfiguration?.taxValue ?? 10;
    const taxAmt = Math.round(marginAmt * (taxPct / 100));
    const subtotal = baseNett + marginAmt + taxAmt;
    const serviceFeePct = formData.pricingConfiguration?.serviceChargeValue ?? 0;
    const serviceFeeAmt = Math.round(subtotal * (serviceFeePct / 100));
    const finalPrice = subtotal + serviceFeeAmt;

    return {
      baseNett,
      marginPct,
      marginAmt,
      taxPct,
      taxAmt,
      subtotal,
      serviceFeePct,
      serviceFeeAmt,
      finalPrice
    };
  }, [formData]);

  return (
    <div className="space-y-6 text-left">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between shadow-lg transition-all ${
          toastMessage.type === 'SUCCESS' ? 'bg-emerald-50 border-emerald-300 text-emerald-950' :
          toastMessage.type === 'ERROR' ? 'bg-rose-50 border-rose-300 text-rose-950' :
          'bg-cyan-50 border-cyan-300 text-cyan-950'
        }`}>
          <div className="flex items-center space-x-3 text-xs font-bold">
            {toastMessage.type === 'SUCCESS' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> :
             toastMessage.type === 'ERROR' ? <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" /> :
             <Info className="w-4 h-4 text-cyan-600 shrink-0" />}
            <span>{toastMessage.text}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-slate-700 text-xs font-bold p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-[#008972] text-[11px] font-bold uppercase tracking-wider">
            <Train className="w-3.5 h-3.5" />
            <span>Commercial Product Layer • Exactly 2 Products</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Japan Rail Commercial Master Products
          </h2>
          <p className="text-xs text-slate-500 max-w-2xl">
            Governs the 2 commercial product layers (Ordinary Car & Green Car) that wrap all dynamic Shinkansen journey configurations, routing tables, and B2B pricing formulas.
          </p>
        </div>

        <div className="flex items-center space-x-2.5 shrink-0">
          <button
            type="button"
            onClick={handleResetToCanonical}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors inline-flex items-center space-x-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset to Canonical</span>
          </button>
          
          <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveMode('EDIT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeMode === 'EDIT' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Configure Product
            </button>
            <button
              type="button"
              onClick={() => setActiveMode('LIST')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeMode === 'LIST' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Matrix Table ({products.length})
            </button>
          </div>
        </div>
      </div>

      {/* MATRIX TABLE VIEW */}
      {activeMode === 'LIST' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-900">Commercial Master Product Matrix</h3>
              <p className="text-xs text-slate-400">Strictly 2 canonical products governing the entire Shinkansen inventory.</p>
            </div>
            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
              {products.length} / 2 Registered
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="p-4">Product Name</th>
                  <th className="p-4">Product Code</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Car Class</th>
                  <th className="p-4">Reservation</th>
                  <th className="p-4">Currency</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">References</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {products.map(prod => {
                  const refs = referenceCounts[prod.productCode] || { quotes: 0, bookings: 0, total: 0 };
                  const isOrd = prod.productCode === 'ORDINARY_RESERVED';

                  return (
                    <tr key={prod.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center space-x-3">
                          <img 
                            src={prod.imageUrl || (isOrd ? 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=200&q=80' : 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=200&q=80')} 
                            alt={prod.productName}
                            className="w-12 h-10 object-cover rounded-lg border border-slate-200 shrink-0" 
                          />
                          <div>
                            <span className="font-bold text-slate-900 block">{prod.productName}</span>
                            <span className="text-[10px] text-slate-400 line-clamp-1">{prod.shortDescription}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200">
                          {prod.productCode}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                          {prod.category}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="font-semibold text-slate-700">
                          {prod.carType} ({prod.classType || (isOrd ? 'Standard' : 'First Class')})
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-slate-600">{prod.reservationType || 'Reserved Seat'}</span>
                      </td>
                      <td className="p-4 font-mono font-bold text-slate-700">
                        {prod.nativeCurrency || 'JPY'}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          prod.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                          prod.status === 'ARCHIVED' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                          'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          {prod.status}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-[11px] text-slate-500">
                          {refs.quotes} Quotes • {refs.bookings} Bookings
                        </span>
                      </td>
                      <td className="p-4 text-right space-x-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedProductCode(prod.productCode);
                            setActiveMode('EDIT');
                          }}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold text-[#008972] bg-teal-50 hover:bg-teal-100 border border-teal-200 transition-colors cursor-pointer"
                        >
                          Configure
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(prod)}
                          title={prod.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                          className="p-1 rounded-lg text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer"
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleArchive(prod)}
                          title="Archive / Decommission"
                          className="p-1 rounded-lg text-amber-600 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors cursor-pointer"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 25/75 ADMIN WORKSPACE LAYOUT */}
      {activeMode === 'EDIT' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* ========================================================= */}
          {/* LEFT 25% (lg:col-span-3 or col-span-4): Product Selector & Preview */}
          {/* ========================================================= */}
          <div className="lg:col-span-4 space-y-4">
            
            {/* Product Switcher Buttons */}
            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-1 block">
                Select Master Product
              </span>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedProductCode('ORDINARY_RESERVED')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                    selectedProductCode === 'ORDINARY_RESERVED'
                      ? 'bg-teal-50/70 border-[#00C6A6] text-slate-900 ring-2 ring-[#00C6A6]/20'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100/80'
                  }`}
                >
                  <div className="space-y-0.5">
                    <span className="text-xs font-black block">1. Ordinary Car</span>
                    <span className="text-[10px] text-slate-500 font-mono">ORDINARY_RESERVED</span>
                  </div>
                  <span className="text-[10px] font-bold bg-white px-2 py-0.5 rounded border border-slate-200">
                    Standard
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedProductCode('GREEN_RESERVED')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                    selectedProductCode === 'GREEN_RESERVED'
                      ? 'bg-teal-50/70 border-[#00C6A6] text-slate-900 ring-2 ring-[#00C6A6]/20'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100/80'
                  }`}
                >
                  <div className="space-y-0.5">
                    <span className="text-xs font-black block">2. Green Car</span>
                    <span className="text-[10px] text-slate-500 font-mono">GREEN_RESERVED</span>
                  </div>
                  <span className="text-[10px] font-bold bg-amber-50 text-amber-800 px-2 py-0.5 rounded border border-amber-200">
                    First Class
                  </span>
                </button>
              </div>
            </div>

            {/* Live Commercial Product Preview Card */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="relative h-44 bg-slate-900">
                <img 
                  src={formData.imageUrl || (formData.productCode === 'ORDINARY_RESERVED' ? 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=600&q=80' : 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=600&q=80')} 
                  alt={formData.productName}
                  className="w-full h-full object-cover opacity-90"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/30" />
                
                <div className="absolute top-3 left-3 flex items-center space-x-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-black/60 backdrop-blur-md text-white px-2 py-0.5 rounded-full border border-white/20">
                    {formData.category}
                  </span>
                  <span className="text-[10px] font-bold bg-[#00C6A6] text-slate-950 px-2 py-0.5 rounded-full shadow-xs">
                    {formData.productCode === 'GREEN_RESERVED' ? 'First Class' : 'Standard'}
                  </span>
                </div>

                <div className="absolute top-3 right-3">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs ${
                    formData.status === 'ACTIVE' ? 'bg-emerald-500 text-white' :
                    formData.status === 'ARCHIVED' ? 'bg-amber-500 text-white' :
                    'bg-slate-500 text-white'
                  }`}>
                    {formData.status}
                  </span>
                </div>

                <div className="absolute bottom-3 left-3 right-3 text-white">
                  <span className="text-[10px] font-mono text-teal-300 block">{formData.productCode}</span>
                  <h3 className="text-sm font-black leading-tight truncate">{formData.productName}</h3>
                </div>
              </div>

              <div className="p-4 space-y-3.5 text-xs">
                <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Car Type</span>
                    <span className="font-bold text-slate-800">{formData.carType} Car</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Reservation</span>
                    <span className="font-bold text-slate-800">{formData.reservationType}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Currency</span>
                    <span className="font-mono font-bold text-slate-800">{formData.nativeCurrency}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Pricing Mode</span>
                    <span className="font-bold text-teal-700">Dynamic Tariff</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Commercial Overview
                  </span>
                  <p className="text-slate-600 line-clamp-3 text-[11px] leading-relaxed">
                    {formData.shortDescription || formData.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Historical References:</span>
                  <span className="font-bold text-slate-800">
                    {(referenceCounts[formData.productCode]?.total || 0)} Quotes/Bookings
                  </span>
                </div>
              </div>
            </div>

            {/* Architecture Explainer Notice */}
            <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-4 text-indigo-950 text-xs space-y-1.5 shadow-xs">
              <div className="flex items-center space-x-1.5 font-bold text-indigo-900 text-[11px]">
                <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Zero Route Product Explosion</span>
              </div>
              <p className="text-[11px] text-indigo-900/80 leading-relaxed">
                TheUnbound maintains strictly <strong>2 Commercial Master Products</strong>. All 27+ routes, 16+ stations, train services (Nozomi, Mizuho, Hikari), seasonal calendar rules, and fare classes are resolved at runtime as dynamic inventory.
              </p>
            </div>
          </div>

          {/* ========================================================= */}
          {/* RIGHT 75% (lg:col-span-8): Form Sections 1 to 4 */}
          {/* ========================================================= */}
          <div className="lg:col-span-8">
            <form onSubmit={handleSave} className="space-y-6">

              {/* SECTION 1: BASIC INFORMATION */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-black text-slate-900 flex items-center space-x-2">
                    <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs">1</span>
                    <span>Basic Information</span>
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400 uppercase">Schema v{formData.schemaVersion || 1}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Commercial Product Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.productName}
                      onChange={e => setFormData({ ...formData, productName: e.target.value })}
                      required
                      placeholder="e.g. Ordinary Car — Reserved Seat"
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#00C6A6] font-semibold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Commercial Product Code <span className="text-slate-400 font-normal">(Canonical)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.productCode}
                      disabled
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100 font-mono font-bold text-slate-600 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Category
                    </label>
                    <input
                      type="text"
                      value={formData.category}
                      disabled
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100 font-bold text-slate-600 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#00C6A6] font-semibold text-slate-900 bg-white"
                    >
                      <option value="ACTIVE">ACTIVE (Available for Quotes & Journeys)</option>
                      <option value="INACTIVE">INACTIVE (Hidden from new configs)</option>
                      <option value="ARCHIVED">ARCHIVED (Historical records only)</option>
                      <option value="DRAFT">DRAFT</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Short Description <span className="text-slate-400 font-normal">(Used in cards & quotation summaries)</span>
                  </label>
                  <textarea
                    rows={2}
                    value={formData.shortDescription || ''}
                    onChange={e => setFormData({ ...formData, shortDescription: e.target.value })}
                    placeholder="Brief 1-2 sentence commercial summary..."
                    className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#00C6A6] text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Full Commercial Description
                  </label>
                  <textarea
                    rows={4}
                    value={formData.description || ''}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Comprehensive product copy for proposals and agent details..."
                    className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#00C6A6] text-slate-800"
                  />
                </div>
              </div>

              {/* SECTION 2: RAIL CONFIGURATION */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-black text-slate-900 flex items-center space-x-2">
                    <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs">2</span>
                    <span>Rail Configuration & Class Mapping</span>
                  </h3>
                  <span className="text-[10px] font-bold text-[#008972] bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
                    smartEX Inventory Linked
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Car Type
                    </label>
                    <select
                      value={formData.carType}
                      onChange={e => setFormData({ ...formData, carType: e.target.value as RailCarType })}
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#00C6A6] font-semibold text-slate-900 bg-white"
                    >
                      <option value="Ordinary">Ordinary Car</option>
                      <option value="Green">Green Car</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Class Type
                    </label>
                    <input
                      type="text"
                      value={formData.classType}
                      onChange={e => setFormData({ ...formData, classType: e.target.value })}
                      placeholder="e.g. Standard or First Class"
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#00C6A6] font-semibold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Reservation Type
                    </label>
                    <input
                      type="text"
                      value={formData.reservationType}
                      onChange={e => setFormData({ ...formData, reservationType: e.target.value })}
                      placeholder="e.g. Reserved Seat"
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#00C6A6] font-semibold text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Supported Shinkansen Services
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {['NOZOMI', 'MIZUHO', 'HIKARI', 'KODAMA', 'SAKURA', 'TSUBAME'].map(srv => {
                      const isIncluded = (formData.supportedServices || []).includes(srv);
                      return (
                        <button
                          key={srv}
                          type="button"
                          onClick={() => {
                            const cur = formData.supportedServices || [];
                            const next = isIncluded ? cur.filter(s => s !== srv) : [...cur, srv];
                            setFormData({ ...formData, supportedServices: next });
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            isIncluded 
                              ? 'bg-slate-900 text-white shadow-xs' 
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          {srv}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* SECTION 3: COMMERCIAL CONTENT */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-black text-slate-900 flex items-center space-x-2">
                    <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs">3</span>
                    <span>Commercial Proposal Content & Media</span>
                  </h3>
                  <span className="text-[10px] text-slate-400">PDF & Quote Sanitized</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Hero Image URL
                  </label>
                  <input
                    type="url"
                    value={formData.imageUrl || ''}
                    onChange={e => setFormData({ ...formData, imageUrl: e.target.value })}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#00C6A6] font-mono text-slate-800"
                  />
                </div>

                {/* Inclusions List */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Product Inclusions
                  </label>
                  <div className="space-y-1.5">
                    {(formData.inclusions || []).map((inc, i) => (
                      <div key={i} className="flex items-center space-x-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 text-xs">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="flex-1 text-slate-800">{inc}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveInclusion(i)}
                          className="text-slate-400 hover:text-rose-600 p-0.5"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center space-x-2 pt-1">
                    <input
                      type="text"
                      value={newInclusion}
                      onChange={e => setNewInclusion(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddInclusion(); } }}
                      placeholder="Add an inclusion bullet..."
                      className="flex-1 text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-1 focus:ring-[#00C6A6]"
                    />
                    <button
                      type="button"
                      onClick={handleAddInclusion}
                      className="px-3 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Exclusions List */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Product Exclusions
                  </label>
                  <div className="space-y-1.5">
                    {(formData.exclusions || []).map((exc, i) => (
                      <div key={i} className="flex items-center space-x-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 text-xs">
                        <X className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <span className="flex-1 text-slate-800">{exc}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveExclusion(i)}
                          className="text-slate-400 hover:text-rose-600 p-0.5"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center space-x-2 pt-1">
                    <input
                      type="text"
                      value={newExclusion}
                      onChange={e => setNewExclusion(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddExclusion(); } }}
                      placeholder="Add an exclusion bullet..."
                      className="flex-1 text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-1 focus:ring-[#00C6A6]"
                    />
                    <button
                      type="button"
                      onClick={handleAddExclusion}
                      className="px-3 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* SECTION 4: PRICING CONFIGURATION & B2B CALCULATOR */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-black text-slate-900 flex items-center space-x-2">
                    <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs">4</span>
                    <span>Commercial Pricing Configuration & Margins</span>
                  </h3>
                  <span className="text-[10px] font-mono font-bold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
                    Central Pricing Engine
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Native Currency <span className="text-slate-400 font-normal">(Authoritative)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.nativeCurrency}
                      disabled
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100 font-mono font-bold text-slate-700 cursor-not-allowed"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">Native Japan Rail currency is strictly JPY.</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      B2B Agent Margin %
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={formData.pricingConfiguration?.marginValue ?? 12}
                      onChange={e => setFormData({
                        ...formData,
                        pricingConfiguration: {
                          ...formData.pricingConfiguration,
                          marginType: 'PERCENTAGE',
                          marginValue: Number(e.target.value) || 0
                        }
                      })}
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#00C6A6] font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Tax on Margin %
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={formData.pricingConfiguration?.taxValue ?? 10}
                      onChange={e => setFormData({
                        ...formData,
                        pricingConfiguration: {
                          ...formData.pricingConfiguration,
                          taxType: 'PERCENTAGE',
                          taxValue: Number(e.target.value) || 0
                        }
                      })}
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#00C6A6] font-bold text-slate-900"
                    />
                  </div>
                </div>

                {/* B2B Dynamic Pricing Formula Preview */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                      <DollarSign className="w-4 h-4 text-[#00C6A6]" />
                      <span>B2B Pricing Formula Preview (Sample Route: Tokyo → Kyoto, Nozomi Regular)</span>
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">Live Calculation</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">1. Supplier Nett</span>
                      <span className="font-mono font-bold text-slate-900">¥{samplePricing.baseNett.toLocaleString()}</span>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">2. B2B Margin ({samplePricing.marginPct}%)</span>
                      <span className="font-mono font-bold text-teal-700">+¥{samplePricing.marginAmt.toLocaleString()}</span>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">3. Tax on Margin ({samplePricing.taxPct}%)</span>
                      <span className="font-mono font-bold text-slate-700">+¥{samplePricing.taxAmt.toLocaleString()}</span>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">4. Service Fee</span>
                      <span className="font-mono font-bold text-slate-700">+¥{samplePricing.serviceFeeAmt.toLocaleString()}</span>
                    </div>

                    <div className="bg-teal-50 p-2.5 rounded-xl border border-teal-200 col-span-2 sm:col-span-1">
                      <span className="text-[10px] text-teal-800 block font-black uppercase">5. Price</span>
                      <span className="font-mono font-black text-slate-950 text-sm">¥{samplePricing.finalPrice.toLocaleString()}</span>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-500 leading-relaxed italic">
                    Note: B2B Agents strictly see <strong>Price: ¥{samplePricing.finalPrice.toLocaleString()} JPY</strong>. Internal supplier nett, markup, and tax breakdowns are redacted automatically.
                  </p>
                </div>
              </div>

              {/* SAVE / SUBMIT BAR */}
              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const target = products.find(p => p.productCode === selectedProductCode);
                    if (target) setFormData(JSON.parse(JSON.stringify(target)));
                  }}
                  className="px-5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel Changes
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-md flex items-center space-x-2 cursor-pointer hover:shadow-lg"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Commercial Master Product</span>
                </button>
              </div>

            </form>
          </div>

        </div>
      )}
    </div>
  );
};
