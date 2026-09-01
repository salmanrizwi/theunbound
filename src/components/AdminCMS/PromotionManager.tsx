import React, { useState } from 'react';
import { Promotion, PromotionDiscountType, PromotionAudience, PromotionPlacement, PromotionFrequency, Destination, Product } from '../../types';
import { AppDatabase } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { 
  Tag, 
  Plus, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  Calendar, 
  Percent, 
  DollarSign, 
  Sparkles, 
  Filter, 
  Search,
  ExternalLink,
  Layers,
  Clock
} from 'lucide-react';

interface PromotionManagerProps {
  destinations: Destination[];
  products: Product[];
}

export const PromotionManager: React.FC<PromotionManagerProps> = ({ destinations, products }) => {
  const db = AppDatabase.getInstance();
  const { user } = useAuth();
  const [promotions, setPromotions] = useState<Promotion[]>(() => db.getPromotions());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAudience, setFilterAudience] = useState<string>('ALL');
  const [filterPlacement, setFilterPlacement] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<Promotion>>({
    title: '',
    subtitle: '',
    description: '',
    promoCode: '',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    currency: 'USD',
    minBookingValue: 1000,
    maxDiscount: 1500,
    bannerImage: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1600&auto=format&fit=crop',
    ctaText: 'Explore Exclusive Tariffs',
    ctaLink: '',
    targetAudience: 'ALL',
    displayPlacement: 'BANNER',
    frequency: 'ALWAYS',
    destinationId: 'all',
    applicableProductIds: [],
    applyToAllProducts: true,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 86400000 * 90).toISOString().split('T')[0],
    priority: 1,
    isActive: true
  });

  const refreshPromos = () => {
    setPromotions(db.getPromotions());
  };

  const handleOpenCreate = () => {
    setEditingPromo(null);
    setFormData({
      title: '',
      subtitle: '',
      description: '',
      promoCode: '',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      currency: 'USD',
      minBookingValue: 1000,
      maxDiscount: 1500,
      bannerImage: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1600&auto=format&fit=crop',
      ctaText: 'Explore Exclusive Tariffs',
      ctaLink: '',
      targetAudience: 'ALL',
      displayPlacement: 'BANNER',
      frequency: 'ALWAYS',
      destinationId: 'all',
      applicableProductIds: [],
      applyToAllProducts: true,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 86400000 * 90).toISOString().split('T')[0],
      priority: 1,
      isActive: true
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (promo: Promotion) => {
    setEditingPromo(promo);
    setFormData(promo);
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || formData.discountValue === undefined) return;

    const promoToSave: Promotion = {
      id: editingPromo ? editingPromo.id : `promo-${Date.now()}`,
      title: formData.title || '',
      subtitle: formData.subtitle || '',
      description: formData.description || '',
      promoCode: formData.promoCode || '',
      discountType: (formData.discountType as PromotionDiscountType) || 'PERCENTAGE',
      discountValue: Number(formData.discountValue) || 0,
      currency: formData.currency || 'USD',
      minBookingValue: Number(formData.minBookingValue) || 0,
      maxDiscount: Number(formData.maxDiscount) || 0,
      bannerImage: formData.bannerImage || '',
      ctaText: formData.ctaText || 'Learn More',
      ctaLink: formData.ctaLink || '',
      targetAudience: (formData.targetAudience as PromotionAudience) || 'ALL',
      displayPlacement: (formData.displayPlacement as PromotionPlacement) || 'BANNER',
      frequency: (formData.frequency as PromotionFrequency) || 'ALWAYS',
      destinationId: formData.destinationId || 'all',
      applicableProductIds: formData.applicableProductIds || [],
      applyToAllProducts: formData.applyToAllProducts ?? true,
      startDate: formData.startDate || '',
      endDate: formData.endDate || '',
      priority: Number(formData.priority) || 1,
      isActive: formData.isActive ?? true,
      viewCount: editingPromo?.viewCount || 0,
      clickCount: editingPromo?.clickCount || 0,
      createdAt: editingPromo?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.savePromotion(promoToSave, user);
    refreshPromos();
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    const target = promotions.find(p => p.id === id);
    const title = target?.title || 'this promotional campaign';
    if (confirm(`Are you sure you want to permanently delete the campaign "${title}"? This action cannot be undone.`)) {
      db.deletePromotion(id, user);
      if (editingPromo?.id === id) {
        setIsModalOpen(false);
        setEditingPromo(null);
      }
      refreshPromos();
    }
  };

  const handleToggleActive = (promo: Promotion) => {
    db.savePromotion({ ...promo, isActive: !promo.isActive }, user);
    refreshPromos();
  };

  const filtered = promotions.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.promoCode && p.promoCode.toLowerCase().includes(searchQuery.toLowerCase())) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAudience = filterAudience === 'ALL' || p.targetAudience === filterAudience;
    const matchesPlacement = filterPlacement === 'ALL' || p.displayPlacement === filterPlacement;
    const matchesStatus = filterStatus === 'ALL' || 
      (filterStatus === 'ACTIVE' && p.isActive) ||
      (filterStatus === 'INACTIVE' && !p.isActive);
    return matchesSearch && matchesAudience && matchesPlacement && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2 text-[#00C6A6] text-xs font-bold uppercase tracking-wider mb-1">
            <Tag className="w-4 h-4" />
            <span>Campaigns & Commercial Offers</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">Promotion Management Engine</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure wholesale incentives, early-bird rate locks, promotional popups, homepage banners, and seasonal promo codes.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center space-x-2 bg-[#00C6A6] hover:bg-[#008972] text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-sm cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Create Promotion</span>
        </button>
      </div>

      {/* Filters & Search */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search campaigns, promo codes..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#00C6A6]"
          />
        </div>

        <div>
          <select
            value={filterAudience}
            onChange={(e) => setFilterAudience(e.target.value)}
            className="w-full py-2 px-3 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#00C6A6]"
          >
            <option value="ALL">All Target Audiences</option>
            <option value="BUYER">Retail Buyers Only</option>
            <option value="B2B_AGENT">B2B Agents Only</option>
          </select>
        </div>

        <div>
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
        </div>

        <div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full py-2 px-3 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#00C6A6]"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Promotions Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Campaign & Code</th>
                <th className="py-3 px-4">Discount</th>
                <th className="py-3 px-4">Placement & Audience</th>
                <th className="py-3 px-4">Validity Window</th>
                <th className="py-3 px-4">Performance</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(promo => (
                <tr key={promo.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-slate-900 text-xs">{promo.title}</div>
                    {promo.promoCode && (
                      <span className="inline-block mt-1 font-mono text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 font-semibold">
                        CODE: {promo.promoCode}
                      </span>
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
                          <span>{promo.discountValue} {promo.currency || 'USD'} OFF</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="space-y-1">
                      <span className="inline-block text-[10px] bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded border border-blue-200">
                        {promo.displayPlacement}
                      </span>
                      <div className="text-[11px] text-slate-500">
                        Audience: <strong className="text-slate-700">{promo.targetAudience}</strong>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-500">
                    <div className="flex items-center space-x-1 text-[11px]">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <span>{promo.startDate} to {promo.endDate}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="text-[11px] text-slate-600 space-y-0.5">
                      <div>Views: <strong>{promo.viewCount || 0}</strong></div>
                      <div>Clicks: <strong>{promo.clickCount || 0}</strong></div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <button
                      onClick={() => handleToggleActive(promo)}
                      className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${
                        promo.isActive 
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' 
                          : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                      }`}
                    >
                      {promo.isActive ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>ACTIVE</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3 text-slate-500" />
                          <span>PAUSED</span>
                        </>
                      )}
                    </button>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => handleOpenEdit(promo)}
                        className="p-1.5 text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                        title="Edit Campaign"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(promo.id)}
                        className="p-1.5 text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                        title="Delete Campaign"
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
                    No promotions match your search filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {editingPromo ? 'Edit Promotional Campaign' : 'Create New Promotional Campaign'}
                </h3>
                <p className="text-xs text-slate-500">Configure discount type, targeted placements, and start/end dates.</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-2 rounded-full cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Promotion Title *</label>
                <input
                  type="text"
                  required
                  value={formData.title || ''}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Cherry Blossom 2027 Early Bird"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#00C6A6]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Subtitle / Tagline</label>
                  <input
                    type="text"
                    value={formData.subtitle || ''}
                    onChange={e => setFormData({ ...formData, subtitle: e.target.value })}
                    placeholder="e.g. 12% Wholesale Tariff Reduction"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#00C6A6]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Promo Code (Optional)</label>
                  <input
                    type="text"
                    value={formData.promoCode || ''}
                    onChange={e => setFormData({ ...formData, promoCode: e.target.value.toUpperCase() })}
                    placeholder="e.g. SAKURA2027"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl uppercase font-mono focus:bg-white focus:outline-none focus:border-[#00C6A6]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Description</label>
                <textarea
                  rows={2}
                  value={formData.description || ''}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Explain terms, inclusions, or eligible destinations..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#00C6A6]"
                />
              </div>

              {/* Discount Specs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Discount Type</label>
                  <select
                    value={formData.discountType}
                    onChange={e => setFormData({ ...formData, discountType: e.target.value as PromotionDiscountType })}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-800"
                  >
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FIXED">Fixed Amount ($)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Discount Value *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.discountValue || 0}
                    onChange={e => setFormData({ ...formData, discountValue: Number(e.target.value) })}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg font-bold text-emerald-700"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Min Booking Value</label>
                  <input
                    type="number"
                    value={formData.minBookingValue || 0}
                    onChange={e => setFormData({ ...formData, minBookingValue: Number(e.target.value) })}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              {/* Placements and Targeting */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Target Audience</label>
                  <select
                    value={formData.targetAudience}
                    onChange={e => setFormData({ ...formData, targetAudience: e.target.value as PromotionAudience })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="ALL">All Audiences</option>
                    <option value="BUYER">Retail Buyers</option>
                    <option value="B2B_AGENT">B2B Agents Only</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Display Placement</label>
                  <select
                    value={formData.displayPlacement}
                    onChange={e => setFormData({ ...formData, displayPlacement: e.target.value as PromotionPlacement })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
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
                    value={formData.frequency}
                    onChange={e => setFormData({ ...formData, frequency: e.target.value as PromotionFrequency })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="ONCE_PER_SESSION">Once Per Session</option>
                    <option value="ONCE_PER_DAY">Once Per Day</option>
                    <option value="ALWAYS">Always</option>
                  </select>
                </div>
              </div>

              {/* Dates & Image */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Start Date</label>
                  <input
                    type="date"
                    value={formData.startDate || ''}
                    onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">End Date</label>
                  <input
                    type="date"
                    value={formData.endDate || ''}
                    onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Banner Image URL</label>
                <input
                  type="url"
                  value={formData.bannerImage || ''}
                  onChange={e => setFormData({ ...formData, bannerImage: e.target.value })}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <input
                  type="checkbox"
                  id="promo-active-chk"
                  checked={formData.isActive ?? true}
                  onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-[#00C6A6] rounded border-slate-300"
                />
                <label htmlFor="promo-active-chk" className="font-semibold text-slate-800 select-none cursor-pointer">
                  Activate this promotion immediately across target channels
                </label>
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
                      <span>Delete Campaign</span>
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
                    className="px-6 py-2.5 bg-[#00C6A6] hover:bg-[#008972] text-slate-950 font-bold rounded-xl shadow-md cursor-pointer transition-colors"
                  >
                    {editingPromo ? 'Update Campaign' : 'Save & Publish Campaign'}
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
