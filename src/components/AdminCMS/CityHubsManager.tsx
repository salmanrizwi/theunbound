import React, { useState, useEffect } from 'react';
import { AppDatabase } from '../../services/db';
import { CityHub, Destination, MasterRegion } from '../../types';
import { useAuth } from '../../context/AuthContext';
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
  ChevronRight
} from 'lucide-react';

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
  const [editingHub, setEditingHub] = useState<Partial<CityHub> | null>(null);

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
    const matchesSearch = hub.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (hub.tagline || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (hub.regionName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (hub.destinationName || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesRegion && matchesDest && matchesSearch;
  });

  const handleOpenAdd = () => {
    const firstRegion = masterRegions[0] || { id: 'reg-east-asia', name: 'East Asia' };
    const regionDests = destinations.filter(d => !d.regionId || d.regionId === firstRegion.id);
    const firstDest = regionDests[0] || destinations[0] || { id: 'japan', name: 'Japan', regionId: firstRegion.id, regionName: firstRegion.name };
    
    setEditingHub({
      id: `hub-${Date.now()}`,
      regionId: firstDest.regionId || firstRegion.id,
      regionName: firstDest.regionName || firstRegion.name,
      destinationId: firstDest.id,
      destinationName: firstDest.name,
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
    setIsEditing(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHub || !editingHub.name || !editingHub.destinationId) return;

    const targetDest = destinations.find(d => d.id === editingHub.destinationId);
    const targetRegion = masterRegions.find(r => r.id === (editingHub.regionId || targetDest?.regionId));

    const completeHub: CityHub = {
      id: editingHub.id || `hub-${Date.now()}`,
      destinationId: editingHub.destinationId,
      destinationName: targetDest?.name || editingHub.destinationName || 'Destination',
      regionId: targetRegion?.id || targetDest?.regionId || editingHub.regionId || '',
      regionName: targetRegion?.name || targetDest?.regionName || editingHub.regionName || '',
      name: editingHub.name,
      tagline: editingHub.tagline || '',
      description: editingHub.description || '',
      heroImage: editingHub.heroImage || 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?q=80&w=1200&auto=format&fit=crop',
      images: editingHub.images || [],
      productCount: Number(editingHub.productCount || 0),
      hotelCount: Number(editingHub.hotelCount || 0),
      displayOrder: Number(editingHub.displayOrder || 1),
      highlights: Array.isArray(editingHub.highlights) ? editingHub.highlights : (editingHub.highlights as string || '').split(',').map((s: string) => s.trim()),
      isPublished: editingHub.isPublished !== undefined ? editingHub.isPublished : true,
      status: editingHub.status || 'ACTIVE'
    };

    db.saveCityHub(completeHub, user);
    setIsEditing(false);
    setEditingHub(null);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to remove this city hub?')) {
      db.deleteCityHub(id, user);
    }
  };

  const modalAvailableDestinations = editingHub?.regionId
    ? destinations.filter(d => !d.regionId || d.regionId === editingHub.regionId)
    : destinations;

  return (
    <div className="space-y-6">
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
                {hub.highlights && hub.highlights.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {hub.highlights.slice(0, 3).map((h, i) => (
                      <span key={i} className="text-[10px] bg-slate-100 text-slate-700 font-medium px-2 py-0.5 rounded-md">
                        {h}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">
                {hub.productCount} Services • {hub.hotelCount} Hotels
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    setEditingHub(hub);
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
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
              <div>
                <div className="flex items-center space-x-2 text-[#00C6A6] font-bold text-xs uppercase tracking-wider mb-1">
                  <Building2 className="w-4 h-4" />
                  <span>Tier 3: City Hub Linkage</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  {editingHub.name ? `Edit City Hub: ${editingHub.name}` : 'Add New City Hub'}
                </h3>
              </div>
              <button 
                onClick={() => setIsEditing(false)} 
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Live Hierarchy Breadcrumb Preview */}
            <div className="mb-5 p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2 text-xs flex-wrap">
              <span className="font-bold text-slate-400 uppercase text-[10px]">Hierarchy Path:</span>
              <span className="font-bold text-[#008f77] flex items-center gap-1">
                <Globe2 className="w-3 h-3" />
                {editingHub.regionName || 'Select Region'}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-bold text-slate-800 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-[#00C6A6]" />
                {editingHub.destinationName || 'Select Destination'}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                {editingHub.name || 'City Hub'}
              </span>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
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
                      const matchingDests = destinations.filter(d => !regId || d.regionId === regId);
                      const nextDest = matchingDests[0] || destinations[0];
                      
                      setEditingHub({
                        ...editingHub,
                        regionId: regId,
                        regionName: reg?.name || '',
                        destinationId: nextDest?.id || editingHub.destinationId,
                        destinationName: nextDest?.name || editingHub.destinationName
                      });
                    }}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold bg-white"
                  >
                    <option value="" disabled>-- Select Master Region --</option>
                    {masterRegions.map(r => (
                      <option key={r.id} value={r.id}>{r.name} ({r.code})</option>
                    ))}
                  </select>
                </div>

                {/* 2. Destination */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    2. Destination Country (Tier 2) *
                  </label>
                  <select
                    value={editingHub.destinationId}
                    onChange={e => {
                      const destId = e.target.value;
                      const d = destinations.find(dest => dest.id === destId);
                      const parentReg = masterRegions.find(r => r.id === d?.regionId);
                      
                      setEditingHub({ 
                        ...editingHub, 
                        destinationId: destId,
                        destinationName: d?.name || 'Destination',
                        regionId: d?.regionId || parentReg?.id || editingHub.regionId || '',
                        regionName: d?.regionName || parentReg?.name || editingHub.regionName || ''
                      });
                    }}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold bg-white"
                  >
                    {modalAvailableDestinations.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name} {d.regionName ? `(${d.regionName})` : ''}
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
                          {subRegs.map(sr => (
                            <option key={sr.id} value={sr.name}>
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

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[#00C6A6] hover:bg-[#00b094] text-slate-950 font-bold text-sm cursor-pointer shadow-md shadow-[#00C6A6]/20"
                >
                  Save City Hub
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
