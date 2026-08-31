import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Trash2, 
  Archive, 
  ShieldAlert, 
  CheckCircle2, 
  X, 
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Layers,
  Building2,
  Package,
  FileText,
  MapPin,
  Calendar,
  Users
} from 'lucide-react';
import { db } from '../../services/db';
import { 
  User, 
  CMSDeletableEntityType, 
  DeletionCheckResult, 
  SecureDeleteResult, 
  DependencyGroup 
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
  customWarning
}) => {
  const [depCheck, setDepCheck] = useState<DeletionCheckResult | null>(null);
  const [permCheck, setPermCheck] = useState<{ allowed: boolean; reason?: string }>({ allowed: true });
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmNameInput, setConfirmNameInput] = useState('');
  const [showHardDeleteOverride, setShowHardDeleteOverride] = useState(false);

  useEffect(() => {
    if (isOpen && recordId) {
      const perms = db.canUserDelete(user, entityType);
      setPermCheck(perms);
      const deps = db.checkRecordDependencies(entityType, recordId);
      setDepCheck(deps);
      setErrorMsg(null);
      setConfirmNameInput('');
      setShowHardDeleteOverride(false);
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
      case 'cityhub': case 'destination': return <MapPin className="w-4 h-4 text-rose-600" />;
      case 'task': case 'calendartask': return <Calendar className="w-4 h-4 text-indigo-600" />;
      default: return <Users className="w-4 h-4 text-slate-600" />;
    }
  };

  const handleDelete = async (forceHardDelete: boolean = false) => {
    setIsProcessing(true);
    setErrorMsg(null);
    try {
      const res = db.secureDeleteRecord(entityType, recordId, user, { forceHardDelete });
      if (res.success) {
        if (onSuccess) onSuccess(res);
        onClose();
      } else {
        setErrorMsg(res.message);
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'An unexpected error occurred during record deletion.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleArchive = async () => {
    setIsProcessing(true);
    setErrorMsg(null);
    try {
      const res = db.secureArchiveRecord(entityType, recordId, user);
      if (res.success) {
        if (onSuccess) onSuccess(res);
        onClose();
      } else {
        setErrorMsg(res.message);
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'An unexpected error occurred during record archival.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
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
              <h3 className="font-serif font-bold text-lg text-slate-900 leading-tight">
                {!permCheck.allowed 
                  ? 'Permission Restricted' 
                  : depCheck?.hasDependencies 
                    ? `Cannot Delete This ${entityType}` 
                    : `Delete ${entityType}`
                }
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Record: <span className="font-semibold text-slate-800">{recordTitle || recordId}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
              <div>{errorMsg}</div>
            </div>
          )}

          {/* Scenario 1: Permission Denied */}
          {!permCheck.allowed && (
            <div className="space-y-4">
              <div className="p-4 bg-rose-50/80 border border-rose-200 rounded-xl text-xs leading-relaxed text-rose-800 space-y-2">
                <div className="font-semibold text-rose-900 flex items-center gap-1.5 text-sm">
                  <ShieldAlert className="w-4 h-4" />
                  Administrator Clearance Required
                </div>
                <p>{permCheck.reason}</p>
                <p className="text-rose-700/90 pt-1">
                  If you require deletion access for operational duties, please request an Admin to enable <span className="font-semibold underline">"Delete Records & Media"</span> inside <strong>Team Members → Approval & Access Settings</strong>.
                </p>
              </div>
            </div>
          )}

          {/* Scenario 2: Allowed but Has Active Dependencies */}
          {permCheck.allowed && depCheck?.hasDependencies && (
            <div className="space-y-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-2">
                <div className="font-semibold text-amber-950 flex items-center gap-1.5 text-sm">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  Active Record Dependencies Detected
                </div>
                <p className="font-medium text-amber-900 leading-relaxed">
                  {depCheck.dependencySummary}
                </p>
                <p className="text-amber-800/80">
                  To safeguard quote calculations, active client bookings, and catalog integrity, hard deletion is blocked while linked records exist.
                </p>
              </div>

              {/* Breakdown Accordions */}
              <div className="space-y-2 pt-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Connected Records Breakdown ({depCheck.totalDependencyCount} total):
                </div>
                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden bg-white">
                  {depCheck.groups.map(group => {
                    const isExpanded = expandedGroups[group.entityType];
                    return (
                      <div key={group.entityType} className="text-xs">
                        <button
                          type="button"
                          onClick={() => toggleGroup(group.entityType)}
                          className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors text-left"
                        >
                          <div className="flex items-center gap-2 font-medium text-slate-800">
                            {getGroupIcon(group.entityType)}
                            <span>{group.label}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-400">
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono font-semibold">
                              {group.count}
                            </span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="px-4 py-2 bg-slate-50/50 border-t border-slate-100 space-y-1.5 max-h-40 overflow-y-auto">
                            {group.items.map(item => (
                              <div key={item.id} className="flex items-center justify-between py-1 text-[11px]">
                                <div className="font-medium text-slate-700 truncate max-w-[280px]">
                                  {item.name}
                                </div>
                                {item.details && (
                                  <div className="text-slate-400 text-[10px] truncate max-w-[150px]">
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

              {/* Recommended Solution: Safe Archival */}
              {allowArchive && (
                <div className="p-3.5 bg-indigo-50/60 border border-indigo-100 rounded-xl text-xs text-indigo-900 flex items-start gap-2.5">
                  <Archive className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-indigo-950">Recommended Safe Action: </span>
                    Archive this record instead. It will be hidden from live booking interfaces while preserving full history for existing proposals and financial audits.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Scenario 3: Allowed and Clean (No Dependencies) */}
          {permCheck.allowed && !depCheck?.hasDependencies && (
            <div className="space-y-3 text-xs text-slate-600">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 space-y-1">
                <div className="font-semibold flex items-center gap-1.5 text-sm text-emerald-950">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Safe for Deletion
                </div>
                <p className="text-emerald-800">
                  No active dependencies or linked bookings found. Deleting will permanently remove this record from Firebase and the database.
                </p>
              </div>

              {customWarning && (
                <p className="text-slate-500 italic">
                  {customWarning}
                </p>
              )}

              <p className="text-slate-600">
                Are you sure you want to proceed? This action will be logged in the immutable Audit Trail.
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors disabled:opacity-50"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            {!permCheck.allowed ? (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-semibold hover:bg-slate-900 transition-colors"
              >
                Close
              </button>
            ) : depCheck?.hasDependencies ? (
              <>
                {allowArchive && (
                  <button
                    type="button"
                    onClick={handleArchive}
                    disabled={isProcessing}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition-all flex items-center gap-1.5 shadow-sm shadow-indigo-600/20 disabled:opacity-50"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    {isProcessing ? 'Archiving...' : 'Archive Instead (Safe)'}
                  </button>
                )}
                {user?.role === 'ADMIN' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Warning: Hard deleting will break references in ${depCheck.totalDependencyCount} linked records. Are you sure you wish to override?`)) {
                        handleDelete(true);
                      }
                    }}
                    disabled={isProcessing}
                    className="px-3 py-2 border border-rose-300 text-rose-700 hover:bg-rose-50 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
                    title="Admin Override: Force delete despite linked dependencies"
                  >
                    Force Delete (Admin)
                  </button>
                )}
              </>
            ) : (
              <>
                {allowArchive && (
                  <button
                    type="button"
                    onClick={handleArchive}
                    disabled={isProcessing}
                    className="px-3.5 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    Archive
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(false)}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-semibold hover:bg-rose-700 transition-all flex items-center gap-1.5 shadow-sm shadow-rose-600/20 disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {isProcessing ? 'Deleting...' : 'Delete Permanently'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
