import React, { useState } from 'react';
import { useRoster } from '../context/RosterContext';
import { Product, RosterResource, DateAvailabilityStatus } from '../types';
import { db } from '../services/db';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Trash2, 
  UserCheck, 
  ShieldAlert, 
  Lock, 
  Unlock, 
  Settings2, 
  Edit3, 
  CheckCircle2, 
  AlertTriangle, 
  Download, 
  Layers, 
  Search,
  Filter,
  Car,
  User,
  Compass,
  Ship,
  Sparkles,
  Info
} from 'lucide-react';

interface RosterAdminManagerProps {
  products?: Product[];
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const RosterAdminManager: React.FC<RosterAdminManagerProps> = ({ products = [] }) => {
  const safeProducts = (products && products.length > 0) ? products : db.getProducts();

  const {
    resources,
    rosterRules,
    checkDateAvailability,
    toggleBlackoutDate,
    setDateOverride,
    removeDateOverride,
    assignResource,
    setOperatingDays,
    addResource,
    updateResource,
    deleteResource,
    getMonthlyAvailabilityMap
  } = useRoster();

  const [selectedProductId, setSelectedProductId] = useState<string>(safeProducts[0]?.id || 'prod-jp-01');
  const [productSearchQuery, setProductSearchQuery] = useState<string>('');
  const [productDestFilter, setProductDestFilter] = useState<string>('ALL');
  const [currentYear, setCurrentYear] = useState<number>(2026);
  const [currentMonth, setCurrentMonth] = useState<number>(7); // August 2026

  // Selected cell modal / drawer for deep operational editing
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<DateAvailabilityStatus>('BLOCKED');
  const [editReason, setEditReason] = useState<string>('');
  const [editCapacity, setEditCapacity] = useState<number>(10);
  const [editBookedPax, setEditBookedPax] = useState<number>(0);
  const [editResourceId, setEditResourceId] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');

  // Resource modal
  const [isAddingResource, setIsAddingResource] = useState(false);
  const [newResourceName, setNewResourceName] = useState('');
  const [newResourceRole, setNewResourceRole] = useState<
    | 'TRANSPORTER'
    | 'HOTEL_PARTNER'
    | 'TICKET_PARTNER'
    | 'GUIDE'
    | 'DRIVER'
    | 'FREELANCE_DRIVER'
    | 'FREELANCE_GUIDE'
    | 'RESTAURANT'
    | 'CAPTAIN'
    | 'HOST'
    | 'COORDINATOR'
    | 'VEHICLE'
  >('GUIDE');
  const [newResourceDestination, setNewResourceDestination] = useState('Japan');
  const [newResourcePhone, setNewResourcePhone] = useState('');
  const [newResourceEmail, setNewResourceEmail] = useState('');
  const [newResourceLanguages, setNewResourceLanguages] = useState('English, Japanese');

  // Filtered products list for search bar
  const filteredProducts = safeProducts.filter(p => {
    const q = (productSearchQuery || '').toLowerCase();
    const destFilter = (productDestFilter || 'ALL').toLowerCase();

    const matchesSearch = !q ||
      (p.name || '').toLowerCase().includes(q) ||
      (p.sku || '').toLowerCase().includes(q) ||
      (p.city || '').toLowerCase().includes(q) ||
      (p.country || '').toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q);

    const matchesDest = destFilter === 'all' ||
      (p.destinationId || '').toLowerCase() === destFilter ||
      (p.country || '').toLowerCase().includes(destFilter);

    return matchesSearch && matchesDest;
  });

  const selectedProduct = safeProducts.find(p => p.id === selectedProductId) || safeProducts[0] || null;
  const monthlyMap = selectedProduct ? getMonthlyAvailabilityMap(selectedProduct.id, currentYear, currentMonth) : {};
  const currentRule = selectedProduct ? rosterRules[selectedProduct.id] : undefined;

  // Calendar Math
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const handleOpenDateEditor = (dateStr: string) => {
    if (!selectedProduct) return;
    setEditingDate(dateStr);
    const existingCheck = checkDateAvailability(selectedProduct.id, dateStr, 1);
    const override = currentRule?.dateOverrides?.[dateStr];

    setEditStatus(existingCheck.status);
    setEditReason(override?.reason || '');
    setEditCapacity(override?.maxCapacity || currentRule?.defaultCapacity || 12);
    setEditBookedPax(override?.bookedPax || 0);
    setEditResourceId(override?.assignedResourceId || '');
    setEditNotes(override?.notes || '');
  };

  const handleSaveDateOverride = () => {
    if (!editingDate || !selectedProduct) return;

    const resourceObj = resources.find(r => r.id === editResourceId);

    setDateOverride(selectedProduct.id, {
      date: editingDate,
      status: editStatus,
      reason: editReason || (editStatus === 'BLOCKED' ? 'Operational Blackout' : undefined),
      maxCapacity: editCapacity,
      bookedPax: editBookedPax,
      assignedResourceId: editResourceId || undefined,
      assignedResourceName: resourceObj ? `${resourceObj.name} (${resourceObj.role})` : undefined,
      notes: editNotes || undefined
    });

    setEditingDate(null);
  };

  const handleRemoveOverride = (dateStr: string) => {
    if (!selectedProduct) return;
    removeDateOverride(selectedProduct.id, dateStr);
    setEditingDate(null);
  };

  const handleCreateResource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newResourceName) return;

    addResource({
      name: newResourceName,
      role: newResourceRole,
      destinationId: newResourceDestination.toLowerCase(),
      destinationName: newResourceDestination,
      phone: newResourcePhone,
      email: newResourceEmail,
      languages: newResourceLanguages.split(',').map(s => s.trim()),
      status: 'ACTIVE'
    });

    setIsAddingResource(false);
    setNewResourceName('');
    setNewResourcePhone('');
    setNewResourceEmail('');
  };

  const toggleWeekday = (day: string) => {
    if (!selectedProduct || !currentRule) return;
    const days = currentRule.operatingDays.includes(day)
      ? currentRule.operatingDays.filter(d => d !== day)
      : [...currentRule.operatingDays, day];
    setOperatingDays(selectedProduct.id, days);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header & Product Switcher */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 mb-2">
              <CalendarIcon className="w-3.5 h-3.5 text-[#008972]" />
              <span>Operational Ground Calendar & Resource Roster</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold font-sans text-slate-900">
              Product Availability & Blackout Master Control
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Control operational dates, assign local guides and luxury vehicles, block maintenance days, and govern real-time booking eligibility.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsAddingResource(true)}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center cursor-pointer transition-all shadow-xs"
            >
              <span>Add Ground Resource</span>
            </button>
          </div>
        </div>

        {/* Product Search & Selection Bar (Replacing Slider) */}
        <div className="pt-2 border-t border-slate-100 space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                id="roster-product-search-input"
                type="text"
                value={productSearchQuery}
                onChange={(e) => setProductSearchQuery(e.target.value)}
                placeholder="Search products by title, SKU, city, or category..."
                className="w-full pl-10 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-1 focus:ring-[#00C6A6] focus:border-[#00C6A6]"
              />
              {productSearchQuery && (
                <button
                  onClick={() => setProductSearchQuery('')}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Destination Hub Filter */}
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-500 whitespace-nowrap hidden sm:inline">Filter Hub:</span>
              <select
                id="roster-dest-filter"
                value={productDestFilter}
                onChange={(e) => setProductDestFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 focus:bg-white focus:ring-1 focus:ring-[#00C6A6] cursor-pointer"
              >
                <option value="ALL">All Destinations</option>
                <option value="japan">Japan</option>
                <option value="united-kingdom">United Kingdom</option>
                <option value="europe">Europe</option>
              </select>
            </div>
          </div>

          {/* Active Selected Product Badge & Quick Match Dropdown */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-500">Currently Editing:</span>
              <span className="font-extrabold text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                {selectedProduct.name}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                SKU: {selectedProduct.sku} • {selectedProduct.city}, {selectedProduct.country}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-[11px] text-slate-500 font-medium">
                {filteredProducts.length} Product{filteredProducts.length === 1 ? '' : 's'} found
              </span>
              <select
                id="roster-quick-product-select"
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900 focus:ring-1 focus:ring-[#00C6A6] cursor-pointer max-w-[220px] truncate"
              >
                {filteredProducts.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout: Calendar Grid (Left) + Resources & Quick Toggles (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Master Interactive Calendar */}
        <div className="lg:col-span-8 bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <h3 className="text-base font-bold text-slate-900">
                {MONTH_NAMES[currentMonth]} {currentYear}
              </h3>
              <span className="text-xs text-slate-500 font-mono">
                {selectedProduct.city}, {selectedProduct.country}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => {
                  if (currentMonth === 0) {
                    setCurrentMonth(11);
                    setCurrentYear(prev => prev - 1);
                  } else {
                    setCurrentMonth(prev => prev - 1);
                  }
                }}
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (currentMonth === 11) {
                    setCurrentMonth(0);
                    setCurrentYear(prev => prev + 1);
                  } else {
                    setCurrentMonth(prev => prev + 1);
                  }
                }}
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-2 text-center">
            {WEEKDAY_NAMES.map(day => (
              <div key={day} className="text-xs font-bold text-slate-400 uppercase tracking-wider py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Day Tiles */}
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`emp-${i}`} className="min-h-[85px] rounded-2xl bg-slate-50/50 border border-transparent" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const monthStr = String(currentMonth + 1).padStart(2, '0');
              const dayStr = String(dayNum).padStart(2, '0');
              const dateString = `${currentYear}-${monthStr}-${dayStr}`;

              const check = monthlyMap[dateString] || checkDateAvailability(selectedProduct.id, dateString, 1);
              const override = currentRule?.dateOverrides[dateString];

              let tileBg = 'bg-white border-slate-200 hover:border-[#00C6A6]';
              let badgeBg = 'bg-emerald-100 text-emerald-800';
              let label = 'Available';

              if (!check.isAvailable) {
                if (check.status === 'BLOCKED' || check.status === 'MAINTENANCE') {
                  tileBg = 'bg-rose-50/70 border-rose-200 hover:border-rose-400';
                  badgeBg = 'bg-rose-100 text-rose-800';
                  label = check.status === 'MAINTENANCE' ? 'Maintenance' : 'Blackout';
                } else if (check.status === 'SOLD_OUT') {
                  tileBg = 'bg-amber-50/70 border-amber-200 hover:border-amber-400';
                  badgeBg = 'bg-amber-100 text-amber-800';
                  label = 'Sold Out';
                } else {
                  tileBg = 'bg-slate-100/70 border-slate-200 text-slate-400';
                  badgeBg = 'bg-slate-200 text-slate-600';
                  label = 'Off Roster';
                }
              } else if (check.status === 'LIMITED') {
                tileBg = 'bg-amber-50/50 border-amber-300';
                badgeBg = 'bg-amber-100 text-amber-800';
                label = 'Limited';
              }

              return (
                <button
                  key={dateString}
                  type="button"
                  onClick={() => handleOpenDateEditor(dateString)}
                  className={`min-h-[85px] p-2 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer hover:shadow-md ${tileBg}`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-bold text-slate-900">{dayNum}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${badgeBg}`}>
                      {label}
                    </span>
                  </div>

                  {override?.assignedResourceName && (
                    <div className="text-[10px] text-slate-600 truncate flex items-center space-x-1 font-medium mt-1">
                      <UserCheck className="w-2.5 h-2.5 text-[#008972] shrink-0" />
                      <span className="truncate">{override.assignedResourceName.split(' ')[0]}</span>
                    </div>
                  )}

                  {override?.reason && (
                    <div className="text-[9px] text-slate-500 truncate mt-0.5" title={override.reason}>
                      {override.reason}
                    </div>
                  )}

                  <div className="text-[9px] text-slate-400 text-right mt-auto">
                    Click to edit
                  </div>
                </button>
              );
            })}
          </div>

          {/* Calendar Action Guide */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <div className="flex items-center space-x-2">
              <Info className="w-4 h-4 text-[#008972] shrink-0" />
              <span>Click on any calendar day to instantly toggle blackout dates, manage capacity, or assign specific guides/vehicles.</span>
            </div>
          </div>
        </div>

        {/* Right Column: Weekly Rules & Ground Resources */}
        <div className="lg:col-span-4 space-y-6">
          {/* Weekly Operating Days Config */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center space-x-2">
              <Settings2 className="w-4 h-4 text-[#008972]" />
              <span>Weekly Operating Schedule</span>
            </h3>

            <p className="text-xs text-slate-500">
              Days when <strong>{selectedProduct.name}</strong> operates on ground.
            </p>

            <div className="grid grid-cols-4 gap-2">
              {WEEKDAY_NAMES.map(day => {
                const isActive = currentRule?.operatingDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleWeekday(day)}
                    className={`py-2 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
                      isActive
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-slate-100 text-slate-400 border border-slate-200 line-through'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          {/* DMC Ground Staff & Resource Manifest */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center space-x-2">
                <UserCheck className="w-4 h-4 text-[#008972]" />
                <span>Ground Resource Roster ({resources.length})</span>
              </h3>
              <button
                onClick={() => setIsAddingResource(true)}
                className="text-[11px] font-bold text-[#008972] hover:underline cursor-pointer flex items-center"
              >
                <span>New</span>
              </button>
            </div>

            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {resources.map(res => (
                <div
                  key={res.id}
                  className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 font-bold shrink-0">
                      {res.role === 'GUIDE' && <Compass className="w-4 h-4 text-[#008972]" />}
                      {res.role === 'DRIVER' && <Car className="w-4 h-4 text-blue-600" />}
                      {res.role === 'VEHICLE' && <Car className="w-4 h-4 text-purple-600" />}
                      {res.role === 'CAPTAIN' && <Ship className="w-4 h-4 text-cyan-600" />}
                      {res.role === 'HOST' && <User className="w-4 h-4 text-amber-600" />}
                      {res.role === 'COORDINATOR' && <UserCheck className="w-4 h-4 text-emerald-600" />}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 block leading-tight">
                        {res.name}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {res.role} • {res.destinationName}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => deleteResource(res.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Delete Resource"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Date Edit Modal Drawer */}
      {editingDate && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden p-6 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#008972] block">
                  Roster Day Operational Control
                </span>
                <h3 className="text-lg font-bold text-slate-900">
                  {editingDate} — {selectedProduct.name}
                </h3>
              </div>
              <button
                onClick={() => setEditingDate(null)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Status Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Availability Status</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'AVAILABLE', label: 'Available', color: 'emerald' },
                    { id: 'BLOCKED', label: 'Blackout / Blocked', color: 'rose' },
                    { id: 'MAINTENANCE', label: 'Maintenance', color: 'rose' },
                    { id: 'LIMITED', label: 'Limited Slots', color: 'amber' },
                    { id: 'SOLD_OUT', label: 'Sold Out', color: 'amber' },
                    { id: 'OFF_ROSTER', label: 'Off Roster', color: 'slate' }
                  ].map(st => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setEditStatus(st.id as DateAvailabilityStatus)}
                      className={`p-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        editStatus === st.id
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Blackout / Override Reason */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Reason / Operational Notice (Visible on quotation attempt)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Master Tea Pavilion Annual Restoration"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:bg-white focus:ring-1 focus:ring-[#00C6A6]"
                />
              </div>

              {/* Resource Assignment */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Assign Lead Guide / Vehicle</label>
                <select
                  value={editResourceId}
                  onChange={(e) => setEditResourceId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:bg-white focus:ring-1 focus:ring-[#00C6A6]"
                >
                  <option value="">-- No specific resource assigned --</option>
                  {resources.map(res => (
                    <option key={res.id} value={res.id}>
                      {res.name} ({res.role} • {res.destinationName})
                    </option>
                  ))}
                </select>
              </div>

              {/* Capacity & Booked Pax */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Max Daily Capacity</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={editCapacity}
                    onChange={(e) => setEditCapacity(parseInt(e.target.value) || 1)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Booked Pax Count</label>
                  <input
                    type="number"
                    min={0}
                    max={editCapacity}
                    value={editBookedPax}
                    onChange={(e) => setEditBookedPax(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900"
                  />
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleRemoveOverride(editingDate)}
                className="text-xs font-bold text-rose-600 hover:text-rose-800 cursor-pointer"
              >
                Reset to Default Rule
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingDate(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveDateOverride}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#008972] text-white hover:bg-[#00C6A6] cursor-pointer shadow-xs"
                >
                  Save Roster Rule
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Resource Modal */}
      {isAddingResource && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <form
            onSubmit={handleCreateResource}
            className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden p-6 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Add New Ground Resource</h3>
              <button
                type="button"
                onClick={() => setIsAddingResource(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Full Name / Resource Identifier</label>
              <input
                type="text"
                required
                placeholder="e.g. Kenji Sato or Mercedes Van #1"
                value={newResourceName}
                onChange={(e) => setNewResourceName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Role</label>
                <select
                  value={newResourceRole}
                  onChange={(e) => setNewResourceRole(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900"
                >
                  <option value="TRANSPORTER">Transporter</option>
                  <option value="HOTEL_PARTNER">Hotel Partner</option>
                  <option value="TICKET_PARTNER">Ticket Partner</option>
                  <option value="GUIDE">Guide</option>
                  <option value="DRIVER">Driver</option>
                  <option value="FREELANCE_DRIVER">Freelance Driver</option>
                  <option value="FREELANCE_GUIDE">Freelance Guide</option>
                  <option value="RESTAURANT">Restaurant</option>
                  <option value="CAPTAIN">Boat Captain</option>
                  <option value="HOST">Hospitality Host</option>
                  <option value="COORDINATOR">Ground Coordinator</option>
                  <option value="VEHICLE">Luxury Vehicle / Fleet</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Destination Hub</label>
                <select
                  value={newResourceDestination}
                  onChange={(e) => setNewResourceDestination(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900"
                >
                  <option value="Japan">Japan</option>
                  <option value="France">France</option>
                  <option value="United Kingdom">United Kingdom</option>
                  <option value="Dubai & UAE">Dubai & UAE</option>
                  <option value="Indonesia">Indonesia</option>
                  <option value="Switzerland">Switzerland</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Phone / WhatsApp</label>
                <input
                  type="text"
                  placeholder="+81 90 1234 5678"
                  value={newResourcePhone}
                  onChange={(e) => setNewResourcePhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  placeholder="resource@unbounddmc.com"
                  value={newResourceEmail}
                  onChange={(e) => setNewResourceEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Spoken Languages</label>
              <input
                type="text"
                placeholder="English, Japanese, French"
                value={newResourceLanguages}
                onChange={(e) => setNewResourceLanguages(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsAddingResource(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-bold bg-[#008972] text-white hover:bg-[#00C6A6] cursor-pointer shadow-xs"
              >
                Save Resource
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
