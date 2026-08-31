import React, { useState, useEffect } from 'react';
import { AppDatabase } from '../../services/db';
import { TravelLead, LeadStatus } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { 
  Users, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  Phone, 
  Mail, 
  DollarSign, 
  Calendar, 
  MessageSquare, 
  CheckCircle2, 
  Clock,
  ArrowRight,
  Send
} from 'lucide-react';

export const LeadManager: React.FC = () => {
  const { user } = useAuth();
  const db = AppDatabase.getInstance();
  const [leads, setLeads] = useState<TravelLead[]>(db.getLeads());
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editingLead, setEditingLead] = useState<Partial<TravelLead> | null>(null);
  const [newNoteText, setNewNoteText] = useState('');

  useEffect(() => {
    return db.subscribe(() => {
      setLeads(db.getLeads());
    });
  }, []);

  const filteredLeads = leads.filter(l => {
    const matchesStatus = statusFilter === 'all' || l.status === statusFilter;
    const matchesSearch = l.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          l.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          l.leadNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (l.agencyName && l.agencyName.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const handleOpenAdd = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    setEditingLead({
      id: `lead-${Date.now()}`,
      leadNumber: `LED-2026-${randomNum}`,
      contactName: '',
      email: '',
      phone: '',
      agencyName: '',
      source: 'WEBSITE',
      status: 'NEW',
      assignedStaffId: user?.id || 'staff-01',
      assignedStaffName: user?.name || 'Marcus Vance (Senior Ops)',
      destinationId: 'japan',
      destinationName: 'Japan',
      travelDates: 'Autumn 2026',
      paxAdults: 2,
      paxChildren: 0,
      estimatedBudget: 8000,
      currency: 'USD',
      travelRequirements: '',
      notes: []
    });
    setIsEditing(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLead || !editingLead.contactName || !editingLead.email) return;

    const completeLead: TravelLead = {
      id: editingLead.id || `lead-${Date.now()}`,
      leadNumber: editingLead.leadNumber || `LED-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      contactName: editingLead.contactName,
      email: editingLead.email,
      phone: editingLead.phone || '',
      agencyName: editingLead.agencyName,
      source: editingLead.source || 'WEBSITE',
      status: editingLead.status || 'NEW',
      assignedStaffId: editingLead.assignedStaffId || user?.id || 'staff-01',
      assignedStaffName: editingLead.assignedStaffName || user?.name || 'Operations Lead',
      destinationId: editingLead.destinationId || 'japan',
      destinationName: editingLead.destinationName || 'Japan',
      travelDates: editingLead.travelDates || '',
      paxAdults: Number(editingLead.paxAdults || 1),
      paxChildren: Number(editingLead.paxChildren || 0),
      estimatedBudget: Number(editingLead.estimatedBudget || 0),
      currency: editingLead.currency || 'USD',
      travelRequirements: editingLead.travelRequirements || '',
      notes: editingLead.notes || [],
      quoteId: editingLead.quoteId,
      quoteNumber: editingLead.quoteNumber,
      createdAt: editingLead.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.saveLead(completeLead, user);
    setIsEditing(false);
    setEditingLead(null);
  };

  const handleStatusChange = (leadId: string, newStatus: LeadStatus) => {
    db.updateLeadStatus(leadId, newStatus, user);
  };

  const handleAddNote = () => {
    if (!editingLead || !newNoteText.trim()) return;
    const newNote = {
      id: `note-${Date.now()}`,
      authorName: user?.name || 'Operations Staff',
      text: newNoteText.trim(),
      timestamp: new Date().toISOString()
    };
    const updatedNotes = [...(editingLead.notes || []), newNote];
    setEditingLead({ ...editingLead, notes: updatedNotes });
    setNewNoteText('');
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this lead?')) {
      db.deleteLead(id, user);
    }
  };

  const getStatusColor = (status: LeadStatus) => {
    switch (status) {
      case 'NEW': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'CONTACTED': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'QUALIFIED': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'QUOTED': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'WON': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'LOST': return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2 text-[#00C6A6] font-bold text-xs uppercase tracking-wider mb-1">
            <Users className="w-4 h-4" />
            <span>Company Management System • CRM</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">Lead & Inquiry Lifecycle Manager</h2>
          <p className="text-sm text-slate-500">
            Track inquiries through New → Contacted → Qualified → Quoted → Won / Lost pipelines with staff assignment and quote links.
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center space-x-2 bg-[#00C6A6] hover:bg-[#00b094] text-slate-950 font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-md shadow-[#00C6A6]/20 text-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Capture New Lead</span>
        </button>
      </div>

      {/* Filter & Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by contact name, email, agency, or lead ID..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-[#00C6A6]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold"
        >
          <option value="all">All Statuses ({leads.length} leads)</option>
          <option value="NEW">New Inquiries</option>
          <option value="CONTACTED">Contacted</option>
          <option value="QUALIFIED">Qualified</option>
          <option value="QUOTED">Quoted</option>
          <option value="WON">Won (Converted)</option>
          <option value="LOST">Lost</option>
        </select>
      </div>

      {/* Lead Cards List */}
      <div className="space-y-3">
        {filteredLeads.map(lead => (
          <div key={lead.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                    {lead.leadNumber}
                  </span>
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${getStatusColor(lead.status)}`}>
                    {lead.status}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    Assigned to: <strong className="text-slate-700">{lead.assignedStaffName}</strong>
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <h3 className="text-base font-bold text-slate-900">{lead.contactName}</h3>
                  {lead.agencyName && (
                    <span className="text-xs font-semibold text-[#008f77] bg-[#00C6A6]/10 px-2 py-0.5 rounded">
                      {lead.agencyName}
                    </span>
                  )}
                  <span className="text-xs text-slate-500 flex items-center space-x-1">
                    <Mail className="w-3 h-3 text-slate-400" />
                    <span>{lead.email}</span>
                  </span>
                  {lead.phone && (
                    <span className="text-xs text-slate-500 flex items-center space-x-1">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <span>{lead.phone}</span>
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-600 line-clamp-2">
                  <strong className="text-slate-800">Requirements:</strong> {lead.travelRequirements || 'Standard VIP ground services requested.'}
                </p>

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                  <span>Destination: <strong className="text-slate-700">{lead.destinationName}</strong></span>
                  <span>Travel Dates: <strong className="text-slate-700">{lead.travelDates || 'Flexible'}</strong></span>
                  <span>Pax: <strong className="text-slate-700">{lead.paxAdults} Adults, {lead.paxChildren} Children</strong></span>
                  <span>Est Budget: <strong className="text-slate-700">{lead.currency || 'USD'} {(Number(lead.estimatedBudget) || 0).toLocaleString()}</strong></span>
                  {lead.quoteNumber && (
                    <span className="text-[#008f77] font-bold">Quote: {lead.quoteNumber}</span>
                  )}
                </div>
              </div>

              {/* Status Quick Changer & Actions */}
              <div className="flex flex-wrap items-center gap-2 shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100">
                <select
                  value={lead.status}
                  onChange={e => handleStatusChange(lead.id, e.target.value as LeadStatus)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-slate-50"
                >
                  <option value="NEW">New</option>
                  <option value="CONTACTED">Contacted</option>
                  <option value="QUALIFIED">Qualified</option>
                  <option value="QUOTED">Quoted</option>
                  <option value="WON">Won</option>
                  <option value="LOST">Lost</option>
                </select>

                <button
                  onClick={() => {
                    setEditingLead(lead);
                    setIsEditing(true);
                  }}
                  className="p-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 cursor-pointer"
                  title="View / Edit Lead"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(lead.id)}
                  className="p-2 rounded-xl border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 cursor-pointer"
                  title="Delete Lead"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit / Detail Modal with Notes */}
      {isEditing && editingLead && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
              <div>
                <div className="flex items-center space-x-2 text-[#00C6A6] font-bold text-xs uppercase tracking-wider">
                  <Users className="w-4 h-4" />
                  <span>Lead Management CRM</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-1">
                  {editingLead.leadNumber} • {editingLead.contactName || 'New Inquiry'}
                </h3>
              </div>
              <button onClick={() => setIsEditing(false)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Contact Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editingLead.contactName || ''}
                    onChange={e => setEditingLead({ ...editingLead, contactName: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={editingLead.email || ''}
                    onChange={e => setEditingLead({ ...editingLead, email: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Phone / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={editingLead.phone || ''}
                    onChange={e => setEditingLead({ ...editingLead, phone: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Agency Name (if B2B)
                  </label>
                  <input
                    type="text"
                    value={editingLead.agencyName || ''}
                    onChange={e => setEditingLead({ ...editingLead, agencyName: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Pipeline Status
                  </label>
                  <select
                    value={editingLead.status || 'NEW'}
                    onChange={e => setEditingLead({ ...editingLead, status: e.target.value as LeadStatus })}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold"
                  >
                    <option value="NEW">New</option>
                    <option value="CONTACTED">Contacted</option>
                    <option value="QUALIFIED">Qualified</option>
                    <option value="QUOTED">Quoted</option>
                    <option value="WON">Won (Booking Confirmed)</option>
                    <option value="LOST">Lost</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Travel Requirements & Ground Notes
                </label>
                <textarea
                  rows={3}
                  value={editingLead.travelRequirements || ''}
                  onChange={e => setEditingLead({ ...editingLead, travelRequirements: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>

              {/* Notes & Activity Log */}
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-[#00C6A6]" />
                  <span>Internal Staff Notes & Log</span>
                </span>

                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {(editingLead.notes || []).map(note => (
                    <div key={note.id} className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs">
                      <div className="flex items-center justify-between text-slate-500 mb-1">
                        <strong>{note.authorName}</strong>
                        <span>{note.timestamp ? new Date(note.timestamp).toLocaleString() : ''}</span>
                      </div>
                      <p className="text-slate-700">{note.text}</p>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add operational update note..."
                    value={newNoteText}
                    onChange={e => setNewNoteText(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddNote}
                    className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 cursor-pointer"
                  >
                    Add Note
                  </button>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[#00C6A6] hover:bg-[#00b094] text-slate-950 font-bold text-sm shadow-md shadow-[#00C6A6]/20 cursor-pointer"
                >
                  Save Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
