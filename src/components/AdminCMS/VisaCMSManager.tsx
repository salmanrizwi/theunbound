import React, { useState, useEffect } from 'react';
import { AppDatabase } from '../../services/db';
import { VisaProduct, Destination } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { ImageUploadOrUrlInput } from '../ImageUploadOrUrlInput';
import { 
  FileText, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  CheckCircle2, 
  Clock, 
  DollarSign, 
  Globe2, 
  CheckSquare, 
  ListOrdered, 
  Download, 
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  Tag
} from 'lucide-react';

interface VisaCMSManagerProps {
  destinations: Destination[];
}

export const VisaCMSManager: React.FC<VisaCMSManagerProps> = ({ destinations }) => {
  const { user } = useAuth();
  const db = AppDatabase.getInstance();
  const [visas, setVisas] = useState<VisaProduct[]>(() => db.getVisas());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<string>('all');
  const [isEditing, setIsEditing] = useState(false);
  const [editingVisa, setEditingVisa] = useState<Partial<VisaProduct> | null>(null);

  // New checklist item input
  const [newDocText, setNewDocText] = useState('');
  const [newStepText, setNewStepText] = useState('');

  useEffect(() => {
    return db.subscribe(() => {
      setVisas(db.getVisas());
    });
  }, [db]);

  const filteredVisas = visas.filter(v => {
    const matchesCountry = selectedCountry === 'all' || v.country.toLowerCase() === selectedCountry.toLowerCase();
    const matchesSearch = v.country.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          v.visaType.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          v.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCountry && matchesSearch;
  });

  const handleOpenAdd = () => {
    const defaultDest = destinations[0] || { id: 'dest-japan', name: 'Japan' };
    setEditingVisa({
      id: `visa-${Date.now()}`,
      country: defaultDest.name,
      countryCode: 'INTL',
      destinationId: defaultDest.id,
      visaType: 'Tourist Visa (Single Entry)',
      entryType: 'SINGLE_ENTRY',
      validityDays: 90,
      stayDurationDays: 30,
      processingTimeDays: 7,
      expressProcessingAvailable: true,
      expressProcessingTimeDays: 3,
      embassyFee: 50,
      serviceFee: 30,
      expressServiceFee: 60,
      currency: 'USD',
      description: 'Official wholesale B2B visa concierge assistance with strict document verification and high approval success.',
      documentsChecklist: [
        'Original Passport with minimum 6 months validity',
        '2 Recent colored passport photos on white background',
        'Confirmed flight itinerary and hotel accommodation vouchers',
        'Last 6 months verified bank statement',
        'Employment or business incorporation proof'
      ],
      submissionSteps: [
        'Upload traveler details and scanned documents',
        'DMC Visa Operations scrutiny & embassy appointment booking',
        'Direct submission to consulate / e-Visa authority',
        'Visa grant notification and document delivery'
      ],
      eligibilityNotes: [
        'Applicable for leisure, trade meetings, and short business trips',
        'Travelers must have clean travel history and genuine itinerary'
      ],
      heroImage: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200&auto=format&fit=crop',
      status: 'ACTIVE',
      featured: true,
      faqs: [
        {
          question: 'Can TheUnbound issue ground confirmation vouchers for embassy lodging?',
          answer: 'Yes, all confirmed bookings through TheUnbound include official DMC itinerary vouchers and hotel guarantees accepted by embassies.'
        }
      ]
    });
    setIsEditing(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVisa || !editingVisa.country || !editingVisa.visaType) return;

    const fullVisa: VisaProduct = {
      id: editingVisa.id || `visa-${Date.now()}`,
      country: editingVisa.country,
      countryCode: editingVisa.countryCode || 'INTL',
      destinationId: editingVisa.destinationId || 'dest-global',
      visaType: editingVisa.visaType,
      entryType: (editingVisa.entryType as any) || 'SINGLE_ENTRY',
      validityDays: Number(editingVisa.validityDays) || 90,
      stayDurationDays: Number(editingVisa.stayDurationDays) || 30,
      processingTimeDays: Number(editingVisa.processingTimeDays) || 7,
      expressProcessingAvailable: !!editingVisa.expressProcessingAvailable,
      expressProcessingTimeDays: Number(editingVisa.expressProcessingTimeDays) || 3,
      embassyFee: Number(editingVisa.embassyFee) || 0,
      serviceFee: Number(editingVisa.serviceFee) || 0,
      expressServiceFee: Number(editingVisa.expressServiceFee) || 0,
      currency: (editingVisa.currency as any) || 'USD',
      description: editingVisa.description || '',
      documentsChecklist: editingVisa.documentsChecklist || [],
      submissionSteps: editingVisa.submissionSteps || [],
      eligibilityNotes: editingVisa.eligibilityNotes || [],
      downloadableForms: editingVisa.downloadableForms || [],
      faqs: editingVisa.faqs || [],
      heroImage: editingVisa.heroImage || 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200&auto=format&fit=crop',
      status: (editingVisa.status as any) || 'ACTIVE',
      featured: !!editingVisa.featured,
      createdAt: editingVisa.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.saveVisa(fullVisa, user);
    setIsEditing(false);
    setEditingVisa(null);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this visa product record?')) {
      db.deleteVisa(id, user);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2 text-[#008972] font-bold text-xs uppercase tracking-wider mb-1">
            <FileText className="w-4 h-4 text-[#00C6A6]" />
            <span>Consular & Visa Operations</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">Visa Management Module</h2>
          <p className="text-sm text-slate-500 max-w-2xl">
            Manage global visa inventory, mandatory document checklists, processing timelines, embassy fees, and service charges.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center space-x-2 bg-[#008972] hover:bg-[#007460] text-white font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-xs text-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Add Visa Product</span>
        </button>
      </div>

      {/* Filter & Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search country, visa type, or requirements..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:border-[#008972]"
          />
        </div>

        <select
          value={selectedCountry}
          onChange={e => setSelectedCountry(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700"
        >
          <option value="all">All Countries</option>
          {Array.from(new Set(visas.map(v => v.country))).map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Visa Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredVisas.map(visa => (
          <div key={visa.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
            <div>
              <div className="h-40 relative overflow-hidden bg-slate-100">
                <img
                  src={visa.heroImage}
                  alt={visa.country}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                <div className="absolute top-3 right-3 flex items-center space-x-1.5">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    visa.status === 'ACTIVE' ? 'bg-emerald-500 text-white' : 'bg-slate-500 text-white'
                  }`}>
                    {visa.status}
                  </span>
                </div>
                <div className="absolute bottom-3 left-3 right-3">
                  <div className="flex items-center space-x-1.5 text-white/80 text-xs font-semibold mb-0.5">
                    <Globe2 className="w-3.5 h-3.5 text-[#00C6A6]" />
                    <span>{visa.country}</span>
                  </div>
                  <h3 className="text-sm font-bold text-white leading-tight">
                    {visa.visaType}
                  </h3>
                </div>
              </div>

              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Processing</span>
                    <span className="font-bold text-slate-800 flex items-center space-x-1">
                      <Clock className="w-3 h-3 text-[#008972]" />
                      <span>{visa.processingTimeDays} Working Days</span>
                    </span>
                  </div>

                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Validity / Stay</span>
                    <span className="font-bold text-slate-800">
                      {visa.validityDays}d / {visa.stayDurationDays}d Stay
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#008972]/5 border border-[#008972]/15 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 block uppercase">Total Cost</span>
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      {visa.currency} {(visa.embassyFee + visa.serviceFee).toLocaleString()}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-semibold">
                    (Emb: ${visa.embassyFee} + Fee: ${visa.serviceFee})
                  </span>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Required Documents ({visa.documentsChecklist.length})</span>
                  <ul className="text-[11px] text-slate-600 space-y-1">
                    {visa.documentsChecklist.slice(0, 3).map((doc, idx) => (
                      <li key={idx} className="flex items-start space-x-1.5 truncate">
                        <CheckSquare className="w-3 h-3 text-[#008972] shrink-0 mt-0.5" />
                        <span className="truncate">{doc}</span>
                      </li>
                    ))}
                    {visa.documentsChecklist.length > 3 && (
                      <li className="text-[10px] text-[#008972] font-bold">
                        +{visa.documentsChecklist.length - 3} more required items
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>

            <div className="p-4 pt-0 border-t border-slate-100 mt-2 flex items-center justify-end space-x-2">
              <button
                onClick={() => {
                  setEditingVisa({ ...visa });
                  setIsEditing(true);
                }}
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg text-xs font-bold flex items-center space-x-1 cursor-pointer transition-colors"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>

              <button
                onClick={() => handleDelete(visa.id)}
                className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg text-xs font-bold flex items-center space-x-1 cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit / Add Modal */}
      {isEditing && editingVisa && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 shadow-2xl p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {editingVisa.id?.startsWith('visa-') && visas.some(v => v.id === editingVisa.id) ? 'Edit Visa Product' : 'Create Visa Product'}
                </h3>
                <p className="text-xs text-slate-500">Configure consular specifications, checklists, fees, and requirements.</p>
              </div>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditingVisa(null);
                }}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Country Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingVisa.country || ''}
                    onChange={e => setEditingVisa({ ...editingVisa, country: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs"
                    placeholder="e.g. Japan, United Kingdom, France"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Visa Type Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingVisa.visaType || ''}
                    onChange={e => setEditingVisa({ ...editingVisa, visaType: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs"
                    placeholder="e.g. Tourist E-Visa (Single Entry)"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Entry Type
                  </label>
                  <select
                    value={editingVisa.entryType || 'SINGLE_ENTRY'}
                    onChange={e => setEditingVisa({ ...editingVisa, entryType: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
                  >
                    <option value="SINGLE_ENTRY">Single Entry</option>
                    <option value="DOUBLE_ENTRY">Double Entry</option>
                    <option value="MULTIPLE_ENTRY">Multiple Entry</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Validity (Days)
                  </label>
                  <input
                    type="number"
                    value={editingVisa.validityDays || 90}
                    onChange={e => setEditingVisa({ ...editingVisa, validityDays: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Max Stay (Days)
                  </label>
                  <input
                    type="number"
                    value={editingVisa.stayDurationDays || 30}
                    onChange={e => setEditingVisa({ ...editingVisa, stayDurationDays: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Processing (Days)
                  </label>
                  <input
                    type="number"
                    value={editingVisa.processingTimeDays || 7}
                    onChange={e => setEditingVisa({ ...editingVisa, processingTimeDays: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Embassy Fee ($)
                  </label>
                  <input
                    type="number"
                    value={editingVisa.embassyFee || 0}
                    onChange={e => setEditingVisa({ ...editingVisa, embassyFee: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    DMC Service Fee ($)
                  </label>
                  <input
                    type="number"
                    value={editingVisa.serviceFee || 0}
                    onChange={e => setEditingVisa({ ...editingVisa, serviceFee: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Status
                  </label>
                  <select
                    value={editingVisa.status || 'ACTIVE'}
                    onChange={e => setEditingVisa({ ...editingVisa, status: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              {/* Hero Image with Upload Support */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Hero Image
                </label>
                <ImageUploadOrUrlInput
                  value={editingVisa.heroImage || ''}
                  onChange={url => setEditingVisa({ ...editingVisa, heroImage: url })}
                  label="Upload or enter Visa banner image URL"
                  placeholder="https://images.unsplash.com/..."
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Overview & Guidelines
                </label>
                <textarea
                  rows={3}
                  value={editingVisa.description || ''}
                  onChange={e => setEditingVisa({ ...editingVisa, description: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>

              {/* Document Checklist Builder */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Mandatory Documents Checklist ({editingVisa.documentsChecklist?.length || 0})
                </label>
                
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newDocText}
                    onChange={e => setNewDocText(e.target.value)}
                    placeholder="Add a required document item..."
                    className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newDocText.trim()) return;
                      const list = editingVisa.documentsChecklist || [];
                      setEditingVisa({ ...editingVisa, documentsChecklist: [...list, newDocText.trim()] });
                      setNewDocText('');
                    }}
                    className="bg-[#008972] text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-[#007460] cursor-pointer"
                  >
                    Add Doc
                  </button>
                </div>

                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {(editingVisa.documentsChecklist || []).map((doc, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                      <span className="truncate pr-2">{doc}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const list = (editingVisa.documentsChecklist || []).filter((_, i) => i !== idx);
                          setEditingVisa({ ...editingVisa, documentsChecklist: list });
                        }}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setEditingVisa(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-xl bg-[#008972] text-white text-xs font-bold hover:bg-[#007460] cursor-pointer shadow-xs"
                >
                  Save Visa Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
