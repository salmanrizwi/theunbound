import React, { useState, useEffect, useMemo } from 'react';
import { 
  AlertTriangle, 
  Trash2, 
  Archive, 
  ShieldAlert, 
  CheckCircle2, 
  X, 
  ChevronDown, 
  ChevronUp, 
  Layers, 
  Building2, 
  Package, 
  FileText, 
  MapPin, 
  Calendar, 
  Users,
  Loader2,
  Lock,
  ArrowRight,
  UserX
} from 'lucide-react';
import { db } from '../../services/db';
import { inventoryVisibilityService } from '../../services/inventoryVisibilityService';
import { 
  User, 
  CMSDeletableEntityType, 
  DeletionCheckResult, 
  SecureDeleteResult 
} from '../../types';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: SecureDeleteResult) => void;
  entityType: CMSDeletableEntityType;
  recordId: string;
  recordTitle: string;
  user: User | null;
  allowArchive?: boolean;
  customWarning?: string;
  extraDetails?: {
    email?: string;
    role?: string;
    status?: string;
    code?: string;
  };
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  entityType,
  recordId,
  recordTitle,
  user,
  allowArchive = true,
  customWarning,
  extraDetails
}) => {
  const [depCheck, setDepCheck] = useState<DeletionCheckResult | null>(null);
  const [permCheck, setPermCheck] = useState<{ allowed: boolean; reason?: string }>({ allowed: true });
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [typedConfirmation, setTypedConfirmation] = useState('');
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

  // Critical entities that require two-step confirmation (Requirement 16)
  const isCriticalEntity = useMemo(() => {
    return [
      'Destination', 
      'CityHub', 
      'MasterRegion', 
      'User', 
      'Booking', 
      'Package',
      'Hotel'
    ].includes(entityType) || Boolean(depCheck?.hasDependencies);
  }, [entityType, depCheck?.hasDependencies]);

  // Expected confirmation phrase (e.g. JAPAN or Tokyo or Marcus)
  const expectedConfirmationText = useMemo(() => {
    const raw = (recordTitle || recordId || '').trim();
    return raw.toUpperCase();
  }, [recordTitle, recordId]);

  const isConfirmationMatched = useMemo(() => {
    if (!isCriticalEntity && !depCheck?.hasDependencies) return true;
    return typedConfirmation.trim().toUpperCase() === expectedConfirmationText;
  }, [isCriticalEntity, depCheck?.hasDependencies, typedConfirmation, expectedConfirmationText]);

  useEffect(() => {
    if (isOpen && recordId) {
      const perms = db.canUserDelete(user, entityType);
      setPermCheck(perms);
      const deps = db.checkRecordDependencies(entityType, recordId);
      setDepCheck(deps);
      setErrorMsg(null);
      setTypedConfirmation('');
      setCurrentStep(1);
    }
  }, [isOpen, entityType, recordId, user]);

  if (!isOpen) return null;

  const toggleGroup = (groupType: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupType]: !prev[groupType] }));
  };

  const getGroupIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'hotel': return <Building2 className="w-4 h-4 text-amber-600" />;
      case 'product': return <Package className="w-4 h-4 text-blue-600" />;
      case 'package': return <Layers className="w-4 h-4 text-purple-600" />;
      case 'quote': case 'quotation': return <FileText className="w-4 h-4 text-emerald-600" />;
      case 'visa': case 'visarequirement': return <FileText className="w-4 h-4 text-cyan-600" />;
      case 'cityhub': case 'destination': case 'masterregion': return <MapPin className="w-4 h-4 text-rose-600" />;
      case 'task': case 'calendartask': return <Calendar className="w-4 h-4 text-indigo-600" />;
      default: return <Users className="w-4 h-4 text-slate-600" />;
    }
  };

  const handleDelete = async (forceHardDelete: boolean = false) => {
    if (isProcessing) return; // Double-click protection
    setIsProcessing(true);
    setErrorMsg(null);
    try {
      const res = await db.secureDeleteRecordAsync(entityType, recordId, user, { forceHardDelete });
      if (res.success) {
        // Authoritative inventory recalculation & view sync
        inventoryVisibilityService.notifyInventoryChanged();
        if (onSuccess) onSuccess(res);
        onClose();
      } else {
        // Honest error handling (Requirement 23)
        setErrorMsg(`Delete failed: ${res.message || 'The record was not removed. Please review dependencies or permissions.'}`);
      }
    } catch (e: any) {
      setErrorMsg(`Delete failed: ${e.message || 'An unexpected database error occurred.'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleArchive = async () => {
    if (isProcessing) return; // Double-click protection
    setIsProcessing(true);
    setErrorMsg(null);
    try {
      const res = await db.secureArchiveRecordAsync(entityType, recordId, user);
      if (res.success) {
        inventoryVisibilityService.notifyInventoryChanged();
        if (onSuccess) onSuccess(res);
        onClose();
      } else {
        setErrorMsg(`Archive failed: ${res.message || 'The record could not be archived.'}`);
      }
    } catch (e: any) {
      setErrorMsg(`Archive failed: ${e.message || 'An unexpected error occurred during record archival.'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              !permCheck.allowed 
                ? 'bg-rose-100 text-rose-600' 
                : depCheck?.hasDependencies 
                  ? 'bg-amber-100 text-amber-700' 
                  : 'bg-rose-100 text-rose-600'
            }`}>
              {!permCheck.allowed ? (
                <ShieldAlert className="w-5 h-5" />
              ) : depCheck?.hasDependencies ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <Trash2 className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded-md bg-slate-200 text-slate-700">
                  {entityType}
                </span>
                {isCriticalEntity && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-200">
                    High-Risk Action
                  </span>
                )}
              </div>
              <h3 className="font-bold text-base text-slate-900 leading-tight mt-0.5">
                {!permCheck.allowed 
                  ? 'Permission Restricted' 
                  : currentStep === 2
                    ? `Step 2: Confirm Deletion of "${recordTitle}"`
                    : `Delete or Deactivate ${entityType}`
                }
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
              <div className="font-medium">{errorMsg}</div>
            </div>
          )}

          {/* User Profile Card (Requirement 19 for User / Agent Deletion) */}
          {entityType === 'User' && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">
                    {recordTitle.charAt(0)}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{recordTitle}</h4>
                    <p className="text-xs text-slate-500">{extraDetails?.email || recordId}</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-200 text-slate-700">
                  {extraDetails?.role || 'B2B Partner'}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/60 flex items-center justify-between">
                <span>Account Status: <strong className="text-slate-800">{extraDetails?.status || 'Active'}</strong></span>
                <span className="text-slate-400 font-mono text-[10px]">ID: {recordId}</span>
              </div>
            </div>
          )}

          {/* Scenario 1: Permission Denied */}
          {!permCheck.allowed && (
            <div className="space-y-4">
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs leading-relaxed text-rose-800 space-y-2">
                <div className="font-semibold text-rose-900 flex items-center gap-1.5 text-sm">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  Administrator Clearance Required
                </div>
                <p>{permCheck.reason}</p>
                <p className="text-rose-700/90 pt-1">
                  If you require deletion access for operational duties, please request an Admin to grant deletion permissions in <strong>Team Members → Approval & Access Settings</strong>.
                </p>
              </div>
            </div>
          )}

          {/* Scenario 2: Step 1 - Dependency Analysis & Warnings */}
          {permCheck.allowed && currentStep === 1 && (
            <>
              {depCheck?.hasDependencies ? (
                <div className="space-y-4">
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950 space-y-2">
                    <div className="font-bold flex items-center gap-1.5 text-sm text-amber-950">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      Active Record Dependencies Detected
                    </div>
                    <p className="font-medium leading-relaxed text-amber-900">
                      {depCheck.dependencySummary}
                    </p>
                    <p className="text-amber-800/90 text-[11px]">
                      Hard deletion while active dependencies exist can cause broken references in existing quotes and itineraries.
                    </p>
                  </div>

                  {/* Connected Records Breakdown (Requirement 15 & 17) */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                      <span>Connected Records Breakdown:</span>
                      <span className="font-mono text-slate-700 font-bold">{depCheck.totalDependencyCount} Total</span>
                    </div>
                    <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden bg-white">
                      {depCheck.groups.map(group => {
                        const isExpanded = expandedGroups[group.entityType];
                        return (
                          <div key={group.entityType} className="text-xs">
                            <button
                              type="button"
                              onClick={() => toggleGroup(group.entityType)}
                              className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors text-left cursor-pointer"
                            >
                              <div className="flex items-center gap-2 font-medium text-slate-800">
                                {getGroupIcon(group.entityType)}
                                <span>{group.label}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-slate-400">
                                <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-mono font-bold">
                                  {group.count}
                                </span>
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </div>
                            </button>
                            {isExpanded && (
                              <div className="px-4 py-2 bg-slate-50/70 border-t border-slate-100 space-y-1.5 max-h-40 overflow-y-auto">
                                {group.items.map(item => (
                                  <div key={item.id} className="flex items-center justify-between py-1 text-[11px]">
                                    <div className="font-medium text-slate-700 truncate max-w-[280px]">
                                      {item.name}
                                    </div>
                                    {item.details && (
                                      <div className="text-slate-400 text-[10px] truncate max-w-[160px]">
                                        {item.details}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Recommended Safe Action: Archival (Requirement 18 & 20) */}
                  {allowArchive && (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-950 space-y-1.5">
                      <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Recommended Safe Action: Deactivate / Archive
                      </div>
                      <p className="text-emerald-800 text-[11px] leading-relaxed">
                        Immediately removes this record from public & B2B active catalogs while preserving historical quotes, bookings, and audit records.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3 text-xs text-slate-600">
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-sm text-emerald-950">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Safe for Deletion
                    </div>
                    <p className="text-emerald-800 text-[11px]">
                      No active dependencies or linked proposals found. Deleting will permanently remove this record from Firestore and the production database.
                    </p>
                  </div>

                  {customWarning && (
                    <p className="text-slate-500 italic text-[11px]">
                      {customWarning}
                    </p>
                  )}

                  <p className="text-slate-600 text-xs">
                    Are you sure you want to proceed with deleting <strong className="text-slate-900">"{recordTitle}"</strong>?
                  </p>
                </div>
              )}
            </>
          )}

          {/* Scenario 3: Step 2 - High-Risk Two-Step Confirmation (Requirement 16) */}
          {permCheck.allowed && currentStep === 2 && (
            <div className="space-y-4">
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-950 space-y-2">
                <div className="font-bold flex items-center gap-1.5 text-sm text-rose-900">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  Irreversible Production Action
                </div>
                <p className="text-rose-900 text-[11px] leading-relaxed">
                  This action will permanently delete <strong className="font-bold text-rose-950">"{recordTitle}"</strong>.
                  {depCheck?.hasDependencies && ` It directly affects ${depCheck.totalDependencyCount} linked records.`}
                  {entityType === 'User' && ' Historical quotes and proposals will retain their author snapshots.'}
                </p>
              </div>

              <div className="space-y-2 pt-1">
                <label className="block text-xs font-bold text-slate-700">
                  To confirm permanent deletion, type <span className="font-mono bg-slate-100 text-rose-700 px-1.5 py-0.5 rounded font-bold">{expectedConfirmationText}</span> below:
                </label>
                <input
                  type="text"
                  value={typedConfirmation}
                  onChange={e => setTypedConfirmation(e.target.value)}
                  placeholder={`Type "${expectedConfirmationText}"`}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 rounded-xl text-xs font-mono text-slate-900 outline-none transition-all placeholder:text-slate-400"
                  autoFocus
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={currentStep === 2 ? () => setCurrentStep(1) : onClose}
            disabled={isProcessing}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
          >
            {currentStep === 2 ? 'Back' : 'Cancel'}
          </button>

          <div className="flex items-center gap-2">
            {!permCheck.allowed ? (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900 transition-colors cursor-pointer"
              >
                Close
              </button>
            ) : currentStep === 1 ? (
              <>
                {/* Safe Archive Option (Requirement 18) */}
                {allowArchive && (
                  <button
                    type="button"
                    onClick={handleArchive}
                    disabled={isProcessing}
                    className="px-4 py-2 bg-slate-900 hover:bg-[#008972] text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {isProcessing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Archive className="w-3.5 h-3.5 text-[#00E5C0]" />
                    )}
                    <span>{entityType === 'User' ? 'Deactivate Account' : 'Archive (Safe)'}</span>
                  </button>
                )}

                {/* Step 1 Delete / Proceed to Step 2 */}
                {isCriticalEntity ? (
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    disabled={isProcessing}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    <span>Permanent Delete...</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleDelete(false)}
                    disabled={isProcessing}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {isProcessing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    <span>Delete Permanently</span>
                  </button>
                )}
              </>
            ) : (
              /* Step 2 Confirm Permanent Delete */
              <button
                type="button"
                onClick={() => handleDelete(true)}
                disabled={isProcessing || !isConfirmationMatched}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {isProcessing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>Confirm & Permanently Delete</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
