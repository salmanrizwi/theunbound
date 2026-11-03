import React, { useState, useEffect, useMemo } from 'react';
import { Company, VerificationStatus, User } from '../../types';
import { AppDatabase } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { 
  Building2, 
  Search, 
  Filter, 
  Plus, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  AlertCircle, 
  ExternalLink, 
  Mail, 
  Phone, 
  MapPin, 
  FileText, 
  Edit3, 
  Trash2, 
  Users, 
  ShieldCheck, 
  Globe, 
  Briefcase,
  X,
  Save,
  ChevronRight,
  Sparkles
} from 'lucide-react';

interface CompanyManagementViewProps {
  onOpenUserModal?: (user: User) => void;
}

export const CompanyManagementView: React.FC<CompanyManagementViewProps> = ({ onOpenUserModal }) => {
  const db = AppDatabase.getInstance();
  const { user: currentUser } = useAuth();
  const [companies, setCompanies] = useState<Company[]>(() => db.getCompanies());
  const [users, setUsers] = useState<User[]>(() => db.getUsers());

  // Search and filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [businessTypeFilter, setBusinessTypeFilter] = useState<string>('ALL');

  // Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Partial<Company> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refreshData = () => {
    setCompanies(db.getCompanies());
    setUsers(db.getUsers());
  };

  useEffect(() => {
    const unsub = db.subscribe(() => {
      refreshData();
    });
    return () => unsub();
  }, [db]);

  const showNotification = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  // Filtered companies
  const filteredCompanies = useMemo(() => {
    return companies.filter(c => {
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery = !q || 
        c.name.toLowerCase().includes(q) ||
        (c.legalName && c.legalName.toLowerCase().includes(q)) ||
        (c.city && c.city.toLowerCase().includes(q)) ||
        (c.country && c.country.toLowerCase().includes(q)) ||
        (c.taxOrGstNumber && c.taxOrGstNumber.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q));

      const matchesStatus = statusFilter === 'ALL' || c.verificationStatus === statusFilter;
      const matchesType = businessTypeFilter === 'ALL' || c.businessType === businessTypeFilter;

      return matchesQuery && matchesStatus && matchesType;
    });
  }, [companies, searchQuery, statusFilter, businessTypeFilter]);

  // Distinct business types
  const businessTypes = useMemo(() => {
    const set = new Set<string>();
    companies.forEach(c => {
      if (c.businessType) set.add(c.businessType);
    });
    return Array.from(set);
  }, [companies]);

  // Handlers
  const handleCreateCompany = () => {
    const nowIso = new Date().toISOString();
    setEditingCompany({
      id: `comp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: '',
      legalName: '',
      businessType: 'Luxury Tour Operator & Wholesale Partner',
      website: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      country: 'United Kingdom',
      postalCode: '',
      taxOrGstNumber: '',
      iataOrAbtaNumber: '',
      verificationStatus: 'PENDING_VERIFICATION',
      tier: 'STANDARD_PARTNER',
      notes: '',
      linkedUserIds: [],
      pricingSettings: {
        productLevelMarginEnabled: true,
        activeMarginMode: 'PRODUCT_LEVEL',
        agentLevelMarginPercent: 0,
        lastUpdatedBy: currentUser?.id || 'SYSTEM',
        lastUpdatedByName: currentUser?.name || 'System Admin',
        lastUpdatedAt: nowIso
      },
      createdAt: nowIso
    });
    setIsEditModalOpen(true);
  };

  const handleEditCompany = (company: Company) => {
    const resolvedSettings = db.resolveAgencyPricingSettings({ companyId: company.id, agencyName: company.name });
    setEditingCompany({
      ...company,
      pricingSettings: company.pricingSettings || resolvedSettings
    });
    setIsEditModalOpen(true);
  };

  const handleQuickMarginModeToggle = (company: Company, enabled: boolean) => {
    try {
      const existingSettings = db.resolveAgencyPricingSettings({ companyId: company.id, agencyName: company.name });
      db.updateAgencyPricingSettings(
        company.id,
        {
          productLevelMarginEnabled: enabled,
          agentLevelMarginPercent: existingSettings.agentLevelMarginPercent
        },
        currentUser
      );
      refreshData();
      showNotification(
        `Updated "${company.name}" margin mode: Product-Level Margin = ${enabled ? 'ON (Agent-Level Margin Disabled)' : 'OFF (Agent-Level Margin Active)'}.`
      );
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update Product-Level Margin setting.');
    }
  };

  const handleSaveCompany = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCompany || !editingCompany.name?.trim()) {
      setErrorMessage('Company name is required.');
      return;
    }

    try {
      const nowIso = new Date().toISOString();
      const prodLevelEnabled = editingCompany.pricingSettings?.productLevelMarginEnabled !== false;
      const agentPct = Number.isFinite(Number(editingCompany.pricingSettings?.agentLevelMarginPercent))
        ? Math.max(0, Number(editingCompany.pricingSettings?.agentLevelMarginPercent))
        : 0;

      const companyToSave: Company = {
        id: editingCompany.id || `comp-${Date.now()}`,
        name: editingCompany.name.trim(),
        legalName: editingCompany.legalName?.trim() || editingCompany.name.trim(),
        businessType: editingCompany.businessType || 'Tour Operator',
        logoUrl: editingCompany.logoUrl?.trim() || undefined,
        brandLogoUrl: editingCompany.brandLogoUrl?.trim() || undefined,
        website: editingCompany.website?.trim() || undefined,
        email: editingCompany.email?.trim() || undefined,
        phone: editingCompany.phone?.trim() || undefined,
        address: editingCompany.address?.trim() || undefined,
        city: editingCompany.city?.trim() || undefined,
        state: editingCompany.state?.trim() || undefined,
        postalCode: editingCompany.postalCode?.trim() || undefined,
        country: editingCompany.country?.trim() || 'United Kingdom',
        taxOrGstNumber: editingCompany.taxOrGstNumber?.trim() || undefined,
        iataOrAbtaNumber: editingCompany.iataOrAbtaNumber?.trim() || undefined,
        verificationStatus: (editingCompany.verificationStatus || 'PENDING_VERIFICATION') as VerificationStatus,
        tier: editingCompany.tier || 'STANDARD_PARTNER',
        notes: editingCompany.notes?.trim() || undefined,
        primaryContactUserId: editingCompany.primaryContactUserId,
        primaryContactName: editingCompany.primaryContactName?.trim() || undefined,
        primaryContactEmail: editingCompany.primaryContactEmail?.trim() || undefined,
        primaryContactPhone: editingCompany.primaryContactPhone?.trim() || undefined,
        linkedUserIds: editingCompany.linkedUserIds || [],
        pricingSettings: {
          productLevelMarginEnabled: prodLevelEnabled,
          activeMarginMode: prodLevelEnabled ? 'PRODUCT_LEVEL' : 'AGENT_LEVEL',
          agentLevelMarginPercent: agentPct,
          lastUpdatedBy: currentUser?.id || editingCompany.pricingSettings?.lastUpdatedBy || 'SYSTEM',
          lastUpdatedByName: currentUser?.name || editingCompany.pricingSettings?.lastUpdatedByName || 'Admin',
          lastUpdatedAt: nowIso
        },
        createdAt: editingCompany.createdAt || nowIso,
        updatedAt: nowIso
      };

      db.saveCompany(
        companyToSave, 
        currentUser, 
        'COMPANY_PROFILE_UPDATED', 
        `Updated company profile ${companyToSave.name} (Status: ${companyToSave.verificationStatus}, Product-Level Margin: ${prodLevelEnabled ? 'ON' : 'OFF'})`
      );

      db.updateAgencyPricingSettings(
        companyToSave.id,
        {
          productLevelMarginEnabled: prodLevelEnabled,
          agentLevelMarginPercent: agentPct
        },
        currentUser
      );

      refreshData();
      setIsEditModalOpen(false);
      setEditingCompany(null);
      showNotification(`Saved company profile "${companyToSave.name}" successfully.`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error saving company profile.');
    }
  };

  const handleQuickStatusChange = (company: Company, newStatus: VerificationStatus) => {
    try {
      const updated: Company = {
        ...company,
        verificationStatus: newStatus,
        updatedAt: new Date().toISOString()
      };
      db.saveCompany(
        updated, 
        currentUser, 
        'COMPANY_VERIFICATION_STATUS_CHANGED', 
        `Changed verification status of ${company.name} to ${newStatus}`
      );
      refreshData();
      showNotification(`Updated verification status for "${company.name}" to ${newStatus}.`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update verification status.');
    }
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    try {
      db.deleteCompany(deleteTarget.id, currentUser);
      refreshData();
      showNotification(`Deleted company profile "${deleteTarget.name}".`);
      setDeleteTarget(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error deleting company.');
    }
  };

  const getVerificationBadge = (status: VerificationStatus) => {
    switch (status) {
      case 'VERIFIED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>Verified Trade Partner</span>
          </span>
        );
      case 'PENDING_VERIFICATION':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span>Pending Verification</span>
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5 text-rose-500" />
            <span>Trade Rejected</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
            <span>Unverified</span>
          </span>
        );
    }
  };

  // Metrics
  const totalVerified = companies.filter(c => c.verificationStatus === 'VERIFIED').length;
  const totalPending = companies.filter(c => c.verificationStatus === 'PENDING_VERIFICATION').length;
  const totalTier1 = companies.filter(c => c.tier === 'TIER_1_DIRECT_DMC').length;

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-950 text-white border border-[#00C6A6] px-5 py-3 rounded-xl shadow-2xl flex items-center space-x-3 text-xs animate-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-[#00E5C0] shrink-0" />
          <span className="font-semibold">{successToast}</span>
        </div>
      )}

      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-900 px-4 py-3 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Companies</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{companies.length}</p>
          </div>
          <div className="w-11 h-11 bg-slate-100 rounded-xl flex items-center justify-center text-slate-700">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Verified Partners</p>
            <p className="text-2xl font-black text-emerald-700 mt-1">{totalVerified}</p>
          </div>
          <div className="w-11 h-11 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 border border-emerald-100">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">Pending Verification</p>
            <p className="text-2xl font-black text-amber-700 mt-1">{totalPending}</p>
          </div>
          <div className="w-11 h-11 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 border border-amber-100">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-teal-600">Tier 1 Direct DMC</p>
            <p className="text-2xl font-black text-teal-700 mt-1">{totalTier1}</p>
          </div>
          <div className="w-11 h-11 bg-[#00C6A6]/10 rounded-xl flex items-center justify-center text-[#008f77] border border-[#00C6A6]/20">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          {/* Search Input */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search companies by name, country, tax ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#00C6A6] focus:border-transparent outline-none"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Verification Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:ring-2 focus:ring-[#00C6A6] outline-none"
          >
            <option value="ALL">All Verification Statuses</option>
            <option value="VERIFIED">Verified Only</option>
            <option value="PENDING_VERIFICATION">Pending Verification</option>
            <option value="UNVERIFIED">Unverified Only</option>
            <option value="REJECTED">Rejected</option>
          </select>

          {/* Business Type Filter */}
          {businessTypes.length > 0 && (
            <select
              value={businessTypeFilter}
              onChange={(e) => setBusinessTypeFilter(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:ring-2 focus:ring-[#00C6A6] outline-none"
            >
              <option value="ALL">All Business Types</option>
              {businessTypes.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          )}
        </div>

        {/* Add Company Button */}
        <button
          onClick={handleCreateCompany}
          className="w-full sm:w-auto px-4 py-2 bg-[#00C6A6] hover:bg-[#00b296] text-slate-950 text-xs font-bold rounded-xl flex items-center justify-center shadow-xs cursor-pointer transition-colors"
        >
          <span>Add New Company</span>
        </button>
      </div>

      {/* Companies Directory Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredCompanies.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">No company profiles match your filter</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Try adjusting your search criteria or register a new corporate partner using the "Add New Company" button.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Company Profile</th>
                  <th className="py-3 px-4">Business Type & Tier</th>
                  <th className="py-3 px-4">Pricing & Margin Configuration</th>
                  <th className="py-3 px-4">Location & Country</th>
                  <th className="py-3 px-4">Trade Credentials</th>
                  <th className="py-3 px-4">Verification Status</th>
                  <th className="py-3 px-4">Linked Agents</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {filteredCompanies.map(company => {
                  // Linked users calculation
                  const linkedUsers = users.filter(u => 
                    u.companyId === company.id || 
                    (company.linkedUserIds && company.linkedUserIds.includes(u.id)) ||
                    (u.companyName && u.companyName.toLowerCase() === company.name.toLowerCase()) ||
                    (u.agencyName && u.agencyName.toLowerCase() === company.name.toLowerCase())
                  );
                  const pricingSettings = db.resolveAgencyPricingSettings({ companyId: company.id, agencyName: company.name });
                  const isProdLevelOn = pricingSettings.productLevelMarginEnabled !== false;

                  return (
                    <tr key={company.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Company Profile Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden text-slate-600 font-black">
                            {company.logoUrl ? (
                              <img src={company.logoUrl} alt={company.name} className="w-full h-full object-contain p-1" />
                            ) : (
                              company.name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                              <span>{company.name}</span>
                              {company.website && (
                                <a 
                                  href={company.website.startsWith('http') ? company.website : `https://${company.website}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-slate-400 hover:text-slate-600 inline-flex items-center"
                                  title="Visit Official Website"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                            {company.legalName && company.legalName !== company.name && (
                              <p className="text-[11px] text-slate-500">{company.legalName}</p>
                            )}
                            <div className="text-[11px] text-slate-400 flex items-center space-x-3 mt-0.5">
                              {company.email && (
                                <span className="flex items-center space-x-1">
                                  <Mail className="w-3 h-3 text-slate-400" />
                                  <span>{company.email}</span>
                                </span>
                              )}
                              {company.phone && (
                                <span className="flex items-center space-x-1">
                                  <Phone className="w-3 h-3 text-slate-400" />
                                  <span>{company.phone}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Business Type & Tier */}
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 text-[11px] font-semibold">
                          {company.businessType || 'Wholesale Partner'}
                        </span>
                        {company.tier && (
                          <div className="text-[10px] text-teal-700 font-bold mt-1">
                            {company.tier === 'TIER_1_DIRECT_DMC' ? '★ Tier 1 Direct DMC' : company.tier.replace(/_/g, ' ')}
                          </div>
                        )}
                      </td>

                      {/* Pricing & Margin Configuration */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center space-x-2">
                            <button
                              type="button"
                              onClick={() => handleQuickMarginModeToggle(company, !isProdLevelOn)}
                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                                isProdLevelOn ? 'bg-[#00C6A6]' : 'bg-amber-500'
                              }`}
                              title="Toggle Product-Level Margin ON/OFF"
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                                  isProdLevelOn ? 'translate-x-4' : 'translate-x-0'
                                }`}
                              />
                            </button>
                            <span className="text-[11px] font-black text-slate-900">
                              Product-Level Margin: <span className={isProdLevelOn ? 'text-[#008972]' : 'text-amber-700'}>{isProdLevelOn ? 'ON' : 'OFF'}</span>
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-600 flex flex-col gap-0.5">
                            <span>
                              Active Mode: <strong className={isProdLevelOn ? 'text-[#008972]' : 'text-amber-700'}>{isProdLevelOn ? 'Product-Level' : 'Agent-Level'}</strong>
                            </span>
                            <span>
                              Agent-Level Margin: <strong className={!isProdLevelOn ? 'text-amber-700' : 'text-slate-400'}>{!isProdLevelOn ? `Active (${pricingSettings.agentLevelMarginPercent}%)` : 'Inactive (Disabled)'}</strong>
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Location */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-1 font-medium text-slate-800">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{company.city ? `${company.city}, ` : ''}{company.country || 'United Kingdom'}</span>
                        </div>
                        {company.address && (
                          <div className="text-[11px] text-slate-400 truncate max-w-xs" title={company.address}>
                            {company.address}
                          </div>
                        )}
                      </td>

                      {/* Trade Credentials */}
                      <td className="py-3.5 px-4">
                        {company.taxOrGstNumber ? (
                          <div className="text-[11px] font-mono text-slate-800">
                            <span className="text-slate-400 font-sans text-[10px]">VAT/Tax: </span>
                            {company.taxOrGstNumber}
                          </div>
                        ) : null}
                        {company.iataOrAbtaNumber ? (
                          <div className="text-[11px] font-mono text-slate-800">
                            <span className="text-slate-400 font-sans text-[10px]">IATA/ABTA: </span>
                            {company.iataOrAbtaNumber}
                          </div>
                        ) : null}
                        {!company.taxOrGstNumber && !company.iataOrAbtaNumber && (
                          <span className="text-slate-400 text-[11px] italic">Not Registered</span>
                        )}
                      </td>

                      {/* Verification Status */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col space-y-1">
                          {getVerificationBadge(company.verificationStatus)}
                          {/* Quick change dropdown for Admin */}
                          <select
                            value={company.verificationStatus}
                            onChange={(e) => handleQuickStatusChange(company, e.target.value as VerificationStatus)}
                            className="text-[10px] bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-slate-600 outline-none hover:border-slate-300 w-fit cursor-pointer"
                          >
                            <option value="VERIFIED">Mark Verified</option>
                            <option value="PENDING_VERIFICATION">Mark Pending</option>
                            <option value="UNVERIFIED">Mark Unverified</option>
                            <option value="REJECTED">Mark Rejected</option>
                          </select>
                        </div>
                      </td>

                      {/* Linked Agents */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-1.5">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-bold text-slate-900">{linkedUsers.length}</span>
                          <span className="text-slate-500 text-[11px]">User{linkedUsers.length !== 1 ? 's' : ''}</span>
                        </div>
                        {linkedUsers.length > 0 && (
                          <div className="flex -space-x-1.5 mt-1 overflow-hidden">
                            {linkedUsers.slice(0, 3).map(u => (
                              <button
                                key={u.id}
                                onClick={() => onOpenUserModal && onOpenUserModal(u)}
                                className="w-5 h-5 rounded-full bg-[#00C6A6]/20 border border-white text-[9px] font-bold text-[#008f77] flex items-center justify-center cursor-pointer hover:scale-110 transition-transform"
                                title={`${u.name} (${u.role}) - Click to edit user profile`}
                              >
                                {u.name.charAt(0)}
                              </button>
                            ))}
                            {linkedUsers.length > 3 && (
                              <div className="w-5 h-5 rounded-full bg-slate-200 border border-white text-[9px] font-bold text-slate-600 flex items-center justify-center">
                                +{linkedUsers.length - 3}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleEditCompany(company)}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Edit Company Details & Margin Mode"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(company)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Company Profile"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit / Create Company Modal */}
      {isEditModalOpen && editingCompany && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-6 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-[#00C6A6]/10 text-[#008f77] flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {editingCompany.id && companies.some(c => c.id === editingCompany.id) ? 'Edit Company Profile' : 'Register New Corporate Partner'}
                  </h3>
                  <p className="text-xs text-slate-500">Authoritative Firestore Master Company Record</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCompany} className="space-y-4">
              {/* Pricing & Margin Configuration Section */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">Pricing & Margin Configuration</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Mutually exclusive margin control. Product-Level Margin and Agent-Level Margin never apply simultaneously.
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] font-bold text-slate-700">Product-Level Margin:</span>
                    <button
                      type="button"
                      onClick={() => {
                        const nextEnabled = editingCompany.pricingSettings?.productLevelMarginEnabled === false ? true : false;
                        setEditingCompany({
                          ...editingCompany,
                          pricingSettings: {
                            ...(editingCompany.pricingSettings || {
                              productLevelMarginEnabled: true,
                              activeMarginMode: 'PRODUCT_LEVEL',
                              agentLevelMarginPercent: 0
                            }),
                            productLevelMarginEnabled: nextEnabled,
                            activeMarginMode: nextEnabled ? 'PRODUCT_LEVEL' : 'AGENT_LEVEL'
                          }
                        });
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-black cursor-pointer transition-colors ${
                        editingCompany.pricingSettings?.productLevelMarginEnabled !== false
                          ? 'bg-[#00C6A6] text-slate-950'
                          : 'bg-amber-500 text-slate-950'
                      }`}
                    >
                      {editingCompany.pricingSettings?.productLevelMarginEnabled !== false ? 'ON (Default)' : 'OFF'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-2 border-t border-slate-200/80">
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Product-Level Margin</span>
                    <span className={`font-black text-xs mt-0.5 block ${editingCompany.pricingSettings?.productLevelMarginEnabled !== false ? 'text-[#008972]' : 'text-slate-500'}`}>
                      {editingCompany.pricingSettings?.productLevelMarginEnabled !== false ? 'ON (Active)' : 'OFF (Disabled)'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Active Margin Mode</span>
                    <span className="font-black text-xs text-slate-900 mt-0.5 block">
                      {editingCompany.pricingSettings?.productLevelMarginEnabled !== false ? 'Product-Level' : 'Agent-Level'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Agent-Level Margin Status</span>
                    <span className={`font-black text-xs mt-0.5 block ${editingCompany.pricingSettings?.productLevelMarginEnabled === false ? 'text-amber-600' : 'text-slate-400'}`}>
                      {editingCompany.pricingSettings?.productLevelMarginEnabled === false ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Configured Agent-Level Margin (%) {editingCompany.pricingSettings?.productLevelMarginEnabled !== false && <span className="text-[10px] text-slate-400 font-normal">(Inactive while Product-Level is ON)</span>}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      disabled={editingCompany.pricingSettings?.productLevelMarginEnabled !== false}
                      value={editingCompany.pricingSettings?.agentLevelMarginPercent ?? 0}
                      onChange={(e) =>
                        setEditingCompany({
                          ...editingCompany,
                          pricingSettings: {
                            ...(editingCompany.pricingSettings || {
                              productLevelMarginEnabled: false,
                              activeMarginMode: 'AGENT_LEVEL',
                              agentLevelMarginPercent: 0
                            }),
                            agentLevelMarginPercent: Math.max(0, Number(e.target.value) || 0)
                          }
                        })
                      }
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </div>
                  <div className="flex flex-col justify-center text-[11px] text-slate-500 bg-white p-2.5 rounded-xl border border-slate-200">
                    <div>
                      <span className="font-bold text-slate-600">Last Updated By: </span>
                      <span>{editingCompany.pricingSettings?.lastUpdatedByName || editingCompany.pricingSettings?.lastUpdatedBy || 'System Default'}</span>
                    </div>
                    <div className="mt-0.5">
                      <span className="font-bold text-slate-600">Last Updated At: </span>
                      <span>{editingCompany.pricingSettings?.lastUpdatedAt ? new Date(editingCompany.pricingSettings.lastUpdatedAt).toLocaleString() : 'Initial'}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* Company Name */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Company / Trade Name *</label>
                  <input
                    type="text"
                    required
                    value={editingCompany.name || ''}
                    onChange={(e) => setEditingCompany({ ...editingCompany, name: e.target.value })}
                    placeholder="e.g. Mayfair Luxury Travel Ltd"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00C6A6] outline-none"
                  />
                </div>

                {/* Legal Name */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Registered Legal Entity Name</label>
                  <input
                    type="text"
                    value={editingCompany.legalName || ''}
                    onChange={(e) => setEditingCompany({ ...editingCompany, legalName: e.target.value })}
                    placeholder="e.g. Mayfair Travel Global Holdings Ltd"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00C6A6] outline-none"
                  />
                </div>

                {/* Business Type */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Business Model / Type</label>
                  <input
                    type="text"
                    value={editingCompany.businessType || ''}
                    onChange={(e) => setEditingCompany({ ...editingCompany, businessType: e.target.value })}
                    placeholder="e.g. Luxury Tour Operator & Concierge"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00C6A6] outline-none"
                  />
                </div>

                {/* Partnership Tier */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Partnership Tier</label>
                  <select
                    value={editingCompany.tier || 'STANDARD_PARTNER'}
                    onChange={(e) => setEditingCompany({ ...editingCompany, tier: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00C6A6] outline-none"
                  >
                    <option value="TIER_1_DIRECT_DMC">Tier 1 Direct DMC Operator</option>
                    <option value="PREFERRED_PARTNER">Preferred Wholesale Partner</option>
                    <option value="STANDARD_PARTNER">Standard Partner Agency</option>
                  </select>
                </div>

                {/* Verification Status */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Trade Verification Status</label>
                  <select
                    value={editingCompany.verificationStatus || 'PENDING_VERIFICATION'}
                    onChange={(e) => setEditingCompany({ ...editingCompany, verificationStatus: e.target.value as VerificationStatus })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00C6A6] outline-none"
                  >
                    <option value="VERIFIED">VERIFIED (Full Access)</option>
                    <option value="PENDING_VERIFICATION">PENDING_VERIFICATION (Under Review)</option>
                    <option value="UNVERIFIED">UNVERIFIED</option>
                    <option value="REJECTED">REJECTED (Access Suspended)</option>
                  </select>
                </div>

                {/* Official Website */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Corporate Website</label>
                  <input
                    type="text"
                    value={editingCompany.website || ''}
                    onChange={(e) => setEditingCompany({ ...editingCompany, website: e.target.value })}
                    placeholder="https://company.com"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00C6A6] outline-none"
                  />
                </div>

                {/* Email */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Official Company Email</label>
                  <input
                    type="email"
                    value={editingCompany.email || ''}
                    onChange={(e) => setEditingCompany({ ...editingCompany, email: e.target.value })}
                    placeholder="contact@company.com"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00C6A6] outline-none"
                  />
                </div>

                {/* Phone */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Official Company Phone</label>
                  <input
                    type="text"
                    value={editingCompany.phone || ''}
                    onChange={(e) => setEditingCompany({ ...editingCompany, phone: e.target.value })}
                    placeholder="+44 20 7946 0912"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00C6A6] outline-none"
                  />
                </div>

                {/* Address */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="font-bold text-slate-700">Physical / Head Office Address</label>
                  <input
                    type="text"
                    value={editingCompany.address || ''}
                    onChange={(e) => setEditingCompany({ ...editingCompany, address: e.target.value })}
                    placeholder="e.g. 14 Berkeley Square, Mayfair"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00C6A6] outline-none"
                  />
                </div>

                {/* City */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">City / Hub</label>
                  <input
                    type="text"
                    value={editingCompany.city || ''}
                    onChange={(e) => setEditingCompany({ ...editingCompany, city: e.target.value })}
                    placeholder="London"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00C6A6] outline-none"
                  />
                </div>

                {/* Country */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Country</label>
                  <input
                    type="text"
                    value={editingCompany.country || 'United Kingdom'}
                    onChange={(e) => setEditingCompany({ ...editingCompany, country: e.target.value })}
                    placeholder="United Kingdom"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00C6A6] outline-none"
                  />
                </div>

                {/* Tax / GST Number */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Tax / VAT / GST Registration Number</label>
                  <input
                    type="text"
                    value={editingCompany.taxOrGstNumber || ''}
                    onChange={(e) => setEditingCompany({ ...editingCompany, taxOrGstNumber: e.target.value })}
                    placeholder="GB 982 3411 90"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00C6A6] outline-none"
                  />
                </div>

                {/* IATA / ABTA Number */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">IATA / ABTA / Industry License</label>
                  <input
                    type="text"
                    value={editingCompany.iataOrAbtaNumber || ''}
                    onChange={(e) => setEditingCompany({ ...editingCompany, iataOrAbtaNumber: e.target.value })}
                    placeholder="IATA-91283021"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00C6A6] outline-none"
                  />
                </div>

                {/* Brand Logo URL */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="font-bold text-slate-700">Brand Logo URL</label>
                  <input
                    type="text"
                    value={editingCompany.logoUrl || editingCompany.brandLogoUrl || ''}
                    onChange={(e) => setEditingCompany({ ...editingCompany, logoUrl: e.target.value, brandLogoUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00C6A6] outline-none"
                  />
                </div>

                {/* Internal Notes */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="font-bold text-slate-700">Administrative Notes / Partnership Scope</label>
                  <textarea
                    rows={2}
                    value={editingCompany.notes || ''}
                    onChange={(e) => setEditingCompany({ ...editingCompany, notes: e.target.value })}
                    placeholder="Internal operations notes, special commission agreement, credit terms..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00C6A6] outline-none"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#00C6A6] hover:bg-[#00b296] text-slate-950 font-black rounded-xl text-xs flex items-center space-x-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Company Record</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-slate-900">Delete Company Profile?</h3>
              <p className="text-xs text-slate-500">
                Are you sure you want to delete <span className="font-bold text-slate-800">"{deleteTarget.name}"</span> from the authoritative Firestore database? Linked user accounts will be unlinked but retained.
              </p>
            </div>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs cursor-pointer"
              >
                Delete Company
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
