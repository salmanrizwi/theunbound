import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  RosterResource, 
  ProductRosterRule, 
  ProductRosterDateOverride, 
  AvailabilityCheckResult, 
  DateAvailabilityStatus 
} from '../types';
import { INITIAL_ROSTER_RESOURCES, INITIAL_PRODUCT_ROSTER_RULES } from '../data/initialRoster';
import { envService } from '../services/environment';

interface RosterContextType {
  resources: RosterResource[];
  rosterRules: Record<string, ProductRosterRule>;
  checkDateAvailability: (productId: string, dateStr: string, requestedPax?: number) => AvailabilityCheckResult;
  toggleBlackoutDate: (productId: string, dateStr: string, reason?: string) => void;
  setDateOverride: (productId: string, override: ProductRosterDateOverride) => void;
  removeDateOverride: (productId: string, dateStr: string) => void;
  assignResource: (productId: string, dateStr: string, resourceId: string) => void;
  setOperatingDays: (productId: string, days: string[]) => void;
  addResource: (resource: Omit<RosterResource, 'id'>) => void;
  updateResource: (id: string, resource: Partial<RosterResource>) => void;
  deleteResource: (id: string) => void;
  getNextAvailableDate: (productId: string, startDateStr?: string) => string | null;
  getMonthlyAvailabilityMap: (productId: string, year: number, month: number) => Record<string, AvailabilityCheckResult>;
  resetRosterToDefaults: () => void;
}

const RosterContext = createContext<RosterContextType | undefined>(undefined);

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const RosterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const allowDemo = envService.allowDemoData();

  const [resources, setResources] = useState<RosterResource[]>(() => {
    const saved = localStorage.getItem('unbound_roster_resources');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        return allowDemo ? INITIAL_ROSTER_RESOURCES : [];
      }
    }
    return allowDemo ? INITIAL_ROSTER_RESOURCES : [];
  });

  const [rosterRules, setRosterRules] = useState<Record<string, ProductRosterRule>>(() => {
    const saved = localStorage.getItem('unbound_roster_rules');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      } catch (e) {
        return allowDemo ? INITIAL_PRODUCT_ROSTER_RULES : {};
      }
    }
    return allowDemo ? INITIAL_PRODUCT_ROSTER_RULES : {};
  });

  useEffect(() => {
    localStorage.setItem('unbound_roster_resources', JSON.stringify(resources));
  }, [resources]);

  useEffect(() => {
    localStorage.setItem('unbound_roster_rules', JSON.stringify(rosterRules));
  }, [rosterRules]);

  // Helper to parse date string YYYY-MM-DD reliably without timezone shift
  const parseDate = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
    return new Date(dateStr);
  };

  const getDayName = (dateStr: string) => {
    const d = parseDate(dateStr);
    return DAY_NAMES[d.getDay()];
  };

  const getRuleForProduct = (productId: string): ProductRosterRule => {
    const existing = rosterRules[productId];
    if (existing) {
      return {
        ...existing,
        operatingDays: existing.operatingDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        blackoutDates: existing.blackoutDates || [],
        dateOverrides: existing.dateOverrides || {}
      };
    }
    // Default fallback rule if product doesn't have custom roster rule yet
    return {
      productId,
      operatingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      defaultCapacity: 12,
      blackoutDates: [],
      dateOverrides: {}
    };
  };

  const checkDateAvailability = (
    productId: string, 
    dateStr: string, 
    requestedPax: number = 1
  ): AvailabilityCheckResult => {
    if (!dateStr) {
      return {
        isAvailable: false,
        status: 'OFF_ROSTER',
        date: dateStr,
        reason: 'Please select a valid travel date',
        operatingDayName: '',
        maxCapacity: 0,
        remainingCapacity: 0
      };
    }

    const rule = getRuleForProduct(productId);
    const dayName = getDayName(dateStr);

    // 1. Check if date is in explicit blackout list
    if (rule.blackoutDates.includes(dateStr)) {
      const override = rule.dateOverrides[dateStr];
      const reason = override?.reason || 'Scheduled operational blackout / DMC seasonal maintenance';
      return {
        isAvailable: false,
        status: 'BLOCKED',
        date: dateStr,
        reason,
        operatingDayName: dayName,
        maxCapacity: 0,
        remainingCapacity: 0,
        assignedResourceName: override?.assignedResourceName,
        nextAvailableDate: getNextAvailableDate(productId, dateStr) || undefined
      };
    }

    // 2. Check if specific date has an override status
    const override = rule.dateOverrides[dateStr];
    if (override) {
      if (override.status === 'BLOCKED' || override.status === 'OFF_ROSTER' || override.status === 'MAINTENANCE') {
        return {
          isAvailable: false,
          status: override.status,
          date: dateStr,
          reason: override.reason || `Date is ${override.status.toLowerCase().replace('_', ' ')} in DMC roster`,
          operatingDayName: dayName,
          maxCapacity: override.maxCapacity || 0,
          remainingCapacity: 0,
          assignedResourceName: override.assignedResourceName,
          nextAvailableDate: getNextAvailableDate(productId, dateStr) || undefined
        };
      }

      if (override.status === 'SOLD_OUT') {
        return {
          isAvailable: false,
          status: 'SOLD_OUT',
          date: dateStr,
          reason: override.reason || 'All allocated slots are fully booked for this date',
          operatingDayName: dayName,
          maxCapacity: override.maxCapacity || rule.defaultCapacity,
          remainingCapacity: 0,
          assignedResourceName: override.assignedResourceName,
          nextAvailableDate: getNextAvailableDate(productId, dateStr) || undefined
        };
      }

      const maxCap = override.maxCapacity !== undefined ? override.maxCapacity : rule.defaultCapacity;
      const booked = override.bookedPax || 0;
      const remaining = Math.max(0, maxCap - booked);

      if (requestedPax > remaining) {
        return {
          isAvailable: false,
          status: 'SOLD_OUT',
          date: dateStr,
          reason: `Only ${remaining} spaces left on this date (Requested: ${requestedPax} pax)`,
          operatingDayName: dayName,
          maxCapacity: maxCap,
          remainingCapacity: remaining,
          assignedResourceName: override.assignedResourceName,
          nextAvailableDate: getNextAvailableDate(productId, dateStr) || undefined
        };
      }

      return {
        isAvailable: true,
        status: remaining <= 2 ? 'LIMITED' : 'AVAILABLE',
        date: dateStr,
        reason: remaining <= 2 ? `Limited availability: only ${remaining} slots remaining` : 'Confirmed roster availability',
        operatingDayName: dayName,
        maxCapacity: maxCap,
        remainingCapacity: remaining,
        assignedResourceName: override.assignedResourceName
      };
    }

    // 3. Check regular weekly operating days
    if (!rule.operatingDays.includes(dayName)) {
      return {
        isAvailable: false,
        status: 'OFF_ROSTER',
        date: dateStr,
        reason: `Does not operate on ${dayName}s (Operating days: ${rule.operatingDays.join(', ')})`,
        operatingDayName: dayName,
        maxCapacity: 0,
        remainingCapacity: 0,
        nextAvailableDate: getNextAvailableDate(productId, dateStr) || undefined
      };
    }

    // Lookup default assigned resource if available
    let assignedResourceName: string | undefined = undefined;
    if (rule.assignedDefaultResourceId) {
      const resObj = resources.find(r => r.id === rule.assignedDefaultResourceId);
      if (resObj) {
        assignedResourceName = `${resObj.name} (${resObj.role})`;
      }
    }

    // Available
    return {
      isAvailable: true,
      status: 'AVAILABLE',
      date: dateStr,
      reason: 'Guaranteed operational slot available in DMC Roster',
      operatingDayName: dayName,
      maxCapacity: rule.defaultCapacity,
      remainingCapacity: rule.defaultCapacity,
      assignedResourceName
    };
  };

  const getNextAvailableDate = (productId: string, startDateStr?: string): string | null => {
    const baseDate = startDateStr ? parseDate(startDateStr) : new Date();
    
    // Check up to 60 days ahead
    for (let i = 1; i <= 60; i++) {
      const testDate = new Date(baseDate);
      testDate.setDate(baseDate.getDate() + i);
      
      const year = testDate.getFullYear();
      const month = String(testDate.getMonth() + 1).padStart(2, '0');
      const day = String(testDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      const check = checkDateAvailability(productId, dateStr, 1);
      if (check.isAvailable) {
        return dateStr;
      }
    }
    return null;
  };

  const getMonthlyAvailabilityMap = (
    productId: string, 
    year: number, 
    month: number
  ): Record<string, AvailabilityCheckResult> => {
    const map: Record<string, AvailabilityCheckResult> = {};
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    for (let d = 1; d <= daysInMonth; d++) {
      const monthStr = String(month + 1).padStart(2, '0');
      const dayStr = String(d).padStart(2, '0');
      const dateStr = `${year}-${monthStr}-${dayStr}`;
      
      map[dateStr] = checkDateAvailability(productId, dateStr, 1);
    }
    return map;
  };

  const toggleBlackoutDate = (productId: string, dateStr: string, reason?: string) => {
    setRosterRules(prev => {
      const rule = prev[productId] || {
        productId,
        operatingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        defaultCapacity: 12,
        blackoutDates: [],
        dateOverrides: {}
      };

      const isCurrentlyBlackout = rule.blackoutDates.includes(dateStr);
      let newBlackoutDates: string[];
      const newOverrides = { ...rule.dateOverrides };

      if (isCurrentlyBlackout) {
        newBlackoutDates = rule.blackoutDates.filter(d => d !== dateStr);
        delete newOverrides[dateStr];
      } else {
        newBlackoutDates = [...rule.blackoutDates, dateStr];
        newOverrides[dateStr] = {
          date: dateStr,
          status: 'BLOCKED',
          reason: reason || 'Operational DMC Blackout / Resource Blocked'
        };
      }

      return {
        ...prev,
        [productId]: {
          ...rule,
          blackoutDates: newBlackoutDates,
          dateOverrides: newOverrides
        }
      };
    });
  };

  const setDateOverride = (productId: string, override: ProductRosterDateOverride) => {
    setRosterRules(prev => {
      const rule = prev[productId] || {
        productId,
        operatingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        defaultCapacity: 12,
        blackoutDates: [],
        dateOverrides: {}
      };

      let newBlackoutDates = [...rule.blackoutDates];
      if (override.status === 'BLOCKED' || override.status === 'OFF_ROSTER' || override.status === 'MAINTENANCE') {
        if (!newBlackoutDates.includes(override.date)) {
          newBlackoutDates.push(override.date);
        }
      } else {
        newBlackoutDates = newBlackoutDates.filter(d => d !== override.date);
      }

      return {
        ...prev,
        [productId]: {
          ...rule,
          blackoutDates: newBlackoutDates,
          dateOverrides: {
            ...rule.dateOverrides,
            [override.date]: override
          }
        }
      };
    });
  };

  const removeDateOverride = (productId: string, dateStr: string) => {
    setRosterRules(prev => {
      const rule = prev[productId];
      if (!rule) return prev;

      const newOverrides = { ...rule.dateOverrides };
      delete newOverrides[dateStr];

      return {
        ...prev,
        [productId]: {
          ...rule,
          blackoutDates: rule.blackoutDates.filter(d => d !== dateStr),
          dateOverrides: newOverrides
        }
      };
    });
  };

  const assignResource = (productId: string, dateStr: string, resourceId: string) => {
    const resource = resources.find(r => r.id === resourceId);
    if (!resource) return;

    setDateOverride(productId, {
      date: dateStr,
      status: 'AVAILABLE',
      assignedResourceId: resource.id,
      assignedResourceName: `${resource.name} (${resource.role})`,
      notes: `Assigned DMC ${resource.role.toLowerCase()}`
    });
  };

  const setOperatingDays = (productId: string, days: string[]) => {
    setRosterRules(prev => {
      const rule = prev[productId] || {
        productId,
        operatingDays: days,
        defaultCapacity: 12,
        blackoutDates: [],
        dateOverrides: {}
      };

      return {
        ...prev,
        [productId]: {
          ...rule,
          operatingDays: days
        }
      };
    });
  };

  const addResource = (resourceData: Omit<RosterResource, 'id'>) => {
    const newRes: RosterResource = {
      ...resourceData,
      id: `res-${Date.now()}`
    };
    setResources(prev => [...prev, newRes]);
  };

  const updateResource = (id: string, resourceData: Partial<RosterResource>) => {
    setResources(prev => prev.map(r => r.id === id ? { ...r, ...resourceData } : r));
  };

  const deleteResource = (id: string) => {
    setResources(prev => prev.filter(r => r.id !== id));
  };

  const resetRosterToDefaults = () => {
    setResources(allowDemo ? INITIAL_ROSTER_RESOURCES : []);
    setRosterRules(allowDemo ? INITIAL_PRODUCT_ROSTER_RULES : {});
    localStorage.removeItem('unbound_roster_resources');
    localStorage.removeItem('unbound_roster_rules');
  };

  return (
    <RosterContext.Provider
      value={{
        resources,
        rosterRules,
        checkDateAvailability,
        toggleBlackoutDate,
        setDateOverride,
        removeDateOverride,
        assignResource,
        setOperatingDays,
        addResource,
        updateResource,
        deleteResource,
        getNextAvailableDate,
        getMonthlyAvailabilityMap,
        resetRosterToDefaults
      }}
    >
      {children}
    </RosterContext.Provider>
  );
};

export const useRoster = () => {
  const context = useContext(RosterContext);
  if (!context) {
    throw new Error('useRoster must be used within a RosterProvider');
  }
  return context;
};
