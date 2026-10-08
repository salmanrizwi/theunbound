import React, { useState } from 'react';
import { Booking, BookingInternalNote, BookingCustomerUpdate, User } from '../../types';
import { AppDatabase } from '../../services/db';
import { 
  Lock, 
  MessageSquare, 
  Send, 
  Plus, 
  Globe, 
  Clock, 
  UserCheck, 
  ShieldAlert,
  Bell,
  CheckCircle2
} from 'lucide-react';

interface CustomerAndInternalNotesProps {
  booking: Booking;
  currentUser: User | null;
  onRefresh: () => void;
}

export const CustomerAndInternalNotes: React.FC<CustomerAndInternalNotesProps> = ({
  booking,
  currentUser,
  onRefresh
}) => {
  const db = AppDatabase.getInstance();
  const internalNotes = booking.internalNotesList || [];
  const customerUpdates = booking.customerUpdates || [];

  const [activeTab, setActiveTab] = useState<'INTERNAL' | 'CUSTOMER'>('INTERNAL');

  // Internal Note Form State
  const [internalNoteText, setInternalNoteText] = useState('');
  const [relatedServiceName, setRelatedServiceName] = useState('');

  // Customer Update Form State
  const [updateTitle, setUpdateTitle] = useState('');
  const [updateMessage, setUpdateMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAdminOrOps = currentUser?.role === 'ADMIN' || currentUser?.role === 'TEAM_MEMBER' || currentUser?.role === 'DMC_STAFF';

  const handleAddInternalNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!internalNoteText.trim()) return;

    db.addBookingInternalNote(
      booking.id,
      internalNoteText.trim(),
      relatedServiceName.trim() || undefined,
      currentUser
    );

    setInternalNoteText('');
    setRelatedServiceName('');
    onRefresh();
  };

  const handlePublishCustomerUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!updateTitle.trim() || !updateMessage.trim()) return;

    setIsSubmitting(true);
    db.publishBookingCustomerUpdate(
      booking.id,
      {
        title: updateTitle.trim(),
        message: updateMessage.trim()
      },
      currentUser
    );

    setUpdateTitle('');
    setUpdateMessage('');
    setIsSubmitting(false);
    onRefresh();
  };

  return (
    <div id="booking-notes-communications-section" className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs mb-6">
      {/* Tab Switcher */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('INTERNAL')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'INTERNAL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Lock className="w-3.5 h-3.5 text-amber-500" />
            <span>Internal Operations Notes ({internalNotes.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('CUSTOMER')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'CUSTOMER'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-[#00C6A6]" />
            <span>Customer-Facing Updates ({customerUpdates.length})</span>
          </button>
        </div>
      </div>

      {/* INTERNAL NOTES VIEW */}
      {activeTab === 'INTERNAL' && (
        <div>
          <div className="p-3.5 mb-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Confidential:</strong> Internal notes are visible only to DMC Staff and Operations Admins. Never exposed to buyers or agents.
            </span>
          </div>

          {/* Add Note Form */}
          {isAdminOrOps && (
            <form onSubmit={handleAddInternalNote} className="mb-6 p-5 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Add Operational Note *</label>
                  <textarea
                    rows={2}
                    required
                    value={internalNoteText}
                    onChange={(e) => setInternalNoteText(e.target.value)}
                    placeholder="e.g. Verified guest meal restrictions with hotel chef. Guide Yuki assigned."
                    className="w-full px-3 py-2 rounded-xl text-xs bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-[#00C6A6] focus:ring-2 focus:ring-[#00C6A6]/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Related Service (Optional)</label>
                  <input
                    type="text"
                    value={relatedServiceName}
                    onChange={(e) => setRelatedServiceName(e.target.value)}
                    placeholder="e.g. Kyoto Guided Tour"
                    className="w-full px-3 py-2 rounded-xl text-xs bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-[#00C6A6] focus:ring-2 focus:ring-[#00C6A6]/20"
                  />
                  <button
                    type="submit"
                    className="w-full mt-2 py-2 bg-[#00C6A6] hover:bg-[#00b094] text-slate-950 rounded-xl text-xs font-black shadow-xs transition-all flex items-center justify-center cursor-pointer"
                  >
                    <span>Save Note</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Notes History */}
          {internalNotes.length === 0 ? (
            <p className="text-xs text-slate-400 italic text-center py-6">No internal notes logged yet.</p>
          ) : (
            <div className="space-y-3">
              {internalNotes.map((note) => (
                <div key={note.id} className="p-4 rounded-2xl border border-slate-200 bg-white shadow-xs">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-900">{note.authorName}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-mono">
                        {note.authorRole}
                      </span>
                      {note.relatedServiceName && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-50 text-[#008f77] border border-teal-200 font-bold">
                          {note.relatedServiceName}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(note.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {note.text}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CUSTOMER-FACING UPDATES VIEW */}
      {activeTab === 'CUSTOMER' && (
        <div>
          <div className="p-3.5 mb-4 rounded-2xl bg-teal-50 border border-teal-200 text-xs text-teal-950 flex items-center gap-2">
            <Globe className="w-4 h-4 text-[#008f77] shrink-0" />
            <span>
              <strong>Customer Portal Sync:</strong> Updates published here are visible to the agent/client on their booking portal and trigger email notifications.
            </span>
          </div>

          {/* Publish Update Form */}
          {isAdminOrOps && (
            <form onSubmit={handlePublishCustomerUpdate} className="mb-6 p-5 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Update Headline / Title *</label>
                <input
                  type="text"
                  required
                  value={updateTitle}
                  onChange={(e) => setUpdateTitle(e.target.value)}
                  placeholder="e.g. Private Kyoto Guide & Hotel Kamogawa River View Confirmed"
                  className="w-full px-3 py-2 rounded-xl text-xs bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-[#00C6A6] focus:ring-2 focus:ring-[#00C6A6]/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Message to Guest / Agent *</label>
                <textarea
                  rows={3}
                  required
                  value={updateMessage}
                  onChange={(e) => setUpdateMessage(e.target.value)}
                  placeholder="Detailed update regarding scheduled vouchers, meeting points, and ground support..."
                  className="w-full px-3 py-2 rounded-xl text-xs bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-[#00C6A6] focus:ring-2 focus:ring-[#00C6A6]/20"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-[#00C6A6] hover:bg-[#00b094] text-slate-950 rounded-xl text-xs font-black shadow-md shadow-[#00C6A6]/20 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Publish & Notify Customer</span>
                </button>
              </div>
            </form>
          )}

          {/* Published Updates Feed */}
          {customerUpdates.length === 0 ? (
            <p className="text-xs text-slate-400 italic text-center py-6">No customer updates published yet.</p>
          ) : (
            <div className="space-y-3">
              {customerUpdates.map((upd) => (
                <div key={upd.id} className="p-4 rounded-2xl border border-teal-200/80 bg-teal-50/40 shadow-xs">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-[#008f77]" />
                      <h4 className="text-xs font-black text-slate-900">{upd.title}</h4>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(upd.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 pl-6 leading-relaxed">
                    {upd.message}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
