import React, { useState } from 'react';
import { 
  Home,
  LayoutDashboard,
  Package,
  Hotel,
  Train,
  FileCheck,
  Layers,
  Car,
  Users,
  FileText,
  CheckSquare,
  CalendarCheck,
  UserCheck,
  Building2,
  Globe2,
  Compass,
  MapPin,
  LayoutTemplate,
  Megaphone,
  Image as ImageIcon,
  BookOpen,
  DollarSign,
  CircleDollarSign,
  Receipt,
  FileSpreadsheet,
  Database,
  History,
  Settings,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  ShieldCheck,
  LucideIcon
} from 'lucide-react';
import { CMSSection } from '../AdminCMSHub';

export interface NavItemConfig {
  id: string;
  label: string;
  section: CMSSection;
  subTab?: string;
  icon: LucideIcon;
  badge?: string | number;
  badgeColor?: 'teal' | 'rose' | 'amber' | 'slate';
}

export interface NavGroupConfig {
  id: string;
  label: string;
  items: NavItemConfig[];
  defaultOpen?: boolean;
}

interface AdminSidebarProps {
  activeSection: CMSSection;
  activeSubTab: string;
  onNavigate: (section: string, subTab?: string, recordId?: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  counts: {
    products: number;
    hotels: number;
    packages: number;
    leads: number;
    bookings: number;
    tasks: number;
    users: number;
    destinations: number;
    hubs: number;
  };
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  activeSection,
  activeSubTab,
  onNavigate,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
  counts
}) => {
  // Collapsible groups state
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    operations: false,
    crm: false,
    bookings: false,
    accounts: false,
    content: false,
    finance: false,
    system: false
  });

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  const navGroups: NavGroupConfig[] = [
    {
      id: 'operations',
      label: 'Operations & Inventory',
      items: [
        {
          id: 'products',
          label: 'Products',
          section: 'PRODUCT_MANAGEMENT',
          subTab: 'PRODUCTS',
          icon: Package,
          badge: counts.products > 0 ? counts.products : undefined,
          badgeColor: 'slate'
        },
        {
          id: 'hotels',
          label: 'Hotels',
          section: 'HOTEL_MANAGEMENT',
          subTab: 'HOTELS',
          icon: Hotel,
          badge: counts.hotels > 0 ? counts.hotels : undefined,
          badgeColor: 'slate'
        },
        {
          id: 'rail',
          label: 'Rail',
          section: 'RAIL_MANAGEMENT',
          subTab: 'COMMERCIAL_PRODUCTS',
          icon: Train
        },
        {
          id: 'visa',
          label: 'Visa & Ancillary Services',
          section: 'VISA_ANCILLARY_SERVICES',
          subTab: 'VISA_SERVICES',
          icon: FileCheck
        },
        {
          id: 'packages',
          label: 'Packages',
          section: 'PACKAGE_MANAGEMENT',
          subTab: 'PACKAGES',
          icon: Layers,
          badge: counts.packages > 0 ? counts.packages : undefined,
          badgeColor: 'slate'
        },
        {
          id: 'transfers',
          label: 'Transfers',
          section: 'PRODUCT_MANAGEMENT',
          subTab: 'OPERATIONAL_ASSETS',
          icon: Car
        }
      ]
    },
    {
      id: 'crm',
      label: 'Sales & CRM',
      items: [
        {
          id: 'leads',
          label: 'Leads',
          section: 'LEAD_MANAGEMENT',
          subTab: 'LEADS',
          icon: Users,
          badge: counts.leads > 0 ? `${counts.leads} New` : undefined,
          badgeColor: 'rose'
        },
        {
          id: 'quotes',
          label: 'Quotes',
          section: 'LEAD_MANAGEMENT',
          subTab: 'QUOTES',
          icon: FileText
        },
        {
          id: 'tasks',
          label: 'Tasks & Follow-Ups',
          section: 'CALENDAR_SLAS',
          subTab: 'TASKS',
          icon: CheckSquare,
          badge: counts.tasks > 0 ? counts.tasks : undefined,
          badgeColor: 'amber'
        }
      ]
    },
    {
      id: 'bookings',
      label: 'Bookings',
      items: [
        {
          id: 'booking_management',
          label: 'Booking Management',
          section: 'BOOKING_MANAGEMENT',
          subTab: 'BOOKINGS',
          icon: CalendarCheck,
          badge: counts.bookings > 0 ? `${counts.bookings} Alert` : undefined,
          badgeColor: 'rose'
        }
      ]
    },
    {
      id: 'accounts',
      label: 'Account Management',
      items: [
        {
          id: 'b2b_agents',
          label: 'B2B Agents',
          section: 'ACCOUNT_MANAGEMENT',
          subTab: 'USERS_ACCESS',
          icon: UserCheck
        },
        {
          id: 'suppliers',
          label: 'Suppliers',
          section: 'ACCOUNT_MANAGEMENT',
          subTab: 'SUPPLIERS',
          icon: Building2
        },
        {
          id: 'users',
          label: 'Users',
          section: 'ACCOUNT_MANAGEMENT',
          subTab: 'PERMISSIONS',
          icon: Users,
          badge: counts.users > 0 ? `${counts.users} Pending` : undefined,
          badgeColor: 'amber'
        }
      ]
    },
    {
      id: 'content',
      label: 'Content & Destinations',
      items: [
        {
          id: 'regions',
          label: 'Regions',
          section: 'DESTINATION_MANAGEMENT',
          subTab: 'REGIONS',
          icon: Globe2
        },
        {
          id: 'destinations',
          label: 'Destinations',
          section: 'DESTINATION_MANAGEMENT',
          subTab: 'DESTINATIONS',
          icon: Compass,
          badge: counts.destinations > 0 ? counts.destinations : undefined,
          badgeColor: 'slate'
        },
        {
          id: 'hubs',
          label: 'Hubs',
          section: 'DESTINATION_MANAGEMENT',
          subTab: 'CITIES',
          icon: MapPin,
          badge: counts.hubs > 0 ? counts.hubs : undefined,
          badgeColor: 'slate'
        },
        {
          id: 'pages',
          label: 'Pages',
          section: 'PAGE_MANAGEMENT',
          subTab: 'HOMEPAGE',
          icon: LayoutTemplate
        },
        {
          id: 'promotions',
          label: 'Promotions',
          section: 'MARKETING_MANAGEMENT',
          subTab: 'PROMOTIONS',
          icon: Megaphone
        },
        {
          id: 'gallery',
          label: 'Media Library',
          section: 'MARKETING_MANAGEMENT',
          subTab: 'GALLERY',
          icon: ImageIcon
        },
        {
          id: 'blog',
          label: 'Blog',
          section: 'MARKETING_MANAGEMENT',
          subTab: 'BLOGS',
          icon: BookOpen
        }
      ]
    },
    {
      id: 'finance',
      label: 'Finance & Administration',
      items: [
        {
          id: 'pricing',
          label: 'Pricing',
          section: 'PRODUCT_MANAGEMENT',
          subTab: 'PRODUCTS',
          icon: DollarSign
        },
        {
          id: 'currency',
          label: 'Currency Management',
          section: 'CURRENCY_MANAGEMENT',
          subTab: 'RATES_TABLE',
          icon: CircleDollarSign
        },
        {
          id: 'payments',
          label: 'Payments',
          section: 'ANALYTICS_MANAGEMENT',
          subTab: 'FINANCIALS',
          icon: Receipt
        },
        {
          id: 'invoices',
          label: 'Invoices',
          section: 'ANALYTICS_MANAGEMENT',
          subTab: 'FINANCIALS',
          icon: FileText
        }
      ]
    },
    {
      id: 'system',
      label: 'System & Audit',
      items: [
        {
          id: 'master_sync',
          label: 'Master Sync',
          section: 'INTEGRATIONS_DB',
          subTab: 'SHEETS_SYNC',
          icon: FileSpreadsheet
        },
        {
          id: 'audit_logs',
          label: 'Audit Logs',
          section: 'INTEGRATIONS_DB',
          subTab: 'AUDIT_TRAIL',
          icon: History
        },
        {
          id: 'system_settings',
          label: 'System Settings',
          section: 'INTEGRATIONS_DB',
          subTab: 'INTEGRATIONS_HUB',
          icon: Settings
        }
      ]
    }
  ];

  // Helper to determine if item is active
  const isItemActive = (item: NavItemConfig): boolean => {
    if (item.section !== activeSection) return false;
    if (!item.subTab) return true;

    if (item.id === 'transfers') {
      return activeSubTab === 'OPERATIONAL_ASSETS';
    }
    if (item.id === 'products') {
      return activeSubTab === 'PRODUCTS' || activeSubTab === 'OVERVIEW';
    }
    if (item.id === 'leads') {
      return activeSubTab === 'LEADS' || activeSubTab === 'OVERVIEW';
    }
    if (item.id === 'quotes') {
      return activeSubTab === 'QUOTES' || activeSubTab === 'BUILDER';
    }
    if (item.id === 'suppliers') {
      return activeSubTab === 'SUPPLIERS';
    }
    if (item.id === 'b2b_agents') {
      return activeSubTab === 'USERS_ACCESS';
    }
    if (item.id === 'users') {
      return activeSubTab === 'PERMISSIONS' || activeSubTab === 'ROSTER';
    }
    if (item.id === 'regions') {
      return activeSubTab === 'REGIONS';
    }
    if (item.id === 'destinations') {
      return activeSubTab === 'DESTINATIONS';
    }
    if (item.id === 'hubs') {
      return activeSubTab === 'CITIES';
    }
    if (item.id === 'promotions') {
      return activeSubTab === 'PROMOTIONS';
    }
    if (item.id === 'gallery') {
      return activeSubTab === 'GALLERY';
    }
    if (item.id === 'blog') {
      return activeSubTab === 'BLOGS';
    }
    if (item.id === 'master_sync') {
      return activeSubTab === 'SHEETS_SYNC';
    }
    if (item.id === 'audit_logs') {
      return activeSubTab === 'AUDIT_TRAIL';
    }
    if (item.id === 'system_settings') {
      return activeSubTab === 'INTEGRATIONS_HUB' || activeSubTab === 'FIRESTORE_DIAGNOSTICS';
    }

    return activeSubTab === item.subTab;
  };

  const isHomeActive = activeSection === 'DASHBOARD';

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white select-none">
      {/* Brand Header */}
      <div className="h-16 px-4 border-b border-slate-200/80 flex items-center justify-between shrink-0">
        <div 
          onClick={() => onNavigate('DASHBOARD', 'OVERVIEW')}
          className="flex items-center space-x-2.5 cursor-pointer group overflow-hidden"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00C6A6] to-[#008972] flex items-center justify-center text-slate-950 font-black shadow-xs shadow-[#00C6A6]/20 shrink-0 group-hover:scale-105 transition-transform">
            <ShieldCheck className="w-4 h-4 text-slate-950" />
          </div>
          {!isCollapsed && (
            <div className="min-w-0">
              <div className="flex items-center space-x-1.5">
                <span className="text-sm font-black tracking-tight text-slate-900 font-sans lowercase">
                  theunbound
                </span>
                <span className="px-1.5 py-0.2 rounded-md bg-[#00C6A6]/15 text-[#008972] text-[9px] font-extrabold uppercase tracking-wider">
                  DMC
                </span>
              </div>
              <p className="text-[9px] uppercase tracking-widest text-slate-400 font-bold leading-none mt-0.5">
                Japan Travel DMC
              </p>
            </div>
          )}
        </div>

        {/* Toggle Collapse Button (Desktop) */}
        <button
          onClick={onToggleCollapse}
          className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Close Button (Mobile) */}
        <button
          onClick={onCloseMobile}
          className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation Groups List */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 scrollbar-thin">
        {/* Canonical Home / Dashboard */}
        <div>
          <button
            onClick={() => onNavigate('DASHBOARD', 'OVERVIEW')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              isHomeActive
                ? 'bg-[#00C6A6]/15 text-[#008972] font-bold shadow-xs'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Home className={`w-4 h-4 shrink-0 ${isHomeActive ? 'text-[#008972]' : 'text-slate-400'}`} />
            {!isCollapsed && <span className="truncate">Home</span>}
          </button>
        </div>

        {/* Grouped Sections */}
        {navGroups.map((group) => {
          const isGroupCollapsed = collapsedGroups[group.id] || false;
          const hasActiveItem = group.items.some(item => isItemActive(item));

          return (
            <div key={group.id} className="space-y-1">
              {!isCollapsed && (
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center justify-between px-3 py-1 text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-wider cursor-pointer"
                >
                  <span className="truncate">{group.label}</span>
                  <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isGroupCollapsed ? '-rotate-90' : ''}`} />
                </button>
              )}

              {(!isGroupCollapsed || isCollapsed) && (
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const ItemIcon = item.icon;
                    const active = isItemActive(item);

                    return (
                      <button
                        key={item.id}
                        id={`admin-nav-${item.id}`}
                        onClick={() => onNavigate(item.section, item.subTab)}
                        title={isCollapsed ? item.label : undefined}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all cursor-pointer ${
                          active
                            ? 'bg-[#00C6A6]/15 text-[#008972] font-bold shadow-xs'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
                        }`}
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          <ItemIcon className={`w-4 h-4 shrink-0 ${active ? 'text-[#008972]' : 'text-slate-400'}`} />
                          {!isCollapsed && <span className="truncate">{item.label}</span>}
                        </div>

                        {!isCollapsed && item.badge !== undefined && (
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold shrink-0 ${
                            item.badgeColor === 'rose'
                              ? 'bg-rose-50 text-rose-600 border border-rose-200'
                              : item.badgeColor === 'amber'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : active
                              ? 'bg-[#00C6A6]/20 text-[#008972]'
                              : 'bg-slate-100 text-slate-500'
                          }`}>
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Info */}
      {!isCollapsed && (
        <div className="p-3 border-t border-slate-200/80 bg-slate-50/60 text-[11px] text-slate-500 flex items-center justify-between shrink-0">
          <span className="font-semibold text-slate-600">TheUnbound v2.4</span>
          <span className="flex items-center space-x-1 text-emerald-600 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
            <span>Online</span>
          </span>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Fixed width, Sticky) */}
      <aside 
        className={`hidden lg:block shrink-0 sticky top-0 h-screen border-r border-slate-200/80 bg-white z-30 transition-all duration-200 ${
          isCollapsed ? 'w-18' : 'w-64 xl:w-68'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer (Slide-out Overlay) */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div 
            onClick={onCloseMobile}
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity"
          />
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-2xl z-50 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
