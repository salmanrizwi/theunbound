import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  actionCenterReminderService, 
  RecordReminderSummary 
} from '../services/actionCenterReminderService';
import { ActionCenterEntityType, User, CalendarTask } from '../types';
import { useAuth } from '../context/AuthContext';

export interface UseRecordReminderResult extends RecordReminderSummary {
  snooze: (taskId: string, hours?: number) => Promise<{ success: boolean; error?: string }>;
  complete: (taskId: string, notes?: string) => Promise<{ success: boolean; error?: string }>;
  dismiss: (taskId: string, reason?: string) => Promise<{ success: boolean; error?: string }>;
}

export function useRecordReminder(
  entityType: ActionCenterEntityType,
  entityId?: string | null,
  entityReference?: string | null,
  overrideUser?: User | null
): UseRecordReminderResult {
  const { user: authUser } = useAuth();
  const currentUser = overrideUser !== undefined ? overrideUser : authUser;

  const [tick, setTick] = useState(0);

  useEffect(() => {
    const unsubscribe = actionCenterReminderService.subscribe(() => {
      setTick(t => t + 1);
    });
    return unsubscribe;
  }, []);

  const summary = useMemo(() => {
    return actionCenterReminderService.getRecordReminder(
      entityType,
      entityId,
      entityReference,
      currentUser
    );
  }, [entityType, entityId, entityReference, currentUser, tick]);

  const snooze = useCallback(async (taskId: string, hours: number = 4) => {
    return actionCenterReminderService.snoozeTask(taskId, hours, currentUser);
  }, [currentUser]);

  const complete = useCallback(async (taskId: string, notes?: string) => {
    return actionCenterReminderService.completeTask(taskId, currentUser?.name, notes, currentUser);
  }, [currentUser]);

  const dismiss = useCallback(async (taskId: string, reason?: string) => {
    return actionCenterReminderService.dismissTask(taskId, currentUser, reason);
  }, [currentUser]);

  return {
    ...summary,
    snooze,
    complete,
    dismiss
  };
}
