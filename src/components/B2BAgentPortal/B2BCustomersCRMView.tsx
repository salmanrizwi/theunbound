import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  Mail, 
  Phone, 
  Building, 
  MapPin, 
  FileText, 
  BookmarkCheck, 
  Edit2, 
  Trash2, 
  Calendar,
  CheckCircle2
} from 'lucide-react';
import { B2BCustomer } from '../../types';
import { AppDatabase } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { useQuotation } from '../../context/QuotationContext';

interface B2BCustomersCRMViewProps {
  onCreateQuoteForCustomer: (customer: B2BCustomer) => void;
}

export const B2BCustomersCRMView: React.FC<B2BCustomersCRMViewProps> = ({
  onCreateQuoteForCustomer
}) => {
  const { user } = useAuth();
  const db = AppDatabase.getInstance();

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const customers = useMemo(() => {
    return db.getB2BCustomers(user?.id);
  }, [db, user, refreshTrigger]);

  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<B2BCustomer | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    country: 'United Kingdom',
    city: 'London',
    preferredDestination: 'Japan',
    budgetPerPersonUSD: 6000,
    notes: ''
  });

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      return (
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.company && c.company.toLowerCase().includes(searchQuery.toLowerCase())) ||
        c.country.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [customers, searchQuery]);

  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) return;

    const newCustomer: B2BCustomer = {
      id: editingCustomer ? editingCustomer.id : `cust-${Date.now()}`,
      agentId: user?.id || 'usr-agent-01',
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      company: formData.company,
      country: formData.country,
      city: formData.city,
      preferredDestination: formData.preferredDestination,
      budgetPerPersonUSD: Number(formData.budgetPerPersonUSD) || 5000,
      notes: formData.notes,
      totalQuotesCount: editingCustomer ? editingCustomer.totalQuotesCount : 0,
      totalBookingsCount: editingCustomer ? editingCustomer.totalBookingsCount : 0,
      lastContactDate: new Date().toISOString().split('T')[0],
      createdAt: editingCustomer ? editingCustomer.createdAt : new Date().toISOString().split('T')[0]
    };

    db.saveB2BCustomer(newCustomer);
    setIsAddModalOpen(false);
    setEditingCustomer(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      company: '',
      country: 'United Kingdom',
      city: 'London',
      preferredDestination: 'Japan',
      budgetPerPersonUSD: 6000,
      notes: ''
    });
    setRefreshTrigger(prev => prev + 1);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this customer record?')) {
      db.deleteB2BCustomer(id);
      setRefreshTrigger(prev => prev + 1);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 text-[10px] font-bold uppercase tracking-wider">
              Agency Client Relationship Management
            </span>
            <span className="text-xs text-slate-400">({customers.length} Client Profiles)</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 font-sans mt-1">Clients & Family Offices CRM</h1>
          <p className="text-xs text-slate-500 max-w-2xl mt-0.5">
            Maintain your private client database, track travel history, and launch customized quotations in one click.
          </p>
        </div>

        <button
          onClick={() => {
            setEditingCustomer(null);
            setFormData({
              name: '',
              email: '',
              phone: '',
              company: '',
              country: 'United Kingdom',
              city: 'London',
              preferredDestination: 'Japan',
              budgetPerPersonUSD: 6000,
              notes: ''
            });
            setIsAddModalOpen(true);
          }}
          className="inline-flex items-center space-x-2 bg-slate-900 hover:bg-[#00C6A6] hover:text-slate-950 text-white px-5 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Client</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search client database by name, company, email, or country..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-[#00C6A6]"
          />
        </div>
      </div>

      {/* Customer Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCustomers.map(customer => (
          <div
            key={customer.id}
            className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4 group"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{customer.name}</h3>
                  <span className="text-[11px] text-slate-400 font-medium block">
                    {customer.company || 'Private Traveler'}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                  {customer.country}
                </span>
              </div>

              {/* Contact Details */}
              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex items-center space-x-2">
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{customer.email}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{customer.phone || 'N/A'}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>Prefers: <span className="font-semibold text-slate-900">{customer.preferredDestination || 'Japan'}</span></span>
                </div>
              </div>

              {/* Notes */}
              {customer.notes && (
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-[11px] text-slate-600 line-clamp-2">
                  {customer.notes}
                </div>
              )}

              {/* Stats */}
              <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-100 text-slate-500">
                <span>{customer.totalQuotesCount || 0} Proposals</span>
                <span className="text-emerald-600 font-bold">{customer.totalBookingsCount || 0} Bookings</span>
              </div>
            </div>

            {/* Card Action Strip */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => {
                    setEditingCustomer(customer);
                    setFormData({
                      name: customer.name,
                      email: customer.email,
                      phone: customer.phone,
                      company: customer.company || '',
                      country: customer.country,
                      city: customer.city || '',
                      preferredDestination: customer.preferredDestination || 'Japan',
                      budgetPerPersonUSD: customer.budgetPerPersonUSD || 6000,
                      notes: customer.notes || ''
                    });
                    setIsAddModalOpen(true);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100"
                  title="Edit Customer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(customer.id)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                onClick={() => onCreateQuoteForCustomer(customer)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-[#00C6A6] hover:text-slate-950 text-white text-xs font-bold transition-all cursor-pointer"
              >
                + Create Quote
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Client Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <form 
            onSubmit={handleSaveCustomer}
            className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 my-auto max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingCustomer ? 'Edit Client Profile' : 'Add New Client Profile'}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-900 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Lord Alexander Wright"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-[#00C6A6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="alex@domain.com"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-[#00C6A6]"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+44 7700 900142"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-[#00C6A6]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Company / Organization</label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    placeholder="Manor Capital Partners"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-[#00C6A6]"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Country</label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-[#00C6A6]"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Traveler Preferences & VIP Notes</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Prefers 5-star traditional ryokans, First class bullet trains, private English guides..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-[#00C6A6]"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-xs font-bold text-slate-500 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-[#00C6A6] hover:text-slate-950 text-white text-xs font-bold transition-all cursor-pointer"
              >
                Save Client Profile
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
