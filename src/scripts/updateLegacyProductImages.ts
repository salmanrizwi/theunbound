import { collection, getDocs, doc, getDoc, setDoc, terminate } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AppDatabase, cleanForFirestore } from '../services/db';
import { canonicalImageService } from '../services/imageService';
import { Product } from '../types';

export const LEGACY_PRODUCT_IMAGE_MAP: Record<string, string> = {
  // 1-7 (Already established)
  'UB-393390': 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1200',
  'UB-317290': 'https://lh3.googleusercontent.com/gps-cs-s/ANWiy9Rdpu2RXOhDjCEiJcRCqECUUIJkdR8G_ygZPsON9_YHK3kPi8L2RXUng249VAYKAjutSkv_a-yFkj2cab5uY080hKtlRSEf45-fBib7mOO0EhUn-OAc1gaRn4dwC_AwyoM0YBZS=s1360-w1360-h1020-rw',
  'UB-236788': 'https://images.unsplash.com/photo-1618278942403-e973260cc425?q=80&w=1674&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D',
  'UB-806282': 'https://images.unsplash.com/photo-1578271887552-5ac3a72752bc?q=80&w=2069&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D',
  'UB-168080': 'https://images.unsplash.com/photo-1610375229632-c7158c35a537?q=80&w=2071&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D',
  'UB-576114': 'https://japanforkids.jp/wp-content/uploads/2026/04/jfk_photo_hakone-sightseeing-cruise-pirate-ship_gm_1789569760.jpg',
  'UB-478835': 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1200',
  // 8-21 (Target legacy products to update)
  'UB-481750': 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&w=1200&q=80',
  'UB-160743': 'https://images.unsplash.com/photo-1542051841857-5f90071e7989?auto=format&fit=crop&w=1200&q=80',
  'UB-457398': 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1200&q=80',
  'UB-376375': 'https://images.unsplash.com/photo-1590559899731-a382839e5549?auto=format&fit=crop&w=1200&q=80',
  'UB-140322': 'https://images.unsplash.com/photo-1528164344705-475426879c0d?auto=format&fit=crop&w=1200&q=80',
  'UB-837067': 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
  'UB-585336': 'https://images.unsplash.com/photo-1549692520-acc6669e2f0c?auto=format&fit=crop&w=1200&q=80',
  'UB-147304': 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1200&q=80',
  'UB-147304-COPY': 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1200&q=80',
  'UB-568220': 'https://images.unsplash.com/photo-1528164344705-475426879c0d?auto=format&fit=crop&w=1200&q=80',
  'UB-100191': 'https://images.unsplash.com/photo-1576675466969-38eeae4b41f6?auto=format&fit=crop&w=1200&q=80',
  'UB-782810': 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1200&q=80',
  'UB-946274': 'https://images.unsplash.com/photo-1549692520-acc6669e2f0c?auto=format&fit=crop&w=1200&q=80',
  'UB-946274-COPY': 'https://images.unsplash.com/photo-1549692520-acc6669e2f0c?auto=format&fit=crop&w=1200&q=80'
};

const adminUser: any = {
  id: 'usr-admin-business',
  email: 'business@theunbound.in',
  name: 'Marcus Sterling',
  role: 'ADMIN',
  userType: 'ADMIN'
};

export async function runLegacyProductImageUpdates() {
  console.log('[LEGACY PRODUCT IMAGE UPDATE] Starting update process for 21 legacy products...');
  const appDb = AppDatabase.getInstance();

  const [regSnap, destSnap, hubSnap, snap] = await Promise.all([
    getDocs(collection(db, 'master_regions')),
    getDocs(collection(db, 'destinations')),
    getDocs(collection(db, 'city_hubs')),
    getDocs(collection(db, 'products'))
  ]);

  (appDb as any).setItem('master_regions', regSnap.docs.map(d => ({ id: d.id, ...d.data() })), false);
  (appDb as any).setItem('destinations', destSnap.docs.map(d => ({ id: d.id, ...d.data() })), false);
  (appDb as any).setItem('city_hubs', hubSnap.docs.map(d => ({ id: d.id, ...d.data() })), false);

  const allProds = snap.docs.map(d => ({ docId: d.id, ...d.data() })) as unknown as (Product & { docId: string })[];
  (appDb as any).setItem('products', allProds, false);

  const results: any[] = [];

  for (const [sku, targetImgUrl] of Object.entries(LEGACY_PRODUCT_IMAGE_MAP)) {
    const existing = allProds.find((p: any) => p.sku === sku || p.id === sku || p.docId === sku);
    if (!existing) {
      console.warn(`[WARN] Product with SKU ${sku} not found in Firestore.`);
      continue;
    }

    // Verify if already has the expected image
    const existingClean = canonicalImageService.extractPersistedProductImages(existing);
    const targetCheck = canonicalImageService.validateImage(targetImgUrl);
    if (existingClean.length > 0 && existingClean[0] === targetCheck.cleanUrl) {
      console.log(`[PASS] ${sku} already has valid primary image: ${existingClean[0]}`);
      results.push({ sku, id: existing.id, status: 'ALREADY_SYNCED', image: existingClean[0] });
      continue;
    }

    console.log(`[SYNCING] Updating image for ${sku} (${existing.id})...`);
    const updatePayload: Product = {
      ...(existing as Product),
      images: [targetCheck.cleanUrl],
      heroImage: targetCheck.cleanUrl,
      imageUrl: targetCheck.cleanUrl
    };

    const saved = await appDb.saveProductAsync(updatePayload, adminUser);

    // Read back confirmation directly from Firestore
    const verifyDoc = await getDoc(doc(db, 'products', saved.id));
    if (!verifyDoc.exists()) {
      throw new Error(`Firestore doc verification failed for ${saved.id}`);
    }
    const verifyData = verifyDoc.data() as Product;
    const verifyImages = canonicalImageService.extractPersistedProductImages(verifyData);

    if (!verifyImages.length || verifyImages[0] !== targetCheck.cleanUrl) {
      throw new Error(`Image verification mismatch for ${sku}: expected ${targetCheck.cleanUrl}, got ${verifyImages[0]}`);
    }

    console.log(`[SUCCESS] Verified ${sku} (${saved.id}) in Firestore with image: ${verifyImages[0]}`);
    results.push({ sku, id: saved.id, status: 'UPDATED', image: verifyImages[0] });
  }

  console.log(`[COMPLETED] Successfully processed ${results.length} legacy products.`);
  return results;
}

if (process.argv[1]?.endsWith('updateLegacyProductImages.ts')) {
  runLegacyProductImageUpdates()
    .then(async (res) => {
      console.log('Result summary:', JSON.stringify(res, null, 2));
      await terminate(db);
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('Fatal error during execution:', err);
      await terminate(db);
      process.exit(1);
    });
}
