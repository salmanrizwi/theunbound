import { 
  ImageMetadata, 
  ImageEntityType, 
  ImageRole, 
  ImageSyncStatus 
} from '../types';
import { 
  sanitizeImageUrl, 
  DEFAULT_FALLBACK_IMAGE, 
  DESTINATION_FALLBACKS,
  convertUnsplashUrl 
} from '../utils/imageUtils';

export interface CanonicalImageRef {
  imageId: string;
  url: string;
  version?: string | number;
  altText?: string;
  lastSyncedAt?: string;
}

const STORAGE_KEY = 'theunbound_canonical_image_registry';

/**
 * THEUNBOUND GLOBAL CANONICAL IMAGE SERVICE
 * Single authoritative source of truth for inventory and platform images.
 * Implements deterministic canonical IDs, image versioning, cache invalidation,
 * and guaranteed single-source resolution across all B2B cards and discovery views.
 */
export class ImageService {
  private static instance: ImageService;
  private imageRegistry: Map<string, ImageMetadata> = new Map();
  private entityIndex: Map<string, string[]> = new Map(); // entityKey -> imageId[]
  private subscribers: Set<() => void> = new Set();

  private constructor() {
    this.loadPersistedRegistry();
  }

  public static getInstance(): ImageService {
    if (!ImageService.instance) {
      ImageService.instance = new ImageService();
    }
    return ImageService.instance;
  }

  public subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  public notify(): void {
    this.subscribers.forEach(cb => {
      try {
        cb();
      } catch (e) {
        console.error('Error in ImageService subscriber:', e);
      }
    });
  }

  private loadPersistedRegistry(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((item: ImageMetadata) => {
            if (item && item.imageId && item.sourceUrl) {
              this.imageRegistry.set(item.imageId, item);
              const entityKey = this.getEntityKey(item.entityType, item.entityId);
              const existing = this.entityIndex.get(entityKey) || [];
              if (!existing.includes(item.imageId)) {
                this.entityIndex.set(entityKey, [...existing, item.imageId]);
              }
            }
          });
        }
      }
    } catch (e) {
      console.warn('Failed to load persisted image registry from localStorage:', e);
    }
  }

  private persistRegistry(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const items = Array.from(this.imageRegistry.values());
      // Keep up to 1000 latest image metadata entries
      const slice = items.slice(-1000);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(slice));
    } catch (e) {
      console.warn('Failed to persist image registry to localStorage:', e);
    }
  }

  public getEntityKey(entityType: ImageEntityType, entityId: string): string {
    return `${(entityType || 'CUSTOM').toUpperCase()}:${entityId || 'UNKNOWN'}`;
  }

  /**
   * Generates a stable, canonical Image ID for an entity and role
   */
  public computeImageId(
    entityType: ImageEntityType, 
    entityId: string, 
    role: ImageRole = 'PRIMARY', 
    index: number = 0
  ): string {
    const cleanId = String(entityId || 'item').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32);
    const roleCode = role.slice(0, 3).toUpperCase();
    return `IMG-${entityType.slice(0, 3).toUpperCase()}-${cleanId}-${roleCode}${index > 0 ? `-${index}` : ''}`;
  }

  /**
   * Deterministic version appender for browser & CDN cache busting.
   * Only appends if a valid version/timestamp/checksum is provided.
   * Replaces existing 'v=' or 'version=' query parameter cleanly.
   */
  public appendVersion(url: string, versionOrUpdatedAt?: string | number): string {
    if (!url || typeof url !== 'string' || !url.trim()) {
      return DEFAULT_FALLBACK_IMAGE;
    }
    const cleanUrl = url.trim();
    if (cleanUrl.startsWith('data:') || cleanUrl.startsWith('blob:')) {
      return cleanUrl;
    }

    if (!versionOrUpdatedAt) {
      return cleanUrl;
    }

    const versionStr = String(versionOrUpdatedAt).trim();
    if (!versionStr) return cleanUrl;

    const safeVersion = encodeURIComponent(versionStr.replace(/[^a-zA-Z0-9._-]/g, ''));
    if (!safeVersion) return cleanUrl;

    try {
      // Determine if relative or absolute
      const isAbsolute = cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://');
      const dummyOrigin = 'https://theunbound.internal';
      const parsed = new URL(isAbsolute ? cleanUrl : `${dummyOrigin}${cleanUrl.startsWith('/') ? '' : '/'}${cleanUrl}`);
      
      parsed.searchParams.set('v', safeVersion);

      if (isAbsolute) {
        return parsed.toString();
      } else {
        return `${parsed.pathname}${parsed.search}`;
      }
    } catch {
      const sep = cleanUrl.includes('?') ? '&' : '?';
      return `${cleanUrl}${sep}v=${safeVersion}`;
    }
  }

  /**
   * Validate image URL format and basic structure
   */
  public validateImage(url: string | null | undefined): { isValid: boolean; cleanUrl: string; reason?: string } {
    if (!url || typeof url !== 'string' || !url.trim()) {
      return { isValid: false, cleanUrl: DEFAULT_FALLBACK_IMAGE, reason: 'URL string empty or missing' };
    }

    const trimmed = url.trim();
    if (
      trimmed === 'null' || 
      trimmed === 'undefined' || 
      trimmed === 'coming-soon' || 
      trimmed === 'placeholder' ||
      trimmed === 'none' ||
      trimmed === 'N/A' ||
      trimmed === 'http://' ||
      trimmed === 'https://'
    ) {
      return { isValid: false, cleanUrl: DEFAULT_FALLBACK_IMAGE, reason: 'Placeholder or invalid keyword string' };
    }

    const cleanUrl = convertUnsplashUrl(trimmed);
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://') && !cleanUrl.startsWith('data:image/') && !cleanUrl.startsWith('/')) {
      return { isValid: false, cleanUrl: DEFAULT_FALLBACK_IMAGE, reason: 'Invalid URL protocol' };
    }

    return { isValid: true, cleanUrl };
  }

  /**
   * Universal resolver for any image URL, image object, or raw property
   */
  public resolveImageUrl(input: any, fallbackKey?: string, versionOrUpdatedAt?: string | number): string {
    if (!input) {
      if (fallbackKey && DESTINATION_FALLBACKS[fallbackKey.toLowerCase()]) {
        return DESTINATION_FALLBACKS[fallbackKey.toLowerCase()];
      }
      return DEFAULT_FALLBACK_IMAGE;
    }

    let candidate = '';

    if (typeof input === 'string') {
      candidate = input;
    } else if (typeof input === 'object') {
      candidate = input.storageUrl || 
                  input.url || 
                  input.sourceUrl || 
                  input.src || 
                  input.imageUrl || 
                  input.heroImage || 
                  input.images?.[0] || 
                  '';
      if (!versionOrUpdatedAt && (input.version || input.updatedAt)) {
        versionOrUpdatedAt = input.version || input.updatedAt;
      }
    }

    const val = this.validateImage(candidate);
    if (val.isValid) {
      return this.appendVersion(val.cleanUrl, versionOrUpdatedAt);
    }

    if (fallbackKey && DESTINATION_FALLBACKS[fallbackKey.toLowerCase()]) {
      return DESTINATION_FALLBACKS[fallbackKey.toLowerCase()];
    }

    return DEFAULT_FALLBACK_IMAGE;
  }

  /**
   * Sync and register a single image for an entity
   */
  public syncImage(
    entityType: ImageEntityType,
    entityId: string,
    sourceUrl: string,
    role: ImageRole = 'PRIMARY',
    altText?: string,
    version?: string | number
  ): ImageMetadata {
    const validation = this.validateImage(sourceUrl);
    const imageId = this.computeImageId(entityType, entityId, role);
    const now = new Date().toISOString();
    
    const existing = this.imageRegistry.get(imageId);
    const record: ImageMetadata = {
      imageId,
      entityType,
      entityId,
      role,
      sourceUrl: validation.isValid ? validation.cleanUrl : sourceUrl,
      storageUrl: validation.isValid ? validation.cleanUrl : DEFAULT_FALLBACK_IMAGE,
      altText: altText || `${entityType} image for ${entityId}`,
      status: validation.isValid ? 'SYNCED' : 'INVALID',
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      lastSyncedAt: now
    };

    if (version) {
      (record as any).version = version;
    }

    this.imageRegistry.set(imageId, record);

    const entityKey = this.getEntityKey(entityType, entityId);
    const existingIds = this.entityIndex.get(entityKey) || [];
    if (!existingIds.includes(imageId)) {
      this.entityIndex.set(entityKey, [...existingIds, imageId]);
    }

    this.persistRegistry();
    return record;
  }

  /**
   * Register multiple synced image records in bulk
   */
  public registerImagesFromSync(records: ImageMetadata[]): void {
    if (!records || records.length === 0) return;

    records.forEach(rec => {
      this.imageRegistry.set(rec.imageId, rec);
      const entityKey = this.getEntityKey(rec.entityType, rec.entityId);
      const existing = this.entityIndex.get(entityKey) || [];
      if (!existing.includes(rec.imageId)) {
        this.entityIndex.set(entityKey, [...existing, rec.imageId]);
      }
    });

    this.persistRegistry();
    this.notify();
  }

  /**
   * Get image metadata by imageId
   */
  public getImage(imageId: string): ImageMetadata | null {
    return this.imageRegistry.get(imageId) || null;
  }

  /**
   * Get all image metadata records for an entity
   */
  public getImages(entityType: ImageEntityType, entityId: string): ImageMetadata[] {
    const entityKey = this.getEntityKey(entityType, entityId);
    const ids = this.entityIndex.get(entityKey) || [];
    return ids.map(id => this.imageRegistry.get(id)).filter((img): img is ImageMetadata => Boolean(img));
  }

  /**
   * Get primary image URL for an entity with deterministic versioning
   */
  public getPrimaryImage(entityType: ImageEntityType, entityId: string, fallbackKey?: string): string {
    const images = this.getImages(entityType, entityId);
    const primary = images.find(img => img.role === 'PRIMARY') || images[0];
    if (primary) {
      const version = (primary as any).version || primary.updatedAt;
      return this.resolveImageUrl(primary.storageUrl || primary.sourceUrl, fallbackKey, version);
    }
    return this.resolveImageUrl(null, fallbackKey);
  }

  /**
   * Get gallery image URLs for an entity
   */
  public getGalleryImages(entityType: ImageEntityType, entityId: string, fallbackKey?: string): string[] {
    const images = this.getImages(entityType, entityId);
    const urls = images
      .filter(img => img.status !== 'INVALID' && img.status !== 'DISABLED')
      .map(img => {
        const version = (img as any).version || img.updatedAt;
        return this.resolveImageUrl(img.storageUrl || img.sourceUrl, fallbackKey, version);
      });
    
    if (urls.length === 0) {
      return [this.getPrimaryImage(entityType, entityId, fallbackKey)];
    }

    return Array.from(new Set(urls));
  }

  /**
   * Extract all valid image references from raw entity object during Master Sync
   */
  public extractAllImagesFromRecord(record: any, entityType: ImageEntityType, entityId: string): ImageMetadata[] {
    if (!record || typeof record !== 'object') return [];

    const extracted: ImageMetadata[] = [];
    const entityVersion = record.updatedAt || record.lastUpdated || record.version || new Date().toISOString();

    // 1. Check explicit primary image fields
    const primaryCandidates = [
      record.primaryImage?.url,
      record.hero_image_url,
      record.hero_image,
      record.heroImage,
      record.primary_image_url,
      record.primaryImageUrl,
      record.image_url,
      record.imageUrl,
      record.image,
      record.photo_url,
      record.photo
    ].filter(Boolean);

    let primaryFoundUrl = '';
    if (primaryCandidates.length > 0) {
      primaryFoundUrl = String(primaryCandidates[0]).trim();
      const meta = this.syncImage(
        entityType, 
        entityId, 
        primaryFoundUrl, 
        'PRIMARY', 
        record.name || record.title || record.listingName,
        entityVersion
      );
      extracted.push(meta);
    }

    // 2. Check gallery image fields
    const galleryCandidates: string[] = [];
    if (Array.isArray(record.images)) {
      galleryCandidates.push(...record.images);
    } else if (typeof record.images === 'string' && record.images.includes('http')) {
      galleryCandidates.push(...record.images.split(/[\n,;|]/).map((s: string) => s.trim()));
    }

    if (Array.isArray(record.gallery_image_urls)) {
      galleryCandidates.push(...record.gallery_image_urls);
    } else if (typeof record.gallery_image_urls === 'string' && record.gallery_image_urls.includes('http')) {
      galleryCandidates.push(...record.gallery_image_urls.split(/[\n,;|]/).map((s: string) => s.trim()));
    }

    if (Array.isArray(record.galleryImages)) {
      galleryCandidates.push(...record.galleryImages);
    }

    // Numbered image fields image1, image2, image3 ... image10
    for (let i = 1; i <= 10; i++) {
      if (record[`image${i}`]) galleryCandidates.push(String(record[`image${i}`]));
      if (record[`image_${i}`]) galleryCandidates.push(String(record[`image_${i}`]));
      if (record[`photo${i}`]) galleryCandidates.push(String(record[`photo${i}`]));
    }

    galleryCandidates
      .filter(Boolean)
      .map(s => String(s).trim())
      .forEach((url, idx) => {
        if (url && url !== primaryFoundUrl && !extracted.some(e => e.sourceUrl === url)) {
          const imageId = this.computeImageId(entityType, entityId, 'GALLERY', idx + 1);
          const meta = this.syncImage(
            entityType, 
            entityId, 
            url, 
            'GALLERY', 
            `${record.name || record.title || record.listingName || entityType} - Gallery ${idx + 1}`,
            entityVersion
          );
          meta.imageId = imageId;
          this.imageRegistry.set(imageId, meta);
          extracted.push(meta);
        }
      });

    return extracted;
  }

  // =========================================================================
  // CANONICAL RESOLVERS FOR B2B CARDS AND DISCOVERY SURFACES
  // =========================================================================

  /**
   * Resolves canonical image for Product Cards
   */
  public resolveProductImage(product: any): string {
    if (!product) return DEFAULT_FALLBACK_IMAGE;

    const id = product.id || product.sku || product.product_id;
    const version = product.primaryImage?.version || product.updatedAt || product.lastUpdated;
    const fallbackKey = product.category || product.city || 'Japan';

    // 1. DTO primaryImage object
    if (product.primaryImage?.url) {
      const val = this.validateImage(product.primaryImage.url);
      if (val.isValid) {
        return this.appendVersion(val.cleanUrl, version);
      }
    }

    // 2. Check canonical registry by entity ID
    if (id) {
      const registered = this.getPrimaryImage('PRODUCT', id, fallbackKey);
      if (registered && registered !== DEFAULT_FALLBACK_IMAGE) {
        return this.appendVersion(registered, version);
      }
    }

    // 3. Entity heroImage or images array
    const candidates = [
      product.heroImage,
      product.images?.[0],
      product.imageUrl,
      product.image,
      product.photo
    ].filter(Boolean);

    for (const cand of candidates) {
      const val = this.validateImage(cand);
      if (val.isValid) {
        return this.appendVersion(val.cleanUrl, version);
      }
    }

    // 4. City/Category Fallback
    return sanitizeImageUrl('', fallbackKey);
  }

  /**
   * Resolves canonical image for Hotel Cards
   */
  public resolveHotelImage(hotel: any): string {
    if (!hotel) return 'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=800&auto=format&fit=crop';

    const id = hotel.id || hotel.code || hotel.hotel_id;
    const version = hotel.primaryImage?.version || hotel.updatedAt || hotel.lastUpdated;
    const fallbackKey = hotel.city || hotel.cityName || 'Tokyo';

    // 1. DTO primaryImage object
    if (hotel.primaryImage?.url) {
      const val = this.validateImage(hotel.primaryImage.url);
      if (val.isValid) {
        return this.appendVersion(val.cleanUrl, version);
      }
    }

    // 2. Check canonical registry
    if (id) {
      const registered = this.getPrimaryImage('HOTEL', id, fallbackKey);
      if (registered && registered !== DEFAULT_FALLBACK_IMAGE) {
        return this.appendVersion(registered, version);
      }
    }

    // 3. Entity heroImage or images
    const candidates = [
      hotel.heroImage,
      hotel.images?.[0],
      hotel.imageUrl,
      hotel.image
    ].filter(Boolean);

    for (const cand of candidates) {
      const val = this.validateImage(cand);
      if (val.isValid) {
        return this.appendVersion(val.cleanUrl, version);
      }
    }

    // Default Hotel image (never product image)
    return 'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=800&auto=format&fit=crop';
  }

  /**
   * Resolves canonical image for Visa Cards
   */
  public resolveVisaImage(visa: any): string {
    if (!visa) return 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?q=80&w=800&auto=format&fit=crop';

    const id = visa.id || visa.service_id;
    const version = visa.primaryImage?.version || visa.updatedAt || visa.lastUpdated;
    const fallbackKey = visa.country || 'Japan';

    // 1. DTO primaryImage
    if (visa.primaryImage?.url) {
      const val = this.validateImage(visa.primaryImage.url);
      if (val.isValid) {
        return this.appendVersion(val.cleanUrl, version);
      }
    }

    // 2. Check canonical registry
    if (id) {
      const registered = this.getPrimaryImage('VISA', id, fallbackKey);
      if (registered && registered !== DEFAULT_FALLBACK_IMAGE) {
        return this.appendVersion(registered, version);
      }
    }

    // 3. Entity heroImage or imageUrl
    const candidates = [
      visa.heroImage,
      visa.imageUrl,
      visa.image,
      visa.images?.[0]
    ].filter(Boolean);

    for (const cand of candidates) {
      const val = this.validateImage(cand);
      if (val.isValid) {
        return this.appendVersion(val.cleanUrl, version);
      }
    }

    // Default Visa fallback
    return 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?q=80&w=800&auto=format&fit=crop';
  }

  /**
   * Resolves canonical image for Package Cards
   */
  public resolvePackageImage(pkg: any): string {
    if (!pkg) return 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=800&auto=format&fit=crop';

    const id = pkg.id || pkg.package_id;
    const version = pkg.primaryImage?.version || pkg.updatedAt || pkg.lastUpdated;
    const fallbackKey = pkg.destinationName || 'Japan';

    // 1. DTO primaryImage
    if (pkg.primaryImage?.url) {
      const val = this.validateImage(pkg.primaryImage.url);
      if (val.isValid) {
        return this.appendVersion(val.cleanUrl, version);
      }
    }

    // 2. Check canonical registry
    if (id) {
      const registered = this.getPrimaryImage('PACKAGE', id, fallbackKey);
      if (registered && registered !== DEFAULT_FALLBACK_IMAGE) {
        return this.appendVersion(registered, version);
      }
    }

    // 3. Entity heroImage or images
    const candidates = [
      pkg.heroImage,
      pkg.imageUrl,
      pkg.images?.[0],
      pkg.image
    ].filter(Boolean);

    for (const cand of candidates) {
      const val = this.validateImage(cand);
      if (val.isValid) {
        return this.appendVersion(val.cleanUrl, version);
      }
    }

    // Default Package fallback
    return 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=800&auto=format&fit=crop';
  }

  /**
   * Resolves canonical image for Japan Rail Cards
   */
  public resolveRailImage(rail: any): string {
    const id = rail?.id || rail?.routeId || rail?.sku || rail?.railFareId;
    const version = rail?.primaryImage?.version || rail?.updatedAt;
    const railFallback = 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=800&auto=format&fit=crop';

    if (rail?.primaryImage?.url) {
      const val = this.validateImage(rail.primaryImage.url);
      if (val.isValid) return this.appendVersion(val.cleanUrl, version);
    }

    if (id) {
      const registered = this.getPrimaryImage('RAIL', id);
      if (registered && registered !== DEFAULT_FALLBACK_IMAGE) {
        return this.appendVersion(registered, version);
      }
    }

    const candidates = [
      rail?.heroImage,
      rail?.imageUrl,
      rail?.image,
      rail?.images?.[0]
    ].filter(Boolean);

    for (const cand of candidates) {
      const val = this.validateImage(cand);
      if (val.isValid) return this.appendVersion(val.cleanUrl, version);
    }

    return railFallback;
  }

  /**
   * Resolves canonical image for Destination Cards
   */
  public resolveDestinationImage(dest: any): string {
    if (!dest) return DEFAULT_FALLBACK_IMAGE;

    const id = dest.id || dest.slug;
    const version = dest.primaryImage?.version || dest.updatedAt || dest.lastUpdated;
    const fallbackKey = dest.slug || dest.name || 'Japan';

    if (dest.primaryImage?.url) {
      const val = this.validateImage(dest.primaryImage.url);
      if (val.isValid) return this.appendVersion(val.cleanUrl, version);
    }

    if (id) {
      const registered = this.getPrimaryImage('DESTINATION', id, fallbackKey);
      if (registered && registered !== DEFAULT_FALLBACK_IMAGE) {
        return this.appendVersion(registered, version);
      }
    }

    const candidates = [
      dest.heroImage,
      dest.imageUrl,
      dest.images?.[0],
      dest.image
    ].filter(Boolean);

    for (const cand of candidates) {
      const val = this.validateImage(cand);
      if (val.isValid) return this.appendVersion(val.cleanUrl, version);
    }

    return sanitizeImageUrl('', fallbackKey);
  }

  /**
   * Resolves canonical image for City Hub Cards
   */
  public resolveCityHubImage(hub: any): string {
    if (!hub) return DEFAULT_FALLBACK_IMAGE;

    const id = hub.id || hub.hub_id;
    const version = hub.primaryImage?.version || hub.updatedAt;
    const fallbackKey = hub.name || hub.destinationName || 'Tokyo';

    if (hub.primaryImage?.url) {
      const val = this.validateImage(hub.primaryImage.url);
      if (val.isValid) return this.appendVersion(val.cleanUrl, version);
    }

    if (id) {
      const registered = this.getPrimaryImage('HUB', id, fallbackKey);
      if (registered && registered !== DEFAULT_FALLBACK_IMAGE) {
        return this.appendVersion(registered, version);
      }
    }

    const candidates = [
      hub.heroImage,
      hub.imageUrl,
      hub.images?.[0],
      hub.image
    ].filter(Boolean);

    for (const cand of candidates) {
      const val = this.validateImage(cand);
      if (val.isValid) return this.appendVersion(val.cleanUrl, version);
    }

    return sanitizeImageUrl('', fallbackKey);
  }

  /**
   * Resolves canonical image for Ancillary Cards (VIP, Insurance, eSIM)
   */
  public resolveAncillaryImage(item: any, type: ImageEntityType = 'CUSTOM'): string {
    if (!item) return DEFAULT_FALLBACK_IMAGE;

    const id = item.id;
    const version = item.primaryImage?.version || item.updatedAt;

    if (item.primaryImage?.url) {
      const val = this.validateImage(item.primaryImage.url);
      if (val.isValid) return this.appendVersion(val.cleanUrl, version);
    }

    if (id) {
      const registered = this.getPrimaryImage(type, id);
      if (registered && registered !== DEFAULT_FALLBACK_IMAGE) {
        return this.appendVersion(registered, version);
      }
    }

    const candidates = [
      item.heroImage,
      item.imageUrl,
      item.images?.[0],
      item.image
    ].filter(Boolean);

    for (const cand of candidates) {
      const val = this.validateImage(cand);
      if (val.isValid) return this.appendVersion(val.cleanUrl, version);
    }

    return DEFAULT_FALLBACK_IMAGE;
  }

  /**
   * Universal entity resolver
   */
  public resolveEntityImage(entity: any, entityType?: ImageEntityType, fallbackKey?: string): string {
    if (!entity) return DEFAULT_FALLBACK_IMAGE;

    if (entityType === 'HOTEL' || entity.propertyType || entity.roomTypes) {
      return this.resolveHotelImage(entity);
    }
    if (entityType === 'VISA' || entity.visaType || entity.embassyFee !== undefined) {
      return this.resolveVisaImage(entity);
    }
    if (entityType === 'PACKAGE' || entity.durationNights !== undefined || entity.routeSummary) {
      return this.resolvePackageImage(entity);
    }
    if (entityType === 'DESTINATION' || (entity.tagline && entity.bestTimeToVisit)) {
      return this.resolveDestinationImage(entity);
    }
    if (entityType === 'HUB' || entity.airportCode !== undefined) {
      return this.resolveCityHubImage(entity);
    }
    if (entityType === 'RAIL' || entity.carType || entity.seatType) {
      return this.resolveRailImage(entity);
    }

    return this.resolveProductImage(entity);
  }

  /**
   * Returns authoritative Canonical Image DTO compliant with Section 21
   */
  public getCanonicalImageDto(entity: any, entityType: ImageEntityType): CanonicalImageRef {
    const id = entity?.id || entity?.sku || 'item';
    const resolvedUrl = this.resolveEntityImage(entity, entityType);
    const imageId = entity?.primaryImageId || 
                    entity?.primaryImage?.imageId || 
                    this.computeImageId(entityType, id, 'PRIMARY');
    const version = entity?.primaryImage?.version || 
                    entity?.updatedAt || 
                    entity?.lastUpdated || 
                    '1.0';
    const altText = entity?.primaryImage?.altText || 
                    entity?.name || 
                    entity?.title || 
                    `${entityType} image for ${id}`;

    return {
      imageId,
      url: resolvedUrl,
      version,
      altText,
      lastSyncedAt: new Date().toISOString()
    };
  }
}

export const canonicalImageService = ImageService.getInstance();
