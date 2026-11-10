import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AssociatedPartner, HomepageConfig } from '../../types';
import { AppDatabase } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { uploadPartnerLogo } from '../../services/partnerStorageService';
import { AssociatedPartnersCarousel } from '../public/AssociatedPartnersCarousel';
import {
  Handshake,
  Plus,
  Edit2,
  Trash2,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  Upload,
  CheckCircle2,
  X,
  AlertCircle,
  Eye,
  Sliders,
  Globe,
  Loader2,
  Save,
  Link as LinkIcon
} from 'lucide-react';

const PARTNER_CATEGORIES = [
  'Airlines & Aviation',
  'Hotel & Hospitality Brands',
  'National Tourism Boards',
  'Chauffeur & Ground Transport',
  'Rail & Logistics Operators',
  'Travel Technology',
  'Industry Affiliates',
  'Other'
];

export const AssociatedPartnersManager: React.FC = () => {
  const { user } = useAuth();
  const db = AppDatabase.getInstance();

  const [partners, setPartners] = useState<AssociatedPartner[]>(() => db.getAssociatedPartners());
  const [homepageConfig, setHomepageConfig] = useState<HomepageConfig>(() => db.getHomepageConfig());
  const [showConfigSettings, setShowConfigSettings] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<string | null>(null);

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<AssociatedPartner | null>(null);
  const [formData, setFormData] = useState<Partial<AssociatedPartner>>({
    name: '',
    logoUrl: '',
    websiteUrl: '',
    description: '',
    category: 'Industry Affiliates',
    displayOrder: 1,
    isActive: true
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete Confirmation Modal State
  const [deletingPartner, setDeletingPartner] = useState<AssociatedPartner | null>(null);

  // Section Header Form State (synced with homepageConfig)
  const [sectionConfigForm, setSectionConfigForm] = useState({
    showAssociatedPartners: homepageConfig.showAssociatedPartners !== false,
    associatedPartnersBadge: homepageConfig.associatedPartnersBadge || 'STRATEGIC COLLABORATION',
    associatedPartnersTitle: homepageConfig.associatedPartnersTitle || 'Our Associated Partners',
    associatedPartnersSubtitle:
      homepageConfig.associatedPartnersSubtitle ||
      'Working together with trusted partners to create seamless travel experiences.'
  });

  useEffect(() => {
    const unsub = db.subscribe(() => {
      setPartners(db.getAssociatedPartners());
      const hp = db.getHomepageConfig();
      setHomepageConfig(hp);
      setSectionConfigForm({
        showAssociatedPartners: hp.showAssociatedPartners !== false,
        associatedPartnersBadge: hp.associatedPartnersBadge || 'STRATEGIC COLLABORATION',
        associatedPartnersTitle: hp.associatedPartnersTitle || 'Our Associated Partners',
        associatedPartnersSubtitle:
          hp.associatedPartnersSubtitle ||
          'Working together with trusted partners to create seamless travel experiences.'
      });
    });
    return () => unsub();
  }, [db]);

  const activeCount = useMemo(() => partners.filter(p => p.isActive !== false).length, [partners]);

  const openAddModal = () => {
    setEditingPartner(null);
    setFormData({
      name: '',
      logoUrl: '',
      websiteUrl: '',
      description: '',
      category: 'Industry Affiliates',
      displayOrder: partners.length + 1,
      isActive: true
    });
    setLogoPreviewUrl('');
    setFormErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (partner: AssociatedPartner) => {
    setEditingPartner(partner);
    setFormData({
      name: partner.name,
      logoUrl: partner.logoUrl,
      websiteUrl: partner.websiteUrl || '',
      description: partner.description || '',
      category: partner.category || 'Industry Affiliates',
      displayOrder: partner.displayOrder ?? 1,
      isActive: partner.isActive !== false
    });
    setLogoPreviewUrl(partner.logoUrl);
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingLogo(true);
    setFormErrors(prev => {
      const copy = { ...prev };
      delete copy.logoUrl;
      return copy;
    });

    try {
      const partnerId = editingPartner ? editingPartner.id : `partner-${Date.now()}`;
      const uploadRes = await uploadPartnerLogo(file, partnerId);
      setLogoPreviewUrl(uploadRes.url);
      setFormData(prev => ({
        ...prev,
        logoUrl: uploadRes.url,
        storagePath: uploadRes.storagePath
      }));
    } catch (err: any) {
      setFormErrors(prev => ({
        ...prev,
        logoUrl: err?.message || 'Failed to upload logo. Please try another file.'
      }));
    } finally {
      setIsUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.name || !formData.name.trim()) {
      errors.name = 'Partner name is required.';
    }
    if (!formData.logoUrl || !formData.logoUrl.trim()) {
      errors.logoUrl = 'Partner logo image or URL is required.';
    }
    if (formData.websiteUrl && formData.websiteUrl.trim()) {
      const url = formData.websiteUrl.trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        errors.websiteUrl = 'Website URL must start with http:// or https://';
      }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSavePartner = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const now = new Date().toISOString();
    const partnerToSave: AssociatedPartner = {
      id: editingPartner ? editingPartner.id : `partner-${Date.now()}`,
      name: formData.name!.trim(),
      logoUrl: formData.logoUrl!.trim(),
      storagePath: formData.storagePath || editingPartner?.storagePath,
      websiteUrl: formData.websiteUrl ? formData.websiteUrl.trim() : undefined,
      description: formData.description ? formData.description.trim() : undefined,
      category: formData.category || 'Industry Affiliates',
      displayOrder: Number(formData.displayOrder) || partners.length + 1,
      isActive: formData.isActive !== false,
      createdAt: editingPartner ? editingPartner.createdAt : now,
      updatedAt: now,
      createdBy: editingPartner ? editingPartner.createdBy : (user?.email || user?.name || 'Administrator'),
      updatedBy: user?.email || user?.name || 'Administrator'
    };

    db.saveAssociatedPartner(partnerToSave, user);
    setIsModalOpen(false);
    setSaveSuccessNotice(`Partner "${partnerToSave.name}" saved successfully.`);
    setTimeout(() => setSaveSuccessNotice(null), 3500);
  };

  const handleToggleActive = (partner: AssociatedPartner) => {
    const updated: AssociatedPartner = {
      ...partner,
      isActive: !partner.isActive,
      updatedAt: new Date().toISOString(),
      updatedBy: user?.email || user?.name || 'Administrator'
    };
    db.saveAssociatedPartner(updated, user);
  };

  const handleMoveOrder = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= partners.length) return;

    const reordered = [...partners];
    const temp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = temp;

    const orderedIds = reordered.map(p => p.id);
    db.reorderAssociatedPartners(orderedIds, user);
  };

  const handleConfirmDelete = () => {
    if (!deletingPartner) return;
    const name = deletingPartner.name;
    db.deleteAssociatedPartner(deletingPartner.id, user);
    setDeletingPartner(null);
    setSaveSuccessNotice(`Partner "${name}" deleted.`);
    setTimeout(() => setSaveSuccessNotice(null), 3500);
  };

  const handleSaveSectionConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const latestConfig = db.getHomepageConfig();
    const updated: HomepageConfig = {
      ...latestConfig,
      showAssociatedPartners: sectionConfigForm.showAssociatedPartners,
      associatedPartnersBadge: sectionConfigForm.associatedPartnersBadge.trim(),
      associatedPartnersTitle: sectionConfigForm.associatedPartnersTitle.trim(),
      associatedPartnersSubtitle: sectionConfigForm.associatedPartnersSubtitle.trim()
    };
    db.updateHomepageConfig(updated, user);
    setShowConfigSettings(false);
    setSaveSuccessNotice('Homepage carousel section settings updated.');
    setTimeout(() => setSaveSuccessNotice(null), 3500);
  };

  return (
    <div className="space-y-8 text-left pb-12">
      {/* Top Banner Notice */}
      {saveSuccessNotice && (
        <div className="p-4 rounded-2xl bg-teal-50 border border-teal-200 text-[#008972] text-xs sm:text-sm font-bold flex items-center justify-between shadow-2xs">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-[#008972]" />
            <span>{saveSuccessNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setSaveSuccessNotice(null)}
            className="text-slate-400 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Container */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-[#008972] text-xs font-bold uppercase tracking-wider">
            <Handshake className="w-3.5 h-3.5" />
            <span>HOMEPAGE PARTNER SHOWCASE</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Associated Partners Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-2xl leading-relaxed">
            Manage the official logos, websites, and display sequence of suppliers, airlines, hotel
            chains, and tourism bodies displayed in the continuous logo carousel on TheUnbound
            homepage.
          </p>
          <div className="flex items-center space-x-3 pt-1 text-xs text-slate-600 font-medium">
            <span>
              <strong className="text-slate-900">{partners.length}</strong> Total Partners
            </span>
            <span>·</span>
            <span>
              <strong className="text-[#008972]">{activeCount}</strong> Active on Homepage
            </span>
            <span>·</span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${
                homepageConfig.showAssociatedPartners !== false
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-rose-50 text-rose-700'
              }`}
            >
              Section {homepageConfig.showAssociatedPartners !== false ? 'Enabled' : 'Hidden'}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-3 self-start md:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setShowConfigSettings(!showConfigSettings)}
            className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors flex items-center space-x-2 cursor-pointer shadow-2xs"
          >
            <Sliders className="w-3.5 h-3.5 text-slate-500" />
            <span>{showConfigSettings ? 'Hide Section Settings' : 'Section Settings'}</span>
          </button>
          <button
            type="button"
            onClick={openAddModal}
            className="px-5 py-2.5 rounded-xl bg-[#00C6A6] hover:bg-[#00b094] text-slate-950 text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer shadow-sm hover:shadow"
          >
            <Plus className="w-4 h-4 text-slate-950" />
            <span>Add Associated Partner</span>
          </button>
        </div>
      </div>

      {/* Section Settings Drawer */}
      {showConfigSettings && (
        <form
          onSubmit={handleSaveSectionConfig}
          className="bg-slate-50 rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-xs"
        >
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Homepage Carousel Section Settings</h3>
              <p className="text-xs text-slate-500">
                Customize titles, badges, and visibility for the Associated Partners showcase on the homepage.
              </p>
            </div>
            <label className="flex items-center space-x-2 cursor-pointer text-xs font-bold text-slate-700">
              <input
                type="checkbox"
                checked={sectionConfigForm.showAssociatedPartners}
                onChange={e =>
                  setSectionConfigForm(prev => ({
                    ...prev,
                    showAssociatedPartners: e.target.checked
                  }))
                }
                className="w-4 h-4 rounded text-[#00C6A6] focus:ring-[#00C6A6]"
              />
              <span>Display Section on Homepage</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Section Eyebrow Badge
              </label>
              <input
                type="text"
                value={sectionConfigForm.associatedPartnersBadge}
                onChange={e =>
                  setSectionConfigForm(prev => ({
                    ...prev,
                    associatedPartnersBadge: e.target.value
                  }))
                }
                placeholder="STRATEGIC COLLABORATION"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-medium focus:ring-2 focus:ring-[#00C6A6] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Section Title
              </label>
              <input
                type="text"
                value={sectionConfigForm.associatedPartnersTitle}
                onChange={e =>
                  setSectionConfigForm(prev => ({
                    ...prev,
                    associatedPartnersTitle: e.target.value
                  }))
                }
                placeholder="Our Associated Partners"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-medium focus:ring-2 focus:ring-[#00C6A6] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Section Subtitle
              </label>
              <input
                type="text"
                value={sectionConfigForm.associatedPartnersSubtitle}
                onChange={e =>
                  setSectionConfigForm(prev => ({
                    ...prev,
                    associatedPartnersSubtitle: e.target.value
                  }))
                }
                placeholder="Working together with trusted partners to create seamless travel experiences."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-medium focus:ring-2 focus:ring-[#00C6A6] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={() => setShowConfigSettings(false)}
              className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-[#008972] text-white text-xs font-bold transition-colors flex items-center space-x-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Section Settings</span>
            </button>
          </div>
        </form>
      )}

      {/* Live Preview Strip */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            <Eye className="w-3.5 h-3.5 text-[#008972]" />
            <span>Interactive Live Homepage Preview</span>
          </div>
          <span className="text-[11px] text-slate-400">
            {activeCount > 0 ? 'Displays active partners in real-time' : 'No active partners'}
          </span>
        </div>
        <div className="rounded-3xl border border-slate-200/90 bg-slate-100/60 p-4 shadow-inner">
          <AssociatedPartnersCarousel
            homepageConfig={{
              ...homepageConfig,
              associatedPartnersBadge: sectionConfigForm.associatedPartnersBadge,
              associatedPartnersTitle: sectionConfigForm.associatedPartnersTitle,
              associatedPartnersSubtitle: sectionConfigForm.associatedPartnersSubtitle,
              showAssociatedPartners: true
            }}
            previewPartners={partners}
            showEvenIfEmptyInPreview={true}
          />
        </div>
      </div>

      {/* Partners List Table */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Partner Directory</h2>
            <p className="text-xs text-slate-500">
              Drag or reorder with arrows to determine the display order on the homepage.
            </p>
          </div>
          <button
            type="button"
            onClick={openAddModal}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors flex items-center space-x-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-[#00E5C0]" />
            <span>Add Partner</span>
          </button>
        </div>

        {partners.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Handshake className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">No Associated Partners Added Yet</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              In accordance with our strict data policy, no mock or placeholder logos are shown.
              Click the button below to add your first verified supplier, airline, hotel group, or
              tourism board.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={openAddModal}
                className="px-6 py-2.5 rounded-xl bg-[#00C6A6] hover:bg-[#00b094] text-slate-950 text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                + Add First Associated Partner
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4 w-16 text-center">Order</th>
                  <th className="py-3 px-4 w-28">Logo Preview</th>
                  <th className="py-3 px-4">Partner Details</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Website</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {partners.map((partner, index) => (
                  <tr
                    key={partner.id}
                    className="hover:bg-slate-50/80 transition-colors group"
                  >
                    {/* Order Controls */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex flex-col items-center space-y-1">
                        <button
                          type="button"
                          onClick={() => handleMoveOrder(index, 'up')}
                          disabled={index === 0}
                          aria-label="Move partner up"
                          className={`p-1 rounded-md transition-colors ${
                            index === 0
                              ? 'text-slate-200 cursor-not-allowed'
                              : 'text-slate-500 hover:bg-slate-200 hover:text-slate-900 cursor-pointer'
                          }`}
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <span className="font-mono font-bold text-slate-700 text-[11px]">
                          {index + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleMoveOrder(index, 'down')}
                          disabled={index === partners.length - 1}
                          aria-label="Move partner down"
                          className={`p-1 rounded-md transition-colors ${
                            index === partners.length - 1
                              ? 'text-slate-200 cursor-not-allowed'
                              : 'text-slate-500 hover:bg-slate-200 hover:text-slate-900 cursor-pointer'
                          }`}
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                    {/* Logo Preview */}
                    <td className="py-3.5 px-4">
                      <div className="w-24 h-12 rounded-xl bg-slate-50 border border-slate-200 p-1 flex items-center justify-center overflow-hidden shadow-2xs group-hover:border-[#00C6A6]/40 transition-colors">
                        {partner.logoUrl ? (
                          <img
                            src={partner.logoUrl}
                            alt={partner.name}
                            className="max-h-full max-w-full object-contain filter grayscale group-hover:grayscale-0 transition-all"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                              const parent = (e.target as HTMLElement).parentElement;
                              if (parent) {
                                parent.innerHTML = `<span class="text-[9px] font-bold text-slate-400 text-center line-clamp-1">${partner.name}</span>`;
                              }
                            }}
                          />
                        ) : (
                          <span className="text-[9px] font-bold text-slate-400">No Logo</span>
                        )}
                      </div>
                    </td>

                    {/* Partner Name & Description */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-0.5 max-w-xs">
                        <div className="font-bold text-slate-900 text-sm">{partner.name}</div>
                        {partner.description && (
                          <p className="text-slate-500 text-[11px] line-clamp-1 leading-relaxed">
                            {partner.description}
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium border border-slate-200/80 inline-block whitespace-nowrap">
                        {partner.category || 'Industry Affiliate'}
                      </span>
                    </td>

                    {/* Website */}
                    <td className="py-3.5 px-4">
                      {partner.websiteUrl ? (
                        <a
                          href={partner.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-1 text-slate-600 hover:text-[#008972] transition-colors font-medium text-xs max-w-xs truncate"
                          title={partner.websiteUrl}
                        >
                          <Globe className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate max-w-[140px]">{partner.websiteUrl.replace(/^https?:\/\//, '')}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      ) : (
                        <span className="text-slate-400 text-[11px]">—</span>
                      )}
                    </td>

                    {/* Active Status */}
                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(partner)}
                        className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase transition-colors cursor-pointer ${
                          partner.isActive !== false
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {partner.isActive !== false ? 'Active' : 'Inactive'}
                      </button>
                    </td>

                    {/* Action Buttons */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(partner)}
                          aria-label={`Edit ${partner.name}`}
                          className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingPartner(partner)}
                          aria-label={`Delete ${partner.name}`}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Partner Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">
                  {editingPartner ? 'Edit Associated Partner' : 'Add Associated Partner'}
                </h3>
                <p className="text-xs text-slate-500">
                  Configure partner identity, logo image, and website link.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePartner} className="p-6 space-y-5">
              {/* Partner Name */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Partner / Brand Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Japan Airlines, Hyatt Hotels, VisitBritain"
                  className={`w-full px-4 py-2.5 rounded-xl border text-xs font-medium focus:ring-2 focus:ring-[#00C6A6] focus:outline-none ${
                    formErrors.name ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300 bg-white'
                  }`}
                />
                {formErrors.name && (
                  <p className="text-rose-600 text-[11px] mt-1 font-medium">{formErrors.name}</p>
                )}
              </div>

              {/* Logo Upload & URL */}
              <div className="space-y-2.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Partner Logo <span className="text-rose-500">*</span>
                </label>

                {/* Upload button or Drag area */}
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="partner-logo-upload"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingLogo}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors flex items-center justify-center space-x-2 cursor-pointer shadow-2xs"
                  >
                    {isUploadingLogo ? (
                      <>
                        <Loader2 className="w-4 h-4 text-[#008972] animate-spin" />
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 text-slate-500" />
                        <span>Upload Logo File (PNG/SVG/WEBP)</span>
                      </>
                    )}
                  </button>

                  {/* Preview Container */}
                  {logoPreviewUrl && (
                    <div className="w-32 h-12 rounded-xl bg-slate-50 border border-slate-200 p-1 flex items-center justify-center overflow-hidden">
                      <img
                        src={logoPreviewUrl}
                        alt="Preview"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                  )}
                </div>

                {/* Direct URL input alternative */}
                <div className="pt-1">
                  <div className="relative">
                    <LinkIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={formData.logoUrl || ''}
                      onChange={e => {
                        setFormData({ ...formData, logoUrl: e.target.value });
                        setLogoPreviewUrl(e.target.value);
                      }}
                      placeholder="Or enter direct logo image URL (e.g. /logos/partner.png)"
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-medium focus:ring-2 focus:ring-[#00C6A6] focus:outline-none"
                    />
                  </div>
                </div>

                {formErrors.logoUrl && (
                  <p className="text-rose-600 text-[11px] font-medium">{formErrors.logoUrl}</p>
                )}
              </div>

              {/* Website URL */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Official Website URL <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <Globe className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="url"
                    value={formData.websiteUrl || ''}
                    onChange={e => setFormData({ ...formData, websiteUrl: e.target.value })}
                    placeholder="https://example.com"
                    className={`w-full pl-9 pr-3.5 py-2.5 rounded-xl border text-xs font-medium focus:ring-2 focus:ring-[#00C6A6] focus:outline-none ${
                      formErrors.websiteUrl ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300 bg-white'
                    }`}
                  />
                </div>
                {formErrors.websiteUrl && (
                  <p className="text-rose-600 text-[11px] mt-1 font-medium">{formErrors.websiteUrl}</p>
                )}
              </div>

              {/* Category & Display Order Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Category / Industry
                  </label>
                  <select
                    value={formData.category || 'Industry Affiliates'}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-medium focus:ring-2 focus:ring-[#00C6A6] focus:outline-none"
                  >
                    {PARTNER_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Display Order Index
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.displayOrder ?? 1}
                    onChange={e =>
                      setFormData({ ...formData, displayOrder: parseInt(e.target.value, 10) || 1 })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-medium focus:ring-2 focus:ring-[#00C6A6] focus:outline-none"
                  />
                </div>
              </div>

              {/* Internal Description */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Internal Description / Operational Notes <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={formData.description || ''}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g. Official VIP partner for luxury ground transport and hotel allotments."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-medium focus:ring-2 focus:ring-[#00C6A6] focus:outline-none"
                />
              </div>

              {/* Active Toggle */}
              <div className="pt-1">
                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive !== false}
                    onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 rounded text-[#00C6A6] focus:ring-[#00C6A6]"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    Active (Show in Homepage Carousel)
                  </span>
                </label>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploadingLogo}
                  className="px-6 py-2.5 rounded-xl bg-[#00C6A6] hover:bg-[#00b094] text-slate-950 text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {editingPartner ? 'Update Partner' : 'Save Partner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingPartner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 w-full max-w-md shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200 text-left">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Associated Partner</h3>
                <p className="text-xs text-slate-500">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete <strong className="text-slate-900">{deletingPartner.name}</strong> from
              the associated partners directory? It will be removed from the homepage carousel immediately.
            </p>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingPartner(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-sm"
              >
                Delete Partner
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
