import React, { useState, useEffect } from 'react';
import { 
  Globe2, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Eye, 
  Layers, 
  MapPin, 
  Building2, 
  Package, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink,
  ChevronRight,
  Filter,
  ArrowUpDown,
  Sparkles,
  RefreshCw,
  FolderTree
} from 'lucide-react';
import { MasterRegion, Destination, CityHub, Product, Hotel, CurrencyCode, SUPPORTED_CURRENCIES } from '../../types';
import { AppDatabase } from '../../services/db';
import { useAuth } from '../../context/AuthContext';

interface RegionCMSManagerProps {
  onNavigateToDestinations?: (regionId?: string) => void;
  onNavigateToHubs?: (regionId?: string) => void;
}

export const RegionCMSManager: React.FC<RegionCMSManagerProps> = ({
  onNavigateToDestinations,
  onNavigateToHubs
}) => {
  const { user } = useAuth();
  const db = AppDatabase.getInstance();
  const [regions, setRegions] = useState<MasterRegion[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [cityHubs, setCityHubs] = useState<CityHub[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'DRAFT' | 'INACTIVE'>('ALL');
  const [selectedRegion, setSelectedRegion] = useState<MasterRegion | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<Partial<MasterRegion>>({
    name: '',
    code: '',
    slug: '',
    tagline: '',
    description: '',
    heroImage: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1600&auto=format&fit=crop',
    currency: 'USD',
    displayOrder: 1,
    status: 'ACTIVE',
    isPublished: true,
    featured: false
  });

  const loadData = () => {
    const rList = db.getMasterRegions();
    const dList = db.getDestinations();
    const hList = db.getCityHubs();
    const pList = db.getProducts();
    const hotList = db.getHotels();

    setRegions(rList);
    setDestinations(dList);
    setCityHubs(hList);
    setProducts(pList);
    setHotels(hotList);
  };

  useEffect(() => {
    loadData();
    const unsub = db.subscribe(loadData);
    window.addEventListener('storage', loadData);
    return () => {
      unsub();
      window.removeEventListener('storage', loadData);
    };
  }, []);

  const getRegionStats = (reg: MasterRegion) => {
    const dList = destinations || [];
    const hList = cityHubs || [];
    const pList = products || [];
    const hotList = hotels || [];

    const linkedDests = dList.filter(d => d.regionId === reg.id || d.regionName?.toLowerCase() === reg.name.toLowerCase());
    const destIds = new Set(linkedDests.map(d => d.id));
    const linkedHubs = hList.filter(h => h.regionId === reg.id || destIds.has(h.destinationId));
    const linkedProds = pList.filter(p => p.regionId === reg.id || destIds.has(p.destinationId));
    const linkedHotels = hotList.filter(h => h.regionId === reg.id || destIds.has(h.destinationId));

    return {
      destinationsCount: linkedDests.length,
      hubsCount: linkedHubs.length,
      productsCount: linkedProds.length,
      hotelsCount: linkedHotels.length,
      linkedDestinations: linkedDests
    };
  };

  const handleCreateNew = () => {
    setFormData({
      id: `reg-${Date.now()}`,
      name: '',
      code: '',
      slug: '',
      tagline: '',
      description: '',
      heroImage: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1600&auto=format&fit=crop',
      currency: 'USD',
      displayOrder: (regions.length + 1),
      status: 'ACTIVE',
      isPublished: true,
      featured: false
    });
    setIsCreating(true);
    setIsEditing(false);
  };

  const handleEdit = (reg: MasterRegion) => {
    setFormData({ ...reg });
    setIsEditing(true);
    setIsCreating(false);
  };

  const handleNameChange = (name: string) => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const code = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 4) || 'REG';
    setFormData(prev => ({
      ...prev,
      name,
      slug: prev.slug && prev.slug !== '' ? prev.slug : slug,
      code: prev.code && prev.code !== '' ? prev.code : code
    }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      alert('Region Name is required.');
      return;
    }

    const regId = formData.id || `reg-${(formData.slug || Date.now()).toString()}`;
    const slug = formData.slug?.trim() || formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const code = formData.code?.trim().toUpperCase() || 'REG';

    const newRegion: MasterRegion = {
      id: regId,
      name: formData.name.trim(),
      code,
      slug,
      tagline: formData.tagline?.trim() || '',
      description: formData.description?.trim() || '',
      heroImage: formData.heroImage || 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1600&auto=format&fit=crop',
      currency: (formData.currency as CurrencyCode) || 'USD',
      displayOrder: Number(formData.displayOrder) || 1,
      status: (formData.status as any) || 'ACTIVE',
      isPublished: formData.isPublished ?? true,
      featured: formData.featured ?? false,
      updatedAt: new Date().toISOString()
    };

    db.saveMasterRegion(newRegion, user);
    loadData();
    setIsCreating(false);
    setIsEditing(false);
    setSaveSuccessMsg(`Region "${newRegion.name}" saved successfully to Firebase!`);
    setTimeout(() => setSaveSuccessMsg(null), 4000);
  };

  const handleDelete = (id: string) => {
    const reg = regions.find(r => r.id === id);
    if (!reg) return;
    const stats = getRegionStats(reg);
    if (stats.destinationsCount > 0) {
      if (!confirm(`Warning: This region has ${stats.destinationsCount} linked Destination(s). Deleting it will leave those destinations unlinked. Do you still want to delete "${reg.name}"?`)) {
        return;
      }
    }
    db.deleteMasterRegion(id, user);
    loadData();
    setDeleteConfirmId(null);
    setSaveSuccessMsg(`Region "${reg.name}" deleted.`);
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  // Filtered list
  const filteredRegions = regions
    .filter(r => {
      const matchSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          r.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          r.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === 'ALL' || r.status === statusFilter;
      return matchSearch && matchStatus;
    })
    .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

  return (
    <div id="region-cms-manager" className="space-y-6">
      {/* Top Architecture Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white shadow-xl">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Tier 1 Root Level
              </span>
              <span className="text-xs text-slate-400">Master Hierarchy Schema</span>
            </div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Globe2 className="w-6 h-6 text-amber-400" />
              Master Macro Regions Manager
            </h2>
            <p className="text-sm text-slate-300 mt-1 max-w-3xl">
              Regions are the top-level parent entities in the connected DMC data architecture. Every Destination, City Hub, Hotel, and Product flows downward from here.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleCreateNew}
              id="btn-create-master-region"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Master Region
            </button>
          </div>
        </div>

        {/* Visual Hierarchy Flow Map */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 font-black text-sm flex items-center justify-center">1</div>
            <div>
              <div className="text-xs font-bold text-amber-300 uppercase tracking-wide">REGION (Active)</div>
              <div className="text-[11px] text-slate-300">East Asia, W. Europe, etc.</div>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-700 text-slate-200 font-bold text-sm flex items-center justify-center">2</div>
            <div>
              <div className="text-xs font-bold text-slate-200 uppercase tracking-wide">DESTINATION</div>
              <div className="text-[11px] text-slate-400">Japan, UK, France, UAE</div>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-700 text-slate-200 font-bold text-sm flex items-center justify-center">3</div>
            <div>
              <div className="text-xs font-bold text-slate-200 uppercase tracking-wide">CITY HUB</div>
              <div className="text-[11px] text-slate-400">Tokyo, London, Paris</div>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-700 text-slate-200 font-bold text-sm flex items-center justify-center">4</div>
            <div>
              <div className="text-xs font-bold text-slate-200 uppercase tracking-wide">SERVICES & INVENTORY</div>
              <div className="text-[11px] text-slate-400">Products, Hotels, Guides</div>
            </div>
          </div>
        </div>
      </div>

      {/* Success Notification */}
      {saveSuccessMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-3 text-sm animate-fade-in shadow-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search regions by name, code, keyword..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          >
            <option value="ALL">All Statuses ({regions.length})</option>
            <option value="ACTIVE">Active</option>
            <option value="DRAFT">Draft</option>
            <option value="INACTIVE">Inactive</option>
          </select>

          <button
            onClick={loadData}
            title="Refresh Regions from Firestore"
            className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Regions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredRegions.map((reg) => {
          const stats = getRegionStats(reg);
          return (
            <div
              key={reg.id}
              id={`region-card-${reg.id}`}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-all duration-200 group"
            >
              {/* Card Hero Image */}
              <div className="relative h-40 w-full overflow-hidden bg-slate-900">
                <img
                  src={reg.heroImage || 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=800&auto=format&fit=crop'}
                  alt={reg.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent" />
                
                {/* Region Code & Status Badges */}
                <div className="absolute top-3 left-3 flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-sm">
                    {reg.code || 'REG'}
                  </span>
                  <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider ${
                    reg.status === 'ACTIVE' 
                      ? 'bg-emerald-500/90 text-white' 
                      : reg.status === 'DRAFT' 
                        ? 'bg-amber-400 text-slate-950' 
                        : 'bg-slate-500 text-white'
                  }`}>
                    {reg.status}
                  </span>
                </div>

                <div className="absolute top-3 right-3 flex items-center gap-1.5">
                  <span className="px-2 py-1 rounded-lg bg-slate-900/80 backdrop-blur-sm text-slate-200 text-xs font-semibold">
                    Order #{reg.displayOrder || 1}
                  </span>
                </div>

                {/* Region Title & Tagline on Hero */}
                <div className="absolute bottom-3 left-3 right-3 text-white">
                  <h3 className="text-lg font-bold text-white drop-shadow-sm flex items-center gap-1.5">
                    {reg.name}
                  </h3>
                  {reg.tagline && (
                    <p className="text-xs text-slate-200 line-clamp-1 opacity-90 drop-shadow-sm">
                      {reg.tagline}
                    </p>
                  )}
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                {reg.description && (
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {reg.description}
                  </p>
                )}

                {/* Connected Hierarchy Counts */}
                <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-100">
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 text-center">
                    <div className="flex items-center justify-center text-amber-600 mb-0.5">
                      <MapPin className="w-3.5 h-3.5" />
                    </div>
                    <div className="text-sm font-bold text-slate-900">{stats.destinationsCount}</div>
                    <div className="text-[10px] text-slate-500 uppercase font-medium">Destinations</div>
                  </div>

                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 text-center">
                    <div className="flex items-center justify-center text-sky-600 mb-0.5">
                      <Building2 className="w-3.5 h-3.5" />
                    </div>
                    <div className="text-sm font-bold text-slate-900">{stats.hubsCount}</div>
                    <div className="text-[10px] text-slate-500 uppercase font-medium">Hubs</div>
                  </div>

                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 text-center">
                    <div className="flex items-center justify-center text-emerald-600 mb-0.5">
                      <Package className="w-3.5 h-3.5" />
                    </div>
                    <div className="text-sm font-bold text-slate-900">{stats.productsCount}</div>
                    <div className="text-[10px] text-slate-500 uppercase font-medium">Products</div>
                  </div>

                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 text-center">
                    <div className="flex items-center justify-center text-indigo-600 mb-0.5">
                      <Layers className="w-3.5 h-3.5" />
                    </div>
                    <div className="text-sm font-bold text-slate-900">{stats.hotelsCount}</div>
                    <div className="text-[10px] text-slate-500 uppercase font-medium">Hotels</div>
                  </div>
                </div>

                {/* Linked Destinations List Preview */}
                {(stats.linkedDestinations || []).length > 0 && (
                  <div className="pt-2 border-t border-slate-100">
                    <div className="text-[11px] font-semibold text-slate-500 mb-1.5 flex items-center justify-between">
                      <span>Linked Destinations:</span>
                      <span className="text-[10px] text-amber-600 font-bold">{(stats.linkedDestinations || []).length} active</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(stats.linkedDestinations || []).map(d => (
                        <span key={d.id} className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200/60 text-amber-800 text-[11px] font-medium">
                          {d.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Card Action Buttons */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {onNavigateToDestinations && (
                      <button
                        onClick={() => onNavigateToDestinations(reg.id)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
                        title="View & manage destinations for this region"
                      >
                        <MapPin className="w-3.5 h-3.5 text-amber-600" />
                        Destinations
                      </button>
                    )}
                    {onNavigateToHubs && (
                      <button
                        onClick={() => onNavigateToHubs(reg.id)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
                        title="View & manage city hubs for this region"
                      >
                        <Building2 className="w-3.5 h-3.5 text-sky-600" />
                        Hubs
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEdit(reg)}
                      className="p-1.5 rounded-lg text-slate-600 hover:text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer"
                      title="Edit Region"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(reg.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                      title="Delete Region"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredRegions.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300 p-8">
          <Globe2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-700">No Master Regions found</h3>
          <p className="text-xs text-slate-500 mt-1">
            {searchTerm ? `No regions matching "${searchTerm}"` : 'Create your first master region to start building your hierarchy.'}
          </p>
          <button
            onClick={handleCreateNew}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs shadow hover:bg-amber-400 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Master Region
          </button>
        </div>
      )}

      {/* Modal for Creating / Editing Master Region */}
      {(isCreating || isEditing) && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-scale-in">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500 text-slate-950 font-black">
                  <Globe2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {isCreating ? 'Create New Master Region' : `Edit Region: ${formData.name}`}
                  </h3>
                  <p className="text-xs text-slate-300">
                    Tier 1 of the connected hierarchy (Region → Destination → Hub → Product/Hotel)
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setIsCreating(false); setIsEditing(false); }}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Region Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. East Asia, Western Europe, Southeast Asia"
                    value={formData.name || ''}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Region Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. EA, WEU, SEA"
                    value={formData.code || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-bold uppercase text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    URL Slug
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. east-asia"
                    value={formData.slug || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 font-mono text-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Default Currency
                  </label>
                  <select
                    value={formData.currency || 'USD'}
                    onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value as CurrencyCode }))}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 font-medium text-slate-700"
                  >
                    {SUPPORTED_CURRENCIES.map(curr => (
                      <option key={curr.code} value={curr.code}>
                        {curr.code} - {curr.name} ({curr.symbol})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Catchy Tagline
                </label>
                <input
                  type="text"
                  placeholder="e.g. High-speed transit, imperial heritage, and futuristic metropolises"
                  value={formData.tagline || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, tagline: e.target.value }))}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Region Description & Overview
                </label>
                <textarea
                  rows={3}
                  placeholder="Comprehensive description of the macro region, geographic scope, and luxury travel proposition..."
                  value={formData.description || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Hero Image URL
                </label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/photo-..."
                  value={formData.heroImage || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, heroImage: e.target.value }))}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 font-mono text-slate-700"
                />
                {formData.heroImage && (
                  <div className="mt-2 h-24 rounded-xl overflow-hidden border border-slate-200 relative">
                    <img
                      src={formData.heroImage}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Display Order
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.displayOrder || 1}
                    onChange={(e) => setFormData(prev => ({ ...prev, displayOrder: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Publish Status
                  </label>
                  <select
                    value={formData.status || 'ACTIVE'}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-slate-800"
                  >
                    <option value="ACTIVE">ACTIVE (Published)</option>
                    <option value="DRAFT">DRAFT (Internal)</option>
                    <option value="INACTIVE">INACTIVE (Hidden)</option>
                  </select>
                </div>

                <div className="flex items-center gap-3 pt-6">
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.featured ?? false}
                      onChange={(e) => setFormData(prev => ({ ...prev, featured: e.target.checked }))}
                      className="rounded text-amber-500 focus:ring-amber-400"
                    />
                    <span>Featured Region</span>
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => { setIsCreating(false); setIsEditing(false); }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {isCreating ? 'Create Master Region' : 'Save Region Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
