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
  convertUnsplashUrl,
  isDefaultFallbackImageUrl
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
 * Removes legacy auto-appended date version query parameters (e.g. ?v=2026-10-11 or &v=2026-10-09)
 * while preserving all user-supplied query parameters.
 */
export function stripLegacyDateVersionParam(url: string): string {
  if (!url || typeof url !== 'string') return '';
  return url
    .replace(/([?&])v=20\d{2}-\d{2}-\d{2}[^&#]*(?=&|#|$)/g, '$1')
    .replace(/\?&/, '?')
    .replace(/[?&]$/, '');
}

/**
 * THEUNBOUND GLOBAL CANONICAL IMAGE SERVICE
 * Single authoritative source of truth for inventory and platform images.
 * Implements deterministic canonical IDs, image validation,
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
            if (
              item &&
              item.imageId &&
              item.sourceUrl &&
              !isDefaultFallbackImageUrl(item.sourceUrl) &&
              !isDefaultFallbackImageUrl(item.storageUrl)
            ) {
              const cleanedSource = stripLegacyDateVersionParam(item.sourceUrl);
              const cleanedStorage = stripLegacyDateVersionParam(item.storageUrl || item.sourceUrl);
              const cleanItem: ImageMetadata = {
                ...item,
                sourceUrl: cleanedSource,
                storageUrl: cleanedStorage
              };
              this.imageRegistry.set(item.imageId, cleanItem);
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
      const items = Array.from(this.imageRegistry.values()).filter(
        item => !isDefaultFallbackImageUrl(item.sourceUrl) && !isDefaultFallbackImageUrl(item.storageUrl)
      );
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
   * Returns the canonical URL without mutating user-supplied URLs with auto-generated date query params.
   */
  public appendVersion(url: string, _versionOrUpdatedAt?: string | number): string {
    if (!url || typeof url !== 'string' || !url.trim()) {
      return DEFAULT_FALLBACK_IMAGE;
    }
    const cleanUrl = stripLegacyDateVersionParam(url.trim());
    return cleanUrl || DEFAULT_FALLBACK_IMAGE;
  }

  /**
   * Validate image URL format and basic structure.
   * Rejects the default fallback image so it is never treated as a persisted entity image.
   */
  public validateImage(url: string | null | undefined): { isValid: boolean; cleanUrl: string; reason?: string } {
    if (!url || typeof url !== 'string' || !url.trim()) {
      return { isValid: false, cleanUrl: DEFAULT_FALLBACK_IMAGE, reason: 'URL string empty or missing' };
    }

    const trimmed = stripLegacyDateVersionParam(url.trim());
    if (
      !trimmed ||
      trimmed === 'null' || 
      trimmed === 'undefined' || 
      trimmed === 'coming-soon' || 
      trimmed === 'placeholder' ||
      trimmed === 'image.jpg' ||
      trimmed === 'none' ||
      trimmed === 'N/A' ||
      trimmed === 'http://' ||
      trimmed === 'https://'
    ) {
      return { isValid: false, cleanUrl: DEFAULT_FALLBACK_IMAGE, reason: 'Placeholder or invalid keyword string' };
    }

    if (isDefaultFallbackImageUrl(trimmed)) {
      return {
        isValid: false,
        cleanUrl: DEFAULT_FALLBACK_IMAGE,
        reason: 'Default fallback image is display-only and cannot be persisted as an entity image'
      };
    }

    const cleanUrl = stripLegacyDateVersionParam(convertUnsplashUrl(trimmed));
    if (
      !cleanUrl.startsWith('http://') &&
      !cleanUrl.startsWith('https://') &&
      !cleanUrl.startsWith('data:image/') &&
      !cleanUrl.startsWith('/')
    ) {
      return { isValid: false, cleanUrl: DEFAULT_FALLBACK_IMAGE, reason: 'URL must start with https://, http://, /, or data:image/' };
    }

    if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
      try {
        const parsed = new URL(cleanUrl);
        if (!parsed.hostname || (!parsed.hostname.includes('.') && parsed.hostname !== 'localhost')) {
          return { isValid: false, cleanUrl: DEFAULT_FALLBACK_IMAGE, reason: 'Invalid URL hostname' };
        }
      } catch {
        return { isValid: false, cleanUrl: DEFAULT_FALLBACK_IMAGE, reason: 'Malformed URL syntax' };
      }
    }

    return { isValid: true, cleanUrl };
  }

  /**
   * Validates a user-supplied image URL from the Admin CMS form without substituting a fallback.
   * Empty strings are permitted (indicating no custom image persisted; display placeholder used at render time).
   */
  public validateUserSuppliedImageUrl(url: string | null | undefined): {
    isValid: boolean;
    isEmpty: boolean;
    cleanUrl: string;
    error?: string;
  } {
    if (!url || typeof url !== 'string' || !url.trim()) {
      return { isValid: true, isEmpty: true, cleanUrl: '' };
    }
    const trimmed = stripLegacyDateVersionParam(url.trim());
    if (isDefaultFallbackImageUrl(trimmed)) {
      return { isValid: true, isEmpty: true, cleanUrl: '' };
    }
    if (
      trimmed === 'null' ||
      trimmed === 'undefined' ||
      trimmed === 'coming-soon' ||
      trimmed === 'placeholder' ||
      trimmed === 'image.jpg' ||
      trimmed === 'none' ||
      trimmed === 'N/A' ||
      trimmed === 'http://' ||
      trimmed === 'https://'
    ) {
      return {
        isValid: false,
        isEmpty: false,
        cleanUrl: '',
        error: 'Please enter a valid image URL rather than a placeholder keyword.'
      };
    }

    const cleanUrl = stripLegacyDateVersionParam(convertUnsplashUrl(trimmed));
    if (
      !cleanUrl.startsWith('http://') &&
      !cleanUrl.startsWith('https://') &&
      !cleanUrl.startsWith('data:image/') &&
      !cleanUrl.startsWith('/')
    ) {
      return {
        isValid: false,
        isEmpty: false,
        cleanUrl: '',
        error: 'Invalid image URL protocol. URL must begin with https://, http://, /, or data:image/.'
      };
    }

    if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
      try {
        const parsed = new URL(cleanUrl);
        if (!parsed.hostname || (!parsed.hostname.includes('.') && parsed.hostname !== 'localhost')) {
          return {
            isValid: false,
            isEmpty: false,
            cleanUrl: '',
            error: 'Invalid image URL hostname. Please provide a complete, valid URL.'
          };
        }
      } catch {
        return {
          isValid: false,
          isEmpty: false,
          cleanUrl: '',
          error: 'Malformed image URL. Please check the URL syntax.'
        };
      }
    }

    return { isValid: true, isEmpty: false, cleanUrl };
  }

  /**
   * Extracts clean persisted image URLs for a product record (excluding display-only fallback URLs).
   * Respects field updates when comparing an incoming update payload against a previous product state.
   */
  public extractPersistedProductImages(record: any, prevRecord?: any): string[] {
    if (!record || typeof record !== 'object') return [];

    const addIfValid = (val: any, target: string[]) => {
      if (!val) return;
      if (typeof val === 'string') {
        const check = this.validateImage(val);
        if (check.isValid && !target.includes(check.cleanUrl)) {
          target.push(check.cleanUrl);
        }
      } else if (typeof val === 'object') {
        const nested = val.storageUrl || val.url || val.sourceUrl || val.src || '';
        if (nested) addIfValid(nested, target);
      }
    };

    const result: string[] = [];

    // Detect if caller explicitly updated images[] vs heroImage/imageUrl
    const rawImagesArray = Array.isArray(record.images) ? record.images : [];
    const cleanedImagesArray: string[] = [];
    rawImagesArray.forEach((img: any) => addIfValid(img, cleanedImagesArray));

    const prevImagesArray: string[] = [];
    if (prevRecord && Array.isArray(prevRecord.images)) {
      prevRecord.images.forEach((img: any) => addIfValid(img, prevImagesArray));
    }

    const heroCheck = this.validateImage(record.heroImage || record.hero_image_url || record.hero_image);
    const prevHeroCheck = prevRecord
      ? this.validateImage(prevRecord.heroImage || prevRecord.hero_image_url || prevRecord.hero_image)
      : { isValid: false, cleanUrl: '' };

    const imageUrlCheck = this.validateImage(record.imageUrl || record.imageURL || record.image_url || record.image);
    const prevImageUrlCheck = prevRecord
      ? this.validateImage(prevRecord.imageUrl || prevRecord.imageURL || prevRecord.image_url || prevRecord.image)
      : { isValid: false, cleanUrl: '' };

    const imagesChanged =
      Array.isArray(record.images) &&
      (cleanedImagesArray[0] !== prevImagesArray[0] || cleanedImagesArray.length !== prevImagesArray.length);
    const heroChanged = heroCheck.isValid && heroCheck.cleanUrl !== prevHeroCheck.cleanUrl;
    const imageUrlChanged = imageUrlCheck.isValid && imageUrlCheck.cleanUrl !== prevImageUrlCheck.cleanUrl;

    // If caller explicitly passed an empty images array (e.g. Admin cleared the image) and didn't set a new heroImage
    if (Array.isArray(record.images) && cleanedImagesArray.length === 0 && !heroChanged && !imageUrlChanged && prevRecord) {
      return [];
    }

    if (imagesChanged && cleanedImagesArray.length > 0) {
      cleanedImagesArray.forEach(u => addIfValid(u, result));
    } else if (heroChanged) {
      addIfValid(heroCheck.cleanUrl, result);
    } else if (imageUrlChanged) {
      addIfValid(imageUrlCheck.cleanUrl, result);
    }

    // Collect remaining valid images across all canonical & legacy fields
    cleanedImagesArray.forEach(u => addIfValid(u, result));
    addIfValid(record.heroImage, result);
    addIfValid(record.hero_image_url, result);
    addIfValid(record.hero_image, result);
    addIfValid(record.imageUrl, result);
    addIfValid(record.imageURL, result);
    addIfValid(record.image_url, result);
    addIfValid(record.primaryImage, result);
    addIfValid(record.primary_image_url, result);
    addIfValid(record.primaryImageUrl, result);
    addIfValid(record.image, result);
    addIfValid(record.photo_url, result);
    addIfValid(record.photoUrl, result);
    addIfValid(record.photo, result);
    addIfValid(record.thumbnail, result);
    addIfValid(record.coverImage, result);
    addIfValid(record.bannerImage, result);

    if (Array.isArray(record.galleryImages)) {
      record.galleryImages.forEach((img: any) => addIfValid(img, result));
    }
    if (Array.isArray(record.gallery_image_urls)) {
      record.gallery_image_urls.forEach((img: any) => addIfValid(img, result));
    }

    return result;
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
   * Get gallery image URLs for an entity (only valid persisted images, never fallback placeholders)
   */
  public getGalleryImages(entityType: ImageEntityType, entityId: string, _fallbackKey?: string): string[] {
    const images = this.getImages(entityType, entityId);
    const urls: string[] = [];
    for (const img of images) {
      if (img.status === 'INVALID' || img.status === 'DISABLED') continue;
      const check = this.validateImage(img.storageUrl || img.sourceUrl);
      if (check.isValid && !urls.includes(check.cleanUrl)) {
        urls.push(check.cleanUrl);
      }
    }
    return urls;
  }

  /**
   * Extract all valid image references from raw entity object during Master Sync or Admin save.
   * Never extracts or registers the display-only default fallback image.
   */
  public extractAllImagesFromRecord(
    record: any,
    entityType: ImageEntityType,
    entityId: string,
    prevRecord?: any
  ): ImageMetadata[] {
    if (!record || typeof record !== 'object') return [];

    const extracted: ImageMetadata[] = [];
    const entityVersion = record.updatedAt || record.lastUpdated || record.version || new Date().toISOString();
    const entityKey = this.getEntityKey(entityType, entityId);
    this.entityIndex.set(entityKey, []);

    const validUrls = this.extractPersistedProductImages(record, prevRecord);
    if (validUrls.length === 0) {
      const primaryId = this.computeImageId(entityType, entityId, 'PRIMARY');
      this.imageRegistry.delete(primaryId);
      this.persistRegistry();
      return [];
    }

    const primaryFoundUrl = validUrls[0];
    const primaryMeta = this.syncImage(
      entityType,
      entityId,
      primaryFoundUrl,
      'PRIMARY',
      record.name || record.title || record.listingName,
      entityVersion
    );
    extracted.push(primaryMeta);

    validUrls.slice(1).forEach((url, idx) => {
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
      const currentIds = this.entityIndex.get(entityKey) || [];
      if (!currentIds.includes(imageId)) {
        this.entityIndex.set(entityKey, [...currentIds, imageId]);
      }
      extracted.push(meta);
    });

    this.persistRegistry();
    return extracted;
  }

  /**
   * Strips query parameters like ?v=... for clean comparison of underlying image URLs
   */
  private stripVersionParam(url: string): string {
    if (!url) return '';
    return stripLegacyDateVersionParam(url);
  }

  /**
   * Shared canonical resolution engine used across all B2B card types.
   * Direct valid URLs on the authoritative Firestore entity always take precedence over cached registry entries.
   */
  private resolveCanonicalEntityPrimary(
    entity: any,
    entityType: ImageEntityType,
    id: string | undefined,
    directCandidates: any[],
    fallbackUrl: string
  ): string {
    const entityUpdatedAt = entity?.updatedAt || entity?.lastUpdated || entity?.primaryImage?.lastSyncedAt;
    const version = entity?.primaryImage?.version || entityUpdatedAt;

    // 1. Find first valid non-fallback candidate directly on the entity itself
    for (const cand of directCandidates) {
      const val = this.validateImage(cand);
      if (val.isValid) {
        if (id) {
          this.syncImage(entityType, id, val.cleanUrl, 'PRIMARY', entity?.name || entity?.title, version);
        }
        return val.cleanUrl;
      }
    }

    // 2. Check primaryImage DTO if present on entity
    const primaryDtoUrl = typeof entity?.primaryImage === 'string' ? entity.primaryImage : entity?.primaryImage?.url;
    if (primaryDtoUrl) {
      const dtoVal = this.validateImage(primaryDtoUrl);
      if (dtoVal.isValid) {
        if (id) {
          this.syncImage(entityType, id, dtoVal.cleanUrl, 'PRIMARY', entity?.name || entity?.title, version);
        }
        return dtoVal.cleanUrl;
      }
    }

    // 3. Only if entity has no direct image fields, check canonical registry by explicit primaryImageId or (entityType, id)
    // Skip registry lookup if entity explicitly has an empty images array (Admin cleared images)
    const explicitlyEmpty = Array.isArray(entity?.images) && entity.images.length === 0 && !entity?.heroImage && !entity?.imageUrl;
    if (!explicitlyEmpty) {
      let registryRecord: ImageMetadata | null = null;
      if (entity?.primaryImageId) {
        registryRecord = this.getImage(entity.primaryImageId);
      }
      if (!registryRecord && id) {
        const images = this.getImages(entityType, id);
        registryRecord = images.find(img => img.role === 'PRIMARY') || images[0] || null;
      }

      if (registryRecord && registryRecord.status !== 'INVALID' && registryRecord.status !== 'DISABLED') {
        const regVal = this.validateImage(registryRecord.storageUrl || registryRecord.sourceUrl);
        if (regVal.isValid) {
          return regVal.cleanUrl;
        }
      }
    }

    return fallbackUrl;
  }

  // =========================================================================
  // CANONICAL RESOLVERS FOR B2B CARDS AND DISCOVERY SURFACES
  // =========================================================================

  /**
   * Resolves canonical image for Product Cards (display-only fallback used if product has no persisted image)
   */
  public resolveProductImage(product: any): string {
    if (!product) return DEFAULT_FALLBACK_IMAGE;

    const id = product.id || product.sku || product.product_id;
    const fallbackKey = product.category || product.city || 'Japan';
    const candidates = [
      product.hero_image_url,
      product.heroImage,
      product.imageUrl,
      ...(Array.isArray(product.images) ? product.images : []),
      typeof product.primaryImage === 'string' ? product.primaryImage : product.primaryImage?.url,
      product.imageURL,
      product.image,
      product.photo_url,
      product.photo,
      product.thumbnail,
      product.coverImage
    ].filter(Boolean);

    return this.resolveCanonicalEntityPrimary(
      product,
      'PRODUCT',
      id,
      candidates,
      sanitizeImageUrl('', fallbackKey)
    );
  }

  /**
   * Resolves canonical image for Hotel Cards
   */
  public resolveHotelImage(hotel: any): string {
    const hotelFallback = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=800&auto=format&fit=crop';
    if (!hotel) return hotelFallback;

    const id = hotel.id || hotel.code || hotel.hotel_id;
    const candidates = [
      hotel.hero_image_url,
      hotel.heroImage,
      hotel.imageUrl,
      ...(Array.isArray(hotel.images) ? hotel.images : []),
      hotel.image
    ].filter(Boolean);

    return this.resolveCanonicalEntityPrimary(
      hotel,
      'HOTEL',
      id,
      candidates,
      hotelFallback
    );
  }

  /**
   * Resolves canonical gallery images for Hotel Details & Cards
   */
  public resolveHotelGallery(hotel: any): string[] {
    const primary = this.resolveHotelImage(hotel);
    if (!hotel) return [primary];

    const id = hotel.id || hotel.code || hotel.hotel_id;
    const urls: string[] = [];
    const primaryVal = this.validateImage(primary);
    if (primaryVal.isValid) {
      urls.push(primaryVal.cleanUrl);
    }

    const rawImages: string[] = [
      ...(Array.isArray(hotel.images) ? hotel.images : []),
      ...(Array.isArray(hotel.galleryImages) ? hotel.galleryImages : [])
    ];

    if (id) {
      const regGallery = this.getGalleryImages('HOTEL', id, hotel.city || hotel.cityName || 'Tokyo');
      rawImages.push(...regGallery);
    }

    for (const img of rawImages) {
      const val = this.validateImage(img);
      if (val.isValid && !urls.includes(val.cleanUrl)) {
        urls.push(val.cleanUrl);
      }
    }

    return urls.length > 0 ? urls : [primary];
  }

  /**
   * Resolves canonical gallery images for Product Details & Cards
   */
  public resolveProductGallery(product: any): string[] {
    if (!product) return [DEFAULT_FALLBACK_IMAGE];

    const persisted = this.extractPersistedProductImages(product);
    if (persisted.length > 0) {
      return persisted;
    }

    return [this.resolveProductImage(product)];
  }

  /**
   * Resolves canonical image for Visa Cards
   */
  public resolveVisaImage(visa: any): string {
    const visaFallback = 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?q=80&w=800&auto=format&fit=crop';
    if (!visa) return visaFallback;

    const id = visa.id || visa.service_id;
    const candidates = [
      visa.hero_image_url,
      visa.heroImage,
      visa.imageUrl,
      visa.image,
      visa.images?.[0]
    ].filter(Boolean);

    return this.resolveCanonicalEntityPrimary(visa, 'VISA', id, candidates, visaFallback);
  }

  /**
   * Resolves canonical image for Package Cards
   */
  public resolvePackageImage(pkg: any): string {
    const pkgFallback = 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=800&auto=format&fit=crop';
    if (!pkg) return pkgFallback;

    const id = pkg.id || pkg.package_id;
    const candidates = [
      pkg.hero_image_url,
      pkg.heroImage,
      pkg.imageUrl,
      pkg.images?.[0],
      pkg.image
    ].filter(Boolean);

    return this.resolveCanonicalEntityPrimary(pkg, 'PACKAGE', id, candidates, pkgFallback);
  }

  /**
   * Resolves canonical image for Japan Rail Cards
   */
  public resolveRailImage(rail: any): string {
    const railFallback = 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=800&auto=format&fit=crop';
    if (!rail) return railFallback;

    const id = rail.id || rail.routeId || rail.sku || rail.railFareId;
    const candidates = [
      rail.hero_image_url,
      rail.heroImage,
      rail.imageUrl,
      rail.image,
      rail.images?.[0]
    ].filter(Boolean);

    return this.resolveCanonicalEntityPrimary(rail, 'RAIL', id, candidates, railFallback);
  }

  /**
   * Resolves canonical image for Destination Cards
   */
  public resolveDestinationImage(dest: any): string {
    if (!dest) return DEFAULT_FALLBACK_IMAGE;

    const id = dest.id || dest.slug;
    const fallbackKey = dest.slug || dest.name || 'Japan';
    const candidates = [
      dest.hero_image_url,
      dest.heroImage,
      dest.imageUrl,
      dest.images?.[0],
      dest.image
    ].filter(Boolean);

    return this.resolveCanonicalEntityPrimary(
      dest,
      'DESTINATION',
      id,
      candidates,
      sanitizeImageUrl('', fallbackKey)
    );
  }

  /**
   * Resolves canonical image for City Hub Cards
   */
  public resolveCityHubImage(hub: any): string {
    if (!hub) return DEFAULT_FALLBACK_IMAGE;

    const id = hub.id || hub.hub_id;
    const fallbackKey = hub.name || hub.destinationName || 'Tokyo';
    const candidates = [
      hub.hero_image_url,
      hub.heroImage,
      hub.imageUrl,
      hub.images?.[0],
      hub.image
    ].filter(Boolean);

    return this.resolveCanonicalEntityPrimary(
      hub,
      'HUB',
      id,
      candidates,
      sanitizeImageUrl('', fallbackKey)
    );
  }

  /**
   * Resolves canonical image for Ancillary Cards (VIP, Insurance, eSIM)
   */
  public resolveAncillaryImage(item: any, type: ImageEntityType = 'CUSTOM'): string {
    if (!item) return DEFAULT_FALLBACK_IMAGE;

    const id = item.id;
    const candidates = [
      item.hero_image_url,
      item.heroImage,
      item.imageUrl,
      item.images?.[0],
      item.image
    ].filter(Boolean);

    return this.resolveCanonicalEntityPrimary(
      item,
      type,
      id,
      candidates,
      DEFAULT_FALLBACK_IMAGE
    );
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
