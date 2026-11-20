/**
 * ============================================================================
 * THEUNBOUND — TEAM PHOTOGRAPH STORAGE & CLIENT-SIDE OPTIMIZATION SERVICE
 * ============================================================================
 * Handles strict file validation, browser canvas resizing & compression
 * (generating both display-optimized and thumbnail variants while preserving
 * natural aspect ratio), Firebase Storage uploads under
 * `websiteContent/aboutUs/meetOurTeam/{teamMemberId}/`, and shared-asset
 * reference checking before deletion.
 */

import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { db, getFirebaseStorage } from './firebase';
import { TeamMemberRecord } from '../types/teamGallery';

export const ALLOWED_TEAM_PHOTO_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif'
] as const;

export const MAX_TEAM_PHOTO_RAW_BYTES = 10 * 1024 * 1024; // 10 MB raw upload ceiling
export const DISPLAY_MAX_DIMENSION = 1200; // px longest side
export const THUMBNAIL_MAX_DIMENSION = 480; // px longest side
export const FALLBACK_DATA_URL_MAX_BYTES = 260 * 1024; // 260 KB safety cap if Storage bucket unreachable

export interface TeamPhotoValidationResult {
  valid: boolean;
  error?: string;
}

export interface OptimizedTeamPhotoResult {
  displayBlob: Blob;
  thumbnailBlob: Blob;
  width: number;
  height: number;
  outputMimeType: string;
  extension: string;
  originalBytes: number;
  optimizedBytes: number;
  thumbnailBytes: number;
}

export interface UploadedTeamPhotoResult {
  imageStoragePath: string;
  imageUrl: string;
  thumbnailStoragePath: string;
  thumbnailUrl: string;
  imageWidth: number;
  imageHeight: number;
  originalBytes: number;
  optimizedBytes: number;
  thumbnailBytes: number;
  storageProvider: 'firebase_storage' | 'optimized_inline_fallback';
}

/**
 * Validates file type and file size before any image processing or upload.
 */
export function validateTeamPhotoFile(file: File | null | undefined): TeamPhotoValidationResult {
  if (!file) {
    return { valid: false, error: 'Please select a photograph to upload.' };
  }

  const mime = (file.type || '').toLowerCase();
  const nameLower = (file.name || '').toLowerCase();
  const hasAllowedExtension = /\.(jpe?g|png|webp|avif)$/i.test(nameLower);
  const hasAllowedMime = (ALLOWED_TEAM_PHOTO_MIME_TYPES as readonly string[]).includes(mime);

  if (!hasAllowedMime && !hasAllowedExtension) {
    return {
      valid: false,
      error: 'Unsupported image format. Please upload a JPG, PNG, WebP, or AVIF photograph.'
    };
  }

  if (file.size <= 0) {
    return { valid: false, error: 'The selected image file is empty.' };
  }

  if (file.size > MAX_TEAM_PHOTO_RAW_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `Image file is too large (${sizeMb} MB). Maximum allowed size is 10 MB.`
    };
  }

  return { valid: true };
}

function loadImageElement(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not decode image file. Please verify the file is a valid image.'));
    };
    img.src = objectUrl;
  });
}

function renderResizedBlob(
  img: HTMLImageElement,
  maxDimension: number,
  preferredMime: string,
  quality: number
): Promise<{ blob: Blob; width: number; height: number; mime: string }> {
  return new Promise((resolve, reject) => {
    const srcW = img.naturalWidth || img.width;
    const srcH = img.naturalHeight || img.height;
    if (!srcW || !srcH) {
      reject(new Error('Image has invalid dimensions.'));
      return;
    }

    const scale = Math.min(1, maxDimension / Math.max(srcW, srcH));
    const targetW = Math.max(1, Math.round(srcW * scale));
    const targetH = Math.max(1, Math.round(srcH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Browser image canvas is unavailable.'));
      return;
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, targetW, targetH);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve({ blob, width: targetW, height: targetH, mime: blob.type || preferredMime });
          return;
        }
        // Fallback to JPEG if browser cannot encode WebP
        canvas.toBlob(
          (jpegBlob) => {
            if (!jpegBlob) {
              reject(new Error('Failed to optimize photograph.'));
              return;
            }
            resolve({ blob: jpegBlob, width: targetW, height: targetH, mime: 'image/jpeg' });
          },
          'image/jpeg',
          quality
        );
      },
      preferredMime,
      quality
    );
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to encode optimized image.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read optimized image.'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Resizes and compresses a team photograph in-browser while preserving natural aspect ratio.
 * Produces both a web-optimized display version (<= 1200px) and a fast thumbnail (<= 480px).
 */
export async function optimizeTeamPhotoForWeb(file: File): Promise<OptimizedTeamPhotoResult> {
  const validation = validateTeamPhotoFile(file);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid image file.');
  }

  const img = await loadImageElement(file);
  const preferredMime = file.type === 'image/png' ? 'image/webp' : 'image/webp';

  const displayVariant = await renderResizedBlob(img, DISPLAY_MAX_DIMENSION, preferredMime, 0.86);
  const thumbVariant = await renderResizedBlob(img, THUMBNAIL_MAX_DIMENSION, preferredMime, 0.8);

  const outputMimeType = displayVariant.mime || 'image/jpeg';
  const extension = outputMimeType.includes('webp')
    ? 'webp'
    : outputMimeType.includes('png')
      ? 'png'
      : 'jpg';

  return {
    displayBlob: displayVariant.blob,
    thumbnailBlob: thumbVariant.blob,
    width: displayVariant.width,
    height: displayVariant.height,
    outputMimeType,
    extension,
    originalBytes: file.size,
    optimizedBytes: displayVariant.blob.size,
    thumbnailBytes: thumbVariant.blob.size
  };
}

/**
 * Optimizes and uploads a team member's photograph + thumbnail to Firebase Storage.
 * Stores files cleanly under: `websiteContent/aboutUs/meetOurTeam/{teamMemberId}/...`
 */
export async function uploadTeamMemberPhoto(
  file: File,
  teamMemberId: string
): Promise<UploadedTeamPhotoResult> {
  const safeId = teamMemberId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || `member_${Date.now()}`;
  const optimized = await optimizeTeamPhotoForWeb(file);
  const timestamp = Date.now();
  const displayPath = `websiteContent/aboutUs/meetOurTeam/${safeId}/photo_${timestamp}.${optimized.extension}`;
  const thumbPath = `websiteContent/aboutUs/meetOurTeam/${safeId}/thumb_${timestamp}.${optimized.extension}`;

  const storage = getFirebaseStorage();
  if (storage) {
    try {
      const displayRef = ref(storage, displayPath);
      const thumbRef = ref(storage, thumbPath);

      const metadata = {
        contentType: optimized.outputMimeType,
        cacheControl: 'public, max-age=31536000'
      };

      const [displaySnap, thumbSnap] = await Promise.all([
        uploadBytes(displayRef, optimized.displayBlob, metadata),
        uploadBytes(thumbRef, optimized.thumbnailBlob, metadata)
      ]);

      const [imageUrl, thumbnailUrl] = await Promise.all([
        getDownloadURL(displaySnap.ref),
        getDownloadURL(thumbSnap.ref)
      ]);

      return {
        imageStoragePath: displayPath,
        imageUrl,
        thumbnailStoragePath: thumbPath,
        thumbnailUrl,
        imageWidth: optimized.width,
        imageHeight: optimized.height,
        originalBytes: optimized.originalBytes,
        optimizedBytes: optimized.optimizedBytes,
        thumbnailBytes: optimized.thumbnailBytes,
        storageProvider: 'firebase_storage'
      };
    } catch (storageErr: any) {
      console.warn(
        '[TeamPhotoStorage] Firebase Storage upload failed, evaluating safe compressed fallback:',
        storageErr?.code || storageErr?.message
      );
      // Only allow inline fallback if the compressed image is genuinely small (< 260 KB)
      // Never write raw multi-MB binaries into Firestore.
      if (optimized.optimizedBytes <= FALLBACK_DATA_URL_MAX_BYTES) {
        const [displayUrl, thumbUrl] = await Promise.all([
          blobToDataUrl(optimized.displayBlob),
          blobToDataUrl(optimized.thumbnailBlob)
        ]);
        return {
          imageStoragePath: `inline/${safeId}/photo_${timestamp}.${optimized.extension}`,
          imageUrl: displayUrl,
          thumbnailStoragePath: `inline/${safeId}/thumb_${timestamp}.${optimized.extension}`,
          thumbnailUrl: thumbUrl,
          imageWidth: optimized.width,
          imageHeight: optimized.height,
          originalBytes: optimized.originalBytes,
          optimizedBytes: optimized.optimizedBytes,
          thumbnailBytes: optimized.thumbnailBytes,
          storageProvider: 'optimized_inline_fallback'
        };
      }

      throw new Error(
        'Photograph could not be uploaded to cloud storage. Please check your connection and Firebase Storage permissions, or try a smaller image.'
      );
    }
  }

  throw new Error('Firebase Storage is not initialized. Please check Firebase configuration.');
}

/**
 * Pure reference check verifying whether a storage path or URL is still used by
 * any other team member record.
 */
export function isTeamPhotoReferencedByOthers(
  targetPath: string | undefined,
  targetUrl: string | undefined,
  otherMembers: TeamMemberRecord[],
  excludeMemberId?: string
): boolean {
  const normalizedPath = (targetPath || '').trim();
  const normalizedUrl = (targetUrl || '').trim();
  if (!normalizedPath && !normalizedUrl) return false;

  return otherMembers.some((member) => {
    if (excludeMemberId && member.teamMemberId === excludeMemberId) return false;
    const paths = [member.imageStoragePath, member.thumbnailStoragePath].filter(Boolean);
    const urls = [member.imageUrl, member.thumbnailUrl].filter(Boolean);
    if (normalizedPath && paths.includes(normalizedPath)) return true;
    if (normalizedUrl && urls.includes(normalizedUrl)) return true;
    return false;
  });
}

/**
 * Checks whether a storage path is referenced in shared CMS `image_metadata` before deletion.
 */
async function isAssetReferencedInImageMetadata(storagePath: string): Promise<boolean> {
  if (!storagePath || storagePath.startsWith('inline/')) return false;
  try {
    const q = query(
      collection(db, 'image_metadata'),
      where('storagePath', '==', storagePath),
      limit(1)
    );
    const snap = await getDocs(q);
    return !snap.empty;
  } catch {
    // Fail safe: if we cannot verify shared CMS metadata, keep the asset intact.
    return true;
  }
}

export interface SafePhotoDeleteResult {
  deletedPaths: string[];
  preservedSharedPaths: string[];
}

/**
 * Safely deletes team member storage assets ONLY if they belong to the team gallery
 * storage prefix and are NOT shared by any other team member or CMS page/component.
 */
export async function deleteTeamPhotoAssetsIfUnreferenced(
  pathsToCheck: Array<{ storagePath?: string; url?: string }>,
  allMembers: TeamMemberRecord[],
  excludeMemberId?: string
): Promise<SafePhotoDeleteResult> {
  const deletedPaths: string[] = [];
  const preservedSharedPaths: string[] = [];
  const storage = getFirebaseStorage();

  const uniqueEntries = new Map<string, string | undefined>();
  for (const entry of pathsToCheck) {
    const p = (entry.storagePath || '').trim();
    if (p && !uniqueEntries.has(p)) {
      uniqueEntries.set(p, entry.url);
    }
  }

  for (const [storagePath, url] of uniqueEntries.entries()) {
    // Only ever attempt deletion on dedicated team gallery storage paths
    if (!storagePath.startsWith('websiteContent/aboutUs/meetOurTeam/')) {
      preservedSharedPaths.push(storagePath);
      continue;
    }

    const usedByOtherMember = isTeamPhotoReferencedByOthers(
      storagePath,
      url,
      allMembers,
      excludeMemberId
    );
    if (usedByOtherMember) {
      preservedSharedPaths.push(storagePath);
      continue;
    }

    const usedInCmsMetadata = await isAssetReferencedInImageMetadata(storagePath);
    if (usedInCmsMetadata) {
      preservedSharedPaths.push(storagePath);
      continue;
    }

    if (!storage) {
      preservedSharedPaths.push(storagePath);
      continue;
    }

    try {
      await deleteObject(ref(storage, storagePath));
      deletedPaths.push(storagePath);
    } catch (err: any) {
      // Ignore object-not-found errors gracefully
      if (err?.code !== 'storage/object-not-found') {
        console.warn('[TeamPhotoStorage] Failed to delete storage asset:', storagePath, err?.code || err?.message);
      }
    }
  }

  return { deletedPaths, preservedSharedPaths };
}
