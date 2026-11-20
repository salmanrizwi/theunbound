import React, { useState, useMemo, useRef, useEffect } from 'react';
import { User } from '../../types';
import {
  getEligibleAccountManagers,
  getAccountManagerWorkloadSummary
} from '../../services/accountManagerService';
import {
  Search,
  ChevronDown,
  UserCheck,
  Check,
  Mail,
  Briefcase,
  AlertCircle,
  X
} from 'lucide-react';

interface AccountManagerSelectorProps {
  value?: string;
  onChange: (accountManagerUid: string, selectedMember?: User) => void;
  allUsers?: User[];
  disabled?: boolean;
  required?: boolean;
  allowClear?: boolean;
  placeholder?: string;
  id?: string;
  showWorkloadCount?: boolean;
}

export const AccountManagerSelector: React.FC<AccountManagerSelectorProps> = ({
  value = '',
  onChange,
  allUsers,
  disabled = false,
  required = false,
  allowClear = false,
  placeholder = 'Select an internal Account Manager...',
  id = 'account-manager-selector',
  showWorkloadCount = true
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const eligibleMembers = useMemo(
    () => getEligibleAccountManagers(allUsers),
    [allUsers]
  );

  const workloadMap = useMemo(() => {
    const summary = getAccountManagerWorkloadSummary(allUsers);
    const map = new Map<string, number>();
    summary.workloads.forEach(w => {
      map.set(w.teamMember.id, w.assignedAgentsCount);
    });
    return map;
  }, [allUsers]);

  const selectedMember = useMemo(
    () => eligibleMembers.find(m => m.id === value) || null,
    [eligibleMembers, value]
  );

  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return eligibleMembers;
    return eligibleMembers.filter(m => {
      const name = (m.name || '').toLowerCase();
      const email = (m.email || '').toLowerCase();
      const designation = (m.jobTitle || (m as any).designation || m.role || '').toLowerCase();
      const dept = (m.department || '').toLowerCase();
      return (
        name.includes(q) ||
        email.includes(q) ||
        designation.includes(q) ||
        dept.includes(q)
      );
    });
  }, [eligibleMembers, searchQuery]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (member: User) => {
    onChange(member.id, member);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div ref={containerRef} id={id} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) setIsOpen(prev => !prev);
        }}
        className={`w-full px-3.5 py-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-2 text-xs ${
          disabled
            ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed'
            : isOpen
            ? 'bg-white border-[#00C6A6] ring-2 ring-[#00C6A6]/20 text-slate-900 cursor-pointer'
            : required && !selectedMember
            ? 'bg-amber-50/40 border-amber-300 hover:border-amber-400 text-slate-900 cursor-pointer'
            : 'bg-slate-50 border-slate-300 hover:bg-white hover:border-slate-400 text-slate-900 cursor-pointer'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs ${
              selectedMember
                ? 'bg-[#00C6A6]/15 text-[#008972]'
                : 'bg-slate-200/80 text-slate-500'
            }`}
          >
            {selectedMember ? (
              selectedMember.name.charAt(0).toUpperCase()
            ) : (
              <UserCheck className="w-3.5 h-3.5" />
            )}
          </div>

          {selectedMember ? (
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-slate-900 truncate">
                  {selectedMember.name}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-bold uppercase">
                  Active
                </span>
              </div>
              <div className="text-[11px] text-slate-500 truncate flex items-center gap-1.5">
                <span>
                  {selectedMember.jobTitle ||
                    (selectedMember as any).designation ||
                    selectedMember.role}
                </span>
                <span>•</span>
                <span className="font-mono">{selectedMember.email}</span>
              </div>
            </div>
          ) : (
            <div className="min-w-0 flex-1">
              <span className="text-slate-500 font-medium block truncate">
                {placeholder}
              </span>
              {required && (
                <span className="text-[10px] text-amber-700 font-semibold block">
                  Mandatory selection required for active B2B Agents
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {allowClear && selectedMember && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange('', undefined);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.stopPropagation();
                  onChange('', undefined);
                }
              }}
              className="p-1 rounded-md hover:bg-slate-200 text-slate-400 hover:text-slate-700"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-50 mt-1.5 w-full bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in duration-150">
          {/* Search Input */}
          <div className="p-2.5 border-b border-slate-100 bg-slate-50/70">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search internal team member by name, designation, or email..."
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#00C6A6]"
              />
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
            {filteredMembers.length === 0 ? (
              <div className="p-5 text-center text-xs text-slate-500 space-y-1">
                <AlertCircle className="w-5 h-5 text-amber-500 mx-auto" />
                <div className="font-bold text-slate-700">
                  No eligible internal Team Members found
                </div>
                <p className="text-[11px] text-slate-400">
                  Only active, approved internal staff accounts can serve as Account Managers.
                </p>
              </div>
            ) : (
              filteredMembers.map((member) => {
                const isSelected = member.id === value;
                const count = workloadMap.get(member.id) ?? 0;
                const designation =
                  member.jobTitle ||
                  (member as any).designation ||
                  member.role;

                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => handleSelect(member)}
                    className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#00C6A6]/10'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                          isSelected
                            ? 'bg-[#00C6A6] text-slate-950'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900 text-xs truncate">
                            {member.name}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-bold">
                            Active AM
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5 flex-wrap">
                          <span className="inline-flex items-center gap-1 truncate">
                            <Briefcase className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{designation}</span>
                          </span>
                          <span>•</span>
                          <span className="inline-flex items-center gap-1 font-mono truncate">
                            <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{member.email}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {showWorkloadCount && (
                        <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-mono text-[10px] font-bold">
                          {count} {count === 1 ? 'agent' : 'agents'}
                        </span>
                      )}
                      {isSelected && (
                        <Check className="w-4 h-4 text-[#008972]" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
