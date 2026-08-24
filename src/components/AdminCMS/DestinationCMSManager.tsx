import React, { useState } from 'react';
import { Destination, DestinationRegion, CurrencyCode } from '../../types';
import { AppDatabase } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { 
  MapPin, 
  Plus, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  Globe, 
  Sparkles, 
  Search,
  ExternalLink,
  Layers,
  Image as ImageIcon,
  Compass,
  Clock
} from 'lucide-react';

interface DestinationCMSManagerProps {
  onSelectDestination?: (slug: string) => void;
}

export const DestinationCMSManager: React.FC<DestinationCMSManagerProps> = ({ onSelectDestination }) => {
  const db = AppDatabase.getInstance();
  const { user } = useAuth();
  const [destinations, setDestinations] = useState<Destination[]>(() => db.getDestinations());
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDest, setEditingDest] = useState<Destination | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<Destination>>({
    name: '',
    slug: '',
    country: '',
    region: 'JAPAN',
    heroImage: '',
    tagline: '',
    description: '',
    bestTimeToVisit: '',
    idealTripDuration: '',
    travelStyle: '',
    currency: 'USD',
    keySellingPoints: [],
    highlights: [],
    cities: [],
    status: 'ACTIVE'
  });

  const [sellingPointInput, setSellingPointInput] = useState('');
  const [highlightInput, setHighlightInput] = useState('');

  const refresh = () => {
    setDestinations(db.getDestinations());
  };

  const handleOpenCreate = () => {
    setEditingDest(null);
    setFormData({
      name: '',
      slug: '',
      country: '',
      region: 'JAPAN',
      heroImage: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1600&auto=format&fit=crop',
      tagline: '',
      description: '',
      bestTimeToVisit: 'Spring & Autumn',
      idealTripDuration: '10–14 Days',
      travelStyle: 'Bespoke Luxury & Culture',
      currency: 'USD',
      keySellingPoints: ['24/7 dedicated local ground concierge', 'Contracted wholesale luxury rates'],
      highlights: ['Private temple access', 'Michelin culinary experiences'],
      cities: [],
      status: 'ACTIVE'
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (dest: Destination) => {
    setEditingDest(dest);
    setFormData({ ...dest });
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.slug) return;

    const destToSave: Destination = {
      id: editingDest ? editingDest.id : `dest-${formData.slug.toLowerCase().replace(/\s+/g, '-')}`,
      name: formData.name || '',
      slug: formData.slug.toLowerCase().replace(/\s+/g, '-'),
      country: formData.country || formData.name || '',
      region: (formData.region as DestinationRegion) || 'JAPAN',
      heroImage: formData.heroImage || 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1600&auto=format&fit=crop',
      tagline: formData.tagline || '',
      description: formData.description || '',
      keySellingPoints: formData.keySellingPoints || [],
      bestTimeToVisit: formData.bestTimeToVisit || 'All Year',
      idealTripDuration: formData.idealTripDuration || '7–10 Days',
      travelStyle: formData.travelStyle || 'Bespoke Luxury',
      currency: (formData.currency as CurrencyCode) || 'USD',
      cities: formData.cities || [],
      highlights: formData.highlights || [],
      featuredProductIds: editingDest?.featuredProductIds || [],
      status: formData.status || 'ACTIVE'
    };

    db.saveDestination(destToSave, user);
    refresh();
    setIsModalOpen(false);
  };

  const handleDelete = (destId: string) => {
    if (confirm('Are you sure you want to remove this destination?')) {
      db.deleteDestination(destId, user);
      refresh();
    }
  };

  const handleToggleStatus = (dest: Destination) => {
    const nextStatus = dest.status === 'ACTIVE' ? 'COMING_SOON' : 'ACTIVE';
    db.saveDestination({ ...dest, status: nextStatus }, user);
    refresh();
  };

  const addSellingPoint = () => {
    if (sellingPointInput.trim()) {
      setFormData(prev => ({
        ...prev,
        keySellingPoints: [...(prev.keySellingPoints || []), sellingPointInput.trim()]
      }));
      setSellingPointInput('');
    }
  };

  const removeSellingPoint = (idx: number) => {
    setFormData(prev => ({
      ...prev,
      keySellingPoints: (prev.keySellingPoints || []).filter((_, i) => i !== idx)
    }));
  };

  const addHighlight = () => {
    if (highlightInput.trim()) {
      setFormData(prev => ({
        ...prev,
        highlights: [...(prev.highlights || []), highlightInput.trim()]
      }));
      setHighlightInput('');
    }
  };

  const removeHighlight = (idx: number) => {
    setFormData(prev => ({
      ...prev,
      highlights: (prev.highlights || []).filter((_, i) => i !== idx)
    }));
  };

  const filtered = destinations.filter(d => 
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.country.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.region.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2 text-[#00C6A6] text-xs font-bold uppercase tracking-wider mb-1">
            <Compass className="w-4 h-4" />
            <span>Destinations & Editorial CMS</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">Destination & Landing Page Manager</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage destination hubs, hero imagery, regional highlights, travel requirements, and SEO metadata.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center space-x-2 bg-[#00C6A6] hover:bg-[#008972] text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-sm cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Destination</span>
        </button>
      </div>

      {/* Search */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search destination by name, country, region..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-[#00C6A6]"
          />
        </div>
      </div>

      {/* Grid of Destination Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(dest => (
          <div 
            key={dest.id} 
            className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="relative h-44 overflow-hidden bg-slate-900 group">
                <img
                  src={dest.heroImage}
                  alt={dest.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
                <div className="absolute top-3 right-3">
                  <button
                    onClick={() => handleToggleStatus(dest)}
                    className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer transition-colors backdrop-blur-md ${
                      dest.status === 'ACTIVE'
                        ? 'bg-emerald-500/90 text-white'
                        : 'bg-amber-500/90 text-white'
                    }`}
                  >
                    {dest.status === 'ACTIVE' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                    <span>{dest.status}</span>
                  </button>
                </div>

                <div className="absolute bottom-3 left-3 right-3 text-white">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#00E5C0]">
                    {dest.region} • {dest.currency}
                  </span>
                  <h3 className="text-lg font-bold">{dest.name}</h3>
                </div>
              </div>

              <div className="p-5 space-y-3 text-xs text-slate-600">
                <p className="line-clamp-2 text-slate-700 italic font-serif">
                  "{dest.tagline || dest.description}"
                </p>

                <div className="space-y-1 pt-1 border-t border-slate-100 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Best Season:</span>
                    <span className="font-semibold text-slate-800">{dest.bestTimeToVisit}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Duration:</span>
                    <span className="font-semibold text-slate-800">{dest.idealTripDuration}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Cities / Hubs:</span>
                    <span className="font-semibold text-slate-800">{dest.cities.length} Managed Hubs</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] font-mono text-slate-400">slug: /{dest.slug}</span>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleOpenEdit(dest)}
                  className="p-1.5 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                  title="Edit Destination CMS"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(dest.id)}
                  className="p-1.5 text-rose-500 hover:text-rose-700 bg-white hover:bg-rose-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                  title="Delete Destination"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {editingDest ? `Edit Destination: ${editingDest.name}` : 'Add New Destination'}
                </h3>
                <p className="text-xs text-slate-500">Configure page layout, hero imagery, selling points, and currency.</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-2 rounded-full cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Destination Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name || ''}
                    onChange={e => {
                      const name = e.target.value;
                      setFormData(prev => ({
                        ...prev,
                        name,
                        slug: prev.slug ? prev.slug : name.toLowerCase().replace(/\s+/g, '-')
                      }));
                    }}
                    placeholder="e.g. Japan, Switzerland, Scotland"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#00C6A6]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">URL Slug *</label>
                  <input
                    type="text"
                    required
                    value={formData.slug || ''}
                    onChange={e => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                    placeholder="e.g. japan, united-kingdom, europe"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white focus:outline-none focus:border-[#00C6A6]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Region</label>
                  <select
                    value={formData.region}
                    onChange={e => setFormData({ ...formData, region: e.target.value as DestinationRegion })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="JAPAN">Japan</option>
                    <option value="UNITED_KINGDOM">United Kingdom</option>
                    <option value="EUROPE">Europe</option>
                    <option value="SOUTHEAST_ASIA">Southeast Asia</option>
                    <option value="MIDDLE_EAST">Middle East</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Currency</label>
                  <select
                    value={formData.currency}
                    onChange={e => setFormData({ ...formData, currency: e.target.value as CurrencyCode })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="JPY">JPY (¥)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Status</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value as 'ACTIVE' | 'COMING_SOON' })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="ACTIVE">Active (Live)</option>
                    <option value="COMING_SOON">Coming Soon</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Hero Image URL</label>
                <input
                  type="url"
                  value={formData.heroImage || ''}
                  onChange={e => setFormData({ ...formData, heroImage: e.target.value })}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Hero Tagline</label>
                <input
                  type="text"
                  value={formData.tagline || ''}
                  onChange={e => setFormData({ ...formData, tagline: e.target.value })}
                  placeholder="e.g. Precision, heritage, ultra-modern luxury, and Michelin-starred hospitality."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Detailed Overview</label>
                <textarea
                  rows={3}
                  value={formData.description || ''}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe ground operations, private access, concierge handling..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Best Time to Visit</label>
                  <input
                    type="text"
                    value={formData.bestTimeToVisit || ''}
                    onChange={e => setFormData({ ...formData, bestTimeToVisit: e.target.value })}
                    placeholder="e.g. March–May & Oct–Nov"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Ideal Trip Duration</label>
                  <input
                    type="text"
                    value={formData.idealTripDuration || ''}
                    onChange={e => setFormData({ ...formData, idealTripDuration: e.target.value })}
                    placeholder="e.g. 10–14 Days"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Travel Style</label>
                  <input
                    type="text"
                    value={formData.travelStyle || ''}
                    onChange={e => setFormData({ ...formData, travelStyle: e.target.value })}
                    placeholder="e.g. Bespoke Luxury & Gastronomy"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              {/* Selling Points */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="font-semibold text-slate-700">Key Selling Points (B2B Highlights)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={sellingPointInput}
                    onChange={e => setSellingPointInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSellingPoint(); } }}
                    placeholder="Add selling point and press Enter..."
                    className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={addSellingPoint}
                    className="px-3 py-2 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(formData.keySellingPoints || []).map((sp, idx) => (
                    <span key={idx} className="inline-flex items-center space-x-1 bg-slate-100 text-slate-800 px-2.5 py-1 rounded-lg text-[11px]">
                      <span>{sp}</span>
                      <button type="button" onClick={() => removeSellingPoint(idx)} className="text-slate-400 hover:text-rose-500">×</button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
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
                  {editingDest ? 'Update Destination' : 'Publish Destination'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
