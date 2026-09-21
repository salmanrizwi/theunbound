import React, { useState } from 'react';
import { 
  X, 
  Send, 
  Clock, 
  MapPin, 
  Car, 
  Compass, 
  Building2, 
  UserCheck, 
  Copy, 
  Check, 
  Save, 
  AlertCircle, 
  FileText, 
  ShieldCheck,
  Phone,
  User as UserIcon
} from 'lucide-react';
import { OperationalItem } from './horizonTypes';
import { User, Supplier } from '../../../types';
import { AppDatabase } from '../../../services/db';
import { formatDispatchManifestMessage } from './horizonUtils';

interface OperationalDispatchModalProps {
  item: OperationalItem | null;
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  suppliers: Supplier[];
  onSaved: () => void;
}

const OPERATIONAL_STATUS_OPTIONS = [
  'Draft',
  'Pending Supplier',
  'Supplier Allocated',
  'Confirmation Pending',
  'Confirmed',
  'Voucher Pending',
  'Voucher Issued',
  'Ready for Dispatch',
  'In Progress',
  'Completed',
  'On Hold',
  'Cancelled',
  'Failed'
];

export const OperationalDispatchModal: React.FC<OperationalDispatchModalProps> = ({
  item,
  isOpen,
  onClose,
  currentUser,
  suppliers,
  onSaved
}) => {
  const db = AppDatabase.getInstance();

  if (!isOpen || !item) return null;

  // Form State
  const [operationalStatus, setOperationalStatus] = useState<string>(item.operationalStatus || 'Confirmed');
  const [reportingTime, setReportingTime] = useState<string>(item.reportingTime || '');
  const [startTime, setStartTime] = useState<string>(item.startTime || '');
  const [pickupLocation, setPickupLocation] = useState<string>(item.pickupLocation || '');
  const [dropoffLocation, setDropoffLocation] = useState<string>(item.dropoffLocation || '');
  
  // Supplier Allocation
  const [supplierId, setSupplierId] = useState<string>(item.supplierId || '');
  const [supplierConfirmationRef, setSupplierConfirmationRef] = useState<string>(item.supplierConfirmationRef || '');
  
  // Driver / Transport details
  const [driverName, setDriverName] = useState<string>(item.driverName || '');
  const [driverPhone, setDriverPhone] = useState<string>(item.driverPhone || '');
  const [vehicleType, setVehicleType] = useState<string>(item.vehicleType || '');
  const [licensePlate, setLicensePlate] = useState<string>(item.licensePlate || '');

  // Guide details
  const [guideName, setGuideName] = useState<string>(item.guideName || '');
  const [guidePhone, setGuidePhone] = useState<string>(item.guidePhone || '');
  const [tourLanguage, setTourLanguage] = useState<string>(item.tourLanguage || 'English');

  // Notes & Instructions
  const [operationalInstructions, setOperationalInstructions] = useState<string>(item.operationalInstructions || '');
  const [internalOpsNotes, setInternalOpsNotes] = useState<string>(item.internalOpsNotes || '');

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const isInternal = currentUser?.role === 'ADMIN' || currentUser?.role === 'TEAM_MEMBER' || currentUser?.role === 'DMC_STAFF';

  // Copy Dispatch manifest for WhatsApp / SMS
  const handleCopyManifest = () => {
    // Construct updated item snapshot
    const snapshot: OperationalItem = {
      ...item,
      reportingTime,
      startTime,
      pickupLocation,
      dropoffLocation,
      driverName,
      driverPhone,
      vehicleType,
      licensePlate,
      guideName,
      guidePhone,
      tourLanguage,
      operationalInstructions
    };
    const text = formatDispatchManifestMessage(snapshot);
    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2500);
  };

  // Submit Changes
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!item.serviceItemId) {
      // If task, update task directly
      if (item.rawTask) {
        db.saveCalendarTask({
          ...item.rawTask,
          title: item.title,
          description: operationalInstructions,
          status: operationalStatus === 'Completed' ? 'COMPLETED' : 'TO_DO'
        }, currentUser);
        onSaved();
        onClose();
      }
      return;
    }

    setIsSaving(true);
    setErrorMsg('');

    try {
      const selectedSup = suppliers.find(s => s.id === supplierId);

      const updates: any = {
        operationalStatus,
        serviceTime: startTime || undefined,
        operationalInstructions: operationalInstructions.trim() || undefined,
        internalOpsNotes: internalOpsNotes.trim() || undefined
      };

      // Handle supplier change
      if (supplierId && selectedSup) {
        updates.supplierId = selectedSup.id;
        updates.supplierName = selectedSup.name;
        updates.supplierContact = `${selectedSup.phone || ''} ${selectedSup.email || ''}`.trim();
        updates.supplierPhone = selectedSup.phone;
        updates.supplierEmail = selectedSup.email;
        updates.supplierConfirmationRef = supplierConfirmationRef.trim() || undefined;
      } else if (!supplierId && item.supplierId) {
        // Unallocate
        updates.supplierId = null;
        updates.supplierName = null;
        updates.supplierContact = null;
      }

      // Transfer details
      if (item.category === 'TRANSFER') {
        updates.serviceTransferDetails = {
          ...(item.rawItem?.serviceTransferDetails || {}),
          pickupPoint: pickupLocation.trim() || undefined,
          dropoffPoint: dropoffLocation.trim() || undefined,
          pickupTime: reportingTime.trim() || undefined,
          driverName: driverName.trim() || undefined,
          driverPhone: driverPhone.trim() || undefined,
          vehicleType: vehicleType.trim() || undefined,
          licensePlate: licensePlate.trim() || undefined
        };
      }

      // Sightseeing / Guide details
      if (item.category === 'TOUR' || item.category === 'ACTIVITY' || item.category === 'GUIDE') {
        updates.serviceSightseeingDetails = {
          ...(item.rawItem?.serviceSightseeingDetails || {}),
          meetingPoint: pickupLocation.trim() || undefined,
          guideName: guideName.trim() || undefined,
          guidePhone: guidePhone.trim() || undefined,
          tourLanguage: tourLanguage.trim() || undefined
        };
      }

      // Hotel details
      if (item.category === 'HOTEL') {
        updates.serviceHotelDetails = {
          ...(item.rawItem?.serviceHotelDetails || {}),
          confirmationNumber: supplierConfirmationRef.trim() || undefined
        };
      }

      const res = db.updateServiceItem(item.bookingId, item.serviceItemId, updates, currentUser);
      if (!res.success) {
        setErrorMsg(res.error || 'Failed to update operational dispatch.');
        setIsSaving(false);
        return;
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'An unexpected error occurred while saving.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div 
        id="horizon-dispatch-modal" 
        className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden my-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 px-6 border-b border-slate-200 bg-slate-50/70">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-[#008972] text-white flex items-center justify-center font-black shadow-xs">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-black text-slate-900">
                  Ground Dispatch & Service Execution
                </h3>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-slate-200 text-slate-800">
                  #{item.bookingReference}
                </span>
              </div>
              <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                {item.title} • {item.leadPassengerName} ({item.totalPax} Pax)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="p-4 mx-6 mt-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Operational Status & Times */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Operational Status
              </label>
              <select
                value={operationalStatus}
                onChange={(e) => setOperationalStatus(e.target.value)}
                className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-hidden focus:border-[#008972]"
              >
                {OPERATIONAL_STATUS_OPTIONS.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Pickup / Reporting Time
              </label>
              <input
                type="time"
                value={reportingTime}
                onChange={(e) => setReportingTime(e.target.value)}
                placeholder="HH:mm"
                className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-hidden focus:border-[#008972]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Service Start Time
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                placeholder="HH:mm"
                className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-hidden focus:border-[#008972]"
              />
            </div>
          </div>

          {/* Supplier Allocation & Confirmation Ref */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Allocated Ground Supplier
              </label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-hidden focus:border-[#008972]"
              >
                <option value="">-- No Supplier Allocated --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.category || 'General'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Supplier Confirmation / Voucher Ref
              </label>
              <input
                type="text"
                value={supplierConfirmationRef}
                onChange={(e) => setSupplierConfirmationRef(e.target.value)}
                placeholder="e.g. HTL-CONF-8891, PNR-992"
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-hidden focus:border-[#008972]"
              />
            </div>
          </div>

          {/* Location details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center space-x-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>Pickup Location / Meeting Point</span>
              </label>
              <input
                type="text"
                value={pickupLocation}
                onChange={(e) => setPickupLocation(e.target.value)}
                placeholder="Airport Terminal, Hotel Lobby, Port Gate..."
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-hidden focus:border-[#008972]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center space-x-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>Drop-off Destination</span>
              </label>
              <input
                type="text"
                value={dropoffLocation}
                onChange={(e) => setDropoffLocation(e.target.value)}
                placeholder="Hotel, Station, Airport Terminal..."
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-hidden focus:border-[#008972]"
              />
            </div>
          </div>

          {/* Transfer Fleet details */}
          {item.category === 'TRANSFER' && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-amber-50/50 border border-amber-200/80">
              <div>
                <label className="block text-[11px] font-bold text-amber-900 mb-1">
                  Chauffeur / Driver
                </label>
                <input
                  type="text"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="Driver Full Name"
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white border border-amber-200 text-slate-900 focus:outline-hidden focus:border-[#008972]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-amber-900 mb-1">
                  Driver Phone
                </label>
                <input
                  type="text"
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                  placeholder="+971 50 123 4567"
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white border border-amber-200 text-slate-900 focus:outline-hidden focus:border-[#008972]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-amber-900 mb-1">
                  Vehicle Type
                </label>
                <input
                  type="text"
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value)}
                  placeholder="e.g. Alphard MPV"
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white border border-amber-200 text-slate-900 focus:outline-hidden focus:border-[#008972]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-amber-900 mb-1">
                  License Plate
                </label>
                <input
                  type="text"
                  value={licensePlate}
                  onChange={(e) => setLicensePlate(e.target.value)}
                  placeholder="DXB-8821"
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white border border-amber-200 text-slate-900 focus:outline-hidden focus:border-[#008972]"
                />
              </div>
            </div>
          )}

          {/* Tour Guide details */}
          {(item.category === 'TOUR' || item.category === 'GUIDE') && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200/80">
              <div>
                <label className="block text-[11px] font-bold text-emerald-900 mb-1">
                  Assigned Guide
                </label>
                <input
                  type="text"
                  value={guideName}
                  onChange={(e) => setGuideName(e.target.value)}
                  placeholder="Licensed Guide Name"
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white border border-emerald-200 text-slate-900 focus:outline-hidden focus:border-[#008972]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-emerald-900 mb-1">
                  Guide Phone
                </label>
                <input
                  type="text"
                  value={guidePhone}
                  onChange={(e) => setGuidePhone(e.target.value)}
                  placeholder="+81 90 1234 5678"
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white border border-emerald-200 text-slate-900 focus:outline-hidden focus:border-[#008972]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-emerald-900 mb-1">
                  Tour Language
                </label>
                <input
                  type="text"
                  value={tourLanguage}
                  onChange={(e) => setTourLanguage(e.target.value)}
                  placeholder="English, French, Japanese..."
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white border border-emerald-200 text-slate-900 focus:outline-hidden focus:border-[#008972]"
                />
              </div>
            </div>
          )}

          {/* Instructions and Internal Notes */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Operational Dispatch Instructions (Manifest & Driver Visible)
              </label>
              <textarea
                value={operationalInstructions}
                onChange={(e) => setOperationalInstructions(e.target.value)}
                rows={2}
                placeholder="Flight numbers, child seat requirement, VIP luggage greeting instructions..."
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-hidden focus:border-[#008972]"
              />
            </div>

            {isInternal && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Internal Ops Team Notes (Restricted)
                </label>
                <textarea
                  value={internalOpsNotes}
                  onChange={(e) => setInternalOpsNotes(e.target.value)}
                  rows={2}
                  placeholder="Internal coordinator handover, contingency notes..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-hidden focus:border-[#008972]"
                />
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={handleCopyManifest}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
            >
              {copySuccess ? (
                <>
                  <Check className="w-4 h-4 text-teal-600" />
                  <span className="text-teal-700 font-black">Copied Manifest!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-500" />
                  <span>Copy WhatsApp / SMS Manifest</span>
                </>
              )}
            </button>

            <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2.5 rounded-xl bg-[#008972] hover:bg-[#00705d] text-white text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50 inline-flex items-center space-x-2"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Saving...' : 'Save & Update Dispatch'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
