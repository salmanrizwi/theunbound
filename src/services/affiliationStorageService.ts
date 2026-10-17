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
 * Official recognized regulatory association logos.
 * These are canonical, authentic official vector/high-res assets.
 */
export const OFFICIAL_ASSOCIATION_LOGOS: Record<string, { logo: string; name: string; fullName: string }> = {
  JATA: {
    logo: '/logos/jata_official.png',
    name: 'JATA',
    fullName: 'Japan Association of Travel Agents'
  },
  MSME: {
    logo: '/logos/msme_official.svg',
    name: 'MSME',
    fullName: 'Ministry of Micro, Small & Medium Enterprises'
  },
  NIDHI: {
    logo: '/logos/nidhi_official.png',
    name: 'NIDHI',
    fullName: 'National Integrated Database of Hospitality Industry'
  }
};

/**
 * Checks if a given URL is one of the obsolete Unsplash stock photo placeholders
 * that were mistakenly placed in place of official association logos.
 */
export function isObsoleteUnsplashAffiliationPlaceholder(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const legacyStockPhotoIds = [
    'photo-1542051841857-5f90071e7989', // old placeholder for JATA
    'photo-1532375810709-75b1da00537c', // old placeholder for MSME
    'photo-1486406146926-c627a92ad1ab'  // old placeholder for NIDHI
  ];
  return legacyStockPhotoIds.some(id => url.includes(id));
}

/**
 * Uploads an association logo to Firebase Storage under affiliations/logos/.
 * Falls back to high-fidelity compressed data URL if Firebase Storage is unavailable.
 */
export async function uploadAffiliationLogo(
  file: File,
  affiliationId: string
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
  const safeId = affiliationId ? affiliationId.replace(/[^a-zA-Z0-9_-]/g, '_') : 'aff';
  const storagePath = `affiliations/logos/${safeId}_${Date.now()}_${cleanName}`;

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
  } catch (fallbackError: any) {
    throw new Error(`Failed to process image: ${fallbackError?.message || 'Storage error'}`);
  }
}

/**
 * Uploads a section-level banner/image to Firebase Storage under affiliations/banners/.
 */
export async function uploadSectionBanner(file: File): Promise<StorageUploadResult> {
  if (!file) {
    throw new Error('No image file selected.');
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Image file is too large. Please upload an image under 10MB.');
  }

  if (!file.type.startsWith('image/') && !file.name.match(/\.(png|jpe?g|svg|webp|gif|avif)$/i)) {
    throw new Error('Invalid file type. Please upload a valid image file (PNG, SVG, JPG, WEBP).');
  }

  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `affiliations/banners/section_banner_${Date.now()}_${cleanName}`;

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
      console.warn('[Storage] Firebase Storage banner upload note:', storageError?.message || storageError);
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
  } catch (fallbackError: any) {
    throw new Error(`Failed to process banner: ${fallbackError?.message || 'Storage error'}`);
  }
}

/**
 * Removes an uploaded image from Firebase Storage if it has an authoritative storagePath.
 */
export async function deleteUploadedImage(storagePath?: string): Promise<boolean> {
  if (!storagePath) return false;
  try {
    const storageInstance = getFirebaseStorage();
    if (!storageInstance) return false;
    const storageRef = ref(storageInstance, storagePath);
    await deleteObject(storageRef);
    return true;
  } catch (e) {
    console.warn('[Storage] Delete storage object note:', e);
    return false;
  }
}
