/**
 * Automated End-to-End Verification Audit:
 * Lead Stage / Status Rename — "Qualified" -> "Customisation Required"
 *
 * Verifies all 10 mandatory requirements:
 * 1. Qualified replaced with Customisation Required across Admin CMS & B2B Portal.
 * 2. Existing QUALIFIED (and legacy Qualified / CUSTOMISATION_REQUIRED) leads display as Customisation Required.
 * 3. Admin filtering & search by Customisation Required works.
 * 4. B2B Agents see Customisation Required per authorization permissions.
 * 5. Lead creation & editing work cleanly with Customisation Required.
 * 6. Kanban & pipeline views display Customisation Required without adding extra stages.
 * 7. Status changes persist after refresh and log Customisation Required in timeline & audit logs.
 * 8. Dashboard analytics & reports use the new count/label consistently.
 * 9. Existing lead IDs, agency ownership, team assignments, quotation links, notes & history remain intact.
 * 10. Unrelated lead statuses and workflows are unaffected with zero duplicate statuses.
 */

import fs from 'fs';
import path from 'path';
import {
  LEAD_STATUS_LABELS,
  LEAD_STATUS_OPTIONS,
  DEFAULT_LEAD_STAGES,
  normalizeLeadStatus,
  getLeadStatusLabel,
  formatLeadStageDisplayName,
  replaceLegacyQualifiedStatusText
} from '../services/crmOperationsEngine';
import { AppDatabase, safeStorage } from '../services/db';
import { DashboardMetricsService } from '../services/dashboardMetricsService';
import type { TravelLead, User } from '../types';

// Minimal in-memory localStorage polyfill for Node execution
const memoryStore = new Map<string, string>();
if (typeof (globalThis as any).localStorage === 'undefined') {
  (globalThis as any).localStorage = {
    getItem: (key: string) => (memoryStore.has(key) ? memoryStore.get(key)! : null),
    setItem: (key: string, value: string) => {
      memoryStore.set(key, String(value));
    },
    removeItem: (key: string) => {
      memoryStore.delete(key);
    },
    clear: () => {
      memoryStore.clear();
    },
    key: (index: number) => Array.from(memoryStore.keys())[index] ?? null,
    get length() {
      return memoryStore.size;
    }
  };
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function runAudit() {
  console.log('\n=== Lead Status Rename Audit ("Qualified" -> "Customisation Required") ===\n');

  // 1. Canonical Label & Option Integrity (No duplicates, no extra stages)
  console.log('[1] Checking canonical label mapping, dropdown options, and zero duplicates');
  assert(
    LEAD_STATUS_LABELS.QUALIFIED === 'Customisation Required',
    'LEAD_STATUS_LABELS.QUALIFIED === "Customisation Required"'
  );
  assert(
    getLeadStatusLabel('QUALIFIED') === 'Customisation Required',
    'getLeadStatusLabel("QUALIFIED") returns "Customisation Required"'
  );
  assert(
    getLeadStatusLabel('Qualified') === 'Customisation Required',
    'getLeadStatusLabel("Qualified") returns "Customisation Required"'
  );
  assert(
    getLeadStatusLabel('CUSTOMISATION_REQUIRED') === 'Customisation Required',
    'getLeadStatusLabel("CUSTOMISATION_REQUIRED") returns "Customisation Required"'
  );
  assert(
    getLeadStatusLabel('Customisation Required') === 'Customisation Required',
    'getLeadStatusLabel("Customisation Required") returns "Customisation Required"'
  );

  const optionValues = LEAD_STATUS_OPTIONS.map(o => o.value);
  const optionLabels = LEAD_STATUS_OPTIONS.map(o => o.label);
  assert(
    new Set(optionValues).size === optionValues.length,
    'LEAD_STATUS_OPTIONS contains no duplicate canonical values'
  );
  assert(
    optionLabels.filter(l => l === 'Customisation Required').length === 1,
    'LEAD_STATUS_OPTIONS contains exactly one "Customisation Required" option'
  );
  assert(
    !optionLabels.some(l => /\bqualified\b/i.test(l)),
    'LEAD_STATUS_OPTIONS contains zero occurrences of "Qualified"'
  );
  assert(
    LEAD_STATUS_OPTIONS.length === 9,
    'LEAD_STATUS_OPTIONS preserves exact 9 standard selectable statuses (no extra stages added)'
  );

  // 2. Unrelated statuses unchanged
  console.log('\n[2] Checking unrelated lead statuses remain unchanged');
  const unchangedChecks: Array<[string, string]> = [
    ['NEW', 'New'],
    ['CONTACTED', 'Contacted'],
    ['PROPOSAL_SAVED', 'Proposal Saved'],
    ['QUOTE_DOWNLOADED', 'Quote Downloaded'],
    ['QUOTED', 'Quoted'],
    ['BOOKING_SUBMITTED', 'Booking Submitted'],
    ['WON', 'Won (Converted)'],
    ['LOST', 'Lost']
  ];
  for (const [code, expectedLabel] of unchangedChecks) {
    assert(
      normalizeLeadStatus(code) === code && getLeadStatusLabel(code) === expectedLabel,
      `Unrelated status ${code} preserved as "${expectedLabel}"`
    );
  }

  // 3. Static source check across Admin CMS & B2B Agent Portal UI components
  console.log('\n[3] Verifying zero stale "Qualified" UI labels in Admin CMS & B2B Agent Portal');
  const uiFiles = [
    'src/components/AdminCMS/LeadManager.tsx',
    'src/components/AdminCMS/LeadDetailDrawer.tsx',
    'src/components/AdminCMS/LeadEditModal.tsx',
    'src/components/AdminCMS/LeadKanbanBoard.tsx',
    'src/components/AdminCMS/MyAssignedAgentsView.tsx',
    'src/components/AdminCMS/QuoteMasterManager.tsx',
    'src/components/B2BAgentPortal/B2BMyLeadsAndClientsCRMView.tsx',
    'src/components/B2BAgentPortal/B2BLeadsManagerView.tsx'
  ];
  for (const relPath of uiFiles) {
    const absPath = path.resolve(process.cwd(), relPath);
    const content = fs.readFileSync(absPath, 'utf-8');
    const hasStaleOption = />Qualified</i.test(content) || /'Qualified\b/.test(content) || /"Qualified\b/.test(content);
    const hasRawReplaceStatus = /lead\.status\s*\?\s*lead\.status\.replace|\(lead\.status\s*\|\|\s*'NEW'\)\.replace/.test(content);
    assert(!hasStaleOption, `${relPath} has no hardcoded "Qualified" label`);
    assert(!hasRawReplaceStatus, `${relPath} does not render raw lead.status.replace(/_/g, ' ')`);
  }

  // 4. Database backward compatibility, persistence, linked records & permissions
  console.log('\n[4] Verifying DB persistence, existing QUALIFIED records, linked quotes, and B2B Agent visibility');
  const db = AppDatabase.getInstance();

  const adminUser: User = {
    id: 'usr-admin-audit',
    name: 'Audit Super Admin',
    email: 'business@theunbound.in',
    role: 'ADMIN',
    approvalStatus: 'APPROVED'
  } as User;

  const agentUser: User = {
    id: 'usr-agent-audit-1',
    name: 'Sakura Agency Partner',
    email: 'partner@sakura-travel.test',
    role: 'B2B_AGENT',
    agencyName: 'Sakura Luxury Journeys',
    approvalStatus: 'APPROVED'
  } as User;

  const otherAgentUser: User = {
    id: 'usr-agent-audit-2',
    name: 'Other Partner',
    email: 'other@agency.test',
    role: 'B2B_AGENT',
    agencyName: 'Other Voyages',
    approvalStatus: 'APPROVED'
  } as User;

  const nowIso = new Date().toISOString();

  // Seed existing leads directly into storage (simulating pre-existing Firestore/cached leads)
  const preExistingLeads: TravelLead[] = [
    {
      id: 'lead-existing-qual-1',
      leadNumber: 'LED-2026-9001',
      contactName: 'Kenji Takahashi',
      email: 'kenji@client.test',
      phone: '+81-90-0000-0001',
      agencyName: 'Sakura Luxury Journeys',
      userType: 'B2B_AGENT',
      source: 'B2B_PARTNER',
      status: 'QUALIFIED',
      stageId: 'REQUIREMENTS_COLLECTED',
      stageName: 'Qualified',
      priority: 'HIGH',
      responsibleAgentId: agentUser.id,
      responsibleAgentNameSnapshot: agentUser.name,
      assignedAgentId: agentUser.id,
      assignedTeamMemberId: 'staff-1',
      assignedTeamMemberNameSnapshot: 'Operations Lead',
      leadVisibilityStatus: 'ASSIGNED',
      destinationId: 'japan',
      destinationName: 'Japan',
      travelDates: '2026-11-10 to 2026-11-20',
      paxAdults: 4,
      paxChildren: 0,
      estimatedBudget: 18000,
      currency: 'USD',
      quoteId: 'qt-linked-9001',
      quoteNumber: 'QT-2026-9001',
      quoteIds: ['qt-linked-9001'],
      travelRequirements: 'Private Kyoto ryokan + Shinkansen Green Car',
      notes: [
        {
          id: 'note-public-1',
          authorName: 'Partner',
          text: 'Client requested bespoke autumn foliage tour',
          timestamp: nowIso,
          isInternal: false
        },
        {
          id: 'note-internal-1',
          authorName: 'Ops',
          text: 'Internal margin note',
          timestamp: nowIso,
          isInternal: true
        }
      ],
      timeline: [
        {
          id: 'tl-legacy-1',
          type: 'STATUS_CHANGED',
          title: 'Status Changed to QUALIFIED',
          description: 'Status transitioned from NEW to QUALIFIED',
          timestamp: nowIso,
          performedBy: 'Legacy Admin'
        }
      ],
      followUps: [],
      requestedProducts: [],
      createdAt: nowIso,
      updatedAt: nowIso
    } as TravelLead,
    {
      id: 'lead-legacy-label-2',
      leadNumber: 'LED-2026-9002',
      contactName: 'Elena Rostova',
      email: 'elena@client.test',
      phone: '+44-20-0000-0002',
      source: 'WEBSITE',
      status: 'Qualified' as any, // Legacy string variant
      priority: 'NORMAL',
      destinationId: 'japan',
      destinationName: 'Japan',
      travelDates: '2026-12-01 to 2026-12-10',
      paxAdults: 2,
      paxChildren: 0,
      estimatedBudget: 9500,
      currency: 'USD',
      travelRequirements: 'Tokyo & Hakone honeymoon',
      notes: [],
      timeline: [],
      followUps: [],
      requestedProducts: [],
      createdAt: nowIso,
      updatedAt: nowIso
    } as TravelLead
  ];

  // Seed pre-existing leads into safeStorage and clear memoryCache to simulate fresh load from storage
  safeStorage.setItem('theunbound_db_leads', JSON.stringify(preExistingLeads));
  (db as any).memoryCache.delete('leads');

  const loadedLeads = db.getLeads();
  const existingLead1 = loadedLeads.find(l => l.id === 'lead-existing-qual-1');
  const legacyLead2 = loadedLeads.find(l => l.id === 'lead-legacy-label-2');

  assert(
    existingLead1?.status === 'QUALIFIED' && getLeadStatusLabel(existingLead1?.status) === 'Customisation Required',
    'Existing QUALIFIED lead retains canonical identifier and displays as "Customisation Required"'
  );
  assert(
    existingLead1?.stageName === 'Customisation Required',
    'Existing lead stageName "Qualified" automatically sanitized to "Customisation Required" on read'
  );
  assert(
    legacyLead2?.status === 'QUALIFIED' && getLeadStatusLabel(legacyLead2?.status) === 'Customisation Required',
    'Legacy "Qualified" lead normalizes cleanly to canonical QUALIFIED -> "Customisation Required"'
  );
  assert(
    replaceLegacyQualifiedStatusText(existingLead1?.timeline?.[0]?.title) === 'Status Changed to Customisation Required',
    'Historical timeline title with legacy QUALIFIED renders as "Status Changed to Customisation Required"'
  );

  // Admin filter & search simulation
  const filteredByStatus = loadedLeads.filter(l => normalizeLeadStatus(l.status) === normalizeLeadStatus('QUALIFIED'));
  const filteredByLegacyFilter = loadedLeads.filter(l => normalizeLeadStatus(l.status) === normalizeLeadStatus('Qualified'));
  const filteredByNewLabelSearch = loadedLeads.filter(l =>
    getLeadStatusLabel(l.status).toLowerCase().includes('customisation required')
  );
  assert(filteredByStatus.length === 2, 'Admin filter by QUALIFIED (Customisation Required) matches both leads');
  assert(filteredByLegacyFilter.length === 2, 'Backward-compatible saved filter "Qualified" still matches both leads');
  assert(filteredByNewLabelSearch.length === 2, 'Search for "customisation required" matches both leads');

  // B2B Agent permissions check
  const agentLeads = db.getLeadsAuthorized(agentUser);
  const otherAgentLeads = db.getLeadsAuthorized(otherAgentUser);
  assert(
    agentLeads.length === 1 && agentLeads[0].id === 'lead-existing-qual-1',
    'Authorized B2B Agent sees only their assigned lead'
  );
  assert(
    getLeadStatusLabel(agentLeads[0].status) === 'Customisation Required',
    'Authorized B2B Agent sees lead status as "Customisation Required"'
  );
  assert(
    (agentLeads[0].notes || []).every(n => !n.isInternal),
    'Internal notes remain stripped for B2B Agent visibility'
  );
  assert(
    otherAgentLeads.length === 0,
    'Unrelated B2B Agent cannot see another agency lead'
  );

  // 5. Creating & editing a lead with Customisation Required
  console.log('\n[5] Verifying Lead creation, editing, status updates & persistence');
  const createdLead = db.saveLead(
    {
      id: 'lead-created-3',
      leadNumber: 'LED-2026-9003',
      contactName: 'Marcus Vance',
      email: 'marcus@client.test',
      phone: '+1-415-000-0003',
      source: 'WEBSITE',
      status: 'QUALIFIED',
      priority: 'NORMAL',
      destinationId: 'japan',
      destinationName: 'Japan',
      travelDates: '2027-04-01 to 2027-04-12',
      paxAdults: 2,
      paxChildren: 0,
      estimatedBudget: 14000,
      currency: 'USD',
      travelRequirements: 'Cherry blossom luxury tour',
      notes: [],
      timeline: [],
      followUps: [],
      requestedProducts: [],
      createdAt: nowIso,
      updatedAt: nowIso
    } as TravelLead,
    adminUser
  );
  assert(
    createdLead.status === 'QUALIFIED' && getLeadStatusLabel(createdLead.status) === 'Customisation Required',
    'Newly created lead with Customisation Required persists canonical QUALIFIED status'
  );

  // Transition existing lead NEW -> QUALIFIED (Customisation Required) via updateLeadStatus
  db.updateLeadStatus('lead-existing-qual-1', 'CONTACTED', adminUser);
  const transitioned = db.updateLeadStatus('lead-existing-qual-1', 'QUALIFIED', adminUser, 'Needs custom ryokan itinerary');
  assert(transitioned !== null && transitioned.status === 'QUALIFIED', 'updateLeadStatus transitions lead to QUALIFIED');
  assert(
    transitioned?.lastActivitySummary === 'Status updated to Customisation Required',
    'lastActivitySummary logs "Customisation Required" (not QUALIFIED)'
  );
  assert(
    transitioned?.timeline?.[0]?.title === 'Status Changed to Customisation Required' &&
      transitioned?.timeline?.[0]?.description?.includes('Customisation Required') === true,
    'New timeline event logs "Customisation Required" without raw QUALIFIED'
  );
  assert(
    transitioned?.quoteId === 'qt-linked-9001' &&
      transitioned?.quoteNumber === 'QT-2026-9001' &&
      transitioned?.responsibleAgentId === agentUser.id &&
      transitioned?.assignedTeamMemberId === 'staff-1',
    'Existing lead ID, agency ownership, team assignment, and quotation links remain intact after transition'
  );

  // Simulate reload by round-tripping serialized leads payload (matching Firestore rehydration on refresh)
  const serializedSnapshot = JSON.parse(JSON.stringify(db.getLeads()));
  safeStorage.setItem('theunbound_db_leads', JSON.stringify(serializedSnapshot));
  (db as any).memoryCache.delete('leads');
  const persistedAfterReload = db.getLeadById('lead-existing-qual-1');
  assert(
    persistedAfterReload?.status === 'QUALIFIED' &&
      getLeadStatusLabel(persistedAfterReload?.status) === 'Customisation Required' &&
      persistedAfterReload?.lastActivitySummary === 'Status updated to Customisation Required',
    'Status change persists cleanly after reload'
  );

  // 6. Kanban & Pipeline Stages
  console.log('\n[6] Verifying Kanban & pipeline stage labels and transitions');
  assert(
    DEFAULT_LEAD_STAGES.length === 11,
    'DEFAULT_LEAD_STAGES count unchanged (11 stages, no extra stages added)'
  );
  const reqStage = DEFAULT_LEAD_STAGES.find(s => s.id === 'REQUIREMENTS_COLLECTED');
  assert(
    reqStage?.name === 'Customisation Required' && reqStage?.defaultLeadStatus === 'QUALIFIED',
    'DEFAULT_LEAD_STAGES REQUIREMENTS_COLLECTED displays "Customisation Required" with defaultLeadStatus QUALIFIED'
  );
  assert(
    formatLeadStageDisplayName('Qualified') === 'Customisation Required' &&
      formatLeadStageDisplayName('Qualified & In Progress') === 'Customisation Required',
    'formatLeadStageDisplayName sanitizes legacy stage names'
  );

  // Simulate legacy cached lead_stages in storage
  safeStorage.setItem(
    'theunbound_db_lead_stages',
    JSON.stringify([
      {
        ...reqStage!,
        name: 'Qualified'
      }
    ])
  );
  (db as any).memoryCache.delete('lead_stages');
  const sanitizedStages = db.getLeadStages();
  assert(
    sanitizedStages[0]?.name === 'Customisation Required',
    'db.getLeadStages() safely migrates legacy cached "Qualified" stage name to "Customisation Required"'
  );
  safeStorage.removeItem('theunbound_db_lead_stages');
  (db as any).memoryCache.delete('lead_stages');

  const stageMoveResult = db.updateLeadStage('lead-created-3', 'REQUIREMENTS_COLLECTED', adminUser);
  assert(
    stageMoveResult?.lead.stageName === 'Customisation Required' &&
      stageMoveResult?.lead.status === 'QUALIFIED',
    'Moving a lead on Kanban to REQUIREMENTS_COLLECTED sets stageName "Customisation Required" and status QUALIFIED'
  );

  // 7. Analytics & Dashboard Metrics
  console.log('\n[7] Verifying Dashboard Metrics & Analytics counts');
  const metricsService = DashboardMetricsService.getInstance();
  const comparison = metricsService.getDateInterval('THIS_MONTH');
  const keyMetrics = metricsService.calculateKeyMetrics({
    bookings: [],
    leads: db.getLeads(),
    quotes: [],
    users: [adminUser, agentUser],
    suppliers: [],
    currentUser: adminUser,
    comparison,
    baseCurrency: 'USD'
  });
  assert(
    keyMetrics.totalLeads.customisationRequiredCount === 3,
    `Dashboard metrics customisationRequiredCount === 3 (got ${keyMetrics.totalLeads.customisationRequiredCount})`
  );
  assert(
    keyMetrics.totalLeads.qualifiedCount === 3,
    `Backward-compatible qualifiedCount alias matches customisationRequiredCount (${keyMetrics.totalLeads.qualifiedCount})`
  );

  console.log(`\n=== Audit Complete: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runAudit().catch(err => {
  console.error('Audit crashed:', err);
  process.exit(1);
});
