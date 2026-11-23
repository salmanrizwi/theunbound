import assert from 'node:assert/strict';
import { AppDatabase } from '../services/db';
import { HomepageService } from '../services/homepageService';
import { INITIAL_DEMO_BOOKING_CONFIG } from '../data/initialHomepage';
import {
  CANONICAL_SECTION_DEFINITIONS,
  initSequenceDraft
} from '../components/AdminCMS/HomepageManager';
import {
  validateCalendlyUrl,
  validateDemoBookingConfigForPublish,
  getPublishableDemoBookingButtons,
  trackDemoBookingClick
} from '../utils/demoBookingValidation';
import type { HomepageConfig, HomepageDemoBookingConfig, User } from '../types';

async function runDemoBookingAudit() {
  console.log('================================================================');
  console.log('  THEUNBOUND DEMO BOOKING SECTION & LAYOUT MANAGER AUDIT');
  console.log('================================================================\n');

  const db = AppDatabase.getInstance();
  const homepageService = HomepageService.getInstance();
  const snapshotBefore = JSON.parse(JSON.stringify(db.getHomepageConfig())) as HomepageConfig;

  const adminUser: User = {
    id: 'usr-admin-demo-audit',
    name: 'Demo Booking Audit Admin',
    email: 'admin.demo.audit@theunbound.in',
    role: 'ADMIN',
    agencyName: 'TheUnbound HQ',
    phone: '+91 98765 43210',
    createdAt: new Date().toISOString()
  };

  try {
    // 1. Default safety: zero hardcoded/fake Calendly URLs & zero broken public buttons
    console.log('1. Default Safety & Zero Hardcoded Calendly URLs');
    assert.equal(INITIAL_DEMO_BOOKING_CONFIG.buttons.length, 2, 'Exactly 2 buttons configured');
    assert.equal(INITIAL_DEMO_BOOKING_CONFIG.buttons[0].calendlyUrl, '', 'Button 1 has no hardcoded fake URL');
    assert.equal(INITIAL_DEMO_BOOKING_CONFIG.buttons[1].calendlyUrl, '', 'Button 2 has no hardcoded fake URL');
    assert.equal(
      getPublishableDemoBookingButtons(INITIAL_DEMO_BOOKING_CONFIG).length,
      0,
      'Unconfigured buttons produce zero broken CTAs on public homepage'
    );
    console.log('   [PASS] Zero hardcoded/fake Calendly links; no broken buttons rendered by default.\n');

    // 2. Strict Calendly URL validation (accept valid Calendly, reject non-Calendly & unsafe schemes)
    console.log('2. Strict Calendly URL Validation');
    const validUrls = [
      'https://calendly.com/theunbound/platform-demo',
      'https://www.calendly.com/theunbound/partnership-call',
      'https://enterprise.calendly.com/team/japan-dmc',
      'https://calendly.com/d/cp8x-4k2m/discovery?month=2026-11'
    ];
    for (const u of validUrls) {
      const res = validateCalendlyUrl(u);
      assert.equal(res.valid, true, `Expected valid Calendly URL to pass: ${u}`);
    }

    const invalidUrls = [
      '',
      '   ',
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'http://calendly.com/theunbound/demo',
      'https://calendly.com/',
      'https://evil-calendly.com/theunbound/demo',
      'https://example.com/calendly.com/demo',
      'https://user:pass@calendly.com/theunbound/demo',
      'https://calendly.com/theunbound/demo <script>'
    ];
    for (const u of invalidUrls) {
      const res = validateCalendlyUrl(u);
      assert.equal(res.valid, false, `Expected invalid/unsafe URL to be rejected: "${u}"`);
    }
    console.log('   [PASS] Valid HTTPS Calendly URLs accepted; unsafe/non-Calendly/empty URLs rejected.\n');

    // 3. Publish validation blocks broken CTAs and preserves previous valid config
    console.log('3. Publish Validation & Previous Config Preservation');
    const brokenDraft: HomepageDemoBookingConfig = {
      ...INITIAL_DEMO_BOOKING_CONFIG,
      buttons: [
        { ...INITIAL_DEMO_BOOKING_CONFIG.buttons[0], enabled: true, calendlyUrl: '' },
        { ...INITIAL_DEMO_BOOKING_CONFIG.buttons[1], enabled: true, calendlyUrl: 'https://google.com/meet' }
      ]
    };
    const brokenValidation = validateDemoBookingConfigForPublish(brokenDraft);
    assert.equal(brokenValidation.valid, false, 'Publish blocked when enabled buttons have missing/invalid URLs');
    assert.ok(brokenValidation.buttonErrors['demo-btn-1'], 'Button 1 missing URL flagged');
    assert.ok(brokenValidation.buttonErrors['demo-btn-2'], 'Button 2 non-Calendly URL flagged');
    console.log('   [PASS] Enabled buttons with missing or invalid URLs are blocked from publishing.\n');

    // 4. Independent 2-button configuration, display order, and disabled button hiding
    console.log('4. Independent 2-Button Configuration, Order & Disabled Hiding');
    const validTwoBtnConfig: HomepageDemoBookingConfig = {
      ...INITIAL_DEMO_BOOKING_CONFIG,
      eyebrowText: 'PARTNER WITH US',
      headline: 'Experience Our Japan DMC Platform Live.',
      description: 'Walk through wholesale inventory, instant quotations, and direct ground operations.',
      buttons: [
        {
          id: 'demo-btn-1',
          slot: 1,
          label: 'Book a Platform Demo',
          calendlyUrl: 'https://calendly.com/theunbound/platform-demo',
          supportingText: '25-min product walkthrough',
          enabled: true,
          displayOrder: 2,
          style: 'primary-teal'
        },
        {
          id: 'demo-btn-2',
          slot: 2,
          label: 'Schedule a Partnership Discussion',
          calendlyUrl: 'https://calendly.com/theunbound/partnership-discussion',
          supportingText: 'Agency onboarding & rates',
          enabled: true,
          displayOrder: 1,
          style: 'outline-teal'
        }
      ],
      updatedAt: new Date().toISOString(),
      updatedBy: adminUser.email
    };

    const validCheck = validateDemoBookingConfigForPublish(validTwoBtnConfig);
    assert.equal(validCheck.valid, true, 'Valid 2-button config passes publish validation');

    const publishable = getPublishableDemoBookingButtons(validTwoBtnConfig);
    assert.equal(publishable.length, 2, 'Both enabled buttons are publishable');
    assert.equal(publishable[0].id, 'demo-btn-2', 'Display order respected (Button 2 rendered first)');
    assert.equal(publishable[1].id, 'demo-btn-1', 'Display order respected (Button 1 rendered second)');
    assert.notEqual(
      publishable[0].validatedUrl,
      publishable[1].validatedUrl,
      'Each button maintains its own independent Calendly URL'
    );

    const oneDisabledConfig: HomepageDemoBookingConfig = {
      ...validTwoBtnConfig,
      buttons: [
        { ...validTwoBtnConfig.buttons[0], enabled: false },
        validTwoBtnConfig.buttons[1]
      ]
    };
    const publishableOne = getPublishableDemoBookingButtons(oneDisabledConfig);
    assert.equal(publishableOne.length, 1, 'Disabled button is strictly hidden');
    assert.equal(publishableOne[0].id, 'demo-btn-2', 'Only enabled button renders');
    console.log('   [PASS] Independent URLs, labels, display ordering, and disabled button hiding verified.\n');

    // 5. Homepage Control & Layout Manager registration, reordering, visibility, and persistence
    console.log('5. Homepage Control & Layout Manager Integration & Ordering');
    const canonicalEntry = CANONICAL_SECTION_DEFINITIONS.find(d => d.key === 'demoBooking');
    assert.ok(canonicalEntry, 'demoBooking registered in CANONICAL_SECTION_DEFINITIONS');
    assert.equal(canonicalEntry.label, 'Demo Booking / Schedule a Meeting', 'Section label matches spec');
    assert.equal(canonicalEntry.toggleKey, 'showDemoBookingSection', 'Toggle key matches HomepageConfig');

    const initialDraft = initSequenceDraft(db.getHomepageConfig());
    const demoDraftIdx = initialDraft.findIndex(d => d.key === 'demoBooking');
    assert.ok(demoDraftIdx >= 0, 'demoBooking appears in Layout Manager sequence draft');

    // Move demoBooking to position 2 (right after Hero) while preserving all other section relative order
    const reordered = [...initialDraft];
    const [demoMod] = reordered.splice(demoDraftIdx, 1);
    reordered.splice(1, 0, demoMod);
    const normalizedReordered = reordered.map((m, idx) => ({ ...m, sequence: idx + 1 }));

    const nextOrder = normalizedReordered.map(m => m.key);
    assert.equal(nextOrder.filter(k => k === 'demoBooking').length, 1, 'No duplicate demoBooking entries');
    assert.equal(nextOrder[1], 'demoBooking', 'demoBooking repositioned to slot 2');

    const sectionsMap: Record<string, { sequence: number; active: boolean; updatedAt: string; updatedBy: string }> = {};
    const toggles: Record<string, boolean> = {};
    const now = new Date().toISOString();
    normalizedReordered.forEach(m => {
      sectionsMap[m.key] = { sequence: m.sequence, active: m.active, updatedAt: now, updatedBy: adminUser.email };
      toggles[m.toggleKey] = m.active;
    });

    const persistedConfig: HomepageConfig = {
      ...db.getHomepageConfig(),
      ...toggles,
      homepageModuleOrder: nextOrder,
      homepageSections: sectionsMap,
      demoBookingConfig: {
        ...validTwoBtnConfig,
        displayOrder: 2,
        isActive: true
      },
      version: (db.getHomepageConfig().version || 1) + 1,
      updatedAt: now,
      updatedBy: adminUser.email
    };

    db.updateHomepageConfig(persistedConfig, adminUser);

    const reloaded = db.getHomepageConfig();
    assert.equal(reloaded.homepageModuleOrder?.[1], 'demoBooking', 'Reordered position persisted');
    assert.equal(reloaded.demoBookingConfig?.headline, validTwoBtnConfig.headline, 'Headline preserved after reorder');
    assert.equal(
      reloaded.demoBookingConfig?.buttons[0].calendlyUrl,
      'https://calendly.com/theunbound/platform-demo',
      'Button 1 Calendly URL intact after reorder'
    );
    assert.equal(
      reloaded.demoBookingConfig?.buttons[1].calendlyUrl,
      'https://calendly.com/theunbound/partnership-discussion',
      'Button 2 Calendly URL intact after reorder'
    );

    const serviceSections = homepageService.getHomepageSections();
    const demoInService = serviceSections.find(s => s.sectionId === 'demoBooking');
    assert.ok(demoInService, 'HomepageService exposes demoBooking section');
    assert.equal(demoInService.displayOrder, 2, 'HomepageService reflects updated displayOrder=2');
    assert.equal(demoInService.isActive, true, 'HomepageService reflects active status');

    // Test deactivating demoBooking preserves content & URLs
    const deactivatedConfig: HomepageConfig = {
      ...reloaded,
      showDemoBookingSection: false,
      demoBookingConfig: { ...reloaded.demoBookingConfig!, isActive: false },
      homepageSections: {
        ...(reloaded.homepageSections || {}),
        demoBooking: { sequence: 2, active: false, updatedAt: now, updatedBy: adminUser.email }
      }
    };
    db.updateHomepageConfig(deactivatedConfig, adminUser);
    const afterDeactivate = db.getHomepageConfig();
    assert.equal(afterDeactivate.showDemoBookingSection, false, 'Section deactivated cleanly');
    assert.equal(
      afterDeactivate.demoBookingConfig?.buttons[0].calendlyUrl,
      'https://calendly.com/theunbound/platform-demo',
      'Button URLs preserved while deactivated'
    );
    const demoAfterDeactivate = homepageService.getHomepageSections().find(s => s.sectionId === 'demoBooking');
    assert.equal(demoAfterDeactivate?.isActive, false, 'HomepageService reports inactive status');
    console.log('   [PASS] Layout Manager ordering, deactivation, and non-destructive persistence verified.\n');

    // 6. Privacy-safe GA4 event tracking (no PII)
    console.log('6. Privacy-Safe GA4 Click Event Tracking');
    const capturedEvents: Array<{ name: string; payload: Record<string, any> }> = [];
    (globalThis as any).window = {
      gtag: (_cmd: string, name: string, payload: Record<string, any>) => {
        capturedEvents.push({ name, payload });
      }
    };
    trackDemoBookingClick({
      sectionId: 'demoBooking',
      buttonId: 'demo-btn-1',
      buttonSlot: 1,
      displayOrder: 1
    });
    trackDemoBookingClick({
      sectionId: 'demoBooking',
      buttonId: 'demo-btn-2',
      buttonSlot: 2,
      displayOrder: 2
    });
    assert.equal(capturedEvents.length, 4, 'Emits click + link_opened events for each button');
    assert.equal(capturedEvents[0].name, 'demo_booking_button_1_clicked');
    assert.equal(capturedEvents[1].name, 'demo_booking_link_opened');
    assert.equal(capturedEvents[2].name, 'demo_booking_button_2_clicked');
    assert.equal(capturedEvents[3].name, 'demo_booking_link_opened');
    assert.equal(capturedEvents[0].payload.section_id, 'demoBooking');
    assert.equal(capturedEvents[0].payload.button_id, 'demo-btn-1');
    assert.equal('email' in capturedEvents[0].payload, false, 'Zero PII transmitted');
    console.log('   [PASS] Non-sensitive GA4 tracking events verified with zero PII.\n');

    console.log('=== ALL DEMO BOOKING & LAYOUT MANAGER AUDITS PASSED ===');
  } finally {
    // Restore original homepage configuration cleanly
    db.updateHomepageConfig(snapshotBefore, adminUser);
  }
}

runDemoBookingAudit()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('DEMO BOOKING AUDIT FAILED:', err);
    process.exit(1);
  });
