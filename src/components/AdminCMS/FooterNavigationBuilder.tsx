import React, { useState, useEffect, useMemo } from 'react';
import { AppDatabase } from '../../services/db';
import { 
  FooterConfig, 
  FooterMenuColumn, 
  FooterMenuLink, 
  CustomPage, 
  Destination 
} from '../../types';
import { useAuth } from '../../context/AuthContext';
import { 
  Columns, 
  Plus, 
  Trash2, 
  Edit3, 
  Save, 
  Check, 
  ArrowUp, 
  ArrowDown, 
  ArrowLeft,
  ArrowRight,
  Eye, 
  EyeOff, 
  Link as LinkIcon, 
  ExternalLink,
  Search,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Smartphone,
  Tablet,
  Monitor,
  RefreshCw,
  Send,
  HelpCircle,
  FileText,
  Compass,
  LayoutGrid,
  Lock,
  Globe,
  SlidersHorizontal,
  ChevronDown,
  X,
  Copy
} from 'lucide-react';

interface SystemViewOption {
  id: string;
  label: string;
  category: string;
  targetId: string;
  defaultUrl: string;
  description: string;
}

const SYSTEM_VIEWS: SystemViewOption[] = [
  { id: 'sys-builder', label: 'B2B Quotation Builder', category: 'Trade Tools', targetId: 'b2b-builder', defaultUrl: 'system:b2b-builder', description: 'Instant multi-day luxury tariff calculator' },
  { id: 'sys-visas', label: 'Visa Desk & Checklists', category: 'Trade Tools', targetId: 'visas', defaultUrl: 'system:visas', description: 'Real-time entry clearance & document portal' },
  { id: 'sys-contact', label: 'Agent Support Desk & Operations', category: 'Support', targetId: 'contact', defaultUrl: 'system:contact', description: '24/7 Ground operations & emergency dispatch' },
  { id: 'sys-blogs', label: 'Travel Blogs & Destination Guides', category: 'Content', targetId: 'blogs', defaultUrl: 'system:blogs', description: 'Curated itineraries and market briefings' },
  { id: 'sys-terms', label: 'Terms of Service & B2B SLA', category: 'Legal', targetId: 'terms', defaultUrl: 'system:terms', description: 'Contracted rates guarantee and booking terms' },
  { id: 'sys-privacy', label: 'Privacy & Data Protection Policy', category: 'Legal', targetId: 'privacy', defaultUrl: 'system:privacy', description: 'GDPR and confidential client data safety' },
  { id: 'sys-refund', label: 'Refund & Cancellation Protocol', category: 'Legal', targetId: 'refund', defaultUrl: 'system:refund', description: 'Force majeure, milestone refunds and cancellation' },
  { id: 'sys-destinations', label: 'All Destinations Portfolio', category: 'Navigation', targetId: 'destinations', defaultUrl: 'system:destinations', description: 'Master directory of all 5 operational regions' },
  { id: 'sys-account', label: 'Partner Portal & Agency Account', category: 'Partner', targetId: 'account', defaultUrl: 'system:account', description: 'Agent profile, commission tier & credit terms' }
];

export const FooterNavigationBuilder: React.FC = () => {
  const db = AppDatabase.getInstance();
  const { user } = useAuth();

  const [footerConfig, setFooterConfig] = useState<FooterConfig>(() => db.getFooterConfig());
  const [columns, setColumns] = useState<FooterMenuColumn[]>(() => db.getFooterConfig().columns || []);
  const [customPages, setCustomPages] = useState<CustomPage[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  
  // UI & Viewport States
  const [previewMode, setPreviewMode] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeColumnSearch, setActiveColumnSearch] = useState('');

  // Column Modal State
  const [editingColumn, setEditingColumn] = useState<FooterMenuColumn | null>(null);
  const [isCreatingColumn, setIsCreatingColumn] = useState(false);
  const [columnToDelete, setColumnToDelete] = useState<FooterMenuColumn | null>(null);

  // Link Modal State
  const [editingLink, setEditingLink] = useState<FooterMenuLink | null>(null);
  const [isCreatingLink, setIsCreatingLink] = useState(false);
  const [targetColumnIdForLink, setTargetColumnIdForLink] = useState<string | null>(null);
  
  // Link Selector Form States
  const [linkType, setLinkType] = useState<'CMS_PAGE' | 'DESTINATION' | 'SYSTEM_VIEW' | 'EXTERNAL_LINK' | 'CUSTOM_LINK'>('CMS_PAGE');
  const [linkLabel, setLinkLabel] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTargetId, setLinkTargetId] = useState('');
  const [linkOpenIn, setLinkOpenIn] = useState<'_self' | '_blank'>('_self');
  const [linkStatus, setLinkStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [selectorSearch, setSelectorSearch] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = () => {
    const config = db.getFooterConfig();
    setFooterConfig(config);
    setColumns(config.columns || []);
    setCustomPages(db.getCustomPages());
    setDestinations(db.getDestinations());
    setHasUnsavedChanges(false);
  };

  useEffect(() => {
    loadData();
    const unsub = db.subscribe(() => {
      setCustomPages(db.getCustomPages());
      setDestinations(db.getDestinations());
    });
    return unsub;
  }, []);

  // Validation Check for Broken Links
  const validationReport = useMemo(() => {
    const issues: { columnId: string; columnTitle: string; linkId: string; linkLabel: string; reason: string; severity: 'ERROR' | 'WARN' }[] = [];
    let totalLinks = 0;

    columns.forEach(col => {
      (col.links || []).forEach(l => {
        totalLinks++;
        if (l.type === 'CUSTOM_PAGE') {
          const page = customPages.find(p => p.slug === l.targetId || p.id === l.targetId);
          if (!page) {
            issues.push({
              columnId: col.id,
              columnTitle: col.title,
              linkId: l.id,
              linkLabel: l.label,
              reason: `Linked CMS page "${l.targetId}" does not exist in database.`,
              severity: 'ERROR'
            });
          } else if (!page.isPublished) {
            issues.push({
              columnId: col.id,
              columnTitle: col.title,
              linkId: l.id,
              linkLabel: l.label,
              reason: `Linked CMS page "${page.title}" is currently unpublished.`,
              severity: 'WARN'
            });
          }
        } else if (l.type === 'DESTINATION') {
          if (l.targetId !== 'all') {
            const dest = destinations.find(d => d.slug === l.targetId || d.id === l.targetId);
            if (!dest) {
              issues.push({
                columnId: col.id,
                columnTitle: col.title,
                linkId: l.id,
                linkLabel: l.label,
                reason: `Linked destination "${l.targetId}" is not found.`,
                severity: 'ERROR'
              });
            } else if (dest.status === 'INACTIVE') {
              issues.push({
                columnId: col.id,
                columnTitle: col.title,
                linkId: l.id,
                linkLabel: l.label,
                reason: `Linked destination "${dest.name}" is inactive.`,
                severity: 'WARN'
              });
            }
          }
        } else if (l.type === 'EXTERNAL_LINK' || l.type === 'CUSTOM_LINK') {
          if (!l.url || l.url === '#' || l.url.trim() === '') {
            issues.push({
              columnId: col.id,
              columnTitle: col.title,
              linkId: l.id,
              linkLabel: l.label,
              reason: 'Empty URL destination configured for custom/external link.',
              severity: 'ERROR'
            });
          }
        }
      });
    });

    return {
      totalChecked: totalLinks,
      brokenCount: issues.length,
      issues
    };
  }, [columns, customPages, destinations]);

  // Handle Adding / Editing Column
  const handleOpenAddColumn = () => {
    const nextOrder = columns.length + 1;
    const newCol: FooterMenuColumn = {
      id: `col-${Date.now()}`,
      title: `Column ${nextOrder}`,
      displayOrder: nextOrder,
      status: 'ACTIVE',
      isVisible: true,
      description: '',
      links: []
    };
    setEditingColumn(newCol);
    setIsCreatingColumn(true);
  };

  const handleSaveColumn = () => {
    if (!editingColumn || !editingColumn.title.trim()) {
      alert('Please provide a column title.');
      return;
    }

    let updatedCols: FooterMenuColumn[];
    if (isCreatingColumn) {
      updatedCols = [...columns, editingColumn];
    } else {
      updatedCols = columns.map(c => c.id === editingColumn.id ? editingColumn : c);
    }

    setColumns(updatedCols);
    setHasUnsavedChanges(true);
    setEditingColumn(null);
    setIsCreatingColumn(false);
    showToast(`Column "${editingColumn.title}" updated in working draft.`);
  };

  // Reordering Columns
  const handleMoveColumn = (index: number, direction: 'LEFT' | 'RIGHT') => {
    const targetIndex = direction === 'LEFT' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= columns.length) return;

    const newCols = [...columns];
    const [moved] = newCols.splice(index, 1);
    newCols.splice(targetIndex, 0, moved);
    
    // Reassign displayOrder
    const reordered = newCols.map((col, idx) => ({ ...col, displayOrder: idx + 1 }));
    setColumns(reordered);
    setHasUnsavedChanges(true);
    showToast(`Reordered column "${moved.title}"`);
  };

  // Column Status Toggle
  const handleToggleColumnVisibility = (colId: string) => {
    const updated = columns.map(c => {
      if (c.id === colId) {
        const nextVis = !(c.isVisible !== false);
        return {
          ...c,
          isVisible: nextVis,
          status: nextVis ? ('ACTIVE' as const) : ('INACTIVE' as const)
        };
      }
      return c;
    });
    setColumns(updated);
    setHasUnsavedChanges(true);
  };

  // Safe Column Deletion
  const handleConfirmDeleteColumn = () => {
    if (!columnToDelete) return;
    const colTitle = columnToDelete.title;
    const updated = columns.filter(c => c.id !== columnToDelete.id).map((c, idx) => ({ ...c, displayOrder: idx + 1 }));
    setColumns(updated);
    setHasUnsavedChanges(true);
    setColumnToDelete(null);
    showToast(`Removed column "${colTitle}". Linked CMS pages are safe.`);
  };

  // Link Management
  const handleOpenAddLink = (colId: string) => {
    setTargetColumnIdForLink(colId);
    setEditingLink(null);
    setIsCreatingLink(true);
    setLinkType('CMS_PAGE');
    setLinkLabel('');
    setLinkUrl('');
    setLinkTargetId('');
    setLinkOpenIn('_self');
    setLinkStatus('ACTIVE');
    setSelectorSearch('');
  };

  const handleOpenEditLink = (colId: string, link: FooterMenuLink) => {
    setTargetColumnIdForLink(colId);
    setEditingLink(link);
    setIsCreatingLink(false);
    setLinkType(link.type as any || 'CUSTOM_PAGE');
    setLinkLabel(link.label);
    setLinkUrl(link.url);
    setLinkTargetId(link.targetId || '');
    setLinkOpenIn(link.openIn || (link.url.startsWith('http') ? '_blank' : '_self'));
    setLinkStatus(link.status || 'ACTIVE');
    setSelectorSearch('');
  };

  const handleSelectPredefinedTarget = (type: 'CMS_PAGE' | 'DESTINATION' | 'SYSTEM_VIEW', target: any) => {
    if (type === 'CMS_PAGE') {
      setLinkType('CMS_PAGE');
      setLinkLabel(target.menuLabel || target.title);
      setLinkTargetId(target.slug);
      setLinkUrl(`/page/${target.slug}`);
      setLinkOpenIn('_self');
    } else if (type === 'DESTINATION') {
      setLinkType('DESTINATION');
      setLinkLabel(target.name);
      setLinkTargetId(target.slug);
      setLinkUrl(`/destination/${target.slug}`);
      setLinkOpenIn('_self');
    } else if (type === 'SYSTEM_VIEW') {
      setLinkType('SYSTEM_VIEW');
      setLinkLabel(target.label);
      setLinkTargetId(target.targetId);
      setLinkUrl(target.defaultUrl);
      setLinkOpenIn('_self');
    }
  };

  const handleSaveLink = () => {
    if (!targetColumnIdForLink) return;
    if (!linkLabel.trim()) {
      alert('Link label is required.');
      return;
    }

    let finalUrl = linkUrl.trim();
    if (linkType === 'EXTERNAL_LINK' || linkType === 'CUSTOM_LINK') {
      if (!finalUrl) {
        alert('Please enter a destination URL, email (mailto:), or phone (tel:).');
        return;
      }
      if (!finalUrl.startsWith('http') && !finalUrl.startsWith('mailto:') && !finalUrl.startsWith('tel:') && !finalUrl.startsWith('/')) {
        finalUrl = `https://${finalUrl}`;
      }
    }

    const colIndex = columns.findIndex(c => c.id === targetColumnIdForLink);
    if (colIndex === -1) return;

    const targetCol = columns[colIndex];
    const existingLinks = targetCol.links ? [...targetCol.links] : [];

    let updatedLinks: FooterMenuLink[];
    if (isCreatingLink) {
      const newL: FooterMenuLink = {
        id: `link-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        label: linkLabel.trim(),
        url: finalUrl || '#',
        type: linkType,
        targetId: linkTargetId.trim() || undefined,
        displayOrder: existingLinks.length + 1,
        status: linkStatus,
        openIn: linkOpenIn,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      updatedLinks = [...existingLinks, newL];
    } else if (editingLink) {
      updatedLinks = existingLinks.map(l => {
        if (l.id === editingLink.id) {
          return {
            ...l,
            label: linkLabel.trim(),
            url: finalUrl || '#',
            type: linkType,
            targetId: linkTargetId.trim() || undefined,
            status: linkStatus,
            openIn: linkOpenIn,
            updatedAt: new Date().toISOString()
          };
        }
        return l;
      });
    } else {
      return;
    }

    const updatedCol = {
      ...targetCol,
      links: updatedLinks.map((l, idx) => ({ ...l, displayOrder: idx + 1 }))
    };

    const newColumns = [...columns];
    newColumns[colIndex] = updatedCol;
    setColumns(newColumns);
    setHasUnsavedChanges(true);

    setTargetColumnIdForLink(null);
    setEditingLink(null);
    setIsCreatingLink(false);
    showToast(`Saved link "${linkLabel}" to "${targetCol.title}"`);
  };

  const handleMoveLink = (colId: string, linkIndex: number, direction: 'UP' | 'DOWN') => {
    const colIndex = columns.findIndex(c => c.id === colId);
    if (colIndex === -1) return;

    const col = columns[colIndex];
    const links = col.links ? [...col.links] : [];
    const targetIdx = direction === 'UP' ? linkIndex - 1 : linkIndex + 1;
    if (targetIdx < 0 || targetIdx >= links.length) return;

    const [moved] = links.splice(linkIndex, 1);
    links.splice(targetIdx, 0, moved);

    const updatedCol = {
      ...col,
      links: links.map((l, idx) => ({ ...l, displayOrder: idx + 1 }))
    };

    const newColumns = [...columns];
    newColumns[colIndex] = updatedCol;
    setColumns(newColumns);
    setHasUnsavedChanges(true);
  };

  const handleDeleteLink = (colId: string, linkId: string, linkLabel: string) => {
    const colIndex = columns.findIndex(c => c.id === colId);
    if (colIndex === -1) return;

    const col = columns[colIndex];
    const links = (col.links || []).filter(l => l.id !== linkId).map((l, idx) => ({ ...l, displayOrder: idx + 1 }));

    const updatedCol = { ...col, links };
    const newColumns = [...columns];
    newColumns[colIndex] = updatedCol;
    setColumns(newColumns);
    setHasUnsavedChanges(true);
    showToast(`Removed link "${linkLabel}". The page remains in the CMS.`);
  };

  const handleToggleLinkStatus = (colId: string, linkId: string) => {
    const colIndex = columns.findIndex(c => c.id === colId);
    if (colIndex === -1) return;

    const col = columns[colIndex];
    const links = (col.links || []).map(l => {
      if (l.id === linkId) {
        return {
          ...l,
          status: (l.status === 'INACTIVE' ? 'ACTIVE' : 'INACTIVE') as 'ACTIVE' | 'INACTIVE'
        };
      }
      return l;
    });

    const updatedCol = { ...col, links };
    const newColumns = [...columns];
    newColumns[colIndex] = updatedCol;
    setColumns(newColumns);
    setHasUnsavedChanges(true);
  };

  // Publish / Save Draft Actions
  const handlePublish = () => {
    if (validationReport.brokenCount > 0) {
      const confirmPublish = confirm(
        `Warning: There are ${validationReport.brokenCount} link warning(s) in your footer navigation. Do you still want to publish to live?`
      );
      if (!confirmPublish) return;
    }

    db.publishFooterConfig(columns, user);
    const updated = db.getFooterConfig();
    setFooterConfig(updated);
    setColumns(updated.columns);
    setHasUnsavedChanges(false);
    showToast('🚀 Footer navigation published live to website successfully!');
  };

  const handleSaveDraft = () => {
    db.saveFooterDraft(columns, user);
    const updated = db.getFooterConfig();
    setFooterConfig(updated);
    setHasUnsavedChanges(false);
    showToast('💾 Saved footer changes as working draft.');
  };

  const handleDiscardChanges = () => {
    if (confirm('Discard all unsaved working changes and reload last published configuration?')) {
      loadData();
      showToast('Reverted to published configuration.');
    }
  };

  // Filtered available items for Page Selector Search
  const filteredCustomPages = useMemo(() => {
    const q = selectorSearch.toLowerCase().trim();
    if (!q) return customPages;
    return customPages.filter(p => p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q));
  }, [customPages, selectorSearch]);

  const filteredDestinations = useMemo(() => {
    const q = selectorSearch.toLowerCase().trim();
    if (!q) return destinations;
    return destinations.filter(d => d.name.toLowerCase().includes(q) || d.slug.toLowerCase().includes(q));
  }, [destinations, selectorSearch]);

  const filteredSystemViews = useMemo(() => {
    const q = selectorSearch.toLowerCase().trim();
    if (!q) return SYSTEM_VIEWS;
    return SYSTEM_VIEWS.filter(s => s.label.toLowerCase().includes(q) || s.category.toLowerCase().includes(q) || s.description.toLowerCase().includes(q));
  }, [selectorSearch]);

  const activeColumnsCount = columns.filter(c => c.isVisible !== false && c.status !== 'INACTIVE').length;
  const totalLinksCount = columns.reduce((acc, c) => acc + (c.links?.length || 0), 0);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 text-xs font-bold flex items-center space-x-2 animate-in fade-in slide-in-from-bottom-4">
          <CheckCircle2 className="w-4 h-4 text-[#00E5C0]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner Toolbar */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-[#00C6A6]/10 text-emerald-900 border border-[#00C6A6]/30">
              <Columns className="w-3.5 h-3.5 text-emerald-700" />
              <span>Dynamic Footer Navigation Builder</span>
            </span>

            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
              Footer Columns: {columns.length} ({activeColumnsCount} Active)
            </span>

            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
              {totalLinksCount} Links Total
            </span>

            {footerConfig.status === 'PUBLISHED' && !hasUnsavedChanges ? (
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Live & Published</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span>Draft Changes Pending</span>
              </span>
            )}
          </div>

          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Comprehensive Multi-Column Footer Architecture
          </h2>
          <p className="text-xs text-slate-500 max-w-2xl">
            Add, reorder, and configure custom footer columns. Connect existing CMS pages, destinations, system tools, or external links with full real-time database synchronization.
          </p>
        </div>

        {/* Global Controls & Actions */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className={`inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
              previewMode 
                ? 'bg-slate-900 text-[#00E5C0] border-slate-900 shadow-xs' 
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{previewMode ? 'Exit Live Preview' : 'Preview Footer'}</span>
          </button>

          {hasUnsavedChanges && (
            <button
              onClick={handleDiscardChanges}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all cursor-pointer"
              title="Discard working edits and reload published state"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Discard</span>
            </button>
          )}

          <button
            onClick={handleSaveDraft}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 transition-all cursor-pointer border border-slate-200"
          >
            <Save className="w-3.5 h-3.5 text-slate-600" />
            <span>Save Draft</span>
          </button>

          <button
            onClick={handleOpenAddColumn}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition-all cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 text-[#00E5C0]" />
            <span>+ Add Column</span>
          </button>

          <button
            onClick={handlePublish}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#008972] hover:bg-[#007360] text-white transition-all cursor-pointer shadow-xs"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Publish Live</span>
          </button>
        </div>
      </div>

      {/* Broken Link Validation Banner */}
      {validationReport.brokenCount > 0 && (
        <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 flex items-start space-x-3 text-xs text-amber-900">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1 flex-1">
            <div className="font-extrabold flex items-center space-x-2">
              <span>Broken / Unpublished Links Warning ({validationReport.brokenCount} Issues Detected)</span>
            </div>
            <p className="text-amber-800">
              The following links in your footer point to missing, unpublished, or empty targets:
            </p>
            <ul className="list-disc pl-5 space-y-0.5 text-[11px] text-amber-800 font-medium">
              {validationReport.issues.map((iss, idx) => (
                <li key={idx}>
                  <strong className="text-amber-950">{iss.columnTitle} → {iss.linkLabel}:</strong> {iss.reason}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Live Preview Screen */}
      {previewMode && (
        <div className="bg-slate-950 rounded-3xl p-6 border border-slate-800 shadow-2xl space-y-6 text-white animate-in fade-in zoom-in-95">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-center space-x-3">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                  <span>Interactive Live Footer Simulation</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-[#00E5C0] font-mono">
                    Realistic Website Preview
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Simulating active columns, responsive grid breakpoints, and interactive links.
                </p>
              </div>
            </div>

            {/* Viewport Width Switchers */}
            <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setPreviewDevice('desktop')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  previewDevice === 'desktop' ? 'bg-slate-800 text-[#00E5C0]' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Desktop</span>
              </button>
              <button
                onClick={() => setPreviewDevice('tablet')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  previewDevice === 'tablet' ? 'bg-slate-800 text-[#00E5C0]' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Tablet className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tablet</span>
              </button>
              <button
                onClick={() => setPreviewDevice('mobile')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  previewDevice === 'mobile' ? 'bg-slate-800 text-[#00E5C0]' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Mobile</span>
              </button>
            </div>
          </div>

          {/* Scaled Preview Frame */}
          <div className={`mx-auto transition-all duration-300 ${
            previewDevice === 'desktop' ? 'max-w-7xl' : previewDevice === 'tablet' ? 'max-w-3xl' : 'max-w-sm'
          }`}>
            <div className="bg-slate-900/90 rounded-2xl border border-slate-800/80 p-8 space-y-10">
              {/* Brand & Dynamic Columns */}
              <div className={`grid gap-8 pb-8 border-b border-slate-800 ${
                previewDevice === 'mobile' 
                  ? 'grid-cols-1' 
                  : previewDevice === 'tablet' 
                  ? 'grid-cols-2' 
                  : 'grid-cols-1 md:grid-cols-12'
              }`}>
                {/* Brand Column */}
                <div className={`${previewDevice === 'desktop' ? 'md:col-span-4' : 'col-span-1'} space-y-3`}>
                  <div className="space-y-1">
                    <span className="text-xl font-black tracking-tight text-white block lowercase">
                      theunbound
                    </span>
                    <span className="text-[10px] tracking-wider text-[#00C6A6] font-bold block">
                      Unbound Experiences India Pvt Ltd
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {footerConfig.tagline || 'Professional Destination Management Company and wholesale technology operator providing contracted B2B wholesale rates and bespoke ground operations.'}
                  </p>
                </div>

                {/* Dynamic Columns In Preview */}
                <div className={`${previewDevice === 'desktop' ? 'md:col-span-8' : 'col-span-1'} grid gap-6 ${
                  previewDevice === 'mobile' 
                    ? 'grid-cols-1' 
                    : previewDevice === 'tablet' 
                    ? 'grid-cols-2' 
                    : columns.filter(c => c.isVisible !== false).length <= 3 
                    ? 'grid-cols-3' 
                    : columns.filter(c => c.isVisible !== false).length === 4 
                    ? 'grid-cols-4' 
                    : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
                }`}>
                  {columns
                    .filter(col => col.isVisible !== false && col.status !== 'INACTIVE')
                    .map(col => (
                      <div key={col.id} className="space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center space-x-1.5">
                          <span>{col.title}</span>
                        </h4>
                        {col.description && (
                          <p className="text-[10px] text-slate-400 leading-tight">{col.description}</p>
                        )}
                        <ul className="space-y-2 text-xs text-slate-400">
                          {(col.links || [])
                            .filter(l => l.status !== 'INACTIVE')
                            .map(link => (
                              <li key={link.id}>
                                <button
                                  onClick={() => alert(`Simulating click on link "${link.label}" (Target: ${link.targetId || link.url})`)}
                                  className="hover:text-[#00C6A6] text-slate-400 transition-colors text-left flex items-center space-x-1.5 cursor-pointer text-xs group"
                                >
                                  <span className="group-hover:translate-x-0.5 transition-transform">{link.label}</span>
                                  {link.openIn === '_blank' && (
                                    <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                                  )}
                                </button>
                              </li>
                            ))}
                          {(!col.links || col.links.length === 0) && (
                            <li className="text-[11px] text-slate-400 italic">No links in column</li>
                          )}
                        </ul>
                      </div>
                    ))}
                </div>
              </div>

              {/* Bottom Copyright */}
              <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-4 pt-2">
                <span>{footerConfig.copyrightText || '© 2026 TheUnbound DMC Operations Ltd. All rights reserved.'}</span>
                <span className="text-[10px] text-slate-400">
                  Global DMC Protocol • Real-time Firebase Sync
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Columns Builder Area */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
              Footer Navigation Columns ({columns.length})
            </h3>
            <p className="text-xs text-slate-500">
              Drag or use arrow controls to reorder columns and links. Click any link to edit its target.
            </p>
          </div>

          {/* Search filter for columns */}
          <div className="relative min-w-[240px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={activeColumnSearch}
              onChange={e => setActiveColumnSearch(e.target.value)}
              placeholder="Filter columns or links..."
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-500 placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Dynamic Column Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {columns
            .filter(col => {
              if (!activeColumnSearch) return true;
              const q = activeColumnSearch.toLowerCase();
              return col.title.toLowerCase().includes(q) || (col.links || []).some(l => l.label.toLowerCase().includes(q) || (l.targetId || '').toLowerCase().includes(q));
            })
            .map((col, cIdx) => {
              const isActive = col.isVisible !== false && col.status !== 'INACTIVE';
              const colLinks = col.links || [];

              return (
                <div 
                  key={col.id} 
                  className={`bg-white rounded-3xl border transition-all flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-md ${
                    isActive ? 'border-slate-200' : 'border-slate-200 bg-slate-50/50 opacity-75'
                  }`}
                >
                  {/* Card Header */}
                  <div className="p-5 pb-3 border-b border-slate-100 bg-slate-50/70 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center space-x-2 truncate">
                        <span className="w-5 h-5 rounded-full bg-slate-900 text-white font-mono text-[10px] font-extrabold flex items-center justify-center shrink-0">
                          {cIdx + 1}
                        </span>
                        <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider truncate" title={col.title}>
                          {col.title}
                        </h4>
                      </div>

                      <div className="flex items-center space-x-1 shrink-0">
                        {/* Move Left / Right Controls */}
                        <button
                          onClick={() => handleMoveColumn(cIdx, 'LEFT')}
                          disabled={cIdx === 0}
                          className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-30 rounded hover:bg-slate-200/60 cursor-pointer disabled:cursor-not-allowed"
                          title="Move column left"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleMoveColumn(cIdx, 'RIGHT')}
                          disabled={cIdx === columns.length - 1}
                          className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-30 rounded hover:bg-slate-200/60 cursor-pointer disabled:cursor-not-allowed"
                          title="Move column right"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                        
                        {/* Visibility toggle */}
                        <button
                          onClick={() => handleToggleColumnVisibility(col.id)}
                          className={`p-1 rounded cursor-pointer ${
                            isActive ? 'text-emerald-700 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-200'
                          }`}
                          title={isActive ? 'Active on live site (click to hide)' : 'Hidden from live site (click to enable)'}
                        >
                          {isActive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        </button>

                        {/* Edit Column Settings */}
                        <button
                          onClick={() => {
                            setEditingColumn({ ...col });
                            setIsCreatingColumn(false);
                          }}
                          className="p-1 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-200/60 cursor-pointer"
                          title="Edit column settings"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Column Button */}
                        <button
                          onClick={() => setColumnToDelete(col)}
                          className="p-1 text-rose-500 hover:text-rose-700 rounded hover:bg-rose-50 cursor-pointer"
                          title="Delete column"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {col.description && (
                      <p className="text-[11px] text-slate-500 line-clamp-1 italic">
                        {col.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] font-mono text-slate-400">
                        {colLinks.length} {colLinks.length === 1 ? 'Link' : 'Links'} Configured
                      </span>
                      {!isActive && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-100/80 px-2 py-0.2 rounded-md">
                          INACTIVE (Hidden)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Links List in Column */}
                  <div className="p-4 space-y-2 flex-1 min-h-[160px] max-h-[340px] overflow-y-auto">
                    {colLinks.map((link, lIdx) => {
                      const isLinkActive = link.status !== 'INACTIVE';
                      
                      // Check broken link state
                      let isBroken = false;
                      let brokenReason = '';
                      if (link.type === 'CUSTOM_PAGE') {
                        const page = customPages.find(p => p.slug === link.targetId || p.id === link.targetId);
                        if (!page) {
                          isBroken = true;
                          brokenReason = 'Page deleted or missing';
                        } else if (!page.isPublished) {
                          isBroken = true;
                          brokenReason = 'Page is unpublished';
                        }
                      } else if (link.type === 'DESTINATION' && link.targetId !== 'all') {
                        const dest = destinations.find(d => d.slug === link.targetId || d.id === link.targetId);
                        if (!dest || dest.status === 'INACTIVE') {
                          isBroken = true;
                          brokenReason = 'Destination missing/inactive';
                        }
                      } else if ((link.type === 'EXTERNAL_LINK' || link.type === 'CUSTOM_LINK') && (!link.url || link.url === '#')) {
                        isBroken = true;
                        brokenReason = 'Empty destination URL';
                      }

                      return (
                        <div 
                          key={link.id || lIdx}
                          className={`p-2.5 rounded-2xl border transition-all flex flex-col space-y-1 text-xs group ${
                            isBroken
                              ? 'bg-amber-50/70 border-amber-200'
                              : isLinkActive
                              ? 'bg-slate-50 hover:bg-slate-100/80 border-slate-200/80'
                              : 'bg-slate-100/50 border-slate-200 opacity-60'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center space-x-1.5 truncate">
                              <span className="font-bold text-slate-800 truncate" title={link.label}>
                                {link.label}
                              </span>
                              {link.openIn === '_blank' && (
                                <ExternalLink className="w-2.5 h-2.5 text-slate-400 shrink-0" title="Opens in new tab" />
                              )}
                            </div>

                            {/* Reorder & Action buttons */}
                            <div className="flex items-center space-x-0.5 shrink-0 opacity-80 group-hover:opacity-100">
                              <button
                                onClick={() => handleMoveLink(col.id, lIdx, 'UP')}
                                disabled={lIdx === 0}
                                className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                                title="Move link up"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleMoveLink(col.id, lIdx, 'DOWN')}
                                disabled={lIdx === colLinks.length - 1}
                                className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                                title="Move link down"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleToggleLinkStatus(col.id, link.id)}
                                className={`p-1 cursor-pointer ${
                                  isLinkActive ? 'text-emerald-700' : 'text-slate-400'
                                }`}
                                title={isLinkActive ? 'Link active (click to disable)' : 'Link disabled (click to enable)'}
                              >
                                {isLinkActive ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                              </button>
                              <button
                                onClick={() => handleOpenEditLink(col.id, link)}
                                className="p-1 text-slate-500 hover:text-slate-900 cursor-pointer"
                                title="Edit link"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleDeleteLink(col.id, link.id, link.label)}
                                className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                                title="Delete link from footer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          {/* Link Meta Row */}
                          <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                            <span className="truncate max-w-[170px]" title={link.targetId || link.url}>
                              {link.type === 'CUSTOM_PAGE' ? `📄 page:${link.targetId}` : link.type === 'DESTINATION' ? `🌍 dest:${link.targetId}` : link.type === 'SYSTEM_VIEW' ? `⚙️ view:${link.targetId}` : `🔗 ${link.url}`}
                            </span>
                            <span className="px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 uppercase font-bold text-[9px]">
                              {link.type === 'CUSTOM_PAGE' ? 'CMS' : link.type === 'DESTINATION' ? 'DEST' : link.type === 'SYSTEM_VIEW' ? 'SYS' : 'EXT'}
                            </span>
                          </div>

                          {isBroken && (
                            <div className="text-[10px] font-bold text-amber-700 flex items-center space-x-1 pt-0.5">
                              <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                              <span className="truncate">{brokenReason}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {colLinks.length === 0 && (
                      <div className="text-center py-8 text-slate-400 text-xs italic flex flex-col items-center justify-center space-y-1">
                        <LinkIcon className="w-5 h-5 text-slate-300" />
                        <span>No links in this column</span>
                        <span className="text-[10px] text-slate-400">Click below to attach CMS pages or URLs</span>
                      </div>
                    )}
                  </div>

                  {/* Card Bottom: Add Link Button */}
                  <div className="p-3 bg-slate-50/70 border-t border-slate-100">
                    <button
                      onClick={() => handleOpenAddLink(col.id)}
                      className="w-full py-2 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-900 border border-dashed border-slate-300 hover:border-emerald-300 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center space-x-1.5 shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5 text-emerald-700" />
                      <span>+ Add Link</span>
                    </button>
                  </div>
                </div>
              );
            })}

          {/* Empty State / Add First Column */}
          {columns.length === 0 && (
            <div className="col-span-full bg-white rounded-3xl p-12 text-center border border-dashed border-slate-300 space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
                <Columns className="w-6 h-6" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h4 className="text-base font-extrabold text-slate-900">No Footer Columns Configured</h4>
                <p className="text-xs text-slate-500">
                  Create your first dynamic footer column to organize destinations, legal pages, travel resources, and support links.
                </p>
              </div>
              <button
                onClick={handleOpenAddColumn}
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-2xl text-xs font-bold bg-[#008972] text-white hover:bg-[#007360] shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add First Footer Column</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: ADD / EDIT COLUMN MODAL */}
      {/* ========================================================= */}
      {editingColumn && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Columns className="w-4 h-4 text-[#00C6A6]" />
                <h3 className="text-sm font-extrabold text-slate-900">
                  {isCreatingColumn ? 'Add Footer Column' : 'Edit Footer Column Settings'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setEditingColumn(null);
                  setIsCreatingColumn(false);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Column Name / Header *
                </label>
                <input
                  type="text"
                  required
                  value={editingColumn.title}
                  onChange={e => setEditingColumn({ ...editingColumn, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 font-bold"
                  placeholder="e.g. Company, Destinations, Legal, Support"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Column Unique ID
                </label>
                <input
                  type="text"
                  value={editingColumn.id}
                  onChange={e => setEditingColumn({ ...editingColumn, id: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '') })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-mono text-slate-700"
                  placeholder="col-unique-id"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">Used for internal database reference</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Optional Description / Subtitle
                </label>
                <input
                  type="text"
                  value={editingColumn.description || ''}
                  onChange={e => setEditingColumn({ ...editingColumn, description: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-800"
                  placeholder="e.g. Core regional gateways and hubs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editingColumn.displayOrder || 1}
                    onChange={e => setEditingColumn({ ...editingColumn, displayOrder: parseInt(e.target.value) || 1 })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Status / Visibility
                  </label>
                  <select
                    value={editingColumn.isVisible !== false && editingColumn.status !== 'INACTIVE' ? 'ACTIVE' : 'INACTIVE'}
                    onChange={e => {
                      const isAct = e.target.value === 'ACTIVE';
                      setEditingColumn({
                        ...editingColumn,
                        isVisible: isAct,
                        status: isAct ? 'ACTIVE' : 'INACTIVE'
                      });
                    }}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                  >
                    <option value="ACTIVE">ACTIVE (Visible on Live Footer)</option>
                    <option value="INACTIVE">INACTIVE (Hidden)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100">
              <button
                onClick={() => {
                  setEditingColumn(null);
                  setIsCreatingColumn(false);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveColumn}
                className="px-5 py-2 text-xs font-bold bg-[#008972] hover:bg-[#007360] text-white rounded-xl cursor-pointer shadow-xs"
              >
                {isCreatingColumn ? 'Add Column' : 'Save Column'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: SAFE DELETE COLUMN CONFIRMATION */}
      {/* ========================================================= */}
      {columnToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-base font-extrabold text-slate-900">
                Delete Footer Column?
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                This will remove the column <strong className="text-slate-900">"{columnToDelete.title}"</strong> and all <strong className="text-slate-900">{columnToDelete.links?.length || 0} navigation links</strong> inside it from the website footer.
              </p>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-500 font-medium">
                🛡️ <strong>Safety Guarantee:</strong> The underlying CMS pages, destinations, and system views will NOT be deleted.
              </div>
            </div>

            <div className="flex items-center justify-center space-x-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setColumnToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteColumn}
                className="px-5 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl cursor-pointer shadow-xs"
              >
                Delete Column
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: ADD / EDIT NAVIGATION ITEM WITH PAGE SELECTOR */}
      {/* ========================================================= */}
      {targetColumnIdForLink && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 space-y-5 shadow-2xl border border-slate-200 my-8 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <LinkIcon className="w-4 h-4 text-[#00C6A6]" />
                <h3 className="text-sm font-extrabold text-slate-900">
                  {isCreatingLink ? 'Add Navigation Link' : 'Edit Navigation Link'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setTargetColumnIdForLink(null);
                  setEditingLink(null);
                  setIsCreatingLink(false);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Link Type Selector Tabs */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Select Link Type
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'CMS_PAGE', label: 'CMS Page', icon: FileText },
                  { id: 'DESTINATION', label: 'Destination', icon: Compass },
                  { id: 'SYSTEM_VIEW', label: 'System Tool', icon: LayoutGrid },
                  { id: 'EXTERNAL_LINK', label: 'Custom / URL', icon: Globe }
                ].map(tab => {
                  const Icon = tab.icon;
                  const isSel = linkType === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setLinkType(tab.id as any)}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border text-xs font-bold transition-all cursor-pointer space-y-1 ${
                        isSel
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isSel ? 'text-[#00E5C0]' : 'text-slate-400'}`} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* SEARCHABLE PRE-POPULATED PAGE SELECTOR */}
            {linkType !== 'EXTERNAL_LINK' && (
              <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                    {linkType === 'CMS_PAGE' && 'Connect Existing CMS Page'}
                    {linkType === 'DESTINATION' && 'Select Connected Destination'}
                    {linkType === 'SYSTEM_VIEW' && 'Select Core System View / Tool'}
                  </label>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Auto-fills internal routes
                  </span>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={selectorSearch}
                    onChange={e => setSelectorSearch(e.target.value)}
                    placeholder={`Search ${linkType === 'CMS_PAGE' ? 'pages (e.g. Privacy, About)...' : linkType === 'DESTINATION' ? 'destinations (e.g. Japan, UK)...' : 'tools...'}`}
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-500 placeholder:text-slate-400"
                  />
                </div>

                {/* Search Results List */}
                <div className="max-h-40 overflow-y-auto space-y-1 pt-1 divide-y divide-slate-100">
                  {linkType === 'CMS_PAGE' && (
                    <>
                      {filteredCustomPages.map(page => (
                        <button
                          key={page.id}
                          type="button"
                          onClick={() => handleSelectPredefinedTarget('CMS_PAGE', page)}
                          className={`w-full text-left p-2 rounded-xl transition-all cursor-pointer flex items-center justify-between text-xs hover:bg-emerald-50 ${
                            linkTargetId === page.slug ? 'bg-emerald-50 text-emerald-900 font-bold border border-emerald-300' : 'text-slate-700'
                          }`}
                        >
                          <div className="truncate">
                            <span className="font-semibold block truncate">{page.title}</span>
                            <span className="text-[10px] text-slate-400 font-mono">slug: {page.slug}</span>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            page.isPublished ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {page.isPublished ? 'Published' : 'Draft'}
                          </span>
                        </button>
                      ))}
                      {filteredCustomPages.length === 0 && (
                        <div className="text-center py-4 text-slate-400 text-xs italic">
                          No matching CMS pages found.
                        </div>
                      )}
                    </>
                  )}

                  {linkType === 'DESTINATION' && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleSelectPredefinedTarget('DESTINATION', { name: 'All Destinations Portfolio', slug: 'all' })}
                        className={`w-full text-left p-2 rounded-xl transition-all cursor-pointer flex items-center justify-between text-xs hover:bg-emerald-50 ${
                          linkTargetId === 'all' ? 'bg-emerald-50 text-emerald-900 font-bold border border-emerald-300' : 'text-slate-700'
                        }`}
                      >
                        <div>
                          <span className="font-semibold block">All Destinations Portfolio (Global)</span>
                          <span className="text-[10px] text-slate-400 font-mono">slug: all</span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-700">
                          Gateway
                        </span>
                      </button>

                      {filteredDestinations.map(dest => (
                        <button
                          key={dest.id}
                          type="button"
                          onClick={() => handleSelectPredefinedTarget('DESTINATION', dest)}
                          className={`w-full text-left p-2 rounded-xl transition-all cursor-pointer flex items-center justify-between text-xs hover:bg-emerald-50 ${
                            linkTargetId === dest.slug ? 'bg-emerald-50 text-emerald-900 font-bold border border-emerald-300' : 'text-slate-700'
                          }`}
                        >
                          <div>
                            <span className="font-semibold block">{dest.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">slug: {dest.slug}</span>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800">
                            Active
                          </span>
                        </button>
                      ))}
                    </>
                  )}

                  {linkType === 'SYSTEM_VIEW' && (
                    <>
                      {filteredSystemViews.map(sys => (
                        <button
                          key={sys.id}
                          type="button"
                          onClick={() => handleSelectPredefinedTarget('SYSTEM_VIEW', sys)}
                          className={`w-full text-left p-2 rounded-xl transition-all cursor-pointer flex items-center justify-between text-xs hover:bg-emerald-50 ${
                            linkTargetId === sys.targetId ? 'bg-emerald-50 text-emerald-900 font-bold border border-emerald-300' : 'text-slate-700'
                          }`}
                        >
                          <div>
                            <span className="font-semibold block">{sys.label}</span>
                            <span className="text-[10px] text-slate-400">{sys.description}</span>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-700">
                            {sys.category}
                          </span>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* LINK PARAMETERS FORM */}
            <div className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Link Display Name / Label *
                </label>
                <input
                  type="text"
                  required
                  value={linkLabel}
                  onChange={e => setLinkLabel(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 font-bold"
                  placeholder="e.g. Privacy Policy, Japan Exclusives, WhatsApp Hotline"
                />
              </div>

              {linkType === 'EXTERNAL_LINK' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Destination URL / Protocol *
                  </label>
                  <input
                    type="text"
                    required
                    value={linkUrl}
                    onChange={e => setLinkUrl(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-mono text-slate-800"
                    placeholder="https://example.com or mailto:concierge@theunbound.in or tel:+91..."
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Supports https://, mailto: and tel: protocols.
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Open In Window
                  </label>
                  <select
                    value={linkOpenIn}
                    onChange={e => setLinkOpenIn(e.target.value as any)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                  >
                    <option value="_self">Same Tab (_self)</option>
                    <option value="_blank">New Tab (_blank)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Link Status
                  </label>
                  <select
                    value={linkStatus}
                    onChange={e => setLinkStatus(e.target.value as any)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                  >
                    <option value="ACTIVE">ACTIVE (Displayed in footer)</option>
                    <option value="INACTIVE">INACTIVE (Hidden)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <div>
                {!isCreatingLink && editingLink && targetColumnIdForLink && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Remove link "${editingLink.label}" from this column?`)) {
                        handleDeleteLink(targetColumnIdForLink, editingLink.id, editingLink.label);
                        setTargetColumnIdForLink(null);
                        setEditingLink(null);
                        setIsCreatingLink(false);
                      }
                    }}
                    className="px-3.5 py-2 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl cursor-pointer flex items-center space-x-1.5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Link</span>
                  </button>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    setTargetColumnIdForLink(null);
                    setEditingLink(null);
                    setIsCreatingLink(false);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveLink}
                  className="px-5 py-2 text-xs font-bold bg-[#008972] hover:bg-[#007360] text-white rounded-xl cursor-pointer shadow-xs"
                >
                  {isCreatingLink ? 'Add Link to Column' : 'Save Link Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
