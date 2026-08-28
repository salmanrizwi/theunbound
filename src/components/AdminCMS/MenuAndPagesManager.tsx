import React, { useState, useEffect } from 'react';
import { AppDatabase } from '../../services/db';
import { MenuItemConfig, CustomPage, Destination } from '../../types';
import { useAuth } from '../../context/AuthContext';
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
  CheckCircle2
} from 'lucide-react';

export const MenuAndPagesManager: React.FC = () => {
  const db = AppDatabase.getInstance();
  const { user } = useAuth();

  const [menuItems, setMenuItems] = useState<MenuItemConfig[]>([]);
  const [customPages, setCustomPages] = useState<CustomPage[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [activeTab, setActiveTab] = useState<'MENU' | 'CUSTOM_PAGES'>('MENU');

  // Editing state for Menu Item
  const [editingMenuItem, setEditingMenuItem] = useState<MenuItemConfig | null>(null);
  const [isCreatingMenuItem, setIsCreatingMenuItem] = useState(false);

  // Editing state for Custom Page
  const [editingPage, setEditingPage] = useState<CustomPage | null>(null);
  const [isCreatingPage, setIsCreatingPage] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadData = () => {
    setMenuItems(db.getMenuItems());
    setCustomPages(db.getCustomPages());
    setDestinations(db.getDestinations());
  };

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
      alert('Menu label is required.');
      return;
    }
    db.saveMenuItem(item, user);
    setEditingMenuItem(null);
    setIsCreatingMenuItem(false);
    showToast(`Saved menu item "${item.label}"`);
  };

  const handleDeleteMenuItem = (id: string, label: string) => {
    if (confirm(`Are you sure you want to remove "${label}" from the navigation menu?`)) {
      db.deleteMenuItem(id, user);
      showToast(`Removed menu item "${label}"`);
    }
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
    showToast('Updated menu hierarchy order');
  };

  const handleToggleVisibility = (item: MenuItemConfig) => {
    const updated = { ...item, isVisible: !item.isVisible };
    db.saveMenuItem(updated, user);
    showToast(`${updated.isVisible ? 'Enabled' : 'Hidden'} "${item.label}"`);
  };

  // Custom Page actions
  const handleSavePage = (page: CustomPage) => {
    if (!page.title.trim()) {
      alert('Page title is required.');
      return;
    }
    const slug = (page.slug || page.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')).trim();
    const updatedPage: CustomPage = {
      ...page,
      slug: slug || `page-${Date.now()}`
    };

    db.saveCustomPage(updatedPage, user);
    setEditingPage(null);
    setIsCreatingPage(false);
    showToast(`Saved page "${updatedPage.title}"`);
  };

  const handleDeletePage = (id: string, title: string, slug?: string) => {
    if (isSystemPage(id, slug)) {
      alert('This is a core system page (e.g. About Us). It cannot be deleted, but you can freely edit its content and visibility.');
      return;
    }
    if (confirm(`Are you sure you want to delete the custom page "${title}"?`)) {
      db.deleteCustomPage(id, user);
      showToast(`Deleted page "${title}"`);
    }
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
        </div>
      </div>

      {/* TAB 1: MENU ARRANGER */}
      {activeTab === 'MENU' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Header & Mobile Navigation Menu Structure</h3>
              <p className="text-xs text-slate-500">
                Use the arrows to re-order navigation items. Toggling visibility hides them instantly on the public website.
              </p>
            </div>

            <button
              id="add-menu-item-btn"
              onClick={() => {
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
              className="inline-flex items-center space-x-1.5 px-3 py-2 bg-[#00C6A6] hover:bg-[#00b296] text-slate-950 font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Menu Link</span>
            </button>
          </div>

          {/* Menu Items List */}
          <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden shadow-xs">
            {menuItems.map((item, index) => (
              <div 
                key={item.id}
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
                    onClick={() => handleMoveMenuItem(index, 'UP')}
                    disabled={index === 0}
                    title="Move Up"
                    className="p-1.5 text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleMoveMenuItem(index, 'DOWN')}
                    disabled={index === menuItems.length - 1}
                    title="Move Down"
                    className="p-1.5 text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleToggleVisibility(item)}
                    title={item.isVisible ? 'Hide from navigation' : 'Show in navigation'}
                    className={`p-1.5 rounded-lg cursor-pointer ${
                      item.isVisible ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100' : 'text-slate-400 bg-slate-100 hover:bg-slate-200'
                    }`}
                  >
                    {item.isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => {
                      setEditingMenuItem({ ...item });
                      setIsCreatingMenuItem(false);
                    }}
                    title="Edit Item"
                    className="p-1.5 text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteMenuItem(item.id, item.label)}
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

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Navigation Display Label</label>
                    <input
                      type="text"
                      value={editingMenuItem.label}
                      onChange={(e) => setEditingMenuItem({ ...editingMenuItem, label: e.target.value })}
                      placeholder="e.g. Experiences, Sakura Guide"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00C6A6] outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Link Type</label>
                    <select
                      value={editingMenuItem.type}
                      onChange={(e) => setEditingMenuItem({ ...editingMenuItem, type: e.target.value as any })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00C6A6] outline-none"
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
                        value={editingMenuItem.targetId || 'home'}
                        onChange={(e) => setEditingMenuItem({ ...editingMenuItem, targetId: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00C6A6] outline-none"
                      >
                        <option value="home">Home Page (All Destinations)</option>
                        <option value="destinations">Destinations Hub</option>
                        <option value="experiences">Curated Experiences</option>
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
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00C6A6] outline-none"
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
                        value={editingMenuItem.targetId || ''}
                        onChange={(e) => setEditingMenuItem({ ...editingMenuItem, targetId: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00C6A6] outline-none"
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

                <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setEditingMenuItem(null);
                      setIsCreatingMenuItem(false);
                    }}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleSaveMenuItem(editingMenuItem)}
                    className="px-5 py-2 text-xs font-bold bg-[#00C6A6] hover:bg-[#00b296] text-slate-950 rounded-xl cursor-pointer"
                  >
                    Save Link
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CUSTOM PAGES */}
      {activeTab === 'CUSTOM_PAGES' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Custom Landing & Educational Pages</h3>
              <p className="text-xs text-slate-500">
                Author customized pages for destination itineraries, seasonal promotions, or private service guarantees.
              </p>
            </div>

            <button
              id="add-custom-page-btn"
              onClick={() => {
                setEditingPage({
                  id: `page-${Date.now()}`,
                  slug: 'new-custom-page',
                  title: 'New Custom Page',
                  subtitle: 'Explore bespoke itinerary details and luxury logistics.',
                  content: '## Overview\n\nAdd your detailed rich-text itinerary content here.',
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
              className="inline-flex items-center space-x-1.5 px-3 py-2 bg-[#00C6A6] hover:bg-[#00b296] text-slate-950 font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Custom Page</span>
            </button>
          </div>

          {/* Custom Pages Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {customPages.map((page) => {
              const isSys = isSystemPage(page.id, page.slug);
              return (
                <div 
                  key={page.id}
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
                      Updated: {new Date(page.updatedAt).toLocaleDateString()}
                    </span>
                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => {
                          setEditingPage({ ...page });
                          setIsCreatingPage(false);
                        }}
                        className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg cursor-pointer"
                      >
                        Edit Page
                      </button>
                      {isSys ? (
                        <span 
                          title="System Core Page cannot be deleted, but all content can be customized."
                          className="p-1.5 text-slate-400 bg-slate-100 rounded-lg cursor-not-allowed text-[10px] font-medium"
                        >
                          Protected
                        </span>
                      ) : (
                        <button
                          onClick={() => handleDeletePage(page.id, page.title, page.slug)}
                          className="p-1 text-rose-500 hover:text-rose-700 rounded-lg cursor-pointer"
                          title="Delete custom page"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
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
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-base text-slate-900">
                    {isCreatingPage ? 'Create Custom Page' : `Edit Custom Page: ${editingPage.title}`}
                  </h3>
                  {isSystemPage(editingPage.id, editingPage.slug) && (
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-sky-100 text-sky-800">
                      Protected System Page
                    </span>
                  )}
                </div>

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
                        type="text"
                        value={editingPage.title}
                        onChange={(e) => setEditingPage({ ...editingPage, title: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00C6A6] outline-none"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">URL Slug</label>
                      <input
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
                      type="text"
                      value={editingPage.subtitle || ''}
                      onChange={(e) => setEditingPage({ ...editingPage, subtitle: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00C6A6] outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Hero Banner Image URL</label>
                    <input
                      type="text"
                      value={editingPage.heroImage || ''}
                      onChange={(e) => setEditingPage({ ...editingPage, heroImage: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00C6A6] outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Markdown Body Content</label>
                    <textarea
                      rows={7}
                      value={editingPage.content}
                      onChange={(e) => setEditingPage({ ...editingPage, content: e.target.value })}
                      placeholder="## Heading..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00C6A6] outline-none font-mono text-xs"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-4 pt-2">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingPage.isPublished}
                        onChange={(e) => setEditingPage({ ...editingPage, isPublished: e.target.checked })}
                        className="w-4 h-4 text-[#00C6A6] rounded"
                      />
                      <span className="font-semibold text-slate-700">Published Live</span>
                    </label>

                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingPage.showInMenu}
                        onChange={(e) => setEditingPage({ ...editingPage, showInMenu: e.target.checked })}
                        className="w-4 h-4 text-[#00C6A6] rounded"
                      />
                      <span className="font-semibold text-slate-700">Show in Navigation Header</span>
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setEditingPage(null);
                      setIsCreatingPage(false);
                    }}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleSavePage(editingPage)}
                    className="px-5 py-2 text-xs font-bold bg-[#00C6A6] hover:bg-[#00b296] text-slate-950 rounded-xl cursor-pointer"
                  >
                    Save Page
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
