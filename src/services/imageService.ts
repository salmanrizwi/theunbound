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

/**
 * THEUNBOUND GLOBAL IMAGE SERVICE
 * Central canonical service for image management across all platform modules.
 */
export class ImageService {
  private static instance: ImageService;
  private imageRegistry: Map<string, ImageMetadata> = new Map();
  private entityIndex: Map<string, string[]> = new Map(); // entityKey -> imageId[]

  private constructor() {
    // Initialized empty
  }

  public static getInstance(): ImageService {
    if (!ImageService.instance) {
      ImageService.instance = new ImageService();
    }
    return ImageService.instance;
  }

  private getEntityKey(entityType: ImageEntityType, entityId: string): string {
    return `${entityType.toUpperCase()}:${entityId}`;
  }

  /**
   * Validate image URL format and basic structure
   */
  public validateImage(url: string | null | undefined): { isValid: boolean; cleanUrl: string; reason?: string } {
    if (!url || typeof url !== 'string' || !url.trim()) {
      return { isValid: false, cleanUrl: DEFAULT_FALLBACK_IMAGE, reason: 'URL string empty or missing' };
    }

    const trimmed = url.trim();
    if (trimmed === 'null' || trimmed === 'undefined' || trimmed === 'coming-soon' || trimmed === 'placeholder') {
      return { isValid: false, cleanUrl: DEFAULT_FALLBACK_IMAGE, reason: 'Placeholder or invalid keyword string' };
    }

    const cleanUrl = convertUnsplashUrl(trimmed);
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://') && !cleanUrl.startsWith('data:image/')) {
      return { isValid: false, cleanUrl: DEFAULT_FALLBACK_IMAGE, reason: 'Invalid URL protocol' };
    }

    return { isValid: true, cleanUrl };
  }

  /**
   * Universal resolver for any image URL, image object, or raw property
   */
  public resolveImageUrl(input: any, fallbackKey?: string): string {
    if (!input) {
      if (fallbackKey && DESTINATION_FALLBACKS[fallbackKey.toLowerCase()]) {
        return DESTINATION_FALLBACKS[fallbackKey.toLowerCase()];
      }
      return DEFAULT_FALLBACK_IMAGE;
    }

    // Direct string
    if (typeof input === 'string') {
      const validation = this.validateImage(input);
      if (validation.isValid) {
        return validation.cleanUrl;
      }
      if (fallbackKey && DESTINATION_FALLBACKS[fallbackKey.toLowerCase()]) {
        return DESTINATION_FALLBACKS[fallbackKey.toLowerCase()];
      }
      return DEFAULT_FALLBACK_IMAGE;
    }

    // Object with storageUrl, sourceUrl, url, or src
    if (typeof input === 'object') {
      const candidate = input.storageUrl || input.sourceUrl || input.url || input.src || input.imageUrl || input.heroImage;
      if (candidate && typeof candidate === 'string') {
        const val = this.validateImage(candidate);
        if (val.isValid) return val.cleanUrl;
      }
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
    altText?: string
  ): ImageMetadata {
    const validation = this.validateImage(sourceUrl);
    const imageId = `IMG-${entityType.slice(0, 3)}-${entityId.replace(/[^a-zA-Z0-9-]/g, '')}-${role.slice(0, 3)}-${Math.random().toString(36).substring(2, 7)}`;
    
    const record: ImageMetadata = {
      imageId,
      entityType,
      entityId,
      role,
      sourceUrl: validation.isValid ? validation.cleanUrl : sourceUrl,
      storageUrl: validation.isValid ? validation.cleanUrl : DEFAULT_FALLBACK_IMAGE,
      altText: altText || `${entityType} image for ${entityId}`,
      status: validation.isValid ? 'SYNCED' : 'INVALID',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastSyncedAt: new Date().toISOString()
    };

    this.imageRegistry.set(imageId, record);

    const entityKey = this.getEntityKey(entityType, entityId);
    const existing = this.entityIndex.get(entityKey) || [];
    if (!existing.includes(imageId)) {
      this.entityIndex.set(entityKey, [...existing, imageId]);
    }

    return record;
  }

  /**
   * Register multiple synced image records
   */
  public registerImagesFromSync(records: ImageMetadata[]): void {
    records.forEach(rec => {
      this.imageRegistry.set(rec.imageId, rec);
      const entityKey = this.getEntityKey(rec.entityType, rec.entityId);
      const existing = this.entityIndex.get(entityKey) || [];
      if (!existing.includes(rec.imageId)) {
        this.entityIndex.set(entityKey, [...existing, rec.imageId]);
      }
    });
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
   * Get primary image URL for an entity
   */
  public getPrimaryImage(entityType: ImageEntityType, entityId: string, fallbackKey?: string): string {
    const images = this.getImages(entityType, entityId);
    const primary = images.find(img => img.role === 'PRIMARY') || images[0];
    if (primary) {
      return this.resolveImageUrl(primary.storageUrl || primary.sourceUrl, fallbackKey);
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
      .map(img => this.resolveImageUrl(img.storageUrl || img.sourceUrl, fallbackKey));
    
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

    // Check explicit primary image fields
    const primaryCandidates = [
      record.hero_image_url,
      record.heroImage,
      record.primary_image_url,
      record.primaryImageUrl,
      record.image_url,
      record.imageUrl,
      record.image
    ].filter(Boolean);

    if (primaryCandidates.length > 0) {
      const primaryUrl = String(primaryCandidates[0]);
      extracted.push(this.syncImage(entityType, entityId, primaryUrl, 'PRIMARY', record.name || record.title));
    }

    // Check gallery image fields
    let galleryCandidates: string[] = [];
    if (Array.isArray(record.images)) {
      galleryCandidates.push(...record.images);
    } else if (typeof record.images === 'string' && record.images.includes('http')) {
      galleryCandidates.push(...record.images.split(/[\n,;]/).map((s: string) => s.trim()));
    }

    if (Array.isArray(record.gallery_image_urls)) {
      galleryCandidates.push(...record.gallery_image_urls);
    } else if (typeof record.gallery_image_urls === 'string' && record.gallery_image_urls.includes('http')) {
      galleryCandidates.push(...record.gallery_image_urls.split(/[\n,;]/).map((s: string) => s.trim()));
    }

    // Numbered image fields image1, image2, image3
    for (let i = 1; i <= 10; i++) {
      if (record[`image${i}`]) galleryCandidates.push(String(record[`image${i}`]));
      if (record[`image_${i}`]) galleryCandidates.push(String(record[`image_${i}`]));
    }

    galleryCandidates
      .filter(Boolean)
      .map(s => String(s).trim())
      .forEach((url, idx) => {
        if (url && !extracted.some(e => e.sourceUrl === url)) {
          extracted.push(this.syncImage(entityType, entityId, url, 'GALLERY', `${record.name || record.title} - Gallery ${idx + 1}`));
        }
      });

    return extracted;
  }
}

export const canonicalImageService = ImageService.getInstance();
