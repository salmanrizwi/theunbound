import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Users,
  Plus,
  Edit3,
  Trash2,
  Eye,
  Upload,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Search,
  Sliders,
  Monitor,
  Tablet,
  Smartphone,
  X,
  Image as ImageIcon,
  Linkedin,
  Instagram,
  Globe,
  Mail,
  Loader2,
  RefreshCw,
  ShieldAlert
} from 'lucide-react';
import { User } from '../../types';
import {
  CUSTOM_GRID_QUICK_PRESETS,
  DEFAULT_MEET_OUR_TEAM_CONFIG,
  MEET_OUR_TEAM_LAYOUT_PRESETS,
  MeetOurTeamGalleryConfig,
  MeetOurTeamLayoutPreset,
  TeamAlignment,
  TeamCornerRadius,
  TeamGalleryDisplayStyle,
  TeamImageAspectRatio,
  TeamImageSize,
  TeamMemberInput,
  TeamMemberRecord,
  TeamMemberStatus,
  TeamPreviewViewport,
  TeamSpacingScale,
  applyLayoutPreset,
  getEffectiveItemsPerPage,
  normalizeGalleryConfig
} from '../../types/teamGallery';
import {
  createTeamMember,
  deleteTeamMemberSafely,
  generateTeamMemberId,
  reorderTeamMembers,
  saveTeamGalleryConfig,
  setTeamMemberStatus,
  stripHtmlToPlainText,
  subscribeAllTeamMembers,
  subscribeTeamGalleryConfig,
  updateTeamMember
} from '../../services/teamGalleryService';
import {
  isTeamPhotoReferencedByOthers,
  uploadTeamMemberPhoto,
  validateTeamPhotoFile
} from '../../services/teamPhotoStorageService';
import { RichTextEditor } from '../common/RichTextEditor';
import { RichTextRenderer } from '../common/RichTextRenderer';
import { MeetOurTeamSection } from '../AboutUs/MeetOurTeamSection';

export interface AboutUsTeamManagerProps {
  currentUser?: User | null;
}

type ManagerWorkspaceTab = 'MEMBERS' | 'LAYOUT';
type MemberFilterStatus = 'ALL' | 'ACTIVE' | 'INACTIVE';

interface MemberFormState {
  teamMemberId: string;
  fullName: string;
  designation: string;
  introduction: string;
  imageStoragePath: string;
  imageUrl: string;
  thumbnailStoragePath: string;
  thumbnailUrl: string;
  imageWidth?: number;
  imageHeight?: number;
  linkedin: string;
  instagram: string;
  twitter: string;
  facebook: string;
  website: string;
  email: string;
  displayOrder: number;
  status: TeamMemberStatus;
}

function createEmptyFormState(nextDisplayOrder: number): MemberFormState {
  return {
    teamMemberId: generateTeamMemberId(),
    fullName: '',
    designation: '',
    introduction: '',
    imageStoragePath: '',
    imageUrl: '',
    thumbnailStoragePath: '',
    thumbnailUrl: '',
    linkedin: '',
    instagram: '',
    twitter: '',
    facebook: '',
    website: '',
    email: '',
    displayOrder: nextDisplayOrder,
    status: 'ACTIVE'
  };
}

function memberToFormState(member: TeamMemberRecord): MemberFormState {
  return {
    teamMemberId: member.teamMemberId,
    fullName: member.fullName,
    designation: member.designation,
    introduction: member.introduction,
    imageStoragePath: member.imageStoragePath,
    imageUrl: member.imageUrl,
    thumbnailStoragePath: member.thumbnailStoragePath || '',
    thumbnailUrl: member.thumbnailUrl || '',
    imageWidth: member.imageWidth,
    imageHeight: member.imageHeight,
    linkedin: member.socialLinks?.linkedin || '',
    instagram: member.socialLinks?.instagram || '',
    twitter: member.socialLinks?.twitter || '',
    facebook: member.socialLinks?.facebook || '',
    website: member.socialLinks?.website || '',
    email: member.socialLinks?.email || '',
    displayOrder: member.displayOrder ?? 0,
    status: member.status
  };
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const AboutUsTeamManager: React.FC<AboutUsTeamManagerProps> = ({ currentUser }) => {
  const [workspaceTab, setWorkspaceTab] = useState<ManagerWorkspaceTab>('MEMBERS');
  const [members, setMembers] = useState<TeamMemberRecord[]>([]);
  const [savedConfig, setSavedConfig] = useState<MeetOurTeamGalleryConfig>(DEFAULT_MEET_OUR_TEAM_CONFIG);
  const [draftConfig, setDraftConfig] = useState<MeetOurTeamGalleryConfig>(DEFAULT_MEET_OUR_TEAM_CONFIG);
  const [hasUnsavedLayout, setHasUnsavedLayout] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<MemberFilterStatus>('ALL');
  const [previewViewport, setPreviewViewport] = useState<TeamPreviewViewport>('desktop');

  // Toast / banner notifications
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Add / Edit modal state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMemberRecord | null>(null);
  const [formState, setFormState] = useState<MemberFormState>(() => createEmptyFormState(0));
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoOptimizationMeta, setPhotoOptimizationMeta] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSavingMember, setIsSavingMember] = useState(false);

  // Quick replace photograph ref (direct from card)
  const quickReplaceInputRef = useRef<HTMLInputElement | null>(null);
  const [quickReplaceTarget, setQuickReplaceTarget] = useState<TeamMemberRecord | null>(null);
  const [quickReplacingId, setQuickReplacingId] = useState<string | null>(null);

  // Preview profile modal
  const [previewMember, setPreviewMember] = useState<TeamMemberRecord | null>(null);

  // Delete confirmation modal
  const [deleteTarget, setDeleteTarget] = useState<TeamMemberRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Layout save state
  const [isSavingLayout, setIsSavingLayout] = useState(false);

  // Drag & Drop ordering state
  const [draggedMemberId, setDraggedMemberId] = useState<string | null>(null);
  const [dragOverMemberId, setDragOverMemberId] = useState<string | null>(null);
  const [isReordering, setIsReordering] = useState(false);

  const actor = useMemo(
    () => ({
      uid: currentUser?.id,
      id: currentUser?.id,
      email: currentUser?.email,
      role: currentUser?.role || 'ADMIN',
      name: currentUser?.name
    }),
    [currentUser]
  );

  const showBanner = (type: 'success' | 'error', message: string) => {
    setBanner({ type, message });
    window.setTimeout(() => {
      setBanner((prev) => (prev?.message === message ? null : prev));
    }, 5000);
  };

  useEffect(() => {
    let membersReady = false;
    let configReady = false;
    const checkReady = () => {
      if (membersReady && configReady) setIsLoading(false);
    };

    const unsubMembers = subscribeAllTeamMembers(
      (list) => {
        setMembers(list);
        membersReady = true;
        checkReady();
      },
      (err) => {
        showBanner('error', `Failed to load team members: ${err.message}`);
        membersReady = true;
        checkReady();
      }
    );

    const unsubConfig = subscribeTeamGalleryConfig(
      (cfg) => {
        setSavedConfig(cfg);
        setDraftConfig((prev) => (hasUnsavedLayout ? prev : cfg));
        configReady = true;
        checkReady();
      },
      (err) => {
        showBanner('error', `Failed to load gallery configuration: ${err.message}`);
        configReady = true;
        checkReady();
      }
    );

    return () => {
      unsubMembers();
      unsubConfig();
    };
  }, [hasUnsavedLayout]);

  const activeMembers = useMemo(
    () => members.filter((m) => m.status === 'ACTIVE'),
    [members]
  );
  const inactiveCount = members.length - activeMembers.length;

  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return members.filter((m) => {
      if (statusFilter !== 'ALL' && m.status !== statusFilter) return false;
      if (!q) return true;
      const plainBio = stripHtmlToPlainText(m.introduction).toLowerCase();
      return (
        m.fullName.toLowerCase().includes(q) ||
        m.designation.toLowerCase().includes(q) ||
        plainBio.includes(q)
      );
    });
  }, [members, searchQuery, statusFilter]);

  const updateDraftConfig = (updater: (prev: MeetOurTeamGalleryConfig) => MeetOurTeamGalleryConfig) => {
    setDraftConfig((prev) => normalizeGalleryConfig(updater(prev)));
    setHasUnsavedLayout(true);
  };

  const handleOpenAddModal = () => {
    setEditingMember(null);
    setFormState(createEmptyFormState(members.length));
    setPhotoOptimizationMeta(null);
    setFormError(null);
    setIsEditorOpen(true);
  };

  const handleOpenEditModal = (member: TeamMemberRecord) => {
    setEditingMember(member);
    setFormState(memberToFormState(member));
    setPhotoOptimizationMeta(
      member.imageWidth && member.imageHeight
        ? `Current photo: ${member.imageWidth} × ${member.imageHeight}px`
        : null
    );
    setFormError(null);
    setIsEditorOpen(true);
  };

  const handlePhotoUploadInModal = async (file: File | null | undefined) => {
    const validation = validateTeamPhotoFile(file);
    if (!validation.valid || !file) {
      setFormError(validation.error || 'Please select a valid image file.');
      return;
    }

    setFormError(null);
    setIsUploadingPhoto(true);
    try {
      const uploaded = await uploadTeamMemberPhoto(file, formState.teamMemberId);
      setFormState((prev) => ({
        ...prev,
        imageStoragePath: uploaded.imageStoragePath,
        imageUrl: uploaded.imageUrl,
        thumbnailStoragePath: uploaded.thumbnailStoragePath,
        thumbnailUrl: uploaded.thumbnailUrl,
        imageWidth: uploaded.imageWidth,
        imageHeight: uploaded.imageHeight
      }));
      setPhotoOptimizationMeta(
        `Optimized ${uploaded.imageWidth} × ${uploaded.imageHeight}px (${formatBytes(uploaded.originalBytes)} → ${formatBytes(uploaded.optimizedBytes)}, thumb ${formatBytes(uploaded.thumbnailBytes)})`
      );
    } catch (err: any) {
      setFormError(err?.message || 'Photograph upload failed. Please try again.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleQuickReplacePhotoClick = (member: TeamMemberRecord) => {
    setQuickReplaceTarget(member);
    if (quickReplaceInputRef.current) {
      quickReplaceInputRef.current.value = '';
      quickReplaceInputRef.current.click();
    }
  };

  const handleQuickReplacePhotoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const target = quickReplaceTarget;
    setQuickReplaceTarget(null);
    if (!file || !target) return;

    const validation = validateTeamPhotoFile(file);
    if (!validation.valid) {
      showBanner('error', validation.error || 'Invalid photograph file.');
      return;
    }

    setQuickReplacingId(target.teamMemberId);
    try {
      const uploaded = await uploadTeamMemberPhoto(file, target.teamMemberId);
      await updateTeamMember(
        target.teamMemberId,
        {
          teamMemberId: target.teamMemberId,
          fullName: target.fullName,
          designation: target.designation,
          introduction: target.introduction,
          imageStoragePath: uploaded.imageStoragePath,
          imageUrl: uploaded.imageUrl,
          thumbnailStoragePath: uploaded.thumbnailStoragePath,
          thumbnailUrl: uploaded.thumbnailUrl,
          imageWidth: uploaded.imageWidth,
          imageHeight: uploaded.imageHeight,
          socialLinks: target.socialLinks,
          displayOrder: target.displayOrder,
          status: target.status
        },
        target,
        members,
        actor
      );
      showBanner('success', `Updated profile photograph for ${target.fullName}.`);
    } catch (err: any) {
      showBanner('error', err?.message || 'Could not replace photograph.');
    } finally {
      setQuickReplacingId(null);
    }
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formState.imageUrl) {
      setFormError('Please upload a profile photograph before saving.');
      return;
    }

    const payload: TeamMemberInput = {
      teamMemberId: formState.teamMemberId,
      fullName: formState.fullName,
      designation: formState.designation,
      introduction: formState.introduction,
      imageStoragePath: formState.imageStoragePath,
      imageUrl: formState.imageUrl,
      thumbnailStoragePath: formState.thumbnailStoragePath || undefined,
      thumbnailUrl: formState.thumbnailUrl || undefined,
      imageWidth: formState.imageWidth,
      imageHeight: formState.imageHeight,
      socialLinks: {
        linkedin: formState.linkedin || undefined,
        instagram: formState.instagram || undefined,
        twitter: formState.twitter || undefined,
        facebook: formState.facebook || undefined,
        website: formState.website || undefined,
        email: formState.email || undefined
      },
      displayOrder: formState.displayOrder,
      status: formState.status
    };

    setIsSavingMember(true);
    try {
      if (editingMember) {
        await updateTeamMember(
          editingMember.teamMemberId,
          payload,
          editingMember,
          members,
          actor
        );
        showBanner('success', `Saved changes for ${payload.fullName.trim()}.`);
      } else {
        await createTeamMember(payload, actor);
        showBanner('success', `Added ${payload.fullName.trim()} to Meet Our Team.`);
      }
      setIsEditorOpen(false);
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save team member.');
    } finally {
      setIsSavingMember(false);
    }
  };

  const handleToggleStatus = async (member: TeamMemberRecord) => {
    const nextStatus: TeamMemberStatus = member.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await setTeamMemberStatus(member.teamMemberId, nextStatus, actor);
      showBanner(
        'success',
        nextStatus === 'ACTIVE'
          ? `${member.fullName} is now visible on the live About Us page.`
          : `${member.fullName} has been deactivated and hidden from the live page.`
      );
    } catch (err: any) {
      showBanner('error', err?.message || 'Could not update team member status.');
    }
  };

  const commitNewOrder = async (reorderedList: TeamMemberRecord[]) => {
    setMembers(
      reorderedList.map((m, idx) => ({
        ...m,
        displayOrder: idx
      }))
    );
    setIsReordering(true);
    try {
      await reorderTeamMembers(
        reorderedList.map((m) => m.teamMemberId),
        actor
      );
      showBanner('success', 'Team display order updated and published.');
    } catch (err: any) {
      showBanner('error', err?.message || 'Failed to save new display order.');
    } finally {
      setIsReordering(false);
    }
  };

  const handleMoveMember = async (memberId: string, direction: 'UP' | 'DOWN') => {
    const idx = members.findIndex((m) => m.teamMemberId === memberId);
    if (idx < 0) return;
    const swapIdx = direction === 'UP' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= members.length) return;

    const next = [...members];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    await commitNewOrder(next);
  };

  const handleDropOnMember = async (targetMemberId: string) => {
    if (!draggedMemberId || draggedMemberId === targetMemberId) {
      setDraggedMemberId(null);
      setDragOverMemberId(null);
      return;
    }

    const fromIdx = members.findIndex((m) => m.teamMemberId === draggedMemberId);
    const toIdx = members.findIndex((m) => m.teamMemberId === targetMemberId);
    setDraggedMemberId(null);
    setDragOverMemberId(null);
    if (fromIdx < 0 || toIdx < 0) return;

    const next = [...members];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    await commitNewOrder(next);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const result = await deleteTeamMemberSafely(deleteTarget, members);
      const preservedMsg =
        result.preservedSharedPaths.length > 0
          ? ' Shared media assets were safely preserved.'
          : '';
      showBanner('success', `Deleted ${deleteTarget.fullName} from Meet Our Team.${preservedMsg}`);
      setDeleteTarget(null);
    } catch (err: any) {
      showBanner('error', err?.message || 'Could not delete team member.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePublishLayout = async () => {
    setIsSavingLayout(true);
    try {
      const saved = await saveTeamGalleryConfig(draftConfig, actor);
      setSavedConfig(saved);
      setDraftConfig(saved);
      setHasUnsavedLayout(false);
      showBanner('success', 'Gallery layout & section settings published live to About Us.');
    } catch (err: any) {
      showBanner('error', err?.message || 'Could not publish gallery layout.');
    } finally {
      setIsSavingLayout(false);
    }
  };

  const handleResetLayoutDraft = () => {
    setDraftConfig({ ...DEFAULT_MEET_OUR_TEAM_CONFIG });
    setHasUnsavedLayout(true);
  };

  const isDeleteTargetAssetShared = useMemo(() => {
    if (!deleteTarget) return false;
    return isTeamPhotoReferencedByOthers(
      deleteTarget.imageStoragePath,
      deleteTarget.imageUrl,
      members,
      deleteTarget.teamMemberId
    );
  }, [deleteTarget, members]);

  const effectivePreviewCapacity = getEffectiveItemsPerPage(draftConfig, previewViewport);

  return (
    <div className="space-y-6">
      {/* Hidden input for one-click photograph replacement from cards */}
      <input
        ref={quickReplaceInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="hidden"
        onChange={handleQuickReplacePhotoFile}
      />

      {/* Top Header */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[#008972] font-bold text-xs uppercase tracking-wider">
            <Users className="w-4 h-4" />
            <span>Pages → About Us → Meet Our Team</span>
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 font-sans">
            About Us: Meet Our Team Gallery Manager
          </h2>
          <p className="text-xs text-slate-500 max-w-2xl">
            Manage team member profiles, photographs, display order, and custom responsive gallery layout. Published changes appear automatically on the live About Us page.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center divide-x divide-slate-200 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
            <div className="pr-3">
              <span className="text-slate-500">Active</span>
              <span className="ml-1.5 font-extrabold text-emerald-700">{activeMembers.length}</span>
            </div>
            <div className="px-3">
              <span className="text-slate-500">Inactive</span>
              <span className="ml-1.5 font-extrabold text-slate-700">{inactiveCount}</span>
            </div>
            <div className="pl-3">
              <span className="text-slate-500">Grid</span>
              <span className="ml-1.5 font-extrabold text-slate-900">
                {savedConfig.rows}×{savedConfig.desktopColumns}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#00C6A6]" />
            <span>Add Team Member</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {banner && (
        <div
          role="status"
          className={`flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border text-xs font-semibold ${
            banner.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {banner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{banner.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="text-current opacity-60 hover:opacity-100 cursor-pointer"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Primary Workspace Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setWorkspaceTab('MEMBERS')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            workspaceTab === 'MEMBERS'
              ? 'bg-slate-900 text-white'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Team Members ({members.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setWorkspaceTab('LAYOUT')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            workspaceTab === 'LAYOUT'
              ? 'bg-slate-900 text-white'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Gallery Layout & Live Preview</span>
          {hasUnsavedLayout && (
            <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[10px] font-black">
              Unsaved
            </span>
          )}
        </button>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: TEAM MEMBERS MANAGEMENT                                        */}
      {/* ===================================================================== */}
      {workspaceTab === 'MEMBERS' && (
        <div className="space-y-4">
          {/* Toolbar: Search, Filter & Reorder Hint */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search team members by name, designation, or bio..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-[#00C6A6]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(['ALL', 'ACTIVE', 'INACTIVE'] as MemberFilterStatus[]).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    statusFilter === status
                      ? 'bg-[#00C6A6] text-slate-950'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {status === 'ALL'
                    ? `All (${members.length})`
                    : status === 'ACTIVE'
                      ? `Active (${activeMembers.length})`
                      : `Inactive (${inactiveCount})`}
                </button>
              ))}
            </div>
          </div>

          {members.length > 1 && !searchQuery && statusFilter === 'ALL' && (
            <p className="text-[11px] text-slate-500 flex items-center gap-1.5 px-1">
              <GripVertical className="w-3.5 h-3.5 text-slate-400" />
              <span>
                Drag and drop rows—or use the up/down arrows—to change display order on the live About Us page.
              </span>
              {isReordering && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#008972] ml-1" />}
            </p>
          )}

          {/* Member List */}
          {isLoading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#008972]" />
              <span>Loading Meet Our Team records...</span>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
                <Users className="w-6 h-6" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-base font-bold text-slate-900">
                  {members.length === 0 ? 'No Team Members Added Yet' : 'No Matching Team Members'}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {members.length === 0
                    ? 'The live About Us page displays only real team members added and activated here. Click "Add Team Member" to publish your first profile.'
                    : 'Try clearing your search filter to view all team members.'}
                </p>
              </div>
              {members.length === 0 && (
                <button
                  type="button"
                  onClick={handleOpenAddModal}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-[#00C6A6]" />
                  <span>Add First Team Member</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMembers.map((member) => {
                const fullIndex = members.findIndex((m) => m.teamMemberId === member.teamMemberId);
                const canReorder = !searchQuery && statusFilter === 'ALL';
                const isDragging = draggedMemberId === member.teamMemberId;
                const isDragOver = dragOverMemberId === member.teamMemberId;
                const isReplacing = quickReplacingId === member.teamMemberId;

                return (
                  <div
                    key={member.teamMemberId}
                    draggable={canReorder}
                    onDragStart={() => canReorder && setDraggedMemberId(member.teamMemberId)}
                    onDragOver={(e) => {
                      if (!canReorder) return;
                      e.preventDefault();
                      setDragOverMemberId(member.teamMemberId);
                    }}
                    onDragLeave={() => {
                      if (dragOverMemberId === member.teamMemberId) setDragOverMemberId(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (canReorder) handleDropOnMember(member.teamMemberId);
                    }}
                    onDragEnd={() => {
                      setDraggedMemberId(null);
                      setDragOverMemberId(null);
                    }}
                    className={`bg-white rounded-2xl border p-4 transition-all flex flex-col md:flex-row md:items-center gap-4 ${
                      isDragging
                        ? 'opacity-50 border-slate-400'
                        : isDragOver
                          ? 'border-[#00C6A6] ring-2 ring-[#00C6A6]/25'
                          : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Order & Drag Handle */}
                    <div className="flex items-center gap-2 shrink-0">
                      {canReorder && (
                        <div
                          title="Drag to reorder"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-grab active:cursor-grabbing"
                        >
                          <GripVertical className="w-4 h-4" />
                        </div>
                      )}
                      <div className="flex flex-col items-center gap-0.5">
                        <button
                          type="button"
                          disabled={!canReorder || fullIndex <= 0 || isReordering}
                          onClick={() => handleMoveMember(member.teamMemberId, 'UP')}
                          aria-label={`Move ${member.fullName} up`}
                          className="p-1 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-[10px] font-mono font-bold text-slate-500">
                          #{fullIndex + 1}
                        </span>
                        <button
                          type="button"
                          disabled={!canReorder || fullIndex >= members.length - 1 || isReordering}
                          onClick={() => handleMoveMember(member.teamMemberId, 'DOWN')}
                          aria-label={`Move ${member.fullName} down`}
                          className="p-1 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Thumbnail Photo */}
                    <div className="relative w-16 h-20 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                      <img
                        src={member.thumbnailUrl || member.imageUrl}
                        alt={member.fullName}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover object-top"
                      />
                      {isReplacing && (
                        <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center">
                          <Loader2 className="w-4 h-4 text-white animate-spin" />
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900 truncate">
                          {member.fullName}
                        </h3>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                            member.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {member.status}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-[#008972]">{member.designation}</p>
                      <p className="text-xs text-slate-500 line-clamp-2">
                        {stripHtmlToPlainText(member.introduction)}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(member)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                          member.status === 'ACTIVE'
                            ? 'bg-white border-slate-200 text-slate-700 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-800'
                            : 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700'
                        }`}
                      >
                        {member.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                      </button>

                      <button
                        type="button"
                        disabled={isReplacing}
                        onClick={() => handleQuickReplacePhotoClick(member)}
                        title="Replace Photograph"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span className="hidden xl:inline">Replace Photo</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPreviewMember(member)}
                        title="Preview Profile"
                        className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(member)}
                        title="Edit Team Member"
                        className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:text-[#008972] hover:border-[#00C6A6] hover:bg-teal-50/40 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeleteTarget(member)}
                        title="Delete Team Member"
                        className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-rose-700 hover:border-rose-200 hover:bg-rose-50 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: GALLERY LAYOUT SETTINGS & LIVE PREVIEW                         */}
      {/* ===================================================================== */}
      {workspaceTab === 'LAYOUT' && (
        <div className="space-y-6">
          {/* Publish Sticky Action Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold text-slate-900">
                Custom Gallery Layout & Section Settings
              </h3>
              <p className="text-xs text-slate-500">
                Adjust rows, columns, aspect ratios, spacing, and copy below. Preview across devices before publishing.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetLayoutDraft}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Defaults</span>
              </button>
              <button
                type="button"
                disabled={isSavingLayout}
                onClick={handlePublishLayout}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00C6A6] hover:bg-[#00b093] text-slate-950 text-xs font-extrabold transition-colors cursor-pointer disabled:opacity-60"
              >
                {isSavingLayout ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>{isSavingLayout ? 'Publishing...' : 'Publish Layout Changes'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* Controls Column */}
            <div className="xl:col-span-5 space-y-5">
              {/* Section Heading & Introductory Text */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                  1. Section Heading & Introduction
                </h4>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">
                    Section Heading
                  </label>
                  <input
                    type="text"
                    value={draftConfig.heading}
                    onChange={(e) =>
                      updateDraftConfig((prev) => ({ ...prev, heading: e.target.value }))
                    }
                    maxLength={140}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-[#00C6A6]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">
                    Introductory Paragraph
                  </label>
                  <textarea
                    rows={3}
                    value={draftConfig.introText}
                    onChange={(e) =>
                      updateDraftConfig((prev) => ({ ...prev, introText: e.target.value }))
                    }
                    maxLength={1000}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs leading-relaxed focus:outline-none focus:border-[#00C6A6]"
                  />
                </div>
              </div>

              {/* Layout Presets (A - E) */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                  2. Gallery Layout Preset & Rows × Columns
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {MEET_OUR_TEAM_LAYOUT_PRESETS.map((preset) => {
                    const selected = draftConfig.layoutPreset === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() =>
                          updateDraftConfig((prev) => applyLayoutPreset(prev, preset.id))
                        }
                        className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${
                          selected
                            ? 'border-[#00C6A6] bg-teal-50/50 ring-1 ring-[#00C6A6]'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="text-xs font-bold text-slate-900">{preset.label}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                          {preset.description}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Grid Quick Chips */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <span className="text-[11px] font-bold text-slate-600 block">
                    Quick Rows × Columns Combinations
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {CUSTOM_GRID_QUICK_PRESETS.map((chip) => (
                      <button
                        key={chip.label}
                        type="button"
                        onClick={() =>
                          updateDraftConfig((prev) => ({
                            ...prev,
                            layoutPreset: 'LAYOUT_E_CUSTOM',
                            rows: chip.rows,
                            desktopColumns: chip.desktopColumns,
                            tabletColumns: chip.tabletColumns,
                            itemsPerPage: null
                          }))
                        }
                        className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-teal-50 hover:border-[#00C6A6] text-[11px] font-semibold text-slate-700 cursor-pointer"
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Responsive Column & Row Controls */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Desktop Columns (1–6)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={6}
                      value={draftConfig.desktopColumns}
                      onChange={(e) =>
                        updateDraftConfig((prev) => ({
                          ...prev,
                          layoutPreset: 'LAYOUT_E_CUSTOM',
                          desktopColumns: Number(e.target.value)
                        }))
                      }
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Tablet Columns (1–4)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={4}
                      value={draftConfig.tabletColumns}
                      onChange={(e) =>
                        updateDraftConfig((prev) => ({
                          ...prev,
                          layoutPreset: 'LAYOUT_E_CUSTOM',
                          tabletColumns: Number(e.target.value)
                        }))
                      }
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Mobile Columns (1–2)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={2}
                      value={draftConfig.mobileColumns}
                      onChange={(e) =>
                        updateDraftConfig((prev) => ({
                          ...prev,
                          layoutPreset: 'LAYOUT_E_CUSTOM',
                          mobileColumns: Number(e.target.value)
                        }))
                      }
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Rows per Page (1–12)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={draftConfig.rows}
                      onChange={(e) =>
                        updateDraftConfig((prev) => ({
                          ...prev,
                          layoutPreset: 'LAYOUT_E_CUSTOM',
                          rows: Number(e.target.value)
                        }))
                      }
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Max Items / Page (leave blank for Rows × Columns)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      placeholder={`Auto (${draftConfig.rows * draftConfig.desktopColumns} on desktop)`}
                      value={draftConfig.itemsPerPage ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        updateDraftConfig((prev) => ({
                          ...prev,
                          itemsPerPage: raw === '' ? null : Number(raw)
                        }));
                      }}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Card, Image Dimensions & Visual Styling */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                  3. Image Dimensions, Spacing & Card Styling
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Image Aspect Ratio
                    </label>
                    <select
                      value={draftConfig.imageAspectRatio}
                      onChange={(e) =>
                        updateDraftConfig((prev) => ({
                          ...prev,
                          imageAspectRatio: e.target.value as TeamImageAspectRatio
                        }))
                      }
                      className="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-xs font-semibold bg-white"
                    >
                      <option value="4:5">4:5 (Editorial Portrait)</option>
                      <option value="3:4">3:4 (Classic Portrait)</option>
                      <option value="1:1">1:1 (Square)</option>
                      <option value="4:3">4:3 (Landscape)</option>
                      <option value="16:9">16:9 (Widescreen)</option>
                      <option value="auto">Natural / Original Ratio</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Image Size
                    </label>
                    <select
                      value={draftConfig.imageSize}
                      onChange={(e) =>
                        updateDraftConfig((prev) => ({
                          ...prev,
                          imageSize: e.target.value as TeamImageSize
                        }))
                      }
                      className="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-xs font-semibold bg-white"
                    >
                      <option value="full">Full Card Width</option>
                      <option value="lg">Large (288px)</option>
                      <option value="md">Medium (224px)</option>
                      <option value="sm">Compact Portrait (160px)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Image Corner Radius
                    </label>
                    <select
                      value={draftConfig.imageCornerRadius}
                      onChange={(e) =>
                        updateDraftConfig((prev) => ({
                          ...prev,
                          imageCornerRadius: e.target.value as TeamCornerRadius
                        }))
                      }
                      className="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-xs font-semibold bg-white"
                    >
                      <option value="none">Sharp (None)</option>
                      <option value="sm">Subtle (6px)</option>
                      <option value="md">Medium (12px)</option>
                      <option value="lg">Rounded (16px)</option>
                      <option value="xl">Extra Rounded (24px)</option>
                      <option value="full">Circular (Full — best with 1:1)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Gallery Display Style
                    </label>
                    <select
                      value={draftConfig.displayStyle}
                      onChange={(e) =>
                        updateDraftConfig((prev) => ({
                          ...prev,
                          displayStyle: e.target.value as TeamGalleryDisplayStyle
                        }))
                      }
                      className="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-xs font-semibold bg-white"
                    >
                      <option value="editorial">Editorial Clean</option>
                      <option value="card">Elevated Card</option>
                      <option value="bordered">Subtle Bordered Surface</option>
                      <option value="minimal">Minimal Unboxed</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Horizontal Spacing
                    </label>
                    <select
                      value={draftConfig.horizontalSpacing}
                      onChange={(e) =>
                        updateDraftConfig((prev) => ({
                          ...prev,
                          horizontalSpacing: e.target.value as TeamSpacingScale
                        }))
                      }
                      className="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-xs font-semibold bg-white"
                    >
                      <option value="tight">Tight (16px)</option>
                      <option value="normal">Normal (24px)</option>
                      <option value="relaxed">Relaxed (32px)</option>
                      <option value="wide">Wide (40px)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Vertical Spacing
                    </label>
                    <select
                      value={draftConfig.verticalSpacing}
                      onChange={(e) =>
                        updateDraftConfig((prev) => ({
                          ...prev,
                          verticalSpacing: e.target.value as TeamSpacingScale
                        }))
                      }
                      className="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-xs font-semibold bg-white"
                    >
                      <option value="tight">Tight (20px)</option>
                      <option value="normal">Normal (28px)</option>
                      <option value="relaxed">Relaxed (40px)</option>
                      <option value="wide">Wide (48px)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Card Alignment
                    </label>
                    <select
                      value={draftConfig.cardAlignment}
                      onChange={(e) =>
                        updateDraftConfig((prev) => ({
                          ...prev,
                          cardAlignment: e.target.value as TeamAlignment
                        }))
                      }
                      className="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-xs font-semibold bg-white"
                    >
                      <option value="left">Left Aligned</option>
                      <option value="center">Center Aligned</option>
                      <option value="right">Right Aligned</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Text Alignment
                    </label>
                    <select
                      value={draftConfig.textAlignment}
                      onChange={(e) =>
                        updateDraftConfig((prev) => ({
                          ...prev,
                          textAlignment: e.target.value as TeamAlignment
                        }))
                      }
                      className="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-xs font-semibold bg-white"
                    >
                      <option value="left">Left Aligned</option>
                      <option value="center">Center Aligned</option>
                      <option value="right">Right Aligned</option>
                    </select>
                  </div>
                </div>

                <label className="flex items-center gap-2.5 pt-2 border-t border-slate-100 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draftConfig.showSocialLinks}
                    onChange={(e) =>
                      updateDraftConfig((prev) => ({
                        ...prev,
                        showSocialLinks: e.target.checked
                      }))
                    }
                    className="w-4 h-4 rounded accent-[#00C6A6]"
                  />
                  <span className="text-xs font-semibold text-slate-700">
                    Display optional social media links on team member cards
                  </span>
                </label>
              </div>
            </div>

            {/* Live Preview Column */}
            <div className="xl:col-span-7 space-y-3">
              <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-extrabold text-slate-900 block">
                    Live Responsive Preview
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Showing up to {effectivePreviewCapacity} active member{effectivePreviewCapacity === 1 ? '' : 's'} per page ({activeMembers.length} active total)
                  </span>
                </div>

                <div className="inline-flex items-center rounded-xl border border-slate-200 p-1 bg-slate-50 gap-1">
                  {[
                    { id: 'desktop', label: 'Desktop', icon: Monitor },
                    { id: 'tablet', label: 'Tablet', icon: Tablet },
                    { id: 'mobile', label: 'Mobile', icon: Smartphone }
                  ].map((vp) => {
                    const Icon = vp.icon;
                    const active = previewViewport === vp.id;
                    return (
                      <button
                        key={vp.id}
                        type="button"
                        onClick={() => setPreviewViewport(vp.id as TeamPreviewViewport)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                          active
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{vp.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-3xl bg-slate-100 border border-slate-200 p-4 sm:p-6 overflow-x-auto">
                <div
                  className={`mx-auto transition-all duration-300 ${
                    previewViewport === 'mobile'
                      ? 'max-w-[390px]'
                      : previewViewport === 'tablet'
                        ? 'max-w-[740px]'
                        : 'w-full'
                  }`}
                >
                  <MeetOurTeamSection
                    previewConfig={draftConfig}
                    previewMembers={activeMembers}
                    previewViewport={previewViewport}
                    isPreviewMode
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* ADD / EDIT TEAM MEMBER MODAL                                          */}
      {/* ===================================================================== */}
      {isEditorOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="team-editor-modal-title"
        >
          <form
            onSubmit={handleSaveMember}
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden"
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 id="team-editor-modal-title" className="text-lg font-extrabold text-slate-900">
                  {editingMember ? `Edit Team Member — ${editingMember.fullName}` : 'Add Team Member'}
                </h3>
                <p className="text-xs text-slate-500">
                  Upload a professional photograph and complete profile details for the About Us gallery.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Photo Upload + Core Identity */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                <div className="md:col-span-4 space-y-2.5">
                  <label className="text-xs font-bold text-slate-800 block">
                    Profile Photograph <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 aspect-[4/5] overflow-hidden flex flex-col items-center justify-center text-center p-3">
                    {formState.imageUrl ? (
                      <>
                        <img
                          src={formState.imageUrl}
                          alt="Profile preview"
                          referrerPolicy="no-referrer"
                          className="absolute inset-0 w-full h-full object-cover object-top"
                        />
                        <label className="relative z-10 mt-auto bg-slate-900/85 hover:bg-slate-900 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer">
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Replace Photo</span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/avif"
                            className="hidden"
                            disabled={isUploadingPhoto}
                            onChange={(e) => handlePhotoUploadInModal(e.target.files?.[0])}
                          />
                        </label>
                      </>
                    ) : (
                      <label className="w-full h-full flex flex-col items-center justify-center gap-2 cursor-pointer">
                        <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-[#008972]">
                          <Upload className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-bold text-slate-700">
                          Click to upload photograph
                        </span>
                        <span className="text-[10px] text-slate-500">
                          JPG, PNG, WebP or AVIF • Max 10 MB
                        </span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/avif"
                          className="hidden"
                          disabled={isUploadingPhoto}
                          onChange={(e) => handlePhotoUploadInModal(e.target.files?.[0])}
                        />
                      </label>
                    )}

                    {isUploadingPhoto && (
                      <div className="absolute inset-0 z-20 bg-slate-950/65 text-white flex flex-col items-center justify-center gap-2 text-xs font-bold">
                        <Loader2 className="w-5 h-5 animate-spin text-[#00C6A6]" />
                        <span>Optimizing & uploading...</span>
                      </div>
                    )}
                  </div>
                  {photoOptimizationMeta && (
                    <p className="text-[10px] text-slate-500 leading-snug">
                      {photoOptimizationMeta}
                    </p>
                  )}
                </div>

                <div className="md:col-span-8 space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-800 block mb-1">
                      Full Name <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={120}
                      value={formState.fullName}
                      onChange={(e) =>
                        setFormState((prev) => ({ ...prev, fullName: e.target.value }))
                      }
                      placeholder="e.g., Kenji Takahashi"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-[#00C6A6]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-800 block mb-1">
                      Role / Designation <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={140}
                      value={formState.designation}
                      onChange={(e) =>
                        setFormState((prev) => ({ ...prev, designation: e.target.value }))
                      }
                      placeholder="e.g., Senior Japan Itinerary Specialist"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-[#00C6A6]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-800 block mb-1">
                        Display Order
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={9999}
                        value={formState.displayOrder}
                        onChange={(e) =>
                          setFormState((prev) => ({
                            ...prev,
                            displayOrder: Math.max(0, Number(e.target.value) || 0)
                          }))
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-800 block mb-1">
                        Publication Status <span className="text-rose-600">*</span>
                      </label>
                      <select
                        value={formState.status}
                        onChange={(e) =>
                          setFormState((prev) => ({
                            ...prev,
                            status: e.target.value as TeamMemberStatus
                          }))
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white"
                      >
                        <option value="ACTIVE">Active (Visible on About Us)</option>
                        <option value="INACTIVE">Inactive (Hidden Draft)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Short Introduction (Rich Text Editor) */}
              <div>
                <RichTextEditor
                  label="Short Introduction / Biography *"
                  helperText="Introduce this team member's expertise, destination knowledge, and role in crafting journeys."
                  value={formState.introduction}
                  onChange={(html) =>
                    setFormState((prev) => ({ ...prev, introduction: html }))
                  }
                  placeholder="Write a concise, authentic introduction..."
                  minHeight="130px"
                  compact
                />
              </div>

              {/* Optional Social Media Links */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                  Optional Social Media & Contact Links
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="relative">
                    <Linkedin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={formState.linkedin}
                      onChange={(e) =>
                        setFormState((prev) => ({ ...prev, linkedin: e.target.value }))
                      }
                      placeholder="LinkedIn URL (https://linkedin.com/in/...)"
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs"
                    />
                  </div>
                  <div className="relative">
                    <Instagram className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={formState.instagram}
                      onChange={(e) =>
                        setFormState((prev) => ({ ...prev, instagram: e.target.value }))
                      }
                      placeholder="Instagram URL (https://instagram.com/...)"
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs"
                    />
                  </div>
                  <div className="relative">
                    <Globe className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={formState.twitter}
                      onChange={(e) =>
                        setFormState((prev) => ({ ...prev, twitter: e.target.value }))
                      }
                      placeholder="X / Twitter URL (https://x.com/...)"
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs"
                    />
                  </div>
                  <div className="relative">
                    <Globe className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={formState.website}
                      onChange={(e) =>
                        setFormState((prev) => ({ ...prev, website: e.target.value }))
                      }
                      placeholder="Portfolio / Website URL"
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs"
                    />
                  </div>
                  <div className="relative sm:col-span-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={formState.email}
                      onChange={(e) =>
                        setFormState((prev) => ({ ...prev, email: e.target.value }))
                      }
                      placeholder="Optional public work email (e.g., name@theunbound.in)"
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingMember || isUploadingPhoto}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer disabled:opacity-60"
              >
                {isSavingMember ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#00C6A6]" />
                ) : (
                  <Save className="w-4 h-4 text-[#00C6A6]" />
                )}
                <span>
                  {isSavingMember
                    ? 'Saving...'
                    : editingMember
                      ? 'Save Member Changes'
                      : 'Publish Team Member'}
                </span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ===================================================================== */}
      {/* PREVIEW PROFILE MODAL                                                 */}
      {/* ===================================================================== */}
      {previewMember && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setPreviewMember(null)}
        >
          <div
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Profile Preview — {previewMember.fullName}
                </h3>
                <p className="text-xs font-semibold text-[#008972]">{previewMember.designation}</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewMember(null)}
                className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-12 gap-5 items-start">
              <div className="sm:col-span-5">
                <div className="aspect-[4/5] rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
                  <img
                    src={previewMember.imageUrl || previewMember.thumbnailUrl}
                    alt={previewMember.fullName}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover object-top"
                  />
                </div>
              </div>
              <div className="sm:col-span-7 space-y-3">
                <div className="text-[11px] text-slate-500">
                  Status:{' '}
                  <span className="font-bold text-slate-900">{previewMember.status}</span> • Order:{' '}
                  <span className="font-bold text-slate-900">#{previewMember.displayOrder + 1}</span>
                </div>
                <RichTextRenderer
                  content={previewMember.introduction}
                  className="text-xs sm:text-sm text-slate-700 leading-relaxed"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* DELETE CONFIRMATION MODAL                                             */}
      {/* ===================================================================== */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-member-title"
        >
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 id="delete-member-title" className="text-base font-extrabold text-slate-900">
                  Delete Team Member?
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Are you sure you want to permanently remove{' '}
                  <span className="font-bold text-slate-900">{deleteTarget.fullName}</span> (
                  {deleteTarget.designation}) from the Meet Our Team gallery?
                </p>
                {isDeleteTargetAssetShared && (
                  <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-2">
                    This photograph is referenced by another profile and will be preserved automatically.
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer disabled:opacity-60"
              >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>{isDeleting ? 'Deleting...' : 'Delete Permanently'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
