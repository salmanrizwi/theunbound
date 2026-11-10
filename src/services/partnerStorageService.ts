import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { getFirebaseStorage } from './firebase';
import { fileToDataUrl } from '../utils/imageUtils';

export interface StorageUploadResult {
  url: string;
  storagePath?: string;
  isFirebaseStorage: boolean;
  error?: string;
}

/**
 * Uploads an associated partner logo to Firebase Storage under partners/logos/.
 * Falls back cleanly to high-fidelity compressed data URL if Firebase Storage is unavailable or offline.
 */
export async function uploadPartnerLogo(
  file: File,
  partnerId: string
): Promise<StorageUploadResult> {
  if (!file) {
    throw new Error('No image file selected.');
  }

  // Validate file size (10MB max)
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Image file is too large. Please upload an image under 10MB.');
  }

  // Validate image mime type
  if (!file.type.startsWith('image/') && !file.name.match(/\.(png|jpe?g|svg|webp|gif|avif)$/i)) {
    throw new Error('Invalid file type. Please upload a valid image file (PNG, SVG, JPG, WEBP).');
  }

  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const safeId = partnerId ? partnerId.replace(/[^a-zA-Z0-9_-]/g, '_') : 'partner';
  const storagePath = `partners/logos/${safeId}_${Date.now()}_${cleanName}`;

  const storageInstance = getFirebaseStorage();
  if (storageInstance) {
    try {
      const storageRef = ref(storageInstance, storagePath);
      const snapshot = await uploadBytes(storageRef, file, {
        contentType: file.type || 'image/png'
      });
      const downloadUrl = await getDownloadURL(snapshot.ref);

      return {
        url: downloadUrl,
        storagePath,
        isFirebaseStorage: true
      };
    } catch (storageError: any) {
      console.warn('[Storage] Firebase Storage direct upload note:', storageError?.message || storageError);
    }
  }

  // Seamless fallback to high-fidelity data URL (persists in Firestore & local storage)
  try {
    const dataUrl = await fileToDataUrl(file);
    return {
      url: dataUrl,
      storagePath,
      isFirebaseStorage: false
    };
  } catch (err: any) {
    throw new Error(err?.message || 'Failed to process image file.');
  }
}

/**
 * Deletes an uploaded partner logo from Firebase Storage if it exists.
 */
export async function deletePartnerLogoFromStorage(storagePath: string): Promise<boolean> {
  if (!storagePath) return false;
  const storageInstance = getFirebaseStorage();
  if (!storageInstance) return false;

  try {
    const storageRef = ref(storageInstance, storagePath);
    await deleteObject(storageRef);
    return true;
  } catch (err) {
    console.warn('[Storage] Could not delete partner logo from storage:', err);
    return false;
  }
}
