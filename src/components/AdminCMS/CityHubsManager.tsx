import React, { useState, useEffect } from 'react';
import { AppDatabase } from '../../services/db';
import { countingEngine } from '../../services/countingEngine';
import { CityHub, Destination, MasterRegion } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { EntitySEOSettingsTab } from './EntitySEOSettingsTab';
import { 
  Building2, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  MapPin, 
  Image as ImageIcon,
  CheckCircle2,
  Compass,
  Layers,
  Globe2,
  ChevronRight,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { MasterDataDiagnosticBanner } from './MasterDataDiagnosticBanner';

interface CityHubsManagerProps {
  destinations?: Destination[];
}

export const CityHubsManager: React.FC<CityHubsManagerProps> = ({ destinations: propDestinations }) => {
  const { user } = useAuth();
  const db = AppDatabase.getInstance();
  const [cityHubs, setCityHubs] = useState<CityHub[]>(db.getCityHubs());
  const [masterRegions, setMasterRegions] = useState<MasterRegion[]>(db.getMasterRegions());
  const [destinations, setDestinations] = useState<Destination[]>(propDestinations || db.getDestinations());
  const [selectedDestinationFilter, setSelectedDestinationFilter] = useState<string>('all');
  const [selectedRegionFilter, setSelectedRegionFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [editingHub, setEditingHub] = useState<Partial<CityHub> | null>(null);
  const [modalTab, setModalTab] = useState<'CONTENT' | 'SEO'>('CONTENT');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    return db.subscribe(() => {
      setCityHubs(db.getCityHubs());
      setMasterRegions(db.getMasterRegions());
      setDestinations(db.getDestinations());
    });
  }, []);

  const availableDestinationsForFilter = selectedRegionFilter === 'all'
    ? destinations
    : destinations.filter(d => !d.regionId || d.regionId === selectedRegionFilter);

  const filteredHubs = cityHubs.filter(hub => {
    const matchesRegion = selectedRegionFilter === 'all' || hub.regionId === selectedRegionFilter;
    const matchesDest = selectedDestinationFilter === 'all' || hub.destinationId === selectedDestinationFilter;
    const q = (searchQuery || '').toLowerCase();
    const matchesSearch = !q ||
                          (hub.name || '').toLowerCase().includes(q) || 
                          (hub.tagline || '').toLowerCase().includes(q) ||
                          (hub.regionName || '').toLowerCase().includes(q) ||
                          (hub.destinationName || '').toLowerCase().includes(q);
    return matchesRegion && matchesDest && matchesSearch;
  });

  const handleOpenAdd = () => {
    setSaveError(null);
    setEditingHub({
      id: '',
      regionId: '',
      regionName: '',
      destinationId: '',
      destinationName: '',
      name: '',
      tagline: '',
      description: '',
      heroImage: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?q=80&w=1200&auto=format&fit=crop',
      images: ['https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?q=80&w=1200&auto=format&fit=crop'],
      productCount: 0,
      hotelCount: 0,
      displayOrder: cityHubs.length + 1,
      highlights: ['Local Sightseeing', 'Private Transit Hub'],
      isPublished: true,
      status: 'ACTIVE'
    });
    setModalTab('CONTENT');
    setIsEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);

    if (!editingHub || !editingHub.name?.trim()) {
      setSaveError('City Hub Name is required.');
      return;
    }

    if (!editingHub.destinationId?.trim()) {
      setSaveError('Parent Destination is required. Please select a Destination.');
      return;
    }

    const targetDest = destinations.find(d => d.id === editingHub.destinationId);
    if (!targetDest) {
      setSaveError('Selected Destination was not found. Please select a valid Destination.');
      return;
    }

    const targetRegion = masterRegions.find(r => r.id === (editingHub.regionId || targetDest.regionId));

    const cleanName = editingHub.name.trim();
    const cleanSlug = (editingHub.slug?.trim() || cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-')).replace(/(^-|-$)/g, '');
    const hubId = editingHub.id && !editingHub.id.startsWith('hub-17') ? editingHub.id : `hub-${cleanSlug}`;

    const completeHub: CityHub = {
      id: hubId,
      destinationId: targetDest.id,
      destinationName: targetDest.name,
      regionId: targetRegion?.id || targetDest.regionId || '',
      regionName: targetRegion?.name || targetDest.regionName || '',
      name: cleanName,
      slug: cleanSlug,
      tagline: editingHub.tagline?.trim() || '',
      description: editingHub.description?.trim() || '',
      heroImage: editingHub.heroImage || 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?q=80&w=1200&auto=format&fit=crop',
      images: editingHub.images || [],
      productCount: Number(editingHub.productCount || 0),
      hotelCount: Number(editingHub.hotelCount || 0),
      displayOrder: Number(editingHub.displayOrder || 1),
      highlights: Array.isArray(editingHub.highlights) ? editingHub.highlights : (editingHub.highlights as string || '').split(',').map((s: string) => s.trim()).filter(Boolean),
      isPublished: editingHub.isPublished !== undefined ? editingHub.isPublished : true,
      status: editingHub.status || 'ACTIVE',
      seo: editingHub.seo
    };

    setIsSaving(true);
    try {
      await db.saveCityHubAsync(completeHub, user);
      setCityHubs(db.getCityHubs());
      setIsEditing(false);
      setEditingHub(null);
      setSaveSuccessMsg(`City Hub "${completeHub.name}" successfully saved to Firestore!`);
      setTimeout(() => setSaveSuccessMsg(null), 5000);
    } catch (err: any) {
      console.error('[CityHubsCMS] Save error:', err);
      setSaveError(err?.message || 'Failed to save City Hub to Firestore.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    const target = cityHubs.find(h => h.id === id) || (editingHub?.id === id ? editingHub : null);
    const targetName = target ? target.name : 'City Hub';
    setDeleteTarget({ id, name: targetName });
  };

  const modalAvailableDestinations = editingHub?.regionId
    ? destinations.filter(d => !d.regionId || d.regionId === editingHub.regionId)
    : destinations;

  return (
    <div className="space-y-6">
      <MasterDataDiagnosticBanner />

      {saveSuccessMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-sm font-semibold shadow-xs animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2 text-[#00C6A6] font-bold text-xs uppercase tracking-wider mb-1">
            <Building2 className="w-4 h-4" />
            <span>Tier 3: City Hubs & Touring Gateways</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">Destination Cities & Hubs Manager</h2>
          <p className="text-sm text-slate-500">
            Structure primary transit and touring hubs (e.g. Tokyo, Kyoto, Osaka, Bangkok, London) linked to Parent Master Regions and Destinations.
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center space-x-2 bg-[#00C6A6] hover:bg-[#00b094] text-slate-950 font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-md shadow-[#00C6A6]/20 text-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Add New City / Hub</span>
        </button>
      </div>

      {/* Filter & Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by city name, region, destination, or tagline..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-[#00C6A6]"
          />
        </div>
        <select
          value={selectedRegionFilter}
          onChange={e => {
            setSelectedRegionFilter(e.target.value);
            setSelectedDestinationFilter('all');
          }}
          className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold"
        >
          <option value="all">All Master Regions ({masterRegions.length})</option>
          {masterRegions.map(r => (
            <option key={r.id} value={r.id}>{r.name} ({r.code})</option>
          ))}
        </select>
        <select
          value={selectedDestinationFilter}
          onChange={e => setSelectedDestinationFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold"
        >
          <option value="all">All Destinations ({availableDestinationsForFilter.length})</option>
          {availableDestinationsForFilter.map(d => (
            <option key={d.id} value={d.id}>{d.name} {d.regionName ? `(${d.regionName})` : ''}</option>
          ))}
        </select>
      </div>

      {/* Grid of City Hubs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredHubs.map(hub => (
          <div key={hub.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
            <div>
              <div className="relative h-44 overflow-hidden">
                <img 
                  src={hub.heroImage} 
                  alt={hub.name} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                />
                <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                  <span className="bg-slate-900/80 backdrop-blur-md text-white text-[11px] font-bold px-2.5 py-1 rounded-lg">
                    {hub.destinationName}
                  </span>
                  {hub.regionName && (
                    <span className="bg-[#00C6A6]/90 backdrop-blur-md text-slate-950 text-[10px] font-extrabold px-2 py-1 rounded-lg flex items-center space-x-1">
                      <Layers className="w-3 h-3" />
                      <span>{hub.regionName}</span>
                    </span>
                  )}
                </div>
                <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm text-slate-900 text-[11px] font-bold px-2 py-0.5 rounded-md border border-slate-200">
                  Order #{hub.displayOrder}
                </div>
              </div>

              <div className="p-5 space-y-3">
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-slate-900">{hub.name}</h3>
                    {hub.regionName && (
                      <span className="text-[10px] bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded">
                        {hub.regionName}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-[#008f77] mt-0.5">{hub.tagline}</p>
                </div>
                <p className="text-xs text-slate-600 line-clamp-2">{hub.description}</p>

                {/* Highlights */}
                {hub.highlights && (hub.highlights || []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {(hub.highlights || []).slice(0, 3).map((h, i) => (
                      <span key={i} className="text-[10px] bg-slate-100 text-slate-700 font-medium px-2 py-0.5 rounded-md">
                        {h}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              {(() => {
                const metrics = countingEngine.getHubMetrics(hub.id || hub.name);
                return (
                  <span className="text-xs font-bold text-slate-500">
                    {metrics.productsCount === 1 ? '1 Tour' : `${metrics.productsCount} Tours`} • {metrics.hotelsCount === 1 ? '1 Stay' : `${metrics.hotelsCount} Stays`}
                  </span>
                );
              })()}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    setEditingHub(hub);
                    setModalTab('CONTENT');
                    setIsEditing(true);
                  }}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 cursor-pointer"
                  title="Edit Hub"
                >
                  <Edit className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(hub.id)}
                  className="p-1.5 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 cursor-pointer"
                  title="Delete Hub"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit / Add Modal */}
      {isEditing && editingHub && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-xl w-full max-h-[94dvh] sm:max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-6 pb-3.5 border-b border-slate-100 shrink-0 bg-white">
              <div>
                <div className="flex items-center space-x-2 text-[#00C6A6] font-bold text-xs uppercase tracking-wider mb-0.5">
                  <Building2 className="w-4 h-4" />
                  <span>Tier 3: City Hub Linkage</span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  {editingHub.name ? `Edit City Hub: ${editingHub.name}` : 'Add New City Hub'}
                </h3>
              </div>
              <button 
                onClick={() => setIsEditing(false)} 
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Context & Subtabs */}
            <div className="p-3 sm:px-6 py-2 bg-slate-50 border-b border-slate-200 shrink-0 space-y-2">
              {/* Live Hierarchy Breadcrumb Preview */}
              <div className="p-2 rounded-lg bg-white border border-slate-200 flex items-center gap-1.5 text-[11px] flex-wrap">
                <span className="font-bold text-slate-400 uppercase text-[9px]">Hierarchy:</span>
                <span className="font-bold text-[#008f77] flex items-center gap-1">
                  <Globe2 className="w-3 h-3" />
                  {editingHub.regionName || 'Select Region'}
                </span>
                <ChevronRight className="w-3 h-3 text-slate-400" />
                <span className="font-bold text-slate-800 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-[#00C6A6]" />
                  {editingHub.destinationName || 'Select Destination'}
                </span>
                <ChevronRight className="w-3 h-3 text-slate-400" />
                <span className="font-bold text-slate-900 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                  {editingHub.name || 'City Hub'}
                </span>
              </div>

              {/* Modal Subtabs */}
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setModalTab('CONTENT')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    modalTab === 'CONTENT' ? 'bg-[#00C6A6] text-slate-950 shadow-xs' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  City Hub Details
                </button>
                <button
                  type="button"
                  onClick={() => setModalTab('SEO')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                    modalTab === 'SEO' ? 'bg-[#00C6A6] text-slate-950 shadow-xs' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <Globe2 className="w-3.5 h-3.5" />
                  <span>SEO & Search Indexing</span>
                </button>
              </div>
            </div>

            <form onSubmit={handleSave} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 modal-body-scroll text-xs">
              {saveError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-800 text-xs">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold block">Action Failed</strong>
                    <span>{saveError}</span>
                  </div>
                </div>
              )}
              {modalTab === 'SEO' ? (
                <EntitySEOSettingsTab
                  entityType="HUB"
                  entity={editingHub}
                  seo={editingHub.seo}
                  onChange={(newSeo) => setEditingHub(prev => prev ? ({
                    ...prev,
                    seo: newSeo,
                    slug: newSeo.slug || prev.slug
                  }) : null)}
                />
              ) : (
                <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Parent Master Region */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    1. Master Region (Tier 1) *
                  </label>
                  <select
                    value={editingHub.regionId || ''}
                    onChange={e => {
                      const regId = e.target.value;
                      const reg = masterRegions.find(r => r.id === regId);
                      setEditingHub({
                        ...editingHub,
                        regionId: regId,
                        regionName: reg?.name || '',
                        destinationId: '',
                        destinationName: ''
                      });
                    }}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold bg-white"
                  >
                    <option value="">-- Select Master Region --</option>
                    {masterRegions.map(r => (
                      <option key={r.id} value={r.id}>{r.name} ({r.id})</option>
                    ))}
                  </select>
                </div>

                {/* 2. Destination */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    2. Destination Country (Tier 2) *
                  </label>
                  <select
                    disabled={!editingHub.regionId}
                    value={editingHub.destinationId || ''}
                    onChange={e => {
                      const destId = e.target.value;
                      const d = destinations.find(dest => dest.id === destId);
                      setEditingHub({ 
                        ...editingHub, 
                        destinationId: destId,
                        destinationName: d?.name || ''
                      });
                    }}
                    className={`w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold bg-white ${!editingHub.regionId ? 'bg-slate-100 cursor-not-allowed opacity-60' : ''}`}
                  >
                    <option value="">{editingHub.regionId ? '-- Select Destination --' : '-- Select Region First --'}</option>
                    {destinations
                      .filter(d => d.regionId === editingHub.regionId)
                      .map(d => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.id})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Sub-Region Selection for Hierarchical Grouping */}
              {(() => {
                const currentDest = destinations.find(d => d.id === editingHub.destinationId);
                const subRegs = currentDest?.regions || [];
                return (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                      <span>3. Sub-Region / Territory (Hierarchical Tag)</span>
                      {subRegs.length > 0 && <span className="text-[10px] text-[#00C6A6] font-bold">Suggested from Destination</span>}
                    </label>
                    {subRegs.length > 0 ? (
                      <div className="space-y-1.5">
                        <select
                          value={editingHub.regionName || ''}
                          onChange={e => {
                            const val = e.target.value;
                            const matched = subRegs.find(sr => sr.name === val || sr.id === val);
                            setEditingHub({
                              ...editingHub,
                              regionName: matched ? matched.name : val,
                              regionId: matched ? matched.id : editingHub.regionId
                            });
                          }}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold bg-white"
                        >
                          <option value="">-- Custom or Top-Level Region --</option>
                          {subRegs.map((sr, srIdx) => (
                            <option key={`subreg-opt-${sr.id || sr.name}-${srIdx}`} value={sr.name}>
                              {sr.name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={editingHub.regionName || ''}
                          onChange={e => setEditingHub({ ...editingHub, regionName: e.target.value })}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600"
                          placeholder="Or type custom sub-region name..."
                        />
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={editingHub.regionName || ''}
                        onChange={e => setEditingHub({ ...editingHub, regionName: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm"
                        placeholder="e.g. Kanto, Kansai, Central Honshu, Bavarian Alps"
                      />
                    )}
                  </div>
                );
              })()}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  4. City / Hub Name (e.g. Tokyo, Kyoto, Osaka, Bangkok) *
                </label>
                <input
                  type="text"
                  required
                  value={editingHub.name || ''}
                  onChange={e => setEditingHub({ ...editingHub, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#00C6A6]"
                  placeholder="e.g. Kyoto"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Tagline / Catchphrase
                </label>
                <input
                  type="text"
                  value={editingHub.tagline || ''}
                  onChange={e => setEditingHub({ ...editingHub, tagline: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm"
                  placeholder="e.g. Imperial Heritage, Zen Gardens & Geisha Quarters"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={editingHub.description || ''}
                  onChange={e => setEditingHub({ ...editingHub, description: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Hero Image URL
                </label>
                <input
                  type="url"
                  value={editingHub.heroImage || ''}
                  onChange={e => setEditingHub({ ...editingHub, heroImage: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Key Highlights (comma-separated)
                </label>
                <input
                  type="text"
                  value={Array.isArray(editingHub.highlights) ? editingHub.highlights.join(', ') : (editingHub.highlights || '')}
                  onChange={e => setEditingHub({ ...editingHub, highlights: e.target.value.split(',').map(s => s.trim()) })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm"
                  placeholder="e.g. Fushimi Inari, Arashiyama Bamboo, Gion Geisha District"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    value={editingHub.displayOrder || 1}
                    onChange={e => setEditingHub({ ...editingHub, displayOrder: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Publishing Status
                  </label>
                  <select
                    value={editingHub.status || 'ACTIVE'}
                    onChange={e => setEditingHub({ ...editingHub, status: e.target.value as any, isPublished: e.target.value === 'ACTIVE' })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold"
                  >
                    <option value="ACTIVE">Published (Active)</option>
                    <option value="DRAFT">Draft</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </div>
              </div>
              </>
              )}
              </div>

              {/* Actions Footer */}
              <div className="flex flex-col sm:flex-row items-center justify-between p-4 sm:px-6 py-3 border-t border-slate-100 bg-white/95 backdrop-blur-xs shrink-0 gap-3">
                <div className="w-full sm:w-auto">
                  {editingHub?.id && cityHubs.some(h => h.id === editingHub.id) && (
                    <button
                      type="button"
                      onClick={() => handleDelete(editingHub.id!)}
                      className="w-full sm:w-auto px-4 py-2 rounded-xl border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 font-bold text-xs cursor-pointer flex items-center justify-center space-x-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete City Hub</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center space-x-2.5 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs cursor-pointer text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#00C6A6] hover:bg-[#00b094] disabled:opacity-50 text-slate-950 font-bold text-xs cursor-pointer shadow-xs flex items-center justify-center space-x-1.5 text-center"
                  >
                    {isSaving ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Persisting...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Save City Hub</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <DeleteConfirmModal
          isOpen={Boolean(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          onSuccess={() => {
            if (editingHub?.id === deleteTarget.id) {
              setIsEditing(false);
              setEditingHub(null);
            }
            setDeleteTarget(null);
            setCityHubs(db.getCityHubs());
          }}
          entityType="CityHub"
          recordId={deleteTarget.id}
          recordTitle={deleteTarget.name}
          user={user}
        />
      )}
    </div>
  );
};
