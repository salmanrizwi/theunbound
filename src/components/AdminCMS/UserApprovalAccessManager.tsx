import React, { useState, useEffect } from 'react';
import { User, UserRole, UserApprovalStatus, UserPermissionAccess } from '../../types';
import { AppDatabase } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { UserPermissionModal } from './UserPermissionModal';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { CompanyManagementView } from './CompanyManagementView';
import { 
  getDefaultPermissionsForRole, 
  isMasterAdmin, 
  canRevokeAdminPermissions 
} from '../../services/permissionEngine';
import { 
  Users, 
  ShieldCheck, 
  UserCheck, 
  UserX, 
  Lock, 
  Search, 
  Filter, 
  Sliders, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Percent, 
  Building, 
  Building2,
  Mail, 
  Phone, 
  Globe2, 
  Save, 
  KeyRound,
  FileSpreadsheet,
  FileDown,
  Calculator,
  ShieldAlert,
  Shield,
  Layers,
  Compass,
  Package,
  Receipt,
  Database,
  Check,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  ChevronRight,
  Settings2,
  Trash2,
  X,
  AlertCircle
} from 'lucide-react';

interface UserApprovalAccessManagerProps {
  initialTab?: 'USERS_ACCESS' | 'PERMISSIONS' | 'COMPANIES';
}

export const UserApprovalAccessManager: React.FC<UserApprovalAccessManagerProps> = ({ 
  initialTab = 'PERMISSIONS' 
}) => {
  const db = AppDatabase.getInstance();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>(() => db.getUsers());
  const [companies, setCompanies] = useState(() => db.getCompanies());
  const [currentSectionTab, setCurrentSectionTab] = useState<'PERMISSIONS' | 'USERS_ACCESS' | 'COMPANIES'>(initialTab);
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [accessFilter, setAccessFilter] = useState<string>('ALL'); // ALL, B2B_QUOTE, BUYER_QUOTE, CMS_ENABLED, CMS_DISABLED
  const [savedSuccess, setSavedSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal State
  const [selectedUserForModal, setSelectedUserForModal] = useState<User | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; email?: string; role?: string; status?: string } | null>(null);
  const [rejectionTargetUser, setRejectionTargetUser] = useState<User | null>(null);
  const [rejectionNotes, setRejectionNotes] = useState<string>('Additional business documentation is required to verify your travel agency registration.');
  const [rejectionRequirements, setRejectionRequirements] = useState<string[]>([
    'Valid government-issued travel trade license or IATA/ABTA registration certificate',
    'Official company tax identifier (GSTIN / VAT / Corporation Tax)',
    'Verified commercial office billing address'
  ]);
  const [customRequirementInput, setCustomRequirementInput] = useState<string>('');

  // Bulk Operations State
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [bulkActionConfirm, setBulkActionConfirm] = useState<{
    action: 'GRANT_QUOTE' | 'REVOKE_QUOTE' | 'GRANT_CMS' | 'REVOKE_CMS' | 'ROLE_DEFAULTS' | 'APPROVE_ALL';
    label: string;
  } | null>(null);

  // Global Default Margins (for approval tab)
  const [defaultBuyerMargin, setDefaultBuyerMargin] = useState<number>(25);
  const [defaultAgentMargin, setDefaultAgentMargin] = useState<number>(10);

  const refreshUsers = () => {
    const fresh = db.getUsers();
    setUsers(fresh);
    setCompanies(db.getCompanies());
    // Also update currently selected modal user if open
    if (selectedUserForModal) {
      const refreshedTarget = fresh.find(u => u.id === selectedUserForModal.id);
      if (refreshedTarget) setSelectedUserForModal(refreshedTarget);
    }
  };

  useEffect(() => {
    const unsub = db.subscribe(() => {
      refreshUsers();
    });
    return () => unsub();
  }, [db]);

  const handleOpenPermissionModal = (targetUser: User) => {
    setSelectedUserForModal(targetUser);
    setIsModalOpen(true);
  };

  const handleSaveUserFromModal = async (updatedUser: User, auditReason?: string) => {
    try {
      db.saveUser(
        updatedUser, 
        currentUser, 
        'USER_PERMISSIONS_CHANGED', 
        auditReason || `Updated user permissions for ${updatedUser.name} (${updatedUser.email}).`
      );
      refreshUsers();
      setSavedSuccess(`Saved permissions profile for ${updatedUser.name}.`);
      setTimeout(() => setSavedSuccess(null), 3500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error saving user permissions.');
      setTimeout(() => setErrorMessage(null), 4000);
      throw err;
    }
  };

  const handleApprove = (targetUser: User) => {
    db.approveUser(targetUser.id, currentUser);
    refreshUsers();
    setSavedSuccess(`Approved account for ${targetUser.name}. Automated verification approval email with portal link dispatched.`);
    setTimeout(() => setSavedSuccess(null), 4000);
  };

  const handleReject = (targetUser: User) => {
    setRejectionTargetUser(targetUser);
    setRejectionNotes(
      targetUser.verificationNotes ||
      'Additional business credentials or trade documentation are required to complete account verification.'
    );
  };

  const handleConfirmRejectionWithRequirements = () => {
    if (!rejectionTargetUser) return;
    try {
      db.rejectUser(
        rejectionTargetUser.id,
        currentUser,
        rejectionNotes,
        rejectionRequirements
      );
      refreshUsers();
      setSavedSuccess(
        `Account review completed for ${rejectionTargetUser.name}. Automated requirements checklist email sent to ${rejectionTargetUser.email}.`
      );
      setTimeout(() => setSavedSuccess(null), 4500);
      setRejectionTargetUser(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to reject user.');
      setTimeout(() => setErrorMessage(null), 4000);
    }
  };

  const handleTogglePermission = (userId: string, permKey: keyof NonNullable<User['permissions']>) => {
    const target = users.find(u => u.id === userId);
    if (!target) return;

    if (isMasterAdmin(target) && (permKey === 'canAccessCMS' || permKey === 'canManageUsers')) {
      setErrorMessage('Security Safeguard: Primary Master Administrator permissions are protected.');
      setTimeout(() => setErrorMessage(null), 3500);
      return;
    }

    const currentPerms = target.permissions || getDefaultPermissionsForRole(target.role);
    const updatedVal = !(currentPerms as any)[permKey];

    const updated: User = {
      ...target,
      permissions: {
        ...currentPerms,
        [permKey]: updatedVal
      }
    };

    db.saveUser(
      updated, 
      currentUser, 
      'USER_PERMISSIONS_CHANGED', 
      `Quick toggled ${String(permKey)}=${updatedVal} for ${target.name}`
    );
    refreshUsers();
  };

  const handleMarginChange = (userId: string, field: 'customBuyerMarginPercent' | 'customAgentMarginPercent', value: number) => {
    const target = users.find(u => u.id === userId);
    if (!target) return;

    const updated: User = {
      ...target,
      [field]: value
    };

    db.saveUser(updated, currentUser);
    refreshUsers();
  };

  const handleRoleChange = (userId: string, newRole: UserRole) => {
    const target = users.find(u => u.id === userId);
    if (!target) return;

    if (isMasterAdmin(target) && newRole !== 'ADMIN') {
      setErrorMessage('Security Safeguard: Cannot demote the Primary Master Administrator.');
      setTimeout(() => setErrorMessage(null), 3500);
      return;
    }

    const isInternal = newRole === 'ADMIN' || newRole === 'TEAM_MEMBER' || newRole === 'DMC_STAFF';
    const updated: User = {
      ...target,
      role: newRole,
      category: isInternal ? 'INTERNAL' : 'EXTERNAL',
      permissions: getDefaultPermissionsForRole(newRole)
    };

    db.saveUser(
      updated, 
      currentUser, 
      'USER_ROLE_CHANGED', 
      `Role updated to ${newRole} for ${target.name}`
    );
    refreshUsers();
  };

  const handleApplyGlobalMargins = () => {
    const updatedUsers = users.map(u => ({
      ...u,
      customBuyerMarginPercent: defaultBuyerMargin,
      customAgentMarginPercent: defaultAgentMargin
    }));
    updatedUsers.forEach(u => db.saveUser(u, currentUser));
    refreshUsers();
    setSavedSuccess(`Applied default margins: Buyer ${defaultBuyerMargin}%, Agent ${defaultAgentMargin}% across all users.`);
    setTimeout(() => setSavedSuccess(null), 3000);
  };

  // Bulk Selection Handlers
  const handleSelectAll = (filtered: User[]) => {
    if (selectedUserIds.length === filtered.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(filtered.map(u => u.id));
    }
  };

  const handleToggleSelect = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleExecuteBulkAction = () => {
    if (!bulkActionConfirm) return;
    const targets = users.filter(u => selectedUserIds.includes(u.id));
    let affectedCount = 0;

    targets.forEach(u => {
      // Check safeguard if admin
      if (isMasterAdmin(u) && (bulkActionConfirm.action === 'REVOKE_CMS' || bulkActionConfirm.action === 'REVOKE_QUOTE')) {
        return; // Skip master admin
      }

      let updatedPerms = { ...(u.permissions || getDefaultPermissionsForRole(u.role)) };

      if (bulkActionConfirm.action === 'GRANT_QUOTE') {
        updatedPerms.b2bQuoteBuilderAccess = true;
        updatedPerms.buyerQuoteBuilderAccess = true;
        updatedPerms.canAccessPricingCalculator = true;
        updatedPerms.canExportPDF = true;
        updatedPerms.canCreateBookings = true;
      } else if (bulkActionConfirm.action === 'REVOKE_QUOTE') {
        updatedPerms.b2bQuoteBuilderAccess = false;
        updatedPerms.buyerQuoteBuilderAccess = false;
        updatedPerms.canAccessPricingCalculator = false;
      } else if (bulkActionConfirm.action === 'GRANT_CMS') {
        updatedPerms.canAccessCMS = true;
        if (!updatedPerms.cmsOperations) updatedPerms.cmsOperations = { enabled: true };
        if (!updatedPerms.cmsContent) updatedPerms.cmsContent = { enabled: true };
        if (!updatedPerms.cmsSystem) updatedPerms.cmsSystem = { enabled: true };
      } else if (bulkActionConfirm.action === 'REVOKE_CMS') {
        updatedPerms.canAccessCMS = false;
      } else if (bulkActionConfirm.action === 'ROLE_DEFAULTS') {
        updatedPerms = getDefaultPermissionsForRole(u.role);
      } else if (bulkActionConfirm.action === 'APPROVE_ALL') {
        db.approveUser(u.id, currentUser);
        affectedCount++;
        return;
      }

      const updatedUser: User = {
        ...u,
        approvalStatus: bulkActionConfirm.action === 'APPROVE_ALL' ? 'APPROVED' : u.approvalStatus,
        permissions: updatedPerms
      };

      db.saveUser(
        updatedUser, 
        currentUser, 
        'USER_PERMISSIONS_CHANGED', 
        `Bulk operation applied: ${bulkActionConfirm.label} for ${u.name}`
      );
      affectedCount++;
    });

    refreshUsers();
    setSelectedUserIds([]);
    setBulkActionConfirm(null);
    setSavedSuccess(`Bulk action "${bulkActionConfirm.label}" completed successfully for ${affectedCount} user(s).`);
    setTimeout(() => setSavedSuccess(null), 4000);
  };

  // Filtered Users List
  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.agencyName && u.agencyName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (u.companyName && u.companyName.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesRole = selectedRole === 'ALL' || u.role === selectedRole;
    const userStatus = u.approvalStatus || 'APPROVED';
    const matchesStatus = selectedStatus === 'ALL' || userStatus === selectedStatus;

    let matchesAccess = true;
    if (accessFilter === 'B2B_QUOTE') {
      matchesAccess = u.permissions?.b2bQuoteBuilderAccess === true || 
        (u.permissions?.b2bQuoteBuilderAccess === undefined && (u.role === 'B2B_AGENT' || u.role === 'AGENT' || u.role === 'ADMIN' || u.role === 'TEAM_MEMBER'));
    } else if (accessFilter === 'BUYER_QUOTE') {
      matchesAccess = u.permissions?.buyerQuoteBuilderAccess === true || 
        (u.permissions?.buyerQuoteBuilderAccess === undefined && (u.role === 'BUYER' || u.role === 'ADMIN' || u.role === 'TEAM_MEMBER'));
    } else if (accessFilter === 'CMS_ENABLED') {
      matchesAccess = u.permissions?.canAccessCMS === true || (u.permissions?.canAccessCMS === undefined && (u.role === 'ADMIN' || u.role === 'TEAM_MEMBER'));
    } else if (accessFilter === 'CMS_DISABLED') {
      matchesAccess = u.permissions?.canAccessCMS === false || (u.permissions?.canAccessCMS === undefined && u.role !== 'ADMIN' && u.role !== 'TEAM_MEMBER');
    }

    return matchesSearch && matchesRole && matchesStatus && matchesAccess;
  });

  const pendingCount = users.filter(u => u.approvalStatus === 'PENDING').length;
  const buyerCount = users.filter(u => u.role === 'BUYER').length;
  const agentCount = users.filter(u => u.role === 'B2B_AGENT' || u.role === 'AGENT').length;
  const internalCount = users.filter(u => u.category === 'INTERNAL' || u.role === 'ADMIN' || u.role === 'TEAM_MEMBER').length;
  const cmsAuthorizedCount = users.filter(u => u.permissions?.canAccessCMS || u.role === 'ADMIN' || u.role === 'TEAM_MEMBER').length;
  const quoteBuilderAuthorizedCount = users.filter(u => 
    u.permissions?.b2bQuoteBuilderAccess || 
    u.permissions?.buyerQuoteBuilderAccess || 
    u.permissions?.canAccessPricingCalculator || 
    u.role === 'B2B_AGENT' || 
    u.role === 'ADMIN' || 
    u.role === 'BUYER'
  ).length;

  return (
    <div id="user-approval-access-manager" className="space-y-6">
      
      {/* Top Banner & Mode Segmented Navigation */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-[#00C6A6] text-xs font-bold uppercase tracking-wider mb-1">
              <Shield className="w-4 h-4" />
              <span>Security & Access Governance</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900">
              Account Management — Access & Permissions
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
              Manage individual user permission profiles, B2B and Buyer Quote Builder access, hierarchical CMS modules, and network segregation.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            {savedSuccess && (
              <span className="inline-flex items-center space-x-1.5 text-emerald-700 bg-emerald-50 text-xs font-semibold px-3 py-1.5 rounded-lg border border-emerald-200 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4" />
                <span>{savedSuccess}</span>
              </span>
            )}
            {errorMessage && (
              <span className="inline-flex items-center space-x-1.5 text-rose-700 bg-rose-50 text-xs font-semibold px-3 py-1.5 rounded-lg border border-rose-200 animate-in fade-in">
                <AlertTriangle className="w-4 h-4" />
                <span>{errorMessage}</span>
              </span>
            )}
            {pendingCount > 0 && (
              <button 
                onClick={() => {
                  setCurrentSectionTab('USERS_ACCESS');
                  setSelectedStatus('PENDING');
                }}
                className="inline-flex items-center space-x-1.5 bg-amber-500 text-slate-950 font-bold px-3 py-1.5 rounded-xl text-xs shadow-xs animate-pulse cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>{pendingCount} Pending Approvals</span>
              </button>
            )}
          </div>
        </div>

        {/* Section View Selector */}
        <div className="flex items-center space-x-2 border-t border-slate-100 pt-4">
          <button
            onClick={() => setCurrentSectionTab('PERMISSIONS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              currentSectionTab === 'PERMISSIONS'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Shield className="w-4 h-4 text-[#00C6A6]" />
            <span>ACCESS & PERMISSIONS</span>
            <span className="bg-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded-full ml-1">
              {users.length}
            </span>
          </button>

          <button
            onClick={() => setCurrentSectionTab('USERS_ACCESS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              currentSectionTab === 'USERS_ACCESS'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <UserCheck className="w-4 h-4 text-emerald-400" />
            <span>USER APPROVAL & SEGREGATION</span>
            {pendingCount > 0 && (
              <span className="bg-amber-400 text-slate-950 text-[10px] px-2 py-0.5 rounded-full ml-1 font-black">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setCurrentSectionTab('COMPANIES')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              currentSectionTab === 'COMPANIES'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Building2 className="w-4 h-4 text-[#00C6A6]" />
            <span>COMPANIES & TRADE PARTNERS</span>
            <span className="bg-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded-full ml-1 font-mono">
              {companies.length}
            </span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Managed Accounts</div>
          <div className="text-2xl font-bold text-slate-900 font-mono mt-1">{users.length}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">{internalCount} Internal / {users.length - internalCount} External</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Quote Builder Authorized</div>
          <div className="text-2xl font-bold text-teal-600 font-mono mt-1">{quoteBuilderAuthorizedCount}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">B2B Agents & Direct Buyers</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">CMS Module Authorized</div>
          <div className="text-2xl font-bold text-indigo-600 font-mono mt-1">{cmsAuthorizedCount}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Operators & Administrators</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Pending Decision</div>
          <div className="text-2xl font-bold text-amber-600 font-mono mt-1">{pendingCount}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Awaiting verification</div>
        </div>
      </div>

      {/* VIEW 1: DEDICATED ACCESS & PERMISSIONS SECTION */}
      {currentSectionTab === 'PERMISSIONS' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          
          {/* Controls & Filter Bar */}
          <div className="p-4 sm:p-5 border-b border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search user by name, email, agency..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#00C6A6]"
                />
              </div>

              {/* Filters */}
              <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                <select
                  value={selectedRole}
                  onChange={e => setSelectedRole(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 rounded-xl px-3 py-2 focus:ring-0"
                >
                  <option value="ALL">All Roles</option>
                  <option value="ADMIN">Administrators</option>
                  <option value="TEAM_MEMBER">Team Members</option>
                  <option value="B2B_AGENT">B2B Agents</option>
                  <option value="BUYER">Direct Buyers</option>
                </select>

                <select
                  value={accessFilter}
                  onChange={e => setAccessFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 rounded-xl px-3 py-2 focus:ring-0"
                >
                  <option value="ALL">All Access Tiers</option>
                  <option value="B2B_QUOTE">B2B Quote Builder</option>
                  <option value="BUYER_QUOTE">Buyer Quote Builder</option>
                  <option value="CMS_ENABLED">CMS Access Enabled</option>
                  <option value="CMS_DISABLED">CMS Access Disabled</option>
                </select>

                <select
                  value={selectedStatus}
                  onChange={e => setSelectedStatus(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 rounded-xl px-3 py-2 focus:ring-0"
                >
                  <option value="ALL">All Status</option>
                  <option value="APPROVED">Approved</option>
                  <option value="PENDING">Pending Review</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
            </div>

            {/* Bulk Action Bar (Visible when users selected) */}
            {selectedUserIds.length > 0 && (
              <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl flex flex-wrap items-center justify-between gap-2 animate-in fade-in">
                <div className="flex items-center space-x-2 text-xs font-bold text-indigo-900">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                  <span>{selectedUserIds.length} user(s) selected for bulk permission update:</span>
                </div>

                <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                  <button
                    onClick={() => setBulkActionConfirm({ action: 'GRANT_QUOTE', label: 'Grant Quote Builder Access' })}
                    className="text-[11px] font-bold px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-lg shadow-2xs transition-colors cursor-pointer"
                  >
                    + Grant Quote Builder
                  </button>

                  <button
                    onClick={() => setBulkActionConfirm({ action: 'REVOKE_QUOTE', label: 'Revoke Quote Builder Access' })}
                    className="text-[11px] font-bold px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 rounded-lg shadow-2xs transition-colors cursor-pointer"
                  >
                    - Revoke Quote Builder
                  </button>

                  <button
                    onClick={() => setBulkActionConfirm({ action: 'GRANT_CMS', label: 'Grant CMS Access' })}
                    className="text-[11px] font-bold px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-300 rounded-lg shadow-2xs transition-colors cursor-pointer"
                  >
                    + Grant CMS Access
                  </button>

                  <button
                    onClick={() => setBulkActionConfirm({ action: 'REVOKE_CMS', label: 'Revoke CMS Access' })}
                    className="text-[11px] font-bold px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 rounded-lg shadow-2xs transition-colors cursor-pointer"
                  >
                    - Revoke CMS Access
                  </button>

                  <button
                    onClick={() => setBulkActionConfirm({ action: 'ROLE_DEFAULTS', label: 'Reset to Role Defaults' })}
                    className="text-[11px] font-bold px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg shadow-2xs transition-colors cursor-pointer"
                  >
                    Reset Defaults
                  </button>

                  <button
                    onClick={() => setSelectedUserIds([])}
                    className="text-[11px] text-slate-500 hover:text-slate-800 px-2 py-1 font-semibold cursor-pointer"
                  >
                    Deselect All
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* User Permissions Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={filteredUsers.length > 0 && selectedUserIds.length === filteredUsers.length}
                      onChange={() => handleSelectAll(filteredUsers)}
                      className="rounded text-[#00C6A6] focus:ring-0 w-3.5 h-3.5"
                    />
                  </th>
                  <th className="py-3 px-3">User & Organization</th>
                  <th className="py-3 px-3">Role & Type</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Quote Builder Access</th>
                  <th className="py-3 px-3">CMS Modules Access</th>
                  <th className="py-3 px-4 text-right">Permission Profile</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredUsers.map(u => {
                  const isMaster = isMasterAdmin(u);
                  const isSelected = selectedUserIds.includes(u.id);
                  const p = u.permissions || getDefaultPermissionsForRole(u.role);
                  const b2bAllowed = p.b2bQuoteBuilderAccess || (p.b2bQuoteBuilderAccess === undefined && (u.role === 'B2B_AGENT' || u.role === 'AGENT' || u.role === 'ADMIN'));
                  const buyerAllowed = p.buyerQuoteBuilderAccess || (p.buyerQuoteBuilderAccess === undefined && (u.role === 'BUYER' || u.role === 'ADMIN'));
                  const cmsAllowed = p.canAccessCMS || (p.canAccessCMS === undefined && (u.role === 'ADMIN' || u.role === 'TEAM_MEMBER'));

                  return (
                    <tr 
                      key={u.id} 
                      className={`hover:bg-slate-50/70 transition-colors ${isSelected ? 'bg-indigo-50/30' : ''}`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(u.id)}
                          className="rounded text-[#00C6A6] focus:ring-0 w-3.5 h-3.5"
                        />
                      </td>

                      {/* User Info */}
                      <td className="py-3 px-3">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center font-bold text-slate-700 text-xs shrink-0">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                              <span>{u.name}</span>
                              {isMaster && (
                                <span className="bg-amber-100 text-amber-800 text-[9px] font-black px-1.5 py-0.2 rounded-sm uppercase tracking-wide">
                                  Master
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400">{u.email}</div>
                            {(u.agencyName || u.companyName) && (
                              <div className="text-[10px] text-slate-500 flex items-center space-x-1 mt-0.5">
                                <Building className="w-3 h-3 text-slate-400" />
                                <span>{u.agencyName || u.companyName}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Role & Category */}
                      <td className="py-3 px-3">
                        <div className="space-y-1">
                          <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            u.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' :
                            u.role === 'TEAM_MEMBER' || u.role === 'DMC_STAFF' ? 'bg-blue-100 text-blue-800' :
                            u.role === 'B2B_AGENT' || u.role === 'AGENT' ? 'bg-emerald-100 text-emerald-800' :
                            'bg-slate-100 text-slate-800'
                          }`}>
                            {u.role}
                          </span>
                          <div className="text-[10px] font-medium text-slate-400">
                            {u.category || (u.role === 'ADMIN' || u.role === 'TEAM_MEMBER' ? 'INTERNAL' : 'EXTERNAL')}
                          </div>
                        </div>
                      </td>

                      {/* Account Status */}
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          (u.approvalStatus || 'APPROVED') === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          u.approvalStatus === 'PENDING' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            (u.approvalStatus || 'APPROVED') === 'APPROVED' ? 'bg-emerald-500' :
                            u.approvalStatus === 'PENDING' ? 'bg-amber-500' : 'bg-rose-500'
                          }`}></span>
                          <span>{u.approvalStatus || 'APPROVED'}</span>
                        </span>
                      </td>

                      {/* Quote Builder Access Indicators */}
                      <td className="py-3 px-3">
                        <div className="flex flex-col space-y-1 min-w-[140px]">
                          <div className="flex items-center space-x-1.5">
                            <span className={`w-2 h-2 rounded-full ${b2bAllowed ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                            <span className={`text-[11px] ${b2bAllowed ? 'font-bold text-slate-800' : 'text-slate-400'}`}>
                              B2B Builder: {b2bAllowed ? 'Allowed' : 'Off'}
                            </span>
                          </div>
                          <div className="flex items-center space-x-1.5">
                            <span className={`w-2 h-2 rounded-full ${buyerAllowed ? 'bg-indigo-500' : 'bg-slate-300'}`} />
                            <span className={`text-[11px] ${buyerAllowed ? 'font-bold text-slate-800' : 'text-slate-400'}`}>
                              Buyer Builder: {buyerAllowed ? 'Allowed' : 'Off'}
                            </span>
                          </div>
                          {p.canViewWholesaleNetRates && (
                            <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.5 rounded w-fit">
                              Wholesale Net Rates
                            </span>
                          )}
                        </div>
                      </td>

                      {/* CMS Modules Access Summary */}
                      <td className="py-3 px-3">
                        <div className="space-y-1 min-w-[160px]">
                          <div className="flex items-center space-x-1.5">
                            <span className={`w-2 h-2 rounded-full ${cmsAllowed ? 'bg-indigo-600' : 'bg-slate-300'}`} />
                            <span className={`text-[11px] font-bold ${cmsAllowed ? 'text-indigo-900' : 'text-slate-400'}`}>
                              CMS Portal: {cmsAllowed ? 'ACTIVE' : 'LOCKED'}
                            </span>
                          </div>
                          {cmsAllowed && (
                            <div className="flex items-center space-x-1 text-[9px] font-mono">
                              <span className={`px-1 rounded ${p.cmsOperations?.enabled !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'}`}>Ops</span>
                              <span className={`px-1 rounded ${p.cmsContent?.enabled !== false ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-400'}`}>Content</span>
                              <span className={`px-1 rounded ${p.cmsFinance?.enabled !== false ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-400'}`}>Finance</span>
                              <span className={`px-1 rounded ${p.cmsSystem?.enabled !== false ? 'bg-cyan-100 text-cyan-800' : 'bg-slate-100 text-slate-400'}`}>Sys</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleOpenPermissionModal(u)}
                            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900 hover:bg-[#00C6A6] text-white rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer group"
                          >
                            <Settings2 className="w-3.5 h-3.5 text-[#00E5C0] group-hover:text-white" />
                            <span>Manage Permissions</span>
                          </button>
                          <button
                            onClick={() => setDeleteTarget({ id: u.id, name: u.name, email: u.email, role: u.role, status: u.approvalStatus })}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                            title="Delete or Deactivate User"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400 text-xs">
                      No users match the active search and access filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: USER APPROVAL & SEGREGATION (Margin control & rapid approval) */}
      {currentSectionTab === 'USERS_ACCESS' && (
        <div className="space-y-6">

          {/* Quick Segregation Controls & Default Margins Bar */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <Percent className="w-4 h-4 text-[#00C6A6]" />
                <span>Global Commercial Margin Defaults</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Set baseline gross margins applied when approving new direct buyers and B2B travel partners.
              </p>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold text-slate-600">Buyer %:</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={defaultBuyerMargin !== undefined && !Number.isNaN(defaultBuyerMargin) ? defaultBuyerMargin : ''}
                  onChange={e => setDefaultBuyerMargin(Number(e.target.value))}
                  className="w-16 p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-center font-mono font-bold text-xs"
                />
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold text-slate-600">Agent %:</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={defaultAgentMargin !== undefined && !Number.isNaN(defaultAgentMargin) ? defaultAgentMargin : ''}
                  onChange={e => setDefaultAgentMargin(Number(e.target.value))}
                  className="w-16 p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-center font-mono font-bold text-xs"
                />
              </div>

              <button
                onClick={handleApplyGlobalMargins}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Apply Across All
              </button>
            </div>
          </div>

          {/* Segregation Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter users..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none"
                />
              </div>

              <div className="flex items-center space-x-2">
                <select
                  value={selectedStatus}
                  onChange={e => setSelectedStatus(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 rounded-xl px-3 py-1.5"
                >
                  <option value="ALL">All Status</option>
                  <option value="PENDING">Pending Review</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-3">Role Tier</th>
                    <th className="py-3 px-3">Margin Parameters</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Approval Decision</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredUsers.map(userItem => {
                    const status = userItem.approvalStatus || 'APPROVED';
                    return (
                      <tr key={userItem.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{userItem.name}</div>
                          <div className="text-[11px] text-slate-400">{userItem.email}</div>
                          {userItem.agencyName && (
                            <div className="text-[10px] text-slate-500">{userItem.agencyName}</div>
                          )}
                        </td>

                        <td className="py-3 px-3">
                          <select
                            value={userItem.role}
                            onChange={e => handleRoleChange(userItem.id, e.target.value as UserRole)}
                            className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg p-1 text-slate-800"
                          >
                            <option value="B2B_AGENT">B2B Travel Agent</option>
                            <option value="BUYER">Direct Buyer</option>
                            <option value="TEAM_MEMBER">Internal Staff</option>
                            <option value="ADMIN">Administrator</option>
                          </select>
                        </td>

                        <td className="py-3 px-3">
                          <div className="flex items-center space-x-3 text-xs">
                            <label className="flex items-center space-x-1">
                              <span className="text-slate-400 text-[11px]">Buyer:</span>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={userItem.customBuyerMarginPercent ?? 25}
                                onChange={e => handleMarginChange(userItem.id, 'customBuyerMarginPercent', Number(e.target.value))}
                                className="w-12 text-center p-1 bg-slate-50 border border-slate-200 rounded font-mono text-xs font-bold"
                              />
                              <span className="text-slate-400 text-[10px]">%</span>
                            </label>

                            <label className="flex items-center space-x-1">
                              <span className="text-slate-400 text-[11px]">Agent:</span>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={userItem.customAgentMarginPercent ?? 10}
                                onChange={e => handleMarginChange(userItem.id, 'customAgentMarginPercent', Number(e.target.value))}
                                className="w-12 text-center p-1 bg-slate-50 border border-slate-200 rounded font-mono text-xs font-bold"
                              />
                              <span className="text-slate-400 text-[10px]">%</span>
                            </label>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <span className={`inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            status === 'PENDING' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                            'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            <span>{status}</span>
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => handleOpenPermissionModal(userItem)}
                              className="px-2.5 py-1.5 text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg font-semibold transition-colors cursor-pointer"
                            >
                              Profile
                            </button>

                            {status !== 'APPROVED' && (
                              <button
                                onClick={() => handleApprove(userItem)}
                                className="px-3 py-1.5 text-xs text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg font-bold transition-colors cursor-pointer"
                              >
                                Approve
                              </button>
                            )}

                            {status !== 'REJECTED' && (
                              <button
                                onClick={() => handleReject(userItem)}
                                className="px-3 py-1.5 text-xs text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg font-bold transition-colors cursor-pointer"
                              >
                                {status === 'PENDING' ? 'Reject / Request Info' : 'Revoke'}
                              </button>
                            )}

                            {(() => {
                              const isCurrentUser = Boolean(
                                (currentUser?.id && userItem.id === currentUser.id) ||
                                (currentUser?.email && userItem.email && currentUser.email.toLowerCase().trim() === userItem.email.toLowerCase().trim())
                              );
                              const otherAdminsCount = users.filter(u => 
                                u.role === 'ADMIN' && 
                                u.id !== userItem.id && 
                                !db.isEntityDeleted(u.id, 'User') && 
                                !db.isEntityDeleted(u.id, 'users')
                              ).length;
                              const isSoleAdmin = userItem.role === 'ADMIN' && otherAdminsCount === 0;

                              if (isCurrentUser) {
                                return (
                                  <span title="Your active Admin account (Self-deletion prohibited)" className="inline-block p-1.5 text-slate-300 cursor-not-allowed opacity-40">
                                    <Trash2 className="w-4 h-4" />
                                  </span>
                                );
                              }

                              if (isSoleAdmin) {
                                return (
                                  <span title="Sole active Administrator (Protected from deletion)" className="inline-block p-1.5 text-amber-400/60 cursor-not-allowed opacity-60">
                                    <Trash2 className="w-4 h-4" />
                                  </span>
                                );
                              }

                              return (
                                <button
                                  onClick={() => setDeleteTarget({ id: userItem.id, name: userItem.name, email: userItem.email, role: userItem.role, status: status })}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Delete or Deactivate Account"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              );
                            })()}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: CORPORATE COMPANIES & TRADE PARTNERS DIRECTORY */}
      {currentSectionTab === 'COMPANIES' && (
        <CompanyManagementView onOpenUserModal={handleOpenPermissionModal} />
      )}

      {/* Bulk Operation Confirmation Modal */}
      {bulkActionConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                <AlertTriangle className="w-5 h-5 text-indigo-700" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Confirm Bulk Permission Action</h4>
                <p className="text-xs text-slate-500">
                  Are you sure you want to execute "{bulkActionConfirm.label}"?
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-700 border border-slate-200">
              <div className="font-semibold mb-1">
                Affected Users ({selectedUserIds.length}):
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1 text-[11px] text-slate-600">
                {users.filter(u => selectedUserIds.includes(u.id)).map(u => (
                  <div key={u.id} className="truncate">• {u.name} ({u.email})</div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setBulkActionConfirm(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteBulkAction}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl cursor-pointer shadow-xs"
              >
                Confirm & Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Permission Profile Modal */}
      <UserPermissionModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedUserForModal(null);
        }}
        user={selectedUserForModal}
        onSave={handleSaveUserFromModal}
        currentUser={currentUser}
        allUsers={users}
      />

      {/* Delete / Deactivate Confirmation Modal */}
      {deleteTarget && (
        <DeleteConfirmModal
          isOpen={Boolean(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          onSuccess={() => {
            setDeleteTarget(null);
            refreshUsers();
          }}
          entityType="User"
          recordId={deleteTarget.id}
          recordTitle={deleteTarget.name}
          user={currentUser}
          extraDetails={{
            email: deleteTarget.email,
            role: deleteTarget.role,
            status: deleteTarget.status
          }}
        />
      )}

      {/* Account Rejection & Additional Requirements Modal */}
      {rejectionTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded-lg bg-rose-50 text-rose-600">
                    <ShieldAlert className="w-4 h-4" />
                  </span>
                  <h3 className="font-bold text-slate-900 text-base">
                    Verification Review: Additional Requirements Needed
                  </h3>
                </div>
                <p className="text-xs text-slate-500">
                  Reject submission and dispatch automated notification with requirements to partner.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRejectionTargetUser(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1">
              <div className="font-semibold text-slate-800">{rejectionTargetUser.name}</div>
              <div className="text-slate-500 font-mono">{rejectionTargetUser.email}</div>
              {rejectionTargetUser.agencyName && (
                <div className="text-slate-600 font-medium">{rejectionTargetUser.agencyName}</div>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800">
                Review Notes / Feedback (Sent in email) *
              </label>
              <textarea
                rows={3}
                value={rejectionNotes}
                onChange={e => setRejectionNotes(e.target.value)}
                placeholder="Specify reasons why additional details or verification documents are required..."
                className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#00C6A6]"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800">
                Required Documents / Checklist Checklist
              </label>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {[
                  'Valid government-issued travel trade license or IATA/ABTA registration certificate',
                  'Official company tax identifier (GSTIN / VAT / Corporation Tax)',
                  'Verified commercial office billing address',
                  'Authorized signatory commercial director proof',
                  'Commercial tour operator liability insurance'
                ].map(item => {
                  const isChecked = rejectionRequirements.includes(item);
                  return (
                    <label
                      key={item}
                      className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200/80 hover:bg-slate-100/70 cursor-pointer text-xs text-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setRejectionRequirements(prev => prev.filter(r => r !== item));
                          } else {
                            setRejectionRequirements(prev => [...prev, item]);
                          }
                        }}
                        className="mt-0.5 rounded text-[#00C6A6] focus:ring-[#00C6A6]"
                      />
                      <span>{item}</span>
                    </label>
                  );
                })}
              </div>

              {/* Add custom requirement */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  placeholder="Add custom required item..."
                  value={customRequirementInput}
                  onChange={e => setCustomRequirementInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && customRequirementInput.trim()) {
                      e.preventDefault();
                      setRejectionRequirements(prev => [...prev, customRequirementInput.trim()]);
                      setCustomRequirementInput('');
                    }
                  }}
                  className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (customRequirementInput.trim()) {
                      setRejectionRequirements(prev => [...prev, customRequirementInput.trim()]);
                      setCustomRequirementInput('');
                    }
                  }}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 rounded-xl text-xs font-bold text-slate-800 cursor-pointer"
                >
                  Add
                </button>
              </div>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span>
                Trigger <strong>ACCOUNT_VERIFICATION_REJECTED</strong> will execute immediately. The partner will receive this checklist and instructions to resubmit.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRejectionTargetUser(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRejectionWithRequirements}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl cursor-pointer shadow-xs"
              >
                Confirm &amp; Dispatch Email
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
