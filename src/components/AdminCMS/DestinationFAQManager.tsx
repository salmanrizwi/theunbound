import React, { useState, useEffect } from 'react';
import { AppDatabase } from '../../services/db';
import { DestinationFAQ, Destination } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { 
  HelpCircle, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  CheckCircle2, 
  Tag, 
  ArrowUpDown
} from 'lucide-react';

interface DestinationFAQManagerProps {
  destinations: Destination[];
}

export const DestinationFAQManager: React.FC<DestinationFAQManagerProps> = ({ destinations }) => {
  const { user } = useAuth();
  const db = AppDatabase.getInstance();
  const [faqs, setFaqs] = useState<DestinationFAQ[]>(db.getDestinationFAQs());
  const [selectedDestination, setSelectedDestination] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editingFAQ, setEditingFAQ] = useState<Partial<DestinationFAQ> | null>(null);

  useEffect(() => {
    return db.subscribe(() => {
      setFaqs(db.getDestinationFAQs());
    });
  }, []);

  const filteredFaqs = faqs.filter(faq => {
    const matchesDest = selectedDestination === 'all' || faq.destinationId === selectedDestination;
    const matchesSearch = faq.question.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          faq.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (faq.category && faq.category.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesDest && matchesSearch;
  });

  const handleOpenAdd = () => {
    const firstDest = destinations[0] || { id: 'japan', name: 'Japan' };
    setEditingFAQ({
      id: `faq-${Date.now()}`,
      destinationId: firstDest.id,
      destinationName: firstDest.name,
      question: '',
      answer: '',
      category: 'General Ground Logistics',
      displayOrder: faqs.length + 1,
      isPublished: true
    });
    setIsEditing(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFAQ || !editingFAQ.question || !editingFAQ.answer || !editingFAQ.destinationId) return;

    const targetDest = destinations.find(d => d.id === editingFAQ.destinationId);
    const completeFAQ: DestinationFAQ = {
      id: editingFAQ.id || `faq-${Date.now()}`,
      destinationId: editingFAQ.destinationId,
      destinationName: targetDest?.name || editingFAQ.destinationName || 'Destination',
      question: editingFAQ.question,
      answer: editingFAQ.answer,
      category: editingFAQ.category || 'General Logistics',
      displayOrder: Number(editingFAQ.displayOrder || 1),
      isPublished: editingFAQ.isPublished !== undefined ? editingFAQ.isPublished : true
    };

    db.saveDestinationFAQ(completeFAQ, user);
    setIsEditing(false);
    setEditingFAQ(null);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to remove this FAQ?')) {
      db.deleteDestinationFAQ(id, user);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2 text-[#00C6A6] font-bold text-xs uppercase tracking-wider mb-1">
            <HelpCircle className="w-4 h-4" />
            <span>Knowledge Base & Pre-Departure</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">Destination FAQs Manager</h2>
          <p className="text-sm text-slate-500">
            Maintain curated FAQs at the destination level (Japan, Southeast Asia, UK, Europe, etc.).
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center bg-[#00C6A6] hover:bg-[#00b094] text-slate-950 font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-md shadow-[#00C6A6]/20 text-sm"
        >
          <span>Add New FAQ</span>
        </button>
      </div>

      {/* Filter & Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search FAQ questions, answers, or categories..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-[#00C6A6]"
          />
        </div>
        <select
          value={selectedDestination}
          onChange={e => setSelectedDestination(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold"
        >
          <option value="all">All Destinations ({faqs.length} FAQs)</option>
          {destinations.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      {/* List of FAQs */}
      <div className="space-y-3">
        {filteredFaqs.map(faq => (
          <div key={faq.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs bg-slate-900 text-white font-bold px-2.5 py-0.5 rounded-md">
                    {faq.destinationName}
                  </span>
                  {faq.category && (
                    <span className="text-xs bg-[#00C6A6]/10 text-[#008f77] font-bold px-2 py-0.5 rounded-md">
                      {faq.category}
                    </span>
                  )}
                  <span className="text-xs text-slate-400 font-mono">
                    Order #{faq.displayOrder}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {faq.question}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {faq.answer}
                </p>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <button
                  onClick={() => {
                    setEditingFAQ(faq);
                    setIsEditing(true);
                  }}
                  className="p-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 cursor-pointer"
                  title="Edit FAQ"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(faq.id)}
                  className="p-2 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 cursor-pointer"
                  title="Delete FAQ"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit / Add Modal */}
      {isEditing && editingFAQ && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
              <div className="flex items-center space-x-2 text-[#00C6A6] font-bold text-xs uppercase tracking-wider">
                <HelpCircle className="w-4 h-4" />
                <span>{editingFAQ.id ? 'Edit Destination FAQ' : 'Add New Destination FAQ'}</span>
              </div>
              <button onClick={() => setIsEditing(false)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Destination
                </label>
                <select
                  value={editingFAQ.destinationId}
                  onChange={e => {
                    const d = destinations.find(dest => dest.id === e.target.value);
                    setEditingFAQ({ 
                      ...editingFAQ, 
                      destinationId: e.target.value,
                      destinationName: d?.name || 'Destination'
                    });
                  }}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold"
                >
                  {destinations.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Category (e.g. Transfers & Logistics, Guides, Dining, Visas)
                </label>
                <input
                  type="text"
                  value={editingFAQ.category || ''}
                  onChange={e => setEditingFAQ({ ...editingFAQ, category: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm"
                  placeholder="e.g. Logistics & Transit"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Question
                </label>
                <input
                  type="text"
                  required
                  value={editingFAQ.question || ''}
                  onChange={e => setEditingFAQ({ ...editingFAQ, question: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold"
                  placeholder="e.g. How do private bullet train luggage dispatches work in Japan?"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Answer
                </label>
                <textarea
                  rows={4}
                  required
                  value={editingFAQ.answer || ''}
                  onChange={e => setEditingFAQ({ ...editingFAQ, answer: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm"
                  placeholder="Provide comprehensive, verified operational answer..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    value={editingFAQ.displayOrder || 1}
                    onChange={e => setEditingFAQ({ ...editingFAQ, displayOrder: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm"
                  />
                </div>
                <div className="flex items-center pt-6">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingFAQ.isPublished !== undefined ? editingFAQ.isPublished : true}
                      onChange={e => setEditingFAQ({ ...editingFAQ, isPublished: e.target.checked })}
                      className="w-4 h-4 text-[#00C6A6] rounded"
                    />
                    <span className="text-xs font-bold text-slate-700">Published on Destination Page</span>
                  </label>
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
                  Save FAQ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
