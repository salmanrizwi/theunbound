import React, { useState, useEffect } from 'react';
import { Product, WishlistFolder, WishlistItem } from '../types';
import { useAuth } from '../context/AuthContext';
import { AppDatabase } from '../services/db';
import { 
  Heart, 
  FolderPlus, 
  Check, 
  Folder, 
  X, 
  Sparkles, 
  Bookmark,
  ChevronRight,
  Plus
} from 'lucide-react';

interface WishlistButtonProps {
  product: Product;
  variant?: 'icon' | 'button' | 'badge';
  className?: string;
}

const PRESET_FOLDER_COLORS = [
  '#00C6A6', // Teal
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#EF4444'  // Rose
];

export const WishlistButton: React.FC<WishlistButtonProps> = ({
  product,
  variant = 'icon',
  className = ''
}) => {
  const { user, isAuthenticated, openAuthModal } = useAuth();
  const db = AppDatabase.getInstance();

  const [folders, setFolders] = useState<WishlistFolder[]>([]);
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState(PRESET_FOLDER_COLORS[0]);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const userId = user?.id || 'guest_user';

  const loadWishlistData = () => {
    if (!user) return;
    const userFolders = db.getWishlistFolders(user.id);
    const userItems = db.getWishlistItems(user.id);
    setFolders(userFolders);
    setWishlistItems(userItems);
  };

  useEffect(() => {
    loadWishlistData();
    const unsub = db.subscribe(() => {
      loadWishlistData();
    });
    return () => unsub();
  }, [user]);

  const existingItem = wishlistItems.find(i => i.productId === product.id);
  const isSaved = !!existingItem;
  const currentFolder = existingItem ? folders.find(f => f.id === existingItem.folderId) : null;

  const handleToggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      openAuthModal(`Sign in to save "${product.name}" to your curated wishlist folders.`, () => {
        setIsMenuOpen(true);
      });
      return;
    }
    setIsMenuOpen(!isMenuOpen);
  };

  const handleSaveToFolder = (folderId: string, folderName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;

    if (existingItem) {
      if (existingItem.folderId === folderId) {
        // Remove if clicking the same folder
        db.deleteWishlistItem(existingItem.id);
        setFeedbackMsg('Removed from Wishlist');
      } else {
        // Move to other folder
        db.moveWishlistItem(existingItem.id, folderId);
        setFeedbackMsg(`Moved to "${folderName}"`);
      }
    } else {
      // Add new
      const newItem: WishlistItem = {
        id: `wish-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        userId: user.id,
        productId: product.id,
        folderId,
        addedAt: new Date().toISOString()
      };
      db.saveWishlistItem(newItem);
      setFeedbackMsg(`Saved to "${folderName}"`);
    }

    setTimeout(() => {
      setFeedbackMsg(null);
      setIsMenuOpen(false);
    }, 1200);
  };

  const handleCreateFolderAndSave = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user || !newFolderName.trim()) return;

    const newFolder: WishlistFolder = {
      id: `folder-${Date.now()}`,
      userId: user.id,
      name: newFolderName.trim(),
      color: newFolderColor,
      createdAt: new Date().toISOString()
    };

    db.saveWishlistFolder(newFolder);

    // Save product directly to this new folder
    const newItem: WishlistItem = {
      id: `wish-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      userId: user.id,
      productId: product.id,
      folderId: newFolder.id,
      addedAt: new Date().toISOString()
    };
    db.saveWishlistItem(newItem);

    setNewFolderName('');
    setIsCreatingFolder(false);
    setFeedbackMsg(`Saved to new folder "${newFolder.name}"`);

    setTimeout(() => {
      setFeedbackMsg(null);
      setIsMenuOpen(false);
    }, 1200);
  };

  return (
    <div className={`relative inline-block ${className}`} onClick={(e) => e.stopPropagation()}>
      {/* Trigger Button Variant */}
      {variant === 'icon' && (
        <button
          id={`btn-wishlist-${product.id}`}
          onClick={handleToggleMenu}
          aria-label="Save to Wishlist"
          className={`p-2 rounded-full backdrop-blur-md transition-all cursor-pointer ${
            isSaved
              ? 'bg-rose-500 text-white shadow-md shadow-rose-500/30 ring-2 ring-white scale-105'
              : 'bg-slate-900/60 hover:bg-slate-900/80 text-white hover:text-rose-400'
          }`}
          title={isSaved ? `Saved in "${currentFolder?.name || 'Wishlist'}"` : 'Save to Wishlist Folder'}
        >
          <Heart className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
        </button>
      )}

      {variant === 'button' && (
        <button
          id={`btn-wishlist-text-${product.id}`}
          onClick={handleToggleMenu}
          className={`w-full py-2.5 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer border ${
            isSaved
              ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
              : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
          }`}
        >
          <Heart className={`w-3.5 h-3.5 ${isSaved ? 'fill-rose-500 text-rose-500' : 'text-slate-500'}`} />
          <span>{isSaved ? `Saved in ${currentFolder?.name || 'Wishlist'}` : 'Save to Wishlist'}</span>
        </button>
      )}

      {variant === 'badge' && (
        <button
          id={`btn-wishlist-badge-${product.id}`}
          onClick={handleToggleMenu}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
            isSaved
              ? 'bg-rose-100 text-rose-800 border border-rose-200'
              : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
          }`}
        >
          <Heart className={`w-3.5 h-3.5 ${isSaved ? 'fill-rose-600 text-rose-600' : ''}`} />
          <span>{isSaved ? 'In Wishlist' : 'Add to Wishlist'}</span>
        </button>
      )}

      {/* Dropdown Menu Modal */}
      {isMenuOpen && (
        <div 
          id={`wishlist-dropdown-${product.id}`}
          className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 z-50 animate-in fade-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
            <div className="flex items-center space-x-1.5">
              <Bookmark className="w-3.5 h-3.5 text-[#00C6A6]" />
              <span className="text-xs font-extrabold text-slate-900">Save to Wishlist Folder</span>
            </div>
            <button
              onClick={() => setIsMenuOpen(false)}
              className="text-slate-400 hover:text-slate-700 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {feedbackMsg && (
            <div className="mb-2 p-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs flex items-center space-x-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span className="font-semibold">{feedbackMsg}</span>
            </div>
          )}

          {!isCreatingFolder ? (
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase font-bold text-slate-400">Select Folder:</p>
              
              <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                {/* Default Folder */}
                <button
                  type="button"
                  onClick={(e) => handleSaveToFolder('default', 'General Wishlist', e)}
                  className={`w-full text-left p-2 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                    existingItem?.folderId === 'default'
                      ? 'bg-rose-50 text-rose-900 font-bold border border-rose-200'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#00C6A6]" />
                    <span>General Wishlist</span>
                  </span>
                  {existingItem?.folderId === 'default' && <Check className="w-3.5 h-3.5 text-rose-600" />}
                </button>

                {/* User Custom Folders */}
                {folders.map((folder) => {
                  const isInThisFolder = existingItem?.folderId === folder.id;
                  return (
                    <button
                      key={folder.id}
                      type="button"
                      onClick={(e) => handleSaveToFolder(folder.id, folder.name, e)}
                      className={`w-full text-left p-2 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                        isInThisFolder
                          ? 'bg-rose-50 text-rose-900 font-bold border border-rose-200'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span className="flex items-center space-x-2 truncate">
                        <span 
                          className="w-2.5 h-2.5 rounded-full shrink-0" 
                          style={{ backgroundColor: folder.color || '#3B82F6' }} 
                        />
                        <span className="truncate">{folder.name}</span>
                      </span>
                      {isInThisFolder && <Check className="w-3.5 h-3.5 text-rose-600 shrink-0" />}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setIsCreatingFolder(true)}
                className="w-full mt-2 pt-2 border-t border-slate-100 text-xs font-bold text-[#008972] hover:text-[#00C6A6] flex items-center justify-center py-1.5 rounded-xl hover:bg-emerald-50/60 transition-colors cursor-pointer"
              >
                <span>Create New Custom Folder</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleCreateFolderAndSave} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                  Folder Name:
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kyoto Luxury Itinerary"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#00C6A6]"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                  Folder Color Tag:
                </label>
                <div className="flex items-center space-x-1.5">
                  {PRESET_FOLDER_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewFolderColor(c)}
                      className={`w-5 h-5 rounded-full transition-transform cursor-pointer ${
                        newFolderColor === c ? 'scale-125 ring-2 ring-slate-900 ring-offset-1' : 'opacity-70 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsCreatingFolder(false)}
                  className="w-1/2 py-1.5 px-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-1.5 px-2 bg-[#00C6A6] text-slate-950 rounded-xl text-xs font-bold hover:bg-[#008972] transition-colors cursor-pointer shadow-xs"
                >
                  Save & Add
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
};
