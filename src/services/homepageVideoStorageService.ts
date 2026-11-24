import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { getFirebaseStorage } from './firebase';

export const ALLOWED_THUMBNAIL_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/avif',
]);

export const ALLOWED_THUMBNAIL_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'webp',
  'avif',
]);

export const MAX_THUMBNAIL_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB strict ceiling

export interface ThumbnailValidationResult {
  valid: boolean;
  error?: string;
}

export interface ThumbnailUploadResult {
  imageUrl: string;
  storagePath: string;
  fileSizeBytes: number;
  mimeType: string;
}

/**
 * Validates custom thumbnail file format (raster images only; blocks SVG/HTML/scripts)
 * and enforces the 5 MB file size limit.
 */
export function validateThumbnailFile(file: {
  name: string;
  type: string;
  size: number;
}): ThumbnailValidationResult {
  const mime = String(file.type || '').toLowerCase().trim();
  const ext = String(file.name || '')
    .split('.')
    .pop()
    ?.toLowerCase()
    .trim() || '';

  if (!ALLOWED_THUMBNAIL_MIME_TYPES.has(mime) || !ALLOWED_THUMBNAIL_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: 'Unsupported image format. Please upload a JPG, PNG, WebP, or AVIF image.',
    };
  }

  if (!Number.isFinite(file.size) || file.size <= 0) {
    return {
      valid: false,
      error: 'Selected image file appears to be empty.',
    };
  }

  if (file.size > MAX_THUMBNAIL_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: 'Thumbnail image exceeds the 5 MB maximum file size limit. Please choose a smaller image.',
    };
  }

  return { valid: true };
}

/**
 * Optimizes uploaded raster thumbnail on the client before storage upload
 * (caps width at 1280px for crisp 16:9 presentation with minimal bandwidth).
 */
async function optimizeThumbnailBlob(file: File): Promise<{ blob: Blob; mimeType: string; ext: string }> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { blob: file, mimeType: file.type || 'image/jpeg', ext: 'jpg' };
  }

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const maxWidth = 1280;
        const maxHeight = 720;
        let { naturalWidth: w, naturalHeight: h } = img;

        if (w > maxWidth || h > maxHeight) {
          const ratio = Math.min(maxWidth / w, maxHeight / h);
          w = Math.max(1, Math.round(w * ratio));
          h = Math.max(1, Math.round(h * ratio));
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          resolve({ blob: file, mimeType: file.type || 'image/jpeg', ext: 'jpg' });
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, w, h);

        const targetMime = file.type === 'image/png' ? 'image/webp' : 'image/jpeg';
        const targetExt = targetMime === 'image/webp' ? 'webp' : 'jpg';

        canvas.toBlob(
          (compressed) => {
            URL.revokeObjectURL(objectUrl);
            if (compressed && compressed.size < file.size) {
              resolve({ blob: compressed, mimeType: targetMime, ext: targetExt });
            } else {
              const fallbackExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
              resolve({ blob: file, mimeType: file.type || 'image/jpeg', ext: fallbackExt });
            }
          },
          targetMime,
          0.84
        );
      } catch {
        URL.revokeObjectURL(objectUrl);
        resolve({ blob: file, mimeType: file.type || 'image/jpeg', ext: 'jpg' });
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ blob: file, mimeType: file.type || 'image/jpeg', ext: 'jpg' });
    };
    img.src = objectUrl;
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to encode thumbnail image.'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Uploads an optimized custom video thumbnail to Firebase Storage under
 * `homepage/video-thumbnails/` with graceful data-URL fallback if Storage is unavailable.
 */
export async function uploadHomepageVideoThumbnail(
  file: File,
  sectionKey: 'portalTutorialVideo' | 'cashbackRewardsVideo'
): Promise<ThumbnailUploadResult> {
  const check = validateThumbnailFile(file);
  if (!check.valid) {
    throw new Error(check.error || 'Invalid thumbnail file.');
  }

  const optimized = await optimizeThumbnailBlob(file);
  const safeSection = sectionKey.replace(/[^a-zA-Z0-9_-]/g, '');
  const safeBaseName = file.name
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 40) || 'thumbnail';

  const storagePath = `homepage/video-thumbnails/${safeSection}_${Date.now()}_${safeBaseName}.${optimized.ext}`;
  const storage = getFirebaseStorage();

  if (!storage) {
    const dataUrl = await blobToDataUrl(optimized.blob);
    return {
      imageUrl: dataUrl,
      storagePath: '',
      fileSizeBytes: optimized.blob.size,
      mimeType: optimized.mimeType,
    };
  }

  try {
    const storageRef = ref(storage, storagePath);
    const snapshot = await uploadBytes(storageRef, optimized.blob, {
      contentType: optimized.mimeType,
      cacheControl: 'public, max-age=31536000',
    });
    const imageUrl = await getDownloadURL(snapshot.ref);
    return {
      imageUrl,
      storagePath,
      fileSizeBytes: optimized.blob.size,
      mimeType: optimized.mimeType,
    };
  } catch (err) {
    console.warn('[HomepageVideoStorage] Storage upload fallback to data URL:', err);
    const dataUrl = await blobToDataUrl(optimized.blob);
    return {
      imageUrl: dataUrl,
      storagePath: '',
      fileSizeBytes: optimized.blob.size,
      mimeType: optimized.mimeType,
    };
  }
}

/**
 * Deletes an orphaned custom thumbnail from Firebase Storage when replaced or removed.
 */
export async function deleteHomepageVideoThumbnail(storagePath?: string): Promise<void> {
  if (!storagePath || !storagePath.startsWith('homepage/video-thumbnails/')) return;
  const storage = getFirebaseStorage();
  if (!storage) return;
  try {
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
  } catch (err) {
    console.warn('[HomepageVideoStorage] Could not remove old thumbnail:', err);
  }
}
