import React, { useState, useEffect } from 'react';
import { Destination, DestinationRegion, CurrencyCode, MasterRegion, CityHub } from '../../types';
import { AppDatabase } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { 
  MapPin, 
  Plus, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  Globe2, 
  Sparkles, 
  Search,
  ExternalLink,
  Layers,
  Image as ImageIcon,
  Compass,
  Clock,
  Building2,
  Filter,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { EntitySEOSettingsTab } from './EntitySEOSettingsTab';
import { MasterDataDiagnosticBanner } from './MasterDataDiagnosticBanner';

interface DestinationCMSManagerProps {
  onSelectDestination?: (slug: string) => void;
  onNavigateToHubs?: (destinationId?: string) => void;
  onNavigateToRegions?: () => void;
  initialRegionFilter?: string;
}

export const DestinationCMSManager: React.FC<DestinationCMSManagerProps> = ({ 
  onSelectDestination,
  onNavigateToHubs,
  onNavigateToRegions,
  initialRegionFilter = 'ALL'
}) => {
  const db = AppDatabase.getInstance();
  const { user } = useAuth();
  const [destinations, setDestinations] = useState<Destination[]>(() => db.getDestinations());
  const [masterRegions, setMasterRegions] = useState<MasterRegion[]>(() => db.getMasterRegions());
  const [cityHubs, setCityHubs] = useState<CityHub[]>(() => db.getCityHubs());
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegionFilter, setSelectedRegionFilter] = useState<string>(initialRegionFilter);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'CONTENT' | 'SEO'>('CONTENT');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [editingDest, setEditingDest] = useState<Destination | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<Destination>>({
    name: '',
    slug: '',
    country: '',
    regionId: '',
    regionName: '',
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
    setMasterRegions(db.getMasterRegions());
    setCityHubs(db.getCityHubs());
  };

  useEffect(() => {
    refresh();
    const unsub = db.subscribe(() => {
      refresh();
    });
    return () => unsub();
  }, [db]);

  const handleOpenCreate = () => {
    setSaveError(null);
    const activeMasterRegions = masterRegions.filter(r => r.status === 'ACTIVE');
    const defaultRegion = activeMasterRegions[0] || masterRegions[0];
    setEditingDest(null);
    setModalTab('CONTENT');
    setFormData({
      name: '',
      slug: '',
      country: '',
      regionId: defaultRegion ? defaultRegion.id : '',
      regionName: defaultRegion ? defaultRegion.name : '',
      region: 'JAPAN',
      heroImage: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1600&auto=format&fit=crop',
      heroImageAlt: 'Destination Ground Operations',
      heroOverlayOpacity: 0.65,
      heroEyebrow: 'DMC PREMIER PORTFOLIO • DIRECT GROUND OPERATIONS',
      heroTitle: '',
      showPrimaryCta: true,
      primaryCtaText: 'Explore Curated Inventory',
      showSecondaryCta: true,
      secondaryCtaText: 'Direct DMC Operations Desk',
      trustBadgeText: 'Direct Ground Operator • Verified Local Network',
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
    setSaveError(null);
    setEditingDest(dest);
    setModalTab('CONTENT');
    setFormData({ ...dest });
    setIsModalOpen(true);
  };

  const handleRegionSelect = (regId: string) => {
    const reg = masterRegions.find(r => r.id === regId);
    setFormData(prev => ({
      ...prev,
      regionId: regId,
      regionName: reg?.name || ''
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);

    if (!formData.name?.trim()) {
      setSaveError('Destination Name is required.');
      return;
    }

    if (!formData.regionId?.trim()) {
      setSaveError('Parent Master Region is required. Please select a Master Region.');
      return;
    }

    const matchedRegion = masterRegions.find(r => r.id === formData.regionId);
    if (!matchedRegion) {
      setSaveError('Selected Master Region was not found. Please select a valid Master Region.');
      return;
    }

    const slug = (formData.slug?.trim() || formData.name || 'destination').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const destToSave: Destination = {
      id: editingDest ? editingDest.id : `dest-${slug}`,
      name: formData.name.trim(),
      slug,
      country: formData.country?.trim() || formData.name.trim(),
      regionId: matchedRegion.id,
      regionName: matchedRegion.name,
      region: (formData.region as DestinationRegion) || 'JAPAN',
      heroImage: formData.heroImage || 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1600&auto=format&fit=crop',
      heroImageAlt: formData.heroImageAlt || `${formData.name || 'Destination'} Travel Ground Operations`,
      heroOverlayOpacity: formData.heroOverlayOpacity ?? 0.65,
      heroEyebrow: formData.heroEyebrow || '',
      heroTitle: formData.heroTitle || '',
      showPrimaryCta: formData.showPrimaryCta !== false,
      primaryCtaText: formData.primaryCtaText || 'Explore Curated Inventory',
      showSecondaryCta: formData.showSecondaryCta !== false,
      secondaryCtaText: formData.secondaryCtaText || 'Direct DMC Operations Desk',
      trustBadgeText: formData.trustBadgeText || 'Direct Ground Operator • Verified Local Network',
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
      status: formData.status || 'ACTIVE',
      seo: formData.seo
    };

    setIsSaving(true);
    try {
      await db.saveDestinationAsync(destToSave, user);
      refresh();
      setIsModalOpen(false);
      setSaveSuccessMsg(`Destination "${destToSave.name}" successfully saved to Firestore!`);
      setTimeout(() => setSaveSuccessMsg(null), 5000);
    } catch (err: any) {
      console.error('[DestinationCMS] Save error:', err);
      setSaveError(err?.message || 'Failed to save Destination to Firestore.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (destId: string) => {
    const target = destinations.find(d => d.id === destId || d.slug === destId) || (editingDest?.id === destId ? editingDest : null);
    const targetName = target ? target.name : 'Destination';
    setDeleteTarget({ id: destId, name: targetName });
  };

  const handleToggleStatus = async (dest: Destination) => {
    const nextStatus = dest.status === 'ACTIVE' ? 'COMING_SOON' : 'ACTIVE';
    try {
      await db.saveDestinationAsync({ ...dest, status: nextStatus }, user);
      refresh();
    } catch (err: any) {
      console.error('[DestinationCMS] Toggle status error:', err);
    }
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

  const filtered = destinations.filter(d => {
    const matchSearch = d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        d.country.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        d.regionName?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchRegion = selectedRegionFilter === 'ALL' || d.regionId === selectedRegionFilter;
    return matchSearch && matchRegion;
  });

  return (
    <div className="space-y-6">
      <MasterDataDiagnosticBanner />

      {saveSuccessMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-sm font-semibold shadow-xs animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2 text-amber-600 text-xs font-bold uppercase tracking-wider mb-1">
            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
              Tier 2 Entity
            </span>
            <span>Hierarchy: 1. REGION ↓ 2. DESTINATION</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-amber-600" />
            Destinations & Country Hubs Manager
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Every destination is linked to a Master Region (Tier 1) and acts as the parent container for City Hubs (Tier 3).
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onNavigateToRegions && (
            <button
              onClick={onNavigateToRegions}
              className="inline-flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer"
            >
              <Globe2 className="w-4 h-4 text-amber-600" />
              <span>Manage Regions</span>
            </button>
          )}
          <button
            onClick={handleOpenCreate}
            id="btn-add-destination"
            className="inline-flex items-center space-x-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-sm cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Destination</span>
          </button>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search destination by name, country, region..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={selectedRegionFilter}
            onChange={(e) => setSelectedRegionFilter(e.target.value)}
            className="text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          >
            <option value="ALL">All Master Regions ({destinations.length})</option>
            {masterRegions.map(reg => (
              <option key={reg.id} value={reg.id}>
                {reg.name} ({reg.code})
              </option>
            ))}
          </select>

          <button
            onClick={refresh}
            title="Refresh Destinations"
            className="p-2 rounded-lg bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grid of Destination Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(dest => {
          const linkedHubs = cityHubs.filter(h => h.destinationId === dest.id);
          const parentRegion = masterRegions.find(r => r.id === dest.regionId) || { name: dest.regionName || dest.region };

          return (
            <div 
              key={dest.id} 
              id={`destination-card-${dest.id}`}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="relative h-44 overflow-hidden bg-slate-900 group">
                  <img
                    src={dest.heroImage}
                    alt={dest.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
                  
                  {/* Master Region Badge */}
                  <div className="absolute top-3 left-3">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900/90 text-amber-300 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm border border-amber-500/30">
                      <Globe2 className="w-3 h-3 text-amber-400" />
                      {parentRegion.name}
                    </span>
                  </div>

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
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                      {dest.country} • {dest.currency}
                    </span>
                    <h3 className="text-lg font-bold text-white">{dest.name}</h3>
                  </div>
                </div>

                <div className="p-5 space-y-3 text-xs text-slate-600">
                  <p className="line-clamp-2 text-slate-700 italic font-serif">
                    "{dest.tagline || dest.description}"
                  </p>

                  <div className="space-y-1.5 pt-2 border-t border-slate-100 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Parent Region (Tier 1):</span>
                      <span className="font-semibold text-amber-700">{parentRegion.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Best Season:</span>
                      <span className="font-semibold text-slate-800">{dest.bestTimeToVisit}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Duration:</span>
                      <span className="font-semibold text-slate-800">{dest.idealTripDuration}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">City Hubs (Tier 3):</span>
                      <span className="font-bold text-sky-700">{linkedHubs.length} Managed Hubs</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] font-mono text-slate-400">slug: /{dest.slug}</span>

                <div className="flex items-center space-x-2">
                  {onNavigateToHubs && (
                    <button
                      onClick={() => onNavigateToHubs(dest.id)}
                      className="px-2 py-1 text-slate-700 hover:bg-slate-200 bg-white border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
                      title="Manage City Hubs in this destination"
                    >
                      <Building2 className="w-3.5 h-3.5 text-sky-600" />
                      <span>Hubs ({linkedHubs.length})</span>
                    </button>
                  )}
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
          );
        })}
      </div>

      {/* Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-3xl w-full max-h-[94dvh] sm:max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 p-4 sm:p-6 pb-4 shrink-0 bg-white">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900">
                    Tier 2: Destination
                  </span>
                  <span className="text-[11px] text-slate-400">Child of Master Region</span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  {editingDest ? `Edit Destination: ${editingDest.name}` : 'Add New Destination'}
                </h3>
                <p className="text-xs text-slate-500">Configure Master Region parent linkage, country details, hero imagery, and selling points.</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 sm:p-2 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Subtabs */}
            <div className="flex items-center space-x-2 border-b border-slate-200 px-4 sm:px-6 py-2.5 bg-slate-50 shrink-0 overflow-x-auto">
              <button
                type="button"
                onClick={() => setModalTab('CONTENT')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  modalTab === 'CONTENT' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                Content & Highlights
              </button>
              <button
                type="button"
                onClick={() => setModalTab('SEO')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 whitespace-nowrap ${
                  modalTab === 'SEO' ? 'bg-[#008972] text-white shadow-xs' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Globe2 className="w-3.5 h-3.5" />
                <span>SEO & Indexing</span>
              </button>
            </div>

            <form onSubmit={handleSave} className="flex-1 flex flex-col overflow-hidden text-xs">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 modal-body-scroll">
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
                  entityType="DESTINATION"
                  entity={formData}
                  seo={formData.seo}
                  onChange={(newSeo) => setFormData(prev => ({ ...prev, seo: newSeo, slug: newSeo.slug || prev.slug }))}
                />
              ) : (
                <>
                  {/* Hierarchy Selection - Parent Master Region */}
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-amber-900 uppercase tracking-wider">
                    1. Parent Master Region (Tier 1) *
                  </label>
                  {masterRegions.length === 0 && onNavigateToRegions && (
                    <button
                      type="button"
                      onClick={() => { setIsModalOpen(false); onNavigateToRegions(); }}
                      className="text-[11px] font-bold text-amber-800 underline hover:text-amber-950"
                    >
                      Create Master Region First →
                    </button>
                  )}
                </div>

                {masterRegions.length === 0 ? (
                  <div className="p-3 bg-amber-100/70 border border-amber-300 rounded-xl text-amber-900 text-xs font-medium">
                    No Master Regions exist in Firestore. Destinations require a parent Master Region. Please create a Master Region first.
                  </div>
                ) : (
                  <select
                    required
                    value={formData.regionId || ''}
                    onChange={(e) => handleRegionSelect(e.target.value)}
                    className="w-full p-2.5 bg-white border border-amber-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  >
                    <option value="" disabled>Select Master Region...</option>
                    {masterRegions.map(reg => (
                      <option key={reg.id} value={reg.id}>
                        {reg.name} ({reg.code}) — {reg.tagline || reg.description?.slice(0, 40)}
                      </option>
                    ))}
                  </select>
                )}
                <div className="text-[11px] text-amber-800 mt-1">
                  Selected Parent: <span className="font-bold">{formData.regionName || 'None'}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Destination / Country Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name || ''}
                    onChange={e => {
                      const name = e.target.value;
                      setFormData(prev => ({
                        ...prev,
                        name,
                        country: prev.country ? prev.country : name,
                        slug: prev.slug ? prev.slug : name.toLowerCase().replace(/\s+/g, '-')
                      }));
                    }}
                    placeholder="e.g. Japan, United Kingdom, Switzerland"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-amber-500"
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
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    <option value="AED">AED (AED)</option>
                    <option value="THB">THB (฿)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Publish Status</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value as 'ACTIVE' | 'COMING_SOON' })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="ACTIVE">Active (Live on Website)</option>
                    <option value="COMING_SOON">Coming Soon</option>
                  </select>
                </div>
              </div>

              {/* Hero Banner CMS & DMC Positioning Suite */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                <div className="flex items-center space-x-2 text-slate-800 font-bold border-b border-slate-200 pb-2">
                  <ImageIcon className="w-4 h-4 text-amber-600" />
                  <span>Destination Hero Banner & DMC Presentation</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Hero Operational Eyebrow</label>
                    <input
                      type="text"
                      value={formData.heroEyebrow || ''}
                      onChange={e => setFormData({ ...formData, heroEyebrow: e.target.value })}
                      placeholder="e.g. DMC PREMIER PORTFOLIO • DIRECT GROUND OPERATIONS"
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Custom Hero Title (H1 Override)</label>
                    <input
                      type="text"
                      value={formData.heroTitle || ''}
                      onChange={e => setFormData({ ...formData, heroTitle: e.target.value })}
                      placeholder={`Defaults to: Explore ${formData.name || 'Destination'}`}
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Hero Image URL</label>
                  <input
                    type="url"
                    value={formData.heroImage || ''}
                    onChange={e => setFormData({ ...formData, heroImage: e.target.value })}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl font-mono text-xs"
                  />
                  {formData.heroImage && (
                    <div className="mt-2 h-24 rounded-xl overflow-hidden border border-slate-200 relative">
                      <img src={formData.heroImage} alt="Preview" className="w-full h-full object-cover" />
                      <div
                        className="absolute inset-0 bg-slate-950 pointer-events-none"
                        style={{ opacity: formData.heroOverlayOpacity ?? 0.65 }}
                      />
                      <span className="absolute bottom-2 left-2 text-[10px] font-bold text-white bg-slate-900/80 px-2 py-0.5 rounded backdrop-blur-sm">
                        Overlay: {Math.round((formData.heroOverlayOpacity ?? 0.65) * 100)}%
                      </span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Hero Image Alt Text (SEO & Alt)</label>
                    <input
                      type="text"
                      value={formData.heroImageAlt || ''}
                      onChange={e => setFormData({ ...formData, heroImageAlt: e.target.value })}
                      placeholder={`e.g. ${formData.name || 'Destination'} Travel Ground Operations`}
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Backdrop Overlay Density</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Light (45%)', val: 0.45 },
                        { label: 'Balanced (65%)', val: 0.65 },
                        { label: 'Deep (80%)', val: 0.80 }
                      ].map(opt => (
                        <button
                          key={opt.val}
                          type="button"
                          onClick={() => setFormData({ ...formData, heroOverlayOpacity: opt.val })}
                          className={`py-1.5 px-2 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                            (formData.heroOverlayOpacity ?? 0.65) === opt.val
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Operational Trust Badge Text</label>
                  <input
                    type="text"
                    value={formData.trustBadgeText || ''}
                    onChange={e => setFormData({ ...formData, trustBadgeText: e.target.value })}
                    placeholder="e.g. Direct Ground Operator • Verified Local Network"
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-amber-700"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="font-semibold text-slate-700">Primary CTA Button</label>
                      <label className="flex items-center space-x-1 text-[11px] text-slate-500 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.showPrimaryCta !== false}
                          onChange={e => setFormData({ ...formData, showPrimaryCta: e.target.checked })}
                          className="rounded text-amber-600 focus:ring-amber-500"
                        />
                        <span>Show</span>
                      </label>
                    </div>
                    <input
                      type="text"
                      value={formData.primaryCtaText || ''}
                      onChange={e => setFormData({ ...formData, primaryCtaText: e.target.value })}
                      placeholder="e.g. Explore Curated Inventory"
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="font-semibold text-slate-700">Secondary CTA Button</label>
                      <label className="flex items-center space-x-1 text-[11px] text-slate-500 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.showSecondaryCta !== false}
                          onChange={e => setFormData({ ...formData, showSecondaryCta: e.target.checked })}
                          className="rounded text-amber-600 focus:ring-amber-500"
                        />
                        <span>Show</span>
                      </label>
                    </div>
                    <input
                      type="text"
                      value={formData.secondaryCtaText || ''}
                      onChange={e => setFormData({ ...formData, secondaryCtaText: e.target.value })}
                      placeholder="e.g. Direct DMC Operations Desk"
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                    />
                  </div>
                </div>
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

              {/* Selling Points & Highlights */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="font-semibold text-slate-700">Key Selling Points (B2B Highlights)</label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={sellingPointInput}
                    onChange={e => setSellingPointInput(e.target.value)}
                    placeholder="Add an operational selling point..."
                    className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSellingPoint(); }}}
                  />
                  <button
                    type="button"
                    onClick={addSellingPoint}
                    className="px-3 bg-slate-900 text-white rounded-lg font-bold text-xs hover:bg-slate-800 cursor-pointer"
                  >
                    Add
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {formData.keySellingPoints?.map((sp, idx) => (
                    <span key={idx} className="inline-flex items-center space-x-1 px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-md text-[11px]">
                      <span>{sp}</span>
                      <button type="button" onClick={() => removeSellingPoint(idx)} className="text-amber-500 hover:text-amber-700 ml-1 cursor-pointer">×</button>
                    </span>
                  ))}
                </div>
              </div>
              </>
              )}
              </div>

              {/* Action Buttons Footer */}
              <div className="flex flex-col sm:flex-row items-center justify-between p-4 sm:px-6 py-3 border-t border-slate-100 bg-white/95 backdrop-blur-xs shrink-0 gap-3">
                <div className="w-full sm:w-auto">
                  {editingDest?.id && (
                    <button
                      type="button"
                      onClick={() => handleDelete(editingDest.id)}
                      className="w-full sm:w-auto px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs rounded-xl flex items-center justify-center space-x-1.5 transition-colors cursor-pointer border border-red-200"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Destination</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center space-x-2.5 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="w-full sm:w-auto px-5 py-2.5 border border-slate-200 rounded-xl text-slate-600 font-semibold hover:bg-slate-50 cursor-pointer text-xs text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full sm:w-auto px-6 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl shadow-xs transition-all cursor-pointer text-xs flex items-center justify-center space-x-1.5 text-center"
                  >
                    {isSaving ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Persisting...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{editingDest ? 'Save Destination' : 'Create Destination'}</span>
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
            if (editingDest?.id === deleteTarget.id) {
              setIsModalOpen(false);
              setEditingDest(null);
            }
            setDeleteTarget(null);
            refresh();
          }}
          entityType="Destination"
          recordId={deleteTarget.id}
          recordTitle={deleteTarget.name}
          user={user}
        />
      )}
    </div>
  );
};
