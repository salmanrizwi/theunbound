import React, { useState, useMemo } from 'react';
import { 
  Booking, 
  BookingItem, 
  BookingPassenger, 
  User, 
  CurrencyCode, 
  SupplierPriceType 
} from '../../types';
import { AppDatabase } from '../../services/db';
import { formatCurrency } from '../../services/pricingEngine';
import { 
  X, 
  Plus, 
  Trash2, 
  Building2, 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  DollarSign, 
  ShieldCheck, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  ChevronDown, 
  Sparkles,
  Plane,
  Car,
  Compass,
  Ship,
  FileCheck
} from 'lucide-react';

interface ManualOperationalBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onBookingCreated: (booking: Booking) => void;
}

interface TempServiceItem {
  id: string;
  category: string;
  isManualServiceItem: boolean;
  productId: string;
  productName: string;
  destination: string;
  hub: string;
  serviceDate: string;
  serviceTime: string;
  serviceEndDate?: string;
  duration?: string;
  totalPax: number;
  adults: number;
  children: number;
  infants: number;
  unitSellingPrice: number;
  totalPrice: number;
  currency: CurrencyCode;
  supplierId?: string;
  supplierName?: string;
  supplierContact?: string;
  supplierPrice?: number;
  supplierCurrency?: CurrencyCode;
  supplierPriceType?: SupplierPriceType;
  operationalInstructions?: string;
  internalNotes?: string;
  customerFacingNotes?: string;
}

const SERVICE_CATEGORIES = [
  { id: 'Hotel accommodation', label: 'Hotel Accommodation', icon: Building2 },
  { id: 'Private transfer', label: 'Private Transfer', icon: Car },
  { id: 'Guided tour', label: 'Guided Tour', icon: Compass },
  { id: 'Activity/experience', label: 'Activity / Experience', icon: Sparkles },
  { id: 'Rail ticket', label: 'Rail / Train Service', icon: Plane },
  { id: 'Guide service', label: 'Licensed Guide', icon: Users },
  { id: 'Visa assistance', label: 'Visa Service', icon: FileCheck },
  { id: 'Private Yacht charter', label: 'Private Yacht Charter', icon: Ship },
  { id: 'Other approved travel service', label: 'Other Travel Service', icon: FileText }
];

export const ManualOperationalBookingModal: React.FC<ManualOperationalBookingModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onBookingCreated
}) => {
  const db = AppDatabase.getInstance();

  // Reference & Metadata
  const [manualBookingRef, setManualBookingRef] = useState(`TUB-MAN-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
  const [customerName, setCustomerName] = useState('');
  const [leadPassengerName, setLeadPassengerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [travelStartDate, setTravelStartDate] = useState('');
  const [travelEndDate, setTravelEndDate] = useState('');
  const [destination, setDestination] = useState('Bali');
  const [hub, setHub] = useState('Seminyak');
  const [adults, setAdults] = useState<number>(2);
  const [children, setChildren] = useState<number>(0);
  const [infants, setInfants] = useState<number>(0);
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [specialRequirements, setSpecialRequirements] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [customerFacingNotes, setCustomerFacingNotes] = useState('');

  // Linkage to CRM Lead (Optional)
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [selectedTeamMemberId, setSelectedTeamMemberId] = useState<string>(
    currentUser && currentUser.role !== 'B2B_AGENT' && currentUser.role !== 'BUYER' ? currentUser.id : ''
  );
  const [assignmentNotes, setAssignmentNotes] = useState<string>('');

  // Service Items state
  const [items, setItems] = useState<TempServiceItem[]>([
    {
      id: `temp-${Date.now()}-1`,
      category: 'Private transfer',
      isManualServiceItem: true,
      productId: 'MAN-TRANSFER-01',
      productName: 'Airport Private Arrival Transfer & Greeter',
      destination: 'Bali',
      hub: 'Ngurah Rai / Denpasar',
      serviceDate: '',
      serviceTime: '10:00',
      totalPax: 2,
      adults: 2,
      children: 0,
      infants: 0,
      unitSellingPrice: 45,
      totalPrice: 90,
      currency: 'USD',
      supplierName: 'Bali Ground Transport Logistics',
      supplierPrice: 60,
      supplierCurrency: 'USD',
      supplierPriceType: 'Total Service Price',
      operationalInstructions: 'Meet traveler with personalized name board outside International Terminal.',
      internalNotes: 'Flight tracker active.'
    }
  ]);

  // Passengers list
  const [passengers, setPassengers] = useState<Partial<BookingPassenger>[]>([
    {
      id: `pax-${Date.now()}-1`,
      passengerNumber: 1,
      firstName: '',
      lastName: '',
      isLeadPax: true,
      nationality: 'Indian'
    }
  ]);

  const [activeSubTab, setActiveSubTab] = useState<'DETAILS' | 'ITEMS' | 'PASSENGERS' | 'NOTES'>('DETAILS');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Available Destinations & Hubs
  const destinations = useMemo(() => db.getDestinations?.() || [], [db]);
  const leads = useMemo(() => db.getLeads?.() || [], [db]);
  const masterProducts = useMemo(() => db.getProducts?.() || [], [db]);
  const allUsers = useMemo(() => db.getUsers?.() || [], [db]);
  const b2bAgents = useMemo(() => allUsers.filter(u => u.role === 'B2B_AGENT' && u.approvalStatus === 'APPROVED'), [allUsers]);
  const internalTeamMembers = useMemo(() => allUsers.filter(u => u.role !== 'B2B_AGENT' && u.role !== 'BUYER'), [allUsers]);

  // Handle lead selection auto-fill
  const handleLeadChange = (leadId: string) => {
    setSelectedLeadId(leadId);
    if (leadId) {
      const foundLead = leads.find(l => l.id === leadId);
      if (foundLead) {
        if (!customerName && foundLead.travelerName) {
          setCustomerName(foundLead.travelerName);
          setLeadPassengerName(foundLead.travelerName);
        }
        if (!email && foundLead.contactEmail) setEmail(foundLead.contactEmail);
        if (!phone && foundLead.contactPhone) setPhone(foundLead.contactPhone);
        if (!travelStartDate && foundLead.preferredTravelDate) setTravelStartDate(foundLead.preferredTravelDate);
        if (foundLead.assignedAgentId && !selectedAgentId) {
          setSelectedAgentId(foundLead.assignedAgentId);
        }
      }
    }
  };

  // Auto-sync lead passenger name with customer name if empty
  const handleCustomerNameChange = (val: string) => {
    setCustomerName(val);
    if (!leadPassengerName) {
      setLeadPassengerName(val);
    }
  };

  // Add a new service item
  const handleAddItem = (category: string = 'Private transfer') => {
    const newItem: TempServiceItem = {
      id: `temp-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      category,
      isManualServiceItem: true,
      productId: `MAN-SRV-${Math.floor(1000 + Math.random() * 9000)}`,
      productName: `New ${category}`,
      destination: destination,
      hub: hub,
      serviceDate: travelStartDate || '',
      serviceTime: '09:00',
      totalPax: (adults + children),
      adults: adults,
      children: children,
      infants: infants,
      unitSellingPrice: 100,
      totalPrice: 100 * (adults + children),
      currency: currency,
      supplierPriceType: 'Total Service Price'
    };
    setItems([...items, newItem]);
  };

  const handleUpdateItem = (id: string, updates: Partial<TempServiceItem>) => {
    setItems(items.map(it => {
      if (it.id !== id) return it;
      const merged = { ...it, ...updates };
      // auto re-calculate total selling price if unit price or pax changes
      if (updates.unitSellingPrice !== undefined || updates.totalPax !== undefined) {
        merged.totalPrice = (merged.unitSellingPrice || 0) * (merged.totalPax || 1);
      }
      return merged;
    }));
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) {
      alert('At least one operational service item is required.');
      return;
    }
    setItems(items.filter(it => it.id !== id));
  };

  // Passenger management
  const handleAddPassenger = () => {
    const nextNum = passengers.length + 1;
    setPassengers([
      ...passengers,
      {
        id: `pax-${Date.now()}-${nextNum}`,
        passengerNumber: nextNum,
        firstName: '',
        lastName: '',
        isLeadPax: false,
        nationality: 'Indian'
      }
    ]);
  };

  const handleUpdatePassenger = (index: number, updates: Partial<BookingPassenger>) => {
    const copy = [...passengers];
    copy[index] = { ...copy[index], ...updates };
    setPassengers(copy);
  };

  const handleRemovePassenger = (index: number) => {
    if (passengers.length <= 1) {
      alert('At least one lead passenger record must exist.');
      return;
    }
    setPassengers(passengers.filter((_, i) => i !== index));
  };

  // Submission handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!customerName.trim()) {
      setErrorMessage('Customer / Booker name is required.');
      setActiveSubTab('DETAILS');
      return;
    }

    if (!travelStartDate || !travelEndDate) {
      setErrorMessage('Travel start and end dates are required.');
      setActiveSubTab('DETAILS');
      return;
    }

    if (items.length === 0) {
      setErrorMessage('At least one operational service item must be defined.');
      setActiveSubTab('ITEMS');
      return;
    }

    // Process through db
    try {
      const createdBooking = db.createManualOperationalBooking({
        bookingReference: manualBookingRef.trim(),
        leadId: selectedLeadId || undefined,
        agentId: selectedAgentId || undefined,
        assignedTeamMemberId: selectedTeamMemberId || undefined,
        assignmentNotes: assignmentNotes.trim() || undefined,
        customerName: customerName.trim(),
        leadPassengerName: (leadPassengerName || customerName).trim(),
        email: email.trim() || 'internal-ops@theunbound.in',
        phone: phone.trim(),
        travelStartDate,
        travelEndDate,
        destination,
        destinationName: destination,
        hub,
        adults,
        children,
        infants,
        specialRequirements,
        internalNotes,
        customerFacingNotes,
        serviceItems: items.map(it => ({
          ...it,
          travelDate: it.serviceDate || travelStartDate,
          serviceDate: it.serviceDate || travelStartDate
        })),
        passengers: passengers.map((p, idx) => ({
          ...p,
          passengerNumber: idx + 1,
          firstName: p.firstName || (idx === 0 ? leadPassengerName || customerName : `Guest ${idx + 1}`),
          fullName: `${p.firstName || ''} ${p.lastName || ''}`.trim() || (idx === 0 ? leadPassengerName || customerName : `Guest ${idx + 1}`)
        }))
      }, currentUser);

      onBookingCreated(createdBooking);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create manual operational booking.');
    }
  };

  if (!isOpen) return null;

  const totalSellingAmount = items.reduce((sum, it) => sum + (Number(it.totalPrice) || 0), 0);
  const totalSupplierCost = items.reduce((sum, it) => sum + (Number(it.supplierPrice) || 0), 0);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-5xl w-full shadow-2xl border border-slate-200 flex flex-col max-h-[94dvh] sm:max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#00E5C0] text-slate-950 uppercase tracking-wide">
                Internal Operational Desk
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Authorised Manual Booking Creation
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black tracking-tight text-white mt-1">
              Create Manual Operational Booking
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Direct operational entry point: Configure bespoke ground arrangements, multi-category service items, and initial supplier allocations without generating fake customer accounts.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Operational Notice Banner */}
        <div className="px-6 py-2.5 bg-amber-500/10 border-b border-amber-500/20 text-amber-800 text-xs flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Zero Fake Customer Data Policy:</strong> This operational booking will be safely stored with source type <code className="bg-amber-100 px-1 py-0.5 rounded text-[11px] font-mono">INTERNAL_MANUAL</code>. Supplier allocations and costs will remain strictly hidden from external buyers.
            </span>
          </div>
          <div className="font-mono font-bold text-amber-900 shrink-0">
            Est. Selling: {formatCurrency(totalSellingAmount, currency)}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 pt-4 border-b border-slate-200 bg-slate-50/50 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveSubTab('DETAILS')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'DETAILS'
                ? 'border-[#008972] text-[#008972] bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>1. Booking & Lead Details</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('ITEMS')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'ITEMS'
                ? 'border-[#008972] text-[#008972] bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>2. Operational Service Items ({items.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('PASSENGERS')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'PASSENGERS'
                ? 'border-[#008972] text-[#008972] bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>3. Passenger Manifest ({passengers.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('NOTES')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'NOTES'
                ? 'border-[#008972] text-[#008972] bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>4. Operational Instructions</span>
          </button>
        </div>

        {/* Main Body */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 modal-body-scroll text-xs">
          {errorMessage && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900 text-xs flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <div>{errorMessage}</div>
            </div>
          )}

          {/* TAB 1: DETAILS */}
          {activeSubTab === 'DETAILS' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Booking Reference *
                  </label>
                  <input
                    type="text"
                    value={manualBookingRef}
                    onChange={(e) => setManualBookingRef(e.target.value)}
                    className="w-full mt-1.5 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:border-[#008972]"
                    placeholder="e.g. TUB-MAN-2026-8821"
                    required
                  />
                  <span className="text-[10px] text-slate-400">Auto-generated internal identifier</span>
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Customer / Booker Name *
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => handleCustomerNameChange(e.target.value)}
                    className="w-full mt-1.5 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-[#008972]"
                    placeholder="e.g. Rahul Sharma"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Lead Passenger Name
                  </label>
                  <input
                    type="text"
                    value={leadPassengerName}
                    onChange={(e) => setLeadPassengerName(e.target.value)}
                    className="w-full mt-1.5 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-[#008972]"
                    placeholder="Primary traveler on manifest"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full mt-1.5 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-[#008972]"
                    placeholder="guest@example.com"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Contact Phone / WhatsApp
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full mt-1.5 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-[#008972]"
                    placeholder="+91 98765 43210"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Travel Start Date *
                  </label>
                  <input
                    type="date"
                    value={travelStartDate}
                    onChange={(e) => setTravelStartDate(e.target.value)}
                    className="w-full mt-1.5 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-[#008972]"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Travel End Date *
                  </label>
                  <input
                    type="date"
                    value={travelEndDate}
                    onChange={(e) => setTravelEndDate(e.target.value)}
                    className="w-full mt-1.5 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-[#008972]"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Primary Destination
                  </label>
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="w-full mt-1.5 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-[#008972]"
                    placeholder="e.g. Bali, Japan, Thailand, Vietnam"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Operational Hub / City
                  </label>
                  <input
                    type="text"
                    value={hub}
                    onChange={(e) => setHub(e.target.value)}
                    className="w-full mt-1.5 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-[#008972]"
                    placeholder="e.g. Seminyak, Ubud, Tokyo, Bangkok"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Selling Currency
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                    className="w-full mt-1.5 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 font-bold focus:outline-hidden focus:border-[#008972]"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="INR">INR (₹)</option>
                    <option value="AED">AED (د.إ)</option>
                    <option value="SGD">SGD (S$)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    CRM Lead Link (Optional)
                  </label>
                  <select
                    value={selectedLeadId}
                    onChange={(e) => handleLeadChange(e.target.value)}
                    className="w-full mt-1.5 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-[#008972]"
                  >
                    <option value="">No CRM Lead Linked</option>
                    {leads.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.leadNumber || l.id}: {l.travelerName} ({l.destination})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Mandatory Booking Ownership & Operational Assignment */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#008972]"></span>
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Mandatory Booking Ownership & Operational Assignment
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium">
                    Every booking requires both an Authoritative B2B Agent & Internal Operational Owner
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                      <span>Associated B2B Partner Agent</span>
                      <span className="text-[10px] font-normal text-slate-500">Commercial / Channel Owner</span>
                    </label>
                    <select
                      value={selectedAgentId}
                      onChange={(e) => setSelectedAgentId(e.target.value)}
                      className="w-full mt-1.5 px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 font-medium focus:outline-hidden focus:border-[#008972]"
                    >
                      <option value="">Select B2B Partner Agent (or Leave Pending)</option>
                      {b2bAgents.map(ag => (
                        <option key={ag.id} value={ag.id}>
                          {ag.name} — {ag.agencyName || ag.companyName || 'Agency Partner'} ({ag.email})
                        </option>
                      ))}
                    </select>
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      Authoritative B2B agent linked to this booking's lifecycle and client relationship.
                    </span>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                      <span>Assigned Internal Operational Owner *</span>
                      <span className="text-[10px] font-normal text-slate-500">Execution / Supplier Owner</span>
                    </label>
                    <select
                      value={selectedTeamMemberId}
                      onChange={(e) => setSelectedTeamMemberId(e.target.value)}
                      className="w-full mt-1.5 px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 font-bold focus:outline-hidden focus:border-[#008972]"
                    >
                      <option value="">Select Internal Team Member</option>
                      {internalTeamMembers.map(tm => (
                        <option key={tm.id} value={tm.id}>
                          {tm.name} — {tm.role || 'Operations'} ({tm.email})
                        </option>
                      ))}
                    </select>
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      Internal team member accountable for coordinating supplier allocations, vouchers, and updates.
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                    Assignment Handover / Operational Instructions (Internal)
                  </label>
                  <input
                    type="text"
                    value={assignmentNotes}
                    onChange={(e) => setAssignmentNotes(e.target.value)}
                    placeholder="e.g. VIP agent client; please confirm airport transfer directly with supplier within 24 hours."
                    className="w-full mt-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-[#008972]"
                  />
                </div>
              </div>

              {/* PAX Counts */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-wrap items-center gap-6">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Passenger Composition</span>
                  <span className="text-[10px] text-slate-400">Total Party: {adults + children + infants} PAX</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-600">Adults:</span>
                  <input
                    type="number"
                    min={1}
                    value={adults}
                    onChange={(e) => setAdults(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-16 px-2 py-1 text-center rounded-lg bg-white border border-slate-200 text-xs font-bold"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-600">Children:</span>
                  <input
                    type="number"
                    min={0}
                    value={children}
                    onChange={(e) => setChildren(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-16 px-2 py-1 text-center rounded-lg bg-white border border-slate-200 text-xs font-bold"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-600">Infants:</span>
                  <input
                    type="number"
                    min={0}
                    value={infants}
                    onChange={(e) => setInfants(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-16 px-2 py-1 text-center rounded-lg bg-white border border-slate-200 text-xs font-bold"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: OPERATIONAL SERVICE ITEMS */}
          {activeSubTab === 'ITEMS' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Configured Service Items</h3>
                  <p className="text-[11px] text-slate-400">
                    Add transfers, hotels, tours, rail, yacht charters, guides, or visa services.
                  </p>
                </div>

                {/* Quick Add category buttons */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {SERVICE_CATEGORIES.slice(0, 5).map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => handleAddItem(cat.id)}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-[#008972] hover:text-white text-slate-700 text-[11px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>{cat.label}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleAddItem('Other approved travel service')}
                    className="px-2.5 py-1.5 rounded-xl bg-[#008972]/10 text-[#008972] hover:bg-[#008972] hover:text-white text-[11px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>More Services</span>
                  </button>
                </div>
              </div>

              {/* Service Items Cards */}
              <div className="space-y-4">
                {items.map((item, index) => (
                  <div 
                    key={item.id} 
                    className="p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-all space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center">
                          {index + 1}
                        </span>
                        <select
                          value={item.category}
                          onChange={(e) => handleUpdateItem(item.id, { category: e.target.value })}
                          className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800"
                        >
                          {SERVICE_CATEGORIES.map(c => (
                            <option key={c.id} value={c.id}>{c.label}</option>
                          ))}
                        </select>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                          Manual Operational Item
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Remove service item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-500">Service / Product Name *</label>
                        <input
                          type="text"
                          value={item.productName}
                          onChange={(e) => handleUpdateItem(item.id, { productName: e.target.value })}
                          className="w-full mt-1 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-900"
                          placeholder="e.g. Deluxe Ocean View Suite 3N"
                          required
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-500">Destination & Operational Hub</label>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          <input
                            type="text"
                            value={item.destination}
                            onChange={(e) => handleUpdateItem(item.id, { destination: e.target.value })}
                            className="px-2.5 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900"
                            placeholder="Destination"
                          />
                          <input
                            type="text"
                            value={item.hub}
                            onChange={(e) => handleUpdateItem(item.id, { hub: e.target.value })}
                            className="px-2.5 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900"
                            placeholder="Hub / City"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-500">Service Date & Time</label>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          <input
                            type="date"
                            value={item.serviceDate}
                            onChange={(e) => handleUpdateItem(item.id, { serviceDate: e.target.value })}
                            className="px-2.5 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900"
                          />
                          <input
                            type="time"
                            value={item.serviceTime}
                            onChange={(e) => handleUpdateItem(item.id, { serviceTime: e.target.value })}
                            className="px-2.5 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Commercial Split: Selling Price (Protected) vs Supplier Price (Internal) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                      {/* Customer Selling Price */}
                      <div className="p-3 bg-white rounded-xl border border-slate-200">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600 flex items-center justify-between">
                          <span>Customer Selling Price</span>
                          <span className="text-emerald-700 font-mono font-black">
                            Total: {formatCurrency(item.totalPrice, item.currency)}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mt-2">
                          <div>
                            <span className="text-[10px] text-slate-400 block">Unit Selling</span>
                            <input
                              type="number"
                              min={0}
                              value={item.unitSellingPrice}
                              onChange={(e) => handleUpdateItem(item.id, { unitSellingPrice: parseFloat(e.target.value) || 0 })}
                              className="w-full px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block">PAX</span>
                            <input
                              type="number"
                              min={1}
                              value={item.totalPax}
                              onChange={(e) => handleUpdateItem(item.id, { totalPax: parseInt(e.target.value) || 1 })}
                              className="w-full px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold text-center"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block">Currency</span>
                            <select
                              value={item.currency}
                              onChange={(e) => handleUpdateItem(item.id, { currency: e.target.value as any })}
                              className="w-full px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold"
                            >
                              <option value="USD">USD</option>
                              <option value="EUR">EUR</option>
                              <option value="GBP">GBP</option>
                              <option value="INR">INR</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Internal Supplier Allocation & Price */}
                      <div className="p-3 bg-slate-900 text-white rounded-xl border border-slate-800">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-[#00E5C0] flex items-center justify-between">
                          <span>Internal Supplier Allocation & Cost</span>
                          <span className="text-slate-400 font-mono text-[10px]">Strictly Confidential</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <div>
                            <span className="text-[10px] text-slate-400 block">Supplier Name</span>
                            <input
                              type="text"
                              value={item.supplierName || ''}
                              onChange={(e) => handleUpdateItem(item.id, { supplierName: e.target.value })}
                              placeholder="e.g. Bali Trans Logistic"
                              className="w-full px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block">Supplier Price (Nett)</span>
                            <input
                              type="number"
                              min={0}
                              value={item.supplierPrice ?? ''}
                              onChange={(e) => handleUpdateItem(item.id, { supplierPrice: parseFloat(e.target.value) || 0 })}
                              placeholder="e.g. 75"
                              className="w-full px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-[#00E5C0] font-bold"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Operational Instructions */}
                    <div>
                      <input
                        type="text"
                        value={item.operationalInstructions || ''}
                        onChange={(e) => handleUpdateItem(item.id, { operationalInstructions: e.target.value })}
                        placeholder="Ground operational instructions: e.g. Pickup at 08:30 from hotel lobby. AC Innova required."
                        className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-700"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: PASSENGER MANIFEST */}
          {activeSubTab === 'PASSENGERS' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Traveler Manifest</h3>
                  <p className="text-[11px] text-slate-400">
                    Define passenger names, passport numbers, and individual requirements.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddPassenger}
                  className="px-3 py-1.5 rounded-xl bg-[#008972] text-white text-xs font-bold flex items-center gap-1.5 hover:bg-[#00705d] transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Passenger</span>
                </button>
              </div>

              <div className="space-y-3">
                {passengers.map((pax, index) => (
                  <div key={pax.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center">
                        {index + 1}
                      </span>
                      <div>
                        <span className="text-xs font-bold text-slate-900">
                          {pax.isLeadPax ? 'Lead Passenger' : `Guest ${index + 1}`}
                        </span>
                        {pax.isLeadPax && (
                          <span className="block text-[10px] font-bold text-[#008972]">Primary Booker</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-500">First Name</label>
                      <input
                        type="text"
                        value={pax.firstName || ''}
                        onChange={(e) => handleUpdatePassenger(index, { firstName: e.target.value })}
                        className="w-full mt-1 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-900"
                        placeholder="First Name"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-500">Last Name</label>
                      <input
                        type="text"
                        value={pax.lastName || ''}
                        onChange={(e) => handleUpdatePassenger(index, { lastName: e.target.value })}
                        className="w-full mt-1 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-900"
                        placeholder="Last Name"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-500">Passport Number</label>
                      <input
                        type="text"
                        value={pax.passportNumber || ''}
                        onChange={(e) => handleUpdatePassenger(index, { passportNumber: e.target.value })}
                        className="w-full mt-1 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-mono text-slate-900 uppercase"
                        placeholder="Z1234567"
                      />
                    </div>

                    <div className="flex items-center justify-end">
                      {!pax.isLeadPax && (
                        <button
                          type="button"
                          onClick={() => handleRemovePassenger(index)}
                          className="p-2 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Remove passenger"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: NOTES & INSTRUCTIONS */}
          {activeSubTab === 'NOTES' && (
            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Customer-Facing Itinerary Notes (Visible on Voucher & Guest Portal)
                </label>
                <textarea
                  rows={3}
                  value={customerFacingNotes}
                  onChange={(e) => setCustomerFacingNotes(e.target.value)}
                  className="w-full p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-[#008972]"
                  placeholder="e.g. Welcome to Bali! Please ensure you retain your immigration entry stamp. Your driver will meet you outside arrivals."
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Internal Operations Notes (Strictly Confidential DMC Team)
                </label>
                <textarea
                  rows={3}
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  className="w-full p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-[#008972]"
                  placeholder="e.g. Special VIP client handled directly by Managing Director. Reconfirm vehicle AC check 2 hours prior."
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Special Dietary or Medical Requirements
                </label>
                <input
                  type="text"
                  value={specialRequirements}
                  onChange={(e) => setSpecialRequirements(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-[#008972]"
                  placeholder="e.g. Vegetarian Jain meals required on all excursions; wheelchair assistance."
                />
              </div>
            </div>
          )}
          </div>

          {/* Modal Footer */}
          <div className="p-4 sm:px-6 py-3 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs font-mono">
              <div>
                <span className="text-slate-400">Total Services: </span>
                <span className="font-bold text-slate-900">{items.length} Items</span>
              </div>
              <div>
                <span className="text-slate-400">Customer Selling: </span>
                <span className="font-bold text-emerald-700">{formatCurrency(totalSellingAmount, currency)}</span>
              </div>
              <div>
                <span className="text-slate-400">Confidential Cost: </span>
                <span className="font-bold text-slate-600">{formatCurrency(totalSupplierCost, currency)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer text-center"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-bold bg-[#008972] hover:bg-[#00705d] text-white shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2 text-center"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Create Operational Booking</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
