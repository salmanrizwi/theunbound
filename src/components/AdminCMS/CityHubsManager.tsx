import React, { useState, useEffect } from 'react';
import { AppDatabase } from '../../services/db';
import { CityHub, Destination } from '../../types';
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
  Compass
} from 'lucide-react';

interface CityHubsManagerProps {
  destinations: Destination[];
}

export const CityHubsManager: React.FC<CityHubsManagerProps> = ({ destinations }) => {
  const { user } = useAuth();
  const db = AppDatabase.getInstance();
  const [cityHubs, setCityHubs] = useState<CityHub[]>(db.getCityHubs());
  const [selectedDestinationFilter, setSelectedDestinationFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editingHub, setEditingHub] = useState<Partial<CityHub> | null>(null);

  useEffect(() => {
    return db.subscribe(() => {
      setCityHubs(db.getCityHubs());
    });
  }, []);

  const filteredHubs = cityHubs.filter(hub => {
    const matchesDest = selectedDestinationFilter === 'all' || hub.destinationId === selectedDestinationFilter;
    const matchesSearch = hub.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          hub.tagline.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDest && matchesSearch;
  });

  const handleOpenAdd = () => {
    const firstDest = destinations[0] || { id: 'japan', name: 'Japan' };
    setEditingHub({
      id: `hub-${Date.now()}`,
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
    const completeHub: CityHub = {
      id: editingHub.id || `hub-${Date.now()}`,
      destinationId: editingHub.destinationId,
      destinationName: targetDest?.name || editingHub.destinationName || 'Destination',
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

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2 text-[#00C6A6] font-bold text-xs uppercase tracking-wider mb-1">
            <Building2 className="w-4 h-4" />
            <span>Destination Regional Geography</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">Destination Cities & Hubs Manager</h2>
          <p className="text-sm text-slate-500">
            Structure primary transit and touring hubs (e.g. Tokyo, Kyoto, Osaka, Bangkok, Phuket, London).
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
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by city name or tagline..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-[#00C6A6]"
          />
        </div>
        <select
          value={selectedDestinationFilter}
          onChange={e => setSelectedDestinationFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold"
        >
          <option value="all">All Destinations ({cityHubs.length} hubs)</option>
          {destinations.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
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
                <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-md text-white text-[11px] font-bold px-2.5 py-1 rounded-lg">
                  {hub.destinationName}
                </div>
                <div className="absolute top-3 right-3 bg-[#00C6A6] text-slate-950 text-[11px] font-bold px-2 py-0.5 rounded-md">
                  Order #{hub.displayOrder}
                </div>
              </div>

              <div className="p-5 space-y-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">{hub.name}</h3>
                  <p className="text-xs font-semibold text-[#008f77]">{hub.tagline}</p>
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
              <div className="flex items-center space-x-2 text-[#00C6A6] font-bold text-xs uppercase tracking-wider">
                <Building2 className="w-4 h-4" />
                <span>{editingHub.id ? 'Edit City Hub' : 'Add New City Hub'}</span>
              </div>
              <button 
                onClick={() => setIsEditing(false)} 
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Destination Country / Region
                </label>
                <select
                  value={editingHub.destinationId}
                  onChange={e => {
                    const d = destinations.find(dest => dest.id === e.target.value);
                    setEditingHub({ 
                      ...editingHub, 
                      destinationId: e.target.value,
                      destinationName: d?.name || 'Destination'
                    });
                  }}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold"
                >
                  {destinations.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  City / Hub Name (e.g. Tokyo, Kyoto, Bangkok)
                </label>
                <input
                  type="text"
                  required
                  value={editingHub.name || ''}
                  onChange={e => setEditingHub({ ...editingHub, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm"
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
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Status
                  </label>
                  <select
                    value={editingHub.status || 'ACTIVE'}
                    onChange={e => setEditingHub({ ...editingHub, status: e.target.value as 'ACTIVE' | 'ARCHIVED' })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[#00C6A6] hover:bg-[#00b094] text-slate-950 font-bold text-sm shadow-md shadow-[#00C6A6]/20 cursor-pointer"
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
