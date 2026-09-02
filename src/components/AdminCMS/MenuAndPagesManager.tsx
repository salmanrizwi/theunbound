import React, { useState, useEffect } from 'react';
import { AppDatabase } from '../../services/db';
import { MenuItemConfig, CustomPage, Destination, FooterMenuColumn, FooterMenuLink } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { FooterNavigationBuilder } from './FooterNavigationBuilder';
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
  Columns
} from 'lucide-react';

interface MenuAndPagesManagerProps {
  defaultTab?: 'MENU' | 'CUSTOM_PAGES' | 'FOOTER';
}

export const MenuAndPagesManager: React.FC<MenuAndPagesManagerProps> = ({ defaultTab = 'MENU' }) => {
  const db = AppDatabase.getInstance();
  const { user } = useAuth();

  const [menuItems, setMenuItems] = useState<MenuItemConfig[]>([]);
  const [customPages, setCustomPages] = useState<CustomPage[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [activeTab, setActiveTab] = useState<'MENU' | 'CUSTOM_PAGES' | 'FOOTER'>(defaultTab);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');

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

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = () => {
    setMenuItems(db.getMenuItems());
    setCustomPages(db.getCustomPages());
    setDestinations(db.getDestinations());
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

  // Menu item actions
  const handleSaveMenuItem = (item: MenuItemConfig) => {
    if (!item.label.trim()) {
      setMenuItemError('Menu link label is required.');
      return;
    }
    setMenuItemError(null);
    db.saveMenuItem(item, user);
    loadData();
    setEditingMenuItem(null);
    setIsCreatingMenuItem(false);
    showToast(`Saved menu link "${item.label}"`);
  };

  const executeDeleteMenuItem = (id: string, label: string) => {
    db.deleteMenuItem(id, user);
    loadData();
    if (editingMenuItem?.id === id) {
      setEditingMenuItem(null);
      setIsCreatingMenuItem(false);
    }
    setDeletingMenuItem(null);
    showToast(`Removed menu link "${label}"`);
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
    db.updateMenuOrdering(ordered, user);
    loadData();
    showToast('Updated menu order');
  };

  const handleToggleVisibility = (item: MenuItemConfig) => {
    const updated = { ...item, isVisible: !item.isVisible };
    db.saveMenuItem(updated, user);
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

    db.saveCustomPage(updatedPage, user);
    loadData();
    setEditingPage(null);
    setIsCreatingPage(false);
    showToast(`Saved page "${updatedPage.title}"`);
  };

  const executeDeletePage = (id: string, title: string) => {
    db.deleteCustomPage(id, user);
    loadData();
    if (editingPage?.id === id) {
      setEditingPage(null);
      setIsCreatingPage(false);
    }
    setDeletingPage(null);
    showToast(`Deleted page "${title}"`);
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
            Arrange navigation hierarchy, re-order menu links, and author custom marketing/destination landing pages with real-time sync.
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
            Navigation Links ({menuItems.length})
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
            Custom Pages ({customPages.length})
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

      {/* TAB 1: MENU ARRANGER */}
      {activeTab === 'MENU' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Header & Mobile Navigation Menu Structure</h3>
              <p className="text-xs text-slate-500">
                Use the arrows to re-order navigation items. Toggling visibility hides them instantly on the public website.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Filter links..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="px-3 py-1.5 pl-8 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-[#00C6A6] w-36 sm:w-48"
                />
                <LinkIcon className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              </div>

              <button
                id="add-menu-item-btn"
                onClick={() => {
                  setMenuItemError(null);
                  setEditingMenuItem({
                    id: `menu-${Date.now()}`,
                    label: 'New Link',
                    type: 'CUSTOM_LINK',
                    customUrl: '/',
                    displayOrder: menuItems.length + 1,
                    isVisible: true
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
            {menuItems
              .filter(item => !searchQuery.trim() || item.label.toLowerCase().includes(searchQuery.toLowerCase()) || (item.targetId && item.targetId.toLowerCase().includes(searchQuery.toLowerCase())))
              .map((item, index) => (
              <div 
                key={item.id}
                id={`menu-item-row-${item.id}`}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  {/* Order Index */}
                  <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center">
                    {index + 1}
                  </span>

                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-sm text-slate-900">{item.label}</span>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                        {item.type}
                      </span>
                      {!item.isVisible && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          Hidden
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Target: {item.targetId || item.customUrl || 'Home / Main View'}
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
                    disabled={index === menuItems.length - 1}
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
            ))}
          </div>

          {/* Edit / Create Modal for Menu Item */}
          {editingMenuItem && (
            <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-slate-200 animate-in zoom-in-95">
                <h3 className="font-bold text-base text-slate-900">
                  {isCreatingMenuItem ? 'Add Navigation Link' : `Edit Menu Link: ${editingMenuItem.label}`}
                </h3>

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

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Link Type</label>
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
                      <option value="SYSTEM_VIEW">System Screen (Home, Destinations, Experiences, About, B2B, Contact)</option>
                      <option value="DESTINATION">Specific Destination Page</option>
                      <option value="CUSTOM_PAGE">CMS Custom Page</option>
                      <option value="CUSTOM_LINK">External URL or Hash Link</option>
                    </select>
                  </div>

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

                  {editingMenuItem.type === 'CUSTOM_PAGE' && (
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Select Custom CMS Page</label>
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

                  {editingMenuItem.type === 'CUSTOM_LINK' && (
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Target URL</label>
                      <input
                        id="input-menu-custom-url"
                        type="text"
                        value={editingMenuItem.customUrl || ''}
                        onChange={(e) => setEditingMenuItem({ ...editingMenuItem, customUrl: e.target.value })}
                        placeholder="https://... or #section"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00C6A6] outline-none"
                      />
                    </div>
                  )}

                  <div className="flex items-center space-x-2 pt-2">
                    <input
                      type="checkbox"
                      id="edit-menu-visible"
                      checked={editingMenuItem.isVisible}
                      onChange={(e) => setEditingMenuItem({ ...editingMenuItem, isVisible: e.target.checked })}
                      className="w-4 h-4 text-[#00C6A6] rounded cursor-pointer"
                    />
                    <label htmlFor="edit-menu-visible" className="font-semibold text-slate-700 cursor-pointer">
                      Visible in Navigation Bar
                    </label>
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
                        <span>Delete Menu Link</span>
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

      {/* TAB 2: CUSTOM PAGES */}
      {activeTab === 'CUSTOM_PAGES' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Custom Landing & Educational Pages</h3>
              <p className="text-xs text-slate-500">
                Author customized pages for destination itineraries, seasonal promotions, or private service guarantees.
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
                    content: '## Executive Overview\n\nAdd your detailed rich-text itinerary and DMC capability specifications here.\n\n### Inclusions & Guarantees\n- VIP Airport Meet & Greet\n- Direct Ground Operations Coordinator\n- Transparent Wholesale B2B Tariffs',
                    heroImage: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200&auto=format&fit=crop',
                    isPublished: true,
                    showInMenu: true,
                    menuLabel: 'New Page',
                    menuOrder: customPages.length + 1,
                    metaDescription: '',
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
                    <div className="h-32 w-full overflow-hidden relative">
                      <img 
                        src={page.heroImage} 
                        alt={page.title} 
                        className="w-full h-full object-cover" 
                      />
                      <div className="absolute top-2 right-2 flex items-center space-x-1">
                        {isSys && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-600 text-white shadow-xs">
                            Core Page
                          </span>
                        )}
                        {page.isPublished ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500 text-white shadow-xs">
                            Published
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-white shadow-xs">
                            Draft
                          </span>
                        )}
                        {page.showInMenu && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#00C6A6] text-slate-950 shadow-xs">
                            In Menu
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="p-4 space-y-2 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono text-slate-400">/{page.slug}</span>
                      {isSys && (
                        <span className="text-[10px] text-sky-600 font-semibold flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> System Managed
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-sm text-slate-900">{page.title}</h4>
                    <p className="text-xs text-slate-500 line-clamp-2">{page.subtitle || page.content.slice(0, 100)}</p>
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
                        className="px-2 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer flex items-center space-x-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Preview</span>
                      </a>
                      <button
                        id={`edit-page-btn-${page.id}`}
                        onClick={() => {
                          setPageError(null);
                          setPagePreviewTab('EDIT');
                          setEditingPage({ ...page });
                          setIsCreatingPage(false);
                        }}
                        className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg cursor-pointer"
                      >
                        Edit Page
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
              <div className="bg-white rounded-3xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl border border-slate-200 animate-in zoom-in-95">
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
                      onClick={() => setPagePreviewTab('EDIT')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        pagePreviewTab === 'EDIT' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Editor
                    </button>
                    <button
                      type="button"
                      onClick={() => setPagePreviewTab('PREVIEW')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        pagePreviewTab === 'PREVIEW' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Preview Formatted
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
                    <div className="relative rounded-2xl overflow-hidden bg-slate-900 text-white min-h-[160px] flex flex-col justify-end p-6">
                      {editingPage.heroImage && (
                        <img 
                          src={editingPage.heroImage} 
                          alt={editingPage.title} 
                          className="absolute inset-0 w-full h-full object-cover opacity-40"
                        />
                      )}
                      <div className="relative z-10 space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#00C6A6]">
                          /{editingPage.slug}
                        </span>
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
                              content: `## Who We Are: The Destination Operations Standard\n\nTheUnbound is a premier Destination Management Company (DMC) delivering direct-contracted ground logistics, VIP chauffeur fleets, accredited private guides, and exclusive venue access across our specialized multi-country network.\n\n### Our Core Mission\nTo eliminate middleman markups and operational delays for luxury travel designers and agencies.\n\n### Direct Ground Support Guarantee\n- 100% Direct Supplier Contracts\n- 24/7 Ground Ops Dispatch\n- Accredited Multilingual Guides\n- Transparent Wholesale Pricing`,
                              heroImage: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?q=80&w=1600&auto=format&fit=crop'
                            });
                          }}
                          className="px-2 py-1 text-[10px] font-bold bg-white border border-slate-200 hover:border-[#00C6A6] text-slate-700 rounded-lg cursor-pointer"
                        >
                          About Us
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPage({
                              ...editingPage,
                              title: 'VIP Ground Logistics & Chauffeur Fleet',
                              subtitle: 'Direct executive transportation, airport VIP fast-track, and bespoke multi-city transfers.',
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
                              title: 'Specialty Seasonal Campaign',
                              subtitle: 'Exclusive seasonal allocations and private cultural entries.',
                              content: `## Peak Season Ground Allocations\n\nEnsure confirmed availability during peak travel periods with guaranteed ground permits and exclusive dining reservations.\n\n### Highlights\n- Advance queue-jump permits\n- Private dining buyouts\n- Dedicated destination coordinator`,
                              heroImage: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200&auto=format&fit=crop'
                            });
                          }}
                          className="px-2 py-1 text-[10px] font-bold bg-white border border-slate-200 hover:border-[#00C6A6] text-slate-700 rounded-lg cursor-pointer"
                        >
                          Campaign Guide
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">Page Title</label>
                          <input
                            id="input-page-title"
                            type="text"
                            value={editingPage.title}
                            onChange={(e) => setEditingPage({ ...editingPage, title: e.target.value })}
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

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-bold text-slate-700">Markdown Body Content</label>
                          <span className="text-[10px] text-slate-400 font-mono">Supports ## headings, ### subheadings, - bullets</span>
                        </div>
                        <textarea
                          id="input-page-content"
                          rows={8}
                          value={editingPage.content}
                          onChange={(e) => setEditingPage({ ...editingPage, content: e.target.value })}
                          placeholder="## Executive Overview\n\nEnter rich narrative..."
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00C6A6] outline-none font-mono text-xs leading-relaxed"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            id="input-page-published"
                            checked={editingPage.isPublished}
                            onChange={(e) => setEditingPage({ ...editingPage, isPublished: e.target.checked })}
                            className="w-4 h-4 text-[#00C6A6] rounded cursor-pointer"
                          />
                          <span className="font-semibold text-slate-700">Published Live</span>
                        </label>

                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            id="input-page-show-in-menu"
                            checked={editingPage.showInMenu}
                            onChange={(e) => setEditingPage({ ...editingPage, showInMenu: e.target.checked })}
                            className="w-4 h-4 text-[#00C6A6] rounded cursor-pointer"
                          />
                          <span className="font-semibold text-slate-700">Show in Navigation Header</span>
                        </label>

                        {editingPage.showInMenu && (
                          <div className="col-span-full pt-2">
                            <label className="font-bold text-slate-700 block mb-1">Navigation Menu Short Label</label>
                            <input
                              type="text"
                              value={editingPage.menuLabel || ''}
                              onChange={(e) => setEditingPage({ ...editingPage, menuLabel: e.target.value })}
                              placeholder={editingPage.title}
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00C6A6] outline-none text-xs"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">
                              Short title displayed directly in the top navigation bar.
                            </p>
                          </div>
                        )}
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
                Are you sure you want to delete <strong className="text-slate-800">"{deletingPage.title}"</strong> (/{deletingPage.slug})? Any navigation headers or footer links linked to this page will also be updated.
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
