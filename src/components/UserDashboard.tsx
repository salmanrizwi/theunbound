import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useQuotation } from '../context/QuotationContext';
import { formatCurrency } from '../services/pricingEngine';
import { Product, WishlistFolder, WishlistItem } from '../types';
import { AppDatabase } from '../services/db';
import { 
  User, 
  Bookmark, 
  FileText, 
  Clock, 
  MapPin, 
  Trash2, 
  ExternalLink, 
  ArrowRight, 
  Building2, 
  Sparkles, 
  Compass,
  CheckCircle2,
  Heart,
  FolderPlus,
  Folder,
  FolderOpen,
  Plus,
  ShoppingBag,
  Eye,
  Check
} from 'lucide-react';

interface UserDashboardProps {
  onExploreProducts: () => void;
  onSelectDestination: (dest: string) => void;
  onViewProduct: (product: Product) => void;
  products: Product[];
}

export const UserDashboard: React.FC<UserDashboardProps> = ({
  onExploreProducts,
  onSelectDestination,
  onViewProduct,
  products
}) => {
  const { user } = useAuth();
  const { savedQuotes, loadSavedQuote, deleteSavedQuote, currency, addProductToQuote } = useQuotation();
  const [activeDashboardTab, setActiveDashboardTab] = useState<'QUOTES' | 'WISHLIST'>('WISHLIST');

  // Wishlist state
  const [folders, setFolders] = useState<WishlistFolder[]>([]);
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [addedItemToast, setAddedItemToast] = useState<string | null>(null);

  const db = AppDatabase.getInstance();

  const loadWishlistData = () => {
    if (!user) return;
    const userFolders = db.getWishlistFolders(user.id);
    const userItems = db.getWishlistItems(user.id);
    setFolders(userFolders);
    setWishlistItems(userItems);

    if (userFolders.length > 0 && (!selectedFolderId || !userFolders.some(f => f.id === selectedFolderId))) {
      setSelectedFolderId(userFolders[0].id);
    }
  };

  useEffect(() => {
    loadWishlistData();
  }, [user]);

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim() || !user) return;

    const newFolder = await db.createWishlistFolder(user.id, newFolderName.trim());
    setNewFolderName('');
    setIsCreatingFolder(false);
    loadWishlistData();
    setSelectedFolderId(newFolder.id);
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (window.confirm('Are you sure you want to delete this folder and its saved items?')) {
      await db.deleteWishlistFolder(folderId);
      loadWishlistData();
    }
  };

  const handleRemoveItem = async (folderId: string, productId: string) => {
    if (!user) return;
    await db.removeFromWishlist(user.id, folderId, productId);
    loadWishlistData();
  };

  const handleQuickAddQuote = (product: Product) => {
    addProductToQuote(product);
    setAddedItemToast(product.name);
    setTimeout(() => setAddedItemToast(null), 3000);
  };

  // Filter items in the currently selected folder
  const activeFolderItems = wishlistItems.filter(item => item.folderId === selectedFolderId);
  const activeFolder = folders.find(f => f.id === selectedFolderId);

  const featuredProducts = products.slice(0, 4);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300">
      {/* Toast Notification */}
      {addedItemToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white border border-[#00C6A6] px-4 py-3 rounded-2xl shadow-xl flex items-center space-x-2 text-xs animate-in slide-in-from-bottom-3 duration-200">
          <Check className="w-4 h-4 text-[#00E5C0]" />
          <span>Added <strong>{addedItemToast}</strong> to active quotation</span>
        </div>
      )}

      {/* Welcome Banner */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center space-x-4">
            <img
              src={user?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop'}
              alt={user?.name}
              className="w-16 h-16 rounded-2xl object-cover ring-2 ring-[#00C6A6]"
            />
            <div>
              <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#00C6A6]/20 text-[#00E5C0] border border-[#00C6A6]/30 mb-1">
                <span>Verified {user?.role || 'Agent'} Account</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold font-sans">
                Welcome back, {user?.name || 'Travel Designer'}
              </h1>
              <p className="text-xs text-slate-300 flex items-center space-x-2 mt-0.5">
                <Building2 className="w-3.5 h-3.5 text-[#00C6A6]" />
                <span>{user?.agencyName || 'Luxury Discovery Travel Partners'}</span>
                <span>•</span>
                <span>{user?.email}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onExploreProducts}
              className="bg-[#00C6A6] hover:bg-[#008972] text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs transition-all shadow-md shadow-[#00C6A6]/20 flex items-center space-x-1.5 cursor-pointer"
            >
              <Compass className="w-4 h-4" />
              <span>Browse DMC Catalog</span>
            </button>
          </div>
        </div>

        {/* Dashboard Navigation Tabs */}
        <div className="flex items-center space-x-2 mt-6 pt-6 border-t border-slate-800">
          <button
            onClick={() => setActiveDashboardTab('WISHLIST')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeDashboardTab === 'WISHLIST'
                ? 'bg-[#00C6A6] text-slate-950 shadow-md shadow-[#00C6A6]/20'
                : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
            }`}
          >
            <Heart className="w-3.5 h-3.5" />
            <span>My Wishlist & Folders</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-950/40 text-white font-mono">
              {wishlistItems.length}
            </span>
          </button>

          <button
            onClick={() => setActiveDashboardTab('QUOTES')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeDashboardTab === 'QUOTES'
                ? 'bg-[#00C6A6] text-slate-950 shadow-md shadow-[#00C6A6]/20'
                : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Saved Quotations</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-950/40 text-white font-mono">
              {savedQuotes.length}
            </span>
          </button>
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left / Main Workspace */}
        <div className="lg:col-span-8 space-y-6">
          {activeDashboardTab === 'WISHLIST' ? (
            /* MY WISHLIST SECTION */
            <div className="space-y-6">
              {/* Folder Management Header */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                      <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
                      <span>My Curated Wishlist Folders</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Organize favorite hotels, tours, and transfers into client or destination-specific folders.
                    </p>
                  </div>

                  <button
                    onClick={() => setIsCreatingFolder(!isCreatingFolder)}
                    className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center space-x-1.5 cursor-pointer transition-colors shrink-0"
                  >
                    <FolderPlus className="w-3.5 h-3.5 text-[#00E5C0]" />
                    <span>Create New Folder</span>
                  </button>
                </div>

                {/* Inline New Folder Form */}
                {isCreatingFolder && (
                  <form onSubmit={handleCreateFolder} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 mb-4 space-y-3 animate-in fade-in duration-150">
                    <p className="text-xs font-bold text-slate-800">Create a New Wishlist Folder</p>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        required
                        placeholder="e.g. VIP Japan Honeymoon 2026, UK Castle Tours..."
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#00C6A6]"
                        autoFocus
                      />
                      <button
                        type="submit"
                        className="bg-[#00C6A6] text-slate-950 font-bold px-4 py-1.5 rounded-lg text-xs hover:bg-[#008972] cursor-pointer"
                      >
                        Create
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsCreatingFolder(false);
                          setNewFolderName('');
                        }}
                        className="bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs hover:bg-slate-300 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                {/* Folder Tabs / Pills */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
                  {folders.map((folder) => {
                    const count = wishlistItems.filter(i => i.folderId === folder.id).length;
                    const isSelected = folder.id === selectedFolderId;
                    return (
                      <button
                        key={folder.id}
                        onClick={() => setSelectedFolderId(folder.id)}
                        className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                          isSelected
                            ? 'bg-slate-900 text-white shadow-sm ring-1 ring-slate-900'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {isSelected ? (
                          <FolderOpen className="w-3.5 h-3.5 text-[#00E5C0]" />
                        ) : (
                          <Folder className="w-3.5 h-3.5 text-slate-400" />
                        )}
                        <span>{folder.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                          isSelected ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active Folder Products View */}
              <div>
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-2">
                    <span>{activeFolder?.name || 'Selected Folder'}</span>
                    <span className="text-slate-400">({activeFolderItems.length} Products)</span>
                  </h3>

                  {activeFolder && !activeFolder.isDefault && (
                    <button
                      onClick={() => handleDeleteFolder(activeFolder.id)}
                      className="text-xs text-red-500 hover:text-red-700 flex items-center space-x-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Folder</span>
                    </button>
                  )}
                </div>

                {activeFolderItems.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
                    <Heart className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-700">No items saved in this folder</p>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                      Browse product cards in the destination catalog and click the heart icon to save products to "{activeFolder?.name}".
                    </p>
                    <button
                      onClick={onExploreProducts}
                      className="bg-[#00C6A6] text-slate-950 font-bold px-4 py-2 rounded-xl text-xs shadow-sm hover:bg-[#008972] cursor-pointer"
                    >
                      Browse Catalogue
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {activeFolderItems.map((item) => {
                      const prod = products.find(p => p.id === item.productId);
                      if (!prod) return null;
                      return (
                        <div
                          key={item.id}
                          className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:border-[#00C6A6]/60 transition-all flex flex-col justify-between"
                        >
                          <div className="relative h-40 bg-slate-100 overflow-hidden">
                            <img
                              src={prod.images[0] || 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=800&auto=format&fit=crop'}
                              alt={prod.name}
                              className="w-full h-full object-cover"
                            />
                            <span className="absolute top-2.5 left-2.5 bg-slate-900/80 backdrop-blur text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center space-x-1">
                              <MapPin className="w-3 h-3 text-[#00C6A6]" />
                              <span>{prod.city}</span>
                            </span>
                            <span className="absolute top-2.5 right-2.5 bg-white/95 backdrop-blur px-2 py-0.5 rounded-md text-[10px] font-bold uppercase text-[#008972]">
                              {prod.category}
                            </span>
                          </div>

                          <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                            <div>
                              <h4 className="font-bold text-slate-900 text-sm line-clamp-1">{prod.name}</h4>
                              <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{prod.shortDescription}</p>
                            </div>

                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                              <div>
                                <span className="text-[10px] text-slate-400 block">Starting from</span>
                                <span className="text-sm font-black text-slate-900 font-sans">
                                  {formatCurrency(prod.sellingPriceStartingFrom, prod.currency)}
                                </span>
                              </div>

                              <div className="flex items-center space-x-1.5">
                                <button
                                  onClick={() => onViewProduct(prod)}
                                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                                  title="View Details"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => handleQuickAddQuote(prod)}
                                  className="p-2 rounded-xl bg-[#00C6A6] hover:bg-[#008972] text-slate-950 font-bold transition-colors cursor-pointer flex items-center space-x-1 text-xs"
                                  title="Add to Itinerary Quote"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Quote</span>
                                </button>

                                <button
                                  onClick={() => handleRemoveItem(item.folderId, item.productId)}
                                  className="p-2 rounded-xl hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                                  title="Remove from Wishlist Folder"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* SAVED CLIENT QUOTATIONS SECTION */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <Bookmark className="w-4 h-4 text-[#008972]" />
                  <span>Saved Client Quotations ({savedQuotes.length})</span>
                </h2>
              </div>

              {savedQuotes.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
                  <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-700">No saved quotations yet</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                    Use the pricing calculator on any product to select items, calculate tiered markups, and save quotations.
                  </p>
                  <button
                    onClick={onExploreProducts}
                    className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Start New Itinerary Quote
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {savedQuotes.map((quote) => (
                    <div
                      key={quote.id}
                      className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs hover:border-slate-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded">
                            {quote.quoteNumber}
                          </span>
                          <span className="text-xs font-bold text-slate-900">{quote.clientName}</span>
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                            {quote.items.length} Products
                          </span>
                        </div>

                        <p className="text-xs text-slate-500">
                          Destination: <span className="font-medium text-slate-700">{quote.destination}</span> • Created: {new Date(quote.createdAt).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end space-x-4 shrink-0">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block">Total Quotation:</span>
                          <span className="text-sm font-black text-slate-900 font-mono">
                            {formatCurrency(quote.totalSellingPrice, quote.currency)}
                          </span>
                        </div>

                        <div className="flex items-center space-x-1.5">
                          <button
                            onClick={() => loadSavedQuote(quote)}
                            className="bg-[#00C6A6]/10 hover:bg-[#00C6A6]/20 text-[#008972] font-bold px-3 py-1.5 rounded-lg text-xs transition-colors flex items-center space-x-1 cursor-pointer"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Open</span>
                          </button>

                          <button
                            onClick={() => deleteSavedQuote(quote.id)}
                            className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg transition-colors cursor-pointer"
                            title="Delete Quote"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Sidebar: Shortcuts & Recommended Products */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Contracted Destinations
            </h3>

            <div className="space-y-2">
              <button
                onClick={() => onSelectDestination('japan')}
                className="w-full p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-between transition-colors text-left cursor-pointer"
              >
                <div>
                  <p className="text-xs font-bold text-slate-900">Japan DMC Portfolio</p>
                  <p className="text-[10px] text-slate-500">Tokyo, Kyoto, Osaka, Mt. Fuji</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                onClick={() => onSelectDestination('united-kingdom')}
                className="w-full p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-between transition-colors text-left cursor-pointer"
              >
                <div>
                  <p className="text-xs font-bold text-slate-900">United Kingdom DMC</p>
                  <p className="text-[10px] text-slate-500">London, Cotswolds, Edinburgh</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                onClick={() => onSelectDestination('europe')}
                className="w-full p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-between transition-colors text-left cursor-pointer"
              >
                <div>
                  <p className="text-xs font-bold text-slate-900">Continental Europe DMC</p>
                  <p className="text-[10px] text-slate-500">Paris, Rome, Swiss Alps, Spain</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>

          {/* Quick Recommended Products */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#00C6A6]" />
              <span>DMC Popular Picks</span>
            </h3>

            <div className="space-y-2.5">
              {featuredProducts.map((p) => (
                <div
                  key={p.id}
                  onClick={() => onViewProduct(p)}
                  className="flex items-center space-x-3 p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <img
                    src={p.images[0]}
                    alt={p.name}
                    className="w-12 h-12 rounded-lg object-cover shrink-0"
                  />
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold text-slate-900 truncate">{p.name}</p>
                    <p className="text-[10px] text-slate-500">{p.city} • {p.duration}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
