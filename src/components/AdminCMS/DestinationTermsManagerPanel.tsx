import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Copy,
  Edit3,
  Eye,
  FileText,
  GitBranch,
  History,
  Layers,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import {
  CityHub,
  Destination,
  DestinationCommercialTermsConfig,
  DestinationRegionItem,
  DestinationTermsSection,
  DestinationTermsTargetType,
  DestinationTermsVersionRecord,
  User
} from '../../types';
import { destinationTermsService, ResolvedTargetDescriptor } from '../../services/destinationTermsService';
import {
  renderDestinationSectionsToHtml,
  renderDestinationSectionsToPlainText,
  renderDestinationSectionsToWhatsApp
} from '../../constants/commercialQuotationTerms';
import { RichTextEditor } from '../common/RichTextEditor';
import { RichTextRenderer } from '../common/RichTextRenderer';

interface DestinationTermsManagerPanelProps {
  destination: Destination;
  regions: DestinationRegionItem[];
  cityHubs: CityHub[];
  allDestinations: Destination[];
  user: User | null;
  initialTargetId?: string;
}

export const DestinationTermsManagerPanel: React.FC<DestinationTermsManagerPanelProps> = ({
  destination,
  regions,
  cityHubs,
  allDestinations,
  user,
  initialTargetId
}) => {
  // Build target options: Master Destination + its Regions + its City Hubs
  const targetOptions = useMemo<ResolvedTargetDescriptor[]>(() => {
    const destTarget = destinationTermsService.resolveCanonicalTarget({
      targetId: destination.id,
      targetName: destination.name,
      targetType: 'DESTINATION'
    });

    const list: ResolvedTargetDescriptor[] = [destTarget];

    cityHubs
      .filter(
        (h) =>
          h.destinationId === destination.id ||
          destinationTermsService.resolveCanonicalTarget({ targetId: h.destinationId, targetType: 'DESTINATION' }).targetId ===
            destTarget.targetId
      )
      .forEach((hub) => {
        list.push(
          destinationTermsService.resolveCanonicalTarget({
            targetId: hub.id,
            targetName: hub.name,
            targetType: 'HUB',
            parentDestinationId: destTarget.targetId,
            parentDestinationName: destTarget.targetName
          })
        );
      });

    regions
      .filter(
        (r) =>
          r.destinationId === destination.id ||
          destinationTermsService.resolveCanonicalTarget({ targetId: r.destinationId, targetType: 'DESTINATION' }).targetId ===
            destTarget.targetId
      )
      .forEach((reg) => {
        list.push(
          destinationTermsService.resolveCanonicalTarget({
            targetId: reg.id,
            targetName: reg.name,
            targetType: 'REGION',
            parentDestinationId: destTarget.targetId,
            parentDestinationName: destTarget.targetName
          })
        );
      });

    return list;
  }, [destination, cityHubs, regions]);

  const [selectedTargetId, setSelectedTargetId] = useState<string>(() => {
    if (initialTargetId) {
      const resolved = destinationTermsService.resolveCanonicalTarget({ targetId: initialTargetId });
      if (targetOptions.some((t) => t.targetId === resolved.targetId)) {
        return resolved.targetId;
      }
    }
    return targetOptions[0]?.targetId || destination.id;
  });

  useEffect(() => {
    if (initialTargetId) {
      const resolved = destinationTermsService.resolveCanonicalTarget({ targetId: initialTargetId });
      if (targetOptions.some((t) => t.targetId === resolved.targetId)) {
        setSelectedTargetId(resolved.targetId);
      }
    }
  }, [initialTargetId, targetOptions]);

  const activeTarget = useMemo(
    () => targetOptions.find((t) => t.targetId === selectedTargetId) || targetOptions[0],
    [targetOptions, selectedTargetId]
  );

  const [allConfigs, setAllConfigs] = useState<DestinationCommercialTermsConfig[]>(() =>
    destinationTermsService.getAllCachedConfigs()
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Working state for selected target
  const [sections, setSections] = useState<DestinationTermsSection[]>([]);
  const [allowParentInheritance, setAllowParentInheritance] = useState(false);
  const [isConfigActive, setIsConfigActive] = useState(true);
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'EDIT' | 'PREVIEW' | 'HISTORY'>('EDIT');
  const [previewChannel, setPreviewChannel] = useState<'HTML' | 'PLAIN' | 'WHATSAPP'>('HTML');
  const [changeSummary, setChangeSummary] = useState('');
  const [copySourceId, setCopySourceId] = useState<string>('');
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [versionHistory, setVersionHistory] = useState<DestinationTermsVersionRecord[]>([]);
  const [hasDirtyEdits, setHasDirtyEdits] = useState(false);

  // Load configs on mount and subscribe
  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    destinationTermsService
      .getAllConfigsForAdminAsync()
      .then((cfgs) => {
        if (mounted) setAllConfigs(cfgs);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    const unsub = destinationTermsService.subscribe(() => {
      if (mounted) {
        setAllConfigs(destinationTermsService.getAllCachedConfigs());
      }
    });

    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  const currentConfig = useMemo(
    () => allConfigs.find((c) => c.targetId === activeTarget?.targetId) || null,
    [allConfigs, activeTarget]
  );

  // Sync working editor buffer whenever target or stored config changes
  useEffect(() => {
    if (!activeTarget) return;
    const cfg = allConfigs.find((c) => c.targetId === activeTarget.targetId);
    if (cfg) {
      const working =
        cfg.draftSections && cfg.draftSections.length > 0 ? cfg.draftSections : cfg.sections;
      setSections(working.map((s) => ({ ...s })));
      setAllowParentInheritance(Boolean(cfg.allowParentInheritance));
      setIsConfigActive(cfg.isActive !== false);
      setExpandedSectionId(working[0]?.sectionId || null);
    } else {
      setSections([]);
      setAllowParentInheritance(false);
      setIsConfigActive(true);
      setExpandedSectionId(null);
    }
    setHasDirtyEdits(false);
    setChangeSummary('');
  }, [activeTarget?.targetId, currentConfig?.updatedAt]);

  // Fetch version history when entering History tab
  useEffect(() => {
    if (viewMode === 'HISTORY' && activeTarget?.targetId) {
      destinationTermsService.getVersionHistoryAsync(activeTarget.targetId).then(setVersionHistory);
    }
  }, [viewMode, activeTarget?.targetId, currentConfig?.version]);

  // Other configured destinations/hubs available for cloning
  const copyableConfigs = useMemo(
    () =>
      allConfigs.filter(
        (c) =>
          c.targetId !== activeTarget?.targetId &&
          ((c.sections && c.sections.length > 0) || (c.draftSections && c.draftSections.length > 0))
      ),
    [allConfigs, activeTarget?.targetId]
  );

  const showToast = (type: 'success' | 'error', msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 5000);
  };

  const handleInitialize = async (
    mode: 'TEMPLATE_16' | 'COPY_FROM' | 'SCRATCH',
    sourceTargetId?: string,
    publishImmediately = false
  ) => {
    if (!activeTarget) return;
    setIsSaving(true);
    try {
      const saved = await destinationTermsService.initializeTermsForDestinationAsync({
        target: activeTarget,
        mode,
        sourceTargetId,
        publishImmediately,
        allowParentInheritance,
        user
      });
      setAllConfigs(destinationTermsService.getAllCachedConfigs());
      setSections((saved.draftSections || saved.sections).map((s) => ({ ...s })));
      setExpandedSectionId((saved.draftSections || saved.sections)[0]?.sectionId || null);
      setShowCopyModal(false);
      setHasDirtyEdits(false);
      showToast(
        'success',
        publishImmediately
          ? `Published ${saved.sections.length} terms sections for ${activeTarget.targetName}.`
          : `Initialized ${saved.sections.length} editable draft sections for ${activeTarget.targetName}. Review & publish when ready.`
      );
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to initialize terms.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveOrPublish = async (publish: boolean) => {
    if (!activeTarget) return;
    setIsSaving(true);
    try {
      const saved = await destinationTermsService.saveDestinationTermsAsync({
        target: activeTarget,
        sections,
        publish,
        isActive: isConfigActive,
        allowParentInheritance,
        changeSummary: changeSummary.trim() || undefined,
        user
      });
      setAllConfigs(destinationTermsService.getAllCachedConfigs());
      setHasDirtyEdits(false);
      setChangeSummary('');
      showToast(
        'success',
        publish
          ? `Published v${saved.version} Commercial Quotation Terms for ${activeTarget.targetName}!`
          : `Saved draft Commercial Quotation Terms for ${activeTarget.targetName}.`
      );
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to persist destination terms.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfig = async () => {
    if (!activeTarget || !currentConfig) return;
    setIsSaving(true);
    try {
      await destinationTermsService.deleteDestinationTermsConfigAsync(activeTarget.targetId, user);
      setAllConfigs(destinationTermsService.getAllCachedConfigs());
      setSections([]);
      setHasDirtyEdits(false);
      showToast('success', `Removed Commercial Quotation Terms configuration for ${activeTarget.targetName}.`);
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to remove configuration.');
    } finally {
      setIsSaving(false);
    }
  };

  // Section CRUD helpers
  const handleAddSection = () => {
    const nextOrder = sections.length + 1;
    const newId = `sec-custom-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    const newSec: DestinationTermsSection = {
      sectionId: newId,
      heading: `${nextOrder}. New Commercial Condition`,
      description: '',
      htmlContent: '<p>Specify destination-specific condition details here.</p>',
      displayOrder: nextOrder,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setSections((prev) => [...prev, newSec]);
    setExpandedSectionId(newId);
    setHasDirtyEdits(true);
  };

  const handleUpdateSection = (sectionId: string, patch: Partial<DestinationTermsSection>) => {
    setSections((prev) =>
      prev.map((s) =>
        s.sectionId === sectionId ? { ...s, ...patch, updatedAt: new Date().toISOString() } : s
      )
    );
    setHasDirtyEdits(true);
  };

  const handleDeleteSection = (sectionId: string) => {
    setSections((prev) =>
      prev
        .filter((s) => s.sectionId !== sectionId)
        .map((s, idx) => ({ ...s, displayOrder: idx + 1 }))
    );
    setHasDirtyEdits(true);
  };

  const handleMoveSection = (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= sections.length) return;
    const next = [...sections];
    const [moved] = next.splice(index, 1);
    next.splice(targetIdx, 0, moved);
    setSections(next.map((s, idx) => ({ ...s, displayOrder: idx + 1 })));
    setHasDirtyEdits(true);
  };

  const handleRestoreVersion = (record: DestinationTermsVersionRecord) => {
    setSections(record.sections.map((s) => ({ ...s })));
    setAllowParentInheritance(Boolean(record.allowParentInheritance));
    setHasDirtyEdits(true);
    setViewMode('EDIT');
    showToast(
      'success',
      `Loaded v${record.version} into draft editor. Click "Publish Version" to make it active.`
    );
  };

  const activeSectionsCount = sections.filter((s) => s.isActive !== false).length;
  const previewHtml = useMemo(() => renderDestinationSectionsToHtml(sections), [sections]);
  const previewPlain = useMemo(() => renderDestinationSectionsToPlainText(sections), [sections]);
  const previewWhatsApp = useMemo(() => renderDestinationSectionsToWhatsApp(sections), [sections]);

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="p-4 rounded-2xl bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start space-x-3">
          <div className="w-9 h-9 rounded-xl bg-[#00C6A6] text-slate-950 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h4 className="text-xs sm:text-sm font-black tracking-wide uppercase">
                Commercial Quotation Terms — {destination.name}
              </h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-[#00E5C0] border border-white/15">
                Destination-Specific Isolation
              </span>
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Configure independent commercial terms for <strong>{destination.name}</strong> or individually per City Hub / Region. Changes never affect other destinations.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => destinationTermsService.getAllConfigsForAdminAsync(true).then(setAllConfigs)}
          disabled={isLoading}
          className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer shrink-0 self-start sm:self-center"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Sync</span>
        </button>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{feedback.msg}</span>
        </div>
      )}

      {/* Granularity Target Switcher (Destination Master vs City Hubs / Regions) */}
      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <GitBranch className="w-3.5 h-3.5 text-amber-600" />
            <span>Select Scope ({targetOptions.length} Targets in {destination.name})</span>
          </span>
          <span className="text-[10px] text-slate-500">
            Hub quotes resolve Hub terms first; parent inheritance applies only if explicitly enabled.
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {targetOptions.map((t) => {
            const cfg = allConfigs.find((c) => c.targetId === t.targetId);
            const isSelected = t.targetId === activeTarget?.targetId;
            const isPublished = cfg?.status === 'PUBLISHED' && cfg?.isActive;
            const isInheritedOptIn = Boolean(cfg?.allowParentInheritance && !isPublished);

            return (
              <button
                key={t.targetId}
                type="button"
                onClick={() => setSelectedTargetId(t.targetId)}
                className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                }`}
              >
                <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                  {t.targetType === 'DESTINATION' ? 'MASTER' : t.targetType}
                </span>
                <span>{t.targetName}</span>
                {isPublished ? (
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-emerald-500/20 text-emerald-700 font-extrabold border border-emerald-400/40">
                    v{cfg!.version}
                  </span>
                ) : isInheritedOptIn ? (
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-sky-100 text-sky-800 font-bold">
                    Inherits
                  </span>
                ) : cfg ? (
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-amber-100 text-amber-800 font-bold">
                    Draft
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-rose-100 text-rose-700 font-bold">
                    Missing
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Status & Controls Bar for Selected Target */}
      {activeTarget && (
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-black text-slate-900">
                {activeTarget.targetName}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                ID: {activeTarget.targetId}
              </span>
              {currentConfig?.status === 'PUBLISHED' && currentConfig?.isActive ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Published v{currentConfig.version}</span>
                </span>
              ) : currentConfig ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  {currentConfig.status} {!currentConfig.isActive ? '(Inactive)' : ''}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                  Not Configured (Quotes will block finalisation)
                </span>
              )}
              {currentConfig?.hasUnpublishedDraft && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Unpublished Draft Pending
                </span>
              )}
            </div>

            {activeTarget.targetType !== 'DESTINATION' && (
              <label className="inline-flex items-center gap-2 text-[11px] text-slate-600 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={allowParentInheritance}
                  onChange={(e) => {
                    setAllowParentInheritance(e.target.checked);
                    setHasDirtyEdits(true);
                  }}
                  className="rounded text-teal-600 focus:ring-teal-500"
                />
                <span>
                  Explicitly inherit terms from Parent Destination (<strong>{activeTarget.parentDestinationName || destination.name}</strong>) if {activeTarget.targetName} has no custom published terms
                </span>
              </label>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setViewMode('EDIT')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                viewMode === 'EDIT'
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Editor ({activeSectionsCount}/{sections.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('PREVIEW')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                viewMode === 'PREVIEW'
                  ? 'bg-[#008972] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Preview</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('HISTORY')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                viewMode === 'HISTORY'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Version History</span>
            </button>
          </div>
        </div>
      )}

      {/* VIEW MODE: HISTORY */}
      {viewMode === 'HISTORY' && (
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
              Published Version Audit History — {activeTarget?.targetName}
            </h5>
            <span className="text-[11px] text-slate-500">{versionHistory.length} published snapshots</span>
          </div>

          {versionHistory.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-4 text-center">
              No published versions recorded yet for {activeTarget?.targetName}.
            </p>
          ) : (
            <div className="space-y-2">
              {versionHistory.map((rec) => (
                <div
                  key={rec.id}
                  className="p-3 bg-white rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-slate-900 text-[#00E5C0] text-[10px] font-mono font-bold">
                        v{rec.version}
                      </span>
                      <span className="text-xs font-bold text-slate-900">{rec.changeSummary}</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Published by <strong>{rec.createdBy}</strong> on {new Date(rec.createdAt).toLocaleString()} •{' '}
                      {rec.sections.filter((s) => s.isActive !== false).length} active sections
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRestoreVersion(rec)}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Load Into Draft</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW MODE: PREVIEW */}
      {viewMode === 'PREVIEW' && (
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h5 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
              Live Output Preview — {activeTarget?.targetName} ({activeSectionsCount} Active Sections)
            </h5>
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200">
              {(['HTML', 'PLAIN', 'WHATSAPP'] as const).map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setPreviewChannel(ch)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${
                    previewChannel === ch
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {ch === 'HTML' ? 'Quote / PDF / Email HTML' : ch === 'PLAIN' ? 'Plain Text Email' : 'WhatsApp'}
                </button>
              ))}
            </div>
          </div>

          {sections.filter((s) => s.isActive !== false).length === 0 ? (
            <div className="p-6 text-center bg-white rounded-xl border border-dashed border-slate-300 text-xs text-slate-500">
              No active sections configured yet. Initialize from template or add a section to preview.
            </div>
          ) : previewChannel === 'HTML' ? (
            <div className="p-4 bg-white rounded-xl border border-slate-200">
              <RichTextRenderer content={previewHtml} />
            </div>
          ) : (
            <pre className="p-4 bg-white rounded-xl border border-slate-200 text-xs font-mono text-slate-700 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
              {previewChannel === 'PLAIN' ? previewPlain : previewWhatsApp}
            </pre>
          )}
        </div>
      )}

      {/* VIEW MODE: EDIT */}
      {viewMode === 'EDIT' && (
        <>
          {sections.length === 0 ? (
            <div className="p-6 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-300 text-center space-y-4">
              <div className="space-y-1 max-w-lg mx-auto">
                <h5 className="text-sm font-black text-slate-900">
                  Configure Commercial Quotation Terms for {activeTarget?.targetName}
                </h5>
                <p className="text-xs text-slate-500">
                  Start from the 16-section B2B Commercial Terms template, copy an existing destination's setup independently, or build custom terms from scratch.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleInitialize('TEMPLATE_16', undefined, false)}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Start with 16-Section Template</span>
                </button>

                <button
                  type="button"
                  disabled={isSaving || copyableConfigs.length === 0}
                  onClick={() => {
                    setCopySourceId(copyableConfigs[0]?.targetId || '');
                    setShowCopyModal(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Copy className="w-4 h-4 text-teal-600" />
                  <span>Copy from Another Destination ({copyableConfigs.length})</span>
                </button>

                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleInitialize('SCRATCH', undefined, false)}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create from Scratch</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Top Section Controls */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAddSection}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Section</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCopySourceId(copyableConfigs[0]?.targetId || '');
                      setShowCopyModal(true);
                    }}
                    disabled={copyableConfigs.length === 0}
                    className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Copy className="w-3.5 h-3.5 text-teal-600" />
                    <span>Copy from Another Destination</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInitialize('TEMPLATE_16', undefined, false)}
                    className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Load 16-Section Template</span>
                  </button>
                </div>

                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isConfigActive}
                    onChange={(e) => {
                      setIsConfigActive(e.target.checked);
                      setHasDirtyEdits(true);
                    }}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Destination Terms Active</span>
                </label>
              </div>

              {/* Sections List */}
              <div className="space-y-2">
                {sections.map((sec, idx) => {
                  const isExpanded = expandedSectionId === sec.sectionId;
                  return (
                    <div
                      key={sec.sectionId}
                      className={`rounded-2xl border transition-all ${
                        sec.isActive !== false
                          ? 'bg-white border-slate-200'
                          : 'bg-slate-50 border-slate-200 opacity-75'
                      }`}
                    >
                      <div className="p-3 flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setExpandedSectionId(isExpanded ? null : sec.sectionId)}
                          className="flex items-center gap-2.5 text-left flex-1 min-w-0 cursor-pointer"
                        >
                          <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 font-mono font-bold text-[11px] flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-slate-900 block truncate">
                              {sec.heading || '(Untitled Section)'}
                            </span>
                            {sec.description && (
                              <span className="text-[10px] text-slate-500 block truncate">
                                {sec.description}
                              </span>
                            )}
                          </div>
                        </button>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleUpdateSection(sec.sectionId, { isActive: !(sec.isActive !== false) })}
                            title={sec.isActive !== false ? 'Deactivate section' : 'Activate section'}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer ${
                              sec.isActive !== false
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {sec.isActive !== false ? (
                              <>
                                <ToggleRight className="w-3.5 h-3.5" />
                                <span>Active</span>
                              </>
                            ) : (
                              <>
                                <ToggleLeft className="w-3.5 h-3.5" />
                                <span>Inactive</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleMoveSection(idx, -1)}
                            disabled={idx === 0}
                            title="Move Up"
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveSection(idx, 1)}
                            disabled={idx === sections.length - 1}
                            title="Move Down"
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSection(sec.sectionId)}
                            title="Remove Section"
                            className="p-1.5 rounded-lg border border-slate-200 text-rose-500 hover:bg-rose-50 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="p-3.5 pt-2 border-t border-slate-100 space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                                Section Heading *
                              </label>
                              <input
                                type="text"
                                value={sec.heading}
                                onChange={(e) => handleUpdateSection(sec.sectionId, { heading: e.target.value })}
                                placeholder="e.g. 1. Booking Status & Availability"
                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:border-amber-500 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                                Internal Summary / Description
                              </label>
                              <input
                                type="text"
                                value={sec.description || ''}
                                onChange={(e) => handleUpdateSection(sec.sectionId, { description: e.target.value })}
                                placeholder="Short note shown in CMS list"
                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-amber-500 focus:outline-none"
                              />
                            </div>
                          </div>

                          <RichTextEditor
                            label="Terms Content (Lists, Tables, Hyperlinks Supported)"
                            value={sec.htmlContent}
                            onChange={(html) => handleUpdateSection(sec.sectionId, { htmlContent: html })}
                            minHeight="130px"
                            compact
                            debounceMs={120}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Publish & Save Action Footer */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Version Change Note (for Audit History)
                    </label>
                    <input
                      type="text"
                      value={changeSummary}
                      onChange={(e) => setChangeSummary(e.target.value)}
                      placeholder="e.g. Updated Tokyo deposit cut-off to 45 days for Cherry Blossom"
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {currentConfig && (
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={handleDeleteConfig}
                        className="px-3 py-2 rounded-xl bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-xs font-bold cursor-pointer"
                      >
                        Clear Terms
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleSaveOrPublish(false)}
                      className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Draft{hasDirtyEdits ? ' *' : ''}</span>
                    </button>

                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleSaveOrPublish(true)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isSaving ? 'Publishing...' : 'Publish Live Terms'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Copy from Another Destination Modal */}
      {showCopyModal && (
        <div className="fixed inset-0 z-[60] bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Copy className="w-4 h-4 text-teal-600" />
                <h5 className="text-xs font-black uppercase tracking-wider text-slate-900">
                  Copy Terms Independently
                </h5>
              </div>
              <button
                type="button"
                onClick={() => setShowCopyModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Creates a completely independent configuration for <strong>{activeTarget?.targetName}</strong>. Future edits will never affect the source destination.
            </p>

            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Select Source Destination / Hub
              </label>
              <select
                value={copySourceId}
                onChange={(e) => setCopySourceId(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
              >
                {copyableConfigs.map((cfg) => (
                  <option key={cfg.targetId} value={cfg.targetId}>
                    {cfg.targetName} ({cfg.targetType}) — v{cfg.version} • {cfg.sections.length} sections
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCopyModal(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!copySourceId || isSaving}
                onClick={() => handleInitialize('COPY_FROM', copySourceId, false)}
                className="px-4 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                Copy Into Independent Draft
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
