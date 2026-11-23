import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Save,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Eye,
  Sliders,
  Layers,
  ArrowLeftRight,
  Monitor,
  Tablet,
  Smartphone,
  RotateCcw,
  ShieldCheck,
  LayoutTemplate,
  Lock
} from 'lucide-react';
import { AppDatabase } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { canUserAccessCMS } from '../../services/permissionEngine';
import { INITIAL_DEMO_BOOKING_CONFIG } from '../../data/initialHomepage';
import type {
  DemoBookingBackgroundStyle,
  DemoBookingButtonConfig,
  DemoBookingButtonStyle,
  DemoBookingDecorativeTreatment,
  HomepageConfig,
  HomepageDemoBookingConfig
} from '../../types';
import {
  getPublishableDemoBookingButtons,
  validateCalendlyUrl,
  validateDemoBookingConfigForPublish
} from '../../utils/demoBookingValidation';
import { DemoBookingSection } from '../public/DemoBookingSection';

export interface DemoBookingManagerProps {
  /** Compact inline mode when expanded inside Homepage Section Sequence & Ordering */
  compact?: boolean;
  /** Optional callback to switch to Layout & Ordering tab */
  onOpenLayoutOrdering?: () => void;
  /** Optional current sequence position label from Homepage Control & Layout Manager */
  sequencePositionLabel?: string;
}

function normalizeDraft(raw?: HomepageDemoBookingConfig | null): HomepageDemoBookingConfig {
  const base = INITIAL_DEMO_BOOKING_CONFIG;
  if (!raw) {
    return {
      ...base,
      buttons: base.buttons.map(b => ({ ...b }))
    };
  }
  const buttons =
    Array.isArray(raw.buttons) && raw.buttons.length === 2
      ? raw.buttons.map((b, idx) => ({
          ...base.buttons[idx],
          ...b,
          id: b.id || `demo-btn-${idx + 1}`,
          slot: (b.slot === 1 || b.slot === 2 ? b.slot : idx + 1) as 1 | 2,
          displayOrder: typeof b.displayOrder === 'number' ? b.displayOrder : idx + 1
        }))
      : base.buttons.map(b => ({ ...b }));

  return {
    ...base,
    ...raw,
    sectionId: raw.sectionId || 'demoBooking',
    sectionType: 'DEMO_BOOKING',
    background: {
      ...base.background,
      ...(raw.background || {})
    },
    layout: {
      ...base.layout,
      ...(raw.layout || {})
    },
    buttons
  };
}

export const DemoBookingManager: React.FC<DemoBookingManagerProps> = ({
  compact = false,
  onOpenLayoutOrdering,
  sequencePositionLabel
}) => {
  const { user } = useAuth();
  const db = AppDatabase.getInstance();
  const isAuthorizedAdmin = canUserAccessCMS(user);

  const [homepageConfig, setHomepageConfig] = useState<HomepageConfig>(() => db.getHomepageConfig());
  const [draft, setDraft] = useState<HomepageDemoBookingConfig>(() =>
    normalizeDraft(db.getHomepageConfig().demoBookingConfig)
  );
  const [sectionActiveDraft, setSectionActiveDraft] = useState<boolean>(
    () => db.getHomepageConfig().showDemoBookingSection !== false
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [activeEditorTab, setActiveEditorTab] = useState<'CONTENT' | 'DESIGN' | 'PREVIEW'>('CONTENT');
  const [previewDevice, setPreviewDevice] = useState<'DESKTOP' | 'TABLET' | 'MOBILE'>('DESKTOP');
  const [publishErrors, setPublishErrors] = useState<string[]>([]);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);

  useEffect(() => {
    return db.subscribeToCollections(['homepage_config'], () => {
      const latest = db.getHomepageConfig();
      setHomepageConfig(latest);
      if (!hasUnsavedChanges) {
        setDraft(normalizeDraft(latest.demoBookingConfig));
        setSectionActiveDraft(latest.showDemoBookingSection !== false);
      }
    });
  }, [db, hasUnsavedChanges]);

  const liveValidation = useMemo(() => validateDemoBookingConfigForPublish(draft), [draft]);
  const publishedValidButtons = useMemo(
    () => getPublishableDemoBookingButtons(homepageConfig.demoBookingConfig),
    [homepageConfig.demoBookingConfig]
  );

  // Strict RBAC guard: never expose editing controls to non-Admin users
  if (!isAuthorizedAdmin) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex items-center gap-3 text-slate-600">
        <Lock className="w-5 h-5 text-slate-400 shrink-0" />
        <p className="text-xs font-medium">
          Administrator CMS permissions are required to edit the Demo Booking section.
        </p>
      </div>
    );
  }

  const updateDraft = (updater: (prev: HomepageDemoBookingConfig) => HomepageDemoBookingConfig) => {
    setDraft(prev => updater(prev));
    setHasUnsavedChanges(true);
    setPublishErrors([]);
  };

  const updateButton = (buttonId: string, patch: Partial<DemoBookingButtonConfig>) => {
    updateDraft(prev => ({
      ...prev,
      buttons: prev.buttons.map(btn => (btn.id === buttonId ? { ...btn, ...patch } : btn))
    }));
  };

  const handleSwapButtonOrder = () => {
    updateDraft(prev => {
      const [b1, b2] = prev.buttons;
      if (!b1 || !b2) return prev;
      return {
        ...prev,
        buttons: [
          { ...b1, displayOrder: b2.displayOrder === 1 ? 1 : 2 },
          { ...b2, displayOrder: b1.displayOrder === 1 ? 1 : 2 }
        ].map((btn, i) => ({
          ...btn,
          displayOrder:
            prev.buttons[i].displayOrder === 1 ? 2 : 1
        }))
      };
    });
  };

  const handleSetButtonOrder = (buttonId: string, newOrder: 1 | 2) => {
    updateDraft(prev => ({
      ...prev,
      buttons: prev.buttons.map(btn => ({
        ...btn,
        displayOrder: btn.id === buttonId ? newOrder : newOrder === 1 ? 2 : 1
      }))
    }));
  };

  const handlePublish = () => {
    const validation = validateDemoBookingConfigForPublish(draft);
    if (!validation.valid) {
      // Preserve the previous published Firestore configuration untouched
      setPublishErrors(validation.errors);
      return;
    }

    const latest = db.getHomepageConfig();
    const now = new Date().toISOString();
    const actor = user?.email || user?.name || 'admin@theunbound.in';

    // Normalize validated Calendly URLs before saving
    const sanitizedButtons = draft.buttons.map(btn => {
      const trimmedUrl = (btn.calendlyUrl || '').trim();
      const urlCheck = trimmedUrl ? validateCalendlyUrl(trimmedUrl) : { valid: false, normalizedUrl: '' };
      return {
        ...btn,
        label: btn.label.trim(),
        supportingText: (btn.supportingText || '').trim(),
        calendlyUrl: urlCheck.valid ? urlCheck.normalizedUrl : ''
      };
    });

    // Respect single authoritative ordering from Homepage Control & Layout Manager
    const currentOrder = Array.isArray(latest.homepageModuleOrder) && latest.homepageModuleOrder.length > 0
      ? [...latest.homepageModuleOrder]
      : [];
    const seqIdx = currentOrder.indexOf('demoBooking');
    const authoritativeOrder = seqIdx >= 0 ? seqIdx + 1 : latest.homepageSections?.demoBooking?.sequence;

    const nextDemoConfig: HomepageDemoBookingConfig = {
      ...draft,
      sectionId: 'demoBooking',
      sectionType: 'DEMO_BOOKING',
      eyebrowText: draft.eyebrowText.trim(),
      headline: draft.headline.trim(),
      description: draft.description.trim(),
      buttons: sanitizedButtons,
      isActive: sectionActiveDraft,
      displayOrder: authoritativeOrder,
      createdAt: draft.createdAt || latest.demoBookingConfig?.createdAt || now,
      updatedAt: now,
      updatedBy: actor
    };

    const nextSectionsMap = {
      ...(latest.homepageSections || {}),
      demoBooking: {
        sequence: authoritativeOrder || Object.keys(latest.homepageSections || {}).length + 1,
        active: sectionActiveDraft,
        updatedAt: now,
        updatedBy: actor
      }
    };

    const updatedHomepage: HomepageConfig = {
      ...latest,
      showDemoBookingSection: sectionActiveDraft,
      demoBookingConfig: nextDemoConfig,
      homepageSections: nextSectionsMap,
      version: (latest.version || 1) + 1,
      updatedAt: now,
      updatedBy: actor
    };

    db.updateHomepageConfig(updatedHomepage, user);
    setHomepageConfig(updatedHomepage);
    setDraft(nextDemoConfig);
    setHasUnsavedChanges(false);
    setPublishErrors([]);
    setSavedBanner('Demo Booking configuration published live to Homepage.');
    setTimeout(() => setSavedBanner(null), 3500);
  };

  const handleDiscard = () => {
    const latest = db.getHomepageConfig();
    setDraft(normalizeDraft(latest.demoBookingConfig));
    setSectionActiveDraft(latest.showDemoBookingSection !== false);
    setHasUnsavedChanges(false);
    setPublishErrors([]);
  };

  const handleResetCopyDefaults = () => {
    updateDraft(prev => ({
      ...prev,
      eyebrowText: INITIAL_DEMO_BOOKING_CONFIG.eyebrowText,
      headline: INITIAL_DEMO_BOOKING_CONFIG.headline,
      description: INITIAL_DEMO_BOOKING_CONFIG.description,
      background: { ...INITIAL_DEMO_BOOKING_CONFIG.background },
      layout: { ...INITIAL_DEMO_BOOKING_CONFIG.layout },
      buttons: prev.buttons.map((btn, idx) => ({
        ...btn,
        label: INITIAL_DEMO_BOOKING_CONFIG.buttons[idx]?.label || btn.label,
        style: INITIAL_DEMO_BOOKING_CONFIG.buttons[idx]?.style || btn.style,
        displayOrder: idx + 1
      }))
    }));
  };

  const orderedButtonsForEditor = [...draft.buttons].sort((a, b) => a.slot - b.slot);
  const currentSeqIndex = (homepageConfig.homepageModuleOrder || []).indexOf('demoBooking');
  const computedPositionLabel =
    sequencePositionLabel ||
    (currentSeqIndex >= 0
      ? `Position ${currentSeqIndex + 1} of ${(homepageConfig.homepageModuleOrder || []).length} in Homepage Control & Layout Manager`
      : 'Managed in Homepage Control & Layout Manager');

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      {!compact && (
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-teal-50 text-[#008972] border border-teal-200 flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5 text-[#008972]" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                Demo Booking / Schedule a Meeting
              </h3>
              <span className="text-xs font-medium text-slate-500">
                {sectionActiveDraft && publishedValidButtons.length > 0
                  ? `Live on Homepage · ${publishedValidButtons.length}/2 Calendly links active`
                  : sectionActiveDraft
                    ? 'Active in layout · Awaiting valid Calendly link'
                    : 'Hidden on Homepage'}
              </span>
            </div>
            <p className="text-xs text-slate-500 max-w-2xl">
              Manage headlines, two independent Calendly booking CTAs, visual styling, and live responsive previews. Section position and visibility sync atomically with Homepage Control & Layout Manager.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-500">
              <span>{computedPositionLabel}</span>
              {homepageConfig.demoBookingConfig?.updatedAt && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    Last published {new Date(homepageConfig.demoBookingConfig.updatedAt).toLocaleString()}
                    {homepageConfig.demoBookingConfig.updatedBy ? ` by ${homepageConfig.demoBookingConfig.updatedBy}` : ''}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {onOpenLayoutOrdering && (
              <button
                type="button"
                onClick={onOpenLayoutOrdering}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
              >
                <LayoutTemplate className="w-3.5 h-3.5 text-slate-500" />
                <span>Change Position</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleResetCopyDefaults}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Reset Copy & Style</span>
            </button>
            {hasUnsavedChanges && (
              <button
                type="button"
                onClick={handleDiscard}
                className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
              >
                Discard
              </button>
            )}
            <button
              type="button"
              id="publish-demo-booking-btn"
              onClick={handlePublish}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#008972] hover:bg-[#00735F] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save & Publish</span>
            </button>
          </div>
        </div>
      )}

      {/* Compact Toolbar when expanded inline inside Homepage Sequence */}
      {compact && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
          <div className="text-xs text-slate-700 font-medium">
            Editing <span className="font-bold text-slate-900">Demo Booking / Schedule a Meeting</span> · {computedPositionLabel}
          </div>
          <div className="flex items-center gap-2">
            {hasUnsavedChanges && (
              <button
                type="button"
                onClick={handleDiscard}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Discard
              </button>
            )}
            <button
              type="button"
              onClick={handlePublish}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#008972] hover:bg-[#00735F] text-white text-xs font-bold cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save & Publish</span>
            </button>
          </div>
        </div>
      )}

      {/* Save Success Notice */}
      {savedBanner && (
        <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-3 rounded-xl text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 text-[#008972] shrink-0" />
          <span>{savedBanner}</span>
        </div>
      )}

      {/* Validation Error Block (Preserves previous published configuration) */}
      {publishErrors.length > 0 && (
        <div
          role="alert"
          className="bg-rose-50 border border-rose-200 rounded-xl p-4 space-y-2 text-rose-900"
        >
          <div className="flex items-center gap-2 text-xs font-bold">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>Cannot publish until configuration issues are resolved (previous published version remains live):</span>
          </div>
          <ul className="list-disc pl-5 space-y-1 text-xs text-rose-800">
            {publishErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Section Master Visibility Row */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <div className="text-sm font-bold text-slate-900">Section Visibility on Published Homepage</div>
          <p className="text-xs text-slate-500">
            Synchronized with Homepage Control & Layout Manager. Disabled sections preserve all saved copy and Calendly URLs.
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={sectionActiveDraft}
            onChange={(e) => {
              setSectionActiveDraft(e.target.checked);
              setHasUnsavedChanges(true);
            }}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#008972]" />
          <span className="ml-3 text-xs font-bold text-slate-700">
            {sectionActiveDraft ? 'Active' : 'Inactive'}
          </span>
        </label>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 max-w-fit">
        {[
          { id: 'CONTENT', label: 'Content & Calendly Links', icon: Layers },
          { id: 'DESIGN', label: 'Design & Layout', icon: Sliders },
          { id: 'PREVIEW', label: 'Responsive Preview', icon: Eye }
        ].map(tab => {
          const Icon = tab.icon;
          const active = activeEditorTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveEditorTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                active
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${active ? 'text-[#008972]' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: CONTENT & TWO INDEPENDENT CALENDLY BUTTONS */}
      {activeEditorTab === 'CONTENT' && (
        <div className="space-y-6">
          {/* Section Copy Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h4 className="text-sm font-bold text-slate-900">Section Copy & Messaging</h4>
              <p className="text-xs text-slate-500">
                Every text element renders dynamically from the published Firestore homepage configuration.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Eyebrow Text
                </label>
                <input
                  type="text"
                  value={draft.eyebrowText}
                  onChange={e => updateDraft(prev => ({ ...prev, eyebrowText: e.target.value }))}
                  placeholder="LET'S CONNECT"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#008972] focus:ring-2 focus:ring-[#00C6A6]/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Main Headline <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={draft.headline}
                  onChange={e => updateDraft(prev => ({ ...prev, headline: e.target.value }))}
                  placeholder="Let's Build Something Extraordinary Together."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:border-[#008972] focus:ring-2 focus:ring-[#00C6A6]/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Supporting Description
              </label>
              <textarea
                rows={3}
                value={draft.description}
                onChange={e => updateDraft(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Discover how TheUnbound can simplify your Japan travel operations..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs leading-relaxed text-slate-800 focus:outline-none focus:border-[#008972] focus:ring-2 focus:ring-[#00C6A6]/20"
              />
            </div>
          </div>

          {/* Two Independent Calendly Booking Buttons */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Two Independent Calendly CTA Buttons</h4>
                <p className="text-xs text-slate-500">
                  Configure separate Calendly scheduling links, labels, styles, visibility, and display order for each button.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSwapButtonOrder}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer shrink-0"
              >
                <ArrowLeftRight className="w-3.5 h-3.5 text-[#008972]" />
                <span>Swap Button Order</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {orderedButtonsForEditor.map(btn => {
                const urlCheck = validateCalendlyUrl(btn.calendlyUrl);
                const hasUrl = (btn.calendlyUrl || '').trim().length > 0;
                const btnError = liveValidation.buttonErrors[btn.id];

                return (
                  <div
                    key={btn.id}
                    className={`rounded-2xl border p-5 space-y-4 transition-colors ${
                      btn.enabled
                        ? 'bg-white border-slate-200'
                        : 'bg-slate-50/70 border-slate-200/80'
                    }`}
                  >
                    {/* Button Card Header */}
                    <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
                      <div>
                        <div className="text-xs font-bold text-slate-900">
                          Button {btn.slot} Configuration
                        </div>
                        <div className="text-[11px] text-slate-500">
                          ID: <span className="font-mono">{btn.id}</span> · Position {btn.displayOrder}
                        </div>
                      </div>

                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={btn.enabled}
                          onChange={e => updateButton(btn.id, { enabled: e.target.checked })}
                          className="w-4 h-4 rounded border-slate-300 text-[#008972] focus:ring-[#00C6A6]"
                        />
                        <span className="text-xs font-semibold text-slate-700">
                          {btn.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </label>
                    </div>

                    {/* Label */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Button Label
                      </label>
                      <input
                        type="text"
                        value={btn.label}
                        onChange={e => updateButton(btn.id, { label: e.target.value })}
                        placeholder={btn.slot === 1 ? 'Book a Platform Demo' : 'Schedule a Partnership Discussion'}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 bg-white focus:outline-none focus:border-[#008972]"
                      />
                    </div>

                    {/* Calendly URL + Validation + Test Link */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-700">
                          Calendly Meeting URL
                        </label>
                        {urlCheck.valid ? (
                          <a
                            href={urlCheck.normalizedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#008972] hover:text-[#00735F]"
                          >
                            <span>Test Link</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-[11px] text-slate-400">
                            HTTPS calendly.com link only
                          </span>
                        )}
                      </div>

                      <input
                        type="url"
                        value={btn.calendlyUrl}
                        onChange={e => updateButton(btn.id, { calendlyUrl: e.target.value })}
                        placeholder="https://calendly.com/your-organization/meeting-type"
                        className={`w-full px-3.5 py-2 rounded-xl border text-xs font-mono bg-white focus:outline-none ${
                          btnError
                            ? 'border-rose-300 focus:border-rose-500 text-rose-900'
                            : urlCheck.valid
                              ? 'border-emerald-300 focus:border-[#008972] text-slate-900'
                              : 'border-slate-200 focus:border-[#008972] text-slate-900'
                        }`}
                      />

                      {urlCheck.valid ? (
                        <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
                          <ShieldCheck className="w-3.5 h-3.5 text-[#008972] shrink-0" />
                          <span className="truncate">Valid Calendly URL ready to publish</span>
                        </div>
                      ) : btn.enabled || hasUrl ? (
                        <div className="flex items-start gap-1.5 text-[11px] font-medium text-rose-600">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>{urlCheck.error}</span>
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-500">
                          Button is disabled and hidden on the homepage until enabled with a valid Calendly URL.
                        </p>
                      )}
                    </div>

                    {/* Optional Supporting Description */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Short Supporting Text <span className="text-slate-400 font-normal">(Optional)</span>
                      </label>
                      <input
                        type="text"
                        value={btn.supportingText || ''}
                        onChange={e => updateButton(btn.id, { supportingText: e.target.value })}
                        placeholder="e.g., 25-minute live walkthrough of Quote Builder"
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:border-[#008972]"
                      />
                    </div>

                    {/* Style & Display Order */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Visual Style
                        </label>
                        <select
                          value={btn.style}
                          onChange={e =>
                            updateButton(btn.id, { style: e.target.value as DemoBookingButtonStyle })
                          }
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:border-[#008972]"
                        >
                          <option value="primary-teal">Primary Teal (Solid)</option>
                          <option value="outline-teal">White / Teal Outline</option>
                          <option value="charcoal-solid">Charcoal Solid</option>
                          <option value="soft-surface">Soft Neutral</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Display Order
                        </label>
                        <select
                          value={btn.displayOrder}
                          onChange={e =>
                            handleSetButtonOrder(btn.id, Number(e.target.value) === 1 ? 1 : 2)
                          }
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:border-[#008972]"
                        >
                          <option value={1}>1st (Left / Top)</option>
                          <option value={2}>2nd (Right / Bottom)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DESIGN & LAYOUT SETTINGS */}
      {activeEditorTab === 'DESIGN' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h4 className="text-sm font-bold text-slate-900">Brand-Safe Design & Layout Controls</h4>
            <p className="text-xs text-slate-500">
              Curated presets designed to preserve responsive integrity, WCAG contrast, and TheUnbound brand aesthetics.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Background Style
              </label>
              <select
                value={draft.background.style}
                onChange={e =>
                  updateDraft(prev => ({
                    ...prev,
                    background: {
                      ...prev.background,
                      style: e.target.value as DemoBookingBackgroundStyle
                    }
                  }))
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 bg-white"
              >
                <option value="pure-white">Pure White (Recommended)</option>
                <option value="soft-slate">Soft Neutral Slate</option>
                <option value="subtle-teal-wash">Subtle Teal Wash</option>
                <option value="dark-charcoal">Deep Charcoal Executive</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Decorative Visual Treatment
              </label>
              <select
                value={draft.background.decorativeTreatment}
                onChange={e =>
                  updateDraft(prev => ({
                    ...prev,
                    background: {
                      ...prev.background,
                      decorativeTreatment: e.target.value as DemoBookingDecorativeTreatment
                    }
                  }))
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 bg-white"
              >
                <option value="architectural-lines">Architectural Hairline Accents</option>
                <option value="soft-radial-glow">Subtle Top Teal Glow</option>
                <option value="minimal-grid">Minimal Dot Grid</option>
                <option value="none">None (Pure Flat Surface)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Section Alignment
              </label>
              <select
                value={draft.layout.alignment}
                onChange={e =>
                  updateDraft(prev => ({
                    ...prev,
                    layout: {
                      ...prev.layout,
                      alignment: e.target.value as 'center' | 'left'
                    }
                  }))
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 bg-white"
              >
                <option value="center">Centered (Recommended)</option>
                <option value="left">Left-Aligned Editorial</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Content Width
              </label>
              <select
                value={draft.layout.contentWidth}
                onChange={e =>
                  updateDraft(prev => ({
                    ...prev,
                    layout: {
                      ...prev.layout,
                      contentWidth: e.target.value as 'narrow' | 'standard' | 'wide'
                    }
                  }))
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 bg-white"
              >
                <option value="narrow">Narrow (Compact Focus)</option>
                <option value="standard">Standard (Balanced)</option>
                <option value="wide">Wide (Spacious)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Button Spacing
              </label>
              <select
                value={draft.layout.buttonSpacing}
                onChange={e =>
                  updateDraft(prev => ({
                    ...prev,
                    layout: {
                      ...prev.layout,
                      buttonSpacing: e.target.value as 'compact' | 'comfortable' | 'spacious'
                    }
                  }))
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 bg-white"
              >
                <option value="compact">Compact (12px)</option>
                <option value="comfortable">Comfortable (16px)</option>
                <option value="spacious">Spacious (24px)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Section Padding
              </label>
              <select
                value={draft.layout.sectionPadding}
                onChange={e =>
                  updateDraft(prev => ({
                    ...prev,
                    layout: {
                      ...prev.layout,
                      sectionPadding: e.target.value as 'compact' | 'standard' | 'generous'
                    }
                  }))
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 bg-white"
              >
                <option value="compact">Compact</option>
                <option value="standard">Standard (Recommended)</option>
                <option value="generous">Generous</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* LIVE RESPONSIVE PREVIEW (Always shown on PREVIEW tab and as live visual feedback below DESIGN) */}
      {(activeEditorTab === 'PREVIEW' || activeEditorTab === 'DESIGN') && (
        <div className="bg-slate-100/90 rounded-2xl border border-slate-200 p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <Eye className="w-4 h-4 text-[#008972]" />
              <span>Live Storefront Preview ({previewDevice})</span>
            </div>

            <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 max-w-fit">
              {[
                { id: 'DESKTOP', label: 'Desktop', icon: Monitor },
                { id: 'TABLET', label: 'Tablet', icon: Tablet },
                { id: 'MOBILE', label: 'Mobile', icon: Smartphone }
              ].map(dev => {
                const Icon = dev.icon;
                return (
                  <button
                    key={dev.id}
                    type="button"
                    onClick={() => setPreviewDevice(dev.id as any)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      previewDevice === dev.id
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{dev.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="w-full overflow-x-auto flex justify-center py-4 bg-[#F8FAFC] rounded-xl border border-slate-200/80">
            <div
              className={`w-full transition-all duration-200 ${
                previewDevice === 'DESKTOP'
                  ? 'max-w-full'
                  : previewDevice === 'TABLET'
                    ? 'max-w-[768px]'
                    : 'max-w-[390px]'
              }`}
            >
              <DemoBookingSection
                config={{ ...draft, isActive: sectionActiveDraft }}
                sectionActive={sectionActiveDraft}
                previewMode
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
