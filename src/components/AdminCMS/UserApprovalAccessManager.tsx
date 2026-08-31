import React, { useState } from 'react';
import { User, UserRole, UserApprovalStatus } from '../../types';
import { AppDatabase } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
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
  Mail, 
  Phone, 
  Globe2, 
  Save, 
  KeyRound,
  FileSpreadsheet,
  FileDown,
  Calculator,
  ShieldAlert
} from 'lucide-react';

export const UserApprovalAccessManager: React.FC = () => {
  const db = AppDatabase.getInstance();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>(() => db.getUsers());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [savedSuccess, setSavedSuccess] = useState<string | null>(null);

  // Global Default Margins
  const [defaultBuyerMargin, setDefaultBuyerMargin] = useState<number>(25);
  const [defaultAgentMargin, setDefaultAgentMargin] = useState<number>(10);

  const refreshUsers = () => {
    setUsers(db.getUsers());
  };

  const handleApprove = (targetUser: User) => {
    db.approveUser(targetUser.id, currentUser);
    refreshUsers();
    setSavedSuccess(`Approved ${targetUser.name} with full verified permissions.`);
    setTimeout(() => setSavedSuccess(null), 3000);
  };

  const handleReject = (targetUser: User) => {
    db.rejectUser(targetUser.id, currentUser);
    refreshUsers();
    setSavedSuccess(`Access rejected/revoked for ${targetUser.name}.`);
    setTimeout(() => setSavedSuccess(null), 3000);
  };

  const handleTogglePermission = (userId: string, permKey: keyof NonNullable<User['permissions']>) => {
    const target = users.find(u => u.id === userId);
    if (!target) return;

    const currentPerms = target.permissions || {
      canAccessPricingCalculator: true,
      canCreateBookings: true,
      canExportPDF: true,
      canViewWholesaleNetRates: false,
      canAccessCMS: false,
      canAccessRoster: false,
      canAccessFinancials: false,
      canManageUsers: false,
      canAddManualHotelRates: true
    };

    const updated: User = {
      ...target,
      permissions: {
        ...currentPerms,
        [permKey]: !currentPerms[permKey]
      }
    };

    db.saveUser(updated, currentUser);
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

    const isInternal = newRole === 'ADMIN' || newRole === 'TEAM_MEMBER' || newRole === 'DMC_STAFF';
    const updated: User = {
      ...target,
      role: newRole,
      category: isInternal ? 'INTERNAL' : 'EXTERNAL',
      permissions: {
        canAccessPricingCalculator: true,
        canCreateBookings: true,
        canExportPDF: true,
        canViewWholesaleNetRates: isInternal || newRole === 'B2B_AGENT',
        canAccessCMS: isInternal,
        canAccessRoster: isInternal,
        canAccessFinancials: newRole === 'ADMIN',
        canManageUsers: newRole === 'ADMIN',
        canAddManualHotelRates: true
      }
    };

    db.saveUser(updated, currentUser);
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

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.agencyName && u.agencyName.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesRole = selectedRole === 'ALL' || u.role === selectedRole;
    const userStatus = u.approvalStatus || 'APPROVED';
    const matchesStatus = selectedStatus === 'ALL' || userStatus === selectedStatus;

    return matchesSearch && matchesRole && matchesStatus;
  });

  const pendingCount = users.filter(u => u.approvalStatus === 'PENDING').length;
  const buyerCount = users.filter(u => u.role === 'BUYER').length;
  const agentCount = users.filter(u => u.role === 'B2B_AGENT' || u.role === 'AGENT').length;
  const internalCount = users.filter(u => u.category === 'INTERNAL' || u.role === 'ADMIN' || u.role === 'TEAM_MEMBER').length;

  return (
    <div id="user-approval-segregation-manager" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2 text-[#00C6A6] text-xs font-bold uppercase tracking-wider mb-1">
            <Lock className="w-4 h-4" />
            <span>Admin-Only Security & Segregation</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">User Approval & Segregation Control Panel</h2>
          <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
            Control external Buyer vs. B2B Travel Agent access, approve/reject registrations, assign role permissions, and customize individual client margin parameters.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {savedSuccess && (
            <span className="inline-flex items-center space-x-1.5 text-emerald-700 bg-emerald-50 text-xs font-semibold px-3 py-1.5 rounded-lg border border-emerald-200">
              <CheckCircle2 className="w-4 h-4" />
              <span>{savedSuccess}</span>
            </span>
          )}
          {pendingCount > 0 && (
            <span className="inline-flex items-center space-x-1.5 bg-amber-500 text-slate-950 font-bold px-3 py-1.5 rounded-xl text-xs shadow-xs animate-pulse">
              <Clock className="w-3.5 h-3.5" />
              <span>{pendingCount} Pending Approvals</span>
            </span>
          )}
        </div>
      </div>

      {/* KPI Segregation Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Pending Registrations</div>
          <div className="text-2xl font-bold text-amber-600 font-mono mt-1">{pendingCount}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Requires Admin decision</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">External Direct Buyers</div>
          <div className="text-2xl font-bold text-indigo-600 font-mono mt-1">{buyerCount}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Standard gross margin tier</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">B2B Travel Agents</div>
          <div className="text-2xl font-bold text-[#008972] font-mono mt-1">{agentCount}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Wholesale net tariffs access</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Internal Operations Team</div>
          <div className="text-2xl font-bold text-slate-800 font-mono mt-1">{internalCount}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Admin & Ground Staff</div>
        </div>
      </div>

      {/* Separate Margin Policy Configuration */}
      <div className="bg-slate-900 text-white p-5 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-5 shadow-sm">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-[#00C6A6]/20 border border-[#00C6A6]/40 flex items-center justify-center text-[#00E5C0] shrink-0">
            <Percent className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#00E5C0]">Default Segregated Margin Policy</h4>
            <p className="text-xs text-slate-300 mt-0.5">
              Set standard baseline margin percentages for Direct Buyers vs B2B Travel Agents. Tax is calculated strictly on the resultant margin.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
            <span className="text-[11px] text-slate-300 font-medium">Buyer Margin:</span>
            <input
              type="number"
              min="0"
              max="100"
              value={defaultBuyerMargin}
              onChange={e => setDefaultBuyerMargin(Number(e.target.value))}
              className="w-16 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-white font-mono text-xs text-center font-bold"
            />
            <span className="text-xs text-slate-400 font-bold">%</span>
          </div>

          <div className="flex items-center space-x-2 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
            <span className="text-[11px] text-slate-300 font-medium">B2B Agent Margin:</span>
            <input
              type="number"
              min="0"
              max="100"
              value={defaultAgentMargin}
              onChange={e => setDefaultAgentMargin(Number(e.target.value))}
              className="w-16 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-white font-mono text-xs text-center font-bold"
            />
            <span className="text-xs text-slate-400 font-bold">%</span>
          </div>

          <button
            onClick={handleApplyGlobalMargins}
            className="px-4 py-2 bg-[#00C6A6] hover:bg-[#008972] text-slate-950 font-bold text-xs rounded-xl transition-all shadow-xs cursor-pointer"
          >
            Apply Baseline Margins
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-4 rounded-xl border border-slate-200 text-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search user name, email, agency..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#00C6A6]"
          />
        </div>

        <div>
          <select
            value={selectedRole}
            onChange={e => setSelectedRole(e.target.value)}
            className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#00C6A6]"
          >
            <option value="ALL">All User Roles</option>
            <option value="BUYER">Direct Buyer (External)</option>
            <option value="B2B_AGENT">B2B Travel Agent (External)</option>
            <option value="ADMIN">DMC Admin (Internal)</option>
            <option value="TEAM_MEMBER">Operations Staff (Internal)</option>
          </select>
        </div>

        <div>
          <select
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#00C6A6]"
          >
            <option value="ALL">All Approval Statuses</option>
            <option value="PENDING">Pending Review (Action Required)</option>
            <option value="APPROVED">Approved & Verified</option>
            <option value="REJECTED">Rejected / Suspended</option>
          </select>
        </div>
      </div>

      {/* User Segregation & Approval Roster */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3.5 px-4">User & Agency Details</th>
                <th className="py-3.5 px-3">Role Segregation</th>
                <th className="py-3.5 px-3">Approval Status</th>
                <th className="py-3.5 px-3">Custom Margins</th>
                <th className="py-3.5 px-3">Internal Function Access Permissions</th>
                <th className="py-3.5 px-4 text-right">Admin Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map(userItem => {
                const status = userItem.approvalStatus || 'APPROVED';
                const perms = userItem.permissions || {};

                return (
                  <tr key={userItem.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* User & Agency */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs">
                          {userItem.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-xs flex items-center space-x-1.5">
                            <span>{userItem.name}</span>
                            <span className="text-[10px] font-mono text-slate-400 font-normal">({userItem.category || 'EXTERNAL'})</span>
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center space-x-1 mt-0.5">
                            <Mail className="w-3 h-3 text-slate-400" />
                            <span>{userItem.email}</span>
                          </div>
                          {userItem.agencyName && (
                            <div className="text-[10px] text-slate-400 flex items-center space-x-1 mt-0.5">
                              <Building className="w-3 h-3 text-slate-400" />
                              <span>{userItem.agencyName} ({userItem.country || 'Global'})</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Role Segregation */}
                    <td className="py-3.5 px-3">
                      <select
                        value={userItem.role}
                        onChange={e => handleRoleChange(userItem.id, e.target.value as UserRole)}
                        className="py-1 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                      >
                        <option value="BUYER">Buyer (Direct Client)</option>
                        <option value="B2B_AGENT">B2B Travel Agent</option>
                        <option value="ADMIN">DMC Admin (Full Access)</option>
                        <option value="TEAM_MEMBER">Operations Staff</option>
                      </select>
                    </td>

                    {/* Approval Status */}
                    <td className="py-3.5 px-3">
                      {status === 'APPROVED' && (
                        <span className="inline-flex items-center space-x-1 text-emerald-700 bg-emerald-50 text-[11px] font-bold px-2.5 py-1 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approved</span>
                        </span>
                      )}
                      {status === 'PENDING' && (
                        <span className="inline-flex items-center space-x-1 text-amber-700 bg-amber-50 text-[11px] font-bold px-2.5 py-1 rounded-full border border-amber-200 animate-pulse">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Pending Approval</span>
                        </span>
                      )}
                      {status === 'REJECTED' && (
                        <span className="inline-flex items-center space-x-1 text-rose-700 bg-rose-50 text-[11px] font-bold px-2.5 py-1 rounded-full border border-rose-200">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Access Rejected</span>
                        </span>
                      )}
                    </td>

                    {/* Custom Margins */}
                    <td className="py-3.5 px-3">
                      <div className="space-y-1 text-[11px]">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-slate-500 w-12">Buyer %:</span>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={userItem.customBuyerMarginPercent !== undefined ? userItem.customBuyerMarginPercent : 25}
                            onChange={e => handleMarginChange(userItem.id, 'customBuyerMarginPercent', Number(e.target.value))}
                            className="w-14 py-0.5 px-1.5 bg-slate-50 border border-slate-200 rounded font-mono text-center font-bold text-slate-800"
                          />
                        </div>
                        <div className="flex items-center space-x-1.5">
                          <span className="text-slate-500 w-12">Agent %:</span>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={userItem.customAgentMarginPercent !== undefined ? userItem.customAgentMarginPercent : 10}
                            onChange={e => handleMarginChange(userItem.id, 'customAgentMarginPercent', Number(e.target.value))}
                            className="w-14 py-0.5 px-1.5 bg-slate-50 border border-slate-200 rounded font-mono text-center font-bold text-slate-800"
                          />
                        </div>
                      </div>
                    </td>

                    {/* Internal Function Access Permissions */}
                    <td className="py-3.5 px-3">
                      <div className="grid grid-cols-2 gap-1.5 min-w-[240px]">
                        <label className="flex items-center space-x-1.5 cursor-pointer text-[10px]">
                          <input
                            type="checkbox"
                            checked={!!perms.canAccessPricingCalculator}
                            onChange={() => handleTogglePermission(userItem.id, 'canAccessPricingCalculator')}
                            className="rounded text-[#00C6A6] focus:ring-0 w-3.5 h-3.5"
                          />
                          <span className={perms.canAccessPricingCalculator ? 'text-slate-800 font-semibold' : 'text-slate-400'}>
                            Price Calculator
                          </span>
                        </label>

                        <label className="flex items-center space-x-1.5 cursor-pointer text-[10px]">
                          <input
                            type="checkbox"
                            checked={!!perms.canViewWholesaleNetRates}
                            onChange={() => handleTogglePermission(userItem.id, 'canViewWholesaleNetRates')}
                            className="rounded text-[#00C6A6] focus:ring-0 w-3.5 h-3.5"
                          />
                          <span className={perms.canViewWholesaleNetRates ? 'text-emerald-700 font-bold' : 'text-slate-400'}>
                            Wholesale Net Rates
                          </span>
                        </label>

                        <label className="flex items-center space-x-1.5 cursor-pointer text-[10px]">
                          <input
                            type="checkbox"
                            checked={!!perms.canCreateBookings}
                            onChange={() => handleTogglePermission(userItem.id, 'canCreateBookings')}
                            className="rounded text-[#00C6A6] focus:ring-0 w-3.5 h-3.5"
                          />
                          <span className={perms.canCreateBookings ? 'text-slate-800 font-semibold' : 'text-slate-400'}>
                            Instant Booking
                          </span>
                        </label>

                        <label className="flex items-center space-x-1.5 cursor-pointer text-[10px]">
                          <input
                            type="checkbox"
                            checked={!!perms.canExportPDF}
                            onChange={() => handleTogglePermission(userItem.id, 'canExportPDF')}
                            className="rounded text-[#00C6A6] focus:ring-0 w-3.5 h-3.5"
                          />
                          <span className={perms.canExportPDF ? 'text-slate-800 font-semibold' : 'text-slate-400'}>
                            PDF Quotation
                          </span>
                        </label>

                        <label className="flex items-center space-x-1.5 cursor-pointer text-[10px]">
                          <input
                            type="checkbox"
                            checked={!!perms.canAccessCMS}
                            onChange={() => handleTogglePermission(userItem.id, 'canAccessCMS')}
                            className="rounded text-[#00C6A6] focus:ring-0 w-3.5 h-3.5"
                          />
                          <span className={perms.canAccessCMS ? 'text-indigo-700 font-bold' : 'text-slate-400'}>
                            CMS Management
                          </span>
                        </label>

                        <label className="flex items-center space-x-1.5 cursor-pointer text-[10px]">
                          <input
                            type="checkbox"
                            checked={!!perms.canAccessFinancials}
                            onChange={() => handleTogglePermission(userItem.id, 'canAccessFinancials')}
                            className="rounded text-[#00C6A6] focus:ring-0 w-3.5 h-3.5"
                          />
                          <span className={perms.canAccessFinancials ? 'text-rose-700 font-bold' : 'text-slate-400'}>
                            Financial Audit
                          </span>
                        </label>

                        <label className="flex items-center space-x-1.5 cursor-pointer text-[10px]">
                          <input
                            type="checkbox"
                            checked={perms.canAddManualHotelRates !== false}
                            onChange={() => handleTogglePermission(userItem.id, 'canAddManualHotelRates')}
                            className="rounded text-[#00C6A6] focus:ring-0 w-3.5 h-3.5"
                          />
                          <span className={perms.canAddManualHotelRates !== false ? 'text-amber-700 font-bold' : 'text-slate-400'}>
                            Manual Hotel Rates
                          </span>
                        </label>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        {status !== 'APPROVED' && (
                          <button
                            onClick={() => handleApprove(userItem)}
                            className="inline-flex items-center space-x-1 bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                            title="Approve User"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>
                        )}
                        {status !== 'REJECTED' && (
                          <button
                            onClick={() => handleReject(userItem)}
                            className="inline-flex items-center space-x-1 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                            title="Reject / Revoke Access"
                          >
                            <UserX className="w-3.5 h-3.5" />
                            <span>Revoke</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                    No users found matching the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
