import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { getFirebaseStorage } from './firebase';

export interface GalleryStorageUploadResult {
  url: string;
  storagePath: string;
  isFirebaseStorage: boolean;
}

export interface GalleryBatchUploadItem {
  file: File;
  result?: GalleryStorageUploadResult;
  error?: string;
}

/**
 * Converts a file to an optimized base64 data URL as a safe fallback
 * when Firebase Storage is in Auth/Firestore-only mode.
 */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = err => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Validates file size and image MIME type.
 * Supports JPG, JPEG, PNG, and WebP up to 10MB.
 */
export function validateGalleryImageFile(file: File): { isValid: boolean; error?: string } {
  if (!file) {
    return { isValid: false, error: 'No image file provided.' };
  }

  // Max 10MB
  if (file.size > 10 * 1024 * 1024) {
    return { isValid: false, error: 'Image file exceeds 10MB limit. Please upload an image under 10MB.' };
  }

  // Validate supported extensions & MIME types
  const validExtensions = /\.(jpe?g|png|webp|avif)$/i;
  const isImageMime = file.type ? file.type.startsWith('image/') : false;
  const hasValidExt = Boolean(file.name && file.name.match(validExtensions));

  if (!isImageMime && !hasValidExt) {
    return { isValid: false, error: 'Invalid file format. Please upload a JPG, JPEG, PNG, or WebP photo.' };
  }

  return { isValid: true };
}

/**
 * Uploads a customer gallery photo to Firebase Storage under `gallery/photos/`.
 * Falls back to high-fidelity data URL if Firebase Storage is unavailable.
 */
export async function uploadGalleryImage(
  file: File,
  imageId?: string
): Promise<GalleryStorageUploadResult> {
  const validation = validateGalleryImageFile(file);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  const cleanName = (file.name || 'photo.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
  const safeId = imageId ? imageId.replace(/[^a-zA-Z0-9_-]/g, '_') : `gal_${Date.now()}`;
  const storagePath = `gallery/photos/${safeId}_${Date.now()}_${cleanName}`;

  const storageInstance = getFirebaseStorage();
  if (storageInstance) {
    try {
      const storageRef = ref(storageInstance, storagePath);
      const snapshot = await uploadBytes(storageRef, file, {
        contentType: file.type || 'image/jpeg'
      });
      const downloadUrl = await getDownloadURL(snapshot.ref);

      return {
        url: downloadUrl,
        storagePath,
        isFirebaseStorage: true
      };
    } catch (storageError: any) {
      console.warn('[GalleryStorage] Firebase Storage direct upload note:', storageError?.message || storageError);
    }
  }

  // Seamless fallback to high-fidelity data URL
  try {
    const dataUrl = await fileToDataUrl(file);
    return {
      url: dataUrl,
      storagePath,
      isFirebaseStorage: false
    };
  } catch (fallbackError: any) {
    throw new Error(`Failed to process photo: ${fallbackError?.message || 'Storage upload error'}`);
  }
}

/**
 * Safely deletes a file from Firebase Storage.
 * Verifies that the path is valid and avoids deleting if empty or data URL.
 */
export async function deleteGalleryStorageFile(storagePath?: string): Promise<boolean> {
  if (!storagePath || storagePath.startsWith('data:') || storagePath.startsWith('http')) {
    return true; // Nothing to delete in Firebase Storage
  }

  const storageInstance = getFirebaseStorage();
  if (!storageInstance) {
    return true;
  }

  try {
    const storageRef = ref(storageInstance, storagePath);
    await deleteObject(storageRef);
    return true;
  } catch (err: any) {
    // If the object doesn't exist, treat as successfully removed
    if (err?.code === 'storage/object-not-found') {
      return true;
    }
    console.warn(`[GalleryStorage] Could not delete file at "${storagePath}":`, err?.message || err);
    return false;
  }
}
