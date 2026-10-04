import React, { useState, useEffect, useMemo } from 'react';
import { AppDatabase } from '../../services/db';
import { 
  User,
  MenuItemConfig, 
  CustomPage, 
  Destination, 
  FooterConfig, 
  FooterMenuColumn, 
  CustomPageBlock, 
  CustomPageLayout, 
  MenuLocation 
} from '../../types';
import { useAuth } from '../../context/AuthContext';
import { FooterNavigationBuilder } from './FooterNavigationBuilder';
import { EntitySEOSettingsTab } from './EntitySEOSettingsTab';
import { 
  Menu, 
  Layers, 
  Plus, 
  Trash2, 
  Edit3, 
  Save, 
  Check, 
  ArrowUp, 
  ArrowDown, 
  Eye, 
  EyeOff, 
  Link as LinkIcon, 
  FileText, 
  ExternalLink,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  FolderTree,
  Columns,
  Layout,
  Globe,
  Tag,
  HelpCircle,
  ChevronDown,
  Compass,
  Calendar,
  Search,
  ShieldCheck,
  X
} from 'lucide-react';

interface MenuAndPagesManagerProps {
  defaultTab?: 'MENU' | 'CUSTOM_PAGES' | 'FOOTER';
  currentUser?: User | null;
}

export const MenuAndPagesManager: React.FC<MenuAndPagesManagerProps> = ({ defaultTab = 'MENU', currentUser }) => {
  const db = AppDatabase.getInstance();
  const { user: authUser } = useAuth();
  const activeUser = currentUser || authUser || db.getCurrentUser();

  const [menuItems, setMenuItems] = useState<MenuItemConfig[]>([]);
  const [customPages, setCustomPages] = useState<CustomPage[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [footerConfig, setFooterConfig] = useState<FooterConfig>(() => db.getFooterConfig());
  const [activeTab, setActiveTab] = useState<'MENU' | 'CUSTOM_PAGES' | 'FOOTER'>(defaultTab);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [menuLocationFilter, setMenuLocationFilter] = useState<'ALL' | MenuLocation>('ALL');

  // Editing state for Menu Item
  const [editingMenuItem, setEditingMenuItem] = useState<MenuItemConfig | null>(null);
  const [isCreatingMenuItem, setIsCreatingMenuItem] = useState(false);
  const [menuItemError, setMenuItemError] = useState<string | null>(null);

  // Deletion confirmation modals (bypasses window.confirm in iframe)
  const [deletingMenuItem, setDeletingMenuItem] = useState<MenuItemConfig | null>(null);
  const [deletingPage, setDeletingPage] = useState<CustomPage | null>(null);

  // Editing state for Custom Page
  const [editingPage, setEditingPage] = useState<CustomPage | null>(null);
  const [isCreatingPage, setIsCreatingPage] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [pagePreviewTab, setPagePreviewTab] = useState<'EDIT' | 'PREVIEW'>('EDIT');
  const [pageEditorSubTab, setPageEditorSubTab] = useState<'CONTENT' | 'SEO'>('CONTENT');

  // Block Builder modal state inside Page Editor
  const [isAddingBlock, setIsAddingBlock] = useState(false);
  const [newBlockType, setNewBlockType] = useState<CustomPageBlock['type']>('FEATURE_GRID');

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = () => {
    setMenuItems(db.getMenuItems());
    setCustomPages(db.getCustomPages());
    setDestinations(db.getDestinations());
    setFooterConfig(db.getFooterConfig());
  };

  useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab]);

  useEffect(() => {
    loadData();
    const unsubscribe = db.subscribe(() => {
      loadData();
    });
    return unsubscribe;
  }, []);

  const isSystemPage = (pageId: string, slug?: string) => {
    return pageId === 'page-about-theunbound' || slug === 'about-theunbound';
  };

  // Filtered menu items
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter(item => {
      const locMatch = menuLocationFilter === 'ALL' || (item.menuLocation || 'HEADER') === menuLocationFilter;
      const q = (searchQuery || '').toLowerCase();
      const qMatch = !searchQuery.trim() || 
        (item.label || '').toLowerCase().includes(q) || 
        (item.targetId && item.targetId.toLowerCase().includes(q)) ||
        (item.customUrl && item.customUrl.toLowerCase().includes(q));
      return locMatch && qMatch;
    });
  }, [menuItems, menuLocationFilter, searchQuery]);

  // Menu item actions
  const handleSaveMenuItem = (item: MenuItemConfig) => {
    if (!item.label.trim()) {
      setMenuItemError('Navigation link label is required.');
      return;
    }
    setMenuItemError(null);
    db.saveMenuItem(item, activeUser);
    loadData();
    setEditingMenuItem(null);
    setIsCreatingMenuItem(false);
    showToast(`Saved navigation item "${item.label}"`);
  };

  const executeDeleteMenuItem = (id: string, label: string) => {
    const result = db.deleteMenuItem(id, activeUser);
    if (result && !result.success) {
      showToast(result.error || 'Failed to delete menu link. Permission denied.');
      setDeletingMenuItem(null);
      return;
    }
    loadData();
    if (editingMenuItem?.id === id) {
      setEditingMenuItem(null);
      setIsCreatingMenuItem(false);
    }
    setDeletingMenuItem(null);
    showToast(`Removed navigation link "${label}"`);
  };

  const handleMoveMenuItem = (index: number, direction: 'UP' | 'DOWN') => {
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= menuItems.length) return;

    const newItems = [...menuItems];
    const temp = newItems[index];
    newItems[index] = newItems[targetIndex];
    newItems[targetIndex] = temp;

    // Re-assign display order
    const ordered = newItems.map((item, idx) => ({
      ...item,
      displayOrder: idx + 1
    }));

    setMenuItems(ordered);
    db.updateMenuOrdering(ordered, activeUser);
    loadData();
    showToast('Updated menu order');
  };

  const handleToggleVisibility = (item: MenuItemConfig) => {
    const updated = { ...item, isVisible: !item.isVisible };
    db.saveMenuItem(updated, activeUser);
    loadData();
    showToast(`${updated.isVisible ? 'Enabled' : 'Hidden'} "${item.label}"`);
  };

  // Custom Page actions
  const handleSavePage = (page: CustomPage) => {
    if (!page.title.trim()) {
      setPageError('Page title is required.');
      return;
    }
    setPageError(null);
    const slug = (page.slug || page.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')).trim();
    const updatedPage: CustomPage = {
      ...page,
      slug: slug || `page-${Date.now()}`
    };

    db.saveCustomPage(updatedPage, activeUser);
    loadData();
    setEditingPage(null);
    setIsCreatingPage(false);
    showToast(`Saved page "${updatedPage.title}" with live navigation sync`);
  };

  const executeDeletePage = (id: string, title: string) => {
    const result = db.deleteCustomPage(id, activeUser);
    if (result && !result.success) {
      showToast(result.error || 'Failed to delete custom page. Permission denied.');
      setDeletingPage(null);
      return;
    }
    loadData();
    if (editingPage?.id === id) {
      setEditingPage(null);
      setIsCreatingPage(false);
    }
    setDeletingPage(null);
    showToast(`Deleted page "${title}" and synced navigation`);
  };

  // Helper to add block to editing page
  const handleAddBlockToPage = () => {
    if (!editingPage) return;
    const blockId = `block-${Date.now()}`;
    let newBlock: CustomPageBlock = {
      id: blockId,
      type: newBlockType,
      title: newBlockType === 'FEATURE_GRID' ? 'Key Inclusions & Highlights' : newBlockType === 'CTA' ? 'Direct Ground Operations Support' : newBlockType === 'FAQ' ? 'Frequently Asked Questions' : 'Featured Gallery'
    };

    if (newBlockType === 'FEATURE_GRID') {
      newBlock.data = {
        items: [
          { title: 'VIP Ground Logistics', description: 'Direct chauffeur service with premium executive fleet.' },
          { title: 'Licensed Guides', description: 'Certified local specialists for heritage access.' },
          { title: 'Contracted Wholesale Tariffs', description: 'Zero intermediary markups on ground inventory.' }
        ]
      };
    } else if (newBlockType === 'CTA') {
      newBlock.content = 'Contact our destination operations desk for customized multi-city bookings and wholesale agency rates.';
    } else if (newBlockType === 'FAQ') {
      newBlock.data = {
        faqs: [
          { q: 'What is the standard SLA for itinerary confirmation?', a: 'Ground confirmations are issued within 24 to 48 hours.' },
          { q: 'Can we request customized dietary or vehicle requirements?', a: 'Yes, full bespoke requests are handled by our dedicated logistics dispatch.' }
        ]
      };
    } else if (newBlockType === 'IMAGE_GALLERY') {
      newBlock.data = {
        images: [
          'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=600&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?q=80&w=600&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=600&auto=format&fit=crop'
        ]
      };
    }

    const currentBlocks = editingPage.blocks || [];
    setEditingPage({
      ...editingPage,
      blocks: [...currentBlocks, newBlock]
    });
    setIsAddingBlock(false);
  };

  const handleRemoveBlock = (blockId: string) => {
    if (!editingPage || !editingPage.blocks) return;
    setEditingPage({
      ...editingPage,
      blocks: editingPage.blocks.filter(b => b.id !== blockId)
    });
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white border border-[#00C6A6] px-4 py-3 rounded-xl shadow-xl flex items-center space-x-2 text-xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-[#00C6A6]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header with Sub-tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-6 rounded-2xl text-white">
        <div>
          <h2 className="text-xl font-bold flex items-center space-x-2">
            <Menu className="w-5 h-5 text-[#00C6A6]" />
            <span>Navigation Menu & Custom Pages CMS</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Authoritative menu management for Header, Secondary & Footer menus, plus dynamic custom page builder with real-time sync.
          </p>
        </div>

        <div className="flex items-center space-x-2 bg-slate-800 p-1 rounded-xl border border-slate-700">
          <button
            id="tab-sub-menu-arranger"
            onClick={() => setActiveTab('MENU')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'MENU'
                ? 'bg-[#00C6A6] text-slate-950 shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Menu Management ({menuItems.length})
          </button>
          <button
            id="tab-sub-custom-pages"
            onClick={() => setActiveTab('CUSTOM_PAGES')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'CUSTOM_PAGES'
                ? 'bg-[#00C6A6] text-slate-950 shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Custom Page Builder ({customPages.length})
          </button>
          <button
            id="tab-sub-footer-menus"
            onClick={() => setActiveTab('FOOTER')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'FOOTER'
                ? 'bg-[#00C6A6] text-slate-950 shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Footer Navigation Builder
          </button>
        </div>
      </div>

      {/* TAB 1: MENU MANAGEMENT */}
      {activeTab === 'MENU' && (
        <div className="space-y-4">
          {/* Controls & Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Authoritative Website Navigation</h3>
              <p className="text-xs text-slate-500">
                Manage Header links, sub-menu dropdowns, secondary quick links, and pill badges without code changes.
              </p>
            </div>

            <div className="flex items-center space-x-2 flex-wrap">
              {/* Location Filter Pills */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                {(['ALL', 'HEADER', 'SECONDARY', 'FOOTER'] as const).map(loc => (
                  <button
                    key={loc}
                    onClick={() => setMenuLocationFilter(loc)}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                      menuLocationFilter === loc ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {loc === 'ALL' ? 'All Links' : loc === 'HEADER' ? 'Header' : loc === 'SECONDARY' ? 'Secondary' : 'Footer'}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Filter links..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="px-3 py-1.5 pl-8 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-[#00C6A6] w-32 sm:w-44"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              </div>

              <button
                id="add-menu-item-btn"
                onClick={() => {
                  setMenuItemError(null);
                  setEditingMenuItem({
                    id: `menu-${Date.now()}`,
                    label: 'New Link',
                    type: 'CUSTOM_PAGE',
                    targetId: customPages[0]?.slug || '',
                    menuLocation: menuLocationFilter !== 'ALL' ? menuLocationFilter : 'HEADER',
                    displayOrder: menuItems.length + 1,
                    isVisible: true,
                    openIn: '_self'
                  });
                  setIsCreatingMenuItem(true);
                }}
                className="inline-flex items-center space-x-1.5 px-3 py-2 bg-[#00C6A6] hover:bg-[#00b296] text-slate-950 font-bold text-xs rounded-xl transition-colors cursor-pointer shrink-0 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Menu Link</span>
              </button>
            </div>
          </div>

          {/* Menu Items List */}
          <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden shadow-xs">
            {filteredMenuItems.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs space-y-2">
                <LinkIcon className="w-6 h-6 mx-auto text-slate-300" />
                <p>No menu items match the current filter.</p>
              </div>
            ) : (
              filteredMenuItems.map((item, index) => {
                const parentItem = item.parentId ? menuItems.find(m => m.id === item.parentId) : null;
                const childCount = menuItems.filter(m => m.parentId === item.id).length;

                return (
                  <div 
                    key={item.id}
                    id={`menu-item-row-${item.id}`}
                    className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors ${
                      parentItem ? 'pl-8 bg-slate-50/50' : ''
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      {/* Order Index */}
                      <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                        {index + 1}
                      </span>

                      <div>
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                          {parentItem && (
                            <span className="text-xs font-mono text-slate-400 flex items-center">
                              ↳ <span className="text-[10px] ml-1 px-1.5 py-0.2 bg-slate-100 rounded text-slate-500">{parentItem.label}</span>
                            </span>
                          )}
                          <span className="font-bold text-sm text-slate-900">{item.label}</span>
                          
                          {/* Badge tag if any */}
                          {item.badgeText && (
                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full bg-[#00C6A6]/20 text-[#00a88d] border border-[#00C6A6]/30">
                              {item.badgeText}
                            </span>
                          )}

                          {/* Location Pill */}
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            (item.menuLocation || 'HEADER') === 'HEADER'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : (item.menuLocation || 'HEADER') === 'SECONDARY'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}>
                            {item.menuLocation || 'HEADER'}
                          </span>

                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                            {item.type}
                          </span>

                          {childCount > 0 && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                              {childCount} sub-links
                            </span>
                          )}

                          {!item.isVisible && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                              Hidden
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                          <span>Target: {item.targetId || item.customUrl || 'Home / Main View'}</span>
                          {item.openIn === '_blank' && (
                            <span className="text-[10px] text-slate-500 font-medium flex items-center gap-0.5">
                              <ExternalLink className="w-3 h-3" /> New Tab
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Actions & Reordering Controls */}
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      <button
                        id={`btn-move-up-${item.id}`}
                        onClick={() => handleMoveMenuItem(index, 'UP')}
                        disabled={index === 0}
                        title="Move Up"
                        className="p-1.5 text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        id={`btn-move-down-${item.id}`}
                        onClick={() => handleMoveMenuItem(index, 'DOWN')}
                        disabled={index === filteredMenuItems.length - 1}
                        title="Move Down"
                        className="p-1.5 text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        id={`btn-toggle-visible-${item.id}`}
                        onClick={() => handleToggleVisibility(item)}
                        title={item.isVisible ? 'Hide from navigation' : 'Show in navigation'}
                        className={`p-1.5 rounded-lg cursor-pointer ${
                          item.isVisible ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100' : 'text-slate-400 bg-slate-100 hover:bg-slate-200'
                        }`}
                      >
                        {item.isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        id={`edit-menu-item-${item.id}`}
                        onClick={() => {
                          setMenuItemError(null);
                          setEditingMenuItem({ ...item });
                          setIsCreatingMenuItem(false);
                        }}
                        title="Edit Item"
                        className="p-1.5 text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        id={`delete-menu-item-${item.id}`}
                        onClick={() => setDeletingMenuItem(item)}
                        title="Remove Item"
                        className="p-1.5 text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Edit / Create Modal for Menu Item */}
          {editingMenuItem && (
            <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-slate-200 animate-in zoom-in-95">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="font-bold text-base text-slate-900">
                    {isCreatingMenuItem ? 'Add Navigation Link' : `Edit Navigation Link: ${editingMenuItem.label}`}
                  </h3>
                  <button 
                    onClick={() => {
                      setEditingMenuItem(null);
                      setIsCreatingMenuItem(false);
                    }}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {menuItemError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{menuItemError}</span>
                  </div>
                )}

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Navigation Display Label</label>
                    <input
                      id="input-menu-label"
                      type="text"
                      value={editingMenuItem.label}
                      onChange={(e) => setEditingMenuItem({ ...editingMenuItem, label: e.target.value })}
                      placeholder="e.g. Experiences, Sakura Guide"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00C6A6] outline-none font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Menu Location</label>
                      <select
                        id="select-menu-location"
                        value={editingMenuItem.menuLocation || 'HEADER'}
                        onChange={(e) => setEditingMenuItem({ ...editingMenuItem, menuLocation: e.target.value as MenuLocation })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00C6A6] outline-none cursor-pointer"
                      >
                        <option value="HEADER">Header Primary Menu</option>
                        <option value="SECONDARY">Secondary Top Utility Menu</option>
                        <option value="FOOTER">Footer Menu Link</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Badge Pill (Optional)</label>
                      <input
                        id="input-menu-badge"
                        type="text"
                        value={editingMenuItem.badgeText || ''}
                        onChange={(e) => setEditingMenuItem({ ...editingMenuItem, badgeText: e.target.value })}
                        placeholder="e.g. New, Hot, B2B"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00C6A6] outline-none"
                      >
                      </input>
                    </div>
                  </div>

                  {/* Parent Menu Item for Sub-menus / Dropdowns */}
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Parent Menu Item (For Dropdowns)</label>
                    <select
                      id="select-menu-parent"
                      value={editingMenuItem.parentId || ''}
                      onChange={(e) => setEditingMenuItem({ ...editingMenuItem, parentId: e.target.value || undefined })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00C6A6] outline-none cursor-pointer"
                    >
                      <option value="">-- None (Top Level Navigation Item) --</option>
                      {menuItems
                        .filter(m => m.id !== editingMenuItem.id && (!m.parentId))
                        .map(m => (
                          <option key={m.id} value={m.id}>
                            {m.label} ({m.menuLocation || 'HEADER'})
                          </option>
                        ))}
                    </select>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Assigning a parent item converts it into a dropdown sub-item under that heading.
                    </p>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Link Target Type</label>
                    <select
                      id="select-menu-type"
                      value={editingMenuItem.type}
                      onChange={(e) => {
                        const newType = e.target.value as any;
                        let defTarget = '';
                        if (newType === 'SYSTEM_VIEW') defTarget = 'destinations';
                        if (newType === 'DESTINATION') defTarget = destinations[0]?.slug || 'all';
                        if (newType === 'CUSTOM_PAGE') defTarget = customPages[0]?.slug || '';
                        setEditingMenuItem({ ...editingMenuItem, type: newType, targetId: defTarget });
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00C6A6] outline-none cursor-pointer"
                    >
                      <option value="CUSTOM_PAGE">CMS Custom Page</option>
                      <option value="DESTINATION">Destination Portfolio Page</option>
                      <option value="SYSTEM_VIEW">System Screen (Destinations, About, B2B, Contact, Blogs)</option>
                      <option value="CUSTOM_LINK">Custom Link or Section Anchor</option>
                      <option value="EXTERNAL_LINK">External Website Link</option>
                    </select>
                  </div>

                  {editingMenuItem.type === 'CUSTOM_PAGE' && (
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Choose CMS Page</label>
                      <select
                        id="select-menu-target-page"
                        value={editingMenuItem.targetId || ''}
                        onChange={(e) => {
                          const slug = e.target.value;
                          const pg = customPages.find(p => p.slug === slug);
                          setEditingMenuItem({
                            ...editingMenuItem,
                            targetId: slug,
                            label: editingMenuItem.label === 'New Link' || !editingMenuItem.label ? (pg ? (pg.menuLabel || pg.title) : slug) : editingMenuItem.label
                          });
                        }}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00C6A6] outline-none cursor-pointer"
                      >
                        <option value="">-- Choose Page --</option>
                        {customPages.map(p => (
                          <option key={p.id} value={p.slug}>
                            {p.title} (/{p.slug})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {editingMenuItem.type === 'DESTINATION' && (
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Choose Destination Page</label>
                      <select
                        id="select-menu-target-dest"
                        value={editingMenuItem.targetId || (destinations[0]?.slug || 'all')}
                        onChange={(e) => {
                          const selectedSlug = e.target.value;
                          const dest = destinations.find(d => d.slug === selectedSlug);
                          setEditingMenuItem({
                            ...editingMenuItem,
                            targetId: selectedSlug,
                            label: editingMenuItem.label === 'New Link' || !editingMenuItem.label ? (dest ? dest.name : selectedSlug) : editingMenuItem.label
                          });
                        }}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00C6A6] outline-none cursor-pointer"
                      >
                        <option value="all">All Destinations (Global Portfolio Overview)</option>
                        {destinations.map(d => (
                          <option key={d.id} value={d.slug}>
                            {d.name} ({d.country}) — {d.cities?.length || 0} Hubs
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {editingMenuItem.type === 'SYSTEM_VIEW' && (
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Target Screen View</label>
                      <select
                        id="select-menu-target-system"
                        value={editingMenuItem.targetId || 'destinations'}
                        onChange={(e) => setEditingMenuItem({ ...editingMenuItem, targetId: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00C6A6] outline-none cursor-pointer"
                      >
                        <option value="destinations">Destinations Hub</option>
                        <option value="home">Home / All Destinations</option>
                        <option value="about">About TheUnbound DMC</option>
                        <option value="b2b">B2B Agent Portal</option>
                        <option value="contact">Contact Ground Operations</option>
                        <option value="blogs">Market Briefings & Blogs</option>
                        <option value="visas">Visa Desk</option>
                      </select>
                    </div>
                  )}

                  {(editingMenuItem.type === 'CUSTOM_LINK' || editingMenuItem.type === 'EXTERNAL_LINK') && (
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Target URL</label>
                      <input
                        id="input-menu-custom-url"
                        type="text"
                        value={editingMenuItem.customUrl || ''}
                        onChange={(e) => setEditingMenuItem({ ...editingMenuItem, customUrl: e.target.value })}
                        placeholder="https://... or /section"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00C6A6] outline-none"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Open Behavior</label>
                      <select
                        id="select-menu-open-in"
                        value={editingMenuItem.openIn || '_self'}
                        onChange={(e) => setEditingMenuItem({ ...editingMenuItem, openIn: e.target.value as '_self' | '_blank' })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00C6A6] outline-none cursor-pointer"
                      >
                        <option value="_self">Same Window / Tab</option>
                        <option value="_blank">New Tab / Window (_blank)</option>
                      </select>
                    </div>

                    <div className="flex items-center space-x-2 pt-5">
                      <input
                        type="checkbox"
                        id="edit-menu-visible"
                        checked={editingMenuItem.isVisible}
                        onChange={(e) => setEditingMenuItem({ ...editingMenuItem, isVisible: e.target.checked })}
                        className="w-4 h-4 text-[#00C6A6] rounded cursor-pointer"
                      />
                      <label htmlFor="edit-menu-visible" className="font-semibold text-slate-700 cursor-pointer">
                        Link Visible
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <div>
                    {!isCreatingMenuItem && editingMenuItem && (
                      <button
                        type="button"
                        id="btn-delete-menu-modal"
                        onClick={() => {
                          const itemToDelete = editingMenuItem;
                          setEditingMenuItem(null);
                          setDeletingMenuItem(itemToDelete);
                        }}
                        className="px-3.5 py-2 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl cursor-pointer flex items-center space-x-1.5 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      id="btn-cancel-menu-modal"
                      onClick={() => {
                        setEditingMenuItem(null);
                        setIsCreatingMenuItem(false);
                        setMenuItemError(null);
                      }}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      id="btn-save-menu-modal"
                      onClick={() => handleSaveMenuItem(editingMenuItem)}
                      className="px-5 py-2 text-xs font-bold bg-[#00C6A6] hover:bg-[#00b296] text-slate-950 rounded-xl cursor-pointer shadow-xs"
                    >
                      Save Link
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CUSTOM PAGES BUILDER */}
      {activeTab === 'CUSTOM_PAGES' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Custom Landing & Educational Pages Builder</h3>
              <p className="text-xs text-slate-500">
                Design custom pages with modular blocks, automated SEO tags, and synchronized menu/footer integration.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Filter pages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="px-3 py-1.5 pl-8 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-[#00C6A6] w-36 sm:w-48"
                />
                <FileText className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              </div>

              <button
                id="add-custom-page-btn"
                onClick={() => {
                  setPageError(null);
                  setPagePreviewTab('EDIT');
                  setEditingPage({
                    id: `page-${Date.now()}`,
                    slug: 'new-custom-page',
                    title: 'New Custom Page',
                    subtitle: 'Explore bespoke itinerary details and luxury logistics.',
                    layoutTemplate: 'STANDARD',
                    content: '## Executive Overview\n\nAdd your detailed rich-text itinerary and DMC capability specifications here.\n\n### Inclusions & Guarantees\n- VIP Airport Meet & Greet\n- Direct Ground Operations Coordinator\n- Transparent Wholesale B2B Tariffs',
                    heroImage: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200&auto=format&fit=crop',
                    isPublished: true,
                    showInMenu: true,
                    menuLocation: 'HEADER',
                    menuLabel: 'New Page',
                    showInFooter: true,
                    footerColumnId: footerConfig.columns[0]?.id || 'col-destinations',
                    menuOrder: customPages.length + 1,
                    metaTitle: '',
                    metaDescription: '',
                    blocks: [],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                  });
                  setIsCreatingPage(true);
                }}
                className="inline-flex items-center space-x-1.5 px-3 py-2 bg-[#00C6A6] hover:bg-[#00b296] text-slate-950 font-bold text-xs rounded-xl transition-colors cursor-pointer shrink-0 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Custom Page</span>
              </button>
            </div>
          </div>

          {/* Custom Pages Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {customPages
              .filter(p => !searchQuery.trim() || p.title.toLowerCase().includes(searchQuery.toLowerCase()) || p.slug.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((page) => {
              const isSys = isSystemPage(page.id, page.slug);
              return (
                <div 
                  key={page.id}
                  id={`custom-page-card-${page.id}`}
                  className={`bg-white rounded-2xl border ${isSys ? 'border-sky-200' : 'border-slate-200'} overflow-hidden shadow-xs flex flex-col justify-between`}
                >
                  {page.heroImage && (
                    <div className="h-36 w-full overflow-hidden relative">
                      <img 
                        src={page.heroImage} 
                        alt={page.title} 
                        className="w-full h-full object-cover" 
                      />
                      <div className="absolute top-2 right-2 flex items-center space-x-1 flex-wrap gap-1">
                        {isSys && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-600 text-white shadow-xs">
                            Core Page
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shadow-xs ${
                          page.isPublished ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-white'
                        }`}>
                          {page.isPublished ? 'Published' : 'Draft'}
                        </span>
                        {page.showInMenu && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#00C6A6] text-slate-950 shadow-xs">
                            In Menu ({page.menuLocation || 'HEADER'})
                          </span>
                        )}
                        {page.showInFooter && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-600 text-white shadow-xs">
                            In Footer
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="p-4 space-y-2 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono text-slate-400">/{page.slug}</span>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        {page.layoutTemplate || 'STANDARD'}
                      </span>
                    </div>
                    <h4 className="font-bold text-sm text-slate-900">{page.title}</h4>
                    <p className="text-xs text-slate-500 line-clamp-2">{page.subtitle || page.content.slice(0, 100)}</p>
                    
                    {Array.isArray(page.blocks) && page.blocks.length > 0 && (
                      <div className="pt-1 flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                        <Layers className="w-3 h-3 text-[#00C6A6]" />
                        <span>{page.blocks.length} custom blocks attached</span>
                      </div>
                    )}
                  </div>

                  <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">
                      Updated: {page.updatedAt ? new Date(page.updatedAt).toLocaleDateString() : 'Recent'}
                    </span>
                    <div className="flex items-center space-x-1.5">
                      <a
                        href={`/pages/${page.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        title="Preview live page in new tab"
                        className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer flex items-center space-x-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>View</span>
                      </a>
                      <button
                        id={`edit-page-seo-btn-${page.id}`}
                        onClick={() => {
                          setPageError(null);
                          setPagePreviewTab('EDIT');
                          setPageEditorSubTab('SEO');
                          setEditingPage({ ...page });
                          setIsCreatingPage(false);
                        }}
                        className="px-2.5 py-1 text-xs font-bold bg-[#008972] hover:bg-[#00705d] text-white rounded-lg cursor-pointer flex items-center gap-1 shadow-xs"
                        title="Edit Page SEO & Meta Tags"
                      >
                        <Globe className="w-3 h-3 text-white" />
                        <span>SEO</span>
                      </button>
                      <button
                        id={`edit-page-btn-${page.id}`}
                        onClick={() => {
                          setPageError(null);
                          setPagePreviewTab('EDIT');
                          setPageEditorSubTab('CONTENT');
                          setEditingPage({ ...page });
                          setIsCreatingPage(false);
                        }}
                        className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        id={`delete-page-btn-${page.id}`}
                        onClick={() => setDeletingPage(page)}
                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                        title={isSys ? "Delete core page" : "Delete custom page"}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Edit Page Modal */}
          {editingPage && (
            <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl p-6 max-w-3xl w-full max-h-[92vh] overflow-y-auto space-y-4 shadow-2xl border border-slate-200 animate-in zoom-in-95">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-bold text-base text-slate-900">
                      {isCreatingPage ? 'Create Custom Page' : `Edit Custom Page: ${editingPage.title}`}
                    </h3>
                    {isSystemPage(editingPage.id, editingPage.slug) && (
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800">
                        Core System Page
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => { setPagePreviewTab('EDIT'); setPageEditorSubTab('CONTENT'); }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        pagePreviewTab === 'EDIT' && pageEditorSubTab === 'CONTENT' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>1. Content & Structure</span>
                    </button>
                    <button
                      type="button"
                      id="btn-page-seo-tab"
                      onClick={() => { setPagePreviewTab('EDIT'); setPageEditorSubTab('SEO'); }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        pagePreviewTab === 'EDIT' && pageEditorSubTab === 'SEO' ? 'bg-[#008972] text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>2. SEO & Search Indexing</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPagePreviewTab('PREVIEW')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        pagePreviewTab === 'PREVIEW' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Live Preview</span>
                    </button>
                  </div>
                </div>

                {pageError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{pageError}</span>
                  </div>
                )}

                {pagePreviewTab === 'PREVIEW' ? (
                  <div className="space-y-4 py-2">
                    {/* Live Preview Render */}
                    <div className="relative rounded-2xl overflow-hidden bg-slate-950 text-white min-h-[160px] flex flex-col justify-end p-6">
                      {editingPage.heroImage && (
                        <img 
                          src={editingPage.heroImage} 
                          alt={editingPage.title} 
                          className="absolute inset-0 w-full h-full object-cover opacity-40"
                        />
                      )}
                      <div className="relative z-10 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#00C6A6]">
                            /{editingPage.slug}
                          </span>
                          <span className="text-[9px] font-bold px-1.5 py-0.2 bg-white/20 rounded">
                            Layout: {editingPage.layoutTemplate || 'STANDARD'}
                          </span>
                        </div>
                        <h2 className="text-xl font-extrabold">{editingPage.title}</h2>
                        {editingPage.subtitle && (
                          <p className="text-xs text-slate-300 max-w-xl">{editingPage.subtitle}</p>
                        )}
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3 text-slate-800 text-xs">
                      <div className="font-bold text-slate-400 uppercase text-[10px] tracking-wider mb-2">Content Preview</div>
                      {editingPage.content.split('\n').map((line, idx) => {
                        const trimmed = line.trim();
                        if (!trimmed) return <div key={idx} className="h-2" />;
                        if (trimmed.startsWith('### ')) {
                          return <h4 key={idx} className="text-sm font-bold text-slate-900 mt-2">{trimmed.replace('### ', '')}</h4>;
                        }
                        if (trimmed.startsWith('## ')) {
                          return <h3 key={idx} className="text-base font-extrabold text-slate-900 mt-3">{trimmed.replace('## ', '')}</h3>;
                        }
                        if (trimmed.startsWith('- ')) {
                          return <li key={idx} className="ml-4 list-disc text-slate-700">{trimmed.replace('- ', '')}</li>;
                        }
                        return <p key={idx} className="text-slate-600 leading-relaxed">{trimmed}</p>;
                      })}
                    </div>

                    {/* Preview attached blocks */}
                    {Array.isArray(editingPage.blocks) && editingPage.blocks.length > 0 && (
                      <div className="space-y-3">
                        <div className="font-bold text-slate-400 uppercase text-[10px] tracking-wider">Dynamic Blocks ({editingPage.blocks.length})</div>
                        {editingPage.blocks.map((b, i) => (
                          <div key={b.id || i} className="p-3 bg-white border border-slate-200 rounded-xl text-xs space-y-1">
                            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-[#00C6A6]/20 text-[#00a88d] rounded">
                              {b.type}
                            </span>
                            <div className="font-bold text-slate-800">{b.title}</div>
                            {b.content && <p className="text-slate-500 text-[11px]">{b.content}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : pageEditorSubTab === 'SEO' ? (
                  <div className="py-2 space-y-4">
                    <EntitySEOSettingsTab
                      entityType="CUSTOM_PAGE"
                      entity={editingPage}
                      seo={editingPage.seo || {
                        metaTitle: editingPage.metaTitle || editingPage.seoTitle || editingPage.title || '',
                        metaDescription: editingPage.metaDescription || editingPage.seoDescription || editingPage.subtitle || '',
                        slug: editingPage.slug,
                        canonicalUrl: `https://theunbound.in/${editingPage.slug}`,
                        keywords: editingPage.keywords || [],
                        ogImage: editingPage.ogImage || editingPage.heroImage
                      }}
                      onChange={(newSeo) => {
                        setEditingPage(prev => prev ? {
                          ...prev,
                          seo: newSeo,
                          metaTitle: newSeo.metaTitle || newSeo.title || prev.metaTitle,
                          metaDescription: newSeo.metaDescription || prev.metaDescription,
                          seoTitle: newSeo.metaTitle || newSeo.title || prev.seoTitle,
                          seoDescription: newSeo.metaDescription || prev.seoDescription,
                          keywords: newSeo.keywords || prev.keywords,
                          ogImage: newSeo.ogImage || prev.ogImage,
                          slug: newSeo.slug || prev.slug
                        } : null);
                      }}
                    />
                  </div>
                ) : (
                  <>
                    {/* Content Templates */}
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-[#00C6A6]" />
                        <span>Quick Content Templates:</span>
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPage({
                              ...editingPage,
                              title: 'About TheUnbound: Premier Destination Management Company',
                              subtitle: 'Direct ground operations, wholesale B2B partner tariffs, and bespoke luxury logistics.',
                              layoutTemplate: 'HERO_SIDEBAR',
                              content: `## Who We Are: The Destination Operations Standard\n\nTheUnbound is a premier Destination Management Company (DMC) delivering direct-contracted ground logistics, VIP chauffeur fleets, accredited private guides, and exclusive venue access across our specialized multi-country network.\n\n### Direct Ground Support Guarantee\n- 100% Direct Supplier Contracts\n- 24/7 Ground Ops Dispatch\n- Accredited Multilingual Guides\n- Transparent Wholesale Pricing`,
                              heroImage: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?q=80&w=1600&auto=format&fit=crop'
                            });
                          }}
                          className="px-2 py-1 text-[10px] font-bold bg-white border border-slate-200 hover:border-[#00C6A6] text-slate-700 rounded-lg cursor-pointer"
                        >
                          About Us (Sidebar Layout)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPage({
                              ...editingPage,
                              title: 'VIP Ground Logistics & Chauffeur Fleet',
                              subtitle: 'Direct executive transportation, airport VIP fast-track, and bespoke multi-city transfers.',
                              layoutTemplate: 'STANDARD',
                              content: `## Executive Ground Transportation Services\n\nOur owned and contracted luxury fleet includes Mercedes-Benz S-Class, V-Class vans, and Toyota Alphard Executive Lounges.\n\n### Inclusions\n- Uniformed bilingual chauffeur\n- Flight tracking & meet-and-greet\n- Complimentary onboard Wi-Fi and chilled refreshments`,
                              heroImage: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?q=80&w=1600&auto=format&fit=crop'
                            });
                          }}
                          className="px-2 py-1 text-[10px] font-bold bg-white border border-slate-200 hover:border-[#00C6A6] text-slate-700 rounded-lg cursor-pointer"
                        >
                          VIP Fleet
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPage({
                              ...editingPage,
                              title: 'Specialty Seasonal Itinerary Allocations',
                              subtitle: 'Exclusive seasonal hotel allocations and private cultural entries.',
                              layoutTemplate: 'FEATURE_GRID',
                              content: `## Peak Season Ground Allocations\n\nEnsure confirmed availability during peak travel periods with guaranteed ground permits and exclusive dining reservations.\n\n### Highlights\n- Advance queue-jump permits\n- Private dining buyouts\n- Dedicated destination coordinator`,
                              heroImage: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200&auto=format&fit=crop'
                            });
                          }}
                          className="px-2 py-1 text-[10px] font-bold bg-white border border-slate-200 hover:border-[#00C6A6] text-slate-700 rounded-lg cursor-pointer"
                        >
                          Seasonal Campaign
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3 text-xs">
                      {/* Title & Slug */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">Page Title</label>
                          <input
                            id="input-page-title"
                            type="text"
                            value={editingPage.title}
                            onChange={(e) => {
                              const newTitle = e.target.value;
                              const currentSlug = editingPage.slug;
                              // Auto update slug if it was a default placeholder
                              if (!isSystemPage(editingPage.id, currentSlug) && (currentSlug.startsWith('page-') || currentSlug === 'new-custom-page')) {
                                setEditingPage({
                                  ...editingPage,
                                  title: newTitle,
                                  slug: newTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
                                });
                              } else {
                                setEditingPage({ ...editingPage, title: newTitle });
                              }
                            }}
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00C6A6] outline-none font-medium"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">URL Slug</label>
                          <input
                            id="input-page-slug"
                            type="text"
                            disabled={isSystemPage(editingPage.id, editingPage.slug)}
                            value={editingPage.slug}
                            onChange={(e) => setEditingPage({ ...editingPage, slug: e.target.value })}
                            className={`w-full px-3 py-2 border border-slate-300 rounded-xl outline-none font-mono ${isSystemPage(editingPage.id, editingPage.slug) ? 'bg-slate-100 cursor-not-allowed text-slate-500' : 'focus:ring-2 focus:ring-[#00C6A6]'}`}
                          />
                        </div>
                      </div>

                      {/* Subtitle & Hero Image */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">Hero Subtitle</label>
                          <input
                            id="input-page-subtitle"
                            type="text"
                            value={editingPage.subtitle || ''}
                            onChange={(e) => setEditingPage({ ...editingPage, subtitle: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00C6A6] outline-none"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">Layout Template</label>
                          <select
                            id="select-page-layout"
                            value={editingPage.layoutTemplate || 'STANDARD'}
                            onChange={(e) => setEditingPage({ ...editingPage, layoutTemplate: e.target.value as CustomPageLayout })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00C6A6] outline-none cursor-pointer"
                          >
                            <option value="STANDARD">Standard Hero + Body</option>
                            <option value="HERO_SIDEBAR">Hero + Sidebar with Operations Dispatch Card</option>
                            <option value="MINIMAL">Minimal Clean Editorial (Lightweight)</option>
                            <option value="FEATURE_GRID">Feature Grid Layout</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Hero Banner Image URL</label>
                        <input
                          id="input-page-hero-image"
                          type="text"
                          value={editingPage.heroImage || ''}
                          onChange={(e) => setEditingPage({ ...editingPage, heroImage: e.target.value })}
                          placeholder="https://images.unsplash.com/..."
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00C6A6] outline-none"
                        />
                      </div>

                      {/* SEO Settings Accordion/Card */}
                      <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2.5">
                        <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-[#00C6A6]" />
                          <span>Search Engine Optimization (SEO) & Social Meta</span>
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="font-semibold text-slate-600 block mb-1">Meta Page Title</label>
                            <input
                              type="text"
                              value={editingPage.metaTitle || ''}
                              onChange={(e) => setEditingPage({ ...editingPage, metaTitle: e.target.value })}
                              placeholder={editingPage.title}
                              className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00C6A6] outline-none text-xs"
                            />
                          </div>
                          <div>
                            <label className="font-semibold text-slate-600 block mb-1">Meta Description</label>
                            <input
                              type="text"
                              value={editingPage.metaDescription || ''}
                              onChange={(e) => setEditingPage({ ...editingPage, metaDescription: e.target.value })}
                              placeholder="Concise overview for Google search snippets..."
                              className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00C6A6] outline-none text-xs"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Markdown Content */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-bold text-slate-700">Markdown Body Content</label>
                          <span className="text-[10px] text-slate-400 font-mono">Supports ## headings, ### subheadings, - bullets</span>
                        </div>
                        <textarea
                          id="input-page-content"
                          rows={6}
                          value={editingPage.content}
                          onChange={(e) => setEditingPage({ ...editingPage, content: e.target.value })}
                          placeholder="## Executive Overview\n\nEnter rich narrative..."
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00C6A6] outline-none font-mono text-xs leading-relaxed"
                        />
                      </div>

                      {/* Block Builder Section */}
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                              <Layers className="w-3.5 h-3.5 text-[#00C6A6]" />
                              <span>Modular Content Blocks ({editingPage.blocks?.length || 0})</span>
                            </span>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              Add interactive sections like Inclusions Grids, Ground Ops CTA callouts, and FAQ accordions.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsAddingBlock(true)}
                            className="px-2.5 py-1 bg-[#00C6A6] hover:bg-[#00b296] text-slate-950 font-bold text-xs rounded-xl flex items-center space-x-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Block</span>
                          </button>
                        </div>

                        {/* Block Addition Selector */}
                        {isAddingBlock && (
                          <div className="p-3 bg-white border border-[#00C6A6] rounded-xl space-y-2 animate-in fade-in">
                            <div className="font-bold text-slate-800 text-xs">Choose Block Type to Add:</div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {[
                                { type: 'FEATURE_GRID', label: 'Feature / Inclusions Grid' },
                                { type: 'CTA', label: 'Call to Action Banner' },
                                { type: 'FAQ', label: 'FAQ Accordion' },
                                { type: 'IMAGE_GALLERY', label: 'Image Gallery' }
                              ].map(b => (
                                <button
                                  key={b.type}
                                  type="button"
                                  onClick={() => {
                                    setNewBlockType(b.type as any);
                                  }}
                                  className={`p-2 rounded-lg text-xs font-bold border text-left cursor-pointer transition-colors ${
                                    newBlockType === b.type
                                      ? 'border-[#00C6A6] bg-[#00C6A6]/10 text-slate-900'
                                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                                  }`}
                                >
                                  {b.label}
                                </button>
                              ))}
                            </div>
                            <div className="flex justify-end space-x-2 pt-1">
                              <button
                                type="button"
                                onClick={() => setIsAddingBlock(false)}
                                className="px-3 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={handleAddBlockToPage}
                                className="px-3 py-1 text-xs font-bold bg-[#00C6A6] text-slate-950 rounded-lg cursor-pointer"
                              >
                                Insert Block
                              </button>
                            </div>
                          </div>
                        )}

                        {/* List of currently attached blocks */}
                        {Array.isArray(editingPage.blocks) && editingPage.blocks.length > 0 ? (
                          <div className="space-y-2">
                            {editingPage.blocks.map((block, bIdx) => (
                              <div key={block.id || bIdx} className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs">
                                <div className="flex items-center space-x-2">
                                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] flex items-center justify-center">
                                    {bIdx + 1}
                                  </span>
                                  <div>
                                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                      <span>{block.title || 'Untitled Block'}</span>
                                      <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 bg-slate-100 rounded text-slate-600">
                                        {block.type}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-slate-400 line-clamp-1">
                                      {block.content || (block.data?.items?.length ? `${block.data.items.length} items configured` : 'Configured')}
                                    </p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveBlock(block.id)}
                                  className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer"
                                  title="Remove Block"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400 italic">No modular blocks attached. Click "Add Block" above to enrich the page.</p>
                        )}
                      </div>

                      {/* Navigation Sync Settings */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                        {/* Menu Integration */}
                        <div className="space-y-2">
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              id="input-page-show-in-menu"
                              checked={editingPage.showInMenu}
                              onChange={(e) => setEditingPage({ ...editingPage, showInMenu: e.target.checked })}
                              className="w-4 h-4 text-[#00C6A6] rounded cursor-pointer"
                            />
                            <span className="font-bold text-slate-700">Add to Navigation Menu</span>
                          </label>

                          {editingPage.showInMenu && (
                            <div className="space-y-2 pl-6 pt-1 border-l-2 border-[#00C6A6]">
                              <div>
                                <label className="font-semibold text-slate-600 block mb-1 text-[11px]">Menu Location</label>
                                <select
                                  value={editingPage.menuLocation || 'HEADER'}
                                  onChange={(e) => setEditingPage({ ...editingPage, menuLocation: e.target.value as MenuLocation })}
                                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs outline-none cursor-pointer"
                                >
                                  <option value="HEADER">Header Primary Menu</option>
                                  <option value="SECONDARY">Secondary Top Utility Menu</option>
                                </select>
                              </div>
                              <div>
                                <label className="font-semibold text-slate-600 block mb-1 text-[11px]">Short Nav Label</label>
                                <input
                                  type="text"
                                  value={editingPage.menuLabel || ''}
                                  onChange={(e) => setEditingPage({ ...editingPage, menuLabel: e.target.value })}
                                  placeholder={editingPage.title}
                                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs outline-none"
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Footer Integration */}
                        <div className="space-y-2">
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              id="input-page-show-in-footer"
                              checked={editingPage.showInFooter}
                              onChange={(e) => setEditingPage({ ...editingPage, showInFooter: e.target.checked })}
                              className="w-4 h-4 text-[#00C6A6] rounded cursor-pointer"
                            />
                            <span className="font-bold text-slate-700">Add to Footer Column</span>
                          </label>

                          {editingPage.showInFooter && (
                            <div className="space-y-2 pl-6 pt-1 border-l-2 border-purple-500">
                              <div>
                                <label className="font-semibold text-slate-600 block mb-1 text-[11px]">Select Footer Column</label>
                                <select
                                  value={editingPage.footerColumnId || (footerConfig.columns[0]?.id || '')}
                                  onChange={(e) => setEditingPage({ ...editingPage, footerColumnId: e.target.value })}
                                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs outline-none cursor-pointer"
                                >
                                  {footerConfig.columns.map(col => (
                                    <option key={col.id} value={col.id}>
                                      {col.title} ({col.links?.length || 0} links)
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Status Toggle */}
                        <div className="col-span-full pt-1 border-t border-slate-200">
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              id="input-page-published"
                              checked={editingPage.isPublished}
                              onChange={(e) => setEditingPage({ ...editingPage, isPublished: e.target.checked })}
                              className="w-4 h-4 text-[#00C6A6] rounded cursor-pointer"
                            />
                            <span className="font-bold text-slate-800">Publish Live Immediately</span>
                          </label>
                          <p className="text-[10px] text-slate-400 ml-6">
                            When unchecked, the page remains in Draft mode and will not appear to public buyers.
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <div>
                    {!isCreatingPage && editingPage && (
                      <button
                        type="button"
                        id="btn-delete-page-modal"
                        onClick={() => {
                          const pageToDelete = editingPage;
                          setEditingPage(null);
                          setDeletingPage(pageToDelete);
                        }}
                        className="px-3.5 py-2 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl cursor-pointer flex items-center space-x-1.5 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Page</span>
                      </button>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      id="btn-cancel-page-modal"
                      onClick={() => {
                        setEditingPage(null);
                        setIsCreatingPage(false);
                        setPageError(null);
                      }}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      id="btn-save-page-modal"
                      onClick={() => handleSavePage(editingPage)}
                      className="px-5 py-2 text-xs font-bold bg-[#00C6A6] hover:bg-[#00b296] text-slate-950 rounded-xl cursor-pointer shadow-xs"
                    >
                      Save Page
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 3: FOOTER NAVIGATION BUILDER */}
      {activeTab === 'FOOTER' && (
        <FooterNavigationBuilder />
      )}

      {/* DELETION CONFIRMATION DIALOG: MENU ITEM */}
      {deletingMenuItem && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl border border-rose-100 animate-in zoom-in-95">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-base text-slate-900">Remove Navigation Link?</h4>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to remove <strong className="text-slate-800">"{deletingMenuItem.label}"</strong> from the website navigation menu?
              </p>
            </div>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                id="cancel-delete-menu-item"
                onClick={() => setDeletingMenuItem(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="confirm-delete-menu-item"
                onClick={() => executeDeleteMenuItem(deletingMenuItem.id, deletingMenuItem.label)}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl cursor-pointer shadow-xs"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETION CONFIRMATION DIALOG: CUSTOM PAGE */}
      {deletingPage && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl border border-rose-100 animate-in zoom-in-95">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-base text-slate-900">Delete Custom Page?</h4>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to delete <strong className="text-slate-800">"{deletingPage.title}"</strong> (/{deletingPage.slug})? All associated menu links and footer references will be automatically removed.
              </p>
            </div>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                id="cancel-delete-page"
                onClick={() => setDeletingPage(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="confirm-delete-page"
                onClick={() => executeDeletePage(deletingPage.id, deletingPage.title)}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl cursor-pointer shadow-xs"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
