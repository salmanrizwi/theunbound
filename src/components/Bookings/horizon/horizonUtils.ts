import { Booking, BookingItem, CalendarTask } from '../../../types';
import { 
  OperationalItem, 
  OperationalCategory, 
  OperationalSpecificType, 
  HorizonConflict, 
  HorizonAttentionFlag,
  HorizonDailyMetrics 
} from './horizonTypes';

/**
 * Normalizes a date string to YYYY-MM-DD format
 */
export function normalizeDate(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  const clean = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  try {
    const d = new Date(clean);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  } catch {
    // fallback
  }
  return null;
}

/**
 * Checks if a specific date falls within start and end dates (inclusive)
 */
export function isDateInRange(targetDate: string, startDate?: string | null, endDate?: string | null): boolean {
  if (!startDate) return false;
  const target = normalizeDate(targetDate);
  const start = normalizeDate(startDate);
  if (!target || !start) return false;

  const end = normalizeDate(endDate) || start;
  return target >= start && target <= end;
}

/**
 * Categorizes an item based on its category or product description
 */
export function detectCategory(item: BookingItem): OperationalCategory {
  const cat = (item.category || '').toUpperCase();
  const name = (item.productName || '').toLowerCase();

  if (
    cat === 'HOTEL' || 
    cat.includes('ACCOMMODATION') || 
    cat.includes('HOTEL') || 
    name.includes('hotel') || 
    name.includes('resort') || 
    name.includes('ryokan') || 
    name.includes('villa') || 
    item.serviceHotelDetails
  ) {
    return 'HOTEL';
  }

  if (
    cat === 'TRANSFER' || 
    cat === 'TRANSPORT' || 
    cat.includes('TRANSFER') || 
    cat.includes('TRANSPORT') || 
    name.includes('transfer') || 
    name.includes('chauffeur') || 
    name.includes('airport') || 
    name.includes('shuttle') || 
    item.serviceTransferDetails
  ) {
    return 'TRANSFER';
  }

  if (cat === 'VISA' || cat.includes('VISA') || name.includes('visa') || item.serviceVisaDetails) {
    return 'VISA';
  }

  if (cat === 'GUIDE' || name.includes('guide service') || name.includes('escort guide')) {
    return 'GUIDE';
  }

  if (
    cat === 'TOUR' || 
    cat === 'DAY_TOUR' || 
    cat === 'PRIVATE_TOUR' || 
    cat.includes('TOUR') || 
    name.includes('tour') || 
    name.includes('safari') || 
    name.includes('excursion')
  ) {
    return 'TOUR';
  }

  if (
    cat === 'ACTIVITY' || 
    cat.includes('ACTIVITY') || 
    cat.includes('EXPERIENCE') || 
    cat.includes('SIGHTSEEING') || 
    name.includes('ticket') || 
    name.includes('experience') || 
    name.includes('cruise') || 
    name.includes('dinner') || 
    item.serviceSightseeingDetails
  ) {
    return 'ACTIVITY';
  }

  return 'OTHER';
}

/**
 * Determines the specific operational type for an item on the given date
 */
export function determineOperationalType(
  item: BookingItem, 
  category: OperationalCategory, 
  targetDate: string
): { type: OperationalSpecificType; label: string } {
  const target = normalizeDate(targetDate) || targetDate;
  const checkIn = normalizeDate(item.serviceHotelDetails?.checkInDate || item.serviceDate || item.travelDate);
  const checkOut = normalizeDate(item.serviceHotelDetails?.checkOutDate || item.serviceEndDate);

  if (category === 'HOTEL') {
    if (checkIn === target) {
      return { type: 'HOTEL_CHECK_IN', label: 'Hotel Check-in' };
    }
    if (checkOut === target) {
      return { type: 'HOTEL_CHECK_OUT', label: 'Hotel Check-out' };
    }
    if (checkIn && checkOut && target > checkIn && target < checkOut) {
      return { type: 'HOTEL_STAY', label: 'In-House Stay' };
    }
    return { type: 'HOTEL_CHECK_IN', label: 'Hotel Stay' };
  }

  if (category === 'TRANSFER') {
    const name = (item.productName || '').toLowerCase();
    if (name.includes('arrival') || name.includes('airport pickup') || name.includes('inbound')) {
      return { type: 'AIRPORT_TRANSFER', label: 'Airport Arrival Transfer' };
    }
    if (name.includes('departure') || name.includes('airport drop') || name.includes('outbound')) {
      return { type: 'AIRPORT_TRANSFER', label: 'Airport Departure Transfer' };
    }
    if (name.includes('intercity') || name.includes('cross-city')) {
      return { type: 'INTERCITY_TRANSFER', label: 'Intercity Transfer' };
    }
    return { type: 'LOCAL_TRANSFER', label: 'Chauffeur / Transfer' };
  }

  if (category === 'TOUR') {
    const name = (item.productName || '').toLowerCase();
    if (name.includes('private')) {
      return { type: 'PRIVATE_TOUR', label: 'Private Guided Tour' };
    }
    if (name.includes('daily') || name.includes('day tour')) {
      return { type: 'DAILY_TOUR', label: 'Daily Tour' };
    }
    return { type: 'SIGHTSEEING_TOUR', label: 'Sightseeing Tour' };
  }

  if (category === 'ACTIVITY') {
    return { type: 'ACTIVITY', label: 'Attraction & Activity' };
  }

  if (category === 'GUIDE') {
    return { type: 'GUIDE_SERVICE', label: 'Licensed Guide Service' };
  }

  if (category === 'VISA') {
    return { type: 'VISA_TASK', label: 'Visa Biometrics / Appointment' };
  }

  return { type: 'OTHER', label: 'Scheduled Service' };
}

/**
 * Computes attention flags for an operational item
 */
function computeAttentionFlags(item: BookingItem, category: OperationalCategory, booking: Booking): HorizonAttentionFlag[] {
  const flags: HorizonAttentionFlag[] = [];

  // Check supplier allocation
  if (!item.supplierId && !item.supplierName) {
    flags.push({
      id: 'missing-supplier',
      type: 'MISSING_SUPPLIER',
      label: 'Missing Supplier',
      description: 'No contracted ground supplier allocated to this service.',
      severity: 'critical'
    });
  }

  // Check supplier confirmation
  if (item.supplierId || item.supplierName) {
    const confStatus = item.supplierConfirmationStatus;
    if (confStatus === 'Supplier Reconfirmation Required') {
      flags.push({
        id: 'reconfirmation-required',
        type: 'RECONFIRMATION_REQUIRED',
        label: 'Reconfirmation Required',
        description: 'Supplier pricing or details were modified; reconfirmation required.',
        severity: 'critical'
      });
    } else if (confStatus !== 'Confirmed') {
      flags.push({
        id: 'awaiting-confirmation',
        type: 'AWAITING_CONFIRMATION',
        label: 'Awaiting Confirmation',
        description: 'Awaiting supplier confirmation reference / acknowledgement.',
        severity: 'warning'
      });
    }
  }

  // Check price pending
  if (item.supplierPrice === undefined || item.supplierPrice === null) {
    flags.push({
      id: 'price-pending',
      type: 'PRICE_PENDING',
      label: 'Nett Price Pending',
      description: 'Authoritative supplier commercial price has not been recorded.',
      severity: 'info'
    });
  }

  // Check voucher
  if (item.voucherStatus === 'Outdated') {
    flags.push({
      id: 'outdated-voucher',
      type: 'OUTDATED_VOUCHER',
      label: 'Voucher Outdated',
      description: 'Service item was edited after voucher generation; reissue required.',
      severity: 'warning'
    });
  } else if (!item.voucherStatus || item.voucherStatus === 'Not Ready') {
    if (item.supplierConfirmationStatus === 'Confirmed') {
      flags.push({
        id: 'missing-voucher',
        type: 'MISSING_VOUCHER',
        label: 'Voucher Not Issued',
        description: 'Service confirmed with supplier but voucher has not been generated.',
        severity: 'warning'
      });
    }
  }

  // Check transfer specifics
  if (category === 'TRANSFER') {
    const pickupTime = item.serviceTransferDetails?.pickupTime || item.serviceTime;
    if (!pickupTime) {
      flags.push({
        id: 'missing-pickup-time',
        type: 'MISSING_REPORTING_TIME',
        label: 'Missing Pickup Time',
        description: 'Reporting / pickup time is not set for this ground transfer.',
        severity: 'warning'
      });
    }
    const pickupPoint = item.serviceTransferDetails?.pickupPoint || item.pickupLocation;
    if (!pickupPoint) {
      flags.push({
        id: 'missing-pickup-loc',
        type: 'MISSING_PICKUP_LOCATION',
        label: 'Missing Pickup Point',
        description: 'Airport terminal, hotel lobby, or station pickup address is missing.',
        severity: 'warning'
      });
    }
    const driver = item.serviceTransferDetails?.driverName;
    if (!driver && !item.supplierName) {
      flags.push({
        id: 'missing-driver',
        type: 'MISSING_DRIVER',
        label: 'Driver Not Assigned',
        description: 'No chauffeur, driver name, or fleet supplier assigned.',
        severity: 'info'
      });
    }
  }

  // Check tour specifics
  if (category === 'TOUR' || category === 'GUIDE') {
    const time = item.serviceTime;
    if (!time) {
      flags.push({
        id: 'missing-tour-time',
        type: 'MISSING_REPORTING_TIME',
        label: 'Missing Start Time',
        description: 'Start / meeting time has not been confirmed for this tour.',
        severity: 'info'
      });
    }
  }

  // Check operational owner
  if (!booking.operationalOwnerName && !booking.assignedTeamMemberNameSnapshot && !item.assignedTeamMember) {
    flags.push({
      id: 'unassigned-owner',
      type: 'UNASSIGNED_OWNER',
      label: 'Unassigned Internal Owner',
      description: 'No operations team member assigned to oversee execution.',
      severity: 'info'
    });
  }

  return flags;
}

/**
 * Resolves all operational items from bookings and tasks for a given date or range
 */
export function resolveOperationalItems(
  bookings: Booking[],
  calendarTasks: CalendarTask[],
  selectedDate: string,
  isRange: boolean = false,
  endDate?: string
): OperationalItem[] {
  const normSelected = normalizeDate(selectedDate) || selectedDate;
  const normEnd = isRange && endDate ? (normalizeDate(endDate) || endDate) : normSelected;

  const itemsList: OperationalItem[] = [];

  // 1. Process active bookings and their service items
  bookings.forEach(booking => {
    // Skip completely deleted bookings
    if (booking.isDeleted) return;

    const items = booking.items || [];
    const customerName = booking.customer?.leadTravelerName || 
                         booking.customer?.name || 
                         (booking as any).customerName || 
                         (booking as any).buyerName || 
                         'Valued Guest';
    const agentName = booking.agentNameSnapshot || 
                      booking.agentAgencySnapshot || 
                      booking.agencyName || 
                      booking.b2bAgentName;

    items.forEach(item => {
      // Skip cancelled or removed items if desired
      if (item.isCancelled) return;

      const category = detectCategory(item);
      const checkInDate = normalizeDate(item.serviceHotelDetails?.checkInDate || item.serviceDate || item.travelDate);
      const checkOutDate = normalizeDate(item.serviceHotelDetails?.checkOutDate || item.serviceEndDate);
      const serviceDate = normalizeDate(item.serviceDate || item.travelDate || checkInDate);

      // Check dates to see if this item operates on the target window
      const operationalDates: string[] = [];

      if (category === 'HOTEL' && checkInDate && checkOutDate) {
        // Iterate through dates from checkIn to checkOut
        const curr = new Date(checkInDate);
        const end = new Date(checkOutDate);
        // Safety cap at 30 days
        let safetyCounter = 0;
        while (curr <= end && safetyCounter < 30) {
          safetyCounter++;
          const dateStr = curr.toISOString().split('T')[0];
          if (dateStr >= normSelected && dateStr <= normEnd) {
            operationalDates.push(dateStr);
          }
          curr.setDate(curr.getDate() + 1);
        }
      } else if (serviceDate) {
        if (serviceDate >= normSelected && serviceDate <= normEnd) {
          operationalDates.push(serviceDate);
        }
      } else if (booking.travelStartDate) {
        // Fallback to booking travel start date
        const bkStart = normalizeDate(booking.travelStartDate);
        if (bkStart && bkStart >= normSelected && bkStart <= normEnd) {
          operationalDates.push(bkStart);
        }
      }

      // Create an operational item for each matching operational date
      operationalDates.forEach(opDate => {
        const { type, label } = determineOperationalType(item, category, opDate);
        const flags = computeAttentionFlags(item, category, booking);

        const reportingTime = item.serviceTransferDetails?.pickupTime || item.serviceTime || undefined;
        const startTime = item.serviceTime || (type === 'HOTEL_CHECK_IN' ? '15:00' : (type === 'HOTEL_CHECK_OUT' ? '11:00' : undefined));

        const opItem: OperationalItem = {
          id: `${booking.id}_${item.id}_${opDate}_${type}`,
          serviceItemId: item.id,
          bookingId: booking.id,
          bookingReference: booking.bookingReference,
          bookingStatus: booking.status,
          customerName,
          leadPassengerName: customerName,
          b2bAgentName: agentName,
          agencyName: booking.agencyName,
          category,
          operationalType: type,
          operationalTypeLabel: label,
          title: item.productName || 'Service Item',
          serviceDate: opDate,
          endDate: checkOutDate || undefined,
          reportingTime,
          startTime,
          endTime: undefined,
          destination: item.destinationName || item.destination || booking.destinationName || 'Destination',
          hub: item.city || item.cityHub || item.hub || booking.hubName || 'City Center',
          adults: item.adults ?? (booking.customer?.totalAdults || 1),
          children: item.children ?? (booking.customer?.totalChildren || 0),
          infants: item.infants ?? (booking.customer?.totalInfants || 0),
          totalPax: item.totalPax || ((item.adults || 1) + (item.children || 0)),
          supplierId: item.supplierId,
          supplierName: item.supplierNameSnapshot || item.supplierName,
          supplierContact: item.supplierContact || item.supplierPhone,
          supplierPhone: item.supplierPhone,
          supplierEmail: item.supplierEmail,
          supplierConfirmationRef: item.supplierConfirmationRef || item.serviceHotelDetails?.confirmationNumber,
          supplierConfirmationStatus: item.supplierConfirmationStatus || 'Pending',
          operationalStatus: item.operationalStatus || 'Confirmed',
          voucherStatus: item.voucherStatus || 'Ready to Generate',
          voucherCode: item.serviceHotelDetails?.voucherCode || item.serviceSightseeingDetails?.voucherCode,
          pickupLocation: item.serviceTransferDetails?.pickupPoint || item.pickupLocation || (type === 'HOTEL_CHECK_IN' ? item.productName : undefined),
          dropoffLocation: item.serviceTransferDetails?.dropoffPoint || item.dropoffLocation,
          driverName: item.serviceTransferDetails?.driverName,
          driverPhone: item.serviceTransferDetails?.driverPhone,
          vehicleType: item.serviceTransferDetails?.vehicleType,
          licensePlate: item.serviceTransferDetails?.licensePlate,
          guideName: item.serviceSightseeingDetails?.guideName,
          guidePhone: item.serviceSightseeingDetails?.guidePhone,
          tourLanguage: item.serviceSightseeingDetails?.tourLanguage,
          hotelRoomType: item.serviceHotelDetails?.roomType,
          hotelMealPlan: item.serviceHotelDetails?.mealPlan,
          hotelConfirmationNumber: item.serviceHotelDetails?.confirmationNumber || item.supplierConfirmationRef,
          hotelCheckInDate: checkInDate || undefined,
          hotelCheckOutDate: checkOutDate || undefined,
          assignedTeamMember: item.assignedTeamMember || booking.operationalOwnerName || booking.assignedTeamMemberNameSnapshot,
          assignedTeamMemberId: item.assignedTeamMemberId || booking.assignedTeamMemberId,
          operationalInstructions: item.operationalInstructions,
          customerFacingNotes: item.customerFacingNotes,
          internalOpsNotes: item.internalOpsNotes || item.internalNotes,
          supplierPrice: item.supplierPrice,
          supplierCurrency: item.supplierCurrency,
          rawItem: item,
          rawBooking: booking,
          conflicts: [],
          attentionFlags: flags
        };

        itemsList.push(opItem);
      });
    });
  });

  // 2. Process relevant operational CalendarTasks
  calendarTasks.forEach(task => {
    if (task.status === 'COMPLETED' || task.status === 'CANCELLED') return;
    const taskDate = normalizeDate(task.dueDate || task.startDate);
    if (!taskDate || taskDate < normSelected || taskDate > normEnd) return;

    const matchedBooking = bookings.find(b => b.id === task.bookingId || b.bookingReference === task.bookingReference);

    const taskOpItem: OperationalItem = {
      id: `task_${task.id}_${taskDate}`,
      bookingId: task.bookingId || matchedBooking?.id || '',
      bookingReference: task.bookingReference || matchedBooking?.bookingReference || 'SYSTEM-TASK',
      bookingStatus: matchedBooking?.status || 'CONFIRMED',
      customerName: matchedBooking?.customer?.name || matchedBooking?.customer?.leadTravelerName || 'Operational Task',
      leadPassengerName: matchedBooking?.customer?.leadTravelerName || 'Guest',
      b2bAgentName: matchedBooking?.agentNameSnapshot,
      category: 'TASK',
      operationalType: 'OPERATIONAL_TASK',
      operationalTypeLabel: 'Operational Task',
      title: task.title || task.taskName || 'Ground Dispatch Task',
      serviceDate: taskDate,
      startTime: task.startTime || task.dueTime,
      reportingTime: task.dueTime,
      destination: matchedBooking?.destinationName || 'Operations Center',
      hub: matchedBooking?.hubName || 'Ground Ops',
      adults: matchedBooking?.customer?.totalAdults || 1,
      children: matchedBooking?.customer?.totalChildren || 0,
      infants: 0,
      totalPax: matchedBooking?.customer?.totalAdults || 1,
      supplierName: task.supplierId ? 'Linked Supplier' : undefined,
      operationalStatus: 'Pending',
      voucherStatus: 'N/A',
      assignedTeamMember: task.assignedToName,
      assignedTeamMemberId: task.assignedTo,
      operationalInstructions: task.description,
      rawBooking: matchedBooking || ({
        id: task.bookingId || 'sys-bkg',
        bookingReference: task.bookingReference || 'SYSTEM',
        status: 'CONFIRMED',
        currency: 'USD',
        totalAmount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as any),
      rawTask: task,
      conflicts: [],
      attentionFlags: [{
        id: `task-flag-${task.id}`,
        type: 'UNASSIGNED_OWNER',
        label: task.slaStatus === 'SLA_BREACHED' ? 'SLA Breached' : 'Due Today',
        description: task.description || 'Task requires action today.',
        severity: task.slaStatus === 'SLA_BREACHED' ? 'critical' : 'warning'
      }]
    };

    itemsList.push(taskOpItem);
  });

  // 3. Compute Conflict and Feasibility Checks across items for the same booking on the same date
  const itemsByBookingDate = new Map<string, OperationalItem[]>();
  itemsList.forEach(item => {
    if (!item.bookingId) return;
    const key = `${item.bookingId}_${item.serviceDate}`;
    if (!itemsByBookingDate.has(key)) {
      itemsByBookingDate.set(key, []);
    }
    itemsByBookingDate.get(key)!.push(item);
  });

  itemsByBookingDate.forEach(group => {
    if (group.length <= 1) return;

    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];

        // Conflict check: Check time overlap if both have start/reporting times
        const timeA = a.startTime || a.reportingTime;
        const timeB = b.startTime || b.reportingTime;

        if (timeA && timeB) {
          const [hA, mA] = timeA.split(':').map(Number);
          const [hB, mB] = timeB.split(':').map(Number);
          const minA = hA * 60 + mA;
          const minB = hB * 60 + mB;

          // If services start within 30 minutes of each other (excluding hotel check-in/out if not conflicting)
          const isHotel = a.category === 'HOTEL' || b.category === 'HOTEL';
          if (!isHotel && Math.abs(minA - minB) < 45) {
            const conflictA: HorizonConflict = {
              id: `conflict-${a.id}-${b.id}`,
              type: 'OVERLAPPING_TIME',
              title: 'Schedule Conflict',
              message: `Service starts at ${timeA}, conflicting with "${b.title}" scheduled at ${timeB}.`,
              severity: 'critical',
              conflictingItemRef: b.bookingReference,
              conflictingItemTitle: b.title
            };
            const conflictB: HorizonConflict = {
              id: `conflict-${b.id}-${a.id}`,
              type: 'OVERLAPPING_TIME',
              title: 'Schedule Conflict',
              message: `Service starts at ${timeB}, conflicting with "${a.title}" scheduled at ${timeA}.`,
              severity: 'critical',
              conflictingItemRef: a.bookingReference,
              conflictingItemTitle: a.title
            };
            a.conflicts.push(conflictA);
            b.conflicts.push(conflictB);
          }

          // Hotel Check-out vs Airport Departure Transfer check:
          if (a.operationalType === 'HOTEL_CHECK_OUT' && b.operationalType === 'AIRPORT_TRANSFER') {
            if (minB < minA - 60) {
              // Transfer scheduled way before check-out time (informational)
            } else if (minA > minB) {
              // Hotel check-out after transfer departure!
              const c: HorizonConflict = {
                id: `conflict-seq-${a.id}`,
                type: 'SEQUENCING_ANOMALY',
                title: 'Sequencing Anomaly',
                message: `Transfer is scheduled at ${timeB}, but standard check-out is set for ${timeA}.`,
                severity: 'warning',
                conflictingItemRef: b.bookingReference,
                conflictingItemTitle: b.title
              };
              a.conflicts.push(c);
            }
          }
        }
      }
    }
  });

  // 4. Sort Items:
  // 1. Service Date
  // 2. Start Time or Reporting Time
  // 3. Category Priority (Transfers & Check-ins early)
  // 4. Booking Reference
  return itemsList.sort((a, b) => {
    // 1. Date
    if (a.serviceDate !== b.serviceDate) {
      return a.serviceDate.localeCompare(b.serviceDate);
    }

    // 2. Has Time vs No Time (Timed items first)
    const timeA = a.startTime || a.reportingTime;
    const timeB = b.startTime || b.reportingTime;
    if (timeA && !timeB) return -1;
    if (!timeA && timeB) return 1;
    if (timeA && timeB && timeA !== timeB) {
      return timeA.localeCompare(timeB);
    }

    // 3. Category Priority
    const catPriority: Record<OperationalCategory, number> = {
      TRANSFER: 1,
      HOTEL: 2,
      TOUR: 3,
      ACTIVITY: 4,
      GUIDE: 5,
      VISA: 6,
      TASK: 7,
      OTHER: 8
    };
    const pA = catPriority[a.category] || 9;
    const pB = catPriority[b.category] || 9;
    if (pA !== pB) return pA - pB;

    // 4. Booking Reference
    return a.bookingReference.localeCompare(b.bookingReference);
  });
}

/**
 * Computes daily summary metrics for the given operational items
 */
export function calculateDailyMetrics(items: OperationalItem[]): HorizonDailyMetrics {
  const metrics: HorizonDailyMetrics = {
    totalScheduled: items.length,
    hotelCheckIns: 0,
    hotelCheckOuts: 0,
    hotelStays: 0,
    transfers: 0,
    activitiesAndTours: 0,
    visasAndTasks: 0,
    confirmedServices: 0,
    pendingConfirmations: 0,
    missingSuppliers: 0,
    missingVouchers: 0,
    readyForDispatch: 0,
    inProgress: 0,
    completed: 0,
    cancelled: 0,
    itemsRequiringAttention: 0,
    conflictsCount: 0
  };

  items.forEach(item => {
    // Category metrics
    if (item.operationalType === 'HOTEL_CHECK_IN') metrics.hotelCheckIns++;
    else if (item.operationalType === 'HOTEL_CHECK_OUT') metrics.hotelCheckOuts++;
    else if (item.operationalType === 'HOTEL_STAY') metrics.hotelStays++;

    if (item.category === 'TRANSFER') metrics.transfers++;
    if (item.category === 'TOUR' || item.category === 'ACTIVITY' || item.category === 'GUIDE') {
      metrics.activitiesAndTours++;
    }
    if (item.category === 'VISA' || item.category === 'TASK') metrics.visasAndTasks++;

    // Operational Status metrics
    const opStatus = (item.operationalStatus || '').toLowerCase();
    const confStatus = (item.supplierConfirmationStatus || '').toLowerCase();

    if (confStatus === 'confirmed' || opStatus === 'confirmed') {
      metrics.confirmedServices++;
    } else {
      metrics.pendingConfirmations++;
    }

    if (opStatus.includes('ready') || opStatus.includes('dispatch')) metrics.readyForDispatch++;
    if (opStatus.includes('in progress') || opStatus.includes('ongoing')) metrics.inProgress++;
    if (opStatus.includes('completed') || opStatus.includes('finished')) metrics.completed++;
    if (opStatus.includes('cancelled')) metrics.cancelled++;

    // Missing dependencies
    if (!item.supplierId && !item.supplierName && item.category !== 'TASK') {
      metrics.missingSuppliers++;
    }
    if ((!item.voucherStatus || item.voucherStatus === 'Not Ready' || item.voucherStatus === 'Outdated') && item.category !== 'TASK') {
      metrics.missingVouchers++;
    }

    // Attention & Conflicts
    if (item.attentionFlags.length > 0) {
      metrics.itemsRequiringAttention++;
    }
    if (item.conflicts.length > 0) {
      metrics.conflictsCount++;
    }
  });

  return metrics;
}

/**
 * Groups items into time slots for the Timeline view
 */
export interface TimeSlotGroup {
  id: string;
  label: string;
  subLabel: string;
  timeRange: string;
  iconName: 'sun' | 'cloud-sun' | 'moon' | 'clock';
  items: OperationalItem[];
}

export function groupItemsByTimeSlot(items: OperationalItem[]): TimeSlotGroup[] {
  const morning: OperationalItem[] = [];
  const afternoon: OperationalItem[] = [];
  const evening: OperationalItem[] = [];
  const untimed: OperationalItem[] = [];

  items.forEach(item => {
    const time = item.startTime || item.reportingTime;
    if (!time) {
      untimed.push(item);
      return;
    }

    const [h] = time.split(':').map(Number);
    if (h < 12) {
      morning.push(item);
    } else if (h < 17) {
      afternoon.push(item);
    } else {
      evening.push(item);
    }
  });

  return [
    {
      id: 'morning',
      label: 'Morning Operations',
      subLabel: 'Early pickups, morning tours & check-outs',
      timeRange: '05:00 - 11:59',
      iconName: 'sun',
      items: morning
    },
    {
      id: 'afternoon',
      label: 'Afternoon Operations',
      subLabel: 'Midday arrivals, hotel check-ins & excursions',
      timeRange: '12:00 - 16:59',
      iconName: 'cloud-sun',
      items: afternoon
    },
    {
      id: 'evening',
      label: 'Evening & Night Operations',
      subLabel: 'Dinner cruises, late flights & night chauffeurs',
      timeRange: '17:00 - 23:59',
      iconName: 'moon',
      items: evening
    },
    {
      id: 'untimed',
      label: 'Time Not Specified / Flexible',
      subLabel: 'Attractions, open vouchers, in-house stays & pending schedules',
      timeRange: 'Flexible',
      iconName: 'clock',
      items: untimed
    }
  ];
}

/**
 * Formats a clean text dispatch message for copying to clipboard (WhatsApp / SMS)
 */
export function formatDispatchManifestMessage(item: OperationalItem): string {
  const lines: string[] = [];
  lines.push(`🚩 *THEUNBOUND GROUND DISPATCH MANIFEST*`);
  lines.push(`📅 Date: ${item.serviceDate}`);
  if (item.reportingTime || item.startTime) {
    lines.push(`⏰ Time: ${item.reportingTime ? `Pickup ${item.reportingTime}` : `Start ${item.startTime}`}`);
  }
  lines.push(`🏷️ Service: ${item.title}`);
  lines.push(`📋 Booking Ref: #${item.bookingReference}`);
  lines.push(`👤 Lead Guest: ${item.customerName} (${item.totalPax} Pax: ${item.adults}A/${item.children}C)`);
  if (item.b2bAgentName) {
    lines.push(`🏢 Booking Agency: ${item.b2bAgentName}`);
  }

  if (item.pickupLocation) {
    lines.push(`📍 Pickup: ${item.pickupLocation}`);
  }
  if (item.dropoffLocation) {
    lines.push(`🏁 Drop-off: ${item.dropoffLocation}`);
  }

  if (item.driverName) {
    lines.push(`🚗 Chauffeur: ${item.driverName} ${item.driverPhone ? `(${item.driverPhone})` : ''}`);
  }
  if (item.vehicleType) {
    lines.push(`🚘 Vehicle: ${item.vehicleType} ${item.licensePlate ? `[${item.licensePlate}]` : ''}`);
  }

  if (item.guideName) {
    lines.push(`🗣️ Guide: ${item.guideName} ${item.guidePhone ? `(${item.guidePhone})` : ''} [${item.tourLanguage || 'English'}]`);
  }

  if (item.supplierName) {
    lines.push(`🤝 Supplier: ${item.supplierName} ${item.supplierConfirmationRef ? `(Ref: ${item.supplierConfirmationRef})` : ''}`);
  }

  if (item.operationalInstructions) {
    lines.push(`📝 Instructions: ${item.operationalInstructions}`);
  }

  lines.push(`📞 Operations Support: +971 4 200 8900 | TheUnbound DMC Operations Desk`);
  return lines.join('\n');
}
