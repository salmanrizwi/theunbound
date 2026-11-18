/**
 * Pure Presentational Expand/Collapse State Machine for
 * B2B Quote Builder -> Step 4: Activities & Experiences
 *
 * Guarantees:
 * - Uses stable day identifiers (`day-<dayNumber>`) instead of array indices.
 * - Single-day expansion by default (opening one day automatically collapses any other).
 * - Explicit Expand All temporarily unlocks simultaneous multi-day review until
 *   Collapse All is clicked.
 * - Recommended Activities sections are strictly collapsed by default and managed
 *   independently from day expansion state.
 * - Zero side effects on quotation pricing, itinerary items, versions, or persistence.
 */

export interface Step4AccordionState {
  isExpandAllActive: boolean;
  expandedDayIds: Record<string, boolean>;
  expandedRecommendedDayIds: Record<string, boolean>;
}

export function getStep4DayId(dayNumber: number): string {
  return `day-${dayNumber}`;
}

export function createInitialStep4AccordionState(dayIds: string[]): Step4AccordionState {
  const firstDayId = dayIds.length > 0 ? dayIds[0] : undefined;
  return {
    isExpandAllActive: false,
    expandedDayIds: firstDayId ? { [firstDayId]: true } : {},
    expandedRecommendedDayIds: {},
  };
}

export function toggleStep4Day(
  prev: Step4AccordionState,
  dayId: string
): Step4AccordionState {
  const isCurrentlyExpanded = Boolean(prev.expandedDayIds[dayId]);

  if (prev.isExpandAllActive) {
    // Temporary multi-day review mode: toggle only the clicked day
    const nextExpanded = { ...prev.expandedDayIds };
    if (isCurrentlyExpanded) {
      delete nextExpanded[dayId];
    } else {
      nextExpanded[dayId] = true;
    }
    return {
      ...prev,
      expandedDayIds: nextExpanded,
    };
  }

  // Default single-day expansion rule:
  // - Clicking the already-expanded day collapses it (0 days expanded).
  // - Clicking a collapsed day expands ONLY that day and collapses any previously expanded day.
  if (isCurrentlyExpanded) {
    return {
      ...prev,
      expandedDayIds: {},
    };
  }

  return {
    ...prev,
    expandedDayIds: { [dayId]: true },
  };
}

export function expandAllStep4Days(
  prev: Step4AccordionState,
  dayIds: string[]
): Step4AccordionState {
  const nextExpanded: Record<string, boolean> = {};
  for (const id of dayIds) {
    nextExpanded[id] = true;
  }
  return {
    ...prev,
    isExpandAllActive: true,
    expandedDayIds: nextExpanded,
  };
}

export function collapseAllStep4Days(
  prev: Step4AccordionState
): Step4AccordionState {
  return {
    ...prev,
    isExpandAllActive: false,
    expandedDayIds: {},
  };
}

export function toggleStep4Recommended(
  prev: Step4AccordionState,
  dayId: string
): Step4AccordionState {
  const isCurrentlyExpanded = Boolean(prev.expandedRecommendedDayIds[dayId]);
  const nextRec = { ...prev.expandedRecommendedDayIds };
  if (isCurrentlyExpanded) {
    delete nextRec[dayId];
  } else {
    nextRec[dayId] = true;
  }
  return {
    ...prev,
    expandedRecommendedDayIds: nextRec,
  };
}

export function reconcileStep4AccordionDays(
  prev: Step4AccordionState,
  dayIds: string[],
  hasInitialized: boolean
): { nextState: Step4AccordionState; initialized: boolean } {
  if (dayIds.length === 0) {
    return { nextState: prev, initialized: hasInitialized };
  }

  if (!hasInitialized) {
    return {
      nextState: createInitialStep4AccordionState(dayIds),
      initialized: true,
    };
  }

  const validSet = new Set(dayIds);
  const nextExpanded: Record<string, boolean> = {};
  if (prev.isExpandAllActive) {
    for (const id of dayIds) {
      nextExpanded[id] = true;
    }
  } else {
    for (const id of Object.keys(prev.expandedDayIds)) {
      if (prev.expandedDayIds[id] && validSet.has(id)) {
        nextExpanded[id] = true;
      }
    }
  }

  const nextRec: Record<string, boolean> = {};
  for (const id of Object.keys(prev.expandedRecommendedDayIds)) {
    if (prev.expandedRecommendedDayIds[id] && validSet.has(id)) {
      nextRec[id] = true;
    }
  }

  return {
    nextState: {
      ...prev,
      expandedDayIds: nextExpanded,
      expandedRecommendedDayIds: nextRec,
    },
    initialized: true,
  };
}
