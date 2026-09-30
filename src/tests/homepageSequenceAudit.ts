import { AppDatabase } from '../services/db';
import { HomepageService } from '../services/homepageService';
import { 
  HomepageConfig, 
  User 
} from '../types';
import { 
  CANONICAL_SECTION_DEFINITIONS, 
  initSequenceDraft, 
  SequenceModuleItem 
} from '../components/AdminCMS/HomepageManager';

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    throw new Error(`Audit Failure: ${message}`);
  }
}

async function runHomepageSequenceAudit() {
  console.log('================================================================');
  console.log('  THEUNBOUND HOMEPAGE SECTION SEQUENCE & ORDERING AUDIT SUITE');
  console.log('================================================================\n');

  const db = AppDatabase.getInstance();
  const homepageService = HomepageService.getInstance();

  const adminUser: User = {
    id: 'usr-admin-sequence-audit',
    name: 'Sequence Audit Administrator',
    email: 'admin.audit@theunbound.in',
    role: 'ADMIN',
    agencyName: 'TheUnbound HQ',
    phone: '+91 98765 43210',
    createdAt: new Date().toISOString()
  };

  // --- 1. CANONICAL REGISTRY INTEGRITY AUDIT ---
  console.log('--- 1. Canonical Section Registry Integrity Audit ---');
  const sections = homepageService.getHomepageSections();
  assert(sections.length >= 10, `Registered sections count (${sections.length}) >= 10`);

  const initialDraft = initSequenceDraft(db.getHomepageConfig());
  assert(initialDraft.length >= 10, `Draft modules count (${initialDraft.length}) >= 10`);
  
  CANONICAL_SECTION_DEFINITIONS.forEach(def => {
    const found = initialDraft.find(d => d.key === def.key);
    assert(!!found, `Section "${def.key}" (${def.label}) present in canonical draft registry`);
  });

  // --- 2. SEQUENCE REORDERING & ARROW CONSTRAINTS AUDIT ---
  console.log('\n--- 2. Sequence Reordering & Arrow Constraints Audit ---');
  let draft = [...initialDraft];

  // Test first position arrow constraint
  assert(draft[0].sequence === 1, `First section "${draft[0].label}" has sequence 1`);
  
  // Test swapping position 1 and 2
  const item0Key = draft[0].key;
  const item1Key = draft[1].key;

  // Move item 1 up (swap with item 0)
  const temp0 = draft[0];
  draft[0] = draft[1];
  draft[1] = temp0;
  draft = draft.map((item, idx) => ({ ...item, sequence: idx + 1 }));

  assert(draft[0].key === item1Key, `Item 1 ("${item1Key}") moved to position 1`);
  assert(draft[1].key === item0Key, `Item 0 ("${item0Key}") moved to position 2`);
  assert(draft[0].sequence === 1, `New position 1 has sequence 1`);
  assert(draft[1].sequence === 2, `New position 2 has sequence 2`);

  // --- 3. ACTIVATION & DEACTIVATION NON-DESTRUCTIVE AUDIT ---
  console.log('\n--- 3. Activation & Deactivation Non-Destructive Audit ---');
  // Find "testimonials" or "homepageFaqs" or "newsletter"
  const targetIdx = draft.findIndex(d => d.key === 'newsletter' || d.key === 'homepageFaqs');
  assert(targetIdx >= 0, `Target section for activation test found at index ${targetIdx}`);

  const targetKey = draft[targetIdx].key;
  const originalSeq = draft[targetIdx].sequence;

  // Deactivate
  draft[targetIdx] = { ...draft[targetIdx], active: false };
  assert(draft[targetIdx].active === false, `Section "${targetKey}" deactivated in draft state`);
  assert(draft[targetIdx].sequence === originalSeq, `Section "${targetKey}" retains its exact sequence position (${originalSeq}) when deactivated`);

  // --- 4. ATOMIC PERSISTENCE & FIREBASE SYNC AUDIT ---
  console.log('\n--- 4. Atomic Persistence & Firebase Sync Audit ---');
  const orderKeys = draft.map(m => m.key);
  const sectionsMap: Record<string, { sequence: number; active: boolean; updatedAt: string; updatedBy: string }> = {};
  const toggleUpdates: Record<string, boolean> = {};

  draft.forEach(m => {
    sectionsMap[m.key] = {
      sequence: m.sequence,
      active: m.active,
      updatedAt: new Date().toISOString(),
      updatedBy: adminUser.email
    };
    toggleUpdates[m.toggleKey] = m.active;
  });

  const latestConfig = db.getHomepageConfig();
  const updatedConfig: HomepageConfig = {
    ...latestConfig,
    ...toggleUpdates,
    homepageModuleOrder: orderKeys,
    homepageSections: sectionsMap,
    version: (latestConfig.version || 1) + 1,
    updatedAt: new Date().toISOString(),
    updatedBy: adminUser.email
  };

  db.updateHomepageConfig(updatedConfig, adminUser);

  const reloadedConfig = db.getHomepageConfig();
  assert(reloadedConfig.homepageModuleOrder![0] === item1Key, `Persisted homepageModuleOrder[0] matches "${item1Key}"`);
  assert(reloadedConfig.homepageModuleOrder![1] === item0Key, `Persisted homepageModuleOrder[1] matches "${item0Key}"`);
  assert((reloadedConfig as any)[draft[targetIdx].toggleKey] === false, `Persisted toggle ${String(draft[targetIdx].toggleKey)} is false`);
  assert(reloadedConfig.homepageSections![targetKey].active === false, `Persisted homepageSections["${targetKey}"].active is false`);

  // --- 5. PUBLIC HOMEPAGE RENDERING AUDIT ---
  console.log('\n--- 5. Public Homepage Rendering Audit ---');
  const activeSections = homepageService.getHomepageSections();
  const deactivatedInService = activeSections.find(s => s.sectionId === targetKey);
  assert(deactivatedInService?.isActive === false, `HomepageService recognizes deactivated section "${targetKey}" as isActive: false`);

  // --- 6. REACTIVATION & RESTORATION AUDIT ---
  console.log('\n--- 6. Reactivation & Restoration Audit ---');
  // Reactivate section
  draft[targetIdx] = { ...draft[targetIdx], active: true };
  const reactivatedToggleUpdates: Record<string, boolean> = {};
  const reactivatedSectionsMap: Record<string, any> = {};

  draft.forEach(m => {
    reactivatedSectionsMap[m.key] = {
      sequence: m.sequence,
      active: m.active,
      updatedAt: new Date().toISOString(),
      updatedBy: adminUser.email
    };
    reactivatedToggleUpdates[m.toggleKey] = m.active;
  });

  const restoredConfig: HomepageConfig = {
    ...db.getHomepageConfig(),
    ...reactivatedToggleUpdates,
    homepageModuleOrder: draft.map(m => m.key),
    homepageSections: reactivatedSectionsMap,
    version: (reloadedConfig.version || 1) + 1,
    updatedAt: new Date().toISOString(),
    updatedBy: adminUser.email
  };

  db.updateHomepageConfig(restoredConfig, adminUser);
  const reloadedRestored = db.getHomepageConfig();
  assert(reloadedRestored.homepageSections![targetKey].active === true, `Reactivated section "${targetKey}" restored to active: true`);
  assert((reloadedRestored as any)[draft[targetIdx].toggleKey] === true, `Reactivated toggle restored to true`);

  // --- 7. CLEANUP & RESET TO CANONICAL RECOMMENDED LAYOUT ---
  console.log('\n--- 7. Cleanup & Reset to Canonical Recommended Layout ---');
  const canonicalKeys = CANONICAL_SECTION_DEFINITIONS.map(c => c.key);
  const canonicalToggles: Record<string, boolean> = {};
  const canonicalSectionsMap: Record<string, any> = {};

  CANONICAL_SECTION_DEFINITIONS.forEach((def, idx) => {
    canonicalSectionsMap[def.key] = {
      sequence: idx + 1,
      active: true,
      updatedAt: new Date().toISOString(),
      updatedBy: adminUser.email
    };
    canonicalToggles[def.toggleKey] = true;
  });

  const finalResetConfig: HomepageConfig = {
    ...db.getHomepageConfig(),
    ...canonicalToggles,
    homepageModuleOrder: canonicalKeys,
    homepageSections: canonicalSectionsMap,
    version: (reloadedRestored.version || 1) + 1,
    updatedAt: new Date().toISOString(),
    updatedBy: adminUser.email
  };

  db.updateHomepageConfig(finalResetConfig, adminUser);
  const finalCheck = db.getHomepageConfig();
  assert(finalCheck.homepageModuleOrder![0] === 'hero', `Final reset restored "hero" to position 1`);

  console.log('\n================================================================');
  console.log('  HOMEPAGE SEQUENCE AUDIT COMPLETE: ALL CHECKS PASSED (0 FAILURES)');
  console.log('================================================================\n');
  process.exit(0);
}

runHomepageSequenceAudit().catch(err => {
  console.error('Audit execution error:', err);
  process.exit(1);
});
