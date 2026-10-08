import React, { useState, useEffect } from 'react';
import { AppDatabase } from '../../services/db';
import { GalleryImage } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { ImageUploadOrUrlInput } from '../ImageUploadOrUrlInput';
import { 
  Image as ImageIcon, 
  Plus, 
  Trash2, 
  Edit, 
  Save, 
  X, 
  Sparkles, 
  Camera, 
  Tag, 
  CheckCircle2,
  Upload,
  Globe2,
  Users
} from 'lucide-react';

export const GalleryManager: React.FC = () => {
  const { user } = useAuth();
  const db = AppDatabase.getInstance();
  const [gallery, setGallery] = useState<GalleryImage[]>(db.getGalleryImages());
  const [isEditing, setIsEditing] = useState(false);
  const [editingImage, setEditingImage] = useState<Partial<GalleryImage> | null>(null);

  useEffect(() => {
    return db.subscribe(() => {
      setGallery(db.getGalleryImages());
    });
  }, []);

  const handleOpenAdd = () => {
    setEditingImage({
      id: `gal-${Date.now()}`,
      imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=1200&auto=format&fit=crop',
      caption: '',
      customerName: '',
      destination: 'Japan (Tokyo & Kyoto)',
      displayOrder: gallery.length + 1,
      isPublished: true,
      tags: ['Luxury', 'VIP Guide', 'Happy Travelers'],
      createdAt: new Date().toISOString().split('T')[0]
    });
    setIsEditing(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingImage || !editingImage.imageUrl || !editingImage.caption) {
      alert('Please upload/select a photo and provide an experience caption.');
      return;
    }

    const completeImage: GalleryImage = {
      id: editingImage.id || `gal-${Date.now()}`,
      imageUrl: editingImage.imageUrl,
      caption: editingImage.caption,
      customerName: editingImage.customerName || 'Verified Guest',
      destination: editingImage.destination || 'Global Experience',
      displayOrder: Number(editingImage.displayOrder || 1),
      isPublished: editingImage.isPublished !== undefined ? editingImage.isPublished : true,
      tags: Array.isArray(editingImage.tags) ? editingImage.tags : (editingImage.tags as string || '').split(',').map(s => s.trim()),
      createdAt: editingImage.createdAt || new Date().toISOString().split('T')[0]
    };

    db.saveGalleryImage(completeImage, user);
    setIsEditing(false);
    setEditingImage(null);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to remove this customer photo?')) {
      db.deleteGalleryImage(id, user);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2 text-[#008972] font-bold text-xs uppercase tracking-wider mb-1">
            <Camera className="w-4 h-4 text-[#00C6A6]" />
            <span>Social Proof & Visual Heritage</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">Happy Customer Gallery Manager</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Upload genuine customer photos or fetch Unsplash HD travel memories to showcase across the website and destination hubs.
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center bg-[#00C6A6] hover:bg-[#008972] text-white font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-xs text-xs sm:text-sm shrink-0"
        >
          <span>Upload Customer Photo</span>
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {gallery.map(img => (
          <div key={img.id} className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
            <div>
              <div className="relative h-52 overflow-hidden bg-slate-100">
                <img 
                  src={img.imageUrl} 
                  alt={img.caption} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                />
                <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-md text-white text-[11px] font-bold px-2.5 py-1 rounded-lg">
                  {img.destination}
                </div>
                <div className="absolute top-3 right-3 bg-[#00C6A6] text-slate-950 text-[11px] font-black px-2 py-0.5 rounded-md">
                  Order #{img.displayOrder}
                </div>
              </div>

              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center space-x-1.5">
                    <Users className="w-3.5 h-3.5 text-[#00C6A6]" />
                    <span>{img.customerName}</span>
                  </h4>
                  <span className="text-[11px] font-mono text-slate-400">{img.createdAt}</span>
                </div>
                <p className="text-xs text-slate-600 italic leading-relaxed">&ldquo;{img.caption}&rdquo;</p>

                {img.tags && (img.tags || []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {(img.tags || []).map((tag, i) => (
                      <span key={i} className="text-[10px] bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded-md">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end space-x-2">
              <button
                onClick={() => {
                  setEditingImage(img);
                  setIsEditing(true);
                }}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 cursor-pointer"
                title="Edit Photo"
              >
                <Edit className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDelete(img.id)}
                className="p-1.5 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 cursor-pointer"
                title="Delete Photo"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit / Add Modal with Photo Upload & Unsplash Fetcher */}
      {isEditing && editingImage && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
              <div className="flex items-center space-x-2 text-[#008972] font-bold text-xs uppercase tracking-wider">
                <Camera className="w-4 h-4 text-[#00C6A6]" />
                <span>{editingImage.id ? 'Edit Customer Photo' : 'Upload Customer Photo'}</span>
              </div>
              <button onClick={() => setIsEditing(false)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Photo Upload / Unsplash Component */}
              <div>
                <ImageUploadOrUrlInput
                  label="Customer Photo (Upload local file or fetch Unsplash HD)"
                  value={editingImage.imageUrl || ''}
                  onChange={url => setEditingImage({ ...editingImage, imageUrl: url })}
                  category="customers"
                  defaultSearchTopic="Happy travelers in Japan"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Customer / Guest / Agency Name *
                </label>
                <input
                  type="text"
                  required
                  value={editingImage.customerName || ''}
                  onChange={e => setEditingImage({ ...editingImage, customerName: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold"
                  placeholder="e.g. The Montgomery Family / Aria Luxury Travel"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Destination & City Hub *
                </label>
                <input
                  type="text"
                  required
                  value={editingImage.destination || ''}
                  onChange={e => setEditingImage({ ...editingImage, destination: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs"
                  placeholder="e.g. Japan (Kyoto & Uji)"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Story / Experience Caption *
                </label>
                <textarea
                  rows={3}
                  required
                  value={editingImage.caption || ''}
                  onChange={e => setEditingImage({ ...editingImage, caption: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs leading-relaxed"
                  placeholder="e.g. Private tea masterclass in Uji with our licensed specialist..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={Array.isArray(editingImage.tags) ? editingImage.tags.join(', ') : (editingImage.tags || '')}
                  onChange={e => setEditingImage({ ...editingImage, tags: e.target.value.split(',').map(s => s.trim()) })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs"
                  placeholder="e.g. TeaCeremony, Kyoto, VIP, HappyTravelers"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    value={editingImage.displayOrder || 1}
                    onChange={e => setEditingImage({ ...editingImage, displayOrder: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold"
                  />
                </div>
                <div className="flex items-center pt-6">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingImage.isPublished !== undefined ? editingImage.isPublished : true}
                      onChange={e => setEditingImage({ ...editingImage, isPublished: e.target.checked })}
                      className="w-4 h-4 text-[#00C6A6] rounded cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-700">Published on Website</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[#00C6A6] hover:bg-[#008972] text-white font-bold text-xs shadow-xs cursor-pointer"
                >
                  Save Photo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
