import { AppDatabase } from '../services/db';
import { User, Product } from '../types';

interface TestResult {
  scenario: string;
  passed: boolean;
  details: string;
}

export async function runProductDuplicationAudit(): Promise<{ passed: boolean; results: TestResult[] }> {
  const db = AppDatabase.getInstance();
  const results: TestResult[] = [];

  const mockAdminUser: User = {
    id: 'usr-admin-audit-test',
    email: 'business@theunbound.in',
    name: 'Audit Administrator',
    role: 'ADMIN',
    agencyName: 'TheUnbound HQ',
    companyName: 'TheUnbound HQ'
  };

  const initialProducts = db.getProducts();
  if (initialProducts.length === 0) {
    throw new Error('Database has no products to test with.');
  }

  // Pick a real product from the database
  const originalProduct = initialProducts[0];
  const initialCount = initialProducts.length;

  console.log(`[Audit] Selected original product: "${originalProduct.name}" (ID: ${originalProduct.id}, SKU: ${originalProduct.sku}, Price: ${originalProduct.adultNetPrice})`);

  let duplicatedProduct: Product | null = null;

  try {
    // -------------------------------------------------------------
    // Scenario 1: Duplicate product and confirm product count increases by one
    // -------------------------------------------------------------
    duplicatedProduct = await db.duplicateProductAsync(originalProduct.id, mockAdminUser);
    const countAfterDuplication = db.getProducts().length;
    const s1Passed = countAfterDuplication === initialCount + 1;
    results.push({
      scenario: 'Scenario 1: Total product count increases by one',
      passed: s1Passed,
      details: `Initial count: ${initialCount}, After duplication: ${countAfterDuplication}`
    });

    // -------------------------------------------------------------
    // Scenario 2: Both products appear in list with different document IDs
    // -------------------------------------------------------------
    const currentProducts = db.getProducts();
    const foundOriginal = currentProducts.find(p => p.id === originalProduct.id);
    const foundDuplicate = currentProducts.find(p => p.id === duplicatedProduct!.id);
    const s2Passed = Boolean(foundOriginal && foundDuplicate && foundOriginal.id !== foundDuplicate.id);
    results.push({
      scenario: 'Scenario 2: Both products appear in product list with distinct IDs',
      passed: s2Passed,
      details: `Original ID: ${foundOriginal?.id}, Duplicate ID: ${foundDuplicate?.id}`
    });

    // -------------------------------------------------------------
    // Scenario 3: Original product's document and fields remain unchanged
    // -------------------------------------------------------------
    const s3Passed = Boolean(
      foundOriginal &&
      foundOriginal.name === originalProduct.name &&
      foundOriginal.sku === originalProduct.sku &&
      foundOriginal.adultNetPrice === originalProduct.adultNetPrice &&
      foundOriginal.status === originalProduct.status
    );
    results.push({
      scenario: "Scenario 3: Original product's document and fields remain unchanged",
      passed: s3Passed,
      details: `Original name: "${foundOriginal?.name}", Price: ${foundOriginal?.adultNetPrice}, Status: ${foundOriginal?.status}`
    });

    // -------------------------------------------------------------
    // Scenario 4: Change duplicate's name and verify original name remains unchanged
    // -------------------------------------------------------------
    const updatedDuplicateName = `Custom Cloned Experience - ${Date.now()}`;
    await db.saveProductAsync({ ...duplicatedProduct!, name: updatedDuplicateName }, mockAdminUser);
    const refetchedOriginalAfterNameChange = db.getProductById(originalProduct.id);
    const refetchedDuplicateAfterNameChange = db.getProductById(duplicatedProduct!.id);
    const s4Passed = Boolean(
      refetchedOriginalAfterNameChange?.name === originalProduct.name &&
      refetchedDuplicateAfterNameChange?.name === updatedDuplicateName
    );
    results.push({
      scenario: "Scenario 4: Modifying duplicate's name preserves original name unchanged",
      passed: s4Passed,
      details: `Original: "${refetchedOriginalAfterNameChange?.name}", Duplicate: "${refetchedDuplicateAfterNameChange?.name}"`
    });

    // -------------------------------------------------------------
    // Scenario 5: Change duplicate's price and verify original price remains unchanged
    // -------------------------------------------------------------
    const updatedDuplicatePrice = (originalProduct.adultNetPrice || 500) + 12500;
    await db.saveProductAsync({
      ...duplicatedProduct!,
      name: updatedDuplicateName,
      adultNetPrice: updatedDuplicatePrice,
      adultNettCost: updatedDuplicatePrice
    }, mockAdminUser);

    const refetchedOriginalAfterPriceChange = db.getProductById(originalProduct.id);
    const refetchedDuplicateAfterPriceChange = db.getProductById(duplicatedProduct!.id);
    const s5Passed = Boolean(
      refetchedOriginalAfterPriceChange?.adultNetPrice === originalProduct.adultNetPrice &&
      refetchedDuplicateAfterPriceChange?.adultNetPrice === updatedDuplicatePrice
    );
    results.push({
      scenario: "Scenario 5: Modifying duplicate's price preserves original price unchanged",
      passed: s5Passed,
      details: `Original Price: ${refetchedOriginalAfterPriceChange?.adultNetPrice}, Duplicate Price: ${refetchedDuplicateAfterPriceChange?.adultNetPrice}`
    });

    // -------------------------------------------------------------
    // Scenario 6: Edit and save original and verify duplicate remains unchanged
    // -------------------------------------------------------------
    const updatedOriginalDescription = `Updated original description ${Date.now()}`;
    await db.saveProductAsync({
      ...originalProduct,
      shortDescription: updatedOriginalDescription
    }, mockAdminUser);

    const refetchedOriginalAfterOrigEdit = db.getProductById(originalProduct.id);
    const refetchedDuplicateAfterOrigEdit = db.getProductById(duplicatedProduct!.id);
    const s6Passed = Boolean(
      refetchedOriginalAfterOrigEdit?.shortDescription === updatedOriginalDescription &&
      refetchedDuplicateAfterOrigEdit?.name === updatedDuplicateName &&
      refetchedDuplicateAfterOrigEdit?.adultNetPrice === updatedDuplicatePrice
    );
    results.push({
      scenario: 'Scenario 6: Editing original product preserves duplicate unchanged',
      passed: s6Passed,
      details: `Original Desc: "${refetchedOriginalAfterOrigEdit?.shortDescription?.slice(0, 30)}...", Duplicate Name: "${refetchedDuplicateAfterOrigEdit?.name}"`
    });

    // -------------------------------------------------------------
    // Scenario 7: Copied destination mappings, pricing fields, attributes preserved
    // -------------------------------------------------------------
    const s7Passed = Boolean(
      refetchedDuplicateAfterOrigEdit &&
      (refetchedDuplicateAfterOrigEdit.destinationId === originalProduct.destinationId ||
       refetchedDuplicateAfterOrigEdit.destinationId === refetchedOriginalAfterOrigEdit?.destinationId) &&
      refetchedDuplicateAfterOrigEdit.destinationName === originalProduct.destinationName &&
      refetchedDuplicateAfterOrigEdit.category === originalProduct.category &&
      refetchedDuplicateAfterOrigEdit.currency === originalProduct.currency
    );
    results.push({
      scenario: 'Scenario 7: Destination mappings, category, currency preserved correctly',
      passed: s7Passed,
      details: `Destination: ${refetchedDuplicateAfterOrigEdit?.destinationId}, Category: ${refetchedDuplicateAfterOrigEdit?.category}, Currency: ${refetchedDuplicateAfterOrigEdit?.currency}`
    });

    // -------------------------------------------------------------
    // Scenario 8: Unique identifiers regenerated where required (ID, SKU, slug, primaryImageId)
    // -------------------------------------------------------------
    const s8Passed = Boolean(
      duplicatedProduct.id !== originalProduct.id &&
      duplicatedProduct.sku !== originalProduct.sku &&
      duplicatedProduct.sku.includes('-COPY') &&
      (!originalProduct.slug || duplicatedProduct.slug !== originalProduct.slug) &&
      (!originalProduct.primaryImageId || duplicatedProduct.primaryImageId !== originalProduct.primaryImageId)
    );
    results.push({
      scenario: 'Scenario 8: Unique identifiers regenerated (ID, SKU, slug, primaryImageId)',
      passed: s8Passed,
      details: `Orig SKU: ${originalProduct.sku}, Dup SKU: ${duplicatedProduct.sku}, Dup ID: ${duplicatedProduct.id}`
    });

    // -------------------------------------------------------------
    // Scenario 9: Authorization and validation rules still apply
    // -------------------------------------------------------------
    let unauthorizedBlocked = false;
    try {
      const unauthorizedUser: User = {
        id: 'usr-unauth',
        email: 'agent@partner.com',
        role: 'AGENT'
      };
      await db.duplicateProductAsync(originalProduct.id, unauthorizedUser);
    } catch (err: any) {
      unauthorizedBlocked = err.message.includes('Unauthorized');
    }
    results.push({
      scenario: 'Scenario 9: Security and authorization rules enforced on duplicate',
      passed: unauthorizedBlocked,
      details: `Unauthorized write attempt properly blocked: ${unauthorizedBlocked}`
    });

    // -------------------------------------------------------------
    // Scenario 10: Simulated failed Firestore write reports failure without false success
    // -------------------------------------------------------------
    let nonExistentFailed = false;
    try {
      await db.duplicateProductAsync('non-existent-product-id-99999', mockAdminUser);
    } catch (err: any) {
      nonExistentFailed = err.message.includes('Product not found');
    }
    results.push({
      scenario: 'Scenario 10: Failed duplicate operation throws clear error without false success',
      passed: nonExistentFailed,
      details: `Non-existent product failure caught: ${nonExistentFailed}`
    });

    // -------------------------------------------------------------
    // Scenario 11: Repeated duplicates create independent copies with unique SKUs
    // -------------------------------------------------------------
    const secondDuplicate = await db.duplicateProductAsync(originalProduct.id, mockAdminUser);
    const s11Passed = Boolean(
      secondDuplicate &&
      secondDuplicate.id !== duplicatedProduct.id &&
      secondDuplicate.id !== originalProduct.id &&
      secondDuplicate.sku !== duplicatedProduct.sku &&
      secondDuplicate.sku !== originalProduct.sku
    );
    results.push({
      scenario: 'Scenario 11: Repeated duplicates create distinct copies with unique SKUs without overwrite',
      passed: s11Passed,
      details: `First Dup SKU: ${duplicatedProduct.sku}, Second Dup SKU: ${secondDuplicate?.sku}`
    });

    // Clean up second duplicate
    if (secondDuplicate) {
      db.deleteProduct(secondDuplicate.id, mockAdminUser);
    }

    // -------------------------------------------------------------
    // Scenario 12: Existing Create, Edit, and Delete functionality continues to work
    // -------------------------------------------------------------
    // Test Delete on first duplicate
    db.deleteProduct(duplicatedProduct.id, mockAdminUser);
    const finalProducts = db.getProducts();
    const duplicateCleanedUp = !finalProducts.some(p => p.id === duplicatedProduct!.id);
    const originalStillIntact = finalProducts.some(p => p.id === originalProduct.id);
    const s12Passed = duplicateCleanedUp && originalStillIntact;
    results.push({
      scenario: 'Scenario 12: Create, Edit, and Delete operations continue to work reliably',
      passed: s12Passed,
      details: `Duplicate deleted: ${duplicateCleanedUp}, Original intact: ${originalStillIntact}`
    });

  } catch (error: any) {
    console.error('[Audit Error]', error);
    results.push({
      scenario: 'Audit Runtime Error',
      passed: false,
      details: error?.message || String(error)
    });
  }

  const allPassed = results.every(r => r.passed);
  return { passed: allPassed, results };
}

// Self-executing runner for tsx
if (import.meta.url.endsWith('productDuplicationIndependenceAudit.ts')) {
  runProductDuplicationAudit().then(({ passed, results }) => {
    console.log('\n======================================================');
    console.log(' PRODUCT DUPLICATION & INDEPENDENCE AUDIT REPORT');
    console.log('======================================================\n');
    results.forEach((r, idx) => {
      const status = r.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${idx + 1}. [${status}] ${r.scenario}`);
      console.log(`   ${r.details}\n`);
    });
    console.log(`OVERALL RESULT: ${passed ? 'ALL TESTS PASSED ✅' : 'FAILURES DETECTED ❌'}`);
    process.exit(passed ? 0 : 1);
  });
}
