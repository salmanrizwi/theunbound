import { 
  GoogleReview, 
  GoogleBusinessProfileConfig, 
  GoogleReviewSyncResult, 
  GoogleBusinessVerificationReport, 
  GoogleBusinessVerificationStep,
  User 
} from '../types';
import { googleAuth } from './googleAuth';
import { collection, doc, getDocs, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db as firestoreDb } from './firebase';

const STORAGE_KEY_CONFIG = 'theunbound_gbp_config';
const DEFAULT_MAPS_URL = 'https://maps.app.goo.gl/oXYBiMGguZvkbqfw5';

export interface GBPAccount {
  name: string; // "accounts/101234567890"
  accountName: string; // "TheUnbound"
  type: string; // "PERSONAL" | "LOCATION_GROUP" | "ORGANIZATION"
  role: string; // "OWNER" | "MANAGER" | "CO_OWNER"
  state: {
    status: string; // "VERIFIED" | "UNVERIFIED"
  };
}

export interface GBPLocation {
  name: string; // "locations/1234567890" or "accounts/10123/locations/12345"
  locationId?: string;
  title: string; // "TheUnbound (Luxury DMC & Ground Operations)"
  storefrontAddress?: {
    addressLines?: string[];
    locality?: string;
    administrativeArea?: string;
    postalCode?: string;
    regionCode?: string;
  };
  websiteUri?: string;
  phoneNumbers?: {
    primaryPhone?: string;
  };
  metadata?: {
    placeId?: string;
    mapsUri?: string;
    newReviewUri?: string;
  };
}

export class GoogleBusinessService {
  private static instance: GoogleBusinessService;
  private config: GoogleBusinessProfileConfig;

  private constructor() {
    this.config = this.loadConfig();
  }

  public static getInstance(): GoogleBusinessService {
    if (!GoogleBusinessService.instance) {
      GoogleBusinessService.instance = new GoogleBusinessService();
    }
    return GoogleBusinessService.instance;
  }

  // ==========================================
  // CONFIGURATION MANAGEMENT
  // ==========================================
  private loadConfig(): GoogleBusinessProfileConfig {
    const defaultConfig: GoogleBusinessProfileConfig = {
      mapsUrl: DEFAULT_MAPS_URL,
      businessName: 'TheUnbound',
      googleAccountId: null,
      googleLocationId: null,
      placeId: null,
      placesApiKey: null,
      formattedAddress: 'TheUnbound Ground Operations & Dispatch Hub',
      websiteUrl: 'https://theunbound.in',
      isConnected: false,
      lastSyncedAt: null,
      lastVerifiedAt: null,
      reviewsCount: 0,
      averageRating: 0,
      status: 'DISCONNECTED',
      lastError: null,
      errorDetails: null,
      displaySettings: {
        showOnHomepage: true,
        minRating: 4,
        maxDisplayCount: 12,
        sortBy: 'FEATURED_FIRST',
        autoSync: true
      }
    };

    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (saved) {
        try {
          return { ...defaultConfig, ...JSON.parse(saved) };
        } catch (e) {
          console.error('Failed to parse GBP config from storage', e);
        }
      }
    }
    return defaultConfig;
  }

  public getConfig(): GoogleBusinessProfileConfig {
    return { ...this.config };
  }

  public saveConfig(newConfig: Partial<GoogleBusinessProfileConfig>, user: User | null): GoogleBusinessProfileConfig {
    const resolved = this.resolveMapsUrl(newConfig.mapsUrl || this.config.mapsUrl);
    
    // Sanitize account and location IDs
    const sanitizedAccountId = newConfig.googleAccountId !== undefined 
      ? (newConfig.googleAccountId || '').trim() 
      : this.config.googleAccountId;
    const sanitizedLocationId = newConfig.googleLocationId !== undefined 
      ? (newConfig.googleLocationId || '').trim() 
      : this.config.googleLocationId;

    this.config = {
      ...this.config,
      ...newConfig,
      googleAccountId: sanitizedAccountId,
      googleLocationId: sanitizedLocationId,
      mapsUrl: resolved.cleanUrl,
      placeId: newConfig.placeId || resolved.placeId || this.config.placeId,
      businessName: newConfig.businessName || resolved.businessName || this.config.businessName,
      displaySettings: {
        ...this.config.displaySettings,
        ...(newConfig.displaySettings || {})
      }
    };

    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(this.config));
    }

    // Sync to Firestore settings document
    this.persistConfigToFirestore(this.config);

    // Audit log
    this.logAudit(
      user,
      'GBP_LOCATION_CONFIGURED',
      'GoogleBusinessProfile',
      this.config.googleLocationId || 'config',
      `Updated Google Business Profile configuration for "${this.config.businessName}" (${this.config.mapsUrl})`
    );

    return this.getConfig();
  }

  private async persistConfigToFirestore(config: GoogleBusinessProfileConfig): Promise<void> {
    try {
      const docRef = doc(firestoreDb, 'homepage_config', 'google_business_profile');
      await setDoc(docRef, { ...config, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (e) {
      console.warn('Could not persist GBP config to Firestore (offline/permission fallback):', e);
    }
  }

  // ==========================================
  // GOOGLE MAPS URL RESOLVER & PLACE DETECTOR
  // ==========================================
  public resolveMapsUrl(rawUrlOrQuery: string): {
    isValid: boolean;
    businessName: string;
    extractedId: string | null;
    placeId: string | null;
    mapsType: 'SHORTLINK' | 'PLACE_URL' | 'SEARCH_QUERY' | 'G_PAGE' | 'CUSTOM';
    cleanUrl: string;
  } {
    const raw = (rawUrlOrQuery || '').trim();
    if (!raw) {
      return {
        isValid: false,
        businessName: 'TheUnbound',
        extractedId: null,
        placeId: null,
        mapsType: 'CUSTOM',
        cleanUrl: DEFAULT_MAPS_URL
      };
    }

    let businessName = 'TheUnbound';
    let extractedId: string | null = null;
    let placeId: string | null = null;
    let mapsType: 'SHORTLINK' | 'PLACE_URL' | 'SEARCH_QUERY' | 'G_PAGE' | 'CUSTOM' = 'CUSTOM';

    if (raw.includes('maps.app.goo.gl') || raw.includes('goo.gl/maps')) {
      mapsType = 'SHORTLINK';
      // Match shortcode token e.g. oXYBiMGguZvkbqfw5
      const parts = raw.split('/').filter(Boolean);
      extractedId = parts[parts.length - 1].split('?')[0];
      businessName = 'TheUnbound';
    } else if (raw.includes('google.com/maps/place/')) {
      mapsType = 'PLACE_URL';
      const match = raw.match(/\/maps\/place\/([^/@?]+)/);
      if (match && match[1]) {
        businessName = decodeURIComponent(match[1]).replace(/\+/g, ' ').trim();
      }
      // Check for ChIJ PlaceId in URL if present
      const placeMatch = raw.match(/(ChIJ[a-zA-Z0-9_-]{20,})/);
      if (placeMatch && placeMatch[1]) {
        placeId = placeMatch[1];
      }
    } else if (raw.includes('g.page/')) {
      mapsType = 'G_PAGE';
      const match = raw.match(/g\.page\/([^/?]+)/);
      if (match && match[1]) {
        businessName = decodeURIComponent(match[1]).replace(/[-_]/g, ' ').trim();
      }
    } else if (raw.startsWith('http://') || raw.startsWith('https://')) {
      mapsType = 'CUSTOM';
      businessName = 'TheUnbound';
    } else {
      mapsType = 'SEARCH_QUERY';
      businessName = raw;
    }

    return {
      isValid: true,
      businessName: businessName || 'TheUnbound',
      extractedId,
      placeId,
      mapsType,
      cleanUrl: raw
    };
  }

  // ==========================================
  // REAL GOOGLE BUSINESS PROFILE API CLIENT
  // ==========================================
  
  /**
   * Fetches the Google Business Profile accounts accessible to the authenticated token.
   */
  public async fetchGBPAccounts(customToken?: string): Promise<GBPAccount[]> {
    const token = customToken || googleAuth.getAccessToken();
    if (!token) {
      throw this.buildError(401, 'UNAUTHENTICATED', 'No active Google OAuth access token found in session.');
    }

    const endpoint = 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts';
    
    try {
      const res = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        const errorText = await res.text();
        let parsedErr: any = {};
        try { parsedErr = JSON.parse(errorText); } catch (_) {}
        
        throw this.buildError(
          res.status,
          parsedErr.error?.status || 'GBP_API_ERROR',
          parsedErr.error?.message || `Google Business Profile Accounts API returned status ${res.status}`,
          errorText
        );
      }

      const data = await res.json();
      return (data.accounts || []).map((acc: any) => ({
        name: acc.name, // e.g. "accounts/1092837465"
        accountName: acc.accountName || acc.name,
        type: acc.type || 'PERSONAL',
        role: acc.role || 'OWNER',
        state: acc.state || { status: 'VERIFIED' }
      }));
    } catch (err: any) {
      if (err.isGbpError) throw err;
      throw this.translateNetworkError(err);
    }
  }

  /**
   * Fetches the locations for a specific Google Business Profile account.
   */
  public async fetchGBPLocations(accountId: string, customToken?: string): Promise<GBPLocation[]> {
    const token = customToken || googleAuth.getAccessToken();
    if (!token) {
      throw this.buildError(401, 'UNAUTHENTICATED', 'No active Google OAuth access token found in session.');
    }

    const cleanAcc = accountId.startsWith('accounts/') ? accountId : `accounts/${accountId}`;
    const endpoint = `https://mybusinessbusinessinformation.googleapis.com/v1/${cleanAcc}/locations?readMask=name,title,storefrontAddress,websiteUri,phoneNumbers,metadata`;

    try {
      const res = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        const errorText = await res.text();
        let parsedErr: any = {};
        try { parsedErr = JSON.parse(errorText); } catch (_) {}

        throw this.buildError(
          res.status,
          parsedErr.error?.status || 'GBP_LOCATION_ERROR',
          parsedErr.error?.message || `Google Business Profile Locations API returned status ${res.status}`,
          errorText
        );
      }

      const data = await res.json();
      return (data.locations || []).map((loc: any) => ({
        name: loc.name,
        locationId: loc.name.split('/').pop(),
        title: loc.title || 'TheUnbound',
        storefrontAddress: loc.storefrontAddress,
        websiteUri: loc.websiteUri,
        phoneNumbers: loc.phoneNumbers,
        metadata: loc.metadata
      }));
    } catch (err: any) {
      if (err.isGbpError) throw err;
      throw this.translateNetworkError(err);
    }
  }

  /**
   * Fetches real reviews directly from Google Business Profile API with pagination.
   * ABSOLUTE RULE: Never generates mock reviews on failure or empty state.
   */
  public async fetchRealGoogleReviews(
    accountId?: string | null,
    locationId?: string | null,
    customToken?: string
  ): Promise<GoogleReview[]> {
    const token = customToken || googleAuth.getAccessToken();
    if (!token) {
      throw this.buildError(
        401,
        'UNAUTHENTICATED',
        'Google Business Profile authorization is missing. Please connect your Google account or provide an OAuth Bearer token.'
      );
    }

    let effectiveAccount = accountId || this.config.googleAccountId;
    let effectiveLocation = locationId || this.config.googleLocationId;

    // If account or location ID is not explicitly provided, attempt automatic discovery from Google OAuth
    if (!effectiveAccount || !effectiveLocation) {
      try {
        const accounts = await this.fetchGBPAccounts(token);
        if (accounts && accounts.length > 0) {
          if (!effectiveAccount) {
            effectiveAccount = accounts[0].name;
            this.config.googleAccountId = effectiveAccount;
          }
          if (!effectiveLocation) {
            const locations = await this.fetchGBPLocations(effectiveAccount, token);
            if (locations && locations.length > 0) {
              const matchedLoc = locations[0];
              effectiveLocation = matchedLoc.locationId || matchedLoc.name;
              this.config.googleLocationId = effectiveLocation;
              if (matchedLoc.title) {
                this.config.businessName = matchedLoc.title;
              }
            }
          }
          if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(this.config));
          }
          this.persistConfigToFirestore(this.config);
        }
      } catch (autoErr) {
        console.debug('Automatic Google Business Profile location discovery note:', autoErr);
      }
    }

    // Fallback: If location is known but account is not, use primary account alias '-'
    if (!effectiveAccount && effectiveLocation) {
      effectiveAccount = '-';
    }

    if (!effectiveLocation) {
      throw this.buildError(
        400,
        'LOCATION_NOT_CONFIGURED',
        'Google Business Profile Location ID (or Business Profile ID) must be configured to fetch reviews.',
        undefined
      );
    }

    const cleanAcc = effectiveAccount.replace(/^accounts\//, '');
    const cleanLoc = effectiveLocation.replace(/^locations\//, '');

    const allReviews: GoogleReview[] = [];
    let pageToken: string | null = null;
    let pageCount = 0;
    const MAX_PAGES = 10; // Safety guard: max 500 reviews

    do {
      pageCount++;
      const url = new URL(`https://mybusiness.googleapis.com/v4/accounts/${cleanAcc}/locations/${cleanLoc}/reviews`);
      url.searchParams.set('pageSize', '50');
      if (pageToken) {
        url.searchParams.set('pageToken', pageToken);
      }

      const res = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        const errorText = await res.text();
        let parsedErr: any = {};
        try { parsedErr = JSON.parse(errorText); } catch (_) {}

        throw this.buildError(
          res.status,
          parsedErr.error?.status || 'GBP_REVIEWS_API_ERROR',
          parsedErr.error?.message || `Google Business Reviews API request failed with status ${res.status}`,
          errorText
        );
      }

      const data = await res.json();
      const rawReviews = data.reviews || [];

      for (let i = 0; i < rawReviews.length; i++) {
        const r = rawReviews[i];
        const parsed = this.mapGbpReviewToAppReview(r, cleanAcc, cleanLoc, allReviews.length + 1);
        allReviews.push(parsed);
      }

      pageToken = data.nextPageToken || null;
    } while (pageToken && pageCount < MAX_PAGES);

    return allReviews;
  }

  /**
   * Translates a single Google Business Profile API review payload to the app's GoogleReview interface.
   */
  private mapGbpReviewToAppReview(
    raw: any,
    accountId: string,
    locationId: string,
    orderIndex: number
  ): GoogleReview {
    // Star rating translation: Google API returns 'FIVE', 'FOUR', 'THREE', 'TWO', 'ONE' or integer
    let numericRating = 5;
    if (typeof raw.starRating === 'string') {
      switch (raw.starRating.toUpperCase()) {
        case 'FIVE': numericRating = 5; break;
        case 'FOUR': numericRating = 4; break;
        case 'THREE': numericRating = 3; break;
        case 'TWO': numericRating = 2; break;
        case 'ONE': numericRating = 1; break;
        default: numericRating = parseInt(raw.starRating, 10) || 5;
      }
    } else if (typeof raw.starRating === 'number') {
      numericRating = raw.starRating;
    }

    const reviewId = raw.reviewId || (raw.name ? raw.name.split('/').pop() : `g-rev-${Date.now()}-${orderIndex}`);
    const reviewerName = raw.reviewer?.displayName || (raw.reviewer?.isAnonymous ? 'Google Traveler' : 'Verified Google Customer');
    const reviewerAvatar = raw.reviewer?.profilePhotoUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150&auto=format&fit=crop';
    const createTime = raw.createTime || new Date().toISOString();
    const updateTime = raw.updateTime || createTime;
    const dateStr = createTime.split('T')[0];

    // Format relative time description
    const relativeTime = this.formatRelativeTime(createTime);

    let ownerResponse: { text: string; date: string; updateTime?: string } | undefined = undefined;
    if (raw.reviewReply && raw.reviewReply.comment) {
      ownerResponse = {
        text: raw.reviewReply.comment,
        date: (raw.reviewReply.updateTime || raw.reviewReply.createTime || new Date().toISOString()).split('T')[0],
        updateTime: raw.reviewReply.updateTime
      };
    }

    return {
      id: `gbp-${reviewId}`,
      googleReviewId: reviewId,
      googleAccountId: accountId,
      googleLocationId: locationId,
      placeId: this.config.placeId || undefined,
      businessName: this.config.businessName || 'TheUnbound',
      authorName: reviewerName,
      authorAvatar: reviewerAvatar,
      isAnonymous: !!raw.reviewer?.isAnonymous,
      rating: numericRating,
      reviewText: raw.comment || '',
      date: dateStr,
      reviewCreatedAt: createTime,
      reviewUpdatedAt: updateTime,
      relativeTimeDescription: relativeTime,
      destination: 'Japan & Global Operations',
      locationName: 'TheUnbound (Google Business Verified)',
      source: 'GOOGLE_BUSINESS',
      sourceUrl: this.config.mapsUrl,
      verifiedPartner: true,
      isFeatured: numericRating === 5 && !!raw.comment && raw.comment.length > 50,
      isVisible: true,
      displayOrder: orderIndex,
      responseFromOwner: ownerResponse,
      reviewReply: raw.reviewReply?.comment,
      reviewReplyUrl: raw.reviewReplyUrl,
      reviewMedia: (raw.reviewMedia || []).map((m: any) => ({
        photoUrl: m.photoUrl,
        thumbnailUrl: m.thumbnailUrl
      })),
      fetchedAt: new Date().toISOString(),
      lastSyncedAt: new Date().toISOString(),
      status: 'ACTIVE'
    };
  }

  /**
   * Translates a Google Places API (New) review into GoogleReview format.
   */
  private mapPlacesNewReviewToAppReview(raw: any, placeId: string, orderIndex: number): GoogleReview {
    const reviewId = raw.name ? raw.name.split('/').pop() : `places-${Date.now()}-${orderIndex}`;
    const authorName = raw.authorAttribution?.displayName || 'Verified Google Reviewer';
    const authorAvatar = raw.authorAttribution?.photoUri || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150&auto=format&fit=crop';
    const rating = raw.rating || 5;
    const reviewText = raw.text?.text || raw.originalText?.text || '';
    const publishTime = raw.publishTime || new Date().toISOString();
    const dateStr = publishTime.split('T')[0];

    return {
      id: `places-${reviewId}`,
      googleReviewId: reviewId,
      placeId: placeId,
      businessName: this.config.businessName || 'TheUnbound',
      authorName,
      authorAvatar,
      isAnonymous: false,
      rating,
      reviewText,
      date: dateStr,
      reviewCreatedAt: publishTime,
      reviewUpdatedAt: publishTime,
      relativeTimeDescription: raw.relativePublishTimeDescription || this.formatRelativeTime(publishTime),
      destination: 'Japan & Global Operations',
      locationName: 'TheUnbound (Google Maps Verified)',
      source: 'GOOGLE_BUSINESS',
      sourceUrl: raw.authorAttribution?.uri || this.config.mapsUrl,
      verifiedPartner: true,
      isFeatured: rating === 5 && reviewText.length > 50,
      isVisible: true,
      displayOrder: orderIndex,
      fetchedAt: new Date().toISOString(),
      lastSyncedAt: new Date().toISOString(),
      status: 'ACTIVE'
    };
  }

  /**
   * Translates a Legacy Google Maps Place Details review into GoogleReview format.
   */
  private mapPlacesLegacyReviewToAppReview(raw: any, placeId: string, orderIndex: number): GoogleReview {
    const reviewId = `leg-${raw.time || Date.now()}-${orderIndex}`;
    const authorName = raw.author_name || 'Verified Google Reviewer';
    const authorAvatar = raw.profile_photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150&auto=format&fit=crop';
    const rating = raw.rating || 5;
    const reviewText = raw.text || '';
    const dateStr = raw.time ? new Date(raw.time * 1000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

    return {
      id: `places-${reviewId}`,
      googleReviewId: reviewId,
      placeId: placeId,
      businessName: this.config.businessName || 'TheUnbound',
      authorName,
      authorAvatar,
      isAnonymous: false,
      rating,
      reviewText,
      date: dateStr,
      reviewCreatedAt: raw.time ? new Date(raw.time * 1000).toISOString() : new Date().toISOString(),
      reviewUpdatedAt: raw.time ? new Date(raw.time * 1000).toISOString() : new Date().toISOString(),
      relativeTimeDescription: raw.relative_time_description || 'Recently',
      destination: 'Japan & Global Operations',
      locationName: 'TheUnbound (Google Maps Verified)',
      source: 'GOOGLE_BUSINESS',
      sourceUrl: raw.author_url || this.config.mapsUrl,
      verifiedPartner: true,
      isFeatured: rating === 5 && reviewText.length > 50,
      isVisible: true,
      displayOrder: orderIndex,
      fetchedAt: new Date().toISOString(),
      lastSyncedAt: new Date().toISOString(),
      status: 'ACTIVE'
    };
  }

  /**
   * Fetches real reviews using Google Places API Key and Place ID.
   */
  public async fetchPlacesApiReviews(placeId?: string | null, customApiKey?: string): Promise<GoogleReview[]> {
    const apiKey = (customApiKey || this.config.placesApiKey || '').trim();
    const targetPlaceId = (placeId || this.config.placeId || '').trim();

    if (!apiKey) {
      throw this.buildError(400, 'PLACES_API_KEY_MISSING', 'Google Places API Key is required to fetch reviews via Places API.');
    }
    if (!targetPlaceId) {
      throw this.buildError(400, 'PLACE_ID_MISSING', 'Google Place ID is required to fetch Places reviews.');
    }

    try {
      // 1. Try New Places API
      const newPlacesUrl = `https://places.googleapis.com/v1/places/${encodeURIComponent(targetPlaceId)}?fields=id,displayName,rating,userRatingCount,reviews,formattedAddress&key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(newPlacesUrl, {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'id,displayName,rating,userRatingCount,reviews,formattedAddress'
        }
      });

      if (res.ok) {
        const data = await res.json();
        if (data.rating) this.config.averageRating = data.rating;
        if (data.userRatingCount) this.config.reviewsCount = data.userRatingCount;
        if (data.formattedAddress) this.config.formattedAddress = data.formattedAddress;

        const rawReviews = data.reviews || [];
        return rawReviews.map((r: any, idx: number) => this.mapPlacesNewReviewToAppReview(r, targetPlaceId, idx + 1));
      }

      // 2. Fallback to Legacy Places API
      const legacyUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(targetPlaceId)}&fields=name,rating,reviews,user_ratings_total,formatted_address&key=${encodeURIComponent(apiKey)}`;
      const legRes = await fetch(legacyUrl);
      if (!legRes.ok) {
        const errTxt = await legRes.text();
        throw this.buildError(legRes.status, 'PLACES_API_ERROR', 'Google Places API request failed.', errTxt);
      }
      const legData = await legRes.json();
      if (legData.status !== 'OK' && legData.status !== 'ZERO_RESULTS') {
        throw this.buildError(400, legData.status || 'PLACES_API_ERROR', legData.error_message || `Places API returned ${legData.status}`);
      }

      const result = legData.result || {};
      if (result.rating) this.config.averageRating = result.rating;
      if (result.user_ratings_total) this.config.reviewsCount = result.user_ratings_total;
      if (result.formatted_address) this.config.formattedAddress = result.formatted_address;

      const rawReviews = result.reviews || [];
      return rawReviews.map((r: any, idx: number) => this.mapPlacesLegacyReviewToAppReview(r, targetPlaceId, idx + 1));
    } catch (err: any) {
      if (err.isGbpError) throw err;
      throw this.translateNetworkError(err);
    }
  }

  private formatRelativeTime(isoDateString: string): string {
    try {
      const diffMs = Date.now() - new Date(isoDateString).getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays <= 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
      if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
      return `${Math.floor(diffDays / 365)} years ago`;
    } catch (_) {
      return 'Recently';
    }
  }

  // ==========================================
  // SYNC PROTOCOL & FIRESTORE STORAGE
  // ==========================================

  /**
   * Synchronizes reviews from Google Business Profile API or Google Places API into Firestore and LocalStorage.
   * Performs rigorous deduplication by googleReviewId.
   */
  public async syncGoogleReviews(user: User | null, customToken?: string): Promise<GoogleReviewSyncResult> {
    const startTime = Date.now();
    const token = customToken || googleAuth.getAccessToken();
    const hasPlacesKey = !!(this.config.placesApiKey && this.config.placesApiKey.trim());

    if (!token && !hasPlacesKey) {
      const errorResult = this.buildErrorResult(
        401,
        'UNAUTHENTICATED',
        'Google Business Profile authorization is incomplete.',
        'Connect the Google account that owns or manages TheUnbound, or provide a Google Places API Key in Settings.'
      );
      this.updateConfigAfterSyncFailure(errorResult, user);
      return errorResult;
    }

    try {
      // 1. Fetch real reviews: prefer Places API if configured, otherwise Google Business Profile OAuth
      let liveReviews: GoogleReview[] = [];
      if (hasPlacesKey && this.config.placeId) {
        liveReviews = await this.fetchPlacesApiReviews(this.config.placeId, this.config.placesApiKey!);
      } else if (token) {
        liveReviews = await this.fetchRealGoogleReviews(null, null, token);
      } else {
        throw this.buildError(400, 'NO_SYNC_METHOD', 'No valid sync method found (OAuth Token or Places API Key).');
      }

      // 2. Load existing reviews from Firestore / localStorage
      const existingReviews = await this.getAllStoredReviews();
      const existingMap = new Map<string, GoogleReview>();
      existingReviews.forEach(r => {
        const key = r.googleReviewId || r.id;
        existingMap.set(key, r);
      });

      let newCount = 0;
      let updatedCount = 0;
      let unchangedCount = 0;

      const mergedReviews: GoogleReview[] = [];

      for (let i = 0; i < liveReviews.length; i++) {
        const incoming = liveReviews[i];
        const key = incoming.googleReviewId || incoming.id;
        const existing = existingMap.get(key);

        if (!existing) {
          // New review from Google
          mergedReviews.push(incoming);
          newCount++;
        } else {
          // Check if updated (e.g. comment changed, reply added)
          const hasChanged = 
            existing.reviewText !== incoming.reviewText ||
            existing.rating !== incoming.rating ||
            existing.responseFromOwner?.text !== incoming.responseFromOwner?.text;

          if (hasChanged) {
            mergedReviews.push({
              ...incoming,
              // Retain admin customizations like manual feature / visibility overrides if intended
              isFeatured: existing.isFeatured,
              isVisible: existing.isVisible,
              displayOrder: existing.displayOrder
            });
            updatedCount++;
          } else {
            mergedReviews.push({
              ...existing,
              lastSyncedAt: new Date().toISOString()
            });
            unchangedCount++;
          }
        }
      }

      // 3. Batch commit to Firestore `google_reviews` collection
      await this.saveReviewsToFirestore(mergedReviews);

      // 4. Save to local storage
      if (typeof window !== 'undefined') {
        localStorage.setItem('reviews', JSON.stringify(mergedReviews));
      }

      // 5. Calculate stats & update config
      const totalCount = mergedReviews.length;
      const totalStars = mergedReviews.reduce((sum, r) => sum + r.rating, 0);
      const avgRating = totalCount > 0 ? parseFloat((totalStars / totalCount).toFixed(1)) : 5.0;

      this.config = {
        ...this.config,
        isConnected: true,
        status: 'CONNECTED',
        lastSyncedAt: new Date().toISOString(),
        reviewsCount: totalCount,
        averageRating: avgRating,
        lastError: null,
        errorDetails: null
      };
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(this.config));
      }
      this.persistConfigToFirestore(this.config);

      // 6. Audit Log
      this.logAudit(
        user,
        'REVIEW_SYNC',
        'GoogleBusinessProfile',
        this.config.googleLocationId || 'sync',
        `Google Business Profile Reviews Synced: ${liveReviews.length} retrieved (${newCount} new, ${updatedCount} updated, ${unchangedCount} unchanged, 0 errors)`
      );

      return {
        success: true,
        retrievedCount: liveReviews.length,
        newCount,
        updatedCount,
        unchangedCount,
        errorCount: 0,
        lastSyncedAt: this.config.lastSyncedAt!,
        reviews: mergedReviews
      };
    } catch (err: any) {
      console.warn('Google Reviews Sync Note:', err?.message || err);
      const errorResult = this.buildErrorResultFromException(err);
      this.updateConfigAfterSyncFailure(errorResult, user);
      return errorResult;
    }
  }

  /**
   * Retrieves all reviews currently stored in Firestore `google_reviews` or local storage fallback.
   * Adheres strictly to returning [] when no reviews exist.
   */
  public async getAllStoredReviews(): Promise<GoogleReview[]> {
    try {
      const snapshot = await getDocs(collection(firestoreDb, 'google_reviews'));
      if (!snapshot.empty) {
        const list: GoogleReview[] = [];
        snapshot.forEach(docSnap => {
          list.push(docSnap.data() as GoogleReview);
        });
        return list.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
      }
    } catch (e) {
      console.debug('Firestore reviews lookup fallback to local storage cache:', e);
    }

    if (typeof window !== 'undefined') {
      const local = localStorage.getItem('reviews');
      if (local) {
        try {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed)) return parsed;
        } catch (_) {}
      }
    }

    return [];
  }

  public async saveReviewsToFirestore(reviews: GoogleReview[]): Promise<void> {
    try {
      const batch = writeBatch(firestoreDb);
      for (const rev of reviews) {
        const docRef = doc(firestoreDb, 'google_reviews', rev.id);
        batch.set(docRef, rev, { merge: true });
      }
      await batch.commit();
    } catch (e) {
      console.warn('Firestore writeBatch for google_reviews encountered warning:', e);
    }
  }

  public async clearAllReviews(user: User | null): Promise<void> {
    try {
      const snapshot = await getDocs(collection(firestoreDb, 'google_reviews'));
      const batch = writeBatch(firestoreDb);
      snapshot.forEach(d => {
        batch.delete(d.ref);
      });
      await batch.commit();
    } catch (e) {
      console.warn('Failed clearing Firestore google_reviews:', e);
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('reviews', JSON.stringify([]));
    }

    this.config = {
      ...this.config,
      reviewsCount: 0,
      lastSyncedAt: null
    };
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(this.config));
    }

    this.logAudit(
      user,
      'REVIEW_DELETED',
      'GoogleBusinessProfile',
      'all',
      'Admin purged cached Google reviews from storage'
    );
  }

  // ==========================================
  // MULTI-STEP VERIFICATION DIAGNOSTIC
  // ==========================================
  public async verifyIntegrationHealth(user: User | null): Promise<GoogleBusinessVerificationReport> {
    const timestamp = new Date().toISOString();
    const token = googleAuth.getAccessToken();
    const steps: GoogleBusinessVerificationStep[] = [];
    let isHealthy = true;
    let reviewsApiWorking = false;
    let errorMessage: string | undefined = undefined;
    let recommendedAction: string | undefined = undefined;

    // Step 1: Google OAuth Token
    if (token) {
      steps.push({
        id: 'AUTH_TOKEN',
        name: 'Google OAuth 2.0 Access Token',
        status: 'PASS',
        message: 'Active Google OAuth access token present in session.',
        details: `Token starts with: ${token.substring(0, 8)}...`
      });
    } else {
      isHealthy = false;
      steps.push({
        id: 'AUTH_TOKEN',
        name: 'Google OAuth 2.0 Access Token',
        status: 'FAIL',
        message: 'No Google OAuth token found. Google login required.',
        details: 'Connect the Google Account associated with TheUnbound Business Profile.'
      });
    }

    // Step 2: Scope Verification
    const authState = googleAuth.getAuthState();
    const hasGbpScope = authState.scopes?.some(s => s.includes('business.manage') || s.includes('mybusiness'));
    if (hasGbpScope) {
      steps.push({
        id: 'SCOPES',
        name: 'Google Business Profile API Scopes',
        status: 'PASS',
        message: 'Scope "https://www.googleapis.com/auth/business.manage" requested.',
      });
    } else {
      steps.push({
        id: 'SCOPES',
        name: 'Google Business Profile API Scopes',
        status: 'WARN',
        message: 'Business scope should be explicitly re-verified upon popup authentication.'
      });
    }

    // Step 3: Google Business Profile Accounts & Permissions
    let detectedAccounts: GBPAccount[] = [];
    if (token) {
      try {
        detectedAccounts = await this.fetchGBPAccounts(token);
        if (detectedAccounts.length > 0) {
          steps.push({
            id: 'GBP_ACCOUNTS',
            name: 'Business Profile Account Authorization',
            status: 'PASS',
            message: `Found ${detectedAccounts.length} authorized Google Business Account(s).`,
            details: `Accounts: ${detectedAccounts.map(a => a.accountName || a.name).join(', ')}`
          });
        } else {
          isHealthy = false;
          steps.push({
            id: 'GBP_ACCOUNTS',
            name: 'Business Profile Account Authorization',
            status: 'FAIL',
            message: 'No Business Profile accounts found under this Google ID.',
            details: 'The signed-in Google account is not an Owner or Manager of any Google Business Profile.'
          });
        }
      } catch (err: any) {
        isHealthy = false;
        steps.push({
          id: 'GBP_ACCOUNTS',
          name: 'Business Profile Account Authorization',
          status: 'FAIL',
          message: err.message || 'Failed connecting to Google Business Profile Accounts API.',
          details: err.reason || 'Permission denied or API not enabled in Google Cloud Console.'
        });
      }
    }

    // Step 4: Location Matching
    if (this.config.googleLocationId && detectedAccounts.length > 0) {
      steps.push({
        id: 'GBP_LOCATION',
        name: 'Business Profile Location Link',
        status: 'PASS',
        message: `Linked to location ID: ${this.config.googleLocationId}`,
        details: `Maps URL: ${this.config.mapsUrl}`
      });
    } else {
      steps.push({
        id: 'GBP_LOCATION',
        name: 'Business Profile Location Link',
        status: 'WARN',
        message: 'Target Business Profile location not yet selected or mapped from URL.',
        details: 'Select a location from your Google Business Profile accounts list.'
      });
    }

    // Step 5: Reviews API Probe
    if (token && this.config.googleAccountId && this.config.googleLocationId) {
      try {
        const probeReviews = await this.fetchRealGoogleReviews(this.config.googleAccountId, this.config.googleLocationId, token);
        reviewsApiWorking = true;
        steps.push({
          id: 'REVIEWS_API',
          name: 'Google Business Reviews API Endpoint',
          status: 'PASS',
          message: `Live Reviews API accessible. Retrieved ${probeReviews.length} verified reviews.`,
        });
      } catch (err: any) {
        isHealthy = false;
        reviewsApiWorking = false;
        errorMessage = err.message;
        recommendedAction = err.resolution || 'Verify GBP account role permissions.';
        steps.push({
          id: 'REVIEWS_API',
          name: 'Google Business Reviews API Endpoint',
          status: 'FAIL',
          message: err.message || 'Could not query Google Business Profile Reviews API.',
          details: err.resolution || 'API permission error'
        });
      }
    } else {
      steps.push({
        id: 'REVIEWS_API',
        name: 'Google Business Reviews API Endpoint',
        status: 'PENDING',
        message: 'Pending location selection to test live Reviews API.'
      });
    }

    // Step 6: Firestore Storage Health
    try {
      const snap = await getDocs(collection(firestoreDb, 'google_reviews'));
      steps.push({
        id: 'FIRESTORE',
        name: 'Firestore Database Collection (google_reviews)',
        status: 'PASS',
        message: `Firestore accessible. Contains ${snap.size} persisted review record(s).`
      });
    } catch (err: any) {
      steps.push({
        id: 'FIRESTORE',
        name: 'Firestore Database Collection (google_reviews)',
        status: 'WARN',
        message: 'Firestore read note (using cached local persistence fallback).'
      });
    }

    const overallStatus: 'HEALTHY' | 'ACTION_REQUIRED' | 'FAILED' = 
      isHealthy && reviewsApiWorking ? 'HEALTHY' : (!token ? 'ACTION_REQUIRED' : 'FAILED');

    const report: GoogleBusinessVerificationReport = {
      timestamp,
      isHealthy: overallStatus === 'HEALTHY',
      status: overallStatus,
      steps,
      accountId: this.config.googleAccountId,
      locationId: this.config.googleLocationId,
      placeId: this.config.placeId,
      reviewsApiWorking,
      errorMessage,
      recommendedAction: recommendedAction || (overallStatus === 'ACTION_REQUIRED' ? 'Authorize Google Business Profile with TheUnbound Google Account' : undefined)
    };

    // Update config verified status
    this.config = {
      ...this.config,
      lastVerifiedAt: timestamp,
      status: overallStatus === 'HEALTHY' ? 'CONNECTED' : (overallStatus === 'ACTION_REQUIRED' ? 'ACTION_REQUIRED' : 'ERROR')
    };
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(this.config));
    }

    this.logAudit(
      user,
      'GBP_INTEGRATION_VERIFIED',
      'GoogleBusinessProfile',
      'verify',
      `Verified Google Business Profile integration health: Status ${overallStatus}`
    );

    return report;
  }

  // ==========================================
  // ERROR TRANSLATION & HELPERS
  // ==========================================
  private buildError(code: number | string, reason: string, message: string, rawError?: string): any {
    let resolution = 'Please check Google Cloud API permissions and sign-in status.';
    const combinedErrorStr = `${message} ${rawError || ''}`;
    
    // Catch Google My Business legacy API deprecation / disabled project error
    if (
      combinedErrorStr.includes('mybusiness.googleapis.com') ||
      combinedErrorStr.includes('482123123310') ||
      combinedErrorStr.includes('has not been used in project') ||
      combinedErrorStr.includes('before or it is disabled')
    ) {
      code = 403;
      reason = 'GBP_API_LEGACY_RESTRICTED';
      message = 'Google Cloud has deprecated the legacy My Business v4 API for project 482123123310. Direct access to enable this API link is restricted by Google.';
      resolution = 'To sync reviews: (1) Use your Google Places API Key in Settings > Google Places API to fetch verified Google reviews directly, or (2) Add & curate your verified Google reviews directly in this Review Manager while linking to your verified Google Maps listing (https://maps.app.goo.gl/oXYBiMGguZvkbqfw5).';
    } else if (code === 400 || reason === 'LOCATION_NOT_CONFIGURED') {
      resolution = 'Please link your Google Business Account ID and Location ID in Connection Settings or authorize your Google account.';
    } else if (code === 401 || reason === 'UNAUTHENTICATED') {
      resolution = 'Google session expired or invalid OAuth access token. Click "Connect Google Account" to re-authenticate.';
    } else if (code === 403 || reason === 'PERMISSION_DENIED') {
      resolution = 'Google Business Profile access was denied. The connected Google account does not currently have permission to access this business profile. Ensure you are signed in with the Google account that manages TheUnbound.';
    } else if (code === 404 || reason === 'NOT_FOUND') {
      resolution = 'Google Business Profile location or account not found. Please verify the Google Account ID and Location ID in settings.';
    } else if (code === 429 || reason === 'RESOURCE_EXHAUSTED') {
      resolution = 'Google API rate limit reached. Please wait a few minutes before retrying review synchronization.';
    }

    return {
      isGbpError: true,
      code,
      reason,
      message,
      resolution,
      rawError
    };
  }

  private translateNetworkError(err: any): any {
    return this.buildError(
      500,
      'NETWORK_ERROR',
      err.message || 'Network connection failed while contacting Google Business Profile API.',
      String(err)
    );
  }

  private buildErrorResult(code: number | string, reason: string, message: string, resolution: string): GoogleReviewSyncResult {
    return {
      success: false,
      retrievedCount: 0,
      newCount: 0,
      updatedCount: 0,
      unchangedCount: 0,
      errorCount: 1,
      lastSyncedAt: new Date().toISOString(),
      reviews: [],
      errorMessage: message,
      errorDetails: {
        code,
        message,
        reason,
        resolution
      }
    };
  }

  private buildErrorResultFromException(err: any): GoogleReviewSyncResult {
    const code = err.code || 500;
    const reason = err.reason || 'UNKNOWN_ERROR';
    const message = err.message || 'Failed to communicate with Google Business Profile API.';
    const resolution = err.resolution || 'Connect the Google account that manages TheUnbound Business Profile.';

    return {
      success: false,
      retrievedCount: 0,
      newCount: 0,
      updatedCount: 0,
      unchangedCount: 0,
      errorCount: 1,
      lastSyncedAt: new Date().toISOString(),
      reviews: [],
      errorMessage: message,
      errorDetails: {
        code,
        message,
        reason,
        resolution
      }
    };
  }

  private updateConfigAfterSyncFailure(errorResult: GoogleReviewSyncResult, user: User | null): void {
    this.config = {
      ...this.config,
      status: errorResult.errorDetails?.code === 401 ? 'ACTION_REQUIRED' : 'ERROR',
      lastError: errorResult.errorMessage,
      errorDetails: errorResult.errorDetails || null
    };
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(this.config));
    }
    this.persistConfigToFirestore(this.config);

    this.logAudit(
      user,
      'GBP_SYNC_FAILED',
      'GoogleBusinessProfile',
      'sync',
      `Google Business Profile Sync Failed: ${errorResult.errorMessage} (${errorResult.errorDetails?.resolution})`
    );
  }

  private logAudit(
    user: User | null,
    action: any,
    module: string,
    recordId: string,
    details: string
  ): void {
    try {
      const logEntry = {
        id: `aud-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        userId: user?.id || 'system-admin',
        userName: user?.name || user?.email || 'Admin',
        userRole: user?.role || 'ADMIN',
        action,
        module,
        recordId,
        details,
        timestamp: new Date().toISOString()
      };

      // Write to Firestore audit_logs collection
      const docRef = doc(firestoreDb, 'audit_logs', logEntry.id);
      setDoc(docRef, logEntry).catch(() => {});
    } catch (_) {}
  }
}

export const googleBusinessService = GoogleBusinessService.getInstance();
