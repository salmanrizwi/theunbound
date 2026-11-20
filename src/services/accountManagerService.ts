import {
  User,
  UserRole,
  TravelLead,
  Quotation,
  Booking,
  CalendarTask,
  AccountManagerAssignmentHistory,
  AccountManagerAssignmentStatus
} from '../types';
import { AppDatabase } from './db';
import { canUserAssignAccountManagers, isMasterAdmin, isInternalStaff } from './permissionEngine';

export interface ResolvedAccountManager {
  isAssigned: boolean;
  status: AccountManagerAssignmentStatus;
  uid?: string;
  name?: string;
  email?: string;
  designation?: string;
  phone?: string;
  assignedAt?: string;
  assignedBy?: string;
  assignedByName?: string;
  updatedAt?: string;
  isTeamMemberActive: boolean;
}

export interface AccountManagerWorkloadItem {
  teamMember: User;
  assignedAgentsCount: number;
  activeAgentsCount: number;
  pendingAgentsCount: number;
  assignedAgents: User[];
}

export interface AssignedAgentOperationalSummary {
  agent: User;
  assignedAt?: string;
  assignedByName?: string;
  leads: TravelLead[];
  quotations: Quotation[];
  bookings: Booking[];
  pendingTasks: CalendarTask[];
  recentActivityAt?: string;
  recentActivitySummary?: string;
}

export function isB2BAgentRole(role?: UserRole | string): boolean {
  return role === 'B2B_AGENT' || role === 'AGENT';
}

export function isExternalPartnerAccount(user: User | null | undefined): boolean {
  if (!user) return false;
  return (
    user.role === 'B2B_AGENT' ||
    user.role === 'AGENT' ||
    user.role === 'AGENCY_OWNER' ||
    user.userType === 'B2B_AGENT'
  );
}

/**
 * Resolves the assigned Account Manager strictly at USER LEVEL for an individual B2B Agent.
 * NEVER falls back to agency-level or sibling user assignments.
 */
export function resolveUserAccountManager(
  agentOrUserId: User | string | null | undefined,
  allUsersInput?: User[]
): ResolvedAccountManager {
  const db = AppDatabase.getInstance();
  const users = allUsersInput || db.getUsers();
  const targetUser =
    typeof agentOrUserId === 'string'
      ? users.find(u => u.id === agentOrUserId)
      : agentOrUserId;

  if (!targetUser || !targetUser.accountManagerUid) {
    return {
      isAssigned: false,
      status: 'UNASSIGNED',
      isTeamMemberActive: false
    };
  }

  const amUid = targetUser.accountManagerUid.trim();
  if (!amUid) {
    return {
      isAssigned: false,
      status: 'UNASSIGNED',
      isTeamMemberActive: false
    };
  }

  const liveManager = users.find(u => u.id === amUid);
  const isActiveInternal = liveManager ? db.isEligibleInternalTeamMember(liveManager) : false;

  return {
    isAssigned: true,
    status: 'ASSIGNED',
    uid: amUid,
    name: liveManager?.name || targetUser.accountManagerName || 'Assigned Account Manager',
    email: liveManager?.email || targetUser.accountManagerEmail,
    designation:
      liveManager?.jobTitle ||
      (liveManager as any)?.designation ||
      targetUser.accountManagerDesignation ||
      liveManager?.role ||
      'Team Member',
    phone:
      liveManager?.phone ||
      liveManager?.contactNumber ||
      targetUser.accountManagerPhone,
    assignedAt: targetUser.accountManagerAssignedAt,
    assignedBy: targetUser.accountManagerAssignedBy,
    assignedByName: targetUser.accountManagerAssignedByName,
    updatedAt: targetUser.accountManagerUpdatedAt,
    isTeamMemberActive: isActiveInternal
  };
}

/**
 * Authoritative eligible internal Team Members pool for Account Manager selection.
 * Never returns B2B Agents, Agency Owners, Buyers, or inactive/disabled/pending staff.
 */
export function getEligibleAccountManagers(allUsersInput?: User[]): User[] {
  const db = AppDatabase.getInstance();
  if (!allUsersInput) {
    return db.getEligibleInternalTeamMembers();
  }
  return allUsersInput
    .filter(u => db.isEligibleInternalTeamMember(u))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

/**
 * Assigns or reassigns an Account Manager strictly to an individual B2B Agent / Partner account.
 * Guarantees:
 * - Only authorized Admins/Account Managers can execute.
 * - Target is modified strictly by immutable Firebase UID (never cascades across the agency).
 * - Selected Account Manager must be an active eligible internal Team Member (never a B2B Agent).
 * - Preserves existing user permissions, approvalStatus, and margin settings.
 * - Never mutates existing leads, quotations, or bookings.
 * - Appends an immutable AccountManagerAssignmentHistory record + AuditLog entry.
 */
export function assignAccountManagerToUser(params: {
  agentUserId: string;
  accountManagerUid: string;
  actor: User | null | undefined;
  reason?: string;
}): {
  updatedUser: User;
  historyEntry: AccountManagerAssignmentHistory | null;
  changed: boolean;
} {
  const db = AppDatabase.getInstance();
  const { agentUserId, accountManagerUid, actor, reason } = params;

  if (!canUserAssignAccountManagers(actor)) {
    throw new Error(
      'Unauthorized: Only authorized Administrators may assign or reassign Account Managers.'
    );
  }

  const users = db.getUsers();
  const targetUser = users.find(u => u.id === agentUserId);
  if (!targetUser) {
    throw new Error(`Target user account (${agentUserId}) was not found.`);
  }

  if (!isExternalPartnerAccount(targetUser)) {
    throw new Error(
      `Account Manager assignments apply only to individual B2B Agent / Partner accounts (target role: ${targetUser.role}).`
    );
  }

  const cleanAmUid = (accountManagerUid || '').trim();
  if (!cleanAmUid) {
    throw new Error('Account Manager selection is required. Cannot leave B2B Agent unassigned.');
  }

  if (cleanAmUid === targetUser.id) {
    throw new Error('A user cannot be assigned as their own Account Manager.');
  }

  const teamMember = users.find(u => u.id === cleanAmUid);
  if (!teamMember || !db.isEligibleInternalTeamMember(teamMember)) {
    throw new Error(
      'Invalid Account Manager: Only active, approved internal Team Members can be assigned as Account Managers.'
    );
  }

  const previousUid = targetUser.accountManagerUid || null;
  const previousName = targetUser.accountManagerName || null;
  const previousEmail = targetUser.accountManagerEmail || null;
  const designation = teamMember.jobTitle || (teamMember as any).designation || teamMember.role;
  const phone = teamMember.phone || teamMember.contactNumber || undefined;

  const isSameAssignment =
    previousUid === teamMember.id &&
    targetUser.accountManagerAssignmentStatus === 'ASSIGNED' &&
    targetUser.accountManagerName === teamMember.name &&
    targetUser.accountManagerEmail === teamMember.email;

  if (isSameAssignment) {
    return {
      updatedUser: targetUser,
      historyEntry: null,
      changed: false
    };
  }

  const nowIso = new Date().toISOString();
  const actionType: 'ASSIGNED' | 'REASSIGNED' = previousUid ? 'REASSIGNED' : 'ASSIGNED';

  const updatedUser: User = {
    ...targetUser,
    accountManagerUid: teamMember.id,
    accountManagerName: teamMember.name,
    accountManagerEmail: teamMember.email,
    accountManagerDesignation: designation,
    accountManagerPhone: phone,
    accountManagerAssignedAt: targetUser.accountManagerAssignedAt || nowIso,
    accountManagerAssignedBy: actor?.id || 'usr-admin-business',
    accountManagerAssignedByName: actor?.name || 'Administrator',
    accountManagerUpdatedAt: nowIso,
    accountManagerAssignmentStatus: 'ASSIGNED',
    updatedAt: nowIso
  };

  db.saveUser(
    updatedUser,
    actor || null,
    'USER_PERMISSIONS_CHANGED',
    `${actionType === 'ASSIGNED' ? 'Assigned' : 'Reassigned'} Account Manager for ${updatedUser.name} (${updatedUser.id}) -> ${teamMember.name} (${teamMember.id})${reason ? `. Reason: ${reason}` : ''}`,
    true
  );

  const historyEntry: AccountManagerAssignmentHistory = {
    id: `am-hist-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    agentUid: updatedUser.id,
    agentName: updatedUser.name,
    agentEmail: updatedUser.email,
    agencyId: updatedUser.companyId,
    agencyName: updatedUser.agencyName || updatedUser.companyName,
    previousAccountManagerUid: previousUid,
    previousAccountManagerName: previousName,
    previousAccountManagerEmail: previousEmail,
    newAccountManagerUid: teamMember.id,
    newAccountManagerName: teamMember.name,
    newAccountManagerEmail: teamMember.email,
    newAccountManagerDesignation: designation,
    action: actionType,
    performedByUid: actor?.id || 'usr-admin-business',
    performedByName: actor?.name || 'Administrator',
    performedByEmail: actor?.email,
    performedByRole: actor?.role || 'ADMIN',
    reason: reason?.trim() || undefined,
    timestamp: nowIso
  };

  db.recordAccountManagerAssignmentHistory(historyEntry);

  db.logAudit(
    actor || null,
    actionType === 'ASSIGNED' ? 'ACCOUNT_MANAGER_ASSIGNED' : 'ACCOUNT_MANAGER_REASSIGNED',
    'UserAccountManager',
    updatedUser.id,
    `${actionType === 'ASSIGNED' ? 'Assigned' : 'Reassigned'} Account Manager ${teamMember.name} to B2B Agent ${updatedUser.name} (${updatedUser.email}).`,
    previousUid ? `${previousName || previousUid} (${previousUid})` : 'UNASSIGNED',
    `${teamMember.name} (${teamMember.id})`
  );

  return {
    updatedUser,
    historyEntry,
    changed: true
  };
}

/**
 * Returns ONLY the individual B2B Agents assigned directly to teamMemberUid.
 * Strict isolation: never leaks other team members' assigned agents.
 */
export function getAssignedAgentsForTeamMember(
  teamMemberUid: string,
  allUsersInput?: User[]
): User[] {
  if (!teamMemberUid) return [];
  const db = AppDatabase.getInstance();
  const users = allUsersInput || db.getUsers();
  return users
    .filter(
      u =>
        isExternalPartnerAccount(u) &&
        !u.isDeactivated &&
        u.accountManagerUid === teamMemberUid
    )
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

/**
 * Returns individual B2B Agents that currently have NO Account Manager assigned.
 * Never auto-assigns or invents a manager.
 */
export function getUnassignedB2BAgents(allUsersInput?: User[]): User[] {
  const db = AppDatabase.getInstance();
  const users = allUsersInput || db.getUsers();
  return users
    .filter(
      u =>
        isB2BAgentRole(u.role) &&
        !u.isDeactivated &&
        (!u.accountManagerUid || !u.accountManagerUid.trim())
    )
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

/**
 * Computes exact user-level Account Manager workload across active internal Team Members.
 * Never rolls up by agency; every count reflects individual B2B Agent accounts.
 */
export function getAccountManagerWorkloadSummary(allUsersInput?: User[]): {
  workloads: AccountManagerWorkloadItem[];
  unassignedB2BAgents: User[];
  totalManagedAgents: number;
} {
  const db = AppDatabase.getInstance();
  const users = allUsersInput || db.getUsers();
  const teamMembers = getEligibleAccountManagers(users);
  const b2bUsers = users.filter(u => isExternalPartnerAccount(u) && !u.isDeactivated);

  const workloads: AccountManagerWorkloadItem[] = teamMembers.map(tm => {
    const assigned = b2bUsers.filter(u => u.accountManagerUid === tm.id);
    return {
      teamMember: tm,
      assignedAgentsCount: assigned.length,
      activeAgentsCount: assigned.filter(a => (a.approvalStatus || 'APPROVED') === 'APPROVED').length,
      pendingAgentsCount: assigned.filter(a => a.approvalStatus === 'PENDING').length,
      assignedAgents: assigned
    };
  });

  const unassignedB2BAgents = getUnassignedB2BAgents(users);

  return {
    workloads: workloads.sort((a, b) => b.assignedAgentsCount - a.assignedAgentsCount),
    unassignedB2BAgents,
    totalManagedAgents: b2bUsers.filter(u => Boolean(u.accountManagerUid)).length
  };
}

/**
 * Returns operational activity summary for a Team Member's strictly isolated assigned B2B Agents.
 * Enforces caller authorization: a Team Member can ONLY view their own assigned agents.
 */
export function getTeamMemberAssignedWorkspaceSummary(
  teamMemberUid: string,
  actor: User | null | undefined
): AssignedAgentOperationalSummary[] {
  if (!actor || !isInternalStaff(actor)) return [];
  const isAdminActor =
    isMasterAdmin(actor) || actor.role === 'ADMIN' || actor.role === 'SUPER_ADMIN';
  if (!isAdminActor && actor.id !== teamMemberUid) {
    return [];
  }

  const db = AppDatabase.getInstance();
  const assignedAgents = getAssignedAgentsForTeamMember(teamMemberUid);
  if (assignedAgents.length === 0) return [];

  const allLeads = db.getLeads();
  const allQuotes = db.getAllSavedQuotes();
  const allBookings = db.getAllBookings();
  const allTasks = db.getCalendarTasks().filter(t => !t.isArchived);

  return assignedAgents.map(agent => {
    const agentEmail = (agent.email || '').trim().toLowerCase();

    const leads = allLeads.filter(
      l =>
        l.responsibleAgentId === agent.id ||
        l.assignedAgentId === agent.id ||
        l.submittingAgentId === agent.id ||
        l.b2bAgentId === agent.id ||
        l.userId === agent.id ||
        (agentEmail && (l.email || '').trim().toLowerCase() === agentEmail)
    );

    const quotations = allQuotes.filter(
      q =>
        q.createdBy === agent.id ||
        q.agentId === agent.id ||
        q.b2bAgentId === agent.id ||
        (agentEmail && (q.agentEmail || '').trim().toLowerCase() === agentEmail)
    );

    const bookings = allBookings.filter(
      b =>
        b.submittingAgentId === agent.id ||
        b.assignedAgentId === agent.id ||
        b.agentId === agent.id ||
        b.submittedByUserId === agent.id ||
        b.userId === agent.id
    );

    const leadIds = new Set(leads.map(l => l.id));
    const bookingIds = new Set(bookings.map(b => b.id));
    const pendingTasks = allTasks.filter(t => {
      if (t.status === 'COMPLETED' || t.status === 'CANCELLED' || t.status === 'ARCHIVED') {
        return false;
      }
      return (
        (t.leadId && leadIds.has(t.leadId)) ||
        (t.bookingId && bookingIds.has(t.bookingId)) ||
        (t.entityId && (leadIds.has(t.entityId) || bookingIds.has(t.entityId)))
      );
    });

    // Derive most recent operational activity timestamp strictly from real records
    const activityCandidates: Array<{ ts: string; label: string }> = [];
    quotations.forEach(q => {
      const ts = q.updatedAt || q.createdAt;
      if (ts) activityCandidates.push({ ts, label: `Quote ${q.quoteNumber} (${q.status})` });
    });
    bookings.forEach(b => {
      const ts = b.updatedAt || b.createdAt;
      if (ts) activityCandidates.push({ ts, label: `Booking ${b.bookingReference} (${b.status})` });
    });
    leads.forEach(l => {
      const ts = l.updatedAt || l.createdAt;
      if (ts) activityCandidates.push({ ts, label: `Lead ${l.leadNumber} (${l.status})` });
    });
    activityCandidates.sort((a, b) => b.ts.localeCompare(a.ts));

    return {
      agent,
      assignedAt: agent.accountManagerAssignedAt,
      assignedByName: agent.accountManagerAssignedByName,
      leads,
      quotations,
      bookings,
      pendingTasks,
      recentActivityAt: activityCandidates[0]?.ts || agent.lastLoginAt || agent.updatedAt,
      recentActivitySummary: activityCandidates[0]?.label || 'No recent transactions yet'
    };
  });
}

export function getAssignmentHistoryForAgent(agentUid: string): AccountManagerAssignmentHistory[] {
  return AppDatabase.getInstance().getAccountManagerAssignmentHistory(agentUid);
}

export function getAllAssignmentHistory(): AccountManagerAssignmentHistory[] {
  return AppDatabase.getInstance().getAccountManagerAssignmentHistory();
}
