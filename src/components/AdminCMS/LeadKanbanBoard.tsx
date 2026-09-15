import React, { useState } from 'react';
import { TravelLead, LeadStageConfig, CalendarTask } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { 
  ChevronRight, 
  Clock, 
  MapPin, 
  DollarSign, 
  User, 
  Calendar,
  AlertTriangle,
  TrendingUp,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Layers
} from 'lucide-react';
import { RecordReminderIndicator } from '../ActionCenter/RecordReminderIndicator';

export interface LeadKanbanBoardProps {
  leads: TravelLead[];
  stages: LeadStageConfig[];
  onOpenDetail: (lead: TravelLead) => void;
  onOpenEdit: (lead: TravelLead, e?: React.MouseEvent) => void;
  onStageChange: (leadId: string, stageId: string) => void;
  onOpenActionCenter?: (task: CalendarTask) => void;
}

export const LeadKanbanBoard: React.FC<LeadKanbanBoardProps> = ({
  leads,
  stages,
  onOpenDetail,
  onOpenEdit,
  onStageChange,
  onOpenActionCenter
}) => {
  const { user } = useAuth();
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);

  // Active stages sorted by order
  const activeStages = [...stages]
    .filter(s => s.isActive !== false)
    .sort((a, b) => a.order - b.order);

  // Group leads into stages
  const getLeadsForStage = (stage: LeadStageConfig) => {
    return leads.filter(l => {
      if (l.stageId) {
        return l.stageId === stage.id;
      }
      // Fallback matching by status or id
      if (stage.id === 'NEW_ENQUIRY' && (l.status === 'NEW' || !l.status)) return true;
      if (stage.id === 'CONTACTED' && l.status === 'CONTACTED') return true;
      if (stage.id === 'REQUIREMENTS_COLLECTED' && (l.status === 'QUALIFIED' || l.status === 'PROPOSAL_SAVED')) return true;
      if (stage.id === 'QUOTE_DRAFTED' && l.status === 'QUOTE_CREATED') return true;
      if (stage.id === 'QUOTE_SENT' && (l.status === 'QUOTED' || l.status === 'QUOTE_DOWNLOADED')) return true;
      if (stage.id === 'FOLLOW_UP_REQUIRED' && l.status === 'FOLLOW_UP') return true;
      if (stage.id === 'BOOKING_EXPECTED' && l.status === 'BOOKING_SUBMITTED') return true;
      if (stage.id === 'WON' && (l.status === 'WON' || l.conversionStatus === 'CONVERTED')) return true;
      if (stage.id === 'LOST' && (l.status === 'LOST' || l.conversionStatus === 'LOST')) return true;
      if (stage.id === 'ON_HOLD' && l.status === 'ARCHIVED') return true;
      return false;
    });
  };

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    e.dataTransfer.setData('text/plain', leadId);
    setDraggedLeadId(leadId);
  };

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    if (dragOverStageId !== stageId) {
      setDragOverStageId(stageId);
    }
  };

  const handleDragLeave = (stageId: string) => {
    if (dragOverStageId === stageId) {
      setDragOverStageId(null);
    }
  };

  const handleDrop = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData('text/plain') || draggedLeadId;
    if (leadId) {
      onStageChange(leadId, stageId);
    }
    setDraggedLeadId(null);
    setDragOverStageId(null);
  };

  const getPriorityBadge = (priority?: string) => {
    switch (priority) {
      case 'URGENT':
        return (
          <span className="bg-red-100 text-red-800 border border-red-200 font-bold px-1.5 py-0.5 rounded text-[9px] inline-flex items-center gap-0.5">
            <AlertTriangle className="w-2.5 h-2.5 text-red-600" /> Urgent
          </span>
        );
      case 'HIGH':
        return (
          <span className="bg-amber-100 text-amber-800 border border-amber-200 font-semibold px-1.5 py-0.5 rounded text-[9px] inline-flex items-center gap-0.5">
            <TrendingUp className="w-2.5 h-2.5 text-amber-600" /> High
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full overflow-x-auto pb-4 pt-1">
      <div className="flex gap-4 min-w-max items-start">
        {activeStages.map(stage => {
          const stageLeads = getLeadsForStage(stage);
          const stageValue = stageLeads.reduce(
            (sum, l) => sum + Number(l.estimatedBudget || l.bookingValue || 0),
            0
          );
          const isOver = dragOverStageId === stage.id;

          return (
            <div
              key={stage.id}
              id={`kanban-stage-col-${stage.id}`}
              onDragOver={e => handleDragOver(e, stage.id)}
              onDragLeave={() => handleDragLeave(stage.id)}
              onDrop={e => handleDrop(e, stage.id)}
              className={`w-72 bg-slate-100/90 rounded-2xl border transition-all flex flex-col max-h-[calc(100vh-280px)] ${
                isOver 
                  ? 'border-[#008f77] ring-2 ring-[#008f77]/20 bg-teal-50/40' 
                  : 'border-slate-200 shadow-xs'
              }`}
            >
              {/* Column Header */}
              <div className="p-3 border-b border-slate-200 bg-white rounded-t-2xl">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span 
                      className="w-2.5 h-2.5 rounded-full shrink-0" 
                      style={{ backgroundColor: stage.color || '#6366F1' }} 
                    />
                    <h3 className="font-bold text-xs text-slate-900 truncate" title={stage.name}>
                      {stage.name}
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full shrink-0">
                    {stageLeads.length}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                  <span>Win prob: <strong className="text-slate-700">{stage.probability}%</strong></span>
                  <span className="font-mono font-bold text-[#008f77]">
                    ${stageValue.toLocaleString()}
                  </span>
                </div>

                {stage.slaDurationHours && (
                  <div className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-500">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>SLA: {stage.slaDurationHours}h</span>
                    {stage.autoTaskOnEnter && (
                      <span className="text-teal-700 font-medium truncate ml-auto flex items-center gap-0.5">
                        <Sparkles className="w-2.5 h-2.5" /> Auto-task
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Cards Container */}
              <div className="p-2 space-y-2.5 overflow-y-auto flex-1 min-h-[140px]">
                {stageLeads.length === 0 ? (
                  <div className="h-28 flex flex-col items-center justify-center text-slate-400 text-xs border-2 border-dashed border-slate-200 rounded-xl m-1 p-2 text-center">
                    <Layers className="w-5 h-5 text-slate-300 mb-1" />
                    <span>Drop leads here</span>
                  </div>
                ) : (
                  stageLeads.map(lead => {
                    const nextStage = activeStages.find(s => s.order === stage.order + 1);
                    return (
                      <div
                        key={lead.id}
                        id={`kanban-lead-card-${lead.id}`}
                        draggable
                        onDragStart={e => handleDragStart(e, lead.id)}
                        onClick={() => onOpenDetail(lead)}
                        className={`bg-white p-3 rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition-all cursor-grab active:cursor-grabbing space-y-2 group ${
                          draggedLeadId === lead.id ? 'opacity-40 ring-1 ring-slate-400' : ''
                        }`}
                      >
                        {/* Top: Reference and badges */}
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-[10px] font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">
                              {lead.leadNumber}
                            </span>
                            <RecordReminderIndicator
                              entityType="LEAD"
                              entityId={lead.id}
                              entityReference={lead.leadNumber}
                              currentUser={user}
                              variant="badge"
                              onOpenActionCenter={onOpenActionCenter}
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            {getPriorityBadge(lead.priority)}
                          </div>
                        </div>

                        {/* Title & Agency */}
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 group-hover:text-[#008f77] transition-colors line-clamp-1">
                            {lead.contactName}
                          </h4>
                          {lead.agencyName && (
                            <span className="text-[10px] text-teal-700 font-semibold block truncate">
                              {lead.agencyName}
                            </span>
                          )}
                        </div>

                        {/* Destination & Value Info */}
                        <div className="bg-slate-50 p-2 rounded-lg text-[11px] space-y-1">
                          <div className="flex items-center justify-between text-slate-600">
                            <span className="flex items-center gap-1 truncate max-w-[120px]">
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">{lead.destinationName}</span>
                            </span>
                            <span className="font-mono font-bold text-[#008f77]">
                              ${(Number(lead.estimatedBudget || lead.bookingValue || 0)).toLocaleString()}
                            </span>
                          </div>
                          {lead.travelDates && (
                            <div className="flex items-center gap-1 text-slate-400 text-[10px]">
                              <Calendar className="w-2.5 h-2.5 shrink-0" />
                              <span className="truncate">{lead.travelDates}</span>
                            </div>
                          )}
                        </div>

                        {/* Footer with Assigned Staff & Next Stage quick button */}
                        <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px]">
                          <div className="flex items-center gap-1 text-slate-500 truncate max-w-[120px]">
                            <User className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{lead.assignedStaffName?.split(' ')[0] || 'Unassigned'}</span>
                          </div>

                          {nextStage && (
                            <button
                              id={`kanban-advance-${lead.id}`}
                              onClick={e => {
                                e.stopPropagation();
                                onStageChange(lead.id, nextStage.id);
                              }}
                              title={`Advance to ${nextStage.name}`}
                              className="text-[#008f77] hover:text-white hover:bg-[#008f77] px-1.5 py-0.5 rounded flex items-center gap-0.5 font-bold transition-all text-[10px] cursor-pointer"
                            >
                              <span>Next</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
