import React, { useState, useEffect } from 'react';
import { TravelLead, LeadStatus, LeadPriority, LeadSource } from '../../types';
import { AppDatabase } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { X, Save, User, Mail, Phone, Building, MapPin, Calendar, DollarSign, Plus } from 'lucide-react';

interface LeadEditModalProps {
  lead: Partial<TravelLead> | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (lead: TravelLead) => void;
}

export const LeadEditModal: React.FC<LeadEditModalProps> = ({
  lead,
  isOpen,
  onClose,
  onSaved
}) => {
  const { user } = useAuth();
  const db = AppDatabase.getInstance();

  const [formData, setFormData] = useState<Partial<TravelLead>>(() => lead || {});

  useEffect(() => {
    if (lead) {
      setFormData({ ...lead });
    }
  }, [lead, isOpen]);

  if (!isOpen || !lead) return null;

  const destinations = [
    { id: 'japan', name: 'Japan' },
    { id: 'united-kingdom', name: 'United Kingdom' },
    { id: 'france', name: 'France' },
    { id: 'italy', name: 'Italy' },
    { id: 'switzerland', name: 'Switzerland' },
    { id: 'united-states', name: 'United States' },
    { id: 'indonesia', name: 'Indonesia (Bali)' },
    { id: 'thailand', name: 'Thailand' },
    { id: 'united-arab-emirates', name: 'UAE (Dubai & Abu Dhabi)' }
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.contactName || !formData.email) return;

    const fullLead: TravelLead = {
      id: formData.id || `lead-${Date.now()}`,
      leadNumber: formData.leadNumber || `LED-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      contactName: formData.contactName,
      email: formData.email,
      phone: formData.phone || '',
      country: formData.country || 'Global',
      agencyName: formData.agencyName,
      companyName: formData.companyName || formData.agencyName,
      userId: formData.userId,
      userType: formData.userType || 'BUYER',
      b2bAgentId: formData.b2bAgentId,
      source: formData.source || 'WEBSITE',
      campaignName: formData.campaignName,
      status: formData.status || 'NEW',
      priority: formData.priority || 'NORMAL',
      assignedStaffId: formData.assignedStaffId || user?.id || 'staff-01',
      assignedStaffName: formData.assignedStaffName || user?.name || 'Marcus Vance (Senior Ops)',
      assignedStaffEmail: formData.assignedStaffEmail || user?.email || 'business@theunbound.in',
      assignedDepartment: formData.assignedDepartment || 'SALES',
      destinationId: formData.destinationId || 'japan',
      destinationName: formData.destinationName || 'Japan',
      travelDates: formData.travelDates || 'Autumn 2026',
      travelStartDate: formData.travelStartDate,
      travelEndDate: formData.travelEndDate,
      numberOfNights: Number(formData.numberOfNights || 7),
      paxAdults: Number(formData.paxAdults || 2),
      paxChildren: Number(formData.paxChildren || 0),
      paxInfants: Number(formData.paxInfants || 0),
      totalPassengers: Number(formData.paxAdults || 2) + Number(formData.paxChildren || 0) + Number(formData.paxInfants || 0),
      roomsCount: Number(formData.roomsCount || 1),
      roomOccupancy: formData.roomOccupancy || 'Double / Twin',
      mealPlan: formData.mealPlan || 'Daily Breakfast',
      hotelPreferences: formData.hotelPreferences,
      transportPreferences: formData.transportPreferences,
      activityPreferences: formData.activityPreferences,
      specialRequests: formData.specialRequests,
      estimatedBudget: Number(formData.estimatedBudget || 5000),
      currency: formData.currency || 'USD',
      travelRequirements: formData.travelRequirements || '',
      notes: formData.notes || [],
      timeline: formData.timeline || [],
      followUps: formData.followUps || [],
      requestedProducts: formData.requestedProducts || [],
      documents: formData.documents || [],
      createdAt: formData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const saved = db.saveLead(fullLead, user);
    onSaved(saved);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div>
            <span className="text-[#00C6A6] text-xs font-bold uppercase tracking-wider block">
              Lead Management CRM
            </span>
            <h2 className="text-xl font-bold text-white">
              {formData.id && formData.contactName ? `Edit Lead: ${formData.contactName}` : 'Capture New Travel Lead'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-6 bg-slate-50/50">
          {/* Section 1: Customer Info */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Contact & Commercial Profile</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Contact Name *</label>
                <input
                  type="text"
                  required
                  value={formData.contactName || ''}
                  onChange={e => setFormData({ ...formData, contactName: e.target.value })}
                  placeholder="e.g. Alistair Montgomery"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#00C6A6]"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={formData.email || ''}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  placeholder="client@agency.com"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#00C6A6]"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={formData.phone || ''}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+44 20 7946 0912"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#00C6A6]"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Agency / Company Name</label>
                <input
                  type="text"
                  value={formData.agencyName || ''}
                  onChange={e => setFormData({ ...formData, agencyName: e.target.value })}
                  placeholder="Montgomery Luxury Journeys"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#00C6A6]"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Lead Source</label>
                <select
                  value={formData.source || 'WEBSITE'}
                  onChange={e => setFormData({ ...formData, source: e.target.value as LeadSource })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-semibold"
                >
                  <option value="WEBSITE">Website Form</option>
                  <option value="B2B_PARTNER">B2B Agent Partner</option>
                  <option value="PROPOSAL_DOWNLOADED">Quote PDF Download</option>
                  <option value="QUOTATION_SAVED">Quotation Saved</option>
                  <option value="BOOKING_SUBMISSION">Direct Booking Submission</option>
                  <option value="PACKAGE_INQUIRY">Package Landing Inquiry</option>
                  <option value="MARKETING_CAMPAIGN">Marketing Campaign</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Priority</label>
                <select
                  value={formData.priority || 'NORMAL'}
                  onChange={e => setFormData({ ...formData, priority: e.target.value as LeadPriority })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-semibold"
                >
                  <option value="LOW">Low</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High Priority</option>
                  <option value="URGENT">Urgent SLA</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Travel Requirements */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Destination & Travel Specifications</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Destination</label>
                <select
                  value={formData.destinationId || 'japan'}
                  onChange={e => {
                    const dest = destinations.find(d => d.id === e.target.value);
                    setFormData({ 
                      ...formData, 
                      destinationId: e.target.value,
                      destinationName: dest?.name || 'Japan'
                    });
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-semibold"
                >
                  {destinations.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Travel Dates / Window</label>
                <input
                  type="text"
                  value={formData.travelDates || ''}
                  onChange={e => setFormData({ ...formData, travelDates: e.target.value })}
                  placeholder="2026-10-12 to 2026-10-24"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Estimated Budget</label>
                <div className="flex gap-2">
                  <select
                    value={formData.currency || 'USD'}
                    onChange={e => setFormData({ ...formData, currency: e.target.value as any })}
                    className="w-20 px-2 py-2 rounded-xl border border-slate-200 bg-slate-50 font-semibold"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="JPY">JPY</option>
                    <option value="INR">INR</option>
                    <option value="AED">AED</option>
                  </select>
                  <input
                    type="number"
                    value={formData.estimatedBudget || 5000}
                    onChange={e => setFormData({ ...formData, estimatedBudget: Number(e.target.value) })}
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Adults</label>
                <input
                  type="number"
                  min={1}
                  value={formData.paxAdults || 2}
                  onChange={e => setFormData({ ...formData, paxAdults: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-bold"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Children</label>
                <input
                  type="number"
                  min={0}
                  value={formData.paxChildren || 0}
                  onChange={e => setFormData({ ...formData, paxChildren: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Number of Nights</label>
                <input
                  type="number"
                  min={1}
                  value={formData.numberOfNights || 7}
                  onChange={e => setFormData({ ...formData, numberOfNights: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1 text-xs">Detailed Travel Requirements & Itinerary Notes</label>
              <textarea
                rows={3}
                value={formData.travelRequirements || ''}
                onChange={e => setFormData({ ...formData, travelRequirements: e.target.value })}
                placeholder="Private luxury ground transport, 5-star ryokans, private local tour guides..."
                className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:bg-white focus:outline-none focus:border-[#00C6A6]"
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-[#00C6A6] hover:bg-[#00b094] text-slate-950 font-bold text-xs shadow-md shadow-[#00C6A6]/20 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>Save Lead Profile</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
