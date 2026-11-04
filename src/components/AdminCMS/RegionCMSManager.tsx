import React, { useState, useEffect, useMemo } from 'react';
import {
  Globe2,
  Plus,
  Search,
  Edit3,
  Trash2,
  Layers,
  Package,
  CheckCircle2,
  AlertCircle,
  Compass,
  FolderTree
} from 'lucide-react';
import { Destination, DestinationRegionItem, CityHub, Product } from '../../types';
import { AppDatabase } from '../../services/db';
import { MasterDataService } from '../../services/masterDataService';
import { useAuth } from '../../context/AuthContext';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { MasterDataDiagnosticBanner } from './MasterDataDiagnosticBanner';

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
  const masterData = MasterDataService.getInstance();

  const [regions, setRegions] = useState<DestinationRegionItem[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [cityHubs, setCityHubs] = useState<CityHub[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [destinationFilter, setDestinationFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [selectedRegion, setSelectedRegion] = useState<DestinationRegionItem | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const [formData, setFormData] = useState<Partial<DestinationRegionItem>>({
    name: '',
    slug: '',
    destinationId: '',
    destinationName: '',
    description: '',
    heroImage: '',
    orderIndex: 1,
    status: 'ACTIVE',
    isActive: true
  });

  const loadData = () => {
    setRegions(db.getRegions());
    setDestinations(db.getDestinations());
    setCityHubs(db.getCityHubs());
    setProducts(db.getProducts());
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

  const getRegionStats = (reg: DestinationRegionItem) => {
    const parentDest = destinations.find(d => d.id === reg.destinationId);
    const linkedHubs = cityHubs.filter(h => h.regionId === reg.id && h.destinationId === reg.destinationId);
    const linkedProds = masterData.getProductsByRegionId(reg.id, false);
    const isOrphaned = !parentDest;

    return {
      parentDest,
      isOrphaned,
      hubsCount: linkedHubs.length,
      productsCount: linkedProds.length,
      linkedHubs
    };
  };

  const filteredRegions = useMemo(() => {
    return regions
      .filter(r => {
        if (destinationFilter !== 'ALL' && r.destinationId !== destinationFilter) return false;
        if (statusFilter !== 'ALL') {
          const effectiveStatus = r.status || (r.isActive === false ? 'INACTIVE' : 'ACTIVE');
          if (effectiveStatus !== statusFilter) return false;
        }
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase().trim();
          const inName = (r.name || '').toLowerCase().includes(q);
          const inDest = (r.destinationName || '').toLowerCase().includes(q);
          const inId = (r.id || '').toLowerCase().includes(q);
          if (!inName && !inDest && !inId) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.destinationId !== b.destinationId) {
          return (a.destinationName || a.destinationId).localeCompare(b.destinationName || b.destinationId);
        }
        return (a.orderIndex || 0) - (b.orderIndex || 0);
      });
  }, [regions, destinationFilter, statusFilter, searchTerm]);

  const handleCreateNew = () => {
    setSaveError(null);
    const defaultDest =
      (destinationFilter !== 'ALL' ? destinations.find(d => d.id === destinationFilter) : undefined) ||
      destinations.find(d => d.status === 'ACTIVE') ||
      destinations[0];

    setFormData({
      id: '',
      name: '',
      slug: '',
      destinationId: defaultDest?.id || '',
      destinationName: defaultDest?.name || '',
      description: '',
      heroImage: '',
      orderIndex: regions.filter(r => r.destinationId === defaultDest?.id).length + 1,
      status: 'ACTIVE',
      isActive: true
    });
    setSelectedRegion(null);
    setIsCreating(true);
    setIsEditing(true);
  };

  const handleEdit = (reg: DestinationRegionItem) => {
    setSaveError(null);
    setFormData({
      ...reg,
      status: reg.status || (reg.isActive === false ? 'INACTIVE' : 'ACTIVE')
    });
    setSelectedRegion(reg);
    setIsCreating(false);
    setIsEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);

    if (!formData.name?.trim()) {
      setSaveError('Region name is required.');
      return;
    }
    if (!formData.destinationId?.trim()) {
      setSaveError('Parent Destination is required. Every Region must belong to an existing Destination.');
      return;
    }

    setIsSaving(true);
    try {
      const parentDest = destinations.find(d => d.id === formData.destinationId);
      if (!parentDest) {
        throw new Error(`Selected Destination "${formData.destinationId}" does not exist.`);
      }

      const cleanName = formData.name.trim();
      const cleanSlug = (formData.slug || cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-')).trim();
      const regId =
        isCreating && !formData.id
          ? `region-${parentDest.slug || parentDest.id.toLowerCase()}-${cleanSlug}`
          : (formData.id || `region-${cleanSlug}`);

      const recordToSave: DestinationRegionItem = {
        id: regId,
        name: cleanName,
        slug: cleanSlug,
        destinationId: parentDest.id,
        destinationName: parentDest.name,
        description: formData.description || '',
        heroImage: formData.heroImage || '',
        orderIndex: Number(formData.orderIndex) || 1,
        status: (formData.status as any) || 'ACTIVE',
        isActive: (formData.status || 'ACTIVE') === 'ACTIVE'
      };

      await db.saveRegionAsync(recordToSave, user);
      loadData();
      setIsEditing(false);
      setIsCreating(false);
      setSelectedRegion(recordToSave);
      setSaveSuccessMsg(`Region "${recordToSave.name}" saved under ${parentDest.name}.`);
      setTimeout(() => setSaveSuccessMsg(null), 3500);
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to save Region.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setSaveError(null);
    try {
      await db.deleteRegionAsync(deleteTarget.id, user);
      loadData();
      if (selectedRegion?.id === deleteTarget.id) {
        setSelectedRegion(null);
      }
      setSaveSuccessMsg(`Region "${deleteTarget.name}" deleted.`);
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to delete Region.');
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      <MasterDataDiagnosticBanner />

      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-[#008972] mb-1">
            <FolderTree className="w-4 h-4" />
            <span>Tier 2 Geographical Hierarchy: Destination → Region → Hub → Products</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Destination Regions Management</h2>
          <p className="text-sm text-slate-500 mt-1">
            Every Region belongs strictly to a parent Destination and groups City Hubs and Products within that Destination.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {onNavigateToDestinations && (
            <button
              type="button"
              onClick={() => onNavigateToDestinations()}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold flex items-center space-x-2 cursor-pointer"
            >
              <Compass className="w-4 h-4 text-slate-500" />
              <span>1. Destinations ({destinations.length})</span>
            </button>
          )}
          {onNavigateToHubs && (
            <button
              type="button"
              onClick={() => onNavigateToHubs()}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold flex items-center space-x-2 cursor-pointer"
            >
              <Layers className="w-4 h-4 text-slate-500" />
              <span>3. City Hubs ({cityHubs.length})</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleCreateNew}
            className="px-5 py-2.5 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-bold flex items-center space-x-2 shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Region</span>
          </button>
        </div>
      </div>

      {saveSuccessMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl text-xs font-bold flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {saveError && !isEditing && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-2xl text-xs font-bold flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search region by name, ID, or parent destination..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#00C6A6]/30"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={destinationFilter}
            onChange={e => setDestinationFilter(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white"
          >
            <option value="ALL">All Destinations ({destinations.length})</option>
            {destinations.map(d => (
              <option key={d.id} value={d.id}>
                {d.name} ({regions.filter(r => r.destinationId === d.id).length} Regions)
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Regions Table */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
        {filteredRegions.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Globe2 className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">No Regions Found</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              No regions match your current filter criteria. Select another destination or add a new region.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-4">Region</th>
                  <th className="py-3.5 px-4">Parent Destination</th>
                  <th className="py-3.5 px-4">Associated City Hubs</th>
                  <th className="py-3.5 px-4 text-center">Products</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredRegions.map(reg => {
                  const stats = getRegionStats(reg);
                  const isActive = reg.status !== 'INACTIVE' && reg.isActive !== false;
                  return (
                    <tr key={reg.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{reg.name}</div>
                        <div className="text-[11px] font-mono text-slate-400">{reg.id}</div>
                        {reg.description && (
                          <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5 max-w-xs">{reg.description}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {stats.isOrphaned ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[11px]">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>Orphaned ({reg.destinationId || 'None'})</span>
                          </span>
                        ) : (
                          <div>
                            <div className="font-bold text-slate-800">{stats.parentDest?.name || reg.destinationName}</div>
                            <div className="text-[10px] font-mono text-slate-400">{reg.destinationId}</div>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[11px]">
                            {stats.hubsCount} {stats.hubsCount === 1 ? 'Hub' : 'Hubs'}
                          </span>
                          {stats.linkedHubs.slice(0, 4).map(h => (
                            <span
                              key={h.id}
                              className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200/60 text-[11px] font-medium"
                            >
                              {h.name}
                            </span>
                          ))}
                          {stats.linkedHubs.length > 4 && (
                            <span className="text-[11px] text-slate-400 font-semibold">
                              +{stats.linkedHubs.length - 4} more
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 font-bold">
                          <Package className="w-3.5 h-3.5 text-slate-500" />
                          <span>{stats.productsCount}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {isActive ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center space-x-1.5">
                          <button
                            type="button"
                            onClick={() => handleEdit(reg)}
                            className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                            title="Edit Region"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget({ id: reg.id, name: reg.name })}
                            className="p-2 rounded-lg text-rose-600 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                            title="Delete Region"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {isCreating ? 'Create Region Under Destination' : `Edit Region: ${formData.name}`}
                </h3>
                <p className="text-xs text-slate-500">
                  Every region must reference an existing parent Destination.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setIsCreating(false);
                  setSaveError(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              {saveError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{saveError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Parent Destination *
                </label>
                <select
                  required
                  value={formData.destinationId || ''}
                  onChange={e => {
                    const dest = destinations.find(d => d.id === e.target.value);
                    setFormData(prev => ({
                      ...prev,
                      destinationId: e.target.value,
                      destinationName: dest?.name || ''
                    }));
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white"
                >
                  <option value="">Select Parent Destination...</option>
                  {destinations.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Region Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name || ''}
                    onChange={e =>
                      setFormData(prev => ({
                        ...prev,
                        name: e.target.value,
                        slug: isCreating
                          ? e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-')
                          : prev.slug
                      }))
                    }
                    placeholder="e.g. Kanto"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Region Slug
                  </label>
                  <input
                    type="text"
                    value={formData.slug || ''}
                    onChange={e => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                    placeholder="e.g. kanto"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status || 'ACTIVE'}
                    onChange={e =>
                      setFormData(prev => ({
                        ...prev,
                        status: e.target.value as any,
                        isActive: e.target.value === 'ACTIVE'
                      }))
                    }
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formData.orderIndex || 1}
                    onChange={e => setFormData(prev => ({ ...prev, orderIndex: Number(e.target.value) || 1 }))}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={formData.description || ''}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief regional overview..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setIsCreating(false);
                    setSaveError(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-[#008972] hover:bg-[#007662] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : isCreating ? 'Create Region' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          isOpen={Boolean(deleteTarget)}
          title="Delete Region"
          itemName={deleteTarget.name}
          entityType="MasterRegion"
          onConfirm={handleConfirmDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
};
