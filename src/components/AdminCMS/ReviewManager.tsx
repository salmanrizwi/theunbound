import React, { useState } from 'react';
import { GoogleReview } from '../../types';
import { AppDatabase } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { ImageUploadOrUrlInput } from '../ImageUploadOrUrlInput';
import { 
  Star, 
  Plus, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Search, 
  DownloadCloud, 
  Sparkles, 
  MessageSquare, 
  ShieldCheck, 
  Building,
  Calendar,
  ThumbsUp,
  Globe,
  Check,
  MapPin,
  ExternalLink,
  Link2,
  RefreshCw
} from 'lucide-react';

export const ReviewManager: React.FC = () => {
  const db = AppDatabase.getInstance();
  const { user } = useAuth();
  const [reviews, setReviews] = useState<GoogleReview[]>(() => db.getReviews());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRating, setFilterRating] = useState('ALL');
  const [filterVisibility, setFilterVisibility] = useState('ALL');
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReview, setEditingReview] = useState<GoogleReview | null>(null);

  // Importer Modal State
  const [isImporterOpen, setIsImporterOpen] = useState(false);
  const [importerQuery, setImporterQuery] = useState('https://www.google.com/maps/place/The+Unbound+DMC+Japan');
  const [isFetchingReviews, setIsFetchingReviews] = useState(false);
  const [fetchedReviews, setFetchedReviews] = useState<GoogleReview[]>([]);
  const [selectedReviewIds, setSelectedReviewIds] = useState<string[]>([]);
  const [detectedBusinessName, setDetectedBusinessName] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<GoogleReview>>({
    authorName: '',
    authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop',
    rating: 5,
    reviewText: '',
    date: new Date().toISOString().split('T')[0],
    relativeTimeDescription: 'Recent',
    destination: 'Japan',
    locationName: 'TheUnbound Ground Operations',
    source: 'GOOGLE_BUSINESS',
    verifiedPartner: true,
    isFeatured: true,
    isVisible: true,
    displayOrder: 1,
    helpfulCount: 10
  });

  const refresh = () => {
    setReviews(db.getReviews());
  };

  const handleOpenCreate = () => {
    setEditingReview(null);
    setFormData({
      authorName: '',
      authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop',
      rating: 5,
      reviewText: '',
      date: new Date().toISOString().split('T')[0],
      relativeTimeDescription: 'Just now',
      destination: 'Japan',
      locationName: 'TheUnbound Global Operations Hub',
      source: 'GOOGLE_BUSINESS',
      verifiedPartner: true,
      isFeatured: false,
      isVisible: true,
      displayOrder: reviews.length + 1,
      helpfulCount: 5
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (rev: GoogleReview) => {
    setEditingReview(rev);
    setFormData({ ...rev });
    setIsModalOpen(true);
  };

  const handleSearchGoogleReviews = (queryToUse?: string) => {
    const q = queryToUse !== undefined ? queryToUse : importerQuery;
    setIsFetchingReviews(true);
    setTimeout(() => {
      const results = db.searchAndImportGoogleReviews(q, user);
      setFetchedReviews(results.reviews);
      setSelectedReviewIds(results.reviews.map(r => r.id));
      setDetectedBusinessName(results.businessName);
      setIsFetchingReviews(false);
    }, 700);
  };

  const handleCommitImportedReviews = () => {
    const selected = fetchedReviews.filter(r => selectedReviewIds.includes(r.id));
    selected.forEach(r => {
      db.saveReview(r, user);
    });
    refresh();
    setIsImporterOpen(false);
    setSyncStatus(`Successfully imported ${selected.length} verified Google reviews for "${detectedBusinessName || 'Your Business'}".`);
    setTimeout(() => setSyncStatus(null), 5000);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.authorName || !formData.reviewText) return;

    const reviewToSave: GoogleReview = {
      id: editingReview ? editingReview.id : `rev-${Date.now()}`,
      authorName: formData.authorName || 'Guest',
      authorAvatar: formData.authorAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop',
      rating: Number(formData.rating) || 5,
      reviewText: formData.reviewText || '',
      date: formData.date || new Date().toISOString().split('T')[0],
      relativeTimeDescription: formData.relativeTimeDescription || 'Recently',
      destination: formData.destination || 'Global',
      locationName: formData.locationName || 'TheUnbound Operations',
      source: formData.source || 'GOOGLE_BUSINESS',
      verifiedPartner: formData.verifiedPartner ?? true,
      isFeatured: formData.isFeatured ?? false,
      isVisible: formData.isVisible ?? true,
      displayOrder: Number(formData.displayOrder) || 1,
      helpfulCount: Number(formData.helpfulCount) || 0,
      responseFromOwner: formData.responseFromOwner
    };

    db.saveReview(reviewToSave, user);
    refresh();
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this verified review?')) {
      db.deleteReview(id, user);
      refresh();
    }
  };

  const handleToggleVisibility = (rev: GoogleReview) => {
    db.saveReview({ ...rev, isVisible: !rev.isVisible }, user);
    refresh();
  };

  const handleToggleFeatured = (rev: GoogleReview) => {
    db.saveReview({ ...rev, isFeatured: !rev.isFeatured }, user);
    refresh();
  };

  const filtered = reviews.filter(r => {
    const matchesSearch = r.authorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.reviewText.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.destination.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRating = filterRating === 'ALL' || r.rating.toString() === filterRating;
    const matchesVis = filterVisibility === 'ALL' || 
      (filterVisibility === 'VISIBLE' && r.isVisible) || 
      (filterVisibility === 'HIDDEN' && !r.isVisible);
    return matchesSearch && matchesRating && matchesVis;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2 text-[#008972] font-bold text-xs uppercase tracking-wider mb-1">
            <Globe className="w-4 h-4 text-[#00C6A6]" />
            <span>Reputation & Social Proof</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">Google My Business & Verified Reviews</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Sync Google Business profile ratings, feature testimonials on landing pages, and moderate display visibility.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              setIsImporterOpen(true);
              handleSearchGoogleReviews();
            }}
            className="inline-flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-2.5 rounded-xl text-xs transition-all shadow-xs cursor-pointer"
          >
            <DownloadCloud className="w-4 h-4 text-[#00C6A6]" />
            <span>Fetch from Google Business URL</span>
          </button>
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center space-x-2 bg-[#008972] hover:bg-[#00C6A6] text-white hover:text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Review</span>
          </button>
        </div>
      </div>

      {syncStatus && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-xs font-semibold flex items-center space-x-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{syncStatus}</span>
        </div>
      )}

      {/* Search & Filter */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search author, keywords, destination..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#00C6A6]"
          />
        </div>

        <div>
          <select
            value={filterRating}
            onChange={e => setFilterRating(e.target.value)}
            className="w-full py-2 px-3 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#00C6A6]"
          >
            <option value="ALL">All Star Ratings</option>
            <option value="5">5 Stars Only</option>
            <option value="4">4 Stars</option>
            <option value="3">3 Stars or below</option>
          </select>
        </div>

        <div>
          <select
            value={filterVisibility}
            onChange={e => setFilterVisibility(e.target.value)}
            className="w-full py-2 px-3 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#00C6A6]"
          >
            <option value="ALL">All Visibility</option>
            <option value="VISIBLE">Visible (Public)</option>
            <option value="HIDDEN">Hidden</option>
          </select>
        </div>
      </div>

      {/* Reviews Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Author & Source</th>
                <th className="py-3 px-4">Rating</th>
                <th className="py-3 px-4">Review Text</th>
                <th className="py-3 px-4">Destination</th>
                <th className="py-3 px-4">Status & Featured</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(rev => (
                <tr key={rev.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center space-x-3">
                      <img
                        src={rev.authorAvatar}
                        alt={rev.authorName}
                        className="w-9 h-9 rounded-full object-cover border border-slate-200"
                      />
                      <div>
                        <div className="font-bold text-slate-900 text-xs">{rev.authorName}</div>
                        <div className="text-[10px] text-slate-400 flex items-center space-x-1">
                          <span>{rev.source}</span>
                          {rev.verifiedPartner && <ShieldCheck className="w-3 h-3 text-[#00C6A6]" />}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center space-x-1 text-amber-500">
                      {Array.from({ length: rev.rating }).map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />
                      ))}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{rev.relativeTimeDescription || rev.date}</div>
                  </td>
                  <td className="py-3.5 px-4 max-w-xs">
                    <p className="text-slate-700 font-medium line-clamp-2 leading-relaxed">&ldquo;{rev.reviewText}&rdquo;</p>
                    {rev.responseFromOwner && (
                      <div className="mt-1.5 p-2 bg-slate-50 rounded-lg border border-slate-200 text-[10px] text-slate-600">
                        <span className="font-bold text-[#008972]">Owner response: </span>
                        {rev.responseFromOwner.text}
                      </div>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded">
                      {rev.destination}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex flex-col space-y-1">
                      <button
                        onClick={() => handleToggleVisibility(rev)}
                        className={`inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer ${
                          rev.isVisible ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {rev.isVisible ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        <span>{rev.isVisible ? 'Public' : 'Hidden'}</span>
                      </button>
                      <button
                        onClick={() => handleToggleFeatured(rev)}
                        className={`inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer ${
                          rev.isFeatured ? 'bg-amber-100 text-amber-800' : 'bg-slate-50 text-slate-400'
                        }`}
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>{rev.isFeatured ? 'Featured' : 'Standard'}</span>
                      </button>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end space-x-1.5">
                      <button
                        onClick={() => handleOpenEdit(rev)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
                        title="Edit Review"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(rev.id)}
                        className="p-1.5 text-rose-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer"
                        title="Delete Review"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Google Reviews Importer Modal */}
      {isImporterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center space-x-2 text-[#008972] font-bold text-xs uppercase tracking-wider mb-1">
                  <DownloadCloud className="w-4 h-4 text-[#00C6A6]" />
                  <span>Google My Business (GMB) Integration</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900">Fetch Google Customer Reviews</h3>
                <p className="text-xs text-slate-500">
                  Paste your Google My Business profile URL, Google Maps place link, or business query to import genuine verified reviews.
                </p>
              </div>
              <button
                onClick={() => setIsImporterOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-2 rounded-full cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Search / GMB URL Input Box */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Google My Business Profile URL or Maps Link *
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={importerQuery}
                    onChange={e => setImporterQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSearchGoogleReviews(); } }}
                    placeholder="e.g. https://maps.app.goo.gl/... or https://www.google.com/maps/place/..."
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#00C6A6]"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleSearchGoogleReviews()}
                  disabled={isFetchingReviews}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center space-x-1.5 shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-[#00C6A6] ${isFetchingReviews ? 'animate-spin' : ''}`} />
                  <span>{isFetchingReviews ? 'Fetching...' : 'Fetch Reviews'}</span>
                </button>
              </div>

              {/* URL Sample Presets */}
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 pt-1">
                <span className="font-semibold text-slate-700 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-[#00C6A6]" />
                  <span>Quick Presets:</span>
                </span>
                {[
                  { label: 'Google Maps Place URL', url: 'https://www.google.com/maps/place/The+Unbound+DMC+Japan' },
                  { label: 'maps.app.goo.gl Shortlink', url: 'https://maps.app.goo.gl/TheUnboundLuxuryDMC' },
                  { label: 'g.page Profile', url: 'https://g.page/TheUnboundExperiences' },
                  { label: 'Business Name', url: 'TheUnbound Ground Operations' }
                ].map((sample, sIdx) => (
                  <button
                    key={sIdx}
                    type="button"
                    onClick={() => {
                      setImporterQuery(sample.url);
                      handleSearchGoogleReviews(sample.url);
                    }}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-[#00C6A6]/10 text-slate-700 hover:text-[#008972] border border-slate-200 rounded-md text-[10px] cursor-pointer"
                  >
                    {sample.label}
                  </button>
                ))}
              </div>

              {detectedBusinessName && (
                <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2 text-emerald-900">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      Detected Profile: <strong>{detectedBusinessName}</strong>
                    </span>
                  </div>
                  <span className="text-[10px] bg-emerald-200/60 text-emerald-800 font-bold px-2 py-0.5 rounded-md">
                    Google Verified
                  </span>
                </div>
              )}
            </div>

            {/* Fetched Reviews List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>Fetched Google Reviews ({fetchedReviews.length})</span>
                <span className="text-[11px] text-slate-500">{selectedReviewIds.length} Selected for Import</span>
              </div>

              <div className="space-y-2.5 max-h-64 overflow-y-auto">
                {fetchedReviews.map(rev => {
                  const isSelected = selectedReviewIds.includes(rev.id);
                  return (
                    <div
                      key={rev.id}
                      onClick={() => {
                        setSelectedReviewIds(prev => 
                          prev.includes(rev.id) ? prev.filter(id => id !== rev.id) : [...prev, rev.id]
                        );
                      }}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start space-x-3 ${
                        isSelected ? 'bg-emerald-50/60 border-emerald-300' : 'bg-slate-50 border-slate-200 opacity-60'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="w-4 h-4 text-[#008972] rounded mt-1 pointer-events-none"
                      />
                      <img src={rev.authorAvatar} alt={rev.authorName} className="w-8 h-8 rounded-full object-cover shrink-0" />
                      <div className="flex-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">{rev.authorName}</span>
                          <div className="flex items-center text-amber-500">
                            {Array.from({ length: rev.rating }).map((_, i) => (
                              <Star key={i} className="w-3 h-3 fill-amber-400" />
                            ))}
                          </div>
                        </div>
                        <p className="text-slate-600 line-clamp-2 mt-1">&quot;{rev.reviewText}&quot;</p>
                        <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-2">
                          <span>{rev.destination}</span>
                          <span>•</span>
                          <span>{rev.date}</span>
                          <span>•</span>
                          <span className="text-emerald-700 font-semibold">{rev.locationName}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsImporterOpen(false)}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCommitImportedReviews}
                disabled={selectedReviewIds.length === 0}
                className="px-6 py-2.5 bg-[#008972] hover:bg-[#00C6A6] text-white hover:text-slate-950 font-bold rounded-xl text-xs shadow-xs cursor-pointer transition-colors disabled:opacity-40"
              >
                Import {selectedReviewIds.length} Reviews to Storefront
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit / Create Modal with Reviewer Photo Upload */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {editingReview ? 'Edit Review' : 'Add New Guest Review'}
                </h3>
                <p className="text-xs text-slate-500">Configure author details, avatar photo, rating, testimonial text, and response.</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-2 rounded-full cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              {/* Reviewer Avatar Upload / Unsplash */}
              <div>
                <ImageUploadOrUrlInput
                  label="Reviewer Profile Photo (Upload or fetch Unsplash avatar)"
                  value={formData.authorAvatar || ''}
                  onChange={url => setFormData({ ...formData, authorAvatar: url })}
                  category="customers"
                  defaultSearchTopic="Traveler portrait"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Author Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.authorName || ''}
                    onChange={e => setFormData({ ...formData, authorName: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Destination</label>
                  <input
                    type="text"
                    value={formData.destination || ''}
                    onChange={e => setFormData({ ...formData, destination: e.target.value })}
                    placeholder="e.g. Japan, UK"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Star Rating (1 to 5)</label>
                  <select
                    value={formData.rating}
                    onChange={e => setFormData({ ...formData, rating: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="5">★★★★★ (5 Stars)</option>
                    <option value="4">★★★★☆ (4 Stars)</option>
                    <option value="3">★★★☆☆ (3 Stars)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Review Date</label>
                  <input
                    type="date"
                    value={formData.date || ''}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Review Content *</label>
                <textarea
                  rows={4}
                  required
                  value={formData.reviewText || ''}
                  onChange={e => setFormData({ ...formData, reviewText: e.target.value })}
                  placeholder="Paste guest review text..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Official Owner Response (Optional)</label>
                <textarea
                  rows={2}
                  value={formData.responseFromOwner?.text || ''}
                  onChange={e => setFormData({
                    ...formData,
                    responseFromOwner: e.target.value ? {
                      text: e.target.value,
                      date: new Date().toISOString().split('T')[0]
                    } : undefined
                  })}
                  placeholder="Thank the guest or provide operational comments..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#008972] hover:bg-[#00C6A6] text-white hover:text-slate-950 font-bold rounded-xl shadow-xs cursor-pointer transition-colors"
                >
                  Save Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
