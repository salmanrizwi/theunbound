import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AppDatabase } from '../../services/db';
import { GalleryImage } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { 
  uploadGalleryImage, 
  deleteGalleryStorageFile, 
  validateGalleryImageFile 
} from '../../services/galleryStorageService';
import { 
  Camera, 
  Plus, 
  Trash2, 
  Edit3, 
  Save, 
  X, 
  Tag as TagIcon, 
  CheckCircle2, 
  Upload, 
  ArrowUp, 
  ArrowDown, 
  Search, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  AlertCircle, 
  Loader2, 
  Image as ImageIcon,
  Check,
  Filter,
  Sparkles,
  MapPin,
  User,
  Sliders
} from 'lucide-react';

interface HappyCustomerGalleryManagerProps {
  onBackToSequence?: () => void;
  isEmbedded?: boolean;
}

const COMMON_TAG_SUGGESTIONS = [
  'Japan',
  'Tokyo',
  'Kyoto',
  'Osaka',
  'Hakone',
  'Hokkaido',
  'United Kingdom',
  'London',
  'Scotland',
  'Europe',
  'Family Travel',
  'Couple Travel',
  'Group Travel',
  'Luxury Travel',
  'Honeymoon',
  'VIP Guide',
  'Cultural Masterclass',
  'Private Chauffeur',
  'Customer Experience'
];

export const HappyCustomerGalleryManager: React.FC<HappyCustomerGalleryManagerProps> = ({
  onBackToSequence,
  isEmbedded = false
}) => {
  const { user } = useAuth();
  const db = AppDatabase.getInstance();
  const [gallery, setGallery] = useState<GalleryImage[]>(() => db.getGalleryImages());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTagFilter, setSelectedTagFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Edit / Add Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<GalleryImage> | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');

  // Multi-upload state
  const [isBatchUploading, setIsBatchUploading] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [batchNotice, setBatchNotice] = useState<string | null>(null);
  const multiFileInputRef = useRef<HTMLInputElement>(null);
  const singleReplaceInputRef = useRef<HTMLInputElement>(null);
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null);

  // Success / notice toast
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  useEffect(() => {
    return db.subscribe(() => {
      setGallery(db.getGalleryImages());
    });
  }, []);

  const showNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3500);
  };

  // Extract all existing unique tags across gallery
  const existingTags = useMemo(() => {
    const set = new Set<string>();
    gallery.forEach(img => {
      if (Array.isArray(img.tags)) {
        img.tags.forEach(t => {
          if (t && t.trim()) set.add(t.trim());
        });
      }
    });
    return Array.from(set).sort();
  }, [gallery]);

  // Combined tag suggestions (existing tags + standard suggestions)
  const availableTagSuggestions = useMemo(() => {
    const combined = new Set([...COMMON_TAG_SUGGESTIONS, ...existingTags]);
    return Array.from(combined);
  }, [existingTags]);

  // Filtered gallery items
  const filteredGallery = useMemo(() => {
    return gallery.filter(item => {
      // Status filter
      const isActive = item.isActive !== false && item.isPublished !== false;
      if (statusFilter === 'ACTIVE' && !isActive) return false;
      if (statusFilter === 'INACTIVE' && isActive) return false;

      // Tag filter
      if (selectedTagFilter !== 'ALL') {
        const itemTags = (item.tags || []).map(t => t.toLowerCase());
        if (!itemTags.includes(selectedTagFilter.toLowerCase())) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchCustomer = (item.customerName || '').toLowerCase().includes(q);
        const matchDest = (item.destination || '').toLowerCase().includes(q);
        const matchDesc = (item.description || item.caption || '').toLowerCase().includes(q);
        const matchTitle = (item.title || '').toLowerCase().includes(q);
        const matchTags = (item.tags || []).some(t => t.toLowerCase().includes(q));
        if (!matchCustomer && !matchDest && !matchDesc && !matchTitle && !matchTags) {
          return false;
        }
      }

      return true;
    });
  }, [gallery, statusFilter, selectedTagFilter, searchQuery]);

  // ----------------------------------------------------
  // CRUD: OPEN ADD
  // ----------------------------------------------------
  const handleOpenAdd = () => {
    setFormError(null);
    setTagInput('');
    setEditingItem({
      id: `gal-${Date.now()}`,
      imageUrl: '',
      title: '',
      caption: '',
      description: '',
      customerName: '',
      destination: 'Japan (Tokyo & Kyoto)',
      displayOrder: gallery.length + 1,
      isActive: true,
      isPublished: true,
      tags: ['Japan', 'Luxury Travel'],
      createdAt: new Date().toISOString()
    });
    setIsModalOpen(true);
  };

  // ----------------------------------------------------
  // CRUD: OPEN EDIT
  // ----------------------------------------------------
  const handleOpenEdit = (item: GalleryImage) => {
    setFormError(null);
    setTagInput('');
    setEditingItem({
      ...item,
      description: item.description || item.caption || '',
      caption: item.caption || item.description || '',
      isActive: item.isActive !== false && item.isPublished !== false,
      isPublished: item.isActive !== false && item.isPublished !== false,
      tags: Array.isArray(item.tags) ? [...item.tags] : []
    });
    setIsModalOpen(true);
  };

  // ----------------------------------------------------
  // CRUD: SAVE MODAL ITEM
  // ----------------------------------------------------
  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    const desc = (editingItem.description || editingItem.caption || '').trim();
    if (!editingItem.imageUrl) {
      setFormError('Please upload a photo for the gallery item.');
      return;
    }
    if (!desc) {
      setFormError('Please provide a description or experience story.');
      return;
    }

    const isActive = editingItem.isActive !== false && editingItem.isPublished !== false;
    const finalItem: GalleryImage = {
      id: editingItem.id || `gal-${Date.now()}`,
      imageUrl: editingItem.imageUrl,
      storagePath: editingItem.storagePath,
      title: (editingItem.title || '').trim() || undefined,
      caption: desc,
      description: desc,
      customerName: (editingItem.customerName || 'Verified Guest').trim(),
      destination: (editingItem.destination || 'Global Experience').trim(),
      displayOrder: Number(editingItem.displayOrder || gallery.length + 1),
      isActive,
      isPublished: isActive,
      tags: Array.isArray(editingItem.tags) ? editingItem.tags.filter(Boolean) : [],
      createdAt: editingItem.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      updatedBy: user?.name || user?.email || 'Administrator'
    };

    db.saveGalleryImage(finalItem, user);
    showNotice(editingItem.createdAt ? 'Gallery photo updated successfully.' : 'New photo added to gallery.');
    setIsModalOpen(false);
    setEditingItem(null);
  };

  // ----------------------------------------------------
  // CRUD: SINGLE PHOTO UPLOAD / REPLACE IN MODAL
  // ----------------------------------------------------
  const handleModalFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingItem) return;

    const validation = validateGalleryImageFile(file);
    if (!validation.isValid) {
      setFormError(validation.error || 'Invalid file');
      return;
    }

    setFormError(null);
    setIsUploading(true);
    setUploadProgressText('Uploading photo to Firebase Storage...');

    try {
      const uploadResult = await uploadGalleryImage(file, editingItem.id);
      
      // If replacing an existing storage file, safely clean up previous path
      if (editingItem.storagePath && editingItem.storagePath !== uploadResult.storagePath) {
        deleteGalleryStorageFile(editingItem.storagePath).catch(() => {});
      }

      setEditingItem(prev => ({
        ...prev,
        imageUrl: uploadResult.url,
        storagePath: uploadResult.storagePath
      }));
      setUploadProgressText('Upload complete!');
    } catch (err: any) {
      console.error('[Gallery] Photo upload failed:', err);
      setFormError(err.message || 'Failed to upload photo. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  // ----------------------------------------------------
  // CRUD: DIRECT PHOTO REPLACEMENT FROM CARD
  // ----------------------------------------------------
  const handleTriggerCardReplace = (itemId: string) => {
    setReplaceTargetId(itemId);
    if (singleReplaceInputRef.current) {
      singleReplaceInputRef.current.value = '';
      singleReplaceInputRef.current.click();
    }
  };

  const handleCardReplaceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !replaceTargetId) return;

    const target = gallery.find(g => g.id === replaceTargetId);
    if (!target) return;

    const validation = validateGalleryImageFile(file);
    if (!validation.isValid) {
      alert(validation.error || 'Invalid file');
      return;
    }

    try {
      showNotice('Uploading replacement photo to Firebase Storage...');
      const uploadResult = await uploadGalleryImage(file, target.id);

      // Clean old storage file if different
      if (target.storagePath && target.storagePath !== uploadResult.storagePath) {
        deleteGalleryStorageFile(target.storagePath).catch(() => {});
      }

      const updated: GalleryImage = {
        ...target,
        imageUrl: uploadResult.url,
        storagePath: uploadResult.storagePath,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.name || user?.email || 'Administrator'
      };

      db.saveGalleryImage(updated, user);
      showNotice('Photo successfully replaced in Firebase Storage & Firestore.');
    } catch (err: any) {
      alert(`Replacement failed: ${err.message || 'Storage error'}`);
    } finally {
      setReplaceTargetId(null);
    }
  };

  // ----------------------------------------------------
  // CRUD: MULTI-PHOTO BATCH UPLOAD
  // ----------------------------------------------------
  const handleTriggerMultiUpload = () => {
    if (multiFileInputRef.current) {
      multiFileInputRef.current.value = '';
      multiFileInputRef.current.click();
    }
  };

  const handleMultiFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const validFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const val = validateGalleryImageFile(file);
      if (val.isValid) {
        validFiles.push(file);
      }
    }

    if (validFiles.length === 0) {
      alert('None of the selected files are valid images (max 10MB, JPG/PNG/WEBP).');
      return;
    }

    setIsBatchUploading(true);
    setBatchProgress({ current: 0, total: validFiles.length });
    setBatchNotice(`Uploading 0 of ${validFiles.length} photos to Firebase Storage...`);

    let successCount = 0;
    const currentMaxOrder = gallery.reduce((max, g) => Math.max(max, g.displayOrder || 0), 0);

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      setBatchProgress({ current: i + 1, total: validFiles.length });
      setBatchNotice(`Uploading photo ${i + 1} of ${validFiles.length} (${file.name})...`);

      try {
        const id = `gal-${Date.now()}-${i}`;
        const uploadResult = await uploadGalleryImage(file, id);
        
        // Derive clean caption from filename
        const cleanTitle = file.name
          .replace(/\.[^/.]+$/, '')
          .replace(/[-_]/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase());

        const newGalleryItem: GalleryImage = {
          id,
          imageUrl: uploadResult.url,
          storagePath: uploadResult.storagePath,
          title: cleanTitle,
          caption: `VIP travel experience and memorable ground journey: ${cleanTitle}`,
          description: `VIP travel experience and memorable ground journey: ${cleanTitle}`,
          customerName: 'Verified VIP Guests',
          destination: 'Japan (Tokyo & Kyoto)',
          displayOrder: currentMaxOrder + i + 1,
          isActive: true,
          isPublished: true,
          tags: ['Japan', 'Luxury Travel'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: user?.name || user?.email || 'Administrator'
        };

        db.saveGalleryImage(newGalleryItem, user);
        successCount++;
      } catch (err) {
        console.warn(`[Gallery] Batch upload failed for ${file.name}:`, err);
      }
    }

    setIsBatchUploading(false);
    setBatchProgress(null);
    setBatchNotice(null);
    showNotice(`Successfully uploaded and saved ${successCount} photos to Firebase.`);
  };

  // ----------------------------------------------------
  // CRUD: DELETE PHOTO
  // ----------------------------------------------------
  const handleDelete = (id: string) => {
    const target = gallery.find(g => g.id === id);
    const label = target?.title || target?.customerName || 'this customer photo';
    if (window.confirm(`Are you sure you want to permanently remove ${label}? This will remove it from the live homepage and delete associated Firebase Storage files.`)) {
      db.deleteGalleryImage(id, user);
      showNotice('Photo deleted successfully.');
    }
  };

  // ----------------------------------------------------
  // CRUD: ACTIVATE / DEACTIVATE TOGGLE
  // ----------------------------------------------------
  const handleToggleActive = (id: string) => {
    const updated = db.toggleGalleryImageActive(id, user);
    if (updated) {
      showNotice(`Photo ${updated.isActive ? 'activated for live homepage' : 'deactivated and hidden from homepage'}.`);
    }
  };

  // ----------------------------------------------------
  // CRUD: REORDER (UP / DOWN)
  // ----------------------------------------------------
  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const items = [...filteredGallery];
    const temp = items[index];
    items[index] = items[index - 1];
    items[index - 1] = temp;

    db.reorderGalleryImages(items, user);
    showNotice('Photo sequence updated.');
  };

  const handleMoveDown = (index: number) => {
    if (index >= filteredGallery.length - 1) return;
    const items = [...filteredGallery];
    const temp = items[index];
    items[index] = items[index + 1];
    items[index + 1] = temp;

    db.reorderGalleryImages(items, user);
    showNotice('Photo sequence updated.');
  };

  const handleDirectOrderChange = (itemId: string, newOrder: number) => {
    if (isNaN(newOrder) || newOrder < 1) return;
    const items = [...gallery];
    const target = items.find(g => g.id === itemId);
    if (!target) return;

    target.displayOrder = newOrder;
    items.sort((a, b) => a.displayOrder - b.displayOrder);
    db.reorderGalleryImages(items, user);
    showNotice(`Updated order to #${newOrder}.`);
  };

  // ----------------------------------------------------
  // TAG CHIP HELPERS
  // ----------------------------------------------------
  const handleAddTag = (rawTag: string) => {
    const clean = rawTag.trim().replace(/^#/, '');
    if (!clean || !editingItem) return;
    const currentTags = Array.isArray(editingItem.tags) ? editingItem.tags : [];
    if (!currentTags.some(t => t.toLowerCase() === clean.toLowerCase())) {
      setEditingItem({
        ...editingItem,
        tags: [...currentTags, clean]
      });
    }
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    if (!editingItem) return;
    const currentTags = Array.isArray(editingItem.tags) ? editingItem.tags : [];
    setEditingItem({
      ...editingItem,
      tags: currentTags.filter(t => t !== tagToRemove)
    });
  };

  return (
    <div className="space-y-6">
      {/* Hidden file inputs for batch upload & replace */}
      <input
        ref={multiFileInputRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp"
        onChange={handleMultiFileUpload}
        className="hidden"
      />
      <input
        ref={singleReplaceInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleCardReplaceUpload}
        className="hidden"
      />

      {/* Action Notification Toast */}
      {actionNotice && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center space-x-2 text-xs font-bold animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-[#00E5C0]" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div>
          <div className="flex items-center space-x-2 text-[#008972] font-bold text-xs uppercase tracking-wider mb-1.5">
            <Camera className="w-4 h-4 text-[#00C6A6]" />
            <span>Integrated Homepage Section Content</span>
            {isEmbedded && onBackToSequence && (
              <span className="text-slate-400">• Homepage Section Sequence & Ordering</span>
            )}
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>Happy Customer Moments Gallery</span>
            <span className="text-xs font-mono font-bold bg-teal-50 text-[#008972] border border-teal-200 px-2.5 py-0.5 rounded-full">
              {gallery.length} Photos
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Manage authentic guest photos, tags, and experience stories. All changes synchronise directly with Firebase Storage and Firestore to populate the live homepage section.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {onBackToSequence && (
            <button
              type="button"
              onClick={onBackToSequence}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5"
            >
              <Sliders className="w-3.5 h-3.5 text-slate-500" />
              <span>Section Sequence List</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleTriggerMultiUpload}
            disabled={isBatchUploading}
            className="px-4 py-2.5 rounded-xl border border-teal-200 bg-teal-50 hover:bg-teal-100 text-[#008972] text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
            title="Upload multiple photos in batch to Firebase Storage"
          >
            {isBatchUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            <span>{isBatchUploading ? 'Uploading...' : 'Batch Upload Photos'}</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-5 py-2.5 rounded-xl bg-[#008972] hover:bg-[#00C6A6] text-white hover:text-slate-950 text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center space-x-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Single Photo</span>
          </button>
        </div>
      </div>

      {/* Batch Upload Progress Banner */}
      {isBatchUploading && batchProgress && (
        <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 flex items-center justify-between gap-4 animate-fadeIn">
          <div className="flex items-center space-x-3">
            <Loader2 className="w-5 h-5 text-[#008972] animate-spin shrink-0" />
            <div>
              <div className="text-xs font-bold text-teal-950">
                {batchNotice || 'Uploading photos to Firebase Storage...'}
              </div>
              <div className="text-[11px] text-teal-700">
                Processed {batchProgress.current} of {batchProgress.total} files. Please keep this tab open.
              </div>
            </div>
          </div>
          <div className="w-32 bg-teal-200 rounded-full h-2 overflow-hidden shrink-0">
            <div 
              className="bg-[#008972] h-full transition-all duration-300" 
              style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Filters & Search Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by customer, destination, description, or tag..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00C6A6]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Segment Filter */}
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({gallery.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('ACTIVE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'ACTIVE'
                  ? 'bg-emerald-500 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Active ({gallery.filter(g => g.isActive !== false && g.isPublished !== false).length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('INACTIVE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'INACTIVE'
                  ? 'bg-slate-700 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Inactive ({gallery.filter(g => g.isActive === false || g.isPublished === false).length})
            </button>
          </div>
        </div>

        {/* Tag Filter Chips Bar */}
        {existingTags.length > 0 && (
          <div className="flex items-center space-x-1.5 overflow-x-auto pt-2 border-t border-slate-100 no-scrollbar">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
              <TagIcon className="w-3 h-3 text-slate-400" />
              <span>Tags:</span>
            </span>
            <button
              type="button"
              onClick={() => setSelectedTagFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedTagFilter === 'ALL'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Tags
            </button>
            {existingTags.map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => setSelectedTagFilter(tag)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                  selectedTagFilter.toLowerCase() === tag.toLowerCase()
                    ? 'bg-[#008972] text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Gallery Cards Grid */}
      {filteredGallery.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-teal-50 text-[#008972] border border-teal-200 flex items-center justify-center mx-auto">
            <Camera className="w-7 h-7 text-[#008972]" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-bold text-slate-900">
              {searchQuery || selectedTagFilter !== 'ALL' || statusFilter !== 'ALL'
                ? 'No gallery photos match your filters'
                : 'No gallery photos uploaded yet'}
            </h3>
            <p className="text-xs text-slate-500">
              {searchQuery || selectedTagFilter !== 'ALL' || statusFilter !== 'ALL'
                ? 'Try clearing the search query or selecting "All Tags".'
                : 'Upload authentic customer travel photos to showcase VIP experiences on the homepage.'}
            </p>
          </div>
          <div className="pt-2 flex justify-center gap-3">
            {searchQuery || selectedTagFilter !== 'ALL' || statusFilter !== 'ALL' ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedTagFilter('ALL');
                  setStatusFilter('ALL');
                }}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Clear Filters
              </button>
            ) : (
              <button
                type="button"
                onClick={handleOpenAdd}
                className="px-5 py-2.5 rounded-xl bg-[#008972] hover:bg-[#00C6A6] text-white hover:text-slate-950 text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center space-x-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Upload First Photo</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGallery.map((item, idx) => {
            const isFirst = idx === 0;
            const isLast = idx === filteredGallery.length - 1;
            const isActive = item.isActive !== false && item.isPublished !== false;

            return (
              <div
                key={item.id}
                className={`bg-white rounded-3xl border transition-all flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-md ${
                  isActive ? 'border-slate-200' : 'border-slate-200 opacity-70 bg-slate-50/50'
                }`}
              >
                {/* Photo Image Banner */}
                <div>
                  <div className="relative aspect-4/3 overflow-hidden bg-slate-100 group">
                    <img
                      src={item.imageUrl}
                      alt={item.title || item.caption}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=1200&auto=format&fit=crop';
                      }}
                    />
                    
                    {/* Top Badges */}
                    <div className="absolute top-3 left-3 flex items-center gap-1.5">
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-900/85 backdrop-blur-md text-white shadow-xs">
                        <MapPin className="w-3 h-3 text-[#00E5C0]" />
                        <span>{item.destination || 'Global'}</span>
                      </span>
                    </div>

                    <div className="absolute top-3 right-3 flex items-center gap-1.5">
                      {/* Active Status Badge */}
                      <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider backdrop-blur-md shadow-xs ${
                        isActive
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-700 text-slate-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white' : 'bg-slate-400'}`} />
                        <span>{isActive ? 'Published' : 'Hidden'}</span>
                      </span>

                      {/* Display Order Badge */}
                      <span className="px-2 py-1 rounded-lg text-[10px] font-mono font-black bg-white/95 text-slate-900 border border-slate-200 shadow-xs">
                        #{item.displayOrder}
                      </span>
                    </div>

                    {/* Bottom Customer Name Overlay */}
                    {item.customerName && (
                      <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-slate-950/80 via-slate-950/40 to-transparent text-white">
                        <div className="flex items-center space-x-1.5 text-xs font-bold drop-shadow-sm">
                          <User className="w-3.5 h-3.5 text-[#00E5C0]" />
                          <span className="truncate">{item.customerName}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Content */}
                  <div className="p-5 space-y-3">
                    {/* Title if present */}
                    {item.title && (
                      <h4 className="text-sm font-bold text-slate-900 leading-snug">
                        {item.title}
                      </h4>
                    )}

                    {/* Description */}
                    <p className="text-xs text-slate-600 leading-relaxed italic line-clamp-3">
                      &ldquo;{item.description || item.caption}&rdquo;
                    </p>

                    {/* Tags */}
                    {Array.isArray(item.tags) && item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {item.tags.map((tag, tIdx) => (
                          <span
                            key={tIdx}
                            className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md flex items-center space-x-0.5"
                          >
                            <span>#{tag}</span>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Storage info (compact reference) */}
                    {item.storagePath && (
                      <div className="text-[10px] text-slate-400 font-mono truncate" title={item.storagePath}>
                        Storage: {item.storagePath.split('/').pop()}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                  {/* Sequence Reorder Input & Arrows */}
                  <div className="flex items-center space-x-1">
                    <input
                      type="number"
                      min={1}
                      max={gallery.length}
                      value={item.displayOrder}
                      onChange={e => handleDirectOrderChange(item.id, parseInt(e.target.value, 10))}
                      className="w-10 h-7 rounded-lg bg-white border border-slate-200 text-slate-900 text-xs font-mono font-bold text-center focus:outline-none focus:ring-1 focus:ring-[#00C6A6]"
                      title="Directly edit display sequence number"
                    />
                    <button
                      type="button"
                      disabled={isFirst}
                      onClick={() => handleMoveUp(idx)}
                      className={`p-1.5 rounded-lg border text-xs transition-colors ${
                        isFirst
                          ? 'border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50'
                          : 'border-slate-200 text-slate-700 bg-white hover:bg-slate-100 cursor-pointer'
                      }`}
                      title={isFirst ? 'First position' : 'Move photo up'}
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={isLast}
                      onClick={() => handleMoveDown(idx)}
                      className={`p-1.5 rounded-lg border text-xs transition-colors ${
                        isLast
                          ? 'border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50'
                          : 'border-slate-200 text-slate-700 bg-white hover:bg-slate-100 cursor-pointer'
                      }`}
                      title={isLast ? 'Last position' : 'Move photo down'}
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Actions: Toggle Active, Replace, Edit, Delete */}
                  <div className="flex items-center space-x-1.5">
                    {/* Active Toggle */}
                    <button
                      type="button"
                      onClick={() => handleToggleActive(item.id)}
                      className={`p-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-100'
                      }`}
                      title={isActive ? 'Deactivate (Hide from live homepage)' : 'Activate (Publish on live homepage)'}
                    >
                      {isActive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>

                    {/* Replace Photo File */}
                    <button
                      type="button"
                      onClick={() => handleTriggerCardReplace(item.id)}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 cursor-pointer"
                      title="Replace photo image file in Firebase Storage"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>

                    {/* Edit Info */}
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(item)}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 cursor-pointer"
                      title="Edit photo info, tags, and description"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete Photo */}
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 cursor-pointer"
                      title="Permanently delete photo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* ADD / EDIT PHOTO MODAL */}
      {/* ---------------------------------------------------- */}
      {isModalOpen && editingItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto my-auto animate-fadeIn">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
              <div className="flex items-center space-x-2.5 text-[#008972] font-bold text-xs uppercase tracking-wider">
                <Camera className="w-4 h-4 text-[#00C6A6]" />
                <span>{editingItem.createdAt ? 'Edit Gallery Photo Details' : 'Add Customer Gallery Photo'}</span>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveModal} className="space-y-4">
              {/* Photo Upload Zone */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Customer Photo *
                </label>
                
                {editingItem.imageUrl ? (
                  <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 aspect-16/9 group">
                    <img
                      src={editingItem.imageUrl}
                      alt="Uploaded preview"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-slate-950/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <label className="px-3.5 py-2 rounded-xl bg-white text-slate-900 text-xs font-bold cursor-pointer hover:bg-slate-100 shadow-md flex items-center space-x-1.5">
                        <Upload className="w-3.5 h-3.5 text-[#008972]" />
                        <span>Replace Photo</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={handleModalFileUpload}
                          className="hidden"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setEditingItem({ ...editingItem, imageUrl: '', storagePath: undefined })}
                        className="px-3.5 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold cursor-pointer hover:bg-rose-700 shadow-md flex items-center space-x-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-slate-200 hover:border-[#00C6A6] rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-slate-50 hover:bg-teal-50/30">
                    <div className="w-12 h-12 rounded-2xl bg-teal-50 text-[#008972] border border-teal-200 flex items-center justify-center mb-3">
                      {isUploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
                    </div>
                    <div className="text-xs font-bold text-slate-800">
                      {isUploading ? uploadProgressText : 'Click or drag photo here to upload'}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Supports JPG, JPEG, PNG, and WebP (up to 10MB). Stored securely in Firebase Storage.
                    </p>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleModalFileUpload}
                      disabled={isUploading}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Title / Headline (Optional) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Photo Title / Headline (Optional)
                </label>
                <input
                  type="text"
                  value={editingItem.title || ''}
                  onChange={e => setEditingItem({ ...editingItem, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00C6A6]"
                  placeholder="e.g. Private Tea Masterclass in Uji"
                />
              </div>

              {/* Guest / Group Name & Destination Corridor */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Customer / Agency / Guest Name
                  </label>
                  <input
                    type="text"
                    value={editingItem.customerName || ''}
                    onChange={e => setEditingItem({ ...editingItem, customerName: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00C6A6]"
                    placeholder="e.g. The Montgomery Family / Aria Travel"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Destination & Corridor *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingItem.destination || ''}
                    onChange={e => setEditingItem({ ...editingItem, destination: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00C6A6]"
                    placeholder="e.g. Japan (Kyoto & Uji)"
                  />
                </div>
              </div>

              {/* Description / Story * */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Experience Story / Description *
                  </label>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {(editingItem.description || editingItem.caption || '').length} characters
                  </span>
                </div>
                <textarea
                  rows={3}
                  required
                  value={editingItem.description || editingItem.caption || ''}
                  onChange={e => setEditingItem({
                    ...editingItem,
                    description: e.target.value,
                    caption: e.target.value
                  })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 leading-relaxed focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00C6A6]"
                  placeholder="e.g. Private tea masterclass in Uji with our licensed specialist guide, followed by a VIP garden tea ceremony..."
                />
              </div>

              {/* Tags Management */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Tags & Categories
                </label>
                
                {/* Active Tag Chips */}
                <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl mb-2 min-h-10 items-center">
                  {(editingItem.tags || []).length === 0 ? (
                    <span className="text-[11px] text-slate-400 italic">No tags added yet. Type below or click suggestions.</span>
                  ) : (
                    (editingItem.tags || []).map(tag => (
                      <span
                        key={tag}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-[#008972] text-white shadow-2xs"
                      >
                        <span>#{tag}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="hover:bg-white/20 rounded-full p-0.5 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))
                  )}
                </div>

                {/* Tag Input */}
                <div className="flex items-center space-x-2 mb-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag(tagInput);
                      }
                    }}
                    placeholder="Type tag and press Enter (e.g. Tokyo, Family, Honeymoon)..."
                    className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00C6A6]"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddTag(tagInput)}
                    className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
                  >
                    Add Tag
                  </button>
                </div>

                {/* Tag Suggestions */}
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    Suggested & Existing Tags (Click to add):
                  </span>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto no-scrollbar pt-0.5">
                    {availableTagSuggestions.map(s => {
                      const isAdded = (editingItem.tags || []).some(t => t.toLowerCase() === s.toLowerCase());
                      return (
                        <button
                          key={s}
                          type="button"
                          disabled={isAdded}
                          onClick={() => handleAddTag(s)}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors ${
                            isAdded
                              ? 'bg-slate-100 text-slate-400 cursor-default'
                              : 'bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-[#008972] cursor-pointer'
                          }`}
                        >
                          + #{s}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Display Order & Publication Toggle */}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Display Sequence #
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={editingItem.displayOrder || 1}
                    onChange={e => setEditingItem({ ...editingItem, displayOrder: parseInt(e.target.value, 10) || 1 })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold text-slate-900"
                  />
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center space-x-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingItem.isActive !== false && editingItem.isPublished !== false}
                      onChange={e => setEditingItem({
                        ...editingItem,
                        isActive: e.target.checked,
                        isPublished: e.target.checked
                      })}
                      className="w-4 h-4 text-[#00C6A6] rounded focus:ring-[#00C6A6] cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-800">
                      Publish to Live Homepage
                    </span>
                  </label>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end space-x-3 pt-5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-6 py-2.5 rounded-xl bg-[#008972] hover:bg-[#00C6A6] text-white hover:text-slate-950 font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Photo Record</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
