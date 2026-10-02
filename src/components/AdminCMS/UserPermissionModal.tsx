import React, { useState, useEffect } from 'react';
import { 
  User, 
  UserRole, 
  UserPermissionAccess, 
  UserApprovalStatus, 
  UserCategory,
  VerificationStatus
} from '../../types';
import { 
  getDefaultPermissionsForRole, 
  isMasterAdmin, 
  canRevokeAdminPermissions 
} from '../../services/permissionEngine';
import { 
  X, 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  Check, 
  AlertCircle, 
  Lock, 
  Layers, 
  RotateCcw, 
  Save, 
  Package, 
  Compass, 
  Receipt, 
  Database, 
  Eye, 
  FileText, 
  Percent, 
  UserCheck, 
  CheckCircle2,
  Building2,
  Mail,
  Calendar,
  Copy,
  User as UserIcon,
  Briefcase,
  Phone,
  MapPin,
  Globe,
  Clock,
  ExternalLink
} from 'lucide-react';

interface UserPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onSave: (updatedUser: User, auditReason?: string) => Promise<void> | void;
  currentUser: User | null;
  allUsers: User[];
}

export const UserPermissionModal: React.FC<UserPermissionModalProps> = ({
  isOpen,
  onClose,
  user,
  onSave,
  currentUser,
  allUsers
}) => {
  const isMaster = user ? isMasterAdmin(user) : false;

  // Form State
  const [role, setRole] = useState<UserRole>(user?.role || 'B2B_AGENT');
  const [category, setCategory] = useState<UserCategory>(user?.category || ((user?.role === 'ADMIN' || user?.role === 'TEAM_MEMBER') ? 'INTERNAL' : 'EXTERNAL'));
  const [approvalStatus, setApprovalStatus] = useState<UserApprovalStatus>(user?.approvalStatus || 'APPROVED');
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>(user?.verificationStatus || (user?.approvalStatus === 'APPROVED' ? 'VERIFIED' : 'PENDING_VERIFICATION'));
  const [department, setDepartment] = useState<string>(user?.department || '');
  const [notes, setNotes] = useState<string>(user?.notes || '');
  const [copiedUid, setCopiedUid] = useState(false);

  // Personal Profile Form State
  const [firstName, setFirstName] = useState<string>(user?.firstName || '');
  const [lastName, setLastName] = useState<string>(user?.lastName || '');
  const [name, setName] = useState<string>(user?.name || '');
  const [phone, setPhone] = useState<string>(user?.phone || user?.contactNumber || '');
  const [jobTitle, setJobTitle] = useState<string>(user?.jobTitle || '');
  const [avatarUrl, setAvatarUrl] = useState<string>(user?.avatarUrl || '');
  const [bio, setBio] = useState<string>(user?.bio || '');
  const [emergencyContactPerson, setEmergencyContactPerson] = useState<string>(user?.emergencyContactPerson || '');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState<string>(user?.emergencyContactPhone || '');

  // Company Profile Form State
  const [companyName, setCompanyName] = useState<string>(user?.companyName || user?.agencyName || '');
  const [agencyName, setAgencyName] = useState<string>(user?.agencyName || user?.companyName || '');
  const [businessType, setBusinessType] = useState<string>(user?.businessType || '');
  const [companyWebsite, setCompanyWebsite] = useState<string>(user?.companyWebsite || '');
  const [companyEmail, setCompanyEmail] = useState<string>(user?.companyEmail || user?.email || '');
  const [companyPhone, setCompanyPhone] = useState<string>(user?.companyPhone || '');
  const [companyAddress, setCompanyAddress] = useState<string>(user?.companyAddress || user?.address || '');
  const [companyCity, setCompanyCity] = useState<string>(user?.companyCity || user?.city || '');
  const [companyState, setCompanyState] = useState<string>(user?.companyState || user?.state || '');
  const [companyCountry, setCompanyCountry] = useState<string>(user?.companyCountry || user?.country || 'United Kingdom');
  const [companyPostalCode, setCompanyPostalCode] = useState<string>(user?.companyPostalCode || user?.postalCode || '');
  const [taxOrGstNumber, setTaxOrGstNumber] = useState<string>(user?.taxOrGstNumber || '');
  const [iataOrAbtaNumber, setIataOrAbtaNumber] = useState<string>(user?.iataOrAbtaNumber || '');
  const [brandLogoUrl, setBrandLogoUrl] = useState<string>(user?.brandLogoUrl || user?.logoUrl || '');

  const [buyerMargin, setBuyerMargin] = useState<number>(user?.customBuyerMarginPercent ?? 25);
  const [agentMargin, setAgentMargin] = useState<number>(user?.customAgentMarginPercent ?? 10);
  const [auditReason, setAuditReason] = useState<string>('');
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'COMPANY' | 'ACCOUNT' | 'PERMISSIONS' | 'COMMERCIAL'>('PROFILE');

  // Permissions state initialized with existing or default
  const [perms, setPerms] = useState<UserPermissionAccess>(() => {
    const userRole = user?.role || 'B2B_AGENT';
    const existing = user?.permissions || {};
    const roleDefaults = getDefaultPermissionsForRole(userRole);
    return {
      ...roleDefaults,
      ...existing,
      cmsOperations: {
        ...roleDefaults.cmsOperations,
        ...(existing.cmsOperations || {})
      },
      cmsContent: {
        ...roleDefaults.cmsContent,
        ...(existing.cmsContent || {})
      },
      cmsFinance: {
        ...roleDefaults.cmsFinance,
        ...(existing.cmsFinance || {})
      },
      cmsSystem: {
        ...roleDefaults.cmsSystem,
        ...(existing.cmsSystem || {})
      }
    };
  });

  // Re-sync if user changes or modal opens
  useEffect(() => {
    if (user && isOpen) {
      setRole(user.role);
      setCategory(user.category || (user.role === 'ADMIN' || user.role === 'TEAM_MEMBER' ? 'INTERNAL' : 'EXTERNAL'));
      setApprovalStatus(user.approvalStatus || 'APPROVED');
      setVerificationStatus(user.verificationStatus || (user.approvalStatus === 'APPROVED' ? 'VERIFIED' : 'PENDING_VERIFICATION'));
      setDepartment(user.department || '');
      setNotes(user.notes || '');

      setFirstName(user.firstName || user.name?.split(' ')[0] || '');
      setLastName(user.lastName || user.name?.split(' ').slice(1).join(' ') || '');
      setName(user.name || '');
      setPhone(user.phone || user.contactNumber || '');
      setJobTitle(user.jobTitle || '');
      setAvatarUrl(user.avatarUrl || '');
      setBio(user.bio || '');
      setEmergencyContactPerson(user.emergencyContactPerson || '');
      setEmergencyContactPhone(user.emergencyContactPhone || '');

      setCompanyName(user.companyName || user.agencyName || '');
      setAgencyName(user.agencyName || user.companyName || '');
      setBusinessType(user.businessType || '');
      setCompanyWebsite(user.companyWebsite || '');
      setCompanyEmail(user.companyEmail || user.email || '');
      setCompanyPhone(user.companyPhone || '');
      setCompanyAddress(user.companyAddress || user.address || '');
      setCompanyCity(user.companyCity || user.city || '');
      setCompanyState(user.companyState || user.state || '');
      setCompanyCountry(user.companyCountry || user.country || 'United Kingdom');
      setCompanyPostalCode(user.companyPostalCode || user.postalCode || '');
      setTaxOrGstNumber(user.taxOrGstNumber || '');
      setIataOrAbtaNumber(user.iataOrAbtaNumber || '');
      setBrandLogoUrl(user.brandLogoUrl || user.logoUrl || '');

      setBuyerMargin(user.customBuyerMarginPercent ?? 25);
      setAgentMargin(user.customAgentMarginPercent ?? 10);
      setAuditReason('');
      setErrorBanner(null);

      const existing = user.permissions || {};
      const roleDefaults = getDefaultPermissionsForRole(user.role);
      setPerms({
        ...roleDefaults,
        ...existing,
        cmsOperations: {
          ...roleDefaults.cmsOperations,
          ...(existing.cmsOperations || {})
        },
        cmsContent: {
          ...roleDefaults.cmsContent,
          ...(existing.cmsContent || {})
        },
        cmsFinance: {
          ...roleDefaults.cmsFinance,
          ...(existing.cmsFinance || {})
        },
        cmsSystem: {
          ...roleDefaults.cmsSystem,
          ...(existing.cmsSystem || {})
        }
      });
    }
  }, [user, isOpen]);

  if (!isOpen || !user) return null;

  // Handle Role change: offer to load role defaults
  const handleRoleChange = (newRole: UserRole) => {
    if (isMaster && newRole !== 'ADMIN') {
      setErrorBanner('Protected: Cannot alter the role of the Primary Master Administrator.');
      return;
    }
    setRole(newRole);
    const isInternal = newRole === 'ADMIN' || newRole === 'TEAM_MEMBER' || newRole === 'DMC_STAFF';
    setCategory(isInternal ? 'INTERNAL' : 'EXTERNAL');
  };

  const handleResetToRoleDefaults = () => {
    const defaults = getDefaultPermissionsForRole(role);
    setPerms(defaults);
    setErrorBanner(null);
  };

  const handleToggleTopPermission = (key: keyof UserPermissionAccess) => {
    if (isMaster && (key === 'canAccessCMS' || key === 'canManageUsers')) {
      setErrorBanner('Protected: Cannot revoke core administrative permissions from the Primary Master Admin.');
      return;
    }
    setPerms(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Helper for operations toggles
  const handleToggleOperationSub = (key: string) => {
    setPerms(prev => {
      const currentOps = prev.cmsOperations || { enabled: true };
      return {
        ...prev,
        cmsOperations: {
          ...currentOps,
          [key]: !(currentOps as any)[key]
        }
      };
    });
  };

  // Helper for content toggles
  const handleToggleContentSub = (key: string) => {
    setPerms(prev => {
      const current = prev.cmsContent || { enabled: true };
      return {
        ...prev,
        cmsContent: {
          ...current,
          [key]: !(current as any)[key]
        }
      };
    });
  };

  // Helper for finance toggles
  const handleToggleFinanceSub = (key: string) => {
    if (isMaster && (key === 'accountManagement' || key === 'userPermissionManagement')) {
      setErrorBanner('Protected: Primary Master Admin must retain Account and Permission Management access.');
      return;
    }
    setPerms(prev => {
      const current = prev.cmsFinance || { enabled: true };
      return {
        ...prev,
        cmsFinance: {
          ...current,
          [key]: !(current as any)[key]
        }
      };
    });
  };

  // Helper for system toggles
  const handleToggleSystemSub = (key: string) => {
    setPerms(prev => {
      const current = prev.cmsSystem || { enabled: true };
      return {
        ...prev,
        cmsSystem: {
          ...current,
          [key]: !(current as any)[key]
        }
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);

    // Safeguard check
    if (user.role === 'ADMIN' && (role !== 'ADMIN' || perms.cmsFinance?.accountManagement === false || perms.canAccessCMS === false)) {
      const check = canRevokeAdminPermissions(user, allUsers);
      if (!check.canRevoke) {
        setErrorBanner(check.error || 'Cannot revoke access from the last remaining Administrator.');
        return;
      }
    }

    const finalFullName = name.trim() || `${firstName} ${lastName}`.trim() || user.name;
    const updatedUser: User = {
      ...user,
      name: finalFullName,
      displayName: finalFullName,
      firstName: firstName.trim() || undefined,
      lastName: lastName.trim() || undefined,
      phone: phone.trim() || undefined,
      contactNumber: phone.trim() || user.contactNumber,
      jobTitle: jobTitle.trim() || undefined,
      avatarUrl: avatarUrl.trim() || undefined,
      bio: bio.trim() || undefined,
      emergencyContactPerson: emergencyContactPerson.trim() || undefined,
      emergencyContactPhone: emergencyContactPhone.trim() || undefined,

      companyName: companyName.trim() || agencyName.trim() || undefined,
      agencyName: agencyName.trim() || companyName.trim() || undefined,
      businessType: businessType.trim() || undefined,
      companyWebsite: companyWebsite.trim() || undefined,
      companyEmail: companyEmail.trim() || undefined,
      companyPhone: companyPhone.trim() || undefined,
      companyAddress: companyAddress.trim() || undefined,
      companyCity: companyCity.trim() || undefined,
      companyState: companyState.trim() || undefined,
      companyCountry: companyCountry.trim() || undefined,
      country: companyCountry.trim() || undefined,
      companyPostalCode: companyPostalCode.trim() || undefined,
      taxOrGstNumber: taxOrGstNumber.trim() || undefined,
      iataOrAbtaNumber: iataOrAbtaNumber.trim() || undefined,
      brandLogoUrl: brandLogoUrl.trim() || undefined,

      role,
      category,
      approvalStatus,
      verificationStatus,
      department: department.trim() || undefined,
      notes: notes.trim() || undefined,
      customBuyerMarginPercent: Number(buyerMargin) || 0,
      customAgentMarginPercent: Number(agentMargin) || 0,
      permissions: {
        ...perms,
        canAccessPricingCalculator: perms.b2bQuoteBuilderAccess || perms.buyerQuoteBuilderAccess || false,
        canAccessCMS: perms.canAccessCMS ?? (role === 'ADMIN' || role === 'TEAM_MEMBER'),
        canAccessRoster: perms.cmsOperations?.rosterAndRoles ?? (role === 'ADMIN' || role === 'TEAM_MEMBER'),
        canAccessFinancials: perms.cmsFinance?.financials ?? (role === 'ADMIN'),
        canManageUsers: perms.cmsFinance?.accountManagement ?? (role === 'ADMIN'),
        canManagePermissions: perms.cmsFinance?.userPermissionManagement ?? (role === 'ADMIN')
      },
      updatedAt: new Date().toISOString()
    };

    try {
      setIsSubmitting(true);
      await onSave(updatedUser, auditReason.trim() || undefined);
      onClose();
    } catch (err: any) {
      setErrorBanner(err.message || 'Failed to save permissions. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 px-6 flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-[#00A88F] to-[#00E5C0] flex items-center justify-center text-slate-950 font-black text-lg shadow-md">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold text-white leading-tight">{user.name}</h3>
                {isMaster && (
                  <span className="inline-flex items-center space-x-1 bg-amber-400 text-slate-950 font-extrabold text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Master Admin</span>
                  </span>
                )}
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  approvalStatus === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                  approvalStatus === 'PENDING' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                  'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}>
                  {approvalStatus}
                </span>
              </div>
              <div className="flex items-center space-x-3 text-xs text-slate-400 mt-1">
                <span className="flex items-center space-x-1">
                  <Mail className="w-3 h-3 text-slate-500" />
                  <span>{user.email}</span>
                </span>
                {(user.agencyName || user.companyName) && (
                  <span className="flex items-center space-x-1">
                    <Building2 className="w-3 h-3 text-slate-500" />
                    <span>{user.agencyName || user.companyName}</span>
                  </span>
                )}
                <span className="flex items-center space-x-1 text-slate-500">
                  <Calendar className="w-3 h-3" />
                  <span>Joined: {user.createdAt || 'Active'}</span>
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Banner */}
        {errorBanner && (
          <div className="bg-rose-50 border-b border-rose-200 px-6 py-2.5 flex items-center justify-between text-rose-800 text-xs font-medium shrink-0">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorBanner}</span>
            </div>
            <button 
              onClick={() => setErrorBanner(null)} 
              className="text-rose-500 hover:text-rose-800 font-bold ml-2 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Navigation Subtabs */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 flex items-center justify-between shrink-0 overflow-x-auto">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setActiveTab('PROFILE')}
              className={`py-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center space-x-1.5 whitespace-nowrap ${
                activeTab === 'PROFILE'
                  ? 'border-[#00C6A6] text-[#008f77]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>Personal Profile</span>
            </button>

            <button
              onClick={() => setActiveTab('COMPANY')}
              className={`py-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center space-x-1.5 whitespace-nowrap ${
                activeTab === 'COMPANY'
                  ? 'border-[#00C6A6] text-[#008f77]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Company & Trade</span>
            </button>

            <button
              onClick={() => setActiveTab('ACCOUNT')}
              className={`py-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center space-x-1.5 whitespace-nowrap ${
                activeTab === 'ACCOUNT'
                  ? 'border-[#00C6A6] text-[#008f77]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Account & Security</span>
            </button>

            <button
              onClick={() => setActiveTab('PERMISSIONS')}
              className={`py-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center space-x-1.5 whitespace-nowrap ${
                activeTab === 'PERMISSIONS'
                  ? 'border-[#00C6A6] text-[#008f77]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Permissions Matrix</span>
            </button>

            <button
              onClick={() => setActiveTab('COMMERCIAL')}
              className={`py-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center space-x-1.5 whitespace-nowrap ${
                activeTab === 'COMMERCIAL'
                  ? 'border-[#00C6A6] text-[#008f77]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Percent className="w-3.5 h-3.5" />
              <span>Commercial Margins</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleResetToRoleDefaults}
            className="text-xs text-slate-600 hover:text-indigo-600 font-semibold flex items-center space-x-1 py-1 px-2.5 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer shrink-0 ml-4"
            title="Reset this user to default permissions defined for their role"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Role Defaults</span>
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* TAB 0: PERSONAL PROFILE */}
          {activeTab === 'PROFILE' && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
              <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm pb-2 border-b border-slate-100">
                <UserIcon className="w-4 h-4 text-[#00C6A6]" />
                <span>Personal Information & Contact Credentials</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* First Name */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">First Name</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    placeholder="e.g. John"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#00C6A6] outline-none"
                  />
                </div>

                {/* Last Name */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Last Name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    placeholder="e.g. Smith"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#00C6A6] outline-none"
                  />
                </div>

                {/* Full Name */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Full Display Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. John Smith"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#00C6A6] outline-none"
                  />
                </div>

                {/* Job Title */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Designation / Job Title</label>
                  <input
                    type="text"
                    value={jobTitle}
                    onChange={e => setJobTitle(e.target.value)}
                    placeholder="e.g. Managing Director / Senior Agent"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#00C6A6] outline-none"
                  />
                </div>

                {/* Email (Read Only Auth Identity) */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Email Address (Auth Identity)</label>
                  <input
                    type="email"
                    disabled
                    value={user.email}
                    className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-mono text-xs cursor-not-allowed"
                  />
                </div>

                {/* Phone */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Direct Contact Number / WhatsApp</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+44 7700 900077"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#00C6A6] outline-none"
                  />
                </div>

                {/* Avatar URL */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="font-bold text-slate-700">Profile Photo / Avatar URL</label>
                  <input
                    type="text"
                    value={avatarUrl}
                    onChange={e => setAvatarUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#00C6A6] outline-none"
                  />
                </div>

                {/* Bio */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="font-bold text-slate-700">Professional Bio / Profile Summary</label>
                  <textarea
                    rows={2}
                    value={bio}
                    onChange={e => setBio(e.target.value)}
                    placeholder="Travel consultant specializing in luxury bespoke journeys..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#00C6A6] outline-none"
                  />
                </div>

                {/* Emergency Contact Person */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Emergency Contact Person</label>
                  <input
                    type="text"
                    value={emergencyContactPerson}
                    onChange={e => setEmergencyContactPerson(e.target.value)}
                    placeholder="e.g. Operations Duty Manager"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#00C6A6] outline-none"
                  />
                </div>

                {/* Emergency Contact Phone */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Emergency Contact Phone</label>
                  <input
                    type="text"
                    value={emergencyContactPhone}
                    onChange={e => setEmergencyContactPhone(e.target.value)}
                    placeholder="+44 20 7946 0999"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#00C6A6] outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 0.5: COMPANY & TRADE PROFILE */}
          {activeTab === 'COMPANY' && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
              <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm pb-2 border-b border-slate-100">
                <Building2 className="w-4 h-4 text-[#00C6A6]" />
                <span>Associated Company Profile & Trade Registration</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* Company Name */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Company / Agency Name</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={e => {
                      setCompanyName(e.target.value);
                      if (!agencyName) setAgencyName(e.target.value);
                    }}
                    placeholder="e.g. Mayfair Luxury Travel Ltd"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#00C6A6] outline-none"
                  />
                </div>

                {/* Business Type */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Business Model / Type</label>
                  <input
                    type="text"
                    value={businessType}
                    onChange={e => setBusinessType(e.target.value)}
                    placeholder="e.g. Luxury Tour Operator & Concierge"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#00C6A6] outline-none"
                  />
                </div>

                {/* Company Website */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Official Website</label>
                  <input
                    type="text"
                    value={companyWebsite}
                    onChange={e => setCompanyWebsite(e.target.value)}
                    placeholder="https://mayfairtravel.co.uk"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#00C6A6] outline-none"
                  />
                </div>

                {/* Company Email */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Official Company Email</label>
                  <input
                    type="email"
                    value={companyEmail}
                    onChange={e => setCompanyEmail(e.target.value)}
                    placeholder="ops@mayfairtravel.co.uk"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#00C6A6] outline-none"
                  />
                </div>

                {/* Company Phone */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Official Company Phone</label>
                  <input
                    type="text"
                    value={companyPhone}
                    onChange={e => setCompanyPhone(e.target.value)}
                    placeholder="+44 20 7946 0912"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#00C6A6] outline-none"
                  />
                </div>

                {/* Country */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Country</label>
                  <input
                    type="text"
                    value={companyCountry}
                    onChange={e => setCompanyCountry(e.target.value)}
                    placeholder="United Kingdom"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#00C6A6] outline-none"
                  />
                </div>

                {/* City */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">City</label>
                  <input
                    type="text"
                    value={companyCity}
                    onChange={e => setCompanyCity(e.target.value)}
                    placeholder="London"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#00C6A6] outline-none"
                  />
                </div>

                {/* Postal Code */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Postal / Zip Code</label>
                  <input
                    type="text"
                    value={companyPostalCode}
                    onChange={e => setCompanyPostalCode(e.target.value)}
                    placeholder="W1J 8DJ"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#00C6A6] outline-none"
                  />
                </div>

                {/* Address */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="font-bold text-slate-700">Registered Office Address</label>
                  <input
                    type="text"
                    value={companyAddress}
                    onChange={e => setCompanyAddress(e.target.value)}
                    placeholder="14 Berkeley Square, Mayfair"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#00C6A6] outline-none"
                  />
                </div>

                {/* Tax / VAT Number */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Tax / VAT / GST Registration</label>
                  <input
                    type="text"
                    value={taxOrGstNumber}
                    onChange={e => setTaxOrGstNumber(e.target.value)}
                    placeholder="GB 982 3411 90"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#00C6A6] outline-none"
                  />
                </div>

                {/* IATA / ABTA Number */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">IATA / ABTA License Number</label>
                  <input
                    type="text"
                    value={iataOrAbtaNumber}
                    onChange={e => setIataOrAbtaNumber(e.target.value)}
                    placeholder="IATA-91283021"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#00C6A6] outline-none"
                  />
                </div>

                {/* Brand Logo URL */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="font-bold text-slate-700">Corporate Brand Logo URL</label>
                  <input
                    type="text"
                    value={brandLogoUrl}
                    onChange={e => setBrandLogoUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#00C6A6] outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: PERMISSIONS MATRIX */}
          {activeTab === 'PERMISSIONS' && (
            <div className="space-y-6">

              {/* 1. QUOTE BUILDER ACCESS SECTION */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3.5">
                  <div className="flex items-center space-x-2">
                    <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
                      <Compass className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Quote Builder Engine Access</h4>
                      <p className="text-[11px] text-slate-500">Control B2B vs Buyer quotation generation and wholesale rate visibility</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {/* B2B Quote Builder Access */}
                  <label className={`flex items-start space-x-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    perms.b2bQuoteBuilderAccess ? 'bg-emerald-50/60 border-emerald-300' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <input
                      type="checkbox"
                      checked={!!perms.b2bQuoteBuilderAccess}
                      onChange={() => handleToggleTopPermission('b2bQuoteBuilderAccess')}
                      className="mt-0.5 rounded text-[#00C6A6] focus:ring-0 w-4 h-4"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900">B2B Guided Quote Builder</div>
                      <div className="text-[11px] text-slate-500 leading-tight mt-0.5">
                        Enables full itinerary building with multi-destination modules and agent commissions.
                      </div>
                    </div>
                  </label>

                  {/* Buyer Quote Builder Access */}
                  <label className={`flex items-start space-x-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    perms.buyerQuoteBuilderAccess ? 'bg-indigo-50/60 border-indigo-300' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <input
                      type="checkbox"
                      checked={!!perms.buyerQuoteBuilderAccess}
                      onChange={() => handleToggleTopPermission('buyerQuoteBuilderAccess')}
                      className="mt-0.5 rounded text-indigo-600 focus:ring-0 w-4 h-4"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900">Buyer Direct Quote Builder</div>
                      <div className="text-[11px] text-slate-500 leading-tight mt-0.5">
                        Access for direct private clients with consumer-facing retail pricing.
                      </div>
                    </div>
                  </label>

                  {/* Wholesale Net Rates Visibility */}
                  <label className={`flex items-start space-x-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    perms.canViewWholesaleNetRates ? 'bg-amber-50/60 border-amber-300' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <input
                      type="checkbox"
                      checked={!!perms.canViewWholesaleNetRates}
                      onChange={() => handleToggleTopPermission('canViewWholesaleNetRates')}
                      className="mt-0.5 rounded text-amber-600 focus:ring-0 w-4 h-4"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900">Wholesale Net Rates Visibility</div>
                      <div className="text-[11px] text-slate-500 leading-tight mt-0.5">
                        Displays internal DMC cost base. When disabled, only Final Selling Price is shown.
                      </div>
                    </div>
                  </label>

                  {/* Instant Booking Creation */}
                  <label className={`flex items-start space-x-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    perms.canCreateBookings ? 'bg-teal-50/60 border-teal-300' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <input
                      type="checkbox"
                      checked={!!perms.canCreateBookings}
                      onChange={() => handleToggleTopPermission('canCreateBookings')}
                      className="mt-0.5 rounded text-teal-600 focus:ring-0 w-4 h-4"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900">Instant Booking Creation</div>
                      <div className="text-[11px] text-slate-500 leading-tight mt-0.5">
                        Permits locking and submitting live bookings into operational pipeline.
                      </div>
                    </div>
                  </label>

                  {/* PDF Quotation Export */}
                  <label className={`flex items-start space-x-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    perms.canExportPDF ? 'bg-slate-100 border-slate-300' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <input
                      type="checkbox"
                      checked={!!perms.canExportPDF}
                      onChange={() => handleToggleTopPermission('canExportPDF')}
                      className="mt-0.5 rounded text-slate-700 focus:ring-0 w-4 h-4"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900">PDF Quotation Export</div>
                      <div className="text-[11px] text-slate-500 leading-tight mt-0.5">
                        Allows downloading branded client PDF proposals with day-by-day itineraries.
                      </div>
                    </div>
                  </label>

                  {/* WhatsApp Quote Sharing */}
                  <label className={`flex items-start space-x-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    perms.canShareWhatsAppQuotes !== false ? 'bg-emerald-50/60 border-emerald-300' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <input
                      type="checkbox"
                      checked={perms.canShareWhatsAppQuotes !== false}
                      onChange={() => handleToggleTopPermission('canShareWhatsAppQuotes')}
                      className="mt-0.5 rounded text-emerald-600 focus:ring-0 w-4 h-4"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900">Share Quotes on WhatsApp</div>
                      <div className="text-[11px] text-slate-500 leading-tight mt-0.5">
                        Permits generating sanitized customer quotation summaries and opening direct WhatsApp chats.
                      </div>
                    </div>
                  </label>

                  {/* Manual Hotel Rates */}
                  <label className={`flex items-start space-x-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    perms.canAddManualHotelRates ? 'bg-sky-50/60 border-sky-300' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <input
                      type="checkbox"
                      checked={!!perms.canAddManualHotelRates}
                      onChange={() => handleToggleTopPermission('canAddManualHotelRates')}
                      className="mt-0.5 rounded text-sky-600 focus:ring-0 w-4 h-4"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900">Manual Hotel Rate Override</div>
                      <div className="text-[11px] text-slate-500 leading-tight mt-0.5">
                        Allows inputting custom hotel properties or non-contracted direct room rates.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* 2. CMS MASTER SWITCH */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
                      perms.canAccessCMS ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'
                    }`}>
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Admin CMS Access (Master Switch)</h4>
                      <p className="text-[11px] text-slate-500">
                        {perms.canAccessCMS 
                          ? 'User is authorized to access the CMS portal. Configure granular module permissions below.'
                          : 'User is locked out from the Admin CMS. All modules and sub-modules are inactive.'}
                      </p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!perms.canAccessCMS}
                      onChange={() => handleToggleTopPermission('canAccessCMS')}
                      disabled={isMaster}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {/* HIERARCHICAL MODULES TREE (Active when CMS is enabled) */}
                {perms.canAccessCMS && (
                  <div className="mt-5 space-y-4 pt-4 border-t border-slate-100">

                    {/* MODULE 1: OPERATIONS & INVENTORY */}
                    <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200 mb-2.5">
                        <div className="flex items-center space-x-2">
                          <Package className="w-4 h-4 text-emerald-600" />
                          <span className="text-xs font-bold text-slate-900">1. Operations & Inventory Module</span>
                        </div>
                        <label className="flex items-center space-x-1.5 cursor-pointer text-xs font-semibold text-slate-700">
                          <span>Module Master:</span>
                          <input
                            type="checkbox"
                            checked={perms.cmsOperations?.enabled !== false}
                            onChange={() => setPerms(p => ({
                              ...p,
                              cmsOperations: { ...(p.cmsOperations || { enabled: true }), enabled: !p.cmsOperations?.enabled }
                            }))}
                            className="rounded text-emerald-600 focus:ring-0 w-4 h-4"
                          />
                        </label>
                      </div>

                      {perms.cmsOperations?.enabled !== false ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          <label className="flex items-center space-x-2 text-[11px] p-2 bg-white rounded-lg border border-slate-200 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={perms.cmsOperations?.productManagement !== false}
                              onChange={() => handleToggleOperationSub('productManagement')}
                              className="rounded text-emerald-600 w-3.5 h-3.5"
                            />
                            <span className="text-slate-800">Products & Inventory</span>
                          </label>

                          <label className="flex items-center space-x-2 text-[11px] p-2 bg-white rounded-lg border border-slate-200 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={perms.cmsOperations?.hotelManagement !== false}
                              onChange={() => handleToggleOperationSub('hotelManagement')}
                              className="rounded text-emerald-600 w-3.5 h-3.5"
                            />
                            <span className="text-slate-800">Hotel Management</span>
                          </label>

                          <label className="flex items-center space-x-2 text-[11px] p-2 bg-white rounded-lg border border-slate-200 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={perms.cmsOperations?.packageManagement !== false}
                              onChange={() => handleToggleOperationSub('packageManagement')}
                              className="rounded text-emerald-600 w-3.5 h-3.5"
                            />
                            <span className="text-slate-800">Package Circuits</span>
                          </label>

                          <label className="flex items-center space-x-2 text-[11px] p-2 bg-white rounded-lg border border-slate-200 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={perms.cmsOperations?.bookingManagement !== false}
                              onChange={() => handleToggleOperationSub('bookingManagement')}
                              className="rounded text-emerald-600 w-3.5 h-3.5"
                            />
                            <span className="text-slate-800">Bookings & Vouchers</span>
                          </label>

                          <label className="flex items-center space-x-2 text-[11px] p-2 bg-white rounded-lg border border-slate-200 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={perms.cmsOperations?.leadManagement !== false}
                              onChange={() => handleToggleOperationSub('leadManagement')}
                              className="rounded text-emerald-600 w-3.5 h-3.5"
                            />
                            <span className="text-slate-800">Leads CRM & Quotes</span>
                          </label>

                          <label className="flex items-center space-x-2 text-[11px] p-2 bg-white rounded-lg border border-slate-200 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={perms.cmsOperations?.rosterAndRoles !== false}
                              onChange={() => handleToggleOperationSub('rosterAndRoles')}
                              className="rounded text-emerald-600 w-3.5 h-3.5"
                            />
                            <span className="text-slate-800">Staff Ops Roster</span>
                          </label>
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-400 italic py-1">
                          Operations module is turned OFF for this user. Sub-modules disabled.
                        </div>
                      )}
                    </div>

                    {/* MODULE 2: CONTENT & DESTINATIONS */}
                    <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200 mb-2.5">
                        <div className="flex items-center space-x-2">
                          <Compass className="w-4 h-4 text-indigo-600" />
                          <span className="text-xs font-bold text-slate-900">2. Content & Destinations Module</span>
                        </div>
                        <label className="flex items-center space-x-1.5 cursor-pointer text-xs font-semibold text-slate-700">
                          <span>Module Master:</span>
                          <input
                            type="checkbox"
                            checked={perms.cmsContent?.enabled !== false}
                            onChange={() => setPerms(p => ({
                              ...p,
                              cmsContent: { ...(p.cmsContent || { enabled: true }), enabled: !p.cmsContent?.enabled }
                            }))}
                            className="rounded text-indigo-600 focus:ring-0 w-4 h-4"
                          />
                        </label>
                      </div>

                      {perms.cmsContent?.enabled !== false ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          <label className="flex items-center space-x-2 text-[11px] p-2 bg-white rounded-lg border border-slate-200 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={perms.cmsContent?.destinationManagement !== false}
                              onChange={() => handleToggleContentSub('destinationManagement')}
                              className="rounded text-indigo-600 w-3.5 h-3.5"
                            />
                            <span className="text-slate-800">Destinations & City Hubs</span>
                          </label>

                          <label className="flex items-center space-x-2 text-[11px] p-2 bg-white rounded-lg border border-slate-200 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={perms.cmsContent?.pageManagement !== false}
                              onChange={() => handleToggleContentSub('pageManagement')}
                              className="rounded text-indigo-600 w-3.5 h-3.5"
                            />
                            <span className="text-slate-800">Page & Navigation Builder</span>
                          </label>

                          <label className="flex items-center space-x-2 text-[11px] p-2 bg-white rounded-lg border border-slate-200 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={perms.cmsContent?.marketingManagement !== false}
                              onChange={() => handleToggleContentSub('marketingManagement')}
                              className="rounded text-indigo-600 w-3.5 h-3.5"
                            />
                            <span className="text-slate-800">Promos, Reviews & Blogs</span>
                          </label>
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-400 italic py-1">
                          Content module is turned OFF for this user. Sub-modules disabled.
                        </div>
                      )}
                    </div>

                    {/* MODULE 3: FINANCE & ADMINISTRATION */}
                    <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200 mb-2.5">
                        <div className="flex items-center space-x-2">
                          <Receipt className="w-4 h-4 text-rose-600" />
                          <span className="text-xs font-bold text-slate-900">3. Finance & Administration Module</span>
                        </div>
                        <label className="flex items-center space-x-1.5 cursor-pointer text-xs font-semibold text-slate-700">
                          <span>Module Master:</span>
                          <input
                            type="checkbox"
                            checked={perms.cmsFinance?.enabled !== false}
                            onChange={() => setPerms(p => ({
                              ...p,
                              cmsFinance: { ...(p.cmsFinance || { enabled: true }), enabled: !p.cmsFinance?.enabled }
                            }))}
                            className="rounded text-rose-600 focus:ring-0 w-4 h-4"
                          />
                        </label>
                      </div>

                      {perms.cmsFinance?.enabled !== false ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          <label className="flex items-center space-x-2 text-[11px] p-2 bg-white rounded-lg border border-slate-200 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={perms.cmsFinance?.accountManagement !== false}
                              onChange={() => handleToggleFinanceSub('accountManagement')}
                              disabled={isMaster}
                              className="rounded text-rose-600 w-3.5 h-3.5"
                            />
                            <span className="text-slate-800">User Approvals & Accounts</span>
                          </label>

                          <label className="flex items-center space-x-2 text-[11px] p-2 bg-white rounded-lg border border-slate-200 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={perms.cmsFinance?.userPermissionManagement !== false}
                              onChange={() => handleToggleFinanceSub('userPermissionManagement')}
                              disabled={isMaster}
                              className="rounded text-rose-600 w-3.5 h-3.5"
                            />
                            <span className="text-slate-800">RBAC & Permissions Editor</span>
                          </label>

                          <label className="flex items-center space-x-2 text-[11px] p-2 bg-white rounded-lg border border-slate-200 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={perms.cmsFinance?.financials !== false}
                              onChange={() => handleToggleFinanceSub('financials')}
                              className="rounded text-rose-600 w-3.5 h-3.5"
                            />
                            <span className="text-slate-800">Financial Audit & Invoicing</span>
                          </label>
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-400 italic py-1">
                          Finance module is turned OFF for this user. Sub-modules disabled.
                        </div>
                      )}
                    </div>

                    {/* MODULE 4: SYSTEM & AUDIT */}
                    <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200 mb-2.5">
                        <div className="flex items-center space-x-2">
                          <Database className="w-4 h-4 text-cyan-600" />
                          <span className="text-xs font-bold text-slate-900">4. System & Audit Module</span>
                        </div>
                        <label className="flex items-center space-x-1.5 cursor-pointer text-xs font-semibold text-slate-700">
                          <span>Module Master:</span>
                          <input
                            type="checkbox"
                            checked={perms.cmsSystem?.enabled !== false}
                            onChange={() => setPerms(p => ({
                              ...p,
                              cmsSystem: { ...(p.cmsSystem || { enabled: true }), enabled: !p.cmsSystem?.enabled }
                            }))}
                            className="rounded text-cyan-600 focus:ring-0 w-4 h-4"
                          />
                        </label>
                      </div>

                      {perms.cmsSystem?.enabled !== false ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          <label className="flex items-center space-x-2 text-[11px] p-2 bg-white rounded-lg border border-slate-200 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={perms.cmsSystem?.calendarSlas !== false}
                              onChange={() => handleToggleSystemSub('calendarSlas')}
                              className="rounded text-cyan-600 w-3.5 h-3.5"
                            />
                            <span className="text-slate-800">Calendar & Ground SLAs</span>
                          </label>

                          <label className="flex items-center space-x-2 text-[11px] p-2 bg-white rounded-lg border border-slate-200 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={perms.cmsSystem?.integrationsHub !== false}
                              onChange={() => handleToggleSystemSub('integrationsHub')}
                              className="rounded text-cyan-600 w-3.5 h-3.5"
                            />
                            <span className="text-slate-800">Integrations Hub</span>
                          </label>

                          <label className="flex items-center space-x-2 text-[11px] p-2 bg-white rounded-lg border border-slate-200 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={perms.cmsSystem?.auditLogs !== false}
                              onChange={() => handleToggleSystemSub('auditLogs')}
                              className="rounded text-cyan-600 w-3.5 h-3.5"
                            />
                            <span className="text-slate-800">Security Audit Trail</span>
                          </label>

                          <label className="flex items-center space-x-2 text-[11px] p-2 bg-white rounded-lg border border-slate-200 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={perms.cmsSystem?.googleSheetsSync !== false}
                              onChange={() => handleToggleSystemSub('googleSheetsSync')}
                              className="rounded text-cyan-600 w-3.5 h-3.5"
                            />
                            <span className="text-slate-800">Google Sheets Sync</span>
                          </label>

                          <label className="flex items-center space-x-2 text-[11px] p-2 bg-white rounded-lg border border-slate-200 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={perms.cmsSystem?.databaseDiagnostics !== false}
                              onChange={() => handleToggleSystemSub('databaseDiagnostics')}
                              className="rounded text-cyan-600 w-3.5 h-3.5"
                            />
                            <span className="text-slate-800">Firestore Diagnostics</span>
                          </label>
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-400 italic py-1">
                          System module is turned OFF for this user. Sub-modules disabled.
                        </div>
                      )}
                    </div>

                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 2: COMMERCIAL MARGINS */}
          {activeTab === 'COMMERCIAL' && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
              <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm pb-2 border-b border-slate-100">
                <Percent className="w-4 h-4 text-[#00C6A6]" />
                <span>Custom Client Commercial Parameters</span>
              </div>
              <p className="text-xs text-slate-500">
                Configure specific pricing markups applied when this user builds itineraries in the Quote Builder.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Direct Buyer Margin Markup (%)
                  </label>
                  <p className="text-[11px] text-slate-500 mb-2">
                    Applied on top of nett costs when viewing or quoting direct consumer packages.
                  </p>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={buyerMargin}
                      onChange={e => setBuyerMargin(Number(e.target.value))}
                      className="w-24 p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-sm text-slate-900 text-center"
                    />
                    <span className="text-xs font-bold text-slate-500">%</span>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    B2B Travel Agent Commission (%)
                  </label>
                  <p className="text-[11px] text-slate-500 mb-2">
                    Standard agency retention or commission percentage allocated for B2B accounts.
                  </p>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={agentMargin}
                      onChange={e => setAgentMargin(Number(e.target.value))}
                      className="w-24 p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-sm text-slate-900 text-center"
                    />
                    <span className="text-xs font-bold text-slate-500">%</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ROLE & CLASSIFICATION */}
          {activeTab === 'ACCOUNT' && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
              <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm pb-2 border-b border-slate-100">
                <UserCheck className="w-4 h-4 text-indigo-600" />
                <span>Account Role & Authoritative Security Credentials</span>
              </div>

              {/* Authoritative Firebase Auth UID Card */}
              <div className="bg-slate-950 text-white rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-slate-800">
                <div>
                  <div className="flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-[#00C6A6]" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Authoritative Firebase Auth UID
                    </span>
                  </div>
                  <p className="font-mono text-xs font-bold text-[#00E5C0] mt-1 break-all select-all">
                    {user.id}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Primary unique identifier bound to Firebase Authentication & Firestore profile.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(user.id);
                    setCopiedUid(true);
                    setTimeout(() => setCopiedUid(false), 2000);
                  }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shrink-0 transition-colors cursor-pointer border border-slate-700"
                >
                  {copiedUid ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy UID</span>
                    </>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* User Role */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">User Role</label>
                  <select
                    value={role}
                    disabled={isMaster}
                    onChange={e => handleRoleChange(e.target.value as UserRole)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-1 focus:ring-[#00C6A6]"
                  >
                    <option value="ADMIN">ADMIN (Full Access)</option>
                    <option value="TEAM_MEMBER">TEAM MEMBER (Staff Operations)</option>
                    <option value="DMC_STAFF">DMC STAFF (Ground Operations)</option>
                    <option value="B2B_AGENT">B2B AGENT (Wholesale Partner)</option>
                    <option value="AGENT">AGENT (Standard)</option>
                    <option value="BUYER">BUYER (Direct Traveler)</option>
                    <option value="VIEWER">VIEWER (Read-Only)</option>
                  </select>
                </div>

                {/* User Category */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">Network Category</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value as UserCategory)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-1 focus:ring-[#00C6A6]"
                  >
                    <option value="INTERNAL">INTERNAL (Company Staff / DMC)</option>
                    <option value="EXTERNAL">EXTERNAL (B2B Partner / Direct Buyer)</option>
                  </select>
                </div>

                {/* Approval Status */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">Account Status</label>
                  <select
                    value={approvalStatus}
                    disabled={isMaster}
                    onChange={e => setApprovalStatus(e.target.value as UserApprovalStatus)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-1 focus:ring-[#00C6A6]"
                  >
                    <option value="APPROVED">APPROVED (Active Access)</option>
                    <option value="PENDING">PENDING (Awaiting Review)</option>
                    <option value="REJECTED">REJECTED (Access Blocked)</option>
                  </select>
                </div>

                {/* Verification Status */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">Trade Verification</label>
                  <select
                    value={verificationStatus}
                    onChange={e => setVerificationStatus(e.target.value as VerificationStatus)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-1 focus:ring-[#00C6A6]"
                  >
                    <option value="VERIFIED">VERIFIED (Full Trade Clearance)</option>
                    <option value="PENDING_VERIFICATION">PENDING VERIFICATION</option>
                    <option value="UNVERIFIED">UNVERIFIED</option>
                    <option value="REJECTED">REJECTED</option>
                  </select>
                </div>
              </div>

              {/* Department & Operational Unit */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">Department / Operational Unit</label>
                  <input
                    type="text"
                    value={department}
                    onChange={e => setDepartment(e.target.value)}
                    placeholder="e.g. Inbound Luxury Operations / Sales"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-1 focus:ring-[#00C6A6]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">Account Timeline Metadata</label>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-center justify-between">
                    <span>Created: {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</span>
                    <span>Updated: {user.updatedAt ? new Date(user.updatedAt).toLocaleDateString() : 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Internal Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">Internal Administrative Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Administrative notes regarding user permissions, commercial agreements, or trade verification..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-1 focus:ring-[#00C6A6]"
                />
              </div>

              {/* Safeguard Notice for Admins */}
              {role === 'ADMIN' && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-start space-x-2 text-amber-900 text-xs">
                  <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Administrator Safeguard Policy: </span>
                    <span>
                      At least one active Administrator must always retain Account Management privileges across the system to prevent total lockout.
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AUDIT LOG REASON SECTION */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
            <label className="block text-xs font-bold text-slate-700">
              Admin Audit Log Note (Optional)
            </label>
            <input
              type="text"
              value={auditReason}
              onChange={e => setAuditReason(e.target.value)}
              placeholder="e.g. Granted B2B Quote Builder access following agency verification..."
              className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 focus:ring-1 focus:ring-[#00C6A6]"
            />
            <p className="text-[10px] text-slate-500">
              This note will be recorded into the persistent Firestore security audit trail.
            </p>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold text-white bg-[#00C6A6] hover:bg-[#00a88d] rounded-xl shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? 'Saving...' : 'Save Permission Profile'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
