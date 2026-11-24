import React, { useState, useEffect, useRef } from 'react';
import {
  Video,
  CheckCircle2,
  AlertCircle,
  Upload,
  Trash2,
  Save,
  Monitor,
  Tablet,
  Smartphone,
  Plus,
  ArrowUp,
  ArrowDown,
  ShieldCheck,
  Loader2,
  ExternalLink,
  Image as ImageIcon,
  RotateCcw,
} from 'lucide-react';
import {
  HomepageConfig,
  HomepagePortalTutorialVideoConfig,
  HomepageCashbackRewardsVideoConfig,
  HomepageVideoBackgroundStyle,
} from '../../types';
import {
  INITIAL_PORTAL_TUTORIAL_VIDEO_CONFIG,
  INITIAL_CASHBACK_REWARDS_VIDEO_CONFIG,
} from '../../data/initialHomepage';
import { AppDatabase } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { canUserAccessCMS } from '../../services/permissionEngine';
import { auth as firebaseAuth } from '../../services/firebase';
import {
  parseAndValidateYouTubeUrl,
  validatePortalTutorialVideoConfig,
  validateCashbackRewardsVideoConfig,
  clampTutorialVideoWidthPercent,
} from '../../utils/youtubeValidation';
import {
  uploadHomepageVideoThumbnail,
  deleteHomepageVideoThumbnail,
  validateThumbnailFile,
} from '../../services/homepageVideoStorageService';
import { PortalTutorialVideoSection } from '../public/PortalTutorialVideoSection';
import { CashbackRewardsVideoSection } from '../public/CashbackRewardsVideoSection';

interface HomepageVideoSectionManagerProps {
  sectionKey: 'portalTutorialVideo' | 'cashbackRewardsVideo';
  sequencePositionLabel?: string;
}

interface ServerValidationState {
  status: 'idle' | 'checking' | 'verified' | 'warning' | 'error';
  message?: string;
  videoTitle?: string;
  authorName?: string;
}

const BACKGROUND_OPTIONS: Array<{ value: HomepageVideoBackgroundStyle; label: string }> = [
  { value: 'pure-white', label: 'Pure White' },
  { value: 'soft-slate', label: 'Soft Slate' },
  { value: 'subtle-teal-wash', label: 'Subtle Teal Wash' },
  { value: 'dark-charcoal', label: 'Dark Charcoal' },
];

export const HomepageVideoSectionManager: React.FC<HomepageVideoSectionManagerProps> = ({
  sectionKey,
  sequencePositionLabel,
}) => {
  const { user } = useAuth();
  const db = AppDatabase.getInstance();
  const hasPermission = canUserAccessCMS(user);

  const isPortalSection = sectionKey === 'portalTutorialVideo';
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadPortalDraft = (cfg: HomepageConfig): HomepagePortalTutorialVideoConfig => ({
    ...INITIAL_PORTAL_TUTORIAL_VIDEO_CONFIG,
    ...(cfg.portalTutorialVideoConfig || {}),
    isActive: cfg.showPortalTutorialVideo !== false && cfg.portalTutorialVideoConfig?.isActive !== false,
  });

  const loadCashbackDraft = (cfg: HomepageConfig): HomepageCashbackRewardsVideoConfig => ({
    ...INITIAL_CASHBACK_REWARDS_VIDEO_CONFIG,
    ...(cfg.cashbackRewardsVideoConfig || {}),
    benefitPoints: Array.isArray(cfg.cashbackRewardsVideoConfig?.benefitPoints)
      ? cfg.cashbackRewardsVideoConfig.benefitPoints.map((pt) => ({ ...pt }))
      : INITIAL_CASHBACK_REWARDS_VIDEO_CONFIG.benefitPoints.map((pt) => ({ ...pt })),
    isActive: cfg.showCashbackRewardsVideo !== false && cfg.cashbackRewardsVideoConfig?.isActive !== false,
  });

  const [portalDraft, setPortalDraft] = useState<HomepagePortalTutorialVideoConfig>(() =>
    loadPortalDraft(db.getHomepageConfig())
  );
  const [cashbackDraft, setCashbackDraft] = useState<HomepageCashbackRewardsVideoConfig>(() =>
    loadCashbackDraft(db.getHomepageConfig())
  );

  const [isDirty, setIsDirty] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [previewDevice, setPreviewDevice] = useState<'DESKTOP' | 'TABLET' | 'MOBILE'>('DESKTOP');
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const [thumbError, setThumbError] = useState<string | null>(null);
  const [serverValidation, setServerValidation] = useState<ServerValidationState>({ status: 'idle' });
  const [newBenefitInput, setNewBenefitInput] = useState('');

  useEffect(() => {
    return db.subscribe(() => {
      if (!isDirty) {
        const latest = db.getHomepageConfig();
        setPortalDraft(loadPortalDraft(latest));
        setCashbackDraft(loadCashbackDraft(latest));
      }
    });
  }, [isDirty]);

  if (!hasPermission) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 flex items-center gap-2.5">
        <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
        <span>Administrative CMS permissions are required to edit Homepage video sections.</span>
      </div>
    );
  }

  const activeYoutubeUrl = isPortalSection ? portalDraft.youtubeUrl : cashbackDraft.youtubeUrl;
  const activeCustomThumbnail = isPortalSection ? portalDraft.customThumbnailUrl : cashbackDraft.customThumbnailUrl;
  const activeCustomThumbnailPath = isPortalSection
    ? portalDraft.customThumbnailStoragePath
    : cashbackDraft.customThumbnailStoragePath;

  const clientUrlCheck = activeYoutubeUrl.trim() ? parseAndValidateYouTubeUrl(activeYoutubeUrl) : null;

  const handleYoutubeUrlChange = (rawValue: string) => {
    const parsed = rawValue.trim() ? parseAndValidateYouTubeUrl(rawValue) : null;
    const nextVideoId = parsed?.valid && parsed.videoId ? parsed.videoId : '';
    setServerValidation({ status: 'idle' });
    setValidationErrors([]);
    setSaveMessage(null);
    setIsDirty(true);

    if (isPortalSection) {
      setPortalDraft((prev) => ({
        ...prev,
        youtubeUrl: rawValue,
        youtubeVideoId: nextVideoId,
      }));
    } else {
      setCashbackDraft((prev) => ({
        ...prev,
        youtubeUrl: rawValue,
        youtubeVideoId: nextVideoId,
      }));
    }
  };

  const handleVerifyYoutubeOnServer = async () => {
    const urlToCheck = activeYoutubeUrl.trim();
    const localCheck = parseAndValidateYouTubeUrl(urlToCheck);
    if (!localCheck.valid || !localCheck.videoId) {
      setServerValidation({
        status: 'error',
        message: localCheck.error || 'Please enter a valid YouTube URL first.',
      });
      return;
    }

    setServerValidation({ status: 'checking', message: 'Verifying YouTube video availability...' });

    try {
      const idToken = firebaseAuth?.currentUser ? await firebaseAuth.currentUser.getIdToken() : '';

      if (!idToken) {
        setServerValidation({
          status: 'warning',
          message: `Valid YouTube ID (${localCheck.videoId}). Sign in with an active Firebase session to verify live YouTube availability.`,
        });
        return;
      }

      const res = await fetch('/api/admin/homepage/validate-youtube', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ url: urlToCheck }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.valid) {
        if (data.warning || data.embeddable === false) {
          setServerValidation({
            status: 'warning',
            message: data.warning || 'Video verified, but third-party embedding may be restricted.',
            videoTitle: data.title,
            authorName: data.authorName,
          });
        } else {
          setServerValidation({
            status: 'verified',
            message: data.title
              ? `Verified on YouTube: "${data.title}"${data.authorName ? ` — ${data.authorName}` : ''}`
              : `Verified on YouTube (ID: ${data.videoId}).`,
            videoTitle: data.title,
            authorName: data.authorName,
          });
        }
      } else {
        setServerValidation({
          status: 'error',
          message: data.error || 'Unable to verify this YouTube video. Check that the video is public or unlisted.',
        });
      }
    } catch {
      setServerValidation({
        status: 'warning',
        message: `YouTube URL format is valid (ID: ${localCheck.videoId}). Server verification is temporarily unreachable.`,
      });
    }
  };

  const handleThumbnailFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setThumbError(null);
    const check = validateThumbnailFile(file);
    if (!check.valid) {
      setThumbError(check.error || 'Invalid image file.');
      return;
    }

    setUploadingThumb(true);
    try {
      const previousPath = activeCustomThumbnailPath;
      const uploaded = await uploadHomepageVideoThumbnail(file, sectionKey);

      if (previousPath && previousPath !== uploaded.storagePath) {
        deleteHomepageVideoThumbnail(previousPath).catch(() => {});
      }

      if (isPortalSection) {
        setPortalDraft((prev) => ({
          ...prev,
          customThumbnailUrl: uploaded.imageUrl,
          customThumbnailStoragePath: uploaded.storagePath,
        }));
      } else {
        setCashbackDraft((prev) => ({
          ...prev,
          customThumbnailUrl: uploaded.imageUrl,
          customThumbnailStoragePath: uploaded.storagePath,
        }));
      }
      setIsDirty(true);
      setSaveMessage(null);
    } catch (err: any) {
      setThumbError(err?.message || 'Failed to upload custom thumbnail.');
    } finally {
      setUploadingThumb(false);
    }
  };

  const handleRemoveThumbnail = async () => {
    setThumbError(null);
    const pathToDelete = activeCustomThumbnailPath;
    if (pathToDelete) {
      deleteHomepageVideoThumbnail(pathToDelete).catch(() => {});
    }
    if (isPortalSection) {
      setPortalDraft((prev) => ({
        ...prev,
        customThumbnailUrl: '',
        customThumbnailStoragePath: '',
      }));
    } else {
      setCashbackDraft((prev) => ({
        ...prev,
        customThumbnailUrl: '',
        customThumbnailStoragePath: '',
      }));
    }
    setIsDirty(true);
    setSaveMessage(null);
  };

  // Cashback Benefit Points Handlers
  const handleAddBenefitPoint = () => {
    const trimmed = newBenefitInput.trim();
    if (!trimmed) return;
    setCashbackDraft((prev) => ({
      ...prev,
      benefitPoints: [
        ...prev.benefitPoints,
        { id: `cb-pt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, text: trimmed },
      ],
    }));
    setNewBenefitInput('');
    setIsDirty(true);
    setSaveMessage(null);
  };

  const handleUpdateBenefitPoint = (id: string, text: string) => {
    setCashbackDraft((prev) => ({
      ...prev,
      benefitPoints: prev.benefitPoints.map((pt) => (pt.id === id ? { ...pt, text } : pt)),
    }));
    setIsDirty(true);
    setSaveMessage(null);
  };

  const handleRemoveBenefitPoint = (id: string) => {
    setCashbackDraft((prev) => ({
      ...prev,
      benefitPoints: prev.benefitPoints.filter((pt) => pt.id !== id),
    }));
    setIsDirty(true);
    setSaveMessage(null);
  };

  const handleMoveBenefitPoint = (idx: number, direction: -1 | 1) => {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= cashbackDraft.benefitPoints.length) return;
    setCashbackDraft((prev) => {
      const next = [...prev.benefitPoints];
      const [moved] = next.splice(idx, 1);
      next.splice(targetIdx, 0, moved);
      return { ...prev, benefitPoints: next };
    });
    setIsDirty(true);
    setSaveMessage(null);
  };

  const handleResetToSaved = () => {
    const latest = db.getHomepageConfig();
    if (isPortalSection) {
      setPortalDraft(loadPortalDraft(latest));
    } else {
      setCashbackDraft(loadCashbackDraft(latest));
    }
    setIsDirty(false);
    setValidationErrors([]);
    setThumbError(null);
    setServerValidation({ status: 'idle' });
    setSaveMessage(null);
  };

  const handleSaveAndPublish = () => {
    setValidationErrors([]);
    setSaveMessage(null);

    const latest = db.getHomepageConfig();
    const now = new Date().toISOString();
    const actor = user?.email || 'admin@theunbound.in';

    if (isPortalSection) {
      const check = validatePortalTutorialVideoConfig(portalDraft);
      if (!check.valid) {
        setValidationErrors(check.errors);
        return;
      }

      const cleanConfig: HomepagePortalTutorialVideoConfig = {
        ...portalDraft,
        sectionId: 'portalTutorialVideo',
        sectionType: 'PORTAL_TUTORIAL_VIDEO',
        eyebrowText: (portalDraft.eyebrowText || '').trim(),
        heading: portalDraft.heading.trim(),
        description: portalDraft.description.trim(),
        youtubeUrl: check.canonicalUrl || portalDraft.youtubeUrl.trim(),
        youtubeVideoId: check.videoId || '',
        videoMaxWidthPercent: clampTutorialVideoWidthPercent(portalDraft.videoMaxWidthPercent),
        createdAt: latest.portalTutorialVideoConfig?.createdAt || now,
        updatedAt: now,
        updatedBy: actor,
      };

      const existingSections = { ...(latest.homepageSections || {}) };
      existingSections.portalTutorialVideo = {
        sequence: existingSections.portalTutorialVideo?.sequence || (latest.homepageModuleOrder?.indexOf('portalTutorialVideo') ?? 2) + 1,
        active: cleanConfig.isActive,
        updatedAt: now,
        updatedBy: actor,
      };

      const updatedHomepage: HomepageConfig = {
        ...latest,
        showPortalTutorialVideo: cleanConfig.isActive,
        portalTutorialVideoConfig: cleanConfig,
        homepageSections: existingSections,
        version: (latest.version || 1) + 1,
        updatedAt: now,
        updatedBy: actor,
      };

      db.updateHomepageConfig(updatedHomepage, user);
      setPortalDraft(cleanConfig);
      setIsDirty(false);
      setSaveMessage(
        cleanConfig.isActive
          ? 'Portal Tutorial Video section published to the live homepage.'
          : 'Portal Tutorial Video settings saved (section is currently Inactive / hidden on live homepage).'
      );
      return;
    }

    // Cashback & Rewards Video section
    const check = validateCashbackRewardsVideoConfig(cashbackDraft);
    if (!check.valid) {
      setValidationErrors(check.errors);
      return;
    }

    const cleanConfig: HomepageCashbackRewardsVideoConfig = {
      ...cashbackDraft,
      sectionId: 'cashbackRewardsVideo',
      sectionType: 'CASHBACK_REWARDS_VIDEO',
      eyebrowText: (cashbackDraft.eyebrowText || '').trim(),
      heading: cashbackDraft.heading.trim(),
      description: cashbackDraft.description.trim(),
      benefitPoints: cashbackDraft.benefitPoints
        .map((pt) => ({ id: pt.id, text: pt.text.trim() }))
        .filter((pt) => pt.text.length > 0),
      supportingText: (cashbackDraft.supportingText || '').trim(),
      ctaLabel: cashbackDraft.ctaLabel.trim(),
      ctaDestination: cashbackDraft.ctaDestination.trim(),
      youtubeUrl: check.canonicalUrl || cashbackDraft.youtubeUrl.trim(),
      youtubeVideoId: check.videoId || '',
      createdAt: latest.cashbackRewardsVideoConfig?.createdAt || now,
      updatedAt: now,
      updatedBy: actor,
    };

    const existingSections = { ...(latest.homepageSections || {}) };
    existingSections.cashbackRewardsVideo = {
      sequence: existingSections.cashbackRewardsVideo?.sequence || (latest.homepageModuleOrder?.indexOf('cashbackRewardsVideo') ?? 6) + 1,
      active: cleanConfig.isActive,
      updatedAt: now,
      updatedBy: actor,
    };

    const updatedHomepage: HomepageConfig = {
      ...latest,
      showCashbackRewardsVideo: cleanConfig.isActive,
      cashbackRewardsVideoConfig: cleanConfig,
      homepageSections: existingSections,
      version: (latest.version || 1) + 1,
      updatedAt: now,
      updatedBy: actor,
    };

    db.updateHomepageConfig(updatedHomepage, user);
    setCashbackDraft(cleanConfig);
    setIsDirty(false);
    setSaveMessage(
      cleanConfig.isActive
        ? 'Cashback & Rewards Video section published to the live homepage.'
        : 'Cashback & Rewards Video settings saved (section is currently Inactive / hidden on live homepage).'
    );
  };

  const previewWidthClass =
    previewDevice === 'MOBILE'
      ? 'max-w-[390px] mx-auto'
      : previewDevice === 'TABLET'
      ? 'max-w-[768px] mx-auto'
      : 'w-full';

  return (
    <div className="space-y-6 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
      {/* Header Bar */}
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-[#008972] border border-teal-200/70">
            <Video className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              {isPortalSection ? 'Portal Tutorial Video Settings' : 'Cashback & Rewards Video Settings'}
            </h4>
            <p className="text-xs text-slate-500">
              {isPortalSection
                ? 'Configure the prominent centrally-aligned YouTube portal walkthrough shown on the homepage.'
                : 'Configure the two-column Cashback & Rewards narrative (left) and YouTube explainer video (right).'}
              {sequencePositionLabel ? ` · ${sequencePositionLabel}` : ''}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleResetToSaved}
            disabled={!isDirty}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Revert
          </button>
          <button
            type="button"
            onClick={handleSaveAndPublish}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#008972] px-4 py-2 text-xs font-bold text-white shadow-xs transition-colors hover:bg-[#00735F] cursor-pointer"
          >
            <Save className="h-3.5 w-3.5" />
            Save &amp; Publish Changes
          </button>
        </div>
      </div>

      {/* Feedback Banners */}
      {validationErrors.length > 0 && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-900 space-y-1">
          <div className="flex items-center gap-2 font-bold">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>Please resolve the following before publishing (live homepage remains unchanged):</span>
          </div>
          <ul className="list-disc pl-6 space-y-0.5 text-rose-800">
            {validationErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {saveMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{saveMessage}</span>
        </div>
      )}

      {/* Main Editor Grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left: Content & Layout Controls */}
        <div className="space-y-4 lg:col-span-6">
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Section Content &amp; Status
              </span>
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPortalSection ? portalDraft.isActive : cashbackDraft.isActive}
                  onChange={(e) => {
                    const nextActive = e.target.checked;
                    setIsDirty(true);
                    setSaveMessage(null);
                    if (isPortalSection) {
                      setPortalDraft((prev) => ({ ...prev, isActive: nextActive }));
                    } else {
                      setCashbackDraft((prev) => ({ ...prev, isActive: nextActive }));
                    }
                  }}
                  className="h-4 w-4 rounded border-slate-300 text-[#008972] focus:ring-[#00C6A6]"
                />
                <span>Section Active (Visible on Homepage)</span>
              </label>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-bold text-slate-700">
                  Eyebrow Label (Optional)
                </label>
                <input
                  type="text"
                  value={isPortalSection ? portalDraft.eyebrowText || '' : cashbackDraft.eyebrowText || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setIsDirty(true);
                    if (isPortalSection) setPortalDraft((prev) => ({ ...prev, eyebrowText: val }));
                    else setCashbackDraft((prev) => ({ ...prev, eyebrowText: val }));
                  }}
                  placeholder={isPortalSection ? 'PORTAL WALKTHROUGH' : 'PARTNER REWARDS'}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#008972] focus:outline-none focus:ring-2 focus:ring-[#00C6A6]/30"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-bold text-slate-700">
                  Background Treatment
                </label>
                <select
                  value={isPortalSection ? portalDraft.backgroundStyle : cashbackDraft.backgroundStyle}
                  onChange={(e) => {
                    const val = e.target.value as HomepageVideoBackgroundStyle;
                    setIsDirty(true);
                    if (isPortalSection) setPortalDraft((prev) => ({ ...prev, backgroundStyle: val }));
                    else setCashbackDraft((prev) => ({ ...prev, backgroundStyle: val }));
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#008972] focus:outline-none focus:ring-2 focus:ring-[#00C6A6]/30"
                >
                  {BACKGROUND_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-bold text-slate-700">
                Section Heading <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={isPortalSection ? portalDraft.heading : cashbackDraft.heading}
                onChange={(e) => {
                  const val = e.target.value;
                  setIsDirty(true);
                  if (isPortalSection) setPortalDraft((prev) => ({ ...prev, heading: val }));
                  else setCashbackDraft((prev) => ({ ...prev, heading: val }));
                }}
                placeholder={isPortalSection ? 'Explore TheUnbound Portal' : 'Travel More. Earn More.'}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#008972] focus:outline-none focus:ring-2 focus:ring-[#00C6A6]/30"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-bold text-slate-700">
                {isPortalSection ? 'Supporting Description' : 'Introductory Description'}{' '}
                {!isPortalSection && <span className="text-rose-500">*</span>}
              </label>
              <textarea
                rows={3}
                value={isPortalSection ? portalDraft.description : cashbackDraft.description}
                onChange={(e) => {
                  const val = e.target.value;
                  setIsDirty(true);
                  if (isPortalSection) setPortalDraft((prev) => ({ ...prev, description: val }));
                  else setCashbackDraft((prev) => ({ ...prev, description: val }));
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#008972] focus:outline-none focus:ring-2 focus:ring-[#00C6A6]/30"
              />
            </div>

            {/* Section-Specific Layout Controls */}
            {isPortalSection ? (
              <div className="grid grid-cols-1 gap-4 pt-1 sm:grid-cols-2">
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-700">
                      Desktop Video Width
                    </label>
                    <span className="font-mono text-xs font-bold text-[#008972]">
                      {clampTutorialVideoWidthPercent(portalDraft.videoMaxWidthPercent)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={60}
                    max={70}
                    step={1}
                    value={clampTutorialVideoWidthPercent(portalDraft.videoMaxWidthPercent)}
                    onChange={(e) => {
                      setPortalDraft((prev) => ({
                        ...prev,
                        videoMaxWidthPercent: clampTutorialVideoWidthPercent(parseInt(e.target.value, 10)),
                      }));
                      setIsDirty(true);
                    }}
                    className="w-full accent-[#008972] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>60%</span>
                    <span>65% (Default)</span>
                    <span>70%</span>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-700">
                    Section Alignment
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['center', 'left'] as const).map((align) => (
                      <button
                        key={align}
                        type="button"
                        onClick={() => {
                          setPortalDraft((prev) => ({ ...prev, alignment: align }));
                          setIsDirty(true);
                        }}
                        className={`rounded-lg border px-3 py-2 text-xs font-semibold capitalize transition-colors cursor-pointer ${
                          portalDraft.alignment === align
                            ? 'border-[#008972] bg-teal-50 text-[#008972]'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {align}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Cashback Benefit Points Editor */}
                <div className="space-y-2.5 border-t border-slate-100 pt-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-700">
                      Key Cashback Benefit Points
                    </label>
                    <span className="text-[10px] text-slate-400">
                      {cashbackDraft.benefitPoints.length} points
                    </span>
                  </div>

                  <div className="space-y-2">
                    {cashbackDraft.benefitPoints.map((pt, idx) => (
                      <div key={pt.id} className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={pt.text}
                          onChange={(e) => handleUpdateBenefitPoint(pt.id, e.target.value)}
                          className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-[#008972] focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleMoveBenefitPoint(idx, -1)}
                          disabled={idx === 0}
                          className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 disabled:opacity-30 cursor-pointer"
                          title="Move up"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveBenefitPoint(idx, 1)}
                          disabled={idx === cashbackDraft.benefitPoints.length - 1}
                          className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 disabled:opacity-30 cursor-pointer"
                          title="Move down"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveBenefitPoint(pt.id)}
                          className="rounded-lg border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50 cursor-pointer"
                          title="Remove benefit point"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newBenefitInput}
                      onChange={(e) => setNewBenefitInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddBenefitPoint();
                        }
                      }}
                      placeholder="Add another cashback highlight..."
                      className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 focus:border-[#008972] focus:bg-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddBenefitPoint}
                      className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add
                    </button>
                  </div>
                </div>

                {/* Supporting Text & Text Alignment */}
                <div className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-[11px] font-bold text-slate-700">
                      Optional Supporting Note
                    </label>
                    <input
                      type="text"
                      value={cashbackDraft.supportingText || ''}
                      onChange={(e) => {
                        setCashbackDraft((prev) => ({ ...prev, supportingText: e.target.value }));
                        setIsDirty(true);
                      }}
                      placeholder="Optional eligibility note (no private wallet figures)"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#008972] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-700">
                      Text Alignment
                    </label>
                    <select
                      value={cashbackDraft.textAlignment}
                      onChange={(e) => {
                        setCashbackDraft((prev) => ({
                          ...prev,
                          textAlignment: e.target.value as 'left' | 'center',
                        }));
                        setIsDirty(true);
                      }}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#008972] focus:outline-none"
                    >
                      <option value="left">Left Aligned</option>
                      <option value="center">Centered</option>
                    </select>
                  </div>
                </div>

                {/* Optional CTA Button */}
                <div className="space-y-3 border-t border-slate-100 pt-3">
                  <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cashbackDraft.ctaEnabled}
                      onChange={(e) => {
                        setCashbackDraft((prev) => ({ ...prev, ctaEnabled: e.target.checked }));
                        setIsDirty(true);
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-[#008972] focus:ring-[#00C6A6]"
                    />
                    <span>Show Optional CTA Button</span>
                  </label>

                  {cashbackDraft.ctaEnabled && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-[11px] font-bold text-slate-700">
                          CTA Button Label
                        </label>
                        <input
                          type="text"
                          value={cashbackDraft.ctaLabel}
                          onChange={(e) => {
                            setCashbackDraft((prev) => ({ ...prev, ctaLabel: e.target.value }));
                            setIsDirty(true);
                          }}
                          placeholder="Explore Cashback Program"
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#008972] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-bold text-slate-700">
                          Destination Path / URL
                        </label>
                        <input
                          type="text"
                          value={cashbackDraft.ctaDestination}
                          onChange={(e) => {
                            setCashbackDraft((prev) => ({ ...prev, ctaDestination: e.target.value }));
                            setIsDirty(true);
                          }}
                          placeholder="/b2b/my-cashback"
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#008972] focus:outline-none"
                        />
                      </div>
                      <div className="sm:col-span-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className="text-slate-500">Quick routes:</span>
                        <button
                          type="button"
                          onClick={() => {
                            setCashbackDraft((prev) => ({ ...prev, ctaDestination: '/b2b/my-cashback' }));
                            setIsDirty(true);
                          }}
                          className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-medium text-slate-700 hover:bg-teal-50 hover:text-[#008972] cursor-pointer"
                        >
                          My Cashback (/b2b/my-cashback)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCashbackDraft((prev) => ({ ...prev, ctaDestination: '/b2b' }));
                            setIsDirty(true);
                          }}
                          className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-medium text-slate-700 hover:bg-teal-50 hover:text-[#008972] cursor-pointer"
                        >
                          B2B Portal (/b2b)
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right: YouTube URL & Custom Thumbnail Management */}
        <div className="space-y-4 lg:col-span-6">
          {/* YouTube Video URL Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                YouTube Video Source
              </span>
              {clientUrlCheck?.valid && clientUrlCheck.videoId && (
                <span className="font-mono text-[11px] font-semibold text-emerald-700">
                  ID: {clientUrlCheck.videoId}
                </span>
              )}
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-bold text-slate-700">
                YouTube Video URL
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="url"
                  value={activeYoutubeUrl}
                  onChange={(e) => handleYoutubeUrlChange(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#008972] focus:outline-none focus:ring-2 focus:ring-[#00C6A6]/30"
                />
                <button
                  type="button"
                  onClick={handleVerifyYoutubeOnServer}
                  disabled={!activeYoutubeUrl.trim() || serverValidation.status === 'checking'}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer"
                >
                  {serverValidation.status === 'checking' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ShieldCheck className="h-3.5 w-3.5 text-[#00C6A6]" />
                  )}
                  Verify Video
                </button>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-500">
                Accepts standard YouTube watch, short (youtu.be), embed, and shorts URLs. Uses privacy-enhanced youtube-nocookie.com click-to-play loading.
              </p>
            </div>

            {/* Client-side format validation status */}
            {activeYoutubeUrl.trim() && clientUrlCheck && !clientUrlCheck.valid && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{clientUrlCheck.error}</span>
              </div>
            )}

            {/* Server-side availability verification result */}
            {serverValidation.status !== 'idle' && serverValidation.message && (
              <div
                className={`rounded-lg border px-3 py-2 text-xs flex items-start gap-2 ${
                  serverValidation.status === 'verified'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : serverValidation.status === 'error'
                    ? 'border-rose-200 bg-rose-50 text-rose-900'
                    : serverValidation.status === 'warning'
                    ? 'border-amber-200 bg-amber-50 text-amber-900'
                    : 'border-slate-200 bg-slate-50 text-slate-700'
                }`}
              >
                {serverValidation.status === 'verified' ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                ) : serverValidation.status === 'checking' ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-500 mt-0.5" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <span>{serverValidation.message}</span>
                  {clientUrlCheck?.watchUrl && (
                    <a
                      href={clientUrlCheck.watchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 inline-flex items-center gap-1 font-semibold underline"
                    >
                      Open on YouTube
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Optional Custom Thumbnail Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Custom Thumbnail Image (Optional)
                </span>
                <p className="text-[11px] text-slate-500">
                  Overrides the default YouTube thumbnail before playback. JPG, PNG, WebP, or AVIF (max 5 MB).
                </p>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              onChange={handleThumbnailFileSelected}
              className="hidden"
            />

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingThumb}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
              >
                {uploadingThumb ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#008972]" />
                ) : (
                  <Upload className="h-3.5 w-3.5 text-[#008972]" />
                )}
                {activeCustomThumbnail ? 'Replace Thumbnail' : 'Upload Thumbnail'}
              </button>

              {activeCustomThumbnail && (
                <button
                  type="button"
                  onClick={handleRemoveThumbnail}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove Custom Thumbnail
                </button>
              )}
            </div>

            {thumbError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{thumbError}</span>
              </div>
            )}

            {activeCustomThumbnail ? (
              <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                <img
                  src={activeCustomThumbnail}
                  alt="Custom thumbnail preview"
                  className="h-14 w-24 rounded-md object-cover border border-slate-200"
                />
                <div className="min-w-0 flex-1 text-xs">
                  <p className="font-semibold text-slate-800">Custom thumbnail active</p>
                  <p className="truncate text-[11px] text-slate-500">
                    Optimized 16:9 poster image shown before visitor clicks Play.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <ImageIcon className="h-3.5 w-3.5 text-slate-400" />
                <span>Using automatic high-resolution YouTube video thumbnail.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Live Responsive Preview */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Live Section Preview
            </span>
            <p className="text-[11px] text-slate-500">
              Preview layout and click-to-play playback across Desktop, Tablet, and Mobile viewports.
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
            {(
              [
                { id: 'DESKTOP', icon: Monitor, label: 'Desktop' },
                { id: 'TABLET', icon: Tablet, label: 'Tablet' },
                { id: 'MOBILE', icon: Smartphone, label: 'Mobile' },
              ] as const
            ).map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setPreviewDevice(id)}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                  previewDevice === id
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-white'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-slate-100/70 p-3 sm:p-4 overflow-x-auto">
          <div className={`${previewWidthClass} transition-all duration-300`}>
            {isPortalSection ? (
              <PortalTutorialVideoSection
                config={portalDraft}
                sectionActive={portalDraft.isActive}
                previewMode
              />
            ) : (
              <CashbackRewardsVideoSection
                config={cashbackDraft}
                sectionActive={cashbackDraft.isActive}
                previewMode
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
