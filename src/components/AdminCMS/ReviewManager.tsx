import React, { useState, useEffect } from 'react';
import { GoogleReview, GoogleBusinessProfileConfig, GoogleBusinessVerificationReport, GoogleReviewSyncResult } from '../../types';
import { AppDatabase } from '../../services/db';
import { googleBusinessService, GBPAccount, GBPLocation } from '../../services/googleBusinessService';
import { googleAuth, GoogleAuthState } from '../../services/googleAuth';
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
  RefreshCw,
  AlertTriangle,
  Settings,
  Lock,
  Key,
  Layers,
  HelpCircle,
  LogOut,
  Info,
  AlertCircle
} from 'lucide-react';

const DEFAULT_MAPS_URL = 'https://maps.app.goo.gl/oXYBiMGguZvkbqfw5';

export const ReviewManager: React.FC = () => {
  const db = AppDatabase.getInstance();
  const { user } = useAuth();
  
  // Reviews and Config State
  const [reviews, setReviews] = useState<GoogleReview[]>(() => db.getReviews());
  const [gbpConfig, setGbpConfig] = useState<GoogleBusinessProfileConfig>(() => googleBusinessService.getConfig());
  const [authState, setAuthState] = useState<GoogleAuthState>(() => googleAuth.getAuthState());

  useEffect(() => {
    const unsub = db.subscribe(() => {
      setReviews(db.getReviews());
    });
    return () => unsub();
  }, [db]);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRating, setFilterRating] = useState('ALL');
  const [filterVisibility, setFilterVisibility] = useState('ALL');

  // Operation States
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<GoogleReviewSyncResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationReport, setVerificationReport] = useState<GoogleBusinessVerificationReport | null>(null);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  
  // Settings / Connection Modal State
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [tempMapsUrl, setTempMapsUrl] = useState(gbpConfig.mapsUrl || 'https://maps.app.goo.gl/oXYBiMGguZvkbqfw5');
  const [manualToken, setManualToken] = useState('');
  const [gbpAccounts, setGbpAccounts] = useState<GBPAccount[]>([]);
  const [gbpLocations, setGbpLocations] = useState<GBPLocation[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState(gbpConfig.googleAccountId || '');
  const [selectedLocationId, setSelectedLocationId] = useState(gbpConfig.googleLocationId || '');
  const [tempPlacesApiKey, setTempPlacesApiKey] = useState(gbpConfig.placesApiKey || '');
  const [tempPlaceId, setTempPlaceId] = useState(gbpConfig.placeId || '');
  const [isTestingPlacesApi, setIsTestingPlacesApi] = useState(false);
  const [placesTestResult, setPlacesTestResult] = useState<string | null>(null);
  const [settingsTab, setSettingsTab] = useState<'CONNECTION' | 'LOCATION' | 'PLACES_API' | 'DISPLAY'>('PLACES_API');
  const [showIdGuide, setShowIdGuide] = useState(true);
  const [showGcpExplanation, setShowGcpExplanation] = useState(false);
  const [inlineAccountId, setInlineAccountId] = useState(gbpConfig.googleAccountId || '');
  const [inlineLocationId, setInlineLocationId] = useState(gbpConfig.googleLocationId || '');
  const [inlinePlacesApiKey, setInlinePlacesApiKey] = useState(gbpConfig.placesApiKey || '');
  const [isSavingInline, setIsSavingInline] = useState(false);

  // Review Edit/Create Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReview, setEditingReview] = useState<GoogleReview | null>(null);
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
    displayOrder: 1
  });

  // Subscribe to Google Auth changes
  useEffect(() => {
    const unsub = googleAuth.subscribe(state => {
      setAuthState(state);
    });
    return () => unsub();
  }, []);

  const refreshReviewsList = () => {
    const fresh = db.getReviews();
    setReviews(fresh);
    const updatedConfig = googleBusinessService.getConfig();
    setGbpConfig(updatedConfig);
    setSelectedAccountId(updatedConfig.googleAccountId || '');
    setSelectedLocationId(updatedConfig.googleLocationId || '');
    setTempMapsUrl(updatedConfig.mapsUrl || DEFAULT_MAPS_URL);
  };

  const openSettingsModal = (tab: 'CONNECTION' | 'LOCATION' | 'PLACES_API' | 'DISPLAY' = 'PLACES_API') => {
    setSelectedAccountId(gbpConfig.googleAccountId || '');
    setSelectedLocationId(gbpConfig.googleLocationId || '');
    setTempMapsUrl(gbpConfig.mapsUrl || DEFAULT_MAPS_URL);
    setTempPlacesApiKey(gbpConfig.placesApiKey || '');
    setTempPlaceId(gbpConfig.placeId || '');
    setPlacesTestResult(null);
    setSettingsTab(tab);
    setIsSettingsModalOpen(true);
  };

  const handleTestPlacesApi = async () => {
    if (!tempPlacesApiKey.trim()) {
      alert('Please enter a Google Places API Key to test.');
      return;
    }
    const targetPlaceId = tempPlaceId.trim() || gbpConfig.placeId;
    if (!targetPlaceId) {
      alert('Please enter or verify the Google Place ID.');
      return;
    }

    setIsTestingPlacesApi(true);
    setPlacesTestResult(null);
    try {
      const fetched = await googleBusinessService.fetchPlacesApiReviews(targetPlaceId, tempPlacesApiKey.trim());
      setPlacesTestResult(`Success! Retrieved ${fetched.length} verified reviews from Google Places API.`);
      refreshReviewsList();
    } catch (err: any) {
      setPlacesTestResult(`Places API Error: ${err.message || String(err)}`);
    } finally {
      setIsTestingPlacesApi(false);
    }
  };

  // ==========================================
  // REAL GOOGLE AUTH & CONNECTION HANDLERS
  // ==========================================
  const handleGoogleSignIn = async () => {
    try {
      await googleAuth.signIn();
      await handleFetchAccounts();
    } catch (err: any) {
      if (err?.message && (err.message.includes('cancelled') || err.message.includes('closed'))) {
        // User voluntarily closed the popup; return silently
        return;
      }
      console.warn('Google Sign-In notice:', err?.message || err);
    }
  };

  const handleManualTokenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualToken.trim()) return;
    try {
      googleAuth.setManualToken(manualToken.trim());
      setManualToken('');
      handleFetchAccounts();
    } catch (err: any) {
      console.warn('Manual Token notice:', err?.message || err);
    }
  };

  const handleFetchAccounts = async () => {
    setIsLoadingAccounts(true);
    try {
      const accounts = await googleBusinessService.fetchGBPAccounts();
      setGbpAccounts(accounts);
      if (accounts.length > 0 && !selectedAccountId) {
        setSelectedAccountId(accounts[0].name);
        await handleFetchLocations(accounts[0].name);
      }
    } catch (err: any) {
      console.warn('Could not fetch GBP accounts list:', err);
    } finally {
      setIsLoadingAccounts(false);
    }
  };

  const handleFetchLocations = async (accountId: string) => {
    if (!accountId) return;
    setIsLoadingAccounts(true);
    try {
      const locations = await googleBusinessService.fetchGBPLocations(accountId);
      setGbpLocations(locations);
      if (locations.length > 0 && !selectedLocationId) {
        setSelectedLocationId(locations[0].locationId || locations[0].name);
      }
    } catch (err: any) {
      console.warn('Could not fetch GBP locations list:', err);
    } finally {
      setIsLoadingAccounts(false);
    }
  };

  const handleSaveConnectionSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const resolved = googleBusinessService.resolveMapsUrl(tempMapsUrl);
    
    const updated = googleBusinessService.saveConfig({
      mapsUrl: resolved.cleanUrl,
      businessName: resolved.businessName || 'TheUnbound',
      googleAccountId: selectedAccountId.trim(),
      googleLocationId: selectedLocationId.trim(),
      placeId: tempPlaceId.trim() || resolved.placeId || gbpConfig.placeId,
      placesApiKey: tempPlacesApiKey.trim() || null,
      isConnected: authState.isAuthenticated
    }, user);

    setGbpConfig(updated);
    setInlineAccountId(updated.googleAccountId || '');
    setInlineLocationId(updated.googleLocationId || '');
    setInlinePlacesApiKey(updated.placesApiKey || '');
    setIsSettingsModalOpen(false);
  };

  const handleInlineSaveAndSync = async () => {
    if (!inlineLocationId.trim() && !inlinePlacesApiKey.trim()) {
      alert('Please enter your Google Location ID or Google Places API Key.');
      return;
    }
    setIsSavingInline(true);
    try {
      const updated = googleBusinessService.saveConfig({
        googleAccountId: inlineAccountId.trim() || gbpConfig.googleAccountId,
        googleLocationId: inlineLocationId.trim() || gbpConfig.googleLocationId,
        placesApiKey: inlinePlacesApiKey.trim() || gbpConfig.placesApiKey,
        isConnected: authState.isAuthenticated
      }, user);
      setGbpConfig(updated);
      setSelectedAccountId(updated.googleAccountId || '');
      setSelectedLocationId(updated.googleLocationId || '');
      setTempPlacesApiKey(updated.placesApiKey || '');
      await handleSyncNow();
    } catch (err: any) {
      console.warn('Could not save inline GBP config:', err);
    } finally {
      setIsSavingInline(false);
    }
  };

  // ==========================================
  // REAL REVIEW SYNC PROTOCOL
  // ==========================================
  const handleSyncNow = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const res = await googleBusinessService.syncGoogleReviews(user);
      setSyncResult(res);
      refreshReviewsList();
    } catch (err: any) {
      setSyncResult({
        success: false,
        retrievedCount: 0,
        newCount: 0,
        updatedCount: 0,
        unchangedCount: 0,
        errorCount: 1,
        lastSyncedAt: new Date().toISOString(),
        reviews: [],
        errorMessage: err.message || 'Unexpected sync error',
        errorDetails: {
          code: 500,
          message: err.message,
          reason: 'EXECUTION_ERROR',
          resolution: 'Connect the Google account that manages TheUnbound Business Profile.'
        }
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // ==========================================
  // INTEGRATION HEALTH VERIFICATION
  // ==========================================
  const handleVerifyIntegration = async () => {
    setIsVerifying(true);
    try {
      const report = await googleBusinessService.verifyIntegrationHealth(user);
      setVerificationReport(report);
      setIsVerificationModalOpen(true);
      setGbpConfig(googleBusinessService.getConfig());
    } catch (err: any) {
      alert(`Verification check error: ${err.message}`);
    } finally {
      setIsVerifying(false);
    }
  };

  // ==========================================
  // MODERATION & CRUD ACTIONS
  // ==========================================
  const handleToggleVisibility = (review: GoogleReview) => {
    const updated = { ...review, isVisible: !review.isVisible };
    db.saveReview(updated, user);
    refreshReviewsList();
  };

  const handleToggleFeatured = (review: GoogleReview) => {
    const updated = { ...review, isFeatured: !review.isFeatured };
    db.saveReview(updated, user);
    refreshReviewsList();
  };

  const handleDelete = (reviewId: string) => {
    if (confirm('Are you sure you want to delete this Google Review from the platform?')) {
      db.deleteReview(reviewId, user);
      refreshReviewsList();
    }
  };

  const handleClearAll = async () => {
    if (confirm('Are you sure you want to clear all synced reviews? You can re-sync anytime from Google Business Profile.')) {
      await googleBusinessService.clearAllReviews(user);
      refreshReviewsList();
    }
  };

  const handleOpenCreate = () => {
    setEditingReview(null);
    setFormData({
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
      displayOrder: reviews.length + 1
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (review: GoogleReview) => {
    setEditingReview(review);
    setFormData({ ...review });
    setIsModalOpen(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.authorName || !formData.reviewText) return;

    const reviewToSave: GoogleReview = {
      id: editingReview?.id || `gbp-manual-${Date.now()}`,
      authorName: formData.authorName,
      authorAvatar: formData.authorAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop',
      rating: Number(formData.rating) || 5,
      reviewText: formData.reviewText,
      date: formData.date || new Date().toISOString().split('T')[0],
      relativeTimeDescription: formData.relativeTimeDescription || 'Verified Customer',
      destination: formData.destination || 'Japan',
      locationName: formData.locationName || 'TheUnbound Ground Operations',
      source: formData.source || 'GOOGLE_BUSINESS',
      sourceUrl: gbpConfig.mapsUrl,
      verifiedPartner: formData.verifiedPartner ?? true,
      isFeatured: formData.isFeatured ?? true,
      isVisible: formData.isVisible ?? true,
      displayOrder: formData.displayOrder || 1,
      responseFromOwner: formData.responseFromOwner
    };

    db.saveReview(reviewToSave, user);
    setIsModalOpen(false);
    refreshReviewsList();
  };

  // Filter Reviews
  const filtered = reviews.filter(rev => {
    const matchesSearch = 
      (rev.authorName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (rev.reviewText || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (rev.destination || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRating = filterRating === 'ALL' || rev.rating === Number(filterRating);
    const matchesVis = filterVisibility === 'ALL' || 
      (filterVisibility === 'VISIBLE' && rev.isVisible) ||
      (filterVisibility === 'HIDDEN' && !rev.isVisible);

    return matchesSearch && matchesRating && matchesVis;
  });

  const totalReviewsCount = reviews.length;
  const avgRatingCalculated = totalReviewsCount > 0 
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviewsCount).toFixed(1)
    : '0.0';

  return (
    <div className="space-y-6">
      {/* Header & Status Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-100">
          <div className="space-y-2">
            <div className="flex items-center space-x-2.5">
              <span className="p-2 bg-[#008972]/10 text-[#008972] rounded-xl">
                <Globe className="w-5 h-5" />
              </span>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-bold text-slate-900">Google Business Profile Reviews</h1>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${
                  authState.isAuthenticated 
                    ? 'bg-emerald-100 text-emerald-800' 
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {authState.isAuthenticated ? 'Google OAuth Connected' : 'Google Auth Required'}
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-500 max-w-2xl">
              Synchronize real, verified customer reviews from <strong>{gbpConfig.businessName}</strong> Google Business Profile. Reviews are retrieved via the official Google Business Profile API and persisted to Firestore (<code>google_reviews</code>).
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleVerifyIntegration}
              disabled={isVerifying}
              className="inline-flex items-center space-x-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-50"
              title="Run multi-step health check on Google OAuth, GBP permissions and API endpoints"
            >
              <ShieldCheck className={`w-4 h-4 text-[#008972] ${isVerifying ? 'animate-pulse' : ''}`} />
              <span>{isVerifying ? 'Verifying...' : 'Verify Integration'}</span>
            </button>

            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="inline-flex items-center space-x-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              title="Configure Maps URL, GBP Location and Display Settings"
            >
              <Settings className="w-4 h-4 text-slate-600" />
              <span>Connection Settings</span>
            </button>

            <button
              onClick={handleSyncNow}
              disabled={isSyncing}
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-[#008972] hover:bg-[#00C6A6] text-white hover:text-slate-950 font-bold rounded-xl text-xs transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing Reviews...' : 'Sync Reviews Now'}</span>
            </button>

            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center space-x-2 px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#00C6A6]" />
              <span>Add Manual Review</span>
            </button>
          </div>
        </div>

        {/* Business Profile Location Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-1">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Target Business</div>
            <div className="text-sm font-bold text-slate-900 mt-1 flex items-center justify-between">
              <span>{gbpConfig.businessName}</span>
              <Building className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-[11px] text-slate-500 truncate mt-0.5" title={gbpConfig.formattedAddress}>
              {gbpConfig.formattedAddress}
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Google Business IDs</div>
              <button
                onClick={() => openSettingsModal('LOCATION')}
                className="text-[10px] font-bold text-[#008972] hover:underline cursor-pointer"
              >
                Configure
              </button>
            </div>
            <div className="text-xs font-bold text-slate-900 mt-1 truncate">
              {gbpConfig.googleLocationId ? (
                <span className="font-mono text-emerald-700">Loc: {gbpConfig.googleLocationId}</span>
              ) : (
                <span className="text-rose-600 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 inline" /> Location ID Not Set
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 truncate font-mono">
              Acc: {gbpConfig.googleAccountId || 'Default / Auto'}
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Synced Reviews</div>
            <div className="text-sm font-bold text-slate-900 mt-1 flex items-center justify-between">
              <span className="font-mono">{totalReviewsCount} Reviews</span>
              <div className="flex items-center text-amber-500 font-mono text-xs font-bold space-x-1">
                <Star className="w-3.5 h-3.5 fill-amber-400" />
                <span>{avgRatingCalculated}</span>
              </div>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Public on Homepage: {reviews.filter(r => r.isVisible).length}
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Last Sync Timestamp</div>
            <div className="text-xs font-bold text-slate-800 mt-1 flex items-center justify-between">
              <span>{gbpConfig.lastSyncedAt ? new Date(gbpConfig.lastSyncedAt).toLocaleString() : 'Not Synced Yet'}</span>
              <Calendar className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 truncate">
              {authState.email ? `OAuth: ${authState.email}` : 'No Google account connected'}
            </div>
          </div>
        </div>
      </div>

      {/* Real Sync Result Banner */}
      {syncResult && (
        <div className={`p-5 rounded-2xl border transition-all animate-in fade-in ${
          syncResult.success 
            ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950' 
            : 'bg-rose-50/90 border-rose-300 text-rose-950'
        }`}>
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3 w-full">
              {syncResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-2 flex-1">
                <div className="text-sm font-bold">
                  {syncResult.success 
                    ? 'Google Business Profile Synchronization Succeeded' 
                    : 'Google Business Profile Synchronization Notice'}
                </div>
                {syncResult.success ? (
                  <div className="text-xs text-emerald-800 space-y-1">
                    <p>
                      Retrieved <strong>{syncResult.retrievedCount}</strong> reviews from Google Business Profile.
                    </p>
                    <div className="flex items-center space-x-4 text-[11px] font-semibold text-emerald-900 pt-1">
                      <span>✓ New: {syncResult.newCount}</span>
                      <span>•</span>
                      <span>✓ Updated: {syncResult.updatedCount}</span>
                      <span>•</span>
                      <span>✓ Unchanged: {syncResult.unchangedCount}</span>
                      <span>•</span>
                      <span>Errors: 0</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-rose-900 space-y-2.5 max-w-3xl">
                    <p className="font-semibold">{syncResult.errorMessage}</p>
                    {syncResult.errorDetails && (
                      <div className="p-3 bg-white/90 rounded-xl border border-rose-200 text-slate-800 space-y-1 text-[11px]">
                        <div><strong>Reason:</strong> <span className="font-mono text-rose-700 font-bold">{syncResult.errorDetails.reason}</span></div>
                        <div><strong>How to fix:</strong> {syncResult.errorDetails.resolution}</div>
                      </div>
                    )}

                    {/* Quick Places API Connect Form when legacy API or permission denied */}
                    {(syncResult.errorDetails?.reason === 'GBP_API_LEGACY_RESTRICTED' ||
                      syncResult.errorDetails?.reason === 'PERMISSION_DENIED' ||
                      syncResult.errorMessage?.includes('482123123310') ||
                      syncResult.errorMessage?.includes('mybusiness.googleapis.com')) && (
                      <div className="p-4 bg-white rounded-xl border border-amber-300 shadow-xs space-y-3 mt-2 text-slate-900">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs flex items-center gap-1.5 text-amber-950">
                            <Sparkles className="w-4 h-4 text-[#008972]" />
                            <span>Recommended: Fetch Live Reviews via Google Places API</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => openSettingsModal('PLACES_API')}
                            className="text-[#008972] hover:underline font-bold text-[11px] cursor-pointer"
                          >
                            Open Places Settings →
                          </button>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          Because Google restricts legacy My Business v4 API enablement on standard cloud projects, enter your Google Places API Key to pull verified reviews directly:
                        </p>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Google Places API Key</label>
                          <div className="flex gap-2">
                            <input
                              type="password"
                              value={inlinePlacesApiKey}
                              onChange={e => setInlinePlacesApiKey(e.target.value)}
                              placeholder="AIzaSyB-..."
                              className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                            />
                            <button
                              type="button"
                              onClick={handleInlineSaveAndSync}
                              disabled={isSavingInline || isSyncing || !inlinePlacesApiKey.trim()}
                              className="px-4 py-2 bg-[#008972] hover:bg-[#00C6A6] text-white hover:text-slate-950 font-bold rounded-lg text-xs transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5 shrink-0"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${isSavingInline || isSyncing ? 'animate-spin' : ''}`} />
                              <span>Save & Sync</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Quick ID Connect Form directly inside the banner */}
                    {syncResult.errorDetails?.reason === 'LOCATION_NOT_CONFIGURED' && (
                      <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2.5 mt-2">
                        <div className="font-bold text-slate-900 text-xs flex items-center justify-between">
                          <span>Quick Connect Google Business Location & Account IDs:</span>
                          <button
                            type="button"
                            onClick={() => openSettingsModal('LOCATION')}
                            className="text-[#008972] hover:underline font-bold text-[11px] cursor-pointer"
                          >
                            Open Full Settings & Guide →
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Location ID / Business Profile ID *</label>
                            <input
                              type="text"
                              value={inlineLocationId}
                              onChange={e => setInlineLocationId(e.target.value)}
                              placeholder="e.g. 1482948294829481234 or locations/5839201928"
                              className="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Account ID (Optional / Default)</label>
                            <input
                              type="text"
                              value={inlineAccountId}
                              onChange={e => setInlineAccountId(e.target.value)}
                              placeholder="e.g. 1029384756102938475 or leave empty"
                              className="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                            />
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 pt-1">
                          <button
                            type="button"
                            onClick={handleInlineSaveAndSync}
                            disabled={isSavingInline || isSyncing}
                            className="px-4 py-2 bg-[#008972] hover:bg-[#00C6A6] text-white hover:text-slate-950 font-bold rounded-lg text-xs transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isSavingInline || isSyncing ? 'animate-spin' : ''}`} />
                            <span>Save IDs & Sync Real Reviews</span>
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => openSettingsModal('PLACES_API')}
                        className="px-3 py-1.5 bg-[#008972] hover:bg-[#00C6A6] text-white hover:text-slate-950 font-bold rounded-lg text-xs transition-colors cursor-pointer"
                      >
                        ⭐ Configure Google Places API
                      </button>
                      <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        className="px-3 py-1.5 bg-rose-900 text-white font-bold rounded-lg text-xs hover:bg-rose-800 transition-colors cursor-pointer"
                      >
                        Connect Google Account
                      </button>
                      <button
                        type="button"
                        onClick={() => openSettingsModal('LOCATION')}
                        className="px-3 py-1.5 bg-white text-rose-900 font-bold rounded-lg text-xs border border-rose-300 hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        Location Settings
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenCreate}
                        className="px-3 py-1.5 bg-slate-900 text-white font-bold rounded-lg text-xs hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        + Add Verified Review
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => setSyncResult(null)}
              className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer p-1 shrink-0 ml-2"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
        <div className="relative sm:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search reviewer name, review content, destination..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-[#00C6A6]"
          />
        </div>

        <div>
          <select
            value={filterRating}
            onChange={e => setFilterRating(e.target.value)}
            className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-[#00C6A6]"
          >
            <option value="ALL">All Ratings (1 - 5 Stars)</option>
            <option value="5">★★★★★ 5 Stars Only</option>
            <option value="4">★★★★ 4 Stars</option>
            <option value="3">★★★ 3 Stars</option>
            <option value="2">★★ 2 Stars</option>
            <option value="1">★ 1 Star</option>
          </select>
        </div>

        <div>
          <select
            value={filterVisibility}
            onChange={e => setFilterVisibility(e.target.value)}
            className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-[#00C6A6]"
          >
            <option value="ALL">All Statuses</option>
            <option value="VISIBLE">Public on Storefront</option>
            <option value="HIDDEN">Hidden from Public</option>
          </select>
        </div>
      </div>

      {/* Reviews Table or Genuine Empty State */}
      {reviews.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4 shadow-xs">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-[#008972]">
            <Globe className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-bold text-slate-900">No Google Reviews Synchronized Yet</h3>
            <p className="text-xs text-slate-500">
              No mock reviews are displayed. Connect TheUnbound Google Business Profile to pull real verified customer reviews directly into Firestore.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={handleSyncNow}
              disabled={isSyncing}
              className="inline-flex items-center space-x-2 px-5 py-2.5 bg-[#008972] hover:bg-[#00C6A6] text-white hover:text-slate-950 font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Real Reviews Now'}</span>
            </button>
            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              <Key className="w-4 h-4 text-slate-600" />
              <span>Connect Google Account</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-4">Reviewer</th>
                  <th className="py-3.5 px-4">Rating</th>
                  <th className="py-3.5 px-4 max-w-sm">Review Content</th>
                  <th className="py-3.5 px-4">Date / Source</th>
                  <th className="py-3.5 px-4">Moderation</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(rev => (
                  <tr key={rev.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-3">
                        {rev.authorAvatar ? (
                          <img
                            src={rev.authorAvatar}
                            alt={rev.authorName}
                            className="w-9 h-9 rounded-full object-cover border border-slate-200"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-700 text-xs border border-slate-200">
                            {rev.authorName.charAt(0)}
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-slate-900 text-xs">{rev.authorName}</div>
                          <div className="text-[10px] text-slate-400 flex items-center space-x-1">
                            <span>{rev.locationName || 'Google Business'}</span>
                            {rev.verifiedPartner && <ShieldCheck className="w-3 h-3 text-[#00C6A6]" />}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 whitespace-nowrap">
                      <div className="flex items-center space-x-1 text-amber-500">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3.5 h-3.5 ${i < rev.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`}
                          />
                        ))}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 font-mono">{rev.rating} / 5 Stars</div>
                    </td>
                    <td className="py-4 px-4 max-w-sm">
                      <p className="text-slate-700 font-medium leading-relaxed">&ldquo;{rev.reviewText}&rdquo;</p>
                      {rev.responseFromOwner && (
                        <div className="mt-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-[10px] text-slate-600 space-y-1">
                          <div className="font-bold text-[#008972] flex items-center space-x-1">
                            <MessageSquare className="w-3 h-3" />
                            <span>Owner Response ({rev.responseFromOwner.date}):</span>
                          </div>
                          <p>&ldquo;{rev.responseFromOwner.text}&rdquo;</p>
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-4 whitespace-nowrap">
                      <div className="font-semibold text-slate-800">{rev.date}</div>
                      <div className="text-[10px] text-slate-400 flex items-center space-x-1 mt-0.5">
                        <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[9px] font-bold text-slate-600">
                          {rev.source}
                        </span>
                        {rev.relativeTimeDescription && (
                          <span>{rev.relativeTimeDescription}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4 whitespace-nowrap">
                      <div className="flex flex-col space-y-1.5">
                        <button
                          onClick={() => handleToggleVisibility(rev)}
                          className={`inline-flex items-center space-x-1 text-[10px] font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-colors ${
                            rev.isVisible ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {rev.isVisible ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          <span>{rev.isVisible ? 'Public' : 'Hidden'}</span>
                        </button>
                        <button
                          onClick={() => handleToggleFeatured(rev)}
                          className={`inline-flex items-center space-x-1 text-[10px] font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-colors ${
                            rev.isFeatured ? 'bg-amber-100 text-amber-800' : 'bg-slate-50 text-slate-400'
                          }`}
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>{rev.isFeatured ? 'Featured' : 'Standard'}</span>
                        </button>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => handleOpenEdit(rev)}
                          className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
                          title="Edit Review"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(rev.id)}
                          className="p-2 text-rose-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer"
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

          <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <div>Showing {filtered.length} of {reviews.length} total reviews</div>
            <button
              onClick={handleClearAll}
              className="text-rose-600 hover:text-rose-800 font-semibold cursor-pointer text-xs"
            >
              Purge Synced Reviews Cache
            </button>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* VERIFICATION REPORT MODAL */}
      {/* ========================================== */}
      {isVerificationModalOpen && verificationReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center space-x-2 text-[#008972] font-bold text-xs uppercase tracking-wider mb-1">
                  <ShieldCheck className="w-4 h-4 text-[#00C6A6]" />
                  <span>Google Reviews Integration Health Check</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900">Diagnostic Verification Report</h3>
              </div>
              <button
                onClick={() => setIsVerificationModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-2 rounded-full cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Overall Status Banner */}
            <div className={`p-4 rounded-2xl border flex items-center justify-between ${
              verificationReport.status === 'HEALTHY' 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-950' 
                : (verificationReport.status === 'ACTION_REQUIRED' ? 'bg-amber-50 border-amber-200 text-amber-950' : 'bg-rose-50 border-rose-200 text-rose-950')
            }`}>
              <div className="flex items-center space-x-3">
                {verificationReport.status === 'HEALTHY' ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-amber-600" />
                )}
                <div>
                  <div className="font-bold text-sm">
                    {verificationReport.status === 'HEALTHY' ? 'Integration Healthy & Operational' : 'Action Required to Complete Integration'}
                  </div>
                  <div className="text-xs opacity-80 mt-0.5">
                    Checked at {new Date(verificationReport.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
              <span className="text-xs font-bold px-3 py-1 bg-white rounded-full border">
                {verificationReport.status}
              </span>
            </div>

            {/* Step-by-Step Diagnostic Breakdown */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Diagnostic Protocol Breakdown</h4>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/50">
                {verificationReport.steps.map(step => (
                  <div key={step.id} className="p-3.5 flex items-start space-x-3 text-xs bg-white">
                    <span className="shrink-0 mt-0.5">
                      {step.status === 'PASS' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                      {step.status === 'WARN' && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                      {step.status === 'FAIL' && <XCircle className="w-4 h-4 text-rose-600" />}
                      {step.status === 'PENDING' && <div className="w-4 h-4 rounded-full border-2 border-slate-300 animate-spin" />}
                    </span>
                    <div className="flex-1 space-y-0.5">
                      <div className="font-bold text-slate-900">{step.name}</div>
                      <div className="text-slate-600">{step.message}</div>
                      {step.details && (
                        <div className="text-[11px] text-slate-400 font-mono pt-0.5">{step.details}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {verificationReport.recommendedAction && (
              <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl text-xs text-amber-900 space-y-1">
                <div className="font-bold flex items-center space-x-1.5">
                  <Info className="w-4 h-4" />
                  <span>Recommended Action:</span>
                </div>
                <p>{verificationReport.recommendedAction}</p>
              </div>
            )}

            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
              <button
                onClick={() => setIsVerificationModalOpen(false)}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* CONNECTION & LOCATION SETTINGS MODAL */}
      {/* ========================================== */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center space-x-2 text-[#008972] font-bold text-xs uppercase tracking-wider mb-1">
                  <Settings className="w-4 h-4 text-[#00C6A6]" />
                  <span>Configuration Console</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900">Google Business Profile Integration Settings</h3>
              </div>
              <button
                onClick={() => setIsSettingsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-2 rounded-full cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 pb-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => setSettingsTab('PLACES_API')}
                className={`px-3 py-1.5 rounded-lg cursor-pointer ${
                  settingsTab === 'PLACES_API' ? 'bg-[#008972] text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                ⭐ 1. Google Places API (Direct & Recommended)
              </button>
              <button
                type="button"
                onClick={() => setSettingsTab('LOCATION')}
                className={`px-3 py-1.5 rounded-lg cursor-pointer ${
                  settingsTab === 'LOCATION' ? 'bg-[#008972] text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                2. Business Profile Location
              </button>
              <button
                type="button"
                onClick={() => setSettingsTab('CONNECTION')}
                className={`px-3 py-1.5 rounded-lg cursor-pointer ${
                  settingsTab === 'CONNECTION' ? 'bg-[#008972] text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                3. OAuth & Google Account
              </button>
              <button
                type="button"
                onClick={() => setSettingsTab('DISPLAY')}
                className={`px-3 py-1.5 rounded-lg cursor-pointer ${
                  settingsTab === 'DISPLAY' ? 'bg-[#008972] text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                4. Storefront Display Settings
              </button>
            </div>

            <form onSubmit={handleSaveConnectionSettings} className="space-y-5 text-xs">
              {settingsTab === 'PLACES_API' && (
                <div className="space-y-4">
                  {/* Google Cloud Console Clarification Card */}
                  <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl space-y-2 text-amber-950">
                    <div className="flex items-center justify-between">
                      <div className="font-bold flex items-center gap-1.5 text-amber-900 text-xs">
                        <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                        <span>Why did the Google Cloud Console URL show a loading error?</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowGcpExplanation(!showGcpExplanation)}
                        className="text-amber-800 font-bold hover:underline text-[11px] cursor-pointer"
                      >
                        {showGcpExplanation ? 'Hide Details ▲' : 'Read Explanation ▼'}
                      </button>
                    </div>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      The link <code>https://console.developers.google.com/apis/api/mybusiness.googleapis.com/...</code> fails to open because:
                    </p>
                    <ul className="list-disc list-inside text-[11px] text-amber-800/90 space-y-0.5 pl-1">
                      <li><strong>Project 482123123310</strong> is an internal platform OAuth client that cannot be managed directly from a personal Google account.</li>
                      <li>Google deprecated the monolithic <code>mybusiness.googleapis.com</code> API and requires restricted enterprise partner access.</li>
                    </ul>
                    {showGcpExplanation && (
                      <div className="pt-2 mt-2 border-t border-amber-200/80 space-y-2 text-[11px] text-amber-900">
                        <p>
                          <strong>The Easy & Reliable Solution:</strong> Use standard <strong>Google Places API</strong>! It fetches live Google business ratings, total review counts, and verified reviews directly using a Google Cloud API Key with <em>Places API (New)</em> enabled on your own Google Cloud project.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Places API Key Input Box */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3.5">
                    <div className="font-bold text-slate-900 text-sm flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-[#008972]" />
                        <span>Google Places API Configuration</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        tempPlacesApiKey ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {tempPlacesApiKey ? 'Key Configured' : 'No Key Set'}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-slate-800">Google Places API Key</label>
                        <a
                          href="https://console.cloud.google.com/google/maps-apis/overview"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-[#008972] hover:underline inline-flex items-center gap-0.5 font-bold"
                        >
                          <span>Get key from Google Cloud Console</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                      <input
                        type="password"
                        value={tempPlacesApiKey}
                        onChange={e => setTempPlacesApiKey(e.target.value)}
                        placeholder="AIzaSyB-..."
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:border-[#008972] focus:outline-none"
                      />
                      <p className="text-[10px] text-slate-500">
                        Enter your Google Maps / Places API Key. The app calls the Google Places API endpoint to fetch verified customer reviews for TheUnbound.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-800">Target Place ID / CID</label>
                      <input
                        type="text"
                        value={tempPlaceId}
                        onChange={e => setTempPlaceId(e.target.value)}
                        placeholder="e.g. ChIJ... or 0x... (leave empty to use default TheUnbound Place ID)"
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:border-[#008972] focus:outline-none"
                      />
                      <p className="text-[10px] text-slate-500">
                        Default Place ID for TheUnbound: <code>ChIJPd5R3vj9GGARnS6Q9hYf8jM</code>
                      </p>
                    </div>

                    {/* Test Fetch Button */}
                    <div className="pt-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleTestPlacesApi}
                        disabled={isTestingPlacesApi || !tempPlacesApiKey.trim()}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-40 inline-flex items-center gap-1.5"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isTestingPlacesApi ? 'animate-spin' : ''}`} />
                        <span>{isTestingPlacesApi ? 'Testing API Connection...' : 'Test & Sync via Places API'}</span>
                      </button>
                    </div>

                    {placesTestResult && (
                      <div className={`p-3 rounded-xl text-xs font-medium ${
                        placesTestResult.startsWith('Success') 
                          ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                          : 'bg-rose-50 text-rose-900 border border-rose-200'
                      }`}>
                        {placesTestResult}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {settingsTab === 'CONNECTION' && (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                    <div className="font-bold text-slate-900 text-sm flex items-center justify-between">
                      <span>Google OAuth 2.0 Authorization</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        authState.isAuthenticated ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {authState.isAuthenticated ? 'Connected' : 'Not Connected'}
                      </span>
                    </div>
                    <p className="text-slate-600 text-xs">
                      Sign in with the Google Account that manages the <strong>TheUnbound</strong> Google Business Profile with scope <code>https://www.googleapis.com/auth/business.manage</code>.
                    </p>
                    <div className="flex items-center space-x-3 pt-1">
                      <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        className="px-4 py-2 bg-[#008972] hover:bg-[#00C6A6] text-white hover:text-slate-950 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                      >
                        {authState.isAuthenticated ? 'Switch / Re-Authorize Google' : 'Authorize with Google'}
                      </button>
                      {authState.isAuthenticated && (
                        <button
                          type="button"
                          onClick={() => googleAuth.signOut()}
                          className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                        >
                          Disconnect
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Manual OAuth Bearer Token Input */}
                  <div className="space-y-2">
                    <label className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                      Or Provide Manual Google OAuth Bearer Token (Optional)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={manualToken}
                        onChange={e => setManualToken(e.target.value)}
                        placeholder="ya29.a0AfH6SM..."
                        className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs"
                      />
                      <button
                        type="button"
                        onClick={handleManualTokenSubmit}
                        className="px-4 py-2.5 bg-slate-900 text-white font-bold rounded-xl text-xs cursor-pointer"
                      >
                        Set Token
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {settingsTab === 'LOCATION' && (
                <div className="space-y-5">
                  {/* Explanatory Banner */}
                  <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl text-xs text-emerald-950 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                      <Sparkles className="w-4 h-4 text-[#008972]" />
                      <span>Connect Your Google Business Profile</span>
                    </div>
                    <p className="text-[11px] text-emerald-800">
                      Enter your <strong>Location ID</strong> (or 19-digit Business Profile ID) and <strong>Account ID</strong> below. You can paste them manually or use the <strong>Auto-Discover</strong> button if signed in with Google.
                    </p>
                  </div>

                  {/* Manual / Direct Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-slate-900 flex items-center gap-1">
                          <span>Google Location ID / Profile ID</span>
                          <span className="text-rose-500">*</span>
                        </label>
                        <span className="text-[10px] text-slate-500 font-mono">Required</span>
                      </div>
                      <input
                        type="text"
                        required
                        value={selectedLocationId}
                        onChange={e => setSelectedLocationId(e.target.value)}
                        placeholder="e.g. 1482948294829481234 or locations/5839201928"
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:bg-white focus:border-[#008972] focus:outline-none"
                      />
                      <p className="text-[10px] text-slate-500">
                        Paste your 19-digit Business Profile ID from Google Search or Location ID.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-slate-900">Google Business Account ID</label>
                        <span className="text-[10px] text-slate-500 font-mono">Optional</span>
                      </div>
                      <input
                        type="text"
                        value={selectedAccountId}
                        onChange={e => setSelectedAccountId(e.target.value)}
                        placeholder="e.g. 1029384756102938475 (or leave empty for default)"
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:bg-white focus:border-[#008972] focus:outline-none"
                      />
                      <p className="text-[10px] text-slate-500">
                        Leave blank or &ldquo;-&rdquo; for default owner account.
                      </p>
                    </div>
                  </div>

                  {/* Google Maps Business URL Input */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-900">Google Maps Business Listing URL *</label>
                      {tempMapsUrl && (
                        <a
                          href={tempMapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-[#008972] hover:underline inline-flex items-center gap-1 font-semibold"
                        >
                          <span>Test URL Link</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    <input
                      type="text"
                      required
                      value={tempMapsUrl}
                      onChange={e => setTempMapsUrl(e.target.value)}
                      placeholder="https://maps.app.goo.gl/oXYBiMGguZvkbqfw5"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:bg-white focus:border-[#008972] focus:outline-none"
                    />
                    <p className="text-[11px] text-slate-500">
                      Standard Business URL: <code>https://maps.app.goo.gl/oXYBiMGguZvkbqfw5</code>
                    </p>
                  </div>

                  {/* Auto-Discovery Tool from Google Account */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900 text-xs">Auto-Discover from Connected Google Account</div>
                        <div className="text-[11px] text-slate-500">Automatically retrieve all Accounts and Location IDs associated with your Google sign-in.</div>
                      </div>
                      <button
                        type="button"
                        onClick={handleFetchAccounts}
                        disabled={isLoadingAccounts}
                        className="px-3 py-1.5 bg-white border border-slate-200 hover:border-[#008972] text-[#008972] hover:bg-slate-50 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0 shadow-xs"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAccounts ? 'animate-spin' : ''}`} />
                        <span>{isLoadingAccounts ? 'Discovering...' : 'Auto-Discover IDs'}</span>
                      </button>
                    </div>

                    {gbpAccounts.length > 0 && (
                      <div className="space-y-3 pt-2 border-t border-slate-200/80">
                        <div className="space-y-1">
                          <label className="font-bold text-slate-700">Discovered Google Accounts (Select to Auto-Fill)</label>
                          <select
                            value={selectedAccountId}
                            onChange={e => {
                              setSelectedAccountId(e.target.value);
                              handleFetchLocations(e.target.value);
                            }}
                            className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs"
                          >
                            <option value="">Choose Account...</option>
                            {gbpAccounts.map(acc => (
                              <option key={acc.name} value={acc.name}>
                                {acc.accountName} ({acc.role}) — {acc.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {gbpLocations.length > 0 && (
                          <div className="space-y-1">
                            <label className="font-bold text-slate-700">Discovered Business Locations (Select to Auto-Fill)</label>
                            <select
                              value={selectedLocationId}
                              onChange={e => setSelectedLocationId(e.target.value)}
                              className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono"
                            >
                              <option value="">Choose Location...</option>
                              {gbpLocations.map(loc => (
                                <option key={loc.name} value={loc.locationId || loc.name}>
                                  {loc.title} — ID: {loc.locationId || loc.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Step-by-Step Guide Finder */}
                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowIdGuide(!showIdGuide)}
                      className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-left cursor-pointer transition-colors"
                    >
                      <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                        <HelpCircle className="w-4 h-4 text-[#008972]" />
                        <span>Where do I find my Business Profile ID & Account ID? (Click to view guide)</span>
                      </span>
                      <span className="text-xs text-slate-400 font-bold">{showIdGuide ? 'Hide ▲' : 'Show ▼'}</span>
                    </button>
                    {showIdGuide && (
                      <div className="p-4 bg-white text-xs text-slate-700 space-y-3 border-t border-slate-100">
                        <div className="space-y-1.5">
                          <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5 text-[#008972]">
                            <span>Method 1: Direct from Google Search (Fastest — 30 Seconds)</span>
                          </div>
                          <ol className="list-decimal list-inside space-y-1 text-slate-600 pl-1 text-[11px] leading-relaxed">
                            <li>Sign in to Google with the Google account that manages <strong>TheUnbound</strong>.</li>
                            <li>In Google Search, search for <strong className="text-slate-900">TheUnbound</strong> or <strong className="text-slate-900">my business</strong>.</li>
                            <li>Look at the top section titled <strong className="text-slate-900">&ldquo;Your business on Google&rdquo;</strong>.</li>
                            <li>Click the three vertical dots menu <strong className="text-slate-900">(⋮)</strong> next to your business name, then select <strong className="text-slate-900">Business Profile settings</strong>.</li>
                            <li>Click <strong className="text-slate-900">Advanced settings</strong>.</li>
                            <li>Copy the 19-digit number under <strong className="text-slate-900">Business Profile ID</strong> and paste it into the <strong>Location ID / Profile ID</strong> field above!</li>
                          </ol>
                        </div>

                        <div className="space-y-1.5 pt-2 border-t border-slate-100">
                          <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5 text-[#008972]">
                            <span>Method 2: From Google Business Profile Manager</span>
                          </div>
                          <ol className="list-decimal list-inside space-y-1 text-slate-600 pl-1 text-[11px] leading-relaxed">
                            <li>Visit <a href="https://business.google.com" target="_blank" rel="noreferrer" className="text-[#008972] underline font-semibold">business.google.com</a> and click on your business.</li>
                            <li>Check your browser URL bar: it will look like <code>https://business.google.com/locations/5839201928...</code> or <code>accounts/1029384/locations/5839201</code>.</li>
                            <li>Copy the numeric location code into the Location ID field.</li>
                          </ol>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {settingsTab === 'DISPLAY' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                    <div>
                      <div className="font-bold text-slate-900">Show Reviews on Homepage</div>
                      <div className="text-[11px] text-slate-500">Render verified reviews carousel on customer-facing pages.</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={gbpConfig.displaySettings?.showOnHomepage ?? true}
                      onChange={e => {
                        googleBusinessService.saveConfig({
                          displaySettings: {
                            ...gbpConfig.displaySettings,
                            showOnHomepage: e.target.checked
                          }
                        }, user);
                        setGbpConfig(googleBusinessService.getConfig());
                      }}
                      className="w-4 h-4 text-[#008972] rounded cursor-pointer"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Minimum Star Rating to Display</label>
                      <select
                        value={gbpConfig.displaySettings?.minRating || 4}
                        onChange={e => {
                          googleBusinessService.saveConfig({
                            displaySettings: {
                              ...gbpConfig.displaySettings,
                              minRating: Number(e.target.value)
                            }
                          }, user);
                          setGbpConfig(googleBusinessService.getConfig());
                        }}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                      >
                        <option value="5">5 Stars Only</option>
                        <option value="4">4 Stars & Above</option>
                        <option value="3">3 Stars & Above</option>
                        <option value="1">All Ratings (1-5)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Max Number of Carousel Reviews</label>
                      <input
                        type="number"
                        min="3"
                        max="30"
                        value={gbpConfig.displaySettings?.maxDisplayCount || 12}
                        onChange={e => {
                          googleBusinessService.saveConfig({
                            displaySettings: {
                              ...gbpConfig.displaySettings,
                              maxDisplayCount: Number(e.target.value)
                            }
                          }, user);
                          setGbpConfig(googleBusinessService.getConfig());
                        }}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSettingsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#008972] hover:bg-[#00C6A6] text-white hover:text-slate-950 font-bold rounded-xl shadow-xs cursor-pointer transition-colors"
                >
                  Save Configuration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* EDIT / CREATE MANUAL REVIEW MODAL */}
      {/* ========================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {editingReview ? 'Edit Review' : 'Add Guest Testimonial'}
                </h3>
                <p className="text-xs text-slate-500">Configure reviewer name, star rating, verified review text, and owner response.</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-2 rounded-full cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="space-y-4 text-xs">
              <div>
                <ImageUploadOrUrlInput
                  label="Reviewer Profile Photo (Upload or Unsplash avatar)"
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
                  <label className="font-semibold text-slate-700">Destination / Operational Desk</label>
                  <input
                    type="text"
                    value={formData.destination || ''}
                    onChange={e => setFormData({ ...formData, destination: e.target.value })}
                    placeholder="e.g. Japan, Global Operations"
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
                    <option value="2">★★☆☆☆ (2 Stars)</option>
                    <option value="1">★☆☆☆☆ (1 Star)</option>
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
                  placeholder="Paste guest feedback..."
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
                  placeholder="Official response from TheUnbound team..."
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
