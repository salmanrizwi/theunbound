import fs from 'fs';
import path from 'path';
import { AppDatabase } from '../services/db';
import {
  getActiveOrderedVisaEntries,
  formatVisaEntryText,
  getAuthoritativeVisaUnitSellingPrice,
  createQuoteVisaSnapshot
} from '../services/visaRequirementService';
import {
  createQuoteItemContentSnapshot,
  resolveQuoteItemInclusions,
  resolveQuoteItemExclusions
} from '../utils/b2bQuotationHelpers';
import {
  buildQuotePresentationModel,
  renderQuoteEmailFromPresentationModel,
  renderQuoteWhatsAppFromPresentationModel
} from '../services/quotePresentationModel';
import { paginateQuotePresentationModel } from '../services/pdfPaginationEngine';
import { renderProposalViewHtmlEmail } from '../services/quoteEmailFormatter';
import { computeQuotationCommercialContentHash } from '../services/quotationSnapshotService';
import {
  Quotation,
  QuoteItem,
  User,
  VisaInclusionExclusionEntry,
  VisaProduct,
  Product
} from '../types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ ${message}`);
}

function buildVisaProductFromMaster(visa: VisaProduct): Product {
  const authoritativeSelling = getAuthoritativeVisaUnitSellingPrice(visa);
  return {
    id: visa.id,
    sku: `VSA-${visa.countryCode || 'INTL'}-${visa.id.slice(-6).toUpperCase()}`,
    destinationId: visa.destinationId || 'dest-japan',
    destinationName: visa.country,
    country: visa.country,
    city: 'National Embassy / eVisa Desk',
    productType: 'Visa Service',
    name: `${visa.country} ${visa.visaType}`,
    shortDescription: visa.description || '',
    longDescription: visa.description || '',
    supplierId: 'sup-visa-dmc',
    supplierName: 'TheUnbound Visa & Travel Desk',
    supplierProductCode: `VISA-${visa.countryCode || 'INTL'}`,
    category: 'Visa & Ancillary Services',
    subcategory: 'Visa Services',
    duration: `${visa.processingTimeDays} Days`,
    operatingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    operatingHours: '09:00 - 18:00',
    adultNetPrice: authoritativeSelling,
    childNetPrice: authoritativeSelling,
    infantNetPrice: 0,
    currency: visa.currency || 'USD',
    defaultMarkupPercent: 0,
    taxPercent: 0,
    commissionPercent: 0,
    serviceFeeFixed: 0,
    sellingPriceStartingFrom: authoritativeSelling,
    season: 'All Year',
    validityFrom: '2026-01-01',
    validityTo: '2027-12-31',
    minPax: 1,
    maxPax: 20,
    availability: 'INSTANT',
    bookingRequiredDays: 5,
    cancellationPolicy: 'Non-refundable once lodged.',
    inclusions: getActiveOrderedVisaEntries(visa.inclusions).map(formatVisaEntryText),
    exclusions: getActiveOrderedVisaEntries(visa.exclusions).map(formatVisaEntryText),
    importantInformation: [],
    heroImage: ''
  };
}

async function runAudit() {
  console.log('=========================================================================');
  console.log('VISA ADMIN-MANAGED INCLUSIONS & EXCLUSIONS — END-TO-END AUDIT');
  console.log('=========================================================================\n');

  // ---------------------------------------------------------------------------
  // 1. SOURCE AUDIT: VERIFY COMPLETE REMOVAL OF HARDCODED ASSISTANCE CONTENT
  // ---------------------------------------------------------------------------
  console.log('--- 1. Source Code Hardcoded Content Removal Verification ---');
  const rootDir = process.cwd();
  const checkedFiles = [
    'src/components/Configurators/VisaServiceAndFacilitationConfigurator.tsx',
    'src/components/B2BAgentPortal/VisaServicesAndFacilitationSection.tsx',
    'src/components/AdminCMS/VisaCMSManager.tsx',
    'src/services/visaRequirementService.ts',
    'src/data/initialVisas.ts'
  ];
  const forbiddenStrings = [
    'Application Assistance & VIP Facilitation Services',
    'createDefaultAssistanceServices',
    'Application Assistance Options Available',
    'Document verification & dossier pre-audit',
    'Priority Embassy / VFS Appointment Slot Booking',
    'VIP Biometric Center Concierge Escort'
  ];

  for (const relPath of checkedFiles) {
    const content = fs.readFileSync(path.join(rootDir, relPath), 'utf8');
    for (const forbidden of forbiddenStrings) {
      assert(!content.includes(forbidden), `${relPath} does NOT contain hardcoded "${forbidden}"`);
    }
  }

  // Verify Firestore security rules enforce Admin/CMS operations for /visas
  const rulesContent = fs.readFileSync(path.join(rootDir, 'firestore.rules'), 'utf8');
  const visaRuleMatch = rulesContent.match(/match \/visas\/\{document=\*\*\} \{[\s\S]*?\}/);
  assert(Boolean(visaRuleMatch), 'firestore.rules defines /visas/{document=**} rule block');
  const visaRuleBlock = visaRuleMatch?.[0] || '';
  assert(
    visaRuleBlock.includes('allow create, update, delete: if canAccessCMSOperations();'),
    '/visas writes restricted strictly to canAccessCMSOperations()'
  );
  assert(
    !visaRuleBlock.includes('isValidAdminCMSData'),
    '/visas rules no longer allow payload-spoofable isValidAdminCMSData()'
  );

  // ---------------------------------------------------------------------------
  // 2. ADMIN CMS CRUD, REORDER, ACTIVATE/DEACTIVATE & PRODUCT INDEPENDENCE
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. Admin CMS Inclusions & Exclusions CRUD & Product Independence ---');
  const db = AppDatabase.getInstance();
  db.syncFirestoreDocAsync = async () => true;

  const adminUser: User = {
    id: 'usr-admin-audit',
    email: 'business@theunbound.in',
    name: 'Audit Admin',
    role: 'ADMIN',
    createdAt: new Date().toISOString()
  };

  const agentUser: User = {
    id: 'usr-agent-audit',
    email: 'agent@partneragency.com',
    name: 'Agent Tanaka',
    agencyName: 'Pacific Horizon Travels',
    role: 'B2B_AGENT',
    createdAt: new Date().toISOString()
  };

  const now = new Date().toISOString();
  const touristInclusions: VisaInclusionExclusionEntry[] = [
    {
      id: 'INC-JP-T-2',
      title: 'Digital eVisa Grant Delivery',
      description: 'Official QR PDF delivered prior to departure.',
      displayOrder: 2,
      isActive: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'INC-JP-T-1',
      title: 'Consular Filing & Portal Submission',
      description: 'Submitted through accredited DMC desk.',
      displayOrder: 1,
      isActive: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'INC-JP-T-INACTIVE',
      title: 'Hidden Internal Courier Pilot',
      description: 'Should not display when inactive.',
      displayOrder: 3,
      isActive: false,
      createdAt: now,
      updatedAt: now
    }
  ];

  const touristExclusions: VisaInclusionExclusionEntry[] = [
    {
      id: 'EXC-JP-T-1',
      title: 'Expedited Walk-In Consulate Fee',
      description: 'Any urgent embassy handling fee paid directly.',
      displayOrder: 1,
      isActive: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'EXC-JP-T-INACTIVE',
      title: 'Inactive Exclusion Draft',
      description: 'Should remain hidden in Step 5 & quotes.',
      displayOrder: 2,
      isActive: false,
      createdAt: now,
      updatedAt: now
    }
  ];

  const japanTouristVisa: VisaProduct = {
    id: 'visa-audit-jp-tourist',
    country: 'Japan',
    countryCode: 'JP',
    destinationId: 'dest-japan',
    visaType: 'Tourist E-Visa (Single Entry)',
    entryType: 'SINGLE_ENTRY',
    validityDays: 90,
    stayDurationDays: 15,
    processingTimeDays: 5,
    expressProcessingAvailable: false,
    embassyFee: 30,
    serviceFee: 25,
    sellingPrice: 68,
    pricing: {
      currency: 'USD',
      pricingUnit: 'Per Applicant',
      nettPrice: 30,
      marginType: 'PERCENTAGE',
      marginValue: 20,
      marginAmount: 6,
      serviceChargeType: 'FIXED',
      serviceChargeValue: 25,
      serviceChargeAmount: 25,
      taxType: 'PERCENTAGE',
      taxValue: 10,
      taxAmount: 7,
      finalPrice: 68,
      pricingVersion: 1,
      lastUpdatedAt: now
    },
    currency: 'USD',
    description: 'Configured Japan Tourist E-Visa.',
    documentsChecklist: ['Valid Passport'],
    inclusions: touristInclusions,
    exclusions: touristExclusions,
    inclusionsExclusionsVersion: 1,
    submissionSteps: [],
    eligibilityNotes: [],
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now
  };

  const japanBusinessVisa: VisaProduct = {
    id: 'visa-audit-jp-business',
    country: 'Japan',
    countryCode: 'JP',
    destinationId: 'dest-japan',
    visaType: 'Business Visa (Multiple Entry)',
    entryType: 'MULTIPLE_ENTRY',
    validityDays: 365,
    stayDurationDays: 30,
    processingTimeDays: 7,
    expressProcessingAvailable: false,
    embassyFee: 50,
    serviceFee: 45,
    sellingPrice: 95,
    currency: 'USD',
    description: 'Independent Business Visa.',
    documentsChecklist: ['Invitation Letter'],
    inclusions: [
      {
        id: 'INC-JP-B-1',
        title: 'Corporate Invitation Letter Legalization Check',
        displayOrder: 1,
        isActive: true
      }
    ],
    exclusions: [],
    inclusionsExclusionsVersion: 1,
    submissionSteps: [],
    eligibilityNotes: [],
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now
  };

  await db.saveVisaAsync(japanTouristVisa, adminUser);
  await db.saveVisaAsync(japanBusinessVisa, adminUser);

  const savedTourist = db.getVisaById('visa-audit-jp-tourist')!;
  const savedBusiness = db.getVisaById('visa-audit-jp-business')!;
  assert(Boolean(savedTourist) && Boolean(savedBusiness), 'Both Visa products saved independently to database');

  const activeOrderedTouristInclusions = getActiveOrderedVisaEntries(savedTourist.inclusions);
  assert(activeOrderedTouristInclusions.length === 2, 'Inactive tourist inclusion filtered out cleanly');
  assert(
    activeOrderedTouristInclusions[0].id === 'INC-JP-T-1' && activeOrderedTouristInclusions[1].id === 'INC-JP-T-2',
    'Active tourist inclusions sorted strictly by displayOrder ascending'
  );

  const activeOrderedTouristExclusions = getActiveOrderedVisaEntries(savedTourist.exclusions);
  assert(activeOrderedTouristExclusions.length === 1, 'Inactive tourist exclusion filtered out cleanly');
  assert(activeOrderedTouristExclusions[0].id === 'EXC-JP-T-1', 'Active tourist exclusion returned in displayOrder');

  // Empty product returns [] with zero fabricated defaults
  const emptyVisa: VisaProduct = {
    ...japanBusinessVisa,
    id: 'visa-audit-empty',
    inclusions: [],
    exclusions: []
  };
  await db.saveVisaAsync(emptyVisa, adminUser);
  const emptyProductMapped = buildVisaProductFromMaster(emptyVisa);
  assert(emptyProductMapped.inclusions?.length === 0, 'Empty inclusions produces [] without fabricated defaults');
  assert(emptyProductMapped.exclusions?.length === 0, 'Empty exclusions produces [] without fabricated defaults');

  // Business Visa remains completely unaffected by Tourist Visa entries
  assert(
    getActiveOrderedVisaEntries(savedBusiness.inclusions).length === 1 &&
      getActiveOrderedVisaEntries(savedBusiness.inclusions)[0].title === 'Corporate Invitation Letter Legalization Check',
    'Second Visa product inclusions remain completely independent'
  );

  // Authoritative pricing check without arbitrary facilitation fees
  assert(
    getAuthoritativeVisaUnitSellingPrice(savedTourist) === 68,
    'Authoritative Visa unit selling price uses configured pricing.finalPrice ($68)'
  );
  const v1VisaSnapshot = createQuoteVisaSnapshot(savedTourist, {
    applicantNationality: 'Indian',
    applicantProfile: 'EMPLOYED'
  });
  assert(v1VisaSnapshot.pricing.assistanceFee === 0, 'No arbitrary application assistance fee added');
  assert(v1VisaSnapshot.pricing.totalSellingPrice === 68, 'Snapshot unit selling price matches authoritative price ($68)');
  assert(v1VisaSnapshot.inclusions?.length === 2 && v1VisaSnapshot.exclusions?.length === 1, 'Visa snapshot captures active inclusions/exclusions');

  // ---------------------------------------------------------------------------
  // 3. QUOTATION VERSION v1 SNAPSHOT & 7-OUTPUT SYNCHRONIZATION
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Quotation Version v1 Snapshot & Output Synchronization ---');
  const v1Product = buildVisaProductFromMaster(savedTourist);
  const v1Item: QuoteItem = {
    id: 'item-visa-audit-1',
    product: v1Product,
    travelDate: '2026-11-10',
    pax: { adults: 2, children: 0, infants: 0 },
    selectedAddonIds: [],
    service_type: 'VISA',
    category: 'Visa & Ancillary Services',
    master_product_id: savedTourist.id,
    visaSnapshot: v1VisaSnapshot,
    calculation: {
      unitAdultSelling: 68,
      unitChildSelling: 68,
      unitInfantSelling: 0,
      adultsTotal: 136,
      childrenTotal: 0,
      infantsTotal: 0,
      addonsTotal: 0,
      finalTotalSellingPrice: 136,
      currency: 'USD'
    } as any
  };
  v1Item.contentSnapshot = createQuoteItemContentSnapshot(v1Product, v1Item);

  const quoteV1: Quotation = {
    id: 'QTE-VISA-AUDIT-1',
    quoteNumber: 'QTE-VISA-AUDIT-1',
    title: 'Japan Visa Audit Itinerary',
    version: 1,
    snapshotVersion: 1,
    status: 'DRAFT',
    destination: 'Japan',
    currency: 'USD',
    overallDiscountPercent: 0,
    agentNotes: 'Visa inclusion & exclusion audit fixture',
    termsAndConditions: 'Standard Japan Visa commercial terms apply.',
    validUntil: '2026-12-31',
    totalNetCost: 60,
    totalSellingPrice: 136,
    totalTaxes: 0,
    totalMargin: 76,
    finalCustomerSellingPrice: 136,
    baseFinalSellingPrice: 136,
    agentMarginType: 'FIXED',
    agentMarginValue: 0,
    agentMarginAmount: 0,
    brandingMode: 'WHITE_LABEL',
    clientName: 'Aarav Sharma',
    clientEmail: 'aarav@example.com',
    agentId: agentUser.id,
    agentName: agentUser.name,
    agentAgency: agentUser.agencyName,
    travelStartDate: '2026-11-10',
    travelEndDate: '2026-11-14',
    totalPax: 2,
    adultsCount: 2,
    childrenCount: 0,
    infantsCount: 0,
    inclusions: [],
    exclusions: [],
    routeHubs: [
      { id: 'hub-tyo-1', hubId: 'hub-tokyo', hubName: 'Tokyo', nights: 4, order: 1 } as any
    ],
    items: [v1Item],
    createdAt: now,
    updatedAt: now
  };

  const hashV1 = computeQuotationCommercialContentHash(quoteV1);
  const modelV1 = buildQuotePresentationModel(quoteV1);
  assert(modelV1.visaServices.length === 1, 'Presentation model contains Visa service line');
  assert(
    modelV1.visaServices[0].inclusions[0].includes('Consular Filing & Portal Submission') &&
      modelV1.visaServices[0].inclusions[1].includes('Digital eVisa Grant Delivery'),
    'Presentation model preserves exact v1 Inclusion order & content'
  );
  assert(
    modelV1.visaServices[0].exclusions[0].includes('Expedited Walk-In Consulate Fee'),
    'Presentation model preserves exact v1 Exclusion content'
  );
  assert(
    !modelV1.visaServices[0].inclusions.some(i => i.includes('Hidden Internal Courier Pilot')),
    'Inactive Admin entries never appear in v1 presentation model'
  );

  // Verify PDF, Email, Plain Text, WhatsApp all render exact v1 inclusions & exclusions
  const pdfPagesV1 = paginateQuotePresentationModel(modelV1);
  const pdfJoinedHtmlV1 = pdfPagesV1.flatMap(p => p.blocks.map(b => b.html)).join('\n');
  const emailHtmlV1 = renderProposalViewHtmlEmail(modelV1);
  const plainTextV1 = renderQuoteEmailFromPresentationModel(modelV1).textBody;
  const whatsappV1 = renderQuoteWhatsAppFromPresentationModel(modelV1);

  for (const [label, output] of [
    ['PDF', pdfJoinedHtmlV1],
    ['Email', emailHtmlV1],
    ['PlainText', plainTextV1],
    ['WhatsApp', whatsappV1]
  ] as const) {
    assert(output.includes('Consular Filing &amp; Portal Submission') || output.includes('Consular Filing & Portal Submission'), `${label} v1 includes active Inclusion #1`);
    assert(output.includes('Digital eVisa Grant Delivery'), `${label} v1 includes active Inclusion #2`);
    assert(output.includes('Expedited Walk-In Consulate Fee'), `${label} v1 includes active Exclusion #1`);
    assert(!output.includes('Hidden Internal Courier Pilot'), `${label} v1 excludes inactive entry`);
  }

  // ---------------------------------------------------------------------------
  // 4. MASTER VISA UPDATE -> v1 IMMUTABILITY VS v2 UPDATES
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. Historical v1 Immutability & New Quote / v2 Propagation ---');
  const updatedMasterVisa: VisaProduct = {
    ...savedTourist,
    inclusions: [
      {
        id: 'INC-JP-T-NEW',
        title: 'Biometric Appointment VIP Lounge Pass',
        description: 'Added in master v2 config.',
        displayOrder: 1,
        isActive: true,
        updatedAt: new Date().toISOString()
      }
    ],
    exclusions: [
      {
        id: 'EXC-JP-T-NEW',
        title: 'Third-Party Translation Notarization',
        displayOrder: 1,
        isActive: true,
        updatedAt: new Date().toISOString()
      }
    ],
    inclusionsExclusionsVersion: 2,
    updatedAt: new Date().toISOString()
  };
  await db.saveVisaAsync(updatedMasterVisa, adminUser);

  // Re-evaluate v1 after master edit: MUST stay 100% immutable!
  const resolvedV1InclusionsAfterEdit = resolveQuoteItemInclusions(quoteV1.items[0]);
  const resolvedV1ExclusionsAfterEdit = resolveQuoteItemExclusions(quoteV1.items[0]);
  assert(
    resolvedV1InclusionsAfterEdit.length === 2 &&
      resolvedV1InclusionsAfterEdit[0].includes('Consular Filing & Portal Submission') &&
      !resolvedV1InclusionsAfterEdit.some(s => s.includes('Biometric Appointment VIP Lounge Pass')),
    'Saved v1 quotation retains original inclusions despite master Visa CMS update'
  );
  assert(
    resolvedV1ExclusionsAfterEdit.length === 1 &&
      resolvedV1ExclusionsAfterEdit[0].includes('Expedited Walk-In Consulate Fee'),
    'Saved v1 quotation retains original exclusions despite master Visa CMS update'
  );

  // Build v2 using updated master Visa
  const latestMasterTourist = db.getVisaById('visa-audit-jp-tourist')!;
  const v2VisaSnapshot = createQuoteVisaSnapshot(latestMasterTourist, {
    applicantNationality: 'Indian',
    applicantProfile: 'EMPLOYED'
  });
  const v2Product = buildVisaProductFromMaster(latestMasterTourist);
  const v2Item: QuoteItem = {
    ...v1Item,
    product: v2Product,
    visaSnapshot: v2VisaSnapshot
  };
  v2Item.contentSnapshot = createQuoteItemContentSnapshot(v2Product, v2Item);

  const quoteV2: Quotation = {
    ...quoteV1,
    version: 2,
    snapshotVersion: 2,
    items: [v2Item]
  };
  const hashV2 = computeQuotationCommercialContentHash(quoteV2);
  assert(hashV2 !== hashV1, 'Commercial content hash changes cleanly when Visa inclusions/exclusions change in v2');

  const modelV2 = buildQuotePresentationModel(quoteV2);
  assert(
    modelV2.visaServices[0].inclusions.length === 1 &&
      modelV2.visaServices[0].inclusions[0].includes('Biometric Appointment VIP Lounge Pass'),
    'v2 quotation reflects updated Admin-configured inclusions'
  );
  assert(
    modelV2.visaServices[0].exclusions.length === 1 &&
      modelV2.visaServices[0].exclusions[0].includes('Third-Party Translation Notarization'),
    'v2 quotation reflects updated Admin-configured exclusions'
  );

  // ---------------------------------------------------------------------------
  // 5. BOOKING CONVERSION PERSISTENCE & AUDIT TRAIL
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. Booking Conversion & Audit Trail ---');
  db.saveQuote(quoteV1, agentUser, 'SAVED');
  const booking = db.convertQuotationToBooking(quoteV1, agentUser);
  assert(Boolean(booking && booking.items.length === 1), 'Booking created with Visa item');
  assert(
    Array.isArray(booking.items[0].inclusions) &&
      booking.items[0].inclusions.some(i => i.includes('Consular Filing & Portal Submission')),
    'BookingItem preserves snapshotted v1 Visa inclusions'
  );
  assert(
    Array.isArray(booking.items[0].exclusions) &&
      booking.items[0].exclusions.some(e => e.includes('Expedited Walk-In Consulate Fee')),
    'BookingItem preserves snapshotted v1 Visa exclusions'
  );
  assert(
    Boolean(booking.items[0].visaSnapshot?.visaId === savedTourist.id),
    'BookingItem preserves full visaSnapshot record'
  );

  const auditLogs = db.getAuditLogs();
  assert(
    auditLogs.some(l => l.entityId === 'visa-audit-jp-tourist' && l.entity === 'VisaProduct'),
    'Admin Visa CMS mutations are recorded in audit ledger'
  );

  console.log('\n🎉 ALL VISA INCLUSIONS & EXCLUSIONS AUDIT CHECKS PASSED SUCCESSFULLY!');
}

runAudit().catch((err) => {
  console.error('\n❌ VISA INCLUSIONS & EXCLUSIONS AUDIT FAILED:', err);
  process.exit(1);
});
