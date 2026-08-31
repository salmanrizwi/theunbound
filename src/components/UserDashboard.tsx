import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useQuotation } from '../context/QuotationContext';
import { formatCurrency } from '../services/pricingEngine';
import { Product, WishlistFolder, WishlistItem, Quotation } from '../types';
import { AppDatabase } from '../services/db';
import { ProposalDocumentView } from './ProposalDocumentView';
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
  Check,
  Send,
  Calendar,
  Download,
  Printer,
  ShieldCheck,
  UserCheck,
  X
} from 'lucide-react';

interface UserDashboardProps {
  onExploreProducts: () => void;
  onSelectDestination: (dest: string) => void;
  onViewProduct: (product: Product) => void;
  onNavigateToAccount?: () => void;
  products: Product[];
}

export const UserDashboard: React.FC<UserDashboardProps> = ({
  onExploreProducts,
  onSelectDestination,
  onViewProduct,
  onNavigateToAccount,
  products
}) => {
  const { user } = useAuth();
  const { savedQuotes, loadSavedQuote, deleteSavedQuote, currency, addProductToQuote } = useQuotation();
  const [activeDashboardTab, setActiveDashboardTab] = useState<'QUOTES' | 'WISHLIST'>('WISHLIST');

  // Proposal modal & booking state
  const [viewingProposalQuote, setViewingProposalQuote] = useState<Quotation | null>(null);
  const [bookingSuccessToast, setBookingSuccessToast] = useState<string | null>(null);

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

  const handleAcceptQuoteAndBook = (quote: Quotation) => {
    const booking = db.convertQuotationToBooking(quote.id, user, 'Proposal accepted by client via My Quotes portal.');
    if (booking) {
      setBookingSuccessToast(`Booking reservation ${booking.bookingReference} confirmed! Ground operations desk notified.`);
      setViewingProposalQuote(null);
      setTimeout(() => setBookingSuccessToast(null), 6000);
    }
  };

  const activeFolder = folders.find(f => f.id === selectedFolderId);
  const filteredWishlistItems = wishlistItems.filter(item => item.folderId === selectedFolderId);
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

      {/* Booking Success Toast */}
      {bookingSuccessToast && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-950 text-white px-5 py-4 rounded-2xl shadow-2xl border border-emerald-500 flex items-center space-x-3 text-xs font-semibold animate-in fade-in slide-in-from-top-3 duration-300 max-w-md">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <p className="font-bold text-white">Quotation Accepted</p>
            <p className="text-emerald-200 text-[11px]">{bookingSuccessToast}</p>
          </div>
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
                <span>Verified {user?.role === 'BUYER' ? 'Client / Buyer' : user?.role || 'User'} Account</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold font-sans">
                Welcome back, {user?.name || 'Travel Designer'}
              </h1>
              <p className="text-xs text-slate-300 flex items-center space-x-2 mt-0.5">
                <Building2 className="w-3.5 h-3.5 text-[#00C6A6]" />
                <span>{user?.agencyName || user?.companyName || 'Private Client Account'}</span>
                <span>•</span>
                <span>{user?.email}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {onNavigateToAccount && (
              <button
                onClick={onNavigateToAccount}
                className="bg-slate-800 hover:bg-slate-700 text-white font-semibold px-4 py-2.5 rounded-xl text-xs transition-all border border-slate-700 flex items-center space-x-1.5 cursor-pointer"
              >
                <User className="w-3.5 h-3.5 text-[#00C6A6]" />
                <span>Account & Profile</span>
              </button>
            )}

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
            <span>My Quotes & Proposals</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-950/40 text-white font-mono">
              {savedQuotes.length}
            </span>
          </button>
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-6">
          {activeDashboardTab === 'WISHLIST' ? (
            /* WISHLIST SECTION */
            <div className="space-y-6">
              {/* Folder Selector Tabs */}
              <div className="flex flex-wrap items-center gap-2">
                {folders.map(folder => (
                  <button
                    key={folder.id}
                    onClick={() => setSelectedFolderId(folder.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
                      selectedFolderId === folder.id
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {selectedFolderId === folder.id ? (
                      <FolderOpen className="w-3.5 h-3.5 text-[#00C6A6]" />
                    ) : (
                      <Folder className="w-3.5 h-3.5 text-slate-400" />
                    )}
                    <span>{folder.name}</span>
                    <span className="text-[10px] opacity-70">
                      ({wishlistItems.filter(i => i.folderId === folder.id).length})
                    </span>
                  </button>
                ))}

                {!isCreatingFolder ? (
                  <button
                    onClick={() => setIsCreatingFolder(true)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 flex items-center space-x-1 transition-colors cursor-pointer border border-dashed border-slate-300"
                  >
                    <FolderPlus className="w-3.5 h-3.5 text-slate-500" />
                    <span>New Folder</span>
                  </button>
                ) : (
                  <form onSubmit={handleCreateFolder} className="flex items-center space-x-1.5">
                    <input
                      type="text"
                      placeholder="Folder name..."
                      value={newFolderName}
                      onChange={e => setNewFolderName(e.target.value)}
                      autoFocus
                      className="px-3 py-1 rounded-xl text-xs border border-slate-300 bg-white focus:outline-hidden focus:ring-1 focus:ring-slate-900"
                    />
                    <button
                      type="submit"
                      className="p-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold cursor-pointer"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCreatingFolder(false)}
                      className="p-1.5 bg-slate-200 text-slate-600 rounded-lg text-xs cursor-pointer"
                    >
                      ✕
                    </button>
                  </form>
                )}
              </div>

              {/* Items in Active Folder */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Products in {activeFolder?.name || 'Folder'} ({filteredWishlistItems.length})
                  </h3>

                  {folders.length > 1 && selectedFolderId && (
                    <button
                      onClick={() => handleDeleteFolder(selectedFolderId)}
                      className="text-[11px] text-red-500 hover:text-red-700 font-medium cursor-pointer"
                    >
                      Delete Folder
                    </button>
                  )}
                </div>

                {filteredWishlistItems.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
                    <Heart className="w-10 h-10 text-slate-300 mx-auto" />
                    <div>
                      <p className="text-sm font-bold text-slate-700">This folder is empty</p>
                      <p className="text-xs text-slate-500">
                        Browse the portfolio and click the heart icon on any hotel, tour, or experience to save it here.
                      </p>
                    </div>
                    <button
                      onClick={onExploreProducts}
                      className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
                    >
                      Browse Products
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredWishlistItems.map(item => {
                      const prod = products.find(p => p.id === item.productId);
                      if (!prod) return null;

                      return (
                        <div
                          key={item.id}
                          className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                        >
                          <div>
                            <div className="relative h-36 overflow-hidden">
                              <img
                                src={prod.images?.[0] || 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=1200&auto=format&fit=crop'}
                                alt={prod.name}
                                className="w-full h-full object-cover"
                              />
                              <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-950/80 text-white backdrop-blur-xs">
                                {prod.productType || prod.category}
                              </span>
                            </div>

                            <div className="p-4 space-y-2">
                              <div className="flex items-center space-x-1.5 text-slate-500 text-[11px]">
                                <MapPin className="w-3 h-3 text-[#00C6A6]" />
                                <span>{prod.city}, {prod.country}</span>
                              </div>
                              <h4 className="text-xs font-bold text-slate-900 line-clamp-1">
                                {prod.name}
                              </h4>
                              <p className="text-[11px] text-slate-500 line-clamp-2">
                                {prod.shortDescription}
                              </p>
                            </div>
                          </div>

                          <div className="p-4 pt-0 flex items-center justify-between border-t border-slate-100 mt-2">
                            <div>
                              <span className="text-[10px] text-slate-400 block">Starting From:</span>
                              <span className="text-xs font-black text-slate-900 font-mono">
                                {formatCurrency(prod.sellingPriceStartingFrom, prod.currency)}
                              </span>
                            </div>

                            <div className="flex items-center space-x-1.5">
                              <button
                                onClick={() => onViewProduct(prod)}
                                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                                title="View Product Details"
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
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* SHARED QUOTATIONS & PROPOSALS SECTION */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                    <Bookmark className="w-4 h-4 text-[#008972]" />
                    <span>My Quotations & Proposals ({savedQuotes.length})</span>
                  </h2>
                  <p className="text-xs text-slate-500">
                    Bespoke itineraries prepared by DMC operations and your travel consultants.
                  </p>
                </div>
              </div>

              {savedQuotes.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
                  <FileText className="w-10 h-10 text-slate-300 mx-auto" />
                  <div>
                    <p className="text-sm font-bold text-slate-700">No active quotations found</p>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                      When our DMC operations team or your travel agent prepares a quotation for your account, it will automatically appear here.
                    </p>
                  </div>
                  <button
                    onClick={onExploreProducts}
                    className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Explore Products & Request Quote
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {savedQuotes.map((quote) => {
                    const isBookingRequested = quote.status === 'BOOKING_REQUESTED' || quote.status === 'CONFIRMED';
                    return (
                      <div
                        key={quote.id}
                        className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-all space-y-4"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 pb-3">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[11px] font-mono font-bold bg-slate-900 text-[#00E5C0] px-2.5 py-0.5 rounded-md">
                                {quote.quoteNumber} (v{quote.version || 1})
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                isBookingRequested 
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                                  : 'bg-teal-50 text-teal-800 border border-teal-100'
                              }`}>
                                {isBookingRequested ? 'Booking Requested / In Progress' : quote.status}
                              </span>
                            </div>

                            <h3 className="text-sm font-bold text-slate-900">{quote.title || `Itinerary for ${quote.clientName}`}</h3>
                            
                            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                              <span className="flex items-center space-x-1">
                                <Compass className="w-3.5 h-3.5 text-[#00C6A6]" />
                                <span className="font-semibold text-slate-700">{quote.destination}</span>
                              </span>
                              {quote.travelStartDate && (
                                <span className="flex items-center space-x-1">
                                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                  <span>{quote.travelStartDate} {quote.travelEndDate ? `→ ${quote.travelEndDate}` : ''}</span>
                                </span>
                              )}
                              <span>•</span>
                              <span>{quote.totalPax || (quote.adultsCount || 2)} Travelers</span>
                              <span>•</span>
                              <span>{quote.items?.length || 0} Included Experiences</span>
                            </div>
                          </div>

                          <div className="sm:text-right shrink-0">
                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Total Proposal Value</span>
                            <span className="text-lg font-black text-slate-900 font-mono">
                              {formatCurrency(quote.totalSellingPrice, quote.currency)}
                            </span>
                          </div>
                        </div>

                        {/* Prepared by & Route summary */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <div className="flex items-center space-x-2 text-slate-600">
                            <UserCheck className="w-4 h-4 text-slate-400 shrink-0" />
                            <span>
                              Prepared By: <strong className="text-slate-900">{quote.createdByName || quote.agentName || 'TheUnbound Concierge'}</strong> 
                              {quote.agentAgency ? ` (${quote.agentAgency})` : ''}
                            </span>
                          </div>

                          {quote.validUntil && (
                            <div className="text-slate-400 text-[11px]">
                              Valid Until: {new Date(quote.validUntil).toLocaleDateString()}
                            </div>
                          )}
                        </div>

                        {/* Action Buttons Strip */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => setViewingProposalQuote(quote)}
                              className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-3.5 py-2 rounded-xl text-xs transition-colors flex items-center space-x-1.5 cursor-pointer shadow-xs"
                            >
                              <Eye className="w-3.5 h-3.5 text-[#00E5C0]" />
                              <span>View Proposal Document</span>
                            </button>

                            <button
                              onClick={() => setViewingProposalQuote(quote)}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-2 rounded-xl text-xs transition-colors flex items-center space-x-1.5 cursor-pointer border border-slate-200"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Print / PDF</span>
                            </button>
                          </div>

                          <div className="flex items-center space-x-2">
                            {!isBookingRequested && (
                              <button
                                onClick={() => handleAcceptQuoteAndBook(quote)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition-colors flex items-center space-x-1.5 cursor-pointer shadow-sm"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Accept & Request Booking</span>
                              </button>
                            )}

                            {isBookingRequested && (
                              <div className="flex items-center space-x-1 text-emerald-700 font-bold text-xs bg-emerald-50 px-3 py-1.5 rounded-xl">
                                <Check className="w-3.5 h-3.5" />
                                <span>Booking Reservation Active</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
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

          {/* Direct DMC Ground Support Box */}
          <div className="bg-slate-900 text-white rounded-2xl p-5 space-y-3">
            <div className="flex items-center space-x-2 text-[#00E5C0]">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Ground Operations Desk</span>
            </div>
            <p className="text-xs text-slate-300">
              Need custom routing or high-volume group quotes? Our operations consultants are available 24/7.
            </p>
            <div className="text-[11px] font-mono text-slate-400 space-y-0.5 pt-1">
              <div>Email: operations@theunbound.in</div>
              <div>Direct: +91 9811654959</div>
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

      {/* Interactive Proposal Modal */}
      {viewingProposalQuote && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="relative w-full max-w-5xl my-8">
            <button
              onClick={() => setViewingProposalQuote(null)}
              className="absolute -top-3 -right-3 z-10 w-9 h-9 rounded-full bg-slate-900 text-white hover:bg-slate-800 flex items-center justify-center shadow-xl border border-slate-700 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <ProposalDocumentView
              quote={viewingProposalQuote}
              onClose={() => setViewingProposalQuote(null)}
              onBookNow={(q) => handleAcceptQuoteAndBook(q)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
