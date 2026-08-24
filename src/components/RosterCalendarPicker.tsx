import React, { useState } from 'react';
import { useRoster } from '../context/RosterContext';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  ShieldAlert, 
  UserCheck,
  Sparkles,
  ArrowRight,
  Lock
} from 'lucide-react';
import { DateAvailabilityStatus } from '../types';

interface RosterCalendarPickerProps {
  productId: string;
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (dateStr: string) => void;
  paxCount?: number;
  minDate?: string;
  maxDate?: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const RosterCalendarPicker: React.FC<RosterCalendarPickerProps> = ({
  productId,
  selectedDate,
  onSelectDate,
  paxCount = 1,
  minDate,
  maxDate
}) => {
  const { checkDateAvailability, getNextAvailableDate, getMonthlyAvailabilityMap } = useRoster();

  // Selected date parsed
  const initialDate = selectedDate ? new Date(selectedDate + 'T00:00:00') : new Date();
  const [currentYear, setCurrentYear] = useState<number>(initialDate.getFullYear() || 2026);
  const [currentMonth, setCurrentMonth] = useState<number>(initialDate.getMonth() || 7); // 0-indexed

  const monthlyMap = getMonthlyAvailabilityMap(productId, currentYear, currentMonth);
  const currentCheck = checkDateAvailability(productId, selectedDate, paxCount);

  // Calendar Math
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const handleDateClick = (dateStr: string, isAvailable: boolean) => {
    onSelectDate(dateStr);
  };

  const handleJumpToNextAvailable = () => {
    const nextDate = getNextAvailableDate(productId, selectedDate || undefined);
    if (nextDate) {
      onSelectDate(nextDate);
      const parts = nextDate.split('-');
      if (parts.length === 3) {
        setCurrentYear(parseInt(parts[0]));
        setCurrentMonth(parseInt(parts[1]) - 1);
      }
    }
  };

  const getStatusColorClass = (status: DateAvailabilityStatus, isSelected: boolean, isAvailable: boolean) => {
    if (isSelected) {
      return isAvailable
        ? 'bg-[#008972] text-white font-bold ring-2 ring-[#00C6A6] ring-offset-2'
        : 'bg-rose-600 text-white font-bold ring-2 ring-rose-400 ring-offset-2';
    }

    if (!isAvailable) {
      if (status === 'BLOCKED' || status === 'MAINTENANCE') {
        return 'bg-rose-50 text-rose-400 border border-rose-200 line-through opacity-70 cursor-not-allowed hover:bg-rose-100';
      }
      if (status === 'SOLD_OUT') {
        return 'bg-amber-50 text-amber-500 border border-amber-200 line-through opacity-75 cursor-not-allowed hover:bg-amber-100';
      }
      // OFF_ROSTER
      return 'bg-slate-100 text-slate-400 border border-slate-200 line-through opacity-60 cursor-not-allowed';
    }

    if (status === 'LIMITED') {
      return 'bg-amber-50/80 text-amber-900 border border-amber-300 font-semibold hover:bg-amber-100 hover:border-amber-400 cursor-pointer';
    }

    return 'bg-white text-slate-800 border border-slate-200 hover:border-[#00C6A6] hover:bg-emerald-50/50 font-medium cursor-pointer';
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-4">
      {/* Month Navigation Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <CalendarIcon className="w-4 h-4 text-[#008972]" />
          <span className="text-xs font-bold text-slate-900">
            {MONTH_NAMES[currentMonth]} {currentYear}
          </span>
          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
            Live Roster
          </span>
        </div>

        <div className="flex items-center space-x-1">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
            title="Previous Month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
            title="Next Month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Weekday Labels */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAY_NAMES.map((day) => (
          <div key={day} className="text-[10px] font-bold text-slate-400 uppercase tracking-wider py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Day Grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Leading empty cells for month offset */}
        {Array.from({ length: firstDayOfMonth }).map((_, index) => (
          <div key={`empty-${index}`} className="h-9 rounded-lg bg-slate-50/50" />
        ))}

        {/* Days of the month */}
        {Array.from({ length: daysInMonth }).map((_, index) => {
          const dayNum = index + 1;
          const monthStr = String(currentMonth + 1).padStart(2, '0');
          const dayStr = String(dayNum).padStart(2, '0');
          const dateString = `${currentYear}-${monthStr}-${dayStr}`;

          const check = monthlyMap[dateString] || checkDateAvailability(productId, dateString, paxCount);
          const isSelected = selectedDate === dateString;
          const isAvailable = check.isAvailable;

          return (
            <button
              key={dateString}
              type="button"
              onClick={() => handleDateClick(dateString, isAvailable)}
              title={`${dateString}: ${check.reason}`}
              className={`h-9 rounded-lg text-xs transition-all relative flex flex-col items-center justify-center ${getStatusColorClass(
                check.status,
                isSelected,
                isAvailable
              )}`}
            >
              <span className="leading-none">{dayNum}</span>

              {/* Mini Status Dot */}
              {!isSelected && (
                <span
                  className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                    !isAvailable
                      ? check.status === 'BLOCKED' || check.status === 'MAINTENANCE'
                        ? 'bg-rose-500'
                        : check.status === 'SOLD_OUT'
                        ? 'bg-amber-500'
                        : 'bg-slate-300'
                      : check.status === 'LIMITED'
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Availability Legend */}
      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2 border-t border-slate-100">
        <div className="flex items-center space-x-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
          <span>Available</span>
        </div>
        <div className="flex items-center space-x-1">
          <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
          <span>Limited Capacity</span>
        </div>
        <div className="flex items-center space-x-1">
          <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
          <span>Blocked / Blackout</span>
        </div>
        <div className="flex items-center space-x-1">
          <span className="w-2 h-2 rounded-full bg-slate-300 inline-block" />
          <span>Off Roster</span>
        </div>
      </div>

      {/* Selected Date Operational Feedback Banner */}
      <div className="pt-2">
        {currentCheck.isAvailable ? (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-1">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="flex items-center space-x-1.5 text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Available for Booking: {selectedDate}</span>
              </span>
              <span className="text-[10px] font-mono uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                {currentCheck.remainingCapacity} Slots Open
              </span>
            </div>
            {currentCheck.assignedResourceName && (
              <p className="text-[11px] text-emerald-700 flex items-center space-x-1">
                <UserCheck className="w-3.5 h-3.5 shrink-0" />
                <span>Roster Assigned: <strong>{currentCheck.assignedResourceName}</strong></span>
              </p>
            )}
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 space-y-2">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-2">
                <XCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                <div>
                  <span className="text-xs font-bold text-rose-800 block">
                    Unavailable in DMC Roster: {selectedDate || 'No Date Selected'}
                  </span>
                  <p className="text-[11px] text-rose-700 mt-0.5">
                    {currentCheck.reason}
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded uppercase">
                <Lock className="w-2.5 h-2.5" />
                <span>Booking Locked</span>
              </span>
            </div>

            {/* Quick jump to next available date button */}
            <div className="pt-2 border-t border-rose-200/70 flex items-center justify-between">
              <span className="text-[10px] text-rose-600">
                This date cannot be quoted or booked.
              </span>
              <button
                type="button"
                onClick={handleJumpToNextAvailable}
                className="text-[11px] font-bold text-emerald-800 bg-white hover:bg-emerald-50 border border-emerald-300 px-3 py-1 rounded-lg transition-colors flex items-center space-x-1 cursor-pointer shadow-xs"
              >
                <span>Jump to Next Open Date</span>
                <ArrowRight className="w-3 h-3 text-[#008972]" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
