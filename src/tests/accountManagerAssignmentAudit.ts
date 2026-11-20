/**
 * THEUNBOUND — USER-LEVEL ACCOUNT MANAGER ASSIGNMENT AUDIT SUITE
 * Verifies strict user-level binding, agency separation, eligible pool enforcement,
 * Team Member isolation, mandatory B2B Agent assignment, immutable history,
 * historical record preservation, and RBAC + Firestore security rules.
 */

import fs from 'node:fs';
import path from 'node:path';
import { AppDatabase } from '../services/db';
import {
  assignAccountManagerToUser,
  getAccountManagerWorkloadSummary,
  getAssignedAgentsForTeamMember,
  getAssignmentHistoryForAgent,
  getEligibleAccountManagers,
  getTeamMemberAssignedWorkspaceSummary,
  getUnassignedB2BAgents,
  resolveUserAccountManager
} from '../services/accountManagerService';
import {
  canUserAccessCMSModule,
  canUserAccessCMSSubTab,
  canUserAssignAccountManagers,
  getDefaultPermissionsForRole
} from '../services/permissionEngine';
import { Booking, Quotation, TravelLead, User } from '../types';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, details?: unknown) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${testName}`, details ?? '');
  }
}

function assertThrows(fn: () => unknown, testName: string) {
  totalTests++;
  try {
    fn();
    failedTests++;
    console.error(`  [FAIL] ${testName} (expected throw, but succeeded)`);
  } catch (err: any) {
    passedTests++;
    console.log(`  [PASS] ${testName} -> blocked cleanly: ${err?.message || err}`);
  }
}

function runAudit() {
  console.log('\n====================================================================');
  console.log('THEUNBOUND — USER-LEVEL ACCOUNT MANAGER ASSIGNMENT AUDIT');
  console.log('====================================================================\n');

  const db = AppDatabase.getInstance();
  const suffix = `${Date.now()}`;

  // Seed Master Admin actor
  const adminActor: User = {
    id: `usr-audit-admin-${suffix}`,
    name: 'Master Admin Audit',
    email: `admin.audit.${suffix}@theunbound.in`,
    role: 'ADMIN',
    approvalStatus: 'APPROVED',
    createdAt: '2026-01-01',
    permissions: getDefaultPermissionsForRole('ADMIN')
  };
  db.saveUser(adminActor, adminActor, 'USER_ROLE_CHANGED', 'Audit admin seed', true);

  // Seed Eligible Internal Team Members
  const tmRiya: User = {
    id: `usr-tm-riya-${suffix}`,
    name: 'Riya Sharma',
    email: `riya.${suffix}@theunbound.in`,
    role: 'TEAM_MEMBER',
    jobTitle: 'Senior Japan Specialist',
    phone: '+91-9811111111',
    approvalStatus: 'APPROVED',
    createdAt: '2026-01-01',
    permissions: getDefaultPermissionsForRole('TEAM_MEMBER')
  };
  const tmArjun: User = {
    id: `usr-tm-arjun-${suffix}`,
    name: 'Arjun Mehta',
    email: `arjun.${suffix}@theunbound.in`,
    role: 'TEAM_MEMBER',
    jobTitle: 'B2B Partner Manager',
    phone: '+91-9822222222',
    approvalStatus: 'APPROVED',
    createdAt: '2026-01-01',
    permissions: getDefaultPermissionsForRole('TEAM_MEMBER')
  };
  const tmNeha: User = {
    id: `usr-tm-neha-${suffix}`,
    name: 'Neha Verma',
    email: `neha.${suffix}@theunbound.in`,
    role: 'DMC_STAFF',
    jobTitle: 'Account Coordinator',
    approvalStatus: 'APPROVED',
    createdAt: '2026-01-01',
    permissions: getDefaultPermissionsForRole('DMC_STAFF')
  };
  // Ineligible Team Members (Pending / Deactivated / Rejected)
  const tmPending: User = {
    id: `usr-tm-pending-${suffix}`,
    name: 'Pending Staff',
    email: `pending.staff.${suffix}@theunbound.in`,
    role: 'TEAM_MEMBER',
    approvalStatus: 'PENDING',
    createdAt: '2026-01-01'
  };
  const tmDeactivated: User = {
    id: `usr-tm-deactivated-${suffix}`,
    name: 'Deactivated Staff',
    email: `deactivated.staff.${suffix}@theunbound.in`,
    role: 'TEAM_MEMBER',
    approvalStatus: 'APPROVED',
    createdAt: '2026-01-01',
    isDeactivated: true
  };

  [tmRiya, tmArjun, tmNeha, tmPending, tmDeactivated].forEach(u =>
    db.saveUser(u, adminActor, 'USER_ROLE_CHANGED', `Seed ${u.name}`, true)
  );

  // Seed 4 B2B Agents under the EXACT SAME AGENCY ("ABC Travels") + 1 pending self-registered agent
  const sharedCompanyId = `comp-abc-travels-${suffix}`;
  const customAgentPermissions = {
    ...getDefaultPermissionsForRole('B2B_AGENT'),
    canExportPDF: false,
    canShareWhatsAppQuotes: true
  };

  const agent1: User = {
    id: `usr-abc-1-${suffix}`,
    name: 'Vikram Kapoor',
    email: `vikram.${suffix}@abctravels.com`,
    role: 'B2B_AGENT',
    category: 'EXTERNAL',
    companyId: sharedCompanyId,
    agencyName: 'ABC Travels',
    companyName: 'ABC Travels',
    approvalStatus: 'APPROVED',
    createdAt: '2026-01-01',
    permissions: customAgentPermissions,
    pricingSettings: {
      productLevelMarginEnabled: false,
      activeMarginMode: 'AGENT_LEVEL',
      agentLevelMarginPercent: 18
    },
    accountManagerAssignmentStatus: 'UNASSIGNED'
  };
  const agent2: User = {
    id: `usr-abc-2-${suffix}`,
    name: 'Ananya Rao',
    email: `ananya.${suffix}@abctravels.com`,
    role: 'B2B_AGENT',
    category: 'EXTERNAL',
    companyId: sharedCompanyId,
    agencyName: 'ABC Travels',
    companyName: 'ABC Travels',
    approvalStatus: 'APPROVED',
    createdAt: '2026-01-01',
    permissions: getDefaultPermissionsForRole('B2B_AGENT'),
    accountManagerAssignmentStatus: 'UNASSIGNED'
  };
  const agent3: User = {
    id: `usr-abc-3-${suffix}`,
    name: 'Siddharth Jain',
    email: `siddharth.${suffix}@abctravels.com`,
    role: 'B2B_AGENT',
    category: 'EXTERNAL',
    companyId: sharedCompanyId,
    agencyName: 'ABC Travels',
    companyName: 'ABC Travels',
    approvalStatus: 'APPROVED',
    createdAt: '2026-01-01',
    permissions: getDefaultPermissionsForRole('B2B_AGENT'),
    accountManagerAssignmentStatus: 'UNASSIGNED'
  };
  const agent4Unassigned: User = {
    id: `usr-abc-4-${suffix}`,
    name: 'Kabir Nair',
    email: `kabir.${suffix}@abctravels.com`,
    role: 'B2B_AGENT',
    category: 'EXTERNAL',
    companyId: sharedCompanyId,
    agencyName: 'ABC Travels',
    companyName: 'ABC Travels',
    approvalStatus: 'APPROVED',
    createdAt: '2026-01-01',
    permissions: getDefaultPermissionsForRole('B2B_AGENT'),
    accountManagerAssignmentStatus: 'UNASSIGNED'
  };
  const agentPending: User = {
    id: `usr-abc-pending-${suffix}`,
    name: 'Meera Krishnan',
    email: `meera.${suffix}@abctravels.com`,
    role: 'B2B_AGENT',
    category: 'EXTERNAL',
    companyId: sharedCompanyId,
    agencyName: 'ABC Travels',
    companyName: 'ABC Travels',
    approvalStatus: 'PENDING',
    createdAt: '2026-01-01',
    accountManagerAssignmentStatus: 'UNASSIGNED'
  };

  [agent1, agent2, agent3, agent4Unassigned, agentPending].forEach(u =>
    db.saveUser(u, adminActor, 'USER_ROLE_CHANGED', `Seed ${u.name}`, true)
  );

  // ------------------------------------------------------------------
  console.log('1. Eligible Account Manager Pool Verification');
  // ------------------------------------------------------------------
  const eligible = getEligibleAccountManagers();
  const eligibleIds = new Set(eligible.map(u => u.id));
  assert(eligibleIds.has(tmRiya.id) && eligibleIds.has(tmArjun.id) && eligibleIds.has(tmNeha.id), 'Active internal Team Members appear in eligible pool');
  assert(!eligibleIds.has(agent1.id) && !eligibleIds.has(agent2.id), 'B2B Agents NEVER appear in eligible Account Manager pool');
  assert(!eligibleIds.has(tmPending.id) && !eligibleIds.has(tmDeactivated.id), 'Pending and deactivated staff are excluded from eligible pool');

  // ------------------------------------------------------------------
  console.log('\n2. User-Level Assignment & Agency Separation (ABC Travels)');
  // ------------------------------------------------------------------
  const res1 = assignAccountManagerToUser({
    agentUserId: agent1.id,
    accountManagerUid: tmRiya.id,
    actor: adminActor,
    reason: 'Initial portfolio allocation'
  });
  assert(res1.changed && res1.updatedUser.accountManagerUid === tmRiya.id, 'Agent 1 assigned to Riya Sharma');
  assert(res1.updatedUser.accountManagerAssignmentStatus === 'ASSIGNED', 'Agent 1 status set to ASSIGNED');
  assert(res1.updatedUser.permissions?.canExportPDF === false && res1.updatedUser.pricingSettings?.agentLevelMarginPercent === 18, 'Assigning Account Manager preserves existing B2B Agent permissions & margin settings');
  assert(res1.updatedUser.approvalStatus === 'APPROVED', 'Assigning existing approved agent preserves APPROVED status');

  // Verify NO cascade to sibling agents in "ABC Travels"
  const afterAssign1Users = db.getUsers();
  assert(afterAssign1Users.find(u => u.id === agent2.id)?.accountManagerUid === undefined, 'Agent 2 in same agency remains untouched (no agency cascade)');
  assert(afterAssign1Users.find(u => u.id === agent3.id)?.accountManagerUid === undefined, 'Agent 3 in same agency remains untouched');
  assert(afterAssign1Users.find(u => u.id === agent4Unassigned.id)?.accountManagerUid === undefined, 'Agent 4 in same agency remains untouched');

  // Assign Agent 2 -> Arjun Mehta, Agent 3 -> Neha Verma, and leave Agent 4 -> Unassigned
  assignAccountManagerToUser({ agentUserId: agent2.id, accountManagerUid: tmArjun.id, actor: adminActor });
  assignAccountManagerToUser({ agentUserId: agent3.id, accountManagerUid: tmNeha.id, actor: adminActor });

  const resolved1 = resolveUserAccountManager(agent1.id);
  const resolved2 = resolveUserAccountManager(agent2.id);
  const resolved3 = resolveUserAccountManager(agent3.id);
  const resolved4 = resolveUserAccountManager(agent4Unassigned.id);

  assert(resolved1.uid === tmRiya.id && resolved2.uid === tmArjun.id && resolved3.uid === tmNeha.id, 'Three users in same agency hold 3 distinct Account Managers simultaneously');
  assert(!resolved4.isAssigned && resolved4.status === 'UNASSIGNED', 'Agent 4 in same agency remains UNASSIGNED with no agency-level fallback');

  // ------------------------------------------------------------------
  console.log('\n3. Historical Records Integrity & Immutable History on Reassignment');
  // ------------------------------------------------------------------
  const sampleLead = {
    id: `lead-am-audit-${suffix}`,
    leadNumber: `LD-AM-${suffix.slice(-5)}`,
    customerName: 'Taro Tanaka Family',
    customerEmail: 'taro@example.jp',
    email: 'taro@example.jp',
    destination: 'Japan',
    createdAt: '2026-09-01T10:00:00Z',
    updatedAt: '2026-09-01T10:00:00Z',
    status: 'NEW',
    priority: 'HIGH',
    source: 'B2B_PORTAL',
    userId: agent1.id,
    userType: 'B2B_AGENT',
    agencyName: 'ABC Travels',
    responsibleAgentId: agent1.id,
    responsibleAgentNameSnapshot: agent1.name,
    assignedTeamMemberId: tmNeha.id, // historical operational assignee
    assignedTeamMemberNameSnapshot: tmNeha.name
  } as unknown as TravelLead;
  db.saveLead(sampleLead, adminActor);

  const sampleQuote: Quotation = {
    id: `qt-am-audit-${suffix}`,
    quoteNumber: `QT-AM-${suffix.slice(-5)}`,
    title: 'Golden Route Luxury Autumn',
    destination: 'Japan',
    clientName: 'Taro Tanaka Family',
    agentId: agent1.id,
    agentName: agent1.name,
    agentAgency: 'ABC Travels',
    createdBy: agent1.id,
    createdByName: agent1.name,
    createdByUserType: 'B2B_AGENT',
    leadId: sampleLead.id,
    status: 'SENT',
    currency: 'USD',
    totalNetCost: 8000,
    totalSellingPrice: 10000,
    totalMargin: 2000,
    items: [],
    createdAt: '2026-09-02T10:00:00Z',
    updatedAt: '2026-09-02T10:00:00Z'
  } as unknown as Quotation;
  db.saveQuote(sampleQuote, adminActor);

  const sampleBooking: Booking = {
    id: `bk-am-audit-${suffix}`,
    bookingReference: `BK-AM-${suffix.slice(-5)}`,
    quoteId: sampleQuote.id,
    leadId: sampleLead.id,
    submittingAgentId: agent1.id,
    agentId: agent1.id,
    agentNameSnapshot: agent1.name,
    agencyName: 'ABC Travels',
    assignedTeamMemberId: tmNeha.id,
    assignedTeamMemberName: tmNeha.name,
    destination: 'Japan',
    status: 'CONFIRMED',
    paymentStatus: 'PARTIAL',
    totalAmount: 10000,
    currency: 'USD',
    customer: { leadTravelerName: 'Taro Tanaka', totalAdults: 2, totalChildren: 0 },
    createdAt: '2026-09-03T10:00:00Z',
    updatedAt: '2026-09-03T10:00:00Z'
  } as unknown as Booking;
  db.saveBooking(sampleBooking, adminActor);

  // Reassign Agent 1 from Riya -> Arjun
  const resReassign = assignAccountManagerToUser({
    agentUserId: agent1.id,
    accountManagerUid: tmArjun.id,
    actor: adminActor,
    reason: 'Coverage handover'
  });
  assert(resReassign.changed && resReassign.updatedUser.accountManagerUid === tmArjun.id, 'Agent 1 cleanly reassigned from Riya to Arjun');

  const histAgent1 = getAssignmentHistoryForAgent(agent1.id);
  assert(histAgent1.length === 2, 'History contains both initial ASSIGNED and subsequent REASSIGNED entries');
  assert(histAgent1.some(h => h.action === 'ASSIGNED' && h.newAccountManagerUid === tmRiya.id), 'Initial ASSIGNED record preserved immutably');
  assert(histAgent1.some(h => h.action === 'REASSIGNED' && h.previousAccountManagerUid === tmRiya.id && h.newAccountManagerUid === tmArjun.id && h.reason === 'Coverage handover'), 'REASSIGNED record captures previous & new manager + reason');

  // Verify historical Lead / Quote / Booking were NOT mutated
  const reloadedLead = db.getLeads().find(l => l.id === sampleLead.id);
  const reloadedQuote = db.getAllSavedQuotes().find(q => q.id === sampleQuote.id);
  const reloadedBooking = db.getAllBookings().find(b => b.id === sampleBooking.id);
  assert(reloadedLead?.assignedTeamMemberId === tmNeha.id && reloadedLead?.responsibleAgentId === agent1.id, 'Historical Lead operational assignee and creator untouched on AM reassignment');
  assert(reloadedQuote?.createdBy === agent1.id && reloadedQuote?.createdByName === agent1.name, 'Historical Quotation creator & attribution untouched on AM reassignment');
  assert(reloadedBooking?.assignedTeamMemberId === tmNeha.id && reloadedBooking?.submittingAgentId === agent1.id, 'Historical Booking operational owner untouched on AM reassignment');

  // ------------------------------------------------------------------
  console.log('\n4. Workload Count, Unassigned Audit Filter & Team Member Isolation');
  // ------------------------------------------------------------------
  const workloadSummary = getAccountManagerWorkloadSummary();
  const arjunWorkload = workloadSummary.workloads.find(w => w.teamMember.id === tmArjun.id);
  const riyaWorkload = workloadSummary.workloads.find(w => w.teamMember.id === tmRiya.id);
  assert(arjunWorkload?.assignedAgentsCount === 2, 'Arjun has exact workload count = 2 (Vikram + Ananya)');
  assert((riyaWorkload?.assignedAgentsCount || 0) === 0, 'Riya workload dropped to 0 after reassignment');

  const unassignedAudit = getUnassignedB2BAgents();
  const unassignedIds = new Set(unassignedAudit.map(u => u.id));
  assert(unassignedIds.has(agent4Unassigned.id) && unassignedIds.has(agentPending.id), 'Unassigned audit view surfaces unassigned active & pending B2B Agents');
  assert(!unassignedIds.has(agent1.id) && !unassignedIds.has(agent2.id), 'Assigned agents excluded from unassigned audit list');

  // Team Member Isolation checks
  const arjunAssigned = getAssignedAgentsForTeamMember(tmArjun.id);
  const nehaAssigned = getAssignedAgentsForTeamMember(tmNeha.id);
  assert(arjunAssigned.length === 2 && arjunAssigned.every(a => a.accountManagerUid === tmArjun.id), 'Arjun sees ONLY his 2 assigned B2B Agents');
  assert(nehaAssigned.length === 1 && nehaAssigned[0].id === agent3.id, 'Neha sees ONLY Agent 3 (strict isolation)');

  const arjunWorkspace = getTeamMemberAssignedWorkspaceSummary(tmArjun.id, tmArjun);
  const arjunVikramSummary = arjunWorkspace.find(s => s.agent.id === agent1.id);
  assert(Boolean(arjunVikramSummary && arjunVikramSummary.leads.some(l => l.id === sampleLead.id)), 'Arjun workspace resolves assigned agent linked leads dynamically');
  assert(Boolean(arjunVikramSummary && arjunVikramSummary.quotations.some(q => q.id === sampleQuote.id)), 'Arjun workspace resolves assigned agent quotations dynamically');
  assert(Boolean(arjunVikramSummary && arjunVikramSummary.bookings.some(b => b.id === sampleBooking.id)), 'Arjun workspace resolves assigned agent bookings dynamically');

  const crossMemberWorkspaceLeakCheck = getTeamMemberAssignedWorkspaceSummary(tmArjun.id, tmNeha);
  assert(
    crossMemberWorkspaceLeakCheck.length === 0,
    'Team Member Neha CANNOT inspect Team Member Arjun assigned agents workspace'
  );

  // ------------------------------------------------------------------
  console.log('\n5. Mandatory Assignment Enforcement & Invalid Selection Blocks');
  // ------------------------------------------------------------------
  assertThrows(
    () => db.createManagedUser({
      name: 'Blocked Agent',
      email: `blocked.agent.${suffix}@abctravels.com`,
      role: 'B2B_AGENT',
      agencyName: 'ABC Travels',
      approvalStatus: 'APPROVED'
    }, adminActor),
    'Block creating active B2B Agent without an Account Manager'
  );

  assertThrows(
    () => db.approveUser(agentPending.id, adminActor),
    'Block approving pending B2B Agent without selecting an Account Manager'
  );

  assertThrows(
    () => assignAccountManagerToUser({ agentUserId: agent4Unassigned.id, accountManagerUid: agent1.id, actor: adminActor }),
    'Block assigning a B2B Agent as an Account Manager'
  );

  assertThrows(
    () => assignAccountManagerToUser({ agentUserId: agent4Unassigned.id, accountManagerUid: tmDeactivated.id, actor: adminActor }),
    'Block assigning a deactivated Team Member as an Account Manager'
  );

  assertThrows(
    () => assignAccountManagerToUser({ agentUserId: agent4Unassigned.id, accountManagerUid: tmPending.id, actor: adminActor }),
    'Block assigning a pending Team Member as an Account Manager'
  );

  // Approve pending B2B Agent WITH valid Account Manager
  db.approveUser(agentPending.id, adminActor, { accountManagerUid: tmRiya.id, reason: 'Approved during onboarding' });
  const approvedPendingAgent = db.getUsers().find(u => u.id === agentPending.id);
  assert(approvedPendingAgent?.approvalStatus === 'APPROVED' && approvedPendingAgent?.accountManagerUid === tmRiya.id, 'Pending B2B Agent approved cleanly once valid Account Manager provided');

  // ------------------------------------------------------------------
  console.log('\n6. RBAC Permissions & Firestore Security Rules Verification');
  // ------------------------------------------------------------------
  assert(canUserAssignAccountManagers(adminActor), 'Admin authorized to assign Account Managers');
  assert(!canUserAssignAccountManagers(tmRiya), 'Standard Internal Team Member CANNOT assign/reassign Account Managers');
  assert(!canUserAssignAccountManagers(agent1), 'B2B Agent CANNOT assign/reassign Account Managers');

  assertThrows(
    () => assignAccountManagerToUser({ agentUserId: agent4Unassigned.id, accountManagerUid: tmRiya.id, actor: tmRiya }),
    'Service rejects Account Manager assignment attempt by non-admin Team Member'
  );
  assertThrows(
    () => assignAccountManagerToUser({ agentUserId: agent4Unassigned.id, accountManagerUid: tmRiya.id, actor: agent1 }),
    'Service rejects Account Manager assignment attempt by B2B Agent'
  );

  assert(canUserAccessCMSSubTab(tmRiya, 'ACCOUNT_MANAGEMENT', 'MY_ASSIGNED_AGENTS'), 'Team Member can open MY_ASSIGNED_AGENTS workspace tab');
  assert(!canUserAccessCMSSubTab(tmRiya, 'ACCOUNT_MANAGEMENT', 'USERS_ACCESS'), 'Team Member blocked from Admin USERS_ACCESS tab');
  assert(!canUserAccessCMSModule(tmRiya, 'ACCOUNT_MANAGEMENT'), 'Team Member still blocked from full ACCOUNT_MANAGEMENT module outside MY_ASSIGNED_AGENTS');

  const rulesContent = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
  assert(rulesContent.includes("'accountManagerUid'") && rulesContent.includes("'accountManagerAssignmentStatus'"), 'firestore.rules locks accountManager* fields on self-update & create');
  assert(rulesContent.includes('match /account_manager_assignment_history/{historyId}') && rulesContent.includes('allow update, delete: if false;'), 'firestore.rules enforces strictly append-only immutable assignment history');

  // ------------------------------------------------------------------
  console.log('\n7. Persistence & Reload Hydration Verification');
  // ------------------------------------------------------------------
  const hydratedUsers = db.getUsers();
  const hydratedAgent1 = hydratedUsers.find(u => u.id === agent1.id);
  const hydratedHistory = db.getAccountManagerAssignmentHistory(agent1.id);
  assert(hydratedAgent1?.accountManagerUid === tmArjun.id && hydratedAgent1?.accountManagerName === tmArjun.name, 'Re-reading users collection preserves assigned Account Manager accurately');
  assert(hydratedHistory.length === 2, 'Re-reading assignment history collection returns immutable timeline');

  console.log('\n====================================================================');
  console.log(`AUDIT SUMMARY: ${passedTests}/${totalTests} PASSED | ${failedTests} FAILED`);
  console.log('====================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAudit();
