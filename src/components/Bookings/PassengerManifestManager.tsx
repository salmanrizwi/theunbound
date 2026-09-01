import React, { useState } from 'react';
import { Booking, BookingPassenger, User } from '../../types';
import { AppDatabase } from '../../services/db';
import { 
  Users, 
  UserCheck, 
  Plus, 
  Trash2, 
  Edit, 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  ShieldCheck, 
  Crown, 
  Calendar, 
  CreditCard,
  X
} from 'lucide-react';

interface PassengerManifestManagerProps {
  booking: Booking;
  currentUser: User | null;
  onRefresh: () => void;
}

export const PassengerManifestManager: React.FC<PassengerManifestManagerProps> = ({
  booking,
  currentUser,
  onRefresh
}) => {
  const db = AppDatabase.getInstance();
  const maxPax = (booking.customer?.totalAdults || 0) + (booking.customer?.totalChildren || 0) || 
    booking.items?.reduce((max, it) => Math.max(max, it.totalPax), 0) || 1;
  const currentPassengers = booking.passengers || [];
  const isFull = currentPassengers.length >= maxPax;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPassenger, setEditingPassenger] = useState<BookingPassenger | null>(null);
  const [activePreviewUrl, setActivePreviewUrl] = useState<{ url: string; title: string } | null>(null);

  // Form State
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | 'OTHER'>('MALE');
  const [nationality, setNationality] = useState('Indian');
  const [passportNumber, setPassportNumber] = useState('');
  const [passportIssueDate, setPassportIssueDate] = useState('');
  const [passportExpiryDate, setPassportExpiryDate] = useState('');
  const [isLeadPax, setIsLeadPax] = useState(false);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [mealPreference, setMealPreference] = useState('');
  const [panNumber, setPanNumber] = useState('');

  // Uploaded Files State
  const [passportFrontFile, setPassportFrontFile] = useState<{ name: string; url: string } | null>(null);
  const [passportBackFile, setPassportBackFile] = useState<{ name: string; url: string } | null>(null);
  const [panCardFile, setPanCardFile] = useState<{ name: string; url: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const openAddModal = () => {
    if (isFull) return;
    setEditingPassenger(null);
    setFirstName('');
    setMiddleName('');
    setLastName('');
    setDateOfBirth('');
    setGender('MALE');
    setNationality(booking.customer?.nationality || 'Indian');
    setPassportNumber('');
    setPassportIssueDate('');
    setPassportExpiryDate('');
    setIsLeadPax(currentPassengers.length === 0);
    setPhone(currentPassengers.length === 0 ? booking.customer?.phone || '' : '');
    setEmail(currentPassengers.length === 0 ? booking.customer?.email || '' : '');
    setMealPreference('');
    setPanNumber('');
    setPassportFrontFile(null);
    setPassportBackFile(null);
    setPanCardFile(null);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (pax: BookingPassenger) => {
    setEditingPassenger(pax);
    setFirstName(pax.firstName || '');
    setMiddleName(pax.middleName || '');
    setLastName(pax.lastName || '');
    setDateOfBirth(pax.dateOfBirth || '');
    setGender(pax.gender || 'MALE');
    setNationality(pax.nationality || 'Indian');
    setPassportNumber(pax.passportNumber || '');
    setPassportIssueDate(pax.passportIssueDate || '');
    setPassportExpiryDate(pax.passportExpiryDate || pax.passportExpiry || '');
    setIsLeadPax(pax.isLeadPax || false);
    setPhone(pax.phone || '');
    setEmail(pax.email || '');
    setMealPreference(pax.mealPreference || '');
    setPanNumber(pax.panNumber || '');
    setPassportFrontFile(pax.passportFrontUrl ? { name: pax.passportFrontName || 'Passport_Front.pdf', url: pax.passportFrontUrl } : null);
    setPassportBackFile(pax.passportBackUrl ? { name: pax.passportBackName || 'Passport_Back.pdf', url: pax.passportBackUrl } : null);
    setPanCardFile(pax.panCardUrl ? { name: pax.panCardName || 'PAN_Card.pdf', url: pax.panCardUrl } : null);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'FRONT' | 'BACK' | 'PAN') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Use FileReader for simulated instant browser preview
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const filePayload = { name: file.name, url: dataUrl };
      if (type === 'FRONT') setPassportFrontFile(filePayload);
      if (type === 'BACK') setPassportBackFile(filePayload);
      if (type === 'PAN') setPanCardFile(filePayload);
    };
    reader.readAsDataURL(file);
  };

  const handleSavePassenger = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!firstName.trim() || !lastName.trim()) {
      setFormError('Please enter both first name and last name.');
      return;
    }

    try {
      const payload = {
        firstName: firstName.trim(),
        middleName: middleName.trim(),
        lastName: lastName.trim(),
        dateOfBirth,
        gender,
        nationality,
        passportNumber: passportNumber.trim(),
        passportIssueDate,
        passportExpiryDate,
        passportExpiry: passportExpiryDate,
        isLeadPax,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        mealPreference: mealPreference.trim() || undefined,
        passportFrontUrl: passportFrontFile?.url,
        passportFrontName: passportFrontFile?.name,
        passportFrontUploadedAt: passportFrontFile ? new Date().toISOString() : undefined,
        passportBackUrl: passportBackFile?.url,
        passportBackName: passportBackFile?.name,
        passportBackUploadedAt: passportBackFile ? new Date().toISOString() : undefined,
        panCardUrl: isLeadPax ? panCardFile?.url : undefined,
        panCardName: isLeadPax ? panCardFile?.name : undefined,
        panCardUploadedAt: isLeadPax && panCardFile ? new Date().toISOString() : undefined,
        panNumber: isLeadPax ? panNumber.trim().toUpperCase() : undefined
      };

      if (editingPassenger) {
        db.updateBookingPassenger(booking.id, editingPassenger.id, payload, currentUser);
      } else {
        db.addBookingPassenger(booking.id, payload, currentUser);
      }

      setIsModalOpen(false);
      onRefresh();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save passenger profile');
    }
  };

  const handleDeletePassenger = (paxId: string, paxName: string) => {
    if (window.confirm(`Are you sure you want to remove ${paxName} from this booking manifest?`)) {
      db.deleteBookingPassenger(booking.id, paxId, currentUser);
      onRefresh();
    }
  };

  return (
    <div id="booking-passenger-manifest-section" className="bg-white dark:bg-stone-900 rounded-2xl p-6 border border-stone-200 dark:border-stone-800 shadow-sm mb-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-100 dark:border-stone-800 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-600" />
            <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">
              Passenger Manifest & Compliance Documents
            </h3>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold font-mono ${
              isFull ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
            }`}>
              {currentPassengers.length} / {maxPax} Passengers
            </span>
          </div>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Capacity is strictly bound to original booking request ({maxPax} PAX). Passport Front & Back required for all travelers; PAN card mandatory for Lead Traveler.
          </p>
        </div>

        <button
          id="btn-add-passenger"
          onClick={openAddModal}
          disabled={isFull}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all ${
            isFull 
              ? 'bg-stone-100 text-stone-400 dark:bg-stone-800 dark:text-stone-600 cursor-not-allowed'
              : 'bg-amber-600 hover:bg-amber-700 text-white active:scale-95'
          }`}
        >
          <Plus className="w-4 h-4" />
          Add Passenger Profile ({currentPassengers.length}/{maxPax})
        </button>
      </div>

      {/* Manifest Cards List */}
      {currentPassengers.length === 0 ? (
        <div className="p-8 text-center border-2 border-dashed border-stone-200 dark:border-stone-800 rounded-xl bg-stone-50/50 dark:bg-stone-900/30">
          <Users className="w-8 h-8 text-stone-400 mx-auto mb-2" />
          <p className="text-sm font-semibold text-stone-700 dark:text-stone-300">
            No Passenger Profiles Configured Yet
          </p>
          <p className="text-xs text-stone-500 max-w-md mx-auto mt-1 mb-4">
            Add all {maxPax} passengers to fulfill document verification compliance.
          </p>
          <button
            onClick={openAddModal}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shadow-sm inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Add First Passenger (Lead)
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {currentPassengers.map((pax) => {
            const hasFront = !!pax.passportFrontUrl;
            const hasBack = !!pax.passportBackUrl;
            const hasPan = !!pax.panCardUrl;
            const isLead = pax.isLeadPax;

            return (
              <div 
                key={pax.id} 
                id={`pax-card-${pax.id}`}
                className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-900/70 relative transition-all hover:border-stone-300 dark:hover:border-stone-700 flex flex-col justify-between"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-stone-200 dark:bg-stone-800 text-stone-800 dark:text-stone-200 font-bold font-mono text-xs flex items-center justify-center">
                        #{pax.passengerNumber}
                      </span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                            {pax.fullName || `${pax.firstName} ${pax.lastName}`}
                          </h4>
                          {isLead && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 border border-amber-300 dark:border-amber-700/50 flex items-center gap-1">
                              <Crown className="w-3 h-3 text-amber-600" />
                              Lead Traveler
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-stone-500 font-mono">
                          DOB: {pax.dateOfBirth || 'N/A'} • {pax.gender || 'N/A'} • {pax.nationality || 'Indian'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(pax)}
                        title="Edit Passenger Profile"
                        className="p-1.5 text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-200 dark:hover:bg-stone-800 rounded-lg transition-colors"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeletePassenger(pax.id, pax.fullName || pax.firstName)}
                        title="Remove Passenger"
                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-100 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Passport Details */}
                  <div className="bg-white dark:bg-stone-800/80 p-3 rounded-lg border border-stone-200/80 dark:border-stone-700/60 mb-3 text-xs">
                    <div className="grid grid-cols-2 gap-2 text-stone-600 dark:text-stone-300">
                      <div>
                        <span className="text-[10px] text-stone-400 block uppercase font-medium">Passport Number</span>
                        <span className="font-mono font-semibold">{pax.passportNumber || 'Not Provided'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-stone-400 block uppercase font-medium">Passport Expiry</span>
                        <span className="font-mono font-semibold">{pax.passportExpiryDate || pax.passportExpiry || 'Not Provided'}</span>
                      </div>
                      {pax.mealPreference && (
                        <div className="col-span-2">
                          <span className="text-[10px] text-stone-400 block uppercase font-medium">Meal Preference</span>
                          <span className="text-stone-800 dark:text-stone-200">{pax.mealPreference}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Document Badges */}
                  <div className="space-y-2 mb-3">
                    <div className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                      Attached Documents
                    </div>

                    {/* Passport Front */}
                    <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs">
                      <div className="flex items-center gap-2 truncate">
                        {hasFront ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        )}
                        <span className="truncate">
                          Passport Front {hasFront ? `(${pax.passportFrontName || 'Uploaded'})` : '— Missing'}
                        </span>
                      </div>
                      {hasFront && pax.passportFrontUrl && (
                        <button
                          onClick={() => setActivePreviewUrl({ url: pax.passportFrontUrl!, title: `Passport Front — ${pax.fullName}` })}
                          className="px-2 py-1 text-[11px] bg-stone-100 hover:bg-stone-200 dark:bg-stone-700 dark:hover:bg-stone-600 rounded text-stone-700 dark:text-stone-200 font-medium flex items-center gap-1 shrink-0"
                        >
                          <Eye className="w-3 h-3" /> View
                        </button>
                      )}
                    </div>

                    {/* Passport Back */}
                    <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs">
                      <div className="flex items-center gap-2 truncate">
                        {hasBack ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        )}
                        <span className="truncate">
                          Passport Back {hasBack ? `(${pax.passportBackName || 'Uploaded'})` : '— Missing'}
                        </span>
                      </div>
                      {hasBack && pax.passportBackUrl && (
                        <button
                          onClick={() => setActivePreviewUrl({ url: pax.passportBackUrl!, title: `Passport Back — ${pax.fullName}` })}
                          className="px-2 py-1 text-[11px] bg-stone-100 hover:bg-stone-200 dark:bg-stone-700 dark:hover:bg-stone-600 rounded text-stone-700 dark:text-stone-200 font-medium flex items-center gap-1 shrink-0"
                        >
                          <Eye className="w-3 h-3" /> View
                        </button>
                      )}
                    </div>

                    {/* PAN Card (ONLY for Lead Pax) */}
                    {isLead ? (
                      <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 text-xs">
                        <div className="flex items-center gap-2 truncate">
                          {hasPan ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                          )}
                          <span className="truncate font-medium text-amber-900 dark:text-amber-200">
                            PAN Card (Lead Only) {hasPan ? `— ${pax.panNumber || pax.panCardName || 'Uploaded'}` : '— Missing'}
                          </span>
                        </div>
                        {hasPan && pax.panCardUrl && (
                          <button
                            onClick={() => setActivePreviewUrl({ url: pax.panCardUrl!, title: `PAN Card (Lead) — ${pax.fullName}` })}
                            className="px-2 py-1 text-[11px] bg-amber-100 hover:bg-amber-200 dark:bg-amber-900 dark:hover:bg-amber-800 rounded text-amber-900 dark:text-amber-100 font-medium flex items-center gap-1 shrink-0"
                          >
                            <Eye className="w-3 h-3" /> View
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="p-2 rounded-lg bg-stone-100/60 dark:bg-stone-800/40 border border-stone-200/50 dark:border-stone-700/40 text-[11px] text-stone-400 dark:text-stone-500 italic">
                        PAN Card: N/A (Required for Lead Passenger only)
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Passenger Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-stone-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-stone-200 dark:border-stone-800 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-4 border-b border-stone-100 dark:border-stone-800 mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-600" />
                <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">
                  {editingPassenger ? `Edit Passenger #${editingPassenger.passengerNumber}` : `Add Passenger (#${currentPassengers.length + 1} of ${maxPax})`}
                </h3>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 mb-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {formError}
              </div>
            )}

            <form onSubmit={handleSavePassenger} className="space-y-4">
              {/* Lead Passenger Toggle */}
              <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Crown className="w-4 h-4 text-amber-600" />
                  <div>
                    <span className="text-xs font-bold text-stone-900 dark:text-stone-100">Lead Passenger</span>
                    <p className="text-[11px] text-stone-500">
                      Designate this traveler as the primary contact. Enables PAN card requirement.
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={isLeadPax}
                  onChange={(e) => setIsLeadPax(e.target.checked)}
                  className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                />
              </div>

              {/* Name Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="e.g. Rajesh"
                    className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Middle Name</label>
                  <input
                    type="text"
                    value={middleName}
                    onChange={(e) => setMiddleName(e.target.value)}
                    placeholder="e.g. Kumar"
                    className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="e.g. Malhotra"
                    className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100"
                  />
                </div>
              </div>

              {/* DOB, Gender, Nationality */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Gender</label>
                  <select
                    value={gender}
                    onChange={(e: any) => setGender(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100"
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Nationality</label>
                  <input
                    type="text"
                    value={nationality}
                    onChange={(e) => setNationality(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100"
                  />
                </div>
              </div>

              {/* Passport Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Passport Number</label>
                  <input
                    type="text"
                    value={passportNumber}
                    onChange={(e) => setPassportNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. Z5891243"
                    className="w-full px-3 py-2 rounded-xl text-xs font-mono uppercase bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Passport Issue Date</label>
                  <input
                    type="date"
                    value={passportIssueDate}
                    onChange={(e) => setPassportIssueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Passport Expiry Date</label>
                  <input
                    type="date"
                    value={passportExpiryDate}
                    onChange={(e) => setPassportExpiryDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100"
                  />
                </div>
              </div>

              {/* Document Uploads Section */}
              <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/50 space-y-3">
                <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100 uppercase tracking-wider">
                  Mandatory Document Attachments
                </h4>

                {/* Passport Front Upload */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700">
                  <div>
                    <span className="text-xs font-semibold text-stone-800 dark:text-stone-200 block">
                      1. Passport Front Page (Photo & Bio) *
                    </span>
                    <span className="text-[11px] text-stone-400 font-mono">
                      {passportFrontFile ? passportFrontFile.name : 'No file attached'}
                    </span>
                  </div>
                  <label className="cursor-pointer px-3 py-1.5 bg-stone-100 hover:bg-stone-200 dark:bg-stone-700 dark:hover:bg-stone-600 text-stone-800 dark:text-stone-200 rounded-lg text-xs font-medium flex items-center gap-1.5 shrink-0">
                    <Upload className="w-3.5 h-3.5" />
                    {passportFrontFile ? 'Replace File' : 'Upload Front'}
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => handleFileUpload(e, 'FRONT')}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Passport Back Upload */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700">
                  <div>
                    <span className="text-xs font-semibold text-stone-800 dark:text-stone-200 block">
                      2. Passport Back Page (Address & Endorsement) *
                    </span>
                    <span className="text-[11px] text-stone-400 font-mono">
                      {passportBackFile ? passportBackFile.name : 'No file attached'}
                    </span>
                  </div>
                  <label className="cursor-pointer px-3 py-1.5 bg-stone-100 hover:bg-stone-200 dark:bg-stone-700 dark:hover:bg-stone-600 text-stone-800 dark:text-stone-200 rounded-lg text-xs font-medium flex items-center gap-1.5 shrink-0">
                    <Upload className="w-3.5 h-3.5" />
                    {passportBackFile ? 'Replace File' : 'Upload Back'}
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => handleFileUpload(e, 'BACK')}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Lead Passenger PAN Card */}
                {isLeadPax ? (
                  <div className="p-3 rounded-lg bg-amber-100/50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-amber-600" />
                        3. PAN Card (Mandatory for Lead Passenger) *
                      </span>
                      <label className="cursor-pointer px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0">
                        <Upload className="w-3 h-3" />
                        {panCardFile ? 'Replace PAN' : 'Upload PAN'}
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={(e) => handleFileUpload(e, 'PAN')}
                          className="hidden"
                        />
                      </label>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={panNumber}
                        onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                        placeholder="PAN Number (e.g. ABCDE1234F)"
                        className="w-full px-2.5 py-1.5 rounded-lg text-xs font-mono uppercase bg-white dark:bg-stone-900 border border-amber-300 dark:border-amber-700"
                      />
                      <span className="text-[11px] text-stone-500 font-mono flex items-center truncate">
                        File: {panCardFile ? panCardFile.name : 'No PAN file uploaded'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-2 text-center text-xs text-stone-400 italic">
                    PAN Card is only collected for the Lead Passenger.
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-100 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm"
                >
                  {editingPassenger ? 'Update Passenger Profile' : 'Save Passenger Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document View Preview Modal */}
      {activePreviewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-stone-900 rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col border border-stone-200 dark:border-stone-800 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50">
              <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                {activePreviewUrl.title}
              </h4>
              <button
                onClick={() => setActivePreviewUrl(null)}
                className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 flex-1 overflow-auto flex items-center justify-center bg-stone-100 dark:bg-stone-950">
              <img 
                src={activePreviewUrl.url} 
                alt="Document Preview" 
                className="max-h-[60vh] max-w-full object-contain rounded-lg shadow-md"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
